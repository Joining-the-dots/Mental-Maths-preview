/* ================================================================
   My Island v3 — SLPxPierB (W3.2b): the Theme Park Pier's five big rides in Pixel Blocks.
   window.SLPxPierB + SL3D.defineVox('pier-b', factory) in the browser, module.exports in Node.
   Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards
   and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the
   footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u.
     pier_swingship  3×1  a striped A-frame (blue / white) behind the boat carries a pivot bar at
                     2.2 u; a coral boat with a white rail, seat rows and a sunny sail with a voxel
                     sun hangs on 'swing' and swings along x (±40°, 0.7 Hz). No skull flag, no
                     cannons. It keeps every face (the hull tips its underside up). Anchors top,
                     spot, seat (the bow). The frame stands behind only: in front it hid the sail
                     and the pet from the island camera.
     pier_train      3×2  a toy oval of rails on sleepers round a sand base, a mint tunnel hill
                     over the back-right bend (a solid mound: the train drives into a dark recess
                     under each striped portal), a plank platform under a striped canopy and a
                     signal (arm on 'signal'). A stubby blue engine (no face, no number) and two
                     open carriages ride t0 – t2 one lap of ROUTES.train; three funnel puffs (fx 'dust').
     pier_dodgems    3×2  a lilac / white chequer floor in a fat coral rim, four striped posts, a
                     sunny / white ring canopy with an open pole grid (the island camera looks down
                     at 44 – 62°: a solid roof would hide the cars), four round-nosed cars on
                     car0 – car3, each with a pole tipped by a steady warm bulb. A lap is 1¼ turns of
                     ROUTES.dodgems, so every car parks one bay on; the yellow car meets the next.
     pier_flume      3×2  a white trough on a stepped mint hill: side channel, lift, top channel, a
                     1.9 u chute into a turquoise pool. The log (no face) rides 'log' round
                     ROUTES.flume; a second log waits in the top station. Water stripes are two
                     state parts (key 'ripple') that cross-fade on MID / HIGH; fx 'drop' on landing.
     pier_coaster    4×2  a candy-pink track on striped stilts: station at the front, a 2.4 u lift
                     hill at the back left, one 1.5 u loop at the centre right; 10 loop bulbs are a
                     glow state part (key 'bulbs') that breathes at ART3.FREQS.breathe in the act.
                     The 2-seat car rides 'car' round ROUTES.coaster and keeps every face.
   ROUTES: one turtle path per ride (straight runs, yaw arcs, pitch arcs) rasterises the track
   AND drives the part that rides it, so a car can never leave its rails. Anchors r0 – r11,
   f0 – f11 and t0 – t15 are that route at equal steps of its length.
   AO: all five opt out of corner AO (ao false, as the pitch does): on G16 rails, cars, striped
   legs and a one-voxel tube it only splits the greedy quads; it halves their triangles.
   LOW (D89): detail voxels are tagged lod 'mid' (the rails' bends, wheels, the dodgem grid, seat
   rows, blossoms, valances); every id also brings its own lod1 (its plain masses, halved) inside
   TRIS_CAPS_LOD1. Every id stays inside its lookEntries tris on every tier, with every face.
   ACTS: SLMotion's own timelines by name (swingship, train, dodgems, flume, coaster: 3 s; reduced
   motion = the end state at once with one sparkle and the same sounds). The pet's part is asked
   through a.pets.perform(LOOK.perform, uid) ('seat:ride' / 'seat:drive' on the pivoted 'seat').
   Nothing here reads, awards or spends points, and nothing flashes: the only lights that move
   are the loop's breathing (≤ 1 Hz) and the water's cross-fade (0.42 Hz).
   HANDLE used: a.uid a.t a.reduced a.batch a.template · a.pivot(name).set(rotDeg[3], pos[3], scale[3])
   · a.state(key, v) · a.emit(kind, localPos, n) · a.sfx(name, vol, step) · a.pets.perform(kind, uid)
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxPierB = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pier-b', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxPierB: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 1, IDS = ['pier_swingship', 'pier_train', 'pier_dodgems', 'pier_flume', 'pier_coaster'];
  var ACT = { pier_swingship: 'swingship', pier_train: 'train', pier_dodgems: 'dodgems', pier_flume: 'flume', pier_coaster: 'coaster' };
  var PERFORM = { pier_swingship: 'seat:ride', pier_train: 'seat:ride', pier_dodgems: 'seat:drive', pier_flume: 'seat:ride', pier_coaster: 'seat:ride' };
  var G8 = 0.125, G16 = 0.0625, DEG = Math.PI / 180, TAU = Math.PI * 2;

  /* ================================================================
     ROUTES — a turtle path: ['f', u] a straight run · ['y', deg, r] a yaw arc (+ = anticlockwise
     seen from above; r is its radius on the ground, also while it climbs) · ['p', deg, r] a pitch
     arc (+ = nose up). nose = the authored heading (±1 along x). → {len, marks, at(s, out) →
     {x, y, z, b, c}, each(fn)}: (0, b, c) are the XYZ Euler degrees a.pivot().set takes (pitch c
     about z, then yaw b about y); marks[n] = the distance where move n starts. Closed: s wraps.
     ================================================================ */
  function route(nose, start, moves) {
    var S = [], x = start[0], y = start[1], z = start[2], b = 0, c = 0, s = 0, STEP = 1 / 64, marks = [0];
    function go(d, db, dc) {                       /* one small step: half the turn, the move, the other half */
      b += db / 2; c += dc / 2;
      var cc = Math.cos(c * DEG);
      x += nose * cc * Math.cos(b * DEG) * d; y += nose * Math.sin(c * DEG) * d; z -= nose * cc * Math.sin(b * DEG) * d;
      b += db / 2; c += dc / 2; s += d;
      S.push(x, y, z, b, c, s);
    }
    S.push(x, y, z, b, c, s);
    moves.forEach(function (m) {
      var len = m[0] === 'f' ? m[1] : Math.abs(m[1]) * DEG * m[2] / (m[0] === 'y' ? Math.cos(c * DEG) : 1), n = Math.max(1, Math.ceil(len / STEP));
      for (var q = 0; q < n; q++) go(len / n, m[0] === 'y' ? m[1] / n : 0, m[0] === 'p' ? nose * m[1] / n : 0);
      marks.push(s);
    });
    var N = S.length / 6, L = s;
    function at(sv, out) {
      out = out || {};
      sv = ((sv % L) + L) % L;
      var lo = 0, hi = N - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (S[mid * 6 + 5] <= sv) lo = mid; else hi = mid; }
      var p = lo * 6, q = hi * 6, d = S[q + 5] - S[p + 5], f = d > 0 ? (sv - S[p + 5]) / d : 0;
      out.x = S[p] + (S[q] - S[p]) * f; out.y = S[p + 1] + (S[q + 1] - S[p + 1]) * f; out.z = S[p + 2] + (S[q + 2] - S[p + 2]) * f;
      out.b = S[p + 3] + (S[q + 3] - S[p + 3]) * f; out.c = S[p + 4] + (S[q + 4] - S[p + 4]) * f;
      return out;
    }
    function each(fn) { for (var n = 0; n < N; n++) fn(S[n * 6], S[n * 6 + 1], S[n * 6 + 2], S[n * 6 + 3], S[n * 6 + 4], S[n * 6 + 5]); }
    return { len: L, marks: marks, at: at, each: each };
  }
  /* a climb (rise > 0) or a drop over a ground run: [pitch arc, straight, pitch arc back], the
     angle solved so the piece is exactly `run` long on the ground */
  function slope(rise, run, rp) {
    var h = Math.abs(rise), lo = 5, hi = 89, A = 45, sg = rise > 0 ? 1 : -1;
    function runOf(a) { var r = a * DEG; return 2 * rp * Math.sin(r) + (h - 2 * rp * (1 - Math.cos(r))) / Math.tan(r); }
    for (var n = 0; n < 48; n++) { A = (lo + hi) / 2; if (runOf(A) > run) lo = A; else hi = A; }
    return [['p', sg * A, rp], ['f', (h - 2 * rp * (1 - Math.cos(A * DEG))) / Math.sin(A * DEG)], ['p', -sg * A, rp]];
  }

  /* ---------------- the four routes (item metres) ---------------- */
  var TR = { z: 0.5, xa: 0.75, rc: 0.3125, y: 0.1875, cars: [0.5, 0, -0.5], rail: 0.15625, signal: [0.5625, 1.125, 0.09375], up: 55, funnel: [0.09375, 0.5, 0] };
  var DG = { z: 0.4375, a: 0.4375, y: 0.125, laps: 1.25, gap: 0.5, shove: 0.06, tilt: 4 };
  var FL = { zp: 0.5, x1: 1, zt: -0.5, xc: -0.375, y0: 0.125, y1: 2, rc: 0.25, rb: 0.1875, r3: 0.125, x0: 0.3125, tip: 0.55, skim: [2.4, 2.9], period: 2.4 };
  var CO = { z: 0.625, xs: 1.625, rc: 0.25, y: 0.3125, peak: 2.3125, loopX: 1, R: 0.6875, A: 55, rp: 0.2, flat: 0.625, keys: [0, 0.38, 0.47, 0.8, 1] };
  /* the coaster's lift climbs at CO.A up the left side, round the back-left corner and on to the peak */
  (function () {
    var a = CO.A * DEG, arcs = 2 * CO.rp * (1 - Math.cos(a));
    CO.d1 = (2 * CO.z - 2 * CO.rc - CO.rp * Math.sin(a)) / Math.cos(a);
    CO.d2 = (CO.peak - CO.y - arcs - CO.d1 * Math.sin(a) - Math.PI / 2 * CO.rc * Math.tan(a)) / Math.sin(a);
    CO.xPeak = -(CO.xs - CO.rc) + CO.d2 * Math.cos(a) + CO.rp * Math.sin(a);
  }());
  var ROUTES = {
    train: route(1, [0, TR.y, TR.z], [['f', TR.xa], ['y', 90, TR.rc], ['f', 2 * TR.z - 2 * TR.rc], ['y', 90, TR.rc], ['f', 2 * TR.xa],
      ['y', 90, TR.rc], ['f', 2 * TR.z - 2 * TR.rc], ['y', 90, TR.rc], ['f', TR.xa]]),
    dodgems: route(1, [0, DG.y, DG.z], [['f', DG.a], ['y', 180, DG.z], ['f', 2 * DG.a], ['y', 180, DG.z], ['f', DG.a]]),
    flume: route(1, [FL.x0, FL.y0, FL.zp], [['f', FL.x1 - FL.rc - FL.x0], ['y', 90, FL.rc], ['f', FL.zp - FL.zt - 2 * FL.rc], ['y', 90, FL.rc]]
      .concat(slope(FL.y1 - FL.y0, FL.x1 - FL.rc - (FL.xc + FL.rb + G16), 0.2), [['f', G16], ['y', 90, FL.rb]],
        slope(FL.y0 - FL.y1, FL.zp - FL.r3 - (FL.zt + FL.rb), 0.15), [['y', 90, FL.r3], ['f', FL.x0 - FL.xc - FL.r3]])),
    coaster: route(-1, [0, CO.y, CO.z], [['f', CO.xs - CO.rc], ['y', -90, CO.rc], ['p', CO.A, CO.rp], ['f', CO.d1], ['y', -90, CO.rc], ['f', CO.d2], ['p', -CO.A, CO.rp], ['f', G16]]
      .concat(slope(CO.y - CO.peak, CO.loopX - CO.flat - CO.xPeak - G16, CO.rp),
        [['f', CO.flat], ['p', 360, CO.R], ['f', CO.xs - CO.rc - CO.loopX], ['y', -90, CO.rc], ['f', 2 * CO.z - 2 * CO.rc], ['y', -90, CO.rc], ['f', CO.xs - CO.rc]]))
  };
  CO.dist = [0, ROUTES.coaster.marks[7], ROUTES.coaster.marks[12], ROUTES.coaster.marks[13], ROUTES.coaster.len];   /* station, crest, loop in, loop out, station */
  FL.sLift = [ROUTES.flume.marks[4], ROUTES.flume.marks[7]];              /* the lift's belt */
  FL.sBrink = ROUTES.flume.marks[9]; FL.sLand = ROUTES.flume.marks[12];   /* the chute: from the brink to the pool */
  var _r = {};
  function anchorsOf(rt, prefix, n, steps, into) {
    for (var q = 0; q < n; q++) { rt.at(rt.len * q / steps, _r); into[prefix + q] = [_r.x, _r.y, _r.z]; }
    return into;
  }

  /* ================================================================
     VOXELS (pure)
     ================================================================ */
  function grid(g) { return VX().grid({ grid: g, origin: [0, 0, 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from grids (each keeps its own); o.pivots {name: [x, y, z]} and o.anchors {name:
     [x, y, z, pivot?]} in item metres; o.cull / o.ao as the model format */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (g) { m.layers.push({ vox: g.snapshot() }); g.issues.forEach(function (s) { issues.push(s); }); });
    Object.keys(o.pivots || {}).forEach(function (n) { m.pivots[n] = { at: U(o.pivots[n]), parent: null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    if (o.cull) m.cull = o.cull;
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  function vi(v, g) { return Math.floor(v / g + 1e-6); }
  var WHITE = 'Cloud White', MID = 'mid';

  /* ---------------- pier_swingship ---------------- */
  var SHIP = { pivot: [0, 2.1875, 0], seat: [0.75, 0.75, 0], spot: [0, 0, 0.42], deg: 40 };
  /* the sail, bottom row first; '#' = its sun: a disc and four corner rays (never a five-point shape) */
  var SAIL = ['#yyyy#', 'yy##yy', 'y####y', 'y####y', 'yy##yy', '#yyyy#'];
  function shipVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), i, j;
    /* the A-frame stands behind the boat (in front it would hide the sail and the pet): two legs
       that lean 0.125 u in for every 0.25 u of height, in 0.5 u blue / white stripes, on wide feet */
    for (j = 0; j < 20; j++) for (i = (lite ? 7 : 8) - (j >> 1); i <= 10 - (j >> 1); i++) g.set(i, j, -3, lite || (j >> 2) & 1 ? 'b' : 'w').set(-1 - i, j, -3, lite || (j >> 2) & 1 ? 'b' : 'w');
    g.box(7, 10, 0, 0, -3, -3, 'b').box(-11, -8, 0, 0, -3, -3, 'b');
    g.box(-7, 6, 0, 0, -2, 1, 'd');                                       /* the boarding deck */
    g.box(-1, 0, 17, 17, -2, 1, 'k').box(-1, 0, 16, 18, 2, 2, 'y');       /* the pivot bar out from the apex, its hub cap */
    g.box(-1, 0, 20, 20, -3, -3, 'y');                                    /* a finial */
    g.group('swing', function () {
      [[4, -5, 4, 'y'], [5, -7, 6, 'c'], [6, -8, 7, 'c'], [7, -9, 8, 'c']].forEach(function (r) { g.box(r[1], r[2], r[0], r[0], -2, 1, r[3]); });
      g.box(-7, 6, 6, 6, -1, 0, null).box(-8, 7, 7, 7, -1, 0, null);      /* the open hull */
      g.box(-10, 9, 8, 8, -2, 1, 'w').box(-9, 8, 8, 8, -1, 0, null);      /* the white rail */
      g.box(9, 9, 9, 10, -2, 1, 'c').box(9, 9, 11, 11, -1, 0, 'y').box(-10, -10, 9, 9, -2, 1, 'c');   /* the curled bow, the stern */
      [-6, -3, 3].forEach(function (a) { g.box(a, a, 6, 6, -1, 0, 's'); });                           /* seat rows */
      g.box(-1, 0, 6, 16, -1, 0, 'm');                                    /* the mast the boat hangs by */
      SAIL.forEach(function (row, n) { for (i = 0; i < 6; i++) g.box(i - 3, i - 3, 10 + n, 10 + n, -1, 0, row[i] === '#' && !lite ? 'c' : 'y'); });
    });
    return model('pier_swingship', {
      b: 'PX Pier Stripe Blue', w: WHITE, d: { token: 'PX Pier Plank', mode: 'plank' }, k: 'PX Castle Iron', y: 'PX Sunny', c: 'PX Coral',
      s: { token: 'PX Cream', lod: MID }, m: 'PX Pier Pile' }, [g],
      { pivots: { swing: SHIP.pivot }, anchors: { seat: SHIP.seat.concat('swing'), spot: SHIP.spot }, cull: [], ao: false });
  }

  /* ---------------- pier_train ---------------- */
  /* a wagon on the G16 grid: a dark chassis i0..i1 on the rails, coral wheels (MID / HIGH) */
  function chassis(o, i0, i1) {
    o.box(i0, i1, 3, 4, 6, 9, 'd');
    [5, 10].forEach(function (k) { o.box(i0 + 1, i0 + 2, 3, 4, k, k, 'o').box(i1 - 2, i1 - 1, 3, 4, k, k, 'o'); });
  }
  function inHill(x, z) { return x > 0.3 && z < -0.2; }
  function trainVoxels(st, o) {
    var lite = !!(o && o.lite), base = grid([G8, G16, G8]), hill = grid(G8), t = grid(G16), rt = ROUTES.train, i, n;
    base.box(-11, 10, 0, 0, -7, 6, 'S');
    [[-11, -7], [10, -7], [-11, 6], [10, 6]].forEach(function (c) { base.clear(c[0], 0, c[1]); });
    /* the tunnel hill over the back-right bend: a solid mint mound, a lighter cap, a little tree */
    hill.box(2, 10, 0, 6, -7, -2, 'h').box(4, 10, 7, 7, -7, -4, 'H').box(7, 10, 8, 8, -7, -5, 'H');
    hill.set(8, 9, -6, 'q').box(7, 9, 10, 10, -7, -5, 'g').box(8, 9, 11, 11, -6, -5, 'g');
    /* its two portals: a dark recess the train drives into, under a striped arch */
    hill.box(7, 9, 0, 5, -2, -2, null).box(7, 9, 0, 5, -3, -3, 'D').box(2, 2, 0, 5, -6, -3, null).box(3, 3, 0, 5, -6, -3, 'D');
    hill.box(6, 10, 0, 6, -1, -1, function (a, j) { return j < 6 && a > 6 && a < 10 ? null : lite || ((j >> 1) + a) & 1 ? 'c' : 'w'; });
    hill.box(1, 1, 0, 6, -7, -2, function (a, j, k) { return j < 6 && k > -7 && k < -2 ? null : lite || ((j >> 1) + k) & 1 ? 'c' : 'w'; });
    /* the platform under its striped canopy */
    hill.box(-6, -1, 0, 1, -1, 1, 'p');
    [[-6, -1], [-1, -1], [-6, 1], [-1, 1]].forEach(function (c) { hill.box(c[0], c[0], 2, 5, c[1], c[1], 'w'); });
    hill.box(-7, 0, 6, 6, -2, 2, function (a) { return !lite && ((a + 7) >> 1) & 1 ? 'w' : 'c'; });
    for (i = -7; i <= 0 && !lite; i += 4) hill.box(i, i + 1, 5, 5, 2, 2, 'C');
    /* sleepers on the straights, rails all the way round (G16; the bends on MID / HIGH); none inside the hill */
    for (n = 0; n < 24; n++) {
      rt.at(rt.len * n / 24, _r);
      if (Math.abs(_r.b % 90) > 1 || inHill(_r.x, _r.z)) continue;
      var ci = vi(_r.x, G16), ck = vi(_r.z, G16);
      if (Math.abs(Math.cos(_r.b * DEG)) > 0.5) t.box(ci - 1, ci, 1, 1, ck - 4, ck + 3, 'q'); else t.box(ci - 4, ci + 3, 1, 1, ck - 1, ck, 'q');
    }
    rt.each(function (x, y, z, b) {
      var lx = Math.sin(b * DEG), lz = Math.cos(b * DEG);
      if (!lite && !inHill(x, z)) [-TR.rail, TR.rail].forEach(function (w) { t.set(vi(x + lx * w, G16), 2, vi(z + lz * w, G16), Math.abs(b % 90) > 1 ? 'Q' : 'R'); });
    });
    /* the signal: a banded post, a warm lamp, the arm on 'signal' */
    t.box(7, 8, 1, 19, 1, 2, function (a, j) { return j % 6 > 3 ? 'r' : 'w'; }).box(7, 8, 20, 21, 1, 2, 'L');
    t.group('signal', function () { t.box(9, 14, 17, 18, 1, 1, function (a) { return a > 12 ? 'w' : 'r'; }); });
    /* the engine (no face, no number) and two open carriages, 0.5 u apart on the front straight */
    t.group('t0', function () {
      chassis(t, 4, 11);
      t.box(4, 11, 5, 5, 5, 10, 'b').box(7, 11, 6, 8, 6, 9, 'b').box(4, 6, 6, 9, 5, 10, 'b').box(8, 8, 6, 8, 6, 9, 'y');
      t.box(3, 7, 10, 10, 5, 10, 'w').box(9, 10, 9, 10, 7, 8, 'y').box(12, 12, 4, 5, 6, 9, 'r');
      t.set(5, 8, 5, 'w').set(5, 8, 10, 'w');
    });
    [['t1', -3, 'k'], ['t2', -11, 'y']].forEach(function (c) {
      t.group(c[0], function () {
        var a = c[1];
        chassis(t, a, a + 5);
        t.box(a, a + 5, 5, 6, 5, 10, c[2]).box(a, a + 5, 7, 7, 5, 10, 'w').box(a + 1, a + 4, 6, 7, 6, 9, null);
        t.set(a + 6, 4, 7, 'd').set(a + 6, 4, 8, 'd');                    /* the coupling */
      });
    });
    var anchors = anchorsOf(rt, 'r', 12, 12, { seat: [0, 0.375, TR.z, 't1'], spot: [0, G16, 0.8] });
    return model('pier_train', {
      S: { token: 'PX Pier Sand 2', mode: 'soft' }, h: { token: 'PX Mint', mode: 'soft' }, H: { token: 'PX Aurora Mint', mode: 'soft' }, D: 'PX Ink Eye',
      g: { token: 'PX Leaf', mode: 'leaf' }, c: 'PX Coral', w: WHITE, C: { token: 'PX Coral', lod: MID }, p: { token: 'PX Pier Plank', mode: 'plank' },
      q: 'PX Pier Pile', R: 'Chrome', Q: { token: 'Chrome', lod: MID }, r: 'PX Coral', o: { token: 'PX Coral', lod: MID }, L: { token: 'PX Bulb Warm', mode: 'glow' },
      d: 'PX Castle Iron', b: 'PX Pier Stripe Blue', y: 'PX Sunny', k: 'PX Candy Pink' }, [base, hill, t],
      { pivots: { t0: [TR.cars[0], TR.y, TR.z], t1: [TR.cars[1], TR.y, TR.z], t2: [TR.cars[2], TR.y, TR.z], signal: TR.signal }, anchors: anchors, ao: false });
  }

  /* ---------------- pier_dodgems ---------------- */
  var CAR_TOKENS = ['PX Coral', 'PX Mint', 'PX Sunny', 'PX Pier Stripe Blue'];
  /* car n parks in bay (n + 2) % 4: 0 front (nose +x), 1 right end (nose −z), 2 back, 3 left end */
  function bayOf(n) { return (n + 2) % 4; }
  /* a round-nosed car on the G16 grid in its bay: local (u along the nose, v up, w across), in half voxels */
  function dodgem(o, n, lite) {
    var q = bayOf(n), body = String(n);
    ROUTES.dodgems.at(ROUTES.dodgems.len * q / 4, _r);
    var cx = Math.round(_r.x / G16), cz = Math.round(_r.z / G16);
    function put(u, v, w, c) {
      var x = q === 0 ? u : q === 1 ? w : q === 2 ? -u : -w, z = q === 0 ? w : q === 1 ? -u : q === 2 ? -w : u;
      o.set(cx + x - 0.5, 2 + v, cz + z - 0.5, c);
    }
    function slab(u0, u1, v0, v1, w1, c, cut) {
      for (var v = v0; v <= v1; v++) for (var u = u0; u <= u1; u++) for (var w = -w1; w <= w1; w++) {
        if (!cut || Math.abs(u) !== cut[0] || Math.abs(w) !== cut[1]) put(u, v, w, c);
      }
    }
    o.group('car' + n, function () {
      slab(-4.5, 4.5, 0, 1, 3.5, 'k', [4.5, 3.5]);                        /* the fat bumper */
      slab(-3.5, 3.5, 2, 3, 2.5, body, [3.5, 2.5]);
      slab(0.5, 2.5, 4, 4, 1.5, body);                                    /* the round nose */
      slab(-3.5, -3.5, 4, 5, 1.5, body);                                  /* the seat back */
      slab(-2.5, -0.5, 3, 3, 1.5, null); slab(-2.5, -0.5, 2, 2, 1.5, 'e');
      if (!lite) { put(-0.5, 3, 0.5, 'G'); put(-0.5, 3, -0.5, 'G'); put(3.5, 3, 1.5, 'T'); put(3.5, 3, -1.5, 'T'); }
      for (var v = 4; v <= 17; v++) put(-4.5, v, 0.5, 'o');               /* the pole up to the grid */
      slab(-4.5, -3.5, 18, 19, 0.5, 'B');                                 /* its steady bulb */
    });
    return [_r.x, DG.y, _r.z];
  }
  function dodgemsVoxels(st, o) {
    var lite = !!(o && o.lite), f = grid(G8), d = grid(G16), pivots = {}, n;
    function rim(i, k) { return i < -9 || i > 8 || k < -6 || k > 5; }
    f.box(-11, 10, 0, 0, -7, 6, function (i, j, k) { return rim(i, k) ? 'r' : lite || (Math.floor((i + 9) / 3) + Math.floor((k + 6) / 3)) & 1 ? 'l' : 'w'; });
    f.box(-11, 10, 1, 1, -7, 6, function (i, j, k) { return rim(i, k) ? 'r' : null; });
    [[-11, -7], [10, -7], [-11, 6], [10, 6]].forEach(function (c) {
      f.box(c[0], c[0], 2, 10, c[1], c[1], function (i, j) { return lite || Math.floor((j - 2) / 3) & 1 ? 'l' : 'w'; }).set(c[0], 12, c[1], 'y');
    });
    f.box(-11, 10, 11, 11, -7, 6, function (i, j, k) {                    /* the ring canopy, in 0.5 u stripes */
      return i > -11 && i < 10 && k > -7 && k < 6 ? null : lite || ((k === -7 || k === 6 ? i + 11 : k + 7) >> 2) & 1 ? 'y' : 'w';
    });
    if (!lite) {                                                           /* the open pole grid under it */
      [-8, -1, 7].forEach(function (k) { d.box(-20, 19, 22, 22, k, k, 'g'); });
      [-15, -8, -1, 7, 14].forEach(function (i) { d.box(i, i, 22, 22, -12, 11, 'g'); });
    }
    for (n = 0; n < 4; n++) pivots['car' + n] = dodgem(d, n, lite);
    var pal = { r: 'PX Coral', l: 'PX Lilac', w: WHITE, y: 'PX Sunny', g: { token: 'Pebble', lod: MID }, k: 'PX Castle Iron', e: 'PX Ink Eye',
      G: { token: 'Chrome', lod: MID }, T: { token: 'PX Bulb Warm', mode: 'glow', lod: MID }, o: 'Chrome', B: { token: 'PX Bulb Warm', mode: 'glow' } };
    CAR_TOKENS.forEach(function (tk, c) { pal[String(c)] = tk; });
    var seat = pivots.car2;
    return model('pier_dodgems', pal, [f, d], { pivots: pivots, anchors: { seat: [seat[0] - 0.09375, 0.3125, seat[2], 'car2'], spot: [0, 0, 0.9] }, ao: false });
  }

  /* ---------------- pier_flume ---------------- */
  /* a hollow log boat on the G16 grid (len × 4 × 6 voxels) from its low corner: lighter cut ends, no face */
  function logInto(o, i0, j0, k0, len) {
    var i1 = i0 + len - 1;
    o.box(i0 + 1, i1 - 1, j0, j0, k0 + 1, k0 + 4, 'n').box(i0, i1, j0 + 1, j0 + 2, k0, k0 + 5, 'n').box(i0 + 1, i1 - 1, j0 + 3, j0 + 3, k0, k0 + 5, 'n');
    o.box(i0 + 2, i1 - 2, j0 + 2, j0 + 3, k0 + 1, k0 + 4, null);
    [i0, i1].forEach(function (i) { o.box(i, i, j0 + 1, j0 + 2, k0 + 1, k0 + 4, 'E'); });
  }
  function flumeVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), lg = grid(G16), rt = ROUTES.flume, i, j, k;
    /* the pool: a white rim round turquoise water */
    g.box(-7, 10, 0, 1, 1, 6, 'W').box(-6, 9, 0, 0, 2, 5, 'u').box(-6, 9, 1, 1, 2, 5, null);
    /* the top station, where the second log waits */
    g.box(-11, -6, 15, 16, -7, -2, 'W').box(-10, -6, 15, 15, -6, -3, 'v').box(-10, -6, 16, 16, -6, -3, null);
    /* the trough along the route: side channel, lift, top channel, chute (water wins over walls) */
    rt.each(function (x, y, z, b, c, s) {
      if (z >= 0.25) return;                                               /* the pool has its own basin */
      var lx = Math.sin(b * DEG), lz = Math.cos(b * DEG), jj = Math.round(y / G8) - 1;
      var belt = s > FL.sLift[0] && s < FL.sLift[1], n = Math.floor(s / G8);
      for (var w = -2.5; w <= 2.5; w++) {
        var a = vi(x + lx * w * G8, G8), d = vi(z + lz * w * G8, G8), was = g.get(a, jj, d);
        if (d > 1) continue;
        if (Math.abs(w) > 2) { if (!was || was === 'W') g.set(a, jj, d, 'W').set(a, jj + 1, d, 'W'); continue; }
        g.set(a, jj, d, belt ? (n & 1 ? 'q' : 'p') : lite ? 'v' : n % 4 === 0 ? 'a' : n % 4 === 2 ? 'b' : 'v');
        if (g.get(a, jj + 1, d) === 'W') g.clear(a, jj + 1, d);
      }
    });
    g.box(-7, -5, 15, 15, -6, -3, 'v').box(-7, -5, 16, 16, -6, -3, null);    /* the station opens onto the brink */
    /* the hill: everything under the trough, then the stepped rock in front of it */
    var bd = g.bounds();
    for (k = bd.lo[2]; k <= bd.hi[2]; k++) for (i = bd.lo[0]; i <= bd.hi[0]; i++) {
      for (j = 1; j <= bd.hi[1] && !g.has(i, j, k); j++) { /* up to the lowest voxel of this column */ }
      if (j <= bd.hi[1] && !g.has(i, 0, k)) g.box(i, i, 0, j - 1, k, k, 'h');
    }
    g.box(-11, -7, 0, 11, -1, -1, 'h').box(-11, -8, 0, 8, 0, 0, 'h').box(-11, -9, 0, 4, 1, 3, 'h').box(-11, -10, 0, 1, 4, 5, 'h');
    g.box(0, 1, 0, 10, -1, -1, 'h').box(0, 2, 0, 7, 0, 0, 'h').box(2, 3, 0, 7, -1, -1, 'h').box(3, 4, 0, 3, 0, 0, 'h').box(4, 4, 0, 4, -1, -1, 'h');
    g.box(-11, -9, 12, 12, -1, -1, 'H').box(-11, -10, 9, 9, 0, 0, 'H').box(0, 1, 11, 11, -1, -1, 'H').set(-11, 5, 2, 'H').set(4, 4, 0, 'H');
    g.box(-11, -11, 4, 6, -5, -4, 'H').box(-11, -11, 10, 11, -6, -4, 'H').box(-11, -11, 7, 8, -2, -2, 'H');   /* lighter rock on the side */
    for (i = -5; i <= -2; i++) g.set(i, 0, 2, 'f').set(i, 0, 3, i & 1 ? 'f' : 'u');                     /* foam where the chute lands */
    /* the arch over the brink */
    g.box(-7, -7, 17, 18, -2, -2, 'W').box(0, 0, 17, 18, -2, -2, 'W');
    g.box(-7, 0, 19, 19, -2, -2, function (a) { return lite || a & 1 ? 'c' : 'W'; });
    lg.group('log', function () { logInto(lg, 0, 1, 5, 10); });
    logInto(lg, -20, 31, -11, 8);
    if (!lite) [[-18, 26, -1], [-21, 20, 3], [3, 24, -1], [6, 16, 1], [-14, 18, 1]].forEach(function (p) {   /* blossoms on the rock */
      lg.box(p[0], p[0] + 1, p[1], p[1], p[2], p[2] + 1, 'F').set(p[0] + 2, p[1], p[2], 'G');
    });
    var anchors = anchorsOf(rt, 'f', 12, 11, { seat: [FL.x0, 0.1875, FL.zp, 'log'], spot: [0.6, 0, 0.9] });
    return model('pier_flume', {
      W: WHITE, u: { token: 'PX Pier Water 1', mode: 'soft' }, v: { token: 'PX Pier Stripe Blue', mode: 'soft' }, f: 'Foam',
      a: { token: 'PX Pier Stripe Blue', mode: 'soft', state: { key: 'ripple', off: 'PX Pier Stripe Blue', on: 'PX Pier Water 1', initial: 0 } },
      b: { token: 'PX Pier Water 1', mode: 'soft', state: { key: 'ripple', off: 'PX Pier Water 1', on: 'PX Pier Stripe Blue', initial: 0 } },
      q: 'PX Pier Pile', p: 'PX Pier Plank Shade', h: { token: 'PX Mint', mode: 'soft' }, H: { token: 'PX Aurora Mint', mode: 'soft' },
      F: { token: 'PX Candy Pink', lod: MID }, G: { token: 'PX Leaf', lod: MID }, c: 'PX Coral', n: 'PX Pier Pile', E: 'PX Tree Bark Trail 2' }, [g, lg],
      { pivots: { log: [FL.x0, FL.y0, FL.zp] }, anchors: anchors, cull: [], ao: false });
  }

  /* ---------------- pier_coaster ---------------- */
  var BULBS = 10;
  function coasterVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), cg = grid(G16), rt = ROUTES.coaster, n;
    /* the tube track: two voxels wide, one thick, along the route */
    rt.each(function (x, y, z, b) {
      var lx = Math.sin(b * DEG), lz = Math.cos(b * DEG);
      [-0.5, 0.5].forEach(function (w) { g.set(vi(x + lx * w * G8, G8), vi(y, G8), vi(z + lz * w * G8, G8), 't'); });
    });
    for (n = 0; n < BULBS && !lite; n++) {                                  /* the loop's bulbs, in its front row */
      var a = (n + 0.5) * TAU / BULBS, bi = vi(CO.loopX + CO.R * Math.sin(a), G8), bj = vi(CO.y + CO.R * (1 - Math.cos(a)), G8);
      if (g.has(bi, bj, -5)) g.set(bi, bj, -5, 'B');
    }
    /* striped stilts under the track: a pair of columns from the ground to the lowest track voxel */
    function stilt(i, k, alongZ) {
      for (var e = 0; e < 2; e++) {
        var a2 = alongZ ? i : i + e, k2 = alongZ ? k + e : k, top = 1;
        while (top < 24 && !g.has(a2, top, k2)) top++;
        for (var j = 0; j < top && top < 24; j++) g.set(a2, j, k2, lite || (j >> 1) & 1 ? 'w' : 'b');
      }
    }
    [-11, -6, -1, 4, 9].forEach(function (i) { stilt(i, 4, true); });
    [-1, 2].forEach(function (k) { stilt(12, k, false); });
    [3, 0, -3].forEach(function (k) { stilt(-14, k, false); });
    [-11, -8, -3, 1, 4, 10, 13].forEach(function (i) { stilt(i, -6, true); });
    g.box(-8, -8, 19, 20, -6, -6, 'w').box(-7, -6, 20, 20, -6, -6, 'c');   /* a pennant on the peak */
    /* the station: a plank platform under a sunny canopy with a white valance */
    g.box(-7, 6, 0, 1, 1, 2, 'p').box(-9, -8, 0, 0, 1, 2, 'p');
    [[-7, 1], [6, 1]].forEach(function (c) { g.box(c[0], c[0], 2, 8, c[1], c[1], 'w'); });
    g.box(-8, 7, 9, 9, 0, 3, function (a, j, k) { return k === 3 && !lite ? 'w' : 'y'; });
    for (n = -8; n <= 7 && !lite; n += 2) g.set(n, 8, 3, 'V');
    /* the 2-seat car, nose toward −x, on 'car' */
    cg.group('car', function () {
      cg.box(-5, 4, 6, 8, 7, 12, 'c').box(-5, -5, 8, 8, 7, 12, null).box(-5, -5, 6, 7, 8, 11, 'y');
      cg.box(-2, -1, 8, 8, 8, 11, 'e').box(2, 3, 8, 8, 8, 11, 'e').box(0, 0, 9, 9, 8, 11, 'c').box(4, 4, 9, 9, 8, 11, 'c');
      cg.box(-4, 3, 7, 7, 7, 7, 'w').box(-4, 3, 7, 7, 12, 12, 'w');
    });
    var anchors = anchorsOf(rt, 't', 16, 16, { seat: [-0.09375, 0.5625, CO.z, 'car'], spot: [0, 0, 0.9] });
    return model('pier_coaster', {
      t: 'PX Candy Pink', B: { token: 'PX Bulb Warm', mode: 'glow', state: { key: 'bulbs', off: 'PX Lamp Warm', on: 'PX Bulb Warm', initial: 1 } },
      b: 'PX Pier Stripe Blue', w: WHITE, p: { token: 'PX Pier Plank', mode: 'plank' }, y: 'PX Sunny', V: { token: WHITE, lod: MID }, c: 'PX Coral', e: 'PX Ink Eye' }, [g, cg],
      { pivots: { car: [0, CO.y, CO.z] }, anchors: anchors, cull: [], ao: false });
  }

  var BUILD = { pier_swingship: shipVoxels, pier_train: trainVoxels, pier_dodgems: dodgemsVoxels, pier_flume: flumeVoxels, pier_coaster: coasterVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no stripes, grid or trims), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     ANIMATION — pure poses (exported for the Node tests), then the handlers
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  var _p = {}, _q = {};
  /* the pose that carries a part resting at route distance s0 to distance s → out {b, c, x, y, z} */
  function ride(rt, s, s0, out) {
    rt.at(s0, _q); rt.at(s, _p);
    out.b = _p.b - _q.b; out.c = _p.c; out.x = _p.x - _q.x; out.y = _p.y - _q.y; out.z = _p.z - _q.z;
    return out;
  }
  /* train: wagon n (0 the engine) after k of a lap */
  function trainPose(n, k, out) { return ride(ROUTES.train, TR.cars[n] + clamp01(k) * ROUTES.train.len, TR.cars[n], out); }
  /* the signal arm: it drops as the engine whistles and lifts as the train pulls away */
  function signalDeg(t, k, wasUp) { return TR.up * Math.max(wasUp ? 1 - clamp01(t / 0.15) : 0, smooth(k / 0.12)); }
  /* dodgems: car n after k of its 1¼ laps from `shift` bays on; the yellow car (2) closes on the blue
     one ahead (3) as the lap peaks, and bob (0 … 1) is the soft bump between them */
  function dodgemPose(n, k, bob, shift, out) {
    var rt = ROUTES.dodgems, s0 = bayOf(n) * rt.len / 4, hump = Math.sin(Math.PI * clamp01(k)), meet = n === 2 ? 1 : n === 3 ? -1 : 0;
    ride(rt, s0 + ((shift || 0) / 4 + DG.laps * clamp01(k)) * rt.len + meet * hump * hump * (DG.gap / 2 - 0.02) - meet * DG.shove * (bob || 0), s0, out);
    out.c = meet * DG.tilt * (bob || 0);
    return out;
  }
  /* log flume: the log's route distance at act progress k and time t: a drift that slows to the
     brink (k < tip), the chute to the pool (k → 1), then the skim back to its rest */
  function flumeDist(k, t) {
    var x;
    if (k < FL.tip) { x = 1 - k / FL.tip; return FL.sBrink * (1 - x * x); }
    if (k < 1) { x = (k - FL.tip) / (1 - FL.tip); return FL.sBrink + (FL.sLand - FL.sBrink) * x * x; }
    x = 1 - clamp01((t - FL.skim[0]) / (FL.skim[1] - FL.skim[0]));
    return FL.sLand + (ROUTES.flume.len - FL.sLand) * (1 - x * x);
  }
  /* coaster: the car's route distance at lap progress k: CO.keys → CO.dist (a slow lift, a long look at the loop) */
  function coasterDist(k) {
    k = clamp01(k);
    for (var n = 1; n < CO.keys.length - 1 && k > CO.keys[n]; n++) { /* the stretch k is in */ }
    return CO.dist[n - 1] + (CO.dist[n] - CO.dist[n - 1]) * (k - CO.keys[n - 1]) / (CO.keys[n] - CO.keys[n - 1]);
  }
  /* the breathing of a light at hz: 1 → dim → 1, a cosine (never a flash); 1 under reduced motion */
  function breathe(t, hz, reduced) { return reduced ? 1 : 0.7 + 0.3 * Math.cos(TAU * hz * t); }

  /* ================================================================
     FACTORY — SL3D.defineVox('pier-b', K → {id: {voxels, lod1, act, idle?, forget}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], _o = {}, EP = [0, 0, 0];
    function pose(a, name, b, c, x, y, z) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[1] = b; R3[2] = c; P3[0] = x; P3[1] = y; P3[2] = z;
      pv.set(R3, P3, S3);
    }
    function onto(a, name, o) { pose(a, name, o.b, o.c, o.x, o.y, o.z); }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0); }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    /* the pet's part: pets-brain's generic seat perform on the live (pivoted) 'seat' anchor */
    function askPet(a, id) {
      var p = a.pets;
      if (!p || typeof p.perform !== 'function') return;
      try { p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { /* no crew yet */ }
    }
    /* per-copy memory (the signal's arm, the dodgems' bays): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, up: false, shift: 0, level: -1 }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* one SLMotion act per uid: sample → apply, cues → sfx / fx; spec {apply(a, out, t, m), rest(a, m),
       end?(a, m), at?(cue, out) → local point} */
    function run(a, id, spec) {
      var name = ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var o = { reduced: !!a.reduced }, dur = M.durOf(name, o), cues = M.cues(name, o), ci = 0, out = {}, done = false, uid = a.uid, m = mem(a);
      var me = { name: name, dur: dur };
      live.set(uid, me);
      askPet(a, id);
      function stop() { done = true; if (live.get(uid) === me) live.delete(uid); }
      me.update = function (h, tAct) {
        if (done || live.get(uid) !== me) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur;
        M.sample(name, tt, out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.sfx) { if (typeof h.sfx === 'function') h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step); }
            else if (c.emit && typeof h.emit === 'function') h.emit(c.emit, (c.emit !== 'sparkle' && spec.at && spec.at(c, out)) || 'top', c.n || 1);
          } catch (e) { /* a cue never stops its act */ }
        }
        if (t < dur) { spec.apply(h, out, tt, m); return true; }
        stop();
        if (spec.end) spec.end(h, m);
        spec.rest(h, m);
        return false;
      };
      me.cancel = function () { if (!done) { stop(); try { spec.rest(a, m); } catch (e) { /* the copy is gone */ } } };
      return me;
    }

    /* ---------- swing ship: ±40° about the bar, twice, dying away ---------- */
    var shipSpec = { apply: function (a, out) { pose(a, 'swing', 0, SHIP.deg * (out.swing || 0), 0, 0, 0); }, rest: function (a) { rest(a, 'swing'); } };

    /* ---------- mini train: one lap; the signal lifts; three funnel puffs ---------- */
    function trainRest(a, m) { for (var n = 0; n < 3; n++) rest(a, 't' + n); pose(a, 'signal', 0, m.up ? TR.up : 0, 0, 0, 0); }
    var trainSpec = {
      apply: function (a, out, t, m) {
        for (var n = 0; n < 3; n++) onto(a, 't' + n, trainPose(n, out.k || 0, _o));
        pose(a, 'signal', 0, signalDeg(t, out.k || 0, m.up), 0, 0, 0);
      },
      rest: trainRest, end: function (a, m) { m.up = true; },
      at: function (c, out) {                                               /* the funnel top, wherever the engine is */
        trainPose(0, out.k || 0, _o);
        var b = _o.b * DEG, f = TR.funnel;
        EP[0] = TR.cars[0] + _o.x + f[0] * Math.cos(b); EP[1] = TR.y + f[1]; EP[2] = TR.z + _o.z - f[0] * Math.sin(b);
        return EP;
      }
    };

    /* ---------- dodgems: 1¼ laps, a soft bump, every car one bay on ---------- */
    function parkCars(a, m, k, bob) { for (var n = 0; n < 4; n++) onto(a, 'car' + n, dodgemPose(n, k, bob, m.shift, _o)); }
    var dodgemSpec = {
      apply: function (a, out, t, m) { parkCars(a, m, out.k || 0, out.bob || 0); },
      end: function (a, m) { m.shift = (m.shift + 1) % 4; },
      rest: function (a, m) { parkCars(a, m, 0, 0); }
    };

    /* ---------- log flume: round the channel, over the drop, a bob in the pool ---------- */
    var flumeSpec = {
      apply: function (a, out, t) {
        ride(ROUTES.flume, flumeDist(out.k || 0, t), 0, _o);
        pose(a, 'log', _o.b, _o.c + 5 * (out.bob || 0), _o.x, _o.y - 0.05 * (out.bob || 0), _o.z);
      },
      rest: function (a) { rest(a, 'log'); },
      at: function () { ROUTES.flume.at(FL.sLand, _o); EP[0] = _o.x; EP[1] = _o.y + 0.15; EP[2] = _o.z; return EP; }
    };
    var tiers = (LOOKS.pier_flume && LOOKS.pier_flume.idle && LOOKS.pier_flume.idle.tiers) || ['MID', 'HIGH'];
    var period = (LOOKS.pier_flume && LOOKS.pier_flume.idle && LOOKS.pier_flume.idle.period) || FL.period;
    /* the water stripes cross-fade (16 steps a cycle; still on LOW and under reduced motion) */
    function flumeIdle(a) {
      var m = mem(a), on = !a.reduced && tiers.indexOf(a.template && a.template.tier) >= 0;
      var v = on ? Math.round(8 * (1 - Math.cos(TAU * (+a.t || 0) / period))) / 16 : 0;
      if (v !== m.level) { m.level = v; setState(a, 'ripple', v); return true; }
      return on;
    }

    /* ---------- coaster: lift hill, loop, station; the loop's bulbs breathe ---------- */
    var hz = M && typeof M.freq === 'function' ? M.freq('breathe') : 1;
    var coasterSpec = {
      apply: function (a, out, t) {
        onto(a, 'car', ride(ROUTES.coaster, coasterDist(out.k || 0), 0, _o));
        setState(a, 'bulbs', breathe(t, hz, false));
      },
      rest: function (a) { rest(a, 'car'); setState(a, 'bulbs', 1); }
    };

    var SPEC = { pier_swingship: shipSpec, pier_train: trainSpec, pier_dodgems: dodgemSpec, pier_flume: flumeSpec, pier_coaster: coasterSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    out.pier_flume.idle = flumeIdle;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, voxels: voxels, lod1: lod1, factory: factory, ROUTES: ROUTES,
    LAYOUT: { ship: SHIP, train: TR, dodgems: DG, flume: FL, coaster: CO }, SAIL: SAIL, BULBS: BULBS, CAR_TOKENS: CAR_TOKENS,
    route: route, slope: slope, bayOf: bayOf, ride: ride, trainPose: trainPose, signalDeg: signalDeg, dodgemPose: dodgemPose,
    flumeDist: flumeDist, coasterDist: coasterDist, breathe: breathe
  };
}));
