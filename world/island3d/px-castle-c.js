/* ================================================================
   My Island v3 — SLPxCastleC (W3b.5): the Medieval Castle's courtyard and market pieces in Pixel
   Blocks. window.SLPxCastleC + SL3D.defineVox('castle-c', factory) in the browser,
   module.exports in Node: {IDS, voxels: {<id>: fn(st) → VoxModel}, lod1: {<id>: fn(st)}, factory,
   …}. Every model is pure data (no THREE, no DOM). Item space as the kit: base y = 0, pivot at
   the footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u (|x|, |z| ≤
   0.43). Seven repeatable 1 × 1 pieces:
     castle_herbs    a plank raised bed: on 'leaves' a back row of lavender (the colourway's
                     flowers, spikes at MID), a row of mint clumps and three pink chive pom-poms;
                     a little sign on the front board with a leaf pictogram (no words). 3 colourways
                     of the flowers: lilac, mint, gold. Act 'rustle'.
     castle_banner   a wooden pole on a stone foot that ends at a crossbar with gold knobs under a
                     gold finial (a T under a ball, never a cross); a swallow-tailed banner with a
                     gold hem hangs from the bar on 'banner' with an atlas pictogram on both faces.
                     3 colourways: violet with a sun, coral with a leaf, teal with a wave (never
                     real heraldry). Act 'wave'.
     castle_lantern  a stone foot, an iron post and cup, and a square iron lantern whose core is a
                     glow cube (state 'lit': PX Lamp Off → PX Castle Window, never a flame) under a
                     stepped gold roof and finial. Act 'glow' (a remembered toggle); on with the night.
     castle_well     a round well of cobbled stone with teal water inside, two wooden posts, a coral
                     shingled roof; the windlass and its crank turn on 'crank', the bucket (full)
                     hangs on 'bucket' from a rope on the helper pivot 'rope' (it stretches as the
                     bucket drops). Act 'bucket'.
     castle_window   a freestanding piece of castle wall with two merlons, a ROUND-arched opening
                     with sandstone arch stones and a sill, and one picture in glass (D101): a round
                     sun over two hills and a meadow strip. The panes are five glow state parts (key
                     'lit', all five PANES); off = each colour dimmed; four glass tiles on the sill
                     light with them. 3 glass colourways (coral, teal or violet sky). Act 'glow' (a
                     remembered toggle). No lattice across the glass (no bars, no cross).
     castle_stall    a plank counter with a cloth top on four posts under a striped awning on
                     'awning' (hinged at the back) and a little pennant; ALL the goods on one
                     counter (D101) on 'goods': two loaves, a crate of red and green apples, a pot of
                     flowers. 3 awning colourways: coral, violet, teal. Act 'serve' (cut to 2 s).
     castle_statue   a stone plinth and a chubby, rounded, EMPTY suit of armour in pale stone with
                     a gold belt, white shoulders and mitten hands: a big round helmet with a visor
                     ('visor') and a coral feather plume; one hand holds a short pole with a violet
                     pennant ('flag'), the other a flower; a red-breasted robin ('robin') lives in
                     the helmet. No sword, lance or shield; its feet never move. Act 'salute'.
   GRAIN (D11): bodies, posts and stone at G8 / G16 (the 1 × 1 pieces are small decor), ropes,
   panes, trims, fruit and pictogram plates at G16, the robin at G16. LOW (D106): trims and
   details are tagged lod 'mid'. Every id brings its own lod1: a few plain boxes with the same
   pivots and anchors, under TRIS_CAPS_LOD1. No corner AO (the small pieces' LOW caps).
   PICTOGRAMS (D32): atlas cells only ('sun', 'leaf', 'wave'); no words, no five-point star.
   TOGGLES: the lantern and the window keep their memory in the island's lit map; 'glowOn' /
   'glowOff' say which way, the bare 'glow' goes away from what the copy shows (or to a.lit when
   the host has already flipped it); lit(a, on) snaps; show(a, k) lights them with the night. No
   tap sound here: the host plays the lamp's 'star' / 'chip' (as the pier's lamp post).
   Every act is an SLMotion timeline (≤ 3 s, nothing over 2 Hz; reduced motion = the end state at
   once with one sparkle and the same sounds — the statue holds its visor up for 1.5 s with the
   robin showing, then shuts it, as the plan asks); pets come only through a.pets.perform(kind,
   uid), and nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.lit a.show a.batch a.template · a.pivot(name).set(rotDeg[3],
   pos[3], scale[3]) · a.state(key, v) · a.halo · a.decal · a.emit(kind, localPos, n, opts) ·
   a.sfx(name, vol, step) · a.pets.perform(kind, uid)
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxCastleC = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('castle-c', api.factory);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxCastleC: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 1;
  var IDS = ['castle_herbs', 'castle_banner', 'castle_lantern', 'castle_well', 'castle_window', 'castle_stall', 'castle_statue'];
  var G8 = 0.125, G16 = 0.0625;
  /* the colourways (D101 / D115: each colourway's main token, as LOOK variantTokens) */
  var HERB_WAYS = ['PX Lilac', 'PX Mint', 'PX Castle Gold'];
  var BANNER_WAYS = ['PX Castle Banner', 'PX Castle Pennant', 'PX Castle Teal'];
  var STALL_WAYS = ['PX Castle Pennant', 'PX Castle Banner', 'PX Castle Teal'];
  var WINDOW_WAYS = ['PX Castle Pennant', 'PX Castle Teal', 'PX Castle Banner'];
  var BANNER_PICTO = ['sun', 'leaf', 'wave'];
  /* the window's five pane colours (LOOK states.lit.tokens) and how dim they are when off */
  var PANES = ['PX Castle Pennant', 'PX Castle Gold', 'PX Castle Teal', 'PX Castle Banner', 'PX Mint'];
  var PANE_DIM = 0.5;
  /* the SLMotion timeline per id and the pet's part (= the LOOK entries' perform) */
  var ACT = { castle_herbs: 'rustle', castle_banner: 'wave', castle_lantern: 'glow', castle_well: 'bucket', castle_window: 'glow',
              castle_stall: 'serve', castle_statue: 'salute' };
  var PERFORM = { castle_well: 'stand:lookBack', castle_stall: 'stand:lookBack' };
  /* the remembered toggles */
  var TOGGLES = { castle_lantern: { act: 'glow', on: ['glowOn'], off: ['glowOff'] }, castle_window: { act: 'glow', on: ['glowOn'], off: ['glowOff'] } };
  /* pivots beyond the lookEntries lists: the well's rope stretches as the bucket drops */
  var HELPERS = { castle_well: ['rope'] };

  /* ================================================================
     LAYOUT (item metres: pivots, anchors and what the acts move)
     ================================================================ */
  var HERB = { leaves: [0, 0.125, 0], rz: 6, rx: 2.5, squash: 0.05, puff: [0, 0.3125, -0.0625], fly: [0.1875, 0.5, 0.0625], flyAt: 0.55 };
  var BAN = { banner: [0, 1.375, 0.09375], top: 1.5625, rz: 14, rx: 5, picto: [0, 1.0, 0.15625], glintAt: 1.25 };
  var LAN = { glow: [0, 0.78125, 0], top: 1.1875, halo: 0.6 };
  var WELL = { crank: [0, 1.1875, 0], bucket: [0, 0.65625, 0], rope: [0, 1.125, 0], ropeLen: 0.4375, drop: 0.375, turn: 240,
               water: [0, 0.25, 0], spot: [0, 0, 0.4375] };
  var WIN = { glow: [0, 0.875, 0], halo: 0.9 };
  var STALL = { awning: [0, 1.25, -0.3125], goods: [0, 0.5, 0], spot: [0, 0, 0.4375], cut: 2, flap: 9, flapAt: [0.1, 0.7],
                dip: [0.1, 0.5], pop: [0.9, 1.3], low: 0.8, heart: [0, 0.75, 0.0625] };
  var STAT = { visor: [0, 1.25, 0.15625], flag: [-0.3125, 1.28125, 0.125], robin: [0, 0.96875, 0.0625], open: 170, flagDeg: 22,
               out: 0.1875, hop: 0.03125, tilt: 14, notes: [0.5, 0.9], up: [0, 0.3], peek: [0.25, 0.5], hide: [1.45, 1.7], shut: [1.7, 2],
               reducedHold: 1.5, beak: [0, 0.96875, 0.375] };

  /* ================================================================
     BUILDER HELPERS (pure)
     ================================================================ */
  /* a builder grid: odd (voxel 0 centred on the pivot column) or even (voxels −1 and 0 straddle it) */
  function grid(g, odd) { return vox().grid({ grid: g, origin: [odd ? 0.5 : 0, 0, odd ? 0.5 : 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | {g, at?, ground?}] (empty grids are left out; decals keep their
     layer); o.pivots {name: [x, y, z, parent?]} and o.anchors {name: [x, y, z, pivot?]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = l.g || l, n = m.layers.length, ly;
      if (!g.count) return;
      ly = { vox: g.snapshot() };
      if (l.at) ly.at = l.at.slice();
      if (l.ground === false) ly.ground = false;
      m.layers.push(ly);
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { var p = o.pivots[n]; m.pivots[n] = { at: U(p), parent: p[3] || null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    if (o.cull) m.cull = o.cull.slice();
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  function mid(token, mode) { var e = { token: token, lod: 'mid' }; if (mode) e.mode = mode; return e; }   /* MID / HIGH detail (D89) */
  function cob(token) { return { token: token, mode: 'cobble' }; }
  function plank(token) { return { token: token, mode: 'plank' }; }
  /* fn(i, j, k) → a char, or null to leave that cell as it is (box() would clear it) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = typeof fn === 'function' ? fn(i, j, k) : fn; if (c) g.set(i, j, k, c); }
  }
  /* a box with its four upright corner columns left out (a rounded block) */
  function rounded(g, i0, i1, j0, j1, k0, k1, c) {
    fill(g, i0, i1, j0, j1, k0, k1, function (i, j, k) { return (i === i0 || i === i1) && (k === k0 || k === k1) ? null : typeof c === 'function' ? c(i, j, k) : c; });
  }
  function tokensOf(id, dflt) {
    var lk = look(), e = lk && lk.LOOK && lk.LOOK[id], t = e && e.variantTokens;
    return Array.isArray(t) && t.length ? t : dflt;
  }
  function variantOf(st, n) {
    var v = st && typeof st.variant === 'number' && isFinite(st.variant) ? Math.floor(st.variant) : 0;
    return ((v % n) + n) % n;
  }
  /* the module tokens (D50): each pane colour dimmed halfway toward the wall's shade (the window's 'off') */
  function hexOf(t) { var lk = look(), h = lk && typeof lk.resolve === 'function' ? lk.resolve(t) : null; return h && /^#[0-9A-Fa-f]{6}$/.test(h) ? h : null; }
  function mixHex(a, b, f) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = '#';
    [16, 8, 0].forEach(function (s) { var c = Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f); out += (c < 16 ? '0' : '') + c.toString(16); });
    return out.toUpperCase();
  }
  function dimName(t) { return 'PX Pane Dim ' + t.replace(/^PX (Castle )?/, ''); }
  var tokensFor = null;
  function ready() {
    var lk = look();
    if (!lk || tokensFor === lk || typeof lk.addTokens !== 'function') return;
    var shade = hexOf('PX Castle Stone Shade'), map = {};
    PANES.forEach(function (t) { var h = hexOf(t); if (h && shade) map[dimName(t)] = mixHex(h, shade, PANE_DIM); });
    lk.addTokens('px-castle-c', map);
    tokensFor = lk;
  }
  function pane(t) { return { token: t, mode: 'glow', state: { key: 'lit', off: dimName(t), on: t, initial: 0 } }; }

  /* ================================================================
     HERB GARDEN (G16, odd: centred): a plank frame round the soil; on 'leaves' a bed of green with
     the lavender (the colourway's flowers), the mint and the chives' pom-poms on it
     ================================================================ */
  function herbs(st) {
    var ways = tokensOf('castle_herbs', HERB_WAYS), flower = ways[variantOf(st, ways.length)];
    var o = grid(G16, true), p = grid(G16, true);
    fill(o, -6, 6, 0, 2, -5, 5, function (i, j, k) { return i === -6 || i === 6 || k === -5 || k === 5 ? 'w' : j < 2 ? 'd' : null; });
    /* the marker on the front board: a little sign with a leaf pictogram (no words) on a post (MID) */
    o.box(2, 4, 4, 6, 5, 5, 'b').box(3, 3, 3, 3, 5, 5, 'W');
    o.decal('+z', [2, 4, 5], [3, 3], 'leaf');
    p.group('leaves', function () {
      p.box(-5, 5, 2, 2, -4, 4, 'g');
      /* lavender: a row of the colourway's flowers, three spikes standing out of it (MID) */
      p.box(-5, 5, 3, 3, -4, -2, 'f');
      [[-4, -4], [0, -3], [4, -4]].forEach(function (q) { p.box(q[0], q[0], 4, 5, q[1], q[1], 'F'); });
      /* mint: a row of soft clumps, three rounder tops (MID) */
      p.box(-5, 5, 3, 3, -1, 1, 'm');
      [-3, 1].forEach(function (i) { p.box(i - 1, i + 1, 4, 4, -1, 0, 'M'); });
      /* chives: three pink pom-poms on the green, two blades (MID) */
      [-4, -1, 2].forEach(function (i) { p.box(i, i + 1, 3, 4, 2, 3, 'c'); });
      [[-2, 4], [1, 2]].forEach(function (q) { p.box(q[0], q[0], 3, 4, q[1], q[1], 'G'); });
    });
    return model('castle_herbs', {
      w: plank('PX Castle Wood'), W: mid('PX Castle Wood'), d: 'PX Tree Bark', b: 'PX Castle Sandstone', g: 'PX Castle Meadow 2', f: flower, F: mid(flower),
      m: 'PX Mint', M: mid('PX Mint'), c: 'PX Candy Pink', G: mid('PX Castle Meadow')
    }, [o, p], { pivots: { leaves: HERB.leaves } });
  }

  /* ================================================================
     BANNER POLE (G16, even): a stone foot, the pole, a gold finial, the crossbar and its knobs; the
     banner hangs in front of the pole from the bar (its gold hem wraps the bar), a swallowtail at
     its foot, the colourway's pictogram on both faces
     ================================================================ */
  function banner(st) {
    var ways = tokensOf('castle_banner', BANNER_WAYS), v = variantOf(st, ways.length), cloth = ways[v];
    var o = grid(G16), b = grid(G16);
    /* the pole ends AT the crossbar (a T under a ball, so the top never reads as a cross) */
    rounded(o, -3, 2, 0, 1, -3, 2, 's');
    o.box(-1, 0, 2, 22, -1, 0, 'w');
    o.box(-5, 4, 22, 22, -1, 0, 'w');
    o.box(-1, 0, 23, 24, -1, 0, 'y');
    o.box(-6, -6, 22, 22, -1, 0, 'Y').box(5, 5, 22, 22, -1, 0, 'Y').box(-2, 1, 2, 2, -2, 1, 'S');
    b.group('banner', function () {
      b.box(-3, 2, 10, 21, 1, 1, function (i, j) {
        if (j <= 11 && (i === -1 || i === 0)) return null;               /* the swallowtail */
        return j === 21 ? 'y' : 'c';
      });
      b.decal('+z', [-2, 14, 1], [4, 4], BANNER_PICTO[v]).decal('-z', [-2, 14, 1], [4, 4], BANNER_PICTO[v]);
    });
    return model('castle_banner', { s: 'PX Castle Stone 2', S: mid('PX Castle Stone'), w: 'PX Castle Wood', y: 'PX Castle Gold', Y: mid('PX Castle Gold'), c: cloth },
      [o, b], { pivots: { banner: BAN.banner }, anchors: { top: [0, BAN.top, 0] } });
  }

  /* ================================================================
     LANTERN (G16, even): a stone foot, the iron post and its cup, the lantern (iron corners and
     plates round a glow cube, state 'lit'), a gold cap and finial
     ================================================================ */
  var LAMP = { token: 'PX Castle Window', mode: 'glow', state: { key: 'lit', off: 'PX Lamp Off', on: 'PX Castle Window', initial: 0 } };
  function lantern() {
    var o = grid(G16);
    o.box(-3, 2, 0, 1, -3, 2, 's');
    o.box(-1, 0, 2, 8, -1, 0, 'i');
    o.box(-2, 1, 9, 9, -2, 1, 'i');
    fill(o, -2, 1, 10, 14, -2, 1, function (i, j, k) {
      if (j === 10 || j === 14) return 'i';
      return (i === -2 || i === 1) && (k === -2 || k === 1) ? 'i' : 'L';
    });
    /* the gold roof: a brim over the lantern, two steps and a finial (MID) */
    o.box(-3, 2, 15, 15, -3, 2, 'y').box(-2, 1, 16, 16, -2, 1, 'y').box(-1, 0, 17, 18, -1, 0, 'Y');
    [[-2, -2], [1, -2], [-2, 1], [1, 1]].forEach(function (q) { o.set(q[0], 8, q[1], 'I'); });       /* the cup's four little scrolls */
    o.box(-2, 1, 2, 2, -2, 1, 'S');
    return model('castle_lantern', { s: 'PX Castle Stone 2', S: mid('PX Castle Stone'), i: 'PX Castle Iron', I: mid('PX Castle Iron'), y: 'PX Castle Gold', Y: mid('PX Castle Gold'), L: LAMP },
      [o], { anchors: { top: [0, LAN.top, 0], glow: LAN.glow } });
  }

  /* ================================================================
     STONE WELL — the ring on G8 (even): cobbled stone, round outside and in, teal water two voxels
     down; posts, roof, windlass, crank, rope and bucket on G16 (even)
     ================================================================ */
  function inRound(i, k, a, b) { return i >= a && i <= b && k >= a && k <= b && !((i === a || i === b) && (k === a || k === b)); }
  function well() {
    var r = grid(G8), o = grid(G16), c = grid(G16), q = grid(G16), d = grid(G16);
    fill(r, -3, 2, 0, 2, -3, 2, function (i, j, k) {
      if (!inRound(i, k, -3, 2)) return null;
      if (inRound(i, k, -2, 1)) return j < 2 ? 'a' : null;
      return 's';
    });
    /* the two posts on the ring; the roof, each row one in and one up (its top row and ridge at MID) */
    o.box(-6, -5, 6, 19, -1, 0, 'w').box(4, 5, 6, 19, -1, 0, 'w');
    o.box(-7, 6, 20, 20, -5, 4, 'R').box(-7, 6, 21, 21, -4, 3, 'Q');
    o.box(-7, 6, 22, 22, -3, 2, 'Q').box(-7, 6, 23, 23, -1, 0, 'W').box(-1, 0, 24, 24, -1, 0, 'Y');
    /* the windlass on 'crank': the drum, the rope wound round it (MID), the axle out through the right
       post and the crank handle (up), its knob toward you */
    c.group('crank', function () {
      c.box(-4, 3, 18, 19, -1, 0, 'w');
      fill(c, -2, 1, 17, 20, -2, 1, function (i, j, k) { return j === 17 || j === 20 || k === -2 || k === 1 ? 'r' : null; });
      c.box(6, 6, 18, 19, -1, 0, 'i').box(7, 7, 18, 21, -1, 0, 'i').box(7, 7, 21, 21, 1, 1, 'Y');
    });
    /* the rope (helper pivot 'rope': it stretches as the bucket drops) and the bucket, full */
    q.group('rope', function () { q.box(-1, -1, 11, 17, -1, -1, 't'); });
    d.group('bucket', function () {
      d.box(-2, 1, 8, 10, -2, 1, function (i, j, k) { return j === 10 && i > -2 && i < 1 && k > -2 && k < 1 ? 'a' : 'w'; });
      d.box(-2, -2, 11, 11, -1, -1, 'I').box(1, 1, 11, 11, -1, -1, 'I').set(-2, 12, -1, 'I').box(0, 1, 12, 12, -1, -1, 'I');   /* its handle, round the rope */
    });
    /* a tuft and two flowers in the ring's front-left notch */
    o.box(-6, -5, 0, 1, 4, 5, 'g').set(-6, 2, 4, 'p').set(-5, 2, 5, 'Y');
    return model('castle_well', {
      s: cob('PX Castle Stone'), a: { token: 'PX Castle Teal', mode: 'soft' }, w: 'PX Castle Wood', W: mid('PX Castle Wood'),
      R: plank('PX Castle Pennant'), Q: { token: 'PX Castle Pennant', mode: 'plank', lod: 'mid' }, t: 'PX Tree Rope', r: mid('PX Tree Rope'),
      i: 'PX Castle Iron', I: mid('PX Castle Iron'), Y: mid('PX Castle Gold'), g: mid('PX Castle Meadow 2'), p: mid('PX Candy Pink')
    }, [r, o, c, q, d], { pivots: { crank: WELL.crank, bucket: WELL.bucket, rope: WELL.rope }, anchors: { spot: WELL.spot } });
  }

  /* ================================================================
     RAINBOW WINDOW (one G16 layer, even): a piece of cobbled wall 12 × 22 × 4 with two merlons, a
     round-arched opening on a sandstone sill under sandstone arch stones; the glass three voxels
     thick, flush with the back and set one voxel in at the front. PICTURE rows top → bottom over the
     opening's 8 columns (i −4 … 3): ' ' arch stone, 'K' sky, 'U' the round sun (high on the right),
     'H' / 'h' the far and near hills, 'F' the meadow strip along the bottom. Four glass tiles on the
     sill catch the light (MID)
     ================================================================ */
  var PICTURE = [
    '  KKKK  ',   /* j 19 */
    ' KKKKKK ',
    'KKKKUUUK',
    'KKKUUUUU',
    'KKKUUUUU',
    'KKKUUUUU',
    'KKKKUUUK',
    'KKKKKKKK',
    'HHKKKKKK',   /* j 11 */
    'HHHHKKKK',
    'HHHHHKhh',
    'HHHhhhhh',
    'hhhhhhhh',
    'FFFFFFFF'    /* j 6 */
  ];
  /* each colourway's glass (all five PANES): the sky (= the colourway's main token), the sun, the far
     hill, the near hill, the meadow strip */
  var GLASS = [
    { K: 'PX Castle Pennant', U: 'PX Castle Gold', H: 'PX Castle Banner', h: 'PX Mint', F: 'PX Castle Teal' },
    { K: 'PX Castle Teal', U: 'PX Castle Gold', H: 'PX Castle Banner', h: 'PX Mint', F: 'PX Castle Pennant' },
    { K: 'PX Castle Banner', U: 'PX Castle Gold', H: 'PX Castle Teal', h: 'PX Mint', F: 'PX Castle Pennant' }
  ];
  function windowPal(gl, extra) {
    ready();
    var pal = { s: cob('PX Castle Stone'), t: 'PX Castle Sandstone' };
    Object.keys(gl).forEach(function (ch) { pal[ch] = pane(gl[ch]); });
    for (var k in extra) pal[k] = extra[k];
    return pal;
  }
  function windowModel(st) {
    var gl = GLASS[variantOf(st, GLASS.length)], o = grid(G16), tiles = {};
    o.box(-6, 5, 0, 21, -2, 1, 's');
    o.box(-6, -3, 22, 23, -2, 1, 'm').box(2, 5, 22, 23, -2, 1, 'm');               /* two merlons (MID) */
    PICTURE.forEach(function (row, n) {
      for (var x = 0; x < 8; x++) {
        var ch = row[x], i = x - 4, j = 19 - n;
        if (ch === ' ') o.box(i, i, j, j, -2, 1, 't');
        else o.box(i, i, j, j, 1, 1, null).box(i, i, j, j, -2, 0, ch);
      }
    });
    o.box(-5, 4, 20, 20, -2, 1, 't').box(-5, -5, 17, 19, -2, 1, 't').box(4, 4, 17, 19, -2, 1, 't');
    o.box(-5, 4, 5, 5, -2, 2, 't');                                              /* the sill, proud at the front */
    /* four glass tiles on the sill in the panes' own state colours (they light with them, MID) */
    ['K', 'U', 'h', 'H'].forEach(function (ch, n) {
      var e = pane(gl[ch]), c = 'abcd'[n];
      e.lod = 'mid'; tiles[c] = e;
      o.set(-3 + 2 * n, 6, 2, c);
    });
    return model('castle_window', windowPal(gl, Object.assign({ m: { token: 'PX Castle Stone', mode: 'cobble', lod: 'mid' } }, tiles)), [o], { anchors: { glow: WIN.glow } });
  }

  /* ================================================================
     MARKET STALL — the counter and its four posts (G8: planks under a cloth top), the awning on
     'awning' (hinged along its back edge: two panels in the colourway with white stripes on them and
     a scalloped valance at MID), the goods on 'goods' (G16)
     ================================================================ */
  function stall(st) {
    var ways = tokensOf('castle_stall', STALL_WAYS), stripe = ways[variantOf(st, ways.length)];
    var o = grid(G8), p = grid(G16), a = grid(G16), g = grid(G16);
    o.box(-3, 2, 0, 3, -2, 1, function (i, j) { return j === 3 ? 'c' : 'W'; });
    o.box(-3, -3, 4, 9, -2, -2, 'w').box(2, 2, 4, 9, -2, -2, 'w').box(-3, -3, 4, 8, 1, 1, 'w').box(2, 2, 4, 8, 1, 1, 'w');
    p.box(-6, -6, 20, 22, -4, -4, 'G').box(-9, -7, 21, 22, -4, -4, 'V');        /* a little pennant on the back left post (MID) */
    a.group('awning', function () {
      a.box(-7, 6, 20, 20, -6, -1, 'x').box(-7, 6, 18, 18, 0, 6, 'x');
      [-5, -1, 3].forEach(function (i) { a.box(i, i + 1, 21, 21, -6, -1, 'K').box(i, i + 1, 19, 19, 0, 6, 'K'); });
      [-7, -3, 1, 5].forEach(function (i) { a.box(i, i + 1, 17, 17, 6, 6, 'X'); });
    });
    g.group('goods', function () {
      /* two loaves (left), a crate of red and green apples (middle), a pot of flowers (right) */
      g.box(-6, -3, 8, 9, -1, 1, 'l');
      g.box(-6, -5, 10, 10, -1, 1, 'L').box(-3, -3, 10, 10, -1, 1, 'L');
      g.box(-2, 1, 8, 9, -2, 1, 'W');
      g.box(-2, -1, 10, 10, -2, 1, 'r').box(0, 1, 10, 10, -2, 1, 'n');
      g.set(-1, 11, 0, 'R').set(0, 11, -1, 'N');
      g.box(2, 4, 8, 9, -1, 1, 'o');
      g.box(3, 3, 10, 10, 0, 0, 'e');
      g.box(2, 4, 11, 11, -1, 1, 'f').set(3, 12, 0, 'y');
      g.set(2, 10, 1, 'E').set(4, 10, -1, 'E');
    });
    return model('castle_stall', {
      W: plank('PX Castle Wood'), w: 'PX Castle Wood', c: 'PX Castle Cloth', x: stripe, K: mid('PX Castle Cloth'), X: mid(stripe),
      G: mid('PX Castle Gold'), V: mid('PX Castle Pennant'),
      l: 'PX Castle Sandstone', L: mid('PX Waffle'), r: 'PX Jungle Parrot Red', n: 'PX Accent 4', R: mid('PX Jungle Parrot Red'), N: mid('PX Accent 4'),
      o: 'PX Castle Pennant', e: 'PX Castle Meadow 2', E: mid('PX Castle Meadow 2'), f: 'PX Candy Pink', y: mid('PX Castle Gold')
    }, [o, p, a, g], { pivots: { awning: STALL.awning, goods: STALL.goods }, anchors: { spot: STALL.spot } });
  }

  /* ================================================================
     KNIGHT STATUE — one G16 layer (odd: centred) for the plinth and the armour; the visor, the
     pennant and the robin on their own. A toy statue: a big round helmet with a coral plume on a
     chubby body, a gold belt, mitten hands and stubby boots; never a block figure, never a fighter.
     The body and the helmet are cores with rounded sides added at MID (LOW keeps the cores)
     ================================================================ */
  function statue() {
    var o = grid(G16, true), v = grid(G16, true), f = grid(G16, true), r = grid(G16, true);
    o.box(-6, 6, 0, 3, -6, 6, 'p');
    /* the body: a core from the plinth to the helmet; at MID its rounded sides and front with the gold
       belt, the boots and round white shoulders */
    o.box(-3, 3, 4, 12, -2, 2, 's');
    o.box(-4, -4, 6, 11, -1, 1, 'S').box(4, 4, 6, 11, -1, 1, 'S');
    o.box(-2, 2, 6, 11, 3, 3, function (i, j) { return j === 7 ? (i === 0 ? 'Y' : 'G') : 'S'; });
    o.box(-3, -1, 4, 5, 3, 3, 'S').box(1, 3, 4, 5, 3, 3, 'S');
    [-1, 1].forEach(function (s) {
      o.box(s * 4, s * 5, 10, 11, -1, 1, 'H');
      o.box(s > 0 ? 4 : -5, s > 0 ? 5 : -4, 6, 7, 1, 2, 'm');                    /* mitten hands */
    });
    /* the helmet: a core with the robin's hollow, the plume; at MID its rounded sides,
       the dome round the plume's foot and the plume's curl */
    o.box(-3, 3, 13, 19, -3, 2, 's');
    o.box(-1, 1, 14, 16, 0, 2, null);
    o.box(0, 0, 20, 23, -1, 0, 'c');
    o.box(-4, -4, 14, 18, -2, 1, 'S').box(4, 4, 14, 18, -2, 1, 'S');
    fill(o, -2, 2, 20, 20, -2, 1, function (i, j, k) { return Math.abs(i) <= 1 && k >= -1 && k <= 0 ? null : 'S'; });
    o.box(-1, -1, 20, 21, -1, 0, 'C').box(1, 1, 20, 21, -1, 0, 'C').box(0, 0, 22, 23, -2, -2, 'C').box(0, 0, 21, 22, -3, -3, 'C');
    /* the visor on 'visor' (hinged just over its top edge: it flips right up over the brow): a plate with a dark eye slit */
    v.group('visor', function () { v.box(-3, 3, 13, 18, 3, 3, function (i, j) { return j === 16 && Math.abs(i) <= 2 ? 'k' : 's'; }); });
    /* the short pennant pole held up in the right hand, the pennant on 'flag' (its swallowtail at MID);
       a flower in the left hand */
    o.box(-5, -5, 8, 22, 2, 2, 'w').set(-5, 23, 2, 'Y');
    f.group('flag', function () { f.box(-8, -6, 18, 21, 2, 2, 'v').box(-10, -9, 18, 18, 2, 2, 'V').box(-10, -9, 21, 21, 2, 2, 'V'); });
    o.box(4, 5, 8, 9, 2, 2, 'F').set(6, 9, 2, 'P').set(4, 10, 2, 'P').set(5, 9, 3, 'y');
    /* the robin on 'robin', in the hollow: brown with a red breast, a gold beak and two dark eyes */
    r.group('robin', function () {
      r.box(-1, 1, 14, 16, 0, 2, function (i, j, k) { return k < 2 || j === 16 && !i ? 'n' : j === 16 ? 'E' : j === 15 && !i ? 'b' : 'q'; });
    });
    return model('castle_statue', {
      p: 'PX Castle Stone 2', s: 'PX Castle Stone', S: mid('PX Castle Stone'), H: mid('PX Castle Cloth'), G: mid('PX Castle Gold'),
      Y: mid('PX Castle Gold'), m: 'PX Castle Cloth', k: 'PX Castle Iron', c: 'PX Castle Pennant', C: mid('PX Castle Pennant'),
      w: 'PX Castle Wood', v: 'PX Castle Banner', V: mid('PX Castle Banner'), F: 'PX Candy Pink', P: mid('PX Candy Pink'), y: mid('PX Castle Gold'),
      q: 'PX Jungle Parrot Red', n: 'PX Tree Bark', b: 'PX Castle Gold', E: 'PX Ink Eye'
    }, [o, v, f, r], { pivots: { visor: STAT.visor, flag: STAT.flag, robin: STAT.robin } });
  }

  /* ================================================================
     LOD1 — the far-island bakes (D106): a few plain boxes per piece, inside TRIS_CAPS_LOD1, with
     every lookEntries pivot and anchor (and the colourway)
     ================================================================ */
  var LO = {
    castle_herbs: function (st) {
      var ways = tokensOf('castle_herbs', HERB_WAYS), o = grid(G16, true), p = grid(G16, true);
      o.box(-6, 6, 0, 1, -5, 5, 'w');
      p.group('leaves', function () { p.box(-5, 5, 2, 2, -4, 4, 'g').box(-5, 5, 3, 4, -4, -3, 'f').box(-5, 5, 3, 3, -1, 1, 'm').box(-4, 3, 3, 4, 3, 3, 'c'); });
      return model('castle_herbs', { w: 'PX Castle Wood', g: 'PX Castle Meadow 2', f: ways[variantOf(st, ways.length)], m: 'PX Mint', c: 'PX Candy Pink' },
        [o, p], { pivots: { leaves: HERB.leaves } });
    },
    castle_banner: function (st) {
      var ways = tokensOf('castle_banner', BANNER_WAYS), o = grid(G16), b = grid(G16);
      o.box(-2, 1, 0, 1, -2, 1, 's').box(-1, 0, 2, 22, -1, 0, 'w').box(-5, 4, 22, 22, -1, 0, 'w').box(-1, 0, 23, 24, -1, 0, 'y');
      b.group('banner', function () { b.box(-3, 2, 11, 21, 1, 1, 'c'); });
      return model('castle_banner', { s: 'PX Castle Stone 2', w: 'PX Castle Wood', y: 'PX Castle Gold', c: ways[variantOf(st, ways.length)] },
        [o, b], { pivots: { banner: BAN.banner }, anchors: { top: [0, BAN.top, 0] } });
    },
    castle_lantern: function () {
      var o = grid(G16);
      o.box(-2, 1, 0, 1, -2, 1, 's').box(-1, 0, 2, 9, -1, 0, 'i').box(-2, 1, 10, 14, -2, 1, 'L').box(-3, 2, 15, 16, -3, 2, 'y');
      return model('castle_lantern', { s: 'PX Castle Stone 2', i: 'PX Castle Iron', y: 'PX Castle Gold', L: LAMP }, [o], { anchors: { top: [0, LAN.top, 0], glow: LAN.glow } });
    },
    castle_well: function () {
      var r = grid(G8), o = grid(G16), c = grid(G16), q = grid(G16), d = grid(G16);
      r.box(-3, 2, 0, 2, -3, 2, function (i, j, k) { return j === 2 && i > -3 && i < 2 && k > -3 && k < 2 ? 'a' : 's'; });
      o.box(-6, -5, 6, 19, -1, 0, 'w').box(4, 5, 6, 19, -1, 0, 'w').box(-7, 6, 20, 21, -4, 3, 'R');
      c.group('crank', function () { c.box(-4, 7, 18, 19, -1, 0, 'w'); });
      q.group('rope', function () { q.box(-1, -1, 11, 17, -1, -1, 't'); });
      d.group('bucket', function () { d.box(-2, 1, 8, 10, -2, 1, 'w'); });
      return model('castle_well', { s: 'PX Castle Stone', a: 'PX Castle Teal', w: 'PX Castle Wood', R: 'PX Castle Pennant', t: 'PX Tree Rope' },
        [r, o, c, q, d], { pivots: { crank: WELL.crank, bucket: WELL.bucket, rope: WELL.rope }, anchors: { spot: WELL.spot } });
    },
    castle_window: function (st) {
      var gl = GLASS[variantOf(st, GLASS.length)], o = grid(G16);
      o.box(-6, 5, 0, 23, -2, 1, 's');
      o.box(-4, 3, 6, 18, -2, 1, null).box(-4, 3, 6, 10, -1, 0, 'h').box(-4, 3, 11, 18, -1, 0, 'K').box(-1, 3, 13, 17, -1, 0, 'U');
      return model('castle_window', windowPal({ K: gl.K, U: gl.U, h: gl.h }), [o], { anchors: { glow: WIN.glow } });
    },
    castle_stall: function (st) {
      var ways = tokensOf('castle_stall', STALL_WAYS), o = grid(G8), p = grid(G16), a = grid(G16), g = grid(G16);
      o.box(-3, 2, 0, 3, -2, 1, 'w');
      p.box(-6, -5, 8, 19, -4, -3, 'w').box(4, 5, 8, 19, -4, -3, 'w');
      a.group('awning', function () { a.box(-7, 6, 20, 20, -6, 6, 'x'); });
      g.group('goods', function () { g.box(-6, -3, 8, 10, -2, 2, 'l').box(-2, 1, 8, 10, -2, 1, 'r').box(2, 4, 8, 12, -1, 1, 'f'); });
      return model('castle_stall', { w: 'PX Castle Wood', x: ways[variantOf(st, ways.length)], l: 'PX Castle Sandstone', r: 'PX Jungle Parrot Red', f: 'PX Candy Pink' },
        [o, p, a, g], { pivots: { awning: STALL.awning, goods: STALL.goods }, anchors: { spot: STALL.spot } });
    },
    castle_statue: function () {
      var o = grid(G16, true), v = grid(G16, true), f = grid(G16, true), r = grid(G16, true);
      o.box(-6, 6, 0, 3, -6, 6, 'p').box(-3, 3, 4, 11, -2, 2, 's').box(-3, 3, 12, 20, -3, 1, 's').box(-5, -5, 8, 22, 2, 2, 'w').box(-1, 1, 21, 22, -1, 0, 'c');
      v.group('visor', function () { v.box(-3, 3, 13, 18, 2, 2, 's'); });
      f.group('flag', function () { f.box(-10, -7, 18, 21, 2, 2, 'v'); });
      r.group('robin', function () { r.box(-1, 1, 14, 16, 0, 1, 'q'); });
      return model('castle_statue', { p: 'PX Castle Stone 2', s: 'PX Castle Stone', w: 'PX Castle Wood', v: 'PX Castle Banner', q: 'PX Jungle Parrot Red', c: 'PX Castle Pennant' },
        [o, v, f, r], { pivots: { visor: STAT.visor, flag: STAT.flag, robin: STAT.robin } });
    }
  };

  var BUILD = { castle_herbs: herbs, castle_banner: banner, castle_lantern: lantern, castle_well: well, castle_window: windowModel,
                castle_stall: stall, castle_statue: statue };
  /* voxels[id](st) → a fresh VoxModel (pure; st.variant picks the colourway); lod1[id](st) → the
     plain build the island draws for a copy at LOD1 (D106) */
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st || {}); };
    lod1[id] = function (st) { return LO[id](st || {}); };
  });

  /* ================================================================
     PURE ANIMATION HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  /* how far the night has come on for the lamps: 0 by day, 1 from dusk (k 0.65) on */
  function nightOf(k) { return smooth(((+k || 0) - 0.35) / 0.3); }
  /* the herb bed's shiver for the 'rustle' swing: a sway, a tilt and a little squash */
  function herbAt(swing, out) {
    var s = +swing || 0;
    out = out || {};
    out.rz = HERB.rz * s; out.rx = HERB.rx * s; out.sy = 1 - HERB.squash * Math.abs(s);
    return out;
  }
  /* the well's 'bucket' for its bob (0 up … 1 at the water): the drop, the crank's turn (it unwinds as
     the bucket falls and winds it back up) and the rope's stretch from the drum */
  function bucketAt(bob, out) {
    var d = clamp01(bob);
    out = out || {};
    out.y = -WELL.drop * d; out.crank = -WELL.turn * d; out.rope = 1 + WELL.drop * d / WELL.ropeLen;
    return out;
  }
  /* the stall's own 'serve' at t: the awning's one flap (degrees) and the goods' size (they settle to
     0.8, then rise back to 1 with the pops, no overshoot) */
  function serveAt(t, out) {
    out = out || {};
    var u = seg(t, STALL.flapAt[0], STALL.flapAt[1]);
    out.flap = u > 0 && u < 1 ? -STALL.flap * Math.sin(Math.PI * u) : 0;
    out.goods = 1 - (1 - STALL.low) * smooth(seg(t, STALL.dip[0], STALL.dip[1])) * (1 - smooth(seg(t, STALL.pop[0], STALL.pop[1])));
    return out;
  }
  /* the statue's 'salute' at t: the visor (0 shut … 1 up), the robin (0 in … 1 out), its hop on the
     first note and its tilt on the second, the pennant's wave (SLMotion's swing). Reduced motion holds
     the visor up and the robin out for STAT.reducedHold s, then both are back */
  function saluteAt(t, swing, reduced, out) {
    out = out || {};
    if (reduced) { out.visor = out.robin = t < STAT.reducedHold ? 1 : 0; out.hop = out.tilt = out.flag = 0; return out; }
    out.visor = smooth(seg(t, STAT.up[0], STAT.up[1])) * (1 - smooth(seg(t, STAT.shut[0], STAT.shut[1])));
    out.robin = smooth(seg(t, STAT.peek[0], STAT.peek[1])) * (1 - smooth(seg(t, STAT.hide[0], STAT.hide[1])));
    out.hop = STAT.hop * Math.sin(Math.PI * seg(t, STAT.notes[0] - 0.05, STAT.notes[0] + 0.15));
    out.tilt = STAT.tilt * Math.sin(Math.PI * seg(t, STAT.notes[1] - 0.05, STAT.notes[1] + 0.25));
    out.flag = STAT.flagDeg * (+swing || 0);
    return out;
  }
  /* which way a toggle goes: an explicit name says; the catalogue act goes away from what the copy
     shows — or, when the lit memory already differs from that (the host flipped it first), to it */
  function wantOn(name, spec, shown, lit) {
    if (spec.on.indexOf(name) >= 0) return true;
    if (spec.off.indexOf(name) >= 0) return false;
    return lit == null || !!lit === !!shown ? !shown : !!lit;
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('castle-c', K → {id: {voxels, lod1, act, forget, idle, show, animated, lit?}})
     ================================================================ */
  function factory() {
    var M = mo(), lk = look(), LOOKS = (lk && lk.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], HB = {}, BK = {}, SV = {}, SL = {}, NOOPT = {};
    function pose(a, name, rx, ry, rz, x, y, z, sx, sy, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z;
      S3[0] = sx == null ? 1 : sx; S3[1] = sy == null ? 1 : sy; S3[2] = sz == null ? 1 : sz;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    function emit(a, kind, at, n, opts) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n, opts); } catch (e) { /* fx is optional */ } } }
    function tierOf(a) { return (a && a.template && a.template.tier) || 'MID'; }
    function timeOf(a) { return a && typeof a.t === 'number' && isFinite(a.t) ? a.t : 0; }
    /* the pet's part (the crew owns it): a.pets.perform(LOOK perform kind, uid) */
    function askPet(a, id) {
      var p = a.pets, e = LOOKS[id], kind = e && typeof e.perform === 'string' ? e.perform : PERFORM[id];
      if (!kind || !p || typeof p.perform !== 'function') return;
      try { p.perform(kind, a.uid); } catch (e2) { /* no crew yet */ }
    }
    /* per-copy memory {copy, on (a toggle's way: true / false / null), lamp, halo, pool}: a remount or a
       restyle hands the handle a new batch and the memory starts again; forget(uid) drops it */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var c = a.batch || a.object || null, m = memo.get(a.uid);
      if (m && c && m.copy && m.copy !== c) { live.delete(a.uid); m = null; }
      if (!m) { m = { copy: c, on: null, lamp: -1, halo: false, pool: false }; memo.set(a.uid, m); }
      else if (c && !m.copy) m.copy = c;
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }

    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx (a re-tap supersedes;
       cancel lands on the end pose). spec {apply(a, out, t, me), rest(a, me), cut? (own seconds),
       reducedCut? (a held reduced pose), more? (extra emit cues), at?(cue) → local point, mute? (the
       host plays the sound)}; opt {name (the timeline), off (a toggle played shut), quiet (no pet)} */
    function run(a, id, spec, opt) {
      opt = opt || NOOPT;
      var name = opt.name || ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, off = !!opt.off;
      mem(a);
      if (prev) prev.done = true;
      var o = { reduced: reduced, off: off, from: prev && !reduced && prev.name === name ? M.carry(prev.name, prev.out) : null };
      var dur = reduced ? spec.reducedCut || 0 : spec.cut || M.durOf(name, o);
      var cues = M.cues(name, o).concat(reduced ? [] : spec.more || []).filter(function (c) { return !(spec.mute && c.sfx); });
      cues.sort(function (x, y) { return x.t - y.t; });
      var ci = 0, uid = a.uid, me = { name: name, id: id, off: off, dur: dur, reduced: reduced, out: {}, done: false };
      live.set(uid, me);
      if (!opt.quiet) askPet(a, id);
      function stop() { me.done = true; if (live.get(uid) === me) live.delete(uid); }
      me.update = function (h, tAct) {
        if (me.done) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur;
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, c.at || (c.emit !== 'sparkle' && spec.at ? spec.at(c) : 'top'), c.n || 1, c.opts);
            else if (c.sfx && typeof h.sfx === 'function') h.sfx(c.sfx, c.vol, c.step);
          } catch (e) { /* a cue never stops its act */ }
        }
        if (t < dur) { spec.apply(h, me.out, tt, me); return true; }
        stop();
        spec.rest(h, me);
        return false;
      };
      me.cancel = function () { if (!me.done) { stop(); try { spec.rest(a, me); } catch (e) { /* the copy is gone */ } } };
      return me;
    }
    function still() { return false; }
    function noop() {}

    /* ---------- herb garden: the plants shiver, leaves puff up, a butterfly flutters off ---------- */
    var herbSpec = {
      apply: function (a, out, t, me) {
        herbAt(out.swing, HB);
        pose(a, 'leaves', HB.rx, 0, HB.rz, 0, 0, 0, 1, HB.sy, 1);
        if (!me.fly && t >= HERB.flyAt) {
          me.fly = true;
          var ways = tokensOf('castle_herbs', HERB_WAYS);
          emit(a, 'sparkle', HERB.fly, 1, { token: ways[variantOf(a.st, ways.length)] });
        }
      },
      rest: function (a) { rest(a, 'leaves'); },
      at: function () { return HERB.puff; }
    };
    /* ---------- banner: three easing swings from the bar, then a gold glint across the pictogram ---------- */
    var bannerSpec = {
      apply: function (a, out) { var s = out.swing || 0; pose(a, 'banner', BAN.rx * s, 0, BAN.rz * s, 0, 0, 0); },
      rest: function (a) { rest(a, 'banner'); },
      more: [{ t: BAN.glintAt, emit: 'glint', n: 1, at: BAN.picto, opts: { token: 'PX Castle Gold' } }]
    };
    /* ---------- well: the crank unwinds, the bucket drops to the water (a splash), winds back up full ---------- */
    function wellPose(a, bob) {
      bucketAt(bob, BK);
      pose(a, 'crank', BK.crank, 0, 0, 0, 0, 0);
      pose(a, 'rope', 0, 0, 0, 0, 0, 0, 1, BK.rope, 1);
      pose(a, 'bucket', 0, 0, 0, 0, BK.y, 0);
    }
    var wellSpec = {
      apply: function (a, out) { wellPose(a, out.bob || 0); },
      rest: function (a) { wellPose(a, 0); },
      at: function () { return WELL.water; }
    };
    /* ---------- market stall: the awning flaps once, the goods settle and pop back up, the pet sniffs ---------- */
    var stallSpec = {
      cut: STALL.cut,
      apply: function (a, out, t) {
        serveAt(t, SV);
        pose(a, 'awning', SV.flap, 0, 0, 0, 0, 0);
        pose(a, 'goods', 0, 0, 0, 0, 0, 0, SV.goods, SV.goods, SV.goods);
      },
      rest: function (a) { rest(a, 'awning'); rest(a, 'goods'); },
      at: function () { return STALL.heart; }
    };
    /* ---------- knight statue: the visor flips up, the robin hops out and sings two notes, the pennant
       waves once, the robin ducks back in and the visor shuts ---------- */
    function statuePose(a, s) {
      pose(a, 'visor', -STAT.open * s.visor, 0, 0, 0, 0, 0);
      pose(a, 'robin', 0, 0, s.tilt, 0, s.hop, STAT.out * s.robin);
      pose(a, 'flag', 0, s.flag, 0, 0, 0, 0);
    }
    var statueSpec = {
      reducedCut: STAT.reducedHold,
      apply: function (a, out, t, me) { statuePose(a, saluteAt(t, out.swing, me.reduced, SL)); },
      rest: function (a) { statuePose(a, saluteAt(STAT.reducedHold, 0, true, SL)); },
      more: [{ t: STAT.notes[0], emit: 'note', n: 1, at: STAT.beak }, { t: STAT.notes[1], emit: 'note', n: 1, at: STAT.beak }]
    };

    /* ---------- the lamps (lantern, window): the remembered level or the night's, a halo on MID / HIGH
       while lit, the lantern's warm pool on the ground at night ---------- */
    function lampApply(a, id, k) {
      var m = mem(a), night = nightOf(a && typeof a.show === 'number' ? a.show : 0), lv = Math.round(100 * Math.max(clamp01(k), night)) / 100;
      var on = lv > 0.5, cfg = id === 'castle_lantern' ? LAN : WIN, halo = on && tierOf(a) !== 'LOW', pool = id === 'castle_lantern' && on && night > 0.5;
      if (lv !== m.lamp) { m.lamp = lv; setState(a, 'lit', lv); }
      if (halo !== m.halo && typeof a.halo === 'function') { m.halo = halo; try { a.halo('glow', halo, cfg.halo, 'Lamp Halo'); } catch (e) { /* fx is optional */ } }
      if (pool !== m.pool && typeof a.decal === 'function') { m.pool = pool; try { a.decal(pool, 'Lamp Warm'); } catch (e) { /* fx is optional */ } }
    }
    function lampSpec(id) {
      return {
        mute: true,
        apply: function (a, out) { lampApply(a, id, out.k || 0); },
        rest: function (a, me) { lampApply(a, id, me.off ? 0 : 1); }
      };
    }
    function toggle(id) {
      var spec = TOGGLES[id], ls = lampSpec(id);
      /* what the copy shows with no act running: its memory, else the island's lit map */
      function shown(a) { var m = mem(a); return m.on === null ? !!a.lit && +a.lit >= 0.5 : m.on; }
      return {
        act: function (a, name) {
          if (!a || (name !== spec.act && spec.on.indexOf(name) < 0 && spec.off.indexOf(name) < 0)) return null;
          var on = wantOn(name, spec, mem(a).on === true, a.lit == null ? null : +a.lit >= 0.5), act = run(a, id, ls, { off: !on, quiet: !on });
          if (act) mem(a).on = on;
          return act;
        },
        show: function (a) { if (a && !live.get(a.uid)) lampApply(a, id, shown(a) ? 1 : 0); },
        lit: function (a, on) { if (!a) return; live.delete(a.uid); mem(a).on = !!on; lampApply(a, id, on ? 1 : 0); }
      };
    }

    var SPEC = { castle_herbs: herbSpec, castle_banner: bannerSpec, castle_well: wellSpec, castle_stall: stallSpec, castle_statue: statueSpec };
    var out = {};
    IDS.forEach(function (id) {
      var h = TOGGLES[id] ? toggle(id) : { act: function (a, name) { return a && name === ACT[id] ? run(a, id, SPEC[id]) : null; }, show: noop };
      h.voxels = voxels[id]; h.lod1 = lod1[id]; h.forget = forget; h.idle = still;
      h.animated = function () { return false; };
      out[id] = h;
    });
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, voxels: voxels, lod1: lod1, factory: factory, ACT: ACT, PERFORM: PERFORM, TOGGLES: TOGGLES, HELPERS: HELPERS,
    HERB_WAYS: HERB_WAYS, BANNER_WAYS: BANNER_WAYS, STALL_WAYS: STALL_WAYS, WINDOW_WAYS: WINDOW_WAYS, BANNER_PICTO: BANNER_PICTO, PANES: PANES, PANE_DIM: PANE_DIM,
    PICTURE: PICTURE, GLASS: GLASS,
    LAYOUT: { castle_herbs: HERB, castle_banner: BAN, castle_lantern: LAN, castle_well: WELL, castle_window: WIN, castle_stall: STALL, castle_statue: STAT },
    /* pure helpers (Node-tested) */
    nightOf: nightOf, herbAt: herbAt, bucketAt: bucketAt, serveAt: serveAt, saluteAt: saluteAt, wantOn: wantOn, dimName: dimName
  };
}));
