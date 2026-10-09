/* ================================================================
   My Island v3 — SLPxJungleA (W3.2d): the Jungle Treehouse Village's rides and play in Pixel
   Blocks. window.SLPxJungleA + SL3D.defineVox('jungle-a', factory) in the browser, module.exports
   in Node. Every model is pure data (voxels(st) → VoxModel: no THREE, no DOM); the island, the
   photocards and the Node tests mesh the same source. Item space as the kit: base y = 0, pivot at
   the footprint centre, facing +z; everything below y 1.0 stays inside fp − 0.14 u.
     jungle_hammock     1×1  two jointed bamboo posts with leaf caps; a striped sling (pink, rope,
                        blue) with a pillow sags between them on 'sling' (hinge = the line through
                        the hooks). Act 'rock': ±10° at 0.6 Hz, then it settles. Anchor seat (sling).
     jungle_drums       1×1  three hollow-log drums (0.5 / 0.625 / 0.8 u): a light ring, a rope
                        lacing and a cream head; each head rides 'd0' … 'd2' and dips one voxel as it
                        is hit (low, low, middle, high). The log stool stands behind them, so the
                        seated pet faces us over its drums. Plain logs: nothing is carved on them.
     jungle_vineswing   1×1  two bark posts under a leafy branch; the long vine and its knotted disc
                        seat hang on 'swing'. Act 'swing': out and back twice inside 1.6 s (SLMotion's
                        pendulum for one period at ±28°, eased to rest). Every face is kept.
     jungle_monkeybars  2×1  two lashed bamboo A-frames, a plank step at each end, two rails and five
                        golden rungs; the leaves twined along the rails ride the helper pivot
                        'leaves' and rustle at each swing. Anchors start, r0 … r4, end.
     jungle_camp        2×1  an A-frame tent (cream canvas, one green stripe, a bamboo ridge pole and
                        a pennant) whose door flap lifts on 'flap'; beside it a stump with an open map
                        (a dotted trail to a leaf), a rolled mat, a bamboo lantern (glow state 'lamp':
                        it follows the night, never a flame) and a brass spyglass on a bamboo tripod
                        ('scope': one 60° sweep, left to right). Anchors tent, scope, spot.
     jungle_den         2×1  a plank hut with a stepped thatch roof on a deck 1.6 u up four bark
                        posts (a leaf pictogram on the door, a round window), a rope ladder on the
                        helper pivot 'ladder' (it sways while the pet climbs) and a split-bamboo
                        slide curving down to a moss pad. Anchors ladder, deck, window, s0 … s4, foot.
     jungle_falls       2×1  a chunky mossy rock wall (G4 boulders, 1.5 u) with a notch; the striped
                        sheet in it rides 'water' (it surges forward in the act); a stone-rimmed pool,
                        lily pads and a frog on the helper pivot 'frog' that hops to the rim and
                        back. Idle: fx drops off the lip (MID 20 / HIGH 40 alive; LOW keeps the
                        static stripes). Act 'splash' cut at 1.8 s. Anchors spot, pool.
     jungle_canoe       3×2  a creek round a fern islet inside mossy stone banks, a plank jetty on
                        bamboo stilts, a log bridge on two boulder piers over the back stretch, lily
                        pads, reeds and a frog on 'frog'; the dugout canoe (a paddle across its bow)
                        rides 'canoe' one lap of the lane (lapAt) and bobs ±0.02 u at 0.3 Hz on
                        MID / HIGH. Anchors spot (the jetty), c0 … c7 (the lap), seat (canoe).
   LOW (D89): detail voxels are tagged lod 'mid' (ferns, flowers, ripples, vines); every id also
   brings its own lod1 (its plain masses, halved) inside TRIS_CAPS_LOD1.
   ACTS run on SLMotion timelines by name: canoe, climbSlide, camp, bars, drum, rock, and the two
   first-plan names swing and splash, cut to the plan's seconds with their own sounds. One live
   act per uid (a re-tap supersedes); the end pose is the rest pose; reduced motion is the end
   state at once with the same sounds and one sparkle (the camp keeps its flap open). The pet's
   part is a.pets.perform(LOOK perform kind, uid). Rates: the sling 0.6 Hz, the vine 0.625 Hz,
   the drum beat 1.82 Hz, the ladder 1.5 Hz — all under MAX_FLASH_HZ; the only light is the camp
   lantern's steady glow. No word, no five-point star, no flame; nothing here reads, awards or
   spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.batch a.template · a.pivot(name).set(rotDeg[3],
   pos[3], scale[3]) · a.state(key, v) · a.emit(kind, localPos, n, opts) · a.sfx(name, vol, step)
   · a.pets {active, perform}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxJungleA = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('jungle-a', api.factory);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxJungleA: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }
  function snd() { return sibling('SLSound', '../sound.js'); }

  var VERSION = 1;
  var IDS = ['jungle_canoe', 'jungle_den', 'jungle_camp', 'jungle_falls', 'jungle_monkeybars', 'jungle_vineswing', 'jungle_drums', 'jungle_hammock'];
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2;
  /* the SLMotion timeline and the a.pets.perform kind per id (LOOK[id].perform wins when it is loaded) */
  var ACT = { jungle_canoe: 'canoe', jungle_den: 'climbSlide', jungle_camp: 'camp', jungle_falls: 'splash', jungle_monkeybars: 'bars',
              jungle_vineswing: 'swing', jungle_drums: 'drum', jungle_hammock: 'rock' };
  var PERFORM = { jungle_canoe: 'seat:ride', jungle_den: 'slide', jungle_camp: 'stand:lookBack', jungle_falls: 'paddle', jungle_monkeybars: 'trail:hang',
                  jungle_vineswing: 'vine', jungle_drums: 'seat:sit', jungle_hammock: 'seat:sit' };
  /* pivots beyond the lookEntries lists: small parts the acts move for fun (as the fountain's side jets) */
  var HELPERS = { jungle_den: ['ladder'], jungle_falls: ['frog'], jungle_monkeybars: ['leaves'] };
  var VOICE4 = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];   /* 'voice' steps without SLSound.VOICE_STEPS */
  /* the one module token (D50): the rocks' shaded tone */
  var TOKENS = { 'PX Creek Stone Shade': '#869E88' };
  var tokensFor = null;
  function ready() {
    var L = look();
    if (L && tokensFor !== L && typeof L.addTokens === 'function') { L.addTokens('px-jungle-a', TOKENS); tokensFor = L; }
  }

  /* ================================================================
     LAYOUT (item metres; the builders, the handlers, the anchors and the tests read the same numbers)
     ================================================================ */
  var HM = { hook: [0, 0.875, 0], seat: [0, 0.625, 0], deg: 10, low: [12, 10, 9, 8, 8, 9, 10, 12], half: [1, 3, 4, 4, 4, 4, 3, 1] };
  var DR = {
    /* i, k = the low corner on G16; w = the side; h = the log's height in G16 voxels (the head adds 2) */
    drums: [{ i: -6, k: 0, w: 6, h: 6 }, { i: 0, k: 2, w: 4, h: 8 }, { i: 2, k: -3, w: 4, h: 11 }],
    stool: { i: -5, k: -6, w: 4, h: 4 }, beats: [0, 0, 1, 2], at: 0.05, gap: 0.55, dip: G16, seat: [-0.1875, 0.25, -0.25], leaf: [0.25, 0.9375, -0.0625]
  };
  var VS = { pivot: [0, 1.5, 0], seat: [0, 0.5625, 0], amp: 28, cut: 1.6, settle: 1.2,
             cues: [{ t: 0.05, sfx: 'whoosh', vol: 0.35 }, { t: 0.85, sfx: 'whoosh', vol: 0.35 }, { t: 1.45, sfx: 'voice', pet: true }] };
  var MB = { rungs: [-0.5, -0.25, 0, 0.25, 0.5], rungY: 1.25, step: [0.5625, 0.375, 0], leaves: [0, 1.375, 0], hop: 0.04, tilt: 4 };
  var CP = {
    flap: [-0.4375, 0.5, 0.25], flapDeg: 105, scope: [0.6875, 0.4375, 0.125], sweep: 60, pre: [0.9, 1.4], post: [2.6, 2.95],
    tent: [-0.4375, 0, 0.34375], stand: [0.6875, 0, -0.1875], spot: [0.0625, 0, 0.3125], fly: [0.6875, 0.875, 0.25], flyAt: 1.9
  };
  var DN = {
    ladder: [-0.53125, 1.5, 0.34375], sway: 5, swayHz: 1.5, climb: 0.34,     /* the ladder sways while k < climb */
    slide: [11, 9, 7, 5, 3, 2],                                              /* the bed's top voxel per G8 column from i = 0 */
    foot: [-0.53125, 0, 0.40625], deck: [-0.53125, 1.625, 0.25], window: [-0.375, 1.625, 0.1875], pad: [0.8125, 0.125, 0]   /* anchors: ladder (its foot), deck, window, foot (the pad) */
  };
  var FL = {
    crag: [4, 6, 5, 5, 5, 3],                                                /* the wall's G4 height per column from i = -3; the notch is columns 2, 3 */
    water: [0, 0.125, -0.375], lip: [0, 1.375, -0.1875], lipHalf: 0.21875, foot: [0, 0.1875, -0.0625],
    frog: [0.40625, 0.1875, 0.09375], hop: [0.03125, 0.0625, 0.21875], hopH: 0.2, spot: [-0.3125, 0.25, 0.3125], pool: [-0.1875, 0.125, 0.0625],
    cut: 1.8, surge: 0.5, widen: 0.1, every: 0.1, dropLife: 0.5,              /* fx 'drop' lives about 0.5 s */
    cues: [{ t: 0.05, sfx: 'splash', vol: 0.5 }, { t: 0.05, emit: 'splash', n: 1 }, { t: 0.1, emit: 'drop', n: 10 }, { t: 1.2, sfx: 'voice', pet: true }]
  };
  var CN = {
    lane: { a: 1, zf: 0.46875, zb: -0.5, r: 0.3125, x0: -0.625 },           /* the canoe's lap: a rounded rectangle, anticlockwise from the jetty */
    waterY: 0.125, seatY: 0.25, bob: 0.02, bobPeriod: 1 / 0.3, wake: 0.5,
    spot: [-1.25, 0.5, 0.5625], frog: [1.09375, 0.1875, 0.59375], hop: [0.1875, 0.0625, 0.125], hopH: 0.25
  };

  /* ================================================================
     PURE HELPERS (exported for the Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  /* the canoe's lap: u 0 → 1 once round the lane, anticlockwise seen from above, starting at the
     jetty heading +x. out = {x, z (item metres), yaw (degrees about +y: 0 at the jetty → 360)} */
  var LAP = null;
  function lapSegs() {
    if (LAP) return LAP;
    var l = CN.lane, xr = l.a - l.r, side = (l.zf - l.r) - (l.zb + l.r), q = Math.PI * l.r / 2, total = 0;
    /* [length, 0 straight | 1 arc, x, z (its start, or the arc's centre), the heading at its start (degrees)] */
    var s = [[xr - l.x0, 0, l.x0, l.zf, 0], [q, 1, xr, l.zf - l.r, 0], [side, 0, l.a, l.zf - l.r, 90], [q, 1, xr, l.zb + l.r, 90],
             [2 * xr, 0, xr, l.zb, 180], [q, 1, -xr, l.zb + l.r, 180], [side, 0, -l.a, l.zb + l.r, 270], [q, 1, -xr, l.zf - l.r, 270],
             [l.x0 + xr, 0, -xr, l.zf, 360]];
    s.forEach(function (e) { total += e[0]; });
    return (LAP = { segs: s, total: total });
  }
  function lapAt(u, out) {
    out = out || {};
    var L = lapSegs(), r = CN.lane.r, d = (u - Math.floor(u)) * L.total, n = 0, turns = u >= 1 ? 360 * Math.floor(u) : 0;
    while (n < L.segs.length - 1 && d > L.segs[n][0]) { d -= L.segs[n][0]; n++; }
    var e = L.segs[n], h = e[4] * Math.PI / 180;
    if (e[1]) {                                    /* an arc: the heading turns by d / r about the centre */
      var a = h + d / r;
      out.x = e[2] + r * Math.sin(a); out.z = e[3] + r * Math.cos(a); out.yaw = a * 180 / Math.PI + turns;
    } else { out.x = e[2] + d * Math.cos(h); out.z = e[3] - d * Math.sin(h); out.yaw = e[4] + turns; }
    return out;
  }
  /* a frog's hop for a 0 → 1 → 0 hump v: out = its offset from the pad (an arc toward `to`) */
  function hopAt(v, to, h, out) {
    out = out || [0, 0, 0];
    var u = clamp01(v);
    out[0] = to[0] * u; out[1] = to[1] * u + 4 * h * u * (1 - u); out[2] = to[2] * u;
    return out;
  }
  /* which drum beat (0 … 3) the 'drum' timeline is on at t, or -1 before the first / after the last */
  function beatAt(t) { var n = Math.floor((t - DR.at) / DR.gap); return n < 0 || n >= DR.beats.length ? -1 : n; }
  /* the vine's angle from SLMotion's pendulum (degrees, ±38 decaying): scaled to ±VS.amp and eased to rest by VS.cut */
  function vineDeg(deg, t, amp) { return (deg || 0) * VS.amp / (amp || 38) * (1 - smooth(VS.settle, VS.cut, t)); }
  /* the spyglass's yaw (degrees) for the camp timeline's k at t: back to the left, one sweep to the right, home */
  function scopeDeg(k, t) { return CP.sweep * ((k || 0) - 0.5 * smooth(CP.pre[0], CP.pre[1], t) - 0.5 * smooth(CP.post[0], CP.post[1], t)); }

  /* ================================================================
     BUILDER HELPERS
     ================================================================ */
  /* a grid: origin 0 = voxel 0 starts on the pivot plane, 0.5 = voxel 0 is centred on it */
  function grid(g, ox, oz) { return VX().grid({ grid: g, origin: [ox || 0, 0, oz || 0] }); }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (empty grids are left out); o.pivots {name: [x, y, z]}
     and o.anchors {name: [x, y, z, pivot?]} in item metres; o.cull as the model format */
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
    if (o.cull) m.cull = o.cull;
    if (issues.length) m.issues = issues;
    return m;
  }
  /* the shared palette by char; pal('kKr', {…}) picks from it. The digits are the MID / HIGH
     detail twins (lod 'mid': tier LOW drops them, D89) */
  var LEAF = 'leaf', SOFT = 'soft', MID = 'mid', PLANK = { token: 'PX Jungle Rope', mode: 'plank' };   /* pale planks: the den's walls, the jetty */
  var INK = {
    k: 'PX Jungle Bark', K: 'PX Jungle Bark Light', r: 'PX Jungle Rope', t: 'PX Jungle Thatch', T: 'PX Jungle Thatch Shade',
    s: 'PX Jungle Moss Stone', S: 'PX Creek Stone Shade', w: 'PX Cream', e: 'PX Penguin Back', x: 'PX Glint', y: 'PX Sunny',
    l: { token: 'PX Jungle Canopy', mode: LEAF }, L: { token: 'PX Jungle Canopy Light', mode: LEAF }, g: { token: 'PX Jungle Canopy Deep', mode: LEAF },
    p: 'PX Jungle Flower Pink', o: 'PX Jungle Flower Orange', q: 'PX Jungle Parrot Red', u: 'PX Jungle Parrot Blue',
    a: { token: 'PX Jungle Water 1', mode: SOFT }, b: { token: 'PX Jungle Water 2', mode: SOFT },
    D: { token: 'PX Jungle Bark Light', mode: 'plank' }, F: 'PX Jungle Gem 2', f: 'PX Jungle Canopy Deep', E: 'PX Ink Eye',
    1: { token: 'PX Jungle Canopy Deep', mode: LEAF, lod: MID }, 2: { token: 'PX Jungle Canopy Light', mode: LEAF, lod: MID },
    3: { token: 'PX Jungle Flower Pink', lod: MID }, 4: { token: 'PX Jungle Flower Orange', lod: MID }, 5: { token: 'PX Banana', lod: MID },
    6: { token: 'PX Glint', lod: MID }, 7: { token: 'PX Jungle Bark', lod: MID }
  };
  function pal(chars, extra) {
    var p = {}, k;
    ready();
    chars.split('').forEach(function (c) { p[c] = INK[c]; });
    for (k in extra) p[k] = extra[k];
    return p;
  }
  /* MID / HIGH decor on G16: a fern tuft (a tall blade and four shorter ones) · a flower (a stem, a
     plus-shaped head round its eye) */
  function tuft(g, i, k, h, j0) {
    j0 = j0 || 0;
    g.box(i, i, j0, j0 + h - 1, k, k, '1');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, n) { g.box(i + d[0], i + d[0], j0, j0 + h - 3 + (n & 1), k + d[1], k + d[1], '2'); });
  }
  function bloom(g, i, k, h, head, j0) {
    var j = (j0 || 0) + h;
    g.box(i, i, j - h, j - 1, k, k, '1').box(i - 1, i + 1, j, j, k, k, head).box(i, i, j, j, k - 1, k + 1, head).set(i, j, k, '5');
  }
  /* an n × n square with its corners off (logs, lily pads, seats) */
  function round(g, i, i1, j, j1, k, k1, c) {
    g.box(i, i1, j, j1, k, k1, function (x, y, z) { return (x === i || x === i1) && (z === k || z === k1) ? null : typeof c === 'function' ? c(x, y, z) : c; });
  }
  /* an original little frog on G16, facing +z: a 3 × 2 × 3 body, two feet, two eyes, a pale chin */
  function frog(g, i, j, k) {
    g.box(i, i + 2, j, j + 1, k, k + 2, 'F');
    g.set(i - 1, j, k + 1, 'f').set(i + 3, j, k + 1, 'f').set(i, j + 2, k + 2, 'E').set(i + 2, j + 2, k + 2, 'E').set(i + 1, j, k + 2, 'w');
  }

  /* ---------------- jungle_hammock ---------------- */
  function hammockVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0, 0.5), s = grid(G16), f = grid(G16);
    [-3, 2].forEach(function (i) {
      o.box(i, i, 0, 8, 0, 0, function (a, j) { return lite ? 'K' : j === 6 ? 'r' : j === 1 || j === 4 ? 't' : 'K'; });   /* jointed bamboo, lashed at the hook */
      o.set(i, 0, -1, 's').set(i, 0, 1, 'S');                                                                           /* a stone collar */
      o.set(i, 9, 0, 'L').set(i, 9, -1, 'l').set(i, 9, 1, 'l').set(i - 1, 9, 0, 'g').set(i + 1, 9, 0, 'g').set(i, 10, 0, 'l');   /* a leaf cap */
    });
    /* the sling: eight G16 columns two voxels thick, narrow at the hooks and wide in the sag; its
       stripes run its length (blue down the middle, a rope line, pink edges) */
    s.group('sling', function () {
      HM.low.forEach(function (lo, n) {
        var h = HM.half[n];
        s.box(n - 4, n - 4, lo, lo + 1, -h, h - 1, function (i, j, k) { var d = k < 0 ? -k - 1 : k; return h < 2 ? 'r' : lite ? 'p' : d === 0 ? 'u' : d === 1 ? 'r' : 'p'; });
      });
      if (!lite) s.box(-3, -3, 12, 13, -2, 1, 'w');                                                                     /* a pillow at the head end */
    });
    if (!lite) { tuft(f, -1, 4, 4); bloom(f, 3, -5, 3, '3'); }
    return model('jungle_hammock', pal('KrtsSlLgupw12356'), [o, s, f], { pivots: { sling: HM.hook }, anchors: { seat: HM.seat.concat('sling') } });
  }

  /* ---------------- jungle_drums ---------------- */
  function drumsVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G16), f = grid(G16), pivots = {}, q = DR.stool;
    DR.drums.forEach(function (d, n) {
      var i1 = d.i + d.w - 1, k1 = d.k + d.w - 1;
      round(o, d.i, i1, 0, d.h - 1, d.k, k1, function (i, j) { return j === d.h - 1 && !lite ? 'K' : 'k'; });            /* the log and its light ring */
      o.group('d' + n, function () { round(o, d.i, i1, d.h, d.h, d.k, k1, lite ? 'w' : 'r'); round(o, d.i, i1, d.h + 1, d.h + 1, d.k, k1, 'w'); });
      pivots['d' + n] = [(d.i + d.w / 2) * G16, d.h * G16, (d.k + d.w / 2) * G16];
    });
    round(o, q.i, q.i + q.w - 1, 0, q.h - 1, q.k, q.k + q.w - 1, function (i, j) { return j === q.h - 1 ? 'K' : 'k'; });   /* the stool */
    if (!lite) { tuft(f, 1, -5, 4); bloom(f, 4, -5, 3, '4'); }
    return model('jungle_drums', pal('kKrw12456'), [o, f], { pivots: pivots, anchors: { seat: DR.seat } });
  }

  /* ---------------- jungle_vineswing ---------------- */
  function vineswingVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), v = grid(G16), leaf = grid(G4), f = grid(G16);
    function bark(i, j) { return !lite && (j === 3 || j === 8) ? 'K' : 'k'; }
    /* two posts and their root flares (lite: two voxels square, so the halved model keeps them) */
    [-3, 2].forEach(function (i) { if (lite) o.box(i < 0 ? -4 : 2, i < 0 ? -3 : 3, 0, 11, -1, 0, 'k'); else o.box(i, i, 0, 11, -1, 0, bark).set(i, 0, -2, 'k').set(i, 0, 1, 'k'); });
    o.box(-4, 3, 12, 12, -1, 0, 'k');                                                                                   /* the branch */
    /* the leafy top (G4, from y 1.625): a slab along the branch, a row behind it and two puffs hanging at the back */
    leaf.box(-2, 1, 0, 0, -1, 0, function (i, j, k) { return (i + k) & 1 ? 'L' : 'l'; });
    [[-2, 0, 'g'], [-1, 0, 'l'], [0, 0, 'g'], [-2, -1, 'l'], [1, -1, 'g']].forEach(function (c) { leaf.set(c[0], c[1], -2, c[2]); });
    v.group('swing', function () {
      v.box(-1, 0, 9, 23, -1, 0, 'v');                                                                                  /* the vine */
      round(v, -3, 2, 7, 8, -3, 2, 'D');                                                                                /* the disc seat on its knot */
      v.box(-1, 0, 5, 6, -1, 0, 'r').set(-1, 4, 0, 'r');
      if (!lite) [[1, 19, 0], [-2, 15, -1], [1, 12, -1], [-2, 21, 0]].forEach(function (c) { v.set(c[0], c[1], c[2], '2'); });   /* its leaves */
    });
    if (!lite) { tuft(f, 4, 4, 4); bloom(f, -4, -5, 3, '3'); f.box(-7, -6, 27, 28, 4, 4, '3').box(5, 6, 26, 27, 4, 4, '4'); }   /* + two blossoms on the leaves */
    return model('jungle_vineswing', pal('kKlLgrD12345', { v: 'PX Jungle Canopy' }), [o, v, [leaf, [0, 1.625, 0]], f],
      { cull: [], pivots: { swing: VS.pivot }, anchors: { seat: VS.seat.concat('swing') } });
  }

  /* ---------------- jungle_monkeybars ---------------- */
  function monkeybarsVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8, 0.5, 0), lv = grid(G8, 0.5, 0), f = grid(G16), anchors = {};
    [-6, 6].forEach(function (i) {
      var inn = i < 0 ? 1 : -1;
      [[-3, -2], [2, 1]].forEach(function (z) {                                   /* an A-frame leg: it leans in half-way up, lashed at the joint and the top */
        o.box(i, i, 0, 4, z[0], z[0], 'K').box(i, i, 5, 10, z[1], z[1], function (a, j) { return !lite && (j === 5 || j === 10) ? 'r' : 'K'; });
      });
      o.box(i, i, 10, 10, -1, 0, 'K').box(i, i, 2, 2, -2, 1, 'K');                /* its top bar and its cross bar */
      o.box(i + inn, i + 2 * inn, 2, 2, -2, 1, 'D');                              /* the plank step and its two stubs */
      if (!lite) o.box(i + 2 * inn, i + 2 * inn, 0, 1, -2, -2, 'K').box(i + 2 * inn, i + 2 * inn, 0, 1, 1, 1, 'K');
    });
    o.box(-5, 5, 10, 10, -2, -2, 'K').box(-5, 5, 10, 10, 1, 1, 'K');              /* two rails */
    MB.rungs.forEach(function (x, n) {
      o.box(x / G8, x / G8, 10, 10, -1, 0, 't');                                  /* five golden rungs */
      anchors['r' + n] = [x, MB.rungY, 0];
    });
    anchors.start = [-MB.step[0], MB.step[1], MB.step[2]]; anchors.end = MB.step;
    lv.group('leaves', function () {
      [[-5, -2, 'l'], [-3, 1, 'L'], [-1, -2, 'L'], [1, 1, 'l'], [3, -2, 'l'], [5, 1, 'L']].forEach(function (c) { lv.set(c[0], 11, c[1], c[2]); });
      if (!lite) lv.set(-1, 12, -2, 'p').set(5, 12, 1, 'o').set(3, 10, -3, 'g').set(-5, 10, 2, 'g').box(-5, -5, 8, 9, 2, 2, '5').set(-4, 9, 2, '5');   /* + a banana bunch */
    });
    if (!lite) { tuft(f, -1, 4, 4); bloom(f, 6, -5, 3, '3'); }
    return model('jungle_monkeybars', pal('KrtDlLgpo1235'), [o, lv, f], { pivots: { leaves: MB.leaves }, anchors: anchors });
  }

  /* ---------------- jungle_camp ---------------- */
  var MAP = ['wwlg', 'wwql', 'wqww', 'qwww'];                                     /* the map from above, back row first: a dotted trail to a leaf */
  function campVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), fine = grid(G16), j;
    /* the A-frame tent: four tiers, the ridge along z; one green stripe round it */
    for (j = 0; j < 8; j++) o.box(-7 + (j >> 1), -1 - (j >> 1), j, j, -3, 1, function (a, b, k) { return k === -1 && !lite ? 'g' : 'w'; });
    o.box(-5, -3, 0, 3, 1, 1, null).box(-5, -3, 0, 3, 0, 0, 'e');                 /* the doorway */
    fine.group('flap', function () { fine.box(-10, -5, 0, 7, 3, 3, 'r'); if (!lite) fine.box(-8, -7, 3, 4, 3, 3, 'g'); });
    fine.box(-8, -7, 16, 17, -7, 5, 'K');                                         /* the ridge pole and its pennant */
    fine.box(-8, -8, 18, 21, 5, 5, 'K').box(-7, -6, 20, 21, 5, 5, 'p').set(-5, 21, 5, 'p');
    /* beside it: the stump and its map, the rolled mat in front of it, the bamboo lantern */
    o.box(1, 2, 0, 1, -3, -2, 'k');
    fine.bitmap(MAP, null, { axis: 'y', at: [2, 4, -3] });
    o.box(1, 2, 0, 1, 0, 2, function (a, b, k) { return k === 1 && !lite ? 'p' : 'u'; });
    o.box(3, 3, 0, 2, -3, -3, 'K').set(3, 3, -3, 'Y').set(3, 4, -3, 't');
    /* the tripod: a head on three splayed bamboo legs; the spyglass turns on it, its lens toward +z */
    fine.box(10, 11, 6, 6, 1, 2, 'K');
    fine.line([10, 5, 2], [10, 0, 5], 'K').line([10, 5, 1], [8, 0, -1], 'K').line([11, 5, 1], [13, 0, -1], 'K');
    fine.group('scope', function () {
      fine.box(10, 11, 7, 8, -2, 3, function (a, b, c) { return c === -2 ? 'e' : c === 1 && !lite ? 'k' : 'y'; });
      fine.box(9, 12, 6, 9, 4, 5, function (a, b, c) { return c === 5 && a > 9 && a < 12 && b > 6 && b < 9 ? 'e' : 'y'; });
    });
    if (!lite) { tuft(fine, 7, 4, 4); bloom(fine, -13, 4, 4, '4'); }
    return model('jungle_camp', pal('kKrtweglqpuy1245', {
      Y: { token: 'PX Lamp Warm', mode: 'glow', state: { key: 'lamp', off: 'PX Lamp Off', on: 'PX Lamp Warm', initial: 0 } } }), [o, fine],
      { pivots: { flap: CP.flap, scope: CP.scope }, anchors: { tent: CP.tent, scope: CP.stand, spot: CP.spot } });
  }

  /* ---------------- jungle_den ---------------- */
  function denVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), ld = grid(G16), f = grid(G16), anchors = { ladder: DN.foot, deck: DN.deck, window: DN.window, foot: DN.pad }, n;
    [[-7, -3], [-7, 2], [-2, -3], [-2, 2]].forEach(function (p) { o.box(p[0], p[0], 0, 11, p[1], p[1], function (i, j) { return !lite && (j === 4 || j === 9) ? 'K' : 'k'; }); });
    o.box(-7, -1, 12, 12, -3, 2, 'D');                                            /* the deck */
    o.box(-7, -3, 13, 16, -3, 0, function (i, j, k) { return k === 0 && j < 16 && i < -5 ? 'w' : 'W'; });   /* the hut and its door */
    if (!lite) o.decal('+z', [-7, 14, 0], [2, 2], 'leaf').decal('+z', [-4, 14, 0], [2, 2], 'window:round');
    o.box(-8, -2, 17, 17, -4, 0, 't').box(-7, -3, 18, 18, -3, -1, 'T').box(-6, -4, 19, 19, -2, -2, 't');   /* stepped thatch, a leaf and a flower on its ridge */
    o.set(-5, 20, -2, 'L').set(-4, 20, -2, lite ? 'L' : 'p');
    /* the split-bamboo slide: a stepped green bed two voxels wide between two rails, on stubs, down to a moss pad */
    DN.slide.forEach(function (top, c) {
      var lo = c < DN.slide.length - 1 ? DN.slide[c + 1] : 0;
      o.box(c, c, lo, top, -1, 0, 'B').box(c, c, lo, top + 1, -2, -2, 'K').box(c, c, lo, top, 1, 1, 'K');   /* the front rail is flush: the bed shows */
      if (c < 5) anchors['s' + c] = [(c + 0.5) * G8, (top + 1) * G8, 0];
    });
    [[1, 6], [3, 2]].forEach(function (p) { o.box(p[0], p[0], 0, p[1], -2, -2, 'k').box(p[0], p[0], 0, p[1], 1, 1, 'k'); });
    o.box(6, 6, 0, 0, -2, 1, 'l');
    ld.group('ladder', function () {
      ld.box(-11, -11, 1, 23, 5, 5, 'r').box(-6, -6, 1, 23, 5, 5, 'r');
      for (n = 3; n <= 21; n += 3) ld.box(-10, -7, n, n, 5, 5, 'K');
    });
    if (!lite) {
      tuft(f, 1, 4, 5); bloom(f, 12, 4, 3, '4');
      f.box(-2, -2, 19, 23, 5, 5, '1').box(-10, -10, 20, 23, -6, -6, '2');          /* vines hanging off the deck */
    }
    return model('jungle_den', pal('kKrtTwlLgpD1245', {
      W: PLANK, B: 'PX Jungle Canopy Light' }), [o, ld, f], { pivots: { ladder: DN.ladder }, anchors: anchors });
  }

  /* ---------------- jungle_falls ---------------- */
  function fallsVoxels(st, opt) {
    var lite = !!(opt && opt.lite), rock = grid(G4), o = grid(G8), fine = grid(G16), i, k;
    /* the wall: G4 boulders in two tones with moss on their tops; the notch is a thin back wall the water runs down */
    FL.crag.forEach(function (h, n) {
      if (n === 2 || n === 3) return;
      rock.box(n - 3, n - 3, 0, h - 1, -1, -1, function (a, b) { return !lite && (a * 2 + b + 12) % 3 === 0 ? 'S' : 's'; });
      o.set(2 * n - 6, 2 * h, -3, 'L').set(2 * n - 5, 2 * h, -2, 'l');
    });
    o.box(-2, 1, 0, 9, -3, -3, 's').box(-2, 1, 0, 0, -2, -2, 'b');
    o.box(-7, -7, 0, 2, -3, -2, 's').box(6, 6, 0, 1, -3, -2, 's').set(-7, 3, -3, 'L').set(6, 2, -2, 'l');   /* a boulder at each end */
    /* the pool: a stone rim with moss caps round two blues */
    for (k = -1; k <= 2; k++) {
      var x0 = k < 1 ? -7 : k < 2 ? -6 : -5, x1 = -1 - x0;
      for (i = x0; i <= x1; i++) {
        if (k === 2 || i === x0 || i === x1) o.set(i, 0, k, 's').set(i, 1, k, !lite && (i + 8) % 4 < 2 ? 'L' : 's');
        else o.set(i, 0, k, k < 1 && i > -5 && i < 4 ? 'b' : 'a');
      }
    }
    /* the water: over the lip and down the notch in four stripes (it surges forward in the act); foam at its foot */
    o.group('water', function () {
      o.box(-2, 1, 10, 10, -3, -3, function (a) { return a & 1 ? 'b' : 'a'; });
      o.box(-2, 1, 1, 10, -2, -2, function (a, j) { return !lite && (j * 3 + a * 5 + 40) % 7 === 0 ? 'x' : a & 1 ? 'b' : 'a'; });
    });
    [[-5, -2], [-3, -1], [-1, -2], [1, -1], [3, -2], [-4, 0], [0, 0], [4, -1]].forEach(function (c) { fine.box(c[0], c[0] + 1, 2, 2, c[1], c[1], 'x'); });
    /* a lily pad and its frog; MID / HIGH: a second pad in bud, ferns, vines down the rock */
    round(fine, 5, 8, 2, 2, 0, 3, 'l');
    fine.group('frog', function () { frog(fine, 5, 3, 0); });
    if (!lite) {
      round(fine, -10, -8, 2, 2, 1, 3, '2'); fine.set(-9, 3, 2, '3');
      tuft(fine, -13, 4, 4); bloom(fine, 12, 4, 3, '4');
      fine.box(6, 6, 12, 19, -2, -2, '1').box(-7, -7, 16, 23, -2, -2, '2').box(-11, -11, 10, 15, -2, -2, '1');
    }
    return model('jungle_falls', pal('sSlLabxwFfE12345'), [[rock, [0, 0, -0.125]], o, fine],
      { pivots: { water: FL.water, frog: FL.frog }, anchors: { spot: FL.spot, pool: FL.pool } });
  }

  /* ---------------- jungle_canoe ---------------- */
  function inCreek(i, k) { return i >= -11 && i <= 10 && k >= -7 && k <= 6 && !((i === -11 || i === 10) && (k === -7 || k === 6)); }
  function onBank(i, k) { return inCreek(i, k) && (i < -10 || i > 9 || k < -6 || k > 5 || !inCreek(i - 1, k - 1) || !inCreek(i + 1, k - 1) || !inCreek(i - 1, k + 1) || !inCreek(i + 1, k + 1)); }
  function onIslet(i, k) { return i >= -6 && i <= 5 && k >= -2 && k <= 1 && !((i === -6 || i === 5) && (k === -2 || k === 1)); }
  function canoeVoxels(st, opt) {
    var lite = !!(opt && opt.lite), o = grid(G8), fine = grid(G16), c = grid(G16, 0.5, 0.5), anchors = { spot: CN.spot }, p = {}, i, k, n;
    for (k = -7; k <= 6; k++) for (i = -11; i <= 10; i++) {
      if (!inCreek(i, k)) continue;
      if (onBank(i, k)) { o.box(i, i, 0, 1, k, k, 's'); if (!lite && ((i + k + 40) >> 1) & 1) fine.box(2 * i, 2 * i + 1, 4, 4, 2 * k, 2 * k + 1, '2'); }   /* moss caps on MID / HIGH */
      else if (onIslet(i, k)) o.box(i, i, 0, 1, k, k, 'l');
      else o.set(i, 0, k, !lite && (onBank(i - 1, k) || onBank(i + 1, k) || onBank(i, k - 1) || onBank(i, k + 1) || onIslet(i - 1, k) || onIslet(i + 1, k) || onIslet(i, k - 1) || onIslet(i, k + 1)) ? 'a' : 'b');
    }
    /* the jetty: planks off the left bank in the front corner (the hull passes under their edge), on a
       bamboo stilt in the one cell the canoe never sweeps; two mooring posts */
    o.box(-10, -10, 0, 4, 4, 4, 'K').box(-10, -10, 2, 4, 5, 5, 'K').set(-11, 2, 3, 'K').set(-11, 2, 5, 'K');
    o.box(-11, -10, 3, 3, 3, 5, 'W');
    /* the log bridge: two boulder piers, a log with cut ends, moss and a bloom on top */
    [[-7, 7], [-2, 7], [-1, 4]].forEach(function (q) { o.box(2, 3, 2, q[1], q[0], q[0], function (x, j) { return !lite && j % 3 === 0 ? 'S' : 's'; }); });
    o.box(2, 3, 8, 9, -7, -1, function (x, j, z) { return z === -7 || z === -1 ? 'K' : 'k'; });
    o.set(2, 10, -6, 'L').set(3, 10, -5, 'g').set(2, 10, -3, 'L').set(3, 10, -4, lite ? 'L' : 'p');
    /* the islet: a fern palm, ferns and a flower */
    o.box(-4, -4, 2, 7, 0, 0, 'k').set(-4, 8, 0, 'L').set(-6, 7, 0, 'g').set(-2, 7, 0, 'g');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { o.set(-4 + d[0], 8, d[1], 'l'); });
    /* a lily pad and its frog in the front corner; MID / HIGH: reeds on the right bank, two more pads, ferns, ripples */
    round(fine, 16, 19, 2, 2, 8, 11, 'l');
    fine.group('frog', function () { frog(fine, 16, 3, 8); });
    if (!lite) {
      [[20, -5, 9], [21, -1, 12], [20, 3, 8]].forEach(function (q) { fine.box(q[0], q[0], 4, 4 + q[2], q[1], q[1], '1').box(q[0], q[0], 2 + q[2], 4 + q[2], q[1], q[1], '7'); });
      round(fine, 16, 18, 2, 2, -12, -10, '2'); fine.set(17, 3, -11, '3'); round(fine, -19, -17, 2, 2, -11, -9, '2');
      tuft(fine, 2, -1, 5, 4); tuft(fine, -1, 1, 4, 4); bloom(fine, 8, 0, 3, '3', 4);
      [[-3, 6], [9, 8], [-13, -9], [18, 1]].forEach(function (q) { fine.box(q[0], q[0] + 1, 2, 2, q[1], q[1], '6'); });   /* ripples */
    }
    /* the dugout canoe (its own frame: x along the hull, the centre on the pivot): a floor, a wall with a
       pale rim, raised tips, a thwart and a paddle laid across the bow */
    c.group('canoe', function () {
      for (i = -5; i <= 5; i++) {
        var ai = Math.abs(i), hw = ai <= 3 ? 2 : ai === 4 ? 1 : 0;
        for (k = -hw; k <= hw; k++) {
          c.set(i, 0, k, 'k');
          if (ai >= 4 || Math.abs(k) === hw) c.set(i, 1, k, 'k').set(i, 2, k, 'K');
        }
      }
      c.set(-5, 3, 0, 'K').set(5, 3, 0, 'K').box(-1, -1, 1, 1, -1, 1, 'K');
      if (!lite) c.box(3, 3, 3, 3, -2, 2, 'r').box(3, 4, 3, 3, -3, -3, 'q');
    });
    for (n = 0; n < 8; n++) { lapAt(n / 8, p); anchors['c' + n] = [p.x, CN.waterY, p.z]; }
    lapAt(0, p);
    anchors.seat = [p.x, CN.seatY, p.z, 'canoe'];
    return model('jungle_canoe', pal('sSlLgabkKrqpFfEw123567', { W: PLANK }), [o, fine, [c, [p.x, CN.waterY, p.z]]],
      { pivots: { canoe: [p.x, CN.waterY, p.z], frog: CN.frog }, anchors: anchors });
  }

  var BUILD = { jungle_canoe: canoeVoxels, jungle_den: denVoxels, jungle_camp: campVoxels, jungle_falls: fallsVoxels, jungle_monkeybars: monkeybarsVoxels,
                jungle_vineswing: vineswingVoxels, jungle_drums: drumsVoxels, jungle_hammock: hammockVoxels };
  var voxels = {}, lod1 = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st) { return BUILD[id](st, null); };
    /* the 'vox-lod1' model: the plain masses (no joints, stripes, decals or decor), halved */
    lod1[id] = function (st) { var m = VX().lod(BUILD[id](st, { lite: true }), 1); m.id = id; return m; };
  });

  /* ================================================================
     FACTORY — SL3D.defineVox('jungle-a', K → {id: {voxels, lod1, act, forget, idle?, show?}})
     ================================================================ */
  function factory() {
    var M = mo(), L = look(), LOOKS = (L && L.LOOK) || {};
    var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], EP = [0, 0, 0], HP = [0, 0, 0], _l = {};
    var FLY = { token: 'PX Jungle Parrot Blue' };
    function pose(a, name, rx, ry, rz, x, y, z, sx, sz) {
      var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
      if (!pv || typeof pv.set !== 'function') return;
      R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = x; P3[1] = y; P3[2] = z; S3[0] = sx || 1; S3[2] = sz || 1;
      pv.set(R3, P3, S3);
    }
    function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0); }
    function setState(a, key, v) { if (a && typeof a.state === 'function') { try { a.state(key, v); } catch (e) { /* no such part on this copy */ } } }
    function emit(a, kind, at, n, opts) { if (a && typeof a.emit === 'function') { try { a.emit(kind, at, n, opts); } catch (e) { /* fx is optional */ } } }
    function tierOf(a) { return (a && a.template && a.template.tier) || 'MID'; }
    /* the pet's part (the crew owns it: a generic seat / trail / stand perform, or a named kind) */
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
    /* per-copy memory (the lantern's level, the falls' drip tick, a still idle): dropped when the uid's copy changes */
    var memo = new Map(), live = new Map();
    function mem(a) {
      var m = memo.get(a.uid), c = a.batch || a.object || null;
      if (!m || m.copy !== c) { m = { copy: c, lamp: -1, tick: -1, still: false }; memo.set(a.uid, m); }
      return m;
    }
    function forget(uid) { memo.delete(uid); live.delete(uid); }
    /* an own cue list under reduced motion: its sounds at t = 0 and one sparkle (as SLMotion's) */
    function stillCues(list) {
      var out = list.filter(function (c) { return c.sfx; }).map(function (c) { var q = {}; for (var k in c) q[k] = c[k]; q.t = 0; return q; });
      out.push({ t: 0, emit: 'sparkle', n: 1 });
      return out;
    }
    /* one act per uid on its SLMotion timeline: sample → apply, cues → sfx / fx. spec {apply(a, out, t,
       me), rest(a, reduced), at?(cue, out) → local point, cut? (own seconds), cues? (own list)} */
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

    /* ---------- hammock: the sling rocks about the line through its hooks ---------- */
    var hammockSpec = { apply: function (a, out) { pose(a, 'sling', HM.deg * (out.swing || 0), 0, 0, 0, 0, 0); }, rest: function (a) { rest(a, 'sling'); } };

    /* ---------- log drums: the head that is hit dips one voxel; two leaves shake loose on the last beat ---------- */
    var drumSpec = {
      apply: function (a, out, t) {
        var hit = DR.beats[beatAt(t)];
        for (var n = 0; n < 3; n++) pose(a, 'd' + n, 0, 0, 0, 0, n === hit ? -DR.dip * (out.bob || 0) : 0, 0);
      },
      rest: function (a) { for (var n = 0; n < 3; n++) rest(a, 'd' + n); },
      at: function () { return DR.leaf; }
    };

    /* ---------- vine swing: SLMotion's pendulum for one period, toward us first ---------- */
    var amp = (M && M.SWING && M.SWING.amp) || 38;
    var vineSpec = { cut: VS.cut, cues: VS.cues, apply: function (a, out, t) { pose(a, 'swing', -vineDeg(out.deg, t, amp), 0, 0, 0, 0, 0); }, rest: function (a) { rest(a, 'swing'); } };

    /* ---------- monkey bars: the twined leaves hop and tilt at each swing ---------- */
    var barsSpec = { apply: function (a, out) { pose(a, 'leaves', 0, 0, MB.tilt * (out.bob || 0), 0, MB.hop * (out.bob || 0), 0); }, rest: function (a) { rest(a, 'leaves'); } };

    /* ---------- explorer camp: the flap lifts, the spyglass sweeps, a blue butterfly drifts past ---------- */
    var campSpec = {
      apply: function (a, out, t, me) {
        pose(a, 'flap', -CP.flapDeg * (out.bob || 0), 0, 0, 0, 0, 0);
        pose(a, 'scope', 0, scopeDeg(out.k, t), 0, 0, 0, 0);
        if (me.mark < 0 && t >= CP.flyAt) { me.mark = 1; emit(a, 'sparkle', CP.fly, 3, FLY); }
      },
      /* reduced motion keeps the flap open (the pet is at the spyglass) */
      rest: function (a, reduced) { pose(a, 'flap', reduced ? -CP.flapDeg : 0, 0, 0, 0, 0, 0); rest(a, 'scope'); }
    };
    /* the lantern follows the night (a steady glow, written only when it moves) */
    function campShow(a, k) {
      var m = mem(a), v = Math.round(20 * clamp01(+k || 0)) / 20;
      if (v !== m.lamp) { m.lamp = v; setState(a, 'lamp', v); }
    }

    /* ---------- rope-ladder den: the ladder sways while the pet climbs it ---------- */
    var denSpec = {
      apply: function (a, out, t) { var k = out.k || 0; pose(a, 'ladder', 0, 0, k < DN.climb ? DN.sway * Math.sin(Math.PI * k / DN.climb) * Math.sin(TAU * DN.swayHz * t) : 0, 0, 0, 0); },
      rest: function (a) { rest(a, 'ladder'); }
    };

    /* ---------- waterfall: the sheet surges, splash cubes burst at its foot, the frog hops to the rim and back ---------- */
    var fallsSpec = {
      cut: FL.cut, cues: FL.cues,
      apply: function (a, out) {
        var c = clamp01(((out.c || 0) + 0.5 * (out.r || 0)) / 0.9);
        pose(a, 'water', 0, 0, 0, 0, 0, 0, 1 + FL.widen * c, 1 + FL.surge * c);
        hopAt((out.l || 0) / 0.9, FL.hop, FL.hopH, HP);
        pose(a, 'frog', 0, 0, 0, HP[0], HP[1], HP[2]);
      },
      rest: function (a) { rest(a, 'water'); rest(a, 'frog'); },
      at: function () { return FL.foot; }
    };
    var drops = (LOOKS.jungle_falls && LOOKS.jungle_falls.idle && LOOKS.jungle_falls.idle.drops) || { LOW: 0, MID: 20, HIGH: 40 };
    /* falling drops off the lip: a few every FL.every s keep about drops[tier] alive (none on LOW or under reduced motion) */
    function fallsIdle(a) {
      var want = a.reduced ? 0 : drops[tierOf(a)] || 0, m = mem(a), n = Math.floor((+a.t || 0) / FL.every);
      if (!want) return false;
      if (n !== m.tick) {
        m.tick = n;
        EP[0] = FL.lip[0] + FL.lipHalf * (((n * 7) % 9) / 4 - 1); EP[1] = FL.lip[1] - 0.25 * ((n * 5) % 4); EP[2] = FL.lip[2];
        emit(a, 'drop', EP, Math.max(1, Math.round(want * FL.every / FL.dropLife)));
      }
      return true;
    }

    /* ---------- canoe creek: one lap of the lane; the frog hops out of the way; two wake drops every half second ---------- */
    function frogPose(a, v) { hopAt(v, CN.hop, CN.hopH, HP); pose(a, 'frog', 0, 0, 0, HP[0], HP[1], HP[2]); }
    var canoeSpec = {
      apply: function (a, out, t, me) {
        var k = out.k || 0;
        lapAt(k, _l);
        pose(a, 'canoe', 0, _l.yaw, 0, _l.x - CN.lane.x0, 0, _l.z - CN.lane.zf);
        frogPose(a, out.bob || 0);
        if (k > 0 && k < 1 && t - me.mark >= CN.wake) { me.mark = t; EP[0] = _l.x; EP[1] = CN.waterY + 0.0625; EP[2] = _l.z; emit(a, 'drop', EP, 2); }
      },
      rest: function (a) { rest(a, 'canoe'); rest(a, 'frog'); }
    };
    var bob = (LOOKS.jungle_canoe && LOOKS.jungle_canoe.idle) || { amp: CN.bob, period: CN.bobPeriod, tiers: ['MID', 'HIGH'] };
    /* the canoe bobs at its mooring on MID / HIGH (still on LOW, under reduced motion and during its lap) */
    function canoeIdle(a) {
      var m = mem(a), on = !a.reduced && bob.tiers.indexOf(tierOf(a)) >= 0;
      if (live.get(a.uid)) return true;
      if (!on) { if (m.still) return false; m.still = true; rest(a, 'canoe'); return true; }
      m.still = false;
      pose(a, 'canoe', 0, 0, 0, 0, bob.amp * Math.sin(TAU * ((+a.t || 0) / bob.period + (+a.phase || 0))), 0);
      return true;
    }

    var SPEC = { jungle_canoe: canoeSpec, jungle_den: denSpec, jungle_camp: campSpec, jungle_falls: fallsSpec, jungle_monkeybars: barsSpec,
                 jungle_vineswing: vineSpec, jungle_drums: drumSpec, jungle_hammock: hammockSpec }, out = {};
    IDS.forEach(function (id) {
      out[id] = { voxels: voxels[id], lod1: lod1[id], forget: forget, act: function (a) { return run(a, id, SPEC[id]); } };
    });
    out.jungle_canoe.idle = canoeIdle; out.jungle_falls.idle = fallsIdle; out.jungle_camp.show = campShow;
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, HELPERS: HELPERS, TOKENS: TOKENS, MAP: MAP, voxels: voxels, lod1: lod1, factory: factory,
    LAYOUT: { hammock: HM, drums: DR, vineswing: VS, monkeybars: MB, camp: CP, den: DN, falls: FL, canoe: CN },
    lapAt: lapAt, hopAt: hopAt, beatAt: beatAt, vineDeg: vineDeg, scopeDeg: scopeDeg, inCreek: inCreek, onBank: onBank, onIslet: onIslet
  };
}));
