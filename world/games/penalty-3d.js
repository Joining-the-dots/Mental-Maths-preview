/* ================================================================
   Encore Shootout — the 3D view (ES module, three r170 via the import map).
   The shell (world/games/shell.js) imports this file and calls
     create(mid, {THREE, cfg, api, def, reduced, onFail, demo?}) → Promise<view>
     view = {canvas, overlay, frame(round|null, dt, alpha, phase, countT), resize(w, h),
             setRound(round|null, variant), setRival(variant), dispose(), info()}
   and inserts view.canvas under its transparent 2D canvas (still the tap target).

   READ-ONLY: the view reads round.state (penalty.js) and drains the s.ev queue
   past the last n it saw; it never writes game state. Every pose is worked out
   by the pure director penalty-3d-core.js (camera, keeper, ball, crowd, light);
   this file only turns events into one-shot effects, blends cameras, feeds the
   rigs and renders. Fails over to 2D (opts.onFail) on: no renderer, a second
   context loss, sustained < 20 fps after every quality step, or any throw.

   Renderer: the shared one from SL3D.lease('game', …) (the island pauses), never
   started — the shell's loop drives frame(). Release on dispose hands it back.
   Files: penalty-3d-core.js (pure, UMD), -models.js (builders), -fx.js
   (pooled particles), -hud.js (HTML overlay). Spec: docs/island3d/spec-penalty.json.
   ================================================================ */
import * as THREE from 'three';

const STEP = 1 / 120;
const TAU = Math.PI * 2;
/* night floodlight towers [x, height, z] */
const FLOODS = [[-9.6, 7.2, -8.6], [9.6, 7.2, -8.6], [-12.2, 6.6, 3.5], [12.2, 6.6, 3.5]];
const PET_VOICE = { pet_puppy: 'yip', pet_kitten: 'mew', pet_bunny: 'thump', pet_dragon: 'trill' };
const DEADLINE_MS = 7000;                 /* the view's loading deadline (the runtime's ensure) */
const TAP_HZ = 1.5, TAP_DEG = 12;         /* the child's figure taps a foot while the aim waits (≤ 2 Hz) */
const LOCAL_BUDGET = {
  LOW: { tier: 'LOW', pixelRatioCap: 1, antialias: false, particles: 128, snow: 60, stars: 120, outlines: false },
  MID: { tier: 'MID', pixelRatioCap: 1.5, antialias: true, particles: 256, snow: 100, stars: 250, outlines: true },
  HIGH: { tier: 'HIGH', pixelRatioCap: 2, antialias: true, particles: 512, snow: 150, stars: 250, outlines: true }
};

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function siteUrl(path) {
  const v = (typeof window !== 'undefined' && window.SL_WORLD_VER) || '1';
  return new URL(path + '?v=' + v, document.baseURI).href;
}
function injectScript(src) {
  return new Promise((res) => {
    const el = document.createElement('script');
    el.src = src; el.async = false;
    el.onload = () => res(true); el.onerror = () => res(false);
    document.head.appendChild(el);
  });
}
function isQa() {
  try { return localStorage.getItem('slQaMode') === '1'; } catch (e) { return false; }   /* never from the URL */
}
/* the shared runtime (CONTRACTS §6): inject stage.js once when the island hasn't, then ensure() */
async function ensureRuntime() {
  try {
    if (!window.SLIsland3D) await injectScript(siteUrl('world/island3d/stage.js'));
    if (window.SLIsland3D && typeof window.SLIsland3D.ensure === 'function') {
      const S = await window.SLIsland3D.ensure({ deadlineMs: 7000 });
      return S && S.ready ? S : null;
    }
  } catch (e) { /* fall through to the stand-alone kit */ }
  return null;
}
/* no SL3D: build a private kit from kit.js (still the shared toon look), guessing the tier */
async function fallbackKit() {
  if (!window.SLKit) await injectScript(siteUrl('world/island3d/kit.js'));
  if (!window.SLKit || typeof window.SLKit.create !== 'function') return null;
  const addons = {};
  try { const m = await import('three/addons/geometries/RoundedBoxGeometry.js'); addons.RoundedBoxGeometry = m.RoundedBoxGeometry; } catch (e) { /* boxes stay square */ }
  const hub = window.SLKit.create(THREE, { addons, look: () => window.SLIslandLook || null });
  const Tier = window.SLTier, dpr = window.devicePixelRatio || 1;
  let tier = 'MID';
  if (Tier) tier = Tier.decide(Tier.facts(navigator, {}));
  else if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && (navigator.hardwareConcurrency || 4) <= 4)) tier = 'LOW';
  const budget = Tier ? Tier.budget(tier, dpr) : Object.assign({}, LOCAL_BUDGET[tier], { pixelRatio: Math.min(dpr, LOCAL_BUDGET[tier].pixelRatioCap) });
  const quality = { pixelRatio: budget.pixelRatio, outlines: !!budget.outlines, particleScale: 1, cones: true, steps: [] };
  return { K: hub.kit(tier), hub, tier, budget, quality };
}
/* the games' people helper (KU-CH16, window.SLGamePeople) when the page has it, else null: an older
   page keeps the V4.54 staging (the pet kicks, the avatar cheers on the touchline) */
function peopleHelper() {
  const G = typeof window !== 'undefined' ? window.SLGamePeople : null;
  return G && typeof G.playerRig === 'function' && typeof G.clipFor === 'function' && typeof G.petOf === 'function' ? G : null;
}
/* ---------------- the vox exposure fit (crisp CR5; contracts.vox) ----------------
   The striker (a mascot, a pet in land gear, later the child's character) is a voxel rig drawn by
   the shared 'pixel-vox' program, whose uVoxGain scales its lit colour. Fitted to this scene's two
   lights (K.vox.fitGain), a lit top face never comes out brighter than its palette token: 0.84 under
   the white build lights, 0.94 by day in a day stadium, 1 at night and at Showtime. Refitted only
   when a light changes, written before every render (the stage puts it back to 1 at each lease
   grant). Feature-detected: an older vox-gl or a stub stage has no fit and keeps today's look. */
function voxFitter(K, hemi, sun) {
  let V = null;
  try { V = K ? K.vox : null; } catch (e) { V = null; }
  const on = !!V && typeof V.fitGain === 'function' && typeof V.setGain === 'function';
  const was = new Float64Array(9).fill(NaN), cur = new Float64Array(9);
  let gain = 1;
  /* the lights' fingerprint: intensities, linear colours and the sun's height (its direction's y) */
  const changed = () => {
    const hc = hemi.color, sc = sun.color, p = sun.position, t = sun.target ? sun.target.position : null;
    const dx = p.x - (t ? t.x : 0), dy = p.y - (t ? t.y : 0), dz = p.z - (t ? t.z : 0);
    cur[0] = hemi.intensity; cur[1] = hc.r; cur[2] = hc.g; cur[3] = hc.b;
    cur[4] = sun.intensity; cur[5] = sc.r; cur[6] = sc.g; cur[7] = sc.b;
    cur[8] = dy / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
    let diff = false;
    /* a tolerance, not ===: rounding noise in lights recomputed every frame never forces a refit */
    for (let i = 0; i < 9; i++) if (!(Math.abs(cur[i] - was[i]) <= 1e-9)) { was[i] = cur[i]; diff = true; }
    return diff;
  };
  return {
    on,
    gain: () => gain,
    /* refit if a light changed, then write the gain (→ the gain written) */
    apply() {
      if (!on) return 1;
      try {
        if (changed()) { const g = Number(V.fitGain(hemi, sun)); gain = g > 0 && g < Infinity ? g : 1; }
      } catch (e) { gain = 1; }
      try { V.setGain(gain); } catch (e) { /* the hub is gone */ }
      return gain;
    },
    /* today's look for whoever renders next */
    reset() {
      gain = 1; was.fill(NaN);
      if (on) { try { V.setGain(1); } catch (e) { /* the hub is gone */ } }
    }
  };
}

export async function create(mid, opts) {
  const born = now();
  opts = opts || {};
  const cfg = opts.cfg || {}, api = opts.api || {}, demo = !!(opts.demo || cfg.demo);
  const reduced = !!(opts.reduced || cfg.reduced || api.reduced);
  const onFail = typeof opts.onFail === 'function' ? opts.onFail : () => {};
  const ver = new URL(import.meta.url).search;
  const load = (f) => import(new URL('./' + f + ver, import.meta.url).href);
  await load('penalty-3d-core.js');
  const C = window.SLPenalty3DCore, P = window.SLPenaltyLogic;
  if (!C || !P || !P.MAP) throw new Error('penalty3d: the logic or the director is missing');
  const mods = await Promise.all([load('penalty-3d-models.js'), load('penalty-3d-fx.js'), load('penalty-3d-hud.js')]);
  const M = mods[0], FXM = mods[1], HUDM = mods[2];

  /* ---------------- runtime, kit, renderer ---------------- */
  const SL3D = await ensureRuntime();
  let K, hub = null, tier, budget, quality;
  if (SL3D) { tier = SL3D.tier || 'MID'; budget = SL3D.budget || LOCAL_BUDGET[tier]; quality = SL3D.quality || { outlines: tier !== 'LOW', particleScale: 1, cones: true }; K = SL3D.kit(tier); }
  if (!K) {
    const fb = await fallbackKit();
    if (!fb) throw new Error('penalty3d: no 3D kit');
    K = fb.K; hub = fb.hub; tier = fb.tier; budget = fb.budget; quality = fb.quality;
  }
  const who = cfg.member || cfg.user || {};
  const sigHex = C.normHex(who.color) || '#6C5CE7';

  /* ---------------- who plays (kids update KU-CH19a; plan-ku KU8, characters.json design.games) ----------------
     With the games' people helper the child's figure takes every kick: their character as a person rig
     at GEO.PERSON_SCALE (1.15: clear of the goal mouth from the kicker cam), or the classic avatar when
     they have none (or the voxels do not arrive inside this view's deadline: a game started from the
     2D island loads them first). The pet cheers from the touchline at SIDEKICK_SCALE, or nobody when
     there is no pet. No helper, or no figure at all (no stage) → the V4.54 staging. Either way petStage
     places and times the kicker; nothing here touches a rule, a timing or a hitbox. Asked before the
     renderer is leased, so the island keeps drawing while the voxels load. */
  const GP = SL3D && !hub ? peopleHelper() : null;
  let kickRig = null;
  if (GP) {
    try {
      kickRig = await GP.playerRig(SL3D, cfg, tier, C.GEO.PERSON_SCALE,
        { deadlineMs: Math.max(0, DEADLINE_MS - (now() - born)), color: sigHex, emoji: who.avatar || '🙂' });
    } catch (e) { kickRig = null; }
    if (kickRig && !kickRig.root) kickRig = null;
  }
  const people = !!kickRig;
  const fanPet = people ? GP.petOf(cfg) : null;
  const sig = people && kickRig.figure === 'person' && typeof GP.sigOf === 'function' ? GP.sigOf(cfg) : null;
  function dropKickRig() { if (kickRig) { try { kickRig.dispose(); } catch (e) { /* gone */ } } }
  let disposed = false, failed = false, lost = false, revoked = false, lostCount = 0;
  function fail(reason) { if (failed || disposed) return; failed = true; try { onFail(reason); } catch (e) { /* the shell is gone */ } }
  let L = null, renderer = null, ownRenderer = false;
  const handlers = {
    onRevoke(lease, why) { revoked = true; if (why === 'dispose') fail('revoked'); },
    onResume() {
      revoked = false;
      if (disposed) return;
      const c2d = mid.querySelector('canvas.slg-canvas');
      if (canvasEl.parentNode !== mid) { if (c2d) mid.insertBefore(canvasEl, c2d); else mid.insertBefore(canvasEl, mid.firstChild); }
      canvasEl.classList.add('slg-gl');
      if (W && H && L) L.resize(W, H);
    },
    onLost() { lost = true; },
    onRestored() { lost = false; },
    onFail(r) { fail(r === 'context' ? 'lost-twice' : r === 'performance' ? 'slow' : String(r || 'stage')); },
    onQuality(q, step) { applyQuality(q, step); }
  };
  if (SL3D && typeof SL3D.lease === 'function') { try { L = SL3D.lease('game', handlers); } catch (e) { L = null; } }
  if (L) renderer = L.renderer;
  else {
    try {
      renderer = SL3D && typeof SL3D.createRenderer === 'function' ? SL3D.createRenderer({}) : null;
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: !!budget.antialias, alpha: false, stencil: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.pixelRatioCap || 1.5));
      }
    } catch (e) { renderer = null; }
    if (!renderer) { if (hub) hub.dispose(); dropKickRig(); throw new Error('penalty3d: no renderer'); }
    ownRenderer = true;
  }
  const canvasEl = renderer.domElement;
  function onCtxLost(e) { e.preventDefault(); lost = true; lostCount++; if (lostCount >= 2) fail('lost-twice'); }
  function onCtxRestored() { lost = false; }
  if (ownRenderer) { canvasEl.addEventListener('webglcontextlost', onCtxLost, false); canvasEl.addEventListener('webglcontextrestored', onCtxRestored, false); }
  function applyRenderer() {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping != null ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = false;                    /* blob shadows + baked decals only in this scene */
  }
  applyRenderer();

  /* ---------------- look ---------------- */
  const stadiumId = C.STADIUM_LOOK[cfg.stadium] ? cfg.stadium : 'stadium_day', look = C.stadiumLook(stadiumId);
  const ballId = C.BALL_LOOK[cfg.ball] ? cfg.ball : 'ball_classic', ballLook = C.ballLook(ballId);
  const petId = (cfg.pet && cfg.pet.id) || 'pet_puppy', petAcc = (cfg.pet && cfg.pet.acc) || {}, petName = (cfg.pet && cfg.pet.name) || 'Pet';
  /* the roles: the kicker (the pet in the V4.54 staging, the child's figure with the people helper) and
     the touchline fan (the avatar, or the pet; none without a pet); the LED cheers the kicker on */
  const kickScale = people ? (kickRig.gameScale || C.GEO.PERSON_SCALE) : C.GEO.PET_SCALE;
  const fanScale = people ? C.GEO.SIDEKICK_SCALE : C.GEO.AVATAR_SCALE;
  const voiceId = people ? (fanPet ? fanPet.id : null) : petId;
  const kickName = people ? (charName() || (typeof who.name === 'string' && who.name) || petName) : petName;
  function charName() { const ch = typeof GP.charOf === 'function' ? GP.charOf(cfg) : null; return ch && typeof ch.name === 'string' ? ch.name : ''; }
  const seed = ((cfg.day ? String(cfg.day).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : 7) ^ 0x5eed) >>> 0;
  const rimSaved = K.uniforms ? { c: K.uniforms.uRimColor.value.clone(), s: K.uniforms.uRimStrength.value } : null;

  /* ---------------- the scene ---------------- */
  const A = M.makeKit(K, { budget, quality, SL3D });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.1, 240);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.9);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-7, 14, 9); sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);
  const voxFit = voxFitter(K, hemi, sun);               /* crisp CR5: 0.84 under these white build lights */
  voxFit.apply();
  scene.fog = new THREE.Fog(0xffe3f1, 30, 70);
  let hud = null, built = null, kicker = null, fan = null;
  try {
    built = buildScene();
    kicker = built.kicker; fan = built.fan;
    if (!demo) {
      hud = HUDM.makeHud(mid, { reduced, sig: sigHex, copy: C.COPY });
      hud.setVisible(false);
    }
  } catch (e) {
    try { if (hud) hud.dispose(); } catch (e2) { /* nothing */ }
    cleanup();
    throw e;
  }
  const { sky, goal, crowd, layout, led, cones, keeper, ball, trail, aim, spot, fx, snow, blobs } = built;

  function buildScene() {
    const sky = M.buildSky(A, {}); scene.add(sky.group);
    const stadium = M.buildStadium(A, { look, id: stadiumId, towers: C.GEO.TOWERS, floods: FLOODS }); scene.add(stadium.group);
    const goal = M.buildGoal(A, { post: C.GEO.POST, bar: C.GEO.BAR, depth: C.GEO.NET_DEPTH, netTop: C.GEO.NET_TOP }); scene.add(goal.group);
    const layout = C.crowdLayout(tier === 'LOW' ? 72 : 120, seed);
    const crowd = M.buildCrowd(A, layout, { SL3D, fanBody: C.FAN_BODY, wandCols: C.WAND_COLS, sig: sigHex }); scene.add(crowd.group);
    const led = M.buildLed(A); scene.add(led.group);
    const cones = M.buildCones(A, 3 + (look.flood ? FLOODS.length : 0)); scene.add(cones.mesh);
    const keeper = M.buildKeeper(A, { rivals: P.RIVALS }); scene.add(keeper.root);
    const ball = M.buildBall(A, { id: ballId, look: ballLook, SL3D }); scene.add(ball.root);
    const trail = M.buildTrail(A); scene.add(trail.mesh);
    const aim = M.buildAim(A, { cyan: C.NEON.cyan, pink: C.NEON.pink, gold: C.NEON.gold, glove: C.NEON.glove, aimU: P.MAP.AIM_U, corner: P.MAP.CORNER_U, reachU: P.MAP.reachU });
    scene.add(aim.group); scene.add(aim.help);           /* the glove zone also fades in after a save, outside aiming */
    const spot = M.buildFollowSpot(A); scene.add(spot.mesh);
    const fx = FXM.makeFx(A, { sig: sigHex, reduced, seed, halos: layout.length + 8 }); scene.add(fx.group);
    const snow = look.snow ? FXM.makeSnow(A, budget.snow || (tier === 'LOW' ? 60 : tier === 'HIGH' ? 150 : 100)) : null;
    if (snow) scene.add(snow.mesh);
    const blobs = K.blobs(16); scene.add(blobs.mesh);
    let kicker = null, fan = null;
    if (people) {
      /* kids update: the child's figure takes the kicks (no new rig: it replaces the touchline avatar),
         the pet cheers from the touchline through the same rig seam as before */
      kicker = kickRig; scene.add(kicker.root);
      if (fanPet) {
        try { if (typeof SL3D.makeRig === 'function') fan = SL3D.makeRig(fanPet.id, fanPet.acc || {}, tier); } catch (e) { fan = null; }
        if (!fan || !fan.root) fan = M.makeFallbackPet(A, fanPet.id);
        fan.root.scale.setScalar(fanScale); scene.add(fan.root);
      }
    } else {
      try { if (SL3D && typeof SL3D.makeRig === 'function') kicker = SL3D.makeRig(petId, petAcc, tier); } catch (e) { kicker = null; }
      if (!kicker || !kicker.root) kicker = M.makeFallbackPet(A, petId);
      kicker.root.scale.setScalar(C.GEO.PET_SCALE); scene.add(kicker.root);
      try { if (SL3D && typeof SL3D.makeAvatar === 'function') fan = SL3D.makeAvatar({ color: sigHex, emoji: who.avatar || '🙂' }, tier); } catch (e) { fan = null; }
      if (!fan || !fan.root) fan = M.makeFallbackAvatar(A, { color: sigHex, emoji: who.avatar });
      if (fan.setWand) fan.setWand(true);
      fan.root.scale.setScalar(C.GEO.AVATAR_SCALE); scene.add(fan.root);
    }
    /* (QA only: the reach of the rival the view opened with) */
    const qa = isQa() ? M.buildQa(A, P.MAP.reachU(cfg.variant || 'std'), P.MAP.CORNER_U) : null;
    if (qa) scene.add(qa);
    return { sky, stadium, goal, crowd, layout, led, cones, keeper, ball, trail, aim, spot, fx, snow, blobs, kicker, fan, qa };
  }

  /* reserved pool slots: crowd wand halos, the ball halo, Glowy's glove halos, the dizzy stars */
  const nFans = layout.length, haloIdx = fx.reserve('halo', nFans), ballHalo = fx.reserve('halo', 1)[0], gloveHalo = fx.reserve('halo', 2), dizzyIdx = fx.reserve('glow', 3);
  /* blob shadows: 4 movers + static decals under the frame, the stands and the towers */
  const blobKeeper = blobs.alloc(), blobKick = blobs.alloc(), blobFan = blobs.alloc(), blobBall = blobs.alloc();
  const kickBlob = people ? 0.62 : 0.75, fanBlob = people ? 0.62 : 0.85;
  if (!fan) blobs.set(blobFan, 0, -5, 0, 0.001, 0.001);
  [[-3, 0, 0.6, 0.6], [3, 0, 0.6, 0.6], [0, -0.6, 6.6, 1.6], [0, -4.9, 15.5, 1.4], [-8.4, 0, 1.4, 8.8], [8.4, 0, 1.4, 8.8]]
    .concat(C.GEO.TOWERS.map((t) => [t[0], t[2], 1.0, 1.0])).forEach((d) => { const i = blobs.alloc(); if (i >= 0) blobs.set(i, d[0], 0.004, d[1], d[2], d[3]); });
  blobs.commit();

  /* ---------------- per-view state (all preallocated: frame() never allocates) ---------------- */
  let roundRef = null, st = null, lastN = 0, lastClock = 0, variant = cfg.variant || P.def.defaultVariant || 'std', menuRival = variant;
  let mode = '', viewT = 0, menuT = 0, resultsT = 0, W = 0, H = 0, glassOff = C.CAM.RESULTS_OFFSET, measureAt = -1;
  const showTw = C.tween(0), coneK = new Float32Array(3), coneDir = new Float32Array(9);
  let landedKick = -1, catchKick = -1, catchIdx = -1, heartsKick = -1, tadaKick = -1, glowKick = -1, wobbleOn = false;
  let waveT = -1, boostT = -1, finale = null, danceLoop = -1, cheerDone = false, resultsConfetti = false, goldTrailT = 0;
  const wandLevel = new Float32Array(nFans), wandTarget = new Float32Array(nFans), wandDelay = new Float32Array(nFans), wandBright = new Float32Array(nFans);
  let litFrac = -1, crowdShown = nFans, crowdTick = 0;
  const sched = { t: new Float32Array(16), name: new Array(16).fill(''), vol: new Float32Array(16) };
  /* inputs / outputs for the pure director */
  const camIn = { mode: 'menu', lp: '', shot: 0, intro: false, phaseT: 0, flight: 0, close: false, resT: 0, replay: false, res: null, ex: 0, ey: 0, prevEx: 0, aspect: 16 / 9, h: 0, reduced, t: 0, offY: 0 };
  const shot = {}, cur = { px: 0, py: 2.6, pz: 16, lx: 0, ly: 1, lz: 0, fov: 26, offY: 0 }, from = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: 26, offY: 0 };
  let camKey = '', blendT = 0, blendDur = 0, fovSet = -1, offSet = -1, aspectSet = -1;
  const kIn = { lp: 'menu', style: 'band', dive: 'stay', gx: NaN, gy: NaN, clock: 0, phaseT: 0, keeperT: 0, resT: 0, res: null, ex: NaN, ey: NaN, flight: 0, worried: false, reduced, bop: false, intro: false, shot: 0, hasPrev: false, prevDive: 'stay', prevRes: null, prevEx: NaN, prevEy: NaN, prevGx: NaN, prevGy: NaN };
  const kp = C.resetPose({});
  const bIn = { lp: 'ready', phaseT: 0, flight: 0, resT: 0, res: null, kind: null, top: false, ex: 0, ey: 0, catchX: 0, catchY: 0, catchZ: 0, hugX: 0, hugY: 0, hugZ: 0, reduced };
  const bp = {};
  const psIn = { lp: 'ready', phaseT: 0, shot: 0, flight: 0, resT: 0, res: null, idleT: 0, reduced }, ps = {};
  const petOpts = { reduced, speed: 0, rate: 1, bpm: C.DANCE_BPM, intensity: 1 }, avOpts = { reduced, speed: 0, rate: 1, bpm: C.DANCE_BPM };
  const kickOpts = people ? avOpts : petOpts, fanOpts = people ? petOpts : avOpts;
  /* the child's figure (kids update): petStage's moments → clips through the people helper */
  const kmIn = { lp: '', phaseT: 0, resT: 0, res: null, decider: false }, km = {};
  const skIn = { lp: '', res: null, resT: 0, encore: false, star: false, clock: 0 }, sk = {};
  const clipOpts = { res: null, star: false, sig, pet: !!fanPet };
  let readyKick = -1;
  const ca = {}, pre = C.makePreset(), pips = [0, 0, 0, 0, 0, 0, 0, 0], ct = {};
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), prevBall = new THREE.Vector3(0, 0.11, 7.5), qBall = new THREE.Quaternion();
  const ZAXIS = new THREE.Vector3(0, 0, 1), rimC = new THREE.Color(), tmpC = new THREE.Color();
  const coneCols = [A.col(C.NEON.pink), A.col(C.NEON.cyan), A.col(C.NEON.violet)], floodCol = A.col('#FFF6C8');
  const cGold = A.col('#FFD23F'), cPink = A.col('#FF5FA2'), cCyan = A.col(C.NEON.cyan), cSig = A.col(sigHex);
  const trailCols = ballLook.trail.map((h) => A.col(h)), holoCols = C.HOLO.map((h) => A.col(h)), grassCol = A.col(look.grass);
  let trailMode = 0, spinA = 0, wasReplay = false;
  let netHx = 0, netHy = 0, netT = -1, netD = 0.35;
  const netFn = (x, y, u, v) => C.netBulge(x, y, u, v, netHx, netHy, netT, netD);
  const crowdCtx = { lift: null, level: wandLevel, bright: wandBright, sway: 0.35, bob: 0.03, t: 0, bpm: 112, reduced, halos: fx.halos, haloIdx, haloSize: 0.5, haloAlpha: 0.5 };
  crowdCtx.lift = (i) => {
    let y = 0;
    if (waveT >= 0 && !reduced) y += C.crowdWave(layout[i].u, waveT);
    if (boostT >= 0 && boostT < 0.6 && !reduced) y += 0.06 * C.arc(boostT / 0.6);
    if (i === catchIdx && st && st.phase === 'result' && catchKick === kickKey()) y += 0.2 * C.smooth(0.55, 0.75, st.resT);
    return y;
  };
  const trailColor = (i, k, out) => {
    if (trailMode === 2) out.copy(cGold).lerp(cPink, k);
    else if (trailMode === 1) { const f = ((k + viewT * 0.35) % 1) * 4, a = Math.floor(f) % 4; out.copy(holoCols[a]).lerp(holoCols[(a + 1) % 4], f - Math.floor(f)); }
    else out.copy(trailCols[i % trailCols.length]);
    return out;
  };

  /* ---------------- sound (view-owned cues only; the logic plays the rest) ---------------- */
  function sfx(name, vol, step) { if (demo) return; try { if (typeof api.sound === 'function') api.sound(name, vol, step); } catch (e) { /* sound is optional */ } }
  function petVoice() {
    if (demo || !voiceId) return;
    try { if (api.sound && typeof api.sound.pet === 'function') api.sound.pet(voiceId, 0.8); else sfx(PET_VOICE[voiceId] || 'yip', 0.8); } catch (e) { /* optional */ }
  }
  function ooh() {
    if (demo) return;
    try {
      const muted = typeof cfg.muted === 'function' && cfg.muted();
      const ac = typeof window.getAudioCtx === 'function' && !muted ? window.getAudioCtx() : null;
      if (ac && typeof window._swell === 'function') window._swell(ac, ac.currentTime, 0.5, { vol: 0.11 * 0.3 });
      else sfx('whoosh', 0.3);
    } catch (e) { /* optional */ }
  }
  function schedule(delay, name, vol) {
    for (let i = 0; i < 16; i++) if (!sched.name[i]) { sched.t[i] = delay; sched.name[i] = name; sched.vol[i] = vol; return; }
  }
  function runSchedule(dt) {
    for (let i = 0; i < 16; i++) {
      if (!sched.name[i]) continue;
      sched.t[i] -= dt;
      if (sched.t[i] <= 0) { const nm = sched.name[i]; sched.name[i] = ''; sfx(nm, sched.vol[i]); }
    }
  }
  function clearSchedule() { for (let i = 0; i < 16; i++) sched.name[i] = ''; }

  /* ---------------- quality ---------------- */
  function applyQuality(q, step) {
    if (!q) return;
    if (step === 'outlines' || q.outlines === false) { A.setOutlines(false); keeper.setOutlines(false); }
    if (step === 'particles' || (q.particleScale && q.particleScale < 1)) {
      fx.setScale(q.particleScale || 0.5);
      crowdShown = Math.max(1, Math.round(nFans / 2)); crowd.setShown(crowdShown);
      for (let i = crowdShown; i < nFans; i++) fx.halos.alpha(haloIdx[i], 0);
    }
    if (step === 'cones' || q.cones === false) { cones.mesh.visible = false; goal.setNetPlane(false); }
  }
  applyQuality(quality, null);

  /* ---------------- rounds and modes ---------------- */
  function rival() { return P.rivalById(st ? st.rival : menuRival); }
  function attach(round) {
    roundRef = round; st = round.state;
    lastN = st.evN || 0; lastClock = st.clock || 0;
    landedKick = catchKick = heartsKick = tadaKick = glowKick = -1; catchIdx = -1; readyKick = -1;
    waveT = -1; boostT = -1; finale = null; trail.reset(); fx.clear(); clearSchedule();
    keeper.setRival(st.rival);
    if (hud) { hud.reset(); hud.setRival(rival()); hud.setHype(st.hype, false); hud.setEncore(!!st.encore); }
    led.setText(C.ledText(st.encore ? 'encore' : 'start', { pet: kickName }));
    led.setPips(C.ledPips(st.log, st.shot, pips));
    C.tweenTo(showTw, C.showLevel(st.hype), 0, 0); showTw.v = showTw.to;
    setWands(C.wandsLit(st.hype, !!look.night), true);
  }
  function enterMode(m) {
    mode = m;
    if (m === 'menu') {
      menuT = 0; finale = null;
      keeper.setRival(menuRival);
      if (hud) { hud.reset(); hud.setVisible(false); }
      led.setText(C.ledText('menu')); led.setPips(C.ledPips([], -1, pips));
      C.tweenTo(showTw, look.night ? 0.15 : 0, 1.6, 0.8);
      setWands(look.night ? 0.5 : 0.25, false);
      fx.clear(); trail.reset(); clearSchedule();
    } else if (m === 'play') {
      if (hud) hud.setVisible(true);
    } else if (m === 'results') {
      resultsT = 0; danceLoop = -1; cheerDone = false; resultsConfetti = false;
      if (hud) { hud.clearBanners(); hud.prompt('', ''); hud.bubble(false); hud.replay(false); hud.intro(false); hud.setBoost(false); hud.setVisible(false); }
      if (st) consume();                                  /* picks up the 'finale' event onFinish() just pushed */
      if (!finale && roundRef && typeof roundRef.stats === 'function') { try { const sts = roundRef.stats(); finale = { encoreDance: !!sts.encoreDance, medal: sts.medal }; } catch (e) { finale = null; } }
      led.setText(C.ledText(finale && finale.encoreDance ? 'encore' : 'show'));
      glassOff = measureGlass(); measureAt = 0.35;
    }
  }
  function setWands(frac, instant) {
    if (frac === litFrac && !instant) return;
    const up = frac > litFrac;
    litFrac = frac;
    for (let i = 0; i < nFans; i++) {
      const tgt = layout[i].h < frac ? 1 : 0;
      if (tgt !== wandTarget[i]) { wandTarget[i] = tgt; wandDelay[i] = instant || reduced ? 0 : layout[i].u * (up ? 0.3 : 0.5); }
      if (instant) { wandLevel[i] = tgt; wandBright[i] = tgt; }
    }
  }
  function stepWands(dt, pulse) {
    const rate = dt / 0.25;
    for (let i = 0; i < nFans; i++) {
      if (wandDelay[i] > 0) { wandDelay[i] -= dt; continue; }
      const tg = wandTarget[i], lv = wandLevel[i];
      wandLevel[i] = reduced ? tg : lv < tg ? Math.min(tg, lv + rate) : Math.max(tg, lv - rate);
      wandBright[i] = wandLevel[i] * pulse;
    }
  }
  function measureGlass() {
    try {
      const sheet = mid.querySelector('.slg-scr.glass');
      if (!sheet || !H) return C.CAM.RESULTS_OFFSET;
      const vis = Math.max(0.2, Math.min(1, sheet.offsetTop / H));
      return C.clamp(0.5 - vis * 0.52, 0, 0.4);
    } catch (e) { return C.CAM.RESULTS_OFFSET; }
  }

  /* ---------------- events → one-shot effects ---------------- */
  function consume() {
    const ev = st.ev;
    for (let i = 0; i < ev.length; i++) { const e = ev[i]; if (e.n > lastN) { lastN = e.n; onEvent(e); } }
  }
  /* which kick a one-shot effect belongs to (after the last kick st.shot is already 8 while RESULT still shows) */
  function kickKey() { return st.phase === 'result' ? st.log.length - 1 : st.shot; }
  function kickEx() { return st.lockX != null ? P.MAP.lx2u(st.lockX) : 0; }
  function kickEy() { return st.lockY != null ? P.MAP.ly2u(st.lockY) : 0; }
  function onEvent(e) {
    const t = e.t;
    if (t === 'kick') {
      trail.reset();
      led.setPips(C.ledPips(st.log, e.shot, pips));
      if (e.final) {
        led.setText(C.ledText('final'));
        if (hud) hud.banner(C.bannerFor(e, null, P.resultLabel));
      } else if (e.shot === 0) led.setText(C.ledText('start', { pet: kickName }));
    } else if (t === 'strike') {
      fx.sparkles(0, 0.16, 7.5, 8, 2.2, null, 0.4, 0.13);
      fx.dust(0, 0.05, 7.55, 6, grassCol);
      sfx('whoosh', 0.6);
      trail.reset(); spinA = 0;
      trailMode = st.encore ? (e.star ? 2 : 1) : 0;
    } else if (t === 'result') {
      const entry = st.log[st.log.length - 1];
      const b = C.bannerFor(e, entry, P.resultLabel);
      if (hud && b) { hud.banner(b); hud.say(b.say); }
      led.setPips(C.ledPips(st.log, st.shot + 1, pips));
      const ex = P.MAP.lx2u(e.x), ey = P.MAP.ly2u(e.y);
      if (e.res === 'goal') {
        const n = A.low ? 18 : 30;
        fx.confetti(-C.GEO.POST, C.GEO.BAR, 0.1, n, 0.35, 0.85, 0.45, 0.7);
        fx.confetti(C.GEO.POST, C.GEO.BAR, 0.1, n, -0.35, 0.85, 0.45, 0.7);
        waveT = 0; petVoice();
        if (e.top && st.corners === 1) fx.ring(ex, ey, 0.1, 24, 2.4);
        if (e.star) led.flash();
      } else if (e.kind === 'post' || e.kind === 'bar') {
        C.contactPoint(e.kind, ex, ey, ct);
        fx.sparks(ct.x, ct.y, 0.05, 12);
        ooh();
      } else if (e.kind === 'wide' || e.kind === 'over') {
        C.catchTarget(e.kind, ex, ct);
        let best = -1, bd = Infinity;
        for (let i = 0; i < crowdShown; i++) {
          const f = layout[i], dx = f.x - ct.x, dy = f.y - ct.y, dz = f.z - ct.z, d = dx * dx + dy * dy + dz * dz;
          if (f.side === 0 && d < bd) { bd = d; best = i; }
        }
        catchIdx = best; catchKick = kickKey();
      }
    } else if (t === 'hype') {
      if (hud) hud.setHype(e.to, true);
      if (e.to > e.from) for (let k = e.from; k < e.to; k++) schedule(0.02 + (k - e.from) * 0.06, 'pop', 0.5);
      else for (let k = 0; k < e.from - e.to; k++) schedule(0.3 + k * 0.08, 'pop', 0.35);
      setWands(C.wandsLit(e.to, !!look.night), false);
      C.tweenTo(showTw, C.showLevel(e.to), reduced ? 0.25 : 1.6, reduced ? 0.25 : 0.8);
      if (!st.encore) led.setText(e.to >= 1 && e.to < 4 ? C.ledText('hype', { hype: e.to }) : C.ledText('start', { pet: kickName }));
    } else if (t === 'encore') {
      if (hud) hud.setEncore(!!e.on);
      if (e.on) {
        if (hud) hud.banner(C.bannerFor(e, null, P.resultLabel));
        fx.streamers(24);
        led.setText(C.ledText('encore'));
      } else led.setText(st.hype >= 1 ? C.ledText('hype', { hype: st.hype }) : C.ledText('start', { pet: kickName }));
    } else if (t === 'boost') {
      const b = C.bannerFor(e, null, P.resultLabel);
      if (hud && b) { hud.banner(b); hud.say(b.say); }
      boostT = 0; sfx('boost', 0.5);
    } else if (t === 'finale') {
      finale = { encoreDance: !!e.encoreDance, medal: e.medal || null };
    } else if (t === 'decider') {
      readyKick = e.kick != null ? e.kick : st.kick;      /* KU gameEvents: a decider kick, the kicker stands ready */
    }
  }

  /* ---------------- PLAY ---------------- */
  const KZ = C.GEO.KEEPER_Z;
  function updatePlay(dt, alpha) {
    let lt = st.clock - lastClock;
    if (!(lt >= 0) || lt > 0.25) lt = 0;
    lastClock = st.clock;
    consume();
    const lp = st.phase, rv = rival();
    const fxDt = lp === 'strike' ? 0 : lp === 'flight' ? lt * st.slow : lt;     /* the hit-stop freezes the show */
    runSchedule(lt);
    /* interpolate the 120 Hz logic by alpha (read-only extrapolation of the same formulas) */
    const ahead = Math.max(0, Math.min(1, alpha || 0)) * STEP;
    const flightI = lp === 'flight' ? Math.min(1, st.flight + ahead * st.slow / C.T.FLIGHT) : st.flight;
    /* the keeper moves on the ball's clock (still for his reaction time): the same formula as the logic */
    const keeperI = lp === 'flight' ? P.keeperAt(flightI, st.rival) : st.keeperT;
    let axI = st.ax, ayI = st.ay;
    if (lp === 'aimX' && Math.abs(C.markerX(st.sweepX) - st.ax) < 1) axI = C.markerX(st.sweepX + ahead * st.speed * TAU);
    if (lp === 'aimY' && Math.abs(C.markerY(st.sweepY) - st.ay) < 1) ayI = C.markerY(st.sweepY + ahead * st.speed * 1.1 * TAU);
    const ex = kickEx(), ey = kickEy();
    const pend = st.pending, res = lp === 'result' ? st.result : pend ? pend.res : null;
    const kind = lp === 'result' ? st.kind : pend ? pend.kind : null, top = !!(pend && pend.top);
    const prev = st.shot > 0 ? st.log[st.log.length - 1] : null;
    /* camera first: it says whether the replay is running */
    camIn.mode = demo ? 'demo' : 'play'; camIn.lp = lp; camIn.shot = st.shot; camIn.intro = !!st.intro; camIn.phaseT = st.phaseT;
    camIn.flight = flightI; camIn.close = !!st.close; camIn.resT = st.resT; camIn.replay = !!st.replay; camIn.res = res;
    camIn.ex = ex; camIn.ey = ey; camIn.prevEx = prev ? P.MAP.lx2u(prev.x) : 0; camIn.offY = 0;
    C.cameraShot(camIn, shot);
    const rp = shot.replayF, inReplay = rp >= 0;
    if (inReplay !== wasReplay) { wasReplay = inReplay; trail.reset(); spinA = 0; }
    /* the keeper */
    /* (st.dive and st.gx/gy exist only from the strike on: before it he has no move to show) */
    kIn.lp = inReplay ? 'flight' : lp; kIn.style = rv.style; kIn.dive = st.dive || 'stay'; kIn.clock = st.clock;
    kIn.gx = st.gx != null ? P.MAP.lx2u(st.gx) : NaN; kIn.gy = st.gy != null ? P.MAP.ly2u(st.gy) : NaN;
    kIn.phaseT = st.phaseT; kIn.keeperT = inReplay ? P.keeperAt(rp, st.rival) : keeperI; kIn.resT = st.resT; kIn.res = res;
    kIn.ex = st.lockX != null ? ex : NaN; kIn.ey = st.lockY != null ? ey : NaN; kIn.flight = inReplay ? rp : flightI;
    kIn.worried = lp === 'aimY' && st.lockX > P.POST_L + 6 && st.lockX < P.POST_R - 6 && st.ay > P.BAR + 6 && P.isTopCorner(st.lockX, st.ay);
    kIn.bop = rv.id === 'rival_bop'; kIn.intro = !!st.intro; kIn.shot = st.shot;
    kIn.hasPrev = !!prev; kIn.prevDive = prev ? prev.dive : 'stay'; kIn.prevRes = prev ? prev.res : null;
    kIn.prevEx = prev ? P.MAP.lx2u(prev.x) : NaN; kIn.prevEy = prev ? P.MAP.ly2u(prev.y) : NaN;
    kIn.prevGx = prev && prev.gx != null ? P.MAP.lx2u(prev.gx) : NaN; kIn.prevGy = prev && prev.gy != null ? P.MAP.ly2u(prev.gy) : NaN;
    C.keeperPose(kIn, kp);
    keeper.apply(kp);
    if (kp.landed && lp === 'result' && st.dive && st.dive !== 'stay' && landedKick !== kickKey()) { landedKick = kickKey(); sfx('boing', 0.5); }
    /* Glowy's gloves sparkle when he saves */
    if (lp === 'result' && res === 'save' && rv.style === 'glow' && st.resT > 0.12 && glowKick !== kickKey()) {
      glowKick = kickKey();
      keeper.gloveWorld(true, v1); fx.sparkles(v1.x, v1.y, v1.z, 8, 1.4, cCyan, 0.6, 0.12);
      keeper.gloveWorld(false, v1); fx.sparkles(v1.x, v1.y, v1.z, 8, 1.4, cCyan, 0.6, 0.12);
    }
    /* dizzy ✦ ring over his head */
    keeper.headWorld(v2);
    for (let i = 0; i < 3; i++) {
      const a = (reduced ? 0.6 : viewT * Math.PI) + i * TAU / 3;
      fx.glowPool.set(dizzyIdx[i], v2.x + 0.34 * Math.cos(a), v2.y + 0.05 + 0.05 * Math.sin(a * 2), v2.z + 0.18 * Math.sin(a), 0.18, cGold, kp.dizzy, K.ATLAS.sparkle | 0, a);
    }
    /* Glowy's glove halos: a soft glow on both gloves, the saving one lit as it meets the ball */
    for (let g = 0; g < 2; g++) {
      const on = rv.style === 'glow' ? (g ? kp.glowR : kp.glowL) : 0;
      keeper.gloveWorld(g === 0, v1);
      fx.halos.set(gloveHalo[g], v1.x, v1.y, v1.z + 0.12, 0.6 * 1.6, cCyan, 0.8 * on, 0, 0);
    }
    /* the ball */
    bIn.lp = inReplay ? 'flight' : lp; bIn.phaseT = st.phaseT; bIn.flight = inReplay ? rp : flightI; bIn.resT = st.resT;
    bIn.res = res; bIn.kind = kind; bIn.top = top; bIn.ex = ex; bIn.ey = ey; bIn.reduced = reduced;
    bIn.hugX = kp.hugX; bIn.hugY = kp.hugY; bIn.hugZ = kp.hugZ;
    if (catchIdx >= 0 && catchKick === kickKey()) { crowd.headPos(catchIdx, v1); bIn.catchX = v1.x; bIn.catchY = v1.y; bIn.catchZ = v1.z; }
    else { C.catchTarget(kind, ex, ct); bIn.catchX = ct.x; bIn.catchY = ct.y; bIn.catchZ = ct.z; }
    C.ballPose(bIn, bp);
    placeBall(lp, inReplay, fxDt || (inReplay ? lt : 0), flightI);
    if (lp === 'result' && (kind === 'wide' || kind === 'over') && st.resT >= 0.75 && heartsKick !== kickKey()) {
      heartsKick = kickKey(); fx.hearts(bp.x, bp.y + 0.35, bp.z, reduced ? 3 : 6);
    }
    /* the net ripple and the post / bar shiver */
    if (lp === 'result' && res === 'goal') {
      netHx = C.clamp(ex, -2.75, 2.75); netHy = C.clamp(ey - 0.12, 0.2, C.GEO.NET_TOP - 0.15); netD = top ? 0.5 : 0.35;
      netT = st.resT - C.NET_HIT;
      goal.ripple(netT > 0 && netT < 0.7 ? netFn : null);
    } else goal.ripple(null);
    if (lp === 'result' && (kind === 'post' || kind === 'bar') && st.resT < 0.35 && !reduced) {
      goal.wobble(kind === 'bar' ? 2 : ex < 0 ? 0 : 1, Math.sin(TAU * C.RATES.POST_WOBBLE_HZ * st.resT) * (1 - st.resT / 0.35));
      wobbleOn = true;
    } else if (wobbleOn) { goal.wobble(-1, 0); wobbleOn = false; }
    /* tada after a final-kick goal and its replay */
    if (lp === 'result' && res === 'goal' && st.final && tadaKick !== kickKey() && st.resT >= (reduced || !st.replay ? 0.6 : C.CAM.REPLAY_AT + C.CAM.REPLAY_DUR + 0.05)) {
      tadaKick = kickKey(); sfx('tada');
    }
    /* the kicker and the touchline: petStage places and times the kicker either way */
    psIn.lp = lp; psIn.phaseT = st.phaseT; psIn.shot = st.shot; psIn.flight = flightI; psIn.resT = st.resT; psIn.res = res; psIn.idleT = st.idleT;
    C.petStage(psIn, ps);
    if (people) stagePeople(lp, res);
    else {
      poseKicker(ps.x, ps.z, ps.yaw, ps.clip, ps.ct, ps.speed, ps.sy, ps.tap ? st.clock : -1);
      placeFan(C.GEO.AVATAR[0], C.GEO.AVATAR[2], C.GEO.AVATAR_YAW, C.avatarClip(lp, res, st.resT, !!st.encore), lp === 'result' ? st.resT : viewT);
    }
    /* the aim UI */
    updateAim(lp, axI, ayI, rv);
    /* crowd, cones, show level */
    if (waveT >= 0) { waveT += fxDt; if (waveT > 1.3) waveT = -1; }
    if (boostT >= 0) { boostT += fxDt; if (boostT > 0.7) boostT = -1; }
    const finalPulse = st.final && (lp === 'ready' || lp === 'aimX' || lp === 'aimY') && !reduced ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(TAU * C.RATES.WAND_PULSE_HZ * st.clock)) : 1;
    stepWands(fxDt, finalPulse);
    crowdCtx.bob = 0.03 + 0.02 * st.hype; crowdCtx.bpm = 112;
    let coneMode = 'sweep', nLit = C.conesLit(st.hype, tier);
    if (lp === 'result' && res === 'goal') coneMode = 'goal';
    else if (st.final && (lp === 'ready' || lp === 'aimX' || lp === 'aimY' || lp === 'windup')) { coneMode = 'ball'; nLit = tier === 'LOW' ? 2 : 3; }
    updateCones(fxDt, coneMode, nLit, ex, ey, st.clock);
    spot.set(kp.cx, Math.max(0, (showTw.v - 0.5) * 2) * 0.35);
    /* the ball's Encore halo */
    fx.halos.set(ballHalo, bp.x, bp.y, bp.z, 0.6, cSig, st.encore ? 0.75 : 0, 0, 0);
    /* the overlay */
    if (hud) {
      hud.setBoost(!!st.boost);
      hud.intro(lp === 'ready' && !!st.intro, st.phaseT >= C.T.INTRO_SKIP);
      const aiming = lp === 'aimX' || lp === 'aimY';
      hud.prompt(aiming ? C.promptFor(lp) : '', lp === 'aimY' ? 'y' : 'x');
      hud.bubble(aiming && st.idleT >= C.T.NUDGE);
      hud.replay(inReplay);
    }
    stepShared(fxDt, st.clock);
  }
  /* ball placement: position, spin, squash at the strike, stretch along its velocity, trail */
  function placeBall(lp, inReplay, dtEff, flightI) {
    const root = ball.root;
    root.position.set(bp.x, bp.y, bp.z);
    spinA += bp.spin * dtEff;
    ball.spinner.rotation.set(-spinA, spinA * 0.25 * Math.sign(bIn.ex || 1), 0);
    v1.set(bp.x - prevBall.x, bp.y - prevBall.y, bp.z - prevBall.z);
    const fsec = flightI * C.T.FLIGHT;
    if (lp === 'strike' && !inReplay && !reduced) { root.quaternion.identity(); root.scale.set(1.3, 0.75, 1.3); }
    else if (bp.stretch && v1.lengthSq() > 1e-8) {
      qBall.setFromUnitVectors(ZAXIS, v1.normalize()); root.quaternion.copy(qBall);
      if (!inReplay && fsec < 0.12 && !reduced) {
        const k = C.outElastic(fsec / 0.12);
        root.scale.set(1.3 + (0.92 - 1.3) * k, 1.3 + (0.92 - 1.3) * k, 0.75 + (1.12 - 0.75) * k);
      } else root.scale.set(0.92, 0.92, 1.12);
    } else { root.quaternion.identity(); root.scale.set(1, 1, 1); }
    prevBall.set(bp.x, bp.y, bp.z);
    if (lp === 'flight' || inReplay) {
      trail.push(bp.x, bp.y, bp.z);
      if (ballLook.sparkles && dtEff > 0) { goldTrailT -= dtEff; if (goldTrailT <= 0) { goldTrailT = 0.05; fx.sparkles(bp.x, bp.y, bp.z, 1, 0.3, cGold, 0.4, 0.08); } }
      if (trailMode === 2 && dtEff > 0) fx.starTrail(bp.x, bp.y, bp.z);
    } else if (dtEff > 0) trail.fade();
    const h = Math.max(0, bp.y - 0.11), sh = 0.32 * Math.max(0.15, 1 - h / 2.6);
    blobs.set(blobBall, bp.x, 0.004, bp.z, sh, sh);
  }
  /* the child's figure kicks (petStage's moments mapped by the people helper: kick → shoot, a goal → cheer
     or the signature move, a save → shrug then thumbs-up, a miss → oops, 'decider' →
     ready); the pet cheers from the touchline (hop, dance, sit: never sad) */
  function starNow(lp, res) {
    if (lp !== 'result' || res !== 'goal') return false;
    const e = st.log[st.log.length - 1];
    return !!(e && e.star) || !!st.encore;
  }
  function stagePeople(lp, res) {
    kmIn.lp = lp; kmIn.phaseT = st.phaseT; kmIn.resT = st.resT; kmIn.res = res;
    kmIn.decider = st.decider > 0 && !st.waitDecide && readyKick === st.kick;
    C.kickerMoment(kmIn, ps, km);
    clipOpts.res = res; clipOpts.star = starNow(lp, res);
    poseKicker(ps.x, ps.z, ps.yaw, GP.clipFor('kicker', km.moment, clipOpts), km.ct, ps.speed, km.sy, ps.tap ? st.clock : -1);
    if (!fan) return;
    skIn.lp = lp; skIn.res = res; skIn.resT = st.resT; skIn.encore = !!st.encore; skIn.star = clipOpts.star; skIn.clock = st.clock;
    C.sidekickMoment(skIn, sk);
    placeFan(C.GEO.AVATAR[0], C.GEO.AVATAR[2], C.GEO.AVATAR_YAW, GP.clipFor('sidekick', sk.moment, clipOpts), sk.ct);
  }
  function poseKicker(x, z, yaw, clip, t, speed, sy, tapClock) {
    kicker.root.position.set(x, 0, z);
    kicker.root.rotation.set(0, yaw, 0);
    kicker.root.scale.set(kickScale, kickScale * sy, kickScale);
    kickOpts.speed = speed; kickOpts.rate = 1;
    try {
      const pose = kicker.play(clip, t, kickOpts);
      if (tapClock >= 0 && pose && typeof kicker.setPose === 'function' && !reduced) {
        /* the impatient foot tap (a pet's paw at 4 taps a second, as in V4.54; a person's foot at 1.5) */
        if (people) pose.legR = TAP_DEG * Math.abs(Math.sin(Math.PI * TAP_HZ * tapClock));
        else pose.legFR = 22 * Math.abs(Math.sin(TAU * 2 * tapClock));
        kicker.setPose(pose);
      }
    } catch (e) { swapKicker(); }
    /* a pet's shades turn PEARL in ENCORE MODE; the classic avatar's wand glows with the show */
    if (kicker.setShow) kicker.setShow(people ? showTw.v : mode === 'play' && st && st.encore ? 1 : 0);
    blobs.set(blobKick, x, 0.004, z, kickBlob, kickBlob);
  }
  function placeFan(x, z, yaw, clip, t) {
    if (!fan) return;
    fan.root.position.set(x, 0, z);
    fan.root.rotation.set(0, yaw, 0);
    try { fan.play(clip, t, fanOpts); } catch (e) { swapFan(); }
    if (fan.setShow) fan.setShow(people ? (mode === 'play' && st && st.encore ? 1 : 0) : showTw.v);
    blobs.set(blobFan, x, 0.004, z, fanBlob, fanBlob);
  }
  /* a rig that throws once is replaced by the primitive fallback for the rest of the visit */
  function swapKicker() {
    if (kicker.fallback) return;
    try { kicker.dispose(); } catch (e) { /* gone */ }
    kicker = people ? M.makeFallbackAvatar(A, { color: sigHex, emoji: who.avatar }) : M.makeFallbackPet(A, petId);
    kicker.root.scale.setScalar(kickScale); scene.add(kicker.root);
  }
  function swapFan() {
    if (!fan || fan.fallback) return;
    try { fan.dispose(); } catch (e) { /* gone */ }
    fan = people ? M.makeFallbackPet(A, fanPet.id) : M.makeFallbackAvatar(A, { color: sigHex, emoji: who.avatar });
    fan.root.scale.setScalar(fanScale); scene.add(fan.root);
  }
  function updateAim(lp, axI, ayI, rv) {
    const aiming = lp === 'aimX' || lp === 'aimY', locked = lp === 'windup' || lp === 'strike';
    aim.group.visible = aiming || locked;
    if (aim.group.visible) {
      const xU = P.MAP.lx2u(lp === 'aimX' ? axI : st.lockX);
      const slam = lp === 'aimY' && st.phaseT < 0.15 && !reduced ? 1.4 - 0.4 * (st.phaseT / 0.15) : 1;
      aim.pin.position.set(xU, 0.14, 0.06); aim.pin.scale.setScalar(slam);
      aim.column.visible = lp === 'aimX'; aim.column.position.set(xU, 0, 0);
      aim.railY.visible = lp === 'aimY'; aim.railY.position.set(xU, 0, 0.05);
      aim.reticle.visible = lp !== 'aimX';
      if (aim.reticle.visible) {
        const yU = P.MAP.ly2u(lp === 'aimY' ? ayI : st.lockY);
        const pulse = lp === 'windup' && !reduced ? 1 + 0.3 * Math.sin(Math.PI * Math.min(1, st.phaseT / C.T.WINDUP)) : 1;
        aim.reticle.position.set(xU, yU, 0.05); aim.reticle.scale.setScalar(pulse);
      }
      /* the top-corner zones twinkle at 0.5 Hz and brighten under the reticle */
      aim.zones.visible = aiming;
      const base = reduced ? 0.5 : 0.4 + 0.25 * Math.sin(TAU * C.RATES.TWINKLE_HZ * st.clock);
      let inZone = -1;
      if (lp === 'aimY' && st.lockX > P.POST_L + 6 && st.lockX < P.POST_R - 6 && st.ay > P.BAR + 6 && P.isTopCorner(st.lockX, st.ay)) inZone = st.lockX < P.MID ? 0 : 1;
      aim.zoneMat.opacity = inZone >= 0 ? 0.95 : base;
      aim.fills[0].material.opacity = aiming && inZone === 0 ? 0.16 : 0;
      aim.fills[1].material.opacity = aiming && inZone === 1 ? 0.16 : 0;
    }
    /* the help zone (kicks 1–2 before Bronze, and boosted kicks), then the teaching flash after a save */
    let a = 0;
    if (aiming && st.help) a = 0.35 * Math.min(1, st.aimT * C.T.HELP_IN);
    else if (lp === 'result' && st.result === 'save' && st.resT < 0.6) a = 0.45 * (1 - st.resT / 0.6);
    aim.setHelp(st.rival, a);
  }
  function updateCones(dt, coneMode, nLit, ex, ey, t) {
    if (!cones.mesh.visible) return;
    const rate = reduced ? 1 : Math.min(1, dt / 0.3), follow = reduced ? 1 : Math.min(1, dt * 6);
    for (let i = 0; i < 3; i++) {
      const target = i < nLit ? 1 : 0;
      coneK[i] += (target - coneK[i]) * (reduced ? 1 : Math.min(1, rate * 1.8));
      if (Math.abs(coneK[i] - target) < 0.01) coneK[i] = target;
      C.coneAim(i, coneMode, t, reduced, ex, ey, ca);
      const j = i * 3;
      if (coneDir[j] === 0 && coneDir[j + 1] === 0 && coneDir[j + 2] === 0) { coneDir[j] = ca.dx; coneDir[j + 1] = ca.dy; coneDir[j + 2] = ca.dz; }
      coneDir[j] += (ca.dx - coneDir[j]) * follow; coneDir[j + 1] += (ca.dy - coneDir[j + 1]) * follow; coneDir[j + 2] += (ca.dz - coneDir[j + 2]) * follow;
      cones.set(i, ca.x, ca.y, ca.z, coneDir[j], coneDir[j + 1], coneDir[j + 2], ca.len, coneCols[i], coneK[i]);
    }
    if (look.flood) {
      for (let f = 0; f < FLOODS.length; f++) {
        const fl = FLOODS[f], dx = -fl[0], dy = -fl[1], dz = 3 - fl[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        cones.set(3 + f, fl[0], fl[1] + 0.2, fl[2], dx, dy, dz, d * 0.8, floodCol, 0.32);
      }
    }
    cones.commit();
  }

  /* ---------------- RESULTS (the Encore dance break or the signature move) ---------------- */
  const DANCE_SPOT = { pet: [0, 2.95], avatar: [-1.15, 2.6], keeper: [1.3, 2.3] };
  /* the child's character's signature move, then a 1 s cheer, at least every 3 s */
  const sigCycle = sig ? Math.max(3, clipLen(kicker, sig, 2.2) + 1) : 3;
  function clipLen(r, clip, d) {
    try { const i = r && typeof r.info === 'function' ? r.info(clip) : null; return i && i.dur > 0 ? i.dur : d; } catch (e) { return d; }
  }
  function updateResults(dt) {
    resultsT += dt;
    if (st) consume();
    if (measureAt >= 0 && resultsT >= measureAt) { glassOff = measureGlass(); measureAt = -1; }
    const dance = !!(finale && finale.encoreDance), hop = reduced ? 1 : C.inOutSine(resultsT / 0.6), dT = Math.max(0, resultsT - 0.6);
    const rx = C.GEO.RUNUP, av = C.GEO.AVATAR;
    const px = C.lerp(rx[0], DANCE_SPOT.pet[0], hop), pz = C.lerp(rx[2], DANCE_SPOT.pet[1], hop), lift = reduced ? 0 : 0.25 * C.arc(Math.min(1, resultsT / 0.6));
    if (!resultsConfetti) {
      resultsConfetti = true;
      const n = dance ? (A.low ? 18 : 30) : (A.low ? 8 : 12);
      fx.confetti(-C.GEO.POST, 0.2, 1.5, n, 0.3, 1, 0.2, 0.7); fx.confetti(C.GEO.POST, 0.2, 1.5, n, -0.3, 1, 0.2, 0.7);
    }
    C.tweenTo(showTw, dance ? 1 : C.showLevel(st ? st.hype : 0), reduced ? 0.25 : 1.6, reduced ? 0.25 : 0.8);
    /* the kicker hops to the front of the stage, the touchline fan joins it; the child's figure leaps,
       arms up, already facing the camera from its last kick (so it never turns round mid-air) */
    let kickClip = people && !reduced && resultsT < 0.6 ? 'jump' : 'idle', kickT = resultsT, fanClip = people ? (reduced || resultsT >= 0.6 ? 'cheer' : 'hop') : 'cheer';
    if (dance && resultsT >= 0.6) {
      kickClip = 'dance'; kickT = dT; fanClip = 'dance';
      C.keeperDance(dT, reduced, DANCE_SPOT.keeper[0], DANCE_SPOT.keeper[1], kp);
      const dc = C.danceCount(dT, C.DANCE_BPM), loop = Math.floor(dT / (8 * dc.beat));
      if (dc.c === 7 && danceLoop !== loop) {
        danceLoop = loop;
        /* count 8: finger hearts and a 32-sparkle burst; the first time also fireworks and a cheer */
        fx.hearts(px, people ? 2.0 : 1.4, pz, 4); if (fan) fx.hearts(DANCE_SPOT.avatar[0], people ? 1.1 : 1.6, DANCE_SPOT.avatar[1], 4); fx.hearts(DANCE_SPOT.keeper[0], 2.2, DANCE_SPOT.keeper[1], 4);
        fx.sparkles(0, 1.6, 2.6, 32, 2.6, null, 0.8, 0.14);
        if (!cheerDone) {
          cheerDone = true; sfx('cheer');
          fx.ring(-2.6, 3.4, -1.5, 32, 2.2, cPink, 1.1); fx.ring(0, 4.0, -2.5, 32, 2.4, cGold, 1.1); fx.ring(2.6, 3.4, -1.5, 32, 2.2, cCyan, 1.1);
        }
      }
    } else {
      /* under 5 goals: the pet's signature move every 3 s (the child's figure: their character's own
         signature move, then a cheer; a cheer for a figure without one); the keeper waves, a good sport */
      if (resultsT >= 0.6 && people) {
        const cyc = dT % sigCycle;
        if (sig && cyc < sigCycle - 1) { kickClip = sig; kickT = cyc; } else { kickClip = 'cheer'; kickT = sig ? cyc - (sigCycle - 1) : dT; }
      } else if (resultsT >= 0.6) {
        const cyc = dT % 3, beat = 60 / C.DANCE_BPM;
        if (cyc < 1.02) { kickClip = 'dance'; kickT = 4 * beat + cyc * 2 * beat * 0.98; } else { kickClip = 'cheer'; kickT = cyc; }
      }
      kIn.lp = 'menu'; kIn.style = rival().style; kIn.clock = resultsT; kIn.reduced = reduced; kIn.bop = rival().id === 'rival_bop'; kIn.worried = false;
      C.keeperPose(kIn, kp);
      const kx = C.lerp(0, DANCE_SPOT.keeper[0], hop), kz = C.lerp(KZ, DANCE_SPOT.keeper[1], hop), dx = kx - kp.cx, dz = kz - kp.cz;
      kp.cx += dx; kp.gLx += dx; kp.gRx += dx; kp.cz += dz; kp.gLz += dz; kp.gRz += dz; kp.hugX += dx; kp.hugZ += dz;
      kp.gRy += 0.62; kp.gRx += reduced ? 0 : 0.1 * Math.sin(TAU * 1.2 * resultsT); kp.face = 1;
    }
    if (!dance || resultsT < 0.6) {
      if (dance) {
        C.keeperDance(0, true, C.lerp(0, DANCE_SPOT.keeper[0], hop), C.lerp(KZ, DANCE_SPOT.keeper[1], hop), kp);
        kp.cy += lift;
      }
    }
    keeper.apply(kp);
    poseKicker(px, pz, reduced || people ? 0 : C.lerp(Math.PI, 0, Math.min(1, resultsT / 0.4)), kickClip, kickT, 0, 1, -1);
    kicker.root.position.y = lift;
    placeFan(C.lerp(av[0], DANCE_SPOT.avatar[0], hop), C.lerp(av[2], DANCE_SPOT.avatar[1], hop), C.lerp(C.GEO.AVATAR_YAW, 0, hop), fanClip, dance ? dT : resultsT);
    if (fan && people) fan.root.position.y = lift;
    /* the ball rests on the spot; the stage lights stay on */
    ball.root.position.set(0.9, 0.11, 3.6); ball.root.quaternion.identity(); ball.root.scale.set(1, 1, 1);
    blobs.set(blobBall, 0.9, 0.004, 3.6, 0.3, 0.3);
    fx.halos.set(ballHalo, 0, 0, 0, 0.1, cSig, 0, 0, 0);
    for (let i = 0; i < 3; i++) fx.glowPool.set(dizzyIdx[i], 0, -5, 0, 0.1, cGold, 0, 0, 0);
    for (let g = 0; g < 2; g++) fx.halos.set(gloveHalo[g], 0, -5, 0, 0.1, cCyan, 0, 0, 0);
    aim.group.visible = false; aim.setHelp(null, 0); trail.reset(); goal.ripple(null);
    setWands(dance ? 1 : C.wandsLit(st ? st.hype : 0, !!look.night), false);
    stepWands(dt, 1);
    crowdCtx.bob = dance ? 0.1 : 0.05; crowdCtx.bpm = dance ? C.DANCE_BPM : 112;
    updateCones(dt, 'sweep', dance ? (tier === 'LOW' ? 2 : 3) : C.conesLit(st ? st.hype : 0, tier), 0, 0, viewT);
    spot.set(kp.cx, 0);
    stepShared(dt, viewT);
  }

  /* ---------------- MENU / TUTORIAL (the selected rival bounces in his set pose: no moves to show) ---------------- */
  function updateMenu(dt) {
    menuT += dt;
    const rv = P.rivalById(menuRival);
    if (keeper.rival !== rv.id) keeper.setRival(rv.id);
    kIn.lp = 'menu'; kIn.style = rv.style; kIn.clock = menuT; kIn.reduced = reduced; kIn.bop = rv.id === 'rival_bop';
    kIn.worried = false; kIn.intro = false; kIn.hasPrev = false;
    C.keeperPose(kIn, kp);
    keeper.apply(kp);
    for (let g = 0; g < 2; g++) {
      const on = rv.style === 'glow' ? (g ? kp.glowR : kp.glowL) : 0;
      keeper.gloveWorld(g === 0, v1);
      fx.halos.set(gloveHalo[g], v1.x, v1.y, v1.z + 0.12, 0.96, cCyan, 0.8 * on, 0, 0);
    }
    for (let i = 0; i < 3; i++) fx.glowPool.set(dizzyIdx[i], 0, -5, 0, 0.1, cGold, 0, 0, 0);
    fx.halos.set(ballHalo, 0, -5, 0, 0.1, cSig, 0, 0, 0);
    const K0 = C.GEO.KICKER;
    poseKicker(K0[0], K0[2], reduced ? 0.5 : 0.5 + 0.15 * Math.sin(TAU * 0.05 * menuT), 'idle', menuT, 0, 1, -1);
    placeFan(C.GEO.AVATAR[0], C.GEO.AVATAR[2], C.GEO.AVATAR_YAW, 'idle', menuT);
    ball.root.position.set(0, 0.11, 7.5); ball.root.quaternion.identity(); ball.root.scale.set(1, 1, 1);
    blobs.set(blobBall, 0, 0.004, 7.5, 0.3, 0.3);
    aim.group.visible = false; aim.setHelp(null, 0); trail.reset(); goal.ripple(null);
    if (wobbleOn) { goal.wobble(-1, 0); wobbleOn = false; }
    stepWands(dt, 1);
    crowdCtx.bob = 0.03; crowdCtx.bpm = 112;
    updateCones(dt, 'sweep', look.night ? 1 : 0, 0, 0, menuT);
    spot.set(kp.cx, 0);
    stepShared(dt, menuT);
  }

  /* ---------------- shared per-frame work: light, sky, crowd, particles, blobs ---------------- */
  const preOut = pre;
  function stepShared(dt, t) {
    const Ls = C.tweenStep(showTw, dt);
    C.presetMix(stadiumId, Ls, sigHex, preOut);
    hemi.color.setRGB(preOut.hemiSky[0], preOut.hemiSky[1], preOut.hemiSky[2], THREE.SRGBColorSpace);
    hemi.groundColor.setRGB(preOut.hemiGround[0], preOut.hemiGround[1], preOut.hemiGround[2], THREE.SRGBColorSpace);
    hemi.intensity = preOut.hemiI;
    sun.color.setRGB(preOut.sun[0], preOut.sun[1], preOut.sun[2], THREE.SRGBColorSpace);
    sun.intensity = preOut.sunI;
    scene.fog.color.setRGB(preOut.fog[0], preOut.fog[1], preOut.fog[2], THREE.SRGBColorSpace);
    scene.fog.near = preOut.fogNear; scene.fog.far = preOut.fogFar;
    renderer.toneMappingExposure = preOut.exposure;
    rimC.setRGB(preOut.rim[0], preOut.rim[1], preOut.rim[2], THREE.SRGBColorSpace);
    if (K.setRim) K.setRim(rimC, preOut.rimS);
    sky.update(dt, t, preOut, reduced, renderer.getPixelRatio());
    led.update(dt, reduced);
    crowdCtx.t = t; crowdCtx.reduced = reduced;
    crowdCtx.haloAlpha = 0.5 + 0.4 * Ls; crowdCtx.haloSize = 0.42 * (1 + 0.6 * Ls);
    crowdTick++;
    if (!reduced ? (!A.low || crowdTick % 2 === 0) : crowdTick % 8 === 0) crowd.update(crowdCtx);
    if (snow) snow.update(dt, t, reduced);
    blobs.set(blobKeeper, kp.cx, 0.004, kp.cz, 1.05 * kp.qx, 0.8);
    blobs.commit();
    fx.step(dt);
    if (hud) hud.update(dt);
  }

  /* ---------------- camera ---------------- */
  function applyCamera(dt) {
    if (shot.key !== camKey) {
      const cut = reduced || !camKey || shot.key === 'replay' || camKey === 'replay' || shot.key === 'intro' || !(shot.blend > 0);
      if (!cut) {
        from.px = cur.px; from.py = cur.py; from.pz = cur.pz; from.lx = cur.lx; from.ly = cur.ly; from.lz = cur.lz; from.fov = cur.fov; from.offY = cur.offY;
        blendT = 0; blendDur = shot.blend;
      } else blendDur = 0;
      camKey = shot.key;
    }
    let k = 1;
    if (blendDur > 0) { blendT += dt; k = C.inOutSine(blendT / blendDur); if (blendT >= blendDur) blendDur = 0; }
    cur.px = C.lerp(from.px, shot.px, k); cur.py = C.lerp(from.py, shot.py, k); cur.pz = C.lerp(from.pz, shot.pz, k);
    cur.lx = C.lerp(from.lx, shot.lx, k); cur.ly = C.lerp(from.ly, shot.ly, k); cur.lz = C.lerp(from.lz, shot.lz, k);
    cur.fov = C.lerp(from.fov, shot.fov, k); cur.offY = C.lerp(from.offY, shot.offY || 0, k);
    if (blendDur === 0) { from.px = cur.px; from.py = cur.py; from.pz = cur.pz; from.lx = cur.lx; from.ly = cur.ly; from.lz = cur.lz; from.fov = cur.fov; from.offY = cur.offY; }
    camera.position.set(cur.px, cur.py, cur.pz);
    camera.lookAt(cur.lx, cur.ly, cur.lz);                 /* up stays +y: the camera never rolls */
    const aspect = W && H ? W / H : 16 / 9;
    if (Math.abs(cur.fov - fovSet) > 1e-4 || Math.abs(cur.offY - offSet) > 1e-4 || aspect !== aspectSet) {
      fovSet = cur.fov; offSet = cur.offY; aspectSet = aspect;
      camera.fov = cur.fov; camera.aspect = aspect;
      if (cur.offY > 0.001 && W && H) camera.setViewOffset(W, H, 0, cur.offY * H, W, H); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
  }

  /* ---------------- adaptive fallback for a private renderer (the lease judges the shared one) ---------------- */
  let mon = 0, monSlow = 0, monLast = -1, monStepped = false;
  function selfMonitor(t) {
    if (monLast < 0) { monLast = t; return; }
    const iv = t - monLast; monLast = t;
    if (!(iv > 0) || iv > 1000) { mon = 0; monSlow = 0; return; }
    mon = mon ? mon * 0.95 + iv * 0.05 : iv;
    if (mon > 24 && !monStepped) {
      monSlow += iv;
      if (monSlow > 2000) { monStepped = true; monSlow = 0; renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() - 0.25)); A.setOutlines(false); keeper.setOutlines(false); fx.setScale(0.5); }
    } else if (mon > 50 && monStepped) { monSlow += iv; if (monSlow > 3000) fail('slow'); }
    else monSlow = 0;
  }

  /* ---------------- the view ---------------- */
  function frame(round, dt, alpha, phase) {
    if (disposed || failed) return;
    if (lost || revoked || (L && !L.active)) return;
    const t0 = now();
    dt = phase === 'paused' || !(dt > 0) ? 0 : Math.min(0.1, dt);
    viewT += dt;
    const playing = phase === 'playing' || phase === 'countdown' || phase === 'paused';
    const ending = phase === 'results' || phase === 'timeup';
    if (round && round.state && round !== roundRef && (playing || ending)) attach(round);
    const want = playing && roundRef ? 'play' : ending && roundRef && st && st.log && st.log.length ? 'results' : 'menu';
    if (want !== mode) enterMode(want);
    camIn.aspect = W && H ? W / H : 16 / 9; camIn.h = H; camIn.t = viewT;     /* H: the stage in CSS px (the fit on a phone held sideways) */
    if (mode === 'play') updatePlay(dt, alpha);
    else {
      if (mode === 'results') updateResults(dt); else updateMenu(dt);
      camIn.mode = demo ? 'demo' : mode === 'results' ? 'results' : 'menu'; camIn.offY = glassOff;
      C.cameraShot(camIn, shot);
    }
    applyCamera(dt);
    /* the comet ribbon faces the camera, so it is built after the camera moves */
    if (mode === 'play') trail.draw(camera.position, trailMode ? 0.11 : 0.08, 0.9, trailColor); else trail.reset();
    applyRenderer();
    voxFit.apply();                                       /* stepShared may have moved the lights on */
    renderer.render(scene, camera);
    if (phase === 'playing') {
      if (L) L.sample(now() - t0); else selfMonitor(t0);
    }
  }
  function resize(w, h) {
    if (disposed) return;
    W = Math.max(1, Math.round(w || 1)); H = Math.max(1, Math.round(h || 1));
    if (L) L.resize(W, H); else renderer.setSize(W, H, false);
    aspectSet = -1;
    if (mode === 'results') glassOff = measureGlass();
  }
  function setRound(round, v) {
    if (v) { variant = v; menuRival = P.rivalById(v).id; }
    if (round && round.state) attach(round);
    else if (mode === 'menu' || !mode) keeper.setRival(menuRival);
  }
  function cleanup() {
    try { scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); } catch (e) { /* partial scene */ }
    if (!built) dropKickRig();                            /* the child's figure was made before the scene */
    if (built) {
      [built.keeper, built.ball, kicker || built.kicker, fan || built.fan].forEach((x) => { try { if (x && x.dispose) x.dispose(); } catch (e) { /* gone */ } });
      try { built.fx.dispose(); } catch (e) { /* gone */ }
      try { if (built.snow) built.snow.dispose(); } catch (e) { /* gone */ }
      try { built.blobs.dispose(); } catch (e) { /* gone */ }
    }
    try { A.dispose(); } catch (e) { /* gone */ }
    scene.clear();
    if (rimSaved && K.setRim) { try { K.setRim(rimSaved.c, rimSaved.s); } catch (e) { /* kit gone */ } }
    voxFit.reset();                                       /* the next holder starts from today's look */
    if (ownRenderer) {
      canvasEl.removeEventListener('webglcontextlost', onCtxLost, false);
      canvasEl.removeEventListener('webglcontextrestored', onCtxRestored, false);
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* lost already */ }
      if (canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    } else if (L) {
      canvasEl.classList.remove('slg-gl');
      try { L.release(); } catch (e) { /* the stage is gone */ }
    }
    if (hub) { try { hub.dispose(); } catch (e) { /* gone */ } }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    try { if (hud) hud.dispose(); } catch (e) { /* gone */ }
    cleanup();
    /* the shared canvas belongs to the island again: the shell must not remove it */
    if (L) view.canvas = null;
  }
  function info() {
    const ri = renderer.info;
    return { tier, mode, lease: !!L, calls: ri.render.calls, tris: ri.render.triangles, programs: ri.programs ? ri.programs.length : 0,
      geometries: ri.memory.geometries, textures: ri.memory.textures, crowd: crowdShown, show: showTw.v, camera: camKey,
      variant, rival: menuRival, stadium: stadiumId, ball: ballId, voxGain: voxFit.gain(),
      /* who plays (kids update): 'person' | 'classic' (the child's figure) | 'pet' (V4.54), and the touchline */
      kicker: people ? (kicker.fallback ? 'fallback' : kicker.figure || 'person') : kicker.fallback ? 'fallback' : 'pet',
      touchline: fan ? (people ? 'pet' : 'avatar') : null };
  }

  /* compile behind the menu so the first kick doesn't stutter (hidden parts too) */
  try {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    if (L) L.compile(scene, camera);
    else if (typeof renderer.compileAsync === 'function') renderer.compileAsync(scene, camera).catch(() => {});
    hidden.forEach((o) => { o.visible = false; });
  } catch (e) { /* compiled lazily instead */ }
  enterMode('menu');
  keeper.setRival(menuRival);

  const view = {
    canvas: canvasEl, overlay: hud ? hud.el : null, frame, resize, setRound,
    setRival(v) { setRound(null, v); }, dispose, info
  };
  return view;
}

export default { create };
