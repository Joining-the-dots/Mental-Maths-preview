/* ================================================================
   My Island v3 — SLPxPierC (W3.2c): the Theme Park Pier's stalls and seaside bits in Pixel Blocks.
   window.SLPxPierC + SL3D.defineVox('pier-c', factory) in the browser, module.exports in Node:
   {IDS, voxels: {<id>: fn(st, o) → VoxModel}, lod1: {<id>: fn(st) → VoxModel}, factory, …}.
   Every model is pure data (no THREE, no DOM). Item space as the kit: base y = 0, pivot at the
   footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u (|x|, |z| ≤ 0.43),
   open doors and hatches included. Seven repeatable 1 × 1 items:
     pier_candyfloss  a pink-and-white striped barrow on one big sunny wheel with a white hub, a
                      leg and a push bar: on its counter a pale-steel drum ('drum', four pink sugar
                      dabs) in a pale glass guard, the big pink cloud on its stick ('cloud') and a
                      holder of three ready clouds on sticks (pink, mint, lilac: the pictogram).
                      Act 'floss': the old cloud is taken, the drum turns three quarters (its four
                      dabs end where they began), the cloud regrows in three steps and dips for the
                      pet's nibble.
     pier_popcorn     a coral-and-white wagon on two sunny wheels under a stepped coral / white
                      canopy with a scalloped valance and a sunny ball; on the counter a glass case
                      (pale-blue panes, open in front) heaped with cream kernels ('kernels') and a
                      striped bag on the end ('bag'). Act 'popcorn': the kernels hop three times
                      and a fresh bag pops out.
     pier_icecream    a pink-and-white kiosk with a cream roof and a scalloped pink valance, a
                      serving window with tubs inside, a cream counter and a striped hatch
                      ('hatch', hinged along its top); the giant waffle cone with pink, mint and
                      cream scoops and a cherry on the roof is the pictogram. Act 'scoop' (a
                      remembered toggle): the hatch flips up and a cone slides out of the window
                      onto the counter ('cone').
     pier_deckchair   a folding plank frame with a banded canvas on 'sling' in four colourways,
                      a bucket and a spade at its foot. Act 'lounge': the canvas sags under the pet.
     pier_balloons    a weighted blue / white drum stand with a rope grip and a sunny post on
                      'lift', seven plain rounded balloons on 'bunch' (a child of 'lift'). Act
                      'liftoff': the bunch lifts the stand 0.4 u with the pet on 'grip', bobs and
                      lands. Nothing pops or flies away.
     pier_lamppost    a blue / white banded post (as the rim's lamp posts) on a foot, a crown of
                      four bulbs (state 'lit') on short arms round a coral finial (anchor 'top', the
                      gull's perch) and two streamers of pennants on 'tails'. Act 'glow' (a
                      remembered toggle); on with the night.
     pier_beachhut    a hut with white boards and corners on a plank deck, a stepped pitched roof
                      framing a white gable with a round window, two boarded doors ('doorL',
                      'doorR'), in four colourways; inside
                      a little deckchair, a bucket and a spade. Act 'open' (a remembered toggle).
   GRAIN (D11): bodies, roofs and the big cloud G8; balloons (G8-sized cores), wheels, drums, doors,
   the chair, glass, pennants, bulbs and trims G16; the counter cone G32. Stripes are painted (one
   colour per voxel) or, on the kiosk, raised white boards at MID.
   LOW (D106): trims, glass, fluff, knots, props and glints are tagged lod 'mid'. Every id brings
   its own lod1: its plain masses with the same pivots and anchors, under TRIS_CAPS_LOD1. No corner
   AO (as the pier's rides: on stripes and G16 parts it only splits quads).
   PARTS THAT COME AND GO have no alpha: the candyfloss cloud and the popcorn bag rest at full
   size (the act's end state) and are scaled away and back by the act; the kiosk's counter cone
   waits in the window behind the closed hatch and slides out as it opens.
   TOGGLES: 'open', 'scoop' and 'glow' keep their memory in the island's lit map. An explicit
   name ('glowOn' / 'glowOff', 'close') says which way; the CATALOG act goes away from what the
   copy shows, or to a.lit when the host has already flipped it. lit(a, on) snaps.
   Every act is an SLMotion timeline (≤ 3 s, nothing over 2 Hz; reduced motion = the end state
   at once with one sparkle and the same sounds), pets come only through a.pets.perform(kind,
   uid), and nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.show a.lit a.batch · a.pivot(name).set(rotDeg[3],
   pos[3], scale[3]) · a.state(key, v) · a.emit(kind, where, n) · a.sfx(name, vol, step) · a.pets
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPierC = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pier-c', api.factory);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPierC: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 1;
  var IDS = ['pier_candyfloss', 'pier_popcorn', 'pier_icecream', 'pier_deckchair', 'pier_balloons', 'pier_lamppost', 'pier_beachhut'];
  var G8 = 0.125, G16 = 0.0625, G32 = 0.03125, TAU = Math.PI * 2;
  var HUT_WAYS = ['PX Pier Stripe Blue', 'PX Coral', 'PX Mint', 'PX Sunny'];
  var CHAIR_WAYS = ['PX Coral', 'PX Pier Stripe Blue', 'PX Mint', 'PX Sunny'];
  /* the pet's part of each act (= the LOOK entries' perform; the lamp post and the hut have none) */
  var PERFORM = { pier_candyfloss: 'stand:sit', pier_popcorn: 'stand:sit', pier_icecream: 'stand:sit', pier_deckchair: 'bench', pier_balloons: 'seat:hang' };
  /* the remembered toggles: the CATALOG act and the explicit names for each way */
  var TOGGLES = {
    pier_beachhut: { act: 'open', on: ['glowOn'], off: ['close', 'glowOff'] },
    pier_icecream: { act: 'scoop', on: ['glowOn'], off: ['glowOff'] },
    pier_lamppost: { act: 'glow', on: ['glowOn'], off: ['glowOff'] }
  };

  /* ================================================================
     LAYOUT (item metres: pivots, anchors and what the acts move)
     ================================================================ */
  var FLOSS = { drum: [0.0625, 0.625, 0], cloud: [0.0625, 0.75, 0], seat: [0.1875, 0, 0.375], turn: 270, steps: 3, nod: 12, away: 0.25 };
  var POP = { kernels: [-0.0625, 0.625, 0], bag: [0.28125, 0.625, -0.03125], seat: [-0.0625, 0, 0.375], hop: 0.0625, at: 1.6, grow: 0.3, away: 0.15 };
  var ICE = { hatch: [0, 0.5625, 0.15625], cone: [0.125, 0.3125, 0], seat: [-0.1875, 0, 0.375], out: 0.21875, from: 0.35, deg: 100 };
  var CHAIR = { sling: [0, 0.6875, -0.3125], seat: [0, 0.1875, 0.0625], sag: 0.125 };
  var BAL = { lift: [0, 0, 0], bunch: [0, 0.75, 0], grip: [0, 0.0625, 0.3125], rise: 0.4, bob: 0.04, lean: 5, sway: { deg: 2.5, period: 3.6 } };
  var LAMP = { tails: [0, 1.1875, 0], top: 1.5, flick: 14, sway: { deg: 3, hz: 0.3 }, hold: 1 };
  var HUT = { doorL: [-0.25, 0.0625, 0.125], doorR: [0.25, 0.0625, 0.125], deg: 100, front: 0.125 };

  /* ================================================================
     BUILDER HELPERS (pure)
     ================================================================ */
  /* a builder grid: odd (voxel 0 centred on the pivot column) or even (voxels −1 and 0 straddle it) */
  function grid(g, odd) { return vox().grid({ grid: g, origin: [odd ? 0.5 : 0, 0, odd ? 0.5 : 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | {g, at?, ground?}]; o.pivots {name: [x, y, z, parent?]} and
     o.anchors {name: [x, y, z, pivot?]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = l.g || l, ly;
      if (!g.count) return;
      ly = { vox: g.snapshot() };
      if (l.at) ly.at = l.at.slice();
      if (l.ground === false) ly.ground = false;
      m.layers.push(ly);
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { var p = o.pivots[n]; m.pivots[n] = { at: U(p), parent: p[3] || null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    if (o.cull) m.cull = o.cull.slice();
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  function mid(token) { return { token: token, lod: 'mid' }; }      /* MID / HIGH detail: tier LOW drops it (D89) */
  var WHITE = 'Cloud White', GLASS = { token: 'PX Lens Pale', mode: 'ice', lod: 'mid' };
  /* fn(i, j, k) → a char, or null to leave that cell as it is (box() would clear it) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = fn(i, j, k); if (c) g.set(i, j, k, c); }
  }
  /* a box with its four upright corner columns left out (a rounded block) */
  function rounded(g, i0, i1, j0, j1, k0, k1, c) {
    fill(g, i0, i1, j0, j1, k0, k1, function (i, j, k) { return (i === i0 || i === i1) && (k === k0 || k === k1) ? null : typeof c === 'function' ? c(i, j, k) : c; });
  }
  /* the ring a rounded block adds round a core one voxel in from it on every side (MID rounding) */
  function rim(g, i0, i1, j0, j1, k0, k1, c) {
    fill(g, i0, i1, j0, j1, k0, k1, function (i, j, k) { return (i === i0 || i === i1) + (k === k0 || k === k1) === 1 ? c : null; });
  }
  /* two colours alternating along an axis every `w` voxels, symmetric about 0 */
  function stripe(a, b, w) { return function (i) { return ((Math.abs(i) + (w >> 1)) / w | 0) & 1 ? b : a; }; }
  function tokensOf(id, dflt) {
    var lk = look(), e = lk && lk.LOOK && lk.LOOK[id], t = e && e.variantTokens;
    return Array.isArray(t) && t.length ? t : dflt;
  }
  function variantOf(st, n) {
    var v = st && typeof st.variant === 'number' && isFinite(st.variant) ? Math.floor(st.variant) : 0;
    return ((v % n) + n) % n;
  }

  /* ================================================================
     CANDY-FLOSS BARROW — lite = the LOD1 build (the same pivots and anchors in a handful of boxes)
     ================================================================ */
  var FLOSS_PAL = { p: 'PX Candy Pink', w: WHITE, c: 'PX Cream', y: 'PX Sunny', k: 'PX Pier Pile', m: 'PX Castle Stone', g: GLASS,
    P: mid('PX Candy Pink'), W: mid(WHITE), Y: mid('PX Sunny'), N: mid('PX Mint'), L: mid('PX Lilac'), C: mid('PX Cream') };
  /* the three ready clouds: [i0, j0, k0 (the low corner of a 2³ G16 puff), colour] */
  var PUFFS = [[-6, 13, -3, 'L'], [-5, 14, -1, 'N'], [-6, 12, 1, 'P']];
  function candyfloss(st, lite) {
    var b = grid(G8, true), e = grid(G16), f = grid(G16, true), c = grid(G8), q = grid(G16), fl = grid(G16);
    /* the barrow: a striped body on one big wheel and a leg, a cream counter */
    b.box(-2, 2, 1, 3, -1, 1, lite ? 'p' : stripe('p', 'w', 1));
    b.box(-2, 2, 4, 4, -1, 1, 'c');
    b.set(2, 0, 0, 'k');
    /* the wheel (front, and its twin behind at MID): a round sunny disc with a white hub */
    [[4, 'y', 'w'], [-5, 'Y', 'W']].forEach(function (w) {
      if (lite && w[0] < 0) return;
      rounded(e, -5, 0, 0, 5, w[0], w[0], function (i, j) { return !lite && w[0] > 0 && (i === -3 || i === -2) && (j === 2 || j === 3) ? w[2] : w[1]; });
    });
    /* the push bar at the back end */
    if (!lite) {
      [-2, 2].forEach(function (k) { f.box(5, 6, 7, 7, k, k, 'Y').box(6, 6, 8, 11, k, k, 'Y'); });
      f.box(6, 6, 11, 11, -1, 1, 'Y');
    }
    /* the drum: a pale-steel pan with four pink sugar dabs on its rim at MID (so its turn shows) in a glass guard */
    f.group('drum', function () {
      rounded(f, -1, 3, 10, 10, -2, 2, 'm');
      if (!lite) f.set(-1, 11, 0, 'P').set(3, 11, 0, 'P').set(1, 11, -2, 'P').set(1, 11, 2, 'P');
    });
    if (!lite) {
      f.box(-2, 4, 10, 10, -3, -3, 'g').box(-2, 4, 10, 10, 3, 3, 'g').box(-2, -2, 10, 10, -2, 2, 'g').box(4, 4, 10, 10, -2, 2, 'g');
      f.box(1, 1, 11, 11, 0, 0, 'W');                                          /* the stick */
    }
    /* the big cloud (G8, on the stick): a round pink puff, a little fluff on top at MID */
    c.group('cloud', function () {
      if (lite) { c.box(-2, 1, 6, 8, -2, 1, 'p'); return; }
      c.box(-1, 0, 6, 6, -1, 0, 'p').box(-1, 0, 9, 9, -1, 0, 'p');
      rounded(c, -2, 1, 7, 8, -2, 1, 'p');
    });
    if (!lite) fl.group('cloud', function () { fl.box(-4, -3, 18, 18, -2, -1, 'P').box(2, 3, 18, 18, 0, 1, 'P'); });
    /* three ready clouds on sticks in a cream holder at the front end: the pictogram */
    if (!lite) {
      q.box(-6, -4, 10, 10, -3, 1, 'C');
      PUFFS.forEach(function (r) {
        q.box(r[0] + 1, r[0] + 1, 11, r[1] - 1, r[2] + 1, r[2] + 1, 'W');
        q.box(r[0], r[0] + 1, r[1], r[1] + 1, r[2], r[2] + 1, r[3]);
      });
    }
    return model('pier_candyfloss', FLOSS_PAL, [b, e, f, { g: c, at: [FLOSS.cloud[0], 0, 0] }, q, { g: fl, at: [FLOSS.cloud[0], 0, 0] }], {
      pivots: { drum: FLOSS.drum, cloud: FLOSS.cloud }, anchors: { seat: FLOSS.seat } });
  }

  /* ================================================================
     POPCORN WAGON
     ================================================================ */
  var POP_PAL = { r: 'PX Coral', w: WHITE, y: 'PX Sunny', e: 'PX Cream', g: GLASS, R: mid('PX Coral'), W: mid(WHITE), E: mid('PX Cream'), Y: mid('PX Sunny') };
  function popcorn(st, lite) {
    var b = grid(G8, true), f = grid(G16, true);
    /* the wagon: a striped body between two side wheels, a white counter */
    b.box(-2, 2, 1, 3, -1, 1, lite ? 'r' : stripe('r', 'w', 1));
    b.box(-2, 2, 4, 4, -1, 1, 'w');
    [-6, 6].forEach(function (i) {
      if (lite) { f.box(i, i, 0, 4, -2, 2, 'y'); return; }
      rounded(f, i, i, 0, 4, -2, 2, 'y');
      f.set(i - (i > 0 ? 1 : -1), 2, 0, 'W');                                  /* the axle */
    });
    /* the glass case on the counter: coral corner posts, pale panes on three sides, open in front;
       the heap of kernels inside rides 'kernels' */
    if (!lite) {
      [[-4, -2], [2, -2], [-4, 2], [2, 2]].forEach(function (p) { f.box(p[0], p[0], 10, 13, p[1], p[1], 'R'); });
      f.box(-3, 1, 10, 13, -2, -2, 'g').box(-4, -4, 10, 13, -1, 1, 'g').box(2, 2, 10, 13, -1, 1, 'g');
    }
    f.group('kernels', function () {
      f.box(-3, 1, 10, 11, -1, 1, 'e');
      if (!lite) f.box(-3, -2, 12, 12, -1, 0, 'E').box(0, 1, 12, 12, 0, 1, 'E').box(-1, -1, 12, 13, -1, -1, 'E');
    });
    /* the canopy on four white posts (the front pair MID): coral / white stripes, a scalloped valance, a
       coral ridge and a sunny ball */
    [[-5, -3, 'w'], [5, -3, 'w'], [-5, 3, 'W'], [5, 3, 'W']].forEach(function (p, n) { if (!lite || n < 2) f.box(p[0], p[0], 10, 15, p[1], p[1], lite ? 'r' : p[2]); });
    f.box(-6, 6, 16, 16, -4, 4, lite ? 'r' : stripe('r', 'w', 3));
    if (!lite) {
      f.box(-4, 4, 17, 17, -2, 2, 'r');
      [-5, -1, 3].forEach(function (i) { f.box(i, i + 1, 15, 15, 4, 4, 'R'); });
      f.set(0, 18, 0, 'Y');
    }
    /* the striped bag on the counter's end: pops out in the act */
    f.group('bag', function () {
      f.box(4, 5, 10, 12, -1, 0, lite ? 'r' : function (i) { return i === 4 ? 'r' : 'w'; });
      if (!lite) f.box(4, 5, 13, 13, -1, 0, 'e');
    });
    return model('pier_popcorn', POP_PAL, [b, f], { pivots: { kernels: POP.kernels, bag: POP.bag }, anchors: { seat: POP.seat } });
  }

  /* ================================================================
     ICE-CREAM KIOSK — every face is kept (cull []): the hatch's underside leads when it is open
     ================================================================ */
  var ICE_PAL = { p: 'PX Candy Pink', w: WHITE, c: 'PX Cream', i: 'PX Lilac Base', f: 'PX Waffle', n: 'PX Mint', r: 'PX Coral',
    W: mid(WHITE), P: mid('PX Candy Pink'), N: mid('PX Mint'), C: mid('PX Cream'), R: mid('PX Coral') };
  function icecream(st, lite) {
    var b = grid(G16, true), t = grid(G16, true), cn = grid(G32), x;
    /* the body: pink, with raised white stripes at MID (front, sides and back) */
    b.box(-5, 5, 0, 11, -5, 2, 'p');
    if (!lite) {
      [-4, 4].forEach(function (i) { b.box(i, i, 0, 11, 3, 3, 'W'); });
      [-2, 2].forEach(function (i) { b.box(i, i, 0, 3, 3, 3, 'W'); b.box(i, i, 0, 11, -6, -6, 'W'); });
      [-6, 6].forEach(function (i) { b.box(i, i, 0, 11, -2, -2, 'W'); });
    }
    /* the serving window: a recess four voxels deep, its back a soft lilac with two tubs; a cream counter */
    b.box(-3, 3, 5, 8, -1, 2, null);
    b.box(-3, 3, 5, 8, -2, -2, 'i');
    if (!lite) b.set(-3, 5, -1, 'P').set(-1, 5, -1, 'N');
    b.box(-3, 3, 4, 4, 3, 4, 'c');
    /* the roof: a cream slab over the walls with a scalloped pink valance */
    b.box(-6, 6, 12, 12, -6, 3, 'c');
    if (!lite) for (x = -5; x <= 5; x += 2) b.set(x, 11, 3, 'P');
    /* the hatch: a white shutter (pink strips at MID), hinged along the window's top */
    b.group('hatch', function () {
      b.box(-3, 3, 5, 8, 2, 2, 'w');
      if (!lite) [-2, 2].forEach(function (i) { b.box(i, i, 5, 8, 3, 3, 'P'); });
    });
    /* the giant cone on the roof: a waffle cone under pink, mint and cream scoops (rounded at MID) and a cherry */
    if (lite) t.box(-1, 1, 13, 16, -3, -1, 'f').box(-2, 2, 17, 20, -4, 0, 'p');
    else {
      t.box(-1, 1, 13, 14, -3, -1, 'f');
      t.box(-2, 2, 15, 16, -4, 0, 'f');
      t.box(-2, 2, 17, 18, -4, 0, 'p');
      t.box(-1, 1, 19, 20, -3, -1, 'n');
      t.box(-1, 1, 21, 21, -3, -1, 'c');
      rim(t, -3, 3, 17, 18, -5, 1, 'P');
      rim(t, -2, 2, 19, 20, -4, 0, 'N');
      t.set(0, 22, -2, 'R');
    }
    /* the counter cone (G32): in the window behind the closed hatch; it slides out onto the counter */
    cn.group('cone', function () {
      if (lite) { cn.box(-1, 0, 0, 6, -1, 0, 'p'); return; }
      cn.box(-1, 0, 0, 2, -1, 0, 'f');
      cn.box(-1, 0, 3, 4, -1, 0, 'p');
      cn.box(-1, 0, 5, 6, -1, 0, 'n');
      cn.box(-1, 0, 7, 7, -1, 0, 'C');
    });
    return model('pier_icecream', ICE_PAL, [b, t, { g: cn, at: [ICE.cone[0], ICE.cone[1], ICE.cone[2]] }], {
      cull: [], pivots: { hatch: ICE.hatch, cone: ICE.cone }, anchors: { seat: ICE.seat } });
  }

  /* ================================================================
     DECKCHAIR (G16, even): a rear upright, a front leg and a skid (MID) each side, the top and front bars;
     the canvas steps down from the top bar and up to the front bar in five bands (colourway / white)
     ================================================================ */
  var SLING = [[-5, 9], [-5, 8], [-4, 7], [-4, 6], [-3, 5], [-2, 4], [-1, 3], [0, 2], [1, 2], [2, 3]];      /* [k, j] cells */
  function deckchair(st, lite) {
    var ways = tokensOf('pier_deckchair', CHAIR_WAYS), main = ways[variantOf(st, ways.length)];
    var o = grid(G16), b = grid(G16);
    [-6, 5].forEach(function (i) {
      if (lite) { o.box(i, i, 0, 10, -6, -6, 'f').box(i, i, 0, 3, 3, 3, 'f'); return; }
      o.box(i, i, 0, 10, -6, -6, 'f').box(i, i, 0, 3, 3, 3, 'f').box(i, i, 0, 0, -5, 2, 'F');
      o.box(i, i, 4, 4, 2, 3, 'F');                                            /* the armrest stub */
    });
    o.box(-5, 4, 10, 10, -6, -6, 'f');                                         /* the top bar */
    o.box(-5, 4, 3, 3, 3, 3, 'f');                                             /* the front bar */
    o.group('sling', function () {
      if (lite) { o.box(-5, 4, 6, 9, -5, -4, 'a').box(-5, 4, 2, 5, -3, 1, 'a'); return; }
      SLING.forEach(function (c, n) { o.box(-5, 4, c[1], c[1], c[0], c[0], (n >> 1) % 2 === 0 ? 'a' : 'w'); });
    });
    if (!lite) {
      /* the bucket (a white rim) and the spade stuck in the sand beside it */
      b.box(2, 4, 0, 2, 4, 5, 'y').box(2, 4, 3, 3, 4, 5, 'W');
      b.box(-5, -4, 0, 2, 5, 5, 'r').box(-5, -5, 3, 6, 5, 5, 'F').box(-6, -4, 7, 7, 5, 5, 'F');
    }
    return model('pier_deckchair', { f: 'PX Pier Plank', F: mid('PX Pier Plank Shade'), a: main, w: WHITE, W: mid(WHITE), y: mid('PX Sunny'), r: mid('PX Coral') },
      [o, b], { pivots: { sling: CHAIR.sling }, anchors: { seat: CHAIR.seat } });
  }

  /* ================================================================
     BALLOON STAND. The stand layers have no ground (they leave it). Seven plain rounded balloons on
     the even G16 grid: [x, z (the centre, in G16 voxels), j (the neck's row), colour]; each is a
     4 × 4 × 3 core under a 2 × 2 crown (MID); the two lowest have a neck where the strings go in.
     None touch another (a part-touch only splits faces)
     ================================================================ */
  var BALLOONS = [[-2, 1, 13, 'r'], [3, -1, 14, 'y'], [-4, -3, 17, 'n'], [4, 2, 18, 'p'], [-1, -4, 21, 'l'], [-4, 2, 20, 'b'], [4, -3, 22, 'w']];
  var BAL_PAL = { b: 'PX Pier Stripe Blue', w: WHITE, y: 'PX Sunny', r: 'PX Coral', n: 'PX Mint', l: 'PX Lilac', p: 'PX Candy Pink', t: 'PX Tree Rope',
    T: mid('PX Tree Rope'), B: mid('PX Pier Stripe Blue'), W: mid(WHITE), Y: mid('PX Sunny'), R: mid('PX Coral'), N: mid('PX Mint'), L: mid('PX Lilac'), P: mid('PX Candy Pink') };
  function balloons(st, lite) {
    var s = grid(G16, true), o = grid(G8, true), u = grid(G16);
    s.group('lift', function () {
      if (lite) { s.box(-3, 3, 0, 2, -3, 3, 'b'); return; }
      rounded(s, -3, 3, 0, 2, -3, 3, 'b');                                     /* the drum, a sunny cap in a white rim */
      s.box(-1, 1, 3, 3, -1, 1, 'y');
      rounded(s, -3, 3, 3, 3, -3, 3, function (i, j, k) { return Math.abs(i) <= 1 && Math.abs(k) <= 1 ? null : 'W'; });
      s.box(-1, 1, 1, 1, 4, 4, 'T').set(-1, 2, 4, 'T').set(1, 2, 4, 'T');      /* the rope grip */
    });
    o.group('lift', function () { o.box(0, 0, 2, 5, 0, 0, 'y'); });             /* the post */
    u.group('bunch', function () {
      u.box(-2, -2, 12, 12, 0, 0, 't');                                        /* two strings from the post into the bunch */
      if (!lite) u.box(2, 2, 12, 13, -1, -1, 'T').box(-1, 1, 12, 12, -1, 0, 'T');
      BALLOONS.forEach(function (q, n) {
        if (lite && n > 3) return;
        var x = q[0], z = q[1], j = q[2], C = q[3].toUpperCase(), low = n < 2 ? q[3] : C;
        u.box(x - 2, x + 1, j + 1, j + (lite ? 4 : 3), z - 2, z + 1, q[3]);
        if (!lite) u.box(x - 1, x, j + 4, j + 4, z - 1, z, C);
        if (n < (lite ? 1 : 2)) u.box(x - 1, x, j, j, z - 1, z, n ? C : low);
      });
    });
    return model('pier_balloons', BAL_PAL, [{ g: s, ground: false }, { g: o, ground: false }, u], {
      pivots: { lift: BAL.lift, bunch: BAL.bunch.concat('lift') }, anchors: { grip: BAL.grip.concat('lift') } });
  }

  /* ================================================================
     BUNTING LAMP POST: a foot, a banded post (as the rim's lamp posts), a crown of four bulbs
     (state 'lit', sunny caps at MID) standing on short arms round a taller coral finial (anchor
     'top', the gull's perch), and two short streamers of three pennants under the side arms on 'tails'
     ================================================================ */
  var PENNANTS = ['r', 'y', 'n'];
  function lamppost(st, lite) {
    var o = grid(G8, true), d = grid(G16), t = grid(G16);
    o.box(-1, 1, 0, 0, -1, 1, 'b');
    d.box(-1, 0, 0, 19, -1, 0, function (i, j) { return j > 7 && j < 14 ? 'w' : 'b'; });     /* the post (its foot hides its base) */
    if (lite) d.box(-4, 3, 19, 20, -1, 0, 'g');
    else {
      d.box(-2, 1, 19, 19, -1, 0, 'b').box(-1, 0, 19, 19, -2, 1, 'b');         /* the arms */
      [[2, -1], [-4, -1], [-1, 2], [-1, -4]].forEach(function (q) {           /* the bulbs at their ends, sunny caps */
        d.box(q[0], q[0] + 1, 19, 20, q[1], q[1] + 1, 'g').box(q[0], q[0] + 1, 21, 21, q[1], q[1] + 1, 'Y');
      });
    }
    d.box(-1, 0, lite ? 21 : 20, 23, -1, 0, 'r');                              /* the finial */
    t.group('tails', function () {
      [1, -1].forEach(function (s) {
        PENNANTS.forEach(function (ch, n) {
          if (lite && n) return;
          var x = s > 0 ? 3 : -5, j = 18 - 2 * n, c = n ? ch.toUpperCase() : ch;
          t.box(x, x + 1, j, j, -1, 0, c);
          if (!lite) t.box(s > 0 ? x + 1 : x, s > 0 ? x + 1 : x, j - 1, j - 1, -1, 0, ch.toUpperCase());
        });
      });
    });
    return model('pier_lamppost', {
      b: 'PX Pier Stripe Blue', w: WHITE, r: 'PX Coral', y: 'PX Sunny', n: 'PX Mint', R: mid('PX Coral'), Y: mid('PX Sunny'), N: mid('PX Mint'),
      g: { token: 'PX Bulb Warm', mode: 'glow', state: { key: 'lit', off: 'PX Lamp Off', on: 'PX Bulb Warm', initial: 0 } }
    }, [o, d, t], { pivots: { tails: LAMP.tails }, anchors: { top: [0, LAMP.top, 0] } });
  }

  /* ================================================================
     BEACH HUT (G16, even): a plank deck; walls in the colourway with white boards on the sides and
     white corners; two doors (a raised white board each at MID), hinged at the opening's sides; open
     at 100° they stay inside the cell. A stepped pitched roof whose
     front edge stands proud of a white gable with a round window; a white inside with a little
     deckchair, a bucket and a spade
     ================================================================ */
  function beachhut(st, lite) {
    var ways = tokensOf('pier_beachhut', HUT_WAYS), v = variantOf(st, ways.length), main = ways[v], other = ways[(v + 1) % ways.length];
    var o = grid(G16), d = grid(G16), f = grid(G16), n;
    o.box(-6, 5, 0, 0, -6, 4, 'f');                                            /* the deck */
    o.box(-6, 5, 1, 8, -6, 1, lite ? 'c' : function (i, j, k) {
      if ((i === -6 || i === 5) && (k === -6 || k === 1)) return 'w';          /* white corners */
      return (i === -6 || i === 5) && (k + 6) % 3 === 2 ? 'w' : 'c';           /* white boards along the sides */
    });
    o.box(-4, 3, 1, 7, -5, 1, null);                                           /* the inside */
    if (!lite) o.box(-4, 3, 1, 7, -5, -5, 'w');
    o.box(-4, 3, 8, 8, 1, 1, 'w');                                             /* the lintel */
    /* the roof: each row one in, one up; at MID its front edge stands one proud of the white gable */
    for (n = 0; n <= (lite ? 2 : 5); n++) {
      var i0 = -6 + (lite ? 2 * n : n), i1 = 5 - (lite ? 2 * n : n), j = 9 + n;
      o.box(i0, i1, j, j, -6, 1, function (i, jj, k) { return !lite && k === 1 && i > i0 && i < i1 ? 'w' : 'c'; });
      if (!lite) o.box(i0, i0, j, j, 2, 2, 'C').box(i1, i1, j, j, 2, 2, 'C');
    }
    if (!lite) o.box(-1, 0, 11, 12, 1, 1, 'k');                                /* the round window */
    d.group('doorL', function () { d.box(-4, -1, 1, 7, 1, 1, 'c'); if (!lite) d.box(-3, -3, 1, 7, 2, 2, 'W'); });
    d.group('doorR', function () { d.box(0, 3, 1, 7, 1, 1, 'c'); if (!lite) d.box(2, 2, 1, 7, 2, 2, 'W'); });
    if (!lite) {
      /* the little chair (two canvas bands on a plank block), the bucket and the spade */
      f.box(-4, -1, 1, 1, -4, -2, 'F').box(-4, -1, 2, 2, -3, -2, 'a').box(-4, -1, 3, 4, -4, -4, 'a').box(-4, -1, 5, 5, -5, -5, 'A');
      f.box(1, 2, 1, 2, -3, -2, 'y').set(1, 3, -2, 'W');
      f.box(3, 3, 1, 4, -4, -4, 'F').box(3, 3, 1, 2, -3, -3, 'e');
    }
    return model('pier_beachhut', {
      f: { token: 'PX Pier Plank', mode: 'plank' }, F: mid('PX Pier Plank Shade'), w: WHITE, W: mid(WHITE), c: main, C: mid(main),
      k: 'PX Castle Iron', a: mid(other), A: mid(WHITE), y: mid('PX Sunny'), e: mid('PX Coral')
    }, [o, d, f], { pivots: { doorL: HUT.doorL, doorR: HUT.doorR } });
  }

  var BUILD = { pier_candyfloss: candyfloss, pier_popcorn: popcorn, pier_icecream: icecream, pier_deckchair: deckchair,
    pier_balloons: balloons, pier_lamppost: lamppost, pier_beachhut: beachhut };
  /* voxels[id](st) → a fresh VoxModel (pure; st.variant picks the hut's and the chair's colourway);
     lod1[id](st) → the plain build the island draws for a copy at LOD1 (D106) */
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st || {}, false); };
    lod1[id] = function (st) { return BUILD[id](st || {}, true); };
  });

  /* ================================================================
     PURE ANIMATION HELPERS (exported for Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  /* the candyfloss cloud's size for the act's progress k: `steps` equal steps, each grown over the
     first half of its share of k and then held (three sizes, never a jump) */
  function cloudSize(k, steps) {
    steps = steps > 0 ? steps : FLOSS.steps;
    var v = clamp01(k) * steps, n = Math.floor(v);
    return n >= steps ? 1 : (n + smooth((v - n) * 2)) / steps;
  }
  /* the cloud on the stick at act time t: the old one is taken in the first FLOSS.away s, then it
     regrows in its steps */
  function flossSize(t, k) { var g = cloudSize(k, FLOSS.steps); return t < FLOSS.away ? Math.max(g, 1 - smooth(t / FLOSS.away)) : g; }
  /* a part popping out over u 0 → 1: up to a little past its size, then settling */
  function popSize(u) {
    u = clamp01(u);
    var M = mo();
    return u <= 0 ? 0 : u >= 1 ? 1 : M && M.ease && typeof M.ease.outBack === 'function' ? Math.max(0, M.ease.outBack(u)) : smooth(u);
  }
  /* the popcorn bag's size at act time t: the old bag is taken in the first POP.away s, the fresh
     one pops out from POP.at */
  function bagSize(t) { return t >= POP.at ? popSize((t - POP.at) / POP.grow) : t < POP.away ? 1 - smooth(t / POP.away) : 0; }
  /* the kiosk's counter cone for the hatch level lv: its way out 0..1 (it starts once the hatch has cleared it) */
  function coneOut(lv) { return smooth((clamp01(lv) - ICE.from) / (1 - ICE.from)); }
  /* how far the night has come on for the lamp: 0 by day, 1 from dusk (k 0.65) on */
  function nightOf(k) { return smooth(((+k || 0) - 0.35) / 0.3); }
  /* which way a toggle goes: an explicit name says; the CATALOG act goes away from what the copy
     shows — or, when the lit memory already differs from that (the host flipped it first), to it */
  function wantOn(name, spec, shown, lit) {
    if (spec.on.indexOf(name) >= 0) return true;
    if (spec.off.indexOf(name) >= 0) return false;
    return lit == null || !!lit === !!shown ? !shown : !!lit;
  }

  /* ================================================================
     HANDLE HELPERS + THE ACT BOOK (one live act per uid, on an SLMotion timeline)
     ================================================================ */
  var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], TINY = 0.001;
  function pose(a, name, rx, ry, rz, px, py, pz, sx, sy, sz) {
    var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
    if (!pv || typeof pv.set !== 'function') return;
    R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = px; P3[1] = py; P3[2] = pz; S3[0] = sx; S3[1] = sy; S3[2] = sz;
    pv.set(R3, P3, S3);
  }
  function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0, 1, 1, 1); }
  function sized(a, name, rx, s) { s = s > TINY ? s : TINY; pose(a, name, rx, 0, 0, 0, 0, 0, s, s, s); }
  function timeOf(a) { return a && typeof a.t === 'number' && isFinite(a.t) ? a.t : 0; }
  function phaseOf(a) { return a && typeof a.phase === 'number' && isFinite(a.phase) ? a.phase : 0; }
  function showOf(a) { return a && typeof a.show === 'number' && isFinite(a.show) ? clamp01(a.show) : 0; }
  /* the island's toggle memory for this copy: true / false, or null when the handle has none */
  function litOf(a) { return a && (typeof a.lit === 'boolean' || typeof a.lit === 'number') ? +a.lit >= 0.5 : null; }
  /* the pet's part of an act: perform(kind, uid) → lead seconds (0: no pet; the item plays alone) */
  function askPet(a, kind) {
    var p = a && a.pets;
    if (!kind || !p || typeof p.perform !== 'function') return 0;
    try { var r = p.perform(kind, a.uid); return typeof r === 'number' && r > 0 ? r : 0; } catch (e) { return 0; }
  }
  /* spec: {name, off?, family?, reduced, mute?, apply(a, out, t, rec), rest(a, rec)} →
     {name, dur, update(a, tAct) → alive, cancel()} | null (no SLMotion, or no such timeline).
     A restart inside CARRY_WINDOW of a cancel is an interruption: it carries the pose on. */
  var CARRY_WINDOW = 0.25;
  function makeBook() {
    var recs = new Map();
    function fire(rec, h, t) {
      while (rec.ci < rec.cues.length && rec.cues[rec.ci].t <= t + 1e-6) {
        var c = rec.cues[rec.ci++];
        try {
          if (c.sfx) { if (!rec.spec.mute && typeof h.sfx === 'function') h.sfx(c.sfx, c.vol, c.step); }
          else if (c.emit && typeof h.emit === 'function') h.emit(c.emit, 'top', c.n);
        } catch (e) { /* a cue never stops its act */ }
      }
    }
    function step(rec, h, tAct) {
      if (rec.done) return false;
      if (h) rec.h = h; else h = rec.h;
      var t = tAct >= 0 ? +tAct : 0, tt = t < rec.dur ? t : rec.dur;
      rec.lastT = timeOf(h);
      fire(rec, h, t);
      mo().sample(rec.name, tt, rec.out, rec.o);
      rec.spec.apply(h, rec.out, tt, rec);
      if (t < rec.dur) return true;
      rec.done = true;                         /* the end pose is the rest pose (a toggle's: its new state) */
      if (recs.get(rec.uid) === rec) recs.delete(rec.uid);
      return false;
    }
    function cancel(rec) {
      if (rec.done) return;
      rec.done = true; rec.cancelled = true;
      if (rec.h && rec.h.uid === rec.uid && rec.spec.rest) { try { rec.spec.rest(rec.h, rec); } catch (e) { /* the copy is gone */ } }
    }
    return {
      live: function (uid) { var r = recs.get(uid); return r && !r.done ? r : null; },
      forget: function (uid) { var r = recs.get(uid); if (r) { r.done = true; recs.delete(uid); } },
      start: function (a, spec) {
        var M = mo();
        if (!a || !M || !M.ACTS || !M.ACTS[spec.name]) return null;
        var prev = recs.get(a.uid), now = timeOf(a), from = null;
        var kin = prev && (prev.name === spec.name || (spec.family && prev.spec.family === spec.family));
        if (kin && (!prev.done || (prev.cancelled && Math.abs(now - prev.lastT) <= CARRY_WINDOW))) from = M.carry(prev.name, prev.out);
        if (prev && !prev.done) prev.done = true;                 /* never two on one uid */
        var o = { reduced: !!spec.reduced, from: from };
        if (spec.off) o.off = true;
        var rec = { uid: a.uid, name: spec.name, spec: spec, o: o, out: {}, cues: M.cues(spec.name, o), ci: 0, dur: M.durOf(spec.name, o),
                    done: false, cancelled: false, lastT: now, h: a };
        recs.set(a.uid, rec);
        return { name: spec.name, dur: rec.dur, update: function (h, tAct) { return step(rec, h, tAct); }, cancel: function () { cancel(rec); } };
      }
    };
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('pier-c', K → {id: {voxels, lod1, idle, act, show, lit?, animated, forget}})
     ================================================================ */
  function factory() {
    var lk = look(), LOOKS = (lk && lk.LOOK) || {}, book = makeBook(), MEM = new Map(), models = {}, _sw = {};
    function performOf(id) { var e = LOOKS[id]; return e && typeof e.perform === 'string' ? e.perform : PERFORM[id] || null; }
    /* per-copy memory {on: a toggle's state, lv: the level shown, hold, still}. A remount or a restyle
       hands the handle a new batch: the memory starts again; forget(uid) drops it with the copy */
    function memOf(a) {
      var c = a.batch || a.object || null, m = MEM.get(a.uid);
      if (m && c && m.copy && m.copy !== c) { book.forget(a.uid); m = null; }
      if (!m) { m = { copy: c, on: null, lv: -1, hold: -1, still: false }; MEM.set(a.uid, m); }
      else if (c && !m.copy) m.copy = c;
      return m;
    }
    function forget(uid) { MEM.delete(uid); book.forget(uid); }
    function noop() {}
    function still() { return false; }

    /* ---------- one-shot acts: the timeline plays, the pet is asked, the end pose is the rest pose ---------- */
    function oneShot(id, name, apply, atRest) {
      return function (a, actName) {
        if (!a || actName !== name) return null;
        memOf(a);
        var act = book.start(a, { name: name, reduced: !!a.reduced, apply: apply, rest: atRest });
        if (act) askPet(a, performOf(id));
        return act;
      };
    }
    function flossRest(a) { rest(a, 'drum'); rest(a, 'cloud'); }
    models.pier_candyfloss = {
      idle: still, show: noop,
      /* k turns the drum three quarters round (it has four marks: the turn ends as it began) and
         regrows the cloud; bob dips the cloud toward the pet for its nibble */
      act: oneShot('pier_candyfloss', 'floss', function (a, out, t) {
        var k = clamp01(out.k);
        pose(a, 'drum', 0, k >= 1 ? 0 : -FLOSS.turn * k, 0, 0, 0, 0, 1, 1, 1);
        sized(a, 'cloud', FLOSS.nod * (out.bob || 0), flossSize(t, k));
      }, flossRest)
    };
    function popRest(a) { rest(a, 'kernels'); rest(a, 'bag'); }
    models.pier_popcorn = {
      idle: still, show: noop,
      act: oneShot('pier_popcorn', 'popcorn', function (a, out, t) {
        pose(a, 'kernels', 0, 0, 0, 0, POP.hop * (out.bob || 0), 0, 1, 1, 1);
        sized(a, 'bag', 0, out.k >= 1 ? 1 : bagSize(t));
      }, popRest)
    };
    models.pier_deckchair = {
      idle: still, show: noop,
      /* the canvas stretches down from the top bar: its seat sags one voxel */
      act: oneShot('pier_deckchair', 'lounge', function (a, out) { pose(a, 'sling', 0, 0, 0, 0, 0, 0, 1, 1 + CHAIR.sag * (out.bob || 0), 1); },
        function (a) { rest(a, 'sling'); })
    };

    /* ---------- balloons: the bunch sways; the act lifts the stand and bobs it in the air ---------- */
    function bunchPose(a, lean, reduced) {
      var M = mo();
      if (M && !reduced) M.sway(timeOf(a), BAL.sway.deg, BAL.sway.period, phaseOf(a), false, _sw); else { _sw.x = 0; _sw.z = 0; }
      pose(a, 'bunch', _sw.x || 0, 0, (_sw.z || 0) + lean, 0, 0, 0, 1, 1, 1);
    }
    models.pier_balloons = {
      show: noop,
      idle: function (a) {
        if (!a) return false;
        var m = memOf(a);
        if (book.live(a.uid)) return true;                       /* the act owns the stand */
        if (a.reduced) {
          if (m.still) return false;
          m.still = true;
          rest(a, 'bunch');
          return true;
        }
        m.still = false;
        bunchPose(a, 0, false);
        return true;
      },
      act: oneShot('pier_balloons', 'liftoff', function (a, out, t, rec) {
        var up = out.bob || 0, sw = out.swing || 0;
        pose(a, 'lift', 0, 0, 0, 0, Math.max(0, BAL.rise * up + BAL.bob * sw * up), 0, 1, 1, 1);
        bunchPose(a, BAL.lean * sw, rec.o.reduced);
      }, function (a) { rest(a, 'lift'); bunchPose(a, 0, !!a.reduced); })
    };

    /* ---------- the remembered toggles ----------
       T {timeline(on) → {name, off}, level(out) → 0..1, pose(a, lv, t, rec), mute, hold}: the act
       plays the timeline one way or the other; lit(a, on) snaps to the island's memory */
    function toggle(id, T) {
      var spec = TOGGLES[id], kind = performOf(id);
      function snap(a, on) {
        var m = memOf(a);
        book.forget(a.uid);
        m.on = !!on; m.hold = -1;
        T.pose(a, on ? 1 : 0, -1, null);
      }
      return {
        idle: still, show: noop,
        act: function (a, name) {
          if (!a || (name !== spec.act && spec.on.indexOf(name) < 0 && spec.off.indexOf(name) < 0)) return null;
          var m = memOf(a), on = wantOn(name, spec, m.on === true, litOf(a)), tl = T.timeline(on);
          var act = book.start(a, { name: tl.name, off: tl.off, family: spec.act, reduced: !!a.reduced, mute: !!T.mute,
            apply: function (h, out, t, rec) { T.pose(h, clamp01(T.level(out)), t, rec); },
            rest: function (h) { T.pose(h, on ? 1 : 0, -1, null); } });
          if (!act) return null;
          m.on = on; m.hold = timeOf(a) + act.dur + (T.hold || 0);
          if (on) askPet(a, kind);
          return act;
        },
        lit: function (a, on) { if (a) snap(a, on); }
      };
    }
    function themed(name) { return function (on) { return { name: name, off: !on }; }; }
    function levelK(out) { return out.k || 0; }

    /* the beach hut: SLMotion 'open' / 'close' swing both doors (doorL −, doorR +) */
    models.pier_beachhut = toggle('pier_beachhut', {
      timeline: function (on) { return { name: on ? 'open' : 'close', off: false }; },
      level: function (out) { return (out.deg || 0) / HUT.deg; },
      pose: function (a, lv) {
        pose(a, 'doorL', 0, -HUT.deg * lv, 0, 0, 0, 0, 1, 1, 1);
        pose(a, 'doorR', 0, HUT.deg * lv, 0, 0, 0, 0, 1, 1, 1);
      }
    });
    /* the kiosk: the hatch flips up about its top edge, then the cone grows as it slides out */
    models.pier_icecream = toggle('pier_icecream', {
      timeline: themed('scoop'), level: levelK,
      pose: function (a, lv) {
        pose(a, 'hatch', -ICE.deg * lv, 0, 0, 0, 0, 0, 1, 1, 1);
        pose(a, 'cone', 0, 0, 0, 0, 0, ICE.out * coneOut(lv), 1, 1, 1);
      }
    });
    /* the lamp post: the bulbs take the level (or the night, whatever the memory), the tails flick
       once on a tap and sway at rest. No sound here: the host plays the lamp's tap */
    function lampLevel(a, m, lv) {
      if (m.lv === lv) return;
      m.lv = lv;
      if (typeof a.state === 'function') { try { a.state('lit', lv); } catch (e) { /* no such part on this copy */ } }
    }
    function tapLevel(a, m) {
      var lit = litOf(a);
      return (lit === null || timeOf(a) < m.hold ? m.on === true : lit) ? 1 : 0;
    }
    function tailsPose(a, extra, reduced) {
      var M = mo(), hz = M && typeof M.safeHz === 'function' ? M.safeHz(LAMP.sway.hz) : LAMP.sway.hz;
      pose(a, 'tails', (reduced ? 0 : LAMP.sway.deg * Math.sin(TAU * (hz * timeOf(a) + phaseOf(a)))) + extra, 0, 0, 0, 0, 0, 1, 1, 1);
    }
    var lamp = toggle('pier_lamppost', {
      timeline: themed('glow'), level: levelK, mute: true, hold: LAMP.hold,
      pose: function (a, lv, t, rec) {
        var m = memOf(a);
        lampLevel(a, m, Math.max(lv, nightOf(showOf(a))));
        if (rec && rec.dur > 0) tailsPose(a, LAMP.flick * Math.sin(Math.PI * clamp01(t / rec.dur)), rec.o.reduced);
      }
    });
    lamp.idle = function (a) {
      if (!a) return false;
      var m = memOf(a);
      if (book.live(a.uid)) return true;                         /* the act owns the bulbs and the tails */
      lampLevel(a, m, Math.max(tapLevel(a, m), nightOf(showOf(a))));
      if (a.reduced) {
        if (m.still) return false;
        m.still = true;
        rest(a, 'tails');
        return true;
      }
      m.still = false;
      tailsPose(a, 0, false);
      return true;
    };
    lamp.show = function (a) {
      if (!a || book.live(a.uid)) return;
      var m = memOf(a);
      lampLevel(a, m, Math.max(tapLevel(a, m), nightOf(showOf(a))));
    };
    models.pier_lamppost = lamp;

    var MOVING = { pier_balloons: 1, pier_lamppost: 1 };
    IDS.forEach(function (id) {
      var m = models[id];
      m.voxels = voxels[id]; m.lod1 = lod1[id]; m.forget = forget;
      m.animated = function () { return !!MOVING[id]; };
    });
    return models;
  }

  return {
    VERSION: VERSION, IDS: IDS, voxels: voxels, lod1: lod1, factory: factory, PERFORM: PERFORM, TOGGLES: TOGGLES,
    BALLOONS: BALLOONS, PENNANTS: PENNANTS, HUT_WAYS: HUT_WAYS, CHAIR_WAYS: CHAIR_WAYS,
    LAYOUT: { pier_candyfloss: FLOSS, pier_popcorn: POP, pier_icecream: ICE, pier_deckchair: CHAIR, pier_balloons: BAL, pier_lamppost: LAMP, pier_beachhut: HUT },
    /* pure helpers (Node-tested) */
    cloudSize: cloudSize, flossSize: flossSize, popSize: popSize, bagSize: bagSize, coneOut: coneOut, nightOf: nightOf, wantOn: wantOn, makeBook: makeBook
  };
}));
