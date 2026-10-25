/* ================================================================
   My Island v3, kids update — SLPeopleShapesAcc (KU-CH8): the people's accessories as pure box
   lists. 50 wearable pieces in five slots (head 17, face 4, neck 7, back 11, hand 11: the Spark
   Stick, 29 general pieces, 11 land pieces and 9 signature pieces), the colours of the 6 hair dyes,
   and the fit of every piece over the 6 bodies, the 22 hairstyles and the 6 head coverings
   (characters.json wardrobe, voxelLook; CH-D9 / D96: fit is data). window.SLPeopleShapesAcc in the
   browser (slLoadPeople() loads it after the body, hair and wear files), module.exports in Node.
   Pure data: no DOM, no THREE, no SLVox, no random numbers; the same look, piece and colourway
   always give the same boxes.

   BOX LISTS: KU-CH4's format (people-shapes-body.js), {bone: [box …]} with box = {b, c, x0 … z1, tag,
   mode?, lod?, proud?} in item space at rest, voxels of GC. Where each slot draws:
     head  hats are voxels on the head lattice (bone 'head': x and z on .5, y on whole rows) in
           their OWN proud layer, meshed like the glasses: painted into the head's layer, the
           corner AO split the hair's faces round them (measured: 2-3 × the triangles). A
           pulled-on hat wraps the head from its cut row up (the forehead row H + 7: brows, eyes
           and smile always show) over the larger of the +1 hair line and the hair's own top
           (crownOf().outer), its corner columns off; the hair at and above the cut is dropped
           through omit(), the head and every covering cell up there lie inside it (so nothing
           pokes through), and a kippah (crown flags.kippah) goes under it. Those head and
           covering cells can never show, so the hat also CLEARS them from the head's own layer
           (erase boxes, tag 'hidden', KU-CH4's format): their faces were drawn inside the hat
           for nothing (88-94 triangles a hat on the cast; the lead's LOW-cap trim). Perched pieces
           (headbands, ears, crowns, headphones) are measured from the voxels and never enter
           them: a band arches over the hair at a depth no bun or puff stands at, cups sit outside
           the hair at the ears, a ring goes round the top row. Fine parts (a feather, the goggles,
           the boom, the visor) are plain proud boxes.
     face  proud plates a quarter deep on the face plane, never more than a voxel past it.
           coversEyes pieces (shades, star shades, goggles) cover the eye box and hide the identity
           glasses (people-core resolve()); nothing else here touches an eye cell.
     neck  proud boxes on 'body' on the collar rows and the chest, never wider than the torso (the
           arms hang there).
     back  proud boxes on 'body' behind the back plane. A piece that rises above the shoulders
           stands behind the head; one that meets a hair curtain hangs outside it (crownOf().back)
           on straps. Capes hang on the cloth bones cape0 → cape1 → cape2 (built only for a cape).
     hand  on 'wand' (the right hand, KU-CH4's sockets.hand), the left pom-pom on 'armL'
           (sockets.handL). Held pieces stay beside the arm (x within it) or in front of it, below
           the shoulder, so a hanging arm never swallows one; balloon and kite fly above the head.
           The Spark Stick is px-crew's ✦ stick, box for box, in the member colour (a state
           colour: the runtime hex rides the entry's map), shown at Showtime by the rig.

   LOW TIER (the lead's LOW-cap fix, KU-L4a; PEOPLE_CAPS LOW 1,000 / MID 1,300 per person, the
   folded Spark Stick counted, trimmed in data, never at runtime): what a piece hides is cleared
   from the figure (a pulled-on hat's head voxels, 88-94 triangles; the hood worn down under a
   cape's collar, 36), and these are 'mid', so LOW skips them: the headset's band and cup disc (LOW
   draws an earpiece mic: cup, boom, glowing mic; 110 triangles), backpack chest straps and pocket,
   the whistle's mouthpiece, the lantern's base plate. The slot caps below are measured as KU-CH5
   measured its proud pieces, without corner AO; px-people meshes them with the head's or body's
   corner AO, which costs a proud piece 1.2-2 × that (the worst child-chosen people: LOW 1,940, MID
   2,092 against the caps; James decides).

   API
     SLOTS · CAPS (characters.json budgets, triangles: head 140, face 60, neck 60, back 140, hand 90,
     handL 60) · IDS (the 50 pieces) · DYE_IDS · PIECES[id] {id, slot, cw, flags, bones} · BONES
     (the optional bones and their parents) · COLOURS · TOKENS {token: '#RRGGBB'} (every 'PX Acc …'
     token with its ' Shade' partner, × 0.86 a channel as KU-CH4) · hexOf(token) · DYES
     · colourway(id, n) → [token …] the piece's own colours (0 … cw − 1; anything else draws 0)
     · build(id, look, {cw, member, tier}) → box list for ONE piece on a look (a list with no boxes
       for an unknown id), with hidden fields: omit(i, j, k) (hair voxels to drop: pass it to
       SLPeopleShapesHair.headPieces), coversEyes, earsHidden (both ears are inside the piece:
       build the head without them), hideKippah (build the head pieces with cv 0), spark, joints
       {bone: [x, y, z] u} and parents {bone: parent} for the optional bones it adds
     · dress(look, show, vr, o) → every shown accessory of resolve().show (other slots are
       KU-CH7's) merged, the same hidden fields combined; an empty hand gets the Spark Stick
       (flags spark: the rig folds it until Showtime, as today)
     · display(id, o) → the Fitting Friend wearing one piece (catalogue icons); a dye shows the
       Friend with shoulder waves in its colour (the sunset tips too)
     · cut(id, look) → the row a pulled-on hat starts at, or null; fitOf(id, look) → the measured
       fit {crown, cut, kz, ear, back} the builders used (the lab and the tests read it)
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPeopleShapesAcc = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1, GC = 0.05, SHADE = 0.86;
  var SLOTS = ['head', 'face', 'neck', 'back', 'hand'];
  var CAPS = { head: 140, face: 60, neck: 60, back: 140, hand: 90, handL: 60 };
  /* the tested bounds where a piece may pass its slot's cap: a coversEyes piece replaces the identity
     glasses it hides (KU-CH5's tested bound 150), so two four-point star lenses may take 80; the Spark
     Stick is px-crew's stick box for box (96, as today) */
  var BUDGET = { coversEyes: 80, spark: 96 };
  var BONES = { cape0: 'body', cape1: 'cape0', cape2: 'cape1', visor: 'head', antenna: 'body' };

  /* siblings: the page's globals (slLoadPeople loads body and hair first), else require() in Node */
  var required = {};
  function sib(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!Object.prototype.hasOwnProperty.call(required, name)) { try { required[name] = require(path) || null; } catch (e) { required[name] = null; } }
    return required[name];
  }
  function need(name, path) { var m = sib(name, path); if (!m) throw new Error('SLPeopleShapesAcc: ' + name + ' is not loaded'); return m; }
  function Bd() { return need('SLPeopleShapesBody', './people-shapes-body.js'); }
  function Hr() { return need('SLPeopleShapesHair', './people-shapes-hair.js'); }

  /* ---------------- colours: original, bright, each with its Shade ---------------- */
  var COLOURS = {
    Red: '#E8484F', Coral: '#FF7B5E', Orange: '#FF9A3C', Sunny: '#FFD043', Lime: '#A6DC4E', Mint: '#8FE3B8', Green: '#3DAF5C',
    Leaf: '#64B84A', Moss: '#3F7F3C', Teal: '#22A898', Sky: '#5CB9F2', Blue: '#3F6FE0', Navy: '#2E3A75', Lilac: '#B58DF0',
    Purple: '#7B52D6', Pink: '#FF80B8', Rose: '#E4578C', Cream: '#FFF0CF', White: '#F4F6FA', Silver: '#C7D0DE', Grey: '#8E97AA',
    Charcoal: '#3A3D50', Brown: '#8A5A3B', Choc: '#5E3A28', Tan: '#D6A46A', Khaki: '#B8A26A', Gold: '#F0BE45', Wood: '#A4703F',
    Lens: '#2A2E48', Glass: '#7FD6E8'
  };
  /* glow parts (a lit lantern, the stargazer's ✦, the stage pieces): steady, never blinking */
  var GLOWS = { 'PX Acc Glow': '#FFE08A', 'PX Acc Glow Pink': '#FF9AD5', 'PX Acc Glow Cyan': '#8FF3FF' };
  function shadeHex(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * SHADE).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  function tk(name) { return 'PX Acc ' + name; }
  var TOKENS = {};
  Object.keys(COLOURS).forEach(function (n) { TOKENS[tk(n)] = COLOURS[n]; TOKENS[tk(n) + ' Shade'] = shadeHex(COLOURS[n]); });
  Object.keys(GLOWS).forEach(function (n) { TOKENS[n] = GLOWS[n]; });
  function hexOf(token) {
    if (token && typeof token === 'object') token = token.token;
    if (typeof token !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(TOKENS, token)) return TOKENS[token];
    var B = sib('SLPeopleShapesBody', './people-shapes-body.js');
    return B && typeof B.hexOf === 'function' ? B.hexOf(token) : null;
  }
  var GLINT = 'Cloud White';

  /* the six dyes (people-core PALETTES.hairFun; the hex lives there, this is the draw table) */
  var DYES = [['wear_dye_pink', 20, 'PX Hair Pink'], ['wear_dye_lilac', 21, 'PX Hair Lilac'], ['wear_dye_sky', 22, 'PX Hair Sky'],
              ['wear_dye_mint', 23, 'PX Hair Mint'], ['wear_dye_silver', 24, 'PX Hair Silver'], ['wear_dye_sunset', 25, 'PX Hair Sunset']]
    .map(function (r) { return { id: r[0], hc: r[1], token: r[2], tip: r[1] === 25 ? 'PX Hair Sunset Tip' : null }; });
  var DYE_BY = {};
  DYES.forEach(function (d) { DYE_BY[d.id] = d; });

  /* ---------------- small helpers ---------------- */
  function int(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function normHex(h) { var m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? '#' + m[1].toUpperCase() : null; }
  /* the quarter grid, halves away from zero (so a mirrored pair stays a mirror) */
  function qv(v) { return (v < 0 ? -1 : 1) * Math.round(Math.abs(v) * 4) / 4; }
  function key(i, j, k) { return ((i + 128) & 255) | (((j + 128) & 255) << 8) | (((k + 128) & 255) << 16); }
  function glow(t) { return { c: t, mode: 'glow' }; }

  /* ================================================================
     THE HEAD AS VOXELS: the head, the hair kept and the covering, measured per row and depth
     ================================================================ */
  function Occ(lk, dropKippah) {
    var H = Hr(), src = dropKippah && lk.cv === 5 ? Object.assign({}, lk, { cv: 0 }) : lk, h0 = 11 + lk.ht, m = new Map(), v, i, k;
    this.H = h0; this.m = m;
    for (v = 0; v <= 8; v++) for (i = -4; i <= 4; i++) for (k = -4; k <= 4; k++) if (H.inHead(i, v, k)) m.set(key(i, h0 + v, k), { i: i, j: h0 + v, k: k, head: true });
    H.headPieces(src).head.forEach(function (b) {
      if (b.proud) return;
      var cov = /^cover/.test(b.tag);
      H.cells(b).forEach(function (c) { m.set(key(c[0], c[1], c[2]), { i: c[0], j: c[1], k: c[2], cover: cov, hair: !cov, mid: b.lod === 'mid' }); });
    });
    this.crown = H.crownOf(src);
    var self = this;
    (this.crown.features || []).forEach(function (f) {
      self.each(function (c) { if (c.i > f.x0 && c.i < f.x1 && c.j >= f.y0 && c.j < f.y1 && c.k > f.z0 && c.k < f.z1) c.feat = true; });
    });
  }
  Occ.prototype.each = function (fn) { this.m.forEach(fn); };
  Occ.prototype.at = function (i, j, k) { return this.m.get(key(i, j, k)) || null; };
  /* solid: what a perched piece rests on (no 'mid' lobes: LOW drops them) */
  function solid(c) { return !c.mid; }
  /* the extents of the cells at rows ≥ j0 that pass test */
  Occ.prototype.ext = function (j0, test) {
    var e = { maxI: -1, k0: Infinity, k1: -Infinity, top: -Infinity };
    this.each(function (c) { if (c.j >= j0 && (!test || test(c))) { e.maxI = Math.max(e.maxI, Math.abs(c.i)); e.k0 = Math.min(e.k0, c.k); e.k1 = Math.max(e.k1, c.k); e.top = Math.max(e.top, c.j); } });
    return e;
  };
  Occ.prototype.rowMax = function (j, k, test) {
    var m = -1;
    for (var i = -9; i <= 9; i++) { var c = this.at(i, j, k); if (c && (!test || test(c))) m = Math.max(m, Math.abs(i)); }
    return m;
  };
  Occ.prototype.top = function (k, test) { var t = -Infinity; this.each(function (c) { if (c.k === k && (!test || test(c))) t = Math.max(t, c.j); }); return t; };
  /* the depth a headband arches at: a little forward of the middle, never through a bun or a puff */
  Occ.prototype.bandK = function () {
    var feats = this.crown.features || [], cand = [1, 2, 3, 0, -1, -2];
    for (var n = 0; n < cand.length; n++) {
      var k = cand[n];
      if (!feats.some(function (f) { return k > f.z0 && k < f.z1; })) return k;
    }
    return 1;
  };

  /* ================================================================
     THE BUILD CONTEXT
     ================================================================ */
  function Ctx(def, look, o) {
    var B = Bd();
    o = o || {};
    this.def = def; this.lk = B.drawLook(look); this.D = B.bodyOf(this.lk.bd, this.lk.ht); this.H = this.D.head.y0;
    this.n = int(o.cw) && o.cw >= 0 && o.cw < def.cw.length ? o.cw : 0;
    this.pal = def.cw[this.n]; this.member = normHex(o.member);
    this.list = {}; this.cells = new Map(); this.mids = new Map(); this.hides = new Map(); this.omitRow = Infinity; this.omitSet = new Set();
    this.joints = {}; this.parents = {}; this.flags = {}; this._occ = null; this.fit = {};
  }
  /* the piece's own colour n (its Shade with s) */
  Ctx.prototype.c = function (n, s) { var name = this.pal[Math.min(n, this.pal.length - 1)]; return /^PX /.test(name) ? name : tk(name) + (s ? ' Shade' : ''); };
  Ctx.prototype.occ = function (dropKippah) {
    if (!this._occ || this._occ.drop !== !!dropKippah) { this._occ = new Occ(this.lk, dropKippah); this._occ.drop = !!dropKippah; this.fit.crown = this._occ.crown; }
    return this._occ;
  };
  /* the occupancy a perched piece rests on (the kippah kept), and never enters */
  Ctx.prototype.perch = function () { var O = this.occ(false); this.avoid = O; return O; };
  /* a proud box (o {lod, mode, tag, flat: on its own bone's surface, not proud; erase: clears the
     cells it covers on its bone's own layer (no colour, never proud)}) */
  Ctx.prototype.box = function (bone, c, x0, x1, y0, y1, z0, z1, o) {
    o = o || {};
    var col = o.erase ? null : c && typeof c === 'object' && c.c ? c.c : c, mode = o.erase ? null : o.mode || (c && c.mode) || null;
    var e = [x0, x1, y0, y1, z0, z1].map(qv);              /* every extent on the quarter grid (KU-CH4's format) */
    for (var a = 0; a < 6; a += 2) if (!(e[a + 1] > e[a])) e[a + 1] = e[a] + 0.25;
    var bx = { b: bone, c: col, x0: e[0], x1: e[1], y0: e[2], y1: e[3], z0: e[4], z1: e[5], tag: o.tag || this.def.slot };
    if (mode) bx.mode = mode;
    if (o.lod) bx.lod = o.lod;
    if (o.erase) bx.erase = true;
    else if (!o.flat) bx.proud = true;
    (this.list[bone] = this.list[bone] || []).push(bx);
    return this;
  };
  /* both sides: fn(s) with s = 1 the figure's left (+x), −1 its right */
  function sides(fn) { fn(1); fn(-1); }
  Ctx.prototype.mbox = function (bone, c, x0, x1, y0, y1, z0, z1, o) {
    var self = this;
    sides(function (s) { self.box(bone, c, s > 0 ? x0 : -x1, s > 0 ? x1 : -x0, y0, y1, z0, z1, o); });
    return this;
  };
  /* a head-lattice cell of a hat (its own proud layer); never in the face window (eyes, brows,
     cheeks, smile: |i| ≤ 3, rows H + 1 … H + 6, at or in front of the face) */
  Ctx.prototype.cell = function (i, j, k, c, o) {
    var v = j - this.H, at = this.avoid && this.avoid.at(i, j, k);
    if (Math.abs(i) <= 3 && v >= 1 && v <= 6 && k >= 4) return this;
    if (at && !at.mid) return this;                        /* a perched piece stays outside the hair */
    var col = c && typeof c === 'object' && c.c ? c.c : c, lod = (o && o.lod) || null;
    (lod ? this.mids : this.cells).set(key(i, j, k), { i: i, j: j, k: k, role: col + '|' + ((o && o.tag) || 'hat'), lod: lod, mode: (o && o.mode) || (c && c.mode) || null });
    return this;
  };
  Ctx.prototype.joint = function (bone, x, y, z) { this.joints[bone] = [r6(x * GC), r6(y * GC), r6(z * GC)]; this.parents[bone] = BONES[bone]; return this; };
  /* a head or covering cell a pulled-on hat has just enclosed (its own base cell is there): the
     head's own layer drops it (it can never show) */
  Ctx.prototype.hide = function (i, j, k) {
    var n = key(i, j, k);
    if (this.cells.has(n)) this.hides.set(n, { i: i, j: j, k: k, role: 'hidden', lod: null, mode: null });
    return this;
  };
  /* the cells as proud boxes on 'head' (KU-CH5's packer), then the hidden fields */
  Ctx.prototype.done = function () {
    var H = Hr(), list = this.list;
    /* the base cells, then the 'mid' details painted over them (LOW skips those: the base shows) */
    var packed = [this.cells, this.mids].reduce(function (acc, m) {
      return m.size ? acc.concat(H.boxes(Array.from(m.values()), null, true, 'head').map(function (b) {
        var p = String(b.c).split('|'); b.c = p[0]; b.tag = p[1];
        return b;
      })) : acc;
    }, []);
    /* the head and covering cells inside the hat, cleared from the head's own layer (not proud):
       erase boxes after everything the figure paints there */
    if (this.hides.size) packed = packed.concat(H.boxes(Array.from(this.hides.values()), null, false, 'head').map(function (b) {
      b.c = null; b.erase = true;
      return b;
    }));
    if (packed.length) list.head = packed.concat(list.head || []);
    var row = this.omitRow, set = this.omitSet;
    hidden(list, {
      omit: function (i, j, k) { return j >= row || set.has(key(i, j, k)); },
      coversEyes: !!this.def.flags.coversEyes, earsHidden: !!this.flags.earsHidden, hideKippah: !!this.flags.hideKippah,
      spark: this.def.id === 'wear_free_spark', joints: this.joints, parents: this.parents, fit: this.fit
    });
    return list;
  };
  function hidden(list, f) { Object.keys(f).forEach(function (k) { Object.defineProperty(list, k, { value: f[k], configurable: true }); }); return list; }

  /* ================================================================
     HEAD PIECES
     ================================================================ */
  /* a pulled-on hat from row H + cut to its top: o {cut 7, up 1, band rows, main, bandC, dome (the
     top row a voxel in all round; default on), open (the face stays open below the forehead row)}.
     Its corner columns are off, so the outline is round from every side for few faces.
     → {b, t, hx, k0, k1, kc, foot(i, k, inset)} */
  function pull(x, o) {
    var O = x.occ(true), H = x.H, b = H + (o.cut == null ? 7 : o.cut), cr = O.crown;
    var e = O.ext(b, function (c) { return c.head || c.cover || (c.hair && !c.mid && !c.feat); });
    var ow = Math.floor(cr.outer.w / 2), oz0 = Math.ceil(cr.outer.z - (cr.outer.d - 1) / 2);
    var hx = Math.max(5, e.maxI, ow), k0 = Math.min(-5, e.k0, oz0), k1 = 5;
    var t = Math.max(e.top, H + 8) + (o.up == null ? 1 : o.up), kc = Math.round((k0 + k1) / 2);
    function foot(i, k, inset) {
      var a = hx - inset, lo = k0 + inset, hi = k1 - inset;
      return Math.abs(i) <= a && k >= lo && k <= hi && (inset > 0 || !(Math.abs(i) === a && (k === lo || k === hi)));
    }
    for (var j = b; j <= t; j++) {
      var inset = j === t && o.dome !== false ? 1 : 0, col = j < b + (o.band || 0) ? o.bandC : o.main;
      for (var i = -hx - 1; i <= hx + 1; i++) for (var k = k0 - 1; k <= k1; k++) {
        if (o.open && j < H + 7 && k >= 4 && Math.abs(i) <= 4) continue;
        var at = O.at(i, j, k);
        if (!(foot(i, k, inset) || (at && (at.head || at.cover)))) continue;
        x.cell(i, j, k, typeof col === 'function' ? col(i, j, k) : col);
        if (at) x.hide(i, j, k);                           /* head, covering or (dropped) hair: the skin under it */
      }
    }
    x.omitRow = b; x.flags.hideKippah = true; x.fit.cut = b;
    return { b: b, t: t, hx: hx, k0: k0, k1: k1, kc: kc, foot: foot };
  }
  /* a flat brim round a pulled-on hat at its lowest row: margins m {side, back, front}, its corners off */
  function brim(x, P, m, col) {
    var X = P.hx + m.side, K0 = P.k0 - m.back, K1 = P.k1 + m.front;
    for (var i = -X; i <= X; i++) for (var k = K0; k <= K1; k++) {
      if (!P.foot(i, k, 0) && !(Math.abs(i) === X && (k === K0 || k === K1))) x.cell(i, P.b, k, col);
    }
  }
  /* a headband over the hair at depth kz from row lo up: a band a voxel wide hugging the voxels */
  function arch(x, O, kz, lo, col, co) {
    var top = O.top(kz, solid), prev = null, j, i, bar = 5;
    for (j = lo; j <= top - 2; j++) bar = Math.max(bar, O.rowMax(j, kz, solid) + 1);
    for (j = lo; j <= top; j++) {
      var mx = O.rowMax(j, kz, solid), at = j <= top - 2 ? bar : Math.min(bar, (mx < 0 ? 4 : mx) + 1);
      if (prev !== null && at > prev) for (i = prev + 1; i <= at; i++) { x.cell(i, j - 1, kz, col, co); x.cell(-i, j - 1, kz, col, co); }
      for (i = at; i <= (prev !== null && prev > at ? prev : at); i++) { x.cell(i, j, kz, col, co); x.cell(-i, j, kz, col, co); }
      prev = at;
    }
    var mt = Math.max(0, O.rowMax(top, kz, solid));
    for (i = -mt - 1; i <= mt + 1; i++) x.cell(i, top + 1, kz, col, co);
    x.fit.kz = kz;
    return { top: top, mt: mt };
  }
  /* a ring a voxel out round the hair's widest at row r (its corners off): {cells, a (x), k0, k1, kc} */
  function rectRing(O, r) {
    var e = O.ext(r, function (c) { return c.j === r && !c.mid && !c.feat; }), a = Math.max(3, e.maxI) + 1, k0 = Math.min(-3, e.k0) - 1, k1 = Math.max(3, e.k1) + 1, out = [];
    for (var i = -a; i <= a; i++) for (var k = k0; k <= k1; k++) {
      var edge = Math.abs(i) === a || k === k0 || k === k1, corner = Math.abs(i) === a && (k === k0 || k === k1);
      if (edge && !corner) out.push({ i: i, k: k });
    }
    return { cells: out, a: a, k0: k0, k1: k1, kc: Math.round((k0 + k1) / 2) };
  }
  /* the top row of the hair (no lobes, no buns): where a crown or a ring sits */
  function topRow(O) { return O.ext(O.H, function (c) { return !c.mid && !c.feat; }).top; }
  /* ear cups outside the hair at the ears, centred on depth kc: a slab and a raised disc (o.big: a
     fluffy plus-shaped muff two voxels taller and wider) → the inner column */
  function cups(x, O, kc, col, cap, sidesOnly, o) {
    var H = x.H, big = o && o.big, y0 = H + (big ? 2 : 3), y1 = H + (big ? 6 : 5), dk = big ? 2 : 1, xi = 4;
    for (var j = y0; j <= y1; j++) for (var k = kc - dk; k <= kc + dk; k++) xi = Math.max(xi, O.rowMax(j, k, solid));
    xi += 1;
    (sidesOnly || [1, -1]).forEach(function (s) {
      for (var j2 = y0; j2 <= y1; j2++) for (var k2 = kc - dk; k2 <= kc + dk; k2++) {
        var ey = j2 === y0 || j2 === y1, ek = Math.abs(k2 - kc) === dk;
        if (big) {                                  /* two crossed slabs: round from the side */
          if (!ek) x.cell(s * xi, j2, k2, col);
          if (!ey) x.cell(s * (xi + 1), j2, k2, cap);
          continue;
        }
        x.cell(s * xi, j2, k2, col);
        if (!ey && !ek) x.cell(s * (xi + 1), j2, k2, cap, o && o.capLod ? { lod: o.capLod } : null);
      }
    });
    x.fit.ear = xi;
    return xi;
  }
  function cupK(kz) { return kz >= 2 ? kz - 1 : 0; }

  var HEAD = {
    wear_head_beanie: function (x) {               /* a ribbed band, a round crown and a bobble */
      var P = pull(x, { up: 1, band: 2, main: x.c(0), bandC: x.c(1) });
      for (var i = -1; i <= 1; i++) for (var k = P.kc - 1; k <= P.kc + 1; k++) {
        x.cell(i, P.t + 1, k, x.c(1));
        if (!i || k === P.kc) x.cell(i, P.t + 2, k, x.c(1));
      }
    },
    wear_head_cap: function (x) {                  /* worn backwards: the brim behind, the strap over the forehead, a button */
      var P = pull(x, { up: 0, band: 1, main: x.c(0), bandC: x.c(0, true) });
      for (var i = -3; i <= 3; i++) for (var k = P.k0 - 3; k < P.k0; k++) if (!(Math.abs(i) === 3 && k === P.k0 - 3)) x.cell(i, P.b, k, x.c(1));
      x.cell(0, P.t + 1, P.kc, x.c(1));
    },
    wear_head_bucket: function (x) {
      var P = pull(x, { up: 1, band: 1, main: x.c(0), bandC: x.c(1) });
      brim(x, P, { side: 2, back: 2, front: 0 }, x.c(0, true));
    },
    wear_head_bow: function (x) {                  /* a headband and a big bow on one side of the top */
      var O = x.perch(), kz = O.bandK(), A = arch(x, O, kz, x.H + 5, x.c(0)), bx = A.mt, y = A.top + 2;
      [kz, kz + 1].forEach(function (k) {
        [-2, -1, 1, 2].forEach(function (d) { x.cell(bx + d, y, k, x.c(0)); x.cell(bx + d, y + 1, k, x.c(0)); });
        x.cell(bx, y, k, x.c(0, true));
      });
      x.cell(bx, y - 1, kz, x.c(0, true));
    },
    wear_head_flowers: function (x) {              /* a leafy ring round the top with six flowers */
      var O = x.perch(), r = topRow(O) - 1, R = rectRing(O, r), a = R.a;
      R.cells.forEach(function (p) { x.cell(p.i, r, p.k, x.c(2)); });
      [[a - 2, R.k1], [-(a - 2), R.k1], [a, R.kc], [-a, R.kc], [a - 2, R.k0], [-(a - 2), R.k0]].forEach(function (p, n) {
        x.cell(p[0], r + 1, p[1], n % 2 ? x.c(1) : x.c(0));
      });
    },
    wear_head_phones: function (x) {
      var O = x.perch(), kz = O.bandK();
      cups(x, O, cupK(kz), x.c(0), x.c(1));
      arch(x, O, kz, x.H + 5, x.c(0));
      x.flags.earsHidden = true;
    },
    wear_head_ears: function (x) {                 /* a headband with two pointed ears, coloured inside */
      var O = x.perch(), kz = O.bandK(), A = arch(x, O, kz, x.H + 5, x.c(0)), e = Math.max(1, A.mt - 1), y = A.top + 2;
      sides(function (s) {
        for (var d = -1; d <= 1; d++) x.cell(s * (e + d), y, kz, d === 0 ? x.c(1) : x.c(0));
        x.cell(s * e, y + 1, kz, x.c(1)).cell(s * (e + 1), y + 1, kz, x.c(0)).cell(s * (e + 1), y + 2, kz, x.c(0));
      });
    },
    wear_head_crown: function (x) {                /* a card crown round the top rows: five points and a gem */
      var O = x.perch(), r = topRow(O) - 1, R = rectRing(O, r), a = R.a, q = Math.round((R.k1 - R.k0) / 4);
      R.cells.forEach(function (p) { x.cell(p.i, r, p.k, x.c(0)).cell(p.i, r + 1, p.k, x.c(0)); });
      [[0, R.k1], [a, R.k1 - q], [-a, R.k1 - q], [a, R.k0 + q], [-a, R.k0 + q]].forEach(function (p) { x.cell(p[0], r + 2, p[1], x.c(0)); });
      x.box('head', x.c(1), -0.5, 0.5, r + 0.25, r + 1.25, R.k1 + 0.5, R.k1 + 0.75);
    },
    wear_pier_sunhat: function (x) {
      var P = pull(x, { up: 1, band: 1, main: x.c(0), bandC: x.c(1) });
      brim(x, P, { side: 3, back: 3, front: 0 }, x.c(0, true));
    },
    wear_jungle_hat: function (x) {
      var P = pull(x, { up: 2, band: 1, main: x.c(0), bandC: x.c(1) });
      brim(x, P, { side: 2, back: 2, front: 0 }, x.c(0, true));
      for (var k = P.k0 + 2; k <= P.k1 - 2; k++) x.cell(0, P.t, k, x.c(0, true));      /* the crease */
    },
    wear_treetop_acorn: function (x) {             /* a scaly cup with a rim, a stalk and a leaf */
      var P = pull(x, { cut: 8, up: 1, band: 1, main: { c: x.c(0), mode: 'cobble' }, bandC: x.c(0, true) });
      x.cell(0, P.t + 1, P.kc, 'PX Acc Wood').cell(0, P.t + 2, P.kc, 'PX Acc Wood').cell(1, P.t + 2, P.kc, x.c(1)).cell(2, P.t + 2, P.kc, x.c(1));
    },
    wear_castle_featherhat: function (x) {         /* a soft cap, a tall curling feather at one side */
      var P = pull(x, { up: 1, band: 1, main: x.c(0), bandC: x.c(0, true) });
      var fx = -P.hx - 0.5, y = P.b + 1, z = P.kc + 0.5;
      x.box('head', x.c(1), fx - 0.75, fx, y, y + 4, z - 1, z + 1).box('head', x.c(1), fx - 0.75, fx, y + 4, y + 6.5, z - 2, z)
        .box('head', x.c(1, true), fx - 0.75, fx, y + 6.5, y + 7.5, z - 2.75, z - 1.25);
    },
    wear_ice_earmuffs: function (x) {
      var O = x.perch(), kz = O.bandK();
      cups(x, O, cupK(kz), x.c(0), x.c(0), null, { big: true });
      arch(x, O, kz, x.H + 6, x.c(1));
      x.flags.earsHidden = true;
    },
    wear_sig_starhat: function (x) {              /* Jude: a tall cone leaning back, a gold band, a ✦ at the tip */
      var P = pull(x, { up: 0, band: 1, main: x.c(0), bandC: x.c(1), dome: false }), y = P.t + 1, kc = P.kc, n = 0;
      [[P.hx - 2, 1, 0], [2, 2, 1], [1, 3, 2]].forEach(function (tr) {
        for (var r = 0; r < tr[1]; r++, n++) for (var i = -tr[0]; i <= tr[0]; i++) for (var k = kc - tr[2] - tr[0]; k <= kc - tr[2] + tr[0]; k++) {
          x.cell(i, y + n, k, x.c(0));
        }
      });
      [[0, 0], [1, 0], [-1, 0], [0, 1]].forEach(function (d) { x.cell(d[0], y + n + d[1], kc - 2, glow('PX Acc Glow')); });
    },
    wear_sig_flyingcap: function (x) {            /* Wren: a leather cap with ear flaps, the goggles pushed up on top */
      var P = pull(x, { up: 0, band: 1, main: x.c(0), bandC: x.c(1) }), H = x.H;
      sides(function (s) {
        for (var j = H + 3; j < P.b; j++) for (var k = -1; k <= 1; k++) {
          x.cell(s * P.hx, j, k, x.c(0, true));
          for (var a = P.hx + 1; a <= 9; a++) x.omitSet.add(key(s * a, j, k));
        }
      });
      var y = P.b + 1;
      x.box('head', 'PX Acc Charcoal', -3.5, 3.5, y + 0.5, y + 1.25, 5.5, 5.75).mbox('head', x.c(2), 0.75, 3, y, y + 2, 5.5, 6);
      x.flags.earsHidden = true;
    },
    wear_sig_headset: function (x) {              /* Ines: one cup, a slim band and a mic boom to the corner of the smile */
      var O = x.perch(), kz = O.bandK(), kc = cupK(kz), H = x.H;
      /* LOW draws it as an earpiece mic: the cup, the boom and the glowing mic (what reads at that
         size); the band over the hair and the cup's raised disc are 'mid' (the LOW-cap trim) */
      var xi = cups(x, O, kc, x.c(1), x.c(0), [1], { capLod: 'mid' });
      arch(x, O, kz, H + 6, x.c(0), { lod: 'mid' });
      var bz = kc + 1.5;
      x.box('head', x.c(0), xi - 0.25, xi + 0.25, H + 2, H + 3, bz - 0.5, 5.25).box('head', x.c(0), 2, xi - 0.25, H + 2, H + 2.5, 4.75, 5.25)
        .box('head', 'PX Acc Glow Pink', 1.5, 2.25, H + 1.75, H + 2.75, 4.75, 5.5, { mode: 'glow' });
    },
    wear_sig_helmet: function (x) {               /* Lena: an open-face helmet over the ears, a stripe, the visor on its hinge */
      var H = x.H, P = pull(x, { cut: 3, up: 1, open: true, main: function (i, j) { return Math.abs(i) <= 1 && j >= H + 9 ? x.c(1) : x.c(0); } });
      x.box('visor', x.c(2), -4, 4, H + 7.5, H + 8.75, 5.5, 6);
      x.joint('visor', 0, H + 8.5, 1);
      x.flags.earsHidden = true;
      return P;
    }
  };

  /* ================================================================
     FACE PIECES: proud plates on the face (eyes on rows H + 3 … H + 4, tall eyes to H + 5)
     ================================================================ */
  function eyeTop(x) { return x.H + (x.lk.ey === 1 || x.lk.ey === 3 ? 6 : 5); }
  var FACE = {
    wear_face_shades: function (x) {              /* a frame bar, two dark lenses on a bridge, a glint on each */
      var H = x.H, top = eyeTop(x), z = 4.75;
      x.box('head', x.c(0), -4.5, 4.5, top, top + 0.75, z, z + 0.25).mbox('head', x.c(1), 0.75, 4.25, H + 2.75, top, z, z + 0.25)
        .box('head', x.c(0), -0.75, 0.75, H + 3.75, top, z, z + 0.25);
      x.box('head', GLINT, 3.25, 3.75, top - 0.75, top - 0.25, z + 0.25, z + 0.375, { mode: 'glow', lod: 'mid' });
    },
    wear_face_starshades: function (x) {          /* a four-point star over each eye (they hide the identity glasses) */
      var H = x.H, top = eyeTop(x), z = 4.75, c = x.lk.ey === 3 ? H + 4 : (H + 3 + top) / 2;
      x.mbox('head', x.c(0), 1.75, 3.25, c - 2.25, c + 2.25, z, z + 0.25).mbox('head', x.c(0), 0.25, 4.75, c - 0.75, c + 0.75, z, z + 0.25);
    },
    wear_face_paint: function (x) {               /* a ✦ painted on each cheek, clear of the eyes and the smile */
      var H = x.H, z = 4.5;
      x.mbox('head', x.c(0), 2.5, 3, H + 0.75, H + 2.75, z, z + 0.25).mbox('head', x.c(0), 2, 3.5, H + 1.5, H + 2, z, z + 0.25);
    },
    wear_face_goggles: function (x) {             /* a wraparound lens in a rim, the strap to the ears */
      var H = x.H, top = eyeTop(x), z = 4.75;
      x.box('head', x.c(0), -4.75, 4.75, H + 2.5, top + 0.5, z, z + 0.25).box('head', x.c(1), -4, 4, H + 2.75, top + 0.25, z + 0.25, z + 0.5);
      x.mbox('head', x.c(0, true), 4.5, 4.75, H + 3.5, H + 4.5, 0, 4.75, { lod: 'mid' });
    }
  };

  /* ================================================================
     NECK PIECES: proud on 'body' (the collar rows and the chest; T = the torso descriptor)
     ================================================================ */
  var NECK = {
    wear_neck_scarf: function (x) {
      var T = x.D.torso, tx = T.x1, tz = T.z1, y = T.y1, f = T.x0 + 0.5;
      x.box('body', x.c(0), -tx, tx, y - 1, y, tz, tz + 1).box('body', x.c(1), -tx, tx, y - 2, y - 1, tz, tz + 1)
        .box('body', x.c(0), -tx, tx, y - 2, y, -tz - 1, -tz);
      x.box('body', x.c(1), f, f + 2, y - 3.5, y - 2, tz, tz + 1).box('body', x.c(0), f, f + 2, y - 5, y - 3.5, tz, tz + 1)
        .box('body', x.c(0, true), f, f + 2, y - 5.5, y - 5, tz, tz + 1, { lod: 'mid' });
    },
    wear_neck_bowtie: function (x) {
      var T = x.D.torso, tz = T.z1, y = T.y1;
      x.box('body', x.c(0, true), -0.5, 0.5, y - 2, y - 1, tz, tz + 0.75).mbox('body', x.c(0), 0.5, 2.5, y - 2.5, y - 0.5, tz, tz + 0.5);
    },
    wear_neck_bandana: function (x) {
      var T = x.D.torso, tz = T.z1, y = T.y1;
      x.box('body', x.c(0), -2.5, 2.5, y - 1, y, tz, tz + 0.5).box('body', x.c(0), -1.5, 1.5, y - 2, y - 1, tz, tz + 0.5)
        .box('body', x.c(0, true), -0.5, 0.5, y - 3, y - 2, tz, tz + 0.5);
      x.box('body', x.c(1), -0.25, 0.25, y - 1.75, y - 1.25, tz + 0.5, tz + 0.625, { lod: 'mid' });
    },
    wear_neck_charm: function (x) {               /* a fine chain and a ✦ pendant */
      var T = x.D.torso, tz = T.z1, y = T.y1;
      x.box('body', x.c(0), -2.5, 2.5, y - 0.75, y - 0.5, tz, tz + 0.25).box('body', x.c(0), -0.125, 0.125, y - 2, y - 0.75, tz, tz + 0.25);
      x.box('body', x.c(0), -0.25, 0.25, y - 3.5, y - 2, tz, tz + 0.5).box('body', x.c(0), -0.75, 0.75, y - 3, y - 2.5, tz, tz + 0.5);
    },
    wear_treetop_harness: function (x) {          /* shoulder straps, a waist belt and a gold clip */
      var T = x.D.torso, tx = T.x1, tz = T.z1;
      x.mbox('body', x.c(0), tx - 2, tx - 1, T.y0 + 1, T.y1, tz, tz + 0.25).box('body', x.c(0, true), -tx, tx, T.y0, T.y0 + 1, tz, tz + 0.25);
      x.box('body', x.c(1), -0.5, 0.5, T.y0 - 0.5, T.y0 + 1, tz + 0.25, tz + 0.75);
    },
    wear_sig_whistle: function (x) {              /* Malu: a bright lanyard and a whistle */
      var T = x.D.torso, tz = T.z1, y = T.y1;
      x.mbox('body', x.c(0), 0.75, 1.125, y - 3.25, y, tz, tz + 0.25);
      x.box('body', x.c(1), -1.125, 1.125, y - 4.5, y - 3.25, tz, tz + 0.75).box('body', x.c(1, true), 1.125, 1.75, y - 4.25, y - 3.5, tz + 0.25, tz + 0.75, { lod: 'mid' });
    },
    wear_sig_binocs: function (x) {               /* Rowan: binoculars on a strap */
      var T = x.D.torso, tz = T.z1, y = T.y1;
      x.box('body', x.c(1), -2.5, 2.5, y - 0.75, y - 0.5, tz, tz + 0.25);
      x.mbox('body', x.c(0), 0.125, 1.625, y - 4.5, y - 2, tz, tz + 1.25).mbox('body', 'PX Acc Lens', 0.375, 1.375, y - 4.5, y - 3.5, tz + 1.25, tz + 1.5);
    }
  };

  /* ================================================================
     BACK PIECES: proud on 'body' behind the back plane (z −tz); above the shoulders a piece
     stands behind the head (z ≤ −4.75) and outside any hair hanging there
     ================================================================ */
  /* the back face a piece spanning rows y0 … y1 leans on */
  function backZ(x, y1) {
    var T = x.D.torso, cr = x.occ(false).crown, z = T.z0;
    if (cr.back && cr.back.y != null && cr.back.y < y1) z = Math.min(z, cr.back.z);
    if (y1 > T.y1) z = Math.min(z, -4.75, cr.back ? cr.back.z - 0.25 : -4.75);
    x.fit.back = z;
    return z;
  }
  /* two strap bars from the back to a piece hung further out */
  function straps(x, z, w) {
    var T = x.D.torso;
    if (z >= T.z0 - 0.01) return;
    x.box('body', 'PX Acc Charcoal', -w, w, T.y1 - 1.5, T.y1 - 1, z, T.z0).box('body', 'PX Acc Charcoal', -w, w, T.y0 + 1, T.y0 + 1.5, z, T.z0);
  }
  /* a cape on cape0 → cape2 in three equal lengths from the shoulders: o {bottom (the hem's row; 0 =
     the ground), flare (voxels wider at the hem), main, hem, collar, leaves (a jagged leaf hem),
     trim (an edge down both sides)}; a clasp on the chest */
  function cape(x, o) {
    var T = x.D.torso, tx = T.x1, z = T.z0, y = T.y1, bot = o.bottom, rows = y - bot, a = Math.round(rows / 3), m = y - a, l = m - a;
    var w0 = tx + 0.5, w1 = tx + 0.5 + o.flare / 2, w2 = tx + 0.5 + o.flare;
    x.box('body', o.collar, -tx, tx, y - 1, y, z - 1.5, z);
    x.box('cape0', o.main, -w0, w0, m, y - 1, z - 1, z).box('cape1', o.main, -w1, w1, l, m, z - 1, z).box('cape2', o.main, -w2, w2, bot + 1, l, z - 1, z);
    if (o.leaves) for (var i = -w2 + 0.5; i < w2; i += 2) x.box('cape2', o.hem, i - 0.5, Math.min(w2, i + 0.5), bot, bot + 1, z - 1, z);
    else x.box('cape2', o.hem, -w2, w2, bot, bot + 1, z - 1, z);
    if (o.trim) x.mbox('cape2', o.trim, w2 - 1, w2, bot, l, z - 1.25, z - 0.75);
    x.mbox('body', 'PX Acc Gold', 1.25, 2, y - 1.5, y - 0.75, T.z1, T.z1 + 0.5, { lod: 'mid' });
    /* a hood worn down (KU-CH7's hoodDown: the two rows under the collar, a voxel behind the back)
       lies inside the collar and the cape's top length: the body's own layer drops it there (its
       faces could never show; the cape lifts only a few degrees at its hinge) */
    x.box('body', null, T.x0, T.x1, y - 2, y, z - 1, z, { erase: true, tag: 'hidden' });
    x.joint('cape0', 0, y - 1, z - 0.5).joint('cape1', 0, m, z - 0.5).joint('cape2', 0, l, z - 0.5);
  }
  function pack(x, o) {
    var T = x.D.torso, tx = T.x1, z = backZ(x, T.y1), w = tx - 0.5, y0 = T.y0, y1 = T.y1 - 0.5;
    x.box('body', o.main, -w, w, y0, y1 - 1, z - 2, z).box('body', o.flap, -w - 0.25, w + 0.25, y1 - 1, y1, z - 2.25, z);
    x.box('body', o.pocket, -1.5, 1.5, y0 + 0.5, y0 + 2.5, z - 2.5, z - 2, { lod: 'mid' });
    x.mbox('body', 'PX Acc Charcoal', tx - 2, tx - 1, y0 + 2, T.y1, T.z1, T.z1 + 0.25, { lod: 'mid' });
    straps(x, z, w - 1);
    return { z: z, w: w, y1: y1 };
  }
  var BACK = {
    wear_back_pack: function (x) { pack(x, { main: x.c(0), flap: x.c(0, true), pocket: x.c(1) }); },
    wear_back_cape: function (x) { cape(x, { bottom: 2, flare: 2, main: x.c(0), hem: x.c(0, true), collar: x.c(1) }); },
    wear_back_wings: function (x) {               /* butterfly wings: a large upper pair, a small lower pair, a spot on each */
      var T = x.D.torso, z = T.z0, y0 = T.y0, y1 = T.y1;
      x.box('body', x.c(2), -0.5, 0.5, y0, y1, z - 1, z);
      x.mbox('body', x.c(0), 0.5, 4.5, y0 + 2, y1, z - 0.75, z - 0.5).mbox('body', x.c(0), 4.5, 7, y0 + 3, y1 + 2, z - 0.75, z - 0.5);
      x.mbox('body', x.c(0, true), 0.5, 4, y0 - 1.5, y0 + 2, z - 0.75, z - 0.5);
      x.mbox('body', x.c(1), 5, 6, y1 - 0.5, y1 + 1, z - 1, z - 0.75, { lod: 'mid' });
    },
    wear_back_guitar: function (x) {              /* the body low on the back, the neck up to the shoulder */
      var T = x.D.torso, z = backZ(x, T.y1), y0 = T.y0;
      x.box('body', x.c(0), -3, 1, y0 - 2, y0 + 1, z - 1.25, z).box('body', x.c(0), -2.5, 0.5, y0 + 1, y0 + 3, z - 1.25, z);
      x.box('body', 'PX Acc Charcoal', -1.5, -0.5, y0 - 0.5, y0 + 0.5, z - 1.5, z - 1.25, { lod: 'mid' });
      x.box('body', x.c(1), -1.5, -0.5, y0 + 3, T.y1 - 1, z - 1, z - 0.25).box('body', x.c(1, true), -2, 0, T.y1 - 1, T.y1, z - 1, z - 0.25);
    },
    wear_back_skate: function (x) {               /* a deck with rounded ends, four wheels outwards */
      var T = x.D.torso, z = T.z0, y0 = T.y0 - 3, y1 = T.y1;
      x.box('body', x.c(0), -1.75, 1.75, y0 + 1, y1 - 1, z - 0.75, z - 0.25).box('body', x.c(0), -1.25, 1.25, y0, y0 + 1, z - 0.75, z - 0.25)
        .box('body', x.c(0), -1.25, 1.25, y1 - 1, y1, z - 0.75, z - 0.25);
      x.box('body', x.c(1), -0.5, 0.5, y0 + 2, y1 - 2, z - 0.875, z - 0.75, { lod: 'mid' });
      [y0 + 1.5, y1 - 2.5].forEach(function (y) { x.mbox('body', 'PX Acc Charcoal', 0.5, 1.5, y, y + 1, z - 1.5, z - 0.75); });
    },
    wear_back_jetpack: function (x) {             /* two bottles on a card frame, ribbon streamers (no flames) */
      var T = x.D.torso, z = T.z0, y0 = T.y0, y1 = T.y1;
      x.box('body', 'PX Acc Tan', -1.5, 1.5, y0 + 1, y1 - 1, z - 1, z);
      x.mbox('body', x.c(0), 0.5, 2.5, y0, y1 - 1, z - 2.5, z - 0.5).mbox('body', x.c(0, true), 0.75, 2.25, y1 - 1, y1 - 0.25, z - 2.25, z - 0.75);
      x.mbox('body', 'PX Acc Charcoal', 1, 2, y0 - 1, y0, z - 2, z - 1);
      x.mbox('body', x.c(1), 1, 1.5, y0 - 4, y0 - 1, z - 1.625, z - 1.375).mbox('body', x.c(2), 1.5, 2, y0 - 3, y0 - 1, z - 1.625, z - 1.375);
    },
    wear_pier_surfboard: function (x) {          /* a long board behind the head, strapped on */
      var T = x.D.torso, top = T.y1 + 5, z = backZ(x, top);
      x.box('body', x.c(0), -1.5, 1.5, T.y0 - 3, top - 1, z - 0.75, z).box('body', x.c(0), -1, 1, top - 1, top, z - 0.75, z)
        .box('body', x.c(0), -1, 1, T.y0 - 4, T.y0 - 3, z - 0.75, z);
      x.box('body', x.c(1), -0.25, 0.25, T.y0 - 3, top - 1, z - 0.875, z - 0.75).box('body', x.c(1, true), -0.25, 0.25, T.y0 - 3, T.y0 - 1, z - 1.75, z - 0.875, { lod: 'mid' });
      straps(x, z, 1);
    },
    wear_jungle_parrot: function (x) {           /* a plush parrot on the left shoulder, facing forward; it never moves */
      var T = x.D.torso, y = T.y1, a = 4.5, z0 = 0.5;
      x.box('body', x.c(0), a, a + 2, y, y + 3, z0, z0 + 2).box('body', x.c(0), a + 0.25, a + 1.75, y + 3, y + 4.5, z0 + 0.25, z0 + 1.75);
      x.box('body', x.c(1), a + 1.75, a + 2.25, y + 0.5, y + 2.5, z0, z0 + 1.75).box('body', x.c(2), a + 0.5, a + 1.5, y + 0.5, y + 1.5, z0 - 2, z0);
      x.box('body', 'PX Acc Sunny', a + 0.75, a + 1.25, y + 3.25, y + 4, z0 + 1.75, z0 + 2.5);
      x.box('body', 'PX Acc Lens', a + 0.25, a + 1.75, y + 3.75, y + 4.25, z0 + 1.5, z0 + 1.875);
    },
    wear_treetop_leafcape: function (x) { cape(x, { bottom: 3, flare: 1, main: x.c(0), hem: x.c(1), collar: x.c(1), leaves: true }); },
    wear_castle_cloak: function (x) { cape(x, { bottom: 0, flare: 3, main: x.c(0), hem: 'PX Acc Cream', collar: 'PX Acc Cream', trim: 'PX Acc Cream' }); },
    wear_sig_gadgetpack: function (x) {          /* Priya: a boxy pack with dials, the antenna that nods */
      var P = pack(x, { main: x.c(0), flap: x.c(1), pocket: x.c(0, true) }), T = x.D.torso, ax = 6, az = P.z - 1.25;
      x.box('body', 'PX Acc Glow Cyan', -1.5, 1.5, T.y0 + 3, T.y0 + 3.5, P.z - 2.25, P.z - 2, { mode: 'glow', lod: 'mid' });
      x.box('antenna', x.c(1), P.w, ax + 0.25, P.y1 - 1, P.y1 - 0.75, az - 0.125, az + 0.125).box('antenna', 'PX Acc Charcoal', ax, ax + 0.25, P.y1 - 1, P.y1 + 4, az - 0.125, az + 0.125)
        .box('antenna', 'PX Acc Glow Cyan', ax - 0.25, ax + 0.5, P.y1 + 4, P.y1 + 4.75, az - 0.375, az + 0.375, { mode: 'glow' });
      x.joint('antenna', P.w, P.y1 - 1, az);
    }
  };

  /* ================================================================
     HAND PIECES: on 'wand' round the grip G = sockets.hand.at (the right fist, x −ax); the left
     pom-pom on 'armL' at sockets.handL
     ================================================================ */
  /* the Spark Stick (px-crew wandParts): a 5-voxel handle up from under the grip and a ✦ on a
     half grid, four thin points round a diamond, white at its heart */
  var SPARK_R = 4;
  function spark(x) {
    var g = x.D.sockets.hand.at, gx = g[0], gy = g[1] - 0.5, gz = g[2], hex = x.member;
    var mem = { token: 'Bubblegum', state: { key: 'member', off: 'Bubblegum', on: 'Bubblegum' } };
    if (hex) mem.state.map = { own: hex };
    x.box('wand', 'Midnight Ink', gx - 0.5, gx + 0.5, gy - 0.5, gy + 4.5, gz - 0.5, gz + 0.5, { flat: true });
    var y0 = gy + 4.5;
    for (var j = -SPARK_R; j <= SPARK_R; j++) {
      var run = null;
      for (var i = -SPARK_R; i <= SPARK_R + 1; i++) {
        var d = Math.abs(i) + Math.abs(j), on = i <= SPARK_R && (d <= 2 || i === 0 || j === 0), c = on ? (d <= 1 ? 'W' : 'G') : null;
        if (run && run.c !== c) {
          var y = y0 + (j + SPARK_R) * 0.5;
          x.box('wand', run.c === 'W' ? GLINT : mem, gx + (run.i - 0.5) * 0.5, gx + (i - 0.5) * 0.5, y, y + 0.5, gz - 0.5, gz + 0.5, { mode: 'glow', flat: true });
          run = null;
        }
        if (c && !run) run = { c: c, i: i };
      }
    }
  }
  var HAND = {
    wear_free_spark: spark,
    wear_hand_mic: function (x) {
      var g = x.D.sockets.hand.at, gx = g[0], gy = g[1];
      x.box('wand', 'PX Acc Charcoal', gx - 0.5, gx + 0.5, gy - 1, gy + 1.5, 1.5, 2.5).box('wand', x.c(0), gx - 0.75, gx + 0.75, gy + 1.5, gy + 2, 1.25, 2.75);
      x.box('wand', 'PX Acc Silver', gx - 1, gx + 1, gy + 2, gy + 3.5, 1, 3).box('wand', 'PX Acc Silver Shade', gx - 0.75, gx + 0.75, gy + 3.5, gy + 3.75, 1.25, 2.75);
    },
    wear_hand_balloon: function (x) {             /* on a string, floating above the head */
      var g = x.D.sockets.hand.at, sx = g[0] - 1.25, gy = g[1], cr = x.occ(false).crown, yb = Math.max(x.H + 13, cr.top + 1);
      x.box('wand', 'PX Acc White', sx - 0.125, sx + 0.125, gy - 0.5, yb, g[2] - 0.125, g[2] + 0.125);
      x.box('wand', x.c(0, true), sx - 0.5, sx + 0.5, yb, yb + 0.5, g[2] - 0.5, g[2] + 0.5);
      x.box('wand', x.c(0), sx - 2, sx + 2, yb + 1, yb + 4, g[2] - 1.5, g[2] + 1.5).box('wand', x.c(0), sx - 1.5, sx + 1.5, yb + 0.5, yb + 4.5, g[2] - 1, g[2] + 1);
      x.box('wand', GLINT, sx - 1.5, sx - 0.75, yb + 3, yb + 3.75, g[2] + 1.5, g[2] + 1.625, { mode: 'glow', lod: 'mid' });
      x.fit.top = yb + 4.5;
    },
    wear_hand_icecream: function (x) {            /* a cone with two scoops, held up in front of the arm */
      var g = x.D.sockets.hand.at, gx = g[0], gy = g[1];
      x.box('wand', 'PX Acc Tan', gx - 0.5, gx + 0.5, gy - 1.5, gy + 0.5, 1.5, 2.5).box('wand', 'PX Acc Tan Shade', gx - 0.75, gx + 0.75, gy + 0.5, gy + 1.75, 1.25, 2.75);
      x.box('wand', x.c(0), gx - 1, gx + 1, gy + 1.75, gy + 3.25, 1, 3).box('wand', x.c(1), gx - 0.75, gx + 0.75, gy + 3.25, gy + 4.5, 1.25, 2.75);
      x.box('wand', x.c(0, true), gx - 0.25, gx + 0.25, gy + 1.25, gy + 1.75, 2.75, 3, { lod: 'mid' });
    },
    wear_hand_lantern: function (x) {             /* hanging from the fist, a steady glow */
      var g = x.D.sockets.hand.at, gx = g[0], gy = g[1], gz = g[2];
      x.box('wand', x.c(0), gx - 0.25, gx + 0.25, gy - 1.5, gy + 0.5, gz - 0.25, gz + 0.25);
      x.box('wand', x.c(0), gx - 1.25, gx + 1.25, gy - 2, gy - 1.5, gz - 1.25, gz + 1.25).box('wand', x.c(0), gx - 1.25, gx + 1.25, gy - 5, gy - 4.5, gz - 1.25, gz + 1.25, { lod: 'mid' });
      x.box('wand', 'PX Acc Glow', gx - 1, gx + 1, gy - 4.5, gy - 2, gz - 1, gz + 1, { mode: 'glow' });
    },
    wear_hand_poms: function (x) {                /* one in each fist */
      var D = x.D;
      [['wand', D.sockets.hand.at, -1], ['armL', D.sockets.handL.at, 1]].forEach(function (e) {
        var g = e[1], cx = g[0] + e[2] * 0.5, cy = g[1] - 1, cz = g[2] - 0.5;     /* round the fist, below the wrist */
        x.box(e[0], x.c(0), cx - 1.5, cx + 1.5, cy - 1, cy + 1, cz - 1, cz + 1).box(e[0], x.c(0), cx - 1, cx + 1, cy - 1.5, cy + 1.5, cz - 1, cz + 1)
          .box(e[0], x.c(0), cx - 1, cx + 1, cy - 1, cy + 1, cz - 1.5, cz + 1.5);
        x.box(e[0], x.c(1), cx - 0.25, cx + 0.25, cy - 2.25, cy - 1.5, cz - 0.25, cz + 0.25, { lod: 'mid' });
      });
    },
    wear_hand_umbrella: function (x) {            /* closed, carried like a walking stick: the hook before the fist */
      var g = x.D.sockets.hand.at, gx = g[0], gy = g[1], z = g[2] + 0.75;
      x.box('wand', 'PX Acc Wood', gx - 0.25, gx + 0.25, gy - 0.5, gy + 1.5, z - 0.25, z + 0.25).box('wand', 'PX Acc Wood', gx - 0.25, gx + 0.25, gy + 1.5, gy + 2, z - 0.25, z + 1.25);
      x.box('wand', x.c(0), gx - 0.75, gx + 0.75, gy - 5, gy - 0.5, z - 0.75, z + 0.75).box('wand', x.c(0, true), gx - 0.5, gx + 0.5, gy - 6, gy - 5, z - 0.5, z + 0.5);
      x.box('wand', x.c(1), gx - 1, gx + 1, gy - 3, gy - 2.5, z - 1, z + 1).box('wand', 'PX Acc Silver', gx - 0.25, gx + 0.25, gy - 6.5, gy - 6, z - 0.25, z + 0.25);
    },
    wear_hand_kite: function (x) {                /* a diamond kite flying on a long string above the head */
      var g = x.D.sockets.hand.at, sx = g[0] - 1.25, gy = g[1], z = g[2], cr = x.occ(false).crown, yb = Math.max(x.H + 14, cr.top + 3);
      x.box('wand', 'PX Acc White', sx - 0.125, sx + 0.125, gy - 0.5, yb, z - 0.125, z + 0.125);
      [[0.5, 1, 0], [1.5, 1, 0], [2.5, 1.5, 1], [1.5, 1.5, 1], [0.5, 1, 1]].reduce(function (y, r) {
        x.box('wand', r[2] ? x.c(1) : x.c(0), sx - r[0], sx + r[0], y, y + r[1], z - 0.25, z);
        return y + r[1];
      }, yb);
      x.box('wand', x.c(2), sx - 0.75, sx + 0.75, yb - 2, yb - 1.5, z - 0.125, z + 0.125, { lod: 'mid' });
      x.fit.top = yb + 6;
    },
    wear_castle_banner: function (x) {            /* a pennant on a pole with a round finial: never a weapon */
      var g = x.D.sockets.hand.at, px = g[0] - 1, gy = g[1], z = 2;
      x.box('wand', 'PX Acc Wood', px - 0.25, px + 0.25, 1, gy + 12, z - 0.25, z + 0.25).box('wand', 'PX Acc Gold', px - 0.5, px + 0.5, gy + 12, gy + 13, z - 0.5, z + 0.5);
      x.box('wand', x.c(0), px - 1.25, px - 0.25, gy + 8.5, gy + 11.5, z - 0.125, z + 0.125).box('wand', x.c(0), px - 2.5, px - 1.25, gy + 9, gy + 11, z - 0.125, z + 0.125)
        .box('wand', x.c(0), px - 3.75, px - 2.5, gy + 9.5, gy + 10.5, z - 0.125, z + 0.125);
      x.box('wand', x.c(1), px - 1.75, px - 0.75, gy + 9.5, gy + 10.5, z + 0.125, z + 0.25, { lod: 'mid' });
    },
    wear_sig_ball: function (x) {                 /* Omar: a football at the fist, dark patches */
      var g = x.D.sockets.hand.at, cx = g[0] - 0.5, cy = g[1] - 1.5, cz = g[2] + 0.5;
      x.box('wand', x.c(0), cx - 1.5, cx + 1.5, cy - 1, cy + 1, cz - 1, cz + 1).box('wand', x.c(0), cx - 1, cx + 1, cy - 1.5, cy + 1.5, cz - 1, cz + 1)
        .box('wand', x.c(0), cx - 1, cx + 1, cy - 1, cy + 1, cz - 1.5, cz + 1.5);
      x.box('wand', x.c(1), cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5, cz + 1.5, cz + 1.625).box('wand', x.c(1), cx - 1.625, cx - 1.5, cy - 0.5, cy + 0.5, cz - 0.5, cz + 0.5);
    },
    wear_sig_map: function (x) {                  /* Amara: an open map held in front, a route to an island */
      var g = x.D.sockets.hand.at, gx = g[0], gy = g[1], z = x.D.torso.z1 + 0.25;
      x.box('wand', x.c(0), gx - 0.5, gx + 3, gy - 1, gy + 2, z, z + 0.25).box('wand', x.c(0, true), gx + 1, gx + 1.25, gy - 1, gy + 2, z + 0.25, z + 0.3125);
      x.box('wand', x.c(1), gx + 1.75, gx + 2.75, gy - 0.5, gy + 0.5, z + 0.25, z + 0.375).box('wand', x.c(2), gx, gx + 1.75, gy + 1, gy + 1.25, z + 0.25, z + 0.375, { lod: 'mid' });
    }
  };

  /* ================================================================
     THE CATALOGUE: slot, colourways (colour names; cw = how many), flags
     ================================================================ */
  var PIECES = {}, BUILD = {};
  function piece(id, slot, cw, flags, fn) { PIECES[id] = { id: id, slot: slot, cw: cw, flags: flags || {} }; BUILD[id] = fn; }
  var EYES_F = { coversEyes: true };
  [
    ['wear_head_beanie', [['Red', 'Cream'], ['Navy', 'Sunny'], ['Teal', 'White']]],
    ['wear_head_cap', [['Blue', 'Sunny'], ['Red', 'White'], ['Lime', 'Navy']]],
    ['wear_head_bucket', [['Sunny', 'Navy'], ['Lilac', 'White'], ['Mint', 'Teal']]],
    ['wear_head_bow', [['Pink'], ['Red'], ['Sky'], ['Sunny']]],
    ['wear_head_flowers', [['Pink', 'White', 'Leaf'], ['Lilac', 'Sky', 'Leaf']]],
    ['wear_head_phones', [['Red', 'White'], ['Sky', 'Pink'], ['Purple', 'Mint']]],
    ['wear_head_ears', [['Orange', 'Cream'], ['White', 'Pink'], ['Charcoal', 'Pink']]],
    ['wear_head_crown', [['Pink', 'Sky'], ['Sky', 'Sunny']]],
    ['wear_pier_sunhat', [['Cream', 'Coral'], ['Sky', 'White'], ['Pink', 'Sunny']]],
    ['wear_jungle_hat', [['Khaki', 'Choc'], ['Moss', 'Tan']]],
    ['wear_treetop_acorn', [['Brown', 'Leaf'], ['Tan', 'Moss']]],
    ['wear_castle_featherhat', [['Purple', 'Sunny'], ['Red', 'White'], ['Teal', 'Pink']]],
    ['wear_ice_earmuffs', [['White', 'Sky'], ['Pink', 'White'], ['Mint', 'Navy']]],
    ['wear_sig_starhat', [['Navy', 'Gold']]],
    ['wear_sig_flyingcap', [['Brown', 'Cream', 'Glass']]],
    ['wear_sig_headset', [['Silver', 'Pink']]],
    ['wear_sig_helmet', [['Coral', 'White', 'Lens']]]
  ].forEach(function (r) { piece(r[0], 'head', r[1], null, HEAD[r[0]]); });
  [
    ['wear_face_shades', [['Charcoal', 'Lens'], ['Red', 'Lens'], ['White', 'Navy']], EYES_F],
    ['wear_face_starshades', [['Pink'], ['Gold'], ['Sky']], EYES_F],
    ['wear_face_paint', [['Pink'], ['Gold'], ['Sky']]],
    ['wear_face_goggles', [['Orange', 'Glass'], ['Lime', 'Lens'], ['Blue', 'Glass']], EYES_F]
  ].forEach(function (r) { piece(r[0], 'face', r[1], r[2], FACE[r[0]]); });
  [
    ['wear_neck_scarf', [['Red', 'Sunny'], ['Navy', 'Sky'], ['Teal', 'Pink']]],
    ['wear_neck_bowtie', [['Red'], ['Navy'], ['Pink']]],
    ['wear_neck_bandana', [['Red', 'White'], ['Blue', 'White'], ['Green', 'Sunny']]],
    ['wear_neck_charm', [['Gold'], ['Silver']]],
    ['wear_treetop_harness', [['Orange', 'Gold'], ['Teal', 'Silver']]],
    ['wear_sig_whistle', [['Sunny', 'Red']]],
    ['wear_sig_binocs', [['Moss', 'Charcoal']]]
  ].forEach(function (r) { piece(r[0], 'neck', r[1], null, NECK[r[0]]); });
  [
    ['wear_back_pack', [['Red', 'Sunny'], ['Blue', 'Lime'], ['Purple', 'Pink']]],
    ['wear_back_cape', [['Red', 'Gold'], ['Navy', 'Sky'], ['Purple', 'Pink']]],
    ['wear_back_wings', [['Pink', 'Sky', 'Charcoal'], ['Sky', 'Sunny', 'Charcoal'], ['Sunny', 'Orange', 'Charcoal']]],
    ['wear_back_guitar', [['Red', 'Wood'], ['Sky', 'Wood']]],
    ['wear_back_skate', [['Lime', 'Navy'], ['Pink', 'White'], ['Orange', 'Charcoal']]],
    ['wear_back_jetpack', [['Silver', 'Sky', 'Pink'], ['Lime', 'Lilac', 'Sky']]],
    ['wear_pier_surfboard', [['Sky', 'White'], ['Coral', 'Sunny'], ['Mint', 'Navy']]],
    ['wear_jungle_parrot', [['Red', 'Blue', 'Sunny'], ['Blue', 'Sunny', 'Green'], ['Green', 'Red', 'Sunny']]],
    ['wear_treetop_leafcape', [['Leaf', 'Moss'], ['Orange', 'Brown']]],
    ['wear_castle_cloak', [['Red'], ['Navy']]],
    ['wear_sig_gadgetpack', [['Teal', 'Orange']]]
  ].forEach(function (r) { piece(r[0], 'back', r[1], null, BACK[r[0]]); });
  [
    ['wear_free_spark', [['Pink']]],
    ['wear_hand_mic', [['Gold'], ['Pink']]],
    ['wear_hand_balloon', [['Red'], ['Sky'], ['Sunny'], ['Pink']]],
    ['wear_hand_icecream', [['Pink', 'Cream'], ['Mint', 'Pink'], ['Choc', 'Cream']]],
    ['wear_hand_lantern', [['Charcoal'], ['Red']]],
    ['wear_hand_poms', [['Pink', 'White'], ['Sky', 'White'], ['Sunny', 'Orange']]],
    ['wear_hand_umbrella', [['Red', 'White'], ['Sunny', 'Navy'], ['Lilac', 'Pink']]],
    ['wear_hand_kite', [['Red', 'Sunny', 'Sky'], ['Sky', 'White', 'Pink'], ['Lime', 'Purple', 'Sunny']]],
    ['wear_castle_banner', [['Red', 'Sunny'], ['Blue', 'White'], ['Purple', 'Gold']]],
    ['wear_sig_ball', [['White', 'Charcoal']]],
    ['wear_sig_map', [['Cream', 'Green', 'Red']]]
  ].forEach(function (r) { piece(r[0], 'hand', r[1], r[0] === 'wear_free_spark' ? { member: true } : null, HAND[r[0]]); });
  PIECES.wear_head_phones.flags.ears = PIECES.wear_ice_earmuffs.flags.ears = true;
  PIECES.wear_sig_helmet.flags.bones = ['visor'];
  ['wear_back_cape', 'wear_treetop_leafcape', 'wear_castle_cloak'].forEach(function (id) { PIECES[id].flags.bones = ['cape0', 'cape1', 'cape2']; });
  PIECES.wear_sig_gadgetpack.flags.bones = ['antenna'];
  PIECES.wear_hand_poms.flags.handL = true;
  var IDS = Object.keys(PIECES);
  Object.keys(PIECES).forEach(function (id) { var p = PIECES[id]; p.bones = p.flags.bones || []; });

  /* ================================================================
     THE PUBLIC BUILDERS
     ================================================================ */
  function colourway(id, n) {
    var p = PIECES[id];
    if (!p) return [];
    var c = p.cw[int(n) && n >= 0 && n < p.cw.length ? n : 0];
    return c.map(function (name) { return tk(name); });
  }
  function empty() { return hidden({}, { omit: function () { return false; }, coversEyes: false, earsHidden: false, hideKippah: false, spark: false, joints: {}, parents: {}, fit: {} }); }
  function build(id, look, o) {
    var p = PIECES[id];
    if (!p) return empty();
    var x = new Ctx({ id: id, slot: p.slot, cw: p.cw, flags: p.flags }, look, o);
    BUILD[id](x);
    var list = x.done();
    return o && o.tier ? keep(list, Bd().lodFilter(list, o.tier)) : list;
  }
  /* the hidden fields carried over to a filtered or merged list */
  var FIELDS = ['omit', 'coversEyes', 'earsHidden', 'hideKippah', 'spark', 'joints', 'parents', 'fit'];
  function keep(from, to) { var f = {}; FIELDS.forEach(function (k) { f[k] = from[k]; }); return hidden(to, f); }
  function dress(look, show, vr, o) {
    o = o || {};
    var B = Bd(), parts = [], cvr = vr && typeof vr === 'object' ? vr : {};
    SLOTS.forEach(function (slot) {
      var id = show && show[slot];
      if (slot === 'hand' && !PIECES[id]) id = 'wear_free_spark';
      var p = PIECES[id];
      if (p && p.slot === slot) parts.push(build(id, look, { cw: cvr[id], member: o.member, tier: o.tier }));
    });
    var out = B.merge.apply(null, parts), joints = {}, parents = {};
    parts.forEach(function (l) { Object.assign(joints, l.joints); Object.assign(parents, l.parents); });
    return hidden(out, {
      omit: function (i, j, k) { return parts.some(function (l) { return l.omit(i, j, k); }); },
      coversEyes: parts.some(function (l) { return l.coversEyes; }), earsHidden: parts.some(function (l) { return l.earsHidden; }),
      hideKippah: parts.some(function (l) { return l.hideKippah; }), spark: parts.some(function (l) { return l.spark; }),
      joints: joints, parents: parents, fit: {}
    });
  }
  /* the Fitting Friend wearing one piece; a dye: the Friend with shoulder waves in its colour */
  var DISPLAY_LOOK = { sk: 4, ey: 0, ec: 0, hs: 0, hc: 1, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 0, bd: 1, ht: 0 };
  function display(id, o) {
    var B = Bd(), ff = B.fittingFriend({ tier: o && o.tier }), d = DYE_BY[id];
    if (d) {
      var hl = Hr().hair({ hs: 12, hc: d.hc, ht: 0 });
      return keep(empty(), B.merge(ff, o && o.tier ? B.lodFilter(hl, o.tier) : hl));
    }
    if (!PIECES[id]) return keep(empty(), ff);
    var p = build(id, DISPLAY_LOOK, o);
    return keep(p, B.merge(ff, p));
  }
  function cut(id, look) { var l = build(id, look); return l.fit.cut == null ? null : l.fit.cut; }
  function fitOf(id, look) { var l = build(id, look), f = l.fit; return { crown: f.crown || null, cut: f.cut == null ? null : f.cut, kz: f.kz == null ? null : f.kz, ear: f.ear || null, back: f.back == null ? null : f.back, top: f.top || null }; }

  [CAPS, BUDGET, BONES, COLOURS, GLOWS, TOKENS, SLOTS].forEach(Object.freeze);
  DYES.forEach(Object.freeze); Object.freeze(DYES);
  IDS.forEach(function (id) { Object.freeze(PIECES[id].flags); Object.freeze(PIECES[id]); });
  return {
    VERSION: VERSION, GC: GC, SLOTS: SLOTS, CAPS: CAPS, BUDGET: BUDGET, BONES: BONES, IDS: IDS, DYE_IDS: DYES.map(function (d) { return d.id; }), DYES: DYES,
    PIECES: PIECES, COLOURS: COLOURS, TOKENS: TOKENS, hexOf: hexOf, shadeHex: shadeHex, colourway: colourway,
    build: build, dress: dress, display: display, cut: cut, fitOf: fitOf
  };
}));
