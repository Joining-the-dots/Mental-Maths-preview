/* ================================================================
   My Island v3 — SLPxTreetopC (W3b.13): five pieces of the Treetop Adventure Park's decor in Pixel
   Blocks. window.SLPxTreetopC + SL3D.defineVox('treetop-c', factory) in the browser, module.exports
   in Node: {IDS, voxels: {<id>: fn(st) → VoxModel}, lod1: {<id>: fn(st) → VoxModel}, factory, …}.
   Every model is pure data (no THREE, no DOM); the island, the photocards and the Node tests mesh
   the same source. Item space as the kit: base y = 0, pivot at the footprint centre, facing +z;
   everything below y 1.0 stays inside fp − 0.14 u (|x|, |z| ≤ 0.43); the platform tree's deck and
   crown and the pod overhang above it.
     treetop_birdtable  1×1, 1.3 u  a bark post on a stump foot carries a plank tray with a raised lip
                        (seeds on its open front); two side posts hold a stepped plank roof with a
                        moss ridge over the tray's back half, so the birds stay in view from the
                        island camera. Two round blue birds (critter grid, four voxels tall: blue backs,
                        pale chests, an eye each side of a yellow beak) sit on the ridge on 'b0' /
                        'b1'. Act 'feed': they hop forward off the ridge, flutter down past the eave
                        onto the front of the tray, peck three times and fly back up the same way.
     treetop_picnic     1×1, 1.0 u  a plank deck with a chunky picnic table (plank-end legs), two log
                        benches, a red-and-white checked cloth, a wicker basket whose lid rides 'lid',
                        and the food on 'dishes' (a sandwich stack, an apple, a yellow lemonade jug;
                        a second apple and the jug's handle at MID / HIGH); a sky-blue pennant on a
                        pole at the back corner (MID / HIGH). Act 'serve': the lid flips, the food
                        ducks and pops back (0.8 → 1) and the pet sits on the back bench (anchor
                        seat, left of the basket) for a bite ('feast').
     treetop_xylophone  1×1, 0.8 u  two low trestles (a beam on two legs, splayed feet at MID / HIGH)
                        carry two rope rails; five peeled log bars ride k0 … k4, 0.81 u long on the
                        left down to 0.44 u on the right, each with an accent cap on its front end
                        (and its back end at MID / HIGH); a post at the back right carries a peg with
                        two hanging beaters with round red heads (MID / HIGH). Act 'chime': the bars
                        dip left to right, one every 0.5 s, a note pictogram rising off each in its
                        own colour; three tunes in a fixed order, one a tap; the pet stands at 'spot'
                        (the front right corner) and nods on the beat ('stand:beatNod').
     treetop_platform   1×1, 2.9 u  (the first plan's tree) a bark trunk (pinwheel roots at MID / HIGH),
                        a plank deck at 1.5 u with rounded corners and a rope rail on four posts (the
                        back two at MID / HIGH), a ladder up the front through a gap in the deck and
                        the rail, and a crown on 'sway' from 2.125 u, clear of the pet on the deck: a
                        candy pine in striped stepped skirts with coloured baubles (colourway 0) or
                        a round oak with autumn leaves (colourway 1). Act 'climb' (SLMotion
                        'climbDeck'): the pet hops up to the deck (anchor deck, LOOK trail ['deck']),
                        turns and waves; the crown shivers at each hop and lets two leaves go. Idle:
                        the crown sways (LOOK idle, 0.15 Hz).
     treetop_pod        1×1, 2.6 u  a bark trunk holds a round stepped plank pod (an acorn under its
                        pointed leaf cap: pine greens, or oak greens with an autumn tip); a round
                        hatch on 'hatch' covers the porthole facing +z (a rope frame round it at MID /
                        HIGH), and a rope ladder hangs to the ground. Behind the hatch sits the
                        island's squirrel (the head of SLPxCharacters' squirrel critter, on 'pal'). A
                        warm lamp inside (state 'lamp': the porthole's back and a little side window)
                        glows steadily at night. Act 'peek' (a remembered toggle): the hatch swings
                        open in 0.4 s and the squirrel pops out and looks up at you; while it is open
                        it looks left and right now and then (idle); tap again and it ducks in and
                        the hatch shuts.
   GRAIN (D11): small decor masses G8; trims, rails, ropes, furniture tops, food G16 (the bars G32
   across, so five fit with clear gaps); the tree's crown G4 and G8; birds and the squirrel on the
   critter grid. No corner AO (on G16 and critter parts it would only split quads).
   LOW (D89, D106): detail voxels are tagged lod 'mid' (add-ons and bar ends, never voxels inside a
   mass, so LOW shows no hole). Every id brings its own lod1: a handful of plain boxes with every
   lookEntries pivot and anchor, under TRIS_CAPS_LOD1 (120).
   ACTS run on SLMotion timelines by name: feed, serve (cut to 2.5 s with this file's own cues),
   chime (cues by tune), climbDeck, peek. One live act per uid (a re-tap supersedes). The pod's
   toggle keeps a per-copy memory: 'glowOn' / 'glowOff' / 'close' are explicit; the bare act follows
   a.lit when the host has already flipped it, else it toggles what the copy shows. Reduced motion
   is the end state at once with the same sounds and one sparkle (both birds on the tray, heads
   down; the bars still; the hatch open or shut). The pet's part is a.pets.perform(LOOK perform
   kind, uid). Rates: flutters and pecks 2 Hz, the bars one dip each 0.5 s, the crown's idle 0.15 Hz,
   the squirrel turns its head every ~1.5 s, the lamp fades in with the night and stays steady. No
   word, no five-point shape, no flame; nothing here reads, awards or spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.lit a.show a.batch a.template · a.pivot(name).set(
   rotDeg[3], pos[3], scale[3]) · a.state(key, v) · a.halo · a.emit(kind, localPos, n, opts) ·
   a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxTreetopC = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('treetop-c', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxTreetopC: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }
  function chars() { return sibling('SLPxCharacters', './px-characters.js'); }

  var VERSION = 1;
  var IDS = ['treetop_birdtable', 'treetop_picnic', 'treetop_xylophone', 'treetop_platform', 'treetop_pod'];
  var VARIANTS = { treetop_platform: 2, treetop_pod: 2 };
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, G32 = 0.03125, GC = 0.05;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { treetop_birdtable: 'feed', treetop_picnic: 'serve', treetop_xylophone: 'chime', treetop_platform: 'climbDeck', treetop_pod: 'peek' };
  var PERFORM = { treetop_picnic: 'feast', treetop_xylophone: 'stand:beatNod', treetop_platform: 'trail:hop' };
  var TOGGLES = ['treetop_pod'];
  /* pivots beyond the lookEntries lists: none */
  var HELPERS = {};
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  /* bird table: the birds' feet on the ridge (b0, b1) and on the tray's open front; the act's hop, the
     peck (degrees forward) and the flutter (x scale) */
  var BT = { b: [[-0.15, 1.1875, 0], [0.15, 1.1875, 0]], land: [[-0.125, 0.75, 0.25], [0.125, 0.75, 0.25]], tray: [0, 0.75, 0.25],
             hop: 0.1, peck: 38, flutter: 0.35, flapHz: 2, lag: 0.125 };
  /* picnic: the lid's hinge (the basket's back edge), the food on the cloth, the pet's seat on the back
     bench; the act's own seconds and cues */
  var PN = { lid: [0.21875, 0.625, -0.125], dishes: [-0.09375, 0.5625, 0], seat: [-0.125, 0.3125, -0.3125],
             open: [0.1, 0.35], shut: [2.0, 2.35], deg: 105, dip: [0.4, 0.55], pop: [0.55, 0.95], hop: 0.05, cut: 2.5,
             cues: [{ t: 0.1, sfx: 'chip' }, { t: 0.6, sfx: 'chip', step: 2 }, { t: 0.6, emit: 'sparkle', n: 2 }, { t: 1.5, sfx: 'voice', pet: true },
                    { t: 2.0, sfx: 'chip', step: 1 }] };
  /* xylophone: the five bars (lengths in G32, left to right), their centres and accent colours; the
     pet's spot; the dip */
  var XY = { len: [26, 23, 20, 17, 14], x: [-0.3125, -0.15625, 0, 0.15625, 0.3125], y: 0.4375, top: 0.5, spot: [0.375, 0, 0.375], dip: 0.0625, tilt: 5,
             caps: ['PX Accent 1', 'PX Accent 2', 'PX Accent 3', 'PX Accent 4', 'PX Accent 5'] };
  /* platform tree: the crown's base (pivot sway), the deck's top and the pet's spot on it */
  var PT = { sway: [0, 2.125, 0], deckY: 1.5, deck: [0, 1.5, 0.21875], jig: 1.6, leafAt: 1.4, leaf: [0, 2.1, 0.45] };
  /* pod: the hatch's hinge (its left edge), the squirrel, the lamp's side window; how far the squirrel
     comes out and how far it turns its head */
  var PD = { hatch: [-0.1875, 1.8125, 0.46875], pal: [0, 1.625, 0.3125], glow: [0.47, 1.9375, 0], deg: 100, out: 0.16, up: 0.025, tilt: 20, turn: 32,
             look: [0.45, 0.75, 1.5, 2.1, 2.8, 3.1, 4.6], halo: 0.45 };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function inOut(u) { return (1 - Math.cos(Math.PI * clamp01(u))) / 2; }
  function outBack(u) { u = clamp01(u) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
  /* how far the night has come on for lamps: 0 by day, 1 from dusk on (as the garden lamps) */
  function nightOf(k) { var u = clamp01(((+k || 0) - 0.35) / 0.3); return u * u * (3 - 2 * u); }
  /* a toggle's target (1 = open): the explicit names win; the bare act follows a.lit when the host has
     already flipped the memory, else it toggles what the copy shows */
  function wantOn(name, lit, shown) {
    if (name === 'glowOn') return 1;
    if (name === 'glowOff' || name === 'close') return 0;
    var l = lit ? 1 : 0;
    if (shown !== 0 && shown !== 1) return l ? 0 : 1;
    return l !== shown ? l : shown ? 0 : 1;
  }
  /* bird n of the 'feed' pose {bob, swing} at act time t: out.x / y / z its offset from the ridge (it hops
     forward off the ridge first, then drops past the eave onto the tray; back up the same way), out.rx
     its peck (degrees forward: only on the tray, easing off as it takes off), out.sx its flutter (wings
     out while it flies) */
  function birdAt(n, bob, swing, t, out) {
    out = out || {};
    var b = BT.b[n], l = BT.land[n], u = clamp01(bob || 0), ez = inOut(seg(u, 0, 0.6)), ey = inOut(seg(u, 0.3, 1)), fly = u > 0 && u < 1;
    out.x = (l[0] - b[0]) * ez;
    out.y = (l[1] - b[1]) * ey + BT.hop * Math.sin(Math.PI * seg(u, 0, 0.6));
    out.z = (l[2] - b[2]) * ez;
    out.rx = BT.peck * Math.max(0, -(swing || 0)) * seg(u, 0.8, 1);
    out.sx = fly ? 1 + BT.flutter * (0.5 - 0.5 * Math.cos(2 * Math.PI * BT.flapHz * t)) : 1;
    return out;
  }
  /* the picnic's own 'serve' at t: out.lid (degrees: up in 0.25 s, held, shut), out.food (scale: a quick
     duck to 0.8, then a pop back to 1) and out.hop (the food's lift) */
  function serveAt(t, out) {
    out = out || {};
    out.lid = t <= PN.open[0] ? 0 : t < PN.shut[0] ? PN.deg * Math.min(1, outBack(seg(t, PN.open[0], PN.open[1]))) : PN.deg * (1 - inOut(seg(t, PN.shut[0], PN.shut[1])));
    out.food = t < PN.dip[0] ? 1 : t < PN.pop[0] ? 1 - 0.2 * inOut(seg(t, PN.dip[0], PN.dip[1])) : 0.8 + 0.2 * outBack(seg(t, PN.pop[0], PN.pop[1]));
    out.hop = PN.hop * Math.sin(Math.PI * seg(t, PN.dip[0], PN.pop[1]));
    return out;
  }
  /* which bar dips at act time t (one every 0.5 s, left to right; -1 outside the act) — the chime's bob says how far */
  function barOf(t) { return t >= 0 && t < 2.5 ? Math.floor(t * 2) : -1; }
  /* the squirrel's head turn (degrees) τ s after the hatch opened: a look left, a look right, back to
     the front and a rest, round again (PD.look: the turn and hold marks, the last one the cycle) */
  function lookAt(tau) {
    var L = PD.look, c = L[6] - L[0];
    if (!(tau > L[0])) return 0;
    var s = L[0] + ((tau - L[0]) % c);
    if (s < L[1]) return PD.turn * inOut(seg(s, L[0], L[1]));
    if (s < L[2]) return PD.turn;
    if (s < L[3]) return PD.turn * (1 - 2 * inOut(seg(s, L[2], L[3])));
    if (s < L[4]) return -PD.turn;
    if (s < L[5]) return -PD.turn * (1 - inOut(seg(s, L[4], L[5])));
    return 0;
  }
  /* the pod at hatch level k (0 shut … 1 open): out.hatch (degrees about y), out.pal (how far out the
     squirrel is: it follows the hatch's last half both ways) */
  function podAt(k, out) {
    out = out || {};
    k = clamp01(k);
    out.hatch = -PD.deg * k;
    out.pal = inOut(seg(k, 0.5, 1));
    return out;
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz, oy) { return VX().grid({ grid: g, origin: [ox || 0, oy || 0, oz || 0] }); }
  /* a box given in item metres (its faces; each must land on the grid) */
  function mb(g, x0, x1, y0, y1, z0, z1, c) {
    var s = g.grid, o = g.origin;
    return g.box(Math.round(x0 / s[0] + o[0]), Math.round(x1 / s[0] + o[0]) - 1, Math.round(y0 / s[1] + o[1]), Math.round(y1 / s[1] + o[1]) - 1,
                 Math.round(z0 / s[2] + o[2]), Math.round(z1 / s[2] + o[2]) - 1, c);
  }
  /* fn(i, j, k) → a char, or null to leave that cell as it is (box() would clear it) */
  function fill(g, i0, i1, j0, j1, k0, k1, fn) {
    for (var j = j0; j <= j1; j++) for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = fn(i, j, k); if (c) g.set(i, j, k, c); }
  }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at] | [grid, at, true] (true: no ground under it)]; empty
     grids are left out; o.pivots {name: [x, y, z]} and o.anchors {name: [x, y, z]} in item metres */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = Array.isArray(l) ? l[0] : l, ly;
      if (!g.count) return;
      ly = { vox: g.snapshot() };
      if (Array.isArray(l) && l[1]) ly.at = l[1].slice();
      if (Array.isArray(l) && l[2]) ly.ground = false;
      m.layers.push(ly);
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { m.pivots[n] = { at: U(o.pivots[n]), parent: null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { m.anchors[n] = U(o.anchors[n]); });
    if (o.cull) m.cull = o.cull.slice();
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  var MID = 'mid';
  function mid(token, mode) { return mode ? { token: token, mode: mode, lod: MID } : { token: token, lod: MID }; }
  function lamp() { return { token: 'PX Lamp Warm', mode: 'glow', state: { key: 'lamp', off: 'PX Lamp Off', on: 'PX Lamp Warm', initial: 0 } }; }
  function variantOf(st, id) { var n = VARIANTS[id], v = st && typeof st.variant === 'number' && isFinite(st.variant) ? st.variant | 0 : 0; return v < 0 ? 0 : v >= n ? n - 1 : v; }
  /* an n × n square with its corners off (|di| + |dk| ≤ r on a centred grid) */
  function disc(g, j, r, lim, c) { for (var k = -r; k <= r; k++) for (var i = -r; i <= r; i++) if (Math.abs(i) + Math.abs(k) <= lim) g.set(i, j, k, typeof c === 'function' ? c(i, j, k) : c); }

  /* ---------------- the birds (critter grid, facing +z, feet at y 0) ---------------- */
  /* a round little bird four voxels tall: a blue back, a pale chest, an eye each side of the front, a
     yellow beak (and a tail at MID / HIGH) */
  var BIRD_PAL = { B: 'PX Tree Flag', C: 'PX Tree Net', Y: 'PX Sunny', E: 'PX Ink Eye', b: mid('PX Tree Flag') };
  function bird(g, name) {
    g.group(name, function () {
      g.box(-1, 1, 0, 3, -1, 1, function (i, j, k) { return k === 1 && j < 2 ? 'C' : k === 1 && j === 2 && i ? 'E' : 'B'; });
      g.set(0, 2, 2, 'Y');
      g.set(0, 1, -2, 'b');
    });
  }

  /* ---------------- treetop_birdtable ---------------- */
  function birdtableVoxels(st) {
    var s = grid(G8, 0.5, 0.5), o = grid(G16), r = grid(G16), d = grid(G16), b0 = grid(GC, 0.5, 0.5), b1 = grid(GC, 0.5, 0.5);
    mb(s, -0.1875, 0.1875, 0, 0.125, -0.1875, 0.1875, 'k');                                 /* a stump foot */
    /* the post, the plank tray (longer at the front, where the birds land) and its raised lip */
    mb(o, -0.0625, 0.0625, 0.125, 0.6875, -0.0625, 0.0625, 'k');
    mb(o, -0.3125, 0.3125, 0.6875, 0.75, -0.25, 0.375, 'D');
    fill(o, -5, 4, 12, 12, -4, 5, function (i, j, k) { return i === -5 || i === 4 || k === -4 || k === 5 ? 'L' : null; });
    /* two side posts up to a stepped roof over the tray's back half, its ridge capped with moss */
    mb(o, -0.3125, -0.25, 0.8125, 1.0, -0.125, -0.0625, 'k'); mb(o, 0.25, 0.3125, 0.8125, 1.0, -0.125, -0.0625, 'k');
    mb(r, -0.4375, 0.4375, 1.0, 1.0625, -0.1875, 0.1875, 'R');
    mb(r, -0.375, 0.375, 1.0625, 1.125, -0.125, 0.125, 'S');
    mb(r, -0.3125, 0.3125, 1.125, 1.1875, -0.0625, 0.0625, 'M');
    /* MID / HIGH: seeds, moss spilling off the ridge, a tuft on the foot */
    [[-0.0625, 0.1875], [0.0625, 0.25], [-0.1875, 0.25]].forEach(function (q) { mb(d, q[0], q[0] + G16, 0.75, 0.8125, q[1], q[1] + G16, 'a'); });
    mb(d, -0.375, -0.3125, 1.0625, 1.125, 0.125, 0.1875, 'm'); mb(d, 0.25, 0.3125, 1.0625, 1.125, -0.1875, -0.125, 'm');
    mb(d, -0.125, 0, 0.125, 0.1875, 0.0625, 0.125, 'm');
    bird(b0, 'b0'); bird(b1, 'b1');
    var pal = { k: 'PX Tree Bark', D: { token: 'PX Tree Plank', mode: 'plank' }, L: 'PX Tree Bark Trail 2', R: 'PX Tree Bark Trail', S: 'PX Tree Bark Trail 2',
                M: { token: 'PX Tree Moss', mode: 'soft' }, a: mid('PX Tree Autumn'), m: mid('PX Tree Moss', 'soft') };
    for (var c in BIRD_PAL) pal[c] = BIRD_PAL[c];
    return model('treetop_birdtable', pal, [s, o, r, [d, null, true], [b0, BT.b[0], true], [b1, BT.b[1], true]],
      { pivots: { b0: BT.b[0], b1: BT.b[1] }, anchors: { tray: BT.tray }, ao: false });
  }

  /* ---------------- treetop_picnic ---------------- */
  /* the checked cloth: 0.125 u squares of red and white (one colour per voxel) */
  function check(i, j, k) { return ((i >> 1) + (k >> 1)) & 1 ? 'w' : 'c'; }
  function picnicVoxels(st) {
    var p = grid(G8), t = grid(G16), f = grid(G16), l = grid(G16), d = grid(G16);
    mb(p, -0.375, 0.375, 0, 0.125, -0.375, 0.375, 'D');                                    /* the plank deck */
    /* the table: plank-end legs, a top and the checked cloth on it; two log benches (the back one is the pet's seat) */
    mb(t, -0.25, -0.1875, 0.125, 0.4375, -0.125, 0.125, 'W'); mb(t, 0.1875, 0.25, 0.125, 0.4375, -0.125, 0.125, 'W');
    mb(t, -0.3125, 0.3125, 0.4375, 0.5, -0.1875, 0.1875, 'W');
    mb(t, -0.25, 0.25, 0.5, 0.5625, -0.125, 0.125, check);
    mb(t, -0.3125, 0.3125, 0.125, 0.3125, -0.375, -0.25, 'B'); mb(t, -0.3125, 0.3125, 0.125, 0.25, 0.25, 0.375, 'B');
    /* the wicker basket on the table's right end (a darker band at the top) and its lid on 'lid' */
    mb(t, 0.125, 0.3125, 0.5, 0.625, -0.125, 0.0625, function (i, j) { return j === 9 ? 'R' : 'r'; });
    l.group('lid', function () { mb(l, 0.125, 0.3125, 0.625, 0.6875, -0.125, 0.0625, 'H'); l.set(3, 11, -1, 'h'); });
    /* the food on 'dishes': a sandwich stack, an apple, the lemonade jug */
    f.group('dishes', function () {
      mb(f, -0.25, -0.125, 0.5625, 0.75, -0.0625, 0.0625, function (i, j) { return j === 10 ? 'g' : 'e'; });
      mb(f, -0.0625, 0.0625, 0.5625, 0.6875, 0, 0.125, 'a');
      mb(f, -0.0625, 0.0625, 0.5625, 0.75, -0.125, 0, 'y');
      /* MID / HIGH: the apple's leaf, the jug's handle, a second apple, the ham peeking out */
      f.set(0, 11, 1, 'G').set(1, 11, -1, 'j').set(1, 10, -1, 'j');
      mb(f, 0.0625, 0.125, 0.5625, 0.625, 0.0625, 0.125, 'A');
      mb(f, -0.25, -0.125, 0.625, 0.6875, 0.0625, 0.0625 + G16, 'p');
    });
    /* MID / HIGH: a pennant pole on the back left corner, a sky-blue flag and a sunny knob */
    mb(d, -0.375, -0.3125, 0.125, 0.9375, -0.375, -0.3125, 'k');
    mb(d, -0.3125, -0.125, 0.875, 0.9375, -0.375, -0.3125, 'F'); mb(d, -0.3125, -0.0625, 0.8125, 0.875, -0.375, -0.3125, 'F');
    mb(d, -0.3125, -0.1875, 0.75, 0.8125, -0.375, -0.3125, 'F');
    mb(d, -0.375, -0.3125, 0.9375, 1.0, -0.375, -0.3125, 'Y');
    return model('treetop_picnic', {
      D: { token: 'PX Tree Plank', mode: 'plank' }, W: 'PX Tree Bark Trail', B: { token: 'PX Tree Bark Trail 2', mode: 'plank' }, c: 'PX Tree Toadstool', w: 'Cloud White',
      r: 'PX Tree Rope', R: 'PX Tree Bark Trail 2', H: 'PX Tree Bark Trail', h: mid('PX Tree Bark'),
      e: 'PX Cream', g: 'PX Leaf', a: 'PX Tree Toadstool', y: 'PX Sunny', G: mid('PX Leaf'), j: mid('Cloud White'), A: mid('PX Tree Toadstool'), p: mid('PX Candy Pink'),
      k: mid('PX Tree Bark'), F: mid('PX Tree Flag'), Y: mid('PX Sunny')
    }, [p, t, [f, null, true], [l, null, true], [d, null, true]], { pivots: { lid: PN.lid, dishes: PN.dishes }, anchors: { seat: PN.seat }, ao: false });
  }

  /* ---------------- treetop_xylophone ---------------- */
  function xylophoneVoxels(st) {
    var o = grid(G16), bars = VX().grid({ grid: [G32, G16, G32], origin: [0.5, 0, 0] }), d = grid(G16), bt = grid(G32), pal = {};
    /* two low trestles at the ends (a beam on two legs, splayed feet at MID / HIGH) and the rope rails on them */
    [-0.375, 0.3125].forEach(function (x) {
      mb(o, x, x + G16, 0.25, 0.3125, -0.25, 0.25, 'k');
      mb(o, x, x + G16, 0, 0.25, -0.25, -0.1875, 'k'); mb(o, x, x + G16, 0, 0.25, 0.1875, 0.25, 'k');
      mb(d, x, x + G16, 0, 0.0625, -0.3125, -0.25, 'f'); mb(d, x, x + G16, 0, 0.0625, 0.25, 0.3125, 'f');
    });
    mb(o, -0.375, 0.375, 0.3125, 0.375, -0.1875, -0.125, 'r'); mb(o, -0.375, 0.375, 0.3125, 0.375, 0.125, 0.1875, 'r');
    /* the post at the back right (its peg and two hanging beaters at MID / HIGH) */
    mb(o, 0.3125, 0.375, 0, 0.75, -0.375, -0.3125, 'k'); mb(o, 0.3125, 0.375, 0.75, 0.8125, -0.375, -0.3125, 'K');
    mb(d, 0.0625, 0.3125, 0.6875, 0.75, -0.375, -0.3125, 'f');
    mb(bt, 0.09375, 0.125, 0.5, 0.6875, -0.375, -0.34375, 'h'); mb(bt, 0.21875, 0.25, 0.5, 0.6875, -0.375, -0.34375, 'h');
    mb(bt, 0.0625, 0.15625, 0.40625, 0.5, -0.375, -0.3125, 't'); mb(bt, 0.1875, 0.28125, 0.40625, 0.5, -0.375, -0.3125, 't');
    /* five peeled log bars on k0 … k4, 3 G32 wide with 2 between, long on the left: an accent cap on the
       front end (and on the back end at MID / HIGH) */
    XY.len.forEach(function (L, n) {
      var k0 = -Math.ceil(L / 2), k1 = k0 + L - 1, cap = String(n + 1), back = String((n + 6) % 10);
      pal[cap] = XY.caps[n]; pal[back] = mid(XY.caps[n]);
      bars.group('k' + n, function () { bars.box(-11 + 5 * n, -9 + 5 * n, 6, 7, k0, k1, function (i, j, k) { return k >= k1 - 1 ? cap : k <= k0 + 1 ? back : 'b'; }); });
    });
    pal.b = { token: 'PX Tree Plank', mode: 'plank' }; pal.k = 'PX Tree Bark'; pal.K = 'PX Tree Bark Trail'; pal.r = 'PX Tree Rope';
    pal.f = mid('PX Tree Bark'); pal.h = mid('PX Tree Bark Trail 2'); pal.t = mid('PX Tree Toadstool');
    var pivots = {};
    XY.x.forEach(function (x, n) { pivots['k' + n] = [x, XY.y, 0]; });
    return model('treetop_xylophone', pal, [o, [bars, null, true], [d, null, true], [bt, null, true]], { pivots: pivots, anchors: { spot: XY.spot }, ao: false });
  }

  /* ---------------- treetop_platform ---------------- */
  /* the candy pine's baubles and the oak's autumn leaves: G8 voxels proud of the crown [i, j, k] on its odd grid */
  var BAUBLES = [[4, 0, 1, 'q'], [-4, 0, -1, 'u'], [1, 0, 4, 'u'], [-1, 0, 4, 'v'], [3, 2, 1, 'v'], [-1, 2, 3, 'q'], [-3, 2, -1, 'u'], [2, 4, 0, 'q'], [0, 4, 2, 'u']];
  var LEAVES = [[5, 2, 1, 'q'], [-5, 3, -1, 'q'], [1, 3, 5, 'q'], [-2, 2, -5, 'q'], [-5, 4, 0, 'q']];
  function platformVoxels(st) {
    var v = variantOf(st, 'treetop_platform'), t = grid(G8), dk = grid(G8), w = grid(G16), c = grid(G4, 0.5, 0.5), c2 = grid(G4), e = grid(G8, 0.5, 0.5), e2 = grid(G8);
    /* the trunk (four pinwheel roots at MID / HIGH) */
    mb(t, -0.125, 0.125, 0, 2.25, -0.125, 0.125, 'k');
    t.set(-2, 0, -1, 'K').set(1, 0, 0, 'K').set(0, 0, -2, 'K').set(-1, 0, 1, 'K');
    /* the deck at 1.5 u, its corners rounded, a gap at the front where the ladder comes up */
    mb(dk, -0.5, 0.5, 1.375, 1.5, -0.5, 0.5, function (i, j, k) { return (i === -4 || i === 3) && (k === -4 || k === 3) || k >= 2 && i >= -1 && i <= 0 ? null : 'D'; });
    /* the rope rail on four corner posts, open at the front; the ladder's rails are the gate posts */
    mb(w, -0.375, 0.375, 1.6875, 1.75, -0.375, -0.3125, 'r');
    mb(w, -0.375, -0.3125, 1.6875, 1.75, -0.3125, 0.375, 'r'); mb(w, 0.3125, 0.375, 1.6875, 1.75, -0.3125, 0.375, 'r');
    mb(w, -0.3125, -0.1875, 1.6875, 1.75, 0.3125, 0.375, 'r'); mb(w, 0.1875, 0.3125, 1.6875, 1.75, 0.3125, 0.375, 'r');
    [[-0.375, 0.3125], [0.3125, 0.3125], [-0.375, -0.375], [0.3125, -0.375]].forEach(function (q, n) { mb(w, q[0], q[0] + G16, 1.5, 1.6875, q[1], q[1] + G16, n < 2 ? 'p' : 'P'); });
    /* the ladder up the front: two rails and rungs */
    mb(w, -0.1875, -0.125, 0, 1.75, 0.3125, 0.375, 'p'); mb(w, 0.125, 0.1875, 0, 1.75, 0.3125, 0.375, 'p');
    [0.25, 0.75, 1.25].forEach(function (y) { mb(w, -0.125, 0.125, y, y + G16, 0.3125, 0.375, 'n'); });
    [0.5, 1.0].forEach(function (y) { mb(w, -0.125, 0.125, y, y + G16, 0.3125, 0.375, 'N'); });
    /* the crown on 'sway' (its own frame: y 0 = 2.125 u, clear of the pet on the deck) */
    if (v === 0) {                                                                             /* a candy pine: four stepped skirts in stripes */
      c2.group('sway', function () { c2.box(-2, 1, 0, 0, -2, 1, function (i, j, k) { return (i === -2 || i === 1) && (k === -2 || k === 1) ? null : 'g'; }); });
      c.group('sway', function () { disc(c, 1, 1, 2, 'l'); });
      e2.group('sway', function () { e2.box(-2, 1, 4, 4, -2, 1, 'G').box(-1, 0, 5, 5, -1, 0, 'l'); });
    } else {                                                                                   /* a round oak */
      c.group('sway', function () { disc(c, 0, 1, 2, 'o'); disc(c, 1, 2, 3, 'O'); disc(c, 2, 2, 2, 'o'); });
    }
    e.group('sway', function () { (v === 0 ? BAUBLES : LEAVES).forEach(function (q) { e.set(q[0], q[1], q[2], q[3]); }); });
    var at = [0, PT.sway[1], 0];
    return model('treetop_platform', {
      k: 'PX Tree Bark', K: mid('PX Tree Bark'), D: { token: 'PX Tree Plank', mode: 'plank' }, p: 'PX Tree Bark Trail', P: mid('PX Tree Bark Trail'), r: 'PX Tree Rope',
      n: 'PX Tree Bark Trail 2', N: mid('PX Tree Bark Trail 2'),
      g: { token: 'PX Tree Pine', mode: 'leaf' }, G: { token: 'PX Tree Pine Mid', mode: 'leaf' }, l: { token: 'PX Tree Pine Light', mode: 'leaf' },
      o: { token: 'PX Tree Oak', mode: 'leaf' }, O: { token: 'PX Tree Oak Light', mode: 'leaf' },
      q: mid(v === 0 ? 'PX Tree Toadstool' : 'PX Tree Autumn'), u: mid('PX Tree Flag'), v: mid('PX Sunny')
    }, [t, dk, [w, null, true], [c, at, true], [c2, at, true], [e, at, true], [e2, at, true]],
      { pivots: { sway: PT.sway }, anchors: { deck: PT.deck }, ao: false });
  }

  /* ---------------- treetop_pod ---------------- */
  /* the squirrel's head off SLPxCharacters' critter (its 'head' group, set down onto row 0) on 'pal';
     its chars remapped into this model's palette */
  var SQ_CH = { s: 'q', c: 'e', e: 'E' }, SQ_EARS = 3, SQ_G = 0.075;
  function squirrel(g, pal) {
    var CH = chars(), m = CH && typeof CH.critterVoxels === 'function' ? CH.critterVoxels('squirrel', { size: 9 * SQ_G }) : null;
    if (!m) {                                                                     /* no px-characters: a plain head */
      g.group('pal', function () { g.box(-1, 1, 0, 2, -1, 1, 'q').set(-1, 3, 0, 'q').set(1, 3, 0, 'q'); });
      pal.q = 'PX Tree Autumn';
      return;
    }
    var L = m.layers[0].vox, W = L.dims[0], H = L.dims[1], D = L.dims[2], head = L.names.indexOf('head');
    Object.keys(SQ_CH).forEach(function (k) { if (m.palette[k]) pal[SQ_CH[k]] = m.palette[k]; });
    pal.Q = mid(typeof m.palette.s === 'string' ? m.palette.s : m.palette.s.token);
    g.group('pal', function () {
      for (var y = 0; y < H; y++) for (var z = 0; z < D; z++) for (var x = 0; x < W; x++) {
        var s = (y * D + z) * W + x, ch = String.fromCharCode(L.c[s]);
        if (L.c[s] && L.p[s] === head && SQ_CH[ch]) g.set(x + L.min[0], y + L.min[1] - 4, z + L.min[2], y + L.min[1] - 4 >= SQ_EARS ? 'Q' : SQ_CH[ch]);
      }
    });
  }
  function podVoxels(st) {
    var v = variantOf(st, 'treetop_pod'), t = grid(G8), b = grid(G8, 0.5, 0.5), h = VX().grid({ grid: G16, origin: [0, 0, 0] }), lr = grid(G16), fr = grid(G16), sq = grid(SQ_G, 0.5, 0.5), pal;
    /* the trunk up into the pod (pinwheel roots at MID / HIGH) */
    mb(t, -0.125, 0.125, 0, 1.5, -0.125, 0.125, 'k');
    t.set(-2, 0, -1, 'R').set(1, 0, 0, 'R').set(0, 0, -2, 'R').set(-1, 0, 1, 'R');
    /* the round stepped pod (plank grooves): a darker base, the round middle, a pointed leaf cap (an acorn) */
    b.box(-2, 2, 12, 12, -2, 2, 'B');
    b.box(-3, 3, 13, 15, -3, 3, function (i, j, k) { return Math.abs(i) === 3 && Math.abs(k) === 3 ? null : 'P'; });
    b.box(-2, 2, 16, 17, -2, 2, 'C'); b.box(-1, 1, 18, 18, -1, 1, 'c'); b.set(0, 19, 0, 'T');
    /* the porthole (the lamp inside: the squirrel waits in front of it), and the lamp's little side window on the right */
    b.box(-1, 1, 13, 14, 3, 3, 'Y');
    b.set(3, 15, 0, 'Y');
    /* the hatch on 'hatch': a round lighter-wood door just proud of the porthole, a knob at MID / HIGH */
    h.group('hatch', function () {
      h.box(-3, 2, 26, 31, 7, 7, function (i, j) { return (i === -3 || i === 2) && (j === 26 || j === 31) ? null : 'H'; });
      h.set(1, 28, 8, 'h');
    });
    /* a rope frame round the porthole and, on the oak cap, an autumn leaf at MID / HIGH */
    mb(fr, -0.25, 0.25, 1.5625, 1.625, 0.4375, 0.5, 'f'); mb(fr, -0.25, 0.25, 2.0, 2.0625, 0.4375, 0.5, 'f');
    mb(fr, -0.25, -0.1875, 1.625, 2.0, 0.4375, 0.5, 'f'); mb(fr, 0.1875, 0.25, 1.625, 2.0, 0.4375, 0.5, 'f');
    if (v === 1) fr.box(0, 1, 38, 38, 1, 1, 'a');
    /* the rope ladder hanging from the pod to the ground */
    mb(lr, -0.1875, -0.125, 0, 1.5, 0.3125, 0.375, 'r'); mb(lr, 0.125, 0.1875, 0, 1.5, 0.3125, 0.375, 'r');
    [0.25, 0.5625, 0.875, 1.1875].forEach(function (y) { mb(lr, -0.125, 0.125, y, y + G16, 0.3125, 0.375, 'n'); });
    pal = {
      k: 'PX Tree Bark', R: mid('PX Tree Bark'), P: { token: 'PX Tree Plank', mode: 'plank' }, B: { token: 'PX Tree Bark Trail', mode: 'plank' },
      C: { token: v ? 'PX Tree Oak' : 'PX Tree Pine Mid', mode: 'leaf' }, c: { token: v ? 'PX Tree Oak Light' : 'PX Tree Pine Light', mode: 'leaf' },
      T: v ? 'PX Tree Autumn' : { token: 'PX Tree Pine', mode: 'leaf' }, a: mid('PX Tree Autumn'), Y: lamp(),
      r: 'PX Tree Rope', H: 'PX Tree Bark Trail 2', h: mid('PX Tree Bark'), n: mid('PX Tree Net'), f: mid('PX Tree Rope')
    };
    squirrel(sq, pal);
    return model('treetop_pod', pal, [t, b, [h, null, true], [fr, null, true], [lr, null, true], [sq, PD.pal, true]],
      { pivots: { hatch: PD.hatch, pal: PD.pal }, anchors: { glow: PD.glow }, ao: false });
  }

  /* ================================================================
     LOD1 — the far-island bakes (D106): a few plain boxes per piece, inside TRIS_CAPS_LOD1, keeping
     every lookEntries pivot
     ================================================================ */
  var LO = {
    treetop_birdtable: function () {
      var o = grid(G16), b0 = grid(GC, 0.5, 0.5), b1 = grid(GC, 0.5, 0.5);
      mb(o, -0.0625, 0.0625, 0, 1.0, -0.0625, 0.0625, 'k'); mb(o, -0.3125, 0.3125, 0.6875, 0.75, -0.25, 0.375, 'D');
      mb(o, -0.375, 0.375, 1.0, 1.125, -0.1875, 0.1875, 'R'); mb(o, -0.3125, 0.3125, 1.125, 1.1875, -0.0625, 0.0625, 'M');
      b0.group('b0', function () { b0.box(-1, 1, 0, 3, -1, 1, 'B'); }); b1.group('b1', function () { b1.box(-1, 1, 0, 3, -1, 1, 'B'); });
      return model('treetop_birdtable', { k: 'PX Tree Bark', D: 'PX Tree Plank', R: 'PX Tree Bark Trail', M: 'PX Tree Moss', B: 'PX Tree Flag' },
        [o, [b0, BT.b[0], true], [b1, BT.b[1], true]], { pivots: { b0: BT.b[0], b1: BT.b[1] }, anchors: { tray: BT.tray }, ao: false });
    },
    treetop_picnic: function () {
      var o = grid(G16), f = grid(G16), l = grid(G16);
      mb(o, -0.375, 0.375, 0, 0.125, -0.375, 0.375, 'D'); mb(o, -0.3125, 0.3125, 0.25, 0.5625, -0.1875, 0.1875, 'c');
      l.group('lid', function () { mb(l, 0.125, 0.3125, 0.5625, 0.75, -0.125, 0.0625, 'r'); });
      f.group('dishes', function () { mb(f, -0.25, 0.0625, 0.5625, 0.6875, -0.0625, 0.0625, 'e'); });
      return model('treetop_picnic', { D: 'PX Tree Plank', c: 'PX Tree Toadstool', r: 'PX Tree Rope', e: 'PX Cream' },
        [o, [l, null, true], [f, null, true]], { pivots: { lid: PN.lid, dishes: PN.dishes }, anchors: { seat: PN.seat }, ao: false });
    },
    treetop_xylophone: function () {
      var o = grid(G16), bars = VX().grid({ grid: [G32, G16, G32], origin: [0.5, 0, 0] }), pal = { k: 'PX Tree Bark' };
      mb(o, -0.375, 0.375, 0, 0.375, -0.1875, 0.1875, 'k'); mb(o, 0.3125, 0.375, 0, 0.8125, -0.375, -0.3125, 'k');
      XY.len.forEach(function (L, n) {
        var k0 = -Math.ceil(L / 2), cap = String(n + 1);
        pal[cap] = XY.caps[n];
        bars.group('k' + n, function () { bars.box(-11 + 5 * n, -9 + 5 * n, 6, 7, k0, k0 + L - 1, cap); });
      });
      var pivots = {};
      XY.x.forEach(function (x, n) { pivots['k' + n] = [x, XY.y, 0]; });
      return model('treetop_xylophone', pal, [o, [bars, null, true]], { pivots: pivots, anchors: { spot: XY.spot }, ao: false });
    },
    treetop_platform: function (st) {
      var v = variantOf(st, 'treetop_platform'), o = grid(G8), c = grid(G4, 0.5, 0.5);
      mb(o, -0.125, 0.125, 0, 2.125, -0.125, 0.125, 'k'); mb(o, -0.5, 0.5, 1.375, 1.5, -0.5, 0.5, 'D');
      c.group('sway', function () { c.box(-2, 2, 0, 0, -2, 2, v ? 'o' : 'g'); c.box(-1, 1, 1, 2, -1, 1, v ? 'O' : 'G'); });
      return model('treetop_platform', { k: 'PX Tree Bark', D: 'PX Tree Plank', g: 'PX Tree Pine', G: 'PX Tree Pine Mid', o: 'PX Tree Oak', O: 'PX Tree Oak Light' },
        [o, [c, [0, PT.sway[1], 0], true]], { pivots: { sway: PT.sway }, anchors: { deck: PT.deck }, ao: false });
    },
    treetop_pod: function (st) {
      var v = variantOf(st, 'treetop_pod'), o = grid(G8), h = grid(G16), q = grid(G16);
      mb(o, -0.125, 0.125, 0, 1.375, -0.125, 0.125, 'k'); mb(o, -0.375, 0.375, 1.375, 2.25, -0.375, 0.375, 'P'); mb(o, -0.25, 0.25, 2.25, 2.625, -0.25, 0.25, 'C');
      h.group('hatch', function () { mb(h, -0.1875, 0.1875, 1.75, 2.0, 0.375, 0.4375, 'H'); });
      q.group('pal', function () { mb(q, -0.0625, 0.0625, 1.75, 1.875, 0.3125, 0.375, 'q'); });
      return model('treetop_pod', { k: 'PX Tree Bark', P: 'PX Tree Plank', C: v ? 'PX Tree Oak' : 'PX Tree Pine Mid', H: 'PX Tree Bark Trail 2', q: 'PX Tree Autumn' },
        [o, [h, null, true], [q, null, true]], { pivots: { hatch: PD.hatch, pal: PD.pal }, anchors: { glow: PD.glow }, ao: false });
    }
  };

  var BUILD = { treetop_birdtable: birdtableVoxels, treetop_picnic: picnicVoxels, treetop_xylophone: xylophoneVoxels, treetop_platform: platformVoxels, treetop_pod: podVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st); };
    lod1[id] = function (st) { return LO[id](st); };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('treetop-c', K → {id: {voxels, lod1, act, forget, idle?, show?, lit?, animated?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], BD = {}, SV = {}, PO = {}, SW = {}, NOOPT = {}, PECK = {};
    var sway = (LOOKS.treetop_platform && LOOKS.treetop_platform.idle) || { deg: 1.72, period: 6.67 };
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
    function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
    /* the pet's part (the crew owns it: the feast sit on the bench, the nod at the xylophone, the hops up the tree) */
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
    /* per-copy memory (the hatch, the lamp level and halo, the next tune, when the hatch opened, a still
       idle): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, on: -1, lamp: -1, halo: false, tune: 0, openAt: 0, still: false }; memo.set(a.uid, m); }
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
       me), rest(a, reduced, me), at?(cue, out) → local point, cut? (own seconds), cues? (own list),
       opts?(a, me) (extra SLMotion options: the tune)}; opt {name (the timeline), off (a toggle played
       shut), quiet (the pet is not asked)} */
    function run(a, id, spec, opt) {
      opt = opt || NOOPT;
      var name = opt.name || ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, off = !!opt.off;
      var o = { reduced: reduced, off: off, from: prev && !reduced ? M.carry(prev.name, prev.out) : null };
      if (spec.opts) spec.opts(a, o);
      var own = spec.cues;
      var dur = reduced ? 0 : spec.cut || M.durOf(name, o), cues = !own ? M.cues(name, o) : reduced ? stillCues(own) : own;
      var ci = 0, done = false, uid = a.uid, me = { name: name, id: id, off: off, dur: dur, out: {}, mark: -1, o: o };
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
            if (c.emit) emit(h, c.emit, (c.emit !== 'sparkle' || dur > 0) && spec.at ? spec.at(c, me.out) || 'top' : 'top', c.n || 1);
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

    /* ---------- bird table: the two birds flutter down to the tray, peck three times and hop back up ---------- */
    function birdPose(a, n, bob, swing, t) {
      birdAt(n, bob, swing, t, BD);
      pose(a, 'b' + n, BD.rx, 0, 0, BD.x, BD.y, BD.z, BD.sx, 1, 1);
    }
    var feedSpec = {
      apply: function (a, out, t) {
        birdPose(a, 0, out.bob, out.swing, t);
        if (t > BT.lag) M.sample('feed', t - BT.lag, PECK, NOOPT); else PECK.swing = 0;
        birdPose(a, 1, out.bob, PECK.swing, t);
      },
      /* reduced motion: both birds on the tray, heads down; else back on the ridge */
      rest: function (a, reduced) { for (var n = 0; n < 2; n++) birdPose(a, n, reduced ? 1 : 0, reduced ? -1 : 0, 0); }
    };

    /* ---------- picnic deck: the lid flips, the food hops and pops, the pet sits down for a bite ---------- */
    var serveSpec = {
      cut: PN.cut, cues: PN.cues,
      apply: function (a, out, t) {
        serveAt(t, SV);
        pose(a, 'lid', -SV.lid, 0, 0, 0, 0, 0);
        pose(a, 'dishes', 0, 0, 0, 0, SV.hop, 0, SV.food, SV.food, SV.food);
      },
      rest: function (a) { rest(a, 'lid'); rest(a, 'dishes'); },
      at: function () { return [PN.dishes[0], PN.dishes[1] + 0.15, PN.dishes[2]]; }
    };

    /* ---------- log xylophone: the bars dip left to right, a note off each; three tunes in turn ---------- */
    var chimeSpec = {
      opts: function (a, o) { var m = mem(a); o.tune = m.tune % 3; m.tune = (m.tune + 1) % 3; },
      apply: function (a, out, t, me) {
        var n = barOf(t);
        for (var i = 0; i < 5; i++) {
          var d = i === n ? out.bob || 0 : 0;
          pose(a, 'k' + i, 0, 0, d ? -XY.tilt * d : 0, 0, -XY.dip * d, 0);
        }
        if (n >= 0 && n !== me.mark && t >= 0.25 + 0.5 * n) { me.mark = n; emit(a, 'note', [XY.x[n], XY.top + 0.1, 0], 1, { token: XY.caps[n] }); }
      },
      rest: function (a) { for (var i = 0; i < 5; i++) rest(a, 'k' + i); }
    };

    /* ---------- platform tree: the crown shivers as the pet hops up, two leaves fall ---------- */
    function crown(a, extra) {
      M.sway(+a.t || 0, sway.deg, sway.period, +a.phase || 0, !!a.reduced, SW);
      pose(a, 'sway', SW.x || 0, 0, (SW.z || 0) + extra, 0, 0, 0);
    }
    var climbSpec = {
      apply: function (a, out, t, me) {
        crown(a, -PT.jig * (out.bob || 0));
        if (me.mark < 0 && t >= PT.leafAt) { me.mark = 1; emit(a, 'leaf', PT.leaf, 2); }
      },
      rest: function (a) { crown(a, 0); }
    };
    function platformIdle(a) {
      if (!a || !M) return false;
      var m = mem(a);
      if (live.get(a.uid)) return true;                                   /* the act owns the crown */
      if (a.reduced) { if (m.still) return false; m.still = true; rest(a, 'sway'); return true; }
      m.still = false;
      crown(a, 0);
      return true;
    }

    /* ---------- tree pod: the hatch swings, the squirrel peeks out and looks about; the lamp at night ---------- */
    function podPose(a, k, turn) {
      podAt(k, PO);
      pose(a, 'hatch', 0, PO.hatch, 0, 0, 0, 0);
      pose(a, 'pal', -PD.tilt * PO.pal, PO.pal >= 1 ? turn || 0 : 0, 0, 0, PD.up * PO.pal, PD.out * PO.pal);
    }
    /* does the squirrel look about on this copy (an open hatch on the live island at MID / HIGH)? */
    function looks(a) { return !!shownOf(a) && !a.reduced && tierOf(a) !== 'LOW'; }
    /* the head turn the idle shows now (the act's own clock and the idle's agree: both count from the tap) */
    function turnOf(a) { return looks(a) ? lookAt(num(a.t) - mem(a).openAt) : 0; }
    var peekSpec = {
      apply: function (a, out, t, me) { podPose(a, out.k || 0, me.off || !looks(a) ? 0 : lookAt(t)); },
      rest: function (a, reduced, me) { podPose(a, me.off ? 0 : 1, me.off || reduced || !looks(a) ? 0 : lookAt(me.dur)); }
    };
    function lampApply(a, k) {
      var m = mem(a), lv = Math.round(100 * nightOf(k)) / 100, halo = lv > 0.5 && tierOf(a) !== 'LOW';
      if (lv !== m.lamp) { m.lamp = lv; setState(a, 'lamp', lv); }
      if (halo !== m.halo && typeof a.halo === 'function') { m.halo = halo; try { a.halo('glow', halo, PD.halo, 'Lamp Halo'); } catch (e) { /* fx is optional */ } }
    }
    function podAct(a, name) {
      if (!a) return null;
      var m = mem(a), on = wantOn(name, a.lit, shownOf(a));
      m.on = on;
      if (on) m.openAt = num(a.t);
      return run(a, 'treetop_pod', peekSpec, { off: !on, quiet: !on });
    }
    function podShow(a, k) {
      if (!a) return;
      lampApply(a, typeof k === 'number' ? k : num(a.show));
      if (!live.get(a.uid)) podPose(a, shownOf(a), turnOf(a));
    }
    function podLit(a, on) {
      if (!a) return;
      live.delete(a.uid);
      var m = mem(a);
      m.on = on ? 1 : 0; m.openAt = num(a.t);
      podPose(a, m.on, 0);
    }
    /* while the hatch is open the squirrel looks left and right now and then (MID / HIGH, never reduced) */
    function podIdle(a) {
      if (!a || !M) return false;
      var m = mem(a);
      if (live.get(a.uid)) return true;
      if (!looks(a)) {
        if (m.still) return false;
        m.still = true; podPose(a, shownOf(a), 0);
        return true;
      }
      m.still = false;
      podPose(a, 1, turnOf(a));
      return true;
    }

    var SPEC = { treetop_birdtable: feedSpec, treetop_picnic: serveSpec, treetop_xylophone: chimeSpec, treetop_platform: climbSpec }, out = {};
    IDS.forEach(function (id) {
      var h = { voxels: voxels[id], lod1: lod1[id], forget: forget };
      if (id === 'treetop_pod') { h.act = podAct; h.show = podShow; h.lit = podLit; h.idle = podIdle; h.animated = function () { return true; }; }
      else h.act = function (a) { return run(a, id, SPEC[id]); };
      out[id] = h;
    });
    out.treetop_platform.idle = platformIdle;
    out.treetop_platform.animated = function () { return true; };
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, VARIANTS: VARIANTS, ACT: ACT, PERFORM: PERFORM, TOGGLES: TOGGLES, HELPERS: HELPERS, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { birdtable: BT, picnic: PN, xylophone: XY, platform: PT, pod: PD },
    nightOf: nightOf, wantOn: wantOn, birdAt: birdAt, serveAt: serveAt, barOf: barOf, lookAt: lookAt, podAt: podAt
  };
}));
