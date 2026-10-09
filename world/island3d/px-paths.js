/* ================================================================
   My Island v3 — SLPxPaths (W2.2): the voxel paths and the castle wall (PX3; pure: no THREE, no DOM).
   window.SLPxPaths + SL3D.defineVox('paths', factory) in the browser, module.exports in Node.
     path_stone path_wood path_flower path_pier path_logs path_bark path_cobble path_ice
     path_bamboo path_carpet path_pebble (the land shops)                                  pieces: true
     castle_wall                                                                           joins: true

   PATHS sit on the PATH grid [0.125, 0.0625, 0.125]: one cell is 8 × 1 × 8 voxels, 1/16 u high, soft
   (terrain) bevels with the D2 pattern of the id (plank / cobble / ice / snow). A piece comes from
   the cell's N1 E2 S4 W8 neighbour mask (SLIslandLook.pathPiece): single | end | straight | corner |
   tee | cross, authored canonical (end opens N = −z = k 0, straight N-S, corner N+E, tee N+E+W) and
   turned by the copy's yaw. The walk is the 6 × 6 core plus a one-voxel arm to every CONNECTED edge,
   so arms reach the cell edge and an edge that does not connect keeps one voxel of the ground
   showing (the grass trim; the stepping stones dot it with flowers). Three layouts per piece
   (PATH_LAYOUTS LOW 1 / MID 1 / HIGH 3), all ≤ 100 tris. Bamboo: slats across the walk, every
   third one golden and knotted with rope. Carpet: a red runner, gold edging on its free sides only,
   a woven knot (layout 1) or a gold sun in its rays (layout 2). Pebble: slate stones in a white
   snow edge.
     stateKey 'p:<piece>[:<layout>]'; anything else ('base': photocards, shop icons) → single, layout 0
     pose(mask, uid, layouts) → {stateKey, st: {piece, layout}, yaw (degrees)} — the layout and a free
       quarter turn for the symmetric pieces are hashed from the uid (the v2 hash, so a copy keeps its turn)

   CASTLE WALL (G8, 1.0 u tall, 0.5 u thick): the mask counts castle_wall copies on the same island.
   Battlements follow one rule on every piece — along a run the top reads gap, merlon, merlon, gap,
   gap, merlon, merlon, gap — which is symmetric and continues across cells, so any two pieces join at
   any yaw. Where two runs cross the rule leaves a small hollow turret; a lone copy is a stub tower.
   Stone in hashed 2 × 1 block pairs over a darker base course.
     stateKey 'w:<piece>:v<n>' (variants: 0 plain, 1 ivy, 2 flower pot; D57); 'v:<n>' → the stub tower
     wallPose(mask, uid) → {stateKey, st: {piece, variant}, yaw}; the variant is SLIslandLook.variantOf
     D106 (LOW ≤ 160 tris, 'vox-lod1' ≤ 112): the stone tones are recoloured wall voxels, which no lod
       tag can take away without leaving holes, so LOW has a piece of its own. voxels(st, ctx) with
       ctx.tier 'LOW' or ctx.lod 1 (the kit's LOW templates, and its 'vox-lod1' ones on every tier)
       builds it: the same battlements in one stone, in three layers (wall, merlons, extras) so no
       AO seam splits a quad and the 2× coarsening keeps each merlon. Every other call gets the MID /
       HIGH model, whose merlons, pot and proud leaves are lod 'mid' detail: meshed at LOW by a
       caller that names no tier (displayVoxels, coverage) it is the wall up to its walk and no more,
       inside the LOW cap, and such a caller's own V.lod of it is inside the LOD1 cap.
     act 'knock' (D86): two knocks and a dust puff, sound and fx only (see knocker)

   Colour tokens only (LOOK[id].colors first). Nothing here awards or spends anything; no pivot moves.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPaths = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('paths', api.factory);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPaths: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 1, LAYOUTS = 3, WALL_VARIANTS = 3;
  var PATH_LAYOUTS = Object.freeze({ LOW: 1, MID: 1, HIGH: 3 });
  var PATH_IDS = ['path_stone', 'path_wood', 'path_flower', 'path_pier', 'path_logs', 'path_bark', 'path_cobble', 'path_ice',
                  'path_bamboo', 'path_carpet', 'path_pebble'];
  var IDS = PATH_IDS.concat(['castle_wall']);
  var PIECES = ['single', 'end', 'straight', 'corner', 'tee', 'cross'];
  var PIECE_MASK = Object.freeze({ single: 0, end: 1, straight: 5, corner: 3, tee: 11, cross: 15 });   /* N 1 · E 2 · S 4 · W 8 */
  var PATH_GRID = [0.125, 0.0625, 0.125];
  var KEY = /^(?:p:(single|end|straight|corner|tee|cross)(?::(\d+))?|w:(single|end|straight|corner|tee|cross)(?::v(\d+))?|v:(\d+))$/;

  /* ---------------- hashes, keys, poses (pure) ---------------- */
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* FNV-1a 32 and an independent [0, 1) value per (seed, n): SLIslandLook's own pair */
  function fnv(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mix01(seed, n) {
    var h = (seed ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /* the canonical piece of a neighbour mask (= SLIslandLook.pathPiece: +90° yaw carries N onto W) */
  function rotMask(m) { return (m & 1 ? 8 : 0) | (m & 2 ? 1 : 0) | (m & 4 ? 2 : 0) | (m & 8 ? 4 : 0); }
  var PIECE_OF = {};
  PIECES.forEach(function (p) {
    var m = PIECE_MASK[p];
    for (var q = 0; q < 4; q++) { if (!PIECE_OF[m]) PIECE_OF[m] = { piece: p, yawDeg: 90 * q }; m = rotMask(m); }
  });
  function pathPiece(mask) { var p = PIECE_OF[(mask | 0) & 15]; return { piece: p.piece, yawDeg: p.yawDeg }; }
  function clampInt(v, n) { v = v | 0; return v < 0 ? 0 : v >= n ? n - 1 : v; }
  function pathKey(piece, layout) { return own(PIECE_MASK, piece) ? 'p:' + piece + (layout > 0 ? ':' + clampInt(layout, LAYOUTS) : '') : 'base'; }
  function wallKey(piece, variant) { return 'w:' + (own(PIECE_MASK, piece) ? piece : 'single') + ':v' + clampInt(variant, WALL_VARIANTS); }
  /* stateKey → {piece, layout, variant, tile (true: not a piece key, the stand-alone display)} */
  function parseKey(key) {
    var m = KEY.exec(String(key == null ? '' : key)) || [];
    return { piece: m[1] || m[3] || 'single', layout: clampInt(m[2], LAYOUTS), variant: clampInt(m[4] != null ? m[4] : m[5], WALL_VARIANTS), tile: !(m[1] || m[3]) };
  }
  /* what a build draws: the style the pose handed over wins, then the stateKey */
  function pieceOf(st, ctx) {
    var k = parseKey(ctx && ctx.stateKey), s = st && typeof st === 'object' ? st : {};
    return {
      piece: own(PIECE_MASK, s.piece) ? s.piece : k.piece,
      layout: s.layout != null ? clampInt(s.layout, LAYOUTS) : k.layout,
      variant: s.variant != null ? clampInt(s.variant, WALL_VARIANTS) : k.variant
    };
  }
  /* the symmetric pieces take a free turn from the uid (single and cross a quarter, straight a half) */
  function turnsOf(piece, h) { return piece === 'single' || piece === 'cross' ? h % 4 : piece === 'straight' ? (h % 2) * 2 : 0; }
  /* layouts: a count 1..3 or a tier name (PATH_LAYOUTS); anything else → all three */
  function layoutsOf(n) {
    if (typeof n === 'string') n = PATH_LAYOUTS[n.toUpperCase()];
    return n >= 1 && n <= LAYOUTS ? n | 0 : LAYOUTS;
  }
  function pathPose(mask, uid, layouts) {
    var p = pathPiece(mask), h = fnv(String(uid) + '|path'), layout = (h >>> 8) % layoutsOf(layouts);
    return { stateKey: pathKey(p.piece, layout), st: { piece: p.piece, layout: layout }, yaw: (p.yawDeg + 90 * turnsOf(p.piece, h)) % 360 };
  }
  function wallPose(mask, uid) {
    var p = pathPiece(mask), h = fnv(String(uid) + '|wall'), L = look();
    var v = clampInt(L && typeof L.variantOf === 'function' ? L.variantOf(uid, 'castle_wall') : fnv(String(uid) + '|castle_wall') % WALL_VARIANTS, WALL_VARIANTS);
    return { stateKey: wallKey(p.piece, v), st: { piece: p.piece, variant: v }, yaw: (p.yawDeg + 90 * turnsOf(p.piece, h)) % 360 };
  }
  /* pose(mask, uid, layouts[, id]): a path cell by default, the wall for id 'castle_wall' */
  function pose(mask, uid, layouts, id) { return id === 'castle_wall' ? wallPose(mask, uid) : pathPose(mask, uid, layouts); }

  /* ---------------- colours ---------------- */
  function colours(id, dflt) {
    var L = look(), c = (L && L.LOOK && L.LOOK[id] && L.LOOK[id].colors) || {}, out = {};
    Object.keys(dflt).forEach(function (k) { out[k] = typeof c[k] === 'string' ? c[k] : dflt[k]; });
    return out;
  }
  function pal(mode, map) {
    var p = {};
    Object.keys(map).forEach(function (ch) { p[ch] = typeof map[ch] === 'string' ? { token: map[ch], mode: mode } : map[ch]; });
    return p;
  }

  /* ================================================================
     PATHS
     ================================================================ */
  /* the walk of a piece on its 8 × 8 cell (index k × 8 + i): the 6 × 6 core plus a one-voxel arm to
     every connected edge; round: a core corner is cut where neither of its two edges connects */
  function walk(mask, round) {
    var w = [];
    for (var k = 0; k < 8; k++) for (var i = 0; i < 8; i++) {
      var ci = i > 0 && i < 7, ck = k > 0 && k < 7;
      var on = (ci && ck) || (ci && (k ? mask & 4 : mask & 1) > 0) || (ck && (i ? mask & 2 : mask & 8) > 0);
      if (on && round && ci && ck && (i === 1 || i === 6) && (k === 1 || k === 6) && !(mask & (k === 1 ? 1 : 4)) && !(mask & (i === 6 ? 2 : 8))) on = false;
      w.push(on);
    }
    return w;
  }
  function fill(c, fn) { for (var k = 0; k < 8; k++) for (var i = 0; i < 8; i++) if (c.w[k * 8 + i]) c.o.set(i, 0, k, fn(i, k)); }
  /* recolour a walk voxel (never adds one outside the walk) */
  function dab(c, i, k, ch) { if (c.o.has(i, 0, k)) c.o.set(i, 0, k, ch); }
  /* n hashed walk voxels → fn(i, k, n) (deterministic order; spaced: never two side by side) */
  function scatter(c, n, salt, fn) {
    var list = [], taken = {};
    for (var k = 0; k < 8; k++) for (var i = 0; i < 8; i++) if (c.w[k * 8 + i]) list.push([mix01(c.seed + salt, k * 8 + i), i, k]);
    list.sort(function (a, b) { return a[0] - b[0] || a[2] * 8 + a[1] - b[2] * 8 - b[1]; });
    for (var e = 0, done = 0; e < list.length && done < n; e++) {
      var x = list[e][1], z = list[e][2];
      if (taken[x + ',' + z]) continue;
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) taken[(x + dx) + ',' + (z + dz)] = 1;
      fn(x, z, done++);
    }
  }
  /* a walk voxel on the rim: one of its 8 neighbours inside the cell is trim, so a rim line runs on
     round corners, down the arms and from tile to tile, and never across a connected edge */
  function rim(c, i, k) {
    for (var dk = -1; dk <= 1; dk++) for (var di = -1; di <= 1; di++) {
      var x = i + di, z = k + dk;
      if (x >= 0 && x < 8 && z >= 0 && z < 8 && !c.w[z * 8 + x]) return true;
    }
    return false;
  }
  /* boards across the walk, two voxels each (layout 1 swaps the tones, layout 2 shifts them a voxel) */
  function board(k, L) { return ((L === 2 ? (k + 1) >> 1 : (k >> 1) + L) & 1) > 0; }

  /* four flagstones in two greys. Grass shows where they meet: a diagonal pair of gaps in the middle
     and a notch in the rim between two stones — mid-side on a free edge, on the arm of a connected
     one (both quarter-turn orbits, so the neighbour's notch faces ours across the path) */
  var STONE_NOTCH = [[1, 4, 1, 1, 0], [2, 6, 4, 7, 1], [4, 3, 6, 6, 7], [8, 1, 3, 0, 6]];   /* edge bit, free [i, k], connected [i, k] */
  function drawStone(c) {
    var L = c.layout;
    fill(c, function (i, k) { return ((i >> 2) + (k >> 2) + L) & 1 ? 'h' : 's'; });
    (L ? [[4, 3], [3, 4]] : [[3, 3], [4, 4]]).forEach(function (g) { c.o.clear(g[0], 0, g[1]); });
    STONE_NOTCH.forEach(function (e) { if (c.mask & e[0]) c.o.clear(e[3], 0, e[4]); else c.o.clear(e[1], 0, e[2]); });
  }
  /* four teak planks across the walk; nail heads (G16, MID / HIGH) on every other plank */
  function drawWood(c) {
    var L = c.layout, nails = vox().grid({ grid: 0.0625, origin: [8, 0, 8] });
    fill(c, function (i, k) { return board(k, L) ? 'b' : 'a'; });
    for (var r = L & 1; r < 4; r += 2) [3, 12].forEach(function (x) {
      var z = 4 * r + (L === 2 ? 3 : 1);
      if (z < 16 && c.w[(z >> 1) * 8 + (x >> 1)]) nails.set(x, 1, z, 'n');
    });
    if (nails.count) c.layers.push({ vox: nails.snapshot() });
  }
  /* a rounded stepping stone, half a pebble on every connected edge (the neighbour brings the other
     half), little flowers between */
  var FLOWER_SLOTS = [[1, 1], [6, 6], [6, 1], [1, 6], [3, 1], [4, 6], [6, 3], [1, 4]];
  var FLOWERS = { single: 6, end: 5, straight: 5, corner: 4, tee: 4, cross: 3 };
  function drawFlower(c) {
    var o = c.o, m = c.mask, L = c.layout;
    o.box(2, 5, 0, 0, 2, 5, 's');
    [[2, 2], [5, 2], [2, 5], [5, 5]].forEach(function (g) { o.clear(g[0], 0, g[1]); });
    if (m & 1) o.box(3, 4, 0, 0, 0, 0, 't');
    if (m & 2) o.box(7, 7, 0, 0, 3, 4, 't');
    if (m & 4) o.box(3, 4, 0, 0, 7, 7, 't');
    if (m & 8) o.box(0, 0, 0, 0, 3, 4, 't');
    for (var n = 0; n < FLOWERS[c.piece]; n++) {
      var s = FLOWER_SLOTS[(n + L * 3) % FLOWER_SLOTS.length];
      o.set(s[0], 0, s[1], 'pyw'[(n + L) % 3]);
    }
  }
  /* sun-bleached boards; the walk's rim is a white rail board wherever it meets the trim (the 8
     neighbours inside the cell), so the rail runs on round corners and from tile to tile */
  function drawPier(c) {
    var L = c.layout;
    fill(c, function (i, k) { return rim(c, i, k) ? 'r' : board(k, L) ? 'q' : 'p'; });
  }
  /* log rounds (a bark ring, dark or light, round pale heartwood) set into a moss bed */
  var LOGS = { single: [[2, 2]], end: [[1, 0], [3, 3]], straight: [[1, 0], [3, 4]], corner: [[1, 0], [4, 3]], tee: [[2, 0], [0, 3], [4, 3]], cross: [[1, 0], [3, 4]] };
  function drawLogs(c) {
    var L = c.layout, o = c.o;
    fill(c, function () { return 'm'; });
    LOGS[c.piece].forEach(function (p, n) {
      /* layout 1 mirrors the rounds (the corner across its own diagonal), layout 2 keeps them */
      var x0 = p[0], z0 = p[1];
      if (L === 1) { if (c.piece === 'corner') { x0 = 4 - p[1]; z0 = 4 - p[0]; } else x0 = 4 - p[0]; }
      for (var dz = 0; dz < 4; dz++) for (var dx = 0; dx < 4; dx++) {
        var edge = dx === 0 || dx === 3, end = dz === 0 || dz === 3;
        if (!(edge && end)) dab(c, x0 + dx, z0 + dz, edge || end ? (n & 1 ? 'r' : 'd') : 'l');
      }
    });
    scatter(c, L === 2 ? 3 : 2, 7, function (i, k) { if (o.get(i, 0, k) === 'm') o.set(i, 0, k, 'n'); });
  }
  /* bark chips in three browns, the edge broken by moss */
  var CHIPS = { single: 6, end: 6, straight: 6, corner: 6, tee: 5, cross: 4 };
  function drawBark(c) {
    var o = c.o;
    fill(c, function () { return 'b'; });
    scatter(c, CHIPS[c.piece], 3, function (i, k, n) {
      o.set(i, 0, k, n & 1 ? 'd' : 'c');
      if (n < 2) dab(c, i + 1, k, n & 1 ? 'd' : 'c');
    });
    /* moss creeps onto the first two edges that do not connect */
    [[1, 2, 1], [2, 6, 5], [4, 5, 6], [8, 1, 2]].filter(function (e) { return !(c.mask & e[0]); }).slice(0, 2).forEach(function (e) {
      dab(c, e[1], e[2], 'm'); dab(c, e[1] + (e[0] & 5 ? 1 : 0), e[2] + (e[0] & 10 ? 1 : 0), 'm');
    });
  }
  /* chunky cobbles: 2 × 2 blocks in staggered rows, three stone tones by hash */
  function drawCobble(c) {
    fill(c, function (i, k) {
      var r = k >> 1, h = mix01(c.seed, ((i + (r & 1)) >> 1) * 8 + r);
      return h < 0.1 ? 'm' : h < 0.45 ? 'h' : 'c';
    });
  }
  /* frosty 2 × 2 tiles in two blues with a few white flecks */
  var FLECKS = { single: 3, end: 3, straight: 3, corner: 2, tee: 2, cross: 1 };
  function drawIce(c) {
    var L = c.layout;
    fill(c, function (i, k) { return ((i >> 1) + (k >> 1) + L) & 1 ? 'j' : 'i'; });
    scatter(c, FLECKS[c.piece], 11, function (i, k) { c.o.set(i, 0, k, 'w'); });
  }
  /* split-bamboo slats across the walk, every third one golden (the layout moves them along) and
     tied down with a rope knot where it meets the trim; a tuft of moss sits on the rim of the
     first two edges that do not connect */
  var TUFTS = [[1, 4, 1], [2, 6, 4], [4, 3, 6], [8, 1, 3]];   /* edge bit, [i, k] */
  function drawBamboo(c) {
    var L = c.layout;
    fill(c, function (i, k) { return (k + L) % 3 !== 2 ? 'a' : rim(c, i, k) ? 'r' : 'b'; });
    TUFTS.filter(function (e) { return !(c.mask & e[0]); }).slice(L & 1, (L & 1) + 2).forEach(function (e) { dab(c, e[1], e[2], 'm'); });
  }
  /* a red runner with gold edging wherever it meets the trim (its free sides only: the carpet runs
     on from tile to tile). Layout 1 weaves a deeper-red knot into the middle; layout 2 is the gold
     sun in a ring of deeper-red rays (D32: a pictogram, no words; HIGH lays one copy in three with
     it). The gold of the sun never touches the edging */
  var KNOT = [[2, 2], [5, 2], [3, 3], [4, 3], [3, 4], [4, 4], [2, 5], [5, 5]];
  var RAYS = [[3, 2], [4, 2], [2, 3], [5, 3], [2, 4], [5, 4], [3, 5], [4, 5]];
  function drawCarpet(c) {
    var L = c.layout;
    fill(c, function (i, k) { return rim(c, i, k) ? 'g' : 'r'; });
    if (L) (L === 2 ? RAYS : KNOT).forEach(function (p) { c.o.set(p[0], 0, p[1], 'd'); });
    if (L === 2) c.o.box(3, 4, 0, 0, 3, 4, 'g');
  }
  /* slate pebbles pressed into snow: 2 × 2 stones in staggered rows, three blue-greys by hash, and
     a white snow edge wherever the walk meets the trim (dark enough to read on snow and on grass) */
  function drawPebble(c) {
    fill(c, function (i, k) {
      if (rim(c, i, k)) return 'w';
      var r = k >> 1, h = mix01(c.seed, ((i + (r & 1)) >> 1) * 8 + r);
      return h < 0.25 ? 'q' : h < 0.55 ? 'o' : 'p';
    });
  }

  /* id → {draw, round, palette()} (tokens from LOOK[id].colors, these as the fallback) */
  var PATHS = {
    path_stone: { draw: drawStone, round: true, palette: function () { var c = colours('path_stone', { stone: 'Pebble' }); return pal('soft', { s: c.stone, h: 'PX Castle Stone 2' }); } },
    path_wood: { draw: drawWood, round: false, palette: function () {
      var c = colours('path_wood', { plankA: 'Teak Light', plankB: 'Teak' });
      return pal('plank', { a: c.plankA, b: c.plankB, n: { token: 'PX Tree Bark', lod: 'mid' } });
    } },
    path_flower: { draw: drawFlower, round: false, palette: function () {
      var c = colours('path_flower', { stone: 'Stepping Stone', f1: 'Tulip Pink', f2: 'Tulip Yellow', f3: 'Cloud White' });
      return pal('soft', { s: c.stone, t: 'Pebble', p: { token: c.f1 }, y: { token: c.f2 }, w: { token: c.f3 } });
    } },
    path_pier: { draw: drawPier, round: false, palette: function () {
      var c = colours('path_pier', { main: 'PX Pier Plank', second: 'PX Pier Plank Shade' });
      return pal('plank', { p: c.main, q: c.second, r: { token: 'Cloud White', mode: 'soft' } });
    } },
    path_logs: { draw: drawLogs, round: true, palette: function () {
      var c = colours('path_logs', { main: 'PX Jungle Bark Light', second: 'PX Jungle Bark' });
      return pal('soft', { l: 'PX Jungle Rope', d: c.second, r: c.main, m: 'PX Jungle Litter', n: 'PX Jungle Litter 2' });
    } },
    path_bark: { draw: drawBark, round: true, palette: function () {
      var c = colours('path_bark', { main: 'PX Tree Bark Trail', second: 'PX Tree Bark Trail 2' });
      return pal('soft', { b: c.main, c: c.second, d: 'PX Tree Bark', m: 'PX Tree Moss' });
    } },
    path_cobble: { draw: drawCobble, round: true, palette: function () {
      var c = colours('path_cobble', { main: 'PX Castle Stone', second: 'PX Castle Stone Shade' });
      return pal('cobble', { c: c.main, m: c.second, h: 'PX Castle Stone 2' });
    } },
    path_ice: { draw: drawIce, round: false, palette: function () {
      var c = colours('path_ice', { main: 'PX Ice 2', second: 'PX Ice Snow' });
      return pal('ice', { i: c.main, j: 'PX Ice', w: c.second });
    } },
    path_bamboo: { draw: drawBamboo, round: false, palette: function () {
      var c = colours('path_bamboo', { main: 'PX Jungle Bark Light', second: 'PX Jungle Thatch' });
      return pal('plank', { a: c.main, b: c.second, r: { token: 'PX Jungle Rope', mode: 'soft' }, m: { token: 'PX Jungle Canopy Deep', mode: 'leaf' } });
    } },
    path_carpet: { draw: drawCarpet, round: false, palette: function () {
      var c = colours('path_carpet', { main: 'PX Castle Pennant', second: 'PX Castle Gold' });
      return pal('soft', { r: c.main, g: c.second, d: 'PX Jungle Parrot Red' });
    } },
    path_pebble: { draw: drawPebble, round: true, palette: function () {
      var c = colours('path_pebble', { main: 'PX Ice Pebble', second: 'PX Ice Pebble 2' });
      return pal('cobble', { p: c.main, o: c.second, q: 'PX Ice Pebble 3', w: { token: 'PX Ice Snow', mode: 'snow' } });
    } }
  };
  function pathVoxels(id, st, ctx) {
    var spec = PATHS[id], p = pieceOf(st, ctx), mask = PIECE_MASK[p.piece];
    var c = { o: vox().grid({ grid: PATH_GRID, origin: [4, 0, 4] }), piece: p.piece, mask: mask, layout: p.layout,
              w: walk(mask, spec.round), seed: fnv(id + ':' + p.piece + ':' + p.layout), layers: [] };
    spec.draw(c);
    var m = c.o.model({ id: id, palette: spec.palette(), piece: p.piece, layout: p.layout });
    c.layers.forEach(function (ly) { m.layers.push(ly); });
    return m;
  }

  /* ================================================================
     CASTLE WALL
     ================================================================ */
  var CREN = [0, 1, 1, 0, 0, 1, 1, 0];          /* along a run: gap, merlon, merlon, gap, gap, merlon, merlon, gap */
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var WALK = 6;                                 /* the wall walk: 6 voxels (0.75 u) up; the merlons stand 2 more */
  var WALL_GRID = { grid: 0.125, origin: [4, 0, 4] };
  /* D106 detail (lod 'mid'): the twin of a char that stands above the wall walk or proud of the wall */
  var DETAIL = { s: 'S', t: 'T', g: 'h', G: 'H' };
  /* the stone of a piece on its cell: the wall up to its walk goes into o, what stands on the walk
     into crown (the same grid for the full model). low: a turret is solid, not hollow, and a cross
     keeps its turret alone */
  function stone(o, crown, piece, mask, low) {
    var i, k;
    if (piece === 'single') {
      /* the stub tower: 0.75 u square, four corner merlons round a sunk roof */
      o.box(1, 6, 0, WALK - 1, 1, 6, 's');
      for (k = 1; k < 7; k++) for (i = 1; i < 7; i++) if ((i < 3 || i > 4) && (k < 3 || k > 4)) crown.box(i, i, WALK, 7, k, k, 's');
      return;
    }
    var ns = mask & 5, ew = mask & 10, arms = !(low && mask === 15);
    for (k = 0; k < 8; k++) for (i = 0; i < 8; i++) {
      var ci = i > 1 && i < 6, ck = k > 1 && k < 6, up;
      if (ci && ck) up = (ns && CREN[k]) || (ew && CREN[i]) || (low && ns && ew);
      else if (ci && (k < 2 ? mask & 1 : mask & 4)) up = arms && CREN[k];
      else if (ck && (i > 5 ? mask & 2 : mask & 8)) up = arms && CREN[i];
      else continue;
      o.box(i, i, 0, WALK - 1, k, k, 's');
      if (up) crown.box(i, i, WALK, 7, k, k, 's');
    }
  }
  /* does a wall voxel show a face that is not hidden in a joint (the end of an arm on a connected edge)? */
  function shows(o, mask, i, j, k) {
    return !o.has(i, j + 1, k) ||
      (!o.has(i + 1, j, k) && !(i === 7 && mask & 2)) || (!o.has(i - 1, j, k) && !(i === 0 && mask & 8)) ||
      (!o.has(i, j, k + 1) && !(k === 7 && mask & 4)) || (!o.has(i, j, k - 1) && !(k === 0 && mask & 1));
  }
  /* MID / HIGH, and every caller that names no tier (displayVoxels: photocards, coverage) */
  function wallFull(p) {
    var mask = PIECE_MASK[p.piece], o = vox().grid(WALL_GRID), i, j, k;
    stone(o, o, p.piece, mask, false);
    /* stone: a darker base course, then hashed 2 × 1 block pairs in running bond (a pair that would
       only show inside a joint stays plain) */
    var seed = fnv('castle_wall:' + p.piece);
    for (k = 0; k < 8; k++) for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) {
      if (!o.has(i, j, k)) continue;
      if (!j) o.set(i, j, k, 'd');
      else if (mix01(seed, ((i + k + (j & 1)) >> 1) * 16 + j) < 0.13 && shows(o, mask, i, j, k)) o.set(i, j, k, 't');
    }
    if (p.variant === 1) ivy(o, seed, p.piece);
    if (p.variant === 2) {
      /* a terracotta pot in the middle gap (the turret's hollow, the tower's roof): leaves, two blooms above */
      o.box(3, 4, WALK, WALK, 3, 4, 'o');
      o.box(3, 4, 7, 7, 3, 4, 'g');
      o.set(3, 8, 3, 'f'); o.set(4, 8, 4, 'y');
    }
    /* D106: the merlons, the pot and the proud leaves are detail, so this model meshed at tier LOW
       is the wall up to its walk and no more, inside the LOW cap */
    for (k = 0; k < 8; k++) for (i = 0; i < 8; i++) for (j = 1; j < 8; j++) {
      var twin = DETAIL[o.get(i, j, k)];
      if (twin && (j >= WALK || !o.has(i, 0, k))) o.set(i, j, k, twin);
    }
    var c = colours('castle_wall', { main: 'PX Castle Stone', second: 'PX Castle Stone 2' });
    function mid(token, mode) { return mode ? { token: token, mode: mode, lod: 'mid' } : { token: token, lod: 'mid' }; }
    return o.model({ id: 'castle_wall', piece: p.piece, variant: p.variant, palette: {
      s: c.main, t: c.second, d: 'PX Castle Stone Shade', g: { token: 'PX Leaf', mode: 'leaf' }, G: { token: 'PX Leaf 2', mode: 'leaf' },
      S: mid(c.main), T: mid(c.second), h: mid('PX Leaf', 'leaf'), H: mid('PX Leaf 2', 'leaf'),
      o: mid('Peach Coral'), f: mid('PX Castle Pennant'), y: mid('PX Castle Gold') } });
  }
  /* tier LOW and LOD1 (the kit names both in ctx): the same battlements in one stone over the base
     course, ≤ 160 tris (D106). The wall up to its walk, the merlons on it and the extras (the pot,
     the blooms, the proud leaves) are three layers, so no AO seam splits their quads. A turret is
     solid and a cross is the open walk round its turret; the pot stands in the middle gap, or its
     leaves and blooms sit on the turret top */
  function wallLow(p) {
    var V = vox(), o = V.grid(WALL_GRID), crown = V.grid(WALL_GRID), extra = V.grid(WALL_GRID), i, k;
    stone(o, crown, p.piece, PIECE_MASK[p.piece], true);
    for (k = 0; k < 8; k++) for (i = 0; i < 8; i++) if (o.has(i, 0, k)) o.set(i, 0, k, 'd');
    if (p.variant === 1) ivy(o, fnv('castle_wall:' + p.piece), p.piece, crown, extra);
    if (p.variant === 2) {
      if (crown.has(3, 7, 3)) crown.box(3, 4, 7, 7, 3, 4, 'g');
      else { extra.box(3, 4, WALK, WALK, 3, 4, 'o'); extra.box(3, 4, 7, 7, 3, 4, 'g'); }
      extra.set(3, 8, 3, 'f'); extra.set(4, 8, 4, 'y');
    }
    var c = colours('castle_wall', { main: 'PX Castle Stone' });
    var m = o.model({ id: 'castle_wall', piece: p.piece, variant: p.variant, palette: {
      s: c.main, d: 'PX Castle Stone Shade', g: { token: 'PX Leaf', mode: 'leaf' }, G: { token: 'PX Leaf 2', mode: 'leaf' },
      o: 'Peach Coral', f: 'PX Castle Pennant', y: 'PX Castle Gold' } });
    [crown, extra].forEach(function (g) { if (g.count) m.layers.push({ vox: g.snapshot() }); });
    return m;
  }
  /* the kit's ctx names the tier and, for a 'vox-lod1' template, lod 1: both draw the layered piece
     (its 2× coarsening keeps a merlon as one block; the full model's would fill the gaps in) */
  function wallVoxels(st, ctx) {
    var p = pieceOf(st, ctx);
    return ctx && (ctx.tier === 'LOW' || ctx.lod === 1) ? wallLow(p) : wallFull(p);
  }
  /* ivy: drapes hanging from the wall top down two outer faces (the hashed first, then the outer
     column farthest from it, so both sides of a wall get some; the cross, the busiest piece, takes
     one); leaves stand a voxel proud of the face on joined pieces (the stub tower keeps its 0.75 u
     footprint). The LOW piece hands over its crown and extras layers: each drape is then one green
     flat on the face, with a single proud leaf (extras, so the wall face keeps its one quad) */
  function ivy(o, seed, piece, crown, extra) {
    var lite = !!crown, cols = [], proud = piece !== 'single', i, k;
    function has(x, j, z) { return o.has(x, j, z) || (lite && crown.has(x, j, z)); }
    function put(x, j, z, ch) { (lite && j >= WALK ? crown : o).set(x, j, z, ch); }
    function top(x, z) { for (var j = 7; j >= 0; j--) if (has(x, j, z)) return j; return -1; }
    for (k = 0; k < 8; k++) for (i = 0; i < 8; i++) {
      var t = top(i, k);
      if (t < 0) continue;
      DIRS.forEach(function (d, n) {
        var ni = i + d[0], nk = k + d[1];
        if (ni >= 0 && ni < 8 && nk >= 0 && nk < 8 && !o.has(ni, 0, nk)) cols.push({ i: i, k: k, d: d, top: t, h: mix01(seed + 5, (k * 8 + i) * 4 + n) });
      });
    }
    if (!cols.length) return;
    cols.sort(function (a, b) { return a.h - b.h; });
    var first = cols[0], far = cols.slice().sort(function (a, b) {
      function dist(c) { return Math.abs(c.i - first.i) + Math.abs(c.k - first.k) + (c.d === first.d ? 0 : 4); }
      return dist(b) - dist(a) || a.h - b.h;
    })[0];
    (piece === 'cross' ? [first] : [first, far]).forEach(function (c, n) {
      var len = 4 + n;
      for (var s = 0; s < len; s++) {
        var j = c.top - s;
        if (j < 1) break;
        if (lite) {
          put(c.i, j, c.k, n ? 'G' : 'g');
          if (proud && s === 1) extra.set(c.i + c.d[0], j, c.k + c.d[1], 'g');
          continue;
        }
        o.set(c.i, j, c.k, s & 1 ? 'G' : 'g');
        if (s < 3 && o.has(c.i + c.d[1], j, c.k + c.d[0]) && !o.has(c.i + c.d[1] + c.d[0], j, c.k + c.d[0] + c.d[1])) o.set(c.i + c.d[1], j, c.k + c.d[0], s & 1 ? 'g' : 'G');
        if (proud && (s === 1 || s === 3)) o.set(c.i + c.d[0], j, c.k + c.d[1], 'g');
      }
    });
  }

  /* 'knock', the wall's tap act (D86): SLMotion's cues and nothing else — two soft knocks and a dust
     puff at the battlement top, and the ivy and flower-pot variants shed one petal with the dust.
     No pivot moves and no piece is re-meshed. Never two on one copy (a re-tap supersedes); reduced
     motion plays both knocks and one sparkle at once.
     HANDLE used: a.uid a.reduced a.st a.stateKey · a.sfx(name, vol, step) · a.emit(kind, localPos, n) */
  var KNOCK = { name: 'knock', at: [0, 1, 0] };
  function knocker() {
    var live = new Map();
    function fire(rec, h, t) {
      while (rec.ci < rec.cues.length && rec.cues[rec.ci].t <= t + 1e-6) {
        var c = rec.cues[rec.ci++];
        try {
          if (c.sfx) { if (typeof h.sfx === 'function') h.sfx(c.sfx, c.vol, c.step); }
          else if (c.emit && typeof h.emit === 'function') h.emit(c.emit, KNOCK.at, c.n);
        } catch (e) { /* a cue never stops its act */ }
      }
    }
    function end(uid, rec) { rec.done = true; if (live.get(uid) === rec) live.delete(uid); }
    return {
      forget: function (uid) { live.delete(uid); },
      act: function (a) {
        var M = mo();
        if (!a || !M || !M.ACTS || !M.ACTS[KNOCK.name]) return null;
        var o = { reduced: !!a.reduced }, cues = M.cues(KNOCK.name, o).slice(), prev = live.get(a.uid);
        if (prev) prev.done = true;
        if (!o.reduced && pieceOf(a.st, a).variant > 0) {
          cues.filter(function (c) { return c.emit === 'dust'; }).forEach(function (c) { cues.push({ t: c.t, emit: 'petal', n: 1 }); });
          cues.sort(function (x, y) { return x.t - y.t; });
        }
        var rec = { cues: cues, ci: 0, dur: M.durOf(KNOCK.name, o), done: false };
        live.set(a.uid, rec);
        return {
          name: KNOCK.name, dur: rec.dur,
          update: function (h, tAct) {
            if (rec.done) return false;
            var t = tAct >= 0 ? +tAct : 0;
            fire(rec, h || a, t);
            if (t < rec.dur) return true;
            end(a.uid, rec);
            return false;
          },
          cancel: function () { end(a.uid, rec); }
        };
      }
    };
  }

  /* ================================================================
     REGISTRY
     ================================================================ */
  var voxels = {};
  PATH_IDS.forEach(function (id) { voxels[id] = function (st, ctx) { return pathVoxels(id, st, ctx); }; });
  voxels.castle_wall = wallVoxels;

  /* SL3D.defineVox('paths', factory): static templates; the scene asks pose() for each copy's piece
     key and yaw. Paths have no idle and no act (a tap picks the cell); the wall has its fx-only act */
  function factory() {
    var out = {}, knock = knocker();
    PATH_IDS.forEach(function (id) { out[id] = { voxels: voxels[id], pieces: true, pose: pathPose }; });
    out.castle_wall = { voxels: wallVoxels, joins: true, pose: function (mask, uid) { return wallPose(mask, uid); }, act: knock.act, forget: knock.forget };
    return out;
  }

  return {
    VERSION: VERSION, IDS: IDS, PATH_IDS: PATH_IDS, PIECES: PIECES, PIECE_MASK: PIECE_MASK, LAYOUTS: LAYOUTS, PATH_LAYOUTS: PATH_LAYOUTS,
    WALL_VARIANTS: WALL_VARIANTS, PATH_GRID: PATH_GRID, CREN: CREN, WALK: WALK, KNOCK: KNOCK,
    voxels: voxels, factory: factory,
    pose: pose, pathPose: pathPose, wallPose: wallPose, pathPiece: pathPiece, pathKey: pathKey, wallKey: wallKey, parseKey: parseKey, walk: walk
  };
}));
