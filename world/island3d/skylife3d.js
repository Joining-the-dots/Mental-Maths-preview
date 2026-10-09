/* ================================================================
   My Island v3 — SLSkyLife3D: the sky world's ambient life (W3.5).
   window.SLSkyLife3D (classic script; THREE from SL3D.THREE / K.THREE only). require() in Node gives
   the same object: its pure lane, path, count and pose maths run without THREE, create() runs on
   tests/helpers/mini-three. SLSky3D hosts it (creates, forwards to, disposes); the SLLife3D shape
   (create / update / setEdit / setReduced / setQuality / info / dispose) is kept. Nothing here is
   pickable or buildable, and nothing reads, awards or spends points.

   ON SCREEN (≤ 3 draw calls in all, on the one 'pixel-vox' program family; no texture of its own)
     clouds  ONE instancedCubes pool of 0.5 u 'soft' cubes: pixel.js's cloudObj (3 tiers, half
             widths 3–5, depth 2), LOW 6 / MID 12 / HIGH 16. Low clouds (y −3 … −7) drift in front
             of Home and beneath the north lands; high clouds (y 5 … 8) in front of Home (z > 9:
             under its front rim in the Home view, as in the mockup) and behind the castle (z <
             −27). +x at 0.12–0.25 u/s, wrapping within x ±45 (they shrink away over the last
             4 u), bob ±0.12 u at 0.05 Hz, rewritten at 15 Hz on MID / HIGH; static on LOW and
             under reduced motion. Bases and tops follow k in 1/8 steps (lifted against
             Showtime's dim, blue light so night clouds read lilac, never navy).
     life    ONE SkinnedMesh on the 'vox' material (the pet rigs' program): rigid voxel skinning,
             one bone per moving part, the matrices written straight into the bone texture and
             uploaded only when one moved. Hot-air balloons (1 / 2 / 3, pixel.js balloonObj),
             pixel birds (3 / 6 / 9, flocks of 3–5), the critters of every unlocked land
             (SL3D.vox.makeCritter: gulls round the Big Wheel, parrots round the treehouse
             canopy, a toucan and monkeys on the rim crowns, a frog on its lily pad, squirrels on
             the rope lines, the night owl on the east oak, ducks on the moat, the igloo's
             penguins on its entrance row (kept free of objects) and one on a floe) and Home's
             rainbow-sail boat, leaping fish and butterflies. The circuit's flocks and the
             balloons go round the whole archipelago; the yard flock behind Home is Home's.
     sparks  ONE instancedCubes pool of 'glow' cubes: night star cubes on a far shell (0 / 60 /
             120), the visited island's snow (ice, 0 / 30 / 40), fireflies (jungle at night, 0 /
             16 / 32), drifting leaves (jungle), the aurora curtain (ice at night, MID / HIGH: a
             ribbon of rays hung in the sky band behind the village, above its tallest items in
             the visit view; its wave and colours drift at ≤ 0.1 Hz), the fish's splash rings and
             the boat's wake.
   WHO MOVES. Only the visited island's creatures move (they ease from / to rest over 0.6 s); the
     others hold their rest pose (perched, sitting, floating, standing by the igloo). LOW: every
     creature on an island is static, and an island's creatures hide while its centre is > 45 u
     from the camera (back under 44 u). Edit mode: the birds and balloons within 4 u of the
     visited island fade away, its creatures park and its snow, leaves, fish and butterflies go.
     Reduced motion: everything rests (birds and fish out of view, balloons still, penguins
     standing) and update() returns false. Night: the birds roost (hidden) from k 0.6 and the
     butterflies sleep; the owl, the fireflies, the star cubes and the aurora come out with k.
     The ladder: 'life' (lifeScale 0.5) halves the creatures, clouds and balloons (never below
     one cloud or balloon); 'particles' (particleScale 0.5) halves the sparks. Rates: RATES, each
     under its ART3.FREQS cap (CAPS) and MAX_FLASH_HZ.
   PATHS. Every cloud lane, the balloons' circuit and every flock's ring is checked against
     SLIsles3D.cloudExclusion() (1.5 u round a bridge line, a land box + rim from its cake tip to
     its tallest item) with the object's own extent; a sample that is not clear hides what passes.

   API (contracts.skylife3d)
     create(K, SL3D, {scene, tier, reduced, isles}) → {VERSION, group, update(dt, t, ctx {visit,
       show, edit, camera}) → busy, setIsles(unlocked), setVisit(isle), setEdit(on), setShow(k),
       setReduced(on), setQuality(q), info(), dispose()}
     additive: setLayout(isle, footprints [{x, y, w, h, path}]) — a penguin whose cell an object
       takes steps out (for SLSky3D.setLayout to forward); actors() / lanes() / sparks() read only.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLSkyLife3D = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1, TAU = Math.PI * 2;
  var ISLES = ['home', 'pier', 'jungle', 'treetop', 'castle', 'ice'], TIER_I = { LOW: 0, MID: 1, HIGH: 2 };
  /* the tier budgets (SLTier.BUDGETS; this copy only when tier.js is missing) */
  var BUDGET = {
    LOW: { clouds: 6, balloons: 1, skyBirds: 3, critters: 6, snowCubes: 0, fireflies: 0, starCubes: 0 },
    MID: { clouds: 12, balloons: 2, skyBirds: 6, critters: 14, snowCubes: 30, fireflies: 16, starCubes: 60 },
    HIGH: { clouds: 16, balloons: 3, skyBirds: 9, critters: 20, snowCubes: 40, fireflies: 32, starCubes: 120 } };
  /* each land's own life ([LOW, MID, HIGH], or the budget key): sky-world lands[].ambient + ambientLife */
  var AMBIENT = {
    home: { boat: [1, 1, 1], fish: [0, 1, 1], butterfly: [0, 2, 2] },
    pier: { gull: [0, 2, 3], fish: [0, 1, 1] },
    jungle: { parrot: [0, 2, 3], toucan: [1, 1, 1], monkey: [0, 1, 2], frog: [1, 1, 1], fish: [0, 1, 1], leaves: [0, 8, 12], fireflies: 'fireflies' },
    treetop: { squirrel: [0, 1, 2], owl: [0, 1, 1] },
    castle: { duck: [1, 2, 3], butterfly: [0, 0, 2], fish: [0, 1, 1] },
    ice: { penguin: [3, 3, 3], floe: [0, 0, 1], fish: [0, 1, 1], snow: 'snowCubes', aurora: [0, 1, 1] } };
  var CRITTERS = ['gull', 'parrot', 'toucan', 'monkey', 'frog', 'squirrel', 'owl', 'duck', 'penguin', 'floe'];
  var SPARKS = { leaves: 1, fireflies: 1, snow: 1 }, KEEP = { boat: 1, aurora: 1 };
  /* every rate (Hz) and the ART3.FREQS cap it answers to */
  var RATES = { cloudBob: 0.05, balloonBob: 0.07, balloonTurn: 0.02, birdFlap: 1.6, gullFlap: 1.6, parrotFlap: 1.6, butterflyFlap: 1.6,
    monkeyScratch: 1.5, squirrelTail: 1.0, waddle: 1.0, duckBob: 0.3, floeBob: 0.25, boatBob: 0.2, boatRoll: 0.18, snowSway: 0.12,
    leafSway: 0.2, firefly: 0.8, starTwinkle: 0.5, auroraWave: 0.1, auroraDrift: 0.08, fishLeap: 1 / 4.6 };
  var CAPS = { birdFlap: 'birdFlap', gullFlap: 'birdFlap', parrotFlap: 'birdFlap', butterflyFlap: 'birdFlap', monkeyScratch: 'critterFlap',
    squirrelTail: 'critterFlap', waddle: 'critterFlap', firefly: 'firefly', starTwinkle: 'starTwinkle', auroraWave: 'auroraDrift', auroraDrift: 'auroraDrift' };
  /* lift: Showtime's light is about a quarter of the day's and twice as blue on a top face, so the cloud
     colours are divided by it (× lift · k² per channel) and the clouds read as sky-world gives them */
  var CLOUD = { cube: 0.5, wrap: 45, fade: 4, bob: 0.12, tick: 1 / 15, steps: 8, lift: [2.4, 2.3, 0.7], AURORA: 26,
    /* north: under the north lands — from the Home view they drift through the gaps between them, the cube clouds
       above Home (the first two start in those gaps, where LOW keeps them); fhigh: high clouds in front of Home,
       under its front rim when the view is zoomed out; the others are the Sky map's */
    bands: { fhigh: { z: [10.3, 12.6], y: [5, 6.4] }, flow: { z: [10.7, 16], y: [-6.6, -3.4] }, north: { z: [-21, -14], y: [-7, -6.45] },
             back: { z: [-34.5, -29.7], y: [-6.5, -3.5] }, high: { z: [-31.5, -29.7], y: [5, 6] } },
    gaps: [-6, 5], order: ['north', 'fhigh', 'north', 'high', 'flow', 'back', 'north', 'fhigh', 'high', 'north', 'flow', 'back', 'fhigh', 'north', 'high', 'flow'] };
  /* the circuit round the whole archipelago (x, z): it hugs each land's outer side, dips into the
     notches between the jungle and the treetop and between the ice and the pier, and passes the
     far front under the Home view */
  var CIRCUIT = [[0, 17.5], [-20, 16.5], [-31.8, 9], [-31.8, -6], [-31.2, -10.8], [-27.2, -12.6], [-26.9, -25.2], [-12.6, -25.6], [-12.2, -31.2], [0, -31.4],
                 [12.2, -31.2], [12.6, -25.4], [29.4, -24.8], [29.7, -12], [36.4, -10.6], [38, -6], [38, 9], [22, 17]];
  /* the pocket behind Home, between it and the north lands: the yard flock swoops low (y 2.4) at each side, in
     the Home view's sky band, and rises (+ hump) over the castle causeway in the middle, 1.5 u clear of it */
  var YARD = { x: -0.4, z: -10.5, rx: 5.2, rz: 1.0, low: 2.4, hump: 2.6, w: 4.6 };
  var BIRD = { g: 0.08, speed: 1.2, flapSec: 2.5 / 1.6, cycle: 4.4, amp: 0.55, glide: 0.12, roost: [0.55, 0.65], span: 0.3,
    flocks: [{ ring: 'yard', y: 0, dir: 1, side: 0, spread: 0.22 }, { ring: 'circuit', y: 3.6, dir: 1, side: 0.8, spread: 0.4 },
             { ring: 'circuit', y: 4.1, dir: -1, side: -0.8, spread: 0.4 }] };
  var BALLOON = { speed: 0.2, bob: 0.22, ys: [5, 6.2, 5.6], v: [0.19, 0.12, 0.15], belt: [0, 4, 0], h: 18,
    cols: [['PX Skylife Rainbow 1', 'PX Skylife Rainbow 2', 'PX Skylife Rainbow 3', 'PX Skylife Rainbow 4', 'PX Skylife Rainbow 5', 'PX Skylife Rainbow 6'],
           ['PX Jungle Flower Pink', 'Cloud White', 'PX Jungle Flower Pink', 'Cloud White', 'PX Jungle Flower Pink', 'Cloud White', 'PX Jungle Flower Pink', 'Cloud White'],
           ['PX Mint', 'PX Lilac', 'PX Mint', 'PX Lilac', 'PX Mint', 'PX Lilac']] };
  var EDIT_KEEP = 4, FADE_SEC = 0.5, ACT_SEC = 0.6, FAR = 45, NEAR = 44;
  /* where each land's creatures live, in island-local u (x, y above the island top, z), checked
     against SLIsles3D.terrain(isle).scenery by the tests: the jungle's rim-tree crowns, the pier's
     lamp posts, the treetop's rope lines and east oak, the castle's meadow edge, the igloo's row */
  var LAND = {
    home: { boat: [8.6, -1, 4.4, 0.6], fishA: 2.05, flies: [[-3.4, 0.95, 4.95], [4.1, 0.95, 4.95]] },
    pier: { wheel: [-2.5, 5.6, -4], posts: [[-6.25, 1.375, 1.25], [-2.25, 1.375, 1.25], [2.25, 1.375, 1.25]], fishA: 2.7 },
    jungle: { trees: [[-4.25, 3, -2.25], [-1.75, 3.5, -4.75], [2.25, 3, -4.75], [-4.25, 2.5, 1.75]], canopy: [-0.5, 4.4, -2], fishA: 1.2, padA: 2.25,
              glow: [[-0.5, 1.7, -2, 1.6], [-6.4, 0.6, 1.6, 1.1], [-4.2, 0.6, -4.9, 1.1]] },
    /* the rope lines run from crown to crown: a squirrel runs the part in the open (f0 … f1) and pops into the leaves at each end */
    treetop: { ropes: [[-4.25, -4.75, -0.75, -4.75, 0.16, 0.66], [2.25, -4.75, 5.25, -3.25, 0.2, 0.8]], ropeY: 2.4, sag: 0.35, owl: [4.75, 2.5, -0.25] },
    castle: { fishA: 2.95, moat: [2.85, 6.65], flies: [[-3.2, 0.95, 3.4], [3.2, 0.95, 3.4]] },
    ice: { homes: [[0.55, 0], [0, 0.2], [-0.7, 0.15]], slide: -0.95, fishA: 1.6, floeA: -0.15, aurora: { y: 0.9, dz: -4.6 } } };
  var FISH_COL = { home: ['PX Skylife Fish Home', 'PX Sunny', null], pier: ['PX Sunny', 'Cloud White', 'PX Pier Stripe Blue'], jungle: ['PX Castle Teal', 'PX Mint', null],
    castle: ['PX Skylife Fish Castle', 'Cloud White', null], ice: ['PX Skylife Fish Ice', 'Cloud White', null] };
  /* model-local colours (D50) */
  var TOKENS = { 'PX Skylife Bird': '#5A6FB8', 'PX Skylife Bird Tip': '#46579E', 'PX Skylife Rainbow 1': '#FF5E5E', 'PX Skylife Rainbow 2': '#FF9F43',
    'PX Skylife Rainbow 3': '#FFD23F', 'PX Skylife Rainbow 4': '#4CD964', 'PX Skylife Rainbow 5': '#3FA9F5', 'PX Skylife Rainbow 6': '#9B7BFF',
    'PX Skylife Hull': '#E8455E', 'PX Skylife Hull Light': '#FF5D73', 'PX Skylife Deck': '#E8B07A', 'PX Skylife Mast': '#F5E6C8', 'PX Skylife Flag': '#FF4D6D',
    'PX Skylife Fish Home': '#FF7B54', 'PX Skylife Fish Castle': '#9FB8E6', 'PX Skylife Fish Ice': '#DFE8F7', 'PX Skylife Wing Pink': '#FF6FB5',
    'PX Skylife Firefly': '#F4FF9A', 'PX Skylife Star': '#FFF6D8' };
  /* a critter pivot → [axis 0 x | 1 y | 2 z, pose slot a0 | a1 | a2, sign] */
  var PIVOT = { wingL: [2, 0, 1], wingR: [2, 0, -1], armL: [2, 0, 1], armR: [2, 0, -1], legL: [0, 0, 1], legR: [0, 0, 1], tail: [0, 1, 1], head: [1, 2, 1] };

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path, optional) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (!m) { if (optional) return null; throw new Error('SLSkyLife3D: ' + name + ' is not loaded'); }
    return (sibs[name] = m);
  }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function grid() { return sibling('SLGrid3D', './grid3d.js'); }
  function bakes() { return sibling('SLIsles3D', './isles3d.js'); }
  function vox() { return sibling('SLVox', './vox.js'); }
  function tokens() { var L = look(); if (!L.resolve('PX Skylife Bird')) L.addTokens('skylife', TOKENS); return L; }
  /* a model builder's grid (the model-local tokens are registered first, so a pure build resolves them) */
  function voxGrid(g) { tokens(); return vox().grid({ grid: g }); }

  /* ================================================================
     PURE HELPERS (Node-testable)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function smooth(a, b, x) { return ease((x - a) / (b - a)); }
  function hash(a, b, s) {
    var h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B) ^ Math.imul((s | 0) + 1, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function wrapA(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function mixA(a, b, f) { return a + wrapA(b - a) * f; }
  function tierOf(t) { var u = typeof t === 'string' ? t.toUpperCase() : ''; return TIER_I[u] != null ? u : null; }
  function scaled(n, s, keep) { if (!(s > 0) || s >= 1) return n; var m = Math.floor(n * s + 1e-9); return keep && n > 0 ? Math.max(1, m) : m; }

  /* counts(tier, {lifeScale, particleScale}, budget?) → every number drawn: the world's clouds,
     balloons, birds and star cubes, and per island its creatures and sparks */
  function counts(tier, q, b) {
    tier = tierOf(tier) || 'MID'; q = q || {};
    var B = {}, k, ti = TIER_I[tier], ls = q.lifeScale, ps = q.particleScale;
    for (k in BUDGET[tier]) B[k] = b && typeof b[k] === 'number' ? b[k] : BUDGET[tier][k];
    var out = { tier: tier, clouds: scaled(B.clouds, ls, true), balloons: scaled(B.balloons, ls, true), birds: scaled(B.skyBirds, ls), stars: scaled(B.starCubes, ps),
      critters: 0, budget: B.critters, isles: {} };
    ISLES.forEach(function (isle) {
      var A = AMBIENT[isle], c = {};
      Object.keys(A).forEach(function (kind) {
        var n = typeof A[kind] === 'string' ? B[A[kind]] : A[kind][ti];
        c[kind] = KEEP[kind] ? n : scaled(n, SPARKS[kind] ? ps : ls);
        if (CRITTERS.indexOf(kind) >= 0) out.critters += c[kind];
      });
      out.isles[isle] = c;
    });
    return out;
  }
  /* the flocks a number of birds fly in: 3–5 each (fewer only after the ladder) */
  function flockSizes(n) { var f = Math.max(1, Math.ceil(n / 4)), out = []; for (var i = 0; i < f && n > 0; i++) out.push(Math.ceil((n - out.reduce(function (a, b) { return a + b; }, 0)) / (f - i))); return n > 0 ? out : []; }

  /* pixel.js cloudObj: three tiers of cubes [i, j, k] (half widths w, depth d), deterministic */
  function cloudCubes(seed, w, d) {
    var out = [];
    for (var j = 0; j <= 2; j++) {
      var rx = w * (1 - j * 0.3), rz = d * (1 - j * 0.32), ox = (hash(seed, j, 1) - 0.5) * j, oz = (hash(seed, j, 2) - 0.5) * j;
      for (var i = -w - 1; i <= w + 1; i++) for (var k = -d - 1; k <= d + 1; k++) {
        var e = Math.pow((i - ox) / rx, 2) + Math.pow((k - oz) / rz, 2);
        if (e <= 1 + (hash(seed * 31 + j, i * 17 + k, 3) - 0.5) * 0.35) out.push([i, j, k]);
      }
    }
    return out;
  }
  /* the axis box [x0, x1] × [y0, y1] × [z0, z1] lies outside every cloud-exclusion zone */
  var ZONES = null;
  function zones() { return ZONES || (ZONES = bakes().cloudExclusion()); }
  function clearBox(x0, x1, y0, y1, z0, z1) {
    var Z = zones();
    for (var q = 0; q < Z.length; q++) {
      var zn = Z[q];
      if (zn.kind === 'isle') { if (x1 >= zn.x0 && x0 <= zn.x1 && z1 >= zn.z0 && z0 <= zn.z1 && y1 >= zn.y0 && y0 <= zn.y1) return false; continue; }
      var bb = zn.bb || (zn.bb = [0, 1, 2].map(function (i) { return [Math.min(zn.a[i], zn.b[i]) - zn.r - 0.1, Math.max(zn.a[i], zn.b[i]) + zn.r + 0.1]; }));
      if (x1 < bb[0][0] || x0 > bb[0][1] || y1 < bb[1][0] || y0 > bb[1][1] || z1 < bb[2][0] || z0 > bb[2][1]) continue;
      for (var t = 0; t <= 1.0001; t += 0.02) {
        var px = zn.a[0] + (zn.b[0] - zn.a[0]) * t, py = zn.a[1] + (zn.b[1] - zn.a[1]) * t, pz = zn.a[2] + (zn.b[2] - zn.a[2]) * t;
        var dx = Math.max(0, x0 - px, px - x1), dy = Math.max(0, y0 - py, py - y1), dz = Math.max(0, z0 - pz, pz - z1);
        if (dx * dx + dy * dy + dz * dz <= zn.r * zn.r + 0.05) return false;
      }
    }
    return true;
  }
  /* n cloud lanes: band (CLOUD.order), the cubes, a lane (y, z) whose whole x sweep with the cloud's
     extent and bob is clear, its start x, speed and bob phase. A band with no clear lane drops it. */
  function cloudLanes(n, tier) {
    var out = [], seen = {}, per = {}, c;
    for (c = 0; c < n; c++) per[CLOUD.order[c % 16]] = (per[CLOUD.order[c % 16]] || 0) + 1;
    for (c = 0; c < n; c++) {
      var band = CLOUD.order[c % 16], B = CLOUD.bands[band], idx = seen[band] = (seen[band] || 0) + 1;
      var w = tier === 'LOW' ? 3 + (c % 2) : 3 + (c % 3), cubes = cloudCubes(c * 7 + 3, w, 2), ei = 0, ej = 0, ek = 0, lane = null;
      cubes.forEach(function (q) { ei = Math.max(ei, Math.abs(q[0])); ej = Math.max(ej, q[1]); ek = Math.max(ek, Math.abs(q[2])); });
      var hz = (ek + 0.5) * CLOUD.cube, top = (ej + 0.5) * CLOUD.cube, bot = 0.5 * CLOUD.cube;
      for (var tr = 0; tr < 48 && !lane; tr++) {
        var y = B.y[0] + (B.y[1] - B.y[0]) * hash(c, tr, 5), z = B.z[0] + (B.z[1] - B.z[0]) * hash(c, tr, 6);
        if (clearBox(-1e4, 1e4, y - bot - CLOUD.bob - 0.05, y + top + CLOUD.bob + 0.05, z - hz - 0.05, z + hz + 0.05)) lane = { y: y, z: z };
      }
      if (!lane) continue;
      out.push({ band: band, y: lane.y, z: lane.z, w: w, cubes: cubes, hx: (ei + 0.5) * CLOUD.cube,
        x0: band === 'north' && idx <= 2 ? CLOUD.gaps[idx - 1] : -CLOUD.wrap + 2 * CLOUD.wrap * (idx - 0.5 + (hash(c, 9, 7) - 0.5) * 0.6) / per[band],
        v: 0.12 + 0.13 * hash(c, 3, 8), ph: TAU * hash(c, 4, 9) });
    }
    return out;
  }
  function wrapX(x) { var W = CLOUD.wrap; x = (x + W) % (2 * W); if (x < 0) x += 2 * W; return x - W; }
  /* a cloud's centre at time t → out {x, y, z, e (its scale: 0 at the wrap)} */
  function cloudAt(l, t, out) {
    out.x = wrapX(l.x0 + l.v * t); out.y = l.y + CLOUD.bob * Math.sin(TAU * RATES.cloudBob * t + l.ph); out.z = l.z;
    out.e = clamp01((CLOUD.wrap - Math.abs(out.x)) / CLOUD.fade);
    return out;
  }

  /* a closed Catmull-Rom loop through pts [[x, z]…], sampled every ≤ step u: {x, z, s, n, len} */
  function cr(a, b, c, d, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3); }
  function loopPath(pts, step) {
    var n = pts.length, X = [], Z = [];
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (var q = 0; q < m; q++) { X.push(cr(p0[0], p1[0], p2[0], p3[0], q / m)); Z.push(cr(p0[1], p1[1], p2[1], p3[1], q / m)); }
    }
    var N = X.length, S = new Float64Array(N + 1);
    for (var k = 1; k <= N; k++) S[k] = S[k - 1] + Math.hypot(X[k % N] - X[k - 1], Z[k % N] - Z[k - 1]);
    return { x: new Float64Array(X), z: new Float64Array(Z), s: S, n: N, len: S[N] };
  }
  /* the point at arc length s (any sign: it wraps) → out {x, z, tx, tz, i (the sample before it)} */
  function pathAt(P, s, out) {
    s %= P.len; if (s < 0) s += P.len;
    var lo = 0, hi = P.n;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (P.s[mid] <= s) lo = mid; else hi = mid; }
    var b = (lo + 1) % P.n, seg = P.s[lo + 1] - P.s[lo] || 1, f = (s - P.s[lo]) / seg, dx = P.x[b] - P.x[lo], dz = P.z[b] - P.z[lo], l = Math.hypot(dx, dz) || 1;
    out.x = P.x[lo] + dx * f; out.z = P.z[lo] + dz * f; out.tx = dx / l; out.tz = dz / l; out.i = lo;
    return out;
  }
  var CIRC = null;
  function circuit() { return CIRC || (CIRC = loopPath(CIRCUIT, 0.5)); }
  /* per sample of the circuit: 1 when a box of half width m from y0 to y1 there is clear */
  function circuitClear(y0, y1, m) {
    var P = circuit(), ok = new Uint8Array(P.n);
    for (var i = 0; i < P.n; i++) ok[i] = clearBox(P.x[i] - m, P.x[i] + m, y0, y1, P.z[i] - m, P.z[i] + m) ? 1 : 0;
    return ok;
  }
  /* the yard ring (an ellipse behind Home) at angle a → out {x, z, tx, tz}; its clearance per 2° */
  function yardAt(a, out) {
    out.x = YARD.x + YARD.rx * Math.cos(a); out.z = YARD.z + YARD.rz * Math.sin(a);
    var u = (out.x - YARD.x) / YARD.w, b = u * u < 1 ? (1 - u * u) * (1 - u * u) : 0;
    out.y = YARD.low + YARD.hump * b;
    var tx = -YARD.rx * Math.sin(a), tz = YARD.rz * Math.cos(a), l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l;
    return out;
  }
  /* (y0, y1: the flock's reach below / above the ring's own height there) */
  function yardClear(y0, y1, m) {
    var ok = new Uint8Array(180), p = {};
    for (var i = 0; i < 180; i++) { yardAt(i * TAU / 180, p); ok[i] = clearBox(p.x - m, p.x + m, p.y - y0, p.y + y1, p.z - m, p.z + m) ? 1 : 0; }
    return ok;
  }
  /* a point on a slab island's water ring: along angle a from its centre, od u out from the coast */
  function waterSpot(isle, a, od) {
    var S = bakes(), slab = isle === 'home' ? S.homeSlab('') : S.skySlab(isle), F = grid().V3.frame(isle);
    if (!slab) return null;
    var dx = Math.cos(a), dz = Math.sin(a);
    for (var r = 0; r < 26; r += 0.05) {
      var x = F.cx + dx * r, z = F.cz + dz * r;
      if (slab.od(x, z) >= od) return slab.inside(x, z) ? { x: x, y: F.seaY, z: z, tx: -dz, tz: dx } : null;
    }
    return null;
  }

  /* ================================================================
     MODELS (pure VoxModels; critters come from SL3D.vox.makeCritter)
     ================================================================ */
  function birdVoxels() {
    var g = voxGrid(BIRD.g);
    g.box(0, 0, 0, 0, -2, 1, 'b').set(0, 0, 2, 'b').set(0, 1, 1, 'b').set(0, 0, 3, 'y').box(-1, 1, 0, 0, -3, -3, 'd').set(0, 0, -3, 'b');
    g.group('wingL', function () { g.box(1, 2, 0, 0, -1, 0, 'b').box(3, 3, 0, 0, -1, 0, 'd').set(1, 0, 1, 'b'); });
    g.group('wingR', function () { g.box(-2, -1, 0, 0, -1, 0, 'b').box(-3, -3, 0, 0, -1, 0, 'd').set(-1, 0, 1, 'b'); });
    g.pivot('wingL', [0.5, 0, -0.5]).pivot('wingR', [-0.5, 0, -0.5]);
    return g.model({ id: 'skylife:bird', palette: { b: 'PX Skylife Bird', d: 'PX Skylife Bird Tip', y: 'PX Sunny' }, ground: false, cull: [] });
  }
  /* pixel.js balloonObj: a lathed envelope of segment colours (a belt row on the striped one), a
     basket with a rim, four ropes and the burner (a warm glow block) */
  function balloonVoxels(n) {
    var g = voxGrid(BALLOON.v[n]), cols = BALLOON.cols[n], belt = BALLOON.belt[n], pal = { Y: 'PX Sunny', w: 'PX Waffle', r: 'PX Jungle Bark Light', p: 'PX Jungle Bark',
      f: { token: 'PX Jungle Flower Orange', mode: 'glow' } };
    cols.forEach(function (t, i) { pal[String(i)] = t; });
    [1.0, 1.7, 2.4, 3.0, 3.45, 3.75, 3.9, 3.9, 3.7, 3.3, 2.65, 1.7].forEach(function (r, m) {
      for (var i = -4; i <= 4; i++) for (var k = -4; k <= 4; k++) {
        if (Math.hypot(i, k) > r) continue;
        var seg = Math.floor(((Math.atan2(k, i) + Math.PI) / TAU) * cols.length + 0.5) % cols.length;
        g.set(i, 6 + m, k, belt && m === belt ? 'Y' : String(seg));
      }
    });
    g.box(-1, 1, 0, 1, -1, 1, function (i, j, k) { return j === 1 && (Math.abs(i) === 1 || Math.abs(k) === 1) ? 'r' : 'w'; });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.box(c[0], c[0], 2, 5, c[1], c[1], 'p'); });
    g.box(-1, 1, 5, 5, -1, 1, 'f');
    return g.model({ id: 'skylife:balloon' + n, palette: pal, ground: false, cull: [] });
  }
  /* pixel.js's rainbow-sail boat (it faces +z; the hull keel at y 0) */
  function boatVoxels() {
    var g = voxGrid(0.125);
    function hw(k) { return k >= 7 ? 0 : k === 6 ? 1 : k >= 4 ? 2 : k <= -7 ? 2 : 3; }
    for (var k = -7; k <= 7; k++) {
      var w = hw(k);
      g.box(-Math.max(0, w - 1), Math.max(0, w - 1), 0, 0, k, k, 'h').box(-w, w, 1, 1, k, k, 'l');
      g.box(-w, w, 2, 2, k, k, function (i) { return Math.abs(i) === w || Math.abs(k) === 7 ? 'W' : 'd'; });
      if (w > 0) g.set(-w, 3, k, 'W').set(w, 3, k, 'W');
    }
    g.box(-2, 2, 3, 3, -7, -7, 'W').box(0, 0, 3, 15, 0, 0, 'm');
    for (var j = 4; j <= 14; j++) { var len = Math.floor((14 - j) * 0.55) + 1; for (var q = 1; q <= len; q++) g.set(0, j, q, String(Math.floor((j - 4) / 2) % 6)); }
    g.set(0, 16, -1, 'f').set(0, 15, -1, 'f').set(0, 16, -2, 'f');
    var pal = { h: 'PX Skylife Hull', l: 'PX Skylife Hull Light', d: 'PX Skylife Deck', W: 'Cloud White', m: 'PX Skylife Mast', f: 'PX Skylife Flag' };
    for (var c = 0; c < 6; c++) pal[String(c)] = 'PX Skylife Rainbow ' + (c + 1);
    return g.model({ id: 'skylife:boat', palette: pal, ground: false, cull: ['-y'] });
  }
  /* pixel.js's 2-deep bitmap fish (it faces +x), in each land's colours (the pier's has stripes) */
  function fishVoxels(isle) {
    var c = FISH_COL[isle] || FISH_COL.home, g = voxGrid(0.1);
    var rows = ['....###...', '#..#####..', '##.####wk#', '#########.', '##.#bbbb#.', '#..#####..', '....###...'].map(function (r) {
      return c[2] ? r.split('').map(function (ch, i) { return ch === '#' && (i === 4 || i === 6) ? 's' : ch; }).join('') : r;
    });
    g.bitmap(rows, null, { axis: 'z', depth: 2, at: [-5, -3, -1] });
    return g.model({ id: 'skylife:fish:' + isle, palette: { '#': c[0], b: c[1], s: c[2] || c[0], w: 'Cloud White', k: 'PX Ink Eye' }, ground: false, cull: [] });
  }
  function butterflyVoxels(n) {
    var g = voxGrid(0.045);
    g.box(0, 0, 0, 0, -2, 1, 'k');
    g.group('wingL', function () { g.box(1, 3, 0, 0, -2, 1, 'w').set(2, 0, 0, 'd'); });
    g.group('wingR', function () { g.box(-3, -1, 0, 0, -2, 1, 'w').set(-2, 0, 0, 'd'); });
    g.pivot('wingL', [0.5, 0, -0.5]).pivot('wingR', [-0.5, 0, -0.5]);
    return g.model({ id: 'skylife:butterfly' + n, palette: { k: 'PX Ink Eye', w: n % 2 ? 'PX Sunny' : 'PX Skylife Wing Pink', d: 'Cloud White' }, ground: false, cull: [] });
  }
  function padVoxels() {
    var g = voxGrid(0.0625);
    for (var i = -4; i <= 4; i++) for (var k = -4; k <= 4; k++) {
      var d = Math.hypot(i, k);
      if (d <= 4.2 && !(i >= 1 && Math.abs(k) <= i / 3)) g.set(i, 0, k, d > 3.2 ? 'e' : 'l');
    }
    g.set(-2, 1, -2, 'p').set(-2, 2, -2, 'y');
    return g.model({ id: 'skylife:pad', palette: { l: 'PX Leaf', e: 'PX Leaf 2', p: 'PX Candy Pink', y: 'PX Sunny' }, ground: false, cull: ['-y'] });
  }
  function floeVoxels() {
    var g = voxGrid(0.125);
    g.box(-2, 2, 0, 0, -1, 1, 'i').box(-2, 1, 1, 1, -1, 1, 's').box(2, 2, 1, 1, -1, 0, 's').clear(-2, 1, 1).clear(2, 0, -1);
    return g.model({ id: 'skylife:floe', palette: { i: 'PX Ice', s: 'PX Ice Snow' }, ground: false, cull: ['-y'] });
  }
  /* a model's pivot origins in item u */
  function pivotsOf(m) {
    var g = typeof m.grid === 'number' ? [m.grid, m.grid, m.grid] : m.grid, o = m.origin || [0.5, 0, 0.5], out = {};
    Object.keys(m.pivots || {}).forEach(function (n) { var a = m.pivots[n].at; out[n] = [(a[0] + 0.5 - o[0]) * g[0], (a[1] + 0.5 - o[1]) * g[1], (a[2] + 0.5 - o[2]) * g[2]]; });
    return out;
  }

  /* ================================================================
     POSES — pure functions of the clock: P {x, y, z, yaw, pitch, roll, s, a0, a1, a2}
     ================================================================ */
  function setP(P, x, y, z, yaw, pitch, roll, a0, a1, a2) { P.x = x; P.y = y; P.z = z; P.yaw = yaw; P.pitch = pitch; P.roll = roll; P.s = 1; P.a0 = a0; P.a1 = a1; P.a2 = a2; return P; }
  /* flapping: 2.5 cycles at hz (it ends level), then a glide; one cycle every `cycle` s */
  function flapAt(t, hz, sec, cycle, glide, amp, on) { var u = ((t % cycle) + cycle) % cycle; return on && u < sec ? glide + amp * Math.sin(TAU * hz * u) : glide; }
  var _q = { x: 0, z: 0, tx: 0, tz: 1, i: 0 }, _q2 = { x: 0, z: 0, tx: 0, tz: 1, i: 0 };
  /* the rest pose: perched, sitting, floating, standing by the igloo */
  function restPose(a, P) {
    var p = a.at;
    switch (a.kind) {
      case 'gull': return setP(P, a.post[0], a.post[1], a.post[2], 0, 0, 0, 0, 0, 0);
      case 'parrot': return setP(P, a.perch[0], a.perch[1], a.perch[2], 0.2 * a.side, 0, 0, 0, 0, 0);
      case 'monkey': return setP(P, a.from[0], a.from[1], a.from[2], 0, 0, 0, 0, 0, 0);
      case 'squirrel': ropeAt(a, (a.rope.f0 + a.rope.f1) / 2, P); P.yaw = 0; P.pitch = -0.35; return P;
      case 'duck': case 'raft': case 'floePenguin': return setP(P, p[0], p[1] + (a.kind === 'floePenguin' ? 0.25 : 0), p[2], a.yaw0, 0, 0, 0, 0, 0);
      default: return setP(P, p[0], p[1], p[2], a.yaw0 || 0, 0, 0, 0, 0, 0);
    }
  }
  /* a squirrel's spot on its rope at fraction f (feet on the rope voxel's top face, as isles3d's rope) */
  function ropeAt(a, f, P) {
    var R = a.rope, j = Math.round((-R.sag * 4 * f * (1 - f)) / 0.125);
    return setP(P, R.ax + (R.bx - R.ax) * f, R.y + (j + 1) * 0.125, R.az + (R.bz - R.az) * f, 0, 0, 0, 0, 0, 0);
  }
  function livePose(a, t, P) {
    var u, f, p = a.at;
    switch (a.kind) {
      case 'balloon': {
        pathAt(circuit(), a.s0 + BALLOON.speed * t, _q);
        setP(P, _q.x, a.y + BALLOON.bob * Math.sin(TAU * RATES.balloonBob * t + a.ph), _q.z, 0.5 * Math.sin(TAU * RATES.balloonTurn * t + a.ph), 0, 0, 0, 0, 0);
        P.ok = a.ok[_q.i]; return P;
      }
      case 'bird': {
        var F = a.flock, s = F.s0 + F.dir * (BIRD.speed * t - a.back);
        if (F.ring === 'yard') { var ai = s / ((YARD.rx + YARD.rz) / 2); yardAt(ai, _q); _q.i = ((Math.round(ai * 180 / TAU) % 180) + 180) % 180; }
        else pathAt(circuit(), s, _q);
        var tx = _q.tx * F.dir, tz = _q.tz * F.dir, side = F.side + a.side, yard = F.ring === 'yard';
        setP(P, _q.x - tz * side, (yard ? _q.y : F.y) + a.dy + (yard ? 0.2 : 0.35) * Math.sin(TAU * 0.04 * t + F.ph), _q.z + tx * side, Math.atan2(tx, tz), 0, 0,
          flapAt(t + a.ph, RATES.birdFlap, BIRD.flapSec, BIRD.cycle, BIRD.glide, BIRD.amp, !a.low), 0, 0);
        P.ok = a.ok[_q.i]; return P;
      }
      case 'gull': {                      /* a slow horizontal circle over the Big Wheel: glide 3 s, flap 1.6 s */
        var th = a.ph * TAU + 0.34 * t, W = a.wheel;
        return setP(P, W[0] + 2.9 * Math.cos(th), W[1] + 0.2 * Math.sin(TAU * 0.1 * t + a.ph * 5), W[2] + 1.7 * Math.sin(th),
          Math.atan2(-2.9 * Math.sin(th), 1.7 * Math.cos(th)), 0, -0.22, flapAt(t + a.ph * 4, RATES.gullFlap, BIRD.flapSec, 4.6, 1.62, 0.45, true), 0, 0);
      }
      case 'parrot': {                    /* loops round the treehouse canopy, then glides to a rim tree and perches */
        var per = 22, LOOP = 10.2, GL = 1.6, PER = 8.6;          /* the loop is three whole wingbeat cycles: it ends gliding */
        u = ((t + a.ph * per) % per + per) % per;
        if (u < LOOP) return parrotLoop(a, t, P, u);
        if (u >= LOOP + GL && u < LOOP + GL + PER) { restPose(a, P); P.yaw = perchYaw(a, t); return P; }
        /* the glides: wings fold on landing and open on take-off, the heading turns in and out of the loop's */
        var out = u < LOOP + GL, f2 = out ? (u - LOOP) / GL : (u - LOOP - GL - PER) / GL, A = parrotLoop(a, out ? t - (u - LOOP) : t - u + per, _P2, 0);
        f = ease(f2);
        var fx = out ? A.x : a.perch[0], fy = out ? A.y : a.perch[1], fz = out ? A.z : a.perch[2], ex = out ? a.perch[0] : A.x, ey = out ? a.perch[1] : A.y, ez = out ? a.perch[2] : A.z;
        var hd = Math.atan2(ex - fx, ez - fz), y0 = out ? A.yaw : perchYaw(a, t - (u - LOOP - GL - PER)), y1 = out ? perchYaw(a, t - u + LOOP + GL) : A.yaw;
        return setP(P, fx + (ex - fx) * f, fy + (ey - fy) * f + 0.45 * Math.sin(Math.PI * f), fz + (ez - fz) * f,
          f2 < 0.25 ? mixA(y0, hd, ease(f2 / 0.25)) : f2 > 0.75 ? mixA(hd, y1, ease((f2 - 0.75) / 0.25)) : hd, 0,
          A.roll * (out ? 1 - smooth(0, 0.3, f2) : smooth(0.7, 1, f2)), 1.62 * (out ? 1 - smooth(0.7, 1, f2) : smooth(0, 0.3, f2)), 0, 0);
      }
      case 'toucan': case 'owl': {        /* perched: the toucan looks round every 5 s, the owl ruffles every 4 s */
        if (a.kind === 'toucan') {
          var n5 = Math.floor((t + a.ph * 5) / 5), w5 = (t + a.ph * 5) - n5 * 5, y0 = (hash(n5 - 1, 7, 13) - 0.5) * 1.1, y1 = (hash(n5, 7, 13) - 0.5) * 1.1;
          return setP(P, p[0], p[1], p[2], y0 + (y1 - y0) * ease(w5 / 0.4), 0, 0, 0, 0, 0);
        }
        u = ((t + a.ph * 4) % 4 + 4) % 4;
        return setP(P, p[0], p[1] + (u < 0.5 ? 0.02 * Math.sin(Math.PI * u / 0.5) : 0), p[2], 0, 0, 0, u < 0.5 ? 0.6 * Math.sin(Math.PI * u / 0.5) : 0, 0, 0);
      }
      case 'monkey': {                    /* sits, scratches, and every ~15 s swings to the other tree */
        var half = a.per, SW = 1.6;
        u = ((t + a.ph * 2 * half) % (2 * half) + 2 * half) % (2 * half);
        var back = u >= half, v = back ? u - half : u, A2 = back ? a.to : a.from, B2 = back ? a.from : a.to;
        if (v >= half - SW) {
          f = ease((v - half + SW) / SW);
          var w2 = smooth(0, 0.15, f) * (1 - smooth(0.85, 1, f));
          return setP(P, A2[0] + (B2[0] - A2[0]) * f, A2[1] + (B2[1] - A2[1]) * f - 0.9 * Math.sin(Math.PI * f), A2[2] + (B2[2] - A2[2]) * f,
            mixA(0, Math.atan2(B2[0] - A2[0], B2[2] - A2[2]), w2), 0, 0, 2.9 * w2, 0.4 * Math.sin(Math.PI * f), 0);
        }
        var sc = v % 5;
        return setP(P, A2[0], A2[1], A2[2], 0, 0, 0, sc < 1.2 ? 2.5 + 0.25 * Math.sin(TAU * RATES.monkeyScratch * sc) : 0, 0.25 * Math.sin(TAU * 0.25 * t + a.ph), 0);
      }
      case 'frog': {                      /* a little hop on the lily pad every 7 s */
        u = ((t + a.ph * 7) % 7 + 7) % 7;
        f = u < 0.5 ? Math.sin(Math.PI * u / 0.5) : 0;
        return setP(P, p[0], p[1] + 0.16 * f, p[2], a.yaw0, -0.25 * f, 0, -0.9 * f, 0, 0);
      }
      case 'squirrel': {                  /* runs along the rope at 1.5 u/s, sits up half way and at each end */
        var R2 = a.rope, run = R2.len * (R2.f1 - R2.f0) / 2 / 1.5, seq = 2 * run + 1.5 + 2.5, per2 = 2 * seq;
        u = ((t + a.ph * per2) % per2 + per2) % per2;
        var dir = u < seq ? 1 : -1, w = u < seq ? u : u - seq, e2 = 2 * run + 1.5, fr, sit;
        fr = w < run ? 0.5 * w / run : w < run + 1.5 ? 0.5 : w < e2 ? 0.5 + 0.5 * (w - run - 1.5) / run : 1;
        sit = w < run || (w >= run + 1.5 && w < e2) ? 0 : w < e2 ? smooth(run, run + 0.2, w) * (1 - smooth(run + 1.3, run + 1.5, w)) : smooth(e2, e2 + 0.2, w) * (1 - smooth(seq - 0.8, seq - 0.6, w));
        ropeAt(a, R2.f0 + (R2.f1 - R2.f0) * (dir > 0 ? fr : 1 - fr), P);
        P.yaw = Math.atan2((R2.bx - R2.ax) * dir, (R2.bz - R2.az) * dir) + Math.PI * smooth(seq - 0.6, seq, w);      /* it turns round before running back */
        P.pitch = -0.4 * sit; P.a1 = 0.15 + sit * 0.3 * Math.sin(TAU * RATES.squirrelTail * t); P.a2 = sit * 0.4 * Math.sin(TAU * 0.2 * t);
        return P;
      }
      case 'duck': {                      /* slow loops on the moat, bobbing */
        var r = 0.15 / 0.3, th2 = a.ph * TAU + r * t, cx = Math.cos(th2), sx = Math.sin(th2), dx = -0.32 * sx, dn = 0.18 * cx;
        return setP(P, p[0] + a.tx * 0.32 * cx - a.tz * 0.18 * sx, p[1] + 0.025 * Math.sin(TAU * RATES.duckBob * t + a.ph * 6), p[2] + a.tz * 0.32 * cx + a.tx * 0.18 * sx,
          Math.atan2(a.tx * dx - a.tz * dn, a.tz * dx + a.tx * dn), 0, 0.04 * Math.sin(TAU * RATES.duckBob * t), 0, 0, 0);
      }
      case 'raft': case 'floePenguin': {  /* the floe drifts a slow loop; its penguin rides it */
        var th3 = a.ph * TAU + 0.18 * t;
        setP(P, p[0] + a.tx * 0.45 * Math.cos(th3) - a.tz * 0.2 * Math.sin(th3), p[1] + 0.03 * Math.sin(TAU * RATES.floeBob * t), p[2] + a.tz * 0.45 * Math.cos(th3) + a.tx * 0.2 * Math.sin(th3),
          a.yaw0 + 0.3 * Math.sin(0.09 * t), 0, 0.03 * Math.sin(TAU * RATES.floeBob * t + 1), 0, 0, 0);
        if (a.kind === 'floePenguin') { P.y += 0.25; P.roll += 0.08 * Math.sin(TAU * 0.5 * t); P.a0 = 0.3 + 0.1 * Math.sin(TAU * 0.5 * t); }
        return P;
      }
      case 'penguin': return penguinPose(a, t, P);
      case 'butterfly': {
        var ab = 0.55 * t + a.ph * TAU;
        return setP(P, p[0] + 0.7 * Math.cos(ab), p[1] + 0.15 * Math.sin(TAU * 0.27 * t + a.ph * 3), p[2] + 0.5 * Math.sin(ab), Math.atan2(-0.7 * Math.sin(ab), 0.5 * Math.cos(ab)), 0, 0,
          0.2 + 0.9 * Math.abs(Math.sin(Math.PI * RATES.butterflyFlap * t + a.ph)), 0, 0);
      }
      case 'fish': {                      /* one leap of 1.3 s every 4.6 s; out of sight between */
        u = ((t + 0.5 + a.ph * 4.6) % 4.6 + 4.6) % 4.6;
        if (u > 1.3) { setP(P, p[0], p[1], p[2], 0, 0, 0, 0, 0, 0); P.s = 0; return P; }
        f = u / 1.3;
        return setP(P, a.sx + (a.ex - a.sx) * f, p[1] - 0.1 + 1.05 * Math.sin(Math.PI * f), a.sz + (a.ez - a.sz) * f, Math.atan2(-a.tz, a.tx), 0,
          Math.atan2(1.05 * Math.PI * Math.cos(Math.PI * f), 1.2) * 0.85, 0, 0, 0);
      }
      case 'boat': return setP(P, p[0], p[1] + 0.06 * Math.sin(TAU * RATES.boatBob * t), p[2], a.yaw0, 0.04 * Math.sin(TAU * 0.14 * t + 1), 0.06 * Math.sin(TAU * RATES.boatRoll * t), 0, 0, 0);
      default: return restPose(a, P);
    }
  }
  var _P2 = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, s: 1, a0: 0, a1: 0, a2: 0 };
  function parrotLoop(a, t, P, uf) {
    var c = a.canopy, th = a.ph * TAU + 0.33 * t * a.dir;
    return setP(P, c[0] + 3.1 * Math.cos(th), c[1] + 0.3 * Math.sin(TAU * 0.06 * t + a.ph * 4), c[2] + 3.1 * Math.sin(th), Math.atan2(-Math.sin(th) * a.dir, Math.cos(th) * a.dir), 0,
      -0.18 * a.dir, flapAt(uf, RATES.parrotFlap, BIRD.flapSec, 3.4, 1.62, 0.45, true), 0, 0);
  }
  function perchYaw(a, t) { return 0.2 * a.side + 0.35 * Math.sin(TAU * 0.07 * t); }
  /* the igloo's penguins on its entrance row (kept free of objects): little waddling loops (1 s
     steps); the smallest stands, and every 25 s flops on its belly, slides along the row, gets up,
     turns and waddles back */
  function penguinPose(a, t, P) {
    var h = a.at, u, f, D = a.slide, H = Math.PI / 2 * (D < 0 ? -1 : 1);
    if (a.slider) {
      u = ((t + a.ph * 25) % 25 + 25) % 25;
      if (u >= 4.8) return setP(P, h[0], h[1], h[2], 0, 0, 0, 0.3, 0, 0);
      var dx = u < 0.3 ? 0 : u < 1.8 ? D * ease((u - 0.3) / 1.5) : u < 2.2 ? D : D * (1 - (u - 2.2) / 2.6);
      var lie = u < 0.3 ? ease(u / 0.3) : u < 1.8 ? 1 : u < 2.2 ? 1 - ease((u - 1.8) / 0.4) : 0, walk = u >= 2.2;
      var yaw = u < 0.3 ? H * ease(u / 0.3) : u < 1.8 ? H : u < 2.2 ? H - 2 * H * ease((u - 1.8) / 0.4) : u < 4.4 ? -H : -H * (1 - ease((u - 4.4) / 0.4));
      return setP(P, h[0] + dx, h[1] + 0.05 * lie, h[2], yaw, 1.35 * lie, walk ? 0.14 * Math.sin(TAU * RATES.waddle * u) * (1 - smooth(4.4, 4.8, u)) : 0, walk ? 0.3 : 0.3 + 0.6 * lie, 0, 0);
    }
    u = ((t + a.ph * 8) % 8 + 8) % 8;
    var th0 = a.ph * TAU, tan0 = Math.atan2(-Math.sin(th0), Math.cos(th0));
    if (u >= 5) { f = u < 5.4 ? 1 - ease((u - 5) / 0.4) : u > 7.6 ? ease((u - 7.6) / 0.4) : 0; return setP(P, h[0] + 0.16 * Math.cos(th0), h[1], h[2] + 0.16 * Math.sin(th0), mixA(0, tan0, f), 0, 0, 0.25, 0, 0); }
    var th = th0 + TAU * u / 5;
    return setP(P, h[0] + 0.16 * Math.cos(th), h[1], h[2] + 0.16 * Math.sin(th), Math.atan2(-Math.sin(th), Math.cos(th)), 0, 0.14 * Math.sin(TAU * RATES.waddle * u),
      0.25 + 0.12 * Math.sin(TAU * RATES.waddle * u), 0, 0);
  }

  /* ================================================================
     create(K, SL3D, opts)
     ================================================================ */
  function create(K, SL3D, opts) {
    opts = opts || {};
    var V = K && K.vox;
    if (!V || typeof V.instancedCubes !== 'function' || typeof V.geometry !== 'function') throw new Error('SLSkyLife3D.create needs K.vox (SLVoxGL bound to the kit)');
    var T = (SL3D && SL3D.THREE) || K.THREE || opts.THREE, L = tokens(), G = grid();
    var Tier = sibling('SLTier', './tier.js', true), tier = tierOf(opts.tier) || tierOf(K.tier) || 'MID', low = tier === 'LOW';
    var budget = (SL3D && SL3D.budget) || (Tier && Tier.BUDGETS && Tier.BUDGETS[tier]) || BUDGET[tier];
    var q0 = (SL3D && SL3D.quality) || {}, quality = { lifeScale: q0.lifeScale || 1, particleScale: q0.particleScale || 1 };
    var PC = opts.critters || sibling('SLPxCharacters', './px-characters.js', true), warned = {};
    function warn(msg) { if (warned[msg]) return; warned[msg] = 1; if (typeof K.warn === 'function') K.warn('[skylife] ' + msg); }
    var cols = {};
    function rgb(token) {
      if (cols[token]) return cols[token];
      var h = L.resolve(token) || (/^#[0-9a-f]{6}$/i.test(token) ? token : null);
      if (!h) { warn('unknown colour ' + token); h = '#CFC8DC'; }
      var c = new T.Color(h);
      return (cols[token] = [c.r, c.g, c.b]);
    }
    function noPick() {}

    var group = new T.Group();
    group.name = 'skylife';
    var st = { visit: 'home', k: 0, edit: false, reduced: !!opts.reduced, disposed: false, clock: 0, cloudT: 0, cloudAcc: 1, open: { home: 1 }, far: {},
      act: {}, actWas: {}, occ: {}, dirty: true, busy: false, writes: 0 };
    ISLES.forEach(function (i) { st.act[i] = 0; });
    var C0 = counts(tier, quality, budget), frames = {};
    ISLES.forEach(function (i) { frames[i] = G.V3.frame(i); });
    function local(isle, v) { var F = frames[isle]; return [F.cx + v[0], F.cy + v[1], F.cz + v[2]]; }

    /* ---------------- clouds ---------------- */
    var lanes = [], clouds = null, cloudK = -1, _c = { x: 0, y: 0, z: 0, e: 1 };
    function buildClouds() {
      lanes = cloudLanes(C0.clouds, tier);
      var n = lanes.reduce(function (s, l) { return s + l.cubes.length; }, 0);
      if (!clouds) {
        clouds = V.instancedCubes(Math.max(n, 1), { mode: 'soft', size: CLOUD.cube, name: 'skylife:clouds' });       /* the ladder only ever lowers the count */
        clouds.mesh.userData.kind = 'clouds'; clouds.mesh.raycast = noPick; group.add(clouds.mesh);
      }
      clouds.clear();
      lanes.forEach(function (l) { l.idx = new Int32Array(l.cubes.length); for (var q = 0; q < l.cubes.length; q++) l.idx[q] = clouds.alloc(); });
      cloudK = -1; tintClouds(); writeClouds(st.cloudT);
    }
    function mixTok(name, k, out) {
      var lo = k <= 0.5, f = lo ? k * 2 : k * 2 - 1, a = rgb('PX ' + (lo ? 'Day' : 'Sunset') + ' Cloud ' + name), b = rgb('PX ' + (lo ? 'Sunset' : 'Night') + ' Cloud ' + name);
      for (var i = 0; i < 3; i++) out[i] = (a[i] + (b[i] - a[i]) * f) * (1 + CLOUD.lift[i] * k * k);
      return out;
    }
    var _base = [0, 0, 0], _top = [0, 0, 0];
    function tintClouds() {
      var kq = Math.round(st.k * CLOUD.steps) / CLOUD.steps;
      if (kq === cloudK || !clouds) return;
      cloudK = kq; mixTok('Base', kq, _base); mixTok('Top', kq, _top);
      for (var l = 0; l < lanes.length; l++) for (var q = 0; q < lanes[l].cubes.length; q++) clouds.tint(lanes[l].idx[q], lanes[l].cubes[q][1] ? _top : _base);
      clouds.commit();
    }
    function writeClouds(t) {
      for (var l = 0; l < lanes.length; l++) {
        var ln = lanes[l], c = cloudAt(ln, t, _c), h = CLOUD.cube * c.e;
        for (var q = 0; q < ln.cubes.length; q++) { var cb = ln.cubes[q]; clouds.set(ln.idx[q], c.x + cb[0] * h, c.y + cb[1] * h, c.z + cb[2] * h, c.e); }
      }
      clouds.commit();
    }

    /* ---------------- the life mesh: actors, bones, one SkinnedMesh ---------------- */
    var cache = {}, actors = [], skel = null, life = null, E = null, boneDirty = false, IDENT = new T.Matrix4();
    function partsFor(key, make) {
      if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
      var src = null;
      try { src = make(); } catch (e) { warn(key + ': ' + (e && e.message || e)); }
      if (!src) return (cache[key] = null);
      return (cache[key] = { parts: src.geos.map(function (p) { var a = p.geo.attributes; return { pivot: p.pivot || null, P: a.position.array, N: a.normal.array, C: a.color.array, U: a.vuv ? a.vuv.array : null, n: a.position.count }; }),
        pivots: src.pivots });
    }
    function modelParts(key, fn) { return partsFor(key, function () { var m = fn(); return { geos: V.geometry(m, { full: true }), pivots: pivotsOf(m) }; }); }
    function critterParts(kind, o, key) {
      return partsFor(key, function () {
        var cr = SL3D && SL3D.vox && typeof SL3D.vox.makeCritter === 'function' ? SL3D.vox.makeCritter(kind, tier, o) : PC && typeof PC.makeCritter === 'function' ? PC.makeCritter(K, kind, o) : null;
        if (!cr) { warn('no makeCritter (needs W2.6a): ' + kind + ' left out'); return null; }
        var piv = {};
        Object.keys(cr.pivots || {}).forEach(function (n) { piv[n] = cr.pivots[n].origin; });
        return { geos: cr.geometry(), pivots: piv };
      });
    }
    function balloonOk(n) { return circuitClear(BALLOON.ys[n] - BALLOON.bob - 0.05, BALLOON.ys[n] + BALLOON.v[n] * BALLOON.h + BALLOON.bob + 0.05, BALLOON.v[n] * 4 + 0.1); }
    /* the actors for the current counts and unlocked lands */
    function specs() {
      var out = [], n, i, oks = {};
      for (n = 0; n < C0.balloons && n < 3; n++) out.push({ kind: 'balloon', isle: null, key: 'balloon' + n, n: n, y: BALLOON.ys[n], s0: circuit().len * n / Math.max(1, C0.balloons) + 30,
        ph: hash(n, 1, 41) * TAU, ok: balloonOk(n) });
      flockSizes(C0.birds).forEach(function (size, fi) {
        var F = BIRD.flocks[fi % BIRD.flocks.length], m = Math.abs(F.side) + F.spread * Math.ceil((size - 1) / 2) + BIRD.span + 0.1, key = F.ring + F.y + ':' + m;
        var flock = { ring: F.ring, y: F.y, dir: F.dir, side: F.side, ph: hash(fi, 2, 41) * TAU, s0: F.ring === 'yard' ? 1.5 : circuit().len * (0.2 + 0.45 * fi) };
        oks[key] = oks[key] || (F.ring === 'yard' ? yardClear(0.3 + F.spread, 0.3 + F.spread, m) : circuitClear(F.y - 0.45 - F.spread, F.y + 0.45 + F.spread, m));
        for (i = 0; i < size; i++) out.push({ kind: 'bird', isle: null, key: 'bird', flock: flock, ok: oks[key], low: low, back: 0.55 * Math.ceil(i / 2), side: i ? (i % 2 ? 1 : -1) * F.spread * Math.ceil(i / 2) : 0,
          dy: (hash(fi, i, 42) - 0.5) * 0.3, ph: hash(fi, i, 43) * BIRD.cycle });
      });
      Object.keys(st.open).forEach(function (isle) {
        var c = C0.isles[isle], D = LAND[isle], F = frames[isle], sp;
        function add(kind, o, key, extra) { var a = { kind: kind, isle: isle, critter: o, key: key, ph: hash(out.length, ISLES.indexOf(isle), 44) }; for (var k in extra) a[k] = extra[k]; out.push(a); return a; }
        if (isle === 'home') {
          if (c.boat) add('boat', null, 'boat', { at: local('home', [D.boat[0] - F.cx, D.boat[1], D.boat[2] - F.cz]), yaw0: D.boat[3] });
          for (i = 0; i < c.butterfly; i++) add('butterfly', null, 'butterfly' + i, { at: local(isle, D.flies[i % 2]) });
        } else if (isle === 'pier') {
          for (i = 0; i < c.gull; i++) add('gull', {}, 'gull', { wheel: local(isle, D.wheel), post: local(isle, D.posts[i % 3]), ph: i / Math.max(1, c.gull) });
        } else if (isle === 'jungle') {
          var tr = D.trees.map(function (t) { return local(isle, t); }), off = function (p, dx) { return [p[0] + dx, p[1], p[2]]; };
          for (i = 0; i < c.parrot; i++) add('parrot', { variant: i % 2 }, 'parrot' + (i % 2), { canopy: local(isle, D.canopy), perch: off(tr[[0, 2, 1][i % 3]], i === 1 ? -0.28 : 0.28), side: i % 2 ? -1 : 1, dir: i % 2 ? -1 : 1 });
          if (c.toucan) add('toucan', {}, 'toucan', { at: tr[3] });
          for (i = 0; i < c.monkey; i++) add('monkey', {}, 'monkey', { from: i ? tr[0] : tr[1], to: i ? off(tr[3], 0.34) : tr[2], per: 13 + 5 * hash(i, 3, 45) });
          sp = waterSpot('jungle', D.padA, 0.6);
          if (c.frog && sp) { add('pad', null, 'pad', { at: [sp.x, sp.y + 0.005, sp.z] }); add('frog', {}, 'frog', { at: [sp.x, sp.y + 0.07, sp.z], yaw0: 0.4 }); }
        } else if (isle === 'treetop') {
          for (i = 0; i < c.squirrel; i++) {
            var R = D.ropes[i % 2], ax = F.cx + R[0], az = F.cz + R[1], bx = F.cx + R[2], bz = F.cz + R[3];
            add('squirrel', {}, 'squirrel', { rope: { ax: ax, az: az, bx: bx, bz: bz, y: F.cy + D.ropeY, sag: D.sag, len: Math.hypot(bx - ax, bz - az), f0: R[4], f1: R[5] } });
          }
          if (c.owl) add('owl', {}, 'owl', { at: local(isle, D.owl), night: true });
        } else if (isle === 'castle') {
          for (i = 0; i < c.duck; i++) {
            sp = waterSpot('castle', D.moat[0] + (D.moat[1] - D.moat[0]) * (i + 0.5) / c.duck, 0.85);
            if (sp) add('duck', {}, 'duck', { at: [sp.x, sp.y - 0.07, sp.z], tx: sp.tx, tz: sp.tz, yaw0: Math.atan2(sp.tx, sp.tz) });
          }
          for (i = 0; i < c.butterfly; i++) add('butterfly', null, 'butterfly' + i, { at: local(isle, D.flies[i % 2]) });
        } else if (isle === 'ice') {
          for (i = 0; i < c.penguin; i++) add('penguin', { size: i % 3 }, 'penguin' + (i % 3), { at: [F.cx + D.homes[i % 3][0], F.cy, F.cz + D.homes[i % 3][1]], slider: i === 2, slide: D.slide, yaw0: 0 });
          sp = c.floe ? waterSpot('ice', D.floeA, 0.9) : null;
          if (sp) {
            var ex = { at: [sp.x, sp.y - 0.15, sp.z], tx: sp.tx, tz: sp.tz, yaw0: 0.3 };
            add('raft', null, 'raft', ex); add('floePenguin', { size: 2 }, 'penguin2', ex);
          }
        }
        if (c.fish) {
          sp = waterSpot(isle, D.fishA, 0.95);
          if (sp) add('fish', null, 'fish:' + isle, { at: [sp.x, sp.y, sp.z], tx: sp.tx, tz: sp.tz, sx: sp.x - sp.tx * 0.6, sz: sp.z - sp.tz * 0.6, ex: sp.x + sp.tx * 0.6, ez: sp.z + sp.tz * 0.6, ph: 0 });
        }
      });
      return out;
    }
    function partsOf(a) {
      switch (a.kind) {
        case 'balloon': return modelParts('balloon' + a.n, function () { return balloonVoxels(a.n); });
        case 'bird': return modelParts('bird', birdVoxels);
        case 'boat': return modelParts('boat', boatVoxels);
        case 'butterfly': return modelParts(a.key, function () { return butterflyVoxels(+a.key.slice(-1)); });
        case 'pad': return modelParts('pad', padVoxels);
        case 'raft': return modelParts('raft', floeVoxels);
        case 'fish': return modelParts(a.key, function () { return fishVoxels(a.isle); });
        case 'floePenguin': return critterParts('penguin', a.critter, 'critter:' + a.key);
        default: return critterParts(a.kind, a.critter, 'critter:' + a.key);
      }
    }
    function buildLife() {
      var list = specs(), nv = 0, nb = 0;
      actors = [];
      list.forEach(function (a) {
        var src = partsOf(a);
        if (!src) return;
        a.src = src; a.bone = nb++; a.pv = [];
        var seen = {};
        src.parts.forEach(function (p) {
          nv += p.n;
          if (!p.pivot || seen[p.pivot] || !src.pivots[p.pivot]) return;
          var d = PIVOT[p.pivot] || [2, 0, 1];
          seen[p.pivot] = { bone: nb++, o: src.pivots[p.pivot], axis: d[0], slot: d[1], sign: d[2] };
          a.pv.push(seen[p.pivot]);
        });
        a.seen = seen;
        a.P = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, s: 1, a0: 0, a1: 0, a2: 0, ok: 1 };
        a.vis = 0;
        actors.push(a);
      });
      var Pa = new Float32Array(nv * 3), Na = new Float32Array(nv * 3), Ca = new Float32Array(nv * 3), Ua = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), o = 0;
      actors.forEach(function (a) {
        a.src.parts.forEach(function (p) {
          var b = p.pivot && a.seen[p.pivot] ? a.seen[p.pivot].bone : a.bone;
          Pa.set(p.P, o * 3); Na.set(p.N, o * 3); Ca.set(p.C, o * 3);
          if (p.U) Ua.set(p.U, o * 3); else for (var u = 0; u < p.n; u++) { Ua[(o + u) * 3] = 0.5; Ua[(o + u) * 3 + 1] = 0.5; }
          for (var v = 0; v < p.n; v++) { SI[(o + v) * 4] = b; SW[(o + v) * 4] = 1; }
          o += p.n;
        });
      });
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(Pa, 3)); geo.setAttribute('normal', new T.BufferAttribute(Na, 3));
      geo.setAttribute('color', new T.BufferAttribute(Ca, 3)); geo.setAttribute('vuv', new T.BufferAttribute(Ua, 3));
      geo.setAttribute('skinIndex', T.Uint16BufferAttribute ? new T.Uint16BufferAttribute(SI, 4) : new T.BufferAttribute(SI, 4));
      geo.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
      var bones = [];
      for (var b = 0; b < Math.max(1, nb); b++) bones.push(new T.Bone());
      var sk = new T.Skeleton(bones);
      sk.computeBoneTexture();
      sk.update = function () { if (boneDirty && this.boneTexture) { this.boneTexture.needsUpdate = true; boneDirty = false; } };
      if (skel) skel.dispose();
      skel = sk; E = sk.boneMatrices; E.fill(0);
      if (!life) {
        life = new T.SkinnedMesh(geo, V.mat('vox'));
        life.name = 'skylife:life'; life.userData.kind = 'life'; life.raycast = noPick;
        life.frustumCulled = false; life.castShadow = false; life.receiveShadow = true; life.matrixAutoUpdate = false;
        life.bindMode = T.DetachedBindMode || 'detached';
        group.add(life);
      } else { life.geometry.dispose(); life.geometry = geo; }
      life.bind(sk, IDENT);
      life.visible = nv > 0;
      boneDirty = true; st.dirty = true;
    }

    /* bone matrices (column-major, straight into the bone texture): the actor's frame A (3 × 3 · s
       and its translation), then each pivot's T(o)·R·T(−o) after it */
    var _A = new Float64Array(12), _R = new Float64Array(9);
    function frameInto(P, s) {
      var cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cx = Math.cos(P.pitch), sx = Math.sin(P.pitch), cz = Math.cos(P.roll), sz = Math.sin(P.roll);
      _A[0] = (cy * cz + sy * sx * sz) * s; _A[1] = cx * sz * s; _A[2] = (-sy * cz + cy * sx * sz) * s;
      _A[3] = (-cy * sz + sy * sx * cz) * s; _A[4] = cx * cz * s; _A[5] = (sy * sz + cy * sx * cz) * s;
      _A[6] = sy * cx * s; _A[7] = -sx * s; _A[8] = cy * cx * s;
      _A[9] = P.x; _A[10] = P.y; _A[11] = P.z;
    }
    function putBone(b, M, rx, ry, rz) {
      var o = b * 16;
      E[o] = M[0]; E[o + 1] = M[1]; E[o + 2] = M[2]; E[o + 3] = 0; E[o + 4] = M[3]; E[o + 5] = M[4]; E[o + 6] = M[5]; E[o + 7] = 0;
      E[o + 8] = M[6]; E[o + 9] = M[7]; E[o + 10] = M[8]; E[o + 11] = 0; E[o + 12] = rx; E[o + 13] = ry; E[o + 14] = rz; E[o + 15] = 1;
    }
    var _M = new Float64Array(9);
    function putPivot(pv, ang) {
      var c = Math.cos(ang), s = Math.sin(ang), A = _A, R = _R, o = pv.o, i;
      if (pv.axis === 0) { R[0] = 1; R[1] = 0; R[2] = 0; R[3] = 0; R[4] = c; R[5] = s; R[6] = 0; R[7] = -s; R[8] = c; }
      else if (pv.axis === 1) { R[0] = c; R[1] = 0; R[2] = -s; R[3] = 0; R[4] = 1; R[5] = 0; R[6] = s; R[7] = 0; R[8] = c; }
      else { R[0] = c; R[1] = s; R[2] = 0; R[3] = -s; R[4] = c; R[5] = 0; R[6] = 0; R[7] = 0; R[8] = 1; }
      for (i = 0; i < 3; i++) for (var r = 0; r < 3; r++) _M[i * 3 + r] = A[r] * R[i * 3] + A[3 + r] * R[i * 3 + 1] + A[6 + r] * R[i * 3 + 2];
      var dx = o[0] - (R[0] * o[0] + R[3] * o[1] + R[6] * o[2]), dy = o[1] - (R[1] * o[0] + R[4] * o[1] + R[7] * o[2]), dz = o[2] - (R[2] * o[0] + R[5] * o[1] + R[8] * o[2]);
      putBone(pv.bone, _M, A[0] * dx + A[3] * dy + A[6] * dz + A[9], A[1] * dx + A[4] * dy + A[7] * dz + A[10], A[2] * dx + A[5] * dy + A[8] * dz + A[11]);
    }
    function zeroBone(b) { E.fill(0, b * 16, b * 16 + 16); }
    function writeActor(a) {
      var P = a.P, s = P.s * a.vis * (P.ok === 0 ? 0 : 1);
      boneDirty = true; st.writes++;
      if (!(s > 1e-3)) { zeroBone(a.bone); for (var i = 0; i < a.pv.length; i++) zeroBone(a.pv[i].bone); return; }
      frameInto(P, s);
      putBone(a.bone, _A, _A[9], _A[10], _A[11]);
      for (var j = 0; j < a.pv.length; j++) { var pv = a.pv[j]; putPivot(pv, (pv.slot === 0 ? P.a0 : pv.slot === 1 ? P.a1 : P.a2) * pv.sign); }
    }

    /* ---------------- who shows, who moves ---------------- */
    function flyer(a) { return a.kind === 'balloon' || a.kind === 'bird'; }
    /* a penguin whose cell an object took (a moved igloo leaves its old row free to build on) steps out */
    function blocked(a) { var o = a.kind === 'penguin' && st.occ[a.isle], F = frames[a.isle]; return !!o && !!o[Math.floor(a.at[0] - F.offset[0]) + ',' + Math.floor(a.at[2] - F.offset[1])]; }
    function visTarget(a) {
      if (!flyer(a) && (!st.open[a.isle] || (low && st.far[a.isle]) || blocked(a))) return 0;
      var live = a.isle === st.visit && !st.edit && !st.reduced && !low;
      switch (a.kind) {
        /* the yard flock is Home's (from a north land it would cross the foreground) */
        case 'bird': return st.reduced || st.k >= BIRD.roost[1] || (a.flock.ring === 'yard' && st.visit !== 'home') ? 0 : st.k > BIRD.roost[0] ? 1 - smooth(BIRD.roost[0], BIRD.roost[1], st.k) : 1;
        case 'owl': return smooth(0.45, 0.6, st.k);
        case 'butterfly': return live && st.k < 0.6 ? 1 : 0;
        case 'fish': return live ? 1 : 0;
        default: return 1;
      }
    }
    /* edit mode: a flyer within EDIT_KEEP u of the visited island's box goes */
    function keepAway(P) {
      if (!st.edit) return false;
      var Z = zones();
      for (var i = 0; i < Z.length; i++) {
        var z = Z[i];
        if (z.kind !== 'isle' || z.isle !== st.visit) continue;
        return P.x > z.x0 - EDIT_KEEP && P.x < z.x1 + EDIT_KEEP && P.z > z.z0 - EDIT_KEEP && P.z < z.z1 + EDIT_KEEP;
      }
      return false;
    }
    var _L = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, s: 1, a0: 0, a1: 0, a2: 0, ok: 1 }, _Rp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, s: 1, a0: 0, a1: 0, a2: 0, ok: 1 };
    function poseActor(a, t) {
      var P = a.P;
      if (flyer(a)) { livePose(a, t, P); return; }
      var k = st.act[a.isle] || 0;
      if (k >= 1) { livePose(a, t, P); P.ok = 1; return; }
      if (a.kind === 'fish' || a.kind === 'butterfly') { if (k > 0) livePose(a, t, P); P.s *= k; P.ok = 1; return; }      /* they only show while they play */
      restPose(a, P); P.ok = 1;
      if (k <= 0) return;
      livePose(a, t, _L); restPose(a, _Rp);
      P.x = _Rp.x + (_L.x - _Rp.x) * k; P.y = _Rp.y + (_L.y - _Rp.y) * k; P.z = _Rp.z + (_L.z - _Rp.z) * k;
      P.yaw = mixA(_Rp.yaw, _L.yaw, k); P.pitch = _Rp.pitch + (_L.pitch - _Rp.pitch) * k; P.roll = _Rp.roll + (_L.roll - _Rp.roll) * k;
      P.a0 = _Rp.a0 + (_L.a0 - _Rp.a0) * k; P.a1 = _Rp.a1 + (_L.a1 - _Rp.a1) * k; P.a2 = _Rp.a2 + (_L.a2 - _Rp.a2) * k;
    }
    function moving(a) {
      if (st.reduced) return false;
      if (flyer(a)) return a.vis > 0 || visTarget(a) > 0;
      return (st.act[a.isle] > 0 || st.act[a.isle] !== st.actWas[a.isle]) && a.vis > 0;
    }
    function actTarget(isle) { return isle === st.visit && !st.edit && !st.reduced && !low ? 1 : 0; }

    /* ---------------- sparks: stars, snow, fireflies, leaves, aurora, splash, wake ---------------- */
    var sparkCap = 0;
    (function () {
      var I = C0.isles, aur = tier === 'LOW' ? 0 : CLOUD.AURORA * (tier === 'HIGH' ? 3 : 2);
      sparkCap = C0.stars + Math.max(I.ice.snow + aur + 12, I.jungle.fireflies + I.jungle.leaves + 12, 20);
      if (!C0.stars && !I.ice.snow && !I.jungle.fireflies && !I.jungle.leaves && !I.home.fish) sparkCap = 0;
    }());
    var sparks = null, sp = [], spN = 0, spStep = -1, _s3 = [0, 0, 0], _rgb = [0, 0, 0], AUR = ['PX Aurora Mint', 'PX Aurora Sky', 'PX Aurora Violet'].map(rgb);
    if (sparkCap > 0) {
      sparks = V.instancedCubes(sparkCap, { mode: 'glow', size: 1, name: 'skylife:sparks' });
      sparks.mesh.userData.kind = 'sparks'; sparks.mesh.raycast = noPick; group.add(sparks.mesh);
    }
    function spark(kind, extra) { var r = { kind: kind, k: sparks.alloc(), i: sp.length }; for (var key in extra) r[key] = extra[key]; sp.push(r); return r; }
    function assignSparks() {
      if (!sparks) return;
      sparks.clear(); sp = []; spStep = -1;
      var C = counts(tier, quality, budget), isle = st.visit, c = C.isles[isle], F = frames[isle], night = st.k > 0.5, calm = st.edit || st.reduced, i, D = LAND[isle];
      if (night) for (i = 0; i < C.stars; i++) {
        var az = TAU * hash(i, 1, 11), el = (-62 + 66 * hash(i, 2, 11)) * Math.PI / 180, r = 95 + 25 * hash(i, 3, 11);
        spark('star', { x: 3 + r * Math.cos(el) * Math.cos(az), y: -12 + r * Math.sin(el), z: -10 + r * Math.cos(el) * Math.sin(az), s: 0.16 + 0.16 * hash(i, 4, 11),
          col: rgb(['PX Skylife Star', 'PX Glint', 'PX Aurora Sky', 'PX Bulb Warm'][i % 4]) });
      }
      if (!st.open[isle]) { spN = sp.length; return; }
      if (isle === 'ice' && !calm) for (i = 0; i < c.snow; i++) spark('snow', { x: F.bounds.x0 - 0.5 + (F.bounds.x1 - F.bounds.x0 + 1) * hash(i, 5, 11), z: F.bounds.z0 - 0.5 + (F.bounds.z1 - F.bounds.z0 + 1) * hash(i, 6, 11),
        ph: hash(i, 7, 11), col: rgb(i % 3 ? 'PX Ice Snow' : 'PX Ice Snow Shade'), top: F.cy + 6, H: 5.92 });
      if (isle === 'ice' && night && c.aurora && !low) {
        var rows = tier === 'HIGH' ? 3 : 2;
        for (i = 0; i < CLOUD.AURORA * rows; i++) spark('aurora', { x: F.bounds.x0 + 0.5 + (i % CLOUD.AURORA) * (F.bounds.x1 - F.bounds.x0 - 1) / (CLOUD.AURORA - 1), row: Math.floor(i / CLOUD.AURORA),
          y: F.cy + D.aurora.y, z: F.bounds.z0 + D.aurora.dz, h: (0.45 + 0.4 * hash(i % CLOUD.AURORA, 14, 11)) * (i >= 2 * CLOUD.AURORA ? 0.7 : 1) });
      }
      if (isle === 'jungle' && !calm) for (i = 0; i < c.leaves; i++) {
        var src = i % 3 ? local('jungle', D.trees[i % 4]) : local('jungle', D.canopy);
        spark('leaf', { bx: src[0], bz: src[2], top: src[1] + 0.2, H: src[1] + 0.2 - F.cy, ph: hash(i, 8, 11), col: rgb(['PX Jungle Canopy', 'PX Jungle Canopy Light', 'PX Tree Autumn'][i % 3]) });
      }
      if (isle === 'jungle' && night) for (i = 0; i < c.fireflies; i++) {
        var gv = D.glow[i % 3];
        spark('firefly', { x: F.cx + gv[0] + (hash(i, 9, 11) - 0.5) * 2 * gv[3], y: F.cy + gv[1] + hash(i, 10, 11) * 0.9, z: F.cz + gv[2] + (hash(i, 11, 11) - 0.5) * 2 * gv[3],
          ph: hash(i, 12, 11), hz: 0.5 + 0.3 * hash(i, 13, 11), col: rgb('PX Skylife Firefly') });
      }
      if (!calm && !low) actors.forEach(function (a) {
        if (a.isle !== isle) return;
        if (a.kind === 'fish') for (i = 0; i < 12; i++) spark('splash', { fish: a, q: i < 6 ? 0 : 1, n: i % 6, col: rgb(i % 3 ? 'Cloud White' : 'PX Ice Shine') });
        if (a.kind === 'boat') for (i = 0; i < 8; i++) spark('wake', { boat: a, n: i, col: rgb('Cloud White') });
      });
      spN = sp.length;
      writeSparks(st.clock, true);
    }
    function tint(r, b) { _rgb[0] = r.col[0] * b; _rgb[1] = r.col[1] * b; _rgb[2] = r.col[2] * b; sparks.tint(r.k, _rgb); }
    function writeSparks(t, force) {
      if (!sparks || !spN) return false;
      var calm = st.reduced, nf = smooth(0.5, 0.75, st.k), lit = 1 - 0.35 * st.k, step = Math.floor(t * 2), moved = false, f;
      for (var i = 0; i < spN; i++) {
        var r = sp[i];
        switch (r.kind) {
          case 'star':
            if (force || step !== spStep) { tint(r, 0.7 + 0.3 * hash(r.i, Math.floor((calm ? 0 : step + (r.i & 7)) / 8), 12)); sparks.set(r.k, r.x, r.y, r.z, r.s * nf); }
            break;
          case 'snow': {
            var fall = ((0.3 * t + r.ph * r.H) % r.H + r.H) % r.H;
            if (force) tint(r, lit);
            sparks.set(r.k, r.x + 0.22 * Math.sin(TAU * RATES.snowSway * t + r.ph * 9), r.top - fall, r.z + 0.15 * Math.cos(TAU * 0.1 * t + r.ph * 7), 0.125); moved = true;
            break;
          }
          case 'leaf': {
            var lf = 0.3 * t + r.ph * r.H, cyc = Math.floor(lf / r.H), dy = lf - cyc * r.H;
            if (force) tint(r, lit);
            _s3[0] = 0.12; _s3[1] = 0.035; _s3[2] = 0.12;
            sparks.set(r.k, r.bx + (hash(r.i, cyc, 21) - 0.5) * 2.2 + 0.3 * Math.sin(TAU * RATES.leafSway * t + r.ph * 6), r.top - dy, r.bz + (hash(r.i, cyc, 22) - 0.5) * 2.2, _s3); moved = true;
            break;
          }
          case 'firefly':
            f = calm ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * r.hz * t + r.ph * TAU));
            tint(r, f);
            sparks.set(r.k, r.x + (calm ? 0 : 0.35 * Math.sin(TAU * 0.07 * t + r.ph * 9)), r.y + (calm ? 0 : 0.22 * Math.sin(TAU * 0.09 * t + r.ph * 5)), r.z + (calm ? 0 : 0.3 * Math.cos(TAU * 0.06 * t + r.ph * 7)), 0.075 * nf);
            moved = !calm;
            break;
          case 'aurora': {
            /* a wavy ribbon of narrow rays, mint at the foot to violet at the top; the wave travels along it
               and each row's colour leans toward the next and back (both ≤ 0.1 Hz); dimmer as it rises */
            var ta = calm ? 0 : t, dr = 0.3 + 0.3 * Math.sin(TAU * RATES.auroraDrift * ta + r.x * 0.21 + r.row), A = AUR[r.row % 3], B = AUR[(r.row + 1) % 3];
            for (var q = 0; q < 3; q++) _rgb[q] = (A[q] + (B[q] - A[q]) * dr) * (0.72 - 0.1 * r.row);
            sparks.tint(r.k, _rgb);
            _s3[0] = 0.3; _s3[1] = r.h * nf; _s3[2] = 0.08;
            sparks.set(r.k, r.x, r.y + r.row * 0.62 + r.h / 2 + 0.6 * Math.sin(TAU * RATES.auroraWave * ta + r.x * 0.55) + 0.25 * Math.sin(r.x * 1.9),
              r.z + 0.45 * Math.sin(TAU * RATES.auroraWave * 0.8 * ta + r.x * 0.3 + 1), _s3);
            moved = !calm;
            break;
          }
          case 'splash': {
            var fa = r.fish, u = ((t + 0.5 + fa.ph * 4.6) % 4.6 + 4.6) % 4.6, w = (r.q ? u - 1.3 : u) / 0.6, on = w >= 0 && w <= 1 && st.act[fa.isle] >= 1, ang = r.n / 6 * TAU + r.q, rr = 0.12 + 0.28 * (on ? w : 0);
            if (force) tint(r, lit);
            sparks.set(r.k, (r.q ? fa.ex : fa.sx) + Math.cos(ang) * rr, fa.at[1] + 0.03 + (on ? 0.22 * Math.sin(Math.PI * w) * (r.n % 2 ? 1 : 0.6) : 0), (r.q ? fa.ez : fa.sz) + Math.sin(ang) * rr,
              on ? 0.13 * Math.sin(Math.PI * w) : 0);
            moved = true;
            break;
          }
          case 'wake': {
            var bt = r.boat, on2 = st.act.home >= 1, side = r.n % 2 ? 1 : -1, uw = ((t * 0.3 + r.n / 8) % 1), lx = side * (0.45 + uw * 0.4), lz = -1.0 - uw * 0.9, cb = Math.cos(bt.yaw0), sb = Math.sin(bt.yaw0);
            if (force) tint(r, lit);
            sparks.set(r.k, bt.at[0] + lx * cb + lz * sb, bt.at[1] + 0.28, bt.at[2] - lx * sb + lz * cb, on2 ? 0.18 * (1 - uw) + 0.02 : 0);
            moved = true;
            break;
          }
        }
      }
      spStep = step;
      sparks.commit();
      return moved;
    }

    /* ---------------- per frame ---------------- */
    function writeAll(t, ease0) {
      for (var i = 0; i < actors.length; i++) {
        var a = actors[i], to = visTarget(a);
        if (flyer(a) && keepAway(a.P)) to = 0;
        a.vis = ease0 ? to : a.vis;
        poseActor(a, t);
        if (flyer(a) && keepAway(a.P)) a.vis = 0;
        writeActor(a);
      }
    }
    function update(dt, t, ctx) {
      if (st.disposed) return false;
      dt = typeof dt === 'number' && dt > 0 ? Math.min(dt, 0.1) : 0;
      if (ctx) {
        if (ctx.visit && ctx.visit !== st.visit) setVisit(ctx.visit);
        if (ctx.edit != null && !!ctx.edit !== st.edit) setEdit(ctx.edit);
        if (typeof ctx.show === 'number' && ctx.show !== st.k) setShow(ctx.show);
        if (ctx.camera) camera(ctx.camera);
      }
      if (st.reduced) { if (st.dirty) { writeAll(st.clock, true); writeSparks(st.clock, true); st.dirty = false; } st.busy = false; return false; }
      st.clock += dt;
      var t0 = st.clock, busy = false, i;
      for (i = 0; i < ISLES.length; i++) {                       /* (plain loops: nothing here allocates) */
        var isle = ISLES[i], goal = actTarget(isle), k = st.actWas[isle] = st.act[isle];
        if (k !== goal) { st.act[isle] = goal > k ? Math.min(goal, k + dt / ACT_SEC) : Math.max(goal, k - dt / ACT_SEC); busy = true; }
      }
      if (!low && clouds && lanes.length) {
        st.cloudT += dt; st.cloudAcc += dt;
        if (st.cloudAcc >= CLOUD.tick) { st.cloudAcc = 0; writeClouds(st.cloudT); }
        busy = true;
      }
      for (i = 0; i < actors.length; i++) {
        var a = actors[i], mv = moving(a), to = visTarget(a);
        if (!mv && !st.dirty && a.vis === to) continue;
        poseActor(a, t0);
        if (flyer(a) && keepAway(a.P)) to = 0;
        if (a.vis !== to) { a.vis = to > a.vis ? Math.min(to, a.vis + dt / FADE_SEC) : Math.max(to, a.vis - dt / FADE_SEC); busy = true; }
        if (mv || st.dirty || a.vis > 0 || to > 0) writeActor(a);
        if (mv) busy = true;
      }
      if (writeSparks(t0, st.dirty)) busy = true;
      if (sparks && spN && st.k > 0.5) busy = true;          /* the night's twinkle and breathing */
      st.dirty = false; st.busy = busy;
      return busy;
    }
    function camera(cam) {
      if (!low) return;
      var p = cam.position || cam;
      if (!p || typeof p.x !== 'number') return;
      for (var i = 1; i < ISLES.length; i++) {
        var isle = ISLES[i], F = frames[isle], dx = p.x - F.cx, dy = p.y - F.cy, dz = p.z - F.cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz), far = st.far[isle] ? d > NEAR : d > FAR;
        if (far !== !!st.far[isle]) { st.far[isle] = far; st.dirty = true; }
      }
    }

    /* ---------------- controls ---------------- */
    function setVisit(isle) { if (ISLES.indexOf(isle) < 0 || isle === st.visit) return; st.visit = isle; if (st.reduced) settleAct(); assignSparks(); st.dirty = true; }
    function setEdit(on) { on = !!on; if (on === st.edit) return; st.edit = on; assignSparks(); st.dirty = true; }
    function setShow(k) {
      k = clamp01(+k || 0);
      if (k === st.k) return;
      var night = k > 0.5, was = st.k > 0.5;
      st.k = k; tintClouds();
      if (night !== was) assignSparks();
      st.dirty = true;
    }
    function settleAct() { ISLES.forEach(function (i) { st.act[i] = actTarget(i); }); }
    function setReduced(on) {
      on = !!on;
      if (on === st.reduced) return;
      st.reduced = on; settleAct(); assignSparks(); st.dirty = true;
      if (on) { writeClouds(st.cloudT); writeAll(st.clock, true); }
    }
    function setIsles(unlocked) {
      if (st.disposed) return;
      var open = { home: 1 };
      (Array.isArray(unlocked) ? unlocked : []).forEach(function (i) { if (ISLES.indexOf(i) > 0) open[i] = 1; });
      if (Object.keys(open).sort().join() === Object.keys(st.open).sort().join()) return;
      st.open = open; buildLife(); assignSparks();
      if (st.reduced) writeAll(st.clock, true);
    }
    /* the island's object footprints [{x, y, w, h, path}] in cells (the host forwards SLSky3D.setLayout) */
    function setLayout(isle, fps) {
      if (ISLES.indexOf(isle) < 0) return;
      var occ = {};
      (Array.isArray(fps) ? fps : []).forEach(function (f) { if (f && !f.path) for (var dx = 0; dx < (f.w || 1); dx++) for (var dy = 0; dy < (f.h || 1); dy++) occ[(f.x + dx) + ',' + (f.y + dy)] = 1; });
      st.occ[isle] = occ; st.dirty = true;
      if (st.reduced) writeAll(st.clock, true);
    }
    function setQuality(q) {
      if (!q) return;
      var ls = q.lifeScale > 0 ? q.lifeScale : quality.lifeScale, ps = q.particleScale > 0 ? q.particleScale : quality.particleScale;
      if (ls === quality.lifeScale && ps === quality.particleScale) return;
      var lifeChanged = ls !== quality.lifeScale;
      quality.lifeScale = ls; quality.particleScale = ps; C0 = counts(tier, quality, budget);
      if (lifeChanged) { buildClouds(); buildLife(); }
      assignSparks(); st.dirty = true;
    }
    function info() {
      var calls = 0, tris = 0;
      group.traverse(function (o) {
        if (!o.isMesh || !o.visible || (o.isInstancedMesh && !o.count)) return;
        calls++;
        var n = o.geometry.attributes.position.count;
        tris += n / 3 * (o.isInstancedMesh ? o.count : 1);
      });
      var per = {};
      actors.forEach(function (a) { if (!flyer(a) && CRITTERS.indexOf(a.kind === 'floePenguin' ? 'floe' : a.kind) >= 0) per[a.isle] = (per[a.isle] || 0) + 1; });
      var kinds = {};
      sp.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });
      return { VERSION: VERSION, tier: tier, calls: calls, tris: Math.round(tris), k: st.k, visit: st.visit, edit: st.edit, reduced: st.reduced, busy: st.busy,
        clouds: { n: lanes.length, cubes: lanes.reduce(function (n, l) { return n + l.cubes.length; }, 0), moving: !low && !st.reduced },
        balloons: actors.filter(function (a) { return a.kind === 'balloon'; }).length, birds: actors.filter(function (a) { return a.kind === 'bird'; }).length,
        critters: per, sparks: kinds, bones: skel ? skel.bones.length : 0, lifeScale: quality.lifeScale, particleScale: quality.particleScale, far: Object.keys(st.far).filter(function (i) { return st.far[i]; }) };
    }
    function dispose() {
      if (st.disposed) return;
      st.disposed = true;
      if (clouds) clouds.dispose();
      if (sparks) sparks.dispose();
      if (life) { life.geometry.dispose(); group.remove(life); }
      if (skel) skel.dispose();
      if (group.parent) group.parent.remove(group);
      group.clear();
      actors = []; sp = []; spN = 0; clouds = sparks = life = skel = null;
    }

    /* the starting state */
    buildClouds();
    setIsles(opts.isles || []);
    if (!life) buildLife();
    settleAct(); assignSparks();
    writeAll(0, true);

    var api = {
      VERSION: VERSION, group: group, tier: tier,
      update: update, setIsles: setIsles, setVisit: setVisit, setEdit: setEdit, setShow: setShow, setReduced: setReduced, setQuality: setQuality, setLayout: setLayout,
      info: info, dispose: dispose,
      /* for the tests and the lab: the actors' live poses and the lanes (read only) */
      actors: function () { return actors; }, lanes: function () { return lanes; }, sparks: function () { return sp.slice(0, spN); }
    };
    Object.defineProperty(api, 'show', { get: function () { return st.k; } });
    Object.defineProperty(api, 'reduced', { get: function () { return st.reduced; } });
    return api;
  }

  return {
    VERSION: VERSION, ISLES: ISLES, BUDGET: BUDGET, AMBIENT: AMBIENT, CRITTERS: CRITTERS, RATES: RATES, CAPS: CAPS, CLOUD: CLOUD, CIRCUIT: CIRCUIT, YARD: YARD,
    BIRD: BIRD, BALLOON: BALLOON, LAND: LAND, TOKENS: TOKENS, FAR: FAR, NEAR: NEAR, EDIT_KEEP: EDIT_KEEP,
    create: create,
    /* pure helpers (Node-testable) */
    counts: counts, flockSizes: flockSizes, cloudCubes: cloudCubes, cloudLanes: cloudLanes, cloudAt: cloudAt, clearBox: clearBox, loopPath: loopPath, pathAt: pathAt,
    circuit: circuit, circuitClear: circuitClear, yardAt: yardAt, yardClear: yardClear, waterSpot: waterSpot, flapAt: flapAt, livePose: livePose, restPose: restPose,
    birdVoxels: birdVoxels, balloonVoxels: balloonVoxels, boatVoxels: boatVoxels, fishVoxels: fishVoxels, butterflyVoxels: butterflyVoxels, padVoxels: padVoxels, floeVoxels: floeVoxels
  };
}));
