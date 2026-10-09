/* ================================================================
   My Island v3 — SLPxGear (W3b.10): the 20 pieces of land gear in Pixel Blocks, four per sky land
   (one per slot: hat, neck, face, back), on the crew grid GC (0.05 u). window.SLPxGear in the
   browser (it registers SL3D.defineVox('gear', factory): the factory fills the open table and
   draws no model of its own — a piece displays on its pet, stage.voxRoute), module.exports in
   Node. Everything here is pure data (VoxModels: no THREE, no DOM).

   FIT IS DATA (D96). Each id is a row in SLPxCharacters.ACCS (px-characters.js; filled when this
   file loads, when the vox group runs and when a test hands the table over; first wins):
     {id, isle, slot, socket, bone, bones, cap, coversEyes,
      voxels(sock, ctx) → {bone: VoxModel}   (also .build) built from ONE socket descriptor; the
                                             result carries itself as .bones beside .joints (both
                                             hidden from Object.keys) for the rig builder
      joints(sock, ctx) → {bone: [x, y, z] u}}   where its helper bones hinge
   sock = the species' descriptor of the slot (px-characters socketOf: {bone, v [i, j, k], at u, w,
   d, flags}); a species row, a socket map or a species id is taken too, anything else builds on
   the reference puppy. ctx = the rig builder's context {species, row, sockets, has(i, j, k), …}:
   with it a piece reads the animal it sits on. has() says where the animal fills a cell and a piece
   never fills one, so brims and bands notch round ears, horns and eye stalks and a collar
   disappears into the shoulders; earmuff pads and mask straps sit outside whatever is at the side
   of the head (under a hanging ear); the butterfly finds the tip of the nose; masks find the eyes
   (row.eyes). Without a ctx (a lone display in Node) the descriptor alone places it. Flags:
   earsUp · horns · stalks keep what sits ON the crown one voxel in from each side (as px-crew's
   wide hats); wings keep the back pieces inside the deck and the leaf wings upright in front of
   the animal's own; noNeck needs nothing (a collar wraps what the descriptor says it wraps).
   FRAMES (root-frame voxel coordinates: an integer is a voxel centre, .5 a face; a piece may sit on
   the half voxel, and such voxels mesh in a layer of their own shifted half a voxel):
     hat   v = the middle of the crown's top face → a hat's first row is v[1] + 0.5
     face  v = between the eyes on the face plane → a mask's layer is k = v[2] + 0.5
     neck  v = the centre of the ring row under the head, w × d = what a ring wraps
     back  v = the middle of the free deck's top face → a pack's first row is v[1] + 0.5
   LOOK: one colour per voxel, palette tokens only, ao false and ground false (they flip and tumble
   with the pet). The vox shader's own surface patterns add detail for no triangles: the waffle
   cone and the acorn cup in 'cobble', the leaves in 'leaf', the lenses in 'ice'. Details a LOW
   device can lose are lod 'mid'. Helper bones, never a new one: the lenses ride 'lens', the
   goggles' glint 'glint' (the crown sheen scales it in place), the binoculars and the middle bell
   'scarfTail' (the walk swings it), the balloon string, the leaf wings and the royal cloak
   cape0–cape2 (re-seated per outfit: they lift with speed, flat and still at rest and under
   reduced motion). The nose butterfly is static. Night: the butterfly's wing tips, the earmuffs'
   fluff, the penguin pack's tummy and the goggles' glint are glow voxels (steady, never blinking).
   CAPS (D108): each piece within its own cap (catalogAdditions.gear) inside its slot's (hat 180,
   neck 160, face 140, back 170) on every species and tier, so any pet or mascot in one piece per
   slot stays ≤ TRIS_CAPS.petRig3.dressed (1,400) in one draw. A piece is built at full detail
   first; on an animal whose ears or snout notch it past its cap the builder drops its optional
   details one level at a time (g.keep(n)); a piece that still needs more than its slot's cap
   throws, and the rig leaves it off (px-characters assemble).
   Node: {voxels: {acc_*: fn(st) → the piece alone on st.pet (the puppy when not given)}, accVoxels,
   jointsOf, ctxFor, trisOf, ACCS, GEAR, …}. Nothing here reads, awards or spends anything; no
   random numbers; the same input gives the same model.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxGear = api;
    var S = root.SL3D;
    if (S && typeof S.defineVox === 'function') S.defineVox('gear', api.factory);
  }
  api.fill();
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxGear: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC === 'object' ? PC : null; }

  var VERSION = 1, GC = 0.05, MAX_CUT = 3;
  /* catalogAdditions.gear, in catalogue order: [isle, slot (= CATALOG slot = LOOK socket), own cap] */
  var GEAR = {
    acc_pier_conehat: ['pier', 'hat', 150], acc_pier_ring: ['pier', 'neck', 160], acc_pier_snorkel: ['pier', 'face', 140], acc_pier_balloon: ['pier', 'back', 170],
    acc_jungle_garland: ['jungle', 'neck', 110], acc_jungle_hat: ['jungle', 'hat', 130], acc_jungle_butterfly: ['jungle', 'face', 70], acc_jungle_pack: ['jungle', 'back', 170],
    acc_treetop_acorn: ['treetop', 'hat', 120], acc_treetop_leafmask: ['treetop', 'face', 110], acc_treetop_binoculars: ['treetop', 'neck', 140], acc_treetop_leafwings: ['treetop', 'back', 170],
    acc_castle_ruff: ['castle', 'neck', 120], acc_castle_visor: ['castle', 'face', 140], acc_castle_helm: ['castle', 'hat', 180], acc_castle_cloak: ['castle', 'back', 170],
    acc_ice_earmuffs: ['ice', 'hat', 180], acc_ice_bells: ['ice', 'neck', 160], acc_ice_goggles: ['ice', 'face', 140], acc_ice_pack: ['ice', 'back', 170]
  };
  var IDS = Object.keys(GEAR), SLOTS = ['hat', 'neck', 'face', 'back'];
  var SLOT_BONE = { hat: 'head', face: 'head', neck: 'neck', back: 'body' };
  var SLOT_CAPS = { hat: 180, neck: 160, face: 140, back: 170 };          /* = SLIslandLook.SLOT_CAPS (D108) */
  var LENSES = { acc_pier_snorkel: 1, acc_ice_goggles: 1 };                /* a lens over the eyes takes their glints */
  var HELPERS = { acc_pier_snorkel: ['lens'], acc_pier_balloon: ['cape0', 'cape1', 'cape2'], acc_treetop_binoculars: ['scarfTail'],
                  acc_treetop_leafwings: ['cape0', 'cape1', 'cape2'], acc_castle_cloak: ['cape0', 'cape1', 'cape2'], acc_ice_bells: ['scarfTail'],
                  acc_ice_goggles: ['lens', 'glint'] };
  var DISPLAY_PET = 'pet_puppy', CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  /* pieces of different slots may meet in one cell (a snorkel through a brim, a strap past a ruff):
     each slot's pieces sit a hair apart (u, on every axis) so no two faces ever share a plane —
     far inside a pixel, far outside the depth buffer's step */
  var NUDGE = { hat: 0, neck: 0.0015, face: 0.003, back: 0.0045 };

  /* ---------------- small helpers ---------------- */
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function frac(v) { var f = r6(((v % 1) + 1) % 1); return f === 1 ? 0 : f; }
  function half(n) { return (n - 1) / 2; }                                 /* a run of n cells centred on c: c ± half(n) */
  function glow(token) { return { token: token, mode: 'glow' }; }
  function mid(token) { return { token: token, lod: 'mid' }; }             /* a detail the LOW tier drops */
  function pat(token, mode) { return { token: token, mode: mode }; }       /* a shader pattern: no extra triangles */
  function key3(x, y, z) { return r6(x) + ',' + r6(y) + ',' + r6(z); }
  function fin3(a) { return Array.isArray(a) && a.length >= 3 && a.every(function (v) { return typeof v === 'number' && isFinite(v); }); }

  /* ================================================================
     SOCKET DESCRIPTORS
     ================================================================ */
  /* the reference: the puppy's sockets as px-characters builds them (voxel coordinates) */
  var REF = {
    hat: { bone: 'head', v: [0, 10.5, 3.5], w: 5, d: 4, flags: { earsSide: true } }, face: { bone: 'head', v: [0, 8.5, 6.5], w: 5, d: 4, flags: { earsSide: true } },
    neck: { bone: 'neck', v: [0, 5, 3.5], w: 5, d: 4, flags: {} }, back: { bone: 'body', v: [0, 6.5, -2], w: 5, d: 5, flags: {} }
  };
  function flagsOf(f) {
    var out = {};
    if (typeof f === 'string') f = f.split(/[\s,|]+/);
    if (Array.isArray(f)) f.forEach(function (k) { if (k) out[k] = true; });
    else if (f && typeof f === 'object') Object.keys(f).forEach(function (k) { if (f[k]) out[k] = true; });
    return out;
  }
  function isSock(s) { return !!s && typeof s === 'object' && (fin3(s.v) || fin3(s.at) || typeof s.w === 'number' || typeof s.bone === 'string'); }
  function socketsOf(petId) {
    var PC = chars(), row = PC && PC.SPECIES && typeof petId === 'string' ? PC.SPECIES[petId] : null;
    return row && row.sockets && typeof row.sockets === 'object' ? row.sockets : null;
  }
  /* whatever a rig builder hands over → the descriptor for this slot */
  function pickSock(slot, a) {
    if (isSock(a)) return a;
    if (a && typeof a === 'object' && a.sockets && isSock(a.sockets[slot])) return a.sockets[slot];
    if (a && typeof a === 'object' && isSock(a[slot])) return a[slot];
    if (typeof a === 'string') { var s = socketsOf(a); return s && isSock(s[slot]) ? s[slot] : null; }
    return null;
  }
  /* → {slot, bone, v, at, w, d, f}: a full descriptor, the missing fields from the reference puppy */
  function sockOf(slot, s) {
    var ref = REF[slot];
    s = isSock(s) ? s : ref;
    var v = fin3(s.v) ? s.v.slice(0, 3) : fin3(s.at) ? [r6(s.at[0] / GC), r6(s.at[1] / GC - 0.5), r6(s.at[2] / GC)] : ref.v.slice();
    return { slot: slot, bone: typeof s.bone === 'string' && s.bone ? s.bone : SLOT_BONE[slot], v: v, at: [r6(v[0] * GC), r6((v[1] + 0.5) * GC), r6(v[2] * GC)],
             w: clamp(Math.round(num(s.w, ref.w)), 2, 12), d: clamp(Math.round(num(s.d, ref.d)), 2, 14), f: flagsOf(s.flags) };
  }
  /* the width a piece ON the crown may take: one voxel in from each side when ears, horns or stalks stand there */
  function fit(S) { return S.f.earsUp || S.f.horns || S.f.stalks ? Math.max(2, S.w - 2) : S.w; }

  /* ================================================================
     THE BUILDER — voxels in root-frame coordinates, by bone
     ================================================================ */
  function Gear(id, S, ctx, cut) {
    this.id = id; this.S = S; this.ctx = ctx || null; this.cut = cut | 0; this.bones = {}; this.joints = {}; this.mine = {};
    this.hasFn = ctx && typeof ctx.has === 'function' ? ctx.has : null;
  }
  /* optional detail of level n: kept while fewer than n levels are cut */
  Gear.prototype.keep = function (n) { return this.cut < n; };
  /* the cells a coordinate overlaps: one on a whole voxel, both neighbours on a half */
  function spanOf(v) { return frac(v) === 0 ? [v] : [Math.floor(v), Math.ceil(v)]; }
  /* does the animal fill the space of a voxel centred at (x, y, z)? (y counts rows: row j stands on j) */
  Gear.prototype.solid = function (x, y, z) {
    if (!this.hasFn) return false;
    var xs = spanOf(x), ys = spanOf(y), zs = spanOf(z);
    for (var a = 0; a < xs.length; a++) for (var b = 0; b < ys.length; b++) for (var c = 0; c < zs.length; c++) if (this.hasFn(xs[a], ys[b], zs[c])) return true;
    return false;
  };
  Gear.prototype.free = function (x, y, z) { return !this.solid(x, y, z) && !this.mine[key3(x, y, z)]; };
  /* free, and not sitting straight on top of the animal: what stands above the crown (an ear tip, a
     horn, an eye stalk) is never capped */
  Gear.prototype.clear = function (x, y, z) { return this.free(x, y, z) && !this.solid(x, y - 1, z); };
  /* a column x, y0..y1, z of one colour, placed only where all of it is clear → true when placed */
  Gear.prototype.column = function (bone, x, y0, y1, z, colour) {
    for (var y = y0; y <= y1; y++) if (!(y === y0 ? this.free(x, y, z) : this.clear(x, y, z))) return false;
    this.box(bone, x, x, y0, y1, z, z, colour);
    return true;
  };
  Gear.prototype.model = function (bone) {
    var m = this.bones[bone];
    if (!m) m = this.bones[bone] = { id: this.id + (bone === this.S.bone ? '' : ':' + bone), palette: {}, keys: {}, grids: {}, slabs: [] };
    return m;
  };
  Gear.prototype.ch = function (m, colour) {
    var key = typeof colour === 'string' ? colour : JSON.stringify(colour), c = m.keys[key];
    if (!c) { c = m.keys[key] = CHARS[Object.keys(m.keys).length]; m.palette[c] = colour; }
    return c;
  };
  /* one voxel centred at (x, y, z) on a bone ('@' = the socket's): never where the animal is, never
     twice. → true when it was set */
  Gear.prototype.vox = function (bone, x, y, z, colour) {
    if (!colour) return false;
    var name = bone === '@' ? this.S.bone : bone, k = key3(x, y, z);
    if (!this.free(x, y, z)) return false;
    var m = this.model(name), px = frac(x), py = frac(y), pz = frac(z), gk = px + ',' + py + ',' + pz, g = m.grids[gk];
    if (!g) g = m.grids[gk] = { at: [px, py, pz], g: vox().grid({ grid: GC, origin: [0.5, 0, 0.5] }) };
    g.g.set(Math.round(x - px), Math.round(y - py), Math.round(z - pz), this.ch(m, colour));
    this.mine[k] = name;
    return true;
  };
  /* a box of voxel centres x0..x1 × y0..y1 × z0..z1 (whole steps; either order); colour may be
     fn(x, y, z) → colour | null */
  Gear.prototype.box = function (bone, x0, x1, y0, y1, z0, z1, colour) {
    var n = 0, t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var y = y0; y <= y1 + 1e-6; y++) for (var z = z0; z <= z1 + 1e-6; z++) for (var x = x0; x <= x1 + 1e-6; x++) {
      var c = typeof colour === 'function' ? colour(r6(x), r6(y), r6(z)) : colour;
      if (this.vox(bone, r6(x), r6(y), r6(z), c)) n++;
    }
    return n;
  };
  /* a rounded slab: a w × d run of row y centred on (cx, cz), its four corners off */
  Gear.prototype.round = function (bone, cx, y, cz, w, d, colour) {
    var hx = half(w), hz = half(d);
    return this.box(bone, cx - hx, cx + hx, y, y, cz - hz, cz + hz, function (x, yy, z) {
      return Math.abs(Math.abs(x - cx) - hx) < 1e-6 && Math.abs(Math.abs(z - cz) - hz) < 1e-6 ? null : typeof colour === 'function' ? colour(x, yy, z) : colour;
    });
  };
  /* a sheet thinner than a voxel: one box with faces at x0..x1 × y0..y1 × z0..z1 (voxel units: a
     cell i spans i ± 0.5, a row j spans j … j + 1). Placed as asked: details on the piece's own face */
  Gear.prototype.slab = function (bone, colour, x0, x1, y0, y1, z0, z1) {
    var name = bone === '@' ? this.S.bone : bone, m = this.model(name);
    m.slabs.push({ c: this.ch(m, colour), lo: [x0, y0, z0], hi: [x1, y1, z1] });
    return this;
  };
  Gear.prototype.joint = function (bone, x, y, z) { this.joints[bone] = [r6(x * GC), r6(y * GC), r6(z * GC)]; return this; };
  Gear.prototype.done = function () {
    var out = {}, bones = this.bones, e = NUDGE[this.S.slot] || 0;
    Object.keys(bones).forEach(function (b) {
      var m = bones[b], layers = [];
      Object.keys(m.grids).sort().forEach(function (gk) {
        var gl = m.grids[gk], s = gl.g.snapshot();
        if (s.c.length) layers.push({ grid: [GC, GC, GC], origin: [0.5, 0, 0.5], at: [r6(gl.at[0] * GC + e), r6(gl.at[1] * GC + e), r6(gl.at[2] * GC + e)], vox: s });
      });
      m.slabs.forEach(function (sl) {
        var g = [0, 1, 2].map(function (a) { return r6((sl.hi[a] - sl.lo[a]) * GC); });
        if (!(g[0] > 0 && g[1] > 0 && g[2] > 0)) return;
        layers.push({ grid: g, origin: [0, 0, 0], at: [r6(sl.lo[0] * GC + e), r6(sl.lo[1] * GC + e), r6(sl.lo[2] * GC + e)],
                      vox: vox().grid({ grid: g, origin: [0, 0, 0] }).set(0, 0, 0, sl.c).snapshot() });
      });
      if (layers.length) out[b] = { id: m.id, grid: GC, origin: [0.5, 0, 0.5], palette: m.palette, layers: layers, ground: false, ao: false };
    });
    return out;
  };

  /* ---------------- reading the animal ---------------- */
  /* the first free column beyond the animal stepping from x0 by dir (±1) over the rows ys at the
     depths zs, at least `min` from x0 */
  Gear.prototype.outside = function (x0, ys, zs, dir, min) {
    var last = x0;
    for (var s = 0; s <= 14; s++) {
      var x = x0 + dir * s, hit = false;
      for (var a = 0; a < ys.length && !hit; a++) for (var b = 0; b < zs.length && !hit; b++) hit = this.solid(x, ys[a], zs[b]);
      if (hit) last = x;
    }
    var out = last + dir;
    return dir > 0 ? Math.max(out, x0 + min) : Math.min(out, x0 - min);
  };
  /* the eyes: the species row's eye cells, else two two-row eyes at the edges of the face */
  Gear.prototype.eyes = function () {
    var row = this.ctx && this.ctx.row, S = this.S, list = [];
    if (row && Array.isArray(row.eyes)) row.eyes.forEach(function (c) { if (fin3(c)) list.push(c.slice(0, 3)); });
    if (!list.length) {
      var hx = half(S.w), y0 = Math.floor(S.v[1] - 0.5);
      [S.v[0] - hx, S.v[0] + hx].forEach(function (x) { list.push([x, y0, S.v[2] - 0.5], [x, y0 + 1, S.v[2] - 0.5]); });
    }
    var ys = list.map(function (c) { return c[1]; }), xs = list.map(function (c) { return c[0]; });
    return { cells: list, y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs) };
  };
  /* another socket of this animal (the earmuffs sit at the eye line) */
  Gear.prototype.other = function (slot) { var s = this.ctx && this.ctx.sockets; return sockOf(slot, s && s[slot]); };

  /* ---------------- shared shapes ---------------- */
  /* a ring row of voxels round the w × d wrap of a neck socket, R0..R1 voxels out, the outer corners
     rounded; colour(x, y, z, a) gets the angle round the neck (0 = the pet's left, π/2 = its chest) */
  function ring(g, S, y, R0, R1, colour) {
    var x = S.v[0], z = S.v[2], hx = half(S.w), hz = half(S.d);
    for (var dz = -(hz + R1); dz <= hz + R1 + 1e-6; dz++) for (var dx = -(hx + R1); dx <= hx + R1 + 1e-6; dx++) {
      var ex = Math.max(0, Math.abs(dx) - hx), ez = Math.max(0, Math.abs(dz) - hz), r = Math.max(ex, ez);
      if (r < R0 - 1e-6 || r > R1 + 1e-6 || (R1 >= 2 && ex > R1 - 1e-6 && ez > R1 - 1e-6)) continue;
      g.vox('@', r6(x + dx), y, r6(z + dz), typeof colour === 'function' ? colour(r6(x + dx), y, r6(z + dz), Math.atan2(dz, dx)) : colour);
    }
  }
  /* the neck a ring wraps: the descriptor's w × d, grown a voxel all round (twice at most) while the
     animal fills more than half of the first ring row (a descriptor narrower than the neck it names) */
  function wrapOf(g, S) {
    for (var e = 0; e <= 2; e++) {
      var W = { bone: S.bone, v: S.v, w: S.w + 2 * e, d: S.d + 2 * e, f: S.f }, hx = half(W.w) + 1, hz = half(W.d) + 1, n = 0, open = 0;
      for (var dz = -hz; dz <= hz + 1e-6; dz++) for (var dx = -hx; dx <= hx + 1e-6; dx++) {
        if (Math.abs(Math.abs(dx) - hx) > 1e-6 && Math.abs(Math.abs(dz) - hz) > 1e-6) continue;
        n++; if (g.free(r6(S.v[0] + dx), S.v[1], r6(S.v[2] + dz))) open++;
      }
      if (open * 2 >= n) return W;
    }
    return W;
  }
  /* the first free column each side of the head, two voxels behind a mask's layer k (its full width) */
  function faceSides(g, k) {
    var x = g.S.v[0], E = g.eyes(), out = {};
    [1, -1].forEach(function (s) { out[s] = g.outside(x, [E.y0, E.y1], [k - 2], s, half(g.S.w) + 1); });
    return out;
  }
  /* a mask's frame: its layer k (in front of the face), the eyes, and the half width that takes in
     both eyes with a voxel to spare and reaches the sides of the head */
  function maskFrame(g) {
    var S = g.S, E = g.eyes(), k = S.v[2] + 0.5, cx = (E.x0 + E.x1) / 2, F = faceSides(g, k);
    var hw = Math.max((E.x1 - E.x0) / 2 + 1, Math.min(F[1] - cx, cx - F[-1]) - 1);
    return { E: E, k: k, cx: cx, hw: hw, y0: E.y0 - 1, y1: E.y1 + 1 };
  }
  /* a band one row tall round the head at row y, from a mask at layer k: the strap of a mask, the tie
     of the leaf mask. Each side hugs the head from the mask back and tucks in under whatever sticks
     out (a hanging ear); when both sides reach the back of the head it closes across it (detail 1).
     → {1: x, -1: x}, the columns of its two sides */
  function strap(g, y, k, colour) {
    var F = faceSides(g, k), ends = {};
    [1, -1].forEach(function (s) {
      var line = F[s], z = g.free(line, y, k) ? k : k - 1;                    /* from the frame's side, or behind it */
      for (; z > k - 16; z--) {
        if (z < k - 1 && !g.solid(line - s, y, z)) { ends[s] = z; break; }     /* the head ends: round the back */
        if (!g.vox('@', line, y, z, colour)) break;                            /* an ear hangs there: tuck under it */
      }
    });
    if (g.keep(1) && ends[1] !== undefined && ends[1] === ends[-1]) g.box('@', F[-1], F[1], y, y, ends[1], ends[1], colour);
    return F;
  }

  /* ================================================================
     THE PIECES (pure): g = the builder, S = the socket descriptor
     ================================================================ */
  var PINK = 'PX Candy Pink', WAFFLE_D = 'PX Jungle Thatch Shade', CORAL = 'PX Coral', WHITE = 'Cloud White', SUNNY = 'PX Sunny', MINT = 'PX Mint';
  var KHAKI = 'PX Khaki', CANOPY_D = 'PX Jungle Canopy Deep', CANOPY_L = 'PX Jungle Canopy Light', PARROT_R = 'PX Jungle Parrot Red', BLUE = 'PX Jungle Parrot Blue';
  var NAVY = 'PX Penguin Back', SNOW = 'PX Penguin Front', ORANGE = 'PX Penguin Orange', AUTUMN = 'PX Tree Autumn', ROPE = 'PX Tree Rope', BARK = 'PX Tree Bark';
  var STONE = 'PX Castle Stone', STONE_D = 'PX Castle Stone Shade', CLOTH = 'PX Castle Cloth', GOLD = 'PX Castle Gold', PURPLE = 'PX Castle Banner';
  var WAFFLE = pat('PX Waffle', 'cobble'), CUP = pat('PX Tree Bark Trail', 'cobble'), LEAF = pat('PX Tree Oak', 'leaf'), LEAF_L = pat('PX Tree Oak Light', 'leaf');
  var JLEAF = pat('PX Jungle Canopy', 'leaf');

  var BUILD = {
    /* ---------------- pier ---------------- */
    /* a squashed pink scoop worn like a cap (it overhangs the crown by a voxel; between ears, horns or
       stalks it keeps to the crown's free width), two drips down its left side, and an upside-down
       waffle cone stepping 4 → 1, five tall, with a darker band */
    acc_pier_conehat: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], fw = fit(S), narrow = fw < S.w, W = narrow ? fw : S.w + 2, D = S.d + 2, W1 = narrow ? fw : S.w;
      var hx = half(W), hz = half(D), spots = [], got = 0, last = null;
      if (narrow) { g.box('@', x - hx, x + hx, y, y, z - hz + 1, z + hz - 1, PINK); g.box('@', x - hx, x + hx, y + 1, y + 1, z - hz + 2, z + hz - 2, PINK); }
      else { g.round('@', x, y, z, W, D, PINK); g.round('@', x, y + 1, z, W1, S.d, PINK); }
      /* the drips: the front-most free spots under the scoop's left edge (then its front edge) */
      for (var zz = z + hz - 1; zz >= z - hz + 1; zz--) spots.push([x + hx, zz]);
      for (var xx = x + hx - 1; xx >= x - hx + 1; xx--) spots.push([xx, z + hz]);
      spots.forEach(function (c) {
        if (got >= (g.keep(1) ? 2 : 1) || (last && Math.abs(last[0] - c[0]) + Math.abs(last[1] - c[1]) < 2) || !g.free(c[0], y - 1, c[1])) return;
        g.vox('@', c[0], y - 1, c[1], PINK);
        if (!got && g.keep(2)) g.vox('@', c[0], y - 2, c[1], PINK);
        last = c; got++;
      });
      /* the cone: as wide as stands clear of anything rising through the scoop (a tall ear) */
      var ws = null;
      for (var n0 = clamp(W1, 2, 4); n0 >= 1 && !ws; n0--) {
        var list = [n0, n0, n0 - 1, n0 - 2, 1].map(function (n) { return Math.max(1, n); });
        if (n0 === 1 || list.every(function (n, t) {
          for (var ax = x - half(n); ax <= x + half(n) + 1e-6; ax++) for (var az = z - half(n); az <= z + half(n) + 1e-6; az++) if (!g.clear(r6(ax), y + 2 + t, r6(az))) return false;
          return true;
        })) ws = list;
      }
      ws.forEach(function (n, t) {
        g.box('@', x - half(n), x + half(n), y + 2 + t, y + 2 + t, z - half(n), z + half(n), t === 2 && g.keep(3) ? WAFFLE_D : WAFFLE);
      });
    },
    /* a swim ring worn as a collar: two voxels thick and two rows tall, six coral and white stripes
       (coral at the chest), a sunny valve nub on top */
    acc_pier_ring: function (g, S) {
      S = wrapOf(g, S);
      var y = S.v[1], vx = S.v[0] + half(S.w) + 1, vz = S.v[2] + half(S.d) + 1, n = g.keep(2) ? 6 : 4;
      function stripe(x, yy, z, a) { return Math.floor(((a - Math.PI / 2 + Math.PI / n + 4 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI / n)) % 2 ? WHITE : CORAL; }
      ring(g, S, y - 1, 1, 2, stripe); ring(g, S, y, 1, 2, stripe);
      if (g.keep(1) && !g.vox('@', vx, y + 1, vz, SUNNY)) g.vox('@', vx + 1, y + 1, vz - 1, SUNNY);
    },
    /* a diving mask: a sunny frame round one wide pale lens (on 'lens', a shine streak) over both
       eyes, a mint strap round the head, a coral snorkel up the right side with its top bent back */
    acc_pier_snorkel: function (g, S) {
      var M = maskFrame(g), cx = M.cx, hw = M.hw, k = M.k, y0 = M.y0, y1 = M.y1;
      g.box('@', cx - hw, cx + hw, y0, y1, k, k, function (xx, yy) { return Math.abs(xx - cx) > hw - 0.5 || yy === y0 || yy === y1 ? SUNNY : null; });
      g.box('lens', cx - hw + 1, cx + hw - 1, y0 + 1, y1 - 1, k, k, pat('PX Ice 2', 'ice'));
      if (g.keep(3)) g.slab('lens', mid(WHITE), cx + hw - 2.5, cx + hw - 2, y1 - 1.5, y1 - 0.25, k + 0.5, k + 0.75);
      var F = strap(g, M.E.y1, k, MINT), xt = F[-1], top = M.E.y1 + 5;
      g.box('@', xt, xt, M.E.y1 + 1, top, k - 1, k - 1, CORAL);
      if (g.keep(2)) g.vox('@', xt, top, k - 2, CORAL);
    },
    /* a plain coral balloon (rounded 5 × 6 × 5, a white shine, a knot) on a string of seven tied at
       the back socket; it rises up and back in three lengths on cape0–cape2, still at rest and swung
       up toward upright as the pet speeds up. The first lean that clears the animal (a tall tail) wins */
    acc_pier_balloon: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z0 = S.v[2] - Math.max(0, half(S.d) - 2), STRING = 'PX Castle Stone Shade';
      /* the hinges only lift (as a cape's), so at rest it trails well back: about upright at a run */
      var LEANS = [[0, -1, -1, -2, -3, -3, -4], [0, 0, -1, -1, -2, -2, -3], [0, 0, 0, -1, -1, -1, -2], [0, 0, 0, 0, 0, 0, 0]], SEG = ['@', 'cape0', 'cape0', 'cape1', 'cape1', 'cape2', 'cape2'];
      function balloon(bz, set) {
        var ok = true, by = y + 7;
        for (var t = 0; t < 6; t++) {
          var r = t === 0 || t === 5 ? 1 : 2;                                  /* 3 wide at the ends, 5 in the middle */
          for (var dz = -r; dz <= r; dz++) for (var dx = -r; dx <= r; dx++) {
            if ((r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) || ((t === 1 || t === 4) && Math.abs(dx) + Math.abs(dz) > 3)) continue;
            if (!set) ok = ok && g.free(x + dx, by + t, bz + dz);
            else g.vox('cape2', x + dx, by + t, bz + dz, t === 4 && dx === 1 && dz === r && g.keep(1) ? WHITE : CORAL);
          }
        }
        return ok;
      }
      var lean = LEANS.filter(function (L) {
        return L.every(function (dz, n) { return g.free(x, y + n, z0 + dz); }) && balloon(z0 + L[6] - 1, false);
      })[0] || LEANS[0];
      lean.forEach(function (dz, n) { g.vox(SEG[n], x, y + n, z0 + dz, n === 6 ? CORAL : STRING); });
      g.joint('cape0', x, y + 1, z0 + lean[1]).joint('cape1', x, y + 3, z0 + lean[3]).joint('cape2', x, y + 5, z0 + lean[5]);
      balloon(z0 + lean[6] - 1, true);
    },

    /* ---------------- jungle ---------------- */
    /* blossoms, pink and orange in turn, round the front of the neck just outside the edge of the head
       (so it shows from above), dipping a row at the chest, tied off with a leaf at each end */
    acc_jungle_garland: function (g, S) {
      S = wrapOf(g, S);
      var x = S.v[0], y = S.v[1], z = S.v[2], hx = half(S.w), hz = half(S.d), cells = [];
      for (var dz = -(hz + 2); dz <= hz + 2 + 1e-6; dz++) for (var dx = -(hx + 2); dx <= hx + 2 + 1e-6; dx++) {
        var ex = Math.max(0, Math.abs(dx) - hx), ez = Math.max(0, Math.abs(dz) - hz);
        if (Math.max(ex, ez) !== 2 || ex + ez > 3) continue;
        var t = (Math.atan2(dz, dx) + 2 * Math.PI) % (2 * Math.PI);
        cells.push({ x: r6(x + dx), z: r6(z + dz), t: t, d: Math.abs(t - Math.PI / 2), low: dz > hz + 1.5 && Math.abs(dx) < 1.5 });
      }
      cells.sort(function (a, b) { return a.d - b.d || a.t - b.t; });
      cells = cells.slice(0, g.keep(2) ? 11 : 9).sort(function (a, b) { return a.t - b.t; });
      cells.forEach(function (c, i) {
        var end = i === 0 || i === cells.length - 1;
        if (end && !g.keep(1)) return;
        g.vox('@', c.x, c.low ? y - 1 : y, c.z, end ? JLEAF : i % 2 ? 'PX Jungle Flower Pink' : 'PX Jungle Flower Orange');
      });
    },
    /* a wide-brimmed khaki explorer hat: a one-voxel brim (ears pass through notches), a crown with a
       deep green band, two light leaves and one upright red feather on its left */
    acc_jungle_hat: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], cw = fit(S), cd = Math.max(2, Math.min(S.d + 1, cw)), xl = x + half(cw) + 1, zf = z + half(cd);
      g.round('@', x, y, z, S.w + 4, S.d + 4, KHAKI);
      g.box('@', x - half(cw), x + half(cw), y + 1, y + 1, z - half(cd), z + half(cd), CANOPY_D);
      g.box('@', x - half(cw), x + half(cw), y + 2, y + 2, z - half(cd), z + half(cd), KHAKI);
      for (var zz = z - half(cd) + 1; zz <= zf && !g.column('@', xl, y + 1, y + 4, zz, PARROT_R); zz++) { /* the first clear spot from the back */ }
      if (g.keep(1)) { g.vox('@', xl, y + 1, zf - 1, CANOPY_L); g.vox('@', xl, y + 1, zf, CANOPY_L); }
    },
    /* a blue butterfly landed on the tip of the nose under the eyes, its wings open to the front: a
       dark body, white wing tips (steady glow cubes at night); static */
    acc_jungle_butterfly: function (g, S) {
      var E = g.eyes(), x = (E.x0 + E.x1) / 2, top = E.y0 - 1, front = S.v[2] - 0.5;
      for (var kk = front + 8; kk > front; kk--) if (g.solid(x, top, kk) || g.solid(x, top - 1, kk) || g.solid(x, top - 2, kk)) { front = kk; break; }
      var k = front + 1;
      [1, -1].forEach(function (s) {
        g.box('@', x + s, x + 2 * s, top, top, k, k, function (xx) { return Math.abs(xx - x) > 1.5 && g.keep(1) ? glow(WHITE) : BLUE; });
        g.box('@', x + s, x + 2 * s, top - 1, top - 1, k, k, BLUE);
        g.vox('@', x + s, top - 2, k, BLUE);
      });
      g.box('@', x, x, top - 2, top - 1, k, k, NAVY);
    },
    /* a khaki canvas pack behind the neck: a deep green flap, bark straps down over both shoulders, a
       rolled cream map with a red tie across the top, a banana poking out of the left side pocket */
    acc_jungle_pack: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], pw = S.f.wings ? S.w : S.w + 1, pd = Math.min(3, S.d), ph = 4;
      var zf = z + half(S.d), zb = zf - pd + 1, hx = half(pw), xp = x + hx + 1;
      g.box('@', x - hx, x + hx, y, y + ph - 1, zb, zf, function (xx, yy, zz) { return yy === y + ph - 1 || (zz === zb && yy === y + ph - 2) ? CANOPY_D : KHAKI; });
      [1, -1].forEach(function (s) { var xs = x + s * (half(S.w) + 1); g.box('@', xs, xs, y - 3, y - 1, zf, zf, 'PX Jungle Bark Light'); });
      g.box('@', x - hx - 1, x + hx + 1, y + ph, y + ph, zb + 1, zb + 1, function (xx) { return Math.abs(xx - x) < 0.6 ? PARROT_R : 'PX Cream'; });
      if (g.keep(2)) g.box('@', xp, xp, y + 1, y + 2, zb + 1, zb + 1, 'PX Khaki Shade');
      g.vox('@', xp, y + 3, zb + 1, 'PX Banana'); g.vox('@', xp, y + 4, zb, 'PX Banana');
      if (g.keep(1)) g.vox('@', xp + 1, y + 2, zb + 1, 'PX Banana');
    },

    /* ---------------- treetop ---------------- */
    /* a shallow acorn cup (knobbly: the cobble pattern) on a rolled brim, narrow enough to sit
       between ears, tufts and horns, its stalk on top with one oak leaf */
    acc_treetop_acorn: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], dw = fit(S), dd = Math.max(2, Math.min(S.d, dw)), tw = Math.max(1, dw - 2), td = Math.max(1, dd - 1), narrow = dw < S.w;
      /* the rolled lip rings the cup; between ears, horns or stalks it is the cup's own first row */
      if (!narrow) ring(g, { v: [x, y, z], w: dw, d: dd }, y, 1, 1, 'PX Tree Bark Trail 2');
      g.round('@', x, y, z, dw, dd, narrow ? 'PX Tree Bark Trail 2' : CUP);
      g.box('@', x - half(tw), x + half(tw), y + 1, y + 1, z - half(td), z + half(td), CUP);
      g.box('@', x, x, y + 2, y + 3, z, z, BARK);
      if (g.keep(1)) g.vox('@', x + 1, y + 3, z, LEAF_L);
    },
    /* two oak leaves as a mask, one voxel thick, one round each eye with a hole the pet's own eye and
       glint look through: lobes over the brow, tips flaring past the cheeks (one autumn), a rope tie
       round the head */
    acc_treetop_leafmask: function (g, S) {
      var M = maskFrame(g), E = M.E, k = M.k, cx = M.cx, hw = M.hw;
      function hole(xx, yy) { return E.cells.some(function (c) { return Math.abs(c[0] - xx) < 1e-6 && Math.abs(c[1] - yy) < 1e-6; }); }
      g.box('@', cx - hw - 1, cx + hw + 1, M.y0, M.y1, k, k, function (xx, yy) {
        var o = Math.abs(xx - cx);
        if (hole(xx, yy)) return null;
        if (o > hw + 0.5) return yy === E.y0 ? (xx > cx ? AUTUMN : LEAF_L) : null;          /* the leaf tips */
        if (yy === M.y1 && (o < 0.5 || o > hw - 0.5 || !g.keep(2))) return null;            /* two lobes over the brow */
        if (yy === M.y0 && o > hw - 1.5) return null;
        return xx >= cx ? LEAF : LEAF_L;
      });
      if (g.keep(3)) strap(g, E.y0, k, ROPE);
    },
    /* chunky blue binoculars (two 2 × 2 × 3 barrels, sunny rims, pale lenses, a bridge) hanging at the
       chest on a rope strap round the neck; they swing from the strap on 'scarfTail' */
    acc_treetop_binoculars: function (g, S) {
      S = wrapOf(g, S);
      var x = S.v[0], y = S.v[1], zf = S.v[2] + half(S.d) + 1, yb = y - 2;
      ring(g, S, y, 1, 1, ROPE);
      [1, -1].forEach(function (s) {
        var xi = x + s * 1.5;
        g.box('scarfTail', xi - 0.5, xi + 0.5, yb - 1, yb, zf - 1, zf + 1, function (xx, yy, zz) { return zz === zf + 1 ? SUNNY : 'PX Tree Flag'; });
        if (g.keep(2)) g.slab('scarfTail', pat('PX Lens Pale', 'ice'), xi - 0.75, xi + 0.75, yb - 0.75, yb + 0.75, zf + 1.5, zf + 1.75);
        g.vox('scarfTail', xi, y - 1, zf, ROPE);
      });
      if (g.keep(1)) g.vox('scarfTail', x, yb, zf, 'PX Tree Flag');
      g.joint('scarfTail', x, y, zf);
    },
    /* two broad oak leaves tied on like wings at the shoulders with a rope strap: each an oval five
       out and six up in three lengths on cape0–cape2, leaning back a voxel a length (upright beside
       an animal's own wings), an autumn tip */
    acc_treetop_leafwings: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], z0 = z + half(S.d) - 1, lean = S.f.wings || !g.keep(2) ? 0 : 1;
      var SHAPE = [[1, 2], [1, 4], [1, 5], [2, 5], [2, 5], [3, 4]], SEG = ['cape0', 'cape0', 'cape1', 'cape1', 'cape2', 'cape2'];
      g.box('@', x - half(S.w), x + half(S.w), y, y, z0 + 1, z0 + 1, ROPE);
      [1, -1].forEach(function (s) {
        SHAPE.forEach(function (sp, r) {
          for (var o = sp[0]; o <= sp[1]; o++) g.vox(SEG[r], x + s * (o - 0.5), y + r, z0 - lean * Math.floor(r / 2), r === 5 && o === sp[1] && g.keep(1) ? AUTUMN : LEAF);
        });
      });
      g.joint('cape0', x, y, z0 + 0.5).joint('cape1', x, y + 2, z0 + 0.5 - lean).joint('cape2', x, y + 4, z0 + 0.5 - 2 * lean);
    },

    /* ---------------- castle ---------------- */
    /* a white pleated ruff under the chin: one row, two voxels deep, pleats two voxels wide in white
       and lilac, a gold stud at the front */
    acc_castle_ruff: function (g, S) {
      S = wrapOf(g, S);
      var y = S.v[1], cx = S.v[0], cz = S.v[2], hx = half(S.w), hz = half(S.d);
      g.box('@', cx - hx - 2, cx + hx + 2, y, y, cz - hz - 2, cz + hz + 2, function (x, yy, z) {
        var ex = Math.abs(x - cx) - hx, ez = Math.abs(z - cz) - hz;
        if (ex < 0.5 && ez < 0.5) return null;
        if (ez > 1.5 && z > cz && Math.abs(x - cx) < 0.6 && g.keep(1)) return GOLD;
        return Math.floor(((ez >= ex ? x - cx : z - cz + 50) + 100.5) / (g.keep(2) ? 2 : g.keep(3) ? 3 : 5)) % 2 ? 'PX Lilac Base' : CLOTH;
      });
    },
    /* a knight's visor with a wide gap, so the eyes always show: a silver band across the brow with a
       white highlight, another under the eyes (none over the nose), gold rivets at the sides, curving
       back along the sides of the head where there is one */
    acc_castle_visor: function (g, S) {
      var E = g.eyes(), k = S.v[2] + 0.5, cx = (E.x0 + E.x1) / 2, hw = (E.x1 - E.x0) / 2 + 1, yt = E.y1 + 1, yb = E.y0 - 1;
      g.box('@', cx - hw, cx + hw, yt, yt, k, k, function (xx) { return Math.abs(xx - cx) <= hw - 1.5 && g.keep(2) ? CLOTH : STONE; });
      g.box('@', cx - hw, cx + hw, yb, yb, k, k, STONE);
      [1, -1].forEach(function (s) {
        var xs = cx + s * hw;
        g.box('@', xs, xs, E.y0, E.y1, k, k, GOLD);
        var xo = g.outside(cx, [yb, yt], [k - 1], s, hw);
        if (g.keep(1)) g.box('@', xo, xo, yb, yt, k - 2, k - 1, function (xx, yy, zz) { return (yy === yb || yy === yt) && g.solid(xo - s, yy, zz) ? STONE_D : null; });
      });
    },
    /* a round open-faced silver helmet: a shaded rim hugging the head's top at the sides and back, a
       gold band, a dome with a white highlight, a tall red plume curling back. Where ears, horns or
       stalks stand at the crown's edge they poke out through it (and it has no rim) */
    acc_castle_helm: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], hx = half(S.w), hz = half(S.d), bw = S.w + 2, bd = S.d + 2, zp = z - 0.5;
      if (fit(S) === S.w && g.keep(2)) g.box('@', x - hx - 1, x + hx + 1, y - 1, y - 1, z - hz - 1, z + hz - 1, function (xx, yy, zz) {
        return (Math.abs(xx - x) > hx + 0.5) !== (zz < z - hz - 0.5) ? STONE_D : null;
      });
      g.round('@', x, y, z, bw, bd, function (xx, yy, zz) { return Math.abs(xx - x) > half(bw) - 0.5 || Math.abs(zz - z) > half(bd) - 0.5 ? GOLD : STONE; });
      g.round('@', x, y + 1, z, S.w, S.d, function (xx, yy, zz) { return xx === x + hx - 1 && zz === z + hz && g.keep(1) ? CLOTH : STONE; });
      if (g.keep(3)) g.round('@', x, y + 2, z, Math.max(1, S.w - 2), Math.max(1, S.d - 2), STONE);
      g.box('@', x, x, y + 3, y + 5, zp, zp, 'PX Castle Pennant');
      g.vox('@', x, y + 6, zp - 1, 'PX Castle Pennant'); g.vox('@', x, y + 5, zp - 2, 'PX Castle Pennant');
    },
    /* a long purple cloak on cape0–cape2: a white collar with iron spots and a gold sun clasp at the
       neck, the cloth along the back, the rest hanging behind the rump to a gold hem (a tail that
       stands up there passes through a slit: the cloth never fills its cells) */
    acc_castle_cloak: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, z = S.v[2], hx = half(S.w), hz = half(S.d), zf = z + hz, zm = Math.round(z), z0 = z - hz;
      g.box('@', x - hx - 1, x + hx + 1, y, y, zf, zf, function (xx) { return g.keep(1) && Math.abs(Math.abs(xx - x) - 1.5) < 0.6 ? 'PX Castle Iron' : CLOTH; });
      if (g.keep(2)) g.vox('@', x, y + 1, zf, GOLD);
      g.box('cape0', x - hx, x + hx, y, y, zm, zf - 1, PURPLE);
      g.box('cape1', x - hx, x + hx, y, y, z0, zm - 1, PURPLE);
      g.box('cape2', x - hx, x + hx, y - 4, y, z0 - 1, z0 - 1, function (xx, yy) { return yy === y - 4 ? GOLD : PURPLE; });
      g.joint('cape0', x, y + 0.5, zf - 0.5).joint('cape1', x, y + 0.5, zm - 0.5).joint('cape2', x, y + 0.5, z0 - 0.5);
    },

    /* ---------------- ice ---------------- */
    /* two round mint pads on a white fluff rim (glow) at the sides of the head, outside whatever is
       there (ears, frills), on a thin sky-blue band over the crown that finds a way between ears and
       horns */
    acc_ice_earmuffs: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, pc = Math.min(Math.floor(g.other('face').v[1]), y - 3), pz = frac(S.v[2]) ? Math.floor(S.v[2]) : S.v[2], xs = {}, zb = pz;
      [1, -1].forEach(function (s) {
        var xo = g.outside(x, [pc - 1, pc, pc + 1], [pz - 1, pz, pz + 1], s, half(S.w) + 1);
        xs[s] = xo;
        g.box('@', xo, xo, pc - 1, pc + 1, pz - 1, pz + 1, g.keep(1) ? glow('PX Ice Snow') : 'PX Aurora Mint');
        g.box('@', xo + s, xo + s, pc - 1, pc + 1, pz - 1, pz + 1, function (xx, yy, zz) { return Math.abs(yy - pc) + Math.abs(zz - pz) > 1.5 ? null : 'PX Aurora Mint'; });
      });
      [0, 1, -1, 2, -2].some(function (dz) {                                     /* the depth nearest the pads with a free path over the crown */
        for (var xx = xs[-1]; xx <= xs[1]; xx++) if (g.solid(xx, y, pz + dz)) return false;
        zb = pz + dz; return true;
      });
      g.box('@', xs[-1], xs[1], y, y, zb, zb, 'PX Sky Blue');
      [1, -1].forEach(function (s) { g.box('@', xs[s], xs[s], pc + 2, y - 1, zb, zb, 'PX Sky Blue'); });
    },
    /* a red collar with three round golden bells at the front (a knob on top, a dark slot below); the
       middle one hangs on 'scarfTail' and bobs on hops */
    acc_ice_bells: function (g, S) {
      S = wrapOf(g, S);
      var x = S.v[0], y = S.v[1], zf = S.v[2] + half(S.d) + 1;
      ring(g, S, y, 1, 1, CORAL);
      [-3, 0, 3].forEach(function (o) {
        var bone = o ? '@' : 'scarfTail', bx = x + o;
        g.box(bone, bx - 0.5, bx + 0.5, y - 3, y - 2, zf - 0.5, zf + 0.5, 'Star Gold');
        if (g.keep(2)) g.vox(bone, bx, y - 1, zf, 'Star Gold');
        if (g.keep(1)) g.slab(bone, mid(NAVY), bx - 0.75, bx + 0.75, y - 3, y - 2.75, zf + 1, zf + 1.15);
      });
      g.joint('scarfTail', x, y - 0.5, zf);
    },
    /* chunky snow goggles: a white frame round one wide lens shaded orange → coral → pink (on 'lens')
       with a glint on its corner ('glint'), a navy strap round the head */
    acc_ice_goggles: function (g, S) {
      var M = maskFrame(g), cx = M.cx, hw = M.hw, k = M.k, y0 = M.y0, y1 = M.y1;
      g.box('@', cx - hw, cx + hw, y0, y1, k, k, function (xx, yy) { return Math.abs(xx - cx) > hw - 0.5 || yy === y0 || yy === y1 ? 'PX Ice Snow' : null; });
      g.box('lens', cx - hw + 1, cx + hw - 1, y0 + 1, y1 - 1, k, k, function (xx) {
        var t = (xx - cx) / Math.max(1, hw - 1);
        return t < -0.34 ? ORANGE : t > 0.34 ? PINK : CORAL;
      });
      g.slab('glint', glow('PX Aurora Sky'), cx + hw - 1.5, cx + hw - 1, y1 - 0.5, y1, k + 0.5, k + 0.75);
      g.joint('glint', cx + hw - 1.25, y1 - 0.25, k + 0.625);
      if (g.keep(2)) strap(g, M.E.y1, k, NAVY);
    },
    /* a rigid backpack shaped like a round penguin, upright and facing back: navy, a white tummy that
       wraps round its sides and glows softly after dark, white eye patches, an orange beak and feet,
       little flippers, two mint straps */
    acc_ice_pack: function (g, S) {
      var x = S.v[0], y = S.v[1] + 0.5, zf = S.v[2] + half(S.d), zb = zf - 2, hx = S.w >= 5 ? 2 : 1;
      g.box('@', x - hx, x + hx, y, y + 4, zb, zf, function (xx, yy, zz) {
        var o = Math.abs(xx - x), face = zz === zb, side = o > hx - 0.5;
        if ((yy === y || yy === y + 4) && side) return null;                   /* round off the top and bottom */
        if (yy === y + 4 && zz !== zb + 1) return null;
        if (yy === y + 3 && (face ? Math.abs(o - 1) < 0.6 : side && zz === zb)) return SNOW;
        if (yy >= y + 1 && yy <= y + 2 && ((face && !side) || (side && zz === zb))) return glow(SNOW);
        return NAVY;
      });
      g.vox('@', x, y + 3, zb - 1, ORANGE);
      [1, -1].forEach(function (s) {
        if (g.keep(2)) g.vox('@', x + s, y, zb - 1, ORANGE);
        if (g.keep(1)) g.vox('@', x + s * (hx + 1), y + 2, zb + 1, NAVY);
        g.box('@', x + s * (half(S.w) + 1), x + s * (half(S.w) + 1), y - 3, y - 1, zf, zf, MINT);
      });
    }
  };

  /* ================================================================
     ROWS, THE OPEN TABLE, DISPLAYS
     ================================================================ */
  /* the triangles of a piece at a tier (every face kept, as the rig meshes it) */
  function trisOf(bones, tier) {
    var V = vox(), n = 0;
    Object.keys(bones || {}).forEach(function (b) { n += V.stats(bones[b], { full: true, tier: tier || 'HIGH' }).tris; });
    return n;
  }
  /* full detail first; then one optional level less at a time until it is inside its own cap. Over
     its slot's cap even then → it throws (the rig leaves it off) */
  function build(id, sock, ctx) {
    if (!BUILD[id]) return { bones: {}, joints: {}, cut: 0, tris: 0 };
    var slot = GEAR[id][1], S = sockOf(slot, pickSock(slot, sock)), res = null;
    for (var cut = 0; cut <= MAX_CUT; cut++) {
      var g = new Gear(id, S, ctx, cut);
      BUILD[id](g, S);
      res = { bones: g.done(), joints: g.joints, cut: cut };
      res.tris = trisOf(res.bones);
      if (res.tris <= GEAR[id][2]) break;
    }
    if (res.tris > SLOT_CAPS[slot]) throw new Error('SLPxGear: ' + id + ' needs ' + res.tris + ' triangles on this animal (' + slot + ' cap ' + SLOT_CAPS[slot] + ')');
    return res;
  }
  function accVoxels(id, sock, ctx) { return build(id, sock, ctx).bones; }
  function jointsOf(id, sock, ctx) { return build(id, sock, ctx).joints; }
  function accRow(id) {
    var slot = GEAR[id][1];
    /* → {bone: VoxModel}; the same map as .bones beside .joints (both hidden from Object.keys), for
       a rig builder that re-seats the helper bones. A piece that cannot fit throws */
    function voxels(sock, ctx) {
      var res = build(id, sock, ctx), out = res.bones;
      Object.defineProperty(out, 'bones', { value: out });
      Object.defineProperty(out, 'joints', { value: res.joints });
      return out;
    }
    return { id: id, isle: GEAR[id][0], slot: slot, socket: slot, bone: SLOT_BONE[slot], bones: [SLOT_BONE[slot]].concat(HELPERS[id] || []), cap: GEAR[id][2],
             coversEyes: !!LENSES[id], voxels: voxels, build: voxels, joints: function (sock, ctx) { return jointsOf(id, sock, ctx); } };
  }
  var ACCS = {};
  IDS.forEach(function (id) { ACCS[id] = accRow(id); });

  /* the context a rig builder hands a piece on a species (Node displays and tests): the species'
     row, sockets, joints and has() over its voxels under this outfit (null without px-characters) */
  function ctxFor(petId, acc) {
    var PC = chars();
    if (!PC || typeof PC.speciesId !== 'function') return null;
    var id = PC.speciesId(petId), row = id && PC.SPECIES[id];
    if (!row || typeof row.voxels !== 'function') return null;
    var base = row.voxels(acc || {}, { tier: 'HIGH', rig: false }) || {}, cells = {}, hidden = { blush: 1, spark: 1, glint: 1, nightH: 1, scan: 1 };
    Object.keys(base).forEach(function (b) {
      if (hidden[b] || !base[b] || !Array.isArray(base[b].layers)) return;
      PC.eachVoxel(base[b], function (x, y, z, e, gr) {
        if (Math.abs(gr[0] - GC) < 1e-9 && Math.abs(gr[2] - GC) < 1e-9) cells[Math.round(x / GC) + ',' + Math.round(y / GC - 0.5) + ',' + Math.round(z / GC)] = 1;
      });
    });
    return { id: null, species: id, row: row, sockets: PC.socketsOf(id), joints: PC.jointsOf(id), tier: 'HIGH', rig: false, GC: GC, V: vox(),
             has: function (i, j, k) { return cells[Math.round(i) + ',' + Math.round(j) + ',' + Math.round(k)] === 1; } };
  }
  /* the display model of a piece (Node, the lab): the piece on its own at rest by day, fitted to the
     display pet (st.pet; the puppy when it is not given). Photocards show the pet wearing it: that
     is the pet's own handler (stage.voxRoute) */
  var voxels = {}, HIDDEN = { nightH: 1, scan: 1, glint: 1 };
  IDS.forEach(function (id) {
    voxels[id] = function (st) {
      var pet = st && typeof st.pet === 'string' && st.pet ? st.pet : DISPLAY_PET, slot = GEAR[id][1], acc = {};
      acc[slot] = id;
      var ctx = ctxFor(pet, acc), per = accVoxels(id, ctx ? ctx.sockets[slot] : REF[slot], ctx);
      return vox().compose(Object.keys(per).filter(function (b) { return !HIDDEN[b]; }).map(function (b) { return { model: per[b] }; }), { id: id });
    };
  });
  /* register the 20 rows in the open table (first wins; a table that is not there yet is filled on
     the next call: when the vox group runs, or when a test hands the module over) */
  function fill(PC) {
    PC = PC || chars();
    if (!PC || !PC.ACCS || typeof PC.ACCS !== 'object') return 0;
    var n = 0;
    IDS.forEach(function (id) {
      if (PC.ACCS[id]) return;
      try { PC.ACCS[id] = ACCS[id]; if (PC.ACCS[id] === ACCS[id]) n++; } catch (e) { /* a frozen table keeps what it has */ }
    });
    return n;
  }
  /* SL3D.defineVox('gear', factory): fills the table; the pieces show on pets (no model of their own) */
  function factory() { fill(); return {}; }

  return {
    VERSION: VERSION, GC: GC, GEAR: GEAR, IDS: IDS, SLOTS: SLOTS, SLOT_BONE: SLOT_BONE, SLOT_CAPS: SLOT_CAPS, REF: REF, ACCS: ACCS, MAX_CUT: MAX_CUT,
    voxels: voxels, accVoxels: accVoxels, jointsOf: jointsOf, build: build, trisOf: trisOf, sockOf: sockOf, ctxFor: ctxFor, fill: fill, factory: factory
  };
}));
