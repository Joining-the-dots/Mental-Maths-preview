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
     here          string | () → string: the land the child is on (the host's isleNow), where the shop
                   opens; absent → Home (and the land page never says 'You're on …')
     buyGear(id, {btn, err}) → Promise<res | bool>: the host's ordinary buy flow for pet clothes (kind
                   'acc', with the host's own celebration), resolving falsy / {ok: false} when nothing
                   was bought ('Not yet' on its confirm card included). Absent → no Clothes shelf at all
                   (the Island Shop sells pet clothes), so the shop never shows a piece with nothing to tap
     now() → ms (default Date.now) · sound(name) or sfx(name): an SLSound name ('pop' when a food
     lands in the pantry) · C (default SLWorldCore) · care (default SLPetCare, bound to C) · shop
     (default SLIslandShop) · document, clock (→ ms, the scrim's arming and a learn trip's 3 hours; default
     Date.now): test seams

   API
     openPetShop(deps, {filter, id, news}) → Promise   resolves when the shop closes. Laid out like
                   the Island Shop (James, 25 Oct: "Make them match"): a sticky row of land chips ('Shop
                   at': Home, then the sky lands; owned ✓, a locked one wears its lock) picks ONE land
                   page, and the page has a 'Jump to' row and three shelves: Animals (that land's
                   species), Food (every food, on every land) and Clothes (that land's pet gear), with
                   'I can buy' (never in test mode) filtering the land on show (a card stays only when it
                   can be bought here and now; the free basic meal's line stays when its Food shelf
                   goes). filter: 'all' (the
                   default: the land the child is on) | 'food' (that land, scrolled to Food) | 'home' |
                   a land | 'adopt' (the land the child is on if something can be adopted there, else
                   the first land where it can, with 'I can buy' on); id: that card's land (a food:
                   the land asked for), the card scrolled to, ringed and focused ('I can buy' off when
                   it would hide it; R2: the land and filter a '📚 Learn' trip for that id left from,
                   when they still show it); news (the news card's 'Visit the Pet Shop') needs nothing
                   more: the new species carry a 'New' badge (isle.chipNew) wherever the child has none
     adopt(deps, petId, {btn, err}) → Promise<bool>   one adoption: 'Make room' first when home
                   is full (cap 'home' only, KU5), the care.adoptLimit question before the pet
                   that takes a child to 3 ('total'), the host's buy, the name step
                   (validatePetName), the host's celebration
     openMemories(deps, {petId}) → Promise   the Memory Book (U11): every memory card, newest
                   first; 'Adopt a {species} again' while that species is a star and can come
     adoptOffer(ctx) → Promise<'shop' | 'later' | null>   the new player's card in the island-open
                   queue (KU13, prio 30): 'Adopt a friend for {name}' opens the Pet Shop, 'Later'
                   closes; null (nothing shown) when the cap shuts adoption
     view-models (pure): shopView(deps, at) (at: an opening name, or {land, filter 'all' | 'afford', jump}) → {land,
                   here, filter, jump, lands (the chips), section, banner, jumps, groups (the shelves: Animals key = the
                   land, 'food', 'clothes'), hidden, note (the free basic meal's line when 'I can buy' took its
                   shelf), next, empty} · memoryView(deps) · FILTERS (the opening names) · CSS
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
  /* fb: the words a key says until the copy table has it (the island's copy contract: the same text as the table) */
  function tx(key, vars, fb) {
    var c = CP();
    if (c && typeof c.t === 'function') return c.t(key, vars, fb);
    return (typeof fb === 'string' ? fb : key).replace(/\{(\w+)\}/g, function (m, k) { return vars && own(vars, k) && vars[k] != null ? String(vars[k]) : m; });
  }
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
      /* the land the child is on (deps.here), or null when the host does not say */
      here: function () { var h = null; try { h = val(deps.here); } catch (e) { h = null; } return typeof h === 'string' && C && own(C.ISLES, h) ? h : null; },
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
  /* a piece of pet gear: its 2D picture (a V4.54 piece on a puppy, a land's piece on its square card); never a data-pc */
  function gearPic(E, id) { return '<span class="slps-2d slps-gear">' + sprite(E, id) + '</span>'; }
  /* the island's money (F-KU5): a card made in 🪙 (island-shop's wallet: 'coins', since the two wallets) shows 🪙 and
     its shortfall in coins; a ⭐ card (a core that pays in stars) reads as before */
  function symOf(c) { return c && c.wallet === 'coins' ? '🪙' : '⭐'; }
  function money(c) { return symOf(c) + ' ' + fmt(c.price); }
  /* James (25 Oct): 'Need N more 🪙' for every shortfall (need.coins, the island's copy contract) */
  function needLine(c, n) { return c && c.wallet === 'coins' ? tx('need.coins', { n: fmt(n) }, 'Need {n} more 🪙') : tx('char.cast.need', { n: fmt(n) }); }
  function priceHtml(c) {
    return '<div class="pr">' + (c.free ? '<s>' + money(c) + '</s> <span class="slw-free">' + esc(tx('wardrobe.free')) + '</span>' : money(c)) + '</div>';
  }

  /* ================================================================
     THE VIEW-MODEL (pure: the shop's data, the cap and every card's words and action)
     ================================================================ */
  /* the land page's three shelves, in this order (care.shop.jump.*: the island's copy contract) */
  var SHELVES = Object.freeze(['animals', 'food', 'clothes']);
  var SHELF_WORDS = { animals: 'Animals', food: 'Food', clothes: 'Clothes' };
  function shelfLabel(s) { return tx('care.shop.jump.' + s, null, SHELF_WORDS[s]); }
  /* the land chips ('Shop at', the Island Shop's picker): Home first, then the sky lands in ISLE_ORDER */
  function landsOf(E, U, land, here) {
    var C = E.C;
    return C.ISLE_ORDER.filter(function (k) { return own(C.ISLES, k); }).map(function (k) {
      return { isle: k, name: C.ISLES[k].name, short: tx('isle.short.' + k, null, C.ISLES[k].name),
        owned: k === 'home' || !!(U.world && typeof C.isleUnlocked === 'function' && C.isleUnlocked(U.world, k)), here: k === here, on: k === land };
    });
  }
  /* where a card lives: a pet or a piece of pet gear on its land (no land: Home); a food is on every land (null) */
  function landOfId(E, id) {
    var it = E.C.item(id);
    if (!it || (it.kind !== 'pet' && it.kind !== 'acc')) return null;
    return it.isle && own(E.C.ISLES, it.isle) ? it.isle : 'home';
  }
  /* 'I can buy' keeps what can be had now: an animal to adopt (or to make room for), a food, a piece of gear — each only
     with the host's flow that buys it here (by.buy: deps.buy; by.gearBuy: deps.buyGear), so it never keeps a card that
     has nothing to tap */
  function canNow(c, by) {
    if (c.kind === 'pet') return (c.act === 'adopt' || c.act === 'room') && !!c.can && !!by.buy;
    if (c.kind === 'gear') return c.act === 'gear' && !!c.can && !!by.gearBuy;
    return c.act === 'buy' && !!c.can && !!by.buy;
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
      vm.need = c.need;
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
      /* the food shortfall is My pets' pantry line word for word (care.noCoins; d-island's copy says 'Need {n} more 🪙 for
         {food}.', James's one shortfall wording), so the Pet Shop and My pets never say it two ways */
      vm.need = c.need;
      vm.line = tx(c.wallet === 'coins' ? 'care.noCoins' : 'care.noPoints', { n: fmt(c.need), food: c.name });
      vm.learn = learnOn(E, c.need);
    }
    /* test mode: a greyed 'Get it free' says why on the card (QA 24 Oct, item 8) */
    else if (c.state === 'trialFull') vm.line = tx('care.trialFull', { n: trialMax || ((E.C.CARE || {}).trialPantryMax) || 0 });
    return vm;
  }
  /* a piece of pet gear (kind 'acc') on the Clothes shelf: its 2D picture, the core's own state (owned, locked, short,
     affordable) and its price in the wallet the island uses; bought through the host's buyGear (with the host's own
     celebration), worn in My pets */
  function gearCardVM(E, U, id, trial, isle) {
    var C = E.C, it = C.item(id), o = { trial: trial };
    var st = (typeof C.itemState === 'function' ? C.itemState(U, id, o) : null) || {}, chk = C.purchaseCheck(U, id, o) || {};
    var p = typeof C.priceOf === 'function' ? C.priceOf(id, o) : null, coins = typeof C.walletOf === 'function' && C.walletOf(o) === 'coins';
    var vm = { id: id, kind: 'gear', name: it.name, fact: descOf(E, id), price: typeof p === 'number' && isFinite(p) ? p : it.price, free: trial,
      state: st.state || 'affordable', wallet: coins ? 'coins' : null, chip: null, act: null, can: false, line: null, learn: false };
    if (st.state === 'owned') {
      /* the child has it: where to wear it (My pets), never a second Buy */
      vm.chip = { cls: 'own', text: tx('care.shop.owned', null, '✓ Owned') };
      vm.act = E.deps.openCorner ? 'corner' : null;
      vm.can = !!vm.act;
    } else if (st.state === 'locked') {
      vm.chip = { cls: 'lock', text: tx('care.shop.unlock', { island: tx('isle.short.' + isle) }) };
    } else {
      vm.act = 'gear';
      vm.can = !!chk.ok;
      if (!chk.ok && chk.code === 'insufficient' && typeof chk.need === 'number') {
        vm.need = chk.need;
        vm.line = needLine(vm, chk.need);
        vm.learn = learnOn(E, chk.need);
      }
    }
    return vm;
  }
  /* the land's pet gear, cheapest first in the island's money (the order never changes when one is bought) */
  function gearOf(E, U, k, trial) {
    var C = E.C, o = { trial: trial }, list = typeof C.shopItems === 'function' ? C.shopItems() : C.CATALOG;
    var price = function (it) { var p = typeof C.priceOf === 'function' ? C.priceOf(it.id, o) : null; return typeof p === 'number' && isFinite(p) ? p : it.price; };
    return list.filter(function (it) { return it && it.kind === 'acc' && !it.retired && (it.isle && own(C.ISLES, it.isle) ? it.isle : 'home') === k; })
      .map(function (it, i) { return { it: it, i: i, p: price(it) }; })
      .sort(function (a, b) { return (a.p - b.p) || (a.i - b.i); })
      .map(function (x) { return gearCardVM(E, U, x.it.id, trial, k); });
  }
  /* where the shop opens: {land, filter 'all' | 'afford', jump: a shelf | null}. at is an opening name (FILTERS: 'all',
     'food', 'home', a land, 'adopt') or {land, filter, jump}. 'adopt' is the land the child is on when an animal can
     be adopted there, else the first land where one can, with 'I can buy' on. In test mode the filter is always 'all'
     (nothing is short, as in the Island Shop) */
  function adoptable(g, room) {
    return g.items.some(function (c) { return c.state === 'adopt' ? c.can && c.code !== 'not_for_sale' : c.state === 'homeFull' && c.afford && !!room && room.mode === 'home'; });
  }
  function openAt(E, at, byKey, room, here) {
    var C = E.C, o = { land: here, filter: 'all', jump: null };
    if (at && typeof at === 'object') {
      if (typeof at.land === 'string' && own(C.ISLES, at.land)) o.land = at.land;
      if (at.filter === 'afford') o.filter = 'afford';
      if (SHELVES.indexOf(at.jump) >= 0) o.jump = at.jump;
    } else if (at === 'food') o.jump = 'food';
    else if (at === 'adopt') {
      o.filter = 'afford';
      var ks = [here].concat(C.ISLE_ORDER.filter(function (k) { return k !== here; }));
      for (var i = 0; i < ks.length; i++) if (byKey[ks[i]] && adoptable(byKey[ks[i]], room)) { o.land = ks[i]; break; }
    } else if (typeof at === 'string' && at !== 'all' && own(C.ISLES, at)) o.land = at;
    if (E.trial()) o.filter = 'all';
    return o;
  }
  function shopView(deps, at) {
    var E = env(deps), C = E.C;
    var U = readCopy(E), room = typeof C.petRoom === 'function' ? C.petRoom(U.world) : null, trial = E.trial();
    var known = E.here(), here = known || 'home';
    var raw = E.shop && typeof E.shop.petShop === 'function' ? E.shop.petShop(C, U, { filter: 'all', trial: trial }) : [];
    var byKey = {};
    raw.forEach(function (g) { byKey[g.key] = g; });
    var o = openAt(E, at, byKey, room, here), k = o.land, owned = k === 'home' || !!(U.world && C.isleUnlocked(U.world, k));
    var groups = [], pg = byKey[k], fg = byKey.food;
    /* Animals: the land's species (a locked land is shown, never hidden: its unlock line, every card's lock chip) */
    if (pg) {
      groups.push({ key: k, shelf: 'animals', kind: 'pets', title: shelfLabel('animals'), locked: !pg.owned, lines: pg.owned ? [] : [tx('care.shop.unlock', { island: pg.name })],
        cards: pg.items.map(function (c) { return petCardVM(E, c, room, U); }) });
    }
    /* Food: every food, on every land (the pantry is the child's, wherever they shop) */
    var basic = null;
    if (fg) {
      var meter = tx('care.pantry') + ' · ' + fg.meals + (fg.trialMax ? ' / ' + fg.trialMax : '');
      var lines = fg.lineKey ? [tx(fg.lineKey, { n: fg.trialMax })] : [];
      /* no meal the child can get now (F-KU4's free basic meal, F-KU5): a hungry pet is never left out, the Pet Corner has it */
      if (!trial && E.care && typeof E.care.basicMeal === 'function' && !fg.items.some(function (c) { return c.group !== 'treat' && c.can; }) &&
          fg.items.some(function (c) { return c.group !== 'treat' && c.state === 'short'; })) lines.push(basic = tx('care.basic.shop'));
      groups.push({ key: 'food', shelf: 'food', kind: 'food', title: shelfLabel('food'), lines: lines, meter: meter,
        cards: fg.items.map(function (c) { return foodCardVM(E, c, fg.trialMax); }) });
    }
    /* Clothes: the land's pet gear, only with the host's buyGear (without it the Island Shop sells pet clothes, and this
       shop never shows a piece with nothing to tap) */
    var gearBuy = typeof E.deps.buyGear === 'function', gear = gearBuy ? gearOf(E, U, k, trial) : [];
    if (gear.length) {
      groups.push({ key: 'clothes', shelf: 'clothes', kind: 'gear', title: shelfLabel('clothes'), locked: !owned,
        lines: owned ? [] : [tx('care.shop.unlock', { island: C.ISLES[k].name })], cards: gear });
    }
    var banner = null;
    if (room && room.mode === 'home' && room.atCap) banner = { key: 'care.homeFull', text: tx('care.homeFull'), corner: false };
    else if (room && room.mode !== 'home' && !room.canAdopt) banner = { key: 'care.ownFull', text: tx('care.ownFull', { n: room.count }), corner: !!E.deps.openCorner };
    else if (room && room.mode !== 'home') banner = { key: 'care.welcome.capTotal', text: tx('care.welcome.capTotal'), corner: false };
    /* R2 (QA2B-3): the cap is said once a screen. With the banner saying it (care.ownFull), an animal the child does not
       have keeps only its Full chip ('3 of 3 pets' / 'Full: you have 4 pets'); the detail sheet, with no banner, keeps its line */
    if (banner && banner.key === 'care.ownFull') groups.forEach(function (g) { g.cards.forEach(function (c) { if (c.kind === 'pet' && c.state === 'ownFull') c.line = null; }); });
    /* 'I can buy' (the Island Shop's rule): only what can be had now; a shelf left with nothing goes. next = the card the
       child is nearest to (the smallest shortfall on the page), for the empty state */
    var hidden = 0, next = null;
    groups.forEach(function (g) { g.cards.forEach(function (c) { if (typeof c.need === 'number' && c.need > 0 && (!next || c.need < next.need)) next = { id: c.id, name: c.name, need: c.need, learn: !!c.learn }; }); });
    var by = { buy: typeof E.deps.buy === 'function', gearBuy: gearBuy };
    if (o.filter === 'afford') {
      groups.forEach(function (g) { var n = g.cards.length; g.cards = g.cards.filter(function (c) { return canNow(c, by); }); hidden += n - g.cards.length; });
      groups = groups.filter(function (g) { return g.cards.length > 0; });
    }
    /* 'I can buy' took the Food shelf away (nothing there to buy now): its free basic meal line stays on the page, as a
       hungry pet with no coins is just when it is needed */
    var note = basic && !groups.some(function (g) { return g.shelf === 'food'; }) ? basic : null;
    var empty = groups.length ? null : tx('shop.filter.none');
    var line = known && k === known ? tx('shop.isleHere', { island: C.ISLES[k].name }) : null;
    return { land: k, here: here, filter: o.filter, jump: o.jump, room: room, trial: trial, buy: by.buy, gearBuy: by.gearBuy,
      lands: landsOf(E, U, k, known), banner: banner,
      section: { isle: k, name: C.ISLES[k].name, title: k === 'home' ? tx('care.shop.home') : C.ISLES[k].name, owned: owned, line: line },
      jumps: groups.map(function (g) { return { key: g.shelf, label: g.title }; }),
      groups: groups, hidden: hidden, note: note, next: empty ? next : null, empty: empty };
  }

  /* ---------------- the markup ---------------- */
  function cardHtml(E, c, vm) {
    var pet = c.kind === 'pet', buy = c.kind === 'gear' ? vm.gearBuy : vm.buy;
    var h = '<div class="slw-card slps-card" data-kind="' + c.kind + '" data-id="' + esc(c.id) + '" data-state="' + esc(c.state) + '">' +
      (pet ? '<button type="button" class="ic" data-a="open" data-id="' + esc(c.id) + '" aria-label="' + esc(c.name) + '">' + petPic(E, c.id) +
        (c.fresh ? '<span class="chip uni slps-new">' + esc(c.fresh) + '</span>' : '') + '</button>'
        : '<div class="ic">' + (c.kind === 'gear' ? gearPic(E, c.id) : foodPic(E, c.id)) + '</div>') +
      '<div class="nm">' + esc(c.name) + '</div>' + (c.fact ? '<div class="ds">' + esc(c.fact) + '</div>' : '');
    if (c.loves) h += '<div class="slps-loves">' + foodPic(E, c.loves.id) + '<span>' + esc(c.loves.text) + '</span></div>';
    /* the card's foot (its state, price, why and button) sits at the bottom, so a two-line name never pushes one
       card's price and button out of line with its row (QA 24 Oct, item 8) */
    h += '<div class="slps-foot">';
    if (c.kind === 'food') h += '<span class="chip rep slps-have">' + esc(c.pantry) + '</span>';
    if (c.chip) h += '<span class="chip ' + c.chip.cls + '">' + esc(c.chip.text) + '</span>';
    /* a short card's button is '📚 Learn', so its price shows on the card instead */
    var priceOnButton = (c.act === 'buy' || c.act === 'gear') && !c.free && buy && !c.learn;
    if ((!c.chip || c.chip.cls === 'lock') && !priceOnButton) h += priceHtml(c);
    if (c.line) h += '<div class="slps-need' + (c.state === 'ownFull' ? ' slps-capline' : '') + '">' + esc(c.line) + '</div>';
    if (c.learn) return h + '<div class="row">' + learnBtn(c) + '</div><div class="slw-err" aria-live="polite"></div></div></div>';
    var label = c.act === 'adopt' ? tx('care.shop.adopt') : c.act === 'room' ? tx('care.makeRoom') : c.act === 'corner' ? tx('care.corner.title')
      : c.act === 'buy' || c.act === 'gear' ? (c.free ? tx('isle.unlockFree') : money(c)) : '';
    var needsBuy = c.act === 'adopt' || c.act === 'room' || c.act === 'buy' || c.act === 'gear';
    if (label && (!needsBuy || buy)) {
      h += '<div class="row"><button type="button" class="' + (c.act === 'corner' ? 'slw-btn' : 'slw-buy') + '" data-a="' + c.act + '" data-id="' + esc(c.id) + '"' +
        (c.act === 'buy' || c.act === 'gear' ? ' aria-label="' + esc(c.name + ' · ' + label) + '"' : '') + (c.can ? '' : ' disabled') + '>' + esc(label) + '</button></div>';
    }
    return h + '<div class="slw-err" aria-live="polite"></div></div></div>';
  }
  /* wave 3: '📚 Learn' (learn.go), named for its card ('Kitten · 📚 Learn'). Never the 'big' class: the detail sheet's
     picture box is .big (its sky fill would paint the button) */
  function learnBtn(c) {
    var label = tx('learn.go');
    return '<button type="button" class="slw-btn slw-learnbtn" data-a="learn" data-id="' + esc(c.id) + '" aria-label="' + esc(c.name + ' · ' + label) + '">' + esc(label) + '</button>';
  }
  function isleIcon(E, k, locked) {
    var A = E.art;
    try { return A && typeof A.isleIcon === 'function' ? A.isleIcon(k, { locked: !!locked }) || '' : ''; } catch (e) { return ''; }
  }
  /* the land chips: the Island Shop's look (.slw-shopland's .slw-btn, an owned sky land ' ✓', a locked one's icon wears
     the lock, the land on show pressed in), named in full for a screen reader */
  function landsHtml(E, vm) {
    return vm.lands.map(function (p) {
      var sky = p.isle !== 'home', open = p.owned;
      return '<button type="button" class="slw-btn' + (p.on ? ' on' : '') + (p.here ? ' here' : '') + (open ? '' : ' locked') + '" data-land="' + p.isle + '" aria-pressed="' + (p.on ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(p.name + (sky && open ? ', ' + tx('shop.unlocked') : '')) + '">' + isleIcon(E, p.isle, !open) +
        '<span>' + esc(p.short + (sky && open ? ' ✓' : '')) + '</span></button>';
    }).join('');
  }
  function bannerHtml(b) {
    return '<div class="slps-banner" data-key="' + esc(b.key) + '"><span>' + esc(b.text) + '</span>' +
      (b.corner ? '<button type="button" class="slw-btn" data-a="corner">' + esc(tx('care.corner.title')) + '</button>' : '') + '</div>';
  }
  /* one land's page (the Island Shop's isleSectionHtml): its heading, where you are, the cap, 'I can buy' (never in test
     mode), the Jump to row, then the shelves (Animals, Food, Clothes), each a heading the Jump to chips scroll to */
  function bodyHtml(E, vm) {
    var s = vm.section, k = s.isle, on = vm.filter === 'afford';
    var h = '<section class="slw-shopisle slps-land" data-isle="' + k + '" aria-labelledby="slpsSI-' + k + '"><h3 id="slpsSI-' + k + '">' + isleIcon(E, k, !s.owned) + esc(s.title) + '</h3>';
    if (s.line) h += '<p class="slw-isleline">' + esc(s.line) + '</p>';
    if (vm.banner) h += bannerHtml(vm.banner);
    if (!vm.trial) {
      h += '<div class="slw-shopswitch"><button type="button" class="slw-switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-afford="1">' +
        '<span class="tk" aria-hidden="true"><i></i></span><span class="tx">' + esc(tx('shop.filter.afford')) + '</span></button></div>';
    }
    if (vm.jumps.length > 1) {
      h += '<div class="slw-shopfilter slps-jumps"><span class="lb">' + esc(tx('shop.jump')) + '</span>' + vm.jumps.map(function (j) {
        return '<button type="button" class="slw-btn slw-jump" data-jump="slpsSh-' + k + '-' + j.key + '">' + esc(j.label) + '</button>';
      }).join('') + '</div>';
    }
    /* the free basic meal's line when 'I can buy' took its Food shelf (above the shelves left, or the empty state) */
    if (vm.note) h += '<p class="slps-line slps-note">' + esc(vm.note) + '</p>';
    vm.groups.forEach(function (g) {
      h += '<h4 class="slw-shelfhd" id="slpsSh-' + k + '-' + g.shelf + '" tabindex="-1">' + esc(g.title) + ' <span class="n">' + g.cards.length + '</span></h4>' +
        '<section class="slps-group" data-g="' + esc(g.key) + '" data-shelf="' + g.shelf + '" aria-labelledby="slpsSh-' + k + '-' + g.shelf + '">';
      if (g.meter) h += '<div class="slps-meter">' + esc(g.meter) + '</div>';
      g.lines.forEach(function (l) { h += '<p class="slps-line">' + esc(l) + '</p>'; });
      h += '<div class="slw-grid slps-grid">' + g.cards.map(function (c) { return cardHtml(E, c, vm); }).join('') + '</div></section>';
    });
    /* 'I can buy' with nothing to buy on this land: say so, then the thing nearest to it and '📚 Learn' (the Island Shop's
       empty state) */
    if (vm.empty) {
      h += '<div class="slw-shopempty slps-empty" role="status"><p>' + esc(vm.empty) + '</p>' +
        (vm.next ? '<p>' + esc(tx('shop.filter.next', { item: vm.next.name, n: fmt(vm.next.need) })) + '</p>' + (vm.next.learn ? learnBtn(vm.next) : '') : '') + '</div>';
    }
    return h + '</section>';
  }

  /* ---------------- the page's style (scoped: .slps-*; island-pixel's tokens when present) ---------------- */
  var CSS = [
    '.slps-ov .slw-sheet{max-width:880px;}',
    /* the shop itself is as wide as the Island Shop (the host's sheet: 960px) */
    '.slps-ov .slw-sheet.slw-shopsheet{max-width:960px;}',
    /* the land chips, the 'I can buy' switch, the Jump to row, the land heading and the shelf headings are the Island
       Shop's own (.slw-shopland, .slw-shopswitch, .slw-shopfilter, .slw-shopisle, .slw-shelfhd: island-pixel.css and
       the host's sheet style, sticky under the sheet's header by --slw-hdh); nothing here restyles them. Only the
       scrollbar of the two sideways rows is hidden, as the Island Shop's */
    '.slps-ov .slps-lands::-webkit-scrollbar,.slps-ov .slps-jumps::-webkit-scrollbar{display:none;}',
    '.slps-ov .slps-jumps{scrollbar-width:none;}',
    '.slps-banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 12px;padding:10px 12px;background:var(--px-sign,#FFF4D6);border:2px solid var(--px-sun-lip,#C99A00);border-radius:10px;color:var(--px-ink,#1B2150);font-weight:700;font-size:15px;line-height:1.35;}',
    '.slps-banner span{flex:1 1 200px;min-width:0;}',
    '.slps-group{margin:0 0 18px;}',
    '.slps-gear svg{max-width:100%;}',
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
    '.slps-name .slps-ask{margin:0;font-weight:700;font-size:16px;line-height:1.35;color:var(--px-ink,#1B2150);}',
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
    '@media (max-width:600px){',
    'html body .slps-ov .slps-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
    '.slps-card .ic{height:96px;}.slps-card .ic svg{max-height:88px;}.slps-food svg{width:80px;height:80px;max-height:80px;}',
    '.slps-room{grid-template-columns:repeat(2,minmax(0,1fr));}',
    '.slps-memgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
    '}',
    '@media (prefers-reduced-motion:no-preference){.slps-card.slps-got .slps-have{animation:slpsGot .42s ease-out 1;}}',
    /* R2 (QA2B-7): the card a learn trip comes back to (or an 'Adopt a {species} again'): a violet ring that stays; with motion
       allowed it breathes out twice at 1 Hz as it arrives (never faster than 2 Hz) */
    'html body .slps-ov .slps-card.slps-here{outline:4px solid var(--px-violet,#5B3FD6);outline-offset:3px;}',
    '@media (prefers-reduced-motion:no-preference){html body .slps-ov .slps-card.slps-here{animation:slpsHere 1s ease-in-out 2;}}',
    '@keyframes slpsHere{0%,100%{outline-offset:3px;}50%{outline-offset:8px;}}',
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
  /* R2 (QA2D-2): the scrim closes a sheet only for a tap that began on the scrim after the sheet was up — a click whose
     pointerdown came before the sheet was made, or within ARM ms of it, does nothing (the host's overlay() arms the same
     way) — and a once-only card (o.once: the new player's adopt offer) never closes from the scrim: its own buttons, ✕
     or Esc answer it. A guard on the document (capture: first in line on every engine) stops those clicks before the
     host's overlay sees them. deps.clock() → ms is a test seam (default Date.now) */
  var ARM = 400;
  function clockOf(E) { var c = E.deps.clock; return typeof c === 'function' ? c() : Date.now(); }
  function guardScrim(E, ov, once) {
    var doc = E.doc, made = clockOf(E), down = null, off = false;
    if (!doc || typeof doc.addEventListener !== 'function' || typeof ov.addEventListener !== 'function') return function () {};
    (typeof root.PointerEvent === 'function' ? ['pointerdown'] : ['mousedown', 'touchstart']).forEach(function (t) {
      ov.addEventListener(t, function (e) { down = { at: clockOf(E), scrim: e.target === ov }; }, true);
    });
    function onClick(e) {
      if (off || e.target !== ov) return;
      if (ov.isConnected === false) { stop(); return; }
      var d = down; down = null;
      if (!once && d && d.scrim && d.at - made >= ARM) return;     /* armed: the overlay's own listener closes it */
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    function stop() { if (!off) { off = true; doc.removeEventListener('click', onClick, true); } }
    doc.addEventListener('click', onClick, true);
    return stop;
  }
  function sheet(E, inner, o) {
    injectCss(E);
    o = o || {};
    var opts = {}, unguard = null;
    Object.keys(o).forEach(function (k) { if (k !== 'once') opts[k] = o[k]; });
    opts.onClose = function () { if (unguard) unguard(); if (o.onClose) o.onClose(); };
    var ov = E.deps.overlay(inner, opts);
    if (ov) unguard = guardScrim(E, ov, !!o.once);
    return ov;
  }
  function q(el, sel) { return el && typeof el.querySelector === 'function' ? el.querySelector(sel) : null; }
  function qa(el, sel) { return el && typeof el.querySelectorAll === 'function' ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; }
  /* each button gets its own listener after a draw (no event delegation) */
  function bind(el, sel, fn) { qa(el, sel).forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) fn(b); }); }); }
  function okOf(res) { return res === true || !!(res && res.ok); }

  /* ================================================================
     THE PET SHOP
     ================================================================ */
  /* a sideways row (the land chips, Jump to) marks the end with more to see (data-more 'l', 'r' or 'lr': island-pixel's
     soft fade and arrow, as the Island Shop's rowEdges); a tap on an arrow (the row itself, within its end) slides it */
  function rowEdges(row) {
    if (!row || !row.getAttribute) return '';
    var max = (row.scrollWidth || 0) - (row.clientWidth || 0), x = row.scrollLeft || 0, m = '';
    if (max > 8) m = (x > 8 ? 'l' : '') + (x < max - 8 ? 'r' : '');
    if ((row.getAttribute('data-more') || '') !== m) { if (m) row.setAttribute('data-more', m); else row.removeAttribute('data-more'); }
    return m;
  }
  function wireEdges(row) {
    if (!row || typeof row.addEventListener !== 'function') return;
    if (!row._slpsEdges) {
      row._slpsEdges = true;
      row.addEventListener('scroll', function () { rowEdges(row); }, { passive: true });
      row.addEventListener('click', function (e) {
        var m = row.getAttribute('data-more') || '';
        if (!m || !e || e.target !== row || typeof row.getBoundingClientRect !== 'function') return;
        var b = row.getBoundingClientRect(), x = e.clientX - b.left, end = 56;
        var dir = x >= b.width - end && m.indexOf('r') >= 0 ? 1 : x <= end && m.indexOf('l') >= 0 ? -1 : 0;
        if (dir) { row.scrollLeft = Math.max(0, (row.scrollLeft || 0) + dir * Math.round((row.clientWidth || 0) * 0.6)); rowEdges(row); }
      });
    }
    rowEdges(row);
  }
  /* a pressed chip comes into view in its sideways row, never scrolling the sheet itself */
  function showChip(row, b) {
    if (!row || !b || typeof b.getBoundingClientRect !== 'function' || !(row.scrollWidth > row.clientWidth + 1)) return;
    var sr = row.getBoundingClientRect(), br = b.getBoundingClientRect(), x0 = sr.left + (row.clientLeft || 0);
    if (br.left < x0 - 0.5 || br.right > x0 + row.clientWidth + 0.5) row.scrollLeft += br.left - x0;
  }
  /* draw()'s focus for a land chip: the chip pressed (its row is drawn again), never a selector in the page */
  var LAND_CHIP = ':land';
  /* the sheet's sticky header (the host's .slw-sheethd: the title, the balance and ✕) */
  function headH(ov) { var hd = q(ov, '.slw-sheethd'); return hd && hd.offsetHeight > 0 ? hd.offsetHeight : 0; }

  function openPetShop(deps, opts) {
    var E = env(deps);
    opts = opts || {};
    if (!E.C || typeof E.deps.overlay !== 'function' || !E.shop) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var ov = sheet(E, '<h2>' + esc(tx('care.shop.title')) + '</h2><div class="slw-shopland slps-lands" role="group" aria-label="' + esc(tx('shop.at')) + '"></div><div class="slps-body"></div>',
        { cls: 'slps-ov', onClose: function () { stopLazy(); resolve(true); } });
      var landsEl = q(ov, '.slps-lands'), body = q(ov, '.slps-body'), sc = q(ov, '.slw-sheet'), io = null, busy = false, markQ = false;
      /* the Island Shop's sheet: its height stays whatever 'I can buy' shows, and a focused card scrolls clear of the bands */
      if (sc && sc.classList) sc.classList.add('slw-shopsheet');
      var at = { land: 'home', filter: 'all' };
      function stopLazy() { if (io) { try { io.disconnect(); } catch (e) { /* gone */ } io = null; } }
      /* lazy photocards: each shelf of animals is filled as it scrolls into view (none on LOW or in 2D; never food or gear) */
      function lazy() {
        stopLazy();
        if (!E.use3D() || typeof E.deps.fillPhotocards !== 'function') return;
        var groups = qa(body, '.slps-group').filter(function (g) { return g.getAttribute('data-shelf') === 'animals'; });
        var fill = function (g) { try { E.deps.fillPhotocards(g); } catch (e) { /* the 2D sprite stays */ } };
        if (typeof root.IntersectionObserver !== 'function') { groups.forEach(fill); return; }
        io = new root.IntersectionObserver(function (ents) {
          ents.forEach(function (en) { if (en.isIntersecting) { if (io) io.unobserve(en.target); fill(en.target); } });
        }, { root: sc, rootMargin: '160px 0px' });
        groups.forEach(function (g) { io.observe(g); });
      }
      /* a Jump to chip: the sheet scrolls to that shelf (under the sticky bands: the heading's scroll-margin-top and the
         sheet's header) and the heading takes focus, so a keyboard and a screen reader land there too */
      function jumpTo(id, quiet) {
        var h = q(body, '#' + id);
        if (!h || !sc || typeof h.getBoundingClientRect !== 'function') return;
        var cs = null;
        try { cs = root.getComputedStyle ? root.getComputedStyle(h) : null; } catch (e) { cs = null; }
        var m = ((cs && parseFloat(cs.scrollMarginTop)) || 8) + headH(ov);
        var top = sc.scrollTop + h.getBoundingClientRect().top - sc.getBoundingClientRect().top - m;
        pin = id;
        try { if (typeof sc.scrollTo === 'function') sc.scrollTo({ top: top, behavior: E.reduced() || quiet ? 'auto' : 'smooth' }); else sc.scrollTop = top; } catch (e) { sc.scrollTop = top; }
        try { if (h.focus) h.focus({ preventScroll: true }); } catch (e) { /* gone */ }
        markShelf();
      }
      /* Jump to marks the shelf in view (aria-current and the 'on' look): the shelf just jumped to until the child scrolls
         the sheet themselves (pin: a short last shelf's heading never reaches the band, so it would never be marked);
         else the last shelf whose heading has come up to the Jump to band, the last one once the sheet is at its very
         bottom, else the first */
      var pin = null;
      function unpin() { pin = null; }
      function markShelf() {
        var row = q(body, '.slps-jumps'), chips = qa(row, '[data-jump]');
        if (!chips.length) return;
        var band = typeof row.getBoundingClientRect === 'function' ? row.getBoundingClientRect().bottom : 0, cur = null;
        if (pin) cur = chips.filter(function (c) { return c.getAttribute('data-jump') === pin; })[0] || null;
        if (!cur) {
          chips.forEach(function (c, i) {
            var h = q(body, '#' + c.getAttribute('data-jump'));
            if (h && (i === 0 || (typeof h.getBoundingClientRect === 'function' && h.getBoundingClientRect().top <= band + 24))) cur = c;
          });
          var max = sc ? (sc.scrollHeight || 0) - (sc.clientHeight || 0) : 0;
          if (max > 1 && (sc.scrollTop || 0) >= max - 2) cur = chips[chips.length - 1];
        }
        chips.forEach(function (c) {
          var on = c === cur;
          if (c.classList) c.classList.toggle('on', on);
          if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
        });
        if (cur) showChip(row, cur);
      }
      if (sc && typeof sc.addEventListener === 'function') {
        try {
          sc.addEventListener('scroll', function () {
            if (markQ) return;
            markQ = true;
            setTimeout(function () { markQ = false; if (ov.isConnected !== false) markShelf(); }, 80);
          }, { passive: true });
          /* the child's own scrolling (a wheel, a finger, a key, a drag on the scrollbar) ends the jump's pin */
          ['wheel', 'touchstart', 'keydown', 'pointerdown', 'mousedown'].forEach(function (t) { sc.addEventListener(t, unpin, { passive: true }); });
        } catch (e) { /* no scroll events: the first shelf stays marked */ }
      }
      function draw(focusSel) {
        var vm = shopView(deps, at), top = sc ? sc.scrollTop : 0, jr = q(body, '.slps-jumps'), lsl = landsEl.scrollLeft || 0, jsl = jr ? jr.scrollLeft || 0 : 0;
        at = { land: vm.land, filter: vm.filter };
        landsEl.innerHTML = landsHtml(E, vm);
        body.innerHTML = bodyHtml(E, vm);
        if (sc) sc.scrollTop = top;
        landsEl.scrollLeft = lsl;
        var jr2 = q(body, '.slps-jumps');
        if (jr2) jr2.scrollLeft = jsl;
        /* a land chip: that land's page, from its top; 'I can buy' stays as it was (the Island Shop's way); focus stays on
           the chip just pressed (its row is drawn again), as in the Island Shop */
        bind(landsEl, '[data-land]', function (b) {
          at = { land: b.getAttribute('data-land'), filter: at.filter };
          pin = null;
          draw(LAND_CHIP);
          if (sc) sc.scrollTop = 0;
        });
        bind(body, '[data-afford]', function () { pin = null; at = { land: at.land, filter: at.filter === 'afford' ? 'all' : 'afford' }; draw('[data-afford]'); });
        bind(body, '[data-jump]', function (b) { jumpTo(b.getAttribute('data-jump')); });
        bind(body, '[data-a]', act);
        lazy();
        var pressed = q(landsEl, '[aria-pressed="true"]');
        showChip(landsEl, pressed);
        wireEdges(landsEl);
        wireEdges(jr2);
        markShelf();
        var el = focusSel === LAND_CHIP ? pressed : focusSel ? q(body, focusSel) : null;
        if (focusSel && (!el || el.disabled)) el = pressed;
        try { if (el && el.focus) el.focus(); } catch (e) { /* gone */ }
        return vm;
      }
      function act(b) {
        var a = b.getAttribute('data-a');
        if (busy) return;
        var id = b.getAttribute('data-id'), card = id ? q(body, '.slps-card[data-id="' + id + '"]') : null, err = card ? q(card, '.slw-err') : null;
        /* a pet the child has: the Corner opens where it is (the Pet Corner picks the tab); the cap card, the banner and a
           piece of gear the child has (worn in My pets) open it plain */
        if (a === 'corner') { if (E.deps.openCorner) E.deps.openCorner(id && card && own(PLACE, card.getAttribute('data-state')) ? id : undefined); return; }
        /* wave 3: learn and come back for this card (the host closes the sheets; false keeps the shop open) */
        if (a === 'learn') { learnFor(E, id, ov, at); return; }
        if (a === 'open') { openDetail(E, deps, id, function () { draw('.slps-card[data-id="' + id + '"] .ic'); }, at); return; }
        busy = true;
        /* redraw (counts, states, the cap) unless a refusal's reason is on the card: that card stays as it is */
        var done = function (ok, sel) { busy = false; if ((ok || !(err && err.textContent)) && ov.isConnected !== false) draw(sel); };
        if (a === 'buy') {
          buyFood(E, id, b, err).then(function (ok) {
            done(ok, '[data-a="buy"][data-id="' + id + '"]');
            var c = q(body, '.slps-card[data-id="' + id + '"]');
            if (ok && c && !E.reduced()) c.classList.add('slps-got');
          });
        } else if (a === 'gear') {
          /* bought: the card now says ✓ Owned with My pets (where it is worn); focus goes there, else to the card's picture.
             The host's celebration card is over the shop then and hands no focus back: when it goes, focus comes back here */
          buyGear(E, id, b, err).then(function (ok) {
            var sel = ok ? '.slps-card[data-id="' + id + '"] [data-a]' : '[data-a="gear"][data-id="' + id + '"]';
            done(ok, sel);
            if (ok) afterCele(E, ov, function () { return q(body, sel) || q(body, '.slps-card[data-id="' + id + '"] .ic'); });
          });
        } else adopt(deps, id, { btn: b, err: err }).then(function (ok) { done(ok, '.slps-card[data-id="' + id + '"] .ic'); });
      }
      ov._petShopDraw = draw;
      /* where it opens: the opening name (opts.filter) on the land the child is on. Opened on one card (the Pet Corner's
         'Adopt a {species} again', a food's sheet, the way back from a learn trip): the land and filter the trip left from
         when they still show the card (R2), else the card's own land (a food: the land asked for) with 'I can buy' off
         when it would hide the card; the card in view, ringed (.slps-here: static under reduced motion) and focused (its
         button when it can be used, else its picture) */
      var vm0 = shopView(deps, opts.filter), want = typeof opts.id === 'string' ? opts.id : null, trip = want ? tripFor(E, want) : null, jump = vm0.jump;
      at = { land: vm0.land, filter: vm0.filter };
      var inView = function (a0) { return shopView(deps, a0).groups.some(function (g) { return g.cards.some(function (c) { return c.id === want; }); }); };
      if (want) {
        jump = null;
        var home = landOfId(E, want);
        if (trip && inView({ land: trip.land, filter: trip.filter })) at = { land: trip.land, filter: trip.filter };
        else {
          if (home) at.land = home;
          if (at.filter !== 'all' && !inView(at)) at.filter = 'all';
        }
      }
      draw();
      var card = want ? q(body, '.slps-card[data-id="' + want + '"]') : null;
      if (card) {
        card.classList.add('slps-here');
        setTimeout(function () {
          if (card.isConnected === false) return;
          var b = qa(card, '.row [data-a]').filter(function (x) { return !x.disabled; })[0] || q(card, '.ic') || q(card, '[data-a]');
          try { if (card.scrollIntoView) card.scrollIntoView({ block: 'center' }); if (b && b.focus) b.focus(); } catch (e) { /* gone */ }
        }, 60);
      } else if (jump) {
        /* 'food' (the pantry's way in): the land's page, scrolled to its Food shelf once the sheet is up; never once the
           child has started on the page (a tap there moves focus into it) */
        setTimeout(function () {
          var d = E.doc, a = d && d.activeElement;
          /* (the land chips count too: a button that switched off hands its focus to the pressed chip) */
          if (ov.isConnected === false || (a && ((body.contains && body.contains(a)) || (landsEl.contains && landsEl.contains(a))))) return;
          jumpTo('slpsSh-' + at.land + '-' + jump, true);
        }, 60);
      }
    });
  }

  /* wave 3 (contract 5): the host's learn-and-come-back trip for this id, from the Pet Shop; the sheet closes unless the
     host says no (it may already have closed every sheet). R2 (QA2B-7): the shop remembers the card, the land and the
     filter it was on (in memory, for the trip's 3 hours), so the way back (the host's openPetShop {filter: 'all' | 'food',
     id}) opens that land on that card (spec §7: 'reopens the Pet Shop on that animal') */
  var TRIP_MS = 3 * 3600 * 1000, lastTrip = null;
  function learnFor(E, id, ov, at) {
    if (typeof E.deps.learnFor !== 'function') return;
    var r;
    lastTrip = { id: id, land: at && typeof at.land === 'string' ? at.land : 'home', filter: at && at.filter === 'afford' ? 'afford' : 'all', at: clockOf(E) };
    try { r = E.deps.learnFor(id, { from: 'petShop' }); } catch (e) { r = false; }
    if (r === false) { lastTrip = null; return; }
    if (ov && ov.isConnected !== false && typeof ov._close === 'function') ov._close();
  }
  /* the remembered trip for this id, once (null when it is another id or older than the trip) */
  function tripFor(E, id) {
    var t = lastTrip;
    if (!t || t.id !== id) return null;
    lastTrip = null;
    var age = clockOf(E) - t.at;
    return age >= 0 && age <= TRIP_MS ? t : null;
  }
  /* a piece of pet gear: the host's ordinary buy flow (its confirm card, test mode, its own celebration) */
  /* the host's celebration card (.slw-cele, the Clothes buy's) never hands focus back: once no celebration is up, focus
     comes back to find() in the shop — only when the shop is the top sheet and focus was left on nothing (the page's
     body), never over the sheet a celebration button opened (My pets) or away from where the child put it. Without
     MutationObserver nothing is done */
  function afterCele(E, ov, find) {
    var d = E.doc, MO = root.MutationObserver;
    if (!d || !d.body || typeof MO !== 'function' || !q(d, '.slw-cele')) return;
    var mo = new MO(function () {
      if (q(d, '.slw-cele')) return;
      mo.disconnect();
      var a = d.activeElement, top = qa(d, '.slw-ov').pop();
      if (ov.isConnected === false || top !== ov || (a && a !== d.body && a !== d.documentElement)) return;
      var el = find();
      try { if (el && el.focus) el.focus(); } catch (e) { /* gone */ }
    });
    mo.observe(d.body, { childList: true });
  }
  function buyGear(E, id, btn, err) {
    if (typeof E.deps.buyGear !== 'function') return Promise.resolve(false);
    return Promise.resolve(E.deps.buyGear(id, { btn: btn, err: err })).then(okOf, function () { return false; });
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
  function openDetail(E, deps, id, after, tab) {
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
        if (c.learn) { learnFor(E, id, ov, tab); return; }
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
  var askSeq = 0;
  function nameStep(E, id) {
    var C = E.C, u = E.user(), w = u && u.world, p = w ? C.crewPet(w, id) : null, start = p ? p.name : (C.DEFAULT_PET_NAMES || {})[id] || '';
    return new Promise(function (resolve) {
      var answered = false, fin = function (v) { if (!answered) { answered = true; resolve(v); } };
      /* the new pet in the shop's own style: its photocard in 3D (the hamster is not a flat sprite there), the sprite in 2D and on LOW */
      /* R2 (QA2A-11): the sheet says what to do (care.nameAsk, the box's own label too) and the box is named 'Name' */
      var ask = 'slpsAsk' + (++askSeq);
      var ov = sheet(E, '<h2>' + esc(speciesName(E, id)) + '</h2><div class="slps-name"><div class="slps-namepic">' + petPic(E, id) + '</div>' +
        '<p class="slps-ask" id="' + ask + '">' + esc(tx('care.nameAsk')) + '</p>' +
        '<input type="text" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="' + esc(tx('care.nameBox')) + '" aria-describedby="' + ask + '" value="' + esc(start) + '">' +
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
        /* once-only (R2): 'Later', ✕ or Esc answer it; the scrim never does */
        { small: true, cls: 'slps-ov slps-offerov', once: true, onClose: function () { fin('later'); } });
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
