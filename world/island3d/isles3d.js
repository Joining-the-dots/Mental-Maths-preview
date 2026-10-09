/* ================================================================
   My Island v3 — SLIsles3D: the sky world's layout maths and every static voxel bake (W2.8).
   window.SLIsles3D in the browser, module.exports in Node. PURE: no THREE, no DOM. Rules come
   from SLWorldCore.ISLES, positions from SLGrid3D.ISLE_LAYOUT / V3, colours from
   SLIslandLook.ISLE_THEME (tokens only; the four fall colours and the contact-shade tokens are
   registered through addTokens('isles3d', …), D50). Everything is deterministic (no Math.random).

   FRAME. A terrain model is island-LOCAL: (0, 0, 0) = the island's centre at its top (place it
   with `at` = [cx, cy, cz]; Home's is the world). Heights below the top are SLGrid3D.V3's: land
   voxels fill −0.5 … 0, the edge / beach ring −1 … −0.5, the water plane −0.75 (the slab's own
   top lies one 0.125 u row under it, so nothing is coplanar with the water mesh), slab bottom
   −2, strata from there down (treetop: a root ball from −1). Terrain voxels are 0.5 u (lod 1:
   1 u, no corner AO, half the strata layers at double height, no fine or near-only pieces).
   NO GRASS BLOCK: a voxel is one colour on every face; under every land top lies the edge token.

   API
     homeSlab(seed) / skySlab(isle) → {isle, M, field(x, z), od(x, z), inside(x, z), lobes,
       bounds, outlineOK} | null (treetop). field = signed distance (world u, + inside) to the union
       of ALL the island's cells padded 0.3 u, plus the seeded coast wobble (±0.25 u; Home's seed is
       'sl-coast-v3:' + the profile key) and Home's lobes (the boat, r 2.2; one of r 1.2 at each
       gate); the slab is field > −M (M 1.75). od = u outside that coast (the water tiers' measure).
     falls(isle, seed) → [{angle, at [x, y, z] world, dir [dx, dz], kind 'water' | 'iced', mist}]
     terrain(isle, {regions, lockedLands, lod, footprints, seed, water, mono, chunk}) →
       {isle, lod, at, model (the static rest), topChunks [{key, cells, model}], scenery [{kind, x, z}]}
       regions: Home's unlocked regions (SLGrid3D.landFrom) · lockedLands: the lands whose Home
       gate is still locked (default: all five; D56) · footprints [{x, y, w, h, path}] in cells:
       contact AO (D39) under and one voxel round every object, paths excluded; ground dressing
       keeps clear of all of them · water: bake the water top as voxels (previews, dioramas) ·
       mono (and lod 1): ONE plain VoxModel, no chunks · chunk 0: one chunk 'all' (the reference).
     topChunk(isle, key, o) → one chunk again (D70) · chunkKeys(isle, footprints) → keys touched
     mesh(model, o) → {position, normal, color, vuv, quads, tris, faces, issues, bounds} ·
       concat(list) · bake(isle, o) → {terrain, arrays, chunks {key: arrays}, tris}
       THE HALO: the fine terrain's models carry 'halo' voxels (palette copy 'halo' → a part named
       copy_halo): the neighbours across a chunk seam or a layer seam, so no hidden face is made
       and corner AO matches. mesh() drops that part — draw fine terrain through mesh() / bake(),
       never through the whole VoxModel. lod 1, mono, preview, diorama, gate and bridge have none.
     riseOrder(region, {tier, land}) → [{index, cells [{c, r, key}], delay}] (≤ 5 bands; LOW 3)
     bridge(isle) → {model (local +x from the Home gate), matrix (16, column-major: a yaw, the
       Home gate, and LIFT 0.02 u so its deck never z-fights a pad or a dock), segments [{index,
       voxels [[x, y, z, sx, sy, sz, token]]}] per 0.5 u in build order, sways: false (D83)}
     gate(isle) → the locked Home gate VoxModel (+ .place) · preview(isle, landmark) ·
       diorama(isle, landmark) → VoxModel (+ .place) · waterRegions(seed) → {isle: {rect, frames,
       frameOffset, world, y, texel, outline, tiers}} · cloudExclusion() → zones ·
       excluded(x, y, z) · checks(seed) → [{name, ok, detail}] · clearCache()
   BUDGETS (tris): fine Home ≤ 9k, pier ≤ 9k, castle ≤ 7k, other lands ≤ 6k; coarse ≤ 1.5k;
   preview ≤ 4k with its landmark. Every model culls '-y': no camera ever looks up at an island.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIsles3D = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1, TAU = Math.PI * 2, G2 = 0.5, G4 = 0.25, G8 = 0.125, G16 = 0.0625;
  var SKY = ['pier', 'jungle', 'treetop', 'castle', 'ice'], ISLES = ['home'].concat(SKY);
  var PAD = 0.3, WOB = [0.16, 0.09], MARGIN = 3, CHUNK = 4, LIFT = 0.02, SEED = 'sl-coast-v3:';
  var TIERS = [0.95, 2.05], GEM_RATE = 0.045, GATE_CLEAR = 0.4, CLOUD_CLEAR = 1.5, ATLAS = { w: 1024, h: 512, texels: 8, gutter: 2 };
  var BUDGETS = { fine: { home: 9000, pier: 9000, castle: 7000, jungle: 6000, treetop: 6000, ice: 6000 }, coarse: 1500, preview: 4000,
                  bakeMs: 13, coldMs: 52, chunkMs: 1.5 };
  /* where the falls pour off the rim, atan2(z, x) from the island's centre (sky-world worldLayout) */
  var FALLS = { home: [0.66, 2.5, -1.13], pier: [0.62], jungle: [2.9, -2.3], treetop: [], castle: [0.75, 2.39], ice: [0.55] };
  var HOME_DL = [0.2, 0.42, 0.7, 1.08, 1.58, 2.22, 3.05, 4.1];          /* pixel.js's strata insets */
  var LAND_DL = [0.2, 0.45, 0.8, 1.35, 2.1, 3.1];                       /* a land's six layers taper a little faster */
  var BOAT = { x: 8.6, z: 4.4, r: 2.2 }, GATE_R = 1.2;
  var TOKENS = { 'PX Fall': '#9FE6FF', 'PX Fall Lit': '#D9F8FF', 'PX Fall Foam': '#E6FBFF', 'PX Fall Mist': '#E5F4FF' };
  var INK = '#2B2140', CONTACT = [0, 0.1, 0.2];                          /* contact AO: the top colour mixed toward ink */
  /* how each land builds its gate pad, dock, locked gate and bridge */
  var STYLE = {
    pier: { deck: ['PX Pier Plank', 'PX Pier Plank Shade'], mode: 'plank', post: ['PX Pier Stripe Blue', 'Cloud White'], rope: 'PX Coral', accent: 'PX Sunny',
            g: G8, w: 1, h: 11, band: 2, head: 'lamp' },
    jungle: { deck: ['PX Jungle Rope', 'PX Jungle Thatch'], mode: 'plank', post: ['PX Jungle Bark Light', 'PX Jungle Thatch'], rope: 'PX Jungle Canopy',
              accent: 'PX Jungle Flower Pink', g: G8, w: 1, h: 16, band: 3, lintel: 'leaf' },
    treetop: { deck: ['PX Tree Plank', 'PX Tree Bark Trail 2'], mode: 'plank', post: ['PX Tree Bark', 'PX Tree Bark Trail'], rope: 'PX Tree Rope', accent: 'PX Tree Flag',
               g: G4, w: 1, h: 8, band: 0, lintel: 'beam', head: 'flag' },
    castle: { deck: ['PX Castle Stone', 'PX Castle Stone 2'], mode: 'cobble', post: ['PX Castle Stone 2', 'PX Castle Stone Shade'], rope: 'PX Castle Gold',
              accent: 'PX Castle Pennant', g: G4, w: 2, h: 8, band: 0, lintel: 'stone', head: 'flag' },
    ice: { deck: ['PX Ice', 'PX Ice 2'], mode: 'ice', post: ['PX Ice Snow', 'PX Ice Deep'], rope: 'PX Aurora Sky', accent: 'PX Aurora Violet',
           g: G4, w: 2, h: 7, band: 4, lintel: 'snow' }
  };
  /* ground dressing per top kind: the share of open voxels, then the kinds — G8 cubes side by side ('^': stacked) */
  var DECO = {
    home: [0.11, ['PX Home Tuft', 'PX Leaf 2'], ['PX Glint'], ['PX Sunny'], ['PX Home Tuft', 'PX Leaf 2'], ['PX Candy Pink'], ['PX Lilac']],
    meadow: [0.14, ['PX Glint'], ['PX Sunny'], ['PX Home Tuft', 'PX Leaf 2'], ['PX Candy Pink']],
    cove: [0.07, ['PX Glint'], ['PX Candy Pink'], ['PX Coral']],
    pier: [0.05, ['PX Coral'], ['PX Glint'], ['PX Candy Pink']],
    jungle: [0.09, ['PX Jungle Canopy', 'PX Jungle Canopy Light'], ['PX Jungle Flower Orange'], ['PX Jungle Canopy Deep', 'PX Jungle Canopy'], ['PX Jungle Flower Pink']],
    treetop: [0.06, ['^', 'Cloud White', 'PX Tree Toadstool'], ['PX Tree Autumn'], ['PX Tree Oak Light', 'PX Tree Oak']],
    castle: [0.08, ['PX Castle Cloth'], ['PX Castle Gold'], ['PX Castle Meadow 2', 'PX Castle Cloth']],
    ice: [0.06, ['PX Ice Snow Shade', 'PX Ice Shine'], ['PX Ice Shine'], ['^', 'PX Ice Snow Shade', 'PX Ice Snow 2']]
  };

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (!m) throw new Error('SLIsles3D: ' + name + ' is not loaded');
    return (sibs[name] = m);
  }
  function vox() { return sibling('SLVox', './vox.js'); }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function grid3() { return sibling('SLGrid3D', './grid3d.js'); }
  function core() { return sibling('SLWorldCore', '../world-core.js'); }

  /* ---------------- small helpers ---------------- */
  function h2(a, b, s) {
    var h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B) ^ Math.imul((s | 0) + 1, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  /* pixel.js's big soft colour patches */
  function patch(x, z) { return Math.sin(x * 0.62 + 0.7) * Math.cos(z * 0.71 - 0.3) + 0.55 * Math.sin((x - z) * 0.37 + 2.1) + 0.45 * Math.sin(x * 0.23 + z * 0.41 + 4.0); }
  function pick(list, p) { return list.length > 2 ? list[p > 0.6 ? 0 : p < -0.45 ? 2 : 1] : list[list.length > 1 && p < 0.05 ? 1 : 0]; }
  var tokensDone = false, SHADES = {};
  function ensureTokens() {
    if (tokensDone) return;
    look().addTokens('isles3d', TOKENS);
    tokensDone = true;
  }
  /* the contact-AO twin of a top token (level 1: the ring, 2: under a footprint) */
  function shade(tok, lv) {
    if (!lv) return tok;
    var key = tok + '|' + lv, L = look();
    if (SHADES[key]) return SHADES[key];
    var name = tok + (lv > 1 ? ' Contact 2' : ' Contact'), hex = L.resolve(tok), m = {};
    if (!hex || /^PX /.test(tok) === false) return (SHADES[key] = tok);
    m[name] = L.mixHex(hex, INK, CONTACT[lv]);
    return (SHADES[key] = L.addTokens('isles3d', m).added.length ? name : tok);
  }

  /* one palette per model: (token, mode, tag) → a char. tag 'halo': hides its neighbours' faces and
     is never drawn (its own part); 'mid': dropped on LOW */
  var ALPHA = (function () { var s = ''; for (var c = 33; c <= 126; c++) if (c !== 46) s += String.fromCharCode(c); return s; }());
  function Pal() { this.pal = {}; this.by = {}; this.n = 0; }
  Pal.prototype.c = function (token, mode, tag) {
    var key = token + '|' + (mode || '') + '|' + (tag || ''), ch = this.by[key];
    if (ch) return ch;
    if (this.n >= ALPHA.length) throw new Error('SLIsles3D: palette full');
    ch = this.by[key] = ALPHA[this.n++];
    var e = { token: token };
    if (mode && mode !== 'block') e.mode = mode;
    if (tag === 'halo') e.copy = 'halo'; else if (tag === 'mid') e.lod = 'mid';
    this.pal[ch] = e.mode || e.copy || e.lod ? e : token;
    return ch;
  };
  Pal.prototype.code = function (token, mode, tag) { return this.c(token, mode, tag).charCodeAt(0); };

  /* a dense voxel layer written straight into its snapshot (the big terrain layers) */
  function Dense(g, origin, min, dims) {
    this.grid = g; this.origin = origin; this.min = min; this.dims = dims; this.c = new Uint8Array(dims[0] * dims[1] * dims[2]);
  }
  Dense.prototype.set = function (i, j, k, code) {
    var x = i - this.min[0], y = j - this.min[1], z = k - this.min[2], d = this.dims;
    if (x >= 0 && y >= 0 && z >= 0 && x < d[0] && y < d[1] && z < d[2]) this.c[(y * d[2] + z) * d[0] + x] = code;
  };
  Dense.prototype.layer = function () {
    var vox = { grid: this.grid, origin: this.origin, min: this.min, dims: this.dims, c: this.c, p: new Uint8Array(this.c.length), names: [null] };
    return { grid: this.grid, origin: this.origin, vox: vox };
  };

  /* a build context: one palette, the dense layers and the small pieces (one Grid each, placed by `at`) */
  function Ctx(lod) { ensureTokens(); this.P = new Pal(); this.dense = []; this.pieces = []; this.scenery = []; this.near = false; this.lod = lod || 0; }
  /* a piece finer than G4 (ropes, lamps, plaques, icicles), or made while `near` is set, is left out
     of the lod 1 model: its builder draws on NOWHERE */
  var NOWHERE = { count: 0 };
  ['set', 'box', 'blob', 'lathe', 'line', 'clear', 'decal', 'hashTone'].forEach(function (k) { NOWHERE[k] = function () { return NOWHERE; }; });
  Ctx.prototype.piece = function (g, x, y, z, even) {
    if (this.lod && (this.near || (typeof g === 'number' ? g : Math.min(g[0], g[1], g[2])) < G4)) return NOWHERE;
    var p = vox().grid({ grid: g, origin: even ? [0, 0, 0] : [0.5, 0, 0.5] });
    this.pieces.push({ g: p, at: [x, y, z] });
    return p;
  };
  Ctx.prototype.model = function (id) {
    var lod = this.lod, layers = this.dense.map(function (d) { return d.layer(); }), decals = [], pl = [];
    this.pieces.forEach(function (e) {
      if (!e.g.count) return;
      e.g.decals.forEach(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.layer = layers.length + pl.length; decals.push(c); });
      pl.push({ vox: e.g.snapshot(), at: e.at });
    });
    if (lod && pl.length) { pl = vox().lod({ id: id, grid: G2, origin: [0, 0, 0], ground: false, palette: this.P.pal, layers: pl }, 1).layers; decals = []; }
    var m = { id: id, grid: G2, origin: [0, 0, 0], ground: false, cull: ['-y'], palette: this.P.pal, layers: layers.concat(pl), pivots: {}, anchors: {}, decals: decals };
    if (lod) m.ao = false;          /* far and hazed: flat faces merge into far fewer quads */
    return m;
  };

  /* ================================================================
     ISLANDS, DISTANCE FIELDS AND THE COLUMN MAP
     ================================================================ */
  var INFO = {}, MAPS = {}, MAP_KEYS = [];
  function info(isle) {
    if (INFO[isle]) return INFO[isle];
    var F = ISLES.indexOf(isle) >= 0 ? grid3().V3.frame(isle) : null;
    if (!F) return null;
    var C = core(), th = look().ISLE_THEME[isle], R = C.ISLES[isle], cols = F.cols, rows = F.rows, all = new Uint8Array(cols * rows), n = th.strata.length, dock = {};
    var dl = isle === 'home' ? HOME_DL : LAND_DL;
    C.ISLE_CELLS[isle].forEach(function (k) { var p = k.split(','); all[+p[1] * cols + +p[0]] = 1; });
    (R.dock || []).forEach(function (d) { dock[d[0] + ',' + d[1]] = 1; });
    /* thin decks on piles over the water: the pier's stem and head, the jungle's jetty */
    var deck = isle === 'pier' ? function (c, r) { return r >= 6; } : isle === 'jungle' ? function (c, r) { return !!dock[c + ',' + r]; } : null;
    return (INFO[isle] = { isle: isle, home: isle === 'home', F: F, th: th, R: R, cols: cols, rows: rows, x0: F.offset[0], z0: F.offset[1],
      cx: F.cx, cy: F.cy, cz: F.cz, slab: !!F.slab, M: F.pad, all: all, n: n, dl: dl, dock: dock, deck: deck, seed: SEED + isle });
  }
  function wobble(seed) {
    var h = grid3().hash(String(seed)), p1 = (h & 0xffff) / 65536 * TAU, p2 = (h >>> 16) / 65536 * TAU;
    return function (x, z) { var t = Math.atan2(z, x); return WOB[0] * Math.sin(5 * t + p1) + WOB[1] * Math.sin(9 * t + p2); };
  }
  function homeLobes() {
    var g = grid3().ISLE_LAYOUT.home.gates;
    return [BOAT].concat(SKY.map(function (s) { return { x: g[s][0], z: g[s][2], r: GATE_R, isle: s }; }));
  }
  /* signed distance (cell units) from grid point (gx, gz) to the union of the mask's cell squares: − inside */
  function cellDist(mask, cols, rows, gx, gz) {
    var c0 = Math.floor(gx), r0 = Math.floor(gz), inside = c0 >= 0 && r0 >= 0 && c0 < cols && r0 < rows && mask[r0 * cols + c0] === 1;
    var best = 49, R = inside ? 7 : 4;
    for (var r = r0 - R; r <= r0 + R; r++) for (var c = c0 - R; c <= c0 + R; c++) {
      if ((c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1) === inside) continue;
      var dx = gx < c ? c - gx : gx > c + 1 ? gx - c - 1 : 0, dz = gz < r ? r - gz : gz > r + 1 ? gz - r - 1 : 0, d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return inside ? -Math.sqrt(best) : Math.sqrt(best);
  }
  /* a lobe of radius r keeps the slab (field > −M) out to r round its centre */
  function lobed(f, I, lobes, lx, lz) {
    for (var q = 0; q < lobes.length; q++) {
      var dx = lx - lobes[q].x, dz = lz - lobes[q].z;
      f = Math.max(f, lobes[q].r - Math.sqrt(dx * dx + dz * dz) - I.M);
    }
    return f;
  }
  function fieldAt(I, wob, lobes, lx, lz) {
    return lobed(PAD - cellDist(I.all, I.cols, I.rows, lx + I.cols / 2, lz + I.rows / 2) + wob(lx, lz), I, lobes, lx, lz);
  }
  /* the island's slab (treetop: its lip) as a function of WORLD x, z */
  function slabOf(isle, seed) {
    var I = info(isle);
    if (!I) return null;
    var wob = wobble(I.home ? SEED + (seed == null ? '' : seed) : I.seed), lobes = I.home ? homeLobes() : [], b = I.F.bounds, p = PAD + WOB[0] + WOB[1] + I.M;
    var S = { isle: isle, M: I.M, lobes: lobes,
      field: function (x, z) { return fieldAt(I, wob, lobes, x - I.cx, z - I.cz); },
      od: function (x, z) { return Math.max(0, cellDist(I.all, I.cols, I.rows, x - I.x0, z - I.z0) - PAD - wob(x - I.cx, z - I.cz)); },
      inside: function (x, z) { return S.field(x, z) > -I.M; },
      bounds: { x0: b.x0 - p, x1: b.x1 + p, z0: b.z0 - p, z1: b.z1 + p } };
    lobes.forEach(function (l) { S.bounds.x0 = Math.min(S.bounds.x0, l.x - l.r); S.bounds.x1 = Math.max(S.bounds.x1, l.x + l.r);
      S.bounds.z0 = Math.min(S.bounds.z0, l.z - l.r); S.bounds.z1 = Math.max(S.bounds.z1, l.z + l.r); });
    /* one closed outline: every cell is inside with the beach round it, and every gate pad stands ≥ 0.5 u inside the rim */
    S.outlineOK = core().ISLE_CELLS[isle].every(function (k) { var c = k.split(','); return S.field(I.x0 + +c[0] + 0.5, I.z0 + +c[1] + 0.5) >= PAD - WOB[0] - WOB[1]; }) &&
      lobes.every(function (l) { return !l.isle || S.field(l.x, l.z) + I.M >= 0.5; });
    return S;
  }
  function homeSlab(seed) { return slabOf('home', seed); }
  function skySlab(isle) { var I = isle !== 'home' && info(isle); return I && I.slab ? slabOf(isle) : null; }

  /* the column map: per terrain voxel column (S = 0.5 fine, 1 coarse) over the grid + MARGIN — the
     slab field F, the coast of the SOLID land (unlocked, no decks) and kind 0 open sky · 1 water ·
     2 beach (treetop: lip) · 3 land; ring = the slab's outermost columns. Cached per (isle, land, seed). */
  function mapOf(I, o, lod) {
    var G = grid3(), S = lod ? 1 : G2, land = I.all, sig = 'all', seed = I.seed, cols = I.cols, rows = I.rows;
    if (I.home) {
      var keys = Object.keys(G.landFrom(o.regions)).sort();
      sig = String(G.hash(keys.join(';'))); seed = SEED + (o.seed == null ? '' : o.seed);
      land = new Uint8Array(cols * rows);
      keys.forEach(function (k) { var p = k.split(','), x = +p[1] * cols + +p[0]; if (I.all[x]) land[x] = 1; });
    }
    var key = I.isle + '|' + sig + '|' + seed + '|' + S;
    if (MAPS[key]) return MAPS[key];
    var n = 1 / S, m = MARGIN * n, w = cols * n + 2 * m, h = rows * n + 2 * m, N = w * h, wob = wobble(seed), lobes = I.home ? homeLobes() : [], solid = land;
    if (I.deck) { solid = land.slice(); for (var q = 0; q < solid.length; q++) if (I.deck(q % cols, (q / cols) | 0)) solid[q] = 0; }
    var F = new Float32Array(N), coast = new Float32Array(N), kind = new Uint8Array(N), ring = new Uint8Array(N), thB = lod ? -0.5 : -0.3, i, k, x;
    for (k = 0; k < h; k++) for (i = 0; i < w; i++) {
      x = k * w + i;
      var gx = (i - m + 0.5) * S, gz = (k - m + 0.5) * S, lx = gx - cols / 2, lz = gz - rows / 2, wv = wob(lx, lz), dA = cellDist(I.all, cols, rows, gx, gz);
      F[x] = lobed(PAD - dA + wv, I, lobes, lx, lz); coast[x] = PAD - (solid === I.all ? dA : cellDist(solid, cols, rows, gx, gz)) + wv;
      var c = Math.floor(gx), r = Math.floor(gz);
      kind[x] = c >= 0 && r >= 0 && c < cols && r < rows && land[r * cols + c] ? 3 : F[x] <= -I.M ? 0 : !I.slab || coast[x] >= thB ? 2 : 1;
    }
    for (k = 0; k < h; k++) for (i = 0; i < w; i++) {
      x = k * w + i;
      if (kind[x] && (!i || !k || i === w - 1 || k === h - 1 || !kind[x - 1] || !kind[x + 1] || !kind[x - w] || !kind[x + w])) ring[x] = 1;
    }
    var map = { I: I, S: S, n: n, m: m, w: w, h: h, i0: -m, k0: -m, F: F, coast: coast, kind: kind, ring: ring, key: key };
    MAPS[key] = map; MAP_KEYS.push(key);
    if (MAP_KEYS.length > 24) delete MAPS[MAP_KEYS.shift()];
    return map;
  }
  /* voxel (i, k) counted from the grid's corner → the map index, or −1 */
  function mx(map, i, k) { i += map.m; k += map.m; return i < 0 || k < 0 || i >= map.w || k >= map.h ? -1 : k * map.w + i; }
  function kindAt(map, i, k) { var x = mx(map, i, k); return x < 0 ? 0 : map.kind[x]; }
  function deckAt(map, i, k) { return !!map.I.deck && map.I.deck(Math.floor(i * map.S), Math.floor(k * map.S)); }
  /* local x / z of voxel i / k's centre */
  function lxOf(map, i) { return (i + 0.5) * map.S - map.I.cols / 2; }
  function lzOf(map, k) { return (k + 0.5) * map.S - map.I.rows / 2; }
  /* the outermost voxel of a wanted kind along the ray at angle a from the island's centre */
  function rayHit(map, a, want) {
    var I = map.I, S = map.S, dx = Math.cos(a), dz = Math.sin(a), hit = null;
    for (var t = 0; t < 26; t += S / 4) {
      var i = Math.floor((dx * t + I.cols / 2) / S), k = Math.floor((dz * t + I.rows / 2) / S), kd = kindAt(map, i, k);
      if (want ? kd === want : kd > 0) hit = [i, k];
    }
    return hit;
  }

  /* ---------------- falls ---------------- */
  function fallsOf(map) {
    var I = map.I, S = map.S, out = [];
    FALLS[I.isle].forEach(function (a) {
      var hit = rayHit(map, a, 0), dx = Math.cos(a), dz = Math.sin(a);
      if (!hit) return;
      var ax = Math.abs(dx) >= Math.abs(dz), nx = ax ? (dx > 0 ? 1 : -1) : 0, nz = ax ? 0 : (dz > 0 ? 1 : -1);
      if (kindAt(map, hit[0] + nx, hit[1] + nz)) { nx = ax ? 0 : (dx > 0 ? 1 : -1); nz = ax ? (dz > 0 ? 1 : -1) : 0; }
      out.push({ angle: a, kind: I.th.fallKind === 'iced' ? 'iced' : 'water', x: lxOf(map, hit[0]) + nx * S / 2, z: lzOf(map, hit[1]) + nz * S / 2, nx: nx, nz: nz });
    });
    return out;
  }
  function falls(isle, seed) {
    var I = info(isle), V3 = grid3().V3;
    if (!I) return [];
    return fallsOf(mapOf(I, { seed: seed }, 0)).map(function (f) {
      return { angle: f.angle, kind: f.kind, at: [I.cx + f.x, I.cy + V3.SEA_Y, I.cz + f.z], dir: [f.nx, f.nz],
               mist: f.kind === 'iced' ? null : [I.cx + f.x + f.nx, I.cy + (I.home ? -4.75 : -4) + G4, I.cz + f.z + f.nz] };
    });
  }
  /* the static part of a fall: a sheet hugging the wall, foam at the lip, a mist puff below (iced: a frozen pour) */
  function fallPiece(X, I, f) {
    var P = X.P, iced = f.kind === 'iced', lat = f.nx ? [0, 1] : [1, 0], toks = iced ? ['PX Ice Shine', 'PX Ice', 'PX Ice 2'] : ['PX Fall Lit', 'PX Fall'];
    var g = X.piece(G4, f.x + f.nx * G8, -2.75, f.z + f.nz * G8), hw = iced ? 2 : 1, l, j;
    for (l = -hw; l <= hw; l++) {
      var j0 = Math.abs(l) > 1 ? 5 : iced ? Math.floor(h2(l, 3, 41) * 3) : Math.abs(l) ? 2 : 0;
      for (j = j0; j < 8; j++) g.set(l * lat[0], j, l * lat[1], P.c(toks[(j + l + 8) % toks.length], iced ? 'ice' : 'soft'));
    }
    var fo = X.piece(G8, f.x - f.nx * G8, -0.75, f.z - f.nz * G8);
    [-3, -1, 0, 2, 3].forEach(function (d, q) { fo.set(d * lat[0], 0, d * lat[1], P.c(q & 1 ? 'PX Glint' : 'PX Fall Foam')); });
    fo.set(lat[0], 1, lat[1], P.c('PX Glint'));
    if (iced) return;
    X.near = true;          /* the mist puff is left out of the far model */
    reserve(X.piece(G4, f.x + f.nx, I.home ? -4.75 : -4, f.z + f.nz), -3, 0, -3, 3, 1, 3)
      .blob(0, 0.5, 0, 2.6, 1.4, 2.6, function (i, jj) { return P.c(jj ? 'PX Glint' : 'PX Fall Mist', 'soft'); }, 2);
    X.near = false;
  }

  /* ================================================================
     TERRAIN: the land's top (chunked), the edge and beach, the slab, the strata
     ================================================================ */
  /* what stands on top of land voxel (i, k): T = {tok, mode, up (Meadow Hill: 1 = +0.25, 2 = +0.5), deco} */
  function topAt(map, i, k, T) {
    var I = map.I, th = I.th, S = map.S, c = Math.floor(i * S), r = Math.floor(k * S), wx = I.x0 + (i + 0.5) * S, wz = I.z0 + (k + 0.5) * S, p = patch(wx, wz);
    T.tok = pick(th.top, p); T.mode = th.topMode; T.up = 0; T.deco = I.isle;
    if (I.home) {
      var reg = core().CELL_REGION[c + ',' + r];
      if (reg === 'meadow') { T.tok = pick(th.meadow.top, p); T.up = c < 2 ? 2 : 1; T.deco = 'meadow'; }
      else if (reg === 'cove') { T.tok = p > 0.35 ? th.beach[1] : th.cove.top[0]; T.deco = 'cove'; }
    } else if (I.isle === 'pier' ? r === 3 || r >= 6 : I.dock[c + ',' + r]) {          /* planked promenade, boardwalk and docks */
      var st = STYLE[I.isle];
      T.tok = st.deck[h2(i >> 2, k, 2) < 0.35 ? 1 : 0]; T.mode = st.mode; T.deco = null;
    } else if (I.isle === 'treetop') {                                                /* two bark-coloured clearings */
      var a = (c + 0.5 - 5.5) / 1.7, b = (r + 0.5 - 4.4) / 1.2, a2 = (c + 0.5 - 2.2) / 1.3, b2 = (r + 0.5 - 5.7) / 1.0;
      if (a * a + b * b < 1 || a2 * a2 + b2 * b2 < 1) { T.tok = th.patches.tokens[p > 0 ? 0 : 1]; T.mode = th.patches.mode; T.deco = null; }
    } else if (I.isle === 'ice' && patch(wx * 1.7 + 9, wz * 1.7 - 4) > 0.8) {                    /* pale ice patches in the snow */
      T.tok = th.patches.tokens[p > 0 ? 0 : 1]; T.mode = th.patches.mode; T.deco = null;
    }
  }
  function interior(map, x) { var kd = map.kind; return kd[x - 1] === 3 && kd[x + 1] === 3 && kd[x - map.w] === 3 && kd[x + map.w] === 3; }
  /* a footprint {x, y, w, h, path} or [x, y, w, h, path] in cells → [x, y, w, h, path] */
  function rectOf(f) { var a = Array.isArray(f); return [a ? f[0] : f.x, a ? f[1] : f.y, (a ? f[2] : f.w) || 1, (a ? f[3] : f.h) || 1, a ? f[4] : f.path]; }
  /* contact AO (D39): bits 0–1 = the level under (2) and one voxel round (1) every object, bit 2 = occupied (paths too) */
  function shadeMap(map, fps) {
    if (!fps || !fps.length) return null;
    var sh = new Uint8Array(map.w * map.h), n = map.n;
    fps.forEach(function (f) {
      var r = rectOf(f), x = r[0] * n, y = r[1] * n, w = r[2] * n, h = r[3] * n, path = r[4];
      for (var k = y - 1; k <= y + h; k++) for (var i = x - 1; i <= x + w; i++) {
        var ix = mx(map, i, k);
        if (ix >= 0) sh[ix] = 4 | Math.max(sh[ix] & 3, path ? 0 : i >= x && i < x + w && k >= y && k < y + h ? 2 : 1);
      }
    });
    return sh;
  }
  /* the tops of voxels b {i0, i1, k0, k1} into land layer D (+ the meadow ledge, the thin deck and
     the ground dressing): real inside b; with `halo`, one ring of neighbours and the layer below as halo */
  function fillTops(map, sh, P, D, b, halo) {
    var I = map.I, th = I.th, S = map.S, fine = S === G2, T = {}, pad = halo ? 1 : 0, org = [I.cols / 2 / S, 0, I.rows / 2 / S];
    var out = { led: null, deck: null, deco: null }, st = STYLE[I.isle], wI = b.i1 - b.i0 + 1 + 2 * pad, wK = b.k1 - b.k0 + 1 + 2 * pad;
    for (var k = b.k0 - pad; k <= b.k1 + pad; k++) for (var i = b.i0 - pad; i <= b.i1 + pad; i++) {
      var x = mx(map, i, k), kd = x < 0 ? 0 : map.kind[x], real = i >= b.i0 && i <= b.i1 && k >= b.k0 && k <= b.k1;
      if (kd < 2) continue;
      var deck = kd === 3 && fine && deckAt(map, i, k);
      if (halo && !deck) D.set(i, -2, k, halo);
      if (kd !== 3) continue;
      topAt(map, i, k, T);
      var lv = real && sh ? sh[x] & 3 : 0, code = real ? P.code(shade(T.tok, lv), T.mode) : halo;
      if (deck) {          /* 2 × 2 G4 voxels 0.25 u thick; the outermost wear the skirt board */
        out.deck = out.deck || new Dense(G4, [I.cols * 2, 0, I.rows * 2], [2 * (b.i0 - pad), -1, 2 * (b.k0 - pad)], [2 * wI, 1, 2 * wK]);
        for (var q = 0; q < 4; q++) {
          var i4 = 2 * i + (q & 1), k4 = 2 * k + (q >> 1), dc = halo;
          if (real) {
            var skirt = kindAt(map, (i4 - 1) >> 1, k) !== 3 || kindAt(map, (i4 + 1) >> 1, k) !== 3 ||
                        kindAt(map, i, (k4 - 1) >> 1) !== 3 || kindAt(map, i, (k4 + 1) >> 1) !== 3;
            var tok = !skirt ? st.deck[h2(i4 >> 2, k4, 2) < 0.35 ? 1 : 0] : I.isle !== 'pier' ? st.post[0] : ((i4 + k4) >> 1) & 1 ? th.rim.tokens.stripe : th.rim.tokens.skirt;
            dc = P.code(shade(tok, lv), skirt ? 'soft' : 'plank');
          }
          out.deck.set(i4, -1, k4, dc);
        }
        continue;
      }
      if (T.up === 2) { D.set(i, -1, k, real ? P.code(th.meadow.cliff, 'cobble') : halo); D.set(i, 0, k, code); }
      else {
        D.set(i, -1, k, code);
        if (T.up) {
          out.led = out.led || new Dense([S, G4, S], org, [b.i0 - pad, 0, b.k0 - pad], [wI, 1, wK]);
          out.led.set(i, 0, k, code);
        }
      }
      var dk = T.deco && DECO[T.deco];
      if (!real || !fine || !dk || (sh && sh[x]) || !interior(map, x) || h2(i, k, 7) >= dk[0]) continue;
      /* one tuft, flower, shell or toadstool on this voxel (half of them on MID / HIGH only) */
      var kn = dk[1 + Math.floor(h2(i, k, 9) * (dk.length - 1))], stack = kn[0] === '^', toks = stack ? kn.slice(1) : kn, tag = h2(i, k, 11) < 0.5 ? 'mid' : null;
      var gi = (i - b.i0) * 4 + Math.floor(h2(i, k, 3) * (stack ? 4 : 5 - toks.length)), gk = (k - b.k0) * 4 + Math.floor(h2(i, k, 5) * 4);
      out.deco = out.deco || vox().grid({ grid: G8, origin: [0, 0, 0] });
      for (q = 0; q < toks.length; q++) out.deco.set(stack ? gi : gi + q, T.up * 2 + (stack ? q : 0), gk, P.c(toks[q], null, tag));
    }
    var layers = [];
    if (out.led) layers.push(out.led.layer());
    if (out.deck) layers.push(out.deck.layer());
    if (out.deco) layers.push({ vox: out.deco.snapshot(), at: [b.i0 * S - I.cols / 2, 0, b.k0 * S - I.rows / 2] });
    return layers;
  }
  /* the static land layer: the edge under every land voxel and the beach ring (jungle / treetop: with
     moss caps); mono: the tops too, else their halo. Returns the extra top layers of a mono model. */
  function landLayer(X, map, mono) {
    var I = map.I, th = I.th, S = map.S, P = X.P, halo = mono ? 0 : P.code('PX Glint', null, 'halo'), T = {};
    var D = new Dense([S, G2, S], [I.cols / 2 / S, 0, I.rows / 2 / S], [map.i0, -2, map.k0], [map.w, 3, map.h]);
    var edge = P.code(th.edge, th.edgeMode), beach = th.beach.map(function (t) { return P.code(t, th.edgeMode); });
    var capTok = S === G2 && (th.rim.tokens.cap || th.rim.tokens.moss), cap = capTok ? P.code(capTok, th.edgeMode) : 0;
    for (var k = map.k0; k < map.k0 + map.h; k++) for (var i = map.i0; i < map.i0 + map.w; i++) {
      var x = mx(map, i, k), kd = map.kind[x];
      if (kd < 2) continue;
      if (kd === 2) {
        var two = beach.length > 1 && patch((I.x0 + (i + 0.5) * S) * 1.6, (I.z0 + (k + 0.5) * S) * 1.6) <= 0.35;
        D.set(i, -2, k, cap && h2(i, k, 5) < 0.3 ? cap : beach[two ? 1 : 0]);
        continue;
      }
      if (deckAt(map, i, k)) continue;          /* fine: a thin deck over the water; coarse: a plain top voxel, no edge under it */
      D.set(i, -2, k, edge);
      if (!mono) { topAt(map, i, k, T); D.set(i, -1, k, halo); if (T.up === 2) D.set(i, 0, k, halo); }
    }
    X.dense.push(D);
    return mono ? fillTops(map, null, P, D, { i0: 0, i1: I.cols * map.n - 1, k0: 0, k1: I.rows * map.n - 1 }, 0) : [];
  }
  /* the water slab as one solid: banded wall rows under the lip row on the rim, the sandy floor one
     step (0.125 u) under the water plane (water: one row more, the water top itself by tier), and a
     lower top (−1) under the land and the beach */
  function slabLayer(X, map, mono, water) {
    var I = map.I, th = I.th, S = map.S, fine = S === G2, hy = fine ? G8 : G4, dry = fine ? 7 : 3, R = dry + (water ? 3 : 2), P = X.P, band = [], r;
    var D = new Dense([S, hy, S], [I.cols / 2 / S, 2 / hy, I.rows / 2 / S], [map.i0, 0, map.k0], [map.w, R + 1, map.h]), halo = mono ? 0 : P.code('PX Glint', null, 'halo');
    for (r = 0; r < R; r++) {
      band.push(r === R - 1 ? (I.isle === 'ice' ? P.code('PX Ice Snow', 'snow') : P.code(th.slab.wall[0], 'soft'))
        : P.code(th.slab.wall[fine ? Math.min(8, R - 1 - r) : 4], 'soft'));
    }
    var tops = (water ? th.slab.tops : th.slab.floor).map(function (t) { return P.code(t, 'soft'); });
    for (var k = map.k0; k < map.k0 + map.h; k++) for (var i = map.i0; i < map.i0 + map.w; i++) {
      var x = mx(map, i, k), kd = map.kind[x];
      if (!kd) continue;
      var wet = kd === 1 || (kd === 3 && deckAt(map, i, k)), top = wet ? R - 1 : dry;
      for (r = 0; r <= top; r++) D.set(i, r, k, band[r]);
      if (wet && !map.ring[x]) D.set(i, top, k, tops[-map.coast[x] < TIERS[0] ? 0 : -map.coast[x] < TIERS[1] ? 1 : 2]);
      else if (halo && !wet) D.set(i, top + 1, k, halo);
    }
    X.dense.push(D);
  }
  /* the underside: an upside-down layer cake stepping inward, glow gems on its rings from layer 2
     (the castle's first two layers are square foundation blocks; lod 1: every other layer, 1 u thick) */
  function strataLayer(X, map, mono) {
    var I = map.I, S = map.S, fine = S === G2, t = fine ? G2 : 1, n = fine ? I.n : I.n >> 1, yS = I.slab ? -2 : -1, P = X.P, w = map.w, h = map.h, N = w * h;
    var D = new Dense([S, t, S], [I.cols / 2 / S, n - yS / t, I.rows / 2 / S], [map.i0, 0, map.k0], [w, n + 1, h]), on = new Uint8Array(N), gems = I.th.gems, x, i, k;
    for (var q = 0; q < n; q++) {
      var L = fine ? q : q * 2, tok = P.code(I.th.strata[L], 'soft'), sq = I.isle === 'castle' && L < 2, lim = -I.M + I.dl[L];
      for (k = 0; k < h; k++) for (i = 0; i < w; i++) {
        x = k * w + i;
        var lx = lxOf(map, i - map.m), lz = lzOf(map, k - map.m);
        on[x] = (sq ? Math.max(Math.abs(lx) - I.cols / 2, Math.abs(lz) - I.rows / 2) < 1.9 - I.dl[L]
          : map.F[x] + 0.12 * Math.sin(lx * 1.8 + L) * Math.cos(lz * 1.4 - L) > lim) ? 1 : 0;
      }
      for (k = 0; k < h; k++) for (i = 0; i < w; i++) {
        x = k * w + i;
        if (!on[x]) continue;
        var rim = !i || !k || i === w - 1 || k === h - 1 || !on[x - 1] || !on[x + 1] || !on[x - w] || !on[x + w];
        D.set(i + map.i0, n - 1 - q, k + map.k0, L >= 2 && rim && h2(i, k, L) < GEM_RATE ? P.code(gems[Math.floor(h2(k, i, L) * gems.length)], 'glow') : tok);
      }
    }
    if (!mono) {
      var halo = P.code('PX Glint', null, 'halo');
      for (x = 0; x < N; x++) if (map.kind[x]) D.set(x % w + map.i0, n, ((x / w) | 0) + map.k0, halo);
    }
    X.dense.push(D);
  }

  /* ================================================================
     SCENERY PIECES (rim trees, posts, ropes, hangers, gateways, pads, locked gates)
     ================================================================ */
  /* a column of h g-voxels (w 1 or 2 square) banded a / b, with a head: 'lamp' (a warm bulb block) or 'flag' */
  function post(X, g, x, y, z, h, w, band, a, b, head, accent) {
    var P = X.P, p = reserve(X.piece(g, x, y, z, w === 2), -1, 0, -1, 1, h + 2, 1), lo = w === 2 ? -1 : 0;
    for (var j = 0; j < h; j++) p.box(lo, 0, j, j, lo, 0, P.c(band && ((j / band) | 0) & 1 ? b : a));
    if (head === 'lamp') { p.box(-1, 1, h, h + 1, -1, 1, P.c('PX Bulb Warm', 'glow')); p.set(0, h + 2, 0, P.c(accent)); }
    else if (head === 'flag') {
      var f = X.piece(G8, x, y + h * g, z);
      f.box(0, 0, 0, 5, 0, 0, P.c(a)); f.box(1, 3, 4, 5, 0, 0, P.c(accent)); f.box(4, 4, 4, 4, 0, 0, P.c(accent)); f.set(0, 6, 0, P.c('PX Sunny'));
    }
    return p;
  }
  /* size a Grid once for the box it will fill (a Grid grows every axis each time one overflows) */
  function reserve(p, i0, j0, k0, i1, j1, k1) { p.set(i0, j0, k0, 'x').set(i1, j1, k1, 'x').clear(i0, j0, k0).clear(i1, j1, k1); return p; }
  /* a rope from a to b (u) sagging `sag`; every 4th voxel hangs a 2-voxel pennant in `flags` colours */
  function rope(X, g, ax, ay, az, bx, by, bz, sag, tok, flags) {
    var P = X.P, p = X.piece(g, ax, ay, az), n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(bz - az), Math.abs(by - ay)) / g));
    reserve(p, 0, -Math.ceil(sag / g) - 3, 0, Math.round((bx - ax) / g), Math.round((by - ay) / g) + 1, Math.round((bz - az) / g));
    for (var s = 0; s <= n; s++) {
      var t = s / n, i = Math.round((bx - ax) * t / g), k = Math.round((bz - az) * t / g), j = Math.round(((by - ay) * t - sag * 4 * t * (1 - t)) / g);
      p.set(i, j, k, P.c(tok));
      if (flags && s % 4 === 2) p.box(i, i, j - 2, j - 1, k, k, P.c(flags[(s >> 2) % flags.length]));
    }
    return p;
  }
  /* a rim tree at beach height: rows = a pine's stepped G2 tiers ('2' 5 × 5 less its corners, '1' 3 × 3,
     '+', '.'), else a ball crown of radius r voxels (pixel.js's puffTree: deep below, lit on top) */
  function tree(X, x, z, rows, toks, bark, snow, r) {
    var P = X.P, t = X.piece(G4, x, -0.5, z, true), c = X.piece(G2, x, 0.5, z), n = rows ? rows.length : 0;
    t.box(-1, 0, 0, 3, -1, 0, P.c(bark));
    for (var j = 0; j < n; j++) {
      var rr = rows[j] === '2' ? 2 : rows[j] === '.' ? 0 : 1, lim = rows[j] === '2' ? 3 : rows[j] === '1' ? 2 : rr;
      var ch = snow && j >= n - snow ? P.c('PX Ice Snow', 'snow') : P.c(toks[Math.min(toks.length - 1, (j * toks.length / n) | 0)], 'leaf');
      for (var k = -rr; k <= rr; k++) for (var i = -rr; i <= rr; i++) if (Math.abs(i) + Math.abs(k) <= lim) c.set(i, j, k, ch);
    }
    if (!n) reserve(c, -3, 0, -3, 3, 5, 3).blob(0, r * 0.85, 0, r, r * 0.9, r, function (i2, j2) { return P.c(toks[j2 < r * 0.55 ? 0 : j2 < r * 1.2 ? 1 : 2], 'leaf'); }, 2);
    X.scenery.push({ kind: 'tree', x: X.I.cx + x, z: X.I.cz + z });
    return { trunk: t, crown: c };
  }
  /* chains hanging down the rim's open faces from height y: a share `rate` of the ring voxels, len [a, b] g-voxels */
  function hang(X, map, y, rate, g, len, tok, tip, salt) {
    var P = X.P, S = map.S, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (S !== G2) return;          /* near only */
    for (var k = map.k0; k < map.k0 + map.h; k++) for (var i = map.i0; i < map.i0 + map.w; i++) {
      var x = mx(map, i, k);
      if (!map.ring[x] || h2(i, k, salt) >= rate) continue;
      for (var d = 0; d < 4; d++) {
        if (kindAt(map, i + dirs[d][0], k + dirs[d][1])) continue;
        var n = len[0] + Math.floor(h2(k, i, salt) * (len[1] - len[0] + 1)), off = (h2(i, k, salt + 1) - 0.5) * (S - g);
        var px = lxOf(map, i) + dirs[d][0] * (S + g) / 2 + (dirs[d][0] ? 0 : off), pz = lzOf(map, k) + dirs[d][1] * (S + g) / 2 + (dirs[d][1] ? 0 : off);
        X.piece(g, px, y - n * g, pz).box(0, 0, 1, n - 1, 0, 0, P.c(tok)).set(0, 0, 0, P.c(tip || tok));
        break;
      }
    }
  }
  /* the gateway of a land's style across a path: two posts hw either side of (x, z) along the unit
     vector (ux, uz), h voxels tall, and, with `lintel`, the land's arch over them (a path that comes
     in at an angle gets a straight beam) */
  function gateway(X, isle, x, y, z, ux, uz, hw, lintel, h) {
    var st = STYLE[isle], P = X.P, a = st.post[0], b = st.post[1], top = y + (h = h || st.h) * st.g, acrossZ = !ux;
    [-1, 1].forEach(function (s) {
      post(X, st.g, x + s * hw * ux, y, z + s * hw * uz, h, st.w, st.band, a, b, st.head, st.accent);
      if (X.I) X.scenery.push({ kind: 'gateway', x: X.I.cx + x + s * hw * ux, z: X.I.cz + z + s * hw * uz });
    });
    if (!lintel || !st.lintel) return;
    if (ux && uz) {
      var di = Math.round(2 * hw * ux / G4), dk = Math.round(2 * hw * uz / G4), beam = X.piece(G4, x - hw * ux, top, z - hw * uz);
      reserve(beam, 0, 0, 0, di, 2, dk).line([0, 0, 0], [di, 0, dk], P.c(a, st.lintel === 'snow' ? 'snow' : null), st.w);
      return;
    }
    var n = Math.round(hw / G4) + (st.w === 2 ? 1 : 0), g = X.piece(G4, x, top, z, true), kind = st.lintel;
    function set(l, j, tok, mode) { for (var d = (st.w === 2 ? -1 : 0); d <= 0; d++) g.set(acrossZ ? d : l, j, acrossZ ? l : d, P.c(tok, mode)); }
    if (kind === 'leaf') {          /* a leafy garland: a puff of three greens over the posts, open underneath, a flower each end */
      var tones = ['PX Jungle Canopy', 'PX Jungle Canopy Light', 'PX Jungle Canopy Deep'], ra = n + 1.7;
      g.blob(-0.5, 0.4, -0.5, acrossZ ? 1.5 : ra, 1.9, acrossZ ? ra : 1.5, function (i, j, k) { return P.c(tones[Math.floor(h2(i + j, k - j, 13) * 3)], 'leaf'); }, 2);
      for (var q = -n + 1; q < n - 1; q++) for (var d = -2; d <= 1; d++) g.clear(acrossZ ? d : q, -1, acrossZ ? q : d);
      if (!X.lod) [-n - 1, n].forEach(function (e, f) { g.set(acrossZ ? 1 : e, 0, acrossZ ? e : 1, P.c(f ? st.accent : 'PX Jungle Flower Orange')); });
      return;
    }
    for (var l = -n; l < n; l++) {
      var end = l === -n || l === n - 1, m = Math.min(l + n, n - 1 - l);
      if (kind === 'beam') { set(l, 0, a); if (!end && m % 2) set(l, -1, st.rope); }
      else if (kind === 'stone') {          /* two courses, merlons, and a shoulder under each end of the opening */
        set(l, 0, a, 'cobble'); set(l, 1, b, 'cobble');
        if (m % 2 === 0) set(l, 2, a, 'cobble');
        if (m === 2) set(l, -1, b, 'cobble');
      } else { set(l, 0, a, 'snow'); if (!end) set(l, 1, a, 'snow'); if (m === 2) set(l, -1, 'PX Ice', 'ice'); }
    }
  }
  /* Home's gate pad for a land: a landing in the land's style from the shore out to the gate, on four posts */
  function gatePad(X, isle) {
    var G = grid3(), B = G.V3.bridge(isle), st = STYLE[isle], P = X.P, alongX = Math.abs(B.b.x - B.a.x) > 2 * Math.abs(B.b.z - B.a.z), C = core();
    var sx = alongX ? (B.a.x > 0 ? -1 : 1) : 0, span = 0, hw = Math.round((alongX || isle === 'castle' ? B.width : 1.5) / 2 / G4);
    function shore(d) { return C.CELL_REGION[Math.floor(B.a.x + sx * (d + 0.01) + 8) + ',' + Math.floor(B.a.z + (alongX ? 0 : d + 0.01) + 5)]; }
    while (span < 4 && !shore(span)) span = Math.round(span * 10 + 1) / 10;
    var n = Math.round(span / G4), ga = span / n, wide = Math.min(n, isle === 'castle' ? 4 : 6);
    var g = X.piece(alongX ? [ga, G4, G4] : [G4, G4, ga], B.a.x, 0, B.a.z, true);
    reserve(g, alongX ? sx * n : -hw, -4, alongX ? -hw : 0, alongX ? 0 : hw, -1, alongX ? hw : n);
    for (var q = 0; q < n; q++) for (var l = -hw; l < hw; l++) {
      if (q >= wide && (l < -hw + 1 || l >= hw - 1)) continue;          /* the jetty back to the shore is narrower than the landing */
      var u = sx < 0 ? -1 - q : q, tok = P.c(st.deck[(q + (st.mode === 'plank' ? 0 : l >> 1)) & 1], st.mode);
      var corner = (q === 0 || q === wide - 1) && (l === -hw || l === hw - 1);
      g.set(alongX ? u : l, -1, alongX ? l : u, tok);
      if (corner) g.box(alongX ? u : l, alongX ? u : l, -4, -2, alongX ? l : u, alongX ? l : u, P.c(st.post[0]));
    }
    X.scenery.push({ kind: 'gatePad', isle: isle, x: B.a.x, z: B.a.z });
  }
  /* a padlock plaque on grid p, its lowest voxel at (i, j, k); the pictogram decal faces the camera (+z) */
  function plaque(p, P, i, j, k) { p.box(i, i + 2, j, j + 2, k, k, P.c('PX Sunny')); p.decal('+z', [i, j, k], [3, 3], 'padlock'); }
  /* the locked gate at (ox, oz): two 1.1 u posts in the land's colours on the pad's outer corners, a
     pennant, a sagging rope with the padlock plaque, and three cloud stepping stones (9, 7 and 5
     cubes) out along the future bridge line (D56) */
  function gateInto(X, isle, ox, oz) {
    var B = grid3().V3.bridge(isle), st = STYLE[isle], P = X.P, alongX = Math.abs(B.b.x - B.a.x) > 2 * Math.abs(B.b.z - B.a.z);
    var e = Math.round(((alongX || isle === 'castle' ? B.width : 1.5) / 2 - G8) / G8), dx = (B.b.x - B.a.x) / B.length, dz = (B.b.z - B.a.z) / B.length;
    var px = ox + (alongX ? (dx > 0 ? -G8 : G8) : 0), pz = oz + (alongX ? 0 : G8), p = reserve(X.piece(G8, px, 0, pz, true), -e - 2, 0, -e - 1, e + 3, 12, e);
    [-e, e].forEach(function (s, q) {
      var i = alongX ? 0 : s, k = alongX ? s : 0;
      for (var j = 0; j < 9; j++) p.box(i - 1, i, j, j, k - 1, k, P.c(st.post[(j / 3 | 0) & 1]));
      if (!q) return;          /* the pennant flies from the second post */
      p.box(i - 1, i - 1, 9, 12, k - 1, k - 1, P.c(st.post[0])); p.box(i, i + 2, 11, 12, k - 1, k - 1, P.c(st.accent)); p.set(i + 3, 11, k - 1, P.c(st.accent));
    });
    plaque(p, P, -2, 3, 0);
    var rx = alongX ? 0 : e * G8, rz = alongX ? e * G8 : 0;
    rope(X, G16, px - rx, 0.94, pz - rz, px + rx, 0.94, pz + rz, 0.16, st.rope);
    var c = reserve(X.piece(G4, ox, -0.875, oz), Math.round(dx * 12) - 2, 0, Math.round(dz * 12) - 2, 2, 3, 2), base = P.c('PX Day Cloud Base', 'soft');
    [0.95, 1.95, 2.95].forEach(function (d, q) {
      var ci = Math.round(dx * d / G4), ck = Math.round(dz * d / G4), j = 2 - q;
      for (var k = -1; k <= 1; k++) for (var i = -1; i <= 1; i++) if (Math.abs(i) + Math.abs(k) < 2 || (!q && i !== k)) c.set(ci + i, j, ck + k, base);
      c.box(ci + (q < 2 ? -1 : 0), ci, j + 1, j + 1, ck, ck, P.c('PX Day Cloud Top', 'soft'));
      if (q > 1) c.clear(ci, j, ck + 1);
    });
  }
  function gate(isle) {
    var p = SKY.indexOf(isle) >= 0 ? grid3().V3.gate(isle) : null;
    if (!p) return null;
    var X = new Ctx();
    gateInto(X, isle, 0, 0);
    var m = X.model('gate:' + isle);
    m.place = [p.x, p.y, p.z];
    return m;
  }

  /* where a land's dock gateway stands: across the bridge's last step, just off the dock cells (a
     bridge that comes in at an angle: a little further out, clear of the cells beside the dock).
     (x, z) local, (ux, uz) the unit vector across the bridge, hw the posts' half spacing. */
  function dockFrame(I) {
    var B = grid3().V3.bridge(I.isle), st = STYLE[I.isle], half = st.g * st.w / 2, ox = (B.a.x - B.b.x) / B.length, oz = (B.a.z - B.b.z) / B.length;
    var skew = Math.abs(ox) > 0.01 && Math.abs(oz) > 0.01, out = skew ? 0.45 : half;
    return { x: B.b.x - I.cx + ox * out, z: B.b.z - I.cz + oz * out, ux: skew ? oz : Math.abs(oz), uz: skew ? -ox : Math.abs(ox), hw: B.width / 2 + half + (skew ? 0.2 : 0) };
  }
  /* everything that stands on the rim, hangs off it or pours over it */
  function scenery(X, map, o) {
    var I = map.I, isle = I.isle, tk = I.th.rim.tokens, P = X.P;
    fallsOf(map).forEach(function (f) { fallPiece(X, I, f); });
    function spot(a) { var h = rayHit(map, a, 2); return h ? [lxOf(map, h[0]), lzOf(map, h[1])] : null; }
    function at(gx, gz) { return [gx - I.cols / 2, gz - I.rows / 2]; }
    function note(kind, p) { X.scenery.push({ kind: kind, x: I.cx + p[0], z: I.cz + p[1] }); }
    if (I.home) {
      var sc = spot(0.38);          /* a sandcastle on the beach by the cove (scenery, never a cell) */
      if (sc) {
        X.piece(G8, sc[0], -0.5, sc[1], true).box(-2, 1, 0, 1, -2, 1, P.c('PX Home Beach 2')).box(-1, 0, 2, 3, -1, 0, P.c('PX Home Beach'))
          .box(-2, -2, 2, 2, -2, -2, P.c('PX Home Edge')).box(1, 1, 2, 2, 1, 1, P.c('PX Home Edge')).set(0, 4, 0, P.c('PX Coral'));
        note('sandcastle', sc);
      }
      X.near = true;
      SKY.forEach(function (s) { gatePad(X, s); });
      (o.lockedLands || SKY).forEach(function (s) { var g = grid3().V3.gate(s); if (g && SKY.indexOf(s) >= 0) gateInto(X, s, g.x, g.z); });
      return;
    }
    var st = STYLE[isle], dk = dockFrame(I);
    gateway(X, isle, dk.x, isle === 'jungle' ? -1 : -0.5, dk.z, dk.ux, dk.uz, dk.hw, true);
    if (isle === 'pier') {
      var posts = [[2.75, -0.25], [14.25, -0.25], [1.75, 6.25], [5.75, 6.25], [10.25, 6.25], [14.25, 6.25]].map(function (q) { return at(q[0], q[1]); });
      posts.forEach(function (p) { post(X, G8, p[0], -1, p[1], 16, 1, 2, tk.stripe, tk.skirt, 'lamp', 'PX Coral'); note('lampPost', p); });
      [[0, 1], [2, 3], [4, 5]].forEach(function (e) { rope(X, G8, posts[e[0]][0], 1, posts[e[0]][1], posts[e[1]][0], 1, posts[e[1]][1], 0.3, 'Cloud White', tk.bunting); });
      /* striped piles under the boardwalk's outer corners, every 2 u */
      var on = function (cc, rr) { return cc >= 0 && rr >= 6 && cc < I.cols && rr < I.rows && I.all[rr * I.cols + cc] === 1; };
      for (var r = 6; r <= 10; r++) for (var c = 3 + (r & 1); c <= 13; c += 2) {
        var cnt = (on(c - 1, r - 1) ? 1 : 0) + (on(c, r - 1) ? 1 : 0) + (on(c - 1, r) ? 1 : 0) + (on(c, r) ? 1 : 0);
        if (cnt === 0 || cnt === 4) continue;
        X.near = true;
        var pl = X.piece(G4, c - I.cols / 2 + (on(c, r) || on(c, r - 1) ? G8 : -G8), -1, r - I.rows / 2 + (on(c, r) || on(c - 1, r) ? G8 : -G8));
        pl.box(0, 0, 0, 1, 0, 0, P.c(tk.skirt)); pl.set(0, 2, 0, P.c(tk.stripe));
        X.near = false;
      }
    } else if (isle === 'jungle') {
      [[-2.7, 2.7], [-1.95, 3], [-1.15, 2.5], [2.72, 2.2]].forEach(function (q, n) {
        var p = spot(q[0]);
        if (!p) return;
        tree(X, p[0], p[1], null, tk.canopy, tk.trunk[n & 1], 0, q[1]).trunk.set(1, 1 + (n & 1), 0, P.c(tk.fungus, 'glow'));
      });
      hang(X, map, -0.75, 0.16, G8, [8, 20], tk.vine, 'PX Jungle Flower Pink', 21);
      [[9.125, 3.125], [9.125, 3.875], [9.875, 3.125], [9.875, 3.875]].forEach(function (q) {          /* the jetty's bamboo stilts */
        var p = at(q[0], q[1]);
        post(X, G8, p[0], -1, p[1], 6, 1, 3, st.post[0], st.post[1]);
      });
    } else if (isle === 'treetop') {
      var trees = [[-2.9, '211+.'], [-2.3, '2211+.'], [-1.7, 0, 2.6], [-1.15, '2211+.'], [-0.6, '211+.'], [-0.05, 0, 2.2], [2.15, '11+.'], [2.75, 0, 2.1]], pts = [];
      trees.forEach(function (q) {
        var p = spot(q[0]);
        if (!p) return;
        var c = tree(X, p[0], p[1], q[1] || null, q[1] ? tk.pine : [tk.oak[0], tk.oak[0], tk.oak[1]], tk.root, 0, q[2]).crown;
        if (!q[1]) c.hashTone(P.c(tk.oak[0], 'leaf'), P.c(tk.autumn, 'leaf'), 0.1, 7);
        pts.push(p);
      });
      /* two rope lines with a little round platform between back trees */
      [[1, 2], [3, 4]].forEach(function (e) {
        var a = pts[e[0]], b = pts[e[1]];
        if (!a || !b) return;
        rope(X, G8, a[0], 2.4, a[1], b[0], 2.4, b[1], 0.35, tk.rope);
        X.piece(G8, (a[0] + b[0]) / 2, 2.0, (a[1] + b[1]) / 2).lathe([[2.4, 0, 0, P.c(tk.plank, 'plank')]]);
      });
      hang(X, map, -1, 0.1, G4, [4, 11], tk.root, tk.rope, 33);
      var zp = spot(0.3) || at(9.4, 5);          /* the zip line's landing post, across from the lookout */
      post(X, G4, zp[0], -0.5, zp[1], 7, 1, 0, tk.root, tk.root, 'flag', 'PX Tree Flag'); note('landingPost', zp);
    } else if (isle === 'castle') {
      [[1.75, -0.25], [10.25, -0.25], [1.75, 7.25], [10.25, 7.25]].forEach(function (q) {
        var p = at(q[0], q[1]);
        post(X, G4, p[0], -1, p[1], 5, 1, 0, tk.stone[1], tk.shade, 'flag', tk.pennant); note('pennant', p);
      });
    } else if (isle === 'ice') {
      [[-2.25, '211+.', 2], [-0.95, '2211+.', 3]].forEach(function (q) {          /* two snowy pines at the back */
        var p = spot(q[0]);
        if (p) tree(X, p[0], p[1], q[1], tk.pine, 'PX Tree Bark', q[2]);
      });
      [-2.9, -1.6, -0.3, 1.1, 1.9, 2.9].forEach(function (a, n) {          /* snow drifts on the rim */
        var p = spot(a);
        if (!p) return;
        X.piece(G4, p[0], -0.5, p[1]).blob(0, 0, 0, 1.6 + (n & 1), 1.2, 1.6, P.c(n % 3 ? tk.snow : 'PX Ice Snow 2', 'snow'), 2); note('drift', p);
      });
      hang(X, map, -0.875, 0.3, G8, [2, 5], tk.icicle[1], tk.icicle[0], 45);
      var gem = P.c(I.th.gems[2], 'glow');          /* the ice-crystal tip under the cake */
      X.piece(G2, 0, -6.5, 0).box(0, 0, 0, 2, 0, 0, P.c(I.th.gems[0], 'glow')).box(-1, 1, 2, 2, 0, 0, gem).box(0, 0, 2, 2, -1, 1, gem);
    }
  }

  /* ================================================================
     terrain(), its chunks and the meshes
     ================================================================ */
  function chunkOf(map, sh, key) {
    var I = map.I, n = map.n, ab = key === 'all' ? null : String(key).split(','), cells = [], P = new Pal();
    var c0 = ab ? +ab[0] * CHUNK : 0, c1 = ab ? Math.min(I.cols, c0 + CHUNK) : I.cols, r0 = ab ? +ab[1] * CHUNK : 0, r1 = ab ? Math.min(I.rows, r0 + CHUNK) : I.rows;
    var b = { i0: c0 * n, i1: c1 * n - 1, k0: r0 * n, k1: r1 * n - 1 };
    for (var r = r0; r < r1; r++) for (var c = c0; c < c1; c++) if (kindAt(map, c * n, r * n) === 3) cells.push([c, r]);
    if (!cells.length) return null;
    var D = new Dense([map.S, G2, map.S], [I.cols / 2 / map.S, 0, I.rows / 2 / map.S], [b.i0 - 1, -2, b.k0 - 1], [b.i1 - b.i0 + 3, 3, b.k1 - b.k0 + 3]);
    var extra = fillTops(map, sh, P, D, b, P.code('PX Glint', null, 'halo'));
    return { key: String(key), cells: cells, model: { id: 'top:' + I.isle + ':' + key, grid: G2, origin: [0, 0, 0], ground: false, cull: ['-y'], palette: P.pal,
      layers: [D.layer()].concat(extra), pivots: {}, anchors: {}, decals: [] } };
  }
  function topChunk(isle, key, o) {
    var I = info(isle);
    if (!I) return null;
    o = o || {};
    var map = mapOf(I, o, 0);
    return chunkOf(map, shadeMap(map, o.footprints), key);
  }
  /* the chunks a footprint (± one voxel) touches */
  function chunkKeys(isle, fps) {
    var I = info(isle), seen = {}, out = [];
    if (!I) return out;
    (fps || []).forEach(function (f) {
      var r = rectOf(f), p0 = Math.floor((r[0] - 0.5) / CHUNK), p1 = Math.floor((r[0] + r[2] + 0.49) / CHUNK), q1 = Math.floor((r[1] + r[3] + 0.49) / CHUNK);
      for (var q = Math.floor((r[1] - 0.5) / CHUNK); q <= q1; q++) for (var p = p0; p <= p1; p++) {
        var key = p + ',' + q;
        if (p >= 0 && q >= 0 && p * CHUNK < I.cols && q * CHUNK < I.rows && !seen[key]) { seen[key] = 1; out.push(key); }
      }
    });
    return out;
  }
  function terrain(isle, o) {
    var I = info(isle);
    if (!I) return null;
    o = o || {};
    var lod = o.lod ? 1 : 0, mono = !!(lod || o.mono), map = mapOf(I, o, lod), X = new Ctx(lod), sh = mono ? null : shadeMap(map, o.footprints);
    X.I = I;
    var tops = landLayer(X, map, mono);
    if (I.slab) slabLayer(X, map, mono, !!o.water);
    strataLayer(X, map, mono);
    scenery(X, map, o);
    var model = X.model('terrain:' + isle + (lod ? ':lod1' : '')), chunks = [];
    model.layers = model.layers.concat(tops);
    if (!mono) {
      if (o.chunk === 0) chunks.push(chunkOf(map, sh, 'all'));
      else for (var b = 0; b * CHUNK < I.rows; b++) for (var a = 0; a * CHUNK < I.cols; a++) {
        var ch = chunkOf(map, sh, a + ',' + b);
        if (ch) chunks.push(ch);
      }
    }
    return { isle: isle, lod: lod, at: [I.cx, I.cy, I.cz], model: model, topChunks: chunks, scenery: X.scenery };
  }
  function concat(list) {
    var out = { quads: 0, tris: 0, faces: 0, issues: [] }, n = 0;
    list.forEach(function (a) {
      n += a.position.length; out.quads += a.quads || 0; out.tris += a.tris || 0; out.faces += a.faces || 0;
      (a.issues || []).forEach(function (m) { if (out.issues.indexOf(m) < 0) out.issues.push(m); });
    });
    ['position', 'normal', 'color', 'vuv'].forEach(function (k) {
      var arr = new Float32Array(n), at = 0;
      list.forEach(function (a) { arr.set(a[k], at); at += a[k].length; });
      out[k] = arr;
    });
    return out;
  }
  /* token → linear RGB exactly as the mesher's default (SLIslandLook.resolve, sRGB → linear), cached:
     a bake meshes a dozen models with one palette family */
  var RGB = {};
  function colorOf(token) {
    if (RGB[token]) return RGB[token];
    var h = look().resolve(token), n = h ? parseInt(h.slice(1), 16) : -1;
    if (n < 0) return null;
    return (RGB[token] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }));
  }
  /* a model's drawable arrays: every part but the halo (o: SLVox.mesh options) */
  function mesh(model, o) {
    var mo = { colorOf: colorOf }, k;
    for (k in o) if (o[k] !== undefined) mo[k] = o[k];
    var r = vox().mesh(model, mo), parts = r.parts.filter(function (p) { return p.name !== 'copy_halo'; }).map(function (p) {
      return { position: p.arrays.position, normal: p.arrays.normal, color: p.arrays.color, vuv: p.arrays.vuv, quads: p.quads, tris: p.tris, faces: p.faces };
    });
    var out = parts.length === 1 ? parts[0] : concat(parts);
    out.issues = r.issues; out.bounds = r.bounds;
    return out;
  }
  /* terrain(isle, o) meshed: o also carries the mesher's tier, colorOf and cellOf */
  function bake(isle, o) {
    var t = terrain(isle, o);
    if (!t) return null;
    var mo = o ? { tier: o.tier, colorOf: o.colorOf, cellOf: o.cellOf } : {}, chunks = {}, list = [mesh(t.model, mo)];
    t.topChunks.forEach(function (c) { list.push(chunks[c.key] = mesh(c.model, mo)); });
    var arrays = concat(list);
    return { terrain: t, arrays: arrays, chunks: chunks, tris: arrays.tris };
  }
  /* a region's cells in bands outward from the land that is already there (≤ 5; LOW 3) */
  function riseOrder(region, o) {
    o = o || {};
    var cells = grid3().riseOrder(region, o.land), n = Math.min(cells.length, String(o.tier).toUpperCase() === 'LOW' ? 3 : 5), out = [];
    if (!n) return out;
    var lo = cells[0].dist, span = cells[cells.length - 1].dist - lo + 1e-6;
    for (var q = 0; q < n; q++) out.push({ index: q, cells: [], delay: 0 });
    cells.forEach(function (p) { out[Math.min(n - 1, Math.floor((p.dist - lo) / span * n))].cells.push({ c: p.c, r: p.r, key: p.key }); });
    out = out.filter(function (b) { return b.cells.length; });
    out.forEach(function (b, q) { b.index = q; b.delay = q * 0.12; });
    return out;
  }

  /* ================================================================
     BRIDGES — built in local +x from the Home gate (0, 0, 0) to (length, rise, 0); every one static (D83)
     ================================================================ */
  var BRIDGES = {};
  function bridge(isle) {
    if (BRIDGES[isle]) return BRIDGES[isle];
    var B = SKY.indexOf(isle) >= 0 ? grid3().V3.bridge(isle) : null;
    if (!B) return null;
    var st = STYLE[isle], X = new Ctx(), P = X.P, len = B.length, W = B.width, gx = isle === 'treetop' ? G8 : G4, n = Math.ceil(len / gx - 1e-6), hw = W / 2 / G4;
    var th = { pier: 2, jungle: 1, treetop: 1, castle: 4, ice: 3 }[isle], bow = { jungle: -0.35, treetop: -0.4, ice: 0.3 }[isle] || 0;
    var deck = reserve(X.piece([gx, G8, G4], 0, 0, 0, true), 0, -24, -hw, n, 32, hw), segs = [], rails = [[], []], a, s, half = st.g * st.w / 2;
    for (a = 0; a < Math.ceil(len / G2 - 1e-6); a++) segs.push({ index: a, voxels: [] });
    function top(x) {          /* the deck's top row (G8 rows) at x */
      var t = Math.min(1, Math.max(0, x / len));
      /* castle: twelve 0.25 u steps · pier: level, then a ramp over the last 2 u · the others: a straight rise with a sag or an arch */
      var y = isle === 'castle' ? G4 * Math.min(12, Math.ceil(t * 12 - 1e-9)) : isle === 'pier' ? B.rise * smooth((x - len + 2) / 2) : B.rise * t + bow * 4 * t * (1 - t);
      return Math.round(y / G8);
    }
    /* the build animation's boxes: [x, y, z (centre), sx, sy, sz, token] into the 0.5 u segment that holds x */
    function box(x, y, z, sx, sy, sz, tok) { segs[Math.min(segs.length - 1, Math.max(0, Math.floor(x / G2)))].voxels.push([x, y, z, sx, sy, sz, tok]); }
    function side(x, jt, h, tok, mode) {          /* h rows from row jt on both edges of deck column a */
      for (s = -1; s <= 1; s += 2) {
        deck.box(a, a, jt, jt + h - 1, s < 0 ? -hw : hw - 1, s < 0 ? -hw : hw - 1, P.c(tok, mode));
        box(x, (jt + h / 2) * G8, s * (W / 2 - G8), gx, h * G8, G4, tok);
      }
    }
    for (a = 0; a < n; a++) {
      var x = (a + 0.5) * gx, jt = top(x), tok = st.deck[(a >> 1) & 1], u, q;
      if (isle === 'treetop') { if (a % 3 === 2) continue; tok = st.deck[((a / 3) | 0) & 1]; }
      else if (isle === 'pier') tok = st.deck[a % 3 ? 0 : 1];
      else if (isle === 'jungle') tok = st.deck[a & 1];
      else if (isle === 'castle') tok = st.deck[((jt >> 1) + (a >> 1)) & 1];
      deck.box(a, a, jt - th, jt - 1, -hw, hw - 1, P.c(tok, st.mode)); box(x, (jt - th / 2) * G8, 0, gx, th * G8, W, tok);
      if (isle === 'jungle') side(x, jt - 1, 2, st.post[0]);                                  /* bamboo edges */
      else if (isle === 'ice') {
        if (!((a >> 1) & 1)) side(x, jt, 2, 'PX Ice Snow', 'snow');                          /* snow-capped parapet blocks */
        if (a % 3 === 1) for (s = -1; s <= 1; s += 2) {                                       /* icicles under the edges */
          q = 2 + Math.floor(h2(a, s, 9) * 3);
          X.piece(G8, x, (jt - th - q) * G8, s * (W / 2 - G8)).box(0, 0, 1, q - 1, 0, 0, P.c('PX Ice Shine', 'ice')).set(0, 0, 0, P.c('PX Ice', 'ice'));
        }
      } else if (isle === 'castle') {
        side(x, jt, (a >> 1) & 1 ? 4 : 2, st.post[0], 'cobble');                             /* crenellated parapets */
        u = ((x / (len / 3)) % 1) * 2 - 1;                                                    /* three arches on hanging piers */
        var dep = Math.round((G4 + 1.2 * (1 - Math.sqrt(Math.max(0, 1 - u * u)))) / G8), pier = Math.abs(u) > 0.84;
        if (!pier) side(x, jt - th - dep, dep, st.post[0], 'cobble');
        else for (q = 0; q < 16; q++) {          /* a pier hangs 2 u and ends in a stepped tip */
          var inset = q < 12 ? 0 : q < 14 ? 1 : 2;
          deck.box(a, a, jt - th - 1 - q, jt - th - 1 - q, -hw + inset, hw - 1 - inset, P.c(st.post[q < 12 ? 0 : 1], 'cobble'));
        }
        if (pier && Math.abs(u) > 0.9) box(x, (jt - th - 8) * G8, 0, gx, 2, W, st.post[0]);
      }
      /* rail posts: every 1 u (pier), 1.5 u (jungle) */
      var every = isle === 'pier' ? 4 : isle === 'jungle' ? 6 : 0;
      if (every && a % every === 0 && a > 0 && a < n - 2) for (s = -1; s <= 1; s += 2) {
        var pz = s * (W / 2 - G8), ph = isle === 'pier' ? 3 : 6, pg = isle === 'pier' ? G4 : G8;
        post(X, pg, x, jt * G8, pz, ph, 1, isle === 'pier' ? 1 : 3, st.post[0], st.post[1]);
        if (isle === 'jungle') X.piece(G8, x, jt * G8 + ph * pg, pz).set(0, 0, 0, P.c((a / every) & 1 ? st.accent : 'PX Jungle Flower Orange'));
        box(x, jt * G8 + ph * pg / 2, pz, pg, ph * pg, pg, st.post[0]);
        rails[s < 0 ? 0 : 1].push([x, jt * G8 + ph * pg, pz]);
      }
    }
    /* the Home end: the land's gateway posts on the pad's outer corners; the dock's own gateway closes the far end */
    var hh = { pier: 11, jungle: 6, treetop: 6, castle: 3, ice: 3 }[isle];
    gateway(X, isle, -half, 0, 0, 0, 1, W / 2 - half, isle === 'treetop', hh);
    for (s = 0; s < 2; s++) {
      var z = (s ? 1 : -1) * (W / 2 - half), list = [[-half, hh * st.g, z]].concat(rails[s]);
      if (isle === 'pier' || isle === 'jungle') {
        var flags = isle === 'pier' ? ['PX Coral', 'PX Sunny', 'PX Pier Stripe Blue', 'PX Mint'] : ['PX Jungle Canopy Light', 'PX Jungle Canopy Deep'];
        for (a = 0; a + 1 < list.length; a++) rope(X, G16, list[a][0], list[a][1], list[a][2], list[a + 1][0], list[a + 1][1], list[a + 1][2], 0.06, st.rope, flags);
      } else if (isle === 'treetop') {          /* hand rope, mid rope and a tie at every slat: the net sides */
        var net = reserve(X.piece(G16, 0, 0, z, true), 0, -8, 0, Math.floor(len / G16), 56, 0), c = P.c(st.rope);
        for (a = 0; a < Math.floor(len / G16); a++) {
          var j0 = top((a + 0.5) * G16) * 2;
          net.set(a, j0 + 12, 0, c); net.set(a, j0 + 6, 0, c);
          if (a % 12 === 1) net.box(a, a, j0, j0 + 11, 0, 0, c);
        }
      }
    }
    var model = X.model('bridge:' + isle), r = (B.yawDeg - 90) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    return (BRIDGES[isle] = { isle: isle, model: model, matrix: [cs, 0, -sn, 0, 0, 1, 0, 0, sn, 0, cs, 0, B.a.x, B.a.y + LIFT, B.a.z, 1],
      segments: segs, sways: false, length: len, rise: B.rise, width: W, lift: LIFT });
  }

  /* ================================================================
     PREVIEWS AND DIORAMAS — one plain VoxModel each (no halo): the terrain with its water baked
     as voxel tops, the landmark on its spot (preview: its LOD1) and, on a preview, the lock sign
     ================================================================ */
  function withLandmark(isle, landmark, lod, sign) {
    var I = info(isle);
    if (!I) return null;
    var V = vox(), t = terrain(isle, { lod: lod, mono: true, water: true, lockedLands: [] }), list = [{ model: t.model, at: [0, 0, 0] }];
    if (landmark && I.R.landmarkSpot) {
      var fp = (core().item(I.R.landmark) || {}).fp || [1, 1], sp = I.R.landmarkSpot;
      /* a preview takes the landmark's LOD1 (a model that is one already, lodLevel ≥ 1, goes in as it is) */
      list.push({ model: lod && !(landmark.lodLevel >= 1) ? V.lod(landmark, 1) : landmark, at: [sp[0] + fp[0] / 2 - I.cols / 2, 0, sp[1] + fp[1] / 2 - I.rows / 2] });
    }
    if (sign && !I.home) {
      var X = new Ctx(), dk = dockFrame(I), d = dk.hw + 0.4;          /* the lock sign stands beside the dock gateway */
      plaque(post(X, G8, dk.x + dk.ux * d, -0.5, dk.z + dk.uz * d, 9, 1, 0, STYLE[isle].post[0], STYLE[isle].post[0]), X.P, -1, 8, 1);
      list.push({ model: X.model('sign:' + isle), at: [0, 0, 0] });
    }
    var m = list.length > 1 ? V.compose(list, { id: (sign ? 'preview:' : 'diorama:') + isle }) : t.model;
    m.ground = false; m.cull = ['-y']; m.place = t.at;
    return m;
  }
  function preview(isle, landmark) { return withLandmark(isle, landmark, 1, true); }
  function diorama(isle, landmark) { return withLandmark(isle, landmark, 0, false); }

  /* ================================================================
     WATER REGIONS, CLOUD EXCLUSION, CHECKS
     ================================================================ */
  /* the slab's outline as one closed loop of world [x, z] points (clockwise seen from above, corners only) */
  function outlineOf(map) {
    var I = map.I, S = map.S, next = {}, first = null, n = 0;
    function edge(a, b, c, d) { var key = a + ',' + b; if (first === null) first = key; next[key] = [c, d]; n++; }
    for (var k = map.k0; k < map.k0 + map.h; k++) for (var i = map.i0; i < map.i0 + map.w; i++) {
      if (!kindAt(map, i, k)) continue;
      if (!kindAt(map, i, k - 1)) edge(i, k, i + 1, k);
      if (!kindAt(map, i + 1, k)) edge(i + 1, k, i + 1, k + 1);
      if (!kindAt(map, i, k + 1)) edge(i + 1, k + 1, i, k + 1);
      if (!kindAt(map, i - 1, k)) edge(i, k + 1, i, k);
    }
    var pts = [], cur = first, guard = 0, prev = null;
    while (cur && guard++ <= n) {
      var p = cur.split(','), nx = next[cur], d = [nx[0] - +p[0], nx[1] - +p[1]];
      if (!prev || prev[0] !== d[0] || prev[1] !== d[1]) pts.push([I.x0 + +p[0] * S, I.z0 + +p[1] * S]);
      prev = d; cur = nx[0] + ',' + nx[1];
      if (cur === first) break;
    }
    pts.closed = cur === first && guard === n;
    return pts;
  }
  function waterRegions(seed) {
    var out = {}, x = ATLAS.gutter, y = ATLAS.gutter, rowH = 0, T = ATLAS.texels;
    ISLES.forEach(function (isle) {
      var I = info(isle);
      if (!I.slab) return;
      var b = slabOf(isle, seed).bounds, x0 = Math.floor(b.x0 * 2) / 2, x1 = Math.ceil(b.x1 * 2) / 2, z0 = Math.floor(b.z0 * 2) / 2, z1 = Math.ceil(b.z1 * 2) / 2;
      var w = (x1 - x0) * T, h = (z1 - z0) * T, frames = 2, need = 2 * w + ATLAS.gutter;
      if (x + need > ATLAS.w) { x = ATLAS.gutter; y += rowH + ATLAS.gutter; rowH = 0; }
      if (y + h > ATLAS.h) { frames = 1; need = w; }          /* D41: one frame where two do not fit */
      out[isle] = { rect: { x: x, y: y, w: w, h: h }, frames: frames, frameOffset: frames > 1 ? w + ATLAS.gutter : 0,
        world: { x0: x0, z0: z0, x1: x1, z1: z1 }, y: I.cy + grid3().V3.SEA_Y, texel: 1 / T, outline: outlineOf(mapOf(I, { seed: seed }, 0)), tiers: TIERS.slice() };
      x += need + ATLAS.gutter; rowH = Math.max(rowH, h);
    });
    return out;
  }
  /* where no cloud, balloon or bird may come: within 1.5 u of a bridge line, or of a land box + its rim */
  function cloudExclusion() {
    var G = grid3(), zones = [];
    SKY.forEach(function (isle) {
      var B = G.V3.bridge(isle);
      zones.push({ kind: 'bridge', isle: isle, a: [B.a.x, B.a.y, B.a.z], b: [B.b.x, B.b.y, B.b.z], r: CLOUD_CLEAR });
    });
    ISLES.forEach(function (isle) {          /* from the cake's tip to the tallest item */
      var I = info(isle), b = I.F.bounds, p = PAD + I.M + CLOUD_CLEAR;
      zones.push({ kind: 'isle', isle: isle, x0: b.x0 - p, x1: b.x1 + p, z0: b.z0 - p, z1: b.z1 + p,
        y0: I.cy - (I.slab ? 2 : 1) - I.n * G2 - CLOUD_CLEAR, y1: I.cy + I.F.itemMaxH + CLOUD_CLEAR });
    });
    return zones;
  }
  function inZone(zn, x, y, z) {
    if (zn.kind === 'isle') return x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1 && y >= zn.y0 && y <= zn.y1;
    var a = zn.a, b = zn.b, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    var t = ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = a[0] + d[0] * t - x, py = a[1] + d[1] * t - y, pz = a[2] + d[2] * t - z;
    return px * px + py * py + pz * pz <= zn.r * zn.r;
  }
  var ZONES = null;
  function excluded(x, y, z) { ZONES = ZONES || cloudExclusion(); return ZONES.some(function (zn) { return inZone(zn, x, y, z); }); }
  function angDiff(a, b) { var d = Math.abs(a - b) % TAU; return d > Math.PI ? TAU - d : d; }
  /* sky-world layoutChecks, on this module's numbers */
  function checks(seed) {
    var G = grid3(), out = [], bad, home = homeSlab(seed);
    function add(name, okText) { out.push({ name: name, ok: !bad.length, detail: bad.length ? bad.join('; ') : okText }); }
    bad = G.V3.layoutChecks().filter(function (c) { return !c.ok; }).map(function (c) { return c.name + ': ' + c.detail; });
    add('layout', 'docks, gates, bridges and gaps as the world model');
    bad = [];
    ISLES.forEach(function (isle) {
      if (!slabOf(isle, seed).outlineOK) bad.push(isle + ' outline');
      if ((isle === 'treetop') !== (skySlab(isle) === null && isle !== 'home')) bad.push(isle + ' slab');
    });
    add('slabs', 'every slab holds its cells; treetop has none');
    bad = [];
    SKY.forEach(function (isle) {
      var g = G.V3.gate(isle);
      for (var q = 0; q < 8; q++) {
        if (home.inside(g.x + 0.5 * Math.cos(q * TAU / 8), g.z + 0.5 * Math.sin(q * TAU / 8))) continue;
        bad.push(isle + ' gate pad is < 0.5 u inside the rim'); break;
      }
    });
    add('gatePads', 'every Home gate pad stands ≥ 0.5 u inside the rim');
    bad = [];
    ISLES.forEach(function (isle) {
      var I = info(isle), E = I.home ? null : G.ISLE_LAYOUT[isle].dockEdge, list = falls(isle, seed);
      var gates = I.home ? SKY.map(function (s) { var g = G.V3.gate(s); return Math.atan2(g.z, g.x); }) : [Math.atan2(E[2] - I.cz, E[0] - I.cx)];
      list.forEach(function (f) { gates.forEach(function (a) {
        if (angDiff(f.angle, a) < GATE_CLEAR || angDiff(Math.atan2(f.at[2] - I.cz, f.at[0] - I.cx), a) < GATE_CLEAR) bad.push(isle + ' fall ' + f.angle + ' is near a gate');
      }); });
      if (list.length !== FALLS[isle].length) bad.push(isle + ' lost a fall');
    });
    add('falls', 'every fall pours ≥ 0.4 rad from every gate');
    bad = [];
    SKY.forEach(function (isle) {
      var B = G.V3.bridge(isle), m = bridge(isle).matrix, e = [m[0] * B.length + m[12], B.rise + m[13], m[2] * B.length + m[14]];
      var off = Math.abs(m[12] - B.a.x) + Math.abs(m[14] - B.a.z) + Math.abs(e[0] - B.b.x) + Math.abs(e[2] - B.b.z) + Math.abs(e[1] - B.b.y - LIFT);
      if (off > 1e-6) bad.push(isle + ' bridge ends');
      for (var t = 0; t <= 1; t += 0.05) {
        if (excluded(B.a.x + (B.b.x - B.a.x) * t, B.a.y + (B.b.y - B.a.y) * t, B.a.z + (B.b.z - B.a.z) * t)) continue;
        bad.push(isle + ' bridge line is open to clouds'); break;
      }
    });
    add('bridges', 'bridges run homeGate → dockEdge inside the cloud exclusion');
    bad = [];
    var W = waterRegions(seed);
    Object.keys(W).forEach(function (isle) {
      var r = W[isle].rect;
      if (r.x + W[isle].frameOffset + r.w > ATLAS.w || r.y + r.h > ATLAS.h || !W[isle].outline.closed) bad.push(isle + ' water region');
    });
    if (W.treetop) bad.push('treetop has water');
    add('water', 'every slab has its region in the 1024 × 512 atlas and one closed outline');
    return out;
  }
  function clearCache() { MAPS = {}; MAP_KEYS = []; BRIDGES = {}; ZONES = null; }

  return {
    VERSION: VERSION, ISLES: ISLES, SKY: SKY, CHUNK: CHUNK, LIFT: LIFT, TIERS: TIERS, FALLS: FALLS, STYLE: STYLE, DECO: DECO, TOKENS: TOKENS,
    BUDGETS: BUDGETS, ATLAS: ATLAS,
    homeSlab: homeSlab, skySlab: skySlab, falls: falls, terrain: terrain, topChunk: topChunk, chunkKeys: chunkKeys, mesh: mesh, concat: concat, bake: bake,
    riseOrder: riseOrder, bridge: bridge, gate: gate, preview: preview, diorama: diorama, waterRegions: waterRegions,
    cloudExclusion: cloudExclusion, excluded: excluded, checks: checks, clearCache: clearCache
  };
}));
