/* ================================================================
   My Island v3, kids update — SLPeopleArt (KU-CH10): the people in 2D.
   window.SLPeopleArt in the browser (loaded by window.slLoadPeople() after the people-shapes
   files), module.exports in Node. No DOM, no THREE, no storage: strings and plain objects only.

   ONE RECIPE, TWO RENDERERS (CH-D8). A person is the same box lists the 3D rig is made of
   (people-shapes-body / -hair / -wear / -acc, assembled by SLPxPeople.boxes when the 3D stage is
   loaded, else step for step here), posed with the same clip layer (SLCharacters sampleAvatar, the
   AV_KEYS pose the person rig's setPose applies; the games' frames are baked in FRAMES / POSES for
   pages without the stage), so the 2D figure never drifts from the 3D one and no item needs
   hand-made 2D art.

   THE PROJECTOR. sprite(desc, o) → {rows, pal, alpha, w, h, px, foot: {x, y}, view} | null
     desc   avatarInfo(w, u) ({look, wear, vr, lk?, wr?}), a cast display(id), {friend: true,
            wear?, vr?} (the Fitting Friend), a box list ({bone: [box…]}) or {boxes, look?, joints?, hand?}
     o      view   'front' (the default; the figure faces you) · 'side' (it faces right; facing:
                   'left' mirrors) · 'back' · 'top' (from above, its face toward the top)
            pose   an avatar clip name ('idle', 'run', 'shoot', 'sigFreeze' …) or a FRAMES name
                   ('run1', 'jump', 'kick' …); t its time (s); reduced → the clip's still pose
            px     pixels per voxel (default 2: a person is about 22 × 46 pixels with the outline)
            root   'ground' (the default: the clip's travel is dropped and the lowest pixel stands on
                   the ground row) or 'keep' (the clip's own x / y / z; the ground row stays in the box)
            wand   true / false: draw the Spark Stick (default: when the pose raises it, wand ≥ 0.5,
                   and the hand is empty or holds the stick, as the 3D rig at Showtime)
            color  the member colour ('#rrggbb') for the classic hoodie and the stick
            bones  only these bones (headIcon) · tier 'HIGH' (2D has no triangle budget)
     Each bone's boxes are rasterised into unit (and quarter) cells exactly as people-shapes-body's
     raster() does (layers by bone and lattice, a later box paints over an earlier one, erase boxes
     clear), hidden inner cells are dropped, every cell is moved by its bone's posed matrix and its
     projected footprint is splatted with a z-buffer onto the pixel grid (pixel = 1 / px voxel; a
     proud layer and a later layer win a tie). Then a pixel with a 4-neighbour nearer by a voxel or
     more takes its colour's Shade (the 3D bevel's job: limbs, the head's rounded sides and the hem
     read apart), and every empty pixel touching the figure becomes the 1 px outline, Midnight Ink
     at 70% (CH-D19). rows use '.' for empty and 'o' for the outline; alpha {o: 0.7}.
     foot = the ground point under the figure in pixel units from the top-left corner: x the root's
     column edge, y the top edge of the bottom row (the soles end there; the outline row is under
     them). In the top view foot is the root seen from above.

   USES (each an SVG string; '' when there is nothing to draw)
     svg(sprite, o)        the sprite through ART.pix (one <path> per colour, about 10-25; the outline's
                           path has fill-opacity 0.7); o {unit, w, h, x, y (where the foot lands),
                           shadow, cls, label}
     figure(info, o)       the 2D island's 'That’s you!' figure: viewBox 0 0 70 110 (the .slw-me box),
                           its shadow at (35, 104), feet on it, front view at rest
     icon(id, o)           a shop card picture (viewBox 100 × 100, transparent): a 'char_*' id → its
                           head and shoulders in its default look; a 'wear_*' id → the Fitting Friend
                           wearing it, cropped to the piece (head, face and neck pieces as a bust, a
                           top or a hand piece from the hips up, a bottom from the waist down, shoes
                           from the thighs down, a back piece from behind); a dye → the Friend with
                           shoulder waves in that colour. No skin tone, no name
     headIcon(look, o)     the head alone (hair, covering, glasses, aid) for the creator's grids
     portrait(info, o)     head and shoulders for the games' HUDs; square
     gameSprite(info, name, o) / gameSprites(info, game, o)   the games' frames (GAME_SPRITES:
                           'run' side view 96 × 120, 'shootout' back view, 'kart' the driver from above)
                           with each frame's foot on the frame's foot point
   CACHE. Compositions per (look, wear, colourways, member colour) and sprites per (look, wear, view,
   pose, frame, options) are kept in memory only (small LRUs; clear() empties them). Nothing is ever
   written to storage, and no name or photo is ever part of a sprite.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPeopleArt = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1, GC = 0.05, DEG = Math.PI / 180;
  var VIEWS = ['front', 'side', 'back', 'top'];
  var OUTLINE = { token: 'Midnight Ink', hex: '#14101F', alpha: 0.7, ch: 'o' };
  var CREASE = 0.95;                  /* voxels: a neighbour this much nearer shades a pixel */
  var PROUD_BIAS = 0.05, LAYER_BIAS = 1e-4;
  var FALLBACK_HEX = '#C9B8F0';      /* PX Clay Lilac: an unknown token never draws a hole */
  var SHADE = 0.86, CACHE_MAX = 240;
  var CHARS = 'abcdefghijklmnpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-/:;<=>?@[]^_{|}~';
  var EXTRA_PARENT = { hairTail: 'head', cape0: 'body', cape1: 'cape0', cape2: 'cape1', visor: 'head', antenna: 'body' };

  /* ---------------- siblings: the page's globals, else one require() in Node ---------------- */
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  var required = {};
  function sib(name, path, key) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!own(required, name)) {
      try { var r = require(path); required[name] = (key ? r && r[key] : r) || null; } catch (e) { required[name] = null; }
    }
    return required[name];
  }
  function body() { return sib('SLPeopleShapesBody', './people-shapes-body.js'); }
  function hairM() { return sib('SLPeopleShapesHair', './people-shapes-hair.js'); }
  function wearM() { return sib('SLPeopleShapesWear', './people-shapes-wear.js'); }
  function accM() { return sib('SLPeopleShapesAcc', './people-shapes-acc.js'); }
  function core() { return sib('SLPeopleCore', './people-core.js'); }
  function clips() { return sib('SLCharacters', './island3d/models-characters.js'); }
  function art() { return sib('SLWorldArt', './world-art.js', 'SLWorldArt'); }
  function lookM() { return sib('SLIslandLook', './world-look.js'); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function n1(v) { return String(Math.round(v * 100) / 100); }

  /* ---------------- colour ---------------- */
  function normHex(h) { var m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? '#' + m[1].toUpperCase() : null; }
  function shadeHex(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * SHADE).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  var hexMemo = {};
  /* '#RRGGBB' for a token: people-core's TOKENS (the colours the 3D rig registers), the body file's
     resolver (people palettes, ' Shade' partners), world-look; an SLVox palette entry with a state
     (the member colour) takes ctx.color; an unknown token draws Clay Lilac (never a hole) */
  function tokenHex(c, color) {
    if (c && typeof c === 'object') {
      if (c.state && (color || (c.state.map && c.state.map.own))) {
        var own0 = normHex(color) || normHex(c.state.map && c.state.map.own);
        if (own0) return /Shade/.test(String(c.state.key || '') + ' ' + String(c.token || '')) ? shadeHex(own0) : own0;
      }
      c = c.token || (c.state && (c.state.off || c.state.on));
    }
    if (typeof c !== 'string' || !c) return FALLBACK_HEX;
    if (own(hexMemo, c)) return hexMemo[c];
    var hx = normHex(c), mods = [core(), wearM(), accM()], L, i;
    for (i = 0; !hx && i < mods.length; i++) if (mods[i] && mods[i].TOKENS && own(mods[i].TOKENS, c)) hx = normHex(mods[i].TOKENS[c]);
    mods = [body(), wearM(), accM()];
    for (i = 0; !hx && i < mods.length; i++) if (mods[i] && typeof mods[i].hexOf === 'function') { try { hx = normHex(mods[i].hexOf(c)); } catch (e) { hx = null; } }
    if (!hx && (L = lookM()) && typeof L.resolve === 'function') { try { hx = normHex(L.resolve(c)); } catch (e) { hx = null; } }
    if (!hx && / Shade$/.test(c)) { var base = tokenHex(c.slice(0, -6)); hx = base === FALLBACK_HEX ? null : shadeHex(base); }
    if (hx) hexMemo[c] = hx;                /* a miss is not kept: a shapes file may load later */
    return hx || FALLBACK_HEX;
  }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lab(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
    function f(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  function deltaE(a, b) { var p = lab(a), q = lab(b); return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)); }
  function mix(a, b, k) { var p = rgb(a), q = rgb(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(p[i] + (q[i] - p[i]) * k).toString(16)).slice(-2); }).join('').toUpperCase(); }
  /* the outline as it lands on a ground colour (Midnight Ink at 70% over it) */
  function outlineOn(groundHex) { return mix(normHex(groundHex) || '#FFFFFF', OUTLINE.hex, OUTLINE.alpha); }

  /* ================================================================
     COMPOSITION: desc → the person's box lists, joints and bones
     ================================================================ */
  function isBoxList(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.look || o.boxes) return false;
    var ks = Object.keys(o);
    return ks.length > 0 && ks.every(function (k) { return Array.isArray(o[k]); });
  }
  /* TWO ROUTES to the same recipe (CH-D8), each feature-detected:
     1. SLPxPeople.describe + boxes (KU-CH9, on a page with the 3D stage): what the rig draws
     2. the same assembly here, step for step (px-people's order and rules), for the pages without
        the 3D stage (the 2D island, a 2D game): the accessories first (KU-CH8 SLPeopleShapesAcc.dress:
        a hat's volume, coversEyes, earsHidden, hideKippah), then the dressed figure (KU-CH7
        SLPeopleShapesWear.dress: body, face, identity pieces and garments), else the plain layer
        with the identity pieces (KU-CH4 / CH5); a piece on the Fitting Friend is its file's display()
     A test keeps the two equal box for box whenever px-people is present. Both return {look, show,
     flags, boxes, joints, J, hand: 'spark' | 'item' | null, stick}: a Spark Stick's own boxes are
     lifted out of the figure into `stick` (folded away until a pose raises it, as the rig). */
  var BONES_OK = { base: 1, body: 1, head: 1, armL: 1, armR: 1, legL: 1, legR: 1, wand: 1, eyes: 1, hairTail: 1, cape0: 1, cape1: 1, cape2: 1, visor: 1, antenna: 1 };
  var SLOTS = ['top', 'bottom', 'shoes', 'outfit', 'head', 'face', 'neck', 'back', 'hand'];
  function pxPeople() { return sib('SLPxPeople', './island3d/px-people.js'); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function call(M, name, args) {
    if (!M || typeof M[name] !== 'function') return null;
    try { var r = M[name].apply(M, args); return r && typeof r === 'object' ? r : null; } catch (e) { return null; }
  }
  function boneLists(r) {
    var out = {};
    if (r) Object.keys(r).forEach(function (b) { if (Array.isArray(r[b]) && own(BONES_OK, b)) out[b] = r[b].slice(); });
    return out;
  }
  function jointsFrom(r, into) {
    var j = r && r.joints;
    if (plain(j)) Object.keys(j).forEach(function (b) { if (own(BONES_OK, b) && Array.isArray(j[b]) && j[b].length >= 3 && j[b].every(isFinite)) into[b] = j[b].slice(0, 3).map(Number); });
    return into;
  }
  function noEars(list) { if (list.head) list.head = list.head.filter(function (bx) { return bx.tag !== 'ear'; }); return list; }
  function resolved(desc) {
    var P = core(), B = body();
    if (P && typeof P.resolve === 'function') {
      try { var r = P.resolve(desc.look, desc.wear, desc.vr); return { look: r.look, worn: r.worn, show: r.show, hidden: r.hidden, vr: r.vr, flags: r.flags }; } catch (e) { /* the local rules */ }
    }
    var lk = B.drawLook(desc.look), show = {};
    SLOTS.forEach(function (s) { if (plain(desc.wear) && typeof desc.wear[s] === 'string') show[s] = desc.wear[s]; });
    return { look: lk, show: show, hidden: {}, vr: plain(desc.vr) ? desc.vr : {}, flags: { hair: lk.hs !== 0, glasses: lk.gl > 0, hood: false, spark: !show.hand || show.hand === 'wear_free_spark' } };
  }
  function made(look, r, list, joints, hand, route) {
    var stick = null;
    if (hand === 'spark' && list.wand) { stick = { wand: list.wand }; delete list.wand; }
    return { look: look, show: r.show, flags: r.flags, boxes: list, joints: joints || {}, J: body().jointsOf(look), hand: hand, stick: stick, route: route };
  }
  /* route 1: px-people's own assembly (as a rig builds it: the stick's boxes included) */
  function viaRig(opts) {
    var X = pxPeople();
    if (!X || typeof X.describe !== 'function' || typeof X.boxes !== 'function' || (typeof X.ready === 'function' && !X.ready())) return null;
    try {
      var d = X.describe(opts), asm = X.boxes(d, { rig: true });
      return asm && asm.list ? made(d.look, d, B0(asm.list), Object.assign({}, asm.joints || {}), asm.hand === undefined ? null : asm.hand, 'px-people') : null;
    } catch (e) { return null; }
  }
  function B0(list) { var out = {}; Object.keys(list).forEach(function (b) { if (Array.isArray(list[b])) out[b] = list[b].slice(); }); return out; }
  /* route 2: the same steps here; r = what is shown */
  function assemble(r, member) {
    var B = body(), H = hairM(), W = wearM(), A = accM(), lk = r.look, joints = {}, list;
    var acc = call(A, 'dress', [lk, r.show, r.vr, { member: member }]);
    var coversEyes = !r.flags.glasses || !!(acc && acc.coversEyes), omit = acc && typeof acc.omit === 'function' ? acc.omit : null;
    var hl = acc && acc.hideKippah && lk.cv === 5 ? Object.assign({}, lk, { cv: 0 }) : lk;
    var fig = call(W, 'dress', [hl, r.worn || r.show, r.vr, { member: member, coversEyes: coversEyes, omit: omit }]);
    if (fig) { list = boneLists(fig); jointsFrom(fig, joints); }
    else {
      var hood = !!r.flags.hood, om = function (i, j, k) { return (hood && k < 4) || (omit ? !!omit(i, j, k) : false); };
      var head = H && typeof H.headPieces === 'function' ? H.headPieces(hl, { omit: hood || omit ? om : null, coversEyes: coversEyes }) : {};
      if (hood) delete head.hairTail;
      list = B.merge(B.person(hl), head);
      if (head.hairTail && head.joints && head.joints.hairTail) joints.hairTail = head.joints.hairTail.slice();
      if (hood || (H && typeof H.earsHidden === 'function' && H.earsHidden(hl))) noEars(list);
    }
    if (acc) { if (acc.earsHidden) noEars(list); list = B.merge(list, boneLists(acc)); jointsFrom(acc, joints); }
    return made(lk, r, list, joints, r.flags.spark ? 'spark' : 'item', 'shapes');
  }
  function personComp(desc, o) {
    var member = normHex(o.color);
    return viaRig({ look: desc.look, wear: desc.wear, vr: desc.vr, member: member }) || assemble(resolved(desc), member);
  }
  /* the Fitting Friend (CH-D10): lilac clay, shape 1 / height 0, in one piece (its file's display(): a
     garment, an accessory, a dye as shoulder waves in that colour); no skin tone, no name */
  function friendComp(desc, o) {
    var member = normHex(o.color), B = body(), W = wearM(), A = accM(), id = typeof desc.wear === 'string' ? desc.wear : null;
    var vr = {}, cw = num(desc.vr && desc.vr[id], 0);
    if (id) vr[id] = cw;
    var c1 = id ? viaRig({ fitting: true, piece: id, vr: vr, member: member }) : null;   /* no piece: the bare Friend */
    if (c1) return c1;
    var mo = { cw: cw, member: member };
    var isWear = !!(W && typeof W.has === 'function' && W.has(id)), isAcc = !!(A && ((A.PIECES && own(A.PIECES, id)) || (Array.isArray(A.DYE_IDS) && A.DYE_IDS.indexOf(id) >= 0)));
    var r = id ? (isWear ? call(W, 'display', [id, mo]) : isAcc ? call(A, 'display', [id, mo]) : null) : null;
    var list = r ? boneLists(r) : B.fittingFriend({}), joints = jointsFrom(r, {}), res = resolved({ look: {}, wear: {}, vr: {} });
    return made(res.look, res, list, joints, id === 'wear_free_spark' ? 'spark' : list.wand ? 'item' : null, 'shapes');
  }
  var compMemo = [];
  /* the composition's cache key: the look, wear and colourways as given (cheap, and a live edit of
     the look can never reuse a stale figure; a look code that disagrees with its look is ignored) */
  function codeOf(desc) {
    if (desc === 'friend') desc = { friend: true };
    if (desc.friend) return 'F|' + (desc.wear || '') + '|' + JSON.stringify(desc.vr || {});
    return 'P|' + JSON.stringify(desc.look || {}) + '|' + JSON.stringify(desc.wear || {}) + '|' + JSON.stringify(desc.vr || {});
  }
  /* desc → {boxes, J (joints, u), parent, joints (extra bones), spark, …} or null; memoised per
     (look code, wear code, member colour) for look descriptions (box lists are not memoised) */
  function compose(desc, o) {
    o = o || {};
    var B = body();
    if (!B || desc == null) return null;
    if (isBoxList(desc)) desc = { boxes: desc };
    if (desc.boxes) {
      return { look: B.drawLook(desc.look), show: {}, flags: {}, boxes: desc.boxes, joints: desc.joints || {}, parent: desc.parent || {},
               J: desc.J || B.jointsOf(desc.look), hand: desc.hand || null, key: null, route: 'boxes' };
    }
    if (desc !== 'friend' && (typeof desc !== 'object' || (!desc.friend && !desc.look))) return null;
    var key = codeOf(desc) + '|' + (normHex(o.color) || '');
    for (var i = 0; i < compMemo.length; i++) if (compMemo[i].key === key) return compMemo[i];
    var c = desc === 'friend' || desc.friend ? friendComp(desc === 'friend' ? {} : desc, o) : personComp(desc, o);
    c.key = key;
    compMemo.unshift(c);
    if (compMemo.length > 24) compMemo.length = 24;
    return c;
  }

  /* ---------------- cells: people-shapes-body's raster(), fast and flat ----------------
     Layers by bone + proud + lattice (size and phase per axis); a later box paints over an earlier
     one; erase boxes clear; lod above the tier is skipped. Inner unit cells (all six neighbours in
     the layer) can never show and are dropped. → {x, y, z (voxels), sx, sy, sz, bone, col, proud, layer} */
  var TIER_RANK = { LOW: 0, MID: 1, HIGH: 2 }, LOD_RANK = { mid: 1, high: 2 };
  function cellKey(i, j, k) { return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512); }
  function cellsOf(comp, tier) {
    var memoKey = 'cells|' + tier;
    if (comp[memoKey]) return comp[memoKey];
    var t = TIER_RANK[String(tier || 'HIGH').toUpperCase()], layers = [], byKey = {}, boxes = comp.boxes || {};
    if (t == null) t = 2;
    Object.keys(boxes).forEach(function (b) {
      (boxes[b] || []).forEach(function (bx) {
        if (!bx || (LOD_RANK[bx.lod] || 0) > t) return;
        var lo = [bx.x0, bx.y0, bx.z0], hi = [bx.x1, bx.y1, bx.z1], size = [], phase = [], ok = true;
        for (var a = 0; a < 3; a++) {
          if (!(typeof lo[a] === 'number' && typeof hi[a] === 'number' && hi[a] > lo[a])) { ok = false; break; }
          var s = Math.abs((hi[a] - lo[a]) - Math.round(hi[a] - lo[a])) < 1e-9 ? 1 : 0.25;
          size.push(s); phase.push(Math.round((((lo[a] % s) + s) % s) * 1e6) / 1e6);
        }
        if (!ok) return;
        var bone = bx.b || b, key = bone + '|' + (bx.proud ? 1 : 0) + '|' + size.join(',') + '|' + phase.join(',');
        var L = byKey[key];
        if (!L) { L = byKey[key] = { bone: bone, proud: !!bx.proud, size: size, phase: phase, cells: new Map(), n: layers.length }; layers.push(L); }
        var i0 = Math.round((lo[0] - phase[0]) / size[0]), i1 = Math.round((hi[0] - phase[0]) / size[0]);
        var j0 = Math.round((lo[1] - phase[1]) / size[1]), j1 = Math.round((hi[1] - phase[1]) / size[1]);
        var k0 = Math.round((lo[2] - phase[2]) / size[2]), k1 = Math.round((hi[2] - phase[2]) / size[2]);
        for (var i = i0; i < i1; i++) for (var j = j0; j < j1; j++) for (var k = k0; k < k1; k++) {
          var ck = cellKey(i, j, k);
          if (bx.erase) L.cells.delete(ck);
          else { if (L.cells.has(ck)) L.cells.delete(ck); L.cells.set(ck, bx); }
        }
      });
    });
    var out = [];
    layers.forEach(function (L) {
      var unit = L.size[0] === 1 && L.size[1] === 1 && L.size[2] === 1;
      L.cells.forEach(function (bx, ck) {
        var k = (ck % 1024) - 512, j = (Math.floor(ck / 1024) % 1024) - 512, i = Math.floor(ck / 1048576) - 512;
        if (unit && L.cells.has(cellKey(i + 1, j, k)) && L.cells.has(cellKey(i - 1, j, k)) && L.cells.has(cellKey(i, j + 1, k)) &&
            L.cells.has(cellKey(i, j - 1, k)) && L.cells.has(cellKey(i, j, k + 1)) && L.cells.has(cellKey(i, j, k - 1))) return;
        out.push({ x: L.phase[0] + (i + 0.5) * L.size[0], y: L.phase[1] + (j + 0.5) * L.size[1], z: L.phase[2] + (k + 0.5) * L.size[2],
                   sx: L.size[0], sy: L.size[1], sz: L.size[2], bone: L.bone, c: bx.c, proud: L.proud, detail: !!bx.lod, layer: L.n });
      });
    });
    comp[memoKey] = out;
    return out;
  }

  /* ================================================================
     POSE: the person rig's setPose (px-crew makeAvatar), as plain 3 × 4 matrices
     ================================================================ */
  function eul(x, y, z, order) {
    var a = x * DEG, b = y * DEG, g = z * DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    var X = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Y = [cb, 0, sb, 0, 1, 0, -sb, 0, cb], Z = [cg, -sg, 0, sg, cg, 0, 0, 0, 1];
    var seq = order === 'YXZ' ? [Y, X, Z] : order === 'ZXY' ? [Z, X, Y] : [X, Y, Z];
    return mul3(mul3(seq[0], seq[1]), seq[2]);
  }
  function mul3(A, B) {
    var o = new Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return o;
  }
  /* an affine {R (3 × 3 incl. scale), t} */
  function aff(R, t) { return { R: R, t: t }; }
  function compose2(P, Rl, tl) {        /* P · T(tl) · Rl */
    var R = P.R, t = [0, 1, 2].map(function (r) { return P.t[r] + R[r * 3] * tl[0] + R[r * 3 + 1] * tl[1] + R[r * 3 + 2] * tl[2]; });
    return aff(mul3(R, Rl), t);
  }
  var WAND_TILT = 70;                 /* px-crew AV.tiltDeg: the stick leans forward from the grip */
  function wandTilt() { var X = sib('SLPxCrew', './island3d/px-crew.js'); return X && X.AV && typeof X.AV.tiltDeg === 'number' ? X.AV.tiltDeg : WAND_TILT; }
  /* bone → world affine for the pose; joints J (u) from the body file plus the extra bones */
  function boneMats(comp, p, rootMode) {
    var J = Object.assign({}, comp.J), parent = {}, B = body(), mats = {};
    var PAR = (B && B.PARENT) || { base: null, body: 'base', head: 'body', armL: 'body', armR: 'body', legL: 'base', legR: 'base', wand: 'armR', eyes: 'head' };
    Object.keys(PAR).forEach(function (k) { parent[k] = PAR[k]; });
    Object.keys(comp.joints || {}).forEach(function (k) { if (Array.isArray(comp.joints[k])) J[k] = comp.joints[k]; });
    Object.keys(comp.parent || {}).forEach(function (k) { parent[k] = comp.parent[k]; });
    Object.keys(comp.boxes || {}).forEach(function (k) { if (!own(parent, k)) parent[k] = own(EXTRA_PARENT, k) ? EXTRA_PARENT[k] : 'body'; });
    var keep = rootMode === 'keep', sy = num(p.sy, 1), bodyY = (J.body || [0, 0.4, 0])[1], c = bodyY * sy;
    var Rb = eul(num(p.pitch, 0), num(p.yaw, 0), num(p.roll, 0), 'YXZ');
    var v = [Rb[1] * c, Rb[4] * c, Rb[7] * c];
    var S = [num(p.sx, 1) || 1e-4, 0, 0, 0, sy || 1e-4, 0, 0, 0, num(p.sz, 1) || 1e-4];
    mats.base = aff(mul3(Rb, S), [(keep ? num(p.x, 0) : 0) - v[0], num(p.y, 0) + c - v[1], (keep ? num(p.z, 0) : 0) - v[2]]);
    var LOCAL = {
      body: eul(0, num(p.hips, 0), -num(p.lean, 0), 'YXZ'),
      head: eul(num(p.headPitch, 0), num(p.headYaw, 0), num(p.headRoll, 0), 'YXZ'),
      armL: eul(-num(p.armLf, 0), 0, num(p.armL, 0), 'ZXY'),
      armR: eul(-num(p.armRf, 0), 0, -num(p.armR, 0), 'ZXY'),
      legL: eul(-num(p.legL, 0), 0, 0), legR: eul(-num(p.legR, 0), 0, 0),
      wand: comp.hand === 'spark' ? eul(wandTilt(), 0, num(p.twirl, 0)) : eul(0, 0, 0)
    };
    if (p.hairRoll || p.hairPitch) LOCAL.hairTail = eul(num(p.hairPitch, 0), 0, num(p.hairRoll, 0));
    var I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    function get(b, depth) {
      if (mats[b]) return mats[b];
      var pb = parent[b] && parent[b] !== b && depth < 8 ? parent[b] : 'base';
      var P = get(pb, depth + 1), jb = J[b] || J[pb] || [0, 0, 0], jp = J[pb] || [0, 0, 0];
      return (mats[b] = compose2(P, LOCAL[b] || I, [jb[0] - jp[0], jb[1] - jp[1], jb[2] - jp[2]]));
    }
    Object.keys(parent).concat(Object.keys(comp.boxes || {})).forEach(function (b) { get(b, 0); });
    return { mats: mats, J: J };
  }

  /* ---------------- poses: the clip layer, else the baked FRAMES ---------------- */
  /* the games' named frames: [clip, t, opts]. POSES holds their AV_KEYS values sampled from the clip
     layer (models-characters.js), so a page without the 3D stage (the 2D island, a 2D game) draws
     the same frames; a test keeps them equal to sampleAvatar */
  var FRAMES = {
    stand: ['idle', 0, { reduced: true }], wave: ['wave', 0.5], run1: ['run', 0.075], run2: ['run', 0.2], jump: ['jump', 0.3],
    tuck: ['jumpTuck', 0.3, { reduced: true }], slide: ['slideFlat', 0], tumble: ['tumble', 0.2], finish: ['cheer', 0.2],
    runup: ['walk', 0.25], kick: ['shoot', 0.32], drive: ['drive', 0.3, { reduced: true }], oops: ['oops', 1], shrug: ['shrug', 0.9]
  };
  var POSES = {
    stand: {},
    wave: { headRoll: 6, armL: 8, armR: 122.880982706687, wand: 1 },
    run1: { y: 0.0294235584120969, pitch: 8, roll: 2.94235584120969, armL: 8, armR: 8, armLf: 49.0392640201615, armRf: -49.0392640201615, legL: -44.1353376181454, legR: 44.1353376181454 },
    run2: { y: 0.03, pitch: 8, roll: -3, armL: 8, armR: 8, armLf: -50, armRf: 50, legL: 45, legR: -45 },
    jump: { armL: 150, armR: 150, legL: 20, legR: -12 },
    tuck: { headPitch: 15, armL: -6, armR: -6, armLf: 70, armRf: 70, legL: 80, legR: 80 },
    slide: { y: -0.232, pitch: -86, sz: 0.8, armL: 6, armR: 6, legL: -22, legR: -22 },
    tumble: { y: 0.266666666666667, pitch: -90, legL: 34.6410161513775, legR: 34.6410161513775 },
    finish: { y: 0.0711111111111111, armL: 162.990381056767, armR: 137.009618943233, wand: 1, legL: -8.88888888888889, legR: -8.88888888888889 },
    runup: { y: 0.0125574971739379, pitch: 2, roll: -2.51149943478759, armL: 8, armR: 8, armLf: -20.9291619565632, armRf: 20.9291619565632, legL: 18.8362457609069, legR: -18.8362457609069 },
    kick: { y: 0.0309852813742386, z: 0.0325, pitch: 4.5, headPitch: 13, armL: 57, armR: 30.75, armRf: 12.5, hips: 7.5, legL: 2.5, legR: 50 },
    drive: { armLf: 60, armRf: 60, legL: 60, legR: 60 },
    oops: { headRoll: 8, armL: 10, armR: 25, armRf: 80, faceCam: 1 },
    shrug: { y: 0.01375, headPitch: -2.2, headRoll: 6.6, armL: 28.35, armR: 28.35, armLf: 16.5, armRf: 16.5, faceCam: 0.55, lean: 1.65 }
  };
  var KEYS = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'sx', 'sy', 'sz', 'headPitch', 'headYaw', 'headRoll',
              'armL', 'armR', 'armLf', 'armRf', 'faceCam', 'wand', 'hips', 'lean', 'legL', 'legR', 'twirl'];
  function restPose() { var o = {}; KEYS.forEach(function (k) { o[k] = k === 'sx' || k === 'sy' || k === 'sz' ? 1 : 0; }); return o; }
  /* {pose, name, t} for o.pose / o.t (a FRAMES name, a clip, or a pose object) */
  function poseOf(comp, o) {
    var name = o.pose || 'stand', t = num(o.t, 0), opts = { seed: 0, phase: 0, bodyY: (comp.J.body || [0, 0.4])[1], reduced: !!o.reduced };
    if (name && typeof name === 'object') return { pose: Object.assign(restPose(), name), name: 'custom', t: 0 };
    var fr = own(FRAMES, name) ? FRAMES[name] : null, clip = fr ? fr[0] : name;
    if (fr) { t = fr[1]; if (fr[2]) Object.assign(opts, fr[2]); }
    var CH = clips(), p = null;
    if (CH && typeof CH.sampleAvatar === 'function') { try { p = CH.sampleAvatar(clip, t, {}, opts); } catch (e) { p = null; } }
    if (!p) p = Object.assign(restPose(), fr ? POSES[name] : clip === 'idle' || clip === 'stand' ? {} : null);
    if (!p || typeof p !== 'object') p = restPose();
    return { pose: p, name: name, t: t };
  }

  /* ================================================================
     THE PROJECTOR
     ================================================================ */
  /* view → screen (u right, v down) and depth d (bigger = nearer), in voxels */
  function viewAxes(view, facing) {
    if (view === 'back') return { u: [-1, 0, 0], v: [0, -1, 0], d: [0, 0, -1] };
    if (view === 'side') return facing === 'left' ? { u: [0, 0, -1], v: [0, -1, 0], d: [1, 0, 0] } : { u: [0, 0, 1], v: [0, -1, 0], d: [-1, 0, 0] };
    if (view === 'top') return { u: [-1, 0, 0], v: [0, 0, -1], d: [0, 1, 0] };
    return { u: [1, 0, 0], v: [0, -1, 0], d: [0, 0, 1] };
  }
  function dot3(a, x, y, z) { return a[0] * x + a[1] * y + a[2] * z; }
  /* the Spark Stick as px-crew draws it (wandParts): a 5-voxel Midnight Ink handle from one voxel
     under the grip, then the 4-point ✦ on half voxels (reach 4), Cloud White at its heart and the
     member colour round it; on the wand bone, which tilts it forward like the rig */
  function sparkBoxes(J) {
    var w = J.wand || [-0.225, 0.325, 0.05], x = w[0] / GC, y = w[1] / GC - 1, z = w[2] / GC, R = 4, i, j;
    var star = { token: 'Bubblegum', state: { key: 'member', off: 'Bubblegum', on: 'Bubblegum' } };
    var bxs = [{ b: 'wand', c: 'Midnight Ink', x0: x - 0.5, x1: x + 0.5, y0: y, y1: y + 5, z0: z - 0.5, z1: z + 0.5, tag: 'handle' }];
    for (j = -R; j <= R; j++) for (i = -R; i <= R; i++) {
      var d = Math.abs(i) + Math.abs(j);
      if (d > 2 && i !== 0 && j !== 0) continue;
      bxs.push({ b: 'wand', c: d <= 1 ? 'Cloud White' : star, x0: x + (i - 0.5) / 2, x1: x + (i + 0.5) / 2, y0: y + 5 + (R + j - 0.5) / 2 + 0.25, y1: y + 5 + (R + j + 0.5) / 2 + 0.25,
                 z0: z - 0.5, z1: z + 0.5, mode: 'glow', tag: 'star' });
    }
    return { wand: bxs };
  }

  function project(comp, o) {
    var px = Math.max(1, Math.min(8, Math.round(num(o.px, 2)))), view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'front';
    var ax = viewAxes(view, o.facing), P = poseOf(comp, o), rootMode = o.root === 'keep' ? 'keep' : 'ground';
    var bm = boneMats(comp, P.pose, rootMode), mats = bm.mats;
    var cells = cellsOf(comp, o.tier || 'HIGH'), only = Array.isArray(o.bones) ? o.bones : null;
    var showWand = comp.hand === 'spark' && (o.wand === true || (o.wand !== false && num(P.pose.wand, 0) >= 0.5));
    if (showWand) {
      var sc = comp['spark|cells'] || (comp['spark|cells'] = cellsOf({ boxes: comp.stick || sparkBoxes(comp.J) }, 'HIGH'));
      cells = cells.concat(sc.map(function (c) { return Object.assign({}, c, { layer: c.layer + 1000 }); }));
    }
    /* per bone: the screen-space rotation rows and the generators of a cell of each size */
    var boneRows = {};
    function rowsOf(b) {
      if (boneRows[b]) return boneRows[b];
      var M = mats[b] || mats.base, R = M.R, J = bm.J[b] || [0, 0, 0];
      function proj(axis) { return [axis[0] * R[0] + axis[1] * R[3] + axis[2] * R[6], axis[0] * R[1] + axis[1] * R[4] + axis[2] * R[7], axis[0] * R[2] + axis[1] * R[5] + axis[2] * R[8]]; }
      var ru = proj(ax.u), rv = proj(ax.v), rd = proj(ax.d), t = M.t;
      /* screen = A · (item − J) + T, all in voxels */
      var Tu = dot3(ax.u, t[0], t[1], t[2]) / GC, Tv = dot3(ax.v, t[0], t[1], t[2]) / GC, Td = dot3(ax.d, t[0], t[1], t[2]) / GC;
      return (boneRows[b] = { ru: ru, rv: rv, rd: rd, Tu: Tu - dot3(ru, J[0], J[1], J[2]) / GC, Tv: Tv - dot3(rv, J[0], J[1], J[2]) / GC, Td: Td - dot3(rd, J[0], J[1], J[2]) / GC, gen: {} });
    }
    var pts = [], boneIds = {}, minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (var n = 0; n < cells.length; n++) {
      var c = cells[n];
      if (only && only.indexOf(c.bone) < 0) continue;
      var Rw = rowsOf(c.bone), u = dot3(Rw.ru, c.x, c.y, c.z) + Rw.Tu, v = dot3(Rw.rv, c.x, c.y, c.z) + Rw.Tv, d = dot3(Rw.rd, c.x, c.y, c.z) + Rw.Td;
      var gk = c.sx + ',' + c.sy + ',' + c.sz, g = Rw.gen[gk];
      if (!g) {
        var gs = [[c.sx, 0, 0], [0, c.sy, 0], [0, 0, c.sz]].map(function (e) { return [dot3(Rw.ru, e[0], e[1], e[2]) * px / 2, dot3(Rw.rv, e[0], e[1], e[2]) * px / 2]; });
        var cons = [];
        gs.forEach(function (gi) {
          var nx = -gi[1], ny = gi[0], len = Math.sqrt(nx * nx + ny * ny);
          if (len < 1e-6) return;
          var h = 0; gs.forEach(function (gj) { h += Math.abs(nx * gj[0] + ny * gj[1]); });
          cons.push([nx, ny, h * (1 + 1e-9) + 1e-9]);
        });
        g = Rw.gen[gk] = { ex: gs.reduce(function (s, q) { return s + Math.abs(q[0]); }, 0), ey: gs.reduce(function (s, q) { return s + Math.abs(q[1]); }, 0), cons: cons };
      }
      var dd = d + (c.proud ? PROUD_BIAS : 0) + c.layer * LAYER_BIAS;
      if (!own(boneIds, c.bone)) boneIds[c.bone] = Object.keys(boneIds).length;
      pts.push({ u: u * px, v: v * px, d: dd, g: g, c: c.c, tag: boneIds[c.bone] * 2 + (c.proud || c.detail ? 1 : 0) });
      if (u * px - g.ex < minU) minU = u * px - g.ex;
      if (u * px + g.ex > maxU) maxU = u * px + g.ex;
      if (v * px - g.ey < minV) minV = v * px - g.ey;
      if (v * px + g.ey > maxV) maxV = v * px + g.ey;
    }
    if (!pts.length) return null;
    /* the pixel lattice: pixel centres on voxel centres at odd px, on half voxels at even px */
    var s0 = px % 2 ? 0.5 : 0;
    var c0 = Math.floor(minU + s0) - 1, c1 = Math.ceil(maxU + s0) + 1, r0 = Math.floor(minV) - 1, r1 = Math.ceil(maxV) + 1;
    if (rootMode === 'keep' || view === 'top') { r0 = Math.min(r0, -1); r1 = Math.max(r1, 1); }
    c0 = Math.min(c0, -1); c1 = Math.max(c1, 1);                                          /* the root column stays in the grid */
    var W = c1 - c0 + 1, Hh = r1 - r0 + 1, depth = new Float64Array(W * Hh), col = new Int32Array(W * Hh), tags = new Int32Array(W * Hh), pal = [], palIx = {};
    depth.fill(-Infinity); col.fill(-1);
    var colorHex = normHex(o.color);
    pts.forEach(function (q) {
      var hex = tokenHex(q.c, colorHex), ci = own(palIx, hex) ? palIx[hex] : (palIx[hex] = pal.push(hex) - 1), hit = false;
      var ca = Math.ceil(q.u - q.g.ex + s0 - 0.5), cb = Math.floor(q.u + q.g.ex + s0 - 0.5), ra = Math.ceil(q.v - q.g.ey - 0.5), rb = Math.floor(q.v + q.g.ey - 0.5);
      for (var r = ra; r <= rb; r++) for (var cc = ca; cc <= cb; cc++) {
        var du = cc + 0.5 - s0 - q.u, dv = r + 0.5 - q.v, inside = true;
        for (var k = 0; k < q.g.cons.length; k++) { var cn = q.g.cons[k]; if (Math.abs(cn[0] * du + cn[1] * dv) > cn[2]) { inside = false; break; } }
        if (!inside) continue;
        hit = true; put(cc, r);
      }
      if (!hit) put(Math.floor(q.u + s0), Math.floor(q.v));                          /* a thin sheet still shows */
      function put(x, y) {
        var i = (y - r0) * W + (x - c0);
        if (x < c0 || x > c1 || y < r0 || y > r1) return;
        if (q.d > depth[i]) { depth[i] = q.d; col[i] = ci; tags[i] = q.tag; }
      }
    });
    return { px: px, view: view, W: W, H: Hh, c0: c0, r0: r0, s0: s0, depth: depth, col: col, tags: tags, pal: pal, rootMode: rootMode, pose: P };
  }

  /* the projector's pixels → the sprite: crease shading, the outline, the crop, the rows */
  function finish(G, o) {
    var W = G.W, H = G.H, depth = G.depth, col = G.col, pal = G.pal.slice(), shadeIx = {}, out = new Int32Array(W * H), x, y, i;
    for (i = 0; i < W * H; i++) out[i] = col[i];
    /* a neighbour a voxel or more nearer shades a pixel, unless it is a proud or 'mid' detail of the
       same bone (curl lobes, an ear, the glasses' temples: bumps, not edges) */
    var tags = G.tags;
    function casts(i, j) { return col[j] >= 0 && depth[j] >= depth[i] + CREASE && !((tags[j] & 1) && (tags[j] >> 1) === (tags[i] >> 1)); }
    if (o.crease !== false) {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        i = y * W + x;
        if (col[i] < 0) continue;
        if ((x > 0 && casts(i, i - 1)) || (x < W - 1 && casts(i, i + 1)) || (y > 0 && casts(i, i - W)) || (y < H - 1 && casts(i, i + W))) {
          var ci = col[i];
          if (!own(shadeIx, ci)) {
            var sh = shadeHex(G.pal[ci]), at = pal.indexOf(sh);
            shadeIx[ci] = at >= 0 ? at : pal.push(sh) - 1;
          }
          out[i] = shadeIx[ci];
        }
      }
    }
    /* the outline: every empty pixel touching the figure (4-neighbours) */
    var low = -1, OUT = -2;
    for (i = 0; i < W * H; i++) if (col[i] >= 0) low = Math.floor(i / W);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x;
      if (col[i] >= 0) continue;
      if ((x > 0 && col[i - 1] >= 0) || (x < W - 1 && col[i + 1] >= 0) || (y > 0 && col[i - W] >= 0) || (y < H - 1 && col[i + W] >= 0)) out[i] = OUT;
    }
    /* crop to the drawn pixels; 'keep' keeps the ground row (absolute row 0) in the box */
    var x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (out[y * W + x] !== -1) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var groundRow = G.view === 'top' ? null : G.rootMode === 'ground' ? low + 1 : -G.r0;   /* the row under the soles */
    if (groundRow != null) { y1 = Math.max(y1, groundRow); y0 = Math.min(y0, groundRow); }
    else { y0 = Math.min(y0, -G.r0 - 1); y1 = Math.max(y1, -G.r0); }                    /* from above: the root's rows */
    var rootCol = -G.c0;                                                                 /* the foot point stays in the box */
    x0 = Math.min(x0, rootCol - (G.s0 ? 0 : 1)); x1 = Math.max(x1, rootCol);
    /* the chars: by first use in reading order, the outline 'o' */
    var used = {}, order = [], rows = [];
    for (y = y0; y <= y1; y++) {
      var row = '';
      for (x = x0; x <= x1; x++) {
        var v = out[y * W + x];
        if (v === -1) { row += '.'; continue; }
        if (v === OUT) { row += OUTLINE.ch; continue; }
        if (!own(used, v)) { used[v] = order.length < CHARS.length ? CHARS.charAt(order.length) : CHARS.charAt(CHARS.length - 1); order.push(v); }
        row += used[v];
      }
      rows.push(row);
    }
    var p2 = {}; p2[OUTLINE.ch] = OUTLINE.hex;
    order.forEach(function (v) { p2[used[v]] = pal[v]; });
    var alpha = {}; alpha[OUTLINE.ch] = OUTLINE.alpha;
    /* column c spans [c − s0, c + 1 − s0) pixel units from the root, row r spans [r, r + 1) */
    var footX = G.s0 - (G.c0 + x0), footY = G.view === 'top' ? -(G.r0 + y0) : groundRow - y0;
    return { rows: rows, pal: p2, alpha: alpha, w: x1 - x0 + 1, h: y1 - y0 + 1, px: G.px, view: G.view, foot: { x: footX, y: footY }, pose: G.pose.name };
  }

  /* ---------------- the cache (memory only) ---------------- */
  var spriteMemo = new Map();
  function memo(key, make) {
    if (spriteMemo.has(key)) { var v = spriteMemo.get(key); spriteMemo.delete(key); spriteMemo.set(key, v); return v; }
    var made = make();
    spriteMemo.set(key, made);
    if (spriteMemo.size > CACHE_MAX) spriteMemo.delete(spriteMemo.keys().next().value);
    return made;
  }
  function clear() { spriteMemo.clear(); compMemo.length = 0; hexMemo = {}; }
  function optKey(o) {
    return [o.view || 'front', typeof o.pose === 'object' ? JSON.stringify(o.pose) : o.pose || 'stand', num(o.t, 0), num(o.px, 2), o.root || '', o.facing || '',
            o.wand === true ? 1 : o.wand === false ? 0 : '', normHex(o.color) || '', (o.bones || []).join('+'), o.tier || '', o.reduced ? 1 : 0, o.crease === false ? 0 : 1].join('|');
  }

  /* sprite(desc, o) → {rows, pal, alpha, w, h, px, view, foot, pose} | null (never throws) */
  function sprite(desc, o) {
    o = o || {};
    try {
      var comp = compose(desc, o);
      if (!comp) return null;
      var make = function () { var G = project(comp, o); return G ? finish(G, o) : null; };
      return comp.key ? memo(comp.key + '#' + optKey(o), make) : make();
    } catch (e) { return null; }
  }

  /* ---------------- SVG ---------------- */
  function pixLocal(rows, pal, unit, ox, oy) {
    var d = {}, order = [];
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length;) {
        var ch = row.charAt(x), xs = x;
        while (x < row.length && row.charAt(x) === ch) x++;
        if (!own(pal, ch)) continue;
        if (!own(d, pal[ch])) { d[pal[ch]] = ''; order.push(pal[ch]); }
        d[pal[ch]] += 'M' + n1(ox + xs * unit) + ' ' + n1(oy + y * unit) + 'h' + n1((x - xs) * unit) + 'v' + n1(unit) + 'h' + n1(-(x - xs) * unit) + 'z';
      }
    });
    return order.map(function (c) { return '<path fill="' + c + '" d="' + d[c] + '"/>'; }).join('');
  }
  function pix(rows, pal, unit, ox, oy) {
    var A = art();
    return A && typeof A.pix === 'function' ? A.pix(rows, pal, unit, ox, oy) : pixLocal(rows, pal, unit, ox, oy);
  }
  /* the sprite's paths at (x, y) with `unit` per pixel: the outline layer under a 0.7 opacity group */
  /* one ART.pix pass: a translucent colour gets a stand-in name, then its path its fill-opacity */
  function paths(sp, unit, x, y) {
    var pal = {}, alias = {};
    Object.keys(sp.pal).forEach(function (ch) {
      if (own(sp.alpha, ch)) { pal[ch] = 'alpha-' + ch; alias['alpha-' + ch] = '"' + sp.pal[ch] + '" fill-opacity="' + sp.alpha[ch] + '"'; } else pal[ch] = sp.pal[ch];
    });
    return pix(sp.rows, pal, unit, x, y).replace(/"(alpha-.)"/g, function (m, k) { return alias[k] || m; });
  }
  /* svg(sprite, o) → '<svg …>' (o {unit, w, h, x, y: where the foot lands, shadow, cls, label}) */
  function svg(sp, o) {
    if (!sp || !sp.rows || !sp.rows.length) return '';
    o = o || {};
    var unit = num(o.unit, 4), w = num(o.w, sp.w * unit), h = num(o.h, sp.h * unit);
    var fx = num(o.x, w / 2), fy = num(o.y, h - unit), ox = fx - sp.foot.x * unit, oy = fy - sp.foot.y * unit;
    if (o.x == null && o.w == null) ox = 0;
    if (o.y == null && o.h == null) oy = 0;
    var shadow = o.shadow ? '<ellipse cx="' + n1(fx) + '" cy="' + n1(fy) + '" rx="' + n1(o.shadow) + '" ry="' + n1(o.shadow * 0.25) + '" fill="rgba(40,30,60,.18)"/>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(w) + ' ' + n1(h) + '"' + (o.cls ? ' class="' + o.cls + '"' : '') +
      ' shape-rendering="crispEdges"' + (o.label ? ' role="img" aria-label="' + String(o.label).replace(/[&<>"]/g, '') + '"' : ' aria-hidden="true" focusable="false"') + '>' +
      shadow + paths(sp, unit, ox, oy) + '</svg>';
  }
  /* a square picture: the sprite at the standard scale (`span` pixels across the inner square: every
     look of a kind is drawn the same size), smaller only when big hair or a hat would not fit;
     centred, its bottom on the margin ('bottom') or its middle in the middle */
  function square(sp, size, margin, span, align) {
    if (!sp) return '';
    var inner = size - 2 * margin, unit = Math.min(inner / span, inner / Math.max(sp.w, sp.h));
    var ox = (size - sp.w * unit) / 2, oy = align === 'middle' ? (size - sp.h * unit) / 2 : size - margin - sp.h * unit;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + paths(sp, unit, ox, oy) + '</svg>';
  }

  /* ================================================================
     USES
     ================================================================ */
  var FIGURE = { w: 70, h: 110, footY: 104, unit: 2.2, maxH: 100, maxW: 66 };
  var SPAN = { bust: 30, head: 26, top: 34, bottom: 24, shoes: 20, figure: 50 };   /* the standard sizes (pixels at px 2) of each picture */
  /* the 2D island's figure (the .slw-me box): '' when info is null (the classic avatar draws) */
  function figure(info, o) {
    o = o || {};
    var sp = info ? sprite(info, { view: 'front', pose: o.pose || 'stand', t: o.t, color: o.color, px: 2 }) : null;
    if (!sp) return '';
    var unit = Math.min(FIGURE.unit, FIGURE.maxH / sp.h, FIGURE.maxW / sp.w);
    /* the feet in the middle, unless a held piece would leave the box: then the figure (and its shadow) slides in */
    var x = Math.max(2 + sp.foot.x * unit, Math.min(FIGURE.w - 2 - (sp.w - sp.foot.x) * unit, FIGURE.w / 2));
    return svg(sp, { w: FIGURE.w, h: FIGURE.h, x: x, y: FIGURE.footY, unit: unit, shadow: 20 });
  }
  /* a window of a standing sprite: the rows between two heights (voxels above the ground; null = no
     limit), then the empty columns trimmed; the foot moves with the crop */
  function windowOf(sp, lo, hi) {
    if (!sp) return null;
    var r0 = hi == null ? 0 : Math.max(0, Math.ceil(sp.foot.y - hi * sp.px)), r1 = lo == null ? sp.h - 1 : Math.min(sp.h - 1, Math.floor(sp.foot.y - lo * sp.px) - 1);
    var rows = sp.rows.slice(r0, r1 + 1), c0 = Infinity, c1 = -1;
    rows.forEach(function (row) { var m = /[^.]/.exec(row), n = row.search(/[^.]\.*$/); if (m) { c0 = Math.min(c0, m.index); c1 = Math.max(c1, n); } });
    if (c1 < 0) return null;
    return { rows: rows.map(function (row) { return row.slice(c0, c1 + 1); }), pal: sp.pal, alpha: sp.alpha, w: c1 - c0 + 1, h: rows.length, px: sp.px, view: sp.view,
             foot: { x: sp.foot.x - c0, y: sp.foot.y - r0 }, pose: sp.pose };
  }
  /* the heights (voxels) each picture keeps: a bust from the upper chest up; a top from the hips up;
     a bottom up to the waist; shoes up to the thighs (the Fitting Friend's body: shape 1, height 0) */
  function cutOf(kind, look) {
    var B = body(), D = B ? B.bodyOf(look ? look.bd : 1, look ? look.ht : 0) : null, T = D ? D.torso : { y0: 5, y1: 11 };
    return kind === 'bust' ? [T.y1 - 3, null] : kind === 'top' ? [T.y0 - 1, null] : kind === 'bottom' ? [null, T.y1 - 2] : kind === 'shoes' ? [null, T.y0] : [null, null];
  }
  function portrait(info, o) {
    o = o || {};
    var c = info ? compose(info, o) : null;
    if (!c) return '';
    var w = cutOf('bust', c.look);
    return square(windowOf(sprite(info, { view: 'front', pose: 'stand', px: 2, color: o.color }), w[0], w[1]), num(o.size, 64), num(o.margin, 3), SPAN.bust);
  }
  function headIcon(look, o) {
    o = o || {};
    var sp = sprite({ look: look, wear: {}, vr: {} }, { view: o.view || 'front', pose: 'stand', px: 2, bones: ['head', 'eyes', 'hairTail'] });
    return square(sp, num(o.size, 48), num(o.margin, 2), SPAN.head, 'middle');
  }
  var CROP = { head: 'bust', face: 'bust', neck: 'bust', dye: 'bust', top: 'top', hand: 'top', bottom: 'bottom', shoes: 'shoes' };
  /* a dye's picture before the accessories file draws its own: the Fitting Friend with shoulder waves
     in that colour (no skin tone, CH-D10) */
  function dyeDesc(it) {
    var B = body(), H = hairM(), lk = { bd: 1, ht: 0, hs: 12, hc: it.hc, cv: 0 };
    if (!B || !H || typeof H.hair !== 'function') return null;
    var list = B.merge(B.fittingFriend({}), H.hair(lk));
    return { boxes: list, look: { bd: 1, ht: 0 }, joints: list.joints || {} };
  }
  /* a shop card picture: a character's head and shoulders, or the Fitting Friend in one piece (a back
     piece from behind; head, face and neck pieces and dyes as a bust; a top from the hips up; a
     bottom and shoes from the waist and the thighs down) */
  function icon(id, o) {
    o = o || {};
    var P = core();
    if (typeof id !== 'string' || !P) return '';
    if (/^char_/.test(id)) {
      var d = typeof P.display === 'function' ? P.display(id) : null;
      return d ? portrait(d, { size: num(o.size, 100), margin: 6, color: o.color }) : '';
    }
    var it = typeof P.item === 'function' ? P.item(id) : null;
    if (!it || it.kind !== 'wear') return '';
    var AC = accM(), ownDye = !!(AC && Array.isArray(AC.DYE_IDS) && AC.DYE_IDS.indexOf(id) >= 0);
    var desc = it.slot === 'dye' && !ownDye ? dyeDesc(it) : { friend: true, wear: id, vr: o.vr || {} };
    if (!desc) return '';
    var crop = CROP[it.slot] || 'all', w = cutOf(crop, null);
    var sp = sprite(desc, { view: it.slot === 'back' ? 'back' : 'front', pose: 'stand', px: 2, color: o.color, wand: id === 'wear_free_spark' ? true : undefined });
    return square(windowOf(sp, w[0], w[1]), num(o.size, 100), 6, crop === 'all' ? SPAN.figure : SPAN[crop]);
  }
  /* the games' frames: the view, the frame names, the frame box and its foot point (frame units) */
  var GAME_SPRITES = {
    run: { view: 'side', w: 96, h: 120, foot: [48, 116], frames: ['run1', 'run2', 'jump', 'slide', 'tumble', 'finish'] },
    shootout: { view: 'back', w: 72, h: 120, foot: [36, 116], frames: ['stand', 'runup', 'kick'] },
    kart: { view: 'top', w: 48, h: 48, foot: [24, 24], frames: ['drive'], bones: ['head', 'eyes', 'hairTail', 'body', 'armL', 'armR'] }
  };
  function gameSprite(info, name, o) {
    o = o || {};
    var g = GAME_SPRITES[o.game] || null;
    if (!g) Object.keys(GAME_SPRITES).forEach(function (k) { if (!g && GAME_SPRITES[k].frames.indexOf(name) >= 0) g = GAME_SPRITES[k]; });
    if (!info || !g) return '';
    var sp = sprite(info, { view: g.view, pose: name, px: 2, color: o.color, bones: g.bones, facing: o.facing });
    if (!sp) return '';
    var unit = Math.min(num(o.unit, 2.5), (g.foot[1] - 2) / Math.max(1, sp.foot.y), (g.w - 4) / sp.w, (g.h - 4) / sp.h);
    var x = Math.max(2 + sp.foot.x * unit, Math.min(g.w - 2 - (sp.w - sp.foot.x) * unit, g.foot[0]));
    return svg(sp, { w: g.w, h: g.h, x: x, y: g.foot[1], unit: unit });
  }
  function gameSprites(info, game, o) {
    var g = GAME_SPRITES[game], out = {};
    if (!g || !info) return out;
    g.frames.forEach(function (f) { var s = gameSprite(info, f, Object.assign({}, o || {}, { game: game })); if (s) out[f] = s; });
    return out;
  }

  return {
    VERSION: VERSION, VIEWS: VIEWS, OUTLINE: OUTLINE, CREASE: CREASE, FRAMES: FRAMES, POSES: POSES, GAME_SPRITES: GAME_SPRITES, FIGURE: FIGURE,
    sprite: sprite, svg: svg, figure: figure, icon: icon, headIcon: headIcon, portrait: portrait, gameSprite: gameSprite, gameSprites: gameSprites,
    compose: compose, cells: function (desc, tier) { var c = compose(desc); return c ? cellsOf(c, tier || 'HIGH') : []; }, poseOf: function (desc, o) { var c = compose(desc); return c ? poseOf(c, o || {}).pose : null; },
    tokenHex: tokenHex, outlineOn: outlineOn, deltaE: deltaE, shadeHex: shadeHex, clear: clear, cacheSize: function () { return spriteMemo.size; }
  };
}));
