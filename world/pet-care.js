/* ================================================================
   My Island — pet care (pure; no DOM, no THREE, no clock, no chance).
   window.SLPetCare in the browser (loaded by slLoadWorld after world-core.js
   and people-core.js, KU21), require() in Node. Kids update chunk P1.2
   (docs/island3d/v3/kids-update/plan-ku.json KU4, KU5, KU6, KU39, KU40;
   pets.json care.*, homeCap, food.diet, dataModel).

   The rules of looking after a pet. Every function is given the island day
   ('YYYY-MM-DD', the host's C.dayKey(ms, tz)) and the moment (ms) it needs;
   nothing here reads a clock or rolls a number, so the same calls on the
   same save always give the same JSON.

     ISLAND DAYS  one care step per day the child opens My Island (CARE.dayRule
                  'island'; 'app' lets an app open count too). Days away never count.
     TUMMY        food 0-3 meals; a step eats one, or counts a missed day. Missed
                  1 hungry, 2 very hungry (warning), 3 last chance, 4 the Pet Rescue:
                  a full pet goes 7 island days without a meal before the Rescue.
     HAPPINESS    happy 0-4: a step lowers it by 1; a pat, a play and its favourite
                  food add 1 each per island day, treats up to 2; capped at 1 while
                  hungry. It only changes how the pet behaves.
     HOME         care3.home: at most CARE.homeMax pets, the child's order. A pet at the
                  Rescue keeps its spot. Hotel guests are every other owned pet with a
                  record; their records are frozen while they stay (KU5c).
     PET HOTEL    never a way round feeding (KU5): no hungry pet checks in ('hungry'),
                  one pet always stays home ('last_home'), and with ownCap 'total' the
                  Hotel is only for pets above the cap ('hotel_closed', KU4).
     PET RESCUE   3 caring visits on 3 different island days bring a pet home full.
                  A grown-up can bring it home at once (applyFamily 'release').
     FAREWELL     only with the grown-up's switch (cfg.farewell, off by default): a pet
                  that waits at the Rescue starAfter island days with no visit passes
                  away and becomes a star with a memory card; the grown-up can bring it
                  back ('unstar'). The child is told the rule once (ruleNews, KU40).
     PET SITTER   the grown-up's holiday pause: no step changes anything.
     BASIC MEAL   (F-KU4; James, 24 Oct 2026: basic care is always possible at zero stars)
                  a free plain meal, BASIC, when the pantry holds nothing the pet eats and
                  the child cannot get any now (in the wallet the shop uses): one per pet per
                  island day, only for an empty tummy at home or for a Rescue visit. One a day
                  is what a pet eats in a day, so it can never be saved up; it is never in
                  the pantry or the ledger and is never a favourite. freeDay is the island
                  day the meal belongs to (care3.day, the last day the step counted), never
                  the host's date: a meal after midnight before the step belongs to the day
                  before, and a clock that goes back and forth never gives a second one
                  (F-KU5 review). A Rescue visit is never on or before the last one's day.

   The storage is the v3-only block w.care3 (plan-ku dataModel.saveSchema), which old
   clients never read. world-core owns its constants (C.CARE), its repair (N13), its
   merge (M3c), food purchases and the cap (C.petRoom); this module owns every rule
   that uses time. careRunner stays the core's; setActivePet stays the only writer of
   the runner, called here when the runner leaves home.

   API (u = a profile {name, points, world}, w = u.world):
     start(u, day, ms, {home})   care begins: records for every pet, the welcome bag, the
                                 picker's home → {ok, started}
     needsPick(w)  defaultHome(w)
     tick(u, day, ms, {from})    the island day's step → {ok, changed, events}
     feed(u, petId, foodId, day, ms, opts)   a meal or a treat → {ok, treat, fav, food, happy, recovered, counted}
                                 (foodId BASIC: the free basic meal, opts {trial, wallet} as the
                                 shop's → + basic: true)
     pat / play(u, petId, day, ms)      once per island day each → {ok, counted, happy}
     rescueVisit(u, petId, foodId, day, ms, opts) → {ok, visits, left, home} (foodId BASIC as feed)
     basicMeal(u, petId, day, opts)     may this pet have the free basic meal now? → {ok, mode
                                 'meal' | 'visit', basic: true} or {ok: false, code, reason}
     toHotel(u, petId, ms)  toHome(u, petId, ms)  swap(u, outId, inId, ms)  setHome(u, ids, ms)
     applyFamily(u, {petCare, kid}, day, ms)   the grown-up's settings and commands
     ruleNews(w)  markRuleSeen(u, setAt, ms)   the one-time farewell rule card
     sitterOn(w, day)  canFeed(w, petId, foodId, day)  status(w, day)  memories(w)  alertOf(w)
     DIET, LEVELS, ALERT_LV, dietOf, levelOf, tummyKey, cardOf, toastOf, CARD_ORDER, TOAST_ORDER
     create(C)   the same API bound to another core (tests load a core with the other cap)
   Every writer returns {ok: true, …} or {ok: false, code, reason} and can run inside
   SLWorldCore.transact (the host's commit()). Readers never write.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var core = null;
    try { core = require('./world-core.js'); } catch (e) { core = null; }
    module.exports = factory(root, core);
  } else root.SLPetCare = factory(root, root.SLWorldCore || null);
}(typeof self !== 'undefined' ? self : this, function (root, CORE0) {
  'use strict';

  /* ---------------- diet: one row per species (pets.json food.diet) ----------------
     fav = the favourite food group; noFish = a plant-eater (no Fish nibbles). Every pet eats
     Pet biscuits; treats are a snack for any pet. A species this file does not know eats
     biscuits (and treats) only. */
  var FAV = {
    pet_puppy: 'biscuits', pet_kitten: 'fish', pet_bunny: 'veg', pet_dragon: 'fruit',
    pet_crab: 'fish', pet_gull: 'fish', pet_capybara: 'veg', pet_monkey: 'fruit', pet_squirrel: 'fruit',
    pet_owl: 'biscuits', pet_duckling: 'veg', pet_pony: 'veg', pet_penguin: 'fish', pet_seal: 'fish',
    pet_hamster: 'fruit', pet_guineapig: 'veg', pet_tortoise: 'veg', pet_budgie: 'fruit', pet_otter: 'fish',
    pet_flamingo: 'fish', pet_sloth: 'veg', pet_toucan: 'fruit', pet_redpanda: 'veg', pet_hedgehog: 'biscuits',
    pet_goatkid: 'veg', pet_peacock: 'fruit', pet_reindeer: 'veg', pet_snowleopard: 'fish'
  };
  var NO_FISH = ['pet_bunny', 'pet_capybara', 'pet_monkey', 'pet_squirrel', 'pet_pony', 'pet_hamster', 'pet_guineapig',
    'pet_tortoise', 'pet_budgie', 'pet_sloth', 'pet_toucan', 'pet_redpanda', 'pet_goatkid', 'pet_reindeer'];
  var DIET = {};
  Object.keys(FAV).forEach(function (id) { DIET[id] = Object.freeze({ fav: FAV[id], noFish: NO_FISH.indexOf(id) >= 0 }); });
  Object.freeze(DIET);
  var UNKNOWN_DIET = Object.freeze({ fav: null, noFish: true, only: Object.freeze(['biscuits', 'treat']) });

  /* tummy levels of a pet at home, best first, and the alert level each one raises
     (care3.alert: 0 fine, 1 peckish, 2 hungry, 3 warning or last chance) */
  var LEVELS = Object.freeze(['full', 'fed', 'peckish', 'hungry', 'warn', 'last']);
  var ALERT_LV = Object.freeze({ full: 0, fed: 0, peckish: 1, hungry: 2, warn: 3, last: 3 });
  var TUMMY_KEY = Object.freeze({ full: 'full', fed: 'fed', peckish: 'peckish', hungry: 'hungry', warn: 'veryHungry', last: 'veryHungry' });
  /* the island-open card (one at most per open, most important first) and the toast */
  var CARD_ORDER = Object.freeze(['star', 'rescued', 'last', 'warn', 'starSoon', 'arrived']);
  var TOAST_ORDER = Object.freeze(['hungry', 'peckish']);
  var KINDS = Object.freeze(['release', 'unstar']);

  var REASON = {
    no_care: 'Pet care isn’t ready yet.',
    bad_day: 'Please try again.',
    bad_time: 'Please try again.',
    not_started: 'Pet care hasn’t started yet.',
    not_home: 'That pet isn’t at home.',
    at_home: 'That pet is already at home.',
    at_hotel: 'The Pet Hotel is looking after that pet.',
    at_rescue: 'That pet is at the Pet Rescue. Visit them there.',
    not_hotel: 'That pet isn’t at the Pet Hotel.',
    not_rescue: 'That pet isn’t at the Pet Rescue.',
    unknown_food: 'That isn’t pet food.',
    diet: 'That pet doesn’t eat that food.',
    full: 'That pet is full. Come back next time.',
    none: 'None of that food is left. Get more in the Pet Shop.',
    meal_needed: 'A visit needs a meal, not a treat.',
    visited: 'You visited today. Come back on another day.',
    visit_first: 'Visit them at the Pet Rescue first.',
    hotel_closed: 'Your pets all live at home with you.',
    hungry: 'Give them a meal first, then the Pet Hotel can look after them.',
    last_home: 'One pet always stays at home.',
    home_full: 'Home is full. Move a pet to the Pet Hotel to make room.',
    pick_count: 'Pick 1 to 3 pets for home.',
    bad_pick: 'Pick pets from your crew.',
    /* the free basic meal (F-KU4) */
    not_hungry: 'That pet isn’t hungry yet. A free meal is for an empty tummy.',
    free_used: 'That pet had a free meal today. Come back on another day.',
    has_food: 'There’s food in your pantry for that pet. Use that first.',
    can_buy: 'You can get food in the Pet Shop.'
  };
  Object.freeze(REASON);
  /* the free basic meal: not a food (never in the catalogue, the pantry or the ledger); every
     pet eats it and it is nobody's favourite */
  var BASIC = 'basic_meal';

  /* ---------------- small helpers (no clock) ---------------- */
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi, dflt) { return isInt(v) ? Math.max(lo, Math.min(hi, v)) : dflt; }
  /* days since 1970-01-01 of a 'YYYY-MM-DD' string (proleptic Gregorian), or null */
  function dayNum(d) {
    var m = typeof d === 'string' ? DAY_RE.exec(d) : null;
    if (!m) return null;
    var y = +m[1], mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    y -= mo <= 2 ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400;
    var doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + da - 1;
    return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  }
  function isDay(d) { return dayNum(d) !== null; }
  function isMs(ms) { return typeof ms === 'number' && isFinite(ms); }
  function iso(ms) { return new Date(ms).toISOString(); }
  /* setAt is the family doc's ms (as arcadeCfg); an ISO string is read as its ms */
  function stampOf(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { var n = Date.parse(v); return isFinite(n) ? n : 0; }
    return 0;
  }
  function fail(code, extra) {
    var r = { ok: false, code: code, reason: REASON[code] || 'Please try again.' };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    return r;
  }
  function dietOf(petId) { return own(DIET, petId) ? DIET[petId] : UNKNOWN_DIET; }
  function eats(diet, group) {
    if (diet.only) return diet.only.indexOf(group) >= 0;
    return !(group === 'fish' && diet.noFish);
  }
  /* the tummy level of a record (rescue and star are where a pet is, not a level) */
  function levelOf(rec, CARE) {
    var K = CARE || { foodMax: 3, warnAt: 2, lastAt: 3 };
    var food = clamp(rec && rec.food, 0, K.foodMax, 0), missed = clamp(rec && rec.missed, 0, 99, 0);
    if (missed >= K.lastAt) return 'last';
    if (missed >= K.warnAt) return 'warn';
    if (missed >= 1) return 'hungry';
    if (food === 0) return 'peckish';
    return food >= K.foodMax ? 'full' : 'fed';
  }
  function tummyKey(level) { return own(TUMMY_KEY, level) ? 'care.tummy.' + TUMMY_KEY[level] : null; }
  function firstBy(order, events) {
    for (var i = 0; i < order.length; i++) {
      for (var j = 0; j < (events || []).length; j++) if (events[j] && events[j].type === order[i]) return events[j];
    }
    return null;
  }
  function cardOf(events) { return firstBy(CARD_ORDER, events); }
  function toastOf(events) { return firstBy(TOAST_ORDER, events); }

  /* ---------------- the API, bound to one world core ---------------- */
  function make(getCore) {
    function core() { return getCore(); }
    var NEEDS = ['careOf', 'homePets', 'petWhere', 'careRunner', 'pantryCount', 'petRoom', 'isFood', 'foodItems',
      'item', 'crewList', 'crewPet', 'wornBy', 'activePetId', 'setActivePet', 'ensureWorld'];
    function ready() {
      var c = core();
      if (!c || !plain(c.CARE)) return false;
      for (var i = 0; i < NEEDS.length; i++) if (typeof c[NEEDS[i]] !== 'function') return false;
      return true;
    }
    function K() { return core().CARE; }

    function careOf(w) { var cc = core().careOf(w); return plain(cc) ? cc : null; }
    function started(w) { var cc = careOf(w); return !!(cc && isDay(cc.day)); }
    function crewIds(w) { return core().crewList(w).map(function (p) { return p.id; }); }
    function recOf(cc, id) { return cc && plain(cc.pets) && plain(cc.pets[id]) ? cc.pets[id] : null; }
    function where(w, id) { return core().petWhere(w, id); }
    /* home pets that are really at home (not at the Rescue), in the child's order */
    function freeHome(w) { return core().homePets(w).filter(function (id) { return where(w, id) === 'home'; }); }
    /* home spots in use: the core's home pets plus ids this client does not know (future
       species keep their spot, N13d) */
    function homeUsed(w, cc) {
      var c = core(), extra = (Array.isArray(cc.home) ? cc.home : []).filter(function (id) { return typeof id === 'string' && !c.item(id); });
      return c.homePets(w).length + extra.length;
    }
    function nameOf(w, id) { var p = core().crewPet(w, id); return p ? p.name : (core().DEFAULT_PET_NAMES || {})[id] || 'Buddy'; }
    function freshRec(day, at) {
      var CARE = K();
      return { food: CARE.foodMax, missed: 0, happy: CARE.happyStart, adopted: day, fedDay: null, favDay: null,
        patDay: null, playDay: null, treatDay: null, treats: 0, rescue: null, star: null, at: at };
    }
    /* a care write: the block's frame, the alert and the profile's revision */
    function wrote(u, w, cc, at) {
      var c = core();
      cc.at = at;
      cc.alert = alertOf(w);
      if (isInt(c.VERSION) && !(isInt(w.v) && w.v >= c.VERSION)) w.v = c.VERSION;
      w.rev = (isInt(w.rev) ? w.rev : 0) + 1;
      w.updatedAt = at;
    }
    /* the runner leaves home: hand it to the first home pet in `order` that is really at
       home, through setActivePet (the only writer of the runner). Nobody free → no write. */
    function handOff(u, w, order, ms) {
      for (var i = 0; i < order.length; i++) {
        if (where(w, order[i]) !== 'home') continue;
        var r = core().setActivePet(u, order[i], ms);
        return r && r.ok ? order[i] : null;
      }
      return null;
    }
    function rotate(list, from) {
      var out = [];
      for (var i = 0; i < list.length; i++) out.push(list[(from + i) % list.length]);
      return out;
    }
    function pantryEat(cc, foodId) {
      if (!plain(cc.pantry)) cc.pantry = {};
      var p = plain(cc.pantry[foodId]) ? cc.pantry[foodId] : (cc.pantry[foodId] = { got: 0, ate: 0 });
      p.ate = (isInt(p.ate) && p.ate > 0 ? p.ate : 0) + 1;
    }
    function begin(u, day, ms, needDay) {
      if (!ready()) return { err: fail('no_care') };
      if (needDay && !isDay(day)) return { err: fail('bad_day') };
      if (!isMs(ms)) return { err: fail('bad_time') };
      var w = core().ensureWorld(u), cc = careOf(w);
      if (!cc || !isDay(cc.day)) return { err: fail('not_started') };
      return { w: w, cc: cc, at: iso(ms) };
    }

    /* ---------------- reads ---------------- */
    function sitterOn(w, day) {
      var cc = careOf(w), s = cc && plain(cc.cfg) && plain(cc.cfg.sitter) ? cc.cfg.sitter : null;
      if (!s || s.on !== true) return false;
      return s.until == null || !isDay(s.until) || (isDay(day) && day <= s.until);
    }
    function farewellOn(cc) { return !!(cc && plain(cc.cfg) && cc.cfg.farewell === true); }
    /* care3.alert: the highest tummy level among the pets really at home, and who is at it */
    function alertOf(w) {
      if (!ready()) return null;
      var cc = careOf(w);
      if (!cc) return null;
      var lv = 0, ids = [];
      freeHome(w).forEach(function (id) {
        var rec = recOf(cc, id);
        if (!rec) return;
        var l = ALERT_LV[levelOf(rec, K())];
        if (l > lv) { lv = l; ids = [id]; } else if (l === lv && l > 0) ids.push(id);
      });
      return { lv: lv, ids: ids };
    }
    function needsPick(w) { return ready() && !started(w) && crewIds(w).length > K().homeMax; }
    /* who the picker ticks: once care has started, today's home; before, the runner and
       then the newest pets (crewList order, newest first) up to homeMax */
    function defaultHome(w) {
      if (!ready()) return [];
      if (started(w)) return core().homePets(w).slice();
      var list = core().crewList(w), out = [], max = K().homeMax;
      list.forEach(function (p) { if (p.active && out.length < max) out.push(p.id); });
      for (var i = list.length - 1; i >= 0 && out.length < max; i--) if (out.indexOf(list[i].id) < 0) out.push(list[i].id);
      return out;
    }
    function ruleNews(w) {
      var cc = careOf(w);
      if (!farewellOn(cc)) return null;
      var at = cc.cfg.setAt == null ? 0 : cc.cfg.setAt;
      return plain(cc.told) && cc.told.farewell === at ? null : at;
    }
    /* the island day a free basic meal belongs to (BASIC MEAL above), and a Rescue visit already made on or after
       this day (the date going back and forth never gives another one) */
    function freeDayOf(w) { var cc = careOf(w); return cc && isDay(cc.day) ? cc.day : null; }
    function visitedBy(rec, day) {
      var last = plain(rec.rescue) && isDay(rec.rescue.last) ? dayNum(rec.rescue.last) : null;
      return last !== null && dayNum(day) <= last;
    }
    /* can this pet eat this food now? mode 'meal' (at home) or 'visit' (at the Rescue) */
    function foodCheck(w, cc, petId, foodId, day, rec, mode) {
      var c = core(), f = c.isFood(foodId) ? c.item(foodId) : null;
      if (!f) return fail('unknown_food');
      var g = f.group, treat = g === 'treat', d = dietOf(petId);
      if (!eats(d, g)) return fail('diet', { fav: d.fav });
      if (mode === 'visit') {
        if (treat) return fail('meal_needed');
        if (visitedBy(rec, day)) return fail('visited');
      } else if (!treat && clamp(rec.food, 0, K().foodMax, 0) >= K().foodMax) return fail('full');
      if (!(c.pantryCount(w, foodId) >= 1)) return fail('none');
      return { ok: true, treat: treat, fav: !treat && g === d.fav, mode: mode };
    }
    /* may this pet have the free basic meal now (BASIC MEAL above)? wh: where the pet is. The
       pantry and the shop are asked in the order a child would: food at home first, then food
       the child could get now (purchaseCheck with the shop's own {trial, wallet}). */
    function basicCheck(u, w, petId, day, rec, wh, opts) {
      var c = core(), CARE = K(), d = dietOf(petId);
      if (wh === 'rescue') {
        if (!plain(rec.rescue)) return fail('not_rescue');
        if (visitedBy(rec, day)) return fail('visited');
      } else if (wh !== 'home') return fail(wh === 'hotel' ? 'at_hotel' : 'not_home');
      else if (clamp(rec.food, 0, CARE.foodMax, 0) > 0) return fail('not_hungry');
      if (rec.freeDay === freeDayOf(w)) return fail('free_used');
      var meals = c.foodItems().filter(function (f) { return f.group !== 'treat' && eats(d, f.group); });
      if (meals.some(function (f) { return c.pantryCount(w, f.id) >= 1; })) return fail('has_food');
      if (typeof c.purchaseCheck === 'function') {
        var o = { trial: !!(opts && opts.trial) };
        if (opts && typeof opts.wallet === 'string') o.wallet = opts.wallet;
        if (meals.some(function (f) { var r = c.purchaseCheck(u, f.id, o); return !!(r && r.ok); })) return fail('can_buy');
      }
      return { ok: true, treat: false, fav: false, mode: wh === 'rescue' ? 'visit' : 'meal', basic: true };
    }
    function basicMeal(u, petId, day, opts) {
      if (!ready()) return fail('no_care');
      if (!isDay(day)) return fail('bad_day');
      var w = u && plain(u.world) ? u.world : null, cc = careOf(w);
      if (!cc || !isDay(cc.day)) return fail('not_started');
      var wh = where(w, petId), rec = recOf(cc, petId);
      if (!rec || (wh !== 'home' && wh !== 'rescue')) return fail(wh === 'hotel' ? 'at_hotel' : 'not_home');
      return basicCheck(u, w, petId, day, rec, wh, opts);
    }
    function canFeed(w, petId, foodId, day) {
      if (!ready()) return fail('no_care');
      var cc = careOf(w);
      if (!cc || !isDay(cc.day)) return fail('not_started');
      var wh = where(w, petId), rec = recOf(cc, petId);
      if (!rec || (wh !== 'home' && wh !== 'rescue')) return fail(wh === 'hotel' ? 'at_hotel' : 'not_home');
      return foodCheck(w, cc, petId, foodId, day, rec, wh === 'rescue' ? 'visit' : 'meal');
    }
    function memories(w) {
      var cc = careOf(w);
      return cc && Array.isArray(cc.stars) ? clone(cc.stars.filter(plain)) : [];
    }
    /* everything the Pet Corner, the island and the cards need for one island day */
    function status(w, day) {
      if (!ready()) return null;
      var c = core(), CARE = K(), cc = careOf(w), runner = c.careRunner(w);
      var pantry = c.foodItems().map(function (f) { return { id: f.id, group: f.group, n: c.pantryCount(w, f.id) }; });
      var out = { started: started(w), day: cc && isDay(cc.day) ? cc.day : null, days: cc && isInt(cc.days) ? cc.days : 0,
        needsPick: needsPick(w), pets: [], pantry: pantry, sitter: sitterOn(w, day), farewell: farewellOn(cc),
        sitterUntil: cc && plain(cc.cfg) && plain(cc.cfg.sitter) && isDay(cc.cfg.sitter.until) ? cc.cfg.sitter.until : null,
        alert: alertOf(w), room: c.petRoom(w), runner: runner, rule: ruleNews(w), cards: [], card: null };
      if (!out.started) return out;
      var order = c.homePets(w).slice();
      crewIds(w).forEach(function (id) { if (order.indexOf(id) < 0 && where(w, id) === 'hotel') order.push(id); });
      var cands = [];
      order.forEach(function (id) {
        var rec = recOf(cc, id), wh = where(w, id);
        if (!rec || (wh !== 'home' && wh !== 'hotel' && wh !== 'rescue')) return;
        var d = dietOf(id), level = levelOf(rec, CARE), r = rec.rescue;
        var p = { id: id, name: nameOf(w, id), where: wh, food: clamp(rec.food, 0, CARE.foodMax, 0),
          missed: clamp(rec.missed, 0, CARE.rescueAt, 0), level: level, happy: clamp(rec.happy, 0, CARE.happyMax, 0),
          fav: d.fav, noFish: !!d.noFish, runner: id === runner, fedToday: rec.fedDay === day,
          patToday: rec.patDay === day, playToday: rec.playDay === day,
          treatsLeft: rec.treatDay === day ? Math.max(0, CARE.treatsPerDay - clamp(rec.treats, 0, CARE.treatsPerDay, 0)) : CARE.treatsPerDay,
          rescue: null, arrived: rec.arrivedFull === true };
        if (wh === 'rescue' && plain(r)) {
          var visits = clamp(r.visits, 0, CARE.rescueVisits, 0), waited = clamp(r.waited, 0, CARE.starAfter, 0);
          p.rescue = { since: r.since, visits: visits, left: CARE.rescueVisits - visits, waited: waited,
            starIn: out.farewell ? Math.max(0, CARE.starAfter - waited) : null, visitedToday: r.last === day };
          if (r.since === day) cands.push({ type: 'rescued', id: id });
          if (out.farewell && waited >= CARE.starWarn) cands.push({ type: 'starSoon', id: id, left: CARE.starAfter - waited });
        } else if (wh === 'home' && (level === 'warn' || level === 'last')) cands.push({ type: level, id: id });
        out.pets.push(p);
      });
      (Array.isArray(cc.stars) ? cc.stars : []).forEach(function (s) {
        if (plain(s) && s.to === day && !s.returned) cands.push({ type: 'star', id: s.id });
      });
      out.card = cardOf(cands);
      out.cards = out.card ? [out.card] : [];
      return out;
    }

    /* ---------------- start ---------------- */
    function start(u, day, ms, opts) {
      if (!ready()) return fail('no_care');
      if (!isDay(day)) return fail('bad_day');
      if (!isMs(ms)) return fail('bad_time');
      var c = core(), CARE = K(), w = c.ensureWorld(u), cc = careOf(w), at = iso(ms);
      if (cc && isDay(cc.day)) return { ok: true, started: false };
      var crew = crewIds(w), runner = c.activePetId(w), home;
      if (crew.length <= CARE.homeMax) home = crew.slice();
      else {
        var want = opts && Array.isArray(opts.home) ? opts.home : null, picked = [];
        (want || []).forEach(function (id) { if (crew.indexOf(id) >= 0 && picked.indexOf(id) < 0) picked.push(id); });
        home = (picked.length ? picked : defaultHome(w)).slice(0, CARE.homeMax);
      }
      if (!cc) {
        cc = { v: 1, since: day, day: day, days: 1, home: home, homeAt: at, pets: {}, pantry: {}, stars: [],
          cfg: { sitter: { on: false, until: null }, farewell: false, setAt: 0 }, done: {}, alert: null, welcome: null, at: at };
        w.care3 = cc;
      } else {
        /* a block a food purchase made before care started: keep what is in it */
        if (!isInt(cc.v)) cc.v = 1;
        cc.since = isDay(cc.since) && cc.since <= day ? cc.since : day;
        cc.day = day;
        cc.days = Math.max(1, isInt(cc.days) ? cc.days : 0);
        cc.home = home.concat((Array.isArray(cc.home) ? cc.home : []).filter(function (id) { return typeof id === 'string' && !c.item(id); }));
        cc.homeAt = at;
        ['pets', 'pantry', 'done'].forEach(function (k) { if (!plain(cc[k])) cc[k] = {}; });
        if (!Array.isArray(cc.stars)) cc.stars = [];
        if (!plain(cc.cfg)) cc.cfg = { sitter: { on: false, until: null }, farewell: false, setAt: 0 };
        if (cc.welcome === undefined) cc.welcome = null;
      }
      crew.forEach(function (id) { if (!recOf(cc, id)) cc.pets[id] = freshRec(day, at); });
      if (!cc.welcome) {
        Object.keys(CARE.welcomeBag || {}).forEach(function (id) {
          var p = plain(cc.pantry[id]) ? cc.pantry[id] : (cc.pantry[id] = { got: 0, ate: 0 });
          p.got = (isInt(p.got) && p.got > 0 ? p.got : 0) + CARE.welcomeBag[id];
          if (!isInt(p.ate) || p.ate < 0) p.ate = 0;
        });
        cc.welcome = at;
      }
      /* the picker left the runner at the Hotel: it passes to the first home pet */
      if (runner != null && crew.indexOf(runner) >= 0 && home.indexOf(runner) < 0) handOff(u, w, home, ms);
      wrote(u, w, cc, at);
      return { ok: true, started: true, home: home.slice(), hotel: crew.filter(function (id) { return home.indexOf(id) < 0; }) };
    }

    /* ---------------- the island day's step ---------------- */
    function tick(u, day, ms, opts) {
      if (!ready()) return fail('no_care');
      var CARE = K();
      if (opts && opts.from === 'app' && CARE.dayRule !== 'app') return { ok: true, changed: false, events: [], skipped: 'island_days' };
      var b = begin(u, day, ms, true);
      if (b.err) return b.err;
      var c = core(), w = b.w, cc = b.cc, at = b.at, events = [];
      var dn = dayNum(day), cn = dayNum(cc.day);
      if (cn - dn > CARE.clockSkewDays) {           /* a clock that was wrong: start again from today, no step */
        cc.day = day; wrote(u, w, cc, at);
        return { ok: true, changed: true, events: [], reset: true };
      }
      if (cn >= dn) return { ok: true, changed: false, events: [] };   /* counted already, or the clock went back */
      /* a pet that arrived while home was full (an old client's purchase, N13): told once */
      crewIds(w).forEach(function (id) {
        var rec = recOf(cc, id);
        if (rec && rec.arrivedFull === true) { delete rec.arrivedFull; rec.at = at; if (where(w, id) === 'hotel') events.push({ type: 'arrived', id: id }); }
      });
      if (!sitterOn(w, day)) {
        var home = c.homePets(w).slice(), runner = c.careRunner(w), leaving = [];
        /* the Pet Rescue: only with the grown-up's farewell switch does waiting count */
        home.forEach(function (id) {
          var rec = recOf(cc, id), r = rec && rec.rescue;
          if (!plain(r) || rec.star || !farewellOn(cc) || r.last === day) return;
          r.waited = clamp(r.waited, 0, CARE.starAfter, 0) + 1;
          rec.at = at;
          if (r.waited >= CARE.starAfter) { passAway(w, cc, id, rec, day, at); leaving.push(id); events.push({ type: 'star', id: id }); }
          else if (r.waited >= CARE.starWarn) events.push({ type: 'starSoon', id: id, left: CARE.starAfter - r.waited });
        });
        /* the tummy and happiness of every pet really at home */
        home.forEach(function (id) {
          var rec = recOf(cc, id);
          if (!rec || rec.star || rec.rescue) return;
          var food = clamp(rec.food, 0, CARE.foodMax, 0), missed = clamp(rec.missed, 0, CARE.rescueAt, 0);
          var happy = clamp(rec.happy, 0, CARE.happyMax, CARE.happyStart);
          if (food > 0) food -= 1; else missed += 1;
          happy = Math.max(0, happy - 1);
          if (missed >= 1) happy = Math.min(happy, 1);
          rec.food = food; rec.missed = missed; rec.happy = happy; rec.at = at;
          if (missed >= CARE.rescueAt) {
            rec.rescue = { since: day, visits: 0, last: null, waited: 0 };
            leaving.push(id);
            events.push({ type: 'rescued', id: id });
          } else {
            var lv = levelOf(rec, CARE);
            if (lv !== 'full' && lv !== 'fed') events.push({ type: lv, id: id });
          }
        });
        /* the runner went to the Rescue or became a star: the next home pet after it runs */
        var ri = home.indexOf(runner);
        if (ri >= 0 && leaving.indexOf(runner) >= 0) handOff(u, w, rotate(home, ri + 1), ms);
      }
      cc.day = day;
      cc.days = (isInt(cc.days) && cc.days > 0 ? cc.days : 0) + 1;
      wrote(u, w, cc, at);
      return { ok: true, changed: true, events: events };
    }
    function passAway(w, cc, id, rec, day, at) {
      var from = isDay(rec.adopted) ? rec.adopted : (isDay(cc.since) ? cc.since : day);
      if (!Array.isArray(cc.stars)) cc.stars = [];
      cc.stars.push({ id: id, name: nameOf(w, id), from: from, to: day, days: Math.max(1, dayNum(day) - dayNum(from)),
        acc: core().wornBy(w, id), fav: dietOf(id).fav });
      rec.rescue = null;
      rec.star = { day: day };
      rec.at = at;
      cc.home = cc.home.filter(function (h) { return h !== id; });
      cc.homeAt = at;
    }

    /* ---------------- feeding, pats, play and Rescue visits ---------------- */
    function feed(u, petId, foodId, day, ms, opts) {
      var b = begin(u, day, ms, true);
      if (b.err) return b.err;
      var w = b.w, cc = b.cc, CARE = K(), wh = where(w, petId), rec = recOf(cc, petId);
      if (wh === 'rescue') return fail('at_rescue');
      if (!rec || wh !== 'home') return fail(wh === 'hotel' ? 'at_hotel' : 'not_home');
      var basic = foodId === BASIC;
      var chk = basic ? basicCheck(u, w, petId, day, rec, wh, opts) : foodCheck(w, cc, petId, foodId, day, rec, 'meal');
      if (!chk.ok) return chk;
      if (basic) rec.freeDay = cc.day; else pantryEat(cc, foodId);   /* the island day it belongs to (BASIC MEAL) */
      var food = clamp(rec.food, 0, CARE.foodMax, 0), missed = clamp(rec.missed, 0, CARE.rescueAt, 0);
      var happy = clamp(rec.happy, 0, CARE.happyMax, CARE.happyStart), recovered = false, fav = false, counted = true;
      if (chk.treat) {
        if (rec.treatDay !== day) { rec.treatDay = day; rec.treats = 0; }
        counted = clamp(rec.treats, 0, CARE.treatsPerDay, 0) < CARE.treatsPerDay;
        if (counted) { rec.treats = clamp(rec.treats, 0, CARE.treatsPerDay, 0) + 1; happy += 1; }
      } else {
        food = Math.min(CARE.foodMax, food + 1);
        rec.fedDay = day;
        if (missed > 0) { missed = 0; happy += 1; recovered = true; }
        if (chk.fav && rec.favDay !== day) { happy += 1; rec.favDay = day; fav = true; }
      }
      happy = Math.min(CARE.happyMax, happy);
      if (missed >= 1) happy = Math.min(happy, 1);
      rec.food = food; rec.missed = missed; rec.happy = happy; rec.at = b.at;
      wrote(u, w, cc, b.at);
      var out = { ok: true, treat: chk.treat, counted: counted, fav: fav, food: food, happy: happy, recovered: recovered };
      if (basic) out.basic = true;
      return out;
    }
    function cheer(kind, u, petId, day, ms) {
      var b = begin(u, day, ms, true);
      if (b.err) return b.err;
      var w = b.w, cc = b.cc, CARE = K(), wh = where(w, petId), rec = recOf(cc, petId);
      if (!rec || (wh !== 'home' && wh !== 'rescue')) return fail(wh === 'hotel' ? 'at_hotel' : 'not_home');
      if (wh === 'rescue' && !(plain(rec.rescue) && rec.rescue.last === day)) return fail('visit_first');
      var key = kind + 'Day', happy = clamp(rec.happy, 0, CARE.happyMax, CARE.happyStart);
      if (rec[key] === day) return { ok: true, counted: false, happy: happy };
      happy = Math.min(CARE.happyMax, happy + 1);
      if (clamp(rec.missed, 0, CARE.rescueAt, 0) >= 1) happy = Math.min(happy, 1);
      rec[key] = day; rec.happy = happy; rec.at = b.at;
      wrote(u, w, cc, b.at);
      return { ok: true, counted: true, happy: happy };
    }
    function pat(u, petId, day, ms) { return cheer('pat', u, petId, day, ms); }
    function play(u, petId, day, ms) { return cheer('play', u, petId, day, ms); }
    /* one visit per island day: a meal from the pantry and a pat; the 3rd brings it home */
    function rescueVisit(u, petId, foodId, day, ms, opts) {
      var b = begin(u, day, ms, true);
      if (b.err) return b.err;
      var w = b.w, cc = b.cc, CARE = K(), rec = recOf(cc, petId);
      if (!rec || where(w, petId) !== 'rescue' || !plain(rec.rescue)) return fail('not_rescue');
      var basic = foodId === BASIC;
      var chk = basic ? basicCheck(u, w, petId, day, rec, 'rescue', opts) : foodCheck(w, cc, petId, foodId, day, rec, 'visit');
      if (!chk.ok) return chk;
      if (basic) rec.freeDay = cc.day; else pantryEat(cc, foodId);   /* the island day it belongs to (BASIC MEAL) */
      var r = rec.rescue, visits = clamp(r.visits, 0, CARE.rescueVisits, 0) + 1;
      r.visits = visits; r.last = day; r.waited = 0;
      if (rec.patDay !== day) { rec.patDay = day; rec.happy = Math.min(1, clamp(rec.happy, 0, CARE.happyMax, 0) + 1); }
      var home = visits >= CARE.rescueVisits;
      if (home) {
        rec.rescue = null; rec.food = CARE.foodMax; rec.missed = 0; rec.happy = CARE.happyStart; rec.fedDay = day;
      }
      rec.at = b.at;
      wrote(u, w, cc, b.at);
      var out = { ok: true, visits: visits, left: Math.max(0, CARE.rescueVisits - visits), home: home, fav: chk.fav };
      if (basic) out.basic = true;
      return out;
    }

    /* ---------------- home and the Pet Hotel (KU4, KU5) ---------------- */
    function toHotel(u, petId, ms) {
      var b = begin(u, null, ms, false);
      if (b.err) return b.err;
      var c = core(), w = b.w, cc = b.cc, wh = where(w, petId), rec = recOf(cc, petId);
      if (wh === 'rescue') return fail('at_rescue');
      if (wh === 'hotel') return fail('at_hotel');
      if (wh !== 'home' || !rec) return fail('not_home');
      if (!c.petRoom(w).hotelOpen) return fail('hotel_closed');
      if (clamp(rec.food, 0, K().foodMax, 0) === 0) return fail('hungry', { id: petId });
      if (freeHome(w).length <= 1) return fail('last_home');
      var wasRunner = c.careRunner(w) === petId, idx = cc.home.indexOf(petId);
      cc.home.splice(idx, 1);
      cc.homeAt = b.at;
      if (wasRunner) handOff(u, w, rotate(cc.home, Math.max(0, idx) % Math.max(1, cc.home.length)), ms);
      wrote(u, w, cc, b.at);
      return { ok: true };
    }
    function toHome(u, petId, ms) {
      var b = begin(u, null, ms, false);
      if (b.err) return b.err;
      var w = b.w, cc = b.cc, wh = where(w, petId);
      if (wh !== 'hotel') return fail(wh === 'home' ? 'at_home' : wh === 'rescue' ? 'at_rescue' : 'not_hotel');
      if (homeUsed(w, cc) >= K().homeMax) return fail('home_full');
      cc.home.push(petId);
      cc.homeAt = b.at;
      wrote(u, w, cc, b.at);
      return { ok: true };
    }
    /* one home pet out, one hotel guest in, in one commit; the guest takes the spot */
    function swap(u, outId, inId, ms) {
      var b = begin(u, null, ms, false);
      if (b.err) return b.err;
      var c = core(), w = b.w, cc = b.cc, wo = where(w, outId), wi = where(w, inId), rec = recOf(cc, outId);
      if (wo === 'rescue') return fail('at_rescue');
      if (wo !== 'home' || !rec) return fail(wo === 'hotel' ? 'at_hotel' : 'not_home');
      if (wi !== 'hotel') return fail(wi === 'home' ? 'at_home' : wi === 'rescue' ? 'at_rescue' : 'not_hotel');
      if (clamp(rec.food, 0, K().foodMax, 0) === 0) return fail('hungry', { id: outId });
      var wasRunner = c.careRunner(w) === outId, idx = cc.home.indexOf(outId);
      cc.home[idx] = inId;
      cc.homeAt = b.at;
      if (wasRunner) handOff(u, w, rotate(cc.home, idx + 1), ms);
      wrote(u, w, cc, b.at);
      return { ok: true };
    }
    /* the picker ('Who lives at home?'): 1-3 pets, the child's order. A pet at the Rescue
       keeps its spot, and every pet that leaves home obeys the Hotel's rules. */
    function setHome(u, ids, ms) {
      var b = begin(u, null, ms, false);
      if (b.err) return b.err;
      var c = core(), w = b.w, cc = b.cc, CARE = K();
      if (!Array.isArray(ids)) return fail('bad_pick');
      var pick = [];
      for (var i = 0; i < ids.length; i++) {
        var wh = where(w, ids[i]);
        if (wh !== 'home' && wh !== 'hotel' && wh !== 'rescue') return fail('bad_pick', { id: ids[i] });
        if (pick.indexOf(ids[i]) < 0) pick.push(ids[i]);
      }
      var unknown = (Array.isArray(cc.home) ? cc.home : []).filter(function (id) { return typeof id === 'string' && !c.item(id); });
      if (pick.length < 1 || pick.length + unknown.length > CARE.homeMax) return fail('pick_count');
      var now = c.homePets(w), leaving = now.filter(function (id) { return pick.indexOf(id) < 0; });
      for (var j = 0; j < leaving.length; j++) {
        var lid = leaving[j];
        if (where(w, lid) === 'rescue') return fail('at_rescue', { id: lid });
        if (!c.petRoom(w).hotelOpen) return fail('hotel_closed');
        if (clamp(recOf(cc, lid).food, 0, CARE.foodMax, 0) === 0) return fail('hungry', { id: lid });
      }
      if (!pick.some(function (id) { return where(w, id) !== 'rescue'; })) return fail('last_home');
      var runner = c.careRunner(w);
      cc.home = pick.concat(unknown);
      cc.homeAt = b.at;
      if (runner != null && leaving.indexOf(runner) >= 0) handOff(u, w, pick, ms);
      wrote(u, w, cc, b.at);
      return { ok: true, home: pick.slice() };
    }

    /* ---------------- the grown-up's settings and commands ----------------
       cfg = {petCare: families/{code}.petCare = {sitter: {on, until}, farewell, setAt},
              kid: families/{code}/kids/{uid}.pets = {release: {<petId>: ms}, unstar: {<petId>: ms}}}
       The settings are cached in care3.cfg when their setAt is newer. Each command is applied
       once: its key '<kind>:<petId>:<ms>' goes into care3.done (a command for a pet that is not
       at the Rescue, or not a star, only records done). Idempotent. */
    function applyFamily(u, cfg, day, ms) {
      var b = begin(u, day, ms, true);
      if (b.err) return b.err;
      var w = b.w, cc = b.cc, CARE = K(), at = b.at, changed = false, applied = [];
      var pc = cfg && plain(cfg.petCare) ? cfg.petCare : null;
      if (pc) {
        var cur = plain(cc.cfg) ? cc.cfg : null, s = plain(pc.sitter) ? pc.sitter : {};
        var next = { sitter: { on: s.on === true, until: isDay(s.until) ? s.until : null }, farewell: pc.farewell === true, setAt: stampOf(pc.setAt) };
        if (!cur || next.setAt > stampOf(cur.setAt)) {
          var wasOn = farewellOn(cc);
          /* switching it on never acts on the past: everyone at the Rescue gets the full wait */
          if (next.farewell && !wasOn) c3Rescued(w, cc).forEach(function (id) { var r = cc.pets[id]; r.rescue.waited = 0; r.at = at; });
          /* still on, and the child was told: a sitter change is not news about the rule */
          if (next.farewell && wasOn && plain(cc.told) && cc.told.farewell === cur.setAt) cc.told.farewell = next.setAt;
          cc.cfg = next;
          changed = true;
        }
      }
      var kid = cfg && plain(cfg.kid) ? cfg.kid : null;
      if (kid) {
        if (!plain(cc.done)) cc.done = {};
        KINDS.forEach(function (kind) {
          var m = plain(kid[kind]) ? kid[kind] : null;
          if (!m) return;
          Object.keys(m).sort().forEach(function (petId) {
            var key = kind + ':' + petId + ':' + m[petId];
            if (own(cc.done, key)) return;
            cc.done[key] = 1;
            changed = true;
            var rec = recOf(cc, petId);
            if (kind === 'release' && rec && where(w, petId) === 'rescue') {
              rec.rescue = null; rec.food = CARE.foodMax; rec.missed = 0; rec.happy = CARE.happyStart; rec.at = at;
              applied.push({ kind: kind, id: petId, to: 'home' });
            } else if (kind === 'unstar' && rec && plain(rec.star) && crewIds(w).indexOf(petId) >= 0) {
              applied.push({ kind: kind, id: petId, to: bringBack(w, cc, petId, rec, at) });
            }
          });
        });
      }
      if (!changed) return { ok: true, changed: false, applied: [] };
      wrote(u, w, cc, at);
      return { ok: true, changed: true, applied: applied };
    }
    function c3Rescued(w, cc) {
      return core().homePets(w).filter(function (id) { var r = recOf(cc, id); return !!(r && plain(r.rescue)); });
    }
    /* 'Bring back from the stars': free, home when there is room, else the Hotel (above the
       cap under 'total'); the memory card stays, marked returned */
    function bringBack(w, cc, petId, rec, at) {
      var CARE = K();
      rec.star = null; rec.rescue = null; rec.food = CARE.foodMax; rec.missed = 0; rec.happy = CARE.happyStart; rec.at = at;
      for (var i = cc.stars.length - 1; i >= 0; i--) {
        if (plain(cc.stars[i]) && cc.stars[i].id === petId && !cc.stars[i].returned) { cc.stars[i].returned = at; break; }
      }
      if (homeUsed(w, cc) < CARE.homeMax) { cc.home.push(petId); cc.homeAt = at; return 'home'; }
      return 'hotel';
    }
    function markRuleSeen(u, setAt, ms) {
      if (!ready()) return fail('no_care');
      var w = core().ensureWorld(u), cc = careOf(w);
      if (!cc) return fail('not_started');
      if (!plain(cc.told)) cc.told = {};
      cc.told.farewell = setAt == null ? 0 : setAt;
      if (isMs(ms)) wrote(u, w, cc, iso(ms));
      return { ok: true };
    }

    return {
      DIET: DIET, LEVELS: LEVELS, ALERT_LV: ALERT_LV, CARD_ORDER: CARD_ORDER, TOAST_ORDER: TOAST_ORDER, KINDS: KINDS, REASON: REASON,
      BASIC: BASIC, basicMeal: basicMeal,
      ready: ready, dietOf: dietOf, levelOf: function (rec) { return levelOf(rec, ready() ? K() : null); }, tummyKey: tummyKey,
      cardOf: cardOf, toastOf: toastOf, dayNum: dayNum,
      start: start, needsPick: needsPick, defaultHome: defaultHome, tick: tick,
      feed: feed, pat: pat, play: play, rescueVisit: rescueVisit,
      toHotel: toHotel, toHome: toHome, swap: swap, setHome: setHome,
      applyFamily: applyFamily, sitterOn: sitterOn, canFeed: canFeed, ruleNews: ruleNews, markRuleSeen: markRuleSeen,
      status: status, memories: memories, alertOf: alertOf
    };
  }

  var api = make(function () { return CORE0 || (root && root.SLWorldCore) || null; });
  api.create = function (C) { var a = make(function () { return C || null; }); a.create = api.create; return a; };
  return api;
}));
