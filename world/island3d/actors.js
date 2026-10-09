/* ================================================================
   My Island 3D — actors (island chunk 9; classic script, browser).
   Drives the chunk-8 rigs (SL3D.makeRig / makeAvatar) from the pure
   SLPetBrain: where each pet is and what it is doing becomes a blended
   pose (rig clips sampled through SL3D.petPose, crossfaded with mixPose),
   plus secondary motion, emotes, blob shadows and the avatar.
   THREE only ever comes from the kit (K.THREE). window.SLActors in the
   browser (and SL3D.makeActors(opts) once the stage is ready);
   module.exports in Node (create() runs against an injected kit).

   var actors = SLActors.create(K, SL3D, {scene, reduced, camera?, sound?, emit?, voice?, user?, seed?, tier?, itemPoint?})
     scene      the island scene: actors.group (rigs, avatar, blob shadows, emote sprites) is added to it
     camera     optional THREE camera (or setCamera later): pets and the avatar face it for looks,
                count 7 of the dance and the group pose (default: the +z default view)
     sound      optional SLSound instance (sound(name, vol, step, pan) + .pet); default SLSound.make({})
     emit       optional fx hook emit(kind, [x, y, z], n, {reduced, colors}) for sparkle bursts
                (fx3d); without it the actors' own 32-sprite pool draws them
     voice      false = tap() does not play the pet voice (when the caller plays it)
     user       optional {color, avatar | emoji}: the avatar until sync() passes one
     itemPoint  optional island hook itemPoint(uid, anchor) → {x, y, z}: the brain's live building
                anchors ('seat', 'roof') until setAnchorFn() gives another
   actors.sync(pets, avatar, world)
     pets       [{id, acc, active?, name?}]  (owned pet records + the active flag)
     avatar     {color, emoji | avatar} | null (no avatar) | undefined (keep)
     world      the SLWorldCore world, or the island view {placed, unlocked, mode, world?} —
                land / occupancy / layout for the brain; view.mode 'edit' | 'place' sits the pets
   actors.update(dt, t, show?, beat?) → animating
     show       the Showtime mix 0..1 (also settable with setShow)
     beat       the music beat clock: SLMusic.clock() {bpm, beat, playing?}, or the beat count
                (number); used to start the dance break on a bar line (SLMusic.clock() is read when
                absent), to nod to the beat and to pulse the headphone rings (both only while
                beat.playing / beat.music or setMusic(true))
   actors.perform(kind, uid) → lead seconds | -1   'trampoline' (run-over ≤ 1.2 s, 3 bounces,
                front flip, hop off — SLMotion 'bounce' timing) · 'bench' (walk, hop up, sit) ·
                the city buildings 'pose' (Photo Booth: sit · paw-point · cheer on the ticks) ·
                'sip' (Boba Café stool) · 'roof' (Rooftop Hangout) · 'studio' (Dance Studio: the whole
                crew, and the avatar at Showtime) · 'stage' (Concert Stage: the crew on the deck, the
                avatar centre stage) — see pets-brain.js PERFORMS
   actors.active() → active pet id | null       (what a.pets.active() reports)
   actors.petsApi = {active(), perform(kind, uid)}   ready to hand to model handles as a.pets
   actors.tap(target) → bool   a pet id ('pet:<id>' too): happy hop + voice + emote sprite
                (the dragon puffs sparkles, never fire); 'me' | 'avatar': the next tap emote —
                finger-heart (a neon line-heart + 'pop'), V-sign with a head tilt, mic-point
   actors.emote(target, kind)  target 'pet:<id>' | '<petId>' | 'me' | 'avatar' | 'pets' | 'all';
                kind 'note' | 'star' | 'sparkle' | 'rainbow' | 'hop' | 'happy' | 'wave' |
                'fingerHeart' | 'vSign' | 'micPoint' | 'cheer' | 'heart' (hearts belong to the
                avatar's finger-heart only: a pet's 'heart' shows a star)
   actors.dance(on) → seconds the dance break lasts (0 = none): gather ≤ 2 s near the house (or
                on a Dance Studio's floor), the 8-count at 118 BPM from the next bar, the freeze
                with the avatar's finger-heart and a sparkle burst, 'cheer'; reduced = one freeze
                pose with a sparkle fade
   actors.setShow(k) · setReduced(on) · setMode(mode) · setCamera(cam) · setMusic(on | null) ·
     setAnchorFn(fn(uid, name) → {x, y, z} | null)
   actors.hits(out) → [{kind: 'pet'|'me', id, x, y, z, r, pickable}]   picking spheres (0.4 u)
   actors.anchorOf(target, out) → {x, y, z} | null                     label / emote anchors
   actors.info() → {pets, avatar, calls, tris, isle} · actors.brain · actors.group · actors.dispose()

   MY ISLAND v3 (W3.7): opts.vox = true (SL3D.vox) or a registry R → rigs from R.makeRig /
   R.makeAvatar at CREW_SCALE (SLIslandLook, 1.2; opts.crewScale), blob shadows from K.vox.blobs,
   Home on the v3 terraces; without it everything is V4.54's.
   actors.follow({isle, flight, instant}) → seconds: the active pet crosses to that island (or home)
                along SLPetBrain.crossing — island to island via Home, a locked land keeps it home,
                LOW / reduced motion: it appears at the dock with one sparkle; the avatar goes to
                the dock (to the house on Home). actors.setIsle(isle): the same at once.
                actors.isleBrain · actors.isle. The pet is posed from the brain that hosts it, in
                that island's frame; perform(kind, uid) goes to the island the item is on.
   actors.poseScale(petId, sx, sy) (also petsApi.poseScale): the wobbly mirrors stretch the pet
                (x / z by sx, y by sy) while it performs; 1 again when its part ends and at once
                under reduced motion.

   THE CREW OF 14 (W3b.12; D97, D111, D112). Species come from the tables (SLIslandLook.SPECIES3,
   the clip layer's SPECIES; no hard-coded four): a mascot is posed as itself, its label sits at
   its SPECIES3 topY. sync() pet records may carry isle (a mascot's home land; else its catalogue
   isle) and fresh (adopted this page session).
     crew cap     at most BUDGETS.crewRigs rigs exist (SLTier; opts.crewRigs): the runner, every
                  fresh pet, then the rest in a rotation that moves on each time My Island opens
                  (in memory: one step per actors instance; opts.crewTurn pins it). The rest are
                  resting indoors (info().resting); rigs are made only for the pets shown.
     land guests  while a land is visited its brain also hosts up to BUDGETS.landMascots of that
                  land's own mascots (fresh ones first, then taking turns from visit to visit, in
                  memory), out of the same cap: they leave Home with one sparkle, come out near
                  the landmark's 'spot' with one sparkle when the camera arrives (visit.flight s,
                  or at once on setIsle(isle) for the island already visited: a skipped flight's
                  landing; at once under reduced motion), idle, play, answer taps, never perform,
                  and leave with one sparkle when the child goes. Home + the land ≤ crewRigs.
     play / tap   one pose per play move (catalogAdditions.crewMoves.play: dig flutter loaf tumble
                  stash glide follow prance bellyflop clap) and the 'rear' (pony) and 'clap' (seal
                  pup) tap flourishes, from the clips and the clip layer's pose helpers only
                  (rearUp, legsTuck, wingsFlap, pawsUp), nothing over 2 Hz; the crab's dig ends
                  in one 'dust' puff (fx3d through opts.emit). A V4.54 pet poses as before.

   MOTION (art bible v2 / island-architecture 'animation'): walk 1.0 u/s · trot, bunny 0.18 u
   hops, dragon 0.12 u flutter with 3 Hz wings (all from the rig clips, blended idle → walk → run
   by speed) · lean into turns, head leads the turn, tail and ears lag · cape streams with speed ·
   happy tail after a tap and at Showtime · idle actions every 4–8 s (brain: lean, look-back, a
   nod on the beat, …) · edit / place mode: still sitting · reduced motion: still poses, turn and
   emote only, static sprite fades, instant cuts.
   Avatar: a weight shift every 2.4 s, a glance at a pet every ~6 s, the Spark Stick at Showtime
   (swaying once per two beats, a 360° twirl over 1.2 s every 8 s), the tap emotes, its own dance
   moves, and up on the stage (or the studio floor at Showtime) when the crew performs there.
   Nothing flashes; sprites fade smoothly; per-frame work allocates nothing.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SLActors = api;
    if (root.SL3D && typeof root.SL3D.defineApi === 'function') api.register(root.SL3D);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
  var PETS = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];
  var TOP_Y = { pet_puppy: 0.72, pet_kitten: 0.72, pet_bunny: 0.88, pet_dragon: 0.75 };
  var SKY_ISLES = ['pier', 'jungle', 'treetop', 'castle', 'ice'];

  /* sibling modules: the page's globals, or (Node) the files beside this one */
  var NODE = typeof module === 'object' && !!module.exports, sibs = {};
  function sib(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function look() { return sib('SLIslandLook', '../world-look.js'); }
  /* a land mascot's row of SLIslandLook.SPECIES3 (null for a V4.54 pet) */
  function species3(id) { var L = look(), S = L && L.SPECIES3; return S && typeof id === 'string' && Object.prototype.hasOwnProperty.call(S, id) ? S[id] : null; }
  /* the label / emote height of a species (u, before CREW_SCALE) */
  function topOf(sp) { var s = TOP_Y[sp] ? null : species3(sp); return TOP_Y[sp] || (s && s.topY > 0 ? s.topY : 0.72); }
  /* the crew cap and a land's guests per tier (SLTier BUDGETS; D97 / D112 when tier.js is absent) */
  var CAP_FALLBACK = { LOW: [4, 1], MID: [6, 2], HIGH: [8, 2] };
  function capsOf(tier, o) {
    var T = sib('SLTier', './tier.js'), name = String(tier || 'MID').toUpperCase(), B = T && T.BUDGETS && T.BUDGETS[name], F = CAP_FALLBACK[name] || CAP_FALLBACK.MID;
    var rigs = num(o.crewRigs, B && B.crewRigs > 0 ? B.crewRigs : F[0]), land = num(o.landMascots, B && B.landMascots >= 0 ? B.landMascots : F[1]);
    return { rigs: Math.max(1, Math.round(clamp(rigs, 1, 16))), land: Math.max(0, Math.round(clamp(land, 0, 8))) };
  }
  /* in memory only (D97 / D112): My Island opens (one per actors instance) and visits per land */
  var OPENS = 0, LAND_VISITS = {};
  var HIT_R = 0.4, AV_TOP = 1.0, AV_HIT_Y = 0.48;
  var BLOB = { pet: 0.62, avatar: 0.72, shrink: 0.5, lift: 1.0 };
  var BLEND = { dflt: 0.18, hop: 0.06, act: 0.25, edit: 0.3 };
  var FX_CAP = 32;
  var EMOTE = {
    rise: 0.36, dur: 1.15, size: 0.26, sparkle: 0.12,
    cells: { sparkle: 0, heart: 1, note: 2, star: 3, dot: 4 },
    colors: { note: 'Electric Violet', star: 'Star Gold', sparkle: 'LED Cyan', heart: 'Neon Magenta' },
    rainbow: ['Neon Magenta', 'Star Gold', 'Laser Lime', 'LED Cyan', 'Electric Violet']
  };
  /* the finger-heart: a neon line-heart of LED dots by the avatar's raised hand */
  var HEART_LINE = { dots: 10, w: 0.15, dx: -0.3, dy: -0.26, size: 0.07, dur: 1.15 };
  /* the avatar's tap emotes: how long each holds (s) and the sound it lands with */
  var AV_TAP = { wave: 1.0, heart: 1.2, vsign: 1.2, micpoint: 1.2, cheer: 1.9 };
  var AV_TAP_SFX = { heart: 'pop', vsign: 'chip', micpoint: 'beep' };
  var AV_CYCLE_A = ['vsign', 'micpoint'], AV_CYCLE_B = ['micpoint', 'vsign'];
  var AV_EMOTE = { wave: 'wave', fingerHeart: 'heart', heart: 'heart', vSign: 'vsign', vsign: 'vsign', micPoint: 'micpoint', micpoint: 'micpoint', cheer: 'cheer' };
  /* the photo booth's three poses */
  var BOOTH_POSES = ['sit', 'point', 'cheer'];

  /* ---------------- small maths ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function smooth01(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function inOut(u) { u = clamp01(u); return -(Math.cos(PI * u) - 1) / 2; }
  function arc(u) { u = clamp01(u); return 4 * u * (1 - u); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function wrap(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
  /* fade in over a, out over b, inside a window of length d */
  function env(t, d, a, b) { return smooth01(t / a) * (1 - smooth01((t - (d - b)) / b)); }
  function hash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  /* ---------------- the pose API (SL3D.petPose = SLCharacters' pure maths) ---------------- */
  var MINI_KEYS = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'sx', 'sy', 'sz', 'hips', 'neck', 'headPitch', 'headYaw', 'headRoll',
    'earL', 'earR', 'earBack', 'tailYaw', 'tailPitch', 'tailCurl', 'legFL', 'legFR', 'legBL', 'legBR', 'legFLz', 'legFRz',
    'wingL', 'wingR', 'eye', 'spark', 'sparkSpin', 'glint', 'cape', 'wave', 'scarf', 'faceCam'];
  var MINI_AV = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'sx', 'sy', 'sz', 'headPitch', 'headYaw', 'headRoll', 'armL', 'armR', 'armLf', 'armRf', 'faceCam', 'wand'];
  var ONE = { sx: 1, sy: 1, sz: 1, eye: 1 };
  /* a still fallback (rest poses only) when the characters chunk is missing */
  function miniPoseApi() {
    function rest(keys) { return function (out) { out = out || {}; for (var i = 0; i < keys.length; i++) out[keys[i]] = ONE[keys[i]] || 0; return out; }; }
    var restPose = rest(MINI_KEYS), restAvatar = rest(MINI_AV);
    return {
      POSE_KEYS: MINI_KEYS, AV_KEYS: MINI_AV, SPECIES: {}, DANCE_BPM: 118, restPose: restPose, restAvatar: restAvatar,
      mixPose: function (a, b, k, out) { out = out || {}; for (var i = 0; i < MINI_KEYS.length; i++) { var key = MINI_KEYS[i], va = num(a && a[key], ONE[key] || 0); out[key] = va + (num(b && b[key], ONE[key] || 0) - va) * k; } return out; },
      sampleClip: function (n, t, out) { return restPose(out); },
      sampleAvatar: function (n, t, out) { return restAvatar(out); },
      crownGlint: function () { return 0; }, mini: true
    };
  }
  function poseApi(SL3D) {
    var P = (SL3D && SL3D.petPose) || root.SLCharacters || null;
    return P && typeof P.sampleClip === 'function' && typeof P.mixPose === 'function' ? P : miniPoseApi();
  }
  /* avatar poses blend over their own keys */
  function mixAv(P, a, b, k, out) {
    var keys = P.AV_KEYS || MINI_AV;
    for (var i = 0; i < keys.length; i++) { var key = keys[i], va = num(a[key], ONE[key] || 0); out[key] = va + (num(b[key], ONE[key] || 0) - va) * k; }
    return out;
  }
  function copyPose(keys, src, dst) { for (var i = 0; i < keys.length; i++) dst[keys[i]] = src[keys[i]]; return dst; }
  /* the clip layer's pose helpers (models-characters.js rearUp / legsTuck / wingsFlap / pawsUp), the
     same maths, for a clip layer that does not export them */
  function rearUp0(out, deg) {
    var r = deg * DEG;
    out.pitch -= deg; out.legBL -= deg; out.legBR -= deg; out.headPitch += deg * 0.6;
    out.y += 0.1 * Math.sin(r) - 0.09 * (1 - Math.cos(r));
  }
  function legsTuck0(out, k) { out.legFL = 35 * k; out.legFR = 35 * k; out.legBL = -30 * k; out.legBR = -30 * k; }
  function wingsFlap0(out, t, hz, amp, base) { var w = base + amp * Math.sin(TAU * hz * t); out.wingL = w; out.wingR = w; }
  function pawsUp0(out, deg, side) { out.legFL = deg; out.legFR = deg; out.legFLz = side; out.legFRz = side; }

  /* ---------------- placeholders (only when chunk 8 is missing) ---------------- */
  function placeholderRig(K, petId) {
    var T = K.THREE, G = K.G, tok = 'PETCOL.' + petId + '.body';
    var parts = [G.paint(G.t(G.bean(0.15, 0.16), { r: [90, 0, 0], p: [0, 0.22, 0] }), tok), G.paint(G.t(G.puff(0.15), { p: [0, 0.4, 0.15] }), tok)];
    var geo = G.merge(parts);
    parts.forEach(function (g) { g.dispose(); });
    return simpleRig(T, geo, K.mat('toon'), 'pet:' + petId, 0.22);
  }
  function placeholderAvatar(K, hex) {
    var T = K.THREE, G = K.G, c = K.rgb(hex || '#FF8FC8');
    var parts = [G.paint(G.t(G.bean(0.18, 0.22), { p: [0, 0.33, 0] }), c), G.paint(G.t(G.puff(0.24), { p: [0, 0.71, 0] }), 'Cloud White')];
    var geo = G.merge(parts);
    parts.forEach(function (g) { g.dispose(); });
    var rig = simpleRig(T, geo, K.mat('toon'), 'avatar', 0.33);
    rig.setWand = function () { return rig; };
    return rig;
  }
  /* a one-mesh rig honouring only the whole-body pose (offset, rotation, squash) */
  function simpleRig(T, geo, mat, name, cy) {
    var group = new T.Group(), inner = new T.Group(), mesh = new T.Mesh(geo, mat);
    group.name = name; inner.add(mesh); group.add(inner);
    var disposed = false;
    var rig = {
      root: group, placeholder: true, pose: {}, anchors: {}, sockets: {}, bones: {},
      setPose: function (p) {
        if (disposed || !p) return rig;
        inner.position.set(num(p.x, 0), num(p.y, 0), num(p.z, 0));
        inner.rotation.set(num(p.pitch, 0) * DEG, num(p.yaw, 0) * DEG, num(p.roll, 0) * DEG, 'YXZ');
        inner.scale.set(num(p.sx, 1) || 1e-4, num(p.sy, 1) || 1e-4, num(p.sz, 1) || 1e-4);
        return rig;
      },
      setShow: function () { return rig; },
      play: function () { return rig.pose; },
      dispose: function () { if (disposed) return; disposed = true; if (group.parent) group.parent.remove(group); geo.dispose(); }
    };
    return rig;
  }

  /* ================================================================
     create(K, SL3D, opts)
     ================================================================ */
  function create(K, SL3D, opts) {
    if (!K || !K.THREE) throw new Error('SLActors.create needs the kit K');
    opts = opts || {};
    SL3D = SL3D || {};
    var T = K.THREE, tier = opts.tier || K.tier || SL3D.tier || 'MID';
    var P = poseApi(SL3D), POSE_KEYS = P.POSE_KEYS || MINI_KEYS, AV_KEYS = P.AV_KEYS || MINI_AV;
    var Brain = opts.Brain || root.SLPetBrain || null;
    /* v3: voxel rigs from R (SL3D.vox) shown at CREW_SCALE, blob shadows from K.vox.blobs, Home on the
       v3 terraces; the visited sky island's own brain hosts the active pet (isleBrain) */
    var R = opts.vox === true ? SL3D.vox || null : opts.vox && typeof opts.vox === 'object' ? opts.vox : null;
    var LK = look(), CREW = R ? clamp(num(opts.crewScale, (LK && LK.CREW_SCALE) || 1.2), 0.5, 2) : 1;
    /* the crew of 14 (W3b.12): the cap, this opening's place in the rotation, the clip layer's pose helpers */
    var CAP = capsOf(tier, opts), TURN = typeof opts.crewTurn === 'number' && isFinite(opts.crewTurn) ? Math.max(0, Math.floor(opts.crewTurn)) : OPENS;
    OPENS++;
    var H = {
      rearUp: typeof P.rearUp === 'function' ? P.rearUp : rearUp0, legsTuck: typeof P.legsTuck === 'function' ? P.legsTuck : legsTuck0,
      wingsFlap: typeof P.wingsFlap === 'function' ? P.wingsFlap : wingsFlap0, pawsUp: typeof P.pawsUp === 'function' ? P.pawsUp : pawsUp0
    };
    var brain = Brain ? Brain.create({ seed: opts.seed == null ? 'island-pets' : opts.seed, reduced: !!opts.reduced, v3: !!R }) : null;
    var isleBrain = null, isle = 'home', cb = brain, lastView = null, HANG_R = Brain && Brain.HANG ? Brain.HANG.reach : 0.3;
    var DANCE = Brain ? Brain.DANCE : { bpm: 118, beat: 60 / 118, dur: 8 * 60 / 118, hold: 0.6, reducedDur: 2.2 };
    var WALK = Brain ? Brain.WALK : { speed: 1.0 };
    /* the buildings' live anchors come from the island (its itemPoint hook) until setAnchorFn() */
    var anchorFnSet = null, activeRec = null;
    if (brain && typeof opts.itemPoint === 'function') {
      anchorFnSet = function (uid, name) { try { return opts.itemPoint(uid, name); } catch (e) { return null; } };
      brain.setAnchorFn(anchorFnSet);
    }

    var group = new T.Group();
    group.name = 'actors';
    if (opts.scene && typeof opts.scene.add === 'function') opts.scene.add(group);
    var VB = R && K.vox && typeof K.vox.blobs === 'function' ? K.vox : null;
    var NBLOB = Math.max(8, CAP.rigs + 1);                       /* the shown crew and the avatar */
    var blobs = VB ? VB.blobs(NBLOB) : typeof K.blobs === 'function' ? K.blobs(NBLOB) : null;
    if (blobs) { blobs.mesh.name = 'actor-blobs'; group.add(blobs.mesh); }
    var fxPool = typeof K.billboards === 'function' ? K.billboards({ capacity: FX_CAP, texture: 'sparkles', additive: false, name: 'actor-fx', renderOrder: 6 }) : null;
    if (fxPool) group.add(fxPool.mesh);

    var reduced = !!opts.reduced, showK = 0, mode = 'play', camera = opts.camera || null, disposed = false, musicSet = null;
    var actors = [], byId = {};
    /* the whole crew (sync's records) and who is out: Home's set, the visited land's guests (D97 / D112) */
    var crew = [], crewById = {}, homeAv = null, guestPlan = [], guestsDue = -1, visitN = 0, crossId = null;
    var avatar = null, avatarInfo = opts.user || null, avatarSpot = null;
    var lastBeat = null, now = 0, fxNow = 0;
    var danceSeen = -1, danceCue = 0, danceWasOn = false;
    var _glance = {}, _hits = [], _cam = { x: 0, y: 10, z: 30 };
    var sound = null, soundTried = false;

    /* ---------- sound ---------- */
    function snd() {
      if (opts.sound) return opts.sound;
      if (!soundTried) {
        soundTried = true;
        try { if (root.SLSound && typeof root.SLSound.make === 'function') sound = root.SLSound.make({}); } catch (e) { sound = null; }
      }
      return sound;
    }
    function panOf(x) { var S = root.SLSound; return S && typeof S.panFor === 'function' ? S.panFor(x + 8, 16) : 0; }
    function sfx(name, x, vol, step) { var s = snd(); if (!s || typeof s !== 'function') return; try { s(name, vol == null ? 1 : vol, step || 0, panOf(x)); } catch (e) { /* sound is never fatal */ } }
    function voice(petId, x) {
      var s = snd();
      if (!s) return;
      try {
        if (typeof s.pet === 'function') s.pet(petId, 0.9, panOf(x));
        else if (typeof s === 'function') s(root.SLSound && root.SLSound.petVoice ? root.SLSound.petVoice(petId) : 'yip', 0.9, 0, panOf(x));
      } catch (e) { /* ignore */ }
    }

    /* ---------- the camera direction ---------- */
    function camPos() {
      if (camera && camera.position) { _cam.x = camera.position.x; _cam.y = camera.position.y; _cam.z = camera.position.z; }
      return _cam;
    }
    function yawToCam(x, z) { var c = camPos(); return Math.atan2(c.x - x, c.z - z); }

    /* ================================================================
       SPRITES: emotes that follow an actor + sparkles (one pooled draw call)
       ================================================================ */
    var fx = [];
    for (var fi = 0; fi < FX_CAP; fi++) fx.push({ on: false, k: -1, cell: 0, color: null, follow: null, x: 0, y: 0, z: 0, fy: 0, vx: 0, vy: 0, vz: 0, t0: 0, dur: 1, size: 0.2, rise: 0, rot: 0, spin: 0, still: false });
    function fxSlot() {
      if (!fxPool) return null;
      for (var i = 0; i < fx.length; i++) if (!fx[i].on) {
        var k = fxPool.alloc();
        if (k < 0) return null;
        var f = fx[i]; f.on = true; f.k = k; return f;
      }
      return null;
    }
    function fxFree(f) { if (f.on) { fxPool.free(f.k); f.on = false; f.k = -1; f.follow = null; } }
    /* a note / star / sparkle rising above an actor (hearts belong to the finger-heart only) */
    function emoteSprite(target, kind, dx) {
      var f = fxSlot();
      if (!f) return;
      if (kind === 'heart' || EMOTE.cells[kind] == null) kind = 'star';
      f.cell = EMOTE.cells[kind]; f.color = EMOTE.colors[kind]; f.follow = target;
      f.x = dx || 0; f.y = 0; f.z = 0; f.fy = 0; f.vx = f.vy = f.vz = 0;
      f.t0 = fxNow; f.dur = EMOTE.dur; f.size = EMOTE.size; f.rise = reduced ? 0 : EMOTE.rise; f.rot = 0; f.spin = 0; f.still = reduced;
    }
    /* the finger-heart: a neon line-heart of LED dots by the avatar's raised hand, rising a
       little and fading (a still fade under reduced motion; never a flash) */
    function heartLine(target) {
      var H = HEART_LINE;
      for (var i = 0; i < H.dots; i++) {
        var f = fxSlot();
        if (!f) return;
        var a = i / H.dots * TAU, s = Math.sin(a);
        f.cell = EMOTE.cells.dot; f.color = EMOTE.colors.heart; f.follow = target;
        f.x = H.dx + H.w * s * s * s; f.fy = H.dy + H.w * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16;
        f.y = 0; f.z = 0; f.vx = f.vy = f.vz = 0;
        f.t0 = fxNow; f.dur = H.dur; f.size = H.size; f.rise = reduced ? 0 : EMOTE.rise * 0.4; f.rot = 0; f.spin = 0; f.still = reduced;
      }
    }
    /* a burst of n sparkles at a world point (colors: one token or a list) */
    function sparkles(x, y, z, n, colors, spread) {
      if (typeof opts.emit === 'function') {
        try { opts.emit('sparkle', [x, y, z], n, { reduced: reduced, colors: colors }); return; } catch (e) { /* fall back to our pool */ }
      }
      spread = spread || 0.9;
      for (var i = 0; i < n; i++) {
        var f = fxSlot();
        if (!f) return;
        var a = (i / n) * TAU + i * 0.37, up = 0.4 + 0.6 * ((i * 7) % 5) / 5;
        f.cell = EMOTE.cells.sparkle; f.color = Array.isArray(colors) ? colors[i % colors.length] : (colors || EMOTE.colors.sparkle);
        f.follow = null; f.x = x; f.y = y; f.z = z; f.fy = 0;
        if (reduced) { f.vx = f.vy = f.vz = 0; f.x += Math.cos(a) * 0.18 * spread; f.z += Math.sin(a) * 0.18 * spread; f.y += 0.1 * up; }
        else { f.vx = Math.cos(a) * 0.55 * spread; f.vz = Math.sin(a) * 0.55 * spread; f.vy = 0.5 + 0.7 * up; }
        f.t0 = fxNow; f.dur = reduced ? 0.9 : 0.75; f.size = EMOTE.sparkle; f.rise = 0; f.rot = a; f.spin = reduced ? 0 : 2.4; f.still = reduced;
      }
    }
    /* a little puff of dust at a world point (the crab popping up out of the sand): fx3d's 'dust'
       through opts.emit, else n soft dots from our own pool (still under reduced motion) */
    function dust(x, y, z, n) {
      if (typeof opts.emit === 'function') {
        try { opts.emit('dust', [x, y, z], n, { reduced: reduced }); return; } catch (e) { /* fall back to our pool */ }
      }
      for (var i = 0; i < n; i++) {
        var f = fxSlot();
        if (!f) return;
        var ang = (i / n) * TAU + 0.4, sp = reduced ? 0 : 0.45;
        f.cell = EMOTE.cells.dot; f.color = 'Cloud White'; f.follow = null; f.x = x; f.y = y + 0.05; f.z = z; f.fy = 0;
        f.vx = Math.cos(ang) * sp; f.vz = Math.sin(ang) * sp; f.vy = reduced ? 0 : 0.35;
        f.t0 = fxNow; f.dur = 0.6; f.size = 0.09; f.rise = 0; f.rot = 0; f.spin = 0; f.still = reduced;
      }
    }
    function updateFx(dt) {
      if (!fxPool) return false;
      var live = false;
      for (var i = 0; i < fx.length; i++) {
        var f = fx[i];
        if (!f.on) continue;
        var age = fxNow - f.t0, u = age / f.dur;
        if (u >= 1 || (f.follow && f.follow.gone)) { fxFree(f); continue; }
        live = true;
        var x, y, z, size = f.size, alpha;
        if (f.follow) {
          var A = f.follow;
          x = A.ax + f.x; z = A.az; y = A.ay + 0.08 + f.fy + f.rise * (1 - (1 - u) * (1 - u));
          size *= f.still ? 1 : (u < 0.15 ? 0.6 + 0.5 * smooth01(u / 0.15) : u < 0.3 ? 1.1 - 0.1 * smooth01((u - 0.15) / 0.15) : 1);
          alpha = f.still ? smooth01(u / 0.15) * (1 - smooth01((u - 0.7) / 0.3)) : 1 - smooth01((u - 0.72) / 0.28);
        } else {
          f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
          f.vy -= 1.6 * dt; f.vx *= 1 - 1.5 * dt; f.vz *= 1 - 1.5 * dt;
          x = f.x; y = f.y; z = f.z;
          alpha = f.still ? smooth01(u / 0.2) * (1 - smooth01((u - 0.45) / 0.55)) : 1 - smooth01((u - 0.4) / 0.6);
          size *= f.still ? 1 : 1 - 0.4 * u;
        }
        f.rot += f.spin * dt;
        fxPool.set(f.k, x, y, z, size, f.color, alpha, f.cell, f.rot);
      }
      fxPool.commit();
      return live;
    }

    /* ================================================================
       PETS
       ================================================================ */
    function accKey(acc) { return ['hat', 'neck', 'face', 'back'].map(function (s) { return (acc && acc[s]) || '-'; }).join('|'); }
    function makePetRig(id, acc) {
      var rig = null;
      try { if (R && typeof R.makeRig === 'function') rig = R.makeRig(id, acc || {}, tier); } catch (e0) { rig = null; }
      try { if (!rig && typeof SL3D.makeRig === 'function') rig = SL3D.makeRig(id, acc || {}, tier); } catch (e) { rig = null; }
      if (!rig) { try { rig = placeholderRig(K, id); } catch (e2) { rig = null; } }
      if (rig && typeof rig.setShow === 'function') rig.setShow(showK);
      if (rig && CREW !== 1 && rig.root && rig.root.scale) rig.root.scale.set(CREW, CREW, CREW);
      return rig;
    }
    /* the species a pet is posed as: itself when the tables know it (the four, the clip layer's rows,
       SLIslandLook.SPECIES3), else the puppy */
    function speciesOf(id) { return PETS.indexOf(id) >= 0 || (P.SPECIES && P.SPECIES[id]) || species3(id) ? id : 'pet_puppy'; }
    function newActor(id) {
      var a = {
        id: id, species: speciesOf(id), rig: null, key: '', acc: '', hosted: false, seen: false, hb: null,
        pose: P.restPose({}), base: P.restPose({}), tmp: P.restPose({}), from: P.restPose({}),
        blend: 1, blendDur: BLEND.dflt, idleT: 0, gaitT: 0, omegaS: 0, accS: 0, lastSpeed: 0, lookKs: 0, happyK: 0,
        landT: -9, lastKey: '', cueN: -1, seed: hash(id) >>> 0, sign: (hash(id) & 1) ? 1 : -1, fcS: 0, dt: 0, lastBounce: null,
        blob: blobs ? blobs.alloc() : -1, ax: 0, ay: 0, az: 0, gone: false, crown: false, yawShown: 0, psx: 1, psy: 1,
        hit: { kind: 'pet', id: id, x: 0, y: 0, z: 0, r: HIT_R, pickable: true },
        o: { species: id, seed: hash(id) >>> 0, reduced: false, speed: undefined, bpm: undefined, rate: undefined, intensity: undefined, dur: undefined, height: undefined, ground: undefined }
      };
      return a;
    }
    function dropActor(a) {
      a.gone = true;
      if (a.rig) { try { a.rig.dispose(); } catch (e) { /* already gone */ } a.rig = null; }
      if (blobs && a.blob >= 0) blobs.free(a.blob);
      a.blob = -1;
    }

    /* ---------- reading sync() inputs ---------- */
    function placedOf(world) {
      if (!world) return [];
      if (world.world && Array.isArray(world.world.placed)) return world.world.placed;
      return Array.isArray(world.placed) ? world.placed : [];
    }
    function modeOf(world) { return world && typeof world.mode === 'string' ? world.mode : null; }
    function spotOf(placed) {
      var G = root.SLGrid3D;
      try { if (G && typeof G.avatarSpot === 'function') return G.avatarSpot(placed); } catch (e) { /* fall back */ }
      var C = root.SLWorldCore;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (p.id !== 'house_cottage') continue;
        var it = C && C.item ? C.item(p.id) : null, fp = (it && it.fp) || [2, 2];
        return { x: p.x - 7.5, y: 0, z: p.y + fp[1] - 4.5, c: p.x, r: p.y + fp[1] };
      }
      return null;
    }
    function avatarKeyOf(info) {
      if (!info) return '';
      return String(info.color || '') + '|' + String(info.emoji || info.avatar || '');
    }

    function sync(pets, avatarArg, world) {
      if (disposed) return;
      var list = Array.isArray(pets) ? pets.filter(function (p) { return p && typeof p.id === 'string' && /^pet_/.test(p.id); }) : [];
      var placed = placedOf(world);
      if (avatarArg !== undefined) avatarInfo = avatarArg ? avatarArg : null;
      var homeSpot = avatarInfo ? spotOf(placed) : null;
      activeRec = list.length ? (list.filter(function (p) { return p.active; })[0] || list[0]).id : null;
      var m = modeOf(world);
      if (m) mode = m === 'edit' || m === 'place' ? m : 'play';
      if (world) lastView = world;
      crew = []; crewById = {};
      list.forEach(function (p) { if (!crewById[p.id]) { crewById[p.id] = p; crew.push(p); } });
      homeAv = homeSpot ? { c: homeSpot.c, r: homeSpot.r } : null;
      syncCrew(world || { placed: placed }, world || lastView || { placed: [] });
      avatarSpot = !avatarInfo ? null : isleBrain ? isleBrain.dockSpot({}) : homeSpot;
      syncAvatar();
      drainEvents();
      if (reduced) poseAll(0);              /* reduced motion renders on demand: pose once now */
    }

    /* ---------- who is out: the crew cap (D97) and a visited land's own mascots (D112) ---------- */
    /* a mascot's home land: the record's isle (the host passes it), else its catalogue isle */
    function landOf(rec) {
      if (rec && typeof rec.isle === 'string') return SKY_ISLES.indexOf(rec.isle) >= 0 ? rec.isle : null;
      var C = sib('SLWorldCore', '../world-core.js'), it = null;
      try { it = C && typeof C.item === 'function' ? C.item(rec.id) : null; } catch (e) { it = null; }
      return it && it.kind === 'pet' && SKY_ISLES.indexOf(it.isle) >= 0 ? it.isle : null;
    }
    /* a pet stands on brain b now (hosted there, not away on another island) */
    function liveOn(b, id) { var q = b && b.pet(id); return !!q && !(b.isAway && b.isAway(id)) && b.pets.indexOf(q) >= 0; }
    /* the land's guests in the order they come out: the fresh first, then this visit's turn of the rest */
    function guestOrder(k, n, skip) {
      var fresh = [], rest = [], out = [], i;
      crew.forEach(function (r) { if (!skip[r.id] && landOf(r) === k) (r.fresh ? fresh : rest).push(r.id); });
      var start = rest.length ? ((Math.max(1, visitN) - 1) * Math.max(1, n)) % rest.length : 0;
      for (i = 0; i < fresh.length; i++) out.push(fresh[i]);
      for (i = 0; i < rest.length; i++) out.push(rest[(start + i) % rest.length]);
      return out;
    }
    /* → {home: ids for Home's brain (the crew's order), isle: the visited island's crossing pets,
       guests: its land mascots, shown: every pet with a rig} — never more than CAP.rigs rigs */
    function allocate() {
      var cap = CAP.rigs, runner = activeRec && crewById[activeRec] ? activeRec : null, taken = {}, onIsle = [], guests = [], i;
      if (isleBrain) isleBrain.pets.forEach(function (q) {
        if (crewById[q.id] && (!q.guest || q.id === runner) && !taken[q.id]) { onIsle.push(q.id); taken[q.id] = 1; }
      });
      if (isleBrain) {
        var skip = {}; for (var k0 in taken) skip[k0] = 1;
        if (runner) skip[runner] = 1;
        var room = Math.max(0, Math.min(CAP.land, cap - onIsle.length - (runner && !taken[runner] ? 1 : 0)));
        var order = guestOrder(isle, CAP.land, skip), keepG = guestPlan.filter(function (id) { return order.indexOf(id) >= 0; });
        guests = keepG.concat(order.filter(function (id) { return keepG.indexOf(id) < 0; })).slice(0, room);
        guestPlan = guests.slice();
        guests.forEach(function (id) { taken[id] = 1; });
      } else guestPlan = [];
      /* Home: the runner, the fresh, then the rotation (one step per opening), in the room left */
      var want = [], rest = [];
      if (runner && !taken[runner]) want.push(runner);
      crew.forEach(function (r) { if (r.id !== runner && !taken[r.id] && r.fresh && want.indexOf(r.id) < 0) want.push(r.id); });
      crew.forEach(function (r) { if (r.id !== runner && !r.fresh) rest.push(r.id); });
      var start = rest.length ? (TURN * Math.max(1, cap - 1)) % rest.length : 0;
      for (i = 0; i < rest.length; i++) { var id = rest[(start + i) % rest.length]; if (!taken[id] && want.indexOf(id) < 0) want.push(id); }
      want = want.slice(0, Math.max(0, cap - onIsle.length - guests.length));
      var home = crew.filter(function (r) { return want.indexOf(r.id) >= 0; }).map(function (r) { return r.id; });
      return { home: home, isle: onIsle, guests: guests, shown: home.concat(onIsle, guests) };
    }
    /* the brains and the rigs follow the allocation; a pet that leaves the island it was on (to its
       land, back from it, or indoors to rest) goes with one sparkle */
    function syncCrew(homeWorld, isleWorld) {
      var al = allocate(), pending = guestsDue >= 0, i, recs = [];
      if (brain) {
        al.home.forEach(function (id) { recs.push({ id: id, active: id === activeRec }); });
        /* a pet over on the visited island stays Home's (away) so it can walk back */
        al.isle.forEach(function (id) { if (brain.isAway && brain.isAway(id)) recs.push({ id: id, active: id === activeRec }); });
        brain.sync({ world: homeWorld, pets: recs, avatar: homeAv, mode: mode });
      }
      if (isleBrain) {
        recs = al.isle.map(function (id) { return { id: id, active: true }; });
        if (!pending) al.guests.forEach(function (id) { recs.push({ id: id, guest: true }); });
        isleBrain.sync({ world: isleWorld, pets: recs, mode: mode });
      }
      for (i = 0; i < actors.length; i++) {
        var a = actors[i], here = a.hb && (a.hb === brain || a.hb === isleBrain) && liveOn(a.hb, a.id);
        if (a.hosted && !here && a.id !== crossId) { sparkles(a.ax, a.ay - 0.25 * CREW, a.az, 6, EMOTE.colors.sparkle, 0.7); hideActor(a); }
      }
      syncRigs(al.shown);
    }
    function hideActor(a) {
      a.hosted = false;
      if (a.rig && a.rig.root) a.rig.root.visible = false;
      if (blobs && a.blob >= 0) blobs.set(a.blob, 0, 0, 0, 0, 0);
    }
    /* one rig per pet shown (rebuilt when its accessories change); a new rig shows once it is posed */
    function syncRigs(ids) {
      var keep = {}, i;
      ids.forEach(function (id) {
        var rec = crewById[id];
        if (!rec || keep[id]) return;
        keep[id] = 1;
        var a = byId[id];
        if (!a) { a = newActor(id); byId[id] = a; actors.push(a); }
        var key = accKey(rec.acc);
        if (!a.rig || a.acc !== key) {
          var old = a.rig;
          a.rig = makePetRig(id, rec.acc);
          a.acc = key; a.crown = !!(rec.acc && rec.acc.hat === 'acc_crown'); a.phones = !!(rec.acc && rec.acc.neck === 'acc_headphones');
          if (a.rig) {
            group.add(a.rig.root);
            /* a new outfit takes the old rig's place and pose at once (never a frame away); a new pet
               shows once a brain hosts and poses it */
            if (old && old.root && a.rig.root && a.hosted) {
              var op = old.root.position, orr = old.root.rotation;
              a.rig.root.position.set(op.x, op.y, op.z); a.rig.root.rotation.set(orr.x, orr.y, orr.z);
              if (typeof a.rig.setPose === 'function') a.rig.setPose(a.pose);
            }
            else if (brain && !a.hosted && a.rig.root) a.rig.root.visible = false;
          }
          if (old) { try { old.dispose(); } catch (e) { /* ignore */ } }
          a.key = ''; a.blend = 1;
        }
      });
      for (i = actors.length - 1; i >= 0; i--) {
        if (keep[actors[i].id]) continue;
        dropActor(actors[i]); delete byId[actors[i].id]; actors.splice(i, 1);
      }
    }

    /* ---------- the brain's events → sparkles ---------- */
    function drainEvents() { if (brain) drainOf(brain); if (isleBrain) drainOf(isleBrain); }
    function drainOf(b) {
      if (!b.events.length) return;
      var f = b.frame || { ox: 0, oy: 0, oz: 0 }, ox = f.ox, oy = f.oy + 0.3, oz = f.oz;
      for (var i = 0; i < b.events.length; i++) {
        var e = b.events[i], a = byId[e.id];
        /* a sparkle hop that leaves an island the camera has left is drawn only where it lands */
        if (e.type === 'pop') { if (!e.quiet) sparkles(e.x0 + ox, e.y0 + oy, e.z0 + oz, 6, EMOTE.colors.sparkle, 0.7); sparkles(e.x + ox, e.y + oy, e.z + oz, 8, EMOTE.colors.sparkle, 0.8); }
        else if (e.type === 'spawn') sparkles(e.x + ox, e.y + oy, e.z + oz, 10, EMOTE.rainbow, 1);
        else if (e.type === 'emote' && a) emoteSprite(a, e.kind, 0);
        else if (e.type === 'land' && a && !reduced) a.landT = b.now;
      }
      b.events.length = 0;
    }

    /* ---------- pose composition for one pet ---------- */
    function setKey(a, key, dur) {
      if (a.key === key) return;
      if (a.key && !reduced) { copyPose(POSE_KEYS, a.pose, a.from); a.blend = 0; a.blendDur = dur || BLEND.dflt; }
      else a.blend = 1;                                          /* still mode: poses cut, never drift */
      if ((a.key === 'perf:hop' || a.key === 'perf:bounce') && key === 'loco') a.landT = brain ? cb.now : 0;
      a.key = key; a.cueN = -1;
    }
    function resetOpts(o, red) {
      o.reduced = red; o.speed = undefined; o.bpm = undefined; o.rate = undefined; o.intensity = undefined;
      o.dur = undefined; o.height = undefined; o.ground = undefined;
    }
    /* idle → walk → run by speed (one continuous key, so no crossfade is needed) */
    function locomotion(a, p, pose) {
      var o = a.o;
      P.sampleClip('idle', a.idleT, a.base, o);
      if (p.speed > 0.01 && !o.reduced) {
        var run = p.cruise > 1.6;
        o.speed = run ? p.cruise : WALK.speed;
        P.sampleClip(run ? 'run' : 'walk', a.gaitT, a.tmp, o);
        o.speed = undefined;
        P.mixPose(a.base, a.tmp, smooth01(p.speed / Math.max(0.25, p.cruise * 0.6)), pose);
      } else copyPose(POSE_KEYS, a.base, pose);
    }
    function lerpKeys(pose, k, vals) { for (var key in vals) pose[key] = lerp(pose[key], vals[key], k); }
    var NAP = { pitch: 0, y: -0.1, sy: 0.86, sx: 1.06, sz: 1.04, legFL: 70, legFR: 70, legBL: -70, legBR: -70, headPitch: 22, headRoll: 10, eye: 0.06, earL: 28, earR: 28, tailYaw: 0, tailPitch: -5 };
    var ACT_KEY = {};                                            /* 'act:<name>' strings, built once (no per-frame concat) */
    var POSE_KEY = ['perf:pose', 'perf:pose0', 'perf:pose1', 'perf:pose2'];   /* each booth pose crossfades in */
    function actPose(a, p, pose, red) {
      var o = a.o, t = cb.now - p.actT0, d = Math.max(0.1, p.actDur), u = clamp01(t / d), e;
      switch (p.action) {
        case 'sit': P.sampleClip('sit', a.idleT, pose, o); break;
        case 'lean': case 'lookBack':                             /* the v2 idles: settle on a hip, glance back */
          o.left = p.side > 0;
          P.sampleClip(p.action, t * (p.action === 'lean' ? 2 / d : 1), pose, o);
          o.left = undefined;
          break;
        case 'beatNod':                                           /* nod on the music's beats (≤ 118 BPM) */
          o.bpm = readClock(false) ? _clk.bpm : DANCE.bpm;
          P.sampleClip('beatNod', beatCount() * 60 / o.bpm, pose, o);
          o.bpm = undefined;
          break;
        case 'sniff':
          P.sampleClip('idle', a.idleT, pose, o);
          e = env(t, d, 0.3, 0.3);
          pose.headPitch += (28 + (red ? 0 : 4 * Math.sin(TAU * 1.8 * t))) * e;
          pose.neck += 12 * e; pose.earBack += 8 * e; pose.y -= 0.01 * e; pose.tailPitch += 10 * e;
          break;
        case 'look': case 'lookAvatar': case 'turn': case 'emote':
          P.sampleClip('idle', a.idleT, pose, o);
          e = env(t, d, 0.3, 0.35);
          if (p.action === 'look') { pose.headPitch -= 8 * e; pose.headRoll += 10 * e * a.sign; }
          if (p.action === 'lookAvatar') pose.headRoll += 6 * e * a.sign;
          break;
        case 'nap':
          P.sampleClip('idle', a.idleT, pose, o);
          e = env(t, d, 0.6, 0.6);
          lerpKeys(pose, e, NAP);
          if (a.species === 'pet_dragon') { pose.wingL = lerp(pose.wingL, 10, e); pose.wingR = lerp(pose.wingR, 10, e); }
          if (!red) { pose.sy += 0.025 * Math.sin(TAU * 0.28 * t) * e; pose.tailYaw += 6 * Math.sin(TAU * 0.2 * t) * e; }
          break;
        case 'chase':                                             /* puppy: two spins after its tail */
          P.sampleClip('idle', a.idleT, a.base, o);
          o.speed = WALK.speed; P.sampleClip('walk', a.gaitT, a.tmp, o); o.speed = undefined;
          e = env(t, d, 0.2, 0.25);
          P.mixPose(a.base, a.tmp, 0.85 * e, pose);
          pose.yaw += 720 * inOut(u) * a.sign;
          pose.headYaw += 25 * e * a.sign; pose.tailYaw += 30 * e * a.sign;
          break;
        case 'pounce':                                            /* kitten: crouch, wiggle, leap, land */
          P.sampleClip('idle', a.idleT, pose, o);
          if (t < 0.35) {
            var c = smooth01(t / 0.3);
            pose.sy *= 1 - 0.1 * c; pose.pitch += 6 * c; pose.headPitch -= 4 * c; pose.eye = 1 + 0.12 * c;
            pose.legFL += 15 * c; pose.legFR += 15 * c; pose.legBL -= 15 * c; pose.legBR -= 15 * c;
            pose.tailYaw = 12 * Math.sin(TAU * 3 * t); pose.hips = 5 * Math.sin(TAU * 1.5 * t);
          } else if (t < 0.7) {
            var v = (t - 0.35) / 0.35, s = Math.sin(PI * v);
            pose.y += 0.14 * arc(v); pose.pitch -= 10 * s;
            pose.legFL = pose.legFR = 70 * s; pose.legBL = pose.legBR = -50 * s; pose.earBack = 15;
          } else {
            var w = clamp01((t - 0.7) / 0.3);
            pose.sy *= 1 - 0.1 * Math.sin(PI * w); pose.sx *= 1 + 0.05 * Math.sin(PI * w); pose.sz = pose.sx;
          }
          break;
        case 'binky':                                             /* bunny: a twisting joy-hop */
          P.sampleClip('idle', a.idleT, pose, o);
          pose.y += 0.24 * arc(u); pose.yaw += 35 * Math.sin(TAU * u) * a.sign; pose.roll += 18 * Math.sin(TAU * u);
          pose.legBL = pose.legBR = -60 * Math.sin(PI * u); pose.legFL = pose.legFR = 30 * Math.sin(PI * u);
          pose.earL -= 20 * Math.sin(PI * u); pose.earR -= 20 * Math.sin(PI * u);
          break;
        case 'loop':                                              /* dragon: a little loop-the-loop and a sparkle */
          P.sampleClip('idle', a.idleT, pose, o);
          pose.y += 0.22 * Math.sin(PI * u);
          pose.pitch -= 360 * inOut((u - 0.2) / 0.6);
          if (!red) { pose.wingL = pose.wingR = 20 + 40 * Math.sin(TAU * 3 * t); }
          if (u >= 0.5 && a.cueN < 0) { a.cueN = 0; sparkles(p.x, p.y + 0.6, p.z, 6, EMOTE.rainbow, 0.6); }
          break;
        default:
          if (!playPose(a, p, pose, t)) P.sampleClip('idle', a.idleT, pose, o);
      }
    }
    /* ---------- the land mascots' play moves (catalogAdditions.crewMoves.play, D111) ----------
       In place, from the clips and the clip layer's pose helpers, nothing over 2 Hz; the brain owns
       the body turns (flutter's half turn, glide's full turn) and the facing (follow). t = seconds
       into the move. Play is never chosen under reduced motion. → false: not a play move. */
    var STEP_V = 0.4;                        /* follow's waddle on the spot: its walk sampled at ≤ 2 Hz */
    function mixIn(a, pose, k) { if (k > 0) P.mixPose(pose, a.tmp, clamp01(k), pose); }
    function playPose(a, p, pose, t) {
      var o = a.o, k, w, s;
      switch (p.action) {
        case 'dig':                                               /* crab: sit, sink and rock, pop out */
          P.sampleClip('idle', a.idleT, pose, o);
          P.sampleClip('sit', a.idleT, a.tmp, o);
          mixIn(a, pose, smooth01(t / 0.3) * (1 - smooth01((t - 1.3) / 0.1)));
          if (t >= 1.25) { P.sampleClip('hop', t - 1.3, a.tmp, o); mixIn(a, pose, smooth01((t - 1.25) / 0.06)); }
          pose.y -= 0.1 * smooth01(t / 0.3) * (1 - smooth01((t - 1.3) / 0.12));
          if (t > 0.3 && t < 1.3) pose.yaw += 8 * Math.sin(TAU * 1.5 * (t - 0.3));
          if (t >= 1.3 && a.cueN < 0) { a.cueN = 0; var fd = cb.frame || ZERO; dust(p.x + fd.ox, p.y + fd.oy, p.z + fd.oz, 4); }
          return true;
        case 'flutter':                                           /* gull: a jump with the wings beating, a shake on landing */
          P.sampleClip('idle', a.idleT, pose, o);
          if (t < 0.8) {
            o.dur = 0.8; o.height = 0.25;
            P.sampleClip('jump', t, a.tmp, o);
            o.dur = undefined; o.height = undefined;
            var iy = pose.y, jy = a.tmp.y;
            mixIn(a, pose, smooth01(t / 0.06) * (1 - smooth01((t - 0.6) / 0.2)));     /* feet down again for the landing */
            pose.y = iy + jy;                                                        /* the whole 0.25 u arc */
          }
          if (t < 1) {                       /* two full wing beats at 2 Hz (wingsFlap), down again as it lands */
            H.wingsFlap(a.tmp, t - 0.125, 2, 35, 35);
            pose.wingL += a.tmp.wingL; pose.wingR += a.tmp.wingR;
          }
          if (t >= 0.8) {
            s = (t - 0.8) / 0.5;
            if (s < 1) pose.roll += 6 * Math.sin(TAU * s);                           /* one shake, ±6° */
            if (s < 0.3) { w = Math.sin(PI * s / 0.3); pose.sy *= 1 - 0.07 * w; pose.sx *= 1 + 0.035 * w; pose.sz *= 1 + 0.035 * w; }
          }
          return true;
        case 'loaf':                                              /* capybara: down low, legs tucked, one slow breath */
          P.sampleClip('idle', a.idleT, pose, o);
          P.sampleClip('sit', a.idleT, a.tmp, o);
          H.legsTuck(a.tmp, 1);
          a.tmp.pitch *= 0.4; a.tmp.y -= 0.03; a.tmp.sy = 0.92 + 0.02 * Math.sin(TAU * 0.3 * t); a.tmp.eye = 0.5; a.tmp.headPitch += 6;
          mixIn(a, pose, env(t, Math.max(0.1, p.actDur), 0.4, 0.4));
          return true;
        case 'tumble':                                            /* monkey: the tumble clip once, tail curled */
          P.sampleClip('tumble', t, pose, o);
          pose.spark = 0; pose.tailCurl = 40;
          return true;
        case 'stash':                                             /* squirrel: head down, two paw pats, a look back */
          P.sampleClip('idle', a.idleT, pose, o);
          if (t < 1.05) {
            k = env(t, 1.0, 0.2, 0.2);
            pose.headPitch += 28 * k; pose.neck += 10 * k;
            w = pat(t - 0.1) + pat(t - 0.75);
            if (w > 0) { var fl = pose.legFL, fr = pose.legFR; H.pawsUp(pose, 20 * w, 0); pose.legFL += fl; pose.legFR += fr; }
          } else {
            o.left = p.side > 0;
            P.sampleClip('lookBack', t - 1.0, a.tmp, o);
            o.left = undefined;
            mixIn(a, pose, smooth01((t - 1.0) / 0.12));
          }
          return true;
        case 'glide':                                             /* owlet: a hop with the wings out flat, two landing flaps */
          o.rate = 0.45 / 0.8; o.intensity = 0.3 / 0.18;
          P.sampleClip('hop', t, pose, o);
          o.rate = undefined; o.intensity = undefined;
          w = t < 0.55 ? 80 * smooth01(t / 0.15) : 40 + 40 * Math.cos(TAU * 2 * (t - 0.55));
          k = 1 - smooth01((t - 1.15) / 0.25);
          pose.wingL = lerp(pose.wingL, w, k); pose.wingR = lerp(pose.wingR, w, k);
          return true;
        case 'follow':                                            /* duckling: faces the avatar, six waddle steps on the spot, a cheer flap */
          P.sampleClip('idle', a.idleT, pose, o);
          if (t > 0.15 && t < 1.75) {
            o.speed = STEP_V; o.intensity = 0.75;                 /* small, calm steps on the spot, ≤ 1.8 Hz */
            P.sampleClip('walk', (t - 0.2) * strideK(a, STEP_V, 1.8), a.tmp, o); o.speed = undefined; o.intensity = undefined;
            mixIn(a, pose, env(t - 0.2, 1.5, 0.15, 0.15));
          }
          if (t > 1.6) { P.sampleClip('cheer', Math.min(0.3, t - 1.65), a.tmp, o); mixIn(a, pose, arc((t - 1.6) / 0.4)); }
          return true;
        case 'prance':                                            /* pony: stepping high on the spot, head up, then a little rear */
          P.sampleClip('idle', a.idleT, pose, o);
          if (t < 1.15) {                                         /* the canter gait's walk (its trot), ≤ 1.6 Hz */
            var hp = pose.headPitch, nk = pose.neck;
            o.speed = 0.5; P.sampleClip('walk', t * strideK(a, 0.5, 1.6), a.tmp, o); o.speed = undefined;
            k = env(t, 1.15, 0.12, 0.15);
            mixIn(a, pose, k);
            pose.y += 0.025 * (1 + Math.cos(TAU * 1.5 * t)) * k;          /* a 0.05 u bob at 1.5 Hz */
            pose.headPitch = hp - 14 * k; pose.neck = nk - 6 * k;          /* the head held high and steady */
          }
          if (t > 1.1) H.rearUp(pose, 18 * Math.sin(PI * clamp01((t - 1.1) / 0.5)));
          return true;
        case 'bellyflop':                                         /* penguin chick: hop, flat on its tummy, hop up again */
          o.rate = 0.45 / 0.4; o.intensity = 0.12 / 0.18;
          P.sampleClip('hop', t < 1.0 ? t : t - 1.0, pose, o);
          o.rate = undefined; o.intensity = undefined;
          P.sampleClip('slide', a.idleT, a.tmp, o);
          a.tmp.wingL = a.tmp.wingR = -6; a.tmp.headPitch = -22;
          mixIn(a, pose, smooth01((t - 0.3) / 0.12) * (1 - smooth01((t - 1.0) / 0.12)));
          return true;
        case 'clap':                                              /* seal pup: chest up, three claps at 2 Hz, down */
          P.sampleClip('idle', a.idleT, pose, o);
          P.sampleClip('sit', a.idleT, a.tmp, o);
          H.rearUp(a.tmp, 15);
          a.tmp.legFL = a.tmp.legFR = 45;                         /* the front flippers up before the chest */
          mixIn(a, pose, smooth01(t / 0.2) * (1 - smooth01((t - 1.4) / 0.2)));
          s = t - 0.1;
          if (s > 0 && s < 1.5) { w = 25 * Math.sin(TAU * 2 * s) * env(s, 1.5, 0.08, 0.12); pose.legFLz += w; pose.legFRz += w; }
          return true;
      }
      return false;
    }
    /* the clip time factor that keeps a species' walk at `speed` stepping at ≤ maxHz (its stride measured
       once from the clip layer's legBL, then cached): a play move steps on the spot, never in a buzz */
    var STRIDE = {};
    function strideK(a, speed, maxHz) {
      var key = a.o.species + '|' + speed + '|' + maxHz;
      if (!(key in STRIDE)) {
        var q = {}, o2 = { species: a.o.species, speed: speed, seed: 1 }, N = 240, T = 4, v = [], mean = 0, n = 0, first = -1, last = -1, i;
        for (i = 0; i < N; i++) { P.sampleClip('walk', i * T / N, q, o2); v.push(num(q.legBL, 0)); mean += v[i] / N; }
        for (i = 1; i < N; i++) {                                 /* upward crossings of the mean, interpolated */
          var a0 = v[i - 1] - mean, a1 = v[i] - mean;
          if (a0 < 0 && a1 >= 0 && a1 - a0 > 1e-6) { var tc = (i - 1 + a0 / (a0 - a1)) * T / N; if (first < 0) first = tc; last = tc; n++; }
        }
        var f0 = n >= 2 && last > first ? (n - 1) / (last - first) : 0;
        STRIDE[key] = f0 > maxHz ? maxHz / f0 : 1;
      }
      return STRIDE[key];
    }
    /* one front-paw pat, 0.25 s */
    function pat(x) { return x > 0 && x < 0.25 ? Math.sin(PI * x / 0.25) : 0; }
    /* the tap reaction (crewMoves.tap): 'hop' (every V4.54 pet: the 0.45 s happy hop), 'rear' (the
       pony rears up 18° in place of the hop), 'clap' (the seal pup claps its front flippers once) */
    function tapPose(a, p, pose, th) {
      var o = a.o;
      if (p.tapKind === 'rear') { P.sampleClip('idle', a.idleT, pose, o); H.rearUp(pose, 18 * Math.sin(PI * clamp01(th / 0.45))); return; }
      P.sampleClip('hop', th, pose, o);
      if (p.tapKind === 'clap') { var z = 25 * Math.sin(TAU * 2 * th) * (1 - smooth01((th - 0.3) / 0.15)); pose.legFLz += z; pose.legFRz += z; }
    }
    function perfPose(a, p, pose) {
      var o = a.o, pf = p.perf, now = cb.now;
      if (p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff') {
        var dur = Math.max(0.05, pf.hopDur);
        var t = now - pf.hopT0, u = clamp01(t / dur);
        o.dur = dur;
        P.sampleClip('jump', t, a.base, o);
        P.sampleClip('fall', t, a.tmp, o);
        o.dur = undefined;
        P.mixPose(a.base, a.tmp, smooth01((u - 0.4) / 0.5), pose);
        pose.y = 0;                                             /* the brain owns the arc */
      } else if (p.perfPhase === 'bounce') {
        var vy = (p.bounce - (a.lastBounce == null ? p.bounce : a.lastBounce)) / Math.max(1e-3, a.dt);
        a.lastBounce = p.bounce;
        P.sampleClip('jump', 0.3, a.base, o);                   /* rising: tucked */
        P.sampleClip('fall', a.idleT, a.tmp, o);                 /* falling: paws reach for the mat */
        P.mixPose(a.base, a.tmp, smooth01((1 - vy / 3) / 2), pose);
        pose.y = 0;
        if (p.bounce < 0) {                                      /* sink with the mat */
          var q = clamp01(-p.bounce / 0.12);
          pose.sy *= 1 - 0.16 * q; pose.sx *= 1 + 0.07 * q; pose.sz *= 1 + 0.07 * q;
        }
        if (p.flip > 0) pose.pitch += 360 * inOut(p.flip);       /* the front flip on the last bounce */
      } else if (p.perfPhase === 'sit') {
        P.sampleClip('sit', a.idleT, pose, o);
        if (pf.kind === 'sip' && !o.reduced) {                   /* a happy wiggle on the café stool */
          var wg = Math.sin(TAU * 1.2 * a.idleT);
          pose.hips += 10 * wg; pose.headRoll += 6 * wg; pose.tailPitch = 20;
        } else if (pf.kind === 'roof') {                        /* lounging on the roof deck, taking in the view */
          pose.headRoll += 10; pose.hips += 8; pose.pitch -= 6;
          if (!o.reduced) pose.headYaw += 20 * Math.sin(TAU * 0.1 * a.idleT);
        }
      } else if (p.perfPhase === 'pose') {                       /* the photo booth: sit · paw-point · cheer */
        if (p.perfPose >= 0) P.sampleClip(BOOTH_POSES[p.perfPose], a.idleT, pose, o);
        else P.sampleClip('idle', a.idleT, pose, o);
        pose.faceCam = 1;
      } else if (p.perfPhase === 'leg') legPose(a, p, pose);
      else locomotion(a, p, pose);
    }
    /* a v3 route leg: hops are jump → fall (the brain owns the arc; a hop up to a grip reaches for it),
       the rest play the leg's clip — a seat carries the pet, so a ride clip adds no bob of its own */
    var ONE_SHOT = { lookBack: 1, hop: 1, jump: 1, tumble: 1 };
    function legPose(a, p, pose) {
      var o = a.o, pf = p.perf, m = p.legMode, c = p.perfClip, l = pf.route && pf.route.legs[pf.legIdx], dur = l ? Math.max(0.05, l.t1 - l.t0) : 0.3;
      if (m === 'hop') {
        var t = p.legU * dur;
        o.dur = dur;
        P.sampleClip('jump', t, a.base, o);
        P.sampleClip('fall', t, a.tmp, o);
        o.dur = undefined;
        P.mixPose(a.base, a.tmp, smooth01((p.legU - 0.4) / 0.5), pose);
        pose.y = 0;
        if (p.hang) { pose.legFLz = lerp(pose.legFLz, 140, smooth01(p.legU * 2)); pose.legFRz = pose.legFLz; }
      } else if (m === 'wait' || m === 'pop' || !c || c === 'idle') P.sampleClip('idle', a.idleT, pose, o);
      else if (c === 'pose') { P.sampleClip(BOOTH_POSES[Math.max(0, p.perfPose)], a.idleT, pose, o); }
      else if (c === 'walk' || c === 'run') locomotion(a, p, pose);
      else {
        o.height = 0;
        if (c === 'skate') o.steer = clamp(-p.omega / 2.5, -1, 1);
        if (c === 'beatNod') o.bpm = readClock(false) ? _clk.bpm : DANCE.bpm;
        P.sampleClip(c, ONE_SHOT[c] ? p.legU * dur : c === 'beatNod' ? beatCount() * 60 / o.bpm : a.idleT, pose, o);
        o.height = undefined; o.steer = undefined; o.bpm = undefined;
        if (pf.kind === 'feast' && c === 'sit' && !o.reduced) {   /* tucking in: the café stool's happy wiggle */
          var wg = Math.sin(TAU * 1.2 * a.idleT);
          pose.hips += 10 * wg; pose.headRoll += 6 * wg; pose.tailPitch = 20;
        }
      }
    }

    var LEG_KEY = {};                                            /* 'perf:leg:<mode>:<clip>[:<pose>]', built once */
    function legKey(p) {
      var a = byId[p.id];
      if (a.lkM !== p.legMode || a.lkC !== p.perfClip || a.lkP !== p.perfPose) {
        var k = p.legMode + ':' + p.perfClip + (p.perfClip === 'pose' ? ':' + p.perfPose : '');
        a.lkM = p.legMode; a.lkC = p.perfClip; a.lkP = p.perfPose; a.lk = LEG_KEY[k] || (LEG_KEY[k] = 'perf:leg:' + k);
      }
      return a.lk;
    }
    function updatePet(a, p, dt) {
      var rig = a.rig;
      if (!rig) return;
      var red = reduced, o = a.o, pose = a.pose, now = cb.now;
      resetOpts(o, red);
      a.dt = dt;
      a.idleT += dt;
      if (p.speed > 0.01) a.gaitT += dt;
      /* which behaviour (crossfaded on change) */
      var key, bd = BLEND.dflt;
      if (p.state === 'sit') { key = 'edit'; bd = BLEND.edit; }
      else if (p.state === 'dance') key = p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff' ? 'perf:hop' : now >= cb.danceT0 ? 'dance' : 'loco';
      else if (p.state === 'perform') {
        key = p.perfPhase === 'run' ? 'loco' : p.perfPhase === 'bounce' ? 'perf:bounce' : p.perfPhase === 'sit' ? 'perf:sit' :
          p.perfPhase === 'pose' ? POSE_KEY[p.perfPose + 1] : p.perfPhase === 'leg' ? legKey(p) : 'perf:hop';
        if (p.legMode === 'hop') bd = BLEND.hop;
      }
      else if (!red && now - p.tapT < 0.45) { key = 'hop'; bd = BLEND.hop; }
      else if (p.state === 'act') { key = ACT_KEY[p.action] || (ACT_KEY[p.action] = 'act:' + p.action); bd = BLEND.act; }
      else key = 'loco';
      setKey(a, key, bd);
      if (key !== 'perf:bounce') a.lastBounce = null;

      if (key === 'edit') { o.reduced = true; P.sampleClip('sit', 0, pose, o); o.reduced = red; }
      else if (key === 'loco') locomotion(a, p, pose);
      else if (key === 'hop') tapPose(a, p, pose, now - p.tapT);
      else if (key === 'dance') {
        o.bpm = DANCE.bpm;
        var td = now - cb.danceT0;
        P.sampleClip('dance', cb.danceReduced ? td : Math.min(td, DANCE.dur - 1e-3), pose, o);
        o.bpm = undefined;
      } else if (key.charAt(0) === 'p') perfPose(a, p, pose);
      else actPose(a, p, pose, red);

      /* happy tail (after a tap, at Showtime, while dancing) — tails may beat faster than 2 Hz */
      var sp = P.SPECIES && P.SPECIES[a.species];
      var wantHappy = !red && sp && key !== 'edit' && key !== 'perf:sit' && key !== 'act:nap' && (now < p.happyUntil || showK > 0.5) ? 1 : 0;
      a.happyK += (wantHappy - a.happyK) * clamp01(dt * 4);
      if (a.happyK > 0.01 && sp && key !== 'dance') {
        var hz = sp.happyHz, amp = sp.tailAmp * 1.3, ph = TAU * hz * a.idleT;
        pose.tailYaw = lerp(pose.tailYaw, amp * Math.sin(ph), a.happyK);
        pose.tailPitch = lerp(pose.tailPitch, 18, a.happyK);
      }
      /* head look-at (avatar, an item) */
      a.lookKs += (p.lookK - a.lookKs) * clamp01(dt * 5);
      if (a.lookKs > 0.01) {
        var rel = wrap(Math.atan2(p.lookX - p.x, p.lookZ - p.z) - a.yawShown) / DEG;
        pose.headYaw += clamp(rel, -55, 55) * a.lookKs;
      }
      /* secondary motion: lean into turns, the head leads, tail and ears lag, a nod on speed-ups */
      if (!red && key !== 'dance' && key !== 'edit') {
        var kk = clamp01(dt * 8);
        a.omegaS += (p.omega - a.omegaS) * kk;
        var acc = dt > 0 ? (p.speed - a.lastSpeed) / dt : 0;
        a.accS += (acc - a.accS) * kk;
        var w = a.omegaS;
        pose.roll += clamp(-w * p.speed * 7, -12, 12);
        pose.headYaw += clamp(w * 6, -18, 18);
        pose.tailYaw += clamp(-w * 10, -25, 25);
        pose.earL += clamp(w * 5, -12, 12); pose.earR -= clamp(w * 5, -12, 12);
        pose.pitch += clamp(a.accS * 2, -6, 6);
      }
      a.lastSpeed = p.speed;
      /* the crossfade between behaviours */
      if (a.blend < 1) {
        a.blend = Math.min(1, a.blend + dt / a.blendDur);
        P.mixPose(a.from, pose, smooth01(a.blend), pose);
      }
      /* a little squash on landing from a hop-off or a bounce */
      var ls = cb.now - a.landT;
      if (!red && ls >= 0 && ls < 0.18) { var s = Math.sin(PI * ls / 0.18); pose.sy *= 1 - 0.1 * s; pose.sx *= 1 + 0.05 * s; pose.sz *= 1 + 0.05 * s; }
      if (a.crown && P.crownGlint) pose.glint = Math.max(pose.glint || 0, P.crownGlint(a.idleT, (a.seed % 1000) / 1000, red));
      pose.wave = red || key === 'edit' ? 0 : a.idleT;           /* one continuous cloth clock (frozen when still) */
      /* the wobbly mirrors' stretch (poseScale) lasts only while the pet performs, never under reduced motion */
      if (red || p.state !== 'perform') { a.psx = 1; a.psy = 1; }
      if (a.psx !== 1 || a.psy !== 1) { pose.sx *= a.psx; pose.sz *= a.psx; pose.sy *= a.psy; }
      rig.setPose(pose);
      /* the headphone rings pulse on the beat at Showtime (the rig keeps it under 2 Hz) — only while
         island music plays (cb.music: setMusic / beat.playing); otherwise they hold steady */
      if (a.phones && typeof rig.setBeat === 'function') rig.setBeat(beatCount(), readClock(false) ? _clk.bpm : DANCE.bpm, red || !cb.music);
      /* the root: brain position, body yaw (+ the clip's 'face the camera' hint, eased) */
      a.fcS += (clamp01(num(pose.faceCam, 0)) - a.fcS) * (red ? 1 : clamp01(dt * 8));
      var yaw = p.yaw;
      if (a.fcS > 0.001) yaw = p.yaw + wrap(yawToCam(p.x, p.z) - p.yaw) * a.fcS;
      a.yawShown = yaw;
      /* the root: the brain's island frame; a pet under a grip hangs as far again as the crew is scaled up */
      var f = cb.frame || ZERO, px = p.x + f.ox, py = p.y + f.oy - (p.hang ? HANG_R * (CREW - 1) : 0), pz = p.z + f.oz;
      rig.root.position.set(px, py, pz);
      rig.root.rotation.set(0, yaw, 0);
      /* anchors, hit sphere, blob shadow */
      var lift = num(pose.y, 0) * CREW, top = topOf(a.species) * num(pose.sy, 1) * CREW;
      a.ax = px; a.ay = py + lift + top; a.az = pz;
      var h = a.hit; h.x = px; h.y = py + lift + 0.3 * CREW; h.z = pz; h.pickable = mode === 'play' && (!isleBrain || cb === isleBrain); h.r = HIT_R * CREW;
      if (blobs && a.blob >= 0) {
        var gy = groundUnder(p), hgt = Math.max(0, p.y + lift - gy), sc = BLOB.pet * CREW * (1 - BLOB.shrink * clamp01(hgt / BLOB.lift));
        blobs.set(a.blob, px, gy + f.oy, pz, sc, sc * 0.85);
      }
    }
    var ZERO = { ox: 0, oy: 0, oz: 0 };
    function groundUnder(p) {
      var B = opts.Brain || root.SLPetBrain, g = brain && cb.graph;
      if (p.state === 'travel') return p.y;                          /* on a bridge deck */
      if (p.perfPhase === 'leg' && p.perf) {                         /* on the item: under its feet, hops keep it below */
        var t0 = B && g ? B.heightAt(g, p.x, p.z) : 0;
        if (p.hang || p.legMode === 'wait') return t0;
        return p.legMode === 'hop' ? Math.max(t0, Math.min(p.perf.ly, p.y)) : Math.max(t0, p.y);
      }
      if ((p.state === 'perform' || p.danceMark) && (p.onSeat || p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff') && p.perf) {
        var k = p.onSeat ? 1 : p.hop, seatY = p.danceMark ? p.danceMark.y : p.perf.sy;
        var gx = B && g ? B.heightAt(g, p.x, p.z) : 0;
        return lerp(gx, seatY, smooth01(k));
      }
      return B && g ? B.heightAt(g, p.x, p.z) : 0;
    }

    /* ---------- dance cues: the dragon's sparkle puff, the burst + the avatar's finger-heart, 'cheer' ---------- */
    function danceCues() {
      if (!brain) return;
      if (!brain.danceOn) { danceWasOn = false; return; }
      if (!danceWasOn || danceSeen !== brain.danceT0) {
        danceWasOn = true; danceSeen = brain.danceT0; danceCue = 0;
        if (brain.danceReduced) {                                 /* reduced: one group pose with a sparkle fade */
          actors.forEach(function (a) { if (a.rig && a.hosted) sparkles(a.ax, a.ay - 0.2, a.az, 5, EMOTE.colors.sparkle, 0.8); });
          if (avatar) sparkles(avatar.x, avatar.y + 0.8, avatar.z, 5, EMOTE.colors.sparkle, 0.8);
          danceCue = 9;
        }
      }
      if (brain.danceReduced) return;
      var t = brain.now - brain.danceT0, beat = DANCE.beat;
      if (danceCue === 0 && t >= 4 * beat) {
        danceCue = 1;
        actors.forEach(function (a) { if (a.species === 'pet_dragon' && a.rig) sparkles(a.ax, a.ay - 0.15, a.az, 8, EMOTE.rainbow, 0.8); });
      }
      if (danceCue === 1 && t >= 7 * beat) {
        danceCue = 2;
        /* count 8 (the freeze): a sparkle burst over the crew and the avatar's finger-heart, sized
           to fit the 32-sprite pool (the line-heart takes HEART_LINE.dots of it) */
        var free = FX_CAP - (avatar ? HEART_LINE.dots : 0);
        var n = Math.min(6, Math.max(3, Math.floor(free / (actors.length + (avatar ? 1 : 0)) - 1)));
        actors.forEach(function (a) { if (a.rig && a.hosted) sparkles(a.ax, a.ay - 0.1, a.az, n, EMOTE.rainbow, 1); });
        if (avatar) { heartLine(avatar); sparkles(avatar.x, avatar.y + 0.9, avatar.z, n, EMOTE.rainbow, 1); }
      }
      if (danceCue === 2 && t >= DANCE.dur) { danceCue = 3; sfx('cheer', 0, 0.8); }
    }

    /* ================================================================
       THE AVATAR
       ================================================================ */
    function syncAvatar() {
      var key = avatarKeyOf(avatarInfo);
      if (avatar && (!avatarInfo || !avatarSpot || avatar.key !== key)) dropAvatar();
      if (!avatarInfo || !avatarSpot || avatar) { if (avatar) placeAvatar(); return; }
      var rig = null, emoji = avatarInfo.emoji || avatarInfo.avatar || '';
      try { if (R && typeof R.makeAvatar === 'function') rig = R.makeAvatar({ color: avatarInfo.color, emoji: emoji }, tier); } catch (e0) { rig = null; }
      try { if (!rig && typeof SL3D.makeAvatar === 'function') rig = SL3D.makeAvatar({ color: avatarInfo.color, emoji: emoji }, tier); } catch (e) { rig = null; }
      if (!rig) { try { rig = placeholderAvatar(K, avatarInfo.color); } catch (e2) { rig = null; } }
      if (!rig) return;
      if (CREW !== 1 && rig.root && rig.root.scale) rig.root.scale.set(CREW, CREW, CREW);
      group.add(rig.root);
      avatar = {
        rig: rig, key: key, x: 0, y: 0, z: 0, yaw: 0, ax: 0, ay: 0, az: 0, gone: false,
        pose: P.restAvatar({}), from: P.restAvatar({}), blend: 1, blendDur: BLEND.dflt, akey: '',
        idleT: 0, tapT: -99, tapKind: '', tapN: 0, cueShown: true, showT: 0, atMark: false,
        seed: hash('avatar:' + key) >>> 0, wand: false,
        blob: blobs ? blobs.alloc() : -1,
        hit: { kind: 'me', id: 'me', x: 0, y: 0, z: 0, r: HIT_R, pickable: true },
        o: { reduced: false, seed: hash('avatar') >>> 0, phase: (hash(key) % 997) / 997, bpm: undefined }
      };
      if (typeof rig.setShow === 'function') rig.setShow(showK);
      setWand(showK > 0.5);
      placeAvatar();
    }
    /* the avatar's home: the left entrance cell of the house (unless it is up on a stage mark) */
    function placeAvatar() {
      if (!avatar || !avatarSpot || avatar.atMark) return;
      avatar.x = avatarSpot.x; avatar.y = num(avatarSpot.y, 0); avatar.z = avatarSpot.z;
    }
    /* up onto the stage / the studio floor while the crew performs there, and home again: a
       sparkle pop each way (still fades under reduced motion) */
    function followMark() {
      var ab = isleBrain || brain, A = avatar, am = ab && ab.avatarMark, on = !!(am && am.on && avatarSpot);
      if (on === A.atMark && (!on || (A.x === am.x && A.y === am.y && A.z === am.z))) return;
      var x0 = A.x, y0 = A.y, z0 = A.z;
      A.atMark = on;
      if (on) { A.x = am.x; A.y = am.y; A.z = am.z; } else placeAvatar();
      sparkles(x0, y0 + 0.6, z0, 6, EMOTE.colors.sparkle, 0.8);
      sparkles(A.x, A.y + 0.6, A.z, 8, EMOTE.rainbow, 0.9);
    }
    function dropAvatar() {
      if (!avatar) return;
      avatar.gone = true;
      try { avatar.rig.dispose(); } catch (e) { /* ignore */ }
      if (blobs && avatar.blob >= 0) blobs.free(avatar.blob);
      avatar = null;
    }
    function setWand(on) {
      if (!avatar || avatar.wand === on) return;
      avatar.wand = on;
      if (typeof avatar.rig.setWand === 'function') avatar.rig.setWand(on);
    }
    function avSetKey(k, dur) {
      if (avatar.akey === k) return;
      if (avatar.akey && !reduced) { copyPose(AV_KEYS, avatar.pose, avatar.from); avatar.blend = 0; avatar.blendDur = dur || BLEND.dflt; }
      else avatar.blend = 1;
      avatar.akey = k;
    }
    /* the continuous beat count (music clock, else our own 118 BPM clock) */
    function beatCount() {
      var c = readClock(false);
      return c && c.perBar ? c.beat : now * DANCE.bpm / 60;
    }
    function tapDur(kind) { return kind === 'wave' ? AV_TAP.wave + AV_TAP.heart : AV_TAP[kind] || AV_TAP.heart; }
    function updateAvatar(dt) {
      if (!avatar) return;
      var A = avatar, rig = A.rig, o = A.o, pose = A.pose, red = reduced, bt = brain ? brain.now : now;
      o.reduced = red; o.bpm = undefined;
      A.idleT += dt;
      A.showT = showK > 0.5 ? A.showT + dt : 0;
      followMark();
      var ab = isleBrain || brain, tap = bt - A.tapT, tk = A.tapKind, dancing = ab && ab.danceOn && ab.now >= ab.danceT0, k;
      if (dancing) k = 'dance';
      else if (tk && tap >= 0 && tap < tapDur(tk)) k = tk === 'wave' ? (tap < AV_TAP.wave ? 'wave' : 'heart') : tk;
      else k = showK > 0.5 ? 'show' : 'idle';
      avSetKey(k, k === 'heart' || k === 'vsign' || k === 'micpoint' ? 0.15 : BLEND.dflt);
      if (AV_TAP_SFX[k] && !A.cueShown) {                           /* each tap emote lands once with its cue */
        A.cueShown = true;
        if (k === 'heart') heartLine(A);                             /* the finger-heart: a neon line-heart */
        else emoteSprite(A, k === 'vsign' ? 'star' : 'note', -0.06);
        sfx(AV_TAP_SFX[k], A.x, 0.8);
      }
      if (k === 'dance') {
        o.bpm = DANCE.bpm;
        var td = ab.now - ab.danceT0;
        P.sampleAvatar('dance', ab.danceReduced ? td : Math.min(td, DANCE.dur - 1e-3), pose, o);
      } else if (k === 'wave' || k === 'cheer' || k === 'vsign' || k === 'micpoint') P.sampleAvatar(k, tap, pose, o);
      else if (k === 'heart') P.sampleAvatar('heart', tk === 'wave' ? tap - AV_TAP.wave : tap, pose, o);
      else {
        P.sampleAvatar('idle', A.idleT, pose, o);
        if (!red && ab && ab.pets.length) {                         /* the glance goes to a real pet (on this island) */
          ab.glance(_glance);
          var q = ab.pets[Math.min(ab.pets.length - 1, Math.floor(_glance.pick * ab.pets.length))], qf = ab.frame || ZERO;
          var rel = wrap(Math.atan2(q.x + qf.ox - A.x, q.z + qf.oz - A.z) - A.yaw) / DEG;
          pose.headYaw = clamp(rel, -50, 50) * _glance.k;
        }
        if (k === 'show') {                                          /* the Spark Stick up, swaying once per two beats (≤ 1 Hz) */
          var sw = red ? 0 : Math.sin(PI * beatCount());
          pose.armR = 118 + 14 * sw; pose.armRf = 12; pose.headRoll = 3 + 3 * sw;
          pose.twirl = P.twirlAt ? P.twirlAt(A.showT, red) : 0;     /* a 360° twirl over 1.2 s every 8 s */
        }
      }
      if (A.blend < 1) { A.blend = Math.min(1, A.blend + dt / A.blendDur); mixAv(P, A.from, pose, smooth01(A.blend), pose); }
      setWand(showK > 0.5 || dancing);
      rig.setPose(pose);
      var face = clamp(wrap(yawToCam(A.x, A.z)), -0.5, 0.5);
      A.yaw = face;
      rig.root.position.set(A.x, A.y, A.z);
      rig.root.rotation.set(0, face, 0);
      A.ax = A.x; A.ay = A.y + (num(pose.y, 0) + AV_TOP) * CREW; A.az = A.z;
      var h = A.hit; h.x = A.x; h.y = A.y + (AV_HIT_Y + num(pose.y, 0)) * CREW; h.z = A.z; h.pickable = mode === 'play'; h.r = HIT_R * CREW;
      if (blobs && A.blob >= 0) {
        var sc = BLOB.avatar * CREW * (1 - BLOB.shrink * clamp01(Math.max(0, num(pose.y, 0)) / BLOB.lift));
        blobs.set(A.blob, A.x, A.y, A.z, sc, sc * 0.85);
      }
    }
    /* 'wave' (then the finger-heart), 'heart' (straight to the finger-heart) or 'cheer' */
    /* kind 'cycle' (a tap): the finger-heart first, then the V-sign and the mic-point in a per-child
       order; or 'wave' (then the finger-heart), 'heart', 'vsign', 'micpoint', 'cheer' */
    function avatarTap(kind) {
      if (!avatar) return false;
      var bt = brain ? brain.now : now;
      if (kind === 'cycle') {
        var n = avatar.tapN++ % 3;
        kind = n === 0 ? 'heart' : (avatar.seed & 1 ? AV_CYCLE_B : AV_CYCLE_A)[n - 1];
      }
      avatar.tapT = bt; avatar.tapKind = kind || 'wave'; avatar.cueShown = false;
      if (reduced) poseAll(0);
      return true;
    }

    /* ================================================================
       FRAME
       ================================================================ */
    /* the music's beat clock → {beat, bpm, perBar} | null. A number < 1 is only a beat
       fraction (align to beats); a count or SLMusic.clock() aligns the dance to bars. */
    var _clk = { beat: 0, bpm: 118, perBar: true };
    function readClock(askMusic) {
      var c = lastBeat, M = root.SLMusic;
      /* SLMusic.clock() allocates, so it is only asked at a dance start, never per frame */
      if (c == null && askMusic && M && typeof M.clock === 'function') { try { c = M.clock(); } catch (e) { c = null; } }
      if (typeof c === 'number' && isFinite(c)) { _clk.beat = c; _clk.bpm = DANCE.bpm; _clk.perBar = c >= 1; return _clk; }
      if (c && typeof c === 'object' && isFinite(c.beat) && c.bpm > 0) { _clk.beat = c.beat; _clk.bpm = c.bpm; _clk.perBar = true; return _clk; }
      return null;
    }
    function poseAll(dt) {
      if (!brain) return;
      var i, a;
      for (i = 0; i < actors.length; i++) actors[i].seen = false;
      poseOf(brain, dt);
      if (isleBrain) poseOf(isleBrain, dt);
      cb = brain;
      /* a rig shows only while a brain hosts its pet (a land's guest waits for the camera) */
      for (i = 0; i < actors.length; i++) {
        a = actors[i];
        if (a.seen && !a.hosted) { a.hosted = true; if (a.rig && a.rig.root) a.rig.root.visible = true; }
        else if (!a.seen && a.hosted) hideActor(a);
      }
      updateAvatar(dt);
      if (blobs) blobs.commit();
    }
    function poseOf(b, dt) {
      cb = b;
      for (var i = 0; i < b.pets.length; i++) {
        var p = b.pets[i], a = byId[p.id];
        if (a && !a.seen) { a.seen = true; a.hb = b; updatePet(a, p, dt); }
      }
    }
    function update(dt, t, show, beat) {
      if (disposed) return false;
      dt = clamp(num(dt, 0), 0, 0.1);
      now += dt; fxNow += dt;
      if (typeof show === 'number') setShow(show);
      lastBeat = beat == null ? null : beat;
      var music = musicSet != null ? musicSet : !!(beat && typeof beat === 'object' && (beat.playing || beat.music));
      if (brain) brain.setMusic(music);
      if (!brain) { updateAvatar(dt); if (blobs) blobs.commit(); return updateFx(dt) || !reduced; }
      /* the camera has arrived: the visited land's own mascots come out (D112) */
      if (guestsDue >= 0 && now >= guestsDue - 1e-9) { guestsDue = -1; syncCrew(lastView || { placed: [] }, lastView || { placed: [] }); }
      var c = camPos(), cx = c.x, cz = c.z;
      brain.camYaw = Math.atan2(cx, cz);
      var moving = brain.step(dt);
      if (isleBrain) {
        isleBrain.setMusic(music);
        isleBrain.camYaw = Math.atan2(cx - isleBrain.frame.ox, cz - isleBrain.frame.oz);
        moving = isleBrain.step(dt) || moving;
      }
      drainEvents();
      poseAll(dt);
      danceCues();
      var fxLive = updateFx(dt);
      if (!reduced) return true;
      var blending = false;
      for (var i = 0; i < actors.length; i++) if (actors[i].blend < 1) blending = true;
      if (avatar && avatar.blend < 1) blending = true;
      return moving || fxLive || blending;
    }

    /* ================================================================
       PUBLIC
       ================================================================ */
    function petIdOf(target) {
      if (typeof target !== 'string') return null;
      var id = target.indexOf('pet:') === 0 ? target.slice(4) : target;
      return byId[id] ? id : null;
    }
    function isMe(target) { return target === 'me' || target === 'avatar' || target === 'you'; }
    /* the brain a pet is out on now: the visited island's (the active pet) or Home's */
    function hostOf(id) {
      if (isleBrain && isleBrain.pet(id) && !isleBrain.isAway(id)) return isleBrain;
      return brain && brain.pet(id) && !(brain.isAway && brain.isAway(id)) ? brain : null;
    }
    function tap(target) {
      if (disposed) return false;
      if (isMe(target)) return avatarTap('cycle');
      var id = petIdOf(target), a = id && byId[id], hb = id && hostOf(id), p = hb && hb.pet(id);
      if (!a || !p) return false;
      var kind = hb.tap(id) || 'star', f = hb.frame || ZERO;
      if (p.species === 'pet_dragon' && kind === 'sparkle') sparkles(p.x + f.ox, p.y + f.oy + 0.55, p.z + f.oz + 0.15, 9, EMOTE.rainbow, 0.7);   /* the dragon: sparkles, never fire */
      else emoteSprite(a, kind, 0);
      if (opts.voice !== false) voice(id, p.x + f.ox);
      if (reduced) poseAll(0);
      return true;
    }
    function emote(target, kind) {
      if (disposed) return false;
      kind = kind || 'star';
      if (target === 'all' || target === 'pets') {
        var any = false;
        actors.forEach(function (a) { any = emote('pet:' + a.id, kind) || any; });
        if (target === 'all' && avatar) any = emote('me', kind === 'hop' || kind === 'happy' ? 'heart' : kind) || any;
        return any;
      }
      if (isMe(target)) {
        if (!avatar) return false;
        if (AV_EMOTE[kind]) return avatarTap(AV_EMOTE[kind]);       /* a heart is always the finger-heart */
        emoteSprite(avatar, kind, -0.06);
        return true;
      }
      var id = petIdOf(target), a = id && byId[id], hb = id && hostOf(id), p = hb && hb.pet(id), f = hb ? hb.frame || ZERO : ZERO;
      if (!a || !p) return false;
      if (kind === 'hop' || kind === 'happy') {
        var k2 = hb.tap(id);
        if (kind === 'happy') emoteSprite(a, 'star', 0);
        else if (k2 === 'sparkle' && p.species === 'pet_dragon') sparkles(p.x + f.ox, p.y + f.oy + 0.55, p.z + f.oz + 0.15, 7, EMOTE.rainbow, 0.6);
        return true;
      }
      if (kind === 'rainbow' || kind === 'sparkle') { sparkles(p.x + f.ox, p.y + f.oy + 0.55, p.z + f.oz, 8, kind === 'rainbow' ? EMOTE.rainbow : EMOTE.colors.sparkle, 0.7); return true; }
      emoteSprite(a, kind, 0);                                   /* a pet's 'heart' shows a star */
      p.happyUntil = Math.max(p.happyUntil, hb.now + 1.5);
      return true;
    }
    function dance(on) {
      if (disposed || !brain) return 0;
      if (!on) { brain.dance(false); if (isleBrain) isleBrain.dance(false); return 0; }
      var c = readClock(true), o = c ? { beat: c.beat, bpm: c.bpm, perBar: c.perBar } : {}, d = brain.dance(true, o);
      return isleBrain ? Math.max(d, isleBrain.dance(true, o)) : d;
    }
    function brains(fn) { if (brain) fn(brain); if (isleBrain) fn(isleBrain); }
    function setShow(k) {
      k = clamp01(num(k, 0));
      if (Math.abs(k - showK) < 1e-4) return;
      showK = k;
      brains(function (b) { b.setShow(k); });
      actors.forEach(function (a) { if (a.rig && typeof a.rig.setShow === 'function') a.rig.setShow(k); });
      if (avatar) { if (typeof avatar.rig.setShow === 'function') avatar.rig.setShow(k); setWand(k > 0.5); }
    }
    function setReduced(on) {
      reduced = !!on;
      brains(function (b) { b.setReduced(reduced); });
      if (reduced && guestsDue >= 0) { guestsDue = -1; syncCrew(lastView || { placed: [] }, lastView || { placed: [] }); }   /* the land's own mascots at once */
      drainEvents();
      poseAll(0);
    }
    function setMode(m) {
      mode = m === 'edit' || m === 'place' ? m : 'play';
      brains(function (b) { b.setMode(mode); });
      if (reduced) poseAll(0);
    }
    function active() {
      if (!brain || mode !== 'play') return null;
      return isleBrain && isleBrain.activeId() ? isleBrain.activeId() : brain.activeId();
    }
    /* the crew performs at an item (on the visited island the active pet does); the avatar joins the
       Concert Stage, and the Dance Studio at Showtime */
    var JOIN = { avatar: true }, ALONE = { avatar: false };
    function perform(kind, uid) {
      if (disposed || !brain) return -1;
      var withMe = !!avatar && (kind === 'stage' || (kind === 'studio' && showK > 0.5));
      var b = isleBrain && isleBrain.graph && isleBrain.graph.objects[uid] ? isleBrain : brain;
      var lead = b.perform(kind, uid, undefined, withMe ? JOIN : ALONE);
      return typeof lead === 'number' && isFinite(lead) ? lead : -1;
    }
    /* the wobbly mirrors stretch the performing pet: pose scale [sx, sy] on top of its clip (1 = none) */
    function poseScale(petId, sx, sy) {
      var id = petId || active(), a = id && byId[id];
      if (!a || reduced || disposed) return false;
      a.psx = clamp(num(sx, 1), 0.5, 2); a.psy = clamp(num(sy, 1), 0.5, 2);
      return true;
    }

    /* ---------- My Island v3: the visited sky island (D29 / D83) ---------- */
    function islandBrain(k) {
      var b = Brain.create({ seed: (opts.seed == null ? 'island-pets' : opts.seed) + ':' + k, reduced: reduced, isle: k });
      if (anchorFnSet) b.setAnchorFn(anchorFnSet);
      b.setShow(showK); b.setMusic(!!brain.music);
      b.sync({ world: lastView || { placed: [] }, pets: [], mode: mode });
      return b.isle === k ? b : null;
    }
    function crewActive() { return brain ? brain.activeId() || (isleBrain && isleBrain.activeId()) || activeRec : null; }
    /* the avatar stands on the visited island's dock (on Home: by the house), a sparkle each way */
    function moveAvatar() {
      var spot = !avatarInfo ? null : isleBrain ? isleBrain.dockSpot({}) : spotOf(placedOf(lastView));
      if (avatar && spot && avatarSpot && !reduced && (spot.x !== avatarSpot.x || spot.z !== avatarSpot.z)) sparkles(spot.x, num(spot.y, 0) + 0.6, spot.z, 8, EMOTE.rainbow, 0.9);
      avatarSpot = spot;
      if (avatar) { avatar.atMark = false; placeAvatar(); }
      syncAvatar();
    }
    /* the active pet follows the child: visit {isle, flight (s), instant} — island to island via Home,
       a locked land (no bridge) keeps it home; LOW or reduced motion: it appears at the dock with one
       sparkle. → the seconds its crossing takes (0 = there now) */
    function follow(visit) {
      if (disposed || !brain || !Brain || typeof Brain.crossing !== 'function') return 0;
      var k = visit && SKY_ISLES.indexOf(visit.isle) >= 0 ? visit.isle : 'home';
      if (k === isle) {                                   /* already there: an instant call = the camera has landed */
        if (guestsDue >= 0 && visit && visit.instant) { guestsDue = -1; syncCrew(lastView || { placed: [] }, lastView || { placed: [] }); drainEvents(); if (reduced) poseAll(0); }
        return 0;
      }
      var to = k === 'home' ? brain : islandBrain(k);
      if (!to || (k !== 'home' && !to.graph.free)) return 0;                 /* locked: the pet stays home */
      var id = activeRec || crewActive(), from = id ? hostOf(id) : null, old = isleBrain;
      var instant = !!(visit && visit.instant) || reduced || tier === 'LOW';
      var r = id && from ? Brain.crossing(from, to, id, { flight: visit && visit.flight, instant: instant, home: brain }) : null;
      if (old && old !== to) {
        /* one of the crew left behind on the island the child leaves (the runner changed there) comes home */
        old.pets.forEach(function (q) { if (q.id !== id && !q.guest && brain.isAway && brain.isAway(q.id)) brain.setAway(q.id, false); });
        drainOf(old);
      }
      isleBrain = k === 'home' ? null : to; isle = k;
      /* the land's own mascots (D112): out when the camera arrives (visit.flight s; at once under
         reduced motion or an instant visit), taking turns from visit to visit */
      guestPlan = []; guestsDue = -1;
      if (isleBrain) {
        visitN = LAND_VISITS[k] = (LAND_VISITS[k] || 0) + 1;
        var fl = visit && !visit.instant && !reduced ? Math.max(0, num(visit.flight, 0)) : 0;
        if (fl > 0) guestsDue = now + fl;
      }
      crossId = r ? id : null;
      syncCrew(lastView || { placed: [] }, lastView || { placed: [] });
      crossId = null;
      moveAvatar();
      drainEvents();
      if (reduced) poseAll(0);
      return r ? r.seconds : 0;
    }
    function setIsle(k) { return follow({ isle: k, instant: true }) >= 0; }
    function hits(out) {
      out = out || _hits;
      out.length = 0;
      for (var i = 0; i < actors.length; i++) if (actors[i].rig && actors[i].hosted) out.push(actors[i].hit);
      if (avatar) out.push(avatar.hit);
      return out;
    }
    function anchorOf(target, out) {
      out = out || {};
      var me = isMe(target), a = me ? avatar : byId[petIdOf(target)];
      if (!a || (!me && !a.hosted)) return null;
      out.x = a.ax; out.y = a.ay; out.z = a.az;
      return out;
    }
    function info() {
      var calls = 0, tris = 0;
      function count(rig) {
        if (!rig) return;
        if (rig.meshes) for (var k in rig.meshes) if (rig.meshes[k] && rig.meshes[k].visible !== false) calls++;
        tris += num(rig.tris, 0);
      }
      actors.forEach(function (a) { count(a.rig); });
      if (avatar) count(avatar.rig);
      if (blobs) calls++;
      if (fxPool) calls++;
      var shown = 0, guests = [];
      actors.forEach(function (a) { if (a.hosted) shown++; });
      if (isleBrain) isleBrain.pets.forEach(function (q) { if (q.guest) guests.push(q.id); });
      return { pets: actors.length, avatar: !!avatar, calls: calls, tris: Math.round(tris), mode: mode, reduced: reduced, show: showK, dance: !!(brain && brain.danceOn), isle: isle, crewScale: CREW,
               /* W3b.12: the rigs that exist (≤ crewRigs), how many are out now, how many rest indoors, the land's guests */
               rigs: actors.length, shown: shown, resting: Math.max(0, crew.length - actors.length), guests: guests, crewRigs: CAP.rigs, landMascots: CAP.land };
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      actors.forEach(dropActor);
      actors.length = 0;
      for (var k in byId) delete byId[k];
      dropAvatar();
      for (var i = 0; i < fx.length; i++) fx[i].on = false;
      if (fxPool) fxPool.dispose();
      if (blobs) blobs.dispose();
      if (group.parent) group.parent.remove(group);
      if (typeof group.clear === 'function') group.clear();
    }

    var api = {
      version: VERSION, group: group, brain: brain,
      sync: sync, update: update, perform: perform, active: active, tap: tap, emote: emote, dance: dance,
      setShow: setShow, setReduced: setReduced, setMode: setMode,
      setCamera: function (cam) { camera = cam || null; },
      /* music on / off for the beat-nod idle (null: follow beat.playing / beat.music from update) */
      setMusic: function (on) { musicSet = on == null ? null : !!on; if (on != null) brains(function (b) { b.setMusic(!!on); }); },
      /* fn(uid, name) → {x, y, z} | null (world): the items' live anchors for the crew's performances */
      setAnchorFn: function (fn) { anchorFnSet = typeof fn === 'function' ? fn : null; brains(function (b) { b.setAnchorFn(anchorFnSet); }); },
      hits: hits, anchorOf: anchorOf, info: info, dispose: dispose,
      /* v3: follow(visit) → crossing seconds · setIsle(isle) (at once) · poseScale(petId, sx, sy) */
      follow: follow, setIsle: setIsle, poseScale: poseScale,
      petsApi: { active: function () { return active(); }, perform: function (kind, uid) { return perform(kind, uid); },
                 poseScale: function (petId, sx, sy) { return poseScale(petId, sx, sy); } }
    };
    Object.defineProperty(api, 'isleBrain', { get: function () { return isleBrain; } });
    Object.defineProperty(api, 'isle', { get: function () { return isle; } });
    if (opts.camera) camera = opts.camera;
    return api;
  }

  function register(SL3D) {
    if (!SL3D || typeof SL3D.defineApi !== 'function' || SL3D.__slActors) return false;
    SL3D.__slActors = true;
    SL3D.defineApi('makeActors', function (K, S) { return function (opts) { return create(K, S, opts); }; });
    return true;
  }

  return {
    VERSION: VERSION, create: create, register: register,
    TOP_Y: TOP_Y, BLOB: BLOB, BLEND: BLEND, EMOTE: EMOTE, HIT_R: HIT_R, FX_CAP: FX_CAP,
    HEART_LINE: HEART_LINE, AV_TAP: AV_TAP, AV_TAP_SFX: AV_TAP_SFX, BOOTH_POSES: BOOTH_POSES
  };
}));
