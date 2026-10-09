/* ================================================================
   My Island 3D — grid maths (pure; no DOM, no THREE).
   window.SLGrid3D in the browser, module.exports in Node.
   Every rule (regions, cells, unlocks, footprints, entrances,
   occupancy) comes from SLWorldCore; heights and hit sizes from
   SLIslandLook. This file only turns them into world-space numbers.

   AXES: 1 cell = 1 u, Y up, +z toward the default camera (row 9 is
   nearest). Cell (c, r) centre = (c - 7.5, surfaceY, r - 4.5). An item
   with fp [w, h] at (x, y) pivots on (x + w/2 - 8, baseY, y + h/2 - 5)
   and faces +z. Sea level -0.32; grass tops 0; the sand skirt's top is
   -0.12 and it reaches 0.25 beyond the grass.

   API (frozen contract):
     constants   COLS ROWS X0 Z0 SEA_Y GRASS_Y GRASS_DEPTH SAND_Y SAND_REACH MARGIN FIT
                 CANOPY TERRACE MAX_TOP ITEM_MAX_H MIN_HIT PET_HIT_R TAP FIELD RISE
     key(c, r) · parseKey(k) → {c, r} · inGrid(c, r) · clampCell(c, r) → {c, r}
     regionOf(c, r) → 'home' | 'cove' | 'meadow' | null
     landFrom(arg) → {'c,r': 1}  (arg: undefined = home | ['home','cove'] | C.landSet(w) | a world)
     surfaceY(c, r)              terrace height (Meadow Hill 0.45/0.35/0.25/0.15 by column, else 0)
     cellTop(c, r, land)         surfaceY on land, SEA_Y elsewhere (the pick heightfield)
     cellCenter(c, r, land?) → {x, y, z} · worldToCell(x, z) → {c, r} (may be off-grid)
     footprint(id) → [w, h] · cellsOf(id, x, y) → [{c, r}]
     baseY(id, x, y) · pivot(id, x, y) → {x, y, z} · plinth(id, x, y) → null | {x, z, w, d, top, bottom}
     placement(id, x, y) → {pivot, baseY, plinth, cells, hit}
     hitSize(id) → [w, h, d] · hitBox(id, x, y) → {min: [x, y, z], max: [x, y, z]}
     landBounds(land, pad) · regionBounds(region)
     basis(yawDeg, elevDeg) → {D, F, R, U} · cameraPosition(target, yawDeg, elevDeg, dist)
     fitCamera({land, aspect, fov, yaw, elev, margin, height, pad, zoom, near}) →
       {target, dist, position, yaw, elev, fov, aspect, bounds}
     project(p, cam) → {x, y, depth} (NDC) · rayFromCamera(cam, ndcX, ndcY) → {origin, dir}
     rayPlane(origin, dir, y) → {x, y, z, t} | null
     rayToCell(origin, dir, land) → {c, r, key, x, y, z, t, land, side} | null
     bakeField(land) → {w, h, x0, z0, texel, shore: Float32Array, locked: Float32Array}
     sampleField(field, 'shore' | 'locked', x, z) · packField(field, opts) → Uint8Array (RG8)
     lockedRegionAt(x, z, land, pad) → region | null
     hash(str) → uint32 · hash01(str) · rng(seed) → () → [0, 1)
     jitter(uid, organicOrId) → {yaw, yawDeg, scale}
     tufts(c, r) · coveDeco(c, r) · wildflowers(c, r)    deterministic ground dressing
     pathNetworks(placed, origin) → [{root, cells: [{uid, id, c, r, d}], maxD}]
     riseOrder(region, land) → [{c, r, key, k, delay, dist}]
     signAnchor(region) → {x, y, z, region, side} · avatarSpot(placed) → {x, y, z, c, r} | null

   THE DISTANCE FIELD covers x -16..16, z -10..10 (64 × 40 texels of 0.5 u),
   twice the grid, so the shallow-water gradient (0 → 2.5 u) and the meadow /
   cove shores never touch a clamped texture edge. Channel 'shore' = distance
   (u) from the nearest unlocked-land cell square, 0 on land (subtract
   SAND_REACH for the sand edge). Channel 'locked' = signed distance to the
   locked-land squares: negative inside, positive outside (FIELD.far when
   nothing is locked).

   V3 (My Island v3, Pixel Blocks + the five sky islands; render-only, never
   saved, never in world-core — every rule still comes from SLWorldCore.ISLES):
     ISLE_LAYOUT[isle]   frozen: home {centre, gates}; each land {centre, homeGate,
                         dockEdge, bridge {style, width, length, rise, yawDeg},
                         bounds {x0, x1, z0, z1}, slab, visitPose {yaw, elev}}
     V3.SEA_Y SAND_Y SAND_REACH SLAB_B STRATA_TOP   heights below an island's top
     V3.TERRACE [0.5, 0.5, 0.25, 0.25] · ITEM_MAX_H (Home 2.9) · ISLAND_ITEM_MAX_H 5.5
     V3.SLAB_M 1.75 (slab rim) · TREETOP_PAD 0.9 (the treetop lip; it has no slab)
     V3.surfaceY(c, r)   Home ground with the chunky v3 meadow ledges, else 0
     V3.frame(isle) → Frame (cached, frozen): {isle, cols, rows, cx, cy, cz, top,
       offset [x0, z0], seaY, slab, pad, itemMaxH, bounds {x0, x1, z0, z1, yTop},
       inGrid, surfaceY, cellCenter(c, r, land?), worldToCell(x, z), baseY, pivot,
       placement → {pivot, baseY, plinth, cells, hit}, hitBox, landBounds(land, pad),
       rayToCell(origin, dir, land)}. Cell (c, r) centre = (x0 + c + 0.5, top, z0 + r
       + 0.5), x0 = cx − cols/2, z0 = cz − rows/2, no yaw. Home's frame is the v2 grid
       (pivot (x + w/2 − 8, baseY, y + h/2 − 5)) on the v3 terraces. bounds.yTop = the
       highest ground (items add itemMaxH). `land` = a cell set, 'c,r' keys, a world
       (C.landSetOf) or nothing (Home: its home region; a land: all its cells).
     V3.bridge(isle) → {isle, a (homeGate), b (dockEdge), length (level u), rise,
       slope, yawDeg (atan2(dx, dz): 0 = +z, 90 = +x), width, style} | null
     V3.gate(isle) → {x, y, z} (the bridge's start pad on Home's rim) | null
     V3.layoutChecks() → [{name, ok, detail}] (frames, gates, bridges, slopes,
       crossings, clearance, gaps; with SLWorldCore.ISLES also sizes, cells, docks
       and landmark spots)
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root, require('../world-core.js'), require('../world-look.js'));
  else root.SLGrid3D = factory(root, null, null);
}(typeof self !== 'undefined' ? self : this, function (root, C0, L0) {
  'use strict';

  /* lazy so script order never matters in the browser */
  function C() {
    var c = C0 || (root && root.SLWorldCore);
    if (!c) throw new Error('SLGrid3D: SLWorldCore is not loaded');
    return c;
  }
  function L() { return L0 || (root && root.SLIslandLook) || null; }

  var COLS = 16, ROWS = 10, X0 = -COLS / 2, Z0 = -ROWS / 2;
  var SEA_Y = -0.32, GRASS_Y = 0, GRASS_DEPTH = 0.35, SAND_Y = -0.12, SAND_REACH = 0.25;
  var MARGIN = 0.07, FIT = 0.86, CANOPY = { y: 1.0, w: 1.1 };
  var TERRACE = [0.45, 0.35, 0.25, 0.15];          /* Meadow Hill by column 0..3, rising to the west */
  var MAX_TOP = TERRACE[0], ITEM_MAX_H = 2.9;      /* castle turrets */
  var MIN_HIT = 0.8, PET_HIT_R = 0.4;
  var TAP = { slopPx: 8, ms: 500, longPressMs: 450, dragPx: 10 };
  var FIELD = { w: 64, h: 40, x0: -16, z0: -10, texel: 0.5, far: 32 };
  var RISE = { stagger: 0.05, each: 0.35 };
  var DEG = Math.PI / 180, EPS = 1e-9;

  /* ---------------- cells ---------------- */
  function key(c, r) { return c + ',' + r; }
  function parseKey(k) { var p = String(k).split(','); return { c: +p[0], r: +p[1] }; }
  function inGrid(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS && c === Math.floor(c) && r === Math.floor(r); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clampCell(c, r) { return { c: clamp(Math.round(c), 0, COLS - 1), r: clamp(Math.round(r), 0, ROWS - 1) }; }
  function regionOf(c, r) { return C().CELL_REGION[key(c, r)] || null; }

  function regionSet(keys, out) {
    var core = C();
    keys.forEach(function (rk) { (core.REGION_CELLS[rk] || []).forEach(function (k) { out[k] = 1; }); });
    return out;
  }
  function landFrom(arg) {
    if (arg == null) return regionSet(['home'], {});
    if (Array.isArray(arg)) {
      var core = C(), out = {};
      arg.forEach(function (v) {
        if (core.REGION_CELLS[v]) regionSet([v], out);
        else if (typeof v === 'string' && /^\d+,\d+$/.test(v)) out[v] = 1;
      });
      return out;
    }
    if (typeof arg === 'object' && arg.owned && Array.isArray(arg.placed)) return C().landSet(arg);
    return arg;
  }

  function surfaceY(c, r) {
    if (regionOf(c, r) !== 'meadow') return GRASS_Y;
    return c >= 0 && c < TERRACE.length ? TERRACE[c] : TERRACE[TERRACE.length - 1];
  }
  function cellTop(c, r, land) { return land[key(c, r)] ? surfaceY(c, r) : SEA_Y; }
  function cellCenter(c, r, land) {
    return { x: c - 7.5, y: land ? cellTop(c, r, landFrom(land)) : surfaceY(c, r), z: r - 4.5 };
  }
  function worldToCell(x, z) { return { c: Math.floor(x - X0), r: Math.floor(z - Z0) }; }

  /* ---------------- items ---------------- */
  function footprint(id) { var it = C().item(id); return (it && it.fp) || [1, 1]; }
  function cellsOf(id, x, y) {
    var fp = footprint(id), out = [];
    for (var dy = 0; dy < fp[1]; dy++) for (var dx = 0; dx < fp[0]; dx++) out.push({ c: x + dx, r: y + dy });
    return out;
  }
  function surfaceRange(id, x, y) {
    var lo = Infinity, hi = -Infinity;
    cellsOf(id, x, y).forEach(function (p) { var s = surfaceY(p.c, p.r); if (s < lo) lo = s; if (s > hi) hi = s; });
    return [lo, hi];
  }
  /* the highest surface across the footprint, so nothing sinks into a terrace */
  function baseY(id, x, y) { return surfaceRange(id, x, y)[1]; }
  function pivot(id, x, y) {
    var fp = footprint(id);
    return { x: x + fp[0] / 2 - 8, y: baseY(id, x, y), z: y + fp[1] / 2 - 5 };
  }
  /* a footprint that straddles terraces stands on a grass plinth slab */
  function plinth(id, x, y) {
    var rg = surfaceRange(id, x, y);
    if (rg[1] - rg[0] < EPS) return null;
    var fp = footprint(id), p = pivot(id, x, y);
    return { x: p.x, z: p.z, w: fp[0], d: fp[1], top: rg[1], bottom: rg[0] };
  }
  function hitSize(id) {
    var lk = L(), e = lk && lk.LOOK[id];
    if (e && e.hit) return e.hit.slice();
    var fp = footprint(id), h = e ? e.h : MIN_HIT;
    return [fp[0], Math.max(h, MIN_HIT), fp[1]];
  }
  function hitBox(id, x, y) {
    var s = hitSize(id), p = pivot(id, x, y);
    return { min: [p.x - s[0] / 2, p.y, p.z - s[2] / 2], max: [p.x + s[0] / 2, p.y + s[1], p.z + s[2] / 2] };
  }
  function placement(id, x, y) {
    return { pivot: pivot(id, x, y), baseY: baseY(id, x, y), plinth: plinth(id, x, y), cells: cellsOf(id, x, y), hit: hitBox(id, x, y) };
  }

  /* ---------------- bounds ---------------- */
  /* a grid in world space: v2 Home here; each v3 Frame carries its own (see V3) */
  var V2G = { x0: X0, z0: Z0, cols: COLS, rows: ROWS, base: 0, maxTop: MAX_TOP, seaY: SEA_Y, surf: surfaceY };
  function boundsIn(g, keys, pad) {
    pad = pad || 0;
    var b = { minC: Infinity, maxC: -Infinity, minR: Infinity, maxR: -Infinity, maxY: g.base };
    keys.forEach(function (k) {
      var p = parseKey(k);
      if (p.c < b.minC) b.minC = p.c; if (p.c > b.maxC) b.maxC = p.c;
      if (p.r < b.minR) b.minR = p.r; if (p.r > b.maxR) b.maxR = p.r;
      b.maxY = Math.max(b.maxY, g.surf(p.c, p.r));
    });
    if (!keys.length) { b.minC = b.minR = 0; b.maxC = g.cols - 1; b.maxR = g.rows - 1; }
    b.minX = b.minC + g.x0 - pad; b.maxX = b.maxC + 1 + g.x0 + pad;
    b.minZ = b.minR + g.z0 - pad; b.maxZ = b.maxR + 1 + g.z0 + pad;
    b.cx = (b.minX + b.maxX) / 2; b.cz = (b.minZ + b.maxZ) / 2;
    return b;
  }
  function boundsOf(keys, pad) { return boundsIn(V2G, keys, pad); }
  function landBounds(land, pad) { return boundsOf(Object.keys(landFrom(land)), pad); }
  function regionBounds(region) { return boundsOf(C().REGION_CELLS[region] || [], 0); }

  /* ---------------- camera maths ---------------- */
  function v3(p) { return Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p; }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  /* D = from target toward camera; F = forward; R = right; U = camera up (never rolls) */
  function basis(yawDeg, elevDeg) {
    var y = yawDeg * DEG, e = elevDeg * DEG;
    var D = { x: Math.sin(y) * Math.cos(e), y: Math.sin(e), z: Math.cos(y) * Math.cos(e) };
    var F = { x: -D.x, y: -D.y, z: -D.z };
    var R = norm({ x: -F.z, y: 0, z: F.x });
    return { D: D, F: F, R: R, U: cross(R, F) };
  }
  function cameraPosition(t, yawDeg, elevDeg, dist) {
    var D = basis(yawDeg, elevDeg).D;
    return { x: t.x + D.x * dist, y: t.y + D.y * dist, z: t.z + D.z * dist };
  }
  /* cam = {position, target, fov (deg, vertical), aspect} — same as THREE.PerspectiveCamera + lookAt */
  function camBasis(cam) {
    var P = v3(cam.position), T = v3(cam.target);
    var F = norm({ x: T.x - P.x, y: T.y - P.y, z: T.z - P.z });
    var R = norm(cross(F, { x: 0, y: 1, z: 0 }));
    return { P: P, F: F, R: R, U: cross(R, F), tanH: Math.tan((cam.fov || 30) * DEG / 2), aspect: cam.aspect || 1 };
  }
  function project(p, cam) {
    var b = camBasis(cam), q = v3(p);
    var v = { x: q.x - b.P.x, y: q.y - b.P.y, z: q.z - b.P.z }, depth = dot(v, b.F);
    return { x: dot(v, b.R) / (depth * b.tanH * b.aspect), y: dot(v, b.U) / (depth * b.tanH), depth: depth };
  }
  function rayFromCamera(cam, nx, ny) {
    var b = camBasis(cam);
    var d = norm({
      x: b.F.x + b.R.x * nx * b.tanH * b.aspect + b.U.x * ny * b.tanH,
      y: b.F.y + b.R.y * nx * b.tanH * b.aspect + b.U.y * ny * b.tanH,
      z: b.F.z + b.R.z * nx * b.tanH * b.aspect + b.U.z * ny * b.tanH
    });
    return { origin: b.P, dir: d };
  }
  /* distance that frames the unlocked land (sand skirt included) and everything up to
     ITEM_MAX_H inside NDC ±(1 - margin); target = centre of the land at y 0.3 */
  function fitCamera(o) {
    o = o || {};
    var land = landFrom(o.land);
    var b = landBounds(land, o.pad == null ? SAND_REACH : o.pad);
    var fov = o.fov || 30, yaw = o.yaw || 0, elev = o.elev == null ? 52 : o.elev, aspect = o.aspect || 16 / 9;
    var m = 1 - (o.margin == null ? 0.06 : o.margin), tanH = Math.tan(fov * DEG / 2), near = o.near || 0.5;
    var top = (o.height == null ? ITEM_MAX_H : o.height) + b.maxY;
    var T = { x: b.cx, y: 0.3, z: b.cz }, B = basis(yaw, elev), dist = near;
    [b.minX, b.maxX].forEach(function (x) {
      [SAND_Y, top].forEach(function (y) {
        [b.minZ, b.maxZ].forEach(function (z) {
          var q = { x: x - T.x, y: y - T.y, z: z - T.z }, f = dot(q, B.F);
          dist = Math.max(dist, Math.abs(dot(q, B.R)) / (m * tanH * aspect) - f, Math.abs(dot(q, B.U)) / (m * tanH) - f, near * 2 - f);
        });
      });
    });
    dist /= (o.zoom || 1);
    return { target: T, dist: dist, position: cameraPosition(T, yaw, elev, dist), yaw: yaw, elev: elev, fov: fov, aspect: aspect, bounds: b };
  }

  /* ---------------- picking ---------------- */
  function rayPlane(o, d, y) {
    o = v3(o); d = v3(d);
    if (Math.abs(d.y) < EPS) return null;
    var t = (y - o.y) / d.y;
    if (t < 0) return null;
    return { x: o.x + d.x * t, y: y, z: o.z + d.z * t, t: t };
  }
  /* march cell by cell along the ray over the heightfield (land tops, the sea elsewhere),
     testing each cell's top and its sides, so meadow cliffs and slab edges pick correctly */
  function rayToCell(o, d, land) { return march(V2G, o, d, landFrom(land)); }
  function march(g, o, d, land) {
    o = v3(o); d = norm(v3(d));
    if (!(d.y < -EPS)) return null;
    var X = g.x0, Z = g.z0, NC = g.cols, NR = g.rows;
    var tMin = o.y > g.maxTop ? (g.maxTop - o.y) / d.y : 0;
    var tMax = (g.seaY - o.y) / d.y;
    var axes = [['x', X, X + NC], ['z', Z, Z + NR]];
    for (var i = 0; i < 2; i++) {
      var ax = axes[i][0], lo = axes[i][1], hi = axes[i][2], ov = o[ax], dv = d[ax];
      if (Math.abs(dv) < EPS) { if (ov < lo || ov > hi) return null; continue; }
      var ta = (lo - ov) / dv, tb = (hi - ov) / dv;
      if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > tMin) tMin = ta;
      if (tb < tMax) tMax = tb;
    }
    if (tMin > tMax) return null;
    var tc = tMin + 1e-7;
    var c = clamp(Math.floor(o.x + d.x * tc - X), 0, NC - 1), r = clamp(Math.floor(o.z + d.z * tc - Z), 0, NR - 1);
    var stepC = d.x > 0 ? 1 : -1, stepR = d.z > 0 ? 1 : -1;
    var tDX = Math.abs(d.x) > EPS ? 1 / Math.abs(d.x) : Infinity, tDZ = Math.abs(d.z) > EPS ? 1 / Math.abs(d.z) : Infinity;
    var tNX = Math.abs(d.x) > EPS ? ((d.x > 0 ? c + 1 + X : c + X) - o.x) / d.x : Infinity;
    var tNZ = Math.abs(d.z) > EPS ? ((d.z > 0 ? r + 1 + Z : r + Z) - o.z) / d.z : Infinity;
    var tEnter = tMin;
    function hit(t, side) {
      var k = key(c, r);
      return { c: c, r: r, key: k, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t, t: t, land: !!land[k], side: side };
    }
    for (var guard = 0; guard < NC + NR + 4; guard++) {
      var tExit = Math.min(tNX, tNZ, tMax), top = land[key(c, r)] ? g.surf(c, r) : g.seaY, yIn = o.y + d.y * tEnter;
      /* already at or below this cell's top as we enter it: we came in through its side */
      if (yIn <= top + 1e-7) return hit(tEnter, yIn < top - 1e-6);
      var tTop = (top - o.y) / d.y;
      if (tTop <= tExit + 1e-9) return hit(tTop, false);
      if (tExit >= tMax - 1e-12) return null;
      if (tNX < tNZ) { c += stepC; tEnter = tNX; tNX += tDX; } else { r += stepR; tEnter = tNZ; tNZ += tDZ; }
      if (c < 0 || c >= NC || r < 0 || r >= NR) return null;
    }
    return null;
  }

  /* ---------------- shore / locked distance field ---------------- */
  function squareDist(x, z, c, r) {
    var x0 = c + X0, z0 = r + Z0;
    var dx = x < x0 ? x0 - x : x > x0 + 1 ? x - x0 - 1 : 0;
    var dz = z < z0 ? z0 - z : z > z0 + 1 ? z - z0 - 1 : 0;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function lockedCells(land) {
    var core = C(), out = [];
    Object.keys(core.REGION_CELLS).forEach(function (rk) {
      core.REGION_CELLS[rk].forEach(function (k) { if (!land[k]) { var p = parseKey(k); p.region = rk; out.push(p); } });
    });
    return out;
  }
  function bakeField(landArg) {
    var land = landFrom(landArg), W = FIELD.w, H = FIELD.h, n = W * H;
    var landCells = Object.keys(land).map(parseKey), locked = lockedCells(land), lockedSet = {};
    locked.forEach(function (p) { lockedSet[key(p.c, p.r)] = 1; });
    var open = [];                                  /* grid cells that are not locked land */
    for (var gr = 0; gr < ROWS; gr++) for (var gc = 0; gc < COLS; gc++) if (!lockedSet[key(gc, gr)]) open.push({ c: gc, r: gr });
    var shore = new Float32Array(n), lock = new Float32Array(n);
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var x = FIELD.x0 + (i + 0.5) * FIELD.texel, z = FIELD.z0 + (j + 0.5) * FIELD.texel, idx = j * W + i, k, best;
        best = Infinity;
        for (k = 0; k < landCells.length && best > 0; k++) best = Math.min(best, squareDist(x, z, landCells[k].c, landCells[k].r));
        shore[idx] = best === Infinity ? FIELD.far : best;
        if (!locked.length) { lock[idx] = FIELD.far; continue; }
        var cell = worldToCell(x, z);
        if (lockedSet[key(cell.c, cell.r)]) {
          /* inside: minus the distance to the nearest point that is not locked land */
          best = Math.min(x - X0, X0 + COLS - x, z - Z0, Z0 + ROWS - z);
          for (k = 0; k < open.length; k++) best = Math.min(best, squareDist(x, z, open[k].c, open[k].r));
          lock[idx] = -best;
        } else {
          best = Infinity;
          for (k = 0; k < locked.length; k++) best = Math.min(best, squareDist(x, z, locked[k].c, locked[k].r));
          lock[idx] = best;
        }
      }
    }
    return { w: W, h: H, x0: FIELD.x0, z0: FIELD.z0, texel: FIELD.texel, shore: shore, locked: lock };
  }
  function sampleField(f, ch, x, z) {
    var a = f[ch], u = (x - f.x0) / f.texel - 0.5, v = (z - f.z0) / f.texel - 0.5;
    var i0 = clamp(Math.floor(u), 0, f.w - 1), j0 = clamp(Math.floor(v), 0, f.h - 1);
    var i1 = Math.min(i0 + 1, f.w - 1), j1 = Math.min(j0 + 1, f.h - 1);
    var fu = clamp(u - i0, 0, 1), fv = clamp(v - j0, 0, 1);
    var top = a[j0 * f.w + i0] * (1 - fu) + a[j0 * f.w + i1] * fu;
    var bot = a[j1 * f.w + i0] * (1 - fu) + a[j1 * f.w + i1] * fu;
    return top * (1 - fv) + bot * fv;
  }
  /* RG8 for a DataTexture: R = shore / maxShore, G = 0.5 + locked / (2 · maxLocked).
     Decode in the shader: shore = R · maxShore, locked = (G - 0.5) · 2 · maxLocked. */
  function packField(f, o) {
    o = o || {};
    var ms = o.maxShore || 4, ml = o.maxLocked || 2, out = new Uint8Array(f.w * f.h * 2);
    for (var i = 0; i < f.w * f.h; i++) {
      out[i * 2] = Math.round(Math.max(0, Math.min(1, f.shore[i] / ms)) * 255);
      out[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + f.locked[i] / (2 * ml))) * 255);
    }
    return out;
  }
  /* the locked region under a sea-plane point (the hologram sandbar reaches pad beyond its cells) */
  function lockedRegionAt(x, z, landArg, pad) {
    var land = landFrom(landArg), best = Infinity, region = null;
    pad = pad == null ? SAND_REACH : pad;
    lockedCells(land).forEach(function (p) {
      var dd = squareDist(x, z, p.c, p.r);
      if (dd < best) { best = dd; region = p.region; }
    });
    return best <= pad ? region : null;
  }

  /* ---------------- deterministic charm ---------------- */
  /* FNV-1a 32-bit — the same hash as SLMotion.phaseOf, so loops and jitter agree */
  function hash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function hash01(s) { return hash(s) / 4294967296; }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /* organic decor only: yaw ±8°, scale 0.94–1.06 */
  function jitter(uid, organicOrId) {
    var organic = organicOrId;
    if (typeof organicOrId === 'string') { var lk = L(), e = lk && lk.LOOK[organicOrId]; organic = !!(e && e.organic); }
    if (!organic) return { yaw: 0, yawDeg: 0, scale: 1 };
    var yawDeg = (hash01('yaw:' + uid) * 2 - 1) * 8;
    return { yaw: yawDeg * DEG, yawDeg: yawDeg, scale: 0.94 + hash01('scale:' + uid) * 0.12 };
  }
  function scatter(tag, c, r, n, ring, extra) {
    var R = rng(hash(tag + ':' + c + ',' + r)), out = [], ctr = cellCenter(c, r);
    var count = n[0] + Math.floor(R() * (n[1] - n[0] + 1));
    for (var i = 0; i < count; i++) {
      var a = (i / count + R() * 0.6 / count) * Math.PI * 2, d = ring[0] + R() * (ring[1] - ring[0]);
      var p = { x: ctr.x + Math.cos(a) * d, y: ctr.y, z: ctr.z + Math.sin(a) * d, yaw: R() * Math.PI * 2, s: 0.8 + R() * 0.4 };
      if (extra) extra(p, i, R);
      out.push(p);
    }
    return out;
  }
  /* 1–2 grass tufts near the cell's edge (the centre is where items stand) */
  function tufts(c, r) { return scatter('tuft', c, r, [1, 2], [0.24, 0.4]); }
  /* 2–3 shells and starfish per Beach Cove cell */
  function coveDeco(c, r) {
    return scatter('cove', c, r, [2, 3], [0.12, 0.38], function (p, i, R) {
      p.kind = R() < 0.55 ? 'shell' : 'starfish';
      p.token = p.kind === 'shell' ? 'Blossom Light' : 'Peach Coral';
    });
  }
  /* 3–5 wildflower dots per Meadow Hill cell */
  var WILD = ['Cloud White', 'Tulip Yellow', 'Tulip Pink'];
  function wildflowers(c, r) {
    return scatter('wild', c, r, [3, 5], [0.1, 0.4], function (p, i, R) { p.token = WILD[Math.floor(R() * WILD.length)]; p.s = 0.6 + R() * 0.5; });
  }

  /* ---------------- networks, unlock order, anchors ---------------- */
  function houseOf(placed) {
    for (var i = 0; i < (placed || []).length; i++) if (placed[i].id === 'house_cottage') return placed[i];
    return null;
  }
  /* connected path cells (4-neighbour flood fill), each ordered by steps from the cell
     nearest the origin (default: the house entrance, else the grid centre) */
  function pathNetworks(placed, origin) {
    var core = C(), cells = {}, list = [];
    (placed || []).forEach(function (p) {
      var it = core.item(p.id);
      if (!it || it.kind !== 'path') return;
      var k = key(p.x, p.y);
      if (!cells[k]) { cells[k] = { uid: p.uid, id: p.id, c: p.x, r: p.y, d: -1 }; list.push(cells[k]); }
    });
    var o = origin ? { c: origin.c != null ? origin.c : origin.x, r: origin.r != null ? origin.r : origin.y } : null;
    if (!o) {
      var h = houseOf(placed);
      if (h) { var ent = core.entranceCells(core.item(h.id), h.x, h.y)[0]; o = ent ? parseKey(ent) : { c: h.x, r: h.y }; }
      else o = { c: 7.5, r: 4.5 };
    }
    function d2(p) { return (p.c - o.c) * (p.c - o.c) + (p.r - o.r) * (p.r - o.r); }
    function order(a, b) { return a.r - b.r || a.c - b.c; }
    var seen = {}, nets = [];
    list.slice().sort(order).forEach(function (start) {
      if (seen[key(start.c, start.r)]) return;
      var comp = [], queue = [start];
      seen[key(start.c, start.r)] = 1;
      while (queue.length) {
        var cur = queue.shift();
        comp.push(cur);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (s) {
          var nk = key(cur.c + s[0], cur.r + s[1]);
          if (cells[nk] && !seen[nk]) { seen[nk] = 1; queue.push(cells[nk]); }
        });
      }
      var root = comp.slice().sort(function (a, b) { return d2(a) - d2(b) || order(a, b); })[0];
      comp.forEach(function (p) { p.d = -1; });
      root.d = 0; queue = [root];
      while (queue.length) {
        var q = queue.shift();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (s) {
          var n2 = cells[key(q.c + s[0], q.r + s[1])];
          if (n2 && n2.d < 0) { n2.d = q.d + 1; queue.push(n2); }
        });
      }
      comp.sort(function (a, b) { return a.d - b.d || order(a, b); });
      nets.push({ root: { c: root.c, r: root.r }, cells: comp, maxD: comp[comp.length - 1].d, rootD2: d2(root) });
    });
    nets.sort(function (a, b) { return a.rootD2 - b.rootD2 || a.root.r - b.root.r || a.root.c - b.root.c; });
    nets.forEach(function (n) { delete n.rootD2; });
    return nets;
  }
  /* unlock wave: a region's cells ordered outward from the land that was already there */
  function riseOrder(region, landArg) {
    var core = C(), cells = (core.REGION_CELLS[region] || []).map(parseKey), land = landFrom(landArg), shoreCells = [];
    Object.keys(land).forEach(function (k) { if (core.CELL_REGION[k] !== region) shoreCells.push(parseKey(k)); });
    if (!shoreCells.length) shoreCells = core.REGION_CELLS.home.map(parseKey);
    cells.forEach(function (p) {
      var ctr = cellCenter(p.c, p.r), best = Infinity;
      shoreCells.forEach(function (s) { best = Math.min(best, squareDist(ctr.x, ctr.z, s.c, s.r)); });
      p.dist = best; p.key = key(p.c, p.r);
    });
    cells.sort(function (a, b) { return a.dist - b.dist || a.r - b.r || a.c - b.c; });
    cells.forEach(function (p, i) { p.k = i; p.delay = i * RISE.stagger; });
    return cells;
  }
  /* the '🔒 name ⭐ price' sign sits on the region's outer edge, facing away from home */
  function signAnchor(region) {
    var core = C(), cells = core.REGION_CELLS[region];
    if (!cells || region === 'home') return null;
    var b = regionBounds(region), home = regionBounds('home');
    var dx = b.cx - home.cx, dz = b.cz - home.cz, outer, along = [];
    /* centre the sign on the cells that actually reach the outermost column (or row) */
    if (Math.abs(dx) >= Math.abs(dz)) {
      var edgeC = dx > 0 ? b.maxC : b.minC;
      cells.map(parseKey).forEach(function (p) { if (p.c === edgeC) along.push(p.r); });
      outer = { x: dx > 0 ? b.maxX : b.minX, z: (Math.min.apply(null, along) + Math.max.apply(null, along) + 1) / 2 + Z0, side: dx > 0 ? 'east' : 'west' };
    } else {
      var edgeR = dz > 0 ? b.maxR : b.minR;
      cells.map(parseKey).forEach(function (p) { if (p.r === edgeR) along.push(p.c); });
      outer = { z: dz > 0 ? b.maxZ : b.minZ, x: (Math.min.apply(null, along) + Math.max.apply(null, along) + 1) / 2 + X0, side: dz > 0 ? 'south' : 'north' };
    }
    return { x: outer.x, y: 0.35, z: outer.z, region: region, side: outer.side };
  }
  /* the avatar stands on the left of the house's two entrance cells (kept free of objects) */
  function avatarSpot(placed) {
    var h = houseOf(placed);
    if (!h) return null;
    var core = C(), ent = core.entranceCells(core.item(h.id), h.x, h.y)[0];
    if (!ent) return null;
    var p = parseKey(ent), ctr = cellCenter(p.c, p.r);
    return { x: ctr.x, y: ctr.y, z: ctr.z, c: p.c, r: p.r };
  }

  /* ================================================================
     V3: where Home and the five sky islands sit (world-model layout3d, D13).
     Render-only and lab-tunable by editing this table: no save or rule
     depends on it. A test pins the rule side (sizes, cells, docks, spots).
     LAND SHOPS (D87): the islands grew to hold their shops (pier 16 × 10,
     jungle 10 × 9, ice 12 × 7; treetop 10 × 8 and castle 12 × 8 fill out the
     boxes they had). Each grew AWAY from Home and from its neighbours — the
     pier east and toward the camera, the jungle one row toward the camera,
     the ice village two columns east — so only those three centres and boxes
     moved. Every gate, dock edge, bridge and visit pose is the wave-1 value,
     and every gap between boxes is unchanged (GAPS).
     ================================================================ */
  function freezeDeep(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { freezeDeep(o[k]); }); Object.freeze(o); }
    return o;
  }
  var ISLE_LAYOUT = freezeDeep({
    home: { centre: [0, 0, 0],
      gates: { pier: [9, 0, -1.5], jungle: [-9, 0, -1.5], treetop: [-6.5, 0, -5.4], castle: [0, 0, -5.4], ice: [6.5, 0, -5.4] } },
    pier: { centre: [23, -0.5, 0], homeGate: [9, 0, -1.5], dockEdge: [16, -0.5, -1.5],
      bridge: { style: 'boardwalk', width: 1, length: 7, rise: -0.5, yawDeg: 90 },
      bounds: { x0: 15, x1: 31, z0: -5, z1: 5 }, slab: true, visitPose: { yaw: -12, elev: 44 } },
    jungle: { centre: [-20, 0.5, -0.5], homeGate: [-9, 0, -1.5], dockEdge: [-15, 0.5, -1.5],
      bridge: { style: 'vine', width: 1, length: 6, rise: 0.5, yawDeg: -90 },
      bounds: { x0: -25, x1: -15, z0: -5, z1: 4 }, slab: true, visitPose: { yaw: 12, elev: 44 } },
    treetop: { centre: [-16, 2.5, -16], homeGate: [-6.5, 0, -5.4], dockEdge: [-12.5, 2.5, -13],
      bridge: { style: 'rope', width: 1, length: 9.68, rise: 2.5, yawDeg: -141.7 },
      bounds: { x0: -21, x1: -11, z0: -20, z1: -12 }, slab: false, visitPose: { yaw: 15, elev: 44 } },
    castle: { centre: [0, 3, -20], homeGate: [0, 0, -5.4], dockEdge: [0, 3, -16],
      bridge: { style: 'causeway', width: 2, length: 10.6, rise: 3, yawDeg: 180 },
      bounds: { x0: -6, x1: 6, z0: -24, z1: -16 }, slab: true, visitPose: { yaw: 0, elev: 44 } },
    ice: { centre: [17, 2, -15], homeGate: [6.5, 0, -5.4], dockEdge: [12.5, 2, -12.5],
      bridge: { style: 'ice', width: 1, length: 9.3, rise: 2, yawDeg: 139.8 },
      bounds: { x0: 11, x1: 23, z0: -18.5, z1: -11.5 }, slab: true, visitPose: { yaw: -15, elev: 44 } }
  });
  var SKY = ['pier', 'jungle', 'treetop', 'castle', 'ice'];        /* SLWorldCore.ISLE_ORDER after 'home' */
  /* the world-model gap table (u between land boxes, before each slab's rim): tuning may widen, never narrow */
  var GAPS = freezeDeep({ 'pier-jungle': 30, 'pier-treetop': 26.93, 'pier-castle': 14.21, 'pier-ice': 6.5, 'jungle-treetop': 7,
    'jungle-castle': 14.21, 'jungle-ice': 26.8, 'treetop-castle': 5, 'treetop-ice': 22, 'castle-ice': 5 });
  var LAYOUT_RULE = { maxSlope: 0.29, nearGap: 6, nearRise: 0.5, tol: 0.01, yawTol: 0.1 };

  /* heights are relative to an island's top (sky-world frame heights): land voxels fill top − 0.5
     … top, the beach ring top − 0.5, water top − 0.75, the slab bottom top − 2, strata from
     top − 2.25 down; Meadow Hill's ledges are half-voxel steps (D40) */
  var V3_TERRACE = Object.freeze([0.5, 0.5, 0.25, 0.25]);
  var V3_MAX_TERRACE = 0.5;
  function v3SurfaceY(c, r) {
    if (regionOf(c, r) !== 'meadow') return GRASS_Y;
    return c >= 0 && c < V3_TERRACE.length ? V3_TERRACE[c] : V3_TERRACE[V3_TERRACE.length - 1];
  }

  function coreOrNull() { return C0 || (root && root.SLWorldCore) || null; }
  function rowsToSet(cells, out) {
    Object.keys(cells).forEach(function (r) { var s = cells[r]; for (var c = s[0]; c <= s[1]; c++) out[key(c, +r)] = 1; });
    return out;
  }
  /* every land cell of a sky island (the rule table), or {} before world-core has ISLES */
  function isleCells(isle) {
    var core = coreOrNull(), out = {};
    var list = core && core.ISLE_CELLS && core.ISLE_CELLS[isle];
    if (Array.isArray(list)) { list.forEach(function (k) { out[k] = 1; }); return out; }
    var I = core && core.ISLES && core.ISLES[isle];
    return I && I.cells && typeof I.cells === 'object' ? rowsToSet(I.cells, out) : out;
  }
  function isleLand(isle, arg) {
    if (isle === 'home') return landFrom(arg);
    if (arg == null) return isleCells(isle);
    if (Array.isArray(arg)) {
      var out = {};
      arg.forEach(function (k) { if (typeof k === 'string' && /^\d+,\d+$/.test(k)) out[k] = 1; });
      return out;
    }
    if (typeof arg === 'object' && arg.owned && Array.isArray(arg.placed)) {
      var core = C();
      return typeof core.landSetOf === 'function' ? core.landSetOf(arg, isle) : {};
    }
    return arg;
  }

  /* one Frame per island, built on first use (world-core may load after this file) */
  var FRAMES = Object.create(null);
  function frame(isle) {
    if (FRAMES[isle]) return FRAMES[isle];
    var lay = Object.prototype.hasOwnProperty.call(ISLE_LAYOUT, isle) ? ISLE_LAYOUT[isle] : null;
    if (!lay) return null;
    var home = isle === 'home', b = lay.bounds;
    var cols = home ? COLS : b.x1 - b.x0, rows = home ? ROWS : b.z1 - b.z0;
    var cx = lay.centre[0], cy = lay.centre[1], cz = lay.centre[2], top = cy;
    var x0 = cx - cols / 2, z0 = cz - rows / 2, maxTop = top + (home ? V3_MAX_TERRACE : 0), seaY = top + V3.SEA_Y;
    var surf = home ? v3SurfaceY : function () { return top; };
    var g = { x0: x0, z0: z0, cols: cols, rows: rows, base: top, maxTop: maxTop, seaY: seaY, surf: surf };
    function inGridF(c, r) { return c >= 0 && c < cols && r >= 0 && r < rows && c === Math.floor(c) && r === Math.floor(r); }
    function range(id, x, y) {
      var lo = Infinity, hi = -Infinity;
      cellsOf(id, x, y).forEach(function (p) { var s = surf(p.c, p.r); if (s < lo) lo = s; if (s > hi) hi = s; });
      return [lo, hi];
    }
    function baseYF(id, x, y) { return range(id, x, y)[1]; }
    function pivotF(id, x, y) {
      var fp = footprint(id);
      return { x: x0 + x + fp[0] / 2, y: baseYF(id, x, y), z: z0 + y + fp[1] / 2 };
    }
    /* Home only: a footprint across two ledges stands on a plinth (sky islands are flat) */
    function plinthF(id, x, y) {
      var rg = range(id, x, y);
      if (rg[1] - rg[0] < EPS) return null;
      var fp = footprint(id), p = pivotF(id, x, y);
      return { x: p.x, z: p.z, w: fp[0], d: fp[1], top: rg[1], bottom: rg[0] };
    }
    function hitBoxF(id, x, y) {
      var s = hitSize(id), p = pivotF(id, x, y);
      return { min: [p.x - s[0] / 2, p.y, p.z - s[2] / 2], max: [p.x + s[0] / 2, p.y + s[1], p.z + s[2] / 2] };
    }
    var F = {
      isle: isle, cols: cols, rows: rows, cx: cx, cy: cy, cz: cz, top: top, offset: Object.freeze([x0, z0]),
      seaY: seaY, slab: home || !!lay.slab, pad: home || lay.slab ? V3.SLAB_M : V3.TREETOP_PAD,
      itemMaxH: home ? ITEM_MAX_H : V3.ISLAND_ITEM_MAX_H,
      bounds: Object.freeze({ x0: x0, x1: x0 + cols, z0: z0, z1: z0 + rows, yTop: maxTop }),
      inGrid: inGridF,
      surfaceY: function (c, r) { return surf(c, r); },
      cellCenter: function (c, r, land) {
        var y = land ? (isleLand(isle, land)[key(c, r)] ? surf(c, r) : seaY) : surf(c, r);
        return { x: x0 + c + 0.5, y: y, z: z0 + r + 0.5 };
      },
      worldToCell: function (x, z) { return { c: Math.floor(x - x0), r: Math.floor(z - z0) }; },
      baseY: baseYF,
      pivot: pivotF,
      placement: function (id, x, y) {
        return { pivot: pivotF(id, x, y), baseY: baseYF(id, x, y), plinth: home ? plinthF(id, x, y) : null, cells: cellsOf(id, x, y), hit: hitBoxF(id, x, y) };
      },
      hitBox: hitBoxF,
      landBounds: function (land, pad) { return boundsIn(g, Object.keys(isleLand(isle, land)), pad); },
      rayToCell: function (o, d, land) { return march(g, o, d, isleLand(isle, land)); }
    };
    return (FRAMES[isle] = Object.freeze(F));
  }

  function vec(a) { return Object.freeze({ x: a[0], y: a[1], z: a[2] }); }
  var BRIDGES = Object.create(null), GATES = Object.create(null);
  /* the straight run from the Home gate pad (y 0) to the dock's outer edge (y = the island top) */
  function bridge(isle) {
    if (BRIDGES[isle]) return BRIDGES[isle];
    var lay = SKY.indexOf(isle) >= 0 ? ISLE_LAYOUT[isle] : null;
    if (!lay) return null;
    var a = vec(lay.homeGate), b = vec(lay.dockEdge), dx = b.x - a.x, dz = b.z - a.z;
    var length = Math.sqrt(dx * dx + dz * dz), rise = b.y - a.y;
    return (BRIDGES[isle] = Object.freeze({
      isle: isle, a: a, b: b, length: length, rise: rise, slope: length > 0 ? Math.abs(rise) / length : 0,
      yawDeg: Math.atan2(dx, dz) / DEG, width: lay.bridge.width, style: lay.bridge.style
    }));
  }
  function gate(isle) {
    if (GATES[isle]) return GATES[isle];
    var p = SKY.indexOf(isle) >= 0 ? ISLE_LAYOUT.home.gates[isle] : null;
    return p ? (GATES[isle] = vec(p)) : null;
  }

  /* ---------------- layout checks (lab + tests; world-model layoutChecks) ---------------- */
  function boxGap(a, b) {
    var dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
    return Math.sqrt(dx * dx + dz * dz);
  }
  function orient(p, q, r) { var v = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x); return Math.abs(v) < 1e-12 ? 0 : v > 0 ? 1 : -1; }
  function onSeg(p, q, r) { return Math.min(p.x, r.x) - 1e-12 <= q.x && q.x <= Math.max(p.x, r.x) + 1e-12 && Math.min(p.z, r.z) - 1e-12 <= q.z && q.z <= Math.max(p.z, r.z) + 1e-12; }
  /* 2D (x, z) segments p1–p2 and q1–q2 touch or cross */
  function segmentsMeet(p1, p2, q1, q2) {
    var o1 = orient(p1, p2, q1), o2 = orient(p1, p2, q2), o3 = orient(q1, q2, p1), o4 = orient(q1, q2, p2);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSeg(p1, q1, p2)) || (o2 === 0 && onSeg(p1, q2, p2)) || (o3 === 0 && onSeg(q1, p1, q2)) || (o4 === 0 && onSeg(q1, p2, q2));
  }
  /* 2D segment a–b passes through box {x0, x1, z0, z1} (Liang–Barsky) */
  function segmentHitsBox(a, b, box) {
    var t0 = 0, t1 = 1, d = [b.x - a.x, b.z - a.z], s = [a.x, a.z], lo = [box.x0, box.z0], hi = [box.x1, box.z1];
    for (var i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < EPS) { if (s[i] <= lo[i] || s[i] >= hi[i]) return false; continue; }
      var ta = (lo[i] - s[i]) / d[i], tb = (hi[i] - s[i]) / d[i];
      if (ta > tb) { var w = ta; ta = tb; tb = w; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 >= t1) return false;
    }
    return true;
  }
  function padded(bx, p) { return { x0: bx.x0 - p, x1: bx.x1 + p, z0: bx.z0 - p, z1: bx.z1 + p }; }
  function near2(a, b, tol) { return Math.abs(a - b) <= tol; }

  function layoutChecks() {
    var out = [];
    function add(name, bad, okText) { out.push({ name: name, ok: !bad.length, detail: bad.length ? bad.join('; ') : okText }); }
    var bad = [];
    /* frames: each land's box is its grid round its centre, no bigger than the Home-sized 16 × 10 */
    SKY.forEach(function (k) {
      var F = frame(k), bx = ISLE_LAYOUT[k].bounds;
      if (!near2(F.bounds.x0, bx.x0, 1e-9) || !near2(F.bounds.z0, bx.z0, 1e-9)) bad.push(k + ' centre is not the middle of its box');
      if (F.cols > COLS || F.rows > ROWS) bad.push(k + ' is bigger than 16 × 10');
    });
    add('frames', bad, 'every land box is centred on its grid and ≤ 16 × 10');
    /* gates: Home's gate table and each bridge start agree, at Home's top, outside every Home cell */
    var core = coreOrNull();
    bad = [];
    SKY.forEach(function (k) {
      var g = ISLE_LAYOUT.home.gates[k], h = ISLE_LAYOUT[k].homeGate;
      if (!g || g[0] !== h[0] || g[1] !== h[1] || g[2] !== h[2]) bad.push(k + ' gate differs from its homeGate');
      if (h[1] !== 0) bad.push(k + ' gate is not at Home height');
      var cell = worldToCell(h[0], h[2]), inside = h[0] >= X0 && h[0] <= X0 + COLS && h[2] >= Z0 && h[2] <= Z0 + ROWS;
      if (inside && (!core || core.CELL_REGION[key(cell.c, cell.r)])) bad.push(k + ' gate stands on a Home cell');
    });
    add('gates', bad, 'five gate pads on Home’s rim, off every land cell');
    /* bridges: the table's length / rise / yaw match the ends */
    bad = [];
    SKY.forEach(function (k) {
      var br = bridge(k), t = ISLE_LAYOUT[k].bridge;
      if (!near2(br.length, t.length, LAYOUT_RULE.tol)) bad.push(k + ' length ' + br.length.toFixed(3) + ' vs ' + t.length);
      if (!near2(br.rise, t.rise, 1e-9)) bad.push(k + ' rise ' + br.rise + ' vs ' + t.rise);
      if (!near2(br.yawDeg, t.yawDeg, LAYOUT_RULE.yawTol)) bad.push(k + ' yaw ' + br.yawDeg.toFixed(2) + ' vs ' + t.yawDeg);
      if (!near2(br.b.y, frame(k).top, 1e-9)) bad.push(k + ' bridge does not land at the island top');
    });
    add('bridges', bad, 'bridge length, rise and yaw match homeGate → dockEdge');
    bad = [];
    SKY.forEach(function (k) { var s = bridge(k).slope; if (s > LAYOUT_RULE.maxSlope) bad.push(k + ' slope ' + s.toFixed(3)); });
    add('slopes', bad, 'every bridge slope ≤ ' + LAYOUT_RULE.maxSlope);
    bad = [];
    SKY.forEach(function (k, i) {
      SKY.slice(i + 1).forEach(function (m) {
        var p = bridge(k), q = bridge(m);
        if (segmentsMeet(p.a, p.b, q.a, q.b)) bad.push(k + ' and ' + m + ' bridges cross');
      });
    });
    add('crossings', bad, 'no two bridges cross');
    /* clearance: a bridge passes no other island's box + rim, and leaves Home's grid at once */
    bad = [];
    SKY.forEach(function (k) {
      var br = bridge(k);
      if (segmentHitsBox(br.a, br.b, { x0: X0, x1: X0 + COLS, z0: Z0, z1: Z0 + ROWS })) bad.push(k + ' bridge crosses Home’s grid');
      SKY.forEach(function (m) {
        if (m !== k && segmentHitsBox(br.a, br.b, padded(ISLE_LAYOUT[m].bounds, frame(m).pad))) bad.push(k + ' bridge passes over ' + m);
      });
    });
    add('clearance', bad, 'bridges clear every other island and its rim');
    /* gaps: never narrower than the world-model table; the nearest pairs differ in height */
    bad = [];
    SKY.forEach(function (k, i) {
      SKY.slice(i + 1).forEach(function (m) {
        var gap = boxGap(ISLE_LAYOUT[k].bounds, ISLE_LAYOUT[m].bounds), want = GAPS[k + '-' + m];
        if (gap < want - LAYOUT_RULE.tol) bad.push(k + '–' + m + ' gap ' + gap.toFixed(2) + ' < ' + want);
        if (gap < LAYOUT_RULE.nearGap && Math.abs(frame(k).top - frame(m).top) < LAYOUT_RULE.nearRise) bad.push(k + '–' + m + ' are near and level');
      });
    });
    add('gaps', bad, 'gaps ≥ the world-model table; near pairs differ ≥ 0.5 u in height');
    /* the rule side (SLWorldCore.ISLES): sizes, cells, docks and landmark spots */
    var I = core && core.ISLES;
    if (!I) {
      ['sizes', 'cells', 'docks', 'landmarks'].forEach(function (n) { out.push({ name: n, ok: false, detail: 'needs SLWorldCore.ISLES' }); });
      return out;
    }
    var sizes = [], cells = [], docks = [], marks = [];
    SKY.forEach(function (k) {
      var R = I[k], F = frame(k);
      if (!R) { sizes.push(k + ' has no rule entry'); return; }
      if (!R.size || R.size[0] !== F.cols || R.size[1] !== F.rows) sizes.push(k + ' size ' + R.size + ' vs box ' + F.cols + ' × ' + F.rows);
      var land = isleCells(k);
      Object.keys(land).forEach(function (ck) { var p = parseKey(ck); if (!F.inGrid(p.c, p.r)) cells.push(k + ' cell ' + ck + ' outside its box'); });
      /* docks: the bridge lands on the middle of the dock cells' outer edge, which faces open sky */
      var dk = R.dock || [], step = { w: [-1, 0], e: [1, 0], n: [0, -1], s: [0, 1] }[R.dockSide], sx = 0, sz = 0;
      if (!dk.length || !step) docks.push(k + ' has no dock');
      else {
        dk.forEach(function (d) {
          var ctr = F.cellCenter(d[0], d[1]);
          if (!land[key(d[0], d[1])]) docks.push(k + ' dock ' + d + ' is not land');
          if (land[key(d[0] + step[0], d[1] + step[1])]) docks.push(k + ' dock ' + d + ' is not on the ' + R.dockSide + ' edge');
          sx += ctr.x + step[0] * 0.5; sz += ctr.z + step[1] * 0.5;
        });
        var e = ISLE_LAYOUT[k].dockEdge;
        if (!near2(sx / dk.length, e[0], 1e-9) || !near2(sz / dk.length, e[2], 1e-9) || e[1] !== F.top) docks.push(k + ' dockEdge ' + e + ' is not the dock’s outer edge');
        if (ISLE_LAYOUT[k].bridge.width !== dk.length) docks.push(k + ' bridge width ' + ISLE_LAYOUT[k].bridge.width + ' vs ' + dk.length + ' dock cells');
      }
      /* the landmark's footprint at its spot is all land, inside the island's box */
      var it = core.item && R.landmark ? core.item(R.landmark) : null, sp = R.landmarkSpot;
      if (!it || !sp) marks.push(k + ' landmark ' + R.landmark + ' is not in the catalogue');
      else cellsOf(R.landmark, sp[0], sp[1]).forEach(function (p) { if (!land[key(p.c, p.r)]) marks.push(k + ' landmark cell ' + key(p.c, p.r) + ' is not land'); });
    });
    add('sizes', sizes, 'every box matches its rule size');
    add('cells', cells, 'every land cell lies inside its island’s box');
    add('docks', docks, 'every dockEdge is its dock cells’ outer edge');
    add('landmarks', marks, 'every landmark spot is land');
    return out;
  }

  var V3 = Object.freeze({
    SEA_Y: -0.75, SAND_Y: -0.5, SAND_REACH: 0.3, SLAB_B: -2.0, STRATA_TOP: -2.25, TERRACE: V3_TERRACE,
    ITEM_MAX_H: ITEM_MAX_H, ISLAND_ITEM_MAX_H: 5.5, SLAB_M: 1.75, TREETOP_PAD: 0.9,
    surfaceY: v3SurfaceY, frame: frame, bridge: bridge, gate: gate, layoutChecks: layoutChecks
  });

  return {
    COLS: COLS, ROWS: ROWS, X0: X0, Z0: Z0, SEA_Y: SEA_Y, GRASS_Y: GRASS_Y, GRASS_DEPTH: GRASS_DEPTH,
    SAND_Y: SAND_Y, SAND_REACH: SAND_REACH, MARGIN: MARGIN, FIT: FIT, CANOPY: CANOPY, TERRACE: TERRACE,
    MAX_TOP: MAX_TOP, ITEM_MAX_H: ITEM_MAX_H, MIN_HIT: MIN_HIT, PET_HIT_R: PET_HIT_R, TAP: TAP, FIELD: FIELD, RISE: RISE,
    key: key, parseKey: parseKey, inGrid: inGrid, clampCell: clampCell, regionOf: regionOf, landFrom: landFrom,
    surfaceY: surfaceY, cellTop: cellTop, cellCenter: cellCenter, worldToCell: worldToCell,
    footprint: footprint, cellsOf: cellsOf, baseY: baseY, pivot: pivot, plinth: plinth, placement: placement,
    hitSize: hitSize, hitBox: hitBox, landBounds: landBounds, regionBounds: regionBounds,
    basis: basis, cameraPosition: cameraPosition, fitCamera: fitCamera, project: project, rayFromCamera: rayFromCamera,
    rayPlane: rayPlane, rayToCell: rayToCell,
    bakeField: bakeField, sampleField: sampleField, packField: packField, lockedRegionAt: lockedRegionAt,
    hash: hash, hash01: hash01, rng: rng, jitter: jitter, tufts: tufts, coveDeco: coveDeco, wildflowers: wildflowers,
    pathNetworks: pathNetworks, riseOrder: riseOrder, signAnchor: signAnchor, avatarSpot: avatarSpot,
    ISLE_LAYOUT: ISLE_LAYOUT, V3: V3
  };
}));
