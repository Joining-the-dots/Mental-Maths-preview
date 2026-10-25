/* ================================================================
   My Island 3D — the scene controller (island chunk 10; classic script).
   Adds mount() to the existing window.SLIsland3D object that stage.js
   created (never replaces it). In Node, module.exports is the PURE layer
   (view diffing, pick priority, ray/box maths, labels) for tests.

   SLIsland3D.mount({reduced, user: {name, color, avatar, seed}, on: {tapItem(uid),
     tapPet(petId), tapAvatar(), tapLand(landId), tapCell(x, y), dragStart(uid),
     dragCell(x, y), dragEnd(), dragCancel()?, ready(), fail(reason)}, srList = true,
     skyline = true}) → stage
     user.seed (v2): the profile key's hash. env.create gets it (the per-child coastline) and the
     home's trim (shape variant) falls back to fnv(seed) % 2 when view.style carries no variant.
     A new seed on setUser (a profile switch) rebuilds the environment for that child's coast.
     dragEnd() means the finger was LIFTED (the host may confirm the move). A cancelled drag
     (pointercancel, a lost pointer capture that cannot be re-taken, a second finger, a sheet,
     suspend) never calls dragEnd: it calls the optional on.dragCancel(), and without that hook
     the ghost is put back on the cell the drag started from (on.dragCell) and placement stays open.
     tapPet / tapAvatar come after the actors' own tap reaction (a hop + emote; the avatar's wave +
     finger-heart): the host's emote of the same target right after it is deduped.
   stage (docs/island3d/CONTRACTS.md §5; island-architecture.json → integrationWithRewardsWorld)
     attach(el)            re-parent the persistent div.slw-3d into el (#slwStage); cheap, idempotent
     sync(view)            view = {placed, style, unlocked, pets, avatar, mode, selectedUid, placing,
                           lit, world, anim: {unlock, dropUid, styleDebut}}: diffs add / move / remove /
                           restyle (one ItemBatch per (id, stateKey)), lit lamps, mode, selection,
                           placement visuals, actors, the keyboard list; shadow refresh only on change
     act(uid, name) → Promise<bool>   CATALOG act ('launch' push-in + spot aim, 'home', 'homeClose',
                           'bounce', 'splash', 'swing', 'bubbles', 'spin', 'wave', 'glow', and the city
                           buildings' 'snap', 'serve', 'screen', 'record', 'dance', 'hangout', 'encore');
                           one live act per uid (a new one supersedes it: the old promise resolves false).
                           'encore' (the Concert Stage) also takes 8 s of Showtime (showtime(true,
                           {encoreMs: 8000}) — the host may make the same call, it only re-arms the timer),
                           runs the skyline shot eased in toward the stage, and owns the crew's 8-count
                           (no controller dance break meanwhile). While it runs, taps on that stage are
                           ignored (no squish, no on.tapItem). The child's own Golden hour / Showtime
                           choice comes back when it ends.
     emote(target, kind)   'pet:<id>' | 'me' (avatar wave + finger-heart); kind heart | note | star
     setLit(uid, on)       the lamp flicker act (the view's lit map is the source of truth)
     unlockLand(region) → Promise     the land rises (+ crane, splash rings, sparkles, applause)
     debut(uid) → Promise · storeFx(uid, trayEl?) → Promise
     showtime(on, {encoreMs}?)        Golden hour (the default: env k 0 = DUSK) ↔ Showtime (env + rim + rigs +
                           music context + orbit with its elevation dip); with encoreMs: an ENCORE (Showtime
                           for encoreMs, then back to whatever the child chose, with a dance break). The
                           host keeps localStorage 'slwShowtime' ('1' = Showtime) and calls showtime(true)
                           after mount; the meaning is unchanged.
     danceNow()            the 8-count dance break (actors) + the push-in on the house
     setAnchors([{el, uid | pet | me | region, dy (u), dyPx}])   HTML labels projected every
                           camera change (≤ 15 Hz while things move); wrapped in .slw-tag3d
     focusItem(key | null) · resetView() · frameItem(uid) · placement(state | null)
     focusMe({instant, wave}) → bool   Find me (kids update KU34 / KU-CH12): the camera eases to the
                           child's figure at rig.zoomMax() through rig.focusOn (a cut under reduced motion or
                           instant; any camera input afterwards is the child's), and the figure waves (wave:
                           false skips it). False with no figure, while a flight / the Sky map / the tour has the
                           camera, and on a failed or disposed stage. SLIsland3D.focusMe(o) calls the newest live
                           stage's (false with none); KU-CH17's 'Find me on the island' button feature-detects it.
                           view.avatar may carry a character (look, wear, vr, sig, lk, wr: SLPeopleCore.avatarInfo):
                           actorState hands those to actors.js as given; without a look the avatar is the classic one.
     THE KIDS UPDATE'S CARE (P3.3; pets.json P22, ui U6 / U7 / U11, moodAndEating; on P2.5's actors.js and skylife3d)
     view.pets[].mood      {hunger 0 fine | 1 peckish | 2 hungry | 3 very hungry, happy 0–4, sitter}: reaches the crew's
                           brains in range (petMood; a copy, the host's record is never changed)
     feed(petId, foodId, {fav, reduced, frame}) → Promise<bool>   the feeding moment (decision P22): the camera eases to
                           the pet at the largest play zoom, first swinging round (≤ 35° yaw, a steeper tilt; feedView)
                           when an item or another figure hides the bowl, and back to the child's angle when it ends
                           (frame: false keeps the camera; cuts under reduced motion), the bowl
                           pops in, the meal drops in, the pet hops over and eats, the sparkle ring (bigger for a
                           favourite), the bowl pops out; a chime ('star') as it resolves true (the host fills the tummy
                           pip and says the toast; no second chime). About 3.2 s. Reduced motion (the stage's own, or
                           o.reduced): the end state at once (the meal eaten, the empty bowl beside the pet) for 1.2 s.
                           Resolves FALSE at once when the pet is not out on the island being shown (a Home pet while a
                           land is visited), during a flight / the Sky map / the tour, outside play mode, while
                           suspended, on a failed stage, without a bowl to draw (no SL3D.vox.makeBowl: the V4.54 scene)
                           or without a crew that eats: the host then plays its 2D moment.
                           A tap on the island during the moment skips to its end (and is no pick); so does skipFeed().
                           A newer feed, edit mode, suspend(), reduced motion or a teardown ends it at its end state
                           (resolving true). The host commits the meal (SLPetCare.feed) BEFORE calling, and keeps the
                           island uncovered (setCovered(false)) while it plays.
     skipFeed() → bool     the host's strip tap or Esc: the moment's end state now (true when one was playing)
     setPetStars(list) → n the memory stars (farewell, a grown-up's switch): list = SLPetCare.memories(w) (care3.stars
                           cards; a 'returned' card is skipped; one star per (id, to)) or pet ids, oldest first; the
                           newest 5 shine in Home's night sky at Showtime (skylife3d: steady 4-point Star Gold stars, a
                           0.3 Hz ±10 % glow drift, never a flash; steady under reduced motion and on LOW). Kept across a
                           rebuilt sky. n = the stars it keeps (≤ 5; 0 on the V4.54 scene or without skylife).
     on.tapStar(petId, {name, to})   optional: a memory star was tapped (its name bubble shows, a soft chime): open
                           the memory card with that id (and 'to' day, when a species passed away twice)
     on.tapPet(petId, {hungry: true})   the second argument only when the pet answered as a hungry pet (actors played
                           the softer tap; the stage shows the 'I'm hungry!' bubble, care.bubble.* in SLWorldCopy when
                           it has them, with SLWorldArtPets' 'hungry' badge when loaded): the host plays the pet's voice at
                           0.6 for it (actors.js leaves the voice to the host here) and still counts the pat
     info().care           {feeding: petId | null, stars: n, view: the last moment's swing {dYaw, dElev, n (rays still
                           crossing a box), boxes} | null}
     setCovered(on) · suspend() · resume() · setReduced(on) · setUser(user) · info() · dispose()
   Pointer: tap = 8 px, up to 1 s — a slow press released in place still counts as a tap. At
   450 ms (long-press) the item / pet shows its name bubble without moving the camera; held still
   for a full second (a deliberate hold, play mode only) the camera frames it and the release is
   no tap. An edit-mode drag > 10 px on an item calls on.dragStart(uid), then on.dragCell /
   on.dragEnd; in place mode the ghost can be dragged the same way. Pick priority: pets/avatar >
   items > locked land (env.lockedAt) > cells. Camera: camera.js (window.SLIslandCamera).
   ENCORE CITY (v2)
     · On ready (play mode, unless opts.skyline === false or reduced motion) the camera opens on the
       skyline hero shot over the bay and eases to the child's view; a press holds it still (so a tap
       picks what was seen), any release or camera gesture hands it back, edit mode ends it.
     · Per-copy style: the house {wall, roof, door, details, shape, variant (view.style.variant, else
       fnv(user.seed) % 2)}; a city building {variant: SLIslandLook.variantOf(uid, id)} (stateKey
       'v:n'); organic decor and small decor get SLIslandLook.jitter2(uid, id, sameIdNeighbours) in
       K.batch(…).add(…, {jitter}) (re-jittered when a same-id neighbour comes or goes); houses,
       buildings, attractions and paths never get transform jitter. Path models that set
       `pieces: true` get the auto-tiled stateKey 'p:<piece>' plus its yaw (SLIslandLook.pathPiece).
     · env.create receives {seed, name, tier}; env.setEdit(on) on mode changes (edit / place ease the
       light to k 0); env.setConeMounts(the stage's 'cone0..2' truss anchors | null) when bld_stage is
       placed. A v2 env (setEdit) owns the city across the bay (SLCity3D) and the ambient life
       (SLLife3D) and disposes them; with an older env the controller hosts both itself.
     · actors' brain.setAnchorFn(fn(uid, name, out?) → {x, y, z} | null): live item anchors for the
       crew's building performs (an anchor the template lacks is null, never 'top').
     · SLIsland3D.debug.grid(on) (also ?grid=1 under SL_WORLD_TRIAL) draws the edit grid in play
       mode, so testers can check the pads under the organic ground. html.sl-low marks the LOW tier
       (solid UI panels). The camera buttons use SLWorldArt.uiIcon line icons when present.
   v2 SEAMS (CONTRACTS §9; every module feature-detected)
     · The child: every island copy's handle carries a.member ('#hex' | null) and a.user {name (the
       first name only), color, avatar}, kept current by setUser (photocard handles never have them).
       On mount and on every setUser: K.ledAtlas().setUser / K.signAtlas().setUser({name, color}),
       SL3D.models.bld_stage.setUser({name, color}) (the three stage buildings share it) and
       SL3D.models.att_course.setUser(user) (the course gates share it).
     · a.pets.active() → the active crew member's id ('pet_…') or null; perform kinds 'pose' | 'sip' |
       'roof' | 'studio' | 'stage' reach pets-brain; a lead ≤ 0 is 'no pet'.
     · a.bloom(anchor, sizeU, token) → bool: fx3d's local bloom (≤ 1 per 1.5 s per item, never under
       reduced motion); false = no bloom (the model may use its own halo). A city building's a.decal
       is an uplight pool (fx.uplight: r 0.5, 0.25 at golden hour → 0.4 at Showtime). Hearts are the
       avatar's finger-heart only: any other 'heart' emit becomes Neon Magenta ✦ sparkles.
     · Music: actors.setMusic(heard) on every change and {playing} in the frame clock, so the crew's
       beat-nod and headphone pulse run only while the island loop plays and is heard.
     · env.wakeAt(x, z): a copy's lights join the 'city wakes up' ripple (its show k = k × wake).
     · Paths: SLModelsGarden.pathPose(mask, uid, {}, PATH_LAYOUTS[tier]) gives each copy its piece,
       stateKey and yaw (one layout per piece on LOW and MID, 3 on HIGH), so the path cells join up.
   PERF (the merged layer, kit MERGED LAYER): every item batch joins one K.merger(), committed each
     frame after the batches and before every compile, so the parts it accepts (toon, 'state', neon,
     glow — not matcaps, maps or glass) of every copy draw in one call per material: the item draw
     calls no longer grow with the island or its path pieces (the lab's max island: LOW 58 / 64,
     MID and HIGH 66 / 73 golden hour / Showtime, from 163–190). The adaptive ladder's 'decor' step
     (a CPU-bound device) rests every item idle at its rest pose, as reduced motion does.

   SIBLINGS (wave C, feature-detected; built-in fallbacks keep the island whole without them).
   The controller drives every sibling through the ISLAND PROTOCOL below. buildSystem wraps a
   sibling that publishes its own documented API (adaptSystem, pure, Node-tested in
   tests/fix-seams.test.js): actors.js {sync(pets, avatar, world), hits, anchorOf, tap, …} and
   edit3d.js {show(cells, state), ghost(id, st, x, y, ok), hide, …} get an adapter; fx3d speaks
   the protocol natively. A sibling of an unknown shape is dropped for the built-in fallback.
     actors  SL3D.makeActors(host) | SLActors.create(K, SL3D, host) | SLIslandActors.create(…)
             {sync(v), update(dt, t, ctx) → busy, pick(origin, dir) → {target, t}, emote(target, kind),
              tap(target)?, perform(kind, uid) → lead s (0 = no pet), active(), dance(o) → s,
              anchor(target, out) → out|null, setShow(k), setMode(m), setReduced(on), setUser(u),
              setQuality(q), setAnchorFn(fn)?, setMusic(on)?, dispose()}   v = actorState(…): {pets, avatar, user,
              placed, unlocked, land, world, mode, reduced}; host.voice = false (rewards-world plays the
              pet voice)
     fx3d    SL3D.makeFx(host) | SLFx3D.create(K, SL3D, host) | SLIslandFx.create(…)
             {emit(kind, pos, n, opts), halo(key, on, pos, sizeU, token), decal(key, on, pos, token),
              update(dt, t, ctx {show, camera}) → busy, setMember(hex), setReduced(on), setQuality(q),
              clear(), dispose(), bloom(key, pos, {size, token}) → bool?, uplight(key, on, pos, token)?}
             positions reach emit as {x, y, z} (arrays from siblings are converted); emit opts use
             fx3d names: {token | tokens[], radius, to, dur, delay, …} ('flight' flies to `to`)
     edit3d  SL3D.makeEdit(host) | SLEdit3D.create(K, SL3D, host) | SLIslandEdit.create(…)
             {setState(editState(…)): {mode, land, unlocked, placing, ghost: {id, st, stateKey,
              template, material}, selectedUid, grid}, update(dt, t, ctx) → busy, ghostBox() → {min,
              max} | null, ghostShown() → bool, setReduced(on), dispose()}   the real copy of an item
              being moved is hidden only while a ghost is actually shown; grid: true asks for the
              plain grid in play mode too (the QA debug grid); host.jitter(uid, id) gives edit3d a
              copy's exact placement jitter
     A sibling whose call throws is dropped for the built-in fallback (logged in QA mode).

   THE ANIMATION HANDLE a (one per placed copy, reused every frame — CONTRACTS §5):
     uid id t dt phase rand() reduced beat bar bpm show lit stateKey st template batch object
     music (the SLMusic.clock() snapshot while a loop plays, false when music is off, null
     without SLMusic) pathD · copyGeometry(part) basePositions(part) pivot(name).set(rot, pos, scale)
     state(key, v) halo(name, on, sizeU, token) decal(on, token) emit(kind, anchor | localPos, n, opts)
     sfx(name, vol, step) (panned by x) pets.{active(), perform(kind, uid)} shake(amp, dur) squish()
     bloom(anchor, sizeU, token) → bool · member ('#hex' | null) · user {name, color, avatar} (v2)
     pivot('root') / pivot('sway') (no sway pivot) is captured and composed with the controller's
     squish / drop-in / debut / store, so a swaying tree still squishes when tapped.

   MY ISLAND v3 — the sky world in Pixel Blocks (W4.2a, plan-v3 contracts.island3d). This file sets
   SLIsland3D.v3Scene = true (D84). mount({…, registry = 'vox', intro = true}): registry 'v2' keeps
   the V4.54 scene above (the lab compare and the Node tests; the caller loads 'v2' + 'v2env');
   anything else is the v3 scene, which needs SL3D.vox (+ K.vox), SLSky3D and SLIslesView, else
   fail('v3 missing') → the host's 2D island (D53). intro (skyline: false is an alias): the Sky tour
   on ready (never under reduced motion; the host passes false after the first open, D83).
     · R = SL3D.vox: templates K.templates.get(id, stateKey, tier, st, 'vox' | 'vox-lod1'); one
       K.merger per island (D3), batches keyed isle + ns + id + stateKey; SLSky3D stands in for env
       (same method names) and hosts SLIslesGL + SLSkyLife3D; the lease declares ['isles', 'water'].
     · SLIslesView drives everything per island: itemsOf (the copies, their st / stateKey / place /
       jitter), diff (add / move / remove / restyle), policy (merger | bake | preview | hidden, terrain,
       itemLod: D42 / D89 / D106), routeTap, anchorsVisible, keyboardList, lodFor / promote / sweep.
       An island is either a MERGER (one record per copy: idles on the live island only, acts,
       halos — each copy on 'vox', or 'vox-lod1' for itemLod / organic LOD / a LOD0 template still
       on its way) or a BAKE (K.vox.bakeStatic of every copy's LOD1 at rest: one mesh per 4 rows, so
       three culls the rows off the frame), or nothing (a preview: isles-gl draws it). A tapped copy is
       promoted to LOD0 for its act and 2 s after. The rest budget (D89) is also held to the frame's row
       (trisHomeView on Home, trisWorst on a land) once its fixed costs and the other islands' bakes are paid.
     · Cold mount (D70): the first sync builds the visited island from LOD1 templates (a cheap merger
       that also warms the skinned program) and queues everything else: LOD0 upgrades, the other
       islands' bakes / mergers, re-bakes, in slices of ≤ 6 ms of real time per frame (visited
       island first). Until its own bake is in, a land shows isles-gl's stand-in (ready(isle)).
     · Travel is SLIslesTravel's (W4.2b): visitIsle / unlockIsle / skyMap (overview) / the intro tour /
       skip / the sky dip (div.slw-skydip) / tap routing; without it the v3 stage draws Home and those
       methods resolve false. A sync never moves the camera.
     · view adds isle, skyMap / overview, unlockedIsles, isles {isle: [{uid, id, x, y, vr}]},
       placing.isle, anim.unlockIsle; without unlockedIsles / isles (a V4.54 host) they come from
       view.world (C.unlockedIsles / C.placedOn). on.tapIsle(isle) is new; tapCell / dragCell gain the
       island. setAnchors entries {el, isle} sit at that island's gate / dock / map sign.
     · Play taps (QA#2): a thing's tags (▶ PLAY / ✋ / NEW!) are HTML the taps go through, so a tap on one
       (or within TAG_PAD px when the ray hit nothing of the island: a neighbour's body just off the tag is
       the neighbour) is a tap on that thing; a tap on nothing of the island within NEAR_PX (or
       NEAR_FRAC of its width) of a thing that plays (not a game gate or the house) is that thing, never the
       island behind it (routeTap's hit.near). A tap on a landmark shows its name over it (the bubble stays inside the stage) and brings
       it into view when the stage's edge cuts it off; frameItem aims at a tall thing's middle.
     · info() adds {isle, skyMap, overview, isles: {isle: {mode, lod, live, calls, tris, items}},
       programs, calls, tris, jobs}. setUser also reaches K.vox.atlas() and every vox handler.
   ================================================================ */
(function (root, factory) {
  var hasDom = typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.createElement;
  var api = factory(root, hasDom);
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, HAS_DOM) {
  'use strict';

  var VERSION = 2;
  var DEG = Math.PI / 180;
  var MODES = { play: 1, edit: 1, place: 1 };
  var OCCLUDE_U = 0.6;          /* a pet still wins a tap unless an item box is this much nearer */
  /* QA#2 (v3 play taps): the ▶ PLAY / ✋ / NEW! tags float over the canvas as HTML the taps pass through */
  var TAG_PAD = 10;             /* px: a tap this close to a thing's tag (on nothing else of the island) is that thing */
  var TAG_MIN = 24, TAG_GAP = 4; /* px: a tag's size where the DOM measures none (Node); the gap between its rows */
  var NEAR_PX = 16;             /* px: a tap on nothing of the island this close to a thing that plays is that thing, */
  var NEAR_FRAC = 0.35;         /* or this share of its box's width on screen (the Big Wheel's rim and tubs overhang
                                   its 3 × 2 footprint by about a third of it each side) */
  var DANCE_EVERY_BARS = 16, DANCE_BPM = 118, DANCE_COUNTS = 8;
  var ANCHOR_HZ = 15;
  var EMOTES = ['heart', 'note', 'star'];
  /* the stage encore's camera: eased into the skyline shot, held through the sting and the beams,
     back to the child's view as the confetti flies (the 3 s act ends inside the hold) */
  var ENCORE_CAM = { easeIn: 1.0, hold: 1.4 };
  var ENCORE_SEC = 8;
  /* the 'city wakes up' ripple can trail the Showtime mix this long (s): show() keeps running */
  var WAKE_TAIL = 0.5;
  /* placement jitter never moves architecture or the paths (identity even when a LOOK entry
     would allow it) */
  var NO_JITTER = { house: 1, building: 1, attraction: 1, path: 1, land: 1, style: 1 };
  var NO_JIT = { yaw: 0, sx: 1, sy: 1, sz: 1, lean: 0, leanAxis: 0, tint: null };
  /* the QA debug grid (SLIsland3D.debug.grid / ?grid=1 under SL_WORLD_TRIAL), shared by every stage */
  var DEBUG = { grid: false, listeners: [] };

  /* ================================================================
     PURE HELPERS (exported for Node tests)
     ================================================================ */
  function normMode(m) { return MODES[m] ? m : 'play'; }
  function batchKey(id, sk) { return id + '#' + (sk == null ? '' : sk); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* the placed list → what changed since the previous records.
     prev: Map uid → {id, x, y, sk}; next: [{uid, id, x, y, sk}]
     → {add: [n], move: [n], restyle: [n], remove: [uid], same: [uid]} (first copy of a uid wins) */
  function diffPlaced(prev, next) {
    var out = { add: [], move: [], restyle: [], remove: [], same: [] }, seen = {};
    for (var i = 0; i < next.length; i++) {
      var n = next[i];
      if (!n || seen[n.uid]) continue;
      seen[n.uid] = 1;
      var p = prev && (typeof prev.get === 'function' ? prev.get(n.uid) : prev[n.uid]);
      if (!p) out.add.push(n);
      else if (p.id !== n.id || p.sk !== n.sk) out.restyle.push(n);
      else if (p.x !== n.x || p.y !== n.y) out.move.push(n);
      else out.same.push(n.uid);
    }
    if (prev) {
      var keys = typeof prev.keys === 'function' ? Array.from(prev.keys()) : Object.keys(prev);
      keys.forEach(function (uid) { if (!seen[uid]) out.remove.push(uid); });
    }
    return out;
  }
  /* lit memory changes for the given uids → [{uid, on}] */
  function litChanges(prev, lit, uids) {
    var out = [];
    prev = prev || {}; lit = lit || {};
    for (var i = 0; i < uids.length; i++) {
      var u = uids[i], a = !!prev[u], b = !!lit[u];
      if (a !== b) out.push({ uid: u, on: b });
    }
    return out;
  }
  /* slab test: ray (o, d) against an axis-aligned box {min: [3], max: [3]} → entry t ≥ 0, or -1 */
  function rayBox(o, d, min, max) {
    var t0 = 0, t1 = Infinity, ax = ['x', 'y', 'z'];
    for (var i = 0; i < 3; i++) {
      var ov = o[ax[i]], dv = d[ax[i]], lo = min[i], hi = max[i];
      if (Math.abs(dv) < 1e-12) { if (ov < lo || ov > hi) return -1; continue; }
      var a = (lo - ov) / dv, b = (hi - ov) / dv;
      if (a > b) { var s = a; a = b; b = s; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return -1;
    }
    return t0;
  }
  /* pick priority (island-architecture → hit volumes and picking):
     place mode: the ghost, then cells. Otherwise pets/avatar (play only, unless an item box is
     clearly nearer) > the nearest item > land cells > the locked hologram > sea cells > sea.
     h = {actor: {t, target}, item: {t, uid}, ghost: t, cell: {c, r, land}, land: region, sea: point} */
  function choosePick(mode, h) {
    mode = normMode(mode);
    h = h || {};
    if (mode === 'place') {
      if (h.ghost != null && h.ghost >= 0) return { kind: 'ghost' };
      if (h.cell) return { kind: 'cell', c: h.cell.c, r: h.cell.r };
      return { kind: 'none' };
    }
    if (mode === 'play' && h.actor && (!h.item || h.actor.t <= h.item.t + OCCLUDE_U)) return { kind: 'actor', target: h.actor.target };
    if (h.item) return { kind: 'item', uid: h.item.uid };
    if (h.cell && h.cell.land) return { kind: 'cell', c: h.cell.c, r: h.cell.r };
    if (h.land) return { kind: 'land', region: h.land };
    if (h.cell) return { kind: 'cell', c: h.cell.c, r: h.cell.r };
    if (h.sea) return { kind: 'sea' };
    return { kind: 'none' };
  }
  /* the cell an item's origin lands on while it is dragged by a grabbed cell, clamped to the grid */
  function dragTarget(cell, grab, fp, cols, rows) {
    fp = fp || [1, 1]; grab = grab || { c: 0, r: 0 };
    cols = cols || 16; rows = rows || 10;
    return { x: clamp(cell.c - grab.c, 0, cols - fp[0]), y: clamp(cell.r - grab.r, 0, rows - fp[1]) };
  }
  /* the keyboard list's labels: today's aria-labels from rewards-world */
  function itemLabel(it, mode, selected) {
    if (!it) return '';
    if (normMode(mode) !== 'play') return it.name + (selected ? ' (selected)' : '') + ' — select to move it';
    return it.name + (it.act === 'launch' ? ' — tap to play' : it.act ? ' — tap to play with it' : '');
  }
  /* a crew member's label ('Pets' are the 'Crew' in labels: SLWorldCopy 'label.crew') */
  function petLabel(C, p, copy) {
    var it = C && C.item ? C.item(p.id) : null;
    var crew = copy && typeof copy.t === 'function' ? String(copy.t('label.crew', null, 'Crew')) : 'Crew';
    var lc = crew.toLowerCase();
    return (p.name || crew + ' member') + ' the ' + (it ? it.name.toLowerCase() : lc + ' member') +
      ' (' + lc + (p.active ? ', runs your obstacle course' : '') + ')';
  }
  /* the next dance break bar: every 16 bars while Showtime is on (-1 = not scheduled) */
  function nextDance(bar, scheduled, every) {
    every = every || DANCE_EVERY_BARS;
    if (scheduled < 0) return { due: false, next: bar + every };
    if (bar >= scheduled) return { due: true, next: bar + every };
    return { due: false, next: scheduled };
  }
  /* CATALOG act → the act name a model gets (glow toggles from the lit memory) */
  function modelAct(name, litOn) {
    if (name === 'glow') return litOn ? 'glowOff' : 'glowOn';
    return name;
  }
  /* screen position of NDC (CSS px) */
  function toScreen(nx, ny, w, h, out) {
    out = out || {};
    out.x = (nx + 1) / 2 * w; out.y = (1 - ny) / 2 * h;
    return out;
  }
  /* how far (px) a screen point is from a screen rect: 0 on or inside it (QA#2's tag and near-miss taps) */
  function rectDist(x, y, x0, y0, x1, y1) {
    var dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
    return Math.sqrt(dx * dx + dy * dy);
  }
  /* R2 (QA2A-6, round 2): where the island signs go so that none covers another, a ▶ PLAY tag or the camera buttons,
     each inside the stage by o.inset px. signs: [{x, y, w, h}] (x the centre, y the bottom: a tag rises from its point),
     in order; fixed: [{x0, y0, x1, y1}] boxes that never move. → [{x, y}] in the signs' order.
     Each sign takes the clear spot nearest its own (a step sideways counts 1.5×): its spot, or one beside, above or
     below any box already there, or against the stage's edges, in every pairing of those columns and rows. When a
     crowded stage (a phone: the camera row above, the PLAY tags below) leaves a sign no clear spot, the signs placed
     before it are placed again in other orders (that sign first, then the others) and the best layout wins: no
     overlap at all, else the least overlap; then the least moving. The same when a clear spot is far from a sign's
     own (more than o.far px, a sign's height): another order may keep every sign nearer its island */
  function boxAt(x, y, w, h) { return { x0: x - w / 2, y0: y - h, x1: x + w / 2, y1: y }; }
  function overlapArea(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function placeSignsIn(signs, fixed, W, H, o, order) {
    var inset = o.inset, gap = o.gap, pad = Math.max(0, gap - 1), boxes = fixed.slice(), out = [], over = 0, cost = 0, far = 0;
    for (var k = 0; k < order.length; k++) {
      var s = signs[order[k]], w = s.w, h = s.h;
      var xMin = inset + w / 2, xMax = W - inset - w / 2, yMin = inset + h, yMax = H - inset;
      if (xMax < xMin) xMin = xMax = W / 2;
      if (yMax < yMin) yMin = yMax = Math.min(H, h);
      var bx = Math.min(Math.max(s.x, xMin), xMax), by = Math.min(Math.max(s.y, yMin), yMax);
      var X = [bx, xMin, xMax], Y = [by, yMin, yMax], i, j, q;
      for (q = 0; q < boxes.length; q++) {
        var f = boxes[q];
        X.push(f.x0 - gap - w / 2, f.x1 + gap + w / 2, f.x0 + w / 2, f.x1 - w / 2);
        Y.push(f.y0 - gap, f.y1 + gap + h, f.y0 + h, f.y1);
      }
      var best = null, bestCost = Infinity;
      for (i = 0; i < X.length; i++) {
        var x = X[i];
        if (x < xMin - 0.01 || x > xMax + 0.01) continue;
        for (j = 0; j < Y.length; j++) {
          var y = Y[j];
          if (y < yMin - 0.01 || y > yMax + 0.01) continue;
          var c = Math.abs(y - by) + 1.5 * Math.abs(x - bx);
          if (c >= bestCost) continue;
          /* clear: at least gap - 1 px from every box (the half-pixel rounding never closes it) */
          var b = boxAt(x, y, w + 2 * pad, h + 2 * pad), clear = true;
          b.y0 += pad; b.y1 += pad;
          for (q = 0; q < boxes.length && clear; q++) if (overlapArea(b, boxes[q]) > 0) clear = false;
          if (clear) { best = { x: x, y: y }; bestCost = c; }
        }
      }
      var spill = 0;
      if (!best) {                                     /* no clear spot: the least overlap, then the nearest */
        var bestOver = Infinity;
        for (i = 0; i < X.length; i++) {
          if (X[i] < xMin - 0.01 || X[i] > xMax + 0.01) continue;
          for (j = 0; j < Y.length; j++) {
            if (Y[j] < yMin - 0.01 || Y[j] > yMax + 0.01) continue;
            var bb = boxAt(X[i], Y[j], w, h), ov = 0;
            for (q = 0; q < boxes.length; q++) ov += overlapArea(bb, boxes[q]);
            var cc = Math.abs(Y[j] - by) + 1.5 * Math.abs(X[i] - bx);
            if (ov < bestOver || (ov === bestOver && cc < bestCost)) { best = { x: X[i], y: Y[j] }; bestOver = ov; bestCost = cc; }
          }
        }
        spill = bestOver;
      }
      over += spill; cost += bestCost; far = Math.max(far, bestCost);
      boxes.push(boxAt(best.x, best.y, w, h));
      out[order[k]] = best;
    }
    return { at: out, over: over, cost: cost, far: far };
  }
  function placeSigns(signs, fixed, W, H, o) {
    o = o || {};
    var opts = { inset: typeof o.inset === 'number' ? o.inset : 8, gap: typeof o.gap === 'number' ? o.gap : 4 };
    var FAR = typeof o.far === 'number' ? o.far : 48;
    var n = signs.length, base = [], i;
    if (!n) return [];
    for (i = 0; i < n; i++) base.push(i);
    var best = placeSignsIn(signs, fixed, W, H, opts, base);
    if (best.over > 0 || best.far > FAR) {
      /* other orders: each sign first (the rest as before), then the whole list backwards */
      var orders = [];
      for (i = 1; i < n; i++) orders.push([i].concat(base.filter(function (k) { return k !== i; })));
      orders.push(base.slice().reverse());
      for (i = 0; i < orders.length; i++) {
        var r = placeSignsIn(signs, fixed, W, H, opts, orders[i]);
        if (r.over < best.over || (r.over === best.over && r.cost < best.cost)) best = r;
      }
    }
    return best.at;
  }
  /* ---------------- v3 (pure) ---------------- */
  var ISLES3 = ['home', 'pier', 'jungle', 'treetop', 'castle', 'ice'];
  var SLICE_MS = 6;              /* real-time budget per frame for template builds and bakes (D70) */
  var HOLD_SEC = 8;              /* anim.unlockIsle keeps a preview this long without unlockIsle (D44) */
  var BAKE_ROWS = 4;             /* a rest island's LOD1 bake: one mesh per band of 4 rows (per-mesh culling) */
  /* what a frame draws besides the islands' items and terrain (the bridges, sky life, water, backdrop and
     Showtime; measured in island3d-perf) and one coarse terrain: the rest budget's frame terms */
  var FRAME_FIXED = { LOW: 0, MID: 24000, HIGH: 30000 }, COARSE_TRIS = 1000;
  /* the islands a view shows: view.unlockedIsles / view.isles, else (a V4.54 host) from view.world →
     {unlockedIsles, isles {isle: [{uid, id, x, y, vr}]}} (known ids only, the save is never touched) */
  function isleLists(view, C) {
    view = view || {};
    var w = view.world && typeof view.world === 'object' ? view.world : null, out = { unlockedIsles: ['home'], isles: {} };
    if (Array.isArray(view.unlockedIsles)) out.unlockedIsles = view.unlockedIsles.filter(function (k) { return ISLES3.indexOf(k) >= 0; });
    else if (w && C && typeof C.unlockedIsles === 'function') { try { out.unlockedIsles = C.unlockedIsles(w); } catch (e) { out.unlockedIsles = ['home']; } }
    if (out.unlockedIsles.indexOf('home') < 0) out.unlockedIsles.unshift('home');
    if (view.isles && typeof view.isles === 'object') { out.isles = view.isles; return out; }
    if (w && C && typeof C.placedOn === 'function') {
      out.unlockedIsles.forEach(function (k) {
        if (k === 'home') return;
        var l = [];
        try { l = C.placedOn(w, k) || []; } catch (e) { l = []; }
        out.isles[k] = l.filter(function (p) { return p && p.uid != null && C.item(p.id); });
      });
    }
    return out;
  }
  /* an isles-view route → the host hook it calls: {hook, args} | null (pets / the avatar get the
     actors' own reaction first; a locked land opens its sheet, an open one is flown to) */
  function routeHook(r) {
    if (!r || typeof r !== 'object') return null;
    switch (r.kind) {
      case 'item': return { hook: 'tapItem', args: [r.uid] };
      case 'pet': return { hook: 'tapPet', args: [r.pet] };
      case 'avatar': return { hook: 'tapAvatar', args: [] };
      case 'bridge': return { hook: 'tapIsle', args: [r.to] };
      case 'isle': case 'gate': return r.locked === true && r.land ? { hook: 'tapLand', args: [r.land] } : { hook: 'tapIsle', args: [r.isle] };
      case 'region': return r.land ? { hook: 'tapLand', args: [r.land] } : null;
      case 'cell': return { hook: 'tapCell', args: [r.x, r.y, r.isle] };
      default: return null;
    }
  }
  /* the template namespace a copy draws from */
  function nsOf(lod) { return lod ? 'vox-lod1' : 'vox'; }

  /* a user / avatar record → {name, color, avatar, seed} (an 'emoji' field is accepted as the avatar;
     seed = the profile key's hash, a string or a number, null when the host has none) */
  function normUser(u) {
    u = u || {};
    var seed = typeof u.seed === 'string' || (typeof u.seed === 'number' && isFinite(u.seed)) ? u.seed : null;
    return { name: u.name || '', color: typeof u.color === 'string' ? u.color : null, avatar: u.avatar || u.emoji || '🙂', seed: seed };
  }
  var CHAR_KEYS = ['look', 'wear', 'vr', 'sig', 'lk', 'wr'];
  function plainLook(lk) { return !!lk && typeof lk === 'object' && !Array.isArray(lk); }
  /* Find me (KU34, KU-CH12): frame a point (the player's figure) at the largest play zoom the device
     allows through the rig's own dolly; o.instant = a cut. Any camera input afterwards is the child's:
     focusOn only sets the rig's goal, so nothing holds the camera there. → false without a point */
  function focusMeOn(rig, at, o) {
    if (!rig || typeof rig.focusOn !== 'function' || !at || !isFinite(at.x) || !isFinite(at.z)) return false;
    rig.focusOn({ x: at.x, z: at.z }, { zoom: typeof rig.zoomMax === 'function' ? rig.zoomMax() : null, instant: !!(o && o.instant) });
    return true;
  }
  /* SLIsland3D.focusMe({instant}) → bool: the newest live stage's focusMe; false with no stage */
  var LIVE = [];
  function focusMeLive(o) {
    for (var i = LIVE.length - 1; i >= 0; i--) {
      var s = LIVE[i];
      if (s && !s.failed && typeof s.focusMe === 'function') return !!s.focusMe(o);
    }
    return false;
  }
  /* THE KIDS UPDATE'S CARE (P3.3) — pure pieces. A pet's mood from the view (pets.json moodAndEating:
     {hunger 0 fine … 3 very hungry, happy 0–4, sitter}) → whole numbers in range, or null (no mood) */
  function petMood(m) {
    if (!m || typeof m !== 'object') return null;
    var h = Math.round(+m.hunger), j = Math.round(+m.happy);
    return { hunger: isFinite(h) ? clamp(h, 0, 3) : 0, happy: isFinite(j) ? clamp(j, 0, 4) : 2, sitter: m.sitter === true };
  }
  /* the host's memory stars (pet ids, or SLPetCare.memories(w) / care3.stars cards {id, name, to, returned};
     oldest first) → at most STAR_MAX {id, name, to, key}, the newest kept. A card a grown-up brought back
     (returned) is no star; a card counts once by (id, to), so a species that passed away twice keeps both
     stars (key: the star's own name in the stage, 'id' or 'id~to') */
  var STAR_MAX = 5;
  function starsOf(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (s) {
      var card = s && typeof s === 'object', id = typeof s === 'string' ? s : card && typeof s.id === 'string' ? s.id : '';
      id = id.replace(/^pet:/, '');
      if (!id || (card && s.returned)) return;
      var to = card && typeof s.to === 'string' ? s.to : '', key = id + '|' + to;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ id: id, name: card && typeof s.name === 'string' ? s.name : '', to: to, key: id });
    });
    out = out.slice(Math.max(0, out.length - STAR_MAX));
    var n = {};
    out.forEach(function (s) { n[s.id] = (n[s.id] || 0) + 1; });
    out.forEach(function (s) { if (n[s.id] > 1) s.key = s.id + '~' + s.to; });
    return out;
  }
  /* the 'I'm hungry' bubble's words when SLWorldCopy has no care.bubble.* key (they live here, with the
     stage that shows them) */
  var BUBBLE = { hungry: 'I’m hungry!', veryHungry: 'I’m very hungry!' };
  /* a feeding moment's timing: the moment's seconds (actors.feed) → when the stage settles it on its own
     clock (end), and the wall-clock backstop (ms) that settles it if frames stop (a hidden tab, a sheet).
     FEED_STILL: the reduced-motion moment's seconds (the brain's FEED.still: the end state held) */
  var FEED_GRACE = 2.5, FEED_STILL = 1.2;
  function feedStill() { var B = root.SLPetBrain, F = B && B.FEED; return F && F.still > 0 ? F.still : FEED_STILL; }
  /* the feeding moment's view: on a busy island a house or a tree in front can hide the bowl, so the camera
     may swing round a little as it frames the pet. FEED_VIEWS: [yaw°, elevation°] offsets from the pose,
     tried in turn; feedView(points, yaw, elev, boxes, elevMax) → {dYaw, dElev, n} — the first offset whose
     rays from the points (the bowl, the pet's head) toward the camera (camera.js basisInto: yaw 0 looks
     from +z) cross no box in front of them (an item's, or another figure's), else the one crossing fewest
     (the pose itself when nothing helps) */
  var FEED_VIEWS = [[0, 0], [0, 10], [-22, 6], [22, 6], [-35, 10], [35, 10], [0, 18]];
  function feedView(pts, yaw, elev, boxes, elevMax) {
    var best = null, d = { x: 0, y: 0, z: 0 }, o = { x: 0, y: 0, z: 0 }, top = isFinite(elevMax) ? elevMax : 67;
    for (var i = 0; i < FEED_VIEWS.length; i++) {
      var e = Math.max(elev, Math.min(top, elev + FEED_VIEWS[i][1])), ya = (yaw + FEED_VIEWS[i][0]) * DEG, er = e * DEG, n = 0;
      d.x = Math.sin(ya) * Math.cos(er); d.y = Math.sin(er); d.z = Math.cos(ya) * Math.cos(er);
      for (var p = 0; p < pts.length; p++) {
        o.x = pts[p].x + d.x * 0.05; o.y = pts[p].y + d.y * 0.05; o.z = pts[p].z + d.z * 0.05;
        for (var b = 0; b < boxes.length; b++) if (rayBox(o, d, boxes[b].min, boxes[b].max) > 0) n++;      /* (a box round the point itself: no view helps) */
      }
      if (!best || n < best.n) best = { dYaw: FEED_VIEWS[i][0], dElev: e - elev, n: n };
      if (!n) break;
    }
    return best || { dYaw: 0, dElev: 0, n: 0 };
  }
  function feedTiming(sec) { sec = +sec > 0 ? +sec : 0; return { end: sec, backstopMs: Math.round((sec + FEED_GRACE) * 1000) }; }
  /* what actors.sync(v) receives (the island protocol). view = rewards-world's island view;
     o = {user (normUser), placed (the placeable list), unlocked (the risen land), land, mode, reduced} */
  function actorState(view, o) {
    view = view || {}; o = o || {};
    var user = o.user || normUser(null);
    /* a pet record keeps its fields; a mood (kids update P3.3) reaches the brains in range (a copy: the
       host's record is never changed) */
    var pets = Array.isArray(view.pets) ? view.pets.filter(function (p) { return p && p.id; }).map(function (p) {
      if (p.mood == null) return p;
      var c = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) c[k] = p[k];
      c.mood = petMood(p.mood) || undefined;
      return c;
    }) : [];
    var av = view.avatar === false ? null : normUser(view.avatar && typeof view.avatar === 'object' ? {
      name: view.avatar.name || user.name, color: view.avatar.color || user.color, avatar: view.avatar.avatar || view.avatar.emoji || user.avatar
    } : user);
    /* the kids update (KU-CH12): a character's look, wear, colourways, move and codes reach actors.js as
       the host gave them; no look (or look null) is the classic avatar, unchanged */
    if (av && view.avatar && typeof view.avatar === 'object' && plainLook(view.avatar.look)) {
      CHAR_KEYS.forEach(function (k) { if (view.avatar[k] != null) av[k] = view.avatar[k]; });
    }
    var placed = Array.isArray(o.placed) ? o.placed : [];
    var s = {
      pets: pets, avatar: av, user: user, placed: placed, unlocked: Array.isArray(o.unlocked) ? o.unlocked : ['home'], land: o.land || null,
      world: view.world && Array.isArray(view.world.placed) ? view.world : { placed: placed },
      mode: normMode(o.mode || view.mode), reduced: !!o.reduced
    };
    /* v3: the island brains read the sky islands' layouts (pets may carry isle / fresh, D112) */
    if (o.isles) { s.v3 = true; s.isles = o.isles; }
    return s;
  }
  /* what edit.setState(s) receives (the island protocol); grid: the QA debug grid in play mode;
     v3 (optional): {isle, world} — the island being edited (edit3d.setIsle) */
  function editState(mode, land, unlocked, placing, ghost, selectedUid, grid, v3) {
    var s = {
      mode: normMode(mode), land: land || null, unlocked: Array.isArray(unlocked) ? unlocked : ['home'],
      placing: placing && placing.id ? placing : null, ghost: ghost || null, selectedUid: selectedUid == null ? null : selectedUid,
      grid: !!grid
    };
    if (v3 && typeof v3.isle === 'string') { s.isle = v3.isle; s.world = v3.world || null; }
    return s;
  }
  /* ray (o, d unit) against a sphere → entry t ≥ 0 (0 when the origin is inside it), or -1 */
  function raySphere(o, d, x, y, z, r) {
    var ox = o.x - x, oy = o.y - y, oz = o.z - z;
    var b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c;
    if (disc < 0) return -1;
    var s = Math.sqrt(disc), t = -b - s;
    return t >= 0 ? t : (-b + s >= 0 ? 0 : -1);
  }
  /* actors.js hit spheres [{kind: 'pet' | 'me', id, x, y, z, r, pickable}] → {target, t} | null
     (target 'pet:<id>' | 'me'; spheres marked pickable: false — edit / place mode — are skipped) */
  function pickHits(o, d, hits) {
    var best = Infinity, tgt = null;
    for (var i = 0; hits && i < hits.length; i++) {
      var h = hits[i];
      if (!h || h.pickable === false) continue;
      var t = raySphere(o, d, +h.x || 0, +h.y || 0, +h.z || 0, h.r > 0 ? h.r : 0.4);
      if (t >= 0 && t < best) { best = t; tgt = h.kind === 'me' || h.id === 'me' ? 'me' : 'pet:' + String(h.id).replace(/^pet:/, ''); }
    }
    return tgt ? { target: tgt, t: best } : null;
  }
  /* any sibling position — {x, y, z}, [x, y, z] or a Vector3 — → out {x, y, z}; null when unusable */
  function toPoint(pos, out) {
    if (!pos || typeof pos !== 'object') return null;
    out = out || {};
    if (pos.x === undefined && typeof pos.length === 'number' && pos.length >= 3) { out.x = +pos[0] || 0; out.y = +pos[1] || 0; out.z = +pos[2] || 0; return out; }
    out.x = +pos.x || 0; out.y = +pos.y || 0; out.z = +pos.z || 0;
    return out;
  }
  /* emit opts from a model or sibling → a COPY in fx names: colors (actors.js) → token | tokens,
     r → radius, to → {x, y, z} (the caller's objects are never kept) */
  function fxOpts(o) {
    if (!o || typeof o !== 'object') return undefined;
    var c = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    if (c.colors != null) {
      if (Array.isArray(c.colors)) { if (!c.tokens) c.tokens = c.colors.slice(); }
      else if (!c.token && !c.color) c.token = c.colors;
      delete c.colors;
    }
    if (c.r != null && c.radius == null) c.radius = c.r;
    delete c.r;
    if (Array.isArray(c.tokens)) c.tokens = c.tokens.slice();
    if (c.to) c.to = toPoint(c.to, {});
    return c;
  }

  /* ---------------- Encore City: per-copy style, variety, auto-tiling, layers ---------------- */
  /* FNV-1a 32-bit (the same hash as SLIslandLook / SLMotion / SLGrid3D) */
  function fnv(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /* the home's trim from the profile seed: one of the 2 shape trims, stable for a child (0 with no seed) */
  function seedVariant(seed) { return seed == null || seed === '' ? 0 : fnv(String(seed)) % 2; }
  /* view.style with the home trim filled in (the host's own variant wins) */
  function houseStyle(style, seed) {
    style = style || {};
    if (typeof style.variant === 'number' && isFinite(style.variant)) return style;
    var out = {};
    for (var k in style) if (Object.prototype.hasOwnProperty.call(style, k)) out[k] = style[k];
    out.variant = seedVariant(seed);
    return out;
  }
  /* the style a placed copy is resolved from: the house → houseStyle; a city building → its own trim
     by uid (never the child's or the view's); everything else → the shared view style */
  function copyStyle(L, id, uid, style, seed) {
    var e = L && L.LOOK ? L.LOOK[id] : null;
    if (id === 'house_cottage') return houseStyle(style, seed);
    if (e && e.kind === 'building' && typeof L.variantOf === 'function') return { variant: uid == null ? 0 : L.variantOf(uid, id) };
    return style || {};
  }
  /* the uid a placement ghost wears its trim by: a moved copy's own uid, else the uid the confirm will
     give the new copy (SLWorldCore.place: 'p' + world.nextUid), so the ghost shows the trim that lands */
  function ghostUid(placing, world) {
    if (!placing) return null;
    if (placing.uid != null) return placing.uid;
    var n = world && world.nextUid;
    return typeof n === 'number' && isFinite(n) ? 'p' + n : null;
  }
  /* SLIslandLook.jitter2 for one copy, or null when it must not move: houses, buildings, attractions,
     paths (and anything whose jitter is the identity) stay exactly on their cells */
  function jitterFor(L, uid, id, sameIdNeighbours) {
    var e = L && L.LOOK ? L.LOOK[id] : null;
    if (!e || NO_JITTER[e.kind] || typeof L.jitter2 !== 'function') return null;
    var j = L.jitter2(uid, id, sameIdNeighbours && sameIdNeighbours.length ? sameIdNeighbours : null);
    if (!j || (!j.yaw && j.sx === 1 && j.sy === 1 && j.sz === 1 && !j.lean && !j.tint)) return null;
    return j;
  }
  /* the 4-adjacent copies of the same id for every copy `want(id)` asks about:
     list [{uid, id, x, y}], fpOf(id) → [w, h] → {uid: [neighbour uids, sorted]} */
  function idNeighbours(list, fpOf, want) {
    var occ = {}, out = {}, i, dx, dy;
    for (i = 0; i < list.length; i++) {
      var p = list[i], fp = (fpOf && fpOf(p.id)) || [1, 1];
      for (dy = 0; dy < fp[1]; dy++) for (dx = 0; dx < fp[0]; dx++) occ[(p.x + dx) + ',' + (p.y + dy)] = p;
    }
    var STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < list.length; i++) {
      var q = list[i];
      if (want && !want(q.id)) continue;
      var f = (fpOf && fpOf(q.id)) || [1, 1], seen = {}, nb = [];
      for (dy = 0; dy < f[1]; dy++) for (dx = 0; dx < f[0]; dx++) {
        for (var s = 0; s < 4; s++) {
          var o = occ[(q.x + dx + STEP[s][0]) + ',' + (q.y + dy + STEP[s][1])];
          if (o && o.id === q.id && o.uid !== q.uid && !seen[o.uid]) { seen[o.uid] = 1; nb.push(o.uid); }
        }
      }
      out[q.uid] = nb.sort();
    }
    return out;
  }
  /* path auto-tiling: every path cell's neighbour mask (N 1 · E 2 · S 4 · W 8, N = the row above,
     any path id connects) → {uid: {mask, piece, yawDeg}} through SLIslandLook.pathPiece */
  function pathPieces(list, isPath, pathPiece) {
    var cells = {}, out = {}, i;
    for (i = 0; i < list.length; i++) if (isPath(list[i].id)) cells[list[i].x + ',' + list[i].y] = 1;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      if (!isPath(p.id)) continue;
      var m = (cells[p.x + ',' + (p.y - 1)] ? 1 : 0) | (cells[(p.x + 1) + ',' + p.y] ? 2 : 0) |
              (cells[p.x + ',' + (p.y + 1)] ? 4 : 0) | (cells[(p.x - 1) + ',' + p.y] ? 8 : 0);
      var pc = pathPiece(m);
      out[p.uid] = { mask: m, piece: pc.piece, yawDeg: pc.yawDeg };
    }
    return out;
  }
  /* who hosts the city across the bay and the ambient life: a v2 env (it has setEdit, or exposes
     its layers) creates, drives and disposes them; with an older env the controller does */
  function layerOwner(env) {
    if (!env || typeof env !== 'object') return 'host';
    if ((env.city && typeof env.city === 'object') || (env.life && typeof env.life === 'object')) return 'env';
    return typeof env.setEdit === 'function' ? 'env' : 'host';
  }
  /* ?grid=1 asks for the QA grid only while the parent's test mode (SL_WORLD_TRIAL) is on */
  /* ?grid=1 draws the edit grid in play — only on a QA device (localStorage slQaMode = '1') */
  function gridFromQuery(search, qa) { return !!qa && /[?&]grid=1(?:[&#]|$)/.test(String(search || '')); }
  function qaDevice() { try { return root.localStorage && root.localStorage.getItem('slQaMode') === '1'; } catch (e) { return false; } }

  /* ---------------- v2 seams: the child on handles and atlases, paths, hearts, music, the wake ---------------- */
  /* the first name only: atlases, signs and model handles never carry more of the child's name */
  function firstName(name) { return String(name == null ? '' : name).trim().split(/\s+/)[0] || ''; }
  /* the user a model sees on an island copy's handle (a.user) and the atlases get ({name, color});
     the colour as '#RRGGBB' (the models' own form, so an atlas is never redrawn for letter case) */
  function handleUser(u) {
    u = u || {};
    return { name: firstName(u.name), color: hex6(u.color), avatar: typeof u.avatar === 'string' ? u.avatar : '' };
  }
  function hex6(c) {
    var m = typeof c === 'string' ? /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim()) : null;
    if (!m) return typeof c === 'string' && c ? c : null;
    return '#' + (m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1]).toUpperCase();
  }
  /* auto-tiled path layouts per tier: each (piece, layout) is its own batch and template. Their
     tiles and LED plates draw in the merged layer (0 calls by day, 1 at Showtime, however many
     pieces), so a layout now costs only a template build and a batch's bookkeeping: LOW and MID
     keep one per piece for that CPU; HIGH shows all three */
  var PATH_LAYOUTS = { LOW: 1, MID: 1, HIGH: 3 };
  /* one path copy's look from its neighbour mask: the garden models' own pose (the piece, a free
     quarter-turn for the symmetric pieces and a stone / plank layout, hashed from the uid) when
     SLModelsGarden is loaded, else the bare piece → {st, sk, yaw} (pc = pathPieces()[uid]) */
  function pathCopy(pc, uid, MG, layouts) {
    if (MG && typeof MG.pathPose === 'function') {
      var pp = null;
      try { pp = MG.pathPose(pc.mask, uid, {}, layouts); } catch (e) { pp = null; }
      if (pp && typeof pp.stateKey === 'string' && /^p:/.test(pp.stateKey) && isFinite(pp.yawDeg)) {
        return { st: { piece: pp.piece, layout: pp.layout | 0 }, sk: pp.stateKey, yaw: pp.yawDeg };
      }
    }
    return { st: { piece: pc.piece }, sk: 'p:' + pc.piece, yaw: pc.yawDeg };
  }
  /* hearts belong to the avatar's finger-heart (art bible v2): any other 'heart' emit — the café's
     'serve' cue, a house door, a host emote over an item — plays Neon Magenta ✦ sparkles instead */
  var HEARTLESS = ['Neon Magenta', 'Foil Pink', 'Bone White'];
  function heartKind(kind, o) { return kind === 'heart' && !(o && o.fingerHeart) ? 'sparkle' : kind; }
  /* the island loop counts for the crew (beat-nods, headphone pulses) while it plays and is heard */
  function musicHeard(clk) { return !!(clk && typeof clk === 'object' && clk.playing && clk.audible !== false); }
  /* a copy's Showtime mix inside the 'city wakes up' ripple: its lights wait for the wave (env.wakeAt
     → 0..1), so they come on with the city rather than all at once */
  function wakeShow(k, wake) { return typeof wake === 'number' && isFinite(wake) ? k * clamp(wake, 0, 1) : k; }

  /* ================================================================
     SIBLING ADAPTERS (pure; Node-tested against the real actors.js / edit3d.js)
     A sibling that speaks the island protocol is used as it is; actors.js and edit3d.js publish
     their own documented APIs, so they are wrapped; anything else falls back to the built-ins.
     ================================================================ */
  function speaksIsland(kind, obj) {
    if (kind === 'actors') return typeof obj.sync === 'function' && typeof obj.pick === 'function' && typeof obj.anchor === 'function';
    if (kind === 'edit') return typeof obj.setState === 'function';
    return typeof obj.emit === 'function';
  }
  /* → the object to drive, or null (unknown shape: use the next slot / the built-in) */
  function adaptSystem(kind, obj, host) {
    if (!obj || typeof obj !== 'object') return null;
    if (speaksIsland(kind, obj)) return obj;
    if (kind === 'actors' && typeof obj.sync === 'function' && typeof obj.hits === 'function' && typeof obj.anchorOf === 'function') return adaptActors(obj, host);
    if (kind === 'edit' && typeof obj.show === 'function' && typeof obj.ghost === 'function') return adaptEdit(obj, host);
    return null;
  }
  function call0(obj, name, a, b) { return typeof obj[name] === 'function' ? obj[name](a, b) : undefined; }
  /* actors.js: sync(pets, avatar, world) · update(dt, t, show, beat) · hits(out) · anchorOf(target, out) ·
     tap(target) · emote(target, kind) · perform(kind, uid) → lead | -1 · active() → id | null · dance(on) */
  function adaptActors(A, host) {
    var clk = { beat: 0, bpm: 100, playing: false }, hitList = [];
    return {
      adapted: 'actors.js', inner: A,
      sync: function (v) {
        v = v || {};
        /* the land the island SHOWS (a region still waiting to rise stays out) and its layout */
        var placed = Array.isArray(v.placed) ? v.placed : (v.world && Array.isArray(v.world.placed) ? v.world.placed : []);
        var world = { placed: placed, unlocked: Array.isArray(v.unlocked) ? v.unlocked : ['home'], mode: normMode(v.mode) };
        if (v.land && typeof v.land === 'object') world.land = v.land;
        if (v.v3) { world.isles = v.isles || {}; if (v.world && Array.isArray(v.world.placed)) world.world = v.world; }
        A.sync(Array.isArray(v.pets) ? v.pets : [], v.avatar ? v.avatar : null, world);
      },
      /* v3 travel: the active pet crosses with a flight; setIsle = the same at once */
      follow: function (o) { var r = call0(A, 'follow', o); return typeof r === 'number' ? r : 0; },
      setIsle: function (k) { return call0(A, 'setIsle', k); },
      update: function (dt, t, ctx) {
        if (ctx && typeof ctx === 'object') {
          /* playing: the island loop is heard (the beat-nod and the headphone pulse need it) */
          clk.beat = +ctx.beatPos; clk.bpm = +ctx.bpm; clk.playing = !!ctx.musicOn;
          return !!A.update(dt, t, typeof ctx.show === 'number' ? ctx.show : undefined, isFinite(clk.beat) && clk.bpm > 0 ? clk : null);
        }
        return !!A.update(dt, t);
      },
      pick: function (o, d) { return pickHits(o, d, A.hits(hitList)); },
      anchor: function (target, out) { return A.anchorOf(target, out); },
      tap: function (target) { return typeof A.tap === 'function' ? !!A.tap(target) : false; },
      emote: function (target, kind) { return A.emote(target, kind); },
      perform: function (kind, uid) { var r = call0(A, 'perform', kind, uid); return typeof r === 'number' && r > 0 ? r : 0; },
      active: function () { return call0(A, 'active') || null; },
      dance: function (o) { var s = call0(A, 'dance', o !== false); return typeof s === 'number' ? s : 0; },
      setShow: function (k) { call0(A, 'setShow', k); },
      setMode: function (m) { call0(A, 'setMode', normMode(m)); },
      setReduced: function (on) { call0(A, 'setReduced', !!on); },
      setShowtime: function () {},                 /* the Showtime mix (setShow) drives wands and tails */
      setUser: function () {},                     /* the avatar follows view.avatar on the next sync */
      setQuality: function () {},
      /* island music heard / not (null hands it back to the frame clock's playing flag) */
      setMusic: function (on) { call0(A, 'setMusic', on == null ? null : !!on); },
      /* live item anchors for the building performs (actors.js or its brain takes them) */
      setAnchorFn: function (fn) {
        if (typeof A.setAnchorFn === 'function') return A.setAnchorFn(fn);
        if (A.brain && typeof A.brain.setAnchorFn === 'function') return A.brain.setAnchorFn(fn);
        return undefined;
      },
      info: function () { return call0(A, 'info') || null; },
      dispose: function () { call0(A, 'dispose'); },
      /* THE KIDS UPDATE'S CARE (P3.3, on P2.5's actors.js) */
      /* feed(petId, foodId, {fav}) → the moment's seconds | -1 (not out on the island shown, or it cannot eat) */
      feed: function (id, food, o) { var r = typeof A.feed === 'function' ? A.feed(id, food, o) : -1; return typeof r === 'number' && r >= 0 ? r : -1; },
      /* the island a pet is out on now ('home' or the visited land) | null; undefined: this actors.js cannot say */
      onIsle: function (id) {
        if (!A.brain || typeof A.brain.pet !== 'function') return undefined;
        var ib = A.isleBrain;
        if (ib && ib.pet(id) && !(ib.isAway && ib.isAway(id))) return A.isle || null;
        return A.brain.pet(id) && !(A.brain.isAway && A.brain.isAway(id)) ? 'home' : null;
      },
      /* where the bowl stands (world) while the moment plays | null */
      feedSpot: function (id, out) {
        var b = feedBrain(A, id), p = b && b.pet(id), f = p && p.feed, fr = (b && b.frame) || {};
        if (!f || !f.on || !isFinite(f.x)) return null;
        out = out || {};
        out.x = f.x + (+fr.ox || 0); out.y = (+f.y || 0) + (+fr.oy || 0); out.z = f.z + (+fr.oz || 0);
        return out;
      },
      /* the other crew and the figure as boxes round their tap spheres (what may stand in front of a meal) */
      occluders: function (id) {
        var out = [], hs = A.hits(hitList);
        for (var i = 0; hs && i < hs.length; i++) {
          var h = hs[i], r = h && h.r > 0 ? h.r : 0.4;
          if (!h || (h.kind === 'pet' && String(h.id).replace(/^pet:/, '') === id)) continue;
          out.push({ min: [h.x - r, h.y - r, h.z - r], max: [h.x + r, h.y + r, h.z + r] });
        }
        return out;
      },
      /* the moment is still playing (the bowl is out) */
      feedOn: function (id) { var b = feedBrain(A, id), p = b && b.pet(id), f = p && p.feed; return !!(f && f.on && b.now < f.end); },
      /* skipFeed(id, hold) — the moment's end state now (decision P22): the meal is eaten (the pet's happy
         reaction and the sparkle ring come on the brain's next step, as 'fed'), and the empty bowl stands
         hold s more without a pop (0: it goes now). actors.js's own skipFeed when it has one; else the
         moment's times (p.feed, documented by pets-brain for actors.js) are brought to the brain's now */
      skipFeed: function (id, hold) {
        if (typeof A.skipFeed === 'function') return !!A.skipFeed(id, hold);
        var b = feedBrain(A, id), p = b && b.pet(id), f = p && p.feed, now = b ? b.now : 0;
        if (!f || !f.on || !(now < f.end)) return false;
        f.reduced = true; f.eat0 = Math.min(f.eat0, now); f.eatEnd = Math.min(f.eatEnd, now); f.end = now + (hold > 0 ? hold : 0);
        if (p.state === 'act' && (p.action === 'eatWait' || p.action === 'eat')) p.actEnd = now;
        return true;
      },
      /* the reaction the last tap played ('hungry': the softer answer, and the stage's hungry bubble) */
      tapKind: function (id) { var b = feedBrain(A, id), p = b && b.pet(id); return p && typeof p.tapKind === 'string' ? p.tapKind : ''; }
    };
  }
  /* the brain a pet is out on (the visited land's, else Home's) | null */
  function feedBrain(A, id) {
    var ib = A && A.isleBrain, b = A && A.brain;
    if (ib && typeof ib.pet === 'function' && ib.pet(id) && !(ib.isAway && ib.isAway(id))) return ib;
    return b && typeof b.pet === 'function' && b.pet(id) && !(b.isAway && b.isAway(id)) ? b : null;
  }
  /* the placement edit3d.show() draws: {id, uid, x, y, ok, reason, cells?, entrance} */
  function placementCells(pl, core) {
    var out = { id: pl.id, uid: pl.uid == null ? null : pl.uid, x: pl.x | 0, y: pl.y | 0, ok: pl.ok !== false };
    if (pl.reason) out.reason = pl.reason;
    if (Array.isArray(pl.cells)) out.cells = pl.cells;
    if (Array.isArray(pl.entrance)) out.entrance = pl.entrance;
    else if (core && typeof core.entranceCells === 'function' && typeof core.item === 'function') {
      try { var it = core.item(pl.id); if (it) out.entrance = core.entranceCells(it, out.x, out.y) || []; } catch (e) { /* no entrance */ }
    }
    return out;
  }
  /* edit3d.js: show(cells, state) · ghost(id, st, x, y, ok) | ghost(null) · hide() · update(dt, t, camera) ·
     ghostPos(out) · info() → {ghost, …} · setReduced(on) · dispose() */
  function adaptEdit(E, host) {
    var shown = false, ghostOn = false, core = host && host.core;
    function ghostNow() { var i = call0(E, 'info'); return !!(i && i.ghost); }
    return {
      adapted: 'edit3d.js', inner: E,
      setState: function (s) {
        s = s || {};
        var mode = normMode(s.mode);
        if (mode === 'play') {
          if (ghostOn) E.ghost(null);
          ghostOn = false;
          if (s.grid) { E.show(s.land || null, 'grid'); shown = true; return; }     /* the QA debug grid */
          if (shown) E.hide();
          shown = false;
          return;
        }
        var pl = mode === 'place' && s.placing && s.placing.id ? s.placing : null;
        /* edit: every land cell white and dashed; place: the footprint green / red + the entrance;
           v3: on the island being edited (its frame, dock and doorway cells) */
        var cells = pl ? placementCells(pl, core) : 'edit';
        if (s.isle) E.show(s.land || null, cells, { isle: s.isle, world: s.world || undefined });
        else E.show(s.land || null, cells);
        shown = true;
        if (pl) {
          var g = s.ghost && s.ghost.id === pl.id ? s.ghost : null;
          if (s.isle && g && g.template) E.ghost(pl.id, g.st || pl.st || {}, pl.x | 0, pl.y | 0, pl.ok !== false, { template: g.template });
          else E.ghost(pl.id, (g && g.st) || pl.st || {}, pl.x | 0, pl.y | 0, pl.ok !== false);
          ghostOn = ghostNow();
        } else {
          if (ghostOn) E.ghost(null);
          ghostOn = false;
        }
      },
      /* v3: the cage round the selected copy (K.vox.cage) and the hidden pre-warm ghost (D60) */
      select: function (uid) { call0(E, 'select', uid == null ? null : uid); },
      prewarm: function () { return call0(E, 'prewarm'); },
      ghostShown: function () { return ghostOn; },
      ghostBox: function () { return null; },      /* the controller's SLGrid3D.hitBox + lift is the same box */
      update: function (dt, t, ctx) { return !!E.update(dt, t, ctx && ctx.camera ? ctx.camera : undefined); },
      setReduced: function (on) { call0(E, 'setReduced', !!on); },
      setQuality: function () {},
      info: function () { return call0(E, 'info') || null; },
      dispose: function () { call0(E, 'dispose'); }
    };
  }

  /* ================================================================
     BROWSER (installed at the end of this factory, once every table below exists)
     ================================================================ */
  function install() {
    var IS = root.SLIsland3D || (root.SLIsland3D = {});
    if (IS.mount && IS.mount.__island3d) return;
    IS.mount = mount;
    IS.mount.__island3d = VERSION;
    IS.sceneVersion = VERSION;
    IS.v3Scene = true;                       /* D84: boot loads core + vox only (never 'v2' / 'v2env') */
    IS.focusMe = focusMeLive;                /* Find me (KU34): KU-CH17's button feature-detects it */
    if (qaDevice()) { var dbg = IS.debug || (IS.debug = {}); dbg.grid = debugGrid; }   /* a console switch for QA devices only */
  }
  /* QA: SLIsland3D.debug.grid(true) draws the edit grid in play mode on every mounted island;
     grid() alone reads the setting */
  function debugGrid(on) {
    if (arguments.length) {
      DEBUG.grid = !!on;
      DEBUG.listeners.slice().forEach(function (f) { try { f(); } catch (e) { /* a disposed stage */ } });
    }
    return DEBUG.grid;
  }
  function queryGrid() {
    try { return gridFromQuery(root.location && root.location.search, qaDevice()); } catch (e) { return false; }
  }

  function perfNow() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function errText(e) { return e && e.message ? e.message : String(e); }
  function Pr() { return typeof Promise === 'function' ? Promise : null; }
  function resolved(v) { var P = Pr(); return P ? P.resolve(v) : null; }
  function deferred() {
    var P = Pr(), d = { promise: null, resolve: function () {} };
    if (P) d.promise = new P(function (res) { d.resolve = res; });
    return d;
  }
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ================================================================
     mount(opts) → stage
     ================================================================ */
  function mount(opts) {
    opts = opts || {};
    var on = opts.on || {};
    var SL3D = root.SL3D;
    var dead = false, failed = null, failTold = false, issues = [];
    var timers = [];

    function qa() { return !!(SL3D && SL3D.qa); }
    function issue(msg) {
      if (issues.length < 60) issues.push(String(msg));
      if (qa() && root.console) root.console.warn('[island3d] ' + msg);
    }
    function tell(name) {
      var f = on[name];
      if (typeof f !== 'function') return undefined;
      try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { issue('on.' + name + ' threw: ' + errText(e)); return undefined; }
    }
    function later(fn, ms) {
      var id = setTimeout(function () {
        var i = timers.indexOf(id);
        if (i >= 0) timers.splice(i, 1);
        if (!dead) fn();
      }, Math.max(0, ms | 0));
      timers.push(id);
      return id;
    }
    function cancelLater(id) { var i = timers.indexOf(id); if (i >= 0) { timers.splice(i, 1); clearTimeout(id); } }

    var stage = {};
    function fail(reason) {
      if (dead || failed) return;
      failed = String(reason || 'unknown');
      issue('fail: ' + failed);
      if (!failTold) { failTold = true; setTimeout(function () { tell('fail', failed); }, 0); }
    }
    /* wrap a public method: any throw is a silent 2D fallback (never a toast) */
    function guard(name, fn, dflt) {
      return function () {
        if (dead || failed) return typeof dflt === 'function' ? dflt() : dflt;
        try { return fn.apply(null, arguments); } catch (e) { fail(name + ': ' + errText(e)); return typeof dflt === 'function' ? dflt() : dflt; }
      };
    }
    var noP = function () { return resolved(false); };

    if (!SL3D || !SL3D.ready || !SL3D.THREE || typeof SL3D.kit !== 'function') {
      fail('3D runtime not ready');
      return stubStage(stage, function () { dead = true; }, function () { return failed; });
    }

    /* ---------------- modules ---------------- */
    var T = SL3D.THREE, tier = SL3D.tier, K = SL3D.kit(tier);
    var C = root.SLWorldCore, L = root.SLIslandLook, Gr = root.SLGrid3D, Mo = root.SLMotion;
    var CamApi = root.SLIslandCamera, Snd = root.SLSound, Mus = root.SLMusic, Copy = root.SLWorldCopy;
    if (!C || !Gr) { fail('SLWorldCore / SLGrid3D missing'); return stubStage(stage, function () { dead = true; }, function () { return failed; }); }
    /* v3 (the default registry 'vox'): the Pixel Blocks sky world; registry 'v2' is the V4.54 scene */
    var v3 = opts.registry !== 'v2';
    var IV = root.SLIslesView, R = SL3D.vox;
    if (v3 && (!R || !R.models || !K.vox || !root.SLSky3D || typeof root.SLSky3D.create !== 'function' || !IV || !Gr.V3)) {
      fail('v3 missing');
      return stubStage(stage, function () { dead = true; }, function () { return failed; });
    }
    var wantIntro = opts.intro !== false && opts.skyline !== false;

    var reduced = !!opts.reduced;
    var user = normUser(opts.user);
    var hUser = handleUser(user);             /* what island copies' handles carry as a.user (first name) */
    var optR = { reduced: reduced };          /* SLMotion sample options (reused) */

    /* ---------------- state ---------------- */
    var lease = null, scene = null, camera = null, env = null, rig = null, controls = null;
    var container = null, canvas = null, anchorsEl = null, ringEl = null, camctlEl = null, srEl = null;
    var itemsRoot = null, actorsRoot = null, fxRoot = null, editRoot = null;
    var recs = new Map(), recList = [], live = [], batches = new Map(), batchList = [];
    var lastView = null, mode = 'play', selectedUid = null, placing = null, focusKey = null;
    var litMem = {}, envUnlocked = ['home'], landKeys = null, landSig = '', firstSync = true;
    var pendingRise = null, risen = {}, lastDrop = '', placedList = [];
    var clockT = 0, frameNo = 0, cssW = 0, cssH = 0, touch = false;
    var beat = { pos: 0, bpm: 100, frac: 0, bar: 0, clk: null, polledAt: -1, clkAt: 0, music: null, heard: false };
    var showK = 0, showDirty = true, userShow = false, encore = null, nextDanceBar = -1, dance = null;
    var readyFired = false, compileState = 0, compileFrames = 0, readyTimer = 0;
    var suspended = false, covered = false, lost = false, revoked = false, launchedUid = null;
    var anchorList = [], anchorsDirty = true, anchorClock = 0, lastCamVersion = -1, bubble = null;
    var touchAction = '', cullDirty = true, emoteSeen = { target: '', t: -1 };
    var drag = null, grabCell = null, newTemplates = false, srSig = '', unsubQ = null;
    var sound = Snd && typeof Snd.make === 'function' ? safeMake(function () { return Snd.make({}); }) : null;
    var riseFx = null;
    /* v2: the city / life layers when this controller hosts them, the stage encore, cone mounts */
    var layers = { owner: 'env', city: null, life: null, halo: null };
    var encoreLock = null, coneSig = null;
    var _anc = new T.Vector3();
    /* v2 seams: the music state last told to the crew; the 'city wakes up' ripple window (clockT) */
    var musicWas = null, wakeUntil = -1;
    /* the kids update's care (P3.3): the feeding moment playing now ({id, end (clockT), resolve, timer}),
       the memory stars the host gave (re-applied whenever the sky is rebuilt) */
    var care = { feed: null, stars: [], view: null };
    /* v3: per-island displays, the last isles-view items and policy, the job queue, travel */
    var I3 = {}, V3 = {
      items: null, view: null, pol: null, est: null, unl: ['home'], isles: {}, visit: 'home', live: 'home', hold: null, holdAt: 0,
      jobs: [], promo: IV && IV.promotions ? IV.promotions() : {}, travel: null, dipEl: null, isleSig: '', polAt: -1, polSig: '',
      itemsDirty: false, camDirty: false, unlocking: {}, tris: {}, drops: {}, kbActions: {}, readyWait: 0, forceReady: false,
      anchorSig: '', visAt: -1, signs: {}, slice: { ms: 0, units: 0, max: 0, what: '', worst: 0, worstWhat: '' }
    };

    /* scratch (frame loop: no allocation) */
    var _v = new T.Vector3(), _v2 = new T.Vector3(), _ro = new T.Vector3(), _rd = new T.Vector3();
    var _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
    var _frustum = new T.Frustum(), _pm = new T.Matrix4(), _sph = new T.Sphere();
    var _sq = {}, _dr = {}, _db = {}, _st = {};

    function safeMake(fn) { try { return fn(); } catch (e) { issue('sound: ' + errText(e)); return null; } }

    /* ---------------- sound ---------------- */
    var quiet = 0;                            /* > 0: sounds and particles are suppressed (catch-up updates) */
    function silent() { return quiet > 0 || suspended || dead; }      /* the island is not on screen */
    function sfx(name, vol, step, x) {
      if (!sound || !name || silent()) return;
      var pan = 0;
      if (typeof x === 'number' && Snd.panFor) pan = Snd.panFor(x + 8, 16);
      try { sound(name, vol == null ? 1 : vol, step, pan); } catch (e) { issue('sfx ' + name + ': ' + errText(e)); }
    }
    /* the same SLSound instance for siblings (actors.js plays 'pop' / 'cheer' itself), gated alike */
    var siblingSound = !sound ? null : (function () {
      var f = function (name, vol, step, pan) { if (silent()) return; try { sound(name, vol, step, pan); } catch (e) { issue('sfx ' + name + ': ' + errText(e)); } };
      f.pet = function (id, vol, pan) { if (silent() || typeof sound.pet !== 'function') return; try { sound.pet(id, vol, pan); } catch (e) { issue('pet voice: ' + errText(e)); } };
      return f;
    }());
    /* the island's music context ('island_day' | 'island_showtime'). Music plays only while My Island
       is on screen: suspended / revoked / disposed → nothing (rewards-world sets the context again when
       the island comes back); under a sheet the latest context waits for the sheet to close. */
    var pendingMusic = null;
    function musicContext(ctx) {
      if (!Mus || typeof Mus.island !== 'function') return;
      if (dead || suspended || revoked) { pendingMusic = null; return; }
      if (covered) { pendingMusic = ctx; return; }
      pendingMusic = null;
      try { Mus.island(ctx); } catch (e) { issue('music: ' + errText(e)); }
    }

    /* ================================================================
       DOM: the persistent container (re-parented by attach, never rebuilt)
       ================================================================ */
    function buildDom() {
      container = el('div', 'slw-3d');
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.overflow = 'hidden';
      anchorsEl = el('div', 'slw-anchors');
      ringEl = el('div', 'slw-focusring', { 'aria-hidden': 'true' });
      ringEl.style.display = 'none';
      camctlEl = el('div', 'slw-camctl', { role: 'group', 'aria-label': 'Island camera' });
      /* the v2 line icons (SLWorldArt.uiIcon, aria-hidden SVG.slw-ico) when the 2D art is loaded */
      var ART = root.SLWorldArt, icon = ART && typeof ART.uiIcon === 'function' ? ART.uiIcon : null;
      [['left', '⟲', 'Turn the island left', 'rotL'], ['right', '⟳', 'Turn the island right', 'rotR'],
       ['in', '＋', 'Zoom in', 'zoomIn'], ['out', '－', 'Zoom out', 'zoomOut'], ['reset', '⌂', 'Reset the view', 'reset']].forEach(function (b) {
        var btn = el('button', 'slw-cam-' + b[0], { type: 'button', 'aria-label': b[2], 'data-cam': b[0], title: b[2] });
        var svg = '';
        try { svg = icon ? String(icon(b[3]) || '') : ''; } catch (e) { svg = ''; }
        if (svg) btn.innerHTML = svg; else btn.textContent = b[1];
        camctlEl.appendChild(btn);
      });
      camctlEl.addEventListener('click', onCamClick);
      camctlEl.addEventListener('keydown', onCamKey);
      if (opts.srList !== false) {
        srEl = el('ul', 'slw-sr-list', { 'aria-label': 'Things on your island' });
        srEl.addEventListener('click', onSrClick);
        srEl.addEventListener('focusin', onSrFocus);
        srEl.addEventListener('focusout', onSrBlur);
      }
      container.appendChild(anchorsEl);
      container.appendChild(ringEl);
      /* v3: the sky dip (D45; island-pixel.css fades it, travel colours and toggles it) */
      if (v3) { V3.dipEl = el('div', 'slw-skydip', { 'aria-hidden': 'true' }); container.appendChild(V3.dipEl); }
      container.appendChild(camctlEl);
      if (srEl) container.appendChild(srEl);
    }
    function placeCanvas() {
      if (!lease || !container) return;
      canvas = lease.canvas;
      canvas.className = 'slw-3dcanvas';
      canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;outline:none;';
      canvas.style.opacity = readyFired ? '1' : '0';
      canvas.setAttribute('aria-hidden', 'true');
      touchAction = '';
      if (canvas.parentNode !== container) container.insertBefore(canvas, container.firstChild);
      applyTouchAction();
    }
    function applyTouchAction() {
      if (!canvas) return;
      var want = mode !== 'play' || (rig && rig.zoomedIn()) ? 'none' : 'pan-y';
      if (want !== touchAction) { touchAction = want; canvas.style.touchAction = want; }
    }
    function onCamClick(e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-cam]') : null;
      if (!b || !rig || dead) return;
      rig.command(b.getAttribute('data-cam'));
      afterCamera();
      wake();
    }
    function onCamKey(e) {
      if (!controls || dead) return;
      if (care.feed && e.key === 'Escape') { skipFeed(); e.preventDefault(); return; }       /* Esc skips a feeding moment (P3.3) */
      if (mode === 'place' && /^(Arrow|Enter|Escape)/.test(e.key || '')) return;   /* rewards-world's placeKeys own these */
      if (controls.key(e)) e.preventDefault();
    }
    function syncCamButtons() {
      if (!camctlEl) return;
      var lock = mode !== 'play';
      ['left', 'right'].forEach(function (k) {
        var b = camctlEl.querySelector('[data-cam="' + k + '"]');
        if (b) b.disabled = lock;
      });
    }

    /* ================================================================
       BUILD: scene graph, env, systems (the lease needs the scene + camera first)
       ================================================================ */
    function buildScene() {
      scene = new T.Scene();
      scene.name = 'island';
      camera = new T.PerspectiveCamera(30, 16 / 9, 0.5, v3 ? 240 : 200);
      itemsRoot = new T.Group(); itemsRoot.name = 'items';
      actorsRoot = new T.Group(); actorsRoot.name = 'actors';
      fxRoot = new T.Group(); fxRoot.name = 'fx';
      editRoot = new T.Group(); editRoot.name = 'edit';
      scene.add(itemsRoot, actorsRoot, fxRoot, editRoot);
    }
    /* the environment: a v2 env bakes the child's own coastline from the seed (SLTerrain3D, when
       loaded), names the city's hero board and hosts the city and the ambient life itself.
       lazyLand: every caller syncs (or setLands) the real land right after this, so that is the one
       bake — an env that does not know the flag still bakes `unlocked` first, as before */
    function buildEnv() {
      if (v3) {
        /* SLSky3D (same method names as env): the first sync calls setLand + setIsles as a pair, so
           the cold set (coarse terrain + previews, D70) builds once */
        env = root.SLSky3D.create(K, SL3D, {
          scene: scene, renderer: lease ? lease.renderer : null, tier: tier, reduced: reduced, seed: user.seed, name: user.name,
          show: showK, visit: V3.visit
        });
        if (env.group.parent !== scene) scene.add(env.group);
        if (typeof env.hooks === 'function') env.hooks({ sound: siblingSound, fx: function (k, p, n) { fxEmit(k, p, n); } });
        if (mode !== 'play') envEdit(true);
        layers.owner = 'env';
        V3.isleSig = '';
        if (care.stars.length) applyStars();                /* a rebuilt sky keeps the memory stars (P3.3) */
        return;
      }
      var Env = root.SLIslandEnv;
      if (!Env || typeof Env.create !== 'function') throw new Error('env.js missing');
      env = Env.create(K, SL3D, {
        scene: scene, renderer: lease ? lease.renderer : null, unlocked: envUnlocked, lazyLand: true,
        world: lastView && lastView.world ? lastView.world : { placed: placedList },
        show: showK, member: user.color, reduced: reduced,
        seed: user.seed, name: user.name, tier: tier, terrain: !!root.SLTerrain3D
      });
      scene.add(env.group);
      if (mode !== 'play') envEdit(true);
      buildLayers();
    }
    function envEdit(on) {
      if (env && typeof env.setEdit === 'function') { try { env.setEdit(!!on); } catch (e) { issue('env.setEdit: ' + errText(e)); } }
      layerCall('life', 'setEdit', !!on);
    }

    /* ---------------- the city across the bay + ambient life (when the env does not host them) ---------------- */
    function buildLayers() {
      layers.owner = layerOwner(env);
      if (layers.owner !== 'host') return;
      var City = root.SLCity3D, Life = root.SLLife3D;
      if (!layers.city && City && typeof City.create === 'function') {
        try {
          layers.city = City.create(K, SL3D, { tier: tier, member: user.color, reduced: reduced, name: user.name, seed: 'sl-city-v1' });
          if (layers.city && layers.city.group) scene.add(layers.city.group); else dropLayer('city');
          if (layers.city && typeof layers.city.setShow === 'function') layers.city.setShow(showK);
        } catch (e) { issue('city3d: ' + errText(e)); dropLayer('city'); }
      }
      if (!layers.life && Life && typeof Life.create === 'function') {
        try {
          /* the lanterns' glow: an ambient halo layer of its own (fx keeps its 48 halos) */
          if (!layers.halo && typeof K.billboards === 'function') {
            layers.halo = K.billboards({ capacity: 48, texture: 'halo', additive: true, show: true, name: 'life:halos', renderOrder: 4 });
            scene.add(layers.halo.mesh);
          }
          layers.life = Life.create(K, SL3D, { tier: tier, member: user.color, reduced: reduced, haloLayer: layers.halo });
          if (layers.life && layers.life.group) scene.add(layers.life.group); else dropLayer('life');
          if (layers.life && mode !== 'play') layerCall('life', 'setEdit', true);
        } catch (e2) { issue('life3d: ' + errText(e2)); dropLayer('life'); }
      }
    }
    /* call a hosted layer; one that throws is disposed and dropped (the island goes on without it) */
    function layerCall(name, method, a, b, c) {
      var o = layers[name];
      if (!o || typeof o[method] !== 'function') return undefined;
      try { return o[method](a, b, c); } catch (e) {
        issue(name + '.' + method + ' threw: ' + errText(e));
        dropLayer(name);
        return undefined;
      }
    }
    function dropLayer(name) {
      var o = layers[name];
      if (!o) return;
      layers[name] = null;
      try { if (o.group && o.group.parent) o.group.parent.remove(o.group); } catch (e) {}
      try { if (typeof o.dispose === 'function') o.dispose(); } catch (e2) { issue(name + ' dispose: ' + errText(e2)); }
    }
    function disposeLayers() {
      dropLayer('life'); dropLayer('city');
      if (layers.halo) {
        try { if (layers.halo.mesh && layers.halo.mesh.parent) layers.halo.mesh.parent.remove(layers.halo.mesh); layers.halo.dispose(); } catch (e) {}
        layers.halo = null;
      }
    }

    /* ---------------- sibling systems (external or built-in) ---------------- */
    var SYS = {
      actors: { slots: [['SL3D', 'makeActors'], ['SLActors', 'create'], ['SLIslandActors', 'create']], make: function (h) { return new MiniActors(h); } },
      fx: { slots: [['SL3D', 'makeFx'], ['SL3D', 'makeFx3D'], ['SLFx3D', 'create'], ['SLIslandFx', 'create']], make: function (h) { return new MiniFx(h); } },
      edit: { slots: [['SL3D', 'makeEdit'], ['SL3D', 'makeEdit3D'], ['SLEdit3D', 'create'], ['SLIslandEdit', 'create']], make: function (h) { return new MiniEdit(h); } }
    };
    var sys = { actors: null, fx: null, edit: null };      /* {obj, external, name} */
    /* the host object every sibling receives (actors.js / fx3d / edit3d read it as their create()
       opts: scene, camera, reduced, tier, user, member '#hex', emit, sound / sfx, voice) */
    function hostFor(kind) {
      var g = kind === 'actors' ? actorsRoot : kind === 'fx' ? fxRoot : editRoot;
      return {
        kind: kind, K: K, SL3D: SL3D, THREE: T, tier: tier, scene: scene, group: g, camera: camera,
        renderer: lease ? lease.renderer : null, budget: SL3D.budget, quality: SL3D.quality,
        reduced: reduced, user: user, grid: Gr, motion: Mo, core: C, look: L,
        vox: v3 || undefined,                  /* actors: rigs from SL3D.vox (makeRig / makeAvatar), CREW_SCALE */
        member: user.color,                    /* '#hex' (fx3d, env); setUser passes the next one on */
        seed: user.seed,                       /* the profile key's hash (per-child variety) */
        voice: false,                          /* rewards-world plays the pet voice on tapPet */
        sound: siblingSound,
        /* a placed copy's exact placement jitter (edit3d's borrowed drop / store copies) */
        jitter: function (uid) { var r = recs.get(uid); return r && r.jit ? r.jit : null; },
        emit: function (k, pos, n, o) { fxEmit(k, pos, n, o); },
        sfx: function (name, vol, step, x) { sfx(name, vol, step, x); },
        itemPoint: function (uid, anchor, out) { return itemPoint(uid, anchor, out); },
        itemInfo: function (uid) { var r = recs.get(uid); return r ? { uid: r.uid, id: r.id, x: r.x, y: r.y, fp: r.fp } : null; },
        itemBatch: function (uid) { var r = recs.get(uid); return r && !r.dead ? r.batch : null; },
        show: function () { return showK; },
        beat: function () { return beat; },
        mode: function () { return mode; },
        templateFor: templateFor
      };
    }
    function buildSystem(kind) {
      var spec = SYS[kind], h = hostFor(kind), obj = null, name = null;
      for (var i = 0; i < spec.slots.length && !obj; i++) {
        var s = spec.slots[i], owner = s[0] === 'SL3D' ? SL3D : root[s[0]], f = owner && owner[s[1]];
        if (typeof f !== 'function') continue;
        var made = null;
        try { made = s[0] === 'SL3D' ? f(h) : f.call(owner, K, SL3D, h); name = s[0] + '.' + s[1]; } catch (e) { issue(kind + ' ' + s.join('.') + ' threw: ' + errText(e)); made = null; }
        if (!made || typeof made !== 'object') continue;
        /* drive the sibling through the island protocol (actors.js / edit3d.js get an adapter) */
        obj = adaptSystem(kind, made, h);
        if (!obj) {
          issue(kind + ' ' + s.join('.') + ': unknown API, using the built-in');
          try { if (typeof made.dispose === 'function') made.dispose(); } catch (e2) {}
        }
      }
      if (obj) { sys[kind] = { obj: obj, external: true, name: name + (obj.adapted ? ' (' + obj.adapted + ' adapter)' : '') }; return; }
      try { sys[kind] = { obj: spec.make(h), external: false, name: 'built-in' }; }
      catch (e) { issue(kind + ' fallback failed: ' + errText(e)); sys[kind] = null; }
    }
    function buildSystems() { buildSystem('fx'); buildSystem('actors'); buildSystem('edit'); }
    /* call a system method; an external sibling that throws is replaced by the fallback */
    function xcall(kind, method, a, b, c, d, e) {
      var s = sys[kind];
      if (!s || !s.obj || typeof s.obj[method] !== 'function') return undefined;
      try { return s.obj[method](a, b, c, d, e); } catch (err) {
        issue(kind + '.' + method + ' threw: ' + errText(err));
        if (s.external) {
          try { if (typeof s.obj.dispose === 'function') s.obj.dispose(); } catch (er2) {}
          sys[kind] = null;
          try { sys[kind] = { obj: SYS[kind].make(hostFor(kind)), external: false, name: 'built-in' }; } catch (er3) { issue(kind + ' fallback failed: ' + errText(er3)); }
          if (kind === 'actors') { wireAnchors(); if (lastView) syncActors(lastView); }
          if (kind === 'edit') applyEdit();
        }
        return undefined;
      }
    }
    function disposeSystems() {
      ['edit', 'actors', 'fx'].forEach(function (k) {
        var s = sys[k];
        if (s && s.obj && typeof s.obj.dispose === 'function') { try { s.obj.dispose(); } catch (e) { issue(k + ' dispose: ' + errText(e)); } }
        sys[k] = null;
      });
    }

    /* ---------------- FX helpers (positions and opts are copied; arrays from siblings accepted) ---------------- */
    function fxEmit(kind, pos, n, o) {
      if (!pos || quiet > 0) return;
      var p = toPoint(pos, {});
      if (!p) return;
      var k = heartKind(kind, o), fo = fxOpts(o);
      if (k !== kind) {                       /* a heart that is not the finger-heart: ✦ sparkles */
        fo = fo || {};
        if (!fo.tokens && !fo.token && !fo.color) fo.tokens = HEARTLESS.slice();
      }
      xcall('fx', 'emit', k, p, n == null ? undefined : n, fo);
    }

    /* ================================================================
       LEASE + LOOP
       ================================================================ */
    function takeLease() {
      lease = SL3D.lease('island', {
        scene: scene, camera: camera, reduced: reduced,
        steps: v3 ? ['isles', 'water'] : undefined,     /* D82: the island-only ladder steps v3 honours */
        frame: frame,
        onResize: function (w, h) { onResize(w, h); },
        onLost: function () { lost = true; },
        onRestored: function () { lost = false; rebuildAll(); },
        onFail: function (reason) { fail(reason || 'lease'); },
        onRevoke: function (L, why) { revoked = true; if (why === 'dispose') fail('renderer disposed'); },
        onResume: function () { revoked = false; onResumeLease(); }
      });
      if (!lease) throw new Error('no renderer lease');
    }
    function onResumeLease() {
      placeCanvas();
      if (env && typeof env.attach === 'function') env.attach(lease.renderer);
      /* the static shadow map is only drawn on demand: a context lost / restored while a game
         held the renderer leaves it empty, so re-bake it once whenever the island gets it back */
      if (env && typeof env.invalidateShadows === 'function') env.invalidateShadows();
      if (container && container.parentNode) lease.observe(container);
      if (rig) rig.apply(camera);
      anchorsDirty = true;
      wake();
    }
    function onResize(w, h) {
      cssW = w; cssH = h;
      if (rig) { rig.resize(w, h); rig.update(0); rig.apply(camera); }
      anchorsDirty = true; cullDirty = true; tagSizesDirty = true;   /* the camera buttons may have moved (R2) */
    }
    function wake() { if (lease && !dead) { try { lease.invalidate(); } catch (e) {} } }

    /* the beat clock: SLMusic.clock() polled at 4 Hz and extrapolated; otherwise an internal
       clock at the island tempo (100 by day, 118 at Showtime) */
    function updateBeat(dt) {
      if (Mus && typeof Mus.clock === 'function') {
        if (beat.polledAt < 0 || clockT - beat.polledAt >= 0.25) {
          try { beat.clk = Mus.clock(); } catch (e) { beat.clk = null; }
          beat.polledAt = clockT; beat.clkAt = perfNow();
        }
        var k = beat.clk;
        if (k && isFinite(k.beat) && k.bpm > 0) {
          beat.bpm = k.bpm;
          beat.pos = k.beat + (perfNow() - beat.clkAt) / 1000 * k.bpm / 60;
          if (v3 && beat.pos < 0) beat.pos = 0;     /* a track scheduled ahead (the encore) counts in below 0: the v3 lamps index by bar */
          beat.music = k.playing ? k : false;
        } else { beat.bpm = showOn() ? DANCE_BPM : 100; beat.pos += dt * beat.bpm / 60; beat.music = false; }
      } else {
        beat.bpm = showOn() ? DANCE_BPM : 100;
        beat.pos += dt * beat.bpm / 60;
        beat.music = null;
      }
      beat.frac = beat.pos - Math.floor(beat.pos);
      beat.bar = Math.floor(beat.pos / 4);
      beat.heard = musicHeard(beat.music);
      /* the crew nods and pulses only to music the child can hear: told on every change */
      if (beat.heard !== musicWas) { musicWas = beat.heard; xcall('actors', 'setMusic', beat.heard); }
    }
    function showOn() { return userShow || !!encore; }

    function fill(rec, dt) {
      var a = rec.a;
      a.t = clockT; a.dt = dt; a.beat = beat.frac; a.bar = beat.bar; a.bpm = beat.bpm;
      a.show = recShow(rec); a.lit = litMem[rec.uid] ? 1 : 0; a.reduced = reduced; a.music = beat.music;
      a.pathD = rec.pathD;
    }
    /* a copy's Showtime mix: the island's, held back until the env's 'city wakes up' wave reaches it */
    function recShow(rec) {
      if (showK <= 0 || !env || typeof env.wakeAt !== 'function') return showK;
      var w;
      try { w = env.wakeAt(rec.wx, rec.wz); } catch (e) { return showK; }
      return wakeShow(showK, w);
    }

    function frame(dt, t) {
      if (dead || failed) return false;
      frameNo++;
      clockT += dt;
      var busy = false;
      if (compileState === 2) { compileFrames++; if (compileFrames >= 2) fireReady(); }
      updateBeat(dt);
      /* environment + the Golden hour ↔ Showtime mix (k 0 = DUSK) */
      if (env) {
        if (env.update(dt, clockT)) busy = true;
        if (env.show !== showK) {
          showK = env.show; showDirty = true;
          if (typeof env.wakeAt === 'function') wakeUntil = clockT + WAKE_TAIL;    /* lights follow the wave */
        }
      }
      /* the hosted city / life (a v2 env drives its own) */
      if (layers.city && layerCall('city', 'update', dt, showK)) busy = true;
      if (layers.life && layerCall('life', 'update', dt, showK, showK)) busy = true;
      /* camera */
      if (rig) {
        if (rig.update(dt)) { rig.apply(camera); busy = true; }
        if (rig.version !== lastCamVersion) {
          lastCamVersion = rig.version; anchorsDirty = true; cullDirty = true;
          if (v3) camMoved();
        }
        applyTouchAction();
      }
      if (cullDirty) cullRecs();
      if (v3 && frame3(dt)) busy = true;
      /* selection pulse 0.018 ↔ 0.03 u at 1.5 Hz */
      if (selectedUid && recs.has(selectedUid)) {
        K.setSelPulse(reduced ? 0.5 : 0.5 + 0.5 * Math.sin(clockT * 9.42477796));
        if (!reduced) busy = true;
      }
      /* idles (reduced motion, or the 'decor' quality step: once after each sync, at rest) */
      var i, rec, still = reduced || decorRest;
      for (i = 0; i < recList.length; i++) {
        rec = recList[i];
        if (!rec.idleOn || rec.badIdle || rec.hidden) continue;
        if (v3 && rec.isle !== V3.live && !rec.act) continue;       /* idles tick on the live island only (D42) */
        if (still) { if (!rec.idlePending) continue; }
        else if (!rec.inView && !rec.act) continue;
        rec.idlePending = false;
        fill(rec, dt);
        if (decorRest) rec.a.reduced = true;        /* the model's own rest pose (fill restores it next call) */
        var r;
        try { r = rec.model.idle(rec.a); } catch (e) { modelError(rec, 'idle', e); continue; }
        if (r !== false) busy = true;
      }
      /* show handlers whenever the mix moves (and while the 'city wakes up' wave is still travelling) */
      if (showDirty || clockT < wakeUntil) {
        showDirty = false;
        for (i = 0; i < recList.length; i++) callShow(recList[i], dt);
        xcall('actors', 'setShow', showK);      /* fx halos follow Showtime through the kit (K.setShow) */
        busy = true;
      }
      /* live acts, controller anims, root composition */
      for (i = live.length - 1; i >= 0; i--) {
        rec = live[i];
        if (rec.dead) { live[i] = live[live.length - 1]; live.length--; continue; }
        if (stepLive(rec, dt)) busy = true;
        if (rec.dead || (!rec.act && !rec.animOn && !rec.rootDirty)) { rec.inLive = false; live[i] = live[live.length - 1]; live.length--; }
      }
      for (i = 0; i < batchList.length; i++) batchList[i].batch.commit();
      commitMerged();
      /* siblings */
      var ctx = frameCtx(dt);
      if (sys.actors && xcall('actors', 'update', dt, clockT, ctx)) busy = true;
      if (sys.edit && xcall('edit', 'update', dt, clockT, ctx)) busy = true;
      if (sys.fx && xcall('fx', 'update', dt, clockT, ctx)) busy = true;
      if (care.feed && stepFeed()) busy = true;     /* the feeding moment (P3.3) keeps the frames coming until it ends */
      if (riseFx) { stepRiseFx(dt); busy = true; }
      /* Showtime dance breaks every 16 bars */
      scheduleDance();
      if (dance && clockT >= dance.until) endDance();
      if (dance) busy = true;                       /* its end is measured in frames */
      /* labels */
      anchorClock += dt;
      if (anchorsDirty || (busy && anchorClock >= 1 / ANCHOR_HZ)) projectAnchors();
      if (pendingRise && clockT - pendingRise.at > 2.5) applyPendingRise();
      /* v3: the sky's per-frame camera work (backdrop parallax, isles-gl's 45 u rule, the shadow map) */
      if (v3 && env && camera) env.beforeRender(lease ? lease.renderer : null, camera);
      return busy || !reduced;
    }
    var FCTX = { show: 0, beat: 0, beatPos: 0, bar: 0, bpm: 100, reduced: false, mode: 'play', camera: null, music: null, musicOn: false, dt: 0 };
    function frameCtx(dt) {
      FCTX.show = showK; FCTX.beat = beat.frac; FCTX.bar = beat.bar; FCTX.bpm = beat.bpm; FCTX.beatPos = beat.pos;
      FCTX.reduced = reduced; FCTX.mode = mode; FCTX.camera = camera; FCTX.music = beat.music; FCTX.musicOn = beat.heard; FCTX.dt = dt;
      return FCTX;
    }
    function modelError(rec, what, e) {
      rec.bad = (rec.bad || 0) + 1;
      issue(rec.id + '.' + what + ' threw: ' + errText(e));
      if (what === 'idle' && rec.bad >= 3) rec.badIdle = true;
      if (what === 'show' && rec.bad >= 3) rec.badShow = true;
    }
    function callShow(rec, dt) {
      if (!rec.model || typeof rec.model.show !== 'function' || rec.badShow) return;
      fill(rec, dt || 0);
      try { rec.model.show(rec.a, rec.a.show); } catch (e) { modelError(rec, 'show', e); }
    }
    /* ticking culls copies outside the view (acts always run) */
    function cullRecs() {
      cullDirty = false;
      if (!camera) return;
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
      for (var i = 0; i < recList.length; i++) {
        var r = recList[i];
        _sph.center.set(r.wx, r.wy + r.h * 0.5, r.wz);
        _sph.radius = r.rad;
        r.inView = _frustum.intersectsSphere(_sph);
      }
    }

    /* ================================================================
       RECORDS — one per placed copy
       ================================================================ */
    function animSlot() { return { t: -1, dur: 0, cues: null, ci: 0, silent: false }; }
    function templateFor(id, st) {
      var rs = resolveStyle(id, st), sk = K.stateKey(id, rs);
      if (v3) return { tpl: tplGet(id, sk, rs, 'vox'), stateKey: sk, st: rs, material: undefined };
      return { tpl: K.templates.get(id, sk, tier, rs), stateKey: sk, st: rs, material: matHook(id) };
    }
    /* v3: a template from the vox registry; its triangles feed the visited island's estimate (D106) */
    function tplGet(id, sk, st, ns) {
      var tpl = K.templates.get(id, sk, tier, st, ns);
      if (tpl && typeof tpl.tris === 'number') V3.tris[ns + ':' + id + '#' + sk] = tpl.tris;
      return tpl;
    }
    function tplReady(id, sk, ns) { return Object.prototype.hasOwnProperty.call(V3.tris, ns + ':' + id + '#' + sk) && K.templates.has(id, sk, tier, ns); }
    function resolveStyle(id, style) {
      if (L && typeof L.resolveStyle === 'function') { try { return L.resolveStyle(id, style || {}); } catch (e) {} }
      var s = style || {};
      if (id === 'house_cottage') return { wall: s.wall || 'wall_cream', roof: s.roof || 'roof_red', door: s.door || 'door_blue', details: s.details || {} };
      if (id === 'att_course') return { course: s.course || 'course_meadow' };
      if (id === 'att_pitch') return { ball: s.ball || 'ball_classic', stadium: s.stadium || 'stadium_day' };
      if (id === 'att_kart') return { kart: s.kart || 'kart_red' };
      return {};
    }
    var matHooks = {};
    function matHook(id) {
      if (Object.prototype.hasOwnProperty.call(matHooks, id)) return matHooks[id];
      var m = SL3D.models[id], h;
      if (m && typeof m.material === 'function') {
        h = function (key, part) { try { return m.material(key, part) || null; } catch (e) { issue(id + '.material threw: ' + errText(e)); return null; } };
      }
      matHooks[id] = h;
      return h;
    }
    /* the merged layer (perf): every eligible part of every copy draws in one skinned mesh per
       material (kit MERGED LAYER), so the draw calls no longer grow with the island; committed
       once a frame after the batches, and before every compile so its programs are pre-warmed */
    var merged = null;
    function mergedLayer() {
      if (merged || typeof K.merger !== 'function' || !itemsRoot) return merged;
      try { merged = K.merger({ name: 'items:merged' }); itemsRoot.add(merged.group); } catch (e) { issue('merger: ' + errText(e)); merged = null; }
      return merged;
    }
    function commitMerged() {
      if (!merged) return;
      try { merged.commit(); } catch (e) { issue('merger commit: ' + errText(e)); }
    }
    function disposeMerged() {
      if (!merged) return;
      try { merged.dispose(); } catch (e) { issue('merger dispose: ' + errText(e)); }
      merged = null;
    }
    /* the adaptive ladder's 'decor' step (a CPU-bound device): every item idle settles once at its
       rest pose, as under reduced motion, and then rests — no per-frame idles, bones or colour
       chases; taps, acts and the Showtime mix still play */
    var decorRest = false;
    function qualityItems(q) {
      var rest = !!(q && q.decor === false);
      if (v3 && V3.items) refreshIsles();       /* the 'isles' / 'decor' steps change the policy (D42, D71) */
      if (rest === decorRest) return;
      decorRest = rest;
      for (var i = 0; i < recList.length; i++) recList[i].idlePending = true;
      wake();
    }
    /* v2: one batch per (id, stateKey) in the merged layer; v3: per (island, ns, id, stateKey) in that
       island's own merger */
    function batchFor(id, sk, st, isle, ns) {
      var key = v3 ? isle + '|' + ns + '|' + batchKey(id, sk) : batchKey(id, sk), b = batches.get(key);
      if (b) return b;
      var batch, tpl;
      if (v3) {
        var S = isleOf(isle);
        tpl = tplGet(id, sk, st, ns);
        batch = K.batch(tpl, { merge: isleMerger(S) });
        isleGroup(S).add(batch.group);
      } else {
        tpl = K.templates.get(id, sk, tier, st);
        batch = K.batch(tpl, { material: matHook(id), merge: mergedLayer() || undefined });
        itemsRoot.add(batch.group);
      }
      b = { key: key, id: id, sk: sk, tpl: tpl, batch: batch, n: 0 };
      batches.set(key, b); batchList.push(b);
      newTemplates = true;
      return b;
    }
    function releaseBatch(b) {
      b.n--;
      if (b.n > 0) return;
      batches.delete(b.key);
      var i = batchList.indexOf(b);
      if (i >= 0) batchList.splice(i, 1);
      try { b.batch.dispose(); } catch (e) { issue('batch dispose: ' + errText(e)); }
    }
    function idleOnFor(model, sk) {
      if (!model || typeof model.idle !== 'function') return false;
      if (typeof model.animated === 'function') { try { return !!model.animated(sk); } catch (e) { return true; } }
      return true;
    }
    function placeRec(rec) {
      var w = rec.batch.worldPos(rec.uid, _v);
      rec.wx = w.x; rec.wy = w.y; rec.wz = w.z;
      var hb = null;
      try { hb = v3 ? Gr.V3.frame(rec.isle).hitBox(rec.id, rec.x, rec.y) : Gr.hitBox(rec.id, rec.x, rec.y); } catch (e) { hb = null; }
      if (!hb) { var fp = rec.fp; hb = { min: [rec.wx - fp[0] / 2, rec.wy, rec.wz - fp[1] / 2], max: [rec.wx + fp[0] / 2, rec.wy + 0.8, rec.wz + fp[1] / 2] }; }
      rec.hit = hb;
      rec.h = Math.max(0.4, hb.max[1] - hb.min[1]);
      rec.rad = 0.5 * Math.sqrt((hb.max[0] - hb.min[0]) * (hb.max[0] - hb.min[0]) + rec.h * rec.h + (hb.max[2] - hb.min[2]) * (hb.max[2] - hb.min[2])) + 0.3;
      rec.inView = true;
      cullDirty = true;
    }
    function makeHandle(rec) {
      var proxy = { name: '', set: function (rot, pos, scale) { pivotSet(rec, proxy.name, rot, pos, scale); return proxy; } };
      var seed = Mo ? Mo.hash(String(rec.uid)) : 1;
      var rnd = Gr && Gr.rng ? Gr.rng(seed) : Math.random;
      var a = {
        uid: rec.uid, id: rec.id, t: clockT, dt: 0, phase: Mo ? Mo.phaseOf(rec.uid) : 0, rand: rnd,
        reduced: reduced, beat: 0, bar: 0, bpm: 100, show: showK, lit: 0,
        stateKey: rec.sk, st: rec.st, template: rec.tpl, batch: rec.batch, object: null, music: null, pathD: rec.pathD,
        copyGeometry: function (part) { return rec.batch ? rec.batch.copyGeometry(rec.uid, part) : null; },
        basePositions: function (part) { return rec.batch ? rec.batch.basePositions(part) : null; },
        pivot: function (name) { proxy.name = name; return proxy; },
        state: function (key, v) { if (rec.batch && !rec.dead) rec.batch.setState(rec.uid, key, v); },
        halo: function (name, onOff, size, token) { haloFor(rec, name, onOff, size, token); },
        decal: function (onOff, token) { decalFor(rec, onOff, token); },
        emit: function (kind, where, n, o) { emitFor(rec, kind, where, n, o); },
        sfx: function (name, vol, step) { sfx(name, vol, step, rec.wx); },
        pets: petsApi,
        shake: function (amp, dur) { if (!reduced && rig) rig.shake(amp, dur); },
        squish: function () { startAnim(rec, 'squish', true); },
        /* v2: the child (member trims, the tower's initial, the strip's emoji) and the local bloom */
        member: hUser.color, user: hUser,
        bloom: function (name, size, token) { return bloomFor(rec, name, size, token); }
      };
      if (v3) a.isle = rec.isle;                 /* v3: the island the copy stands on (a telescope's sightings) */
      return a;
    }
    /* a.pets.active(): the active crew member's id (the café / booth voice, the strip poses, the LED
       tower's pet program need it), null with none; a sibling that only knows yes / no gives true */
    var petsApi = {
      active: function () {
        var r = xcall('actors', 'active');
        return typeof r === 'string' ? (r || null) : r ? true : null;
      },
      perform: function (kind, uid) {
        var r = xcall('actors', 'perform', kind, uid);
        if (typeof r === 'number') return r;
        if (r && typeof r === 'object') return typeof r.lead === 'number' ? r.lead : (typeof r.dur === 'number' ? r.dur : 0);
        return r ? 1.2 : 0;
      }
    };
    function rebindHandle(rec) {
      var a = rec.a;
      a.stateKey = rec.sk; a.st = rec.st; a.template = rec.tpl; a.batch = rec.batch;
    }
    /* pivot('root') / pivot('sway' without a sway pivot): captured, composed at the end of the frame */
    function pivotSet(rec, name, rot, pos, scale) {
      if (rec.dead || !rec.batch) return;
      var tp = rec.tpl && rec.tpl.pivots;
      if (name === 'root' || (name === 'sway' && !(tp && tp.sway))) {
        var m = rec.rootModel;
        m.rx = rot ? +rot[0] || 0 : 0; m.ry = rot ? +rot[1] || 0 : 0; m.rz = rot ? +rot[2] || 0 : 0;
        m.px = pos ? +pos[0] || 0 : 0; m.py = pos ? +pos[1] || 0 : 0; m.pz = pos ? +pos[2] || 0 : 0;
        if (scale == null) { m.sx = m.sy = m.sz = 1; }
        else if (typeof scale === 'number') { m.sx = m.sy = m.sz = scale; }
        else { m.sx = scale[0] == null ? 1 : +scale[0]; m.sy = scale[1] == null ? 1 : +scale[1]; m.sz = scale[2] == null ? 1 : +scale[2]; }
        rec.rootDirty = true;
        addLive(rec);
        return;
      }
      rec.batch.setPivot(rec.uid, name, rot, pos, scale);
    }
    function addLive(rec) { if (!rec.inLive && !rec.dead) { rec.inLive = true; live.push(rec); } }

    /* where a copy stands: its cells, plus the auto-tiled path yaw */
    function placeOf(n, fp) {
      if (n.place) return { x: n.x, y: n.y, fp: fp, pos: n.place.pos, baseY: n.place.baseY, yaw: n.place.yaw };   /* v3: the island frame's pivot */
      var p = { x: n.x, y: n.y, fp: fp };
      if (typeof n.yaw === 'number') p.yaw = n.yaw;
      return p;
    }
    function modelOf(id) { return (v3 ? R.models[id] : SL3D.models[id]) || null; }
    function addRec(n) {
      var it = C.item(n.id), fp = (it && it.fp) || [1, 1];
      var b = batchFor(n.id, n.sk, n.st, n.isle, n.ns);
      b.batch.add(n.uid, placeOf(n, fp), n.jit ? { jitter: n.jit } : undefined);
      b.n++;
      var model = modelOf(n.id);
      var rec = {
        isle: n.isle || 'home', ns: n.ns || null, place: n.place || null,
        uid: n.uid, id: n.id, it: it, x: n.x, y: n.y, fp: fp, st: n.st, sk: n.sk, b: b, batch: b.batch, tpl: b.tpl, model: model,
        jit: n.jit || null, jsig: n.jsig || '', pyaw: typeof n.yaw === 'number' ? n.yaw : 0, wx: 0, wy: 0, wz: 0, hit: null, h: 1, rad: 1, inView: true,
        a: null, act: null, anims: { squish: animSlot(), drop: animSlot(), debut: animSlot(), store: animSlot() }, animOn: 0,
        rootModel: { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, sx: 1, sy: 1, sz: 1 }, rootDirty: false, rootOn: false, inLive: false,
        idleOn: idleOnFor(model, n.sk) && n.ns !== 'vox-lod1', idlePending: true, hidden: false, storing: false, removeAfter: false,
        halos: {}, decalOn: null, decalVia: null, pathD: undefined, bad: 0, badIdle: false, badShow: false, dead: false, debutP: null, storeP: null
      };
      placeRec(rec);
      rec.a = makeHandle(rec);
      recs.set(rec.uid, rec);
      recList.push(rec);
      callShow(rec, 0);
      if (litMem[rec.uid]) snapLit(rec);
      if (v3 && V3.drops[rec.uid]) { delete V3.drops[rec.uid]; setHidden(rec, false); startAnim(rec, 'drop'); }   /* a landmark waiting to drop in */
      return rec;
    }
    function moveRec(rec, n) {
      rec.x = n.x; rec.y = n.y;
      rec.batch.move(rec.uid, n.x, n.y, varyPlace(rec, n));
      placeRec(rec);
      refreshAttachments(rec);
      rec.idlePending = true;
    }
    /* a copy whose same-id neighbours (its jitter) or path piece yaw changed → the place to re-write
       ({jitter, yaw}), else undefined; the record keeps what the batch now shows. v3: the whole place
       (an island frame's pivot, the piece yaw, the jitter) every time */
    function varyPlace(rec, n) {
      if (n.place) {
        rec.place = n.place; rec.jit = n.jit || null; rec.jsig = n.jsig || ''; rec.pyaw = n.place.yaw || 0;
        return { fp: n.place.fp, baseY: n.place.baseY, pos: n.place.pos, yaw: n.place.yaw, jitter: n.jit || NO_JIT };
      }
      var jitCh = (n.jsig || '') !== rec.jsig, yawCh = typeof n.yaw === 'number' && n.yaw !== rec.pyaw;
      if (!jitCh && !yawCh) return undefined;
      var p = {};
      if (jitCh) { p.jitter = n.jit || NO_JIT; rec.jit = n.jit || null; rec.jsig = n.jsig || ''; }
      if (yawCh) { p.yaw = n.yaw; rec.pyaw = n.yaw; }
      return p;
    }
    /* per-copy state a model keeps for a uid (lamp levels, halos, pivots) ends with the copy */
    function forgetCopy(rec) {
      var m = rec.model;
      if (m && typeof m.forget === 'function') { try { m.forget(rec.uid); } catch (e) { issue(rec.id + '.forget threw: ' + errText(e)); } }
    }
    function restyleRec(rec, n) {
      /* a path piece that turned into another (a neighbour came or went), a wall that joined up or a
         v3 copy changing level of detail is not a new look: no sparkle */
      var pieceSwap = rec.id === n.id && ((/^[pw]:/.test(String(rec.sk)) && /^[pw]:/.test(String(n.sk))) || (rec.sk === n.sk && rec.ns !== n.ns));
      /* a level-of-detail swap keeps a running act (it re-binds to the new batch) */
      var keepAct = pieceSwap && rec.sk === n.sk && rec.act;
      if (!keepAct) cancelAct(rec, false);
      if (!(v3 && pieceSwap)) forgetCopy(rec);
      var old = rec.b, it = C.item(n.id);
      old.batch.remove(rec.uid);
      releaseBatch(old);
      var b = batchFor(n.id, n.sk, n.st, n.isle || rec.isle, n.ns || rec.ns);
      b.batch.add(rec.uid, placeOf(n, (it && it.fp) || rec.fp), n.jit ? { jitter: n.jit } : undefined);
      b.n++;
      rec.jit = n.jit || null; rec.jsig = n.jsig || ''; rec.pyaw = typeof n.yaw === 'number' ? n.yaw : 0;
      rec.id = n.id; rec.it = it; rec.x = n.x; rec.y = n.y; rec.st = n.st; rec.sk = n.sk;
      if (v3) { rec.isle = n.isle || rec.isle; rec.ns = n.ns || rec.ns; rec.place = n.place || rec.place; }
      rec.b = b; rec.batch = b.batch; rec.tpl = b.tpl; rec.model = modelOf(n.id);
      rec.idleOn = idleOnFor(rec.model, n.sk) && rec.ns !== 'vox-lod1'; rec.idlePending = true; rec.badIdle = rec.badShow = false; rec.bad = 0;
      if (rec.hidden) rec.batch.hide(rec.uid);
      rebindHandle(rec);
      placeRec(rec);
      if (rec.rootOn || rec.animOn) { rec.rootDirty = true; addLive(rec); }
      refreshAttachments(rec);
      callShow(rec, 0);
      if (litMem[rec.uid]) snapLit(rec);
      if (selectedUid === rec.uid) rec.batch.setHighlight(rec.uid, 2);
      else if (focusKey === 'u:' + rec.uid) rec.batch.setHighlight(rec.uid, 1);
      if (env) env.invalidateShadows();                 /* restyles and shape changes re-bake the shadow map */
      /* the restyle debut sparkle */
      if (readyFired && !pieceSwap) emitFor(rec, 'sparkle', 'top', reduced ? 6 : 16);
    }
    function removeRec(rec) {
      if (rec.dead) return;
      cancelAct(rec, false);
      forgetCopy(rec);
      Object.keys(rec.halos).forEach(function (name) { if (rec.halos[name] && rec.halos[name].on) xcall('fx', 'halo', rec.uid + ':' + name, false); });
      decalOff(rec);
      if (selectedUid === rec.uid && tier === 'LOW') selDecal(rec, false);
      rec.dead = true;
      try { rec.batch.remove(rec.uid); } catch (e) {}
      releaseBatch(rec.b);
      recs.delete(rec.uid);
      var i = recList.indexOf(rec);
      if (i >= 0) recList.splice(i, 1);
      if (selectedUid === rec.uid) selectedUid = null;
      if (focusKey === 'u:' + rec.uid) focusItem(null);
      if (rec.storeP) { rec.storeP.resolve(true); rec.storeP = null; }
      if (rec.debutP) { rec.debutP.resolve(false); rec.debutP = null; }
    }
    function setHidden(rec, on) {
      on = !!on;
      if (rec.hidden === on) return;
      rec.hidden = on;
      if (on) rec.batch.hide(rec.uid); else rec.batch.show(rec.uid);
    }
    /* halos / decal follow a moved copy */
    function refreshAttachments(rec) {
      Object.keys(rec.halos).forEach(function (name) {
        var h = rec.halos[name];
        if (h && h.on) haloFor(rec, name, true, h.size, h.token, true);
      });
      if (rec.decalOn) decalFor(rec, true, rec.decalOn, true);
      if (tier === 'LOW' && selectedUid === rec.uid) selDecal(rec, true);
    }
    /* world position of an item anchor (or a pivot origin when the template has no such anchor) */
    function anchorOf(rec, name, out) {
      var tpl = rec.tpl;
      if (name && tpl && !tpl.anchors[name] && tpl.pivots && tpl.pivots[name]) {
        var o = tpl.pivots[name].origin;
        return localToWorld(rec, o[0], o[1], o[2], out);
      }
      return rec.batch.anchorWorld(rec.uid, name || 'top', out);
    }
    /* item space → world for a copy: its per-axis jitter scale, then its yaw (jitter + path piece);
       the ≤ 3° lean is left out (emit points and pivot origins only) */
    function localToWorld(rec, x, y, z, out) {
      var j = rec.jit || NO_JIT, a = (j.yaw + rec.pyaw) * DEG, c = Math.cos(a), s = Math.sin(a);
      var lx = x * j.sx, lz = z * j.sz;
      out.x = rec.wx + lx * c + lz * s;
      out.y = rec.wy + y * j.sy;
      out.z = rec.wz - lx * s + lz * c;
      return out;
    }
    function itemPoint(uid, anchor, out) {
      var rec = recs.get(uid);
      if (!rec) return null;
      return anchorOf(rec, anchor || 'top', out || new T.Vector3());
    }
    function emitFor(rec, kind, where, n, o) {
      if (rec.dead) return;
      if (typeof where === 'string' || where == null) anchorOf(rec, where || 'top', _v2);
      else if (Array.isArray(where)) localToWorld(rec, +where[0] || 0, +where[1] || 0, +where[2] || 0, _v2);
      else if (typeof where === 'object') localToWorld(rec, +where.x || 0, +where.y || 0, +where.z || 0, _v2);
      else anchorOf(rec, 'top', _v2);
      fxEmit(kind, _v2, n, o);
    }
    function haloFor(rec, name, onOff, size, token, force) {
      if (rec.dead) return;
      name = String(name || 'glow');
      var cur = rec.halos[name];
      onOff = !!onOff;
      if (!force && cur && cur.on === onOff && cur.size === size && cur.token === token) return;
      rec.halos[name] = { on: onOff, size: size, token: token };
      if (onOff) { anchorOf(rec, name, _v2); xcall('fx', 'halo', rec.uid + ':' + name, true, { x: _v2.x, y: _v2.y, z: _v2.z }, size || 0.9, token || 'Lamp Halo'); }
      else xcall('fx', 'halo', rec.uid + ':' + name, false);
    }
    /* a copy's light pool on the ground. A city building's is an uplight (fx.uplight: r 0.5, 0.25 at
       golden hour → 0.4 at Showtime, following the frame's show); everything else (lit lamps) keeps
       the ground decal. rec.decalVia remembers the channel so a pool is always taken off where it is */
    function decalFor(rec, onOff, token, force) {
      if (rec.dead) return;
      var want = onOff ? (token || 'Lamp Warm') : null;
      if (!force && want === rec.decalOn) return;
      rec.decalOn = want;
      var via = want ? (uplightOf(rec) ? 'up' : 'decal') : null;
      if (rec.decalVia && rec.decalVia !== via) decalOff(rec);
      rec.decalVia = via;
      if (!via) return;
      var p = { x: rec.wx, y: rec.wy + 0.02, z: rec.wz };
      if (via === 'up') xcall('fx', 'uplight', 'u:' + rec.uid, true, p, want);
      else xcall('fx', 'decal', 'u:' + rec.uid, true, p, want);
    }
    function decalOff(rec) {
      if (rec.decalVia === 'up') xcall('fx', 'uplight', 'u:' + rec.uid, false);
      else if (rec.decalVia === 'decal') xcall('fx', 'decal', 'u:' + rec.uid, false);
      rec.decalVia = null;
    }
    function uplightOf(rec) {
      var e = L && L.LOOK ? L.LOOK[rec.id] : null;
      return !!(e && e.kind === 'building' && sys.fx && sys.fx.obj && typeof sys.fx.obj.uplight === 'function');
    }
    /* the LOW tier's selection pool (no hulls there): its own key, so it never takes a lamp's or a
       building's light away */
    function selDecal(rec, on) {
      if (on) xcall('fx', 'decal', 'sel:' + rec.uid, true, { x: rec.wx, y: rec.wy + 0.02, z: rec.wz }, 'Star Gold');
      else xcall('fx', 'decal', 'sel:' + rec.uid, false);
    }
    /* a local bloom at an anchor through fx3d (it rate-limits per key and never blooms under reduced
       motion) → true when it bloomed; false (no fx bloom, reduced motion, too soon) lets the model fall
       back to its own halo */
    function bloomFor(rec, name, size, token) {
      if (rec.dead || reduced || quiet > 0 || !sys.fx || !sys.fx.obj || typeof sys.fx.obj.bloom !== 'function') return false;
      var nm = String(name || 'top');
      anchorOf(rec, nm, _v2);
      return xcall('fx', 'bloom', rec.uid + ':' + nm, { x: _v2.x, y: _v2.y, z: _v2.z }, { size: size, token: token }) === true;
    }

    /* ---------------- controller anims: squish, drop-in, debut, store ---------------- */
    var ANIM_ACT = { squish: 'squish', drop: 'dropIn', debut: 'debut', store: 'store' };
    var ANIM_KEYS = ['squish', 'drop', 'debut', 'store'];
    function startAnim(rec, which, silent) {
      if (!rec || rec.dead || !Mo) return 0;
      var s = rec.anims[which], name = ANIM_ACT[which];
      s.t = 0; s.ci = 0; s.silent = !!silent;
      s.dur = Mo.durOf(name, optR) || 0.0001;
      s.cues = Mo.cues(name, optR);
      rec.animOn |= 1;
      rec.rootDirty = true;
      addLive(rec);
      return s.dur;
    }
    function fireCues(rec, s, which) {
      while (s.cues && s.ci < s.cues.length && s.cues[s.ci].t <= s.t) {
        var c = s.cues[s.ci++];
        if (c.sfx && !s.silent) sfx(c.sfx, c.vol, c.step, rec.wx);
        if (c.emit) {
          if (which === 'drop') { _v2.set(rec.wx, rec.wy + 0.03, rec.wz); fxEmit(c.emit, _v2, c.n, { radius: Math.max(rec.fp[0], rec.fp[1]) * 0.45 }); }
          else emitFor(rec, c.emit, 'top', c.n);
        }
      }
    }
    function stepLive(rec, dt) {
      var busy = false, k;
      /* the model act */
      var e = rec.act;
      if (e) {
        e.t += dt;
        fill(rec, dt);
        var alive = false;
        try { alive = e.act.update(rec.a, e.t) !== false; } catch (err) { modelError(rec, 'act', err); alive = false; }
        if (!alive || e.t > e.dur + 2) finishAct(rec, e, true);
        busy = true;
      }
      /* controller anims */
      var an = rec.anims, any = 0;
      for (var i = 0; i < ANIM_KEYS.length; i++) {
        k = ANIM_KEYS[i];
        var s = an[k];
        if (s.t < 0) continue;
        s.t += dt;
        fireCues(rec, s, k);
        if (s.t >= s.dur) { s.t = -1; animEnded(rec, k); } else any = 1;
        if (rec.dead) return busy;
      }
      rec.animOn = any;
      if (any) busy = true;
      /* compose the root pivot (only when something changed it) */
      if (rec.rootDirty || any) {
        composeRoot(rec);
        rec.rootDirty = false;
      }
      return busy;
    }
    function animEnded(rec, which) {
      rec.rootDirty = true;
      if (which === 'drop' || which === 'debut') { if (env) env.invalidateShadows(); }
      if (which === 'debut' && rec.debutP) { rec.debutP.resolve(true); rec.debutP = null; }
      if (which === 'store') {
        rec.storing = false;
        if (rec.storeP) { rec.storeP.resolve(true); rec.storeP = null; }
        if (rec.removeAfter) { removeRec(rec); if (env) env.invalidateShadows(); }
        else setHidden(rec, true);       /* hidden until the next sync removes (or restores) it */
      }
    }
    function composeRoot(rec) {
      if (rec.dead) return;
      var m = rec.rootModel, an = rec.anims;
      var sy = 1, sxz = 1, dy = 0, yaw = 0, s = 1;
      if (an.squish.t >= 0) { Mo.sample('squish', an.squish.t, _sq, optR); sy *= _sq.sy; sxz *= _sq.sxz; }
      if (an.drop.t >= 0) { Mo.sample('dropIn', an.drop.t, _dr, optR); dy += _dr.dy; sy *= _dr.sy; sxz *= _dr.sxz; }
      if (an.debut.t >= 0) { Mo.sample('debut', an.debut.t, _db, optR); yaw += _db.deg; s *= _db.s; }
      if (an.store.t >= 0) { Mo.sample('store', an.store.t, _st, optR); s *= Math.max(0.0001, _st.s); }
      var ident = m.rx === 0 && m.ry === 0 && m.rz === 0 && m.px === 0 && m.py === 0 && m.pz === 0 && m.sx === 1 && m.sy === 1 && m.sz === 1;
      var any = !ident || sy !== 1 || sxz !== 1 || dy !== 0 || yaw !== 0 || s !== 1;
      if (!any && !rec.rootOn) return;
      var mat = rec.batch.pivot(rec.uid, 'root');
      if (!any) { mat.identity(); rec.rootOn = false; return; }
      _e.set(m.rx * DEG, (m.ry + yaw) * DEG, m.rz * DEG, 'XYZ');
      _q.setFromEuler(_e);
      _p.set(m.px, m.py + dy, m.pz);
      _s.set(m.sx * sxz * s, m.sy * sy * s, m.sz * sxz * s);
      mat.compose(_p, _q, _s);
      rec.rootOn = true;
    }

    /* ---------------- model acts: one live act per uid ---------------- */
    function runAct(rec, name) {
      cancelAct(rec, false);
      var model = rec.model, act = null;
      fill(rec, 0);
      if (model && typeof model.act === 'function') {
        try { act = model.act(rec.a, name); } catch (e) { modelError(rec, 'act', e); act = null; }
      }
      if (!act || typeof act.update !== 'function') return resolved(false);
      var d = deferred(), dur = isFinite(act.dur) && act.dur > 0 ? act.dur : 3;
      var entry = { act: act, name: name, t: 0, dur: dur, d: d, timer: 0 };
      rec.act = entry;
      armActTimer(rec, entry);
      addLive(rec);
      wake();
      return d.promise;
    }
    /* a guard for acts whose frames never come: while the island is paused (a sheet, a game,
       a hidden tab) the act simply waits; otherwise it is jumped to its end pose, quietly */
    function armActTimer(rec, entry) {
      entry.timer = later(function () {
        if (rec.act !== entry) return;
        if (covered || suspended || revoked || lost) { armActTimer(rec, entry); return; }
        quiet++;
        try { fill(rec, 0); entry.act.update(rec.a, entry.dur + 1e-3); } catch (e) { modelError(rec, 'act', e); }
        quiet--;
        finishAct(rec, entry, true);
      }, (entry.dur + 0.6) * 1000);
    }
    function finishAct(rec, entry, ok) {
      if (rec.act !== entry) return;
      rec.act = null;
      cancelLater(entry.timer);
      entry.d.resolve(ok !== false);
    }
    function cancelAct(rec, ok) {
      var e = rec.act;
      if (!e) return;
      rec.act = null;
      cancelLater(e.timer);
      try { if (typeof e.act.cancel === 'function') e.act.cancel(rec.a); } catch (err) { issue(rec.id + '.cancel threw: ' + errText(err)); }
      e.d.resolve(!!ok);
    }

    /* ---------------- lamps ---------------- */
    function snapLit(rec) {
      var m = rec.model;
      fill(rec, 0);
      if (m && typeof m.lit === 'function') { try { m.lit(rec.a, !!litMem[rec.uid]); } catch (e) { modelError(rec, 'lit', e); } }
      rec.idlePending = true;
      addLive(rec);
      wake();
    }
    function setLitInternal(uid, onOff, animate) {
      onOff = onOff ? 1 : 0;
      if ((litMem[uid] ? 1 : 0) === onOff) return resolved(true);
      if (onOff) litMem[uid] = 1; else delete litMem[uid];
      var rec = recs.get(uid);
      if (!rec) return resolved(true);
      rec.a.lit = onOff;
      if (animate && readyFired && rec.model && typeof rec.model.act === 'function') return runAct(rec, onOff ? 'glowOn' : 'glowOff');
      snapLit(rec);
      return resolved(true);
    }

    /* ================================================================
       SYNC(view)
       ================================================================ */
    function syncView(view) {
      if (v3) return syncView3(view);
      view = view || {};
      lastView = view;
      var anim = view.anim || {};
      var newMode = normMode(view.mode);
      /* land (a region whose unlock is about to rise is held back until unlockLand runs) */
      var unlocked = Array.isArray(view.unlocked) && view.unlocked.length ? view.unlocked.slice() : ['home'];
      if (anim.unlock && unlocked.indexOf(anim.unlock) >= 0 && !risen[anim.unlock] && envUnlocked.indexOf(anim.unlock) < 0 && !firstSync) {
        if (!pendingRise || pendingRise.region !== anim.unlock) pendingRise = { region: anim.unlock, at: clockT };
      }
      if (pendingRise && unlocked.indexOf(pendingRise.region) < 0) pendingRise = null;
      var envLand = unlocked.filter(function (r) { return !(pendingRise && r === pendingRise.region); });
      /* the placed list: known, placeable ids only */
      var style = view.style || {};
      var list = [];
      (Array.isArray(view.placed) ? view.placed : []).forEach(function (p) {
        if (!p || p.uid == null) return;
        var it = C.item(p.id);
        if (!it || (typeof C.isPlaceable === 'function' && !C.isPlaceable(it))) return;
        list.push(p);
      });
      placedList = list;
      var next = nextCopies(list, style), nextBy = {};
      next.forEach(function (n) { if (!nextBy[n.uid]) nextBy[n.uid] = n; });
      var world = view.world && Array.isArray(view.world.placed) ? view.world : { placed: list };
      /* environment: re-bakes only when the land or layout really changed */
      var sigL = envLand.slice().sort().join(',');
      if (env) env.setLand(envLand, world);
      if (sigL !== landSig) {
        var firstLand = !landSig;
        landSig = sigL;
        envUnlocked = envLand;
        landKeys = Gr.landFrom(envLand);
        if (rig) rig.setLand(landKeys, { instant: firstLand || reduced });
      }
      /* items */
      var d = diffPlaced(recs, next), pathChanged = false;
      d.remove.forEach(function (uid) {
        var rec = recs.get(uid);
        if (!rec) return;
        if (rec.id && rec.it && rec.it.kind === 'path') pathChanged = true;
        if (rec.storing) { rec.removeAfter = true; return; }
        removeRec(rec);
      });
      d.restyle.forEach(function (n) { var rec = recs.get(n.uid); if (rec) restyleRec(rec, n); });
      d.move.forEach(function (n) {
        var rec = recs.get(n.uid);
        if (!rec) return;
        if (rec.it && rec.it.kind === 'path') pathChanged = true;
        moveRec(rec, n);
      });
      d.add.forEach(function (n) {
        var rec = addRec(n);
        if (rec.it && rec.it.kind === 'path') pathChanged = true;
      });
      /* a stored copy that came back (undo); a copy whose neighbours re-jittered it or whose path
         piece turned */
      var varied = false;
      d.same.forEach(function (uid) {
        var rec = recs.get(uid);
        if (!rec) return;
        if (rec.hidden && !(placing && placing.uid === uid)) { rec.removeAfter = false; setHidden(rec, false); }
        var pl = nextBy[uid] ? varyPlace(rec, nextBy[uid]) : undefined;
        if (pl) { rec.batch.move(uid, rec.x, rec.y, pl); placeRec(rec); refreshAttachments(rec); varied = true; }
      });
      if (varied && env) env.invalidateShadows();
      if (pathChanged || firstSync) updatePaths();
      /* the drop-in (placement / move confirmed), once per placement */
      if (anim.dropUid != null) {
        var dr = recs.get(anim.dropUid);
        var dk = dr ? dr.uid + '@' + dr.x + ',' + dr.y : '';
        if (dr && dk !== lastDrop) { lastDrop = dk; setHidden(dr, false); startAnim(dr, 'drop'); }
      }
      syncTail(view, newMode);
    }
    /* the end of every sync (v2 and v3): lamps, mode, selection, placement, actors, the keyboard list */
    function syncTail(view, newMode) {
      /* lamps (the view's lit map is the truth) */
      var vlit = view.lit || {};
      var ch = litChanges(litMem, vlit, recList.map(function (r) { return r.uid; }));
      ch.forEach(function (c) { setLitInternal(c.uid, c.on, !firstSync); });
      if (v3) Object.keys(vlit).forEach(function (uid) { if (vlit[uid] && !recs.has(uid)) litMem[uid] = 1; });   /* a baked island's lamps light when it is built */
      Object.keys(litMem).forEach(function (uid) { if (!recs.has(uid) && !(v3 && vlit[uid])) delete litMem[uid]; });
      /* mode, selection, placement */
      setMode(newMode);
      setSelected(view.selectedUid != null && recs.has(view.selectedUid) ? view.selectedUid : null);
      placementState(view.placing || null);
      updateConeMounts();                   /* a stage being moved hands the cones back to the buoys */
      /* actors */
      syncActors(view);
      /* the keyboard list */
      buildSrList(view);
      /* reduced motion: idle once after each sync */
      for (var i = 0; i < recList.length; i++) recList[i].idlePending = true;
      commitMerged();                       /* new merged groups exist before any compile sees the scene */
      if (v3) commitMerged3();
      if (newTemplates && readyFired && lease) { newTemplates = false; lease.compile(scene, camera); }
      firstSync = false;
      anchorsDirty = true;
      maybeReady();
      wake();
    }
    /* the copies the view asks for → [{uid, id, x, y, st, sk, jit, jsig, yaw}]: the house with the
       child's trim, each city building with its own (by uid), organic and small decor with their
       placement jitter (jsig = the same-id neighbours it depends on), auto-tiled paths with their
       piece and yaw when the path model builds pieces */
    function nextCopies(list, style) {
      var nbs = L ? idNeighbours(list, fpOf, isOrganic) : {};
      var pieced = !!(L && typeof L.pathPiece === 'function') && list.some(function (p) { return piecedPath(p.id); });
      var pieces = pieced ? pathPieces(list, isPath, L.pathPiece) : {};
      var MG = root.SLModelsGarden, layouts = PATH_LAYOUTS[tier] || 1;
      return list.map(function (p) {
        var st = resolveStyle(p.id, copyStyle(L, p.id, p.uid, style, user.seed));
        var n = { uid: p.uid, id: p.id, x: p.x | 0, y: p.y | 0, st: st, sk: K.stateKey(p.id, st), jit: null, jsig: '', yaw: undefined };
        var pc = pieces[p.uid];
        /* the auto-tiled piece, its layout and its yaw: the path cells join up */
        if (pc && piecedPath(p.id)) { var pk = pathCopy(pc, p.uid, MG, layouts); n.st = pk.st; n.sk = pk.sk; n.yaw = pk.yaw; }
        var nb = nbs[p.uid];
        n.jit = jitterFor(L, p.uid, p.id, nb);
        if (n.jit && nb && nb.length) n.jsig = nb.join(',');
        return n;
      });
    }
    function fpOf(id) { var it = C.item(id); return (it && it.fp) || [1, 1]; }
    function isOrganic(id) { var e = L && L.LOOK && L.LOOK[id]; return !!(e && L.ORGANIC_KINDS && L.ORGANIC_KINDS[e.kind]); }
    function isPath(id) { var it = C.item(id); return !!(it && it.kind === 'path'); }
    /* a path model opts into auto-tiling with `pieces: true` (it builds ctx.stateKey 'p:<piece>') */
    function piecedPath(id) { var m = SL3D.models && SL3D.models[id]; return isPath(id) && !!(m && m.pieces); }
    /* the Showtime cones ride the Concert Stage's truss ('cone0..2') while it is placed (a v2 env) */
    function updateConeMounts() {
      if (v3 || !env || typeof env.setConeMounts !== 'function') return;
      var st = null, pts = null, sig = '';
      for (var i = 0; i < recList.length && !st; i++) { var r = recList[i]; if (r.id === 'bld_stage' && !r.hidden && !r.storing && !r.dead) st = r; }
      if (st && st.tpl && st.tpl.anchors) {
        pts = [];
        for (var k = 0; k < 3; k++) {
          var nm = 'cone' + k;
          if (!st.tpl.anchors[nm]) continue;
          anchorOf(st, nm, _v2);
          pts.push({ x: _v2.x, y: _v2.y, z: _v2.z });
          sig += nm + ':' + _v2.x.toFixed(3) + ',' + _v2.y.toFixed(3) + ',' + _v2.z.toFixed(3) + ';';
        }
        if (!pts.length) pts = null;
      }
      if (sig === coneSig) return;
      coneSig = sig;
      try { env.setConeMounts(pts); } catch (e) { issue('env.setConeMounts: ' + errText(e)); }
    }
    function updatePaths() {
      var nets = [];
      try { nets = Gr.pathNetworks ? Gr.pathNetworks(placedList) : []; } catch (e) { nets = []; }
      var dmap = {};
      nets.forEach(function (net) { net.cells.forEach(function (c) { dmap[c.uid] = c.d; }); });
      recList.forEach(function (r) { if (r.it && r.it.kind === 'path') { r.pathD = dmap[r.uid]; r.a.pathD = r.pathD; } });
    }
    function syncActors(view) {
      xcall('actors', 'sync', actorState(view, { user: user, placed: placedList, unlocked: envUnlocked, land: landKeys, mode: mode, reduced: reduced, isles: v3 ? V3.isles : null }));
    }
    function setMode(m) {
      if (m === mode && !firstSync) return;
      mode = m;
      /* an edit-mode drag turns into place mode mid-gesture: keep the gesture and the zoom */
      if (rig) rig.setMode(m, { keepZoom: !!drag });
      envEdit(m !== 'play');                 /* editing eases the light to k 0, the brightest */
      xcall('actors', 'setMode', m);
      syncCamButtons();
      applyTouchAction();
      if (m !== 'play') { hideBubble(); endFeed(true, false, true); }      /* editing ends a feeding moment at its end state */
    }
    function setSelected(uid) {
      if (uid === selectedUid) return;
      var prev = selectedUid && recs.get(selectedUid);
      if (prev) prev.batch.setHighlight(prev.uid, focusKey === 'u:' + prev.uid ? 1 : 0);
      if (prev && tier === 'LOW') selDecal(prev, false);
      selectedUid = uid;
      var rec = uid && recs.get(uid);
      if (rec) {
        rec.batch.setHighlight(uid, 2);
        if (tier === 'LOW' && !v3) selDecal(rec, true);             /* LOW has no hulls: a gold light pool instead */
      } else K.setSelPulse(0);
      if (v3) xcall('edit', 'select', rec ? uid : null);             /* v3: the gold voxel cage (D9) */
    }

    /* ---------------- placement visuals ---------------- */
    function placementState(state) {
      var prevUid = placing && placing.uid;
      placing = state && state.id ? state : null;
      if (prevUid && (!placing || placing.uid !== prevUid)) {
        var pr = recs.get(prevUid);
        if (pr && !pr.storing) setHidden(pr, false);
      }
      applyEdit();
      /* the copy being moved hides behind its ghost — never when no ghost is shown (it would vanish) */
      if (placing && placing.uid != null) { var r = recs.get(placing.uid); if (r && !r.storing) setHidden(r, mode === 'place' && !!xcall('edit', 'ghostShown')); }
      if (placing && rig && rig.phone() && !drag) {         /* keep the ghost in the central 60% */
        var pv = null;
        try { pv = v3 ? Gr.V3.frame(visitNow()).pivot(placing.id, placing.x | 0, placing.y | 0) : Gr.pivot(placing.id, placing.x | 0, placing.y | 0); } catch (e) { pv = null; }
        if (pv) rig.keepInView(pv, 0.6);
      }
    }
    function applyEdit() {
      var ghost = null;
      if (placing && v3) ghost = ghost3(placing);
      else if (placing) {
        /* the ghost wears the copy's own look (a moved building keeps its trim, a new one the trim its
           uid-to-be gives it, the home its shape) */
        var tf = templateFor(placing.id, copyStyle(L, placing.id, ghostUid(placing, lastView && lastView.world), lastView ? lastView.style : {}, user.seed));
        ghost = { id: placing.id, st: tf.st, stateKey: tf.stateKey, template: tf.tpl, material: tf.material };
      }
      if (v3) {
        var isle = visitNow();
        xcall('edit', 'setState', editState(mode, landFor(isle), envUnlocked, placing, ghost, selectedUid, DEBUG.grid, { isle: isle, world: lastView && lastView.world }));
        return;
      }
      xcall('edit', 'setState', editState(mode, landKeys, envUnlocked, placing, ghost, selectedUid, DEBUG.grid));
    }

    /* ================================================================
       V3: THE ISLANDS (W4.2a) — one display per island: a merger of records, a static LOD1 bake or
       nothing (isles-gl's preview / stand-in), reconciled against SLIslesView's items and policy
       ================================================================ */
    function isleOf(k) {
      return I3[k] || (I3[k] = { isle: k, merger: null, group: null, bakes: [], mode: null, want: null, hidden: false, told: false, dirty: false, sig: '' });
    }
    function isleGroup(S) {
      if (!S.group) { S.group = new T.Group(); S.group.name = 'isle:' + S.isle; itemsRoot.add(S.group); }
      return S.group;
    }
    function isleMerger(S) {
      if (!S.merger && typeof K.merger === 'function') {
        try { S.merger = K.merger({ name: 'isle:' + S.isle }); isleGroup(S).add(S.merger.group); } catch (e) { issue('merger ' + S.isle + ': ' + errText(e)); S.merger = null; }
      }
      return S.merger;
    }
    function entriesOf(k) { return V3.items && Array.isArray(V3.items[k]) ? V3.items[k] : []; }
    function travelState() {
      if (V3.travel) { try { return V3.travel.state(); } catch (e) { issue('travel.state: ' + errText(e)); } }
      return { visit: V3.visit, skyMap: false, map: false, tour: false, pending: [], live: V3.live, trip: null };
    }
    function visitNow() { return V3.travel ? V3.travel.visit : V3.visit; }
    /* the land the edit grid / taps use: Home's risen regions, a land's own cells */
    function landFor(isle) {
      if (isle === 'home') return landKeys || Gr.landFrom(envUnlocked);
      var w = lastView && lastView.world;
      try { return w && typeof C.landSetOf === 'function' ? C.landSetOf(w, isle) : null; } catch (e) { return null; }
    }
    /* an isles-view entry → the record's shape (n) on a template namespace */
    function nOf(e, ns) {
      return { uid: e.uid, id: e.id, x: e.x, y: e.y, st: e.st, sk: e.stateKey, jit: e.jitter || null, jsig: e.jkey || '', yaw: e.place ? e.place.yaw || 0 : 0,
        isle: e.isle, ns: ns, place: e.place };
    }
    var LODO = { core: null, now: 0, acting: null, table: null };
    function acting(uid) { var r = recs.get(uid); return !!(r && r.act); }
    /* the namespace a copy on a merger island wants: the visited island's itemLod (D106) with the
       promoted and acting copies at LOD0; a rest merger draws LOD0 */
    function wantNs(e, S) {
      var p = V3.pol && V3.pol[S.isle], lod = p ? p.itemLod : 0;
      if (!lod) return 'vox';
      LODO.core = C; LODO.now = clockT; LODO.acting = acting; LODO.table = V3.promo;
      var r = 0;
      try { r = IV.lodFor(e, lod, LODO); } catch (err) { r = 0; }
      return nsOf(r);
    }
    /* the visited island's merger, reconciled with its entries (idempotent). A template that is not
       built yet keeps the copy as it is (a new copy shows its LOD1, or on a merger already up its LOD0
       is built now for a handful of placements) and the rest is queued (sliced) */
    function commitMerger(S) {
      var list = entriesOf(S.isle), seen = {}, need = 0, warm = S.mode === 'merger', budget = warm ? 4 : 0;
      if (S.mode === 'bake') dropBake(S);
      S.mode = 'merger';
      for (var i = 0; i < list.length; i++) {
        var e = list[i], ns = wantNs(e, S), rec = recs.get(e.uid);
        seen[e.uid] = 1;
        if (ns === 'vox' && !tplReady(e.id, e.stateKey, ns)) {
          if (rec && rec.isle === S.isle && rec.sk === e.stateKey && rec.id === e.id) {
            need++;                                                   /* it keeps its LOD1 until its LOD0 is in */
            if (moved(rec, e)) moveRec(rec, nOf(e, rec.ns));
            continue;
          }
          if (warm && budget > 0) budget--;                           /* a placement on a built island: its LOD0 now */
          else { need++; ns = 'vox-lod1'; }                           /* a cold island: LOD1 first (D70) */
        }
        var n = nOf(e, ns);
        if (rec && rec.isle !== S.isle) { removeRec(rec); rec = null; }
        if (!rec) addRec(n);
        else if (rec.ns !== ns || rec.sk !== e.stateKey || rec.id !== e.id) restyleRec(rec, n);
        else if (moved(rec, e)) moveRec(rec, n);
        else if (rec.hidden && !rec.storing && !(placing && placing.uid === rec.uid)) { rec.removeAfter = false; setHidden(rec, false); }   /* a stored copy came back (undo) */
      }
      recList.slice().forEach(function (r) {
        if (r.isle !== S.isle || seen[r.uid]) return;
        if (r.storing) r.removeAfter = true; else removeRec(r);
      });
      if (need) queue(S, 'merger');
      told(S);
    }
    function moved(rec, e) {
      var a = rec.place && rec.place.pos, b = e.place && e.place.pos;
      return rec.x !== e.x || rec.y !== e.y || !a || !b || a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] ||
        (rec.place.yaw || 0) !== (e.place.yaw || 0) || (rec.jsig || '') !== (e.jkey || '');
    }
    /* every copy of an island as ONE static mesh of its LOD1 templates at rest (D42: LOW, the Sky map,
       the ladder's 'isles' step, a rest island over trisRest) */
    var _bm = null, _bq = null, _be = null, _bp = null, _bs = null;
    function placeMatrix(e) {
      if (!_bm) { _bq = new T.Quaternion(); _be = new T.Euler(); _bp = new T.Vector3(); _bs = new T.Vector3(); }
      var j = e.jitter, pos = e.place.pos, m = new T.Matrix4();
      _be.set(0, ((e.place.yaw || 0) + (j ? j.yaw || 0 : 0)) * DEG, 0, 'XYZ');
      _bq.setFromEuler(_be);
      m.compose(_bp.set(pos[0], pos[1], pos[2]), _bq, _bs.set(j ? j.sx : 1, j ? j.sy : 1, j ? j.sz : 1));
      return m;
    }
    /* … in bands of BAKE_ROWS island rows, one mesh each: three culls per mesh, so the Home view (which
       sees only the front rows of the lands behind Home, sky-world) draws no rows above the frame */
    function commitBake(S) {
      var list = entriesOf(S.isle), bands = {}, Kit = root.SLKit;
      for (var i = 0; i < list.length; i++) {
        var e = list[i], j = e.jitter, tpl = tplGet(e.id, e.stateKey, e.st, 'vox-lod1'), b = Math.floor(e.y / BAKE_ROWS);
        var col = j && j.tint && Kit && typeof Kit.tintMul === 'function' ? Kit.tintMul(j.tint.l, j.tint.h, [1, 1, 1]) : null;
        if (tpl && tpl.parts && tpl.parts.length) (bands[b] || (bands[b] = [])).push({ tpl: tpl, matrix: placeMatrix(e), color: col });
      }
      clearRecs(S);
      dropBake(S);
      Object.keys(bands).forEach(function (b) {
        var m = K.vox.bakeStatic(bands[b], { name: 'isle-bake:' + S.isle + ':' + b });
        S.bakes.push(m); isleGroup(S).add(m);
      });
      S.mode = 'bake'; S.dirty = false;
      told(S);
    }
    function dropBake(S) {
      S.bakes.forEach(function (m) {
        if (m.parent) m.parent.remove(m);
        try { m.geometry.dispose(); if (typeof m.dispose === 'function') m.dispose(); } catch (e) { /* gone */ }
      });
      S.bakes.length = 0;
    }
    function clearRecs(S) { recList.slice().forEach(function (r) { if (r.isle === S.isle) removeRec(r); }); }
    function clearIsle(S) {
      clearRecs(S); dropBake(S);
      S.mode = null; S.told = false;
      for (var i = V3.jobs.length - 1; i >= 0; i--) if (V3.jobs[i].isle === S.isle) V3.jobs.splice(i, 1);
    }
    /* isles-gl drops a land's stand-in once our own bake or merger of it is in (D70) */
    function told(S) {
      if (S.told) return;
      S.told = true;
      var gl = env && env.isles;
      if (gl && typeof gl.ready === 'function') { try { gl.ready(S.isle); } catch (e) { issue('isles.ready: ' + errText(e)); } }
    }
    /* what an island should draw now: SLIslesView's policy for it */
    function reconcile(S) {
      var p = V3.pol ? V3.pol[S.isle] : null, want = p ? p.want : 'preview';
      S.want = want === 'merger' || want === 'bake' ? want : null;
      S.hidden = !!(p && p.mode === 'hidden');
      if (S.group) S.group.visible = !S.hidden;
      if (!S.want) { if (S.mode || S.group) clearIsle(S); return; }
      var here = S.isle === visitNow();
      if (S.want === 'merger') {
        /* the visited island builds now (LOD1 where LOD0 is not in yet); any other island waits for
           its templates in the slices, behind its bake or isles-gl's stand-in */
        if (S.mode === 'merger' || here) commitMerger(S); else queue(S, 'merger');
        return;
      }
      /* a bake: the visited one at once on a cold mount (D70: the first frame has Home's LOD1), then
         its LOD0 templates are fetched in the slices so it goes live on arrival */
      if (here && S.mode === null) commitBake(S);
      else if (S.mode !== 'bake' || S.dirty) queue(S, 'bake');
      if (here) queue(S, 'prefetch');
    }
    /* the job queue: one template build (or one bake / merger switch) per unit, ≤ SLICE_MS of real
       time per frame, the visited island first (D70) */
    function queue(S, kind) {
      for (var i = 0; i < V3.jobs.length; i++) {
        var J = V3.jobs[i];
        if (J.isle !== S.isle || (J.kind === 'prefetch') !== (kind === 'prefetch')) continue;
        if (J.kind !== kind) { J.kind = kind; J.need = null; }
        return;
      }
      V3.jobs.push({ isle: S.isle, kind: kind, need: null, i: 0 });
      wake();
    }
    /* the namespace a copy of the visited island will want once it is live (the prefetch) */
    function liveNs(e) {
      var p = V3.livePol, lod = p ? p.itemLod : 0;
      if (!lod) return 'vox';
      LODO.core = C; LODO.now = clockT; LODO.acting = acting; LODO.table = V3.promo;
      try { return nsOf(IV.lodFor(e, lod, LODO)); } catch (err) { return 'vox'; }
    }
    function needOf(S, kind) {
      var out = [], seen = {}, list = entriesOf(S.isle);
      if (kind === 'prefetch') { try { V3.livePol = policyFor({ visit: S.isle, pending: [] })[S.isle]; } catch (e) { V3.livePol = null; } }
      for (var i = 0; i < list.length; i++) {
        var e = list[i], ns = kind === 'bake' ? 'vox-lod1' : kind === 'prefetch' ? liveNs(e) : wantNs(e, S), k = ns + ':' + e.id + '#' + e.stateKey;
        if (seen[k] || tplReady(e.id, e.stateKey, ns)) continue;
        seen[k] = 1;
        out.push({ id: e.id, sk: e.stateKey, st: e.st, ns: ns });
      }
      return out;
    }
    /* R2 (QA2D-3): a template build is one unit that can run for hundreds of ms on a slow device (kit.buildTemplate →
       the vox mesher), and a tap that lands behind it waits the whole unit. So no unit STARTS while the child's input is
       waiting (navigator.scheduling.isInputPending, where there is one) or within JOB_QUIET_MS of their last press:
       the tap is answered first, and the queue goes on in the next quiet frame. The visited island's first display (its
       bake on a cold mount) is not a job and is not held */
    var JOB_QUIET_MS = 700, lastPressAt = -1e9;
    function onPress() { lastPressAt = perfNow(); }
    try { if (root.document && root.document.addEventListener) { root.document.addEventListener('pointerdown', onPress, true); root.document.addEventListener('keydown', onPress, true); } } catch (e) {}
    function inputSoon() {
      if (perfNow() - lastPressAt < JOB_QUIET_MS) return true;
      try { var sc = root.navigator && root.navigator.scheduling; return !!(sc && typeof sc.isInputPending === 'function' && sc.isInputPending()); } catch (e) { return false; }
    }
    function runJobs() {
      var t0 = perfNow(), units = 0, max = 0, what = '', v = visitNow();
      if (inputSoon()) { wake(); return; }                /* next frame: the child's tap goes first (R2) */
      /* the visited island's display first, then every other island, the live island's prefetch last */
      var rank = function (J) { return J.kind === 'prefetch' ? 2 : J.isle === v ? 0 : 1; };
      if (V3.jobs.length > 1) V3.jobs.sort(function (a, b) { return rank(a) - rank(b); });
      while (V3.jobs.length) {
        if (units && inputSoon()) break;                  /* never another unit while input waits */
        var J = V3.jobs[0], S = isleOf(J.isle), u0 = perfNow(), w = J.isle + ':' + J.kind;
        if (J.kind !== 'prefetch' && S.want !== J.kind) { V3.jobs.shift(); continue; }
        if (!J.need) { J.need = needOf(S, J.kind); J.i = 0; }
        if (J.i < J.need.length) {
          var q = J.need[J.i++];
          w = q.ns + ':' + q.id;
          try { tplGet(q.id, q.sk, q.st, q.ns); } catch (e) { issue(q.id + ' template: ' + errText(e)); }
        } else {
          V3.jobs.shift();
          try { if (J.kind === 'bake') commitBake(S); else if (J.kind === 'merger') commitMerger(S); } catch (e2) { issue(J.kind + ' ' + J.isle + ': ' + errText(e2)); }
          estimate();
          if (J.kind !== 'prefetch') newTemplates = true;
        }
        var d = perfNow() - u0;
        units++; if (d > max) { max = d; what = w; }
        if (perfNow() - t0 + max > SLICE_MS) break;
      }
      V3.slice.ms = perfNow() - t0; V3.slice.units = units; V3.slice.max = max; V3.slice.what = what;
      if (max > V3.slice.worst) { V3.slice.worst = max; V3.slice.worstWhat = what; }
      if (!V3.jobs.length) {
        commitMerged3();
        if (newTemplates && readyFired && lease) { newTemplates = false; lease.compile(scene, camera); }
        if (!readyFired) maybeReady();
      }
    }
    function commitMerged3() {
      for (var k in I3) if (I3[k].merger) { try { I3[k].merger.commit(); } catch (e) { issue('merger commit: ' + errText(e)); } }
    }
    /* the visited island's estimate (D106): real template triangles where they are known */
    function trisOf(id, sk, lod) { var v = V3.tris[nsOf(lod) + ':' + id + '#' + sk]; return typeof v === 'number' ? v : null; }
    function estimate() {
      try { V3.est = IV.trisEstimate(V3.items || {}, tier, { core: C, look: L, tris: trisOf }); } catch (e) { V3.est = null; issue('trisEstimate: ' + errText(e)); }
    }
    /* the policy wrapper (also travel's: state() passes the visit, the map / tour and the pending land) */
    function policyFor(st) {
      st = st || travelState();
      /* the cold mount before the Sky tour: the tour's policy already (LOD1 bakes everywhere, D70) */
      if (V3.introPending && !st.trip) st = { visit: st.visit, skyMap: true, tour: true, pending: st.pending };
      var pend = Array.isArray(st.pending) ? st.pending.slice() : [];
      if (V3.hold && pend.indexOf(V3.hold) < 0) pend.push(V3.hold);
      if (camera) { camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); }
      return IV.policy({
        tier: tier, quality: SL3D.quality, visit: st.visit, skyMap: !!st.skyMap, tour: !!st.tour, unlocked: V3.unl, pending: pend,
        cameraPos: camera ? camera.position : null, viewProj: camera ? Array.prototype.slice.call(_pm.elements) : null,
        tris: V3.est || undefined, tris0: V3.est || undefined, prev: V3.pol || undefined, budgets: restBudget(st.visit)
      });
    }
    /* D89's rest budget, also held to the frame's own row (trisHome on Home, else trisWorst): what is left
       once the frame's fixed costs, the crew at its rig cap and every other island as a bake are paid */
    /* the crew rigs a frame can show: the crew (view.pets) up to BUDGETS.crewRigs (D97) */
    function crewOut(row) { var n = lastView && Array.isArray(lastView.pets) ? lastView.pets.length : Infinity; return Math.max(1, Math.min(row.crewRigs || 0, n)); }
    function restBudget(visit) {
      var T = root.SLTier, row = SL3D.budget && SL3D.budget.trisRest != null ? SL3D.budget : T && T.BUDGETS ? T.BUDGETS[tier] : null, est = V3.est;
      if (!row || !(row.trisRest > 0) || !est) return undefined;
      var bakes = 0, rig = L && L.TRIS_CAPS && L.TRIS_CAPS.petRig3 ? L.TRIS_CAPS.petRig3.dressed : 1400;
      V3.unl.forEach(function (k) { var e = est[k]; if (k !== visit && e) bakes += e.all - e.terrain + COARSE_TRIS; });
      var left = (visit === 'home' ? row.trisHome : row.trisWorst) - (FRAME_FIXED[tier] || 0) - crewOut(row) * rig - bakes;
      var out = {};
      for (var k in row) out[k] = row[k];
      out.trisRest = Math.max(0, Math.min(row.trisRest, left));
      return out;
    }
    function polSig(p) { return ISLES3.map(function (k) { var e = p[k]; return e ? e.mode + e.want + e.terrain + e.itemLod : '-'; }).join('|'); }
    function applyIsles(p) {
      if (!p || dead) return;
      var sig = polSig(p), same = sig === V3.polSig && !V3.itemsDirty;
      V3.pol = p; V3.polSig = sig; V3.itemsDirty = false;
      var gl = env && env.isles;
      ISLES3.forEach(function (k) {
        var e = p[k];
        if (!same && gl && typeof gl.setTerrain === 'function' && e) { try { gl.setTerrain(k, e.mode === 'preview' ? null : e.terrain); } catch (err) { issue('setTerrain: ' + errText(err)); } }
        if (!same) reconcile(isleOf(k));
      });
      commitMerged3();
      anchorsDirty = true;
    }
    function refreshIsles() { V3.itemsDirty = true; estimate(); applyIsles(policyFor()); }
    /* the copies each island draws, from a view (the hold keeps a land just bought a preview) */
    function itemsFrom(view, lists) {
      var vw = { placed: placedList, style: view.style || {}, isles: lists.isles, unlockedIsles: V3.unl }, out;
      try { out = IV.itemsOf(vw, { tier: tier, seed: user.seed, hold: V3.hold ? [V3.hold] : [], core: C, look: L, grid: Gr, models: R.models }); }
      catch (e) { issue('itemsOf: ' + errText(e)); return V3.items || {}; }
      var by = {};
      Object.keys(out).forEach(function (k) { out[k].forEach(function (e) { by[e.uid] = k; }); });
      V3.isleByUid = by;
      return out;
    }
    /* contact AO (D39 / D70): an island's footprints when its layout changed */
    function layoutChanged(isle) {
      var list = entriesOf(isle), S = isleOf(isle), sig = list.map(function (e) { return e.uid + '@' + e.x + ',' + e.y; }).join(';');
      if (sig === S.sig) return;
      S.sig = sig;
      if (S.mode === 'bake') S.dirty = true;
      if (!env || typeof env.setLayout !== 'function') return;
      var fps = list.map(function (e) { var it = C.item(e.id); return { x: e.x, y: e.y, w: e.fp[0], h: e.fp[1], path: !!(it && it.kind === 'path') }; });
      try { env.setLayout(isle, fps); } catch (err) { issue('setLayout: ' + errText(err)); }
    }
    /* v3 sync: Home's regions (as v2), the islands, then the shared tail */
    function syncView3(view) {
      view = view || {};
      lastView = view;
      var anim = view.anim || {}, newMode = normMode(view.mode);
      var unlocked = Array.isArray(view.unlocked) && view.unlocked.length ? view.unlocked.slice() : ['home'];
      if (anim.unlock && unlocked.indexOf(anim.unlock) >= 0 && !risen[anim.unlock] && envUnlocked.indexOf(anim.unlock) < 0 && !firstSync) {
        if (!pendingRise || pendingRise.region !== anim.unlock) pendingRise = { region: anim.unlock, at: clockT };
      }
      if (pendingRise && unlocked.indexOf(pendingRise.region) < 0) pendingRise = null;
      var envLand = unlocked.filter(function (r) { return !(pendingRise && r === pendingRise.region); });
      var list = [];
      (Array.isArray(view.placed) ? view.placed : []).forEach(function (p) {
        if (!p || p.uid == null) return;
        var it = C.item(p.id);
        if (!it || (typeof C.isPlaceable === 'function' && !C.isPlaceable(it))) return;
        list.push(p);
      });
      placedList = list;
      var world = view.world && Array.isArray(view.world.placed) ? view.world : { placed: list };
      /* the islands: a land just bought stays a preview until unlockIsle runs (anim.unlockIsle) */
      var lists = isleLists(view, C);
      V3.unl = lists.unlockedIsles; V3.isles = lists.isles;
      if (anim.unlockIsle && V3.unl.indexOf(anim.unlockIsle) >= 0 && !V3.unlocking[anim.unlockIsle]) { V3.hold = anim.unlockIsle; V3.holdAt = clockT; }
      if (V3.hold && V3.unl.indexOf(V3.hold) < 0) V3.hold = null;
      V3.view = { isle: visitNow(), unlockedIsles: V3.unl, isles: V3.isles, mode: newMode };
      var sigL = envLand.slice().sort().join(',');
      if (env) env.setLand(envLand, world);
      setIslesSky();
      if (sigL !== landSig) {
        var firstLand = !landSig;
        landSig = sigL; envUnlocked = envLand; landKeys = Gr.landFrom(envLand);
        if (rig) rig.setLand(landKeys, { instant: firstLand || reduced });
      }
      V3.items = itemsFrom(view, lists);
      ISLES3.forEach(layoutChanged);
      refreshIsles();
      updatePaths();
      if (anim.dropUid != null) {
        var dr = recs.get(anim.dropUid), dk = dr ? dr.uid + '@' + dr.x + ',' + dr.y : '';
        if (dr && dk !== lastDrop) { lastDrop = dk; setHidden(dr, false); startAnim(dr, 'drop'); }
      }
      syncTail(view, newMode);
    }
    function setIslesSky() {
      if (!env || typeof env.setIsles !== 'function') return;
      var st = travelState(), pend = Array.isArray(st.pending) ? st.pending.slice() : [];
      if (V3.hold && pend.indexOf(V3.hold) < 0) pend.push(V3.hold);
      var sig = V3.unl.join(',') + '|' + pend.join(',');
      if (sig === V3.isleSig) return;
      V3.isleSig = sig;
      env.setIsles(V3.unl, { pending: pend });
    }
    /* the ghost: the copy's own entry (a moved copy keeps its colourway; a new one the look its
       uid-to-be gives it) through the vox registry */
    function ghost3(pl) {
      var isle = pl.isle || visitNow(), e = null, i, list = entriesOf(isle);
      if (pl.uid != null) for (i = 0; i < list.length && !e; i++) if (list[i].uid === pl.uid && list[i].id === pl.id) e = list[i];
      if (!e) {
        var p = { uid: ghostUid(pl, lastView && lastView.world) || 'ghost', id: pl.id, x: pl.x | 0, y: pl.y | 0, vr: pl.vr }, vw = { style: lastView ? lastView.style : {} };
        if (isle === 'home') vw.placed = [p]; else { vw.placed = []; vw.isles = {}; vw.isles[isle] = [p]; vw.unlockedIsles = ['home', isle]; }
        try { var out = IV.itemsOf(vw, { tier: tier, seed: user.seed, core: C, look: L, grid: Gr, models: R.models }); e = out[isle] && out[isle][0]; } catch (err) { e = null; }
      }
      if (!e) return null;
      return { id: pl.id, st: e.st, stateKey: e.stateKey, template: tplGet(e.id, e.stateKey, e.st, 'vox'), material: undefined };
    }
    /* per frame: the hold's deadline, the frustum policy (≤ 4 Hz while the camera moves), the ends of
       promotions, the job slices */
    function frame3() {
      var busy = false;
      if (V3.hold && clockT - V3.holdAt > HOLD_SEC) { V3.hold = null; V3.itemsDirty = true; if (lastView) { V3.items = itemsFrom(lastView, { isles: V3.isles }); } setIslesSky(); refreshIsles(); }
      if (V3.camDirty && clockT - V3.polAt >= 0.25) { V3.camDirty = false; V3.polAt = clockT; applyIsles(policyFor()); }
      for (var k in V3.promo) {
        var ended = IV.sweep({ now: clockT, table: V3.promo }), S = isleOf(visitNow());
        if (ended.length && S.mode === 'merger') commitMerger(S);
        break;
      }
      if (V3.jobs.length) { runJobs(); busy = true; }
      return busy;
    }
    function camMoved() {
      V3.camDirty = true;
      if (env && typeof env.settle === 'function' && rig && rig.pose) env.settle(rig.pose.dist);
    }
    /* ---------------- travel (SLIslesTravel, W4.2b) ---------------- */
    function buildTravel() {
      var TR = root.SLIslesTravel;
      if (!TR || typeof TR.create !== 'function' || !rig || !env) return;
      try {
        V3.travel = TR.create({
          rig: rig, sky: env, view: function () { return V3.view; }, visit: V3.visit,
          actors: { follow: function (o) { return xcall('actors', 'follow', o); }, setIsle: function (k) { return xcall('actors', 'setIsle', k); } },
          policy: policyFor, apply: function (p) { applyIsles(p); setIslesSky(); if (lastView) buildSrList(lastView); wake(); }, setLive: setLive,
          routeTap: function (hit, o) { o = o || {}; o.unlocked = V3.unl; return IV.routeTap(hit, o); },
          reduced: function () { return reduced; }, dipEl: V3.dipEl,
          skyColor: function () { return env && typeof env.skyColor === 'function' ? env.skyColor() : null; },
          on: { arrive: onArrive, leave: function () { wake(); } }, landmark: dropLandmark,
          sound: function (n, v) { sfx(n, v); }, later: function (fn, ms) { return later(fn, ms); }, clear: cancelLater
        });
      } catch (e) { issue('travel: ' + errText(e)); V3.travel = null; }
    }
    function setLive(k) {
      V3.live = k || null;
      for (var i = 0; i < recList.length; i++) recList[i].idlePending = true;
      wake();
    }
    function onArrive(k) {
      V3.visit = k;
      if (V3.view) V3.view.isle = k;
      hideBubble();
      applyEdit();
      if (lastView) buildSrList(lastView);
      V3.anchorSig = '';
      anchorsDirty = true;
      wake();
    }
    /* unlockIsle's last step: the landmark drops onto its spot (its own 'dropIn' cue puffs the dust) */
    function dropLandmark(isle) {
      var d = C.ISLES && C.ISLES[isle], id = d && d.landmark, sec = Mo ? Mo.durOf('dropIn', optR) || 0.55 : 0.55;
      if (!id) return 0;
      for (var i = 0; i < recList.length; i++) {
        var r = recList[i];
        if (r.isle === isle && r.id === id) { setHidden(r, false); startAnim(r, 'drop'); return sec; }
      }
      entriesOf(isle).forEach(function (e) { if (e.id === id) V3.drops[e.uid] = true; });   /* when its copy is built */
      return sec;
    }
    function noTravel() { return resolved(false); }
    function visitIsle(isle, o) { if (!V3.travel) return noTravel(); hideBubble(); var p = V3.travel.visitIsle(isle, o || {}); wake(); return p; }
    function skyMapOn(on) { if (!V3.travel) return noTravel(); hideBubble(); var p = V3.travel.skyMap(!!on); wake(); return p; }
    function unlockIsle(isle) {
      if (!V3.travel) return noTravel();
      V3.unlocking[isle] = true;
      if (V3.hold === isle) { V3.hold = null; if (lastView) V3.items = itemsFrom(lastView, { isles: V3.isles }); V3.itemsDirty = true; }
      hideBubble();
      var p = V3.travel.unlockIsle(isle);
      setIslesSky();
      wake();
      return p;
    }

    /* ================================================================
       PICKING + POINTER
       ================================================================ */
    var PICK = { kind: 'none', uid: null, target: null, region: null, c: -1, r: -1, x: 0, y: 0, z: 0, has: false };
    function rayAt(x, y) {
      if (!camera || !(cssW > 0 && cssH > 0)) return false;
      var nx = x / cssW * 2 - 1, ny = -(y / cssH * 2 - 1);
      camera.updateMatrixWorld();
      _ro.setFromMatrixPosition(camera.matrixWorld);
      _rd.set(nx, ny, 0.5).unproject(camera).sub(_ro).normalize();
      return true;
    }
    /* v3: what a tap hits on the visited island (items, cells, the ghost, the crew), the islands, their
       bridges and gates (isles-gl) and Home's locked regions → SLIslesView.routeTap (through travel,
       which only skips while a trip runs). PICK.kind 'route' carries another island / a region */
    function pick3(x, y) {
      var st = travelState(), visit = st.visit, F = Gr.V3.frame(visit), hit = {}, wide = !!st.skyMap, i;
      if (mode === 'place' && placing) {
        var gb = xcall('edit', 'ghostBox');
        if (!gb) { try { gb = F.hitBox(placing.id, placing.x | 0, placing.y | 0); gb = { min: [gb.min[0], gb.min[1] + 0.25, gb.min[2]], max: [gb.max[0], gb.max[1] + 0.25, gb.max[2]] }; } catch (e) { gb = null; } }
        if (gb) hit.ghost = rayBox(_ro, _rd, gb.min, gb.max);
      }
      if (mode === 'play' && !wide) {
        var ah = xcall('actors', 'pick', _ro, _rd);
        if (ah && ah.target) hit.actor = { t: typeof ah.t === 'number' ? ah.t : 0, target: ah.target };
      }
      if (mode !== 'place' && !wide) {
        var best = Infinity, bu = null;
        for (i = 0; i < recList.length; i++) {
          var r = recList[i];
          if (r.isle !== visit || r.hidden || r.storing || !r.hit) continue;
          var t = rayBox(_ro, _rd, r.hit.min, r.hit.max);
          if (t >= 0 && t < best) { best = t; bu = r.uid; }
        }
        if (bu != null) hit.item = { t: best, uid: bu, isle: visit };
      }
      if (mode === 'play' && !wide) {
        /* QA#2: a tap on a thing's floating tag is that thing, in front of everything; within TAG_PAD px of
           the tag only when the ray hit nothing of this island (a thing or a pet: on a crowded Home a tap
           on a neighbour's body just off this badge is the neighbour); else a tap on nothing of this island
           within NEAR_PX of a thing that plays is that thing (routeTap: after a bridge, before another
           island, so never the island behind it) */
        var tg = tagAt(x, y, visit);
        if (tg && (tg.d === 0 || (!hit.item && !hit.actor))) hit.item = { t: 0, uid: tg.uid, isle: visit };
        else if (!hit.item) { var nu = nearAt(x, y, visit); if (nu != null) hit.near = { uid: nu, isle: visit }; }
      }
      var cell = null, sea = null;
      try { cell = F.rayToCell(_ro, _rd, landFor(visit) || undefined); } catch (e) { cell = null; }
      if (cell) hit.cell = { c: cell.c, r: cell.r, land: !!cell.land };
      var g = env && typeof env.pick === 'function' ? env.pick(_ro, _rd) : null;
      if (g) hit.isle = g;
      if (visit === 'home' && mode !== 'place' && !(cell && cell.land)) {
        sea = Gr.rayPlane(_ro, _rd, F.seaY);
        if (sea && env && typeof env.lockedAt === 'function') hit.region = env.lockedAt(sea.x, sea.z) || null;
      }
      var route = V3.travel ? V3.travel.pick(hit, mode) : IV.routeTap(hit, { mode: mode, visit: visit, skyMap: false, unlocked: V3.unl });
      route = route || { kind: 'none' };
      PICK.route = route;
      var k = route.kind;
      PICK.kind = k === 'pet' || k === 'avatar' ? 'actor' : k === 'item' || k === 'ghost' || k === 'cell' || k === 'none' ? k : 'route';
      PICK.has = k !== 'none';
      if (k === 'item') { PICK.uid = route.uid; PICK.near = !!route.near; }
      else if (k === 'pet' || k === 'avatar') PICK.target = route.target;
      else if (k === 'cell') { PICK.c = route.c; PICK.r = route.r; }
      var gp = cell || sea;
      if (gp) { PICK.x = gp.x; PICK.y = gp.y; PICK.z = gp.z; }
      return PICK;
    }
    /* QA#2: a hit box's screen rect (canvas px), or null when a corner is behind the camera */
    var _bc = null;
    function screenRect(hb) {
      if (!hb || !camera) return null;
      if (!_bc) _bc = new T.Vector3();
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < 8; i++) {
        _bc.set(i & 1 ? hb.max[0] : hb.min[0], i & 2 ? hb.max[1] : hb.min[1], i & 4 ? hb.max[2] : hb.min[2]);
        var s = screenOf(_bc);
        if (!s) return null;
        if (s.x < x0) x0 = s.x;
        if (s.x > x1) x1 = s.x;
        if (s.y < y0) y0 = s.y;
        if (s.y > y1) y1 = s.y;
      }
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }
    /* a tag's size: its rows stack upward from the anchor point, centred on it (.slw-tag3d) */
    function tagSize(wrap) {
      var kids = wrap && wrap.children ? wrap.children : [], w = 0, h = 0, n = 0;
      for (var i = 0; i < kids.length; i++) {
        var kw = kids[i].offsetWidth, kh = kids[i].offsetHeight;
        if (typeof kw !== 'number' || typeof kh !== 'number') kw = kh = TAG_MIN;
        else if (!(kw > 0 && kh > 0)) continue;              /* a row that is not shown */
        if (kw > w) w = kw;
        h += kh; n++;
      }
      return n ? { w: w, h: h + TAG_GAP * (n - 1) } : null;
    }
    /* the visited island's thing whose shown tag is nearest the tap, under it or within TAG_PAD px of it:
       {uid, d} (d = 0 on the tag itself), or null */
    function tagAt(x, y, visit) {
      var best = null, bd = Infinity;
      for (var i = 0; i < anchorList.length; i++) {
        var a = anchorList[i];
        if (!a.vis || a.show === false || String(a.key).indexOf('u:') !== 0) continue;
        var rec = recs.get(a.key.slice(2)), sz = rec && !rec.hidden && !rec.storing && rec.isle === visit ? tagSize(a.wrap) : null;
        if (!sz) continue;
        var d = rectDist(x, y, a.x - sz.w / 2, a.y - sz.h, a.x + sz.w / 2, a.y);
        if (d <= TAG_PAD && d < bd) { bd = d; best = rec.uid; }
      }
      return best == null ? null : { uid: best, d: bd };
    }
    /* the visited island's thing that plays (not a game gate or the house: those open more than a ride)
       whose box is within NEAR_PX (or NEAR_FRAC of its width) of the tap on screen, or null */
    function nearAt(x, y, visit) {
      var best = null, bd = Infinity;
      for (var i = 0; i < recList.length; i++) {
        var r = recList[i], act = r.it && r.it.act;
        if (r.isle !== visit || r.hidden || r.storing || !r.hit || !act || act === 'launch' || act === 'home') continue;
        var b = screenRect(r.hit), d = b ? rectDist(x, y, b.x0, b.y0, b.x1, b.y1) : Infinity;
        if (d <= Math.max(NEAR_PX, NEAR_FRAC * (b ? b.x1 - b.x0 : 0)) && d < bd) { bd = d; best = r.uid; }
      }
      return best;
    }
    /* a tap on another island, its bridge or gate, or a locked Home region (v3) */
    function tapRoute(r) {
      var h = routeHook(r);
      if (!h || mode !== 'play') return;
      sfx('pop', 0.6);
      tell.apply(null, [h.hook].concat(h.args));
    }
    function pick(x, y) {
      PICK.kind = 'none'; PICK.uid = null; PICK.target = null; PICK.region = null; PICK.route = null; PICK.c = PICK.r = -1; PICK.has = false; PICK.near = false;
      if (!rayAt(x, y)) return PICK;
      if (v3) return pick3(x, y);
      var h = { actor: null, item: null, ghost: -1, cell: null, land: null, sea: null };
      if (mode === 'place' && placing) {
        var gb = xcall('edit', 'ghostBox');
        if (!gb) { try { gb = Gr.hitBox(placing.id, placing.x | 0, placing.y | 0); gb = { min: [gb.min[0], gb.min[1] + 0.25, gb.min[2]], max: [gb.max[0], gb.max[1] + 0.25, gb.max[2]] }; } catch (e) { gb = null; } }
        if (gb) h.ghost = rayBox(_ro, _rd, gb.min, gb.max);
      }
      if (mode === 'play') {
        var ah = xcall('actors', 'pick', _ro, _rd);
        if (ah && ah.target) h.actor = { t: typeof ah.t === 'number' ? ah.t : 0, target: ah.target };
      }
      if (mode !== 'place') {
        var best = Infinity, bu = null;
        for (var i = 0; i < recList.length; i++) {
          var r = recList[i];
          if (r.hidden || r.storing || !r.hit) continue;
          var t = rayBox(_ro, _rd, r.hit.min, r.hit.max);
          if (t >= 0 && t < best) { best = t; bu = r.uid; }
        }
        if (bu != null) h.item = { t: best, uid: bu };
      }
      var cell = null;
      try { cell = Gr.rayToCell(_ro, _rd, landKeys || Gr.landFrom(envUnlocked)); } catch (e) { cell = null; }
      if (cell) h.cell = { c: cell.c, r: cell.r, land: !!cell.land };
      var sea = Gr.rayPlane(_ro, _rd, Gr.SEA_Y);
      if (sea) {
        h.sea = sea;
        if (mode !== 'place' && env && typeof env.lockedAt === 'function' && !(cell && cell.land)) h.land = env.lockedAt(sea.x, sea.z);
      }
      var res = choosePick(mode, h);
      PICK.kind = res.kind; PICK.has = res.kind !== 'none';
      if (res.kind === 'item') PICK.uid = res.uid;
      else if (res.kind === 'actor') PICK.target = res.target;
      else if (res.kind === 'land') PICK.region = res.region;
      else if (res.kind === 'cell') { PICK.c = res.c; PICK.r = res.r; }
      var gp = cell ? cell : sea;
      if (gp) { PICK.x = gp.x; PICK.y = gp.y; PICK.z = gp.z; }
      return PICK;
    }
    function landIdOf(region) { var R = C.REGIONS && C.REGIONS[region]; return R && R.unlock ? R.unlock : null; }

    function onPress(x, y) {
      if (dead || failed) return null;
      hideBubble();
      drag = null;
      var p = pick(x, y);
      if (mode === 'edit' && p.kind === 'item') { drag = { kind: 'item', uid: p.uid, cell: null }; return 'item'; }
      if (mode === 'place' && p.kind === 'ghost') { drag = { kind: 'ghost', uid: placing && placing.uid, cell: null }; return 'ghost'; }
      return null;
    }
    function onTap(x, y, count) {
      if (dead || failed) return;
      if (care.feed && mode === 'play') { skipFeed(); return; }      /* a tap skips the feeding moment (P22), nothing else */
      var p = pick(x, y);
      wake();
      if (mode === 'place') {
        if (p.kind === 'ghost' && placing) tellCell('tapCell', placing.x | 0, placing.y | 0);
        else if (p.kind === 'cell') tellCell('tapCell', p.c, p.r);
        return;
      }
      /* a memory star in Home's night sky (the island's crew and items in front of it win) */
      if (p.kind !== 'actor' && p.kind !== 'item') {
        var sh = starHit();
        if (sh) { tapStar(sh); return; }
      }
      switch (p.kind) {
        case 'actor': tapActor(p.target); break;
        case 'item': tapItemUid(p.uid); break;
        case 'route': tapRoute(p.route); break;
        case 'land': { var lid = landIdOf(p.region); if (lid) { sfx('pop', 0.6); tell('tapLand', lid); } break; }
        case 'cell':
          if (count === 2 && mode === 'play' && rig) { rig.focusOn({ x: p.x, z: p.z }, { zoom: Math.min(rig.zoomMax(), rig.goal.zoom * 1.4) }); afterCamera(); }
          if (mode !== 'play') tellCell('tapCell', p.c, p.r);
          break;
        case 'sea':
          if (count === 2 && mode === 'play' && rig) { rig.focusOn({ x: p.x, z: p.z }, { zoom: Math.min(rig.zoomMax(), rig.goal.zoom * 1.4) }); afterCamera(); }
          break;
      }
    }
    /* tapCell / dragCell: v3 adds the island the cell is on (island-local x, y) */
    function tellCell(hook, c, r) { if (v3) tell(hook, c, r, visitNow()); else tell(hook, c, r); }
    function tapItemUid(uid) {
      var rec = recs.get(uid);
      if (!rec || encoreHeld(uid)) return;      /* a stage mid-encore ignores its taps */
      startAnim(rec, 'squish', false);          /* the universal squish + 'pop' */
      if (v3 && mode === 'play') showRide(rec);
      tell('tapItem', uid);
    }
    /* QA#2: a landmark's ride is big and slow (the Big Wheel's quarter turn, the treehouse lift): its name
       pops up over it (kept inside the stage) the moment it is tapped, and one cut off by the stage's edge
       is brought into view at the same zoom (a cut under reduced motion), so the child sees the ride start */
    function showRide(rec) {
      var it = rec.it;
      if (!it || it.kind !== 'landmark' || !it.act || rec.act || !camera) return;
      var b = screenRect(rec.hit);
      if (rig && (!b || b.x0 < 0 || b.y0 < 0 || b.x1 > cssW || b.y1 > cssH)) { rig.focusOn(aimOf(rec), { zoom: rig.goal.zoom }); afterCamera(); }
      showBubble('u:' + rec.uid, nameOf(rec.uid));
    }
    function encoreLive() { return !!(encoreLock && perfNow() < encoreLock.until); }
    function encoreHeld(uid) { return encoreLive() && encoreLock.uid === uid; }
    /* a tap on a pet / the avatar: the actors' own tap reaction (a happy hop + emote; the avatar's
       wave + finger-heart + 'pop'), then the host's hook (its emote of the same target is the same
       moment, so the dedupe in localEmote drops it) */
    function tapActor(target) {
      if (!target) return;
      var me = target === 'me' || target === 'avatar' || target === 'you';
      var key = me ? 'me' : 'pet:' + String(target).replace(/^pet:/, '');
      if (sys.actors && typeof sys.actors.obj.tap === 'function' && xcall('actors', 'tap', key)) markEmote(key);
      else localEmote(key, me ? 'heart' : null);
      if (me) { tell('tapAvatar'); return; }
      /* a hungry pet answered softly (P2.5): its bubble, and the host hears so (its voice at 0.6) */
      var id = key.slice(4);
      if (xcall('actors', 'tapKind', id) === 'hungry') { hungryBubble(id); tell('tapPet', id, { hungry: true }); }
      else tell('tapPet', id);
    }
    /* a still press of 450 ms: the name bubble only — the camera never moves under the finger, and
       the release still counts as a tap (a slow tap) */
    function onLongPress(x, y) {
      if (dead || failed || mode === 'place') return;
      var p = pick(x, y);
      if (p.kind === 'item') showBubble('u:' + p.uid, nameOf(p.uid));
      else if (p.kind === 'actor' && p.target) showBubble(p.target, actorName(p.target));
    }
    /* held still for a full second (a deliberate hold, play mode only — never while an edit-mode
       drag claim is pending): frame the item / pet; this press is no tap */
    function onHold(x, y, claim) {
      if (dead || failed || mode !== 'play' || claim) return;
      var p = pick(x, y);
      if (p.kind === 'item') { frameItem(p.uid); showBubble('u:' + p.uid, nameOf(p.uid)); }
      else if (p.kind === 'actor' && p.target) {
        var a = actorPoint(p.target, _v2);
        if (a && rig) { rig.focusOn({ x: a.x, z: a.z }, { zoom: Math.min(rig.zoomMax(), 1.6) }); afterCamera(); }
        showBubble(p.target, actorName(p.target));
      }
    }
    function nameOf(uid) { var r = recs.get(uid); return r && r.it ? r.it.name : ''; }
    function actorName(target) {
      if (target === 'me') return user.name || 'You';
      var id = String(target).replace(/^pet:/, ''), pets = lastView && Array.isArray(lastView.pets) ? lastView.pets : [];
      for (var i = 0; i < pets.length; i++) if (pets[i] && pets[i].id === id && pets[i].name) return pets[i].name;
      var it = C.item(id);
      return it ? it.name : '';
    }
    function cellUnder(x, y) {
      if (!rayAt(x, y)) return null;
      var cell = null;
      if (v3) {
        var F = Gr.V3.frame(visitNow());
        try { cell = F.rayToCell(_ro, _rd, landFor(F.isle) || undefined); } catch (e) { cell = null; }
        if (cell) return { c: cell.c, r: cell.r };
        var g3 = Gr.rayPlane(_ro, _rd, F.top);
        if (!g3) return null;
        var w3 = F.worldToCell(g3.x, g3.z);
        return { c: clamp(w3.c, 0, F.cols - 1), r: clamp(w3.r, 0, F.rows - 1) };
      }
      try { cell = Gr.rayToCell(_ro, _rd, landKeys || {}); } catch (e) { cell = null; }
      if (cell) return { c: cell.c, r: cell.r };
      var g = Gr.rayPlane(_ro, _rd, 0);
      if (!g) return null;
      var w = Gr.worldToCell(g.x, g.z);
      return { c: clamp(w.c, 0, Gr.COLS - 1), r: clamp(w.r, 0, Gr.ROWS - 1) };
    }
    function onDragStart(x, y, x0, y0) {
      if (!drag) return;
      /* the grabbed point keeps its offset from the item's origin cell, so nothing jumps at
         the start (a tall item is often grabbed by its top, over a cell behind it) */
      var start = cellUnder(x0, y0);
      if (drag.kind === 'item') {
        var rec = recs.get(drag.uid);
        if (!rec) { drag = null; return; }
        grabCell = start ? { c: start.c - rec.x, r: start.r - rec.y } : { c: 0, r: 0 };
        drag.fp = rec.fp; drag.x = rec.x; drag.y = rec.y;
        drag.x0 = rec.x; drag.y0 = rec.y;
        drag.started = true; drag.sent = true;    /* rewards-world already holds the start cell */
        tell('dragStart', drag.uid);
        if (!drag) return;                        /* the host's redraw cancelled the gesture meanwhile */
      } else {
        var fp = (C.item(placing && placing.id) || {}).fp || [1, 1];
        var px = placing ? placing.x | 0 : 0, py = placing ? placing.y | 0 : 0;
        grabCell = start ? { c: start.c - px, r: start.r - py } : { c: 0, r: 0 };
        drag.fp = fp; drag.x = px; drag.y = py;
        drag.x0 = px; drag.y0 = py;
      }
      drag.started = true; drag.sent = true;      /* rewards-world already holds the start cell */
      sfx('pop', 0.5);
      onDrag(x, y);
    }
    function onDrag(x, y) {
      if (!drag) return;
      var cell = cellUnder(x, y);
      if (!cell) return;
      var F = v3 ? Gr.V3.frame(visitNow()) : null;
      var tgt = dragTarget(cell, grabCell, drag.fp, F ? F.cols : Gr.COLS, F ? F.rows : Gr.ROWS);
      if (tgt.x === drag.x && tgt.y === drag.y && drag.sent) return;
      drag.x = tgt.x; drag.y = tgt.y; drag.sent = true;
      tellCell('dragCell', tgt.x, tgt.y);
      wake();
    }
    /* the finger was lifted: rewards-world re-validates on dragEnd (a valid cell confirms, an invalid
       one stays in place mode). A CANCELLED drag (pointercancel, a lost capture, a second finger, a
       sheet, suspend) is never a release: nothing is confirmed — on.dragCancel() when the host has
       it, else the ghost goes back to the cell the drag started from and placement stays open. */
    function onDragEnd(x, y, cancelled) {
      if (!drag) return;
      var d = drag;
      drag = null; grabCell = null;
      if (!d.started) return;
      if (!cancelled) { tell('dragEnd'); return; }
      if (typeof on.dragCancel === 'function') { tell('dragCancel'); return; }
      if (d.x0 != null && (d.x !== d.x0 || d.y !== d.y0)) tellCell('dragCell', d.x0, d.y0);
      wake();
    }
    function afterCamera() { hideBubble(); anchorsDirty = true; wake(); }

    /* ---------------- emotes ---------------- */
    function markEmote(target) { emoteSeen.target = target; emoteSeen.t = perfNow(); }
    function localEmote(target, kind) {
      if (target === 'avatar' || target === 'you') target = 'me';
      var now = perfNow();
      if (emoteSeen.target === target && now - emoteSeen.t < 350) return;      /* the canvas tap already did it */
      markEmote(target);
      if (target === 'me') { xcall('actors', 'emote', 'me', kind || 'heart'); return; }
      var rec = recs.get(target.replace(/^u:/, ''));
      if (rec) { emitFor(rec, kind || 'heart', 'top', 1); return; }      /* an item: a sprite over it */
      if (target.indexOf('pet:') !== 0) target = 'pet:' + target;
      xcall('actors', 'emote', target, kind || EMOTES[(frameNo + target.length) % EMOTES.length]);
    }
    function actorPoint(target, out) {
      var r = xcall('actors', 'anchor', target, out);
      return r && isFinite(r.x) ? r : null;
    }

    /* ================================================================
       ANCHORS, FOCUS RING, NAME BUBBLE
       ================================================================ */
    function keyOf(a) {
      if (!a) return null;
      if (a.uid != null) return 'u:' + a.uid;
      if (a.pet) return 'pet:' + a.pet;
      if (a.me) return 'me';
      if (a.region) return 'region:' + a.region;
      if (v3 && a.isle) return 'isle:' + a.isle;
      if (a.key) return String(a.key);
      return null;
    }
    var signCache = {};
    function worldOfKey(key, out) {
      if (!key) return null;
      if (key.indexOf('u:') === 0) { var rec = recs.get(key.slice(2)); if (!rec || rec.hidden) return null; return anchorOf(rec, 'top', out); }
      if (key.indexOf('pet:') === 0 || key === 'me') return actorPoint(key, out);
      if (key.indexOf('star:') === 0) {                 /* a memory star (its name bubble after a tap) */
        var life = v3 && env ? env.life : null, list = life && typeof life.petStars === 'function' ? life.petStars() : [];
        for (var si = 0; si < list.length; si++) if ('star:' + (list[si].key || list[si].id) === key) { out.set(list[si].x, list[si].y + 0.65, list[si].z); return out; }
        return null;
      }
      if (key.indexOf('region:') === 0) {
        var rg = key.slice(7);
        if (!signCache[rg]) { try { signCache[rg] = v3 ? env.regionSign(rg) : Gr.signAnchor(rg); } catch (e) { signCache[rg] = null; } }
        var s = signCache[rg];
        if (!s) return null;
        out.set(s.x, s.y, s.z);
        return out;
      }
      return null;
    }
    function setAnchors(list) {
      clearAnchors();
      var groups = {}, order = [];
      (Array.isArray(list) ? list : []).forEach(function (a) {
        if (!a || !a.el || !a.el.nodeType) return;
        var key = keyOf(a);
        if (!key) return;
        if (!groups[key]) { groups[key] = { key: key, dy: 0, dyPx: 0, els: [], src: a }; order.push(key); }
        var g = groups[key];
        if (typeof a.dy === 'number') g.dy = Math.max(g.dy, a.dy);
        if (typeof a.dyPx === 'number') g.dyPx = a.dyPx;
        g.els.push(a.el);
      });
      order.forEach(function (k) {
        var g = groups[k], wrap;
        if (g.els.length === 1 && g.els[0].classList && g.els[0].classList.contains('slw-tag3d')) wrap = g.els[0];
        else { wrap = el('div', 'slw-tag3d'); g.els.forEach(function (e) { wrap.appendChild(e); }); }
        wrap.style.visibility = 'hidden';
        var s = g.src, kind = tagKind(wrap, s);
        /* R2 (QA2A-6): ▶ PLAY draws over every sign and ✋, a sign over the other tags (island-pixel.css .slw-z-*) */
        if (kind === 'play' && wrap.classList) wrap.classList.add('slw-z-play');
        else if (kind === 'sign' && wrap.classList) wrap.classList.add('slw-z-sign');
        anchorsEl.appendChild(wrap);
        anchorList.push({ key: k, wrap: wrap, dy: g.dy, dyPx: g.dyPx, x: -1e9, y: -1e9, vis: false, show: true, at: null, kind: kind, sz: null,
          src: v3 ? { el: wrap, uid: s.uid, pet: s.pet, me: s.me, region: s.region, isle: s.isle, key: s.key } : null });
      });
      V3.anchorSig = '';
      anchorsDirty = true; tagSizesDirty = true;
      projectAnchors();
    }
    /* R2 (QA2A-6, QA2C-16): what a tag is, for its layer and the sign rules: 'play' (a game's ▶ PLAY), 'sign' (an island's
       or a locked land's sign), else 'tag' */
    function tagKind(wrap, s) {
      if (s && (s.isle || s.region)) return 'sign';
      try { if (wrap.querySelector && wrap.querySelector('.slw-tag.play')) return 'play'; } catch (e) {}
      return 'tag';
    }
    /* R2: the signs keep out of each other's way. After the tags are projected: each sign stays inside the stage with an
       SIGN_INSET margin, out of the camera buttons' corner, and clear of every ▶ PLAY tag and of the other signs (the
       nearest clear spot, the signs placed again in another order when a crowded phone stage leaves one none: the pure
       placeSigns; a PLAY tag never moves). The tags' sizes are measured once per set of tags (and on a resize), before
       any of them is moved, never in the middle of the frame's writes */
    var SIGN_INSET = 8, SIGN_GAP = 4, tagSizesDirty = true, camBox = null;
    function measureTags() {
      if (!tagSizesDirty) return;
      tagSizesDirty = false;
      for (var i = 0; i < anchorList.length; i++) { var a = anchorList[i]; if (a.kind !== 'tag') a.sz = tagSize(a.wrap); }
      camBox = null;
      if (camctlEl && camctlEl.offsetWidth > 0 && camctlEl.offsetHeight > 0) {
        var x0 = camctlEl.offsetLeft, y0 = camctlEl.offsetTop;
        camBox = { x0: x0 - SIGN_GAP, y0: y0 - SIGN_GAP, x1: x0 + camctlEl.offsetWidth + SIGN_GAP, y1: y0 + camctlEl.offsetHeight + SIGN_GAP };
      }
    }
    function boxOf(x, y, sz) { return { x0: x - sz.w / 2, y0: y - sz.h, x1: x + sz.w / 2, y1: y }; }
    function declutter() {
      if (!(cssW > 0 && cssH > 0)) return;
      var fixed = [], signs = [], i;
      for (i = 0; i < anchorList.length; i++) {
        var a = anchorList[i];
        if (!a.vis || !a.sz) continue;
        if (a.kind === 'play') fixed.push(boxOf(a.x, a.y, a.sz));
        else if (a.kind === 'sign') signs.push(a);
      }
      if (camBox) fixed.push(camBox);
      if (!signs.length) return;
      var at = placeSigns(signs.map(function (s) { return { x: s.x, y: s.y, w: s.sz.w, h: s.sz.h }; }), fixed, cssW, cssH,
        { inset: SIGN_INSET, gap: SIGN_GAP });
      for (i = 0; i < signs.length; i++) {
        var s = signs[i], p = at[i];
        if (!p) continue;
        /* half-pixel steps (the 4px gap between signs takes up the rounding) */
        var x = Math.round(p.x * 2) / 2, y = Math.round(p.y * 2) / 2;
        if (x !== s.x || y !== s.y) { s.x = x; s.y = y; s.wrap.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }
      }
    }
    /* v3 (D55): which labels show — the visited island's tags, Home's region signs on Home, island
       signs at 'gate' / 'dock' / 'map' (never in edit / place, never for the island you are on, a
       dock / map sign hides on an island under 60 px wide) */
    function anchorVis3() {
      var st = travelState(), sig = st.visit + '|' + mode + '|' + (st.skyMap ? 1 : 0) + '|' + anchorList.length;
      if (sig === V3.anchorSig && clockT - V3.visAt < 0.25) return;
      V3.anchorSig = sig; V3.visAt = clockT;
      var vis = [];
      try {
        vis = IV.anchorsVisible(anchorList.map(function (a) { return a.src; }), {
          visit: st.visit, mode: mode, skyMap: !!st.skyMap, widthPx: islePx,     /* the Sky tour shows island signs only, as the map */
          isleOf: function (uid) { var r = recs.get(uid); return r ? r.isle : V3.isleByUid ? V3.isleByUid[uid] || null : null; }
        });
      } catch (e) { issue('anchorsVisible: ' + errText(e)); }
      var by = new Map();
      vis.forEach(function (c) { by.set(c.el, c); });
      anchorList.forEach(function (a) { var c = by.get(a.wrap); a.show = !!c; a.at = c ? c.at || null : null; });
    }
    /* an island's width on screen (px), for the 60 px sign rule */
    function islePx(isle) {
      var F = Gr.V3.frame(isle);
      if (!F || !camera || !(cssW > 0)) return Infinity;
      _v.set(F.bounds.x0, F.top, F.cz).project(camera);
      var x0 = _v.x;
      _v.set(F.bounds.x1, F.top, F.cz).project(camera);
      return Math.abs(_v.x - x0) / 2 * cssW;
    }
    function signOf(isle, at, out) {
      var k = isle + ':' + at;
      if (!Object.prototype.hasOwnProperty.call(V3.signs, k)) { try { V3.signs[k] = env.signAnchor(isle, at) || null; } catch (e) { V3.signs[k] = null; } }
      var s = V3.signs[k];
      return s ? out.set(s.x, s.y, s.z) : null;
    }
    function clearAnchors() {
      anchorList.forEach(function (a) { if (a.wrap.parentNode === anchorsEl) anchorsEl.removeChild(a.wrap); });
      anchorList.length = 0;
    }
    var _scr2 = { x: 0, y: 0 };
    function screenOf(wp) {
      _v.copy(wp).project(camera);
      if (_v.z < -1 || _v.z > 1) return null;
      return toScreen(_v.x, _v.y, cssW, cssH, _scr2);
    }
    function placeTag(a, wp, inside) {
      var s = wp ? screenOf(wp) : null;
      if (!s) { if (a.vis) { a.wrap.style.visibility = 'hidden'; a.vis = false; } return; }
      var x = Math.round(s.x * 2) / 2, y = Math.round((s.y + (a.dyPx || 0)) * 2) / 2;
      /* QA#2: the name bubble stays whole inside the stage (a landmark at the island's back edge would push it
         off the top): it rises from its point, centred on it */
      var sz = inside ? tagSize(a.wrap) : null;
      if (sz && cssW > sz.w + 8) x = Math.min(Math.max(x, sz.w / 2 + 4), cssW - sz.w / 2 - 4);
      if (sz) y = Math.max(y, Math.min(sz.h + 4, cssH));
      if (!a.vis) { a.wrap.style.visibility = ''; a.vis = true; }
      if (Math.abs(x - a.x) >= 0.5 || Math.abs(y - a.y) >= 0.5) {
        a.x = x; a.y = y;
        a.wrap.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      }
    }
    function projectAnchors() {
      anchorsDirty = false; anchorClock = 0;
      if (!camera || !(cssW > 0)) return;
      if (v3) anchorVis3();
      if (v3) measureTags();                            /* reads first (R2), then the frame's writes */
      for (var i = 0; i < anchorList.length; i++) {
        var a = anchorList[i], wp = null;
        if (!v3) wp = worldOfKey(a.key, _v2);
        else if (a.show) wp = a.src && a.src.isle && a.at ? signOf(a.src.isle, a.at, _v2) : worldOfKey(a.key, _v2);
        if (wp && a.dy) wp.y += a.dy;
        placeTag(a, wp);
      }
      if (v3) declutter();
      if (bubble) {
        if (clockT > bubble.until) hideBubble();
        else { var bp = worldOfKey(bubble.key, _v2); if (bp) bp.y += 0.25 + bubble.lift; placeTag(bubble, bp, true); }
      }
      placeRing();
    }
    function showBubble(key, text, icon) {
      if (!text) return;
      hideBubble();
      var wrap = el('div', 'slw-tag3d slw-bubble3d', { role: 'status' });
      var nm = el('span', 'nm');
      if (icon) {                                      /* a care badge before the words, inside the pill (decoration: the words say it) */
        var ic = el('span', 'ic', { 'aria-hidden': 'true' }), tx = el('span', 'tx');
        ic.style.cssText = 'display:inline-block;width:20px;height:20px;margin:-3px 5px -3px -4px;vertical-align:middle;line-height:0;';
        ic.innerHTML = icon;
        tx.textContent = text;
        tx.style.verticalAlign = 'middle';
        nm.appendChild(ic); nm.appendChild(tx);
      } else nm.textContent = text;
      wrap.appendChild(nm);
      wrap.style.visibility = 'hidden';
      wrap.style.zIndex = '2';                   /* QA#2: over the tags, which a redraw re-adds after it */
      anchorsEl.appendChild(wrap);
      var lift = 0;
      for (var i = 0; i < anchorList.length; i++) if (anchorList[i].key === key) lift = 0.35;   /* above ▶ PLAY / ✋ */
      bubble = { key: key, wrap: wrap, until: clockT + 2.5, lift: lift, dy: 0, dyPx: 0, x: -1e9, y: -1e9, vis: false };
      later(function () { if (bubble && bubble.wrap === wrap) hideBubble(); }, 2600);
      anchorsDirty = true;
      wake();
    }
    function hideBubble() {
      if (!bubble) return;
      if (bubble.wrap.parentNode) bubble.wrap.parentNode.removeChild(bubble.wrap);
      bubble = null;
    }
    /* the #FFD23F keyboard focus ring around the projected hit box (or a disc for actors / signs) */
    var _corner = null;
    function placeRing() {
      if (!ringEl) return;
      if (!focusKey) { if (ringEl.style.display !== 'none') ringEl.style.display = 'none'; return; }
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
      if (focusKey.indexOf('u:') === 0) {
        var rec = recs.get(focusKey.slice(2));
        if (rec && rec.hit && !rec.hidden) {
          if (!_corner) _corner = new T.Vector3();
          for (var i = 0; i < 8; i++) {
            _corner.set(i & 1 ? rec.hit.max[0] : rec.hit.min[0], i & 2 ? rec.hit.max[1] : rec.hit.min[1], i & 4 ? rec.hit.max[2] : rec.hit.min[2]);
            var s = screenOf(_corner);
            if (!s) continue;
            n++;
            if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x; if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
          }
        }
      } else {
        var wp = worldOfKey(focusKey, _v2);
        if (wp) {
          wp.y -= focusKey === 'me' || focusKey.indexOf('pet:') === 0 ? 0.35 : 0;
          var c = screenOf(wp);
          if (c) { n = 1; minX = c.x - 30; maxX = c.x + 30; minY = c.y - 30; maxY = c.y + 30; }
        }
      }
      if (!n) { ringEl.style.display = 'none'; return; }
      var pad = 6;
      ringEl.style.display = '';
      ringEl.style.width = Math.max(28, maxX - minX + pad * 2) + 'px';
      ringEl.style.height = Math.max(28, maxY - minY + pad * 2) + 'px';
      ringEl.style.transform = 'translate3d(' + Math.round(minX - pad) + 'px,' + Math.round(minY - pad) + 'px,0)';
    }
    function focusItem(key) {
      if (key != null && key !== '' && !/^(u:|pet:|region:|me$)/.test(String(key))) key = 'u:' + key;
      key = key || null;
      var prev = focusKey && focusKey.indexOf('u:') === 0 ? recs.get(focusKey.slice(2)) : null;
      if (prev && prev.uid !== selectedUid) prev.batch.setHighlight(prev.uid, 0);
      focusKey = key;
      var rec = key && key.indexOf('u:') === 0 ? recs.get(key.slice(2)) : null;
      if (rec && rec.uid !== selectedUid) rec.batch.setHighlight(rec.uid, 1);
      anchorsDirty = true;
      projectAnchors();
      wake();
    }
    /* where the camera aims to frame a thing (QA#2): v3 aims at a tall thing's middle, not its foot (the view
       ray through its middle, down to the camera's target height), so the Big Wheel and the name over it stay
       in view as far as the island's pan limit allows */
    function aimOf(rec) {
      var p = { x: rec.wx, z: rec.wz }, ty = rig && rig.pose && isFinite(rig.pose.ty) ? rig.pose.ty : rec.wy;
      if (v3 && rec.h > 1 && rayAt(cssW / 2, cssH / 2) && _rd.y < -0.05) {
        var k = (ty - (rec.wy + rec.h / 2)) / _rd.y;
        if (k > 0) { p.x += _rd.x * k; p.z += _rd.z * k; }
      }
      return p;
    }
    function frameItem(uid) {
      var rec = recs.get(uid);
      if (!rec || !rig || (v3 && rec.isle !== visitNow())) return;        /* v3: never a flight in disguise */
      rig.focusOn(aimOf(rec), { zoom: Math.min(rig.zoomMax(), Math.max(1.5, rig.goal.zoom)) });
      afterCamera();
    }
    /* Find me (KU34): the camera eases to the child's figure at the largest play zoom (a cut under reduced
       motion or o.instant) and the figure waves (o.wave false: no wave). False with no figure, and while a
       flight, the Sky map or the tour has the camera */
    var _fm = { x: 0, y: 0, z: 0 };
    function focusMe(o) {
      o = o || {};
      if (!rig) return false;
      if (v3) { var st = travelState(); if (st.trip || st.map || st.skyMap || st.tour) return false; }
      var at = actorPoint('me', _fm);
      if (!at || !focusMeOn(rig, at, { instant: !!o.instant || reduced })) return false;
      if (o.wave !== false && xcall('actors', 'emote', 'me', 'wave') !== false) markEmote('me');
      afterCamera();
      return true;
    }

    /* ================================================================
       THE KIDS UPDATE'S CARE (P3.3; pets.json P22, ui U6 / U7 / U11, moodAndEating.tap)
       ================================================================ */
    /* feed(petId, foodId, {fav, reduced, frame}) → Promise<bool>: the feeding moment on the island (the host has
       already committed the meal). false at once when the pet is not out on the island being shown, during a
       flight / the Sky map / the tour, outside play mode, or without a crew that can eat (the host then plays
       the 2D moment on the portrait); else true when the moment is over (3.2 s, 1.2 s under reduced motion),
       skipped (a tap on the island, skipFeed()) or cut short (the island leaves the screen, a newer feed). */
    function feedPet(petId, foodId, o) {
      o = o || {};
      var id = typeof petId === 'string' ? petId.replace(/^pet:/, '') : '';
      if (!id || mode !== 'play' || suspended) return resolved(false);
      /* no bowl to draw (px-care.js's SL3D.vox.makeBowl is the v3 scene's): the host's 2D moment instead */
      if (!(SL3D.vox && typeof SL3D.vox.makeBowl === 'function')) return resolved(false);
      if (v3) {
        var st = travelState();
        if (st.trip || st.map || st.skyMap || st.tour) return resolved(false);
        var on = xcall('actors', 'onIsle', id);
        if (on !== undefined && on !== visitNow()) return resolved(false);
      }
      endFeed(true, false, true);                            /* one bowl: a moment still playing ends now */
      var sec = xcall('actors', 'feed', id, typeof foodId === 'string' ? foodId : '', { fav: !!o.fav });
      if (typeof sec !== 'number' || !(sec >= 0)) return resolved(false);
      var d = deferred(), f = { id: id, end: 0, resolve: d.resolve, timer: 0 };
      care.feed = f;
      /* the host's reduced motion on a moving stage: the end state now (the empty bowl, the pet facing it)
         held as long as the stage's own reduced moment */
      if (o.reduced === true && !reduced) { sec = feedStill(); xcall('actors', 'skipFeed', id, sec); }
      feedClock(f, sec);
      if (o.frame !== false) frameFeed(id);
      wake();
      return d.promise || resolved(true);
    }
    /* the moment's end on the stage's clock, and its wall-clock backstop */
    function feedClock(f, sec) {
      var tm = feedTiming(sec);
      f.end = clockT + tm.end;
      if (f.timer) cancelLater(f.timer);
      f.timer = later(function () { f.timer = 0; if (care.feed === f) endFeed(true, true); }, tm.backstopMs);
    }
    /* settle the moment playing now: skip → the actors jump to its end first; chime → the tummy pip's chime */
    function endFeed(ok, chime, skip) {
      var f = care.feed;
      if (!f) return false;
      care.feed = null;
      if (f.timer) cancelLater(f.timer);
      if (skip) xcall('actors', 'skipFeed', f.id, 0);
      if (chime && ok) sfx('star', 0.5);
      if (ok && (chime || skip)) unswing(f.swing);              /* (not on a teardown: the rig is going too) */
      try { f.resolve(!!ok); } catch (e) { /* the host's handler */ }
      wake();
      return true;
    }
    /* the moment over: a camera the moment swung round goes back to the child's angle (still on the pet),
       unless the child has moved it since (a cut under reduced motion) */
    function unswing(sw) {
      var g = rig && rig.goal;
      if (!sw || !g || typeof rig.orbitBy !== 'function' || mode !== 'play') return;
      if (Math.abs((+g.yaw || 0) - sw.y1) > 0.5 || Math.abs((+g.elev || 0) - sw.e1) > 0.5) return;
      rig.orbitBy(sw.y0 - g.yaw, sw.e0 - g.elev);
      if (reduced && typeof rig.focusOn === 'function') rig.focusOn({ x: g.tx, z: g.tz }, { instant: true });
      afterCamera();
    }
    /* a tap on the island or the host's strip (or Esc) during the moment: the end state now → bool */
    function skipFeed() { return endFeed(true, true, true); }
    /* ease the camera to the pet at the largest play zoom, as Find me does (a cut under reduced motion),
       swinging round a little first when an item hides the bowl or the pet (feedView) */
    var _fp = { x: 0, y: 0, z: 0 }, _fs = { x: 0, y: 0, z: 0 };
    function frameFeed(id) {
      var at = actorPoint('pet:' + id, _fp);
      if (!at || !rig) return;
      var bowl = xcall('actors', 'feedSpot', id, _fs), g = rig.goal;
      if (bowl && g && typeof rig.orbitBy === 'function' && (typeof rig.canOrbit !== 'function' || rig.canOrbit())) {
        var visit = v3 ? visitNow() : null, boxes = xcall('actors', 'occluders', id) || [];
        for (var i = 0; i < recList.length; i++) {
          var r = recList[i];
          if (r.hit && !r.hidden && !r.storing && (!v3 || r.isle === visit)) boxes.push(r.hit);
        }
        var pts = [{ x: bowl.x, y: bowl.y + 0.12, z: bowl.z }, { x: at.x, y: at.y - 0.2, z: at.z }];
        var view = feedView(pts, +g.yaw || 0, +g.elev || 0, boxes, rig.lim && rig.lim.elevMax);
        care.view = { dYaw: view.dYaw, dElev: Math.round(view.dElev * 10) / 10, n: view.n, boxes: boxes.length };
        if (view.dYaw || view.dElev > 0.01) {
          var y0 = +g.yaw || 0, e0 = +g.elev || 0;
          rig.orbitBy(view.dYaw, view.dElev);
          if (care.feed && care.feed.id === id) care.feed.swing = { y0: y0, e0: e0, y1: +g.yaw || 0, e1: +g.elev || 0 };
        }
      }
      if (focusMeOn(rig, at, { instant: reduced })) afterCamera();
    }
    /* each frame: the moment ends on the stage's clock once the actors have put the bowl away */
    function stepFeed() {
      var f = care.feed;
      if (!f) return false;
      if (clockT >= f.end && !xcall('actors', 'feedOn', f.id)) endFeed(true, true);
      return true;
    }
    /* a tap on a hungry pet (pets.json moodAndEating.tap): actors played the softer answer; the 'I'm hungry'
       bubble says so (with the care badge from SLWorldArtPets when it is loaded) */
    function hungryBubble(id) {
      var m = null, pets = lastView && Array.isArray(lastView.pets) ? lastView.pets : [];
      for (var i = 0; i < pets.length; i++) if (pets[i] && pets[i].id === id) m = petMood(pets[i].mood);
      var key = m && m.hunger >= 3 ? 'veryHungry' : 'hungry';
      var ART = root.SLWorldArtPets, icon = '';
      try { icon = ART && typeof ART.badge === 'function' ? String(ART.badge('hungry') || '') : ''; } catch (e) { icon = ''; }
      showBubble('pet:' + id, copyT('care.bubble.' + key) || BUBBLE[key], icon);
    }
    function copyT(key) { try { return Copy && typeof Copy.t === 'function' ? String(Copy.t(key, null, '') || '') : ''; } catch (e) { return ''; } }
    /* setPetStars(list) → the stars drawn: the memory stars in Home's night sky (skylife); kept, so a
       rebuilt sky gets them again */
    function setPetStars(list) {
      care.stars = starsOf(list);
      return applyStars();
    }
    function applyStars() {
      var life = v3 && env ? env.life : null;
      if (!life || typeof life.setPetStars !== 'function') return 0;
      try { return life.setPetStars(care.stars) | 0; } catch (e) { issue('setPetStars: ' + errText(e)); return 0; }
    }
    /* the memory star a tap hits ({id, name, t}) | null — night only, play mode, never in the Sky map */
    function starHit() {
      var life = v3 && env ? env.life : null;
      if (!life || typeof life.petStars !== 'function' || mode !== 'play' || travelState().skyMap) return null;
      var list = life.petStars(), best = null;
      for (var i = 0; i < list.length; i++) {
        var s = list[i], t = raySphere(_ro, _rd, s.x, s.y, s.z, s.r > 0 ? s.r : 0.9);
        if (t >= 0 && (!best || t < best.t)) best = { id: s.id, name: s.name, to: s.to || '', key: s.key || s.id, t: t };
      }
      return best;
    }
    /* a tap on a memory star: its name, a soft chime, and the host opens its memory card */
    function tapStar(sh) {
      sfx('star', 0.4);
      showBubble('star:' + sh.key, sh.name || '');
      tell('tapStar', sh.id, { name: sh.name || '', to: sh.to || '' });
    }

    /* ---------------- the keyboard list ---------------- */
    function buildSrList(view) {
      if (!srEl) return;
      var items = [];
      if (v3) {
        /* v3: SLIslesView's list — the visited island's items, its crew, Home's locked regions, then
           one entry per other island (fly there / locked: see how to unlock it) */
        var st = travelState(), list = [];
        try {
          list = IV.keyboardList({ placed: placedList, isles: V3.isles, isle: st.visit, skyMap: !!st.map, unlockedIsles: V3.unl, unlocked: envUnlocked,
            mode: mode, selectedUid: selectedUid, pets: view.pets, avatar: view.avatar }, Copy, { core: C });
        } catch (e) { issue('keyboardList: ' + errText(e)); }
        V3.kbActions = {};
        list.forEach(function (e) { V3.kbActions[e.key] = e.action; items.push({ key: e.key, label: e.label }); });
        writeSr(items);
        return;
      }
      var sorted = recList.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
      sorted.forEach(function (r) {
        if (!r.it) return;
        if (mode === 'play' && !r.it.act) return;
        items.push({ key: 'u:' + r.uid, label: itemLabel(r.it, mode, r.uid === selectedUid) });
      });
      if (mode === 'play') {
        (Array.isArray(view.pets) ? view.pets : []).forEach(function (p) { if (p && p.id) items.push({ key: 'pet:' + p.id, label: petLabel(C, p, Copy) }); });
        var hasHouse = placedList.some(function (p) { return p.id === 'house_cottage'; });
        if (hasHouse && view.avatar !== false) items.push({ key: 'me', label: 'That’s you!' });
      }
      if (mode !== 'place' && C.REGIONS) {
        Object.keys(C.REGIONS).forEach(function (rk) {
          var R = C.REGIONS[rk];
          if (!R.unlock || envUnlocked.indexOf(rk) >= 0 || (pendingRise && pendingRise.region === rk)) return;
          items.push({ key: 'region:' + rk, label: '🔒 ' + R.name + ' — see how to unlock it' });
        });
      }
      writeSr(items);
    }
    function writeSr(items) {
      var sig = mode + '|' + items.map(function (i) { return i.key + '=' + i.label; }).join('|');
      if (sig === srSig) return;
      srSig = sig;
      var hadFocus = document.activeElement && srEl.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
      while (srEl.firstChild) srEl.removeChild(srEl.firstChild);
      items.forEach(function (i) {
        var li = el('li'), b = el('button', null, { type: 'button', 'data-k': i.key, 'aria-label': i.label });
        b.textContent = i.label;
        li.appendChild(b);
        srEl.appendChild(li);
      });
      if (hadFocus) { var again = srEl.querySelector('[data-k="' + cssEsc(hadFocus) + '"]'); if (again) again.focus(); }
    }
    function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
    function srKey(e) { var b = e.target && e.target.closest ? e.target.closest('[data-k]') : null; return b ? b.getAttribute('data-k') : null; }
    function onSrClick(e) {
      var k = srKey(e);
      if (!k || dead) return;
      activateKey(k);
    }
    function onSrFocus(e) { var k = srKey(e); if (k) focusItem(k); }
    function onSrBlur(e) {
      if (e.relatedTarget && srEl.contains(e.relatedTarget)) return;
      focusItem(null);
    }
    /* Enter / Space on a list button: the same path as a canvas tap */
    function activateKey(k) {
      wake();
      if (v3 && V3.travel && V3.travel.busy) { V3.travel.skip(); return; }        /* a key during a trip skips it (D83) */
      var a3 = v3 ? V3.kbActions[k] : null;
      if (a3 && /^(isle|gate|bridge|region)$/.test(a3.kind)) { tapRoute(a3); return; }
      if (k.indexOf('u:') === 0) {
        var uid = k.slice(2);
        if (mode === 'place') return;
        tapItemUid(uid);
      } else if (k === 'me') tapActor('me');
      else if (k.indexOf('pet:') === 0) tapActor(k);
      else if (k.indexOf('region:') === 0) { var lid = landIdOf(k.slice(7)); if (lid) tell('tapLand', lid); }
    }

    /* ================================================================
       SEQUENCES: launch, unlock, debut, store, Showtime, encore, dance
       ================================================================ */
    function act(uid, name) {
      var rec = recs.get(uid);
      if (!rec) return resolved(false);
      name = String(name || '');
      wake();
      if (v3) {
        /* a landmark ignores re-taps while its act runs; a copy drawn at LOD1 acts at LOD0 (D106) */
        if (rec.act && rec.it && rec.it.kind === 'landmark') return resolved(false);
        rec = promoteFor(rec);
        if (!rec) return resolved(false);
        var p3 = actOf(rec, name);
        if (p3 && typeof p3.then === 'function') p3.then(function () { IV.promote(uid, 0, { now: clockT, table: V3.promo }); });
        return p3;
      }
      return actOf(rec, name);
    }
    /* v3: keep a tapped copy at LOD0 for its act and PROMOTE_TAIL after (re-batched now if it shows LOD1) */
    function promoteFor(rec) {
      IV.promote(rec.uid, Infinity, { now: clockT, table: V3.promo });
      if (rec.ns !== 'vox-lod1') return rec;
      var list = entriesOf(rec.isle);
      for (var i = 0; i < list.length; i++) {
        if (list[i].uid !== rec.uid) continue;
        try { restyleRec(rec, nOf(list[i], 'vox')); } catch (e) { issue('promote ' + rec.id + ': ' + errText(e)); }
        commitMerged3();
        break;
      }
      return recs.get(rec.uid) || null;
    }
    function actOf(rec, name) {
      var uid = rec.uid;
      if (name === 'glow') return setLitInternal(uid, !litMem[uid], true);
      if (name === 'launch') return launchAct(rec);
      if (name === 'encore') return encoreAct(rec);
      /* 'homeClose' supersedes a held 'home' act: the model closes the door from its pose;
         the city buildings' acts (snap, serve, screen, record, dance, hangout) restart on a re-tap */
      return runAct(rec, modelAct(name, !!litMem[uid]));
    }
    /* the Concert Stage's encore: the model act (sting, the LED wall, moving heads, the crew's 'stage'
       perform, confetti), 8 s of Showtime that then gives back the child's own setting, and the
       skyline shot eased in toward the stage. A re-tap while it runs is ignored. */
    function encoreAct(rec) {
      if (encoreHeld(rec.uid)) return resolved(false);
      var sec = (L && L.TEMPO && L.TEMPO.encoreSec) || ENCORE_SEC;
      encoreLock = { uid: rec.uid, until: perfNow() + sec * 1000 };
      var p = runAct(rec, 'encore');
      if (rig && !reduced && mode === 'play') rig.skyline({ easeIn: ENCORE_CAM.easeIn, hold: ENCORE_CAM.hold, at: { x: rec.wx, z: rec.wz } });
      showtime(true, { encoreMs: sec * 1000, quiet: true });
      return p;
    }
    function launchAct(rec) {
      var spot = anchorOf(rec, 'spot', new T.Vector3());
      var pt = { x: rec.wx, y: rec.wy, z: rec.wz };
      if (spot && isFinite(spot.x)) { pt.x = (spot.x + rec.wx) / 2; pt.z = (spot.z + rec.wz) / 2; }
      if (env && showK > 0.5 && typeof env.aim === 'function') env.aim({ x: rec.wx, y: rec.wy, z: rec.wz }, { instant: reduced });
      launchedUid = rec.uid;
      var pa = runAct(rec, 'launch');
      var pc = rig ? rig.pushIn(pt) : null;
      var d = deferred(), done = false;
      function finish() { if (done) return; done = true; d.resolve(true); }
      var P = Pr();
      if (P) P.all([pa || resolved(true), pc || resolved(true)]).then(finish, finish);
      later(finish, reduced ? 120 : 1100);       /* frames may be paused: never block the game */
      /* no game took over (a time-limit sheet, a cancelled launch): ease the push-in back */
      later(function () {
        if (launchedUid !== rec.uid || suspended || revoked) return;
        launchedUid = null;
        if (rig) rig.releaseMove('push');
        if (env && typeof env.aim === 'function') env.aim(null);
        wake();
      }, 4000);
      return d.promise;
    }
    function unlockLand(region) {
      if (!env || !C.REGION_CELLS || !C.REGION_CELLS[region] || region === 'home') return resolved(false);
      var d = deferred(), done = false;
      function finish(ok) { if (done) return; done = true; d.resolve(ok !== false); }
      if (pendingRise && pendingRise.region === region) pendingRise = null;
      risen[region] = true;
      if (envUnlocked.indexOf(region) < 0) envUnlocked = envUnlocked.concat([region]);
      var h = null;
      try { h = env.riseRegion(region, { reduced: reduced }); } catch (e) { issue('riseRegion: ' + errText(e)); h = null; }
      landKeys = Gr.landFrom(envUnlocked);
      landSig = envUnlocked.slice().sort().join(',');
      if (rig) rig.setLand(landKeys, { instant: reduced });
      var rb = Gr.regionBounds(region);
      if (rig) rig.crane({ x: rb.cx, y: 0, z: rb.cz });
      sfx('whoosh', 0.8);
      var dur = h && h.dur ? h.dur : 0.4;
      riseFx = { t: 0, cells: h && h.cells ? h.cells : [], i: 0, dur: dur, done: false, fw: 0, cx: rb.cx, cz: rb.cz };
      if (lastView) { syncActors(lastView); applyEdit(); buildSrList(lastView); }
      var wait = reduced ? 450 : (dur + 0.9) * 1000;
      if (h && h.promise && typeof h.promise.then === 'function') h.promise.then(function () { later(function () { finish(true); }, reduced ? 200 : 700); });
      later(function () { finish(true); }, wait + 2500);
      later(function () { if (!done && (suspended || covered)) finish(true); }, wait);
      wake();
      return d.promise;
    }
    /* splash rings as each cell surfaces, sparkles, then 3 firework rings and applause */
    function stepRiseFx(dt) {
      var r = riseFx;
      r.t += dt;
      while (r.i < r.cells.length && r.cells[r.i].delay <= r.t) {
        var c = r.cells[r.i++];
        _v2.set(c.x, Gr.SEA_Y + 0.03, c.z);
        fxEmit(reduced ? 'sparkle' : 'splash', _v2, 1);
        if (r.i % 3 === 0) { _v2.y = (c.y || 0) + 0.25; fxEmit('sparkle', _v2, reduced ? 2 : 4); }
      }
      if (!r.done && r.t >= r.dur) {
        r.done = true;
        sfx('applause', 0.9);
        if (env) env.invalidateShadows();
      }
      if (r.done && !reduced && r.fw < 3 && r.t >= r.dur + r.fw * 0.25) {
        _v2.set(r.cx + (r.fw - 1) * 1.6, 3.2 + (r.fw % 2) * 0.6, r.cz - 0.5);
        fxEmit('firework', _v2, 18);
        r.fw++;
      }
      if (r.done && (reduced || r.fw >= 3)) riseFx = null;
    }
    function applyPendingRise() {
      var region = pendingRise.region;
      pendingRise = null;
      if (envUnlocked.indexOf(region) < 0) envUnlocked = envUnlocked.concat([region]);
      if (env) env.setLand(envUnlocked, lastView && lastView.world && Array.isArray(lastView.world.placed) ? lastView.world : { placed: placedList });
      landKeys = Gr.landFrom(envUnlocked);
      landSig = envUnlocked.slice().sort().join(',');
      if (rig) rig.setLand(landKeys, {});
      if (lastView) { syncActors(lastView); buildSrList(lastView); }
    }
    function debut(uid) {
      var rec = recs.get(uid);
      if (!rec) return resolved(false);
      if (rec.debutP) { rec.debutP.resolve(false); rec.debutP = null; }
      var d = deferred();
      rec.debutP = d;
      setHidden(rec, false);
      var dur = startAnim(rec, 'debut', false);
      later(function () { if (rec.debutP === d) { rec.debutP = null; d.resolve(true); } }, (dur + 0.6) * 1000);
      wake();
      return d.promise;
    }
    function storeFx(uid, trayEl) {
      var rec = recs.get(uid);
      if (!rec) return resolved(false);
      cancelAct(rec, false);
      if (rec.storeP) rec.storeP.resolve(false);
      var d = deferred();
      rec.storeP = d;
      rec.storing = true;
      var dur = startAnim(rec, 'store', false);
      /* the sparkle flies toward the tray */
      var from = anchorOf(rec, 'top', new T.Vector3()), to = trayPoint(trayEl);
      if (to) xcall('fx', 'emit', 'flight', { x: from.x, y: from.y, z: from.z }, 1, { to: { x: to.x, y: to.y, z: to.z }, dur: reduced ? 0.3 : 0.5, delay: reduced ? 0 : 0.25 });
      later(function () {
        if (rec.storeP === d) { rec.storeP = null; d.resolve(true); }
        if (!rec.dead && rec.storing) { rec.storing = false; if (rec.removeAfter) removeRec(rec); else setHidden(rec, true); }
      }, (dur + 0.8) * 1000);
      if (selectedUid === uid) setSelected(null);
      wake();
      return d.promise;
    }
    /* a point in front of the camera under the tray element (screen → world at 6 u) */
    function trayPoint(trayEl) {
      if (!camera || !container || !(cssW > 0)) return null;
      var x = cssW / 2, y = cssH;
      try {
        if (trayEl && trayEl.getBoundingClientRect) {
          var r = trayEl.getBoundingClientRect(), c = container.getBoundingClientRect();
          x = r.left + r.width / 2 - c.left; y = clamp(r.top + r.height / 2 - c.top, -cssH * 0.2, cssH * 1.2);
        }
      } catch (e) {}
      if (!rayAt(x, y)) return null;
      return { x: _ro.x + _rd.x * 6, y: _ro.y + _rd.y * 6, z: _ro.z + _rd.z * 6 };
    }

    function showtime(onOff, o) {
      o = o || {};
      wake();
      if (o.encoreMs > 0) {
        if (suspended || revoked) return resolved(false);    /* off screen (a game is starting): no encore */
        /* the stage encore owns the crew's 8-count: no controller dance break meanwhile */
        var stageLed = encoreLive();
        if (userShow) { if (!stageLed) later(encoreDance, reduced ? 200 : 1200); return resolved(true); }
        if (encore) { cancelLater(encore.timer); cancelLater(encore.danceTimer); }
        var first = !encore;
        encore = { timer: later(endEncore, Math.max(1000, +o.encoreMs)), danceTimer: 0 };
        if (first) {
          if (env) env.showtime(true, { reduced: reduced });
          if (rig) rig.showOrbit(true);
          musicContext('island_showtime');
          if (!o.quiet && !stageLed) { sfx('sting', 0.8); sfx('whoosh', 0.7); }    /* the stage act plays its own sting */
          xcall('actors', 'setShowtime', true);
        }
        if (!stageLed) encore.danceTimer = later(encoreDance, reduced ? 300 : 1800);
        return resolved(true);
      }
      onOff = !!onOff;
      if (encore) { cancelLater(encore.timer); cancelLater(encore.danceTimer); encore = null; }
      userShow = onOff;
      nextDanceBar = -1;
      if (env) env.showtime(onOff, { reduced: reduced });
      if (rig) rig.showOrbit(onOff);
      musicContext(onOff ? 'island_showtime' : 'island_day');
      xcall('actors', 'setShowtime', onOff);
      if (!onOff && env && typeof env.aim === 'function') env.aim(null);
      return resolved(true);
    }
    function endEncore() {
      if (!encore) return;
      if (suspended || revoked) { endEncoreQuietly(); return; }
      cancelLater(encore.danceTimer);
      encore = null;
      if (userShow) return;
      if (env) env.showtime(false, { reduced: reduced });
      if (rig) rig.showOrbit(false);
      musicContext('island_day');
      xcall('actors', 'setShowtime', false);
      sfx('chip', 0.6);
      wake();
    }
    /* the island left the screen (a game, another tab, a profile switch) mid-encore: back to day at
       once, with no sound and no music change (rewards-world sets the music when the island returns) */
    function endEncoreQuietly() {
      encoreLock = null;
      if (!encore) return;
      cancelLater(encore.timer); cancelLater(encore.danceTimer);
      encore = null;
      nextDanceBar = -1;
      if (userShow) return;
      if (env) env.showtime(false, { reduced: true });
      if (rig) rig.showOrbit(false);
      xcall('actors', 'setShowtime', false);
    }
    /* the encore's dance break (a timer): only while the island is on screen, the show is still on
       and no stage encore leads the crew */
    function encoreDance() { if (!suspended && !revoked && showOn() && !encoreLive()) danceNow(); }
    function scheduleDance() {
      if (!showOn() || showK < 0.98) { if (!showOn()) nextDanceBar = -1; return; }
      if (dance || mode !== 'play' || covered || suspended || encoreLive()) return;
      var nd = nextDance(beat.bar, nextDanceBar, DANCE_EVERY_BARS);
      nextDanceBar = nd.next;
      if (nd.due) danceNow();
    }
    function housePoint() {
      if (v3) {
        /* the visited island's centre of the party: Home's house, a land's landmark, else its middle */
        var v = visitNow(), d = C.ISLES && C.ISLES[v], want = v === 'home' ? 'house_cottage' : d && d.landmark, F = Gr.V3.frame(v);
        for (var j = 0; j < recList.length; j++) if (recList[j].isle === v && recList[j].id === want) { var q = recList[j]; return { x: q.wx, y: q.wy, z: q.wz + 1 }; }
        return { x: F.cx, y: F.top, z: F.cz };
      }
      for (var i = 0; i < recList.length; i++) if (recList[i].id === 'house_cottage') { var r = recList[i]; return { x: r.wx, y: r.wy, z: r.wz + 1 }; }
      return { x: 0, y: 0, z: 0 };
    }
    function danceNow() {
      if (dead || dance || mode !== 'play' || suspended || revoked || encoreLive()) return;
      var sec = DANCE_COUNTS * 60 / DANCE_BPM;
      var total = xcall('actors', 'dance', { bpm: DANCE_BPM, counts: DANCE_COUNTS, reduced: reduced });
      total = typeof total === 'number' && total > 0 ? total : sec + (reduced ? 0 : 2);
      var hp = housePoint();
      dance = { until: clockT + total, x: hp.x, y: hp.y, z: hp.z };
      if (rig && !reduced) rig.dance(hp, Math.max(0, total - 1.6));
      wake();
    }
    function endDance() {
      var dn = dance;
      dance = null;
      _v2.set(dn.x, dn.y + 1.2, dn.z);
      fxEmit('sparkle', _v2, reduced ? 8 : 24);
      sfx('cheer', 0.8);
    }

    /* ---------------- crew anchors, the QA grid, the LOW tier mark ---------------- */
    /* the crew's building performs (the booth's front, the café 'seat', the rooftop 'roof', the stage
       deck) resolve item anchors live, so a moved building is followed; an anchor the template does
       not have is null (never the 'top' fallback: no crew member is sent onto a roof by mistake) */
    function anchorFn(uid, name, out) {
      var rec = recs.get(uid);
      if (!rec || rec.dead || rec.hidden || rec.storing || !rec.tpl) return null;
      var nm = name || 'top', tpl = rec.tpl;
      if (nm !== 'top' && !(tpl.anchors && tpl.anchors[nm]) && !(tpl.pivots && tpl.pivots[nm])) return null;
      anchorOf(rec, nm, _anc);
      out = out && typeof out === 'object' ? out : {};
      out.x = _anc.x; out.y = _anc.y; out.z = _anc.z;
      return out;
    }
    /* a (re)built actors sibling: the live anchors, and the music state is told again next frame */
    function wireAnchors() { xcall('actors', 'setAnchorFn', anchorFn); musicWas = null; }
    function onDebugGrid() { if (!dead && !failed) { applyEdit(); wake(); } }
    function markTier() {
      try {
        var de = root.document && root.document.documentElement;
        if (de && de.classList) { if (tier === 'LOW') de.classList.add('sl-low'); else de.classList.remove('sl-low'); }
      } catch (e) { /* no document element: nothing to mark */ }
    }

    /* ================================================================
       LIFECYCLE
       ================================================================ */
    function maybeReady() {
      if (readyFired || compileState || dead) return;
      /* v3 with no Sky tour: the canvas fades in on the visited island at LOD0 (its slices first, ≤ 1.2 s) */
      if (v3 && !V3.forceReady && !V3.introPending) {
        var v = visitNow(), waiting = false;
        for (var i = 0; i < V3.jobs.length; i++) if (V3.jobs[i].isle === v && V3.jobs[i].kind !== 'prefetch') waiting = true;
        if (waiting) {
          if (!V3.readyWait) V3.readyWait = later(function () { V3.readyWait = 0; V3.forceReady = true; maybeReady(); }, 1200);
          return;
        }
      }
      compileState = 1;
      if (rig) { rig.update(0); rig.apply(camera); }
      var p = lease ? lease.compile(scene, camera) : null;
      var go = function () { if (!dead && compileState === 1) { compileState = 2; compileFrames = 0; wake(); } };
      if (p && typeof p.then === 'function') p.then(go, go); else go();
      readyTimer = later(function () { if (!readyFired && !covered && !suspended) fireReady(); }, 1500);
    }
    function fireReady() {
      if (readyFired || dead) return;
      readyFired = true; compileState = 3;
      cancelLater(readyTimer);
      if (canvas) canvas.style.opacity = '1';
      if (container) container.classList.add('is-ready');
      /* the establishing shot over the bay (play mode; reduced motion opens on the child's view);
         v3: the Sky tour (D83), whose first frames are the LOD1 bakes the cold mount built */
      if (v3) {
        var tour = V3.introPending && V3.travel && !reduced && mode === 'play';
        V3.introPending = false;
        if (tour) V3.travel.intro(); else refreshIsles();
      } else if (rig && !reduced && mode === 'play' && opts.skyline !== false) rig.skyline();
      musicContext(userShow ? 'island_showtime' : 'island_day');
      tell('ready');
      wake();
    }
    var observed = false;
    function attach(target) {
      if (!target || !container) return stage;
      if (container.parentNode !== target) target.appendChild(container);
      if (lease && !observed) { lease.observe(container); observed = true; }   /* the observers follow the element */
      measure();
      anchorsDirty = true;
      wake();
      return stage;
    }
    function measure() {
      if (!container) return;
      var w = container.clientWidth | 0, h = container.clientHeight | 0;
      try { touch = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches) || (root.navigator && root.navigator.maxTouchPoints > 0); } catch (e) { touch = false; }
      if (rig) rig.setTouch(touch);
      if (w > 0 && h > 0 && (w !== cssW || h !== cssH) && lease) lease.resize(w, h);
    }
    function setCovered(v) {
      covered = !!v;
      if (lease) lease.setCovered(covered);
      if (covered && controls) controls.cancel();
      if (!covered) {
        if (pendingMusic) musicContext(pendingMusic);       /* a context change that waited for the sheet */
        wake();
      }
    }
    /* the island leaves the screen (another tab, a game): every gesture is cancelled (never
       confirmed), a running encore ends quietly, and nothing plays sound or music until resume */
    function suspend() {
      suspended = true;
      if (controls) controls.cancel();
      hideBubble();
      endFeed(true, false, true);                      /* a feeding moment ends at its end state */
      endEncoreQuietly();
      pendingMusic = null;
      if (v3 && V3.travel) V3.travel.skip();
      if (v3 && env && typeof env.suspend === 'function') env.suspend();    /* D98: no haze on a game's rigs */
      if (lease) { lease.setHidden(true); lease.stop(); }
    }
    function resume() {
      suspended = false;
      if (v3 && env && typeof env.resume === 'function') env.resume();
      if (lease) { lease.setHidden(false); lease.start(); }
      if (rig) rig.releaseMove('push');
      if (env && typeof env.aim === 'function') env.aim(null, { instant: true });
      launchedUid = null;
      /* while a game holds the renderer the canvas is the game's: onResume re-parents it later */
      if (container && container.parentNode && lease && !revoked) { placeCanvas(); measure(); }
      anchorsDirty = true;
      wake();
    }
    function setReduced(v) {
      reduced = !!v;
      optR.reduced = reduced;
      if (lease) lease.setReduced(reduced);
      if (env) env.setReduced(reduced);
      if (rig) rig.setReduced(reduced);
      xcall('actors', 'setReduced', reduced);
      xcall('fx', 'setReduced', reduced);
      xcall('edit', 'setReduced', reduced);
      if (reduced) endFeed(true, false, true);         /* reduced motion: a feeding moment shows its end state */
      layerCall('city', 'setReduced', reduced);
      layerCall('life', 'setReduced', reduced);
      for (var i = 0; i < recList.length; i++) { recList[i].a.reduced = reduced; recList[i].idlePending = true; }
      if (v3 && reduced && V3.introPending) { V3.introPending = false; refreshIsles(); }     /* never a tour under reduced motion */
      wake();
    }
    function setUser(u) {
      var prev = user;
      user = normUser(u);
      hUser = handleUser(user);
      if (env && typeof env.setMember === 'function') env.setMember(user.color);
      xcall('fx', 'setMember', user.color);
      userLayers(prev);
      userModels();
      recList.forEach(function (r) {
        cancelAct(r, false);
        var an = r.anims;
        for (var k in an) an[k].t = -1;
        r.animOn = 0; r.rootDirty = true; addLive(r);
        r.a.member = hUser.color; r.a.user = hUser;     /* the next child's trims, initial and emoji */
        r.idlePending = true;
      });
      showDirty = true;                                /* every copy re-lights in the new colour */
      endEncoreQuietly();
      dance = null;
      Object.keys(litMem).forEach(function (uid) { setLitInternal(uid, false, false); });
      litMem = {};
      xcall('actors', 'setUser', user);           /* the avatar itself follows the next sync's view.avatar */
      focusItem(null);
      hideBubble();
      wake();
    }
    /* a new child: the member colour and first name reach the city (its hero board); a new seed is a
       new coastline — env.setUser / env.setSeed when the env offers them, else the env is rebuilt */
    function userLayers(prev) {
      var seedCh = String(prev.seed) !== String(user.seed), nameCh = prev.name !== user.name;
      layerCall('city', 'setMember', user.color);
      if (nameCh) layerCall('city', 'setUser', { name: user.name });
      if (!env || (!seedCh && !nameCh)) return;
      if (typeof env.setUser === 'function') {
        try { env.setUser({ name: user.name, seed: user.seed, color: user.color }); } catch (e) { issue('env.setUser: ' + errText(e)); }
        return;
      }
      if (seedCh && typeof env.setSeed === 'function') {
        try { env.setSeed(user.seed); } catch (e2) { issue('env.setSeed: ' + errText(e2)); }
        return;
      }
      if (seedCh && root.SLTerrain3D) rebuildEnv();
    }
    /* the child's first name and colour for everything that draws them: the kit's shared LED and sign
       atlases (the LED name marquee, the tower's initial) and the models with a setUser of their own
       (bld_stage's covers the three stage buildings, att_course's every course gate) */
    function userModels() {
      var au = { name: hUser.name, color: hUser.color };
      if (v3) {
        /* the vox atlas's name / initial / avatar cells and every vox handler with a setUser (each
           handler object once) */
        try { var A = K.vox && K.vox.atlas(); if (A && typeof A.setUser === 'function') A.setUser({ name: hUser.name, color: hUser.color, avatar: user.avatar }); } catch (e) { issue('vox atlas setUser: ' + errText(e)); }
        var done = [];
        Object.keys(R.models || {}).forEach(function (id) {
          var h = R.models[id];
          if (!h || typeof h.setUser !== 'function' || done.indexOf(h) >= 0) return;
          done.push(h);
          try { h.setUser(handleUser(user)); } catch (e2) { issue(id + '.setUser: ' + errText(e2)); }
        });
        return;
      }
      ['ledAtlas', 'signAtlas'].forEach(function (k) {
        if (typeof K[k] !== 'function') return;
        try { var at = K[k](); if (at && typeof at.setUser === 'function') at.setUser(au); } catch (e) { issue('K.' + k + '.setUser: ' + errText(e)); }
      });
      var M = SL3D.models || {};
      [['bld_stage', au], ['att_course', handleUser(user)]].forEach(function (m) {
        var h = M[m[0]];
        if (!h || typeof h.setUser !== 'function') return;
        try { h.setUser(m[1]); } catch (e) { issue(m[0] + '.setUser: ' + errText(e)); }
      });
    }
    /* the environment alone, rebuilt in place (items, actors and effects stay) */
    function rebuildEnv() {
      try { if (env) { if (env.group && env.group.parent) env.group.parent.remove(env.group); env.dispose(); } } catch (e) { issue('env dispose: ' + errText(e)); }
      env = null;
      disposeLayers();
      try {
        buildEnv();
        env.setLand(envUnlocked, lastView && lastView.world && Array.isArray(lastView.world.placed) ? lastView.world : { placed: placedList });
        if (typeof env.setShow === 'function') env.setShow(showOn() ? 1 : 0);
        if (typeof env.show === 'number') { showK = env.show; showDirty = true; }
        coneSig = null;
        updateConeMounts();
      } catch (e3) { fail('env rebuild: ' + errText(e3)); }
      wake();
    }
    function info() {
      var out = {
        version: VERSION, tier: tier, mode: mode, ready: readyFired, failed: failed, reduced: reduced,
        items: recs.size, batches: batches.size, live: live.length, acts: recList.filter(function (r) { return !!r.act; }).length,
        show: Math.round(showK * 1000) / 1000, showtime: userShow, encore: !!encore, dancing: !!dance,
        suspended: suspended, covered: covered, lost: lost, revoked: revoked,
        systems: { actors: sys.actors ? sys.actors.name : null, fx: sys.fx ? sys.fx.name : null, edit: sys.edit ? sys.edit.name : null },
        layers: { owner: layers.owner, city: !!layers.city, life: !!layers.life, terrain: !!root.SLTerrain3D },
        stageEncore: encoreLive() ? encoreLock.uid : null, debugGrid: DEBUG.grid, seeded: user.seed != null,
        camera: rig ? rig.info() : null, beat: { bpm: beat.bpm, bar: beat.bar, music: !!beat.music }, issues: issues.slice(),
        care: { feeding: care.feed ? care.feed.id : null, stars: care.stars.length, view: care.view }      /* P3.3 */
      };
      try { if (merged) out.merged = merged.info(); } catch (e) {}      /* {groups, calls, entries, vertices, holes, bones} */
      try { if (layers.city && typeof layers.city.info === 'function') out.city = layers.city.info(); } catch (e) {}
      try { if (layers.life && typeof layers.life.info === 'function') out.life = layers.life.info(); } catch (e) {}
      try { if (env) out.env = env.info(); } catch (e) {}
      try { if (lease) out.lease = lease.info(); } catch (e) {}
      out.actors = xcall('actors', 'info') || null;
      out.fx = xcall('fx', 'info') || null;
      if (v3) info3(out);
      return out;
    }
    /* v3: the visited island, the map, each island's display (its items + its terrain) and the work queue */
    function info3(out) {
      var st = travelState(), gl = out.env && out.env.isles && out.env.isles.isles ? out.env.isles.isles : {};
      out.version = 3; out.isle = st.visit; out.skyMap = !!st.map; out.overview = !!st.map; out.tour = !!st.tour;
      out.isles = {};
      ISLES3.forEach(function (k) {
        var S = I3[k], p = V3.pol && V3.pol[k], acc = { calls: 0, tris: 0 }, n = 0;
        if (S && S.group && S.group.visible !== false) countMeshes(S.group, acc);
        for (var i = 0; i < recList.length; i++) if (recList[i].isle === k) n++;
        var t = gl[k] && typeof gl[k].tris === 'number' ? gl[k].tris : 0;
        out.isles[k] = { mode: p ? p.mode : 'preview', want: S ? S.mode : null, lod: p ? p.lod : 1, itemLod: p ? p.itemLod : 0, live: st.live === k,
          calls: acc.calls, tris: Math.round(acc.tris + t), itemTris: Math.round(acc.tris), items: S && S.mode === 'bake' ? entriesOf(k).length : n };
      });
      var li = out.lease || {};
      out.calls = li.calls; out.tris = li.tris; out.programs = li.programs;
      out.jobs = V3.jobs.map(function (J) { return J.isle + ':' + J.kind; });
      /* the last frame's slice and the slowest unit so far (the lab's per-frame log; the device pass) */
      out.slice = { ms: Math.round(V3.slice.ms * 100) / 100, units: V3.slice.units, max: Math.round(V3.slice.max * 100) / 100, what: V3.slice.what,
        worst: Math.round(V3.slice.worst * 100) / 100, worstWhat: V3.slice.worstWhat };
      out.travel = V3.travel && typeof V3.travel.info === 'function' ? V3.travel.info() : null;
      out.vox = { models: Object.keys(R.models || {}).length, templates: Object.keys(V3.tris).length };
    }
    /* draw calls and triangles under a group, as renderer.info counts them (instances, draw ranges) */
    function countMeshes(g, acc) {
      g.traverse(function (o) {
        if (!o.isMesh || !o.geometry) return;
        for (var p = o; p && p !== g; p = p.parent) if (p.visible === false) return;
        if (o.isInstancedMesh && !o.count) return;
        var G = o.geometry, n = G.index ? G.index.count : G.attributes && G.attributes.position ? G.attributes.position.count : 0, dr = G.drawRange;
        if (dr) n = Math.max(0, Math.min(n, dr.start + dr.count) - dr.start);
        if (!n) return;
        acc.calls++; acc.tris += n / 3 * (o.isInstancedMesh ? o.count : 1);
      });
    }

    /* full GPU rebuild after a context restore: dispose and remount from the current view */
    function rebuildAll() {
      if (dead) return;
      try {
        var v = lastView;
        teardownContent();
        buildEnv();
        buildSystems();
        wireAnchors();
        if (v3) { buildTravel(); xcall('edit', 'prewarm'); }
        envUnlocked = ['home']; landSig = ''; firstSync = true; srSig = ''; coneSig = null;
        if (v) syncView(v);
        if (v3 && V3.visit !== 'home') xcall('actors', 'setIsle', V3.visit);    /* the crew is still on the land it was on */
        if (userShow && env) env.setShow(1);
        anchorsDirty = true;
        wake();
      } catch (e) { fail('remount: ' + errText(e)); }
    }
    function teardownContent() {
      endFeed(true, false);                            /* the moment's crew is going: the host still gets its answer */
      if (v3) {
        /* travel goes before the rig and the sky it drives */
        if (V3.travel) { try { V3.travel.dispose(); } catch (e) { issue('travel dispose: ' + errText(e)); } V3.travel = null; }
        if (V3.readyWait) { cancelLater(V3.readyWait); V3.readyWait = 0; }
        V3.jobs.length = 0; V3.items = null; V3.pol = null; V3.polSig = ''; V3.isleSig = ''; V3.signs = {}; V3.anchorSig = '';
      }
      recList.slice().forEach(function (r) { cancelAct(r, false); forgetCopy(r); r.dead = true; });
      recList.length = 0; recs.clear(); live.length = 0;
      /* the lit memory describes the copies on screen: none are left, so the next sync re-lights
         every lamp the view says is on (a context-restore rebuild starts from unlit batches) */
      litMem = {};
      batchList.slice().forEach(function (b) { try { b.batch.dispose(); } catch (e) {} });
      batchList.length = 0; batches.clear();
      disposeMerged();
      Object.keys(I3).forEach(function (k) {
        var S = I3[k];
        dropBake(S);
        if (S.merger) { try { S.merger.dispose(); } catch (e) { issue('merger dispose: ' + errText(e)); } }
        if (S.group && S.group.parent) S.group.parent.remove(S.group);
      });
      I3 = {};
      disposeSystems();
      if (env) { try { env.dispose(); } catch (e) { issue('env dispose: ' + errText(e)); } env = null; }    /* a v2 env takes its city and life with it */
      disposeLayers();
      riseFx = null; dance = null; encoreLock = null;
    }
    function dispose() {
      if (dead) return;
      teardownContent();
      dead = true;
      timers.slice().forEach(function (id) { clearTimeout(id); });
      timers.length = 0;
      try { if (root.document && root.document.removeEventListener) { root.document.removeEventListener('pointerdown', onPress, true); root.document.removeEventListener('keydown', onPress, true); } } catch (e) {}
      var di = DEBUG.listeners.indexOf(onDebugGrid);
      if (di >= 0) DEBUG.listeners.splice(di, 1);
      if (unsubQ) { try { unsubQ(); } catch (e) {} unsubQ = null; }
      if (controls) { controls.dispose(); controls = null; }
      if (rig) { rig.dispose(); rig = null; }
      clearAnchors();
      hideBubble();
      if (camctlEl) { camctlEl.removeEventListener('click', onCamClick); camctlEl.removeEventListener('keydown', onCamKey); }
      if (srEl) { srEl.removeEventListener('click', onSrClick); srEl.removeEventListener('focusin', onSrFocus); srEl.removeEventListener('focusout', onSrBlur); }
      if (lease) { try { lease.release(); } catch (e) {} lease = null; }
      if (scene) { scene.clear(); scene = null; }
      if (container && container.parentNode) container.parentNode.removeChild(container);
      container = canvas = anchorsEl = ringEl = camctlEl = srEl = null;
    }

    /* ================================================================
       BOOT
       ================================================================ */
    try {
      buildDom();
      buildScene();
      takeLease();
      buildEnv();
      buildSystems();
      wireAnchors();
      userModels();
      placeCanvas();
      markTier();
      if (queryGrid()) DEBUG.grid = true;
      DEBUG.listeners.push(onDebugGrid);
      if (!CamApi || typeof CamApi.Rig !== 'function') throw new Error('camera.js missing');
      rig = new CamApi.Rig({ grid: Gr, motion: Mo, reduced: reduced, land: ['home'], aspect: 16 / 9, profile: v3 ? 'v3' : undefined });
      rig.update(0); rig.apply(camera);
      if (v3) {
        buildTravel();                                      /* after the rig, the sky and the actors (W4.2b) */
        V3.introPending = !!(V3.travel && wantIntro && !reduced);
        xcall('edit', 'prewarm');                           /* D60: the transparent ghost program compiles at mount */
      }
      controls = CamApi.Controls(canvas, rig, {
        press: onPress, tap: onTap, longPress: onLongPress, hold: onHold, dragStart: onDragStart, drag: onDrag, dragEnd: onDragEnd,
        camera: afterCamera,
        /* a finger on the glass holds the hero shot still (the tap picks what was seen); a wheel or a
           key hands it back at once, and so does lifting the finger */
        input: function (kind) {
          if (lease) lease.input();
          if (rig) { if (kind === 'press') rig.freeze(true); else rig.interrupt(); }
        },
        up: function () { if (rig) { rig.freeze(false); rig.interrupt(); wake(); } },
        error: function (e) { issue('pointer: ' + errText(e)); }
      });
      if (typeof SL3D.onQuality === 'function') {
        unsubQ = SL3D.onQuality(function (q) {
          xcall('fx', 'setQuality', q);
          xcall('actors', 'setQuality', q);
          xcall('edit', 'setQuality', q);
          qualityItems(q);
        });
      }
      qualityItems(SL3D.quality);
      lease.start();
    } catch (e) {
      fail('mount: ' + errText(e));
    }

    /* ---------------- the public stage ---------------- */
    stage.attach = guard('attach', attach, function () { return stage; });
    stage.sync = guard('sync', function (v) { syncView(v); return stage; }, function () { return stage; });
    stage.act = guard('act', act, noP);
    stage.emote = guard('emote', function (target, kind) { if (target != null) localEmote(String(target), kind || null); wake(); });
    stage.setLit = guard('setLit', function (uid, v) { return setLitInternal(uid, v, true); }, noP);
    stage.unlockLand = guard('unlockLand', unlockLand, noP);
    stage.debut = guard('debut', debut, noP);
    stage.storeFx = guard('storeFx', storeFx, noP);
    stage.showtime = guard('showtime', showtime, noP);
    stage.danceNow = guard('danceNow', function () { danceNow(); });
    stage.setAnchors = guard('setAnchors', function (list) { setAnchors(list); });
    /* R2 (QA2D-3): the boot is still going: no first frame yet, or the visited island's own display jobs are still
       queued (the host's HUD shows a calm not-ready state meanwhile). Cheap: no scene walk */
    stage.booting = guard('booting', function () {
      if (!readyFired) return true;
      if (!v3) return false;
      var vis = visitNow();
      for (var i = 0; i < V3.jobs.length; i++) if (V3.jobs[i].isle === vis && V3.jobs[i].kind !== 'prefetch') return true;
      return false;
    }, false);
    stage.focusItem = guard('focusItem', function (key) { focusItem(key); });
    stage.resetView = guard('resetView', function () { if (rig) { rig.reset(reduced); afterCamera(); } });
    stage.frameItem = guard('frameItem', function (uid) { frameItem(uid); showBubble('u:' + uid, nameOf(uid)); });
    stage.focusMe = guard('focusMe', focusMe, false);
    /* the kids update's care (P3.3) */
    stage.feed = guard('feed', feedPet, noP);
    stage.skipFeed = guard('skipFeed', skipFeed, false);
    stage.setPetStars = guard('setPetStars', setPetStars, 0);
    stage.placement = guard('placement', function (s) { placementState(s || null); wake(); });
    stage.setCovered = guard('setCovered', setCovered);
    stage.suspend = guard('suspend', suspend);
    stage.resume = guard('resume', resume);
    stage.setReduced = guard('setReduced', setReduced);
    stage.setUser = guard('setUser', setUser);
    /* v3 travel (SLIslesTravel): resolve false when superseded, without travel, or on the v2 scene */
    stage.visitIsle = v3 ? guard('visitIsle', visitIsle, noP) : noP;
    stage.unlockIsle = v3 ? guard('unlockIsle', unlockIsle, noP) : noP;
    stage.skyMap = v3 ? guard('skyMap', skyMapOn, noP) : noP;
    stage.overview = stage.skyMap;                        /* host-ui's name for the Sky map */
    stage.skip = v3 ? guard('skip', function () { return V3.travel ? V3.travel.skip() : false; }, false) : function () { return false; };
    stage.info = function () { try { return info(); } catch (e) { return { failed: failed || errText(e) }; } };
    stage.dispose = function () { var i = LIVE.indexOf(stage); if (i >= 0) LIVE.splice(i, 1); try { dispose(); } catch (e) { dead = true; } };
    Object.defineProperty(stage, 'element', { get: function () { return container; } });
    Object.defineProperty(stage, 'failed', { get: function () { return failed; } });
    LIVE.push(stage);
    return stage;
  }

  /* a stage that does nothing (3D unavailable): every call is safe */
  function stubStage(stage, kill, why) {
    if (typeof why === 'function') Object.defineProperty(stage, 'failed', { get: why });
    var noP = function () { return resolved(false); }, self = function () { return stage; }, nop = function () {};
    ['act', 'setLit', 'unlockLand', 'debut', 'storeFx', 'showtime', 'visitIsle', 'unlockIsle', 'skyMap', 'overview'].forEach(function (k) { stage[k] = noP; });
    stage.skip = function () { return false; };
    stage.focusMe = function () { return false; };
    stage.booting = function () { return false; };
    stage.feed = noP; stage.skipFeed = function () { return false; }; stage.setPetStars = function () { return 0; };
    ['attach', 'sync'].forEach(function (k) { stage[k] = self; });
    ['emote', 'danceNow', 'setAnchors', 'focusItem', 'resetView', 'frameItem', 'placement', 'setCovered', 'suspend', 'resume', 'setReduced', 'setUser'].forEach(function (k) { stage[k] = nop; });
    stage.info = function () { return { failed: true }; };
    stage.dispose = function () { kill(); };
    return stage;
  }

  /* ================================================================
     BUILT-IN FALLBACK: FX — pooled sprites (sparkle atlas), halos, ground decals
     ================================================================ */
  var FX_PRESETS = {
    sparkle: { n: 8, life: [0.55, 0.95], speed: [0.6, 1.4], up: 0.9, g: -1.2, size: [0.12, 0.2], cells: ['sparkle', 'star', 'diamond'], cols: ['Star Gold', 'Cloud White', 'Neon Pink', 'Holo Blue'], spin: 2 },
    glint: { n: 1, life: [0.45, 0.6], speed: [0, 0.05], up: 0, g: 0, size: [0.16, 0.22], cells: ['sparkle'], cols: ['Gold Light'], spin: 1.5 },
    heart: { n: 1, life: [1.0, 1.2], speed: [0.05, 0.15], up: 0.65, g: 0, size: [0.22, 0.26], cells: ['heart'], cols: ['Neon Pink', 'Bubblegum'], wobble: 0.08 },
    note: { n: 1, life: [1.0, 1.2], speed: [0.05, 0.15], up: 0.65, g: 0, size: [0.2, 0.24], cells: ['note'], cols: ['Neon Violet', 'Neon Cyan'], wobble: 0.08 },
    star: { n: 1, life: [1.0, 1.2], speed: [0.05, 0.15], up: 0.65, g: 0, size: [0.22, 0.26], cells: ['star'], cols: ['Star Gold'], wobble: 0.08 },
    dust: { n: 6, life: [0.4, 0.55], speed: [0.6, 0.9], up: 0.12, g: 0, size: [0.14, 0.2], grow: 1.6, cells: ['puff'], cols: ['Cloud White', 'Pebble'], ring: true, drag: 3 },
    bubble: { n: 4, life: [1.8, 2.6], speed: [0.05, 0.2], up: 0.75, g: 0, size: [0.1, 0.18], cells: ['bubble'], cols: ['Holo Pink', 'Holo Blue', 'Holo Mint', 'Holo Lemon'], wobble: 0.12, track: true },
    splash: { n: 1, life: [0.55, 0.7], speed: [0, 0], up: 0, g: 0, size: [0.25, 0.3], grow: 3, cells: ['ring'], cols: ['Foam'] },
    sparkleRing: { n: 12, life: [0.7, 0.85], speed: [1.0, 1.2], up: 0.2, g: 0, size: [0.12, 0.16], cells: ['sparkle'], cols: ['Star Gold', 'Neon Cyan', 'Neon Pink'], ring: true, drag: 1.5 },
    firework: { n: 18, life: [0.9, 1.3], speed: [1.4, 2.0], up: 0, g: -1.6, size: [0.14, 0.2], cells: ['sparkle', 'star'], cols: ['Neon Pink', 'Neon Cyan', 'Neon Violet', 'Star Gold'], sphere: true, drag: 1.2 },
    confetti: { n: 24, life: [2.0, 2.8], speed: [1.5, 2.6], up: 2.2, g: -3, size: [0.1, 0.16], cells: ['rect', 'heart', 'star', 'curl'], cols: ['Neon Pink', 'Neon Cyan', 'Star Gold', 'Neon Violet', 'Neon Lime'], member: 0.4, spin: 6, drag: 1.4 },
    exhaust: { n: 1, life: [0.5, 0.7], speed: [0.2, 0.35], up: 0.25, g: 0, size: [0.12, 0.16], grow: 1.8, cells: ['puff'], cols: ['Holo Pink', 'Holo Blue', 'Holo Lemon'] },
    petal: { n: 1, life: [2.6, 3.4], speed: [0.05, 0.15], up: -0.25, g: 0, size: [0.07, 0.1], cells: ['petal'], cols: ['Holo Pink'], wobble: 0.25, spin: 1.2 },
    snow: { n: 1, life: [1.4, 2.0], speed: [0.02, 0.08], up: 0.05, g: 0, size: [0.07, 0.11], cells: ['snow'], cols: ['Cloud White'], wobble: 0.06 },
    flight: { n: 1, life: [0.5, 0.5], speed: [0, 0], up: 0, g: 0, size: [0.26, 0.26], cells: ['sparkle'], cols: ['Star Gold'], spin: 4 }
  };
  FX_PRESETS.emote = FX_PRESETS.heart;
  function MiniFx(h) {
    var K = h.K, T = h.THREE, budget = h.budget || {};
    this.h = h; this.K = K; this.T = T;
    this.reduced = !!h.reduced;
    this.cap = Math.max(32, Math.min(512, budget.particles || 256));
    this.scale = (h.quality && h.quality.particleScale) || 1;
    this.pool = K.billboards({ capacity: this.cap, texture: 'sparkles', additive: true, name: 'fx:sprites' });
    this.halos = K.billboards({ capacity: 48, texture: 'halo', additive: true, show: true, name: 'fx:halos', renderOrder: 4 });
    h.group.add(this.pool.mesh, this.halos.mesh);
    var N = this.cap;
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.vx = new Float32Array(N); this.vy = new Float32Array(N); this.vz = new Float32Array(N);
    this.age = new Float32Array(N); this.life = new Float32Array(N); this.size = new Float32Array(N);
    this.grow = new Float32Array(N); this.g = new Float32Array(N); this.drag = new Float32Array(N);
    this.rot = new Float32Array(N); this.spin = new Float32Array(N); this.wob = new Float32Array(N);
    this.cell = new Uint8Array(N); this.slot = new Int16Array(N); this.mode = new Uint8Array(N);
    this.seed = new Uint32Array(N); this.delay = new Float32Array(N);
    this.ox = new Float32Array(N); this.oy = new Float32Array(N); this.oz = new Float32Array(N);
    this.tx = new Float32Array(N); this.ty = new Float32Array(N); this.tz = new Float32Array(N);
    this.n = 0;
    this.haloKeys = {};
    /* ground light pools */
    var dGeo = new T.PlaneGeometry(1, 1);
    dGeo.rotateX(-Math.PI / 2);
    this.dGeo = dGeo;
    this.dMat = new T.MeshBasicMaterial({ map: K.tex.halo(), transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.decals = new T.InstancedMesh(dGeo, this.dMat, 24);
    this.decals.instanceColor = new T.InstancedBufferAttribute(new Float32Array(24 * 3).fill(1), 3);
    this.decals.count = 0; this.decals.frustumCulled = false; this.decals.renderOrder = 1; this.decals.name = 'fx:decals';
    this.decalKeys = []; this.decalPos = [];
    h.group.add(this.decals);
    this._m = new T.Matrix4(); this._c = new T.Color(); this._b = { bubble: {} }; this._pop = { x: 0, y: 0, z: 0 };
    this.colCache = {};
    this.member = null;
    this.setMember(typeof h.member === 'function' ? h.member() : h.member);
  }
  var FP = MiniFx.prototype;
  FP._rand = function () { return Math.random(); };
  FP.setMember = function (hex) { this.member = typeof hex === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? hex : null; };
  FP._col = function (tok) {
    var K = this.K;
    if (tok === '@member') {
      var hx = this.member;
      if (hx) { if (!this.colCache[hx]) this.colCache[hx] = K.rgb(hx); return this.colCache[hx]; }
      tok = 'Bubblegum';
    }
    if (typeof tok === 'string' && /^#[0-9a-f]{3,6}$/i.test(tok)) { if (!this.colCache[tok]) this.colCache[tok] = K.rgb(tok); return this.colCache[tok]; }
    return tok;
  };
  FP.emit = function (kind, pos, n, o) {
    o = o || {};
    var P = FX_PRESETS[kind] || FX_PRESETS.sparkle, ATL = this.K.ATLAS || {};
    if (kind === 'emote') P = FX_PRESETS[['star', 'note', 'star'][Math.floor(this._rand() * 3)]];   /* hearts: the finger-heart only */
    var count = Math.max(1, Math.round((n == null ? P.n : n) * (kind === 'confetti' || kind === 'firework' ? this.scale : 1)));
    if (o.max && count > o.max) count = o.max;
    var red = this.reduced, M = this.h.motion;
    for (var i = 0; i < count; i++) {
      var s = this.pool.alloc();
      if (s < 0) return;
      var k = this.n++;
      var a = this._rand() * Math.PI * 2, el = P.sphere ? (this._rand() - 0.5) * Math.PI : 0;
      var sp = P.speed[0] + this._rand() * (P.speed[1] - P.speed[0]);
      var ringR = o.radius || o.r || 0;
      if (P.ring) a = (i / count) * Math.PI * 2 + this._rand() * 0.3;
      this.slot[k] = s;
      this.px[k] = pos.x + (P.ring ? Math.cos(a) * ringR * 0.5 : 0);
      this.py[k] = pos.y;
      this.pz[k] = pos.z + (P.ring ? Math.sin(a) * ringR * 0.5 : 0);
      this.vx[k] = red ? 0 : Math.cos(a) * Math.cos(el) * sp;
      this.vz[k] = red ? 0 : Math.sin(a) * Math.cos(el) * sp;
      this.vy[k] = red ? 0 : (P.sphere ? Math.sin(el) * sp : 0) + P.up * (0.7 + 0.6 * this._rand());
      this.age[k] = 0;
      this.life[k] = red ? 0.4 : P.life[0] + this._rand() * (P.life[1] - P.life[0]);
      this.size[k] = (o.size || (P.size[0] + this._rand() * (P.size[1] - P.size[0])));
      this.grow[k] = red ? 1 : (P.grow || 1);
      this.g[k] = red ? 0 : P.g; this.drag[k] = P.drag || 0;
      this.rot[k] = this._rand() * Math.PI * 2; this.spin[k] = red ? 0 : (P.spin || 0) * (this._rand() - 0.5) * 2;
      this.wob[k] = red ? 0 : (P.wobble || 0);
      var cellName = o.cell || P.cells[Math.floor(this._rand() * P.cells.length)];
      this.cell[k] = ATL[cellName] != null ? ATL[cellName] : 0;
      this.mode[k] = kind === 'flight' && o.to ? 2 : (P.track && o.seed != null && M && typeof M.bubbleTrack === 'function' ? 1 : 0);
      this.seed[k] = (o.seed != null ? (o.seed >>> 0) + i * 2654435761 : 0) >>> 0;
      this.delay[k] = o.delay || 0;
      this.ox[k] = pos.x; this.oy[k] = pos.y; this.oz[k] = pos.z;
      if (this.mode[k] === 1) this.life[k] = 3;          /* SLMotion.bubbleTrack decides when it pops */
      if (this.mode[k] === 2) { this.tx[k] = o.to.x; this.ty[k] = o.to.y; this.tz[k] = o.to.z; this.life[k] = (o.dur || 0.5) + this.delay[k]; }
      var cols = Array.isArray(o.tokens) && o.tokens.length ? o.tokens : P.cols;
      var tok = o.token || o.color || (P.member && this._rand() < P.member ? '@member' : cols[Math.floor(this._rand() * cols.length)]);
      this.pool.set(s, this.px[k], this.py[k], this.pz[k], 0, this._col(tok), 0, this.cell[k], this.rot[k]);
    }
  };
  FP.update = function (dt) {
    var M = this.h.motion, i = 0, b = this._b.bubble;
    while (i < this.n) {
      var age = this.age[i] + dt;
      if (age >= this.life[i]) {
        this.pool.free(this.slot[i]);
        var j = --this.n;
        if (i !== j) this._copy(j, i);
        continue;
      }
      this.age[i] = age;
      var u = age / this.life[i], x, y, z;
      if (this.mode[i] === 1) {
        M.bubbleTrack(age, this.seed[i], b);
        if (b.popped) {                                    /* pop with a little sparkle */
          this._pop.x = this.px[i]; this._pop.y = this.py[i]; this._pop.z = this.pz[i];
          this.age[i] = this.life[i];
          if (!this.reduced) this.emit('glint', this._pop, 1);
          continue;
        }
        x = this.ox[i] + b.x; y = this.oy[i] + b.y; z = this.oz[i] + b.z;
        this.px[i] = x; this.py[i] = y; this.pz[i] = z;
        this.pool.set(this.slot[i], x, y, z, b.r > 0 ? b.r * 2.6 : this.size[i], null, Math.min(1, b.a * 2), this.cell[i], 0);
        i++;
        continue;
      }
      if (this.mode[i] === 2) {
        var f = Math.max(0, Math.min(1, (age - this.delay[i]) / Math.max(0.01, this.life[i] - this.delay[i])));
        var e = 1 - (1 - f) * (1 - f);
        x = this.ox[i] + (this.tx[i] - this.ox[i]) * e; y = this.oy[i] + (this.ty[i] - this.oy[i]) * e + Math.sin(Math.PI * f) * 0.6; z = this.oz[i] + (this.tz[i] - this.oz[i]) * e;
        this.rot[i] += this.spin[i] * dt;
        this.pool.set(this.slot[i], x, y, z, this.size[i] * (1 - 0.5 * f), null, age < this.delay[i] ? 0 : 1, this.cell[i], this.rot[i]);
        i++;
        continue;
      }
      var dr = this.drag[i] ? Math.exp(-this.drag[i] * dt) : 1;
      this.vx[i] *= dr; this.vz[i] *= dr; this.vy[i] = this.vy[i] * dr + this.g[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      x = this.px[i]; y = this.py[i]; z = this.pz[i];
      if (this.wob[i]) { x += Math.sin(age * 5 + i) * this.wob[i]; z += Math.cos(age * 4 + i * 1.7) * this.wob[i] * 0.6; }
      var alpha = u < 0.08 ? u / 0.08 : u > 0.65 ? (1 - u) / 0.35 : 1;
      var size = this.size[i] * (1 + (this.grow[i] - 1) * u);
      this.pool.set(this.slot[i], x, y, z, size, null, alpha, this.cell[i], this.rot[i]);
      i++;
    }
    this.pool.commit();
    this.halos.commit();
    return this.n > 0;
  };
  var FX_FIELDS = ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 'size', 'grow', 'g', 'drag', 'rot', 'spin', 'wob',
    'cell', 'slot', 'mode', 'seed', 'delay', 'ox', 'oy', 'oz', 'tx', 'ty', 'tz'];
  FP._copy = function (j, i) {
    for (var k = 0; k < FX_FIELDS.length; k++) this[FX_FIELDS[k]][i] = this[FX_FIELDS[k]][j];
  };
  FP.halo = function (key, onOff, pos, size, token) {
    var s = this.haloKeys[key];
    if (!onOff) { if (s != null) { this.halos.free(s); delete this.haloKeys[key]; } return; }
    if (s == null) { s = this.halos.alloc(); if (s < 0) return; this.haloKeys[key] = s; }
    this.halos.set(s, pos.x, pos.y, pos.z, size || 0.9, this._col(token || 'Lamp Halo'), 0.9, 0, 0);
  };
  FP.decal = function (key, onOff, pos, token) {
    var i = this.decalKeys.indexOf(key), D = this.decals;
    if (!onOff) {
      if (i < 0) return;
      var last = this.decalKeys.length - 1;
      if (i !== last) {
        this.decalKeys[i] = this.decalKeys[last]; this.decalPos[i] = this.decalPos[last];
        D.getMatrixAt(last, this._m); D.setMatrixAt(i, this._m);
        D.getColorAt(last, this._c); D.setColorAt(i, this._c);
      }
      this.decalKeys.length = last; this.decalPos.length = last;
      D.count = last;
      D.instanceMatrix.needsUpdate = true; D.instanceColor.needsUpdate = true;
      return;
    }
    if (i < 0) { if (this.decalKeys.length >= 24) return; i = this.decalKeys.length; this.decalKeys.push(key); this.decalPos.push(null); }
    var r = 1.4;
    this._m.makeScale(r, 1, r).setPosition(pos.x, pos.y + 0.015, pos.z);
    D.setMatrixAt(i, this._m);
    var c = this._col(token || 'Lamp Warm');
    this._c.copy(c && c.isColor ? c : this.K.col(c));
    D.setColorAt(i, this._c);
    D.count = this.decalKeys.length;
    D.instanceMatrix.needsUpdate = true; D.instanceColor.needsUpdate = true;
  };
  FP.info = function () { return { particles: this.n, cap: this.cap, halos: Object.keys(this.haloKeys).length, decals: this.decalKeys.length }; };
  FP.setReduced = function (on) { this.reduced = !!on; };
  FP.setQuality = function (q) { if (q && q.particleScale) this.scale = q.particleScale; };
  FP.clear = function () {
    for (var i = 0; i < this.n; i++) this.pool.free(this.slot[i]);
    this.n = 0;
    this.pool.commit();
  };
  FP.dispose = function () {
    this.pool.dispose(); this.halos.dispose();
    if (this.decals.parent) this.decals.parent.remove(this.decals);
    this.decals.dispose(); this.dGeo.dispose(); this.dMat.dispose();
    this.n = 0;
  };

  /* ================================================================
     BUILT-IN FALLBACK: EDIT — rounded cell overlay + the lifted, wobbling ghost
     ================================================================ */
  var CELL_VERT = [
    'attribute vec3 aEdge;',
    'attribute vec4 aStyle;',
    'varying vec2 vUv;',
    'varying vec3 vFill;',
    'varying vec3 vEdge;',
    'varying vec4 vStyle;',
    'void main() {',
    '  vUv = uv;',
    '#ifdef USE_INSTANCING_COLOR',
    '  vFill = instanceColor;',
    '#else',
    '  vFill = vec3(1.0);',
    '#endif',
    '  vEdge = aEdge; vStyle = aStyle;',
    '  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');
  var CELL_FRAG = [
    'uniform float uTime;',
    'uniform float uFade;',
    'varying vec2 vUv;',
    'varying vec3 vFill;',
    'varying vec3 vEdge;',
    'varying vec4 vStyle;',
    'float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'void main() {',
    '  vec2 p = vUv - 0.5;',
    '  float d = sdRound(p, vec2(0.46), 0.12);',
    '  if (d > 0.0) discard;',
    '  float edge = 1.0 - smoothstep(0.03, 0.05, -d);',
    '  float dash = 1.0;',
    '  if (vStyle.z > 0.5) { float s = abs(p.x) > abs(p.y) ? p.y : p.x; dash = step(0.45, fract(s * 6.0 + 0.25)); }',
    '  float pulse = vStyle.w > 0.5 ? 0.72 + 0.28 * sin(uTime * 9.42478) : 1.0;',   /* 1.5 Hz */
    '  float a = mix(vStyle.x, vStyle.y * dash, edge) * pulse * uFade;',
    '  if (a < 0.01) discard;',
    '  gl_FragColor = vec4(mix(vFill, vEdge, edge), a);',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');
  var MINI_WASH = 0.07, MINI_FADE = 0.2;          /* = SLEdit3D GRID_WASH / FADE_SEC */
  function MiniEdit(h) {
    var K = h.K, T = h.THREE;
    this.h = h; this.K = K; this.T = T;
    this.reduced = !!h.reduced;
    var CAP = 160;
    this.cap = CAP;
    var geo = new T.PlaneGeometry(0.98, 0.98);
    geo.rotateX(-Math.PI / 2);
    this.edge = new T.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    this.style = new T.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
    geo.setAttribute('aEdge', this.edge);
    geo.setAttribute('aStyle', this.style);
    this.geo = geo;
    this.uni = { uTime: { value: 0 }, uFade: { value: 1 } };
    this.fadeT = MINI_FADE;
    this.mat = new T.ShaderMaterial({
      uniforms: this.uni, vertexShader: CELL_VERT, fragmentShader: CELL_FRAG,
      transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    this.cells = new T.InstancedMesh(geo, this.mat, CAP);
    this.cells.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
    this.cells.count = 0; this.cells.frustumCulled = false; this.cells.renderOrder = 3; this.cells.name = 'edit:cells';
    this.cells.visible = false;
    h.group.add(this.cells);
    this.ghost = null; this.ghostKey = ''; this.ghostBoxV = null; this.ghostMats = []; this.ghostOn = false;
    this.blob = K.blobs(1); this.blob.mesh.visible = false; h.group.add(this.blob.mesh);
    this.ok = true; this.t = 0; this.pulsing = false; this.wobbled = true;
    this._m = new T.Matrix4(); this._c = new T.Color(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._p = new T.Vector3(); this._s = new T.Vector3(1, 1, 1);
    this.cols = {};
  }
  var EP = MiniEdit.prototype;
  EP._colOf = function (tok) { if (!this.cols[tok]) this.cols[tok] = this.K.col(tok); return this.cols[tok]; };
  EP._cell = function (i, c, r, y, fill, fillA, edge, edgeA, dashed, pulse) {
    this._m.makeTranslation(c - 7.5, y, r - 4.5);
    this.cells.setMatrixAt(i, this._m);
    this.cells.setColorAt(i, this._colOf(fill));
    var e = this._colOf(edge);
    this.edge.array[i * 3] = e.r; this.edge.array[i * 3 + 1] = e.g; this.edge.array[i * 3 + 2] = e.b;
    var s = this.style.array;
    s[i * 4] = fillA; s[i * 4 + 1] = edgeA; s[i * 4 + 2] = dashed ? 1 : 0; s[i * 4 + 3] = pulse ? 1 : 0;
  };
  EP.setState = function (s) {
    s = s || {};
    var G = this.h.grid, C = this.h.core, L = this.h.look, E = (L && L.EDIT) || {};
    var mode = s.mode === 'edit' || s.mode === 'place' ? s.mode : 'play';
    var land = s.land || {}, keys = Object.keys(land), pl = s.placing, n = 0, i;
    var gridA = (E.grid && E.grid.opacity) || 0.55, wasShown = this.cells.visible;
    var special = {};
    if (mode === 'place' && pl) {
      var it = C.item(pl.id) || {};
      var cells = Array.isArray(pl.cells) && pl.cells.length ? pl.cells : (C.fpCells ? C.fpCells(it, pl.x | 0, pl.y | 0) : []);
      var ent = Array.isArray(pl.entrance) ? pl.entrance : (C.entranceCells ? C.entranceCells(it, pl.x | 0, pl.y | 0) : []);
      ent.forEach(function (k) { special[k] = 'ent'; });
      cells.forEach(function (k) { special[k] = pl.ok ? 'ok' : 'bad'; });
    }
    if (mode !== 'play' || s.grid) {
      /* the dashed squares lie flush on the pads (+ 0.012) over a faint Cloud White wash */
      for (i = 0; i < keys.length && n < this.cap; i++) {
        if (special[keys[i]]) continue;
        var p = G.parseKey(keys[i]);
        this._cell(n++, p.c, p.r, G.surfaceY(p.c, p.r) + 0.012, 'Cloud White', MINI_WASH, 'Cloud White', gridA, true, false);
      }
      var self = this;
      Object.keys(special).forEach(function (k) {
        if (n >= self.cap) return;
        var q = G.parseKey(k);
        if (!G.inGrid(q.c, q.r)) return;
        var y = (land[k] ? G.surfaceY(q.c, q.r) : 0) + 0.016;
        var kind = special[k];
        if (kind === 'ok') self._cell(n++, q.c, q.r, y, (E.valid && E.valid.token) || 'Success', (E.valid && E.valid.opacity) || 0.45, (E.valid && E.valid.edge) || 'Neon Cyan', 0.95, false, false);
        else if (kind === 'bad') self._cell(n++, q.c, q.r, y, (E.invalid && E.invalid.token) || 'Error', (E.invalid && E.invalid.opacity) || 0.42, (E.invalid && E.invalid.token) || 'Error', 0.9, false, true);
        else self._cell(n++, q.c, q.r, y, (E.entrance && E.entrance.token) || 'Star Gold', (E.entrance && E.entrance.opacity) || 0.25, (E.entrance && E.entrance.token) || 'Star Gold', 0.7, false, false);
      });
    }
    this.pulsing = mode === 'place' && !!pl && !pl.ok;
    this.cells.count = n;
    this.cells.visible = n > 0;
    if (n > 0 && !wasShown) { this.fadeT = this.reduced ? MINI_FADE : 0; this.uni.uFade.value = this.reduced ? 1 : 0; }
    this.cells.instanceMatrix.needsUpdate = true;
    if (this.cells.instanceColor) this.cells.instanceColor.needsUpdate = true;
    this.edge.needsUpdate = true; this.style.needsUpdate = true;
    this._ghost(mode === 'place' ? s.ghost : null, pl);
  };
  EP._ghost = function (g, pl) {
    var K = this.K, G = this.h.grid, E = (this.h.look && this.h.look.EDIT && this.h.look.EDIT.ghost) || {};
    var key = g && pl ? g.id + '#' + g.stateKey : '';
    if (key !== this.ghostKey) {
      if (this.ghost) { this.ghost.dispose(); this.ghost = null; }
      this.ghostKey = key;
      if (key && g.template) {
        var mats = this.ghostMats, patch = { transparent: true, opacity: E.opacity || 0.85, depthWrite: false };
        this.ghost = K.batch(g.template, {
          outlines: false, castShadow: false,
          material: function (matKey) {
            if (/^glow:/.test(matKey) || /^outline/.test(matKey)) return null;
            var v = K.variant(matKey, 'ghost', patch);
            if (mats.indexOf(v) < 0) mats.push(v);
            return v;
          }
        });
        this.h.group.add(this.ghost.group);
      }
    }
    if (!this.ghost || !pl) { this.blob.mesh.visible = false; this.ghostBoxV = null; this.ghostOn = false; return; }
    this.ghostOn = true;
    var it = this.h.core.item(pl.id) || {}, fp = it.fp || [1, 1], x = pl.x | 0, y = pl.y | 0;
    var lift = E.lift || 0.25, by = 0;
    try { by = G.baseY(pl.id, x, y); } catch (e) { by = 0; }
    this.ghost.add('ghost', { x: x, y: y, fp: fp, baseY: by + lift });
    this.ghost.commit();
    this.ok = !!pl.ok;
    var op = this.ok ? (E.opacity || 0.85) : (E.invalidOpacity || 0.5);
    for (var i = 0; i < this.ghostMats.length; i++) this.ghostMats[i].opacity = op;
    var cx = x + fp[0] / 2 - 8, cz = y + fp[1] / 2 - 5, sh = E.shadow || 0.7;
    this.blob.set(0, cx, by, cz, fp[0] * 0.9 * sh, fp[1] * 0.9 * sh);
    this.blob.mesh.count = 1; this.blob.mesh.visible = true;
    this.blob.commit();
    var hb = null;
    try { hb = G.hitBox(pl.id, x, y); } catch (e) { hb = null; }
    this.ghostBoxV = hb ? { min: [hb.min[0], hb.min[1] + lift, hb.min[2]], max: [hb.max[0], hb.max[1] + lift, hb.max[2]] } : null;
  };
  EP.ghostBox = function () { return this.ghostBoxV; };
  EP.ghostShown = function () { return !!this.ghostOn; };
  EP.update = function (dt) {
    if (!this.reduced) this.t += dt;               /* reduced motion: no pulse, no wobble */
    this.uni.uTime.value = this.t;
    var busy = !this.reduced && this.pulsing && this.cells.visible;
    if (this.fadeT < MINI_FADE) {                  /* the grid's 0.2 s fade-in (a cut when reduced) */
      this.fadeT = this.reduced ? MINI_FADE : this.fadeT + dt;
      this.uni.uFade.value = Math.min(1, this.fadeT / MINI_FADE);
      if (this.fadeT < MINI_FADE) busy = true;
    }
    if (!this.ghost || !this.ghost.has('ghost')) return busy;
    if (this.reduced && !this.wobbled) return busy;
    var E = (this.h.look && this.h.look.EDIT && this.h.look.EDIT.ghost) || {};
    var deg = this.reduced ? 0 : (E.wobbleDeg || 4) * Math.sin(this.t * Math.PI * 2 * (E.wobbleRate || 3));
    var m = this.ghost.pivot('ghost', 'root');
    this._e.set(0, 0, deg * Math.PI / 180, 'XYZ');
    this._q.setFromEuler(this._e);
    this._p.set(0, 0, 0);
    m.compose(this._p, this._q, this._s);
    this.ghost.commit();
    this.wobbled = !this.reduced;              /* one last level write after reduced motion turns on */
    return !this.reduced || busy;
  };
  EP.setReduced = function (on) { this.reduced = !!on; if (this.reduced) { this.fadeT = MINI_FADE; this.uni.uFade.value = 1; } };
  EP.dispose = function () {
    if (this.ghost) { this.ghost.dispose(); this.ghost = null; }
    this.blob.dispose();
    if (this.cells.parent) this.cells.parent.remove(this.cells);
    this.cells.dispose(); this.geo.dispose(); this.mat.dispose();
  };

  /* ================================================================
     BUILT-IN FALLBACK: ACTORS — pet rigs and the avatar standing at free
     cells near the house (no wandering: that is actors.js / pets-brain.js)
     ================================================================ */
  function MiniActors(h) {
    this.h = h; this.K = h.K; this.T = h.THREE; this.SL3D = h.SL3D;
    this.reduced = !!h.reduced;
    this.pets = []; this.avatar = null; this.mode = 'play'; this.showK = 0; this.showtime = false;
    this.t = 0; this.danceT = -1; this.danceDur = 0;
    this.blobs = this.K.blobs(8);
    h.group.add(this.blobs.mesh);
    this._v = new this.T.Vector3();
    this.user = h.user || {};
    this.camPos = new this.T.Vector3();
    this.anchorFn = null;
  }
  var AP = MiniActors.prototype;
  function accSig(acc) { acc = acc || {}; return ['hat', 'neck', 'face', 'back'].map(function (k) { return acc[k] || '-'; }).join('|'); }
  AP._freeCells = function (v) {
    var C = this.h.core, G = this.h.grid, land = v.land || G.landFrom(v.unlocked || ['home']);
    var occ = {}, res = {};
    try { var o = C.occupancy({ placed: v.placed || [] }); occ = o.occ || {}; res = o.reserved || {}; } catch (e) { occ = {}; }
    var spot = G.avatarSpot ? G.avatarSpot(v.placed || []) : null;
    var origin = spot ? { c: spot.c, r: spot.r } : { c: 7, r: 5 };
    var out = Object.keys(land).filter(function (k) {
      if (occ[k] && occ[k].layer !== 'ground') return false;
      if (spot && k === spot.c + ',' + spot.r) return false;
      return true;
    }).map(function (k) { var p = G.parseKey(k); p.key = k; p.d = Math.abs(p.c - origin.c) + Math.abs(p.r - origin.r) + (res[k] ? 3 : 0); return p; });
    out.sort(function (a, b) { return a.d - b.d || a.r - b.r || a.c - b.c; });
    return out;
  };
  AP.sync = function (v) {
    v = v || {};
    var SL3D = this.SL3D, G = this.h.grid, tier = this.h.tier, self = this;
    this.mode = v.mode || this.mode;
    /* the avatar on the left entrance cell of the house */
    var spot = G.avatarSpot ? G.avatarSpot(v.placed || []) : null, av = v.avatar;
    var avSig = av ? (av.color || '') + '|' + (av.avatar || '') : '';
    if (this.avatar && (!spot || !av || this.avatar.sig !== avSig)) { this.avatar.rig.dispose(); this.avatar = null; }
    if (!this.avatar && spot && av && typeof SL3D.makeAvatar === 'function') {
      try {
        var rig = SL3D.makeAvatar({ color: av.color, emoji: av.avatar }, tier);
        this.h.group.add(rig.root);
        this.avatar = { rig: rig, sig: avSig, x: 0, y: 0, z: 0, waveT: -1, heartAt: -1 };
      } catch (e) { this.avatar = null; }
    }
    if (this.avatar && spot) { this.avatar.x = spot.x - 0.18; this.avatar.y = spot.y; this.avatar.z = spot.z; }
    /* pets */
    var want = (v.pets || []).filter(function (p) { return p && /^pet_/.test(p.id); });
    this.pets = this.pets.filter(function (p) {
      var keep = want.some(function (w) { return w.id === p.id && accSig(w.acc) === p.accSig; });
      if (!keep) p.rig.dispose();
      return keep;
    });
    var free = this._freeCells(v), used = {};
    this.pets.forEach(function (p) { if (free.some(function (f) { return f.key === p.cell; })) used[p.cell] = 1; else p.cell = null; });
    want.forEach(function (w, i) {
      var p = null;
      for (var j = 0; j < self.pets.length; j++) if (self.pets[j].id === w.id) p = self.pets[j];
      if (!p && typeof SL3D.makeRig === 'function') {
        try {
          var rg = SL3D.makeRig(w.id, w.acc || {}, tier);
          self.h.group.add(rg.root);
          p = { id: w.id, rig: rg, accSig: accSig(w.acc), cell: null, x: 0, y: 0, z: 0, yaw: 0, hopT: -1, active: false, perf: null, phase: (i * 0.37) % 1 };
          self.pets.push(p);
        } catch (e) { p = null; }
      }
      if (!p) return;
      p.active = !!w.active; p.name = w.name;
      if (!p.cell) {
        var pick = null;
        for (var k = i * 2; k < free.length && !pick; k++) if (!used[free[k].key]) pick = free[k];
        for (var k2 = 0; k2 < free.length && !pick; k2++) if (!used[free[k2].key]) pick = free[k2];
        if (pick) { used[pick.key] = 1; p.cell = pick.key; }
      }
      if (p.cell) {
        var q = G.parseKey(p.cell), ctr = G.cellCenter(q.c, q.r);
        p.x = ctr.x; p.y = G.surfaceY(q.c, q.r); p.z = ctr.z;
        p.yaw = ((q.c * 13 + q.r * 7) % 9 - 4) * 6;
      }
    });
  };
  AP.update = function (dt, t, ctx) {
    this.t += dt;
    var red = this.reduced, k = 0, cam = ctx && ctx.camera;
    if (cam) this.camPos.setFromMatrixPosition(cam.matrixWorld);
    var dancing = this.danceT >= 0;
    if (dancing) { this.danceT += dt; if (this.danceT >= this.danceDur) { this.danceT = -1; dancing = false; } }
    var opt = { reduced: red, bpm: 118, speed: 0, rate: 1 };
    for (var i = 0; i < this.pets.length; i++) {
      var p = this.pets[i], r = p.rig, y = p.y, yaw = p.yaw, pitch = 0;
      if (p.perf) {
        var pf = p.perf;
        pf.t += dt;
        var M = this.h.motion, o = pf.out;
        if (pf.t < pf.lead) {
          var u = pf.t / pf.lead;
          r.root.position.set(p.x + (pf.tx - p.x) * u, p.y + (pf.ty - p.y) * u + 0.25 * Math.sin(Math.PI * u), p.z + (pf.tz - p.z) * u);
          r.play('hop', (pf.t % 0.45), opt);
        } else if (M && pf.t < pf.end) {
          M.sample('bounce', pf.t, o, { lead: pf.lead, reduced: red });
          r.root.position.set(pf.tx, pf.ty + Math.max(0, o.petY || 0), pf.tz);
          r.play('jump', 0.1, opt);
          r.root.rotation.set((o.flip || 0) * Math.PI * 2, 0, 0);
          k = 1;
          continue;
        } else if (pf.t < pf.end + 0.6) {
          var w = (pf.t - pf.end) / 0.6;
          r.root.rotation.set(0, 0, 0);
          r.root.position.set(pf.tx + (p.x - pf.tx) * w, p.y + (pf.ty - p.y) * (1 - w) + 0.25 * Math.sin(Math.PI * w), pf.tz + (p.z - pf.tz) * w);
          r.play('hop', pf.t % 0.45, opt);
        } else { p.perf = null; r.root.rotation.set(0, 0, 0); }
        k = 1;
        if (p.perf) continue;
      }
      var clip = 'idle', ct = this.t + p.phase * 4;
      if (dancing) { clip = 'dance'; ct = this.danceT; }
      else if (this.mode !== 'play') clip = 'sit';
      else if (p.hopT >= 0) { p.hopT += dt; clip = 'hop'; ct = p.hopT; if (p.hopT > 0.45) p.hopT = -1; }
      if (cam && (dancing || this.mode === 'play')) {
        var face = Math.atan2(this.camPos.x - p.x, this.camPos.z - p.z) / Math.PI * 180;
        yaw = dancing ? face : face + p.yaw;            /* roughly toward the viewer, never in lockstep */
      }
      r.play(clip, ct, opt);
      r.root.position.set(p.x, y, p.z);
      r.root.rotation.set(pitch, yaw * Math.PI / 180, 0);
      if (typeof r.setShow === 'function') r.setShow(this.showK);
      if (!red || dancing || p.hopT >= 0) k = 1;
    }
    var A = this.avatar;
    if (A) {
      var ac = 'idle', at = this.t;
      if (dancing) { ac = 'dance'; at = this.danceT; }
      else if (A.waveT >= 0) { A.waveT += dt; ac = A.waveT < 0.9 ? 'wave' : 'cheer'; at = A.waveT; if (A.waveT >= 0.9 && A.heartAt < 0) { A.heartAt = this.t; this._v.set(A.x, A.y + 1.15, A.z + 0.1); this.h.emit('heart', this._v, 1, { token: 'Neon Pink', fingerHeart: true }); this.h.sfx('pop', 0.8, 0, A.x); } if (A.waveT > 1.5) A.waveT = -1; }
      A.rig.play(ac, at, opt);
      A.rig.root.position.set(A.x, A.y, A.z);
      if (cam) A.rig.root.rotation.set(0, Math.atan2(this.camPos.x - A.x, this.camPos.z - A.z) * 0.6, 0);
      if (typeof A.rig.setWand === 'function') A.rig.setWand(this.showK > 0.5 || dancing);
      if (typeof A.rig.setShow === 'function') A.rig.setShow(this.showK);
      if (!red || A.waveT >= 0) k = 1;
    }
    /* blob shadows */
    var n = 0, B = this.blobs;
    for (var j = 0; j < this.pets.length && n < 7; j++) {
      var pp = this.pets[j], rp = pp.rig.root.position, lift = Math.max(0, rp.y - pp.y), s = 0.42 * Math.max(0.5, 1 - lift * 0.6);
      B.set(n++, rp.x, pp.y, rp.z, s, s * 0.8);
    }
    if (A && n < 8) B.set(n++, A.x, A.y, A.z, 0.5, 0.42);
    B.mesh.count = n;
    B.commit();
    return !!k;
  };
  AP.pick = function (o, d) {
    var best = Infinity, tgt = null, i, R = (this.h.grid && this.h.grid.PET_HIT_R) || 0.4;
    for (i = 0; i < this.pets.length; i++) {
      var p = this.pets[i].rig.root.position, t = raySphere(o, d, p.x, p.y + 0.3, p.z, R);
      if (t >= 0 && t < best) { best = t; tgt = 'pet:' + this.pets[i].id; }
    }
    if (this.avatar) {
      var ta = raySphere(o, d, this.avatar.x, this.avatar.y + 0.45, this.avatar.z, 0.45);
      if (ta >= 0 && ta < best) { best = ta; tgt = 'me'; }
    }
    return tgt ? { target: tgt, t: best } : null;
  };
  AP.anchor = function (target, out) {
    out = out || new this.T.Vector3();
    if (target === 'me' || target === 'avatar') {
      if (!this.avatar) return null;
      return out.set(this.avatar.x, this.avatar.y + 1.15, this.avatar.z);
    }
    var id = String(target).replace(/^pet:/, '');
    for (var i = 0; i < this.pets.length; i++) if (this.pets[i].id === id) { var p = this.pets[i].rig.root.position; return out.set(p.x, p.y + 0.85, p.z); }
    return null;
  };
  AP.emote = function (target, kind) {
    if (target === 'me' || target === 'avatar') {
      if (this.avatar) { this.avatar.waveT = 0; this.avatar.heartAt = -1; }
      return;
    }
    var id = String(target).replace(/^pet:/, '');
    for (var i = 0; i < this.pets.length; i++) {
      var p = this.pets[i];
      if (p.id !== id) continue;
      p.hopT = 0;
      var pos = p.rig.root.position;
      this._v.set(pos.x + 0.12, pos.y + 0.8, pos.z + 0.1);
      this.h.emit(kind || 'emote', this._v, 1);
      if (id === 'pet_dragon') { this._v.y += 0.05; this.h.emit('sparkle', this._v, 6); }
    }
  };
  /* the active pet's id (else the first pet's), null with no pets: a.pets.active() names it */
  AP.active = function () {
    for (var i = 0; i < this.pets.length; i++) if (this.pets[i].active) return this.pets[i].id;
    return this.pets.length ? this.pets[0].id : null;
  };
  /* the trampoline: the active pet hops over, bounces with SLMotion 'bounce', hops back */
  AP.perform = function (kind, uid) {
    if (kind !== 'trampoline' || this.reduced) return 0;
    var p = null, i;
    for (i = 0; i < this.pets.length; i++) if (this.pets[i].active) p = this.pets[i];
    if (!p) p = this.pets[0];
    if (!p) return 0;
    var v = new this.T.Vector3();
    var seat = (this.anchorFn && this.anchorFn(uid, 'seat', v)) || this.h.itemPoint(uid, 'top', v);
    if (!seat) return 0;
    var M = this.h.motion, B = (M && M.BOUNCE) || { length: 2.2, maxLead: 1.2 };
    var dist = Math.hypot(seat.x - p.x, seat.z - p.z), lead = Math.max(0.4, Math.min(B.maxLead || 1.2, dist / 1.6));
    p.perf = { t: 0, lead: lead, end: lead + (B.length || 2.2), tx: seat.x, ty: seat.y, tz: seat.z, out: {} };
    return lead;
  };
  AP.dance = function (o) {
    o = o || {};
    var sec = (o.counts || 8) * 60 / (o.bpm || 118);
    this.danceT = 0; this.danceDur = this.reduced ? 1.2 : sec;
    return this.danceDur + 0.2;
  };
  AP.info = function () {
    return { pets: this.pets.map(function (p) { return { id: p.id, cell: p.cell, active: p.active }; }), avatar: !!this.avatar, dancing: this.danceT >= 0 };
  };
  AP.setShow = function (k) { this.showK = k; };
  /* live item anchors: the trampoline's 'seat' (the top when a model has none) */
  AP.setAnchorFn = function (fn) { this.anchorFn = typeof fn === 'function' ? fn : null; };
  AP.setShowtime = function (on) { this.showtime = !!on; };
  AP.setMusic = function () {};                      /* the built-in crew has no beat-nod */
  AP.setMode = function (m) { this.mode = m; };
  AP.setReduced = function (on) { this.reduced = !!on; };
  AP.setUser = function (u) { this.user = u || {}; };
  AP.dispose = function () {
    this.pets.forEach(function (p) { p.rig.dispose(); });
    this.pets = [];
    if (this.avatar) { this.avatar.rig.dispose(); this.avatar = null; }
    this.blobs.dispose();
  };

  /* ---------------- install + the pure exports ---------------- */
  if (HAS_DOM) install();

  return {
    VERSION: VERSION, OCCLUDE_U: OCCLUDE_U, DANCE_EVERY_BARS: DANCE_EVERY_BARS, DANCE_BPM: DANCE_BPM,
    normMode: normMode, batchKey: batchKey, diffPlaced: diffPlaced, litChanges: litChanges, rayBox: rayBox,
    choosePick: choosePick, dragTarget: dragTarget, itemLabel: itemLabel, petLabel: petLabel,
    nextDance: nextDance, modelAct: modelAct, toScreen: toScreen, FX_PRESETS: FX_PRESETS,
    rectDist: rectDist, TAG_PAD: TAG_PAD, NEAR_PX: NEAR_PX, NEAR_FRAC: NEAR_FRAC, placeSigns: placeSigns,
    /* Encore City: per-copy style, placement variety, auto-tiling, layer ownership, the QA grid */
    ENCORE_CAM: ENCORE_CAM, ENCORE_SEC: ENCORE_SEC, NO_JITTER: NO_JITTER,
    seedVariant: seedVariant, houseStyle: houseStyle, copyStyle: copyStyle, ghostUid: ghostUid, jitterFor: jitterFor, idNeighbours: idNeighbours,
    pathPieces: pathPieces, layerOwner: layerOwner, gridFromQuery: gridFromQuery, debugGrid: debugGrid,
    /* the v2 seams (CONTRACTS §9) */
    firstName: firstName, handleUser: handleUser, PATH_LAYOUTS: PATH_LAYOUTS, pathCopy: pathCopy, HEARTLESS: HEARTLESS,
    heartKind: heartKind, musicHeard: musicHeard, wakeShow: wakeShow, WAKE_TAIL: WAKE_TAIL,
    /* the sibling seams (tests/fix-seams.test.js); mount() itself, for the Node harness that injects
       a fake DOM, kit, lease and siblings through the same globals the browser uses */
    mount: mount, normUser: normUser, actorState: actorState, editState: editState, raySphere: raySphere, pickHits: pickHits,
    toPoint: toPoint, fxOpts: fxOpts, adaptSystem: adaptSystem, adaptActors: adaptActors, adaptEdit: adaptEdit,
    placementCells: placementCells,
    /* v3 (W4.2a) */
    ISLES3: ISLES3, SLICE_MS: SLICE_MS, HOLD_SEC: HOLD_SEC, isleLists: isleLists, routeHook: routeHook, nsOf: nsOf,
    /* the kids update (KU-CH12): Find me, and the character fields actorState passes through */
    focusMe: focusMeLive, focusMeOn: focusMeOn, CHAR_KEYS: CHAR_KEYS,
    /* the kids update's care (P3.3): moods, the memory stars, the feeding moment's timing */
    petMood: petMood, starsOf: starsOf, STAR_MAX: STAR_MAX, feedTiming: feedTiming, FEED_GRACE: FEED_GRACE, FEED_STILL: FEED_STILL, feedStill: feedStill,
    feedBrain: feedBrain, BUBBLE: BUBBLE, FEED_VIEWS: FEED_VIEWS, feedView: feedView
  };
}));
