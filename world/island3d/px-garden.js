/* ================================================================
   My Island v3 — SLPxGarden: the Pixel Blocks garden (W2.1; voxel-engine PX1 + PX2).
   window.SLPxGarden in the browser (it registers through SL3D.defineVox('garden', factory)),
   module.exports in Node: {IDS, TOKENS, voxels: {<id>: fn(st, o) → VoxModel}, factory, …}.
   The 20 ids of the garden / lights / flags shelves, as pure voxel data (no THREE, no DOM):
     organic   tree_oak tree_pine tree_apple tree_blossom tree_palm
               flower_tulip flower_daisy flower_sun bush_rose rock_mossy
     props     lantern mushroom_glow flag_pole bunting bench sandcastle umbrella snowman
     landmarks windmill lighthouse                      (LOOK kind 'landmark', 2.2 u and 2.8 u)

   GRAIN (D11): tree canopies G4 (0.25 u); trunks, props and towers G8; flower heads, ropes,
   cloth, dots and trims G16. A model mixes grids as layers; each layer meshes on its own.
   Item space as the kit: base y = 0, pivot at the footprint centre, facing +z. Everything
   below y 1.0 stays inside the 0.875 u cell fit (7 G8 voxels); only canopies, the flag cloth
   and the windmill's sails overhang, above y 1.0.
   COLOUR: palette tokens only (PALETTE_V3, the v2 tables, and the mockup colours this file
   registers through SLIslandLook.addTokens('px-garden', TOKENS), D50). One colour per voxel.
   LOW (D71): organic ids tag their detail voxels lod 'mid' (extra flowers, apples, roses,
   specks), so tier LOW meets TRIS_CAPS_LOW (tree 300, flower 120, bush / rock / mushroom 200).
   The flower patches mesh without corner AO (their one-voxel stems would shatter into quads)
   and bring their own lod1 (two or three plain flowers): halving a G16 patch costs more than
   it saves. Every id also meets its cap with every face kept (photocards, 'vox-full').
   LIT PARTS (D51): the lantern's lamp box, the mushrooms' crowns and the lighthouse lamp room
   are glow-mode state parts {key 'lit', off, on} on the 'glow' pivot; a.state('lit', 0..1) is
   all a toggle costs. The lighthouse beam is two stepped glow cones on 'beam', authored at
   1 / BEAM_SCALE inside the lamp room (it never inflates the bounds that frame photocards)
   and scaled up only while lit: no additive program.
   FLAGS: no CPU cloth. The flag is four hinge segments on chained pivots flag0 → flag3 under
   'flag'; the bunting's seven pennants hang on p0 – p6 under 'flag'.
   CULLING: organic decor keeps every side ('-y' dropped). The windmill keeps '-y' (its sails
   turn about z) and the lighthouse keeps every face (2.8 u tall, and its beam turns in yaw).

   HANDLERS — the v2 contract minus build() and material(): {voxels(st, ctx), idle(a), act(a,
   name) → Act | null, show(a, k), lit?(a, on), animated(stateKey), forget(uid)}. 'sway' is the
   kit's whole-copy root alias, never a template pivot. Acts take the CATALOG act ('glow' |
   'wave' | 'spin') or the SLMotion name and play its timeline and cues (reduced motion: the
   end state at once). Lamps also come on with the night mix (show k), whatever their tap
   memory. Rates: the flag at ART3.FREQS.flagFlutter, pennants at the LOOK idle (0.8 Hz), lit
   lamps swell once per beat (≤ 1.97 Hz, ±12% scale, never a flash). No path here reads or
   writes points.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SLPxGarden = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('garden', api.factory);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var IDS = ['tree_oak', 'tree_pine', 'tree_apple', 'tree_blossom', 'tree_palm',
    'flower_tulip', 'flower_daisy', 'flower_sun', 'bush_rose', 'rock_mossy',
    'lantern', 'mushroom_glow', 'flag_pole', 'bunting',
    'bench', 'sandcastle', 'umbrella', 'snowman', 'windmill', 'lighthouse'];
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625;
  var FIT = 0.4375;                  /* half the cell fit: 7 G8 voxels per cell */
  var BEAM_SCALE = 16;               /* the lighthouse beam is authored at 1 / BEAM_SCALE */
  var FLAG_SEGS = 4, PENNANTS = 7;

  /* the mockup's garden colours that PALETTE_V3 does not name (D50) */
  var TOKENS = {
    'PX Garden Oak': '#3FC46A', 'PX Garden Oak Deep': '#2FA35A', 'PX Garden Oak Lit': '#7FE57A',
    'PX Garden Blossom': '#FF9CC6', 'PX Garden Blossom Deep': '#F27FB2', 'PX Garden Blossom Lit': '#FFC2DC',
    'PX Garden Pine': '#2BB486', 'PX Garden Pine Mid': '#38C795', 'PX Garden Pine Lit': '#52D9A8', 'PX Garden Pine Tip': '#7BE8C0',
    'PX Garden Palm': '#D9A066', 'PX Garden Palm Band': '#C08550', 'PX Garden Frond': '#4ED36A', 'PX Garden Frond Deep': '#3FC45F',
    'PX Garden Frond Lit': '#8BEA6E', 'PX Garden Stem': '#3FBF63', 'PX Garden Stem Lit': '#55D277', 'PX Garden Apple': '#FF4D5E',
    'PX Garden Slate': '#5B5F9E', 'PX Garden Slate Lit': '#6A6FB0', 'PX Garden Hot Pink': '#FF5FA2',
    'PX Garden Sand': '#FFD98C', 'PX Garden Sand Deep': '#FFCF73', 'PX Garden Cap Deep': '#8E55C9', 'PX Garden Seed': '#7A4A2B'
  };

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function vox() {
    var V = sibling('SLVox', './vox.js');
    if (!V) throw new Error('SLPxGarden: vox.js (SLVox) is not loaded');
    return V;
  }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function motion() { return sibling('SLMotion', './motion.js'); }
  var tokensDone = false;
  /* register TOKENS once the look is there (repeating it is a no-op; refusals are the look's QA) */
  function ensureTokens() {
    var L = look();
    if (tokensDone || !L || typeof L.addTokens !== 'function') return;
    L.addTokens('px-garden', TOKENS);
    tokensDone = true;
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ================================================================
     MODEL ASSEMBLY
     ================================================================ */
  /* a builder grid: odd (voxel 0 centred on the pivot) or even (voxels −1 and 0 straddle it) */
  function grid(g, even) { return vox().grid({ grid: g, origin: even ? [0, 0, 0] : [0.5, 0, 0.5] }); }
  /* item metres → the root frame's voxel coordinates (G8, origin [0.5, 0, 0.5]) */
  function at3(p) { return [p[0] / G8, p[1] / G8 - 0.5, p[2] / G8]; }
  /* layers: [Grid | {vox: Grid, at: [x, y, z] u}]; meta: {pal, pivots {name: [x, y, z] | {at, parent}},
     anchors {name: [x, y, z] | {at, pivot}}, cull, ao} — pivots and anchors in item metres */
  function pack(id, layers, meta) {
    ensureTokens();
    var m = { id: id, grid: G8, origin: [0.5, 0, 0.5], palette: meta.pal, layers: [], pivots: {}, anchors: {}, decals: [] };
    layers.forEach(function (ly, li) {
      var g = ly.vox || ly, out = { vox: g.snapshot() };
      if (ly.at) out.at = ly.at.slice();
      m.layers.push(out);
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = li; m.decals.push(c); });
    });
    Object.keys(meta.pivots || {}).forEach(function (n) {
      var p = meta.pivots[n], arr = Array.isArray(p);
      m.pivots[n] = { at: at3(arr ? p : p.at), parent: arr ? null : p.parent || null };
    });
    Object.keys(meta.anchors || {}).forEach(function (n) {
      var a = meta.anchors[n];
      m.anchors[n] = Array.isArray(a) ? at3(a) : { at: at3(a.at), pivot: a.pivot };
    });
    if (meta.cull) m.cull = meta.cull.slice();
    if (meta.ao === false) m.ao = false;
    return m;
  }
  /* one horizontal row of a stepped round mass on an odd grid, centred on (ci, ck): 's3' 3×3 ·
     'r5' 5×5 less its corners · 'o7' 7×7 less a triangle of 3 at each corner; c may be
     fn(i, j, k) of the offsets from the centre */
  function row(o, j, shape, c, ci, ck) {
    var r = shape === 'o7' ? 3 : shape === 'r5' ? 2 : 1, lim = shape === 'o7' ? 4 : shape === 'r5' ? 3 : 2;
    ci = ci || 0; ck = ck || 0;
    for (var k = -r; k <= r; k++) for (var i = -r; i <= r; i++) {
      if (Math.abs(i) + Math.abs(k) <= lim) o.set(ci + i, j, ck + k, typeof c === 'function' ? c(i, j, k) : c);
    }
    return o;
  }
  function each(list, fn) { list.forEach(function (q) { fn(q[0], q[1], q[2], q[3]); }); }

  /* ================================================================
     TREES — a G8 trunk under G4 canopy rows (never wider than 3 below y 1.0)
     ================================================================ */
  function trunk(h, c, flare) {
    var t = grid(G8, true);
    t.box(-1, 0, 0, h - 1, -1, 0, c);
    if (flare) { t.box(-2, 1, 0, 0, -1, 0, flare); t.box(-1, 0, 0, 0, -2, 1, flare); }
    return t;
  }
  /* a big leafy oak: a thick-set crown of four rows in three greens with lit dabs, a low G8
     cap and a flared trunk */
  function treeOak() {
    var t = trunk(4, 'b', 'B'), c = grid(G4), d = grid(G8, true);
    row(c, 2, 's3', 'd'); row(c, 3, 's3', 'm'); row(c, 4, 'r5', 'm'); row(c, 5, 'r5', 'l');
    each([[2, 4, 0], [-1, 4, 2], [-2, 4, -1], [1, 4, -2], [0, 3, 1], [-1, 3, -1]], function (i, j, k) { c.set(i, j, k, 'l'); });
    each([[2, 5, 1], [-2, 5, 0], [0, 5, -2], [1, 5, 2]], function (i, j, k) { c.set(i, j, k, 'h'); });
    d.box(-3, 2, 12, 12, -3, 2, 'h');
    each([[-3, -3], [2, -3], [-3, 2], [2, 2]], function (i, k) { d.clear(i, 12, k); });
    return pack('tree_oak', [t, c, d], { pal: {
      b: 'PX Trunk', B: 'PX Tree Bark', d: 'PX Garden Oak Deep', m: 'PX Garden Oak', l: 'PX Leaf', h: 'PX Garden Oak Lit' } });
  }
  /* a round puff in light greens studded with red apples (the catalogue names the colour) */
  function treeApple() {
    var t = trunk(6, 'b'), c = grid(G4), d = grid(G8, true);
    row(c, 3, 's3', 'd'); row(c, 4, 'r5', 'm'); row(c, 5, 's3', 'l');
    /* apples: G8 cubes proud of the canopy on every side and on the shoulders */
    each([[5, 9, 0], [-6, 8, -1], [-1, 9, 5], [1, 8, -6], [-2, 12, 1]], function (i, j, k) { d.set(i, j, k, 'a'); });
    each([[5, 8, -3], [-6, 9, 2], [3, 9, 5], [-3, 9, -6]], function (i, j, k) { d.set(i, j, k, 'A'); });
    return pack('tree_apple', [t, c, d], { pal: {
      b: 'PX Trunk', d: 'PX Leaf 2', m: 'PX Leaf', l: 'PX Leaf Lit', a: 'PX Garden Apple', A: { token: 'PX Garden Apple', lod: 'mid' } } });
  }
  /* a wide, flat-topped cloud of blossom in three pinks, white specks and fallen petals */
  function treeBlossom() {
    var t = trunk(6, 'b'), c = grid(G4), d = grid(G8, true), f = grid(G16);
    row(c, 3, 's3', 'd'); row(c, 4, 'r5', 'm'); row(c, 5, 'r5', 'l');
    each([[5, 10, -2], [-6, 9, 1], [0, 10, 5], [-2, 9, -6], [1, 12, -3], [-3, 12, 2]], function (i, j, k) { d.set(i, j, k, 'w'); });
    each([[-5, 0, 5], [5, 0, 4], [1, 0, 6], [-6, 0, -3]], function (i, j, k) { f.set(i, j, k, 'p'); });
    return pack('tree_blossom', [t, c, d, f], { pal: {
      b: 'PX Trunk', d: 'PX Garden Blossom Deep', m: 'PX Garden Blossom', l: 'PX Garden Blossom Lit',
      w: { token: 'Cloud White', lod: 'mid' }, p: { token: 'PX Garden Blossom Lit', lod: 'mid' } } });
  }
  /* a plain stepped fir: skirts of 3 and 2 G4 voxels (two half-offset layers) in teal greens */
  function treePine() {
    var t = trunk(4, 'b'), odd = grid(G4), even = grid(G4, true), y0 = 0.5;
    function skirt(i, j, k) { return Math.abs(i) + Math.abs(k) === 2 ? 'c' : 'a'; }
    row(odd, 0, 's3', skirt); even.box(-1, 0, 1, 1, -1, 0, 'c');
    row(odd, 2, 's3', skirt); even.box(-1, 0, 3, 3, -1, 0, 'e');
    odd.set(0, 4, 0, 'f');
    return pack('tree_pine', [t, { vox: odd, at: [0, y0, 0] }, { vox: even, at: [0, y0, 0] }], { pal: {
      b: 'PX Trunk', a: 'PX Garden Pine', c: 'PX Garden Pine Mid', e: 'PX Garden Pine Lit', f: 'PX Garden Pine Tip' } });
  }
  /* a palm: a banded trunk leaning one G8 voxel every four, a crown of eight fronds (the four
     long ones droop) and three coconuts */
  function treePalm() {
    var t = grid(G8, true), c = grid(G4), j, n;
    for (j = 0; j < 12; j++) { var off = (j >> 2) - 2; t.box(off, off + 1, j, j, -1, 0, (j >> 1) & 1 ? 'q' : 'p'); }
    each([[2, 11, -1], [-1, 11, 0], [0, 11, -2]], function (i, jj, k) { t.set(i, jj, k, 'k'); });
    c.set(0, 6, 0, 'g'); c.set(0, 7, 0, 't');
    var dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (n = 0; n < 8; n++) {
      var dx = dirs[n][0], dz = dirs[n][1];
      if (dx && dz) { c.set(dx, 6, dz, 'l'); continue; }
      c.set(dx, 6, dz, 'f'); c.set(dx * 2, 6, dz * 2, 'g'); c.set(dx * 2, 5, dz * 2, 'l');
    }
    return pack('tree_palm', [t, { vox: c, at: [0.125, 0, 0] }], { pal: {
      p: 'PX Garden Palm', q: 'PX Garden Palm Band', k: 'PX Jungle Bark', f: 'PX Garden Frond', g: 'PX Garden Frond Deep',
      t: 'PX Garden Oak Lit', l: 'PX Garden Frond Lit' } });
  }

  /* ================================================================
     FLOWERS, ROSE BUSH, MOSSY ROCK — G16 heads on G16 stems; G8 masses
     ================================================================ */
  /* a tulip: a stem, then a 3×3×2 cup with two raised lips (the notched top) in the lip char
     (none: a closed bud) */
  function tulip(o, ci, ck, h, stem, cup, alongZ, lip) {
    o.box(ci, ci, 0, h - 1, ck, ck, stem);
    o.box(ci - 1, ci + 1, h, h + 1, ck - 1, ck + 1, cup);
    if (!lip) return;
    if (alongZ) { o.box(ci - 1, ci - 1, h + 2, h + 2, ck - 1, ck + 1, lip); o.box(ci + 1, ci + 1, h + 2, h + 2, ck - 1, ck + 1, lip); }
    else { o.box(ci - 1, ci + 1, h + 2, h + 2, ck - 1, ck - 1, lip); o.box(ci - 1, ci + 1, h + 2, h + 2, ck + 1, ck + 1, lip); }
  }
  var STEMS = { s: 'PX Garden Stem', S: { token: 'PX Garden Stem', lod: 'mid' }, l: 'PX Garden Stem Lit', L: { token: 'PX Garden Stem Lit', lod: 'mid' } };
  function pal(extra) { var p = {}, k; for (k in STEMS) p[k] = STEMS[k]; for (k in extra) p[k] = extra[k]; return p; }
  /* four open tulips round a tall closed bud, with leaves at their feet (three flowers at LOW).
     lite = the LOD1 patch (the handler's lod1): three buds */
  function flowerTulip(lite) {
    var o = grid(G16);
    tulip(o, -4, 2, 4, 's', 'r', true, lite ? null : 'r'); tulip(o, 0, -2, 6, 's', 'y', false, null); tulip(o, 4, 3, 5, 's', 'p', true, lite ? null : 'p');
    if (!lite) {
      tulip(o, 4, -5, 4, 'S', 'R', false, 'R'); tulip(o, -5, -4, 5, 'S', 'P', true, 'P');
      o.box(1, 1, 0, 1, -2, -2, 'l'); o.box(-3, -3, 0, 1, 2, 2, 'L'); o.box(3, 3, 0, 1, 3, 3, 'L');
    }
    return pack('flower_tulip', [o], { ao: false, pal: pal({
      r: 'Tulip Red', y: 'Tulip Yellow', p: 'Tulip Pink', R: { token: 'Tulip Red', lod: 'mid' }, P: { token: 'Tulip Pink', lod: 'mid' } }) });
  }
  /* a daisy: a flat 3×3 white head round a yellow centre, looking up */
  function daisy(o, ci, ck, h, stem, petal, centre) {
    o.box(ci, ci, 0, h - 1, ck, ck, stem);
    o.box(ci - 1, ci + 1, h, h, ck - 1, ck + 1, petal);
    o.set(ci, h, ck, centre);
  }
  function flowerDaisy(lite) {
    var o = grid(G16);
    daisy(o, -4, -3, 4, 's', 'w', 'y'); daisy(o, 0, 1, 5, 's', 'w', 'y');
    if (!lite) {
      daisy(o, 4, -2, 3, 's', 'w', 'y'); daisy(o, -4, 4, 3, 'S', 'W', 'Y'); daisy(o, 4, 4, 4, 'S', 'W', 'Y'); daisy(o, 0, -5, 2, 'S', 'W', 'Y');
      o.box(1, 1, 0, 1, 1, 1, 'L'); o.box(-3, -3, 0, 0, -3, -3, 'L');
    }
    return pack('flower_daisy', [o], { ao: false, pal: pal({
      w: 'Cloud White', y: 'PX Sunny', W: { token: 'Cloud White', lod: 'mid' }, Y: { token: 'PX Sunny', lod: 'mid' } }) });
  }
  /* two sunflowers: 5×5 heads (yellow ring, seed centre) one voxel thick on head0 / head1 */
  var SUNS = [{ i: -3, k: -1, h: 9 }, { i: 3, k: 2, h: 6 }];
  function flowerSun(lite) {
    var o = grid(G16), pivots = {};
    SUNS.forEach(function (s, n) {
      var side = n ? -1 : 1;
      o.box(s.i, s.i, 0, s.h, s.k, s.k, 's');
      if (!lite) { o.box(s.i + side, s.i + side, 0, 2, s.k, s.k, n ? 'L' : 'l'); o.set(s.i - side, 4, s.k, 'L'); }
      o.group('head' + n, function () {
        for (var b = -2; b <= 2; b++) for (var a = -2; a <= 2; a++) {
          if (Math.abs(a) + Math.abs(b) <= 3) o.set(s.i + a, s.h + 1 + b, s.k + 1, Math.abs(a) <= 1 && Math.abs(b) <= 1 ? 'n' : 'y');
        }
      });
      pivots['head' + n] = [s.i * G16, (s.h + 1.5) * G16, (s.k + 0.5) * G16];
    });
    return pack('flower_sun', [o], { ao: false, pivots: pivots, pal: pal({ y: 'Sunflower', n: 'PX Garden Seed' }) });
  }
  /* a round bush in two greens with roses: 2×2 G16 buds proud of the leaves */
  function bushRose() {
    var b = grid(G8, true), r = grid(G16, true);
    b.blob(-0.5, 1.5, -0.5, 3.2, 2.4, 3.2, function (i, j) { return j >= 2 ? 'g' : 'd'; }, 3);
    function rose(i, j, k, c, w, h, d) { r.box(i, i + w - 1, j, j + h - 1, k, k + d - 1, c); }
    rose(-1, 8, -1, 'a', 2, 2, 2); rose(2, 8, 2, 'b', 2, 2, 2); rose(-4, 8, -4, 'c', 2, 2, 2);
    rose(6, 4, 0, 'b', 1, 2, 2); rose(-3, 3, 6, 'c', 2, 2, 1); rose(-7, 4, -2, 'a', 1, 2, 2);
    rose(2, 8, -4, 'B', 2, 2, 2); rose(-4, 8, 2, 'C', 2, 2, 2); rose(1, 4, -7, 'A', 2, 2, 1); rose(2, 4, 6, 'A', 2, 2, 1);
    return pack('bush_rose', [b, r], { pal: {
      d: 'PX Leaf 2', g: 'PX Leaf', a: 'Rose', b: 'Rose Deep', c: 'Rose Pale',
      A: { token: 'Rose', lod: 'mid' }, B: { token: 'Rose Deep', lod: 'mid' }, C: { token: 'Rose Pale', lod: 'mid' } } });
  }
  /* a stepped boulder in two hashed stone tones under a moss cap, with a pebble (no face) */
  function rockMossy() {
    var o = grid(G8), m = grid(G16, true);
    for (var k = -2; k <= 2; k++) for (var i = -3; i <= 3; i++) {
      var d = Math.abs(i) + Math.abs(k);
      if (d <= 4) o.set(i, 0, k, 'r');
      if (d <= 3 && i < 3 && k < 2) o.set(i, 1, k, 'r');
      if (d <= 2 && i < 2 && i > -3 && k < 2 && k > -2) o.set(i, 2, k, 'm');
    }
    o.hashTone('r', 'R', 0.35, 'rock_mossy').hashTone('r', 'h', 0.25, 'rock_light');
    /* moss: the top step, a spill onto one shoulder, and G16 tufts and a drip (MID / HIGH) */
    each([[-2, 1, -1], [-2, 1, 0], [0, 1, -2]], function (a, b, c) { o.set(a, b, c, 'm'); });
    m.box(-2, -1, 6, 6, -1, 0, 'n'); m.box(1, 2, 6, 6, 1, 1, 'n'); m.box(-1, 0, 2, 3, 4, 4, 'n');
    return pack('rock_mossy', [o, m], { pal: {
      r: 'PX Castle Stone 2', R: 'PX Castle Stone Shade', h: 'PX Castle Stone', m: 'Moss', n: { token: 'PX Leaf Lit', lod: 'mid' } } });
  }

  /* ================================================================
     LIGHTS — the lit part is a glow-mode state part on the 'glow' pivot (D51)
     ================================================================ */
  function lit(off, on) { return { token: on, mode: 'glow', state: { key: 'lit', off: off, on: on }, pivot: 'glow' }; }
  /* the mockup's short garden lantern (1.0 u, D33): slate foot and post, a warm lamp box
     between pink corner posts, a stepped pink roof and a gold finial */
  function lantern() {
    var o = grid(G8);
    row(o, 0, 's3', 'f'); o.box(0, 0, 1, 2, 0, 0, 'p');
    o.box(-1, 1, 3, 4, -1, 1, function (i, j, k) { return Math.abs(i) === 1 && Math.abs(k) === 1 ? 'c' : 'g'; });
    row(o, 5, 'r5', 'r'); row(o, 6, 's3', 'R'); o.set(0, 7, 0, 'y');
    return pack('lantern', [o], {
      pivots: { glow: [0, 0.5, 0] }, anchors: { glow: [0, 0.5, 0] },
      pal: { f: 'PX Garden Slate', p: 'PX Garden Slate Lit', c: { token: 'PX Candy Pink', pivot: 'glow' }, g: lit('PX Lamp Off', 'PX Lamp Warm'),
        r: 'PX Garden Hot Pink', R: 'PX Candy Pink', y: 'PX Sunny' } });
  }
  /* two toadstools: violet stepped caps with white spots on cream stems; the crowns are the lit
     part (violet by day, cyan lit) */
  function mushroomGlow() {
    var o = grid(G8), s = grid(G8, true), d = grid(G16, true);
    row(o, 2, 'r5', 'C', -1, -1); row(o, 3, 's3', 'c', -1, -1);
    s.box(-2, -1, 0, 1, -2, -1, 't');
    o.set(2, 0, 2, 't'); row(o, 1, 's3', 'C', 2, 2); o.set(2, 2, 2, 'c');
    function spot(i, j, k, c) { d.box(i, i + 1, j, j, k, k + 1, c); }
    spot(-4, 8, -3, 'w'); spot(-1, 8, -1, 'w'); spot(-7, 6, 0, 'w'); spot(1, 6, -4, 'W'); spot(-3, 6, 2, 'W'); spot(5, 4, 5, 'w');
    return pack('mushroom_glow', [o, s, d], {
      pivots: { glow: [-0.125, 0.375, -0.125] }, anchors: { glow: [-0.125, 0.45, -0.125] },
      pal: { t: 'Stem Cream', c: lit('Cap Violet', 'LED Cyan'), C: { token: 'PX Garden Cap Deep', pivot: 'glow' },
        w: { token: 'Cloud White', pivot: 'glow' }, W: { token: 'Cloud White', pivot: 'glow', lod: 'mid' } } });
  }

  /* ================================================================
     FLAGS — hinge pivots, no CPU cloth
     ================================================================ */
  var FLAG = { x0: -0.1875, w: 12, h: 8, j0: 21, seg: 3 };          /* the cloth: G16 columns from the hoist */
  FLAG.cy = (FLAG.j0 + FLAG.h / 2) * G16;
  function flagPole() {
    var p = grid(G8), c = vox().grid({ grid: G16, origin: [0, 0, 0.5] }), pivots = { flag: [FLAG.x0, FLAG.cy, 0] };
    row(p, 0, 's3', 'f', -2, 0); p.box(-2, -2, 1, 13, 0, 0, 'p'); p.set(-2, 14, 0, 'y');
    for (var s = 0; s < FLAG_SEGS; s++) {
      (function (s) {
        c.group('flag' + s, function () {
          for (var a = 0; a < FLAG.seg; a++) for (var b = 0; b < FLAG.h; b++) {
            var col = s * FLAG.seg + a;
            c.set(-3 + col, FLAG.j0 + b, 0, Math.abs(col - 5.5) + Math.abs(b - 3.5) <= 2.5 ? 'd' : 'c');
          }
        });
        pivots['flag' + s] = { at: [FLAG.x0 + s * FLAG.seg * G16, FLAG.cy, 0], parent: s ? 'flag' + (s - 1) : 'flag' };
      }(s));
    }
    return pack('flag_pole', [p, c], { pivots: pivots, anchors: { flag: [FLAG.x0 + FLAG.w * G16 / 2, FLAG.cy, 0] },
      pal: { f: 'PX Garden Slate', p: 'Cloud White', y: 'PX Sunny', c: 'PX Coral', d: 'PX Sunny' } });
  }
  /* bunting: two posts, a sagging rope and seven rainbow pennants, each on its own hinge */
  var BUNT_ROPE = 13;
  function ropeJ(i) { var u = (i + 0.5) / 7; return BUNT_ROPE - Math.round(2 * (1 - u * u)); }
  function bunting() {
    var o = vox().grid({ grid: G16, origin: [0, 0, 0.5] }), pivots = { flag: [0, (BUNT_ROPE - 1.5) * G16, 0] }, i;
    [-7, 5].forEach(function (x) { o.box(x, x + 1, 0, 13, -2, -1, 'p'); o.box(x, x + 1, 14, 14, -2, -1, 'k'); });
    for (i = -7; i <= 6; i++) o.set(i, ropeJ(i), 0, 'r');
    for (var n = 0; n < PENNANTS; n++) {
      (function (n) {
        var c0 = -7 + n * 2, top = Math.min(ropeJ(c0), ropeJ(c0 + 1)) - 1, ch = 'abcdefg'[n];
        o.group('p' + n, function () { o.box(c0, c0 + 1, top - 2, top, 0, 0, ch); o.set(c0 + (n % 2), top - 3, 0, ch); });
        pivots['p' + n] = { at: [(c0 + 1) * G16, (top + 1) * G16, 0], parent: 'flag' };
      }(n));
    }
    return pack('bunting', [o], { pivots: pivots, anchors: { flag: [0, (BUNT_ROPE - 2) * G16, 0] },
      pal: { p: 'Cloud White', k: 'PX Candy Pink', r: 'PX Tree Rope', a: 'PX Rainbow 1', b: 'PX Rainbow 2', c: 'PX Rainbow 3',
        d: 'PX Rainbow 4', e: 'PX Rainbow 5', f: 'PX Rainbow 6', g: 'PX Candy Pink' } });
  }

  /* ================================================================
     GARDEN AND BEACH DECOR — static
     ================================================================ */
  /* a chunky bench: plank seat and back (two tones) between slate side frames */
  function bench() {
    var o = grid(G8);
    o.box(-2, 2, 1, 1, 0, 1, function (i, j, k) { return k ? 'a' : 'b'; });
    o.box(-2, 2, 2, 3, -1, -1, function (i, j) { return j === 3 ? 'a' : 'b'; });
    [-3, 3].forEach(function (x) { o.box(x, x, 0, 3, -1, -1, 'f'); o.box(x, x, 0, 2, 1, 1, 'f'); o.set(x, 2, 0, 'f'); o.set(x, 1, 0, 'f'); });
    return pack('bench', [o], { anchors: { seat: [0, 0.27, 0.06] },
      pal: { a: { token: 'PX Tree Plank', mode: 'plank' }, b: { token: 'PX Pier Plank Shade', mode: 'plank' }, f: 'PX Garden Slate' } });
  }
  /* the mockup's sandcastle: a base block, four corner towers, a keep with crenels, a door,
     a pink flag and two shells */
  function sandcastle() {
    var o = grid(G8), d = grid(G16);
    o.box(-3, 3, 0, 1, -2, 2, 'a');
    each([[-3, -2], [3, -2], [-3, 2], [3, 2]], function (i, k) { o.set(i, 2, k, 'b'); });
    o.box(-1, 1, 2, 3, -1, 1, 'a');
    each([[-1, -1], [1, -1], [-1, 1], [1, 1]], function (i, k) { o.set(i, 4, k, 'b'); });
    o.set(0, 0, 2, 'k');
    d.box(0, 0, 8, 11, 0, 0, 'w'); d.box(1, 2, 10, 11, 0, 0, 'p'); d.set(3, 11, 0, 'p');
    d.set(-5, 0, 6, 's'); d.set(4, 0, 6, 's');
    return pack('sandcastle', [o, d], { pal: { a: 'PX Garden Sand', b: 'PX Garden Sand Deep', k: 'Castle Door', w: 'Cloud White',
      p: 'PX Garden Hot Pink', s: 'Blossom Light' } });
  }
  /* a beach umbrella: eight wedges in two colours stepping up to a finial, and a striped towel */
  function umbrella() {
    var o = grid(G8), d = grid(G16, true);
    o.box(0, 0, 0, 8, 0, 0, 'p');
    for (var k = -3; k <= 3; k++) for (var i = -3; i <= 3; i++) {
      var r = Math.max(Math.abs(i), Math.abs(k));
      if (Math.abs(i) + Math.abs(k) > 5) continue;
      o.set(i, r === 0 ? 10 : r === 1 ? 9 : 8, k, r === 0 ? 'y' : Math.floor(Math.atan2(k, i) / (Math.PI / 4) + 8) % 2 ? 'a' : 'b');
    }
    d.box(2, 6, 0, 0, -4, 5, function (i, j, k2) { return (k2 + 4) % 3 === 1 ? 'b' : 't'; });
    return pack('umbrella', [o, d], { pal: { p: 'Cloud White', a: 'PX Coral', b: 'Cloud White', y: 'PX Sunny', t: 'PX Sky Blue' } });
  }
  /* a snowman: three stacked balls, coal eyes and two buttons, a carrot, stick arms, a scarf and a
     top hat (no other face features). The details sit on two G16 layers so that touching
     pieces (hat crown on its brim, the scarf's tail, the twig) leave no AO seams to split quads. */
  function snowman() {
    var o = grid(G8), e = grid(G8, true), d = grid(G16), d2 = grid(G16);
    row(o, 0, 's3', 'S'); row(o, 1, 'r5', 's'); row(o, 2, 's3', 's');
    e.box(-2, 1, 3, 4, -2, 1, 's');
    each([[-2, -2], [1, -2], [-2, 1], [1, 1]], function (i, k) { e.clear(i, 3, k); e.clear(i, 4, k); });
    o.box(-1, 1, 5, 6, -1, 1, 's');
    d.box(-3, 3, 10, 10, -3, 3, 'r'); d2.box(1, 2, 7, 9, 3, 3, 'r');
    d.box(0, 0, 12, 12, 3, 5, 'c'); d2.set(-2, 13, 3, 'k'); d2.set(2, 13, 3, 'k');
    d.set(0, 7, 4, 'k'); d.set(0, 3, 5, 'k');
    d.box(4, 6, 8, 8, 0, 0, 't'); d2.box(6, 6, 9, 10, 0, 0, 't'); d.box(-6, -4, 8, 8, 0, 0, 't'); d2.box(-6, -6, 9, 10, 0, 0, 't');
    d.box(-4, 4, 14, 14, -3, 3, 'h'); d2.box(-2, 2, 15, 16, -2, 2, function (i, j) { return j === 15 ? 'r' : 'h'; });
    return pack('snowman', [o, e, d, d2], { pal: { s: { token: 'PX Ice Snow', mode: 'snow' }, S: { token: 'PX Ice Snow 3', mode: 'snow' },
      h: 'PX Garden Slate', r: 'Tulip Red', c: 'Carrot', k: 'PX Ink Eye', t: 'PX Trunk' } });
  }

  /* ================================================================
     THE TWO PROP LANDMARKS
     ================================================================ */
  var MILL = { hub: [0, 1.5625, 0.40625], arm: 9, sail: [1, 3, 3, 9] };     /* G16: spar length; sail i0..i1, j0..j1 */
  /* a windmill: a two-tone stepped tower with a door, a coral cap and four slatted sails on 'spin' */
  function windmill() {
    var o = grid(G8), s = vox().grid({ grid: G16, origin: [0.5, 0.5, 0.5] }), j, b;
    for (j = 0; j < 4; j++) row(o, j, 'o7', 'a');
    for (j = 4; j < 12; j++) row(o, j, 'r5', 'w');
    row(o, 12, 'r5', 'c'); row(o, 13, 's3', 'c'); o.set(0, 14, 0, 'y');
    o.set(0, 12, 3, 'h');
    o.decal('+z', [-1, 0, 3], [3, 4], 'door:blue');
    o.decal('+z', [0, 8, 2], [1, 1], 'window:round');
    function turn(u, v, c) { s.set(b === 0 ? u : b === 1 ? v : b === 2 ? -u : -v, b === 0 ? v : b === 1 ? -u : b === 2 ? -v : u, 0, c); }
    s.group('spin', function () {
      for (b = 0; b < 4; b++) {
        for (var q = 1; q <= MILL.arm; q++) turn(0, q, 'k');
        for (var v = MILL.sail[2]; v <= MILL.sail[3]; v++) for (var u = MILL.sail[0]; u <= MILL.sail[1]; u++) turn(u, v, v % 2 ? 'w' : 'p');
      }
      s.box(-1, 1, -1, 1, 0, 0, 'y'); s.set(0, 0, 1, 'h');
    });
    return pack('windmill', [o, { vox: s, at: MILL.hub }], { cull: ['-z'], pivots: { spin: MILL.hub }, anchors: { spin: MILL.hub },
      pal: { a: 'PX Lilac Base', w: 'PX Cream Wall', c: 'PX Coral', y: 'PX Sunny', h: 'PX Garden Slate', k: 'PX Trunk', p: 'PX Candy Pink' } });
  }
  var LAMP = [0, 2.3125, 0], BEAM = [[3, 0], [5, 1], [7, 1], [9, 2]];      /* beam dashes: [G8 distance, half-width] */
  /* a red-and-white lighthouse: banded tower, gallery deck, lamp room (state 'lit'), stepped
     roof; the beam is two stepped glow cones of dashes on 'beam', authored collapsed inside
     the lamp room */
  function lighthouse() {
    var o = grid(G8), bm = vox().grid({ grid: G8 / BEAM_SCALE, origin: [0.5, 0.5, 0.5] }), j;
    row(o, 0, 'o7', 'f');
    for (j = 1; j <= 15; j++) row(o, j, 'r5', Math.floor((j - 1) / 3) % 2 ? 'r' : 'w');
    row(o, 16, 'o7', 'f');
    o.box(-1, 1, 17, 19, -1, 1, function (i, jj, k) { return Math.abs(i) === 1 && Math.abs(k) === 1 ? 'c' : 'g'; });
    row(o, 20, 'r5', 'r'); row(o, 21, 's3', 'r'); o.set(0, 22, 0, 'y');
    o.decal('+z', [-1, 1, 2], [3, 4], 'door:red');
    o.decal('+z', [0, 8, 2], [1, 1], 'window:round'); o.decal('+z', [0, 12, 2], [1, 1], 'window:round');
    bm.group('beam', function () {
      /* dashes of light widening either way: a bead, two plus plates, a diamond */
      each(BEAM, function (d, r) {
        for (var b = -r; b <= r; b++) for (var c = -r; c <= r; c++) if (Math.abs(b) + Math.abs(c) <= r) { bm.set(d, b, c, 'L'); bm.set(-d, b, c, 'L'); }
      });
    });
    return pack('lighthouse', [o, { vox: bm, at: LAMP }], { cull: [], pivots: { glow: LAMP, beam: LAMP }, anchors: { glow: LAMP },
      pal: { f: 'PX Garden Slate Lit', w: 'Cloud White', r: 'Tulip Red', c: { token: 'PX Garden Slate', pivot: 'glow' },
        g: lit('PX Lamp Off', 'PX Bulb Warm'), y: 'PX Sunny', L: { token: 'Lamp Halo', mode: 'glow' } } });
  }

  var BUILD = {
    tree_oak: treeOak, tree_pine: treePine, tree_apple: treeApple, tree_blossom: treeBlossom, tree_palm: treePalm,
    flower_tulip: flowerTulip, flower_daisy: flowerDaisy, flower_sun: flowerSun, bush_rose: bushRose, rock_mossy: rockMossy,
    lantern: lantern, mushroom_glow: mushroomGlow, flag_pole: flagPole, bunting: bunting,
    bench: bench, sandcastle: sandcastle, umbrella: umbrella, snowman: snowman, windmill: windmill, lighthouse: lighthouse
  };
  /* voxels[id](st, o) → a fresh VoxModel (pure; every garden id has one look, so st is unused) */
  var voxels = {};
  IDS.forEach(function (id) { voxels[id] = function () { return BUILD[id](); }; });
  /* hand-made LOD1 models where halving the grid would cost more than it saves (the G16 patches) */
  var lod1 = {
    flower_tulip: function () { return flowerTulip(true); }, flower_daisy: function () { return flowerDaisy(true); },
    flower_sun: function () { return flowerSun(true); }
  };

  /* ================================================================
     PURE ANIMATION HELPERS (allocation-free; Node-tested)
     ================================================================ */
  /* idle amplitude ×0.8–1.2 per copy (decorrelated from its phase), so neighbours never sway in step */
  function idleAmp(phase) { var v = (phase || 0) * 9.73 + 0.13; return 0.8 + 0.4 * (v - Math.floor(v)); }
  /* the flag's hinge angles (deg about +y, each relative to the segment before it): a wave
     travelling from the hoist to the fly at hz, whipping harder toward the fly; amp is the
     SLMotion 'flag' amplitude (0.04 idle … 0.12 on a tap). Reduced motion: a flat flag. */
  var FLAG_WAVE = { degPerAmp: 150, lag: 1.1 };
  function flagAngles(t, amp, hz, phase, reduced, out) {
    out = out || [];
    for (var s = 0; s < FLAG_SEGS; s++) {
      out[s] = reduced ? 0 : amp * FLAG_WAVE.degPerAmp * (0.55 + 0.15 * s) * Math.sin(2 * Math.PI * (hz * t + (phase || 0)) - s * FLAG_WAVE.lag);
    }
    return out;
  }
  /* per-pennant swing (deg about x): the LOOK idle with staggered phases, plus the tap ripple */
  function pennantAngles(t, deg, hz, phase, reduced, front, rippleAmp, M, out) {
    out = out || [];
    for (var i = 0; i < PENNANTS; i++) {
      out[i] = M.pennant(t, i, deg, hz, phase, reduced) + (rippleAmp ? M.ripple(i / (PENNANTS - 1), front, rippleAmp) : 0);
    }
    return out;
  }
  /* sunflower heads: tipped up to the sky and drifting ±10° by day, bowed at night (k = the
     Showtime mix); reduced motion keeps the day / night pose without the drift */
  function sunAim(t, k, i, phase, reduced, out) {
    out = out || {};
    out.yaw = reduced ? 0 : 10 * Math.sin(2 * Math.PI * (t / 14 + (phase || 0) + i * 0.27));
    out.pitch = -16 + 30 * clamp01(k || 0);
    return out;
  }
  /* how far the night has come on for lamps: 0 by day, 1 from dusk (k 0.65) on */
  function nightOf(k) { var u = clamp01(((+k || 0) - 0.35) / 0.3); return u * u * (3 - 2 * u); }

  /* ================================================================
     FACTORY — SL3D.defineVox('garden', factory): the handlers of the 20 ids
     ================================================================ */
  function factory() {
    ensureTokens();
    var M = motion(), L = look(), LOOKS = (L && L.LOOK) || {};
    function idleOf(id, dflt) { return (LOOKS[id] && LOOKS[id].idle) || dflt; }

    /* per-copy memory: what a handler last wrote to a copy (lit level, halo, beam, act carry).
       It is dropped when the uid's copy changes (a remount or restyle hands the handle a new
       batch) and when the controller calls forget(uid) as it removes the copy. */
    var PER_COPY = [], copyOf = new Map();
    function perCopy(m) { PER_COPY.push(m); return m; }
    function forget(uid) {
      for (var i = 0; i < PER_COPY.length; i++) PER_COPY[i].delete(uid);
      copyOf.delete(uid);
    }
    function own(a) {
      if (!a || a.uid == null) return;
      var c = a.batch || a.object || a.obj || null;
      if (!c || copyOf.get(a.uid) === c) return;
      forget(a.uid);
      copyOf.set(a.uid, c);
    }

    /* animation-handle helpers (no allocation per frame; every call is skipped when the handle lacks it) */
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1];
    function setPiv(a, name, rx, ry, rz, sx, sy, sz) {
      if (!a || typeof a.pivot !== 'function') return;
      var p = a.pivot(name);
      if (!p || typeof p.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz;
      S3[0] = sx == null ? 1 : sx; S3[1] = sy == null ? S3[0] : sy; S3[2] = sz == null ? S3[0] : sz;
      p.set(R3, P3, S3);
    }
    function setState(a, key, v) { if (a && typeof a.state === 'function') a.state(key, v); }
    function sfx(a, name, vol, step) { if (a && typeof a.sfx === 'function') a.sfx(name, vol == null ? 1 : vol, step); }
    function emit(a, kind, pos, n, opts) { if (a && typeof a.emit === 'function') a.emit(kind, pos, n, opts); }
    function showOf(a) { return a ? clamp01(+a.show || 0) : 0; }

    /* acts: SLMotion timelines with cue playback; an interrupted act hands its pose to its restart */
    var carry = perCopy(new Map()), running = perCopy(new Map());
    function busy(a) {
      var r = running.get(a.uid);
      if (r && typeof a.t === 'number' && a.t > r.end) { running.delete(a.uid); return false; }
      return !!r;
    }
    function runAct(a, name, apply, o) {
      if (!M || !M.ACTS[name] || !a) return null;
      o = o || {};
      var uid = a.uid, c = carry.get(uid), opt = { reduced: !!a.reduced, from: c && c.name === name ? c.pose : null };
      carry.delete(uid);
      var dur = M.durOf(name, opt), cues = M.cues(name, opt), ci = 0, pose = {}, done = false;
      var me = { name: name, end: (typeof a.t === 'number' ? a.t : 0) + dur + 1 };
      running.set(uid, me);
      function stop() { done = true; if (running.get(uid) === me) running.delete(uid); }
      return {
        dur: dur, name: name,
        update: function (a2, tAct) {
          if (done) return false;
          a2 = a2 || a;
          M.sample(name, tAct, pose, opt);
          for (; ci < cues.length && cues[ci].t <= tAct; ci++) {
            var cue = cues[ci];
            if (cue.sfx && o.sfx !== false) sfx(a2, cue.sfx, cue.vol, cue.step);
            if (cue.emit) emit(a2, cue.emit, 'top', cue.n || 1);
          }
          apply(a2, pose, tAct);
          if (tAct >= dur) { stop(); if (o.end) o.end(a2, pose); return false; }
          return true;
        },
        cancel: function () {
          if (done) return;
          carry.set(uid, { name: name, pose: M.carry(name, pose) });
          stop();
          if (o.end) o.end(a, pose);
        }
      };
    }
    var models = {};
    function none() { return null; }
    function noop() {}
    function still() { return false; }

    /* ---------------- trees and plants: the idle sways or bobs the whole copy ---------------- */
    function swayIdle(id, dflt) {
      var idl = idleOf(id, dflt), sw = {};
      return function (a) {
        if (!M || !a) return false;
        M.sway(a.t, idl.deg * idleAmp(a.phase), idl.period, a.phase, a.reduced, sw);
        setPiv(a, 'sway', sw.x, 0, sw.z);
      };
    }
    function bobIdle(id) {
      var idl = idleOf(id, { pct: 2, period: 2.4 });
      return function (a) {
        if (!M || !a) return false;
        var s = M.bob(a.t, idl.pct * idleAmp(a.phase), idl.period, a.phase, a.reduced), w = 1 + (s - 1) * 0.5;
        setPiv(a, 'sway', 0, 0, 0, w, s, w);
      };
    }
    function plant(id, idle) { models[id] = { idle: idle, act: none, show: noop }; }
    plant('tree_oak', swayIdle('tree_oak', { deg: 1.5, period: 4.2 }));
    plant('tree_apple', swayIdle('tree_apple', { deg: 1.5, period: 4.2 }));
    plant('tree_pine', swayIdle('tree_pine', { deg: 1, period: 5 }));
    plant('tree_palm', swayIdle('tree_palm', { deg: 3, period: 3.6 }));
    /* blossom petals drift down through the fx pool (one every 1.0–1.6 s, at most 40 alive) */
    var blossomSway = swayIdle('tree_blossom', { deg: 1.5, period: 4.2 }), petalLast = perCopy(new Map()), PETAL = [0, 0, 0], petalOpts = null, ev = {};
    plant('tree_blossom', function (a) {
      if (!M || !a) return false;
      blossomSway(a);
      if (a.reduced || typeof a.emit !== 'function') return;
      M.every(a.t, 1.0, 1.6, (((a.phase || 0) * 4294967296) >>> 0) ^ 0x5bd1e995, ev);
      if (ev.since < 0 || ev.since > 0.5 || petalLast.get(a.uid) === ev.n) return;
      petalLast.set(a.uid, ev.n);
      var ang = ev.n * 2.39996 + (a.phase || 0) * 6.2832;
      PETAL[0] = Math.cos(ang) * 0.45; PETAL[1] = 1.0; PETAL[2] = Math.sin(ang) * 0.45;
      petalOpts = petalOpts || { token: (LOOKS.tree_blossom && LOOKS.tree_blossom.colors.petal) || 'Blossom Light', cell: 'petal', max: 40 };
      emit(a, 'petal', PETAL, 1, petalOpts);
    });
    plant('flower_tulip', bobIdle('flower_tulip'));
    plant('flower_daisy', bobIdle('flower_daisy'));
    plant('bush_rose', bobIdle('bush_rose'));
    var sunBob = bobIdle('flower_sun'), aim = {};
    plant('flower_sun', function (a) {
      if (!M || !a) return false;
      sunBob(a);
      for (var i = 0; i < SUNS.length; i++) {
        sunAim(a.t, showOf(a), i, a.phase, a.reduced, aim);
        setPiv(a, i ? 'head1' : 'head0', aim.pitch, aim.yaw, 0);
      }
    });
    models.rock_mossy = { idle: still, act: none, show: noop };

    /* ---------------- lamps: lit level → state colour, halo, ground pool ---------------- */
    var litLv = perCopy(new Map()), haloOn = perCopy(new Map()), decalOn = perCopy(new Map());
    /* the tap memory (the island's a.lit), then the level the lamp shows: that, or the night */
    function tapLit(a) {
      if (typeof a.lit === 'boolean' || typeof a.lit === 'number') return clamp01(+a.lit);
      return litLv.get(a.uid) || 0;
    }
    function litNow(a) { return busy(a) && litLv.has(a.uid) ? litLv.get(a.uid) : Math.max(tapLit(a), nightOf(showOf(a))); }
    function lampCfg(id) {
      var s = (LOOKS[id] && LOOKS[id].show) || {}, shroom = id === 'mushroom_glow';
      return { halo: s.halo || { token: shroom ? 'Cap Halo' : 'Lamp Halo', size: 0.9 }, decal: (s.decal && s.decal.token) || (shroom ? 'Cap Neon' : 'Lamp Warm') };
    }
    function lampApply(a, level, cfg) {
      var uid = a.uid, on = level > 0.5, pool = on && showOf(a) > 0.5;
      if (litLv.get(uid) !== level) { litLv.set(uid, level); setState(a, 'lit', level); }
      if (!!haloOn.get(uid) !== on && typeof a.halo === 'function') { haloOn.set(uid, on); a.halo('glow', on, cfg.halo.size, cfg.halo.token); }
      if (!!decalOn.get(uid) !== pool && typeof a.decal === 'function') { decalOn.set(uid, pool); a.decal(pool, cfg.decal); }
    }
    /* 'glow' toggles from the tap memory; 'glowOn' / 'glowOff' are explicit. No sound here:
       rewards-world plays 'star' / 'chip' itself. At night the lamp stays on either way. */
    function glowAct(a, name, cfg, extra) {
      var nm = name === 'glowOn' || name === 'glowOff' ? name : (tapLit(a) >= 0.5 ? 'glowOff' : 'glowOn');
      return runAct(a, nm, function (a2, pose) {
        var lv = Math.max(clamp01(pose.level), nightOf(showOf(a2)));
        lampApply(a2, lv, cfg);
        if (extra) extra(a2, lv);
      }, { sfx: false });
    }
    function isGlow(name) { return name === 'glow' || name === 'glowOn' || name === 'glowOff'; }
    function lampModel(id, extra) {
      var cfg = lampCfg(id), idl = idleOf(id, { pct: 12 });
      return {
        /* lit and music on: the lamp swells ±12% once per beat */
        idle: function (a) {
          if (!a) return false;
          var lv = litNow(a);
          if (!busy(a)) lampApply(a, lv, cfg);
          if (extra) extra(a, lv);
          else setPiv(a, 'glow', 0, 0, 0, M && lv >= 0.5 && !a.reduced && a.music !== false ? M.pulse(a.beat || 0, idl.pct, false) : 1);
        },
        act: function (a, name) { return isGlow(name) ? glowAct(a, name, cfg, extra) : null; },
        show: function (a) { if (a && !busy(a)) { var lv = litNow(a); lampApply(a, lv, cfg); if (extra) extra(a, lv); } },
        lit: function (a, on) { if (!a) return; running.delete(a.uid); var lv = Math.max(on ? 1 : 0, nightOf(showOf(a))); lampApply(a, lv, cfg); if (extra) extra(a, lv); }
      };
    }
    models.lantern = lampModel('lantern');
    models.mushroom_glow = lampModel('mushroom_glow');
    /* the lighthouse beam: scaled up from the lamp room and turning while lit, gone when dark */
    var lhShow = (LOOKS.lighthouse && LOOKS.lighthouse.show && LOOKS.lighthouse.show.beam) || {}, beamUp = perCopy(new Map());
    models.lighthouse = lampModel('lighthouse', function (a, lv) {
      var up = lv > 0.01;
      if (!up && !beamUp.get(a.uid)) return;
      beamUp.set(a.uid, up);
      setPiv(a, 'beam', 0, up && M ? M.beamAngle(a.t, lhShow.rps || 0.3, a.phase, a.reduced) : 0, 0, up ? BEAM_SCALE * lv : 0);
    });

    /* ---------------- flags: hinge waves ---------------- */
    var flagOver = perCopy(new Map()), flagIdl = idleOf('flag_pole', { amp: 0.04 }), FA = [];
    function flagHz() { return M && typeof M.freq === 'function' ? M.freq('flagFlutter') || 0.5 : 0.5; }
    function flagApply(a, amp) {
      flagAngles(a.t, amp, flagHz(), a.phase, a.reduced, FA);
      for (var s = 0; s < FLAG_SEGS; s++) setPiv(a, 'flag' + s, 0, FA[s], 0);
    }
    models.flag_pole = {
      idle: function (a) { if (!a) return false; flagApply(a, flagOver.has(a.uid) ? flagOver.get(a.uid) : flagIdl.amp); },
      /* a tap runs a bigger ripple: three times the idle amplitude, easing back over 1.2 s */
      act: function (a, name) {
        if (name !== 'wave' && name !== 'flag') return null;
        return runAct(a, 'flag', function (a2, pose) { flagOver.set(a2.uid, pose.amp); flagApply(a2, pose.amp); },
          { end: function (a2) { flagOver.delete(a2.uid); } });
      },
      show: noop
    };
    var buntOver = perCopy(new Map()), buntIdl = idleOf('bunting', { deg: 6, hz: 0.8 }), PA = [];
    function buntApply(a, front, amp) {
      if (!M) return;
      pennantAngles(a.t, buntIdl.deg, buntIdl.hz, a.phase, a.reduced, front, amp, M, PA);
      for (var i = 0; i < PENNANTS; i++) setPiv(a, 'p' + i, PA[i], 0, 0);
    }
    models.bunting = {
      idle: function (a) { if (!a) return false; var o = buntOver.get(a.uid); buntApply(a, o ? o.front : 1.3, o ? o.amp : 0); },
      act: function (a, name) {
        if (name !== 'wave' && name !== 'bunting') return null;
        return runAct(a, 'bunting', function (a2, pose) {
          var o = buntOver.get(a2.uid) || {};
          o.front = pose.front; o.amp = pose.amp;
          buntOver.set(a2.uid, o);
          buntApply(a2, pose.front, pose.amp);
        }, { end: function (a2) { buntOver.delete(a2.uid); } });
      },
      show: noop
    };

    /* ---------------- static decor; the snowman sheds a slow sparkle of snow ---------------- */
    ['bench', 'sandcastle', 'umbrella'].forEach(function (id) { models[id] = { idle: still, act: none, show: noop }; });
    var snowIdl = idleOf('snowman', { period: 4.8 }), snowLast = perCopy(new Map()), SNOW = [0, 0, 0], sev = {};
    models.snowman = {
      idle: function (a) {
        if (!M || !a || a.reduced || typeof a.emit !== 'function') return false;
        M.every(a.t, snowIdl.period * 0.5, snowIdl.period, (((a.phase || 0) * 4294967296) >>> 0) ^ 0x2545f491, sev);
        if (sev.since < 0 || sev.since > 0.5 || snowLast.get(a.uid) === sev.n) return;
        snowLast.set(a.uid, sev.n);
        var ang = sev.n * 2.39996;
        SNOW[0] = Math.cos(ang) * 0.3; SNOW[1] = 0.55 + 0.35 * ((sev.n * 0.618) % 1); SNOW[2] = Math.sin(ang) * 0.3;
        emit(a, 'snow', SNOW, 2);
      },
      act: none, show: noop
    };

    /* ---------------- the windmill: sails on 'spin' ---------------- */
    var millExtra = perCopy(new Map()), millBase = perCopy(new Map()), millIdl = idleOf('windmill', { rps: 0.25 });
    function millApply(a) { setPiv(a, 'spin', 0, 0, -((M.spin(a.t, millIdl.rps, a.phase, a.reduced) + (millExtra.get(a.uid) || 0)) % 360)); }
    models.windmill = {
      idle: function (a) { if (!M || !a) return false; millApply(a); },
      /* a tap: spin up and ease back; the extra turn is whole quarter turns, so the idle carries on */
      act: function (a, name) {
        if (name !== 'spin') return null;
        var prev = millExtra.get(a.uid) || 0;
        millBase.set(a.uid, prev - (((prev % 90) + 90) % 90));
        return runAct(a, 'spin', function (a2, pose) {
          millExtra.set(a2.uid, ((millBase.get(a2.uid) || 0) + pose.extraDeg) % 360);
          millApply(a2);
        });
      },
      show: noop
    };

    /* every handler first checks that its per-copy memory describes the handle's copy */
    function owned(fn) { return function (a, x, y) { own(a); return fn.call(this, a, x, y); }; }
    var STILL = { rock_mossy: 1, bench: 1, sandcastle: 1, umbrella: 1 };
    IDS.forEach(function (id) {
      var m = models[id];
      ['idle', 'show', 'act', 'lit'].forEach(function (k) { if (typeof m[k] === 'function') m[k] = owned(m[k]); });
      m.voxels = voxels[id];
      if (lod1[id]) m.lod1 = lod1[id];
      m.animated = function () { return !STILL[id]; };
      m.forget = forget;
    });
    return models;
  }

  return {
    IDS: IDS, TOKENS: TOKENS, FIT: FIT, BEAM_SCALE: BEAM_SCALE, FLAG_SEGS: FLAG_SEGS, PENNANTS: PENNANTS, FLAG: FLAG, MILL: MILL, LAMP: LAMP,
    voxels: voxels, lod1: lod1, factory: factory,
    /* pure animation helpers (Node-tested) */
    idleAmp: idleAmp, flagAngles: flagAngles, pennantAngles: pennantAngles, sunAim: sunAim, nightOf: nightOf
  };
}));
