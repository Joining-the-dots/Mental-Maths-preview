/* ================================================================
   My Island v3, kids update — SLPetShopUI (P3.2): the Pet Shop, adopting and naming a pet,
   'Make room', the food aisle, the new player's adopt offer and the Memory Book.
   window.SLPetShopUI in the browser, module.exports in Node (tests/pet-shop-ui.test.js runs the
   view-models and the sheets on the tiny DOM of tests/helpers/shell-dom.js).
   plan-ku P3.2 (KU4, KU5, KU13, KU21, KU38, KU39), pets.json ui U2, U8, U11; the data is P2.7's
   SLIslandShop.petShop, the cap is C.petRoom (contracts.petCap: nothing here recomputes it).

   LOADING (KU21): the host loads this file on first use (the Pet Shop, the adopt offer, the news
   card's 'Visit the Pet Shop'); nothing here loads anything, adoptOffer included.

   EVERY WORD is a world-copy key (SLWorldCopy.t; KU19) or catalogue data (species, food and land
   names, descriptions, the pet's own name on the child's own device). The only other text is a
   refusal's reason from the core or SLPetCare, as every island sheet shows it.

   THE HOST'S deps (P4.1 builds them; P3.1's Pet Corner takes the same object). overlay and
   commit are required; every other field is optional:
     user          the profile {name, points, world}, or () → it (read afresh after every write)
     overlay(inner, {small, cls, onClose}) → the sheet's .slw-ov element with ._close (the host's
                   overlay: its ✕, Esc, focus in and back to the opener, cover)
     commit(fn)    → Promise<res>: fn(u) runs inside the host's C.transact ('Make room', a name)
     buy(id, {btn, err}) → Promise<res | bool>: the host's buyFlow for a pet or a food (the confirm
                   card at ECONOMY.confirmAt, test mode, the fixed tx, pendingTx) WITHOUT its pet
                   or food celebration, resolving a falsy value or {ok: false} when the child
                   says 'Not yet' or the purchase is refused (so 'Make room' can put its pet back).
                   It marks a new pet fresh (it walks out on Home) and redraws the island, as
                   afterPurchase does. Without buy, prices show and nothing is bought here.
     celebrate(o)  the host's celebration card {title, sub, icon}; toast(text) its toast
     fillPhotocards(el)  the host's photocard fill for [data-pc] in el (called group by group as
                   the shop scrolls: lazy photocards). A food is never given a data-pc (KU37).
     photocard     SLPhotocard (default window.SLPhotocard): the detail sheet's turntable
     use3D         bool | () → bool: photocards and the turntable; false on LOW and in 2D, where
                   every portrait is the 2D sprite. Default: SLPhotocard is there, SLIsland3D
                   .v3Scene is on and html is not .sl-low
     trial         bool | () → bool (default window.SL_WORLD_TRIAL === true): FREE prices
     reduced       bool | () → bool (default the media query): still turntable, no pops
     openCorner(petId?)  My pets (the Pet Corner, P3.1): its button on a pet the child has, and beside
                   care.ownFull. Absent → no such buttons.
     learnFor(id, {from: 'petShop'})  wave 3 (contract 5): a card the child cannot afford yet (real
                   prices, never in test mode) says how many 🪙 to earn and gets '📚 Learn' instead of a
                   greyed Adopt / price button; the host starts the learn-and-come-back trip for that id
                   and closes the sheets (a returned false keeps the shop open). Absent → no Learn button
                   (the greyed button as before).
     now() → ms (default Date.now) · sound(name) or sfx(name): an SLSound name ('pop' when a food
     lands in the pantry) · C (default SLWorldCore) · care (default SLPetCare, bound to C) · shop
     (default SLIslandShop) · document (a test seam)

   API
     openPetShop(deps, {filter, id, news}) → Promise   resolves when the shop closes. filter: 'all'
                   (the default) | 'food' | 'home' | a land | 'adopt' ('I can adopt now'); id: that
                   animal's card is scrolled to and focused (All when the filter would hide it);
                   news (the news card's 'Visit the Pet Shop') needs nothing more: the new species
                   carry a 'New' badge (isle.chipNew) wherever the child has none of them
     adopt(deps, petId, {btn, err}) → Promise<bool>   one adoption: 'Make room' first when home
                   is full (cap 'home' only, KU5), the care.adoptLimit question before the pet
                   that takes a child to 3 ('total'), the host's buy, the name step
                   (validatePetName), the host's celebration
     openMemories(deps, {petId}) → Promise   the Memory Book (U11): every memory card, newest
                   first; 'Adopt a {species} again' while that species is a star and can come
     adoptOffer(ctx) → Promise<'shop' | 'later' | null>   the new player's card in the island-open
                   queue (KU13, prio 30): 'Adopt a friend for {name}' opens the Pet Shop, 'Later'
                   closes; null (nothing shown) when the cap shuts adoption
     view-models (pure): shopView(deps, filter) · memoryView(deps) · FILTERS · CSS
   Nothing here reads or writes storage, sends anything, rolls a number or awards ⭐.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPetShopUI = api;
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
  function CP() { return sib('SLWorldCopy', './world-copy.js'); }
  function tx(key, vars) { var c = CP(); return c && typeof c.t === 'function' ? c.t(key, vars) : key; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n || 0).toLocaleString('en-GB'); }
  function val(v) { return typeof v === 'function' ? v() : v; }

  var VERSION = 1;
  var FILTERS = Object.freeze(['all', 'food', 'home', 'pier', 'jungle', 'treetop', 'castle', 'ice', 'adopt']);
  /* a pet's place → its card chip (status is words, never colour alone); the Rescue's chip says 'Safe at the Pet
     Rescue' only while the grown-up's farewell switch is off (KU40), else 'At the Pet Rescue' */
  var PLACE = { atHome: ['own', 'care.shop.atHome'], atHotel: ['rep', 'care.shop.atHotel'], atRescue: ['lock', 'care.shop.atRescue'] };
  function placeKey(E, state, U) {
    if (state !== 'atRescue') return PLACE[state][1];
    var cc = U && U.world && typeof E.C.careOf === 'function' ? E.C.careOf(U.world) : null, fw = !!(cc && cc.cfg && cc.cfg.farewell === true);
    return fw ? 'care.shop.atRescue' : 'care.shop.atRescueSafe';
  }

  /* ---------------- the deps, read once per call ---------------- */
  function env(deps) {
    deps = deps || {};
    var C = deps.C || sib('SLWorldCore', './world-core.js');
    var care = deps.care || null;
    if (!care) {
      var PC = sib('SLPetCare', './pet-care.js');
      care = PC && C && C !== sib('SLWorldCore', './world-core.js') && typeof PC.create === 'function' ? PC.create(C) : PC;
    }
    var doc = deps.document || root.document || null;
    var html = doc && doc.documentElement, A = deps.art || sib('SLWorldArt', './world-art.js', 'SLWorldArt');
    return {
      deps: deps, C: C, care: care && typeof care.ready === 'function' && care.ready() ? care : null,
      shop: deps.shop || sib('SLIslandShop', './island-shop.js'), art: A, pets: deps.artPets || sib('SLWorldArtPets', './world-art-pets.js'),
      doc: doc,
      user: function () { var u = val(deps.user); if (u === undefined && typeof root.ensureUser === 'function') { try { u = root.ensureUser(); } catch (e) { u = null; } } return u || null; },
      trial: function () { return own(deps, 'trial') ? !!val(deps.trial) : root.SL_WORLD_TRIAL === true; },
      reduced: function () {
        if (own(deps, 'reduced')) return !!val(deps.reduced);
        try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
      },
      use3D: function () {
        if (own(deps, 'use3D')) return !!val(deps.use3D);
        var I = root.SLIsland3D;
        return !!(root.SLPhotocard && I && I.v3Scene && !(html && html.classList && html.classList.contains('sl-low')));
      },
      now: function () { var n = typeof deps.now === 'function' ? deps.now() : Date.now(); return typeof n === 'number' && isFinite(n) ? n : Date.now(); },
      sfx: function (n) {
        try { if (typeof deps.sound === 'function') deps.sound(n); else if (typeof deps.sfx === 'function') deps.sfx(n); } catch (e) { /* sound is never needed */ }
      }
    };
  }
  /* what the shop reads: the balance and a one-level copy of the world (the core fills in what an
     old save lacks on the copy, never on the child's save) */
  function readCopy(E) {
    var u = E.user() || {}, w = u.world && typeof u.world === 'object' ? u.world : null, copyW = {};
    if (w) Object.keys(w).forEach(function (k) { copyW[k] = w[k]; });
    var U = { points: typeof u.points === 'number' ? u.points : 0, world: w ? copyW : null };
    E.C.ensureWorld(U);
    return U;
  }
  function roomOf(E) { var U = readCopy(E); return typeof E.C.petRoom === 'function' ? E.C.petRoom(U.world) : null; }
  function speciesName(E, id) { var it = E.C.item(id); return it ? it.name : ''; }
  function lower(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  /* the (re-voiced) description; a pet card's one-line fact is its first sentence */
  function descOf(E, id) { var c = CP(); return (c && typeof c.desc === 'function' && c.desc(id)) || (E.C.item(id) || {}).desc || ''; }
  function factOf(E, id) {
    var d = descOf(E, id), m = /^.*?[.!?](\s|$)/.exec(d);
    return (m ? m[0] : d).trim();
  }

  /* ---------------- pictures (2D sprites; a data-pc photocard only for a pet in 3D) ---------------- */
  function sprite(E, id, st) { var A = E.art; try { return A && typeof A.icon === 'function' ? A.icon(id, st || {}) || '' : ''; } catch (e) { return ''; } }
  function petPic(E, id, o) {
    o = o || {};
    if (!o.flat && E.use3D()) return '<span class="slw-pc" data-pc="' + esc(id) + '">' + sprite(E, id) + '</span>';
    return '<span class="slps-2d">' + sprite(E, id, o.st) + '</span>';
  }
  /* a food is always P2.6's 2D pictogram: never a data-pc, so no photocard is ever asked for (KU37) */
  function foodPic(E, id) {
    var P = E.pets, s = '';
    try { s = P && typeof P.foodIcon === 'function' ? P.foodIcon(id) : ''; } catch (e) { s = ''; }
    return '<span class="slps-food">' + (s || sprite(E, id)) + '</span>';
  }
  /* the island's money (F-KU5): a card made in 🪙 (island-shop's wallet: 'coins', since the two wallets) shows 🪙 and
     its shortfall in coins; a ⭐ card (a core that pays in stars) reads as before */
  function symOf(c) { return c && c.wallet === 'coins' ? '🪙' : '⭐'; }
  function money(c) { return symOf(c) + ' ' + fmt(c.price); }
  function needLine(c, n) { return tx(c && c.wallet === 'coins' ? 'char.cast.needCoins' : 'char.cast.need', { n: fmt(n) }); }
  function priceHtml(c) {
    return '<div class="pr">' + (c.free ? '<s>' + money(c) + '</s> <span class="slw-free">' + esc(tx('wardrobe.free')) + '</span>' : money(c)) + '</div>';
  }

  /* ================================================================
     THE VIEW-MODEL (pure: the shop's data, the cap and every card's words and action)
     ================================================================ */
  function chipsOf(E, f) {
    return FILTERS.filter(function (k) { return k === 'all' || k === 'food' || k === 'adopt' || own(E.C.ISLES, k); }).map(function (k) {
      var key = k === 'all' ? 'care.shop.all' : k === 'food' ? 'care.shop.food' : k === 'adopt' ? 'care.shop.canAdopt' : 'isle.short.' + k;
      return { f: k, label: tx(key), on: k === f };
    });
  }
  /* the kids update's new species (SLIslandLook.KU_IDS): a card's 'New' badge while the child has none */
  function isNew(id) { var L = sib('SLIslandLook', './world-look.js'); return !!(L && Array.isArray(L.KU_IDS) && L.KU_IDS.indexOf(id) >= 0); }
  function petCardVM(E, c, room, U) {
    var vm = { id: c.id, kind: 'pet', name: c.name, fact: factOf(E, c.id), price: c.price, free: c.free, state: c.state, wallet: c.wallet || null,
      readopt: !!c.readopt, chip: null, act: null, can: false, line: null, learn: false,
      fresh: (c.state === 'adopt' || c.state === 'ownFull' || c.state === 'homeFull' || c.state === 'locked') && !c.readopt && isNew(c.id) ? tx('isle.chipNew') : null,
      loves: c.favFood ? { id: c.favFood, text: tx('care.shop.loves', { food: speciesName(E, c.favFood) }) } : null };
    if (own(PLACE, c.state)) {
      vm.chip = { cls: PLACE[c.state][0], text: tx(placeKey(E, c.state, U || readCopy(E))) };
      vm.act = E.deps.openCorner ? 'corner' : null;
      vm.can = !!vm.act;
    } else if (c.state === 'ownFull') {
      /* 'total' at the cap: the card says so ('3 of 3 pets') and leads to My pets, never a Buy that cannot work. KU-QA 12:
         an animal the child does NOT have says why in words of its own ('You can have up to 3 pets.'), so it never reads
         like a pet the child owns ('At home' + My pets) */
      var n = room && typeof room.count === 'number' ? room.count : 0;
      vm.chip = { cls: 'rep', text: room && n > room.max ? tx('care.shop.capKeep', { n: n }) : tx('care.shop.capFull', { n: n }) };
      vm.line = tx('care.welcome.capTotal');
      vm.act = E.deps.openCorner ? 'corner' : null;
      vm.can = !!vm.act;
    } else if (c.state === 'locked') {
      var k = c.isle && own(E.C.ISLES, c.isle) ? c.isle : null;
      vm.chip = { cls: 'lock', text: tx('care.shop.unlock', { island: k ? tx('isle.short.' + k) : '' }) };
    } else if (c.state === 'homeFull' && room && room.mode === 'home') {
      vm.act = 'room';                                       /* 'Make room' (cap 'home' only, KU4) */
      vm.can = !!c.afford;
    } else if (c.state === 'adopt' && c.code !== 'not_for_sale') {
      vm.act = 'adopt';                                      /* (the free puppy is never for sale, even as a star) */
      vm.can = !!c.can;
    }
    /* 'total' at the cap ('ownFull'): the cap chip and the Pet Corner (above); the banner says why (care.ownFull) */
    if ((vm.act === 'adopt' || vm.act === 'room') && !vm.can && c.code === 'insufficient' && typeof c.need === 'number') {
      vm.line = needLine(c, c.need);
      vm.learn = learnOn(E, c.need);                         /* wave 3: '📚 Learn' beside the need line */
    }
    return vm;
  }
  /* wave 3 (contract 5): '📚 Learn' on a card the child is short for — only with the host's learnFor, real prices (in
     test mode nothing is short) and a real shortfall */
  function learnOn(E, need) { return typeof E.deps.learnFor === 'function' && !E.trial() && typeof need === 'number' && need > 0; }
  function foodCardVM(E, c, trialMax) {
    var vm = { id: c.id, kind: 'food', name: c.name, fact: descOf(E, c.id), price: c.price, free: c.free, have: c.have, state: c.state, wallet: c.wallet || null,
      act: 'buy', can: !!c.can, line: null, learn: false, pantry: tx('care.pantry') + ' · ' + c.have };
    if (c.state === 'full') vm.line = tx('care.pantryFull', { food: c.name });
    else if (c.state === 'short' && typeof c.need === 'number') {
      vm.line = tx(c.wallet === 'coins' ? 'care.noCoins' : 'care.noPoints', { n: fmt(c.need), food: c.name });
      vm.learn = learnOn(E, c.need);
    }
    /* test mode: a greyed 'Get it free' says why on the card (QA 24 Oct, item 8) */
    else if (c.state === 'trialFull') vm.line = tx('care.trialFull', { n: trialMax || ((E.C.CARE || {}).trialPantryMax) || 0 });
    return vm;
  }
  function shopView(deps, filter) {
    var E = env(deps), C = E.C, f = FILTERS.indexOf(filter) >= 0 ? filter : 'all';
    if (f !== 'all' && f !== 'food' && f !== 'adopt' && !own(C.ISLES, f)) f = 'all';
    var U = readCopy(E), room = typeof C.petRoom === 'function' ? C.petRoom(U.world) : null, trial = E.trial();
    var raw = E.shop && typeof E.shop.petShop === 'function' ? E.shop.petShop(C, U, { filter: f, trial: trial }) : [];
    var groups = raw.map(function (g) {
      if (g.key === 'food') {
        var meter = tx('care.pantry') + ' · ' + g.meals + (g.trialMax ? ' / ' + g.trialMax : '');
        var lines = g.lineKey ? [tx(g.lineKey, { n: g.trialMax })] : [];
        /* no meal the child can get now (F-KU4's free basic meal, F-KU5): a hungry pet is never left out, the Pet Corner has it */
        if (!trial && E.care && typeof E.care.basicMeal === 'function' && !g.items.some(function (c) { return c.group !== 'treat' && c.can; }) &&
            g.items.some(function (c) { return c.group !== 'treat' && c.state === 'short'; })) lines.push(tx('care.basic.shop'));
        return { key: 'food', kind: 'food', title: tx(g.labelKey), lines: lines, meter: meter,
          cards: g.items.map(function (c) { return foodCardVM(E, c, g.trialMax); }) };
      }
      var title = g.key === 'home' ? tx('care.shop.home') : g.name;
      return { key: g.key, kind: 'pets', title: title, locked: !g.owned, lines: g.owned ? [] : [tx('care.shop.unlock', { island: g.name })],
        cards: g.items.map(function (c) { return petCardVM(E, c, room, U); }) };
    });
    var banner = null;
    if (f === 'food') banner = null;                         /* the food aisle: the cap is not its news */
    else if (room && room.mode === 'home' && room.atCap) banner = { key: 'care.homeFull', text: tx('care.homeFull'), corner: false };
    else if (room && room.mode !== 'home' && !room.canAdopt) banner = { key: 'care.ownFull', text: tx('care.ownFull', { n: room.count }), corner: !!E.deps.openCorner };
    else if (room && room.mode !== 'home') banner = { key: 'care.welcome.capTotal', text: tx('care.welcome.capTotal'), corner: false };
    var empty = groups.length ? null : (banner && banner.key === 'care.ownFull' ? null : tx('char.cast.save'));
    return { filter: f, room: room, trial: trial, buy: typeof E.deps.buy === 'function', chips: chipsOf(E, f), banner: banner, groups: groups, empty: empty };
  }

  /* ---------------- the markup ---------------- */
  function cardHtml(E, c, buy) {
    var pet = c.kind === 'pet';
    var h = '<div class="slw-card slps-card" data-kind="' + c.kind + '" data-id="' + esc(c.id) + '" data-state="' + esc(c.state) + '">' +
      (pet ? '<button type="button" class="ic" data-a="open" data-id="' + esc(c.id) + '" aria-label="' + esc(c.name) + '">' + petPic(E, c.id) +
        (c.fresh ? '<span class="chip uni slps-new">' + esc(c.fresh) + '</span>' : '') + '</button>'
        : '<div class="ic">' + foodPic(E, c.id) + '</div>') +
      '<div class="nm">' + esc(c.name) + '</div>' + (c.fact ? '<div class="ds">' + esc(c.fact) + '</div>' : '');
    if (c.loves) h += '<div class="slps-loves">' + foodPic(E, c.loves.id) + '<span>' + esc(c.loves.text) + '</span></div>';
    /* the card's foot (its state, price, why and button) sits at the bottom, so a two-line name never pushes one
       card's price and button out of line with its row (QA 24 Oct, item 8) */
    h += '<div class="slps-foot">';
    if (c.kind === 'food') h += '<span class="chip rep slps-have">' + esc(c.pantry) + '</span>';
    if (c.chip) h += '<span class="chip ' + c.chip.cls + '">' + esc(c.chip.text) + '</span>';
    /* a short card's button is '📚 Learn', so its price shows on the card instead */
    var priceOnButton = c.act === 'buy' && !c.free && buy && !c.learn;
    if ((!c.chip || c.chip.cls === 'lock') && !priceOnButton) h += priceHtml(c);
    if (c.line) h += '<div class="slps-need' + (c.state === 'ownFull' ? ' slps-capline' : '') + '">' + esc(c.line) + '</div>';
    if (c.learn) return h + '<div class="row">' + learnBtn(c) + '</div><div class="slw-err" aria-live="polite"></div></div></div>';
    var label = c.act === 'adopt' ? tx('care.shop.adopt') : c.act === 'room' ? tx('care.makeRoom') : c.act === 'corner' ? tx('care.corner.title')
      : c.act === 'buy' ? (c.free ? tx('isle.unlockFree') : money(c)) : '';
    var needsBuy = c.act === 'adopt' || c.act === 'room' || c.act === 'buy';
    if (label && (!needsBuy || buy)) {
      h += '<div class="row"><button type="button" class="' + (c.act === 'corner' ? 'slw-btn' : 'slw-buy') + '" data-a="' + c.act + '" data-id="' + esc(c.id) + '"' +
        (c.act === 'buy' ? ' aria-label="' + esc(c.name + ' · ' + label) + '"' : '') + (c.can ? '' : ' disabled') + '>' + esc(label) + '</button></div>';
    }
    return h + '<div class="slw-err" aria-live="polite"></div></div></div>';
  }
  /* wave 3: '📚 Learn' (learn.go), named for its card ('Kitten · 📚 Learn'). Never the 'big' class: the detail sheet's
     picture box is .big (its sky fill would paint the button) */
  function learnBtn(c) {
    var label = tx('learn.go');
    return '<button type="button" class="slw-btn slw-learnbtn" data-a="learn" data-id="' + esc(c.id) + '" aria-label="' + esc(c.name + ' · ' + label) + '">' + esc(label) + '</button>';
  }
  function bodyHtml(E, vm) {
    var h = '';
    if (vm.banner) {
      h += '<div class="slps-banner" data-key="' + esc(vm.banner.key) + '"><span>' + esc(vm.banner.text) + '</span>' +
        (vm.banner.corner ? '<button type="button" class="slw-btn" data-a="corner">' + esc(tx('care.corner.title')) + '</button>' : '') + '</div>';
    }
    vm.groups.forEach(function (g) {
      h += '<section class="slps-group" data-g="' + esc(g.key) + '"><h3 class="slps-gh">' + esc(g.title) + '</h3>';
      if (g.meter) h += '<div class="slps-meter">' + esc(g.meter) + '</div>';
      g.lines.forEach(function (l) { h += '<p class="slps-line">' + esc(l) + '</p>'; });
      h += '<div class="slw-grid slps-grid">' + g.cards.map(function (c) { return cardHtml(E, c, vm.buy); }).join('') + '</div></section>';
    });
    if (vm.empty) h += '<p class="slps-line slps-empty">' + esc(vm.empty) + '</p>';
    return h;
  }
  function chipsHtml(vm) {
    return vm.chips.map(function (c) {
      return '<button type="button" class="slw-btn" data-f="' + c.f + '" aria-pressed="' + (c.on ? 'true' : 'false') + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  /* ---------------- the page's style (scoped: .slps-*; island-pixel's tokens when present) ---------------- */
  var CSS = [
    '.slps-ov .slw-sheet{max-width:880px;}',
    '.slps-chips{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:none;margin:6px 0 10px;padding:2px 2px 8px;position:sticky;top:calc(var(--slw-hdh, 0px) - 18px);z-index:2;background:var(--px-panel,#fff);}',
    '.slps-chips::-webkit-scrollbar{display:none;}',
    '.slps-chips .slw-btn{flex:0 0 auto;white-space:nowrap;}',
    '.slps-banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 12px;padding:10px 12px;background:var(--px-sign,#FFF4D6);border:2px solid var(--px-sun-lip,#C99A00);border-radius:10px;color:var(--px-ink,#1B2150);font-weight:700;font-size:15px;line-height:1.35;}',
    '.slps-banner span{flex:1 1 200px;min-width:0;}',
    '.slps-group{margin:0 0 18px;}',
    '.slps-gh{margin:14px 0 6px;font-size:19px;line-height:1.2;color:var(--px-ink,#1B2150);}',
    '.slps-line{margin:0 0 8px;font-weight:700;font-size:15px;line-height:1.35;color:var(--px-ink-2,#474E7E);}',
    '.slps-meter{display:inline-block;margin:0 0 8px;padding:3px 10px;background:var(--px-well,#EEF7FF);border:2px solid var(--px-ink-2,#474E7E);border-radius:6px;font-weight:800;font-size:14px;color:var(--px-ink,#1B2150);font-variant-numeric:tabular-nums;}',
    /* the skins' 3:4 shop card would widen a two-up phone card past its column: these cards size to their words */
    'html body .slps-ov .slps-grid > .slps-card{aspect-ratio:auto;min-width:0;}',
    '.slps-card .ic{height:112px;}',
    '.slps-card .ic svg{max-height:100px;}',
    '.slps-card .ds{min-height:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
    '.slps-card[data-kind="food"] .ds{-webkit-line-clamp:3;}',
    '.slps-food,.slps-2d{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}',
    '.slps-food svg{width:92px;height:92px;max-height:92px;}',
    '.slps-loves{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;line-height:1.25;color:var(--px-ink-2,#474E7E);}',
    '.slps-loves .slps-food{flex:none;width:24px;height:24px;}.slps-loves .slps-food svg{width:24px;height:24px;}',
    '.slps-need{font-size:13px;font-weight:700;line-height:1.3;color:var(--px-gold-ink,#8A5A00);}',
    /* KU-QA 12: the cap's own line on an animal the child does not have (ink, not the gold of a shortfall) */
    '.slps-need.slps-capline{color:var(--px-ink-2,#474E7E);}',
    /* wave 3: '📚 Learn' on a short card. Its colour is island-pixel.css's one .slw-learnbtn rule (the same violet
       block as on the Island Shop, the item sheet and the HUD); nothing here paints it (review W3-4: sun here meant
       a second colour for the same button, and sun is My pets' "this pet wants a meal") */
    '.slps-ov .slw-learnbtn{white-space:nowrap;}',
    '.slps-card .row .slw-buy,.slps-card .row .slw-btn{flex:1 1 auto;}',
    /* the foot at the card's bottom: every card in a row has its price and button on the same line */
    '.slps-foot{margin-top:auto;display:flex;flex-direction:column;gap:5px;min-width:0;}',
    '.slps-foot .chip{align-self:flex-start;}.slps-foot .row{margin-top:0;}',
    '.slps-card .slw-err:empty{display:none;}',
    '.slps-empty{margin-top:12px;}',
    '.slps-detail .big{min-height:220px;}',
    'html body .slps-ov .slps-detail .big .slps-2d svg{width:min(300px,100%);height:auto;max-height:250px;}',
    '.slps-detail .row{display:flex;}.slps-detail .row .slw-buy,.slps-detail .row .slw-btn{flex:1 1 auto;min-height:48px;font-size:17px;}',
    '.slps-card .ic{position:relative;}',
    'html body .slps-ov .slps-new{position:absolute;top:6px;left:6px;z-index:3;margin:0;pointer-events:none;}',
    '.slps-facts{margin:0;font-weight:700;font-size:15px;}',
    '.slps-desc{margin:0;font-size:15px;line-height:1.45;}',
    '.slps-name{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;}',
    '.slps-name .slps-namepic svg,.slps-name .slps-namepic img{width:190px;height:auto;}',
    '.slps-name input{width:min(260px,100%);min-height:48px;padding:6px 10px;font:inherit;font-size:22px;font-weight:700;text-align:center;}',
    '.slps-name .slw-err{min-height:20px;}',
    '.slps-room{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:8px 0;}',
    '.slps-room .slps-pet{display:flex;flex-direction:column;align-items:center;gap:2px;height:auto;padding:8px;text-align:center;}',
    '.slps-room .slps-pet svg{width:84px;height:auto;}',
    '.slps-pet .sp,.slps-pet .why{font-size:13px;font-weight:600;line-height:1.3;}',
    '.slps-pet .why{color:var(--px-gold-ink,#8A5A00);}',
    '.slps-offer{text-align:center;}',
    /* the child's pet on top, the new friends in a row under it */
    '.slps-offer .slps-pics{display:flex;flex-direction:column;align-items:center;margin:0 0 8px;}',
    '.slps-offer .slps-pics svg{display:block;height:auto;}.slps-offer .slps-pics .lead svg{width:136px;}',
    '.slps-offer .slps-friends{display:flex;justify-content:center;align-items:flex-end;gap:4px;width:100%;}',
    '.slps-offer .slps-friends > span{flex:0 1 84px;min-width:0;}.slps-offer .slps-friends svg{width:100%;}',
    '.slps-limit .slps-pics > .lead svg{width:170px;}',
    '.slps-offer p{margin:0 0 12px;font-weight:700;font-size:15px;line-height:1.4;}',
    '.slps-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;}',
    '.slps-memhead{display:flex;justify-content:center;margin:0 0 4px;}.slps-memhead svg{width:min(240px,70%);height:auto;}',
    '.slps-mem h2{text-align:center;}',
    '.slps-memgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}',
    '.slps-memcard{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px;text-align:center;border:3px solid var(--px-line,#2B3A80);border-radius:10px;background:var(--px-panel,#fff);}',
    '.slps-memcard:focus{outline:3px solid var(--px-ink,#1B2150);outline-offset:2px;}',
    '.slps-memcard svg{width:100%;max-width:170px;height:auto;}',
    '.slps-memcard h3{margin:2px 0 0;font-size:18px;}.slps-memcard .sp,.slps-memcard .days{font-size:14px;font-weight:700;color:var(--px-ink-2,#474E7E);}',
    '@media (max-width:600px),(orientation:landscape) and (max-height:540px){html body .slps-ov .slw-sheet .slps-chips{top:calc(var(--slw-hdh, 0px) - 18px);}}',
    '@media (max-width:600px){',
    'html body .slps-ov .slps-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
    '.slps-card .ic{height:96px;}.slps-card .ic svg{max-height:88px;}.slps-food svg{width:80px;height:80px;max-height:80px;}',
    '.slps-room{grid-template-columns:repeat(2,minmax(0,1fr));}',
    '.slps-memgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
    '}',
    '@media (prefers-reduced-motion:no-preference){.slps-card.slps-got .slps-have{animation:slpsGot .42s ease-out 1;}}',
    '@keyframes slpsGot{0%{transform:scale(1);}45%{transform:scale(1.18);}100%{transform:scale(1);}}'
  ].join('');
  function injectCss(E) {
    var d = E.doc;
    if (!d || !d.head || d.getElementById('slpsCss')) return;
    var s = d.createElement('style');
    s.id = 'slpsCss';
    s.textContent = CSS;
    d.head.appendChild(s);
  }
  function sheet(E, inner, o) {
    injectCss(E);
    return E.deps.overlay(inner, o || {});
  }
  function q(el, sel) { return el && typeof el.querySelector === 'function' ? el.querySelector(sel) : null; }
  function qa(el, sel) { return el && typeof el.querySelectorAll === 'function' ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; }
  /* each button gets its own listener after a draw (no event delegation) */
  function bind(el, sel, fn) { qa(el, sel).forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) fn(b); }); }); }
  function okOf(res) { return res === true || !!(res && res.ok); }

  /* ================================================================
     THE PET SHOP
     ================================================================ */
  function openPetShop(deps, opts) {
    var E = env(deps), f = opts && opts.filter;
    if (!E.C || typeof E.deps.overlay !== 'function' || !E.shop) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var ov = sheet(E, '<h2>' + esc(tx('care.shop.title')) + '</h2><div class="slw-cats slps-chips" role="group" aria-label="' + esc(tx('care.shop.title')) + '"></div><div class="slps-body"></div>',
        { cls: 'slps-ov', onClose: function () { stopLazy(); resolve(true); } });
      var chipsEl = q(ov, '.slps-chips'), body = q(ov, '.slps-body'), filter = FILTERS.indexOf(f) >= 0 ? f : 'all', io = null, busy = false;
      function stopLazy() { if (io) { try { io.disconnect(); } catch (e) { /* gone */ } io = null; } }
      /* lazy photocards: each group is filled as it scrolls into view (none on LOW or in 2D; never the food) */
      function lazy() {
        stopLazy();
        if (!E.use3D() || typeof E.deps.fillPhotocards !== 'function') return;
        var groups = qa(body, '.slps-group').filter(function (g) { return g.getAttribute('data-g') !== 'food'; });
        var fill = function (g) { try { E.deps.fillPhotocards(g); } catch (e) { /* the 2D sprite stays */ } };
        if (typeof root.IntersectionObserver !== 'function') { groups.forEach(fill); return; }
        io = new root.IntersectionObserver(function (ents) {
          ents.forEach(function (en) { if (en.isIntersecting) { if (io) io.unobserve(en.target); fill(en.target); } });
        }, { root: q(ov, '.slw-sheet'), rootMargin: '160px 0px' });
        groups.forEach(function (g) { io.observe(g); });
      }
      function draw(focusSel) {
        var vm = shopView(deps, filter), sc = q(ov, '.slw-sheet'), top = sc ? sc.scrollTop : 0;
        filter = vm.filter;
        chipsEl.innerHTML = chipsHtml(vm);
        body.innerHTML = bodyHtml(E, vm);
        if (sc) sc.scrollTop = top;
        bind(chipsEl, '[data-f]', function (b) {
          filter = b.getAttribute('data-f');
          draw();
          var s2 = q(ov, '.slw-sheet'); if (s2) s2.scrollTop = 0;
        });
        bind(body, '[data-a]', act);
        lazy();
        var pressed = q(chipsEl, '[aria-pressed="true"]');
        try { if (pressed && pressed.scrollIntoView) pressed.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* old engines */ }
        var el = focusSel ? q(body, focusSel) : null;
        if (focusSel && (!el || el.disabled)) el = pressed;
        try { if (el && el.focus) el.focus(); } catch (e) { /* gone */ }
        return vm;
      }
      function act(b) {
        var a = b.getAttribute('data-a');
        if (busy) return;
        var id = b.getAttribute('data-id'), card = id ? q(body, '.slps-card[data-id="' + id + '"]') : null, err = card ? q(card, '.slw-err') : null;
        /* a pet the child has: the Corner opens where it is (the Pet Corner picks the tab); the cap card and the banner open it plain */
        if (a === 'corner') { if (E.deps.openCorner) E.deps.openCorner(id && card && own(PLACE, card.getAttribute('data-state')) ? id : undefined); return; }
        /* wave 3: learn and come back for this card (the host closes the sheets; false keeps the shop open) */
        if (a === 'learn') { learnFor(E, id, ov); return; }
        if (a === 'open') { openDetail(E, deps, id, function () { draw('.slps-card[data-id="' + id + '"] .ic'); }); return; }
        busy = true;
        /* redraw (counts, states, the cap) unless a refusal's reason is on the card: that card stays as it is */
        var done = function (ok, sel) { busy = false; if ((ok || !(err && err.textContent)) && ov.isConnected !== false) draw(sel); };
        if (a === 'buy') {
          buyFood(E, id, b, err).then(function (ok) {
            done(ok, '[data-a="buy"][data-id="' + id + '"]');
            var c = q(body, '.slps-card[data-id="' + id + '"]');
            if (ok && c && !E.reduced()) c.classList.add('slps-got');
          });
        } else adopt(deps, id, { btn: b, err: err }).then(function (ok) { done(ok, '.slps-card[data-id="' + id + '"] .ic'); });
      }
      ov._petShopDraw = draw;
      /* opened on one animal (the Pet Corner's 'Adopt a {species} again', the news card): its card, in view */
      var want = opts && typeof opts.id === 'string' ? opts.id : null;
      var inView = function (vm) { return vm.groups.some(function (g) { return g.cards.some(function (c) { return c.id === want; }); }); };
      if (want && filter !== 'all' && !inView(shopView(deps, filter))) filter = 'all';
      draw();
      var card = want ? q(body, '.slps-card[data-id="' + want + '"]') : null;
      if (card) {
        setTimeout(function () {
          if (card.isConnected === false) return;
          try { if (card.scrollIntoView) card.scrollIntoView({ block: 'center' }); var b = q(card, '.ic'); if (b && b.focus) b.focus(); } catch (e) { /* gone */ }
        }, 60);
      }
    });
  }

  /* wave 3 (contract 5): the host's learn-and-come-back trip for this id, from the Pet Shop; the sheet closes unless the
     host says no (it may already have closed every sheet) */
  function learnFor(E, id, ov) {
    if (typeof E.deps.learnFor !== 'function') return;
    var r;
    try { r = E.deps.learnFor(id, { from: 'petShop' }); } catch (e) { r = false; }
    if (r !== false && ov && ov.isConnected !== false && typeof ov._close === 'function') ov._close();
  }
  /* a food: the host's buy flow, then the pantry count on the card goes up */
  function buyFood(E, id, btn, err) {
    if (typeof E.deps.buy !== 'function') return Promise.resolve(false);
    return Promise.resolve(E.deps.buy(id, { btn: btn, err: err })).then(function (res) { var ok = okOf(res); if (ok) E.sfx('pop'); return ok; }, function () { return false; });
  }

  /* ---------------- the detail sheet: turntable or sprite, the description, where it lives, its food ---------------- */
  function petCardOf(E, id) {
    var U = readCopy(E), it = E.C.item(id);
    if (!it || it.kind !== 'pet' || !E.shop) return null;
    var g = E.shop.petShop(E.C, U, { filter: 'all', trial: E.trial() });
    for (var i = 0; i < g.length; i++) for (var j = 0; j < g[i].items.length; j++) if (g[i].items[j].id === id) return g[i].items[j];
    return null;
  }
  function openDetail(E, deps, id, after) {
    var raw = petCardOf(E, id);
    if (!raw) return null;
    var room = roomOf(E), c = petCardVM(E, raw, room), k = raw.isle && own(E.C.ISLES, raw.isle) ? raw.isle : 'home', stop = null;
    var buy = typeof E.deps.buy === 'function', needsBuy = c.act === 'adopt' || c.act === 'room';
    var label = c.act === 'adopt' ? tx('care.shop.adopt') : c.act === 'room' ? tx('care.makeRoom') : c.act === 'corner' ? tx('care.corner.title') : '';
    var desc = descOf(E, id);
    var ov = sheet(E, '<h2>' + esc(c.name) + '</h2><div class="slw-detail slps-detail"><div class="big">' + petPic(E, id, { flat: true }) + '</div>' +
      '<div class="info"><p class="slps-desc">' + esc(desc) + '</p><p class="slps-facts">' + esc(tx('care.shop.lives', { island: E.C.ISLES[k].name })) + '</p>' +
      (c.loves ? '<div class="slps-loves">' + foodPic(E, c.loves.id) + '<span>' + esc(c.loves.text) + '</span></div>' : '') +
      (c.chip ? '<span class="chip ' + c.chip.cls + '">' + esc(c.chip.text) + '</span>' : '') + (!c.chip || c.chip.cls === 'lock' ? priceHtml(c) : '') +
      (c.line ? '<div class="slps-need' + (c.state === 'ownFull' ? ' slps-capline' : '') + '">' + esc(c.line) + '</div>' : '') +
      (c.learn ? '<div class="row">' + learnBtn(c) + '</div>'
        : label && (!needsBuy || buy) ? '<div class="row"><button type="button" class="' + (c.act === 'corner' ? 'slw-btn' : 'slw-buy') + '" data-a="' + c.act + '"' + (c.can ? '' : ' disabled') + '>' + esc(label) + '</button></div>' : '') +
      '<div class="slw-err" aria-live="polite"></div></div></div>', { small: false, cls: 'slps-ov', onClose: function () { if (stop) { try { stop(); } catch (e) { /* gone */ } } } });
    var P = E.deps.photocard || root.SLPhotocard;
    if (E.use3D() && P && typeof P.turntable === 'function') {
      try { stop = P.turntable(q(ov, '.big'), id, {}, { reduced: E.reduced() }); } catch (e) { stop = null; }
    }
    var btn = q(ov, '[data-a]');
    if (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        if (c.learn) { learnFor(E, id, ov); return; }
        if (c.act === 'corner') { ov._close(); if (E.deps.openCorner) E.deps.openCorner(own(PLACE, c.state) ? id : undefined); return; }
        ov._close();
        adopt(deps, id, {}).then(function () { if (after) after(); });
      });
    }
    return ov;
  }

  /* ================================================================
     ADOPTING: Make room ('home') · the 3rd-pet question ('total') · buy · the name · the celebration
     ================================================================ */
  function adopt(deps, id, o) {
    var E = env(deps), raw = E.C ? petCardOf(E, id) : null;
    o = o || {};
    if (!raw || typeof E.deps.buy !== 'function') return Promise.resolve(false);
    var room = roomOf(E), moved = null, step;
    if (raw.state === 'homeFull' && room && room.mode === 'home') step = makeRoom(E, id).then(function (pid) { moved = pid; return !!pid; });
    else if (raw.state !== 'adopt') {
      /* a Buy elsewhere (the Island Shop) on a pet that cannot come says why where the child tapped, never nothing */
      var why = raw.state === 'ownFull' && room ? tx('care.ownFull', { n: room.count })
        : raw.state === 'locked' && raw.isle && own(E.C.ISLES, raw.isle) ? tx('care.shop.unlock', { island: tx('isle.short.' + raw.isle) }) : '';
      if (why && o.err) { try { o.err.textContent = why; } catch (e) { /* gone */ } }
      return Promise.resolve(false);
    }
    else if (room && room.mode !== 'home' && room.count === room.max - 1) step = askLimit(E, raw);
    else step = Promise.resolve(true);
    return step.then(function (go) {
      if (!go) return false;
      return Promise.resolve(E.deps.buy(id, { btn: o.btn || null, err: o.err || null })).then(function (res) { return res; }, function () { return null; }).then(function (res) {
        if (!okOf(res)) {
          /* the child said 'Not yet' (or the shop refused): the pet that made room goes back home */
          if (moved && E.care) return Promise.resolve(E.deps.commit(function (u) { return E.care.toHome(u, moved, E.now()); })).then(function () { return false; }, function () { return false; });
          return false;
        }
        return nameStep(E, id).then(function (name) {
          var t = tx('crew.joined', { item: name }), s = tx('care.intro');
          if (typeof E.deps.celebrate === 'function') E.deps.celebrate({ title: t, sub: s, icon: id });
          else if (typeof E.deps.toast === 'function') E.deps.toast(t);
          return true;
        });
      });
    });
  }

  /* care.adoptLimit: asked once, before the adoption that takes a child to 3 ('total') */
  function askLimit(E, raw) {
    return new Promise(function (resolve) {
      var answered = false, fin = function (v) { if (!answered) { answered = true; resolve(v); } };
      var ov = sheet(E, '<h2>' + esc(raw.name) + '</h2><div class="slps-offer"><div class="slps-pics"><span class="lead">' + petPic(E, raw.id, { flat: true }) + '</span></div>' +
        '<p>' + esc(tx('care.adoptLimit', { name: raw.name })) + '</p><div class="slps-btns">' +
        '<button type="button" class="slw-btn big" data-a="no">' + esc(tx('care.adoptLimit.no')) + '</button>' +
        '<button type="button" class="slw-btn big on" data-a="yes">' + esc(tx('care.adoptLimit.yes', { name: raw.name })) + '</button></div></div>',
        { small: true, cls: 'slps-ov slps-limit', onClose: function () { fin(false); } });
      q(ov, '[data-a="no"]').addEventListener('click', function () { fin(false); ov._close(); });
      q(ov, '[data-a="yes"]').addEventListener('click', function () { fin(true); ov._close(); });
    });
  }

  /* 'Make room' (cap 'home' only, KU4): pick a home pet for the Pet Hotel. KU5: a pet with an empty
     tummy, or one at the Pet Rescue, cannot go; SLPetCare.toHotel has the last word. → the pet moved, or null */
  function makeRoom(E, petId) {
    var care = E.care;
    if (!care) return Promise.resolve(null);
    var u = E.user(), w = u && u.world, st = w ? care.status(w, null) : null, home = w ? E.C.homePets(w) : [], R = care.REASON || {};
    if (!st || !st.started) return Promise.resolve(null);
    var by = {};
    (st && st.pets || []).forEach(function (p) { by[p.id] = p; });
    var rows = home.filter(function (id) { return own(by, id); }).map(function (id) {
      var p = by[id], why = p.where === 'rescue' ? R.at_rescue : p.food === 0 ? R.hungry : null, tk = care.tummyKey ? care.tummyKey(p.level) : null;
      return '<button type="button" class="slw-btn slps-pet" data-pid="' + esc(id) + '"' + (why ? ' disabled' : '') + '>' + petPic(E, id, { flat: true, st: { acc: E.C.wornBy(w, id) } }) +
        '<span class="nm">' + esc(p.name) + '</span><span class="sp">' + esc(speciesName(E, id)) + (tk && p.where === 'home' ? ' · ' + esc(tx(tk)) : '') + '</span>' +
        (why ? '<span class="why">' + esc(why) + '</span>' : '') + '</button>';
    }).join('');
    return new Promise(function (resolve) {
      var answered = false, fin = function (v) { if (!answered) { answered = true; resolve(v); } };
      var ov = sheet(E, '<h2>' + esc(tx('care.makeRoom')) + '</h2><p class="slps-line">' + esc(tx('care.homeFull')) + '</p><div class="slps-room">' + rows + '</div>' +
        '<div class="slw-err" aria-live="polite"></div>', { small: true, cls: 'slps-ov slps-roomov', onClose: function () { fin(null); } });
      var err = q(ov, '.slw-err'), busy = false;
      qa(ov, '[data-pid]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.disabled || busy) return;
          busy = true;
          var pid = b.getAttribute('data-pid');
          Promise.resolve(E.deps.commit(function (uu) { return care.toHotel(uu, pid, E.now()); })).then(function (res) {
            busy = false;
            if (okOf(res)) { fin(pid); ov._close(); return; }
            if (err) err.textContent = (res && res.reason) || '';
          }, function () { busy = false; });
        });
      });
    });
  }

  /* the name step: the default name ready to keep or change (validatePetName), then the celebration */
  function nameStep(E, id) {
    var C = E.C, u = E.user(), w = u && u.world, p = w ? C.crewPet(w, id) : null, start = p ? p.name : (C.DEFAULT_PET_NAMES || {})[id] || '';
    return new Promise(function (resolve) {
      var answered = false, fin = function (v) { if (!answered) { answered = true; resolve(v); } };
      /* the new pet in the shop's own style: its photocard in 3D (the hamster is not a flat sprite there), the sprite in 2D and on LOW */
      var ov = sheet(E, '<h2>' + esc(speciesName(E, id)) + '</h2><div class="slps-name"><div class="slps-namepic">' + petPic(E, id) + '</div>' +
        '<input type="text" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="' + esc(tx('care.rename')) + '" value="' + esc(start) + '">' +
        '<div class="slw-err" aria-live="polite"></div>' +
        '<button type="button" class="slw-btn big on" data-a="name">' + esc(tx('crew.named', { name: start })) + '</button></div>',
        { small: true, cls: 'slps-ov slps-nameov', onClose: function () { fin(cur()); } });
      if (E.use3D() && typeof E.deps.fillPhotocards === 'function') { try { E.deps.fillPhotocards(q(ov, '.slps-namepic')); } catch (e) { /* the sprite stays */ } }
      var input = q(ov, 'input'), err = q(ov, '.slw-err'), btn = q(ov, '[data-a="name"]'), busy = false, saved = start;
      function cur() { var c = E.user(), pp = c && c.world ? C.crewPet(c.world, id) : null; return pp ? pp.name : saved; }
      /* the box's text (a page without the value property reads the attribute) */
      function typed() { return typeof input.value === 'string' ? input.value : input.getAttribute('value') || ''; }
      function check() {
        var v = C.validatePetName(typed());
        err.textContent = v.ok ? '' : v.reason;
        btn.disabled = !v.ok;
        btn.textContent = tx('crew.named', { name: v.ok ? v.name : saved });
        return v;
      }
      function save() {
        var v = check();
        if (!v.ok || busy) return;
        if (v.name === saved) { fin(saved); ov._close(); return; }
        busy = true;
        Promise.resolve(E.deps.commit(function (uu) { return C.renamePet(uu, id, v.name); })).then(function (res) {
          busy = false;
          if (okOf(res)) { saved = (res && res.name) || v.name; fin(saved); ov._close(); return; }
          err.textContent = (res && res.reason) || '';
        }, function () { busy = false; });
      }
      input.addEventListener('input', check);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); save(); } });
      btn.addEventListener('click', save);
      setTimeout(function () { if (answered || ov.isConnected === false) return; try { input.focus(); if (input.select) input.select(); } catch (e) { /* gone */ } }, 40);
    });
  }

  /* ================================================================
     THE NEW PLAYER'S ADOPT OFFER (the island-open queue's pets.adoptOffer, KU13)
     ================================================================ */
  function adoptOffer(ctx) {
    var E = env(ctx), C = E.C;
    if (!C || typeof E.deps.overlay !== 'function') return Promise.resolve(null);
    var room = roomOf(E);
    if (!room || !room.canAdopt) return Promise.resolve(null);
    var u = E.user(), w = u && u.world, run = w ? (typeof C.careRunner === 'function' && C.careRunner(w)) || C.activePetId(w) : null;
    var me = run && w ? C.crewPet(w, run) : null;
    var newOnes = C.CATALOG.filter(function (it) { return it.kind === 'pet' && it.isle === 'home' && !it.retired; }).slice(0, 4);
    var pics = '<span class="lead">' + (me ? petPic(E, me.id, { flat: true, st: { acc: me.acc } }) : '') + '</span><span class="slps-friends">' +
      newOnes.map(function (it) { return '<span>' + petPic(E, it.id, { flat: true }) + '</span>'; }).join('') + '</span>';
    return new Promise(function (resolve) {
      var answered = false, fin = function (v) { if (!answered) { answered = true; resolve(v); } };
      var ov = sheet(E, '<h2>' + esc(tx('care.shop.title')) + '</h2><div class="slps-offer"><div class="slps-pics">' + pics + '</div>' +
        '<p>' + esc(tx(room.mode === 'home' ? 'care.welcome.cap' : 'care.welcome.capTotal')) + '</p><div class="slps-btns">' +
        '<button type="button" class="slw-btn big" data-a="later">' + esc(tx('char.meet.later')) + '</button>' +
        '<button type="button" class="slw-btn big on" data-a="shop">' + esc(me ? tx('care.adoptFriend', { name: me.name }) : tx('care.welcome.shop')) + '</button></div></div>',
        { small: true, cls: 'slps-ov slps-offerov', onClose: function () { fin('later'); } });
      q(ov, '[data-a="later"]').addEventListener('click', function () { fin('later'); ov._close(); });
      q(ov, '[data-a="shop"]').addEventListener('click', function () {
        answered = true;
        ov._close();
        openPetShop(ctx, { filter: 'all' }).then(function () { resolve('shop'); });
      });
    });
  }

  /* ================================================================
     THE MEMORY BOOK (U11): only while a grown-up's farewell switch has made a star
     ================================================================ */
  function memoryView(deps) {
    var E = env(deps), C = E.C, u = E.user(), w = u && u.world;
    var list = w && E.care ? E.care.memories(w) : [], room = w ? roomOf(E) : null;
    var lastOf = {};
    list.forEach(function (m, i) { if (m && typeof m.id === 'string') lastOf[m.id] = i; });
    var cards = list.map(function (m, i) {
      var sp = speciesName(E, m.id), c = { i: i, id: m.id, name: m.name, species: sp, days: tx('care.memory.days', { n: m.days }), acc: m.acc || {},
        back: m.returned ? tx('care.star.back', { name: m.name }) : null, again: null };
      /* 'Adopt a {species} again': the newest card of a species that is a star now and that the shop would let come */
      if (lastOf[m.id] === i && !m.returned && w && C.petWhere(w, m.id) === 'star') {
        var raw = petCardOf(E, m.id);
        /* only while it can come: never at the cap (care.ownFull says so in the shop) nor for the free puppy */
        var short = raw && raw.code === 'insufficient' && typeof raw.need === 'number';
        /* with cap 'home' a full home adopts through 'Make room' (afford: the price and land allow it) */
        var go = raw && raw.readopt && (raw.state === 'adopt' ? raw.can || short : raw.state === 'homeFull' && room && room.mode === 'home' && raw.afford);
        if (go) c.again = { text: tx(/^[aeiou]/i.test(sp) && CP() && CP().STRINGS && Object.prototype.hasOwnProperty.call(CP().STRINGS, 'care.memory.againAn') ? 'care.memory.againAn' : 'care.memory.again', { species: lower(sp) }), can: (raw.state === 'adopt' ? !!raw.can : true) && typeof E.deps.buy === 'function', need: short ? needLine(raw, raw.need) : null };
      }
      return c;
    }).reverse();
    return { title: tx('care.memories'), cards: cards };
  }
  function memoryHtml(E, vm) {
    var P = E.pets, head = '', pic = function (c) { try { return P && typeof P.memory === 'function' ? P.memory(c.id, { acc: c.acc }) : ''; } catch (e) { return ''; } };
    try { head = P && typeof P.header === 'function' ? P.header('memories') : ''; } catch (e) { head = ''; }
    return (head ? '<div class="slps-memhead">' + head + '</div>' : '') + '<h2>' + esc(vm.title) + '</h2><div class="slps-memgrid">' +
      vm.cards.map(function (c) {
        return '<article class="slps-memcard" tabindex="-1" data-id="' + esc(c.id) + '" data-i="' + c.i + '">' + (pic(c) || petPic(E, c.id, { flat: true, st: { acc: c.acc } })) +
          '<h3>' + esc(c.name) + '</h3><div class="sp">' + esc(c.species) + '</div><div class="days">' + esc(c.days) + '</div>' +
          (c.back ? '<span class="chip own">' + esc(c.back) + '</span>' : '') +
          (c.again ? (c.again.need ? '<div class="slps-need">' + esc(c.again.need) + '</div>' : '') +
            '<button type="button" class="slw-buy" data-a="again" data-id="' + esc(c.id) + '"' + (c.again.can ? '' : ' disabled') + '>' + esc(c.again.text) + '</button>' : '') +
          '<div class="slw-err" aria-live="polite"></div></article>';
      }).join('') + '</div>';
  }
  function openMemories(deps, opts) {
    var E = env(deps);
    if (!E.C || typeof E.deps.overlay !== 'function') return Promise.resolve(null);
    return new Promise(function (resolve) {
      /* drawn into the sheet as it opens, so the host's overlay names the dialog by its heading */
      var ov = sheet(E, '<div class="slps-membody">' + memoryHtml(E, memoryView(deps)) + '</div>', { cls: 'slps-ov slps-mem', onClose: function () { resolve(true); } });
      var body = q(ov, '.slps-membody'), busy = false;
      function wire() {
        bind(body, '[data-a="again"]', function (b) {
          if (busy) return;
          var id = b.getAttribute('data-id'), card = b.parentNode, err = card ? q(card, '.slw-err') : null;
          busy = true;
          adopt(deps, id, { btn: b, err: err }).then(function (ok) {
            busy = false;
            if (ok || !(err && err.textContent)) draw();                /* a refusal's reason stays on its card */
          });
        });
      }
      function draw() { body.innerHTML = memoryHtml(E, memoryView(deps)); wire(); }
      wire();
      var want = opts && opts.petId, el = want ? q(body, '.slps-memcard[data-id="' + want + '"]') : null;
      if (el) setTimeout(function () { if (el.isConnected === false) return; try { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); el.focus(); } catch (e) { /* gone */ } }, 40);
    });
  }

  return {
    VERSION: VERSION, FILTERS: FILTERS, CSS: CSS,
    openPetShop: openPetShop, adopt: adopt, openMemories: openMemories, adoptOffer: adoptOffer,
    shopView: shopView, memoryView: memoryView
  };
}));
