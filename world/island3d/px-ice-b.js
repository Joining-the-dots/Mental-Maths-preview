/* ================================================================
   My Island v3 — SLPxIceB (W3b.7): the Penguin Ice Village's rides and big builds in Pixel
   Blocks. window.SLPxIceB + SL3D.defineVox('ice-b', factory) in the browser, module.exports in
   Node. Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the
   photocards and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at
   the footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u.
     ice_choir    2×1  three ice-block risers that climb left to right like a scale (snow-edged,
                       the middle one set back so the row curves), a penguin on each (0.45 / 0.4 /
                       0.33 u: SLPxCharacters' own penguin, else a local twin, on pen0 – pen2), a
                       snow podium at the low end for the pet ('spot'), a twig music stand with a ♪
                       pictogram and an aurora lantern at each end (state 'lamp': on with the night).
                       Act 'sing': they sway ±6° at 1 Hz and each stretches up on its own note, low,
                       middle, high, twice (a ♪ rises over the singer), then all three hold the chord.
     ice_sled     3×1  a snow-block start tower (one big step, a deck 1.125 u up with an ice-blue top
                       course, a rope winch on the helper pivot 'winch', two posts with a violet and a
                       mint pennant), a packed-snow run between blue ice banks edged in deep ice blue,
                       curving down to a bump, a runout and a drift; the red sledge on gold runners
                       rests at the foot on 'sled' (anchor seat rides it). Act 'slide':
                       the winch hauls the sledge (and the pet on it) up, then it whooshes down, hops
                       the bump with a puff of snow and stops in the drift.
     ice_rink     2×2  an iced-over pond (ice with scratch lines) in a ring of snow-block banks with a
                       deep-ice-blue rim round the ice, two snowy pines at the back, a plank bench
                       between them and eight barrier posts (coral and sky, alternating) with lantern
                       heads (state 'lamps': on with the night). Anchors lap0 – lap7 trace one
                       figure-of-eight over the ice. Act 'skate': scratch lines (fx 'trail') appear
                       behind the pet; nothing on the rink moves.
     ice_skilift  3×1  an open bottom station (a snow-capped roof on the wheel's post, skis leaning on
                       it), a lattice pylon on a snow mound with a plank landing deck, and a cable
                       loop between two horizontal wheels: up on the front strand, down on the back.
                       Three open two-seat chairs, each all in its colour (coral c0, mint c1, yellow
                       c2), hang from it; 'cable' is the station's drive wheel, the helper 'wheel' the
                       pylon's. Act 'chairlift':
                       the loop runs until c0 (anchor seat) has carried the pet to the top; then the
                       lift runs on (idle) until c0 is home. Chairs sway ±2° at 0.3 Hz on MID / HIGH.
     ice_castle   2×2  a squat keep of big ice blocks (alternating courses, ice shine) under deep-ice-
                       blue merlons, four round towers with flat notched tops in aurora-violet and
                       mint caps (snow on the merlons at MID), warm windows (PX Ice Hut Glow, by day
                       too) in the front towers, an arched gate whose dark iron grille slides up on
                       'gate', mint and violet pennants on the back towers, and lantern
                       blocks set in the walls in four rows (state parts row0 – row3: Lamp Off →
                       Aurora Mint / Sky / Violet / Ice Hut Glow). No spire, balcony or stair. Act
                       'lights' (a remembered toggle): the gate opens and the rows light bottom-up.
     ice_fort     2×2  chunky snow-block walls with deep-ice-blue merlons, an ice-block arch round the
                       doorway and ice windows, one round turret (back-right), a packed-snow floor
                       (anchors in0, in1, turret), stacks of aurora-violet and mint snowballs (one
                       inside, two by the door), coral and white bunting across the front and a
                       pennant in the member colour with a snowflake on a pole (pivot 'flag'). Act
                       'popup': the pennant drops and runs back up its pole while the pet pops up;
                       nothing is thrown.
     ice_slide    2×1  the first plan's ice slide: a solid ramp of ice blocks curving down from a
                       1.25 u platform (an ice-blue top course; coral and white rails to 1.5 u, a
                       sunny and a violet flag) with two big snow-block steps at the back, its deep-
                       blue chute between candy-striped coral and white rims; anchors top (the
                       platform) and foot. Nothing on it moves.
   GRAIN (D11): masses G8 in 0.25 u block courses; chairs, wheels, rails, posts, poles, pennants,
   the stand and the sledge G16; penguins on px-characters' grid. No corner AO (block tones and
   G16 parts only split quads with it).
   LOW (D89, D106): detail voxels are tagged lod 'mid'; every id brings its own lod1 (its plain
   masses with their accents and outlines, halved: the Sky map draws these) inside TRIS_CAPS_LOD1.
   LOOK: each ride keeps the snow and adds one strong accent and a PX Ice Deep outline on its top
   course or rim, so the land reads at island and Sky-map scale.
   ACTS run on SLMotion timelines by name (sing · slide · skate · chairlift · lights · popup); one
   live act per uid (a re-tap supersedes); reduced motion = the end state at once with the same
   sounds and one sparkle. Rates: sway 1 Hz, chair bob 1 Hz, idle sway 0.3 Hz, a lantern row fades
   in over 0.4 s (never a flash). The pet's part is a.pets.perform(LOOK perform kind, uid). No
   word, no five-point star, no flame, nothing thrown; nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.dt a.phase a.reduced a.show a.lit a.batch a.template · a.pivot(name)
   .set(rotDeg[3], pos[3], scale[3]) · a.state(key, v) · a.emit(kind, anchor | localPos, n) ·
   a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxIceB = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('ice-b', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxIceB: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }
  function chars() { return sibling('SLPxCharacters', './px-characters.js'); }

  var VERSION = 1;
  var IDS = ['ice_choir', 'ice_sled', 'ice_rink', 'ice_skilift', 'ice_castle', 'ice_fort', 'ice_slide'];
  var G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { ice_choir: 'sing', ice_sled: 'slide', ice_rink: 'skate', ice_skilift: 'chairlift', ice_castle: 'lights', ice_fort: 'popup', ice_slide: 'slide' };
  var PERFORM = { ice_choir: 'stand:cheer', ice_sled: 'slide', ice_rink: 'skate', ice_skilift: 'seat:ride', ice_castle: 'trail:hop', ice_fort: 'trail:hop',
                  ice_slide: 'slide' };
  /* pivots beyond the lookEntries lists: the sled's winch and the pylon's wheel turn with the rides */
  var HELPERS = { ice_sled: ['winch'], ice_skilift: ['wheel'] };
  /* the remembered toggle: the CATALOG act and the explicit names for each way (lit = lights on) */
  var TOGGLES = { ice_castle: { act: 'lights', on: ['glowOn'], off: ['glowOff', 'close'] } };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */

  /* ================================================================
     LAYOUT (item metres unless named; the builders, the handlers, the anchors and the tests read
     the same numbers)
     ================================================================ */
  /* choir: risers [i0, i1, k0, k1, rows] on G8 (low → high), the pet's podium, each penguin's feet;
     a note's hump lasts `note` s; the chord swells over `hold` */
  var CH = {
    risers: [[-4, -1, -3, 1, 1], [0, 2, -3, 0, 3], [3, 5, -3, 1, 5]], pad: [-7, -5, -2, 1, 1],
    pens: [[-0.25, 0.125, -0.0625], [0.1875, 0.375, -0.1875], [0.5625, 0.625, -0.0625]], heights: [0.45, 0.4, 0.33],
    spot: [-0.6875, 0.125, -0.0625], sway: 6, stretch: 0.14, lift: 0.03, chord: 0.5, note: 0.3, hold: [2.25, 2.4, 2.8, 2.95],
    notes: [0.3, 0.65, 1.0, 1.35, 1.7, 2.05], lamps: [[-14, -6], [11, -6]]
  };
  /* sledge run: the bed's top (bedY) from the deck down a curve to a bump, the runout and the drift */
  var SL = {
    deckY: 1.125, run: [-0.75, 0.375], bump: [0.375, 0.625, 0.125], step: [-11, 5], deck: [-10, -7], drift: [9, 10, 3],
    top: -0.9375, foot: 0.875, winch: [-1.1875, 1.375, 0], turns: 1, hop: 0.1, hopAt: [0.3125, 0.6875],
    seat: [0.875, 0.25, 0], spot: [0.875, 0, 0.3125], puff: [0.5, 0.3125, 0], drift3: [1.25, 0.375, 0]
  };
  /* rink: the pond (an ellipse of G8 half-axes a, b), the figure-of-eight, the eight lanterns (G8 cells)
     and their barrier posts' ink (coral and sky, alternating round the ring) and height (G16 rows) */
  var RK = {
    a: 5.5, b: 4.5, ice: 0.125, spot: [0, 0.25, 0.6875], pines: [[-0.625, -0.625], [0.625, -0.625]],
    laps: [[0, 0], [0.3125, 0.25], [0.5625, 0], [0.3125, -0.25], [0, 0], [-0.3125, 0.25], [-0.5625, 0], [-0.3125, -0.25]],
    lamps: [[-6, -3], [-6, 3], [-3, 5], [2, 5], [5, 3], [5, -3], [-3, -6], [2, -6]], posts: 'cBcBcBBc', postH: 3
  };
  /* ski lift: the cable loop (front strand up, back strand down) between two horizontal wheels over
     a low hut and a pylon; a chair's seat is `pan` under its grip; the lift cruises at D / `cruise`
     u a second */
  var LF = {
    lo: [-1.0, 1.125], hi: [1.0, 2.5], r: 0.25, pan: 0.40625, seatX: 0.0625, chairs: ['c', 'm', 'y'], arms: ['3', 'Z', '4'], bob: 0.1, sway: 2, swayPeriod: 1 / 0.3,
    foot: [-0.75, 0, 0.40625], spot: [0, 0, 0.375], cruise: 2.2, hut: [-11, -6, -3, 2, 3]
  };
  /* castle: keep and tower cells (G8), the courses (rows a tone), the gate grille's rise, the four
     lantern rows (G8 rows). The pet waits at the front-left corner ('spot'), more than the crew's
     reach (1.5 u) from the turret, so it pops up there in a sparkle and never hops through a tower */
  var CA = {
    keep: [-5, 4], keepH: 12, towerH: 16, course: 2, towerCourse: 3, towers: [[-5.5, -5.5], [4.5, -5.5], [-5.5, 4.5], [4.5, 4.5]],
    gate: [0, 0.375, 0.53125], rise: 0.625, rows: [1, 4, 7, 10], spot: [-0.875, 0, 0.875], turret: [0.625, 2.0, 0.625], open: 0.2,
    /* each tower's cap colour (violet / mint, crosswise, so a back pennant never matches its own cap), the
       cap's rows (the top band under the merlons) and the warm windows [i, k] at rows win (G8) */
    caps: 'vaav', capRows: 2, win: [8, 9], windows: [[-5, 6], [4, 6], [-7, 4], [6, 4]]
  };
  /* snow fort: walls and turret (G8), the pennant's drop down its pole; the door's ice arch [i, j] and
     the ice windows [wall, k | i, row] (G8), the bunting's posts (G16 x) and its line's row */
  var FO = {
    wall: [-6, 5], wallH: 5, turret: [4, -5], turretH: 7, flag: [0.6875, 1.125, -0.78125], drop: 0.25, down: [0.15, 0.55],
    in0: [-0.1875, 0.0625, -0.125], in1: [0, 0.0625, 0.25], turretAt: [0.5625, 0.875, -0.5625], puffs: [[0.9, 'in1'], [1.7, 'turret']],
    arch: [[-3, 0], [-3, 1], [-3, 2], [2, 0], [2, 1], [2, 2], [-2, 3], [1, 3]], windows: [['l', -1, 2], ['r', 1, 2]],
    bunting: { posts: [-7, 10], y: 16 }
  };
  /* ice slide: the platform and steps (G8), the ramp's bed rows from the platform's edge down */
  var IS = { platform: [-5, -4, 10], steps: [[-7, 4], [-6, 7]], ramp: [10, 9, 7, 6, 5, 4, 3, 2, 1, 1], top: [-0.5, 1.25, 0], foot: [0.75, 0.125, 0] };

  /* ================================================================
     BUILDER HELPERS (pure)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  /* a builder grid: even (voxels −1 and 0 straddle the pivot) or odd (voxel 0 centred on it); oy
     0.5 centres row 0 on y = 0 */
  function grid(g, odd, oy) { return VX().grid({ grid: g, origin: [odd ? 0.5 : 0, oy || 0, odd ? 0.5 : 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at] | {vox, at} (a ready snapshot)]; o.pivots {name: [x, y, z]}
     and o.anchors {name: [x, y, z, pivot?]} in item metres; o.cull as the model format */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      if (l && l.vox) { m.layers.push(l); return; }
      var g = Array.isArray(l) ? l[0] : l, n = m.layers.length;
      if (!g.count) return;
      m.layers.push(Array.isArray(l) ? { vox: g.snapshot(), at: l[1] } : { vox: g.snapshot() });
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { m.pivots[n] = { at: U(o.pivots[n]), parent: null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    if (o.cull) m.cull = o.cull.slice();
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* fn(i, j, k) → a char, or null to leave that cell as it is (box() with null would clear it) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = typeof fn === 'function' ? fn(i, j, k) : fn; if (c) g.set(i, j, k, c); }
  }
  /* the shared ink: one colour per char. Digits are the MID / HIGH detail twins (lod 'mid': tier LOW
     drops them, D89). 'I' is the ice-blue outline (PX Ice Deep, as 'd'): an upper-case char, so where
     it ties a snow or ice tone in a 2 × 2 × 2 block of the halved 'vox-lod1' model, the outline wins */
  var MID = 'mid', SNOW = 'snow', ICE = 'ice';
  var INK = {
    s: 'PX Ice Snow', S: { token: 'PX Ice Snow', mode: SNOW }, t: 'PX Ice Snow 2', T: { token: 'PX Ice Snow 2', mode: SNOW }, u: 'PX Ice Snow 3', H: { token: 'PX Ice Snow Shade', mode: SNOW },
    i: { token: 'PX Ice', mode: ICE }, j: { token: 'PX Ice 2', mode: ICE }, d: { token: 'PX Ice Deep', mode: ICE }, x: { token: 'PX Ice Shine', mode: ICE },
    I: { token: 'PX Ice Deep', mode: ICE },
    D: 'PX Penguin Back', k: 'PX Tree Bark', p: { token: 'PX Tree Plank', mode: 'plank' }, P: 'PX Tree Plank', r: 'PX Tree Rope', c: 'PX Coral',
    m: 'PX Mint', y: 'PX Sunny', n: 'PX Ice Pebble 3', w: 'Cloud White', g: 'PX Tree Pine', G: 'PX Tree Pine Mid', a: 'PX Aurora Mint', v: 'PX Aurora Violet',
    N: 'PX Penguin Back', F: 'PX Penguin Front', O: 'PX Penguin Orange', E: 'PX Ink Eye', X: { token: 'PX Glint', mode: 'glow' },
    0: { token: 'PX Ice Pebble 3', lod: MID }, 1: { token: 'PX Ice Snow', mode: SNOW, lod: MID }, 2: { token: 'PX Glint', lod: MID },
    3: { token: 'PX Coral', lod: MID }, 4: { token: 'PX Sunny', lod: MID }, 5: { token: 'PX Ice Shine', mode: ICE, lod: MID }, 6: { token: 'PX Tree Bark', lod: MID },
    7: { token: 'PX Aurora Mint', lod: MID }, 8: { token: 'PX Tree Pine Mid', lod: MID }, 9: { token: 'PX Aurora Violet', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  function glow(token, key, initial, off) { return { token: token, mode: 'glow', state: { key: key, off: off || 'PX Lamp Off', on: token, initial: initial || 0 } }; }
  /* big blocks: two tones alternating every 0.25 u course (pairs of G8 rows); lite = one tone */
  function course(a, b, lite) { return function (i, j) { return lite || !((j >> 1) & 1) ? a : b; }; }
  /* a notched ring on top of a round G8 tower centred at c (index space): every other outer cell */
  function notches(g, c, j, ch) {
    fill(g, Math.floor(c[0] - 2), Math.ceil(c[0] + 2), j, j, Math.floor(c[1] - 2), Math.ceil(c[1] + 2), function (i, jj, k) {
      var di = i - c[0], dk = k - c[1], d2 = di * di + dk * dk, inner = Math.max(Math.abs(di), Math.abs(dk)) <= 1.5 && d2 <= 2.5;
      return d2 > 4 + 1e-9 || inner || (Math.round(Math.atan2(dk, di) / (Math.PI / 4) + 8) & 1) ? null : ch;
    });
  }

  /* one penguin's layers (SLPxCharacters' own penguin when it is loaded, else a local twin of nine
     rows), every voxel on `pivot`, its chars mapped into these palettes, standing at `at` */
  function localPenguin(size) {
    var g = VX().grid({ grid: CH.heights[size % 3] / 9 });
    g.box(-2, 2, 1, 7, -2, 1, 'n').box(-1, 1, 8, 8, -2, 1, 'n').box(-1, 1, 1, 4, 1, 1, 'f').box(-2, 2, 5, 7, 1, 1, 'f');
    g.set(-1, 6, 1, 'e').set(1, 6, 1, 'e').set(0, 6, 2, 'o').box(-2, -1, 0, 0, 0, 2, 'o').box(1, 2, 0, 0, 0, 2, 'o').box(-3, -3, 2, 5, -1, 0, 'n').box(3, 3, 2, 5, -1, 0, 'n');
    return g.model({ id: 'penguin', palette: {} });
  }
  var PEN_MAP = { n: 'N', f: 'F', o: 'O', e: 'E', G: 'X' };
  function penguinLayers(size, pivot, at) {
    var C = chars(), m = C && typeof C.critterVoxels === 'function' ? C.critterVoxels('penguin', { size: size }) : null;
    if (!m) m = localPenguin(size);
    return m.layers.map(function (ly) {
      var s = ly.vox, c = new Uint8Array(s.c.length), p = new Uint8Array(s.c.length);
      for (var n = 0; n < c.length; n++) if (s.c[n]) { c[n] = (PEN_MAP[String.fromCharCode(s.c[n])] || 'N').charCodeAt(0); p[n] = 1; }
      var a = ly.at || [0, 0, 0];
      return { vox: { grid: s.grid.slice(), origin: s.origin.slice(), min: s.min.slice(), dims: s.dims.slice(), c: c, p: p, names: [null, pivot] },
               at: [at[0] + a[0], at[1] + a[1], at[2] + a[2]] };
    });
  }

  /* ================================================================
     PENGUIN CHOIR — G8 risers and podium, a G16 stand and lanterns, three penguins
     ================================================================ */
  function choirVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), m;
    CH.risers.forEach(function (r) {
      fill(o, r[0], r[1], 0, r[4] - 1, r[2], r[3], function (i, j) { return j === r[4] - 1 ? 'S' : lite || !(((i >> 1) + (j >> 1)) & 1) ? 'i' : 'j'; });
    });
    fill(o, CH.pad[0], CH.pad[1], 0, CH.pad[4] - 1, CH.pad[2], CH.pad[3], 'S');
    /* the two aurora lanterns: an ice post, a lantern cube (frosted ice by day, mint at night), a snow cap */
    CH.lamps.forEach(function (q) {
      f.box(q[0] + 1, q[0] + 1, 0, 11, q[1] + 1, q[1] + 1, 'd');
      f.box(q[0], q[0] + 2, 12, 14, q[1], q[1] + 2, 'L').box(q[0], q[0] + 2, 15, 15, q[1], q[1] + 2, 's');
      if (!lite) f.set(q[0] + 1, 16, q[1] + 1, '1');
    });
    /* the twig music stand at the front corner: a pole on two feet, a plank board with a ♪ */
    f.box(12, 12, 0, 3, 5, 5, 'k').box(11, 13, 0, 0, 5, 5, 'k');
    f.box(10, 13, 4, 7, 5, 5, 'p');
    if (!lite) {
      f.decal('+z', [10, 4, 5], [4, 4], 'note');
      f.set(11, 2, 5, '6').set(10, 3, 5, '6');                                                 /* a twig stub on the pole */
      f.box(-8, -5, 0, 0, 4, 5, '1').box(-7, -6, 1, 1, 4, 4, '1').box(1, 4, 0, 0, 3, 4, '1'); /* snow drifts at the risers' feet */
    }
    m = model('ice_choir', pal('sSijdkpNFOEX16', { L: glow('PX Aurora Mint', 'lamp', 0, 'PX Ice 2') }), [o, f],
      { pivots: { pen0: CH.pens[0], pen1: CH.pens[1], pen2: CH.pens[2] }, anchors: { spot: CH.spot } });
    CH.pens.forEach(function (at, n) { penguinLayers(n, 'pen' + n, at).forEach(function (ly) { m.layers.push(ly); }); });
    return m;
  }

  /* ================================================================
     SLEDGE RUN — one even G8 grid (tower, run, banks, drift), a G16 winch, posts and the sledge
     ================================================================ */
  /* the run's bed top at x (item metres): the deck, a curve down (eased at both ends), the bump, the runout */
  function bedY(x) {
    var r = SL.run, b = SL.bump;
    if (x <= r[0]) return SL.deckY;
    if (x < r[1]) { var u = (x - r[0]) / (r[1] - r[0]); return G8 + (SL.deckY - G8) * (1 - 0.3 * u - 0.7 * smooth(u)); }
    if (x > b[0] && x < b[1]) return G8 + b[2] * Math.sin(Math.PI * (x - b[0]) / (b[1] - b[0]));
    return G8;
  }
  /* the bed's rows for G8 column i (x = its centre) */
  function bedRows(i) { return Math.max(1, Math.round(bedY((i + 0.5) * G8) / G8)); }
  function sledVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), s = grid(G16), w = grid(G16), i;
    /* the big step and the deck: snow blocks in courses */
    fill(o, SL.step[0], SL.step[0], 0, SL.step[1] - 1, -2, 1, function (a, j) { return j === SL.step[1] - 1 ? 'T' : course('t', 'u', lite)(a, j); });
    fill(o, SL.deck[0], SL.deck[1], 0, 8, -3, 2, function (a, j) { return j === 8 ? 'T' : j === 7 ? 'I' : course('t', 'u', lite)(a, j); });
    /* the run: packed snow on a snow wedge, blue ice banks one row higher down the slope, edged in deep
       ice blue (the outline) */
    for (i = SL.deck[1] + 1; i < SL.drift[0]; i++) {
      var n = bedRows(i), bank = (i + 0.5) * G8 < SL.run[1] + G8;
      fill(o, i, i, 0, n - 1, -2, 1, function (a, j) { return j === n - 1 ? 'T' : course('u', 't', lite)(a, j); });
      if (bank) [-3, 2].forEach(function (k) { fill(o, i, i, 0, n, k, k, function (a, j) { return j === n ? 'I' : j === n - 1 ? 'j' : course('u', 't', lite)(a, j); }); });
    }
    /* the drift at the end: a heap to stop in, rounded off at MID */
    fill(o, SL.drift[0], SL.drift[1], 0, SL.drift[2] - 1, -2, 1, function (a, j, k) { return j === SL.drift[2] - 1 && (k === -2 || k === 1 || a === SL.drift[1]) ? null : 'S'; });
    /* two pennant posts at the top of the run: an aurora-violet and a mint pennant */
    [-5, 4].forEach(function (k, q) {
      f.box(-13, -13, 18, 23, k, k, 'k');
      f.box(-12, -10, 23, 23, k, k, q ? 'a' : 'v').box(-12, -11, 22, 22, k, k, q ? 'a' : 'v').set(-12, 21, k, q ? 'a' : 'v');
    });
    /* the winch behind the sledge: two posts, and a drum with a crank on the helper pivot */
    f.box(-20, -19, 18, 20, -4, -4, 'k').box(-20, -19, 18, 20, 3, 3, 'k');
    w.group('winch', function () {
      w.box(-20, -19, 21, 22, -3, 2, 'c');
      if (!lite) w.box(-20, -19, 21, 22, -2, -2, 'r').box(-20, -19, 21, 22, 1, 1, 'r').box(-19, -19, 21, 23, 4, 4, '6').set(-18, 23, 4, '6');
    });
    if (!lite) f.box(20, 21, 6, 6, -3, 2, '1').box(-7, -7, 18, 18, -6, -6, '2').box(3, 3, 9, 9, 5, 5, '2');   /* the drift's cap, glints */
    /* the sledge: a red deck on two gold runners that curl up at the front, a red backrest, a tow-rope loop.
       Lite: two rows higher, on top of the halved bed (a 0.25 u slab there) instead of sunk in it */
    var h = lite ? 2 : 0;
    s.group('sled', function () {
      s.box(11, 16, 2 + h, 2 + h, -3, -3, 'y').box(11, 16, 2 + h, 2 + h, 2, 2, 'y').box(17, 17, 3 + h, 3 + h, -3, -3, 'y').box(17, 17, 3 + h, 3 + h, 2, 2, 'y');
      s.box(11, 16, 3 + h, 3 + h, -3, 2, 'R');
      s.box(11, 11, 4 + h, 4 + h, -3, 2, 'R');
      if (!lite) s.box(10, 10, 3, 3, -1, 0, 'r');
    });
    return model('ice_sled', pal('sStTujIkrcyRav126', { R: 'PX Jungle Parrot Red' }), [o, f, w, s], {
      pivots: { sled: [SL.foot, G8, 0], winch: SL.winch },
      anchors: { top: [SL.top, SL.deckY, 0], foot: [SL.foot, G8, 0], spot: SL.spot, seat: SL.seat.concat('sled') }
    });
  }

  /* ================================================================
     ICE RINK — one even G8 grid (banks and pond), G8 pines, G16 bench, lanterns and scratches
     ================================================================ */
  function inPond(i, k) { var x = (i + 0.5) / RK.a, z = (k + 0.5) / RK.b; return x * x + z * z <= 1; }
  /* a figure-of-eight of skate scratches over the ice: on two rings round the loops' centres (G16 cell
     centres, item metres), with gaps so it reads as scratched lines */
  function scratch(x, z) {
    var r = 0.24, d = Math.min(Math.abs(Math.hypot(x - 0.3125, z) - r), Math.abs(Math.hypot(x + 0.3125, z) - r));
    return d < 0.035 && ((Math.floor(x / G16) + Math.floor(z / G16)) & 3) !== 0;
  }
  function rinkVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), ice = grid(G16), f = grid(G16), i, k, anchors = { spot: RK.spot };
    for (k = -7; k <= 6; k++) for (i = -7; i <= 6; i++) {
      if (inPond(i, k)) {
        /* the pond on the fine grid: two rows of ice, its top scratched (a flush colour, not a ridge) */
        for (var q = 0; q < 4; q++) {
          var a = 2 * i + (q & 1), b = 2 * k + (q >> 1);
          ice.set(a, 0, b, 'j').set(a, 1, b, !lite && scratch((a + 0.5) * G16, (b + 0.5) * G16) ? 'x' : 'i');
        }
        continue;
      }
      /* the bank's top: snow, with a ring of deep ice blue round the pond (the rink's outline) */
      var rim = inPond(i - 1, k) || inPond(i + 1, k) || inPond(i, k - 1) || inPond(i, k + 1);
      o.set(i, 0, k, lite || !(((i >> 1) + (k >> 1)) & 1) ? 't' : 'u').set(i, 1, k, rim ? 'I' : 'T');
    }
    /* two snowy pines on the back corners (G16): a trunk, three tiers narrowing to a tip, snow on each (MID) */
    RK.pines.forEach(function (c) {
      var at = [c[0] / G16 - 0.5, c[1] / G16 - 0.5];
      f.lathe([[0.75, 4, 5, 'k'], [3.2, 6, 6, 'g'], [3.2, 7, 7, 'S'], [2.2, 8, 8, 'G'], [2.2, 9, 9, 'S'], [1.6, 10, 10, 'g'], [1.6, 11, 11, 'S'], [0.75, 12, 12, 'G'], [0.75, 13, 13, 'S']], { at: at });
    });
    /* the bench between them, on the back bank, facing the ice */
    f.box(-3, 2, 6, 6, -12, -11, 'p').box(-3, -3, 4, 5, -12, -11, 'k').box(2, 2, 4, 5, -12, -11, 'k');
    if (!lite) f.box(-3, 2, 8, 8, -13, -13, '6').box(-3, -3, 7, 7, -13, -13, '6').box(2, 2, 7, 7, -13, -13, '6');
    /* eight lanterns on the banks: a barrier post (coral or sky), a lantern cube and a cap in the post's colour */
    RK.lamps.forEach(function (q, n) {
      var x = 2 * q[0] + 1, z = 2 * q[1] + 1, y = 4 + RK.postH, ch = RK.posts.charAt(n);
      f.box(x, x, 4, y - 1, z, z, ch).box(x, x + 1, y, y + 1, z, z + 1, 'L').box(x, x + 1, y + 2, y + 2, z, z + 1, ch);
    });
    if (!lite) f.box(-12, -11, 4, 4, 9, 10, '1').box(10, 11, 4, 4, 9, 9, '1');                    /* snow heaps on the front bank */
    RK.laps.forEach(function (p, n) { anchors['lap' + n] = [p[0], RK.ice, p[1]]; });
    return model('ice_rink', pal('sStTuijxIkpcgG16', { B: 'PX Sky Blue', L: glow('PX Ice Hut Glow', 'lamps', 0, 'PX Bulb Warm') }), [o, ice, f], { anchors: anchors });
  }

  /* ================================================================
     SKI LIFT — the cable loop, two wheels, the station roof, the pylon and deck, three chairs
     ================================================================ */
  /* the loop: s = 0 at the station wheel's front point, up the front strand, round the pylon wheel,
     down the back strand, round the station wheel → out {x, y, z (on the cable), yaw (deg: the way
     a chair faces, 0 = +x; + 360 a lap so it never jumps)} */
  var LOOP = null;
  function loopLen() {
    if (LOOP) return LOOP;
    var dx = LF.hi[0] - LF.lo[0], dy = LF.hi[1] - LF.lo[1], D = Math.sqrt(dx * dx + dy * dy), A = Math.PI * LF.r;
    return (LOOP = { D: D, A: A, L: 2 * D + 2 * A });
  }
  function liftAt(s, out) {
    out = out || {};
    var Q = loopLen(), r = LF.r, lap = Math.floor(s / Q.L), u = s - lap * Q.L, f, a;
    if (u < Q.D) { f = u / Q.D; out.x = LF.lo[0] + (LF.hi[0] - LF.lo[0]) * f; out.y = LF.lo[1] + (LF.hi[1] - LF.lo[1]) * f; out.z = r; out.yaw = 0; }
    else if (u < Q.D + Q.A) { a = (u - Q.D) / r; out.x = LF.hi[0] + r * Math.sin(a); out.y = LF.hi[1]; out.z = r * Math.cos(a); out.yaw = a / DEG; }
    else if (u < 2 * Q.D + Q.A) { f = (u - Q.D - Q.A) / Q.D; out.x = LF.hi[0] - (LF.hi[0] - LF.lo[0]) * f; out.y = LF.hi[1] - (LF.hi[1] - LF.lo[1]) * f; out.z = -r; out.yaw = 180; }
    else { a = (u - 2 * Q.D - Q.A) / r; out.x = LF.lo[0] - r * Math.sin(a); out.y = LF.lo[1]; out.z = -r * Math.cos(a); out.yaw = 180 + a / DEG; }
    out.yaw += 360 * lap;
    return out;
  }
  /* chair n's place on the loop at rest: a third of the loop apart, c0 at the station */
  function chairRest(n) { return n * loopLen().L / 3; }
  /* a horizontal pulley on the centred G16 grid (row j = the cable's height) round the post at index
     ci: a grey disc with a coral cross (so its turn shows) on the top of its static post */
  function wheel(g, name, ci, j, lite) {
    g.group(name, function () {
      g.disc(ci, j, 0, 2.5, 'y', function (i, jj, k) { return !lite && (i === ci || k === 0) ? 'c' : 'n'; });
    });
  }
  function liftVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), c16 = grid(G16, true, 0.5), cab = VX().grid({ grid: [G8, G16, G16], origin: [0.5, 0.5, 0.5] });
    var H = LF.hut, wb = grid(G16, true, 0.5), wt = grid(G16, true, 0.5), layers, pivots = {}, cs = [], n, jb = LF.lo[1] / G16, jt = LF.hi[1] / G16;
    /* the two strands on the fine grid (an unbroken staircase: each column spans the rows the cable
       crosses there): up at the front, down at the back */
    [4, -4].forEach(function (k) {
      for (var i = LF.lo[0] / G8; i <= LF.hi[0] / G8; i++) {
        var a = Math.max(i - 0.5, LF.lo[0] / G8), b = Math.min(i + 0.5, LF.hi[0] / G8), s0 = (jt - jb) / ((LF.hi[0] - LF.lo[0]) / G8);
        cab.box(i, i, Math.round(jb + (a - LF.lo[0] / G8) * s0), Math.round(jb + (b - LF.lo[0] / G8) * s0), k, k, 'n');
      }
    });
    /* the station hut: plank walls, a door and a warm window, a snow roof the chairs pass over */
    fill(o, H[0], H[1], 0, H[4] - 1, H[2], H[3], function (a, j, k) { return !lite && (a === H[0] || a === H[1]) && (k === H[2] || k === H[3]) ? 'k' : 'p'; });
    fill(o, H[0], H[1], H[4], H[4], H[2], H[3], 'S');
    o.box(-9, -8, 0, 1, H[3], H[3], 'D').set(-7, 1, H[3], 'W');
    /* the pulley's post on the roof and its wheel; skis leaning on the hut */
    c16.box(-16, -16, 8, jb - 1, 0, 0, 'n');
    wheel(wb, 'cable', -16, jb, lite);
    if (!lite) f.line([-8, 0, -1], [-10, 5, -1], '3').line([-8, 0, 0], [-10, 5, 0], '4');
    /* the pylon: a snow mound, a G16 lattice tower, a plank landing deck, the head post, its wheel and hat */
    fill(o, 5, 10, 0, 0, -3, 2, 'S');
    fill(o, 6, 9, 1, 1, -2, 1, 'S');
    [[13, -3], [18, -3], [13, 2], [18, 2]].forEach(function (q) { f.box(q[0], q[0], 4, 23, q[1], q[1], 'e'); });
    [8, 15, 23].forEach(function (n2) {
      var bar = n2 === 15 ? 'E' : 'e';
      if (!lite || n2 === 23) f.box(14, 17, n2, n2, -3, -3, bar).box(14, 17, n2, n2, 2, 2, bar).box(13, 13, n2, n2, -2, 1, bar).box(18, 18, n2, n2, -2, 1, bar);
    });
    if (!lite) [[4, 8], [9, 15], [16, 22]].forEach(function (q) { f.line([14, q[0], -3], [17, q[1] - 1, -3], 'E'); f.line([14, q[0], 2], [17, q[1] - 1, 2], 'E'); });
    /* the landing deck under the top of the ride (low enough that no chair, bobbing, ever brushes it) */
    fill(o, 7, 9, 12, 12, -3, 2, 'p');
    if (!lite) f.box(19, 19, 26, 26, -6, 5, '6').box(14, 18, 26, 26, -6, -6, '6').box(14, 18, 26, 26, 5, 5, '6');   /* the deck's rail */
    c16.box(16, 16, 26, jt - 1, 0, 0, 'n');
    wheel(wt, 'wheel', 16, jt, lite);
    if (!lite) f.box(15, 15, jt + 1, jt + 5, -1, -1, '6').box(16, 17, jt + 3, jt + 5, -1, -1, '3');      /* a little pennant on the pylon's wheel */
    /* three open two-seat chairs, each on its own pivot at its grip on the cable (facing the way it goes),
       all in their own colour: a tall backrest, the seat and (MID) two arms */
    layers = [o, f, c16, cab, wb, wt];
    LF.chairs.forEach(function (col, k) {
      var g = grid(G16, true, 0.5), name = 'c' + k, p = liftAt(chairRest(k), {});
      g.group(name, function () {
        if (!lite) g.box(1, 2, -5, -5, -2, -2, LF.arms[k]).box(1, 2, -5, -5, 2, 2, LF.arms[k]);                  /* two arms */
        g.set(0, 1, 0, 'n').set(0, -1, 0, 'n').set(0, -2, 0, 'n');                                               /* the clamp round the cable, the hanger */
        if (lite) g.set(0, -3, 0, 'n'); else g.box(0, 0, -3, -3, -2, 2, col);                                    /* the hanger's foot | the backrest's top */
        g.box(0, 0, -6, -4, -2, 2, col).box(0, 2, -7, -7, -2, 2, col);                                           /* backrest and seat */
      });
      g.rotY90(p.yaw >= 90 && p.yaw < 270 ? 2 : 0);
      layers.push([g, [p.x, p.y, p.z]]);
      pivots[name] = [p.x, p.y, p.z];
      cs.push(p);
    });
    pivots.cable = [LF.lo[0], LF.lo[1], 0]; pivots.wheel = [LF.hi[0], LF.hi[1], 0];
    return model('ice_skilift', pal('sSkpcnmyD1346', { W: 'PX Ice Hut Glow', e: 'PX Ice Deep', E: { token: 'PX Ice Deep', lod: MID }, Z: { token: 'PX Mint', lod: MID } }), layers,
      { pivots: pivots, anchors: { foot: LF.foot, spot: LF.spot, seat: [cs[0].x + LF.seatX, cs[0].y - LF.pan, cs[0].z, 'c0'] } });
  }

  /* ================================================================
     ICE CASTLE — one even G8 grid (keep, towers, gate arch, lantern rows), G16 grille and pennants
     ================================================================ */
  var ROWS = 'ABCQ';
  function castleVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), gr = grid(G16), K = CA.keep, i, j, top = CA.towerH;
    function ice(n) { return function (a, jj) { return lite || !(((jj / n) | 0) & 1) ? 'i' : 'j'; }; }
    /* the keep: a solid block of ice courses, a snow roof inside a notched parapet (merlons in pairs, deep
       ice blue: the outline) */
    fill(o, K[0], K[1], 0, CA.keepH - 1, K[0], K[1], function (a, jj, k) {
      /* lite: the top course is the outline (the halved model loses the one-row merlons) */
      return lite && jj === CA.keepH - 1 && (a === K[0] || a === K[1] || k === K[0] || k === K[1]) ? 'I' : ice(CA.course)(a, jj);
    });
    fill(o, K[0] + 1, K[1] - 1, CA.keepH - 1, CA.keepH - 1, K[0] + 1, K[1] - 1, 'S');
    fill(o, K[0], K[1], CA.keepH, CA.keepH, K[0], K[1], function (a, jj, k) {
      return (a === K[0] || a === K[1] || k === K[0] || k === K[1]) && (((a + 8) >> 1) + ((k + 8) >> 1)) & 1 ? 'I' : null;
    });
    /* four round towers: ice courses under an aurora-violet or mint cap (a band and its notched rim), a
       snow floor, snow on each merlon (MID) */
    CA.towers.forEach(function (c, n) {
      var cap = CA.caps.charAt(n);
      o.lathe([[2, 0, top - 1 - CA.capRows, ice(CA.towerCourse)], [2, top - CA.capRows, top - 1, cap]], { at: c });
      fill(o, c[0] - 0.5, c[0] + 0.5, top - 1, top - 1, c[1] - 0.5, c[1] + 0.5, 'S');
      notches(o, c, top, cap);
      if (!lite) notches(o, c, top + 1, '1');
    });
    /* warm windows (PX Ice Hut Glow, by day as well) in the front towers, facing out */
    CA.windows.forEach(function (q) { for (j = CA.win[0]; j <= CA.win[1]; j++) o.set(q[0], j, q[1], 'W'); });
    /* the gate: an arched opening into a dark hall */
    for (j = 0; j <= 5; j++) for (i = -2; i <= 1; i++) {
      if (j === 5 && (i === -2 || i === 1)) continue;
      o.clear(i, j, K[1]).clear(i, j, K[1] - 1);
      o.set(i, j, K[1] - 2, 'D');
    }
    /* the lantern blocks, set in the walls in four rows: beside the gate (and above it from row 2),
       two on each side, two at the back */
    CA.rows.forEach(function (jj, r) {
      var c = ROWS.charAt(r);
      [-3, 2].forEach(function (a) { o.set(a, jj, K[1], c).set(a, jj, K[0], c); });
      [-2, 1].forEach(function (k) { o.set(K[0], jj, k, c).set(K[1], jj, k, c); });
      if (r >= 2) o.set(-1, jj, K[1], c).set(0, jj, K[1], c);
    });
    /* the grille: dark iron bars in the gate on 'gate' (it slides up inside the wall), so the gate reads as
       a dark door. Lite: the middle bars only (the halved keep's opening is one 0.25 u block wide) */
    gr.group('gate', function () {
      gr.box(-1, 0, 0, 11, 8, 8, 'K');
      if (!lite) gr.box(-3, -3, 0, 9, 8, 8, 'K').box(2, 2, 0, 9, 8, 8, 'K').box(-4, 3, 3, 3, 8, 8, '0').box(-4, 3, 7, 7, 8, 8, '0');
    });
    /* mint and violet pennants on the two back towers */
    [[-10, -10, 'a'], [9, -10, 'v']].forEach(function (p, side) {
      f.box(p[0], p[0], 2 * top, 2 * top + 7, p[1], p[1], 'k');
      f.box(side ? p[0] - 3 : p[0] + 1, side ? p[0] - 1 : p[0] + 3, 2 * top + 4, 2 * top + 7, p[1], p[1], p[2]);
      if (!lite) f.box(side ? p[0] - 4 : p[0] + 4, side ? p[0] - 4 : p[0] + 4, 2 * top + 5, 2 * top + 6, p[1], p[1], side ? '9' : '7');
    });
    return model('ice_castle', pal('sSijIDkav0179', { K: 'PX Castle Iron', W: 'PX Ice Hut Glow',
      A: glow('PX Aurora Mint', 'row0'), B: glow('PX Aurora Sky', 'row1'), C: glow('PX Aurora Violet', 'row2'), Q: glow('PX Ice Hut Glow', 'row3')
    }), [o, f, gr], { pivots: { gate: CA.gate }, anchors: { spot: CA.spot, turret: CA.turret } });
  }

  /* ================================================================
     SNOW FORT — one even G8 grid (walls, turret), G16 floor and snowballs, pole and pennant
     ================================================================ */
  function fortVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), fl = grid(G16), W = FO.wall, c = FO.turret, i, j, k, L = look();
    function tone(a, jj, b) { return lite || !(((a >> 1) + (b >> 1) + (jj >> 1)) & 1) ? 'S' : 't'; }
    /* the walls: two voxels thick, snow blocks under a notched top of ice-blue merlons (the outline) */
    for (j = 0; j <= FO.wallH; j++) for (k = W[0]; k <= W[1]; k++) for (i = W[0]; i <= W[1]; i++) {
      if (!(i <= W[0] + 1 || i >= W[1] - 1 || k <= W[0] + 1 || k >= W[1] - 1)) continue;
      if (j === FO.wallH && (((i >> 1) + (k >> 1)) & 1)) continue;
      o.set(i, j, k, j === FO.wallH ? 'I' : tone(i, j, k));
    }
    /* the arched doorway in the front wall, framed in ice blocks */
    for (j = 0; j <= 3; j++) for (i = -2; i <= 1; i++) { if (j === 3 && (i === -2 || i === 1)) continue; o.clear(i, j, W[1]).clear(i, j, W[1] - 1); }
    FO.arch.forEach(function (q) { o.set(q[0], q[1], W[1], 'I'); });
    /* ice-block windows: either side of the door and one in each side wall (right through the wall) */
    FO.windows.forEach(function (q) {
      for (j = q[2]; j <= q[2] + 1; j++) for (var t = 0; t < 2; t++) {
        if (q[0] === 'x') o.set(q[1], j, W[1] - t, 'I'); else o.set(q[0] === 'l' ? W[0] + t : W[1] - t, j, q[1], 'I');
      }
    });
    /* the round turret, back-right, above the walls: a snow floor, three ice merlons (the pennant runs
       past the fourth's place), snow on them (MID) */
    o.lathe([[2.5, 0, FO.turretH - 1, tone]], { at: c });
    fill(o, c[0] - 1, c[0] + 1, FO.turretH - 1, FO.turretH - 1, c[1] - 1, c[1] + 1, 'S');
    fill(o, c[0] - 2, c[0] + 2, FO.turretH, FO.turretH + 1, c[1] - 2, c[1] + 2, function (a, jj, b) {
      var di = a - c[0], dk = b - c[1], d2 = di * di + dk * dk;
      if (d2 > 6.25 || d2 <= 2.25 || ((di + dk) & 1) || (di === 0 && dk === -2)) return null;
      return jj === FO.turretH ? 'I' : lite ? null : '1';
    });
    /* the packed-snow floor inside; a stack of aurora-violet snowballs in the back-left corner, and a
       violet and a mint one either side of the door outside (stacked, never thrown) */
    fill(fl, -8, 7, 0, 0, -8, 7, function (a, jj, b) { return a >= 3 && b <= -4 ? null : 'u'; });
    [[-8, -8], [-6, -8], [-8, -6]].forEach(function (p) { fl.box(p[0], p[0] + 1, 1, 2, p[1], p[1] + 1, 'v'); });
    fl.box(-7, -6, 3, 4, -7, -6, 'v');
    [[-8, 'v'], [4, 'a']].forEach(function (q) { fl.box(q[0], q[0] + 1, 0, 1, 12, 13, q[1]).box(q[0] + 2, q[0] + 3, 0, 1, 12, 13, q[1]).box(q[0] + 1, q[0] + 2, 2, 3, 12, 13, q[1]); });
    /* bunting along the front wall on two posts over the merlons: a coral and white striped line, a
       coral pennant under each coral stripe (stripes in pairs, so the halved model keeps them) */
    FO.bunting.posts.forEach(function (x) { f.box(x, x, 12, FO.bunting.y, 10, 10, 'k'); });
    for (i = FO.bunting.posts[0] + 1; i < FO.bunting.posts[1]; i++) {
      var q = i - FO.bunting.posts[0], coral = !((q >> 1) & 1);
      f.set(i, FO.bunting.y, 10, coral ? 'c' : 'w');
      if (coral) f.set(i, FO.bunting.y - 1, 10, 'c');
      if (coral && !(q & 1)) f.set(i, FO.bunting.y - 2, 10, 'c');
    }
    /* the pole in a notch of the turret, and the pennant (member colour, a snowflake) on 'flag' */
    f.box(11, 11, 14, 21, -13, -13, 'k');
    f.group('flag', function () { f.box(7, 10, 18, 21, -13, -13, 'M'); if (!lite) f.set(6, 19, -13, 'M').set(6, 20, -13, 'M'); });
    if (!lite) f.decal('+z', [7, 18, -13], [4, 4], 'snowflake').decal('-z', [7, 18, -13], [4, 4], 'snowflake');
    return model('ice_fort', pal('sStuIkavcw1', { M: { token: (L && L.MEMBER_FALLBACK) || 'Bubblegum', member: true } }), [o, fl, f], {
      pivots: { flag: FO.flag }, anchors: { in0: FO.in0, in1: FO.in1, turret: FO.turretAt }
    });
  }

  /* ================================================================
     ICE SLIDE — one even G8 grid (steps, platform, ramp), G16 rails, flags and glints
     ================================================================ */
  function slideVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), f = grid(G16), P = IS.platform, ice = course('i', 'j', lite);
    /* two big snow-block steps at the back */
    IS.steps.forEach(function (q) { fill(o, q[0], q[0], 0, q[1] - 1, -2, 1, function (a, jj) { return jj === q[1] - 1 ? 'S' : 'T'; }); });
    /* the platform: an ice-block tower under a snow deck, an ice-blue course round its top (the outline) */
    fill(o, P[0], P[1], 0, P[2] - 1, -3, 2, function (a, jj) { return jj === P[2] - 1 ? 'S' : jj === P[2] - 2 ? 'I' : ice(a, jj); });
    /* the ramp: a solid ice-block wedge, its chute deep ice blue, a candy-striped coral and white rim one
       row higher (stripes two columns wide, so the halved model keeps them) */
    IS.ramp.forEach(function (n, c) {
      var i = P[1] + 1 + c, rim = (c >> 1) & 1 ? 'w' : 'c';
      fill(o, i, i, 0, n - 1, -2, 1, function (a, jj) { return jj === n - 1 ? 'd' : ice(a, jj); });
      [-3, 2].forEach(function (k) { fill(o, i, i, 0, n, k, k, function (a, jj) { return jj === n ? rim : ice(a, jj); }); });
      if (!lite && c % 3 === 1) f.set(2 * i + 1, 2 * n, (c & 2) - 1, '2');                                   /* a glint on the bed */
    });
    /* candy rails round the platform: four coral posts, white bars at the back and along both sides */
    [[-10, -6], [-10, 5], [-7, -6], [-7, 5]].forEach(function (p) { f.box(p[0], p[0], 20, 23, p[1], p[1], 'c'); });
    f.box(-10, -10, 23, 23, -5, 4, 'w').box(-9, -8, 23, 23, -6, -6, 'w').box(-9, -8, 23, 23, 5, 5, 'w');
    f.box(-9, -8, 24, 25, -6, -6, 'y').box(-9, -8, 24, 25, 5, 5, 'v');                                          /* two flags */
    if (!lite) f.box(12, 13, 2, 2, -4, 3, '1');                                                                  /* a snow lip at the foot */
    return model('ice_slide', pal('sSTijdIcwyv12'), [o, f], { anchors: { top: IS.top, foot: IS.foot } });
  }

  var BUILD = { ice_choir: choirVoxels, ice_sled: sledVoxels, ice_rink: rinkVoxels, ice_skilift: liftVoxels, ice_castle: castleVoxels,
                ice_fort: fortVoxels, ice_slide: slideVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses with their accents (no tones, trims, decals or decor), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     PURE ANIMATION HELPERS (exported for the Node tests)
     ================================================================ */
  /* how far the night has come on for a lantern: 0 by day, 1 from dusk (show 0.65) on */
  function nightOf(k) { return smooth(((+k || 0) - 0.35) / 0.3); }
  /* how far penguin n stretches at sing time t: a half-sine hump on each of its notes (the notes go
     low, middle, high, twice), and half as much for the chord at the end */
  function singAt(n, t) {
    var v = 0, h = CH.hold;
    for (var q = n; q < CH.notes.length; q += 3) { var u = (t - CH.notes[q]) / CH.note; if (u > 0 && u < 1) v = Math.max(v, Math.sin(Math.PI * u)); }
    return Math.max(v, CH.chord * smooth((t - h[0]) / (h[1] - h[0])) * (1 - smooth((t - h[2]) / (h[3] - h[2]))));
  }
  /* the sledge at haul c and descent d (SLMotion 'slide' climb, slide) → out {x, y (its runners' foot),
     pitch (deg), hop}: up the run as it is hauled, back down it, a hop over the bump on the way down */
  function sledAt(c, d, out) {
    out = out || {};
    var u = clamp01(c) - clamp01(d), x = SL.foot + (SL.top - SL.foot) * u, e = 0.02, h = 0, v;
    if (d > 0 && x > SL.hopAt[0] && x < SL.hopAt[1]) { v = (x - SL.hopAt[0]) / (SL.hopAt[1] - SL.hopAt[0]); h = SL.hop * Math.sin(Math.PI * v); }
    out.x = x; out.hop = h; out.y = bedY(x) + h;
    out.pitch = Math.atan2(bedY(x + e) - bedY(x - e), 2 * e) / DEG;
    return out;
  }
  /* XYZ Euler angles in degrees (the kit's setPivot order) of R = Ry(yaw) · Rx(pitch) · Rz(roll) */
  function eulerYXZ(yaw, pitch, roll, out) {
    out = out || [0, 0, 0];
    var a = yaw * DEG, b = pitch * DEG, c = roll * DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    var m13 = sa * cb;
    if (Math.abs(m13) < 0.9999999) {
      out[0] = Math.atan2(sb, ca * cb) / DEG; out[1] = Math.asin(m13) / DEG; out[2] = Math.atan2(ca * sc - sa * sb * cc, ca * cc + sa * sb * sc) / DEG;
    } else {
      out[0] = Math.atan2(sa * sc + ca * sb * cc, cb * cc) / DEG; out[1] = m13 > 0 ? 90 : -90; out[2] = 0;
    }
    for (var n = 0; n < 3; n++) if (Math.abs(out[n]) < 1e-9) out[n] = 0;
    return out;
  }
  /* which way a toggle goes: an explicit name says; the CATALOG act goes away from what the copy
     shows — or, when the lit memory already differs from that (the host flipped it first), to it */
  function wantOn(name, spec, shown, lit) {
    if (spec.on.indexOf(name) >= 0) return true;
    if (spec.off.indexOf(name) >= 0) return false;
    return lit == null || !!lit === !!shown ? !shown : !!lit;
  }
  /* the castle's gate for the lights level k: it opens over the first CA.open of the climb, and on
     the way down it closes with the last of the light */
  function gateOf(k, on) { return on ? smooth(k / CA.open) : smooth(k); }

  /* ================================================================
     FACTORY — SL3D.defineVox('ice-b', K → {id: {voxels, lod1, act, forget, idle?, show?, lit?, animated?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], EP = [0, 0, 0], _e = [0, 0, 0], _p = {}, _r = {}, _s = {};
    function pose(a, name, rx, ry, rz, x, y, z, sx, sy, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z; S3[0] = sx == null ? 1 : sx; S3[1] = sy == null ? 1 : sy; S3[2] = sz == null ? 1 : sz;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    function emit(a, kind, at, n) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n); } catch (e) { /* fx is optional */ } } }
    function tierOf(a) { return (a && a.template && a.template.tier) || 'MID'; }
    function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
    function litOf(a) { return a && (typeof a.lit === 'boolean' || typeof a.lit === 'number') ? +a.lit >= 0.5 : null; }
    /* the pet's part (the crew owns it: a generic seat / trail / stand perform, or a named kind) */
    function askPet(a, id) {
      var p = a.pets;
      if (!p || typeof p.perform !== 'function') return;
      try { p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { /* no crew yet */ }
    }
    /* the active pet's 'voice' step (SLSound.VOICE_STEPS), or -1 with no pet */
    function voiceStep(a) {
      var p = a.pets, pet = null, S = snd();
      try { pet = p && typeof p.active === 'function' ? p.active() : null; } catch (e) { pet = null; }
      if (typeof pet !== 'string') return -1;
      return S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : VOICE4.indexOf(pet);
    }
    /* per-copy memory: the lift's place on its loop (s) and its wheels' turn (w), a toggle's state (on),
       a lantern's level (lamp), a still idle. A remount or a restyle hands the handle a new batch:
       the memory starts again; forget(uid) drops it with the copy */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, s: 0, w: 0, on: null, lamp: -1, still: false }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me, m), end(a, me, m) (the pose it is left in), start?(a, me, m), fold?(me, m) (keep where a
       superseded or cancelled act got to), at?(cue, me) (where its fx go), pet?(on)}; tl {name, off} */
    function run(a, id, spec, tl) {
      tl = tl || { name: ACT[id], off: false };
      var name = tl.name;
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var m = mem(a), prev = live.get(a.uid), reduced = !!a.reduced;
      var o = { reduced: reduced, from: prev && !prev.done && !reduced && prev.name === name ? M.carry(name, prev.out) : null };
      if (tl.off) o.off = true;
      if (prev) prev.stop(m, true);
      var dur = M.durOf(name, o), cues = M.cues(name, o), ci = 0, uid = a.uid;
      var me = { name: name, dur: dur, out: {}, reduced: reduced, on: !tl.off, mark: 0, copy: m.copy, done: false };
      live.set(uid, me);
      if (spec.start) spec.start(a, me, m);
      if (!spec.pet || spec.pet(me.on)) askPet(a, id);
      me.stop = function (mm, fold) {
        if (me.done) return;
        me.done = true;
        if (live.get(uid) === me) live.delete(uid);
        if (fold && spec.fold && mm && mm.copy === me.copy) spec.fold(me, mm);
      };
      me.update = function (h, tAct) {
        if (me.done) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur, mm = mem(h);
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, (spec.at && spec.at(c, me)) || 'top', c.n || 1);
            else if (typeof h.sfx !== 'function') continue;
            else if (!c.pet) h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
            else if (voiceStep(h) >= 0) h.sfx('voice', c.vol == null ? 1 : c.vol, voiceStep(h));
          } catch (e) { /* a cue never stops its act */ }
        }
        spec.apply(h, me.out, tt, me, mm);
        if (t < dur) return true;
        me.stop(mm, false);
        spec.end(h, me, mm);
        return false;
      };
      me.cancel = function () {
        if (me.done) return;
        var mm = mem(a);
        me.stop(mm, true);
        try { if (spec.fold) spec.end(a, null, mm); else spec.end(a, me, mm); } catch (e) { /* the copy is gone */ }
      };
      return me;
    }

    /* ---------- penguin choir: sway, each stretches on its note (♪ over it), the chord; lanterns at night ---------- */
    var choirSpec = {
      apply: function (a, out, t, me) {
        var sw = me.reduced ? 0 : CH.sway * num(out.swing);
        for (var n = 0; n < 3; n++) {
          var v = me.reduced ? 0 : singAt(n, t), sq = 1 - 0.3 * CH.stretch * v;
          pose(a, 'pen' + n, 0, 0, sw, 0, CH.lift * v, 0, sq, 1 + CH.stretch * v, sq);
        }
        for (; !me.reduced && me.mark < CH.notes.length && t >= CH.notes[me.mark]; me.mark++) {
          var q = me.mark % 3, p = CH.pens[q];
          EP[0] = p[0]; EP[1] = p[1] + CH.heights[q] + 0.12; EP[2] = p[2];
          emit(a, 'note', EP, 1);
        }
      },
      end: function (a) { for (var n = 0; n < 3; n++) rest(a, 'pen' + n); }
    };
    function lampShow(key) {
      return function (a, k) {
        if (!a) return;
        var m = mem(a), v = Math.round(20 * nightOf(arguments.length > 1 ? k : a.show)) / 20;
        if (v !== m.lamp) { m.lamp = v; setState(a, key, v); }
      };
    }

    /* ---------- sledge run: hauled up by the winch, down the run, a hop and a puff of snow at the bump ---------- */
    var sledSpec = {
      at: function () { return 'foot'; },
      apply: function (a, out, t, me) {
        var c = me.reduced ? 1 : num(out.climb), d = me.reduced ? 1 : num(out.slide);
        sledAt(c, d, _s);
        pose(a, 'sled', 0, 0, _s.pitch, _s.x - SL.foot, _s.y - G8, 0);
        pose(a, 'winch', 0, 0, -360 * SL.turns * (clamp01(c) - clamp01(d)), 0, 0, 0);
        if (!me.reduced && d > 0 && me.mark === 0 && _s.x >= SL.puff[0]) { me.mark = 1; emit(a, 'snow', SL.puff, 6); }
        if (!me.reduced && d >= 0.98 && me.mark === 1) { me.mark = 2; emit(a, 'snow', SL.drift3, 4); }
      },
      end: function (a) { rest(a, 'sled'); rest(a, 'winch'); }
    };

    /* ---------- ice rink: scratch lines behind the pet as it passes each point of the eight ---------- */
    var rinkSpec = {
      at: function (c, me) { return c.emit === 'trail' ? 'lap' + Math.max(0, me.mark - 1) : 'top'; },
      apply: function (a, out, t, me) {
        var n = me.reduced ? 0 : Math.min(8, Math.floor(8 * num(out.lap) + 1e-9));
        for (; me.mark < n; me.mark++) if (me.mark % 2) emit(a, 'trail', 'lap' + (me.mark % 8), 1);
      },
      end: function () { /* nothing on the rink moves */ }
    };

    /* ---------- ski lift: the loop runs until c0 is at the top; the chairs bob; the wheels turn ---------- */
    var Q = loopLen(), idl = (LOOKS.ice_skilift && LOOKS.ice_skilift.idle) || { deg: LF.sway, period: LF.swayPeriod, tiers: ['MID', 'HIGH'] };
    function liftPose(a, m, s, bob, sway) {
      for (var n = 0; n < 3; n++) {
        liftAt(chairRest(n) + s, _p); liftAt(chairRest(n), _r);
        eulerYXZ(_p.yaw - _r.yaw, 0, sway, _e);
        pose(a, 'c' + n, _e[0], _e[1], _e[2], _p.x - _r.x, _p.y - _r.y + bob, _p.z - _r.z);
      }
      var w = ((m.w + s / LF.r / DEG) % 360 + 360) % 360;
      pose(a, 'cable', 0, w, 0, 0, 0, 0); pose(a, 'wheel', 0, w, 0, 0, 0, 0);
    }
    /* where an act or the idle leaves the lift: s back into [0, L); the wheels keep their turn */
    function settle(m, s) {
      var lap = Math.floor(s / Q.L);
      m.w = ((m.w + lap * Q.L / LF.r / DEG) % 360 + 360) % 360;
      m.s = s - lap * Q.L;
    }
    var liftSpec = {
      start: function (a, me, m) { me.s0 = m.s; me.ride = (m.s <= Q.D + 1e-9 ? 0 : Q.L) + Q.D - m.s; me.s = m.s; },
      apply: function (a, out, t, me, m) {
        me.s = me.s0 + me.ride * (me.reduced ? 1 : clamp01(num(out.k)));
        liftPose(a, m, me.s, me.reduced ? 0 : LF.bob * num(out.swing), 0);
      },
      fold: function (me, m) { settle(m, me.s); },
      end: function (a, me, m) { if (me) settle(m, me.s); m.still = false; liftPose(a, m, m.s, 0, 0); }
    };
    /* after a ride the lift runs on at its cruising speed until c0 is home; chairs sway on MID / HIGH */
    function liftIdle(a) {
      if (!a) return false;
      var m = mem(a), swayOn = !a.reduced && (idl.tiers || ['MID', 'HIGH']).indexOf(tierOf(a)) >= 0, dt = Math.min(0.1, Math.max(0, num(a.dt)));
      if (live.get(a.uid)) return true;                                    /* the act owns the chairs */
      if (a.reduced) { if (m.still) return false; m.still = true; liftPose(a, m, m.s, 0, 0); return true; }
      var home = m.s <= 1e-9;
      if (!home) {
        var s = m.s + Q.D / LF.cruise * dt;
        if (s >= Q.L) { settle(m, Q.L); m.s = 0; } else m.s = s;
      }
      if (home && !swayOn) { if (m.still) return false; m.still = true; liftPose(a, m, m.s, 0, 0); return true; }
      m.still = false;
      liftPose(a, m, m.s, 0, swayOn ? (idl.deg || LF.sway) * Math.sin(TAU * (num(a.t) / (idl.period || LF.swayPeriod) + num(a.phase))) : 0);
      return true;
    }

    /* ---------- ice castle: the gate slides up and the lantern rows light bottom-up; dims in 0.4 s ---------- */
    function castlePose(a, k, on) {
      for (var r = 0; r < 4; r++) setState(a, 'row' + r, M && typeof M.part === 'function' ? M.part('lights', k, r) : k);
      pose(a, 'gate', 0, 0, 0, 0, CA.rise * gateOf(k, on), 0);
    }
    var castleSpec = {
      pet: function (on) { return on; },
      at: function () { return 'turret'; },
      apply: function (a, out, t, me) { castlePose(a, clamp01(num(out.k)), me.on); },
      end: function (a, me, m) { castlePose(a, m.on ? 1 : 0, !!m.on); }
    };
    function castleShown(a, m) { return m.on === null ? litOf(a) === true : m.on; }
    var castle = {
      act: function (a, name) {
        var T = TOGGLES.ice_castle;
        if (!a) return null;
        var m = mem(a), on = wantOn(name, T, castleShown(a, m), litOf(a));
        var act = run(a, 'ice_castle', castleSpec, { name: ACT.ice_castle, off: !on });
        if (act) m.on = on;
        return act;
      },
      show: function (a) { if (a && !live.get(a.uid)) { var m = mem(a); if (m.on === null) m.on = litOf(a) === true; castlePose(a, m.on ? 1 : 0, m.on); } },
      lit: function (a, on) { if (!a) return; var m = mem(a), me = live.get(a.uid); if (me) me.stop(m, false); m.on = !!on; castlePose(a, on ? 1 : 0, !!on); }
    };

    /* ---------- snow fort: the pennant drops, then runs back up its pole; snow puffs where the pet pops up ---------- */
    var fortSpec = {
      at: function () { return 'turret'; },
      apply: function (a, out, t, me) {
        var y = me.reduced ? 0 : -FO.drop * clamp01(smooth((t - FO.down[0]) / (FO.down[1] - FO.down[0])) - clamp01(num(out.k)));
        pose(a, 'flag', 0, 0, 0, 0, y, 0);
        for (; !me.reduced && me.mark < FO.puffs.length && t >= FO.puffs[me.mark][0]; me.mark++) emit(a, 'snow', FO.puffs[me.mark][1], 4);
      },
      end: function (a) { rest(a, 'flag'); }
    };

    /* ---------- ice slide: nothing moves; a puff of snow as the pet pushes off, sparkles at the foot ---------- */
    var slideSpec = {
      at: function () { return 'foot'; },
      apply: function (a, out, t, me) { if (!me.reduced && me.mark === 0 && num(out.slide) > 0) { me.mark = 1; emit(a, 'snow', 'top', 3); } },
      end: function () { /* at rest already */ }
    };

    var SPEC = { ice_choir: choirSpec, ice_sled: sledSpec, ice_rink: rinkSpec, ice_skilift: liftSpec, ice_fort: fortSpec, ice_slide: slideSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = id === 'ice_castle' ? castle : { act: function (a) { return run(a, id, SPEC[id]); } };
      out[id].voxels = voxels[id]; out[id].lod1 = lod1[id]; out[id].forget = forget;
    });
    out.ice_choir.show = lampShow('lamp');
    out.ice_rink.show = lampShow('lamps');
    out.ice_skilift.idle = liftIdle;
    out.ice_skilift.animated = function () { return true; };
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, HELPERS: HELPERS, TOGGLES: TOGGLES, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { choir: CH, sled: SL, rink: RK, lift: LF, castle: CA, fort: FO, slide: IS },
    bedY: bedY, bedRows: bedRows, sledAt: sledAt, liftAt: liftAt, loopLen: loopLen, chairRest: chairRest, inPond: inPond, singAt: singAt, nightOf: nightOf,
    eulerYXZ: eulerYXZ, wantOn: wantOn, gateOf: gateOf
  };
}));
