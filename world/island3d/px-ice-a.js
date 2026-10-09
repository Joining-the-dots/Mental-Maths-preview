/* ================================================================
   My Island v3 — SLPxIceA (W3b.6): the Penguin Ice Village's snow decor and village fun in Pixel
   Blocks. window.SLPxIceA + SL3D.defineVox('ice-a', factory) in the browser, module.exports in Node.
   Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards and
   the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the footprint
   centre, facing +z; everything below y 1.0 stays inside fp − 0.125 u (the G8 reading of fp − 0.14 u;
   only the pine's top tiers, the bear's ears and the cocoa hut's roof, mug and icicles are above it).
     ice_snowpenguin  1×1  a penguin built of snow on a little drift: one egg of snow (no neck, so not
                      Home's snowman) with bluish snow down its back and over its crown, navy pebble
                      eyes, a carrot beak, carrot-slice feet and three pebble buttons (MID / HIGH),
                      two twig flippers on 'flipL' / 'flipR' (forked at MID / HIGH); the top of the
                      egg is the head, on 'head'.
     ice_pine         1×1  a pine of three octagonal tiers in three pine greens (two in the short trim)
                      with a snow cap on every tier's shoulder and a snowy tip, all on 'snow' (a child
                      of the helper pivot 'tree' that sways), a bark trunk and a drift at its foot.
                      G8 tiers, not D11's G4: G4 steps cannot taper three tiers inside one cell.
     ice_lantern      1×1  a post of deep blue ice blocks on a snowy foot carrying a six-sided lamp under
                      an aurora violet cap (a violet collar, six violet posts, a knob and settled snow
                      at MID / HIGH), so it reads as a lantern before it is lit: its core is the glow
                      state part 'lit' that steps round the aurora, mint → sky → violet, while full on.
     ice_snowhut      1×1  the first plan's snow dome with a coral plank door (a gold knob at MID / HIGH)
                      set back in its doorway, a stone chimney with a coral cap on its back-right
                      shoulder, and the warm lamp inside showing through a window beside the door, on
                      'glow' (glow state 'lit'), framed in sunny yellow at MID / HIGH. 3 trims: plain,
                      a puffy snow cap, a little flag with a heart pictogram.
     ice_penguin      1×1  a grown-up and a chick (SLPxCharacters.critterVoxels('penguin', size 0 / 2))
                      on 'pen' and 'chick', a pebble nest on a low snow mound. Every copy is the pair.
     ice_sculpture    1×1  a six-point snowflake of 0.125 u ice voxels on 'spin' — a deep blue core, arms
                      in the trim's tint, aurora tips — on a snow-dusted deep blue ice pillar: at
                      MID / HIGH a twin flake is crossed through it, so its quarter turn
                      lands where it began (LOW's one flake turns half a turn); its heart glows faintly
                      after dark (state 'night'). 3 tints: pale blue, mint, lilac.
     ice_fishhole     1×1  a ring of ice blocks, snow on every other one, round dark water with two
                      silver fish under it on 'fish0' / 'fish1', a rod propped on a forked stick with a
                      red-and-white float on 'float' (it bobs at 0.4 Hz on MID / HIGH), a stool and a
                      tin bucket. Nothing is caught.
     ice_snowglobe    1×1  a round gold base, then four ribs of clear-looking ice (two crossed hoops)
                      round a snow mound, a mini igloo (its doorway glows after dark), a mini pine and
                      a little penguin, all on 'globe'; ten flat flakes lie settled on the mound on
                      'flakes' (a child of 'globe') and stand up into cubes as they swirl.
     ice_bear         1×1  a seated polar bear carved from deep blue ice (paler on every top) on a
                      snow-dusted stone plinth: round haunches, front legs, small round ears, dark eyes
                      and nose, the muzzle tipped up; the snow cap on its nose rides 'snowcap'; an
                      aurora heart on its chest after dark.
     ice_cocoa        2×1  a plank kiosk under a snow-laden roof with icicles along its eave and a giant
                      mug pictogram on top; its striped hatch ('hatch', hinged at the window's top)
                      flips up into an awning over the counter, where the urn and the mug ('dishes')
                      stand; a stool (anchor seat) at its end; the windows glow warm after dark.
   AO: the small pieces mesh without corner AO (pier-a's choice) so their LOW caps hold. LOW (D89,
   D106): detail voxels are tagged lod 'mid' (the penguins' flippers too). LOD1: every id brings a
   few plain boxes with every lookEntries pivot, inside TRIS_CAPS_LOD1.
   ACTS run on SLMotion timelines by name: wave, shake, glow, waddle, chimeTurn, fish, shakeGlobe,
   pose and the city's serve (cut to the hut's 2.5 s with its own chip and pop). One live act per
   uid (a re-tap supersedes). The two lamps keep the lit memory: 'glowOn' / 'glowOff' are explicit,
   the bare act follows a.lit when the host has already flipped it, else toggles what the copy shows.
   Reduced motion is the end state at once with the same sounds and one sparkle (the snow penguin's
   flippers held up, the pair mid-bow). The pet's part is a.pets.perform(LOOK perform kind, uid): a
   look back at the fishing hole, the bear's pose, the cocoa stool. Rates: flippers 1.25 Hz, the
   pine 1 Hz, the globe 1 Hz, the waddle roll 1.6 Hz, the float 0.4 Hz, glints 2 a second, the aurora
   0.1 Hz — all under MAX_FLASH_HZ; lamps fade in 0.3 s and stay steady. No word, no five-point star,
   no flame (the urn makes steam only); nothing is caught, kept or counted; nothing here reads,
   awards or spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.lit a.show a.batch a.template · a.pivot(name).set(
   rotDeg[3], pos[3], scale[3]) · a.state(key, v) · a.halo · a.decal · a.emit(kind, localPos, n) ·
   a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxIceA = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('ice-a', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxIceA: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function chars() { return sibling('SLPxCharacters', './px-characters.js'); }

  var VERSION = 1;
  var IDS = ['ice_snowpenguin', 'ice_pine', 'ice_lantern', 'ice_snowhut', 'ice_penguin',
             'ice_sculpture', 'ice_fishhole', 'ice_snowglobe', 'ice_bear', 'ice_cocoa'];
  var VARIANTS = { ice_pine: 2, ice_snowhut: 3, ice_sculpture: 3 };
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, G32 = 0.03125;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { ice_snowpenguin: 'wave', ice_pine: 'shake', ice_lantern: 'glow', ice_snowhut: 'glow', ice_penguin: 'waddle',
              ice_sculpture: 'chimeTurn', ice_fishhole: 'fish', ice_snowglobe: 'shakeGlobe', ice_bear: 'pose', ice_cocoa: 'serve' };
  var PERFORM = { ice_fishhole: 'stand:lookBack', ice_bear: 'pose', ice_cocoa: 'feast' };
  var TOGGLES = ['ice_lantern', 'ice_snowhut'];
  /* pivots beyond the lookEntries lists: the pine's trunk and skirts sway on 'tree' ('snow' rides it) */
  var HELPERS = { ice_pine: ['tree'] };
  /* the module tokens (D50): the tin, the fish's silver and the aurora's in-between steps */
  var TOKENS = {
    'PX Ice Tin': '#B7C3D6', 'PX Ice Fish': '#D5DEEC', 'PX Cocoa': '#8A5A3C',
    'PX Aurora Drift 1': '#88EAD6', 'PX Aurora Drift 2': '#84DFE4', 'PX Aurora Drift 3': '#80D3F1',
    'PX Aurora Drift 5': '#8ABDFF', 'PX Aurora Drift 6': '#98B2FF', 'PX Aurora Drift 7': '#A5A6FF',
    'PX Aurora Drift 9': '#A9B2F1', 'PX Aurora Drift 10': '#A0C8E4', 'PX Aurora Drift 11': '#96DFD6'
  };
  var tokensFor = null;
  function ready() {
    var L = look();
    if (L && tokensFor !== L && typeof L.addTokens === 'function') { L.addTokens('px-ice-a', TOKENS); tokensFor = L; }
  }
  /* the aurora cycle: mint → sky → violet → mint in twelve even steps (map keys a0 … a11) */
  var AURORA = (function () {
    var out = [];
    for (var n = 0; n < 12; n++) out.push(n === 0 ? 'PX Aurora Mint' : n === 4 ? 'PX Aurora Sky' : n === 8 ? 'PX Aurora Violet' : 'PX Aurora Drift ' + n);
    return out;
  }());

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var SP = { flipL: [0.28125, 0.53125, 0], flipR: [-0.28125, 0.53125, 0], head: [0, 0.625, 0], flap: 25, nod: 10,
             cues: [{ t: 0.05, sfx: 'squeak', step: 0, vol: 0.5 }] };
  var PN = { tree: [0, 0, 0], snow: [0, 0.375, 0], sway: 3, mid: [0, 1.125, 0], slide: [0.2, 0.8],
             adds: [{ t: 0.35, emit: 'snow', n: 8 }] };
  var LN = { glow: [0, 0.6875, 0], halo: 0.8, hz: 0.1, cues: [{ t: 0, sfx: 'chip', vol: 0.4 }, { t: 0.1, sfx: 'beep', vol: 0.2 }] };
  var HUT = { glow: [-0.25, 0.375, 0.1875], pop: 0.12, halo: 0.6 };
  var NEST = { pen: [-0.125, 0.125, 0], chick: [0.21875, 0.125, -0.09375], r: 0.12, hop: 0.06, roll: 8, bow: 20, face: 80, watch: 60, chickHop: 0.04 };
  var SC = { spin: [0, 0.375, 0], turn: 90, turnLow: 180, glints: [[0, 0.5, 0.1], [0, 0.85, 0.1], [0, 1.2, 0.1]],
             adds: [{ t: 0.2, emit: 'glint', n: 1, p: 0 }, { t: 0.7, emit: 'glint', n: 1, p: 1 }, { t: 1.2, emit: 'glint', n: 1, p: 2 }] };
  var FH = { hole: [0, 0.25, 0], fish0: [0, 0.125, 0], fish1: [0, 0.09375, 0.0625], float: [-0.03125, 0.28125, 0.03125],
             spot: [0.125, 0, 0.375], leap: [0.1, 0.9], arc0: [0.62, 0.14], arc1: [0.45, 0.1], bob: 0.015, idle: 0.4, dip: 0.04 };
  var GL = { globe: [0, 0.1875, 0], flakes: [0, 0.25, 0], spot: [0, 0, 0.375], R: 6.2, rock: 5, up: 4, spin: 300, rise: 0.3 };
  var BR = { snowcap: [0, 1.375, 0.3125], spot: [0, 0, 0.375], glints: [[0, 1.25, 0.2], [0, 0.9, 0.05], [0, 0.55, -0.25]],
             slide: [0.15, 0.6], drop: [0, -1.0, 0.1], back: [2.3, 2.5],
             adds: [{ t: 0.1, emit: 'glint', n: 1, p: 0 }, { t: 0.6, emit: 'glint', n: 1, p: 1 }, { t: 1.1, emit: 'glint', n: 1, p: 2 }] };
  var CO = { hatch: [-0.28125, 1.0, 0.15625], dishes: [0.375, 0.5, 0.25], seat: [0.75, 0.3125, 0.25], urn: [-0.75, 0.8125, 0.25],
             open: [0.1, 0.35], shut: [2.05, 2.4], deg: 100, pop: [0.9, 1.2], cut: 2.5, every: 5,
             cues: [{ t: 0.1, sfx: 'chip' }, { t: 0.9, sfx: 'pop' }, { t: 0.9, emit: 'wisp', n: 3 }] };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function inOut(u) { return (1 - Math.cos(Math.PI * clamp01(u))) / 2; }
  function outBack(u) { u = clamp01(u) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
  /* how far the night has come on for lamps and glows: 0 by day, 1 from dusk on (as the garden lamps) */
  function nightOf(k) { var u = clamp01(((+k || 0) - 0.35) / 0.3); return u * u * (3 - 2 * u); }
  /* a toggle's target (1 = on): the explicit names win; the bare act follows a.lit when the host has
     already flipped the memory, else it toggles what the copy shows */
  function wantOn(name, lit, shown) {
    if (name === 'glowOn') return 1;
    if (name === 'glowOff' || name === 'close') return 0;
    var l = lit ? 1 : 0;
    if (shown !== 0 && shown !== 1) return l ? 0 : 1;
    return l !== shown ? l : shown ? 0 : 1;
  }
  /* the aurora lantern's drift step (0 … 11) at t s: the cycle runs at hz, offset by the copy's phase */
  function auroraStep(t, hz, phase) { var u = (Math.max(0, +t || 0) * hz + (+phase || 0)) % 1; return Math.floor(u * 12 + 1e-9) % 12; }
  /* the pine's snow caps at t of 'shake' (k = its rebuild ramp): out {sxz, sy} about 'snow' — they slide
     down into the tree and melt away as the cubes fall, then spread back out over every tier */
  function snowAt(t, k, out) {
    out = out || {};
    if (t < PN.slide[0]) { out.sy = out.sxz = 1; return out; }
    if (t < PN.slide[1] || !(k > 0)) { out.sy = out.sxz = 1 - inOut(seg(t, PN.slide[0], PN.slide[1])); return out; }
    out.sy = 1; out.sxz = inOut(k);
    return out;
  }
  /* one leaping fish at its own time tl: out {u (0 → 1 across the hole), x, y (offsets), pitch (degrees,
     nose along the arc)}; the arc is `arc` = [height, half span] and it takes FH.leap seconds */
  function fishAt(tl, arc, out) {
    out = out || {};
    var u = seg(tl, FH.leap[0], FH.leap[1]);
    out.u = u;
    if (u <= 0 || u >= 1) { out.x = out.y = out.pitch = 0; return out; }
    out.x = arc[1] * (2 * u - 1); out.y = arc[0] * 4 * u * (1 - u);
    out.pitch = Math.atan2(arc[0] * 4 * (1 - 2 * u), 2 * arc[1]) * 180 / Math.PI;
    return out;
  }
  /* the grown-up penguin's way round at the waddle's k (0 → 1): out {x, z (offsets from its nest spot),
     yaw (degrees, −180 … 180: 0 faces +z)} — it turns off the nest to the right, waddles one tight loop
     out in front of the pair (right, forward, left, back) and turns to face the front again */
  function loopAt(k, out) {
    out = out || {};
    var u = clamp01(k), a = 2 * Math.PI * u, yaw = 90 - 360 * u;
    out.x = NEST.r * Math.sin(a); out.z = NEST.r * (1 - Math.cos(a));
    yaw = u < 0.1 ? yaw * inOut(u / 0.1) : u > 0.9 ? yaw + (-360 - yaw) * inOut((u - 0.9) / 0.1) : yaw;
    yaw = ((yaw % 360) + 360) % 360;
    out.yaw = yaw > 180 ? yaw - 360 : yaw === 0 ? 0 : yaw;
    return out;
  }
  /* XYZ Euler degrees (the kit's setPivot order) of R = Ry(yaw) · Rx(pitch) · Rz(roll) */
  function euler(yaw, pitch, roll, out) {
    out = out || [0, 0, 0];
    var D = Math.PI / 180, ca = Math.cos(yaw * D), sa = Math.sin(yaw * D), cb = Math.cos(pitch * D), sb = Math.sin(pitch * D), cc = Math.cos(roll * D), sc = Math.sin(roll * D);
    var m13 = sa * cb;
    if (Math.abs(m13) < 0.9999999) {
      out[0] = Math.atan2(sb, ca * cb) / D; out[1] = Math.asin(m13) / D; out[2] = Math.atan2(ca * sc - sa * sb * cc, ca * cc + sa * sb * sc) / D;
    } else { out[0] = Math.atan2(sa * sc + ca * sb * cc, cb * cc) / D; out[1] = m13 > 0 ? 90 : -90; out[2] = 0; }
    for (var n = 0; n < 3; n++) if (Math.abs(out[n]) < 1e-9) out[n] = 0;
    return out;
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz, oy) { return VX().grid({ grid: g, origin: [ox || 0, oy || 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at] | [grid, at, true] (true: no ground under it)] or ready
     layer objects; empty grids are left out; o.pivots {name: [x, y, z, parent?]} and o.anchors
     {name: [x, y, z]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      if (l && l.vox && !l.count) { m.layers.push(l); return; }
      var g = Array.isArray(l) ? l[0] : l, n = m.layers.length, ly;
      if (!g.count) return;
      ly = { vox: g.snapshot() };
      if (Array.isArray(l) && l[1]) ly.at = l[1];
      if (Array.isArray(l) && l[2]) ly.ground = false;
      m.layers.push(ly);
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { var p = o.pivots[n]; m.pivots[n] = { at: U(p), parent: p[3] || null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { m.anchors[n] = U(o.anchors[n]); });
    if (o.cull) m.cull = o.cull;
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('sSi', {…}) picks from it. The digits are the MID / HIGH detail
     twins (lod 'mid': tier LOW drops them, D89) */
  var MID = 'mid', SNOW = 'snow', ICE = 'ice';
  function glowOf(key, off, on, extra) { var s = { key: key, off: off, on: on, initial: 0 }; for (var k in extra) s[k] = extra[k]; return { token: on, mode: 'glow', state: s }; }
  var INK = {
    s: { token: 'PX Ice Snow', mode: SNOW }, S: { token: 'PX Ice Snow 2', mode: SNOW }, h: { token: 'PX Ice Snow Shade', mode: SNOW },
    i: { token: 'PX Ice', mode: ICE }, I: { token: 'PX Ice 2', mode: ICE }, j: { token: 'PX Ice Shine', mode: ICE }, d: 'PX Ice Deep',
    n: 'PX Penguin Back', o: 'PX Penguin Orange', b: 'PX Tree Bark', t: 'PX Trunk', p: { token: 'PX Tree Plank', mode: 'plank' }, P: 'PX Tree Plank',
    g: { token: 'PX Tree Pine', mode: 'leaf' }, G: { token: 'PX Tree Pine Mid', mode: 'leaf' }, l: { token: 'PX Tree Pine Light', mode: 'leaf' },
    q: 'PX Ice Pebble', Q: 'PX Ice Pebble 2', r: 'PX Ice Pebble 3', c: 'PX Coral', w: 'PX Cream', m: 'PX Ice Tin', f: 'PX Ice Fish',
    a: { token: 'PX Ice Deep', mode: 'water' }, k: 'PX Cocoa', y: 'PX Candy Pink', e: 'PX Ink Eye',
    1: { token: 'PX Ice Snow', mode: SNOW, lod: MID }, 2: { token: 'PX Ice Snow 2', mode: SNOW, lod: MID }, 3: { token: 'PX Penguin Back', lod: MID },
    4: { token: 'PX Ice Shine', mode: ICE, lod: MID }, 5: { token: 'PX Ice Pebble', lod: MID }, 6: { token: 'PX Ice Pebble 2', lod: MID },
    7: { token: 'PX Tree Bark', lod: MID }, 8: { token: 'PX Penguin Orange', lod: MID }, 9: { token: 'PX Cream', lod: MID }, 0: { token: 'PX Ice Pebble 3', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    ready();
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  function variantOf(st, id) { var n = VARIANTS[id], v = st && typeof st.variant === 'number' && isFinite(st.variant) ? st.variant | 0 : 0; return v < 0 ? 0 : v >= n ? n - 1 : v; }
  /* fn(i, j, k) → a char, or null to leave that cell as it is (box() would clear it) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = typeof fn === 'function' ? fn(i, j, k) : fn; if (c) g.set(i, j, k, c); }
  }
  /* a box with its four upright corner columns left out (a rounded block) */
  function round(g, i0, i1, j0, j1, k0, k1, c) {
    fill(g, i0, i1, j0, j1, k0, k1, function (i, j, k) { return (i === i0 || i === i1) && (k === k0 || k === k1) ? null : typeof c === 'function' ? c(i, j, k) : c; });
  }
  /* a disc of radius r on an even grid (voxel centres at i + 0.5) round (cx, cz) */
  function disc(g, cx, cz, r, j0, j1, c) {
    var R = Math.ceil(r) + 1;
    fill(g, Math.floor(cx) - R, Math.floor(cx) + R, j0, j1, Math.floor(cz) - R, Math.floor(cz) + R, function (i, j, k) {
      var dx = i + 0.5 - cx, dz = k + 0.5 - cz;
      return dx * dx + dz * dz <= r * r + 1e-9 ? (typeof c === 'function' ? c(i, j, k) : c) : null;
    });
  }

  /* a text voxel map: layers bottom → top from row j0, each an array of rows back (−z) → front (+z)
     from k0, one char per voxel along +x from i0 ('.' empty) */
  function paint(g, i0, j0, k0, layers) {
    layers.forEach(function (rows, dj) { rows.forEach(function (row, dk) { for (var di = 0; di < row.length; di++) if (row[di] !== '.') g.set(i0 + di, j0 + dj, k0 + dk, row[di]); }); });
  }

  /* ---------------- ice_snowpenguin ---------------- */
  /* the snow penguin (odd G8, i −2 … 2, rows back → front from k −2), bottom up: the drift and the round
     body (bluish snow down its back), its shoulders, then the head (on 'head') */
  var SNOWPEN = [
    ['.SSS.', 'SSSSS', 'SSSSS', 'SSSSS', '.SSS.'],
    ['.hhh.', 'hhhhh', 'sssss', 'sssss', '.sss.'],
    ['.hhh.', 'hhhhh', 'sssss', 'sssss', '.sss.'],
    ['.....', '.hhh.', 'sssss', '.sss.', '.....'],
    ['.....', '.hhh.', '.sss.', '.sss.', '.....']
  ];
  var SNOWPEN_HEAD = [['.....', '.hhh.', '.sss.', '.sss.', '.....'], ['.....', '.hhh.', '.hsh.', '.....', '.....']];
  function snowpenguinVoxels(st, opt) {
    var lite = !!(opt && opt.lite), b = grid(G8, 0.5, 0.5), d = grid(G16, 0.5, 0), fl = grid(G16, 0.5, 0.5);
    paint(b, -2, 0, -2, SNOWPEN);
    b.group('head', function () { paint(b, -2, 5, -2, SNOWPEN_HEAD); });
    if (!lite) b.set(-3, 0, 0, '2').set(3, 0, -1, '1').set(2, 0, 3, '1');                             /* lumps of drift */
    /* the face (G16, just proud of the head's front): two navy pebble eyes and a carrot beak */
    d.group('head', function () { d.set(-2, 11, 3, 'n').set(2, 11, 3, 'n').set(0, 10, 3, 'o').set(0, 10, 4, 'o'); });
    /* carrot-slice feet peeping out of the drift and three pebble buttons down the belly (MID / HIGH) */
    if (!lite) d.box(-3, -2, 2, 2, 5, 5, '8').box(1, 2, 2, 2, 5, 5, '8').set(0, 3, 5, '3').set(0, 5, 5, '3').set(0, 7, 3, '3');
    /* two twig flippers hanging from the shoulders, forked at MID / HIGH */
    [['flipL', 1], ['flipR', -1]].forEach(function (f) {
      var s2 = f[1];
      fl.group(f[0], function () { fl.box(5 * s2, 5 * s2, 6, 8, 0, 0, 'b'); if (!lite) fl.box(6 * s2, 6 * s2, 3, 5, 0, 0, '7').set(6 * s2, 2, 1, '7').set(5 * s2, 2, -1, '7'); });
    });
    return model('ice_snowpenguin', pal('sShnob12378'), [b, [d, null, true], [fl, null, true]],
      { pivots: { flipL: SP.flipL, flipR: SP.flipR, head: SP.head }, ao: false });
  }

  /* ---------------- ice_pine ---------------- */
  /* the pine (odd G8): its trunk height, then the tiers [width, rows, colour] — 7 and 5 wide octagonal
     skirts and a 3 wide top tier — and the tip's rows. Every tier wears a snow cap on 'snow'
     (a G16 slab on the shoulder the next tier leaves bare) and the tip is snow. Tall / short */
  var PINE = [{ y0: 3, tiers: [[7, 3, 'g'], [5, 3, 'G'], [3, 3, 'l']], tip: 2 }, { y0: 3, tiers: [[7, 2, 'g'], [5, 3, 'G'], [3, 2, 'l']], tip: 1 }];
  /* is item point (x, z) on a pine row w G8 voxels wide (odd, centred, its corners cut to an octagon)? */
  function onRow(w, x, z) {
    var h = (w - 1) / 2, i = Math.round(x / G8), k = Math.round(z / G8);
    return Math.abs(i) <= h && Math.abs(k) <= h && Math.abs(i) + Math.abs(k) <= (h > 2 ? h + 2 : h > 1 ? h + 1 : 2);
  }
  function pineVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'ice_pine'), P = PINE[v], g = grid(G8, 0.5, 0.5), s = grid(G16), f = grid(G8, 0.5, 0.5), j = P.y0;
    g.group('tree', function () {
      g.box(0, 0, 0, j - 1, 0, 0, 'b');                                                                /* the trunk */
      P.tiers.forEach(function (q) { var h = (q[0] - 1) / 2; fill(g, -h, h, j, j + q[1] - 1, -h, h, function (i, jj, k) { return onRow(q[0], i * G8, k * G8) ? q[2] : null; }); j += q[1]; });
    });
    /* the snow caps (G16 slabs, on 'snow'): each tier's shoulder, then the tip; drips at MID */
    s.group('snow', function () {
      var y = P.y0;
      P.tiers.forEach(function (q, n, all) {
        y += q[1];
        var nx = all[n + 1] || [1], J = y * 2, R = q[0];
        fill(s, -R, R - 1, J, J, -R, R - 1, function (i, jj, k) {
          var x = (i + 0.5) * G16, z = (k + 0.5) * G16;
          return onRow(q[0], x, z) && !onRow(nx[0], x, z) ? 's' : null;
        });
        if (!lite) [[-R, 0, '1'], [R - 1, 1, '2'], [1, R - 1, '1'], [-2, -R, '2']].forEach(function (p) { s.set(p[0], J - 1, p[1], p[2]); });
      });
      s.box(-1, 0, y * 2, y * 2 + 2 * P.tip, -1, 0, 's');                                              /* the snowy tip */
    });
    fill(f, -3, 3, 0, 0, -3, 2, function (i, jj, k) { return i * i + k * k <= (lite ? 4.5 : 8.5) ? 'S' : null; });   /* the drift at its foot */
    if (!lite) f.set(-3, 0, 1, '2').set(3, 0, -1, '1').set(2, 1, 1, '1');
    return model('ice_pine', pal('gGlbsS12'), [[g, null, true], f, [s, null, true]],
      { pivots: { tree: PN.tree, snow: PN.snow.concat(['tree']) }, ao: false });
  }

  /* ---------------- ice_lantern ---------------- */
  function lanternCore() { return glowOf('lit', 'PX Lamp Off', 'PX Aurora Mint', { map: AURORA.reduce(function (m, tok, n) { m['a' + n] = tok; return m; }, {}) }); }
  /* the lamp head's hexagon (G16 odd, points front and back): the half-width of row k is HEXW[|k|],
     `grow` voxels wider all round */
  var HEXW = [2, 2, 1, 0];
  function hex(g, j0, j1, grow, c) {
    for (var k = -3 - grow; k <= 3 + grow; k++) { var a = Math.abs(k), w = a <= 3 ? HEXW[a] + grow : HEXW[3] + grow - (a - 3) * 2; if (w >= 0) g.box(-w, w, j0, j1, k, k, c); }
  }
  /* the lantern's colours: a post of deep blue ice ('P') and an aurora violet frame and cap ('V'; 'v' its
     MID / HIGH detail), so it reads as a lantern by day before it is lit */
  var LANTERN_INK = { P: { token: 'PX Ice Deep', mode: ICE }, V: 'PX Aurora Violet', v: { token: 'PX Aurora Violet', lod: MID } };
  function lanternVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), h = grid(G16, 0.5, 0.5);
    /* a snowy foot and a post of ice blocks */
    o.box(-2, 1, 0, 0, -2, 1, 'S');
    o.box(-1, 0, 1, 3, -1, 0, 'P');
    /* the six-sided lamp head (G16): the glowing core on a violet collar, six violet posts round it at MID */
    hex(h, 8, 13, 0, 'Y');
    if (!lite) {
      hex(h, 7, 7, 1, 'v');
      [[0, -4], [-3, -1], [3, -1], [-3, 1], [3, 1], [0, 4]].forEach(function (q) { h.box(q[0], q[0], 8, 13, q[1], q[1], 'v'); });
    }
    /* the violet cap: the hexagon (a voxel wider at MID); at MID a knob and snow settled on it */
    hex(h, 14, 14, lite ? 0 : 1, 'V'); h.set(0, 15, 0, 'v');
    if (!lite) h.set(-2, 15, 0, '1').set(2, 15, 1, '2').set(0, 15, -2, '1').set(1, 15, 3, '2');
    if (!lite) o.set(-3, 0, 0, '2').set(2, 0, -2, '1');
    return model('ice_lantern', pal('sS12', { Y: lanternCore(), P: LANTERN_INK.P, V: LANTERN_INK.V, v: LANTERN_INK.v }), [o, [h, null, true]], { anchors: { glow: LN.glow }, ao: false });
  }

  /* ---------------- ice_snowhut ---------------- */
  /* the dome's radius (even G8 voxels) per row: a little beehive, 0.75 u wide and 0.75 u tall */
  var DOME = [3, 3, 2.85, 2.55, 2.1, 1.45];
  /* the chimney's G8 column (i, k) on the dome's back-right shoulder: stone on rows 4–5, its cap on row 6 */
  var CHIMNEY = [1, -2];
  function snowhutVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'ice_snowhut'), o = grid(G8), d = grid(G16), w = grid(G16), x = grid(G16);
    DOME.forEach(function (r, j) { disc(o, 0, 0, r, j, j, 's'); });
    /* the doorway: cut into the dome, a coral door set back in it under a little arch, a gold knob */
    o.box(-1, 0, 0, 2, 1, 2, null);
    d.box(-2, 1, 0, 5, 3, 3, 'R');
    if (!lite) d.box(-3, 2, 6, 6, 4, 4, '2').box(-3, -3, 0, 5, 4, 4, '2').box(2, 2, 0, 5, 4, 4, '2').set(0, 2, 4, 'K');   /* the arch's rim, the knob */
    /* the warm lamp inside shows through a little window left of the door, on 'glow'; at MID / HIGH a
       sunny frame: a lintel on each pane's top and a sill on the snow that juts out under it */
    o.group('glow', function () { [[-3, 2], [-2, 2], [-3, 3], [-2, 3]].forEach(function (q) { o.set(q[0], q[1], o.front(q[0], q[1]), 'Y'); }); });
    if (!lite) w.box(-6, -5, 8, 8, 0, 1, 'K').box(-4, -3, 8, 8, 2, 3, 'K').box(-6, -5, 4, 4, 2, 2, 'K').box(-4, -3, 4, 4, 4, 4, 'K');
    /* a stone chimney with a coral cap on the back-right shoulder */
    o.box(CHIMNEY[0], CHIMNEY[0], 4, 5, CHIMNEY[1], CHIMNEY[1], 'H').set(CHIMNEY[0], 6, CHIMNEY[1], 'c');
    if (v === 1) {                                                                                     /* a puffy snow cap */
      o.box(-1, 0, 6, 6, -1, 0, 'S');
      if (!lite) x.box(-3, 2, 12, 12, -1, 0, '2').box(-1, 0, 12, 12, -3, 2, '1');
    } else if (v === 2) {                                                                              /* a little flag with a heart */
      x.box(4, 4, 0, 13, 4, 4, 'b').box(1, 3, 11, 13, 4, 4, 'c');
      x.decal('+z', [1, 11, 4], [3, 3], 'heart');
    }
    if (!lite) [[-7, 2], [6, -4], [2, 6]].forEach(function (q) { x.set(q[0], 0, q[1], '1'); });   /* snow lumps round the foot */
    return model('ice_snowhut', pal('sSbc12', { Y: glowOf('lit', 'PX Lamp Off', 'PX Ice Hut Glow'), R: { token: 'PX Coral', mode: 'plank' },
      K: { token: 'PX Sunny', lod: MID }, H: 'PX Ice Pebble 2' }),
      [o, [d, null, true], [w, null, true], [x, null, true]], { pivots: { glow: HUT.glow }, ao: false });
  }

  /* ---------------- ice_penguin ---------------- */
  var PEN_MAP = { n: 'n', f: 'F', o: 'o', e: 'e', G: 'X' };
  /* one critter penguin's layers (SLPxCharacters.critterVoxels, else a local stand-in), every voxel on
     `pivot`, standing at `at`; its flippers are MID / HIGH detail ('W'), so tier LOW keeps its cap */
  function localPenguin(size) {
    var g = VX().grid({ grid: [0.45, 0.4, 0.33][size % 3] / 9 }), m;
    g.box(-2, 2, 1, 7, -2, 1, 'n').box(-1, 1, 8, 8, -2, 1, 'n').box(-1, 1, 1, 4, 1, 1, 'f').box(-2, 2, 5, 7, 1, 1, 'f').set(-1, 6, 1, 'e').set(1, 6, 1, 'e');
    g.box(0, 0, 6, 6, 2, 2, 'o').box(-2, -1, 0, 0, 0, 2, 'o').box(1, 2, 0, 0, 0, 2, 'o');
    g.group('wingL', function () { g.box(3, 3, 2, 5, -1, 0, 'n'); }); g.group('wingR', function () { g.box(-3, -3, 2, 5, -1, 0, 'n'); });
    m = g.model({ id: 'penguin', palette: {} });
    return m;
  }
  function penguinLayers(size, pivot, at, opt) {
    var C = opt && opt.local ? null : chars(), m = C && typeof C.critterVoxels === 'function' ? C.critterVoxels('penguin', { size: size }) : null, lite = !!(opt && opt.lite);
    if (!m) m = localPenguin(size);
    var out = [];
    m.layers.forEach(function (ly, li) {
      if (li > 0 && lite) return;
      var s = ly.vox, c = new Uint8Array(s.c.length), p = new Uint8Array(s.c.length), a = ly.at || [0, 0, 0];
      for (var n = 0; n < c.length; n++) {
        if (!s.c[n]) continue;
        var ch = String.fromCharCode(s.c[n]), to = s.p[n] && li === 0 ? 'W' : PEN_MAP[ch] || 'n';
        c[n] = to.charCodeAt(0); p[n] = 1;
      }
      out.push({ vox: { grid: s.grid.slice(), origin: s.origin.slice(), min: s.min.slice(), dims: s.dims.slice(), c: c, p: p, names: [null, pivot] },
                 at: [at[0] + a[0], at[1] + a[1], at[2] + a[2]], ground: false });
    });
    return out;
  }
  function penguinVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), d = grid(G16, 0.5, 0.5);
    /* a low snow mound */
    o.box(-2, 2, 0, 0, -2, 2, 's');
    if (!lite) {
      /* the pebble nest round the grown-up (open at the front), a pebble by the chick, the mound's round edge */
      [[-5, -2, '5'], [-5, 1, '6'], [-4, -4, '0'], [-1, -5, '5'], [1, -3, '6'], [1, 1, '0'], [4, -5, '6']].forEach(function (q) { d.set(q[0], 2, q[1], q[2]); });
      d.box(-5, 4, 0, 0, 6, 6, '1').box(-5, 4, 0, 0, -6, -6, '2');
    }
    var m = model('ice_penguin', pal('s1256', { n: 'PX Penguin Back', F: 'PX Penguin Front', o: 'PX Penguin Orange', e: 'PX Ink Eye',
      W: { token: 'PX Penguin Back', lod: MID }, X: { token: 'PX Glint', mode: 'glow', lod: MID }, 0: INK[0] }), [o, [d, null, true]],
      { pivots: { pen: NEST.pen, chick: NEST.chick }, ao: false });
    penguinLayers(0, 'pen', NEST.pen, opt).forEach(function (ly) { m.layers.push(ly); });
    penguinLayers(2, 'chick', NEST.chick, opt).forEach(function (ly) { m.layers.push(ly); });
    m.cull = [];                      /* every face: the grown-up turns its back and bows */
    return m;
  }

  /* ---------------- ice_sculpture ---------------- */
  /* the six-point flake (odd G8, its own plane: u across, v up), top row first: the upright arms, four
     arms to the sides that rise and fall from the heart, shine on every tip; C is the heart */
  var FLAKE = ['...j...', 'j..i..j', '.i.K.i.', '..KCK..', '.i.K.i.', 'j..i..j', '...j...'];
  /* the tips' aurora tint per trim (a contrast to the arms: pale blue → violet, mint → sky, lilac → mint) */
  var FLAKE_TIPS = ['PX Aurora Violet', 'PX Aurora Sky', 'PX Aurora Mint'];
  /* each flake char → its crossed twin's (MID / HIGH detail) */
  var TWIN = { j: 'T', K: 'k', i: 'x' };
  function sculptureVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'ice_sculpture'), o = grid(G8), f = grid(G8, 0.5, 0.5), d = grid(G16, 0.5, 0.5);
    /* the plinth: a snowy foot, a deep blue ice pillar, a dusting of snow on top */
    o.box(-2, 1, 0, 0, -2, 1, 'S').box(-1, 0, 1, 2, -1, 0, 'K');
    /* the flake on 'spin' — a deep blue core ('K' round the heart 'C'), arms in the trim's tint, aurora
       tips ('j') — and, at MID / HIGH, its twin crossed through it (a quarter turn lands where it began;
       LOW's one flake turns half a turn) */
    f.group('spin', function () {
      FLAKE.forEach(function (row, r) {
        for (var u = 0; u < row.length; u++) {
          var ch = row[u], i = u - 3, j = 3 + FLAKE.length - 1 - r;
          if (ch === '.') continue;
          f.set(i, j, 0, ch);
          if (!lite && i) f.set(0, j, i, TWIN[ch]);
        }
      });
    });
    /* sparkle nubs on the upright arms and the snow on the plinth (G16, MID / HIGH) */
    if (!lite) {
      d.group('spin', function () { [10, 20].forEach(function (y) { d.set(-1, y, 0, '4').set(1, y, 0, '4'); }); });
      d.box(-3, 2, 6, 6, -3, 2, '1').set(-4, 0, 3, '2').set(3, 0, -4, '1');
    }
    var tint = (function () { var L = look(), e = L && L.LOOK && L.LOOK.ice_sculpture, t = e && e.variantTokens; return Array.isArray(t) && t.length === 3 ? t[v] : ['PX Ice', 'PX Aurora Mint', 'PX Aurora Violet'][v]; }());
    var tip = FLAKE_TIPS[v];
    return model('ice_sculpture', pal('sS124', { i: { token: tint, mode: ICE }, x: { token: tint, mode: ICE, lod: MID }, j: { token: tip, mode: ICE }, T: { token: tip, mode: ICE, lod: MID },
      K: { token: 'PX Ice Deep', mode: ICE }, k: { token: 'PX Ice Deep', mode: ICE, lod: MID }, C: glowOf('night', 'PX Ice Deep', 'PX Ice Shine') }),
      [o, [f, null, true], [d, null, true]], { pivots: { spin: SC.spin }, ao: false });
  }

  /* ---------------- ice_fishhole ---------------- */
  function fishholeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), w = grid(G16), d = grid(G16), r = grid(G16), fs = grid(G16, 0.5, 0.5), ft = grid(G32, 0.5, 0.5), ln = grid(G32);
    /* the ring of ice blocks round the hole, snow caps on every other block */
    disc(o, 0, 0, 3, 0, 2, function (i, j, k) {
      var dx = i + 0.5, dz = k + 0.5, q = dx * dx + dz * dz;
      if (q < 2.9 || (j === 2 && (i + k) & 1)) return null;
      return j === 2 ? 's' : (i + 2 * k + j) & 1 ? 'I' : 'i';
    });
    /* the dark water in the hole (it hides the fish), and the float on it */
    disc(w, 0, 0, 3.4, 3, 3, 'a');
    r.group('float', function () { r.box(-1, -1, 4, 4, 0, 0, 'c').box(-1, -1, 5, 5, 0, 0, 'w'); });
    /* two silver fish waiting under the water: a body with a darker back, a forked tail, an eye */
    fs.group('fish0', function () { fs.box(-2, 1, 1, 2, 0, 0, function (i, j) { return j === 2 && i < 1 ? 'Q' : 'f'; }).set(1, 2, 0, 'e').set(2, 1, 0, 'f').set(-3, 1, 0, 'Q').set(-3, 2, 0, 'Q').set(-4, 2, 0, 'Q').set(-4, 0, 0, 'Q'); });
    ft.group('fish1', function () { ft.box(-2, 1, 2, 3, 2, 2, 'f').set(1, 3, 2, 'e').set(-3, 2, 2, 'Q').set(-3, 3, 2, 'Q'); });
    /* the rod: its butt in the snow at the back right, over a forked stick, its tip above the float; the line */
    r.line([6, 0, -6], [-1, 11, 0], 'b');
    r.box(3, 3, 0, 3, -3, -3, 't').set(2, 4, -3, 't').set(4, 4, -3, 't');
    ln.box(-1, -1, 12, 21, 0, 0, 'w');
    /* the stool at the front right, the tin bucket at the front left */
    d.box(4, 5, 0, 1, 4, 5, 'b').box(3, 6, 2, 2, 3, 6, 'p');
    d.box(-6, -4, 0, 2, 4, 6, function (i, j, k) { return j > 0 && i === -5 && k === 5 ? null : j === 2 ? 'Q' : 'm'; });
    if (!lite) {
      d.box(-6, -4, 3, 3, 5, 5, '0').set(-3, 3, 5, '0');                                                 /* the handle */
      [[-6, -2], [5, 1], [-3, -6], [2, -6]].forEach(function (q) { d.set(q[0], 2, q[1], '4'); });         /* shine on the ice */
      d.set(6, 0, -6, '1').set(-6, 0, -6, '2').set(-1, 0, 6, '1');
    }
    return model('ice_fishhole', pal('siIabtpcwQmfe0124', {}), [o, [w, null, true], [fs, null, true], [ft, null, true], [r, null, true], [d, null, true], [ln, null, true]],
      { pivots: { fish0: FH.fish0, fish1: FH.fish1, float: FH.float }, anchors: { spot: FH.spot }, ao: false });
  }

  /* ---------------- ice_snowglobe ---------------- */
  function snowglobeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), b = grid(G16, 0.5, 0.5), g = grid(G16, 0.5, 0.5), fl = grid([G16, G32 / 2, G16], 0.5, 0.5);
    /* the round base, painted gold */
    b.lathe([[[6, 6], 0, 2, 'B']]);
    g.group('globe', function () {
      /* the snow mound, the mini igloo with its doorway, the mini pine, and a little penguin (navy back,
         white tummy, orange beak) standing between them */
      g.lathe([[[5, 4], 3, 3, 's'], [[3.4, 2.4], 4, 4, 'S']]);
      g.lathe([[[2.2, 2.2], 5, 5, 's'], [[1.5, 1.5], 6, 6, 's']], { at: [-2, 0] });
      g.box(-2, -2, 5, 5, 2, 2, 'D');
      g.box(2, 2, 5, 6, 0, 0, 'b').lathe([[[1.5, 1.5], 7, 7, 'g'], [[1, 1], 8, 8, 'G'], [[0.5, 0.5], 9, 9, 'l']], { at: [2, 0] }).set(2, 10, 0, 's');
      g.box(1, 1, 5, 7, 2, 2, 'n').box(1, 1, 5, 6, 3, 3, 'w').set(1, 7, 3, 'n').set(1, 7, 4, 'o');
      if (!lite) g.set(-4, 4, 2, '1').set(4, 4, -2, '2').set(3, 8, 1, '1');                          /* snow lumps, a snowy bough */
    });
    /* four arched ribs of clear-looking ice (two crossed hoops) rising out of the base, a knob on top */
    g.group('globe', function () {
      for (var j = 4; j <= 16; j++) for (var a = -7; a <= 7; a++) {
        var q = Math.sqrt(a * a + (j - 9) * (j - 9));
        if (Math.abs(q - GL.R) > 0.5) continue;
        var c = j > 12 ? 'j' : 'i';
        g.set(a, j, 0, c); g.set(0, j, a, c);
      }
      g.set(0, 16, 0, 'j');
    });
    /* ten settled flakes, flat on the mound, on 'flakes' */
    fl.group('flakes', function () {
      [[-3, 0, 2], [3, 1, 2], [0, 2, 3], [-4, 0, -1], [4, 0, -2], [-1, 3, -3], [1, 1, 1], [-2, 2, -2], [3, 2, -4], [0, 0, -4]].forEach(function (q) { fl.set(q[0], 8 + q[1], q[2], 'w'); });
    });
    return model('ice_snowglobe', pal('sSbgGlno12', { B: 'PX Sunny', i: { token: 'PX Ice 2', mode: ICE }, j: { token: 'PX Ice', mode: ICE }, w: 'PX Penguin Front',
      D: glowOf('night', 'PX Penguin Back', 'PX Ice Hut Glow') }),
      [b, [g, null, true], [fl, [0, 0.0625, 0], true]], { pivots: { globe: GL.globe, flakes: GL.flakes.concat(['globe']) }, anchors: { spot: GL.spot }, ao: false });
  }

  /* ---------------- ice_bear ---------------- */
  /* the seated bear (G16 odd, voxel units): rounded masses [centre i, j, k, radii i, j, k] — haunches,
     belly, shoulders, the head, the muzzle tipped up, two round ears, a tail — then legs and feet */
  var BEAR = [[0, 7, -2.6, 6, 4.5, 4], [0, 11, -1.6, 4.6, 5, 3.4], [0, 15, -0.4, 3.8, 2.6, 3], [0, 18.4, 1.4, 3.3, 2.8, 2.9],
              [0, 19.9, 4.4, 1.7, 1.5, 1.6], [-2.5, 21.2, 0.2, 1.1, 1.1, 0.8], [2.5, 21.2, 0.2, 1.1, 1.1, 0.8], [0, 4.6, -5.6, 1, 1, 0.8]];
  /* the bear's ice: a deep blue body ('i') with paler tops ('j'), so it reads against the snow; its chest
     heart is the body's blue by day and aurora mint after dark */
  var BEAR_INK = { i: { token: 'PX Ice Deep', mode: ICE }, j: { token: 'PX Ice 2', mode: ICE }, N: glowOf('night', 'PX Ice Deep', 'PX Aurora Mint') };
  function bearVoxels(st, opt) {
    var lite = !!(opt && opt.lite), p = grid(G8), o = grid(G16, 0.5, 0.5), c = grid(G16, 0.5, 0.5), i, j, k;
    /* the plinth: stone, snow along its front and sides */
    p.box(-3, 2, 0, 0, -3, 1, 'Q');
    c.box(-6, 5, 2, 2, -6, 4, 'Q');
    if (!lite) c.box(-6, 5, 3, 3, 4, 4, '1').box(-6, -6, 3, 3, -6, 3, '2').box(5, 5, 3, 3, -6, 3, '1');
    /* the bear, then tinted: the paler ice on every top */
    BEAR.forEach(function (b) { o.blob(b[0], b[1], b[2], b[3], b[4], b[5], 'i', 2.5); });
    [-1, 1].forEach(function (s2) { o.box(s2, 3 * s2, 3, 12, 1, 2, 'i').box(s2, 3 * s2, 3, 4, 3, 4, 'i').box(4 * s2, 5 * s2, 3, 4, -1, 1, 'i'); });
    for (j = 3; j <= 23; j++) for (k = -8; k <= 6; k++) for (i = -6; i <= 6; i++) {
      if (!o.has(i, j, k)) continue;
      if (!o.has(i, j + 1, k)) o.set(i, j, k, 'j');
    }
    /* the face: dark eyes beside the muzzle, the dark nose at its tip; the aurora heart on its chest */
    o.set(-2, 20, o.front(-2, 20), 'e').set(2, 20, o.front(2, 20), 'e').set(0, 21, o.front(0, 21), 'e').set(0, 12, o.front(0, 12), 'N');
    /* the snow cap on its nose, on 'snowcap' */
    c.group('snowcap', function () { c.box(-1, 1, 22, 22, 3, 5, 's').box(0, 0, 23, 23, 4, 5, 's'); });
    return model('ice_bear', pal('sQe12', BEAR_INK), [p, [o, null, true], [c, null, true]], { pivots: { snowcap: BR.snowcap }, anchors: { spot: BR.spot }, ao: false });
  }

  /* ---------------- ice_cocoa ---------------- */
  function cocoaVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G4, 0.5, 0.5), r = grid(G8), d = grid(G16), m = grid(G8), h = grid(G16), n = grid(G16);
    /* the plank kiosk (G4): x −0.875 … 0.375, z −0.375 … 0.125, its serving window cut in the front */
    o.box(-3, 1, 0, 3, -1, 0, function (i, j, k) { return k === 0 && (j === 2 || j === 3) && i >= -2 && i <= 0 ? null : 'p'; });
    /* the warm light inside (state 'night') shows through the serving window and a little window beside it */
    n.box(-10, 1, 8, 13, -2, -2, 'Y').box(3, 4, 9, 11, 2, 2, 'Y');
    /* the hatch on 'hatch': a striped flap hinged at the window's top; up, it is the awning */
    h.group('hatch', function () { h.box(-10, 1, 8, 15, 2, 2, function (i) { return ((i + 10) >> 1) & 1 ? 'w' : 'c'; }); });
    /* the counter: a plank top on a front board, the full width of the hut and a little past it */
    d.box(-14, 8, 6, 7, 2, 5, function (i, j) { return j === 7 ? 'P' : 'p'; }).box(-14, 8, 0, 5, 4, 5, function (i, j) { return j === 5 ? 'c' : 'p'; });
    /* the roof: a plank slab, a deep layer of snow and its ridge, icicles along the front eave */
    r.box(-7, 2, 8, 8, -3, 2, 'b').box(-7, 2, 9, 9, -3, 1, 's').box(-1, 1, 10, 10, -2, 0, 'S');
    [-13, -7, -1, 3].forEach(function (x, q) { if (!lite || q === 1) h.box(x, x, 14 + (q & 1), 15, 5, 5, lite ? 'j' : '4'); });
    /* the giant mug pictogram on the roof: a red mug with a handle, cocoa and marshmallows */
    m.box(-5, -3, 10, 11, -2, 0, 'c').box(-2, -2, 10, 11, -1, -1, 'c').box(-5, -3, 12, 12, -2, 0, function (i, j, k) { return !lite && k === -2 && i < -3 ? 'w' : !lite && i === -3 && k === -1 ? 'y' : 'k'; });
    /* the urn on the counter's left end (steam rises from its lid) and a box of marshmallows */
    d.box(-13, -11, 8, 11, 3, 5, function (i, j) { return j === 11 ? 'b' : 'm'; }).set(-12, 9, 6, 'b');
    if (!lite) d.box(-9, -8, 8, 8, 3, 4, '9').set(-8, 9, 4, 'y');
    /* the stool at the right (anchor seat) and the mug on the counter's end on 'dishes' */
    d.box(11, 12, 0, 3, 3, 4, 'b').box(10, 13, 4, 4, 2, 5, 'p');
    d.group('dishes', function () { d.box(5, 6, 8, 9, 3, 4, 'c').box(5, 6, 10, 10, 3, 4, 'k').set(7, 9, 3, 'c').set(7, 9, 4, 'c'); if (!lite) d.set(5, 10, 4, '9'); });
    if (!lite) d.set(13, 0, 6, '1').set(-14, 0, -6, '2').set(-15, 0, 2, '1');
    return model('ice_cocoa', pal('pPbcwsSjkym1249', { Y: glowOf('night', 'PX Lamp Off', 'PX Ice Hut Glow') }),
      [o, [r, null, true], [n, null, true], [d, null, true], [h, null, true], [m, null, true]],
      { pivots: { hatch: CO.hatch, dishes: CO.dishes }, anchors: { seat: CO.seat }, ao: false });
  }

  /* ================================================================
     LOD1 — the far-island bakes (D106): a few plain boxes per piece, inside TRIS_CAPS_LOD1, keeping
     every lookEntries pivot
     ================================================================ */
  var LO = {
    ice_snowpenguin: function () {
      var b = grid(G8, 0.5, 0.5), f = grid(G16, 0.5, 0.5);
      b.box(-2, 2, 0, 4, -2, 1, 's');
      b.group('head', function () { b.box(-1, 1, 5, 6, -1, 1, 's'); });
      f.group('flipL', function () { f.box(5, 6, 5, 8, 0, 0, 'b'); });
      f.group('flipR', function () { f.box(-6, -5, 5, 8, 0, 0, 'b'); });
      return model('ice_snowpenguin', pal('sb'), [b, [f, null, true]], { pivots: { flipL: SP.flipL, flipR: SP.flipR, head: SP.head }, ao: false });
    },
    ice_pine: function (st) {
      var v = variantOf(st, 'ice_pine'), o = grid(G8, 0.5, 0.5), s = grid(G8, 0.5, 0.5), top = v ? 10 : 13;
      o.group('tree', function () { o.box(0, 0, 0, 2, 0, 0, 'b').box(-2, 2, 3, 5, -2, 2, 'g').box(-1, 1, 6, 8, -1, 1, 'G').box(0, 0, 9, top - 1, 0, 0, 'l'); });
      s.group('snow', function () { s.box(0, 0, top, top, 0, 0, 's'); });
      return model('ice_pine', pal('bgGls'), [o, [s, null, true]], { pivots: { tree: PN.tree, snow: PN.snow.concat(['tree']) }, ao: false });
    },
    ice_lantern: function () {
      var o = grid(G8);
      o.box(-1, 0, 0, 4, -1, 0, 'P').box(-2, 1, 5, 6, -2, 1, 'Y').box(-2, 1, 7, 7, -2, 1, 'V');
      return model('ice_lantern', pal('', { Y: lanternCore(), P: LANTERN_INK.P, V: LANTERN_INK.V }), [o], { ao: false });
    },
    ice_snowhut: function (st) {
      var v = variantOf(st, 'ice_snowhut'), o = grid(G8), w = grid(G8);
      o.box(-3, 2, 0, 3, -3, 2, 's').box(-2, 1, 4, 5, -2, 1, 's').box(-1, 0, 0, 1, 2, 2, 'c').set(CHIMNEY[0], 6, CHIMNEY[1], 'c');   /* the coral door, the chimney cap */
      if (v === 1) o.box(-1, 0, 6, 6, -1, 0, 'S');
      if (v === 2) o.box(2, 2, 4, 6, 2, 2, 'c');
      w.group('glow', function () { w.box(-2, -2, 3, 3, 3, 3, 'Y'); });
      return model('ice_snowhut', pal('sSc', { Y: glowOf('lit', 'PX Lamp Off', 'PX Ice Hut Glow') }), [o, [w, null, true]], { pivots: { glow: HUT.glow }, ao: false });
    },
    ice_penguin: function () {
      var o = grid(G8, 0.5, 0.5), p = grid(G16), c = grid(G16);
      o.box(-2, 2, 0, 0, -2, 2, 's');
      p.group('pen', function () { p.box(-4, -1, 2, 8, -2, 0, 'n').box(-4, -1, 2, 7, 1, 1, 'F'); });
      c.group('chick', function () { c.box(2, 4, 2, 6, -4, -2, 'n'); });
      return model('ice_penguin', pal('s', { n: 'PX Penguin Back', F: 'PX Penguin Front' }), [o, [p, null, true], [c, null, true]], { pivots: { pen: NEST.pen, chick: NEST.chick }, ao: false });
    },
    ice_bear: function () {
      var p = grid(G8), o = grid(G8, 0.5, 0.5), c = grid(G16, 0.5, 0.5);
      p.box(-3, 2, 0, 1, -3, 1, 'Q');
      o.box(-2, 2, 2, 5, -2, 0, 'i').box(-1, 1, 2, 4, 1, 1, 'i').box(-1, 1, 6, 7, -1, 0, 'i').box(-1, 1, 8, 9, -1, 1, 'i').box(0, 0, 10, 10, 1, 2, 'j');
      c.group('snowcap', function () { c.box(-1, 1, 22, 22, 3, 5, 's'); });
      return model('ice_bear', pal('Qs', { i: BEAR_INK.i, j: BEAR_INK.j }), [p, o, [c, null, true]], { pivots: { snowcap: BR.snowcap }, anchors: { spot: BR.spot }, ao: false });
    },
    ice_snowglobe: function () {
      var b = grid(G8, 0.5, 0.5), g = grid(G8, 0.5, 0.5), f = grid(G16, 0.5, 0.5);
      b.box(-2, 2, 0, 0, -2, 2, 'B');
      g.group('globe', function () { g.box(-2, 2, 1, 1, -2, 2, 's').set(0, 2, 1, 'n').box(-3, 3, 4, 4, 0, 0, 'i').box(0, 0, 4, 4, -3, 3, 'i').box(-2, 2, 7, 7, 0, 0, 'j').box(0, 0, 7, 7, -2, 2, 'j').box(0, 0, 8, 8, 0, 0, 'j'); });
      f.group('flakes', function () { f.set(-2, 5, 1, 'w').set(2, 5, -1, 'w'); });
      return model('ice_snowglobe', pal('sijn', { B: 'PX Sunny', w: 'PX Penguin Front' }), [b, [g, null, true], [f, null, true]], { pivots: { globe: GL.globe, flakes: GL.flakes.concat(['globe']) }, anchors: { spot: GL.spot }, ao: false });
    },
    ice_sculpture: function (st) {
      var v = variantOf(st, 'ice_sculpture'), o = grid(G8), f = grid(G8);
      o.box(-1, 0, 0, 2, -1, 0, 'K');
      f.group('spin', function () { f.box(-1, 0, 3, 9, -1, 0, 'i').box(-3, 2, 5, 5, -1, 0, 'i').box(-3, 2, 8, 8, -1, 0, 'i').box(-1, 0, 10, 10, -1, 0, 'j'); });
      return model('ice_sculpture', pal('', { i: ['PX Ice', 'PX Aurora Mint', 'PX Aurora Violet'][v], j: FLAKE_TIPS[v], K: 'PX Ice Deep' }), [o, [f, null, true]], { pivots: { spin: SC.spin }, ao: false });
    }
  };
  var BUILD = { ice_snowpenguin: snowpenguinVoxels, ice_pine: pineVoxels, ice_lantern: lanternVoxels, ice_snowhut: snowhutVoxels, ice_penguin: penguinVoxels,
                ice_sculpture: sculptureVoxels, ice_fishhole: fishholeVoxels, ice_snowglobe: snowglobeVoxels, ice_bear: bearVoxels, ice_cocoa: cocoaVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: a few plain boxes (LO), or the plain masses (no trims, details or decals), halved */
    lod1[id] = LO[id] ? function (st) { return LO[id](st); } : function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('ice-a', K → {id: {voxels, lod1, act, forget, idle?, show?, lit?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], E3 = [0, 0, 0], SN = {}, LP = {}, F0 = {}, F1 = {}, NOOPT = {};
    var drift = (L && L.ART3 && L.ART3.FREQS && L.ART3.FREQS.auroraDrift) || LN.hz;
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
    function midHigh(a) { var t = tierOf(a); return t === 'MID' || t === 'HIGH'; }
    /* the pet's part (the crew owns it: the look back at the hole, the bear's pose, the cocoa stool) */
    function askPet(a, id) {
      var p = a.pets, kind = (LOOKS[id] && LOOKS[id].perform) || PERFORM[id];
      if (!kind || !p || typeof p.perform !== 'function') return;
      try { p.perform(kind, a.uid); } catch (e) { /* no crew yet */ }
    }
    /* per-copy memory (what a toggle shows, the lamp level and drift step, the night level, the idle
       clocks): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, on: -1, lamp: -1, hue: -1, halo: false, pool: false, night: -1, wisp: null, still: false }; memo.set(a.uid, m); }
      return m;
    }
    function shownOf(a) { var m = mem(a); if (m.on < 0) m.on = a.lit ? 1 : 0; return m.on; }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* an own cue list under reduced motion: its sounds at t = 0 and one sparkle (as SLMotion's) */
    function stillCues(list) {
      var out = list.filter(function (c) { return c.sfx; }).map(function (c) { var q = {}; for (var k in c) q[k] = c[k]; q.t = 0; return q; });
      out.push({ t: 0, emit: 'sparkle', n: 1 });
      return out;
    }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me), rest(a, reduced, me), at?(cue, out) → local point, cut? (own seconds), cues? (own list, or
       fn(off)), adds? (emits played over the timeline's own sounds)}; opt {name (the timeline), off (a toggle played dark), quiet (the pet is not asked)} */
    function run(a, id, spec, opt) {
      opt = opt || NOOPT;
      var name = opt.name || ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, off = !!opt.off;
      var o = { reduced: reduced, off: off, from: prev && !reduced ? M.carry(prev.name, prev.out) : null };
      var own = typeof spec.cues === 'function' ? spec.cues(off) : spec.cues;
      var dur = reduced ? 0 : spec.cut || M.durOf(name, o), cues = !own ? M.cues(name, o) : reduced ? stillCues(own) : own;
      if (spec.adds && !reduced) cues = cues.concat(spec.adds).sort(function (x, y) { return x.t - y.t; });
      var ci = 0, done = false, uid = a.uid, me = { name: name, id: id, off: off, dur: dur, out: {}, mark: -1, reduced: reduced };
      live.set(uid, me);
      if (!opt.quiet) askPet(a, id);
      function stop() { done = true; if (live.get(uid) === me) live.delete(uid); }
      me.update = function (h, tAct) {
        if (done || live.get(uid) !== me) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur;
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, (c.emit !== 'sparkle' && spec.at && spec.at(c, me.out, h)) || 'top', c.n || 1);
            else if (typeof h.sfx === 'function') h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
          } catch (e) { /* a cue never stops its act */ }
        }
        if (t < dur) { spec.apply(h, me.out, tt, me); return true; }
        stop();
        spec.rest(h, reduced, me);
        return false;
      };
      me.cancel = function () { if (!done) { stop(); try { spec.rest(a, false, me); } catch (e) { /* the copy is gone */ } } };
      return me;
    }

    /* ---------- snow penguin: the twig flippers flap twice, the head nods once ---------- */
    function flippers(a, deg) { pose(a, 'flipL', 0, 0, deg, 0, 0, 0); pose(a, 'flipR', 0, 0, -deg, 0, 0, 0); }
    var waveSpec = {
      cues: SP.cues,
      apply: function (a, out, t) {
        flippers(a, SP.flap * (out.swing || 0));
        pose(a, 'head', SP.nod * Math.sin(Math.PI * seg(t, 0.3, 1.1)), 0, 0, 0, 0, 0);
      },
      /* reduced motion: the flippers held up */
      rest: function (a, reduced) { flippers(a, reduced ? SP.flap : 0); rest(a, 'head'); }
    };

    /* ---------- snowy pine: two sways, the caps slide off into the drift and build back ---------- */
    var shakeSpec = {
      adds: PN.adds,
      apply: function (a, out, t) {
        pose(a, 'tree', 0, 0, PN.sway * (out.swing || 0), 0, 0, 0);
        snowAt(t, out.k || 0, SN);
        pose(a, 'snow', 0, 0, 0, 0, 0, 0, SN.sxz, SN.sy, SN.sxz);
      },
      rest: function (a) { rest(a, 'tree'); rest(a, 'snow'); },
      at: function () { return PN.mid; }
    };

    /* ---------- the two lamps (lit memory): the aurora lantern drifts while it is on ---------- */
    function showOf(a, k) { return typeof k === 'number' ? k : a && typeof a.show === 'number' ? a.show : 0; }
    /* a lamp's level: its own (the tap memory or the fade) or the night's, written only when it moves;
       the lantern's colour steps round the aurora while it is full on (steady mint under reduced motion);
       a halo on MID / HIGH while lit; the lantern's cold pool on the ground at night */
    function lampApply(a, id, k, show, idle) {
      var m = mem(a), night = nightOf(showOf(a, show)), lv = Math.round(100 * Math.max(clamp01(k), night)) / 100, on = lv > 0.5;
      var cfg = id === 'ice_lantern' ? LN : HUT, halo = on && tierOf(a) !== 'LOW', pool = id === 'ice_lantern' && on && night > 0.5;
      var hue = id === 'ice_lantern' && lv >= 1 && !a.reduced && idle ? auroraStep(a.t, drift, a.phase) : -1;
      if (lv !== m.lamp || hue !== m.hue) { m.lamp = lv; m.hue = hue; setState(a, 'lit', hue >= 0 ? 'a' + hue : lv); }
      if (halo !== m.halo && typeof a.halo === 'function') {
        m.halo = halo;
        try { a.halo('glow', halo, cfg.halo, id === 'ice_lantern' ? 'PX Aurora Sky' : 'Lamp Halo'); } catch (e) { /* fx is optional */ }
      }
      if (pool !== m.pool && typeof a.decal === 'function') { m.pool = pool; try { a.decal(pool, 'PX Aurora Mint'); } catch (e) { /* fx is optional */ } }
    }
    var glowSpec = {
      cues: LN.cues,
      apply: function (a, out, t, me) {
        lampApply(a, me.id, out.k);
        if (me.id === 'ice_snowhut') { var s = me.off ? 1 : 1 + HUT.pop * Math.sin(Math.PI * clamp01(t / me.dur)); pose(a, 'glow', 0, 0, 0, 0, 0, 0, s, s, s); }
      },
      rest: function (a, reduced, me) { lampApply(a, me.id, me.off ? 0 : 1); if (me.id === 'ice_snowhut') rest(a, 'glow'); }
    };
    function toggleAct(a, id, name) {
      if (!a) return null;
      var on = wantOn(name, a.lit, shownOf(a));
      mem(a).on = on;
      return run(a, id, glowSpec, { off: !on, name: 'glow', quiet: !on });
    }
    function toggleShow(id) { return function (a, k) { if (a && !live.get(a.uid)) lampApply(a, id, shownOf(a), k); }; }
    function toggleLit(id) {
      return function (a, on) {
        if (!a) return;
        live.delete(a.uid);
        mem(a).on = on ? 1 : 0;
        lampApply(a, id, on ? 1 : 0);
      };
    }
    /* the lantern's drift: it steps round the aurora (0.1 Hz) while it is full on; still otherwise */
    function lanternIdle(a) {
      if (!a || live.get(a.uid)) return !!a;
      var m = mem(a);
      lampApply(a, 'ice_lantern', shownOf(a), undefined, true);
      return m.lamp >= 1 && !a.reduced;
    }

    /* ---------- the night glows of the sculpture, the globe, the bear and the cocoa hut ---------- */
    function nightShow(a, k) {
      if (!a) return;
      var m = mem(a), lv = Math.round(100 * nightOf(showOf(a, k))) / 100;
      if (lv !== m.night) { m.night = lv; setState(a, 'night', lv); }
    }

    /* ---------- penguin pair: a hop off the nest, one tight loop, a bow to the chick, a hop back ---------- */
    function nestPose(a, k, roll, bow, t, reduced) {
      loopAt(k, LP);
      var turn = reduced ? 1 : seg(t, 1.75, 1.95) * (1 - seg(t, 2.3, 2.5)), hop = reduced ? 0 : NEST.hop * (Math.sin(Math.PI * seg(k, 0, 0.08)) + Math.sin(Math.PI * seg(k, 0.92, 1)));
      euler(LP.yaw + NEST.face * turn, bow * NEST.bow, roll * NEST.roll, E3);
      pose(a, 'pen', E3[0], E3[1], E3[2], LP.x, hop, LP.z);
      /* the chick turns to watch it go round, then bows back */
      var watch = reduced ? -NEST.watch : -NEST.watch * Math.max(Math.sin(Math.PI * clamp01(k)), turn);
      euler(watch, bow * NEST.bow * 0.8, 0, E3);
      pose(a, 'chick', E3[0], E3[1], E3[2], 0, reduced ? 0 : NEST.chickHop * bow, 0);
    }
    var waddleSpec = {
      apply: function (a, out, t) { nestPose(a, out.k || 0, out.swing || 0, out.bob || 0, t, false); },
      /* reduced motion: the pair shown mid-bow */
      rest: function (a, reduced) { if (reduced) nestPose(a, 1, 0, 1, 2, true); else { rest(a, 'pen'); rest(a, 'chick'); } }
    };

    /* ---------- snowflake sculpture: a quarter turn, a shine up it, the music box ---------- */
    var chimeSpec = {
      adds: SC.adds,
      apply: function (a, out) { pose(a, 'spin', 0, (tierOf(a) === 'LOW' ? SC.turnLow : SC.turn) * (out.k || 0), 0, 0, 0, 0); },
      /* a quarter turn of the crossed flakes (half a turn of LOW's one flake) lands on its rest pose */
      rest: function (a) { rest(a, 'spin'); },
      at: function (c) { return SC.glints[c.p]; }
    };

    /* ---------- fishing hole: a fish leaps and dives, a smaller one follows; the float bobs ---------- */
    function floatY(a) { return midHigh(a) && !a.reduced ? FH.bob * Math.sin(2 * Math.PI * (FH.idle * (+a.t || 0) + (+a.phase || 0))) : 0; }
    var lag = (M && M.ACTS && M.ACTS.fish && M.ACTS.fish.lag) || 0.5;
    var fishSpec = {
      apply: function (a, out, t) {
        fishAt(t, FH.arc0, F0); fishAt(t - lag, FH.arc1, F1);
        pose(a, 'fish0', 0, 0, F0.pitch, F0.x, F0.y, 0);
        pose(a, 'fish1', 0, 180, F1.pitch, -F1.x, F1.y, 0);
        var dip = FH.dip * (Math.sin(Math.PI * seg(t, 0.85, 1.15)) + 0.7 * Math.sin(Math.PI * seg(t, 1.35, 1.65)));
        pose(a, 'float', 0, 0, 0, 0, floatY(a) - dip, 0);
      },
      rest: function (a) { rest(a, 'fish0'); rest(a, 'fish1'); pose(a, 'float', 0, 0, 0, 0, floatY(a), 0); },
      at: function () { return FH.hole; }
    };
    function fishIdle(a) {
      if (!a || !M) return false;
      if (live.get(a.uid)) return true;
      var m = mem(a), on = midHigh(a) && !a.reduced;
      if (!on) { if (m.still) return false; m.still = true; rest(a, 'float'); return true; }
      m.still = false;
      pose(a, 'float', 0, 0, 0, 0, floatY(a), 0);
      return true;
    }

    /* ---------- snow globe: it rocks twice; the flakes swirl up and drift back down ---------- */
    var globeSpec = {
      apply: function (a, out) {
        var k = out.k || 0, s = k < GL.rise ? 1 + (GL.up - 1) * Math.sin(0.5 * Math.PI * k / GL.rise) : 1 + (GL.up - 1) * (1 - inOut((k - GL.rise) / (1 - GL.rise)));
        pose(a, 'globe', 0, 0, GL.rock * (out.swing || 0), 0, 0, 0);
        pose(a, 'flakes', 0, GL.spin * inOut(k), 0, 0, 0, 0, 1, s, 1);
      },
      rest: function (a) { rest(a, 'globe'); rest(a, 'flakes'); }
    };

    /* ---------- ice bear: a shine nose to tail, the snow cap slides off and pops back; the pet poses ---------- */
    var poseSpec = {
      adds: BR.adds,
      apply: function (a, out, t) {
        var u = seg(t, BR.slide[0], BR.slide[1]), f = u * u, back = seg(t, BR.back[0], BR.back[1]);
        if (t < BR.back[0]) pose(a, 'snowcap', -40 * u, 0, 0, 0, BR.drop[1] * f, BR.drop[2] * u + 0.12 * Math.sin(Math.PI * u));
        else { var s = outBack(back); pose(a, 'snowcap', 0, 0, 0, 0, 0, 0, s, s, s); }
      },
      rest: function (a) { rest(a, 'snowcap'); },
      at: function (c) { return BR.glints[c.p]; }
    };

    /* ---------- hot-cocoa hut: the hatch flips up, a fresh mug pops onto the counter, steam ---------- */
    var serveSpec = {
      cut: CO.cut, cues: CO.cues,
      apply: function (a, out, t) {
        var up = t < CO.shut[0] ? outBack(seg(t, CO.open[0], CO.open[1])) : 1 - inOut(seg(t, CO.shut[0], CO.shut[1]));
        pose(a, 'hatch', -CO.deg * up, 0, 0, 0, 0, 0);
        var s = t < CO.pop[0] ? 1 - 0.2 * seg(t, CO.pop[0] - 0.3, CO.pop[0]) : 0.8 + 0.2 * outBack(seg(t, CO.pop[0], CO.pop[1]));
        pose(a, 'dishes', 0, 0, 0, 0, 0, 0, s, s, s);
      },
      rest: function (a) { rest(a, 'hatch'); rest(a, 'dishes'); },
      at: function () { return [CO.dishes[0], CO.dishes[1] + 0.2, CO.dishes[2]]; }
    };
    /* idle: a 3-cube steam wisp from the urn every 5 s, MID / HIGH, never under reduced motion */
    function cocoaIdle(a) {
      if (!a || a.reduced || !midHigh(a)) return false;
      var m = mem(a), n = Math.floor(((+a.t || 0) + (+a.phase || 0) * CO.every) / CO.every);
      if (m.wisp === null) { m.wisp = n; return false; }
      if (n === m.wisp) return false;
      m.wisp = n;
      emit(a, 'wisp', CO.urn, 3);
      return true;
    }

    var SPEC = { ice_snowpenguin: waveSpec, ice_pine: shakeSpec, ice_penguin: waddleSpec, ice_sculpture: chimeSpec, ice_fishhole: fishSpec,
                 ice_snowglobe: globeSpec, ice_bear: poseSpec, ice_cocoa: serveSpec }, out = {};
    var NIGHT = ['ice_sculpture', 'ice_snowglobe', 'ice_bear', 'ice_cocoa'];
    IDS.forEach(function (id) {
      var h = { voxels: voxels[id], lod1: lod1[id], forget: forget };
      if (TOGGLES.indexOf(id) >= 0) { h.act = function (a, name) { return toggleAct(a, id, name); }; h.show = toggleShow(id); h.lit = toggleLit(id); }
      else h.act = function (a) { return run(a, id, SPEC[id]); };
      if (NIGHT.indexOf(id) >= 0) h.show = nightShow;
      out[id] = h;
    });
    out.ice_lantern.idle = lanternIdle;
    out.ice_fishhole.idle = fishIdle;
    out.ice_cocoa.idle = cocoaIdle;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, VARIANTS: VARIANTS, ACT: ACT, PERFORM: PERFORM, TOGGLES: TOGGLES, HELPERS: HELPERS, TOKENS: TOKENS, AURORA: AURORA,
    voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { snowpenguin: SP, pine: PN, lantern: LN, hut: HUT, nest: NEST, sculpture: SC, fishhole: FH, globe: GL, bear: BR, cocoa: CO },
    nightOf: nightOf, wantOn: wantOn, auroraStep: auroraStep, snowAt: snowAt, fishAt: fishAt, loopAt: loopAt, euler: euler
  };
}));
