/* ================================================================
   Game B — Encore Shootout, a penalty shoot-out (unlocked by the Penalty Pitch).
   One name everywhere: the island Games sheet, the shell title / menu heading
   and the 3D LED all say "Encore Shootout"; only the catalogue item keeps
   its own name, "Penalty Pitch".
   8 kicks against one of 4 original goalie-blob rivals. Tap once to lock the
   SIDE (cyan marker), tap again to lock the HEIGHT (pink reticle). Each rival
   gives his dive away with ONE learnable tell: Mochi LEANS, Bop dance-steps on
   the beat, Glowy's glove LIGHTS UP, Flip leans the WRONG way on purpose.
   Goals in a row fill 4 HYPE wands; at 4 the stadium flips to ENCORE MODE and
   every goal is a 150-point STAR STRIKE. A post/bar ping costs one wand; a save
   or a wide/over shot resets the show.
   Fair by construction (unchanged rules, ONE reach table for every rival):
     • top corners are out of the keeper's reach → always a goal if on target
     • a ball inside the keeper's reach is saved only if he went that way
     • aim outside the posts or over the bar = miss (your timing)
   This file holds every rule, timing, sound and music call (pure, Node-testable,
   no DOM, no 3D library) plus the 2D canvas renderer used whenever the 3D view
   isn't running. The 3D view only READS round.state and the s.ev queue.
   Kids update (PENALTY_RULES 2, plan-ku KG4 / games.json ES-1, ES-2):
     • a rushed kick — the SIDE tapped in under TIMING.RUSH_T (0.30 s) of aiming,
       before any tell can be read — is read by the keeper ('rushed' event)
     • duel mode for challenges (cfg.challengeRound.duel): pre-rolled keeper
       moves, a hold gate the challenge opens kick by kick, decider kicks that
       never touch the round's score ('decider' event)
     • ⚔️ Challenge / 🔑 Join with a code in the menu, only when cfg.duels
   Spec: docs/island3d/spec-penalty.json · shell hooks: docs/island3d/CONTRACTS.md §2
   ================================================================ */
(function () {
  'use strict';
  function win() { return typeof window !== 'undefined' ? window : null; }
  var Shell = win() ? window.SLGameShell : null;
  var LW = 960, LH = 540;
  var POST_L = 250, POST_R = 710, BAR = 150, LINE = 340, MID = 480;
  var AIM_X0 = 222, AIM_X1 = 738, AIM_Y0 = 126, AIM_Y1 = 332;
  var SHOTS = 8, TAU = Math.PI * 2;
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { var v = o[k]; if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); });
    return Object.freeze(o);
  }
  /* even-speed back-and-forth (a sine wave lingers at its ends, which are misses) */
  function tri(ph) { var f = ((ph / TAU) % 1 + 1) % 1; return f < 0.5 ? f * 4 - 1 : 3 - f * 4; }

  /* ---------------- the fair core (unchanged byte for byte in behaviour) ---------------- */
  var REACH = deepFreeze({
    stay:  { x0: MID - 88, x1: MID + 88, y0: 172 },
    left:  { x0: 268, x1: MID - 40, y0: 206 },
    right: { x0: MID + 40, x1: 692, y0: 206 }
  });
  function outcome(x, y, dive) {
    if (x <= POST_L + 6 || x >= POST_R - 6 || y <= BAR + 6) return 'miss';
    if (y > LINE) return 'miss';
    var r = REACH[dive];
    if (x >= r.x0 && x <= r.x1 && y >= r.y0) return 'save';
    return 'goal';
  }
  function isTopCorner(x, y) { return y < REACH.left.y0 && Math.abs(x - MID) > 88; }

  /* ---------------- constants ---------------- */
  var AIM = deepFreeze({ x0: AIM_X0, x1: AIM_X1, y0: AIM_Y0, y1: AIM_Y1 });
  var TIMING = (function () {
    var t = {
      READY: 0.9, INTRO: 2.0, INTRO_SKIP: 0.6, GUARD: 0.15, NUDGE: 4.0, AUTOLOCK: 6.0,
      WINDUP: 0.25, HITSTOP: 0.07, FLIGHT: 0.62, DIVE: 0.5, SLOW_F0: 0.60, SLOW_F1: 0.88, SLOW: 0.3,
      RESULT: 2.0, RESULT_REPLAY: 2.4, SKIP_AFTER: 0.8, LEAN_RATE: 1.2, BEAT: 60 / 112
    };
    /* ES-1: a SIDE tapped before RUSH_T s of aiming is read by the keeper. Not enumerable on purpose:
       penalty-3d-core.js mirrors the view's timings key for key (its T equals Object.assign({}, TIMING))
       and the 3D view has no use for this rule. A view that ever mirrors it makes it enumerable here too. */
    Object.defineProperty(t, 'RUSH_T', { value: 0.30, enumerable: false });
    return deepFreeze(t);
  })();
  var T = TIMING;
  /* the rules number a challenge's hello carries, so two versions never meet in one challenge (was 1) */
  var PENALTY_RULES = 2;
  /* duel mode (ES-2): 13 pre-rolled keeper moves (8 kicks + up to 5 deciders); a retake (both missed,
     a team try) replays the same decider, so up to 3 more kicks; the round's own fall-backs if the
     challenge goes quiet: a kick opens itself after HOLD_MAX s at its gate, and the round ends itself
     DECIDE_MAX s after kick 8 with no word on deciders; OPEN_BEAT: the ready beat after a gate opens */
  var DUEL = deepFreeze({ DIVES: 13, MAX_DECIDERS: 5, MAX_DECIDER_KICKS: 8, HOLD_MAX: 12, DECIDE_MAX: 30, OPEN_BEAT: 0.5,
    WEIGHTS: { left: 0.36, stay: 0.28, right: 0.36 } });
  /* every new child-facing line of the kids update (copy-checked by tests/game-penalty-ku.test.js) */
  var COPY = deepFreeze({
    rushedSub: 'Quick kick! He saw it coming — wait for his tell.',
    rushedSay: 'Quick kick! The keeper saw it coming. Wait for his tell.',
    rushedCard: ['👀', 'Watch the keeper first: quick kicks are easier to save.'],
    deciderGoal: '⚡ Decider goal!', deciderSay: 'Decider goal!', deciderReady: '⚡ Decider kick — get ready…',
    deciderChip: '⚡ Decider kick', allKicks: 'all 8 kicks taken', getReady: 'Get ready…',
    challenge: '⚔️ Challenge', join: '🔑 Join with a code', offline: 'Challenges need the internet.'
  });
  /* 4 original rivals: each id is its personal-best variant key ('penalty:<id>') */
  var RIVALS = deepFreeze([
    { id: 'std', name: 'Mochi', icon: '🍡', tell: 'lean', base: 0.55, jersey: '#7BD88F', trim: '#FF6B6B',
      tip: 'Mochi LEANS the way he’ll dive.', unlock: null },
    { id: 'rival_bop', name: 'Bop', icon: '🎧', tell: 'beat', base: 0.60, jersey: '#C38BFF', trim: '#FF8FC8',
      tip: 'Bop dance-steps toward his dive on the beat.', unlock: { after: 'std', score: 400 } },
    { id: 'rival_glowy', name: 'Glowy', icon: '✨', tell: 'glove', base: 0.65, jersey: '#4FC3F7', trim: '#3DF2FF',
      tip: 'Glowy’s glove lights up on his dive side.', unlock: { after: 'rival_bop', score: 400 } },
    { id: 'rival_flip', name: 'Flip', icon: '🔄', tell: 'mirror', base: 0.70, jersey: '#FF8FC8', trim: '#DDE3F0',
      tip: 'Flip leans the WRONG way: shoot where he leans!', unlock: { after: 'rival_glowy', score: 700 } }
  ]);
  /* QA2C-2: where a kick with no tap goes — low in the middle, inside the keeper's own reach */
  var AUTO_SHOT = deepFreeze({ x: MID, y: 300 });
  /* the nudge after T.NUDGE s with no tap: the KICK button and the tap this step needs (the 2D
     bubble here, the 3D one from penalty-3d-core.js COPY, which says the same) */
  var NUDGE = deepFreeze({ x: 'Tap KICK to pick the side!', y: 'Tap KICK to pick the height!' });
  function nudgeText(phase) { return phase === 'aimY' ? NUDGE.y : NUDGE.x; }
  var MEDALS = deepFreeze([
    { id: 'bronze', name: 'Bronze', score: 400, icon: '🥉', kind: 'bronze' },
    { id: 'silver', name: 'Silver', score: 700, icon: '🥈', kind: 'silver' },
    { id: 'gold', name: 'Gold', score: 950, icon: '🥇', kind: 'gold' },
    { id: 'perfect', name: 'Perfect', score: 1200, icon: '🌟', kind: 'crown' }
  ]);
  /* presentation levels by hype pip (shared so 2D and 3D agree) */
  var HYPE_SHOW = deepFreeze([0, 0.2, 0.4, 0.6, 1.0]);     /* day → Showtime blend */
  var WANDS_LIT = deepFreeze([0.25, 0.5, 0.75, 1, 1]);      /* fraction of crowd wands on */
  var CONES = deepFreeze([0, 0, 1, 2, 3]);                  /* spotlight cones on */
  var COLORS = deepFreeze({
    cyan: '#3DF2FF', pink: '#FF4FB8', violet: '#A66BFF', gold: '#FFD23F', glove: '#FF5FA2', ink: '#3b2f4a',
    holo: ['#FFB3E6', '#B3E5FF', '#C9FFE5', '#FFF3B3'], wands: ['#FF8FC8', '#4FC3F7', '#FFD23F', '#7BD88F', '#C38BFF'],
    showSky: ['#1A1240', '#3B1E6E', '#FF7AC8']
  });
  /* locked cosmetic colours (same values as SLWorldArt; used when it isn't loaded, e.g. in Node) */
  var BALLS = { ball_classic: ['#ffffff', '#3b2f4a'], ball_rainbow: ['#ff6b6b', '#4fc3f7'], ball_planet: ['#c38bff', '#ffd23f'], ball_gold: ['#ffd23f', '#e0a81c'] };
  var STADIA = { stadium_day: ['#7ecbff', '#6ac46a'], stadium_night: ['#2b2a5e', '#3f9a4a'], stadium_beach: ['#ffe0a0', '#7fd0a0'], stadium_snow: ['#dfeeff', '#bfe6c8'] };
  var BALL_TRAIL = { ball_classic: '#ffffff', ball_planet: '#FFD23F', ball_gold: '#FFE89A' };
  var RAINBOW = ['#FF6B6B', '#FFA94D', '#FFD23F', '#7BD88F', '#4FC3F7', '#C38BFF'];
  var FULL_TELL = 1;                                         /* an aimT at which every tell is at full strength */

  /* ---------------- pure rules (exported for the 3D view and the tests) ---------------- */
  /* why a miss missed (null when the shot isn't a miss); first matching band wins */
  function missKind(x, y) {
    if (!(x <= POST_L + 6 || x >= POST_R - 6 || y <= BAR + 6 || y > LINE)) return null;
    if (((x >= 238 && x <= 256) || (x >= 704 && x <= 722)) && y >= 138) return 'post';
    if (x < 238 || x > 722) return 'wide';
    if (y < 138) return 'over';
    if (y >= 138 && y <= 156) return 'bar';
    return 'wide';
  }
  /* 100 + 10 per hype pip, or 150 for a top corner / a Star Strike: never more than 150 a kick */
  function shotPoints(res, top, hypeBefore) {
    if (res !== 'goal') return 0;
    var h = Math.max(0, Math.min(4, Math.floor(+hypeBefore || 0)));
    return (top || h >= 4) ? 150 : 100 + 10 * h;
  }
  function rivalIndex(id) { for (var i = 0; i < RIVALS.length; i++) if (RIVALS[i].id === id) return i; return -1; }
  function rivalById(id) { return RIVALS[Math.max(0, rivalIndex(id))]; }
  /* marker speed in sweeps/s: rival base + 0.05 a kick + 0.03 a hype pip, capped; the Cheer Boost slows it */
  function sweepSpeed(rivalIdx, k, hype, boost) {
    var rv = RIVALS[Math.max(0, Math.min(RIVALS.length - 1, rivalIdx | 0))];
    return Math.min(1.15, rv.base + 0.05 * (k || 0) + 0.03 * (hype || 0)) * (boost ? 0.8 : 1);
  }
  /* the rival's ONE tell for a dive, aimT seconds into aiming (pass `out` to reuse an object) */
  function tellAt(rivalId, dive, aimT, clock, out) {
    var t = out || {};
    t.lean = 0; t.crouch = 0; t.step = 0; t.hop = 0; t.gloveL = 0; t.gloveR = 0; t.mirror = false;
    var ramp = Math.max(0, Math.min(1, (aimT || 0) * T.LEAN_RATE));
    var dir = dive === 'left' ? -1 : dive === 'right' ? 1 : 0;
    var tell = rivalById(rivalId).tell;
    if (tell === 'beat') {
      /* full lean on even beats of the logic clock, 0.3 in between (the music shares this clock) */
      var env = ((Math.floor((clock || 0) / T.BEAT) % 2) + 2) % 2 === 0 ? 1 : 0, amp = env ? 1 : 0.3;
      t.hop = env;
      if (dir) { t.step = dir * 0.25 * ramp; t.lean = dir * ramp * amp; } else t.crouch = ramp * amp;
    } else if (tell === 'glove') {
      if (dir < 0) t.gloveL = ramp; else if (dir > 0) t.gloveR = ramp; else { t.gloveL = ramp; t.gloveR = ramp; }
    } else if (tell === 'mirror') {
      t.mirror = true;
      if (dir) t.lean = -dir * ramp; else t.crouch = ramp;
    } else {
      if (dir) t.lean = dir * ramp; else t.crouch = ramp;
    }
    return t;
  }
  /* the honest reading of a tell: 'left' | 'stay' | 'right', or null while it is still too faint */
  var TELL_TH = 0.25;
  function readTell(rivalId, tell) {
    if (!tell) return null;
    var gl = tell.gloveL || 0, gr = tell.gloveR || 0;
    if (gl >= TELL_TH && gr >= TELL_TH) return 'stay';
    if (gl >= TELL_TH) return 'left';
    if (gr >= TELL_TH) return 'right';
    var lean = tell.lean || 0, mirror = !!tell.mirror || rivalId === 'rival_flip';
    if (Math.abs(lean) >= TELL_TH) return (lean < 0) !== mirror ? 'left' : 'right';
    if ((tell.crouch || 0) >= TELL_TH) return 'stay';
    return null;
  }
  function medalFor(score) {
    var v = +score || 0;
    for (var i = MEDALS.length - 1; i >= 0; i--) if (v >= MEDALS[i].score) return MEDALS[i].id;
    return null;
  }
  function medalInfo(id) { for (var i = 0; i < MEDALS.length; i++) if (MEDALS[i].id === id) return MEDALS[i]; return null; }
  function medalAt(score) { for (var i = 0; i < MEDALS.length; i++) if (MEDALS[i].score === score) return MEDALS[i]; return null; }
  /* a rival's best score from the existing personal bests ('penalty:std' carries straight over) */
  function bestFor(pb, id) {
    var rec = pb && pb['penalty:' + id], v = rec ? Number(rec.score) : NaN;
    return isFinite(v) ? v : 0;
  }
  function rivalUnlocked(pb, id) {
    var i = rivalIndex(id); if (i < 0) return false;
    var u = RIVALS[i].unlock;
    return !u || bestFor(pb, u.after) >= u.score;
  }
  /* banner copy shared by the 2D and 3D renderers (kind, never mocking). A decider kick (e.decider)
     scores no points, so its goal banner names the decider instead; a rushed kick that was saved
     (e.rushed) gets the one line that teaches the game: wait for the tell */
  function resultLabel(e) {
    e = e || {};
    if (e.auto) return { title: 'SAVED!', sub: 'Tap KICK to aim!', say: 'Saved. Tap kick to aim.' };
    var res = e.res, kind = e.kind || (res === 'miss' ? missKind(e.x, e.y) : res), pts = e.pts != null ? e.pts : 0;
    if (res === 'goal') {
      if (e.decider) return { title: e.top ? 'TOP CORNER!' : 'GOAL!', sub: COPY.deciderGoal, say: COPY.deciderSay };
      if (e.top) return { title: 'TOP CORNER!', sub: '+' + pts + (e.star ? ' · Star Strike!' : ''), say: 'Top corner goal! ' + pts + ' points' };
      if (e.star) return { title: 'STAR STRIKE!', sub: '+' + pts + ' · Encore goal!', say: 'Star strike! ' + pts + ' points' };
      return { title: 'GOAL!', sub: '+' + pts, say: 'Goal! ' + pts + ' points' };
    }
    if (res === 'save') {
      if (e.rushed) return { title: 'SAVED!', sub: COPY.rushedSub, say: COPY.rushedSay };
      var way = e.dive === 'left' ? 'LEFT' : e.dive === 'right' ? 'RIGHT' : '';
      return { title: 'SAVED!', sub: way ? 'He dived ' + way + '!' : 'He stayed in the MIDDLE!', say: 'Saved! ' + (way ? 'He dived ' + way.toLowerCase() + '.' : 'He stayed in the middle.') };
    }
    var hypeDown = (e.hypeBefore || 0) > 0 && !e.decider ? ' · Hype −1' : '';
    if (kind === 'post') return { title: 'SO CLOSE!', sub: 'Off the post!' + hypeDown, say: 'So close! Off the post.' };
    if (kind === 'bar') return { title: 'SO CLOSE!', sub: 'Off the bar!' + hypeDown, say: 'So close! Off the bar.' };
    if (kind === 'over') return { title: 'SO CLOSE!', sub: 'Just over!', say: 'So close! Just over.' };
    return { title: 'SO CLOSE!', sub: 'Just wide!', say: 'So close! Just wide.' };
  }

  /* ---------------- logic px ↔ 3D units (goal plane z = 0, +z toward the camera) ---------------- */
  var U = 230 / 3;                                   /* 76.667 logic px per unit: posts at exactly ±3 */
  function lx2u(x) { return (x - MID) / U; }
  function ly2u(y) { return (LINE - y) / U; }
  function box(r) { return { x0: lx2u(r.x0), x1: lx2u(r.x1), y1: ly2u(r.y0) }; }
  function ballAt(f, lx, ly, out) {
    /* the ball's flight solved from the frozen lock: spot → (x, y, 0) with a bend and an arc */
    var o = out || {}, ex = lx2u(lx), ey = ly2u(ly), sp = Math.sin(Math.max(0, Math.min(1, f)) * Math.PI);
    o.x = ex * f + sp * 0.25 * (ex < 0 ? -1 : ex > 0 ? 1 : 0);
    o.y = 0.11 + (ey - 0.11) * f + 0.5 * sp;
    o.z = 7.5 * (1 - f);
    return o;
  }
  var MAP = deepFreeze({
    U: U, lx2u: lx2u, ly2u: ly2u, box: box, ballAt: ballAt,
    POST_U: lx2u(POST_R), BAR_U: ly2u(BAR),
    MISS_U: { x: lx2u(POST_R - 6), y: ly2u(BAR + 6) },
    AIM_U: { x0: lx2u(AIM_X0), x1: lx2u(AIM_X1), y0: ly2u(AIM_Y1), y1: ly2u(AIM_Y0) },
    REACH_U: { stay: box(REACH.stay), left: box(REACH.left), right: box(REACH.right) },
    CORNER_U: {
      xIn: lx2u(MID + 88), xOut: lx2u(POST_R - 6), y0: ly2u(REACH.left.y0), y1: ly2u(BAR + 6),
      left: { x0: lx2u(POST_L + 6), x1: lx2u(MID - 88), y0: ly2u(REACH.left.y0), y1: ly2u(BAR + 6) },
      right: { x0: lx2u(MID + 88), x1: lx2u(POST_R - 6), y0: ly2u(REACH.left.y0), y1: ly2u(BAR + 6) }
    },
    POS: { keeper: [0, 0, 0.35], ball: [0, 0.11, 7.5], kicker: [-0.55, 0, 8.1], runup: [-0.2, 0, 7.75], avatar: [-3.9, 0, 4.2] }
  });

  /* ---------------- small helpers ---------------- */
  function noop() {}
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function mkRng(seed) {
    var x = (seed >>> 0) || 1;
    return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }
  function hex6(c) {
    if (typeof c !== 'string') return null;
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return null;
  }
  function lookFor(cfg) {
    var art = win() && window.SLWorldArt;
    var balls = (art && art.BALLS) || BALLS, stadia = (art && art.STADIA) || STADIA;
    var who = cfg.member || cfg.user || {};
    return {
      ball: balls[cfg.ball] ? cfg.ball : 'ball_classic',
      ballCol: balls[cfg.ball] || balls.ball_classic || BALLS.ball_classic,
      stadium: stadia[cfg.stadium] ? cfg.stadium : 'stadium_day',
      stad: stadia[cfg.stadium] || stadia.stadium_day || STADIA.stadium_day,
      night: cfg.stadium === 'stadium_night',
      sig: hex6(who.color) || '#6C5CE7'
    };
  }

  /* ---------------- challenges: the round a lobby sets up (ES-2) ---------------- */
  function isDive(d) { return d === 'left' || d === 'stay' || d === 'right'; }
  /* 13 keeper moves; an unusable entry is null (that kick falls back to the seeded draw) */
  function diveList(a) {
    if (!Array.isArray(a)) return null;
    var out = [], ok = 0;
    for (var i = 0; i < DUEL.DIVES; i++) { var d = isDive(a[i]) ? a[i] : null; if (d) ok++; out.push(d); }
    return ok ? out : null;
  }
  /* cfg.challengeRound is set by a lobby for the next round only: read once here and cleared.
     → null (a solo round) or {seed, variant, duel: null | {dives, hold, deciders}} */
  function takeChallenge(cfg) {
    if (!cfg || cfg.challengeRound === undefined) return null;
    var c = cfg.challengeRound;
    try { cfg.challengeRound = null; } catch (e) {}
    if (!c || typeof c !== 'object' || cfg.demo) return null;
    var seed = Number(c.seed);
    if (!isFinite(seed)) return null;
    var out = { seed: (seed >>> 0) || 1, variant: typeof c.variant === 'string' ? c.variant : null, duel: null }, d = c.duel;
    if (d && typeof d === 'object') {
      var dives = diveList(d.dives);
      if (!dives) {
        /* no moves handed over: the same pre-roll the challenge core makes from the seed */
        var DC = win() && window.SLDuelCore;
        try { if (DC && typeof DC.dives === 'function') dives = diveList(DC.dives(out.seed, DUEL.DIVES)); } catch (e) { dives = null; }
      }
      out.duel = { dives: dives, hold: d.hold === true, deciders: d.deciders === true };
    }
    return out;
  }

  /* ================================================================
     newRound(api, variant, cfg) — one 8-kick round against the rival `variant`.
     cfg reads: rng, seed, pb, ball, stadium, member/user, challengeRound (once). api reads: sound, reduced, music.
     A challenge round (cfg.challengeRound) plays from the challenge's seed, so both devices get the
     same marker starts; in duel mode (its .duel) the keeper's moves are the pre-rolled dives (he does
     not adapt), the round waits at each kick's ready beat while round.hold is on until the challenge
     opens that kick (round.open(k)), and after kick 8 it waits for round.decide('end' | 'decider').
     ================================================================ */
  function newRound(api, variant, cfg) {
    api = api || {};
    cfg = cfg || {};
    var cr = takeChallenge(cfg), duel = cr ? cr.duel : null;
    var sound = typeof api.sound === 'function' ? api.sound : noop;
    var seed = cr ? cr.seed : (cfg.seed != null && isFinite(cfg.seed)) ? ((cfg.seed >>> 0) || 1) : ((Date.now() & 0x7fffffff) || 9);
    var r = !cr && typeof cfg.rng === 'function' ? cfg.rng : mkRng(seed);
    var ri = Math.max(0, rivalIndex(variant)), rival = RIVALS[ri];
    var pb0 = {};
    Object.keys(cfg.pb || {}).forEach(function (k) { pb0[k] = cfg.pb[k]; });
    var best0 = bestFor(pb0, rival.id);
    var look = lookFor(cfg);

    var s = {
      seed: seed, rival: rival.id, rivalIdx: ri,
      /* progress */
      shot: 0, phase: 'ready', phaseT: 0, clock: 0, aimT: 0, idleT: 0, intro: true, final: false,
      /* aim */
      ax: (AIM_X0 + AIM_X1) / 2, ay: AIM_Y1, lockX: null, lockY: null, sweepX: 0, sweepY: 0, speed: 0, nudged: false,
      /* keeper */
      dive: 'stay', tell: tellAt(rival.id, 'stay', 0, 0), keeperT: 0,
      /* kick */
      flight: 0, slow: 1, close: false, replay: false, pending: null, result: null, kind: null, resT: 0, resLen: T.RESULT,
      /* QA2C-2: a kick aimed with no tap at all (both locks automatic) is a gentle centre shot */
      autoX: false, autoKick: false, autoKicks: 0,
      /* meter */
      hype: 0, encore: false, streak: 0, bestStreak: 0, nonGoalRun: 0, boost: false, help: false,
      /* totals */
      goals: 0, corners: 0, starStrikes: 0, posts: 0, score: 0, boostsUsed: 0, topSlows: 0,
      history: { left: 0, right: 0, mid: 0 }, log: [], ev: [], evN: 0,
      kickSent: false, needSync: true, finished: false,
      /* rushed kicks (ES-1): this kick was read; the round's count, and how many of them were saved */
      rushed: false, rushedN: 0, rushedSaves: 0,
      /* challenges (ES-2). kick: the challenge's kick number (0-7, then 8 + decider - 1, so a retake
         keeps its number); decider: 0, or which decider kick this is (1-5); deciders: their results
         (never in score, goals or hype); held: waiting at the gate (holdT s so far); waitDecide:
         after kick 8, waiting for the challenge to say 'end' or 'decider' (decideT s so far) */
      challenge: !!cr, duel: !!duel, kick: 0, decider: 0, deciders: [], held: false, holdT: 0, openK: -1, readyMin: 0,
      waitDecide: false, decideT: 0, queued: null
    };

    /* events go out only while the shell asks for them (Node tests never accumulate) */
    function emit(type, o) {
      if (!round.wantEvents) return;
      var e = o || {};
      e.n = ++s.evN; e.t = type; e.type = type;
      s.ev.push(e);
      if (s.ev.length > 32) s.ev.splice(0, s.ev.length - 32);
      if (round.events && typeof round.events.push === 'function') round.events.push(e);
    }
    function snd(name, vol, step) { try { sound(name, vol, step); } catch (e) {} }
    function music(method) {
      var m = api.music;
      if (!m || typeof m[method] !== 'function') return false;
      try { m[method].apply(m, Array.prototype.slice.call(arguments, 1)); } catch (e) {}
      return true;
    }
    function musicHype(h) {
      if (!api.music) return;
      music('layers', h);
      music('set', 'hype', h / 4);
      music('set', 'fever', h >= 4);
    }
    function musicLowpass(hz, sec) { if (!music('lowpass', hz, sec)) music('set', 'lowpass', hz); }

    function chooseDive() {
      if (duel) {
        /* duel mode: the pre-rolled move for this kick number, and no adapting (both children face the
           same keeper). One value is still drawn, so the marker starts follow the seed on both devices */
        var x0 = r(), want = duel.dives && duel.dives[s.kick], w = DUEL.WEIGHTS;
        return want || (x0 < w.left ? 'left' : x0 < w.left + w.stay ? 'stay' : 'right');
      }
      /* the keeper "learns": leans toward the side you've used most */
      var wl = 0.36 + Math.min(0.24, s.history.left * 0.08), wr = 0.36 + Math.min(0.24, s.history.right * 0.08), wm = 0.28 + Math.min(0.2, s.history.mid * 0.08);
      var tot = wl + wr + wm, x = r() * tot;
      return x < wl ? 'left' : x < wl + wm ? 'stay' : 'right';
    }
    function posX(ph) { return (AIM_X0 + AIM_X1) / 2 + tri(ph) * (AIM_X1 - AIM_X0) / 2; }
    function posY(ph) { return (AIM_Y0 + AIM_Y1) / 2 + tri(ph + Math.PI / 2) * (AIM_Y1 - AIM_Y0) / 2; }

    /* the ready beat's clean slate (no draw from the seed: a decider wait may never become a kick) */
    function resetKick() {
      s.phase = 'ready'; s.phaseT = 0; s.aimT = 0; s.idleT = 0;
      s.intro = s.shot === 0; s.final = s.shot === SHOTS - 1;
      s.lockX = s.lockY = null; s.flight = 0; s.keeperT = 0; s.slow = 1; s.close = false; s.replay = false;
      s.pending = null; s.result = null; s.kind = null; s.resT = 0; s.resLen = T.RESULT; s.nudged = false; s.kickSent = false;
      s.rushed = false; s.held = false; s.holdT = 0; s.readyMin = 0;
      s.autoX = false; s.autoKick = false;
    }
    /* keepBeat: a decider that starts out of the decider wait keeps the ready clock running (the views
       ease the camera on it) and gets a full ready beat from now */
    function nextShot(keepBeat) {
      var pt = s.phaseT;
      resetKick();
      if (keepBeat) { s.phaseT = pt; s.readyMin = pt + T.READY; }
      s.kick = s.decider ? SHOTS + s.decider - 1 : s.shot;
      s.sweepX = r() * TAU;                                  /* start the marker somewhere different */
      s.dive = chooseDive();
      s.help = (s.shot < 2 && best0 < 400) || s.boost;
      /* a decider is never faster than the round's own final kick */
      s.speed = sweepSpeed(ri, Math.min(s.shot, SHOTS - 1), s.hype, s.boost);
      s.ax = posX(s.sweepX);
      tellAt(rival.id, s.dive, 0, s.clock, s.tell);
    }
    function enterAimX() {
      s.phase = 'aimX'; s.phaseT = 0; s.aimT = 0; s.idleT = 0; s.nudged = false;
      if (s.openK === s.kick) s.openK = s.kick - 1;           /* this opening is used: a retake needs its own */
      if (s.shot === 0) snd('whistle');
      emit('aim', { shot: s.shot });
    }
    /* the gate (duel mode): while round.hold is on, a kick starts only once the challenge opened it */
    function gated() { return round.hold === true && s.openK < s.kick; }
    function lockX(auto) {
      s.lockX = Math.round(s.ax); s.autoX = !!auto;
      snd('tick');
      /* ES-1: a side tapped before the tell can be read is read by the keeper. He dives to the locked
         side and his tell jumps to it at full strength, so the tell on show is always the real dive.
         An auto-lock is never rushed. (1e-6: 36 steps of 1/120 s are 0.30 s, not a rushed 0.2999…) */
      var rushed = !auto && s.aimT < T.RUSH_T - 1e-6;
      if (rushed) {
        s.dive = s.lockX < MID - 88 ? 'left' : s.lockX > MID + 88 ? 'right' : 'stay';
        s.rushed = true; s.rushedN++;
        tellAt(rival.id, s.dive, FULL_TELL, s.clock, s.tell);
      }
      if (auto) emit('autoLock', { axis: 'x' });
      emit('lockX', { x: s.lockX, auto: !!auto });
      if (rushed) emit('rushed', { shot: s.shot, kick: s.kick, dive: s.dive, x: s.lockX });
      s.phase = 'aimY'; s.phaseT = 0; s.idleT = 0; s.nudged = false;
      s.sweepY = r() * TAU; s.ay = posY(s.sweepY);
      if (s.final || s.decider) { snd('heartbeat'); musicLowpass(800, 0.3); }
    }
    function lockY(auto) {
      s.lockY = Math.round(s.ay);
      if (auto) emit('autoLock', { axis: 'y' });
      /* QA2C-2: no tap for the side or the height — the round plays no kick for the child. The
         ball rolls gently to the middle and the keeper, staying put, gathers it: 0 points, no
         hype either way, no slow motion, and the keeper learns nothing from it */
      if (auto && s.autoX) {
        s.autoKick = true; s.lockX = AUTO_SHOT.x; s.lockY = AUTO_SHOT.y; s.dive = 'stay';
        tellAt(rival.id, s.dive, s.aimT, s.clock, s.tell);
      }
      emit('lockY', { y: s.lockY, auto: !!auto });
      if (!s.autoKick) {
        var side = s.lockX < MID - 88 ? 'left' : s.lockX > MID + 88 ? 'right' : 'mid';
        s.history[side]++;
      }
      s.phase = 'windup'; s.phaseT = 0; s.idleT = 0;
    }
    /* STRIKE: the result is decided here, once, and frozen in s.pending. A decider kick scores no
       points and is no Star Strike (it never touches the round's score); it always plays in slow-mo */
    function enterStrike() {
      var x = s.lockX, y = s.lockY, res = outcome(x, y, s.dive), dec = s.decider > 0;
      var top = res === 'goal' && isTopCorner(x, y), star = res === 'goal' && s.hype >= 4 && !dec;
      var kind = res === 'miss' ? missKind(x, y) : res;
      var pts = dec ? 0 : shotPoints(res, top, s.hype);
      var topSlow = top && s.topSlows < 2 && !dec;
      s.close = !s.autoKick && (res === 'save' || kind === 'post' || kind === 'bar' || s.final || topSlow || dec);
      if (topSlow) s.topSlows++;
      s.replay = res === 'goal' && !dec && ((top && s.corners === 0) || s.final);
      s.pending = { res: res, kind: kind, top: top, star: star, pts: pts, auto: s.autoKick };
      s.phase = 'strike'; s.phaseT = 0;
      snd('kick');
      if (s.final || dec) { musicLowpass(18000, 0.5); music('drop'); }
      emit('strike', { res: res, kind: kind, top: top, star: star, pts: pts, slow: s.close, replay: s.replay, rushed: s.rushed, decider: s.decider });
    }
    function setHype(to) {
      var from = s.hype; if (to === from) return;
      s.hype = to;
      emit('hype', { from: from, to: to });
      musicHype(to);
      if (to >= 4 && !s.encore) { s.encore = true; emit('encore', { on: true }); snd('sting'); }
      else if (to < 4 && s.encore) { s.encore = false; emit('encore', { on: false }); }
    }
    /* a decider's result: kept in s.deciders and the kick log (the views show the last logged kick),
       never in the score, goals, hype, streaks, the Cheer Boost or the medal */
    function deciderResult(p) {
      var d = { n: s.decider, kick: s.kick, shot: s.shot, x: s.lockX, y: s.lockY, dive: s.dive, res: p.res, kind: p.kind, top: p.top, rushed: s.rushed };
      s.deciders.push(d);
      if (p.res === 'save' && s.rushed) s.rushedSaves++;
      s.log.push({ x: s.lockX, y: s.lockY, dive: s.dive, res: p.res, kind: p.kind, pts: 0, top: p.top, star: false, slow: s.close, replay: false, hypeBefore: s.hype, rushed: s.rushed, decider: s.decider });
      emit('result', { res: p.res, kind: p.kind, top: p.top, star: false, pts: 0, dive: s.dive, x: s.lockX, y: s.lockY, rushed: s.rushed, decider: s.decider });
      if (p.res === 'goal') { snd('correct', 0.7); snd('applause'); }
      else if (p.res === 'save') snd('save');
      else if (p.kind === 'post' || p.kind === 'bar') { snd('boing'); snd('miss', 0.5); }
      else { snd('whoosh', 0.6); snd('miss', 0.5); }
    }
    /* RESULT: score, hype and stats change only here */
    function enterResult() {
      var p = s.pending, hb = s.hype, to;
      s.phase = 'result'; s.phaseT = 0; s.resT = 0; s.resLen = s.replay ? T.RESULT_REPLAY : T.RESULT;
      s.result = p.res; s.kind = p.kind; s.flight = 1; s.slow = 1;
      if (s.decider) { deciderResult(p); return; }
      if (p.res === 'save' && s.rushed) s.rushedSaves++;
      s.score += p.pts;
      if (p.auto) { s.autoKicks++; s.streak = 0; to = hb; }
      else if (p.res === 'goal') {
        s.goals++; if (p.top) s.corners++; if (p.star) s.starStrikes++;
        s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak;
        s.nonGoalRun = 0; to = Math.min(4, hb + 1);
      } else {
        s.streak = 0; s.nonGoalRun++;
        if (p.kind === 'post' || p.kind === 'bar') { s.posts++; to = Math.max(0, hb - 1); } else to = 0;
      }
      s.log.push({ x: s.lockX, y: s.lockY, dive: s.dive, res: p.res, kind: p.kind, pts: p.pts, top: p.top, star: p.star, slow: s.close, replay: s.replay, hypeBefore: hb, rushed: s.rushed, auto: !!p.auto });
      emit('result', { res: p.res, kind: p.kind, top: p.top, star: p.star, pts: p.pts, dive: s.dive, x: s.lockX, y: s.lockY, rushed: s.rushed, auto: !!p.auto });
      if (p.res === 'goal') {
        snd('correct', 0.7); snd('combo', 1, to);
        if (p.top) { snd('applause'); snd('powerup'); } else if (p.star) { snd('applause'); snd('star'); }
      } else if (p.auto) snd('pop', 0.5);
      else if (p.res === 'save') snd('save');
      else if (p.kind === 'post' || p.kind === 'bar') { snd('boing'); snd('miss', 0.5); }
      else { snd('whoosh', 0.6); snd('miss', 0.5); }
      setHype(to);
      if (p.auto) return;                                  /* the Cheer Boost waits for a real kick */
      var was = s.boost;
      s.boost = s.nonGoalRun >= 2;
      if (s.boost && !was) { s.boostsUsed++; emit('boost', {}); }
    }
    function endKick() {
      s.shot++;
      if (s.shot < SHOTS) { nextShot(); return; }
      /* after kick 8 a duel with deciders waits for the challenge (a solo round is done) */
      if (!duel || !duel.deciders) { round.done = true; return; }
      s.decider = 0;
      resetKick();
      s.kick = Math.min(DUEL.DIVES - 1, SHOTS + lastDecider());   /* (the next decider's number; nothing is drawn yet) */
      s.dive = 'stay'; tellAt(rival.id, 'stay', 0, s.clock, s.tell);
      s.waitDecide = true; s.decideT = 0;
      var q = s.queued; s.queued = null;
      if (q) applyDecide(q.what, q.n);
    }
    /* the last decider number played (0 before the first) */
    function lastDecider() { return s.deciders.length ? s.deciders[s.deciders.length - 1].n : 0; }
    /* round.decide(what, n): 'end' finishes the round; 'decider' plays decider n (default: the next one;
       n equal to the last one replays it, as 'retake' does: the same keeper move, after both missed) */
    function applyDecide(what, n) {
      if (what === 'end') { round.done = true; s.waitDecide = false; return true; }
      var last = lastDecider();
      if (what === 'retake') n = last;
      else if (n == null) n = last + 1;
      n = Math.floor(Number(n));
      if (!(n >= 1 && n <= DUEL.MAX_DECIDERS) || (n !== last && n !== last + 1) || s.deciders.length >= DUEL.MAX_DECIDER_KICKS) return false;
      s.waitDecide = false;
      s.decider = n;
      nextShot(true);
      emit('decider', { decider: n, kick: s.kick, shot: s.shot, retake: n === last });   /* (e.n is the event's own serial) */
      return true;
    }

    function stats() {
      return { goals: s.goals, corners: s.corners, starStrikes: s.starStrikes, posts: s.posts, bestStreak: s.bestStreak,
        boostsUsed: s.boostsUsed, medal: medalFor(s.score), encoreDance: s.goals >= 5 };
    }
    /* the rival this round's score unlocks for the first time (or null) */
    function newlyUnlocked() {
      var after = {}; Object.keys(pb0).forEach(function (k) { after[k] = pb0[k]; });
      var key = 'penalty:' + rival.id;
      if (s.score > bestFor(pb0, rival.id)) after[key] = { score: s.score };
      for (var i = 0; i < RIVALS.length; i++) if (!rivalUnlocked(pb0, RIVALS[i].id) && rivalUnlocked(after, RIVALS[i].id)) return RIVALS[i];
      return null;
    }
    /* QA2C-8: the title already names the medal, so this line never does; it names a rival only
       when the round has just unlocked him (the shell's 🎧 Try Bop button goes with it, B10) */
    function targetLine() {
      if (allAuto()) return 'Tap KICK once for the side, then again for the height.';
      var un = newlyUnlocked();
      if (un) return un.name + ' is unlocked: try him next!';
      /* the coach line (ES-1): after two or more quick kicks the keeper read and saved */
      if (s.rushedSaves >= 2) return COPY.rushedCard[1];
      if (s.goals < 5) return 'Score 5 goals to earn the ENCORE dance!';
      var top = Math.max(best0, s.score), nm = null;
      for (var i = 0; i < MEDALS.length; i++) if (top < MEDALS[i].score) { nm = MEDALS[i]; break; }
      if (nm && nm.id !== 'perfect') return 'Only ' + fmt(nm.score - top) + ' more for ' + nm.name + '!';
      if (nm) return 'Only ' + fmt(nm.score - top) + ' more for a Perfect Show!';
      return '';
    }
    /* kick 8 has landed and nothing follows it (no deciders to wait for): the round's score is final */
    function lastKickLanded() { return s.phase === 'result' && !s.decider && s.shot >= SHOTS - 1 && !(duel && duel.deciders); }
    /* QA2C-2: every kick of the round went with no tap: nothing to save, no medal */
    function allAuto() { return s.autoKicks >= SHOTS; }
    function kickLine() { return s.decider ? COPY.deciderChip + ' ' + s.decider : s.waitDecide ? COPY.allKicks : s.final ? 'FINAL KICK' : 'kick ' + Math.min(SHOTS, s.shot + 1) + ' of ' + SHOTS; }

    /* the intro can be tapped away (never past a closed gate or the decider wait) */
    function canSkip() { return s.phase === 'ready' && s.intro && s.phaseT >= T.INTRO_SKIP && !s.waitDecide && !gated(); }
    /* the ready beat: the kick event, the keeper at rest, then aiming once the beat is over and (duel
       mode) the challenge has opened the kick; a gate that held gets one short beat after it opens */
    function stepReady(dt) {
      if (s.waitDecide) {
        tellAt(rival.id, 'stay', 0, s.clock, s.tell);
        s.decideT += dt;
        if (s.decideT >= DUEL.DECIDE_MAX) applyDecide('end');
        return;
      }
      if (!s.kickSent) { s.kickSent = true; emit('kick', { shot: s.shot, final: s.final, rival: s.rival, kick: s.kick, decider: s.decider }); }
      tellAt(rival.id, s.dive, 0, s.clock, s.tell);
      if (s.phaseT < Math.max(s.intro ? T.INTRO : T.READY, s.readyMin)) return;
      if (gated() && s.holdT < DUEL.HOLD_MAX) { s.held = true; s.holdT += dt; return; }
      if (s.held) { s.held = false; s.readyMin = s.phaseT + DUEL.OPEN_BEAT; return; }
      enterAimX();
    }

    nextShot();
    var paint = makePainter(s, look, api, rival, canSkip, personSprites(cfg, look.sig));
    var round = {
      done: false, state: s, wantEvents: false, events: [],
      /* duel mode: the gate is on (the challenge opens each kick with open(k), or turns hold off) */
      hold: !!(duel && duel.hold),
      /* what this round was set up with by the challenge (null for a solo round), for the lobby's wrap */
      challengeRound: cr,
      step: function (dt) {
        if (round.done) return;
        if (s.needSync) { s.needSync = false; music('sync', s.clock); }   /* music anchors to the logic clock */
        s.clock += dt; s.phaseT += dt;
        switch (s.phase) {
          case 'ready':
            stepReady(dt);
            break;
          case 'aimX':
          case 'aimY':
            s.aimT += dt; s.idleT += dt;
            if (s.phase === 'aimX') { s.sweepX += dt * s.speed * TAU; s.ax = posX(s.sweepX); }
            else { s.sweepY += dt * s.speed * 1.1 * TAU; s.ay = posY(s.sweepY); }
            /* a rushed kick's tell stays at full strength: the keeper has already shown his dive */
            tellAt(rival.id, s.dive, s.rushed ? Math.max(s.aimT, FULL_TELL) : s.aimT, s.clock, s.tell);
            if (!s.nudged && s.idleT >= T.NUDGE) { s.nudged = true; emit('nudge', { axis: s.phase === 'aimX' ? 'x' : 'y' }); }
            if (s.idleT >= T.AUTOLOCK) { if (s.phase === 'aimX') lockX(true); else lockY(true); }
            break;
          case 'windup':
            if (s.phaseT >= T.WINDUP) enterStrike();
            break;
          case 'strike':
            if (s.phaseT >= T.HITSTOP) { s.phase = 'flight'; s.phaseT = 0; }
            break;
          case 'flight':
            /* 'close' kicks run at 0.3× through the slow window; the keeper's dive scales with them */
            var k = (s.close && s.flight >= T.SLOW_F0 && s.flight < T.SLOW_F1) ? T.SLOW : 1;
            if (k !== s.slow) { s.slow = k; emit('slow', { on: k < 1 }); }
            s.flight = Math.min(1, s.flight + dt / T.FLIGHT * k);
            s.keeperT = Math.min(1, s.keeperT + dt / T.DIVE * k);
            if (s.flight >= 1) enterResult();
            break;
          case 'result':
            s.resT += dt;
            if (s.resT >= s.resLen) endKick();
            break;
        }
      },
      input: function (id, down) {
        if (id !== 'kick' || !down || round.done) return;
        if (s.phase === 'ready') { if (canSkip()) enterAimX(); }
        else if (s.phase === 'aimX') { if (s.phaseT >= T.GUARD) lockX(false); }
        else if (s.phase === 'aimY') { if (s.phaseT >= T.GUARD) lockY(false); }
        else if (s.phase === 'result') { if (s.resT >= T.SKIP_AFTER) endKick(); }
      },
      /* duel mode: the challenge opens kick k (its kick number, s.kick: 0-7, then 8 + decider - 1),
         now or before this device gets there; each opening starts one kick */
      open: function (k) {
        k = Math.floor(Number(k));
        if (!duel || !(k >= 0 && k < DUEL.DIVES)) return false;
        if (k > s.openK) s.openK = k;
        return true;
      },
      /* duel mode with deciders: 'end' | 'decider' (n) | 'retake'. Said before this device has finished
         its kick, it is kept for the moment it has (one at a time) → true when taken */
      decide: function (what, n) {
        if (!duel || !duel.deciders || round.done || (what !== 'end' && what !== 'decider' && what !== 'retake')) return false;
        if (s.waitDecide) return applyDecide(what, n);
        s.queued = { what: what, n: n };
        return true;
      },
      forceEnd: function () { round.done = true; },
      /* the shell's Exit check: the last kick of a round with no deciders has landed, so the score is
         final and 🏝️ Exit shows the results at once (endNow: that kick's replay skipped, as a tap does) */
      ended: function () { return !round.done && lastKickLanded(); },
      endNow: function () { if (round.done || !lastKickLanded()) return false; endKick(); return round.done; },
      pauseReset: function () { s.needSync = true; },
      padState: function (id) {
        if (id !== 'kick' || round.done) return '';
        if (s.phase === 'aimX') return 's1';
        if (s.phase === 'aimY') return 's2';
        if (canSkip() || (s.phase === 'result' && s.resT >= T.SKIP_AFTER)) return 'ready';
        return 'grey';
      },
      /* o.narrow (a phone held upright, QA2C-12): the short form, so 🔊 ⏸ Exit still fit — the
         canvas's kick dots say which kick it is, and the stadium itself shows ENCORE MODE */
      hud: function (o) {
        var taken = Math.min(SHOTS, s.shot + (s.phase === 'result' ? 1 : 0));
        if (o && o.narrow) return '⚽ ' + s.goals + '/' + taken + ' · ✦ ' + s.hype + ' · ' + fmt(s.score);
        return '⚽ ' + s.goals + '/' + taken + ' · ' + (s.encore ? '✦ ENCORE!' : '✦ Hype ' + s.hype) + ' · ' + fmt(s.score) + ' · ' + kickLine();
      },
      /* B11: over the 3D stadium (its LED, wands and score already show goals, Hype and points) the
         shell's pill says only which kick this is */
      hud3d: function () { return kickLine(); },
      result: function () { return allAuto() ? null : { score: s.score, extra: s.goals }; },
      stats: stats,
      onFinish: function () {
        if (s.finished) return;
        s.finished = true;
        var st = stats();
        emit('finale', { encoreDance: st.encoreDance, medal: st.medal });
        if (st.encoreDance) music('play', 'island_showtime');
      },
      /* one medal vocabulary in this game: Bronze, Silver, Gold, Perfect ('Superstar' is a Debut Run medal) */
      summaryTitle: function () {
        if (allAuto()) return '⚽ Ready when you are!';
        var m = medalFor(s.score);
        return m === 'perfect' ? 'PERFECT SHOW! 🎤' : m === 'gold' ? '🥇 GOLD: Amazing shooting!' : m === 'silver' ? '🥈 SILVER: Brilliant shooting!' :
          m === 'bronze' ? '🥉 BRONZE: Great shooting!' : 'Good practice! Watch the tell!';
      },
      summaryBig: function () { return s.goals + ' / ' + SHOTS + ' goals · ' + fmt(s.score); },
      /* the kicks in numbers (behind 📊 Details on the results) */
      summaryText: function () {
        var parts = ['Best hype streak ' + s.bestStreak];
        if (s.corners) parts.push(s.corners + ' top corner' + (s.corners > 1 ? 's' : ''));
        if (s.starStrikes) parts.push(s.starStrikes + ' star strike' + (s.starStrikes > 1 ? 's' : ''));
        if (s.posts) parts.push(s.posts + ' so-close');
        return parts.join(' · ') + '.';
      },
      /* B7: the ONE next step (an unlock first: the shell's 🎧 Try Bop button goes with it, B10) */
      nextStep: function () { return targetLine(); },
      /* QA 25 Oct #7: each thing is said once. The title names the medal ('🥉 BRONZE: Great shooting!')
         and the next step names the rival this round opened ('Bop is unlocked: try him next!', with
         the shell's 🎧 Try Bop), so neither is a badge as well */
      summaryBadges: function () {
        var out = [], m = medalInfo(medalFor(s.score));
        if (allAuto()) return out;
        if (s.goals >= 5) out.push({ text: '🎤 ENCORE dance earned!', kind: 'ribbon' });
        if (!m) out.push({ text: 'Next: 🥉 Bronze at 400', kind: 'hint' });
        return out;
      },
      autoHeld: {},
      autopilot: function () {
        /* preview / tests: a perfect reader that aims for the top corner away from the dive; like a
           child who reads the tell, it never picks the side before RUSH_T */
        if (round.done) return;
        var wantX = s.dive === 'left' ? 640 : s.dive === 'right' ? 320 : 300;
        if (s.phase === 'aimX' && s.phaseT >= T.GUARD && s.aimT >= T.RUSH_T && Math.abs(s.ax - wantX) < 10) round.input('kick', true);
        else if (s.phase === 'aimY' && s.phaseT >= T.GUARD && Math.abs(s.ay - 190) < 8) round.input('kick', true);
      },
      render: function (ctx, opts) { paint(ctx, opts); },
      dispose: function () {}
    };
    /* a challenge round: the lobby adds its results block, Rematch and progress (the same object comes
       back: the round's own flags — done, hold, wantEvents, events — live on it) */
    var DL = cr && win() && window.SLDuelLobby;
    if (DL && typeof DL.wrap === 'function') {
      try { var wr = DL.wrap(round, cfg); if (wr && typeof wr.step === 'function') return wr; } catch (e) {}
    }
    return round;
  }

  /* ================================================================
     2D fallback renderer (960×540). Presentation is stepped by the change in
     s.clock, so it freezes with the game; one-shot effects come from s.ev.
     It never writes to the logic state.
     ================================================================ */
  var INK = COLORS.ink;
  function hexRgb(h) { var n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function outBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function starPath(ctx, x, y, r, inner) {
    ctx.beginPath();
    for (var k = 0; k < 10; k++) { var rr2 = k % 2 ? r * (inner || 0.45) : r, a = k * Math.PI / 5 - Math.PI / 2; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
  function outlinedText(ctx, txt, x, y, font, fill, lw) {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.strokeText(txt, x, y);
    ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }
  /* Bagel Fat One only once it has really loaded (document.fonts.check() is true for undeclared fonts) */
  function bagelLoaded() {
    try {
      var ok = false;
      if (typeof document !== 'undefined' && document.fonts && document.fonts.forEach) {
        document.fonts.forEach(function (f) { if (/Bagel Fat One/i.test(f.family) && f.status === 'loaded') ok = true; });
      }
      return ok;
    } catch (e) { return false; }
  }

  /* ---------------- the child's figure in 2D (kids update KU-CH19a; characters.json design.games) ----------------
     First-person stays. With the games' people helper and a character (cfg.char), a back-view sprite of the
     character stands left of the ball, below the aim area (y > 360, clear of AIM y 126-332), and takes the
     kick: 'stand' while aiming, 'runup' as it runs in through the wind-up, 'kick' from the strike, then it
     walks back to its mark; the HUD shows its head and shoulders beside the rival chip ('you vs Mochi').
     The frames come from SLPeopleArt through SLGamePeople.sprites, made once per look and colour and kept
     in memory only (the menu backdrop asks first, so they are in by the first kick). Until they arrive,
     or with no character (the classic avatar has no 2D sprite), the view is first-person as before.
     Drawing only: nothing here reads or writes a rule, a timing or a score. */
  /* standX: its mark (clear of the challenge pips panel at the bottom left); hitX: its foot at the ball;
     promptShift: the prompt line moves right while the figure is drawn, so the words never sit on it */
  var KICK2D = deepFreeze({ standX: 322, hitX: 438, footY: 528, scale: 1.2, back: 0.5, kickHold: 0.35, promptShift: 56,
    frame: { w: 72, h: 120, foot: [36, 116] }, portrait: { x: 763, y: 32, r: 18 } });
  var spriteMemo = [];
  function personSprites(cfg, color) {
    var W = win(), GP = W && W.SLGamePeople, ch = cfg && cfg.char, key;
    if (!GP || typeof GP.sprites !== 'function' || !ch || typeof ch !== 'object' || !ch.look || typeof ch.look !== 'object') return null;
    try { key = [ch.lk || JSON.stringify(ch.look), ch.wr || JSON.stringify([ch.wear || {}, ch.vr || {}]), color].join('|'); } catch (e) { return null; }
    for (var i = 0; i < spriteMemo.length; i++) if (spriteMemo[i].key === key) return spriteMemo[i];
    var m = { key: key, frames: null, portrait: null };
    spriteMemo.unshift(m);
    if (spriteMemo.length > 2) spriteMemo.length = 2;
    try {
      Promise.resolve(GP.sprites(cfg, 'shootout', { color: color })).then(function (f) { if (f && f.stand) m.frames = f; }, noop);
      Promise.resolve(GP.sprites(cfg, ['portrait'], { size: 96, color: color })).then(function (f) { if (f && f.portrait) m.portrait = f.portrait; }, noop);
    } catch (e) { /* no figure: first-person as before */ }
    return m;
  }

  function makePainter(s, look, api, rival, canSkip, ppl) {
    var reduced = !!(api && api.reduced);
    var P = { lastN: s.evN, lastClock: s.clock, fx: null, fxTried: false, show: HYPE_SHOW[s.hype] || 0,
      pipPop: [9, 9, 9, 9], pipDrop: [9, 9, 9, 9], banner: null, later: [], trail: [], trailShot: -1,
      bagel: false, fontT: 99, cornerSeen: false };
    /* the crowd: 5 rows of fans, 40% of wands in the player's signature colour.
       Fans and wand bulbs are grouped by colour so each group is ONE path + fill. */
    var FANS = ['#ff6b6b', '#ffd23f', '#4fc3f7', '#ffffff', '#c38bff', '#7bd88f'], crowd = [], fanGroups = {}, wandGroups = {};
    for (var row = 0; row < 5; row++) for (var c = 0; c < 48; c++) {
      var i = row * 48 + c, f0 = { x: 10 + c * 20 + (row % 2) * 10, y: 86 + row * 21, c: c, row: row, col: FANS[(c * 7 + row * 3) % FANS.length],
        wand: ((i * 7) % 10) < 4 ? look.sig : COLORS.wands[i % 5], h: ((i * 97 + 13) % 100) / 100, by: 0 };
      crowd.push(f0);
      (fanGroups[f0.col] = fanGroups[f0.col] || []).push(f0);
      (wandGroups[f0.wand] = wandGroups[f0.wand] || []).push(f0);
    }
    var fanCols = Object.keys(fanGroups), wandCols = Object.keys(wandGroups);
    var stars = [];
    for (var k = 0; k < 26; k++) stars.push({ x: (k * 373 + 41) % LW, y: 8 + (k * 151) % 58, p: k * 1.7 });

    function fxSys() {
      if (!P.fxTried) {
        P.fxTried = true;
        var F = win() && window.SLGameFX;
        if (F && typeof F.particles === 'function') P.fx = F.particles({ reduced: reduced, max: 240, seed: (s.seed % 99991) + 7 });
      }
      return P.fx;
    }
    function confettiColors() { var sg = look.sig; return [sg, sg, sg, sg, COLORS.wands[0], COLORS.wands[1], COLORS.wands[2], COLORS.wands[3], COLORS.wands[4], '#ffffff']; }
    function pipXY(i) { return [30 + i * 38, 32]; }
    function showBanner(title, sub, life) { P.banner = { title: title, sub: sub || '', t: 0, life: life || 1.6 }; }

    /* one-shot effects from the event queue */
    function onEvent(e) {
      var fx = fxSys();
      if (e.t === 'result') {
        if (!fx) return;
        if (e.res === 'goal') {
          if (reduced) {
            fx.burst(e.x, e.y, { n: 18, colors: confettiColors(), shape: 'star', speed: 70, life: 0.4, gravity: 0, size: 5 });
          } else {
            fx.burst(POST_L, BAR + 10, { n: 30, colors: confettiColors(), shape: 'square', speed: 420, life: 1.2, gravity: 520, drag: 1.2, size: 6, angle: -1.1, spread: 1.1 });
            fx.burst(POST_R, BAR + 10, { n: 30, colors: confettiColors(), shape: 'square', speed: 420, life: 1.2, gravity: 520, drag: 1.2, size: 6, angle: -2.04, spread: 1.1 });
          }
          if (e.top && !P.cornerSeen) {
            P.cornerSeen = true;                         /* the round's first top corner gets the gold ring */
            fx.ring(e.x, e.y, { color: COLORS.gold, r0: 10, r1: 74, life: 0.6, width: 6, optional: true });
            fx.burst(e.x, e.y, { n: 24, colors: [COLORS.gold, '#FFF3B3'], shape: 'star', speed: 230, life: 0.8, gravity: 0, size: 5 });
          }
          if (!e.decider) fx.text(e.x, e.y - 34, '+' + e.pts, { color: COLORS.gold, size: 34, life: 1.0 });   /* a decider scores no points */
        } else if (e.kind === 'post' || e.kind === 'bar') {
          var px = e.kind === 'bar' ? e.x : (e.x < MID ? POST_L : POST_R), py = e.kind === 'bar' ? BAR : e.y;
          fx.burst(px, py, { n: 12, colors: [COLORS.gold, '#FFF3B3'], shape: 'spark', speed: 280, life: 0.5, gravity: 300, size: 5 });
        } else if (e.kind === 'wide' || e.kind === 'over') {
          var sg = e.x < MID ? -1 : 1;
          P.later.push({ at: 0.6, x: e.kind === 'over' ? e.x + sg * 30 : e.x + sg * 120, y: e.kind === 'over' ? 100 : 120, what: 'hearts' });
        } else if (e.res === 'save') {
          fx.burst(e.x, e.y, { n: 8, colors: ['#ffffff', COLORS.gold], shape: 'star', speed: 150, life: 0.45, gravity: 0, size: 5 });
        }
      } else if (e.t === 'hype') {
        if (e.to > e.from) for (var i = e.from; i < e.to; i++) { P.pipPop[i] = 0; if (fx) { var q = pipXY(i); fx.ring(q[0], q[1], { color: look.sig, r0: 6, r1: 28, life: 0.35, width: 4, optional: true }); } }
        else for (var j = e.to; j < e.from; j++) P.pipDrop[j] = -(e.from - 1 - j) * 0.08;
      } else if (e.t === 'encore') {
        if (e.on) {
          showBanner('ENCORE MODE!', 'Every goal = 150!', 1.8);
          if (fx && !reduced) for (var st = 0; st < 3; st++) fx.burst(160 + st * 320, 70, { n: 8, colors: [COLORS.pink, COLORS.cyan, COLORS.violet, COLORS.gold, look.sig], shape: 'spark', speed: 220, life: 1.3, gravity: 380, size: 6, angle: Math.PI / 2, spread: 2.2 });
        }
      } else if (e.t === 'boost') {
        showBanner('The crowd’s got your back!', 'Slower aim + glove zone', 1.9);
      } else if (e.t === 'strike') {
        if (fx) {
          fx.burst(MID, 470, { n: 8, colors: ['#ffffff', COLORS.gold], shape: 'star', speed: 200, life: 0.4, gravity: 200, size: 4 });
          fx.burst(MID, 486, { n: 6, colors: [shade(look.stad[1], -30), look.stad[1]], shape: 'dot', speed: 120, life: 0.5, gravity: 500, size: 4 });
        }
      }
    }
    function consume() {
      var ev = s.ev;
      for (var i = 0; i < ev.length; i++) { var e = ev[i]; if (e.n > P.lastN) { P.lastN = e.n; onEvent(e); } }
    }
    function advance(dt) {
      var fx = fxSys(); if (fx) fx.step(dt);
      /* day → Showtime blend: 1.6 s up, 0.8 s down (0.25 s with reduced motion) */
      var target = HYPE_SHOW[s.hype] || 0;
      if (P.show < target) P.show = Math.min(target, P.show + dt / (reduced ? 0.25 : 1.6));
      else if (P.show > target) P.show = Math.max(target, P.show - dt / (reduced ? 0.25 : 0.8));
      for (var i = 0; i < 4; i++) { P.pipPop[i] += dt; P.pipDrop[i] += dt; }
      if (P.banner) { P.banner.t += dt; if (P.banner.t >= P.banner.life) P.banner = null; }
      for (var j = P.later.length - 1; j >= 0; j--) {
        var L = P.later[j]; L.at -= dt;
        if (L.at <= 0) {
          P.later.splice(j, 1);
          if (fx && L.what === 'hearts') for (var h = 0; h < (reduced ? 3 : 6); h++) fx.text(L.x + (h - 2.5) * 12, L.y - (h % 2) * 8, '♥', { color: COLORS.wands[0], size: 20, vy: -45, life: 0.9, stroke: null });
        }
      }
      if (P.fontT > 2) { P.fontT = 0; if (!P.bagel) P.bagel = bagelLoaded(); }
      P.fontT += dt;
    }
    function bigFont(px) { return P.bagel ? px + 'px "Bagel Fat One", "Baloo 2", sans-serif' : '800 ' + px + 'px "Baloo 2", sans-serif'; }

    /* ---------- keeper: one goalie-blob with 4 skins; pose built from the tell / dive ---------- */
    function keeperPose() {
      var t = s.tell, dir = s.dive === 'left' ? -1 : s.dive === 'right' ? 1 : 0;
      var lean = t.lean || 0, cr = t.crouch || 0;
      var hop = (t.hop || 0) * 9 * Math.abs(Math.sin(Math.PI * ((s.clock / T.BEAT) % 1)));
      var bounce = (s.phase === 'ready' && !reduced) ? 3 * Math.abs(Math.sin(s.clock * 7)) : 0;
      var leanRot = lean * 0.2618, sy = 1 - 0.1 * cr, h = 58 * sy;
      var fx0 = MID + (t.step || 0) * U + lean * 9.2, fy = LINE - hop - bounce;
      var p = { cx: fx0 + Math.sin(leanRot) * h, cy: fy - Math.cos(leanRot) * h, rot: leanRot, sx: 1 + 0.08 * cr, sy: sy,
        g: [{ x: -47, y: -15, s: 1, glow: 0 }, { x: 47, y: -15, s: 1, glow: 0 }], face: 'calm', eye: lean * 3, lead: dir > 0 ? 1 : 0, wave: 0 };
      if (lean) { var gi = lean < 0 ? 0 : 1, a = Math.abs(lean), sg = gi ? 1 : -1; p.g[gi].x = sg * lerp(47, 38, a); p.g[gi].y = lerp(-15, -33, a); }
      if (cr) for (var q = 0; q < 2; q++) { p.g[q].x = (q ? 1 : -1) * lerp(Math.abs(p.g[q].x), 30, cr); p.g[q].y = lerp(p.g[q].y, 0, cr); p.g[q].s = 1 + 0.15 * cr; }
      p.g[0].y -= 23 * (t.gloveL || 0); p.g[0].glow = t.gloveL || 0;
      p.g[1].y -= 23 * (t.gloveR || 0); p.g[1].glow = t.gloveR || 0;
      if (s.phase === 'aimY' && s.lockX > POST_L + 6 && s.lockX < POST_R - 6 && s.ay > BAR + 6 && isTopCorner(s.lockX, s.ay)) p.face = 'worried';
      if (s.phase !== 'flight' && s.phase !== 'result') return p;
      /* the dive: end poses match REACH, so what you see is what counts */
      var k = s.phase === 'result' ? 1 : 1 - (1 - s.keeperT) * (1 - s.keeperT), b = { cx: p.cx, cy: p.cy, rot: p.rot };
      p.face = 'calm'; p.eye = 0; p.sx = lerp(p.sx, 1, k); p.sy = lerp(p.sy, 1, k);
      var targets;
      if (dir) {
        p.cx = lerp(b.cx, MID + dir * 126, k); p.cy = lerp(b.cy, 244, k) - Math.sin(k * Math.PI) * 18; p.rot = lerp(b.rot, dir * 1.31, k);
        targets = dir < 0 ? [[-8, -74], [10, -64]] : [[-10, -64], [8, -74]];
      } else {
        p.cy = lerp(b.cy, LINE - 78, k); p.cx = lerp(b.cx, MID, k); p.rot = lerp(b.rot, 0, k);
        targets = [[-72, -75], [72, -75]];
      }
      for (var n = 0; n < 2; n++) { p.g[n].x = lerp(p.g[n].x, targets[n][0], k); p.g[n].y = lerp(p.g[n].y, targets[n][1], k); p.g[n].s = 1; }
      var save = (s.phase === 'result' ? s.result : s.pending && s.pending.res) === 'save';
      if (!dir) p.lead = s.lockX < MID ? 0 : 1;
      if (save) {
        /* the near glove snaps onto the ball's endpoint (computed against the end pose) */
        var endCx = dir ? MID + dir * 126 : MID, endCy = dir ? 244 : LINE - 78, endRot = dir * 1.31;
        var dx = s.lockX - endCx, dy = s.lockY - endCy, cs = Math.cos(-endRot), sn = Math.sin(-endRot);
        var lx = dx * cs - dy * sn, ly = dx * sn + dy * cs, w = s.phase === 'result' ? 1 : clamp01((s.flight - 0.6) / 0.25);
        p.g[p.lead].x = lerp(p.g[p.lead].x, lx, w); p.g[p.lead].y = lerp(p.g[p.lead].y, ly, w); p.g[p.lead].s = 1 + 0.25 * w;
        p.face = 'happy';
      }
      if (s.phase === 'result') {
        var fl = clamp01(s.resT / 0.35);
        if (dir) {
          /* a comic belly-flop onto the grass, then (after a save) dizzy sparkles and a friendly wave */
          p.cy = lerp(244, LINE - 34, fl) - (fl >= 1 && !reduced ? Math.max(0, Math.sin((s.resT - 0.35) * 14)) * 6 * Math.max(0, 1 - (s.resT - 0.35) * 3) : 0);
          p.rot = lerp(dir * 1.31, dir * 1.5708, fl);
          if (save && s.resT > 0.35 && s.resT < 1.2) p.face = 'dizzy';
        } else p.cy = lerp(LINE - 78, LINE - 58, fl);
        if (save && s.resT > 1.2) p.wave = Math.sin((s.resT - 1.2) * 8) * 8;
        p.g[1 - p.lead].y += p.wave;
      }
      return p;
    }
    function toWorld(p, x, y) {
      var X = x * p.sx, Y = y * p.sy, c = Math.cos(p.rot), sn = Math.sin(p.rot);
      return [p.cx + X * c - Y * sn, p.cy + X * sn + Y * c];
    }
    function drawKeeper(ctx, p) {
      var jersey = rival.jersey, dark = shade(jersey, -45);
      ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot); ctx.scale(p.sx, p.sy);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      /* stubby legs */
      ctx.fillStyle = dark; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ell(ctx, -15, 48, 11, 12); ctx.fill(); ctx.stroke(); ell(ctx, 15, 48, 11, 12); ctx.fill(); ctx.stroke();
      /* arms, then the bean body */
      ctx.strokeStyle = INK; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(-22, -14); ctx.lineTo(p.g[0].x, p.g[0].y); ctx.moveTo(22, -14); ctx.lineTo(p.g[1].x, p.g[1].y); ctx.stroke();
      ctx.strokeStyle = shade(jersey, -18); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-22, -14); ctx.lineTo(p.g[0].x, p.g[0].y); ctx.moveTo(22, -14); ctx.lineTo(p.g[1].x, p.g[1].y); ctx.stroke();
      ctx.fillStyle = jersey; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ell(ctx, 0, 0, 34, 56); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ell(ctx, 0, 18, 21, 24); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -14, -34, 7, 12); ctx.fill();
      /* skin accessories */
      if (rival.tell === 'lean') { ctx.fillStyle = rival.trim; rr(ctx, -31, -45, 62, 9, 4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
      else if (rival.tell === 'beat') {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -26, 36, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = rival.trim; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ell(ctx, -35, -24, 8, 12); ctx.fill(); ctx.stroke(); ell(ctx, 35, -24, 8, 12); ctx.fill(); ctx.stroke();
      } else if (rival.tell === 'mirror') {
        var vg = ctx.createLinearGradient(0, -48, 0, -34); vg.addColorStop(0, '#FFFFFF'); vg.addColorStop(0.6, '#DDE3F0'); vg.addColorStop(1, '#9AA3B8');
        ctx.fillStyle = vg; rr(ctx, -31, -48, 62, 13, 6); ctx.fill(); ctx.strokeStyle = '#C7B8FF'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      drawFace(ctx, p);
      /* puff gloves (Glowy's glow is a thicker ring + a ✦, never colour alone) */
      for (var i = 0; i < 2; i++) {
        var g = p.g[i], r = 15 * g.s;
        if (g.glow > 0.05) { ctx.fillStyle = rgba(COLORS.cyan, 0.35 * g.glow); ell(ctx, g.x, g.y, r + 12, r + 12); ctx.fill(); }
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ell(ctx, g.x, g.y, r, r); ctx.fill(); ctx.stroke();
        if (rival.tell === 'glove') {
          ctx.fillStyle = g.glow > 0.05 ? COLORS.cyan : '#7FB8C8'; ell(ctx, g.x, g.y, 5.5, 5.5); ctx.fill();
          if (g.glow > 0.05) {
            ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 3 + 3 * g.glow; ell(ctx, g.x, g.y, r + 4, r + 4); ctx.stroke();
            ctx.fillStyle = '#FFF3B3'; starPath(ctx, g.x + (i ? 20 : -20), g.y - 18, 7 * g.glow + 3, 0.4); ctx.fill();
          }
        }
      }
      ctx.restore();
      /* world-space extras */
      var head = toWorld(p, 0, -56);
      if (rival.tell === 'mirror' && s.phase !== 'flight' && s.phase !== 'result') {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ell(ctx, head[0], head[1] - 32, 16, 14); ctx.fill(); ctx.stroke();
        outlinedText(ctx, '⇄', head[0], head[1] - 32, '800 20px "Baloo 2", sans-serif', COLORS.pink, 0.01);
      }
      if (p.face === 'dizzy') {
        for (var d = 0; d < 3; d++) {
          var a = s.clock * 3 + d * 2.094;
          ctx.fillStyle = COLORS.gold; starPath(ctx, head[0] + Math.cos(a) * 22, head[1] - 22 + Math.sin(a) * 7, 6, 0.42); ctx.fill();
        }
      }
    }
    function drawFace(ctx, p) {
      var ex = p.eye;
      ctx.fillStyle = 'rgba(255,128,170,0.45)'; ell(ctx, -21, -8, 6, 3.5); ctx.fill(); ell(ctx, 21, -8, 6, 3.5); ctx.fill();
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.5;
      if (p.face === 'happy') {
        ctx.beginPath(); ctx.arc(-11, -20, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(11, -20, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (p.face === 'dizzy') {
        for (var e = -1; e <= 1; e += 2) { ctx.beginPath(); ctx.arc(e * 11, -22, 6, 0, Math.PI * 1.6); ctx.moveTo(e * 11 + 3, -22); ctx.arc(e * 11, -22, 3, 0, Math.PI * 1.5); ctx.stroke(); }
      } else {
        ell(ctx, -11 + ex, -22, 6.5, 8); ctx.fill(); ell(ctx, 11 + ex, -22, 6.5, 8); ctx.fill();
        ctx.fillStyle = '#ffffff'; ell(ctx, -13 + ex, -25, 2.3, 2.3); ctx.fill(); ell(ctx, 9 + ex, -25, 2.3, 2.3); ctx.fill();
        if (p.face === 'worried') {
          ctx.beginPath(); ctx.moveTo(-18, -36); ctx.lineTo(-6, -33); ctx.moveTo(18, -36); ctx.lineTo(6, -33); ctx.stroke();
          ctx.fillStyle = '#9FDcff'; ctx.beginPath(); ctx.moveTo(30, -44); ctx.quadraticCurveTo(36, -34, 30, -30); ctx.quadraticCurveTo(24, -34, 30, -44); ctx.fill();
        }
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath();
      if (p.face === 'worried') { ell(ctx, 0, -6, 3.5, 4); ctx.stroke(); } else { ctx.arc(0, -11, 7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    }

    /* ---------- the ball ---------- */
    function ballState(pose) {
      var b = { x: MID, y: 470, r: 22, sx: 1, sy: 1, behind: false };
      if (s.phase === 'strike') { b.sx = 1.3; b.sy = 0.75; }
      if (s.phase !== 'flight' && s.phase !== 'result') return b;
      var f = s.phase === 'result' ? 1 : s.flight, e = 1 - (1 - f) * (1 - f);
      b.x = MID + (s.lockX - MID) * e; b.y = 470 + (s.lockY - 470) * e - Math.sin(f * Math.PI) * 40; b.r = 22 - 10 * e;
      var res = s.phase === 'result' ? s.result : s.pending && s.pending.res;
      if (res === 'goal' && f > 0.85) b.behind = true;
      if (res === 'save' && (s.phase === 'result' || s.flight > 0.96)) { var w = toWorld(pose, pose.g[pose.lead].x, pose.g[pose.lead].y); b.x = w[0]; b.y = w[1]; return b; }
      if (s.phase !== 'result') return b;
      var t = clamp01(s.resT / 0.6), sg = s.lockX < MID ? -1 : 1;
      if (s.kind === 'goal') { var dd = clamp01((s.resT - 0.15) / 0.45); b.y = s.lockY + (LINE - 12 - s.lockY) * dd * dd; }
      else if (s.kind === 'post') { b.x = s.lockX + sg * 70 * t; b.y = s.lockY + 110 * t - Math.sin(t * Math.PI) * 40; b.r = 12 + 8 * t; }
      else if (s.kind === 'bar') { b.y = s.lockY - Math.sin(t * Math.PI) * 30 + 140 * t; b.r = 12 + 6 * t; }
      else if (s.kind === 'wide' || s.kind === 'over') {
        var tx = s.kind === 'over' ? s.lockX + sg * 30 : s.lockX + sg * 120, ty = s.kind === 'over' ? 100 : 120;
        b.x = lerp(s.lockX, tx, t); b.y = lerp(s.lockY, ty, t) - Math.sin(t * Math.PI) * 30; b.r = lerp(12, 7, t);
      }
      return b;
    }
    function drawBall(ctx, b) {
      if (b.y + b.r > 200) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(ctx, b.x, Math.max(b.y + b.r, LINE) + 4, b.r, b.r * 0.35); ctx.fill(); }
      /* comet trail in the ball's accent colour */
      for (var i = 0; i < P.trail.length; i++) {
        var q = P.trail[i], a = (i + 1) / (P.trail.length + 1);
        ctx.fillStyle = rgba(look.ball === 'ball_rainbow' ? RAINBOW[i % RAINBOW.length] : (BALL_TRAIL[look.ball] || '#ffffff'), 0.35 * a);
        ell(ctx, q[0], q[1], q[2] * (0.4 + 0.5 * a), q[2] * (0.4 + 0.5 * a)); ctx.fill();
      }
      if (s.encore) { ctx.fillStyle = rgba(look.sig, 0.35); ell(ctx, b.x, b.y, b.r * 1.7, b.r * 1.7); ctx.fill(); ctx.strokeStyle = look.sig; ctx.lineWidth = 3; ell(ctx, b.x, b.y, b.r * 1.35, b.r * 1.35); ctx.stroke(); }
      ctx.fillStyle = look.ballCol[0]; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * b.sx, b.r * b.sy, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = look.ballCol[1]; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.15, b.y - b.r * 0.1, b.r * 0.38 * b.sx, b.r * 0.38 * b.sy, 0, 0, TAU); ctx.fill();
    }
    function updateTrail(b, dt) {
      if (P.trailShot !== s.shot) { P.trail.length = 0; P.trailShot = s.shot; }
      if (s.phase === 'flight' && dt > 0) { P.trail.push([b.x, b.y, b.r]); if (P.trail.length > 6) P.trail.shift(); }
      else if (s.phase !== 'flight' && P.trail.length && dt > 0) P.trail.shift();
    }

    /* ---------- the stadium ---------- */
    function drawSky(ctx) {
      var L = P.show, dTop = look.night ? '#14143a' : look.stad[0], dBot = look.night ? '#2b2a5e' : '#d8f0ff';
      var g = ctx.createLinearGradient(0, 0, 0, 260);
      g.addColorStop(0, mix(dTop, COLORS.showSky[0], L)); g.addColorStop(0.5, mix(mix2(dTop, dBot), COLORS.showSky[1], L)); g.addColorStop(1, mix(dBot, COLORS.showSky[2], L));
      ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
      var starA = look.night ? 1 : clamp01((L - 0.5) * 2);
      if (starA > 0) {
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          ctx.globalAlpha = starA * (reduced ? 0.8 : 0.55 + 0.45 * Math.sin(s.clock * 1.5 + st.p));
          ctx.fillStyle = '#FFF6D8'; ctx.fillRect(st.x, st.y, 2.5, 2.5);
        }
        ctx.globalAlpha = 1;
      }
      if (look.night) [[90, 40], [870, 40]].forEach(function (p) { ctx.fillStyle = 'rgba(255,246,168,0.25)'; ell(ctx, p[0], p[1], 80, 80); ctx.fill(); ctx.fillStyle = '#fff6a8'; ctx.fillRect(p[0] - 30, p[1] - 10, 60, 18); });
    }
    function mix2(a, b) { var A = hexRgb(a), B = hexRgb(b); return '#' + ((1 << 24) + (((A[0] + B[0]) >> 1) << 16) + (((A[1] + B[1]) >> 1) << 8) + ((A[2] + B[2]) >> 1)).toString(16).slice(1); }
    function drawStands(ctx, menu) {
      ctx.fillStyle = mix(look.night ? '#24204a' : '#5b6a8f', '#2a1f55', P.show); ctx.fillRect(0, 70, LW, 120);
      var lit = menu ? 0 : (WANDS_LIT[s.hype] || 0.25), pulse = s.final && !reduced ? 0.6 + 0.4 * Math.sin(s.clock * TAU) : 1;
      var goal = !menu && s.phase === 'result' && s.result === 'goal', i, j, f, g;
      for (i = 0; i < crowd.length; i++) {
        f = crowd[i]; f.by = f.y;
        if (!reduced) {
          f.by += Math.sin(s.clock * 6 + f.c * 0.7 + f.row) * (goal ? 2 : 1);
          if (goal) { var wv = 1 - Math.abs(s.resT * 60 - f.c) / 4; if (wv > 0) f.by -= wv * 11; }   /* the crowd wave */
        }
      }
      if (lit > 0) {
        /* glow wands switch on with the hype; they pulse at 1 Hz on the final kick */
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.beginPath();
        for (i = 0; i < crowd.length; i++) { f = crowd[i]; if (f.h < lit) { ctx.moveTo(f.x + 4, f.by - 3); ctx.lineTo(f.x + 6, f.by - 12); } }
        ctx.stroke();
        ctx.globalAlpha = pulse;
        for (j = 0; j < wandCols.length; j++) {
          g = wandGroups[wandCols[j]]; ctx.fillStyle = wandCols[j]; ctx.beginPath();
          for (i = 0; i < g.length; i++) { f = g[i]; if (f.h < lit) { ctx.moveTo(f.x + 9.6, f.by - 14); ctx.arc(f.x + 6, f.by - 14, 3.6, 0, TAU); } }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      for (j = 0; j < fanCols.length; j++) {
        g = fanGroups[fanCols[j]]; ctx.fillStyle = fanCols[j]; ctx.beginPath();
        for (i = 0; i < g.length; i++) { f = g[i]; ctx.moveTo(f.x + 6, f.by); ctx.arc(f.x, f.by, 6, 0, TAU); }
        ctx.fill();
      }
    }
    function drawCones(ctx) {
      var n = CONES[s.hype] || 0; if (!n) return;
      var res = s.phase === 'result' && s.result === 'goal';
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, LW, res ? LINE : BAR); ctx.clip();
      var src = [[70, -10, 1.05, COLORS.pink], [890, -10, Math.PI - 1.05, COLORS.cyan], [MID, -30, Math.PI / 2, COLORS.violet]];
      for (var i = 0; i < n; i++) {
        var c = src[i], ang = res ? Math.atan2(s.lockY - c[1], s.lockX - c[0]) : c[2] + (reduced ? 0 : 0.436 * Math.sin(TAU * 0.12 * s.clock + i * 2.094));
        var len = res ? 520 : 330, half = 0.16, ex = c[0] + Math.cos(ang) * len, ey = c[1] + Math.sin(ang) * len;
        var g = ctx.createLinearGradient(c[0], c[1], ex, ey); g.addColorStop(0, rgba(c[3], 0.18)); g.addColorStop(1, rgba(c[3], 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c[0], c[1]);
        ctx.lineTo(c[0] + Math.cos(ang - half) * len, c[1] + Math.sin(ang - half) * len); ctx.lineTo(c[0] + Math.cos(ang + half) * len, c[1] + Math.sin(ang + half) * len);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    function drawPitch(ctx) {
      var pg = ctx.createLinearGradient(0, 190, 0, LH);
      pg.addColorStop(0, look.stad[1]); pg.addColorStop(1, shade(look.stad[1], -18));
      ctx.fillStyle = pg; ctx.fillRect(0, 190, LW, LH - 190);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (var st = 0; st < 6; st++) ctx.fillRect(0, 190 + st * 60, LW, 30);
      if (P.show > 0) { ctx.fillStyle = 'rgba(26,18,64,' + (0.28 * P.show).toFixed(3) + ')'; ctx.fillRect(0, 190, LW, LH - 190); }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(120, LINE); ctx.lineTo(840, LINE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(200, LINE); ctx.lineTo(150, 440); ctx.lineTo(810, 440); ctx.lineTo(760, LINE); ctx.stroke();
      ctx.fillStyle = '#fff'; ell(ctx, MID, 476, 6, 3); ctx.fill();
      if (P.show > 0.5) { ctx.fillStyle = 'rgba(255,240,250,' + (0.3 * (P.show - 0.5)).toFixed(3) + ')'; ell(ctx, MID, LINE + 2, 70, 14); ctx.fill(); }   /* keeper follow-spot */
    }
    function drawGoal(ctx) {
      var wobL = 0, wobR = 0, wobB = 0;
      if (!reduced && s.phase === 'result' && s.resT < 0.35 && (s.kind === 'post' || s.kind === 'bar')) {
        var j = Math.sin(s.resT * 63) * 2 * (1 - s.resT / 0.35);
        if (s.kind === 'bar') wobB = j; else if (s.lockX < MID) wobL = j; else wobR = j;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(POST_L, BAR, POST_R - POST_L, LINE - BAR);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (var nx = POST_L; nx <= POST_R; nx += 20) { ctx.moveTo(nx, BAR); ctx.lineTo(nx, LINE); }
      for (var ny = BAR; ny <= LINE; ny += 20) { ctx.moveTo(POST_L, ny); ctx.lineTo(POST_R, ny); }
      ctx.stroke();
      if (s.phase === 'result' && s.kind === 'goal' && s.resT < 0.6) {
        /* the net bulges where the ball went in */
        var k = s.resT / 0.6, rad = 18 + 30 * k * (isTopCorner(s.lockX, s.lockY) ? 1.4 : 1);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = 3; ell(ctx, s.lockX, s.lockY, rad, rad * 0.8); ctx.stroke();
      }
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(POST_L + wobL, LINE); ctx.lineTo(POST_L + wobL, BAR + wobB); ctx.lineTo(POST_R + wobR, BAR + wobB); ctx.lineTo(POST_R + wobR, LINE); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    function drawZones(ctx) {
      var aiming = s.phase === 'aimX' || s.phase === 'aimY';
      if (aiming) {
        /* top corners twinkle at 0.5 Hz; the one under the reticle brightens */
        var base = reduced ? 0.5 : 0.4 + 0.25 * Math.sin(s.clock * Math.PI);
        [[POST_L + 6, MID - 88], [MID + 88, POST_R - 6]].forEach(function (z) {
          var inside = s.phase === 'aimY' && s.lockX > z[0] && s.lockX < z[1] && s.ay > BAR + 6 && s.ay < REACH.left.y0;
          if (inside) { ctx.fillStyle = 'rgba(255,210,63,0.16)'; ctx.fillRect(z[0], BAR + 6, z[1] - z[0], REACH.left.y0 - BAR - 6); }
          ctx.setLineDash([8, 6]); ctx.strokeStyle = rgba(COLORS.gold, inside ? 0.95 : base); ctx.lineWidth = inside ? 4 : 3;
          ctx.strokeRect(z[0], BAR + 6, z[1] - z[0], REACH.left.y0 - BAR - 6); ctx.setLineDash([]);
        });
      }
      var R = REACH[s.dive], a = 0;
      if (aiming && s.help) a = 0.3 * clamp01(s.aimT * T.LEAN_RATE);
      else if (s.phase === 'result' && s.result === 'save' && s.resT < 0.6) a = 0.45 * (1 - s.resT / 0.6);   /* the teaching flash */
      if (a > 0.005) {
        ctx.fillStyle = 'rgba(255,95,162,' + a.toFixed(3) + ')'; ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, LINE - R.y0);
        ctx.strokeStyle = 'rgba(255,95,162,' + Math.min(0.9, a * 2.4).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.strokeRect(R.x0, R.y0, R.x1 - R.x0, LINE - R.y0);
      }
    }
    function drawAim(ctx) {
      var ph = s.phase;
      if (ph !== 'aimX' && ph !== 'aimY' && ph !== 'windup' && ph !== 'strike') return;
      ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(AIM_X0, LINE + 14); ctx.lineTo(AIM_X1, LINE + 14); ctx.stroke(); ctx.setLineDash([]);
      var tx = ph === 'aimX' ? s.ax : s.lockX;
      if (ph === 'aimX') { ctx.fillStyle = rgba(COLORS.cyan, 0.35); ctx.fillRect(tx - 2, AIM_Y0, 4, LINE - AIM_Y0); }
      /* the cyan pin slams in when X locks */
      var pin = (ph === 'aimY' && !reduced && s.phaseT < 0.15) ? 1.4 - 0.4 * (s.phaseT / 0.15) : 1;
      ctx.save(); ctx.translate(tx, LINE + 4); ctx.scale(pin, pin);
      ctx.fillStyle = COLORS.cyan; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-13, 23); ctx.lineTo(13, 23); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (ph === 'aimX') return;
      var ty = ph === 'aimY' ? s.ay : s.lockY;
      if (ph === 'aimY') { ctx.strokeStyle = rgba(COLORS.pink, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, AIM_Y0); ctx.lineTo(tx, AIM_Y1); ctx.stroke(); }
      var pulse = (ph === 'windup' && !reduced) ? 1 + 0.3 * Math.sin(clamp01(s.phaseT / T.WINDUP) * Math.PI) : 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 7; reticle(ctx, tx, ty, pulse);
      ctx.strokeStyle = COLORS.pink; ctx.lineWidth = 4; reticle(ctx, tx, ty, pulse);
    }
    function reticle(ctx, x, y, k) {
      ctx.beginPath(); ctx.arc(x, y, 18 * k, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 26 * k, y); ctx.lineTo(x + 26 * k, y); ctx.moveTo(x, y - 26 * k); ctx.lineTo(x, y + 26 * k); ctx.stroke();
    }
    function drawPrompt(ctx) {
      var ph = s.phase, cx = MID + (ppl && ppl.frames ? KICK2D.promptShift : 0);   /* clear of the child's figure */
      if (ph === 'ready' && s.waitDecide) return;            /* the challenge's own line says what happens next */
      if (ph === 'ready' && s.decider) {
        var dg = ctx.createLinearGradient(0, 490, 0, 530); dg.addColorStop(0, COLORS.gold); dg.addColorStop(1, COLORS.glove);
        outlinedText(ctx, COPY.deciderReady, cx, 510, bigFont(36), dg, 7);
      } else if (ph === 'ready' && !s.intro) {
        if (s.final) {
          var sc = reduced ? 1 : 1 + 0.06 * Math.sin(s.clock * TAU);
          ctx.save(); ctx.translate(cx, 506); ctx.scale(sc, sc);
          var gg = ctx.createLinearGradient(0, -22, 0, 22); gg.addColorStop(0, COLORS.gold); gg.addColorStop(1, COLORS.glove);
          outlinedText(ctx, 'FINAL KICK!', 0, 0, bigFont(44), gg, 8); ctx.restore();
        } else outlinedText(ctx, 'Kick ' + (s.shot + 1) + ' — get ready…', cx, 512, '800 32px "Baloo 2", sans-serif', '#ffffff', 6);
      } else if (ph === 'aimX' || ph === 'aimY') {
        outlinedText(ctx, ph === 'aimX' ? 'TAP to pick the side' : 'TAP to pick the height', cx, 516, '800 26px "Baloo 2", sans-serif', '#ffffff', 5);
        if (s.idleT >= T.NUDGE) {
          /* the nudge bubble by the ball says the tap this step needs (QA2C-13, QA2C-2); it bobs
             at 0.8 Hz and stands still under reduced motion */
          var bob = reduced ? 0 : Math.sin(s.clock * 5) * 3, say = nudgeText(ph);
          ctx.font = '800 24px "Baloo 2", sans-serif';
          var tw = typeof ctx.measureText === 'function' ? ((ctx.measureText(say) || {}).width || 0) : say.length * 12;
          var bw = Math.min(400, Math.max(180, tw + 36)), bx = Math.min(LW - 12 - bw, 540);
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
          rr(ctx, bx, 402 + bob, bw, 46, 18); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(556, 446 + bob); ctx.lineTo(528, 462 + bob); ctx.lineTo(578, 446 + bob); ctx.closePath(); ctx.fill();
          outlinedText(ctx, say, bx + bw / 2, 425 + bob, '800 24px "Baloo 2", sans-serif', COLORS.glove, 0.01);
        }
      }
    }
    function drawResultBanner(ctx) {
      if (s.phase !== 'result' || !s.log.length) return;
      var lab = resultLabel(s.log[s.log.length - 1]), k = clamp01(s.resT / 0.35);
      var sc = reduced ? 1 : (k < 1 ? 0.3 + 0.7 * outBack(k) : 1);
      ctx.save(); ctx.translate(MID, 236); ctx.scale(sc, sc);
      var fill = '#ffffff';
      if (s.result === 'goal') { fill = ctx.createLinearGradient(0, -36, 0, 36); fill.addColorStop(0, COLORS.gold); fill.addColorStop(1, COLORS.glove); }
      outlinedText(ctx, lab.title, 0, 0, bigFont(72), fill, 11);
      /* the longer coach line ('Quick kick! …') gets a smaller size so it stays inside the stadium */
      outlinedText(ctx, lab.sub, 0, 58, '800 ' + (lab.sub.length > 30 ? 25 : 30) + 'px "Baloo 2", sans-serif', '#ffffff', 6);
      ctx.restore();
    }
    function drawEventBanner(ctx) {
      var b = P.banner; if (!b) return;
      var k = b.t / b.life, sc = reduced ? 1 : (b.t < 0.35 ? 0.3 + 0.7 * outBack(b.t / 0.35) : 1);
      ctx.save(); ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; ctx.translate(MID, 400); ctx.scale(sc, sc);
      var g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, COLORS.gold); g.addColorStop(1, COLORS.glove);
      outlinedText(ctx, b.title, 0, 0, bigFont(b.title.length > 16 ? 34 : 46), g, 8);
      if (b.sub) outlinedText(ctx, b.sub, 0, 40, '800 22px "Baloo 2", sans-serif', '#ffffff', 5);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawHud(ctx) {
      /* QA2C-15: under the shell's text pill (api.hudPill: it shows goals, Hype and the score) the
         canvas draws no second hype row or rival chip; the kick dots and the Cheer boost stay */
      var pill = !!(api && api.hudPill);
      for (var i = 0; i < 4 && !pill; i++) {
        var q = pipXY(i), on = i < s.hype, pop = P.pipPop[i] < 0.25 && !reduced ? 1 + 0.3 * Math.sin(P.pipPop[i] / 0.25 * Math.PI) : 1;
        var drop = P.pipDrop[i] >= 0 && P.pipDrop[i] < 0.2 && !reduced ? 1 - P.pipDrop[i] / 0.2 : 0;
        ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(pop, pop);
        starPath(ctx, 0, 0, 14, 0.48);
        if (on) { ctx.fillStyle = look.sig; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke(); }
        else { ctx.fillStyle = 'rgba(19,12,46,0.35)'; ctx.fill(); ctx.strokeStyle = drop ? rgba(look.sig, drop) : 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.stroke(); }
        ctx.restore();
      }
      if (s.encore && !pill) outlinedText(ctx, 'ENCORE!', 216, 33, bigFont(24), COLORS.gold, 5);
      /* 8 kick dots: a tick for a goal (gold ring for a top corner / Star Strike), a dash otherwise */
      for (var k = 0; k < SHOTS; k++) {
        var lg = s.log[k], x = MID - (SHOTS - 1) * 14 + k * 28, y = 30;
        ctx.lineWidth = 2;
        if (!lg) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.strokeStyle = k === s.shot && !lg ? '#ffffff' : INK; ctx.lineWidth = k === s.shot ? 3 : 2;
          ell(ctx, x, y, 9, 9); ctx.fill(); ctx.stroke(); continue;
        }
        if (lg.res === 'goal') {
          ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = INK; ell(ctx, x, y, 9, 9); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y + 3); ctx.lineTo(x + 4, y - 3); ctx.stroke();
          if (lg.top || lg.star) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; ell(ctx, x, y, 12.5, 12.5); ctx.stroke(); }
        } else {
          ctx.fillStyle = 'rgba(19,12,46,0.35)'; ctx.strokeStyle = '#ffffff'; ell(ctx, x, y, 8, 8); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke();
        }
      }
      /* rival chip + Cheer Boost chip, top right */
      if (!pill) {
        ctx.fillStyle = 'rgba(19,12,46,0.55)'; rr(ctx, 790, 14, 156, 36, 18); ctx.fill();
        ctx.fillStyle = rival.jersey; ell(ctx, 810, 32, 9, 9); ctx.fill();
        outlinedText(ctx, 'VS ' + rival.name.toUpperCase(), 874, 33, '800 20px "Baloo 2", sans-serif', '#ffffff', 0.01);
      }
      if (s.boost) {
        ctx.fillStyle = rgba(COLORS.glove, 0.85); rr(ctx, 790, 56, 156, 32, 16); ctx.fill();
        outlinedText(ctx, '📣 Cheer boost!', 868, 72, '800 18px "Baloo 2", sans-serif', '#ffffff', 0.01);
      }
      /* a challenge's decider kicks: a gold chip under the kick dots (they never fill a dot: no score) */
      if (s.decider) {
        ctx.fillStyle = 'rgba(19,12,46,0.62)'; rr(ctx, MID - 92, 50, 184, 32, 16); ctx.fill();
        ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2.5; ctx.stroke();
        outlinedText(ctx, COPY.deciderChip + ' ' + s.decider, MID, 66, '800 18px "Baloo 2", sans-serif', COLORS.gold, 0.01);
      }
      drawPortrait(ctx);
    }
    /* ---------- the child's figure (kids update): the back-view kicker and the HUD portrait ---------- */
    function kickerAt() {
      var K = KICK2D, ph = s.phase, pt = s.phaseT, k;
      if (ph === 'windup') {
        k = reduced ? 1 : clamp01(pt / T.WINDUP); k = k * k * (3 - 2 * k);
        return { frame: 'runup', x: lerp(K.standX, K.hitX, k) };
      }
      if (ph === 'strike' || ph === 'flight') return { frame: 'kick', x: K.hitX };
      if (ph === 'result') return { frame: s.resT < K.kickHold && !reduced ? 'kick' : 'stand', x: K.hitX };
      /* back to the mark after a kick (a decider kick keeps the ready clock of its wait, so it is back already) */
      if (ph === 'ready' && s.shot + s.decider > 0 && !reduced && pt < K.back) return { frame: 'runup', x: lerp(K.hitX, K.standX, pt / K.back) };
      return { frame: 'stand', x: K.standX };
    }
    function drawKicker(ctx) {
      var fr = ppl && ppl.frames;
      if (!fr) return;
      var p = kickerAt(), img = fr[p.frame] || fr.stand;
      if (!img) return;
      var F = KICK2D.frame, k = KICK2D.scale, y = KICK2D.footY;
      ctx.fillStyle = 'rgba(19,12,46,0.22)'; ell(ctx, p.x, y + 1, 28 * k, 7 * k); ctx.fill();
      ctx.drawImage(img, p.x - F.foot[0] * k, y - F.foot[1] * k, F.w * k, F.h * k);
    }
    /* head and shoulders in the member colour's ring, just left of the rival chip */
    function drawPortrait(ctx) {
      var img = ppl && ppl.portrait;
      if (!img) return;
      var q = KICK2D.portrait;
      ctx.fillStyle = 'rgba(19,12,46,0.55)'; ell(ctx, q.x, q.y, q.r + 4, q.r + 4); ctx.fill();
      ctx.fillStyle = mix(look.sig, '#ffffff', 0.6); ell(ctx, q.x, q.y, q.r, q.r); ctx.fill();
      ctx.save();
      ell(ctx, q.x, q.y, q.r, q.r); ctx.clip();
      ctx.drawImage(img, q.x - q.r * 1.2, q.y - q.r * 1.15, q.r * 2.4, q.r * 2.4);
      ctx.restore();
      ctx.strokeStyle = look.sig; ctx.lineWidth = 3; ell(ctx, q.x, q.y, q.r, q.r); ctx.stroke();
    }
    function drawIntro(ctx) {
      /* the rival's holo photocard flips in at the start of every round */
      var flip = reduced ? 1 : clamp01(s.phaseT / 0.3);
      ctx.fillStyle = 'rgba(19,12,46,0.35)'; ctx.fillRect(0, 0, LW, LH);
      ctx.save(); ctx.translate(MID, 262); ctx.scale(Math.max(0.02, flip), 1);
      var hg = ctx.createLinearGradient(-230, -130, 230, 130);
      COLORS.holo.forEach(function (c, i) { hg.addColorStop(i / 3, c); });
      ctx.fillStyle = 'rgba(26,18,64,0.92)'; rr(ctx, -230, -130, 460, 260, 26); ctx.fill();
      ctx.strokeStyle = hg; ctx.lineWidth = 7; ctx.stroke();
      ctx.fillStyle = rival.jersey; ell(ctx, 0, -78, 30, 30); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      outlinedText(ctx, rival.icon, 0, -76, '32px "Baloo 2", sans-serif', '#ffffff', 0.01);
      var ng = ctx.createLinearGradient(0, -24, 0, 24); ng.addColorStop(0, COLORS.gold); ng.addColorStop(1, COLORS.glove);
      outlinedText(ctx, 'VS ' + rival.name.toUpperCase(), 0, -8, bigFont(50), ng, 9);
      outlinedText(ctx, rival.tip, 0, 46, '800 23px "Baloo 2", sans-serif', '#ffffff', 5);
      /* (while a challenge holds the first kick a tap would do nothing: 'Get ready…' instead) */
      if (s.phaseT >= T.INTRO_SKIP) {
        var tapOk = !canSkip || canSkip();
        ctx.globalAlpha = clamp01((s.phaseT - T.INTRO_SKIP) / 0.3);
        outlinedText(ctx, tapOk ? 'Tap to start' : COPY.getReady, 0, 96, '800 21px "Baloo 2", sans-serif', tapOk ? COLORS.cyan : '#ffffff', 5);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    return function paint(ctx, opts) {
      var menu = !!(opts && opts.menu);
      var dt = Math.max(0, Math.min(0.1, s.clock - P.lastClock)); P.lastClock = s.clock;
      if (!menu) consume();
      advance(dt);
      var pose = keeperPose(), ball = ballState(pose);
      updateTrail(ball, dt);
      ctx.save();
      ctx.globalAlpha = 1; ctx.setLineDash([]);
      drawSky(ctx);
      drawStands(ctx, menu);
      drawCones(ctx);
      drawPitch(ctx);
      drawGoal(ctx);
      if (!menu) drawZones(ctx);
      if (ball.behind) drawBall(ctx, ball);
      drawKeeper(ctx, pose);
      if (!ball.behind) drawBall(ctx, ball);
      if (!menu) drawKicker(ctx);
      if (!menu) {
        drawAim(ctx);
        drawPrompt(ctx);
        var fx = fxSys(); if (fx) fx.draw(ctx);
        drawResultBanner(ctx);
        drawEventBanner(ctx);
        drawHud(ctx);
        if (s.phase === 'ready' && s.intro) drawIntro(ctx);
      }
      ctx.restore();
    };
  }

  /* the menu backdrop: the selected rival in his ready pose */
  function idleRival(cfg) {
    var id = cfg && cfg.variant;
    try { var st = win() && window.localStorage && window.localStorage.getItem('slgVar:penalty'); if (st) id = st; } catch (e) {}
    return rivalIndex(id) >= 0 && rivalUnlocked(cfg && cfg.pb, id) ? id : 'std';
  }
  function idle(ctx, cfg) {
    var c = {}; Object.keys(cfg || {}).forEach(function (k) { c[k] = cfg[k]; });
    c.seed = 1; c.rng = null; c.challengeRound = null;          /* the backdrop is never a challenge's round */
    var r = newRound({ sound: noop, reduced: true }, idleRival(cfg), c);
    r.render(ctx, { menu: true });
  }

  /* ---------------- shell wiring (CONTRACTS.md §2) ---------------- */
  function menuVariants(cfg) {
    var pb = (cfg && cfg.pb) || {};
    return RIVALS.map(function (rv) {
      var rec = pb['penalty:' + rv.id], best = rec && isFinite(Number(rec.score)) ? Number(rec.score) : null;
      var m = medalInfo(medalFor(best || 0)), locked = !rivalUnlocked(pb, rv.id), need = rv.unlock && medalAt(rv.unlock.score);
      return {
        id: rv.id, name: rv.name, icon: rv.icon, tip: rv.tip, locked: locked,
        lockText: locked && need ? 'Get ' + need.icon + ' ' + need.name + ' vs ' + rivalById(rv.unlock.after).name + ' to unlock' : '',
        medal: m ? m.icon : '', medalId: m ? m.id : null, best: best
      };
    });
  }
  function pbText(rec, variant) {
    var v = rec ? Number(rec.score) : NaN; if (!isFinite(v)) return '';
    var m = medalInfo(medalFor(v));
    return '🏆 Best vs ' + rivalById(variant).name + ': score ' + fmt(v) + (m ? ' · ' + m.icon + ' ' + m.name : '');
  }

  /* ---------------- challenges: ⚔️ Challenge and 🔑 Join with a code (KU) ----------------
     The two buttons sit in the menu's Play row only when the host offers challenges (cfg.duels, KU-CH17)
     and PeerJS and shell API 2 are here; never in a demo. A tap loads the challenge files once (solo
     play never loads them) and opens the challenge sheets (duel-lobby.js), which set
     cfg.challengeRound and start the round through ctl.beginRound. Greyed with one line when the
     lobby says why not, or when the device is offline. This glue is the only code here that touches the
     page: the script tags, and the menu's own two buttons (held while loading; the pop-up's join). */
  var DUEL_FILES = [['SLSocialCore', 'social-core.js', 'slSocialCoreJs'], ['SLKartNet', 'kart-net.js', 'slKartNetJs'],
    ['SLDuelCore', 'duel-core.js', 'slDuelCoreJs'], ['SLDuelNet', 'duel-net.js', 'slDuelNetJs'],
    ['SLLobbyGroups', 'lobby-groups.js', 'slLobbyGroupsJs'], ['SLDuelLobby', 'duel-lobby.js', 'slDuelLobbyJs']];
  var duelWait = null, duelNote = '';
  function duelsOn(cfg) {
    var W = win(), Sh = W && W.SLGameShell, S = W && W.SLSocialCore;
    if (!W || !cfg || cfg.duels !== true || cfg.demo || !Sh || !(Sh.API >= 2) || typeof W.Peer === 'undefined') return false;
    return !(S && S.ON && S.ON.duels === false);
  }
  /* each file once, in order (a tag another game added is waited for; one that fails is taken out, so
     a later tap tries again) → done(true) once every global is there */
  function duelLoad(done) {
    var W = win(), left = 0, bad = false;
    function have() { return DUEL_FILES.every(function (f) { return !!W[f[0]]; }); }
    if (have()) return done(true);
    if (duelWait) return duelWait.push(done);
    duelWait = [done];
    function settle() {
      if (--left > 0) return;
      var list = duelWait, ok = !bad && have();
      duelWait = null;
      list.forEach(function (f) { try { f(ok); } catch (e) {} });
    }
    DUEL_FILES.forEach(function (f) {
      if (W[f[0]]) return;
      var sc = document.getElementById(f[2]);
      if (!sc) {
        sc = document.createElement('script'); sc.id = f[2]; sc.async = false;
        sc.src = 'world/games/' + f[1] + '?v=' + (W.SL_WORLD_VER || '1');
        document.head.appendChild(sc);
      }
      left++;
      function fail() { bad = true; try { sc.remove(); } catch (e) {} }
      sc.addEventListener('load', function () { if (!W[f[0]]) fail(); settle(); });
      sc.addEventListener('error', function () { fail(); settle(); });
    });
    if (!left) { left = 1; settle(); }
  }
  /* a 4-character game word handed over by the family pop-up (cfg.challenge.join), else '' */
  function joinWord(cfg) {
    var j = cfg && cfg.challenge && typeof cfg.challenge === 'object' ? cfg.challenge.join : null;
    return typeof j === 'string' && /^[A-Za-z0-9]{4}$/.test(j) ? j.toUpperCase() : '';
  }
  function menuButtons(cfg) {
    if (!duelsOn(cfg)) return [];
    var W = win(), L = W.SLLobbyGroups, why = null, note = duelNote;
    duelNote = '';
    try { if (L && typeof L.reason === 'function') why = L.reason(cfg); } catch (e) { why = null; }
    if (!why && typeof navigator !== 'undefined' && navigator && navigator.onLine === false) why = { text: COPY.offline };
    /* launched from a family pop-up: open the join sheet straight away, once, with the code filled in */
    if (!why && joinWord(cfg) && !cfg.challenge.opened) {
      cfg.challenge.opened = true;
      setTimeout(function () {
        try { var b = document.querySelector('[data-mbtn="join"]'); if (b && !b.disabled && b.isConnected !== false) b.click(); } catch (e) {}
      }, 0);
    }
    var line = why ? String(why.text || '') : note;
    return [{ id: 'duel', label: COPY.challenge, disabled: !!why, note: line }, { id: 'join', label: COPY.join, disabled: !!why }];
  }
  function onMenuButton(id, ctl, cfg) {
    if ((id !== 'duel' && id !== 'join') || !ctl || !duelsOn(cfg)) return;
    var root = null;
    try {
      root = document.querySelector('.slg');
      /* both buttons wait while the files load (a second tap would open a second sheet) */
      [].forEach.call(document.querySelectorAll('[data-mbtn="duel"],[data-mbtn="join"]'), function (x) { x.disabled = true; });
    } catch (e) {}
    duelLoad(function (ok) {
      /* only for a child still on this game's menu: not one who exited or pressed Play meanwhile */
      if ((root && root.isConnected === false) || ctl.phase() !== 'menu') return;
      if (!ok) { duelNote = COPY.offline; ctl.menu(); return; }
      var o = { game: 'penalty', mode: id === 'join' ? 'join' : 'host' }, w = joinWord(cfg);
      if (id === 'join' && w) o.code = w;
      try { win().SLDuelLobby.open(ctl, cfg, o); } catch (e) { ctl.menu(); }
    });
  }

  var def = {
    key: 'penalty', title: 'Encore Shootout', subtitle: 'ENCORE SHOOTOUT', emoji: '⚽', LW: LW, LH: LH, defaultVariant: 'std',
    tutorial: [
      ['👀', 'The keeper shows which way he’ll dive. Kick the OTHER way!'],
      ['👆', 'Tap for SIDE (blue), tap again for HEIGHT (pink)'],
      COPY.rushedCard.slice(),
      ['✨', '4 goals in a row = ENCORE MODE. Every goal is worth 150!'],
      ['🎯', 'Top corners can’t be saved… but watch the posts!']
    ],
    controls: [{ id: 'kick', label: '⚽ KICK', side: 'right', wide: true }],
    keys: { ' ': 'kick', 'Enter': 'kick', 'ArrowUp': 'kick' },
    tapAction: 'kick',
    countdown: 0,
    view3d: { src: 'world/games/penalty-3d.js' },
    menuVariants: menuVariants, menuVariantsTitle: 'Choose your rival', menuVariantsLabel: 'rival',
    menuButtons: menuButtons, onMenuButton: onMenuButton,
    pbText: pbText,
    resultsGlass: true,
    music: { track: 'penalty' },
    idle: idle, newRound: newRound
  };

  var API = {
    /* unchanged exports */
    outcome: outcome, isTopCorner: isTopCorner, newRound: newRound, REACH: REACH, SHOTS: SHOTS,
    POST_L: POST_L, POST_R: POST_R, BAR: BAR, LINE: LINE, MID: MID,
    /* Encore Shootout */
    missKind: missKind, shotPoints: shotPoints, sweepSpeed: sweepSpeed, tellAt: tellAt, readTell: readTell,
    medalFor: medalFor, rivalUnlocked: rivalUnlocked, resultLabel: resultLabel, bestFor: bestFor, rivalById: rivalById,
    NUDGE: NUDGE, nudgeText: nudgeText, AUTO_SHOT: AUTO_SHOT,
    AIM: AIM, TIMING: TIMING, RIVALS: RIVALS, MEDALS: MEDALS, MAP: MAP, HYPE_SHOW: HYPE_SHOW, WANDS_LIT: WANDS_LIT,
    CONES: CONES, COLORS: COLORS, LW: LW, LH: LH, def: def,
    /* kids update: the rules number, duel mode's numbers and the new lines */
    PENALTY_RULES: PENALTY_RULES, DUEL: DUEL, COPY: COPY
  };
  if (win()) window.SLPenaltyLogic = API;
  if (Shell) Shell.define(def);
  if (typeof module === 'object' && module.exports) module.exports = API;
})();
