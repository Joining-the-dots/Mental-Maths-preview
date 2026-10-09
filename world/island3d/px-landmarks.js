/* ================================================================
   My Island v3 — SLPxLandmarks (W3.1): the five sky-island landmarks in Pixel Blocks, and the
   isleDiorama API. window.SLPxLandmarks + SL3D.defineVox('landmarks', factory) +
   SL3D.defineVoxApi('isleDiorama', …) in the browser, module.exports in Node. Every model is pure
   data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards, the previews and the
   Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the footprint
   centre, facing +z; below y 1.0 everything stays inside fp − 0.14 u, and nothing ever stands in
   the entrance row (the row in front of the footprint).
     lm_pier_wheel        3×2  5.0 u  a candy-striped Big Wheel on a blue / white A-frame: a white
                          rim with coral dashes, eight coral / sunny spokes, a striped hub with a
                          sun, 16 warm bulbs (four chase groups, state keys bulbs0 – bulbs3) and
                          eight open pastel tubs g0 – g7 ⊂ 'wheel' that counter-rotate to hang level
                          (g0, the pet's pink one, waits over the plank boarding steps; seat ⊂ g0).
     lm_jungle_treehouse  3×3  5.5 u  a giant buttressed tree with three thatched huts (a leaf on
                          each door) on decks at 1.6, 2.9 and 4.0 u, a plank stair with a rope rail,
                          six lanterns and the hut windows on the warm state 'lamps', and five
                          rounded leaf crowns with flowers and flowering vines on 'crown'; the
                          woven basket rides 'lift' between two guide ropes, from its pad on the
                          ground to the top deck (seat ⊂ lift), under the pulley arm.
     lm_treetop_lookout   3×3  5.5 u  a square timber tower round a stepped candy pine: corner
                          posts, side X-braces, three plank decks with rope rails and fairy
                          lanterns, a front ladder, a red crow's-nest roof and a blue pennant on
                          'flag'; the zip line runs from the nest to the landing post, its trolley
                          and T-handle on 'zip' (zipStart ⊂ zip), resting at the landing.
     lm_castle_keep       4×3  4.5 u  a stone keep with four ROUND towers under flat battlements
                          (no spires), a gate tower with a round arch and a gold-sun shield, warm
                          windows with flower boxes, two violet sun banners on 'banners' (they
                          furl to their rods while the bridge is up), four sun flags flag0 – flag3
                          and the plank drawbridge on 'bridge', hinged at its foot (lit = down).
                          No weapons, cannons, arrow slits or dungeon.
     lm_ice_igloo         3×2  2.6 u  (its LOOK h) a dome of snow and pale-ice block courses with
                          deep-ice joints, a glowing tunnel door in a deep-ice arch with aurora
                          bunting over it, an ice porthole, a hatch on top, an ice chute that
                          spirals down its left side, and at the back right an ice tower with an
                          aurora lantern (mint, sky and violet panes), a snow cap and a coral
                          pennant; the tower grows to the LOOK h (2.6 u: a lantern turret on the
                          dome; from 3.25 u a tall tower with an overhanging cap and a lit window);
                          three penguins pen0 – pen2 (SLPxCharacters.critterVoxels('penguin',
                          {size: 0 | 1 | 2}) when it is loaded, else a local penguin) stand at the
                          chute's foot.
   GRAIN (D11): bodies, decks and the pine G8, leaf crowns G4, guide ropes, poles, flags and the
   trolley G16, penguins GC (px-characters' grid).
   CULLING: the wheel, the treehouse and the lookout take cullFor('isleLandmark', {tall}) ('-z'
   dropped, '-y' kept); the keep and the igloo keep every face (cull []): the bridge turns its back
   up as it lowers, and the penguins turn round and belly-slide. Every id meets its cap with every
   face (photocards).
   LOW (D89): detail voxels are tagged lod 'mid'; every id brings its own lod1 (its plain masses,
   halved) inside TRIS_CAPS_LOD1 (35 % of its tris, D106), keeping every pivot.
   ACTS run on SLMotion's landmark timelines (wheel 4 s · lift 4 s · zip 4 s · drawbridge 4 s /
   drawbridgeUp 2 s · penguins 6 s). One live act per uid and a landmark ignores re-taps while
   its act runs; the end pose is the rest pose (the wheel folds its turn, the keep remembers its
   bridge); reduced motion = the end state at once, one sparkle and the same sounds. The pet's
   part is a.pets.perform(LOOK perform, uid): wheel, lift, zip, cross (the igloo has none).
   Light: the wheel's bulbs chase at ART3.FREQS.bulbChase (≤ 1.5 Hz a bulb, SLMotion.wheelBulb),
   the treehouse lamps breathe (≤ 1 Hz); nothing flashes. Nothing here reads, awards or spends
   points.
   IDLES (live island; reduced motion keeps them still): the wheel turns 0.02 rev/s and the crowns
   sway and the basket swings on MID / HIGH; flags flutter ≤ 0.5 Hz; the igloo breathes a 3-cube
   wisp from its hatch every 5 s on MID / HIGH.
   isleDiorama(isle, tier) (D75, photocards): SLIsles3D.diorama(isle, the landmark at rest) →
   an Object3D (one static mesh) when a tier is given, else the VoxModel itself (the display
   route, SL3D.vox.displayVoxels, and the coverage test read the model); .voxels(isle) and
   .object(isle, tier) name the two forms.
   HANDLE used: a.uid a.t a.dt a.phase a.reduced a.show a.lit a.batch a.template · a.pivot(name)
   .set(rotDeg[3], pos[3], scale[3]) · a.state(key, v) · a.emit(kind, at, n) · a.sfx(name, vol,
   step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxLandmarks = api;
  var S = root.SL3D;
  if (S && typeof S.defineVox === 'function') S.defineVox('landmarks', api.factory);
  if (S && typeof S.defineVoxApi === 'function') S.defineVoxApi('isleDiorama', api.dioramaApi);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxLandmarks: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }
  function chars() { return sibling('SLPxCharacters', './px-characters.js'); }
  function isles() { return sibling('SLIsles3D', './isles3d.js'); }

  var VERSION = 1;
  var IDS = ['lm_pier_wheel', 'lm_jungle_treehouse', 'lm_treetop_lookout', 'lm_castle_keep', 'lm_ice_igloo'];
  var ISLE = { pier: 'lm_pier_wheel', jungle: 'lm_jungle_treehouse', treetop: 'lm_treetop_lookout', castle: 'lm_castle_keep', ice: 'lm_ice_igloo' };
  /* the CATALOG act, the a.pets.perform kind (LOOK.perform wins when it is loaded) and where the sparkles leave from */
  var ACT = { lm_pier_wheel: 'wheel', lm_jungle_treehouse: 'lift', lm_treetop_lookout: 'zip', lm_castle_keep: 'drawbridge', lm_ice_igloo: 'penguins' };
  var PERFORM = { lm_pier_wheel: 'wheel', lm_jungle_treehouse: 'lift', lm_treetop_lookout: 'zip', lm_castle_keep: 'cross', lm_ice_igloo: null };
  var SPARK = { lm_pier_wheel: 'seat', lm_jungle_treehouse: 'deck2', lm_treetop_lookout: 'landing', lm_castle_keep: 'door', lm_ice_igloo: 'rampFoot' };
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;
  /* module tokens (D50): the wheel's peach tub */
  var TOKENS = { 'PX Wheel Peach': '#FFC9A0' };
  var tokensFor = null;
  function ready() {
    var L = look();
    if (L && tokensFor !== L && typeof L.addTokens === 'function') { L.addTokens('px-landmarks', TOKENS); tokensFor = L; }
  }

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var WH = {
    hub: 2.75, ci: -0.5, cj: 21.5, rOut: 17.6, rIn: 15.5, hubR: 2.6, bulbR: 16.5, piv: 1.5, gz: 0.25, apex: 0.8125,
    groups: 4, rps: 0.02, steady: 0.8, door: [0, 0.125, 0.75], spot: [0, 0.25, 0.375],
    tubs: ['PX Candy Pink', 'PX Mint', 'PX Sunny', 'PX Pier Stripe Blue', 'PX Lilac', 'PX Coral', 'PX Wheel Peach', 'Cloud White']
  };
  var TH = {
    decks: [1.625, 2.875, 4.0], drop: 3.875, beam: [-1.0, 4.75, 1.125], basket: [-1.0, 4.0, 1.125], door: [-1.0, 0, 1.125],
    spot: [-0.375, 0, 1.125], crown: [0, 4.5, -0.5], sway: 0.02, swayHz: 0.15, swing: 3, swingPeriod: 2.4
  };
  var TT = {
    decks: [1.5, 2.75, 4.0], nest: [-1.0, 4.0, 0.0625],
    zipFrom: [0.125, 4.5, 0.125], zipTo: [1.25, 1.1875, 1.25], park: 0.1, landing: [0.6875, 0.375, 0.6875],
    door: [-1.0, 0, 0.8125], spot: [-1.0, 0, 0.375], flag: [-0.6875, 5.125, -0.6875], flagDeg: 12
  };
  var CK = { hinge: [0, 0.0625, 1.0625], gate: [0, 0, 0.625], door: [0, 0, 2.125], spot: [0, 0, 1.25], rod: 2.375, furl: 0.18, flagDeg: 12,
             towers: [[-1.375, -0.875], [1.375, -0.875], [-1.375, 0.5], [1.375, 0.5]] };
  /* the igloo: dome axis (cx, cz), the hatch on top, the tunnel door and the chute (Catmull-Rom
     control points, top → foot), the three penguins' rest spots at its foot (size 0 | 1 | 2) */
  var IG = {
    cx: 0.3125, cz: -0.0625, rx: 8.6, rz: 6.6, ry: 13.4,
    door: [0.3125, 0, 0.8125], inside: [0.3125, 0, -0.1875], below: [0.3125, 1.0, -0.0625], hatch: [0.3125, 1.5, -0.0625],
    chute: [[-0.0625, 1.5625, -0.3125], [-0.5, 1.25, -0.625], [-0.9375, 0.75, -0.4375], [-1.0625, 0.375, 0.0], [-1.0625, 0.125, 0.375], [-1.0625, 0.0625, 0.5625]],
    rest: [[-0.3125, 0, 0.75], [-0.6875, 0, 0.75], [-1.0, 0, 0.75]], wisp: [0.3125, 1.75, -0.0625], every: 5,
    /* the ice tower at the back right, clear of the hatch, the hop and the chute (its axis, its
       octagon radius in G8 voxels) and its aurora lantern; the pole's length (a short one up to 3.25 u, then a long one); h = the height when
       SLIslandLook is not loaded (its LOOK h wins: the tower grows to it, D73) */
    tower: [0.8125, -0.4375], towerR: 3, pole: [0.375, 0.5], tall: 3.25, h: 2.6,
    /* the bunting over the doorway [x0, x1, y at its ends, sag] and its flag spacing */
    swag: [-0.3125, 0.9375, 1.3125, 0.125], flagEvery: 0.3125
  };

  /* ================================================================
     BUILDER HELPERS (pure)
     ================================================================ */
  /* a builder grid: even (voxels −1 and 0 straddle the pivot) or odd (voxel 0 centred on it), per axis */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox ? 0.5 : 0, 0, oz ? 0.5 : 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  function snap(v) { return Math.round(v / G16) * G16; }
  /* a VoxModel from layers [grid | [grid, at]]; o.pivots {name: [x, y, z, parent?]}, o.anchors {name: [x, y, z, pivot?]} */
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
  var WHITE = 'Cloud White', MID = 'mid';
  function mid(token, mode) { return mode ? { token: token, mode: mode, lod: MID } : { token: token, lod: MID }; }
  function glow(token) { return { token: token, mode: 'glow' }; }
  /* distance from (x, y) to the segment a → b (2D) */
  function segDist(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], u = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy);
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy);
  }
  /* a face-connected voxel line a → b (voxel coords): a rope that never hangs by a corner (it steps down, across, then along z) */
  function rope(g, a, b, c) {
    var n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])))), p = null;
    for (var s = 0; s <= n; s++) {
      var v = [0, 1, 2].map(function (q) { return Math.round(a[q] + (b[q] - a[q]) * s / n); });
      if (!p) { p = v; g.set(p[0], p[1], p[2], c); continue; }
      [1, 0, 2].forEach(function (q) { if (v[q] !== p[q]) { p[q] = v[q]; g.set(p[0], p[1], p[2], c); } });
    }
    return g;
  }
  /* a Catmull-Rom curve through pts (item metres) sampled every `step` u of chord → [[x, y, z]] */
  function curve(pts, step) {
    var out = [];
    for (var s = 0; s < pts.length - 1; s++) {
      var p0 = pts[Math.max(0, s - 1)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(pts.length - 1, s + 2)];
      var n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) / step));
      for (var q = 0; q < n; q++) {
        var t = q / n, t2 = t * t, t3 = t2 * t, v = [0, 0, 0];
        for (var a = 0; a < 3; a++) v[a] = 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3);
        out.push(v);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  /* ================================================================
     BIG WHEEL — one even G8 grid (A-frame, steps, rim, spokes, hub, bulbs) + eight odd G8 tubs
     ================================================================ */
  /* gondola n: its pivot (the axle on spoke n, 1.5 u out) */
  function gondolaAt(n) { var a = (-90 + 45 * n) * DEG; return [snap(WH.piv * Math.cos(a)), snap(WH.hub + WH.piv * Math.sin(a)), WH.gz]; }
  function wheelVoxels(st, o) {
    ready();
    var lite = !!(o && o.lite), g = grid(G8), i, j, k, n, layers = [g], pivots = { wheel: [0, WH.hub, 0] };
    /* the A-frame behind the wheel: two striped legs, a cross bar and feet; the axle into the hub */
    var legs = [[[-9.5, 0], [-1, 21]], [[8.5, 0], [0, 21]]];
    for (j = 0; j <= 22; j++) for (i = -12; i <= 11; i++) {
      if (legs.some(function (l) { return segDist(i, j, l[0], l[1]) <= 1.2; })) g.box(i, i, j, j, -6, -4, lite || ((j / 3 | 0) & 1) ? 'b' : 'w');
    }
    g.box(-7, 6, 7, 8, -6, -5, 'b').box(-4, 3, 14, 14, -6, -5, 'b').box(-11, -8, 0, 0, -7, -3, 'f').box(7, 10, 0, 0, -7, -3, 'f').box(-1, 0, 20, 23, -6, -5, 'x');
    /* the boarding deck: planks, a step down toward the entrance row, a white rail each side */
    g.box(-7, 6, 0, 1, 0, 3, 'p').box(-5, 4, 0, 0, 4, 6, 'p');
    if (!lite) g.box(-7, -7, 2, 3, 0, 3, 'w').box(6, 6, 2, 3, 0, 3, 'w').box(-7, -7, 4, 4, 0, 3, 'r').box(6, 6, 4, 4, 0, 3, 'r');
    g.group('wheel', function () {
      for (j = 0; j <= 41; j++) for (i = -20; i <= 19; i++) {
        var dx = i - WH.ci, dy = j - WH.cj, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (d > WH.rIn && d <= WH.rOut) {
          var dash = ((Math.floor((a / TAU + 1) * 48 + 0.5) % 6) + 6) % 6 === 0;
          g.box(i, i, j, j, -3, -2, !lite && dash ? 'c' : 'w');
        } else if (d <= WH.hubR) {
          g.box(i, i, j, j, -4, -1, lite || (Math.floor((a / TAU + 1) * 8) & 1) ? 'w' : 'c');
        } else if (d <= WH.rIn) {
          var s = ((Math.round((a / DEG + 90) / 45) % 8) + 8) % 8, th = (-90 + 45 * s) * DEG;
          var perp = Math.abs(dx * Math.sin(th) - dy * Math.cos(th)), along = dx * Math.cos(th) + dy * Math.sin(th);
          if (along > 0 && perp <= (s & 1 ? 0.75 : 0.55)) g.set(i, j, -2, lite ? 'w' : s & 1 ? 'y' : 'c');
        }
      }
      if (!lite) {
        g.decal('+z', [-2, 20, -1], [4, 4], 'sun');
        for (n = 0; n < 16; n++) {
          var th2 = (-90 + 22.5 * n) * DEG;
          g.set(Math.round(WH.ci + WH.bulbR * Math.cos(th2)), Math.round(WH.cj + WH.bulbR * Math.sin(th2)), -1, String(n % WH.groups));
        }
      }
    });
    /* eight open tubs: a floor, two rows of wall (a white band), two back posts and a striped
       canopy; the gold axle behind the canopy is the pivot (it hangs level from it) */
    for (n = 0; n < 8; n++) gondola(n);
    function gondola(n2) {
      var q = grid(G8, true, false), name = 'g' + n2, at = gondolaAt(n2), c = 'ABCDEFGH'.charAt(n2), band = lite ? c : n2 === 7 ? 'c' : 'w';
      q.group(name, function () {
        q.box(-2, 2, 0, 0, -2, 1, c);
        for (k = -2; k <= 1; k++) for (i = -2; i <= 2; i++) if (i === -2 || i === 2 || k === -2 || k === 1) q.set(i, 1, k, c).set(i, 2, k, band);
        q.box(-2, -2, 3, 6, -2, -2, c).box(2, 2, 3, 6, -2, -2, c).box(-1, 1, 6, 6, -2, -2, c).box(0, 0, 6, 6, -3, -3, 'x');
        q.box(-2, 2, 7, 7, -2, 1, function (ii) { return lite || ii & 1 ? c : 'w'; });
      });
      layers.push([q, [at[0], at[1] - WH.apex, at[2]]]);
      pivots[name] = [at[0], at[1], at[2], 'wheel'];
    }
    var pal = { b: 'PX Pier Stripe Blue', w: WHITE, c: 'PX Coral', y: 'PX Sunny', f: 'PX Pier Stripe Blue', x: 'PX Castle Gold',
                p: { token: 'PX Pier Plank', mode: 'plank' }, r: mid('PX Coral') };
    for (n = 0; n < 8; n++) pal['ABCDEFGH'.charAt(n)] = WH.tubs[n];
    for (n = 0; n < WH.groups; n++) pal[String(n)] = { token: 'PX Bulb Warm', mode: 'glow', state: { key: 'bulbs' + n, off: 'PX Lamp Off', on: 'PX Bulb Warm', initial: WH.steady } };
    var seat = gondolaAt(0);
    return model('lm_pier_wheel', pal, layers, {
      pivots: pivots,
      anchors: { door: WH.door, spot: WH.spot, seat: [seat[0], seat[1] - WH.apex + G8, seat[2], 'g0'] }
    });
  }

  /* ================================================================
     GREAT TREEHOUSE — one even G8 grid (trunk, decks, huts, stair, lift frame, lamps), G4 crowns,
     G16 guide ropes
     ================================================================ */
  /* a hut: walls i0..i1 × k0..k1 from row j, a dark door with a leaf on the +z face, a lit window
     each side, and a stepped thatch roof (one overhang, then a step in each row to the peak) */
  function hut(g, i0, i1, k0, k1, j, lite) {
    var ci = (i0 + i1) >> 1, n;
    g.box(i0, i1, j, j + 3, k0, k1, 'h');
    g.box(ci - 1, ci, j, j + 2, k1, k1, 'd');
    if (!lite) g.decal('+z', [ci - 1, j + 1, k1], [2, 2], 'leaf');
    g.set(i0, j + 2, k0 + 1, 'L').set(i1, j + 2, k0 + 1, 'L').set(i1 - 1, j + 2, k1, 'L');
    for (n = 0; i0 - 1 + n <= i1 + 1 - n && k0 - 1 + n <= k1 + 1 - n; n++) {
      g.box(i0 - 1 + n, i1 + 1 - n, j + 4 + n, j + 4 + n, k0 - 1 + n, k1 + 1 - n, lite || n & 1 ? 't' : 'T');
    }
  }
  /* a lantern on a short post standing on a deck (top row j) */
  function lantern(g, i, j, k) { g.box(i, i, j + 1, j + 2, k, k, 'r').set(i, j + 3, k, 'L'); }
  function treehouseVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), cr = grid(G4), rp = grid(G16), vn = grid(G8), i, j, k, n, d = TH.decks.map(function (y) { return Math.round(y / G8) - 1; });
    /* the trunk (8 × 8, 6 × 6 above the middle deck) with light bark grain, a flared foot and four roots */
    for (j = 0; j <= d[2]; j++) {
      var r = j > d[1] ? 1 : 0;
      for (k = -5 + r; k <= 2 - r; k++) for (i = -4 + r; i <= 3 - r; i++) g.set(i, j, k, !lite && (i + k + 9) % 4 === 0 ? 'R' : 'r');
    }
    g.box(-5, 4, 0, 1, -6, 3, 'r');
    for (k = -7; k <= 4; k++) for (i = -6; i <= 5; i++) if (!((i === -6 || i === 5) && (k === -7 || k === 4))) g.set(i, 0, k, 'r');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {                  /* buttress fins: stepped wedges out to the corners */
      var i0 = q[0] < 0 ? -6 : 5, k0 = q[1] < 0 ? -7 : 4, len = q[1] > 0 ? 2 : 4;
      for (n = 1; n <= len; n++) g.box(i0 + q[0] * n, i0 + q[0] * (n - 1), 0, len - n, k0 + q[1] * n, k0 + q[1] * (n - 1), 'r');
    });
    /* deck 0 (left, low) on posts, its hut and two lanterns */
    g.box(-11, -5, d[0], d[0], -5, 4, 'p').box(-11, -11, 0, d[0] - 1, -5, -5, 'r').box(-11, -11, 0, d[0] - 1, 4, 4, 'r').box(-6, -6, 0, d[0] - 1, 4, 4, 'r');
    hut(g, -10, -6, -4, 0, d[0] + 1, lite);
    lantern(g, -11, d[0], 4); lantern(g, -5, d[0], 4);
    /* deck 1 (right, middle) on posts, its hut and two lanterns */
    g.box(4, 11, d[1], d[1], -6, 3, 'p').box(10, 10, 0, d[1] - 1, -6, -6, 'r').box(10, 10, 0, d[1] - 1, 3, 3, 'r');
    hut(g, 6, 10, -5, -1, d[1] + 1, lite);
    lantern(g, 11, d[1], 3); lantern(g, 4, d[1], -6);
    /* the plank stair from deck 0 up to deck 1 across the front of the trunk, with a rope rail */
    for (n = 0; n <= 8; n++) {
      g.box(-4 + n, -4 + n, d[0] + n + 1, d[0] + n + 1, 3, 4, 'p');
      if (!lite) g.set(-4 + n, d[0] + n + 3, 5, 'n');
    }
    /* deck 2 (top) with the third hut, two lanterns, and the lift's post, arm, cross beam and pulley */
    g.box(-6, 5, d[2], d[2], -6, 3, 'p');
    hut(g, -3, 1, -2, 2, d[2] + 1, lite);
    lantern(g, -6, d[2], -6); lantern(g, 5, d[2], -6);
    g.box(-6, -5, d[2] + 1, 37, 2, 3, 'R').box(-6, -5, 38, 38, 2, 9, 'R').box(-11, -6, 38, 38, 8, 9, 'R').box(-9, -8, 37, 37, 8, 9, 'x');
    /* the landing pad under the lift and the two guide ropes from the cross beam down to it */
    g.box(-11, -6, 0, 0, 7, 10, 'p');
    rp.box(-21, -21, 0, 75, 17, 18, 'n').box(-12, -12, 0, 75, 17, 18, 'n');
    /* the basket on 'lift', resting level with the top deck: a woven tub with a pink band and a handle */
    g.group('lift', function () {
      g.box(-10, -7, d[2], d[2], 7, 10, 'k');
      for (k = 7; k <= 10; k++) for (i = -10; i <= -7; i++) if (i === -10 || i === -7 || k === 7 || k === 10) g.set(i, d[2] + 1, k, 'k').set(i, d[2] + 2, k, lite ? 'k' : 'K');
      g.box(-10, -10, d[2] + 3, d[2] + 4, 8, 9, 'n').box(-7, -7, d[2] + 3, d[2] + 4, 8, 9, 'n').box(-10, -7, d[2] + 5, d[2] + 5, 8, 9, 'n');
    });
    /* five rounded leaf crowns on 'crown' (G4, leaf mode, banded deep → light), behind and above the huts */
    cr.group('crown', function () {
      [[-0.25, 4.75, -0.875, 1.125, 0.75, 0.75], [-1.25, 4.125, -0.625, 0.75, 0.625, 0.75], [1.0, 4.375, -1.0, 0.875, 0.625, 0.625],
       [-1.25, 3.125, -1.125, 0.625, 0.5, 0.5], [1.375, 3.375, -0.875, 0.5, 0.5, 0.5]].forEach(function (b) {
        cr.blob(b[0] / G4 - 0.5, b[1] / G4 - 0.5, b[2] / G4 - 0.5, b[3] / G4, b[4] / G4, b[5] / G4, function (ii, jj) {
          var y = (jj + 0.5) * G4 - b[1];
          return lite ? 'm' : y > b[4] * 0.3 ? 'M' : y < -b[4] * 0.3 ? 'D' : 'm';
        }, 2.2);
      });
      if (!lite) cr.hashTone('M', 'P', 0.07, 'jungle-flowers').hashTone('m', 'O', 0.04, 'jungle-flowers-2');
    });
    /* vines with a flower at the tip hang from the crowns (MID / HIGH detail; they sway with them) */
    if (!lite) vn.group('crown', function () {
      [[-1.5, 3.5, 0, 6], [-0.875, 3.5, 0.0625, 4], [1.375, 3.75, -0.25, 5], [1.625, 2.875, -0.5, 4], [-1.625, 2.625, -0.875, 3]].forEach(function (v, n) {
        var q = U(v);
        vn.box(q[0], q[0], q[1] - v[3] + 1, q[1], q[2], q[2], 'w').set(q[0], q[1] - v[3], q[2], n & 1 ? 'f' : 'F');
      });
    });
    var pal = {
      r: 'PX Jungle Bark', R: 'PX Jungle Bark Light', p: { token: 'PX Jungle Bark Light', mode: 'plank' }, h: 'PX Jungle Rope', d: 'PX Jungle Bark',
      t: 'PX Jungle Thatch', T: 'PX Jungle Thatch Shade', n: 'PX Jungle Rope', x: 'PX Castle Gold', k: 'PX Jungle Thatch', K: mid('PX Jungle Flower Pink'),
      m: { token: 'PX Jungle Canopy', mode: 'leaf' }, M: { token: 'PX Jungle Canopy Light', mode: 'leaf' }, D: { token: 'PX Jungle Canopy Deep', mode: 'leaf' },
      P: 'PX Jungle Flower Pink', O: 'PX Jungle Flower Orange', w: mid('PX Jungle Canopy Deep', 'leaf'), F: mid('PX Jungle Flower Pink'), f: mid('PX Jungle Flower Orange'),
      L: { token: 'PX Lamp Warm', mode: 'glow', state: { key: 'lamps', off: 'PX Lamp Off', on: 'PX Lamp Warm', initial: 1 } }
    };
    var top = (d[2] + 1) * G8;
    return model('lm_jungle_treehouse', pal, [g, cr, rp, vn], {
      pivots: { lift: TH.beam, crown: TH.crown },
      anchors: { door: [TH.door[0], G8, TH.door[2]], spot: TH.spot, seat: [TH.basket[0], top, TH.basket[2], 'lift'],
                 deck0: [-0.875, (d[0] + 1) * G8, 0.375], deck1: [1.0, (d[1] + 1) * G8, 0.25], deck2: [-0.3125, top, 0.4375] }
    });
  }
  /* ================================================================
     TREETOP LOOKOUT — one even G8 grid (tower, pine, decks, ladder, zip line, landing), a G16
     trolley on 'zip' and a G16 pole and pennant on 'flag'
     ================================================================ */
  function lookoutVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), z = grid(G16), f = grid(G16), i, j, k, n, d = TT.decks.map(function (y) { return Math.round(y / G8) - 1; });
    var I0 = -11, I1 = 0, K0 = -11, K1 = 0, C = -6;                 /* the tower's square (posts at its corners) and the pine's axis voxel */
    /* the stepped candy pine: octagonal tiers between the decks, poking out of the frame above y 1 */
    [[1, d[0] - 1, 5, 1], [d[0] + 1, d[1] - 1, 8, 2], [d[1] + 1, d[2] - 1, 7, 2]].forEach(function (t) {
      for (j = t[0]; j <= t[1]; j++) {
        var h = Math.max(1, t[2] - Math.floor((j - t[0]) / 3) * t[3]), c = lite ? 'v' : (j - t[0]) % 3 === 0 ? 'V' : (j - t[0]) % 3 === 2 ? 'u' : 'v';
        g.lathe([[h + 0.5, j, j, c]], { at: [C, C], segments: 'oct' });
      }
    });
    g.box(C - 1, C + 1, 0, d[2], C - 1, C + 1, 'r');
    /* the four corner posts, the decks with rope rails (a gap for the ladder) and fairy lanterns */
    [[I0, K0], [I1 - 1, K0], [I0, K1 - 1], [I1 - 1, K1 - 1]].forEach(function (p) { g.box(p[0], p[0] + 1, 0, d[2] + 6, p[1], p[1] + 1, 'b'); });
    d.forEach(function (dj) {
      g.box(I0, I1, dj, dj, K0, K1, 'p').box(C - 1, C + 1, dj, dj, C - 1, C + 1, 'r');
      for (i = I0 + 2; i <= I1 - 2; i++) if (i > -7) g.set(i, dj + 2, K1, !lite && (i & 1) ? 'l' : 'n');
      for (k = K0 + 2; k <= K1 - 2; k++) g.set(I0, dj + 2, k, 'n').set(I1, dj + 2, k, !lite && !(k & 1) ? 'l' : 'n').set(I0 + 2 + k - K0 - 2, dj + 2, K0, 'n');
    });
    /* X-braces on the sides and the back, between the levels */
    if (!lite) [[0, d[0] - 1], [d[0] + 1, d[1] - 1], [d[1] + 1, d[2] - 1]].forEach(function (s) {
      g.line([I0, s[0], K0 + 2], [I0, s[1], K1 - 2], 'B').line([I0, s[0], K1 - 2], [I0, s[1], K0 + 2], 'B');
      g.line([I1, s[0], K0 + 2], [I1, s[1], K1 - 2], 'B').line([I1, s[0], K1 - 2], [I1, s[1], K0 + 2], 'B');
    });
    /* the crow's-nest roof: a stepped red toadstool cap with white spots */
    for (n = 0; n < 3; n++) g.box(I0 - 1 + 2 * n, I1 + 1 - 2 * n, d[2] + 7 + n, d[2] + 7 + n, K0 - 1 + 2 * n, K1 + 1 - 2 * n, function (ii, jj, kk) {
      return !lite && n < 2 && (ii * 3 + kk * 5 + n * 7 + 99) % 7 === 0 ? 'w' : 'R';
    });
    /* the ladder: leaning from the ground to the first deck, then straight up the front to the nest */
    for (j = 0; j <= d[2]; j++) {
      var lk = j <= d[0] ? K1 + 1 + Math.round((d[0] - j) * 5 / d[0]) : K1 + 1;
      g.set(-10, j, lk, 'b').set(-7, j, lk, 'b');
      if (j % 2 === 1) g.box(-9, -8, j, j, lk, lk, 'n');
    }
    /* the zip line from the nest's front-right post to the landing post; the mossy landing stump */
    rope(g, U(TT.zipFrom), U(TT.zipTo), 'n');
    var top = Math.round(TT.zipTo[1] / G8 - 0.5), ls = U(TT.landing);
    g.box(9, 10, 0, top, 9, 10, 'b').box(9, 10, top + 1, top + 1, 9, 10, 'o');
    g.lathe([[2.5, 0, 1, 'r'], [2.5, 2, 2, lite ? 'r' : 'm']], { at: [ls[0], ls[2]] });
    /* the trolley and its T-handle on 'zip', parked near the landing post */
    var park = zipPoint(1);
    z.group('zip', function () { z.box(-1, 0, 0, 1, -1, 0, 'o').box(-1, 0, -5, -1, -1, 0, 'n').box(-3, 2, -6, -6, -1, 0, 'o'); });
    /* the pole and the pennant on 'flag' */
    f.box(0, 0, 0, 5, 0, 0, 'n');
    f.group('flag', function () { for (n = 0; n < 5; n++) f.box(1 + n, 1 + n, 2 + (n >> 1), 5 - (n >> 1), 0, 0, 'F'); });
    var pal = {
      r: 'PX Tree Bark', b: 'PX Tree Bark', B: 'PX Tree Bark Trail', p: { token: 'PX Tree Plank', mode: 'plank' }, n: 'PX Tree Rope',
      v: { token: 'PX Tree Pine Mid', mode: 'leaf' }, V: { token: 'PX Tree Pine', mode: 'leaf' }, u: { token: 'PX Tree Pine Light', mode: 'leaf' },
      R: 'PX Tree Toadstool', w: 'Cloud White', m: 'PX Tree Moss', o: 'PX Tree Autumn', F: 'PX Tree Flag', l: glow('PX Lamp Warm')
    };
    var poleAt = [TT.flag[0], (d[2] + 10) * G8, TT.flag[2]];
    return model('lm_treetop_lookout', pal, [g, [z, park], [f, poleAt]], {
      pivots: { zip: park, flag: [poleAt[0] + G16, poleAt[1] + 0.25, poleAt[2]] },
      anchors: { door: TT.door, spot: TT.spot, nest: [TT.nest[0], (d[2] + 1) * G8, TT.nest[2]], landing: TT.landing,
                 zipStart: [park[0], park[1] - 0.375, park[2], 'zip'] }
    });
  }
  /* a point on the zip line: u 0 at the nest end … 1 at the landing end (where the trolley parks) */
  function zipPoint(u) {
    var a = TT.zipFrom, b = TT.zipTo, s = 0.08 + (1 - 0.08 - TT.park) * u;
    return [snap(a[0] + (b[0] - a[0]) * s), snap(a[1] + (b[1] - a[1]) * s), snap(a[2] + (b[2] - a[2]) * s)];
  }

  /* ================================================================
     CASTLE KEEP — one even G8 grid (keep, towers, gate, windows, rods), the bridge and the banners
     on their pivots, G16 poles and flags
     ================================================================ */
  function keepVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), pl = grid(G16), i, j, k, n, layers = [g, pl], pivots = {};
    function stone(i2, j2) { return lite || j2 % 4 !== 3 ? 's' : 'S'; }
    /* the keep: walls to 2.5 u and a battlement of merlons to 2.75 u */
    g.box(-10, 9, 0, 19, -8, 3, stone);
    for (i = -10; i <= 9; i++) if ((i + 10) % 4 < 2) g.box(i, i, 20, 21, 3, 3, 's').box(i, i, 20, 21, -8, -8, 's');
    for (k = -8; k <= 3; k++) if ((k + 8) % 4 < 2) g.box(-10, -10, 20, 21, k, k, 's').box(9, 9, 20, 21, k, k, 's');
    /* four round towers with a sandstone cornice and flat battlements */
    CK.towers.forEach(function (t, n2) {
      var c = [t[0] / G8 - 0.5, t[1] / G8 - 0.5];
      g.lathe([[4, 0, 26, stone], [4.6, 27, 27, 't']], { at: c });
      g.lathe([[4, 28, 29, function (ii, jj, kk) {
        var dx = ii - c[0], dz = kk - c[1];
        return Math.hypot(dx, dz) > 2.9 && (Math.floor((Math.atan2(dz, dx) / TAU + 1) * 8) & 1) ? 's' : null;
      }]], { at: c });
      /* a warm arched window on each tower's front (sandstone cap); the front towers' have flower boxes */
      var w0 = t[1] < 0 ? 22 : 13, w1 = w0 + (t[1] < 0 ? 2 : 3);
      for (j = w0; j <= w1 + 1; j++) for (i = -1; i <= 0; i++) g.paint(c[0] + i + 0.5, j, j > w1 ? 't' : 'L');
      if (t[1] > 0 && !lite) {
        var fk = g.front(c[0] + 0.5, w0 - 1);
        g.box(c[0] - 1.5, c[0] + 1.5, w0 - 1, w0 - 1, fk + 1, fk + 1, 'w').box(c[0] - 1.5, c[0] + 1.5, w0, w0, fk + 1, fk + 1, function (ii) { return (ii & 1) ? 'f' : 'y'; });
      }
      var fl = grid(G16), px = t[0], pz = t[1];
      fl.group('flag' + n2, function () { fl.box(0, 5, 0, 5, 0, 0, 'v').box(6, 6, 1, 4, 0, 0, 'v'); });
      if (!lite) fl.decal('+z', [1, 1, 0], [4, 4], 'sun');
      layers.push([fl, [px, 4.125, pz]]);
      pivots['flag' + n2] = [px, 4.3125, pz];
      pl.box(Math.round(px / G16) - 1, Math.round(px / G16) - 1, 56, 71, Math.round(pz / G16), Math.round(pz / G16), 'G');
    });
    /* the gate tower: a round-arched doorway, a sandstone arch, the gold-sun shield, a window */
    g.box(-4, 3, 0, 23, 4, 7, stone);
    for (i = -4; i <= 3; i++) if ((i + 4) % 4 < 2) g.box(i, i, 24, 25, 7, 7, 's');
    g.box(-4, -4, 24, 25, 4, 6, 's').box(3, 3, 24, 25, 4, 6, 's');
    for (j = 0; j <= 8; j++) for (i = -3; i <= 2; i++) {
      var w = j <= 6 ? 3 : j === 7 ? 2 : 1;
      if (i >= -w && i <= w - 1) { g.box(i, i, j, j, 4, 7, null); g.set(i, j, 3, 'd'); }
      else if (j <= 9 && (i === -w - 1 || i === w)) g.set(i, j, 7, 't');
    }
    g.box(-2, 1, 9, 9, 7, 7, 't').box(-1, 0, 10, 10, 7, 7, 't');
    if (!lite) g.decal('+z', [-2, 12, 7], [4, 4], 'shieldSun');
    g.box(-1, 0, 18, 20, 7, 7, 'L');
    /* rods for the banners; iron rings beside the gate */
    g.box(-8, -4, 19, 19, 4, 4, 'G').box(3, 7, 19, 19, 4, 4, 'G').set(-4, 10, 8, 'i').set(3, 10, 8, 'i');
    /* the two banners on 'banners' (violet, a sun, a swallowtail) */
    g.group('banners', function () {
      [-7, 4].forEach(function (i0) {
        g.box(i0, i0 + 2, 9, 18, 4, 4, 'v').set(i0, 8, 4, 'v').set(i0 + 2, 8, 4, 'v');
        if (!lite) g.box(i0, i0 + 2, 17, 17, 4, 4, 'G');
      });
    });
    if (!lite) g.decal('+z', [-7, 13, 4], [3, 3], 'sun').decal('+z', [4, 13, 4], [3, 3], 'sun');
    /* the drawbridge on 'bridge', standing up in front of the doorway (hinged at its foot) */
    g.group('bridge', function () { g.box(-4, 3, 0, 9, 8, 8, function (ii, jj) { return !lite && (jj === 2 || jj === 7) ? 'i' : 'W'; }); });
    pivots.bridge = CK.hinge; pivots.banners = [0, CK.rod, 0.5625];
    var pal = {
      s: 'PX Castle Stone', S: 'PX Castle Stone 2', t: 'PX Castle Sandstone', d: 'PX Castle Iron', i: 'PX Castle Iron', G: 'PX Castle Gold',
      v: 'PX Castle Banner', W: { token: 'PX Castle Wood', mode: 'plank' }, w: 'PX Castle Wood', f: mid('PX Castle Pennant'), y: mid('PX Castle Gold'),
      L: glow('PX Castle Window')
    };
    var m = model('lm_castle_keep', pal, layers, { pivots: pivots, anchors: { door: CK.door, spot: CK.spot, gate: CK.gate } });
    m.cull = [];                      /* every face: the bridge's back is its top once it is down */
    return m;
  }

  /* ================================================================
     GREAT IGLOO — one even G8 grid (dome, tunnel, hatch, porthole, chute, tower, lantern), a G16
     pole and pennant, G16 bunting, three penguins on pen0 – pen2
     ================================================================ */
  /* the local stand-in penguin (when px-characters is not loaded): GC boxes, 9 rows like the critter */
  function localPenguin(size) {
    var g = VX().grid({ grid: [0.45, 0.4, 0.33][size % 3] / 9 });
    g.box(-2, 2, 1, 7, -2, 1, 'n').box(-1, 1, 8, 8, -2, 1, 'n').box(-1, 1, 1, 6, 1, 1, 'f').box(-2, -1, 6, 6, 1, 1, 'e').box(1, 2, 6, 6, 1, 1, 'e');
    g.box(0, 0, 5, 5, 2, 2, 'o').box(-2, -1, 0, 0, 0, 2, 'o').box(1, 2, 0, 0, 0, 2, 'o').box(-3, -3, 2, 5, -1, 0, 'n').box(3, 3, 2, 5, -1, 0, 'n');
    return g.model({ id: 'penguin', palette: {} });
  }
  var PEN_MAP = { n: 'N', f: 'F', o: 'O', e: 'E', G: 'X' };
  /* one penguin's layers, every voxel on `pivot`, its chars mapped into the igloo palette, standing at `at` */
  function penguinLayers(size, pivot, at, local) {
    var C = local ? null : chars(), m = C && typeof C.critterVoxels === 'function' ? C.critterVoxels('penguin', { size: size }) : null;
    if (!m) m = localPenguin(size);
    return m.layers.map(function (ly) {
      var s = ly.vox, c = new Uint8Array(s.c.length), p = new Uint8Array(s.c.length);
      for (var n = 0; n < c.length; n++) if (s.c[n]) { c[n] = (PEN_MAP[String.fromCharCode(s.c[n])] || 'N').charCodeAt(0); p[n] = 1; }
      var a = ly.at || [0, 0, 0];
      return { vox: { grid: s.grid.slice(), origin: s.origin.slice(), min: s.min.slice(), dims: s.dims.slice(), c: c, p: p, names: [null, pivot] },
               at: [at[0] + a[0], at[1] + a[1], at[2] + a[2]] };
    });
  }
  function chutePath() { return curve(IG.chute, 0.02); }
  /* the igloo's height: its LOOK h (the pole's tip, to G16), never under the dome-and-lantern 2.625 u */
  function iglooTop() {
    var L = look(), e = L && L.LOOK && L.LOOK.lm_ice_igloo, h = e && e.h > 0 ? +e.h : IG.h;
    return Math.max(2.625, Math.round(h / G16) * G16);
  }
  /* the aurora bunting over the doorway (MID / HIGH detail): a G16 string draped across the dome's
     front from shoulder to shoulder, IG.swag [x0, x1, y at the ends, sag], each column just proud of
     the snow under its flags, with a four-row flag hung under it every IG.flagEvery u (mint,
     violet, sky); voxels the snow (g8) holds are left out, so its ends tuck into the dome */
  function swag(b, g8) {
    var S = IG.swag, n = Math.ceil((S[1] - S[0]) / G16) * 2, prev = null, run = IG.flagEvery / 2, c = 0, s, a, q;
    function surf(x, y) { var u = (x - IG.cx) / (IG.rx * G8), v = y / (IG.ry * G8), w = 1 - u * u - v * v; return IG.cz + IG.rz * G8 * Math.sqrt(w > 0 ? w : 0) + G8 / 2; }
    function put(i, j, k, ch) { if (!g8.has(Math.floor((i + 0.5) * G16 / G8), Math.floor((j + 0.5) * G16 / G8), Math.floor((k + 0.5) * G16 / G8))) b.set(i, j, k, ch); }
    for (s = 0; s <= n; s++) {
      var u = s / n, x = S[0] + (S[1] - S[0]) * u, y = S[2] - S[3] * 4 * u * (1 - u), e = Math.sqrt(Math.sin(Math.PI * u));
      var z = surf(x, y) + (surf(x, y - 4 * G16) - surf(x, y)) * e;            /* clear of the snow under its flags; back onto it at the ends */
      var v = [Math.floor(x / G16), Math.floor(y / G16), Math.ceil(z / G16)];
      if (!prev) { prev = v; put(v[0], v[1], v[2], 'g'); continue; }
      for (a = 0; a < 3; a++) { q = [1, 0, 2][a]; while (prev[q] !== v[q]) { prev[q] += prev[q] < v[q] ? 1 : -1; put(prev[0], prev[1], prev[2], 'g'); } }
      run += (S[1] - S[0]) / n;
      if (run < IG.flagEvery || u > 0.9) continue;
      run = 0;
      var fc = 'MUW'.charAt(c++ % 3);
      for (a = -2; a <= 2; a++) { put(v[0] + a, v[1] - 1, v[2], fc); put(v[0] + a, v[1] - 2, v[2], fc); if (a * a < 2) put(v[0] + a, v[1] - 3, v[2], fc); }
      put(v[0], v[1] - 4, v[2], fc);
    }
  }
  function iglooVoxels(st, o) {
    var lite = !!(o && o.lite), g = grid(G8), f = grid(G16), i, j, k, ci = IG.cx / G8 - 0.5, ck = IG.cz / G8 - 0.5, top = Math.floor(IG.ry - 0.5);
    var tip = iglooTop(), tall = tip >= IG.tall, pole = IG.pole[tall ? 1 : 0], foot = Math.round((tip - pole) / G8), base = foot - 8, ti = IG.tower[0] / G8 - 0.5, tk = IG.tower[1] / G8 - 0.5;
    /* the dome: snow and pale-ice block courses with a deep-ice joint between them, so the rings read
       (LOD1: two-row bands, which survive the halving) */
    for (j = 0; j <= top; j++) for (k = -8; k <= 7; k++) for (i = -8; i <= 11; i++) {
      var u = (i - ci) / IG.rx, w = (k - ck) / IG.rz, v = (j + 0.5) / IG.ry;
      if (u * u + w * w + v * v > 1) continue;
      g.set(i, j, k, lite ? 'szsD'.charAt((j >> 1) & 3) : j % 3 === 2 ? 'D' : (j / 3 | 0) & 1 ? 'z' : 's');
    }
    /* the hatch on top: a dark hole in an ice collar */
    for (k = -4; k <= 2; k++) for (i = -1; i <= 5; i++) {
      var dh = Math.hypot(i - ci, k - ck);
      if (dh <= 1.2) g.set(i, top, k, 'h');
      else if (dh <= 2.3) g.set(i, top + 1, k, 'c');
    }
    /* the tunnel: a round-arched block vault out to the front edge, warm light glowing inside */
    var DOOR = [2, 2, 2, 1, 0], VAULT = [3, 3, 3, 3, 2, 1];
    for (k = 1; k <= 6; k++) for (j = 0; j <= 5; j++) for (i = -2; i <= 6; i++) {
      var di = Math.abs(i - ci);
      if (j < DOOR.length && di <= DOOR[j]) { g.clear(i, j, k); if (k === 1) g.set(i, j, 1, 'L'); }
      else if (k >= 2 && di <= VAULT[j]) g.set(i, j, k, k < 6 ? 's' : 'b');
    }
    /* the warm light lines the tunnel, so the way in glows from any angle; its mouth is a deep-ice
       arch, so the glowing doorway reads against the snow */
    for (k = 2; k <= 5; k++) for (j = 0; j <= 5; j++) for (i = -2; i <= 6; i++) {
      var dj = Math.abs(i - ci), lin = (j < DOOR.length && dj === DOOR[j] + 1) || (j === DOOR.length && dj <= 1);
      if (lin && g.has(i, j, k)) g.set(i, j, k, 'L');
    }
    /* the porthole: clear ice in a deep-blue frame on the front-right */
    if (!lite) {
      [[7, 6], [8, 6], [7, 7], [8, 7]].forEach(function (q) { g.paint(q[0], q[1], 'q'); });
      [[6, 6], [6, 7], [9, 6], [9, 7], [7, 5], [8, 5], [7, 8], [8, 8]].forEach(function (q) { g.paint(q[0], q[1], 'c'); });
    }
    /* the chute: an ice bed between snow lips, packed snow under it down to the dome or the ground */
    chutePath().forEach(function (p, n, all) {
      var q = all[Math.min(n + 1, all.length - 1)], b = all[Math.max(n - 1, 0)], tx = q[0] - b[0], tz = q[2] - b[2], tl = Math.hypot(tx, tz) || 1;
      for (var s = -1.5; s <= 1.5; s += 0.5) {
        var x = p[0] - tz / tl * s * G8, zz = p[2] + tx / tl * s * G8, I = Math.floor(x / G8), K = Math.floor(zz / G8), J = Math.floor(p[1] / G8), edge = Math.abs(s) > 1;
        g.set(I, J, K, edge ? 'p' : 'b');
        if (edge && !lite) g.set(I, J + 1, K, 'p');
        for (var jj = J - 1; jj >= 0 && !g.has(I, jj, K); jj--) g.set(I, jj, K, 'p');
      }
    });
    /* the ice tower: an octagonal drum of deep-ice and pale-ice courses from the ground (at the back
       right, where the dome is low) up to a snow ring under its lantern (LOD1: four-row courses,
       which survive the halving) */
    var oct = { at: [ti, tk], segments: 'oct' }, R = IG.towerR;
    for (j = 0; j < base; j++) g.lathe([[R, j, j, j === base - 1 ? 's' : (lite ? (j >> 2) & 1 : ((base - 2 - j) >> 1) & 1) ? 'c' : 'b']], oct);
    /* a tall tower has a lit aurora window on its front, above the dome */
    if (tall && !lite) g.box(ti, ti, base - 6, base - 5, tk + R, tk + R, 'A');
    /* the aurora lantern: a deep-ice sill, three rows of glowing panes (mint at the front, sky on the
       right, violet on the left and at the back) between deep-ice posts on the diagonals, a stepped
       snow cap (on a tall tower it overhangs, high above the penguins' hop) and a clear-ice finial
       the pole stands on */
    g.lathe([[R, base, base, 'b']], oct);
    for (j = base + 1; j <= base + 3; j++) g.lathe([[R, j, j, function (ii, jj, kk) {
      var di = ii - ti, dk = kk - tk;
      return Math.abs(di) === 2 && Math.abs(dk) === 2 ? 'b' : lite ? 'A' : dk === R ? 'A' : di === R ? 'Y' : di === -R || dk === -R ? 'V' : 'A';
    }]], oct);
    g.lathe([[tall ? R + 1 : R, base + 4, base + 4, 's'], [2.5, base + 5, base + 5, 's'], [1.5, base + 6, base + 6, 's']], oct).set(ti, base + 7, tk, 'q');
    /* the pole and its coral pennant on the finial */
    var np = Math.round(pole / G16);
    f.box(0, 0, 0, np - 1, 0, 0, 'i').box(1, 4, np - 4, np - 1, 0, 0, 'k').box(5, 6, np - 3, np - 2, 0, 0, 'k');
    var bt = grid(G16);
    if (!lite) swag(bt, g);
    var pal = { s: 'PX Ice Snow', z: 'PX Ice', D: 'PX Ice Deep', c: { token: 'PX Ice', mode: 'ice' }, q: { token: 'PX Ice Shine', mode: 'ice' }, b: { token: 'PX Ice Deep', mode: 'ice' },
                p: { token: 'PX Ice Snow', mode: 'snow' }, h: 'PX Penguin Back', L: glow('PX Ice Hut Glow'), i: 'PX Ice Deep', k: 'PX Coral',
                A: glow('PX Aurora Mint'), Y: glow('PX Aurora Sky'), V: glow('PX Aurora Violet'),
                g: mid('PX Ice Snow'), M: mid('PX Aurora Mint'), U: mid('PX Aurora Violet'), W: mid('PX Aurora Sky'),
                N: 'PX Penguin Back', F: 'PX Penguin Front', O: 'PX Penguin Orange', E: 'PX Ink Eye', X: glow('PX Glint') };
    var path = chuteTrack(), m = model('lm_ice_igloo', pal, [g, [f, [IG.tower[0] - G16 / 2, foot * G8, IG.tower[1] - G16 / 2]], bt], {
      anchors: { door: IG.door, spot: [IG.door[0], 0, 0.875], rampTop: path[0], rampFoot: path[path.length - 1] }
    });
    IG.rest.forEach(function (r, n) {
      penguinLayers(n, 'pen' + n, r, o && o.local).forEach(function (ly) { m.layers.push(ly); });
      m.pivots['pen' + n] = { at: U(r), parent: null };
    });
    m.cull = [];                      /* every face: the penguins turn their backs and slide on their bellies */
    return m;
  }
  var BUILD = { lm_pier_wheel: wheelVoxels, lm_jungle_treehouse: treehouseVoxels, lm_treetop_lookout: lookoutVoxels, lm_castle_keep: keepVoxels, lm_ice_igloo: iglooVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });
  /* ================================================================
     PURE ANIMATION HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function turnOf(deg) { deg = (+deg || 0) % 360; return deg < 0 ? deg + 360 : deg; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  /* XYZ Euler angles in degrees (the kit's setPivot order) of R = Ry(yaw) · Rx(pitch) · Rz(roll) */
  function eulerYXZ(yaw, pitch, roll, out) {
    out = out || [0, 0, 0];
    var a = yaw * DEG, b = pitch * DEG, c = roll * DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    var m13 = sa * cb;
    if (Math.abs(m13) < 0.9999999) {
      out[0] = Math.atan2(sb, ca * cb) / DEG; out[1] = Math.asin(m13) / DEG; out[2] = Math.atan2(ca * sc - sa * sb * cc, ca * cc + sa * sb * sc) / DEG;
    } else {
      out[0] = Math.atan2(sa * sc + ca * sb * cc, cb * cc) / DEG; out[1] = (m13 > 0 ? 90 : -90); out[2] = 0;
    }
    for (var n = 0; n < 3; n++) if (Math.abs(out[n]) < 1e-9) out[n] = 0;
    return out;
  }
  /* the point at fraction u (0 … 1) of a polyline's length → out {p [x, y, z], d [dx, dy, dz] (unit)} */
  function along(pts, u, out) {
    out = out || { p: [0, 0, 0], d: [0, 0, 1] };
    var len = 0, n, seg = [];
    for (n = 1; n < pts.length; n++) { var l = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1], pts[n][2] - pts[n - 1][2]); seg.push(l); len += l; }
    var s = clamp01(u) * len;
    for (n = 0; n < seg.length - 1 && s > seg[n]; n++) s -= seg[n];
    var a = pts[n], b = pts[n + 1], f = seg[n] > 0 ? Math.min(1, s / seg[n]) : 0;
    for (var q = 0; q < 3; q++) { out.p[q] = a[q] + (b[q] - a[q]) * f; out.d[q] = seg[n] > 0 ? (b[q] - a[q]) / seg[n] : 0; }
    return out;
  }
  /* the zip trolley's offset from where it parks, at zip (0 the nest end … 1 parked by the landing) */
  function zipOffset(zip, out) {
    out = out || [0, 0, 0];
    var a = zipPoint(0), b = zipPoint(1), k = 1 - clamp01(zip);
    for (var q = 0; q < 3; q++) out[q] = (a[q] - b[q]) * k + 0;
    return out;
  }
  /* penguin i at way-round value u (SLMotion 'penguins' p0 – p2: 0 … 4, mod 4) with the waddle tilt
     rock (degrees) → out {p: offset from its rest spot, r: XYZ Euler degrees}. Legs (SLMotion
     .penguinLeg): 0 waddle from its spot to the door and into the tunnel · 1 inside, hidden in the
     dome, up to the hatch · 2 pop out of the hatch and hop to the top of the chute · 3 belly-slide
     down the chute, glide to its spot, stand up and face the front */
  var PEN = { pop: 0.4, tip: 0.2, slide: 0.64, glide: 0.88, stand: 0.76, belly: 0.125, hop: 0.12 };
  var CHUTE = null, _al = { p: [0, 0, 0], d: [0, 0, 1] }, _lg = {};
  function chuteTrack() {
    if (CHUTE) return CHUTE;
    CHUTE = chutePath().map(function (p) { return [p[0], p[1] + G8 / 2, p[2]]; });
    return CHUTE;
  }
  function legOf(u, out) {
    var M = mo();
    if (M && typeof M.penguinLeg === 'function') return M.penguinLeg(u, out);
    var w = ((u % 4) + 4) % 4, leg = Math.min(3, Math.floor(w));
    out.leg = leg; out.k = w - leg;
    return out;
  }
  function yawOf(dx, dz) { return Math.atan2(dx, dz) / DEG; }
  function penguinPose(i, u, rock, out) {
    out = out || { p: [0, 0, 0], r: [0, 0, 0] };
    rock = +rock || 0;
    var R = IG.rest[i], Lg = legOf(+u || 0, _lg), k = Lg.k, pos = [R[0], 0, R[2]], yaw = 0, pitch = 0, roll = 0, q;
    if (Lg.leg === 0) {
      var walk = [R, [IG.door[0], 0, R[2]], IG.inside];
      along(walk, k, _al); pos = _al.p.slice();
      yaw = turnTo(0, aheadYaw(walk, k), smooth(k / 0.12)); roll = rock;
    } else if (Lg.leg === 1) {
      for (q = 0; q < 3; q++) pos[q] = IG.inside[q] + (IG.below[q] - IG.inside[q]) * k;
      yaw = 180;
    } else if (Lg.leg === 2) {
      var T0 = chuteTrack()[0], wy = yawOf(T0[0] - IG.hatch[0], T0[2] - IG.hatch[2]);
      if (k < PEN.pop) { var e = smooth(k / PEN.pop); for (q = 0; q < 3; q++) pos[q] = IG.below[q] + (IG.hatch[q] - IG.below[q]) * e; yaw = turnTo(180, wy, e); }
      else {
        var w = (k - PEN.pop) / (1 - PEN.pop);
        for (q = 0; q < 3; q++) pos[q] = IG.hatch[q] + (T0[q] - IG.hatch[q]) * w;
        pos[1] += PEN.hop * Math.sin(Math.PI * w);
        yaw = wy; roll = rock;
      }
    } else {
      /* SLMotion eases this leg in (inQuad): s is its clock again. It tips onto its belly, speeds
         down the chute, glides out over the snow (slowing) to its spot, then stands and faces us */
      var tr = chuteTrack(), n2 = tr.length, end = tr[n2 - 1], s = Math.sqrt(k), gy = yawOf(R[0] - end[0], R[2] - end[2]);
      var tip = smooth(s / PEN.tip), f = clamp01((s - PEN.tip) / (PEN.slide - PEN.tip)), g = clamp01((s - PEN.slide) / (PEN.glide - PEN.slide));
      var up = smooth((s - PEN.stand) / (1 - PEN.stand)), ey = yawOf(end[0] - tr[n2 - 2][0], end[2] - tr[n2 - 2][2]), turn = smooth(g / 0.5), es = Math.atan2(tr[n2 - 2][1] - end[1], Math.hypot(end[0] - tr[n2 - 2][0], end[2] - tr[n2 - 2][2])) / DEG;
      if (s < PEN.slide) {
        var fa = f * (1 + f) / 2, b2 = along(tr, Math.min(1, fa + 0.06), { p: [0, 0, 0], d: [0, 0, 1] }).p;   /* it speeds up down the chute */
        along(tr, Math.max(0, fa - 0.06), _al);
        var dx = b2[0] - _al.p[0], dy = b2[1] - _al.p[1], dz = b2[2] - _al.p[2];
        along(tr, fa, _al); pos = _al.p.slice(); pos[1] += PEN.belly * tip;
        yaw = yawOf(dx, dz);
        pitch = (90 + Math.atan2(-dy, Math.hypot(dx, dz)) / DEG) * tip;
      } else {
        var o2 = 1 - (1 - g) * (1 - g);
        pos = [end[0] + (R[0] - end[0]) * o2, end[1] * (1 - o2) + PEN.belly * (1 - up), end[2] + (R[2] - end[2]) * o2];
        yaw = turnTo(turnTo(ey, gy, turn), 0, up);
        pitch = (90 + es * (1 - turn)) * (1 - up);
      }
    }
    out.p[0] = pos[0] - R[0] + 0; out.p[1] = pos[1] - R[1] + 0; out.p[2] = pos[2] - R[2] + 0;
    eulerYXZ(yaw, pitch, roll, out.r);
    return out;
  }
  /* the facing along a walk: toward a point a little ahead, so a corner is a turn, never a snap */
  function aheadYaw(pts, k) {
    var a = along(pts, k, { p: [0, 0, 0], d: [0, 0, 1] }), b = along(pts, Math.min(1, k + 0.2), { p: [0, 0, 0], d: [0, 0, 1] });
    var dx = b.p[0] - a.p[0], dz = b.p[2] - a.p[2];
    return Math.hypot(dx, dz) > 1e-6 ? yawOf(dx, dz) : yawOf(a.d[0], a.d[2]);
  }
  /* from yaw a to yaw b (degrees) the short way round, f of the way */
  function turnTo(a, b, f) { var d = ((b - a) % 360 + 540) % 360 - 180; return a + d * clamp01(f); }
  /* ================================================================
     FACTORY — SL3D.defineVox('landmarks', K → {id: {voxels, lod1, act, idle, forget, show?, lit?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var ZERO = [0, 0, 0], ONE = [1, 1, 1], _r = [0, 0, 0], _p = [0, 0, 0], _s = [1, 1, 1], _sw = {}, _pp = { p: [0, 0, 0], r: [0, 0, 0] };
    function setPivot(a, name, r, p, s) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (pv && typeof pv.set === 'function') pv.set(r || ZERO, p || ZERO, s || ONE);
    }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    function emit(a, kind, at, n) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n); } catch (e) { /* fx is optional */ } } }
    function freq(name, d) { var f = M && typeof M.freq === 'function' ? M.freq(name) : 0; return f > 0 ? f : d; }
    function midHigh(a) { var t = a && a.template && a.template.tier; return t !== 'LOW'; }
    /* per-copy memory (the wheel's turn, the bridge, the idle clocks): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, turn: 0, down: 0, lastT: null, wisp: null }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    function busy(a) { var me = live.get(a.uid); return !!me && !me.done && me.copy === mem(a).copy; }
    function petOf(a) {
      var p = a.pets, v = null;
      try { v = p && typeof p.active === 'function' ? p.active() : null; } catch (e) { v = null; }
      return typeof v === 'string' && v ? v : v ? true : null;
    }
    function askPet(a, id) {
      var kind = LOOKS[id] && LOOKS[id].perform !== undefined ? LOOKS[id].perform : PERFORM[id], p = a.pets, lead = 0;
      if (!kind || !p || typeof p.perform !== 'function') return false;
      try { lead = p.perform(kind, a.uid); } catch (e) { lead = 0; /* no crew yet */ }
      return typeof lead === 'number' && lead > 0;
    }
    function voiceStep(pet) {
      var S = snd();
      return typeof pet === 'string' && S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : -1;
    }
    /* one act per uid on its SLMotion timeline: sample → spec.apply, cues → sfx / fx; the last
       call is the end state, then spec.end. A landmark ignores re-taps while its act runs; cancel()
       jumps to the end state; a copy rebuilt mid-act just stops (the new copy starts at rest) */
    function run(a, id, name, spec) {
      if (!a || !M || !M.ACTS || !M.ACTS[name] || busy(a)) return null;
      var m = mem(a), reduced = !!a.reduced, o = { reduced: reduced, from: spec.from ? spec.from(a, m) : null };
      var dur = M.durOf(name, o), cues = M.cues(name, o), ci = 0, uid = a.uid, at = SPARK[id];
      var me = { name: name, dur: dur, out: {}, copy: m.copy, reduced: reduced, pet: petOf(a), done: false };
      live.set(uid, me);
      me.riding = spec.pet === false ? false : askPet(a, id);
      function finish(h, mm) { me.done = true; if (live.get(uid) === me) live.delete(uid); if (spec.end) spec.end(h, me, mm); }
      me.update = function (h, tAct) {
        if (me.done) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur, mm = mem(h);
        if (mm.copy !== me.copy) { me.done = true; if (live.get(uid) === me) live.delete(uid); return false; }
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, at, c.n || 1);
            else if (typeof h.sfx !== 'function') continue;
            else if (!c.pet) h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
            else if (me.riding && voiceStep(me.pet) >= 0) h.sfx('voice', c.vol == null ? 1 : c.vol, voiceStep(me.pet));
          } catch (e) { /* a cue never stops its act */ }
        }
        spec.apply(h, me.out, tt, me, mm);
        if (t < dur) return true;
        finish(h, mm);
        return false;
      };
      me.cancel = function () {
        if (me.done) return;
        try { var mm = mem(a); M.sample(name, dur, me.out, o); spec.apply(a, me.out, dur, me, mm); finish(a, mm); } catch (e) { me.done = true; /* the copy is gone */ }
      };
      return me;
    }

    /* ---------- the Big Wheel: a quarter turn, gondolas level, the bulbs chase; it keeps its turn ---------- */
    function wheelPose(a, deg) {
      var w = turnOf(deg);
      _r[0] = 0; _r[1] = 0; _r[2] = w; setPivot(a, 'wheel', _r);
      _r[2] = w ? 360 - w : 0;
      for (var n = 0; n < 8; n++) setPivot(a, 'g' + n, _r);
    }
    function bulbs(a, t, reduced) { for (var g = 0; g < WH.groups; g++) setState(a, 'bulbs' + g, M.wheelBulb(t, g, WH.groups, reduced)); }
    var wheelSpec = {
      apply: function (a, out, t, me, m) { me.deg = out.deg || 0; wheelPose(a, m.turn + me.deg); bulbs(a, t, me.reduced); },
      end: function (a, me, m) { m.turn = turnOf(m.turn + (me.deg || 0)); wheelPose(a, m.turn); for (var g = 0; g < WH.groups; g++) setState(a, 'bulbs' + g, WH.steady); }
    };
    /* idle: 0.02 rev/s on the live island, MID / HIGH only; still under reduced motion */
    function wheelIdle(a) {
      if (!a || a.reduced || !midHigh(a) || busy(a)) { if (a) mem(a).lastT = null; return false; }
      var m = mem(a), t = +a.t || 0, dt = m.lastT == null ? 0 : Math.min(0.25, Math.max(0, t - m.lastT));
      m.lastT = t;
      if (!(dt > 0)) return false;
      m.turn = turnOf(m.turn + 360 * WH.rps * dt);
      wheelPose(a, m.turn);
      return true;
    }

    /* ---------- the Great Treehouse: the basket drops for the pet and lifts it to the top deck; the lamps dip and breathe ---------- */
    var liftSpec = {
      apply: function (a, out) { _p[0] = 0; _p[1] = -TH.drop * (1 - clamp01(out.basket)); _p[2] = 0; setPivot(a, 'lift', null, _p); setState(a, 'lamps', out.lamps); },
      end: function (a) { setPivot(a, 'lift'); setState(a, 'lamps', 1); }
    };
    function treeIdle(a) {
      if (!a || a.reduced || !midHigh(a) || busy(a) || !M) return false;
      var t = +a.t || 0, ph = +a.phase || 0;
      M.sway(t, TH.sway / DEG, 1 / TH.swayHz, ph, false, _sw);
      _r[0] = _sw.x; _r[1] = 0; _r[2] = _sw.z; setPivot(a, 'crown', _r);
      _r[0] = 0; _r[2] = TH.swing * Math.sin(TAU * (t / TH.swingPeriod + ph)); setPivot(a, 'lift', _r);
      return true;
    }

    /* ---------- the Treetop Lookout: the trolley runs back up to the nest, then zips down to the landing ---------- */
    var _z = [0, 0, 0];
    var zipSpec = {
      apply: function (a, out) { setPivot(a, 'zip', null, zipOffset(out.zip, _z)); },
      end: function (a) { setPivot(a, 'zip'); }
    };
    function flagIdle(a, names, deg) {
      if (!a || a.reduced || !M) return false;
      var t = +a.t || 0, ph = +a.phase || 0, hz = freq('flagFlutter', 0.5);
      for (var n = 0; n < names.length; n++) { _r[0] = 0; _r[1] = M.pennant(t, n, deg, hz, ph, false); _r[2] = 0; setPivot(a, names[n], _r); }
      return true;
    }

    /* ---------- the Castle Keep: the drawbridge lowers (banners unfurl) or rises (banners furl); lit = down ---------- */
    function downOf(a) { return typeof a.lit === 'boolean' || typeof a.lit === 'number' ? (+a.lit >= 0.5 ? 1 : 0) : mem(a).down; }
    function keepPose(a, down, banners) {
      _r[0] = 90 * clamp01(down); _r[1] = 0; _r[2] = 0; setPivot(a, 'bridge', _r);
      _s[0] = 1; _s[1] = CK.furl + (1 - CK.furl) * clamp01(banners); _s[2] = 1; setPivot(a, 'banners', null, null, _s);
    }
    function keepSpec(lower) {
      return {
        pet: lower ? undefined : false,
        from: function (a) { var d = downOf(a); return { down: d, banners: d }; },
        apply: function (a, out) { keepPose(a, out.down, out.banners); },
        end: function (a, me, m) { m.down = lower ? 1 : 0; keepPose(a, m.down, m.down); }
      };
    }
    var KEEP_DOWN = keepSpec(true), KEEP_UP = keepSpec(false);
    function keepAct(a, name) {
      if (!a) return null;
      var up = name === 'drawbridgeUp' || (name !== 'drawbridgeDown' && downOf(a) === 1);
      return run(a, 'lm_castle_keep', up ? 'drawbridgeUp' : 'drawbridge', up ? KEEP_UP : KEEP_DOWN);
    }
    function keepShow(a) { if (a && !busy(a)) { var d = downOf(a); keepPose(a, d, d); } }
    function keepLit(a, on) { if (!a) return; var m = mem(a), me = live.get(a.uid); if (me) { me.done = true; live.delete(a.uid); } m.down = on ? 1 : 0; keepPose(a, m.down, m.down); }

    /* ---------- the Great Igloo: three penguins waddle in, pop out of the hatch and belly-slide home ---------- */
    var penSpec = {
      pet: false,
      apply: function (a, out, t, me) {
        for (var i = 0; i < 3; i++) { penguinPose(i, out['p' + i], me.reduced ? 0 : (out.rock || 0) * (i & 1 ? -1 : 1), _pp); setPivot(a, 'pen' + i, _pp.r, _pp.p); }
      },
      end: function (a) { for (var i = 0; i < 3; i++) setPivot(a, 'pen' + i); }
    };
    /* idle: a 3-cube cold wisp from the hatch every 5 s, MID / HIGH, never under reduced motion */
    function iglooIdle(a) {
      if (!a || a.reduced || !midHigh(a)) return false;
      var m = mem(a), n = Math.floor(((+a.t || 0) + (+a.phase || 0) * IG.every) / IG.every);
      if (m.wisp === null) { m.wisp = n; return false; }
      if (n === m.wisp) return false;
      m.wisp = n;
      emit(a, 'wisp', IG.wisp, 3);
      return true;
    }

    var out = {};
    IDS.forEach(function (id) { out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget }; });
    out.lm_pier_wheel.act = function (a) { return run(a, 'lm_pier_wheel', 'wheel', wheelSpec); };
    out.lm_pier_wheel.idle = wheelIdle;
    out.lm_jungle_treehouse.act = function (a) { return run(a, 'lm_jungle_treehouse', 'lift', liftSpec); };
    out.lm_jungle_treehouse.idle = treeIdle;
    out.lm_treetop_lookout.act = function (a) { return run(a, 'lm_treetop_lookout', 'zip', zipSpec); };
    out.lm_treetop_lookout.idle = function (a) { return flagIdle(a, ['flag'], TT.flagDeg); };
    out.lm_castle_keep.act = keepAct;
    out.lm_castle_keep.idle = function (a) { return flagIdle(a, ['flag0', 'flag1', 'flag2', 'flag3'], CK.flagDeg); };
    out.lm_castle_keep.show = keepShow;
    out.lm_castle_keep.lit = keepLit;
    out.lm_ice_igloo.act = function (a) { return run(a, 'lm_ice_igloo', 'penguins', penSpec); };
    out.lm_ice_igloo.idle = iglooIdle;
    return out;
  }

  /* ================================================================
     isleDiorama — SL3D.defineVoxApi('isleDiorama', (K, SL3D) → fn(isle, tier))
     ================================================================ */
  /* a model at rest for one static bake: every voxel on the root, every state colour at its resting level */
  function still(m) {
    var out = {}, pal = {};
    Object.keys(m).forEach(function (k) { out[k] = m[k]; });
    out.pivots = {}; out.anchors = {};
    out.layers = m.layers.map(function (ly) {
      var c = {}, v = {};
      for (var k in ly) c[k] = ly[k];
      for (var q in ly.vox) v[q] = ly.vox[q];
      v.p = new Uint8Array(ly.vox.p.length); v.names = [null]; c.vox = v;
      return c;
    });
    out.decals = m.decals.map(function (d) { var c = {}; for (var k in d) if (k !== 'pivot') c[k] = d[k]; return c; });
    Object.keys(m.palette).forEach(function (ch) {
      var e = m.palette[ch];
      if (e && typeof e === 'object' && e.state) { var c = {}; for (var k in e) if (k !== 'state') c[k] = e[k]; c.token = (e.state.initial || 0) >= 0.5 ? e.state.on : e.state.off; pal[ch] = c; }
      else pal[ch] = e;
    });
    out.palette = pal;
    return out;
  }
  /* the sky land's diorama VoxModel: SLIsles3D.diorama(isle, its landmark at rest) | null */
  function dioramaVoxels(isle) {
    var S = isles(), id = typeof isle === 'string' && Object.prototype.hasOwnProperty.call(ISLE, isle) ? ISLE[isle] : null;
    if (!S || !id || typeof S.diorama !== 'function') return null;
    var m = S.diorama(isle, still(voxels[id]({})));
    if (m) m.id = 'land_' + isle;
    return m;
  }
  function kitFor(K, SL3D, tier) {
    try { if (tier && SL3D && typeof SL3D.kit === 'function') return SL3D.kit(tier) || K; } catch (e) { /* the bound kit */ }
    return K;
  }
  function dioramaApi(K, SL3D) {
    /* one static mesh (one draw) in a Group: userData {kind, isle, id, tier, hash, tris, place, dispose} */
    function object(isle, tier) {
      var m = dioramaVoxels(isle), Kt = kitFor(K, SL3D, tier), VK = Kt && Kt.vox, T = Kt && Kt.THREE;
      if (!m || !VK || !T) return null;
      var parts = VK.geometry(m, { tier: Kt.tier }), tris = 0;
      parts.forEach(function (p) { tris += p.geo.getAttribute('position').count / 3; });
      var mesh = VK.bakeStatic(parts.map(function (p) { return { geo: p.geo }; }), { name: 'isleDiorama:' + isle, castShadow: false });
      parts.forEach(function (p) { p.geo.dispose(); });
      var group = new T.Group(), gone = false;
      group.name = 'isleDiorama:' + isle;
      group.add(mesh);
      group.userData = { kind: 'isleDiorama', isle: isle, id: 'land_' + isle, tier: Kt.tier, hash: VX().hash(m), tris: tris, place: m.place,
        dispose: function () { if (gone) return; gone = true; if (group.parent) group.parent.remove(group); group.clear(); mesh.geometry.dispose(); } };
      return group;
    }
    var fn = function (isle, tier) { return tier == null ? dioramaVoxels(isle) : object(isle, tier); };
    fn.voxels = dioramaVoxels;
    fn.object = object;
    return fn;
  }

  return {
    VERSION: VERSION, IDS: IDS, ISLE: ISLE, ACT: ACT, PERFORM: PERFORM, SPARK: SPARK, TOKENS: TOKENS,
    LAYOUT: { wheel: WH, treehouse: TH, lookout: TT, keep: CK, igloo: IG, penguin: PEN },
    voxels: voxels, lod1: lod1, build: BUILD, factory: factory, dioramaApi: dioramaApi, dioramaVoxels: dioramaVoxels,
    gondolaAt: gondolaAt, zipPoint: zipPoint, zipOffset: zipOffset, chutePath: chutePath, chuteTrack: chuteTrack, penguinPose: penguinPose,
    localPenguin: localPenguin, eulerYXZ: eulerYXZ, along: along, turnOf: turnOf, still: still
  };
}));
