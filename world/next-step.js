/* ================================================================
   My Island — the Next step card (wave 3, chunk W3-2; WAVE3-PLAN §3; d-island, James's answers of
   25 Oct 2026). Pure: no DOM, no storage, no clock, no chance. window.SLNextStep in the browser
   (rewards-world.js loads it itself, like the Pet Shop; precached in sw.js, never in index.html's
   slLoadWorld chain), require() in Node.

   The HUD's savings-goal slot is one calm suggestion. This file only works out WHICH one and with
   what words; the host draws it and does it. Every call takes the world core (SLWorldCore) first and
   reads a deep copy of the profile it is given: nothing here buys, feeds, sets a goal or writes
   anything, and nothing is remembered between calls. Words come back as copy keys {key, params}
   (world-copy.js); the host translates them.

   James (25 Oct 2026): 'everything related to islands — free play, whatever interests them'. So the
   urgent cards come first, in a fixed order, and after them the card takes turns between the island
   ideas that fit right now (never pushy: a suggestion, a question, or the goal's own words).

     island(C, u, env)   env {trial, wallet, care, day, now, trip, who, games, isle, travel, turn, left, learnHere}
         → null (nothing fits: the host keeps its old goal bar or test-mode note) |
           {id, text: {key, params}, btn: {key, params, go} | null, icon: {kind, id}, progress}
         id = the card that fitted (RULES); what the button does is go, so the host draws the card
         from text / btn / progress and acts on go.to, never on id alone (suggest gives either
         shape: Learn with the bar, or enough's Get it when the child already has enough).
         go = {to, id?, petId?, feed?, visit?, game?, course?, isle?, uid?}: to 'pets' (My pets on
         petId, with feed: true the food open, with visit: true the Rescue visit), 'item' (the item
         sheet of id), 'play' (game's menu; course: the Remix to pick there), 'learn' (a
         learn-and-come-back trip for id), 'land' (fly to isle), 'ride' (the thing uid on isle:
         framed and played, as a tap would), 'edit' (Edit mode on isle, the bag open), 'shop'
         (the Island Shop on isle).
         icon.kind 'pet' = the child's own pet (petId's portrait), 'item' = a catalogue item's icon,
         'isle' = an island's own icon (id an ISLES key). progress = null | {have, price, pct, key:
         'next.progress', params: {n, price}} (the bar and its aria label), in the call's wallet.
         trial = free test mode (nothing is short: the price ideas give way to 'free');
         wallet = 'coins' | 'stars' for every price and balance (C.priceOf, C.walletBalance,
         C.goalProgress, C.itemState); without it the core's ECONOMY.wallet decides.
         care = the pet-care rules (SLPetCare, or SLPetCare.create(C) for another core) and
         day = the island day ('YYYY-MM-DD', the host's C.dayKey): the pet rules need both and
         are skipped without them (or before care has started).
         trip / who / now = window.slLearnTrip, state.activeUser and the time in ms: a trip
         counts only while tripLive().
         games = false when the grown-up's island-game time for today is used up (the host's
         C.roundGate(arcadeState().status).allowed === false, which launch() would refuse):
         the game idea is skipped, so the card never offers a ▶ Play that cannot start.
         Anything else (missing, true) counts as game time left.
         isle = the island the child is on (an ISLES key; anything else reads 'home', where My
         Island always opens); travel = false when the stage cannot fly between islands (the host's
         canTravel(); the visit idea is skipped); anything else counts as yes.
         turn = an integer the host moves on once per real My Island open, and once more each time
         the child acts on the card (the contract; anything else reads 0): which idea shows, and
         which of that idea's choices.
         left = the island the child has just flown from (an ISLES key; the host's memory of this
         open): the visit idea never offers it, so 'Fly there' is never followed by a visit
         straight back. Anything else leaves no island out.
         learnHere = true while the island already shows its own 📚 Learn (the host's row for a
         locked island the child is looking at and is short of): the goal idea's 📚 Learn card is
         skipped then, so My Island shows one Learn. Anything else counts as no.
     URGENT, in order (the first that fits wins; 'real' = only with real prices, never in test mode)
       feed     a pet at home hungry or worse (ALERT_LV ≥ 2, never just peckish), no pet sitter:
                next.feedOne {name} + next.feedBtn {name}, or next.feedMany {n} + next.feedAll
                (the hungriest first, then the home order) → pets, feed
       rescue   a pet at the Pet Rescue not visited today: next.rescue {name} +
                care.rescue.visit {name} → pets, visit. The grown-up's farewell switch never
                changes a word here
       enough   real: the trip's item, else the goal, can be bought now (the goal: goalProgress
                ready, not full): next.enough {item} + next.getIt → item
     IDEAS, taking turns: the ideas that fit are listed in this order, the card is the one at
       turn (mod how many fit), and that idea's choice the one at turn ÷ how many fit (mod its
       choices), so each time an idea comes round it offers its next choice
       visit    another land the child owns (lands never visited first; Home counts on a sky
                island), never the one just left: next.visit {island} + next.flyThere → land.
                Not when travel is false
       ride     a ride or landmark standing on the island the child is on (a fun thing or a
                landmark with an act, never a game's ▶ PLAY sign or the house): next.ride {item}
                + next.rideBtn → ride
       decorate on an island the child owns: things in the bag that may go there, next.bag {n}
                + next.bagBtn → edit; else, with a free square and (test mode, or something
                placeable there the child can buy now), next.add {island} + isle.openShop → shop
       game     not with games false. An owned game with no best yet (no w.pb key 'game:', GAMES
                order): next.try.<game> + next.play → play. Else a Classic finish on a kart track
                (w.pb 'kart:<track>') whose Remix was never raced (no 'kart:<track>_remix', REMIX
                order): next.remixTrack {item: the track's name} + next.play → play with course:
                that Remix (R2: the kart menu opens with it picked, never straight onto the race).
                Else every owned game: next.again.<game> + next.play → play
       goal     test mode: 'free', a game not owned, else the first locked sky land (ISLE_ORDER):
                next.free {item} + shop.seeIt → item. Real prices: 'saving', the goal still short
                (not locked, not full): next.learnMins or next.learnDays {item, n} (time()) +
                learn.go → learn, with the bar; else with no goal 'suggest', the next game not
                owned (GAMES order), else the cheapest land not owned, in the call's wallet: as
                saving, or enough's shape when the child already has enough for it. A 📚 Learn
                card does not fit while learnHere is true
     time(need, C) → null (nothing to earn) | {key: 'mins' | 'days', n}: a learning day is about
         DAY_MIN (60) minutes (James, 25 Oct 2026: prices on about an hour of learning a day) and
         earns the ECONOMY day, sessionPts × daySessions, read from C.ECONOMY on every call (never a
         copy of it). Up to a day's worth it is minutes in steps of 5 (rounded up, at least 5),
         above it days, max(1, round(need / day)): 60 minutes is followed by 1 day, never a jump to
         2. The host's words: next.learnMins / next.learnDays, learn.aboutMins / learn.aboutDays
         (n of 1 reads their '.one' form).
     tripLive(trip, who, now) → true while the learn-and-come-back trip (WAVE3-PLAN contracts 1:
         {v: 1, who, id, name, price, wallet, at, from}, at in ms) is this child's and at most
         TRIP_MS (3 hours) old.
     TRIP_MS, SESSION_MIN, DAY_MIN, RULES (every card id), URGENT, IDEAS (their orders), GAMES {game:
         its attraction}, REMIX {track: its Remix course} (kart-logic.js COURSES[*].base), all frozen.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLNextStep = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRIP_MS = 3 * 60 * 60 * 1000;        /* a trip is forgotten after 3 hours */
  var SESSION_MIN = 25;                     /* ECONOMY.sessionPts is a ~25-minute learning session (kept for older callers) */
  var DAY_MIN = 60;                         /* the ECONOMY day is about an hour of learning (James, 25 Oct 2026) */
  var STEP_MIN = 5;
  var URGENT = Object.freeze(['feed', 'rescue', 'enough']);
  var IDEAS = Object.freeze(['visit', 'ride', 'decorate', 'game', 'goal']);
  var RULES = Object.freeze(['feed', 'rescue', 'enough', 'visit', 'ride', 'bag', 'add', 'try', 'remix', 'again', 'saving', 'suggest', 'free']);
  var GAMES = Object.freeze({ course: 'att_course', penalty: 'att_pitch', kart: 'att_kart' });
  var REMIX = Object.freeze({ track_loop: 'track_loop_remix', track_volcano: 'track_volcano_remix', track_beach: 'track_beach_remix' });
  /* what counts as a ride: a fun thing or a landmark with something to do (never a game's sign, never the house) */
  var RIDE_KINDS = { fun: 1, landmark: 1 }, NOT_RIDES = { launch: 1, home: 1 };
  /* pet-care's tummy levels as alert levels, when the care module given has none */
  var ALERT0 = { full: 0, fed: 0, peckish: 1, hungry: 2, warn: 3, last: 3 };
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function mod(a, n) { return ((a % n) + n) % n; }

  /* ---------------- time ---------------- */
  /* the ECONOMY day in the island's money: sessionPts × daySessions, read from the core given, every call */
  function dayOf(C) {
    var E = C && plain(C.ECONOMY) ? C.ECONOMY : {};
    var pts = num(E.sessionPts) && E.sessionPts > 0 ? E.sessionPts : 120, n = num(E.daySessions) && E.daySessions > 0 ? E.daySessions : 2;
    return pts * n;
  }
  function time(need, C) {
    if (!num(need) || need <= 0) return null;
    var day = dayOf(C);
    if (need <= day) return { key: 'mins', n: Math.max(1, Math.ceil(need * (DAY_MIN / STEP_MIN) / day)) * STEP_MIN };
    return { key: 'days', n: Math.max(1, Math.round(need / day)) };
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
    var isle = typeof env.isle === 'string' && C.ISLES && has(C.ISLES, env.isle) ? env.isle : 'home';
    var left = typeof env.left === 'string' && C.ISLES && has(C.ISLES, env.left) && env.left !== isle ? env.left : null;
    return { C: C, U: U, w: U.world, o: o, trial: o.trial, env: env, st: st, LV: care && plain(care.ALERT_LV) ? care.ALERT_LV : ALERT0,
      play: env.games !== false, travel: env.travel !== false, isle: isle, left: left, learnHere: env.learnHere === true,
      turn: num(env.turn) ? Math.floor(env.turn) : 0 };
  }
  function nameOf(x, id) { var it = x.C.item(id); return it && typeof it.name === 'string' ? it.name : ''; }
  function isleName(x, k) { var d = x.C.ISLES && x.C.ISLES[k]; return d && typeof d.name === 'string' ? d.name : ''; }
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
  function fn(x, name) { return typeof x.C[name] === 'function'; }
  function opened(x, k) { return fn(x, 'isleUnlocked') ? !!x.C.isleUnlocked(x.w, k) : k === 'home'; }
  function placedOn(x, k) { var l = fn(x, 'placedOn') ? x.C.placedOn(x.w, k) : []; return Array.isArray(l) ? l : []; }

  /* ---------------- the card ---------------- */
  function key(k, params) { return { key: k, params: params || null }; }
  function card(id, text, btn, icon, progress) { return { id: id, text: text, btn: btn, icon: icon, progress: progress || null }; }
  function itemIcon(id) { return { kind: 'item', id: id }; }
  function isleIcon(k) { return { kind: 'isle', id: k }; }
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

  /* ---------------- the urgent cards (and the goal's own cards, which the goal idea reuses) ---------------- */
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

  /* ---------------- the island ideas: each gives its choices (none: it does not fit now) ---------------- */
  var IDEA = {
    visit: function (x) {
      if (!x.travel || !Array.isArray(x.C.ISLE_ORDER)) return [];
      /* never a visit straight back to the island just left (the Fly there before it) */
      var lands = x.C.ISLE_ORDER.filter(function (k) { return k !== x.isle && k !== x.left && x.C.ISLES[k] && opened(x, k); });
      var seen = plain(x.w.tutSeen) ? x.w.tutSeen : {};
      var fresh = lands.filter(function (k) { return k !== 'home' && !seen['isle:' + k]; });
      return (fresh.length ? fresh : lands).map(function (k) {
        return card('visit', key('next.visit', { island: isleName(x, k) }), { key: 'next.flyThere', params: null, go: { to: 'land', isle: k } }, isleIcon(k));
      });
    },
    ride: function (x) {
      if (!opened(x, x.isle)) return [];
      var seen = {}, out = [];
      placedOn(x, x.isle).forEach(function (p) {
        var it = p && x.C.item(p.id);
        if (!it || seen[it.id] || !has(RIDE_KINDS, it.kind) || typeof it.act !== 'string' || !it.act || has(NOT_RIDES, it.act) || typeof p.uid !== 'string') return;
        seen[it.id] = true;
        out.push(card('ride', key('next.ride', { item: it.name }), { key: 'next.rideBtn', params: null, go: { to: 'ride', isle: x.isle, uid: p.uid } }, itemIcon(it.id)));
      });
      return out;
    },
    decorate: function (x) {
      var k = x.isle;
      if (!opened(x, k)) return [];
      var bag = bagHere(x, k);
      if (bag.n > 0) return [card('bag', key('next.bag', { n: bag.n }), { key: 'next.bagBtn', params: null, go: { to: 'edit', isle: k } }, itemIcon(bag.first))];
      if (freeSquares(x, k) <= 0) return [];
      if (!x.trial && !buyableHere(x, k)) return [];
      return [card('add', key('next.add', { island: isleName(x, k) }), { key: 'isle.openShop', params: null, go: { to: 'shop', isle: k } }, isleIcon(k))];
    },
    game: function (x) {
      if (!x.play) return [];                 /* no game time left today: no ▶ Play the host would refuse */
      var games = Object.keys(GAMES), owned = games.filter(function (g) { return x.C.owns(x.w, GAMES[g]); });
      var untried = owned.filter(function (g) { return !hasBest(x, g); });
      if (untried.length) return untried.map(function (g) { return card('try', key('next.try.' + g), { key: 'next.play', params: null, go: { to: 'play', game: g } }, itemIcon(GAMES[g])); });
      if (owned.indexOf('kart') >= 0) {
        var pb = plain(x.w.pb) ? x.w.pb : {};
        var remix = Object.keys(REMIX).filter(function (t) { return has(pb, 'kart:' + t) && !has(pb, 'kart:' + REMIX[t]); });
        if (remix.length) return remix.map(function (t) {
          return card('remix', key('next.remixTrack', { item: nameOf(x, t) }), { key: 'next.play', params: null, go: { to: 'play', game: 'kart', course: REMIX[t] } }, itemIcon(t));
        });
      }
      return owned.map(function (g) { return card('again', key('next.again.' + g), { key: 'next.play', params: null, go: { to: 'play', game: g } }, itemIcon(GAMES[g])); });
    },
    goal: function (x) {
      var r = x.trial ? RULE.free(x) : (RULE.saving(x) || RULE.suggest(x));
      if (r && x.learnHere && r.btn && r.btn.key === 'learn.go') return [];   /* the island shows its own 📚 Learn: one is enough */
      return r ? [r] : [];
    }
  };
  /* the one shared bag, seen from island k (SLIslesUI.bag's here list): how many things may go there, and the first */
  function bagHere(x, k) {
    var out = { n: 0, first: null };
    if (!fn(x, 'inventory') || !fn(x, 'canGoOn')) return out;
    x.C.inventory(x.w).forEach(function (e) {
      var it = e && x.C.item(e.id);
      if (!it || !x.C.isPlaceable(it) || !x.C.canGoOn(e.id, k) || !(e.count > 0)) return;
      out.n += e.count;
      if (!out.first) out.first = e.id;
    });
    return out;
  }
  /* SLIslesUI.freeSquares: land squares of island k holding nothing (unknown to an older core: room) */
  function freeSquares(x, k) {
    if (!fn(x, 'landSetOf') || !fn(x, 'occupancy')) return 1;
    var land = x.C.landSetOf(x.w, k) || {}, occ = (x.C.occupancy(x.w, undefined, k) || {}).occ || {}, n = 0;
    Object.keys(land).forEach(function (c) { if (!occ[c]) n++; });
    return n;
  }
  /* something on sale that may stand on island k and the child can buy right now (real prices) */
  function buyableHere(x, k) {
    if (!fn(x, 'canGoOn')) return false;
    return sold(x).some(function (it) {
      return x.C.isPlaceable(it) && it.kind !== 'landmark' && x.C.canGoOn(it.id, k) && stateOf(x, it.id) === 'affordable';
    });
  }
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
    for (var i = 0; i < URGENT.length; i++) {
      var r = RULE[URGENT[i]](x);
      if (r) return r;
    }
    /* the ideas that fit now, in IDEAS order; the turn picks one, and its choice */
    var fit = [];
    for (var j = 0; j < IDEAS.length; j++) {
      var cs = IDEA[IDEAS[j]](x);
      if (cs.length) fit.push(cs);
    }
    if (!fit.length) return null;
    var pick = fit[mod(x.turn, fit.length)];
    return pick[mod(Math.floor(x.turn / fit.length), pick.length)];
  }

  return {
    island: island, time: time, tripLive: tripLive,
    TRIP_MS: TRIP_MS, SESSION_MIN: SESSION_MIN, DAY_MIN: DAY_MIN, RULES: RULES, URGENT: URGENT, IDEAS: IDEAS, GAMES: GAMES, REMIX: REMIX
  };
}));
