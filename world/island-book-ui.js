/* ================================================================
   My Island — 📖 My island book (Island activities v1, chunk IA-6; chatgpt-feedback/ISLAND-ACTIVITIES-PLAN.md
   §2 A6, §5 IA-6 and §7, as James approved it on 25-26 Oct 2026: free play, nothing earned or spent).
   window.SLIslandBookUI in the browser (rewards-world.js loads it on first use, like pet-shop-ui.js; precached in
   sw.js), module.exports in Node, where the view-model and the markup run on a tiny DOM
   (tests/island-book-ui.test.js). Its look is in world/pet-care.css (the .slw-book-* section), which the island
   loads with its other sheets, so the book is drawn the moment its file arrives.

   WHAT IT SHOWS. One page per island the child OWNS (Home first, then the lands in ISLE_ORDER; never a locked
   land, so the book is never a shopping list), then the Visitors' book (only the characters met, never one to
   come) and 🧳 Pet passports (every pet that is not a star). A sticky row of chips picks the page, laid out like
   the Island Shop's land chips (.slw-shopland, James 25 Oct: "Make them match"); a completed page's chip has a ✓.
     a page   the stamps found, in full colour with their date ('Found on 26 Oct'), and a dotted ring with its
              how-line for each one still to find that the child can do with what they own (SLIslandDays.book():
              a stamp found is never lost, a completed page draws no ring again); 'Do things on your island to
              fill this page.' while nothing is found; on a completed page 'Your {island} page is complete!' (and,
              on a land, the explorer flag by its bridge); then, under a line, the extras: 'Try your new {item}'
              for things bought after the page was complete (never a ring on the page itself: an extra never
              un-completes a page), each with that thing's own picture (always a thing the child owns).
     visitors 'Visitors’ book': a portrait per character met, their move's name and 'Visited {n} times.'
     passports per pet: its portrait, '{name} has been to {n} islands.', a stamp for each land it has visited
              with the child, and 'Take {name} travelling' (a home pet that is not the runner, while the child
              owns a land): the same action as My pets' 'Make my runner' (C.setActivePet), since the runner is
              the pet that follows the child across the bridges.
   The top says '{n} stamps so far' (never 'x of y') and 'Your island’s first day: {date}.'. No price, coin, ⭐,
   Buy or shop word is ever drawn, and the sheet asks the host for no balance in its header (pts: false).

   THE HOST'S ctx (rewards-world's careCtx() plus the island-day rules; only overlay and a way to the save are
   required):
     overlay(inner, {cls, pts, onClose}) → .slw-ov with _close   the island's sheet (its sticky ✕ header)
     user          the profile, or a function returning it (read afresh); or W() → the world (u.world)
     C             the world core (default window.SLWorldCore) · D the island-day rules (default
                   window.SLIslandDays) · people the people core (default window.SLPeopleCore; without it the
                   Visitors' book is empty, as SLIslandDays.castInfo says)
     tx(key, vars, fb)  the words (default SLWorldCopy.t) · iconHtml(id, st) a picture (the host's photocard
                   span: a pet in its outfit, a character, an owned thing); fillPhotocards(el) after each draw
     commit(fn)    → Promise<res>: fn(u) runs inside the host's C.transact. Without it the book only reads.
     day           the island day 'YYYY-MM-DD' (or a function: the host's careDay) · now() → ms
     commitSeen()  → Promise: the host's C.seeFinds commit when the book closes (the Today sign's dot goes);
                   without it the book commits C.seeFinds itself through commit. Only when there was
                   something new to see, so a save is never written for nothing.
     onComplete(isles)  the pages the book recorded complete as it opened (see below); without it,
                   celebrate({title, sub, encore: false, onClose}) once for each, one after the other
     go(to, o)     SLWorld.go: 'Take {name} travelling' opens My pets on that pet when there is no commit
     here()        the island the child is on: the page the book opens on when o.page names none
     document, setTimeout   test seams

   API
     open(ctx, {page}) → Promise   resolves when the book closes (true), or null when it cannot open (no sheet,
                   no rules, no save) and false while another book is up. page: an island key, 'visitors' or
                   'passports'; one the child cannot see (a locked land, or no pets) opens Home instead.
                   READY PAGES: SLIslandDays.book().ready lists pages whose every stamp shown is found but whose
                   completion was never recorded (the trees packed away before one was shaken). As it opens the
                   book records them, C.addFinds(u, {done: ready}, day, ms), and the pages that call completes
                   go to onComplete or are celebrated. A completion is recorded once and is permanent.
                   ONE CHILD'S BOOK: the book belongs to the profile it opened for (its name). After a profile switch
                   it never commits (seen, Take travelling, a commit's change handed another profile), draws or
                   celebrates anything; a tap or a redraw closes it instead.
     view(ctx, page) → the view-model (pure): {n, count, first, title, chips: [{page, label, name, done, on}], page,
                   ready, newCount, owned} with page = {type: 'isle' | 'visitors' | 'passports', …} (see pageVM)
     dateWords(day, short) → '26 October 2026' | '26 Oct' ('' when not a day) · GLYPH · PAGES · VERSION
   Nothing here earns, spends, rolls a number, keeps anything in storage or sends anything.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLIslandBookUI = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1;
  /* the two pages after the islands */
  var PAGES = ['visitors', 'passports'];
  /* each stamp's mark: a picture, never words (the how-line says what it is); a land's 'Try your new …' extra is
     drawn with that thing's own picture instead */
  var GLYPH = {
    house: '🏠', map: '🗺️', findme: '🔍', showtime: '🌙', hello: '👋', tree: '🌳', pat: '🐾', fetch: '🎾', hide: '🙈',
    show: '🎭', spy: '👀', try3: '✋', tryall: '🎢', visit: '🧭', landmark: '🚩', night: '✨', gear: '🎀', 'new': '🌟'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

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
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function val(v) { return typeof v === 'function' ? v() : v; }

  /* an island day as a child reads it, in UK English: '26 October 2026', or short '26 Oct' (a stamp's date) */
  function dateWords(day, short) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '';
    return (+m[3]) + ' ' + (short ? MON[+m[2] - 1] : MONTHS[+m[2] - 1] + ' ' + m[1]);
  }

  /* ---------------- the ctx, read afresh ---------------- */
  function env(ctx) {
    ctx = ctx || {};
    var C = ctx.C || sib('SLWorldCore', './world-core.js'), CP = sib('SLWorldCopy', './world-copy.js');
    var E = { ctx: ctx, C: C, D: ctx.D || sib('SLIslandDays', './island-days.js'), people: ctx.people || sib('SLPeopleCore', './people-core.js') };
    E.u = function () { return val(ctx.user) || null; };
    E.w = function () {
      if (typeof ctx.W === 'function') { var w0 = ctx.W(); if (w0) return w0; }
      var u = E.u();
      return u && C ? C.ensureWorld(u) : null;
    };
    E.t = function (key, vars, fb) {
      if (typeof ctx.tx === 'function') return ctx.tx(key, vars, fb);
      return CP && typeof CP.t === 'function' ? CP.t(key, vars, fb) : (typeof fb === 'string' ? fb : key);
    };
    E.now = function () { return typeof ctx.now === 'function' ? ctx.now() : Date.now(); };
    E.day = function () { var d = val(ctx.day); return typeof d === 'string' ? d : C && typeof C.dayKey === 'function' ? C.dayKey(E.now()) : null; };
    E.doc = function () { return ctx.document || root.document; };
    E.later = function (fn, ms) { var f = ctx.setTimeout || root.setTimeout; return f ? f(fn, ms) : null; };
    E.book = function () {
      var w = E.w();
      if (!w || !E.D || typeof E.D.book !== 'function') return null;
      try { return E.D.book(C, w, E.people); } catch (e) { return null; }
    };
    return E;
  }
  function shortOf(E, k) { var d = E.C && E.C.ISLES && E.C.ISLES[k]; return E.t('isle.short.' + k, null, d ? d.name : k); }
  function art() { return sib('SLWorldArt', './world-art.js', 'SLWorldArt'); }
  /* a picture: the host's (a photocard span, a character's portrait), else world-art's 2D icon, else none; a
     picture that throws never stops the book */
  function picture(E, id, st) {
    if (typeof E.ctx.iconHtml === 'function') { try { return E.ctx.iconHtml(id, st) || ''; } catch (e) { /* below */ } }
    var A = art();
    try { return A && typeof A.icon === 'function' ? A.icon(id, st) || '' : ''; } catch (e) { return ''; }
  }
  function isleIcon(k) { var A = art(); try { return A && typeof A.isleIcon === 'function' ? A.isleIcon(k) || '' : ''; } catch (e) { return ''; } }
  function petPic(E, w, id) { return picture(E, id, { acc: typeof E.C.wornBy === 'function' ? E.C.wornBy(w, id) : {} }); }

  /* ================================================================
     THE VIEW-MODEL (pure)
     ================================================================ */
  /* a stamp's cell: its mark (or the thing's picture), its how-line and, once found, its date. On its own page an
     island is named short ('Visit Jungle', 'Bring a pet in Jungle gear': at most 2 lines in a phone's cell) */
  function cell(E, page, s) {
    var params = s.params;
    if (params && own(params, 'island')) { params = {}; Object.keys(s.params).forEach(function (k) { params[k] = s.params[k]; }); params.island = page.short; }
    var c = { id: s.id, kind: s.kind, text: E.t(s.key, params), got: !!s.got, when: s.got && s.day ? E.t('act.book.found', { date: dateWords(s.day, true) }) : null,
      glyph: own(GLYPH, s.kind) ? GLYPH[s.kind] : '', pic: null };
    if (s.kind === 'new') { var it = s.id.split('.').pop(); if (E.C.item(it)) c.pic = it; }
    return c;
  }
  function islePage(E, b, p) {
    var land = p.isle !== 'home', short = shortOf(E, p.isle), page = { type: 'isle', isle: p.isle, name: p.name, short: short };
    page.stamps = p.stamps.map(function (s) { return cell(E, page, s); });
    page.extras = p.extras.map(function (s) { return cell(E, page, s); });
    page.done = !!p.done;
    page.n = p.n;
    page.empty = p.n === 0 ? E.t('act.book.empty') : null;
    page.complete = p.done ? E.t('act.book.complete', { island: short }) : null;
    page.flag = p.done && land ? E.t('act.book.flag') : null;
    return page;
  }
  function visitorsPage(E, b) {
    return { type: 'visitors', title: E.t('act.book.visitors'), none: b.visitors.length ? null : E.t('act.book.noVisitors'),
      list: b.visitors.map(function (v) {
        return { id: v.id, name: v.name, move: v.moveKey ? E.t(v.moveKey, null, v.moveName || '') : (v.moveName || ''), visits: E.t(v.key, v.params) };
      }) };
  }
  function passportsPage(E, b, w) {
    var C = E.C, crew = [];
    try { crew = typeof C.crewList === 'function' ? C.crewList(w) : []; } catch (e) { crew = []; }
    var runner = {};
    (Array.isArray(crew) ? crew : []).forEach(function (p) { if (p && p.active) runner[p.id] = true; });
    var lands = (C.ISLE_ORDER || []).some(function (k) { return k !== 'home' && typeof C.isleUnlocked === 'function' && plain(w.owned) && !!C.isleUnlocked(w, k); });
    var canTake = lands && (typeof E.ctx.commit === 'function' || typeof E.ctx.go === 'function');
    return { type: 'passports', title: E.t('act.book.passports'),
      list: b.passports.map(function (p) {
        var where = typeof C.petWhere === 'function' ? C.petWhere(w, p.id) : 'home';
        return { id: p.id, name: p.name, line: E.t(p.key, p.params), runner: !!runner[p.id],
          stamps: p.isles.map(function (s) { return { isle: s.isle, text: E.t(s.key, { name: p.name, island: shortOf(E, s.isle) }), when: dateWords(s.day, true) }; }),
          take: canTake && where === 'home' && !runner[p.id] ? E.t(p.takeKey, p.takeParams) : null };
      }) };
  }
  /* the chips: the islands, then the Visitors' book, then Pet passports (only with a pet that is not a star) */
  function chipsOf(E, b) {
    var out = b.pages.map(function (p) {
      var short = shortOf(E, p.isle);
      return { page: p.isle, label: short + (p.done ? ' ✓' : ''), name: p.name + (p.done ? '. ' + E.t('act.book.complete', { island: short }) : ''), done: !!p.done, isle: true };
    });
    out.push({ page: 'visitors', label: E.t('act.book.visitors'), name: E.t('act.book.visitors'), done: false, isle: false });
    if (b.passports.length) out.push({ page: 'passports', label: E.t('act.book.passports'), name: E.t('act.book.passports'), done: false, isle: false });
    return out;
  }
  function view(ctx, page) {
    var E = env(ctx), w = E.w(), b = E.book();
    if (!b || !w) return null;
    var chips = chipsOf(E, b), here = val(ctx.here);
    var want = typeof page === 'string' ? page : typeof here === 'string' ? here : 'home';
    var at = chips.filter(function (c) { return c.page === want; })[0] || chips[0];
    chips.forEach(function (c) { c.on = c === at; });
    var pg = at.page === 'visitors' ? visitorsPage(E, b) : at.page === 'passports' ? passportsPage(E, b, w)
      : islePage(E, b, b.pages.filter(function (p) { return p.isle === at.page; })[0]);
    return { n: b.n, count: E.t(b.key, b.params), first: b.first ? E.t('act.book.first', { date: dateWords(b.first) }) : null,
      title: E.t('act.book.title'), chips: chips, page: pg, ready: b.ready.slice(), newCount: b.newCount, owned: b.pages.map(function (p) { return p.isle; }) };
  }

  /* ================================================================
     THE MARKUP (pure strings)
     ================================================================ */
  function chipsHtml(vm) {
    return vm.chips.map(function (c) {
      return '<button type="button" class="slw-btn slw-book-chip' + (c.on ? ' on' : '') + (c.done ? ' done' : '') + '" data-page="' + esc(c.page) + '" aria-pressed="' + (c.on ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(c.name) + '">' + (c.isle ? isleIcon(c.page) : '') + '<span>' + esc(c.label) + '</span></button>';
    }).join('');
  }
  function cellHtml(E, c) {
    var mark = c.pic ? '<span class="slw-book-pic">' + picture(E, c.pic) + '</span>' : '<span class="slw-book-g">' + esc(c.glyph) + '</span>';
    return '<li class="slw-book-st ' + (c.got ? 'got' : 'ring') + '" data-st="' + esc(c.id) + '"><span class="slw-book-mark" aria-hidden="true">' + mark + '</span>' +
      '<span class="slw-book-how">' + esc(c.text) + '</span>' + (c.when ? '<span class="slw-book-when">' + esc(c.when) + '</span>' : '') + '</li>';
  }
  function pageHtml(E, pg, w) {
    var h = '';
    if (pg.type === 'isle') {
      h += '<section class="slw-book-page" data-page="' + esc(pg.isle) + '" data-isle="' + esc(pg.isle) + '" aria-labelledby="slwBookP-' + esc(pg.isle) + '">' +
        '<h3 class="slw-book-h" id="slwBookP-' + esc(pg.isle) + '">' + isleIcon(pg.isle) + '<span>' + esc(pg.name) + '</span></h3>';
      if (pg.complete) h += '<p class="slw-book-done">' + esc(pg.complete) + (pg.flag ? ' <span>' + esc(pg.flag) + '</span>' : '') + '</p>';
      if (pg.empty) h += '<p class="slw-book-line">' + esc(pg.empty) + '</p>';
      h += '<ul class="slw-book-grid" role="list">' + pg.stamps.map(function (c) { return cellHtml(E, c); }).join('') + '</ul>';
      if (pg.extras.length) h += '<div class="slw-book-extras"><ul class="slw-book-grid" role="list">' + pg.extras.map(function (c) { return cellHtml(E, c); }).join('') + '</ul></div>';
      return h + '</section>';
    }
    if (pg.type === 'visitors') {
      h += '<section class="slw-book-page" data-page="visitors" aria-labelledby="slwBookP-visitors"><h3 class="slw-book-h" id="slwBookP-visitors"><span>' + esc(pg.title) + '</span></h3>';
      if (pg.none) h += '<p class="slw-book-line">' + esc(pg.none) + '</p>';
      h += '<ul class="slw-book-people" role="list">' + pg.list.map(function (v) {
        return '<li class="slw-book-vis" data-char="' + esc(v.id) + '"><span class="slw-book-face" aria-hidden="true">' + picture(E, v.id) + '</span><span class="slw-book-who">' +
          '<b>' + esc(v.name) + '</b>' + (v.move ? '<span class="slw-book-move">' + esc(v.move) + '</span>' : '') + '<span class="slw-book-n">' + esc(v.visits) + '</span></span></li>';
      }).join('') + '</ul>';
      return h + '</section>';
    }
    h += '<section class="slw-book-page" data-page="passports" aria-labelledby="slwBookP-passports"><h3 class="slw-book-h" id="slwBookP-passports"><span>' + esc(pg.title) + '</span></h3>';
    h += '<div class="slw-book-pps">' + pg.list.map(function (p) {
      return '<article class="slw-book-pp" data-pet="' + esc(p.id) + '"><div class="slw-book-pphead"><span class="slw-book-face" aria-hidden="true">' + petPic(E, w, p.id) + '</span>' +
        '<span class="slw-book-who"><b>' + esc(p.name) + '</b><span class="slw-book-n">' + esc(p.line) + '</span></span></div>' +
        (p.stamps.length ? '<ul class="slw-book-grid slw-book-visa" role="list">' + p.stamps.map(function (s) {
          return '<li class="slw-book-st got" data-isle="' + esc(s.isle) + '"><span class="slw-book-mark" aria-hidden="true">' + isleIcon(s.isle) + '</span><span class="slw-book-how">' + esc(s.text) + '</span>' +
            (s.when ? '<span class="slw-book-when">' + esc(s.when) + '</span>' : '') + '</li>';
        }).join('') + '</ul>' : '') +
        (p.take ? '<div class="slw-book-btns"><button type="button" class="slw-btn slw-book-take" data-a="take" data-id="' + esc(p.id) + '">' + esc(p.take) + '</button></div>' : '') + '</article>';
    }).join('') + '</div>';
    return h + '</section>';
  }

  /* ================================================================
     THE BOOK (needs a document)
     ================================================================ */
  function commit(E, fn) {
    if (typeof E.ctx.commit !== 'function') return Promise.resolve(null);
    return Promise.resolve(E.ctx.commit(fn)).then(function (r) { return r || null; }, function () { return null; });
  }
  function q(el, sel) { return el && typeof el.querySelector === 'function' ? el.querySelector(sel) : null; }
  function qa(el, sel) { return el && typeof el.querySelectorAll === 'function' ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; }
  function photo(E, el) { try { if (typeof E.ctx.fillPhotocards === 'function') E.ctx.fillPhotocards(el); } catch (e) { /* the 2D picture stays */ } }
  /* the chip row marks the end with more to see (data-more 'l', 'r' or 'lr': island-pixel's soft fade and arrow on
     .slw-shopland, as the Island Shop's and the Pet Shop's rows); a tap on an arrow (the row itself, within its end)
     slides it along */
  function rowEdges(row) {
    if (!row || !row.getAttribute) return '';
    var max = (row.scrollWidth || 0) - (row.clientWidth || 0), x = row.scrollLeft || 0, m = '';
    if (max > 8) m = (x > 8 ? 'l' : '') + (x < max - 8 ? 'r' : '');
    if ((row.getAttribute('data-more') || '') !== m) { if (m) row.setAttribute('data-more', m); else row.removeAttribute('data-more'); }
    return m;
  }
  function wireEdges(row) {
    if (!row || typeof row.addEventListener !== 'function' || row._slwBookEdges) return;
    row._slwBookEdges = true;
    row.addEventListener('scroll', function () { rowEdges(row); }, { passive: true });
    row.addEventListener('click', function (e) {
      var m = row.getAttribute('data-more') || '';
      if (!m || !e || e.target !== row || typeof row.getBoundingClientRect !== 'function') return;
      var b = row.getBoundingClientRect(), x = e.clientX - b.left, end = 56;
      var dir = x >= b.width - end && m.indexOf('r') >= 0 ? 1 : x <= end && m.indexOf('l') >= 0 ? -1 : 0;
      if (dir) { row.scrollLeft = Math.max(0, (row.scrollLeft || 0) + dir * Math.round((row.clientWidth || 0) * 0.6)); rowEdges(row); }
    });
  }
  /* the completed pages, one celebration after another (the host's celebrate: a card over the book; no encore,
     since the island is behind the book); mine() false (another child is playing now) ends the run of cards */
  function celebrate(E, isles, mine) {
    if (!isles.length) return;
    if (typeof E.ctx.onComplete === 'function') { try { E.ctx.onComplete(isles.slice()); } catch (e) { /* the host's */ } return; }
    if (typeof E.ctx.celebrate !== 'function') return;
    var i = 0;
    (function next() {
      if (i >= isles.length || !mine()) return;
      var k = isles[i++];
      try {
        E.ctx.celebrate({ title: E.t('act.book.complete', { island: shortOf(E, k) }), sub: k !== 'home' ? E.t('act.book.flag') : '', encore: false, onClose: next });
      } catch (e) { next(); }
    }());
  }
  function open(ctx, o) {
    o = o || {};
    var E = env(ctx), doc = E.doc();
    if (!E.C || !E.D || typeof E.ctx.overlay !== 'function' || !E.w() || !doc) return Promise.resolve(null);
    if (q(doc, '.slw-book-ov')) return Promise.resolve(false);
    var vm = view(ctx, o.page);
    if (!vm) return Promise.resolve(null);
    /* the book is the child's it opened for. ctx.user is read afresh, and a profile switch moves the host's active
       player before its onUserChanged closes every sheet, so the book's own close (seen), a late commit's answer
       (the ready pages) and a tap after the switch must never write, draw or celebrate on the next child: each asks
       mine() first (the name, as the host's saves are keyed and a commit hands back a fresh copy of the profile), and
       each commit's own change checks the profile it is handed too */
    var u0 = E.u(), who = u0 && typeof u0.name === 'string' ? u0.name : null;
    function mine() { var u = E.u(); return !!u && (who !== null ? u.name === who : u === u0); }
    function commitMine(fn) {
      return commit(E, function (u) { return who !== null && (!u || u.name !== who) ? { ok: false, code: 'profile_changed' } : fn(u); });
    }
    return new Promise(function (resolve) {
      var at = vm.page.type === 'isle' ? vm.page.isle : vm.page.type, busy = false, closed = false;
      var ov = E.ctx.overlay('<h2>' + esc(vm.title) + '</h2><div class="slw-book-top"></div>' +
        '<div class="slw-shopland slw-book-chips" role="group" aria-label="' + esc(vm.title) + '"></div><div class="slw-book-body"></div>',
        { cls: 'slw-book-ov', pts: false, onClose: function () { closed = true; seen().then(function () { resolve(true); }); } });
      if (!ov) { resolve(null); return; }
      var top = q(ov, '.slw-book-top'), chips = q(ov, '.slw-book-chips'), body = q(ov, '.slw-book-body'), sc = q(ov, '.slw-sheet');
      wireEdges(chips);
      /* the book was looked at: seen = every stamp found so far (C.seeFinds), only when something was new, and only
         by the child it opened for (closed by a profile switch: the next child's new stamps stay new) */
      function seen() {
        if (!mine()) return Promise.resolve();
        var b = E.book();
        if (!b || b.newCount <= 0) return Promise.resolve();
        if (typeof E.ctx.commitSeen === 'function') return Promise.resolve().then(function () { return E.ctx.commitSeen(); }).then(null, function () {});
        var ms = E.now();
        return commitMine(function (u) { return E.C.seeFinds(u, ms); });
      }
      function draw(page, focusChip) {
        /* another child is playing now: their book is never drawn in this one; it closes */
        if (!mine()) { if (!closed) ov._close(); return; }
        vm = view(ctx, page);
        if (!vm) return;
        at = vm.page.type === 'isle' ? vm.page.isle : vm.page.type;
        var sl = chips.scrollLeft || 0;
        top.innerHTML = '<p class="slw-book-count">' + esc(vm.count) + '</p>' + (vm.first ? '<p class="slw-book-first">' + esc(vm.first) + '</p>' : '');
        chips.innerHTML = chipsHtml(vm);
        body.innerHTML = pageHtml(E, vm.page, E.w());
        photo(E, body);
        qa(chips, '[data-page]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = b.getAttribute('data-page');
            if (p === at) return;
            draw(p, true);
            if (sc) { try { sc.scrollTop = 0; } catch (e) { /* ignore */ } }
          });
        });
        qa(body, '[data-a="take"]').forEach(function (b) { b.addEventListener('click', function () { take(b.getAttribute('data-id')); }); });
        /* the row keeps its place, and the pressed chip comes into view in it, clear of the row's end fades (centred
           when it was out of view; never scrolling the sheet) */
        var c = q(chips, '[data-page="' + at + '"]');
        try {
          chips.scrollLeft = sl;
          if (c && c.getBoundingClientRect && chips.getBoundingClientRect && chips.scrollWidth > chips.clientWidth + 1) {
            var r = chips.getBoundingClientRect(), br = c.getBoundingClientRect(), fade = 52;
            if (br.left < r.left + fade || br.right > r.right - fade) chips.scrollLeft += (br.left + br.width / 2) - (r.left + r.width / 2);
          }
          if (focusChip && c) c.focus();
        } catch (e) { /* ignore */ }
        rowEdges(chips);
      }
      /* 'Take {name} travelling': My pets' 'Make my runner' (C.setActivePet); without a commit, My pets on that pet */
      function take(id) {
        if (busy || !id) return;
        if (!mine()) { if (!closed) ov._close(); return; }
        if (typeof E.ctx.commit !== 'function') { if (typeof E.ctx.go === 'function') { ov._close(); E.ctx.go('pets', { petId: id }); } return; }
        busy = true;
        var ms = E.now();
        commitMine(function (u) { return E.C.setActivePet(u, id, ms); }).then(function () {
          busy = false;
          if (!closed) draw('passports', true);
        });
      }
      draw(at, false);
      /* pages whose last ring went with its 'if' (SLIslandDays.book().ready): recorded complete now, once; only the
         pages that commit says it completed are celebrated (a failed or raced one: none), and never on the next child */
      if (vm.ready.length && typeof E.ctx.commit === 'function') {
        var day = E.day(), ms = E.now(), ready = vm.ready.slice();
        commitMine(function (u) { return E.C.addFinds(u, { done: ready }, day, ms); }).then(function (r) {
          var done = r && r.ok && Array.isArray(r.completed) ? r.completed : [];
          if (!done.length || !mine()) return;
          if (!closed) draw(at, false);
          celebrate(E, done, mine);
        });
      }
    });
  }

  return { VERSION: VERSION, PAGES: PAGES, GLYPH: GLYPH, open: open, view: view, dateWords: dateWords };
}));
