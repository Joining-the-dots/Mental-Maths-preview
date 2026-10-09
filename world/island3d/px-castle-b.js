/* ================================================================
   My Island v3 — SLPxCastleB (W3b.4): the Castle Kingdom's gatehouse, bell tower, jousting lane,
   hedge maze and dragon fountain in Pixel Blocks. window.SLPxCastleB + SL3D.defineVox('castle-b',
   factory) in the browser, module.exports in Node. Every model is pure data (voxels(st) →
   VoxModel: no THREE, no DOM). Item space as the kit: base y = 0, pivot at the footprint centre,
   facing +z; everything below y 1.0 stays inside the footprint less one G8 inset (fp − 0.125).
     castle_gate    2×1  two round stone turrets (a dark base course, a sandstone cornice, flat
                         battlements; no spires) and, set back between them, a wall with a round
                         arch, a sandstone doorstep and a gold-sun shield pictogram; plank doors with
                         iron bands on 'doorL' / 'doorR' (hinged at their back corners, they swing in
                         and stay inside the arch); warm front windows (MID: flower boxes); a gold
                         fanfare horn resting in each turret's side hole on 'horns'; coral pennants on
                         'flag0' / 'flag1'. Act 'open' (a remembered toggle, lit = doors open; the
                         shared 0.6 s 'open' / 'close' timelines): the doors swing 100° in 0.4 s, the
                         horns telescope out to both sides (an x scale about the gate's middle) as a
                         short fanfare plays, the pennants rise and flick; the pet comes to the arch.
     castle_tower   1×1  a round stone tower (2.875 u) with sandstone steps winding once round the
                         outside (anchors s0 … s5, then 'top' on the flat battlemented roof, reached
                         through a gap in the merlons), a warm arched window (MID: a flower box) and a
                         gold bell in an arched niche under a little wooden roof on 'bell'; a coral
                         pennant on 'flag'. Act 'bell': the bell swings twice at 1 Hz with a note in
                         the air on each stroke, the pennant waves with it.
     castle_joust   3×1  a sandy lane with a low coral / white striped rail (MID: flowers along it);
                         a hobby horse (a white head with a long muzzle, a violet mane, tall ears, a
                         puffy pink pillow in its mouth) waits by its stand at 'start' on 'horse'; a
                         round padded sack dummy with a patch, stubby arms, a smiley face and a gold tie
                         on a post at the far end on 'dummy'. No lance, no armour, no opponent. Act
                         'joust': the horse gallops down the lane with the pet, nods its pillow into
                         the dummy (a ring of ✦), the dummy spins round once and wobbles to rest, the
                         horse hops home.
     castle_maze    2×2  low clipped hedges (0.5 u, leafy, lighter tops; MID: flowers on them) laid as a
                         square spiral on cobbled gravel: one way in at the front left, a dead end, a
                         gap to the middle; a grassy mound with a gold-tipped pole and a coral pennant
                         on 'flag'; a topiary ball on each corner. Anchors in, w0, w1, w2, mid: the
                         pet's ears always show over the hedges. Act 'maze': a green leaf puff pops at
                         each turn, the pennant waves once.
     castle_dragon  2×2  a round stone-rimmed pool (MID: lily pads, ripples) and, behind it, a chubby
                         sitting dragon in teal (a gold belly, gold spines, crest and horn nubs, big
                         round eyes, a closed smile, no teeth) whose tail curls round the pool's right
                         side; folded mint wings on 'wingL' / 'wingR'; the head on 'head' and the
                         stacked-water stream it blows from its nose on the helper pivot 'jet' (a child
                         of 'head'). Act 'spout': the head lifts 24°, the stream keeps level and grows
                         into a big arc to the front of the pool (drops, a splash), then the wings
                         spread once. Water only: nothing red or orange anywhere.
   GRAIN (D11): masses G8 (as the plan's look notes), doors, horns, bells, flags, faces, flowers and
   the water G16. No corner AO (as the landmarks): the per-voxel bevel carries the look and the
   quads stay merged. LOW (D89 / D106): trims, studs, glints, cheeks, flowers, pads and ripples are
   lod 'mid'; every id brings its own lod1 (its plain masses, halved) inside TRIS_CAPS_LOD1.
   ACTS run on SLMotion timelines by name: open / close (the gatehouse's own sounds: a creak, then a
   short fanfare; a creak to shut), bell, joust, maze and spout. One live act per uid (a re-tap
   supersedes); a one-shot's end pose is its rest pose; reduced motion is the end state at once with
   the same sounds and one sparkle (the dragon keeps its head up over the big arc, the gatehouse
   shows its new state). The pet's part is a.pets.perform(LOOK perform kind, uid); a closing gate
   asks for none. Rates: the bell 1 Hz, the gallop 1.8 Hz, the dummy's wobble 1.5 Hz, the wing beat
   1.5 Hz — all under MAX_FLASH_HZ; the only light is the steady glow of the windows. No word, no
   five-point star, no flame, no weapon; nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.lit a.batch · a.pivot(name).set(rotDeg[3], pos[3], scale[3])
   · a.emit(kind, localPos, n, opts) · a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxCastleB = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('castle-b', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxCastleB: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }

  var VERSION = 1;
  var IDS = ['castle_gate', 'castle_tower', 'castle_joust', 'castle_maze', 'castle_dragon'];
  var G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { castle_gate: 'open', castle_tower: 'bell', castle_joust: 'joust', castle_maze: 'maze', castle_dragon: 'spout' };
  var PERFORM = { castle_gate: 'stand:cheer', castle_tower: 'trail:hop', castle_joust: 'trail:run', castle_maze: 'trail:run', castle_dragon: 'stand:cheer' };
  /* pivots beyond the lookEntries lists: the dragon's water stream rides its head */
  var HELPERS = { castle_dragon: ['jet'] };
  /* the remembered toggle: the CATALOG act and the explicit names for each way */
  var TOGGLES = { castle_gate: { act: 'open', on: ['glowOn'], off: ['close', 'glowOff'] } };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var GT = {
    turret: 5, body: 14, wall: 11,                                           /* G8: turret centres at i ±5, bodies to j 14 (1.875 u); the arch wall to j 11 */
    doorL: [-0.25, 0, 0.125], doorR: [0.25, 0, 0.125], deg: 100,           /* hinges (the leaves' back corners): the doors swing in (doorL +, doorR −), inside the arch */
    horns: [0, 1.3125, 0], out: 0.45, lift: 0.0625,                         /* the side horns telescope out of the turrets (x scale) and lift */
    flag0: [-0.625, 2.1875, 0], flag1: [0.625, 2.1875, 0], rise: 0.0625, flick: 18,   /* the pennants rise up their poles and flick */
    top: [0, 1.5, 0], arch: [0, 0, 0], spot: [0, 0, 0.4375],
    cues: { open: [{ t: 0, sfx: 'creak' }, { t: 0.4, sfx: 'fanfare', vol: 0.4 }, { t: 0.4, emit: 'sparkle', n: 2 }],
            close: [{ t: 0, sfx: 'creak', step: 1 }] }
  };
  var TW = {
    start: 14, steps: 17, deck: 19,                                          /* the step ring from idx 14 (front left); 17 steps; the roof at j 19 */
    trail: [1, 4, 7, 10, 13, 16], reach: 0.46875,                           /* s0 … s5 sit on these steps, this far out */
    bell: [0, 2.0, 0.1875], swing: 22, flag: [0, 2.5, -0.125], wave: 12, top: [0, 2.5, 0.1875],
    notes: [1.0, 1.5],                                                       /* a note in the air on each of the dong's two strokes */
    blocks: [[-2, 4, 0], [2, 11, 1], [-1, 6, -2], [1, 15, -2], [-2, 12, -1], [2, 3, -1], [0, 18, 2], [-2, 17, 0]]
  };
  var JS = {
    lane: 0.125, z: 0.0625, start: -1.125, end: 0.1875, dummy: [1.0, 0.125, 0.0625],
    lean: -16, bob: 0.05, gallop: 1.8, lunge: 0.09, bop: [1.22, 1.46], home: [2.35, 2.95], hop: 0.12,
    spin: 360, wobble: 9, bonk: [0.8125, 0.75, 0.0625], spot: [-0.25, 0.125, 0.375], flowers: [-7, -3, 2, 6, 9]
  };
  var MZ = {
    in: [-0.625, 0.125, 0.875], w0: [-0.625, 0.125, -0.625], w1: [0.625, 0.125, -0.625], w2: [0.625, 0.125, 0.625],
    mid: [0, 0.375, 0.0625], flag: [0, 0.8125, -0.125], top: [0, 1.0, -0.125], wave: 24,
    leaves: { tokens: ['PX Castle Meadow', 'PX Castle Meadow 2', 'PX Leaf Lit'] },
    flowers: [[-7, -3], [-5, -7], [0, -7], [4, -7], [7, -2], [7, 3], [3, 7], [-1, 7], [-7, 3], [-3, 5], [3, 0], [-3, -2], [0, 3]]
  };
  var DG = {
    pool: [0, 0.25], rimR: 5.6, water: 4.6,                                   /* G8 pool centre (i, k) and radii */
    neck: [0, 1.125, -0.625], wingL: [-0.3125, 1.0, -0.75], wingR: [0.3125, 1.0, -0.75], jet: [0, 1.4375, 0.09375], reach: 0.34375, fall: 1.1875,
    lift: 24, flap: 64, stretch: 1.2, drop: 0.22,                           /* the act: head up 24°, the stream 2.2× wider and 1.22× taller; the wings spread 64° */
    pads: [[-0.4375, 0.5625], [-0.375, 0.0625]], rim: [0, 0.375, 0.8125], spot: [0.5, 0, 0.9375], top: [0, 2.0, -0.5625], land: [0, 0.3125, 0.4375], landBig: [0, 0.3125, 0.625]
  };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  /* the tower's step ring: the 16 G8 cells one voxel out from the round body, in turning order from the
     front (+z) toward +x; step n stands on ring cell (start + n) % 16, two voxels tall from j = n */
  var RING = null;
  function ring() {
    if (RING) return RING;
    var out = [];
    for (var k = -3; k <= 3; k++) for (var i = -3; i <= 3; i++) { var d = i * i + k * k; if (d > 5.76 && d <= 10.24) out.push([i, k]); }
    out.sort(function (a, b) { return ang(a) - ang(b); });
    function ang(c) { var t = Math.atan2(c[0], c[1]); return t < -1e-9 ? t + TAU : t; }
    return (RING = out);
  }
  function stepCell(n) { var r = ring(); return r[(TW.start + n) % r.length]; }
  /* the tower's trail point on step n (item metres): on its top, pushed out to TW.reach */
  function stepAt(n) {
    var c = stepCell(n), l = Math.hypot(c[0], c[1]);
    return [c[0] / l * TW.reach, (n + 2) * G8, c[1] / l * TW.reach];
  }
  /* the hobby horse at act time t for the joust timeline's petT: its offset from the stand and its lean */
  function horseAt(t, petT, out) {
    out = out || {};
    var go = clamp01(petT), back = smooth(JS.home[0], JS.home[1], t), run = JS.end - JS.start;
    var hop = t > JS.home[0] && t < JS.home[1] ? Math.abs(Math.sin(Math.PI * 2 * (t - JS.home[0]) / (JS.home[1] - JS.home[0]))) : 0;
    var bump = t > JS.bop[0] && t < JS.bop[1] ? Math.sin(Math.PI * (t - JS.bop[0]) / (JS.bop[1] - JS.bop[0])) : 0;
    var galloping = go > 0 && go < 1;
    out.x = run * go * (1 - back) + JS.lunge * bump;
    out.y = (galloping ? JS.bob * Math.abs(Math.sin(Math.PI * JS.gallop * t)) : 0) + JS.hop * hop * (1 - back * 0.5);
    out.lean = go > 0 && back < 1 ? JS.lean * Math.min(1, go * 6, (1 - back) * 1.2) * (1 - 0.6 * bump) - 12 * bump : 0;
    if (Math.abs(out.lean) < 1e-9) out.lean = 0;
    if (Math.abs(out.y) < 1e-9) out.y = 0;
    if (Math.abs(out.x) < 1e-9) out.x = 0;
    return out;
  }
  /* which way a toggle goes: an explicit name says; the CATALOG act goes away from what the copy shows
     — or, when the lit memory already differs from that (the host flipped it first), to it */
  function wantOn(name, spec, shown, lit) {
    if (spec.on.indexOf(name) >= 0) return true;
    if (spec.off.indexOf(name) >= 0) return false;
    return lit == null || !!lit === !!shown ? !shown : !!lit;
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox || 0, 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (empty grids are left out); o.pivots {name: [x, y, z,
     parent?]} and o.anchors {name: [x, y, z]} in item metres; o.cull, o.ao as the model format */
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
    Object.keys(o.anchors || {}).forEach(function (n) { m.anchors[n] = U(o.anchors[n]); });
    if (o.cull) m.cull = o.cull;
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('sSt', {…}) picks from it. The digits are the MID / HIGH detail
     twins (lod 'mid': tier LOW drops them, D89) */
  var MID = 'mid';
  var INK = {
    s: 'PX Castle Stone', S: 'PX Castle Stone 2', d: 'PX Castle Stone Shade', t: 'PX Castle Sandstone', v: 'PX Castle Banner',
    y: 'PX Castle Gold', p: 'PX Castle Pennant', e: 'PX Castle Teal', W: 'PX Castle Wood', w: { token: 'PX Castle Wood', mode: 'plank' },
    i: 'PX Castle Iron', c: 'PX Castle Cloth', k: 'PX Ink Eye', x: 'PX Glint', n: 'PX Mint', P: 'PX Candy Pink',
    m: { token: 'PX Castle Meadow', mode: 'leaf' }, M: { token: 'PX Castle Meadow 2', mode: 'leaf' }, T: { token: 'PX Tree Pine Light', mode: 'leaf' },
    g: { token: 'PX Castle Sandstone', mode: 'cobble' }, a: { token: 'PX Castle Water 1', mode: 'soft' }, b: { token: 'PX Castle Water 2', mode: 'soft' },
    L: { token: 'PX Castle Window', mode: 'glow' },
    1: { token: 'PX Castle Iron', lod: MID }, 2: { token: 'PX Castle Gold', lod: MID }, 3: { token: 'PX Candy Pink', lod: MID },
    4: { token: 'PX Glint', lod: MID }, 5: { token: 'PX Castle Sandstone', lod: MID }, 6: { token: 'PX Lilac', lod: MID },
    7: { token: 'PX Castle Cloth', lod: MID }, 8: { token: 'PX Castle Pennant', lod: MID }, 9: { token: 'PX Castle Meadow', mode: 'leaf', lod: MID }
  };
  function pal(chars) { var p = {}; chars.split('').forEach(function (c) { p[c] = INK[c]; }); return p; }
  /* the battlement pattern on a ring: one of every two eighths of the turn (as the keep's towers) */
  function merlon(di, dk) { return (Math.floor((Math.atan2(dk, di) / TAU + 1) * 8) & 1) === 1; }

  /* ---------------- castle_gate ---------------- */
  function gateVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), dr = grid(G16), hn = grid(G16), fl = grid(G16, 0.5, 0.5), j;
    function stone(a, jj) { return jj === 0 ? 'd' : 's'; }
    /* two round turrets: a dark base course, the body to 1.875 u, a sandstone cornice and flat battlements */
    [-1, 1].forEach(function (s) {
      var ci = s * GT.turret, c = [ci, 0];
      o.lathe([[2.4, 0, GT.body, stone]], { at: c });
      o.lathe([[3.2, GT.body + 1, GT.body + 1, function (ii, jj, kk) { return (ii - ci) * (ii - ci) + kk * kk > 5.76 ? 't' : 's'; }]], { at: c });
      o.lathe([[3.2, GT.body + 2, GT.body + 3, function (ii, jj, kk) {
        var di = ii - ci, d = di * di + kk * kk;
        return d > 5.76 && merlon(di, kk) ? 's' : null;
      }]], { at: c });
      /* a warm window in its front under a sandstone lintel; a hole in its outer side, where the horn rests */
      o.set(ci, 8, 2, null).set(ci, 8, 1, 'L').set(ci, 9, 2, 't');
      o.set(ci + 2 * s, 10, 0, null).set(ci + 2 * s, 11, 0, 't');
    });
    /* the wall, set back between the turrets, its round arch (5 wide, 0.875 u to the springing, 1.0 u
       at the crown) and a walk with three merlons front and back */
    o.box(-3, 3, 0, GT.wall, -1, 1, stone);
    for (j = 0; j <= 7; j++) o.box(j < 7 ? -2 : -1, j < 7 ? 2 : 1, j, j, -1, 1, null);
    [-2, 0, 2].forEach(function (x) { o.set(x, GT.wall + 1, 1, 's').set(x, GT.wall + 1, -1, 's'); });
    /* sandstone jambs and voussoirs round the opening, a doorstep in front; the gold-sun shield above */
    for (j = 0; j <= 6; j++) o.set(-3, j, 1, 't').set(3, j, 1, 't');
    o.set(-2, 7, 1, 't').set(2, 7, 1, 't').box(-1, 1, 8, 8, 1, 1, 't');
    o.box(-2, 2, 0, 0, 2, 2, 't');
    if (!lite) o.decal('+z', [-1, 9, 1], [3, 3], 'shieldSun');
    /* the doors (G16): a wooden frame in the opening, two plank leaves with iron bands and gold ring pulls */
    for (j = 0; j <= 15; j++) { var w = j < 14 ? 4 : 3; dr.set(-w - 1, j, 2, 'W').set(w, j, 2, 'W'); }
    dr.group('doorL', function () {
      dr.box(-4, -1, 0, 13, 2, 2, 'w').box(-3, -1, 14, 15, 2, 2, 'w');
      if (!lite) dr.box(-4, -1, 3, 3, 3, 3, '1').box(-4, -1, 10, 10, 3, 3, '1').set(-1, 6, 3, '2');
    });
    dr.group('doorR', function () {
      dr.box(0, 3, 0, 13, 2, 2, 'w').box(0, 2, 14, 15, 2, 2, 'w');
      if (!lite) dr.box(0, 3, 3, 3, 3, 3, '1').box(0, 3, 10, 10, 3, 3, '1').set(0, 6, 3, '2');
    });
    /* the fanfare horns (G16) on 'horns': a gold tube through each side window and a flared bell (a dark
       mouth) just outside it; opening, they telescope out sideways (an x scale about the gate's middle) */
    hn.group('horns', function () {
      [-1, 1].forEach(function (s) {
        var a0 = s > 0 ? 6 : -16, a1 = s > 0 ? 15 : -7, bell = s > 0 ? 15 : -16;
        hn.box(a0, a1, 20, 21, -1, 0, 'y');
        hn.box(bell, bell, 19, 22, -2, 1, function (i, jj, k) { return (jj === 19 || jj === 22) && (k === -2 || k === 1) ? null : 'y'; });
        if (!lite) hn.box(bell + s, bell + s, 19, 22, -2, 1, function (i, jj, k) { return (jj === 19 || jj === 22) && (k === -2 || k === 1) ? null : (jj === 20 || jj === 21) && (k === -1 || k === 0) ? '1' : '2'; });
      });
    });
    /* the pennant poles (wood, gold finials) and the coral pennants on them; MID / HIGH: a flower box
       under each front window */
    [-1, 1].forEach(function (s, n) {
      var x = s * 10;
      fl.box(x, x, 32, 39, 0, 0, 'W').set(x, 40, 0, 'y');
      if (!lite) fl.box(x - 1, x + 1, 15, 15, 6, 6, '5').set(x - 1, 16, 6, '3').set(x, 16, 6, '2').set(x + 1, 16, 6, '3');
      fl.group('flag' + n, function () {
        [4, 3, 2, 1].forEach(function (len, r) { fl.box(x + 1, x + len, 38 - r, 38 - r, 0, 0, 'p'); });
        if (!lite) fl.set(x + 1, 37, 0, '2');
      });
    });
    return model('castle_gate', pal('sdtyWwiLp1235'), [o, dr, hn, fl], {
      pivots: { doorL: GT.doorL, doorR: GT.doorR, horns: GT.horns, flag0: GT.flag0, flag1: GT.flag1 },
      anchors: { top: GT.top, arch: GT.arch, spot: GT.spot } });
  }

  /* ---------------- castle_tower ---------------- */
  function towerVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), b = grid(G16, 0.5, 0.5), f = grid(G16, 0.5, 0.5), n, anchors = { top: TW.top };
    /* the round body: a dark base course, stone to the roof */
    o.lathe([[2.4, 0, TW.deck - 1, function (i, j) { return j === 0 ? 'd' : 's'; }]]);
    /* a few blue-grey blocks in the stone (never where a step or the niche goes) */
    TW.blocks.forEach(function (q) { o.set(q[0], q[1], q[2], 'S'); });
    /* a warm arched window in the front, under a sandstone arch; MID / HIGH: a flower box under it */
    o.box(-1, 1, 9, 9, 2, 2, null).set(0, 10, 2, null).box(-1, 1, 9, 9, 1, 1, 'L').set(0, 10, 1, 'L');
    o.set(-1, 10, 2, 't').set(1, 10, 2, 't').set(0, 11, 2, 't');
    if (!lite) b.box(-2, 2, 17, 17, 5, 5, '5').set(-2, 18, 5, '3').set(0, 18, 5, '2').set(2, 18, 5, '3');
    /* the bell niche in the front: three wide, four deep, a round top under a sandstone arch */
    o.box(-1, 1, 13, 15, -1, 2, null).box(0, 0, 16, 16, -1, 2, null);
    o.set(-1, 16, 2, 't').set(1, 16, 2, 't').set(0, 17, 2, 't');
    /* the steps: sandstone blocks winding once round the outside, two voxels tall, one voxel up each */
    for (n = 0; n < TW.steps; n++) { var c = stepCell(n); o.box(c[0], c[0], n, n + 1, c[1], c[1], 't'); }
    TW.trail.forEach(function (sn, q) { anchors['s' + q] = stepAt(sn); });
    /* the roof: a sandstone corbel ring round a stone deck at 2.5 u (open where the steps arrive), merlons on it */
    var arrive = stepCell(TW.steps - 1), entry = stepCell(TW.steps);
    o.lathe([[3.2, TW.deck, TW.deck, function (i, j, k) {
      if (i === arrive[0] && k === arrive[1]) return null;
      return i * i + k * k > 5.76 ? 't' : 's';
    }]]);
    o.lathe([[3.2, TW.deck + 1, TW.deck + 2, function (i, j, k) {
      var d = i * i + k * k;
      if (d <= 5.76 || (i === arrive[0] && k === arrive[1]) || (i === entry[0] && k === entry[1])) return null;
      return merlon(i, k) ? 's' : null;
    }]]);
    /* the little wooden roof over the niche (G16, a gable seen from the front) */
    b.box(-2, 2, 34, 34, 4, 7, 'W').box(-1, 1, 35, 35, 4, 7, 'W').box(0, 0, 36, 36, 4, 6, 'W');
    /* the bell (G16) on 'bell': a hanger, the crown and shoulder, a wide mouth with a lip, a clapper */
    b.group('bell', function () {
      b.box(0, 0, 31, 31, 3, 3, 'W');
      b.box(-1, 1, 29, 30, 2, 4, 'y');
      b.box(-2, 2, 27, 28, 1, 5, function (i, j, k) { return Math.abs(i) === 2 && (k === 1 || k === 5) ? null : 'y'; });
      b.set(0, 26, 3, 'i');
      if (!lite) b.set(-1, 30, 5, '2').set(1, 29, 5, '4');
    });
    /* the pennant pole at the back of the roof, a gold finial, a coral pennant on 'flag' */
    f.group('flag', function () {
      f.box(0, 0, 40, 44, -2, -2, 'W').set(0, 45, -2, 'y');
      [4, 3, 2].forEach(function (len, r) { f.box(1, len, 44 - r, 44 - r, -2, -2, 'p'); });
      if (!lite) f.set(1, 43, -2, '2');
    });
    return model('castle_tower', pal('sSdtyWpiL2345'), [o, b, f], {
      pivots: { bell: TW.bell, flag: TW.flag }, anchors: anchors });
  }

  /* ---------------- castle_joust ---------------- */
  /* the hobby horse in its own frame (G16, odd: the stick on the pivot column), facing +x: a white head
     with a long muzzle, a violet mane down its neck, two tall ears, an eye each side, and a puffy pink
     pillow carried in its mouth */
  function hobbyHorse(h, lite) {
    h.box(0, 0, 0, 7, 0, 0, 'W');                                                  /* the stick */
    h.box(-1, 0, 8, 9, -1, 1, 'c');                                                /* the neck */
    h.box(-1, 2, 10, 11, -1, 1, 'c');                                              /* the head */
    h.box(1, 5, 8, 9, -1, 1, 'c');                                                 /* the long muzzle */
    h.box(-1, -1, 12, 13, -1, -1, 'c').box(-1, -1, 12, 13, 1, 1, 'c');           /* the ears */
    h.box(-2, -2, 7, 11, 0, 0, 'v').set(-1, 12, 0, 'v');                           /* the mane and its forelock */
    h.set(1, 11, -1, 'k').set(1, 11, 1, 'k');                                      /* the eyes */
    h.box(4, 6, 5, 7, -2, 2, function (i, j, k) { return Math.abs(k) === 2 && (j === 5 || j === 7) ? null : 'P'; });   /* the pillow in its mouth */
    if (!lite) {
      h.box(2, 2, 8, 11, -2, -2, '2').box(2, 2, 8, 11, 2, 2, '2');                 /* the bridle */
      h.set(6, 9, 0, '1');                                                          /* the nose */
      h.set(7, 7, 0, '7').set(7, 5, 0, '7');                                       /* the pillow's tufts */
    }
  }
  function joustVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), r = grid(G8, 0.5, 0.5), h = grid(G16, 0.5, 0.5), dm = grid(G16), i;
    /* the sandy lane, and the horse's little wooden stand at its start */
    o.box(-11, 11, 0, 0, -1, 2, 't');
    o.set(-9, 1, 0, 'W');
    /* the low striped rail along the back: wooden posts and a coral / white bar */
    for (i = -10; i <= 6; i += 4) r.box(i, i, 0, 2, -2, -2, 'W');
    r.box(-10, 6, 3, 3, -2, -2, function (a) { return lite ? 'p' : ((a + 10) >> 1) & 1 ? 'c' : 'p'; });
    h.group('horse', function () { hobbyHorse(h, lite); });
    if (!lite) {
      JS.flowers.forEach(function (q, n) { r.set(q, 0, 3, n & 1 ? '2' : '3'); });
      r.set(-10, 4, -2, '6').set(-9, 4, -2, '6');
    }
    /* the dummy (G16, even: centred on its pivot): a post, a round padded sack with a coral patch, stubby arms, a
       smiley face, a gold tie and a tuft on top */
    dm.group('dummy', function () {
      dm.box(-1, 0, 0, 4, -1, 0, 'W');
      dm.blob(-0.5, 9.5, -0.5, 3.4, 4.6, 3.4, 'c', 2.6);
      dm.box(-5, -4, 9, 10, -1, 0, 'c').box(3, 4, 9, 10, -1, 0, 'c');           /* the stubby arms */
      dm.box(-3, -2, 6, 7, 2, 2, 'p').box(1, 2, 12, 13, -4, -4, 'v');            /* the patches */
      dm.set(-2, 11, 3, 'k').set(1, 11, 3, 'k');                                   /* the eyes */
      dm.box(-1, 0, 8, 8, 3, 3, 'k').set(-2, 9, 3, 'k').set(1, 9, 3, 'k');         /* the smile */
      dm.box(-1, 0, 15, 15, -1, 0, 'y').box(-1, 0, 16, 17, -1, 0, 'c');          /* the gold tie and the tuft */
      if (!lite) dm.set(-3, 10, 3, '3').set(2, 10, 3, '3').set(-2, 12, 3, '4').set(1, 12, 3, '4');
    });
    return model('castle_joust', pal('tWpcvkyP123467'), [o, r, [h, [JS.start, JS.lane, JS.z]], [dm, [JS.dummy[0], JS.dummy[1], JS.dummy[2]]]], {
      pivots: { dummy: JS.dummy, horse: [JS.start, JS.lane, JS.z] },
      anchors: { top: [JS.dummy[0], 1.1875, JS.dummy[2]], start: [JS.start, JS.lane, JS.z], end: [JS.end, JS.lane, JS.z], spot: JS.spot } });
  }

  /* ---------------- castle_maze ---------------- */
  /* the hedge plan on the G8 cell (i, k), |i|, |k| ≤ 7: the outer ring (a way in at the front left), the
     inner ring (a gap at its front-right corner) and the wall that makes the front a dead end */
  function hedgeAt(i, k) {
    var r = Math.max(Math.abs(i), Math.abs(k));
    if (r === 7) return !(k === 7 && i >= -6 && i <= -4);
    if (r === 3) return !((i === 3 && k === 3) || (i === 2 && k === 3) || (i === 3 && k === 2));
    return i === -3 && k >= 4 && k <= 6;
  }
  function mazeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), b = grid(G16), p = grid(G16, 0.5, 0.5), f = grid(G16, 0.5, 0.5), i, k;
    o.box(-7, 7, 0, 0, -7, 7, 'g');                                                /* the cobbled gravel */
    for (k = -7; k <= 7; k++) for (i = -7; i <= 7; i++) if (hedgeAt(i, k)) o.box(i, i, 1, 4, k, k, function (a, j) { return j === 4 ? 'm' : 'M'; });
    /* the grassy mound in the middle, two flowers on it */
    o.box(-1, 1, 1, 1, -1, 1, 'm').box(0, 0, 2, 2, -1, 1, 'm').box(-1, 1, 2, 2, 0, 0, 'm');
    if (!lite) {
      p.set(-3, 6, 3, '8').set(3, 6, 2, '2');
      MZ.flowers.forEach(function (q, n) { p.set(q[0] * 2, 10, q[1] * 2, '378'[n % 3]); });
    }
    /* the topiary balls on the four corners (G16, even: four voxels round, on the corner hedges) */
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
      var i0 = q[0] > 0 ? 11 : -15, k0 = q[1] > 0 ? 11 : -15;
      b.box(i0 + 1, i0 + 2, 10, 13, k0 + 1, k0 + 2, 'T');
      b.box(i0, i0 + 3, 11, 12, k0, k0 + 3, function (a, j, c) { return (a === i0 || a === i0 + 3) && (c === k0 || c === k0 + 3) ? null : 'T'; });
    });
    /* the pole with its gold tip, the pennant on 'flag' */
    p.box(0, 0, 6, 14, -2, -2, 'W').set(0, 15, -2, 'y');
    f.group('flag', function () { [4, 3, 2].forEach(function (len, r) { f.box(1, len, 14 - r, 14 - r, -2, -2, 'p'); }); });
    return model('castle_maze', pal('gmMTWyp2378'), [o, b, p, f], {
      pivots: { flag: MZ.flag }, anchors: { top: MZ.top, in: MZ.in, w0: MZ.w0, w1: MZ.w1, w2: MZ.w2, mid: MZ.mid } });
  }

  /* ---------------- castle_dragon ---------------- */
  /* the tail's centre line round the pool's right side (item metres, x z), back to tip */
  var TAIL = [[0.25, -0.75], [0.5, -0.625], [0.6875, -0.4375], [0.8125, -0.1875], [0.8125, 0.0625], [0.75, 0.3125]];
  function dragonVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0.5), hd = grid(G8, 0.5, 0.5), fd = grid(G16, 0.5, 0), wg = grid(G16, 0.5, 0.5), jt = grid(G16, 0, 0.5);
    var pc = [DG.pool[0] / G8, DG.pool[1] / G8], n;
    /* the pool: a stone rim with a sandstone cap round two blues */
    o.lathe([[DG.rimR, 0, 2, function (a, jj) { return jj === 2 ? 't' : 's'; }]], { at: pc });
    /* (the lite build's rim is two voxels thick, so its 2× coarsening keeps a whole ring) */
    var wr = lite ? DG.water - 1 : DG.water;
    o.lathe([[wr, 0, 1, function (a, jj, kk) { return (a - pc[0]) * (a - pc[0]) + (kk - pc[1]) * (kk - pc[1]) < 6.5 ? 'b' : 'a'; }], [wr, 2, 2, null]], { at: pc });
    /* the body: a chubby pear sitting on the ground behind the pool, a gold belly, feet, little arms */
    o.blob(0, 4.2, -5, 3.1, 4.4, 2.5, function (a, jj, kk) { return kk >= -3 && Math.abs(a) <= 1 && jj >= 1 && jj <= 7 ? 'y' : 'e'; }, 2.4);
    o.box(-2, -1, 0, 1, -3, -2, 'e').box(1, 2, 0, 1, -3, -2, 'e');
    o.set(-2, 5, -2, 'e').set(2, 5, -2, 'e');
    /* the tail round the pool's right side, thinning to a gold tip, a gold ridge along it */
    for (n = 0; n < TAIL.length; n++) {
      var q = TAIL[n], ti = Math.round(q[0] / G8), tk = Math.round(q[1] / G8), h = n < 3 ? 1 : 0;
      o.box(ti - (n < 2 ? 1 : 0), ti, 0, h, tk - (n < 4 ? 1 : 0), tk, n === TAIL.length - 1 ? 'y' : 'e');
      if (!lite && n > 0 && n < TAIL.length - 1) fd.set(ti * 2, (h + 1) * 2, tk * 2, '2');
    }
    /* gold spines down the back */
    fd.box(0, 0, 11, 12, -14, -14, 'y').box(0, 0, 14, 15, -14, -14, 'y');
    /* the head on 'head': a big round head, a snout, horn nubs and ear frills, a gold crest */
    hd.group('head', function () {
      hd.blob(0, 12, -4.5, 2.7, 2.5, 2.5, 'e', 2.4);
      hd.box(-1, 1, 10, 11, -2, 0, 'e');
      hd.set(-1, 15, -5, 'y').set(1, 15, -5, 'y');
      hd.set(-3, 13, -5, 'e').set(3, 13, -5, 'e');
    });
    fd.group('head', function () {
      /* the eyes: big and round, white with an ink pupil looking down at the pool and a glint */
      [-1, 1].forEach(function (s) {
        var x0 = s > 0 ? 1 : -2;
        fd.box(x0, x0 + 1, 24, 26, -3, -3, function (a, jj) { return jj < 26 ? 'k' : 'c'; });
        if (!lite) fd.set(s > 0 ? x0 : x0 + 1, 25, -2, '4');
      });
      /* a closed smile turned up at both corners (no teeth); the water comes from its nose above it */
      fd.set(-2, 20, 1, 'i').set(2, 20, 1, 'i').set(-3, 21, 1, 'i').set(3, 21, 1, 'i');
      fd.box(0, 0, 28, 30, -11, -9, 'y');                                           /* the crest */
    });
    /* the folded wings (mint panes on teal bones) on their hinges */
    [['wingL', -1], ['wingR', 1]].forEach(function (w) {
      var x = w[1] * 5;
      wg.group(w[0], function () {
        wg.box(x, x, 15, 24, -13, -12, 'e');
        wg.box(x, x, 16, 22, -17, -14, function (a, jj, kk) { return jj - 16 > (kk + 17) * 2 ? null : 'n'; });
        wg.box(x, x, 23, 25, -14, -13, 'e');
      });
    });
    /* the water stream on 'jet' (a child of 'head'): out of the smiling mouth, falling into the pool */
    jt.group('jet', function () {
      for (n = 0; n <= 18; n++) {
        var u = n / 18, z = DG.jet[2] + DG.reach * u, y = DG.jet[1] - DG.fall * u * u;
        var zc = Math.round(z / G16), yc = Math.floor(y / G16);
        jt.box(-1, 0, yc - 1, yc, zc, zc, !lite && n % 5 === 2 ? '4' : 'a');
      }
    });
    /* two lily pads, one with a little white flower, away from the stream (MID / HIGH) */
    if (!lite) DG.pads.forEach(function (q, n) {
      var pi = Math.round(q[0] / G16), pk = Math.round(q[1] / G16);
      jt.box(pi - 1, pi + 1, 4, 4, pk - 1, pk + 1, function (a, jj, c) { return a === pi + 1 && c === pk + 1 ? null : '9'; });
      if (!n) jt.set(pi, 5, pk, '7');
    });
    /* the ripples where it lands (MID / HIGH) */
    if (!lite) for (n = 0; n < 6; n++) { var aa = n * TAU / 6, rr = 0.16 + 0.03 * (n & 1); jt.set(Math.floor(rr * Math.sin(aa) / G16), 4, Math.round((DG.land[2] + rr * Math.cos(aa)) / G16), '7'); }
    return model('castle_dragon', pal('steyknicab12479'), [o, hd, fd, wg, jt], {
      pivots: { head: DG.neck, wingL: DG.wingL, wingR: DG.wingR, jet: DG.jet.concat('head') },
      anchors: { top: DG.top, spot: DG.spot, rim: DG.rim } });
  }

  var BUILD = { castle_gate: gateVoxels, castle_tower: towerVoxels, castle_joust: joustVoxels, castle_maze: mazeVoxels, castle_dragon: dragonVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st || {}, null); };
    /* the 'vox-lod1' model: the plain masses (no trims, studs, glints or decals), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st || {}, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('castle-b', K → {id: {voxels, lod1, act, forget, show?, lit?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], HS = {}, NOOPT = {};
    function pose(a, name, rx, ry, rz, x, y, z, sx, sy, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z;
      S3[0] = sx == null ? 1 : sx; S3[1] = sy == null ? 1 : sy; S3[2] = sz == null ? 1 : sz;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function emit(a, kind, at, n, opts) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n, opts); } catch (e) { /* fx is optional */ } } }
    /* the pet's part (the crew owns it: a stand / trail perform at this item's anchors) */
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
    /* per-copy memory (what the gate shows): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, on: -1, shown: -1 }; memo.set(a.uid, m); }
      return m;
    }
    function litOf(a) { return a && (typeof a.lit === 'boolean' || typeof a.lit === 'number') ? +a.lit >= 0.5 : null; }
    /* what the copy shows: the template's rest (shut) until show() or lit() poses the memory or an act runs */
    function shownOf(a) { var m = mem(a); return m.on < 0 ? 0 : m.on; }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* an own cue list under reduced motion: its sounds at t = 0 and one sparkle (as SLMotion's) */
    function stillCues(list) {
      var out = list.filter(function (c) { return c.sfx; }).map(function (c) { var q = {}; for (var k in c) q[k] = c[k]; q.t = 0; return q; });
      out.push({ t: 0, emit: 'sparkle', n: 1 });
      return out;
    }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me), rest(a, reduced, me), at?(cue, out, me) → local point, opts?(cue) → fx opts, cues? (own list,
       or fn(off))}; opt {name (the timeline), off (a toggle played shut), quiet (the pet is not asked)} */
    function run(a, id, spec, opt) {
      opt = opt || NOOPT;
      var name = opt.name || ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, off = !!opt.off;
      var o = { reduced: reduced, from: prev && !reduced && prev.name === name ? M.carry(prev.name, prev.out) : null };
      var own = typeof spec.cues === 'function' ? spec.cues(off) : spec.cues;
      var dur = reduced ? 0 : M.durOf(name, o), cues = !own ? M.cues(name, o) : reduced ? stillCues(own) : own;
      var ci = 0, done = false, uid = a.uid, me = { name: name, id: id, off: off, dur: dur, out: {}, mark: 0 };
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
            if (c.emit) emit(h, c.emit, (c.emit !== 'sparkle' && spec.at && spec.at(c, me.out, me)) || 'top', c.n || 1, spec.opts ? spec.opts(c) : undefined);
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

    /* ---------- gatehouse: the doors swing in, the horns telescope out to both sides, the pennants rise and flick ---------- */
    function gatePose(a, lv) {
      var u = clamp01(lv), m = mem(a);
      m.shown = u;
      pose(a, 'doorL', 0, GT.deg * u, 0, 0, 0, 0);
      pose(a, 'doorR', 0, -GT.deg * u, 0, 0, 0, 0);
      var h = smooth(0.25, 1, u), f = smooth(0, 0.8, u), flick = GT.flick * Math.sin(Math.PI * u);
      pose(a, 'horns', 0, 0, 0, 0, GT.lift * h, 0, 1 + GT.out * h, 1, 1);
      pose(a, 'flag0', 0, Math.abs(flick) < 1e-9 ? 0 : flick, 0, 0, GT.rise * f, 0); pose(a, 'flag1', 0, Math.abs(flick) < 1e-9 ? 0 : flick, 0, 0, GT.rise * f, 0);
    }
    var gateSpec = {
      cues: function (off) { return off ? GT.cues.close : GT.cues.open; },
      apply: function (a, out) { gatePose(a, (out.deg || 0) / GT.deg); },
      rest: function (a, reduced, me) { gatePose(a, me.off ? 0 : 1); }
    };
    function gateAct(a, name) {
      var T = TOGGLES.castle_gate;
      if (!a || (name !== T.act && T.on.indexOf(name) < 0 && T.off.indexOf(name) < 0)) return null;
      var on = wantOn(name, T, shownOf(a) === 1, litOf(a));
      mem(a).on = on ? 1 : 0;
      return run(a, 'castle_gate', gateSpec, { name: on ? 'open' : 'close', off: !on, quiet: !on });
    }
    /* added, restyled or the Showtime mix: show the memory (written only when it moves) */
    function gateShow(a) {
      if (!a || live.get(a.uid)) return;
      var m = mem(a);
      if (m.on < 0) m.on = litOf(a) ? 1 : 0;
      if (m.shown !== m.on) gatePose(a, m.on);
    }
    function gateLit(a, on) {
      if (!a) return;
      live.delete(a.uid);
      mem(a).on = on ? 1 : 0;
      gatePose(a, on ? 1 : 0);
    }

    /* ---------- bell tower: the bell swings twice at 1 Hz, a note on each stroke, the pennant waves ---------- */
    var bellSpec = {
      apply: function (a, out, t, me) {
        var s = out.swing || 0;
        pose(a, 'bell', TW.swing * s, 0, 0, 0, 0, 0);
        pose(a, 'flag', 0, 0, -TW.wave * s, 0, 0, 0);
        while (me.mark < TW.notes.length && t >= TW.notes[me.mark]) { emit(a, 'note', TW.bell, 2); me.mark++; }
      },
      rest: function (a) { rest(a, 'bell'); rest(a, 'flag'); }
    };

    /* ---------- jousting lane: gallop, a pillow bop, the dummy spins once and wobbles, the horse hops home ---------- */
    var joustSpec = {
      apply: function (a, out, t, me) {
        horseAt(t, out.petT || 0, HS);
        pose(a, 'horse', 0, 0, HS.lean, HS.x, HS.y, 0);
        var k = clamp01(out.k || 0);
        pose(a, 'dummy', JS.wobble * (out.swing || 0) * 0.5, k >= 1 ? 0 : JS.spin * k, -JS.wobble * (out.swing || 0), 0, 0, 0);
        if (!me.mark && t >= JS.bop[0] + 0.08) { me.mark = 1; emit(a, 'sparkleRing', JS.bonk, 8); }
      },
      rest: function (a) { rest(a, 'horse'); rest(a, 'dummy'); }
    };

    /* ---------- hedge maze: a green leaf puff at each turn, the pennant waves once at the middle ---------- */
    var TURNS = [MZ.w0, MZ.w1, MZ.w2].map(function (p) { return [p[0], 0.625, p[2]]; });
    var mazeSpec = {
      apply: function (a, out) { pose(a, 'flag', 0, MZ.wave * (out.swing || 0), 0, 0, 0, 0); },
      rest: function (a) { rest(a, 'flag'); },
      at: function (c, out, me) { return c.emit === 'leaf' ? TURNS[Math.min(TURNS.length - 1, me.mark++)] : null; },
      opts: function (c) { return c.emit === 'leaf' ? MZ.leaves : undefined; }
    };

    /* ---------- dragon fountain: the head lifts, the stream arcs big into the pool, one wing flap ---------- */
    function dragonPose(a, up, flap) {
      pose(a, 'head', -DG.lift * up, 0, 0, 0, 0, 0);
      pose(a, 'jet', DG.lift * up, 0, 0, 0, 0, 0, 1, 1 + DG.drop * up, 1 + DG.stretch * up);
      pose(a, 'wingL', 0, DG.flap * flap, 0, 0, 0, 0);
      pose(a, 'wingR', 0, -DG.flap * flap, 0, 0, 0, 0);
    }
    var spoutSpec = {
      apply: function (a, out) { dragonPose(a, out.bob || 0, Math.max(0, out.swing || 0)); },
      /* reduced motion keeps the head up and the big arc (the pet is at the rim) */
      rest: function (a, reduced) { dragonPose(a, reduced ? 1 : 0, 0); },
      at: function () { return DG.landBig; }
    };

    var SPEC = { castle_tower: bellSpec, castle_joust: joustSpec, castle_maze: mazeSpec, castle_dragon: spoutSpec }, out = {};
    IDS.forEach(function (id) {
      var h = { voxels: voxels[id], lod1: lod1[id], forget: forget };
      if (id === 'castle_gate') { h.act = gateAct; h.show = gateShow; h.lit = gateLit; }
      else h.act = function (a, name) { return a && (!name || name === ACT[id]) ? run(a, id, SPEC[id]) : null; };
      out[id] = h;
    });
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, HELPERS: HELPERS, TOGGLES: TOGGLES, TAIL: TAIL, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { gate: GT, tower: TW, joust: JS, maze: MZ, dragon: DG },
    ring: ring, stepCell: stepCell, stepAt: stepAt, horseAt: horseAt, hedgeAt: hedgeAt, wantOn: wantOn
  };
}));
