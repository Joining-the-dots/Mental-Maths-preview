/* ================================================================
   My Island v3 — SLPxCastleA (W3b.3): the Castle Kingdom's field pieces in Pixel Blocks.
   window.SLPxCastleA + SL3D.defineVox('castle-a', factory) in the browser, module.exports in
   Node. Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the
   photocards and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at
   the footprint centre, facing +z; everything below y 1.0 stays inside the footprint less one G8
   voxel (the inventory's inset: half-extent ≤ (fp − 0.125) / 2).
     castle_throne   1×1  a two-step stone dais with a strip of red carpet up to a high-backed gold
                     throne: purple seat and back cushions, gold arms, a gold sun pictogram on its
                     purple apron under the pet. A purple canopy on two gold poles (gold knobs on
                     its corners) carries three coral pennants on p0 … p2: on the fanfare they fly
                     up toward us one after another, wave and settle. Anchor seat.
     castle_flinger  2×1  a garden see-saw, never a siege engine: a stone fulcrum block, a painted
                     wood plank on 'plank' (hinged off-centre, so the long arm lifts), a padded
                     teal seat with a backrest at the short end and a woven basket heaped with
                     pink, gold and lilac flowers at the long end. No frame, winch or wheels; a
                     few fallen petals lie on the grass. Anchor seat (plank).
     castle_maypole  1×1  a 2.4 u white pole on a little meadow mound, one ribbon wound round it in
                     the six ribbon colours; at its top a flower crown and six loose ribbon tails
                     (r0 … r5 ⊂ 'ribbons') that fan out while the crown turns once. A gold ball
                     on top. Anchors ring0 … ring2 (where the dancers start: one circle 0.46 u out,
                     120° apart, clear of the mound).
     castle_bridge   2×1  a humpback bridge of cut stone over its own strip of moat: a cobble deck
                     that steps up three voxels to the crown, low parapets capped in sandstone,
                     under a thin coping, a round arch ringed in sandstone with two white ducks
                     (gold beaks) on 'ducks' just inside it, lily pads on the water. Trail s0 ·
                     s1 (crown) · s2 on the cobbles, a walk (≤ 0.25 u a step), never a hop.
     castle_feast    2×1  a long trestle table under a coral / white checked cloth, a bench on
                     each side; on 'dishes' a lattice pie, a fruit bowl (apple, grapes, orange),
                     the pet's plate with a slice, a two-tier cake with a cherry on top (no
                     candle, no flame) and a jug. Anchor seat (the back bench: the pet faces us
                     over the feast).
   GRAIN (D11): bodies and benches G8; the throne, the flinger, the pole, the ducks and every dish
   G16. No corner AO (pier-a's choice for its rides and small pieces): on stripes, checks and G16
   parts it only splits quads, and the voxel bevel already draws every edge. LOW (D89, D106): detail
   voxels (flowers, petals, pads, trims, the wound ribbon) are tagged lod 'mid'; every id brings its
   own lod1 (its plain masses, halved) inside TRIS_CAPS_LOD1.
   PARTS: the maypole carries the seven lookEntries pivots, so it has eight parts where the kit's
   QA line is six (pier-a's carousel precedent); every part is merge-eligible.
   ACTS run on SLMotion timelines by name: royal, toss, ducks (the castle's own rows), and the two
   first-plan names dance and serve, cut to this file's shows with their own cues (≤ 3 s; the
   feast ≤ 2.5 s). One live act per uid (a re-tap supersedes); the end pose is the rest pose;
   reduced motion is the end state at once with the same sounds and one sparkle — the pennants
   out, the basket up, the ribbons fanned out, the ducks out. The pet's part is
   a.pets.perform(LOOK perform kind, uid). Rates: the pennants wave at 1.25 Hz, the crown turns
   once in 2.3 s, the ribbons ripple at 1.2 Hz — all under MAX_FLASH_HZ; nothing here lights up.
   No word, no five-point star, no flame, no weapon; nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.batch a.object · a.pivot(name).set(rotDeg[3], pos[3],
   scale[3]) · a.emit(kind, localPos, n, opts) · a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxCastleA = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('castle-a', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxCastleA: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }

  var VERSION = 1;
  var IDS = ['castle_throne', 'castle_flinger', 'castle_maypole', 'castle_bridge', 'castle_feast'];
  var G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { castle_throne: 'royal', castle_flinger: 'toss', castle_maypole: 'dance', castle_bridge: 'ducks', castle_feast: 'serve' };
  var PERFORM = { castle_throne: 'seat:sit', castle_flinger: 'seat:sit', castle_maypole: 'maypole', castle_bridge: 'trail:walk', castle_feast: 'feast' };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  /* throne: the pennants' x (G16, odd), their hinge under the canopy's front edge, how far they fly out */
  var TH = {
    seat: [0, 0.4375, -0.125], pens: [-5, 0, 5], hingeY: 1.625, hingeZ: 0.21875, out: 55, stagger: 0.12,
    up: [0.8, 1.4], settle: [2.0, 2.45], flutter: 14, flutterHz: 1.25, spark: [0, 1.95, 0.125], sparkAt: 0.85
  };
  /* flinger: the hinge on the fulcrum (off-centre: a 0.625 u seat arm, a 1.125 u basket arm), the seat, the fling point */
  var FL = { plank: [-0.25, 0.3125, 0], seat: [-0.6875, 0.5, 0.0625], deg: 25, fling: [0.625, 1.45, 0] };
  /* maypole: the crown's pivot on the pole, the six tails ([i0, i1, k0, k1] on G16, even), how far they fan */
  var MP = {
    crown: [0, 1.9375, 0], hingeY: 1.9375, tailEnd: 22, ring: 0.46, fan: 55, ripple: 0.12, rippleHz: 1.2, open: [0.1, 0.7], close: [2.3, 2.9],
    spin: [0.3, 2.6], tails: [[-1, 0, 3, 3], [3, 3, 1, 2], [3, 3, -3, -2], [-1, 0, -4, -4], [-4, -4, -3, -2], [-4, -4, 1, 2]],
    rib: ['c', 'y', 'm', 'b', 'l', 'p'], notes: [0, 2.6, 0], cut: 3,
    cues: [{ t: 0.1, sfx: 'go', vol: 0.3 }, { t: 0.25, sfx: 'musicbox', step: 1 }, { t: 0.3, emit: 'note', n: 3 },
           { t: 1.4, sfx: 'musicbox', step: 1 }, { t: 1.45, emit: 'note', n: 3 }]
  };
  /* bridge: the deck's top voxel per |i| (G8, odd), the trail, the ducks' slide and their one bob */
  var BR = {
    deck: [5, 5, 4, 4, 3, 3, 2, 2], arch: [3, 3, 2, 1, 0, -1, -1, -1], ducks: [0, 0.125, 0], out: 0.25, hop: 0.03, nod: 8,
    s0: [-0.625, 0.5, 0], s1: [0, 0.75, 0], s2: [0.625, 0.5, 0], splash: [0, 0.15, 0.375]
  };
  /* feast: the dishes' pivot on the table top, the back-bench seat, the pet's plate, the pop */
  var FE = {
    dishes: [0, 0.5, 0], seat: [0.03125, 0.25, -0.375], plate: [0.03125, 0.625, -0.125], dip: [0.1, 0.35], pop: [0.35, 0.65], low: 0.8, cut: 2.5,
    cues: [{ t: 0.1, sfx: 'chip' }, { t: 0.15, sfx: 'pop' }, { t: 0.6, emit: 'sparkle', n: 3, local: true }, { t: 1.3, sfx: 'chip', step: 1 }, { t: 1.6, sfx: 'voice', pet: true }]
  };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function smooth(a, b, x) { var u = seg(x, a, b); return u * u * (3 - 2 * u); }
  function outCubic(u) { u = 1 - clamp01(u); return 1 - u * u * u; }
  function inOut(u) { return (1 - Math.cos(Math.PI * clamp01(u))) / 2; }
  /* throne pennant n at t: out.lift (degrees ≥ 0, swung up toward +z) and out.wave (degrees about z):
     it flies out on the fanfare a beat after the one before, waves while it is out (neighbours in
     opposite phase) and settles back */
  function penAt(t, n, out) {
    out = out || {};
    var a = TH.up[0] + n * TH.stagger, k = outCubic(seg(t, a, TH.up[1] + n * TH.stagger)) * (1 - smooth(TH.settle[0], TH.settle[1], t));
    out.lift = k > 0 ? TH.out * k : 0;
    out.wave = k > 0 ? TH.flutter * k * Math.sin(TAU * TH.flutterHz * (t - a)) * (n & 1 ? -1 : 1) : 0;
    return out;
  }
  /* a maypole tail hinged at angle theta (radians about +y from +z) swung out by alpha (degrees):
     the XYZ Euler (degrees) that carries its hanging line (0, −1, 0) to (sin α sin θ, −cos α, sin α cos θ) */
  function fanRot(theta, alpha, out) {
    out = out || [0, 0, 0];
    var a = alpha * DEG, sa = Math.sin(a), ca = Math.cos(a), c = Math.asin(sa * Math.sin(theta));
    out[0] = Math.atan2(-sa * Math.cos(theta), ca) / DEG; out[1] = 0; out[2] = c / DEG;
    return out;
  }
  /* the maypole's show at t: fan (0 → 1 → 0, how far the tails are out) and turn (the crown, degrees, once round) */
  function mayAt(t, out) {
    out = out || {};
    out.fan = smooth(MP.open[0], MP.open[1], t) * (1 - smooth(MP.close[0], MP.close[1], t));
    out.turn = 360 * inOut(seg(t, MP.spin[0], MP.spin[1]));
    return out;
  }
  /* the feast's dishes at t: they dip to FE.low and pop back to 1 (no overshoot) */
  function dishAt(t) {
    if (t < FE.dip[1]) return 1 - (1 - FE.low) * seg(t, FE.dip[0], FE.dip[1]) * seg(t, FE.dip[0], FE.dip[1]);
    return FE.low + (1 - FE.low) * outCubic(seg(t, FE.pop[0], FE.pop[1]));
  }
  /* the centre (item metres, x / z) and the angle about +y of maypole tail n */
  function tailAt(n) {
    var q = MP.tails[n], x = (q[0] + q[1] + 1) / 2 * G16, z = (q[2] + q[3] + 1) / 2 * G16;
    return { x: x, z: z, theta: Math.atan2(x, z) };
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox || 0, 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (empty grids are left out); o.pivots {name: [x, y, z,
     parent?]} and o.anchors {name: [x, y, z, pivot?]} in item metres; o.ao false meshes without corner AO */
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
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the castle palette by char; pal('sSd', {…}) picks from it. The digits are the MID / HIGH detail
     twins (lod 'mid': tier LOW drops them, D89) */
  var MID = 'mid', SOFT = 'soft', LEAF = 'leaf';
  var INK = {
    s: 'PX Castle Stone', S: 'PX Castle Stone 2', h: 'PX Castle Stone Shade', d: 'PX Castle Sandstone', v: 'PX Castle Banner',
    y: 'PX Castle Gold', c: 'PX Castle Pennant', t: 'PX Castle Teal', w: 'PX Castle Wood', W: 'PX Castle Cloth', e: 'PX Ink Eye',
    p: 'PX Candy Pink', l: 'PX Lilac', m: 'PX Mint', b: 'PX Pier Stripe Blue', o: 'PX Jungle Flower Orange', r: 'PX Tree Toadstool',
    x: 'PX Waffle', u: 'Cloud White', g: { token: 'PX Castle Meadow', mode: LEAF }, G: { token: 'PX Castle Meadow 2', mode: LEAF },
    a: { token: 'PX Castle Water 1', mode: SOFT }, A: { token: 'PX Castle Water 2', mode: SOFT },
    k: { token: 'PX Castle Stone 2', mode: 'cobble' }, P: { token: 'PX Castle Wood', mode: 'plank' },
    1: { token: 'PX Candy Pink', lod: MID }, 2: { token: 'PX Castle Gold', lod: MID }, 3: { token: 'PX Lilac', lod: MID },
    4: { token: 'PX Castle Meadow 2', mode: LEAF, lod: MID }, 5: { token: 'PX Castle Cloth', lod: MID }, 6: { token: 'PX Castle Pennant', lod: MID },
    7: { token: 'PX Mint', lod: MID }, 8: { token: 'PX Pier Stripe Blue', lod: MID }, 9: { token: 'PX Castle Banner', lod: MID },
    0: { token: 'PX Castle Sandstone', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  var TWIN = { p: '1', y: '2', l: '3', G: '4', W: '5', c: '6', m: '7', b: '8', v: '9', d: '0' };   /* a colour → its MID / HIGH twin */
  /* an n × n square with its corners off (cushions, mounds, pads) */
  function round(g, i, i1, j, j1, k, k1, c) {
    g.box(i, i1, j, j1, k, k1, function (x, y, z) { return (x === i || x === i1) && (z === k || z === k1) ? null : typeof c === 'function' ? c(x, y, z) : c; });
  }
  /* a set-only box: never clears what is there (Grid.box with a function that returns null clears) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = fn(i, j, k); if (c) g.set(i, j, k, c); }
  }
  /* a tiny flower on G16 (MID / HIGH): a stem and a plus-shaped head round a gold eye */
  function bloom(g, i, k, h, head, j0) {
    var j = (j0 || 0) + h;
    g.box(i, i, j - h, j - 1, k, k, '4').set(i - 1, j, k, head).set(i + 1, j, k, head).set(i, j, k - 1, head).set(i, j, k + 1, head).set(i, j, k, '2');
  }

  /* ---------------- castle_throne ---------------- */
  function throneVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G16), pn = grid(G16, 0.5, 0), f = grid(G16), pivots = {};
    /* the dais: two steps of cut stone; the carpet runs up the front step to the chair */
    o.box(-7, 6, 0, 0, -7, 6, function (i, j, k) { return !lite && k === 6 && i >= -2 && i <= 1 ? 'c' : 'S'; });
    o.box(-6, 5, 1, 1, -6, 5, function (i, j, k) { return !lite && k >= -1 && i >= -2 && i <= 1 ? 'c' : 's'; });
    /* the chair: a gold seat block, a purple cushion, gold arms, a tall back with a stepped crest */
    o.box(-4, 3, 2, 5, -5, -1, function (i, j, k) { return k === -1 && i >= -3 && i <= 2 ? 'v' : 'y'; });   /* a purple apron on its front */
    round(o, -4, 3, 6, 6, -5, -1, 'v');
    [-5, 4].forEach(function (i) { o.box(i, i, 2, 8, -5, 0, 'y'); });
    o.box(-4, 3, 2, 21, -7, -6, 'y').box(-3, 2, 22, 22, -7, -6, 'y').box(-2, 1, 23, 23, -7, -6, 'y');
    o.box(-3, 2, 7, 15, -5, -5, 'v');                                                          /* the back cushion */
    if (!lite) o.decal('+z', [-2, 2, -1], [4, 4], 'sun');                                     /* a gold sun on the apron, under the pet */
    /* the canopy on two gold poles at the back corners: three purple tiers and a gold knob */
    [-7, 6].forEach(function (i) { o.box(i, i, 2, 25, -7, -7, 'y'); });
    o.box(-7, 6, 26, 26, -7, 3, function (i, j, k) { return k === 3 ? 'y' : 'v'; });
    o.box(-6, 5, 27, 27, -6, 2, 'v').box(-4, 3, 28, 28, -5, 1, 'v').box(-1, 0, 29, 29, -3, -2, 'y');
    /* three pennants under the front edge, hinged at their tops (G16, odd: centred on x = -0.3125, 0, 0.3125) */
    TH.pens.forEach(function (c, n) {
      pn.group('p' + n, function () { pn.box(c - 1, c + 1, 25, 25, 3, 3, 'y').box(c - 1, c + 1, 22, 24, 3, 3, 'c').set(c, 21, 3, 'c'); });
      pivots['p' + n] = [c * G16, TH.hingeY, TH.hingeZ];
    });
    if (!lite) {
      [-5, 4].forEach(function (i) { f.box(i, i, 9, 9, -5, -1, '9'); });                       /* arm pads */
      [[-6, -6], [5, -6], [-6, 2], [5, 2]].forEach(function (q) { f.set(q[0], 28, q[1], '2'); });   /* gold knobs on the canopy's corners */
      [[-6, 4], [5, 4]].forEach(function (q) { f.box(q[0], q[0], 2, 3, q[1], q[1], 'w'); bloom(f, q[0], q[1], 2, '1', 2); });   /* two flower pots */
    }
    return model('castle_throne', pal('sScyvw12459'), [o, pn, f], { pivots: pivots, anchors: { seat: TH.seat }, ao: false });
  }

  /* ---------------- castle_flinger ---------------- */
  function flingerVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G16), pk = grid(G16), f = grid(G16);
    /* the fulcrum: a stepped stone block under the hinge (x = -0.25), a sandstone cap and the gold axle's ends */
    o.box(-7, -2, 0, 1, -4, 3, 's').box(-6, -3, 2, 3, -3, 2, 's').box(-5, -4, 4, 4, -3, 2, 'd');
    if (!lite) o.set(-5, 5, -3, 'y').set(-4, 5, -3, 'y').set(-5, 5, 2, 'y').set(-4, 5, 2, 'y');
    pk.group('plank', function () {
      /* the painted plank: wood with a coral stripe down its top and gold bands by the seat and the basket */
      pk.box(-14, 13, 5, 6, -2, 1, function (i, j, k) { return i === -9 || i === 5 ? 'y' : j === 6 && (k === -1 || k === 0) ? 'c' : 'P'; });
      round(pk, -13, -10, 7, 7, -2, 1, 't');                                                   /* the padded seat */
      pk.box(-13, -10, 8, 9, -2, -2, 't').box(-13, -10, 10, 10, -2, -2, 'y');                  /* its backrest */
      /* the woven basket: a floor, walls in woven bands, a sandstone rim, heaped with flowers in clumps */
      pk.box(6, 13, 7, 7, -3, 2, 'w');
      fill(pk, 6, 13, 8, 10, -3, 2, function (i, j, k) { return i === 6 || i === 13 || k === -3 || k === 2 ? (j === 9 ? 'w' : 'd') : null; });
      /* the heap: leaves to the rim, then a dome of flower clumps (2 × 2 heads in three colours) and a gold one on top */
      pk.box(7, 12, 8, 10, -2, 1, 'g');
      round(pk, 7, 12, 11, 11, -2, 1, function (i, j, k) { return 'pyl'[(((i - 7) >> 1) + 2 * ((k + 2) >> 1)) % 3]; });
      round(pk, 8, 11, 12, 12, -2, 1, function (i, j, k) { return 'lpy'[(((i - 8) >> 1) + ((k + 2) >> 1)) % 3]; });
      pk.box(9, 10, 13, 13, -1, 0, 'y');
      if (!lite) [[6, 11, 0], [13, 11, -1], [9, 11, 2], [11, 11, -3], [10, 11, 2]].forEach(function (q) { pk.set(q[0], q[1], q[2], '4'); });   /* leaves over the rim */
    });
    if (!lite) {
      /* fallen petals on the grass and a tuft by the fulcrum */
      [[-1, 4, '1'], [2, 5, '3'], [5, 4, '2'], [8, 5, '1'], [11, 4, '3'], [3, -5, '2'], [9, -5, '1'], [-11, 5, '3']].forEach(function (q) { f.set(q[0], 0, q[1], q[2]); });
      bloom(f, -9, -5, 2, '3'); bloom(f, -12, 4, 1, '1');
    }
    return model('castle_flinger', pal('sdyPtwpylcg1234', {}), [o, pk, f],
      { pivots: { plank: FL.plank }, anchors: { seat: FL.seat.concat('plank') }, ao: false });
  }

  /* ---------------- castle_maypole ---------------- */
  /* the ring round the 2 × 2 pole the wound ribbon steps through (anticlockwise from the front) */
  var WIND = [[-1, 1], [0, 1], [1, 0], [1, -1], [0, -2], [-1, -2], [-2, -1], [-2, 0]];
  function maypoleVoxels(st, opt) {
    var lite = !!(opt && opt.lite), base = grid(G8), o = grid(G16), cr = grid(G16), f = grid(G16), pivots = { ribbons: MP.crown }, j;
    /* a little meadow mound */
    round(base, -2, 1, 0, 0, -2, 1, function (i, y, k) { return (i + k) & 1 ? 'G' : 'g'; });
    base.box(-1, 0, 1, 1, -1, 0, 'g');
    /* the white pole (0.125 u square) and its gold ball */
    o.box(-1, 0, 4, 35, -1, 0, 'u');
    if (lite) o.box(-1, 0, 36, 38, -1, 0, 'y');                                               /* (the halved pole keeps one column: no wider knob) */
    else { round(o, -2, 1, 36, 37, -2, 1, 'y'); o.box(-1, 0, 38, 38, -1, 0, 'y'); }
    /* the wound ribbon: one turn every 0.5 u, changing colour through the six every 0.25 u (MID / HIGH) */
    if (!lite) for (j = 6; j <= 29; j++) { var w = WIND[(j - 6) % 8]; f.set(w[0], j, w[1], TWIN[MP.rib[((j - 6) >> 2) % 6]]); }
    /* the crown (on 'ribbons'): a leafy ring with six flowers, and the six loose tails hinged under it */
    cr.group('ribbons', function () {
      cr.ring(-0.5, 31, -0.5, 4.6, 1.6, 'y', function (i, y, k) { return (i + k) & 1 ? 'G' : 'g'; });
      MP.tails.forEach(function (q, n) { var fl = 'pWylpW'[n]; cr.set(q[0], 32, q[2], fl).set(q[1], 32, q[3], fl); });   /* six flowers */
    });
    MP.tails.forEach(function (q, n) {
      var t = tailAt(n);
      cr.group('r' + n, function () {
        cr.box(q[0], q[1], MP.tailEnd + 1, 30, q[2], q[3], MP.rib[n]);
        cr.set(q[0], MP.tailEnd, q[2], MP.rib[n]);                                             /* a notched end */
      });
      pivots['r' + n] = [t.x, MP.hingeY, t.z, 'ribbons'];
    });
    if (!lite) { bloom(f, -6, 4, 2, '1'); bloom(f, 5, -6, 2, '3'); bloom(f, 5, 4, 1, '2'); bloom(f, -6, -6, 1, '1'); }
    var anchors = {};
    for (var n = 0; n < 3; n++) { var a = n * TAU / 3; anchors['ring' + n] = [MP.ring * Math.sin(a), 0, MP.ring * Math.cos(a)]; }
    return model('castle_maypole', pal('ygGucmblpW12347', { 8: INK[8], 6: INK[6], 7: INK[7] }), [base, o, cr, f],
      { pivots: pivots, anchors: anchors, ao: false });
  }

  /* ---------------- castle_bridge ---------------- */
  function bridgeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), cp = grid(G16), dk = grid(G16), f = grid(G16), i, j, k;
    /* the moat strip (two blues) runs front to back under the arch, between two stone kerbs */
    for (i = -4; i <= 4; i++) for (k = -3; k <= 3; k++) o.set(i, 0, k, Math.abs(i) === 4 ? 'S' : Math.abs(i) <= 1 || lite ? 'A' : 'a');
    /* the humpback: cut stone under a cobble deck that steps up to the crown, a round arch over the water
       ringed in sandstone, a low stone parapet along both edges under a thin sandstone coping (G16) */
    for (i = -7; i <= 7; i++) {
      var ai = Math.abs(i), D = BR.deck[ai], top = BR.arch[ai];
      for (j = ai <= 4 ? 1 : 0; j <= D; j++) for (k = -2; k <= 2; k++) {
        if (j <= top) continue;                                                                   /* the arch */
        var face = Math.abs(k) === 2;
        o.set(i, j, k, j === D && !face ? 'k' : face && !lite && j === top + 1 && ai <= 4 ? 'd' : 's');
      }
      [-2, 2].forEach(function (z) { o.set(i, D + 1, z, 's'); });
      if (!lite) cp.box(2 * i - 1, 2 * i, 2 * D + 4, 2 * D + 4, -5, -4, 'd').box(2 * i - 1, 2 * i, 2 * D + 4, 2 * D + 4, 3, 4, 'd');
    }
    /* two white ducks with gold beaks inside the arch, on 'ducks' (G16, facing +z) */
    dk.group('ducks', function () {
      [[-4, -1], [1, 0]].forEach(function (q) {
        var x = q[0], z = q[1];
        dk.box(x, x + 2, 0, 1, z, z + 2, 'W').set(x + 1, 2, z, 'W');                         /* body and tail */
        dk.box(x, x + 2, 2, 3, z + 1, z + 2, 'W').set(x + 1, 2, z + 3, 'y');                  /* head and beak */
        dk.set(x, 3, z + 2, 'e').set(x + 2, 3, z + 2, 'e');                                    /* eyes */
      });
    });
    /* lily pads on the strip in front and behind (a bud on one) and flowers on the banks (MID / HIGH) */
    if (!lite) {
      round(f, 2, 4, 2, 2, 5, 6, '4'); f.set(3, 3, 5, '1');
      round(f, -5, -3, 2, 2, -7, -6, '4');
      bloom(f, -12, 5, 1, '3'); bloom(f, 11, 5, 1, '1'); bloom(f, 10, -6, 1, '2');
    }
    return model('castle_bridge', pal('sSdkaAWye41235'), [o, cp, [dk, BR.ducks], f],
      { pivots: { ducks: BR.ducks }, anchors: { s0: BR.s0, s1: BR.s1, s2: BR.s2 }, ao: false });
  }

  /* ---------------- castle_feast ---------------- */
  function feastVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0, 0.5), d = grid(G16), f = grid(G8, 0, 0.5);
    /* the trestle table under a checked cloth that hangs over the front edge */
    o.box(-7, 6, 3, 3, -2, 2, function (i, j, k) { return lite ? 'c' : (i + k) & 1 ? 'W' : 'c'; });
    o.box(-7, 6, 2, 2, 2, 2, function (i) { return lite ? 'c' : i & 1 ? 'c' : 'W'; }).box(-7, 6, 2, 2, -2, 1, 'w');      /* the board under the cloth */
    [-6, 5].forEach(function (i) { o.box(i, i, 0, 2, -1, 1, 'w').box(i, i, 0, 0, -2, 2, 'w'); });
    /* a bench on each side */
    [-3, 3].forEach(function (k) { o.box(-6, 5, 1, 1, k, k, 'P'); [-6, 5].forEach(function (i) { o.set(i, 0, k, 'w'); }); });
    if (!lite) f.box(-5, 4, 1, 1, 0, 0, 'M');                                                  /* the stretcher */
    d.group('dishes', function () {
      /* a lattice pie on a plate */
      d.disc(-10.5, 0, -0.5, 3.6, 'y', 'W');
      d.disc(-10.5, 1, -0.5, 3.1, 'y', 'x');
      d.disc(-10.5, 2, -0.5, 2.6, 'y', function (i, j, k) { return (k + 20) % 2 ? 'x' : 'd'; });
      /* the fruit bowl: an apple, a bunch of grapes, an orange */
      d.disc(-4.5, 0, 1.5, 2.1, 'y', 't'); d.ring(-4.5, 1, 1.5, 2.6, 1.4, 'y', 't');
      d.box(-6, -5, 1, 2, 1, 2, 'r');
      d.box(-4, -3, 1, 2, 0, 1, 'v').box(-4, -4, 3, 3, 1, 1, 'v').set(-3, 1, 2, 'v');
      d.box(-4, -3, 1, 2, 2, 3, 'o');
      /* the pet's plate with a slice of cake */
      d.disc(-0.5, 0, -2.5, 2.1, 'y', 'W'); d.box(-1, 0, 1, 2, -3, -2, 'd').box(-1, 0, 3, 3, -3, -2, 'p');
      /* the cake: two tiers, pink then white icing, a cherry on top (no candle) */
      d.disc(5.5, 0, -0.5, 3.6, 'y', 'W');
      d.disc(5.5, 1, -0.5, 3.1, 'y', 'd'); d.disc(5.5, 2, -0.5, 3.1, 'y', 'd'); d.disc(5.5, 3, -0.5, 3.1, 'y', 'p');
      d.disc(5.5, 4, -0.5, 2.1, 'y', 'd'); d.disc(5.5, 5, -0.5, 2.1, 'y', 'W'); d.box(5, 6, 6, 6, -1, 0, 'r');
      /* the jug */
      d.box(10, 12, 0, 4, -2, 0, function (i, j) { return j === 3 ? 'W' : 'b'; });
      d.set(11, 4, 1, 'b').box(13, 13, 1, 3, -1, -1, 'b');
    });
    if (!lite) {
      /* icing drips down the cake, the apple's leaf (MID / HIGH; on 'dishes' too) */
      d.group('dishes', function () { [[2, 2, -1], [9, 2, 0], [5, 2, 3], [6, 2, -4]].forEach(function (q) { d.set(q[0], q[1], q[2], '1'); }); d.set(-6, 3, 1, '4'); });
    }
    return model('castle_feast', pal('wWcPxtrvodpb14', { M: { token: 'PX Castle Wood', lod: MID } }), [o, f, [d, FE.dishes]],
      { pivots: { dishes: FE.dishes }, anchors: { seat: FE.seat }, ao: false });
  }

  var BUILD = { castle_throne: throneVoxels, castle_flinger: flingerVoxels, castle_maypole: maypoleVoxels, castle_bridge: bridgeVoxels, castle_feast: feastVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no trims, details or decals), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('castle-a', K → {id: {voxels, lod1, act, forget}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], FR = [0, 0, 0], MA = {};
    var GOLD = { token: 'PX Castle Gold' };
    function pose(a, name, rx, ry, rz, x, y, z, sx, sy, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z;
      S3[0] = sx == null ? 1 : sx; S3[1] = sy == null ? 1 : sy; S3[2] = sz == null ? 1 : sz;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function emit(a, kind, at, n, opts) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n, opts); } catch (e) { /* fx is optional */ } } }
    /* the pet's part (the crew owns it: a seat, a trail, the maypole ring, the feast sit) */
    function askPet(a, id) {
      var p = a.pets;
      if (!p || typeof p.perform !== 'function') return;
      try { p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { /* no crew yet */ }
    }
    /* the active pet's 'voice' step (SLSound.VOICE_STEPS), or -1 with no pet */
    function voiceStep(a) {
      var p = a.pets, pet = p && typeof p.active === 'function' ? p.active() : null, S = snd();
      if (typeof pet !== 'string') return -1;
      return S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : VOICE4.indexOf(pet);
    }
    var live = new Map();
    function forget(uid) { live.delete(uid); }
    /* an own cue list under reduced motion: its sounds at t = 0 and one sparkle (as SLMotion's) */
    function stillCues(list) {
      var out = list.filter(function (c) { return c.sfx; }).map(function (c) { var q = {}; for (var k in c) q[k] = c[k]; q.t = 0; return q; });
      out.push({ t: 0, emit: 'sparkle', n: 1 });
      return out;
    }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me), rest(a, reduced), at?(cue, out) → local point (sparkles go to 'top' unless the cue is local), cut? (own
       seconds), cues? (own list)} */
    function run(a, id, spec) {
      var name = ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, o = { reduced: reduced, from: prev && !reduced ? M.carry(name, prev.out) : null };
      var dur = reduced ? 0 : spec.cut || M.durOf(name, o), cues = !spec.cues ? M.cues(name, o) : reduced ? stillCues(spec.cues) : spec.cues;
      var ci = 0, done = false, uid = a.uid, me = { name: name, dur: dur, out: {}, mark: -1 };
      live.set(uid, me);
      askPet(a, id);
      function stop() { done = true; if (live.get(uid) === me) live.delete(uid); }
      me.update = function (h, tAct) {
        if (done || live.get(uid) !== me) return false;
        h = h || a;
        var t = tAct > 0 ? +tAct : 0, tt = t < dur ? t : dur;
        M.sample(name, tt, me.out, o);
        for (; ci < cues.length && cues[ci].t <= t + 1e-6; ci++) {
          var c = cues[ci];
          try {
            if (c.emit) emit(h, c.emit, ((c.emit !== 'sparkle' || c.local) && spec.at && spec.at(c, me.out)) || 'top', c.n || 1);
            else if (typeof h.sfx !== 'function') continue;
            else if (!c.pet) h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
            else if (voiceStep(h) >= 0) h.sfx('voice', c.vol == null ? 1 : c.vol, voiceStep(h));
          } catch (e) { /* a cue never stops its act */ }
        }
        if (t < dur) { spec.apply(h, me.out, tt, me); return true; }
        stop();
        spec.rest(h, reduced);
        return false;
      };
      me.cancel = function () { if (!done) { stop(); try { spec.rest(a, false); } catch (e) { /* the copy is gone */ } } };
      return me;
    }

    /* ---------- throne: the pet hops up and sits; on the fanfare the pennants fly out, flutter and settle ---------- */
    var PA = {};
    function pennants(a, t, reduced) {
      for (var n = 0; n < 3; n++) {
        if (t == null) { PA.lift = reduced ? TH.out : 0; PA.wave = 0; } else penAt(t, n, PA);
        pose(a, 'p' + n, -PA.lift, 0, PA.wave, 0, 0, 0);
      }
    }
    var throneSpec = {
      apply: function (a, out, t, me) {
        pennants(a, t);
        if (me.mark < 0 && t >= TH.sparkAt) { me.mark = 1; emit(a, 'sparkle', TH.spark, 3, GOLD); }
      },
      /* reduced motion: the pennants out (the pet is seated, waving) */
      rest: function (a, reduced) { pennants(a, null, reduced); }
    };

    /* ---------- flower flinger: the seat end dips, the basket end swings up 25° and the petals fly ---------- */
    var tossSpec = {
      apply: function (a, out) { pose(a, 'plank', 0, 0, FL.deg * (out.bob || 0), 0, 0, 0); },
      /* reduced motion: the basket up (the pet on the low end; the petals already lie on the grass) */
      rest: function (a, reduced) { pose(a, 'plank', 0, 0, reduced ? FL.deg : 0, 0, 0, 0); },
      at: function () { return FL.fling; }
    };

    /* ---------- maypole: the tails fan out, the crown turns once with the dancers, the tails fold back ---------- */
    var TAILS = MP.tails.map(function (q, n) { return tailAt(n).theta; });
    function maypolePose(a, fan, turn, t) {
      pose(a, 'ribbons', 0, turn, 0, 0, 0, 0);
      for (var n = 0; n < 6; n++) {
        var w = fan > 0 && t != null ? 1 + MP.ripple * Math.sin(TAU * MP.rippleHz * t + n) : 1;
        fanRot(TAILS[n], MP.fan * fan * w, FR);
        pose(a, 'r' + n, FR[0], 0, FR[2], 0, 0, 0);
      }
    }
    var danceSpec = {
      cut: MP.cut, cues: MP.cues,
      apply: function (a, out, t) { mayAt(t, MA); maypolePose(a, MA.fan, MA.turn, t); },
      /* reduced motion: the ribbons fanned out (the crew in a ring) */
      rest: function (a, reduced) { maypolePose(a, reduced ? 1 : 0, 0, null); },
      at: function () { return MP.notes; }
    };

    /* ---------- moat bridge: the ducks paddle out from under the arch, bob once and paddle back ---------- */
    var ducksSpec = {
      apply: function (a, out) {
        var s = Math.max(0, out.swing || 0);
        pose(a, 'ducks', -BR.nod * s, 0, 0, 0, BR.hop * s, BR.out * (out.bob || 0));
      },
      /* reduced motion: the ducks out (the pet waves from the crown) */
      rest: function (a, reduced) { pose(a, 'ducks', 0, 0, 0, 0, 0, reduced ? BR.out : 0); },
      at: function () { return BR.splash; }
    };

    /* ---------- feast table: the dishes dip and pop up (0.8 → 1, no overshoot); the pet sits for a bite ---------- */
    var serveSpec = {
      cut: FE.cut, cues: FE.cues,
      apply: function (a, out, t) { var s = dishAt(t); pose(a, 'dishes', 0, 0, 0, 0, 0, 0, s, s, s); },
      rest: function (a) { rest(a, 'dishes'); },
      at: function () { return FE.plate; }
    };

    var SPEC = { castle_throne: throneSpec, castle_flinger: tossSpec, castle_maypole: danceSpec, castle_bridge: ducksSpec, castle_feast: serveSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { throne: TH, flinger: FL, maypole: MP, bridge: BR, feast: FE },
    penAt: penAt, fanRot: fanRot, mayAt: mayAt, dishAt: dishAt, tailAt: tailAt
  };
}));
