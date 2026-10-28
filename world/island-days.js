/* ================================================================
   My Island — island days (Island activities v1, chunk IA-1; chatgpt-feedback/ISLAND-ACTIVITIES-PLAN.md
   §2, §5 IA-1 and §6, as James approved it on 25-26 Oct 2026: build all 7; island activities are free
   play and never use the daily island-game time; show 'Island day N'). Pure: no DOM, no storage, no
   clock and no chance. window.SLIslandDays in the browser (rewards-world.js loads it itself, like
   next-step.js; precached in sw.js, never in index.html's slLoadWorld chain), require() in Node.

   The day rules: who visits, the weather and the season, which island has its show, today's I spy,
   each home pet's wish, the hide and seek spots, the show's running order, the stamps an event finds
   and the island book. Every schedule is a fixed order indexed by the island day number (days3.n) or
   the date, spread where it helps by a local fnv1a hash: the same save and the same day always give
   the same JSON, so siblings see the same weather and nobody is ever 'unlucky'. The tables are the
   oracle's (docs/island3d/v3/kids-update/activities.json: VISIT_ORDER, HOSTS, SEASONS, WEATHER_CYCLE,
   CLUES, STAMPS; tests/island-days.test.js holds them to it). Nothing here buys, earns, spends, feeds,
   writes or remembers anything: the save blocks and their writers are world-core's (C.countIslandDay,
   C.markDid, C.addFinds, C.seeFinds); words come back as copy keys {key, params} (world-copy.js act.*).
   Every function takes the world core (SLWorldCore) as C and never writes to the world it is given;
   today() reads a deep copy of the profile.

   API (C = SLWorldCore, w = u.world, a day = 'YYYY-MM-DD', the host's careDay()):
     today(C, u, env) → null (no core) | {v, n, day, counted, first, season, weather, visitor,
         nextVisitor, show, spy, wishes, goal, did}. env = {day, people (SLPeopleCore), care (SLPetCare),
         status (care.status(w, day), else worked out from care), wallet, trial}. It reads the save as
         countIslandDay will leave it on env.day: counted false = today is not counted yet, and n is
         then days3.n + 1 (a new save: 1), so the board never shows yesterday's visitor. Every field
         may be null (no day, no people-core, no pets, free test mode for the goal); a host hides the
         rows that are empty.
           weather   {kind, next, key: 'act.wx.<kind>', nextKey: 'act.wx.next.<next>'}
           season    'spring' | 'summer' | 'autumn' | 'winter' (the line is act.wx.<season>)
           visitor / nextVisitor   castInfo: {id, name, move, moveKey: 'move.<move>', moveName, sig, land}
           show      {isle, next, host: castInfo | null} (Home's host is the visitor)
           spy       {isle, clue, key, params, uids, again} | null
           wishes    {petId: {kind, petId, name, isle, uid?, id?, key, params, doneKey, doneParams, done}}
           goal      null in free test mode or with no goal; else {id, name, have, price, need, pct,
                     ready, locked, full, up} (up: the rise since the last island day, 0 = say nothing)
           did       today's flags (days3.did.f when its day is env.day), a copy
     visitorFor(n, castIds?, exclude?) → the visitor's character id on island day n, or null:
         list = castIds (default VISIT_ORDER) without char_me and exclude (the child's own active
         character, or a list); list[(n − 1) % list.length]. 'Coming next time' is visitorFor(n + 1).
     castInfo(people, id) → {id, name, move, moveKey, moveName, sig, land} | null (null: no people core, or a
         character it does not know by name; so today()'s visitor, nextVisitor and a show's host are null then,
         a 'meet' wish needs a visitor, and the book's visitors' book lists only characters it can name)
     weather(day) → 'sunny' | 'breezy' | 'starry' | 'snow' | null; seasonOf(day); dayNo(day); nextDay(day)
     showIsle(n, w, C) → {isle, next}: ['home'] + the child's lands (ISLE_ORDER), isles[n % len]
     showPlan(C, w, isle, tier) → {isle, landmark: uid | null, uids, finale: uid | null, host} | null:
         the landmark (a land), then up to SHOW_MAX acted things (SHOW_MAX_LOW with tier 'low'), one
         of each kind, in y-then-x order, never a launch item or the house; on Home a Concert Stage
         (act 'encore') is the finale, after the host's dance break. host: 'visitor' or a character id.
     showList(C, w, isle, tier) → [uid]: the running order, landmark first and the finale last.
     clues(C, w, isle, opts?) → [{id, key, params, uids, again}], at most OPEN_CLUES: the first clues
         in the island's order not found yet that something placed there answers. When every clue the
         island can answer is found the list goes round again from the top (again: true; no stamps on
         repeats; opts.n turns the start, today() passes the island day). opts.skip: clue ids solved
         in this sitting that are not saved yet (the host's 1.5 s batch). A locked island: [].
     matches(C, clueId, itemOrId, w?, isle?) → bool ('biggest' needs w and isle)
     wishes(C, w, n, status, visitor, alertLv?) → {petId: wish}: one per home pet that is not hungry
         (never a Hotel, Rescue or star pet), from a fixed list built from the save: a ride (C.isRide),
         a rest on a seat (REST_ACTS), a visit to an owned land (the runner only: it goes with the
         child), meeting today's visitor. Other home pets wish only on Home. The kind turns with the
         island day; an undone wish just changes on the next island day.
     hideOrder(C, w, isle, day, round) → [uid]: where the pet may hide, best first (tall things: the
         house, landmarks, buildings, trees, stalls and TALL_IDS; never a launch item), a fixed order
         from the day and the round, never the same first spot two rounds running.
     untried(C, w) → [{isle, uid, id, ride}]: acted things on the child's islands never tried (finds3.tried)
     note(C, w, ev, day) → {stamps: [id], tried: [itemId], pp: {petId: [isle]}, done: [isle]}: what an
         event (or a list of them, in order) finds that is NEW; feed it to C.addFinds(u, r, day, ms).
         ev = {kind, isle, id?, uid?, petId?, gear?, clue?}; kind: act | visit | night | pat | map |
         findme | showtime | hello | fetch | hide | show | spy | tree. Launch items never count; a
         locked island never stamps.
     empty(r) → true when note() found nothing (no commit needed)
     stamps(C, w, isle) → the stamps the child can do with what they own: [{kind, id, key, params}]
         (pat, fetch and hide only with a pet that is not a star; tree, try3, tryall and gear by their 'if').
         These are the dotted rings a page may show; a stamp already found is drawn whatever the 'if' says now.
     stampInfo(C, w, id) → {id, isle, kind, key, params, extra} | null (null: an I spy clue record or
         an id this build does not know)
     book(C, w, people) → {n, key, params, first, days, pages, ready, visitors, passports, newCount}; pages
         are for owned islands only: [{isle, name, stamps: [{id, kind, key, params, got, day}], extras, n,
         done, ready, doneDay}]. A page draws every stamp found (a stamp is never lost: packing things away
         or a pet becoming a star never takes one back, so '{n} stamps so far' never goes down) and a ring
         for each one still to find that stamps() lists. done is the recorded completion (finds3.done) and
         nothing else: a completed page shows only what it found (completion is permanent), and its extras
         are 'Try your new {item}' for each acted thing there bought on or after the day the page was
         completed (its first ledger row; never a void one), found or still to find; a found extra is always
         drawn. A thing the child had before (a starter thing, the landmark, one bought earlier and moved
         there) is never an extra. ready (a page, and the list of their isles): every stamp it shows is found
         but its completion is not recorded, because a ring went when its 'if' stopped holding (the trees
         packed away before one was shaken) rather than through an event note() saw. The host records it
         with C.addFinds(u, {done: book.ready}, day, ms) when the book opens (its completed → celebrate()); an
         event on that island records it through note() too. newCount: the stamps found since seen (never
         more than n).
     flag(kind, id?) → a days3.did flag: 'show:<isle>', 'spy:<isle>', 'wish:<petId>', else the kind
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLIslandDays = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }

  /* ---------------- the oracle's tables (activities.json) ---------------- */
  /* the 12 island characters in people-core's cast order (never char_me) */
  var VISIT_ORDER = deepFreeze(['char_theo', 'char_priya', 'char_jude', 'char_wren', 'char_ines', 'char_omar', 'char_lena', 'char_malu',
    'char_amara', 'char_rowan', 'char_elsie', 'char_noor']);
  /* who hosts each island's show: Home's is the day's visitor, a land's its own character */
  var HOSTS = deepFreeze({ home: 'visitor', pier: 'char_malu', jungle: 'char_amara', treetop: 'char_rowan', castle: 'char_elsie', ice: 'char_noor' });
  /* the UK calendar, by month */
  var SEASONS = deepFreeze({ spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] });
  /* a fixed 28-day cycle from the date (dayNo % 28); in December to February a breezy or starry day snows */
  var WEATHER_CYCLE = deepFreeze(['sunny', 'breezy', 'sunny', 'starry', 'sunny', 'sunny', 'breezy', 'starry', 'sunny', 'breezy', 'sunny', 'starry',
    'sunny', 'sunny', 'breezy', 'sunny', 'starry', 'breezy', 'sunny', 'sunny', 'starry', 'sunny', 'breezy', 'starry', 'sunny', 'sunny', 'breezy', 'starry']);
  var SNOW = deepFreeze({ months: [12, 1, 2], replaces: ['breezy', 'starry'] });
  /* I spy: a placed thing fits a clue by its act's ACT_INFO anim2d, by its act or by its id ('biggest': the
     largest footprint on the island, and a land's landmark) */
  var CLUES = deepFreeze([
    { id: 'round', key: 'act.spy.c.round', anim2d: ['spin'], acts: [], ids: ['castle_maypole', 'ice_rink'] },
    { id: 'updown', key: 'act.spy.c.updown', anim2d: ['lift'], acts: ['seesaw', 'drawbridge'], ids: ['lm_pier_wheel', 'lm_treetop_lookout'] },
    { id: 'slide', key: 'act.spy.c.slide', anim2d: [], acts: ['slide', 'zip', 'zipline', 'flume'], ids: ['jungle_den', 'lm_ice_igloo'] },
    { id: 'music', key: 'act.spy.c.music', anim2d: [], acts: ['record', 'dance', 'drum', 'chime', 'bell', 'sing', 'encore', 'ride', 'chirp'], ids: ['lm_castle_keep'] },
    { id: 'food', key: 'act.spy.c.food', anim2d: [], acts: ['serve', 'floss', 'popcorn', 'scoop', 'juggle', 'coconut'], ids: ['tree_apple', 'jungle_banana', 'castle_herbs'] },
    { id: 'light', key: 'act.spy.c.light', anim2d: [], acts: ['glow', 'lights', 'screen'], ids: [] },
    { id: 'rest', key: 'act.spy.c.rest', anim2d: [], acts: ['lounge', 'rock', 'royal', 'camp', 'hangout', 'peek'], ids: ['bench', 'umbrella', 'house_cottage', 'lm_jungle_treehouse'] },
    { id: 'bounce', key: 'act.spy.c.bounce', anim2d: [], acts: ['bounce', 'leap', 'scramble'], ids: [] },
    { id: 'water', key: 'act.spy.c.water', anim2d: [], acts: ['splash', 'flume', 'canoe', 'fish', 'bucket', 'ducks', 'spout'], ids: ['jungle_waterwheel'] },
    { id: 'swing', key: 'act.spy.c.swing', anim2d: ['swing'], acts: ['rock'], ids: [] },
    { id: 'animal', key: 'act.spy.c.animal', anim2d: [], acts: ['penguins', 'chirp', 'waddle', 'feed', 'ducks', 'sing'], ids: ['ice_bear', 'ice_snowpenguin', 'castle_dragon', 'treetop_pod'] },
    { id: 'biggest', key: 'act.spy.c.biggest', params: ['island'], biggest: true }
  ]);
  var CLUE_BY = {};
  CLUES.forEach(function (c) { CLUE_BY[c.id] = c; });
  /* each island's own order of all 12 (the first ones are answered on day one) */
  var CLUE_ORDER = deepFreeze({
    home: ['biggest', 'rest', 'round', 'light', 'music', 'food', 'bounce', 'water', 'swing', 'updown', 'slide', 'animal'],
    pier: ['round', 'biggest', 'updown', 'slide', 'food', 'light', 'music', 'water', 'swing', 'rest', 'bounce', 'animal'],
    jungle: ['updown', 'biggest', 'rest', 'water', 'swing', 'music', 'food', 'animal', 'light', 'round', 'bounce', 'slide'],
    treetop: ['slide', 'biggest', 'bounce', 'swing', 'music', 'updown', 'animal', 'food', 'rest', 'light', 'round', 'water'],
    castle: ['updown', 'biggest', 'music', 'food', 'water', 'light', 'animal', 'rest', 'round', 'swing', 'bounce', 'slide'],
    ice: ['animal', 'slide', 'biggest', 'music', 'light', 'food', 'round', 'updown', 'water', 'rest', 'swing', 'bounce']
  });
  var NEVER = deepFreeze({ acts: ['launch'], kinds: ['pet', 'path'] });
  /* the book's page stamps, in page order (a kind is part of a saved id, so it is lower case) */
  var STAMP_KINDS = deepFreeze({
    home: ['house', 'map', 'findme', 'showtime', 'hello', 'tree', 'pat', 'fetch', 'hide', 'show', 'spy', 'try3', 'tryall'],
    land: ['visit', 'landmark', 'night', 'pat', 'fetch', 'hide', 'show', 'spy', 'try3', 'tryall', 'gear']
  });
  var EVENTS = deepFreeze(['act', 'visit', 'night', 'pat', 'map', 'findme', 'showtime', 'hello', 'fetch', 'hide', 'show', 'spy', 'tree']);

  /* ---------------- this file's own rules ---------------- */
  var OPEN_CLUES = 2;                /* I spy shows the first 2 open clues of an island */
  var SHOW_MAX = 7, SHOW_MAX_LOW = 6;
  var TRY_N = 3;                     /* 'Try 3 of your things here' */
  var WISH_KINDS = deepFreeze(['ride', 'rest', 'visit', 'meet']);
  /* a seat a pet can rest on (every one has a part for the pet); the hammock rests rather than rides */
  var REST_ACTS = deepFreeze(['lounge', 'rock', 'royal', 'camp', 'hangout']);
  /* pet-care's tummy levels as alert levels (SLPetCare.ALERT_LV): 2 and above is hungry */
  var ALERT0 = deepFreeze({ full: 0, fed: 0, peckish: 1, hungry: 2, warn: 3, last: 3 });
  /* hide and seek: tall things to hide behind, beyond the house, landmarks, the city buildings, trees and
     the land shops' stalls */
  var TALL_IDS = deepFreeze(['windmill', 'lighthouse', 'snowman', 'pier_beachhut', 'pier_droptower', 'pier_helter', 'pier_carousel', 'pier_teacups',
    'pier_flyingchairs', 'pier_swingship', 'jungle_stilthut', 'jungle_banana', 'jungle_coconut', 'jungle_waterwheel', 'jungle_den', 'jungle_falls',
    'treetop_climbwall', 'treetop_bigslide', 'treetop_platform', 'treetop_zipline', 'castle_tower', 'castle_statue', 'castle_gate', 'castle_dragon',
    'ice_pine', 'ice_snowhut', 'ice_fort', 'ice_castle', 'ice_bear', 'ice_sculpture']);

  /* ---------------- small helpers ---------------- */
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var KEY_RE = /^[a-z0-9_]{1,48}$/;
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function int(v) { return num(v) && Math.floor(v) === v; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function str(v) { return typeof v === 'string'; }
  /* 32-bit FNV-1a (the multiply by 16777619 as shifts, so it stays exact in plain ES5) */
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  /* whole days from 1970-01-01 to a calendar day (the civil-days formula: no clock, no time zone), or
     null when it is not a real date */
  function dayNo(d) {
    var m = str(d) ? DAY_RE.exec(d) : null;
    if (!m) return null;
    var y = +m[1], mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    var yy = y - (mo <= 2 ? 1 : 0), era = Math.floor(yy / 400), yoe = yy - era * 400;
    var doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + da - 1;
    var n = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
    return dayOf(n) === d ? n : null;
  }
  /* the calendar day of a day number */
  function dayOf(n) {
    var z = n + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153), da = doy - Math.floor((153 * mp + 2) / 5) + 1, mo = mp < 10 ? mp + 3 : mp - 9;
    return pad(yoe + era * 400 + (mo <= 2 ? 1 : 0), 4) + '-' + pad(mo, 2) + '-' + pad(da, 2);
  }
  function isDay(d) { return dayNo(d) !== null; }
  function nextDay(d) { var n = dayNo(d); return n === null ? null : dayOf(n + 1); }
  function monthOf(d) { return +d.slice(5, 7); }

  /* the world core's islands */
  function isleKeys(C) { return C && Array.isArray(C.ISLE_ORDER) ? C.ISLE_ORDER : ['home']; }
  function owned(C, w, k) {
    if (!str(k) || !C || !plain(C.ISLES) || !has(C.ISLES, k)) return false;
    return k === 'home' || (typeof C.isleUnlocked === 'function' && plain(w) && plain(w.owned) && !!C.isleUnlocked(w, k));
  }
  function ownedIsles(C, w) { return isleKeys(C).filter(function (k) { return owned(C, w, k); }); }
  function isleName(C, k) { var d = C && C.ISLES && C.ISLES[k]; return d && str(d.name) ? d.name : ''; }
  function landmarkOf(C, k) { var d = k !== 'home' && C && C.ISLES && C.ISLES[k]; return d && str(d.landmark) ? d.landmark : null; }
  function itemName(C, id) { var it = C && typeof C.item === 'function' ? C.item(id) : null; return it && str(it.name) ? it.name : ''; }
  /* what stands on an owned island: [{uid, id, x, y, it}] for known things, in y-then-x order */
  function here(C, w, k) {
    if (!owned(C, w, k) || typeof C.placedOn !== 'function' || typeof C.item !== 'function') return [];
    var l;
    try { l = C.placedOn(w, k); } catch (e) { l = null; }
    if (!Array.isArray(l)) return [];
    var out = [];
    l.forEach(function (p) {
      var it = plain(p) && str(p.id) ? C.item(p.id) : null;
      if (!it || !str(p.uid) || !p.uid) return;
      out.push({ uid: p.uid, id: p.id, x: num(p.x) ? p.x : 0, y: num(p.y) ? p.y : 0, it: it });
    });
    return out.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0); });
  }
  /* an acted thing: an act the core knows, never a game's ▶ PLAY sign or the house */
  function acted(C, it) {
    var a = it && it.act;
    return str(a) && !!(C && plain(C.ACT_INFO) && has(C.ACT_INFO, a)) && a !== 'launch' && a !== 'home';
  }
  function isRide(C, it) {
    if (typeof C.isRide === 'function') return !!C.isRide(it);
    return Array.isArray(C.RIDE_ACTS) && C.RIDE_ACTS.indexOf(it.act) >= 0;
  }
  function distinct(list, f) {
    var seen = {}, out = [];
    list.forEach(function (e) { if (f(e) && !has(seen, e.id)) { seen[e.id] = 1; out.push(e.id); } });
    return out;
  }
  function findsOf(w) { return plain(w) && plain(w.finds3) ? w.finds3 : null; }
  function daysOf(w) { return plain(w) && plain(w.days3) ? w.days3 : null; }
  function sub(f, k) { return f && plain(f[k]) ? f[k] : {}; }
  function copyOf(C, u) {
    var raw = plain(u) ? u : {}, w = plain(raw.world) ? JSON.parse(JSON.stringify(raw.world)) : C.emptyWorld();
    var U = { name: str(raw.name) ? raw.name : '', points: num(raw.points) ? raw.points : 0, world: w };
    if (num(raw.pointsEarned)) U.pointsEarned = raw.pointsEarned;
    C.ensureWorld(U);
    return U;
  }

  /* ---------------- the date: weather and seasons ---------------- */
  function weather(day) {
    var n = dayNo(day);
    if (n === null) return null;
    var k = WEATHER_CYCLE[mod(n, WEATHER_CYCLE.length)];
    return SNOW.months.indexOf(monthOf(day)) >= 0 && SNOW.replaces.indexOf(k) >= 0 ? 'snow' : k;
  }
  function seasonOf(day) {
    if (!isDay(day)) return null;
    var m = monthOf(day), names = Object.keys(SEASONS);
    for (var i = 0; i < names.length; i++) if (SEASONS[names[i]].indexOf(m) >= 0) return names[i];
    return null;
  }

  /* ---------------- visitors and hosts ---------------- */
  function visitorFor(n, castIds, exclude) {
    if (!int(n) || n < 1) return null;
    var ex = Array.isArray(exclude) ? exclude : [exclude];
    var list = (Array.isArray(castIds) ? castIds : VISIT_ORDER).filter(function (id, i, a) {
      return str(id) && id !== 'char_me' && ex.indexOf(id) < 0 && a.indexOf(id) === i;
    });
    return list.length ? list[(n - 1) % list.length] : null;
  }
  /* null unless the people core knows the character by name: a host never has to draw a nameless visitor */
  function castInfo(P, id) {
    if (!str(id) || !id) return null;
    var c = P && typeof P.castOf === 'function' ? P.castOf(id) : null, mv = c && plain(c.move) ? c.move : null;
    if (!c || !str(c.name) || !c.name) return null;
    return { id: id, name: c.name, move: mv ? mv.id : null, moveKey: mv ? 'move.' + mv.id : null,
      moveName: mv && str(mv.name) ? mv.name : null, sig: mv ? mv.id : null, land: str(c.land) ? c.land : null };
  }

  /* ---------------- show time ---------------- */
  function showIsle(n, w, C) {
    var isles = ownedIsles(C, w);
    if (!isles.length) return null;
    var k = int(n) ? n : 0;
    return { isle: isles[mod(k, isles.length)], next: isles[mod(k + 1, isles.length)] };
  }
  function showPlan(C, w, isle, tier) {
    if (!owned(C, w, isle)) return null;
    var list = here(C, w, isle), lmId = landmarkOf(C, isle), lm = null, cap = String(tier).toLowerCase() === 'low' ? SHOW_MAX_LOW : SHOW_MAX;
    list.forEach(function (e) { if (!lm && lmId && e.id === lmId) lm = e; });
    var seen = {}, uids = [], finale = null;
    list.forEach(function (e) {
      if (e === lm || !acted(C, e.it)) return;
      if (isle === 'home' && e.it.act === 'encore') { if (!finale) finale = e.uid; return; }
      if (has(seen, e.id) || uids.length >= cap) return;
      seen[e.id] = 1;
      uids.push(e.uid);
    });
    return { isle: isle, landmark: lm ? lm.uid : null, uids: uids, finale: finale, host: has(HOSTS, isle) ? HOSTS[isle] : null };
  }
  function showList(C, w, isle, tier) {
    var p = showPlan(C, w, isle, tier);
    if (!p) return [];
    return (p.landmark ? [p.landmark] : []).concat(p.uids, p.finale ? [p.finale] : []);
  }

  /* ---------------- I spy ---------------- */
  function fits(C, c, it) {
    if (!c || c.biggest || !it || NEVER.acts.indexOf(it.act) >= 0 || NEVER.kinds.indexOf(it.kind) >= 0) return false;
    var ai = str(it.act) && C && plain(C.ACT_INFO) && has(C.ACT_INFO, it.act) ? C.ACT_INFO[it.act] : null;
    return !!((ai && c.anim2d.indexOf(ai.anim2d) >= 0) || (str(it.act) && c.acts.indexOf(it.act) >= 0) || c.ids.indexOf(it.id) >= 0);
  }
  /* the biggest things on an island: the largest footprint (never a launch item or a path; ties all count), and a land's landmark */
  function biggest(C, isle, list) {
    var area = function (e) { var fp = Array.isArray(e.it.fp) ? e.it.fp : [1, 1]; return (num(fp[0]) ? fp[0] : 1) * (num(fp[1]) ? fp[1] : 1); };
    var cands = list.filter(function (e) { return NEVER.acts.indexOf(e.it.act) < 0 && NEVER.kinds.indexOf(e.it.kind) < 0; });
    var max = 0, lm = landmarkOf(C, isle);
    cands.forEach(function (e) { max = Math.max(max, area(e)); });
    return cands.filter(function (e) { return area(e) === max || (lm && e.id === lm); }).map(function (e) { return e.uid; });
  }
  function matches(C, clueId, itemOrId, w, isle) {
    var c = str(clueId) && has(CLUE_BY, clueId) ? CLUE_BY[clueId] : null;
    var it = str(itemOrId) ? (C && typeof C.item === 'function' ? C.item(itemOrId) : null) : itemOrId;
    if (!c || !plain(it)) return false;
    if (!c.biggest) return fits(C, c, it);
    var list = here(C, w, isle), big = biggest(C, isle, list);
    return list.some(function (e) { return e.id === it.id && big.indexOf(e.uid) >= 0; });
  }
  function clueOut(C, isle, c, uids, again) {
    return { id: c.id, key: c.key, params: c.biggest ? { island: isleName(C, isle) } : null, uids: uids, again: again };
  }
  function clues(C, w, isle, opts) {
    if (!owned(C, w, isle)) return [];
    var o = plain(opts) ? opts : {}, skip = Array.isArray(o.skip) ? o.skip : [];
    var list = here(C, w, isle), big = biggest(C, isle, list), got = sub(findsOf(w), 'got');
    var order = has(CLUE_ORDER, isle) ? CLUE_ORDER[isle] : CLUES.map(function (c) { return c.id; });
    var answer = [];
    order.forEach(function (id) {
      var c = CLUE_BY[id], uids = c.biggest ? big : list.filter(function (e) { return fits(C, c, e.it); }).map(function (e) { return e.uid; });
      if (uids.length) answer.push({ c: c, uids: uids });
    });
    var fresh = answer.filter(function (a) { return !has(got, 'spy.' + isle + '.' + a.c.id) && skip.indexOf(a.c.id) < 0; });
    if (fresh.length) return fresh.slice(0, OPEN_CLUES).map(function (a) { return clueOut(C, isle, a.c, a.uids, false); });
    if (!answer.length) return [];
    /* every clue here is found: round again from the top (no stamps on repeats) */
    var start = int(o.n) ? mod(o.n, answer.length) : 0, rot = answer.slice(start).concat(answer.slice(0, start));
    var rest = rot.filter(function (a) { return skip.indexOf(a.c.id) < 0; });
    return (rest.length ? rest : rot).slice(0, OPEN_CLUES).map(function (a) { return clueOut(C, isle, a.c, a.uids, true); });
  }
  /* today's I spy: from the island after the show's (an island with clues still to find first) */
  function spyToday(C, w, n) {
    var isles = ownedIsles(C, w);
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < isles.length; i++) {
        var k = isles[mod(n + 1 + i, isles.length)], cl = clues(C, w, k, { n: n });
        if (cl.length && (pass === 1 || !cl[0].again)) {
          return { isle: k, clue: cl[0].id, key: cl[0].key, params: cl[0].params, uids: cl[0].uids, again: cl[0].again };
        }
      }
    }
    return null;
  }

  /* ---------------- each home pet's wish ---------------- */
  function wishes(C, w, n, status, visitor, alertLv) {
    var out = {};
    if (!C || !plain(status) || status.started === false || !Array.isArray(status.pets) || !int(n) || n < 1) return out;
    var LV = plain(alertLv) ? alertLv : ALERT0;
    var hungry = function (p) { var l = has(LV, p.level) && num(LV[p.level]) ? LV[p.level] : 0; return l >= 2; };
    var pets = status.pets.filter(function (p) { return plain(p) && str(p.id) && KEY_RE.test(p.id) && p.where === 'home' && !hungry(p); });
    if (!pets.length) return out;
    var rides = [], rests = [];
    ownedIsles(C, w).forEach(function (k) {
      var seen = {};
      here(C, w, k).forEach(function (e) {
        if (has(seen, e.id) || !acted(C, e.it)) return;
        var rest = REST_ACTS.indexOf(e.it.act) >= 0;
        if (!rest && !isRide(C, e.it)) return;
        seen[e.id] = 1;
        (rest ? rests : rides).push({ isle: k, uid: e.uid, id: e.id, item: e.it.name });
      });
    });
    var lands = ownedIsles(C, w).filter(function (k) { return k !== 'home'; });
    pets.forEach(function (p) {
      var runner = p.runner === true, homeOnly = function (x) { return runner || x.isle === 'home'; };
      var cands = { ride: rides.filter(homeOnly), rest: rests.filter(homeOnly), visit: runner ? lands : [], meet: visitor && str(visitor.id) ? ['home'] : [] };
      var kinds = WISH_KINDS.filter(function (k) { return cands[k].length > 0; });
      if (!kinds.length) return;
      var kind = kinds[mod(fnv1a(p.id) + n, kinds.length)], list = cands[kind], pick = list[fnv1a(p.id + ':' + n) % list.length];
      var name = str(p.name) ? p.name : '', wsh = { kind: kind, petId: p.id, name: name };
      if (kind === 'ride' || kind === 'rest') {
        wsh.isle = pick.isle; wsh.uid = pick.uid; wsh.id = pick.id;
        wsh.key = 'act.wish.' + kind; wsh.params = { name: name, item: pick.item };
        wsh.doneKey = 'act.wish.done'; wsh.doneParams = { name: name, item: pick.item };
      } else if (kind === 'visit') {
        wsh.isle = pick; wsh.key = 'act.wish.visit'; wsh.params = { name: name, island: isleName(C, pick) };
        wsh.doneKey = 'act.wish.doneVisit'; wsh.doneParams = { name: name, island: isleName(C, pick) };
      } else {
        wsh.isle = 'home'; wsh.key = 'act.wish.meet'; wsh.params = { name: name };
        wsh.doneKey = 'act.wish.doneMeet'; wsh.doneParams = { name: name };
      }
      out[p.id] = wsh;
    });
    return out;
  }

  /* ---------------- hide and seek ---------------- */
  function stallIds(C) {
    var out = [], S = C && plain(C.ISLE_SHELVES) ? C.ISLE_SHELVES : {};
    Object.keys(S).forEach(function (k) {
      (Array.isArray(S[k]) ? S[k] : []).forEach(function (row) { if (Array.isArray(row) && row[0] === 'stalls' && Array.isArray(row[1])) out = out.concat(row[1]); });
    });
    return out;
  }
  function isTall(C, it, stalls) {
    if (!it || it.act === 'launch' || it.kind === 'path') return false;
    if (it.kind === 'house' || it.kind === 'landmark' || it.cat === 'city') return true;
    return it.id.indexOf('tree_') === 0 || TALL_IDS.indexOf(it.id) >= 0 || stalls.indexOf(it.id) >= 0;
  }
  function hideOrder(C, w, isle, day, round) {
    if (!owned(C, w, isle)) return [];
    var all = here(C, w, isle), stalls = stallIds(C);
    var list = all.filter(function (e) { return isTall(C, e.it, stalls); });
    if (!list.length) list = all.filter(function (e) { return e.it.act !== 'launch' && e.it.kind !== 'path'; });
    var d = isDay(day) ? day : '', r = int(round) && round > 0 ? round : 0;
    var order = function (rr) {
      var h = {};
      list.forEach(function (e) { h[e.uid] = fnv1a(d + '|' + isle + '|' + rr + '|' + e.uid); });
      return list.slice().sort(function (a, b) { return (h[a.uid] - h[b.uid]) || (a.uid < b.uid ? -1 : 1); }).map(function (e) { return e.uid; });
    };
    var out = order(r);
    if (r > 0 && out.length > 1 && out[0] === order(r - 1)[0]) out.push(out.shift());
    return out;
  }

  /* ---------------- stamps ---------------- */
  function stampKey(kind) { return 'act.st.' + (kind === 'tryall' ? 'tryAll' : kind); }
  function stampParams(C, isle, kind) {
    if (kind === 'visit' || kind === 'gear') return { island: isleName(C, isle) };
    if (kind === 'landmark') return { landmark: itemName(C, landmarkOf(C, isle)) };
    return null;
  }
  function ownsGear(C, w, isle) {
    if (!C || !Array.isArray(C.CATALOG) || typeof C.owns !== 'function' || !plain(w) || !plain(w.owned)) return false;
    return C.CATALOG.some(function (it) { return it.kind === 'acc' && it.isle === isle && C.owns(w, it.id); });
  }
  /* a pet the child has to play with (any pet that is not a star: one at the Hotel or the Rescue can come home);
     a core without the crew list cannot say, so the pet stamps stay */
  function hasPet(C, w) {
    if (!C || typeof C.crewList !== 'function') return true;
    var crew;
    try { crew = C.crewList(w); } catch (e) { return true; }
    return Array.isArray(crew) && crew.some(function (p) {
      return plain(p) && str(p.id) && !(typeof C.petWhere === 'function' && C.petWhere(w, p.id) === 'star');
    });
  }
  var PET_STAMPS = deepFreeze(['pat', 'fetch', 'hide']);
  /* the stamps a page shows: only what the child can do with what they own (a pet, a tree, 3 acted things, a ride,
     the land's gear), so a page is never a shopping list */
  function stamps(C, w, isle) {
    if (!owned(C, w, isle)) return [];
    var list = here(C, w, isle), kinds = isle === 'home' ? STAMP_KINDS.home : STAMP_KINDS.land;
    var nActed = distinct(list, function (e) { return acted(C, e.it); }).length;
    var nRides = distinct(list, function (e) { return acted(C, e.it) && isRide(C, e.it); }).length;
    var pet = hasPet(C, w);
    return kinds.filter(function (k) {
      if (PET_STAMPS.indexOf(k) >= 0) return pet;
      if (k === 'tree') return list.some(function (e) { return e.id.indexOf('tree_') === 0; });
      if (k === 'try3') return nActed >= TRY_N;
      if (k === 'tryall') return nRides > 0;
      if (k === 'gear') return ownsGear(C, w, isle);
      return true;
    }).map(function (k) { return { kind: k, id: isle + '.' + k, key: stampKey(k), params: stampParams(C, isle, k) }; });
  }
  function stampInfo(C, w, id) {
    if (!str(id) || id.indexOf('spy.') === 0) return null;
    var parts = id.split('.'), isle = parts[0];
    if (!C || !plain(C.ISLES) || !has(C.ISLES, isle)) return null;
    if (parts[1] === 'new' && parts.length === 3) {
      var name = itemName(C, parts[2]);
      return name ? { id: id, isle: isle, kind: 'new', key: 'act.st.new', params: { item: name }, extra: true } : null;
    }
    var kind = parts.slice(1).join('.'), kinds = isle === 'home' ? STAMP_KINDS.home : STAMP_KINDS.land;
    if (kinds.indexOf(kind) < 0) return null;
    return { id: id, isle: isle, kind: kind, key: stampKey(kind), params: stampParams(C, isle, kind), extra: false };
  }
  /* the oracle's extra: a thing bought after the page was complete. The first ledger row of the item (a void row,
     undone by a test-mode clean-up, never counts) is on or after the island day the page was completed; a thing the
     child had before (a starter thing, a landmark, one bought earlier and moved here) is not new */
  function boughtSince(w, id, day) {
    if (!isDay(day) || !plain(w) || !Array.isArray(w.ledger)) return false;
    var first = null;
    w.ledger.forEach(function (e) {
      if (!plain(e) || e.item !== id || e.void === true || !str(e.at) || !isDay(e.at.slice(0, 10))) return;
      if (first === null || e.at < first) first = e.at;
    });
    return first !== null && first.slice(0, 10) >= day;
  }
  /* a page's stamps, in page order: every stamp the child has found, whatever they own now (a stamp is never lost:
     packing the trees or the rides away, or a pet becoming a star, keeps what was found), and, still to find, only
     the ones stamps() lists. found(id) → whether the save holds that stamp */
  function pageStamps(C, w, isle, found) {
    if (!owned(C, w, isle)) return [];
    var can = {}, kinds = isle === 'home' ? STAMP_KINDS.home : STAMP_KINDS.land;
    stamps(C, w, isle).forEach(function (s) { can[s.kind] = s; });
    return kinds.filter(function (k) { return has(can, k) || !!found(isle + '.' + k); }).map(function (k) {
      return has(can, k) ? can[k] : { kind: k, id: isle + '.' + k, key: stampKey(k), params: stampParams(C, isle, k) };
    });
  }
  function complete(C, w, isle, got) {
    var found = function (id) { return has(got, id); }, l = pageStamps(C, w, isle, found);
    return l.length > 0 && l.every(function (s) { return found(s.id); });
  }
  /* one event, onto the working view v ({got, tried, done, pp}: the save's finds plus what this call found) */
  function noteOne(C, w, ev, day, v, out, touched) {
    if (!plain(ev) || !str(ev.kind) || EVENTS.indexOf(ev.kind) < 0) return;
    var isle = str(ev.isle) && C.ISLES && has(C.ISLES, ev.isle) ? ev.isle : 'home', land = isle !== 'home';
    var add = function (id, k) {
      if (!owned(C, w, k)) return;
      if (touched.indexOf(k) < 0) touched.push(k);
      if (has(v.got, id)) return;
      v.got[id] = day; out.stamps.push(id);
    };
    var gear = function () { if (land && ev.gear === true && ownsGear(C, w, isle)) add(isle + '.gear', isle); };
    var thing = function () {
      var l = here(C, w, isle);
      for (var i = 0; i < l.length; i++) if ((str(ev.uid) && l[i].uid === ev.uid) || (!str(ev.uid) && str(ev.id) && l[i].id === ev.id)) return l[i];
      return null;
    };
    var k = ev.kind;
    if (k === 'act') {
      var e = thing();
      if (!e || !str(e.it.act) || e.it.act === 'launch') return;
      if (e.it.act === 'home') { if (!land) add('home.house', 'home'); return; }
      if (!acted(C, e.it)) return;
      if (land && e.id === landmarkOf(C, isle)) add(isle + '.landmark', isle);
      if (!has(v.tried, e.id)) {
        v.tried[e.id] = 1; out.tried.push(e.id);
        if (has(v.done, isle) && boughtSince(w, e.id, v.done[isle])) add(isle + '.new.' + e.id, isle);      /* a completed page: 'Try your new …' */
      }
      var l = here(C, w, isle), t = function (x) { return has(v.tried, x); };
      if (distinct(l, function (x) { return acted(C, x.it); }).filter(t).length >= TRY_N) add(isle + '.try3', isle);
      var rides = distinct(l, function (x) { return acted(C, x.it) && isRide(C, x.it); });
      if (rides.length && rides.every(t)) add(isle + '.tryall', isle);
      if (touched.indexOf(isle) < 0 && owned(C, w, isle)) touched.push(isle);
    } else if (k === 'visit' || k === 'pat') {
      if (k === 'pat') add(isle + '.pat', isle); else if (land) add(isle + '.visit', isle);
      gear();
      var pid = ev.petId;
      if (k === 'visit' && land && str(pid) && KEY_RE.test(pid) && owned(C, w, isle) && !(plain(v.pp[pid]) && has(v.pp[pid], isle))) {
        if (!plain(v.pp[pid])) v.pp[pid] = {};
        v.pp[pid][isle] = day;
        (out.pp[pid] = out.pp[pid] || []).push(isle);
      }
    } else if (k === 'night') {
      if (land) add(isle + '.night', isle);
    } else if (k === 'map' || k === 'findme' || k === 'hello') {
      add('home.' + k, 'home');
    } else if (k === 'showtime') {
      add('home.showtime', 'home');
      if (land) add(isle + '.night', isle);
    } else if (k === 'fetch' || k === 'hide' || k === 'show') {
      add(isle + '.' + k, isle);
    } else if (k === 'spy') {
      var cid = str(ev.clue) ? ev.clue : ev.id;
      if (!str(cid) || !has(CLUE_BY, cid)) return;
      add('spy.' + isle + '.' + cid, isle);
      add(isle + '.spy', isle);
    } else if (k === 'tree') {
      /* a Home tree shaken: the stamp only shows while a tree is placed there, so only a placed tree finds it */
      if (land) return;
      var tr = str(ev.uid) || str(ev.id) ? thing() : here(C, w, 'home').filter(function (x) { return x.id.indexOf('tree_') === 0; })[0];
      if (!tr || tr.id.indexOf('tree_') !== 0) return;
      add('home.tree', 'home');
    }
  }
  function note(C, w, ev, day) {
    var out = { stamps: [], tried: [], pp: {}, done: [] };
    if (!C || typeof C.item !== 'function' || !plain(C.ISLES) || !isDay(day) || !plain(w)) return out;
    var f = findsOf(w), copy = function (o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; };
    var pp = {};
    Object.keys(sub(f, 'pp')).forEach(function (pid) { if (plain(f.pp[pid])) pp[pid] = copy(f.pp[pid]); });
    var v = { got: copy(sub(f, 'got')), tried: copy(sub(f, 'tried')), done: copy(sub(f, 'done')), pp: pp };
    (Array.isArray(ev) ? ev : [ev]).forEach(function (e) {
      var touched = [];
      noteOne(C, w, e, day, v, out, touched);
      touched.forEach(function (k) {
        if (!has(v.done, k) && complete(C, w, k, v.got)) { v.done[k] = day; out.done.push(k); }
      });
    });
    return out;
  }
  function empty(r) {
    return !plain(r) || ((!Array.isArray(r.stamps) || !r.stamps.length) && (!Array.isArray(r.tried) || !r.tried.length) &&
      (!plain(r.pp) || !Object.keys(r.pp).length) && (!Array.isArray(r.done) || !r.done.length));
  }
  function untried(C, w) {
    var tried = sub(findsOf(w), 'tried'), out = [];
    ownedIsles(C, w).forEach(function (k) {
      var seen = {};
      here(C, w, k).forEach(function (e) {
        if (has(seen, e.id) || !acted(C, e.it) || has(tried, e.id)) return;
        seen[e.id] = 1;
        out.push({ isle: k, uid: e.uid, id: e.id, ride: isRide(C, e.it) });
      });
    });
    return out;
  }

  /* ---------------- the island book ---------------- */
  function book(C, w, people) {
    if (!C || typeof C.item !== 'function' || !plain(w)) return null;
    var f = findsOf(w), got = sub(f, 'got'), done = sub(f, 'done'), tried = sub(f, 'tried'), pps = sub(f, 'pp');
    var d3 = daysOf(w), total = 0;
    var day = function (id) { return has(got, id) && isDay(got[id]) ? got[id] : null; };
    var pages = ownedIsles(C, w).map(function (isle) {
      var isDone = has(done, isle) && isDay(done[isle]);
      var list = pageStamps(C, w, isle, day).map(function (s) {
        return { id: s.id, kind: s.kind, key: s.key, params: s.params, got: !!day(s.id), day: day(s.id) };
      });
      var full = list.length > 0 && list.every(function (s) { return s.got; });
      if (isDone) list = list.filter(function (s) { return s.got; });     /* completion is permanent: no ring comes back */
      /* the extras: every 'Try your new …' found is drawn (a stamp is never lost); on a completed page, a ring for
         each acted thing there bought on or after the day it was completed and not tried yet */
      var extras = [], shown = {};
      Object.keys(got).forEach(function (id) {
        var m = id.indexOf(isle + '.new.') === 0 ? stampInfo(C, w, id) : null;
        if (m && day(id)) { shown[id] = 1; extras.push({ id: id, kind: 'new', key: m.key, params: m.params, got: true, day: day(id) }); }
      });
      if (isDone) {
        var seen = {};
        here(C, w, isle).forEach(function (e) {
          var id = isle + '.new.' + e.id;
          if (has(seen, e.id) || has(shown, id) || !acted(C, e.it) || has(tried, e.id) || !boughtSince(w, e.id, done[isle])) return;
          seen[e.id] = 1;
          extras.push({ id: id, kind: 'new', key: 'act.st.new', params: { item: e.it.name }, got: false, day: null });
        });
      }
      var n = list.filter(function (s) { return s.got; }).length + extras.filter(function (s) { return s.got; }).length;
      total += n;
      /* done is the recorded completion only (finds3.done: permanent, celebrated once). ready: every stamp the page
         shows is found but the completion is not recorded yet (a ring went because its 'if' stopped holding, e.g.
         the trees packed away before one was shaken): the host records it, C.addFinds(u, {done: book.ready}) */
      return { isle: isle, name: isleName(C, isle), stamps: list, extras: extras, n: n, done: isDone, ready: !isDone && full, doneDay: isDone ? done[isle] : null };
    });
    var met = d3 && plain(d3.met) ? d3.met : {};
    var visitors = VISIT_ORDER.filter(function (id) { return int(met[id]) && met[id] > 0 && !!castInfo(people, id); }).map(function (id) {
      var c = castInfo(people, id), n = met[id];
      return { id: id, name: c.name, n: n, key: n === 1 ? 'act.book.visited.one' : 'act.book.visited', params: { n: n },
        move: c.move, moveKey: c.moveKey, moveName: c.moveName };
    });
    var crew = [];
    try { crew = typeof C.crewList === 'function' ? C.crewList(w) : []; } catch (e) { crew = []; }
    var passports = (Array.isArray(crew) ? crew : []).filter(function (p) {
      return plain(p) && str(p.id) && !(typeof C.petWhere === 'function' && C.petWhere(w, p.id) === 'star');
    }).map(function (p) {
      var stampsOf = plain(pps[p.id]) ? pps[p.id] : {}, name = str(p.name) ? p.name : '';
      var isles = ownedIsles(C, w).filter(function (k) { return k !== 'home' && isDay(stampsOf[k]); }).map(function (k) {
        return { isle: k, name: isleName(C, k), day: stampsOf[k], key: 'act.book.ppStamp', params: { name: name, island: isleName(C, k) } };
      });
      var n = isles.length;
      return { id: p.id, name: name, isles: isles, n: n, key: n === 0 ? 'act.book.ppNone' : n === 1 ? 'act.book.ppIslands.one' : 'act.book.ppIslands',
        params: { name: name, n: n }, takeKey: 'act.book.ppTake', takeParams: { name: name } };
    });
    /* new since the book was last closed: seen is world-core's count of every stamp found (C.stampCount), so the
       difference is taken against that same count; never more than the book draws (an id this build cannot draw:
       a later build's stamp, or a page for a land no longer owned) */
    var all = Object.keys(got).filter(function (id) { return id.indexOf('spy.') !== 0; }).length;
    var seenN = f && int(f.seen) && f.seen > 0 ? f.seen : 0;
    return { n: total, key: total === 1 ? 'act.book.count.one' : 'act.book.count', params: { n: total },
      first: d3 && isDay(d3.first) ? d3.first : null, days: d3 && int(d3.n) && d3.n > 0 ? d3.n : 0,
      pages: pages, ready: pages.filter(function (p) { return p.ready; }).map(function (p) { return p.isle; }),
      visitors: visitors, passports: passports, newCount: Math.max(0, Math.min(all - seenN, total)) };
  }

  /* ---------------- today ---------------- */
  function flag(kind, id) { return (kind === 'show' || kind === 'spy' || kind === 'wish') && str(id) ? kind + ':' + id : String(kind); }
  function today(C, u, env) {
    if (!C || typeof C.item !== 'function' || typeof C.ensureWorld !== 'function') return null;
    var e = plain(env) ? env : {}, U = copyOf(C, u), w = U.world, day = isDay(e.day) ? e.day : null;
    var d3 = daysOf(w), n0 = d3 && int(d3.n) && d3.n > 0 ? d3.n : 0;
    var counted = !!(day && d3 && isDay(d3.day) && d3.day >= day);
    var n = day && !counted ? n0 + 1 : n0;
    var did = d3 && plain(d3.did) && day && d3.did.d === day && Array.isArray(d3.did.f) ? d3.did.f.filter(str) : [];
    var P = e.people && typeof e.people === 'object' ? e.people : null, me = null;
    try { me = P && typeof P.activeOf === 'function' ? P.activeOf(w) : null; } catch (x) { me = null; }
    var visitor = castInfo(P, visitorFor(n, VISIT_ORDER, me)), nextVisitor = castInfo(P, visitorFor(n + 1, VISIT_ORDER, me));
    var wx = null;
    if (day) {
      var k = weather(day), nk = weather(nextDay(day));
      wx = { kind: k, next: nk, key: 'act.wx.' + k, nextKey: 'act.wx.next.' + nk };
    }
    var show = showIsle(n, w, C);
    if (show) show.host = show.isle === 'home' ? visitor : castInfo(P, HOSTS[show.isle] || null);
    var st = plain(e.status) ? e.status : null;
    if (!st && day && e.care && typeof e.care.status === 'function') { try { st = e.care.status(w, day); } catch (x) { st = null; } }
    var LV = e.care && plain(e.care.ALERT_LV) ? e.care.ALERT_LV : ALERT0;
    var ws = wishes(C, w, n, st, visitor, LV);
    Object.keys(ws).forEach(function (id) { ws[id].done = did.indexOf(flag('wish', id)) >= 0; });
    var goal = null;
    if (!e.trial && typeof C.goalProgress === 'function') {
      var g = C.goalProgress(U, str(e.wallet) ? { wallet: e.wallet } : undefined);
      if (g && str(g.id) && C.item(g.id)) {
        var up = counted && d3.day === day && plain(d3.up) && d3.up.id === g.id && int(d3.up.n) && d3.up.n > 0 ? d3.up.n : 0;
        goal = { id: g.id, name: g.name, have: g.have, price: g.price, need: g.need, pct: g.pct, ready: !!g.ready, locked: !!g.locked, full: !!g.full, up: up };
      }
    }
    return { v: VERSION, n: n, day: day, counted: counted, first: d3 && isDay(d3.first) ? d3.first : (day && !counted ? day : null),
      season: day ? seasonOf(day) : null, weather: wx, visitor: visitor, nextVisitor: nextVisitor, show: show,
      spy: spyToday(C, w, n), wishes: ws, goal: goal, did: did };
  }

  return {
    VERSION: VERSION,
    VISIT_ORDER: VISIT_ORDER, HOSTS: HOSTS, SEASONS: SEASONS, WEATHER_CYCLE: WEATHER_CYCLE, SNOW: SNOW, CLUES: CLUES, CLUE_ORDER: CLUE_ORDER,
    NEVER: NEVER, STAMP_KINDS: STAMP_KINDS, EVENTS: EVENTS, OPEN_CLUES: OPEN_CLUES, SHOW_MAX: SHOW_MAX, SHOW_MAX_LOW: SHOW_MAX_LOW, TRY_N: TRY_N,
    WISH_KINDS: WISH_KINDS, REST_ACTS: REST_ACTS, TALL_IDS: TALL_IDS,
    today: today, visitorFor: visitorFor, castInfo: castInfo, weather: weather, seasonOf: seasonOf, dayNo: dayNo, nextDay: nextDay,
    showIsle: showIsle, showPlan: showPlan, showList: showList, clues: clues, matches: matches, wishes: wishes, hideOrder: hideOrder,
    untried: untried, note: note, empty: empty, stamps: stamps, stampInfo: stampInfo, book: book, flag: flag, fnv1a: fnv1a
  };
}));
