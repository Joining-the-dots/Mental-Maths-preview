/* ================================================================
   My Island 3D — the pets' brain (island chunk 9; pure: no DOM, no THREE).
   window.SLPetBrain in the browser, module.exports in Node.
   Decides WHERE the pets go and WHAT they are doing; actors.js turns
   that into rig poses. Everything is deterministic per seed: one seeded
   RNG, a fixed-step friendly clock (step(dt) adds dt), no Math.random.

   Rules come only from SLWorldCore (landSet / occupancy / item / fpCells /
   entranceCells); heights from SLGrid3D.surfaceY when present.
     free cells   unlocked land minus 'object'-layer occupancy and the
                  avatar's cell. Paths and entrance cells are walkable.
                  Only the trampoline and bench behaviours ever put a pet
                  on an occupied cell (on the item's seat).
     planning     A* over 8 neighbours with no corner cutting, line-of-
                  sight pruning with a 0.2 u clearance, Catmull-Rom through
                  the (re-densified) cell centres; every smoothed path is
                  validated cell by cell (falls back to the polyline).
     walking      1.0 u/s, turn rate 6 rad/s, accel 3 u/s²; slows to turn in
                  place; waits ≤ 0.8 s for a pet in front, then re-plans.
     reservations every pet holds exactly ONE reserved cell — its target
                  while walking, its own cell otherwise (its approach / landing
                  cell while it is up on a seat, a roof or the stage deck) — so no
                  two pets ever pick the same spot or stand on each other. The
                  avatar's dance spot (studio at Showtime) is reserved the same way.
     sync         re-plans any pet whose cell / path / target became blocked;
                  a pet on a blocked cell, or enclosed in a 1-cell pocket while
                  a bigger area exists, pops (event 'pop') to the nearest free
                  cell; new pets 'spawn' near the house; a pet performing on an
                  item that moved or went away lands on a free cell.
     idle         an idle action every 4–8 s (start to start; the action is
                  sized to fit its gap): wander, sit, sniff, look at the camera,
                  look at the avatar, lean, look back, nod to the beat (music
                  only), nap, play (puppy tail chase · kitten pounce · bunny binky ·
                  dragon loop), visit an item (sniff flowers, watch fun items and
                  the city buildings, likelier when buildings are placed) or sit
                  on a bench (×4 likelier at Showtime). Reduced motion: turn and
                  emote only.
     perform      'trampoline': the active pet runs over (lead ≤ 1.2 s, a sparkle
                  zip when too far), hops on, bounces SLMotion's 3 bounces with
                  the front flip, hops off. 'bench': walks over, hops up, sits,
                  hops down. The city buildings (PERFORMS):
                  'pose'   (Photo Booth) runs to the front cell (lead ≤ 1.2 s) and
                           strikes 3 poses on the booth's ticks (perfPose 0..2)
                  'sip'    (Boba Café) runs to the café, hops onto the 'seat'
                           anchor, sits and wiggles, hops down
                  'roof'   (Rooftop Hangout) arc-hops up to the 'roof' anchor
                           (lead ≤ 2 s), rests 6 s, hops down
                  'studio' (Dance Studio) every pet to the entrance cells and
                           their neighbours, then the shared 8-count (danceAt)
                  'stage'  (Concert Stage) every pet up onto a deck mark (the
                           model's 'mark0'–'mark3' anchors, else STAGE; hop from
                           a pit / side cell), then the 8-count
                  Anchors come live from setAnchorFn(fn(uid, name) → {x, y, z} |
                  null) (the island supplies it), else from the building's
                  footprint. Returns the lead seconds (-1 = no pet / no legal
                  target: the building then animates alone). Never targets an
                  occupied, reserved or off-land cell.
     dance        pets gather (≤ 2 s) on open cells in front of the house (or at
                  the Dance Studio when one is placed), the 8-count at 118 BPM
                  (≈ 4.07 s) starts on the next bar (when a beat clock is given),
                  then the freeze; reduced = one freeze pose (on the stage the
                  pets appear on their marks). danceAt(t) is the shared timeline.
     glance       the avatar glances at a pet every 5–7 s (glanceAt).

   API
     SLPetBrain.create({seed, reduced, C, G}) → brain
       .sync({world | land/occ/placed, pets: [{id, active, name?, acc?}], avatar: {c, r} | null,
              mode: 'play'|'edit'|'place'}) → {added: [id], removed: [id], popped: [id]}
       .step(dt) → animating      advance the clock and every pet (no allocation in steady state)
       .pets                      stable pet state objects (fields documented at newPet)
       .pet(id) · .activeId() · .now · .graph · .camYaw (set by actors: yaw that faces the camera)
       .tap(id, out?) → emote kind | ''  hop pause + happy tail; emote chosen by the seeded RNG
                                  (out.tap = the species' tap reaction, W3b.12)
       .perform(kind, uid, petId?, {avatar}?) → lead seconds | -1   (avatar: true = the avatar
                                  joins a 'studio' / 'stage' dance: brain.avatarMark)
       .dance(on, {beat, bpm}) → seconds until the dance break is over (0 = none)
       .danceT0 · .danceOn · .danceEnd · .danceKind ('break' | 'studio' | 'stage') · .danceUid
       .avatarMark                {on, kind, uid, x, y, z, cell} — where the avatar dances
       .setAnchorFn(fn) · .setMusic(on) · .setMode(mode) · .setReduced(on) · .setShow(k)
       .events                    [{type: 'pop'|'spawn'|'emote'|'land'|'sparkle'|'cheer', id, …}] — the
                                  reader empties it (events are rare; they may allocate)
     Pure helpers (tests / actors): buildGraph, astar, distMap, smoothPath, pathValid, samplePath,
       heightAt, nearestFree, danceSpots, danceAt, alignDelay, glanceAt, bounceAt, makeRng, hash,
       cellIndex, cellOf, centreX, centreZ, WALK, IDLE, HOP, SEAT, BOUNCE, DANCE, GLANCE, ACTIONS,
       PERFORMS, POSE_TICKS, STAGE, ANCHOR_FALLBACK, posesOf

   MY ISLAND v3 (W3.7; contracts.crew, D29 / D83 / D91). Home behaviour is unchanged.
     create({isle, v3}) a brain for one island: 'home' (default; v3: true = the V3 terraces) or a
                  sky island on its LOCAL grid (land = C.landSetOf(w, isle), occupancy =
                  C.occupancy(w, -, isle), flat ground). Positions are island-local: world =
                  local + brain.frame {ox, oy, oz} (Home: 0); anchors from setAnchorFn are world
                  points and are taken back into the frame. The island brain hosts the active
                  pet only (its own mascots: W3b.12); its avatar stands on the dock (dockSpot).
     crossing(from, to, petId, {flight, instant, home}) → {seconds, length, speed} | null moves a
                  pet between two brains along Home gate pad → V3.bridge(isle) (the deck profile of
                  SLIsles3D) → dock, island to island via Home: 2.5 u/s, during a flight max(2.5,
                  path ÷ flight) capped at 6, a sparkle hop to the exit point when the pet is
                  more than 4 u from it; instant = it appears at the dock with one sparkle. The
                  sender keeps the pet 'away' (sync never re-adds it); the receiver hosts it in
                  state 'travel' until it lands on its arrival cell.
     perform(kind, uid) on a travelling pet queues the act: lead = the rest of the crossing + the
                  run over, and the part plays on arrival. The land-shop kinds (V3_KINDS):
                  named ride wheel slide wobble skate lift zip paddle bounce (the net: the
                  trampoline maths on its live seat) vine maypole feast cross pose bench (pose /
                  bench / feast on any item but the V4.54 booth and bench), and the generic
                  'seat:<clip>' / 'trail:<clip>' / 'stand:<clip>' from LOOK[id].perform /
                  performAt / trail. One route engine runs them all: a run over (zip when far),
                  legs over the item's LIVE anchors ('hop' · 'go' through a list · 'ride' on a
                  pivoted point · 'stand' · 'pop' a sparkle jump where a hop cannot reach), a hop
                  (or pop) back to a free side cell — inside the act's SLMotion seconds and its pet
                  window (petT / the act's own channels). Lead ≤ 0 = no pet.

   THE LAND MASCOTS (W3b.12; D97, D111, D112). Species come from the tables: PLAY / SPECIES_W keep
   the four V4.54 pets byte for byte, and a mascot reads its row of SLIslandLook.SPECIES3.
     play         PLAY_MOVES: the ten play moves of catalogAdditions.crewMoves, each one in-place
                  ACTIONS entry of its own seconds (dig 1.8 · flutter 1.4 · loaf 2.4 · tumble 0.85 ·
                  stash 1.8 · glide 1.4 · follow 2.0 · prance 1.6 · bellyflop 1.4 · clap 1.6); a
                  move never travels; the gull's half turn and the owlet's full turn are driven
                  here on the body yaw (so the gull stays turned round, with no snap back); follow
                  turns to the avatar (the runner when no avatar stands on that island). Never
                  chosen under reduced motion (REDUCED_W has no play). playOf(species).
     weights      weightsOf(species): SPECIES3 weights are factors on WEIGHTS (a key not listed is
                  1); favourite items are only the 'visit' factor. No new perform kinds.
     tap          tap(id, out) → the emote as before; out.tap (and pet.tapKind) = the species' tap
                  reaction 'hop' | 'rear' | 'clap' (tapOf; the pony rears, the seal pup claps).
     guests       sync() pets entries may carry guest: true — a visited land's own mascots (D112).
                  On an island brain a guest comes out on the free square nearest the landmark's
                  'spot' (one 'spawn' sparkle), idles, plays and answers taps; it is never the
                  active pet, never takes part in an act perform (perform() with it → -1; the
                  maypole never recruits it) and joins a dance break like the rest of the crew.

   THE KIDS UPDATE (P2.5; kids-update pets.json rigs.newPlayMoves / moodAndEating, decisions P21–P23)
     play         four more PLAY_MOVES, in place: curl 2.0 (hedgehog, tortoise) · balance 2.0 (flamingo)
                  · fan 2.2 (peacock) · stand 1.8 (red panda); playOf() also accepts the four V4.54
                  play actions (V454_PLAY) as a v3 row's play (binky: the guinea pig, pounce: the snow
                  leopard).
     pace         speedOf(species) = WALK.speed × SPECIES3.pace: a pet's own walks (wander, visits, the
                  bench) and the floor of its run-overs; crossings and act lead times keep their speeds.
     mood         sync() pets entries may carry mood {hunger 0–3, happy 0–4, sitter} (moodOf). hunger 1:
                  lookAvatar × 1.5 · 2: walks × 0.75, play 0, sit × 1.6 · 3: walks × 0.6, sit and nap × 2,
                  now and then the 'sad' pout (1.6 s) · happy 4: play × 1.5 and the 'signature' (its
                  DANCE_PLAN counts 5–6, in place) once every 20–30 s · happy 0: lookAvatar × 1.5, wander
                  × 0.6. Reduced motion: the weights only (no pout, no signature). A pet with no mood
                  behaves exactly as before. tap() on a hungry pet (hunger ≥ 2): out.tap = 'hungry' (the
                  softer reaction; no happy tail).
     feed         feed(id, {fav}) → lead | -1: see feed() below. 'eat' (2.0 s) is never an idle choice.
     give way     a walking pet that re-plans GIVE_WAY times in a row without getting anywhere steps back
                  to the free square round it farthest from the pet in its way (or, stuck again, pops to
                  the nearest square clear of every pet), then idles: pets that block each other no longer
                  freeze, and settled pets keep their distance.

   ISLAND ACTIVITIES v1 (IA-3; chatgpt-feedback/ISLAND-ACTIVITIES-PLAN.md §2 A2 / A5, §5 IA-3). Free play: nothing
   here earns, spends or decays, and nothing is chance (the throw spots, hide cells and walks are pure geometry).
     fetch        fetch(id, x, z, {from: {x, y, z}}?) → the seconds until the pet has the ball | -1 (no such pet out
                  here, a guest, travelling, eating, edit mode, a fetch already on, nowhere free to land). x, z
                  island-local (the tap); from = the child's hand (default: the avatar's cell, FETCH.hand up). It pre-
                  empts the way feed() does (a seat, a dance, a hide end first). p.state 'fetch', p.fetch the record
                  actors.js draws the ball from (ballAt): the ball flies from the hand, bounces twice and rests on the
                  free cell nearest the tap (never a blocked or reserved one; a sea tap: the beach cell nearest it, with
                  p.fetch.splash {x, z} just off it); p.action 'fetchRun' (it watches the throw FETCH.react s, then
                  races along a time-driven path at WALK.run × its pace and stops FETCH.stop u short of the ball),
                  'fetchCarry' (it takes it: event 'caught', the ball in its mouth: held; it trots back to the free cell
                  in front of the child and to one side, FETCH.side from the camera's way) and 'fetchDrop' (it drops it
                  at the child's feet, FETCH.feet u in front of them on the camera's side, with its species' tap
                  reaction: event 'fetched' {n, x, y, z}). A ball on a trampoline (or a v3 net, LOOK perform 'bounce')
                  waits on the mat ('fetchWait') and the pet bounces for it through the trampoline's own perform
                  (p.state 'perform'; it takes the ball as it lands on the mat), then carries it back. Cut short (edit
                  mode, a layout that blocks its way, a feed, travel): event 'fetchCut', the ball drops where the pet
                  is. Reduced motion: the end state at once (the pet at the child's feet, the ball dropped; lead 0).
                  throwSpot(k) → {x, z}: the k-th automatic throw's spot (in front of the child, ±0.6 rad turns).
     hide         hide(id, uid, camYaw?) → the hiding cell | -1: the free cell of the ring round item uid's footprint (its
                  side and corner neighbours) farthest along the camera's forward direction (-sin camYaw, -cos camYaw;
                  brain.camYaw by default; of equals the one farthest across the view: a back corner), never
                  blocked or reserved; its spot in the cell is toward the edge of the thing's footprint as the camera
                  sees it (at most HIDE.peek u from the cell's middle), so half of it peeks out; the pet trots there (≤ HIDE.trot s, time-driven: under the host's 2 s veil;
                  a sparkle-free jump when it cannot run it in time, and at once under reduced motion) and crouches
                  there facing the thing (p.state 'hide', p.action 'hideGo' then 'peek'). unhide(id) → bool: out
                  again with its happy reaction and event 'found' (the sparkle ring). A hiding pet never idles,
                  performs or joins a dance; the thing moved or gone, edit mode, a feed or travel end it quietly.
     waiting      while a fetch or a hide is on, dance(true) gives 0 and the Dance Studio / Concert Stage perform
                  gives -1 (the building plays alone): the dance break waits. perform() never takes a playing pet.
     visitor      setVisitor({id, from: {x, z}?, instant?} | null) → the visitor's cell | -1. A visitor is a guest
                  of the brain, never one of brain.pets: it is never fed, never performs, never the runner and
                  never dances. It stands on visitorSpot(): the free, unreserved cell nearest the house entrance
                  that is not a ▶ PLAY pad (a launch item's entrance row) or the cell of a bowl that is out (until
                  the meal's end). Its cell is held (VISITOR_RES) like the avatar's dance spot, so no pet stands on
                  it or plans through it (a walk squeezes past the other pets before it would cross the visitor,
                  and does only when the visitor stands in the only way; the smoothed line keeps off its cell). It
                  walks in from `from` at VISIT.speed (≤ VISIT.max u: a longer way starts that far out; event
                  'visitor' {arrive: true} where it starts), or appears there at once (instant, reduced motion, no
                  from). brain.visitor {id, x, y, z, yaw, cell, state 'walk' | 'stand', speed}. A layout that
                  covers its cell moves it to the next spot (event 'visitor').
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var C = null, G = null;
    try { C = require('../world-core.js'); } catch (e) { C = null; }
    try { G = require('./grid3d.js'); } catch (e) { G = null; }
    module.exports = factory(root, C, G);
  } else root.SLPetBrain = factory(root, null, null);
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, C0, G0) {
  'use strict';

  var VERSION = 1;
  var COLS = 16, ROWS = 10, NCELL = COLS * ROWS;
  var PI = Math.PI, TAU = PI * 2, SQRT2 = Math.SQRT2;

  /* lazy lookups so script order never matters in the browser */
  function core(opt) { return opt || C0 || (root && root.SLWorldCore) || null; }
  function grid(opt) { return opt || G0 || (root && root.SLGrid3D) || null; }
  var sibs = {};
  function sib(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function look() { return sib('SLIslandLook', '../world-look.js'); }
  function motion() { return sib('SLMotion', './motion.js'); }

  /* ---------------- tuning (art bible + architecture 'animation') ---------------- */
  var WALK = {
    speed: 1.0, turn: 6, accel: 3, run: 3, zip: 5.5, runAccel: 14,
    near: 0.45, wait: 0.8, look: 0.18, clearance: 0.2, startFree: 0.3, step: 0.05, sub: 4
  };
  var IDLE = { min: 4, max: 8, first: 0.6, stagger: 0.9, slack: 0.6, turnPad: 0.5 };
  /* hops onto / off seats (s, u): the trampoline, the bench and café stool, the roof deck */
  var HOP = { on: 0.32, off: 0.4, h: 0.22, benchOn: 0.36, roofOn: 0.7, roofOff: 0.6, roofH: 0.35 };
  /* seats (item space, from the models): trampoline mat top (T.y - T.depth), bench 'seat' anchor */
  var SEAT = { trampoline: { y: 0.374, z: 0, face: null }, bench: { y: 0.31, z: 0.03, face: 0 } };
  /* the trampoline bounce — the same numbers as SLMotion.BOUNCE (checked by the tests) */
  var BOUNCE = { g: 24, contact: 0.075, heights: [0.5, 0.75, 1.0], dip: 0.12, maxLead: 1.2, minLead: 0.45 };
  BOUNCE.flights = BOUNCE.heights.map(function (h) { return 2 * Math.sqrt(2 * h / BOUNCE.g); });
  BOUNCE.length = 4 * BOUNCE.contact + BOUNCE.flights.reduce(function (a, b) { return a + b; }, 0);
  var DANCE = {
    bpm: 118, counts: 8, beat: 60 / 118, dur: 8 * 60 / 118, gatherMax: 2, hold: 0.6, reducedDur: 2.2,
    /* generic moves only: 1–2 groove bounce · 3–4 step-touch · 5–6 the species signature ·
       7 a point that snaps to the camera · 8 the freeze */
    moves: ['groove', 'groove', 'step', 'step', 'signature', 'signature', 'point', 'freeze'],
    /* the dragon's sparkle puff, the burst on the freeze (the avatar's finger-heart), 'cheer' */
    cues: [{ count: 5, emit: 'puff', who: 'pet_dragon' }, { count: 8, emit: 'burst', fingerHeart: 'avatar' }, { count: 9, sfx: 'cheer' }]
  };
  var GLANCE = { min: 5, max: 7, dur: 1.6, ease: 0.3 };

  /* the city-building performances (the building model calls a.pets.perform(kind, uid)) */
  var PERFORMS = {
    trampoline: { id: 'trampoline' }, bench: { id: 'bench' },
    pose: { id: 'bld_photobooth', maxLead: 1.2 },
    sip: { id: 'bld_boba', anchor: 'seat', maxLead: 1.2, rest: 2.4, maxY: 1.2 },
    roof: { id: 'bld_rooftop', anchor: 'roof', maxLead: 2, rest: 6, maxY: 2.4 },
    studio: { id: 'bld_dance', group: true },
    stage: { id: 'bld_stage', group: true }
  };
  /* the photo booth's three poses (sit · paw-point · cheer) start on its countdown ticks
     (SLMotion 'snap' at 0.1 / 0.7 / 1.3 s) or 0.6 s apart from the pet's arrival */
  var POSE_TICKS = [0.1, 0.7, 1.3], POSE_GAP = 0.6, POSE_HOLD = 0.9;
  /* the Concert Stage deck (item space): the top at y 0.32, marks across its front half,
     the avatar centre stage. With the island's anchor function the model's own 'mark0'–'mark3'
     (left to right) win, taken in markOrder so the inner pair still fills first */
  var STAGE = { y: 0.32, z: 0.3, xs: [-0.55, 0.55, -1.05, 1.05], me: [0, 0.32, 0.38], markOrder: [1, 2, 0, 3] };
  /* where a seat sits when the island gives no anchor function (item space) */
  var ANCHOR_FALLBACK = { bld_boba: { seat: [0.5, 0.42, 0.18] }, bld_rooftop: { roof: [-0.3, 1.66, -0.15] } };
  var AVATAR_RES = 999;                      /* the reservation value of the avatar's dance spot */

  /* in-place actions: duration range (s); kinds the actors know how to pose */
  var ACTIONS = {
    sit: { dur: [2.5, 4] }, sniff: { dur: [1.6, 2.4] }, look: { dur: [1.6, 2.4] }, lookAvatar: { dur: [1.6, 2.4] },
    lean: { dur: [2, 2] }, lookBack: { dur: [1.6, 1.6] }, beatNod: { dur: [2.4, 3.6] }, nap: { dur: [3.2, 7.2] },
    chase: { dur: [1.6, 1.6] }, pounce: { dur: [1.0, 1.0] }, binky: { dur: [0.9, 0.9] }, loop: { dur: [1.4, 1.4] },
    turn: { dur: [1.2, 1.6] }, emote: { dur: [1.2, 1.6] }
  };
  var PLAY = { pet_puppy: 'chase', pet_kitten: 'pounce', pet_bunny: 'binky', pet_dragon: 'loop' };
  /* the land mascots' play moves (catalogAdditions.crewMoves.play, D111): seconds, and the body turn
     the brain drives as [radians, from, to] (fractions of the move) */
  var PLAY_MOVES = {
    dig: { sec: 1.8 }, flutter: { sec: 1.4, turn: [PI, 0.07, 0.54] }, loaf: { sec: 2.4 }, tumble: { sec: 0.85 },
    stash: { sec: 1.8 }, glide: { sec: 1.4, turn: [TAU, 0.06, 0.51] }, follow: { sec: 2.0 }, prance: { sec: 1.6 },
    bellyflop: { sec: 1.4 }, clap: { sec: 1.6 },
    /* the kids update's four (pets.json rigs.newPlayMoves): hedgehog / tortoise, flamingo, peacock, red panda */
    curl: { sec: 2.0 }, balance: { sec: 2.0 }, fan: { sec: 2.2 }, stand: { sec: 1.8 }
  };
  Object.keys(PLAY_MOVES).forEach(function (k) { ACTIONS[k] = { dur: [PLAY_MOVES[k].sec, PLAY_MOVES[k].sec] }; });
  /* a v3 row may also play one of the V4.54 play actions (the guinea pig's binky, the snow leopard's pounce) */
  var V454_PLAY = { chase: 1, pounce: 1, binky: 1, loop: 1 };
  /* KIDS UPDATE P2.5 (pets.json moodAndEating): 'eat' (only ever started by feed()), the hungry pet's
     'sad' pout and the very happy pet's 'signature' (its DANCE_PLAN counts 5–6, in place). None is in
     WEIGHTS: sad and signature join a pet's idle choice only through its mood. */
  ACTIONS.eat = { dur: [2, 2] };
  ACTIONS.sad = { dur: [1.6, 1.6] };
  ACTIONS.signature = { dur: [2 * DANCE.beat, 2 * DANCE.beat] };
  /* mood (view.pets[].mood {hunger 0–3, happy 0–4}): the walk speed factor per hunger level, the sad
     pout's weight and clip intensity, the signature's spacing (s) */
  var MOOD = { cruise: [1, 1, 0.75, 0.6], sad: 0.6, sadIntensity: 0.4, sigEvery: [20, 30] };
  /* feeding (decision P21): the bowl pops in (pop s) beside the pet (dist u away, in one of the dirs round
     the camera so the child sees it), the meal drops in (drops), the pet hops over (hop) to reach u from
     the bowl and eats (eat s, the pile going in 4 steps), one happy tap reaction, the bowl pops out (out s).
     Under reduced motion the end state stands for still s. */
  var FEED = { pop: 0.2, drops: [0.2, 0.35, 0.5, 0.65], hop: [0.65, 1.0], eat: 2.0, out: 0.2, still: 1.2, r: 0.3,
               dist: 0.72, reach: 0.4, dirs: [0.9, -0.9, 1.7, -1.7, 0, 2.6, -2.6, PI] };
  /* the give-way loop: a walking pet that re-plans this many times in a row without getting anywhere
     steps back (giveWay), so pets that block each other never freeze */
  var GIVE_WAY = 3;
  var TAPS = ['hop', 'rear', 'clap'];
  /* ISLAND ACTIVITIES v1 (IA-3). Fetch: the throw's flight (s: 0.45 + perU × its length, clamped) and arc (the apex
     over the straight line, u), the child's hand height (u), the two bounces ([s, u]), how far short of the ball the
     pet stops (u), the moment it takes it (s), its race (u/s: WALK.run × pace, clamped) and the trot back (WALK.run ×
     carryK × pace, clamped), the drop spot (front u from the child, turned side rad from the camera's way so neither
     hides the other or the ball), where the ball lands (feet u in front of the child, toward the camera), the drop (s),
     the longest race
     before a sparkle zip (s), the ball's radius (u), the sea throw's splash ring (u off the beach cell), the reduced
     moment (s), and the automatic throws (distance u, turns rad) */
  var FETCH = { react: 0.25, flight: [0.5, 1.0], perU: 0.07, arc: [0.6, 1.6], arcPerU: 0.1, hand: 0.75,
                bounces: [[0.3, 0.26], [0.18, 0.09]], stop: 0.3, pick: 0.25, run: [1.2, 3], carry: [1.0, 2.2], carryK: 0.7,
                front: 1.0, side: 0.9, feet: 0.45, drop: 0.6, maxRun: 4, ballR: 0.09, splash: 0.55, edge: 0.35, still: 1.2,
                auto: [1.6, 1.9], autoTurn: [0, 0.6, -0.6] };
  /* hide and seek: the trot to the hiding cell (s, ≤ the host's 2 s veil), its shortest, its pace (× the pet's walk), and
     how far at most it sits to one side of the cell's middle (u): across the camera's view, toward the edge of the
     thing's footprint as the camera sees it, so half of it (its ears, its tail) peeks out past that edge */
  var HIDE = { trot: 1.8, minTrot: 0.4, pace: 1.6, peek: 0.42 };
  /* the visitor: its walk in (u/s) and the longest walk (u) */
  var VISIT = { speed: 1.0, max: 4.5 };
  var VISITOR_RES = 998;                     /* the reservation value of the visitor's cell */
  var POUNCE_DIST = 0.35;
  /* idle choice weights (base); species tweaks below. beatNod only while music plays. */
  var WEIGHTS = { wander: 4, sit: 1.2, sniff: 1.1, look: 1, lookAvatar: 1, lean: 0.8, lookBack: 0.7, beatNod: 1.1, nap: 0.35, play: 1, visit: 1.3, bench: 0.8 };
  var SPECIES_W = {
    pet_puppy: { play: 1.3, lookBack: 1.2 }, pet_kitten: { play: 1.6, nap: 0.6, lean: 1.3 },
    pet_bunny: { sniff: 1.6, beatNod: 1.2 }, pet_dragon: { play: 1.2, lean: 0.8 }
  };
  var REDUCED_W = { look: 1.2, lookAvatar: 1, turn: 1.4, emote: 0.8 };
  /* a species' row of the tables: the V4.54 four above; a land mascot from SLIslandLook.SPECIES3 */
  function species3(sp) { var L = look(), S = L && L.SPECIES3; return S && typeof sp === 'string' && Object.prototype.hasOwnProperty.call(S, sp) ? S[sp] : null; }
  function playOf(sp) { if (PLAY[sp]) return PLAY[sp]; var s = species3(sp); return s && (PLAY_MOVES[s.play] || V454_PLAY[s.play]) ? s.play : 'chase'; }
  function tapOf(sp) { var s = species3(sp); return s && TAPS.indexOf(s.tap) >= 0 ? s.tap : 'hop'; }
  /* SPECIES3.pace (0.4–1.2, default 1): the factor on WALK.speed for a pet's own walks (a V4.54 pet: 1) */
  function paceOf(sp) { var s = species3(sp), v = s ? +s.pace : NaN; return isFinite(v) && v > 0 ? clamp(v, 0.4, 1.2) : 1; }
  function speedOf(sp) { return WALK.speed * paceOf(sp); }
  /* a view.pets mood {hunger 0 fine · 1 peckish · 2 hungry · 3 very hungry, happy 0–4, sitter} → a copy, or null */
  function moodOf(m) {
    if (!m || typeof m !== 'object') return null;
    var h = Math.round(+m.hunger), j = Math.round(+m.happy);
    return { hunger: isFinite(h) ? clamp(h, 0, 3) : 0, happy: isFinite(j) ? clamp(j, 0, 4) : 2, sitter: m.sitter === true };
  }
  /* the mood's factors on an idle choice's weights (only keys already there; reduced: weights only) */
  function moodWeights(m, w, reduced) {
    if (!m) return w;
    function mul(k, f) { if (w[k] != null) w[k] *= f; }
    if (m.hunger === 1) mul('lookAvatar', 1.5);
    if (m.hunger >= 2) { if (w.play != null) w.play = 0; mul('sit', m.hunger === 2 ? 1.6 : 2); }
    if (m.hunger === 3) { mul('nap', 2); if (!reduced) w.sad = MOOD.sad; }
    if (m.happy >= 4 && m.hunger < 2) mul('play', 1.5);
    if (m.happy === 0) { mul('lookAvatar', 1.5); mul('wander', 0.6); }
    return w;
  }
  var W3 = {};
  function weightsOf(sp) {
    if (SPECIES_W[sp]) return SPECIES_W[sp];
    if (W3[sp]) return W3[sp];
    var s = species3(sp), out = {};
    if (!s) return out;                                /* not cached: SLIslandLook may load later */
    Object.keys(s.weights || {}).forEach(function (k) { var v = +s.weights[k]; if (WEIGHTS[k] != null && isFinite(v)) out[k] = clamp(v, 0, 3); });
    return (W3[sp] = out);
  }
  /* idle emotes (hearts belong to the avatar's finger-heart only) */
  var EMOTES = ['note', 'star', 'sparkle'];
  /* what a visit does at each kind of item */
  var SNIFF_IDS = /^(flower_|bush_|tree_|rock_|mushroom_)/;
  var WATCH_IDS = { trampoline: 1, fountain: 1, swing: 1, bubbles: 1, windmill: 1, sandcastle: 1, snowman: 1, lighthouse: 1, att_course: 1, att_pitch: 1, att_kart: 1 };
  var CITY_IDS = /^bld_/;                    /* the city buildings: watched, and idled near */

  /* ---------------- maths ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function frac(v) { return v - Math.floor(v); }
  function wrap(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
  function smooth01(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function arc(u) { u = clamp01(u); return 4 * u * (1 - u); }
  /* FNV-1a, the same hash as SLMotion / SLGrid3D */
  function hash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /* mulberry32: small, fast, good enough for kid-pet choices */
  function makeRng(seed) {
    var s = (typeof seed === 'number' && isFinite(seed) ? seed : hash(seed == null ? 'pets' : seed)) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mix01(seed, n) {
    var h = (seed ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ---------------- cells ---------------- */
  function cellIndex(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1; }
  function cellOf(x, z) { return cellIndex(Math.floor(x + COLS / 2), Math.floor(z + ROWS / 2)); }
  function colOf(i) { return i % COLS; }
  function rowOf(i) { return (i - i % COLS) / COLS; }
  function centreX(i) { return colOf(i) - 7.5; }
  function centreZ(i) { return rowOf(i) - 4.5; }
  function keyOf(i) { return colOf(i) + ',' + rowOf(i); }
  function parseKey(k) { var p = String(k).split(','); return cellIndex(+p[0], +p[1]); }
  var NB_DC = [1, -1, 0, 0, 1, 1, -1, -1], NB_DR = [0, 0, 1, -1, 1, -1, 1, -1];

  /* terrace heights: SLGrid3D.surfaceY, else the same rule from the region table */
  var TERRACE = [0.45, 0.35, 0.25, 0.15];
  function surfaceAt0(c, r, Cx, Gx) {
    var G = grid(Gx);
    if (G && typeof G.surfaceY === 'function') { try { return +G.surfaceY(c, r) || 0; } catch (e) { /* fall through */ } }
    var Cc = core(Cx), reg = Cc && Cc.CELL_REGION ? Cc.CELL_REGION[c + ',' + r] : null;
    return reg === 'meadow' ? TERRACE[Math.min(c, TERRACE.length - 1)] : 0;
  }

  /* ================================================================
     THE FREE-CELL GRAPH
     src: a SLWorldCore world {owned, placed} | a view {placed, unlocked} |
          {land: {'c,r': 1}, occ: {'c,r': {uid, id, layer}}, placed}
     opts: {avatar: {c, r} | cell index | null, C, G}
     ================================================================ */
  function landOf(src, Cc) {
    if (src && src.land && typeof src.land === 'object') return src.land;
    if (src && src.owned && Array.isArray(src.placed) && Cc && typeof Cc.landSet === 'function') return Cc.landSet(src);
    var regions = src && Array.isArray(src.unlocked) ? src.unlocked : ['home'], out = {};
    regions.forEach(function (k) { ((Cc && Cc.REGION_CELLS && Cc.REGION_CELLS[k]) || []).forEach(function (c) { out[c] = 1; }); });
    return out;
  }
  function itemOf(Cc, id) { return Cc && typeof Cc.item === 'function' ? Cc.item(id) : null; }
  function occOf(src, Cc) {
    if (src && src.occ && typeof src.occ === 'object') return src.occ;
    var placed = src && Array.isArray(src.placed) ? src.placed : [];
    if (Cc && typeof Cc.occupancy === 'function') return Cc.occupancy({ placed: placed }).occ;
    var occ = {};
    placed.forEach(function (p) {
      var it = itemOf(Cc, p.id), fp = (it && it.fp) || [1, 1];
      for (var dy = 0; dy < fp[1]; dy++) for (var dx = 0; dx < fp[0]; dx++) occ[(p.x + dx) + ',' + (p.y + dy)] = { uid: p.uid, id: p.id, layer: it && it.kind === 'path' ? 'ground' : 'object' };
    });
    return occ;
  }
  function avatarCellOf(a) {
    if (a == null || a === false) return -1;
    if (typeof a === 'number') return a >= 0 && a < NCELL ? a : -1;
    if (typeof a.c === 'number' && typeof a.r === 'number') return cellIndex(a.c, a.r);
    if (typeof a.x === 'number' && typeof a.z === 'number') return cellOf(a.x, a.z);
    return -1;
  }
  /* the house's door point (between its entrance cells) and its first entrance cell */
  function houseOf(placed, Cc) {
    for (var i = 0; placed && i < placed.length; i++) {
      var p = placed[i], it = itemOf(Cc, p.id);
      if (p.id === 'house_cottage' || (it && it.kind === 'house')) {
        var fp = (it && it.fp) || [2, 2];
        return { uid: p.uid, x: p.x + fp[0] / 2 - 8, z: p.y + fp[1] - 5, entrance: cellIndex(p.x, p.y + fp[1]) };
      }
    }
    return null;
  }

  function buildGraph(src, opts) {
    opts = opts || {};
    var Cc = core(opts.C), Gx = opts.G, hf = typeof opts.heights === 'function' ? opts.heights : null;
    function surfaceAt(c, r, Cx2, Gx2) { return hf ? hf(c, r) : surfaceAt0(c, r, Cx2, Gx2); }
    var land = landOf(src, Cc), occ = occOf(src, Cc), placed = src && Array.isArray(src.placed) ? src.placed : [];
    var g = {
      walk: new Uint8Array(NCELL), land: new Uint8Array(NCELL), y: new Float32Array(NCELL),
      obj: new Array(NCELL), comp: new Int16Array(NCELL), compSize: [0], largest: 0,
      objects: {}, items: [], city: 0, avatar: -1, avatarX: 0, avatarZ: 0, house: null, free: 0
    };
    var i, c, r;
    for (i = 0; i < NCELL; i++) {
      c = colOf(i); r = rowOf(i);
      var k = c + ',' + r, o = occ[k];
      g.obj[i] = o && o.layer !== 'ground' ? o : null;
      if (land[k]) { g.land[i] = 1; g.y[i] = surfaceAt(c, r, Cc, Gx); }
    }
    var av = avatarCellOf(opts.avatar);
    if (av < 0 && opts.avatar !== null && opts.avatar !== false) {
      var h0 = houseOf(placed, Cc);
      if (h0 && h0.entrance >= 0 && g.land[h0.entrance] && !g.obj[h0.entrance]) av = h0.entrance;
    }
    g.avatar = av;
    if (av >= 0) { g.avatarX = centreX(av); g.avatarZ = centreZ(av); }
    for (i = 0; i < NCELL; i++) { g.walk[i] = g.land[i] && !g.obj[i] && i !== av ? 1 : 0; if (g.walk[i]) g.free++; }
    /* placed objects (fun items, benches, plants…): pivots and adjacent free cells */
    placed.forEach(function (p) {
      var it = itemOf(Cc, p.id);
      if (!it || it.kind === 'path') return;
      var fp = it.fp || [1, 1], cells = [], adj = [];
      for (var dy = 0; dy < fp[1]; dy++) for (var dx = 0; dx < fp[0]; dx++) { var ci = cellIndex(p.x + dx, p.y + dy); if (ci >= 0) cells.push(ci); }
      var base = 0;
      cells.forEach(function (ci) { base = Math.max(base, g.land[ci] ? g.y[ci] : surfaceAt(colOf(ci), rowOf(ci), Cc, Gx)); });
      for (var yy = p.y - 1; yy <= p.y + fp[1]; yy++) for (var xx = p.x - 1; xx <= p.x + fp[0]; xx++) {
        var ai = cellIndex(xx, yy);
        if (ai < 0 || cells.indexOf(ai) >= 0 || !g.walk[ai]) continue;
        var diag = (xx < p.x || xx >= p.x + fp[0]) && (yy < p.y || yy >= p.y + fp[1]);
        if (!diag) adj.push(ai);                         /* side neighbours only: pets face the item squarely */
      }
      var ob = { uid: p.uid, id: p.id, kind: it.kind, c: p.x, r: p.y, w: fp[0], h: fp[1], cells: cells, adj: adj,
                 x: p.x + fp[0] / 2 - 8, z: p.y + fp[1] / 2 - 5, y: base };
      g.objects[p.uid] = ob;
      g.items.push(ob);
      if (CITY_IDS.test(p.id)) g.city++;
    });
    g.house = houseOf(placed, Cc);
    labelComponents(g);
    return g;
  }
  /* neighbour n of cell i is passable (no corner cutting on diagonals) */
  function stepOk(g, i, n, extra) {
    var c = colOf(i) + NB_DC[n], r = rowOf(i) + NB_DR[n], j = cellIndex(c, r);
    if (j < 0 || !g.walk[j] || (extra && extra[j])) return -1;
    if (n >= 4) {
      var a = cellIndex(c, rowOf(i)), b = cellIndex(colOf(i), r);
      if (!g.walk[a] || !g.walk[b] || (extra && (extra[a] || extra[b]))) return -1;
    }
    return j;
  }
  function labelComponents(g) {
    var comp = g.comp, size = [0], queue = new Int16Array(NCELL), best = 0, bestN = 0;
    comp.fill(0);
    for (var s = 0; s < NCELL; s++) {
      if (!g.walk[s] || comp[s]) continue;
      var id = size.length, head = 0, tail = 0, n = 0;
      comp[s] = id; queue[tail++] = s;
      while (head < tail) {
        var i = queue[head++]; n++;
        for (var k = 0; k < 8; k++) { var j = stepOk(g, i, k, null); if (j >= 0 && !comp[j]) { comp[j] = id; queue[tail++] = j; } }
      }
      size.push(n);
      if (n > bestN) { bestN = n; best = id; }
    }
    g.compSize = size; g.largest = best;
  }

  /* ---------------- A* (octile, no corner cutting) ---------------- */
  var _gs = new Float64Array(NCELL), _fs = new Float64Array(NCELL), _from = new Int16Array(NCELL), _st = new Uint8Array(NCELL);
  var _heap = new Int16Array(NCELL * 8), _hn = 0;
  function octile(a, b) {
    var dx = Math.abs(colOf(a) - colOf(b)), dz = Math.abs(rowOf(a) - rowOf(b));
    return dx > dz ? dx - dz + SQRT2 * dz : dz - dx + SQRT2 * dx;
  }
  function hpush(i) {
    var k = _hn++; _heap[k] = i;
    while (k > 0) { var p = (k - 1) >> 1; if (_fs[_heap[p]] <= _fs[_heap[k]]) break; var t = _heap[p]; _heap[p] = _heap[k]; _heap[k] = t; k = p; }
  }
  function hpop() {
    var top = _heap[0]; _hn--;
    if (_hn > 0) {
      _heap[0] = _heap[_hn];
      var k = 0;
      for (;;) {
        var l = 2 * k + 1, r = l + 1, m = k;
        if (l < _hn && _fs[_heap[l]] < _fs[_heap[m]]) m = l;
        if (r < _hn && _fs[_heap[r]] < _fs[_heap[m]]) m = r;
        if (m === k) break;
        var t = _heap[m]; _heap[m] = _heap[k]; _heap[k] = t; k = m;
      }
    }
    return top;
  }
  /* → [cell, …] from → to inclusive, or null. `from` may be blocked (the pet stands there). */
  function astar(g, from, to, extra) {
    if (from < 0 || to < 0 || !g.walk[to] || (extra && extra[to] && to !== from)) return null;
    if (from === to) return [from];
    _gs.fill(Infinity); _st.fill(0); _from.fill(-1); _hn = 0;
    _gs[from] = 0; _fs[from] = octile(from, to); hpush(from); _st[from] = 1;
    while (_hn > 0) {
      var i = hpop();
      if (_st[i] === 2) continue;
      _st[i] = 2;
      if (i === to) break;
      for (var n = 0; n < 8; n++) {
        var j = stepOk(g, i, n, extra);
        if (j < 0 || _st[j] === 2) continue;
        var cost = _gs[i] + (n >= 4 ? SQRT2 : 1);
        if (cost < _gs[j] - 1e-9) { _gs[j] = cost; _from[j] = i; _fs[j] = cost + octile(j, to); hpush(j); _st[j] = 1; }
      }
    }
    if (_st[to] !== 2) return null;
    var out = [], k = to;
    while (k >= 0) { out.push(k); if (k === from) break; k = _from[k]; }
    if (out[out.length - 1] !== from) return null;
    return out.reverse();
  }
  /* Dijkstra distances (octile steps) from `from` → fills dist (Float64Array NCELL) and parent (Int16Array) */
  function distMap(g, from, extra, dist, parent) {
    dist = dist || new Float64Array(NCELL); parent = parent || new Int16Array(NCELL);
    dist.fill(Infinity); parent.fill(-1); _st.fill(0); _hn = 0;
    if (from < 0) return dist;
    dist[from] = 0; _fs[from] = 0; hpush(from);
    while (_hn > 0) {
      var i = hpop();
      if (_st[i]) continue;
      _st[i] = 1;
      for (var n = 0; n < 8; n++) {
        var j = stepOk(g, i, n, extra);
        if (j < 0 || _st[j]) continue;
        var d = dist[i] + (n >= 4 ? SQRT2 : 1);
        if (d < dist[j] - 1e-9) { dist[j] = d; parent[j] = i; _fs[j] = d; hpush(j); }
      }
    }
    return dist;
  }
  function chainTo(parent, from, to) {
    var out = [], k = to, guard = 0;
    while (k >= 0 && guard++ < NCELL) { out.push(k); if (k === from) return out.reverse(); k = parent[k]; }
    return null;
  }

  /* ---------------- smoothing ---------------- */
  function walkableAt(g, x, z, extra, allow) {
    var i = cellOf(x, z);
    return i >= 0 && (i === allow || (g.walk[i] && !(extra && extra[i])));
  }
  /* a fat line of sight: the centre line plus two parallel lines `clr` either side */
  function losClear(g, x0, z0, x1, z1, extra, clr, allow) {
    var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-6) return true;
    var nx = -dz / len, nz = dx / len, steps = Math.ceil(len / WALK.step);
    for (var s = 0; s <= steps; s++) {
      var u = s / steps, x = x0 + dx * u, z = z0 + dz * u, d = u * len;
      if (!walkableAt(g, x, z, extra, allow)) return false;
      if (d < WALK.startFree || len - d < 0.05) continue;       /* near the ends only the centre line counts */
      if (!walkableAt(g, x + nx * clr, z + nz * clr, extra, allow) || !walkableAt(g, x - nx * clr, z - nz * clr, extra, allow)) return false;
    }
    return true;
  }
  function crPoint(p0, p1, p2, p3, u) {
    var u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  function finishPath(xs, zs, cells, target) {
    var n = xs.length, pts = new Float64Array(n * 2), cum = new Float64Array(n), total = 0;
    for (var i = 0; i < n; i++) {
      pts[i * 2] = xs[i]; pts[i * 2 + 1] = zs[i];
      if (i) { var dx = xs[i] - xs[i - 1], dz = zs[i] - zs[i - 1]; total += Math.sqrt(dx * dx + dz * dz); }
      cum[i] = total;
    }
    return { pts: pts, cum: cum, n: n, total: total, cells: cells, target: target };
  }
  /* cells (A* output) → a smoothed, validated path from (x0, z0) */
  function smoothPath(g, cells, x0, z0, extra) {
    if (!cells || !cells.length) return null;
    var start = cells[0], last = cells[cells.length - 1];
    var wx = [x0], wz = [z0], i;
    for (i = 1; i < cells.length; i++) { wx.push(centreX(cells[i])); wz.push(centreZ(cells[i])); }
    if (cells.length === 1) { wx.push(centreX(last)); wz.push(centreZ(last)); }
    /* line-of-sight pruning (greedy farthest) */
    var px = [wx[0]], pz = [wz[0]], a = 0;
    while (a < wx.length - 1) {
      var b = wx.length - 1;
      while (b > a + 1 && !losClear(g, wx[a], wz[a], wx[b], wz[b], extra, WALK.clearance, start)) b--;
      px.push(wx[b]); pz.push(wz[b]); a = b;
    }
    /* re-densify every ≤ 1 u so the spline hugs the validated lines */
    var dx = [px[0]], dz = [pz[0]];
    for (i = 1; i < px.length; i++) {
      var ex = px[i] - px[i - 1], ez = pz[i] - pz[i - 1], L = Math.sqrt(ex * ex + ez * ez), m = Math.max(1, Math.ceil(L / 1));
      for (var k = 1; k <= m; k++) { dx.push(px[i - 1] + ex * k / m); dz.push(pz[i - 1] + ez * k / m); }
    }
    /* Catmull-Rom through the dense points */
    var sx = [dx[0]], sz = [dz[0]], n = dx.length;
    for (i = 0; i < n - 1; i++) {
      var i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
      for (var s = 1; s <= WALK.sub; s++) {
        var u = s / WALK.sub;
        sx.push(crPoint(dx[i0], dx[i], dx[i + 1], dx[i3], u));
        sz.push(crPoint(dz[i0], dz[i], dz[i + 1], dz[i3], u));
      }
    }
    var path = finishPath(sx, sz, cells, last);
    if (!pathValid(g, path, 0, extra, start)) path = finishPath(dx, dz, cells, last);
    if (!pathValid(g, path, 0, extra, start)) path = finishPath(wx, wz, cells, last);
    return path;
  }
  /* every point along the polyline (from arc length s0) is on a free cell (allow = the start cell) */
  function pathValid(g, path, s0, extra, allow) {
    if (!path) return false;
    var P = path.pts;
    for (var i = 1; i < path.n; i++) {
      if (path.cum[i] < (s0 || 0)) continue;
      var x0 = P[i * 2 - 2], z0 = P[i * 2 - 1], x1 = P[i * 2], z1 = P[i * 2 + 1];
      var ddx = x1 - x0, ddz = z1 - z0, steps = Math.max(1, Math.ceil(Math.sqrt(ddx * ddx + ddz * ddz) / WALK.step));
      for (var s = 0; s <= steps; s++) if (!walkableAt(g, x0 + ddx * s / steps, z0 + ddz * s / steps, extra, allow)) return false;
    }
    return true;
  }
  /* position (and the segment index hint) at arc length s → out {x, z, dx, dz, seg} */
  function samplePath(path, s, out, hint) {
    out = out || {};
    var P = path.pts, cum = path.cum, n = path.n;
    if (n < 2) { out.x = P[0]; out.z = P[1]; out.dx = 0; out.dz = 1; out.seg = 0; return out; }
    s = clamp(s, 0, path.total);
    var k = hint > 0 && hint < n ? hint : 1;
    if (cum[k - 1] > s) k = 1;
    while (k < n - 1 && cum[k] < s) k++;
    var seg = cum[k] - cum[k - 1], u = seg > 1e-9 ? (s - cum[k - 1]) / seg : 1;
    out.x = P[k * 2 - 2] + (P[k * 2] - P[k * 2 - 2]) * u;
    out.z = P[k * 2 - 1] + (P[k * 2 + 1] - P[k * 2 - 1]) * u;
    out.dx = P[k * 2] - P[k * 2 - 2]; out.dz = P[k * 2 + 1] - P[k * 2 - 1];
    out.seg = k;
    return out;
  }

  /* ground height under (x, z): the cell's surface, blended across a terrace edge with a little hop */
  var EDGE = 0.18;
  function yCell(g, c, r, base) { var i = cellIndex(c, r); return i >= 0 && g.land[i] ? g.y[i] : base; }
  function heightAt(g, x, z) {
    var fx = x + COLS / 2, fz = z + ROWS / 2, c = Math.floor(fx), r = Math.floor(fz);
    var i = cellIndex(c, r), base = i >= 0 && g.land[i] ? g.y[i] : 0, h = base;
    var ux = fx - c, uz = fz - r;
    if (ux < EDGE) h += edge(yCell(g, c - 1, r, base) - base, ux);
    else if (ux > 1 - EDGE) h += edge(yCell(g, c + 1, r, base) - base, 1 - ux);
    if (uz < EDGE) h += edge(yCell(g, c, r - 1, base) - base, uz);
    else if (uz > 1 - EDGE) h += edge(yCell(g, c, r + 1, base) - base, 1 - uz);
    return h;
  }
  function edge(d, u) {
    if (d === 0) return 0;
    var k = 1 - u / EDGE;
    return d * 0.5 * smooth01(k) + Math.abs(d) * 0.6 * (1 - (u / EDGE) * (u / EDGE));
  }

  /* nearest free cell to (x, z): prefer the largest component, unreserved by others */
  function nearestFree(g, x, z, res, self, wantComp) {
    var best = -1, bestD = Infinity;
    for (var pass = 0; pass < 2 && best < 0; pass++) {
      for (var i = 0; i < NCELL; i++) {
        if (!g.walk[i]) continue;
        if (pass === 0 && wantComp && g.comp[i] !== wantComp) continue;
        if (res && res[i] >= 0 && res[i] !== self) continue;
        var dx = centreX(i) - x, dz = centreZ(i) - z, d = dx * dx + dz * dz;
        if (d < bestD - 1e-9) { bestD = d; best = i; }
      }
    }
    return best;
  }

  /* ---------------- the trampoline bounce (mirrors SLMotion 'bounce') ---------------- */
  function bounceAt(t, lead, out) {
    out = out || {};
    out.matDip = 0; out.petY = 0; out.flip = 0; out.done = false;
    var s = t - clamp(lead || 0, 0, BOUNCE.maxLead);
    if (s >= BOUNCE.length) { out.done = true; return out; }
    for (var i = 0; i < 4 && s >= 0; i++) {
      if (s < BOUNCE.contact) { out.matDip = -BOUNCE.dip * Math.sin(PI * s / BOUNCE.contact); out.petY = out.matDip; break; }
      s -= BOUNCE.contact;
      if (i === 3) break;
      var f = BOUNCE.flights[i];
      if (s < f) {
        var v = Math.sqrt(2 * BOUNCE.g * BOUNCE.heights[i]);
        out.petY = v * s - BOUNCE.g * s * s / 2;
        if (i === 2) out.flip = s / f;
        break;
      }
      s -= f;
    }
    return out;
  }

  /* ---------------- dance ---------------- */
  /* the shared timeline: t = seconds since count 1 starts (negative while gathering) */
  function danceAt(t, reduced, out) {
    out = out || {};
    var dur = reduced ? DANCE.reducedDur : DANCE.dur;
    out.t = t; out.reduced = !!reduced;
    if (t < 0) { out.phase = 'wait'; out.count = 0; out.frac = 0; out.move = ''; return out; }
    if (reduced) {
      out.phase = t < dur ? 'dance' : 'done'; out.count = t < dur ? 8 : 0; out.frac = clamp01(t / dur); out.move = t < dur ? 'pose' : '';
      return out;
    }
    if (t >= dur + DANCE.hold) { out.phase = 'done'; out.count = 0; out.frac = 1; out.move = ''; return out; }
    if (t >= dur) { out.phase = 'hold'; out.count = 8; out.frac = 1; out.move = 'pose'; return out; }
    var b = t / DANCE.beat, c = Math.min(7, Math.floor(b));
    out.phase = 'dance'; out.count = c + 1; out.frac = b - c; out.move = DANCE.moves[c];
    return out;
  }
  /* the delay ≥ minDelay that lands count 1 on a bar line (or a beat when perBar is false) */
  function alignDelay(minDelay, beat, bpm, perBar) {
    minDelay = Math.max(0, +minDelay || 0);
    if (!(typeof beat === 'number' && isFinite(beat)) || !(bpm > 0)) return minDelay;
    var unit = perBar ? 4 : 1, sec = 60 / bpm, b = beat + minDelay / sec;
    var target = Math.ceil(b / unit - 1e-6) * unit;
    return minDelay + (target - b) * sec;
  }
  /* open cells in front of the house, closest first (n distinct cells, never the avatar's) */
  function danceSpots(g, n, res) {
    var ox = 0, oz = 0, row = -1;
    if (g.house) { ox = g.house.x; oz = g.house.z + 0.6; row = rowOf(Math.max(0, g.house.entrance)); }
    else if (g.avatar >= 0) { ox = g.avatarX + 0.5; oz = g.avatarZ + 0.6; }
    var list = [];
    for (var i = 0; i < NCELL; i++) {
      if (!g.walk[i]) continue;
      var dx = centreX(i) - ox, dz = centreZ(i) - oz, d = Math.sqrt(dx * dx + dz * dz);
      if (row >= 0 && rowOf(i) < row) d += 2;           /* in front of the house reads best */
      if (g.largest && g.comp[i] !== g.largest) d += 0.5;
      list.push({ i: i, d: d });
    }
    list.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
    return list.slice(0, n).map(function (e) { return e.i; });
  }

  /* the photo booth's pose timeline from the act start, given the pet's arrival (lead):
     → {starts: [s0, s1, s2], end}; pose k holds from starts[k] to the next start */
  function posesOf(lead, out) {
    out = out || { starts: [0, 0, 0], end: 0 };
    lead = Math.max(0, +lead || 0);
    for (var k = 0; k < 3; k++) out.starts[k] = Math.max(POSE_TICKS[k], lead + POSE_GAP * k);
    out.end = Math.max(out.starts[2], 1.5) + POSE_HOLD;
    return out;
  }

  /* ISLAND ACTIVITIES v1 (IA-3): the fetch ball at time t (island-local) from a fetch record f (pet.fetch): the
     child's hand h*, the first touch l*, the bounce m*, the rest r*, the drop d*; times t0 · land1 · mid · rest;
     arc / b1 / b2 the apex heights; held = in the pet's mouth (actors put it there), dropped = at the child's feet
     → out {x, y, z, phase 'hand' | 'fly' | 'bounce' | 'rest' | 'held' | 'drop'} | null */
  function lerpArc(ax, ay, az, bx, by, bz, h, u, out) {
    u = clamp01(u);
    out.x = ax + (bx - ax) * u; out.z = az + (bz - az) * u; out.y = ay + (by - ay) * u + 4 * h * u * (1 - u);
    return out;
  }
  function ballAt(f, t, out) {
    if (!f || !isFinite(f.t0)) return null;
    out = out || {};
    if (f.dropped) { out.x = f.dx; out.y = f.dy; out.z = f.dz; out.phase = 'drop'; return out; }
    if (f.held) { out.x = f.rx; out.y = f.ry; out.z = f.rz; out.phase = 'held'; return out; }
    if (t < f.t0) { out.x = f.hx; out.y = f.hy; out.z = f.hz; out.phase = 'hand'; return out; }
    if (t < f.land1) { lerpArc(f.hx, f.hy, f.hz, f.lx, f.ly, f.lz, f.arc, (t - f.t0) / Math.max(1e-6, f.land1 - f.t0), out); out.phase = 'fly'; return out; }
    if (t < f.mid) { lerpArc(f.lx, f.ly, f.lz, f.mx, f.my, f.mz, f.b1, (t - f.land1) / Math.max(1e-6, f.mid - f.land1), out); out.phase = 'bounce'; return out; }
    if (t < f.rest) { lerpArc(f.mx, f.my, f.mz, f.rx, f.ry, f.rz, f.b2, (t - f.mid) / Math.max(1e-6, f.rest - f.mid), out); out.phase = 'bounce'; return out; }
    out.x = f.rx; out.y = f.ry; out.z = f.rz; out.phase = 'rest';
    return out;
  }

  /* ---------------- the avatar's glance at a pet: every 5–7 s, 1.6 s long ---------------- */
  function glanceAt(t, seed, out) {
    out = out || {};
    var s = (typeof seed === 'number' ? seed : hash(seed == null ? '' : seed)) ^ 0x1b873593;
    var mean = (GLANCE.min + GLANCE.max) / 2, spread = (GLANCE.max - GLANCE.min) / 2;
    var n = Math.floor(t / mean) + 1;
    while (n > -2 && n * mean + (mix01(s, n) - 0.5) * spread > t) n--;
    var since = t - (n * mean + (mix01(s, n) - 0.5) * spread);
    out.n = n; out.since = since;
    out.k = since >= 0 && since < GLANCE.dur ? smooth01(since / GLANCE.ease) * (1 - smooth01((since - (GLANCE.dur - GLANCE.ease)) / GLANCE.ease)) : 0;
    out.pick = mix01(s ^ 0x7f4a7c15, n);
    return out;
  }

  /* ================================================================
     v3 PURE HELPERS: island frames, bridge decks, act windows
     ================================================================ */
  /* crossing (u/s, u, s); a hanging pet's root sits HANG.reach under its grip (unscaled: actors
     add CREW_SCALE); route legs (s, u) */
  var CROSS = { walk: 2.5, max: 6, hopDist: 4, hopAt: 0.45, step: 0.25, dockSide: 0.3, petSide: 0.12 };
  var HANG = { reach: 0.3, names: /^(grip|zipStart|r\d+|bar\d*)$/ };
  var LEG = { hop: 0.32, pop: 0.2, off: 0.36, reachH: 1.5, reachV: 1.0, climb: 0.9, maxLead: 1.0, minPart: 0.5, walk: 1.6, ground: 0.15 };
  var V3_KINDS = ['ride', 'wheel', 'slide', 'wobble', 'skate', 'lift', 'zip', 'paddle', 'bounce', 'vine', 'maypole', 'feast', 'cross', 'pose', 'bench'];
  var V3_CLIPS = { ride: 'ride', wheel: 'sit', vine: 'ride', feast: 'sit', bench: 'sit', pose: 'pose', wobble: 'wobble', skate: 'skate', paddle: 'paddle', maypole: 'walk', cross: 'run', slide: 'slide', lift: 'sit', zip: 'hang' };
  /* the island-local frame: world = local + {ox, oy, oz}; cell (c, r) is centred on (c − 7.5, ·, r − 4.5) */
  function frameOf(isle, Gx) {
    var G = grid(Gx), F = isle && isle !== 'home' && G && G.V3 && typeof G.V3.frame === 'function' ? G.V3.frame(isle) : null;
    return F ? { isle: isle, ox: F.offset[0] + COLS / 2, oy: F.top, oz: F.offset[1] + ROWS / 2 } : { isle: 'home', ox: 0, oy: 0, oz: 0 };
  }
  /* a land's bridge, Home gate pad → dock edge: world [x, y, z, …] every ≤ 0.25 u on the deck tops of
     SLIsles3D.bridge(isle) (its sags, arches and steps), else on the straight run */
  var DECKS = {};
  function deckOf(isle, Gx) {
    if (DECKS[isle]) return DECKS[isle];
    var G = grid(Gx), B = G && G.V3 && typeof G.V3.bridge === 'function' ? G.V3.bridge(isle) : null;
    if (!B) return null;
    var I = sib('SLIsles3D', './isles3d.js'), tops = {}, xs = [], lift = 0.02, i;
    try {
      var br = I && typeof I.bridge === 'function' ? I.bridge(isle) : null;
      if (br) {
        lift = +br.lift || 0;
        br.segments.forEach(function (s) { s.voxels.forEach(function (v) {
          if (Math.abs(v[2]) > 1e-6 || Math.abs(v[5] - br.width) > 1e-6) return;     /* the deck runs the full width on the centre line */
          var k = Math.round(v[0] * 1000) / 1000, top = v[1] + v[4] / 2;
          if (!(k in tops)) xs.push(k);
          tops[k] = k in tops ? Math.max(tops[k], top) : top;
        }); });
      }
    } catch (e) { xs = []; }
    xs.sort(function (a, b) { return a - b; });
    function yAt(s) {
      if (!xs.length) return B.rise * s / B.length;
      if (s <= xs[0]) return tops[xs[0]] * s / Math.max(1e-6, xs[0]);
      for (var k = 1; k < xs.length; k++) if (s <= xs[k]) return tops[xs[k - 1]] + (tops[xs[k]] - tops[xs[k - 1]]) * (s - xs[k - 1]) / (xs[k] - xs[k - 1]);
      return B.rise;
    }
    var ux = (B.b.x - B.a.x) / B.length, uz = (B.b.z - B.a.z) / B.length, n = Math.max(1, Math.ceil(B.length / CROSS.step)), pts = [];
    for (i = 0; i <= n; i++) { var s = B.length * i / n; pts.push(B.a.x + ux * s, B.a.y + (i ? lift + yAt(s) : 0), B.a.z + uz * s); }
    pts[pts.length - 2] = B.b.y;
    return (DECKS[isle] = pts);
  }
  /* SLMotion act windows: the first t ≥ from at which test(channel) holds (sampled every 0.02 s) */
  var WHEN = {};
  function whenOf(act, ch, above, v0, from) {
    var key = act + '.' + ch + (above ? '>' : '<') + v0 + '@' + (from || 0);
    if (key in WHEN) return WHEN[key];
    var M = motion(), out = -1;
    if (M && M.ACTS && M.ACTS[act]) {
      var T = M.durOf(act, {}), s = {};
      for (var t = from || 0; t <= T + 1e-9; t += 0.02) {
        M.sample(act, t, s, {});
        var v = +s[ch] || 0;
        if (above ? v >= v0 : v <= v0) { out = t; break; }
      }
    }
    return (WHEN[key] = out);
  }
  /* [a, b]: channel ch of act leaves 0 at a and reaches 1 at b (null: no such ramp) */
  function rampOf(act, ch) {
    var a = whenOf(act, ch, true, 0.003), b = a < 0 ? -1 : whenOf(act, ch, true, 0.997, a);
    return a < 0 ? null : [Math.max(0, a - 0.02), b < 0 ? actDur(act) : b];
  }
  function actDur(act) { var M = motion(); return M && M.ACTS && M.ACTS[act] ? M.durOf(act, {}) : 3; }
  function actOf(id) {
    var L = lookOf(id), M = motion(), a = L && L.act;
    var name = a && M && typeof M.actFor === 'function' ? M.actFor(a, id) : a;
    return name && M && M.ACTS && M.ACTS[name] ? name : null;
  }
  function lookOf(id) { var L = look(); return L && L.LOOK ? L.LOOK[id] || null : null; }
  /* a 3D polyline [x, y, z, …] → its cumulative lengths */
  function cumOf(pts) {
    var n = pts.length / 3, cum = new Float64Array(n), t = 0;
    for (var i = 1; i < n; i++) {
      var dx = pts[i * 3] - pts[i * 3 - 3], dy = pts[i * 3 + 1] - pts[i * 3 - 2], dz = pts[i * 3 + 2] - pts[i * 3 - 1];
      t += Math.sqrt(dx * dx + dy * dy + dz * dz); cum[i] = t;
    }
    return cum;
  }

  /* ================================================================
     THE BRAIN
     ================================================================ */
  /* pet state (read by actors.js):
       id species index active · x y z (world; y = ground incl. hops) · yaw (rad, 0 faces +z) ·
       speed (u/s) cruise (the gait's nominal speed) omega (turn rate, rad/s) ·
       state 'idle'|'walk'|'act'|'perform'|'dance'|'sit' · action (act name / goal) ·
       actT0 actDur · lookX lookZ lookK (head look target) · faceCam 0..1 ·
       tapT happyUntil · onSeat ('' | 'trampoline' | 'bench' | 'sip' | 'roof' | 'stage') ·
       flip 0..1 bounce (y above the seat) · hop 0..1 (hop-on/off progress) ·
       perfPhase ('run' | 'hopOn' | 'bounce' | 'sit' | 'pose' | 'hopOff' | '') · perfPose (photo booth
       pose 0..2, -1 between) · perf.hopDur (the running hop's length) · danceSpot (cell) ·
       danceMark ({x, y, z} on the stage deck, else null) · danceApproach (its cell) · cell res */
  function newPet(id, index) {
    return {
      id: id, species: id, index: index, active: false,
      x: 0, y: 0, z: 0, yaw: 0, speed: 0, cruise: WALK.speed, omega: 0,
      cell: -1, res: -1,
      state: 'idle', action: '', actT0: 0, actDur: 0, actEnd: 0, nextAt: 0, gap: 0, lastStart: -1, starts: 0,
      path: null, pathS: 0, seg: 1, goal: null, waitT: 0, pauseUntil: -1, turnTo: null,
      lookX: 0, lookZ: 0, lookK: 0, faceCam: 0, desiredYaw: 0, hasDesired: false,
      tapT: -99, happyUntil: -99,
      onSeat: '', flip: 0, bounce: 0, hop: 0, perfPhase: '', perfPose: -1,
      danceSpot: -1, danceMark: null, danceApproach: -1, gatherT0: 0, gatherDur: 1,
      perf: { kind: '', uid: '', t0: 0, lead: 0, runT0: 0, runDur: 0, sitUntil: 0, hopT0: 0, approach: -1, fromIdle: false,
              ax: 0, ay: 0, az: 0, sx: 0, sy: 0, sz: 0, lx: 0, ly: 0, lz: 0, land: -1, face: 0, path: null,
              hopDur: HOP.on, hopH: HOP.h, obx: 0, obz: 0, poses: { starts: [0, 0, 0], end: 0 }, route: null },
      /* v3: the route leg being played (actors pose perfClip; legMode 'hop' | 'go' | 'ride' | 'stand' |
         'pop', legU 0..1, hang 1 = under a grip), the crossing (state 'travel') */
      perfClip: '', legMode: '', legU: 0, hang: 0, trav: null,
      /* the land mascots (W3b.12): a visited land's own mascot hosted by its island (D112), the tap
         reaction ('hop' | 'rear' | 'clap'), the yaw a play move's body turn starts from */
      guest: false, tapKind: 'hop', turnFrom: 0,
      /* the kids update (P2.5): the mood from the view (null = none: V4.54 behaviour) and its walk factor,
         when the next signature may play, the give-way re-plans in a row, the feeding ({on, t0, bowl x y z,
         yaw, the hop's ends, eat0, end, reduced}; null until the first meal) */
      mood: null, moodK: 1, sigAt: 0, stuck: 0, feed: null,
      /* island activities v1 (IA-3): the fetch ({on, phase, kind, the ball's points and times, held, dropped, n…};
         null until the first throw) and the hide ({on, uid, cell, …}; null until the first round) */
      fetch: null, hide: null,
      mark: { x: 0, y: 0, z: 0 },                    /* the stage deck mark (danceMark points here) */
      px: 0, pz: 0, qx: 0, qz: 0                       /* pounce start / end */
    };
  }

  function create(opts) {
    opts = opts || {};
    var Cx = opts.C || null, Gx = opts.G || null;
    var seed = typeof opts.seed === 'number' ? opts.seed >>> 0 : hash(opts.seed == null ? 'island-pets' : opts.seed);
    var rng = makeRng(seed);
    var brain = {
      version: VERSION, seed: seed, now: 0, pets: [], graph: null, mode: 'play', reduced: !!opts.reduced,
      show: 0, music: false, camYaw: 0, events: [], danceOn: false, danceT0: 0, danceEnd: 0, danceReduced: false,
      danceKind: '', danceUid: '', synced: false,
      /* island activities v1 (IA-3): the visitor standing on this island (setVisitor), never one of the pets */
      visitor: null,
      /* where the avatar dances when it joins a studio / stage dance (actors.js moves it there) */
      avatarMark: { on: false, kind: '', uid: '', x: 0, y: 0, z: 0, cell: -1 }
    };
    var res = new Int16Array(NCELL).fill(-1);
    var extra = new Uint8Array(NCELL);              /* scratch: other pets' cells while planning */
    var dist = new Float64Array(NCELL), parent = new Int16Array(NCELL);
    var _sp = { x: 0, z: 0, dx: 0, dz: 1, seg: 1 }, _b = { matDip: 0, petY: 0, flip: 0, done: false }, _an = { x: 0, y: 0, z: 0 };
    var byId = {};
    var anchorFn = typeof opts.anchorFn === 'function' ? opts.anchorFn : null;
    var danceOb = { x: 0, z: 0 };                    /* where the performed-on building stood when its dance began */
    /* v3: the island this brain lives on, its frame, its ground heights; pets hosted by another brain */
    var Cc0 = core(Cx), isleDef = opts.isle && opts.isle !== 'home' && Cc0 && Cc0.ISLES ? Cc0.ISLES[opts.isle] : null;
    brain.isle = isleDef ? opts.isle : 'home';
    brain.frame = frameOf(brain.isle, Gx);
    var G3 = grid(Gx), heights = isleDef ? function () { return 0; } :
      opts.v3 && G3 && G3.V3 && typeof G3.V3.surfaceY === 'function' ? function (c, r) { return G3.V3.surfaceY(c, r); } : null;
    var away = {};

    function pick(list) { return list[Math.floor(rng() * list.length) % list.length]; }
    function range(r) { return r[0] + (r[1] - r[0]) * rng(); }
    function g() { return brain.graph; }
    /* a pet's own walking speed: its species' pace × its mood (a V4.54 pet with no mood: WALK.speed) */
    function walkSpeed(p) { return speedOf(p.species) * p.moodK; }

    /* ---------- reservations: at most one cell per pet, never shared ---------- */
    function reserve(p, i) {
      if (p.res >= 0 && res[p.res] === p.index) res[p.res] = -1;
      if (i >= 0 && res[i] >= 0 && res[i] !== p.index) i = -1;     /* never steal another pet's spot */
      p.res = i;
      if (i >= 0) res[i] = p.index;
    }
    function freeFor(p, i) { return i >= 0 && g().walk[i] && (res[i] < 0 || res[i] === p.index); }
    function wantedCell(p) {
      if (p.state === 'travel') return p.trav.cell;
      if (p.state === 'fetch' && p.fetch) return p.fetch.phase === 'carry' || p.fetch.phase === 'drop' ? p.fetch.back : p.fetch.phase === 'wait' ? p.fetch.wait : p.fetch.cell;
      if (p.state === 'hide' && p.hide) return p.hide.cell;
      if (p.state === 'walk' && p.path) return p.path.target;
      if (p.state === 'perform') return p.perf.land >= 0 ? p.perf.land : p.perf.approach;
      if (p.state === 'dance' && p.danceSpot >= 0) return p.danceSpot;
      if (p.state === 'dance' && p.danceApproach >= 0) return p.danceApproach;
      return cellOf(p.x, p.z);
    }
    function rebuildReservations() {
      res.fill(-1);
      var am = brain.avatarMark;
      if (am.on && am.cell >= 0) { if (g().walk[am.cell]) res[am.cell] = AVATAR_RES; else am.cell = -1; }
      holdVisitor();
      brain.pets.forEach(function (p) {
        var want = wantedCell(p);
        if (want >= 0 && res[want] < 0 && g().walk[want]) { res[want] = p.index; p.res = want; }
        else p.res = -1;
      });
    }
    /* other pets' standing cells (and the avatar's dance spot), as extra blockers for planning */
    function blockOthers(p, also) {
      extra.fill(0);
      brain.pets.forEach(function (q) {
        if (q === p) return;
        var qc = cellOf(q.x, q.z), moving = q.state === 'walk' || q.state === 'travel';
        if (qc >= 0 && !moving && q.onSeat === '' && q.perfPhase !== 'leg') extra[qc] = 1;
        if (q.res >= 0 && !moving) extra[q.res] = 1;
      });
      var am = brain.avatarMark, vs = brain.visitor;
      if (am.on && am.cell >= 0) extra[am.cell] = 1;
      if (vs && vs.cell >= 0) extra[vs.cell] = 1;          /* the visitor's cell (IA-3) */
      if (also >= 0) extra[also] = 1;
      var me = cellOf(p.x, p.z);
      if (me >= 0) extra[me] = 0;
      return extra;
    }

    /* ---------- positioning ---------- */
    function place(p, i) {
      p.x = centreX(i); p.z = centreZ(i); p.cell = i;
      p.y = heightAt(g(), p.x, p.z);
    }
    function popTo(p, i, type) {
      var x0 = p.x, y0 = p.y, z0 = p.z;
      clearMotion(p);
      place(p, i);
      reserve(p, i);
      p.state = 'idle';
      brain.events.push({ type: type || 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
    }
    function clearMotion(p) {
      /* a fetch or a hide that something else stops ends here (IA-3): the ball drops where the pet is */
      if (p.fetch && p.fetch.on && !p.fetch.keep) cutFetch(p);
      if (p.hide && p.hide.on) p.hide.on = false;
      p.path = null; p.pathS = 0; p.seg = 1; p.goal = null; p.speed = 0; p.waitT = 0;
      p.onSeat = ''; p.flip = 0; p.bounce = 0; p.hop = 0; p.perfPhase = ''; p.perfPose = -1; p.perf.kind = ''; p.perf.path = null;
      p.perf.route = null; p.perfClip = ''; p.legMode = ''; p.hang = 0; p.trav = null;
      p.danceMark = null; p.danceApproach = -1;
      p.lookK = 0; p.faceCam = 0; p.hasDesired = false;
    }
    function toIdle(p, nextIn) {
      var keepCell = cellOf(p.x, p.z);
      clearMotion(p);
      p.state = 'idle'; p.action = '';
      p.cell = keepCell;
      reserve(p, freeFor(p, keepCell) ? keepCell : -1);
      if (nextIn != null) p.nextAt = brain.now + nextIn;
    }

    /* ---------- walking ---------- */
    function startPath(p, path, goal, cruise) {
      p.path = path; p.pathS = 0; p.seg = 1; p.goal = goal || null; p.waitT = 0; p.stuck = 0;
      p.cruise = cruise || WALK.speed;
      p.state = 'walk';
      reserve(p, path.target);
    }
    function planTo(p, target, blockExtra) {
      var from = cellOf(p.x, p.z);
      if (from < 0 || target < 0) return null;
      var ex = blockOthers(p, blockExtra == null ? -1 : blockExtra);
      var cells = astar(g(), from, target, ex), vb = visitorBlock(from);
      if (!cells && vb) cells = astar(g(), from, target, vb);       /* pets may squeeze past each other, never the visitor (IA-3)… */
      if (!cells) { cells = astar(g(), from, target, null); vb = null; }   /* …unless it stands in the only way */
      return cells ? smoothPath(g(), cells, p.x, p.z, vb) : null;   /* nor does the smoothed line cut across its cell */
    }
    /* the visitor's cell alone as a blocker (IA-3), or null: no visitor, or the walk starts there */
    var vbx = new Uint8Array(NCELL);
    function visitorBlock(from) {
      var vs = brain.visitor;
      if (!vs || vs.cell < 0 || vs.cell === from) return null;
      vbx.fill(0); vbx[vs.cell] = 1;
      return vbx;
    }
    /* a walk's smoothed line, kept off the visitor's cell whenever its cells go round it (IA-3) */
    function smoothRound(gr, cells, x0, z0) {
      var vs = brain.visitor, vb = cells && cells.length && vs && vs.cell >= 0 && cells.indexOf(vs.cell) < 0 ? visitorBlock(cells[0]) : null;
      return smoothPath(gr, cells, x0, z0, vb);
    }
    function turnToward(p, yaw, rate, dt) {
      var d = wrap(yaw - p.yaw), m = rate * dt;
      var step = d > m ? m : d < -m ? -m : d;
      p.yaw = wrap(p.yaw + step);
      p.omega = dt > 0 ? step / dt : 0;
      return Math.abs(d - step);
    }
    function blockedAhead(p, dirX, dirZ) {
      for (var k = 0; k < brain.pets.length; k++) {
        var q = brain.pets[k];
        if (q === p || q.onSeat || q.perfPhase === 'leg') continue;
        var dx = q.x - p.x, dz = q.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 > WALK.near * WALK.near || d2 < 1e-10) continue;
        if (dx * dirX + dz * dirZ > 0.05 * Math.sqrt(d2)) return q;
      }
      return null;
    }
    function follow(p, dt, cruise, accel) {
      var path = p.path;
      if (!path) { toIdle(p, null); return; }
      samplePath(path, Math.min(path.total, p.pathS + WALK.look), _sp, p.seg);
      var hx = _sp.x - p.x, hz = _sp.z - p.z;
      if (hx * hx + hz * hz < 1e-8) { hx = _sp.dx; hz = _sp.dz; }
      var want = Math.atan2(hx, hz), off = turnToward(p, want, WALK.turn * (cruise > WALK.speed * 1.5 ? 2 : 1), dt);
      var target = cruise * clamp01((Math.cos(off) - 0.3) / 0.7);
      var q = blockedAhead(p, Math.sin(p.yaw), Math.cos(p.yaw));
      if (q && cruise <= WALK.speed * 1.5) {
        target = 0; p.waitT += dt;
        if (p.waitT > WALK.wait) {                     /* give way: re-plan around the pet in front */
          p.waitT = 0;
          /* pets that block each other would re-plan for ever: after GIVE_WAY re-plans in a row that got
             nowhere the pet gives way (steps back, or pops clear) */
          p.stuck = p.pathS < WALK.step ? p.stuck + 1 : 0;
          if (p.stuck >= GIVE_WAY) { giveWay(p, q); return; }
          var np = planTo(p, path.target, cellOf(q.x, q.z));
          if (np && np.total > 0.05) { p.path = path = np; p.pathS = 0; p.seg = 1; }
          else { arrive(p, true); return; }
        }
      } else p.waitT = 0;
      var dv = target - p.speed, a = accel * dt;
      p.speed += dv > a ? a : dv < -a ? -a : dv;
      p.pathS = Math.min(path.total, p.pathS + p.speed * dt);
      samplePath(path, p.pathS, _sp, p.seg);
      p.seg = _sp.seg; p.x = _sp.x; p.z = _sp.z;
      p.cell = cellOf(p.x, p.z);
      p.y = heightAt(g(), p.x, p.z);
      if (p.pathS >= path.total - 1e-6) arrive(p, false);
    }
    /* stuck nose to nose with q (GIVE_WAY re-plans that got nowhere): step back to the free square round
       it farthest from q (a short straight walk to its centre; the old goal is dropped) and idle there, so
       settled pets keep their distance. No such square, or stuck again on the way back: a sparkle pop to
       the nearest free square clear of every pet (the 'pop' sync already uses) */
    var RETREAT = { type: 'retreat' };
    function clearOfPets(p, i) {
      for (var k = 0; k < brain.pets.length; k++) { var o = brain.pets[k]; if (o !== p && Math.hypot(centreX(i) - o.x, centreZ(i) - o.z) < 0.75) return false; }
      return true;
    }
    function giveWay(p, q) {
      var gr = g(), c0 = cellOf(p.x, p.z), c = colOf(c0), r = rowOf(c0), best = -1, bd = -1;
      p.stuck = 0;
      if (p.goal !== RETREAT) for (var n = -1; n < 8; n++) {
        var i = n < 0 ? c0 : cellIndex(c + NB_DC[n], r + NB_DR[n]), d = i < 0 ? 0 : Math.hypot(centreX(i) - q.x, centreZ(i) - q.z);
        if (i >= 0 && d > bd && freeFor(p, i) && clearOfPets(p, i) && losClear(gr, p.x, p.z, centreX(i), centreZ(i), null, 0, -1)) { bd = d; best = i; }
      }
      if (best >= 0) { startPath(p, finishPath([p.x, centreX(best)], [p.z, centreZ(best)], [c0, best], best), RETREAT, p.cruise); return; }
      var far = -1, fd = Infinity;
      for (var j = 0; j < NCELL; j++) {
        var dj = Math.hypot(centreX(j) - p.x, centreZ(j) - p.z);
        if (dj < fd && freeFor(p, j) && clearOfPets(p, j) && (!gr.largest || gr.comp[j] === gr.comp[c0])) { fd = dj; far = j; }
      }
      if (far >= 0) popTo(p, far); else arrive(p, true);
    }
    function arrive(p, gaveUp) {
      var goal = p.goal;
      p.path = null; p.goal = null; p.speed = 0;
      p.cell = cellOf(p.x, p.z);
      if (p.state === 'dance') { reserve(p, p.cell); return; }
      p.state = 'idle';
      reserve(p, freeFor(p, p.cell) ? p.cell : -1);
      if (gaveUp || !goal) return;
      if (goal.type === 'act') {
        var room = p.nextAt - IDLE.slack * 0.5 - brain.now;
        var dur = Math.min(goal.dur, room);
        if (dur >= 0.8) startAct(p, goal.name, dur, goal);
      } else if (goal.type === 'bench') {
        var ob = g().objects[goal.uid];
        if (ob && ob.id === 'bench' && !benchTaken(ob.uid, p)) startSeat(p, ob, 'bench', p.nextAt - IDLE.slack - brain.now - HOP.benchOn - HOP.off);
      }
    }

    /* ---------- in-place actions ---------- */
    function startAct(p, name, dur, goal) {
      p.state = 'act'; p.action = name; p.actT0 = brain.now; p.actDur = dur; p.actEnd = brain.now + dur;
      p.lookK = 0; p.faceCam = 0; p.hasDesired = false;
      p.side = rng() < 0.5 ? 1 : -1;                  /* which hip / shoulder a lean or a look-back favours */
      var tx = null, tz = null;
      if (goal && goal.fx != null) { tx = goal.fx; tz = goal.fz; }
      else if (name === 'lookAvatar' && g().avatar >= 0) { tx = g().avatarX; tz = g().avatarZ; }
      else if (name === 'follow') {                   /* the duckling turns to the avatar, else to the runner */
        var lead = g().avatar >= 0 ? null : byId[brain.activeId()];
        if (g().avatar >= 0) { tx = g().avatarX; tz = g().avatarZ; }
        else if (lead && lead !== p) { tx = lead.x; tz = lead.z; }
      }
      p.turnFrom = p.yaw;
      if (tx != null) { p.desiredYaw = Math.atan2(tx - p.x, tz - p.z); p.hasDesired = true; p.lookX = tx; p.lookZ = tz; p.lookK = 1; }
      if (name === 'look' || name === 'signature') { p.desiredYaw = brain.camYaw; p.hasDesired = true; p.faceCam = name === 'look' ? 1 : 0; }
      if (name === 'turn') { p.desiredYaw = wrap(p.yaw + (rng() < 0.5 ? -1 : 1) * (0.8 + rng() * 1.6)); p.hasDesired = true; }
      if (name === 'emote') { p.desiredYaw = brain.camYaw; p.hasDesired = true; p.faceCam = 1; brain.events.push({ type: 'emote', id: p.id, kind: pick(EMOTES) }); }
      if (name === 'pounce') {
        p.px = p.x; p.pz = p.z;
        p.qx = p.x + Math.sin(p.yaw) * POUNCE_DIST; p.qz = p.z + Math.cos(p.yaw) * POUNCE_DIST;
      }
    }
    function actStep(p, dt) {
      if (p.action === 'eatWait' || p.action === 'eat') { feedStep(p, dt); return; }
      var mv = PLAY_MOVES[p.action], tw = mv && mv.turn;
      if (tw) {                                       /* a play move's eased body turn, in place */
        var tu = clamp01(((brain.now - p.actT0) / Math.max(0.1, p.actDur) - tw[1]) / (tw[2] - tw[1]));
        var ny = wrap(p.turnFrom + tw[0] * (tu * tu * (3 - 2 * tu)));
        p.omega = dt > 0 ? wrap(ny - p.yaw) / dt : 0;
        p.yaw = ny;
      } else if (p.hasDesired) turnToward(p, p.desiredYaw, WALK.turn, dt); else p.omega = 0;
      if (p.action === 'pounce') {
        var u = clamp01((brain.now - p.actT0 - 0.35) / 0.35), k = smooth01(u);
        p.x = p.px + (p.qx - p.px) * k; p.z = p.pz + (p.qz - p.pz) * k;
        p.y = heightAt(g(), p.x, p.z);
      }
      if (brain.now >= p.actEnd) {
        if (p.action === 'pounce') p.cell = cellOf(p.x, p.z);
        p.action = ''; p.state = 'idle'; p.lookK = 0; p.faceCam = 0; p.hasDesired = false;
        reserve(p, freeFor(p, p.cell) ? p.cell : p.res);
      }
    }

    /* ---------- choosing what to do next (every 4–8 s, start to start) ---------- */
    function weightsFor(p) {
      var w = {}, k, sp = weightsOf(p.species);
      if (brain.reduced) { for (k in REDUCED_W) w[k] = REDUCED_W[k]; moodWeights(p.mood, w, true); if (g().avatar < 0) w.lookAvatar = 0; return w; }
      for (k in WEIGHTS) w[k] = WEIGHTS[k] * (sp[k] != null ? sp[k] : 1);
      if (g().avatar < 0) w.lookAvatar = 0;
      if (!brain.music) w.beatNod = 0;                /* nodding needs a beat to nod to */
      if (brain.show > 0.5) w.bench *= 4;
      if (g().city > 0) w.visit *= 1.5;               /* the crew likes hanging round the city buildings */
      return moodWeights(p.mood, w, false);
    }
    function decide(p) {
      var G = IDLE.min + (IDLE.max - IDLE.min) * rng();
      p.gap = G; p.lastStart = brain.now; p.nextAt = brain.now + G; p.starts++;
      var budget = G - IDLE.slack, w = weightsFor(p), names = Object.keys(w), tries = 0, m = p.mood;
      if (m && m.happy >= 4 && m.hunger < 2 && !brain.reduced && brain.now >= p.sigAt) {
        p.sigAt = brain.now + MOOD.sigEvery[0] + (MOOD.sigEvery[1] - MOOD.sigEvery[0]) * rng();
        if (tryAction(p, 'signature', budget)) return 'signature';
      }
      while (tries++ < 8) {
        var total = 0, i;
        for (i = 0; i < names.length; i++) total += w[names[i]];
        if (total <= 0) break;
        var r = rng() * total, name = names[names.length - 1];
        for (i = 0; i < names.length; i++) { r -= w[names[i]]; if (r <= 0) { name = names[i]; break; } }
        if (tryAction(p, name, budget)) return name;
        w[name] = 0;
      }
      return '';
    }
    function tryAction(p, name, budget) {
      if (name === 'wander') return tryWander(p, budget);
      if (name === 'visit') return tryVisit(p, budget);
      if (name === 'bench') return tryBench(p, budget);
      var kind = name === 'play' ? playOf(p.species) : name;
      var spec = ACTIONS[kind];
      if (!spec) return false;
      if (PLAY_MOVES[kind] && budget < PLAY_MOVES[kind].sec) return false;     /* a play move plays whole */
      var dur = kind === 'nap' ? Math.min(spec.dur[1], budget - 0.2) : Math.min(range(spec.dur), budget);
      if (dur < Math.min(spec.dur[0], 1)) return false;
      if (kind === 'pounce') {
        var qx = p.x + Math.sin(p.yaw) * POUNCE_DIST, qz = p.z + Math.cos(p.yaw) * POUNCE_DIST, qc = cellOf(qx, qz);
        if (!losClear(g(), p.x, p.z, qx, qz, null, 0, -1) || !(qc === p.cell || (freeFor(p, qc) && res[qc] < 0))) return false;
      }
      startAct(p, kind, dur, null);
      return true;
    }
    function reachMap(p) {
      var from = cellOf(p.x, p.z);
      if (from < 0) return -1;
      distMap(g(), from, blockOthers(p, -1), dist, parent);
      return from;
    }
    function tryWander(p, budget) {
      var from = reachMap(p);
      if (from < 0) return false;
      var sp = walkSpeed(p), maxD = (budget - IDLE.turnPad) * sp, cand = [];
      for (var i = 0; i < NCELL; i++) {
        if (i === from || !isFinite(dist[i]) || dist[i] < 1 || dist[i] * 1.06 > maxD) continue;
        if (res[i] >= 0 && res[i] !== p.index) continue;
        cand.push(i);
      }
      while (cand.length) {
        var k = Math.floor(rng() * cand.length), t = cand[k];
        cand[k] = cand[cand.length - 1]; cand.pop();
        var cells = chainTo(parent, from, t), path = cells && smoothRound(g(), cells, p.x, p.z);
        if (path && path.total / sp + IDLE.turnPad <= budget && pathValid(g(), path, 0, null, from)) { startPath(p, path, null, sp); return true; }
      }
      return false;
    }
    function tryVisit(p, budget) {
      var from = reachMap(p);
      if (from < 0) return false;
      var opts2 = [], sp = walkSpeed(p);
      g().items.forEach(function (ob) {
        var city = CITY_IDS.test(ob.id);
        var kind = SNIFF_IDS.test(ob.id) ? 'sniff' : WATCH_IDS[ob.id] || city ? 'look' : '';
        if (!kind || ob.id === 'bench') return;
        ob.adj.forEach(function (a) {
          if (!isFinite(dist[a]) || (res[a] >= 0 && res[a] !== p.index)) return;
          var walkT = dist[a] * 1.06 / sp + IDLE.turnPad;
          if (walkT + 1.4 > budget) return;
          var o = { a: a, ob: ob, kind: kind, walkT: walkT };
          opts2.push(o);
          if (city) opts2.push(o);                   /* the city buildings draw the crew twice as often */
        });
      });
      while (opts2.length) {
        var k = Math.floor(rng() * opts2.length), o = opts2[k];
        opts2[k] = opts2[opts2.length - 1]; opts2.pop();
        var cells = o.a === from ? [from] : chainTo(parent, from, o.a);
        var path = cells && smoothRound(g(), cells, p.x, p.z);
        if (!path) continue;
        var goal = { type: 'act', name: o.kind, dur: Math.min(2.4, budget - path.total / sp - IDLE.turnPad), fx: o.ob.x, fz: o.ob.z };
        if (goal.dur < 1) continue;
        if (path.total < 0.05) { startAct(p, o.kind, goal.dur, goal); return true; }
        startPath(p, path, goal, sp);
        return true;
      }
      return false;
    }
    function tryBench(p, budget) {
      var from = reachMap(p);
      if (from < 0) return false;
      var best = null, sp = walkSpeed(p);
      g().items.forEach(function (ob) {
        if (ob.id !== 'bench') return;
        if (benchTaken(ob.uid, p)) return;
        ob.adj.forEach(function (a) {
          if (!isFinite(dist[a]) || (res[a] >= 0 && res[a] !== p.index)) return;
          var t = dist[a] * 1.06 / sp + IDLE.turnPad + HOP.benchOn + 2 + HOP.off;
          var front = rowOf(a) === ob.r + 1 ? 0 : 0.3;     /* hop up from the front when possible */
          if (t <= budget && (!best || t + front < best.t)) best = { a: a, ob: ob, t: t + front };
        });
      });
      if (!best) return false;
      var cells = best.a === from ? [from] : chainTo(parent, from, best.a), path = cells && smoothRound(g(), cells, p.x, p.z);
      if (!path) return false;
      if (path.total < 0.05) { startSeat(p, best.ob, 'bench', p.nextAt - IDLE.slack - brain.now - HOP.benchOn - HOP.off); return true; }
      startPath(p, path, { type: 'bench', uid: best.ob.uid }, sp);
      return true;
    }
    function benchTaken(uid, self) {
      for (var k = 0; k < brain.pets.length; k++) {
        var q = brain.pets[k];
        if (q !== self && q.state === 'perform' && q.perf.uid === uid) return true;
        if (q !== self && q.goal && q.goal.uid === uid) return true;
      }
      return false;
    }

    /* ---------- seats: the trampoline, the bench, the café stool, the roof deck ---------- */
    function seatOf(ob, kind) {
      var s = SEAT[kind];
      return { x: ob.x, y: ob.y + s.y, z: ob.z + s.z };
    }
    /* sit on a bench (an idle visit) from where the pet stands now — an adjacent cell */
    function startSeat(p, ob, kind, sitDur) {
      var pf = p.perf, s = seatOf(ob, kind);
      pf.kind = kind; pf.uid = ob.uid; pf.t0 = brain.now; pf.lead = HOP.benchOn; pf.runT0 = brain.now; pf.runDur = 0;
      pf.ax = p.x; pf.ay = p.y; pf.az = p.z; pf.sx = s.x; pf.sy = s.y; pf.sz = s.z; pf.obx = ob.x; pf.obz = ob.z;
      pf.hopT0 = brain.now; pf.hopDur = HOP.benchOn; pf.hopH = HOP.h;
      pf.sitUntil = brain.now + HOP.benchOn + Math.max(1, sitDur); pf.land = -1; pf.path = null;
      pf.face = SEAT.bench.face; pf.approach = cellOf(p.x, p.z); pf.fromIdle = true;
      p.state = 'perform'; p.action = kind; p.perfPhase = 'hopOn'; p.speed = 0;
      reserve(p, pf.approach);
    }
    /* a building's live anchor (world) through the island's anchor function, else from its
       footprint. An anchor the model does not have comes back as its 'top' (the kit's fallback),
       and anything outside the building's box is ignored, so a stale point is never used. */
    function anchorAt(ob, name, maxY, out) {
      if (anchorFn) {
        var a = null, top = null;
        try { a = anchorFn(ob.uid, name); } catch (e) { a = null; }
        if (a && isFinite(a.x) && isFinite(a.y) && isFinite(a.z)) {
          try { top = anchorFn(ob.uid, 'top'); } catch (e2) { top = null; }
          var same = !!top && Math.abs(top.x - a.x) + Math.abs(top.y - a.y) + Math.abs(top.z - a.z) < 1e-4;
          var fr = brain.frame, ax = a.x - fr.ox, ay = a.y - fr.oy, az = a.z - fr.oz;
          var inside = Math.abs(ax - ob.x) <= ob.w / 2 + 0.15 && Math.abs(az - ob.z) <= ob.h / 2 + 0.15 &&
                       ay >= ob.y - 0.05 && ay <= ob.y + maxY;
          if (!same && inside) { out.x = ax; out.y = ay; out.z = az; return out; }
        }
      }
      var f = ANCHOR_FALLBACK[ob.id] && ANCHOR_FALLBACK[ob.id][name];
      if (!f) return null;
      out.x = ob.x + f[0]; out.y = ob.y + f[1]; out.z = ob.z + f[2];
      return out;
    }
    /* the item a perform is for: by uid, or (given the kind or the item id) the first one placed */
    function findItem(kind, uid) {
      var gr = g(), spec = PERFORMS[kind], ob = gr.objects[uid];
      if (!ob && (uid == null || uid === kind || uid === spec.id)) {
        for (var k = 0; k < gr.items.length; k++) if (gr.items[k].id === spec.id) { ob = gr.items[k]; break; }
      }
      return ob && ob.id === spec.id ? ob : null;
    }
    /* a run-over to approach cell a: ≤ maxLead s including the hop (a sparkle zip when it is too
       far to run); → {path, runDur, lead} */
    function runOver(p, a, cells, hopDur, maxLead, minLead) {
      var gr = g(), path = cells ? smoothRound(gr, cells, p.x, p.z) : null, len = path ? path.total : Infinity;
      var runMax = maxLead - hopDur;
      if (!path || len / WALK.zip > runMax) {
        /* too far for the run-over: a sparkle zip to the approach side, then a short dash */
        var x0 = p.x, y0 = p.y, z0 = p.z;
        var ax = centreX(a), az = centreZ(a), ddx = p.x - ax, ddz = p.z - az, dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
        var back = Math.min(1.2, dd);
        var sx = ax + ddx / dd * back, sz = az + ddz / dd * back;
        if (!losClear(gr, sx, sz, ax, az, null, 0, -1)) { sx = ax; sz = az; }
        p.x = sx; p.z = sz; p.y = heightAt(gr, sx, sz);
        brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
        path = finishPath([sx, ax], [sz, az], [cellOf(sx, sz), a], a);
        len = path.total;
      }
      var runDur = len < 0.05 ? 0 : clamp(len / WALK.run, 0.25, runMax);
      if (len / runDur > WALK.zip) runDur = len / WALK.zip;
      var lead = clamp(runDur + hopDur, minLead, maxLead);
      return { path: path, runDur: lead - hopDur, lead: lead };
    }
    /* the run state every run-over starts with */
    function startRun(p, kind, ob, a, run) {
      var gr = g(), pf = p.perf;
      pf.kind = kind; pf.uid = ob.uid; pf.t0 = brain.now; pf.land = -1; pf.approach = a; pf.fromIdle = false;
      pf.obx = ob.x; pf.obz = ob.z;
      pf.lead = run.lead; pf.path = run.path; pf.runT0 = brain.now; pf.runDur = run.runDur; pf.hopT0 = brain.now + run.runDur;
      pf.ax = centreX(a); pf.az = centreZ(a); pf.ay = heightAt(gr, pf.ax, pf.az);
      if (pf.runDur <= 0) { pf.ax = p.x; pf.az = p.z; pf.ay = p.y; }
      p.state = 'perform'; p.action = kind;
      var own = walkSpeed(p);
      p.cruise = run.path ? Math.max(own, run.path.total / Math.max(0.05, run.runDur)) : own;
      p.pathS = 0; p.seg = 1;
      reserve(p, a);
    }
    function perform(kind, uid, petId, o) {
      var gr = g(), spec = PERFORMS[kind];
      if (!gr || brain.mode !== 'play' || !brain.pets.length) return -1;
      var ob = spec ? findItem(kind, uid) : null, ob3 = gr.objects[uid], L3 = ob3 ? lookOf(ob3.id) : null;
      /* v3: the land-shop kinds; pose and bench also on an item whose LOOK asks for them (the deckchair,
         the mirrors), never on another building */
      if (!ob) return ob3 && isV3Kind(kind) && (!spec || (L3 && L3.perform === kind)) ? performV3(kind, ob3, petId, o || {}) : -1;
      if (spec.group) return performGroup(kind, ob, o || {});
      if (brain.reduced || brain.danceOn) return -1;
      var p = byId[petId || brain.activeId()] || null;
      if (!p || p.state === 'travel' || away[p.id] || p.guest || playing(p)) return -1;
      if (p.state === 'dance') finishDancer(p, true, null);
      if (kind === 'pose') return performPose(ob, p);
      if (kind === 'sip' || kind === 'roof') return performPerch(kind, ob, p);
      return performSeat(kind, ob, p);
    }
    /* the trampoline (run over, bounce) and the bench (walk over, sit) */
    function performSeat(kind, ob, p) {
      var gr = g();
      if (p.state === 'perform' && p.perf.uid === ob.uid) {
        var pf0 = p.perf;
        if (kind === 'bench') return p.perfPhase === 'run' || p.perfPhase === 'hopOn' ? Math.max(0, pf0.hopT0 + HOP.benchOn - brain.now) : 0;
        /* a re-tap restarts the act: bounce again from the mat now, or keep the run-over's landing time */
        if (p.perfPhase === 'bounce' || p.perfPhase === 'hopOff') { pf0.t0 = brain.now; pf0.lead = 0; pf0.land = -1; p.perfPhase = 'bounce'; placeOnSeat(p); return 0; }
        var landAt = (p.perfPhase === 'run' ? pf0.runT0 + pf0.runDur : pf0.hopT0) + HOP.on;
        pf0.t0 = brain.now; pf0.lead = clamp(landAt - brain.now, 0, BOUNCE.maxLead);
        return pf0.lead;
      }
      if (p.state === 'perform') finishSeat(p, true);
      /* the approach cell: a free side neighbour of the item, the shortest walk */
      var from = cellOf(p.x, p.z);
      if (from < 0) return -1;
      distMap(gr, from, null, dist, parent);
      var a = -1, bestD = Infinity;
      ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var d = dist[c] + (kind === 'bench' && rowOf(c) !== ob.r + 1 ? 0.3 : 0);
        if (d < bestD) { bestD = d; a = c; }
      });
      var cells = null;
      if (a < 0) {                                       /* unreachable: the trampoline zips from a free side cell */
        if (kind === 'bench') return -1;                 /* a bench is only ever walked to */
        ob.adj.forEach(function (c) { if (a < 0 && (res[c] < 0 || res[c] === p.index)) a = c; });
        if (a < 0) return -1;
      } else cells = a === from ? [from] : chainTo(parent, from, a);
      if (kind === 'bench' && !cells) return -1;
      clearMotion(p);
      /* v3 'bounce' (the treetop net): the trampoline's maths on the net's own 'seat' anchor */
      var pf = p.perf, s = kind === 'bounce' ? anchorV3(ob, 'seat', { x: 0, y: 0, z: 0 }) || seatOf(ob, 'trampoline') : seatOf(ob, kind);
      var hopDur = kind === 'bench' ? HOP.benchOn : HOP.on, run;
      if (kind !== 'bench') run = runOver(p, a, cells, hopDur, BOUNCE.maxLead, BOUNCE.minLead);
      else {
        var path = smoothRound(gr, cells, p.x, p.z);
        if (!path) return -1;
        var walkDur = path.total < 0.05 ? 0 : path.total / (WALK.speed * 1.4) + 0.2;
        run = { path: path, runDur: walkDur, lead: walkDur + hopDur };
      }
      startRun(p, kind, ob, a, run);
      pf.sx = s.x; pf.sy = s.y; pf.sz = s.z; pf.face = kind === 'bench' ? SEAT.bench.face : null;
      pf.hopDur = hopDur; pf.hopH = HOP.h;
      if (kind === 'bench') pf.sitUntil = brain.now + run.lead + 3.5 + rng() * 2;
      p.perfPhase = pf.runDur > 0 ? 'run' : 'hopOn';
      return run.lead;
    }
    /* the Photo Booth: run to the front cell (or the nearest free side cell), 3 poses on the ticks */
    function performPose(ob, p) {
      var gr = g(), pf = p.perf;
      if (p.state === 'perform' && pf.kind === 'pose' && pf.uid === ob.uid) {        /* a re-tap restarts the poses */
        if (p.perfPhase === 'run') return Math.max(0, pf.runT0 + pf.runDur - brain.now);
        pf.t0 = brain.now; pf.lead = 0; posesOf(0, pf.poses); p.perfPose = -1;
        return 0;
      }
      if (p.state === 'perform') finishSeat(p, true);
      var from = cellOf(p.x, p.z);
      if (from < 0) return -1;
      distMap(gr, from, null, dist, parent);
      var front = cellIndex(ob.c, ob.r + ob.h), a = -1, bestD = Infinity;
      if (front >= 0 && ob.adj.indexOf(front) >= 0 && (res[front] < 0 || res[front] === p.index)) a = front;
      else ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var d = (isFinite(dist[c]) ? dist[c] : 40) + (rowOf(c) === ob.r + ob.h ? 0 : 0.6);
        if (d < bestD) { bestD = d; a = c; }
      });
      if (a < 0) return -1;
      var cells = isFinite(dist[a]) ? (a === from ? [from] : chainTo(parent, from, a)) : null;
      clearMotion(p);
      var run = runOver(p, a, cells, 0, PERFORMS.pose.maxLead, 0);
      startRun(p, 'pose', ob, a, run);
      pf.land = a;
      posesOf(run.lead, pf.poses);
      p.perfPose = -1;
      if (run.runDur > 0) p.perfPhase = 'run';
      else { p.perfPhase = 'pose'; place(p, a); }
      return run.lead;
    }
    /* the Boba Café stool ('sip') and the Rooftop Hangout deck ('roof'): run, hop up onto the
       anchor, sit or rest, hop down */
    function performPerch(kind, ob, p) {
      var gr = g(), spec = PERFORMS[kind], pf = p.perf;
      if (p.state === 'perform' && pf.kind === kind && pf.uid === ob.uid) {          /* a re-tap: stay a little longer */
        if (p.perfPhase === 'sit') pf.sitUntil = Math.max(pf.sitUntil, brain.now + spec.rest);
        return p.perfPhase === 'run' || p.perfPhase === 'hopOn' ? Math.max(0, pf.hopT0 + pf.hopDur - brain.now) : 0;
      }
      var seat = anchorAt(ob, spec.anchor, spec.maxY, _an);
      if (!seat) return -1;
      var sx = seat.x, sy = seat.y, sz = seat.z;
      if (p.state === 'perform') finishSeat(p, true);
      var from = cellOf(p.x, p.z);
      if (from < 0) return -1;
      distMap(gr, from, null, dist, parent);
      /* the approach: the free side cell nearest the seat, the front row preferred */
      var a = -1, bestD = Infinity;
      ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var dx = centreX(c) - sx, dz = centreZ(c) - sz;
        var d = Math.sqrt(dx * dx + dz * dz) + (rowOf(c) === ob.r + ob.h ? 0 : 0.35) + (isFinite(dist[c]) ? 0 : 2);
        if (d < bestD) { bestD = d; a = c; }
      });
      if (a < 0) return -1;
      var cells = isFinite(dist[a]) ? (a === from ? [from] : chainTo(parent, from, a)) : null;
      var hopDur = kind === 'roof' ? HOP.roofOn : HOP.benchOn;
      clearMotion(p);
      var run = runOver(p, a, cells, hopDur, spec.maxLead, hopDur);
      startRun(p, kind, ob, a, run);
      pf.sx = sx; pf.sy = sy; pf.sz = sz; pf.face = null;
      pf.hopDur = hopDur; pf.hopH = kind === 'roof' ? HOP.roofH : HOP.h;
      pf.sitUntil = pf.hopT0 + hopDur + spec.rest;
      p.perfPhase = pf.runDur > 0 ? 'run' : 'hopOn';
      return run.lead;
    }
    function placeOnSeat(p) {
      var pf = p.perf;
      p.x = pf.sx; p.z = pf.sz; p.y = pf.sy; p.onSeat = pf.kind; p.hop = 1;
    }
    /* the run-over profile: a quick ramp, then full speed into the hop */
    function runProfile(u) { var a = 0.15; u = clamp01(u); return u < a ? u * u / (2 * a * (1 - a / 2)) : (u - a / 2) / (1 - a / 2); }
    function performStep(p, dt) {
      var pf = p.perf, gr = g(), now = brain.now, ob = gr.objects[pf.uid];
      if (!ob) { finishSeat(p, true); return; }
      if (p.perfPhase === 'run') {
        var u = pf.runDur > 0 ? (now - pf.runT0) / pf.runDur : 1;
        if (u >= 1 || !pf.path) {
          /* the hop (or the poses) start exactly at runT0 + runDur from the end of the path */
          if (pf.path) { samplePath(pf.path, pf.path.total, _sp, p.seg); pf.ax = _sp.x; pf.az = _sp.z; }
          else { pf.ax = p.x; pf.az = p.z; }
          pf.ay = heightAt(gr, pf.ax, pf.az);
          if (pf.route) { p.x = pf.ax; p.z = pf.az; p.y = pf.ay; p.cell = cellOf(p.x, p.z); p.speed = 0; legStart(p, 0); }
          else if (pf.kind === 'pose') { p.x = pf.ax; p.z = pf.az; p.y = pf.ay; p.cell = cellOf(p.x, p.z); p.speed = 0; p.perfPhase = 'pose'; }
          else { p.perfPhase = 'hopOn'; pf.hopT0 = pf.runT0 + pf.runDur; }
        } else {
          var s = pf.path.total * runProfile(u);
          samplePath(pf.path, s, _sp, p.seg);
          p.seg = _sp.seg;
          var prevX = p.x, prevZ = p.z;
          p.x = _sp.x; p.z = _sp.z; p.y = heightAt(gr, p.x, p.z);
          var mv = Math.sqrt((p.x - prevX) * (p.x - prevX) + (p.z - prevZ) * (p.z - prevZ));
          p.speed = dt > 0 ? mv / dt : p.speed;
          if (mv > 1e-6) turnToward(p, Math.atan2(p.x - prevX, p.z - prevZ), WALK.turn * 2, dt);
          return;
        }
      }
      if (p.perfPhase === 'leg') { legStep(p, dt); return; }
      if (p.perfPhase === 'pose') {                       /* the photo booth: sit · paw-point · cheer */
        var t = now - pf.t0, k = -1;
        for (var i = 0; i < 3; i++) if (t >= pf.poses.starts[i]) k = i;
        p.perfPose = k; p.speed = 0;
        turnToward(p, brain.camYaw, WALK.turn, dt);
        if (t >= pf.poses.end) finishSeat(p, false);
        return;
      }
      if (p.perfPhase === 'hopOn') {
        var v = clamp01((now - pf.hopT0) / pf.hopDur);
        p.hop = v; p.speed = 0; p.onSeat = '';
        p.x = pf.ax + (pf.sx - pf.ax) * v; p.z = pf.az + (pf.sz - pf.az) * v;
        p.y = pf.ay + (pf.sy - pf.ay) * v + pf.hopH * arc(v);
        turnToward(p, Math.atan2(pf.sx - pf.ax, pf.sz - pf.az) || p.yaw, WALK.turn * 2, dt);
        if (v >= 1) {
          placeOnSeat(p);
          p.perfPhase = pf.kind === 'trampoline' || pf.kind === 'bounce' ? 'bounce' : 'sit';
          brain.events.push({ type: 'land', id: p.id, kind: pf.kind, x: p.x, y: p.y, z: p.z });
          var fm = p.fetch;                                 /* IA-3: the ball waiting on the mat: it takes it as it lands */
          if (fm && fm.on && fm.phase === 'bounce' && !fm.held) { fm.held = true; fm.pickAt = brain.now; brain.events.push({ type: 'caught', id: p.id, n: fm.n, x: p.x, y: p.y, z: p.z }); }
        }
        return;
      }
      if (p.perfPhase === 'bounce') {
        placeOnSeat(p);
        bounceAt(now - pf.t0, pf.lead, _b);
        p.bounce = _b.petY; p.flip = _b.flip; p.y = pf.sy + _b.petY;
        turnToward(p, wrap(brain.camYaw + 0.6), WALK.turn, dt);
        if (_b.done) startHopOff(p);
        return;
      }
      if (p.perfPhase === 'sit') {
        placeOnSeat(p);
        turnToward(p, pf.face == null ? brain.camYaw : pf.face, WALK.turn, dt);
        if (now >= pf.sitUntil) startHopOff(p);
        return;
      }
      if (p.perfPhase === 'hopOff') {
        var w = clamp01((now - pf.hopT0) / pf.hopDur);
        p.hop = 1 - w; p.onSeat = ''; p.flip = 0; p.bounce = 0;
        p.x = pf.sx + (pf.lx - pf.sx) * w; p.z = pf.sz + (pf.lz - pf.sz) * w;
        p.y = pf.sy + (pf.ly - pf.sy) * w + pf.hopH * arc(w);
        turnToward(p, Math.atan2(pf.lx - pf.sx, pf.lz - pf.sz) || p.yaw, WALK.turn * 2, dt);
        if (w >= 1) finishSeat(p, false);
      }
    }
    function startHopOff(p) {
      var pf = p.perf, gr = g(), ob = gr.objects[pf.uid], land = -1, bestD = Infinity;
      /* a free side cell: the front (+z) first, then the approach side, then the nearest free */
      if (ob) ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var d = (rowOf(c) === ob.r + ob.h ? 0 : 1) + (Math.abs(centreX(c) - pf.ax) + Math.abs(centreZ(c) - pf.az) < 0.1 ? 0 : 0.5);
        if (d < bestD) { bestD = d; land = c; }
      });
      if (land < 0) land = nearestFree(gr, pf.sx, pf.sz, res, p.index, gr.largest);
      if (land < 0) { finishSeat(p, true); return; }
      pf.land = land; pf.lx = centreX(land); pf.lz = centreZ(land); pf.ly = heightAt(gr, pf.lx, pf.lz);
      pf.hopT0 = brain.now; pf.hopDur = pf.kind === 'roof' ? HOP.roofOff : HOP.off; pf.hopH = pf.kind === 'roof' ? HOP.roofH * 0.8 : HOP.h;
      p.perfPhase = 'hopOff';
      reserve(p, land);
    }
    function finishSeat(p, instant) {
      var pf = p.perf;
      if (instant && (p.onSeat || p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff' || p.perfPhase === 'bounce' || p.perfPhase === 'sit' || p.perfPhase === 'leg')) {
        var gr = g(), l = pf.land >= 0 && freeFor(p, pf.land) ? pf.land : nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
        var x0 = p.x, y0 = p.y, z0 = p.z;
        if (l >= 0) { place(p, l); reserve(p, l); }
        /* a v3 part cut short leaves its ride with a sparkle (never a silent jump off a ride) */
        if (pf.route && Math.abs(p.x - x0) + Math.abs(p.y - y0) + Math.abs(p.z - z0) > 0.3) brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
      }
      var fromIdle = pf.fromIdle;
      clearMotion(p);
      pf.approach = -1; pf.land = -1; pf.fromIdle = false;
      p.state = 'idle'; p.action = '';
      p.cell = cellOf(p.x, p.z);
      if (!freeFor(p, p.cell)) { var nf = nearestFree(g(), p.x, p.z, res, p.index, g().largest); if (nf >= 0) popTo(p, nf); }
      else reserve(p, p.cell);
      /* a tapped act rests the pet a moment; an idle bench visit keeps its 4–8 s slot */
      if (!fromIdle) p.nextAt = Math.max(p.nextAt, brain.now + 2 + 2 * rng());
      /* IA-3: a pet that bounced on the trampoline for the ball carries it back (cut short: it drops it) */
      var fb = p.fetch;
      if (fb && fb.on && fb.phase === 'bounce') { fb.keep = false; if (instant) cutFetch(p); else carryBack(p); }
    }

    /* ================================================================
       v3 PERFORMS (D91): one route engine for every land-shop kind
       ================================================================ */
    function isV3Kind(kind) { return V3_KINDS.indexOf(kind) >= 0 || /^(seat|trail|stand):[A-Za-z]+$/.test(kind); }
    /* a LOOK anchor of item ob in this frame, or null: the kit answers an anchor the model lacks with
       its 'top', and anything outside the item's reach is stale. A pivoted anchor (LOOK anchorPivots)
       may swing well outside the footprint (a gondola, a trolley) and is read again every frame */
    function anchorV3(ob, name, out) {
      if (!anchorFn || !name) return null;
      var a = null, top = null, L = lookOf(ob.id), piv = !!(L && L.anchorPivots && L.anchorPivots[name]);
      try { a = anchorFn(ob.uid, name); } catch (e) { a = null; }
      if (!a || !isFinite(a.x) || !isFinite(a.y) || !isFinite(a.z)) return null;
      if (name !== 'top') {
        try { top = anchorFn(ob.uid, 'top'); } catch (e2) { top = null; }
        if (top && Math.abs(top.x - a.x) + Math.abs(top.y - a.y) + Math.abs(top.z - a.z) < 1e-4) return null;
      }
      var fr = brain.frame, x = a.x - fr.ox, y = a.y - fr.oy, z = a.z - fr.oz, pad = piv ? 1.8 : 0.25, hi = ((L && L.h) || 3) + (piv ? 2.5 : 0.6);
      if (Math.abs(x - ob.x) > ob.w / 2 + pad || Math.abs(z - ob.z) > ob.h / 2 + pad || y < ob.y - 0.4 || y > ob.y + hi) return null;
      out.x = x; out.y = y; out.z = z;
      return out;
    }
    /* a route point: an anchor resolved now (live = it rides a pivot and is read every frame) */
    function ptOf(ob, L, name) {
      var a = name ? anchorV3(ob, name, { x: 0, y: 0, z: 0 }) : null;
      return a ? { n: name, x: a.x, y: a.y, z: a.z, live: !!(L && L.anchorPivots && L.anchorPivots[name]), grip: HANG.names.test(name) } : null;
    }
    function ptsOf(ob, L, names) { var out = []; (names || []).forEach(function (n) { var q = ptOf(ob, L, n); if (q) out.push(q); }); return out; }
    function hd(a, b) { var dx = b.x - a.x, dz = b.z - a.z; return Math.sqrt(dx * dx + dz * dz); }
    /* the legs that take a pet from point f onto point t: a walk on the level, a hop, a climb up a
       tall straight rise (paws up), or a sparkle pop where neither reaches */
    function onto(f, t, clip, hang) {
      var dx = hd(f, t), dy = t.y - (hang ? HANG.reach : 0) - f.y;
      /* up a ladder (an anchor named so, or a straight vertical run): paws up, climbing */
      if (dy > LEG.climb && !t.live && !hang && (/ladder/i.test((f.n || '') + (t.n || '')) || dx < 0.45)) return { m: 'go', to: [t], clip: 'hang', w: dy * 1.6, climb: true };
      if (dx > LEG.reachH || dy > LEG.reachV || dy < -1.8) return { m: 'pop', to: t, d: LEG.pop, fix: true, hang: !!hang };
      if (!hang && Math.abs(dy) < LEG.ground && dx < 1.3 && !t.live && clip !== 'jump') return { m: 'go', to: [t], clip: 'walk', w: dx / LEG.walk, gw: true };
      return { m: 'hop', to: t, clip: clip === 'jump' ? 'jump' : 'hop', d: LEG.hop + 0.12 * Math.max(0, dy), fix: true, hang: !!hang };
    }
    function ride(t, clip, face, hang) { return { m: 'ride', to: t, clip: clip, w: 1, face: face, hang: !!hang }; }
    function stand(t, clip, face) { return { m: 'stand', to: t, clip: clip, w: 1, face: face || 'z' }; }
    /* along points `list` from f (a slide, a beam, the bars, a lap): weight = its length at a walk */
    function glide(list, clip, hang, f) { var l = { m: 'go', to: list, clip: clip, hang: !!hang, face: 'path', glide: true, from: f || list[0] }; l.w = glideW(l); return l; }
    function glideW(l) {
      var w = 0, a = l.from;
      for (var k = 0; k < l.to.length; k++) { var b = l.to[k]; w += hd(a, b) + Math.abs(b.y - a.y); a = b; }
      return Math.max(0.25, w / LEG.walk);
    }
    /* no anchor to go to (a model without them): the pet comes and cheers at the front */
    function cheerRoute(ob, A, T, w) {
      return { kind: 'cheer', segs: [{ legs: [stand({ n: '', x: A.x, y: A.y, z: A.z }, 'cheer', 'item')], s: w[0], e: Math.min(w[1], T - LEG.off) }],
               first: { x: ob.x, y: ob.y, z: ob.z + ob.h / 2 }, T: T };
    }
    /* the pet window of an act: the seconds its petT runs over, else the whole act */
    function petWindow(act, T) { var r = act ? rampOf(act, 'petT') : null; return r && r[1] > r[0] ? [r[0], Math.min(T, r[1])] : [0, T]; }

    /* the route for kind at item ob: {segs: [{legs, s, e}], first (the point the approach aims at),
       T} or null (no such kind / no anchor to go to). Segment windows are act seconds for a pet that
       is there in time; schedule() fits them round the real run-over */
    function routeOf(kind, ob, A) {
      var L = lookOf(ob.id) || {}, act = actOf(ob.id), T = actDur(act), segs = [], P = function (n) { return ptOf(ob, L, n); };
      var gen = /^(seat|trail|stand):([A-Za-z]+)$/.exec(kind), base = gen ? gen[1] : kind, clip = gen ? gen[2] : V3_CLIPS[kind] || 'sit';
      var w = petWindow(act, T), legs = [], f = A, last = T - LEG.off, i, q;
      function seg(list, s, e) { if (list.length) segs.push({ legs: list, s: s, e: e }); }
      function chain(list, pts, c, hang) {            /* onto each point in turn (hops, climbs, pops) */
        for (var k = 0; k < pts.length; k++) { hops(list, f, pts[k], c, hang); f = pts[k]; }
      }
      /* onto t from f; a hopping trail splits a tall rise it can see no steps for into hops up the line */
      function hops(list, f0, t, c, hang) {
        var dy = t.y - f0.y, a = f0;
        var n = (c === 'hop' || c === 'jump') && !hang && !t.live && dy > LEG.reachV && dy <= 3 * LEG.reachV && hd(f0, t) <= LEG.reachH ? Math.ceil(dy / 0.8) : 1;
        for (var j = 1; j <= n; j++) {
          var v = j === n ? t : { n: '', x: f0.x + (t.x - f0.x) * j / n, y: f0.y + dy * j / n, z: f0.z + (t.z - f0.z) * j / n };
          list.push(onto(a, v, c, j === n && hang)); a = v;
        }
      }
      if (base === 'seat' || kind === 'ride' || kind === 'wheel' || kind === 'vine' || kind === 'feast' || kind === 'bench') {
        var S = P(L.performAt || 'seat');
        if (!S) return null;
        var hang = clip === 'hang';
        legs.push(onto(A, S, 'hop', hang));
        legs.push(ride(S, clip, S.live && (clip === 'ride' || clip === 'drive') && kind !== 'vine' ? 'head' : 'z', hang));
        seg(legs, w[0], Math.min(w[1], last));
      } else if (base === 'stand' || kind === 'pose') {
        var St = P(L.performAt) || P('spot') || P('seat');
        if (!St) return null;
        seg([onto(A, St), stand(St, clip, 'z')], w[0], Math.min(w[1], last));
      } else if (base === 'trail') {
        var tp = ptsOf(ob, L, L.trail);
        if (!tp.length) return null;
        var kw = act ? rampOf(act, 'k') : null, s0 = w[0];
        hops(legs, A, tp[0], clip, clip === 'hang' && tp[0].grip);
        f = tp[0];
        for (i = 1; i < tp.length; i++) {
          q = tp[i];
          var grip = clip === 'hang' && q.grip, flat = clip === 'walk' || clip === 'run' || clip === 'wobble';
          if (q.live && kw) {                         /* a pivoted point (a zip handle): grab it, ride it down the act's k ramp */
            legs.push(onto(f, q, clip, grip));
            seg(legs, s0, Math.max(s0, kw[0])); legs = [];
            seg([ride(q, grip ? 'hang' : clip, 'path', grip)], kw[0], kw[1]); s0 = kw[1];
          } else if ((grip && f.grip) || (flat && Math.abs(q.y - f.y) < 0.35)) {
            var prev = legs[legs.length - 1], c2 = grip ? 'hang' : clip;
            if (prev && prev.glide && prev.clip === c2) { prev.to.push(q); prev.w = glideW(prev); }
            else legs.push(glide([q], c2, grip, f));
          } else hops(legs, f, q, clip, grip);
          f = q;
        }
        seg(legs, s0, Math.min(w[1], last));
      } else if (kind === 'slide') {
        var names = L.trail || slideNames(L.anchors || []), sp = ptsOf(ob, L, names), S2 = !L.trail && P('seat');
        if (S2 && S2.live) return routeOf('seat:ride', ob, A);
        if (sp.length < 2) return null;
        var hiK = 0;
        for (i = 1; i < sp.length; i++) if (sp[i].y > sp[hiK].y + 1e-6) hiK = i;
        var cw = act === 'slide' ? rampOf(act, 'climb') : null, sw = act === 'slide' ? rampOf(act, 'slide') : null;
        chain(legs, sp.slice(0, hiK + 1), 'step');
        var down = [sp[hiK]].concat(sp.slice(hiK + 1));
        if (cw && sw) { seg(legs, w[0], cw[1]); seg([glide(down.slice(1), 'slide', false, down[0])], sw[0], Math.min(sw[1], last)); }
        else { legs.push(glide(down.slice(1), 'slide', false, down[0])); seg(legs, w[0], Math.min(w[1], last)); }
      } else if (kind === 'wobble' || kind === 'skate') {
        var wp = kind === 'wobble' ? ptsOf(ob, L, ['postL', 'postR']) : ptsOf(ob, L, ['lap0', 'lap1', 'lap2', 'lap3', 'lap4', 'lap5', 'lap6', 'lap7', 'lap0']);
        if (wp.length < 2) return null;
        var cr = rampOf(act, kind === 'wobble' ? 'cross' : 'lap') || w;
        seg([onto(A, wp[0])], 0, cr[0]);
        seg([glide(wp.slice(1), clip, false, wp[0])], cr[0], Math.min(cr[1], last));
      } else if (kind === 'paddle') {
        var sp0 = P('spot'), pool = P('pool');
        if (!pool) return null;
        legs.push(onto(A, sp0 || pool));
        if (sp0) legs.push(onto(sp0, pool));
        legs.push({ m: 'go', circle: { x: pool.x, y: pool.y, z: pool.z, r: Math.max(0.12, Math.min(0.3, sp0 ? 0.6 * hd(sp0, pool) : 0.2)) }, to: [pool], clip: clip, w: 1.6, face: 'path' });
        seg(legs, w[0], Math.min(w[1], last));
      } else if (kind === 'maypole') {
        var ring = P('ring' + (A.ring || 0));
        if (!ring) return null;
        var rr = hd({ x: ob.x, z: ob.z }, ring);
        seg([onto(A, ring), { m: 'go', circle: { x: ob.x, y: ring.y, z: ob.z, r: rr, from: Math.atan2(ring.x - ob.x, ring.z - ob.z) }, to: [ring], clip: 'walk', w: 2, face: 'path' }],
          w[0], Math.min(w[1], last));
      } else if (kind === 'cross') {
        var gate = P('gate'), door = P('door');
        if (!gate || !door) return null;
        var dn = rampOf(act, 'down'), tr = rampOf(act, 'trot');
        seg([onto(A, gate)], 0, dn ? dn[1] : 0.5 * T);
        seg([glide([door], 'run', false, gate)], dn ? dn[1] : 0.5 * T, tr ? tr[0] : 0.6 * T);
        seg([glide([gate], 'walk', false, door)], tr ? tr[0] : 0.6 * T, Math.min(tr ? tr[1] : T, last));
      } else if (kind === 'lift') {
        var Sl = P('seat'), spot = P('spot') || P('door'), deck = P('deck2') || P('deck1') || P('deck0');
        if (!Sl || !spot) return null;
        var bd = whenOf(act, 'basket', false, 0.02), bu = bd < 0 ? -1 : whenOf(act, 'basket', true, 0.98, bd + 0.1);
        if (bd < 0) { bd = 0.3 * T; bu = 0.85 * T; }
        seg([onto(A, spot), stand(spot, 'idle', 'item')], 0, bd);
        seg([onto(spot, Sl), ride(Sl, 'sit', 'z')], bd, bu);
        if (deck) seg([onto(Sl, deck), stand(deck, 'cheer', 'z')], bu, last);
      } else if (kind === 'zip') {
        var zs = P('zipStart'), nest = P('nest'), land = P('landing'), zspot = P('spot') || P('door');
        if (!zs || !land) return null;
        var cl = rampOf(act, 'climb') || [0.1, 0.3 * T], back = whenOf(act, 'zip', false, 0.003), go0 = back < 0 ? 0.4 * T : whenOf(act, 'zip', true, 0.003, back);
        var go1 = go0 < 0 ? 0.75 * T : whenOf(act, 'zip', true, 0.997, go0), wv = rampOf(act, 'wave') || [go1, go1 + 0.3];
        if (go0 < 0) go0 = 0.4 * T;
        if (go1 < 0) go1 = 0.75 * T;
        f = A;
        if (zspot) chain(legs, [zspot], 'step');
        if (nest) chain(legs, [nest], 'step');
        seg(legs, cl[0], cl[1]);
        f = nest || zspot || A;
        seg([onto(f, zs, 'hop', true)], cl[1], go0);
        seg([ride(zs, 'hang', 'path', true)], go0, go1);
        seg([onto({ x: zs.x, y: zs.y - HANG.reach, z: zs.z }, land), stand(land, 'cheer', 'z')], go1, Math.min(Math.max(wv[1], go1 + 0.5), last));
      } else return null;
      if (!segs.length) return null;
      /* the pet stays in its part to the end of the act: the last ride or stand holds on, a trail ends
         with a cheer up high (or a look round down low) where it finished */
      var ls = segs[segs.length - 1], ll = ls.legs[ls.legs.length - 1];
      if (ll.m === 'ride' || ll.m === 'stand') ls.e = Math.max(ls.e, last);
      else if (!ll.circle) {
        var ep = Array.isArray(ll.to) ? ll.to[ll.to.length - 1] : ll.to, hi = ep.y - ob.y > 0.6 ? 'cheer' : 'idle';
        segs.push({ legs: [ll.hang ? ride(ep, 'hang', 'z', true) : stand(ep, hi, 'z')], s: 0, e: last });       /* from where the part ends */
      }
      var first = segs[0].legs[0].to;
      return { kind: kind, segs: segs, first: Array.isArray(first) ? first[0] : first, T: T, act: act };
    }
    /* a slide's anchors when LOOK gives no trail: up the ladder to the deck, s0 … sN, then the foot */
    function slideNames(an) {
      var out = [];
      ['ladderFoot', 'ladder', 'deck'].forEach(function (n) { if (an.indexOf(n) >= 0) out.push(n); });
      for (var k = 0; an.indexOf('s' + k) >= 0; k++) out.push('s' + k);
      if (out.length <= (an.indexOf('deck') >= 0 ? 1 : 0)) { if (an.indexOf('top') >= 0) out.push('top'); }
      ['foot', 'pit'].forEach(function (n) { if (an.indexOf(n) >= 0) out.push(n); });
      return out;
    }
    /* lay the legs out in act seconds after the run-over (lead): each segment keeps its window when the
       pet is there in time, else it is squeezed (fixed hops keep their length while they fit) */
    function schedule(route, lead) {
      var t = Math.max(0, lead), legs = [], segs = route.segs, end = route.T - LEG.off;
      for (var k = 0; k < segs.length; k++) {
        var sg = segs[k], s = Math.max(sg.s, t), e = Math.min(Math.max(sg.e, s), end);
        var fixed = 0, wsum = 0, i, l;
        for (i = 0; i < sg.legs.length; i++) { l = sg.legs[i]; if (l.fix) fixed += l.d; else wsum += l.w; }
        var need = fixed + 0.25 * (sg.legs.length - (fixed > 0 ? 1 : 0));
        if (e - s < need) e = Math.min(end, s + need);
        /* a climb that ends in a sparkle pop (into a tower, up a mast) pops as late as its window allows */
        if (!wsum && sg.legs[sg.legs.length - 1].m === 'pop') s = Math.max(s, e - fixed);
        var span = Math.max(0.05, e - s), k1 = fixed > span * 0.8 ? span * 0.8 / fixed : 1, free = span - fixed * k1;
        for (i = 0; i < sg.legs.length; i++) {
          l = sg.legs[i];
          var d = l.fix ? l.d * k1 : (wsum > 0 ? free * l.w / wsum : 0);
          l.t0 = s; l.t1 = s + d; s += d; legs.push(l);
        }
        t = s;
      }
      route.legs = legs;
      route.end = Math.min(end, t);
      return route;
    }
    /* the seconds the route needs from its first contact (to size the run-over) */
    function needOf(route) {
      var n = 0;
      route.segs.forEach(function (sg) { sg.legs.forEach(function (l) { n += l.fix ? l.d : 0.25; }); });
      return n;
    }
    /* the approach: the free side cell of the item nearest the route's first point (the front row
       preferred, a reachable one first) and the run there from (x0, z0); a sparkle zip when it is
       too far to run within maxLead. dry: plan only (nothing moves) */
    function approachOf(p, ob, aim, x0, z0, maxLead, dry) {
      var gr = g(), from = cellOf(x0, z0);
      if (from < 0) return null;
      distMap(gr, from, null, dist, parent);
      var a = -1, bestD = Infinity;
      ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var dx = centreX(c) - aim.x, dz = centreZ(c) - aim.z;
        var d = Math.sqrt(dx * dx + dz * dz) + (rowOf(c) === ob.r + ob.h ? 0 : 0.35) + (isFinite(dist[c]) ? 0 : 3) + (isFinite(dist[c]) ? dist[c] * 0.04 : 0);
        if (d < bestD) { bestD = d; a = c; }
      });
      if (a < 0) return null;
      var cells = isFinite(dist[a]) ? (a === from ? [from] : chainTo(parent, from, a)) : null;
      var path = cells ? smoothRound(gr, cells, x0, z0) : null, len = path ? path.total : Infinity;
      if (path && len < 0.05) return { a: a, path: null, run: 0, zip: null };
      if (path && len / WALK.run <= maxLead) return { a: a, path: path, run: Math.max(0.2, Math.min(maxLead, len / WALK.run)), zip: null };
      /* too far: a sparkle zip to the approach side, then a short dash */
      var ax = centreX(a), az = centreZ(a), ddx = x0 - ax, ddz = z0 - az, dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1, back = Math.min(1, dd);
      var sx = ax + ddx / dd * back, sz = az + ddz / dd * back;
      if (!losClear(gr, sx, sz, ax, az, null, 0, -1)) { sx = ax; sz = az; }
      var zp = finishPath([sx, ax], [sz, az], [cellOf(sx, sz), a], a);
      void dry;
      return { a: a, path: zp.total > 0.05 ? zp : null, run: zp.total > 0.05 ? Math.min(maxLead, Math.max(0.15, zp.total / WALK.zip)) : 0, zip: { x: sx, z: sz } };
    }
    /* plan a v3 perform from (x0, z0): {route (scheduled), ap, contact (act seconds)} | null */
    function planV3(p, kind, ob, x0, z0, ring) {
      var A0 = { x: x0, y: 0, z: z0, ring: ring || 0 }, act = actOf(ob.id), T = actDur(act), w = petWindow(act, T);
      var r0 = routeOf(kind, ob, A0) || (ring ? null : cheerRoute(ob, A0, T, w));
      if (!r0) return null;
      var maxLead = clamp(r0.segs[r0.segs.length - 1].e - needOf(r0), 0.2, LEG.maxLead);
      var ap = approachOf(p, ob, r0.first, x0, z0, maxLead, true);
      if (!ap) return null;
      /* the legs start from the approach cell's centre */
      var A = { x: centreX(ap.a), y: heightAt(g(), centreX(ap.a), centreZ(ap.a)), z: centreZ(ap.a), ring: ring || 0 };
      var route = r0.kind === 'cheer' ? cheerRoute(ob, A, T, w) : routeOf(kind, ob, A);
      if (!route) return null;
      schedule(route, ap.run);
      return { route: route, ap: ap, contact: route.legs.length ? route.legs[0].t1 : ap.run };
    }
    function performV3(kind, ob, petId, o) {
      if (brain.reduced || brain.danceOn) return -1;
      var p = byId[petId || brain.activeId()] || null;
      if (!p || away[p.id] || brain.pets.indexOf(p) < 0 || p.guest || playing(p)) return -1;      /* a land's guest never performs (D112); nor a playing pet (IA-3) */
      if (p.state === 'travel') return queueV3(p, kind, ob, o);
      if (kind === 'bounce') { if (p.state === 'dance') finishDancer(p, true, null); return performSeat('bounce', ob, p); }
      var pf = p.perf;
      if (p.state === 'perform' && pf.route && pf.uid === ob.uid) {
        /* a re-tap: the model plays its act again; a pet already riding or standing rides it again */
        var cur = pf.route.legs[pf.legIdx];
        if (p.perfPhase === 'leg' && cur && (cur.m === 'ride' || cur.m === 'stand') && pf.legIdx === pf.route.legs.length - 1) {
          var len = cur.t1 - cur.t0;
          pf.t0 = brain.now - cur.t0; cur.t1 = cur.t0 + Math.max(len, pf.route.end - cur.t0);
        }
        return 0.05;
      }
      if (p.state === 'perform') finishSeat(p, true);
      if (p.state === 'dance') finishDancer(p, true, null);
      var n = startV3(p, kind, ob, 0);
      if (n > 0 && kind === 'maypole') {
        /* up to two more of the crew circle the pole on rings 1 and 2 (never a land's guest, D112) */
        var extra = 0;
        for (var k = 0; k < brain.pets.length && extra < 2; k++) {
          var q = brain.pets[k];
          if (q === p || q.guest || (q.state !== 'idle' && q.state !== 'walk' && q.state !== 'act')) continue;
          if (startV3(q, kind, ob, extra + 1) > 0) extra++;
        }
      }
      return n;
    }
    function startV3(p, kind, ob, ring) {
      var plan = planV3(p, kind, ob, p.x, p.z, ring);
      if (!plan) return -1;
      var ap = plan.ap, pf = p.perf, x0 = p.x, y0 = p.y, z0 = p.z;
      clearMotion(p);
      if (ap.zip) {
        p.x = ap.zip.x; p.z = ap.zip.z; p.y = heightAt(g(), p.x, p.z);
        brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
      }
      startRun(p, kind, ob, ap.a, { path: ap.path, runDur: ap.path ? ap.run : 0, lead: plan.contact });
      pf.route = plan.route; pf.legIdx = -1; pf.land = -1;
      if (ap.path) p.perfPhase = 'run';
      else { p.x = centreX(ap.a); p.z = centreZ(ap.a); p.y = heightAt(g(), p.x, p.z); legStart(p, 0); }
      return Math.max(0.05, plan.contact);
    }
    /* perform() on a pet still crossing: the act waits for it (lead = the rest of the crossing + the
       run over from its arrival cell) and plays on arrival */
    function queueV3(p, kind, ob, o) {
      var tr = p.trav, cell = tr.cell;
      if (cell < 0) return -1;
      var rest = Math.max(0, tr.t0 + (tr.hop ? tr.hopAt : 0) - brain.now) + Math.max(0, tr.total - tr.s) / tr.speed;
      var plan = kind === 'bounce' ? { contact: BOUNCE.maxLead } : planV3(p, kind, ob, centreX(cell), centreZ(cell), 0);
      if (!plan) return -1;
      tr.q = { kind: kind, uid: ob.uid, o: o };
      return rest + Math.max(0.05, plan.contact);
    }
    /* ---------- the legs ---------- */
    var _lp = { x: 0, y: 0, z: 0 }, _lq = { x: 0, y: 0, z: 0 };
    /* point q now: live points are read again (their pivot moves), in this frame */
    function liveOf(ob, q, out) {
      out.x = q.x; out.y = q.y; out.z = q.z;
      if (q.live && anchorFn) {
        var a = null;
        try { a = anchorFn(ob.uid, q.n); } catch (e) { a = null; }
        if (a && isFinite(a.x) && isFinite(a.y) && isFinite(a.z)) { var fr = brain.frame; out.x = a.x - fr.ox; out.y = a.y - fr.oy; out.z = a.z - fr.oz; }
      }
      return out;
    }
    function legStart(p, k) {
      var pf = p.perf, r = pf.route;
      if (!r) return;
      if (k >= r.legs.length) { startExit(p); return; }
      var l = r.legs[k];
      pf.legIdx = k; pf.lx = p.x; pf.ly = p.y; pf.lz = p.z; pf.hy = 0;
      p.perfPhase = 'leg'; p.legMode = l.m; p.perfClip = l.clip || ''; p.legU = 0; p.hang = l.hang && l.m !== 'pop' ? 1 : 0;
      if (l.m === 'hop') { var to = liveOf(g().objects[pf.uid], l.to, _lq); pf.hy = Math.max(HOP.h, (to.y - (l.hang ? HANG.reach : 0) - p.y) / 2 + 0.12); }
      if (l.m === 'pop') p.hang = 0;                    /* it gathers itself, then pops there at the leg's end */
      if (l.m === 'go' && l.circle) { var c = l.circle; pf.ca = c.from != null ? c.from : Math.atan2(p.x - c.x, p.z - c.z); }
    }
    /* the polyline of a 'go' leg at fraction u: from where the leg began through its points */
    var segL = new Float64Array(64);
    function goAt(ob, l, pf, u, out) {
      var hy = l.hang ? HANG.reach : 0, n = Math.min(64, l.to.length), total = 0, k, px = pf.lx, py = pf.ly + hy, pz = pf.lz;
      if (l.circle) {
        var c = l.circle, a = pf.ca + TAU * u, k0 = clamp01(u * 6), r = c.r;
        out.x = c.x + Math.sin(a) * r; out.z = c.z + Math.cos(a) * r; out.y = pf.ly + (c.y - pf.ly) * smooth01(k0);
        if (u < 0.12) { var e0 = smooth01(u / 0.12); out.x = pf.lx + (out.x - pf.lx) * e0; out.z = pf.lz + (out.z - pf.lz) * e0; }
        return out;
      }
      for (k = 0; k < n; k++) { liveOf(ob, l.to[k], _lp); var dx = _lp.x - px, dy = _lp.y - py, dz = _lp.z - pz, d = Math.sqrt(dx * dx + dy * dy + dz * dz); segL[k] = d; total += d; px = _lp.x; py = _lp.y; pz = _lp.z; }
      var s = total * u; px = pf.lx; py = pf.ly + hy; pz = pf.lz;
      for (k = 0; k < n; k++) {
        liveOf(ob, l.to[k], _lp);
        if (s <= segL[k] || k === n - 1) {
          var v = segL[k] > 1e-9 ? clamp01(s / segL[k]) : 1;
          out.x = px + (_lp.x - px) * v; out.y = py + (_lp.y - py) * v - hy; out.z = pz + (_lp.z - pz) * v;
          return out;
        }
        s -= segL[k]; px = _lp.x; py = _lp.y; pz = _lp.z;
      }
      return out;
    }
    function legStep(p, dt) {
      var pf = p.perf, r = pf.route, ob = g().objects[pf.uid], ta = brain.now - pf.t0;
      if (!r || !ob) { finishSeat(p, true); return; }
      var l = r.legs[pf.legIdx];
      if (!l) { startExit(p); return; }
      if (ta >= l.t1) {                                   /* the leg is done: exactly on its point, then the next */
        var x1 = p.x, y1 = p.y, z1 = p.z;
        if (l.m !== 'go' || !l.circle) { var e = liveOf(ob, Array.isArray(l.to) ? l.to[l.to.length - 1] : l.to, _lq); p.x = e.x; p.y = e.y - (l.hang ? HANG.reach : 0); p.z = e.z; }
        if (l.m === 'pop') brain.events.push({ type: 'pop', id: p.id, x0: x1, y0: y1, z0: z1, x: p.x, y: p.y, z: p.z });
        legStart(p, pf.legIdx + 1);
        if (p.perfPhase === 'leg') legStep(p, 0);
        return;
      }
      var u = l.t1 > l.t0 ? clamp01((ta - l.t0) / (l.t1 - l.t0)) : 1, x0 = p.x, z0 = p.z, yaw = null;
      p.legU = u; p.speed = 0;
      if (l.m === 'pop' || (ta < l.t0 && l.m !== 'ride' && l.m !== 'stand')) {   /* early, or about to pop: wait facing the item */
        p.legMode = l.m === 'pop' && ta >= l.t0 ? 'pop' : 'wait';
        turnToward(p, Math.atan2(ob.x - p.x, ob.z - p.z), WALK.turn, dt);
        return;
      }
      p.legMode = l.m;
      if (l.m === 'hop') {
        var t = liveOf(ob, l.to, _lq), ty = t.y - (l.hang ? HANG.reach : 0);
        p.x = pf.lx + (t.x - pf.lx) * u; p.z = pf.lz + (t.z - pf.lz) * u; p.y = pf.ly + (ty - pf.ly) * u + pf.hy * arc(u);
        p.hop = u;
        if (Math.abs(t.x - pf.lx) + Math.abs(t.z - pf.lz) > 0.05) yaw = Math.atan2(t.x - pf.lx, t.z - pf.lz);
      } else if (l.m === 'go') {
        goAt(ob, l, pf, l.clip === 'slide' ? u * u * (2 - u) * 0.5 + u * 0.5 : u, _lq);
        p.x = _lq.x; p.y = _lq.y; p.z = _lq.z;
        p.speed = dt > 0 ? Math.sqrt((p.x - x0) * (p.x - x0) + (p.z - z0) * (p.z - z0)) / dt : 0;
        p.cruise = Math.max(WALK.speed, p.speed);
        if (l.climb) yaw = Math.atan2(ob.x - p.x, ob.z - p.z);
        else if (l.hang) yaw = 0;                         /* hand over hand facing out: the face between the rails */
        else if ((p.x - x0) * (p.x - x0) + (p.z - z0) * (p.z - z0) > 1e-8) yaw = Math.atan2(p.x - x0, p.z - z0);
      } else {                                            /* ride · stand: on the (live) point */
        var q = liveOf(ob, l.to, _lq);
        p.x = q.x; p.y = q.y - (l.hang ? HANG.reach : 0); p.z = q.z;
        if (l.clip === 'pose') p.perfPose = Math.min(2, Math.floor(u * 3));
        if (l.face === 'head') {
          var mx = p.x - x0, mz = p.z - z0;
          if (dt > 0 && (mx * mx + mz * mz) / (dt * dt) > 0.09 && Math.abs(wrap(Math.atan2(mx, mz) - p.yaw)) < 2.1) yaw = Math.atan2(mx, mz);
        } else if (l.face === 'item') yaw = Math.atan2(ob.x - p.x, ob.z - p.z);
        else if (l.face !== 'path') yaw = 0;
      }
      p.onSeat = l.m === 'hop' ? '' : 'v3';
      p.cell = cellOf(p.x, p.z);
      if (yaw != null) turnToward(p, yaw, WALK.turn * 2, dt); else p.omega = 0;
    }
    /* off the item: a hop to the free side cell nearest where the pet is (a sparkle pop from up high
       or far away), done by the end of the act */
    function startExit(p) {
      var pf = p.perf, gr = g(), ob = gr.objects[pf.uid], land = -1, bestD = Infinity;
      if (ob) ob.adj.forEach(function (c) {
        if (res[c] >= 0 && res[c] !== p.index) return;
        var dx = centreX(c) - p.x, dz = centreZ(c) - p.z, d = dx * dx + dz * dz + (rowOf(c) === ob.r + ob.h ? 0 : 0.1);
        if (d < bestD) { bestD = d; land = c; }
      });
      if (land < 0) land = nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
      if (land < 0) { finishSeat(p, true); return; }
      var lx = centreX(land), lz = centreZ(land), ly = heightAt(gr, lx, lz), far = Math.sqrt(bestD) > 1.7 || p.y - ly > 1.5;
      reserve(p, land); pf.land = land;
      var left = pf.route ? pf.route.T - (brain.now - pf.t0) : LEG.off;
      if (far || left < 0.12) {
        var x0 = p.x, y0 = p.y, z0 = p.z;
        place(p, land);
        brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
        finishSeat(p, false);
        return;
      }
      pf.sx = p.x; pf.sy = p.y; pf.sz = p.z; pf.lx = lx; pf.ly = ly; pf.lz = lz;
      pf.hopT0 = brain.now; pf.hopDur = clamp(left, 0.12, LEG.off); pf.hopH = Math.max(HOP.h * 0.8, (ly - p.y) / 2 + 0.1);
      p.perfPhase = 'hopOff'; p.legMode = ''; p.hang = 0; p.onSeat = '';
    }

    /* ================================================================
       v3 ISLANDS AND CROSSINGS (D29 / D83)
       ================================================================ */
    function reindex() { brain.pets.forEach(function (q, k) { q.index = k; }); if (brain.graph) rebuildReservations(); }
    /* the cell the island's avatar stands on (its first dock cell), or -1 on Home */
    function dockCell(k) {
      var d = isleDef && isleDef.dock && isleDef.dock[k || 0];
      return d ? cellIndex(d[0], d[1]) : -1;
    }
    /* where the avatar stands on a sky island: its dock cell, stepped aside from the pets' way in */
    brain.dockSpot = function (out) {
      var c = dockCell(0), G = grid(Gx), B = G && G.V3 && G.V3.bridge ? G.V3.bridge(brain.isle) : null;
      if (c < 0 || !B) return null;
      out = out || {};
      var ux = (B.b.x - B.a.x) / B.length, uz = (B.b.z - B.a.z) / B.length, nx = -uz, nz = ux, fr = brain.frame;
      var other = dockCell(1);
      if (other >= 0) { if ((centreX(other) - centreX(c)) * nx + (centreZ(other) - centreZ(c)) * nz > 0) { nx = -nx; nz = -nz; } }
      else if (nz < 0 || (nz === 0 && nx < 0)) { nx = -nx; nz = -nz; }
      out.c = colOf(c); out.r = rowOf(c); out.nx = nx; out.nz = nz;
      out.x = centreX(c) + nx * CROSS.dockSide + fr.ox; out.y = fr.oy; out.z = centreZ(c) + nz * CROSS.dockSide + fr.oz;
      return out;
    };
    /* world points of a walk from local (x0, z0) to cell `to` on this island (A* + smoothing) */
    function walkPts(x0, z0, to, out) {
      var gr = g(), from = cellOf(x0, z0), fr = brain.frame;
      if (from < 0 || !gr.walk[from]) from = nearestFree(gr, x0, z0, null, -1, gr.largest);
      var vb = from >= 0 && to >= 0 ? visitorBlock(from) : null, cells = vb ? astar(gr, from, to, vb) : null;   /* round the visitor (IA-3) */
      if (!cells) { vb = null; cells = from >= 0 && to >= 0 ? astar(gr, from, to, null) : null; }
      var path = cells ? smoothPath(gr, cells, x0, z0, vb) : null;
      if (!path) { out.push(centreX(to) + fr.ox, heightAt(gr, centreX(to), centreZ(to)) + fr.oy, centreZ(to) + fr.oz); return; }
      var n = Math.max(1, Math.ceil(path.total / CROSS.step));
      for (var i = 0; i <= n; i++) {
        samplePath(path, path.total * i / n, _sp, 1);
        out.push(_sp.x + fr.ox, heightAt(gr, _sp.x, _sp.z) + fr.oy, _sp.z + fr.oz);
      }
    }
    /* out of this island toward a world point W (Home: a land's gate pad; a land: its dock edge) →
       false when the pet is more than 4 u from it (it hops there instead) */
    brain.exitPts = function (id, W, out) {
      var p = byId[id], fr = brain.frame;
      if (!p || !g()) return false;
      if (p.state === 'perform') finishSeat(p, true);
      if (p.state === 'dance') finishDancer(p, true, null);
      var lx = W.x - fr.ox, lz = W.z - fr.oz, dx = lx - p.x, dz = lz - p.z;
      if (Math.sqrt(dx * dx + dz * dz) > CROSS.hopDist) return false;
      var near = nearestFree(g(), lx, lz, null, -1, g().largest);
      if (near >= 0) walkPts(p.x, p.z, near, out);
      out.push(W.x, W.y, W.z);
      return true;
    };
    /* across this island (Home) from one land's gate pad to another's */
    brain.transferPts = function (A, B2, out) {
      var gr = g(), a = nearestFree(gr, A.x, A.z, null, -1, gr.largest), b = nearestFree(gr, B2.x, B2.z, null, -1, gr.largest);
      out.push(A.x, A.y, A.z);
      if (a >= 0 && b >= 0) walkPts(centreX(a), centreZ(a), b, out);
      out.push(B2.x, B2.y, B2.z);
    };
    /* into this island from a world point E (its dock edge / a gate pad) → the arrival cell */
    brain.entryPts = function (E, out) {
      var gr = g(), fr = brain.frame, ex = E.x - fr.ox, ez = E.z - fr.oz, cell = -1, k;
      for (k = 0; k < 2 && cell < 0; k++) { var dc = dockCell(k); if (dc >= 0 && gr.walk[dc] && res[dc] < 0) cell = dc; }
      if (cell < 0) {
        var n0 = nearestFree(gr, ex, ez, null, -1, gr.largest), spot = isleDef ? brain.dockSpot({}) : null;
        cell = n0 >= 0 && res[n0] < 0 ? n0 : nearestFree(gr, n0 >= 0 ? centreX(n0) : ex, n0 >= 0 ? centreZ(n0) : ez, res, -1, gr.largest);
        if (spot) out.push(centreX(dockCell(0)) - spot.nx * CROSS.petSide + fr.ox, fr.oy, centreZ(dockCell(0)) - spot.nz * CROSS.petSide + fr.oz);
        else if (n0 >= 0 && n0 !== cell) out.push(centreX(n0) + fr.ox, heightAt(gr, centreX(n0), centreZ(n0)) + fr.oy, centreZ(n0) + fr.oz);
      }
      if (cell >= 0) out.push(centreX(cell) + fr.ox, heightAt(gr, centreX(cell), centreZ(cell)) + fr.oy, centreZ(cell) + fr.oz);
      return cell;
    };
    /* a pet kept by another island (it is over there now): not stepped, not reserved, never re-added by sync */
    brain.setAway = function (id, on) {
      var p = byId[id];
      if (on && p && brain.pets.indexOf(p) >= 0) {
        if (p.state === 'perform') finishSeat(p, true);
        if (p.state === 'dance') finishDancer(p, true, null);
        clearMotion(p); p.state = 'idle';
        brain.pets.splice(brain.pets.indexOf(p), 1);
        away[id] = p;
        reindex();
      } else if (!on && away[id]) { delete away[id]; delete byId[id]; }
      return !!away[id];
    };
    brain.isAway = function (id) { return !!away[id]; };
    /* host pet `id` (active) along world points pts → its arrival cell; pts null = it appears there at
       once with one sparkle. o {speed, hop (sparkle-hop to pts[0] first, at hopAt s), cell} */
    brain.arrive = function (id, pts, o) {
      o = o || {};
      if (!g()) return false;
      var p = away[id] || byId[id];
      if (away[id]) delete away[id];
      if (!p) { p = newPet(id, brain.pets.length); }
      byId[id] = p;
      if (brain.pets.indexOf(p) < 0) brain.pets.push(p);
      brain.pets.forEach(function (q) { q.active = q === p; });
      p.isNew = false;
      if (p.state === 'perform') finishSeat(p, true);
      clearMotion(p);
      reindex();
      var fr = brain.frame, cell = o.cell >= 0 ? o.cell : -1;
      if (!pts || pts.length < 6 || cell < 0) {
        if (cell < 0) cell = brain.entryPts(o.from || { x: fr.ox, y: fr.oy, z: fr.oz }, []);
        if (cell < 0) return false;
        place(p, cell); reserve(p, cell); p.state = 'idle'; p.yaw = brain.camYaw; p.nextAt = brain.now + IDLE.first;
        brain.events.push({ type: 'spawn', id: p.id, x0: p.x, y0: p.y, z0: p.z, x: p.x, y: p.y, z: p.z });
        return true;
      }
      var loc = new Float64Array(pts.length);
      for (var i = 0; i < pts.length; i += 3) { loc[i] = pts[i] - fr.ox; loc[i + 1] = pts[i + 1] - fr.oy; loc[i + 2] = pts[i + 2] - fr.oz; }
      var cum = cumOf(loc);
      p.trav = { pts: loc, cum: cum, n: cum.length, total: cum[cum.length - 1], s: 0, seg: 1, speed: Math.max(0.5, o.speed || CROSS.walk),
                 t0: brain.now, hop: !!o.hop, hopAt: o.hop ? Math.max(0, o.hopAt || 0) : 0, cell: cell, q: null };
      p.state = 'travel'; p.action = 'travel'; p.cruise = p.trav.speed;
      if (!o.hop) { p.x = loc[0]; p.y = loc[1]; p.z = loc[2]; }
      else if (o.at) { p.x = o.at.x - fr.ox; p.y = o.at.y - fr.oy; p.z = o.at.z - fr.oz; }
      reserve(p, cell);
      return true;
    };
    function travelStep(p, dt) {
      var tr = p.trav, P3 = tr.pts;
      if (tr.hop) {
        if (brain.now - tr.t0 < tr.hopAt) { p.speed = 0; p.omega = 0; return; }
        var x0 = p.x, y0 = p.y, z0 = p.z;
        tr.hop = false; p.x = P3[0]; p.y = P3[1]; p.z = P3[2];
        brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
      }
      tr.s = Math.min(tr.total, tr.s + tr.speed * dt);
      var k = tr.seg;
      while (k < tr.n - 1 && tr.cum[k] < tr.s) k++;
      tr.seg = k;
      var L0 = tr.cum[k] - tr.cum[k - 1], u = L0 > 1e-9 ? (tr.s - tr.cum[k - 1]) / L0 : 1, b = k * 3, a = b - 3;
      var nx = P3[a] + (P3[b] - P3[a]) * u, nz = P3[a + 2] + (P3[b + 2] - P3[a + 2]) * u;
      if ((nx - p.x) * (nx - p.x) + (nz - p.z) * (nz - p.z) > 1e-10) turnToward(p, Math.atan2(nx - p.x, nz - p.z), WALK.turn * 3, dt);
      p.x = nx; p.z = nz; p.y = P3[a + 1] + (P3[b + 1] - P3[a + 1]) * u;
      p.speed = tr.speed; p.cruise = tr.speed; p.cell = cellOf(p.x, p.z);
      if (tr.s >= tr.total - 1e-9) finishTravel(p);
    }
    /* a crossing cut short (edit mode, reduced motion, a dance): the pet appears on its cell with a sparkle */
    function landNow(p) {
      var x0 = p.x, y0 = p.y, z0 = p.z;
      p.trav.q = null; p.trav.s = p.trav.total;
      finishTravel(p);
      brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
    }
    function finishTravel(p) {
      var tr = p.trav, cell = tr.cell, q = tr.q;
      p.trav = null;
      if (!g().walk[cell] || (res[cell] >= 0 && res[cell] !== p.index)) cell = nearestFree(g(), p.x, p.z, res, p.index, g().largest);
      if (cell >= 0) { place(p, cell); reserve(p, cell); }
      p.state = 'idle'; p.action = ''; p.speed = 0; p.nextAt = brain.now + IDLE.first;
      if (q && g().objects[q.uid] && brain.mode === 'play') perform(q.kind, q.uid, p.id, q.o);
    }

    /* ---------- dance breaks and the group performances ---------- */
    function firstItem(id) {
      var items = g().items;
      for (var k = 0; k < items.length; k++) if (items[k].id === id) return items[k];
      return null;
    }
    /* the Dance Studio floor: its entrance cells, the cells beside them, then the row in front */
    function studioSpots(ob) {
      var gr = g(), row = ob.r + ob.h, cand = [], out = [], dx;
      for (dx = 0; dx < ob.w; dx++) cand.push(cellIndex(ob.c + dx, row));
      cand.push(cellIndex(ob.c - 1, row), cellIndex(ob.c + ob.w, row));
      for (dx = -1; dx <= ob.w; dx++) cand.push(cellIndex(ob.c + dx, row + 1));
      cand.forEach(function (i) { if (i >= 0 && gr.walk[i] && out.indexOf(i) < 0) out.push(i); });
      return out;
    }
    /* a Concert Stage deck mark k (the inner pair first): the model's live 'mark0'–'mark3' anchors
       through the island's anchor function when it has them on the deck, else the STAGE constants */
    function stageMark(ob, k) {
      var m = { x: 0, y: 0, z: 0 };
      if (anchorFn && anchorAt(ob, 'mark' + STAGE.markOrder[k], STAGE.y + 0.3, m) && Math.abs(m.y - (ob.y + STAGE.y)) <= 0.12) return m;
      m.x = ob.x + STAGE.xs[k]; m.y = ob.y + STAGE.y; m.z = ob.z + STAGE.z;
      return m;
    }
    /* the Concert Stage's approach cells: the crowd pit (entrance), then beside its front corners */
    function stageApproaches(ob) {
      var gr = g(), row = ob.r + ob.h, cand = [], out = [];
      for (var dx = 0; dx < ob.w; dx++) cand.push(cellIndex(ob.c + dx, row));
      cand.push(cellIndex(ob.c - 1, row - 1), cellIndex(ob.c + ob.w, row - 1), cellIndex(ob.c - 1, row), cellIndex(ob.c + ob.w, row));
      cand.forEach(function (i) { if (i >= 0 && gr.walk[i] && out.indexOf(i) < 0) out.push(i); });
      return out;
    }
    /* n distinct open, unreserved cells: the preferred ones first, then the nearest open cells
       round the `around` cells (default: the preferred ones) */
    function pickSpots(n, preferred, around) {
      var gr = g(), out = [], cx = 0, cz = 0, i;
      for (i = 0; i < preferred.length && out.length < n; i++) if (res[preferred[i]] < 0 && out.indexOf(preferred[i]) < 0) out.push(preferred[i]);
      around = around && around.length ? around : preferred;
      if (out.length >= n || !around.length) return out;
      around.forEach(function (c) { cx += centreX(c); cz += centreZ(c); });
      cx /= around.length; cz /= around.length;
      var list = [];
      for (i = 0; i < NCELL; i++) {
        if (!gr.walk[i] || out.indexOf(i) >= 0 || res[i] >= 0) continue;
        var dx = centreX(i) - cx, dz = centreZ(i) - cz;
        list.push({ i: i, d: dx * dx + dz * dz + (gr.largest && gr.comp[i] !== gr.largest ? 4 : 0) });
      }
      list.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
      for (i = 0; i < list.length && out.length < n; i++) out.push(list[i].i);
      return out;
    }
    /* send a dancer to ground cell sc within `budget` s (time-driven, so everyone is on the spot
       by count 1); → its gather time */
    function gatherCell(p, sc, budget) {
      var gr = g();
      clearMotion(p);
      p.state = 'dance'; p.action = 'dance'; p.danceSpot = sc;
      reserve(p, sc);
      var here = cellOf(p.x, p.z), t = 0, path;
      if (here === sc) path = finishPath([p.x, centreX(sc)], [p.z, centreZ(sc)], [sc], sc);   /* just step to the centre */
      else path = planTo(p, sc, -1);
      if (path && path.total > 0.02) {
        var cruise = Math.max(WALK.speed, path.total / budget);
        if (cruise > WALK.zip) { popTo(p, sc, 'pop'); p.state = 'dance'; p.action = 'dance'; p.danceSpot = sc; }
        else {
          p.path = path; p.pathS = 0; p.seg = 1; p.cruise = cruise;
          p.gatherT0 = brain.now; p.gatherDur = Math.max(0.2, path.total / cruise);
          t = p.gatherDur;
        }
      } else if (!path && here !== sc) { popTo(p, sc, 'pop'); p.state = 'dance'; p.action = 'dance'; p.danceSpot = sc; }
      else { p.x = centreX(sc); p.z = centreZ(sc); p.cell = sc; p.y = heightAt(gr, p.x, p.z); }
      return t;
    }
    /* send a dancer up onto a stage mark: to approach cell a, then a hop; → when it stands on the mark */
    function gatherMark(p, a, m) {
      var gr = g(), pf = p.perf, t = 0;
      if (brain.reduced) {                                /* reduced: it simply appears on its mark */
        var x0 = p.x, y0 = p.y, z0 = p.z;
        clearMotion(p);
        p.state = 'dance'; p.action = 'dance'; p.danceSpot = -1;
        reserve(p, a);
        p.x = m.x; p.y = m.y; p.z = m.z; p.onSeat = 'stage'; p.hop = 1;
        brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
      } else {
        t = gatherCell(p, a, DANCE.gatherMax - 0.15 - HOP.on);
        p.danceSpot = -1;
        pf.hopDur = HOP.on; pf.hopH = HOP.h; pf.hopT0 = brain.now + t;
        pf.ax = centreX(a); pf.az = centreZ(a); pf.ay = heightAt(gr, pf.ax, pf.az);
        t += HOP.on;
      }
      p.danceApproach = a;
      p.mark.x = m.x; p.mark.y = m.y; p.mark.z = m.z; p.danceMark = p.mark;
      return t;
    }
    /* a dancer off the floor: down from its mark (instantly, or a hop when the dance just ended) */
    function startMarkHopOff(p) {
      var gr = g(), pf = p.perf, l = freeFor(p, p.danceApproach) ? p.danceApproach : nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
      if (l < 0 || brain.reduced) { finishDancer(p, true, 1.5 + rng() * 2); return; }
      pf.land = l; pf.lx = centreX(l); pf.lz = centreZ(l); pf.ly = heightAt(gr, pf.lx, pf.lz);
      pf.hopT0 = brain.now; pf.hopDur = HOP.off; pf.hopH = HOP.h;
      p.perfPhase = 'hopOff';
      reserve(p, l);
    }
    function finishDancer(p, instant, nextIn) {
      if (instant && p.danceMark && (p.onSeat || p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff')) {
        var gr = g(), l = freeFor(p, p.danceApproach) ? p.danceApproach : nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
        if (l >= 0) { place(p, l); reserve(p, l); }
      }
      toIdle(p, nextIn);
    }
    function endDance(instant) {
      brain.pets.forEach(function (p) { if (p.state === 'dance') finishDancer(p, instant, 1 + rng() * 2); });
      brain.danceOn = false;
      brain.avatarMark.on = false; brain.avatarMark.cell = -1;
    }
    /* kind 'break' (the Showtime dance break: by the house, or on a Dance Studio's floor),
       'studio' or 'stage'. o = {beat, bpm, perBar}; avatar = the avatar joins (studio / stage) */
    function startDance(kind, ob, o, avatar) {
      var gr = g(), am = brain.avatarMark;
      brain.pets.forEach(function (p) { if (p.state === 'travel') landNow(p); if (p.state === 'perform') finishSeat(p, true); });
      if (brain.danceOn) endDance(true);
      brain.danceOn = true; brain.danceReduced = brain.reduced; brain.danceKind = kind; brain.danceUid = ob ? ob.uid : '';
      danceOb.x = ob ? ob.x : 0; danceOb.z = ob ? ob.z : 0;
      am.on = false; am.cell = -1; am.kind = kind; am.uid = brain.danceUid;
      var studio = kind === 'studio' ? ob : kind === 'break' ? firstItem('bld_dance') : null;
      var preferred = studio ? studioSpots(studio) : [], around = preferred.slice(), gather = 0;
      if (avatar && kind === 'stage') { am.on = true; am.x = ob.x + STAGE.me[0]; am.y = ob.y + STAGE.me[1]; am.z = ob.z + STAGE.me[2]; }
      if (avatar && kind === 'studio' && !brain.reduced && preferred.length) {
        am.on = true; am.cell = preferred.shift(); am.x = centreX(am.cell); am.z = centreZ(am.cell); am.y = heightAt(gr, am.x, am.z);
      }
      if (brain.reduced && kind !== 'stage') {             /* reduced: one freeze pose where everyone stands */
        brain.danceT0 = brain.now; brain.danceEnd = brain.now + DANCE.reducedDur;
        brain.pets.forEach(function (p) {
          clearMotion(p); p.state = 'dance'; p.action = 'dance'; p.danceSpot = p.cell;
          p.desiredYaw = brain.camYaw; p.hasDesired = true; p.faceCam = 1;
        });
        return;
      }
      res.fill(-1);
      if (am.on && am.cell >= 0) res[am.cell] = AVATAR_RES;
      holdVisitor();
      var left = brain.pets.slice();
      function nearestPet(x, z) {
        var bi = -1, bd = Infinity;
        left.forEach(function (p, k) { var dx = p.x - x, dz = p.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = k; } });
        return bi < 0 ? null : left.splice(bi, 1)[0];
      }
      if (kind === 'stage') {
        var approaches = stageApproaches(ob), used = [];
        for (var k = 0; k < STAGE.xs.length && left.length; k++) {
          var m = stageMark(ob, k), a = -1, ad = Infinity;
          approaches.forEach(function (c) {
            if (used.indexOf(c) >= 0) return;
            var dx = centreX(c) - m.x, dz = centreZ(c) - m.z, d = dx * dx + dz * dz;
            if (d < ad) { ad = d; a = c; }
          });
          if (a < 0) break;                                /* the pit is full: the rest dance on the ground */
          used.push(a);
          gather = Math.max(gather, gatherMark(nearestPet(m.x, m.z), a, m));
        }
        preferred = approaches.filter(function (c) { return used.indexOf(c) < 0; });
        around = approaches;
      }
      if (left.length && !brain.reduced) {
        var vsc = brain.visitor ? brain.visitor.cell : -1;            /* never the visitor's cell (IA-3) */
        var spots = around.length ? pickSpots(left.length, preferred, around) :
          danceSpots(gr, left.length + (vsc >= 0 ? 1 : 0), res).filter(function (c) { return c !== vsc; }).slice(0, left.length);
        spots.forEach(function (sc) {
          var p = nearestPet(centreX(sc), centreZ(sc));
          if (p) gather = Math.max(gather, gatherCell(p, sc, DANCE.gatherMax - 0.15));
        });
      }
      left.forEach(function (p) {                       /* no spot (a full island): dance where it stands */
        clearMotion(p); p.state = 'dance'; p.action = 'dance'; p.danceSpot = cellOf(p.x, p.z);
        reserve(p, freeFor(p, p.danceSpot) ? p.danceSpot : -1);
      });
      if (brain.reduced) { brain.danceT0 = brain.now; brain.danceEnd = brain.now + DANCE.reducedDur; return; }
      gather = Math.min(DANCE.gatherMax, gather);
      var delay = alignDelay(gather, o.beat, o.bpm, o.perBar !== false);
      if (delay > gather + 4 * 60 / DANCE.bpm + 1e-6) delay = gather;      /* a stale clock never stalls the dance */
      brain.danceT0 = brain.now + delay;
      brain.danceEnd = brain.danceT0 + DANCE.dur + DANCE.hold;
    }
    function dance(on, o) {
      o = o || {};
      var gr = g();
      if (!on) { if (brain.danceOn) endDance(true); return 0; }
      if (!gr || !brain.pets.length || brain.mode !== 'play' || playBusy()) return 0;      /* the dance break waits for fetch / hide (IA-3) */
      startDance('break', null, o, false);
      return brain.danceReduced ? DANCE.reducedDur : brain.danceEnd - brain.now;
    }
    /* the Dance Studio and the Concert Stage: every pet joins; → the lead to count 1 (a re-tap of
       the same building keeps the dance going) */
    function performGroup(kind, ob, o) {
      if (brain.danceOn && brain.danceKind === kind && brain.danceUid === ob.uid) return Math.max(0, brain.danceT0 - brain.now);
      if (playBusy()) return -1;                                   /* a fetch / hide is on: the building plays alone (IA-3) */
      if (kind === 'studio' && !brain.reduced && !studioSpots(ob).length) return -1;
      if (kind === 'stage' && !stageApproaches(ob).length) return -1;
      startDance(kind, ob, o, !!o.avatar);
      return Math.max(0, brain.danceT0 - brain.now);
    }
    function danceStep(p, dt) {
      var pf = p.perf, now = brain.now, m = p.danceMark;
      if (p.path) {
        var path = p.path, u = clamp01((now - p.gatherT0) / p.gatherDur);
        samplePath(path, path.total * smooth01(u), _sp, p.seg);
        var mx = _sp.x - p.x, mz = _sp.z - p.z, mv = Math.sqrt(mx * mx + mz * mz);
        p.seg = _sp.seg; p.x = _sp.x; p.z = _sp.z; p.y = heightAt(g(), p.x, p.z); p.cell = cellOf(p.x, p.z);
        p.speed = dt > 0 ? mv / dt : 0;
        if (mv > 1e-6) turnToward(p, Math.atan2(mx, mz), WALK.turn * 2, dt); else p.omega = 0;
        if (u >= 1) { p.path = null; p.speed = 0; reserve(p, p.danceSpot >= 0 ? p.danceSpot : p.danceApproach); }
        return;
      }
      if (m && !p.onSeat && p.perfPhase !== 'hopOff') {     /* up onto the stage mark */
        p.speed = 0;
        if (now < pf.hopT0) { turnToward(p, Math.atan2(m.x - p.x, m.z - p.z), WALK.turn * 2, dt); return; }
        var v = clamp01((now - pf.hopT0) / pf.hopDur);
        p.perfPhase = 'hopOn'; p.hop = v;
        p.x = pf.ax + (m.x - pf.ax) * v; p.z = pf.az + (m.z - pf.az) * v;
        p.y = pf.ay + (m.y - pf.ay) * v + pf.hopH * arc(v);
        turnToward(p, Math.atan2(m.x - pf.ax, m.z - pf.az) || p.yaw, WALK.turn * 2, dt);
        if (v >= 1) {
          p.onSeat = 'stage'; p.perfPhase = ''; p.hop = 1; p.x = m.x; p.y = m.y; p.z = m.z;
          brain.events.push({ type: 'land', id: p.id, kind: 'stage', x: p.x, y: p.y, z: p.z });
        }
        return;
      }
      if (m && p.perfPhase === 'hopOff') {                  /* down again after the freeze */
        var w = clamp01((now - pf.hopT0) / pf.hopDur);
        p.hop = 1 - w; p.onSeat = '';
        p.x = m.x + (pf.lx - m.x) * w; p.z = m.z + (pf.lz - m.z) * w;
        p.y = m.y + (pf.ly - m.y) * w + pf.hopH * arc(w);
        turnToward(p, Math.atan2(pf.lx - m.x, pf.lz - m.z) || p.yaw, WALK.turn * 2, dt);
        if (w >= 1) { p.x = pf.lx; p.z = pf.lz; p.y = pf.ly; toIdle(p, 1.5 + rng() * 2); }
        return;
      }
      if (m) { p.x = m.x; p.y = m.y; p.z = m.z; }
      p.speed = 0;
      turnToward(p, brain.camYaw, WALK.turn, dt);
      if (now >= brain.danceEnd) {
        if (m && p.onSeat) startMarkHopOff(p);
        else toIdle(p, 1.5 + rng() * 2);
      }
    }

    /* ---------- the per-frame step ---------- */
    function stepPet(p, dt) {
      var now = brain.now;
      if (p.state === 'sit') { p.speed = 0; p.omega = 0; return; }
      if (now < p.pauseUntil && (p.state === 'walk' || p.state === 'idle' || p.state === 'act')) {
        p.speed = 0;
        if (p.hasDesired) turnToward(p, p.desiredYaw, WALK.turn, dt); else p.omega = 0;
        return;
      }
      switch (p.state) {
        case 'idle':
          p.speed = 0;
          if (p.hasDesired) turnToward(p, p.desiredYaw, WALK.turn, dt); else p.omega = 0;
          if (now >= p.nextAt && brain.mode === 'play' && !brain.danceOn) { p.hasDesired = false; decide(p); }
          break;
        case 'walk': follow(p, dt, p.cruise, WALK.accel); break;
        case 'act': actStep(p, dt); break;
        case 'perform': performStep(p, dt); break;
        case 'dance': danceStep(p, dt); break;
        case 'travel': travelStep(p, dt); break;
        case 'fetch': fetchStep(p, dt); break;
        case 'hide': hideStep(p, dt); break;
      }
    }
    function step(dt) {
      dt = typeof dt === 'number' && isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
      brain.now += dt;
      if (!brain.graph) return false;
      if (brain.danceOn && brain.now >= brain.danceEnd) {
        brain.danceOn = false;
        if (brain.avatarMark.on) { brain.avatarMark.on = false; if (brain.avatarMark.cell >= 0 && res[brain.avatarMark.cell] === AVATAR_RES) res[brain.avatarMark.cell] = -1; brain.avatarMark.cell = -1; }
      }
      var moving = visitorStep(dt);
      for (var k = 0; k < brain.pets.length; k++) {
        var p = brain.pets[k];
        stepPet(p, dt);
        if (p.speed > 0.001 || Math.abs(p.omega) > 0.001 || p.state === 'perform' || p.state === 'dance' || p.state === 'act' || p.state === 'travel' ||
            p.state === 'fetch' || (p.state === 'hide' && p.action === 'hideGo')) moving = true;
      }
      return moving;
    }

    /* ---------- sync: layout / pets / mode ---------- */
    function spawnCell(p, avoid) {
      var gr = g(), cand = [], ox = gr.avatar >= 0 ? gr.avatarX + 0.5 : 0, oz = gr.avatar >= 0 ? gr.avatarZ + 1 : 0;
      for (var i = 0; i < NCELL; i++) {
        if (!gr.walk[i] || res[i] >= 0) continue;
        if (gr.largest && gr.comp[i] !== gr.largest) continue;
        var dx = centreX(i) - ox, dz = centreZ(i) - oz, d = Math.sqrt(dx * dx + dz * dz);
        var near = 9;
        avoid.forEach(function (j) { var ex = centreX(i) - centreX(j), ez = centreZ(i) - centreZ(j); near = Math.min(near, Math.sqrt(ex * ex + ez * ez)); });
        if (near < 1.5) d += 6;
        cand.push({ i: i, d: d + rng() * 2.5 });
      }
      if (!cand.length) return nearestFree(gr, ox, oz, res, p.index, 0);
      cand.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
      return cand[0].i;
    }
    /* where a land's own mascots come out (D112): the free, unreserved square nearest the landmark's
       'spot' (its live anchor; else in front of the landmark; else the island's centre) */
    function guestCell(p) {
      var gr = g(), lm = isleDef && isleDef.landmark, ob = null, k, s = _an;
      for (k = 0; lm && k < gr.items.length; k++) if (gr.items[k].id === lm) { ob = gr.items[k]; break; }
      if (!ob || !anchorV3(ob, 'spot', s)) {
        var c = isleDef && isleDef.centre;
        s.x = ob ? ob.x : c ? c[0] - 7.5 : 0; s.z = ob ? ob.z + ob.h / 2 + 0.5 : c ? c[1] - 4.5 : 0;
      }
      return nearestFree(gr, s.x, s.z, res, p.index, gr.largest);
    }
    /* a sky island's land, occupancy and placements from the world (or a view's isles list) */
    function readIsle(input) {
      var w = input.world || null, Cc = core(Cx), isle = brain.isle;
      var world = w && w.world && Array.isArray(w.world.placed) ? w.world : w && w.owned && Array.isArray(w.placed) ? w : null;
      var placed = Array.isArray(input.placed) && input.land ? input.placed : world && Cc && Cc.placedOn ? Cc.placedOn(world, isle) :
        w && w.isles && Array.isArray(w.isles[isle]) ? w.isles[isle] : [];
      var land = input.land || (world && Cc && Cc.landSetOf ? Cc.landSetOf(world, isle) : null);
      if (!land) { land = {}; ((Cc && Cc.ISLE_CELLS && Cc.ISLE_CELLS[isle]) || []).forEach(function (k) { land[k] = 1; }); }
      var occ = input.occ || (world && Cc && Cc.occupancy ? Cc.occupancy(world, null, isle).occ : null);
      var src = occ ? { land: land, occ: occ, placed: placed } : { land: land, placed: placed };
      var dc = dockCell(0);
      return { src: src, mode: input.mode || (w && typeof w.mode === 'string' ? w.mode : null) || brain.mode || 'play',
               pets: Array.isArray(input.pets) ? input.pets : [], avatar: input.avatar !== undefined ? input.avatar : dc >= 0 ? dc : null, activePet: null };
    }
    function readInput(input) {
      input = input || {};
      if (isleDef) return readIsle(input);
      var w = input.world || null, src = null;
      if (w && w.world && Array.isArray(w.world.placed)) src = w.world;          /* a view wrapping the world */
      else if (w && Array.isArray(w.placed)) src = w;
      else if (Array.isArray(input.placed) || input.land) src = input;
      if (!src) src = { placed: [] };
      if (!src.owned && !src.land && !Array.isArray(src.unlocked)) {
        var unlocked = (w && Array.isArray(w.unlocked)) ? w.unlocked : Array.isArray(input.unlocked) ? input.unlocked : null;
        if (unlocked) src = { placed: src.placed, unlocked: unlocked };
      }
      var mode = input.mode || (w && typeof w.mode === 'string' ? w.mode : null) || brain.mode || 'play';
      return { src: src, mode: mode, pets: Array.isArray(input.pets) ? input.pets : [], avatar: input.avatar, activePet: src.activePet || (w && w.activePet) || null };
    }
    /* is a performance still valid on this layout (its item there, unmoved, its cell still free)? */
    function performStillValid(p, gr) {
      var pf = p.perf, ob = gr.objects[pf.uid], spec = PERFORMS[pf.kind];
      if (!ob || (!pf.route && pf.kind !== 'bounce' && (!spec || ob.id !== spec.id)) || Math.abs(ob.x - pf.obx) > 1e-6 || Math.abs(ob.z - pf.obz) > 1e-6) return false;
      var tgt = pf.land >= 0 ? pf.land : pf.approach;
      return tgt < 0 || gr.walk[tgt] === 1;
    }
    function sync(input) {
      var r = readInput(input), out = { added: [], removed: [], popped: [] };
      var first = !brain.synced;
      brain.graph = buildGraph(r.src, { avatar: r.avatar === undefined ? undefined : r.avatar, C: Cx, G: Gx, heights: heights });
      var gr = brain.graph;
      /* the pet list: keep order, drop the gone, add the new (a pet away on another island stays away) */
      var ids = [], seen = {}, awayActive = false;
      r.pets.forEach(function (rec) {
        var id = typeof rec === 'string' ? rec : rec && rec.id;
        if (typeof id !== 'string' || seen[id]) return;
        seen[id] = 1;
        var guest = !!(rec && rec.guest), act = !guest && (!!(rec && rec.active) || id === r.activePet);
        if (away[id]) { away[id].active = act; awayActive = awayActive || act; return; }
        ids.push({ id: id, active: act, guest: guest, mood: rec && rec.mood });
      });
      Object.keys(away).forEach(function (id) { if (!seen[id]) { delete away[id]; delete byId[id]; } });
      brain.pets.filter(function (p) { return !seen[p.id]; }).forEach(function (p) { out.removed.push(p.id); delete byId[p.id]; });
      var next = [];
      ids.forEach(function (e, k) {
        var p = byId[e.id];
        if (!p) { p = newPet(e.id, k); p.isNew = true; byId[e.id] = p; out.added.push(e.id); }
        p.index = k; p.active = e.active; p.guest = e.guest;
        p.mood = moodOf(e.mood); p.moodK = p.mood ? MOOD.cruise[p.mood.hunger] : 1;
        next.push(p);
      });
      if (next.length && !awayActive && !next.some(function (p) { return p.active; })) {
        for (var nk = 0; nk < next.length; nk++) if (!next[nk].guest) { next[nk].active = true; break; }
      }
      brain.pets = next;
      /* a studio / stage dance whose building moved or went away ends now */
      if (brain.danceOn && brain.danceUid) {
        var dob = gr.objects[brain.danceUid];
        if (!dob || Math.abs(dob.x - danceOb.x) > 1e-6 || Math.abs(dob.z - danceOb.z) > 1e-6) endDance(true);
      }
      rebuildReservations();
      /* place new pets (spread out, near the house) */
      var taken = [];
      brain.pets.forEach(function (p) { if (!p.isNew && p.cell >= 0) taken.push(p.cell); });
      brain.pets.forEach(function (p) {
        if (!p.isNew) return;
        p.isNew = false;
        var i = p.guest && isleDef ? guestCell(p) : spawnCell(p, taken);
        if (i < 0) return;
        place(p, i); reserve(p, i); taken.push(i);
        p.yaw = wrap(brain.camYaw + (rng() - 0.5) * 1.2);
        p.state = brain.mode === 'play' ? 'idle' : 'sit';
        p.nextAt = brain.now + IDLE.first + p.index * IDLE.stagger;
        if (!first) { brain.events.push({ type: 'spawn', id: p.id, x0: p.x, y0: p.y, z0: p.z, x: p.x, y: p.y, z: p.z }); }
      });
      /* validate everyone against the new layout (a crossing pet only needs a free arrival cell) */
      brain.pets.forEach(function (p) {
        if (p.state === 'travel') {
          if (!gr.walk[p.trav.cell]) p.trav.cell = nearestFree(gr, centreX(p.trav.cell), centreZ(p.trav.cell), res, p.index, gr.largest);
          return;
        }
        if (p.state === 'fetch' || p.state === 'hide') {          /* IA-3: a fetch / hide goes on while its way is still open */
          if (playStillValid(p, gr)) return;
          stopPlay(p); toIdle(p, null);
        }
        if (p.state === 'perform') {
          if (performStillValid(p, gr)) return;
          finishSeat(p, true);
        }
        if (p.state === 'dance' && p.danceMark) {
          if ((p.onSeat || p.perfPhase === 'hopOn' || p.perfPhase === 'hopOff') && gr.walk[p.danceApproach]) return;
          if (p.onSeat || p.perfPhase) finishDancer(p, true, 1);
        }
        var c = cellOf(p.x, p.z);
        if (c < 0 || !gr.walk[c]) {
          var nf = nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
          if (nf >= 0) { popTo(p, nf); out.popped.push(p.id); if (brain.mode !== 'play') p.state = 'sit'; }
          return;
        }
        if (gr.compSize[gr.comp[c]] <= 1 && gr.compSize[gr.largest] > 1) {      /* fully enclosed */
          var nf2 = nearestFree(gr, p.x, p.z, res, p.index, gr.largest);
          if (nf2 >= 0 && nf2 !== c) { popTo(p, nf2); out.popped.push(p.id); if (brain.mode !== 'play') p.state = 'sit'; }
          return;
        }
        p.y = heightAt(gr, p.x, p.z);
        var path = p.path;
        if (p.state === 'dance' && p.danceSpot >= 0 && (!gr.walk[p.danceSpot] || (path && !pathValid(gr, path, p.pathS, null, c)))) {
          var ds = gr.walk[p.danceSpot] ? p.danceSpot : nearestFree(gr, centreX(p.danceSpot), centreZ(p.danceSpot), res, p.index, gr.largest);
          if (ds >= 0) { popTo(p, ds); p.state = 'dance'; p.action = 'dance'; p.danceSpot = ds; out.popped.push(p.id); }
          return;
        }
        if (p.state === 'dance' && p.danceMark && path && !pathValid(gr, path, p.pathS, null, c)) { finishDancer(p, true, 1); return; }
        if (path && p.state === 'walk') {
          var ok = gr.walk[path.target] && pathValid(gr, path, p.pathS, null, c) && (res[path.target] < 0 || res[path.target] === p.index);
          if (!ok) {
            var target = path.target;
            if (!gr.walk[target] || (res[target] >= 0 && res[target] !== p.index)) target = nearestFree(gr, centreX(target), centreZ(target), res, p.index, gr.comp[c]);
            var np = target >= 0 ? planTo(p, target, -1) : null;
            if (np && np.total > 0.05) { p.path = np; p.pathS = 0; p.seg = 1; reserve(p, target); }
            else toIdle(p, null);
          }
        }
      });
      validateVisitor(gr);
      setMode(r.mode);
      rebuildReservations();
      brain.synced = true;
      return out;
    }
    function setMode(mode) {
      mode = mode === 'edit' || mode === 'place' ? mode : 'play';
      if (mode === brain.mode) return;
      var wasPlay = brain.mode === 'play';
      brain.mode = mode;
      if (mode !== 'play') {
        if (brain.danceOn) dance(false);
        brain.pets.forEach(function (p) {
          stopPlay(p);                                          /* IA-3: editing ends a fetch / hide */
          if (p.state === 'travel') landNow(p);
          if (p.state === 'perform') finishSeat(p, true);
          if (p.state === 'dance') finishDancer(p, true, null);
          var c = cellOf(p.x, p.z);
          clearMotion(p);
          p.state = 'sit'; p.action = 'sit'; p.cell = c;
          reserve(p, freeFor(p, c) ? c : -1);
        });
      } else if (!wasPlay) {
        brain.pets.forEach(function (p, k) { if (p.state === 'sit') { p.state = 'idle'; p.action = ''; p.nextAt = brain.now + IDLE.first + k * IDLE.stagger; } });
      }
    }
    function setReduced(on) {
      on = !!on;
      if (on === brain.reduced) return;
      brain.reduced = on;
      if (on) {
        if (brain.danceOn) dance(false);
        brain.pets.forEach(function (p) {
          endPlayNow(p);                                        /* IA-3: a fetch / hide jumps to its end state */
          if (p.state === 'travel') landNow(p);
          if (p.state === 'perform') finishSeat(p, true);
          if (p.state === 'dance') finishDancer(p, true, IDLE.first);
          if (p.state === 'walk' || p.state === 'act') toIdle(p, IDLE.first);
        });
      }
    }
    /* tap(id, out?) → the emote kind ('' = no such pet); out.kind = the emote, out.tap = the species'
       tap reaction (also pet.tapKind). A mascot mid play move keeps playing (the voice, the emote
       and the happy tail answer the tap), so a turning move never jumps. */
    function tap(id, out) {
      var p = byId[id];
      if (!p) return '';
      var kind = p.species === 'pet_dragon' ? 'sparkle' : pick(EMOTES);
      var hungry = !!p.mood && p.mood.hunger >= 2;
      if (!hungry) p.happyUntil = brain.now + 2.5;
      p.tapKind = hungry ? 'hungry' : tapOf(p.species);
      if (!brain.reduced && (p.state === 'idle' || p.state === 'walk' || (p.state === 'act' && !PLAY_MOVES[p.action]))) {
        p.tapT = brain.now; p.pauseUntil = brain.now + 0.45;
        if (p.state !== 'walk') { p.desiredYaw = brain.camYaw; p.hasDesired = true; }
      } else if (brain.reduced) { p.desiredYaw = brain.camYaw; p.hasDesired = true; }
      if (out && typeof out === 'object') { out.kind = kind; out.tap = p.tapKind; }
      return kind;
    }

    /* ---------- feeding (KIDS UPDATE P2.5; decision P21, pets.json moodAndEating) ----------
       feed(id, {fav}?) → the seconds until the pet starts eating (the bowl's pop and the meal's drop,
       then its hop over) | -1 (no such pet on this island, away, a land's guest, travelling, edit
       mode). Whatever the pet was doing stops (a seat or a dance lets it down first). p.feed holds
       the moment for actors.js: the bowl at (x, y, z) facing yaw, t0, eat0 (eating starts), eatEnd,
       end (the bowl is gone), fav, reduced. Under reduced motion it is the end state at once (lead 0):
       the pet faces the bowl, the bowl stands empty for FEED.still s and the 'fed' event fires now. */
    var _bs = { x: 0, z: 0, yaw: 0 };
    /* the bowl (FEED.r round its centre) stands wholly on open land, clear of the other pets */
    function roomFor(gr, x, z) {
      for (var cx = -1; cx <= 1; cx += 2) for (var cz = -1; cz <= 1; cz += 2) { var c = cellOf(x + cx * FEED.r, z + cz * FEED.r); if (c < 0 || !gr.walk[c]) return false; }
      for (var k = 0; k < brain.pets.length; k++) { var q = brain.pets[k]; if ((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < FEED.reach * FEED.reach) return false; }
      return true;
    }
    function bowlSpot(p, out) {
      var gr = g();
      for (var k = 0; k < FEED.dirs.length; k++) {
        var a = brain.camYaw + FEED.dirs[k], bx = p.x + Math.sin(a) * FEED.dist, bz = p.z + Math.cos(a) * FEED.dist, bc = cellOf(bx, bz);
        if (bc < 0 || !freeFor(p, bc) || !losClear(gr, p.x, p.z, bx, bz, null, 0, -1) || !roomFor(gr, bx, bz)) continue;
        out.x = bx; out.z = bz; out.yaw = a;
        return true;
      }
      out.yaw = p.yaw; out.x = p.x + Math.sin(p.yaw) * FEED.reach; out.z = p.z + Math.cos(p.yaw) * FEED.reach;   /* no room: right under its nose */
      return false;
    }
    function feed(id, o) {
      o = o || {};
      var p = byId[id], gr = g();
      if (!p || !gr || away[id] || p.guest || p.state === 'travel' || brain.mode !== 'play') return -1;
      if (p.state === 'perform') finishSeat(p, true);
      if (p.state === 'dance') finishDancer(p, true, null);
      toIdle(p, null);
      var room = bowlSpot(p, _bs), f = p.feed || (p.feed = {}), now = brain.now, red = brain.reduced;
      var hop = room ? FEED.dist - FEED.reach : 0;
      f.on = true; f.fav = !!o.fav; f.reduced = red; f.t0 = now;
      f.x = _bs.x; f.z = _bs.z; f.y = heightAt(gr, _bs.x, _bs.z); f.yaw = brain.camYaw;
      f.ax = p.x; f.az = p.z; f.hx = p.x + Math.sin(_bs.yaw) * hop; f.hz = p.z + Math.cos(_bs.yaw) * hop;
      f.eat0 = red ? now : now + FEED.hop[1]; f.eatEnd = red ? now : f.eat0 + FEED.eat;
      f.end = red ? now + FEED.still : f.eatEnd + FEED.out;
      p.desiredYaw = Math.atan2(f.x - p.x, f.z - p.z); p.hasDesired = true;
      p.nextAt = f.end + IDLE.first;
      if (red) { p.yaw = p.desiredYaw; fed(p); return 0; }
      p.state = 'act'; p.action = 'eatWait'; p.actT0 = now; p.actDur = FEED.hop[1]; p.actEnd = f.eat0;
      p.lookX = f.x; p.lookZ = f.z; p.lookK = 1; p.faceCam = 0;
      return FEED.hop[1];
    }
    /* the meal's end: one happy tap reaction (the species' own), and the event the stage cheers on */
    function fed(p) {
      var f = p.feed;
      p.state = 'idle'; p.action = ''; p.lookK = 0;
      p.tapKind = tapOf(p.species); p.happyUntil = brain.now + 2.5;
      if (!brain.reduced) { p.tapT = brain.now; p.pauseUntil = brain.now + 0.45; }
      reserve(p, freeFor(p, p.cell) ? p.cell : p.res);
      brain.events.push({ type: 'fed', id: p.id, fav: !!(f && f.fav), x: p.x, y: p.y, z: p.z });
    }
    /* eatWait: face the bowl while it pops in and fills, hop over (the 'hop' clip carries the height);
       eat: FEED.eat s nose in the bowl (actors nods the head at 1.5 Hz) */
    function feedStep(p, dt) {
      var f = p.feed, now = brain.now;
      turnToward(p, p.desiredYaw, WALK.turn, dt);
      if (p.action === 'eatWait') {
        var u = clamp01((now - f.t0 - FEED.hop[0]) / (FEED.hop[1] - FEED.hop[0])), k = smooth01(u);
        p.x = f.ax + (f.hx - f.ax) * k; p.z = f.az + (f.hz - f.az) * k; p.y = heightAt(g(), p.x, p.z);
        if (now >= p.actEnd) {
          p.x = f.hx; p.z = f.hz; p.cell = cellOf(p.x, p.z);
          startAct(p, 'eat', FEED.eat, { fx: f.x, fz: f.z });
          p.actEnd = f.eatEnd;
        }
        return;
      }
      if (now >= p.actEnd) fed(p);
    }

    /* ================================================================
       ISLAND ACTIVITIES v1 (IA-3): fetch, hide and seek, the visitor (see the header)
       ================================================================ */
    var _ball = { x: 0, y: 0, z: 0, phase: '' }, _vsp = { x: 0, z: 0, dx: 0, dz: 1, seg: 1 };
    function playing(p) { return !!p && (p.state === 'fetch' || p.state === 'hide' || !!(p.fetch && p.fetch.on) || !!(p.hide && p.hide.on)); }
    function playBusy() { for (var k = 0; k < brain.pets.length; k++) if (playing(brain.pets[k])) return true; return false; }
    function eating(p) { return p.state === 'act' && (p.action === 'eatWait' || p.action === 'eat'); }
    /* stop a pet's fetch or hide now (the ball drops where it is; a hiding pet stops hiding where it is) */
    function stopPlay(p) {
      if (p.fetch && p.fetch.on) { p.fetch.keep = false; cutFetch(p); }
      if (p.hide && p.hide.on) p.hide.on = false;
    }
    /* reduced motion: a fetch jumps to its end state; a pet on its way to hide is in its hiding place at once */
    function endPlayNow(p) {
      var f = p.fetch, h = p.hide;
      if (f && f.on) {
        f.keep = true; f.phase = 'end';
        if (p.state === 'perform') finishSeat(p, true);
        f.keep = false;
        fetchNow(p);
      }
      if (h && h.on && p.state === 'hide' && p.action === 'hideGo') hideAt(p);
    }
    /* the ball lands at (x, z) on the ground (a point off the land: under the pet) and lies there */
    function dropAt(p, f, x, z) {
      var gr = g(), c = cellOf(x, z);
      if (!gr || c < 0 || !gr.land[c]) { x = p.x; z = p.z; }
      f.held = false; f.dropped = true; f.dx = x; f.dz = z; f.dy = (gr ? heightAt(gr, x, z) : p.y) + FETCH.ballR;
    }
    function cutFetch(p) {
      var f = p.fetch;
      if (!f || !f.on) return;
      f.on = false; f.keep = false;
      if (!f.dropped) dropAt(p, f, p.x + Math.sin(p.yaw) * 0.25, p.z + Math.cos(p.yaw) * 0.25);
      f.phase = 'done';
      brain.events.push({ type: 'fetchCut', id: p.id, n: f.n, x: f.dx, y: f.dy, z: f.dz });
    }
    /* a trampoline (or a v3 net whose LOOK performs 'bounce') the pet bounces on for the ball, or '' */
    function bounceKindOf(ob) {
      if (ob.id === 'trampoline') return 'trampoline';
      var L = lookOf(ob.id);
      return L && L.perform === 'bounce' ? 'bounce' : '';
    }
    /* the race (or trot) to cell R is too long: a sparkle zip to ≤ 1.2 u from it, then a short dash */
    function zipTo(p, R) {
      var gr = g(), x0 = p.x, y0 = p.y, z0 = p.z, ax = centreX(R), az = centreZ(R), ddx = p.x - ax, ddz = p.z - az, dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
      var back = Math.min(1.2, dd), sx = ax + ddx / dd * back, sz = az + ddz / dd * back;
      if (!losClear(gr, sx, sz, ax, az, null, 0, -1)) { sx = ax; sz = az; }
      p.x = sx; p.z = sz; p.y = heightAt(gr, sx, sz); p.cell = cellOf(sx, sz);
      brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z });
      return finishPath([sx, ax], [sz, az], [cellOf(sx, sz), R], R);
    }
    /* the child's spot (the avatar's cell, else the throw's hand) and the free cell in front of it (toward the camera) */
    function childAt(f, out) {
      var gr = g();
      if (gr.avatar >= 0) { out.x = gr.avatarX; out.z = gr.avatarZ; } else { out.x = f ? f.hx : 0; out.z = f ? f.hz : 0; }
      return out;
    }
    var _ch = { x: 0, z: 0 };
    function backCell(p) {
      var gr = g(), c = childAt(p.fetch, _ch), here = cellOf(p.x, p.z), comp = here >= 0 && gr.walk[here] ? gr.comp[here] : gr.largest;
      var a = brain.camYaw + FETCH.side;                 /* in front of the child and to one side: both stay in view, and the ball */
      var B = nearestFree(gr, c.x + Math.sin(a) * FETCH.front, c.z + Math.cos(a) * FETCH.front, res, p.index, comp || gr.largest);
      return B >= 0 ? B : here;
    }
    function fetch(id, x, z, o) {
      o = o || {};
      var p = byId[id], gr = g();
      if (!p || !gr || away[id] || p.guest || brain.pets.indexOf(p) < 0 || p.state === 'travel' || brain.mode !== 'play') return -1;
      if (typeof x !== 'number' || typeof z !== 'number' || !isFinite(x) || !isFinite(z) || eating(p) || (p.fetch && p.fetch.on)) return -1;
      var here = cellOf(p.x, p.z), comp = here >= 0 && gr.walk[here] ? gr.comp[here] : gr.largest;
      var c = cellOf(x, z), onLand = c >= 0 && gr.land[c] === 1, ob = onLand && gr.obj[c] ? gr.objects[gr.obj[c].uid] : null;
      var bk = ob && !brain.reduced ? bounceKindOf(ob) : '', seat = null;
      if (bk) {
        seat = bk === 'bounce' ? anchorV3(ob, 'seat', { x: 0, y: 0, z: 0 }) : seatOf(ob, 'trampoline');
        var side = false;
        ob.adj.forEach(function (a) { if (res[a] < 0 || res[a] === p.index) side = true; });
        if (!seat || !side) bk = '';
      }
      /* the ball rests on the free cell nearest the tap (never a blocked or reserved one), in the pet's own part of the island */
      var R = bk ? -1 : nearestFree(gr, x, z, res, p.index, comp || gr.largest);
      if (!bk && R < 0) return -1;
      /* whatever it was doing stops, as for a meal */
      if (p.state === 'perform') finishSeat(p, true);
      if (p.state === 'dance') finishDancer(p, true, null);
      stopPlay(p);
      toIdle(p, null);
      here = cellOf(p.x, p.z);
      var now = brain.now, f = p.fetch || (p.fetch = { n: 0 }), fr = o.from, hx, hy, hz, rx, ry, rz, lx, lz, mx, mz, splash = null;
      if (fr && typeof fr.x === 'number' && typeof fr.z === 'number' && isFinite(fr.x) && isFinite(fr.z)) { hx = fr.x; hz = fr.z; hy = typeof fr.y === 'number' && isFinite(fr.y) ? fr.y : heightAt(gr, hx, hz) + FETCH.hand; }
      else if (gr.avatar >= 0) { hx = gr.avatarX; hz = gr.avatarZ; hy = heightAt(gr, hx, hz) + FETCH.hand; }
      else { hx = p.x; hz = p.z; hy = p.y + FETCH.hand; }
      if (bk) { rx = seat.x; ry = seat.y + FETCH.ballR; rz = seat.z; lx = mx = rx; lz = mz = rz; }
      else {
        rx = centreX(R); rz = centreZ(R); ry = heightAt(gr, rx, rz) + FETCH.ballR;
        var ex = x - rx, ez = z - rz, ed = Math.sqrt(ex * ex + ez * ez), ux = ed > 1e-6 ? ex / ed : 0, uz = ed > 1e-6 ? ez / ed : 1;
        if (c === R) { lx = x; lz = z; }                                   /* it comes down where the child tapped… */
        else { lx = rx + ux * Math.min(FETCH.edge, ed); lz = rz + uz * Math.min(FETCH.edge, ed); }   /* …or on the edge of the free cell nearest it */
        if (!onLand) splash = { x: rx + ux * FETCH.splash, z: rz + uz * FETCH.splash };              /* a sea tap: the splash just off the beach */
        mx = lx + (rx - lx) * 0.6; mz = lz + (rz - lz) * 0.6;
      }
      var ly = bk ? ry : heightAt(gr, lx, lz) + FETCH.ballR, my = bk ? ry : heightAt(gr, mx, mz) + FETCH.ballR;
      var dist = Math.sqrt((lx - hx) * (lx - hx) + (lz - hz) * (lz - hz)), fl = clamp(0.45 + FETCH.perU * dist, FETCH.flight[0], FETCH.flight[1]);
      f.on = true; f.kind = bk ? 'bounce' : 'ball'; f.perf = bk; f.uid = bk ? ob.uid : ''; f.obx = bk ? ob.x : 0; f.obz = bk ? ob.z : 0;
      f.keep = false; f.sea = !onLand; f.splash = splash; f.tx = x; f.tz = z;
      f.t0 = now; f.hx = hx; f.hy = hy; f.hz = hz; f.lx = lx; f.ly = ly; f.lz = lz; f.mx = mx; f.my = my; f.mz = mz; f.rx = rx; f.ry = ry; f.rz = rz;
      f.arc = clamp(FETCH.arc[0] + FETCH.arcPerU * dist, FETCH.arc[0], FETCH.arc[1]); f.b1 = FETCH.bounces[0][1]; f.b2 = FETCH.bounces[1][1];
      f.land1 = now + fl; f.mid = f.land1 + FETCH.bounces[0][0]; f.rest = f.mid + FETCH.bounces[1][0];
      f.held = false; f.dropped = false; f.cell = R; f.back = -1; f.wait = -1; f.n = (f.n || 0) + 1;
      f.path = null; f.stopS = 0; f.runT0 = now; f.runDur = 0; f.arr = now; f.pickAt = -1; f.cpath = null; f.carryT0 = now; f.carryDur = 0;
      f.dropAt = -1; f.end = -1; f.dx = 0; f.dy = 0; f.dz = 0;
      if (brain.reduced) { fetchNow(p); return 0; }
      p.state = 'fetch'; p.speed = 0;
      p.desiredYaw = Math.atan2(lx - p.x, lz - p.z); p.hasDesired = true; p.lookX = lx; p.lookZ = lz; p.lookK = 1;
      if (bk) {                                    /* the ball comes down on the mat: the pet watches, then bounces for it */
        f.phase = 'wait'; p.action = 'fetchWait'; f.wait = here >= 0 && freeFor(p, here) ? here : -1;
        reserve(p, f.wait);
        return f.land1 - now + BOUNCE.maxLead;
      }
      /* the race: it watches the throw, then a time-driven run that stops short of the ball (a sparkle zip when too far) */
      var sp = clamp(WALK.run * paceOf(p.species), FETCH.run[0], FETCH.run[1]), path;
      if (here === R) path = finishPath([p.x, rx], [p.z, rz], [R], R);
      else {
        path = planTo(p, R, -1);
        if (!path || path.total / sp > FETCH.maxRun) path = zipTo(p, R);
      }
      f.path = path; f.stopS = Math.max(0, path.total - FETCH.stop);
      f.runT0 = now + FETCH.react; f.runDur = f.stopS < 0.05 ? 0 : Math.max(0.2, f.stopS / sp); f.arr = f.runT0 + f.runDur;
      f.pickAt = Math.max(f.arr, f.rest) + FETCH.pick;
      f.phase = 'run'; p.action = 'fetchRun'; p.cruise = sp; p.pathS = 0; p.seg = 1;
      reserve(p, R);
      return f.pickAt - now;
    }
    /* the ball is in its mouth: it trots back to the free cell in front of the child */
    function carryBack(p) {
      var f = p.fetch, gr = g(), now = brain.now;
      if (!f || !gr) return;
      var here = cellOf(p.x, p.z), B = backCell(p);
      p.state = 'fetch'; p.action = 'fetchCarry'; f.phase = 'carry'; f.keep = false; f.back = B;
      if (!f.held) { f.held = true; f.pickAt = now; brain.events.push({ type: 'caught', id: p.id, n: f.n, x: p.x, y: p.y, z: p.z }); }
      reserve(p, B);
      var sp = clamp(WALK.run * FETCH.carryK * paceOf(p.species), FETCH.carry[0], FETCH.carry[1]), path = null;
      if (B >= 0 && B === here) path = finishPath([p.x, centreX(B)], [p.z, centreZ(B)], [B], B);
      else if (B >= 0) {
        path = planTo(p, B, -1);
        if (!path || path.total / sp > FETCH.maxRun) path = zipTo(p, B);
      }
      f.cpath = path; f.carryT0 = now; f.carryDur = path && path.total > 0.02 ? Math.max(0.15, path.total / sp) : 0;
      p.cruise = sp; p.pathS = 0; p.seg = 1; p.lookK = 0; p.hasDesired = false; p.onSeat = ''; p.flip = 0; p.bounce = 0; p.hop = 0; p.perfPhase = '';
    }
    /* the ball's place at the child's feet: just in front of them, on the camera's side, so the child, the pet (beside
       them) and the ball all stay in view */
    function feetDrop(p, f) {
      var c = childAt(f, _ch);
      dropAt(p, f, c.x + Math.sin(brain.camYaw) * FETCH.feet, c.z + Math.cos(brain.camYaw) * FETCH.feet);
      var dx = f.dx - p.x, dz = f.dz - p.z;
      return dx * dx + dz * dz > 1e-8 ? Math.atan2(dx, dz) : null;
    }
    /* at the child's feet: it drops the ball with its happy reaction */
    function dropBall(p) {
      var f = p.fetch, now = brain.now, face = feetDrop(p, f);
      f.phase = 'drop'; f.dropAt = now; f.end = now + FETCH.drop;
      p.action = 'fetchDrop'; p.speed = 0; p.cell = cellOf(p.x, p.z);
      if (face != null) { p.desiredYaw = face; p.hasDesired = true; }
      p.tapKind = tapOf(p.species); p.happyUntil = now + 2.5;
      if (!brain.reduced) p.tapT = now;
      brain.events.push({ type: 'fetched', id: p.id, n: f.n, x: f.dx, y: f.dy, z: f.dz });
    }
    function finishFetch(p) {
      var f = p.fetch;
      if (f) { f.on = false; f.phase = 'done'; }
      toIdle(p, IDLE.first + 0.6);
    }
    /* the end state at once (reduced motion): the pet at the child's feet facing them, the ball dropped there */
    function fetchNow(p) {
      var f = p.fetch, gr = g(), now = brain.now;
      if (!f || !gr) return;
      f.keep = true; clearMotion(p); f.keep = false;
      var B = backCell(p), x0 = p.x, y0 = p.y, z0 = p.z;
      if (B >= 0 && B !== cellOf(p.x, p.z)) { place(p, B); brain.events.push({ type: 'pop', id: p.id, x0: x0, y0: y0, z0: z0, x: p.x, y: p.y, z: p.z }); }
      p.cell = cellOf(p.x, p.z);
      reserve(p, freeFor(p, p.cell) ? p.cell : -1);
      p.state = 'idle'; p.action = ''; f.back = B; f.phase = 'done';
      if (!f.held) brain.events.push({ type: 'caught', id: p.id, n: f.n, x: p.x, y: p.y, z: p.z });
      var face = feetDrop(p, f);
      if (face != null) { p.yaw = face; p.desiredYaw = face; p.hasDesired = true; }
      f.pickAt = f.dropAt = now; f.end = now + FETCH.still; f.on = false;
      p.tapKind = tapOf(p.species); p.happyUntil = now + 2.5; p.nextAt = now + FETCH.still + IDLE.first;
      brain.events.push({ type: 'fetched', id: p.id, n: f.n, x: f.dx, y: f.dy, z: f.dz });
    }
    function fetchStep(p, dt) {
      var f = p.fetch, now = brain.now, gr = g();
      if (!f || !f.on) { p.state = 'idle'; p.action = ''; p.speed = 0; return; }
      if (f.phase === 'wait') {                    /* the trampoline: once the ball is on the mat the pet bounces for it */
        p.speed = 0;
        turnToward(p, Math.atan2(f.rx - p.x, f.rz - p.z), WALK.turn, dt);
        if (now < f.land1) return;
        var ob = gr.objects[f.uid], lead = -1;
        f.keep = true;
        if (ob) lead = performSeat(f.perf, ob, p);
        if (lead >= 0) { f.phase = 'bounce'; p.lookK = 0; return; }
        f.keep = false; cutFetch(p); toIdle(p, IDLE.first);
        return;
      }
      var mv, px = p.x, pz = p.z, u;
      if (f.phase === 'run') {
        if (now < f.runT0 || f.runDur <= 0) {     /* watching the throw (or already beside it): the head follows the ball */
          p.speed = 0;
          var bp = ballAt(f, now, _ball);
          if ((bp.x - p.x) * (bp.x - p.x) + (bp.z - p.z) * (bp.z - p.z) > 1e-6) turnToward(p, Math.atan2(bp.x - p.x, bp.z - p.z), WALK.turn, dt);
          p.lookX = bp.x; p.lookZ = bp.z; p.lookK = 1;
          if (f.runDur <= 0 && now >= f.pickAt) carryBack(p);
          return;
        }
        u = clamp01((now - f.runT0) / f.runDur);
        samplePath(f.path, f.stopS * runProfile(u), _sp, p.seg);
        p.seg = _sp.seg; p.x = _sp.x; p.z = _sp.z; p.y = heightAt(gr, p.x, p.z); p.cell = cellOf(p.x, p.z); p.lookK = 0;
        mv = Math.sqrt((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz));
        p.speed = u < 1 && dt > 0 ? mv / dt : 0;
        if (mv > 1e-6) turnToward(p, Math.atan2(p.x - px, p.z - pz), WALK.turn * 2, dt);
        else if (u >= 1) turnToward(p, Math.atan2(f.rx - p.x, f.rz - p.z), WALK.turn, dt);
        if (u >= 1 && now >= f.pickAt) carryBack(p);
        return;
      }
      if (f.phase === 'carry') {
        if (!f.cpath || f.carryDur <= 0) { dropBall(p); return; }
        u = clamp01((now - f.carryT0) / f.carryDur);
        samplePath(f.cpath, f.cpath.total * runProfile(u), _sp, p.seg);
        p.seg = _sp.seg; p.x = _sp.x; p.z = _sp.z; p.y = heightAt(gr, p.x, p.z); p.cell = cellOf(p.x, p.z);
        mv = Math.sqrt((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz));
        p.speed = u < 1 && dt > 0 ? mv / dt : 0;
        if (mv > 1e-6) turnToward(p, Math.atan2(p.x - px, p.z - pz), WALK.turn * 2, dt);
        if (u >= 1) dropBall(p);
        return;
      }
      if (f.phase === 'drop') {
        p.speed = 0;
        if (p.hasDesired) turnToward(p, p.desiredYaw, WALK.turn, dt); else p.omega = 0;
        if (now >= f.end) finishFetch(p);
        return;
      }
      p.speed = 0;
    }
    /* the k-th automatic throw's spot (My pets → Play): a free cell in front of the child, turning ±0.6 rad in turn → {x, z} | null */
    function throwSpot(k, out) {
      var gr = g();
      if (!gr) return null;
      k = Math.max(0, Math.floor(+k || 0));
      var a = brain.activeId(), q = a ? byId[a] : null, ax = gr.avatar >= 0 ? gr.avatarX : q ? q.x : 0, az = gr.avatar >= 0 ? gr.avatarZ : q ? q.z : 0;
      var yaw = brain.camYaw + FETCH.autoTurn[k % FETCH.autoTurn.length], d = FETCH.auto[k % FETCH.auto.length];
      var c = nearestFree(gr, ax + Math.sin(yaw) * d, az + Math.cos(yaw) * d, res, q ? q.index : -1, gr.largest);
      if (c < 0) return null;
      out = out || {};
      out.x = centreX(c); out.z = centreZ(c);
      return out;
    }

    /* ---------- hide and seek ---------- */
    /* the free cell of the ring round item ob's footprint (its side and corner neighbours) farthest along the camera's
       forward (fx, fz); of equals, the one farthest across the view from the thing's middle (a back corner: the pet
       peeks out past the thing's edge), then the lowest index → cell | -1 */
    function hideCellOf(p, ob, fx, fz) {
      var gr = g(), best = -1, bs = -Infinity, bl = -1, xx, yy, lx = -fz, lz = fx;
      for (yy = ob.r - 1; yy <= ob.r + ob.h; yy++) for (xx = ob.c - 1; xx <= ob.c + ob.w; xx++) {
        var c = cellIndex(xx, yy);
        if (c < 0 || ob.cells.indexOf(c) >= 0 || gr.walk[c] !== 1 || (res[c] >= 0 && res[c] !== p.index)) continue;
        var dx = centreX(c) - ob.x, dz = centreZ(c) - ob.z, s = dx * fx + dz * fz, l = Math.abs(dx * lx + dz * lz);
        if (s > bs + 1e-9 || (Math.abs(s - bs) <= 1e-9 && (l > bl + 1e-9 || (Math.abs(l - bl) <= 1e-9 && c < best)))) { bs = s; bl = l; best = c; }
      }
      return best;
    }
    function hide(id, uid, camYaw) {
      var p = byId[id], gr = g();
      if (!p || !gr || away[id] || p.guest || brain.pets.indexOf(p) < 0 || p.state === 'travel' || brain.mode !== 'play' || eating(p)) return -1;
      var ob = gr.objects[uid];
      if (!ob) return -1;
      var yaw = typeof camYaw === 'number' && isFinite(camYaw) ? camYaw : brain.camYaw;
      if (p.state === 'perform') finishSeat(p, true);
      if (p.state === 'dance') finishDancer(p, true, null);
      stopPlay(p);
      var cell = hideCellOf(p, ob, -Math.sin(yaw), -Math.cos(yaw));
      if (cell < 0) return -1;
      toIdle(p, null);
      var h = p.hide || (p.hide = { n: 0 });
      h.on = true; h.uid = ob.uid; h.cell = cell; h.ix = ob.x; h.iz = ob.z; h.t0 = brain.now; h.n++; h.path = null; h.dur = 0; h.at = -1;
      /* its spot in the cell: across the camera's view, toward the edge of the thing's footprint as the camera sees it
         (on the side the cell is on; a cell right behind the middle takes its side by round), at most HIDE.peek u
         from the cell's middle: half of it peeks out past that edge */
      var lx = Math.cos(yaw), lz = -Math.sin(yaw), cx = centreX(cell), cz = centreZ(cell), side = (cx - ob.x) * lx + (cz - ob.z) * lz;
      var sg = side > 1e-6 ? 1 : side < -1e-6 ? -1 : (h.n % 2 ? 1 : -1), halfW = (ob.w * Math.abs(lx) + ob.h * Math.abs(lz)) / 2;
      var shift = clamp(sg * halfW - side, -HIDE.peek, HIDE.peek);
      h.px = cx + lx * shift; h.pz = cz + lz * shift;
      if (cellOf(h.px, h.pz) !== cell) { h.px = cx; h.pz = cz; }
      p.state = 'hide'; p.action = 'hideGo'; p.speed = 0;
      reserve(p, cell);
      if (brain.reduced) { hideAt(p); return cell; }
      var here = cellOf(p.x, p.z), path = here === cell ? finishPath([p.x, h.px], [p.z, h.pz], [cell], cell) : planTo(p, cell, -1);
      if (path && here !== cell) {                    /* the planned way, then the last step to its spot in the cell */
        var xs = [], zs = [];
        for (var k = 0; k < path.n; k++) { xs.push(path.pts[k * 2]); zs.push(path.pts[k * 2 + 1]); }
        xs.push(h.px); zs.push(h.pz);
        path = finishPath(xs, zs, path.cells, cell);
      }
      var dur = path ? clamp(path.total / (walkSpeed(p) * HIDE.pace), HIDE.minTrot, HIDE.trot) : 0;
      if (!path || path.total < 0.02 || path.total / dur > WALK.zip) { hideAt(p); return cell; }
      h.path = path; h.dur = dur; p.cruise = path.total / dur; p.pathS = 0; p.seg = 1;
      return cell;
    }
    /* in its hiding place now (no sparkle: the host's veil covers the move; under reduced motion there is none) */
    function hideAt(p) {
      var h = p.hide, gr = g();
      p.x = h.px; p.z = h.pz; p.y = heightAt(gr, p.x, p.z); p.cell = h.cell;
      p.path = null; p.speed = 0;
      peek(p);
    }
    function peek(p) {
      var h = p.hide;
      p.action = 'peek'; p.actT0 = brain.now; p.actDur = 1e6; p.speed = 0; h.at = brain.now;
      p.desiredYaw = Math.atan2(h.ix - p.x, h.iz - p.z); p.hasDesired = true;
      if (brain.reduced) p.yaw = p.desiredYaw;
      brain.events.push({ type: 'hidden', id: p.id, uid: h.uid, cell: h.cell, x: p.x, y: p.y, z: p.z });
    }
    function hideStep(p, dt) {
      var h = p.hide;
      if (!h || !h.on) { p.state = 'idle'; p.action = ''; p.speed = 0; return; }
      if (p.action === 'hideGo') {
        var u = clamp01((brain.now - h.t0) / Math.max(1e-6, h.dur)), px = p.x, pz = p.z;
        samplePath(h.path, h.path.total * runProfile(u), _sp, p.seg);
        p.seg = _sp.seg; p.x = _sp.x; p.z = _sp.z; p.y = heightAt(g(), p.x, p.z); p.cell = cellOf(p.x, p.z);
        var mv = Math.sqrt((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz));
        p.speed = u < 1 && dt > 0 ? mv / dt : 0;
        if (mv > 1e-6) turnToward(p, Math.atan2(p.x - px, p.z - pz), WALK.turn * 2, dt);
        if (u >= 1) hideAt(p);
        return;
      }
      p.speed = 0;
      if (p.hasDesired) turnToward(p, p.desiredYaw, WALK.turn, dt); else p.omega = 0;
    }
    /* found: out it comes with its happy reaction (the host's 'Found you!'; actors' sparkle ring on 'found') */
    function unhide(id) {
      var p = byId[id], h = p && p.hide;
      if (!h || !h.on || p.state !== 'hide') return false;
      var now = brain.now;
      h.on = false;
      toIdle(p, IDLE.first + 1);
      p.tapKind = tapOf(p.species); p.happyUntil = now + 2.5;
      if (!brain.reduced) p.tapT = now;
      p.desiredYaw = brain.camYaw; p.hasDesired = true;
      brain.events.push({ type: 'found', id: p.id, uid: h.uid, x: p.x, y: p.y, z: p.z });
      return true;
    }
    /* is a fetch / hide still possible on this layout (its cells free, its item where it was)? */
    function playStillValid(p, gr) {
      var t = wantedCell(p);
      if (t >= 0 && !gr.walk[t]) return false;
      if (p.state === 'hide') {
        var h = p.hide, ob = h && gr.objects[h.uid];
        return !!(h && h.on && ob && Math.abs(ob.x - h.ix) < 1e-6 && Math.abs(ob.z - h.iz) < 1e-6);
      }
      var f = p.fetch;
      if (!f || !f.on) return false;
      if (f.phase === 'wait') { var o2 = gr.objects[f.uid]; return !!o2 && Math.abs(o2.x - f.obx) < 1e-6 && Math.abs(o2.z - f.obz) < 1e-6; }
      return !(f.phase === 'run' && f.cell >= 0 && !gr.walk[f.cell]);
    }

    /* ---------- the visitor (a guest of the brain, never one of its pets) ---------- */
    function holdVisitor() {
      var v = brain.visitor, gr = g();
      if (v && v.cell >= 0 && gr && gr.walk[v.cell] && res[v.cell] < 0) res[v.cell] = VISITOR_RES;
    }
    /* the ▶ PLAY pads: the entrance rows of the items that launch a game */
    function launchPads(gr, bad) {
      var Cc = core(Cx);
      gr.items.forEach(function (ob) {
        var it = itemOf(Cc, ob.id);
        if (!it || it.act !== 'launch') return;
        var keys = null;
        if (Cc && typeof Cc.entranceCells === 'function') { try { keys = Cc.entranceCells(it, ob.c, ob.r); } catch (e) { keys = null; } }
        if (keys && keys.length) keys.forEach(function (k) { var i = parseKey(k); if (i >= 0) bad[i] = 1; });
        else for (var dx = 0; dx < ob.w; dx++) { var i2 = cellIndex(ob.c + dx, ob.r + ob.h); if (i2 >= 0) bad[i2] = 1; }
      });
    }
    function visitorSpot() {
      var gr = g();
      if (!gr) return -1;
      var ox = 0, oz = 0, bad = {}, v = brain.visitor, best = -1, bd = Infinity;
      if (gr.house && gr.house.entrance >= 0) { ox = centreX(gr.house.entrance); oz = centreZ(gr.house.entrance); }
      else if (gr.avatar >= 0) { ox = gr.avatarX; oz = gr.avatarZ; }
      launchPads(gr, bad);
      brain.pets.forEach(function (q) { var fd = q.feed; if (fd && fd.on && brain.now < fd.end) { var bc = cellOf(fd.x, fd.z); if (bc >= 0) bad[bc] = 1; } });   /* a bowl that is out (actors draws it until end) */
      for (var pass = 0; pass < 2 && best < 0; pass++) {
        for (var i = 0; i < NCELL; i++) {
          if (!gr.walk[i] || bad[i]) continue;
          if (res[i] >= 0 && !(res[i] === VISITOR_RES && v && v.cell === i)) continue;
          if (pass === 0 && gr.largest && gr.comp[i] !== gr.largest) continue;
          var dx = centreX(i) - ox, dz = centreZ(i) - oz, d = dx * dx + dz * dz;
          if (d < bd - 1e-9) { bd = d; best = i; }
        }
      }
      return best;
    }
    function setVisitor(v, o) {
      o = o || {};
      var gr = g(), cur = brain.visitor;
      if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) {
        if (cur) { if (cur.cell >= 0 && res[cur.cell] === VISITOR_RES) res[cur.cell] = -1; brain.visitor = null; }
        return -1;
      }
      if (cur && cur.id === v.id && cur.cell >= 0) return cur.cell;          /* the same visitor stays where it is */
      if (cur && cur.cell >= 0 && res[cur.cell] === VISITOR_RES) res[cur.cell] = -1;
      brain.visitor = null;
      if (!gr || isleDef) return -1;                                          /* visitors come to Home */
      var cell = visitorSpot();
      if (cell < 0) return -1;
      var vs = { id: v.id, cell: cell, x: centreX(cell), y: 0, z: centreZ(cell), yaw: brain.camYaw, state: 'stand', speed: 0, path: null, s0: 0, t0: brain.now, dur: 0, seg: 1 };
      vs.y = heightAt(gr, vs.x, vs.z);
      brain.visitor = vs;
      res[cell] = VISITOR_RES;
      var fr = o.from || v.from, instant = !!(o.instant || v.instant) || brain.reduced;
      if (!instant && fr && typeof fr.x === 'number' && typeof fr.z === 'number' && isFinite(fr.x) && isFinite(fr.z)) {
        var s0 = cellOf(fr.x, fr.z), from = s0 >= 0 && gr.walk[s0] ? s0 : nearestFree(gr, fr.x, fr.z, null, -1, gr.largest), cells = null;
        if (from >= 0 && from !== cell) {
          extra.fill(0);
          brain.pets.forEach(function (q) { var qc = cellOf(q.x, q.z); if (qc >= 0 && qc !== from && q.state !== 'walk' && q.state !== 'travel') extra[qc] = 1; });
          cells = astar(gr, from, cell, extra) || astar(gr, from, cell, null);
        }
        var path = cells ? smoothPath(gr, cells, centreX(from), centreZ(from), null) : null;
        if (path && path.total > 0.05) {
          vs.s0 = Math.max(0, path.total - VISIT.max);
          samplePath(path, vs.s0, _vsp, 1);
          vs.x = _vsp.x; vs.z = _vsp.z; vs.y = heightAt(gr, vs.x, vs.z); vs.yaw = Math.atan2(_vsp.dx, _vsp.dz);
          vs.path = path; vs.state = 'walk'; vs.t0 = brain.now; vs.dur = (path.total - vs.s0) / VISIT.speed; vs.speed = VISIT.speed; vs.seg = 1;
        }
      }
      brain.events.push({ type: 'visitor', id: v.id, arrive: true, x: vs.x, y: vs.y, z: vs.z });
      return cell;
    }
    function visitorStep(dt) {
      var vs = brain.visitor;
      if (!vs || vs.state !== 'walk' || !vs.path) return false;
      var u = clamp01((brain.now - vs.t0) / Math.max(1e-6, vs.dur)), px = vs.x, pz = vs.z;
      samplePath(vs.path, vs.s0 + (vs.path.total - vs.s0) * u, _vsp, vs.seg);
      vs.seg = _vsp.seg; vs.x = _vsp.x; vs.z = _vsp.z; vs.y = heightAt(g(), vs.x, vs.z);
      var mv = Math.sqrt((vs.x - px) * (vs.x - px) + (vs.z - pz) * (vs.z - pz));
      if (mv > 1e-6) vs.yaw = Math.atan2(vs.x - px, vs.z - pz);
      vs.speed = dt > 0 ? mv / dt : vs.speed;
      if (u >= 1) { vs.state = 'stand'; vs.speed = 0; vs.path = null; vs.x = centreX(vs.cell); vs.z = centreZ(vs.cell); vs.y = heightAt(g(), vs.x, vs.z); }
      return true;
    }
    /* after a layout change: a visitor whose cell went (or whose way in is blocked) stands on the next spot at once */
    function validateVisitor(gr) {
      var vs = brain.visitor;
      if (!vs) return;
      if (vs.state === 'walk' && vs.path && !pathValid(gr, vs.path, vs.s0, null, cellOf(vs.x, vs.z))) { vs.state = 'stand'; vs.path = null; vs.speed = 0; vs.x = centreX(vs.cell); vs.z = centreZ(vs.cell); }
      if (vs.cell >= 0 && gr.walk[vs.cell] && (res[vs.cell] < 0 || res[vs.cell] === VISITOR_RES)) { vs.y = heightAt(gr, vs.x, vs.z); return; }
      if (vs.cell >= 0 && res[vs.cell] === VISITOR_RES) res[vs.cell] = -1;
      vs.cell = -1;
      var c = visitorSpot(), x0 = vs.x, y0 = vs.y, z0 = vs.z;
      if (c < 0) { vs.state = 'none'; vs.path = null; vs.speed = 0; return; }
      vs.cell = c; vs.x = centreX(c); vs.z = centreZ(c); vs.y = heightAt(gr, vs.x, vs.z); vs.state = 'stand'; vs.path = null; vs.speed = 0;
      res[c] = VISITOR_RES;
      brain.events.push({ type: 'visitor', id: vs.id, x0: x0, y0: y0, z0: z0, x: vs.x, y: vs.y, z: vs.z });
    }

    brain.sync = sync;
    brain.step = step;
    brain.tap = tap;
    brain.feed = feed;
    /* island activities v1 (IA-3) */
    brain.fetch = fetch;
    brain.throwSpot = throwSpot;
    brain.hide = hide;
    brain.unhide = unhide;
    brain.setVisitor = setVisitor;
    brain.visitorSpot = visitorSpot;
    brain.playing = function (id) { return playing(byId[id] || null); };
    /* stopPlay(id) → bool: a fetch is cut where it is ('fetchCut'), a hiding pet comes out ('found') */
    brain.stopPlay = function (id) {
      var p = byId[id];
      if (!p || !playing(p)) return false;
      if (p.state === 'hide' && p.hide && p.hide.on) return unhide(id);
      if (p.state === 'perform') finishSeat(p, true);
      stopPlay(p);
      if (p.state === 'fetch' || p.state === 'hide') toIdle(p, IDLE.first);
      return true;
    };
    brain.perform = perform;
    brain.dance = dance;
    brain.setMode = function (m) { setMode(m); };
    brain.setReduced = setReduced;
    brain.setShow = function (k) { brain.show = clamp01(+k || 0); };
    brain.setMusic = function (on) { brain.music = !!on; };
    /* fn(uid, name) → {x, y, z} | null: a building's live anchor in world space (the island's itemPoint) */
    brain.setAnchorFn = function (fn) { anchorFn = typeof fn === 'function' ? fn : null; };
    brain.pet = function (id) { return byId[id] || null; };
    brain.activeId = function () {
      for (var k = 0; k < brain.pets.length; k++) if (brain.pets[k].active) return brain.pets[k].id;
      for (var id in away) if (away[id].active) return null;            /* the active pet is on another island */
      for (var j = 0; j < brain.pets.length; j++) if (!brain.pets[j].guest) return brain.pets[j].id;   /* never a land's guest */
      return null;
    };
    brain.reservations = function () { return res; };
    brain.danceInfo = function (out) {
      out = danceAt(brain.danceOn ? brain.now - brain.danceT0 : -1, brain.danceReduced, out);
      out.kind = brain.danceOn ? brain.danceKind : '';
      return out;
    };
    brain.glance = function (out) { return glanceAt(brain.now, seed, out); };
    return brain;
  }

  /* ---------------- the crossing between two brains (D29 / D83) ----------------
     from → to along: the walk to the exit point (Home: the land's gate pad; a land: its dock edge;
     a sparkle hop there instead when the pet is more than 4 u away, at hopAt once the camera has
     left), the bridge deck(s), across Home between two gate pads (island to island), the walk in
     from the dock edge (or gate pad) to the arrival cell. o {flight (s), instant, home (the Home
     brain, for island to island), G} → {seconds, length, speed} | null */
  function crossing(from, to, petId, o) {
    o = o || {};
    var G = grid(o.G), V3 = G && G.V3, fi = from ? from.isle : 'home', ti = to ? to.isle : null;
    if (!to || !to.graph || !petId || fi === ti || !V3 || typeof V3.bridge !== 'function') return null;
    if ((fi !== 'home' && !V3.bridge(fi)) || (ti !== 'home' && !V3.bridge(ti))) return null;
    var entry = ti === 'home' ? V3.gate(fi) : V3.bridge(ti).b, p = from ? from.pet(petId) : null;
    if (o.instant || !p || !from.graph || from.isAway(petId)) {
      if (from) from.setAway(petId, true);
      return to.arrive(petId, null, { from: entry }) ? { seconds: 0, length: 0, speed: 0, instant: true } : null;
    }
    var pts = [], W = fi === 'home' ? V3.gate(ti) : V3.bridge(fi).b, fr = from.frame;
    var at = { x: p.x + fr.ox, y: p.y + fr.oy, z: p.z + fr.oz }, hop = !from.exitPts(petId, W, pts), d, i;
    if (hop) pts = [W.x, W.y, W.z];
    if (fi !== 'home') { d = deckOf(fi, o.G); if (d) for (i = d.length - 3; i >= 0; i -= 3) pts.push(d[i], d[i + 1], d[i + 2]); }
    if (fi !== 'home' && ti !== 'home') {
      var ga = V3.gate(fi), gb = V3.gate(ti);
      if (o.home && o.home.graph) o.home.transferPts(ga, gb, pts); else pts.push(ga.x, ga.y, ga.z, gb.x, gb.y, gb.z);
    }
    if (ti !== 'home') { d = deckOf(ti, o.G); if (d) for (i = 0; i < d.length; i++) pts.push(d[i]); }
    var cell = to.entryPts(entry, pts);
    if (cell < 0) return null;
    var cum = cumOf(pts), L = cum[cum.length - 1], fl = +o.flight || 0;
    var speed = fl > 0 ? clamp(L / fl, CROSS.walk, CROSS.max) : CROSS.walk, hopAt = hop ? (fl > 0 ? Math.min(CROSS.hopAt, fl * 0.3) : 0) : 0;
    from.setAway(petId, true);
    to.arrive(petId, pts, { speed: speed, hop: hop, hopAt: hopAt, at: at, cell: cell });
    return { seconds: hopAt + L / speed, length: L, speed: speed, hop: hop };
  }

  return {
    VERSION: VERSION, COLS: COLS, ROWS: ROWS,
    WALK: WALK, IDLE: IDLE, HOP: HOP, SEAT: SEAT, BOUNCE: BOUNCE, DANCE: DANCE, GLANCE: GLANCE, ACTIONS: ACTIONS, PLAY: PLAY,
    PERFORMS: PERFORMS, POSE_TICKS: POSE_TICKS, STAGE: STAGE, ANCHOR_FALLBACK: ANCHOR_FALLBACK, AVATAR_RES: AVATAR_RES, EMOTES: EMOTES,
    create: create, crossing: crossing,
    CROSS: CROSS, HANG: HANG, LEG: LEG, V3_KINDS: V3_KINDS, frameOf: frameOf, deckOf: deckOf, rampOf: rampOf, actOf: actOf,
    PLAY_MOVES: PLAY_MOVES, TAPS: TAPS, WEIGHTS: WEIGHTS, SPECIES_W: SPECIES_W, REDUCED_W: REDUCED_W,
    playOf: playOf, tapOf: tapOf, weightsOf: weightsOf,
    /* the kids update (P2.5) */
    V454_PLAY: V454_PLAY, MOOD: MOOD, FEED: FEED, GIVE_WAY: GIVE_WAY, paceOf: paceOf, speedOf: speedOf, moodOf: moodOf, moodWeights: moodWeights,
    /* island activities v1 (IA-3) */
    FETCH: FETCH, HIDE: HIDE, VISIT: VISIT, VISITOR_RES: VISITOR_RES, ballAt: ballAt,
    buildGraph: buildGraph, astar: astar, distMap: distMap, smoothPath: smoothPath, pathValid: pathValid, samplePath: samplePath,
    losClear: losClear, heightAt: heightAt, nearestFree: nearestFree, danceSpots: danceSpots, danceAt: danceAt,
    alignDelay: alignDelay, glanceAt: glanceAt, bounceAt: bounceAt, posesOf: posesOf, makeRng: makeRng, hash: hash,
    cellIndex: cellIndex, cellOf: cellOf, centreX: centreX, centreZ: centreZ, keyOf: keyOf, parseKey: parseKey, wrap: wrap
  };
}));
