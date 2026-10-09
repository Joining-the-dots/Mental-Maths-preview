/* ================================================================
   My Island 3D v3 — SLVox, the pure voxel engine (no THREE, no DOM).
   window.SLVox in the browser, module.exports in Node (contracts.vox;
   voxel-engine 1_kitApi). A model is DATA — a VoxModel, or a pure
   builder that returns one. This file turns it into greedy-meshed,
   face-culled, corner-AO'd NON-indexed triangles in the kit's own
   convention plus one attribute, vuv. vox-gl.js (SLVoxGL) owns every
   THREE object, the atlas and the 'pixel-vox' program.

   API (frozen contract):
     VERSION · GRIDS {G2 G4 G8 G16 G32 GC PATH} · MODES {block 0, soft 1, decal 2, glow 3, water 4,
       plank 5, cobble 6, snow 7, ice 8, leaf 9} · MODE_NAMES · AO (default corner table) · FACES
     grid({grid, origin}) → Grid builder: set get has clear box blob disc ring lathe line bitmap text
       paint front mirrorX rotY90 translate merge group decal anchor pivot hashTone bounds snapshot
       model(meta) → VoxModel
     mesh(model, {tier, lod, full, cull, colorOf, cellOf, ao, greedy}) →
       {parts: [{name, pivot, stateColor, perCopy, member, castShadow, glow,
                 arrays: {position, normal, color, vuv}, quads, tris, faces, decals: [{cell, first, count}]}],
        pivots {name: {origin: [x, y, z], parent}}, anchors {name: {at: [x, y, z], pivot}},
        bounds {min, max}, height, hit, voxels, faces, issues}
       colorOf(token) → [r, g, b] linear; default: SLIslandLook through SLKit.resolveHex, sRGB → linear.
       Unknown tokens and raw hex render Pebble and are logged in issues (QA), as K.col does.
     lod(model, n = 1, {decalToken(cell) → token}) → VoxModel · cullFor(lookKind, {tall}) → faces dropped
     stats(model, o) → {voxels, faces, quads, tris, parts, bytes} · hash(x) → 8-hex FNV-1a
     placeholder(fp, h, token) → crate VoxModel · compose([{model, at}], meta) → VoxModel (dioramas)

   VoxModel {id, grid, origin, palette, layers, pivots, decals, anchors, hit, cull, ground, ao}
     grid     voxel size in u: a number or [sx, sy, sz] (the root frame and the layers' default)
     origin   [ox, oy, oz] voxel coords of the root frame mapped to item (0, 0, 0). Default: the first
              layer's (slices: the centre of their footprint; builders: [0.5, 0, 0.5], so voxel 0
              sits centred on the pivot as in the mockup's Obj).
     palette  {char: 'Token' | {token, mode, state: {key, off, on, map?}, pivot, lod: 'mid' | 'high',
              copy: true | n, member: true, cell (mode 'decal': one atlas cell on every face)}}
     layers   [{grid?, at?: [x, y, z] u, origin?, slices? | build?: fn(o) | vox?: snapshot, mirror?: 'x',
              ground?}] — slices are bottom-up y-slices of rows back (−z) → front (+z), one char per
              voxel along +x ('.' or ' ' empty). mirror 'x' copies every voxel to its mirror across
              item x = 0 where that cell is empty. Each layer meshes on its own. A build fills
              voxels (and o.group names); pivots, anchors and decals are declared on the model.
     pivots   {name: {at: [i, j, k], parent?}} · anchors {name: [i, j, k] | {at, pivot}} — ROOT-frame
              voxel coords where an integer is a voxel CENTRE (.5 reaches its faces):
              item = (at + 0.5 − origin) × grid
     decals   [{face: '±x' | '±z' | '+y', at: [i, j, k], size: [w, h], cell, pivot?, copy?, layer?}] — at
              = the rect's lowest voxel (smallest i / j / k), w along the face's horizontal axis (x for
              ±z and +y, z for ±x), h along its vertical one (y; z on +y). The decal REPLACES those
              faces with one atlas quad (mode 2), mapped upright as seen from outside.
     hit [w, h, d] u · cull ['-y', '-z', …] (overrides the caller's cullFor default) · ground (default
     true: faces down onto item y = 0 are never emitted and AO counts the ground under the base)
     · ao true | false | [a0..a3] (overrides the table)

   MESHER. Parts bucket by (pivot, class): class 'body' | state (stateColor / member) | copy (perCopy);
   names body | <pivot> | [<pivot>_]state_<key> | [<pivot>_]copy_<n>. A face is emitted when its
   neighbour (same layer) is empty or rides a different pivot; faces between buckets of one pivot are
   culled. Corner AO: side1 + side2 + corner occupancy (same pivot + the ground) → level 0..3 → the
   table (model.ao, o.ao, SLIslandLook.MATERIAL.voxAo, then AO); glow faces take none. The quad
   diagonal flips when a0 + a2 < a1 + a3. Greedy merge per direction and slice over (char, mode,
   4-corner AO, part), widening only where the AO does not vary along that axis, so a merged quad
   interpolates exactly what its voxels would. Decals never merge.

   FACE FRAMES (u right, v up, seen from outside; u × v = normal; quad corners BL BR TR TL):
     +z u=+x v=+y · −z u=−x v=+y · +x u=−z v=+y · −x u=+z v=+y · +y u=+x v=−z · −y u=+x v=+z
   vuv = (u, v, mode) with u, v the ABSOLUTE voxel coordinates of the vertex on the face plane in
   that layer's index space, signed by the frame: fract() is the in-voxel position, floor() a stable
   per-voxel id, and greedy merging never moves a pattern (D2). Decal faces carry atlas UVs from
   o.cellOf(cell) → [u0, v0, u1, v1] (v up), or 0..1 plus part.decals for the caller to rewrite.
   Positions are (index − origin) × grid + layer.at: with binary-fraction grids every vertex is
   exact, so T-junction vertices land exactly on edges (GC 0.05 is the one non-binary grid).
   Deterministic: same model + options → byte-identical arrays (no Math.random anywhere).
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLVox = api;
}(typeof self !== 'undefined' ? self : this, function (root, NODE) {
  'use strict';

  /* lazy, feature-detected siblings: Node requires them only when a default is needed */
  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }

  var VERSION = 1;
  var GRIDS = Object.freeze({ G2: 0.5, G4: 0.25, G8: 0.125, G16: 0.0625, G32: 0.03125, GC: 0.05,
                              PATH: Object.freeze([0.125, 0.0625, 0.125]) });
  var MODES = Object.freeze({ block: 0, soft: 1, decal: 2, glow: 3, water: 4, plank: 5, cobble: 6, snow: 7, ice: 8, leaf: 9 });
  var MODE_NAMES = Object.freeze(Object.keys(MODES));
  var AO = Object.freeze([0.70, 0.80, 0.90, 1.0]);
  var GLOW = MODES.glow, DECAL = MODES.decal;
  var TIER_RANK = { LOW: 0, MID: 1, HIGH: 2 }, LOD_RANK = { mid: 1, high: 2 };
  var UNKNOWN_HEX = '#CFC8DC';          /* Pebble: what an unknown token renders as (as the kit) */
  var SIGN_WORDS_FALLBACK = ['ENCORE', 'SHOWTIME', 'ON AIR', 'PHOTO', 'DANCE', 'PET COURSE', 'ISLAND'];
  /* a = normal axis, s = sign, p / q = the mask axes, us / vs = the frame's u / v sign along p / q */
  function face(name, a, s, p, q, us, vs) {
    var n = [0, 0, 0]; n[a] = s;
    return Object.freeze({ name: name, a: a, s: s, p: p, q: q, us: us, vs: vs, n: Object.freeze(n) });
  }
  var FACES = Object.freeze([
    face('+x', 0, 1, 2, 1, -1, 1), face('-x', 0, -1, 2, 1, 1, 1),
    face('+y', 1, 1, 0, 2, 1, -1), face('-y', 1, -1, 0, 2, 1, 1),
    face('+z', 2, 1, 0, 1, 1, 1), face('-z', 2, -1, 0, 1, -1, 1)
  ]);
  var FACE_INDEX = {};
  FACES.forEach(function (f, i) { FACE_INDEX[f.name] = i; });
  var TRI = [0, 1, 2, 0, 2, 3], FLIP = [0, 1, 3, 1, 2, 3];
  var MIRROR_FACE = { '+x': '-x', '-x': '+x' }, ROT_FACE = { '+x': '-z', '-z': '-x', '-x': '+z', '+z': '+x' };
  var BACK_KINDS = { house: 1, building: 1, attraction: 1, landmark: 1, isleLandmark: 1 };
  var CHARACTER_KINDS = { pet: 1, acc: 1, avatar: 1, character: 1, critter: 1, fan: 1, npc: 1 };
  var EMPTY = new Uint8Array(0);

  /* ---------------- small helpers ---------------- */
  function note(list, msg) { if (list.indexOf(msg) < 0) list.push(msg); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function vec3(v, d) {
    if (typeof v === 'number') return [v, v, v];
    return Array.isArray(v) ? [num(v[0], d[0]), num(v[1], d[1]), num(v[2], d[2])] : d.slice();
  }
  function gridOf(g) {
    if (typeof g === 'number' && g > 0) return [g, g, g];
    if (Array.isArray(g) && g.length === 3 && g[0] > 0 && g[1] > 0 && g[2] > 0) return [+g[0], +g[1], +g[2]];
    return null;
  }
  function scaled(o, from, to) { return [o[0] * from[0] / to[0], o[1] * from[1] / to[1], o[2] * from[2] / to[2]]; }
  function mod2(v) { return ((v % 2) + 2) % 2; }
  /* a voxel value is one printable char (its code is the palette index); '.', ' ', null clear */
  function codeOf(c) {
    if (c == null || c === false) return 0;
    c = String(c);
    var n = c.length ? c.charCodeAt(0) : 0;
    return n <= 32 || n === 46 || n > 126 ? 0 : n;
  }
  function val(c, i, j, k) { return typeof c === 'function' ? c(i, j, k) : c; }
  function span(a, b) { a = Math.round(a); b = Math.round(b); return a <= b ? [a, b] : [b, a]; }
  function hexLinear(h) {
    var n = parseInt(h.slice(1), 16), out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    for (var i = 0; i < 3; i++) { var c = out[i] / 255; out[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return out;
  }
  function rgb3(v) {
    if (v && typeof v.r === 'number') return [v.r, v.g, v.b];
    if (v && typeof v.length === 'number' && v.length >= 3 && isFinite(v[0]) && isFinite(v[1]) && isFinite(v[2])) return [+v[0], +v[1], +v[2]];
    return null;
  }
  function lookHex(token) {
    var L = look();
    if (!L) return null;
    var K = sibling('SLKit', './kit.js');
    if (K && typeof K.resolveHex === 'function') return K.resolveHex(L, token);
    var h = L.PALETTE && L.PALETTE[token];
    return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? h : null;
  }
  function aoValid(t) { return Array.isArray(t) && t.length === 4 && t.every(function (x) { return typeof x === 'number' && x >= 0 && x <= 1; }); }
  function aoTable(model, o) {
    if (aoValid(model.ao)) return model.ao;
    if (aoValid(o.ao)) return o.ao;
    var L = look(), t = L && L.MATERIAL && L.MATERIAL.voxAo;
    return aoValid(t) ? t : AO;
  }
  function signWords() { var L = look(); return (L && Array.isArray(L.SIGN_WORDS) && L.SIGN_WORDS) || SIGN_WORDS_FALLBACK; }

  /* FNV-1a 32 (strings by char code, exactly SLGrid3D.hash / SLMotion.hash) */
  var FNV0 = 0x811c9dc5;
  function fnvStr(h, s) { for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function fnvBytes(h, u8) { for (var i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function fnvInt(h, v) { for (var b = 0; b < 4; b++) { h ^= (v >>> (b * 8)) & 255; h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function bytesOf(v) { return new Uint8Array(v.buffer, v.byteOffset, v.byteLength); }
  function hex8(h) { return ('0000000' + (h >>> 0).toString(16)).slice(-8); }
  /* stable text form for hashing and palette comparison (sorted keys; arrays by content) */
  function canon(v) {
    if (v == null) return 'null';
    if (typeof v === 'function') return '"fn"';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (ArrayBuffer.isView(v)) return '"bin:' + v.length + ':' + hex8(fnvBytes(FNV0, bytesOf(v))) + '"';
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }

  /* ================================================================
     GRID BUILDER — a growable dense grid: Uint8 char code + Uint8 pivot index per voxel, bounds
     tracked. Coordinates are integers (rounded); 0 is the pivot-centred voxel with the default
     origin. Colours are palette chars (or fn(i, j, k) → char; null / '.' clears).
     ================================================================ */
  function Grid(o) {
    o = o || {};
    this.grid = gridOf(o.grid) || [0.125, 0.125, 0.125];
    this.origin = vec3(o.origin, [0.5, 0, 0.5]);
    this.x0 = 0; this.y0 = 0; this.z0 = 0; this.nx = 0; this.ny = 0; this.nz = 0;
    this.c = EMPTY; this.p = EMPTY; this.count = 0;
    this.lo = [0, 0, 0]; this.hi = [-1, -1, -1]; this._stale = false;
    this.names = [null]; this.pivots = {}; this.anchors = {}; this.decals = []; this.issues = [];
    this._cur = 0;
  }
  Grid.prototype._at = function (i, j, k) {
    var x = i - this.x0, y = j - this.y0, z = k - this.z0;
    return x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz ? -1 : (y * this.nz + z) * this.nx + x;
  };
  /* grow to hold (i, j, k) with slack on every side (amortised O(1) per voxel) */
  Grid.prototype._fit = function (i, j, k) {
    if (this._at(i, j, k) >= 0) return;
    var has = this.nx > 0, lo = has ? [Math.min(i, this.x0), Math.min(j, this.y0), Math.min(k, this.z0)] : [i, j, k];
    var hi = has ? [Math.max(i, this.x0 + this.nx - 1), Math.max(j, this.y0 + this.ny - 1), Math.max(k, this.z0 + this.nz - 1)] : [i, j, k];
    for (var a = 0; a < 3; a++) { var pad = Math.max(4, (hi[a] - lo[a] + 1) >> 1); lo[a] -= pad; hi[a] += pad; }
    var nx = hi[0] - lo[0] + 1, ny = hi[1] - lo[1] + 1, nz = hi[2] - lo[2] + 1;
    var c = new Uint8Array(nx * ny * nz), p = new Uint8Array(nx * ny * nz);
    if (this.count) {
      for (var y = 0; y < this.ny; y++) for (var z = 0; z < this.nz; z++) {
        var src = (y * this.nz + z) * this.nx, dst = ((y + this.y0 - lo[1]) * nz + (z + this.z0 - lo[2])) * nx + (this.x0 - lo[0]);
        c.set(this.c.subarray(src, src + this.nx), dst); p.set(this.p.subarray(src, src + this.nx), dst);
      }
    }
    this.c = c; this.p = p; this.x0 = lo[0]; this.y0 = lo[1]; this.z0 = lo[2]; this.nx = nx; this.ny = ny; this.nz = nz;
  };
  Grid.prototype._put = function (i, j, k, code, piv) {
    var x;
    if (!code) {
      x = this._at(i, j, k);
      if (x >= 0 && this.c[x]) { this.c[x] = 0; this.p[x] = 0; this.count--; this._stale = true; }
      return;
    }
    this._fit(i, j, k);
    x = this._at(i, j, k);
    if (!this.c[x]) {
      if (++this.count === 1) { this.lo = [i, j, k]; this.hi = [i, j, k]; this._stale = false; }
      else this._grow(i, j, k);
    }
    this.c[x] = code; this.p[x] = piv;
  };
  Grid.prototype._grow = function (i, j, k) {
    var lo = this.lo, hi = this.hi;
    if (i < lo[0]) lo[0] = i; if (i > hi[0]) hi[0] = i;
    if (j < lo[1]) lo[1] = j; if (j > hi[1]) hi[1] = j;
    if (k < lo[2]) lo[2] = k; if (k > hi[2]) hi[2] = k;
  };
  Grid.prototype._each = function (fn) {
    for (var y = 0; y < this.ny; y++) for (var z = 0; z < this.nz; z++) for (var x = 0; x < this.nx; x++) {
      var s = (y * this.nz + z) * this.nx + x;
      if (this.c[s]) fn(x + this.x0, y + this.y0, z + this.z0, s);
    }
  };
  Grid.prototype._reset = function () {
    this.x0 = this.y0 = this.z0 = this.nx = this.ny = this.nz = this.count = 0;
    this.c = this.p = EMPTY; this.lo = [0, 0, 0]; this.hi = [-1, -1, -1]; this._stale = false;
  };
  Grid.prototype._pivotIdx = function (name) {
    if (!name || name === 'root') return 0;
    var i = this.names.indexOf(name);
    if (i >= 0) return i;
    if (this.names.length > 255) { note(this.issues, 'more than 255 pivots: "' + name + '" rides the root'); return 0; }
    this.names.push(name);
    return this.names.length - 1;
  };
  /* rebuild the voxels through fn(i, j, k, out) (keep: add the images, originals stay) */
  Grid.prototype._remap = function (fn, keep) {
    var n = this.count, I = new Int32Array(n), J = new Int32Array(n), K = new Int32Array(n), C = new Uint8Array(n), P = new Uint8Array(n), m = 0, self = this;
    this._each(function (i, j, k, s) { I[m] = i; J[m] = j; K[m] = k; C[m] = self.c[s]; P[m] = self.p[s]; m++; });
    if (!keep) this._reset();
    var t = [0, 0, 0];
    for (var e = 0; e < m; e++) {
      fn(I[e], J[e], K[e], t);
      if (keep && this.has(t[0], t[1], t[2])) continue;
      this._put(t[0], t[1], t[2], C[e], P[e]);
    }
  };
  /* move pivots and anchors by pt(v) and decals by vox(i, j, k, out) + a face map */
  Grid.prototype._xform = function (pt, vox, faceMap) {
    var self = this;
    Object.keys(this.pivots).forEach(function (n) { self.pivots[n].at = pt(self.pivots[n].at); });
    Object.keys(this.anchors).forEach(function (n) {
      var a = self.anchors[n];
      self.anchors[n] = Array.isArray(a) ? pt(a) : { at: pt(a.at), pivot: a.pivot };
    });
    this.decals = this.decals.map(function (d) {
      var F = FACES[FACE_INDEX[d.face]];
      if (!F) return d;
      var w = d.size[0], h = d.size[1], lo = d.at.slice(), hi = d.at.slice(), a = [0, 0, 0], b = [0, 0, 0];
      hi[F.p] += w - 1; hi[F.q] += h - 1;
      vox(lo[0], lo[1], lo[2], a); vox(hi[0], hi[1], hi[2], b);
      var out = Object.assign({}, d), G = FACES[FACE_INDEX[faceMap[d.face] || d.face]];
      out.face = G.name;
      out.at = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
      out.size = [Math.abs(a[G.p] - b[G.p]) + 1, Math.abs(a[G.q] - b[G.q]) + 1];
      return out;
    });
  };

  Grid.prototype.set = function (i, j, k, c) { this._put(Math.round(i), Math.round(j), Math.round(k), codeOf(c), this._cur); return this; };
  Grid.prototype.get = function (i, j, k) {
    var x = this._at(Math.round(i), Math.round(j), Math.round(k));
    return x >= 0 && this.c[x] ? String.fromCharCode(this.c[x]) : null;
  };
  Grid.prototype.has = function (i, j, k) { var x = this._at(Math.round(i), Math.round(j), Math.round(k)); return x >= 0 && this.c[x] > 0; };
  Grid.prototype.clear = function (i, j, k) { this._put(Math.round(i), Math.round(j), Math.round(k), 0, 0); return this; };
  Grid.prototype.box = function (i0, i1, j0, j1, k0, k1, c) {
    var a = span(i0, i1), b = span(j0, j1), d = span(k0, k1);
    for (var j = b[0]; j <= b[1]; j++) for (var k = d[0]; k <= d[1]; k++) for (var i = a[0]; i <= a[1]; i++) this.set(i, j, k, val(c, i, j, k));
    return this;
  };
  /* superellipsoid (power 2 = ellipsoid, 3 = the mockup's rounded heads, canopies and clouds) */
  Grid.prototype.blob = function (ci, cj, ck, ri, rj, rk, c, power) {
    var pw = power || 3;
    for (var j = Math.floor(cj - rj); j <= Math.ceil(cj + rj); j++) for (var k = Math.floor(ck - rk); k <= Math.ceil(ck + rk); k++) for (var i = Math.floor(ci - ri); i <= Math.ceil(ci + ri); i++) {
      if (Math.pow(Math.abs(i - ci) / ri, pw) + Math.pow(Math.abs(j - cj) / rj, pw) + Math.pow(Math.abs(k - ck) / rk, pw) <= 1) this.set(i, j, k, val(c, i, j, k));
    }
    return this;
  };
  Grid.prototype._round = function (ci, cj, ck, rOut, rIn, axis, c) {
    var ax = axis === 'x' ? 0 : axis === 'z' ? 2 : 1, ua = ax === 0 ? 2 : 0, va = ax === 1 ? 2 : 1, ctr = [ci, cj, ck], t = [0, 0, 0];
    var r2o = rOut * rOut + 1e-9, r2i = rIn > 0 ? rIn * rIn + 1e-9 : -1;
    t[ax] = Math.round(ctr[ax]);
    for (var v = Math.ceil(ctr[va] - rOut); v <= Math.floor(ctr[va] + rOut); v++) for (var u = Math.ceil(ctr[ua] - rOut); u <= Math.floor(ctr[ua] + rOut); u++) {
      var d2 = (u - ctr[ua]) * (u - ctr[ua]) + (v - ctr[va]) * (v - ctr[va]);
      if (d2 > r2o || d2 <= r2i) continue;
      t[ua] = u; t[va] = v;
      this.set(t[0], t[1], t[2], val(c, t[0], t[1], t[2]));
    }
    return this;
  };
  /* a one-voxel-thick filled circle across axis 'x' | 'y' (default) | 'z'; a centre may be .5 */
  Grid.prototype.disc = function (ci, cj, ck, r, axis, c) { return this._round(ci, cj, ck, r, -1, axis, c); };
  Grid.prototype.ring = function (ci, cj, ck, rOut, rIn, axis, c) { return this._round(ci, cj, ck, rOut, rIn, axis, c); };
  /* turned solids about the y axis through o.at [ci, ck] (default the pivot column):
     profile [[r | [rBottom, rTop], j0, j1, c], …]; segments 'round' (default) | 'oct' */
  Grid.prototype.lathe = function (profile, o) {
    o = o || {};
    var oct = o.segments === 'oct', cx = o.at ? num(o.at[0], 0) : 0, cz = o.at ? num(o.at[1], 0) : 0, self = this;
    (profile || []).forEach(function (e) {
      var js = span(e[1], e[2]), r = e[0];
      for (var j = js[0]; j <= js[1]; j++) {
        var f = js[1] > js[0] ? (j - js[0]) / (js[1] - js[0]) : 0, rj = Array.isArray(r) ? r[0] + (r[1] - r[0]) * f : r;
        for (var k = Math.ceil(cz - rj); k <= Math.floor(cz + rj); k++) for (var i = Math.ceil(cx - rj); i <= Math.floor(cx + rj); i++) {
          var dx = Math.abs(i - cx), dz = Math.abs(k - cz);
          var inside = oct ? Math.max(dx, dz) <= rj + 1e-9 && dx + dz <= rj * Math.SQRT2 + 1e-9 : dx * dx + dz * dz <= rj * rj + 1e-9;
          if (inside) self.set(i, j, k, val(e[3], i, j, k));
        }
      }
    });
    return this;
  };
  /* 3D DDA line a → b inclusive (ropes, zip lines, spokes, vines); thickness t gives a t³ brush */
  Grid.prototype.line = function (a, b, c, thickness) {
    var t = Math.max(1, Math.round(thickness || 1)), lo = -((t - 1) >> 1);
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))));
    for (var s = 0; s <= n; s++) {
      var x = Math.round(a[0] + dx * s / n), y = Math.round(a[1] + dy * s / n), z = Math.round(a[2] + dz * s / n);
      for (var oy = lo; oy < lo + t; oy++) for (var oz = lo; oz < lo + t; oz++) for (var ox = lo; ox < lo + t; ox++) this.set(x + ox, y + oy, z + oz, val(c, x + ox, y + oy, z + oz));
    }
    return this;
  };
  /* an extruded pixel sprite: rows top → bottom as seen from outside the +axis side ('z' default,
     'x', or 'y' from above); pal maps a bitmap char to a palette char (null: chars as they are);
     at = its bottom-left voxel (default centred on the pivot column); depth runs along +axis */
  Grid.prototype.bitmap = function (rows, pal, o) {
    o = o || {}; rows = rows || [];
    var H = rows.length, W = 0, axis = o.axis || 'z', depth = Math.max(1, Math.round(o.depth || 1));
    rows.forEach(function (r) { W = Math.max(W, String(r).length); });
    var at = o.at || (axis === 'x' ? [0, 0, W >> 1] : axis === 'y' ? [-(W >> 1), 0, H >> 1] : [-(W >> 1), 0, 0]);
    for (var r = 0; r < H; r++) {
      var row = String(rows[r]), up = H - 1 - r;
      for (var col = 0; col < row.length; col++) {
        var c = pal ? pal[row[col]] : row[col];
        if (!codeOf(c)) continue;
        for (var d = 0; d < depth; d++) {
          if (axis === 'x') this.set(at[0] + d, at[1] + up, at[2] - col, c);
          else if (axis === 'y') this.set(at[0] + col, at[1] + d, at[2] - up, c);
          else this.set(at[0] + col, at[1] + up, at[2] + d, c);
        }
      }
    }
    return this;
  };
  /* SIGN_WORDS only, in the PIX5 font (SLVoxGL.BITMAPS.PIX5) or o.font {char: [rows]}; o.c the char */
  Grid.prototype.text = function (word, o) {
    o = o || {};
    var w = String(word == null ? '' : word), up = w.toUpperCase();
    if (signWords().indexOf(up) < 0) { note(this.issues, '"' + w + '" is not a sign word (SIGN_WORDS only)'); return this; }
    var font = o.font && typeof o.font === 'object' ? o.font : null;
    if (!font) { var GL = sibling('SLVoxGL', './vox-gl.js'); font = GL && GL.BITMAPS && GL.BITMAPS.PIX5; }
    if (!font) { note(this.issues, 'text "' + w + '": the PIX5 font is not loaded (vox-gl.js)'); return this; }
    var rows = [], gap = o.gap == null ? 1 : Math.max(0, o.gap | 0), H = 0, glyphs = [];
    for (var n = 0; n < up.length; n++) {
      var g = font[up[n]] || font[w[n]];
      g = g && (Array.isArray(g) ? g : g.rows);
      glyphs.push(g || null);
      if (g) H = Math.max(H, g.length);
    }
    for (var r = 0; r < H; r++) rows.push('');
    glyphs.forEach(function (g, gi) {
      var gw = g ? g.reduce(function (m, s) { return Math.max(m, String(s).length); }, 0) : 3;
      for (var r2 = 0; r2 < H; r2++) {
        var s = g ? String(g[r2 - (H - g.length)] || '') : '', px = '';
        for (var x = 0; x < gw; x++) px += s[x] && ' .0'.indexOf(s[x]) < 0 ? '#' : '.';
        rows[r2] += px + (gi < glyphs.length - 1 ? new Array(gap + 1).join('.') : '');
      }
    });
    return this.bitmap(rows, { '#': o.c }, { axis: o.axis, at: o.at, depth: o.depth });
  };
  /* the front-most (+z) voxel of column (i, j) · recolour it (its pivot is kept) */
  Grid.prototype.front = function (i, j) {
    i = Math.round(i); j = Math.round(j);
    for (var k = this.z0 + this.nz - 1; k >= this.z0; k--) if (this.has(i, j, k)) return k;
    return null;
  };
  Grid.prototype.paint = function (i, j, c) {
    var k = this.front(i, j), code = codeOf(c);
    if (k !== null && code) this.c[this._at(Math.round(i), Math.round(j), k)] = code;
    return this;
  };
  /* flip across item x = 0 (keep: add the mirror image where empty, for symmetric authoring) */
  Grid.prototype.mirrorX = function (keep) {
    var m = 2 * this.origin[0] - 1, mi = Math.round(m);
    if (mi !== m) note(this.issues, 'mirrorX: origin x ' + this.origin[0] + ' is not on a half voxel (rounded)');
    this._remap(function (i, j, k, t) { t[0] = mi - i; t[1] = j; t[2] = k; }, !!keep);
    if (!keep) this._xform(function (v) { return [m - v[0], v[1], v[2]]; }, function (i, j, k, t) { t[0] = mi - i; t[1] = j; t[2] = k; }, MIRROR_FACE);
    return this;
  };
  /* n quarter turns about +y through item (0, 0, 0) (three's rotation.y: +x → −z) */
  Grid.prototype.rotY90 = function (n) {
    n = ((Math.round(n == null ? 1 : n) % 4) + 4) % 4;
    var d1 = this.origin[0] - this.origin[2], d2 = this.origin[0] + this.origin[2] - 1, r1 = Math.round(d1), r2 = Math.round(d2);
    if (r1 !== d1 || r2 !== d2) note(this.issues, 'rotY90: origin x / z do not share a half-voxel phase (rounded)');
    function vox(i, j, k, t) { t[0] = k + r1; t[1] = j; t[2] = r2 - i; }
    for (var s = 0; s < n; s++) {
      this._remap(vox);
      this._xform(function (v) { return [v[2] + d1, v[1], d2 - v[0]]; }, vox, ROT_FACE);
    }
    return this;
  };
  Grid.prototype.translate = function (di, dj, dk) {
    var d = [Math.round(di || 0), Math.round(dj || 0), Math.round(dk || 0)];
    this.x0 += d[0]; this.y0 += d[1]; this.z0 += d[2];
    for (var a = 0; a < 3; a++) { this.lo[a] += d[a]; this.hi[a] += d[a]; }
    this._xform(function (v) { return [v[0] + d[0], v[1] + d[1], v[2] + d[2]]; },
                function (i, j, k, t) { t[0] = i + d[0]; t[1] = j + d[1]; t[2] = k + d[2]; }, {});
    return this;
  };
  /* copy another grid in at a voxel offset (its pivots, anchors and decals too; names kept) */
  Grid.prototype.merge = function (other, at) {
    if (!(other instanceof Grid)) return this;
    var d = vec3(at, [0, 0, 0]).map(Math.round), self = this, map = other.names.map(function (n) { return self._pivotIdx(n); });
    other._each(function (i, j, k, s) { self._put(i + d[0], j + d[1], k + d[2], other.c[s], map[other.p[s]] || 0); });
    function mv(v) { return [v[0] + d[0], v[1] + d[1], v[2] + d[2]]; }
    Object.keys(other.pivots).forEach(function (n) {
      if (self.pivots[n]) { note(self.issues, 'merge: pivot "' + n + '" already exists (kept)'); return; }
      self.pivots[n] = { at: mv(other.pivots[n].at), parent: other.pivots[n].parent };
    });
    Object.keys(other.anchors).forEach(function (n) {
      var a = other.anchors[n];
      if (!self.anchors[n]) self.anchors[n] = Array.isArray(a) ? mv(a) : { at: mv(a.at), pivot: a.pivot };
    });
    other.decals.forEach(function (dc) { var c2 = Object.assign({}, dc); c2.at = mv(dc.at); self.decals.push(c2); });
    return this;
  };
  /* every voxel set inside fn rides that pivot */
  Grid.prototype.group = function (name, fn) {
    var prev = this._cur;
    this._cur = this._pivotIdx(name);
    try { fn(this); } finally { this._cur = prev; }
    return this;
  };
  Grid.prototype.pivot = function (name, at, parent) {
    if (!name || name === 'root') { note(this.issues, 'pivot name "root" is reserved'); return this; }
    this.pivots[name] = { at: vec3(at, [0, 0, 0]), parent: parent && parent !== 'root' ? parent : null };
    this._pivotIdx(name);
    return this;
  };
  Grid.prototype.anchor = function (name, at, pivot) {
    this.anchors[name] = pivot ? { at: vec3(at, [0, 0, 0]), pivot: pivot } : vec3(at, [0, 0, 0]);
    return this;
  };
  /* decal({face, at, size, cell, pivot?, copy?}) or decal(face, at, size, cell, {pivot, copy}) */
  Grid.prototype.decal = function (f, at, size, cell, extra) {
    var d = f && typeof f === 'object' ? Object.assign({}, f) : Object.assign({ face: f, at: at, size: size, cell: cell }, extra || {});
    if (FACE_INDEX[d.face] == null) { note(this.issues, 'decal face "' + d.face + '" unknown'); return this; }
    d.at = vec3(d.at, [0, 0, 0]).map(Math.round);
    d.size = [Math.max(1, Math.round(num(d.size && d.size[0], 1))), Math.max(1, Math.round(num(d.size && d.size[1], 1)))];
    this.decals.push(d);
    return this;
  };
  /* deterministic 2-tone dither: each voxel of c becomes c2 with probability p (FNV of seed, i, j, k) */
  Grid.prototype.hashTone = function (c, c2, p, seed) {
    var a = codeOf(c), b = codeOf(c2), s = typeof seed === 'number' ? seed >>> 0 : fnvStr(FNV0, String(seed == null ? '' : seed)), self = this;
    if (!a || !b) return this;
    this._each(function (i, j, k, x) {
      if (self.c[x] === a && fnvInt(fnvInt(fnvInt(fnvInt(FNV0, s), i), j), k) / 4294967296 < p) self.c[x] = b;
    });
    return this;
  };
  Grid.prototype.bounds = function () {
    if (!this.count) return null;
    if (this._stale) {
      var self = this;
      this.lo = [Infinity, Infinity, Infinity]; this.hi = [-Infinity, -Infinity, -Infinity];
      this._each(function (i, j, k) { self._grow(i, j, k); });
      this._stale = false;
    }
    return { lo: this.lo.slice(), hi: this.hi.slice() };
  };
  /* trimmed, plain-data copy of the voxels (what a layer's 'vox' holds) */
  Grid.prototype.snapshot = function () {
    var b = this.bounds(), out = { grid: this.grid.slice(), origin: this.origin.slice(), min: [0, 0, 0], dims: [0, 0, 0], c: EMPTY, p: EMPTY, names: this.names.slice() };
    if (!b) return out;
    var w = b.hi[0] - b.lo[0] + 1, h = b.hi[1] - b.lo[1] + 1, d = b.hi[2] - b.lo[2] + 1;
    out.min = b.lo; out.dims = [w, h, d]; out.c = new Uint8Array(w * h * d); out.p = new Uint8Array(w * h * d);
    for (var y = 0; y < h; y++) for (var z = 0; z < d; z++) {
      var src = this._at(b.lo[0], b.lo[1] + y, b.lo[2] + z), dst = (y * d + z) * w;
      out.c.set(this.c.subarray(src, src + w), dst); out.p.set(this.p.subarray(src, src + w), dst);
    }
    return out;
  };
  Grid.prototype.model = function (meta) {
    meta = meta || {};
    var m = {}, self = this, g = this.grid;
    Object.keys(meta).forEach(function (k) { m[k] = meta[k]; });
    m.id = meta.id || 'model';
    m.grid = g[0] === g[1] && g[1] === g[2] ? g[0] : g.slice();
    m.origin = this.origin.slice();
    m.palette = meta.palette || {};
    m.layers = [{ vox: this.snapshot() }];
    m.pivots = {};
    Object.keys(this.pivots).forEach(function (n) { m.pivots[n] = { at: self.pivots[n].at.slice(), parent: self.pivots[n].parent }; });
    Object.keys(meta.pivots || {}).forEach(function (n) { m.pivots[n] = meta.pivots[n]; });
    m.anchors = {};
    Object.keys(this.anchors).forEach(function (n) {
      var a = self.anchors[n];
      m.anchors[n] = Array.isArray(a) ? a.slice() : { at: a.at.slice(), pivot: a.pivot };
    });
    Object.keys(meta.anchors || {}).forEach(function (n) { m.anchors[n] = meta.anchors[n]; });
    m.decals = this.decals.concat(meta.decals || []);
    var iss = this.issues.concat(meta.issues || []);
    if (iss.length) m.issues = iss;
    return m;
  };
  function fromSnap(snap, grid, origin) {
    var g = new Grid({ grid: grid, origin: origin }), W = snap.dims[0], H = snap.dims[1], D = snap.dims[2];
    g.names = (snap.names || [null]).slice();
    for (var y = 0; y < H; y++) for (var z = 0; z < D; z++) for (var x = 0; x < W; x++) {
      var s = (y * D + z) * W + x;
      if (snap.c[s]) g._put(x + snap.min[0], y + snap.min[1], z + snap.min[2], snap.c[s], snap.p[s]);
    }
    return g;
  }
  function sliceSnap(slices) {
    var H = slices.length, D = 0, W = 0, j, k;
    for (j = 0; j < H; j++) {
      var rows = slices[j] || [];
      D = Math.max(D, rows.length);
      for (k = 0; k < rows.length; k++) W = Math.max(W, String(rows[k]).length);
    }
    var c = new Uint8Array(W * H * D);
    for (j = 0; j < H; j++) for (k = 0; k < (slices[j] || []).length; k++) {
      var row = String(slices[j][k]);
      for (var i = 0; i < row.length; i++) c[(j * D + k) * W + i] = codeOf(row[i]);
    }
    return { min: [0, 0, 0], dims: [W, H, D], c: c, p: new Uint8Array(W * H * D), names: [null] };
  }

  /* ================================================================
     EVALUATION — every layer becomes a dense snapshot in its own grid and frame
     ================================================================ */
  function evaluate(model, issues) {
    model = model || {};
    var rootGrid = gridOf(model.grid), rootOrigin = Array.isArray(model.origin) ? vec3(model.origin, [0, 0, 0]) : null, out = [];
    (Array.isArray(model.layers) ? model.layers : []).forEach(function (ly, li) {
      ly = ly || {};
      var vox = ly.vox instanceof Grid ? ly.vox.snapshot() : ly.vox, snap = null;
      var g = gridOf(ly.grid) || (vox && gridOf(vox.grid)) || rootGrid;
      if (!g) { note(issues, (model.id || 'model') + ': no grid (G8 used)'); g = [0.125, 0.125, 0.125]; }
      if (!rootGrid) rootGrid = g;
      var origin = Array.isArray(ly.origin) ? vec3(ly.origin, [0, 0, 0]) : vox && Array.isArray(vox.origin) ? vox.origin.slice() : rootOrigin ? scaled(rootOrigin, rootGrid, g) : null;
      if (vox && vox.c && vox.dims) snap = vox;
      else if (Array.isArray(ly.slices)) snap = sliceSnap(ly.slices);
      else if (typeof ly.build === 'function') {
        var gb = new Grid({ grid: g, origin: origin || [0.5, 0, 0.5] }), r = ly.build(gb);
        if (r instanceof Grid) gb = r;
        if (!origin) origin = gb.origin.slice();
        gb.issues.forEach(function (m) { note(issues, m); });
        snap = gb.snapshot();
      } else { note(issues, (model.id || 'model') + ': layer ' + li + ' has no slices, build or vox'); return; }
      if (!origin) origin = [snap.min[0] + snap.dims[0] / 2, 0, snap.min[2] + snap.dims[2] / 2];
      if (!rootOrigin) rootOrigin = scaled(origin, g, rootGrid);
      if (ly.mirror === 'x') { var gm = fromSnap(snap, g, origin); gm.mirrorX(true); snap = gm.snapshot(); }
      else if (ly.mirror) note(issues, (model.id || 'model') + ': mirror "' + ly.mirror + '" is not supported');
      var at = vec3(ly.at, [0, 0, 0]), groundOpt = ly.ground != null ? !!ly.ground : model.ground !== false;
      var jg = origin[1] - at[1] / g[1], aligned = Math.abs(jg - Math.round(jg)) < 1e-6;
      out.push({ grid: g, origin: origin, at: at, min: snap.min.slice(), dims: snap.dims.slice(), c: snap.c, p: snap.p,
                 names: (snap.names || [null]).slice(), groundOpt: groundOpt, jGround: groundOpt && aligned ? Math.round(jg) : null });
    });
    return { layers: out, grid: rootGrid || [0.125, 0.125, 0.125], origin: rootOrigin || [0, 0, 0] };
  }
  /* per palette char: token, mode, part class, colour, pivot, tier gate, decal cell */
  function paletteMeta(model, pivotOf, issues, colorOf, tierRank) {
    var id = model.id || 'model', meta = new Array(128), classes = [{ kind: 'body', key: 'body', name: 'body' }], byKey = { body: 0 }, colours = {};
    function cls(key, make) { if (byKey[key] == null) { byKey[key] = classes.length; classes.push(make()); } return byKey[key]; }
    function classFor(copy, sc, member) {
      if (!copy && !sc) return 0;
      var cn = copy ? (copy === true ? '0' : String(copy)) : null, key = (cn != null ? 'copy:' + cn : '') + (sc ? '|state:' + canon(sc) : '');
      return cls(key, function () {
        return { kind: cn != null ? 'copy' : 'state', key: key, name: cn != null ? 'copy_' + cn : 'state_' + sc.key, perCopy: cn != null, stateColor: sc, member: !!member };
      });
    }
    function rgbOf(token) {
      if (colours[token]) return colours[token];
      var v = null;
      if (/^#/.test(token)) note(issues, id + ': raw hex "' + token + '" refused (palette tokens only)');
      else if (colorOf) { try { v = rgb3(colorOf(token)); } catch (e) { v = null; } }
      else { var h = lookHex(token); v = h ? hexLinear(h) : null; }
      if (!v) { if (!/^#/.test(token)) note(issues, id + ': unknown colour token "' + token + '" (rendered as Pebble)'); v = hexLinear(UNKNOWN_HEX); }
      return (colours[token] = v);
    }
    var pal = model.palette || {};
    Object.keys(pal).forEach(function (ch) {
      var code = ch.length === 1 ? codeOf(ch) : 0;
      if (!code) { note(issues, id + ': palette key "' + ch + '" is not one printable character'); return; }
      var e = pal[ch], ent = typeof e === 'string' ? { token: e } : e && typeof e === 'object' ? e : null;
      if (!ent || typeof ent.token !== 'string' || !ent.token) { note(issues, id + ': palette "' + ch + '" has no token'); return; }
      var mode = ent.mode == null ? 0 : MODES[ent.mode], cell = null, sc = null;
      if (mode == null) { note(issues, id + ': palette "' + ch + '" mode "' + ent.mode + '" unknown (block)'); mode = 0; }
      if (mode === DECAL) {
        if (typeof ent.cell === 'string' && ent.cell) cell = ent.cell;
        else { note(issues, id + ': palette "' + ch + '" is a decal without a cell (block)'); mode = 0; }
      }
      if (ent.member) sc = { key: 'member', off: ent.token, on: ent.token };
      else if (ent.state && typeof ent.state === 'object') { sc = Object.assign({}, ent.state); sc.key = String(sc.key || 'state'); }
      meta[code] = { code: code, token: ent.token, mode: mode, cell: cell, grey: !!sc, cls: classFor(ent.copy, sc, ent.member),
                     pivot: ent.pivot ? pivotOf(ent.pivot, 'palette "' + ch + '"') : 0, drop: (LOD_RANK[ent.lod] || 0) > tierRank, rgb: rgbOf(ent.token) };
    });
    (model.decals || []).forEach(function (d) { if (d && d.copy) classFor(d.copy, null, false); });
    return { meta: meta, classes: classes, copyClass: function (c) { return classFor(c, null, false); } };
  }

  /* ================================================================
     MESHER
     ================================================================ */
  /* a part's vertex store; its growable scratch arrays come from (and go back to) a small pool, so
     a mesh() allocates only its exact output arrays once warm */
  var POOL = [], POOL_MAX = 16, POOL_VERTS = 65536;
  function Part(pivot, cls) {
    var b = POOL.pop();
    this.pivot = pivot; this.cls = cls; this.n = 0; this.quads = 0; this.faces = 0; this.glowOnly = true; this.decals = [];
    this.cap = b ? b.cap : 0;
    this.pos = b ? b.pos : EMPTY; this.nor = b ? b.nor : EMPTY; this.col = b ? b.col : EMPTY; this.vuv = b ? b.vuv : EMPTY;
  }
  Part.prototype.room = function (verts) {
    if (this.n + verts <= this.cap) return;
    var cap = Math.max(this.n + verts, this.cap * 2, 384), k3 = this.n * 3;
    function grow(a) { var b = new Float32Array(cap * 3); b.set(a.subarray(0, k3)); return b; }
    this.pos = grow(this.pos); this.nor = grow(this.nor); this.col = grow(this.col); this.vuv = grow(this.vuv);
    this.cap = cap;
  };
  Part.prototype.release = function () {
    if (this.cap && this.cap <= POOL_VERTS && POOL.length < POOL_MAX) POOL.push({ cap: this.cap, pos: this.pos, nor: this.nor, col: this.col, vuv: this.vuv });
    this.pos = this.nor = this.col = this.vuv = EMPTY; this.cap = 0;
  };

  function mesh(model, o) {
    o = o || {};
    model = model || {};
    if (o.lod) model = lod(model, o.lod, o);
    var issues = [], E = evaluate(model, issues), id = model.id || 'model';
    (model.issues || []).forEach(function (m) { note(issues, m); });
    var tierRank = TIER_RANK[String(o.tier || 'HIGH').toUpperCase()];
    if (tierRank == null) tierRank = 2;
    /* pivots: 0 is the root, then the model's declaration order */
    var pivNames = [null], pivIdx = {}, decl = model.pivots || {};
    Object.keys(decl).forEach(function (n) {
      if (!n || n === 'root') { note(issues, id + ': pivot name "root" is reserved'); return; }
      if (pivNames.length > 254) { note(issues, id + ': more than 254 pivots ("' + n + '" rides the root)'); return; }
      pivIdx[n] = pivNames.length; pivNames.push(n);
    });
    function pivotOf(name, where) {
      if (!name || name === 'root') return 0;
      if (pivIdx[name] != null) return pivIdx[name];
      note(issues, id + ': ' + where + ' uses unknown pivot "' + name + '" (root used)');
      return 0;
    }
    var P = paletteMeta(model, pivotOf, issues, typeof o.colorOf === 'function' ? o.colorOf : null, tierRank);
    var cull = {};
    if (!o.full) (Array.isArray(model.cull) ? model.cull : Array.isArray(o.cull) ? o.cull : []).forEach(function (f) { cull[f] = 1; });
    var table = model.ao !== false && o.ao !== false ? aoTable(model, o) : null, merge = o.greedy !== false;
    var NC = P.classes.length, partAt = new Int16Array(256 * NC).fill(-1), parts = [];
    function partOf(piv, c) {
      var key = piv * NC + c, n = partAt[key];
      if (n < 0) {
        if (parts.length >= 255) throw new Error('SLVox: ' + id + ' needs more than 255 parts');
        n = partAt[key] = parts.length; parts.push(new Part(piv, c));
      }
      return n;
    }
    var uvCache = {};
    function cellUV(cell) {
      if (uvCache[cell]) return uvCache[cell];
      var r = typeof o.cellOf === 'function' ? o.cellOf(cell) : null;
      return (uvCache[cell] = r && r.length === 4 && isFinite(r[0]) && isFinite(r[3]) ? [+r[0], +r[1], +r[2], +r[3]] : [0, 0, 1, 1]);
    }
    var byLayer = [];
    (model.decals || []).forEach(function (d) {
      if (!d || FACE_INDEX[d.face] == null) { note(issues, id + ': decal face "' + (d && d.face) + '" unknown'); return; }
      var li = d.layer | 0;
      (byLayer[li] = byLayer[li] || []).push(d);
    });
    var nvox = 0, nfaces = 0, bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
    var V3 = new Float64Array(3), CX = new Float64Array(12), AOV = new Float64Array(4), UV = new Float64Array(8);

    E.layers.forEach(function (L, li) {
      var W = L.dims[0], H = L.dims[1], D = L.dims[2];
      if (!(W > 0 && H > 0 && D > 0)) return;
      var PX = W + 2, PZ = D + 2, N = PX * (H + 2) * PZ, STR = [1, PX * PZ, PX];
      var occ = new Uint8Array(N), chr = new Uint8Array(N), lo = [W, H, D], hi = [-1, -1, -1];
      var pmap = L.names.map(function (n, i) { return i ? pivotOf(n, 'a voxel group') : 0; });
      for (var y = 0; y < H; y++) for (var z = 0; z < D; z++) {
        var s = (y * D + z) * W, d = ((y + 1) * PZ + z + 1) * PX + 1;
        for (var x = 0; x < W; x++, s++, d++) {
          var code = L.c[s];
          if (!code) continue;
          var pm = P.meta[code];
          if (!pm) { note(issues, id + ': "' + String.fromCharCode(code) + '" is not in the palette'); continue; }
          if (pm.drop) continue;
          var pv = (L.p[s] && pmap[L.p[s]]) || pm.pivot;
          occ[d] = pv + 1; chr[d] = code; nvox++;
          if (x < lo[0]) lo[0] = x; if (y < lo[1]) lo[1] = y; if (z < lo[2]) lo[2] = z;
          if (x > hi[0]) hi[0] = x; if (y > hi[1]) hi[1] = y; if (z > hi[2]) hi[2] = z;
        }
      }
      if (hi[0] < 0) return;
      for (var a = 0; a < 3; a++) {
        var e0 = (L.min[a] + lo[a] - L.origin[a]) * L.grid[a] + L.at[a], e1 = (L.min[a] + hi[a] + 1 - L.origin[a]) * L.grid[a] + L.at[a];
        if (e0 < bmin[a]) bmin[a] = e0; if (e1 > bmax[a]) bmax[a] = e1;
      }
      var gy = L.jGround != null ? L.jGround - L.min[1] + 1 : -1e9;

      /* visible: own voxel against its neighbour (different pivot shows; the ground hides) */
      function shows(ix, py, F) {
        var own = occ[ix];
        if (!own) return false;
        var n = occ[ix + F.s * STR[F.a]];
        return n !== own && (n > 0 || py + (F.a === 1 ? F.s : 0) >= gy);
      }
      function solid(ix, y, own) { return occ[ix] === own || y < gy ? 1 : 0; }
      function lvl(s1, s2, c) { return s1 && s2 ? 0 : 3 - s1 - s2 - c; }
      /* 4-corner AO levels in mask order: (p−, q−) | (p+, q−) << 2 | (p+, q+) << 4 | (p−, q+) << 6 */
      function sig(ix, py, F) {
        var own = occ[ix], out = ix + F.s * STR[F.a], oy = py + (F.a === 1 ? F.s : 0), SP = STR[F.p], SQ = STR[F.q];
        var dp = F.p === 1 ? 1 : 0, dq = F.q === 1 ? 1 : 0;
        var pm = solid(out - SP, oy - dp, own), pp = solid(out + SP, oy + dp, own), qm = solid(out - SQ, oy - dq, own), qp = solid(out + SQ, oy + dq, own);
        return lvl(pm, qm, solid(out - SP - SQ, oy - dp - dq, own)) | lvl(pp, qm, solid(out + SP - SQ, oy + dp - dq, own)) << 2 |
               lvl(pp, qp, solid(out + SP + SQ, oy + dp + dq, own)) << 4 | lvl(pm, qp, solid(out - SP + SQ, oy - dp + dq, own)) << 6;
      }
      function quad(part, F, t, p0, q0, w, h, pm, sg, mode, uvr) {
        var g = L.grid, org = L.origin, at = L.at, glow = pm.mode === GLOW;
        var plane = L.min[F.a] + t + (F.s > 0 ? 1 : 0), pl = L.min[F.p] + p0, ql = L.min[F.q] + q0;
        for (var n = 0; n < 4; n++) {
          var cu = n === 1 || n === 2 ? 1 : 0, cv = n > 1 ? 1 : 0, pp = F.us > 0 ? cu : 1 - cu, qq = F.vs > 0 ? cv : 1 - cv;
          var cP = pl + pp * w, cQ = ql + qq * h;
          AOV[n] = table && !glow ? table[sg >> (pp ? (qq ? 4 : 2) : (qq ? 6 : 0)) & 3] : 1;
          V3[F.a] = plane; V3[F.p] = cP; V3[F.q] = cQ;
          CX[n * 3] = (V3[0] - org[0]) * g[0] + at[0];
          CX[n * 3 + 1] = (V3[1] - org[1]) * g[1] + at[1];
          CX[n * 3 + 2] = (V3[2] - org[2]) * g[2] + at[2];
          if (uvr) { UV[n * 2] = uvr[0] + cu * (uvr[2] - uvr[0]); UV[n * 2 + 1] = uvr[1] + cv * (uvr[3] - uvr[1]); }
          else { UV[n * 2] = F.us * cP; UV[n * 2 + 1] = F.vs * cQ; }
        }
        var ord = AOV[0] + AOV[2] < AOV[1] + AOV[3] ? FLIP : TRI, rgb = pm.rgb, grey = pm.grey, nx = F.n[0], ny = F.n[1], nz = F.n[2];
        part.room(6);
        var pos = part.pos, nor = part.nor, col = part.col, vuv = part.vuv, k3 = part.n * 3;
        for (var e = 0; e < 6; e++, k3 += 3) {
          var v = ord[e], ao = AOV[v];
          pos[k3] = CX[v * 3]; pos[k3 + 1] = CX[v * 3 + 1]; pos[k3 + 2] = CX[v * 3 + 2];
          nor[k3] = nx; nor[k3 + 1] = ny; nor[k3 + 2] = nz;
          if (grey) { col[k3] = ao; col[k3 + 1] = ao; col[k3 + 2] = ao; }
          else { col[k3] = rgb[0] * ao; col[k3 + 1] = rgb[1] * ao; col[k3 + 2] = rgb[2] * ao; }
          vuv[k3] = UV[v * 2]; vuv[k3 + 1] = UV[v * 2 + 1]; vuv[k3 + 2] = mode;
        }
        part.n += 6;
        part.quads++;
        if (!glow) part.glowOnly = false;
      }
      function decalQuad(part, F, t, p0, q0, w, h, pm, sg, cell, faces) {
        part.decals.push({ cell: cell, first: part.n, count: 6 });
        quad(part, F, t, p0, q0, w, h, pm, sg, DECAL, cellUV(cell));
        part.faces += faces; nfaces += faces;
      }

      /* decal rects: mark the faces they replace */
      var dcov = null, rects = [];
      (byLayer[li] || []).forEach(function (dc) {
        var f = FACE_INDEX[dc.face], F = FACES[f];
        if (cull[F.name]) return;
        var at3 = vec3(dc.at, [0, 0, 0]).map(Math.round), w = Math.max(1, Math.round(num(dc.size && dc.size[0], 1))), h = Math.max(1, Math.round(num(dc.size && dc.size[1], 1)));
        var r = { dc: dc, F: F, t: at3[F.a] - L.min[F.a], p0: at3[F.p] - L.min[F.p], q0: at3[F.q] - L.min[F.q], w: w, h: h };
        if (!dcov) dcov = new Uint8Array(N);
        for (var qq = 0; qq < h; qq++) for (var pp = 0; pp < w; pp++) {
          var ix = cellIx(r, pp, qq);
          if (ix >= 0) dcov[ix] |= 1 << f;
        }
        rects.push(r);
      });
      function cellIx(r, pp, qq) {
        var t = r.t, p = r.p0 + pp, q = r.q0 + qq, F = r.F;
        if (t < 0 || p < 0 || q < 0 || t >= L.dims[F.a] || p >= L.dims[F.p] || q >= L.dims[F.q]) return -1;
        return (t + 1) * STR[F.a] + (p + 1) * STR[F.p] + (q + 1) * STR[F.q];
      }
      function pyOf(F, t, p, q) { return F.a === 1 ? t + 1 : F.p === 1 ? p + 1 : q + 1; }

      /* per direction and slice: build the face mask, then greedy-merge it */
      var mask = new Int32Array(Math.max(W * H, W * D, H * D));
      for (var f = 0; f < 6; f++) {
        var F = FACES[f];
        if (cull[F.name]) continue;
        var dA = L.dims[F.a], dP = L.dims[F.p], dQ = L.dims[F.q], bit = 1 << f, SP = STR[F.p], SQ = STR[F.q];
        var nOff = F.s * STR[F.a], yA = F.a === 1, yP = F.p === 1, dyN = yA ? F.s : 0;
        for (var t = 0; t < dA; t++) {
          var any = false, base = (t + 1) * STR[F.a] + SP + SQ;
          for (var q = 0; q < dQ; q++) {
            var ix = base + q * SQ, m = q * dP;
            for (var p = 0; p < dP; p++, ix += SP, m++) {
              mask[m] = 0;
              var own = occ[ix];
              if (!own) continue;
              var nb = occ[ix + nOff];
              if (nb === own) continue;
              var py = yA ? t + 1 : yP ? p + 1 : q + 1;
              if ((!nb && py + dyN < gy) || (dcov !== null && dcov[ix] & bit)) continue;
              var code = chr[ix], pm2 = P.meta[code], part = partOf(own - 1, pm2.cls), sg = table && pm2.mode !== GLOW ? sig(ix, py, F) : 255;
              if (pm2.cell) { decalQuad(parts[part], F, t, p, q, 1, 1, pm2, sg, pm2.cell, 1); continue; }
              parts[part].faces++; nfaces++;
              mask[m] = 1 + (code | pm2.mode << 7 | sg << 11 | part << 19);
              any = true;
            }
          }
          if (any) greedy(F, t, dP, dQ);
        }
      }
      function greedy(F, t, dP, dQ) {
        for (var q = 0; q < dQ; q++) {
          for (var p = 0; p < dP;) {
            var k0 = mask[q * dP + p];
            if (!k0) { p++; continue; }
            var key = k0 - 1, sg = key >>> 11 & 255, l00 = sg & 3, l10 = sg >> 2 & 3, l11 = sg >> 4 & 3, l01 = sg >> 6 & 3, w = 1, h = 1, e;
            if (merge && l00 === l10 && l01 === l11) while (p + w < dP && mask[q * dP + p + w] === k0) w++;
            if (merge && l00 === l01 && l10 === l11) {
              rows: for (; q + h < dQ; h++) for (e = 0; e < w; e++) if (mask[(q + h) * dP + p + e] !== k0) break rows;
            }
            for (var hh = 0; hh < h; hh++) for (e = 0; e < w; e++) mask[(q + hh) * dP + p + e] = 0;
            var pm = P.meta[key & 127];
            quad(parts[key >>> 19 & 255], F, t, p, q, w, h, pm, sg, pm.mode, null);
            p += w;
          }
        }
      }
      /* one atlas quad per decal over its rect; its colour is the voxel's underneath */
      rects.forEach(function (r) {
        var F = r.F, dc = r.dc, exposed = 0, base = -1;
        for (var qq = 0; qq < r.h; qq++) for (var pp = 0; pp < r.w; pp++) {
          var ix = cellIx(r, pp, qq);
          if (ix >= 0 && shows(ix, pyOf(F, r.t, r.p0 + pp, r.q0 + qq), F)) { exposed++; if (base < 0) base = ix; }
        }
        if (!exposed) { note(issues, id + ': decal "' + dc.cell + '" covers no visible ' + F.name + ' face'); return; }
        if (exposed < r.w * r.h) note(issues, id + ': decal "' + dc.cell + '" is partly over hidden or empty voxels');
        var at0 = cellIx(r, 0, 0);
        if (at0 >= 0 && occ[at0]) base = at0;
        var pm = P.meta[chr[base]], piv = dc.pivot ? pivotOf(dc.pivot, 'decal "' + dc.cell + '"') : occ[base] - 1;
        var part = parts[partOf(piv, dc.copy ? P.copyClass(dc.copy) : pm.cls)];
        var corner = [[0, 0, 3], [r.w - 1, 0, 12], [r.w - 1, r.h - 1, 48], [0, r.h - 1, 192]], sg = 0;
        corner.forEach(function (c) {
          var ix = cellIx(r, c[0], c[1]), py = pyOf(F, r.t, r.p0 + c[0], r.q0 + c[1]);
          sg |= (table && ix >= 0 && shows(ix, py, F) && P.meta[chr[ix]].mode !== GLOW ? sig(ix, py, F) : 255) & c[2];
        });
        decalQuad(part, F, r.t, r.p0, r.q0, r.w, r.h, pm, sg, String(dc.cell), exposed);
      });
    });

    /* parts in a stable order: root first, then pivots as declared; body, then classes as met */
    var order = parts.map(function (p, i) { return i; }).sort(function (a, b) { return parts[a].pivot - parts[b].pivot || parts[a].cls - parts[b].cls || a - b; });
    var used = {}, outParts = order.map(function (i) {
      var pt = parts[i], c = P.classes[pt.cls], pv = pivNames[pt.pivot], name = c.kind === 'body' ? (pv || 'body') : (pv ? pv + '_' : '') + c.name, k3 = pt.n * 3;
      if (used[name]) { var n2 = 2; while (used[name + '_' + n2]) n2++; name = name + '_' + n2; }
      used[name] = 1;
      var arrays = { position: pt.pos.slice(0, k3), normal: pt.nor.slice(0, k3), color: pt.col.slice(0, k3), vuv: pt.vuv.slice(0, k3) };
      pt.release();
      return {
        name: name, pivot: pv, stateColor: c.stateColor ? Object.assign({}, c.stateColor) : null, perCopy: !!c.perCopy, member: !!c.member,
        castShadow: !pt.glowOnly && !c.perCopy, glow: pt.glowOnly, arrays: arrays,
        quads: pt.quads, tris: pt.quads * 2, faces: pt.faces, decals: pt.decals
      };
    });
    if (outParts.length > 6) note(issues, id + ': ' + outParts.length + ' parts (max 6)');
    var G = E.grid, O = E.origin;
    function itemPos(v) { var a = vec3(v, [0, 0, 0]); return [(a[0] + 0.5 - O[0]) * G[0], (a[1] + 0.5 - O[1]) * G[1], (a[2] + 0.5 - O[2]) * G[2]]; }
    var pivots = {};
    pivNames.slice(1).forEach(function (n) {
      var d = Array.isArray(decl[n]) ? { at: decl[n] } : decl[n] || {}, par = d.parent && d.parent !== 'root' ? d.parent : null;
      if (par && pivIdx[par] == null) note(issues, id + ': pivot "' + n + '" has unknown parent "' + par + '"');
      pivots[n] = { origin: itemPos(d.at), parent: par };
    });
    var empty = !isFinite(bmin[0]), bounds = empty ? { min: [0, 0, 0], max: [0, 0, 0] } : { min: bmin, max: bmax }, height = bounds.max[1];
    var anchors = {};
    Object.keys(model.anchors || {}).forEach(function (n) {
      var a = model.anchors[n], obj = Array.isArray(a) ? { at: a } : a || {}, pv = obj.pivot && obj.pivot !== 'root' ? obj.pivot : null;
      if (pv && pivIdx[pv] == null) { note(issues, id + ': anchor "' + n + '" uses unknown pivot "' + pv + '"'); pv = null; }
      anchors[n] = { at: itemPos(obj.at), pivot: pv };
    });
    if (!anchors.top) anchors.top = { at: [0, height + 0.15, 0], pivot: null };
    return {
      parts: outParts, pivots: pivots, anchors: anchors, bounds: bounds, height: height,
      hit: Array.isArray(model.hit) ? model.hit.slice(0, 3) : null, voxels: nvox, faces: nfaces, issues: issues
    };
  }

  /* ================================================================
     LOD — 2×2×2 → 1 per layer (grid doubled). A block fills when ≥ 3 of its 8 voxels do, or when
     one of them is a 1-voxel-thick silhouette (open on both sides along two axes: ropes, poles,
     spokes, bulbs). Its pivot is the candidates' majority (ties keep the moving part); its colour
     the most common VISIBLE char on that pivot. Pivots and anchors keep their root frame; decals
     drop (o.decalToken(cell) → token first paints the voxels under each decal). Blocks are aligned
     on the ground plane so bases stay at y = 0.
     ================================================================ */
  function lod(model, n, o) {
    var lv = n == null ? 1 : Math.max(0, Math.round(n)), m = model;
    for (var s = 0; s < lv; s++) m = coarsenModel(m, o || {});
    return m;
  }
  function freeChar(pal) {
    for (var c = 33; c <= 126; c++) if (c !== 46 && pal[String.fromCharCode(c)] === undefined) return String.fromCharCode(c);
    return null;
  }
  function coarsenModel(model, o) {
    model = model || {};
    var issues = [], E = evaluate(model, issues), pal = Object.assign({}, model.palette || {});
    if (typeof o.decalToken === 'function') {
      (model.decals || []).forEach(function (d) {
        var F = FACES[FACE_INDEX[d && d.face]], L = E.layers[d && d.layer | 0], tok = F && L ? o.decalToken(d.cell) : null;
        if (typeof tok !== 'string' || !tok) return;
        var ch = Object.keys(pal).filter(function (k) { return pal[k] === tok; })[0] || freeChar(pal);
        if (!ch) { note(issues, (model.id || 'model') + ': palette full (decal colour skipped)'); return; }
        pal[ch] = tok;
        if (!L.own) { L.c = L.c.slice(); L.own = true; }
        var at = vec3(d.at, [0, 0, 0]).map(Math.round), v = [0, 0, 0], size = d.size || [1, 1];
        for (var qq = 0; qq < (size[1] | 0 || 1); qq++) for (var pp = 0; pp < (size[0] | 0 || 1); pp++) {
          v[F.a] = at[F.a] - L.min[F.a]; v[F.p] = at[F.p] + pp - L.min[F.p]; v[F.q] = at[F.q] + qq - L.min[F.q];
          if (v[0] < 0 || v[1] < 0 || v[2] < 0 || v[0] >= L.dims[0] || v[1] >= L.dims[1] || v[2] >= L.dims[2]) continue;
          var s = (v[1] * L.dims[2] + v[2]) * L.dims[0] + v[0];
          if (L.c[s]) L.c[s] = ch.charCodeAt(0);
        }
      });
    }
    var out = {};
    Object.keys(model).forEach(function (k) { out[k] = model[k]; });
    out.grid = model.grid != null ? model.grid : E.grid.slice();
    out.origin = E.origin.slice();
    out.palette = pal; out.decals = []; out.lodLevel = (model.lodLevel | 0) + 1;
    out.layers = E.layers.map(coarsenLayer);
    var iss = (model.issues || []).concat(issues);
    if (iss.length) out.issues = iss;
    return out;
  }
  function coarsenLayer(L) {
    var W = L.dims[0], H = L.dims[1], D = L.dims[2], g2 = [L.grid[0] * 2, L.grid[1] * 2, L.grid[2] * 2];
    var al = [mod2(L.min[0]), L.jGround != null ? mod2(L.jGround) : mod2(L.min[1]), mod2(L.min[2])];
    var origin = [(L.origin[0] - al[0]) / 2, (L.origin[1] - al[1]) / 2, (L.origin[2] - al[2]) / 2];
    var layer = { grid: g2, origin: origin, at: L.at.slice(), ground: L.groundOpt };
    if (!(W > 0 && H > 0 && D > 0)) { layer.vox = { grid: g2, origin: origin, min: [0, 0, 0], dims: [0, 0, 0], c: EMPTY, p: EMPTY, names: L.names.slice() }; return layer; }
    var PX = W + 2, PZ = D + 2, STR = [1, PX * PZ, PX], occ = new Uint8Array(PX * (H + 2) * PZ);
    var gy = L.jGround != null ? L.jGround - L.min[1] + 1 : -1e9, x, y, z;
    for (y = 0; y < H; y++) for (z = 0; z < D; z++) for (x = 0; x < W; x++) if (L.c[(y * D + z) * W + x]) occ[((y + 1) * PZ + z + 1) * PX + x + 1] = 1;
    var B0 = [], B1 = [], bd = [];
    for (var a = 0; a < 3; a++) {
      B0[a] = Math.floor((L.min[a] - al[a]) / 2); B1[a] = Math.floor((L.min[a] + L.dims[a] - 1 - al[a]) / 2); bd[a] = B1[a] - B0[a] + 1;
    }
    var nc = new Uint8Array(bd[0] * bd[1] * bd[2]), np = new Uint8Array(nc.length);
    var cc = new Int32Array(8), cp = new Int32Array(8), cv = new Uint8Array(8), ct = new Uint8Array(8);
    for (var by = 0; by < bd[1]; by++) for (var bz = 0; bz < bd[2]; bz++) for (var bx = 0; bx < bd[0]; bx++) {
      var n = 0, thin = 0;
      for (var e = 0; e < 8; e++) {
        x = (B0[0] + bx) * 2 + al[0] + (e & 1) - L.min[0]; y = (B0[1] + by) * 2 + al[1] + (e >> 1 & 1) - L.min[1]; z = (B0[2] + bz) * 2 + al[2] + (e >> 2 & 1) - L.min[2];
        if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) continue;
        var s = (y * D + z) * W + x;
        if (!L.c[s]) continue;
        /* open: both neighbours empty along an axis (the ground ignored, so a rope lying on it stays
           thin); vis: some face shows (a face onto the ground or below it does not) */
        var ix = ((y + 1) * PZ + z + 1) * PX + x + 1, open = 0, vis = 0, under = y + 1 < gy;
        for (var ax = 0; ax < 3; ax++) {
          var lo = occ[ix - STR[ax]], hi = occ[ix + STR[ax]];
          if (!lo && !hi) open++;
          if (ax === 1 ? (!hi || (!lo && y >= gy)) : (!under && (!lo || !hi))) vis = 1;
        }
        cc[n] = L.c[s]; cp[n] = L.p[s]; cv[n] = vis; ct[n] = open >= 2 ? 1 : 0; thin |= ct[n]; n++;
      }
      if (!n || (n < 3 && !thin)) continue;
      var only = n < 3, bestP = -1, bestN = 0, i2, j2, cnt;
      for (i2 = 0; i2 < n; i2++) {
        if (only && !ct[i2]) continue;
        for (cnt = 0, j2 = 0; j2 < n; j2++) if ((!only || ct[j2]) && cp[j2] === cp[i2]) cnt++;
        if (cnt > bestN || (cnt === bestN && cp[i2] > bestP)) { bestN = cnt; bestP = cp[i2]; }
      }
      var anyVis = 0, bestC = 0;
      for (i2 = 0; i2 < n; i2++) if (cp[i2] === bestP && (!only || ct[i2]) && cv[i2]) anyVis = 1;
      bestN = 0;
      for (i2 = 0; i2 < n; i2++) {
        if (cp[i2] !== bestP || (only && !ct[i2]) || (anyVis && !cv[i2])) continue;
        for (cnt = 0, j2 = 0; j2 < n; j2++) if (cc[j2] === cc[i2] && cp[j2] === bestP && (!only || ct[j2]) && (!anyVis || cv[j2])) cnt++;
        if (cnt > bestN || (cnt === bestN && cc[i2] < bestC)) { bestN = cnt; bestC = cc[i2]; }
      }
      var o2 = (by * bd[2] + bz) * bd[0] + bx;
      nc[o2] = bestC; np[o2] = bestP;
    }
    layer.vox = { grid: g2, origin: origin, min: B0, dims: bd, c: nc, p: np, names: L.names.slice() };
    return layer;
  }

  /* ================================================================
     cullFor (D73): '-y' for every island template except isleLandmarks taller than 4 u and the
     characters; '-z' for the never-rotated kinds. o.tall: boolean or a height in u (an
     isleLandmark of unknown height keeps its undersides).
     ================================================================ */
  function cullFor(kind, o) {
    o = o || {};
    if (CHARACTER_KINDS[kind]) return [];
    var tall = typeof o.tall === 'number' ? o.tall > 4 : o.tall, out = [];
    if (!(kind === 'isleLandmark' && tall !== false)) out.push('-y');
    if (BACK_KINDS[kind]) out.push('-z');
    return out;
  }

  function stats(model, o) {
    var r = mesh(model, o), quads = 0, bytes = 0;
    r.parts.forEach(function (p) {
      quads += p.quads;
      Object.keys(p.arrays).forEach(function (k) { bytes += p.arrays[k].byteLength; });
    });
    return { voxels: r.voxels, faces: r.faces, quads: quads, tris: quads * 2, parts: r.parts.length, bytes: bytes };
  }

  /* FNV-1a over arrays (bytes), a mesh result (names + arrays) or a VoxModel (its evaluated voxels
     + canonical metadata, so a build function and its slices twin hash alike) */
  function hashInto(h, x) {
    if (x == null || typeof x !== 'object') return fnvStr(h, canon(x));
    if (ArrayBuffer.isView(x)) return fnvBytes(h, bytesOf(x));
    if (Array.isArray(x)) {
      if (x.every(function (v) { return typeof v === 'number'; })) return fnvBytes(h, bytesOf(new Float64Array(x)));
      x.forEach(function (v) { h = hashInto(h, v); });
      return h;
    }
    if (Array.isArray(x.parts) && x.bounds) {
      x.parts.forEach(function (p) {
        h = fnvStr(h, p.name);
        ['position', 'normal', 'color', 'vuv'].forEach(function (k) { if (p.arrays && p.arrays[k]) h = fnvBytes(h, bytesOf(p.arrays[k])); });
      });
      return h;
    }
    if (Array.isArray(x.layers)) {
      var meta = {}, E = evaluate(x, []);
      Object.keys(x).forEach(function (k) { if (k !== 'layers' && k !== 'issues') meta[k] = x[k]; });
      h = fnvStr(h, canon(meta));
      E.layers.forEach(function (L) {
        h = fnvStr(h, canon({ grid: L.grid, origin: L.origin, at: L.at, min: L.min, dims: L.dims, names: L.names, ground: L.groundOpt }));
        h = fnvBytes(fnvBytes(h, L.c), L.p);
      });
      return h;
    }
    return fnvStr(h, canon(x));
  }
  function hash(x) { return hex8(hashInto(FNV0, x)); }

  /* a crate in one token (D38: development stand-in for a missing id): G8, base inside fp − 0.14 u
     (8 × fp − 1 voxels), LOOK height, framed panels recessed by one voxel */
  function placeholder(fp, h, token) {
    var w = Array.isArray(fp) ? num(fp[0], 1) : num(fp, 1), d = Array.isArray(fp) ? num(fp[1], w) : w;
    var nx = Math.max(2, Math.round(w * 8 - 1)), nz = Math.max(2, Math.round(d * 8 - 1)), ny = Math.max(1, Math.round((h > 0 ? h : 0.6) / 0.125));
    var g = new Grid({ grid: 0.125, origin: [nx / 2, 0, nz / 2] }), i, j, k;
    g.box(0, nx - 1, 0, ny - 1, 0, nz - 1, 'c');
    if (ny >= 4) {
      if (nx >= 4) for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) { g.clear(i, j, 0); g.clear(i, j, nz - 1); }
      if (nz >= 4) for (j = 1; j < ny - 1; j++) for (k = 1; k < nz - 1; k++) { g.clear(0, j, k); g.clear(nx - 1, j, k); }
    }
    if (nx >= 4 && nz >= 4 && ny >= 3) for (k = 1; k < nz - 1; k++) for (i = 1; i < nx - 1; i++) g.clear(i, ny - 1, k);
    return g.model({ id: 'placeholder', palette: { c: typeof token === 'string' && token ? token : 'Pebble' }, placeholder: true });
  }

  /* dioramas: every layer of every model, moved by its at (u); palettes merged (a clashing char
     is re-lettered), clashing pivot / anchor names get '_<n>' */
  function compose(list, meta) {
    meta = meta || {};
    var out = { id: meta.id || 'compose', palette: {}, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [], G = null, O = null;
    (list || []).forEach(function (en, mi) {
      var m = en && en.model;
      if (!m) return;
      var E = evaluate(m, issues), off = vec3(en.at, [0, 0, 0]), ren = {}, base = out.layers.length;
      if (!G) {
        G = E.grid.slice(); O = E.origin.slice(); out.grid = G[0] === G[1] && G[1] === G[2] ? G[0] : G.slice(); out.origin = O.slice();
        ['cull', 'ao'].forEach(function (k) { if (m[k] !== undefined) out[k] = m[k]; });
      }
      function moved(v) {
        var a = vec3(v, [0, 0, 0]);
        return [0, 1, 2].map(function (x) { return ((a[x] + 0.5 - E.origin[x]) * E.grid[x] + off[x]) / G[x] + O[x] - 0.5; });
      }
      Object.keys(m.pivots || {}).forEach(function (n) { ren[n] = out.pivots[n] ? n + '_' + mi : n; });
      Object.keys(m.pivots || {}).forEach(function (n) {
        var d = Array.isArray(m.pivots[n]) ? { at: m.pivots[n] } : m.pivots[n] || {};
        out.pivots[ren[n]] = { at: moved(d.at), parent: d.parent ? ren[d.parent] || d.parent : null };
      });
      var remap = new Uint8Array(128);
      Object.keys(m.palette || {}).forEach(function (ch) {
        var code = ch.length === 1 ? codeOf(ch) : 0, e = m.palette[ch];
        if (!code) return;
        if (e && typeof e === 'object' && e.pivot && ren[e.pivot] && ren[e.pivot] !== e.pivot) { e = Object.assign({}, e); e.pivot = ren[e.pivot]; }
        var key = canon(e), tgt = ch;
        if (out.palette[ch] !== undefined && canon(out.palette[ch]) !== key) {
          tgt = Object.keys(out.palette).filter(function (k) { return canon(out.palette[k]) === key; })[0] || freeChar(out.palette);
          if (!tgt) { note(issues, 'compose: palette full ("' + ch + '" dropped)'); return; }
        }
        out.palette[tgt] = e; remap[code] = tgt.charCodeAt(0);
      });
      E.layers.forEach(function (L) {
        var c = new Uint8Array(L.c.length);
        for (var s = 0; s < c.length; s++) c[s] = L.c[s] ? remap[L.c[s]] : 0;
        out.layers.push({ grid: L.grid.slice(), origin: L.origin.slice(), at: [L.at[0] + off[0], L.at[1] + off[1], L.at[2] + off[2]], ground: L.groundOpt,
                          vox: { grid: L.grid.slice(), origin: L.origin.slice(), min: L.min.slice(), dims: L.dims.slice(), c: c, p: L.p.slice(),
                                 names: L.names.map(function (n) { return n ? ren[n] || n : n; }) } });
      });
      Object.keys(m.anchors || {}).forEach(function (n) {
        var a = m.anchors[n], obj = Array.isArray(a) ? { at: a } : a || {}, nm = out.anchors[n] ? n + '_' + mi : n;
        out.anchors[nm] = obj.pivot ? { at: moved(obj.at), pivot: ren[obj.pivot] || obj.pivot } : moved(obj.at);
      });
      (m.decals || []).forEach(function (d) {
        var c2 = Object.assign({}, d);
        c2.layer = base + (d.layer | 0);
        if (d.pivot) c2.pivot = ren[d.pivot] || d.pivot;
        out.decals.push(c2);
      });
      (m.issues || []).forEach(function (s) { note(issues, s); });
    });
    if (issues.length) out.issues = issues;
    return out;
  }

  return {
    VERSION: VERSION, GRIDS: GRIDS, MODES: MODES, MODE_NAMES: MODE_NAMES, AO: AO, FACES: FACES, Grid: Grid,
    grid: function (o) { return new Grid(o); },
    mesh: mesh, lod: lod, cullFor: cullFor, stats: stats, hash: hash, placeholder: placeholder, compose: compose
  };
}));
