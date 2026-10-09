/* ================================================================
   My Island v3 — SLPxPierA (W3.2a): six Funfair Pier rides in Pixel Blocks.
   window.SLPxPierA + SL3D.defineVox('pier-a', factory) in the browser, module.exports in Node.
   Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards
   and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the
   footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u.
     pier_mirrors       1×1  an open booth of striped canvas (lilac / white, wings stepping down to
                        the front so the glass is never hidden), a sunny scalloped pelmet under a ✦
                        sign, three ice-glass mirrors whose OUTLINES are the joke (one bulges, one is
                        pinched, one zigzags) and a coral mat on 'spot'. No reflection is drawn: the
                        act stretches the pet (a.pets.poseScale) while a pale shine slides down the
                        glass (three rows a mirror, state keys shine0 – shine2).
     pier_droptower     1×1  a 0.5 u coral / white banded mast on a plank base under a blue cap with
                        a sun on every side and four warm bulbs (state 'bulbs'). Four sunny benches
                        with armrests ride pivot 'ring' 1.5 u up the mast; anchor 'seat' rides it.
     pier_helter        1×1  a round tower in a coral / white helix, a lilac cone roof with a sunny
                        pennant and a sunny slide of two cells a step that winds exactly two turns
                        from the top door to a blue mat. Anchors s0 – s7 are every quarter turn of
                        the slide, then 'foot'. Nothing on it moves: the pet does. Its voxels are
                        0.12 u wide (seven are 0.84 u: seven G8 would not fit fp − 0.14).
     pier_carousel      2×2  a white / blue wedge platform, a drum of pastel panels, six sea
                        creatures on gold poles (2 dolphins, 2 turtles, 2 seahorses on m0 – m5 ⊂
                        'spin'; no horses) and a coral / white big top with a valance and 12 rim
                        bulbs (state 'bulbs') that breathe at night.
     pier_teacups       2×2  a white / mint turntable ('table') and three big cups on saucers
                        (cup0 – cup2 ⊂ table; cup0 is the pet's pink one, the other two are full of
                        tea) round a hub of sugar cubes on a stick with a ✦ on every side: never a
                        teapot. The stick is thin where the handles sweep, so no cup ever clips it.
     pier_flyingchairs  2×2  a mint / white column on a round plank base; a plain pink / white
                        stepped cone ('canopy') with a sunny ball and 8 rim bulbs (state 'bulbs');
                        six bucket seats, each on its G16 chain, hinge outward (c0 – c5 ⊂ canopy;
                        c0 is the pet's yellow one). Every seat hangs above y 1.0 and stays above it
                        as it swings, so it only leaves the footprint up there.
   GRAIN (D11): bodies G4 / G8; chains, poles, bulbs, handles, sea creatures and the booth's canvas G16.
   No corner AO (as the pier's big rides): on stripes, wedges and G16 parts it only splits quads.
   PARTS: the carousel and the chairs carry seven lookEntries pivots each (plus one bulb state
   part), so they have 8 and 9 parts where the kit's QA line is 6; every part is merge-eligible.
   LOW (D89): detail voxels are tagged lod 'mid'; every id also brings its own lod1 (its plain
   masses, halved) inside TRIS_CAPS_LOD1.
   ACTS run on SLMotion's own timelines (mirrors · droptower · slide · ride · teacups · chairs: ≤ 3 s;
   reduced motion = the end state at once with one sparkle and the same sounds). One live act per
   uid; a re-tap supersedes. The three turning rides stop where the turn ends: the turn is folded
   into the copy's resting pose, so nothing snaps back. Bulbs only breathe (≤ 1 Hz,
   ART3.FREQS.breathe) and the shine cross-fades; nothing chases or flashes. The pet's part is
   asked through a.pets.perform(LOOK.perform, uid). Nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.show a.batch · a.pivot(name).set(rotDeg[3], pos[3], scale[3])
   · a.state(key, v) · a.emit(kind, anchor, n) · a.sfx(name, vol, step) · a.pets {active, perform,
   poseScale?(petId, sx, sy)}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxPierA = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pier-a', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxPierA: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }

  var VERSION = 1, IDS = ['pier_mirrors', 'pier_droptower', 'pier_helter', 'pier_carousel', 'pier_teacups', 'pier_flyingchairs'];
  /* each id's SLMotion timeline and the pet's part (world-look LOOK.perform wins when it is there) */
  var ACT = { pier_mirrors: 'mirrors', pier_droptower: 'droptower', pier_helter: 'slide', pier_carousel: 'ride', pier_teacups: 'teacups', pier_flyingchairs: 'chairs' };
  var PERFORM = { pier_mirrors: 'pose', pier_droptower: 'seat:ride', pier_helter: 'slide', pier_carousel: 'ride', pier_teacups: 'seat:ride', pier_flyingchairs: 'seat:ride' };
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;

  /* ================================================================
     LAYOUT (item metres)
     ================================================================ */
  var MIR = { spot: [0, 0.0625, 0.25], rows: 3, tall: [0.8, 1.35], wide: [1.3, 0.7], hop: 0.1 };   /* pose scale [sx, sy] at the two extremes */
  var DROP = { ring: [0, 0.4375, 0], seat: [0, 0.5, 0.3125], spot: [0, 0, 0.45], travel: 1.5, dim: 0.45 };
  /* the helter's grid: fp − 0.14 leaves 0.86 u, and seven G8 voxels are 0.875, so its voxels are 0.12 u
     wide (7 = 0.84 u: a 5-voxel tower inside a 1-voxel slide). The slide is the 16 cells [i, k] round
     the tower, two a level, eight levels a turn (front → left → back → right going up) */
  var HEL = {
    w: 0.12, top: 16, foot: [0, 0.125, 0.36], spot: [0, 0.125, 0.36], trail: [[1.5, 's0'], [2, 's3']],
    lap: [[0, 3], [-1, 3], [-2, 2], [-3, 1], [-3, 0], [-3, -1], [-2, -2], [-1, -3], [0, -3], [1, -3], [2, -2], [3, -1], [3, 0], [3, 1], [2, 2], [1, 3]]
  };
  /* mounts m0 – m5: [x, z, quarter turns from facing +x, kind, body, trim, fins, its lowest G16 row];
     the platform turns anticlockwise seen from above, so each creature faces the way it travels */
  var CAR = {
    spin: [0, 0.25, 0], y: 0.75, seat: [-0.0625, 0.6875, 0.625], spot: [0, 0, 0.95], dim: 0.4,
    mounts: [[0.4375, -0.375, 1, 'dolphin', 'D', 'W', '1', 9], [0.4375, 0.375, 1, 'turtle', 'T', 'G', '3', 8], [0, 0.625, 0, 'seahorse', 'H', 'G', '4', 7],
             [-0.4375, 0.375, 3, 'dolphin', 'd', 'W', '2', 9], [-0.4375, -0.375, 3, 'turtle', 't', 'G', '3', 8], [0, -0.625, 2, 'seahorse', 'h', 'G', '5', 7]]
  };
  /* cups cup0 – cup2: [x, z, body]; every handle points the same way (+x) and every cup spins alike, so
     two handles never meet. The hub is an eight-sided foot under the saucers' sweep, a one-voxel G16
     stick where the handles sweep (y 0.5 – 0.875) and its sugar cubes above the rims */
  var CUP = {
    table: [0, 0.25, 0], seat: [0, 0.625, 0.5], spot: [0, 0, 0.95], turn: 180, reducedTurn: 45, spin: 360, ramp: 0.5,
    cups: [[0, 0.5, 'p'], [-0.4375, -0.25, 'y'], [0.4375, -0.25, 'b']]
  };
  /* chairs c0 – c5: [x, z, quarter turns from facing +x, colour]; the hinges are under the canopy's rim, and
     the pans hang from y 1.0625 so that not even their inner edge dips under y 1.0 as they swing out */
  var CHR = {
    canopy: [0, 2, 0], seat: [0, 1.1875, 0.75], spot: [0, 0, 0.95], turn: 270, reducedTurn: 45, out: 30, dim: 0.45,
    chairs: [[0, 0.75, 0, 'y'], [0.625, 0.375, 1, 'c'], [0.625, -0.375, 1, 'b'], [0, -0.75, 2, 'l'], [-0.625, -0.375, 3, 'c'], [-0.625, 0.375, 3, 'b']]
  };

  /* ================================================================
     BUILDER HELPERS (pure)
     ================================================================ */
  /* a builder grid: even (voxels −1 and 0 straddle the pivot) or odd (voxel 0 is centred on it) */
  function grid(g, odd) { return VX().grid({ grid: g, origin: [odd ? 0.5 : 0, 0, odd ? 0.5 : 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (each grid's own decals follow it); o.pivots
     {name: [x, y, z, parent?]} and o.anchors {name: [x, y, z, pivot?]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = Array.isArray(l) ? l[0] : l, n = m.layers.length;
      if (!g.count) return;
      m.layers.push(Array.isArray(l) ? { vox: g.snapshot(), at: l[1] } : { vox: g.snapshot() });
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { var p = o.pivots[n]; m.pivots[n] = { at: U(p), parent: p[3] || null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  var EVEN = { at: [-0.5, -0.5] };            /* a lathe centred between voxels −1 and 0 (even grids) */
  /* eight alternating wedges about that centre: exact integer tests, no trigonometry */
  function wedge(i, k) { var x = 2 * i + 1, z = 2 * k + 1; return ((x > 0) !== (z > 0)) !== (Math.abs(x) > Math.abs(z)); }
  /* cone tiers on an odd grid: the cross (within 22.5° of an axis) against the four quarters */
  function cross(i, k) { var a = Math.abs(i), b = Math.abs(k); return 12 * Math.min(a, b) <= 5 * Math.max(a, b); }
  /* which side of an even-grid drum a voxel is on: front 0, left 1, back 2, right 3 */
  function side(i, k) { var x = 2 * i + 1, z = 2 * k + 1; return Math.abs(z) > Math.abs(x) ? (z > 0 ? 0 : 2) : (x < 0 ? 1 : 3); }
  var WHITE = 'Cloud White', MID = 'mid', PLANK = { token: 'PX Pier Plank', mode: 'plank' };
  function mid(token) { return { token: token, lod: MID }; }       /* MID / HIGH detail: tier LOW drops it (D89) */
  /* warm bulbs that can dim: a glow part with a state colour (D51), lit at rest */
  var BULBS = { token: 'PX Bulb Warm', mode: 'glow', state: { key: 'bulbs', off: 'PX Lamp Off', on: 'PX Bulb Warm', initial: 1 } };

  /* ================================================================
     WOBBLY MIRRORS — one odd G16 grid (13 voxels wide: 0.8125 u)
     ================================================================ */
  /* each mirror's outline, bottom row → top (12 rows): the columns it fills about its centre */
  var GLASS = [
    function (t) { return t === 0 || t === 11 ? [0, 0] : [-1, 1]; },            /* bulging */
    function (t) { return t > 3 && t < 8 ? [0, 0] : [-1, 1]; },                 /* pinched */
    function (t) { return (t / 3 | 0) & 1 ? [-1, 0] : [0, 1]; }                 /* zigzag */
  ];
  function mirrorsVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G16, true), n, t;
    g.box(-6, 6, 0, 1, -6, 0, 'f');
    /* the back wall: striped outside, plain violet behind the glass */
    g.box(-6, 6, 2, 17, -6, -6, function (i) { return lite || ((Math.abs(i) + 2) >> 1) & 1 ? 'l' : 'w'; });
    g.box(-5, 5, 2, 17, -5, -5, 'v');
    [-6, 6].forEach(function (i) {                                          /* the wings step down toward the front */
      g.box(i, i, 2, 17, -5, -4, lite ? 'l' : 'w').box(i, i, 2, 13, -3, -2, 'l').box(i, i, 2, 9, -1, 0, lite ? 'l' : 'w');
    });
    /* the pelmet: a sunny beam on the wall, a valance in front of it with three scallops, the ✦ sign */
    g.box(-6, 6, 18, 18, -6, -4, 'y').box(-5, 5, 16, 17, -4, -4, 'y');
    g.box(-3, 3, 19, 25, -6, -5, 's');
    if (!lite) {
      g.box(-5, -4, 15, 15, -4, -4, 'Y').box(-1, 1, 15, 15, -4, -4, 'Y').box(4, 5, 15, 15, -4, -4, 'Y');
      g.decal('+z', [-3, 19, -5], [7, 7], 'sparkle').decal('-z', [-3, 19, -6], [7, 7], 'sparkle');
    }
    /* three mirrors on the wall; shine row q of mirror n sits a step lower on each mirror */
    for (n = 0; n < 3; n++) for (t = 0; t < 12; t++) {
      var span = GLASS[n](t), q = (9 - n - t) / 3, c = 4 * (n - 1);
      g.box(c + span[0], c + span[1], 3 + t, 3 + t, -4, -4, !lite && q === Math.floor(q) && q >= 0 && q < MIR.rows ? String(q) : 'g');
    }
    if (!lite) {
      for (n = 0; n < 3; n++) g.set(4 * (n - 1) - 1, 12, -4, 'x').set(4 * (n - 1), 13, -4, 'x');   /* a white glint on each */
      [-6, 6].forEach(function (i) { g.box(i, i, 10, 10, -1, 0, 'Y'); });
    }
    g.box(-4, 4, 0, 0, 2, 6, function (i, j, k) { return k === 4 && !lite ? 'w' : 'c'; });       /* the mat */
    var pal = { f: 'PX Lilac Base', l: 'PX Lilac', w: WHITE, v: 'PX Accent 5', y: 'PX Sunny', Y: mid('PX Sunny'), s: 'PX Accent 5', c: 'PX Coral',
      g: { token: 'PX Ice', mode: 'ice' }, x: 'PX Glint' };
    for (n = 0; n < MIR.rows; n++) pal[String(n)] = { token: 'PX Ice', mode: 'ice', state: { key: 'shine' + n, off: 'PX Ice', on: 'PX Glint', initial: 0 } };
    return model('pier_mirrors', pal, [g], { anchors: { spot: MIR.spot } });
  }

  /* ================================================================
     DROP TOWER — one even G8 grid (the base and the ring 6 voxels wide: 0.75 u)
     ================================================================ */
  function droptowerVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8);
    g.box(-3, 2, 0, 0, -3, 2, 'p');
    g.box(-2, 1, 1, 17, -2, 1, function (i, j) { return lite || !(((j - 1) >> 1) & 1) ? 'c' : 'w'; });
    g.box(-3, 2, 18, 21, -3, 2, 'b').box(-1, 0, 22, 22, -1, 0, 'y');
    [[-3, -3], [2, -3], [2, 2], [-3, 2]].forEach(function (p) { g.set(p[0], 22, p[1], 'B'); });
    if (!lite) g.decal('+z', [-2, 18, 2], [4, 4], 'sun').decal('-z', [-2, 18, -3], [4, 4], 'sun').decal('+x', [2, 18, -2], [4, 4], 'sun').decal('-x', [-3, 18, -2], [4, 4], 'sun');
    /* the ring: four benches (a pan with an armrest at each end) between four white corner blocks */
    g.group('ring', function () {
      for (var k = -3; k <= 2; k++) for (var i = -3; i <= 2; i++) {
        var ei = i === -3 || i === 2, ek = k === -3 || k === 2;
        if (!ei && !ek) continue;
        g.set(i, 3, k, ei && ek ? 'w' : 'y');
        if (ei && ek) g.set(i, 4, k, 'w');
        else if (i === -2 || i === 1 || k === -2 || k === 1) g.set(i, 4, k, lite ? 'y' : 'Y');
      }
    });
    return model('pier_droptower', { p: PLANK, b: 'PX Pier Stripe Blue', c: 'PX Coral', w: WHITE, y: 'PX Sunny', Y: mid('PX Sunny'), B: BULBS }, [g],
      { pivots: { ring: DROP.ring }, anchors: { spot: DROP.spot, seat: DROP.seat.concat('ring') } });
  }

  /* ================================================================
     HELTER-SKELTER — an odd [0.12, 0.125, 0.12] grid (tower 5 wide, slide 7 wide) + a G16 pole and pennant
     ================================================================ */
  /* the slide's two cells at level j (0 the mat … HEL.top the step by the door) */
  function helterStep(j) { var n = 2 * (j % 8); return [HEL.lap[n], HEL.lap[n + 1]]; }
  /* where round the lap (0 … 15) a tower voxel is: the slide cell it faces */
  var LAP_AT = {};
  HEL.lap.forEach(function (c, n) { LAP_AT[c[0] + ',' + c[1]] = n; });
  function lapOf(i, k) {
    var a = Math.abs(i), b = Math.abs(k), n = LAP_AT[(a > b ? 3 * (i > 0 ? 1 : -1) : i) + ',' + (a > b ? k : 3 * (k > 0 ? 1 : -1))];
    return n == null ? 0 : n;
  }
  /* anchors s0 (by the top door) … s7: the middle of the slide every quarter turn down, on its top face */
  function helterStops() {
    var out = [];
    for (var n = 0; n < 8; n++) {
      var j = HEL.top - 2 * n, c = helterStep(j);
      out.push([(c[0][0] + c[1][0]) * HEL.w / 2, (j + 1) * G8, (c[0][1] + c[1][1]) * HEL.w / 2]);
    }
    return out;
  }
  function helterVoxels(st, o) {
    var lite = !!(o && o.lite), g = VX().grid({ grid: [HEL.w, G8, HEL.w], origin: [0.5, 0, 0.5] }), f = grid(G16), anchors = { spot: HEL.spot, foot: HEL.foot }, j;
    /* the helix: the coral band starts just above the slide and is half a turn tall, all the way round */
    function stripe(i, j2, k) { return (lite ? (j2 >> 2) & 1 : ((2 * j2 - lapOf(i, k) - 1) & 15) < 8) ? 'c' : 'w'; }
    g.lathe([[2.5, 0, 18, stripe]]);
    g.box(-1, 0, 17, 18, 2, 2, 'd').box(2, 2, 1, 2, 0, 0, 'd');           /* the door at the top, the way in at the foot */
    g.lathe([[3.5, 19, 19, 'r'], [2.5, 20, 20, 'r'], [1.5, 21, 21, 'r']]);
    for (j = 0; j <= HEL.top; j++) helterStep(j).forEach(function (c) { g.set(c[0], j, c[1], j ? 's' : 'm'); });
    g.set(1, 0, 3, 'm');                                                    /* the mat is three wide */
    if (!lite) f.box(-1, 0, 44, 45, -1, 0, 'w').box(1, 3, 45, 45, 0, 0, 'y').box(1, 2, 44, 44, 0, 0, 'y');
    helterStops().forEach(function (p, n) { anchors['s' + n] = p; });
    return model('pier_helter', { c: 'PX Coral', w: WHITE, s: 'PX Sunny', y: mid('PX Sunny'), r: 'PX Lilac', m: 'PX Pier Stripe Blue', d: 'PX Penguin Back' },
      [g, f], { anchors: anchors });
  }

  /* ================================================================
     SEA-CREATURE CAROUSEL
     ================================================================ */
  /* a creature's side view on the G16 grid: rows top → bottom, x from x0, the bottom row at y 0;
     map: sprite char → [palette char, half its thickness] */
  function sprite(g, rows, x0, map) {
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) { var e = map[row[c]]; if (e) g.box(x0 + c, x0 + c, rows.length - 1 - r, rows.length - 1 - r, -e[1], e[1], e[0]); }
    });
  }
  /* the mounts, facing +x with the pole through column (0, 0): b = body, t = trim, f = fins palette
     chars (fins, flippers and crests are MID / HIGH detail) */
  var CREATURE = {
    dolphin: function (g, b, t, f) {
      sprite(g, ['.....f....', '....ff....', '..BBBBBBB.', 'TBBBBBBBBB', 'T.WWWWWWB.'], -5, { B: [b, 1], W: [t, 1], T: [b, 2], f: [f, 0] });
      g.set(2, 1, -1, 'e').set(2, 1, 1, 'e');
    },
    turtle: function (g, b, t, f) {
      g.box(-3, 3, 1, 2, -2, 2, b).box(-2, 2, 3, 3, -1, 1, b).box(-2, 2, 0, 0, -1, 1, t).set(0, 3, 0, t);
      [[-3, -2], [3, -2], [-3, 2], [3, 2]].forEach(function (p) { g.box(p[0], p[0], 1, 2, p[1], p[1], null); });
      g.box(4, 5, 1, 2, -1, 1, t).set(-4, 1, 0, t).set(5, 2, -1, 'e').set(5, 2, 1, 'e');
      [-3, 3].forEach(function (k) { g.box(1, 2, 1, 1, k, k, f).box(-2, -1, 1, 1, k, k, f); });
    },
    seahorse: function (g, b, t, f) {
      sprite(g, ['.fB....', 'fBBB...', '.BBBss.', '.BB....', 'fBB....', 'fBBB...', '.BBB...', '..BB...', '.BB....'], -2, { B: [b, 1], s: [b, 0], f: [f, 0] });
      g.set(1, 6, -1, 'e').set(1, 6, 1, 'e').box(0, 0, 2, 4, -1, 1, t);
    }
  };
  function carouselVoxels(st, o) {
    var lite = !!(o && o.lite), plat = grid(G8), top = grid(G4, true), rim = grid(G16), poles = grid(G16, true), mounts = grid(G16, true);
    var pivots = { spin: CAR.spin }, PAN = 'mpal';
    function seg(i, j, k) { return lite || cross(i, k) ? 'c' : 'w'; }
    plat.group('spin', function () {
      plat.lathe([[7, 0, 0, 'k'], [7, 1, 1, function (i, j, k) { return lite || wedge(i, k) ? 'b' : 'w'; }]], EVEN);
      plat.lathe([[2, 2, 11, function (i, j, k) { return lite ? 'l' : PAN[side(i, k)]; }]], EVEN);
      plat.box(-1, 0, 16, 16, -1, 0, 'y');
    });
    top.group('spin', function () { top.lathe([[3.5, 6, 6, seg], [2.5, 7, 7, seg]]); });
    /* under the rim: three bulbs a side with a valance tooth between them, a tooth under each corner */
    rim.group('spin', function () {
      for (var q = 0; q < 4; q++) {
        [-5, -1, 3].forEach(function (i) { rim.box(i, i + 1, 22, 23, 12, 13, 'B'); });
        if (!lite) { [-3, 1].forEach(function (i) { rim.box(i, i + 1, 22, 23, 12, 13, 'v'); }); rim.box(8, 9, 22, 23, 8, 9, 'v'); }
        rim.rotY90(1);
      }
    });
    CAR.mounts.forEach(function (mt, n) {
      var g = grid(G16, true), name = 'm' + n, x = mt[0] / G16, z = mt[1] / G16;
      g.group(name, function () { CREATURE[mt[3]](g, mt[4], mt[5], lite ? mt[4] : mt[6]); });
      mounts.merge(g.rotY90(mt[2]), [x, mt[7], z]);
      poles.group('spin', function () { poles.box(x, x, 4, 23, z, z, 'g'); });
      pivots[name] = [mt[0], CAR.y, mt[1], 'spin'];
    });
    return model('pier_carousel', {
      k: 'PX Lilac', w: WHITE, b: 'PX Pier Stripe Blue', c: 'PX Coral', y: 'PX Sunny', g: 'PX Castle Gold', v: mid(WHITE),
      m: 'PX Mint', p: 'PX Candy Pink', l: 'PX Lilac Base', a: 'PX Cream', e: 'PX Ink Eye',
      D: 'PX Pier Stripe Blue', d: 'PX Lilac', W: WHITE, T: 'PX Mint', t: 'PX Candy Pink', G: 'PX Cream', H: 'PX Sunny', h: 'PX Coral',
      1: mid('PX Pier Stripe Blue'), 2: mid('PX Lilac'), 3: mid('PX Cream'), 4: mid('PX Coral'), 5: mid('PX Sunny'), B: BULBS
    }, [plat, top, rim, poles, mounts], { pivots: pivots, anchors: { spot: CAR.spot, seat: CAR.seat.concat('m2') } });
  }

  /* ================================================================
     SPINNING TEACUPS
     ================================================================ */
  function teacupsVoxels(st, o) {
    var lite = !!(o && o.lite), tab = grid(G8), foot = grid(G16), fine = grid(G16, true), cube = grid(G8), layers, pivots = { table: CUP.table };
    tab.group('table', function () { tab.lathe([[7, 0, 0, 'k'], [7, 1, 1, function (i, j, k) { return lite || wedge(i, k) ? 'm' : 'w'; }]], EVEN); });
    /* the sugar-cube hub: a foot, a stick, a big cube with a ✦ on every side and a small one askew on top */
    foot.group('table', function () { foot.lathe([[2, 4, 7, 'l']], EVEN); });
    fine.group('table', function () { fine.box(0, 0, 8, 13, 0, 0, 'w').box(0, 2, 18, 20, -2, 0, 'w'); });
    cube.group('table', function () { cube.box(-1, 0, 7, 8, -1, 0, 'l'); });
    if (!lite) cube.decal('+z', [-1, 7, 0], [2, 2], 'sparkle').decal('-z', [-1, 7, -1], [2, 2], 'sparkle').decal('+x', [0, 7, -1], [2, 2], 'sparkle').decal('-x', [-1, 7, -1], [2, 2], 'sparkle');
    layers = [tab, foot, fine, cube];
    CUP.cups.forEach(function (at, n) {
      var cup = grid(G8, true), ear = grid(G16), name = 'cup' + n, c = at[2];
      cup.group(name, function () {
        cup.lathe([[2.5, 2, 2, 'W'], [1.5, 3, 3, c], [2.5, 4, 5, c], [2.5, 6, 6, 'W']]);          /* saucer, foot, bowl, rim */
        cup.box(-1, 1, 5, 6, -1, 1, null);
        if (n && !lite) cup.box(-1, 1, 5, 5, -1, 1, 't');                    /* tea in the two the pet does not ride */
      });
      ear.group(name, function () { ear.box(5, 6, 11, 11, -1, 0, c).box(5, 6, 8, 8, -1, 0, c).box(6, 6, 9, 10, -1, 0, c); });
      layers.push([cup, [at[0], 0, at[1]]], [ear, [at[0], 0, at[1]]]);
      pivots[name] = [at[0], CUP.table[1], at[1], 'table'];
    });
    return model('pier_teacups', {
      k: 'PX Lilac Base', w: WHITE, m: 'PX Mint', l: 'PX Lilac', W: WHITE, p: 'PX Candy Pink', y: 'PX Sunny', b: 'PX Pier Stripe Blue', t: mid('PX Waffle')
    }, layers, { pivots: pivots, anchors: { spot: CUP.spot, seat: CUP.seat.concat('cup0') } });
  }

  /* ================================================================
     FLYING CHAIRS
     ================================================================ */
  function chairsVoxels(st, o) {
    var lite = !!(o && o.lite), base = grid(G8), top = grid(G4, true), rim = grid(G16), seats = grid(G8, true), chains = grid(G16, true);
    var pivots = { canopy: CHR.canopy };
    function tier(i, j, k) { return lite || cross(i, k) ? 'k' : 'w'; }
    base.lathe([[5, 0, 0, 'p'], [2, 1, 1, 'w']], EVEN);
    base.box(-1, 0, 2, 15, -1, 0, function (i, j) { return lite || (j >> 1) & 1 ? 'm' : 'w'; });
    top.group('canopy', function () { top.lathe([[3.5, 8, 8, tier], [2.5, 9, 9, tier], [1.5, 10, 10, tier]]); });
    if (!lite) base.group('canopy', function () { base.box(-1, 0, 22, 22, -1, 0, 'y'); });       /* the sunny ball on its tip */
    /* eight bulbs under the rim, two a side, with a valance tooth between them, all clear of the chains */
    rim.group('canopy', function () {
      for (var q = 0; q < 4; q++) {
        [-5, 3].forEach(function (i) { rim.box(i, i + 1, 30, 31, 11, 12, 'B'); });
        if (!lite) rim.box(-1, 0, 30, 31, 11, 12, 'v');
        rim.rotY90(1);
      }
    });
    CHR.chairs.forEach(function (ch, n) {
      var g = grid(G8, true), name = 'c' + n, c = ch[3], x = ch[0] / G16, z = ch[1] / G16, alongX = !(ch[2] & 1);
      g.group(name, function () {
        g.box(-1, 1, 0, 0, -1, 1, c).box(-1, -1, 1, 2, -1, 1, c).box(0, 1, 1, 1, -1, -1, c).box(0, 1, 1, 1, 1, 1, c);     /* pan, back, two arms */
        if (!lite) g.box(-1, -1, 2, 2, -1, 1, 'w');                           /* a white top rail */
      });
      seats.merge(g.rotY90(ch[2]), [ch[0] / G8, 8, ch[1] / G8]);
      /* its chain: from the top of the seat's back up to the hinge line */
      chains.group(name, function () {
        var d = ch[2] === 0 || ch[2] === 3 ? -2 : 2, cx = alongX ? x + d : x, cz = alongX ? z : z + d;
        chains.box(cx, cx, 23, 31, cz, cz, 'i');
      });
      pivots[name] = [ch[0], CHR.canopy[1], ch[1], 'canopy'];
    });
    return model('pier_flyingchairs', {
      p: PLANK, m: 'PX Mint', w: WHITE, k: 'PX Candy Pink', y: 'PX Sunny', c: 'PX Coral', b: 'PX Pier Stripe Blue', l: 'PX Lilac', i: 'Pebble', v: mid(WHITE), B: BULBS
    }, [base, top, rim, [seats, [0, G16, 0]], chains], { pivots: pivots, anchors: { spot: CHR.spot, seat: CHR.seat.concat('c0') } });
  }

  var BUILD = { pier_mirrors: mirrorsVoxels, pier_droptower: droptowerVoxels, pier_helter: helterVoxels, pier_carousel: carouselVoxels,
                pier_teacups: teacupsVoxels, pier_flyingchairs: chairsVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no stripes, trims or decals), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     PURE ANIMATION HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  function turnOf(deg) { deg = (+deg || 0) % 360; return deg < 0 ? deg + 360 : deg; }
  /* a light breathing at hz: full at rest, down by depth and back (a cosine, never a flash; steady under reduced motion) */
  function breathe(t, hz, depth, reduced) { return reduced ? 1 : 1 - depth * (0.5 - 0.5 * Math.cos(TAU * hz * t)); }
  /* how far the night has come on for the carousel's bulbs: 0 by day, 1 from dusk (show 0.65) on */
  function nightOf(k) { return smooth(((+k || 0) - 0.35) / 0.3); }
  /* the mirrors' shine at act time t of dur: the level of each row while one pale band slides down
     the glass `cycles` whole times, from above the top row to below the bottom one; all dark at rest */
  function shineLevels(t, dur, cycles, out) {
    out = out || [];
    var on = dur > 0 && t > 0 && t < dur, pos = on ? ((MIR.rows + 1) * cycles * t / dur) % (MIR.rows + 1) - 1 : -1;
    for (var q = 0; q < MIR.rows; q++) out[q] = clamp01(1 - Math.abs(pos - q));
    return out;
  }
  /* the pet's stretch [sx, sy] for the timeline's swing (+ tall and thin, − short and wide) and its spring-back hop */
  function mirrorScale(swing, hop, out) {
    out = out || [1, 1];
    var s = swing > 1 ? 1 : swing < -1 ? -1 : swing || 0, e = s >= 0 ? MIR.tall : MIR.wide, u = Math.abs(s), h = MIR.hop * clamp01(hop || 0);
    out[0] = (1 + (e[0] - 1) * u) * (1 - h / 2); out[1] = (1 + (e[1] - 1) * u) * (1 + h);
    return out;
  }
  /* a cup's own spin after t of dur: 0 → 1 turn, speeding up and slowing down over CUP.ramp s (its peak
     is 1 / (dur − ramp) turns a second: 0.4 for the 3 s act) */
  function cupTurn(t, dur) {
    var r = CUP.ramp, v = 1 / (dur - r);
    if (!(dur > 2 * r) || t <= 0) return 0;
    if (t >= dur) return 1;
    return t < r ? v * t * t / (2 * r) : t <= dur - r ? v * (t - r / 2) : 1 - v * (dur - t) * (dur - t) / (2 * r);
  }
  /* a chair hinged at (x, ·, z) under the canopy, swung deg outward about the tangent through its
     hinge → the pivot's XYZ Euler angles in degrees (the kit's setPivot order) */
  function hingeEuler(x, z, deg, out) {
    out = out || [0, 0, 0];
    var r = Math.sqrt(x * x + z * z) || 1, ax = -z / r, az = x / r, a = deg * DEG, c = Math.cos(a), s = Math.sin(a), t = 1 - c, m13 = t * ax * az;
    out[0] = Math.atan2(s * ax, t * az * az + c) / DEG;
    out[1] = Math.asin(m13 > 1 ? 1 : m13 < -1 ? -1 : m13) / DEG;
    out[2] = Math.atan2(s * az, t * ax * ax + c) / DEG;
    return out;
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('pier-a', K → {id: {voxels, lod1, act, forget, idle?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], _lv = [], _sc = [1, 1], _eu = [0, 0, 0];
    var hz = M && typeof M.freq === 'function' ? M.freq('breathe') : 1;
    function pose(a, name, rx, ry, rz, y) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[1] = y;
      pv.set(R3, P3, S3);
    }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    function emit(a, kind, at, n) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n); } catch (e) { /* fx is optional */ } } }
    /* the active pet's id (a crew that only knows yes / no gives true), or null */
    function petOf(a) {
      var p = a.pets, v = null;
      try { v = p && typeof p.active === 'function' ? p.active() : null; } catch (e) { v = null; }
      return typeof v === 'string' && v ? v : v ? true : null;
    }
    /* the pet's part (the crew owns it: a generic seat perform, or the named ride / slide / pose) → is it coming? */
    function askPet(a, id) {
      var p = a.pets, lead = 0;
      if (!p || typeof p.perform !== 'function') return false;
      try { lead = p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { lead = 0; /* no crew yet */ }
      return typeof lead === 'number' && lead > 0;
    }
    /* the active pet's 'voice' step (SLSound.VOICE_STEPS), or -1 with no pet */
    function voiceStep(pet) {
      var S = snd();
      return typeof pet === 'string' && S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : -1;
    }
    /* per-copy memory (the turn folded into its resting pose, a cup spin cut short, the bulb level last
       sent): dropped when the uid's copy changes (a re-batch starts from the model's own pose) */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, turn: 0, cup: 0, lit: -1 }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me, m) (the last call is the end state), rest(a, me, m) (the pose it is left in), fold?(me, m)
       (keep the turn so far), at? (the anchor its sparkles leave from)}. A re-tap takes over from the
       pose the act is in: its turn is folded, its swing and bob are carried (SLMotion.carry). A copy
       rebuilt in mid-ride takes nothing over */
    function run(a, id, spec) {
      var name = ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), copy = mem(a).copy, reduced = !!a.reduced;
      var o = { reduced: reduced, from: prev && prev.copy === copy && !reduced ? M.carry(name, prev.out) : null };
      if (prev) prev.end(mem(a));
      var dur = M.durOf(name, o), cues = M.cues(name, o), ci = 0, done = false, uid = a.uid;
      var me = { name: name, dur: dur, out: {}, copy: copy, reduced: reduced, pet: petOf(a), turn: 0, cup: null, mark: 0 };
      live.set(uid, me);
      me.riding = askPet(a, id);
      me.end = function (m) { done = true; if (live.get(uid) === me) live.delete(uid); if (spec.fold && m.copy === copy) spec.fold(me, m); };
      me.update = function (h, tAct) {
        if (done) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur, m = mem(h);
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, spec.at || 'top', c.n || 1);
            else if (typeof h.sfx !== 'function') continue;
            else if (!c.pet) h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
            else if (voiceStep(me.pet) >= 0) h.sfx('voice', c.vol == null ? 1 : c.vol, voiceStep(me.pet));
          } catch (e) { /* a cue never stops its act */ }
        }
        spec.apply(h, me.out, tt, me, m);
        if (t < dur) return true;
        me.end(m);
        spec.rest(h, me, m);
        return false;
      };
      me.cancel = function () {
        if (done) return;
        try { var m = mem(a); me.end(m); spec.rest(a, me, m); } catch (e) { done = true; /* the copy is gone */ }
      };
      return me;
    }

    /* ---------- wobbly mirrors: the shine slides down the glass, the pet stretches ---------- */
    function shine(a, t, dur) {
      shineLevels(t, dur, Math.max(1, Math.floor(dur * hz + 1e-9)), _lv);
      for (var q = 0; q < MIR.rows; q++) setState(a, 'shine' + q, _lv[q]);
    }
    function stretch(a, me, sx, sy) {
      var p = a.pets;
      if (!me.riding || !me.pet || !p || typeof p.poseScale !== 'function') return;
      try { p.poseScale(typeof me.pet === 'string' ? me.pet : null, sx, sy); } catch (e) { /* the crew is optional */ }
    }
    var mirrorsSpec = {
      apply: function (a, out, t, me) {
        shine(a, me.reduced ? 0 : t, me.dur);
        mirrorScale(me.reduced ? 0 : out.swing, me.reduced ? 0 : out.bob, _sc);
        stretch(a, me, _sc[0], _sc[1]);
      },
      rest: function (a, me) { shine(a, 0, 0); stretch(a, me, 1, 1); }
    };

    /* ---------- drop tower: the ring climbs, waits, drops softly and bounces twice; the cap bulbs breathe ---------- */
    var dropSpec = {
      apply: function (a, out, t, me) {
        pose(a, 'ring', 0, 0, 0, DROP.travel * clamp01(out.bob || 0));
        setState(a, 'bulbs', breathe(t, hz, DROP.dim, me.reduced));
      },
      rest: function (a) { pose(a, 'ring', 0, 0, 0, 0); setState(a, 'bulbs', 1); }
    };

    /* ---------- helter-skelter: nothing on the tower moves; a sparkle pops behind the pet twice on its way down ---------- */
    var helterSpec = {
      at: 'foot',
      apply: function (a, out, t, me) {
        if (me.reduced) return;
        for (; me.mark < HEL.trail.length && t >= HEL.trail[me.mark][0]; me.mark++) emit(a, 'sparkle', HEL.trail[me.mark][1], 1);
      },
      rest: function () { /* at rest already */ }
    };

    /* ---------- carousel: half a turn; the six mounts bob, alternate ones opposite ---------- */
    function fold(me, m) { m.turn = turnOf(m.turn + me.turn); me.turn = 0; }
    function carouselPose(a, m, deg, bob) {
      pose(a, 'spin', 0, turnOf(m.turn + deg), 0, 0);
      for (var n = 0; n < CAR.mounts.length; n++) pose(a, 'm' + n, 0, 0, 0, n & 1 ? -bob : bob);
    }
    var carouselSpec = {
      apply: function (a, out, t, me, m) { me.turn = out.deg || 0; carouselPose(a, m, me.turn, out.bob || 0); },
      fold: fold, rest: function (a, me, m) { carouselPose(a, m, 0, 0); }
    };
    /* the rim bulbs breathe at night; by day (and under reduced motion) they are steady */
    function carouselIdle(a) {
      if (!a) return false;
      var m = mem(a), night = nightOf(a.show), v = breathe(+a.t || 0, hz, CAR.dim * night, !!a.reduced || night <= 0);
      if (Math.abs(v - m.lit) <= 0.004) return false;
      m.lit = v; setState(a, 'bulbs', v);
      return true;
    }

    /* ---------- teacups: the floor turns half a turn while every cup spins once on its saucer ---------- */
    function cupsPose(a, m, table, cup) {
      pose(a, 'table', 0, turnOf(m.turn + table), 0, 0);
      for (var n = 0; n < CUP.cups.length; n++) pose(a, 'cup' + n, 0, turnOf(cup), 0, 0);
    }
    var cupsSpec = {
      apply: function (a, out, t, me, m) {
        me.turn = me.reduced ? CUP.reducedTurn : CUP.turn * clamp01(out.k || 0);
        me.cup = me.reduced ? m.cup : m.cup + (CUP.spin - m.cup) * cupTurn(t, me.dur);      /* a spin cut short is finished */
        cupsPose(a, m, me.turn, me.cup);
      },
      fold: function (me, m) { fold(me, m); if (me.cup != null) m.cup = turnOf(me.cup); },
      rest: function (a, me, m) { cupsPose(a, m, 0, m.cup); }
    };

    /* ---------- flying chairs: three quarters of a turn; the chairs swing out to 30° and settle; the bulbs breathe ---------- */
    function chairsPose(a, m, turn, out) {
      pose(a, 'canopy', 0, turnOf(m.turn + turn), 0, 0);
      for (var n = 0; n < CHR.chairs.length; n++) { hingeEuler(CHR.chairs[n][0], CHR.chairs[n][1], out, _eu); pose(a, 'c' + n, _eu[0], _eu[1], _eu[2], 0); }
    }
    var chairsSpec = {
      apply: function (a, out, t, me, m) {
        me.turn = me.reduced ? CHR.reducedTurn : CHR.turn * clamp01(out.k || 0);
        chairsPose(a, m, me.turn, me.reduced ? 0 : CHR.out * clamp01(out.bob || 0));
        setState(a, 'bulbs', breathe(t, hz, CHR.dim, me.reduced));
      },
      fold: fold, rest: function (a, me, m) { chairsPose(a, m, 0, 0); setState(a, 'bulbs', 1); }
    };

    var SPEC = { pier_mirrors: mirrorsSpec, pier_droptower: dropSpec, pier_helter: helterSpec, pier_carousel: carouselSpec, pier_teacups: cupsSpec, pier_flyingchairs: chairsSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    out.pier_carousel.idle = carouselIdle;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { mirrors: MIR, droptower: DROP, helter: HEL, carousel: CAR, teacups: CUP, chairs: CHR }, GLASS: GLASS,
    wedge: wedge, cross: cross, side: side, helterStep: helterStep, helterStops: helterStops,
    breathe: breathe, nightOf: nightOf, shineLevels: shineLevels, mirrorScale: mirrorScale, cupTurn: cupTurn, hingeEuler: hingeEuler, turnOf: turnOf
  };
}));
