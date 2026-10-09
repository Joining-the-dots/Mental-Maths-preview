/* ================================================================
   My Island v3 — SLPxJungleB (W3.2e): the Jungle Treehouse Village's huts, stalls, ruins, trees
   and wildlife in Pixel Blocks. window.SLPxJungleB + SL3D.defineVox('jungle-b', factory) in the
   browser, module.exports in Node. Every model is pure data (voxels(st) → VoxModel: no THREE, no
   DOM); the island, the photocards and the Node tests mesh the same source. Item space as the kit:
   base y = 0, pivot at the footprint centre, facing +z; everything below y 1.0 stays inside
   fp − 0.14 u (roofs, eaves, crowns, fronds, leaves, the leaf cap and the perch bar overhang above it).
     jungle_waterwheel  1×1  a bamboo wheel on 'wheel' (a golden rim, eight paddles, every other one
                        blue with water, four spokes, a rope-lashed hub) dipping into a plank tub,
                        hung in a bamboo frame with a top bar; a split-bamboo chute off the wheel's top
                        pours a stream into the tub, where a lily opens on 'lily'. The wheel is 0.81 u
                        across: the art note's 1.1 u cannot turn inside a 1×1 cell below y 1.0.
     jungle_smoothie    1×1  a fruit bar on four bamboo posts under a two-layer banana-leaf roof: a
                        slatted counter, the hand-crank blender jar on 'jar' (four fruit colours in pale
                        glass), two coconut-shell cups with straws on 'dishes', a pineapple on the back
                        shelf, bananas on the front post, a log stool in front (anchor seat). Its sign
                        on the roof is the cup and leaf pictograms (D32).
     jungle_arch        2×1  two square pillars of weathered stone blocks in two tones (a chipped
                        corner or two), a lintel, a stepped top and a proud keystone, moss caps, vines
                        down both pillars, a fallen block and ferns. Plain blocks: nothing is carved on
                        them. Six flowers open along the vines; they ride the helper pivots bud0 … bud4
                        (the two by the keystone share bud2: six bud pivots and the stone would pass
                        the kit's six parts). Anchors under (the 1 × 1.25 u opening), spot.
     jungle_stilthut    1×1  the first plan's woven hut on four bamboo stilts: a plank deck with a
                        porch, a ladder, a door and a round front window that lights up on 'glow' (glow
                        state 'lit'), a stepped thatch roof; 3 ridge trims (and eave fringes on MID /
                        HIGH): thatch gold, leaf green, flower pink.
     jungle_market      1×1  a thatched booth with a basket, a clay pot of flowers and a stack of
                        folded striped blankets TOGETHER on one counter (D101); the rolled leaf shutter
                        hangs from the eave on 'shutter' (shut) and rolls up under it when open. 3
                        colourways of the eave's edge.
     jungle_fruitstall  1×1  a plank cart on two log wheels with three stepped crates (melons, mangoes
                        and dragon fruit, bananas) under a leaf or thatch awning on two poles; the
                        pineapple, the mango and the banana bunch on the front crate ride f0 … f2.
     jungle_coconut     1×1  a ringed trunk curving up and over to a crown of six arching fronds on
                        'crown' with two coconuts; the front coconut rides 'nut'. Taller, curved and
                        darker than Home's palm.
     jungle_banana      1×1  a thick green stem, four long paddle leaves on narrow stalks and a rolled
                        young leaf on 'leaves', a hanging bunch of bananas over a pink bud on 'bunch'.
     jungle_parrot      1×1  a bark T-perch on a stone foot with a hanging fruit dish and an original
                        voxel parrot on 'bird' (its wings on 'wings'). 2 birds: red with blue-and-yellow
                        wings, blue with a yellow chest.
     jungle_lantern     1×1  a bamboo pole on a moss-stone foot; a woven shade round the lamp (glow
                        state 'lit': it glows, never a flame) under a leaf cap. 2 shades.
   The arch is modelled in flower and the market shut (what a photocard and a far island show);
   show(a) / lit(a, on) and the acts pose them, and the lamps, from the lit memory.
   AO: the small pieces mesh without corner AO (pier-a's choice) so their LOW caps hold; the shack and
   the arch keep it. LOW (D89, D106): detail voxels are tagged lod 'mid'. LOD1: the small pieces
   bring a few plain boxes, the shack, the arch and the wheel their plain masses halved, all inside
   TRIS_CAPS_LOD1 with every lookEntries pivot.
   ACTS run on SLMotion timelines by name: bloom, open / close, glow, coconut, juggle, wave, chirp,
   and the two shared names spin and serve, cut to this file's 2.5 s shows with their own cues.
   One live act per uid (a re-tap supersedes). Toggles (glow, open, bloom) keep a per-copy memory:
   'glowOn' / 'glowOff' / 'close' are explicit; the bare act follows a.lit when the host has already
   flipped the memory, else it toggles what the copy shows. Reduced motion is the end state at once
   with the same sounds and one sparkle (the wheel one paddle on, the parrot's wings open). The pet's
   part is a.pets.perform(LOOK perform kind, uid): the feast at the shack, the look up under the arch.
   Rates: the wings 1.6 Hz, the crown 1.25 Hz, the leaves 1.25 Hz, the jar 1.5 turns a second, the
   wheel's idle 0.05 turns a second, drips twice a second — all under MAX_FLASH_HZ; the lamps fade in
   0.3 s and stay steady. No word, no five-point star, no flame; no coins, prices or tills; nothing
   here reads, awards or spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.lit a.show a.batch a.template · a.pivot(name).set(
   rotDeg[3], pos[3], scale[3]) · a.state(key, v) · a.halo · a.decal · a.emit(kind, localPos, n,
   opts) · a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxJungleB = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('jungle-b', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxJungleB: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }

  var VERSION = 1;
  var IDS = ['jungle_waterwheel', 'jungle_smoothie', 'jungle_arch', 'jungle_stilthut', 'jungle_market',
             'jungle_coconut', 'jungle_fruitstall', 'jungle_banana', 'jungle_parrot', 'jungle_lantern'];
  var VARIANTS = { jungle_stilthut: 3, jungle_market: 3, jungle_fruitstall: 2, jungle_parrot: 2, jungle_lantern: 2 };
  var G8 = 0.125, G16 = 0.0625;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { jungle_waterwheel: 'spin', jungle_smoothie: 'serve', jungle_arch: 'bloom', jungle_stilthut: 'glow', jungle_market: 'open',
              jungle_coconut: 'coconut', jungle_fruitstall: 'juggle', jungle_banana: 'wave', jungle_parrot: 'chirp', jungle_lantern: 'glow' };
  var PERFORM = { jungle_smoothie: 'feast', jungle_arch: 'stand:lookBack' };
  /* the remembered toggles (lit memory: lamp on, shutter up, in flower) */
  var TOGGLES = ['jungle_stilthut', 'jungle_lantern', 'jungle_market', 'jungle_arch'];
  /* pivots beyond the lookEntries lists: the arch's flowers (LOOK's state part 'blooms', six buds scaled 0 → 1) */
  var HELPERS = { jungle_arch: ['bud0', 'bud1', 'bud2', 'bud3', 'bud4'] };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */
  /* the module tokens (D50): the ruins' second stone tone, the clay pot, the coconuts' husk */
  var TOKENS = { 'PX Ruin Stone Shade': '#7E9A80', 'PX Village Clay': '#E07F55', 'PX Coconut Husk': '#6E4528' };
  var tokensFor = null;
  function ready() {
    var L = look();
    if (L && tokensFor !== L && typeof L.addTokens === 'function') { L.addTokens('px-jungle-b', TOKENS); tokensFor = L; }
  }

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var LN = { glow: [0, 1.15625, 0], halo: 0.8, cues: [{ t: 0, sfx: 'chip', vol: 0.4 }, { t: 0.1, sfx: 'beep', vol: 0.2 }] };
  var HUT = { glow: [0.1875, 0.8125, 0.28125], pop: 0.12, halo: 0.6 };
  var MK = { hinge: [0, 1, 0.34375], roll: 0.2, cues: { open: [{ t: 0, sfx: 'chip' }, { t: 0.4, emit: 'sparkle', n: 2 }], close: [{ t: 0, sfx: 'chip', step: 1 }] } };
  var FS = { fruit: [[-0.21875, 0.5625, 0.1875], [0.03125, 0.5625, 0.1875], [0.25, 0.5625, 0.1875]], hop: 0.5, squash: 0.25, lag: 0.25 };   /* f0 pineapple, f1 mango, f2 bananas */
  var PR = { feet: [-0.1875, 1.125, 0], wings: [-0.1875, 1.1875, 0], step: 0.125, hop: 0.0625, spread: 0.5, raise: 0.4 };
  var CO = { crown: [0.25, 2.5, 0], nut: [0.28125, 2.34375, 0.21875], foot: [0.03125, 0.09375, 0.21875], nod: 7, drop: 0.2153, bounce: 0.18, pop: 2.2, popDur: 0.25 };
  var BN = { leaves: [0, 1.5, 0], bunch: [0.1875, 1.4375, 0.1875], deg: 8, tilt: 4, swing: 6 };
  /* the six flowers, left to right: [x, y] (item metres, on the vines' front) and the pivot each rides;
     part is its index on SLMotion's bloom (the keystone pair opens between its two) */
  var AR = {
    buds: [[-0.6875, 0.5, 'bud0'], [-0.6875, 0.9375, 'bud1'], [-0.3125, 1.3125, 'bud2'], [0.3125, 1.3125, 'bud2'], [0.6875, 0.9375, 'bud3'], [0.6875, 0.5, 'bud4']],
    part: { bud0: 0, bud1: 1, bud2: 2.5, bud3: 4, bud4: 5 }, z: 0.28125, keystone: [0, 1.375, 0.28125], under: [0, 0, 0], spot: [0, 0, 0.34375],
    fly: [0, 1.75, 0.3125], flyAt: 1.4
  };
  var WH = {
    hub: [0, 0.65625, 0.03125], lily: [-0.25, 0.3125, 0.25], spout: [0.1875, 0.25, 0.3125], spot: [0, 0, 0.375],
    idle: 0.05, turn: 2, cut: 2.5, step: 45, drip: 0.5, dripN: 5, dripFrom: 0.5, dripTo: 2,
    cues: [{ t: 0.05, sfx: 'creak' }, { t: 1.1, sfx: 'creak', step: 1 }, { t: 1.9, sfx: 'splash', vol: 0.3 }]
  };
  var SM = {
    jar: [-0.21875, 0.625, 0.15625], dishes: [0.1875, 0.625, 0.125], seat: [0.0625, 0.25, 0.3125], spin: [0.1, 1.1], turns: 1.5, pop: [1.2, 1.5], cut: 2.5,
    cues: [{ t: 0.1, sfx: 'whoosh', vol: 0.5 }, { t: 1.2, sfx: 'pop' }, { t: 1.2, emit: 'sparkle', n: 2 }, { t: 1.8, sfx: 'voice', pet: true }]
  };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function inOut(u) { return (1 - Math.cos(Math.PI * clamp01(u))) / 2; }
  function outBack(u) { u = clamp01(u) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
  /* how far the night has come on for lamps: 0 by day, 1 from dusk on (as the garden lamps) */
  function nightOf(k) { var u = clamp01(((+k || 0) - 0.35) / 0.3); return u * u * (3 - 2 * u); }
  /* the wheel's own 'spin' at t: out.deg (one eased turn in WH.turn s), out.lily (it dips, then pops 0.8 → 1) */
  function wheelAt(t, out) {
    out = out || {};
    out.deg = 360 * inOut(t / WH.turn);
    out.lily = t < WH.turn ? 1 - 0.2 * seg(t, 0.2, 0.6) : 0.8 + 0.2 * outBack(seg(t, WH.turn, WH.turn + 0.35));
    return out;
  }
  /* the shack's own 'serve' at t: out.jar (degrees: 1.5 turns in 1 s), out.cups (they pop 0.8 → 1) */
  function serveAt(t, out) {
    out = out || {};
    out.jar = (360 * SM.turns * inOut(seg(t, SM.spin[0], SM.spin[1]))) % 360;
    out.cups = t < SM.pop[0] ? 1 : 0.8 + 0.2 * outBack(seg(t, SM.pop[0], SM.pop[1]));
    return out;
  }
  /* the coconut for a sampled 'coconut' pose {k, bob} at t: its offset from its place in the crown,
     its roll (degrees) and its scale. It drops (k 0 → CO.drop), bounces once (bob), rolls to the
     trunk (k → 1), waits, and pops back into the crown at CO.pop */
  function nutAt(k, bob, t, out) {
    out = out || {};
    out.x = out.y = out.z = out.roll = 0; out.s = 1;
    if (t >= CO.pop) { out.s = outBack(seg(t, CO.pop, CO.pop + CO.popDur)); return out; }
    if (!(k > 0)) return out;
    var fall = clamp01(k / CO.drop), r = k <= CO.drop ? 0 : inOut((k - CO.drop) / (1 - CO.drop));
    out.x = (CO.foot[0] - CO.nut[0]) * r; out.z = (CO.foot[2] - CO.nut[2]) * r;
    out.y = (CO.foot[1] - CO.nut[1]) * fall * fall + CO.bounce * (bob || 0);
    out.roll = 360 * r;
    return out;
  }
  /* one hero fruit of 'juggle' for its own bob at its own time tl: the hop, one turn, the landing squash */
  function fruitAt(bob, tl, out) {
    out = out || {};
    out.y = FS.hop * (bob || 0); out.turn = 360 * inOut(seg(tl, 0.1, 0.62));
    out.sy = tl > 0.6 && tl < 0.7 ? 1 - FS.squash * Math.sin(Math.PI * (tl - 0.6) / 0.1) : 1;
    return out;
  }
  /* a toggle's target (1 = on / open / in flower): the explicit names win; the bare act follows a.lit
     when the host has already flipped the memory, else it toggles what the copy shows */
  function wantOn(name, lit, shown) {
    if (name === 'glowOn') return 1;
    if (name === 'glowOff' || name === 'close') return 0;
    var l = lit ? 1 : 0;
    if (shown !== 0 && shown !== 1) return l ? 0 : 1;
    return l !== shown ? l : shown ? 0 : 1;
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz, oy) { return VX().grid({ grid: g, origin: [ox || 0, oy || 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at] | [grid, at, true] (true: no ground under it — posts,
     hanging and raised parts mesh without the ground's AO)]; empty grids are left out; o.pivots
     {name: [x, y, z]} and o.anchors {name: [x, y, z]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = Array.isArray(l) ? l[0] : l, n = m.layers.length, ly;
      if (!g.count) return;
      ly = { vox: g.snapshot() };
      if (Array.isArray(l) && l[1]) ly.at = l[1];
      if (Array.isArray(l) && l[2]) ly.ground = false;
      m.layers.push(ly);
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { m.pivots[n] = { at: U(o.pivots[n]), parent: null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { m.anchors[n] = U(o.anchors[n]); });
    if (o.cull) m.cull = o.cull;
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('kKr', {…}) picks from it. The digits are the MID / HIGH detail
     twins (lod 'mid': tier LOW drops them, D89) */
  var LEAF = 'leaf', SOFT = 'soft', MID = 'mid';
  function lamp() { return { token: 'PX Lamp Warm', mode: 'glow', state: { key: 'lit', off: 'PX Lamp Off', on: 'PX Lamp Warm', initial: 0 } }; }
  var INK = {
    k: 'PX Jungle Bark', K: 'PX Jungle Bark Light', r: 'PX Jungle Rope', t: 'PX Jungle Thatch', T: 'PX Jungle Thatch Shade', n: 'PX Tree Bark',
    s: 'PX Jungle Moss Stone', S: 'PX Ruin Stone Shade', w: 'PX Cream', e: 'PX Penguin Back', E: 'PX Ink Eye', y: 'PX Banana', Y: 'PX Sunny',
    l: { token: 'PX Jungle Canopy', mode: LEAF }, L: { token: 'PX Jungle Canopy Light', mode: LEAF }, g: { token: 'PX Jungle Canopy Deep', mode: LEAF },
    p: 'PX Jungle Flower Pink', o: 'PX Jungle Flower Orange', u: 'PX Jungle Parrot Blue', c: 'PX Village Clay',
    a: { token: 'PX Jungle Water 1', mode: SOFT }, j: 'PX Lens Pale', h: 'PX Coconut Husk',
    D: { token: 'PX Jungle Bark Light', mode: 'plank' }, W: { token: 'PX Jungle Rope', mode: 'plank' },
    1: { token: 'PX Jungle Canopy Deep', mode: LEAF, lod: MID }, 2: { token: 'PX Jungle Canopy Light', mode: LEAF, lod: MID },
    3: { token: 'PX Jungle Flower Pink', lod: MID }, 4: { token: 'PX Jungle Flower Orange', lod: MID }, 5: { token: 'PX Banana', lod: MID },
    6: { token: 'PX Jungle Rope', lod: MID }, 7: { token: 'PX Jungle Bark', lod: MID }, 8: { token: 'PX Jungle Thatch Shade', lod: MID },
    9: { token: 'PX Jungle Bark Light', lod: MID }, 0: { token: 'PX Cream', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    ready();
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  function variantOf(st, id) { var n = VARIANTS[id], v = st && typeof st.variant === 'number' && isFinite(st.variant) ? st.variant | 0 : 0; return v < 0 ? 0 : v >= n ? n - 1 : v; }
  /* the colourway tokens (D101): the hut's ridge, the market's eave, the awning, the bird, the shade */
  var VTOK = { jungle_stilthut: ['PX Jungle Thatch Shade', 'PX Jungle Canopy', 'PX Jungle Flower Pink'], jungle_market: ['PX Jungle Thatch Shade', 'PX Jungle Canopy', 'PX Jungle Flower Pink'],
               jungle_fruitstall: ['PX Jungle Canopy', 'PX Jungle Thatch'], jungle_parrot: ['PX Jungle Parrot Red', 'PX Jungle Parrot Blue'], jungle_lantern: ['PX Jungle Thatch', 'PX Jungle Canopy'] };
  /* MID / HIGH decor on G16: a fern tuft (a tall blade and four shorter ones) */
  function tuft(g, i, k, h, j0) {
    j0 = j0 || 0;
    g.box(i, i, j0, j0 + h - 1, k, k, '1');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, n) { g.box(i + d[0], i + d[0], j0, j0 + h - 3 + (n & 1), k + d[1], k + d[1], '2'); });
  }
  /* an n × n square with its corners off (logs, tubs, lily pads) */
  function round(g, i, i1, j, j1, k, k1, c) {
    g.box(i, i1, j, j1, k, k1, function (x, y, z) { return (x === i || x === i1) && (z === k || z === k1) ? null : typeof c === 'function' ? c(x, y, z) : c; });
  }
  /* a flower facing +z on G16: a plus of petals round its eye (the eye is flush) */
  function flower(g, i, j, k, c, eye) { g.box(i - 1, i + 1, j, j, k, k, c).box(i, i, j - 1, j + 1, k, k, c).set(i, j, k, eye || 'y'); }

  /* ---------------- jungle_lantern ---------------- */
  function lanternVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'jungle_lantern'), o = grid(G16);
    o.box(-3, 2, 0, 1, -3, 2, 's');                                                                   /* a moss-stone foot */
    o.box(-1, 0, 2, 14, -1, 0, 'K');                                                                  /* the bamboo pole */
    /* the woven shade round the lamp: two plates, four corner canes and a band, the light between them */
    o.box(-3, 2, 15, 21, -3, 2, function (i, j, k) {
      if (j === 15 || j === 21) return 'H';
      return (i === -3 || i === 2) && (k === -3 || k === 2) || (j === 18 && !lite) ? 'B' : 'Y';
    });
    o.box(-4, 3, 22, 22, -4, 3, 'C').box(-2, 1, 23, 23, -2, 1, 'C');                                  /* the leaf cap */
    if (!lite) {
      o.box(-2, 1, 13, 13, -2, 1, function (i, y, k) { return i > -2 && i < 1 && k > -2 && k < 1 ? 'K' : '6'; });   /* a rope lashing */
      [6, 10].forEach(function (j) { o.box(-2, 1, j, j, -2, 1, function (i, y, k) { return i > -2 && i < 1 && k > -2 && k < 1 ? 'K' : '7'; }); });   /* darker joints every 0.25 u */
      [[-4, -4, '2'], [3, -4, '1'], [-4, 3, '1'], [3, 3, '2']].forEach(function (q) { o.set(q[0], 21, q[1], q[2]); });   /* leaf tips */
      o.set(-3, 2, 2, '2').set(2, 2, -3, '2').set(-3, 2, 1, '1');                                         /* moss on the foot */
    }
    var shade = VTOK.jungle_lantern[v];
    return model('jungle_lantern', pal('sK12', {
      H: v ? { token: 'PX Jungle Canopy Deep', mode: LEAF } : 'PX Jungle Thatch Shade', B: v ? { token: shade, mode: LEAF } : shade,
      C: v ? 'PX Jungle Thatch' : { token: 'PX Jungle Canopy', mode: LEAF }, Y: lamp(), 6: INK[6], 7: INK[7] }),
      [o], { anchors: { glow: LN.glow }, ao: false });
  }

  /* ---------------- jungle_stilthut ---------------- */
  function stilthutVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'jungle_stilthut'), p = grid(G8), o = grid(G8), w = grid(G16), d = grid(G16);
    [[-3, -3], [2, -3], [-3, 1], [2, 1]].forEach(function (c) { p.box(c[0], c[0], 0, 3, c[1], c[1], 'k'); });   /* four bamboo stilts */
    /* the deck and its porch (a gap at the front left for the ladder), the woven hut and its door */
    o.box(-3, 2, 4, 4, -3, 2, function (i, j, k) { return k === 2 && i < -1 ? null : 'D'; });
    o.box(-3, 2, 5, 7, -3, 1, function (i, j, k) { return k === 1 && j < 7 && (i === -2 || i === -1) ? 'n' : 'W'; });
    /* a stepped thatch roof, short at the front so the door and the window show; its ridge is the trim */
    o.box(-4, 3, 8, 8, -4, 2, 'T').box(-3, 2, 9, 9, -3, 1, 't').box(-2, 1, 10, 10, -2, 0, 't').box(-2, 1, 11, 11, -1, -1, 'R');
    /* the round front window (G16, on 'glow'), just proud of the wall; the ladder's two rails */
    w.group('glow', function () { round(w, 1, 4, 10, 13, 4, 4, 'Y'); });
    w.box(-6, -6, 0, 10, 5, 5, 'K').box(-3, -3, 0, 10, 5, 5, 'K');
    if (!lite) {
      [2, 5, 8].forEach(function (j) { d.box(-5, -4, j, j, 5, 5, '9'); });                              /* the rungs */
      d.box(-1, 0, 10, 11, 5, 5, 'c').set(-1, 12, 5, '3').set(0, 12, 5, '4');                            /* a flower pot on the porch */
      d.box(-6, 5, 16, 16, 6, 6, v === 1 ? '2' : v === 2 ? '3' : '8');                                   /* the eave's fringe in the trim's colour */
      if (v === 2) [-3, 2].forEach(function (i) { d.set(i, 23, -2, '5'); });                            /* the flower ridge's eyes */
      if (v === 1) d.box(-5, -5, 22, 22, -2, -1, '2').box(4, 4, 22, 22, -2, -1, '1');                    /* leaf ends on the leaf ridge */
    }
    return model('jungle_stilthut', pal('kKDWntTc1234589', { R: VTOK.jungle_stilthut[v], Y: lamp() }),
      [[p, null, true], o, [w, null, true], [d, null, true]], { pivots: { glow: HUT.glow }, ao: false });
  }

  /* ---------------- jungle_market ---------------- */
  function marketVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'jungle_market'), o = grid(G8), s = grid(G16), d = grid(G16);
    o.box(-3, 2, 0, 7, -3, -3, 'W');                                                                    /* the woven back wall */
    o.box(-3, 2, 0, 3, -1, 1, function (i, j) { return j === 3 ? 'D' : 'W'; }).box(-3, -3, 4, 7, 2, 2, 'K').box(2, 2, 4, 7, 2, 2, 'K');   /* the woven counter and its plank top, two front posts */
    /* the goods, all on the one counter (D101): a basket, a clay pot, three folded striped blankets */
    o.box(-3, -2, 4, 5, -1, 0, 'r').box(-1, 0, 4, 4, -1, 0, 'c');
    o.box(1, 2, 4, 6, -1, 0, function (i, j) { return j === 4 ? 'u' : j === 5 ? 'p' : 'y'; });
    /* the stepped thatch roof, flush at the front where the shutter hangs; the eave's edge is the trim */
    o.box(-4, 3, 8, 8, -4, 2, function (i, j, k) { return i === -4 || i === 3 || k === -4 || k === 2 ? 'R' : 'T'; }).box(-3, 2, 9, 9, -3, 1, 't').box(-2, 1, 10, 10, -2, 0, 'T');
    /* the rolled leaf shutter on 'shutter', hanging from the eave (shut): two greens and its rolled lip */
    s.group('shutter', function () { s.box(-4, 3, 13, 15, 5, 5, function (i) { return ((i + 4) >> 1) & 1 ? 'L' : 'l'; }).box(-4, 3, 11, 12, 4, 5, 'g'); });
    if (!lite) {
      d.box(-5, -3, 12, 12, -1, 0, '3');                                                                /* a cloth in the basket */
      d.set(-2, 10, -1, '1').set(-1, 11, 0, '3').set(0, 10, -1, '4').set(-2, 11, 0, '4');                /* flowers in the pot */
      d.box(-6, -5, 8, 11, -4, -4, '3').box(-1, 0, 9, 12, -4, -4, '5').box(3, 4, 8, 11, -4, -4, '4');    /* cloths hung on the back wall */
      d.box(2, 5, 12, 12, 0, 0, '0');                                                                    /* the blankets' fringe */
      if (v === 2) [-5, 4].forEach(function (i) { d.set(i, 20, 0, '5'); });                               /* flower eyes on the pink trim */
    }
    return model('jungle_market', pal('WDKrcupytTlLg012345', { R: VTOK.jungle_market[v] }),
      [o, [s, null, true], [d, null, true]], { pivots: { shutter: MK.hinge }, ao: false });
  }

  /* ---------------- jungle_fruitstall ---------------- */
  function fruitstallVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'jungle_fruitstall'), o = grid(G16), f = grid(G16), d = grid(G16), a = grid(G8), pivots = {};
    /* two log wheels and the plank bed */
    [-6, 5].forEach(function (x) { round(o, x, x, 0, 3, -2, 1, 'k'); });
    o.box(-5, 4, 4, 5, -6, 5, 'D');
    /* three stepped crates: bananas in front, mangoes in the middle, melons at the back */
    o.box(-5, 4, 6, 8, 1, 5, function (i, j) { return j === 8 ? 'y' : 'D'; });
    o.box(-5, 4, 6, 11, -3, 0, function (i, j) { return j === 11 ? 'o' : 'D'; });
    o.box(-5, 4, 6, 14, -6, -4, function (i, j) { return j === 14 ? 'm' : 'D'; });
    /* two poles at the back and the awning over the back crates */
    o.box(-5, -5, 15, 17, -4, -4, 'K').box(4, 4, 15, 17, -4, -4, 'K');
    a.box(-3, 2, 9, 9, -4, 0, 'A');
    /* the three hero fruits on the front crate: a pineapple, a mango, a banana bunch */
    f.group('f0', function () { f.box(-5, -3, 9, 12, 2, 4, 'Y').box(-4, -4, 13, 15, 3, 3, 'g').box(-5, -3, 13, 13, 3, 3, 'g'); });
    f.group('f1', function () { f.box(-1, 1, 9, 11, 2, 4, 'o').set(0, 12, 3, 'g'); });
    f.group('f2', function () { f.box(2, 4, 9, 9, 2, 4, 'y').box(2, 2, 10, 10, 2, 4, 'y').box(4, 4, 10, 10, 2, 4, 'y'); });
    FS.fruit.forEach(function (at, n) { pivots['f' + n] = at; });
    if (!lite) {
      [[-4, -2], [0, -1], [3, -3]].forEach(function (q) { d.box(q[0], q[0] + 1, 12, 12, q[1], q[1] + 1, '3'); });   /* dragon fruit on the mangoes */
      [-4, 0, 3].forEach(function (x) { d.box(x, x, 15, 15, -6, -4, '2'); });                            /* melon stripes */
      d.box(-5, -5, 10, 10, 2, 4, '8').box(-3, -3, 11, 11, 2, 4, '8');                                   /* the pineapple's scales */
      for (var i = -6; i <= 4; i += 2) d.set(i, 17, 1, v ? '8' : '1');                                   /* the awning's scalloped edge */
    }
    return model('jungle_fruitstall', pal('kKDyogY12389', {
      m: 'PX Jungle Canopy Deep', A: v ? VTOK.jungle_fruitstall[v] : { token: VTOK.jungle_fruitstall[v], mode: LEAF } }),
      [o, [f, null, true], [d, null, true], [a, null, true]], { pivots: pivots, ao: false });
  }

  /* ---------------- jungle_parrot ---------------- */
  function parrotVoxels(st, opt) {
    var lite = !!(opt && opt.lite), v = variantOf(st, 'jungle_parrot'), p = grid(G16), b = grid(G16, 0.5, 0.5);
    p.box(-3, 2, 0, 1, -3, 2, 's');                                                                   /* a stone foot */
    p.box(-1, 0, 2, 16, -1, 0, 'k').box(-6, 5, 17, 17, -1, 0, 'k');                                    /* the post and the T-bar */
    /* the parrot (its own frame: feet on the bar, facing +z): one block for body and head, white cheeks,
       eyes on its sides, a hooked beak, a long tail; the wings ride 'wings' */
    b.group('bird', function () {
      b.box(-1, 1, 0, 0, 0, 0, 'e');
      b.box(-1, 1, 1, 6, -1, 1, function (i, j, k) {
        if (j === 5 && i !== 0) return k === 1 ? 'w' : k === 0 ? 'E' : 'B';
        return k === 1 && j < 4 && v ? 'C' : 'B';
      });
      b.set(0, 5, 2, 'w').set(0, 4, 2, 'e');
      b.box(0, 0, -3, 2, -2, -2, 'B');
    });
    b.group('wings', function () { [-2, 2].forEach(function (i) { b.box(i, i, 1, 4, -1, 1, function (x, j) { return j === 1 ? 'F' : 'G'; }); }); });
    if (!lite) {
      p.box(4, 4, 12, 16, -1, -1, '6').box(2, 5, 11, 11, -3, 0, '9');                                   /* a rope and the fruit dish */
      p.box(3, 3, 12, 12, -2, -2, '4').box(4, 4, 12, 12, 0, 0, '3').box(2, 3, 12, 12, 0, 0, '5');        /* fruit on the dish */
      p.set(-3, 2, 2, '2').set(2, 2, -3, '2').set(-2, 2, 2, '1');                                        /* moss on the foot */
      b.set(0, 7, 0, '0');                                                                              /* a little crest */
    }
    var body = VTOK.jungle_parrot[v];
    return model('jungle_parrot', pal('skweE12345', {
      B: body, C: v ? 'PX Banana' : body, G: v ? 'PX Jungle Water 3' : 'PX Jungle Parrot Blue', F: v ? 'PX Jungle Canopy' : 'PX Banana',
      0: { token: body, lod: MID }, 6: INK[6], 9: INK[9] }),
      [[p, null, true], [b, PR.feet, true]], { pivots: { bird: PR.feet, wings: PR.wings }, ao: false });
  }

  /* ---------------- jungle_coconut ---------------- */
  /* the trunk's low corner per G8 row: it curves over to the right as it climbs */
  function lean(j) { return j < 7 ? -2 : j < 13 ? -1 : j < 17 ? 0 : 1; }
  /* six fronds out of the heart [dx, dz], each as runs [from, to, row, lod] (steps out, G8 rows):
     up and out, level, then the tips droop (MID / HIGH) */
  var FRONDS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  var FROND = [[1, 2, 22, 0], [3, 4, 21, 0], [5, 5, 20, 1], [6, 6, 19, 1]];
  function coconutVoxels(st, opt) {
    var lite = !!(opt && opt.lite), t = grid(G8), c = grid(G8), n = grid(G16, 0.5, 0.5), j;
    for (j = 0; j < 20; j++) t.box(lean(j), lean(j) + 1, j, j, -1, 0, j % 5 === 4 ? 'K' : 'k');       /* ringed segments */
    /* the crown: a heart and six arching fronds two voxels wide in two greens */
    c.group('crown', function () {
      c.box(1, 2, 20, 21, -1, 0, 'g');
      FRONDS.forEach(function (dv, fi) {
        var ch = fi & 1 ? 'L' : 'l', diag = dv[0] && dv[1];
        FROND.forEach(function (r) {
          if (r[3] && lite) return;
          var c1 = r[3] ? (fi & 1 ? '2' : '1') : ch, q;
          if (diag) { for (q = r[0]; q <= r[1] && q < 5; q++) c.box(dv[0] > 0 ? 1 + q : 2 - q, dv[0] > 0 ? 2 + q : 1 - q, r[2], r[2], dv[1] > 0 ? q - 1 : -q, dv[1] > 0 ? q - 1 : -q, c1); return; }
          if (dv[0]) c.box(dv[0] > 0 ? 2 + r[0] : 1 - r[1], dv[0] > 0 ? 2 + r[1] : 1 - r[0], r[2], r[2], -1, 0, c1);
          else c.box(1, 2, r[2], r[2], dv[1] > 0 ? r[0] : -1 - r[1], dv[1] > 0 ? r[1] : -1 - r[0], c1);
        });
      });
    });
    /* coconuts under the crown: the front one drops */
    n.group('crown', function () { n.box(-4, -2, -1, 1, -4, -2, 'h'); n.box(1, 3, -1, 1, -5, -3, 'h'); });
    n.group('nut', function () { n.box(-1, 1, -1, 1, -1, 1, 'h'); });
    if (!lite) { c.box(1, 2, 22, 22, -1, 0, '2'); t.box(-3, -3, 1, 1, -2, -1, '1').set(0, 1, 1, '2'); }
    return model('jungle_coconut', pal('kKlLgh12'),
      [t, [c, null, true], [n, CO.nut, true]], { pivots: { crown: CO.crown, nut: CO.nut }, ao: false });
  }

  /* ---------------- jungle_banana ---------------- */
  /* a paddle leaf as runs out from the stem: [from, to, row, half-width, lod] (the tips are MID / HIGH) */
  var BLEAF = [[1, 2, 13, 1, 0], [3, 4, 14, 2, 0], [5, 5, 13, 2, 1], [6, 7, 12, 1, 1]];
  var BLEAVES = [[1, 0, 'l', 0], [-1, 0, 'L', 1], [0, 1, 'L', -1], [0, -1, 'l', 1]];                  /* [dx, dz, colour, row offset] */
  function bananaVoxels(st, opt) {
    var lite = !!(opt && opt.lite), t = grid(G8), c = grid(G8), b = grid(G16);
    t.box(-2, 1, 0, 0, -2, 1, 'K').box(-1, 0, 1, 12, -1, 0, 'M');                                     /* a bark foot and the thick green stem */
    c.group('leaves', function () {
      c.box(-1, -1, 13, 16, -1, 0, 'L').set(0, 13, 0, 'L');                                           /* the young leaf, still rolled */
      BLEAVES.forEach(function (q) {
        BLEAF.forEach(function (r) {
          if (r[4] && lite) return;
          var h = r[3], y = r[2] + q[3], ch = r[4] ? (q[2] === 'l' ? '1' : '2') : q[2];
          if (q[0]) c.box(q[0] > 0 ? r[0] : -1 - r[1], q[0] > 0 ? r[1] : -1 - r[0], y, y, -h, h - 1, ch);
          else c.box(-h, h - 1, y, y, q[1] > 0 ? r[0] : -1 - r[1], q[1] > 0 ? r[1] : -1 - r[0], ch);
        });
        if (!lite) { if (q[0]) c.box(q[0] > 0 ? 3 : -5, q[0] > 0 ? 4 : -4, 15 + q[3], 15 + q[3], q[0] > 0 ? -1 : 0, q[0] > 0 ? -1 : 0, '7');
                     else c.box(q[1] > 0 ? 0 : -1, q[1] > 0 ? 0 : -1, 15 + q[3], 15 + q[3], q[1] > 0 ? 3 : -5, q[1] > 0 ? 4 : -4, '7'); }   /* the midribs */
      });
    });
    /* the bunch, hung in the gap between the front and right leaves: a stalk, two hands of bananas, a pink bud */
    b.group('bunch', function () {
      b.box(2, 3, 19, 22, 2, 3, 'M');
      b.box(1, 4, 16, 18, 2, 5, 'y').box(1, 4, 13, 14, 2, 5, 'y').box(2, 3, 15, 15, 3, 4, 'M').box(2, 3, 10, 12, 3, 4, 'p');
      if (!lite) b.box(2, 3, 9, 9, 3, 4, '3');
    });
    return model('jungle_banana', pal('KlLyp123', { M: 'PX Jungle Canopy Deep', 7: { token: 'PX Jungle Canopy Deep', mode: LEAF, lod: MID } }),
      [t, [c, null, true], [b, null, true]], { pivots: { leaves: BN.leaves, bunch: BN.bunch }, ao: false });
  }

  /* ---------------- jungle_arch ---------------- */
  /* a stone block's tone: one tone per block (2 voxels high), by course and column — never per voxel */
  function stone(i, j) { var b = (Math.floor(j / 2) * 3 + Math.floor((i + 8) / 3)) % 5; return b === 1 || b === 3 ? 'S' : 's'; }
  function archVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0, 0.5), v = grid(G16), pivots = {};
    /* two square pillars (3 × 3 G8, 1.25 u), the lintel, the stepped top and the keystone */
    [-7, 4].forEach(function (x0) { o.box(x0, x0 + 2, 0, 9, -1, 1, stone); });
    o.box(-7, 6, 10, 11, -1, 1, stone).box(-5, 4, 12, 12, -1, 1, 'S').box(-1, 0, 10, 13, -1, 2, 's');
    if (!lite) { o.clear(-7, 9, 1).clear(6, 5, 1).clear(-7, 11, -1).clear(6, 11, 1); }                   /* chipped corners */
    /* moss caps; a fallen block at the right pillar's foot */
    o.box(-7, -5, 12, 12, -1, 1, 'L').box(4, 6, 12, 12, 0, 1, 'L').box(-4, -2, 13, 13, -1, 0, 'L').box(-1, 0, 14, 14, 0, 1, 'L');
    o.box(2, 3, 0, 1, 2, 2, 'S');
    /* vines (G16) down the pillars' fronts and off the lintel */
    [[-12, 4, 21], [-9, 10, 21], [-4, 16, 23], [3, 15, 23], [8, 11, 21], [11, 4, 21]].forEach(function (q, n) { v.box(q[0], q[0], q[1], q[2], 3, 3, n & 1 ? 'g' : 'v'); });
    AR.buds.forEach(function (q, n) {
      var x = Math.round(q[0] / G16 - 0.5), y = Math.round(q[1] / G16 - 0.5);
      if (!pivots[q[2]]) pivots[q[2]] = q[2] === 'bud2' ? AR.keystone : [q[0], q[1], AR.z];
      if (!lite) v.group(q[2], function () { flower(v, x, y, 4, n & 1 ? 'o' : 'p'); });
    });
    if (!lite) {
      [[-11, 14], [-10, 7], [9, 8], [10, 14]].forEach(function (q) { v.set(q[0], q[1], 3, '2'); });        /* leaves on the vines */
      tuft(v, -13, 3, 5);
    }
    return model('jungle_arch', pal('sSLgpoy12', { v: { token: 'PX Jungle Canopy', mode: LEAF } }),
      [o, [v, null, true]], { pivots: pivots, anchors: { under: AR.under, spot: AR.spot } });
  }

  /* ---------------- jungle_waterwheel ---------------- */
  /* is wheel voxel (i, j) on the paddle at deg: within the paddle's radial run and its 1.5-voxel width */
  function paddle(i, j, deg) {
    var r = deg * Math.PI / 180, along = i * Math.cos(r) + j * Math.sin(r), side = -i * Math.sin(r) + j * Math.cos(r);
    return along > 5.2 && along < 6.9 && Math.abs(side) <= 0.75;
  }
  function waterwheelVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G16, 0.5, 0.5), f = grid(G16, 0.5, 0.5), w = VX().grid({ grid: G16, origin: [0.5, 0.5, 0.5] }), d = grid(G16, 0.5, 0.5), n, i, j;
    /* the plank tub (walls one plank thick, 0.3125 u high) and the water in it */
    o.box(-6, 6, 0, 4, -3, 6, function (x, y, k) { return Math.abs(x) < 6 && k > -3 && k < 6 ? (y === 0 ? 'D' : y < 4 ? 'a' : null) : 'D'; });
    /* the split-bamboo chute off the wheel's top right, and the water falling from it into the tub */
    o.box(4, 6, 14, 14, 3, 5, function (x) { return x === 5 ? 'a' : 'L'; }).box(5, 5, 4, 13, 5, 5, 'A');
    /* the bamboo frame behind the tub: two posts, a beam behind the hub with the axle, a top bar */
    f.box(-6, -6, 0, 19, -5, -4, 'K').box(6, 6, 0, 19, -5, -4, 'K').box(-6, 6, 20, 20, -5, -4, 'K');
    f.box(-5, 5, 10, 10, -5, -5, 'k').box(-1, 1, 10, 11, -4, -1, 'k');
    /* the wheel on 'wheel' (its own frame, centred on the hub): a golden rim, eight dark paddles round
       it, four spokes and the rope-lashed hub */
    w.group('wheel', function () {
      w.ring(0, 0, 0, 5.4, 4.3, 'z', 't').ring(0, 0, 1, 5.4, 4.3, 'z', 't');
      for (j = -7; j <= 7; j++) for (i = -6; i <= 6; i++) for (n = 0; n < 8; n++) if (paddle(i, j, 22.5 + 45 * n)) w.box(i, i, j, j, 0, 1, n & 1 ? 'k' : 'a');
      w.box(-4, 4, 0, 0, 0, 1, 'K').box(0, 0, -4, 4, 0, 1, 'K').box(-1, 1, -1, 1, -1, 2, 'r');
    });
    /* the lily pad and its lily on 'lily' */
    round(d, -6, -2, 4, 4, 2, 6, 'g');
    d.group('lily', function () { d.box(-5, -3, 5, 5, 4, 4, 'p').box(-4, -4, 5, 5, 3, 5, 'p').set(-4, 5, 4, 'y').set(-4, 6, 4, 'p'); });
    if (!lite) {
      f.box(-6, -6, 19, 19, -3, -3, '6').box(6, 6, 19, 19, -3, -3, '6');                                 /* lashings at the top bar */
      f.box(-7, -7, 20, 21, -5, -4, '1').box(7, 7, 20, 21, -5, -4, '2').set(0, 21, -5, '2');              /* leaves tied to the bar's ends */
      d.box(-6, -5, 0, 1, -6, -5, '7').box(5, 6, 0, 0, -6, -6, '7');                                     /* stones at the frame's feet */
      tuft(d, -2, -5, 4);
      d.box(4, 5, 4, 4, 4, 4, 'x').set(5, 4, 3, 'x');                                                   /* ripples where the water lands */
    }
    return model('jungle_waterwheel', pal('DkKLtragpy1267', { A: INK.a, x: { token: 'PX Glint', lod: MID } }),
      [o, [f, null, true], [w, WH.hub, true], [d, null, true]], { pivots: { wheel: WH.hub, lily: WH.lily }, anchors: { spot: WH.spot }, ao: false });
  }

  /* ---------------- jungle_smoothie ---------------- */
  function smoothieVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), p = grid(G8), d = grid(G16);
    [[-3, -3], [2, -3], [-3, 1], [2, 1]].forEach(function (c) { p.box(c[0], c[0], c[1] > 0 ? 5 : 0, 8, c[1], c[1], 'K'); });   /* four bamboo posts */
    o.box(-2, 1, 0, 6, -3, -3, 'W').box(-2, 1, 4, 4, -2, -2, 'D');                                     /* the woven back wall and its shelf */
    /* the bar counter: bamboo slats with a pink band, a plank top */
    o.box(-3, 2, 0, 4, -1, 1, function (i, j, k) { return j === 4 ? 'D' : j === 2 && k === 1 ? 'p' : 'W'; });
    /* a two-layer banana-leaf roof, and the sign on its ridge: cup and leaf pictograms, no words */
    o.box(-4, 3, 9, 9, -4, 2, function (i) { return ((i + 4) >> 1) & 1 ? 'l' : 'L'; }).box(-3, 2, 10, 10, -3, 1, 'L');
    o.box(-2, 1, 11, 12, 0, 0, 'w');
    if (!lite) o.decal('+z', [-2, 11, 0], [2, 2], 'cup').decal('+z', [0, 11, 0], [2, 2], 'leaf');
    /* the blender jar on 'jar' (G16): a bark base, pale glass round four fruit colours, a lid and its crank */
    d.group('jar', function () {
      d.box(-5, -3, 10, 16, 1, 3, function (i, j, k) {
        if (j === 10 || j === 16) return 'k';
        var edge = (i === -5 || i === -3) && (k === 1 || k === 3);
        return edge || j === 15 ? 'j' : j < 12 ? 'y' : j < 13 ? 'p' : j < 14 ? 'o' : 'Y';
      });
      d.box(-6, -6, 13, 15, 2, 2, 'K');
    });
    /* two coconut-shell cups on 'dishes': a husk, the smoothie, a straw and a flower */
    d.group('dishes', function () {
      [[0, 2], [3, 1]].forEach(function (c, n) {
        round(d, c[0], c[0] + 2, 10, 11, c[1] - 1, c[1] + 1, 'h');
        d.set(c[0] + 1, 11, c[1], n ? 'o' : 'p').box(c[0] + 2, c[0] + 2, 12, 13, c[1], c[1], 'w');
        if (!lite) d.set(c[0], 12, c[1] + 1, n ? '3' : '4');
      });
    });
    /* the log stool in front of the bar (anchor seat) */
    d.box(-1, 2, 0, 3, 4, 5, function (i, j) { return j === 3 ? 'K' : 'k'; });
    if (!lite) {
      d.box(1, 3, 10, 13, -5, -4, 'Y').box(2, 2, 14, 16, -5, -4, '1').box(1, 3, 14, 14, -5, -4, '2');   /* a pineapple on the shelf */
      d.box(-6, -5, 11, 13, 4, 4, '5').box(-4, -4, 12, 13, 4, 4, '5').set(-5, 14, 4, '7');               /* bananas on the front post */
      [[-8, -8], [7, -8], [-8, 5], [7, 5]].forEach(function (q) { d.box(q[0], q[0], 16, 17, q[1], q[1] + 1, '1'); });   /* leaf tips drooping at the roof's corners */
      d.box(-6, -5, 4, 4, -2, 1, '2').set(4, 4, -5, '2');
    }
    return model('jungle_smoothie', pal('KWDklLwjypoYh123457', {}),
      [o, [p, null, true], [d, null, true]], { pivots: { jar: SM.jar, dishes: SM.dishes }, anchors: { seat: SM.seat } });
  }

  /* ================================================================
     LOD1 — the far-island bakes (D106): a few plain boxes per small piece, inside TRIS_CAPS_LOD1,
     keeping every lookEntries pivot (the bigger pieces bring their plain masses, halved)
     ================================================================ */
  var LO = {
    jungle_lantern: function (st) {
      var v = variantOf(st, 'jungle_lantern'), o = grid(G8, 0.5, 0.5);
      o.box(-1, 1, 0, 0, -1, 1, 's').box(0, 0, 1, 7, 0, 0, 'K').box(-1, 1, 8, 10, -1, 1, 'Y').box(-2, 2, 11, 11, -2, 2, 'C');
      return model('jungle_lantern', pal('sK', { Y: lamp(), C: v ? 'PX Jungle Thatch' : { token: 'PX Jungle Canopy', mode: LEAF } }), [o], { ao: false });
    },
    jungle_stilthut: function (st) {
      var v = variantOf(st, 'jungle_stilthut'), o = grid(G8), w = grid(G8);
      [[-3, -3], [2, -3], [-3, 1], [2, 1]].forEach(function (c) { o.box(c[0], c[0], 0, 3, c[1], c[1], 'k'); });
      o.box(-3, 2, 4, 7, -3, 1, 'W').box(-4, 3, 8, 8, -4, 2, 'T').box(-2, 1, 9, 10, -2, 0, 't').box(-2, 1, 11, 11, -1, -1, 'R');
      w.group('glow', function () { w.box(0, 1, 5, 6, 2, 2, 'Y'); });
      return model('jungle_stilthut', pal('kWTt', { R: VTOK.jungle_stilthut[v], Y: lamp() }), [o, [w, null, true]], { pivots: { glow: HUT.glow }, ao: false });
    },
    jungle_market: function (st) {
      var v = variantOf(st, 'jungle_market'), o = grid(G8), s = grid(G16);
      o.box(-3, 2, 0, 7, -3, -3, 'W').box(-3, 2, 0, 3, -1, 1, 'D').box(-3, 2, 4, 5, -1, 0, 'u').box(-3, -3, 4, 7, 2, 2, 'K').box(2, 2, 4, 7, 2, 2, 'K');
      o.box(-4, 3, 8, 8, -4, 2, 'T').box(-2, 1, 9, 10, -2, 0, 'R');
      s.group('shutter', function () { s.box(-4, 3, 11, 15, 5, 5, 'l'); });
      return model('jungle_market', pal('WDuKTl', { R: VTOK.jungle_market[v] }), [o, [s, null, true]], { pivots: { shutter: MK.hinge }, ao: false });
    },
    jungle_coconut: function () {
      var t = grid(G8), c = grid(G8), n = grid(G16, 0.5, 0.5);
      t.box(-2, -1, 0, 7, -1, 0, 'k').box(-1, 0, 8, 14, -1, 0, 'k').box(1, 2, 15, 19, -1, 0, 'k');
      c.group('crown', function () { c.box(1, 2, 20, 21, -1, 0, 'g').box(3, 6, 21, 21, -1, 0, 'l').box(-3, 0, 21, 21, -1, 0, 'l').box(1, 2, 21, 21, 1, 4, 'L').box(1, 2, 21, 21, -5, -2, 'L'); });
      n.group('nut', function () { n.box(-1, 1, -1, 1, -1, 1, 'h'); });
      return model('jungle_coconut', pal('klLgh'), [t, [c, null, true], [n, CO.nut, true]], { pivots: { crown: CO.crown, nut: CO.nut }, ao: false });
    },
    jungle_fruitstall: function (st) {
      var v = variantOf(st, 'jungle_fruitstall'), o = grid(G16), f = grid(G16), a = grid(G8);
      o.box(-5, 4, 0, 5, -6, 5, 'D').box(-5, 4, 6, 8, 1, 5, 'y').box(-5, 4, 6, 11, -3, 0, 'o').box(-5, 4, 6, 14, -6, -4, 'm');
      a.box(-3, 2, 9, 9, -4, 0, 'A');
      f.group('f0', function () { f.box(-5, -3, 9, 12, 2, 4, 'Y'); });
      f.group('f1', function () { f.box(-1, 1, 9, 11, 2, 4, 'o'); });
      f.group('f2', function () { f.box(2, 4, 9, 10, 2, 4, 'y'); });
      var pv = {};
      FS.fruit.forEach(function (at, n) { pv['f' + n] = at; });
      return model('jungle_fruitstall', pal('DyoY', { m: 'PX Jungle Canopy Deep', A: VTOK.jungle_fruitstall[v] }), [o, [a, null, true], [f, null, true]], { pivots: pv, ao: false });
    },
    jungle_banana: function () {
      var t = grid(G8), c = grid(G8), b = grid(G16);
      t.box(-1, 0, 0, 12, -1, 0, 'M');
      c.group('leaves', function () { c.box(1, 4, 13, 13, -1, 0, 'l').box(-5, -2, 13, 13, -1, 0, 'L').box(-1, 0, 13, 13, 1, 4, 'L').box(-1, 0, 13, 13, -5, -2, 'l').box(-1, -1, 14, 16, -1, -1, 'L'); });
      b.group('bunch', function () { b.box(1, 4, 13, 18, 2, 5, 'y').box(2, 3, 10, 12, 3, 4, 'p'); });
      return model('jungle_banana', pal('lLyp', { M: 'PX Jungle Canopy Deep' }), [t, [c, null, true], [b, null, true]], { pivots: { leaves: BN.leaves, bunch: BN.bunch }, ao: false });
    },
    jungle_parrot: function (st) {
      var v = variantOf(st, 'jungle_parrot'), p = grid(G16), b = grid(G16, 0.5, 0.5);
      p.box(-3, 2, 0, 1, -3, 2, 's').box(-1, 0, 2, 16, -1, 0, 'k').box(-6, 5, 17, 17, -1, 0, 'k');
      b.group('bird', function () { b.box(-1, 1, 1, 6, -1, 1, 'B').set(0, 5, 2, 'w'); });
      b.group('wings', function () { b.box(-2, -2, 1, 4, -1, 1, 'G').box(2, 2, 1, 4, -1, 1, 'G'); });
      return model('jungle_parrot', pal('skw', { B: VTOK.jungle_parrot[v], G: v ? 'PX Jungle Water 3' : 'PX Jungle Parrot Blue' }),
        [[p, null, true], [b, PR.feet, true]], { pivots: { bird: PR.feet, wings: PR.wings }, ao: false });
    }
  };

  var BUILD = { jungle_waterwheel: waterwheelVoxels, jungle_smoothie: smoothieVoxels, jungle_arch: archVoxels, jungle_stilthut: stilthutVoxels, jungle_market: marketVoxels,
                jungle_coconut: coconutVoxels, jungle_fruitstall: fruitstallVoxels, jungle_banana: bananaVoxels, jungle_parrot: parrotVoxels, jungle_lantern: lanternVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: a few plain boxes (LO), or the plain masses (no trims, details or decals), halved */
    lod1[id] = LO[id] ? function (st) { return LO[id](st); } : function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('jungle-b', K → {id: {voxels, lod1, act, forget, idle?, show?, lit?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {}, DEG = Math.PI / 180;
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], WS = {}, SS = {}, NUT = {}, FR = {}, JS = {}, NOOPT = {};
    var BFLY = { token: 'PX Jungle Parrot Blue' };
    var spin = (LOOKS.jungle_waterwheel && LOOKS.jungle_waterwheel.idle) || { rps: WH.idle, tiers: ['MID', 'HIGH'] };
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
    /* the pet's part (the crew owns it: the feast sit at the stool, the look up under the arch) */
    function askPet(a, id) {
      var p = a.pets, kind = (LOOKS[id] && LOOKS[id].perform) || PERFORM[id];
      if (!kind || !p || typeof p.perform !== 'function') return;
      try { p.perform(kind, a.uid); } catch (e) { /* no crew yet */ }
    }
    /* the active pet's 'voice' step (SLSound.VOICE_STEPS), or -1 with no pet */
    function voiceStep(a) {
      var p = a.pets, pet = p && typeof p.active === 'function' ? p.active() : null, S = snd();
      if (typeof pet !== 'string') return -1;
      return S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : VOICE4.indexOf(pet);
    }
    /* per-copy memory (what a toggle shows, the lamp level, the buckets the wheel was moved on by, a
       still idle): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, on: -1, lamp: -1, halo: false, pool: false, wheel: 0, still: false }; memo.set(a.uid, m); }
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
       fn(off))}; opt {name (the timeline), off (a toggle played shut), quiet (the pet is not asked)} */
    function run(a, id, spec, opt) {
      opt = opt || NOOPT;
      var name = opt.name || ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, off = !!opt.off;
      var o = { reduced: reduced, off: off, from: prev && !reduced ? M.carry(prev.name, prev.out) : null };
      var own = typeof spec.cues === 'function' ? spec.cues(off) : spec.cues;
      var dur = reduced ? 0 : spec.cut || M.durOf(name, o), cues = !own ? M.cues(name, o) : reduced ? stillCues(own) : own;
      var ci = 0, done = false, uid = a.uid, me = { name: name, id: id, off: off, dur: dur, out: {}, mark: -1 };
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
            if (c.emit) emit(h, c.emit, (c.emit !== 'sparkle' && spec.at && spec.at(c, me.out)) || 'top', c.n || 1);
            else if (typeof h.sfx !== 'function') continue;
            else if (!c.pet) h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
            else if (voiceStep(h) >= 0) h.sfx('voice', c.vol == null ? 1 : c.vol, voiceStep(h));
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

    /* ---------- water wheel: one eased turn on top of its idle, the lily dips and pops, drips off the chute ---------- */
    function wheelBase(a) { return !a.reduced && spin.tiers.indexOf(tierOf(a)) >= 0 ? M.spin(+a.t || 0, spin.rps, +a.phase || 0, false) : 0; }
    var wheelSpec = {
      cut: WH.cut, cues: WH.cues,
      apply: function (a, out, t, me) {
        wheelAt(t, WS);
        pose(a, 'wheel', 0, 0, wheelBase(a) + mem(a).wheel + WS.deg, 0, 0, 0);
        pose(a, 'lily', 0, 0, 0, 0, 0, 0, WS.lily, WS.lily, WS.lily);
        var n = Math.floor((t - WH.dripFrom) / WH.drip);
        if (t >= WH.dripFrom && t < WH.dripTo && n !== me.mark) { me.mark = n; emit(a, 'drop', WH.spout, WH.dripN); }
      },
      /* reduced motion moves the wheel on by one paddle (and it stays there) */
      rest: function (a, reduced) {
        var m = mem(a);
        if (reduced) m.wheel = (m.wheel + WH.step) % 360;
        pose(a, 'wheel', 0, 0, wheelBase(a) + m.wheel, 0, 0, 0);
        rest(a, 'lily');
      }
    };
    /* the idle turn (0.05 a second) on the live island at MID / HIGH; still on LOW and under reduced motion */
    function wheelIdle(a) {
      if (!a || !M) return false;
      var m = mem(a), on = !a.reduced && spin.tiers.indexOf(tierOf(a)) >= 0;
      if (live.get(a.uid)) return true;
      if (!on) { if (m.still) return false; m.still = true; pose(a, 'wheel', 0, 0, m.wheel, 0, 0, 0); return true; }
      m.still = false;
      pose(a, 'wheel', 0, 0, wheelBase(a) + m.wheel, 0, 0, 0);
      return true;
    }

    /* ---------- smoothie shack: the jar spins, the cups pop, the pet sits for a sip ---------- */
    var serveSpec = {
      cut: SM.cut, cues: SM.cues,
      apply: function (a, out, t) {
        serveAt(t, SS);
        pose(a, 'jar', 0, SS.jar, 0, 0, 0, 0);
        pose(a, 'dishes', 0, 0, 0, 0, 0, 0, SS.cups, SS.cups, SS.cups);
      },
      rest: function (a) { rest(a, 'jar'); rest(a, 'dishes'); },
      at: function () { return SM.dishes; }
    };

    /* ---------- the toggles: the lamps, the shutter, the flowers ---------- */
    function showOf(a, k) { return typeof k === 'number' ? k : a && typeof a.show === 'number' ? a.show : 0; }
    /* a lamp's level: its own (the tap memory or the fade) or the night's, written only when it moves; a
       halo on MID / HIGH while lit; the lantern's warm pool on the ground at night */
    function lampApply(a, id, k, show) {
      var m = mem(a), night = nightOf(showOf(a, show)), lv = Math.round(100 * Math.max(clamp01(k), night)) / 100, on = lv > 0.5;
      var cfg = id === 'jungle_lantern' ? LN : HUT, halo = on && tierOf(a) !== 'LOW', pool = id === 'jungle_lantern' && on && night > 0.5;
      if (lv !== m.lamp) { m.lamp = lv; setState(a, 'lit', lv); }
      if (halo !== m.halo && typeof a.halo === 'function') { m.halo = halo; try { a.halo('glow', halo, cfg.halo, 'Lamp Halo'); } catch (e) { /* fx is optional */ } }
      if (pool !== m.pool && typeof a.decal === 'function') { m.pool = pool; try { a.decal(pool, 'Lamp Warm'); } catch (e) { /* fx is optional */ } }
    }
    var glowSpec = {
      cues: LN.cues,
      apply: function (a, out, t, me) {
        lampApply(a, me.id, out.k);
        if (me.id === 'jungle_stilthut') { var s = me.off ? 1 : 1 + HUT.pop * Math.sin(Math.PI * clamp01(t / me.dur)); pose(a, 'glow', 0, 0, 0, 0, 0, 0, s, s, s); }
      },
      rest: function (a, reduced, me) { lampApply(a, me.id, me.off ? 0 : 1); if (me.id === 'jungle_stilthut') rest(a, 'glow'); }
    };
    /* the market's shutter: shut, it hangs over the front; open, it is rolled up under the eave */
    function shutterPose(a, open) { var u = clamp01(open); pose(a, 'shutter', 0, 0, 0, 0, 0, 0, 1, u >= 1 ? MK.roll : 1 - (1 - MK.roll) * u, 1); }
    var shutterSpec = {
      cues: function (off) { return off ? MK.cues.close : MK.cues.open; },
      apply: function (a, out) { shutterPose(a, (out.deg || 0) / 100); },
      rest: function (a, reduced, me) { shutterPose(a, me.off ? 0 : 1); }
    };
    /* the arch's flowers: each bud at its own level on SLMotion's bloom; three blue butterflies rise as the last opens */
    function archPose(a, k) { HELPERS.jungle_arch.forEach(function (pv) { var s = M.part('bloom', k, AR.part[pv]); pose(a, pv, 0, 0, 0, 0, 0, 0, s, s, s); }); }
    var bloomSpec = {
      apply: function (a, out, t, me) {
        archPose(a, out.k || 0);
        if (!me.off && me.mark < 0 && t >= AR.flyAt) { me.mark = 1; emit(a, 'sparkle', AR.fly, 3, BFLY); }
      },
      rest: function (a, reduced, me) { archPose(a, me.off ? 0 : 1); }
    };
    var TOGGLE = { jungle_stilthut: glowSpec, jungle_lantern: glowSpec, jungle_market: shutterSpec, jungle_arch: bloomSpec };
    /* how a copy shows its memory with no act running (added, restyled, the Showtime mix, the host's lit memory) */
    function poseToggle(a, id, on, k) {
      if (id === 'jungle_market') shutterPose(a, on);
      else if (id === 'jungle_arch') archPose(a, on);
      else lampApply(a, id, on, k);
    }
    function toggleAct(a, id, name) {
      if (!a) return null;
      var on = wantOn(name, a.lit, shownOf(a));
      mem(a).on = on;
      return run(a, id, TOGGLE[id], { off: !on, name: id === 'jungle_market' ? (on ? 'open' : 'close') : ACT[id], quiet: !on });
    }
    function toggleShow(id) { return function (a, k) { if (a && !live.get(a.uid)) poseToggle(a, id, shownOf(a), k); }; }
    function toggleLit(id) {
      return function (a, on) {
        if (!a) return;
        live.delete(a.uid);
        mem(a).on = on ? 1 : 0;
        poseToggle(a, id, on ? 1 : 0);
      };
    }

    /* ---------- coconut palm: the crown nods, a coconut drops, bounces, rolls to the trunk and pops back ---------- */
    var coconutSpec = {
      apply: function (a, out, t) {
        var nod = CO.nod * (out.swing || 0), k = out.k || 0, f = 1 - (k > 0 ? clamp01(k / CO.drop) : 0);
        pose(a, 'crown', nod, 0, 0, 0, 0, 0);
        nutAt(k, out.bob, t, NUT);
        /* until it falls, the coconut rides the crown's nod */
        var r = nod * DEG, oy = CO.nut[1] - CO.crown[1], oz = CO.nut[2] - CO.crown[2], fy = 0, fz = 0;
        if (t < CO.pop) { fy = (oy * Math.cos(r) - oz * Math.sin(r) - oy) * f; fz = (oy * Math.sin(r) + oz * Math.cos(r) - oz) * f; }
        pose(a, 'nut', 0, 0, NUT.roll, NUT.x, NUT.y + fy, NUT.z + fz, NUT.s, NUT.s, NUT.s);
      },
      rest: function (a) { rest(a, 'crown'); rest(a, 'nut'); }
    };

    /* ---------- fruit stall: three fruits hop one after another, turn once and land with a squash ---------- */
    var lag = (M && M.ACTS && M.ACTS.juggle && M.ACTS.juggle.lag) || FS.lag;
    var juggleSpec = {
      apply: function (a, out, t) {
        for (var n = 0; n < 3; n++) {
          var tl = t - n * lag;
          M.sample('juggle', tl > 0 ? tl : 0, JS, NOOPT);
          fruitAt(tl > 0 ? JS.bob : 0, tl, FR);
          pose(a, 'f' + n, 0, FR.turn, 0, 0, FR.y, 0, 1, FR.sy, 1);
        }
      },
      rest: function (a) { rest(a, 'f0'); rest(a, 'f1'); rest(a, 'f2'); }
    };

    /* ---------- banana tree: the paddle leaves sway, the bunch swings under them ---------- */
    var waveSpec = {
      apply: function (a, out) {
        var s = out.swing || 0;
        pose(a, 'leaves', BN.tilt * s, 0, BN.deg * s, 0, 0, 0);
        pose(a, 'bunch', BN.swing * s, 0, 0, 0, 0, 0);
      },
      rest: function (a) { rest(a, 'leaves'); rest(a, 'bunch'); }
    };

    /* ---------- parrot perch: a hop along the bar and back, two flaps, a whistle ---------- */
    function wingsOpen(a, x, y, flap) { pose(a, 'wings', 0, 0, 0, x, y, 0, 1 + PR.spread * flap, 1 + PR.raise * flap, 1); }
    var chirpSpec = {
      apply: function (a, out) {
        var hop = out.bob || 0, x = PR.step * hop, y = PR.hop * hop;
        pose(a, 'bird', 0, 0, 0, x, y, 0);
        wingsOpen(a, x, y, Math.max(0, out.swing || 0));
      },
      /* reduced motion: the parrot faces you with its wings open */
      rest: function (a, reduced) { rest(a, 'bird'); if (reduced) wingsOpen(a, 0, 0, 1); else rest(a, 'wings'); }
    };

    var SPEC = { jungle_waterwheel: wheelSpec, jungle_smoothie: serveSpec, jungle_coconut: coconutSpec, jungle_fruitstall: juggleSpec,
                 jungle_banana: waveSpec, jungle_parrot: chirpSpec }, out = {};
    IDS.forEach(function (id) {
      var h = { voxels: voxels[id], lod1: lod1[id], forget: forget };
      if (TOGGLE[id]) { h.act = function (a, name) { return toggleAct(a, id, name); }; h.show = toggleShow(id); h.lit = toggleLit(id); }
      else h.act = function (a) { return run(a, id, SPEC[id]); };
      out[id] = h;
    });
    out.jungle_waterwheel.idle = wheelIdle;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, VARIANTS: VARIANTS, ACT: ACT, PERFORM: PERFORM, TOGGLES: TOGGLES, HELPERS: HELPERS, TOKENS: TOKENS, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { lantern: LN, hut: HUT, market: MK, fruit: FS, parrot: PR, palm: CO, banana: BN, arch: AR, wheel: WH, shack: SM },
    nightOf: nightOf, wheelAt: wheelAt, serveAt: serveAt, nutAt: nutAt, fruitAt: fruitAt, wantOn: wantOn, lean: lean
  };
}));
