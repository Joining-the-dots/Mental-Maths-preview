/* ================================================================
   My Island v3 — SLIslesGL: the island meshes of the sky world (W3.4).
   window.SLIslesGL (classic script; THREE from SL3D.THREE / K.THREE only). require() in Node gives
   the same object: its pure helpers run without THREE, create() runs on tests/helpers/mini-three.
   Every voxel comes from SLIsles3D (pure bakes) and goes on screen through K.vox, so every mesh
   here is an InstancedMesh(1) with instanceColor on the one 'vox' program (D61), frustum-culled
   by its real bounding sphere. Islands never move. Nothing here reads, awards or spends points.

   ON SCREEN (one draw call each)
     an unlocked island   its terrain: FINE (0.5 u voxels, contact AO, 4 × 4-cell top chunks) or
                          COARSE (1 u); until the scene's own bake of that land is in, a STAND-IN
                          (coarse terrain + the landmark's LOD1 at full colour: a 'preview' clone
                          with uDesat 0 / uHaze 0 — same program, same call; D70)
     a locked land        its PREVIEW (coarse terrain, baked water, landmark LOD1, the lock sign) on
                          its own clone of the 'preview' variant (uDesat 0.30, uHaze 0.25 → 0.35 at
                          night; D4). A `pending` land stays a preview until wakeIsle.
     the built bridges    ONE mesh. A locked land's Home gate (posts, rope, padlock, three cloud
                          stepping stones) is baked into Home's terrain (D56) and goes when its
                          bridge starts to build.
   FINE OR COARSE (D42): fine for the visited island and Home; any other unlocked land is fine
   only while the islands at rest are kept live (SL3D.quality.isles: false on LOW and after the
   ladder's 'isles' step, where their items are LOD1 bakes) and its centre is ≤ 45 u from the
   camera (back to fine under 44 u); everything is coarse in the Sky map. setTerrain(isle, mode)
   overrides one island. At most FINE_CAP fine terrains stay alive (LOW 2 / MID 4 / HIGH 6).
   COLD MOUNT (D70): the first build is the cheap set only — coarse terrain or stand-in per
   unlocked island and one preview per locked land. The bridges and the fine terrain then bake in
   slices of ≤ 6 ms of REAL time per update() (performance.now(); bridges first, then the visited
   island, then Home) and swap in when ready; a stale fine mesh stays up until its replacement
   lands. One unit of work is one SLIsles3D call (an island's column map, its terrain models, a
   part of its static mesh, a top chunk, a bridge's model, its mesh: 4 ms at most on a desktop). A
   slice takes another unit only while one more of the last unit's cost still fits in the 6 ms;
   info().slice {ms, units, max} is the lab's log. The first build waits for setLand AND setIsles
   (else the end of the task, or the first update), so a mount never bakes twice.
   CONTACT AO (D39, D70): setLayout(isle, footprints) re-meshes only the top chunks a CHANGED
   footprint (± 1 voxel) touches, 150 ms after the last change. Paths cast no shade.

   API
     create(K, SL3D, {scene, tier, reduced, seed, sound(name, vol, step, pan), fx(kind, pos, n)}) →
       group
       setLand(unlockedRegions) · setSeed(seed) (Home's coast, a new child)
       riseRegion(region) → Promise (also a v2-shaped handle: .region .cells [{c, r, key, x, y, z,
         delay}] .dur .cancel()) — adds the region; its new columns rise from 1 u below in
         ≤ 5 bands (LOW 3) over the old ground. Reduced motion, or no fine Home on screen: at once.
       setIsles(unlockedIsles, {pending}) · wakeIsle(isle) → Promise (preview → terrain; MID / HIGH
         ease the preview to full colour first) · ready(isle) (the scene's bake of that land is in:
         drop its stand-in; a visited island drops it by itself, and a scene that never calls
         ready() loses every stand-in after 4 s)
       buildBridge(isle) → Promise (.dur, .cues) — one cube per bridge box, scaled in by
         SLMotion.bridgeBuild, then baked into the bridges mesh; its cues ('unlock', rising 'coin's,
         'tada', and under reduced motion one sparkle) go to the sound / fx hooks. While it builds,
         a visited land bakes its fine terrain behind its preview, so wakeIsle has no wait.
       peek(isle, on) (MID / HIGH: uDesat → 0.10, uHaze → 0 over 0.6 s; LOW: static)
       setVisit(isle) · setSkyMap(on) · setCamera(pos) · setTerrain(isle, 'fine' | 'coarse' | null)
       setLayout(isle, footprints [{x, y, w, h, path}]) · setShow(k) · setReduced(on) · setQuality(q)
       heightAt(x, z) (land, Home's gate pads, a built bridge's deck, else that island's water: the
         walk Home → pad → bridge → dock has no step) · lockedAt(x, z) → 'cove' | 'meadow' | null
       pick(origin, dir) → {kind 'bridge' | 'isle' | 'gate', isle, t, x, y, z} | null — the nearest
         of: each built bridge's box, each locked gate (pad, posts, stepping stones) and each
         island's box (slab outline; from the cake's tip to its tallest item, the visited island's
         only to its ground, so its own items and cells stay the scene's). The visited island is
         returned too: the tap router skips it.
       signAnchor(isle, 'gate' | 'dock' | 'map') → {x, y, z} | null · regionSign(region) → {x, y, z}
       hooks({sound, fx}) · update(dt, t, ctx {camera, show, visit}) → busy · info() → {meshes, calls,
         tris, isles {isle: {state, want, tris, baking}}, bridges, jobs, ao, slice} · dispose()
       Every promise also settles on a timer when frames are paused (the host's own fallbacks stay
       authoritative), and resolves false when its land goes or the module is disposed.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIslesGL = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var SKY = ['pier', 'jungle', 'treetop', 'castle', 'ice'], ISLES = ['home'].concat(SKY), KEYS = ['position', 'normal', 'color', 'vuv'];
  var SLICE_MS = 6, AO_WAIT = 0.15, FAR = 45, NEAR = 44, RISE_DROP = 1, STANDIN_SEC = 4;
  var FINE_CAP = { LOW: 2, MID: 4, HIGH: 6 };                       /* fine terrains kept alive (GPU + arrays) */
  var PREVIEW = { desat: 0.30, haze: 0.25, hazeNight: 0.35, peekDesat: 0.10, peekSec: 0.6 };
  var SIGN_Y = { gate: 1.75, dock: 1.125, map: 0.6 };              /* above the pad, the island top, its tallest item */
  /* pick boxes in a bridge's own frame [x0, y0, z0, x1, y1, z1]: x from the Home gate along the bridge, z across it (± the half width) */
  var BRIDGE_BOX = [-0.3, -1, -0.3, 0.3, 1.6, 0.3], GATE_BOX = [-1, -1.2, -0.95, 3.4, 1.8, 0.95];
  var PAD = 0.3, WOBBLE = 0.25;                                     /* SLIsles3D's beach pad and coast wobble (the treetop's box) */

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path, optional) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (!m) { if (optional) return null; throw new Error('SLIslesGL: ' + name + ' is not loaded'); }
    return (sibs[name] = m);
  }

  /* ================================================================
     PURE HELPERS (Node-testable)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function parseTier(t) { var u = typeof t === 'string' ? t.toUpperCase() : ''; return u === 'LOW' || u === 'MID' || u === 'HIGH' ? u : null; }
  /* an id, a list of ids or a {id: true} map → {id: 1} */
  function toSet(v) {
    var out = {};
    if (typeof v === 'string') out[v] = 1;
    else if (Array.isArray(v)) v.forEach(function (k) { if (typeof k === 'string') out[k] = 1; });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (v[k]) out[k] = 1; });
    return out;
  }
  /* footprints [{x, y, w, h, path}] or [[x, y, w, h, path]] → plain copies, each with its key */
  function normFps(list) {
    return (Array.isArray(list) ? list : []).filter(function (f) { return f && typeof f === 'object'; }).map(function (f) {
      var a = Array.isArray(f), o = { x: +(a ? f[0] : f.x) || 0, y: +(a ? f[1] : f.y) || 0, w: +(a ? f[2] : f.w) || 1, h: +(a ? f[3] : f.h) || 1, path: !!(a ? f[4] : f.path) };
      o.key = o.x + ',' + o.y + ',' + o.w + ',' + o.h + (o.path ? ',p' : '');
      return o;
    });
  }
  /* the footprints that came, went or changed between two normalised lists */
  function diffFps(a, b) {
    var ka = {}, kb = {};
    a.forEach(function (f) { ka[f.key] = 1; }); b.forEach(function (f) { kb[f.key] = 1; });
    return a.filter(function (f) { return !kb[f.key]; }).concat(b.filter(function (f) { return !ka[f.key]; }));
  }
  /* a ray against the box [x0, y0, z0, x1, y1, z1]: its entry t ≥ 0, or −1 */
  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    var o = [ox, oy, oz], d = [dx, dy, dz], t0 = 0, t1 = Infinity;
    for (var a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < b[a] || o[a] > b[a + 3]) return -1; continue; }
      var ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
      if (ta > tb) { var w = ta; ta = tb; tb = w; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return -1;
    }
    return t0;
  }
  /* a bridge's frame from SLGrid3D.V3.bridge(isle): its origin (the Home gate, lifted as SLIsles3D lifts the
     deck), the unit vector u along it (x, z), its rise and its pick box */
  function bridgeFrame(B, lift) {
    return { ax: B.a.x, ay: B.a.y + (lift || 0), az: B.a.z, ux: (B.b.x - B.a.x) / B.length, uz: (B.b.z - B.a.z) / B.length, length: B.length, rise: B.rise,
      width: B.width, deck: null,
      box: [BRIDGE_BOX[0], BRIDGE_BOX[1], -B.width / 2 + BRIDGE_BOX[2], B.length + BRIDGE_BOX[3], BRIDGE_BOX[4], B.width / 2 + BRIDGE_BOX[5]] };
  }
  /* the deck's top (u above the bridge's origin) every 0.125 u along it, from SLIsles3D.bridge(isle)'s build boxes */
  function deckTops(br) {
    var n = Math.max(1, Math.ceil(br.length / 0.125)), deck = new Float32Array(n).fill(NaN), i;
    br.segments.forEach(function (s) {
      s.voxels.forEach(function (v) {
        if (Math.abs(v[2]) > 1e-6 || v[5] < br.width - 1e-6) return;          /* the deck spans the full width; rails and posts do not */
        var top = v[1] + v[4] / 2;
        for (i = Math.max(0, Math.floor((v[0] - v[3] / 2) / 0.125 + 1e-6)); i < n && (i + 0.5) * 0.125 < v[0] + v[3] / 2; i++) if (!(deck[i] >= top)) deck[i] = top;
      });
    });
    for (i = 0; i < n; i++) if (deck[i] !== deck[i]) deck[i] = i ? deck[i - 1] : 0;      /* a slat gap takes the slat before it */
    return deck;
  }
  /* world (x, z) → the bridge's (along, across) */
  function alongOf(f, x, z) { return (x - f.ax) * f.ux + (z - f.az) * f.uz; }
  function acrossOf(f, x, z) { return -(x - f.ax) * f.uz + (z - f.az) * f.ux; }
  /* a ray against a box in the bridge's frame; shear: the box follows the bridge's slope */
  function rayFrame(f, ox, oy, oz, dx, dy, dz, box, shear) {
    var k = shear ? f.rise / f.length : 0, lx = alongOf(f, ox, oz), ldx = dx * f.ux + dz * f.uz;
    return rayBox(lx, oy - f.ay - k * lx, acrossOf(f, ox, oz), ldx, dy - k * ldx, -dx * f.uz + dz * f.ux, box);
  }
  /* the quads (6 vertices each) of the arrays in `list` that stand at or above yMin over a cell
     bandOf(x, z) names (−1: none), per band. A quad that spans two bands rises with the earlier
     one, so no top face is ever left behind a block that is already up. */
  function sliceBands(list, bandOf, n, yMin) {
    var idx = [], b, k;
    for (b = 0; b < n; b++) idx.push([]);
    list.forEach(function (a, ai) {
      var p = a.position, nm = a.normal;
      for (var i = 0; i + 18 <= p.length; i += 18) {
        var cx = 0, cy = 0, cz = 0, best = -1;
        for (k = 0; k < 18; k += 3) { cx += p[i + k] / 6; cy += p[i + k + 1] / 6; cz += p[i + k + 2] / 6; }
        if (cy < yMin) continue;
        for (k = 0; k < 18; k += 3) {            /* each corner, pulled into its own voxel (toward the middle, behind the face), names its cell */
          b = bandOf(p[i + k] + (cx - p[i + k]) * 0.02 - nm[i + k] * 0.01, p[i + k + 2] + (cz - p[i + k + 2]) * 0.02 - nm[i + k + 2] * 0.01);
          if (b >= 0 && (best < 0 || b < best)) best = b;
        }
        if (best >= 0 && best < n) idx[best].push(ai, i);
      }
    });
    return idx.map(function (ix) {
      var out = { quads: ix.length / 2, tris: ix.length };
      KEYS.forEach(function (key) {
        out[key] = new Float32Array(ix.length * 9);
        for (k = 0; k < ix.length; k += 2) out[key].set(list[ix[k]][key].subarray(ix[k + 1], ix[k + 1] + 18), k * 9);
      });
      return out;
    });
  }
  /* D42 for one unlocked island: 'fine' | 'coarse' (prev: what it draws now, for the 44 – 45 u band; dist < 0: no camera yet) */
  function modeOf(isle, visit, skyMap, rest, dist, prev, force) {
    if (force === 'fine' || force === 'coarse') return force;
    if (skyMap) return 'coarse';
    if (isle === visit || isle === 'home') return 'fine';
    if (!rest || !(dist >= 0)) return 'coarse';
    return dist > FAR ? 'coarse' : dist < NEAR ? 'fine' : prev || 'fine';
  }
  function terrainMode(o) { return modeOf(o.isle, o.visit, o.skyMap, o.rest, o.dist, o.prev, o.force); }
  /* a fine terrain's static model as smaller meshing units: its first `dense` layers one by one, the small
     pieces together. Its layers never hide each other's faces (their halo voxels stand in for the
     neighbours), so the units mesh to exactly the triangles of the whole model. */
  function splitModel(model, dense) {
    var n = Math.min(dense == null ? 3 : dense, model.layers.length), out = [];
    function sub(from, to) {
      var m = {}, k;
      for (k in model) m[k] = model[k];
      m.layers = model.layers.slice(from, to);
      m.decals = (model.decals || []).filter(function (d) { return d.layer >= from && d.layer < to; }).map(function (d) {
        var c = {};
        for (var q in d) c[q] = d[q];
        c.layer = d.layer - from;
        return c;
      });
      return m;
    }
    for (var i = 0; i < n; i++) out.push(sub(i, i + 1));
    if (model.layers.length > n) out.push(sub(n, model.layers.length));
    return out;
  }
  function deferred() {
    var d = { done: false, promise: null, resolve: null };
    d.promise = new Promise(function (res) { d.resolve = function (v) { if (!d.done) { d.done = true; res(v); } }; });
    return d;
  }

  /* ================================================================
     create(K, SL3D, opts)
     ================================================================ */
  function create(K, SL3D, opts) {
    opts = opts || {};
    var V = K && K.vox;
    if (!V || typeof V.terrainMesh !== 'function') throw new Error('SLIslesGL.create needs K.vox (SLVoxGL bound to the kit)');
    var T = (SL3D && SL3D.THREE) || K.THREE || opts.THREE;
    var S = sibling('SLIsles3D', './isles3d.js'), G = sibling('SLGrid3D', './grid3d.js'), C = sibling('SLWorldCore', '../world-core.js');
    var M = sibling('SLMotion', './motion.js'), L = sibling('SLIslandLook', '../world-look.js', true), Tier = sibling('SLTier', './tier.js', true);
    var tier = parseTier(opts.tier) || parseTier(K.tier) || 'MID', low = tier === 'LOW';
    var PV = (L && L.PREVIEW) || PREVIEW, V3 = G.V3;
    var shadows = !!(Tier && Tier.BUDGETS && Tier.BUDGETS[tier] ? Tier.BUDGETS[tier].shadows : !low);
    var now = typeof opts.now === 'function' ? opts.now
      : typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ? function () { return performance.now(); } : Date.now;
    var hook = { sound: typeof opts.sound === 'function' ? opts.sound : null, fx: typeof opts.fx === 'function' ? opts.fx : null };
    function warn(msg) { if (typeof K.warn === 'function') K.warn('[isles-gl] ' + msg); }

    var group = new T.Group();
    group.name = 'isles';
    var st = { reduced: !!opts.reduced, seed: opts.seed == null ? '' : opts.seed, land: null, landSig: null, regions: [], visit: 'home', skyMap: false,
      cam: null, show: 0, rest: SL3D && SL3D.quality ? SL3D.quality.isles !== false : !low, cold: false, gotLand: false, gotIsles: false,
      soon: false, hosted: false, disposed: false, tick: 0 };
    var isles = {}, built = {}, builds = {}, frames = {}, bridgeArr = {}, bridgeJob = {}, bridgeMesh = null, bridgeSig = '';
    var queue = [], timers = [], rise = null, standMat = null, atlas = null, slabs = {}, pads = {};
    var ao = { chunks: 0, ms: 0, runs: 0 }, slice = { ms: 0, units: 0, max: 0 }, _lr = {};
    function cellOf(name) { atlas = atlas || V.atlas(); return atlas.cell(name) || atlas.cell('none'); }
    var mo = { tier: tier, cellOf: cellOf };                      /* SLIsles3D.mesh options: the tier's detail, decals from the atlas */

    ISLES.forEach(function (isle) {
      var F = V3.frame(isle);
      isles[isle] = { isle: isle, F: F, at: [F.cx, F.cy, F.cz], cells: toSet(C.ISLE_CELLS[isle]), state: isle === 'home' ? 'open' : 'preview', hold: false, holdT: 0, want: null, force: null,
        lru: 0, coarse: null, fine: null, job: null, mesh: null, coarseMesh: null, fineMesh: null, standMesh: null, pvMesh: null, pvMat: null,
        fps: [], dirty: null, aoWait: 0, peekTo: 0, peekP: 0, wakeK: 0, waking: null };
    });
    var HOME = isles.home;
    SKY.forEach(function (isle) { frames[isle] = bridgeFrame(V3.bridge(isle), S.LIFT); });      /* cheap: no bridge is built for its frame */

    function later(fn, ms) {
      var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); if (!st.disposed) fn(); }, ms);
      if (id && typeof id.unref === 'function') id.unref();
      timers.push(id);
    }
    function free(mesh) {
      if (!mesh) return null;
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
      if (typeof mesh.dispose === 'function') mesh.dispose();
      return null;
    }
    function fire(cue, x, y, z) {
      try {
        if (cue.sfx && hook.sound) hook.sound(cue.sfx, cue.vol == null ? 1 : cue.vol, cue.step, Math.max(-1, Math.min(1, x / 10)));
        if (cue.emit && hook.fx) hook.fx(cue.emit, { x: x, y: y, z: z }, cue.n);
      } catch (e) { warn('cue ' + (cue.sfx || cue.emit) + ': ' + (e && e.message || e)); }
    }

    /* ---------------- what each island needs ---------------- */
    /* the lands whose Home gate is still locked: no bridge built, none building */
    function lockedLands() { return SKY.filter(function (isle) { return !built[isle] && !builds[isle]; }); }
    function terrainOpts(rec, lod) {
      var o = { lod: lod };
      if (rec === HOME) { o.regions = st.land || undefined; o.lockedLands = lockedLands(); o.seed = st.seed; }
      if (!lod) o.footprints = rec.fps;
      return o;
    }
    function fineSig(rec) { return rec === HOME ? st.landSig + '|' + lockedLands().join(',') + '|' + st.seed : rec.isle; }
    function wantOf(rec) {
      var c = st.cam, d = c ? Math.sqrt((c[0] - rec.at[0]) * (c[0] - rec.at[0]) + (c[1] - rec.at[1]) * (c[1] - rec.at[1]) + (c[2] - rec.at[2]) * (c[2] - rec.at[2])) : -1;
      return modeOf(rec.isle, st.visit, st.skyMap, st.rest, d, rec.want, rec.force);
    }
    /* the landmark's voxels (px-landmarks, W3.1; feature-detected): its own LOD1 when it brings one */
    function landmarkOf(isle) {
      var id = C.ISLES[isle] && C.ISLES[isle].landmark, reg = SL3D && SL3D.vox && SL3D.vox.models, h = reg && id ? reg[id] : null, m = null;
      if (!h) return null;
      try { m = typeof h.lod1 === 'function' ? h.lod1({}) : typeof h.voxels === 'function' ? h.voxels({}, { tier: tier, lod: 1 }) : null; }
      catch (e) { warn('landmark ' + id + ': ' + (e && e.message || e)); m = null; }
      return m && Array.isArray(m.layers) ? m : null;
    }
    function coarseOf(rec) {
      if (!rec.coarse) rec.coarse = S.mesh(S.terrain(rec.isle, terrainOpts(rec, 1)).model, mo);
      return rec.coarse;
    }
    function place(rec, mesh, kind) {
      mesh.name = 'isles:' + kind + ':' + rec.isle; mesh.userData.isle = rec.isle; mesh.userData.kind = kind;
      mesh.position.set(rec.at[0], rec.at[1], rec.at[2]);
      mesh.visible = false;
      group.add(mesh);
      return mesh;
    }
    function makeCoarse(rec) { return place(rec, V.terrainMesh(coarseOf(rec), { castShadow: false }), 'coarse'); }
    function makeStandIn(rec) {
      var list = [{ arrays: coarseOf(rec) }], lm = rec === HOME ? null : landmarkOf(rec.isle), R = C.ISLES[rec.isle];
      if (lm && R.landmarkSpot) {
        var fp = (C.item(R.landmark) || {}).fp || [1, 1], sp = R.landmarkSpot;
        list.push({ arrays: S.mesh(lm.lodLevel >= 1 ? lm : V.lod(lm, 1), { tier: tier, cellOf: cellOf, cull: ['-y'] }),
          matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, sp[0] + fp[0] / 2 - rec.F.cols / 2, 0, sp[1] + fp[1] / 2 - rec.F.rows / 2, 1] });
      }
      standMat = standMat || V.cloneMat(V.variant('preview'), { desat: 0, haze: 0 });
      return place(rec, V.bakeStatic(list, { material: standMat, castShadow: false }), 'standin');
    }
    function makePreview(rec) {
      rec.pvMat = rec.pvMat || V.cloneMat(V.variant('preview'));
      var mesh = place(rec, V.terrainMesh(S.mesh(S.preview(rec.isle, landmarkOf(rec.isle)), mo), { material: rec.pvMat, castShadow: false }), 'preview');
      applyPreview(rec);
      return mesh;
    }
    function applyPreview(rec) {
      if (!rec.pvMat) return;
      var u = V.matUniforms(rec.pvMat), pk = smooth(rec.peekP), keep = 1 - rec.wakeK;
      u.uDesat.value = lerp(PV.desat, PV.peekDesat, pk) * keep;
      u.uHaze.value = lerp(PV.haze, PV.hazeNight, st.show) * (1 - pk) * keep;
    }
    function fineMeshOf(rec) {
      var f = rec.fine, arrays = S.concat(f.bases.concat(f.keys.map(function (k) { return f.chunks[k]; })));
      var mesh = place(rec, V.terrainMesh(arrays, { castShadow: shadows }), 'fine');
      mesh.visible = !!rec.fineMesh && rec.fineMesh.visible;
      free(rec.fineMesh);
      rec.fineMesh = mesh;
      if (mesh.visible) rec.mesh = mesh;
    }

    /* ---------------- the job queue: fine terrain and bridges, in real-time slices ---------------- */
    function cancel(job) {
      var i = queue.indexOf(job);
      if (i >= 0) queue.splice(i, 1);
      if (job.rec) job.rec.job = null; else delete bridgeJob[job.bridge];
    }
    function ensureFine(rec) {
      var sig = fineSig(rec);
      rec.lru = ++st.tick;
      if ((rec.fine && rec.fine.sig === sig) || (rec.job && rec.job.sig === sig)) return;
      if (rec.job) cancel(rec.job);
      queue.push(rec.job = { rec: rec, sig: sig, regions: null, step: 0, o: null, t: null, parts: null, bases: [], chunks: {}, keys: [], i: 0 });
    }
    /* bridges first (a land with no bridge reads as broken), then where the child is, then Home, then the rest */
    function rank(job) { return !job.rec ? 0 : job.rec.isle === st.visit || job.rec.waking ? 1 : job.rec === HOME ? 2 : 3; }
    /* one unit of work — one SLIsles3D call; true when the job is done. A fine bake: the island's column map
       (a top chunk asks for it), the terrain models, the static rest in a few parts, then each top chunk. */
    function stepJob(job) {
      var rec = job.rec;
      if (!rec) {
        if (!job.step) { S.bridge(job.bridge); job.step = 1; return false; }
        bridgeArr[job.bridge] = S.mesh(S.bridge(job.bridge).model, mo); delete bridgeJob[job.bridge];
        rebuildBridges();
        return true;
      }
      if (job.step === 0) {            /* the bake takes the land and the footprints of the moment it starts */
        job.regions = st.regions.slice(); job.o = terrainOpts(rec, 0); rec.dirty = null;
        S.topChunk(rec.isle, S.chunkKeys(rec.isle, [C.ISLES[rec.isle].centre])[0], job.o);
        job.step = 1;
      } else if (job.step === 1) { job.t = S.terrain(rec.isle, job.o); job.parts = splitModel(job.t.model); job.step = 2; }
      else if (job.bases.length < job.parts.length) job.bases.push(S.mesh(job.parts[job.bases.length], mo));
      else if (job.i < job.t.topChunks.length) {
        var c = job.t.topChunks[job.i++];
        job.chunks[c.key] = S.mesh(c.model, mo); job.keys.push(c.key);
      } else {
        rec.job = null;
        landFine(rec, { sig: job.sig, regions: job.regions, bases: job.bases, chunks: job.chunks, keys: job.keys });
        return true;
      }
      return false;
    }
    /* this frame's slice: units of work while the next one (taken to cost what the last did) still fits in 6 ms */
    function runJobs() {
      var t0 = now(), t = t0, last = 0, units = 0;
      do {
        var job = queue[0];
        for (var i = 1; i < queue.length; i++) if (rank(queue[i]) < rank(job)) job = queue[i];
        try { if (stepJob(job)) { i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); } }
        catch (e) { cancel(job); warn('bake ' + (job.bridge || job.rec.isle) + ': ' + (e && e.message || e)); }      /* never the same throw every frame */
        units++;
        last = now() - t; t += last;
      } while (queue.length && t - t0 + last <= SLICE_MS);
      slice.ms = t - t0; slice.units = units;
      if (slice.ms > slice.max) slice.max = slice.ms;
    }
    function landFine(rec, data) {
      if (rec === HOME && rise && rise.wait) {
        if (rise.bands) beginRise(data); else { rise.wait = false; rise.next = data; finishRise(); }       /* no bands: the land is there at once */
        return;
      }
      rec.fine = data;
      fineMeshOf(rec);
      refresh(rec);
      trim();
    }
    /* keep at most FINE_CAP fine terrains: the ones not wanted go, the longest unused first */
    function trim() {
      var have = ISLES.map(function (i) { return isles[i]; }).filter(function (r) { return r.fineMesh; });
      have.filter(function (r) { return r.want !== 'fine' && !r.waking; }).sort(function (a, b) { return a.lru - b.lru; })
        .slice(0, Math.max(0, have.length - FINE_CAP[tier])).forEach(dropFine);
    }
    function dropFine(rec) {
      if (rec.job) cancel(rec.job);
      if (rec.mesh === rec.fineMesh) rec.mesh = null;
      rec.fineMesh = free(rec.fineMesh); rec.fine = null;
    }
    function dropCoarse(rec) {
      if (rec.mesh === rec.coarseMesh || rec.mesh === rec.standMesh) rec.mesh = null;
      rec.coarseMesh = free(rec.coarseMesh); rec.standMesh = free(rec.standMesh); rec.coarse = null;
    }

    /* ---------------- which mesh an island shows ---------------- */
    function show(rec, mesh) {
      [rec.pvMesh, rec.standMesh, rec.coarseMesh, rec.fineMesh].forEach(function (m) { if (m) m.visible = m === mesh; });
      rec.mesh = mesh;
    }
    function refresh(rec) {
      if (st.disposed) return;
      if (rec.state !== 'open') {
        if ((rec.waking || builds[rec.isle]) && wantOf(rec) === 'fine') ensureFine(rec);      /* bake behind the preview: it wakes without a wait */
        show(rec, rec.pvMesh || (rec.pvMesh = makePreview(rec)));
        return;
      }
      var want = rec.want = wantOf(rec);
      if (rec.hold && rec.isle === st.visit) rec.hold = false;               /* the island the child is on goes live */
      if (!rec.hold) rec.standMesh = free(rec.standMesh);
      if (want === 'fine') ensureFine(rec);
      else if (rec.job) cancel(rec.job);
      if (rec.hold) show(rec, rec.standMesh || (rec.standMesh = makeStandIn(rec)));
      else if (want === 'fine' && rec.fineMesh) show(rec, rec.fineMesh);
      else show(rec, rec.coarseMesh || (rec.coarseMesh = makeCoarse(rec)));
    }
    function touch(rec) { if (st.cold) refresh(rec); }
    /* a new visit, camera, Sky map or quality: re-decide fine / coarse (every frame of a flight: no allocation) */
    function retarget() {
      if (!st.cold) return;
      for (var i = 0; i < ISLES.length; i++) { var r = isles[ISLES[i]]; if (r.state === 'open' && wantOf(r) !== r.want) refresh(r); }
    }
    /* the cold build: every island's cheap mesh, once (D70) */
    function sync() {
      if (st.cold || st.disposed) return;
      st.cold = true;
      if (!st.land) applyLand(null);
      ISLES.forEach(function (i) { refresh(isles[i]); });
      rebuildBridges();
    }
    /* setLand and setIsles come as a pair at mount: build once both are in, or at the end of this task when only one came */
    function paired() {
      if (st.gotLand && st.gotIsles) sync();
      else if (!st.cold && !st.soon) { st.soon = true; Promise.resolve().then(sync); }
    }
    function open(rec, standIn) {
      rec.state = 'open'; rec.hold = !!standIn && rec.isle !== st.visit; rec.holdT = 0; rec.waking = null; rec.wakeK = 0; rec.peekTo = rec.peekP = 0;
      if (rec.mesh === rec.pvMesh) rec.mesh = null;
      rec.pvMesh = free(rec.pvMesh);
      if (rec.pvMat) { rec.pvMat.dispose(); rec.pvMat = null; }
      touch(rec);
    }
    function close(rec) {
      if (rec.waking) rec.waking.resolve(false);
      rec.state = 'preview'; rec.hold = false; rec.waking = null; rec.wakeK = 0; rec.want = null;
      dropFine(rec); dropCoarse(rec);
      touch(rec);
    }

    /* ---------------- bridges: one mesh for every built one ---------------- */
    function rebuildBridges() {
      if (!st.cold || st.disposed) return;
      var list = [], names = [];
      SKY.forEach(function (isle) {
        if (!built[isle]) return;
        if (bridgeArr[isle]) { list.push({ arrays: bridgeArr[isle], matrix: S.bridge(isle).matrix }); names.push(isle); }
        else if (!bridgeJob[isle]) queue.push(bridgeJob[isle] = { bridge: isle });
      });
      if (names.join(',') === bridgeSig) return;
      bridgeSig = names.join(',');
      bridgeMesh = free(bridgeMesh);
      if (!list.length) return;
      bridgeMesh = V.bakeStatic(list, { name: 'isles:bridges', castShadow: shadows });
      bridgeMesh.userData.kind = 'bridges';
      group.add(bridgeMesh);
    }
    function setBuilt(isle, on) {
      if (!!built[isle] === !!on) return;
      if (on) built[isle] = 1; else delete built[isle];
      rebuildBridges();
      touch(HOME);                                                           /* Home re-bakes with or without that gate (D56) */
    }
    /* write one segment's cubes at scale s: the bridge's yaw, each box's own size */
    function writeSegment(b, seg, s) {
      var a = b.pool.mesh.instanceMatrix.array, f = b.frame, list = b.segs[seg];
      for (var q = 0; q < list.length; q++) {
        var v = list[q].v, o = list[q].k * 16;
        a[o] = f.ux * v[3] * s; a[o + 1] = 0; a[o + 2] = f.uz * v[3] * s; a[o + 3] = 0;
        a[o + 4] = 0; a[o + 5] = v[4] * s; a[o + 6] = 0; a[o + 7] = 0;
        a[o + 8] = -f.uz * v[5] * s; a[o + 9] = 0; a[o + 10] = f.ux * v[5] * s; a[o + 11] = 0;
        a[o + 12] = f.ax + f.ux * v[0] - f.uz * v[2]; a[o + 13] = f.ay + v[1]; a[o + 14] = f.az + f.uz * v[0] + f.ux * v[2]; a[o + 15] = 1;
      }
      b.last[seg] = s;
      b.pool.touch();
    }
    function stepBuild(b, dt) {
      b.t += dt;
      M.bridgeBuild(b.t, b.frame.length, false, b.bb);
      for (var i = 0; i < b.segs.length; i++) { var s = b.bb.scaleAt(i); if (s !== b.last[i]) writeSegment(b, i, s); }
      b.pool.commit();
      while (b.ci < b.cues.length && b.cues[b.ci].t <= b.t) {
        var u = b.bb.total > 0 ? Math.min(1, b.cues[b.ci].t / b.bb.total) * b.frame.length : 0;
        fire(b.cues[b.ci++], b.frame.ax + b.frame.ux * u, b.frame.ay + b.frame.rise * u / b.frame.length + 0.5, b.frame.az + b.frame.uz * u);
      }
      if (b.bb.done) endBuild(b);
    }
    function endBuild(b) {
      if (builds[b.isle] !== b) return;
      while (b.ci < b.cues.length) fire(b.cues[b.ci++], b.frame.ax, b.frame.ay + 0.5, b.frame.az);
      delete builds[b.isle];
      if (b.pool) b.pool.dispose();
      if (!bridgeArr[b.isle]) { if (bridgeJob[b.isle]) cancel(bridgeJob[b.isle]); bridgeArr[b.isle] = S.mesh(S.bridge(b.isle).model, mo); }
      setBuilt(b.isle, true);
      b.d.resolve(true);
    }
    function abortBuild(isle) {
      var b = builds[isle];
      if (!b) return;
      delete builds[isle];
      if (b.pool) b.pool.dispose();
      b.d.resolve(false);
    }
    function buildBridge(isle) {
      var br = SKY.indexOf(isle) >= 0 ? S.bridge(isle) : null, d = deferred();
      if (st.disposed || !br) { d.resolve(false); return d.promise; }
      if (builds[isle]) return builds[isle].d.promise;
      var bb = M.bridgeBuild(0, br.length, st.reduced), b = { isle: isle, d: d, frame: frames[isle], bb: bb, t: 0, cues: bb.cues(), ci: 0, pool: null, segs: [], last: [] };
      d.promise.dur = built[isle] ? 0 : bb.total; d.promise.cues = b.cues;
      if (built[isle]) { d.resolve(true); return d.promise; }
      sync();
      builds[isle] = b;
      if (st.reduced || bb.total <= 0) { endBuild(b); return d.promise; }      /* at once: the bridge, its sounds, one sparkle at the gate */
      var n = 0;
      br.segments.forEach(function (s) { n += s.voxels.length; });
      b.pool = V.instancedCubes(n, { mode: S.STYLE[isle].mode, size: 1, name: 'isles:build:' + isle });
      br.segments.forEach(function (s, i) {
        b.segs[i] = s.voxels.map(function (v) { var k = b.pool.alloc(); b.pool.tint(k, v[6]); return { k: k, v: v }; });
        b.last[i] = -1;
      });
      group.add(b.pool.mesh);
      if (!bridgeArr[isle] && !bridgeJob[isle]) queue.push(bridgeJob[isle] = { bridge: isle });      /* its baked mesh is ready before the last cube lands */
      touch(HOME);                                                           /* the gate's stepping stones lie on the bridge line: they go now */
      touch(isles[isle]);
      stepBuild(b, 0);
      later(function () { endBuild(b); }, (bb.total + 1.5) * 1000);          /* frames may be paused: never leave the promise open */
      return d.promise;
    }

    /* ---------------- land: Home's regions and the Meadow / Cove rise ---------------- */
    function applyLand(arg) {
      var land = G.landFrom(arg == null ? ['home'] : arg), sig = String(G.hash(Object.keys(land).sort().join(';')));
      if (sig === st.landSig) return false;
      st.land = land; st.landSig = sig;
      st.regions = Object.keys(C.REGION_CELLS).filter(function (r) { return C.REGION_CELLS[r].every(function (k) { return land[k]; }); });
      dropCoarse(HOME);
      return true;
    }
    function setLand(unlocked) {
      if (st.disposed) return;
      st.gotLand = true;
      if (rise && !(unlocked && G.landFrom(unlocked)[C.REGION_CELLS[rise.region][0]])) finishRise();
      if (applyLand(unlocked)) touch(HOME);
      paired();
    }
    function finishRise() {
      var r = rise;
      if (!r) return;
      rise = null;
      r.meshes.forEach(free);
      if (r.next) landFine(HOME, r.next);
      r.h.done = true;
      r.d.resolve(true);
    }
    /* Home's new terrain has landed: its region columns become the bands, the old ground stays up under them */
    function beginRise(data) {
      var band = {};
      rise.bands.forEach(function (b, i) { b.cells.forEach(function (c) { band[c.key] = i; }); });
      var parts = sliceBands(data.bases.concat(data.keys.map(function (k) { return data.chunks[k]; })),
        function (x, z) { var c = HOME.F.worldToCell(x, z), b = band[c.c + ',' + c.r]; return b == null ? -1 : b; }, rise.bands.length, -RISE_DROP - 1e-3);
      rise.meshes = parts.map(function (a, i) {
        if (!a.position.length) return null;
        var m = V.terrainMesh(a, { name: 'isles:rise:' + i, castShadow: false });
        m.position.y = -RISE_DROP; m.userData.kind = 'rise';
        group.add(m);
        return m;
      });
      rise.next = data; rise.wait = false; rise.t = 0;
    }
    function stepRise(dt) {
      var done = true;
      rise.t += dt;
      rise.meshes.forEach(function (m, i) {
        if (!m) return;
        M.landRise(rise.t, rise.bands[i].delay, false, _lr);
        m.position.y = -RISE_DROP * (1 - _lr.y01);
        if (rise.t < rise.bands[i].delay + M.RISE.each) done = false;
      });
      if (done) finishRise();
    }
    function riseRegion(region) {
      var cells = C.REGION_CELLS && C.REGION_CELLS[region], d = deferred(), h = d.promise;
      h.region = region; h.cells = []; h.dur = 0; h.done = false; h.promise = h;
      h.cancel = function () { if (rise && rise.h === h) finishRise(); };
      if (st.disposed || !cells || region === 'home') { h.done = true; d.resolve(false); return h; }
      finishRise();
      sync();
      var had = st.regions.indexOf(region) >= 0, before = {}, after = {};
      Object.keys(st.land).forEach(function (k) { after[k] = 1; if (C.CELL_REGION[k] !== region) before[k] = 1; });
      cells.forEach(function (k) { after[k] = 1; });
      /* the old ground must be on screen as fine terrain, without the region */
      var animate = !st.reduced && HOME.mesh === HOME.fineMesh && !!HOME.fine && HOME.fine.regions.indexOf(region) < 0;
      var bands = S.riseOrder(region, { tier: tier, land: before });
      bands.forEach(function (b) {
        b.cells.forEach(function (c) { var p = HOME.F.cellCenter(c.c, c.r); h.cells.push({ c: c.c, r: c.r, key: c.key, x: p.x, y: p.y, z: p.z, delay: animate ? b.delay : 0 }); });
      });
      h.dur = animate && bands.length ? bands[bands.length - 1].delay + M.RISE.each : M.SHOW_MIX_REDUCED_SEC;
      if (!had && applyLand(after)) touch(HOME);
      if (!HOME.job) { h.done = true; d.resolve(true); return h; }             /* nothing to bake (coarse Home, or the land was there): done */
      rise = { region: region, bands: animate ? bands : null, h: h, d: d, wait: true, t: 0, meshes: [], next: null };
      later(function () { if (rise && rise.h === h) finishRise(); }, (h.dur + 2.5) * 1000);
      return h;
    }

    /* ---------------- lands: locked, pending, open ---------------- */
    function setIsles(unlocked, o) {
      if (st.disposed) return;
      var on = toSet(unlocked), pend = toSet(o && o.pending);
      st.gotIsles = true;
      SKY.forEach(function (isle) {
        var rec = isles[isle];
        if (!on[isle]) {                                                     /* locked (again): the preview, no bridge, the gate back on Home */
          if (rec.state === 'open' || rec.waking) close(rec);
          abortBuild(isle);
          setBuilt(isle, false);
        } else if (rec.state !== 'open' && !rec.waking && !pend[isle]) open(rec, true);
        if (rec.state === 'open' && !builds[isle]) setBuilt(isle, true);      /* pending only keeps a preview: it never closes an open land */
      });
      paired();
    }
    function wakeIsle(isle) {
      var rec = SKY.indexOf(isle) >= 0 ? isles[isle] : null, d = deferred();
      if (st.disposed || !rec) { d.resolve(false); return d.promise; }
      if (rec.state === 'open') { d.resolve(true); return d.promise; }
      if (rec.waking) return rec.waking.promise;
      sync();
      if (!builds[isle]) setBuilt(isle, true);
      if (st.reduced) { open(rec, false); d.resolve(true); return d.promise; }
      rec.waking = d; d.t = 0;
      refresh(rec);
      later(function () { if (rec.waking === d) { open(rec, false); d.resolve(true); } }, (PV.peekSec + 2.5) * 1000);
      return d.promise;
    }
    function stepWake(rec, dt) {
      var d = rec.waking;
      d.t += dt;
      rec.wakeK = low ? 0 : smooth(d.t / PV.peekSec);                       /* MID / HIGH: the colour floods in */
      applyPreview(rec);
      if ((low || d.t >= PV.peekSec) && !rec.job) { open(rec, false); d.resolve(true); }
    }
    function ready(isle) {
      var rec = isles[isle];
      st.hosted = true;
      if (rec && rec.hold) { rec.hold = false; touch(rec); }
    }
    function peek(isle, on) {
      var rec = SKY.indexOf(isle) >= 0 ? isles[isle] : null;
      if (!rec || low) return;                                               /* LOW: the static preview stays as it is */
      rec.peekTo = on ? 1 : 0;
      if (st.reduced) { rec.peekP = rec.peekTo; applyPreview(rec); }
    }

    /* ---------------- contact AO ---------------- */
    function setLayout(isle, footprints) {
      var rec = isles[isle];
      if (st.disposed || !rec) return;
      var next = normFps(footprints), keys = S.chunkKeys(isle, diffFps(rec.fps, next));
      rec.fps = next;
      if (!keys.length) return;
      rec.dirty = rec.dirty || {};
      keys.forEach(function (k) { rec.dirty[k] = 1; });
      rec.aoWait = AO_WAIT;
    }
    function flushAO(rec) {
      var keys = Object.keys(rec.dirty), f = rec.fine, t0 = now(), o = terrainOpts(rec, 0), n = 0;
      rec.dirty = null;
      if (!f || !rec.fineMesh) return;                                       /* a coarse island: its next fine bake takes the footprints */
      keys.forEach(function (key) {
        var ch = S.topChunk(rec.isle, key, o);
        if (!ch) return;
        if (!f.chunks[key]) f.keys.push(key);
        f.chunks[key] = S.mesh(ch.model, mo);
        n++;
      });
      if (n) fineMeshOf(rec);
      ao.chunks = n; ao.ms = now() - t0; ao.runs++;
    }

    /* ---------------- state setters ---------------- */
    function setVisit(isle) { if (isles[isle] && isle !== st.visit) { st.visit = isle; retarget(); } }
    function setSkyMap(on) { if (st.skyMap !== !!on) { st.skyMap = !!on; retarget(); } }
    function setCamera(p) {
      if (!p) return;
      var x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y, z = Array.isArray(p) ? p[2] : p.z;
      if (!(x === x && y === y && z === z)) return;
      if (st.cam && st.cam[0] === x && st.cam[1] === y && st.cam[2] === z) return;
      st.cam = st.cam || [0, 0, 0];
      st.cam[0] = x; st.cam[1] = y; st.cam[2] = z;
      retarget();
    }
    function setTerrain(isle, mode) { var rec = isles[isle]; if (rec) { rec.force = mode === 'fine' || mode === 'coarse' ? mode : null; touch(rec); } }
    function setShow(k) {
      k = clamp01(Number(k) || 0);
      if (k === st.show) return;
      st.show = k;
      SKY.forEach(function (i) { applyPreview(isles[i]); });
    }
    function setQuality(q) { var rest = !(q && q.isles === false) && !low; if (rest !== st.rest) { st.rest = rest; retarget(); } }
    function setSeed(seed) {
      seed = seed == null ? '' : seed;
      if (seed === st.seed) return;
      st.seed = seed; slabs.home = null;
      finishRise(); dropFine(HOME); dropCoarse(HOME);                        /* never another child's coastline */
      touch(HOME);
    }
    function setReduced(on) {
      st.reduced = !!on;
      if (!st.reduced) return;
      finishRise();
      Object.keys(builds).forEach(function (k) { endBuild(builds[k]); });
      SKY.forEach(function (i) {
        var rec = isles[i], d = rec.waking;
        if (d) { open(rec, false); d.resolve(true); }
        if (rec.peekP !== rec.peekTo) { rec.peekP = rec.peekTo; applyPreview(rec); }
      });
    }

    /* ---------------- queries ---------------- */
    function slabOf(isle) {
      if (slabs[isle]) return slabs[isle];
      var s = isle === 'home' ? S.homeSlab(st.seed) : S.skySlab(isle), F = isles[isle].F, p = PAD + WOBBLE + F.pad;
      return (slabs[isle] = s ? s.bounds : { x0: F.bounds.x0 - p, x1: F.bounds.x1 + p, z0: F.bounds.z0 - p, z1: F.bounds.z1 + p });
    }
    /* the island's pick box: its slab outline, from the cake's tip up to its tallest item (the visited island: its ground) */
    function boxOf(rec) {
      var F = rec.F, b = slabOf(rec.isle), n = L && L.ISLE_THEME && L.ISLE_THEME[rec.isle] ? L.ISLE_THEME[rec.isle].strata.length : 6;
      var ground = rec.isle === st.visit && !st.skyMap && rec.state === 'open';
      return [b.x0, F.cy - (F.slab ? 2 : 1) - n * 0.5, b.z0, b.x1, ground ? F.bounds.yTop + 0.1 : F.cy + F.itemMaxH, b.z1];
    }
    function pick(origin, dir) {
      if (st.disposed || !origin || !dir) return null;
      var ox = origin.x, oy = origin.y, oz = origin.z, dx = dir.x, dy = dir.y, dz = dir.z, best = null;
      function take(kind, isle, t) { if (t >= 0 && (!best || t < best.t)) best = { kind: kind, isle: isle, t: t }; }
      SKY.forEach(function (isle) {
        if (built[isle] || builds[isle]) take('bridge', isle, rayFrame(frames[isle], ox, oy, oz, dx, dy, dz, frames[isle].box, true));
        else take('gate', isle, rayFrame(frames[isle], ox, oy, oz, dx, dy, dz, GATE_BOX, false));
      });
      ISLES.forEach(function (isle) { take('isle', isle, rayBox(ox, oy, oz, dx, dy, dz, boxOf(isles[isle]))); });
      if (best) { best.x = ox + dx * best.t; best.y = oy + dy * best.t; best.z = oz + dz * best.t; }
      return best;
    }
    /* Home's gate pad for a land: the landing at Home's height from the gate back to the shore (SLIsles3D's gatePad) */
    function padOf(isle) {
      if (pads[isle]) return pads[isle];
      var B = V3.bridge(isle), o = HOME.F.offset, alongX = Math.abs(B.b.x - B.a.x) > 2 * Math.abs(B.b.z - B.a.z), sx = alongX ? (B.a.x > 0 ? -1 : 1) : 0;
      var hw = (alongX || isle === 'castle' ? B.width : 1.5) / 2, span = 0;
      while (span < 4 && !C.CELL_REGION[Math.floor(B.a.x + sx * (span + 0.01) - o[0]) + ',' + Math.floor(B.a.z + (alongX ? 0 : span + 0.01) - o[1])]) span = Math.round(span * 10 + 1) / 10;
      return (pads[isle] = alongX ? { x0: Math.min(B.a.x, B.a.x + sx * span), x1: Math.max(B.a.x, B.a.x + sx * span), z0: B.a.z - hw, z1: B.a.z + hw }
        : { x0: B.a.x - hw, x1: B.a.x + hw, z0: B.a.z, z1: B.a.z + span });
    }
    function heightAt(x, z) {
      var i, f, rec, c;
      for (i = 0; i < SKY.length; i++) {
        c = padOf(SKY[i]);
        if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return HOME.F.top;
        if (!built[SKY[i]]) continue;
        f = frames[SKY[i]];
        var u = alongOf(f, x, z);
        if (u < 0 || u > f.length || Math.abs(acrossOf(f, x, z)) > f.width / 2) continue;
        f.deck = f.deck || deckTops(S.bridge(SKY[i]));
        return f.ay + f.deck[Math.min(f.deck.length - 1, Math.floor(u / 0.125))];
      }
      for (i = 0; i < ISLES.length; i++) {
        rec = isles[ISLES[i]];
        if (rec.state !== 'open') continue;
        c = rec.F.worldToCell(x, z);
        if ((rec === HOME ? st.land || rec.cells : rec.cells)[c.c + ',' + c.r]) return rec.F.surfaceY(c.c, c.r);
        var b = slabOf(rec.isle);
        if (rec !== HOME && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return rec.F.seaY;
      }
      return HOME.F.seaY;
    }
    function lockedAt(x, z) { try { return G.lockedRegionAt(x, z, st.land || undefined, V3.SAND_REACH); } catch (e) { return null; } }
    function signAnchor(isle, at) {
      var rec = isles[isle], F = rec && rec.F;
      if (!rec) return null;
      if (at === 'map') return { x: F.cx, y: F.cy + F.itemMaxH + SIGN_Y.map, z: F.cz };
      if (rec === HOME) return null;
      var B = V3.bridge(isle);
      if (at === 'gate') return { x: B.a.x, y: B.a.y + SIGN_Y.gate, z: B.a.z };
      if (at !== 'dock') return null;
      /* the lock sign of the preview: beside the dock gateway (SLIsles3D's dock frame) */
      var sty = S.STYLE[isle], half = sty.g * sty.w / 2, ox = (B.a.x - B.b.x) / B.length, oz = (B.a.z - B.b.z) / B.length;
      var skew = Math.abs(ox) > 0.01 && Math.abs(oz) > 0.01, out = skew ? 0.45 : half, d = B.width / 2 + half + (skew ? 0.2 : 0) + 0.4;
      return { x: B.b.x + ox * out + (skew ? oz : Math.abs(oz)) * d, y: F.cy + SIGN_Y.dock, z: B.b.z + oz * out + (skew ? -ox : Math.abs(ox)) * d };
    }
    function regionSign(region) { var p = G.signAnchor(region); return p ? { x: p.x, y: p.y, z: p.z } : null; }

    /* ---------------- per frame ---------------- */
    function update(dt, t, ctx) {
      if (st.disposed) return false;
      dt = typeof dt === 'number' && dt > 0 ? Math.min(dt, 0.1) : 0;
      if (ctx) {
        if (ctx.camera) setCamera(ctx.camera.position || ctx.camera);
        if (typeof ctx.show === 'number') setShow(ctx.show);
        if (typeof ctx.visit === 'string') setVisit(ctx.visit);
      }
      sync();
      var busy = false, i, rec;
      if (queue.length) { runJobs(); busy = true; }
      for (i = 0; i < ISLES.length; i++) {
        rec = isles[ISLES[i]];
        if (rec.dirty) { busy = true; if ((rec.aoWait -= dt) <= 0 && !rec.job && !(rise && rec === HOME)) flushAO(rec); }
        if (rec.waking) { busy = true; stepWake(rec, dt); }
        if (rec.hold && !st.hosted) { busy = true; if ((rec.holdT += dt) >= STANDIN_SEC) { rec.hold = false; refresh(rec); } }
        if (rec.pvMat && rec.peekP !== rec.peekTo) {
          busy = true;
          rec.peekP = rec.peekTo > rec.peekP ? Math.min(rec.peekTo, rec.peekP + dt / PV.peekSec) : Math.max(rec.peekTo, rec.peekP - dt / PV.peekSec);
          applyPreview(rec);
        }
      }
      for (var k in builds) { busy = true; stepBuild(builds[k], dt); }
      if (rise) { busy = true; if (!rise.wait) stepRise(dt); }
      return busy;
    }
    function info() {
      var out = { meshes: 0, calls: 0, tris: 0, isles: {}, bridges: bridgeSig ? bridgeSig.split(',') : [], jobs: queue.length, ao: ao, slice: slice };
      group.children.forEach(function (m) {
        if (!m.visible || !m.count) return;
        out.meshes++; out.calls++; out.tris += m.geometry.attributes.position.count / 3 * m.count;
      });
      ISLES.forEach(function (i) {
        var r = isles[i], m = r.mesh;
        out.isles[i] = { state: r.state === 'open' ? (r.hold ? 'standin' : m && m === r.fineMesh ? 'fine' : 'coarse') : r.waking ? 'waking' : 'preview',
          want: r.want, tris: m ? m.geometry.attributes.position.count / 3 : 0, baking: !!r.job };
      });
      return out;
    }
    function dispose() {
      if (st.disposed) return;
      finishRise();
      Object.keys(builds).forEach(abortBuild);
      st.disposed = true;
      timers.forEach(clearTimeout); timers.length = 0; queue.length = 0;
      ISLES.forEach(function (i) {
        var r = isles[i];
        if (r.waking) r.waking.resolve(false);
        [r.pvMesh, r.standMesh, r.coarseMesh, r.fineMesh].forEach(free);
        if (r.pvMat) r.pvMat.dispose();
        r.pvMesh = r.standMesh = r.coarseMesh = r.fineMesh = r.mesh = r.pvMat = r.fine = r.coarse = r.job = r.waking = null;
      });
      free(bridgeMesh); bridgeMesh = null;
      if (standMat) standMat.dispose();
      if (group.parent) group.parent.remove(group);
    }

    if (opts.scene && typeof opts.scene.add === 'function') opts.scene.add(group);
    return {
      VERSION: VERSION, group: group, tier: tier,
      setLand: setLand, riseRegion: riseRegion, setIsles: setIsles, buildBridge: buildBridge, wakeIsle: wakeIsle, ready: ready, peek: peek,
      setVisit: setVisit, setSkyMap: setSkyMap, setCamera: setCamera, setTerrain: setTerrain, setLayout: setLayout, setShow: setShow, setSeed: setSeed,
      heightAt: heightAt, lockedAt: lockedAt, pick: pick, signAnchor: signAnchor, regionSign: regionSign,
      hooks: function (o) { o = o || {}; if ('sound' in o) hook.sound = typeof o.sound === 'function' ? o.sound : null; if ('fx' in o) hook.fx = typeof o.fx === 'function' ? o.fx : null; },
      update: update, setReduced: setReduced, setQuality: setQuality, info: info, dispose: dispose
    };
  }

  return {
    VERSION: VERSION, SKY: SKY, ISLES: ISLES, SLICE_MS: SLICE_MS, AO_WAIT: AO_WAIT, FAR: FAR, NEAR: NEAR, RISE_DROP: RISE_DROP, STANDIN_SEC: STANDIN_SEC,
    FINE_CAP: FINE_CAP, PREVIEW: PREVIEW, SIGN_Y: SIGN_Y, GATE_BOX: GATE_BOX, BRIDGE_BOX: BRIDGE_BOX,
    create: create,
    /* pure helpers (Node-testable) */
    terrainMode: terrainMode, splitModel: splitModel, rayBox: rayBox, bridgeFrame: bridgeFrame, deckTops: deckTops, rayFrame: rayFrame, sliceBands: sliceBands, normFps: normFps, diffFps: diffFps
  };
}));
