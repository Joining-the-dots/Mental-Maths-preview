/* ================================================================
   My Island v3 — SLPxTreetopB (W3b.2): the Treetop Adventure Park's play pieces in Pixel Blocks.
   window.SLPxTreetopB + SL3D.defineVox('treetop-b', factory) in the browser, module.exports in Node.
   Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards
   and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the
   footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u.
     treetop_tunnel     2×1  a giant hollow log lying along the footprint (G16, 0.75 u round, its 0.5 u
                        bore open to the ground): bark ridged with pale lines, cut ends showing a plank
                        ring and (MID / HIGH) a pale lip, three moss patches and two spotted toadstools
                        on top, a round knothole in the middle of the front (the pet's eyes show
                        through it) and a stub sprig with three leaves on the helper pivot 'sprig' (it
                        shivers as two leaves pop out). Trail mouthA → knot → mouthB along the bore.
     treetop_beams      2×1  three peeled logs in a Z on mossy stumps: one rising 0.3 → 0.5 u along the
                        front, the middle one across on 'beam1' (one ±4° roll about its own length)
                        and one falling to 0.375 u along the back; a finish post in the front corner
                        whose sky-blue pennant waves on the helper pivot 'pennant' as the pet bows
                        under it. The trail runs straight along the log tops (start → b0 → b1 → b2),
                        end on the ground; a chip bed and two toadstools on MID / HIGH.
     treetop_seesaw     2×1  a grooved plank on 'plank' over a fat stump (pale cut top), rope lashed; a
                        blue pad (seatA) and a yellow pad (seatB), each with a rope loop handle;
                        bark-chip pads under both ends; the woodland squirrel (the SLPxCharacters
                        critter, ≤ 140 tris) waits on a low stump just past the far end on 'pal',
                        hops onto seatB, rides the rocking plank and hops home.
     treetop_tyreswing  1×1  two bark posts with A-feet and a cross-log 2.4 u up; the sky-blue tyre with
                        a white sidewall stripe (never black) hangs flat at 0.5 u on three ropes from
                        one swivel, all on 'tyre' (a pendulum toward us and back with a half-turn
                        twirl out and home, ≤ 1.6 s); a bark-chip pad underneath. Anchor seat (tyre).
     treetop_bridge     2×1  at each end two A-frames with sky-blue caps and the log the deck rests on;
                        six slats on p0 … p5 sag gently between them (a travelling ±6° roll wave);
                        hand ropes swoop 0.3125 u down between the A-frame tops with a rope net under
                        them (MID / HIGH). Anchors postL, postR on the end slats.
     treetop_net        2×2  four stumpy trunks with G4 crowns (two stepped pines, two round oaks with
                        autumn flecks); a net of doubled cords strung at 0.8 u inside a rope rim tied
                        to the trunks: its middle cross on 'net' and four hinged flaps on the helper
                        pivots flapN / flapE / flapS / flapW, so the net dips into a 0.25 u funnel
                        under the pet (the flaps turn and stretch to meet the middle exactly). Anchor
                        seat (net).
   LOW (D89, D106): detail voxels are tagged lod 'mid' and only ever ADD to a mass (chip pads, flecks,
   dots, tufts, the bridge's net, the log's lip), so LOW drops them without leaving holes; every id
   brings its own lod1 (its plain masses, halved) inside TRIS_CAPS_LOD1. The bridge has 7 parts (its
   six lookEntries slat pivots and the body), as the carousel and the flying chairs have more.
   ACTS run on SLMotion timelines by name: crawl, balance, seesaw, wobble (the plan's), and the two
   V4.54 names swing (the tyre: one pendulum period, cut to 1.6 s with its own sounds) and bounce
   (the net: the trampoline's three bounces after the pet's run-over lead, the dip scaled to
   0.25 u). One live act per uid (a re-tap supersedes it and eases out of the pose on show in
   0.3 s); the end pose is the rest pose; reduced motion is the end state at once with the same
   sounds and one sparkle (the seesaw rests tilted with the pet on the high seat and the squirrel
   on the low one). The pet's part is a.pets.perform(LOOK perform kind, uid). Rates: the sprig
   1.5 Hz, the beam 1.25 Hz, the plank 1 Hz, the tyre 0.625 Hz, the slats' wave 1.2 Hz — all under
   MAX_FLASH_HZ; nothing here lights up. No word, no five-point star, no flame; nothing here reads,
   awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.batch a.template · a.pivot(name).set(rotDeg[3], pos[3],
   scale[3]) · a.emit(kind, localPos, n) · a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxTreetopB = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('treetop-b', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxTreetopB: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }
  function chars() { return sibling('SLPxCharacters', './px-characters.js'); }

  var VERSION = 1;
  var IDS = ['treetop_tunnel', 'treetop_beams', 'treetop_seesaw', 'treetop_tyreswing', 'treetop_bridge', 'treetop_net'];
  var G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { treetop_tunnel: 'crawl', treetop_beams: 'balance', treetop_seesaw: 'seesaw', treetop_tyreswing: 'swing', treetop_bridge: 'wobble', treetop_net: 'bounce' };
  var PERFORM = { treetop_tunnel: 'trail:walk', treetop_beams: 'trail:wobble', treetop_seesaw: 'seat:sit', treetop_tyreswing: 'vine', treetop_bridge: 'wobble', treetop_net: 'bounce' };
  /* pivots beyond the lookEntries lists: small parts the acts move (the sprig, the pennant, the net's flaps) */
  var FLAPS = ['flapN', 'flapE', 'flapS', 'flapW'];
  var HELPERS = { treetop_tunnel: ['sprig'], treetop_beams: ['pennant'], treetop_net: FLAPS.slice() };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var TN = { mouthA: [-0.8125, 0, 0], knot: [0, 0, 0.0625], mouthB: [0.8125, 0, 0],
             sprig: [0.53125, 0.75, -0.09375], leaf: [0.5625, 0.9375, -0.25], deg: 14, hz: 1.5, at: 1.0 };
  /* the Z: log 0 along the front rising to beam1, beam1 across (level, the highest), log 2 along the
     back falling to the corner; the trail runs straight along the log tops (start → b0 → b1 → b2) */
  var BM = { start: [-0.75, 0.3125, 0.25], b0: [0, 0.5, 0.25], b1: [0, 0.5, -0.25], b2: [0.6875, 0.390625, -0.25], end: [0.5, 0, 0.28125],
             beam1: [0, 0.375, 0], deg: 4, pennant: [0.75, 0.75, 0.28125], wave: { at: 2.2, hz: 1.25, deg: 18 },
             stumps: [[-0.75, 0.25, 0, 4], [0, 0.25, 3, 6], [0, -0.25, 3, 6], [0.75, -0.25, 1, 4]] };      /* [x, z, top row, width] */
  var SS = { plank: [0, 0.5625, 0], deg: 12, seatA: [-0.5625, 0.6875, 0], seatB: [0.5625, 0.6875, 0], pal: [0.8125, 0.125, 0],
             on: [0.1, 0.45], off: [2.55, 2.95], hopH: 0.4, churr: 0.45 };
  var TS = { swivel: [0, 2.125, 0], seat: [0, 0.625, 0], amp: 25, twirl: 180, cut: 1.6, settle: 1.2,
             cues: [{ t: 0.05, sfx: 'whoosh', vol: 0.35 }, { t: 0.85, sfx: 'whoosh', vol: 0.35 }, { t: 1.45, sfx: 'voice', pet: true }] };
  var BR = { x: [-0.46875, -0.28125, -0.09375, 0.09375, 0.28125, 0.46875], top: [0.5, 0.5, 0.4375, 0.4375, 0.5, 0.5], hand: 16, sag: 5,
             postL: [-0.5, 0.5, 0], postR: [0.5, 0.5, 0] };
  var NT = { y: 0.78125, seat: [0, 0.8125, 0], hinge: 0.5, inner: 0.1875, mid: 2, dip: 0.25 };
  NT.span = NT.hinge - NT.inner;                                           /* each flap's hinge → inner edge */
  NT.tilt = Math.atan(NT.dip / NT.span) / DEG;                             /* the flap turn at the full dip */

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  /* the sprig's sway (degrees) at act time t: one damped 1.5 Hz shiver from TN.at */
  function sprigDeg(t) { var s = t - TN.at, len = 1 / TN.hz; return s <= 0 || s >= len ? 0 : TN.deg * Math.sin(TAU * TN.hz * s) * (1 - s / len); }
  /* the pennant's wave (degrees about the post) at act time t: one damped cycle as the pet bows */
  function waveDeg(t) { var w = BM.wave, s = t - w.at, len = 1 / w.hz; return s <= 0 || s >= len ? 0 : w.deg * Math.sin(TAU * w.hz * s) * (1 - s / len); }
  /* a point on the seesaw plank turned by deg about its fulcrum (rest point p) → out */
  function onPlank(p, deg, out) {
    out = out || [0, 0, 0];
    var c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), dx = p[0] - SS.plank[0], dy = p[1] - SS.plank[1];
    out[0] = SS.plank[0] + dx * c - dy * s; out[1] = SS.plank[1] + dx * s + dy * c; out[2] = p[2];
    return out;
  }
  /* the squirrel's base (item metres) at seesaw time t for plank angle deg (and whether it rides) */
  function palAt(t, deg, out) {
    out = out || [0, 0, 0];
    var seat = onPlank(SS.seatB, deg, []), u, from, to;
    if (t <= SS.on[0] || t >= SS.off[1]) { out[0] = SS.pal[0]; out[1] = SS.pal[1]; out[2] = SS.pal[2]; return out; }
    if (t >= SS.on[1] && t <= SS.off[0]) { out[0] = seat[0]; out[1] = seat[1]; out[2] = seat[2]; return out; }
    if (t < SS.on[1]) { u = (t - SS.on[0]) / (SS.on[1] - SS.on[0]); from = SS.pal; to = seat; } else { u = (t - SS.off[0]) / (SS.off[1] - SS.off[0]); from = seat; to = SS.pal; }
    u = clamp01(u);
    for (var n = 0; n < 3; n++) out[n] = from[n] + (to[n] - from[n]) * u;
    out[1] += 4 * SS.hopH * u * (1 - u);
    return out;
  }
  /* the tyre's swing (degrees, + = toward us) from SLMotion's pendulum: ±TS.amp, eased to rest by TS.cut */
  function tyreDeg(deg, t, amp) { return (deg || 0) * TS.amp / (amp || 38) * (1 - smooth(TS.settle, TS.cut, t)); }
  /* its twirl (degrees about the ropes): a half-turn out and home again inside the cut */
  function twirlDeg(t) { var u = clamp01(t / TS.cut); return TS.twirl * (1 - Math.cos(TAU * u)) / 2; }
  /* the net's dip (u, ≥ 0) from the trampoline's matDip (−0.12 at a contact) */
  function netDip(matDip, dip0) { var d = -(matDip || 0) * NT.dip / (dip0 || 0.12); return d > 0 ? Math.min(NT.dip, d) : 0; }
  /* one flap's pose for a dip d: the turn about its hinge and the stretch that keeps its inner edge
     on the dropped middle → {deg, stretch} */
  function flapPose(d) {
    var a = Math.atan(clamp01(d / NT.dip) * NT.dip / NT.span);
    return { deg: a / DEG, stretch: 1 / Math.cos(a) };
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox || 0, 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at] | {vox, at}] (empty grids are left out); o.pivots
     {name: [x, y, z]} and o.anchors {name: [x, y, z, pivot?]} in item metres; o.cull as the format */
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
    if (o.cull) m.cull = o.cull;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('kKp', {…}) picks from it. The digits are the MID / HIGH
     detail twins (lod 'mid': tier LOW drops them, D89) */
  var LEAF = 'leaf', MID = 'mid';
  var INK = {
    k: 'PX Tree Bark', K: 'PX Tree Bark Trail', p: 'PX Tree Plank', D: { token: 'PX Tree Plank', mode: 'plank' },
    r: 'PX Tree Rope', n: 'PX Tree Net', m: { token: 'PX Tree Moss', mode: LEAF }, t: 'PX Tree Toadstool', w: 'PX Cream', W: 'Cloud White',
    f: 'PX Tree Flag', y: 'PX Sunny', a: 'PX Tree Autumn', R: 'PX Squirrel Rust', E: 'PX Ink Eye', T: 'PX Trunk',
    g: { token: 'PX Tree Pine', mode: LEAF }, G: { token: 'PX Tree Pine Mid', mode: LEAF }, L: { token: 'PX Tree Pine Light', mode: LEAF },
    o: { token: 'PX Tree Oak', mode: LEAF }, O: { token: 'PX Tree Oak Light', mode: LEAF },
    1: { token: 'PX Tree Bark Trail 2', lod: MID }, 2: { token: 'PX Tree Moss', mode: LEAF, lod: MID }, 3: { token: 'PX Tree Oak Light', mode: LEAF, lod: MID },
    4: { token: 'PX Tree Autumn', mode: LEAF, lod: MID }, 5: { token: 'PX Cream', lod: MID }, 6: { token: 'PX Tree Net', lod: MID },
    7: { token: 'PX Tree Rope', lod: MID }, 8: { token: 'PX Tree Toadstool', lod: MID }, 9: { token: 'PX Tree Bark Trail', lod: MID }
  };
  function pal(chars) {
    var p = {};
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    return p;
  }
  /* a set-only fill (fn(i, j, k) → char | null; null leaves the cell as it is) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = fn(i, j, k); if (c) g.set(i, j, k, c); }
  }
  /* a round pad of bark chips on the ground (MID / HIGH only): G16 rows in two tones round [ci, ck] */
  function pad(g, ci, ck, r) {
    fill(g, ci - r, ci + r, 0, 0, ck - r, ck + r, function (i, j, k) { return (i - ci) * (i - ci) + (k - ck) * (k - ck) <= r * r + r ? (k & 1 ? '1' : '9') : null; });
  }

  /* ---------------- treetop_tunnel ---------------- */
  /* the log's section on G16 (origin 0: cell K spans z K/16 … (K+1)/16): a 0.75 u round log settled
     into the ground, its bore (0.375 u at the ground, 0.5 u at the middle) open to it */
  function logOuter(K, J) { var a = (K + 0.5) / 6, b = (J + 0.5 - 6) / 6; return J >= 0 && (J === 0 ? Math.abs(K + 0.5) < 4 : a * a + b * b <= 1.04); }
  function logBore(K, J) { var a = (K + 0.5) / 4, b = (J + 0.5 - 5.5) / 4.5; return J >= 0 && (J <= 1 ? Math.abs(K + 0.5) < 3 : a * a + b * b <= 1); }
  function tunnelVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G16), f = grid(G16), sp = grid(G16), i;
    /* the shell (x −0.875 … 0.875): bark ridged with pale lines; the cut ends show a plank ring and
       (MID / HIGH) a pale lip just inside the bore */
    fill(o, -14, 13, 0, 11, -6, 5, function (x, y, z) {
      var end = x === -14 || x === 13;
      if (!logOuter(z, y)) return null;
      if (logBore(z, y)) return end && !lite && y > 0 && [[z + 1, y], [z - 1, y], [z, y + 1]].some(function (q) { return !logBore(q[0], q[1]); }) ? '6' : null;
      return end ? 'p' : !lite && (y === 3 || y === 8) ? 'K' : 'k';
    });
    /* the knothole: a round window in the middle of the front (the pet's eyes show through it) */
    fill(o, -2, 1, 4, 7, 2, 5, function (x, y, z) {
      if ((x === -2 || x === 1) && (y === 4 || y === 7)) return null;
      o.clear(x, y, z);
      return null;
    });
    /* on top: three moss patches along the crown (and tufts on MID / HIGH); two spotted toadstools */
    [[-12, -6], [-4, 2], [5, 11]].forEach(function (q) {
      o.box(q[0], q[1], 12, 12, -1, 0, 'm');
      if (!lite) for (i = q[0] + 1; i < q[1]; i += 3) o.set(i, 12, i & 1 ? -2 : 1, '2');
    });
    [[-7, -1], [4, 0]].forEach(function (q, n) {
      var I = q[0], K = q[1];
      f.box(I, I, 12, 13, K, K, 'w');
      if (n === 0) { f.box(I - 1, I + 1, 14, 14, K - 1, K + 1, 't'); if (!lite) f.set(I - 1, 15, K + 1, '5').set(I + 1, 15, K - 1, '5').set(I, 15, K, '5'); }
      else { f.box(I - 1, I + 1, 14, 14, K, K, 't').box(I, I, 14, 14, K - 1, K + 1, 't'); if (!lite) f.set(I, 15, K, '5'); }
    });
    /* the sprig: a stub branch leaning back, three oak-light leaves */
    sp.group('sprig', function () {
      sp.box(8, 8, 12, 13, -2, -2, 'k').set(9, 14, -3, 'k');
      sp.box(9, 10, 15, 15, -5, -4, 'O').box(7, 8, 14, 14, -5, -4, 'O').box(10, 11, 14, 14, -3, -2, 'O');
      if (!lite) sp.set(10, 15, -3, '3').set(8, 15, -5, '3');
    });
    return model('treetop_tunnel', pal('kKpmtwO2356'), [o, f, sp],
      { pivots: { sprig: TN.sprig }, anchors: { mouthA: TN.mouthA, knot: TN.knot, mouthB: TN.mouthB } });
  }

  /* ---------------- treetop_beams ---------------- */
  /* a peeled log (G16, a 4 × 4 section with its top edges rounded off) from column a to b along x (or
     z when alongZ) at cross position c0 … c0 + 3; its top row follows top(s) (item metres, rounded to
     the grid); pale cut ends, a worn pale top */
  function log(g, a, b, c0, top, alongZ) {
    for (var s = a; s <= b; s++) {
      var j0 = Math.round(top((s + 0.5) * G16) / G16) - 4;
      for (var dj = 0; dj < 4; dj++) for (var dc = 0; dc < 4; dc++) {
        if ((dc === 0 || dc === 3) && dj === 3) continue;
        var ch = s === a || s === b ? 'p' : dj === 3 ? 'K' : 'k';
        if (alongZ) g.set(c0 + dc, j0 + dj, s, ch); else g.set(s, j0 + dj, c0 + dc, ch);
      }
    }
  }
  /* a round stump (G16, w × 4, corners off) round [x, z] up to row j1; a moss cap where nothing rests */
  function stump(g, q) {
    var w = q[3], i0 = Math.round(q[0] / G16) - w / 2, k0 = Math.round(q[1] / G16) - 2;
    fill(g, i0, i0 + w - 1, 0, q[2], k0, k0 + 3, function (i, j, k) {
      if ((i === i0 || i === i0 + w - 1) && (k === k0 || k === k0 + 3)) return null;
      return j === q[2] && !g.has(i, j + 1, k) ? 'm' : 'k';
    });
  }
  /* the log tops along the trail: start → b0 (log 0), b1 → b2 (log 2), by x */
  function beamTop(p, q) { return function (x) { return p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]); }; }
  function beamsVoxels(st, opt) {
    var lite = !!(opt && opt.lite), lg = grid(G16), b1 = grid(G16), pn = grid(G16), f = grid(G16);
    /* log 0 rising along the front, beam1 across (the highest), log 2 falling along the back */
    log(lg, -14, -3, 2, beamTop(BM.start, BM.b0));
    b1.group('beam1', function () { log(b1, -6, 5, -2, function () { return BM.b0[1]; }, true); });
    log(lg, 2, 13, -6, beamTop(BM.b1, BM.b2));
    /* the mossy stumps under the ends and the two joints */
    BM.stumps.forEach(function (s) { stump(lg, s); });
    /* the finish post at the front corner, and its pennant streaming in over the pet's bow */
    lg.box(12, 13, 0, 13, 4, 5, 'k').box(12, 13, 14, 14, 4, 5, 'm');
    pn.group('pennant', function () {
      pn.box(11, 11, 10, 13, 4, 4, lite ? 'f' : 'W').box(10, 10, 10, 12, 4, 4, 'f').box(9, 9, 11, 12, 4, 4, 'f').set(8, 11, 4, 'f');
    });
    /* MID / HIGH: a bed of bark chips under the Z and two little toadstools in the empty back corner */
    if (!lite) {
      f.box(-12, -8, 0, 0, 0, 1, '1').box(-7, -4, 0, 0, -2, 0, '9').box(3, 7, 0, 0, -2, -1, '1').box(8, 10, 0, 0, 0, 1, '9');
      f.box(-11, -11, 0, 1, -5, -5, '5').box(-12, -10, 2, 2, -6, -4, '8').set(-11, 3, -5, '8').set(-8, 0, -5, '5').box(-9, -7, 1, 1, -5, -5, '8').set(-8, 1, -6, '8').set(-8, 1, -4, '8');
    }
    return model('treetop_beams', pal('kKpmfW1589'), [lg, b1, pn, f],
      { pivots: { beam1: BM.beam1, pennant: BM.pennant }, anchors: { start: BM.start, b0: BM.b0, b1: BM.b1, b2: BM.b2, end: BM.end } });
  }

  /* ---------------- treetop_seesaw ---------------- */
  /* the squirrel (the SLPxCharacters critter at GC, its chars mapped into this palette), every voxel
     on `pivot`, standing at `at` — or a little local stand-in of the same shape */
  var PAL_MAP = { s: 'a', r: 'R', c: 'w', e: 'E', a: 'T', G: 'W' };
  function localSquirrel() {
    var g = VX().grid({ grid: 0.05 });
    g.box(-1, 1, 0, 3, -1, 1, 's').box(-1, 1, 0, 2, 1, 1, 'c').box(-1, 1, 4, 6, -1, 1, 's').box(-1, 1, 4, 4, 1, 1, 'c').set(1, 5, 1, 'e').set(-1, 5, 1, 'e');
    g.set(1, 7, 0, 's').set(-1, 7, 0, 's').box(-1, 1, 0, 8, -3, -2, 'r').box(-1, 1, 7, 8, -4, -4, 'c');
    return g.model({ id: 'squirrel', palette: {} });
  }
  function squirrelLayers(pivot, at) {
    var C = chars(), m = C && typeof C.critterVoxels === 'function' ? C.critterVoxels('squirrel', {}) : null;
    if (!m) m = localSquirrel();
    return m.layers.map(function (ly) {
      var s = ly.vox, cc = new Uint8Array(s.c.length), pp = new Uint8Array(s.c.length);
      for (var n = 0; n < cc.length; n++) if (s.c[n]) { cc[n] = (PAL_MAP[String.fromCharCode(s.c[n])] || 'a').charCodeAt(0); pp[n] = 1; }
      var d = ly.at || [0, 0, 0];
      return { vox: { grid: s.grid.slice(), origin: s.origin.slice(), min: s.min.slice(), dims: s.dims.slice(), c: cc, p: pp, names: [null, pivot] },
               at: [at[0] + d[0], at[1] + d[1], at[2] + d[2]] };
    });
  }
  function seesawVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), pl = grid(G16, 0.5, 0.5), dc = grid(G16, 0.5, 0.5);
    /* the fat stump: bark sides, a pale cut top; the squirrel's low stump past the far end */
    fill(o, -2, 1, 0, 3, -2, 1, function (i, j, k) { return (i === -2 || i === 1) && (k === -2 || k === 1) ? null : j === 3 ? 'p' : 'k'; });
    o.box(6, 6, 0, 0, -1, 0, 'p');
    /* the plank (grooved), its rope lashing, the two round pads and their loop handles, all on 'plank' */
    o.group('plank', function () { o.box(-6, 5, 4, 4, -1, 0, 'D'); });
    pl.group('plank', function () {
      pl.box(-1, 1, 10, 10, -2, 2, 'r').box(-1, 1, 8, 9, -3, -3, 'r').box(-1, 1, 8, 9, 3, 3, 'r');
      [[-9, 'f'], [9, 'y']].forEach(function (q) {
        fill(pl, q[0] - 2, q[0] + 2, 10, 10, -2, 2, function (i, j, k) { return Math.abs(i - q[0]) === 2 && Math.abs(k) === 2 ? null : q[1]; });
        var h = q[0] < 0 ? q[0] + 4 : q[0] - 4;
        pl.box(h, h, 10, 12, -1, -1, 'r').box(h, h, 10, 12, 1, 1, 'r').box(h, h, 13, 13, -1, 1, 'r');
      });
    });
    /* bark-chip landing pads under both ends (MID / HIGH) */
    if (!lite) { pad(dc, -10, 0, 3); pad(dc, 9, 0, 2); }
    return model('treetop_seesaw', pal('kpDrfyaRwET19'), [o, pl, dc].concat(squirrelLayers('pal', SS.pal)),
      { pivots: { plank: SS.plank, pal: SS.pal }, anchors: { seatA: SS.seatA.concat('plank'), seatB: SS.seatB.concat('plank') } });
  }

  /* ---------------- treetop_tyreswing ---------------- */
  function tyreswingVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0, 0.5), s = grid(G16, 0.5, 0.5), ty = grid(G16, 0.5, 0.5), f = grid(G16, 0.5, 0.5), j;
    /* two bark posts with A-feet, a cross-log with pale cut ends */
    [-3, 2].forEach(function (i) {
      o.box(i, i, 0, 17, 0, 0, function (a, y) { return !lite && y % 6 === 5 ? 'K' : 'k'; });
      [1, -1].forEach(function (d) { o.line([i, 3, 0], [i, 0, 2 * d], 'k'); });
    });
    o.box(-4, 3, 18, 18, 0, 0, function (i) { return i === -4 || i === 3 ? 'p' : 'k'; });
    s.box(-1, 1, 35, 35, -1, 1, 'K').set(0, 34, 0, 'K');                                  /* the swivel under it */
    /* on 'tyre': three ropes from the swivel, the tyre hanging flat (blue, a white sidewall stripe) */
    ty.group('tyre', function () {
      [[0, 3], [-2, -2], [2, -2]].forEach(function (q) { ty.line([0, 33, 0], [q[0], 10, q[1]], 'r'); });
      for (j = 7; j <= 9; j++) {
        ty.ring(0, j, 0, 3.6, lite ? 0 : 1.5, 'y', function (i, y, z) {
          var out = i * i + z * z > 6.9;
          return out && j === 8 ? 'W' : 'f';
        });
      }
    });
    if (!lite) { pad(f, 0, 0, 3); f.box(-6, -6, 0, 0, 1, 2, '2').box(5, 5, 0, 0, -2, -1, '2'); }
    return model('treetop_tyreswing', pal('kKpfWr129'), [o, s, ty, f],
      { pivots: { tyre: TS.swivel }, anchors: { seat: TS.seat.concat('tyre') } });
  }

  /* ---------------- treetop_bridge ---------------- */
  function bridgeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), sl = grid(G16, 0.5, 0), rp = grid(G16, 0.5, 0), pivots = {}, i;
    /* at each end two A-frames (front and back: two legs leaning together over a cross bar, a sky-blue
       cap) and the log between them that the deck ends rest on */
    [-7, 6].forEach(function (x) {
      var d = x < 0 ? 1 : -1, apex = x + d, bar = lite ? 'k' : 'K';
      [2, -3].forEach(function (k) {
        o.box(x, x, 0, 1, k, k, 'k').box(x + 2 * d, x + 2 * d, 0, 1, k, k, 'k').box(x, x + 2 * d, 2, 2, k, k, bar);
        o.box(apex, apex, 3, 8, k, k, 'k').set(apex, 9, k, 'f');
      });
      o.box(x + 2 * d, x + 2 * d, 2, 2, -2, 1, bar);
    });
    /* the six slats on p0 … p5 (2 G16 wide, 1 apart) sagging gently between the end logs */
    BR.x.forEach(function (x, n) {
      var c = Math.round(x / G16 - 0.5), jt = Math.round(BR.top[n] / G16) - 1;
      if (lite) jt |= 1;                                                  /* the halved model keeps every slat */
      sl.group('p' + n, function () { sl.box(c, c + 1, jt - 1, jt, -4, 3, 'D'); });
      pivots['p' + n] = [x, BR.top[n] - G16, 0];
    });
    /* along both sides a hand rope that swoops 0.3125 u down from the A-frame tops, and (MID / HIGH) a
       rope net under it: a strand that follows its dip, tied down to the deck every 0.25 u */
    function footJ(I) { var n = Math.min(5, Math.max(0, Math.round((I + 7.5) / 3))); return Math.round(BR.top[n] / G16) - 3; }
    function handJ(I) { return BR.hand - Math.round(BR.sag * (1 - (I / 10) * (I / 10))); }
    [4, -5].forEach(function (K) {
      for (i = -10; i <= 10; i++) {
        var hj = handJ(i), fj = footJ(i);
        rp.set(i, hj, K, 'r');
        if (lite || i < -8 || i > 8) continue;
        if (i % 4 === 0) rp.box(i, i, fj + 1, hj - 1, K, K, '7');
        else if (hj - 3 > fj) rp.set(i, hj - 3, K, '6');
      }
    });
    return model('treetop_bridge', pal('kKfDr67'), [o, sl, rp], { pivots: pivots, anchors: { postL: BR.postL, postR: BR.postR } });
  }

  /* ---------------- treetop_net ---------------- */
  /* the net's G16 cells (origin 0) folded onto one side: −1 ↔ 0, −5 ↔ 4, −10 ↔ 9 */
  function fold(v) { return v < 0 ? -v - 1 : v; }
  /* which part a net cell rides: the middle cross on 'net', the rest on the flap whose rim it faces */
  function flapOf(i, k) {
    var ai = fold(i), ak = fold(k);
    if (ai <= NT.mid && ak <= NT.mid) return 'net';
    return ak >= ai ? (k < 0 ? 'flapN' : 'flapS') : (i < 0 ? 'flapW' : 'flapE');
  }
  function netVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), cr = grid(0.25, 0.5, 0.5), nt = grid(G16), i, k;
    /* four stumpy trunks; G4 crowns from 1.0 u: two stepped pines, two round oaks
       with autumn flecks on top (MID / HIGH) */
    [[-1, -1, 'pine'], [1, -1, 'oak'], [-1, 1, 'oak'], [1, 1, 'pine']].forEach(function (t) {
      var x = t[0] < 0 ? -7 : 5, z = t[1] < 0 ? -7 : 5, c = 3 * t[0], d = 3 * t[1];
      o.box(x, x + 1, 0, 7, z, z + 1, 'k');
      if (t[2] === 'pine') {
        fill(cr, c - 1, c + 1, 4, 4, d - 1, d + 1, function (a, j, b) { return a !== c && b !== d ? null : 'g'; });
        fill(o, x - 1, x + 2, 10, 11, z - 1, z + 2, function (a, j, b) { return (a === x - 1 || a === x + 2) && (b === z - 1 || b === z + 2) ? null : 'G'; });
        o.box(x, x + 1, 12, 12, z, z + 1, 'L');
        if (!lite) o.set(x + (t[0] < 0 ? 2 : -1), 12, z + 1, '3');
      } else {
        cr.box(c - 1, c + 1, 4, 4, d - 1, d + 1, 'o');
        fill(cr, c - 1, c + 1, 5, 5, d - 1, d + 1, function (a, j, b) { return a !== c && b !== d ? null : 'O'; });
        if (!lite) o.set(x, 12, z + 1, '4').set(x + 1, 12, z - 1, '4').set(x + 2, 12, z, '4');
      }
    });
    /* the net at 0.8 u: a rope rim tied to the trunks and a grid of doubled cords inside; the middle
       cross on 'net', the rest on the four flaps hinged at the rim */
    function cord(v) { var a = fold(v); return a === 0 || a === 3 || a === 4; }
    function rim(v) { return fold(v) >= 8; }
    for (k = -10; k <= 9; k++) for (i = -10; i <= 9; i++) {
      if (rim(i) || rim(k)) { nt.set(i, 12, k, 'r'); continue; }
      if (!cord(i) && !cord(k)) continue;
      nt.group(flapOf(i, k), function () { nt.set(i, 12, k, 'n'); });
    }
    [[9, 10], [10, 9]].forEach(function (q) { [1, -1].forEach(function (sx) { [1, -1].forEach(function (sz) { nt.set(sx > 0 ? q[0] : -q[0] - 1, 12, sz > 0 ? q[1] : -q[1] - 1, 'r'); }); }); });
    var pv = { net: [0, NT.y, 0], flapN: [0, NT.y, -NT.hinge], flapS: [0, NT.y, NT.hinge], flapW: [-NT.hinge, NT.y, 0], flapE: [NT.hinge, NT.y, 0] };
    return model('treetop_net', pal('kKgGLoOrn34'), [o, cr, nt], { pivots: pv, anchors: { seat: NT.seat.concat('net') } });
  }

  var BUILD = { treetop_tunnel: tunnelVoxels, treetop_beams: beamsVoxels, treetop_seesaw: seesawVoxels, treetop_tyreswing: tyreswingVoxels,
                treetop_bridge: bridgeVoxels, treetop_net: netVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no grooves, chips, dots or net uprights), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('treetop-b', K → {id: {voxels, lod1, act, forget}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], Q = [0, 0, 0];
    function pose(a, name, rx, ry, rz, x, y, z, sx, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z; S3[0] = sx || 1; S3[2] = sz || 1;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function emit(a, kind, at, n) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n); } catch (e) { /* fx is optional */ } } }
    /* the pet's part (the crew owns it); its answer (a run-over lead for 'bounce'), or null with no crew */
    function askPet(a, id) {
      var p = a.pets;
      if (!p || typeof p.perform !== 'function') return null;
      try { return p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { return null; }
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
    /* a value an act shows, eased over CARRY s from what the act it superseded last showed (a re-tap
       never snaps the tyre's twirl, the squirrel or a flag) */
    var CARRY = 0.3;
    function held(me, key, v, t) {
      var p = me.prev && me.prev.v[key];
      me.v[key] = typeof p === 'number' && t < CARRY ? p + (v - p) * smooth(0, CARRY, t) : v;
      return me.v[key];
    }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me), rest(a, reduced), at?(cue, out) → local point, cut? (own seconds), cues? (own list, or
       fn(o) → list), lead?(answer) → the timeline's o.lead} */
    function run(a, id, spec) {
      var name = ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, o = { reduced: reduced, from: prev && !reduced ? M.carry(name, prev.out) : null };
      var me = { name: name, dur: 0, out: {}, v: {}, prev: prev && !reduced ? prev : null }, uid = a.uid, ci = 0, done = false;
      live.set(uid, me);
      var answer = askPet(a, id);
      if (spec.lead) o.lead = spec.lead(answer);
      var own = typeof spec.cues === 'function' ? spec.cues(o) : spec.cues;
      var dur = reduced ? 0 : spec.cut || M.durOf(name, o), cues = !own ? M.cues(name, o) : reduced ? stillCues(own) : own;
      me.dur = dur;
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
        spec.rest(h, reduced);
        return false;
      };
      me.cancel = function () { if (!done) { stop(); try { spec.rest(a, false); } catch (e) { /* the copy is gone */ } } };
      return me;
    }

    /* ---------- log tunnel: the pet is the show; the sprig shivers as two leaves pop out ---------- */
    var tunnelSpec = { apply: function (a, out, t, me) { pose(a, 'sprig', 0, 0, held(me, 'sprig', sprigDeg(t), t), 0, 0, 0); }, rest: function (a) { rest(a, 'sprig'); }, at: function () { return TN.leaf; } };

    /* ---------- balance beams: the middle log rolls once; the pennant waves as the pet bows ---------- */
    var beamsSpec = {
      apply: function (a, out, t, me) {
        pose(a, 'beam1', 0, 0, BM.deg * (out.swing || 0), 0, 0, 0);
        pose(a, 'pennant', 0, held(me, 'flag', waveDeg(t), t), 0, 0, 0, 0);
      },
      rest: function (a) { rest(a, 'beam1'); rest(a, 'pennant'); }
    };

    /* ---------- seesaw: the pet's end up first, the squirrel hops on, rides and hops home ---------- */
    var seesawSpec = {
      cues: function (o) { return M.cues('seesaw', o).filter(function (c) { return !o.reduced || c.sfx; }).concat([{ t: SS.churr, sfx: 'churr', vol: 0.4 }]).sort(function (x, y) { return x.t - y.t; }); },
      apply: function (a, out, t, me) {
        var deg = -SS.deg * (out.swing || 0);
        pose(a, 'plank', 0, 0, deg, 0, 0, 0);
        palAt(t, deg, Q);
        var ride = t > SS.on[1] && t < SS.off[0];
        pose(a, 'pal', 0, 0, held(me, 'r', ride ? deg : 0, t), held(me, 'x', Q[0] - SS.pal[0], t), held(me, 'y', Q[1] - SS.pal[1], t), held(me, 'z', Q[2] - SS.pal[2], t));
      },
      /* reduced motion: the plank tilted, the pet on the high seat (A), the squirrel on the low one */
      rest: function (a, reduced) {
        if (!reduced) { rest(a, 'plank'); rest(a, 'pal'); return; }
        onPlank(SS.seatB, -SS.deg, Q);
        pose(a, 'plank', 0, 0, -SS.deg, 0, 0, 0);
        pose(a, 'pal', 0, 0, -SS.deg, Q[0] - SS.pal[0], Q[1] - SS.pal[1], Q[2] - SS.pal[2]);
      }
    };

    /* ---------- tyre swing: one pendulum period toward us, a half-turn twirl out and home ---------- */
    var amp = (M && M.SWING && M.SWING.amp) || 38;
    var tyreSpec = { cut: TS.cut, cues: TS.cues,
      apply: function (a, out, t, me) { pose(a, 'tyre', -tyreDeg(out.deg, t, amp), held(me, 'twirl', twirlDeg(t), t), 0, 0, 0, 0); }, rest: function (a) { rest(a, 'tyre'); } };

    /* ---------- rope bridge: the slats roll in a wave that travels with the pet ---------- */
    var bridgeSpec = {
      apply: function (a, out, t) { for (var n = 0; n < 6; n++) pose(a, 'p' + n, M.wobbleDeg(t, n, 6, out, false), 0, 0, 0, 0, 0); },
      rest: function (a) { for (var n = 0; n < 6; n++) rest(a, 'p' + n); }
    };

    /* ---------- bounce net: the trampoline's three bounces; the net dips into a funnel at each ---------- */
    var dip0 = (M && M.BOUNCE && M.BOUNCE.dip) || 0.12, maxLead = (M && M.BOUNCE && M.BOUNCE.maxLead) || 1.2;
    function netPose(a, d) {
      var f = flapPose(d), s = f.stretch;
      pose(a, 'net', 0, 0, 0, 0, -d, 0);
      pose(a, 'flapN', f.deg, 0, 0, 0, 0, 0, 1, s);
      pose(a, 'flapS', -f.deg, 0, 0, 0, 0, 0, 1, s);
      pose(a, 'flapW', 0, 0, -f.deg, 0, 0, 0, s, 1);
      pose(a, 'flapE', 0, 0, f.deg, 0, 0, 0, s, 1);
    }
    var netSpec = {
      /* the pet's run-over lead: a number or {lead}; no pet (or any other answer) bounces the net at once */
      lead: function (ret) {
        var v = typeof ret === 'number' ? ret : ret && typeof ret.lead === 'number' ? ret.lead : 0;
        return v > 0 ? Math.min(maxLead, v) : 0;
      },
      cues: function (o) { return o.reduced ? M.cues('bounce', o) : M.cues('bounce', { lead: o.lead }); },
      apply: function (a, out) { netPose(a, netDip(out.matDip, dip0)); },
      rest: function (a) { rest(a, 'net'); FLAPS.forEach(function (n) { rest(a, n); }); }
    };

    var SPEC = { treetop_tunnel: tunnelSpec, treetop_beams: beamsSpec, treetop_seesaw: seesawSpec, treetop_tyreswing: tyreSpec,
                 treetop_bridge: bridgeSpec, treetop_net: netSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, HELPERS: HELPERS, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { tunnel: TN, beams: BM, seesaw: SS, tyreswing: TS, bridge: BR, net: NT },
    sprigDeg: sprigDeg, waveDeg: waveDeg, onPlank: onPlank, palAt: palAt, tyreDeg: tyreDeg, twirlDeg: twirlDeg, netDip: netDip, flapPose: flapPose, flapOf: flapOf
  };
}));
