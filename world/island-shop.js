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
         items and lands), then one group per land with something affordable, cheapest
         first. A locked thing is never affordable; empty groups are left out. Optional
         isle = the sky island the child is standing on: its group moves to the front (on
         a phone the Home list alone can be 50 cards); without it the order is as above.
     crewAisle(C, u, {isle, trial})
         → [{key: 'pets' | 'gear' | isle, labelKey, ids, collapsed}]: the Crew tab. The
         V4.54 pets (the first one included: the whole crew is on show), the V4.54
         accessories, then per land its two mascots and four pieces of gear (the same six
         cards as that land's 'Mascots & gear' shelf), cheapest first. A land group is
         collapsed unless it is the island passed in (D114) and also carries
         {name, owned, status, price} for its header.
     wearTray(C, w, petId)
         → [{slot, labelKey, items: [{id, on}]}] for hat, neck, face, back: the OWNED
         accessories of each slot, the one that crew member wears marked (C.wornBy).
         [] when petId is not in the crew.
     crewSheet(C, w, cap)
         → {list, resting}: list = C.crewList(w), each with isle (a mascot's land, else
         null) and from (that island's name); resting = how many are indoors when only
         cap of them (never fewer than the runner) are out at once (D97).
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var copy = null;
    try { copy = require('./world-copy.js'); } catch (e) { copy = null; }
    module.exports = factory(root, copy);
  } else root.SLIslandShop = factory(root, null);
}(typeof self !== 'undefined' ? self : this, function (root, COPY0) {
  'use strict';

  var SLOTS = Object.freeze(['hat', 'neck', 'face', 'back']);
  /* the V4.54 shop order: what you can buy, what you are saving for, what is locked, what you have */
  var RANK = { affordable: 0, short: 1, locked: 2, capped: 3, owned: 3 };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function copy() { return COPY0 || (root && root.SLWorldCopy) || null; }
  function copyHas(key) { var CP = copy(); return !!(CP && CP.STRINGS && has(CP.STRINGS, key)); }

  function def(C, k) { return typeof k === 'string' && has(C.ISLES, k) ? C.ISLES[k] : null; }
  function skyKey(C, k) { return k !== 'home' && def(C, k) ? k : null; }
  function skyOrder(C) { return C.ISLE_ORDER.filter(function (k) { return k !== 'home'; }); }
  /* a save's world, from the profile or the world itself (a profile with no world yet reads
     as an empty one); the caller's object is never given a world and never changed */
  function worldOf(C, x) {
    var w = x && typeof x.world === 'object' && x.world && !x.owned ? x.world : x;
    return w && typeof w.owned === 'object' && w.owned ? w : C.emptyWorld();
  }
  /* what itemState reads: the balance and a one-level copy of the world. The core fills in
     any field an old save lacks before it reads (ensureWorld); on a copy that never lands in
     the child's save. A bare world has no balance to read. */
  function userOf(C, u) {
    var w = worldOf(C, u), copyW = {};
    Object.keys(w).forEach(function (k) { copyW[k] = w[k]; });
    return { points: u && !u.owned && typeof u.points === 'number' ? u.points : 0, world: copyW };
  }
  /* cheapest first; equal prices keep the order they came in (old engines' sort is not stable) */
  function byPrice(C, ids) {
    return ids.map(function (id, i) { return { id: id, i: i, p: C.item(id).price }; })
      .sort(function (a, b) { return (a.p - b.p) || (a.i - b.i); })
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
  function shelvesOf(C, k) {
    var rows = C.ISLE_SHELVES && has(C.ISLE_SHELVES, k) ? C.ISLE_SHELVES[k] : [];
    return rows.map(function (s) {
      var own = 'shop.shelf.' + k + '.' + s[0];
      return { key: s[0], labelKey: copyHas(own) ? own : 'shop.shelf.' + s[0], ids: shelfOrder(C, s[1]) };
    }).filter(function (s) { return s.ids.length > 0; });
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
  function landHead(C, w, k, trial) {
    var d = C.ISLES[k], land = C.item(d.unlock), owned = C.isleUnlocked(w, k);
    return { name: d.name, owned: owned, status: owned ? 'open' : trial ? 'free' : 'price', price: land ? land.price : 0 };
  }

  /* ---------------- the Sky islands tab: one section per land ---------------- */
  function sections(C, u, opts) {
    opts = opts || {};
    var w = worldOf(C, u), only = skyKey(C, opts.isle);
    return skyOrder(C).filter(function (k) { return !only || k === only; }).map(function (k) {
      var d = C.ISLES[k], head = landHead(C, w, k, !!opts.trial), shelves = shelvesOf(C, k);
      var counts = { things: 0, mascots: 0, gear: 0, all: 0 };
      shelves.forEach(function (s) {
        s.ids.forEach(function (id) { counts[isPet(C, id) ? 'mascots' : isAcc(C, id) ? 'gear' : 'things'] += 1; counts.all += 1; });
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
    var U = userOf(C, u), w = worldOf(C, u), o = { trial: !!(opts && opts.trial) };
    var ids = homeItems(C).map(function (it, i) {
      var r = RANK[C.itemState(U, it.id, o).state];
      return { id: it.id, i: i, r: r == null ? 9 : r, p: it.price };
    }).sort(function (a, b) { return (a.r - b.r) || (a.p - b.p) || (a.i - b.i); }).map(function (e) { return e.id; });
    var isleCards = skyOrder(C).filter(function (k) { return C.isleUnlocked(w, k); }).map(function (k) {
      return { isle: k, things: shopIds(C, k).filter(function (id) { return !isPet(C, id) && !isAcc(C, id); }).length };
    });
    return { ids: ids, isleCards: isleCards };
  }
  function afford(C, u, opts) {
    var U = userOf(C, u), o = { trial: !!(opts && opts.trial) }, here = skyKey(C, opts && opts.isle), out = [], first = [];
    var can = function (id) { return C.itemState(U, id, o).state === 'affordable'; };
    var home = byPrice(C, homeItems(C).map(function (it) { return it.id; }).filter(can));
    if (home.length) out.push({ isle: null, ids: home });
    skyOrder(C).forEach(function (k) {
      var ids = byPrice(C, shopIds(C, k).filter(can));
      if (ids.length) (k === here ? first : out).push({ isle: k, ids: ids });
    });
    return first.concat(out);
  }

  /* ---------------- the Crew tab ---------------- */
  function crewAisle(C, u, opts) {
    opts = opts || {};
    var w = worldOf(C, u), open = skyKey(C, opts.isle);
    var old = C.CATALOG.filter(function (it) { return !it.isle && !it.retired && (it.kind === 'pet' || it.kind === 'acc'); })
      .map(function (it) { return it.id; });
    var out = [
      { key: 'pets', labelKey: 'shop.crew.pets', ids: byPrice(C, old.filter(function (id) { return isPet(C, id); })), collapsed: false },
      { key: 'gear', labelKey: 'shop.crew.gear', ids: byPrice(C, old.filter(function (id) { return isAcc(C, id); })), collapsed: false }
    ];
    skyOrder(C).forEach(function (k) {
      var head = landHead(C, w, k, !!opts.trial);
      out.push({
        key: k, labelKey: 'shop.crew.isle', collapsed: k !== open,
        ids: shopIds(C, k).filter(function (id) { return isPet(C, id) || isAcc(C, id); }),
        name: head.name, owned: head.owned, status: head.status, price: head.price
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
    w = worldOf(C, w);
    var list = C.crewList(w).map(function (p) {
      var it = C.item(p.id), k = it && it.isle && def(C, it.isle) ? it.isle : null;
      p.isle = k;
      p.from = k ? C.ISLES[k].name : null;
      return p;
    });
    /* cap = how many crew the stage shows at once; the runner is always one of them */
    var out = typeof cap === 'number' && isFinite(cap) ? Math.max(1, Math.floor(cap)) : list.length;
    return { list: list, resting: Math.max(0, list.length - out) };
  }

  return { sections: sections, allTab: allTab, afford: afford, crewAisle: crewAisle, wearTray: wearTray, crewSheet: crewSheet, SLOTS: SLOTS };
}));
