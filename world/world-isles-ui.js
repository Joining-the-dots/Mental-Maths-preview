/* ================================================================
   My Island v3 — the island view-model (pure; no DOM, no storage).
   window.SLIslesUI in the browser (load after world-copy.js), require()
   in Node. It turns the core's state into what the host draws for the
   sky islands, so that logic is tested in Node against real saves
   (rewards-world.js itself needs a DOM).

   Every function but bumped takes the core (SLWorldCore) as its first
   argument, and every one only READS the save it is given: nothing here
   writes a save, awards or spends anything, or remembers anything between
   calls. Islands are named by their id ('home', 'pier', …); cells are
   island-local, as in a save.

     chips(C, w, visit, {t, trial, skyMap})
         → [{isle, name, short, state: 'here' | 'open' | 'locked', locked, isNew, price, free, aria}]
         the island bar, in ISLE_ORDER. 'here' is the island being visited (never while the
         Sky map shows); locked = its land is not owned (a visited preview is 'here' AND
         locked); isNew = an unlocked sky island never visited (tutSeen['isle:<id>']), and
         its aria ends '. New'. A preview's aria is isle.chipHereLocked ('Medieval Castle:
         looking around. Still locked'), never 'you're here' (A5). price is the land's (null
         for Home) and free says test mode would give it away. The chip itself shows no
         price (D24): the sign, the here row and the sheet do.
     placeTarget(C, w, id, visit)
         → the island a newly bought / stored copy should be placed on: visit when the thing
         may go there AND that island is unlocked (D18); else 'home' for a V4.54 thing; else
         the thing's own island. null for a landmark and for anything that is never placed.
     freeSquares(C, w, isle)
         → how many land squares of that island hold no object and no path (a dock or a
         doorway square with nothing on it counts: a path may go there). 0 while locked.
     bag(C, w, isle)
         → {here: [{id, count}], elsewhere: [{isle, n}]}: the ONE shared bag seen from that
         island. here = what may go on it (the tray); elsewhere = stored things that cannot,
         grouped by the island they belong on, in ISLE_ORDER (a V4.54 thing → Home, an
         'own' thing → its island; an 'any' thing fits everywhere, so it is never there).
     takeTargets(C, w, uid)
         → [{isle, name, full}] for a placed 'any' thing: every unlocked island except the
         one it stands on, Home first; full = no legal spot there. [] for anything else.
     skySections(C, u, {trial, isle})
         → [{isle, name, owned, landId, landmarkId, landmarkUid, itemIds, status, price}]
         the five lands in ISLE_ORDER (one when isle names a sky island). status: 'open'
         (owned) | 'price' | 'free' (test mode). itemIds = the land's themed things in
         ISLE_SHELVES order (its mascots and gear, the shelves, the All-tab island cards and
         the Crew aisle are SLIslandShop's). landmarkUid = the landmark standing on an
         owned island, else null.
     lockSign(C, w, isle, {t, trial, here})
         → {short, priceText, aria}: a land's sign. Locked: '🪙 2,400' (or 'FREE' in test
         mode) and the lock.signCoins label (a core paying in ⭐: '⭐ 2,000', lock.sign; F-KU5);
         unlocked: no price and the fly-there label. here (the
         Sky map's sign for the island the child is on) → the chip's here words instead:
         isle.chipHere, or isle.chipHereLocked on a preview.
     bumped(beforeWorld, afterWorld)
         → [{uid, id}]: placed before, gone after and now waiting in the bag (what normalize
         sent back to make room). A copy trimmed because more were placed than owned went
         nowhere, so it is not listed.
     offset(C, isle)
         → {ox, oy}: where the 2D frame draws that island inside the 16 × 10 stage (centred).

   t is the host's tx(key, vars, fallback) (SLWorldCopy.t); without one the chips and
   signs fall back to the same words (TEXT below), and a short name to the full name.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLIslesUI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* the same words as SLWorldCopy's keys, for a caller with no t() */
  var TEXT = {
    'isle.chipHere': '{island}: you’re here',
    'isle.chipOpen': '{island}: fly there',
    'isle.chipLocked': '{island}: locked. Fly over for a look',
    'isle.chipHereLocked': '{island}: looking around. Still locked',
    'isle.chipNew': 'New',
    'lock.sign': '{island} · ⭐ {price}',
    'lock.signCoins': '{island} · 🪙 {price}',
    'sr.flyTo': '{island} — fly there'
  };
  var FREE = 'FREE';          /* the shop's own test-mode word (never a price) */

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function fill(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) && vars[k] != null ? String(vars[k]) : m; });
  }
  /* t() when the host passed one (its result is filled again: a host with no copy module hands the fallback back raw) */
  function say(t, key, vars, fallback) {
    var fb = fallback != null ? fallback : (has(TEXT, key) ? TEXT[key] : key);
    return fill(typeof t === 'function' ? t(key, vars, fb) : fb, vars);
  }
  function fmt(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function def(C, k) { return typeof k === 'string' && has(C.ISLES, k) ? C.ISLES[k] : null; }
  function landOf(C, k) { var d = def(C, k); return d && d.unlock ? C.item(d.unlock) : null; }
  /* the island's money (F-KU5): what a land costs in the wallet the core pays with (C.priceOf: 🪙 coins since the
     kids update's two wallets), and that wallet's sign; a core without wallets: its ⭐ price, as before */
  function coinsOn(C) { return typeof C.walletOf === 'function' && C.walletOf() === 'coins'; }
  function priceOf(C, it) { var p = it && typeof C.priceOf === 'function' ? C.priceOf(it) : null; return typeof p === 'number' && isFinite(p) ? p : it ? it.price : null; }
  function sym(C) { return coinsOn(C) ? (C.COIN && C.COIN.sym) || '🪙' : '⭐'; }
  function skyOrder(C) { return C.ISLE_ORDER.filter(function (k) { return k !== 'home'; }); }
  /* a save's world, from the profile or the world itself (a profile with no world yet reads
     as an empty one); the caller's object is never given a world and never changed */
  function rawWorld(x) { return x && typeof x.world === 'object' && x.world && !x.owned ? x.world : x; }
  function worldOf(x) {
    var w = rawWorld(x);
    return w && typeof w.owned === 'object' && w.owned ? w : { owned: {}, placed: [] };
  }
  function shortName(C, k, t) { return say(t, 'isle.short.' + k, null, C.ISLES[k].name); }

  /* ---------------- the island bar ---------------- */
  /* the here words: a preview visit (here AND locked) is looking around, never 'you're here' (A5) */
  function hereKey(locked) { return locked ? 'isle.chipHereLocked' : 'isle.chipHere'; }
  function chips(C, w, visit, opts) {
    opts = opts || {};
    w = worldOf(w);
    var here = opts.skyMap ? null : (def(C, visit) ? visit : 'home');
    var seen = w.tutSeen && typeof w.tutSeen === 'object' ? w.tutSeen : {};
    return C.ISLE_ORDER.map(function (k) {
      var d = C.ISLES[k], land = landOf(C, k), unlocked = C.isleUnlocked(w, k);
      var state = k === here ? 'here' : unlocked ? 'open' : 'locked';
      var isNew = k !== 'home' && unlocked && !seen['isle:' + k];
      return {
        isle: k, name: d.name, short: shortName(C, k, opts.t),
        state: state, locked: !unlocked, isNew: isNew,
        price: land ? priceOf(C, land) : null, free: !!opts.trial && !unlocked,
        /* the label replaces the chip's own words for a screen reader, so it says New too */
        aria: say(opts.t, state === 'here' ? hereKey(!unlocked) : state === 'open' ? 'isle.chipOpen' : 'isle.chipLocked', { island: d.name }) +
          (isNew ? '. ' + say(opts.t, 'isle.chipNew') : '')
      };
    });
  }

  /* ---------------- where a new thing goes ---------------- */
  function placeTarget(C, w, id, visit) {
    var it = C.item(id);
    if (!it || !C.isPlaceable(it) || it.kind === 'landmark') return null;   /* a landmark comes with its land, on its own spot */
    w = worldOf(w);
    var v = def(C, visit) ? visit : 'home';
    if (C.canGoOn(id, v) && C.isleUnlocked(w, v)) return v;                  /* a preview visit never starts a placement */
    return C.isV3(it) ? it.isle : 'home';
  }

  /* ---------------- room on an island ---------------- */
  function freeSquares(C, w, isle) {
    if (!def(C, isle)) return 0;
    w = worldOf(w);
    var land = C.landSetOf(w, isle), occ = C.occupancy(w, undefined, isle).occ, n = 0;
    Object.keys(land).forEach(function (c) { if (!occ[c]) n++; });
    return n;
  }

  /* ---------------- the bag, seen from one island ---------------- */
  function bag(C, w, isle) {
    w = worldOf(w);
    var k = def(C, isle) ? isle : 'home', here = [], by = {};
    C.inventory(w).forEach(function (e) {
      var it = C.item(e.id);
      if (!it || !C.isPlaceable(it)) return;
      if (C.canGoOn(e.id, k)) { here.push({ id: e.id, count: e.count }); return; }
      var to = C.isV3(it) ? it.isle : 'home';
      by[to] = (by[to] || 0) + e.count;
    });
    var elsewhere = C.ISLE_ORDER.filter(function (o) { return o !== k && by[o] > 0; })
      .map(function (o) { return { isle: o, n: by[o] }; });
    return { here: here, elsewhere: elsewhere };
  }

  /* ---------------- 'Take to another island' ---------------- */
  function takeTargets(C, w, uid) {
    if (typeof uid !== 'string' || !uid) return [];
    w = worldOf(w);
    var from = C.isleOf(w, uid), p = null;
    if (from === null || !def(C, from)) return [];
    C.placedOn(w, from).forEach(function (q) { if (q && q.uid === uid) p = q; });
    if (!p || C.scopeOf(p.id) !== 'any') return [];
    return C.unlockedIsles(w).filter(function (k) { return k !== from; }).map(function (k) {
      return { isle: k, name: C.ISLES[k].name, full: C.findSpot(w, p.id, undefined, undefined, k) === null };
    });
  }

  /* ---------------- the Sky islands shop sections ---------------- */
  /* a land's themed things (its placeable shop items) in shelf order; a core without shelves lists them in CATALOG order */
  function themedIds(C, k) {
    var out = [], shelves = C.ISLE_SHELVES && has(C.ISLE_SHELVES, k) ? C.ISLE_SHELVES[k] : null;
    var keep = function (it) { return !!it && it.cat === 'sky' && !it.retired && !it.included; };
    if (shelves) shelves.forEach(function (s) { s[1].forEach(function (id) { if (keep(C.item(id))) out.push(id); }); });
    else C.CATALOG.forEach(function (it) { if (it.isle === k && keep(it)) out.push(it.id); });
    return out;
  }
  function landmarkUid(C, w, k) {
    var lm = C.ISLES[k].landmark, list = C.placedOn(w, k);
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === lm && list[i].uid) return list[i].uid;
    return null;
  }
  function skySections(C, u, opts) {
    opts = opts || {};
    var w = worldOf(u), only = opts.isle !== 'home' && def(C, opts.isle) ? opts.isle : null;
    return skyOrder(C).filter(function (k) { return !only || k === only; }).map(function (k) {
      var d = C.ISLES[k], land = landOf(C, k), owned = C.isleUnlocked(w, k);
      return {
        isle: k, name: d.name, owned: owned,
        landId: d.unlock, landmarkId: d.landmark, landmarkUid: owned ? landmarkUid(C, w, k) : null,
        itemIds: themedIds(C, k),
        status: owned ? 'open' : opts.trial ? 'free' : 'price', price: land ? priceOf(C, land) : 0
      };
    });
  }

  /* ---------------- a land's sign ---------------- */
  function lockSign(C, w, isle, opts) {
    opts = opts || {};
    var d = def(C, isle);
    if (!d) return null;
    var land = landOf(C, isle), locked = !C.isleUnlocked(worldOf(w), isle), price = land ? fmt(priceOf(C, land)) : '';
    return {
      short: shortName(C, isle, opts.t),
      priceText: !locked ? '' : opts.trial ? FREE : sym(C) + ' ' + price,
      aria: opts.here ? say(opts.t, hereKey(locked), { island: d.name })
        : !locked ? say(opts.t, 'sr.flyTo', { island: d.name })
        : opts.trial ? d.name + ' · ' + FREE
        : say(opts.t, coinsOn(C) ? 'lock.signCoins' : 'lock.sign', { island: d.name, price: price })
    };
  }

  /* ---------------- what normalize sent back to the bag ---------------- */
  /* every placement list of a save: Home, then each island entry (unknown island keys too) */
  function lists(w) {
    var out = [], s = w && w.isles;
    if (w && Array.isArray(w.placed)) out.push(w.placed);
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      Object.keys(s).forEach(function (k) { if (s[k] && typeof s[k] === 'object' && Array.isArray(s[k].placed)) out.push(s[k].placed); });
    }
    return out;
  }
  function bumped(before, after) {
    before = rawWorld(before); after = rawWorld(after) || {};
    var still = Object.create(null), placedNow = Object.create(null), room = Object.create(null), out = [];
    var owned = after.owned && typeof after.owned === 'object' ? after.owned : {};
    lists(after).forEach(function (l) {
      l.forEach(function (p) {
        if (!p || typeof p !== 'object') return;
        if (typeof p.uid === 'string') still[p.uid] = 1;
        if (typeof p.id === 'string') placedNow[p.id] = (placedNow[p.id] || 0) + 1;
      });
    });
    lists(before).forEach(function (l) {
      l.forEach(function (p) {
        if (!p || typeof p !== 'object' || typeof p.uid !== 'string' || !p.uid || typeof p.id !== 'string' || still[p.uid]) return;
        if (room[p.id] === undefined) room[p.id] = Math.max(0, (has(owned, p.id) ? Math.floor(+owned[p.id] || 0) : 0) - (placedNow[p.id] || 0));
        if (room[p.id] < 1) return;
        room[p.id] -= 1;
        out.push({ uid: p.uid, id: p.id });
      });
    });
    return out;
  }

  /* ---------------- the 2D frame ---------------- */
  function offset(C, isle) {
    var d = def(C, isle);
    if (!d || isle === 'home') return { ox: 0, oy: 0 };
    return { ox: Math.max(0, Math.floor((C.COLS - d.size[0]) / 2)), oy: Math.max(0, Math.floor((C.ROWS - d.size[1]) / 2)) };
  }

  return {
    chips: chips, placeTarget: placeTarget, freeSquares: freeSquares, bag: bag, takeTargets: takeTargets,
    skySections: skySections, lockSign: lockSign, bumped: bumped, offset: offset, TEXT: Object.freeze(TEXT)
  };
}));
