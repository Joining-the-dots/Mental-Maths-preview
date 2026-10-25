/* ================================================================
   My Island v3 — the Island Shop view-model for 240 ids (pure; no DOM,
   no storage). window.SLIslandShop in the browser (load after
   world-isles-ui.js), require() in Node.

   A child standing on the pier wants the pier's rides, not a 240-card
   scroll (D99): each land's shop is a handful of shelves, the All tab
   shows one doorway card per owned land instead of its 25 things, and
   the Crew tab folds each land's mascots and gear away until the child
   is on that island. This file works out WHAT goes where; the host draws
   it. Every function takes the core (SLWorldCore) first and only READS
   the profile or world it is given: nothing here buys, places, equips,
   awards or spends, and nothing is remembered between calls.

     sections(C, u, {trial, isle})
         → [{isle, name, owned, status, price, landId, landmarkId, landmarkUid, lead,
             counts {things, mascots, gear, all}, shelves: [{key, labelKey, ids}]}]
         the five lands in ISLE_ORDER (one when isle names a sky island). status: 'open'
         (owned) | 'price' | 'free' (test mode). lead = the cards above the shelves, in
         order: the land itself while it is locked (the one thing to buy there), then the
         landmark (never for sale: it comes with the land). Shelves come from C.ISLE_SHELVES,
         cheapest first (mascots cheapest first, then gear cheapest first). A locked
         land's section is the SAME cards: the core's itemState says 'locked' for each,
         so the host shows the 'Needs <land>' chip and no Buy. labelKey is the land's own
         wording for a shelf (shop.shelf.<isle>.<key>) when the copy has one, else
         shop.shelf.<key>. counts: things = the land's themed things (the {n} of
         shop.isleCount), then its mascots and gear; all = every card of the section.
     allTab(C, u, {trial})
         → {ids, isleCards: [{isle, things}]}: the ⭐ All tab. ids = the V4.54 shop items and
         the five land cards in the V4.54 order (what you can buy first, owned one-offs
         last, cheapest first inside each); one island card per OWNED land (things = that
         section's counts.things). Never a land's themed things, mascots or gear.
     afford(C, u, {trial, isle})
         → [{isle: null | isle, ids}]: 'I can buy'. The Home list first (isle null: V4.54
         items, lands and the Home Pet Shop's isle 'home' pets), then one group per land
         with something affordable, cheapest first. A locked thing is never affordable, nor
         is a pet the cap shuts out (petState 'ownFull' / 'homeFull'); empty groups are left
         out. Optional isle = the sky island the child is standing on: its group moves to
         the front (on a phone the Home list alone can be 50 cards); without it the order is
         as above.
     crewAisle(C, u, {isle, trial, food})
         → [{key: 'pets' | 'food' | 'gear' | isle, labelKey, ids, collapsed}]: the Crew tab.
         'pets' is the Home Pet Shop: the V4.54 pets (the first one included: the whole
         crew is on show) and the pets with isle 'home', cheapest first; then the V4.54
         accessories, then per land its mascots and four pieces of gear (the same cards as
         that land's 'Mascots & gear' shelf), cheapest first. A land group is collapsed
         unless it is the island passed in (D114) and also carries {name, owned, status,
         price} for its header. Every group with pets carries states {petId: petState}.
         food: true adds the 'food' group (C.foodItems(), catalogue order) straight after
         'pets'; it is opt-in because the W5b.1 host draws every group but pets and gear
         as a land header.
     petState(C, u, id, {trial})
         → null (not a pet) | 'atHome' | 'atHotel' | 'atRescue' (owned: where it is, from
         C.petWhere) | 'locked' (its land first) | 'ownFull' (cap 'total') | 'homeFull'
         (cap 'home') | 'adopt'. A pet that became a star can be adopted again (KU39).
         The cap is read from C.petRoom(w) only (contracts.petCap); with no care core every
         owned pet is 'atHome'.
     shopPet(C, u, id, {trial})
         → null (not a pet) | the Island Shop's own card for a pet (the Crew tab, a land's 'Mascots &
         gear' shelf, the item sheet; A2, A4): {id, state (petState's), owned, price, free, can, code,
         afford, need?, wallet?, needs?, readopt?, chip, act, actKey, enabled, corner, line}: can, code
         and afford as on a Pet Shop card. A pet the child has (atHome,
         atHotel, atRescue): chip {cls 'own' | 'rep' | 'lock', key care.shop.atHome | care.shop.atHotel |
         care.shop.atRescueSafe ('Safe at the Pet Rescue'; while the grown-up's farewell switch is on
         care.shop.atRescue, 'At the Pet Rescue', KU40)}, act 'corner' with corner {petId, tab 'home' |
         'hotel' | 'rescue'} (the Pet Corner's openCorner options). At the cap ('ownFull'): chip {cls
         'uni', key care.shop.capFull ('3 of 3 pets'; above the cap care.shop.capKeep, 'Full: you have
         {n} pets'), params {n}}, act 'corner' with corner {petId null, tab 'home'}, line
         care.ownFull {n} for the sheet: never a Buy that does nothing. 'homeFull' (cap 'home'): chip
         care.pick.count, act 'room' (care.makeRoom: the Pet Shop's adoption makes room), line
         care.homeFull. 'locked': act 'see'. 'adopt': act 'buy' (need: what is still to earn), never
         for a pet that is not for sale (the free puppy). actKey = the button's copy key
         (care.corner.title, care.makeRoom) or null (the host's own Buy wording); enabled = the
         button can be pressed now (buy: can; room: afford; corner, see: always). chip and line are
         {key, params} for SLWorldCopy.t; null when the host's own chip stands. The chip keys are F-KU2's
         (the Pet Shop's): a copy table without them falls back to care.rescue.title, or to no chip.
     petShop(C, u, {filter, trial})
         → [groups] for the Pet Shop (pets U8): the food group, then the Home Pet Shop,
         then each land's animals in ISLE_ORDER (a locked land is shown, never hidden).
         filter: 'all' (default; anything unknown) | 'food' | 'adopt' ('I can adopt now':
         'adopt' cards the child can take now, and with cap 'home' the 'homeFull' ones they
         can afford through 'Make room'; empty groups left out) | 'home' | a land. A pet
         group is {key, isle, name, owned, status, price, landId, items: [{id, kind 'pet',
         name, isle, price, free, state, can, code, afford, need?, needs?, readopt?, fav,
         favFood, wallet?}]}: can and code are C.purchaseCheck's answer (code 'insufficient'
         with need = what is still to earn; any refusal with a number need is a shortfall),
         afford = the price and land allow it with the cap aside (itemState opts.capAside), fav the species' favourite food group (SLPetCare.DIET when loaded) and
         favFood the first food of that group. The food group is {key
         'food', labelKey, meals (in the pantry, treats left out), max (CARE.pantryMax),
         trialMax and lineKey 'care.trialPantry' in test mode (KU38), items: [{id, kind
         'food', name, price, free, meals, group, have, state 'affordable' | 'short' |
         'full' | 'trialFull' | 'unavailable', can, code, need?, icon, art: '2d'}]}: a food
         card names its 2D icon (icon = the food id, drawn by world-art-pets) and never
         asks for a photocard.
     wearTray(C, w, petId)
         → [{slot, labelKey, items: [{id, on}]}] for hat, neck, face, back: the OWNED
         accessories of each slot, the one that crew member wears marked (C.wornBy).
         [] when petId is not in the crew.
     crewSheet(C, w, cap)
         → {list, resting, hotel}: list = C.crewList(w), each with isle (a mascot's land,
         else null) and from (that island's name) and where (C.petWhere once care has
         started, else null); resting = how many are indoors when only cap of them (never
         fewer than the runner) are out at once (D97). Once care has started (C.careOf(w))
         the list is the home pets only, in home order, with careRunner's pet as the
         active one, and hotel = how many are at the Pet Hotel (else 0).

   Wallets (F-KU4, for the overnight fixes F-KU3). Every call's opts may name a wallet, opts.wallet
   'coins' | 'stars', passed to the core as it is (without it the core's ECONOMY.wallet decides):
   can, code, need and every price on a card (C.priceOf) are in that wallet, and a card made in 🪙
   carries wallet: 'coins' (a ⭐ card none, as before); the coins (w.coins) are read from the world
   copy every call makes. F-KU4's itemState shows the
   pet cap itself ({state 'full', code 'own_full'}): petState reads that as 'ownFull' too, and RANK
   puts 'full' with what cannot be bought now.

   Characters and the wardrobe (kids update KU-CH15; characters.json CH-D5, CH-D15, CH-D16 and
   uiFlows.child 'Island Shop'). The 12 characters ('char') and the pieces of wear ('wear') are
   the people plug-in's catalogue items (SLPeopleCore registers them with C.defineItems; they are
   in C.extraItems(), never in CATALOG). Everything below is read from the core passed in, so a
   core without the plug-in gives exactly the answers above: no Dress-up shelf, no wear in
   'I can buy', no Wardrobe card on the All tab. What the shop sells: every character but 'Me'
   and every piece but the free basics and the signature pieces (those come with their
   character). A land's character and its 4 pieces need the land (shelfIsle + requires).
     sections()   + a land's 'Dress-up' shelf after its crew shelf (D16): {key 'dressup', labelKey
                  (shop.shelf.<isle>.dressup, else shop.shelf.dressup), ids: the land's character
                  first, then its pieces cheapest first, lead: the character's id}; counts gains
                  dressup (those cards; things, mascots and gear are unchanged) and all counts them.
     allTab()     + wardrobe {things, left} for the All tab's one doorway card into the 👕 Wardrobe
                  tab (D99: one card, never its 90-odd things): things = the tab's cards, left = the
                  ones not owned yet.
     afford()     + {isle: null, key 'wardrobe', labelKey 'wardrobe.title', ids} straight after the
                  Home list: the characters and pieces anyone can buy, cheapest first. A land's own
                  character and pieces are in that land's group (they are on its Dress-up shelf).
   Only when SLPeopleCore is loaded (the browser global, or people-core.js already required in
   Node: this file never loads it, since loading it registers the plug-in), three more exports:
     wardrobeTab(C, u, {trial, slot})
         → [{key, labelKey, ids, left, open}] the 👕 Wardrobe tab, one entry per chip in WARDROBE
         order: 'chars' (char.cast.title), then outfit, top, bottom, shoes, head, face, neck, back,
         hand and 'dye' (wardrobe.slot.<key>). ids in the V4.54 shop order (what you can buy, what
         you are saving for, locked, owned last; cheapest first inside each), a land's pieces and
         character included (locked until the land is open). left = not owned yet; open = the chip
         named by slot, else Outfits (whole looks to try first, A6), else the first chip; exactly
         one chip is open. [] without the plug-in.
     wardrobeCard(C, u, id, {trial})
         → null (not a character or a piece) | {id, kind 'char' | 'wear', name, price, free, state
         'owned' | 'affordable' | 'short' | 'locked' | 'comes' (a signature piece the child does not
         have) | 'have' (a free basic), can, code, need?, needs?, land, landName, goal, confirm,
         line: null | {key, params} (the card's status line: char.cast.opens {land},
         char.cast.need {n} (char.cast.needCoins on a 🪙 card, F-KU5), or wardrobe.free for a free
         basic)}; free = test mode, as on every shop card (the price row's FREE; ⭐ and 🪙 untouched); a character adds theme, comes (the
         pieces it brings that the child does not have yet, for char.cast.comes), move {id, key
         'move.<id>'} and active; a piece adds slot, slotKey, cw, flags, dye (the hair colour code
         a dye unlocks) and with (the character a signature piece comes with).
     WARDROBE    the tab's chip keys, frozen.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var copy = null, care = null, people = null;
    try { copy = require('./world-copy.js'); } catch (e) { copy = null; }
    try { care = require('./pet-care.js'); } catch (e) { care = null; }
    /* the people plug-in only if it is already loaded: requiring it would register it into the core */
    try { var pf = require.resolve('./people-core.js'); people = require.cache[pf] ? require(pf) : null; } catch (e) { people = null; }
    module.exports = factory(root, copy, care, people);
  } else root.SLIslandShop = factory(root, null, null, root.SLPeopleCore || null);
}(typeof self !== 'undefined' ? self : this, function (root, COPY0, CARE0, PEOPLE) {
  'use strict';

  var SLOTS = Object.freeze(['hat', 'neck', 'face', 'back']);
  /* the V4.54 shop order: what you can buy, what you are saving for, what is locked, what you have */
  var RANK = { affordable: 0, short: 1, locked: 2, capped: 3, owned: 3, full: 3 };   /* full: a pet the cap shuts out (F-KU4) */
  /* where an owned pet is (C.petWhere) → its Pet Shop state; a star is not here (it can be adopted again) */
  var AT = { home: 'atHome', hotel: 'atHotel', rescue: 'atRescue' };
  /* a food's purchaseCheck refusal → its card state (anything else: 'unavailable') */
  var FOOD_STATE = { insufficient: 'short', pantry_full: 'full', trial_pantry: 'trialFull' };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  /* the core's options for a call: test mode, and the wallet a host names (F-KU4's opts.wallet, 'coins' or
     'stars'; without it the core's own ECONOMY.wallet decides) */
  function optsOf(opts) {
    var o = { trial: !!(opts && opts.trial) };
    if (opts && typeof opts.wallet === 'string') o.wallet = opts.wallet;
    return o;
  }
  /* what a thing costs in the wallet the call uses (C.priceOf, F-KU4), else its ⭐ price */
  function priceIn(C, it, o) {
    var p = typeof C.priceOf === 'function' ? C.priceOf(it.id, o) : null;
    return typeof p === 'number' && isFinite(p) ? p : it.price;
  }
  /* 'coins' when the call pays in 🪙 (C.walletOf, F-KU4); a card names its wallet only then */
  function coinsIn(C, o) { return typeof C.walletOf === 'function' && C.walletOf(o) === 'coins'; }
  function copy() { return COPY0 || (root && root.SLWorldCopy) || null; }
  function copyHas(key) { var CP = copy(); return !!(CP && CP.STRINGS && has(CP.STRINGS, key)); }
  /* the care rules (P1.2) only for the favourite foods (DIET); found at call time in the browser */
  function petCare() { return CARE0 || (root && root.SLPetCare) || null; }

  function def(C, k) { return typeof k === 'string' && has(C.ISLES, k) ? C.ISLES[k] : null; }
  function skyKey(C, k) { return k !== 'home' && def(C, k) ? k : null; }
  function skyOrder(C) { return C.ISLE_ORDER.filter(function (k) { return k !== 'home'; }); }
  /* a save's world, from the profile or the world itself (a profile with no world yet reads
     as an empty one); the caller's object is never given a world and never changed */
  function worldOf(C, x) {
    var w = x && typeof x.world === 'object' && x.world && !x.owned ? x.world : x;
    return w && typeof w.owned === 'object' && w.owned ? w : C.emptyWorld();
  }
  /* what itemState reads: the balance and a one-level copy of the world (F-KU4's 🪙 wallet, w.coins, comes
     with it). The core fills in any field an old save lacks before it reads (ensureWorld); on a copy that
     never lands in the child's save. A bare world has no balance to read. */
  function userOf(C, u) {
    var w = worldOf(C, u), copyW = {};
    Object.keys(w).forEach(function (k) { copyW[k] = w[k]; });
    return { points: u && !u.owned && typeof u.points === 'number' ? u.points : 0, world: copyW };
  }
  /* cheapest first in the island's money (F-KU5: the wallet o names, else the core's, so 🪙 since the two
     wallets); equal prices keep the ⭐ order, then the order they came in (old engines' sort is not stable) */
  function byPrice(C, ids, o) {
    return ids.map(function (id, i) { var it = C.item(id); return { id: id, i: i, p: priceIn(C, it, o), s: it.price }; })
      .sort(function (a, b) { return (a.p - b.p) || (a.s - b.s) || (a.i - b.i); })
      .map(function (e) { return e.id; });
  }
  function isPet(C, id) { return C.item(id).kind === 'pet'; }
  function isAcc(C, id) { return C.item(id).kind === 'acc'; }
  /* a shelf's cards: mascots cheapest first, then everything else cheapest first (on every
     shelf but 'Mascots & gear' that is simply cheapest first) */
  function shelfOrder(C, ids) {
    var live = ids.filter(function (id) { var it = C.item(id); return !!it && !it.retired && !it.included; });
    return byPrice(C, live.filter(function (id) { return isPet(C, id); }))
      .concat(byPrice(C, live.filter(function (id) { return !isPet(C, id); })));
  }
  function shelfLabel(k, key) { var own = 'shop.shelf.' + k + '.' + key; return copyHas(own) ? own : 'shop.shelf.' + key; }
  function shelvesOf(C, k) {
    var rows = C.ISLE_SHELVES && has(C.ISLE_SHELVES, k) ? C.ISLE_SHELVES[k] : [];
    var out = rows.map(function (s) {
      return { key: s[0], labelKey: shelfLabel(k, s[0]), ids: shelfOrder(C, s[1]) };
    }).filter(function (s) { return s.ids.length > 0; });
    var dress = dressupOf(C, k);
    return dress ? out.concat([dress]) : out;
  }
  function shopIds(C, k) {
    var out = [];
    shelvesOf(C, k).forEach(function (s) { out = out.concat(s.ids); });
    return out;
  }
  function landmarkUid(C, w, k) {
    var lm = C.ISLES[k].landmark, list = C.placedOn(w, k);
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === lm && list[i].uid) return list[i].uid;
    return null;
  }
  /* what a land's header shows: its name, whether it is open, and what it costs */
  function landHead(C, w, k, o) {
    var d = C.ISLES[k], land = C.item(d.unlock), owned = C.isleUnlocked(w, k);
    return { name: d.name, owned: owned, status: owned ? 'open' : o.trial ? 'free' : 'price', price: land ? priceIn(C, land, o) : 0 };
  }

  /* ---------------- characters and wear (the people plug-in; every call works without it) ---------------- */
  var PLUG = { char: 1, wear: 1 };
  /* the 👕 Wardrobe tab's chips: the characters, the nine slots in the design's order, then hair colours */
  var WARDROBE = Object.freeze(['chars', 'outfit', 'top', 'bottom', 'shoes', 'head', 'face', 'neck', 'back', 'hand', 'dye']);
  /* the chip the tab opens on when no slot is asked for: Outfits, whole looks to try (A6), else the first chip */
  var WARDROBE_OPEN = 'outfit';
  function isPlug(C, id) { var it = C.item(id); return !!it && has(PLUG, it.kind); }
  /* every character and piece the core has registered, in registration order; [] without the plug-in */
  function plugItems(C) {
    var all = typeof C.extraItems === 'function' ? C.extraItems() : null;
    return Array.isArray(all) ? all.filter(function (it) { return !!it && has(PLUG, it.kind) && !it.retired; }) : [];
  }
  /* what is sold: never 'Me' or a free basic (always had), never a signature piece (it comes with its character) */
  function onSale(it) { return !it.included && !it.free && !it.starter; }
  function soldItems(C) { return plugItems(C).filter(onSale); }
  /* the land a character or a piece belongs to (shelfIsle, never 'isle': that means v3 to the core) */
  function landOf(C, it) { return skyKey(C, it && it.shelfIsle); }
  /* a land's Dress-up shelf (CH-D16): its character as the lead card, then its pieces cheapest first */
  function dressupOf(C, k) {
    var mine = soldItems(C).filter(function (it) { return landOf(C, it) === k; });
    var ids = function (kind) { return byPrice(C, mine.filter(function (it) { return it.kind === kind; }).map(function (it) { return it.id; })); };
    var chars = ids('char'), all = chars.concat(ids('wear'));
    return all.length ? { key: 'dressup', labelKey: shelfLabel(k, 'dressup'), ids: all, lead: chars.length ? chars[0] : null } : null;
  }
  /* the V4.54 shop order (rewards-world.js openShop): what you can buy, what you are saving for, locked,
     owned last; cheapest first inside each (in the call's wallet, F-KU5); equal ones keep the ⭐ order, then the
     order they came in */
  function ranked(C, U, items, o) {
    return items.map(function (it, i) {
      var r = RANK[C.itemState(U, it.id, o).state];
      return { id: it.id, i: i, r: r == null ? 9 : r, p: priceIn(C, it, o), s: it.price };
    }).sort(function (a, b) { return (a.r - b.r) || (a.p - b.p) || (a.s - b.s) || (a.i - b.i); }).map(function (e) { return e.id; });
  }
  function wardrobeTab(C, u, opts) {
    opts = opts || {};
    var U = userOf(C, u), o = optsOf(opts), list = soldItems(C);
    var tab = WARDROBE.map(function (key) {
      var ids = ranked(C, U, list.filter(function (it) { return key === 'chars' ? it.kind === 'char' : it.kind === 'wear' && it.slot === key; }), o);
      return {
        key: key, labelKey: key === 'chars' ? 'char.cast.title' : 'wardrobe.slot.' + key, ids: ids,
        left: ids.filter(function (id) { return !C.owns(U.world, id); }).length, open: false
      };
    }).filter(function (s) { return s.ids.length > 0; });
    /* the chip asked for ('Shop more' names its slot), else Outfits, else the first; always one open */
    var keys = tab.map(function (s) { return s.key; });
    var open = keys.indexOf(opts.slot) >= 0 ? opts.slot : keys.indexOf(WARDROBE_OPEN) >= 0 ? WARDROBE_OPEN : keys[0];
    tab.forEach(function (s) { s.open = s.key === open; });
    return tab;
  }
  /* one character or piece as the Wardrobe tab, the Dress-up shelf and the cast carousel show it */
  function wardrobeCard(C, u, id, opts) {
    var it = C.item(id);
    if (!it || !has(PLUG, it.kind)) return null;
    var o = optsOf(opts), trial = o.trial, U = userOf(C, u);
    C.ensureWorld(U);
    var w = U.world, chk = C.purchaseCheck(U, id, o) || {}, st = C.itemState(U, id, o);
    var mine = C.owns(w, id), k = landOf(C, it), price = priceIn(C, it, o);
    var state = mine ? 'owned' : it.free ? 'have' : it.included ? 'comes' : st.state === 'locked' || st.state === 'short' ? st.state : 'affordable';
    var card = {
      id: id, kind: it.kind, name: it.name, price: price, free: trial, state: state,
      can: !!chk.ok, code: chk.ok ? null : chk.code || null, land: k, landName: k ? C.ISLES[k].name : null,
      goal: typeof C.goalId === 'function' && C.goalId(w) === id,
      confirm: !trial && !!chk.ok && !!C.ECONOMY && price >= C.ECONOMY.confirmAt, line: null
    };
    if (!chk.ok && typeof chk.need === 'number' && isFinite(chk.need)) card.need = chk.need;   /* a shortfall, whatever the wallet (F-KU4) */
    if (coinsIn(C, o)) card.wallet = 'coins';
    if (state === 'locked') {
      card.needs = (it.requires || []).filter(function (r) { return !C.owns(w, r); })[0] || null;
      card.line = { key: 'char.cast.opens', params: { land: k ? C.ISLES[k].name : card.needs && C.item(card.needs) ? C.item(card.needs).name : '' } };
    } else if (state === 'short' && has(card, 'need')) card.line = { key: card.wallet === 'coins' && copyHas('char.cast.needCoins') ? 'char.cast.needCoins' : 'char.cast.need', params: { n: card.need } };   /* 'You need 15 more 🪙' (F-KU5) */
    else if (state === 'have') card.line = { key: 'wardrobe.free', params: null };
    if (it.kind === 'char') {
      card.theme = it.theme || null;
      /* 'Comes with': only what is new to the child (CH economy.bundleValue: owning a piece gives no refund) */
      card.comes = (it.includes || []).filter(function (x) { var p = C.item(x); return !!p && !p.free && !C.owns(w, x); });
      card.move = it.move ? { id: it.move, key: 'move.' + it.move } : null;
      card.active = !!(PEOPLE && typeof PEOPLE.activeOf === 'function' && mine && PEOPLE.activeOf(w) === id);
    } else {
      card.slot = it.slot;
      card.slotKey = 'wardrobe.slot.' + it.slot;
      card.cw = it.cw || 1;
      card.flags = it.flags ? it.flags.slice() : [];
      card.dye = typeof it.hc === 'number' ? it.hc : null;
      card.with = it.with || null;
    }
    return card;
  }

  /* ---------------- pets and food (the kids update; every care call is feature-detected) ---------------- */
  /* a pet's shop: 'home' for the V4.54 pets and the Home Pet Shop's isle 'home' pets, else its land */
  function petIsle(it) { return it.isle ? it.isle : 'home'; }
  /* the species sold at k, cheapest first (a retired one never: species can be staged with retired) */
  function petsAt(C, k) {
    return byPrice(C, C.CATALOG.filter(function (it) { return it.kind === 'pet' && !it.retired && petIsle(it) === k; })
      .map(function (it) { return it.id; }));
  }
  function foods(C) { return typeof C.foodItems === 'function' ? C.foodItems() : []; }
  function foodLabel() { return copyHas('care.shop.food') ? 'care.shop.food' : 'care.pantry'; }
  /* one read of the save for a whole call: a shaped one-level copy (the core fills in what an old save
     lacks on the copy, never on the child's save), its balance, and the cap from C.petRoom */
  function ctxOf(C, u, opts) {
    var U = userOf(C, u), o = optsOf(opts);
    C.ensureWorld(U);
    return { C: C, U: U, w: U.world, o: o, trial: o.trial, coins: coinsIn(C, o), room: typeof C.petRoom === 'function' ? C.petRoom(U.world) : null };
  }
  function whereOf(x, id) { return typeof x.C.petWhere === 'function' ? x.C.petWhere(x.w, id) : null; }
  /* the cap as C.petRoom states it (no UI recomputes it): 'total' shuts adoption at max pets owned, 'home'
     when home is full (adopting then goes through 'Make room') */
  function capped(x) {
    var r = x.room;
    if (!r) return null;
    if (r.mode === 'home') return r.atCap ? 'homeFull' : null;
    return r.atCap || r.canAdopt === false ? 'ownFull' : null;
  }
  function stateOf(x, id) {
    var C = x.C, it = C.item(id);
    if (!it || it.kind !== 'pet') return null;
    var where = whereOf(x, id);
    if (C.owns(x.w, id) && where !== 'star') return has(AT, where) ? AT[where] : 'atHome';
    if ((it.requires || []).some(function (r) { return !C.owns(x.w, r); })) return 'locked';
    if (capped(x)) return capped(x);
    /* a core whose itemState shows the cap itself (F-KU4: {state 'full', code 'own_full'}) says so too */
    var s = C.itemState(x.U, id, x.o);
    return s && s.state === 'full' && s.code === 'own_full' ? 'ownFull' : 'adopt';
  }
  function petState(C, u, id, opts) { return stateOf(ctxOf(C, u, opts), id); }
  function statesOf(x, ids) {
    var out = {};
    ids.forEach(function (id) { var s = stateOf(x, id); if (s) out[id] = s; });
    return out;
  }
  /* can the child take it now, and if not, why (C.purchaseCheck: the core's own rule, in the call's wallet).
     A refusal with a number need is a shortfall (the 🪙 still to earn when the wallet is coins, F-KU4) */
  function checkOf(x, id) {
    var chk = x.C.purchaseCheck(x.U, id, x.o) || {};
    var out = { can: !!chk.ok, code: chk.ok ? null : chk.code || null };
    if (!chk.ok && typeof chk.need === 'number' && isFinite(chk.need)) out.need = chk.need;
    return out;
  }
  /* the price and the land allow it, the cap aside (with cap 'home' a full home adopts through 'Make room'):
     itemState with opts.capAside (F-KU4's itemState shows the pet cap itself; an older core never did) */
  function affordOf(x, id, chk) {
    if (chk.can) return true;
    var o = { trial: x.o.trial, capAside: true };
    if (has(x.o, 'wallet')) o.wallet = x.o.wallet;
    var s = x.C.itemState(x.U, id, o) || {};
    return s.state === 'affordable';
  }
  function pantryOf(x, id) {
    var n = typeof x.C.pantryCount === 'function' ? x.C.pantryCount(x.w, id) : 0;
    return typeof n === 'number' && isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function petCard(x, id) {
    var C = x.C, it = C.item(id), st = stateOf(x, id), chk = checkOf(x, id), D = petCare() && petCare().DIET;
    var fav = D && has(D, id) && D[id] && typeof D[id].fav === 'string' ? D[id].fav : null;
    var favFood = fav ? foods(C).filter(function (f) { return f.group === fav; })[0] : null;
    /* afford: the price and the land allow it, the cap aside (with cap 'home' a full home adopts through 'Make room') */
    var card = { id: id, kind: 'pet', name: it.name, isle: petIsle(it), price: priceIn(C, it, x.o), free: x.trial, state: st,
      can: chk.can, code: chk.code, afford: affordOf(x, id, chk),
      fav: fav, favFood: favFood ? favFood.id : null };
    if (has(chk, 'need')) card.need = chk.need;
    if (x.coins) card.wallet = 'coins';
    if (st === 'locked') card.needs = (it.requires || []).filter(function (r) { return !C.owns(x.w, r); })[0];
    if (C.owns(x.w, id) && whereOf(x, id) === 'star') card.readopt = true;
    return card;
  }
  function foodCard(x, it) {
    var chk = checkOf(x, it.id);
    var card = { id: it.id, kind: 'food', name: it.name, price: priceIn(x.C, it, x.o), free: x.trial, meals: it.meals, group: it.group,
      have: pantryOf(x, it.id), state: chk.can ? 'affordable' : has(FOOD_STATE, chk.code) ? FOOD_STATE[chk.code] : has(chk, 'need') ? 'short' : 'unavailable',
      can: chk.can, code: chk.code, icon: it.id, art: '2d' };
    if (has(chk, 'need')) card.need = chk.need;
    if (x.coins) card.wallet = 'coins';
    return card;
  }
  function foodGroup(x) {
    var K = x.C.CARE || {}, list = foods(x.C), meals = 0;
    list.forEach(function (it) { if (it.group !== 'treat') meals += pantryOf(x, it.id); });
    return {
      key: 'food', labelKey: foodLabel(), meals: meals, max: K.pantryMax || null,
      trialMax: x.trial && K.trialPantryMax ? K.trialPantryMax : null, lineKey: x.trial && K.trialPantryMax ? 'care.trialPantry' : null,
      items: list.map(function (it) { return foodCard(x, it); })
    };
  }
  function petGroup(x, k) {
    var C = x.C, head = k === 'home' ? { name: C.ISLES.home.name, owned: true, status: 'open', price: 0 } : landHead(C, x.w, k, x.o);
    return {
      key: k, isle: k, name: head.name, owned: head.owned, status: head.status, price: head.price,
      landId: k === 'home' ? null : C.ISLES[k].unlock, items: petsAt(C, k).map(function (id) { return petCard(x, id); })
    };
  }
  function petShop(C, u, opts) {
    opts = opts || {};
    var x = ctxOf(C, u, opts), f = opts.filter, out = [];
    if (f !== 'food' && f !== 'adopt' && f !== 'home' && !skyKey(C, f)) f = 'all';
    if ((f === 'all' || f === 'food') && foods(C).length) out.push(foodGroup(x));
    if (f === 'food') return out;
    ['home'].concat(skyOrder(C)).forEach(function (k) {
      if (f !== 'all' && f !== 'adopt' && f !== k) return;
      var g = petGroup(x, k);
      if (f === 'adopt') g.items = g.items.filter(function (c) { return c.state === 'adopt' ? c.can : c.state === 'homeFull' && c.afford; });
      if (g.items.length) out.push(g);
    });
    return out;
  }

  /* ---------------- the Island Shop's pet cards (A2, A4: overnight fixes F-KU3) ----------------
     The Crew tab, a land's 'Mascots & gear' shelf and the item sheet draw a pet from this: a pet the child
     has says where it is, and a pet the cap shuts out says so, with the Pet Corner instead of a Buy that
     would do nothing. The cap is C.petRoom's (stateOf), so it holds whatever itemState says about it. */
  var PLACE = { atHome: ['own', 'care.shop.atHome', 'home'], atHotel: ['rep', 'care.shop.atHotel', 'hotel'], atRescue: ['lock', 'care.shop.atRescueSafe', 'rescue'] };
  /* the first of these keys the copy table has (F-KU2's chips, shared with the Pet Shop), else null */
  function keyOf(keys) { for (var i = 0; i < keys.length; i++) if (copyHas(keys[i])) return keys[i]; return null; }
  /* the grown-up's farewell switch (KU40): while it is on, a pet at the Rescue is never promised to be safe */
  function farewellOn(x) {
    var cc = typeof x.C.careOf === 'function' ? x.C.careOf(x.w) : null;
    return !!(cc && cc.cfg && typeof cc.cfg === 'object' && cc.cfg.farewell === true);
  }
  function shopPet(C, u, id, opts) {
    var x = ctxOf(C, u, opts), it = C.item(id);
    if (!it || it.kind !== 'pet') return null;
    var c = petCard(x, id), st = c.state, room = x.room;
    var card = { id: id, state: st, owned: has(PLACE, st), price: c.price, free: c.free, can: c.can, code: c.code, afford: c.afford,
      chip: null, act: null, actKey: null, enabled: false, corner: null, line: null };
    ['need', 'wallet', 'needs', 'readopt'].forEach(function (k) { if (has(c, k)) card[k] = c[k]; });
    if (card.owned) {
      var p = PLACE[st];
      /* the Rescue: 'Safe at the Pet Rescue' only while the farewell switch is off; 'At the Pet Rescue' while it is on */
      var key = st !== 'atRescue' ? p[1] : farewellOn(x) ? keyOf(['care.shop.atRescue', 'care.rescue.title']) : keyOf([p[1], 'care.rescue.title']);
      card.chip = { cls: p[0], key: key, params: null };
      card.act = 'corner'; card.actKey = 'care.corner.title'; card.corner = { petId: id, tab: p[2] };
    } else if (st === 'ownFull') {
      /* 'total' at the cap: '3 of 3 pets' and the Pet Corner (the pets the child has); the sheet says why */
      /* above the cap (an old save with more): 'Full: you have {n} pets' */
      var full = room.count > room.max ? keyOf(['care.shop.capKeep', 'care.shop.capFull']) : keyOf(['care.shop.capFull']);
      card.chip = full ? { cls: 'uni', key: full, params: { n: room.count } } : null;
      card.act = 'corner'; card.actKey = 'care.corner.title'; card.corner = { petId: null, tab: 'home' };
      card.line = { key: 'care.ownFull', params: { n: room.count } };
    } else if (st === 'homeFull') {
      /* 'home' with home full: 'Make room' goes through the Pet Shop's adoption (a pet moves to the Hotel first) */
      card.chip = { cls: 'uni', key: 'care.pick.count', params: { n: room.max } };
      card.act = 'room'; card.actKey = 'care.makeRoom';
      card.line = { key: 'care.homeFull', params: null };
    } else if (st === 'locked') card.act = 'see';
    else if (c.code !== 'not_for_sale') card.act = 'buy';      /* 'adopt' (the free puppy is never for sale) */
    /* the button: a Buy when the core would take it now, Make room when the price allows it, a way to look always */
    card.enabled = card.act === 'buy' ? card.can : card.act === 'room' ? !!card.afford : !!card.act;
    return card;
  }

  /* ---------------- the Sky islands tab: one section per land ---------------- */
  function sections(C, u, opts) {
    opts = opts || {};
    var w = worldOf(C, u), only = skyKey(C, opts.isle);
    return skyOrder(C).filter(function (k) { return !only || k === only; }).map(function (k) {
      var d = C.ISLES[k], head = landHead(C, w, k, optsOf(opts)), shelves = shelvesOf(C, k);
      var counts = { things: 0, mascots: 0, gear: 0, all: 0 };
      /* the Dress-up shelf's cards are counted on their own: shop.isleCount still names the land's themed things */
      if (shelves.some(function (s) { return s.key === 'dressup'; })) counts.dressup = 0;
      shelves.forEach(function (s) {
        s.ids.forEach(function (id) { counts[isPet(C, id) ? 'mascots' : isAcc(C, id) ? 'gear' : isPlug(C, id) ? 'dressup' : 'things'] += 1; counts.all += 1; });
      });
      return {
        isle: k, name: head.name, owned: head.owned, status: head.status, price: head.price,
        landId: d.unlock, landmarkId: d.landmark, landmarkUid: head.owned ? landmarkUid(C, w, k) : null,
        lead: (head.owned ? [] : [d.unlock]).concat([d.landmark]),
        counts: counts, shelves: shelves
      };
    });
  }

  /* ---------------- ⭐ All and 'I can buy' ---------------- */
  /* the Home side of the shop: every V4.54 item and the lands themselves (never what a land sells) */
  function homeItems(C) { return C.shopItems().filter(function (it) { return !it.isle || it.kind === 'land'; }); }
  function allTab(C, u, opts) {
    var U = userOf(C, u), w = worldOf(C, u), o = optsOf(opts);
    var ids = ranked(C, U, homeItems(C), o);
    var isleCards = skyOrder(C).filter(function (k) { return C.isleUnlocked(w, k); }).map(function (k) {
      return { isle: k, things: shopIds(C, k).filter(function (id) { return !isPet(C, id) && !isAcc(C, id) && !isPlug(C, id); }).length };
    });
    var out = { ids: ids, isleCards: isleCards };
    /* the characters and wear: one doorway card into the 👕 Wardrobe tab, as a land gets one into its shop (D99) */
    var tab = wardrobeTab(C, u, o);
    if (tab.length) {
      out.wardrobe = { things: 0, left: 0 };
      tab.forEach(function (s) { out.wardrobe.things += s.ids.length; out.wardrobe.left += s.left; });
    }
    return out;
  }
  function afford(C, u, opts) {
    var U = userOf(C, u), o = optsOf(opts), here = skyKey(C, opts && opts.isle), out = [], first = [];
    var x = ctxOf(C, u, o), shut = capped(x);
    /* a pet the cap shuts out is not something to buy now, whatever it costs */
    var can = function (id) { return C.itemState(U, id, o).state === 'affordable' && !(shut && C.item(id).kind === 'pet'); };
    var homePets = C.shopItems().filter(function (it) { return it.kind === 'pet' && it.isle === 'home'; });
    var home = byPrice(C, homeItems(C).concat(homePets).map(function (it) { return it.id; }).filter(can), o);
    if (home.length) out.push({ isle: null, ids: home });
    /* the characters and pieces anyone can buy; a land's own are in its group below (its Dress-up shelf) */
    var wear = byPrice(C, soldItems(C).filter(function (it) { return !landOf(C, it); }).map(function (it) { return it.id; }).filter(can), o);
    if (wear.length) out.push({ isle: null, key: 'wardrobe', labelKey: 'wardrobe.title', ids: wear });
    skyOrder(C).forEach(function (k) {
      var ids = byPrice(C, shopIds(C, k).filter(can), o);
      if (ids.length) (k === here ? first : out).push({ isle: k, ids: ids });
    });
    return first.concat(out);
  }

  /* ---------------- the Crew tab ---------------- */
  function crewAisle(C, u, opts) {
    opts = opts || {};
    var x = ctxOf(C, u, opts), open = skyKey(C, opts.isle), pets = petsAt(C, 'home');
    var gear = C.CATALOG.filter(function (it) { return !it.isle && !it.retired && it.kind === 'acc'; }).map(function (it) { return it.id; });
    var out = [{ key: 'pets', labelKey: 'shop.crew.pets', ids: pets, collapsed: false, states: statesOf(x, pets) }];
    if (opts.food && foods(C).length) out.push({ key: 'food', labelKey: foodLabel(), ids: foods(C).map(function (it) { return it.id; }), collapsed: false });
    out.push({ key: 'gear', labelKey: 'shop.crew.gear', ids: byPrice(C, gear, x.o), collapsed: false });
    skyOrder(C).forEach(function (k) {
      var head = landHead(C, x.w, k, x.o), ids = shopIds(C, k).filter(function (id) { return isPet(C, id) || isAcc(C, id); });
      out.push({
        key: k, labelKey: 'shop.crew.isle', collapsed: k !== open, ids: ids,
        name: head.name, owned: head.owned, status: head.status, price: head.price,
        states: statesOf(x, ids.filter(function (id) { return isPet(C, id); }))
      });
    });
    return out;
  }

  /* ---------------- the crew sheet ---------------- */
  function wearTray(C, w, petId) {
    w = worldOf(C, w);
    if (!C.crewPet(w, petId)) return [];
    var worn = C.wornBy(w, petId);
    return SLOTS.map(function (slot) {
      return {
        slot: slot, labelKey: 'crew.slot.' + slot,
        items: C.CATALOG.filter(function (it) { return it.kind === 'acc' && it.slot === slot && C.owns(w, it.id); })
          .map(function (it) { return { id: it.id, on: worn[slot] === it.id }; })
      };
    });
  }
  function crewSheet(C, w, cap) {
    var x = ctxOf(C, w, null), all = C.crewList(x.w), list = all, hotel = 0;
    var care = typeof C.careOf === 'function' && typeof C.homePets === 'function' ? C.careOf(x.w) : null;
    if (care) {
      /* care has started (pets U5): the sheet is home (the Pet Rescue keeps a pet's place), in the child's
         order, with careRunner's pet as the runner; the Pet Hotel's guests are a count */
      var by = {}, run = typeof C.careRunner === 'function' ? C.careRunner(x.w) : null;
      all.forEach(function (p) { by[p.id] = p; });
      list = C.homePets(x.w).filter(function (id, i, a) { return has(by, id) && a.indexOf(id) === i; }).map(function (id) { return by[id]; });
      if (!list.some(function (p) { return p.id === run; })) run = list.length ? list[0].id : null;
      list.forEach(function (p) { p.active = p.id === run; });
      hotel = all.filter(function (p) { return whereOf(x, p.id) === 'hotel'; }).length;
    }
    list = list.map(function (p) {
      var it = C.item(p.id), k = it ? skyKey(C, it.isle) : null;
      p.isle = k;
      p.from = k ? C.ISLES[k].name : null;
      p.where = care ? whereOf(x, p.id) : null;
      return p;
    });
    /* cap = how many crew the stage shows at once; the runner is always one of them */
    var out = typeof cap === 'number' && isFinite(cap) ? Math.max(1, Math.floor(cap)) : list.length;
    return { list: list, resting: Math.max(0, list.length - out), hotel: hotel };
  }

  var api = {
    sections: sections, allTab: allTab, afford: afford, crewAisle: crewAisle, wearTray: wearTray, crewSheet: crewSheet,
    petState: petState, petShop: petShop, shopPet: shopPet, SLOTS: SLOTS
  };
  /* the Wardrobe tab and the character cards only beside the people core (inert without it) */
  if (PEOPLE) { api.wardrobeTab = wardrobeTab; api.wardrobeCard = wardrobeCard; api.WARDROBE = WARDROBE; }
  return api;
}));
