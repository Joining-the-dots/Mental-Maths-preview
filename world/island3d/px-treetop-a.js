/* ================================================================
   My Island v3 — SLPxTreetopA (W3b.1): the Treetop Adventure Park's climbing rides in Pixel Blocks.
   window.SLPxTreetopA + SL3D.defineVox('treetop-a', factory) in the browser, module.exports in Node.
   Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the photocards and
   the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at the footprint
   centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u. Natural rope, timber and
   sky-blue flags (sky-world originality note): no harness or safety kit, no brand colours.
     treetop_climbwall  1×1  a plank wall with bark edge posts on an X-braced back frame, twenty
                        chunky holds in the five pixel accents (three big jugs under h1 … h3), a
                        top ledge with a rope rail ('top' is the pet's spot on it, its trail's end),
                        and a brass bell on 'bell' hung from an arm over the ledge. Act 'climb': the
                        pet hops up the jugs, the bell swings once and two notes float off it. A
                        bark-chip mat at the foot.
     treetop_telescope  1×1  a peeled pole with rope pegs on alternate sides, a stepped stave basket
                        (chunky rounded squares: the floor at 1.75 u, a rope rim at 2.125 u), four
                        posts and a stepped leaf roof (Pine Mid over Pine) with a blue pennant on
                        'pennant'; a brass telescope with a blue band and a pale lens lies side-on
                        along the +z rim and swivels on 'scope'. Act 'spy': one 60° sweep, then a
                        white bubble pops out of the roof showing the next sky island's icon
                        (ISLE_ORDER, one a tap: a fixed order, nothing collected). The bubble (helper
                        pivot 'bubble') is a cube with the five sky-island pictograms on five faces,
                        hidden inside the roof at rest; it grows, flattens into a card and turns the
                        right face to us.
     treetop_cargonet   2×1  two log A-frames whose legs cross over a top log, rope lashings, pennants
                        on the log ends, and a cream cargo net (0.25 u squares) draped down both sides
                        to the ground and over the log: the perCopy part 'copy_net', whose middle
                        vertices sag 0.1 u under the pet while it scrambles over.
     treetop_leap       2×1  four bark stumps with pale ring tops spiral up (0.375 · 0.6875 · 1.0625 ·
                        1.375 u) to a plank jump deck with one rope rail and a pennant pole; beside it a
                        big rounded heap of autumn leaves inside a low log kerb: the perCopy part
                        'copy_heap', which squashes 15 % when the pet lands (leaves puff on MID / HIGH).
     treetop_bigslide   2×2  a pine-trunk tower (back-left) with a plank deck at 2.25 u, a rope rail, a
                        stepped pine crown that overhangs the back corner, and a ladder down its front;
                        a wide sky-blue slide with white rails leaves along the back, bumps twice,
                        curves round the right side and drops into a bark-chip pit whose chips hop on
                        the helper pivot 'chips'. Anchors ladderFoot, deck, s0 … s5, pit.
     treetop_zipline    3×1  a square timber tower (bark posts, X-braces, a plank deck at 1.75 u, a
                        stepped plank gable roof, a ladder up its front, a pennant on 'pennant'); a
                        rope line slopes from 2.44 u across the next two cells to a stout landing post
                        on a bark-chip pad; the red T-handle and its pulley ride 'handle' (grip ⊂
                        handle). Act 'zipline' (2.5 s): the handle runs down the line with the pet
                        and reels back up empty. Half the Lookout's height: clearly the smaller one.
   HEIGHTS (D48): every 'any' item ≤ 2.9 u. A pet stands about 0.75 u tall, so the decks that carry
   a roof sit low enough for its head (telescope pod 1.75 u, zip deck 1.75 u: the line still starts
   at 2.44 u, so the pet hangs from the handle level with the deck); the slide's deck keeps 2.25 u
   because its crown stands behind the pet.
   GRAIN (D11): frames, decks, holds, pegs and the heap G8; the crown and roofs G8 tiers; the stumps
   and the slide G8 across and G16 tall (a smooth drop); ropes, the net, the scope, the bell,
   pennants, the handle, the bubble and the chips G16. No corner AO (as the pier's rides).
   LOW (D89 / D106): detail voxels are tagged lod 'mid' (braces, the bell's glint, toadstools, moss,
   loose leaves and chips, the back net's cross strands); every id brings its own lod1 (its plain
   masses, halved; the net a plain sheet) inside TRIS_CAPS_LOD1.
   ACTS run on SLMotion timelines by name: climb · spy · scramble · leap · slide · zipline (≤ 3 s).
   One live act per uid (a re-tap supersedes); the end pose is the rest pose, except that the
   telescope's bubble stays up for BUBBLE.hold s and then sinks (idle); reduced motion = the end
   state at once with the same sounds and one sparkle (the bubble shown). The pet's part is
   a.pets.perform(LOOK perform kind, uid). Rates: bell 1.25 Hz, pennants ≤ 1 Hz, nothing flashes,
   no light at all. No word (the bubble's faces are pictograms), no star, no flame; nothing here
   reads, awards or spends points.
   HANDLE used: a.uid a.t a.reduced a.batch a.object a.template a.isle? · a.pivot(name).set(rotDeg[3],
   pos[3], scale[3]) · a.copyGeometry(part) · a.basePositions(part) · a.emit(kind, localPos, n, opts)
   · a.sfx(name, vol, step) · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxTreetopA = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('treetop-a', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxTreetopA: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }
  function core() { return sibling('SLWorldCore', '../world-core.js'); }

  var VERSION = 1;
  var IDS = ['treetop_climbwall', 'treetop_telescope', 'treetop_cargonet', 'treetop_leap', 'treetop_bigslide', 'treetop_zipline'];
  var G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { treetop_climbwall: 'climb', treetop_telescope: 'spy', treetop_cargonet: 'scramble', treetop_leap: 'leap', treetop_bigslide: 'slide', treetop_zipline: 'zipline' };
  var PERFORM = { treetop_climbwall: 'trail:hop', treetop_telescope: 'trail:hop', treetop_cargonet: 'trail:hop', treetop_leap: 'trail:jump',
                  treetop_bigslide: 'slide', treetop_zipline: 'trail:hang' };
  /* pivots beyond the lookEntries lists (the pop-up bubble, the pit's chips) and the perCopy parts */
  var HELPERS = { treetop_telescope: ['bubble'], treetop_bigslide: ['chips'] };
  var COPY = { treetop_cargonet: 'copy_net', treetop_leap: 'copy_heap' };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];
  var SKY = ['pier', 'jungle', 'treetop', 'castle', 'ice'];

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  /* climbing wall: the jugs under h1 … h3 [i0 (two wide), j, accent], the single holds [i, j, accent] (G8, on the face k 0) */
  var CW = {
    jugs: [[-2, 4, '1'], [0, 9, '3'], [-2, 14, '4']],
    holds: [[-1, 1, '2'], [1, 2, '5'], [0, 3, '4'], [-2, 2, '3'], [1, 5, '2'], [-1, 6, '3'], [0, 7, '5'], [-2, 9, '5'], [1, 11, '1'], [-1, 11, '4'],
            [0, 12, '2'], [-1, 9, '1'], [1, 14, '5'], [0, 16, '3'], [-2, 17, '2'], [1, 17, '1'], [-1, 17, '4']],
    bell: [0.3125, 2.75, 0.0625], deg: 28, foot: [0, 0.0625, 0.25], top: [-0.125, 2.375, 0.0625], noteAt: 2.75, note: [0.3125, 2.5, 0.125]
  };
  /* telescope: the swivel, the sweep (camp-style: to the left, one 60° sweep, home), the bubble (its
     centre at rest inside the roof; it rises, grows and turns face n of BUBBLE.faces to us) */
  var TS = { scope: [0, 2.25, 0.4375], sweep: 60, pre: [0.6, 1.1], post: [2.4, 2.9], pennant: [-0.34375, 2.8125, 0.34375], flap: 14, flapHz: 0.8,
             foot: [0, 0, 0.3125], pod: [-0.125, 1.75, 0] };
  var BUBBLE = { at: [0, 2.6875, 0], lift: 0.62, grow: 2.4, pop: [2.3, 2.55], hold: 1.6, sink: 0.3, puff: [0, 2.4, 0.5],
                 /* face n shows SKY[n]: [rx, ry] that turns it to +z; the decal faces in the same order */
                 faces: [[0, 0], [0, -90], [0, 180], [0, 90], [90, 0]], decal: ['+z', '+x', '-z', '-x', '+y'], axis: [2, 0, 2, 0, 1], card: 0.2 };
  /* cargo net: the panels [row0, row1, z G16 index] down the front (the back mirrors), the strands, the sag */
  var CN = {
    panels: [[0, 13, 4], [14, 27, 3]], cols: [-8, -4, 0, 4, 8], rows: [2, 6, 10, 14, 18, 22, 26], half: 9, dip: [1, 1, 1, 1, 1],
    sag: 0.1, pull: 0.06, span: [0.6, 1.75], frontFoot: [0, 0, 0.5], ridge: [0, 1.75, 0], backFoot: [0, 0, -0.5]
  };
  /* leaf pile: the stumps [i0, k0 (two G8 across), rows of G16], the deck, the heap (G8) and its squash */
  var LP = {
    stumps: [[-7, 1, 6], [-7, -3, 11], [-4, -3, 17], [-4, 1, 20]], heap: { ci: 3, ri: 3.4, rj: 5, rk: 2.9 }, centre: [0.4375, 0, 0],
    squash: 0.15, widen: 0.06, pennant: [-0.5, 1.78125, 0.0625], flagAt: 1.15, flap: 16, puff: [0.4375, 0.5, 0],
    anchors: { st0: [-0.75, 0.375, 0.25], st1: [-0.75, 0.6875, -0.25], st2: [-0.375, 1.0625, -0.25], st3: [-0.375, 1.375, 0.25],
               deck: [0, 1.375, 0.1875], heap: [0.4375, 0.3125, 0] }
  };
  /* giant slide (G8 across, G16 tall): the bed's top G16 row at path step s (0 by the deck … 13 at the
     lip), with two humps: a steep wavy drop along the back (seen side-on), `turn` steps across the
     corner square, then a gentle run-out down the right side to the lip over the pit. [x0, x1, z0, z1]
     are G8 cells; s0 … s5 are the steps in `stops`; stilts [G8 i, k] stand under the rails */
  var BS = {
    prof: [31, 29, 27, 28, 25, 23, 21, 19, 17, 15, 16, 13, 11, 9], turn: 4,
    back: [-1, 2, -6, -4], corner: [3, 5, -6, -4], right: [3, 5, -3, 2], stops: [0, 3, 5, 8, 10, 13], stilts: [[6, -7], [6, -2], [2, 1], [0, -7]],
    pit: [0.5, 0.125, 0.625], deck: [-0.1875, 2.25, -0.1875], ladderFoot: [-0.5625, 0, 0.125], hop: 0.0625, landAt: 2.5
  };
  /* zip line: the rope from the tower post to the landing post; the handle rests at u0, rides to u1 */
  var ZL = {
    from: [-0.6875, 2.4375, 0], to: [1.1875, 1.0625, 0], u0: 0.1, u1: 0.83, back: [2.1, 2.45], grip: 0.3125, pennant: [-1.34375, 2.8125, -0.34375], flap: 14,
    ladderFoot: [-1.0, 0, 0.5], deck: [-0.8125, 1.75, 0], landing: [0.6875, 0.0625, 0.125], landAt: 2.05
  };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function snap(v) { return Math.round(v / G16) * G16; }
  /* the spyglass's yaw (degrees) for the spy timeline's k at t: back to the left, one sweep to the right, home */
  function scopeDeg(k, t) { return TS.sweep * ((k || 0) - 0.5 * smooth(TS.pre[0], TS.pre[1], t) - 0.5 * smooth(TS.post[0], TS.post[1], t)); }
  /* the n-th sighting (0, 1, …) from island `isle`: the sky islands after it in ISLE_ORDER, in turn */
  function sightOf(isle, n) {
    var C = core(), order = (C && C.ISLE_ORDER) || ['home'].concat(SKY), sky = order.filter(function (s) { return SKY.indexOf(s) >= 0; });
    var at = sky.indexOf(isle), k = ((at + 1 + (n | 0)) % sky.length + sky.length) % sky.length;
    return sky[k];
  }
  /* the bubble's pop for a 0 → 1 level: rises and grows with a soft overshoot (≤ 8 %) */
  function popOf(v) { var u = clamp01(v), c = 1.2; return u <= 0 ? 0 : u >= 1 ? 1 : 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
  /* a point on the zip line at u (0 the tower post … 1 the landing post), snapped to G16 */
  function lineAt(u) { var a = ZL.from, b = ZL.to; return [snap(a[0] + (b[0] - a[0]) * u), snap(a[1] + (b[1] - a[1]) * u), 0]; }
  /* how far the handle has run (0 at rest by the tower … 1 at u1) at k and t: down with k, reeled back after ZL.back */
  function zipRun(k, t) { return (k || 0) * (1 - smooth(ZL.back[0], ZL.back[1], t)); }
  /* the net's sag weight at a rest vertex: 0 on the frame, the pegs and the log, 1 in the middle of a side */
  function sagWeight(x, y, z) {
    var u = clamp01((x + CN.span[0]) / (2 * CN.span[0])), v = clamp01(y / CN.span[1]);
    return Math.abs(z) < 0.125 ? 0 : Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  }
  /* the slide's path step at G8 cell (x, z), or −1 off the bed */
  function slideStep(x, z) {
    var b = BS.back, c = BS.corner, r = BS.right;
    if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]) return x - b[0];
    if (x >= c[0] && x <= c[1] && z >= c[2] && z <= c[3]) return b[1] - b[0] + 1 + Math.floor((x - c[0] + z - c[2]) * (BS.turn - 1) / (c[1] - c[0] + c[3] - c[2]));
    if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return BS.prof.length - 1 - (r[3] - z);
    return -1;
  }
  /* the anchors s0 … s5 on the slide bed (its top, mid-width) */
  function slideStops() {
    var b = BS.back, c = BS.corner, r = BS.right, mid = function (a, z) { return (a + z + 1) * G8 / 2; };
    return BS.stops.map(function (s) {
      var y = (BS.prof[s] + 1) * G16, n = b[1] - b[0] + 1;
      if (s < n) return [(b[0] + s + 0.5) * G8, y, mid(b[2], b[3])];
      if (s < n + BS.turn) return [mid(c[0], c[1]), y, mid(c[2], c[3])];
      return [mid(r[0], r[1]), y, (r[3] - (BS.prof.length - 1 - s) + 0.5) * G8];
    });
  }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox || 0, 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (empty grids are left out); o.pivots {name: [x, y, z]},
     o.anchors {name: [x, y, z, pivot?]} in item metres. No corner AO (as the pier's rides and the
     landmarks): on holds, staves, ropes and nets it only splits quads */
  function model(id, pal, layers, o) {
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l) {
      var g = Array.isArray(l) ? l[0] : l, n = m.layers.length;
      if (!g.count) return;
      m.layers.push(Array.isArray(l) ? { vox: g.snapshot(), at: l[1] } : { vox: g.snapshot() });
      g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { m.pivots[n] = { at: U(o.pivots[n]), parent: null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('bBp', {…}) picks from it. The digits are the five pixel accents;
     the lower-case MID twins below them are lod 'mid' (tier LOW drops them, D89) */
  var LEAF = 'leaf', MID = 'mid';
  var INK = {
    b: 'PX Tree Bark', B: 'PX Tree Bark Trail', c: 'PX Tree Bark Trail 2', p: { token: 'PX Tree Plank', mode: 'plank' }, P: 'PX Tree Plank',
    r: 'PX Tree Rope', n: 'PX Tree Net', g: { token: 'PX Tree Pine', mode: LEAF }, G: { token: 'PX Tree Pine Mid', mode: LEAF },
    h: { token: 'PX Tree Pine Light', mode: LEAF }, m: 'PX Tree Moss', t: 'PX Tree Toadstool', a: 'PX Tree Autumn', f: 'PX Tree Flag',
    y: 'PX Sunny', s: 'PX Sky Blue', w: 'Cloud White', e: 'PX Ink Eye', L: 'PX Lens Pale',
    1: 'PX Accent 1', 2: 'PX Accent 2', 3: 'PX Accent 3', 4: 'PX Accent 4', 5: 'PX Accent 5',
    x: { token: 'PX Tree Bark', lod: MID }, v: { token: 'PX Tree Moss', lod: MID }, q: { token: 'PX Tree Toadstool', lod: MID },
    u: { token: 'Cloud White', lod: MID }, z: { token: 'PX Tree Autumn', lod: MID }, k: { token: 'PX Tree Bark Trail 2', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  /* a deterministic speckle (bark chips, leaves): 0 … 1 per voxel (no Math.random anywhere) */
  function speck(i, j, k) { var h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x5bd1e995); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; }
  /* a bark-chip pad on G16: a plain Bark Trail bed with MID / HIGH loose chips (light and dark) on top;
     keep(i, k) leaves cells out (round pads, posts) */
  function chipPad(g, i0, i1, k0, k1, lite, keep) {
    g.box(i0, i1, 0, 0, k0, k1, function (i, j, k) { return keep && !keep(i, k) ? null : 'B'; });
    if (!lite) g.box(i0, i1, 1, 1, k0, k1, function (i, j, k) { var v = speck(i, 7, k); return (keep && !keep(i, k)) || v > 0.2 ? null : v < 0.1 ? 'k' : 'x'; });
  }
  /* MID / HIGH decor on G16: a toadstool (white stem, red cap with a white dot) and a moss tuft */
  function toad(g, i, k, h) {
    g.box(i, i, 0, h - 1, k, k, 'u').box(i - 1, i + 1, h, h, k - 1, k + 1, 'q').set(i, h + 1, k, 'q').set(i + 1, h, k + 1, 'u');
  }
  function moss(g, i, k) { g.box(i, i + 2, 0, 0, k, k + 1, 'v').set(i + 1, 1, k, 'v'); }
  /* a rounded square about the pivot column (even grid: voxels −half … half − 1, the four corners off),
     with a square hole of hole voxels each side when given: chunky tiers whose sides merge into few quads */
  function rsq(g, j, half, c, hole) {
    g.box(-half, half - 1, j, j, -half, half - 1, function (i, jj, k) {
      if ((i === -half || i === half - 1) && (k === -half || k === half - 1)) return null;
      if (hole && i >= -hole && i < hole && k >= -hole && k < hole) return null;
      return typeof c === 'function' ? c(i, jj, k) : c;
    });
  }

  /* ---------------- treetop_climbwall ---------------- */
  function climbwallVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), bell = grid(G16, 0.5, 0.5), f = grid(G16), j;
    /* the wall: bark edge posts, a plank face (0.75 × 2.25 u); the back posts, side rails and X-braces */
    o.box(-3, 2, 0, 17, -1, -1, function (i) { return i === -3 || i === 2 ? 'b' : 'p'; });
    [-3, 2].forEach(function (i) { o.box(i, i, 0, i === 2 ? 22 : 20, -3, -3, 'b'); [0, 9, 17].forEach(function (jj) { o.set(i, jj, -2, 'b'); }); });
    if (!lite) [[1, 8], [10, 16]].forEach(function (s) { o.line([-2, s[0], -3], [1, s[1], -3], 'x').line([1, s[0], -3], [-2, s[1], -3], 'x'); });
    /* the holds: three jugs (two wide, two deep) the pet stands on, seventeen single holds */
    CW.jugs.forEach(function (h) { o.box(h[0], h[0] + 1, h[1], h[1], 0, 1, h[2]); });
    if (!lite) CW.holds.forEach(function (h) { o.set(h[0], h[1], 0, h[2]); });
    /* the top ledge, its rope rail (left and back), the bell arm off the back-right post */
    o.box(-3, 2, 18, 18, -3, 1, 'p');
    o.box(-3, -3, 19, 20, 1, 1, 'b').box(-3, -3, 20, 20, -2, 0, 'r').box(-2, 1, 20, 20, -3, -3, 'r');
    o.box(2, 2, 22, 22, -2, 0, 'b');
    /* the brass bell (G16, centred on the hook): a knob, a waisted body, a rim band and a glint */
    bell.group('bell', function () {
      bell.box(-2, 2, 0, 1, -2, 2, function (i, j, k) { return Math.abs(i) === 2 && Math.abs(k) === 2 ? null : j ? 'y' : 'a'; });
      bell.box(-1, 1, 2, 3, -1, 1, 'y').set(0, 4, 0, 'b');
      if (!lite) bell.set(-1, 1, 2, 'u');
    });
    /* the bark-chip mat at the foot and a toadstool by it */
    chipPad(f, -6, 5, 0, 5, lite, function (i, k) { return !((i === -6 || i === 5) && k === 5); });
    if (!lite) { toad(f, -5, 4, 2); moss(f, 3, 4); }
    var anchors = { foot: CW.foot, top: CW.top };
    CW.jugs.forEach(function (h, n) { anchors['h' + (n + 1)] = [(h[0] + 1) * G8, (h[1] + 1) * G8, 0.1875]; });
    return model('treetop_climbwall', pal('bBcprayu12345xvqk'), [o, [bell, [CW.bell[0], CW.bell[1] - 5 * G16, CW.bell[2]]], f],
      { pivots: { bell: CW.bell }, anchors: anchors });
  }

  /* ---------------- treetop_telescope ---------------- */
  function staves(i, j, k) { return (i + k) & 1 ? 'p' : 'B'; }
  function telescopeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), s = grid(G16, 0.5, 0.5), fl = grid(G16), bb = grid(G16), f = grid(G16), n;
    /* the peeled pole on a root flare, rope pegs on alternate sides */
    if (lite) o.box(-2, 1, 0, 10, -2, 1, 'P');                           /* the halved model keeps a pole */
    else o.box(-1, 0, 0, 10, -1, 0, function (i, j) { return j === 4 || j === 8 ? 'c' : 'P'; });
    [[-2, -1], [-2, 0], [1, -1], [1, 0], [-1, -2], [0, -2], [-1, 1], [0, 1]].forEach(function (c) { o.set(c[0], 0, c[1], 'b'); });
    [[1, 2], [-2, 5], [1, 8]].forEach(function (p) { o.set(p[0], p[1], 0, 'r'); });
    /* the pod: a stepped bowl, the floor (top 1.75 u), two rows of staves and a rope rim */
    rsq(o, 11, 2, 'B'); rsq(o, 12, 3, 'p'); rsq(o, 13, 4, 'p');
    rsq(o, 14, 4, lite ? 'p' : staves, 3); rsq(o, 15, 4, lite ? 'p' : staves, 3); rsq(o, 16, 4, 'r', 3);
    /* four posts in the basket's corners and the stepped leaf roof (Pine eaves, Pine Mid, a Pine Light cap) */
    [[-3, -3], [2, -3], [-3, 2], [2, 2]].forEach(function (c) { o.box(c[0], c[0], 14, 19, c[1], c[1], 'b'); });
    rsq(o, 20, 4, 'g'); rsq(o, 21, 3, 'G'); rsq(o, 22, 2, 'h');
    /* the pennant on the front-left eave */
    fl.box(0, 0, 0, 3, 0, 0, 'b');
    fl.group('pennant', function () { fl.box(-3, -1, 2, 3, 0, 0, 'f').set(-4, 3, 0, 'f'); });
    /* the brass telescope on its swivel, side-on along the front rim under the eaves: an eyepiece, a blue
       band, a hood and a pale lens */
    s.box(0, 0, 0, 1, 0, 0, 'b');
    s.group('scope', function () {
      s.box(-4, 3, 2, 4, -1, 1, function (i) { return i === -4 ? 'B' : i === -1 ? 'f' : 'y'; });
      s.box(4, 4, 1, 5, -2, 2, function (i, j, k) { return Math.abs(k) === 2 && (j === 1 || j === 5) ? null : 'y'; }).box(5, 5, 2, 4, -1, 1, 'L');
    });
    /* the bubble: a white cube with the five sky-island pictograms, hidden in the roof at rest */
    if (!lite) {
      bb.group('bubble', function () { bb.box(-2, 1, 0, 3, -2, 1, 'w'); });
      var at = { '+z': [-2, 0, 1], '+x': [1, 0, -2], '-z': [-2, 0, -2], '-x': [-2, 0, -2], '+y': [-2, 3, -2] };
      for (n = 0; n < SKY.length; n++) bb.decal(BUBBLE.decal[n], at[BUBBLE.decal[n]], [4, 4], 'isle:' + SKY[n]);
      toad(f, -5, 4, 3); moss(f, 2, 3);
    }
    var piv = { scope: TS.scope, pennant: TS.pennant };
    if (!lite) piv.bubble = BUBBLE.at;
    return model('treetop_telescope', pal('bBcpPrgGhfyLwuqv'), [o, [s, [0, 2.125, TS.scope[2]]], [fl, [-0.375, 2.625, 0.3125]], [bb, [0, BUBBLE.at[1] - 2 * G16, 0]], f],
      { pivots: piv, anchors: { foot: TS.foot, pod: TS.pod } });
  }

  /* ---------------- treetop_cargonet ---------------- */
  function netZ(row) { for (var n = 0; n < CN.panels.length; n++) if (row <= CN.panels[n][1]) return CN.panels[n][2]; return CN.panels[CN.panels.length - 1][2]; }
  function cargonetVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), net = grid(G16, 0.5, 0), fl = grid(G16, 0.5, 0.5), f = grid(G16), j;
    /* two A-frames: the legs lean in from z ±0.25 and cross over the top log (a rope lashing at the cross) */
    [-7, 5].forEach(function (i) {
      for (j = 0; j <= 15; j++) {
        var kf = j < 5 ? 1 : j < 10 ? 0 : j < 14 ? -1 : -2, c = j >= 12 && j <= 13 && !lite ? 'r' : 'b';
        o.box(i, i + 1, j, j, kf, kf + 1, c).box(i, i + 1, j, j, -kf - 2, -kf - 1, c);
      }
    });
    o.box(-8, 7, 12, 13, -1, 0, function (i) { return i === -8 || i === 7 ? 'c' : 'b'; });
    /* the pennants on the log ends */
    [[-8, 1], [7, -1]].forEach(function (e) {
      var x = (e[0] + 0.5) * 2;
      fl.box(x, x, 0, 6, 0, 0, 'b').box(x + e[1], x + 3 * e[1], 4, 6, 0, 0, 'f').set(x + 4 * e[1], 6, 0, 'f');
    });
    /* the net (all on the perCopy part 'net'): vertical strands down each side, a step further out on
       the lower panel, with the horizontal strands woven one voxel outside them every 0.25 u, ground
       stakes, and the strands over the log. The back's horizontals are MID / HIGH detail; the lod1
       model hangs a plain sheet per panel instead */
    var top = CN.panels[CN.panels.length - 1];
    [1, -1].forEach(function (side) {
      function kz(row, out) { var k = netZ(row) + (out ? 1 : 0); return side > 0 ? k : -k - 1; }
      if (lite) { CN.panels.forEach(function (pn) { net.box(-CN.half, CN.half, pn[0], pn[1], kz(pn[0]), kz(pn[0]), 'n'); }); return; }
      CN.cols.forEach(function (c) {
        for (var r = 0; r <= top[1]; r++) { net.set(c, r, kz(r), 'R'); if (r && kz(r) !== kz(r - 1)) net.set(c, r, kz(r - 1), 'R'); }
        net.box(c, c, 0, 2, kz(0, true), kz(0, true), 'x');
      });
      CN.rows.forEach(function (r) {                    /* each strand sags in a soft curve between the A-frames */
        for (var i = -CN.half; i <= CN.half; i++) {
          var d = CN.dip[Math.abs(i)] || 0, e = CN.dip[Math.abs(i) + (i < 0 ? -1 : 1)] || 0;
          net.box(i, i, r - Math.max(d, i ? e : d), r - Math.min(d, i ? e : d), kz(r, true), kz(r, true), side > 0 ? 'n' : 'N');
        }
      });
    });
    CN.cols.forEach(function (c) { net.box(c, c, top[1] + 1, top[1] + 1, -top[2] - 1, top[2], 'R'); });
    if (!lite) { toad(f, -3, 2, 2); moss(f, 1, -4); }
    return model('treetop_cargonet', pal('bcrfuqvx', { n: { token: 'PX Tree Net', copy: 'net' }, N: { token: 'PX Tree Net', copy: 'net', lod: MID }, R: { token: 'PX Tree Rope', copy: 'net' } }),
      [o, net, [fl, [0, 1.75, 0]], f], { anchors: { frontFoot: CN.frontFoot, ridge: CN.ridge, backFoot: CN.backFoot } });
  }

  /* ---------------- treetop_leap ---------------- */
  function leafOf(i, j, k) { var v = speck(i, j, k); return v < 0.58 ? 'A' : v < 0.72 ? 'T' : v < 0.86 ? 'Y' : 'O'; }
  function leapVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), sp = VX().grid({ grid: [G8, G16, G8], origin: [0, 0, 0] }), fl = grid(G16), heap = grid(G8), f = grid(G16), H = LP.heap;
    /* four stumps (G8 across, G16 tall) with a dark band and pale ring tops, spiralling up to the deck */
    LP.stumps.forEach(function (s, n) {
      var top = s[2] - 1;
      sp.box(s[0], s[0] + 1, 0, top, s[1], s[1] + 1, function (i, j) { return j < top || n === 3 ? (!lite && j === top - 2 ? 'b' : 'B') : 'c'; });
    });
    /* the jump deck (top 1.375 u) over the last stump, a post, one rope rail and the pennant pole */
    o.box(-4, 0, 10, 10, 0, 2, 'p').box(-1, -1, 0, 9, 0, 0, 'b');
    o.box(-4, -4, 11, 14, 0, 0, 'b').box(0, 0, 11, 12, 0, 0, 'b').box(-3, -1, 12, 12, 0, 0, 'r');
    fl.group('pennant', function () { fl.box(-3, -1, 0, 1, 0, 0, 'f').set(-4, 1, 0, 'f'); });
    /* the leaf heap (a rounded blob, all on the perCopy part 'heap') inside a low log kerb */
    heap.blob(H.ci, -0.5, -0.5, H.ri, H.rj, H.rk, function (i, j, k) { return j < 0 ? null : lite ? 'A' : leafOf(i, j, k); }, 2.5);
    o.box(0, 6, 0, 0, -3, -3, 'b').box(0, 6, 0, 0, 2, 2, 'b').box(6, 6, 0, 0, -2, 1, 'b').box(0, 0, 0, 0, -2, 1, 'b');
    [[0, -3], [6, -3], [0, 2], [6, 2]].forEach(function (c) { o.set(c[0], 0, c[1], 'c'); });
    if (!lite) {
      [[-9, 5], [-2, 5], [-1, -6], [-9, -2], [-3, 1]].forEach(function (c, n) { f.set(c[0], 0, c[1], n & 1 ? 'q' : 'z'); });
      toad(f, -7, -1, 2); moss(f, -12, -1);
    }
    return model('treetop_leap', pal('bBcprfuqvz', {
      A: { token: 'PX Tree Autumn', mode: LEAF, copy: 'heap' }, T: { token: 'PX Tree Toadstool', mode: LEAF, copy: 'heap' },
      Y: { token: 'PX Sunny', mode: LEAF, copy: 'heap' }, O: { token: 'PX Tree Oak Light', mode: LEAF, copy: 'heap' }
    }), [o, sp, [fl, [LP.pennant[0], 1.6875, LP.pennant[2] - G16 / 2]], heap, f], { pivots: { pennant: LP.pennant }, anchors: LP.anchors });
  }

  /* ---------------- treetop_bigslide ---------------- */
  function bigslideVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), cr = grid(G8), sl = VX().grid({ grid: [G8, G16, G8], origin: [0, 0, 0] }), pit = grid(G16), f = grid(G16), j;
    /* the tower: a pine trunk at the back corner, three posts, the deck (top 2.25 u), a rope rail */
    o.box(-7, -6, 0, 19, -7, -6, function (i, jj) { return !lite && jj % 5 === 2 ? 'B' : 'b'; });
    [[-2, -7], [-7, -2], [-2, -2]].forEach(function (p) { o.box(p[0], p[0], 0, p[0] === -2 && p[1] === -7 ? 19 : 16, p[1], p[1], 'B'); });
    o.box(-7, -2, 17, 17, -7, -2, 'p');
    o.box(-7, -7, 18, 19, -2, -2, 'B').box(-5, -3, 19, 19, -7, -7, 'r').box(-7, -7, 19, 19, -5, -3, 'r');
    /* the ladder down the front (its rails stand clear of the deck as handles) */
    [-6, -3].forEach(function (i) { o.box(i, i, 0, 18, -1, -1, 'B'); });
    for (j = 1; j <= 16; j += 2) o.box(-5, -4, j, j, -1, -1, 'r');
    /* the stepped pine crown over the trunk (it overhangs the back corner): Pine / Pine Light stripes */
    [[19, 3, 'g'], [20, 3, 'h'], [21, 2, 'g'], [22, 1, 'h']].forEach(function (t) {
      cr.box(-t[1], t[1] - 1, t[0], t[0], -t[1], t[1] - 1, function (i, jj, k) { return (i === -t[1] || i === t[1] - 1) && (k === -t[1] || k === t[1] - 1) && t[1] > 1 ? null : t[2]; });
    });
    /* the slide: a sky-blue bed three wide and two rows thick between white rails that stand two rows
       over it, step by step from the deck along the back, across the corner and down to the lip */
    var x, z, q, lo, hi;
    for (x = BS.back[0]; x <= BS.right[1] + 1; x++) for (z = BS.back[2] - 1; z <= BS.right[3]; z++) {
      q = slideStep(x, z);
      if (q >= 0) { sl.box(x, x, BS.prof[q] - 1, BS.prof[q], z, z, 's'); continue; }
      /* a rail cell takes the height of the bed beside it (across the width; a corner post, the corner) */
      lo = 99; hi = -1;
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d, n) {
        var n2 = slideStep(x + d[0], z + d[1]);
        if (n2 >= 0 && (n < 4 || hi < 0)) { lo = Math.min(lo, BS.prof[n2]); hi = Math.max(hi, BS.prof[n2]); }
      });
      if (hi >= 0) sl.box(x, x, lo - 1, hi + 1, z, z, 'w');
    }
    /* stilts (G8) under the rails, each up to the first voxel over it */
    BS.stilts.forEach(function (p) {
      for (var r = 0; r < 40 && !sl.has(p[0], r, p[1]); r++);
      o.box(p[0], p[0], 0, Math.floor((r - 2) / 2), p[1], p[1], 'b');
    });
    /* the bark-chip pit (a log kerb round chips on 'chips': a plain bed, MID / HIGH loose chips on it) */
    o.box(1, 6, 0, 0, 3, 3, 'b').box(1, 6, 0, 0, 6, 6, 'b').box(1, 1, 0, 0, 4, 5, 'b').box(6, 6, 0, 0, 4, 5, 'b');
    pit.group('chips', function () { chipPad(pit, 4, 11, 8, 11, lite); });
    if (!lite) { toad(f, -12, 2, 2); toad(f, 12, -10, 3); moss(f, -3, 2); moss(f, 9, -14); }
    var anchors = { ladderFoot: BS.ladderFoot, deck: BS.deck, pit: BS.pit };
    slideStops().forEach(function (p, q) { anchors['s' + q] = p; });
    return model('treetop_bigslide', pal('bBcprghswuqvkx'), [o, [cr, [-0.75, 0, -0.75]], sl, pit, f], { pivots: { chips: [0.5, 0.0625, 0.625] }, anchors: anchors });
  }

  /* ---------------- treetop_zipline ---------------- */
  function ziplineVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), line = grid(G16, 0.5, 0.5), h = grid(G16, 0.5, 0.5), fl = grid(G16), f = grid(G16), j;
    /* the tower: four bark posts, X-braces on the side and the back, the deck (top 1.75 u), rails */
    [[-11, -3], [-6, -3], [-11, 2], [-6, 2]].forEach(function (p) { o.box(p[0], p[0] + (lite ? (p[0] < -8 ? 1 : -1) : 0), 0, 19, p[1], p[1] + (lite ? (p[1] < 0 ? 1 : -1) : 0), 'b'); });
    if (!lite) {
      [[1, 6], [7, 12]].forEach(function (s) {
        o.line([-11, s[0], -2], [-11, s[1], 1], 'x').line([-11, s[0], 1], [-11, s[1], -2], 'x');
        o.line([-10, s[0], -3], [-7, s[1], -3], 'x').line([-7, s[0], -3], [-10, s[1], -3], 'x');
      });
    }
    o.box(-11, -6, 13, 13, -3, 2, 'p').box(-9, -8, 13, 13, 2, 2, null);
    o.box(-10, -7, 15, 15, -3, -3, 'r').box(-11, -11, 15, 15, -2, 1, 'r');
    /* the ladder up the front, through a gap in the deck */
    [-10, -7].forEach(function (i) { o.box(i, i, 0, 15, 2, 2, 'b'); });
    for (j = 1; j <= 13; j += 2) o.box(-9, -8, j, j, 2, 2, 'r');
    /* the stepped plank gable roof (ridge front to back) */
    if (lite) o.box(-11, -6, 20, 21, -3, 2, 'p');                           /* eaves off: the halved posts line up */
    else o.box(-12, -5, 20, 20, -4, 3, 'p').box(-10, -7, 21, 21, -4, 3, function (i) { return i === -10 || i === -7 ? 'p' : 'B'; });
    /* the pennant on the back-left post, above the eaves */
    fl.box(0, 0, 0, 3, 0, 0, 'b');
    fl.group('pennant', function () { fl.box(1, 3, 2, 3, 0, 0, 'f').set(4, 3, 0, 'f'); });
    /* the zip line (G16, from the tower post to the landing post) and the stout landing post on its pad */
    line.line([ZL.from[0] / G16, Math.floor(ZL.from[1] / G16), 0], [ZL.to[0] / G16, Math.floor(ZL.to[1] / G16), 0], 'r');
    o.box(8, 9, 0, 8, -1, 0, function (i, jj) { return jj === 8 ? 'c' : 'b'; });
    chipPad(f, 7, 21, -6, 5, lite, function (i, k) { return Math.hypot(i - 13.5, (k + 0.5) * 1.15) <= 7.2 && !(i >= 16 && i <= 19 && k >= -2 && k <= 1); });
    /* the handle: a sunny pulley on the line, a bark stem and a red T-bar (no harness) */
    h.group('handle', function () { h.box(-1, 1, -1, 1, -1, 1, 'y').box(0, 0, -4, -2, 0, 0, 'b').box(0, 0, -5, -5, -3, 3, 't'); if (!lite) h.set(0, 0, 2, 'e').set(0, 0, -2, 'e'); });
    if (!lite) { toad(f, -4, 4, 2); moss(f, -2, -5); toad(f, 18, -5, 3); }
    var p0 = lineAt(ZL.u0);
    return model('treetop_zipline', pal('bBcprftyeuqvxk'), [o, line, [h, p0], [fl, [-1.375, 2.625, -0.375]], f], {
      pivots: { handle: p0, pennant: ZL.pennant },
      anchors: { ladderFoot: ZL.ladderFoot, deck: ZL.deck, grip: [p0[0], p0[1] - ZL.grip, p0[2], 'handle'], landing: ZL.landing }
    });
  }

  var BUILD = { treetop_climbwall: climbwallVoxels, treetop_telescope: telescopeVoxels, treetop_cargonet: cargonetVoxels, treetop_leap: leapVoxels,
                treetop_bigslide: bigslideVoxels, treetop_zipline: ziplineVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no braces, holds, decor or bubble), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('treetop-a', K → {id: {voxels, lod1, act, forget, idle?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1];
    function pose(a, name, rx, ry, rz, x, y, z, s) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x || 0; P3[1] = y || 0; P3[2] = z || 0; S3[0] = S3[1] = S3[2] = s || 1;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0, 1); }
    function emit(a, kind, at, n, opts) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n, opts); } catch (e) { /* fx is optional */ } } }
    function tierOf(a) { return (a && a.template && a.template.tier) || 'MID'; }
    function askPet(a, id) {
      var p = a.pets;
      if (!p || typeof p.perform !== 'function') return;
      try { p.perform((LOOKS[id] && LOOKS[id].perform) || PERFORM[id], a.uid); } catch (e) { /* no crew yet */ }
    }
    function voiceStep(a) {
      var p = a.pets, pet = null, S = snd();
      try { pet = p && typeof p.active === 'function' ? p.active() : null; } catch (e) { pet = null; }
      if (typeof pet !== 'string') return -1;
      return S && S.VOICE_STEPS && S.PET_VOICE && S.PET_VOICE[pet] ? S.VOICE_STEPS.indexOf(S.PET_VOICE[pet]) : VOICE4.indexOf(pet);
    }
    /* per-copy memory (the sightings so far, the bubble's level and face, the copy geometry's rest):
       dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, sights: 0, up: 0, face: 0, hideAt: null, bent: false }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t, me),
       rest(a, reduced, me) (the end state), start?(a, me), at?(cue) → local point, skip?(a, cue)} */
    function run(a, id, spec) {
      var name = ACT[id];
      if (!a || !M || !M.ACTS || !M.ACTS[name]) return null;
      var prev = live.get(a.uid), reduced = !!a.reduced, o = { reduced: reduced, from: prev && !reduced && M.carry ? M.carry(name, prev.out) : null };
      var dur = reduced ? 0 : M.durOf(name, o), cues = M.cues(name, o);
      var ci = 0, done = false, uid = a.uid, me = { name: name, dur: dur, out: {}, mark: 0, reduced: reduced, bent: false };
      live.set(uid, me);
      if (spec.start) spec.start(a, me);
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
            if (c.emit) { if (!(spec.skip && spec.skip(h, c))) emit(h, c.emit, (c.emit !== 'sparkle' || !reduced) && spec.at ? spec.at(c) : 'top', c.n || 1); }
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
      me.cancel = function () { if (!done) { stop(); try { spec.rest(a, false, null); } catch (e) { /* the copy is gone */ } } };
      return me;
    }
    /* a pennant's flutter: ±deg at hz from t0 for `len` s, dying away */
    function flutter(t, t0, len, deg, hz) { var s = t - t0; return s <= 0 || s >= len ? 0 : deg * Math.sin(TAU * hz * s) * (1 - s / len); }

    /* ---------- a perCopy part bent on the CPU: fn(x, y, z, w, out3) from its rest positions ---------- */
    var WEIGHTS = typeof WeakMap === 'function' ? new WeakMap() : null, OUT = [0, 0, 0];
    function attr(geo, name) { return !geo ? null : typeof geo.getAttribute === 'function' ? geo.getAttribute(name) || null : (geo.attributes && geo.attributes[name]) || null; }
    function bend(a, part, weigh, fn) {
      var geo = null, base = null;
      try { geo = typeof a.copyGeometry === 'function' ? a.copyGeometry(part) : null; base = typeof a.basePositions === 'function' ? a.basePositions(part) : null; } catch (e) { geo = null; }
      var pa = attr(geo, 'position');
      if (!pa || !base || base.length !== pa.array.length) return false;
      var w = WEIGHTS && WEIGHTS.get(base);
      if (!w) { w = new Float32Array(base.length / 3); for (var q = 0; q < w.length; q++) w[q] = weigh(base[q * 3], base[q * 3 + 1], base[q * 3 + 2]); if (WEIGHTS) WEIGHTS.set(base, w); }
      var arr = pa.array;
      for (var v = 0; v < w.length; v++) {
        fn(base[v * 3], base[v * 3 + 1], base[v * 3 + 2], w[v], OUT);
        arr[v * 3] = OUT[0]; arr[v * 3 + 1] = OUT[1]; arr[v * 3 + 2] = OUT[2];
      }
      pa.needsUpdate = true;
      return true;
    }
    function unbend(a, part) { bend(a, part, function () { return 0; }, function (x, y, z, w, out) { out[0] = x; out[1] = y; out[2] = z; }); }
    /* bend while `amount` > 0; once it is back to 0 write the rest positions a single time */
    function shape(a, me, part, amount, weigh, fn) {
      if (amount > 0) { me.bent = bend(a, part, weigh, fn) || me.bent; return; }
      if (me.bent) { me.bent = false; unbend(a, part); }
    }

    /* ---------- climbing wall: the bell swings once at the top, two notes float off it ---------- */
    var climbSpec = {
      apply: function (a, out, t, me) {
        pose(a, 'bell', 0, 0, CW.deg * (out.swing || 0), 0, 0, 0, 1);
        if (!me.mark && t >= CW.noteAt) { me.mark = 1; emit(a, 'note', CW.note, 2, { token: 'PX Sunny' }); }
      },
      rest: function (a) { rest(a, 'bell'); }
    };

    /* ---------- telescope: the sweep, then the bubble pops out of the roof with the next island ---------- */
    /* the bubble at level 0 … 1 showing face n: it rises out of the roof and grows, flattened along that
       face's normal into a card (so only its one island faces us), then turned to +z; no overshoot on
       the way down */
    var BS3 = [1, 1, 1];
    function bubblePose(a, level, face, sinking) {
      var e = BUBBLE.faces[face] || BUBBLE.faces[0], v = sinking ? smooth(0, 1, level) : popOf(level), g = 1 + (BUBBLE.grow - 1) * v, pv = a && typeof a.pivot === 'function' ? a.pivot('bubble') : null;
      if (level <= 0) { rest(a, 'bubble'); return; }
      if (!pv || typeof pv.set !== 'function') return;
      BS3[0] = BS3[1] = BS3[2] = g; BS3[BUBBLE.axis[face] == null ? 2 : BUBBLE.axis[face]] = g * (1 - (1 - BUBBLE.card) * v);
      R3[0] = e[0]; R3[1] = e[1]; R3[2] = 0; P3[0] = 0; P3[1] = BUBBLE.lift * v; P3[2] = 0;
      pv.set(R3, P3, BS3);
    }
    function nextFace(a, m) { var isle = typeof a.isle === 'string' ? a.isle : null, s = sightOf(isle, m.sights); m.sights++; return SKY.indexOf(s); }
    var spySpec = {
      start: function (a, me) { var m = mem(a); me.was = m.up; me.wasFace = m.face; me.face = nextFace(a, m); m.up = 0; m.hideAt = null; },
      apply: function (a, out, t, me) {
        pose(a, 'scope', 0, scopeDeg(out.k, t), 0, 0, 0, 0, 1);
        pose(a, 'pennant', 0, flutter(t, 1.1, 1.6, TS.flap, TS.flapHz), 0, 0, 0, 0, 1);
        var down = me.was * (1 - clamp01(t / BUBBLE.sink)), pop = clamp01((t - BUBBLE.pop[0]) / (BUBBLE.pop[1] - BUBBLE.pop[0]));
        bubblePose(a, pop > 0 ? pop : down, pop > 0 ? me.face : me.wasFace, !(pop > 0));
        if (!me.mark && pop > 0) { me.mark = 1; emit(a, 'bubble', BUBBLE.puff, 2); }
      },
      /* the end state: the scope home and the bubble up, showing its island (idle lowers it later) */
      rest: function (a, reduced, me) {
        var m = mem(a);
        rest(a, 'scope'); rest(a, 'pennant');
        if (!me) { m.up = 0; m.hideAt = null; rest(a, 'bubble'); return; }
        m.up = 1; m.face = me.face; m.hideAt = (+a.t || 0) + BUBBLE.hold;
        bubblePose(a, 1, me.face);
      }
    };
    /* the bubble stays up BUBBLE.hold s, then sinks back into the roof (at once under reduced motion) */
    function spyIdle(a) {
      var m = mem(a), t = +a.t || 0;
      if (live.get(a.uid)) return true;
      if (!(m.up > 0) || m.hideAt == null || t < m.hideAt) return false;
      var v = a.reduced ? 0 : 1 - clamp01((t - m.hideAt) / BUBBLE.sink);
      bubblePose(a, v, m.face, true);
      if (v <= 0) { m.up = 0; m.hideAt = null; return false; }
      m.up = v;
      return true;
    }

    /* ---------- cargo net: the net sags under the pet, up the front, over the log, down the back ---------- */
    function netWeigh(x, y, z) { return sagWeight(x, y, z); }
    var scrambleSpec = {
      apply: function (a, out, t, me) {
        var s = out.bob || 0, back = smooth(0.4, 0.6, out.petT || 0), front = 1 - back;
        shape(a, me, COPY.treetop_cargonet, s, netWeigh, function (x, y, z, w, o3) {
          var k = w * s * (z > 0 ? front : back);
          o3[0] = x; o3[1] = y - CN.sag * k; o3[2] = z - (z > 0 ? 1 : -1) * CN.pull * k;
        });
      },
      rest: function (a) { unbend(a, COPY.treetop_cargonet); }
    };

    /* ---------- leaf pile: the pennant waves at the jump, the heap squashes 15 % as the pet lands ---------- */
    /* the heap's squash: the leap timeline's swing, scaled so that its peak is the full 15 % */
    var C0 = LP.centre, peak = 0, so = {};
    for (var st = 1.8; M && M.ACTS && M.ACTS.leap && st <= 2.4; st += 0.01) peak = Math.max(peak, M.sample('leap', st, so, {}).swing || 0);
    var leapSpec = {
      at: function () { return LP.puff; },
      skip: function (a, c) { return c.emit === 'leaf' && tierOf(a) === 'LOW'; },
      apply: function (a, out, t, me) {
        var s = peak > 0 ? clamp01(Math.max(0, out.swing || 0) / peak) : 0;
        pose(a, 'pennant', 0, flutter(t, LP.flagAt, 1.2, LP.flap, 1), 0, 0, 0, 0, 1);
        shape(a, me, COPY.treetop_leap, s, function () { return 1; }, function (x, y, z, w, o3) {
          o3[0] = C0[0] + (x - C0[0]) * (1 + LP.widen * s); o3[1] = y * (1 - LP.squash * s); o3[2] = C0[2] + (z - C0[2]) * (1 + LP.widen * s);
        });
      },
      rest: function (a) { rest(a, 'pennant'); unbend(a, COPY.treetop_leap); }
    };

    /* ---------- giant slide: nothing on the tower moves; the chips hop and puff as the pet lands ---------- */
    var slideSpec = {
      at: function () { return BS.pit; },
      apply: function (a, out, t, me) {
        var u = (t - BS.landAt) / 0.3, hop = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        pose(a, 'chips', 0, 0, 0, 0, BS.hop * hop, 0, 1);
        if (!me.mark && t >= BS.landAt) { me.mark = 1; emit(a, 'dust', BS.pit, 1, { token: 'PX Tree Bark Trail' }); }
      },
      rest: function (a) { rest(a, 'chips'); }
    };

    /* ---------- zip-line tower: the handle runs down the line with the pet, then reels back up ---------- */
    var Z0 = lineAt(ZL.u0), Z1 = lineAt(ZL.u1);
    var zipSpec = {
      apply: function (a, out, t, me) {
        var r = zipRun(out.k, t);
        pose(a, 'handle', 0, 0, 0, (Z1[0] - Z0[0]) * r, (Z1[1] - Z0[1]) * r, 0, 1);
        pose(a, 'pennant', 0, flutter(t, 0.9, 1.4, ZL.flap, 1), 0, 0, 0, 0, 1);
        if (!me.mark && t >= ZL.landAt) { me.mark = 1; emit(a, 'dust', ZL.landing, 1, { token: 'PX Tree Bark Trail' }); }
      },
      rest: function (a) { rest(a, 'handle'); rest(a, 'pennant'); }
    };

    var SPEC = { treetop_climbwall: climbSpec, treetop_telescope: spySpec, treetop_cargonet: scrambleSpec, treetop_leap: leapSpec,
                 treetop_bigslide: slideSpec, treetop_zipline: zipSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    out.treetop_telescope.idle = spyIdle;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, HELPERS: HELPERS, COPY: COPY, SKY: SKY, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { climbwall: CW, telescope: TS, bubble: BUBBLE, cargonet: CN, leap: LP, bigslide: BS, zipline: ZL },
    scopeDeg: scopeDeg, sightOf: sightOf, popOf: popOf, lineAt: lineAt, zipRun: zipRun, sagWeight: sagWeight, slideStops: slideStops, speck: speck
  };
}));
