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
                ('Have a go on the …') when its act is one of the core's RIDE_ACTS (the Big Wheel,
                the trampoline), else next.tryThing {item} ('Try the …': the fountain, the café, a
                statue, the penguin choir; every thing, with a core that has no RIDE_ACTS), then
                next.rideBtn → ride (the card's id is 'ride' either way)
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
     tripLive(trip, who, now, day?) → true while the learn-and-come-back trip (WAVE3-PLAN contracts 1:
         {v: 1, who, id, name, price, wallet, at, from, day?}, at in ms) is this child's and at most
         TRIP_MS (3 hours) old. Island activities §4.1: with day (an island day 'YYYY-MM-DD') the trip
         lasts until the end of that island day instead: live while trip.day === day and it is at most
         TRIP_KEEP_MS (12 hours, a backstop) old. island() gives tripLive env.day only for a trip that
         names its own day, so a trip without one (the decisions build's) keeps the 3-hour rule.
     TRIP_MS, TRIP_KEEP_MS, SESSION_MIN, DAY_MIN, RULES (every card id), URGENT, IDEAS, MIX (their orders),
         GAMES {game: its attraction}, REMIX {track: its Remix course} (kart-logic.js COURSES[*].base),
         all frozen.

   ISLAND ACTIVITIES v1 (chunk IA-2; ISLAND-ACTIVITIES-PLAN §5 IA-2, §6; James, 25-26 Oct 2026: build all 7,
   the activities are free play and never use the island-game time). env gains:
       days = the island day (SLIslandDays.today(), IA-1): {n, day, visitor {id, name} | null, show {isle} |
           null, spy {isle, uids?} | null, wishes {petId: {kind: 'ride' | 'rest' | 'visit' | 'meet', uid?,
           isle?, done?}} | null, did}. did = the flags done today ('hello', 'show:<isle>', 'spy:<isle>', 'fetch',
           'hide', 'wish:<petId>' …), as a list, as the save's {d, f} (a d other than the day is no flags)
           or as {flag: true}; a wish with done: true (today()'s own mark) is done too. Any field may be
           missing or null: that idea just does not fit. today()'s other fields (weather, season, goal, the
           visitor's move, the show's host, the clue …) are the Today board's: the card reads only these.
       pet = {id, name}: a home pet out on the island the child is on, not hungry, when the stage can play
           (the host decides; with the care rules it must also be at home and not hungry here).
       hold = {id, go}: the card on show (its id and btn.go, as given), when the host draws the card again
           in the same open at the same turn: while that card still fits it stays (plan §6.3: the card is
           stable for the whole open and changes only when its own rule stops fitting). {id, go} names one
           card (a wish's go names its pet), so the held card keeps its pet, its thing and its words.
       With days, turn is the opens of this page session plus the cards acted on (no day part: days.n is
           the day part, so the host's nextTurn() leaves out its calendar day when it passes days; a day
           counted twice would step the first card of each day by 2 and, with an even number of ideas
           fitting, show only half of them first). WITHOUT env.days everything above runs exactly as the decisions build (pet and
           hold are ignored), so its rules, words and turns are unchanged.
     With days: the URGENT cards first, unchanged (feed, rescue, enough), then the MIX takes turns:
       visitor  days.visitor not greeted today (no 'hello'): act.next.visitor {name} + act.vis.hello →
                visitor (on Home: a sky island needs travel). icon {kind: 'char', id}
       show     days.show.isle (an island the child owns) not watched today (no 'show:<isle>'):
                act.today.show {island} + act.show.start → show {isle}
       spy      days.spy.isle not solved today (no 'spy:<isle>'): act.today.spy {island} + isle.goThere →
                spy {isle}
       fetch    env.pet, no 'fetch' today: act.pet.wantsFetch {name} + act.pet.play → fetch {petId}
       wish     each home pet (the home order) that is not hungry and has a wish not done today (no
                'wish:<petId>'): act.wish.ride / act.wish.rest {name, item} + isle.goThere → isle {isle,
                uid, petId}; act.wish.visit {name, island} + isle.goThere → isle {isle, petId} (never the
                island the child is on); act.wish.meet {name} + act.vis.hello → visitor {petId} (while the
                visitor is not greeted today: no 'hello'; the host's hello also marks each home pet's meet
                wish 'wish:<petId>'). A wish's go always names its pet: two pets may wish for the same thing
                the same day (both to meet the visitor, both a rest on one seat), and {id, go} must still
                tell their cards apart (env.hold), and tell the host whose wish it is
       ride     the ride idea above; with finds3.tried in the save, the things never tried first (only
                they, while any are left), with the same words
       visit    the visit idea above
       hide     env.pet, no 'hide' today: act.pet.wantsHide {name} + act.pet.play → hide {petId}
       decorate the decorate idea above; the bag card's go also names the first thing (edit {isle, id})
       try      the game idea above when it offers its 'try' or 'again' cards; not with games false
       remix    the game idea above when it offers its Remix cards; not with games false
       goal     the goal idea above (saving / suggest; free in test mode)
       The ideas that fit (MIX order, did-skipping) take turns as the decisions build's do: the card is
       the one at days.n + turn (mod how many fit), and that idea's choice the one at (days.n + turn) ÷
       how many fit (mod its choices). Island activities are free play: games false never skips visitor,
       show, spy, fetch, wish or hide. A target on another island needs travel (else that card does not
       fit). The go targets a card can carry: + visitor {petId?}, show {isle}, spy {isle}, isle {isle, uid?,
       petId?}, fetch {petId}, hide {petId} (and the host's today and book, which no card points at: no book
       reminders); petId on visitor and isle = the pet whose wish it is (the wish cards only). No two cards
       that can show together share an id and a go, so a hold matches one card at most.
     With days every card also carries goalBar: null | {have, price, pct, key: 'act.next.goalBar',
       params: {item, n, price}}, the slim 🎯 goal bar (§4.4) on every MIX card that is not a goal card
       (saving / suggest / free) while a goal is set, short and real prices are on (never in test mode),
       in the call's wallet. The urgent cards (a hungry pet, the Pet Rescue, enough) never carry it: the
       bar keeps the goal in view through the rotation; pets come first and their cards stay about care.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLNextStep = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRIP_MS = 3 * 60 * 60 * 1000;        /* a trip is forgotten after 3 hours */
  var TRIP_KEEP_MS = 12 * 60 * 60 * 1000;  /* a trip that names its island day: until that day ends, 12 hours at most (a backstop) */
  var SESSION_MIN = 25;                     /* ECONOMY.sessionPts is a ~25-minute learning session (kept for older callers) */
  var DAY_MIN = 60;                         /* the ECONOMY day is about an hour of learning (James, 25 Oct 2026) */
  var STEP_MIN = 5;
  var URGENT = Object.freeze(['feed', 'rescue', 'enough']);
  var IDEAS = Object.freeze(['visit', 'ride', 'decorate', 'game', 'goal']);
  /* Island activities v1 (IA-2): the ideas taking turns once the island day is known (env.days) */
  var MIX = Object.freeze(['visitor', 'show', 'spy', 'fetch', 'wish', 'ride', 'visit', 'hide', 'decorate', 'try', 'remix', 'goal']);
  var RULES = Object.freeze(['feed', 'rescue', 'enough', 'visit', 'ride', 'bag', 'add', 'try', 'remix', 'again', 'saving', 'suggest', 'free',
    'visitor', 'show', 'spy', 'fetch', 'wish', 'hide']);
  /* the cards that never carry the slim goal bar: the pets' urgent cards and the goal's own cards */
  var NO_BAR = { feed: 1, rescue: 1, enough: 1, saving: 1, suggest: 1, free: 1 };
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
  function tripLive(trip, who, now, day) {
    if (!plain(trip) || trip.v !== 1 || typeof trip.id !== 'string' || !trip.id) return false;
    if (who == null || trip.who !== who) return false;
    if (!num(now) || !num(trip.at)) return false;
    var age = now - trip.at;
    /* §4.1: with the island day, until that day ends (12 hours at most); without it, the 3-hour rule */
    if (typeof day === 'string' && DAY_RE.test(day)) return trip.day === day && age >= 0 && age <= TRIP_KEEP_MS;
    return age >= 0 && age <= TRIP_MS;
  }
  /* the day island() gives tripLive: env.day, only for a trip that names its own day */
  function tripDay(env) { return plain(env.trip) && typeof env.trip.day === 'string' ? env.day : undefined; }

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
    var x = { C: C, U: U, w: U.world, o: o, trial: o.trial, env: env, st: st, LV: care && plain(care.ALERT_LV) ? care.ALERT_LV : ALERT0,
      play: env.games !== false, travel: env.travel !== false, isle: isle, left: left, learnHere: env.learnHere === true,
      turn: num(env.turn) ? Math.floor(env.turn) : 0, days: null };
    if (plain(env.days)) mixCtx(x, env);
    return x;
  }
  /* IA-2: the island day (env.days), the pet that can play (env.pet), the card on show (env.hold), the things tried and the goal bar */
  function mixCtx(x, env) {
    var d = env.days, today = typeof d.day === 'string' && DAY_RE.test(d.day) ? d.day : typeof env.day === 'string' && DAY_RE.test(env.day) ? env.day : null;
    x.days = { n: num(d.n) ? Math.floor(d.n) : 0, did: didOf(d.did, today), visitor: d.visitor, show: d.show, spy: d.spy, wishes: d.wishes };
    x.pet = petOf(x, env.pet);
    var f = plain(x.w.finds3) ? x.w.finds3 : null;
    x.tried = f && plain(f.tried) ? f.tried : null;
    x.hold = plain(env.hold) && typeof env.hold.id === 'string' && plain(env.hold.go) ? env.hold : null;
    x.gameCards = null;                       /* the game idea's cards, worked out once for try and remix */
    x.bar = goalBar(x);
  }
  /* today's done flags as a set: a list, the save's {d, f} (another day's d: none), or {flag: true} */
  function didOf(v, today) {
    var out = {}, list = [];
    if (Array.isArray(v)) list = v;
    else if (plain(v) && (has(v, 'f') || has(v, 'd'))) list = Array.isArray(v.f) && !(typeof v.d === 'string' && today && v.d !== today) ? v.f : [];
    else if (plain(v)) list = Object.keys(v).filter(function (k) { return v[k] === true || v[k] === 1; });
    list.forEach(function (k) { if (typeof k === 'string' && k) out[k] = true; });
    return out;
  }
  /* pet-care's alert level of a pet in the status */
  function levelOf(x, p) { return has(x.LV, p.level) && num(x.LV[p.level]) ? x.LV[p.level] : 0; }
  /* the pet that can play: the host's {id, name}; with the care rules, a pet at home that is not hungry (its own name) */
  function petOf(x, v) {
    if (!plain(v) || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string' || !v.name) return null;
    if (!x.st) return { id: v.id, name: v.name };
    var p = x.st.pets.filter(function (q) { return q && q.id === v.id; })[0];
    if (!p || p.where !== 'home' || levelOf(x, p) >= 2) return null;
    return { id: p.id, name: typeof p.name === 'string' && p.name ? p.name : v.name };
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
  /* the core's ride table (SLWorldCore.RIDE_ACTS, by act); a core without it has no rides, so every thing reads 'Try the' */
  function isRide(x, it) { var R = x.C.RIDE_ACTS; return Array.isArray(R) && R.indexOf(it.act) >= 0; }

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
      var lv = function (p) { return levelOf(x, p); };
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
      if (tripLive(env.trip, env.who, env.now, tripDay(env)) && x.C.item(env.trip.id) && stateOf(x, env.trip.id) === 'affordable') return enoughCard('enough', x, env.trip.id);
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
        /* a real ride: 'Have a go on the Big Wheel.'; anything else: 'Try the Fountain.' (James, 26 Oct 2026) */
        out.push(card('ride', key(isRide(x, it) ? 'next.ride' : 'next.tryThing', { item: it.name }), { key: 'next.rideBtn', params: null, go: { to: 'ride', isle: x.isle, uid: p.uid } }, itemIcon(it.id)));
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

  /* ---------------- Island activities v1 (IA-2): the MIX, once the island day is known ---------------- */
  function ownIsle(x, k) { return typeof k === 'string' && !!x.C.ISLES && has(x.C.ISLES, k) && opened(x, k); }
  /* somewhere the card can take the child: the island they are on, or another one when the stage can fly */
  function reach(x, k) { return k === x.isle || x.travel; }
  function petIcon(id) { return { kind: 'pet', id: id }; }
  /* the thing uid on island k (else on any island the child owns): {isle, id, name} | null */
  function thingAt(x, uid, k) {
    if (typeof uid !== 'string' || !uid) return null;
    var order = Array.isArray(x.C.ISLE_ORDER) ? x.C.ISLE_ORDER : [];
    var isles = ownIsle(x, k) ? [k] : order.filter(function (q) { return ownIsle(x, q); });
    for (var i = 0; i < isles.length; i++) {
      var p = placedOn(x, isles[i]).filter(function (q) { return q && q.uid === uid; })[0], it = p && x.C.item(p.id);
      if (it && typeof it.name === 'string' && it.name) return { isle: isles[i], id: it.id, name: it.name };
    }
    return null;
  }
  /* the slim 🎯 goal bar (§4.4): a goal set and still short, real prices only, in the call's wallet */
  function goalBar(x) {
    if (x.trial || !goalSet(x)) return null;
    var g = goalOf(x);
    if (!g || g.ready === true || g.locked || g.full || !x.C.item(g.id) || stateOf(x, g.id) === 'owned') return null;
    if (!num(g.price) || !num(g.have) || !(g.price > 0) || !(g.price - g.have > 0)) return null;
    var have = Math.max(0, g.have);
    return { have: have, price: g.price, pct: Math.min(100, Math.floor(have * 100 / g.price)), key: 'act.next.goalBar',
      params: { item: nameOf(x, g.id), n: have, price: g.price } };
  }
  /* a pet's wish as a card (null: it cannot be done from here). Its go always names the pet (petId): two pets
     can wish for the same thing on the same day (both to meet the visitor, both a rest on one seat), and
     {id, go} must tell their cards apart, so env.hold keeps the pet on show and the host knows whose wish it is */
  function wishCard(x, p, wi) {
    /* IA-1's today() also marks a wish done today (done: true, from the same 'wish:<petId>' flag) */
    if (!plain(wi) || wi.done === true || typeof p.name !== 'string' || !p.name) return null;
    var name = p.name, v = x.days.visitor, k = wi.isle, at;
    if (wi.kind === 'meet') {
      /* the visitor already greeted today: the hello has met the wish (the host marks it with the hello), no second Say hello */
      if (!plain(v) || typeof v.id !== 'string' || !v.id || x.days.did.hello || !reach(x, 'home')) return null;
      return card('wish', key('act.wish.meet', { name: name }), { key: 'act.vis.hello', params: null, go: { to: 'visitor', petId: p.id } }, petIcon(p.id));
    }
    if (wi.kind === 'visit') {
      /* never the island the child is on (the wish comes true on arriving there) */
      if (!ownIsle(x, k) || k === x.isle || !x.travel) return null;
      return card('wish', key('act.wish.visit', { name: name, island: isleName(x, k) }), { key: 'isle.goThere', params: null, go: { to: 'isle', isle: k, petId: p.id } }, petIcon(p.id));
    }
    if (wi.kind === 'ride' || wi.kind === 'rest') {
      at = thingAt(x, wi.uid, k);
      if (!at || !reach(x, at.isle)) return null;
      return card('wish', key(wi.kind === 'ride' ? 'act.wish.ride' : 'act.wish.rest', { name: name, item: at.name }),
        { key: 'isle.goThere', params: null, go: { to: 'isle', isle: at.isle, uid: wi.uid, petId: p.id } }, petIcon(p.id));
    }
    return null;
  }
  function gameCards(x) { if (!x.gameCards) x.gameCards = IDEA.game(x); return x.gameCards; }
  var MIXER = {
    visitor: function (x) {
      var v = x.days.visitor;
      if (!plain(v) || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string' || !v.name || x.days.did.hello || !reach(x, 'home')) return [];
      return [card('visitor', key('act.next.visitor', { name: v.name }), { key: 'act.vis.hello', params: null, go: { to: 'visitor' } }, { kind: 'char', id: v.id })];
    },
    show: function (x) {
      var s = x.days.show, k = plain(s) ? s.isle : null;
      if (!ownIsle(x, k) || x.days.did['show:' + k] || !reach(x, k)) return [];
      return [card('show', key('act.today.show', { island: isleName(x, k) }), { key: 'act.show.start', params: null, go: { to: 'show', isle: k } }, isleIcon(k))];
    },
    spy: function (x) {
      var s = x.days.spy, k = plain(s) ? s.isle : null;
      /* the matching things (uids), when given, must be a list with something in it: nothing to spy, no card */
      if (!ownIsle(x, k) || x.days.did['spy:' + k] || !reach(x, k) || (has(s, 'uids') && !(Array.isArray(s.uids) && s.uids.length))) return [];
      return [card('spy', key('act.today.spy', { island: isleName(x, k) }), { key: 'isle.goThere', params: null, go: { to: 'spy', isle: k } }, isleIcon(k))];
    },
    'fetch': function (x) {
      var p = x.pet;
      if (!p || x.days.did['fetch']) return [];
      return [card('fetch', key('act.pet.wantsFetch', { name: p.name }), { key: 'act.pet.play', params: null, go: { to: 'fetch', petId: p.id } }, petIcon(p.id))];
    },
    wish: function (x) {
      var W = x.days.wishes, out = [];
      if (!plain(W) || !x.st) return out;
      x.st.pets.forEach(function (p) {
        if (!p || p.where !== 'home' || levelOf(x, p) >= 2 || x.days.did['wish:' + p.id] || !has(W, p.id)) return;
        var c = wishCard(x, p, W[p.id]);
        if (c) out.push(c);
      });
      return out;
    },
    ride: function (x) {
      var all = IDEA.ride(x), t = x.tried;
      if (!t) return all;
      /* the things never tried first (finds3.tried, by item), while any are left */
      var fresh = all.filter(function (c) { return !has(t, c.icon.id); });
      return fresh.length ? fresh : all;
    },
    visit: function (x) { return IDEA.visit(x); },
    hide: function (x) {
      var p = x.pet;
      if (!p || x.days.did.hide) return [];
      return [card('hide', key('act.pet.wantsHide', { name: p.name }), { key: 'act.pet.play', params: null, go: { to: 'hide', petId: p.id } }, petIcon(p.id))];
    },
    decorate: function (x) {
      return IDEA.decorate(x).map(function (c) {
        if (c.id !== 'bag') return c;
        /* Edit on this island with the bag's first thing named (edit {isle, id}) */
        return card(c.id, c.text, { key: c.btn.key, params: c.btn.params, go: { to: 'edit', isle: c.btn.go.isle, id: c.icon.id } }, c.icon, c.progress);
      });
    },
    'try': function (x) { var g = gameCards(x); return g.length && g[0].id !== 'remix' ? g : []; },
    remix: function (x) { var g = gameCards(x); return g.length && g[0].id === 'remix' ? g : []; },
    goal: function (x) { return IDEA.goal(x); }
  };
  /* a card in the mix's shape: + goalBar (null on the urgent and the goal's own cards) */
  function dress(x, c) {
    return { id: c.id, text: c.text, btn: c.btn, icon: c.icon, progress: c.progress, goalBar: has(NO_BAR, c.id) ? null : x.bar };
  }
  function sameGo(a, b) {
    if (!plain(a) || !plain(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return has(b, k) && a[k] === b[k]; });
  }
  function mixed(x) {
    var fit = [], i, j;
    for (i = 0; i < MIX.length; i++) {
      var cs = MIXER[MIX[i]](x);
      if (cs.length) fit.push(cs);
    }
    if (!fit.length) return null;
    /* the card on show stays while it still fits (the same open, the same turn) */
    if (x.hold) for (i = 0; i < fit.length; i++) for (j = 0; j < fit[i].length; j++) {
      if (fit[i][j].id === x.hold.id && fit[i][j].btn && sameGo(fit[i][j].btn.go, x.hold.go)) return dress(x, fit[i][j]);
    }
    var k = x.days.n + x.turn, pick = fit[mod(k, fit.length)];
    return dress(x, pick[mod(Math.floor(k / fit.length), pick.length)]);
  }

  function island(C, u, env) {
    if (!C || typeof C.item !== 'function' || typeof C.ensureWorld !== 'function') return null;
    var x = ctxOf(C, u, plain(env) ? env : {});
    for (var i = 0; i < URGENT.length; i++) {
      var r = RULE[URGENT[i]](x);
      if (r) return x.days ? dress(x, r) : r;
    }
    if (x.days) return mixed(x);
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
    TRIP_MS: TRIP_MS, TRIP_KEEP_MS: TRIP_KEEP_MS, SESSION_MIN: SESSION_MIN, DAY_MIN: DAY_MIN, RULES: RULES, URGENT: URGENT, IDEAS: IDEAS, MIX: MIX,
    GAMES: GAMES, REMIX: REMIX
  };
}));
