/* ================================================================
   My Island 3D — the runtime stage (classic script, browser).
   Loaded by rewards-world (loadScript('world/island3d/stage.js?v=N')).
   Owns the loading of three + its 2 addons + the island3d scripts, the
   device tier, the ONE shared WebGLRenderer (leased to the island now and
   the 3D games later), frame pacing, pausing, context loss, adaptive
   quality and disposal. It never touches the island's rules or DOM.

   window.SLIsland3D
     .boot({ver, deadlineMs = 8000, t0, tier, force}) → Promise<boolean>   island use; mount() is island3d.js
                                        loads core + vox, and also v2 + v2env while island3d.js has not
                                        declared SLIsland3D.v3Scene (D84: the V4.54 island until then)
     .ensure({deadlineMs, tier, groups = ['v2']}) → Promise<SL3D|null>  memoised; loads core + exactly those
                                        script groups WITHOUT mounting a scene. Once SL3D is ready a missing
                                        group is injected and the promise resolves when it has loaded (or at
                                        deadlineMs with SL3D). The games ask for the default 'v2' (their models);
                                        the host's late-3D retry asks for ['vox'] (D68)
     .loadGroup(name) → Promise<bool>   one script group ('core' | 'vox' | 'v2' | 'v2env'): true once every
                                        file of it arrived (the lab and mount({registry: 'v2'}) use v2 + v2env)
     .voxRoute(id, st, C, L) → {handler | api, args}|null   (pure; also exported for Node, D75); a char_* /
                                        wear_* id (kids update) routes to px-people's handler with {key, view}
     .remembered(ver) → {off, why, ver, at}|null (expires after REMEMBER_DAYS), .remember2D(why),
     .forget() ("Try 3D again"), .failed() → reason|null
     .dispose({keepKit})                stop, drop the renderer (force-lost) and the kit caches

   window.SL3D (registry; usable before THREE arrives)
     .defineModels(category, factory(K, SL3D) → {id: {build, idle, act, show}})
     .defineApi(name, factory(K, SL3D) → value)        e.g. 'makeRig', 'makeAvatar', 'makeWand', 'makeFanBlob'
     .defineVox(category, factory(K, SL3D) → {id: handler})   the v3 voxel models (handler.voxels(st, ctx) →
                                        VoxModel is required; build, lod1, idle, act, show… optional); first wins
     .defineVoxApi(name, factory(K, SL3D) → value)     → SL3D.vox[name] ('makeRig', 'makeAvatar', 'makeWand',
                                        'makeFan', 'makeCritter', 'isleDiorama')
     Vox factories and APIs run once SLVoxGL.bind(hub, SL3D) has given the kit its VoxHub (K.vox): after
     init, and again whenever the 'vox' group arrives (also after a game's ensure()).
   …and once ready:
     .THREE, .addons {RoundedBoxGeometry, BufferGeometryUtils}, .tier, .budget, .quality, .models, .missing
       quality {pixelRatio, pixelated, shadows, outlines, particleScale, lifeScale, reflections, cones, decor,
       isles, water, steps[]}: the adaptive LADDER's live state (onQuality listeners hear every step).
       pixelRatio / pixelated follow SLTier.crispRatio for this display (re-picked when devicePixelRatio
       changes, keeping a 'pixelRatio' step already taken); pixelated draws the whole-number upscale
       nearest-neighbour (the shared canvas's CSS image-rendering, crisp kit C5). The
       ladder takes CPU steps (outlines, particles, life, decor, isles) when the frame work is over
       budget and GPU steps (pixelRatio, shadows, water, reflections, cones) when the cadence is
       (SLTier.AdaptiveQuality). 'isles' and 'water' are island-only: taken only while the current
       lease declared them (D82), so every game steps exactly as in V4.54
     .kit(tier) → K                     (kit.js; one K per tier sharing materials and caches)
     .make(id, st, tier) → Object3D     one catalogue item / kart / ball (placeholder if its model is missing);
                                        st.variant (a building's or a home shape's trim) is passed through
     .vox {models, category, missing, ready, make(id, st, tier, {full = true, lod = 0}) → Object3D,
           templates.get(id, stateKey, tier, st, {full, lod}), displayVoxels(id, st) → VoxModel,
           coverage(deep) → missing ids, …apis}
                                        ready = VoxHub bound and every vox factory ran; missing = catalogue
                                        ids with no vox source (coverage(true) also builds each display model:
                                        QA runs it once, the lab on demand). make and displayVoxels follow
                                        voxRoute: a land mascot displays as a pet, land gear as an accessory
                                        on the display pet st.pet (the host passes SLWorldCore.activePetId(w))
     .lease(owner, handlers) → Lease    the shared renderer + paced loop (see Lease below)
     .createRenderer(opts)              a SEPARATE renderer with the tier's settings (photocards)
     .onQuality(fn) → unsubscribe, .info(), .dispose()
   Model/character scripts register only their own SL3D keys; load order never
   affects correctness, and a missing file only means placeholders.
   ================================================================ */
(function (root, factory) {
  var hasDom = typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.createElement;
  var api = factory(root, hasDom);
  if (typeof module === 'object' && module.exports) module.exports = api;   /* Node: the pure helpers, for tests */
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, HAS_DOM) {
  'use strict';

  var VERSION = 1;

  /* Every script the stage injects (relative to this file), by GROUP, in execution order (one
     batch executes in FILES order: async = false). A `global` entry is skipped when that global
     already exists (the app loaded it); `required` files must arrive or 3D is unavailable; the
     rest are tolerated when missing (they land in later build waves: "not built yet").
       core   every page: look, tier, grid, motion, kit, the character clip layer, pets, actors, fx,
              edit, camera, the island scene, photocards, sound, music
       vox    My Island v3 (Pixel Blocks): the voxel engine, the sky world, travel and the px-*.js
              voxel models. It is injected with core on boot (island3d.js reads its siblings only at
              mount), so order inside the batch is the engine first, the model files last: the Home
              models, then px-characters.js (the open SPECIES / ACCS tables) and the files that fill
              them (px-crew, px-mascots-a/b, px-gear), then one to three files per land (pier,
              jungle, treetop, castle, ice: the land shops, D102), the landmarks, then the kids
              update's files appended in contracts.vox KU_VOX order (KU21: plan-v3's vox list stays an
              exact prefix): px-people.js (KU-CH9), then the pets' px-pets-a/b/c.js (the fourteen new
              species, rows of the open SPECIES table) and px-care.js (the feeding bowl, the food
              display models, the memory star) (P2.1)
       v2     the V4.54 models (the games batch tree_palm / umbrella from them, make the karts and
              balls): loaded by ensure() (every game view), never by a v3 island boot
       v2env  the V4.54 island scenery (organic terrain, sea and sky, the city across the bay, its
              life): loaded only for the V4.54 scene (boot until island3d.js declares the v3 scene,
              D84; mount({registry: 'v2'}) in the lab). Not precached. */
  var FILES = [
    { path: '../world-look.js', global: 'SLIslandLook', group: 'core' },
    { path: 'tier.js', global: 'SLTier', required: true, group: 'core' },
    { path: 'grid3d.js', global: 'SLGrid3D', group: 'core' },
    { path: 'motion.js', global: 'SLMotion', group: 'core' },
    { path: 'kit.js', global: 'SLKit', required: true, group: 'core' },
    { path: 'models-characters.js', group: 'core' },
    { path: 'pets-brain.js', global: 'SLPetBrain', group: 'core' },
    { path: 'actors.js', group: 'core' },
    { path: 'fx3d.js', group: 'core' },
    { path: 'edit3d.js', group: 'core' },
    { path: 'camera.js', group: 'core' },
    { path: 'island3d.js', group: 'core' },
    { path: 'photocard.js', global: 'SLPhotocard', group: 'core' },
    { path: '../sound.js', global: 'SLSound', group: 'core' },
    { path: '../music.js', global: 'SLMusic', group: 'core' },
    { path: 'vox.js', global: 'SLVox', group: 'vox' },
    { path: 'vox-gl.js', global: 'SLVoxGL', group: 'vox' },
    { path: 'isles3d.js', global: 'SLIsles3D', group: 'vox' },
    { path: 'isles-gl.js', global: 'SLIslesGL', group: 'vox' },
    { path: 'skylife3d.js', global: 'SLSkyLife3D', group: 'vox' },
    { path: 'sky3d.js', global: 'SLSky3D', group: 'vox' },
    { path: 'isles-view.js', global: 'SLIslesView', group: 'vox' },
    { path: 'isles-travel.js', global: 'SLIslesTravel', group: 'vox' },
    { path: 'px-garden.js', group: 'vox' },
    { path: 'px-paths.js', group: 'vox' },
    { path: 'px-fun.js', group: 'vox' },
    { path: 'px-home.js', group: 'vox' },
    { path: 'px-city.js', group: 'vox' },
    { path: 'px-attractions.js', group: 'vox' },
    { path: 'px-characters.js', group: 'vox' },
    { path: 'px-crew.js', group: 'vox' },
    { path: 'px-mascots-a.js', group: 'vox' },
    { path: 'px-mascots-b.js', group: 'vox' },
    { path: 'px-gear.js', group: 'vox' },
    { path: 'px-pier-a.js', group: 'vox' },
    { path: 'px-pier-b.js', group: 'vox' },
    { path: 'px-pier-c.js', group: 'vox' },
    { path: 'px-jungle-a.js', group: 'vox' },
    { path: 'px-jungle-b.js', group: 'vox' },
    { path: 'px-treetop-a.js', group: 'vox' },
    { path: 'px-treetop-b.js', group: 'vox' },
    { path: 'px-treetop-c.js', group: 'vox' },
    { path: 'px-castle-a.js', group: 'vox' },
    { path: 'px-castle-b.js', group: 'vox' },
    { path: 'px-castle-c.js', group: 'vox' },
    { path: 'px-ice-a.js', group: 'vox' },
    { path: 'px-ice-b.js', group: 'vox' },
    { path: 'px-landmarks.js', group: 'vox' },
    { path: 'px-people.js', group: 'vox' },
    { path: 'px-pets-a.js', group: 'vox' },
    { path: 'px-pets-b.js', group: 'vox' },
    { path: 'px-pets-c.js', group: 'vox' },
    { path: 'px-care.js', group: 'vox' },
    { path: 'models-garden.js', group: 'v2' },
    { path: 'models-home.js', group: 'v2' },
    { path: 'models-fun.js', group: 'v2' },
    { path: 'models-attractions.js', group: 'v2' },
    { path: 'models-city.js', group: 'v2' },
    { path: 'models-stage.js', group: 'v2' },
    { path: 'terrain3d.js', global: 'SLTerrain3D', group: 'v2env' },
    { path: 'env.js', group: 'v2env' },
    { path: 'city3d.js', global: 'SLCity3D', group: 'v2env' },
    { path: 'life3d.js', global: 'SLLife3D', group: 'v2env' }
  ];
  var GROUPS = ['core', 'vox', 'v2', 'v2env'];
  var LEGACY_GROUPS = ['v2', 'v2env'];              /* the V4.54 island, until the v3 scene is declared (D84) */
  var ADDONS = ['three/addons/geometries/RoundedBoxGeometry.js', 'three/addons/utils/BufferGeometryUtils.js'];
  /* kinds that need their own registered model (styles, variants, land, pets and
     accessories render through the house, attractions and character rigs) */
  var MODEL_KINDS = ['house', 'attraction', 'decor', 'path', 'fun', 'cosmetic'];
  /* the vox registry: every MODEL_KIND and the v3 'landmark' kind has its own handler; the display
     kinds route through another handler or a vox API (voxRoute) */
  var VOX_MODEL_KINDS = MODEL_KINDS.concat(['landmark']);
  var VOX_DISPLAY_KINDS = ['style', 'variant', 'pet', 'acc', 'land'];
  /* the kids update's people (KU-CH9): characters and wearables are plug-in items (people-core,
     never in CATALOG) and both draw through ONE handler of px-people.js */
  var VOX_PEOPLE_KINDS = ['char', 'wear'], PEOPLE_HANDLER = 'px_people';
  /* the kids update's pet foods (P1.1 / P2.5): kind 'food' draws through px-care.js's handler of the
     same id (the bag, crate, tin or jar with the food on top) and nothing else */
  var VOX_CARE_KINDS = ['food'];
  var VOX_KEYS = ['models', 'category', 'missing', 'ready', 'make', 'templates', 'displayVoxels', 'coverage'];
  var ISLAND_ONLY = ['isles', 'water'];             /* = SLTier.ISLAND_ONLY (D82) */
  var CORE_KEYS = ['__stage', 'version', 'THREE', 'addons', 'tier', 'budget', 'quality', 'facts', 'tierWhy', 'models', 'modelCategory',
    'missing', 'ready', 'qa', 'issues', 'loaded', 'kit', 'defineModels', 'defineApi', 'make', 'lease', 'createRenderer',
    'onQuality', 'info', 'dispose', 'log', 'FILES', 'vox', 'defineVox', 'defineVoxApi'];
  var REMEMBER_KEY = 'slIsland3D', TIER_KEY = 'slTier3d', PEND_KEY = 'slTier3dPend', LOST_KEY = 'slGlLost';

  /* ================================================================
     PURE HELPERS (exported for Node tests)
     ================================================================ */
  /* where the sibling scripts live, and the ?v= query to reuse */
  function baseFrom(src, baseURI, ver) {
    try {
      if (src) {
        var u = new URL(src, baseURI);
        var q = u.search;
        u.search = ''; u.hash = '';
        return { dir: u.href.replace(/[^\/]*$/, ''), query: q };
      }
    } catch (e) {}
    return { dir: new URL('world/island3d/', baseURI).href, query: '?v=' + (ver || '1') };
  }
  /* the injection list: [{path, url, skip, required, global, group}], every file or only those of
     the named groups (in FILES order either way) */
  function scriptList(base, globals, groups) {
    globals = globals || {};
    return FILES.filter(function (f) { return !groups || groups.indexOf(f.group) >= 0; }).map(function (f) {
      return {
        path: f.path, url: new URL(f.path, base.dir).href + (base.query || ''),
        skip: !!(f.global && globals[f.global]), required: !!f.required, global: f.global || null, group: f.group
      };
    });
  }
  /* the script groups a call asks for: an array → exactly its known names (unknown ones dropped),
     anything else → dflt; deduplicated, in GROUPS order (so a batch executes in FILES order) */
  function groupList(groups, dflt) {
    var src = Array.isArray(groups) ? groups : (dflt || []);
    return GROUPS.filter(function (g) { return src.indexOf(g) >= 0; });
  }

  /* ---------------- the vox display route (D75) ----------------
     Which vox source draws a catalogue id, as data: {id, kind, handler, args} → call
     SL3D.vox.models[handler].voxels(...args), or {id, kind, api, args} → SL3D.vox[api](...args);
     null for an id neither the catalogue (C = SLWorldCore) nor the look (L = SLIslandLook) knows.
       MODEL_KINDS and 'landmark' (lm_*)  their own handler, wearing their resolved style
       style ids (wall_*, roof_*, …)      house_cottage wearing that style (the player's house, as photocards)
       pet_*                              the pet, with its accessories (st.acc); a land mascot (a 'pet'
                                          with an isle: pet_crab …) and the kids update's new species
                                          (px-pets-a/b/c) route the same way, each to its own handler
       acc_*                              the display pet wearing it, and so does land gear (an 'acc' with
                                          an isle: acc_pier_conehat …). The display pet is st.pet when the
                                          look or the catalogue knows it as a pet — the host passes
                                          SLWorldCore.activePetId(w), a V4.54 pet or a mascot — else pet_puppy
       variants and cosmetics             their own handler (px-attractions)
       land_cove / land_meadow            their own diorama handler
       land_<isle>                        the isleDiorama(isle) API (px-landmarks)
       char_* / wear_* (kids update)      the px-people handler (PEOPLE_HANDLER): a character in its
                                          default look and own pieces, or the live look st {look | lk,
                                          wear | wr, vr, member, pose, t}; a wearable on the Fitting
                                          Friend (st.look / lk: on that person instead). The route also
                                          carries key (the template's state key: the id and the st
                                          fields, canonical, so a live look never reuses a stale
                                          template) and view ('back' for a back piece: it is seen
                                          from behind)
       food_* (kids update, kind 'food')  px-care's handler of that id (the food's display model: a bag,
                                          a crate, a tin or a jar with the food on top), no style and
                                          never a pet; photocards draw no food (KU37: its 2D icon)
     The look resolves every id it has an entry for; an id only the catalogue knows (a land-shop id
     while world-look has no entry for it) takes the stage's own rules: a mascot wears st.acc, gear
     sits in its catalogue slot.
     Pure: photocards and coverage use it in the browser (displayVoxels), tests/vox-coverage in Node. */
  var STYLE_SLOTS = { wall: 'wall', roof: 'roof', door: 'door', shape: 'shape' };
  var DISPLAY_PET = 'pet_puppy';                    /* an accessory shown with no display pet given */
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function itemOf(C, id) {
    try { return C && typeof C.item === 'function' ? C.item(id) || null : null; } catch (e) { return null; }
  }
  function lookOf(L, id) { return L && L.LOOK && has(L.LOOK, id) ? L.LOOK[id] : null; }
  /* a pet the look or the catalogue knows: one of the V4.54 pets or a land mascot */
  function isPet(id, C, L) {
    if (typeof id !== 'string' || !id) return false;
    var e = lookOf(L, id), it = e && e.kind === 'pet' ? null : itemOf(C, id);
    return !!(e && e.kind === 'pet') || !!(it && it.kind === 'pet');
  }
  /* a copy of an outfit {slot: accessory id}: string ids only */
  function outfit(acc) {
    var out = {};
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) for (var k in acc) if (has(acc, k) && typeof acc[k] === 'string' && acc[k]) out[k] = acc[k];
    return out;
  }
  function voxRoute(id, st, C, L) {
    if (typeof id !== 'string' || !id) return null;
    var it = itemOf(C, id), look = lookOf(L, id);
    if (!it && !look) return null;
    var kind = (it && it.kind) || (look && look.kind) || '';
    var s = st && typeof st === 'object' ? st : {};
    if (kind === 'style') return { id: id, kind: kind, handler: 'house_cottage', args: [styleOf('house_cottage', s, C, L, id)] };
    if (kind === 'acc') {
      var r = styleOf(id, s, C, L);
      var pet = isPet(s.pet, C, L) ? s.pet : typeof r.pet === 'string' && r.pet ? r.pet : DISPLAY_PET;
      return { id: id, kind: kind, handler: pet, args: [{ acc: r.acc && typeof r.acc === 'object' ? r.acc : {} }] };
    }
    if (kind === 'land') {
      var isle = it && typeof it.isle === 'string' && it.isle ? it.isle : null;
      if (!isle) { var m = /^land_([a-z0-9]+)$/.exec(id); isle = m && C && C.ISLES && C.ISLES[m[1]] ? m[1] : null; }
      if (isle) return { id: id, kind: kind, api: 'isleDiorama', args: [isle] };
      return { id: id, kind: kind, handler: id, args: [{}] };
    }
    if (VOX_PEOPLE_KINDS.indexOf(kind) >= 0) return peopleRoute(id, kind, it, s);
    if (VOX_CARE_KINDS.indexOf(kind) >= 0) return { id: id, kind: kind, handler: id, args: [{}] };
    return { id: id, kind: kind, handler: id, args: [styleOf(id, s, C, L)] };
  }
  /* a character or a wearable: the st fields px-people reads, copied (plain data only), and the key */
  var PEOPLE_ST = ['look', 'lk', 'wear', 'wr', 'vr', 'member', 'pose', 't'];
  function plainCopy(v, depth) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) return v;
    if (!v || typeof v !== 'object' || depth > 3) return undefined;
    if (Array.isArray(v)) return v.map(function (x) { var c = plainCopy(x, depth + 1); return c === undefined ? null : c; });
    var out = {};
    Object.keys(v).sort().forEach(function (k) { var c = plainCopy(v[k], depth + 1); if (c !== undefined) out[k] = c; });
    return out;
  }
  function peopleRoute(id, kind, it, s) {
    var st = { kind: kind, id: id }, key = id;
    PEOPLE_ST.forEach(function (k) {
      var v = has(s, k) ? plainCopy(s[k], 0) : undefined;
      if (v === undefined || v === null) return;
      st[k] = v; key += '|' + k + ':' + JSON.stringify(v);
    });
    return { id: id, kind: kind, handler: PEOPLE_HANDLER, args: [st], key: key, view: kind === 'wear' && it && it.slot === 'back' ? 'back' : 'front' };
  }
  /* the resolved style of a handler id: SLIslandLook.resolveStyle (wearing `wear`, a style id, for
     the house) for an id the look has an entry for; else the stage's own rules with the catalogue:
     resolveSt and its defaults, a pet or mascot in its outfit, an accessory or a piece of land gear
     in its slot (the look's socket, else the catalogue's slot) on the display pet */
  function styleOf(id, st, C, L, wear) {
    var key = wear || id;
    if (L && typeof L.resolveStyle === 'function' && (!L.LOOK || has(L.LOOK, key))) {
      try { var r = L.resolveStyle(key, st); if (r && typeof r === 'object') return r; } catch (e) { /* fall through */ }
    }
    var s = st, it = wear ? null : itemOf(C, id), e = wear ? null : lookOf(L, id);
    var kind = (it && it.kind) || (e && e.kind) || '';
    if (wear) {
      s = {};
      for (var k in st) if (has(st, k)) s[k] = st[k];
      var part = wear.split('_')[0];
      if (STYLE_SLOTS[part]) s[part] = wear;
      else if (part === 'detail') s.details = detailsWith(st.details, wear);
    } else if (kind === 'acc' || /^acc_/.test(id)) {
      var acc = outfit(st.acc);
      acc[(e && e.socket) || (it && (it.slot || it.socket)) || 'hat'] = id;
      return { pet: isPet(st.pet, C, L) ? st.pet : DISPLAY_PET, acc: acc };
    } else if (kind === 'pet') return { acc: outfit(st.acc) };
    return resolveSt(wear ? 'house_cottage' : id, s, C && C.DEFAULTS);
  }
  function detailsWith(d, add) {
    var list = Array.isArray(d) ? d.slice() : d && typeof d === 'object' ? Object.keys(d).filter(function (k) { return !!d[k]; }) : [];
    if (list.indexOf(add) < 0) list.push(add);
    return list.sort();
  }
  /* a display model with nothing to draw: not a model, or no voxels (SLVox.stats when loaded,
     else no layers) */
  function emptyModel(m, Vox) {
    if (!m || typeof m !== 'object') return true;
    if (Vox && typeof Vox.stats === 'function') {
      try { var s = Vox.stats(m); return !(s && s.voxels > 0); } catch (e) { return true; }
    }
    return !(Array.isArray(m.layers) && m.layers.length);
  }
  /* the resolved style for an item: house {wall, roof, door, details, shape, variant};
     att_course {course}; att_pitch {ball, stadium}; att_kart {kart}; pets {acc};
     otherwise st or {} (so a city building's {variant} trim passes straight through) */
  function resolveSt(id, st, defaults) {
    st = st || {}; defaults = defaults || {};
    function pick(k, dflt) { return st[k] || defaults[k] || dflt; }
    if (id === 'house_cottage') {
      return { wall: pick('wall', 'wall_cream'), roof: pick('roof', 'roof_red'), door: pick('door', 'door_blue'), details: st.details || {},
               shape: pick('shape', 'shape_loft'), variant: st.variant | 0 };
    }
    if (id === 'att_course') return { course: pick('course', 'course_meadow') };
    if (id === 'att_pitch') return { ball: pick('ball', 'ball_classic'), stadium: pick('stadium', 'stadium_day') };
    if (id === 'att_kart') return { kart: pick('kart', 'kart_red') };
    if (/^pet_/.test(id)) return { acc: st.acc || {} };
    return st;
  }
  /* the remembered-2D record: {off, why, ver, at}; stale when SL_WORLD_VER changed, a
     parent opened ?3d=1, or it is older than REMEMBER_DAYS (an installed home-screen app
     has no address bar for ?3d=1, so a fallback must not outlast a week). The ONE
     definition of the expiry: shell.js storedVerdict mirrors it (a test checks), and
     photocard.js asks remembered(). Returns {rec, clear} so the caller can tidy storage. */
  var REMEMBER_DAYS = 7;
  function rememberedFrom(raw, ver, search, now) {
    if (/[?&]3d=1(&|$)/.test(search || '')) return { rec: null, clear: true };
    var rec = null;
    try { rec = raw ? JSON.parse(raw) : null; } catch (e) { return { rec: null, clear: true }; }
    if (!rec || typeof rec !== 'object' || !rec.off) return { rec: null, clear: false };
    if (String(rec.ver) !== String(ver)) return { rec: null, clear: true };
    if (rememberStale(rec.at, now)) return { rec: null, clear: true };
    return { rec: rec, clear: false };
  }
  /* undated (every record the stage writes is dated), a week old, or from a clock that ran ahead */
  function rememberStale(at, now) {
    var t = Number(at), n = now != null && isFinite(now) ? Number(now) : Date.now();
    if (at == null || !isFinite(t)) return true;
    return n - t > REMEMBER_DAYS * DAY_MS || t - n > DAY_MS;
  }
  /* the measured tier to save: never raises an earlier saved tier */
  function tierToSave(saved, next, order) {
    order = order || ['LOW', 'MID', 'HIGH'];
    var a = order.indexOf(String(saved || '').toUpperCase()), b = order.indexOf(String(next || '').toUpperCase());
    if (b < 0) return null;
    if (a < 0 || b < a) return order[b];
    return null;
  }
  function normTier(v, order) {
    order = order || ['LOW', 'MID', 'HIGH'];
    if (typeof v !== 'string') return null;
    var t = v.trim().toUpperCase();
    return order.indexOf(t) >= 0 ? t : null;
  }

  /* ---------------- the saved measured tier: {tier, at}, re-measured after savedMaxAgeMs ----------------
     A demotion needs evidence from TWO page sessions: the first session whose own
     paced loop needed 2 quality steps leaves a pending record {tier, sid, at}; a
     LATER session that needs them again saves the tier both agree on (the higher of
     the two). A pending record expires after pendMaxAgeMs, and a long clean run of
     island frames (cleanMs without a step) drops it as a one-off. */
  var DAY_MS = 24 * 60 * 60 * 1000;
  var TIER_POLICY = { savedMaxAgeMs: 30 * DAY_MS, pendMaxAgeMs: 14 * DAY_MS, cleanMs: 180000 };
  /* raw localStorage value → {tier, at, expired, legacy}; expired → the caller removes it,
     legacy (a bare 'LOW' from before records were dated) → the caller re-saves it dated */
  function savedTierFrom(raw, now, maxAgeMs, order) {
    if (raw == null || raw === '') return { tier: null, at: null, expired: false, legacy: false };
    var bare = normTier(String(raw), order);
    if (bare) return { tier: bare, at: null, expired: false, legacy: true };
    var rec = null;
    try { rec = JSON.parse(String(raw)); } catch (e) { rec = null; }
    var t = rec && typeof rec === 'object' ? normTier(rec.tier, order) : null;
    if (!t) return { tier: null, at: null, expired: true, legacy: false };
    var at = Number(rec.at);
    if (rec.at == null || !isFinite(at)) return { tier: t, at: null, expired: false, legacy: true };
    var max = maxAgeMs > 0 ? maxAgeMs : TIER_POLICY.savedMaxAgeMs;
    if (now - at > max) return { tier: null, at: at, expired: true, legacy: false };
    return { tier: t, at: at, expired: false, legacy: false };
  }
  function savedTierRaw(tier, now) { return JSON.stringify({ tier: tier, at: now }); }
  /* a session needed 2 steps (next = the tier below its own). pendRaw: the stored pending
     record. → {save: tier|null, pend}: pend is a string to store, null to remove it,
     undefined to leave it */
  function demotionVerdict(pendRaw, next, sid, now, order, maxAgeMs) {
    order = order || ['LOW', 'MID', 'HIGH'];
    var t = normTier(next, order);
    if (!t) return { save: null, pend: undefined };
    var p = null;
    try { p = pendRaw ? JSON.parse(pendRaw) : null; } catch (e) { p = null; }
    var pt = p && typeof p === 'object' ? normTier(p.tier, order) : null;
    var at = pt ? Number(p.at) : NaN;
    var max = maxAgeMs > 0 ? maxAgeMs : TIER_POLICY.pendMaxAgeMs;
    var fresh = !!pt && isFinite(at) && now - at <= max && at - now <= DAY_MS;
    if (fresh && String(p.sid) !== String(sid)) {
      return { save: order.indexOf(pt) > order.indexOf(t) ? pt : t, pend: null };   /* the demotion both agree on */
    }
    if (fresh) return { save: null, pend: undefined };                            /* this session already voted */
    return { save: null, pend: JSON.stringify({ tier: t, sid: String(sid), at: now }) };
  }

  /* ---------------- context-loss policy ----------------
     Browsers drop WebGL contexts for routine reasons (Safari when the app is
     backgrounded, a GPU-process restart) and restore them; the holders rebuild and
     carry on, so a loss that is RESTORED never counts. A STRIKE is
       - 'unrestored': no restore within restoreMs of VISIBLE time (the clock is
         re-armed on every return to visible, and a timer that fires long after it
         was armed — the page was frozen — is re-armed instead of trusted);
       - 'thrash': a loss within thrashMs of a restore while the page stayed visible
         all along (the rebuilt scene keeps killing the GPU);
       - 'repeat': repeatLosses such visible-since-restore losses within repeatWindowMs.
     A strike ends 3D for this page session. strikesToRemember strikes within
     strikeWindowMs (kept across reloads in sessionStorage) are a persistent cause:
     remember 2D. Times are wall-clock ms (Date.now()). */
  var CONTEXT_POLICY = {
    restoreMs: 6000, slackMs: 2000, thrashMs: 10000, repeatLosses: 3, repeatWindowMs: 120000,
    strikesToRemember: 3, strikeWindowMs: 30 * 60 * 1000
  };
  /* the stored strike list (JSON array of times) → the strikes still inside the window.
     Anything else — including the old plain loss count — is no strikes. */
  function parseStrikes(raw, now, windowMs) {
    var list = raw;
    if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch (e) { list = null; } }
    if (!Array.isArray(list)) return [];
    var w = windowMs > 0 ? windowMs : CONTEXT_POLICY.strikeWindowMs;
    return list.filter(function (t) { return typeof t === 'number' && isFinite(t) && t <= now && now - t < w; });
  }
  /* o: {strikes (stored raw or array), now, hidden, …CONTEXT_POLICY overrides}
     lost(now)   → {act:'ignore'} (already lost) | {act:'wait', armMs} | {act:'fail', why, remember, strikes}
     restored(now) → {act:'resume'} | {act:'ignore'}
     visible(hidden, now) → {armMs}   (the caller clears its timer, then arms it when armMs > 0)
     timeout(now) → {act:'fail', …} | {act:'rearm', armMs} | {act:'ignore'}
     drop()       the lost renderer was thrown away (nobody held it): not a strike
     isLost, hidden, stats() → {lost, hidden, losses, restores, strikes} */
  function ContextLossPolicy(o) {
    o = o || {};
    function opt(k) { return o[k] != null ? o[k] : CONTEXT_POLICY[k]; }
    var restoreMs = opt('restoreMs'), slackMs = opt('slackMs'), thrashMs = opt('thrashMs');
    var repeatLosses = opt('repeatLosses'), repeatWindowMs = opt('repeatWindowMs');
    var need = opt('strikesToRemember'), windowMs = opt('strikeWindowMs');
    var strikes = parseStrikes(o.strikes, o.now != null ? o.now : 0, windowMs);
    var lost = false, hidden = !!o.hidden, steady = false, restoredAt = -Infinity, armedAt = -1;
    var losses = 0, restores = 0, visibleLosses = [];
    function arm(now) {
      if (lost && !hidden) { armedAt = now; return restoreMs; }
      armedAt = -1;
      return 0;
    }
    function strike(why, now) {
      armedAt = -1;
      strikes = parseStrikes(strikes, now, windowMs);
      strikes.push(now);
      return { act: 'fail', why: why, remember: strikes.length >= need, strikes: strikes.slice() };
    }
    return {
      lost: function (now) {
        if (lost) return { act: 'ignore' };
        lost = true; losses++;
        if (!hidden && steady) {
          if (now - restoredAt < thrashMs) return strike('thrash', now);
          visibleLosses = visibleLosses.filter(function (t) { return now - t < repeatWindowMs; });
          visibleLosses.push(now);
          if (visibleLosses.length >= repeatLosses) return strike('repeat', now);
        }
        return { act: 'wait', armMs: arm(now) };
      },
      restored: function (now) {
        armedAt = -1;
        if (!lost) return { act: 'ignore' };
        lost = false; restores++;
        restoredAt = now; steady = !hidden;
        return { act: 'resume' };
      },
      visible: function (isHidden, now) {
        hidden = !!isHidden;
        if (hidden) steady = false;              /* a later loss is explained by the time away */
        return { armMs: arm(now) };
      },
      timeout: function (now) {
        if (!lost || hidden || armedAt < 0) return { act: 'ignore' };
        var waited = now - armedAt;
        if (waited + slackMs < restoreMs) return { act: 'ignore' };                     /* a stale timer */
        if (waited > restoreMs + slackMs) return { act: 'rearm', armMs: arm(now) };      /* the page was frozen */
        return strike('unrestored', now);
      },
      drop: function () { lost = false; armedAt = -1; },
      get isLost() { return lost; },
      get hidden() { return hidden; },
      stats: function () { return { lost: lost, hidden: hidden, losses: losses, restores: restores, strikes: strikes.length }; }
    };
  }
  /* what one holder must hear about the shared context, given what it was told:
     'lost' | 'restored' | null. The current holder hears at once; a holder stacked
     under another one hears when the renderer is handed back (its GPU objects — e.g.
     the island's static shadow map — died with the old context, so it rebuilds then).
     s: {_ctxLost: told lost and not yet restored, _ctxMissed: a loss happened while it
     was stacked}. Updates s unless peek. */
  function contextDue(s, lostNow, peek) {
    var due = null;
    if (lostNow) due = s._ctxLost ? null : 'lost';
    else if (s._ctxLost || s._ctxMissed) due = 'restored';
    if (due && !peek) { s._ctxLost = due === 'lost'; s._ctxMissed = false; }
    return due;
  }

  /* ---------------- the crisp pixel ratio (crisp kit C5) ----------------
     The render scale comes from SLTier.crispRatio / stepRatio: the browser's upscale of the canvas
     is none or a whole n×, and a whole-number upscale is drawn nearest-neighbour through the
     canvas's CSS image-rendering: 'pixelated' first; a browser that does not take it (the style
     reads back empty) gets 'crisp-edges'; one that takes neither keeps the smooth upscale (the
     look before C5, harmless). */
  var CRISP_CSS = ['pixelated', 'crisp-edges'];
  /* the scale for one display: {ratio, n, pixelated} for dpr and the tier's cap, after the ladder's
     'pixelRatio' step when stepped. An older tier.js (no crispRatio) gets the rules before C5:
     min(dpr, cap), and the step 0.25 lower, never under 0.5 */
  function crispFor(Tier, dpr, cap, stepped) {
    var d = Number(dpr) > 0 && isFinite(Number(dpr)) ? Number(dpr) : 1;
    var c = Tier && typeof Tier.crispRatio === 'function' ? Tier.crispRatio(d, cap)
      : { ratio: Math.min(d, Number(cap) > 0 ? Number(cap) : 1), n: 1, pixelated: false };
    if (!stepped) return c;
    if (Tier && typeof Tier.stepRatio === 'function') return Tier.stepRatio(d, c.ratio);
    return { ratio: Math.max(0.5, Math.round((c.ratio - 0.25) * 100) / 100), n: 1, pixelated: false };
  }
  function setIr(s, v) { try { s.imageRendering = v; } catch (e) { /* a style that refuses it: smooth */ } }
  /* the canvas's image-rendering for `on` → the value in force: 'pixelated' | 'crisp-edges' | ''
     (smooth). known: the value this browser took before ('' when it took neither); anything that
     is not a string means not tried yet, so the values are tried in order */
  function crispCss(canvas, on, known) {
    var s = canvas && canvas.style;
    if (!s) return '';
    if (!on) { if (s.imageRendering) setIr(s, ''); return ''; }
    if (typeof known === 'string') {
      if (known && s.imageRendering !== known) setIr(s, known);
      return known && s.imageRendering === known ? known : '';
    }
    if (CRISP_CSS.indexOf(s.imageRendering) >= 0) return s.imageRendering;
    for (var i = 0; i < CRISP_CSS.length; i++) {
      setIr(s, CRISP_CSS[i]);
      if (s.imageRendering === CRISP_CSS[i]) return CRISP_CSS[i];
    }
    if (s.imageRendering) setIr(s, '');
    return '';
  }
  /* one renderer's scale and upscale: setPixelRatio, then the canvas's image-rendering */
  function applyRatio(r, ratio, pixelated, known) {
    if (!r) return '';
    if (Number(ratio) > 0 && typeof r.setPixelRatio === 'function') r.setPixelRatio(Number(ratio));
    return crispCss(r.domElement, !!pixelated, known);
  }

  if (HAS_DOM) install();

  return {
    VERSION: VERSION, FILES: FILES, ADDONS: ADDONS, MODEL_KINDS: MODEL_KINDS,
    GROUPS: GROUPS, LEGACY_GROUPS: LEGACY_GROUPS, groupList: groupList,
    VOX_MODEL_KINDS: VOX_MODEL_KINDS, VOX_DISPLAY_KINDS: VOX_DISPLAY_KINDS, VOX_KEYS: VOX_KEYS, ISLAND_ONLY: ISLAND_ONLY,
    VOX_PEOPLE_KINDS: VOX_PEOPLE_KINDS, PEOPLE_HANDLER: PEOPLE_HANDLER, VOX_CARE_KINDS: VOX_CARE_KINDS,
    voxRoute: voxRoute, emptyModel: emptyModel,
    baseFrom: baseFrom, scriptList: scriptList, resolveSt: resolveSt,
    REMEMBER_DAYS: REMEMBER_DAYS, rememberedFrom: rememberedFrom, tierToSave: tierToSave,
    TIER_POLICY: TIER_POLICY, savedTierFrom: savedTierFrom, savedTierRaw: savedTierRaw, demotionVerdict: demotionVerdict,
    CONTEXT_POLICY: CONTEXT_POLICY, parseStrikes: parseStrikes, ContextLossPolicy: ContextLossPolicy, contextDue: contextDue,
    CRISP_CSS: CRISP_CSS, crispFor: crispFor, crispCss: crispCss, applyRatio: applyRatio
  };

  /* ================================================================
     BROWSER RUNTIME
     ================================================================ */
  function install() {
    var prev = root.SL3D;
    if (prev && prev.__stage) return;                         /* already installed */

    var me = (document.currentScript && document.currentScript.src) || '';
    var BASE = baseFrom(me, document.baseURI, root.SL_WORLD_VER);
    var perfNow = (root.performance && root.performance.now) ? function () { return root.performance.now(); } : Date.now;

    function store(area, op, k, v) {
      try {
        var s = root[area];
        if (op === 'get') return s.getItem(k);
        if (op === 'set') s.setItem(k, v);
        if (op === 'del') s.removeItem(k);
      } catch (e) {}
      return null;
    }
    function ls(op, k, v) { return store('localStorage', op, k, v); }
    function ss(op, k, v) { return store('sessionStorage', op, k, v); }
    var QA = ls('get', 'slQaMode') === '1';
    /* this page session (a demotion needs two different ones) */
    var SESSION = Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);

    /* ---------------- the SL3D registry ---------------- */
    var SL3D = {
      __stage: VERSION, version: VERSION, FILES: FILES,
      THREE: null, addons: null, tier: null, budget: null, quality: null, facts: null, tierWhy: '',
      models: {}, modelCategory: {}, missing: [], ready: false, qa: QA, issues: [], loaded: {}
    };
    if (prev && typeof prev === 'object') {
      Object.keys(prev).forEach(function (k) { if (CORE_KEYS.indexOf(k) < 0) SL3D[k] = prev[k]; });
    }
    root.SL3D = SL3D;
    function log(msg) { if (QA && root.console) root.console.info('[SL3D] ' + msg); }
    function issue(msg) { SL3D.issues.push(msg); if (QA && root.console) root.console.warn('[SL3D] ' + msg); }
    function errText(e) { return e && e.message ? e.message : String(e); }
    function safe(fn) {
      var args = Array.prototype.slice.call(arguments, 1);
      try { return fn.apply(null, args); } catch (e) { issue('handler threw: ' + errText(e)); return undefined; }
    }
    SL3D.log = log;

    var factories = [], apis = [], apiNames = {}, hub = null;
    SL3D.defineModels = function (category, factory) {
      if (typeof factory !== 'function') { issue('defineModels(' + category + '): factory is not a function'); return; }
      var e = { category: String(category || 'misc'), factory: factory, ran: false };
      factories.push(e);
      if (SL3D.ready) { runFactory(e); checkCoverage(); }
    };
    SL3D.defineApi = function (name, factory) {
      if (typeof name !== 'string' || !name || CORE_KEYS.indexOf(name) >= 0) { issue('defineApi: "' + name + '" is reserved or invalid'); return; }
      if (typeof factory !== 'function') { issue('defineApi(' + name + '): factory is not a function'); return; }
      var e = { name: name, factory: factory, ran: false };
      apis.push(e);
      if (SL3D.ready) runApi(e);
    };
    SL3D.kit = function () { return null; };                   /* real one once THREE is ready */
    SL3D.make = make;
    SL3D.lease = lease;
    SL3D.createRenderer = createRenderer;
    SL3D.info = info;
    SL3D.dispose = disposeAll;
    var qualityListeners = [];
    SL3D.onQuality = function (fn) {
      if (typeof fn !== 'function') return function () {};
      qualityListeners.push(fn);
      return function () { var i = qualityListeners.indexOf(fn); if (i >= 0) qualityListeners.splice(i, 1); };
    };

    function runFactory(e) {
      if (e.ran) return;
      e.ran = true;
      var out;
      try { out = e.factory(SL3D.kit(SL3D.tier), SL3D); } catch (err) { issue('models "' + e.category + '" factory threw: ' + errText(err)); return; }
      if (!out || typeof out !== 'object') { issue('models "' + e.category + '" factory returned nothing'); return; }
      Object.keys(out).forEach(function (id) {
        var h = out[id];
        if (!h || typeof h !== 'object') { issue('model ' + id + ' is not an object'); return; }
        if (typeof h.build !== 'function') issue('model ' + id + ' has no build() (placeholder)');
        if (SL3D.models[id]) { issue('model ' + id + ' registered by "' + SL3D.modelCategory[id] + '" and "' + e.category + '"; keeping the first'); return; }
        SL3D.models[id] = h;
        SL3D.modelCategory[id] = e.category;
      });
    }
    function runApi(e) {
      if (e.ran) return;
      e.ran = true;
      var v;
      try { v = e.factory(SL3D.kit(SL3D.tier), SL3D); } catch (err) { issue('api ' + e.name + ' factory threw: ' + errText(err)); return; }
      if (v == null) { issue('api ' + e.name + ' factory returned nothing'); return; }
      if (apiNames[e.name]) { issue('api ' + e.name + ' defined twice; keeping the first'); return; }
      apiNames[e.name] = true;
      SL3D[e.name] = v;
    }
    /* the v2 registry's coverage. v3-only ids (it.isle: the sky lands, their landmarks and themed
       items) never get a v2 model: SL3D.vox.missing covers them */
    function checkCoverage() {
      var L = root.SLIslandLook, C = root.SLWorldCore, miss = [];
      var ids = L && L.LOOK ? Object.keys(L.LOOK) : (C && C.CATALOG ? C.CATALOG.map(function (i) { return i.id; }) : []);
      ids.forEach(function (id) {
        var it = null;
        try { it = C && typeof C.item === 'function' ? C.item(id) : null; } catch (e) { it = null; }
        if (it && it.isle) return;
        var kind = (it && it.kind) || (L && L.LOOK && L.LOOK[id] && L.LOOK[id].kind) || '';
        if (MODEL_KINDS.indexOf(kind) < 0) return;
        if (!SL3D.models[id] || typeof SL3D.models[id].build !== 'function') miss.push(id);
      });
      SL3D.missing = miss;
      if (miss.length) log('no model yet for ' + miss.length + ' ids (placeholders): ' + miss.join(', '));
    }

    /* ---------------- the vox registry (My Island v3) ----------------
       Factories run once the VoxHub is bound (their handlers build through K.vox, and px-characters
       defines its portrait atlas cells while it runs); until then they wait, as defineModels does
       for THREE. */
    var voxFactories = [], voxApis = [], voxApiNames = {}, voxHub = null, voxDeepDone = false;
    var VOX = {
      models: {}, category: {}, missing: [], ready: false,
      make: voxMake, templates: { get: voxTemplate }, displayVoxels: displayVoxels, coverage: voxCoverage
    };
    SL3D.vox = VOX;
    SL3D.defineVox = function (category, factory) {
      if (typeof factory !== 'function') { issue('defineVox(' + category + '): factory is not a function'); return; }
      var e = { category: String(category || 'misc'), factory: factory, ran: false };
      voxFactories.push(e);
      if (voxHub) { runVoxFactory(e); voxSettle(); }
    };
    SL3D.defineVoxApi = function (name, factory) {
      if (typeof name !== 'string' || !name || VOX_KEYS.indexOf(name) >= 0) { issue('defineVoxApi: "' + name + '" is reserved or invalid'); return; }
      if (typeof factory !== 'function') { issue('defineVoxApi(' + name + '): factory is not a function'); return; }
      var e = { name: name, factory: factory, ran: false };
      voxApis.push(e);
      if (voxHub) { runVoxApi(e); voxSettle(); }
    };
    function runVoxFactory(e) {
      if (e.ran) return;
      e.ran = true;
      var out;
      try { out = e.factory(SL3D.kit(SL3D.tier), SL3D); } catch (err) { issue('vox "' + e.category + '" factory threw: ' + errText(err)); return; }
      if (!out || typeof out !== 'object') { issue('vox "' + e.category + '" factory returned nothing'); return; }
      Object.keys(out).forEach(function (id) {
        var h = out[id];
        if (!h || typeof h !== 'object' || typeof h.voxels !== 'function') { issue('vox model ' + id + ' has no voxels() (missing)'); return; }
        if (VOX.models[id]) { issue('vox model ' + id + ' registered by "' + VOX.category[id] + '" and "' + e.category + '"; keeping the first'); return; }
        VOX.models[id] = h;
        VOX.category[id] = e.category;
      });
    }
    function runVoxApi(e) {
      if (e.ran) return;
      e.ran = true;
      var v;
      try { v = e.factory(SL3D.kit(SL3D.tier), SL3D); } catch (err) { issue('vox api ' + e.name + ' factory threw: ' + errText(err)); return; }
      if (v == null) { issue('vox api ' + e.name + ' factory returned nothing'); return; }
      if (voxApiNames[e.name]) { issue('vox api ' + e.name + ' defined twice; keeping the first'); return; }
      voxApiNames[e.name] = true;
      VOX[e.name] = v;
    }
    function voxSettle() {
      VOX.ready = !!voxHub && voxFactories.every(function (e) { return e.ran; }) && voxApis.every(function (e) { return e.ran; });
      voxCoverage(false);
    }
    /* SLVoxGL.bind(hub, SL3D) → the VoxHub (once: after init, or when the 'vox' group arrives later,
       e.g. the island booting after a game's ensure()); then every waiting vox factory runs */
    function bindVox() {
      if (!SL3D.ready || !hub) return false;
      if (!voxHub) {
        var GL = root.SLVoxGL, v = null;
        if (!GL || typeof GL.bind !== 'function') return false;
        try { v = GL.bind(hub, SL3D); } catch (e) { issue('vox: SLVoxGL.bind threw: ' + errText(e)); return false; }
        if (!v) { issue('vox: SLVoxGL.bind returned no VoxHub'); return false; }
        voxHub = v;
        if (typeof hub.bindVox === 'function') hub.bindVox(v); else hub.vox = v;
        log('vox: VoxHub bound (' + SL3D.tier + ')');
      }
      voxFactories.forEach(runVoxFactory);
      voxApis.forEach(runVoxApi);
      voxSettle();
      if (QA && !voxDeepDone) { voxDeepDone = true; voxCoverageSliced(); }
      return true;
    }
    /* QA: the deep coverage check, so building every display model never costs a frame during mount (D70). R2
       (QA2D-3): one model is a single unit that can take tens of ms (the old '4 ms' slice ran a whole model, and then
       the next, past its budget), so it is ONE id per idle moment that has VOX_IDLE_MS left (or that waited its full
       timeout), and the check starts VOX_DEEP_DELAY after the boot, never inside it */
    var VOX_DEEP_DELAY = 15000, VOX_IDLE_MS = 12;
    function voxCoverageSliced() {
      var C = root.SLWorldCore, L = root.SLIslandLook, ids = catalogIds(C, L), i = 0, miss = [];
      function later(fn) { if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(fn, { timeout: 10000 }); else setTimeout(fn, 250); }
      function slice(dl) {
        var room = !dl || typeof dl.timeRemaining !== 'function' || dl.didTimeout || dl.timeRemaining() >= VOX_IDLE_MS;
        if (room && i < ids.length) { if (deepMissing(ids[i], C, L)) miss.push(ids[i]); i++; }
        if (i < ids.length) { later(slice); return; }
        VOX.missing = miss;
        log('vox coverage (built and checked): ' + (miss.length ? miss.length + ' missing: ' + miss.join(', ') : 'every catalogue id draws'));
      }
      setTimeout(function () { later(slice); }, VOX_DEEP_DELAY);
    }
    function routeTarget(r) {
      if (r.api) return typeof VOX[r.api] === 'function';
      var h = VOX.models[r.handler];
      return !!(h && typeof h.voxels === 'function');
    }
    function runRoute(r) {
      if (r.api) return VOX[r.api].apply(null, r.args);
      var h = VOX.models[r.handler];
      return h.voxels.apply(h, r.args);
    }
    /* the VoxModel a catalogue id displays as (photocards, coverage); throws when it has no source */
    function displayVoxels(id, st) {
      var r = voxRoute(id, st, root.SLWorldCore, root.SLIslandLook);
      if (!r) throw new Error('no vox route for "' + id + '"');
      if (!routeTarget(r)) throw new Error('no vox model for "' + (r.api || r.handler) + '" (' + id + ')');
      return runRoute(r);
    }
    /* SL3D.vox.missing = every catalogue id with no vox source. deep: also build each display model
       and count an empty or throwing one as missing (the lab asks for it; QA runs it once after the
       bind in idle slices; the boot itself never pays for it) */
    function catalogIds(C, L) {
      return C && Array.isArray(C.CATALOG) ? C.CATALOG.map(function (i) { return i.id; }) : (L && L.LOOK ? Object.keys(L.LOOK) : []);
    }
    function deepMissing(id, C, L) {
      var r = voxRoute(id, null, C, L), m = null;
      if (!r) return false;                                   /* not a catalogue id */
      if (!routeTarget(r)) return true;
      try { m = runRoute(r); } catch (e) { m = null; }
      return emptyModel(m, root.SLVox);
    }
    function voxCoverage(deep) {
      var C = root.SLWorldCore, L = root.SLIslandLook, miss = [];
      catalogIds(C, L).forEach(function (id) {
        if (deep) { if (deepMissing(id, C, L)) miss.push(id); return; }
        var r = voxRoute(id, null, C, L);
        if (r && !routeTarget(r)) miss.push(id);
      });
      VOX.missing = miss;
      if (miss.length && voxHub) log('vox: no model yet for ' + miss.length + ' ids' + (deep ? ' (built and checked)' : '') + ': ' + miss.join(', '));
      return miss.slice();
    }
    /* a namespaced vox template: 'vox' (the island), 'vox-full' (every face) or 'vox-lod1' */
    function voxNs(o) { return o && o.lod === 1 ? 'vox-lod1' : o && o.full ? 'vox-full' : 'vox'; }
    function voxTemplate(id, stateKey, tier, st, o) {
      if (!SL3D.ready || !voxHub) return null;
      var t = root.SLTier.parseTier(tier) || SL3D.tier;
      return SL3D.kit(t).templates.get(id, stateKey, t, st, voxNs(o));
    }
    /* one standalone vox copy (photocards, turntables): the display route's handler wearing its
       style, every face kept unless {full: false}; an API-drawn id (a sky land diorama) → null */
    function voxMake(id, st, tier, o) {
      if (!SL3D.ready || !voxHub) return null;
      o = o || {};
      var r = voxRoute(id, st, root.SLWorldCore, root.SLIslandLook);
      if (!r || !r.handler) return null;
      var t = root.SLTier.parseTier(tier) || SL3D.tier, K = SL3D.kit(t), rs = r.args[0] || {};
      var sk = typeof r.key === 'string' ? r.key : K.stateKey(r.handler, rs);         /* a people route keys itself */
      var tpl = K.templates.get(r.handler, sk, t, rs, voxNs({ full: o.full !== false, lod: o.lod }));
      var obj = K.instantiate(tpl, { outlines: false });
      obj.userData.model = VOX.models[r.handler] || null;
      return obj;
    }
    function catalogDefaults() {
      var C = root.SLWorldCore;
      return (C && C.DEFAULTS) || {};
    }

    /* ---------------- make(id, st, tier) → Object3D ---------------- */
    function make(id, st, tier) {
      if (!SL3D.ready) return null;
      var t = root.SLTier.parseTier(tier) || SL3D.tier;
      var K = SL3D.kit(t);
      var rs = resolveSt(id, st, catalogDefaults());
      var tpl = K.templates.get(id, K.stateKey(id, rs), t, rs);
      /* models with a textured part (e.g. the PET COURSE banner) hand over their material */
      var mdl = SL3D.models[id];
      var obj = K.instantiate(tpl, { outlines: SL3D.quality.outlines, material: mdl && mdl.material ? mdl.material : undefined });
      obj.userData.model = SL3D.models[id] || null;
      return obj;
    }

    /* ---------------- loading ---------------- */
    var loadP = null, permanent = null, sessionFail = null, injected = {};
    function setPermanent(why) { if (!permanent) { permanent = why; log('3D unavailable: ' + why); } }
    var dynImport = (function () {
      try { var f = new Function('u', 'return import(u)'); return function (u) { try { return f(u); } catch (e) { return Promise.reject(e); } }; }
      catch (e) { return function () { return Promise.reject(new Error('dynamic import unavailable')); }; }
    }());
    function probeGL() {
      var out = { webgl2: false, maxTex: 0, caveat: false };
      function tryCtx(attrs) {
        try {
          var c = document.createElement('canvas');
          var gl = c.getContext('webgl2', attrs);
          if (!gl) return false;
          out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
          var ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
          return true;
        } catch (e) { return false; }
      }
      if (tryCtx({ failIfMajorPerformanceCaveat: true })) out.webgl2 = true;
      else if (tryCtx({})) { out.webgl2 = true; out.caveat = true; }   /* software / blocklisted GPU: LOW */
      return out;
    }
    /* one file: true once it has loaded (or its global was already there), false when it failed */
    function inject(f) {
      if (f.skip) { SL3D.loaded[f.path] = 'present'; return Promise.resolve(true); }
      if (injected[f.url]) return injected[f.url];
      return (injected[f.url] = new Promise(function (res) {
        var s = document.createElement('script');
        s.src = f.url;
        s.async = false;                                   /* parallel download, ordered execution */
        s.onload = function () { SL3D.loaded[f.path] = true; res(true); };
        s.onerror = function () { SL3D.loaded[f.path] = false; if (f.required) issue('required file missing: ' + f.path); else log('not built yet: ' + f.path); res(false); };
        document.head.appendChild(s);
      }));
    }
    /* the script groups: each injected once (memoised), settled when every file of it has loaded or
       failed; groupDone[name] = true when all of them arrived, false when some are not built yet */
    var groupP = {}, groupDone = {};
    function loadGroup1(name) {
      if (groupP[name]) return groupP[name];
      return (groupP[name] = Promise.all(scriptList(BASE, root, [name]).map(inject)).then(function (oks) {
        var ok = oks.every(Boolean);
        groupDone[name] = ok;
        log('group ' + name + (ok ? ' loaded' : ' loaded (some files not built yet)'));
        if (name === 'vox' && SL3D.ready) bindVox();      /* the vox group arriving after init (D68) */
        return ok;
      }));
    }
    /* several groups in one batch: appended in GROUPS order, so they execute in FILES order */
    function loadGroups(names) {
      return Promise.all(groupList(names).map(loadGroup1)).then(function (r) { return r.every(Boolean); });
    }
    function v3Scene() { return !!(root.SLIsland3D && root.SLIsland3D.v3Scene); }
    function load(opts, want, legacy) {
      if (ls('get', 'slNo3D') === '1') { setPermanent('slNo3D'); return Promise.resolve(false); }
      if (typeof root.slLoad3D !== 'function') { setPermanent('no slLoad3D'); return Promise.resolve(false); }
      if (typeof root.WebGL2RenderingContext === 'undefined') { setPermanent('no WebGL2'); return Promise.resolve(false); }
      var gl = probeGL();
      if (!gl.webgl2) { setPermanent('no WebGL2 context'); return Promise.resolve(false); }
      var tP = Promise.resolve().then(function () { return root.slLoad3D(); }).catch(function () { return null; });
      var aP = Promise.all(ADDONS.map(dynImport)).then(function (m) {
        return { RoundedBoxGeometry: m[0] && m[0].RoundedBoxGeometry, BufferGeometryUtils: m[1] };
      }).catch(function (e) { log('addon import failed: ' + errText(e)); return null; });
      /* core + the asked groups; the island boot then checks the scene island3d.js declared: until
         it is the v3 one, the V4.54 models and scenery load too, before init (D84) */
      var sP = loadGroups(['core'].concat(want)).then(function () {
        return legacy && !v3Scene() ? loadGroups(LEGACY_GROUPS) : true;
      });
      var all = Promise.all([tP, aP, sP]).then(function (r) {
        if (SL3D.ready) return true;
        var T = r[0], addons = r[1];
        if (!T || !T.WebGLRenderer) { setPermanent('three did not load'); return false; }
        if (!addons || !addons.RoundedBoxGeometry) { setPermanent('addons did not load'); return false; }
        if (!root.SLTier || !root.SLKit) { setPermanent('tier.js / kit.js missing'); return false; }
        try { init(T, addons, gl, opts); } catch (e) { issue('init failed: ' + errText(e)); setPermanent('init'); return false; }
        return true;
      });
      /* an outer guard: a stalled request frees the memo so a later open may retry
         (the work above still completes and readies SL3D if it arrives) */
      var guard = new Promise(function (res) { setTimeout(function () { res(false); }, opts.loadTimeoutMs || 20000); });
      return Promise.race([all, guard]);
    }
    /* the games, photocards and the host's late-3D retry: core + exactly opts.groups (default the
       games' 'v2'). An unknown group name is dropped. */
    function ensure(opts) {
      opts = opts || {};
      var want = groupList(opts.groups, ['v2']);
      if (Array.isArray(opts.groups)) opts.groups.forEach(function (g) { if (GROUPS.indexOf(g) < 0) issue('ensure: unknown script group "' + g + '"'); });
      return ensureGroups(opts, want, false);
    }
    /* legacy: the island boot (also v2 + v2env while island3d.js has not declared the v3 scene) */
    function ensureGroups(opts, want, legacy) {
      if (!HAS_DOM) return Promise.resolve(null);
      var p;
      if (SL3D.ready) {
        p = more(want, legacy);
        if (!p) return Promise.resolve(SL3D);               /* everything asked for is in */
      } else if (permanent) return Promise.resolve(null);
      else {
        if (!loadP) {
          loadP = load(opts, want, legacy).then(function (ok) {
            if (!ok) loadP = null;
            return ok || SL3D.ready ? SL3D : null;
          }, function (e) { issue('load: ' + errText(e)); loadP = null; return null; });
        }
        /* an earlier caller's load may have asked for other groups: add ours once it is in */
        p = loadP.then(function (s) { return s ? more(want, legacy) || SL3D : null; });
      }
      var ms = Number(opts.deadlineMs);
      if (ms > 0 && isFinite(ms)) {
        p = Promise.race([p, new Promise(function (res) { setTimeout(function () { res(SL3D.ready ? SL3D : null); }, ms); })]);
      }
      return p;
    }
    /* SL3D is ready: inject the wanted groups not loaded yet (D68) → a promise of SL3D once they
       have loaded, or null when nothing is missing */
    function more(want, legacy) {
      var need = legacy && !v3Scene() ? want.concat(LEGACY_GROUPS) : want;
      for (var i = 0; i < need.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(groupDone, need[i])) return loadGroups(need).then(function () { return SL3D; });
      }
      return null;
    }

    /* ---------------- tier + init ---------------- */
    var aq = null, pacer = null, aqSkip = [];                   /* aqSkip: steps the tier's budget starts without */
    function readSavedTier() {
      var now = Date.now(), r = savedTierFrom(ls('get', TIER_KEY), now, TIER_POLICY.savedMaxAgeMs, root.SLTier.TIERS);
      if (r.expired) { ls('del', TIER_KEY); log('saved tier expired: measuring again'); }
      else if (r.legacy && r.tier) ls('set', TIER_KEY, savedTierRaw(r.tier, now));   /* start its expiry clock */
      return r.tier;
    }
    function saveTier(t) {
      var v = tierToSave(readSavedTier(), t, root.SLTier.TIERS);
      if (v) { ls('set', TIER_KEY, savedTierRaw(v, Date.now())); log('saved tier ' + v); }
    }
    function qaTier() {
      if (!QA) return null;
      try { var m = /[?&]tier=(low|mid|high)\b/i.exec(root.location.search); return m ? m[1].toUpperCase() : null; } catch (e) { return null; }
    }
    function init(T, addons, gl, opts) {
      if (SL3D.ready) return;
      var Tier = root.SLTier;
      var f = Tier.facts(root.navigator, { maxTex: gl.maxTex, caveat: gl.caveat, saved: readSavedTier() });
      var ex = Tier.explain(f);
      var tier = Tier.parseTier(opts.tier) || qaTier() || ex.tier;
      SL3D.THREE = T;
      SL3D.addons = addons;
      SL3D.facts = f;
      SL3D.tierWhy = tier === ex.tier ? ex.why : 'override (' + ex.why + ')';
      SL3D.tier = tier;
      dprNow = dprOf();
      SL3D.budget = Tier.budget(tier, dprNow);
      /* isles: the islands the child is not on stay live merged layers (false: LOD1 bakes; LOW's
         isleMode 'bake' starts there, as LOW starts without shadows); water: it animates */
      SL3D.quality = {
        pixelRatio: SL3D.budget.pixelRatio, pixelated: !!SL3D.budget.pixelated,
        shadows: !!SL3D.budget.shadows, outlines: !!SL3D.budget.outlines,
        particleScale: 1, lifeScale: 1, reflections: true, cones: true, decor: true,
        isles: SL3D.budget.isleMode !== 'bake', water: true, steps: []
      };
      if (Array.isArray(Tier.ISLAND_ONLY)) islandOnly = Tier.ISLAND_ONLY.slice();
      if (!SL3D.budget.shadows) aqSkip.push('shadows');
      if (!SL3D.budget.outlines) aqSkip.push('outlines');
      if (!SL3D.quality.isles) aqSkip.push('isles');
      aq = newAQ(aqSkip.slice());
      pacer = Tier.FramePacer({});
      hub = root.SLKit.create(T, {
        addons: addons, models: SL3D.models, qa: QA,
        look: function () { return root.SLIslandLook || null; },
        registries: { vox: VOX.models, 'vox-full': VOX.models, 'vox-lod1': VOX.models }   /* K4 */
      });
      SL3D.kit = function (t) { return hub.kit(Tier.parseTier(t) || SL3D.tier); };
      if (!SL3D.quality.outlines) hub.setOutlines(false);
      factories.forEach(runFactory);
      apis.forEach(runApi);
      checkCoverage();
      SL3D.ready = true;
      bindVox();                                               /* when vox-gl.js is in: the VoxHub, then the vox factories */
      listen();
      log('ready: tier ' + tier + ' (' + SL3D.tierWhy + '), ' + Object.keys(SL3D.models).length + ' models, ' +
        Object.keys(VOX.models).length + ' vox models' + (voxHub ? '' : ' (no VoxHub yet)'));
    }
    /* D82: the island-only steps ('isles', 'water') are taken only while the holder of the renderer
       declared them (lease handlers.steps); every other step as in V4.54 */
    var islandOnly = ISLAND_ONLY.slice();
    function stepAllowed(step) {
      if (islandOnly.indexOf(step) < 0) return true;
      return !!current && current._steps.indexOf(step) >= 0;
    }
    function newAQ(skip) { return root.SLTier.AdaptiveQuality({ skip: skip, allow: stepAllowed }); }

    /* ---------------- the crisp pixel ratio (C5) ----------------
       dprNow: the devicePixelRatio the scale was picked for; crispKnown: the image-rendering value
       this browser took on its first pixelated canvas ('' when it took neither), so the guard
       below never re-tries a refused value every frame */
    var dprNow = 1, crispKnown = null, crispMo = null, dprMq = null, dprMqFn = null;
    function dprOf() { var d = Number(root.devicePixelRatio); return d > 0 && isFinite(d) ? d : 1; }
    function setRatio(r, ratio, on) {
      var v = applyRatio(r, ratio, on, crispKnown);
      if (on && crispKnown == null) crispKnown = v;
      return v;
    }
    /* the holders restyle the shared canvas (island3d's placeCanvas and the games set its
       style.cssText), which drops image-rendering: it is put back by a MutationObserver on the
       canvas's style, at every grant, and on every stage frame and held sample (a style read) */
    function keepCrisp() {
      var q = SL3D.quality;
      if (!renderer || !q) return;
      var v = crispCss(renderer.domElement, !!q.pixelated, crispKnown);
      if (q.pixelated && crispKnown == null) crispKnown = v;
    }
    function watchCrisp(c) {
      if (typeof root.MutationObserver !== 'function') return;
      try { crispMo = new root.MutationObserver(keepCrisp); crispMo.observe(c, { attributes: true, attributeFilter: ['style'] }); } catch (e) { crispMo = null; }
    }
    function unwatchCrisp() { if (crispMo) { try { crispMo.disconnect(); } catch (e) {} crispMo = null; } }
    /* the display changed (the window moved to another screen, the browser zoomed): the scale is
       picked again for the new devicePixelRatio, keeping a 'pixelRatio' step already taken. Asked
       on window resize, a resolution media-query change, every Lease.resize, every grant, and on
       every stage frame and held sample (Chrome can defer the media-query event until something
       repaints; the frame check is one property read) */
    function checkDpr() {
      var q = SL3D.quality, b = SL3D.budget, d = dprOf();
      if (!q || !b || d === dprNow) return false;
      var was = dprNow, base = crispFor(root.SLTier, d, b.pixelRatioCap, false);
      var c = q.steps.indexOf('pixelRatio') >= 0 ? crispFor(root.SLTier, d, b.pixelRatioCap, true) : base;
      dprNow = d;
      b.pixelRatio = base.ratio; b.pixelated = !!base.pixelated;
      q.pixelRatio = c.ratio; q.pixelated = !!c.pixelated;
      if (renderer) setRatio(renderer, q.pixelRatio, q.pixelated);
      if (pacer) pacer.invalidate();
      watchDpr();
      log('display ratio ' + was + ' → ' + d + ': render scale ' + Math.round(q.pixelRatio * 1000) / 1000 + (q.pixelated ? ' drawn ×' + c.n + ' pixelated' : ''));
      return true;
    }
    function watchDpr() {
      if (typeof root.matchMedia !== 'function') return;
      try {
        if (dprMq && dprMqFn) { if (dprMq.removeEventListener) dprMq.removeEventListener('change', dprMqFn); else if (dprMq.removeListener) dprMq.removeListener(dprMqFn); }
        dprMq = root.matchMedia('(resolution: ' + dprNow + 'dppx)');
        dprMqFn = function () { checkDpr(); };
        if (dprMq.addEventListener) dprMq.addEventListener('change', dprMqFn); else if (dprMq.addListener) dprMq.addListener(dprMqFn);
      } catch (e) { dprMq = null; dprMqFn = null; }
    }
    /* uVoxGain (vox-gl VERSION 2, crisp C1) is shared by every holder of the renderer: a grant puts
       it back to 1, so a holder that never fits it (a game before CR5) renders exactly as before; the
       island's sky writes its own fitted gain on its next frame, and a game that opted in sets its
       gain after the grant. An older vox-gl has no gain: nothing to do */
    function resetVoxGain() {
      var v = voxHub;
      if (!v) return;
      try {
        if (typeof v.setGain === 'function') v.setGain(1);
        else if (v.uniforms && v.uniforms.uVoxGain) v.uniforms.uVoxGain.value = 1;
      } catch (e) { issue('vox: setGain threw: ' + errText(e)); }
    }

    /* ---------------- renderers ---------------- */
    function createRenderer(o) {
      o = o || {};
      var T = SL3D.THREE;
      if (!T) return null;
      try {
        var r = new T.WebGLRenderer({
          canvas: o.canvas, antialias: o.antialias != null ? !!o.antialias : !!SL3D.budget.antialias,
          alpha: !!o.alpha, stencil: false, depth: true, premultipliedAlpha: true,
          preserveDrawingBuffer: !!o.preserveDrawingBuffer, powerPreference: o.powerPreference || 'high-performance'
        });
        r.outputColorSpace = T.SRGBColorSpace;
        r.toneMapping = T.NeutralToneMapping != null ? T.NeutralToneMapping : T.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.0;
        /* the tier's crisp scale and upscale, or the caller's own ratio (photocards: 1, smooth) */
        if (o.pixelRatio) setRatio(r, o.pixelRatio, !!o.pixelated);
        else setRatio(r, SL3D.quality.pixelRatio, SL3D.quality.pixelated);
        r.shadowMap.enabled = o.shadows != null ? !!o.shadows : SL3D.quality.shadows;
        r.shadowMap.type = T.PCFShadowMap;
        r.shadowMap.autoUpdate = false;                       /* the static map is re-rendered only on layout changes */
        if (o.width && o.height) r.setSize(o.width, o.height, false);
        r.domElement.style.display = 'block';
        return r;
      } catch (e) { issue('renderer: ' + errText(e)); return null; }
    }
    /* Context loss (see ContextLossPolicy): a restored loss is routine — the holders
       rebuild — and only strikes (unrestored after 6 s of visible time, or losses
       that keep coming back while the page stays visible) end 3D for the session;
       3 strikes within 30 min remember 2D. parked: the page is hidden by pagehide. */
    var renderer = null, lost = false, restoreTimer = 0, disposing = false, parked = false;
    var ctx = ContextLossPolicy({ strikes: ss('get', LOST_KEY), now: Date.now(), hidden: !!document.hidden });
    function shared() {
      if (renderer) return renderer;
      renderer = createRenderer({});
      if (!renderer) return null;
      renderer.domElement.addEventListener('webglcontextlost', onLost, false);
      renderer.domElement.addEventListener('webglcontextrestored', onRestored, false);
      watchCrisp(renderer.domElement);
      return renderer;
    }
    function holders() { return stack.length > 0 || !!current; }
    function armRestore(ms) {
      if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = 0; }
      if (ms > 0) restoreTimer = setTimeout(onRestoreTimeout, ms);
    }
    /* a lost renderer nobody holds is just thrown away: the next lease makes a fresh one */
    function retire() {
      var r = renderer;
      armRestore(0);
      ctx.drop();
      lost = false;
      if (!r) return;
      renderer = null;
      unwatchCrisp();
      var c = r.domElement;
      c.removeEventListener('webglcontextlost', onLost, false);
      c.removeEventListener('webglcontextrestored', onRestored, false);
      try { r.setAnimationLoop(null); } catch (e) {}
      try { r.dispose(); } catch (e) {}
      if (c.parentNode) c.parentNode.removeChild(c);
      log('lost renderer with no holder: dropped');
    }
    /* tell one holder what it missed (on a loss, a restore, and whenever it is granted the renderer) */
    function deliverContext(L) {
      var due = contextDue(L, lost);
      if (due === 'lost') { if (L.h.onLost) safe(L.h.onLost, L); }
      else if (due === 'restored') {
        try { L.renderer.shadowMap.needsUpdate = true; } catch (e) {}   /* static shadow maps died with the old context */
        if (L.h.onRestored) safe(L.h.onRestored, L);                    /* the island disposes + remounts here */
      }
      return due;
    }
    function onLost(e) {
      if (e && e.preventDefault) e.preventDefault();          /* allow a restore */
      if (disposing) return;
      if (!holders()) { retire(); return; }
      if (sessionFail) { lost = true; return; }               /* 3D is already over: no more strikes to count */
      var v = ctx.lost(Date.now());
      if (v.act === 'ignore') return;                         /* already lost */
      lost = true;
      stack.forEach(function (L) { L._ctxMissed = true; });   /* they hear it when handed the renderer back */
      if (current) current._update();
      log('WebGL context lost (' + ctx.stats().losses + ' this session' + (v.why ? ', ' + v.why : '') + ')');
      if (v.act === 'fail') { contextStrike(v); return; }
      if (current) deliverContext(current);
      armRestore(v.armMs);
    }
    function onRestored() {
      armRestore(0);
      if (disposing) return;
      ctx.restored(Date.now());
      lost = false;
      log('WebGL context restored');
      if (sessionFail || !current) return;
      deliverContext(current);
      if (pacer) pacer.invalidate();
      current._update();
    }
    function onRestoreTimeout() {
      restoreTimer = 0;
      if (!lost || disposing) return;
      if (!holders()) { retire(); return; }
      if (sessionFail) return;
      var v = ctx.timeout(Date.now());
      if (v.act === 'rearm') armRestore(v.armMs);
      else if (v.act === 'fail') { log('WebGL context not restored'); contextStrike(v); }
    }
    function contextStrike(v) {
      armRestore(0);
      ss('set', LOST_KEY, JSON.stringify(v.strikes));
      if (v.remember) remember2D('context');                  /* a persistent cause, not a routine loss */
      failAll('context');
    }
    function failAll(reason) {
      sessionFail = sessionFail || reason;
      var all = stack.concat(current ? [current] : []);
      all.forEach(function (L) { L._fail(reason); });
    }

    /* ---------------- adaptive quality ----------------
       Steps apply at once (to the island and the games alike). Only steps judged on the
       stage's own paced loop (the island) are evidence for the saved tier, and a lower
       tier is saved only once two page sessions each needed 2 steps (demotionVerdict). */
    var loopSteps = 0, cleanMs = 0, cleanDone = false;
    function demote(t) {
      var v = demotionVerdict(ls('get', PEND_KEY), t, SESSION, Date.now(), root.SLTier.TIERS, TIER_POLICY.pendMaxAgeMs);
      if (v.pend === null) ls('del', PEND_KEY);
      else if (typeof v.pend === 'string') ls('set', PEND_KEY, v.pend);
      if (v.save) saveTier(v.save);
      else log('2 quality steps this session: tier ' + t + ' pending a second session');
    }
    /* a long clean run of island frames: an earlier session's pending demotion was a one-off */
    function noteClean(ms) {
      if (cleanDone || !SL3D.quality || SL3D.quality.steps.length) return;
      cleanMs += Math.min(ms, 100);
      if (cleanMs >= TIER_POLICY.cleanMs) { cleanDone = true; ls('del', PEND_KEY); }
    }
    function applyStep(step, src) {
      var q = SL3D.quality;
      if (!q || q.steps.indexOf(step) >= 0) return;
      q.steps.push(step);
      if (step === 'pixelRatio') {
        /* SLTier.stepRatio: MID / HIGH at 2 → 1.5 smooth; lower ratios re-pick a crisp one under ×0.75 */
        var c = crispFor(root.SLTier, dprNow, SL3D.budget.pixelRatioCap, true);
        q.pixelRatio = c.ratio; q.pixelated = !!c.pixelated;
        if (renderer) setRatio(renderer, q.pixelRatio, q.pixelated);
      } else if (step === 'shadows') {
        q.shadows = false;
        if (renderer) renderer.shadowMap.enabled = false;     /* holders also set sun.castShadow = false */
      } else if (step === 'outlines') {
        q.outlines = false;
        if (hub) hub.setOutlines(false);
      } else if (step === 'particles') q.particleScale = 0.5;
      else if (step === 'life') q.lifeScale = 0.5;                 /* life3d / the sky life halve their counts */
      else if (step === 'decor') q.decor = false;                  /* the island's item idles rest (as under reduced motion);
                                                                      on LOW v3 also swaps organic decor to LOD1 (D71) */
      else if (step === 'isles') q.isles = false;                  /* v3: the islands the child is not on drop to LOD1 bakes */
      else if (step === 'water') q.water = false;                  /* v3: the water stops animating (uWaterAnim 0) */
      else if (step === 'reflections') q.reflections = false;      /* env drops the sea light pillars */
      else if (step === 'cones') q.cones = false;
      log('quality step ' + q.steps.length + ': ' + step + ' (' + (src || '?') + ')');
      if (src === 'loop' && ++loopSteps === 2) demote(root.SLTier.lower(SL3D.tier));   /* a later session may start cheaper */
      if (current && current.h.onQuality) safe(current.h.onQuality, q, step);
      qualityListeners.slice().forEach(function (fn) { safe(fn, q, step); });
    }
    /* src: 'loop' (the stage's paced loop) | 'held' (a holder's own frames, e.g. a game).
       A fallback above LOW saves LOW and ends 3D for this page session only: the next
       session retries at LOW (30 city towers, a 16x coarser terrain lattice: savings the
       ladder can't make). Only the island's own loop, already at LOW, remembers 2D for the
       device; a game's frames never do. */
    function judge(act, src) {
      if (!act) return;
      if (act.type === 'step') applyStep(act.step, src);
      else if (act.type === 'fallback') {
        var keep = SL3D.tier === 'LOW' && src === 'loop';
        log('frames stay under 20 fps after every step (' + SL3D.tier + ', ' + (src || '?') + '): 2D ' +
          (keep ? 'for this device' : 'for this session' + (SL3D.tier === 'LOW' ? '' : ', LOW next time')));
        saveTier('LOW');
        if (keep) remember2D('performance');
        failAll('performance');
      }
    }

    /* ================================================================
       LEASE — the shared renderer for one holder at a time.
       handlers: {frame(dt, t, lease) → animating (false = idle; under reduced motion
                  the stage then renders only on demand), scene, camera (optional: the
                  stage renders them after frame), reduced, steps (the island-only ladder
                  steps this holder honours: the v3 island declares ['isles', 'water'];
                  a holder that declares none — every game — steps exactly as in V4.54, D82),
                  onResize(w, h), onQuality(q, step),
                  onLost(), onRestored() (dispose + remount), onFail(reason),
                  onRevoke(lease, 'lease'|'dispose') (another holder took the renderer, or the
                  stage was disposed and this lease is dead), onResume(lease, {restored, lost})
                  (handed back: re-parent lease.canvas, re-apply exposure and clear colour)}
                 The current holder hears onLost/onRestored at once. A holder stacked under
                 another one hears them when the renderer is handed back: onResume first
                 ({restored: true} when the context was lost and restored meanwhile), then
                 onRestored (the stage also flags the static shadow map for a re-render), or
                 onLost when it is still lost. A pagehide only parks the loop (the page may
                 come back from the back/forward cache); it never revokes or fails a lease.
       lease: {renderer, canvas, THREE, tier, budget, quality, scene, camera,
               start(), stop(), observe(el), resize(w, h), setCovered(on), setHidden(on),
               setReduced(on), input(), invalidate(), compile(scene, camera) → Promise,
               sample(workMs), info(), release(), active}
       Rendering pauses while: stopped, document hidden, setHidden (island tab
       closed), setCovered (a sheet/game), < 10% of the observed element in view,
       the context is lost, or another holder has the renderer.
       ================================================================ */
    var current = null, stack = [];
    function lease(owner, h) {
      if (!SL3D.ready || sessionFail) return null;
      var r = shared();
      if (!r) return null;
      var L = new Lease(String(owner || 'holder'), h || {}, r);
      if (current) { stack.push(current); current._revoke(); }
      current = L;
      L._grant(false);
      return L;
    }
    function Lease(owner, h, r) {
      this.owner = owner; this.h = h; this.renderer = r; this.canvas = r.domElement;
      this.THREE = SL3D.THREE; this.tier = SL3D.tier; this.budget = SL3D.budget; this.quality = SL3D.quality;
      this.scene = h.scene || null; this.camera = h.camera || null;
      this.t = 0;
      this._granted = false; this._running = false; this._released = false; this._failed = false;
      this._covered = false; this._hidden = false; this._offscreen = false; this._looping = false;
      this._reduced = !!h.reduced; this._anim = true; this._last = -1; this._lastSample = -1; this._target = 0;
      this._steps = Array.isArray(h.steps) ? islandOnly.filter(function (s) { return h.steps.indexOf(s) >= 0; }) : [];
      this._fps = 0; this._work = 0; this._w = 0; this._h = 0;
      this._ctxLost = false; this._ctxMissed = false;          /* see contextDue */
      this._el = null; this._io = null; this._ro = null;
      var self = this;
      this._tick = function () { self._frame(); };
    }
    Lease.prototype._update = function () {
      var want = this._granted && this._running && !this._released && !this._failed && !this._covered &&
        !this._hidden && !this._offscreen && !lost && !parked && !document.hidden && current === this;
      if (want === this._looping) return;
      this._looping = want;
      if (want) {
        this._last = -1;
        if (pacer) pacer.reset(perfNow());
        if (aq) aq.reset();
        this.renderer.setAnimationLoop(this._tick);
      } else this.renderer.setAnimationLoop(null);
    };
    Lease.prototype._frame = function () {
      var now = perfNow();
      /* an on-demand frame (reduced motion, nothing was animating) follows a gap that
         says nothing about speed, so it is not measured */
      var continuous = !pacer.reduced || this._anim;
      if (!pacer.tick(now, this._anim)) return;
      var interval = this._last < 0 ? 0 : now - this._last;
      var dt = this._last < 0 ? 1 / 60 : Math.min(0.1, interval / 1000);
      this._last = now;
      this.t += dt;
      var target = pacer.interval(now);
      if (target !== this._target) { this._target = target; aq.reset(); }   /* 60 ↔ 30 fps idle switch: fresh window */
      checkDpr();                                              /* a display change no event announced (a read) */
      keepCrisp();
      var t0 = perfNow();
      try {
        var res = this.h.frame ? this.h.frame(dt, this.t, this) : true;
        this._anim = res !== false;
        if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
      } catch (e) {
        issue(this.owner + ' frame threw: ' + errText(e));
        this._fail('frame');
        return;
      }
      var work = perfNow() - t0;
      this._work = this._work ? this._work * 0.9 + work * 0.1 : work;
      if (interval > 0 && continuous) {
        var fps = 1000 / interval;
        this._fps = this._fps ? this._fps * 0.9 + fps * 0.1 : fps;
        judge(aq.sample(work, interval, now, target), 'loop');
        noteClean(interval);
      }
    };
    Lease.prototype._grant = function (resumed) {
      this._granted = true;
      var r = this.renderer, q = SL3D.quality;
      checkDpr();                                              /* a display change while nobody looked */
      setRatio(r, q.pixelRatio, q.pixelated);
      r.shadowMap.enabled = q.shadows;
      if (this._w > 0 && this._h > 0) r.setSize(this._w, this._h, false);
      if (pacer) { pacer.setReduced(this._reduced); pacer.invalidate(); }
      if (aq) aq.reset();                                      /* never judge a holder on the previous holder's frames */
      this._lastSample = -1;
      resetVoxGain();                                          /* before onResume: a holder may set its own gain there */
      if (resumed && this.h.onResume) {
        safe(this.h.onResume, this, { restored: contextDue(this, lost, true) === 'restored', lost: lost });
      }
      deliverContext(this);                                    /* a loss/restore it missed while stacked */
      keepCrisp();                                             /* onResume re-styles the canvas */
      this._measure();
      this._update();
    };
    Lease.prototype._revoke = function () {
      this._granted = false;
      this._update();
      if (this.h.onRevoke) safe(this.h.onRevoke, this, 'lease');
    };
    Lease.prototype._fail = function (reason) {
      if (this._failed) return;
      this._failed = true;
      this._update();
      if (this.h.onFail) safe(this.h.onFail, reason, this);
    };
    Lease.prototype._measure = function () {
      var el = this._el;
      if (!el) return;
      var w = el.clientWidth | 0, h = el.clientHeight | 0;
      if (w > 0 && h > 0 && (w !== this._w || h !== this._h)) this.resize(w, h);
    };
    Lease.prototype._unobserve = function () {
      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      this._offscreen = false;
    };
    Lease.prototype.start = function () { this._running = true; if (pacer && current === this) pacer.invalidate(); this._update(); return this; };
    Lease.prototype.stop = function () { this._running = false; this._update(); return this; };
    Lease.prototype.setCovered = function (on) { this._covered = !!on; if (!on && pacer) pacer.invalidate(); this._update(); return this; };
    Lease.prototype.setHidden = function (on) { this._hidden = !!on; if (!on && pacer) pacer.invalidate(); this._update(); return this; };
    Lease.prototype.setReduced = function (on) { this._reduced = !!on; if (pacer && current === this) pacer.setReduced(this._reduced); return this; };
    Lease.prototype.input = function () { if (pacer && current === this) pacer.input(perfNow()); return this; };
    Lease.prototype.invalidate = function () { if (pacer && current === this) pacer.invalidate(); return this; };
    Lease.prototype.observe = function (el) {
      this._unobserve();
      this._el = el || null;
      if (!el) return this;
      var self = this;
      if (typeof root.IntersectionObserver === 'function') {
        this._io = new root.IntersectionObserver(function (es) {
          var e = es[es.length - 1];
          self._offscreen = !e.isIntersecting || e.intersectionRatio < 0.1;
          self._update();
        }, { threshold: [0, 0.1, 0.25] });
        this._io.observe(el);
      }
      if (typeof root.ResizeObserver === 'function') {
        this._ro = new root.ResizeObserver(function () { self._measure(); });
        this._ro.observe(el);
      }
      this._measure();
      return this;
    };
    Lease.prototype.resize = function (w, h) {
      checkDpr();                                              /* browser zoom resizes the element too */
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      this._w = w; this._h = h;
      if (current === this) this.renderer.setSize(w, h, false);
      if (this.h.onResize) safe(this.h.onResize, w, h, this);
      this.invalidate();
      return this;
    };
    Lease.prototype.compile = function (scene, camera) {
      var r = this.renderer;
      try {
        if (typeof r.compileAsync === 'function') return r.compileAsync(scene || this.scene, camera || this.camera).catch(function () {});
        r.compile(scene || this.scene, camera || this.camera);
      } catch (e) { issue('compile: ' + errText(e)); }
      return Promise.resolve();
    };
    /* for holders that drive their own frames (e.g. a game view inside the shell's loop) */
    Lease.prototype.sample = function (workMs) {
      var now = perfNow();
      var interval = this._lastSample < 0 ? 0 : now - this._lastSample;
      this._lastSample = now;
      if (current === this) { checkDpr(); keepCrisp(); }
      if (interval > 0 && aq && current === this && !this._failed) {
        this._fps = this._fps ? this._fps * 0.9 + (1000 / interval) * 0.1 : 1000 / interval;
        judge(aq.sample(workMs, interval, now, 1000 / 60), 'held');
      }
      return this;
    };
    Lease.prototype.info = function () {
      var ri = this.renderer.info, ir = (this.canvas.style && this.canvas.style.imageRendering) || '';
      return {
        owner: this.owner, tier: this.tier, fps: Math.round(this._fps * 10) / 10, workMs: Math.round(this._work * 100) / 100,
        calls: ri.render.calls, tris: ri.render.triangles, programs: ri.programs ? ri.programs.length : 0,
        geometries: ri.memory.geometries, textures: ri.memory.textures,
        pixelRatio: this.renderer.getPixelRatio(), pixelated: !!SL3D.quality.pixelated && !!ir, imageRendering: ir, looping: this._looping, idle: pacer ? pacer.idle(perfNow()) : false,
        quality: SL3D.quality, aq: aq ? aq.stats() : null, steps: this._steps.slice()
      };
    };
    Lease.prototype.release = function () {
      if (this._released) return;
      this._released = true;
      this._running = false;
      this._update();
      this._unobserve();
      if (current === this) {
        current = null;
        var prev = stack.pop();
        while (prev && (prev._released || prev._failed)) prev = stack.pop();
        if (prev) { current = prev; prev._grant(true); }
      } else {
        var i = stack.indexOf(this);
        if (i >= 0) stack.splice(i, 1);
      }
      if (lost && !holders()) retire();                        /* nobody left to wait for a restore */
    };
    Object.defineProperty(Lease.prototype, 'active', { get: function () { return current === this && this._granted && !this._failed && !this._released; } });

    /* ---------------- page-level listeners (installed once, at init) ---------------- */
    var listening = false;
    function listen() {
      if (listening) return;
      listening = true;
      /* the restore clock runs on visible time only (see ContextLossPolicy) */
      function syncVisible() { armRestore(ctx.visible(!!document.hidden || parked, Date.now()).armMs); }
      syncVisible();
      document.addEventListener('visibilitychange', function () {
        syncVisible();
        if (!current) return;
        if (!document.hidden && pacer) pacer.invalidate();
        current._update();
      });
      /* C5: a new devicePixelRatio re-picks the render scale (window resize covers zoom, the media
         query a move to another screen) */
      root.addEventListener('resize', function () { checkDpr(); }, { passive: true });
      watchDpr();
      var onInput = function () { if (pacer && current) pacer.input(perfNow()); };
      ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach(function (t) {
        root.addEventListener(t, onInput, { passive: true, capture: true });
      });
      /* pagehide only PARKS: the page may come back from the back/forward cache, and a
         dispose here failed the island and every open game to 2D for the rest of the
         session. Holders keep their leases; the browser frees a discarded page's
         context itself, and a context it drops while the page is cached comes back
         through the routine lost → restored path. */
      root.addEventListener('pagehide', function () {
        parked = true;
        syncVisible();
        if (current) current._update();
      });
      root.addEventListener('pageshow', function () {
        if (!parked) return;
        parked = false;
        syncVisible();
        if (!current) return;
        if (pacer) pacer.invalidate();
        current._update();
      });
    }

    /* ---------------- remembered 2D ---------------- */
    function remembered(ver) {
      var search = '';
      try { search = root.location.search; } catch (e) {}
      var r = rememberedFrom(ls('get', REMEMBER_KEY), ver || root.SL_WORLD_VER || '1', search, Date.now());
      if (r.clear) ls('del', REMEMBER_KEY);
      return r.rec;
    }
    function remember2D(why) {
      ls('set', REMEMBER_KEY, JSON.stringify({ off: true, why: String(why || 'unknown'), ver: String(root.SL_WORLD_VER || '1'), at: Date.now() }));
    }
    /* the public one: the island adapter (rewards-world disable3D) asks to remember any
       'performance' failure it hears about, but judge() has already decided this
       session's own (remembered only at LOW, from the island's loop), so that stands */
    function rememberFor(why) {
      if (sessionFail === 'performance' && /perf/i.test(String(why || ''))) { log('performance: judged by the stage, not remembered again'); return; }
      remember2D(why);
    }
    /* "Try 3D again" (a parent's button): drop the remembered record, the pending
       demotion (slTier3dPend) and the context strikes, and lift this page session's
       2D verdict with a fresh judge for the steps already taken, so the next
       maybeBoot3D() boots 3D. The saved tier stays (measured evidence; LOW after a
       fallback is the likeliest to hold; it expires by itself). While a holder still sits
       on a lost context the session verdict stays (until it lets go, or next session). */
    function forget() {
      ls('del', REMEMBER_KEY);
      ls('del', PEND_KEY);
      ss('del', LOST_KEY);
      if (lost) return;
      ctx = ContextLossPolicy({ now: Date.now(), hidden: ctx.hidden });
      if (!sessionFail) return;
      sessionFail = null;
      if (aq) aq = newAQ(aqSkip.concat(SL3D.quality.steps));
      log('3D allowed again');
    }

    /* ---------------- dispose ---------------- */
    function disposeAll(o) {
      o = o || {};
      disposing = true;
      armRestore(0);
      ctx.drop();
      var all = stack.concat(current ? [current] : []);
      stack = []; current = null;
      all.forEach(function (L) {
        L._released = true; L._running = false; L._granted = false; L._looping = false;
        L._unobserve();
        if (L.h.onRevoke) safe(L.h.onRevoke, L, 'dispose');   /* the lease is gone: lease again to render */
      });
      if (renderer) {
        var r = renderer, c = r.domElement;
        renderer = null;
        unwatchCrisp();
        try { r.setAnimationLoop(null); } catch (e) {}
        c.removeEventListener('webglcontextlost', onLost, false);
        c.removeEventListener('webglcontextrestored', onRestored, false);
        try { r.dispose(); } catch (e) {}
        try { r.forceContextLoss(); } catch (e) {}
        if (c.parentNode) c.parentNode.removeChild(c);
      }
      lost = false;
      if (hub && o.keepKit !== true) { try { hub.dispose(); } catch (e) { issue('kit dispose: ' + errText(e)); } }
      disposing = false;
    }

    /* ---------------- QA info ---------------- */
    function info() {
      var out = {
        version: VERSION, ready: SL3D.ready, tier: SL3D.tier, why: SL3D.tierWhy, budget: SL3D.budget, dpr: dprNow,
        quality: SL3D.quality, permanent: permanent, failed: sessionFail,
        contextLosses: ctx.stats().losses, contextStrikes: ctx.stats().strikes, parked: parked,
        loaded: SL3D.loaded, models: Object.keys(SL3D.models).length, missing: SL3D.missing.slice(),
        apis: Object.keys(apiNames), issues: SL3D.issues.slice(), owner: current ? current.owner : null,
        kit: hub ? hub.stats() : null, kitIssues: hub ? hub.issues.slice() : [],
        vox: {
          bound: !!voxHub, ready: VOX.ready, models: Object.keys(VOX.models).length, apis: Object.keys(voxApiNames),
          missing: VOX.missing.slice(), templates: hub && hub.stats ? hub.stats().voxTemplates || 0 : 0, programs: voxPrograms()
        },
        groups: groupStates()
      };
      if (current) out.lease = current.info();
      return out;
    }
    /* the vox programs the shared renderer has compiled (customProgramCacheKey 'pixel-vox') */
    function voxPrograms() {
      var list = renderer && renderer.info && renderer.info.programs;
      if (!Array.isArray(list)) return 0;
      return list.filter(function (p) { return String(p && p.cacheKey || '').indexOf('pixel-vox') >= 0; }).length;
    }
    /* group → true (loaded) | 'partial' (some files not built yet) | 'loading' | false (never asked for) */
    function groupStates() {
      var out = {};
      GROUPS.forEach(function (g) {
        out[g] = Object.prototype.hasOwnProperty.call(groupDone, g) ? (groupDone[g] ? true : 'partial') : groupP[g] ? 'loading' : false;
      });
      return out;
    }

    /* ---------------- SLIsland3D ---------------- */
    var IS = root.SLIsland3D || {};
    root.SLIsland3D = IS;              /* island3d.js adds mount() to this same object */
    IS.ensure = ensure;
    /* the island: core + vox (and v2 + v2env while the v3 scene is not declared, D84); after a game's
       ensure() this injects the vox group and binds the VoxHub when it arrives */
    IS.boot = function (opts) {
      opts = opts || {};
      if (!opts.force && (sessionFail || remembered(opts.ver))) return Promise.resolve(false);
      var dl = opts.deadlineMs != null ? Number(opts.deadlineMs) : 8000;
      var t0 = opts.t0 != null ? Number(opts.t0) : perfNow();
      var left = Math.max(1, dl - (perfNow() - t0));
      return ensureGroups({ deadlineMs: left, tier: opts.tier }, ['vox'], true).then(function (s) { return !!s; }, function () { return false; });
    };
    IS.loadGroup = function (name) {
      if (GROUPS.indexOf(name) < 0) { issue('loadGroup: unknown script group "' + name + '"'); return Promise.resolve(false); }
      return ensureGroups({}, [name], false).then(function (s) { return !!s && groupDone[name] === true; }, function () { return false; });
    };
    IS.voxRoute = voxRoute;
    IS.remembered = remembered;
    IS.remember2D = rememberFor;
    IS.forget = forget;
    IS.failed = function () { return sessionFail || permanent || null; };
    IS.dispose = disposeAll;
  }
}));
