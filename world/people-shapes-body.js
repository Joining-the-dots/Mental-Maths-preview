/* ================================================================
   Kids update — SLPeopleShapesBody (KU-CH4): the people's bodies as pure box lists.
   window.SLPeopleShapesBody in the browser (loaded by window.slLoadPeople()), module.exports in
   Node. Pure data: no SLVox, no THREE, no DOM, no random numbers; the same look gives the same
   boxes. px-people.js (KU-CH9) turns the lists into VoxModels and a vox rig; world-art-people.js
   (KU-CH10) projects the same boxes onto a pixel grid; the hair, garment and accessory files
   (KU-CH5, CH7, CH8) build their pieces from the descriptors here (D96 / CH-D9: fit is data).

   THE BOX-LIST FORMAT (CH-D8). A BoxList is {bone: [box, …]} over the person's bones
   (BONES: base body head armL armR legL legR wand eyes, plus the optional bones other files add).
   A box is {b, c, x0, x1, y0, y1, z0, z1, mode?, lod?, proud?, tag?}:
     b        its bone; coordinates are ITEM space at the rest pose, in voxels of GC (0.05 u):
              x to the figure's left (+x = armL), y up from the ground, z forward (the face is +z)
     c        its colour: a token ('PX Skin 5', 'PX Skin 5 Shade', 'Cloud White') or an SLVox
              palette entry ({token, state, …}); never raw hex
     x0 … z1  extents, multiples of 0.25. A whole-number span sits on the unit lattice whose
              phase is x0 mod 1 (odd widths on .5, as px-crew); a span that is not whole is a
              SHEET on the quarter lattice (the eyes are a quarter-voxel plate on the face)
     mode     'glow' (the eye glints) · lod 'mid': a detail painted over a surface; at LOW the box
              is SKIPPED before rasterising, so the colour under it shows (never a hole; never
              hand it to SLVox as a palette lod) · proud: drawn a hair outside its own outline
              (px-crew PROUD) because it lies over another bone's surface · tag: what it is
              ('skin', 'eye', 'glint', 'sclera', 'iris', 'brow', 'mouth', …) for tests and 2D ·
              erase: c null, it CLEARS the cells it covers on its bone and lattice (the head's
              rounded crown corners); a later box may fill them again
   Order matters: boxes on one bone and lattice share cells and a LATER box paints over an earlier
   one. A builder appends after the body: body → face → hair (CH5) → garments (CH7) → accessories
   (CH8), so the hairline paints over the forehead and a fringe never needs the face's help.
   raster(list, {tier}) is the reference rasteriser (layers by bone + lattice, later wins).

   BODIES (CH-D9): 3 shapes × 2 heights. bodyOf(bd, ht) → a frozen descriptor in voxels: torso,
   arm, leg, foot, head, face, ear, back, regions (what garments replace), sockets, plus the rig's
   joints J in u (shape 1 / height 0 = SLPxCrew.AV.J exactly), parent, top and h. Height 1 adds one
   leg row and lifts every joint from the hips up by one voxel.
   FACES: eyes 2 × 2 (tall 2 × 3, almond with a skin-Shade lid) on bone 'eyes' (the blink) as a
   quarter-voxel plate on the face, each with a glow glint top-outer; where ΔL*(iris, skin) < 20
   the outer column under the glint turns PX Eye White (the sclera rule). Smiley eyes are closed
   '^' arcs in the eye colour, else Midnight Ink, else eye white (whichever keeps ΔL* ≥ 20), with
   the glint as a sparkle over the peak; they never blink. Brows in the hair colour's Shade, a
   3-wide smile with raised ends whose colour keeps ΔL* ≥ 20 on every tone, rosy cheeks and 3
   freckles a side as 'mid' details, proud ears and a skin-Shade jaw row.
   THE FITTING FRIEND (CH-D10): a lilac clay mannequin, shape 1, height 0, dot eyes and a smile,
   no hair, no ears, no skin tone; it wears one piece in the catalogue icons.
   PRESETS: 8 fixed starter looks for 'Me' (identity only; 'Try another look' steps through them).
   Colours come from SLPeopleCore.PALETTES when people-core.js is loaded (KU-CH1), else from the
   local copy below (the design's table); ' Shade' partners are ×0.86 on each channel (px-crew).
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPeopleShapesBody = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1, GC = 0.05, CONTRAST = 20, SHADE = 0.86;
  var BONES = ['base', 'body', 'head', 'armL', 'armR', 'legL', 'legR', 'wand', 'eyes'];
  var PARENT = { base: null, body: 'base', head: 'body', armL: 'body', armR: 'body', legL: 'base', legR: 'base', wand: 'armR', eyes: 'head' };
  var TIER_RANK = { LOW: 0, MID: 1, HIGH: 2 }, LOD_RANK = { mid: 1, high: 2 };

  /* ---------------- the look (the fields this file draws; people-core owns the schema) ---------------- */
  var LOOK_DEFAULTS = { sk: 4, ey: 0, ec: 0, hs: 2, hc: 1, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 0, bd: 1, ht: 0 };
  var LOOK_KEYS = Object.keys(LOOK_DEFAULTS);
  var RANGE = { sk: 9, ey: 3, ec: 5, hs: 21, cv: 6, cc: 7, gl: 4, gc: 5, ha: 2, hac: 3, fr: 1, bl: 1, bd: 2, ht: 1 };
  var EYE_SHAPES = ['round', 'tall', 'almond', 'smiley'];

  /* the local copy of the people palettes (characters.json lookSchema.palettes); people-core's
     PALETTES win when loaded. Only the colours a body needs are here. */
  var LOCAL = {
    skin: ['#FCE5D6', '#F6D3BC', '#EDC0A0', '#E0AA84', '#CF956C', '#B97E57', '#9E6744', '#835236', '#683F2A', '#4D2E20'],
    'PX Mouth Deep': '#7A3341', 'PX Mouth Rose': '#E07A86', 'PX Eye White': '#F7F4EE',
    iris: [['PX Eye Dark Brown', '#3A2618'], ['PX Eye Brown', '#6B4226'], ['PX Eye Hazel', '#8A6A2E'],
           ['PX Eye Green', '#4E8A4C'], ['PX Eye Blue', '#3F7BD0'], ['PX Eye Grey', '#7C8A99']],
    hair: [['PX Hair Black', '#1E1B22'], ['PX Hair Dark Brown', '#3B2A22'], ['PX Hair Brown', '#5C3D2B'], ['PX Hair Light Brown', '#8A5E3C'],
           ['PX Hair Auburn', '#7E3A24'], ['PX Hair Ginger', '#C0602E'], ['PX Hair Strawberry', '#D79A6A'], ['PX Hair Blonde', '#E6C27A'],
           ['PX Hair Platinum', '#F1E6C8'], ['PX Hair Grey', '#B9B6B3']],
    hairFun: [['PX Hair Pink', '#FF8FC8'], ['PX Hair Lilac', '#C3A6FF'], ['PX Hair Sky', '#7CC8FF'], ['PX Hair Mint', '#8FE3C4'],
              ['PX Hair Silver', '#DCE3EE'], ['PX Hair Sunset', '#FF9E6B']],
    'PX Clay Lilac': '#C9B8F0', 'PX Cover White': '#F4F1EC', 'PX Cover Navy': '#2E3A6B'
  };
  /* world-look tokens a body uses as they are (no Shade needed: details, not surfaces) */
  var LOOK_HEX = { 'Cloud White': '#FFFFFF', 'Ink': '#3B2F4A', 'Blush': '#FF9DB8', 'Midnight Ink': '#14101F' };
  var GLINT = 'Cloud White', SCLERA = 'PX Eye White', CLAY = 'PX Clay Lilac', CLAY_INK = 'Ink', BLUSH = 'Blush', LASH = 'Midnight Ink';
  /* the plain layer a person shows where no garment is worn (a white tee, navy leggings, white
     socks): people tokens, so each has its Shade; the garments chunk may hand its own fills */
  var BASE_FILL = { torso: 'PX Cover White', upper: 'PX Cover White', thigh: 'PX Cover Navy', shin: 'PX Cover Navy', foot: 'PX Cover White' };

  /* ---------------- small helpers ---------------- */
  function int(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { freeze(o[k]); }); }
    return o;
  }
  /* a sibling module: the page's global (it may arrive later), else one require() in Node whose
     result, found or not, is remembered (a missing file is never looked up again) */
  var required = {};
  function sib(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!own(required, name)) { try { required[name] = require(path) || null; } catch (e) { required[name] = null; } }
    return required[name];
  }
  function core() { return sib('SLPeopleCore', './people-core.js'); }

  /* ---------------- colour: hex, Shade partners, CIE L* ---------------- */
  function normHex(h) { var m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? '#' + m[1].toUpperCase() : null; }
  /* a colour's Shade partner: ×0.86 lightness (CH-D19, two-tone shading), each channel scaled as
     px-crew's shadeOf does, so a pale skin darkens to a natural shadow, never to orange */
  function shadeHex(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * SHADE).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  function lstar(hex) {
    var n = parseInt(hex.slice(1), 16);
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var Y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return 116 * (Y > 216 / 24389 ? Math.cbrt(Y) : (24389 / 27 * Y + 16) / 116) - 16;
  }
  function deltaL(a, b) { var ha = hexOf(a), hb = hexOf(b); return ha && hb ? Math.abs(lstar(ha) - lstar(hb)) : 0; }

  /* name → hex from people-core's PALETTES (any shape of [name, hex] / {token|name, hex}), cached per object */
  var palCache = { src: null, map: null };
  function coreHexes() {
    var P = core(), src = P && P.PALETTES;
    if (!src || typeof src !== 'object') return null;
    if (palCache.src === src) return palCache.map;
    var map = {};
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 5) return;
      if (Array.isArray(o) && typeof o[0] === 'string' && o.length >= 2) {
        var hx = null;
        for (var i = 1; i < o.length; i++) if (normHex(o[i])) { hx = normHex(o[i]); break; }
        if (hx && /^PX /.test(o[0])) { map[o[0]] = hx; return; }
      }
      if (!Array.isArray(o)) {
        var nm = typeof o.token === 'string' ? o.token : typeof o.name === 'string' ? o.name : null;
        if (nm && /^PX /.test(nm) && normHex(o.hex)) map[nm] = normHex(o.hex);
      }
      Object.keys(o).forEach(function (k) {
        if (/^PX /.test(k) && normHex(o[k])) map[k] = normHex(o[k]);
        else walk(o[k], depth + 1);
      });
    }(src, 0));
    palCache.src = src; palCache.map = map;
    return map;
  }
  var LOCAL_HEX = (function () {
    var m = {};
    LOCAL.skin.forEach(function (h, i) { m['PX Skin ' + (i + 1)] = h; });
    ['iris', 'hair', 'hairFun'].forEach(function (k) { LOCAL[k].forEach(function (e) { m[e[0]] = e[1]; }); });
    Object.keys(LOCAL).forEach(function (k) { if (/^PX /.test(k)) m[k] = LOCAL[k]; });
    return m;
  }());
  /* '#RRGGBB' for a people token (and its ' Shade'), a body world-look token, or null */
  function hexOf(token) {
    if (token && typeof token === 'object') token = token.token;
    if (typeof token !== 'string') return null;
    var map = coreHexes();
    if (map && map[token]) return map[token];
    if (LOCAL_HEX[token]) return LOCAL_HEX[token];
    if (LOOK_HEX[token]) return LOOK_HEX[token];
    var m = / Shade$/.exec(token), base = m ? token.slice(0, -6) : null, bh = base && (map && map[base] || LOCAL_HEX[base]);
    if (bh) return shadeHex(bh);
    var L = sib('SLIslandLook', './world-look.js');
    return L && typeof L.resolve === 'function' ? normHex(L.resolve(token)) : null;
  }
  function shadeOf(token) { return token + ' Shade'; }

  /* ---------------- the draw-ready look ---------------- */
  /* every field this file draws as an int in range, else its default (CH-D6: never throws) */
  function drawLook(look) {
    var P = core(), src = look && typeof look === 'object' ? look : {}, out = {};
    if (P && typeof P.validateLook === 'function') { try { var v = P.validateLook(src); if (v && typeof v === 'object') src = v; } catch (e) { /* the local rules */ } }
    LOOK_KEYS.forEach(function (k) {
      var v = src[k];
      out[k] = int(v) && v >= 0 && (v <= RANGE[k] || (k === 'hc' && ((v >= 0 && v <= 9) || (v >= 20 && v <= 25)))) ? v : LOOK_DEFAULTS[k];
    });
    if (out.hc > 9 && out.hc < 20) out.hc = LOOK_DEFAULTS.hc;
    return out;
  }
  function skinToken(sk) { return 'PX Skin ' + ((int(sk) && sk >= 0 && sk <= 9 ? sk : LOOK_DEFAULTS.sk) + 1); }
  function irisToken(ec) { return LOCAL.iris[int(ec) && ec >= 0 && ec <= 5 ? ec : 0][0]; }
  function hairToken(hc) {
    if (int(hc) && hc >= 20 && hc <= 25) return LOCAL.hairFun[hc - 20][0];
    return LOCAL.hair[int(hc) && hc >= 0 && hc <= 9 ? hc : LOOK_DEFAULTS.hc][0];
  }
  /* the mouth: Deep on tones 0-5, Rose on 6-9 (the design), then whichever candidate keeps ΔL* ≥ 20 */
  function mouthToken(sk) {
    var skin = skinToken(sk), first = sk <= 5 ? 'PX Mouth Deep' : 'PX Mouth Rose', cands = [first, sk <= 5 ? 'PX Mouth Rose' : 'PX Mouth Deep', 'PX Mouth Deep Shade', 'PX Mouth Rose Shade'];
    for (var i = 0; i < cands.length; i++) if (deltaL(cands[i], skin) >= CONTRAST) return cands[i];
    return cands.reduce(function (a, b) { return deltaL(b, skin) > deltaL(a, skin) ? b : a; });
  }
  /* closed eyes ('^' arcs): the eye colour where it shows (ΔL* ≥ 20), else Midnight Ink, else eye white */
  function lashToken(ec, sk) {
    var skin = skinToken(sk), cands = [irisToken(ec), LASH, SCLERA];
    for (var i = 0; i < cands.length; i++) if (deltaL(cands[i], skin) >= CONTRAST) return cands[i];
    return SCLERA;
  }
  /* rosy cheeks: a soft pink on light tones, else a rose that is never the mouth's own colour (the
     cheeks sit on the smile's row, so a shared colour would read as one wide mouth) */
  function cheekToken(sk) {
    if (sk <= 3) return BLUSH;
    return mouthToken(sk) === 'PX Mouth Rose' ? 'PX Mouth Deep' : 'PX Mouth Rose';
  }

  /* ---------------- boxes ---------------- */
  function box(b, c, x0, x1, y0, y1, z0, z1, o) {
    var bx = { b: b, c: c, x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1 };
    if (o) Object.keys(o).forEach(function (k) { if (o[k] != null && o[k] !== false) bx[k] = o[k]; });
    return bx;
  }
  function add(list, bx) { (list[bx.b] = list[bx.b] || []).push(bx); return list; }
  function merge() {
    var out = {};
    for (var a = 0; a < arguments.length; a++) {
      var l = arguments[a];
      if (l && typeof l === 'object') Object.keys(l).forEach(function (b) { (l[b] || []).forEach(function (bx) { add(out, bx); }); });
    }
    return out;
  }
  function allBoxes(list) { var o = []; Object.keys(list || {}).forEach(function (b) { o = o.concat(list[b] || []); }); return o; }
  function tokenOfBox(bx) { return typeof bx.c === 'string' ? bx.c : bx.c && typeof bx.c.token === 'string' ? bx.c.token : null; }
  function tokensOf(list) { var s = {}; allBoxes(list).forEach(function (bx) { var t = tokenOfBox(bx); if (t) s[t] = 1; }); return Object.keys(s); }
  var Q = 4;                                  /* quarter voxels: every extent is a multiple of 1 / Q */
  function q(v) { return Math.round(v * Q); }
  /* the format's rules → a list of problems ([] = good) */
  function check(list, o) {
    o = o || {};
    var issues = [], known = o.bones || null;
    if (!list || typeof list !== 'object') return ['not a box list'];
    Object.keys(list).forEach(function (b) {
      if (!Array.isArray(list[b])) { issues.push(b + ': not an array'); return; }
      if (known && known.indexOf(b) < 0) issues.push(b + ': unknown bone');
      list[b].forEach(function (bx, n) {
        var tag = b + '[' + n + ']' + (bx && bx.tag ? ' ' + bx.tag : '');
        if (!bx || bx.b !== b) { issues.push(tag + ': on the wrong bone'); return; }
        ['x', 'y', 'z'].forEach(function (a) {
          var v0 = bx[a + '0'], v1 = bx[a + '1'];
          if (typeof v0 !== 'number' || typeof v1 !== 'number' || !isFinite(v0) || !isFinite(v1)) issues.push(tag + ': ' + a + ' is not a number');
          else if (!(v1 > v0)) issues.push(tag + ': ' + a + ' is empty');
          else if (Math.abs(v0 * Q - q(v0)) > 1e-9 || Math.abs(v1 * Q - q(v1)) > 1e-9) issues.push(tag + ': ' + a + ' is off the quarter grid');
        });
        var t = tokenOfBox(bx);
        if (bx.erase) { if (bx.c != null) issues.push(tag + ': an erase box has a colour'); }
        else if (!t) issues.push(tag + ': no colour token');
        else if (/^#/.test(t)) issues.push(tag + ': raw hex');
        if (bx.mode != null && bx.mode !== 'glow') issues.push(tag + ': mode ' + bx.mode);
        if (bx.lod != null && !LOD_RANK[bx.lod]) issues.push(tag + ': lod ' + bx.lod);
      });
    });
    return issues;
  }
  /* the reference rasteriser: layers by bone + lattice (+ proud), later boxes paint over earlier
     ones; boxes above the tier's lod are skipped first. → [{bone, proud, size [sx, sy, sz] voxels,
     phase [px, py, pz], cells: {'i,j,k': box}}]; cell i spans [phase + i·size, phase + (i + 1)·size] */
  function raster(list, o) {
    var tier = TIER_RANK[String((o && o.tier) || 'HIGH').toUpperCase()], layers = [], byKey = {};
    if (tier == null) tier = 2;
    Object.keys(list || {}).forEach(function (b) {
      (list[b] || []).forEach(function (bx) {
        if ((LOD_RANK[bx.lod] || 0) > tier) return;
        var size = [], phase = [], lo = [bx.x0, bx.y0, bx.z0], hi = [bx.x1, bx.y1, bx.z1];
        for (var a = 0; a < 3; a++) {
          var s = Math.abs((hi[a] - lo[a]) - Math.round(hi[a] - lo[a])) < 1e-9 ? 1 : 1 / Q;
          size.push(s); phase.push(r6(((lo[a] % s) + s) % s));
        }
        var key = b + '|' + (bx.proud ? 1 : 0) + '|' + size.join(',') + '|' + phase.join(',');
        var L = byKey[key];
        if (!L) { L = byKey[key] = { bone: b, proud: !!bx.proud, size: size, phase: phase, cells: {} }; layers.push(L); }
        var i0 = Math.round((lo[0] - phase[0]) / size[0]), i1 = Math.round((hi[0] - phase[0]) / size[0]);
        var j0 = Math.round((lo[1] - phase[1]) / size[1]), j1 = Math.round((hi[1] - phase[1]) / size[1]);
        var k0 = Math.round((lo[2] - phase[2]) / size[2]), k1 = Math.round((hi[2] - phase[2]) / size[2]);
        for (var i = i0; i < i1; i++) for (var j = j0; j < j1; j++) for (var k = k0; k < k1; k++) {
          if (bx.erase) delete L.cells[i + ',' + j + ',' + k];
          else L.cells[i + ',' + j + ',' + k] = bx;
        }
      });
    });
    return layers;
  }
  /* the centre of every unit cell (voxels, item space) → its box: the person as points */
  function points(list, o) {
    var out = [];
    raster(list, o).forEach(function (L) {
      if (o && o.bones && o.bones.indexOf(L.bone) < 0) return;
      Object.keys(L.cells).forEach(function (key) {
        var c = key.split(',').map(Number), p = [0, 1, 2].map(function (a) { return L.phase[a] + (c[a] + 0.5) * L.size[a]; });
        out.push({ p: p, box: L.cells[key], bone: L.bone });
      });
    });
    return out;
  }
  /* the silhouette in a view ('front' x × y, 'side' z × y, 'top' x × z) as unit-cell keys */
  function silhouette(list, view, o) {
    var s = {};
    points(list, o).forEach(function (pt) {
      var p = pt.p, u = view === 'side' ? p[2] : p[0], v = view === 'top' ? p[2] : p[1];
      s[Math.floor(u) + ',' + Math.floor(v)] = 1;
    });
    return s;
  }

  /* K9's eye rule as a helper for every piece's tests: the boxes that hide an eye cell → [{eye,
     by}] ([] = every eye shows). An eye cell is a box on bone 'eyes' or tagged 'eye'; it is hidden
     by any other box whose x-y footprint holds its centre and that reaches in front of it, or by a
     later box on its own bone over its centre (a paint-over). o {tier} drops lod details first. */
  function eyesCovered(list, o) {
    var all = allBoxes(o && o.tier ? lodFilter(list, o.tier) : list), out = [];
    all.forEach(function (e, n) {
      if (e.b !== 'eyes' && e.tag !== 'eye') return;
      var cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2, cz = (e.z0 + e.z1) / 2;
      all.forEach(function (b, m) {
        if (b === e || b.b === 'eyes' || b.tag === 'eye' || !(b.x0 < cx && cx < b.x1 && b.y0 < cy && cy < b.y1)) return;
        var later = b.b === e.b && m > n && b.z0 < cz && cz < b.z1;
        if (b.z1 > e.z1 + 1e-9 || later) out.push({ eye: e, by: b });
      });
    });
    return out;
  }

  /* ================================================================
     BODIES (CH-D9)
     ================================================================ */
  var SHAPES = [
    { tw: 6, td: 4, ax: 4, lw: 2, lx: 1.5 },            /* slim: torso 6 × 4, arms ±0.2 u */
    { tw: 7, td: 5, ax: 4.5, lw: 2, lx: 1.5 },          /* the avatar: torso 7 × 5, arms ±0.225 u */
    { tw: 8, td: 5, ax: 5, lw: 3, lx: 2 }               /* sturdy: torso 8 × 5, arms ±0.25 u, legs 3 wide */
  ];
  var ARM = { w: 2, d: 3, len: 5 }, LEG_D = 3, HEAD = { w: 9, h: 9, d: 9, flat: 7 };
  function ext(x0, x1, y0, y1, z0, z1, bone) { var e = { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1 }; if (bone) e.bone = bone; return e; }
  function buildBody(bd, ht) {
    var S = SHAPES[bd], dy = ht, tx = S.tw / 2, tz = S.td / 2;
    var T0 = 5 + dy, T1 = 11 + dy, hb = 11 + dy, A0 = 6 + dy, A1 = 11 + dy, L1 = 6 + dy;
    var ax0 = S.ax - ARM.w / 2, ax1 = S.ax + ARM.w / 2, lx0 = S.lx - S.lw / 2, lx1 = S.lx + S.lw / 2;
    var nk = S.tw % 2 ? 1.5 : 1;                                     /* the neck patch: 3 wide on odd torsos, 2 on even */
    var regions = {
      torso: ext(-tx, tx, T0, T1, -tz, tz, 'body'),
      neck: ext(-nk, nk, T1 - 1, T1, tz - 1, tz, 'body')
    };
    [['L', 1], ['R', -1]].forEach(function (e) {
      var s = e[1], X = function (a, b) { return s > 0 ? [a, b] : [-b, -a]; }, xa = X(ax0, ax1), xl = X(lx0, lx1), xf = X(lx0, lx1 + 1);
      regions['upper' + e[0]] = ext(xa[0], xa[1], A1 - 2, A1, -ARM.d / 2, ARM.d / 2, 'arm' + e[0]);
      regions['fore' + e[0]] = ext(xa[0], xa[1], A0 + 1, A1 - 2, -ARM.d / 2, ARM.d / 2, 'arm' + e[0]);
      regions['hand' + e[0]] = ext(xa[0], xa[1], A0, A0 + 1, -ARM.d / 2, ARM.d / 2, 'arm' + e[0]);
      regions['thigh' + e[0]] = ext(xl[0], xl[1], 4, L1, -LEG_D / 2, LEG_D / 2, 'leg' + e[0]);
      regions['shin' + e[0]] = ext(xl[0], xl[1], 2, 4, -LEG_D / 2, LEG_D / 2, 'leg' + e[0]);
      regions['foot' + e[0]] = ext(xf[0], xf[1], 0, 2, -LEG_D / 2, LEG_D / 2 + 1, 'leg' + e[0]);   /* the sole's toe one voxel out front */
    });
    var eyeY = hb + 3, J = {
      base: [0, 0, 0], body: [0, r6((8 + dy) * GC), 0], head: [0, r6(hb * GC), 0],
      armL: [r6(S.ax * GC), r6((A1 - 0.5) * GC), 0], armR: [r6(-S.ax * GC), r6((A1 - 0.5) * GC), 0],
      legL: [r6(S.lx * GC), r6((L1 - 0.5) * GC), 0], legR: [r6(-S.lx * GC), r6((L1 - 0.5) * GC), 0],
      wand: [r6(-S.ax * GC), r6((A0 + 0.5) * GC), r6(GC)], eyes: [0, r6((eyeY + 1) * GC), r6(HEAD.d / 2 * GC)]
    };
    return {
      bd: bd, ht: ht, key: bd + ',' + ht, h: r6((hb + HEAD.h) * GC), top: [0, r6((hb + HEAD.h + 1.2) * GC), 0],
      torso: { w: S.tw, d: S.td, y0: T0, y1: T1, x0: -tx, x1: tx, z0: -tz, z1: tz, hem: T0 },
      arm: { x: S.ax, len: ARM.len, w: ARM.w, d: ARM.d, y0: A0, y1: A1, x0: ax0, x1: ax1, hand: A0, cuff: A0 + 1, elbow: A1 - 2 },
      leg: { w: S.lw, d: LEG_D, len: L1 - 2, x: S.lx, x0: lx0, x1: lx1, y0: 2, y1: L1, knee: 4 },
      foot: { w: S.lw + 1, y0: 0, y1: 2, sole: 0, toe: LEG_D / 2 + 1 },
      head: { c: [0, hb + HEAD.h / 2, 0], w: HEAD.w, h: HEAD.h, d: HEAD.d, flat: HEAD.flat, x0: -4.5, x1: 4.5, y0: hb, y1: hb + HEAD.h, z0: -4.5, z1: 4.5,
              crown: { y: hb + HEAD.h, w: HEAD.flat, d: HEAD.flat } },
      face: { z: HEAD.d / 2, x0: -3.5, x1: 3.5, y0: hb + 1, y1: hb + 8, eyeY: eyeY, eyeRows: 2, eyeX: [1.5, 3.5], browY: hb + 6, mouthY: hb + 1, cheekY: hb + 2, foreheadY: hb + 7 },
      ear: { x: [4.5, 5.5], y0: hb + 3, y1: hb + 5, z0: -0.5, z1: 0.5 },
      back: { z: -tz, y0: T0, y1: T1 },
      regions: regions,
      sockets: {
        hand: { bone: 'armR', at: [-S.ax, A0 + 0.5, 1] }, handL: { bone: 'armL', at: [S.ax, A0 + 0.5, 1] },
        head: { bone: 'head', at: [0, hb + HEAD.h, 0], w: HEAD.flat, d: HEAD.flat },
        face: { bone: 'head', at: [0, eyeY + 1, HEAD.d / 2], w: HEAD.flat },
        neck: { bone: 'body', at: [0, T1 - 0.5, 0], w: S.tw, d: S.td },
        back: { bone: 'body', at: [0, (T0 + T1) / 2, -tz], w: S.tw, h: T1 - T0 }
      },
      J: J, parent: PARENT
    };
  }
  var BODIES = {};
  for (var bd0 = 0; bd0 < 3; bd0++) for (var ht0 = 0; ht0 < 2; ht0++) BODIES[bd0 + ',' + ht0] = freeze(buildBody(bd0, ht0));
  function bodyOf(bd, ht) {
    if (bd && typeof bd === 'object') { ht = bd.ht; bd = bd.bd; }
    bd = int(bd) && bd >= 0 && bd <= 2 ? bd : LOOK_DEFAULTS.bd;
    ht = int(ht) && ht >= 0 && ht <= 1 ? ht : LOOK_DEFAULTS.ht;
    return BODIES[bd + ',' + ht];
  }
  /* the eyes as cells on the face: shape, rows, the blink (closed arcs never blink) and the joint */
  function eyeInfo(look, D) {
    var lk = drawLook(look); D = D || bodyOf(lk.bd, lk.ht);
    var shape = EYE_SHAPES[lk.ey], y0 = D.face.eyeY, rows = shape === 'tall' ? 3 : 2;
    return { shape: shape, y0: y0, y1: y0 + rows, blink: shape !== 'smiley', joint: [0, r6((y0 + rows / 2) * GC), r6(D.face.z * GC)] };
  }
  /* the rig's joints in u for a look (the eyes joint follows the eye shape) */
  function jointsOf(look) {
    var lk = drawLook(look), D = bodyOf(lk.bd, lk.ht), J = {};
    Object.keys(D.J).forEach(function (b) { J[b] = D.J[b].slice(); });
    J.eyes = eyeInfo(lk, D).joint;
    return J;
  }

  /* ================================================================
     HEAD AND FACE
     ================================================================ */
  /* the rounded head: three boxes 9×7×7, 7×9×7 and 7×7×9 whose union drops every edge (never a
     block-man), the jaw row in the Shade, and the ears (none on the Fitting Friend) */
  function headBoxes(D, fill, o) {
    o = o || {};
    var H = D.head, l = {}, sh = shadeOf(fill);
    add(l, box('head', fill, H.x0, H.x1, H.y0 + 1, H.y1 - 1, H.z0 + 1, H.z1 - 1, { tag: 'skin' }));
    add(l, box('head', fill, H.x0 + 1, H.x1 - 1, H.y0, H.y1, H.z0 + 1, H.z1 - 1, { tag: 'skin' }));
    add(l, box('head', fill, H.x0 + 1, H.x1 - 1, H.y0 + 1, H.y1 - 1, H.z0, H.z1, { tag: 'skin' }));
    add(l, box('head', sh, H.x0 + 1, H.x1 - 1, H.y0, H.y0 + 1, H.z0 + 1, H.z1 - 1, { tag: 'jaw' }));
    /* a bare crown (no hair, no covering: the bald look and the Fitting Friend) drops its four
       corners, so the top reads round from every side; hair paints over these cells anyway */
    if (o.round) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var x = c[0] > 0 ? H.x1 - 2 : H.x0 + 1, z = c[1] > 0 ? H.z1 - 2 : H.z0 + 1;
      add(l, box('head', null, x, x + 1, H.y1 - 1, H.y1, z, z + 1, { tag: 'cut', erase: true }));
    });
    /* the ears: one proud block a side (its own layer, so it costs 12 triangles and leaves the
       head's corner AO alone) */
    if (!o.noEars) [1, -1].forEach(function (s) {
      var E = D.ear;
      add(l, box('head', fill, s > 0 ? E.x[0] : -E.x[1], s > 0 ? E.x[1] : -E.x[0], E.y0, E.y1, E.z0, E.z1, { tag: 'ear', proud: true }));
    });
    return l;
  }
  /* one face cell (column c, row y) painted on the head's front layer */
  function paint(l, D, c, x, y, tag, o) {
    var F = D.face;
    return add(l, box('head', c, x - 0.5, x + 0.5, y, y + 1, F.z - 1, F.z, Object.assign({ tag: tag }, o || {})));
  }
  /* one eye cell on bone 'eyes': a quarter-voxel plate on the face plane */
  var PLATE = 0.25;
  function eyeCell(l, D, c, x, y, tag, mode) {
    var F = D.face;
    return add(l, box('eyes', c, x - 0.5, x + 0.5, y, y + 1, F.z, F.z + PLATE, { tag: tag, mode: mode }));
  }
  /* the eye's cells for one side (s = 1 the figure's left, +x): [[x, y, role]] with roles glint ·
     iris · sclera (only where the sclera rule asks) */
  function eyeCells(shape, s, y0, sclera) {
    var o = 3 * s, n = 2 * s, cells;
    if (shape === 'smiley') {
      /* a closed '^' (feet on the eye row, its peak above) and the glint as a sparkle over the peak */
      cells = [[o, y0, 'lash'], [n, y0 + 1, 'lash'], [s, y0, 'lash'], [n, y0 + 2, 'glint']];
    } else {
      var rows = shape === 'tall' ? 3 : 2, top = y0 + rows - 1;
      cells = [[o, top, 'glint']];
      for (var y = y0; y <= top; y++) {
        cells.push([n, y, 'iris']);
        if (y < top) cells.push([o, y, sclera ? 'sclera' : 'iris']);
      }
    }
    return cells;
  }
  /* the face: eyes (glints, the sclera rule), brows, the smile, rosy cheeks and freckles */
  function faceBoxes(look, D, o) {
    o = o || {};
    var lk = drawLook(look); D = D || bodyOf(lk.bd, lk.ht);
    var F = D.face, l = {}, skin = skinToken(lk.sk), iris = irisToken(lk.ec), info = eyeInfo(lk, D);
    var sclera = deltaL(iris, skin) < CONTRAST, brow = shadeOf(hairToken(lk.hc)), mouth = mouthToken(lk.sk), lash = lashToken(lk.ec, lk.sk);
    [1, -1].forEach(function (s) {
      eyeCells(info.shape, s, info.y0, sclera).forEach(function (c) {
        var col = c[2] === 'glint' ? GLINT : c[2] === 'sclera' ? SCLERA : c[2] === 'lash' ? lash : iris;
        eyeCell(l, D, col, c[0], c[1], c[2], c[2] === 'glint' ? 'glow' : null);
      });
      if (info.shape === 'almond') for (var x = 2; x <= 3; x++) paint(l, D, shadeOf(skin), x * s, F.eyeY + 2, 'lid');
      for (var bx = 2; bx <= 3; bx++) paint(l, D, brow, bx * s, F.browY, 'brow');
      if (lk.fr) [[2, F.cheekY], [3, F.cheekY - 1], [4, F.cheekY + 1]].forEach(function (c) {
        if (c[0] === 4) add(l, box('head', shadeOf(skin), s > 0 ? 3.5 : -4.5, s > 0 ? 4.5 : -3.5, c[1], c[1] + 1, F.z - 2, F.z - 1, { tag: 'freckle', lod: 'mid' }));
        else paint(l, D, shadeOf(skin), c[0] * s, c[1], 'freckle', { lod: 'mid' });
      });
      if (lk.bl) paint(l, D, cheekToken(lk.sk), 3 * s, F.cheekY, 'cheek', { lod: 'mid' });
    });
    smile(l, D, mouth, 'mouth');
    return l;
  }
  /* the smile: 3 wide, its middle on the mouth row and its ends raised one row */
  function smile(l, D, c, tag) {
    var F = D.face;
    paint(l, D, c, 0, F.mouthY, tag);
    paint(l, D, c, -1, F.mouthY + 1, tag); paint(l, D, c, 1, F.mouthY + 1, tag);
    return l;
  }

  /* ================================================================
     THE BODY UNDER THE GARMENTS (regions) AND THE WHOLE FIGURE
     ================================================================ */
  var REGIONS = ['torso', 'neck', 'upperL', 'upperR', 'foreL', 'foreR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
  /* region groups a garment replaces (garments are the body: no skin under a shell) */
  var COVERS = {
    top: ['torso', 'upperL', 'upperR'], sleeves: ['foreL', 'foreR'], collar: ['neck'], hands: ['handL', 'handR'],
    shorts: ['thighL', 'thighR'], legs: ['shinL', 'shinR'], shoes: ['footL', 'footR']
  };
  function coverSet(cover) {
    var s = {};
    (Array.isArray(cover) ? cover : typeof cover === 'string' ? [cover] : []).forEach(function (c) {
      (COVERS[c] || [c]).forEach(function (r) { s[r] = 1; });
    });
    return s;
  }
  /* the regions not covered, each in its fill (fills {torso, upper, fore, hand, neck, thigh, shin,
     foot} → tokens), with the Shade on the hem, the sleeve's cuff, the ankle and the sole edge */
  function bareBoxes(D, fills, o) {
    o = o || {};
    var cov = coverSet(o.cover), R = D.regions, l = {}, T = D.torso;
    function f(k) { return fills[k] || fills.torso; }
    if (!cov.torso) {
      var c = f('torso');
      add(l, box('body', c, T.x0 + 1, T.x1 - 1, T.y0, T.y1, T.z0, T.z1, { tag: 'torso' }));       /* the corner columns off */
      add(l, box('body', c, T.x0, T.x1, T.y0, T.y1, T.z0 + 1, T.z1 - 1, { tag: 'torso' }));
      add(l, box('body', shadeOf(c), T.x0 + 1, T.x1 - 1, T.y0, T.y0 + 1, T.z0, T.z1, { tag: 'hem' }));
      add(l, box('body', shadeOf(c), T.x0, T.x1, T.y0, T.y0 + 1, T.z0 + 1, T.z1 - 1, { tag: 'hem' }));
    }
    if (!cov.neck && fills.neck) { var N = R.neck; add(l, box('body', fills.neck, N.x0, N.x1, N.y0, N.y1, N.z0, N.z1, { tag: 'neck' })); }
    var NEXT = { upper: 'fore', fore: 'hand', thigh: 'shin', shin: 'foot' };
    ['L', 'R'].forEach(function (s) {
      ['upper', 'fore', 'hand', 'thigh', 'shin', 'foot'].forEach(function (part) {
        var r = R[part + s], c = f(part);
        if (cov[part + s]) return;
        if (part === 'foot') {
          add(l, box(r.bone, shadeOf(c), r.x0, r.x1, 0, 1, r.z0, r.z1, { tag: 'sole' }));
          add(l, box(r.bone, c, r.x0, r.x1, 1, 2, r.z0, r.z1 - 1, { tag: 'foot' }));
          return;
        }
        add(l, box(r.bone, c, r.x0, r.x1, r.y0, r.y1, r.z0, r.z1, { tag: part }));
        /* the cuff: the lowest row of a sleeve or a trouser leg that ends here, in its Shade */
        var nx = NEXT[part];
        if (nx && (cov[nx + s] || f(nx) !== c)) add(l, box(r.bone, shadeOf(c), r.x0, r.x1, r.y0, r.y0 + 1, r.z0, r.z1, { tag: 'cuff' }));
      });
    });
    return l;
  }
  /* the whole figure for a look: head, face and the body regions not in o.cover, in skin (head,
     neck, forearms, hands) and the plain layer (o.fills or BASE_FILL). o {cover, fills, tier} */
  function person(look, o) {
    o = o || {};
    var lk = drawLook(look), D = bodyOf(lk.bd, lk.ht), skin = skinToken(lk.sk), base = o.fills || BASE_FILL;
    var fills = { torso: base.torso, upper: base.upper || base.torso, fore: base.fore || skin, hand: base.hand || skin, neck: skin,
                  thigh: base.thigh, shin: base.shin || base.thigh, foot: base.foot };
    var out = merge(bareBoxes(D, fills, { cover: o.cover }), headBoxes(D, skin, { round: lk.hs === 0 && lk.cv === 0 }), faceBoxes(lk, D));
    return o.tier ? lodFilter(out, o.tier) : out;
  }
  /* the Fitting Friend (CH-D10): lilac clay, shape 1, height 0, two dot eyes and a smile in Ink,
     no hair, no ears, no blink. o {cover: regions its one piece builds itself, tier} */
  function fittingFriend(o) {
    o = o || {};
    var D = bodyOf(1, 0), F = D.face, l = {};
    var fills = { torso: CLAY, upper: CLAY, fore: CLAY, hand: CLAY, neck: null, thigh: CLAY, shin: CLAY, foot: CLAY };
    var body = bareBoxes(D, fills, { cover: o.cover });
    /* the toy's joints: a Shade ring at the wrists and the knees */
    ['L', 'R'].forEach(function (s) {
      var h = D.regions['hand' + s], k = D.regions['shin' + s], cov = coverSet(o.cover);
      if (!cov['fore' + s]) add(body, box(h.bone, shadeOf(CLAY), h.x0, h.x1, h.y1, h.y1 + 1, h.z0, h.z1, { tag: 'joint' }));
      if (!cov['shin' + s]) add(body, box(k.bone, shadeOf(CLAY), k.x0, k.x1, k.y1 - 1, k.y1, k.z0, k.z1, { tag: 'joint' }));
    });
    [2, -2].forEach(function (x) { paint(l, D, CLAY_INK, x, F.eyeY + 1, 'eye'); });
    smile(l, D, CLAY_INK, 'mouth');
    var out = merge(body, headBoxes(D, CLAY, { noEars: true, round: true }), l);
    return o.tier ? lodFilter(out, o.tier) : out;
  }
  /* the list without the boxes a tier drops (lod above it) */
  function lodFilter(list, tier) {
    var t = TIER_RANK[String(tier).toUpperCase()], out = {};
    if (t == null) t = 2;
    Object.keys(list).forEach(function (b) { list[b].forEach(function (bx) { if ((LOD_RANK[bx.lod] || 0) <= t) add(out, bx); }); });
    return out;
  }

  /* ================================================================
     PRESETS: 8 fixed starter looks for 'Me' (identity only), spread over tones, textures,
     shapes and heights; 'Try another look' steps through them in order
     ================================================================ */
  var PRESETS = freeze([
    { sk: 1, ey: 0, ec: 4, hs: 3, hc: 7, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 1, bl: 1, bd: 1, ht: 0 },
    { sk: 7, ey: 0, ec: 0, hs: 7, hc: 0, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 0, bd: 2, ht: 1 },
    { sk: 4, ey: 2, ec: 1, hs: 10, hc: 1, cv: 0, cc: 0, gl: 1, gc: 0, ha: 0, hac: 0, fr: 0, bl: 0, bd: 0, ht: 0 },
    { sk: 9, ey: 1, ec: 0, hs: 9, hc: 0, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 1, bd: 1, ht: 0 },
    { sk: 2, ey: 0, ec: 3, hs: 6, hc: 5, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 1, bl: 0, bd: 0, ht: 1 },
    { sk: 5, ey: 2, ec: 1, hs: 15, hc: 2, cv: 0, cc: 0, gl: 0, gc: 0, ha: 1, hac: 0, fr: 0, bl: 0, bd: 1, ht: 1 },
    { sk: 6, ey: 0, ec: 2, hs: 5, hc: 3, cv: 0, cc: 0, gl: 2, gc: 3, ha: 0, hac: 0, fr: 0, bl: 0, bd: 2, ht: 0 },
    { sk: 8, ey: 3, ec: 0, hs: 17, hc: 0, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 1, bd: 0, ht: 0 }
  ]);
  /* the free basics every preset wears (cast.me.wear) */
  var PRESET_WEAR = freeze({ top: 'wear_free_hoodie', bottom: 'wear_free_jeans', shoes: 'wear_free_sneakers', hand: 'wear_free_spark' });
  function preset(n) { var i = int(n) ? ((n % PRESETS.length) + PRESETS.length) % PRESETS.length : 0; return Object.assign({}, PRESETS[i]); }

  return {
    VERSION: VERSION, GC: GC, CONTRAST: CONTRAST, SHADE: SHADE, PLATE: PLATE, BONES: BONES, PARENT: PARENT,
    LOOK_DEFAULTS: LOOK_DEFAULTS, LOOK_KEYS: LOOK_KEYS, EYE_SHAPES: EYE_SHAPES, LOCAL: LOCAL, BASE_FILL: BASE_FILL,
    GLINT: GLINT, SCLERA: SCLERA, CLAY: CLAY, CLAY_INK: CLAY_INK, SHAPES: SHAPES, BODIES: BODIES, REGIONS: REGIONS, COVERS: COVERS,
    PRESETS: PRESETS, PRESET_WEAR: PRESET_WEAR,
    bodyOf: bodyOf, eyeInfo: eyeInfo, jointsOf: jointsOf, drawLook: drawLook,
    skinToken: skinToken, irisToken: irisToken, hairToken: hairToken, mouthToken: mouthToken, cheekToken: cheekToken,
    shadeOf: shadeOf, hexOf: hexOf, shadeHex: shadeHex, lstar: lstar, deltaL: deltaL,
    box: box, add: add, merge: merge, boxes: allBoxes, tokensOf: tokensOf, check: check, raster: raster, points: points,
    silhouette: silhouette, lodFilter: lodFilter, coverSet: coverSet, eyesCovered: eyesCovered, lashToken: lashToken,
    headBoxes: headBoxes, faceBoxes: faceBoxes, bareBoxes: bareBoxes, person: person, fittingFriend: fittingFriend, preset: preset
  };
}));
