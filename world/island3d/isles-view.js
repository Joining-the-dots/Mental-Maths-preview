/* ================================================================
   My Island v3 — SLIslesView (W4.1): the per-island logic the scene controller delegates to (D53).
   window.SLIslesView (classic script) / module.exports in Node. PURE: no THREE, no DOM, no clock
   it does not take as an argument (promote() reads performance.now() only when no `now` is
   passed). Siblings are feature-detected: SLWorldCore, SLIslandLook, SLGrid3D and SLTier (each
   may also be handed in), SL3D.vox.models and SLPxPaths for the path / wall poses (optional:
   without them the pieces come from SLIslandLook.pathPiece). Nothing here reads, awards or
   spends points, and nothing here moves the camera: it only decides.

   ISLANDS: 'home' + the five lands in SLWorldCore.ISLE_ORDER. An isle that is not a known key is
   ignored everywhere (a future island key in a save is never drawn, moved or lost).

   itemsOf(view, o) → {isle: [entry]} for Home (view.placed) and every unlocked sky island in
     view.isles (view.unlockedIsles when given; o.hold = isles kept as previews until unlockIsle
     runs, e.g. view.anim.unlockIsle). Known placeable ids only; a uid seen twice keeps its first
     copy (Home, then ISLE_ORDER). o = {look, grid, core, models (SL3D.vox.models), tier, seed
     (user.seed: the house trim), hold}. entry = {isle, uid, id, x, y, fp, st, stateKey,
     place: {pos [x, y, z], yaw (deg), baseY, fp, plinth}, jitter, jkey, mask}:
       · st / stateKey through SLIslandLook.resolveStyle / stateKey: the house wears view.style with
         its trim (style.variant, else fnv(seed) % 2); a city building its own trim
         variantOf(uid, id); the V3_VARIANT_IDS their colourway: p.vr when it is an integer (the
         child's 'Next colour' choice, D115), else variantOf(uid, id) (D72); anything else the
         shared view.style.
       · paths (C kind 'path') get the auto-tiled piece of their N1 E2 S4 W8 mask (any path id on the
         SAME island connects; N = the row above) through the model's pose(mask, uid, layouts)
         (PATH_LAYOUTS LOW 1 / MID 1 / HIGH 3): stateKey 'p:<piece>[:<layout>]' and its yaw.
         castle_wall (joins) gets its mask from castle_wall copies on the same island only:
         stateKey 'w:<piece>:v<n>', where a stored vr wins over the wall's hashed colourway.
       · place: SLGrid3D.V3.frame(isle).placement(id, x, y) (Home on the v3 terraces). The kit's
         ItemBatch takes {pos, yaw} as it is (yaw in degrees).
       · jitter: SLIslandLook.jitterVox(uid, id, same-id 4-neighbours on the same island) in the
         kit's shape {yaw, sx, sy, sz, lean 0, leanAxis 0, tint {l, h} | null} (the raw tl / th
         are kept too); null for anything that does not vary (houses, buildings, landmarks, rides,
         paths, small decor). jkey = its signature ('' when null).
   diff(prevByIsle, nextByIsle) → [op]: every 'remove' (prev order), then 'restyle', 'move', 'add'
     (next order). op = the next entry's fields + {op}; a remove carries the PREVIOUS {isle, uid,
     id, stateKey}. restyle = the id or stateKey changed (a path piece turned, a colourway, the
     house style); move = x / y, place.pos, place.yaw or the jitter changed (a same-id neighbour
     came or went: re-jitter); a uid that changed island = remove on the old one + add on the new.
     prevByIsle may be null (the first sync: all adds).
   policy(o) → {isle: {isle, lod 0 | 1, live, mode 'merger' | 'bake' | 'preview' | 'hidden', want,
     terrain 'fine' | 'coarse', itemLod 0 | 'decor' | 'all', organicLod 0 | 1, locked, visited,
     why}} for all six islands. o = {tier, quality (SL3D.quality: isles false = LOW or the
     ladder's 'isles' step; decor false = the 'decor' step; steps []), visit, skyMap, tour,
     unlocked (C.unlockedIsles), pending (isles still previews: anim.unlockIsle), cameraPos
     {x, y, z}, frustum (a THREE.Frustum, its planes, or [[a, b, c, d] × 6]) | viewProj (the 16
     column-major numbers of projection × view), tris {isle: LOD0-at-rest tris | estimate},
     tris0 {isle: estimate} (trisEstimate()), itemLod (the visited island's previous stage) |
     prev (the previous result: itemLod and terrain hysteresis), budgets (a BUDGETS row), grid}.
       D42 / D89 / D106, in order:
       · the Sky map or the Sky tour: every island a LOD1 bake ('preview' when locked), none live;
         the Sky map draws all terrain coarse.
       · the visited island: LOD0 merger, live, fine terrain, its itemLod stage (below); a locked or
         pending land being peeked at stays a preview.
       · every other unlocked island: LOW → bake; the ladder's 'isles' step → bake (Home too: the
         step is 'the islands the child is not on'); MID / HIGH → LOD0 merger at rest, nearest
         first (centre distance from the visited island's centre, so a camera orbit never swaps
         them), only while visited + rest tris ≤ BUDGETS.trisRest; the first one that does not fit
         and every one after it bake. An island with no tris figure counts as not fitting.
       · a non-visited island whose land box + 6 u is outside the frustum: mode 'hidden' (want =
         what it draws when back in view: keep that merger / bake / preview, just do not draw it,
         so turning the camera never re-bakes anything). Without a frustum nothing is hidden.
       · terrain (= SLIslesGL's rule, so setTerrain agrees with it): coarse in the Sky map and for
         previews; fine for the visited island and Home; a land at rest fine only as a merger
         within 45 u of the camera (44 u to come back: the band keeps prev.terrain).
       · itemLod (the visited island, D106): the estimate {lod0, decor, all} against
         BUDGETS.trisVisited — step up from the previous stage when that stage is over the budget
         (to the first stage that fits, else 'all'); step back only to a stage under 90% of it. LOW
         after the ladder's 'decor' step forces at least 'decor' (D71). organicLod = 1 whenever
         the island's organic decor draws 'vox-lod1' (itemLod 'decor' / 'all', every bake).
   trisEstimate(byIsle, tier, o) → {isle: {lod0, decor, all, terrain, items}}: the LOD0 estimate of
     an island at a tier (D106): its items' templates (o.tris(id, stateKey, lod) when the scene
     knows a template's real count, else SLIslandLook.trisCap(id, tier) / TRIS_CAPS_LOD1(id), 35%
     for a V4.54 model's own LOD1) + its terrain (o.terrain {isle: n} | n, else TERRAIN_TRIS).
     'decor' swaps C kind 'decor' (repeatable and organic decor); 'all' every item but the
     landmark, the house and the paths (a tile is its own LOD1).
   lodFor(entry, itemLod, o) → 0 | 1: the template one copy draws on the visited island ('vox' or
     'vox-lod1'); o = {now, acting (uid → bool | {uid: 1}), table}: a promoted or acting copy, a
     path, the landmark and the house stay 0.
   promote(uid, sec, o) → until: keeps a tapped copy at LOD0 for its act (sec; Infinity = until a
     later promote(uid, 0)) and PROMOTE_TAIL (2 s) after. promoted(uid, o) → bool · sweep(o) →
     [uids whose promotion just ended] (re-batch them) · promotions() → a fresh table (o.table);
     without one the module's own table is used. o.now in seconds on ONE clock the caller keeps
     (the scene's clock); without it performance.now() / 1000.
   routeTap(hit, o) → {kind: 'pet' | 'avatar' | 'item' | 'bridge' | 'isle' | 'gate' | 'region' |
     'cell' | 'ghost' | 'none', …}. hit = {actor {target 'pet:<id>' | 'me', t}, item {uid, t,
     isle?}, ghost (t), isle (SLIslesGL.pick() {kind 'bridge' | 'isle' | 'gate', isle, t, x, y,
     z}), cell (the visited frame's rayToCell {c, r, land, t, …}), region ('cove' | 'meadow':
     Home's locked land under the tap)}; o = {mode, visit, skyMap, unlocked}.
       play: pets / avatar (unless an item box is ≥ 0.6 u nearer) > items on the visited island >
       bridges ({to}: the far end) > other islands / gates > land cells > a locked Home region >
       other cells. The visited island's own box (isles-gl returns it so it occludes what is behind
       it) is no island hit. edit: items > land cells > region > cells (other islands, bridges and
       gates are ignored: no accidental flights). place: the ghost > cells. Sky map (play only):
       any island, bridge or gate → {kind 'isle'} of that island (the visited one too).
       {kind 'isle' | 'gate', isle, locked, land}: locked false → on.tapIsle(isle); locked true →
       on.tapLand(land); locked null (no o.unlocked given) → on.tapIsle(isle) (the host opens the
       land sheet for a land it does not own). {kind 'bridge', isle, to} → on.tapIsle(to). {kind
       'cell', c, r, x, y, isle, land} → on.tapCell(x, y, isle). {kind 'region', region, land} →
       on.tapLand(land). {kind 'pet', pet, target} / {kind 'avatar', target 'me'} → the actors' tap,
       then on.tapPet / on.tapAvatar. {kind 'item', uid} → on.tapItem(uid). {kind 'ghost'} → the
       ghost drag.
   anchorsVisible(list, o) → the setAnchors entries that show, as copies {el, uid | pet | me | region
     | isle, at, dy, dyPx}. o = {visit, mode, skyMap, items (itemsOf) | isleOf(uid), widthPx
     ({isle: px} | fn(isle))}. D55 + host-ui signs3D: uid tags only for the visited island's items;
     Home's locked region signs only on Home; island signs never in edit / place, never for the
     island you are on, at 'gate' (from Home), 'dock' (from a land; Home's own sign at 'map', it
     has no dock) or 'map' (the Sky map: all six); a dock / map sign whose island is < 60 px wide
     on screen hides. Nothing but island signs in the Sky map.
   keyboardList(view, t, o) → [{key, label, action}]: the visited island's items (play: those with
     an act) in row order, then (play) the crew on this island and 'me', the locked Home regions
     (not in place mode), then (play) one entry per other island in ISLE_ORDER: unlocked → copy
     sr.flyTo, locked → sr.lockedIsle. In the Sky map: the six islands only. action = the route
     routeTap would give a tap on it, so Enter / Space take the same path as a tap. t = SLWorldCopy
     (or its t function).
   budget(info, tier) → {ok, over: [{key, value, max}]}: a stage.info() against BUDGETS (the v2
     ceilings, trisWorst, the Home view / Sky map rows, trisVisited, trisRest, voxPrograms).

   USE (W4.2a on every sync and camera change; W4.2b's policy(state) callback asks the same):
     items = itemsOf(view, {tier, seed: user.seed, hold: [the isle anim.unlockIsle keeps a preview]})
     ops = diff(lastItems, items); lastItems = items   (batches keyed isle + id + stateKey; restyle =
       re-batch, time-sliced; move = batch.move(uid, x, y, {pos, yaw, jitter}))
     est = trisEstimate(items, tier, {tris: the built templates' real counts})
     pol = policy({tier, quality: SL3D.quality, visit, skyMap, tour, unlocked: view.unlockedIsles,
       pending, cameraPos: camera.position, viewProj: projection × view, tris: est, tris0: est,
       prev: pol}); each isle: merger | bake | preview, hidden = keep it but draw nothing,
       isles-gl setTerrain(isle, pol[isle].terrain)
     a copy on the visited island draws ns lodFor(entry, pol[visit].itemLod, {now, acting}) ?
       'vox-lod1' : 'vox' (re-batch on change); a tap → promote(uid, act seconds, {now}) (Infinity
       until the act's promise settles, then promote(uid, 0, {now})); each frame sweep({now}) →
       re-batch those back. routeTap / anchorsVisible / keyboardList as above.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIslesView = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var ISLES = ['home', 'pier', 'jungle', 'treetop', 'castle', 'ice'];
  var MODES = { play: 1, edit: 1, place: 1 };
  var STAGES = [0, 'decor', 'all'];
  var FAR = 45, NEAR = 44;                 /* terrain fine ↔ coarse band (u; = SLIslesGL) */
  var FRUSTUM_PAD = 6;                     /* the land box grows this much before the frustum test (D89) */
  var BOX_PAD = 0.55;                      /* SLIsles3D's beach pad + coast wobble round the frame */
  var STEP_BACK = 0.9;                     /* itemLod steps back only under 90% of the budget (D106) */
  var PROMOTE_TAIL = 2;                    /* s at LOD0 after a tapped copy's act (D106) */
  var OCCLUDE_U = 0.6;                     /* a pet still wins a tap unless an item box is this much nearer */
  var MIN_SIGN_PX = 60;                    /* a dock / map sign hides on an island narrower than this (D55) */
  var LOD1_SHARE = 0.35;                   /* a V4.54 model's own LOD1, estimated (TRIS_LOD1.sharePct) */
  var PATH_LAYOUTS = { LOW: 1, MID: 1, HIGH: 3 };
  /* fine terrain per island (D89 terrain budgets): the estimate's terrain when the scene has none */
  var TERRAIN_TRIS = { home: 9000, pier: 9000, castle: 7000, jungle: 6000, treetop: 6000, ice: 6000 };
  /* the rows policy() and budget() read when SLTier is not loaded (= tier.js BUDGETS) */
  var BUDGETS0 = {
    LOW: { drawCalls: 70, tris: 60000, programs: 12, voxPrograms: 7, callsHome: 30, callsMap: 45, trisHome: 40000, trisWorst: 58000, trisVisited: 36000, trisRest: 0 },
    MID: { drawCalls: 100, tris: 120000, programs: 16, voxPrograms: 9, callsHome: 40, callsMap: 60, trisHome: 75000, trisWorst: 100000, trisVisited: 60000, trisRest: 80000 },
    HIGH: { drawCalls: 150, tris: 200000, programs: 16, voxPrograms: 9, callsHome: 45, callsMap: 70, trisHome: 95000, trisWorst: 150000, trisVisited: 90000, trisRest: 130000 }
  };
  var NONE = Object.freeze({ kind: 'none' });

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function need(m, name) { if (!m) throw new Error('SLIslesView: ' + name + ' is not loaded'); return m; }
  function coreOf(o) { return need((o && o.core) || sibling('SLWorldCore', '../world-core.js'), 'SLWorldCore'); }
  function lookOf(o) { return need((o && o.look) || sibling('SLIslandLook', '../world-look.js'), 'SLIslandLook'); }
  function gridOf(o) { return need((o && o.grid) || sibling('SLGrid3D', './grid3d.js'), 'SLGrid3D'); }
  function voxModels(o) {
    if (o && o.models) return o.models;
    var S = root && root.SL3D;
    return S && S.vox && S.vox.models ? S.vox.models : null;
  }

  /* ---------------- small pure helpers ---------------- */
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function normMode(m) { return MODES[m] ? m : 'play'; }
  function isleKey(k) { return ISLES.indexOf(k) >= 0 ? k : 'home'; }
  function parseTier(t) { var u = typeof t === 'string' ? t.toUpperCase() : ''; return u === 'LOW' || u === 'MID' || u === 'HIGH' ? u : null; }
  /* an id, a list of ids or a {id: true} map → {id: 1} */
  function toSet(v) {
    var out = {};
    if (typeof v === 'string') out[v] = 1;
    else if (Array.isArray(v)) v.forEach(function (k) { if (typeof k === 'string') out[k] = 1; });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (v[k]) out[k] = 1; });
    return out;
  }
  function unlockedSet(v) { var s = toSet(v); s.home = 1; return s; }
  /* FNV-1a 32-bit (the same hash as SLIslandLook / SLGrid3D / island3d) */
  function fnv(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function budgetsOf(o, tier) {
    if (o && o.budgets && typeof o.budgets === 'object') return o.budgets;
    var T = sibling('SLTier', './tier.js');
    return (T && T.BUDGETS && T.BUDGETS[tier]) || BUDGETS0[tier];
  }
  function landOf(C, isle) { var d = C.ISLES && C.ISLES[isle]; return (d && d.unlock) || 'land_' + isle; }
  function isleName(C, isle) { var d = C.ISLES && C.ISLES[isle]; return (d && d.name) || isle; }

  /* ================================================================
     ITEMS: the copies each island draws
     ================================================================ */
  /* the isles itemsOf reads: Home, then the unlocked sky islands view.isles carries */
  function islesIn(view, o) {
    var out = ['home'], sky = view.isles && typeof view.isles === 'object' ? view.isles : null;
    if (!sky) return out;
    var ok = Array.isArray(view.unlockedIsles) ? toSet(view.unlockedIsles) : null, hold = toSet(o && o.hold);
    ISLES.forEach(function (k) {
      if (k === 'home' || !own(sky, k) || !Array.isArray(sky[k]) || hold[k] || (ok && !ok[k])) return;
      out.push(k);
    });
    return out;
  }
  /* the 4-adjacent copies of the same id for every copy want(id) asks about → {uid: [uids, sorted]} */
  function idNeighbours(list, fpOf, want) {
    var occ = {}, out = {}, i, dx, dy;
    for (i = 0; i < list.length; i++) {
      var p = list[i], fp = fpOf(p.id);
      for (dy = 0; dy < fp[1]; dy++) for (dx = 0; dx < fp[0]; dx++) occ[(p.x + dx) + ',' + (p.y + dy)] = p;
    }
    var STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < list.length; i++) {
      var q = list[i];
      if (want && !want(q.id)) continue;
      var f = fpOf(q.id), seen = {}, nb = [];
      for (dy = 0; dy < f[1]; dy++) for (dx = 0; dx < f[0]; dx++) {
        for (var s = 0; s < 4; s++) {
          var n = occ[(q.x + dx + STEP[s][0]) + ',' + (q.y + dy + STEP[s][1])];
          if (n && n.id === q.id && n.uid !== q.uid && !seen[n.uid]) { seen[n.uid] = 1; nb.push(n.uid); }
        }
      }
      out[q.uid] = nb.sort();
    }
    return out;
  }
  /* N 1 · E 2 · S 4 · W 8 neighbour masks (N = the row above) of the copies is(id) picks, counting
     only copies is(id) also picks: list [{uid, id, x, y}] (ONE island) → {uid: mask} */
  function pieceMasks(list, is) {
    var cells = {}, out = {}, i;
    for (i = 0; i < list.length; i++) if (is(list[i].id)) cells[list[i].x + ',' + list[i].y] = 1;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      if (!is(p.id)) continue;
      out[p.uid] = (cells[p.x + ',' + (p.y - 1)] ? 1 : 0) | (cells[(p.x + 1) + ',' + p.y] ? 2 : 0) |
                   (cells[p.x + ',' + (p.y + 1)] ? 4 : 0) | (cells[(p.x - 1) + ',' + p.y] ? 8 : 0);
    }
    return out;
  }
  /* the home's trim from the profile seed (island3d's seedVariant: 0 with no seed) */
  function houseStyle(style, seed) {
    style = style || {};
    if (num(style.variant)) return style;
    var out = {};
    for (var k in style) if (own(style, k)) out[k] = style[k];
    out.variant = seed == null || seed === '' ? 0 : fnv(String(seed)) % 2;
    return out;
  }
  function variantIds(L) { var s = {}; (L.V3_VARIANT_IDS || []).forEach(function (id) { s[id] = 1; }); return s; }
  /* the style one copy resolves from: the house → its trim; a city building → its own trim by uid; a
     colourway id → the stored vr, else the uid hash (D72, D115); anything else the shared style */
  function copyStyle(L, VAR, id, p, style, seed) {
    var e = L.LOOK ? L.LOOK[id] : null;
    if (id === 'house_cottage') return houseStyle(style, seed);
    if (VAR[id]) return { variant: isInt(p.vr) ? p.vr : L.variantOf(p.uid, id) };
    if (e && e.kind === 'building' && typeof L.variantOf === 'function') return { variant: L.variantOf(p.uid, id) };
    return style || {};
  }
  /* a path or wall copy's piece: the model's own pose (px-paths), else the look's pathPiece */
  function poseFn(models, id) {
    var h = models && models[id];
    if (h && typeof h.pose === 'function') return function (mask, uid, layouts) { return h.pose(mask, uid, layouts, id); };
    var P = sibling('SLPxPaths', './px-paths.js');
    return P && typeof P.pose === 'function' ? function (mask, uid, layouts) { return P.pose(mask, uid, layouts, id); } : null;
  }
  function piecePose(L, models, id, wall, mask, uid, layouts, vr) {
    var f = poseFn(models, id), p = null;
    if (f) { try { p = f(mask, uid, layouts); } catch (e) { p = null; } }
    if (!p || typeof p.stateKey !== 'string' || !num(p.yaw)) {
      var pc = L.pathPiece(mask);
      p = wall ? { stateKey: '', st: { piece: pc.piece, variant: L.variantOf(uid, id) }, yaw: pc.yawDeg }
               : { stateKey: 'p:' + pc.piece, st: { piece: pc.piece }, yaw: pc.yawDeg };
    }
    var st = {};
    for (var k in p.st) if (own(p.st, k)) st[k] = p.st[k];
    if (wall) {
      if (isInt(vr)) st.variant = vr;                                 /* the child's colour wins (D115) */
      st.variant = L.resolveStyle(id, { variant: st.variant }).variant;
      return { st: st, stateKey: 'w:' + st.piece + ':v' + st.variant, yaw: p.yaw };
    }
    return { st: st, stateKey: p.stateKey, yaw: p.yaw };
  }
  /* jitterVox in the kit's jitter shape (normJitter reads tint {l, h}); null when it is the identity */
  function jitterOf(L, uid, id, nb) {
    if (typeof L.jitterVox !== 'function') return null;
    var j = L.jitterVox(uid, id, nb && nb.length ? nb : null);
    if (!j || (!j.yaw && j.sx === 1 && j.sy === 1 && j.sz === 1 && j.tl === 1 && !j.th)) return null;
    return { yaw: j.yaw, sx: j.sx, sy: j.sy, sz: j.sz, lean: 0, leanAxis: 0, tint: j.tl !== 1 || j.th ? { l: j.tl, h: j.th } : null, tl: j.tl, th: j.th };
  }
  function jitterKey(j) { return j ? [j.yaw, j.sx, j.sy, j.sz, j.tl, j.th].join(',') : ''; }

  function itemsOf(view, o) {
    view = view || {}; o = o || {};
    var C = coreOf(o), L = lookOf(o), G = gridOf(o), models = voxModels(o), VAR = variantIds(L);
    var tier = parseTier(o.tier) || parseTier(root && root.SL3D && root.SL3D.tier) || 'MID', layouts = PATH_LAYOUTS[tier];
    var out = {}, seen = {};
    function fpOf(id) { var it = C.item(id); return (it && it.fp) || [1, 1]; }
    function organic(id) { var e = L.LOOK && L.LOOK[id]; return !!(e && L.ORGANIC_KINDS && L.ORGANIC_KINDS[e.kind]); }
    function isPath(id) { var it = C.item(id); return !!(it && it.kind === 'path'); }
    function isWall(id) {
      var h = models && models[id], it = C.item(id), e = L.LOOK && L.LOOK[id];
      return h ? !!h.joins : !!((it && it.joins) || (e && e.joins));
    }
    function pieced(id) { var h = models && models[id]; return isPath(id) && (!h || !!h.pieces); }
    islesIn(view, o).forEach(function (isle) {
      var src = isle === 'home' ? view.placed : view.isles[isle], F = G.V3.frame(isle), list = [];
      if (!F) return;
      (Array.isArray(src) ? src : []).forEach(function (p) {
        if (!p || p.uid == null || own(seen, p.uid) || !num(p.x) || !num(p.y)) return;
        var it = C.item(p.id);
        if (!it || (typeof C.isPlaceable === 'function' && !C.isPlaceable(it))) return;
        seen[p.uid] = 1;
        list.push({ uid: p.uid, id: p.id, x: p.x | 0, y: p.y | 0, vr: p.vr });
      });
      var nbs = idNeighbours(list, fpOf, organic), paths = pieceMasks(list, isPath), walls = pieceMasks(list, isWall);
      out[isle] = list.map(function (p) {
        var st, sk, yaw = 0, mask = null, wall = own(walls, p.uid);
        if (wall || (own(paths, p.uid) && pieced(p.id))) {
          mask = wall ? walls[p.uid] : paths[p.uid];
          var pp = piecePose(L, models, p.id, wall, mask, p.uid, layouts, p.vr);
          st = pp.st; sk = pp.stateKey; yaw = pp.yaw;
        } else {
          st = L.resolveStyle(p.id, copyStyle(L, VAR, p.id, p, view.style, o.seed));
          sk = L.stateKey(p.id, st);
        }
        var pl = F.placement(p.id, p.x, p.y), fp = fpOf(p.id), jit = jitterOf(L, p.uid, p.id, nbs[p.uid]);
        return {
          isle: isle, uid: p.uid, id: p.id, x: p.x, y: p.y, fp: fp, st: st, stateKey: sk,
          place: { pos: [pl.pivot.x, pl.pivot.y, pl.pivot.z], yaw: yaw, baseY: pl.baseY, fp: fp, plinth: pl.plinth || null },
          jitter: jit, jkey: jitterKey(jit), mask: mask
        };
      });
    });
    return out;
  }

  /* ================================================================
     DIFF
     ================================================================ */
  function byUid(byIsle) {
    var out = {}, order = [];
    if (!byIsle || typeof byIsle !== 'object') return { map: out, order: order };
    var keys = ISLES.filter(function (k) { return own(byIsle, k); });
    Object.keys(byIsle).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    keys.forEach(function (k) {
      (Array.isArray(byIsle[k]) ? byIsle[k] : []).forEach(function (e) {
        if (!e || e.uid == null || own(out, e.uid)) return;
        var r = { isle: k, e: e };
        out[e.uid] = r; order.push(r);
      });
    });
    return { map: out, order: order };
  }
  function samePos(a, b) {
    var p = a && a.pos, q = b && b.pos;
    if (!p || !q) return p === q;
    return p[0] === q[0] && p[1] === q[1] && p[2] === q[2];
  }
  function opOf(kind, isle, e) {
    return { isle: isle, op: kind, uid: e.uid, id: e.id, x: e.x, y: e.y, fp: e.fp, stateKey: e.stateKey, st: e.st, place: e.place, jitter: e.jitter };
  }
  function diff(prevByIsle, nextByIsle) {
    var P = byUid(prevByIsle), N = byUid(nextByIsle), rem = [], res = [], mov = [], add = [];
    P.order.forEach(function (r) {
      var n = N.map[r.e.uid];
      if (!n || n.isle !== r.isle) rem.push({ isle: r.isle, op: 'remove', uid: r.e.uid, id: r.e.id, stateKey: r.e.stateKey });
    });
    N.order.forEach(function (r) {
      var p = P.map[r.e.uid], e = r.e;
      if (!p || p.isle !== r.isle) { add.push(opOf('add', r.isle, e)); return; }
      var q = p.e;
      if (q.id !== e.id || q.stateKey !== e.stateKey) res.push(opOf('restyle', r.isle, e));
      else if (q.x !== e.x || q.y !== e.y || !samePos(q.place, e.place) || (q.place && q.place.yaw) !== (e.place && e.place.yaw) ||
               (q.jkey || '') !== (e.jkey || '')) mov.push(opOf('move', r.isle, e));
    });
    return rem.concat(res, mov, add);
  }

  /* ================================================================
     POLICY: level of detail, liveness, terrain, frustum, the visited island's budget
     ================================================================ */
  function frameOf(G, isle) { try { return G.V3.frame(isle); } catch (e) { return null; } }
  function dist3(a, b) { var x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return Math.sqrt(x * x + y * y + z * z); }
  function centreOf(F) { return { x: F.cx, y: F.cy, z: F.cz }; }
  /* an island's land box [x0, y0, z0, x1, y1, z1]: its slab outline (frame + pad + the coast), from
     the strata cake's tip to the tallest item it may hold (= SLIslesGL's pick box) */
  var BOXES = {};
  function landBox(isle, o) {
    var own0 = !(o && (o.grid || o.look));
    if (own0 && own(BOXES, isle)) return BOXES[isle];
    var G = gridOf(o), F = frameOf(G, isle);
    if (!F) return null;
    var L = (o && o.look) || sibling('SLIslandLook', '../world-look.js');
    var th = L && L.ISLE_THEME && L.ISLE_THEME[isle], n = th && Array.isArray(th.strata) ? th.strata.length : 6, p = F.pad + BOX_PAD, b = F.bounds;
    var box = Object.freeze([b.x0 - p, F.cy - (F.slab ? 2 : 1) - n * 0.5, b.z0 - p, b.x1 + p, Math.max(F.cy, b.yTop) + F.itemMaxH, b.z1 + p]);
    if (own0) BOXES[isle] = box;
    return box;
  }
  /* frustum planes [{x, y, z, w}] (inside: n·p + w ≥ 0) from a THREE.Frustum, its planes, [a, b, c, d]
     arrays or a projection × view matrix (column-major, as THREE.Frustum.setFromProjectionMatrix) */
  function frustumPlanes(src) {
    if (!src) return null;
    var list = Array.isArray(src) && src.length === 16 && num(src[0]) ? null : (Array.isArray(src) ? src : src.planes);
    if (!list) {
      var m = src.elements || src;
      list = [[m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]], [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
              [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]], [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
              [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]], [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]]];
    }
    if (!Array.isArray(list) || !list.length) return null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var q = list[i], x, y, z, w;
      if (Array.isArray(q)) { x = q[0]; y = q[1]; z = q[2]; w = q[3]; }
      else if (q && q.normal) { x = q.normal.x; y = q.normal.y; z = q.normal.z; w = q.constant; }
      else if (q) { x = q.x; y = q.y; z = q.z; w = q.w; }
      var len = Math.sqrt(x * x + y * y + z * z);
      if (!(len > 0) || !num(w)) return null;
      out.push({ x: x / len, y: y / len, z: z / len, w: w / len });
    }
    return out;
  }
  /* an axis-aligned box [x0, y0, z0, x1, y1, z1] grown by pad touches the frustum (the positive-vertex test) */
  function boxVisible(planes, box, pad) {
    if (!planes || !box) return true;
    pad = pad || 0;
    for (var i = 0; i < planes.length; i++) {
      var P = planes[i];
      var x = P.x > 0 ? box[3] + pad : box[0] - pad, y = P.y > 0 ? box[4] + pad : box[1] - pad, z = P.z > 0 ? box[5] + pad : box[2] - pad;
      if (P.x * x + P.y * y + P.z * z + P.w < 0) return false;
    }
    return true;
  }
  /* SLIslesGL's terrain rule for one island: 'fine' | 'coarse' (rest = it draws LOD0 at rest; dist < 0: no camera) */
  function terrainMode(isle, visit, skyMap, rest, dist, prev) {
    if (skyMap) return 'coarse';
    if (isle === visit || isle === 'home') return 'fine';
    if (!rest || !(dist >= 0)) return 'coarse';
    return dist > FAR ? 'coarse' : dist < NEAR ? 'fine' : prev || 'fine';
  }
  /* an estimate (a number = its LOD0 tris, or {lod0, decor, all}) → [lod0, decor, all] (NaN = unknown) */
  function stagesOf(est) {
    if (num(est)) return [est, NaN, NaN];
    if (!est || typeof est !== 'object') return null;
    var a = num(est.lod0) ? est.lod0 : NaN;
    return [a, num(est.decor) ? est.decor : NaN, num(est.all) ? est.all : NaN];
  }
  function stageIndex(s) { return s === 'all' || s === 2 ? 2 : s === 'decor' || s === 1 ? 1 : 0; }
  /* the visited island's itemLod (D106): from the previous stage, up while over the budget, back only
     under STEP_BACK of it; LOW's 'decor' step keeps it at 'decor' or above (D71) */
  function stageFor(est, budget, prev, atLeastDecor) {
    var E = stagesOf(est), p = stageIndex(prev), s = p, i;
    if (E && num(budget) && budget > 0) {
      /* back down first, to the lowest stage KNOWN to sit under 90% (an unknown figure never does) */
      for (i = 0; i < p; i++) if (E[i] < STEP_BACK * budget) { s = i; break; }
      /* still here and over (or unknown): up to the first stage known to fit, else 'all' */
      if (s === p && !(E[p] <= budget)) {
        s = 2;
        for (i = p + 1; i < 2; i++) if (E[i] <= budget) { s = i; break; }
      }
    } else if (!E) s = 0;
    if (atLeastDecor && s < 1) s = 1;
    return STAGES[s];
  }
  /* what an island at a stage costs: that stage's estimate, else its LOD0 (unknown → 0) */
  function costAt(est, stage) {
    var E = stagesOf(est);
    if (!E) return 0;
    var v = E[stageIndex(stage)];
    return num(v) ? v : (num(E[0]) ? E[0] : 0);
  }
  function restCost(tris, isle) {
    var v = tris && own(tris, isle) ? tris[isle] : null;
    if (num(v)) return v;
    return v && typeof v === 'object' && num(v.lod0) ? v.lod0 : Infinity;
  }
  function entryOf(isle) {
    return { isle: isle, lod: 1, live: false, mode: 'preview', want: 'preview', terrain: 'coarse', itemLod: 0, organicLod: 1, locked: false, visited: false, why: 'locked' };
  }
  function policy(o) {
    o = o || {};
    var tier = parseTier(o.tier) || 'MID', B = budgetsOf(o, tier), q = o.quality || {};
    var steps = toSet(q.steps || o.ladder);
    var islesStep = q.isles === false || !!steps.isles, decorStep = q.decor === false || !!steps.decor;
    var unl = unlockedSet(o.unlocked), pend = toSet(o.pending), visit = isleKey(o.visit);
    var skyMap = !!o.skyMap, tour = !!o.tour && !skyMap, wide = skyMap || tour;
    var G = gridOf(o), cam = o.cameraPos && num(o.cameraPos.x) && num(o.cameraPos.y) && num(o.cameraPos.z) ? o.cameraPos : null;
    var planes = frustumPlanes(o.frustum || o.viewProj), prev = o.prev && typeof o.prev === 'object' ? o.prev : {};
    var out = {};
    function open(k) { return !!unl[k] && !pend[k]; }
    /* the visited island's stage, carried across a Sky map or a tour (the hysteresis is per visit) */
    var est = o.tris0 && own(o.tris0, visit) ? o.tris0[visit] : (o.tris && own(o.tris, visit) ? o.tris[visit] : null);
    var before = o.itemLod !== undefined ? o.itemLod : (prev[visit] && prev[visit].visited ? prev[visit].itemLod : 0);
    var stage = stageFor(est, B.trisVisited, before, tier === 'LOW' && decorStep);
    var used = open(visit) ? costAt(est, stage) : 0;
    /* the rest, nearest the visited island first */
    var vF = frameOf(G, visit), from = vF ? centreOf(vF) : { x: 0, y: 0, z: 0 };
    var rest = ISLES.filter(function (k) { return k !== visit && open(k); }).map(function (k, i) {
      var F = frameOf(G, k);
      return { isle: k, d: F ? dist3(from, centreOf(F)) : Infinity, i: i };
    }).sort(function (a, b) { return a.d - b.d || a.i - b.i; });
    var stopped = false, kept = {};
    rest.forEach(function (r) {
      if (wide || tier === 'LOW' || islesStep || stopped) return;
      var c = restCost(o.tris, r.isle);
      if (used + c <= B.trisRest) { kept[r.isle] = 1; used += c; } else stopped = true;
    });
    ISLES.forEach(function (k) {
      var e = entryOf(k), F = frameOf(G, k), d = cam && F ? dist3(cam, centreOf(F)) : -1;
      var pt = prev[k] && prev[k].terrain;
      e.locked = !unl[k]; e.visited = k === visit;
      if (!open(k)) e.why = e.locked ? 'locked' : 'pending';
      else if (wide) { e.mode = e.want = 'bake'; e.itemLod = 'all'; e.why = skyMap ? 'skyMap' : 'tour'; }
      else if (k === visit) { e.lod = 0; e.live = true; e.mode = e.want = 'merger'; e.itemLod = stage; e.organicLod = stage ? 1 : 0; e.why = 'visited'; }
      else if (kept[k]) { e.lod = 0; e.mode = e.want = 'merger'; e.organicLod = 0; e.why = 'rest'; }
      else { e.mode = e.want = 'bake'; e.itemLod = 'all'; e.why = tier === 'LOW' ? 'low' : islesStep ? 'ladder' : 'budget'; }
      if (k === visit && open(k)) e.itemLod = stage;                 /* kept through the Sky map: the hysteresis */
      e.terrain = e.mode === 'preview' ? 'coarse' : terrainMode(k, visit, skyMap, e.mode === 'merger', d, pt);
      if (k !== visit && planes && !boxVisible(planes, landBox(k, o), FRUSTUM_PAD)) { e.mode = 'hidden'; e.why += '+frustum'; }
      out[k] = e;
    });
    return out;
  }

  /* ---------------- the triangle estimate (D106) ---------------- */
  function trisEstimate(byIsle, tier, o) {
    o = o || {};
    tier = parseTier(tier) || 'MID';
    var C = coreOf(o), L = lookOf(o), out = {};
    function lod0Of(e) {
      var v = typeof o.tris === 'function' ? o.tris(e.id, e.stateKey, 0, tier) : null;
      return num(v) ? v : (typeof L.trisCap === 'function' ? L.trisCap(e.id, tier) : 0);
    }
    function lod1Of(e, t0, kind) {
      var v = typeof o.tris === 'function' ? o.tris(e.id, e.stateKey, 1, tier) : null;
      if (num(v)) return v;
      if (kind === 'path') return t0;
      var cap = typeof L.TRIS_CAPS_LOD1 === 'function' ? L.TRIS_CAPS_LOD1(e.id) : null;
      return num(cap) ? Math.min(cap, t0) : Math.floor(t0 * LOD1_SHARE);
    }
    Object.keys(byIsle || {}).forEach(function (isle) {
      var list = Array.isArray(byIsle[isle]) ? byIsle[isle] : [];
      var tt = o.terrain, terrain = num(tt) ? tt : (tt && num(tt[isle]) ? tt[isle] : (TERRAIN_TRIS[isle] || 0));
      var r = { lod0: terrain, decor: terrain, all: terrain, terrain: terrain, items: list.length };
      list.forEach(function (e) {
        var it = C.item(e.id), kind = it ? it.kind : null, t0 = lod0Of(e), t1 = lod1Of(e, t0, kind);
        r.lod0 += t0;
        r.decor += kind === 'decor' ? t1 : t0;
        r.all += kind === 'path' || kind === 'landmark' || kind === 'house' ? t0 : t1;
      });
      out[isle] = r;
    });
    return out;
  }

  /* ---------------- per-copy LOD and promotion ---------------- */
  var TABLE = {};
  function promotions() { return {}; }
  function tableOf(o) { return o && o.table && typeof o.table === 'object' ? o.table : TABLE; }
  function nowOf(o) {
    if (o && num(o.now)) return o.now;
    var P = root && root.performance;
    return P && typeof P.now === 'function' ? P.now() / 1000 : Date.now() / 1000;
  }
  function promote(uid, sec, o) {
    if (uid == null) return 0;
    var s = sec === Infinity ? Infinity : (num(sec) && sec > 0 ? sec : 0);
    var until = s === Infinity ? Infinity : nowOf(o) + s + PROMOTE_TAIL;
    tableOf(o)[uid] = until;
    return until;
  }
  /* an ended promotion stays in the table until sweep() hands it back, so the scene re-batches it */
  function promoted(uid, o) {
    var tb = tableOf(o);
    return uid != null && own(tb, uid) && nowOf(o) < tb[uid];
  }
  function sweep(o) {
    var tb = tableOf(o), now = nowOf(o), out = [];
    Object.keys(tb).forEach(function (uid) { if (!(now < tb[uid])) { delete tb[uid]; out.push(uid); } });
    return out;
  }
  function acting(o, uid) {
    var a = o && o.acting;
    if (typeof a === 'function') return !!a(uid);
    return !!(a && typeof a === 'object' && a[uid]);
  }
  function lodFor(entry, itemLod, o) {
    var s = stageIndex(itemLod);
    if (!entry || !s) return 0;
    var it = coreOf(o).item(entry.id), kind = it ? it.kind : null;
    if (kind === 'path' || kind === 'landmark' || kind === 'house') return 0;
    if (s === 1 && kind !== 'decor') return 0;
    return acting(o, entry.uid) || promoted(entry.uid, o) ? 0 : 1;
  }

  /* ================================================================
     TAPS, SIGNS, THE KEYBOARD LIST, BUDGETS
     ================================================================ */
  /* unl null = no unlocked list was given: locked is null (unknown) and the scene hands the tap to
     on.tapIsle, whose host opens the land sheet for a land it does not own */
  function isleRoute(C, kind, isle, unl) {
    return { kind: kind, isle: isle, locked: unl ? !unl[isle] : null, land: isle === 'home' ? null : landOf(C, isle) };
  }
  function actorRoute(target) {
    var t = String(target);
    if (t === 'me') return { kind: 'avatar', target: 'me' };
    var id = t.replace(/^pet:/, '');
    return { kind: 'pet', pet: id, target: 'pet:' + id };
  }
  function cellRoute(cell, visit) {
    return { kind: 'cell', c: cell.c, r: cell.r, x: cell.c, y: cell.r, isle: visit, land: !!cell.land };
  }
  function routeTap(hit, o) {
    hit = hit || {}; o = o || {};
    var mode = normMode(o.mode), visit = isleKey(o.visit), unl = o.unlocked != null ? unlockedSet(o.unlocked) : null;
    var gl = hit.isle && typeof hit.isle === 'object' && ISLES.indexOf(hit.isle.isle) >= 0 ? hit.isle : null;
    var cell = hit.cell && isInt(hit.cell.c) && isInt(hit.cell.r) ? hit.cell : null;
    var C = sibling('SLWorldCore', '../world-core.js') || { ISLES: {} };
    if (o.skyMap) return mode === 'play' && gl ? isleRoute(C, 'isle', gl.isle, unl) : NONE;
    if (mode === 'place') {
      if (num(hit.ghost) && hit.ghost >= 0) return { kind: 'ghost' };
      return cell ? cellRoute(cell, visit) : NONE;
    }
    var item = hit.item && hit.item.uid != null && (hit.item.isle == null || hit.item.isle === visit) ? hit.item : null;
    var actor = mode === 'play' && hit.actor && hit.actor.target ? hit.actor : null;
    if (actor && (!item || !num(item.t) || !num(actor.t) || actor.t <= item.t + OCCLUDE_U)) return actorRoute(actor.target);
    if (item) return { kind: 'item', uid: item.uid };
    if (mode === 'play' && gl && !(gl.kind === 'isle' && gl.isle === visit)) {
      if (gl.kind === 'bridge') return { kind: 'bridge', isle: gl.isle, to: gl.isle === visit ? 'home' : gl.isle, locked: false, land: landOf(C, gl.isle) };
      if (gl.kind === 'gate' || gl.kind === 'isle') return isleRoute(C, gl.kind, gl.isle, unl);
    }
    if (cell && cell.land) return cellRoute(cell, visit);
    if (hit.region && visit === 'home' && typeof hit.region === 'string') {
      var R = C.REGIONS && C.REGIONS[hit.region];
      return { kind: 'region', region: hit.region, land: (R && R.unlock) || 'land_' + hit.region };
    }
    return cell ? cellRoute(cell, visit) : NONE;
  }

  /* which anchors show (D55, host-ui signs3D); island signs get their at */
  function anchorsVisible(list, o) {
    o = o || {};
    var mode = normMode(o.mode), visit = isleKey(o.visit), skyMap = !!o.skyMap, where = null;
    if (typeof o.isleOf === 'function') where = o.isleOf;
    else if (o.items && typeof o.items === 'object') {
      var idx = byUid(o.items).map;
      where = function (uid) { return own(idx, uid) ? idx[uid].isle : null; };
    }
    function width(isle) {
      var w = typeof o.widthPx === 'function' ? o.widthPx(isle) : (o.widthPx && own(o.widthPx, isle) ? o.widthPx[isle] : null);
      return num(w) ? w : Infinity;
    }
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var at = null;
      /* the stage's own key order (uid, pet, me, region, then the new isle) */
      if (a.uid != null) { var k = where ? where(a.uid) : null; if (skyMap || (k != null && k !== visit)) return; }
      else if (a.pet || a.me) { if (skyMap) return; }
      else if (a.region) { if (skyMap || visit !== 'home') return; }
      else if (a.isle != null) {
        if (ISLES.indexOf(a.isle) < 0 || mode !== 'play') return;
        if (skyMap) at = 'map';
        else if (a.isle === visit) return;
        else at = visit === 'home' ? 'gate' : a.isle === 'home' ? 'map' : 'dock';
        if (at !== 'gate' && width(a.isle) < MIN_SIGN_PX) return;
      } else if (!a.key || skyMap) return;
      var c = {};
      for (var key in a) if (own(a, key)) c[key] = a[key];
      if (at) c.at = at;
      out.push(c);
    });
    return out;
  }

  /* the keyboard list's labels (= island3d's itemLabel / petLabel: today's aria-labels) */
  function itemLabel(it, mode, selected) {
    if (!it) return '';
    if (normMode(mode) !== 'play') return it.name + (selected ? ' (selected)' : '') + ' — select to move it';
    return it.name + (it.act === 'launch' ? ' — tap to play' : it.act ? ' — tap to play with it' : '');
  }
  function tr(t, key, vars, fallback) {
    var f = typeof t === 'function' ? t : (t && typeof t.t === 'function' ? t.t : null);
    if (f) { try { return String(f(key, vars, fallback)); } catch (e) { /* the fallback below */ } }
    return String(fallback).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  }
  function petLabel(C, p, t) {
    var it = C.item(p.id), crew = tr(t, 'label.crew', null, 'Crew'), lc = crew.toLowerCase();
    return (p.name || crew + ' member') + ' the ' + (it ? it.name.toLowerCase() : lc + ' member') +
      ' (' + lc + (p.active ? ', runs your obstacle course' : '') + ')';
  }
  function keyboardList(view, t, o) {
    view = view || {}; o = o || {};
    var C = coreOf(o), mode = normMode(view.mode), visit = isleKey(view.isle), skyMap = !!(view.skyMap || view.overview);
    var unl = unlockedSet(Array.isArray(view.unlockedIsles) ? view.unlockedIsles : null), out = [];
    if (!skyMap) {
      var src = visit === 'home' ? view.placed : (view.isles && view.isles[visit]), seen = {};
      (Array.isArray(src) ? src : []).filter(function (p) {
        var it = p && p.uid != null && !own(seen, p.uid) ? C.item(p.id) : null;
        if (!it || (typeof C.isPlaceable === 'function' && !C.isPlaceable(it))) return false;
        seen[p.uid] = 1;
        return mode !== 'play' || !!it.act;
      }).sort(function (a, b) { return (a.y | 0) - (b.y | 0) || (a.x | 0) - (b.x | 0); }).forEach(function (p) {
        out.push({ key: 'u:' + p.uid, label: itemLabel(C.item(p.id), mode, p.uid === view.selectedUid), action: { kind: 'item', uid: p.uid } });
      });
      if (mode === 'play') {
        (Array.isArray(view.pets) ? view.pets : []).forEach(function (p) {
          if (!p || !p.id || (p.isle && p.isle !== visit && !p.active)) return;
          out.push({ key: 'pet:' + p.id, label: petLabel(C, p, t), action: actorRoute('pet:' + p.id) });
        });
        var home = (Array.isArray(view.placed) ? view.placed : []).some(function (p) { return p && p.id === 'house_cottage'; });
        if (view.avatar !== false && (visit !== 'home' || home)) out.push({ key: 'me', label: 'That’s you!', action: actorRoute('me') });
      }
      if (mode !== 'place' && visit === 'home' && C.REGIONS) {
        var regions = toSet(Array.isArray(view.unlocked) && view.unlocked.length ? view.unlocked : ['home']);
        Object.keys(C.REGIONS).forEach(function (rk) {
          var R = C.REGIONS[rk];
          if (!R.unlock || regions[rk]) return;
          out.push({ key: 'region:' + rk, label: '🔒 ' + R.name + ' — see how to unlock it', action: { kind: 'region', region: rk, land: R.unlock } });
        });
      }
    }
    if (mode === 'play') {
      ISLES.forEach(function (k) {
        if (k === visit && !skyMap) return;
        var r = isleRoute(C, 'isle', k, unl), name = isleName(C, k);
        out.push({ key: 'isle:' + k, label: r.locked ? tr(t, 'sr.lockedIsle', { island: name }, '{island}, locked — see how to unlock it') : tr(t, 'sr.flyTo', { island: name }, '{island} — fly there'), action: r });
      });
    }
    return out;
  }

  /* a stage.info() against the tier's BUDGETS → {ok, over: [{key, value, max}]} */
  function budget(info, tier) {
    info = info || {};
    var T = parseTier(tier) || 'MID', B = budgetsOf(null, T), over = [], visit = isleKey(info.isle), skyMap = !!(info.skyMap || info.overview);
    function check(key, value, max) { if (num(value) && num(max) && value > max) over.push({ key: key, value: value, max: max }); }
    check('calls', info.calls, B.drawCalls);
    check('tris', info.tris, B.tris);
    check('programs', info.programs, B.programs);
    check('voxPrograms', info.vox && typeof info.vox === 'object' ? info.vox.programs : info.voxPrograms, B.voxPrograms);
    check('trisWorst', info.tris, B.trisWorst);
    if (skyMap) check('callsMap', info.calls, B.callsMap);
    else if (visit === 'home') { check('callsHome', info.calls, B.callsHome); check('trisHome', info.tris, B.trisHome); }
    var I = info.isles && typeof info.isles === 'object' ? info.isles : null;
    if (I && !skyMap) {
      if (I[visit]) check('trisVisited', I[visit].tris, B.trisVisited);
      if (B.trisRest > 0) {
        var sum = 0, any = false;
        Object.keys(I).forEach(function (k) { if (I[k] && I[k].mode === 'merger' && num(I[k].tris)) { sum += I[k].tris; any = true; } });
        if (any) check('trisRest', sum, B.trisRest);
      }
    }
    return { ok: !over.length, over: over };
  }

  return {
    VERSION: VERSION, ISLES: ISLES, STAGES: STAGES, FAR: FAR, NEAR: NEAR, FRUSTUM_PAD: FRUSTUM_PAD, STEP_BACK: STEP_BACK,
    PROMOTE_TAIL: PROMOTE_TAIL, OCCLUDE_U: OCCLUDE_U, MIN_SIGN_PX: MIN_SIGN_PX, PATH_LAYOUTS: PATH_LAYOUTS, TERRAIN_TRIS: TERRAIN_TRIS,
    itemsOf: itemsOf, diff: diff, policy: policy, routeTap: routeTap, anchorsVisible: anchorsVisible, keyboardList: keyboardList, budget: budget,
    trisEstimate: trisEstimate, lodFor: lodFor, promote: promote, promoted: promoted, sweep: sweep, promotions: promotions,
    /* pure parts, exported for the scene, the lab and the tests */
    pieceMasks: pieceMasks, idNeighbours: idNeighbours, houseStyle: houseStyle, landBox: landBox, frustumPlanes: frustumPlanes,
    boxVisible: boxVisible, terrainMode: terrainMode, stageFor: stageFor, itemLabel: itemLabel, petLabel: petLabel
  };
}));
