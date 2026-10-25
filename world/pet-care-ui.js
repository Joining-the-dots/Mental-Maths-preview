/* ================================================================
   My Island v3, kids update — SLPetCareUI (P3.1): the Pet Corner.
   window.SLPetCareUI in the browser (slLoadWorld loads it with world/pet-care.css beside the other
   world UI, after pet-care.js, world-copy.js and world-art-pets.js; plan-ku KU21), module.exports in
   Node, where the view-models and the markup run on a tiny DOM (tests/pet-care-ui.test.js).
   pets.json ui.child U1–U7 and U9–U11; plan-ku KU4 (both cap modes), KU5 (the Hotel's refusals),
   KU13 (the island-open queue), KU28 (the 🐾 button and W5b.1's wear tray), KU37 (food icons are 2D,
   never a photocard), KU40 (the farewell rule card and honest Rescue copy).

   EVERY WORD is a world-copy key (SLWorldCopy.t; KU19) or catalogue data (species and food names),
   the child's own pet names (shown only on their own device), or a refusal of the core or of
   pet-care.js (SLPetCare's kind REASON words, with the pet's name put in). The cap is read from
   C.petRoom(w) only (contracts.petCap); every rule is SLPetCare's; this file draws and commits,
   never decides. Nothing here is stored, sent or awarded.

   THE HOST'S ctx (P4.1 builds it; P3.2's Pet Shop takes the same object; only user and commit are
   required):
     user          the profile {name, points, world}, or a function returning it (read afresh)
     commit(fn)    → Promise<res>: fn(u) runs inside the host's C.transact (the host redraws after it)
     day / now     the island day 'YYYY-MM-DD' (or a function: the host's C.dayKey) and ms (a function)
     C, care       the world core and SLPetCare (defaults window.SLWorldCore / window.SLPetCare; a test
                   core with the other cap gets care.create(C) unless care is given)
     overlay(inner, {cls, small, onClose}) → .slw-ov element with _close: the host's sheet; without it
                   this file builds the same markup (role dialog, Esc, the scrim, focus back to the opener)
     cover(±1)     pause / resume the 3D island (without overlay, and around the feeding strip)
     iconHtml(id, st) a portrait (the host's photocard span); fillPhotocards(el) after each paint
     s3(method, …) the stage: s3('feed', petId, foodId, {fav, reduced}) → Promise<bool> (P3.3; false when
                   the pet is not on the island being shown)
     stageFeed(petId, foodId, o) → Promise<bool>  overrides s3('feed') (the host's 2D island moment)
     stagePlay(petId, o) → Promise<bool>  the play move on the island; without it the portrait bounces
     toast(text)   the island's toast · sfx(name) / sound(name, petId): SLSound NAMES, only after a tap
     reduced, trial  booleans or functions (defaults: the media query, window.SL_WORLD_TRIAL === true)
     openShop(o)   the Pet Shop (P3.2 openPetShop through the host's lazy load) with {filter: 'food' |
                   'adopt', news, id}; openMemories() P3.2's Memory Book; openGear() the Island Shop's
                   Crew aisle; goLearn() back to the learning games. A missing one hides its button.
     document, setTimeout, clearTimeout  test seams

   API (every sheet resolves when it closes, and after any sheet it opened has closed, so the
   island-open queue never stacks a card on it)
     newsCard(ctx) → Promise<{started, go}>   queue 'pets.news' (prio 10): 'News from the Pet Shop', the
                   cap line of the mode, the new animals, 'Visit the Pet Shop' while petRoom.canAdopt
                   (else care.ownFull); then the picker when more than 3 pets, then SLPetCare.start
     picker(ctx) → Promise<res | null>   'Who lives at home?': before care starts it starts care with
                   the ticks (closing keeps them); after, Done is setHome and closing changes nothing
     ruleCard(ctx) → Promise<bool>   queue 'care.rule' (prio 15): the one-time farewell rule (KU40), then
                   SLPetCare.markRuleSeen with the setAt it showed
     dayCard(ctx, {events}) → Promise<action | null>   queue 'care.day' (prio 40): the most important card
                   of tick's events (SLPetCare.cardOf; else today's status card), its main button going to
                   the right place; dayToast(ctx, events) → the peckish / hungry toast text or null
     openCorner(ctx, {petId, tab, feed, visit, dress}) → Promise   the Pet Corner (the 🐾 Pets button): tabs
                   At home · Pantry · Pet Hotel (n) · Pet Rescue · Memory Book (each only when it has
                   something, KU4: with 'total' the Hotel only while it has guests). With a petId and no
                   tab it opens where that pet is (C.petWhere: home, Hotel, Rescue, a star's Memory Book);
                   feed opens its food tray (a visit's at the Rescue), dress its wear tray
     openFeed(ctx, petId) · openHotel(ctx) · openRescue(ctx) · openPicker = picker · welcome = newsCard
     feedingStrip(ctx, petId, foodId, {res, kind, ov}) → Promise   the sheet slides down to a strip with
                   the tummy row while the stage plays the moment; a false stage → the 2D moment on the
                   portrait (pets U13: bowl, three bits, nods at 1.5 Hz, two hearts); a tap or Esc skips;
                   reduced motion shows the end state
     cardFor(ctx, id) → the home card's HTML · ready(ctx)
     view-models (pure): tabsOf(status, room, memories) · newsVM(ctx) · dayVM(ctx, events) ·
                   foodTiles(ctx, petId) · TABS · TAB_KEY · FOOD_KEY · MOMENT
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPetCareUI = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  /* ---------------- siblings: the page's globals, else one require() in Node ---------------- */
  var sibs = {};
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function sib(name, path, key) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!own(sibs, name)) { try { var r = require(path); sibs[name] = (key ? r && r[key] : r) || null; } catch (e) { sibs[name] = null; } }
    return sibs[name];
  }
  function COPY() { return sib('SLWorldCopy', './world-copy.js'); }
  function ARTP() { return sib('SLWorldArtPets', './world-art-pets.js'); }
  function ART() { return sib('SLWorldArt', './world-art.js', 'SLWorldArt'); }
  function SHOP() { return sib('SLIslandShop', './island-shop.js'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var TABS = ['home', 'pantry', 'hotel', 'rescue', 'memories'];
  var TAB_KEY = { home: 'care.shop.atHome', pantry: 'care.pantry', hotel: 'care.hotel.title', rescue: 'care.rescue.title', memories: 'care.memories' };
  /* a refusal of feed / canFeed / rescueVisit as a world-copy key (others show SLPetCare's reason) */
  var FOOD_KEY = { diet: 'care.diet', full: 'care.full', none: 'care.none' };
  var SOUND = { feed: 'munch', pat: 'pop', play: 'boing', wear: 'chip', home: 'tada', pick: 'click' };
  /* the 2D moment (pets U13): bits 0.15 s apart, three nods at 1.5 Hz while the bowl empties, two hearts
     over 1 s, under 3.5 s; reduced motion holds the end state; guard = the longest a stage may take */
  var MOMENT = { bit: 150, nods: 600, pile: 500, hearts: 2200, end: 3200, reduced: 1200, guard: 6000 };

  /* ---------------- the ctx, read afresh ---------------- */
  function env(ctx) {
    ctx = ctx || {};
    var C = ctx.C || sib('SLWorldCore', './world-core.js'), P = ctx.care, CP = COPY();
    if (!P) {
      var PC = sib('SLPetCare', './pet-care.js');
      P = PC && ctx.C && typeof PC.create === 'function' ? PC.create(ctx.C) : PC;
    }
    var E = { ctx: ctx, C: C, P: P };
    E.u = function () { var u = ctx.user; return typeof u === 'function' ? u() : u; };
    E.w = function () { var u = E.u(); return u ? C.ensureWorld(u) : null; };
    E.now = function () { return typeof ctx.now === 'function' ? ctx.now() : Date.now(); };
    E.day = function () { var d = ctx.day; return typeof d === 'function' ? d() : typeof d === 'string' ? d : C.dayKey(E.now()); };
    E.t = function (key, vars) {
      if (typeof ctx.tx === 'function') return ctx.tx(key, vars);
      return CP && typeof CP.t === 'function' ? CP.t(key, vars) : key;
    };
    E.has = function (key) { return !!(CP && CP.STRINGS && own(CP.STRINGS, key)); };
    E.reduced = function () {
      var r = ctx.reduced;
      if (typeof r === 'function') return !!r();
      if (typeof r === 'boolean') return r;
      try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    };
    E.trial = function () { var t = ctx.trial; return typeof t === 'function' ? !!t() : typeof t === 'boolean' ? t : root.SL_WORLD_TRIAL === true; };
    E.status = function () { return P.status(E.w(), E.day()); };
    E.room = function () { return C.petRoom(E.w()); };
    E.doc = function () { return ctx.document || root.document; };
    E.later = function (fn, ms) { var f = ctx.setTimeout || root.setTimeout; return f(fn, ms); };
    E.unlater = function (h) { var f = ctx.clearTimeout || root.clearTimeout; if (f && h != null) f(h); };
    return E;
  }
  function ready(ctx) {
    var E = env(ctx);
    return !!(E.C && E.P && typeof E.P.ready === 'function' && E.P.ready() && typeof E.C.petRoom === 'function' && E.u());
  }
  function commit(E, fn) {
    if (typeof E.ctx.commit !== 'function') return Promise.resolve({ ok: false });
    return Promise.resolve(E.ctx.commit(fn)).then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
  }
  function sound(E, name, petId) {
    var c = E.ctx;
    try {
      if (typeof c.sound === 'function') return c.sound(name, petId);
      if (typeof c.sfx === 'function') return c.sfx(name, petId);
      var S = root.SLSound, u = E.u();
      if (S && typeof S.make === 'function') {
        var s = S.make({ muted: function () { return !!(u && u.muted); } });
        if (petId && typeof s.pet === 'function') s.pet(petId, 0.8); else s(name);
      }
    } catch (e) { /* sound is never needed */ }
  }
  function toast(E, text) { if (text && typeof E.ctx.toast === 'function') { try { E.ctx.toast(text); } catch (e) { /* ignore */ } } }
  function s3(E) { var f = E.ctx.s3; if (typeof f !== 'function') return undefined; try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { return undefined; } }

  /* ---------------- names and pictures (data, never typed by another child) ---------------- */
  function species(E, id) { var it = E.C.item(id); return it ? it.name : ''; }
  function foodName(E, id) { var it = E.C.item(id); return it ? it.name : ''; }
  /* a catalogue name inside a sentence ('No pet treats left.'): its first letter small */
  /* 'Adopt an otter again': the vowel form when the copy has it (lead copy fix after K4) */
  function againKey(E, s) { return /^[aeiou]/i.test(String(s || '')) && E.has('care.memory.againAn') ? 'care.memory.againAn' : 'care.memory.again'; }
  function inSentence(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  /* the first food of a group (the favourite's name, the one to try), catalogue order */
  function foodOf(E, group) { var f = E.C.foodItems().filter(function (x) { return x.group === group; })[0]; return f || null; }
  function portrait(E, id, st) {
    var c = E.ctx;
    /* a picture never stops the sheet: a host icon that throws falls back to world-art's, then to none */
    if (typeof c.iconHtml === 'function') { try { return c.iconHtml(id, st) || ''; } catch (e) { /* below */ } }
    var A = ART();
    try { return A && typeof A.icon === 'function' ? A.icon(id, st) || '' : ''; } catch (e) { return ''; }
  }
  function petPic(E, id) { return portrait(E, id, { acc: E.C.wornBy(E.w(), id) }); }
  /* KU37: a food is drawn by world-art-pets as a 2D icon, never asked of the photocards */
  function foodIcon(id) { return care2d('foodIcon', id); }
  function care2d(fn) {
    var A = ARTP();
    if (!A || typeof A[fn] !== 'function') return '';
    try { return A[fn].apply(A, Array.prototype.slice.call(arguments, 1)) || ''; } catch (e) { return ''; }
  }
  /* the Memory Book's tab: its gold memory star on a night plate (the small white badge reads as a plus at 20 px) */
  function starIcon() { var s = care2d('star'); return s ? '<span class="slw-pcc-tstar" aria-hidden="true">' + s + '</span>' : ''; }
  function tummyWord(E, p) { return E.t(E.P.tummyKey(p.level) || 'care.tummy.full'); }
  function happyWord(E, p) { return E.t('care.happy.' + Math.max(0, Math.min(4, p.happy | 0))); }
  /* the two rows; the words carry the meaning (status is never colour or icons alone) */
  function meters(E, p) {
    var tw = tummyWord(E, p), hw = happyWord(E, p);
    return '<div class="slw-pcc-meters" role="img" aria-label="' + esc(p.name + ': ' + tw + ', ' + hw) + '">' +
      '<div class="slw-pcc-meter" aria-hidden="true">' + care2d('tummy', p.food, { group: p.fav || 'biscuits' }) + '<span>' + esc(tw) + '</span></div>' +
      '<div class="slw-pcc-meter" aria-hidden="true">' + care2d('hearts', p.happy, { max: 4 }) + '<span>' + esc(hw) + '</span></div></div>';
  }
  function btn(a, label, o) {
    o = o || {};
    return '<button type="button" class="slw-btn' + (o.cls ? ' ' + o.cls : '') + '" data-a="' + a + '"' + (o.id ? ' data-id="' + esc(o.id) + '"' : '') +
      (o.v ? ' data-v="' + esc(o.v) + '"' : '') + ' data-fk="' + esc(o.fk || (a + ':' + (o.id || '') + ':' + (o.v || ''))) + '"' +
      (o.expanded != null ? ' aria-expanded="' + !!o.expanded + '"' : '') +
      (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.off ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }
  function line(text, cls) { return text ? '<p class="slw-pcc-line' + (cls ? ' ' + cls : '') + '">' + text + '</p>' : ''; }
  function petName(E, id) { var p = E.C.crewPet(E.w(), id); return p ? p.name : ''; }
  /* a refusal in plain words: the rule's own sentence with the pet's name in it where it says 'that pet'
     or 'them' (KU5: 'Give {name} a meal first, then the Pet Hotel can look after them.') */
  function named(reason, name) {
    var s = String(reason || '');
    if (!name) return s;
    if (/That pet/.test(s)) return s.replace(/That pet/, name);
    if (/that pet/.test(s)) return s.replace(/that pet/, name);
    return s.replace(/^Give them /, 'Give ' + name + ' ');
  }
  function refusal(E, res) { return res ? named(res.reason || '', res.id ? petName(E, res.id) : '') : ''; }
  /* an island day 'YYYY-MM-DD' as a child reads it ('Tuesday 20 October', UK English); the key as it is if Intl cannot */
  function dayWords(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return String(key || '');
    try { return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', ''); } catch (e) { return key; }
  }
  function starSoon(E, name, n) { return n === 1 && E.has('care.star.soon.one') ? E.t('care.star.soon.one', { name: name }) : E.t('care.star.soon', { name: name, n: n }); }

  /* ================================================================
     VIEW-MODELS (pure)
     ================================================================ */
  /* the Corner's tabs: At home and the Pantry always; the Hotel with 'home' always, with 'total' only while it
     has guests (KU4); the Rescue while someone is there; the Memory Book once there is a memory */
  function tabsOf(status, room, memories) {
    var n = function (where) { return status.pets.filter(function (p) { return p.where === where; }).length; };
    var out = [{ key: 'home', n: n('home') }, { key: 'pantry', n: null }];
    var guests = n('hotel');
    if ((room && room.mode === 'home') || guests > 0) out.push({ key: 'hotel', n: guests });
    if (n('rescue') > 0) out.push({ key: 'rescue', n: n('rescue') });
    if (memories && memories.length) out.push({ key: 'memories', n: memories.length });
    return out;
  }
  /* 'News from the Pet Shop' (KU13): the cap line of the mode, the new animals, and the shop button's truth table */
  function newsVM(ctx) {
    var E = env(ctx), w = E.w(), room = E.room(), L = root.SLIslandLook || sib('SLIslandLook', './world-look.js');
    var fresh = L && Array.isArray(L.KU_IDS) ? L.KU_IDS.filter(function (id) { var it = E.C.item(id); return it && it.kind === 'pet' && !it.retired; }).length : 0;
    var vm = { mode: room.mode, count: room.count, canAdopt: !!room.canAdopt, fresh: fresh, pick: E.P.needsPick(w), lines: [] };
    vm.lines.push({ key: 'care.welcome.body' }, { key: 'care.promise' });
    if (room.mode === 'home') vm.lines.push({ key: 'care.welcome.cap' });
    /* 'total': the cap line, unless care.ownFull below says it with the child's own count */
    else if (room.count > room.max) vm.lines.push({ key: 'care.welcome.capKeep', vars: { n: room.count } });
    else if (room.canAdopt) vm.lines.push({ key: 'care.welcome.capTotal' });
    /* the new animals and the shop button come together, only while the child may adopt (P3.1: else care.ownFull) */
    if (fresh && vm.canAdopt) vm.lines.push({ key: 'care.welcome.new', vars: { n: fresh } });
    vm.shop = vm.canAdopt;
    vm.ownFull = vm.canAdopt ? null : { key: 'care.ownFull', vars: { n: room.count } };
    return vm;
  }
  /* the island-day card: the most important event (SLPetCare.cardOf), its words, and where its main button goes */
  function dayVM(ctx, events) {
    var E = env(ctx), w = E.w(), st = E.status(), P = E.P, K = E.C.CARE;
    var ev = P.cardOf(events || []) || st.card;
    if (!ev) return null;
    var p = st.pets.filter(function (x) { return x.id === ev.id; })[0] || null;
    var vm = { type: ev.type, id: ev.id, name: p ? p.name : petName(E, ev.id), lines: [], main: null, more: null, learn: null, art: 'portrait' };
    if (ev.type === 'star') {
      var mem = P.memories(w).filter(function (m) { return m.id === ev.id; }).pop();
      if (mem) vm.name = mem.name;
      vm.art = 'memory'; vm.acc = mem ? mem.acc : {};
      vm.lines.push({ key: 'care.star.went', vars: { name: vm.name } });
      vm.main = { a: 'memories', key: 'care.memory.see' };
      if (E.has('care.ok')) vm.more = { a: 'ok', key: 'care.ok' };
      return vm;
    }
    if (ev.type === 'arrived') {
      vm.art = 'hotel';
      vm.lines.push({ key: 'care.hotel.arrived', vars: { name: vm.name } });
      vm.main = { a: 'hotel', key: 'care.hotel.title' };
      return vm;
    }
    var visit = ev.type === 'rescued' || ev.type === 'starSoon';
    if (ev.type === 'rescued') {
      vm.art = 'rescue';
      /* KU40: with farewell on, never 'safe and warm', and the rule is said */
      vm.lines.push({ key: st.farewell ? 'care.rescue.wentFarewell' : 'care.rescue.went', vars: { name: vm.name } });
      if (st.farewell) vm.lines.push({ key: 'care.rescue.rule', vars: { n: K.starAfter } });
    } else if (ev.type === 'starSoon') {
      vm.art = 'rescue';
      vm.soon = typeof ev.left === 'number' ? ev.left : p && p.rescue && p.rescue.starIn != null ? p.rescue.starIn : K.starAfter - K.starWarn;
    } else vm.lines.push({ key: 'care.' + ev.type, vars: { name: vm.name } });     /* warn, last */
    vm.main = visit ? { a: 'visit', key: 'care.rescue.visit', vars: { name: vm.name } } : { a: 'feed', key: 'care.feed' };
    /* nothing in the pantry this pet eats: the way to earn the ⭐ (never in test mode), else the Pet Shop */
    if (!mealFor(E, ev.id)) {
      var cheap = cheapestMeal(E, ev.id), u = E.u(), need = cheap ? cheap.price - ((u && u.points) | 0) : 0;
      var shop = typeof ctx.openShop === 'function' ? { a: 'shop', key: 'care.welcome.shop' } : null;
      if (!E.trial() && cheap && need > 0) {
        vm.learn = { key: 'care.noPoints', vars: { n: need, food: inSentence(cheap.name) } };
        vm.main = typeof ctx.goLearn === 'function' ? { a: 'learn', key: 'care.goLearn' } : shop || vm.main;
      } else vm.main = shop || vm.main;
    }
    return vm;
  }
  function eatsGroup(E, petId, group) {
    var d = E.P.dietOf(petId);
    if (d.only) return d.only.indexOf(group) >= 0;
    return !(group === 'fish' && d.noFish);
  }
  /* a meal in the pantry this pet can eat (a visit needs a meal; a hungry pet needs one) */
  function mealFor(E, petId) {
    var w = E.w();
    return E.C.foodItems().some(function (f) { return f.group !== 'treat' && eatsGroup(E, petId, f.group) && E.C.pantryCount(w, f.id) > 0; });
  }
  function cheapestMeal(E, petId) {
    var list = E.C.foodItems().filter(function (f) { return f.group !== 'treat' && eatsGroup(E, petId, f.group); });
    list.sort(function (a, b) { return a.price - b.price; });
    return list[0] || null;
  }
  /* the food picker's tiles: every food with its count, why it cannot be used now (SLPetCare.canFeed), the favourite,
     and whether the pantry ever held it (had: the picker shows what is there and what ran out, not the whole shop) */
  function foodTiles(ctx, petId) {
    var E = env(ctx), w = E.w(), day = E.day(), d = E.P.dietOf(petId), favFood = d.fav ? foodOf(E, d.fav) : foodOf(E, 'biscuits');
    var name = petName(E, petId), visits = rescueVisits(E, petId), cc = E.C.careOf(w), pan = cc && cc.pantry && typeof cc.pantry === 'object' ? cc.pantry : {};
    return E.C.foodItems().map(function (f) {
      var chk = E.P.canFeed(w, petId, f.id, day), n = E.C.pantryCount(w, f.id);
      var tile = { id: f.id, name: f.name, n: n, had: n > 0 || !!(own(pan, f.id) && pan[f.id] && pan[f.id].got > 0), ok: !!chk.ok, fav: f.group === d.fav, why: null, code: null };
      if (!chk.ok) {
        tile.code = chk.code;
        if (own(FOOD_KEY, chk.code)) tile.why = { key: FOOD_KEY[chk.code], vars: { name: name, food: inSentence(f.name), fav: favFood ? inSentence(favFood.name) : '' } };
        else if (chk.code === 'visited') tile.why = { key: 'care.rescue.progress', vars: { n: visits } };
        else tile.why = { text: named(chk.reason, name) };
      }
      return tile;
    });
  }
  function rescueVisits(E, petId) { var p = E.status().pets.filter(function (x) { return x.id === petId; })[0]; return p && p.rescue ? p.rescue.visits : 0; }
  function whyText(E, why) { return why ? (why.key ? E.t(why.key, why.vars) : why.text || '') : ''; }

  /* ================================================================
     THE PAGE (everything below needs a document)
     ================================================================ */
  var seq = 0;
  /* one sheet: the host's overlay when there is one, else the same markup here (KU28: the island's sheets) */
  function sheet(E, inner, o) {
    o = o || {};
    var ctx = E.ctx, cls = 'slw-pcc-ov' + (o.cls ? ' ' + o.cls : '');
    if (typeof ctx.overlay === 'function') {
      var hov = ctx.overlay(inner, { cls: cls, small: !!o.small, onClose: o.onClose });
      if (hov) return hov;
    }
    var doc = E.doc(), ov = doc.createElement('div'), opener = doc.activeElement, closed = false;
    ov.className = 'slw-ov ' + cls;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('data-sl-modal', '1');
    ov.innerHTML = '<div class="slw-sheet' + (o.small ? ' small' : '') + '"><button type="button" class="slw-x" aria-label="' + esc(E.t('char.cast.notNow')) + '">✕</button>' + inner + '</div>';
    var h2 = ov.querySelector('h2');
    if (h2) { h2.id = h2.id || 'slwPcc' + (++seq); ov.setAttribute('aria-labelledby', h2.id); }
    doc.body.appendChild(ov);
    cover(E, +1);
    function onKey(e) {
      if (e.key !== 'Escape' || ov.classList.contains('slw-pcc-strip')) return;   /* the strip handles its own Esc */
      var all = doc.querySelectorAll('.slw-ov');
      if (all[all.length - 1] === ov) close();
    }
    function close() {
      if (closed) return;
      closed = true;
      cover(E, -1);
      ov.remove(); doc.removeEventListener('keydown', onKey);
      if (o.onClose) o.onClose();
      try { if (opener && opener !== doc.body && opener.isConnected && opener.focus) opener.focus(); } catch (e) { /* ignore */ }
    }
    doc.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov && !ov.classList.contains('slw-pcc-strip')) close(); });
    ov.querySelector('.slw-x').addEventListener('click', close);
    E.later(function () { var b = ov.querySelector('[data-a]') || ov.querySelector('.slw-x'); try { if (b && b.isConnected) b.focus(); } catch (e) { /* ignore */ } }, 30);
    ov._close = close;
    return ov;
  }
  function cover(E, n) { try { if (typeof E.ctx.cover === 'function') E.ctx.cover(n); } catch (e) { /* ignore */ } }
  function bind(el, on) {
    el.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = on[b.getAttribute('data-a')];
        if (f && !b.disabled && b.getAttribute('aria-disabled') !== 'true') f(b.getAttribute('data-id'), b.getAttribute('data-v'), b);
      });
    });
  }
  function photo(E, el) { try { if (typeof E.ctx.fillPhotocards === 'function') E.ctx.fillPhotocards(el); } catch (e) { /* ignore */ } }
  function focusKey(E) { var a = E.doc().activeElement; return a && a.getAttribute ? a.getAttribute('data-fk') : null; }
  function refocus(el, fk) { if (!fk) return; var b = el.querySelector('[data-fk="' + fk + '"]'); try { if (b) b.focus(); } catch (e) { /* ignore */ } }
  /* a card sheet: a picture, a title, its lines and its buttons; resolves with the button's action (null: closed) */
  function card(E, o) {
    return new Promise(function (resolve) {
      var picked = null, ov;
      var btns = (o.buttons || []).map(function (b, i) { return btn('go', b.label, { v: b.a, cls: i === 0 ? 'big on' : 'big' }); }).join('');
      ov = sheet(E, '<div class="slw-pcc-card1">' + (o.art ? '<div class="slw-pcc-art" aria-hidden="true">' + o.art + '</div>' : '') +
        '<h2>' + esc(o.title) + '</h2>' + (o.lines || []).map(function (l) { return line(esc(l)); }).join('') +
        (btns ? '<div class="slw-pcc-btns">' + btns + '</div>' : '') + '</div>', { small: true, cls: o.cls, onClose: function () { resolve(picked); } });
      photo(E, ov);
      bind(ov, { go: function (id, a) { picked = a; ov._close(); } });
    });
  }

  /* ---------------- 'News from the Pet Shop' (U1, KU13) ---------------- */
  function newsCard(ctx) {
    if (!ready(ctx)) return Promise.resolve({ started: false, go: null });
    var E = env(ctx), vm = newsVM(ctx), buttons = [{ a: 'corner', label: E.t('care.welcome.corner') }];
    if (vm.shop && typeof ctx.openShop === 'function') buttons.push({ a: 'shop', label: E.t('care.welcome.shop') });
    var lines = vm.lines.map(function (l) { return E.t(l.key, l.vars); });
    if (vm.ownFull) lines.push(E.t(vm.ownFull.key, vm.ownFull.vars));
    var art = '<span class="slw-pcc-bowl">' + care2d('bowl', { group: 'biscuits', pile: 4 }) + '</span><span class="slw-pcc-bag">' + foodIcon('food_biscuits') + '</span>';
    return card(E, { title: E.t('care.welcome.title'), lines: lines, buttons: buttons, art: art, cls: 'slw-pcc-news' }).then(function (go) {
      /* care starts whichever way the card closes: the picker first when more than 3 pets */
      var started = E.P.needsPick(E.w()) ? picker(ctx) : startCare(E, null);
      return started.then(function (res) {
        var out = { started: !!(res && res.ok && res.started !== false), go: go };
        if (!res || !res.ok) return out;
        if (go === 'corner') return openCorner(ctx).then(function () { return out; });
        if (go === 'shop') return Promise.resolve(ctx.openShop({ filter: 'adopt', news: true })).then(function () { return out; });
        return out;
      });
    });
  }
  function startCare(E, home) {
    var day = E.day(), ms = E.now();
    return commit(E, function (u) { return E.P.start(u, day, ms, home ? { home: home } : undefined); });
  }

  /* ---------------- 'Who lives at home?' (U3) ---------------- */
  function picker(ctx) {
    if (!ready(ctx)) return Promise.resolve(null);
    var E = env(ctx), w0 = E.w(), started = E.status().started, max = E.C.CARE.homeMax;
    var crew = E.C.crewList(w0).filter(function (p) { var wh = E.C.petWhere(w0, p.id); return wh !== 'star' && (!started || wh); });
    /* a pet at the Pet Rescue keeps its spot: ticked, and it cannot be unticked */
    var locked = crew.filter(function (p) { return started && E.C.petWhere(w0, p.id) === 'rescue'; }).map(function (p) { return p.id; });
    var ticks = E.P.defaultHome(w0).filter(function (id) { return crew.some(function (p) { return p.id === id; }); });
    return new Promise(function (resolve) {
      var result = null, ov, busy = false, err = '';
      function html() {
        var count = E.t('care.pick.count', { n: ticks.length }), done = E.has('care.pick.done') ? E.t('care.pick.done') : '✓ ' + count;
        return '<p class="slw-pcc-line">' + esc(E.t('care.pick.sub')) + '</p><div class="slw-pcc-pick" role="group" aria-label="' + esc(E.t('care.pick.title')) + '">' +
          crew.map(function (p) {
            var on = ticks.indexOf(p.id) >= 0, lock = locked.indexOf(p.id) >= 0;
            return '<button type="button" class="slw-pcc-pet' + (on ? ' on' : '') + '" data-a="tick" data-id="' + esc(p.id) + '" data-fk="tick:' + esc(p.id) + '" aria-pressed="' + on + '"' +
              (lock ? ' aria-disabled="true"' : '') + '><span class="slw-pcc-pic">' + portrait(E, p.id, { acc: E.C.wornBy(w0, p.id) }) + '</span><span class="slw-pcc-pnm">' + esc(p.name) +
              '</span><span class="slw-pcc-tick" aria-hidden="true">' + (on ? '✓' : '') + '</span>' + (lock ? '<span class="slw-pcc-lock">' + care2d('badge', 'rescue') + '</span>' : '') + '</button>';
          }).join('') + '</div>' + (done === '✓ ' + count ? '' : '<p class="slw-pcc-count">' + esc(count) + '</p>') +
          (err ? '<p class="slw-err slw-pcc-err" role="alert">' + esc(err) + '</p>' : '') +
          '<div class="slw-pcc-btns">' + btn('done', done, { cls: 'big on', off: ticks.length < 1 || busy }) + '</div>';
      }
      function paint() {
        var body = ov.querySelector('.slw-pcc-body'), fk = focusKey(E);
        body.innerHTML = html(); photo(E, body); bind(body, on); refocus(body, fk);
        var live = ov.querySelector('.slw-pcc-live');
        if (live) live.textContent = E.t('care.pick.count', { n: ticks.length });
      }
      function save(close) {
        if (busy) return Promise.resolve(null);
        busy = true;
        var ms = E.now(), pick = ticks.slice();
        var run = started ? commit(E, function (u) { return E.P.setHome(u, pick, ms); }) : startCare(E, pick);
        return run.then(function (res) {
          busy = false;
          if (res && res.ok) { result = res; sound(E, SOUND.pick); if (close && ov.isConnected) ov._close(); return res; }
          err = refusal(E, res); if (ov.isConnected) paint();
          return null;
        });
      }
      var on = {
        tick: function (id) {
          var i = ticks.indexOf(id);
          if (i >= 0) ticks.splice(i, 1); else if (ticks.length < max) ticks.push(id);
          err = ''; paint();
        },
        done: function () { save(true); }
      };
      ov = sheet(E, '<h2>' + esc(E.t('care.pick.title')) + '</h2><div class="slw-pcc-body"></div><div class="slw-vh slw-pcc-live" role="status" aria-live="polite"></div>', {
        cls: 'slw-pcc-picker',
        /* closing keeps the ticks before care starts (care must start); afterwards closing changes nothing */
        onClose: function () { if (result || started) resolve(result); else save(false).then(resolve); }
      });
      paint();
    });
  }

  /* ---------------- the one-time farewell rule card (KU40) ---------------- */
  function ruleCard(ctx) {
    if (!ready(ctx)) return Promise.resolve(false);
    var E = env(ctx), setAt = E.P.ruleNews(E.w());
    if (setAt === null) return Promise.resolve(false);
    var away = E.status().pets.filter(function (p) { return p.where === 'rescue'; })[0], buttons = [];
    if (away) buttons.push({ a: 'visit', label: E.t('care.rescue.visit', { name: away.name }) });
    if (E.has('care.ok')) buttons.push({ a: 'ok', label: E.t('care.ok') });
    return card(E, { title: E.t('care.rule.title'), lines: [E.t('care.rule.body', { n: E.C.CARE.starAfter })], buttons: buttons, art: care2d('header', 'rescue'), cls: 'slw-pcc-rulecard' })
      .then(function (a) {
        var ms = E.now();
        return commit(E, function (u) { return E.P.markRuleSeen(u, setAt, ms); }).then(function (r) {
          var ok = !!(r && r.ok);
          return a === 'visit' ? openCorner(ctx, { tab: 'rescue', petId: away.id, visit: true }).then(function () { return ok; }) : ok;
        });
      });
  }

  /* ---------------- the island-day card (U4) and toast ---------------- */
  function dayCard(ctx, o) {
    if (!ready(ctx)) return Promise.resolve(null);
    var E = env(ctx), vm = dayVM(ctx, o && o.events);
    if (!vm) return Promise.resolve(null);
    var art = vm.art === 'memory' ? care2d('memory', vm.id, { acc: vm.acc }) : vm.art === 'portrait' ? '<span class="slw-pcc-pic">' + petPic(E, vm.id) + '</span>' : care2d('header', vm.art);
    var lines = vm.lines.map(function (l) { return E.t(l.key, l.vars); });
    if (vm.soon != null) lines.push(starSoon(E, vm.name, vm.soon));
    if (vm.learn) lines.push(E.t(vm.learn.key, vm.learn.vars));
    var buttons = [vm.main, vm.more].filter(Boolean).map(function (b) { return { a: b.a, label: E.t(b.key, b.vars) }; });
    return card(E, { title: vm.name, lines: lines, buttons: buttons, art: art, cls: 'slw-pcc-day slw-pcc-' + vm.type }).then(function (a) {
      var go = { feed: function () { return openCorner(ctx, { petId: vm.id, feed: true }); },
        visit: function () { return openCorner(ctx, { tab: 'rescue', petId: vm.id, visit: true }); },
        hotel: function () { return openCorner(ctx, { tab: 'hotel', petId: vm.id }); },
        memories: function () { return typeof ctx.openMemories === 'function' ? ctx.openMemories({ petId: vm.id }) : openCorner(ctx, { tab: 'memories' }); },
        shop: function () { return ctx.openShop({ filter: 'food' }); },
        learn: function () { return ctx.goLearn(); } }[a];
      return go ? Promise.resolve(go()).then(function () { return a; }) : a;
    });
  }
  function dayToast(ctx, events) {
    var E = env(ctx), ev = E.P && E.P.toastOf(events || []);
    return ev ? E.t('care.' + ev.type, { name: petName(E, ev.id) }) : null;
  }

  /* ================================================================
     THE PET CORNER (U5–U7, U9–U11)
     ================================================================ */
  /* opened on one pet with no tab named (the Pet Shop's 'Pet Corner' button, a toast, the hungry reminder): the tab
     where that pet really is (C.petWhere), and the tray that fits it there: feeding at home is a visit at the Rescue,
     a Hotel guest needs no meal, Dress opens where the pet can be dressed */
  var TAB_OF = { home: 'home', hotel: 'hotel', rescue: 'rescue', star: 'memories' };
  function startOf(E, o) {
    var where = o.petId ? E.C.petWhere(E.w(), o.petId) : null, tab = o.tab || (own(TAB_OF, where) ? TAB_OF[where] : 'home'), kind = null;
    if (o.petId && (o.feed || o.visit)) kind = where === 'rescue' ? 'visit' : where === 'hotel' || where === 'star' ? null : o.feed ? 'feed' : 'visit';
    else if (o.petId && o.dress && (where === 'home' || where === 'hotel')) kind = 'dress';
    return { tab: tab, tray: kind ? { kind: kind, id: o.petId } : null };
  }
  function openCorner(ctx, o) {
    o = o || {};
    if (!ready(ctx)) return Promise.resolve(false);
    var E = env(ctx);
    if (!E.status().started) return newsCard(ctx).then(function () { return true; });
    return new Promise(function (resolve) {
      var first = startOf(E, o);
      var S = { tab: first.tab, tray: first.tray, msg: {}, busy: false, after: null };
      var ov = sheet(E, '<h2>' + esc(E.t('care.corner.title')) + '</h2><div class="slw-pcc-tabs" role="tablist"></div><div class="slw-pcc-panel" role="tabpanel" id="slwPccPanel"></div>' +
        '<div class="slw-vh slw-pcc-live" role="status" aria-live="polite"></div>', {
        cls: 'slw-pcc',
        /* a sheet the Corner opened (the Pet Shop, the Crew aisle) closes first */
        onClose: function () { if (S.after) S.after.then(function () { resolve(true); }, function () { resolve(true); }); else resolve(true); }
      });
      var tabsEl = ov.querySelector('.slw-pcc-tabs'), panel = ov.querySelector('.slw-pcc-panel');
      function say(text) { var r = ov.querySelector('.slw-pcc-live'); if (r) { r.textContent = ''; r.textContent = text; } }
      function paint(fk) {
        var st = E.status(), room = E.room(), mem = E.P.memories(E.w()), tabs = tabsOf(st, room, mem);
        if (!tabs.some(function (t) { return t.key === S.tab; })) S.tab = 'home';
        var keep = fk || focusKey(E);
        tabsEl.innerHTML = tabs.map(function (t) {
          var on = t.key === S.tab, label = E.t(TAB_KEY[t.key]) + (t.key === 'hotel' ? ' (' + t.n + ')' : '');
          return '<button type="button" class="slw-btn slw-pcc-tab" role="tab" data-a="tab" data-v="' + t.key + '" data-fk="tab:' + t.key + '" aria-selected="' + on +
            '" aria-controls="slwPccPanel" tabindex="' + (on ? 0 : -1) + '">' + (t.key === 'rescue' ? care2d('badge', 'rescue') : t.key === 'memories' ? starIcon() : '') + esc(label) + '</button>';
        }).join('');
        panel.setAttribute('aria-label', E.t(TAB_KEY[S.tab]));
        panel.innerHTML = PANELS[S.tab](E, S, st, room, mem);
        photo(E, panel);
        bind(tabsEl, on); bind(panel, on);
        tabKeys();
        panel.querySelectorAll('[data-name]').forEach(function (inp) {
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); on.name(inp.getAttribute('data-name')); } });
        });
        refocus(ov, keep);
        var pressed = tabsEl.querySelector('[aria-selected="true"]');
        try { if (pressed && pressed.scrollIntoView) pressed.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* ignore */ }
      }
      /* the tab row: arrows, Home and End move along it (the WAI tabs pattern) */
      function tabKeys() {
        var list = tabsEl.querySelectorAll('[role="tab"]');
        list.forEach(function (b, i) {
          b.addEventListener('keydown', function (e) {
            var to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
            if (to == null) return;
            if (e.preventDefault) e.preventDefault();
            to = (to + list.length) % list.length;
            S.tab = list[to].getAttribute('data-v'); S.tray = null; paint('tab:' + S.tab);
          });
        });
      }
      /* one change at a time; then the sheet redraws with focus kept (the host redraws the island) */
      function act(fn, after) {
        if (S.busy) return Promise.resolve(null);
        S.busy = true;
        return commit(E, fn).then(function (res) { S.busy = false; if (after) after(res); if (ov.isConnected) paint(); return res; });
      }
      function toggle(kind, id) {
        S.tray = S.tray && S.tray.kind === kind && S.tray.id === id ? null : { kind: kind, id: id };
        S.msg[id] = '';
        paint();
        if (S.tray && kind === 'rename') { var inp = panel.querySelector('[data-name="' + id + '"]'); try { if (inp) inp.focus(); } catch (e) { /* ignore */ } }
      }
      function bounce(id) {
        var pic = panel.querySelector('[data-pic="' + id + '"]');
        if (!pic || E.reduced()) return;
        pic.classList.remove('slw-pcc-hop'); pic.classList.add('slw-pcc-hop');
        E.later(function () { pic.classList.remove('slw-pcc-hop'); }, 1300);
      }
      /* Pat and Play (U7): once per island day each says '+1 happy'; later taps just make the pet happy */
      function cheer(kind, id) {
        var day = E.day(), ms = E.now(), staged = kind === 'play' && typeof E.ctx.stagePlay === 'function';
        sound(E, SOUND[kind], kind === 'pat' ? id : null);
        return act(function (u) { return E.P[kind](u, id, day, ms); }, function (res) {
          var text = res && res.ok ? (res.counted ? E.t('care.happyUp', { name: petName(E, id) }) : '') : refusal(E, res);
          S.msg[id] = text;
          if (text) say(text);
        }).then(function (res) {
          if (staged && res && res.ok) return feedingStrip(E.ctx, id, null, { kind: 'play', ov: ov, res: res }).then(function () { if (ov.isConnected) paint('play:' + id + ':'); });
          bounce(id);
        });
      }
      /* a meal (or a Rescue visit): the tray closes, the strip plays the moment, the end line follows */
      function feed(id, food, visit) {
        var day = E.day(), ms = E.now(), name = petName(E, id);
        return act(function (u) { return visit ? E.P.rescueVisit(u, id, food, day, ms) : E.P.feed(u, id, food, day, ms); }, function (res) {
          if (!res || !res.ok) {
            S.msg[id] = own(FOOD_KEY, res && res.code) ? E.t(FOOD_KEY[res.code], { name: name, food: inSentence(foodName(E, food)), fav: '' }) : refusal(E, res);
            return;
          }
          S.tray = null; S.msg[id] = '';
        }).then(function (res) {
          if (!res || !res.ok) return;
          sound(E, SOUND.feed);
          return feedingStrip(E.ctx, id, food, { res: res, kind: visit ? 'visit' : 'feed', ov: ov }).then(function () {
            var end = visit ? (res.home ? E.t('care.rescue.home', { name: name }) : E.t('care.rescue.progress', { n: res.visits }))
              : res.treat && !res.counted ? E.t('care.treatMax', { name: name }) : res.fav ? E.t('care.fav', { name: name }) : E.t('care.fed', { name: name });
            if (visit && res.home) { sound(E, SOUND.home); S.tab = 'home'; }
            S.msg[id] = end; say(end); toast(E, end);
            if (ov.isConnected) paint((visit ? 'visit:' : 'feed:') + id + ':');
          });
        });
      }
      /* leave for another sheet: the Corner closes, and resolves once that sheet has closed too */
      function leave(open) { S.after = Promise.resolve().then(open); ov._close(); }
      var on = {
        tab: function (id, v) { S.tab = v; S.tray = null; paint('tab:' + v); },
        feed: function (id) { toggle('feed', id); },
        visit: function (id) { toggle('visit', id); },
        food: function (id, v) { feed(id, v, !!(S.tray && S.tray.kind === 'visit')); },
        pat: function (id) { cheer('pat', id); },
        play: function (id) { cheer('play', id); },
        dress: function (id) { toggle('dress', id); },
        acc: function (id, v) { sound(E, SOUND.wear); act(function (u) { return E.C.equipAccessory(u, id, v); }); },
        gear: function () { leave(function () { return E.ctx.openGear(); }); },
        rename: function (id) { toggle('rename', id); },
        name: function (id) {
          var inp = panel.querySelector('[data-name="' + id + '"]'), val = inp ? inp.value : '', v = E.C.validatePetName(val);
          if (!v.ok) { S.msg[id] = v.reason; paint('name:' + id + ':'); return; }
          act(function (u) { return E.C.renamePet(u, id, val); }, function (res) {
            if (res && res.ok) { S.tray = null; S.msg[id] = E.t('crew.named', { name: res.name }); say(S.msg[id]); toast(E, S.msg[id]); } else S.msg[id] = (res && res.reason) || '';
          });
        },
        runner: function (id) { act(function (u) { return E.C.setActivePet(u, id); }); },
        toHotel: function (id) { act(function (u) { return E.P.toHotel(u, id, E.now()); }, function (res) { S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        toHome: function (id) { act(function (u) { return E.P.toHome(u, id, E.now()); }, function (res) { S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        swap: function (id) { toggle('swap', id); },
        swapWith: function (id, v) { act(function (u) { return E.P.swap(u, v, id, E.now()); }, function (res) { if (res && res.ok) S.tray = null; S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        pick: function () { picker(E.ctx).then(function () { if (ov.isConnected) paint('pick::'); }); },
        shop: function (id, v) { leave(function () { return E.ctx.openShop(v ? { filter: 'adopt', id: v } : { filter: 'food' }); }); },
        memories: function () { leave(function () { return E.ctx.openMemories(); }); }
      };
      paint();
      /* opened on one pet (a day card's Feed or Visit, Dress): its block comes into view, focus on its first food, the
         piece it wears (else its first piece) when its wear tray is open, else its first button */
      if (o.petId) E.later(function () {
        var b = panel.querySelector('[data-pet="' + o.petId + '"]'), f = b && (Array.prototype.filter.call(b.querySelectorAll('[data-a="food"]'), function (x) { return !x.getAttribute('aria-disabled'); })[0] ||
          b.querySelector('[data-a="acc"][aria-pressed="true"]') || b.querySelector('[data-a="acc"]') || b.querySelector('[data-a]'));
        try { if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start' }); if (f) f.focus(); } catch (e) { /* ignore */ }
      }, 60);
    });
  }

  /* ---------------- the panels (pure markup) ---------------- */
  function msgOf(S, id) { return S.msg[id] ? '<p class="slw-pcc-msg">' + esc(S.msg[id]) + '</p>' : ''; }
  function head(E, p) {
    var badge = p.where === 'home' && (p.level === 'hungry' || p.level === 'warn' || p.level === 'last') ? care2d('badge', 'hungry') : p.where === 'home' && p.level === 'peckish' ? care2d('badge', 'peckish') : '';
    var d = E.P.dietOf(p.id), fav = d.fav ? foodOf(E, d.fav) : null;
    return '<div class="slw-pcc-top"><div class="slw-pcc-pic" data-pic="' + esc(p.id) + '">' + petPic(E, p.id) + '</div><div class="slw-pcc-info">' +
      '<h3 class="slw-pcc-name">' + esc(p.name) + (p.runner ? ' <span class="slw-pcc-medal" role="img" aria-label="' + esc(E.t('crew.runner')) + '">🏅</span>' : '') + '</h3>' +
      '<p class="slw-pcc-sp">' + (badge ? '<span class="slw-pcc-badge">' + badge + '</span>' : '') + esc(species(E, p.id)) + '</p>' +
      (fav ? '<p class="slw-pcc-fav"><span class="slw-pcc-fi" aria-hidden="true">' + foodIcon(fav.id) + '</span>' + esc(E.t('care.shop.loves', { food: fav.name })) + '</p>' : '') + '</div></div>';
  }
  function trayHtml(E, S, p, kind) {
    if (!S.tray || S.tray.id !== p.id || S.tray.kind !== kind) return '';
    var id = p.id;
    if (kind === 'feed' || kind === 'visit') {
      /* a full pet: said once above the tiles, not on every meal (treats are still a snack) */
      var tiles = foodTiles(E.ctx, id), full = tiles.some(function (f) { return f.code === 'full'; });
      /* what the pantry holds or ran out of (the rest are in the Pet Shop); what can be given now comes first */
      tiles = tiles.filter(function (f) { return f.had; });
      tiles = tiles.filter(function (f) { return f.ok; }).concat(tiles.filter(function (f) { return !f.ok; }));
      /* a pantry that never held food (a merged save): say what to get, never an empty box */
      var cheap = tiles.length ? null : cheapestMeal(E, id);
      return '<div class="slw-pcc-tray">' + (full ? line(esc(E.t('care.full', { name: p.name })), 'slw-pcc-note') : '') +
        (cheap ? line(esc(E.t('care.none', { food: inSentence(cheap.name) })), 'slw-pcc-note') : '') +
        '<div class="slw-pcc-foods" role="group" aria-label="' + esc(E.t('care.pantry')) + '">' + tiles.map(function (f) {
          var why = f.code === 'full' ? '' : whyText(E, f.why);
          return '<button type="button" class="slw-pcc-food' + (f.ok ? '' : ' off') + (f.fav ? ' fav' : '') + '" data-a="food" data-id="' + esc(id) + '" data-v="' + f.id + '" data-fk="food:' + esc(id) + ':' + f.id + '"' +
            (f.ok ? '' : ' aria-disabled="true"') + '><span class="slw-pcc-fi" aria-hidden="true">' + foodIcon(f.id) + '</span><span class="slw-pcc-fnm">' + esc(f.name) +
            (f.fav ? ' <span class="slw-pcc-heart" aria-hidden="true">♥</span>' : '') + '</span><span class="slw-pcc-n">× ' + f.n + '</span>' + (why ? '<span class="slw-pcc-why">' + esc(why) + '</span>' : '') + '</button>';
        }).join('') + '</div>' + (E.ctx.openShop ? '<div class="slw-pcc-btns">' + btn('shop', E.t('care.welcome.shop')) + '</div>' : '') + '</div>';
    }
    if (kind === 'dress') {
      var SH = SHOP(), rows = SH ? SH.wearTray(E.C, E.w(), id).filter(function (r) { return r.items.length; }) : [];
      if (!rows.length) return E.ctx.openGear ? '<div class="slw-pcc-tray"><div class="slw-pcc-btns">' + btn('gear', E.t('wardrobe.more')) + '</div></div>' : '';
      /* W5b.1's wear tray (KU28): a row per slot, the worn piece pressed in */
      return '<div class="slw-pcc-tray"><div class="slw-wearslots" role="group" aria-label="' + esc(E.t('crew.wear') + ': ' + p.name) + '">' + rows.map(function (r) {
        return '<div class="slw-wearrow"><span class="lb">' + esc(E.t(r.labelKey)) + '</span><div class="slw-tray" role="group" aria-label="' + esc(E.t(r.labelKey)) + '">' + r.items.map(function (a) {
          return '<button type="button" class="slw-trayitem' + (a.on ? ' on' : '') + '" data-a="acc" data-id="' + esc(id) + '" data-v="' + a.id + '" data-fk="acc:' + esc(id) + ':' + a.id + '" aria-pressed="' + a.on + '">' +
            '<span class="pv">' + portrait(E, a.id) + '</span><span>' + esc(E.C.item(a.id).name) + (a.on ? ' ✓' : '') + '</span></button>';
        }).join('') + '</div></div>';
      }).join('') + '</div>' + (E.ctx.openGear ? '<div class="slw-pcc-btns">' + btn('gear', E.t('wardrobe.more')) + '</div>' : '') + '</div>';
    }
    if (kind === 'rename') {
      return '<div class="slw-pcc-tray slw-pcc-rename"><input data-name="' + esc(id) + '" data-fk="name:' + esc(id) + ':" maxlength="14" value="' + esc(p.name) +
        '" aria-label="' + esc(E.t('care.rename') + ': ' + p.name) + '">' + btn('name', E.t('care.rename'), { id: id, cls: 'on' }) + '</div>';
    }
    if (kind === 'swap') {
      return '<div class="slw-pcc-tray"><div class="slw-pcc-pick" role="group" aria-label="' + esc(E.t('care.hotel.swap')) + '">' + E.status().pets.filter(function (h) { return h.where === 'home'; }).map(function (h) {
        return '<button type="button" class="slw-pcc-pet" data-a="swapWith" data-id="' + esc(id) + '" data-v="' + esc(h.id) + '" data-fk="swapWith:' + esc(id) + ':' + esc(h.id) + '"><span class="slw-pcc-pic">' +
          petPic(E, h.id) + '</span><span class="slw-pcc-pnm">' + esc(h.name) + '</span></button>';
      }).join('') + '</div></div>';
    }
    return '';
  }
  function open(S, id, k) { return !!(S.tray && S.tray.id === id && S.tray.kind === k); }
  /* a home card (U5): the portrait in its outfit, name, species, runner medal, both rows, Feed · Pat · Play,
     then Dress (W5b.1's wear tray) · Rename · Make runner · Move to the Pet Hotel (only while the Hotel is open) */
  /* Feed is the sun button only while the pet wants a meal (peckish or hungrier, SLPetCare.ALERT_LV ≥ 1): a fed
     or full pet's Feed is a plain button, so the bright one always means 'this pet is hungry' */
  var WANTS = { peckish: 1, hungry: 1, warn: 1, last: 1 };
  function wantsMeal(E, p) { var A = E.P && E.P.ALERT_LV; return A && own(A, p.level) ? A[p.level] >= 1 : own(WANTS, p.level); }
  function petCard(E, S, p, room) {
    var id = p.id;
    var care = btn('feed', E.t('care.feed'), { id: id, cls: 'slw-pcc-do slw-pcc-feed' + (wantsMeal(E, p) ? ' slw-pcc-due' : ''), expanded: open(S, id, 'feed') }) +
      btn('pat', E.t('care.pat'), { id: id, cls: 'slw-pcc-do' }) + btn('play', E.t('care.play'), { id: id, cls: 'slw-pcc-do' });
    var more = btn('dress', E.t('care.dress'), { id: id, expanded: open(S, id, 'dress') }) + btn('rename', E.t('care.rename'), { id: id, expanded: open(S, id, 'rename') }) +
      (p.runner ? '' : btn('runner', E.t('care.makeRunner'), { id: id })) + (room.hotelOpen ? btn('toHotel', E.t('care.hotel.toHotel'), { id: id }) : '');
    return '<section class="slw-pcc-card" data-pet="' + esc(id) + '">' + head(E, p) + meters(E, p) + '<div class="slw-pcc-acts">' + care + '</div>' +
      msgOf(S, id) + trayHtml(E, S, p, 'feed') + '<div class="slw-pcc-more">' + more + '</div>' + trayHtml(E, S, p, 'dress') + trayHtml(E, S, p, 'rename') + '</section>';
  }
  var PANELS = {
    home: function (E, S, st, room) {
      var sit = st.sitter ? line(esc(st.sitterUntil ? E.t('care.sitterUntil', { date: dayWords(st.sitterUntil) }) : E.t('care.sitter')), 'slw-pcc-sitter') : '';
      return sit + line(esc(E.t('care.promise')), 'slw-pcc-note') + '<div class="slw-pcc-list">' +
        st.pets.filter(function (p) { return p.where === 'home'; }).map(function (p) { return petCard(E, S, p, room); }).join('') + '</div>';
    },
    pantry: function (E, S, st) {
      var meals = 0, K = E.C.CARE, trial = E.trial();
      st.pantry.forEach(function (f) { if (f.group !== 'treat') meals += f.n; });
      var full = trial ? null : st.pantry.filter(function (f) { return f.n >= K.pantryMax; })[0];
      return (trial ? line(esc(E.t('care.trialPantry', { n: K.trialPantryMax })), 'slw-pcc-note') : '') +
        (full ? line(esc(E.t('care.pantryFull', { food: inSentence(foodName(E, full.id)) })), 'slw-pcc-note') : '') +
        '<ul class="slw-pcc-foods slw-pcc-shelf" aria-label="' + esc(E.t('care.pantry')) + '">' + st.pantry.map(function (f) {
          return '<li class="slw-pcc-food' + (f.n ? '' : ' off') + '"><span class="slw-pcc-fi" aria-hidden="true">' + foodIcon(f.id) + '</span><span class="slw-pcc-fnm">' + esc(foodName(E, f.id)) +
            '</span><span class="slw-pcc-n">× ' + f.n + '</span></li>';
        }).join('') + '</ul>' + (E.ctx.openShop ? '<div class="slw-pcc-btns">' + btn('shop', E.t('care.welcome.shop'), { cls: meals ? 'big' : 'big on' }) + '</div>' : '');
    },
    hotel: function (E, S, st) {
      var home = st.pets.filter(function (p) { return p.where === 'home' || p.where === 'rescue'; }).length, room = home < E.C.CARE.homeMax;
      var guests = st.pets.filter(function (p) { return p.where === 'hotel'; });
      return '<div class="slw-pcc-art" aria-hidden="true">' + care2d('header', 'hotel') + '</div>' + line(esc(E.t('care.hotel.sub')), 'slw-pcc-note') +
        (guests.length ? '<div class="slw-pcc-btns">' + btn('pick', E.t('care.pick.title')) + '</div>' : '') + '<div class="slw-pcc-list">' +
        guests.map(function (p) {
          var id = p.id, acts = (room ? btn('toHome', E.t('care.hotel.toHome'), { id: id, cls: 'slw-pcc-do' }) : btn('swap', E.t('care.hotel.swap'), { id: id, cls: 'slw-pcc-do', expanded: open(S, id, 'swap') })) +
            btn('dress', E.t('care.dress'), { id: id, expanded: open(S, id, 'dress') }) + btn('rename', E.t('care.rename'), { id: id, expanded: open(S, id, 'rename') });
          return '<section class="slw-pcc-card slw-pcc-guest" data-pet="' + esc(id) + '">' + head(E, p) + '<div class="slw-pcc-more">' + acts + '</div>' + msgOf(S, id) +
            trayHtml(E, S, p, 'swap') + trayHtml(E, S, p, 'dress') + trayHtml(E, S, p, 'rename') + '</section>';
        }).join('') + '</div>';
    },
    rescue: function (E, S, st) {
      var K = E.C.CARE;
      /* what the Rescue is and how a pet comes home, as the Hotel says what it is (care.hotel.sub); then the farewell rule */
      return '<div class="slw-pcc-art" aria-hidden="true">' + care2d('header', 'rescue') + '</div>' +
        (E.has('care.rescue.sub') ? line(esc(E.t('care.rescue.sub', { n: K.rescueVisits })), 'slw-pcc-note') : '') +
        (st.farewell ? line(esc(E.t('care.rescue.rule', { n: K.starAfter })), 'slw-pcc-rule') : '') +
        '<div class="slw-pcc-list">' + st.pets.filter(function (p) { return p.where === 'rescue' && p.rescue; }).map(function (p) {
          var r = p.rescue, id = p.id, prog = E.t('care.rescue.progress', { n: r.visits });
          /* before today's visit only the count shows (its 'Come back on another day' is for after one) */
          var shown = r.visitedToday || prog.indexOf('. ') < 0 ? prog : prog.slice(0, prog.indexOf('. ') + 1);
          var soon = st.farewell && r.starIn != null && r.starIn <= K.starAfter - K.starWarn ? line(esc(starSoon(E, p.name, r.starIn)), 'slw-pcc-soon') : '';
          return '<section class="slw-pcc-card slw-pcc-basket" data-pet="' + esc(id) + '">' + head(E, p) + line(esc(shown), 'slw-pcc-visits') + soon +
            (p.runner ? line(esc(E.t('care.rescue.games', { name: p.name }))) : '') + '<div class="slw-pcc-acts">' +
            btn('visit', E.t('care.rescue.visit', { name: p.name }), { id: id, cls: 'slw-pcc-do slw-pcc-feed' + (r.visitedToday ? '' : ' slw-pcc-due'), off: r.visitedToday, expanded: open(S, id, 'visit') }) + '</div>' +
            msgOf(S, id) + trayHtml(E, S, p, 'visit') + '</section>';
        }).join('') + '</div>';
    },
    memories: function (E, S, st, room, mem) {
      return '<div class="slw-pcc-art" aria-hidden="true">' + care2d('header', 'memories') + '</div><div class="slw-pcc-list">' + mem.slice().reverse().map(function (m, i) {
        var again = !m.returned && room.canAdopt && E.ctx.openShop && E.C.petWhere(E.w(), m.id) === 'star';
        return '<section class="slw-pcc-card slw-pcc-memory"><div class="slw-pcc-mem" aria-hidden="true">' + care2d('memory', m.id, { acc: m.acc || {} }) + '</div><div class="slw-pcc-info">' +
          '<h3 class="slw-pcc-name">' + esc(m.name) + '</h3><p class="slw-pcc-sp">' + esc(species(E, m.id)) + '</p>' +
          line(esc(E.t('care.memory.days', { n: m.days }))) + (m.returned ? line(esc(E.t('care.star.back', { name: m.name }))) : '') + '</div>' +
          (again ? '<div class="slw-pcc-more">' + btn('shop', E.t(againKey(E, species(E, m.id)), { species: inSentence(species(E, m.id)) }), { v: m.id, fk: 'again:' + i }) + '</div>' : '') + '</section>';
      }).join('') + '</div>';
    }
  };
  /* one home card's markup (pets.json's cardFor), for a host that draws a single pet */
  function cardFor(ctx, id) {
    var E = env(ctx), st = E.status(), p = st && st.pets.filter(function (x) { return x.id === id; })[0];
    return p ? petCard(E, { msg: {}, tray: null }, p, E.room()) : '';
  }

  /* ================================================================
     THE FEEDING STRIP (U6, U13; P22)
     The sheet slides down to a strip with the tummy row while the island plays the moment. When the
     stage cannot (the pet is not out on the island being shown, the Rescue, a play without stagePlay,
     or no stage) the strip plays the 2D moment on the portrait. A tap or Esc skips to the end.
     ================================================================ */
  function feedingStrip(ctx, petId, foodId, o) {
    o = o || {};
    var E = env(ctx), kind = o.kind || 'feed', res = o.res || {}, red = E.reduced(), doc = E.doc();
    var st = E.status(), p = st && st.pets.filter(function (x) { return x.id === petId; })[0];
    if (!p) return Promise.resolve(false);
    var it = foodId ? E.C.item(foodId) : null, group = it ? it.group : 'biscuits';
    /* the row it fills: the tummy for a meal; the hearts for a treat, a Rescue visit and a play */
    var hearts = kind !== 'feed' || !!res.treat, to = hearts ? p.happy : p.food, from = Math.max(0, to - (res.counted === false ? 0 : 1));
    var word = hearts ? happyWord(E, p) : tummyWord(E, p);
    var meter = function (n) { return hearts ? care2d('hearts', n, { max: 4 }) : care2d('tummy', n, { group: p.fav || 'biscuits' }); };
    var ov = o.ov, mine = !ov;
    if (mine) { ov = doc.createElement('div'); ov.className = 'slw-ov slw-pcc-ov'; ov.setAttribute('data-sl-modal', '1'); doc.body.appendChild(ov); }
    /* the strip sits in a full-screen catcher inside the sheet's overlay: a tap anywhere skips, and never
       reaches the overlay's own scrim (which would close the Pet Corner) */
    var wrap = doc.createElement('div');
    wrap.className = 'slw-pcc-stripwrap';
    wrap.innerHTML = '<div class="slw-pcc-stripbar" role="status"><div class="slw-pcc-scene" aria-hidden="true"></div><div class="slw-pcc-sinfo"><b>' + esc(p.name) +
      '</b><span class="slw-pcc-sm" aria-hidden="true">' + meter(red ? to : from) + '</span><span class="slw-pcc-sw">' + (red ? esc(word) : '') + '</span></div></div>';
    ov.classList.add('slw-pcc-strip');
    ov.appendChild(wrap);
    var scene = wrap.querySelector('.slw-pcc-scene'), sm = wrap.querySelector('.slw-pcc-sm'), sw = wrap.querySelector('.slw-pcc-sw'), timers = [], uncovered = false;
    function at(ms, fn) { timers.push(E.later(fn, ms)); }
    /* the row fills and its word changes together */
    function fill() { if (sm) sm.innerHTML = meter(to); if (sw) sw.textContent = word; }
    /* the 2D moment on the portrait (U13): the bowl, three bits 0.15 s apart, three nods at 1.5 Hz while the bowl
       empties in four steps, the meter fills, two hearts rise over 1 s. Reduced motion: the end state. → its ms */
    function play2d() {
      var bits = '', i;
      for (i = 0; i < 3; i++) bits += '<span class="slw-pcc-bit" style="animation-delay:' + (i * MOMENT.bit) + 'ms">' + care2d('bit', group, i) + '</span>';
      scene.className = 'slw-pcc-scene ' + (red ? 'still' : 'go') + (kind === 'play' ? ' play' : '');
      scene.innerHTML = '<span class="slw-pcc-pic slw-pcc-eat">' + petPic(E, petId) + '</span>' +
        (kind === 'play' ? '' : '<span class="slw-pcc-bowl">' + care2d('bowl', { group: group, pile: red ? 0 : 4 }) + '</span>' + (red ? '' : '<span class="slw-pcc-bits">' + bits + '</span>')) +
        '<span class="slw-pcc-love">' + care2d('hearts', 1, { max: 1 }) + care2d('hearts', 1, { max: 1 }) + '</span>';
      photo(E, scene);
      if (red) { fill(); scene.classList.add('love'); return MOMENT.reduced; }
      var bowlEl = scene.querySelector('.slw-pcc-bowl');
      if (bowlEl) [3, 2, 1, 0].forEach(function (n, k) { at(MOMENT.nods + k * MOMENT.pile, function () { bowlEl.innerHTML = care2d('bowl', { group: group, pile: n }); }); });
      at(MOMENT.hearts, function () { fill(); scene.classList.add('love'); });
      return MOMENT.end;
    }
    var stage = kind === 'visit' ? null : kind === 'play' ? E.ctx.stagePlay(petId, { reduced: red })
      : typeof E.ctx.stageFeed === 'function' ? E.ctx.stageFeed(petId, foodId, { fav: !!res.fav, reduced: red }) : s3(E, 'feed', petId, foodId, { fav: !!res.fav, reduced: red });
    return new Promise(function (resolve) {
      var done = false, keys = doc.defaultView || doc;
      function finish() {
        if (done) return;
        done = true;
        timers.forEach(function (h) { E.unlater(h); });
        keys.removeEventListener('keydown', onKey, true);
        wrap.remove();
        ov.classList.remove('slw-pcc-strip'); ov.classList.remove('slw-pcc-see');
        if (uncovered) cover(E, +1);
        if (mine) ov.remove();
        resolve(true);
      }
      /* first in line (capture): Esc skips the moment and never also closes the sheet under it */
      function onKey(e) {
        if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        finish();
      }
      keys.addEventListener('keydown', onKey, true);
      wrap.addEventListener('click', finish);
      if (stage && typeof stage.then === 'function') {
        /* the island plays it: the scrim clears and the island renders under the strip until the stage answers */
        ov.classList.add('slw-pcc-see'); cover(E, -1); uncovered = true;
        if (red) fill(); else at(MOMENT.hearts - 600, fill);
        at(MOMENT.guard, finish);
        stage.then(function (ok) {
          if (done) return;
          if (ok !== false) return finish();
          /* not on the island being shown: the 2D moment on the portrait instead */
          timers.forEach(function (h) { E.unlater(h); }); timers = [];
          ov.classList.remove('slw-pcc-see'); cover(E, +1); uncovered = false;
          if (sm && !red) { sm.innerHTML = meter(from); sw.textContent = ''; }
          at(play2d(), finish);
        }, finish);
      } else at(play2d(), finish);
    });
  }

  function openFeed(ctx, petId) { return openCorner(ctx, { petId: petId, feed: true }); }
  function openHotel(ctx) { return openCorner(ctx, { tab: 'hotel' }); }
  function openRescue(ctx) { return openCorner(ctx, { tab: 'rescue' }); }

  return {
    VERSION: 1, TABS: TABS, TAB_KEY: TAB_KEY, FOOD_KEY: FOOD_KEY, SOUND: SOUND, MOMENT: MOMENT,
    ready: ready, tabsOf: tabsOf, newsVM: newsVM, dayVM: dayVM, foodTiles: foodTiles,
    newsCard: newsCard, welcome: newsCard, picker: picker, openPicker: picker, ruleCard: ruleCard, dayCard: dayCard, dayToast: dayToast,
    openCorner: openCorner, openFeed: openFeed, openHotel: openHotel, openRescue: openRescue, cardFor: cardFor, feedingStrip: feedingStrip
  };
}));
