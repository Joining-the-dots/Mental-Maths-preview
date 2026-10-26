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
                   'adopt' | 'home', news, id}; openMemories() P3.2's Memory Book; openGear() the Island
                   Shop's pet clothes (Home's Pets shelf); goLearn() back to the learning games. A missing
                   one hides its button.
     document, setTimeout, clearTimeout, clock (→ ms, the scrim's arming; default Date.now)  test seams

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
     openCorner(ctx, {petId, tab, feed, visit, dress, fk}) → Promise   My pets (the 🐾 button; wave 3 §8: ONE list,
                   no tabs): '{n} of 3 pets' ('{n} of 3 at home' with cap 'home'), the sitter, the promise,
                   then the groups At home (always) · At the Pet Hotel (only with guests) · Safe at the
                   Pet Rescue (only with a pet there; 'At the Pet Rescue' while the farewell switch is on),
                   then the footer: 'Pantry: {n} meals' and Adopt a pet · Pet food · Pet clothes · Memory
                   Book (each only when it can work). tab (contract 7, the options are unchanged) scrolls to
                   that group; 'pantry' opens the Pet Shop's food instead; 'memories' (a star, or a host
                   without the Memory Book sheet) shows the memories as a group at the end. With a petId
                   and no tab it scrolls to that pet where it is (C.petWhere); feed opens its food tray (a
                   visit's at the Rescue), dress its wear tray; fk (R2) focuses that footer button. A trip
                   from here to the Pet Shop or the Memory Book comes back here when that sheet closes (R2:
                   on a pet adopted meanwhile, else the pet whose tray went shopping, its tray open again)
     openFeed(ctx, petId) · openHotel(ctx) · openRescue(ctx) · openPicker = picker · welcome = newsCard
     feedingStrip(ctx, petId, foodId, {res, kind, ov}) → Promise   the sheet slides down to a strip with
                   the tummy row while the stage plays the moment; a false stage → the 2D moment on the
                   portrait (pets U13: bowl, three bits, nods at 1.5 Hz, two hearts); a tap or Esc skips;
                   reduced motion shows the end state
     cardFor(ctx, id) → the home card's HTML · ready(ctx)
     view-models (pure): groupsOf(status) · capLine(ctx) · newsVM(ctx) · dayVM(ctx, events) ·
                   foodTiles(ctx, petId) · GROUPS · GROUP_KEY · FOOD_KEY · MOMENT
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

  /* My pets' groups, in order (wave 3 §8), and their headings: the Rescue's says 'Safe' only while the grown-up's
     farewell switch is off (KU40: with it on, 'At the Pet Rescue'); 'memories' is the fallback group (no Memory Book
     sheet, or a star asked for) */
  var GROUPS = ['home', 'hotel', 'rescue'];
  var GROUP_KEY = { home: 'care.shop.atHome', hotel: 'care.shop.atHotel', rescue: 'care.shop.atRescueSafe', rescueFarewell: 'care.shop.atRescue', memories: 'care.memories' };
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
  /* the island's money (F-KU5): what a thing costs and what the child has, in the wallet the core pays with (🪙 since
     the two wallets); a core without wallets: ⭐ as before */
  function coinsOn(E) { return typeof E.C.walletOf === 'function' && E.C.walletOf() === 'coins'; }
  function priceIn(E, it) { var p = it && typeof E.C.priceOf === 'function' ? E.C.priceOf(it) : null; return typeof p === 'number' && isFinite(p) ? p : it ? it.price : 0; }
  function balIn(E, u) { return !u ? 0 : typeof E.C.walletBalance === 'function' ? E.C.walletBalance(u) : (u.points | 0); }
  /* F-KU4's free basic meal (SLPetCare.basicMeal): may this pet have it now, in the shop's own {trial}? A read; false
     without it (an older pet-care.js) */
  function basicOk(E, petId) {
    var P = E.P, u = E.u();
    if (!P || typeof P.basicMeal !== 'function' || !P.BASIC || !u) return false;
    try { var r = P.basicMeal(u, petId, E.day(), { trial: E.trial() }); return !!(r && r.ok); } catch (e) { return false; }
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
  /* the Memory Book's button: its gold memory star on a night plate (the small white badge reads as a plus at 20 px) */
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
      (o.expanded != null ? ' aria-expanded="' + !!o.expanded + '"' : '') + (o.describedby ? ' aria-describedby="' + esc(o.describedby) + '"' : '') +
      (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.off ? ' disabled' : '') + '>' + (o.icon || '') + esc(label) + '</button>';
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
  /* My pets' groups (wave 3 §8): At home always; the Pet Hotel only while it has guests (either cap mode: with 'home'
     a pet still checks in from its card's 'Move to the Pet Hotel'); the Rescue only while a pet is there */
  function groupsOf(status) {
    var n = function (where) { return status.pets.filter(function (p) { return p.where === where; }).length; };
    var out = [{ key: 'home', n: n('home') }];
    if (n('hotel') > 0) out.push({ key: 'hotel', n: n('hotel') });
    if (n('rescue') > 0) out.push({ key: 'rescue', n: n('rescue') });
    return out;
  }
  /* the list's first line: '{n} of 3 pets' (cap 'total', C.petRoom's count; an old save above the cap 'Full: you have
     {n} pets'), '{n} of 3 at home' with cap 'home' (a pet at the Rescue keeps its home spot) */
  function capLine(ctx) {
    var E = env(ctx), room = E.room(), st = E.status();
    if (room.mode === 'home') return E.t('care.pick.count', { n: st.pets.filter(function (p) { return p.where === 'home' || p.where === 'rescue'; }).length });
    return room.count > room.max && E.has('care.shop.capKeep') ? E.t('care.shop.capKeep', { n: room.count }) : E.t('care.shop.capFull', { n: room.count });
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
    /* R2 (QA2B-3): the count is said once. A line that already says where the others live (the Pet Hotel: capKeep
       above the cap, 'home's cap line) is the cap's whole news, so care.ownFull is not said again after it */
    var hotel = vm.lines.some(function (l) { return l.key === 'care.welcome.capKeep' || l.key === 'care.welcome.cap'; });
    vm.ownFull = vm.canAdopt || hotel ? null : { key: 'care.ownFull', vars: { n: room.count } };
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
    /* nothing in the pantry this pet eats: the way to earn the 🪙 (F-KU5; never in test mode), else the Pet Shop */
    if (!mealFor(E, ev.id)) {
      var cheap = cheapestMeal(E, ev.id), u = E.u(), need = cheap ? priceIn(E, cheap) - balIn(E, u) : 0;
      var shop = typeof ctx.openShop === 'function' ? { a: 'shop', key: 'care.welcome.shop' } : null;
      var learn = typeof ctx.goLearn === 'function' ? { a: 'learn', key: 'care.goLearn' } : null;
      if (!E.trial() && cheap && need > 0) {
        vm.learn = { key: coinsOn(E) ? 'care.noCoins' : 'care.noPoints', vars: { n: need, food: inSentence(cheap.name) } };
        vm.main = learn || shop || vm.main;
      } else vm.main = shop || vm.main;
      /* F-KU4's free basic meal: a hungry pet is always looked after, with no money at all (James, 24 Oct 2026). The
         card's main button opens the tray that has it; earning more stays the second button */
      if (basicOk(E, ev.id)) {
        vm.basic = true;
        vm.lines.push({ key: 'care.basic.line', vars: { name: vm.name } });
        if (vm.main && vm.main.a !== 'feed' && vm.main.a !== 'visit' && !vm.more) vm.more = vm.main;
        vm.main = visit ? { a: 'visit', key: 'care.rescue.visit', vars: { name: vm.name } } : { a: 'feed', key: 'care.feed' };
      }
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
    list.sort(function (a, b) { return (priceIn(E, a) - priceIn(E, b)) || (a.price - b.price); });   /* in 🪙 (F-KU5) */
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
  /* R2 (QA2D-2): the scrim closes a sheet only for a tap that began on the scrim after the sheet was up. A click whose
     pointerdown came before the sheet was made (the tap that opened it, or one under way when the island-open queue put
     it up) or within ARM ms of it does nothing, as the host's overlay() arms its own. A once-only card (o.once: 'News
     from the Pet Shop', the farewell rule card) never closes from the scrim: its own buttons, ✕ or Esc answer it and
     mark it seen. On the host's overlay a guard on the document (capture: first in line on every engine) stops the
     scrim clicks the sheet must not take before the overlay's own listener sees them. ctx.clock() → ms is a test seam
     (default Date.now; ctx.now is the island's clock) */
  var ARM = 400;
  function clock(E) { var c = E.ctx.clock; return typeof c === 'function' ? c() : Date.now(); }
  function downTypes() { return typeof root.PointerEvent === 'function' ? ['pointerdown'] : ['mousedown', 'touchstart']; }
  function armScrim(E, ov, once) {
    var made = clock(E), down = null;
    downTypes().forEach(function (t) { ov.addEventListener(t, function (e) { down = { at: clock(E), scrim: e.target === ov }; }, true); });
    return function (e) { var d = down; down = null; return !once && !!d && d.scrim && e.target === ov && d.at - made >= ARM; };
  }
  function guardScrim(E, ov, armed) {
    var doc = E.doc(), off = false;
    function onClick(e) {
      if (off) return;
      if (!ov.isConnected) { stop(); return; }
      if (e.target !== ov || ov.classList.contains('slw-pcc-strip') || armed(e)) return;
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    function stop() { if (!off) { off = true; doc.removeEventListener('click', onClick, true); } }
    doc.addEventListener('click', onClick, true);
    return stop;
  }
  /* one sheet: the host's overlay when there is one, else the same markup here (KU28: the island's sheets) */
  function sheet(E, inner, o) {
    o = o || {};
    var ctx = E.ctx, cls = 'slw-pcc-ov' + (o.cls ? ' ' + o.cls : '');
    if (typeof ctx.overlay === 'function') {
      var unguard = null;
      var hov = ctx.overlay(inner, { cls: cls, small: !!o.small, onClose: function () { if (unguard) unguard(); if (o.onClose) o.onClose(); } });
      if (hov) { unguard = guardScrim(E, hov, armScrim(E, hov, !!o.once)); return hov; }
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
      /* back to the opener without moving the page, as the host's overlay does (c-island) */
      try { if (opener && opener !== doc.body && opener.isConnected && opener.focus) opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    doc.addEventListener('keydown', onKey);
    var armed = armScrim(E, ov, !!o.once);
    ov.addEventListener('click', function (e) { if (e.target === ov && !ov.classList.contains('slw-pcc-strip') && armed(e)) close(); });
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
        (btns ? '<div class="slw-pcc-btns">' + btns + '</div>' : '') + '</div>', { small: true, cls: o.cls, once: !!o.once, onClose: function () { resolve(picked); } });
      photo(E, ov);
      bind(ov, { go: function (id, a) { picked = a; ov._close(); } });
    });
  }

  /* ---------------- 'News from the Pet Shop' (U1, KU13) ---------------- */
  function newsCard(ctx) {
    if (!ready(ctx)) return Promise.resolve({ started: false, go: null });
    /* R2 (QA2B-3): with more than 3 pets 'Who lives at home?' comes first (by design), so its button says so */
    var E = env(ctx), vm = newsVM(ctx), buttons = [{ a: 'corner', label: E.t(vm.pick ? 'care.pick.title' : 'care.welcome.corner') }];
    if (vm.shop && typeof ctx.openShop === 'function') buttons.push({ a: 'shop', label: E.t('care.welcome.shop') });
    var lines = vm.lines.map(function (l) { return E.t(l.key, l.vars); });
    if (vm.ownFull) lines.push(E.t(vm.ownFull.key, vm.ownFull.vars));
    var art = '<span class="slw-pcc-bowl">' + care2d('bowl', { group: 'biscuits', pile: 4 }) + '</span><span class="slw-pcc-bag">' + foodIcon('food_biscuits') + '</span>';
    /* once-only (R2): its buttons, ✕ or Esc start care; a tap on the scrim never does */
    return card(E, { title: E.t('care.welcome.title'), lines: lines, buttons: buttons, art: art, cls: 'slw-pcc-news', once: true }).then(function (go) {
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
    /* once-only (R2): marked seen by its buttons, ✕ or Esc; a tap on the scrim never closes it */
    return card(E, { title: E.t('care.rule.title'), lines: [E.t('care.rule.body', { n: E.C.CARE.starAfter })], buttons: buttons, art: care2d('header', 'rescue'), cls: 'slw-pcc-rulecard', once: true })
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
     MY PETS (U5–U7, U9–U11; wave 3 §8: one list, no tabs)
     ================================================================ */
  /* where the list opens (contract 7: openCorner's options are unchanged, a tab now names a place in the list):
     a named group is scrolled to; 'pantry' is the footer; 'memories' shows the memories as the last group. Opened on
     one pet with no tab (the Pet Shop's 'My pets' button, a toast, the hungry reminder, the next-step card): the
     group where that pet really is (C.petWhere; a star's memory), and the tray that fits it there: feeding at home is
     a visit at the Rescue, a Hotel guest needs no meal, Dress opens where the pet can be dressed */
  var GROUP_OF = { home: 'home', hotel: 'hotel', rescue: 'rescue', star: 'memories', memories: 'memories', pantry: 'pantry' };
  function startOf(E, o) {
    var where = o.petId ? E.C.petWhere(E.w(), o.petId) : null, kind = null;
    var group = o.tab ? (own(GROUP_OF, o.tab) ? GROUP_OF[o.tab] : 'home') : own(GROUP_OF, where) ? GROUP_OF[where] : 'home';
    if (o.petId && (o.feed || o.visit)) kind = where === 'rescue' ? 'visit' : where === 'hotel' || where === 'star' ? null : o.feed ? 'feed' : 'visit';
    else if (o.petId && o.dress && (where === 'home' || where === 'hotel')) kind = 'dress';
    return { group: group, mem: group === 'memories', tray: kind ? { kind: kind, id: o.petId } : null };
  }
  function openCorner(ctx, o) {
    o = o || {};
    if (!ready(ctx)) return Promise.resolve(false);
    var E = env(ctx);
    if (!E.status().started) return newsCard(ctx).then(function () { return true; });
    /* the Pantry is the Pet Shop's food now (wave 3 §8: no Pantry tab; the list's footer counts the meals) */
    if (o.tab === 'pantry' && typeof ctx.openShop === 'function') return Promise.resolve(ctx.openShop({ filter: 'food' })).then(function () { return true; }, function () { return true; });
    return new Promise(function (resolve) {
      var first = startOf(E, o);
      var S = { uid: 'slwPcc' + (++seq), mem: first.mem, tray: first.tray, msg: {}, busy: false, after: null };
      var ov = sheet(E, '<h2>' + esc(E.t('care.corner.title')) + '</h2><div class="slw-pcc-panel"></div>' +
        '<div class="slw-vh slw-pcc-live" role="status" aria-live="polite"></div>', {
        cls: 'slw-pcc',
        /* a sheet the list opened (the Pet Shop, the pet clothes, the Memory Book) closes first */
        onClose: function () { if (S.after) S.after.then(function () { resolve(true); }, function () { resolve(true); }); else resolve(true); }
      });
      var panel = ov.querySelector('.slw-pcc-panel');
      function say(text) { var r = ov.querySelector('.slw-pcc-live'); if (r) { r.textContent = ''; r.textContent = text; } }
      function paint(fk) {
        var st = E.status(), room = E.room(), mem = E.P.memories(E.w()), keep = fk || focusKey(E);
        if (!mem.length) S.mem = false;
        panel.innerHTML = listHtml(E, S, st, room, mem);
        photo(E, panel);
        bind(panel, on);
        panel.querySelectorAll('[data-name]').forEach(function (inp) {
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); on.name(inp.getAttribute('data-name')); } });
        });
        refocus(ov, keep);
      }
      /* a place in the list into view (under the sheet's sticky header: scroll-margin-top in pet-care.css), focus on
         its first button */
      function show(el, focusEl) {
        try { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); if (focusEl) focusEl.focus(); } catch (e) { /* ignore */ }
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
        var day = E.day(), ms = E.now(), name = petName(E, id), basic = !!E.P.BASIC && food === E.P.BASIC, o = { trial: E.trial() };
        return act(function (u) { return visit ? E.P.rescueVisit(u, id, food, day, ms, o) : E.P.feed(u, id, food, day, ms, o); }, function (res) {
          if (!res || !res.ok) {
            S.msg[id] = own(FOOD_KEY, res && res.code) ? E.t(FOOD_KEY[res.code], { name: name, food: inSentence(foodName(E, food)), fav: '' }) : refusal(E, res);
            return;
          }
          S.tray = null; S.msg[id] = '';
        }).then(function (res) {
          if (!res || !res.ok) return;
          sound(E, SOUND.feed);
          /* the free basic meal has no food of its own: the moment shows a plain bowl (no food id) */
          return feedingStrip(E.ctx, id, basic ? null : food, { res: res, kind: visit ? 'visit' : 'feed', ov: ov }).then(function () {
            var end = visit ? (res.home ? E.t('care.rescue.home', { name: name }) : E.t('care.rescue.progress', { n: res.visits }))
              : basic ? E.t('care.basic.done', { name: name })
              : res.treat && !res.counted ? E.t('care.treatMax', { name: name }) : res.fav ? E.t('care.fav', { name: name }) : E.t('care.fed', { name: name });
            var home = visit && res.home;
            if (home) sound(E, SOUND.home);
            /* R2 (QA2A-11): one message — the line on the pet's card while My pets is up; the island's toast only once it
               has closed (it used to say 'Biscuit’s favourite!' twice at once) */
            S.msg[id] = end; say(end);
            if (!ov.isConnected) { toast(E, end); return; }
            /* home from the Rescue: its card is now in At home, and focus goes with it */
            paint((visit && !home ? 'visit:' : 'feed:') + id + ':');
            if (home) show(panel.querySelector('[data-pet="' + id + '"]'), null);
          });
        });
      }
      /* leave for another sheet: the Corner closes, and resolves once that sheet has closed too. R2 (QA2A-9): with back,
         a trip to the Pet Shop or the Memory Book comes back to My pets when that sheet closes (comeBack) */
      function leave(open, back) {
        if (back) { back.crew = living(E); back.who = (E.u() || {}).name; back.at = Date.now(); }
        S.after = Promise.resolve().then(open);
        if (back) S.after = S.after.then(function () { return comeBack(E, back); }, function () { return comeBack(E, back); });
        ov._close();
      }
      var on = {
        feed: function (id) { toggle('feed', id); },
        visit: function (id) { toggle('visit', id); },
        food: function (id, v) { feed(id, v, !!(S.tray && S.tray.kind === 'visit')); },
        basic: function (id) { feed(id, E.P.BASIC, !!(S.tray && S.tray.kind === 'visit')); },
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
            /* one message (R2): the card's line, the toast only if My pets has closed meanwhile */
            if (res && res.ok) { S.tray = null; S.msg[id] = E.t('crew.named', { name: res.name }); say(S.msg[id]); if (!ov.isConnected) toast(E, S.msg[id]); } else S.msg[id] = (res && res.reason) || '';
          });
        },
        runner: function (id) { act(function (u) { return E.C.setActivePet(u, id); }); },
        toHotel: function (id) { act(function (u) { return E.P.toHotel(u, id, E.now()); }, function (res) { S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        toHome: function (id) { act(function (u) { return E.P.toHome(u, id, E.now()); }, function (res) { S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        swap: function (id) { toggle('swap', id); },
        swapWith: function (id, v) { act(function (u) { return E.P.swap(u, v, id, E.now()); }, function (res) { if (res && res.ok) S.tray = null; S.msg[id] = res && res.ok ? '' : refusal(E, res); }); },
        pick: function () { picker(E.ctx).then(function () { if (ov.isConnected) paint('pick::'); }); },
        /* the tray's 'Visit the Pet Shop' (its pet: back on it with its tray open) and the footer's 'Pet food': the food;
           a memory's 'Adopt a {species} again' */
        shop: function (id, v) {
          var back = v ? { fk: 'foot:memories' } : id ? { petId: id } : { fk: 'foot:food' };
          leave(function () { return E.ctx.openShop(v ? { filter: 'adopt', id: v } : { filter: 'food' }); }, back);
        },
        /* 'Adopt a pet': the pets the child can adopt now, else the Home Pet Shop (its short cards say how to earn more) */
        adopt: function () { var f = adoptable(E) ? 'adopt' : 'home'; leave(function () { return E.ctx.openShop({ filter: f }); }, { fk: 'foot:adopt' }); },
        /* 'Memory Book': its own sheet (P3.2); a host without it shows the memories here, as the last group */
        memories: function () {
          if (typeof E.ctx.openMemories === 'function') { leave(function () { return E.ctx.openMemories(); }, { fk: 'foot:memories' }); return; }
          S.mem = !S.mem; paint('foot:memories');
          if (S.mem) show(panel.querySelector('[data-g="memories"]'), null);
        }
      };
      paint();
      /* opened on one pet (a day card's Feed or Visit, Dress): its block comes into view, focus on its first food, the
         piece it wears (else its first piece) when its wear tray is open, else its first button; opened on a group
         (contract 7's tab): that group comes into view, focus on its first button */
      E.later(function () {
        var b = o.petId ? panel.querySelector('[data-pet="' + o.petId + '"]') : null;
        var g = panel.querySelector(first.group === 'pantry' ? '.slw-pcc-foot' : '[data-g="' + first.group + '"]');
        /* the pet, unless a named group it is not in wins (as a named tab did): its group's heading comes into view first
           (it says where the pet is: seen in the browser, a Hotel guest's card alone hid 'At the Pet Hotel'), then the
           card itself if it is still out of sight */
        if (b && (!o.tab || !g || g.contains(b))) {
          var pg = groupEl(b);
          if (pg && pg.getAttribute('data-g') !== 'home') show(pg, null);
          if (!inSight(ov, b)) show(b, null);
          show(null, b.querySelector('[data-a="basic"]') || Array.prototype.filter.call(b.querySelectorAll('[data-a="food"]'), function (x) { return !x.getAttribute('aria-disabled'); })[0] ||
            b.querySelector('[data-a="acc"][aria-pressed="true"]') || b.querySelector('[data-a="acc"]') || b.querySelector('[data-a]'));
          return;
        }
        /* back from the Pet Shop or the Memory Book (R2): the footer button that went there */
        var fb = o.fk ? panel.querySelector('[data-fk="' + o.fk + '"]') : null;
        if (fb) { show(fb, fb); return; }
        /* At home is the top of the list: nothing to scroll */
        if (g && first.group !== 'home') show(g, g.querySelector('[data-a]'));
      }, 60);
    });
  }
  /* R2 (QA2A-9): back to My pets when the Pet Shop (or the Memory Book) it opened has closed: on a pet adopted meanwhile,
     else on the pet whose food tray went shopping, its tray open again (feed: a visit's tray at the Rescue, startOf), else
     the list with focus on the footer button that went. 'New' is a pet that is with the child now and was not when the
     trip began: one adopted, or a star adopted again from its memory (the same id, back from the stars). Not when
     anything else is up by then (My pets opened from the shop, the Island Shop standing in offline, a card, a
     celebration), when the island is not on screen (a learn trip: the host closed every sheet and went to Learn), when a
     learn trip began since, or for another child */
  function comeBack(E, back) {
    var doc = E.doc(), u = E.u();
    if (!u || u.name !== back.who || !ready(E.ctx)) return null;
    if (doc.querySelector('.slw-ov, .slw-cele')) return null;
    var v = doc.getElementById ? doc.getElementById('worldView') : null;
    if (v && v.classList && v.classList.contains('hidden')) return null;
    var trip = root.slLearnTrip;
    if (trip && typeof trip.at === 'number' && trip.at >= back.at) return null;
    var fresh = living(E).filter(function (id) { return back.crew.indexOf(id) < 0; })[0];
    if (fresh) return openCorner(E.ctx, { petId: fresh });
    if (back.petId) return openCorner(E.ctx, { petId: back.petId, feed: true });
    return openCorner(E.ctx, { fk: back.fk });
  }
  /* the pets with the child (home, the Pet Hotel, the Pet Rescue): every crew pet but the stars */
  function living(E) {
    var w = E.w();
    return E.C.crewList(w).filter(function (p) { return E.C.petWhere(w, p.id) !== 'star'; }).map(function (p) { return p.id; });
  }
  /* the list group an element is in (a walk up: older engines have no closest()) */
  function groupEl(el) { for (var n = el; n && n.getAttribute; n = n.parentNode) if (n.getAttribute('data-g')) return n; return null; }
  /* is the whole element inside the sheet's scrolled view, below its sticky header? (no layout: yes) */
  function inSight(ov, el) {
    try {
      var sc = ov.querySelector('.slw-sheet'), hd = ov.querySelector('.slw-sheethd');
      if (!sc || !sc.getBoundingClientRect || !el.getBoundingClientRect) return true;
      var s = sc.getBoundingClientRect(), r = el.getBoundingClientRect(), top = s.top + (hd && hd.offsetHeight ? hd.offsetHeight : 0);
      return r.top >= top - 1 && (r.bottom <= s.bottom + 1 || r.height > s.bottom - top);
    } catch (e) { return true; }
  }
  /* can the child adopt a pet right now (the Pet Shop's 'I can adopt now' would not be empty)? A read */
  function adoptable(E) {
    var SH = SHOP(), u = E.u();
    if (!SH || typeof SH.petShop !== 'function' || !u) return false;
    try { return SH.petShop(E.C, u, { filter: 'adopt', trial: E.trial() }).some(function (g) { return g.items && g.items.length; }); } catch (e) { return false; }
  }

  /* ---------------- the list (pure markup) ---------------- */
  function msgOf(S, id) { return S.msg[id] ? '<p class="slw-pcc-msg">' + esc(S.msg[id]) + '</p>' : ''; }
  /* a pet's head: its name is an h4 under its group's h3 (the sheet's h2 is 'My pets') */
  function head(E, p) {
    var badge = p.where === 'home' && (p.level === 'hungry' || p.level === 'warn' || p.level === 'last') ? care2d('badge', 'hungry') : p.where === 'home' && p.level === 'peckish' ? care2d('badge', 'peckish') : '';
    var d = E.P.dietOf(p.id), fav = d.fav ? foodOf(E, d.fav) : null;
    return '<div class="slw-pcc-top"><div class="slw-pcc-pic" data-pic="' + esc(p.id) + '">' + petPic(E, p.id) + '</div><div class="slw-pcc-info">' +
      '<h4 class="slw-pcc-name">' + esc(p.name) + (p.runner ? ' <span class="slw-pcc-medal" role="img" aria-label="' + esc(E.t('crew.runner')) + '">🏅</span>' : '') + '</h4>' +
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
      /* F-KU4's free basic meal (F-KU5): nothing here this pet eats and nothing the child can get now, so a plain meal,
         once an island day (the core's rule), kindly offered first; a visit at the Rescue takes it too */
      var basic = basicOk(E, id) ? line(esc(E.t('care.basic.line', { name: p.name })), 'slw-pcc-note slw-pcc-basicline') + '<div class="slw-pcc-btns slw-pcc-basic">' +
        btn('basic', '🥣 ' + E.t(kind === 'visit' ? 'care.basic.visit' : 'care.basic.button'), { id: id, cls: 'slw-buy slw-pcc-do', fk: 'basic:' + id }) + '</div>' : '';
      /* R2 (QA2A-11): a pet that can eat now is told what to do, as a full one is told why not */
      var pick = !full && tiles.some(function (f) { return f.ok; }) && E.has('care.pickFood') ? line(esc(E.t('care.pickFood', { name: p.name })), 'slw-pcc-note slw-pcc-pickline') : '';
      return '<div class="slw-pcc-tray">' + (full ? line(esc(E.t('care.full', { name: p.name })), 'slw-pcc-note') : '') +
        (cheap ? line(esc(E.t('care.none', { food: inSentence(cheap.name) })), 'slw-pcc-note') : '') + basic + pick +
        '<div class="slw-pcc-foods" role="group" aria-label="' + esc(E.t('care.pantry')) + '">' + tiles.map(function (f) {
          var why = f.code === 'full' ? '' : whyText(E, f.why);
          return '<button type="button" class="slw-pcc-food' + (f.ok ? '' : ' off') + (f.fav ? ' fav' : '') + '" data-a="food" data-id="' + esc(id) + '" data-v="' + f.id + '" data-fk="food:' + esc(id) + ':' + f.id + '"' +
            (f.ok ? '' : ' aria-disabled="true"') + '><span class="slw-pcc-fi" aria-hidden="true">' + foodIcon(f.id) + '</span><span class="slw-pcc-fnm">' + esc(f.name) +
            (f.fav ? ' <span class="slw-pcc-heart" aria-hidden="true">♥</span>' : '') + '</span><span class="slw-pcc-n">× ' + f.n + '</span>' + (why ? '<span class="slw-pcc-why">' + esc(why) + '</span>' : '') + '</button>';
        }).join('') + '</div>' + (E.ctx.openShop ? '<div class="slw-pcc-btns">' + btn('shop', E.t('care.welcome.shop'), { id: id }) + '</div>' : '') + '</div>';
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
     then Dress (W5b.1's wear tray) · Rename · Make my runner · Move to the Pet Hotel (only while the Hotel is open) */
  /* Feed is the sun button only while the pet wants a meal (peckish or hungrier, SLPetCare.ALERT_LV ≥ 1); a fed or
     full pet's Feed is a quiet one (KU-QA 12: a just-adopted pet is full, and its first Feed used to look like the thing
     to do), so the bright one always means 'this pet is hungry'. It still opens the tray (a treat is still a snack) */
  var WANTS = { peckish: 1, hungry: 1, warn: 1, last: 1 };
  function wantsMeal(E, p) { var A = E.P && E.P.ALERT_LV; return A && own(A, p.level) ? A[p.level] >= 1 : own(WANTS, p.level); }
  /* o.hint: this card carries the one line that says what a runner is (KU-QA 12: under the first 'Make my runner';
     every 'Make my runner' button points at it with aria-describedby) */
  function petCard(E, S, p, room, o) {
    o = o || {};
    var id = p.id, want = wantsMeal(E, p), hintId = (S.uid || 'slwPcc') + 'Run';
    var care = btn('feed', E.t('care.feed'), { id: id, cls: 'slw-pcc-do slw-pcc-feed' + (want ? ' slw-pcc-due' : ' slw-pcc-quiet'), expanded: open(S, id, 'feed') }) +
      btn('pat', E.t('care.pat'), { id: id, cls: 'slw-pcc-do' }) + btn('play', E.t('care.play'), { id: id, cls: 'slw-pcc-do' });
    var more = btn('dress', E.t('care.dress'), { id: id, expanded: open(S, id, 'dress') }) + btn('rename', E.t('care.rename'), { id: id, expanded: open(S, id, 'rename') }) +
      (p.runner ? '' : btn('runner', E.t('care.makeRunner'), { id: id, describedby: S.hasHint ? hintId : null })) + (room.hotelOpen ? btn('toHotel', E.t('care.hotel.toHotel'), { id: id }) : '');
    var hint = o.hint ? '<p class="slw-pcc-hint" id="' + hintId + '">' + esc(E.t('crew.runner')) + '</p>' : '';
    return '<section class="slw-pcc-card" data-pet="' + esc(id) + '">' + head(E, p) + meters(E, p) + '<div class="slw-pcc-acts">' + care + '</div>' +
      msgOf(S, id) + trayHtml(E, S, p, 'feed') + '<div class="slw-pcc-more">' + more + '</div>' + hint + trayHtml(E, S, p, 'dress') + trayHtml(E, S, p, 'rename') + '</section>';
  }
  /* each group's heading: its words, how many pets are in it, and (Hotel, Rescue, memories) its little picture */
  function groupHtml(E, S, key, n, inner, farewell) {
    var title = E.t(key === 'rescue' && farewell ? GROUP_KEY.rescueFarewell : GROUP_KEY[key]), hid = (S.uid || 'slwPcc') + 'G' + key;
    var art = key === 'home' ? '' : '<span class="slw-pcc-gart" aria-hidden="true">' + care2d('header', key) + '</span>';
    return '<section class="slw-pcc-group" data-g="' + key + '" aria-labelledby="' + hid + '"><div class="slw-pcc-ghead">' + art +
      '<h3 class="slw-pcc-gh" id="' + hid + '">' + esc(title) + ' <span class="slw-pcc-gn">' + n + '</span></h3></div>' + inner + '</section>';
  }
  var GROUP_HTML = {
    home: function (E, S, st, room) {
      var pets = st.pets.filter(function (p) { return p.where === 'home'; }), hinted = false;
      S.hasHint = pets.some(function (p) { return !p.runner; });
      return '<div class="slw-pcc-list">' + pets.map(function (p) {
        var hint = !hinted && !p.runner;
        if (hint) hinted = true;
        return petCard(E, S, p, room, { hint: hint });
      }).join('') + '</div>';
    },
    hotel: function (E, S, st) {
      var home = st.pets.filter(function (p) { return p.where === 'home' || p.where === 'rescue'; }).length, room = home < E.C.CARE.homeMax;
      var guests = st.pets.filter(function (p) { return p.where === 'hotel'; });
      return line(esc(E.t('care.hotel.sub')), 'slw-pcc-note') + '<div class="slw-pcc-btns slw-pcc-gbtns">' + btn('pick', E.t('care.pick.title')) + '</div><div class="slw-pcc-list">' +
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
      return (E.has('care.rescue.sub') ? line(esc(E.t('care.rescue.sub', { n: K.rescueVisits })), 'slw-pcc-note') : '') +
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
    /* the fallback (a star asked for, or no Memory Book sheet): the memories, newest first */
    memories: function (E, S, st, room, mem) {
      return '<div class="slw-pcc-list">' + mem.slice().reverse().map(function (m, i) {
        var again = !m.returned && room.canAdopt && E.ctx.openShop && E.C.petWhere(E.w(), m.id) === 'star';
        return '<section class="slw-pcc-card slw-pcc-memory" data-memory="' + esc(m.id) + '"><div class="slw-pcc-mem" aria-hidden="true">' + care2d('memory', m.id, { acc: m.acc || {} }) + '</div><div class="slw-pcc-info">' +
          '<h4 class="slw-pcc-name">' + esc(m.name) + '</h4><p class="slw-pcc-sp">' + esc(species(E, m.id)) + '</p>' +
          line(esc(E.t('care.memory.days', { n: m.days }))) + (m.returned ? line(esc(E.t('care.star.back', { name: m.name }))) : '') + '</div>' +
          (again ? '<div class="slw-pcc-more">' + btn('shop', E.t(againKey(E, species(E, m.id)), { species: inSentence(species(E, m.id)) }), { v: m.id, fk: 'again:' + i }) + '</div>' : '') + '</section>';
      }).join('') + '</div>';
    }
  };
  /* the footer (wave 3 §8): what the pantry holds, then where to go for more. Adopt a pet only while the cap lets a
     pet come (C.petRoom.canAdopt); Pet food and Adopt need the Pet Shop, Pet clothes the Island Shop's pet clothes;
     Memory Book only once there is a memory */
  function footHtml(E, S, st, room, mem) {
    var c = E.ctx, meals = 0, b = '';
    st.pantry.forEach(function (f) { if (f.group !== 'treat') meals += f.n; });
    if (typeof c.openShop === 'function') {
      if (room.canAdopt) b += btn('adopt', E.t('care.adoptPet'), { fk: 'foot:adopt' });
      b += btn('shop', E.t('care.shop.food'), { fk: 'foot:food' });
    }
    if (typeof c.openGear === 'function') b += btn('gear', E.t('care.petClothes'), { fk: 'foot:gear' });
    if (mem.length) b += btn('memories', E.t('care.memories'), { fk: 'foot:memories', icon: starIcon(), expanded: typeof c.openMemories === 'function' ? null : !!S.mem });
    return '<div class="slw-pcc-foot"><p class="slw-pcc-pantry"><span class="slw-pcc-fi" aria-hidden="true">' + foodIcon('food_biscuits') + '</span>' +
      esc(E.t('care.pantryMeals', { n: meals })) + '</p>' + (b ? '<div class="slw-pcc-btns slw-pcc-fbtns">' + b + '</div>' : '') + '</div>';
  }
  /* the whole list: the cap line, the sitter, the promise, the groups, the footer */
  function listHtml(E, S, st, room, mem) {
    var sit = st.sitter ? line(esc(st.sitterUntil ? E.t('care.sitterUntil', { date: dayWords(st.sitterUntil) }) : E.t('care.sitter')), 'slw-pcc-sitter') : '';
    var top = line(esc(capLine(E.ctx)), 'slw-pcc-cap') + sit + line(esc(E.t('care.promise')), 'slw-pcc-note');
    var body = groupsOf(st).map(function (g) { return groupHtml(E, S, g.key, g.n, GROUP_HTML[g.key](E, S, st, room, mem), st.farewell); }).join('');
    if (S.mem && mem.length) body += groupHtml(E, S, 'memories', mem.length, GROUP_HTML.memories(E, S, st, room, mem), st.farewell);
    return top + body + footHtml(E, S, st, room, mem);
  }
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
    VERSION: 1, GROUPS: GROUPS, GROUP_KEY: GROUP_KEY, FOOD_KEY: FOOD_KEY, SOUND: SOUND, MOMENT: MOMENT,
    ready: ready, groupsOf: groupsOf, capLine: capLine, newsVM: newsVM, dayVM: dayVM, foodTiles: foodTiles,
    newsCard: newsCard, welcome: newsCard, picker: picker, openPicker: picker, ruleCard: ruleCard, dayCard: dayCard, dayToast: dayToast,
    openCorner: openCorner, openFeed: openFeed, openHotel: openHotel, openRescue: openRescue, cardFor: cardFor, feedingStrip: feedingStrip
  };
}));
