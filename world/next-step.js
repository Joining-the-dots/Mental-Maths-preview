/* ================================================================
   My Island — the Next step card (wave 3, chunk W3-2; WAVE3-PLAN §3). Pure: no DOM, no
   storage, no clock, no chance. window.SLNextStep in the browser (rewards-world.js loads it
   itself, like the Pet Shop; precached in sw.js, never in index.html's slLoadWorld chain),
   require() in Node.

   The HUD's savings-goal slot becomes one calm suggestion: the first rule below that fits.
   This file only works out WHICH one and with what words; the host draws it and does it.
   Every call takes the world core (SLWorldCore) first and reads a deep copy of the profile it
   is given: nothing here buys, feeds, sets a goal or writes anything, and nothing is
   remembered between calls. Words come back as copy keys {key, params} (world-copy.js); the
   host translates them.

     island(C, u, env)   env {trial, wallet, care, day, now, trip, who, games}
         → null (nothing fits: the host keeps its old goal bar or test-mode note) |
           {id, text: {key, params}, btn: {key, params, go} | null, icon: {kind, id}, progress}
         id = the rule that fitted (RULES); what the button does is go, so the host draws the card
         from text / btn / progress and acts on go.to, never on id alone (suggest gives either
         shape: Learn with the bar, or enough's Get it when the child already has enough).
         go = {to, id?, petId?, feed?, visit?, game?}: to 'pets' (My pets
         on petId, with feed: true the food open, with visit: true the Rescue visit), 'item' (the
         item sheet of id), 'play' (game's menu), 'learn' (a learn-and-come-back trip for id).
         icon.kind 'pet' = the child's own pet (petId's portrait), 'item' = a catalogue item's
         icon. progress = null | {have, price, pct, key: 'next.progress', params: {n, price}}
         (the bar and its aria label), in the call's wallet.
         trial = free test mode (nothing is short: the price rules give way to 'free');
         wallet = 'coins' | 'stars' for every price and balance (C.priceOf, C.walletBalance,
         C.goalProgress, C.itemState); without it the core's ECONOMY.wallet decides.
         care = the pet-care rules (SLPetCare, or SLPetCare.create(C) for another core) and
         day = the island day ('YYYY-MM-DD', the host's C.dayKey): the pet rules need both and
         are skipped without them (or before care has started).
         trip / who / now = window.slLearnTrip, state.activeUser and the time in ms: a trip
         counts only while tripLive().
         games = false when the grown-up's island-game time for today is used up (the host's
         C.roundGate(arcadeState().status).allowed === false, which launch() would refuse):
         try and remix are skipped, so the card never offers a ▶ Play that cannot start.
         Anything else (missing, true) counts as game time left.
     RULES, in order (WAVE3-PLAN §3; 'real' = only with real prices, never in test mode)
       feed     a pet at home hungry or worse (ALERT_LV ≥ 2, never just peckish), no pet sitter:
                next.feedOne {name} + next.feedBtn {name}, or next.feedMany {n} + next.feedAll
                (the hungriest first, then the home order) → pets, feed
       rescue   a pet at the Pet Rescue not visited today: next.rescue {name} +
                care.rescue.visit {name} → pets, visit. The grown-up's farewell switch never
                changes a word here
       enough   real: the trip's item, else the goal, can be bought now (the goal: goalProgress
                ready, not full): next.enough {item} + next.getIt → item
       try      an owned game with no best yet (no w.pb key 'game:'), in GAMES order:
                next.try.<game> + next.play → play. Never with env.games false
       remix    a Classic finish on a kart track (w.pb 'kart:<track>') and its Remix never
                raced (no 'kart:<track>_remix'), in REMIX order: next.remix + next.play → play
                with course: that Remix (R2: the kart menu opens with it picked, never straight
                onto the race). Never with env.games false
       saving   real: the goal is still short (not locked, not full): next.learnMins or
                next.learnDays {item, n} (time()) + learn.go → learn, with the bar
       suggest  real, no goal: the next game not owned (GAMES order), else the cheapest land
                not owned, in the call's wallet: as saving. Already enough for it: as enough
       free     test mode: a game not owned, else the first locked sky land (ISLE_ORDER):
                next.free {item} + shop.seeIt → item
     time(need, C) → null (nothing to earn) | {key: 'mins' | 'days', n}: a session is
         ECONOMY.sessionPts (120) in SESSION_MIN (25) minutes, so 24 to five minutes; up to an
         hour's worth (288) it is minutes in steps of 5 (rounded up, at least 5), above it days,
         max(2, round(need / (sessionPts × daySessions))). The host's words: next.learnMins /
         next.learnDays, learn.aboutMins / learn.aboutDays.
     tripLive(trip, who, now) → true while the learn-and-come-back trip (WAVE3-PLAN contracts 1:
         {v: 1, who, id, name, price, wallet, at, from}, at in ms) is this child's and at most
         TRIP_MS (3 hours) old.
     TRIP_MS, SESSION_MIN, RULES (frozen order), GAMES {game: its attraction}, REMIX {track:
         its Remix course} (kart-logic.js COURSES[*].base), all frozen.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLNextStep = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRIP_MS = 3 * 60 * 60 * 1000;        /* a trip is forgotten after 3 hours */
  var SESSION_MIN = 25;                     /* ECONOMY.sessionPts is a ~25-minute learning session */
  var STEP_MIN = 5, MINS_UP_TO = 60, DAYS_AT_LEAST = 2;
  var RULES = Object.freeze(['feed', 'rescue', 'enough', 'try', 'remix', 'saving', 'suggest', 'free']);
  var GAMES = Object.freeze({ course: 'att_course', penalty: 'att_pitch', kart: 'att_kart' });
  var REMIX = Object.freeze({ track_loop: 'track_loop_remix', track_volcano: 'track_volcano_remix', track_beach: 'track_beach_remix' });
  /* pet-care's tummy levels as alert levels, when the care module given has none */
  var ALERT0 = { full: 0, fed: 0, peckish: 1, hungry: 2, warn: 3, last: 3 };
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

  /* ---------------- time ---------------- */
  function econ(C) {
    var E = C && plain(C.ECONOMY) ? C.ECONOMY : {};
    return { pts: num(E.sessionPts) && E.sessionPts > 0 ? E.sessionPts : 120, day: num(E.daySessions) && E.daySessions > 0 ? E.daySessions : 2 };
  }
  function time(need, C) {
    if (!num(need) || need <= 0) return null;
    var E = econ(C), step = E.pts * STEP_MIN / SESSION_MIN, upTo = E.pts * MINS_UP_TO / SESSION_MIN;
    if (need <= upTo) return { key: 'mins', n: Math.max(STEP_MIN, Math.ceil(need / step) * STEP_MIN) };
    return { key: 'days', n: Math.max(DAYS_AT_LEAST, Math.round(need / (E.pts * E.day))) };
  }

  /* ---------------- the trip ---------------- */
  function tripLive(trip, who, now) {
    if (!plain(trip) || trip.v !== 1 || typeof trip.id !== 'string' || !trip.id) return false;
    if (who == null || trip.who !== who) return false;
    if (!num(now) || !num(trip.at)) return false;
    var age = now - trip.at;
    return age >= 0 && age <= TRIP_MS;
  }

  /* ---------------- reading the save (a deep copy: the child's own is never touched) ---------------- */
  function copyOf(C, u) {
    var raw = plain(u) ? u : {}, w = plain(raw.world) ? JSON.parse(JSON.stringify(raw.world)) : C.emptyWorld();
    var U = { points: num(raw.points) ? raw.points : 0, world: w };
    C.ensureWorld(U);
    return U;
  }
  function ctxOf(C, u, env) {
    var o = { trial: !!env.trial };
    if (typeof env.wallet === 'string') o.wallet = env.wallet;
    var U = copyOf(C, u), care = env.care, st = null;
    /* the pet rules: only with the care rules and the island day, once care has started */
    if (care && typeof care.status === 'function' && typeof env.day === 'string' && DAY_RE.test(env.day)) {
      st = care.status(U.world, env.day);
      if (!st || !st.started || !Array.isArray(st.pets)) st = null;
    }
    return { C: C, U: U, w: U.world, o: o, trial: o.trial, env: env, st: st, LV: care && plain(care.ALERT_LV) ? care.ALERT_LV : ALERT0,
      play: env.games !== false };
  }
  function nameOf(x, id) { var it = x.C.item(id); return it && typeof it.name === 'string' ? it.name : ''; }
  function stateOf(x, id) { var s = x.C.itemState(x.U, id, x.o); return s && s.state ? s.state : 'missing'; }
  function priceOf(x, id) {
    var p = typeof x.C.priceOf === 'function' ? x.C.priceOf(id, x.o) : null, it = x.C.item(id);
    return num(p) ? p : it && num(it.price) ? it.price : 0;
  }
  function balance(x) {
    if (typeof x.C.walletBalance === 'function') return x.C.walletBalance(x.U, x.o);
    return num(x.U.points) ? x.U.points : 0;
  }
  function goalOf(x) { return typeof x.C.goalProgress === 'function' ? x.C.goalProgress(x.U, x.o) : null; }
  function goalSet(x) { return typeof x.C.goalId === 'function' ? !!x.C.goalId(x.w) : !!goalOf(x); }
  function hasBest(x, game) {
    var pb = plain(x.w.pb) ? x.w.pb : {};
    return Object.keys(pb).some(function (k) { return k.indexOf(game + ':') === 0; });
  }
  function sold(x) { return typeof x.C.shopItems === 'function' ? x.C.shopItems() : []; }
  function onSale(x, id) { return sold(x).some(function (it) { return it.id === id; }); }

  /* ---------------- the card ---------------- */
  function key(k, params) { return { key: k, params: params || null }; }
  function card(id, text, btn, icon, progress) { return { id: id, text: text, btn: btn, icon: icon, progress: progress || null }; }
  function itemIcon(id) { return { kind: 'item', id: id }; }
  function enoughCard(rule, x, id) {
    return card(rule, key('next.enough', { item: nameOf(x, id) }), { key: 'next.getIt', params: null, go: { to: 'item', id: id } }, itemIcon(id));
  }
  function learnCard(rule, x, id, have, price) {
    var need = Math.max(0, price - have), t = time(need, x.C);
    if (!t) return enoughCard(rule, x, id);
    var pct = price > 0 ? Math.min(100, Math.floor(have * 100 / price)) : 100;
    return card(rule, key(t.key === 'mins' ? 'next.learnMins' : 'next.learnDays', { item: nameOf(x, id), n: t.n }),
      { key: 'learn.go', params: null, go: { to: 'learn', id: id } }, itemIcon(id),
      { have: have, price: price, pct: pct, key: 'next.progress', params: { n: have, price: price } });
  }

  /* ---------------- the rules ---------------- */
  var RULE = {
    feed: function (x) {
      if (!x.st || x.st.sitter) return null;
      var LV = x.LV, lv = function (p) { return has(LV, p.level) && num(LV[p.level]) ? LV[p.level] : 0; };
      var hungry = x.st.pets.map(function (p, i) { return { p: p, i: i }; })
        .filter(function (e) { return e.p.where === 'home' && lv(e.p) >= 2; })
        .sort(function (a, b) { return (lv(b.p) - lv(a.p)) || (a.i - b.i); }).map(function (e) { return e.p; });
      if (!hungry.length) return null;
      var p = hungry[0], go = { to: 'pets', petId: p.id, feed: true };
      if (hungry.length === 1) return card('feed', key('next.feedOne', { name: p.name }), { key: 'next.feedBtn', params: { name: p.name }, go: go }, { kind: 'pet', id: p.id });
      return card('feed', key('next.feedMany', { n: hungry.length }), { key: 'next.feedAll', params: null, go: go }, { kind: 'pet', id: p.id });
    },
    rescue: function (x) {
      if (!x.st) return null;
      var p = x.st.pets.filter(function (q) { return q.where === 'rescue' && plain(q.rescue) && q.rescue.visitedToday !== true; })[0];
      if (!p) return null;
      return card('rescue', key('next.rescue', { name: p.name }), { key: 'care.rescue.visit', params: { name: p.name }, go: { to: 'pets', petId: p.id, visit: true } }, { kind: 'pet', id: p.id });
    },
    enough: function (x) {
      if (x.trial) return null;
      var env = x.env;
      if (tripLive(env.trip, env.who, env.now) && x.C.item(env.trip.id) && stateOf(x, env.trip.id) === 'affordable') return enoughCard('enough', x, env.trip.id);
      var g = goalOf(x);
      if (g && g.ready === true && !g.full && !g.locked && x.C.item(g.id) && stateOf(x, g.id) !== 'owned') return enoughCard('enough', x, g.id);
      return null;
    },
    'try': function (x) {
      if (!x.play) return null;              /* no game time left today: no ▶ Play the host would refuse */
      var games = Object.keys(GAMES);
      for (var i = 0; i < games.length; i++) {
        var g = games[i];
        if (x.C.owns(x.w, GAMES[g]) && !hasBest(x, g)) return card('try', key('next.try.' + g), { key: 'next.play', params: null, go: { to: 'play', game: g } }, itemIcon(GAMES[g]));
      }
      return null;
    },
    remix: function (x) {
      if (!x.play || !x.C.owns(x.w, GAMES.kart)) return null;
      var pb = plain(x.w.pb) ? x.w.pb : {}, tracks = Object.keys(REMIX);
      for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        if (has(pb, 'kart:' + t) && !has(pb, 'kart:' + REMIX[t])) return card('remix', key('next.remix'), { key: 'next.play', params: null, go: { to: 'play', game: 'kart', course: REMIX[t] } }, itemIcon(t));
      }
      return null;
    },
    saving: function (x) {
      if (x.trial) return null;
      var g = goalOf(x);
      if (!g || g.ready === true || g.locked || g.full || !x.C.item(g.id) || stateOf(x, g.id) === 'owned') return null;
      if (!num(g.price) || !num(g.have) || !(g.price - g.have > 0)) return null;
      return learnCard('saving', x, g.id, g.have, g.price);
    },
    suggest: function (x) {
      if (x.trial || goalSet(x)) return null;
      var id = nextGame(x) || cheapestLand(x);
      return id ? learnCard('suggest', x, id, balance(x), priceOf(x, id)) : null;
    },
    free: function (x) {
      if (!x.trial) return null;
      var id = nextGame(x) || firstSky(x);
      return id ? card('free', key('next.free', { item: nameOf(x, id) }), { key: 'shop.seeIt', params: null, go: { to: 'item', id: id } }, itemIcon(id)) : null;
    }
  };
  /* the first game (GAMES order) the child does not have that the shop sells */
  function nextGame(x) {
    var games = Object.keys(GAMES);
    for (var i = 0; i < games.length; i++) if (!x.C.owns(x.w, GAMES[games[i]]) && onSale(x, GAMES[games[i]])) return GAMES[games[i]];
    return null;
  }
  /* the cheapest land not owned yet, in the call's wallet (a tie: the ⭐ price, then the catalogue order) */
  function cheapestLand(x) {
    var lands = sold(x).filter(function (it) { return it.kind === 'land' && !x.C.owns(x.w, it.id); })
      .map(function (it, i) { return { id: it.id, i: i, p: priceOf(x, it.id), s: num(it.price) ? it.price : 0 }; })
      .sort(function (a, b) { return (a.p - b.p) || (a.s - b.s) || (a.i - b.i); });
    return lands.length ? lands[0].id : null;
  }
  /* the first sky land (ISLE_ORDER) still locked: its land card */
  function firstSky(x) {
    var C = x.C, order = Array.isArray(C.ISLE_ORDER) ? C.ISLE_ORDER : [];
    for (var i = 0; i < order.length; i++) {
      var k = order[i], d = C.ISLES && C.ISLES[k];
      if (k !== 'home' && d && d.unlock && !C.isleUnlocked(x.w, k) && C.item(d.unlock)) return d.unlock;
    }
    return null;
  }

  function island(C, u, env) {
    if (!C || typeof C.item !== 'function' || typeof C.ensureWorld !== 'function') return null;
    var x = ctxOf(C, u, plain(env) ? env : {});
    for (var i = 0; i < RULES.length; i++) {
      var r = RULE[RULES[i]](x);
      if (r) return r;
    }
    return null;
  }

  return {
    island: island, time: time, tripLive: tripLive,
    TRIP_MS: TRIP_MS, SESSION_MIN: SESSION_MIN, RULES: RULES, GAMES: GAMES, REMIX: REMIX
  };
}));
