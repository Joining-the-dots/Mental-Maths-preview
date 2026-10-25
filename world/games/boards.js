/* ================================================================
   Game boards — the sheet, the family board, the class board and the
   board notebook (window.SLBoards; loads social-core.js and
   boards-core.js itself).

   This device: every profile in this browser, from its own bests.
   Works signed out and offline; nothing is sent anywhere.
   Family: one card per child a grown-up ticked, in the family's
   database. A cloud call is made only for the signed-in, bound,
   ticked profile while the family's mode is 'family' (or, for its
   class, 'This device only') and the child has not taken themselves
   off; otherwise none at all (one exception: a 'Take me off' made
   out of reach of the card is finished, once, by writing its
   marker). One transaction posts a card (2 reads, at most 1 write);
   lists are kept in memory for 5 minutes and never in the browser's
   storage.
   Class: the same card, in the class the child's own grown-up asked
   for, whether the family's mode is 'family' or 'This device only'
   (with 'Off' there is no board at all). The child types nothing
   here: no code box, no joining and no leaving. The class code
   comes from the child's own record with the family: read in the
   family transaction, or, while the family board is off, alone in
   one read and nothing else of the family. It is kept in memory
   only and is shown only as its label ('Otter class'); a name
   typed for a class is never read. The class is
   asked only while the class grown-up's entry for the child exists
   and the class record says its board is on (one transaction: the
   entry, two fields of the class record, the card; with no entry,
   whether the request of the child's own grown-up is still there).
   Its list shows the top 10 and the child's own row, and is kept in
   memory for 10 minutes.

   What another child sees is a name from the roster their grown-up
   approved (SLSocialCore.rosterName), an avatar and a colour from
   the app's own lists, and a score. Everything read from the
   database is checked by boards-core and written with textContent.
   Games never award or spend anything; a board ranks game times and
   scores only.

     available(cfg)        false when the family's mode is 'off'
     open({host, overlay, game, variant, cfg, day, onClose})
     attach(sheet, {overlay, day})   the button on the Island games sheet
     prefetch(cfg)         warm the family list for a game that opened
                           (the class card is brought up to date, its list is not read)
     onResult({game, variant, result, outcome, cfg, menuName}) → Promise of
                           {text, kind} or null; never rejects. menuName (optional, a
                           string): the course as the game's menu calls it, '' when the
                           menu names none; the line then says that, not the board's name
     menuHint(game, variant, cfg) → one line, or ''
     noteWin({scope, code, rows, race, cfg}) → Promise of {text, kind: 'win', n, week}
                           or null; never rejects. Chunk FR: a race or challenge round's
                           final table; when this child came 1st among the children, one
                           win more in its own record of that group (a transaction: 1 read,
                           at most 1 write, 30 seconds after the last win at the soonest).
                           The sheet's 🏆 Challenge wins table lists the group's records:
                           only children with a win, most first, never a 0
     reset()               forget every list, roster, the class and any waiting post
     _env(overrides)       test seam: firebase, cloudState, state,
                           saveState, storage, locks, now, online,
                           familyCfg, core
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays, with its lists, its timers
     and any post still waiting (the shell and the Island games sheet may both ask for it) */
  if (typeof window !== 'undefined' && window.SLBoards) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLBoards;
    return;
  }
  var W = typeof window !== 'undefined' ? window : null;

  var STORE_KEY = 'timesTableQuest_v1';     /* the app's own saved state (index.html) */
  var CFG_KEY = 'slGamesCfg';               /* the family's board mode as last seen, so 'Off' holds signed out. Not private: a child can clear it */
  var LOCK = 'sl-world-commit';             /* the island's own lock */
  var SYNC_MS = 3000, LIST_MS = 5 * 60000, CLS_MS = 10 * 60000, REST_MS = 10 * 60000, CALL_MS = 8000, AGAIN_MS = 30000;
  var TOP = 10;                             /* a class list: this many rows, and the child's own */
  var SCOPE = { f: 'family', c: 'class' };  /* the two groups a child can be in, as boards-core names them */
  /* the records the security rules look up for one call, billed as reads: the family record
     for a family call; the class record, the child's entry, the request and the family named
     in it for a class call */
  var RULE_GETS = { f: 1, c: 4 };
  var CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var GAMES = [{ id: 'course', name: 'Debut Run', icon: '🐾', att: 'att_course' }, { id: 'penalty', name: 'Encore Shootout', icon: '⚽', att: 'att_pitch' },
    { id: 'kart', name: 'Neon Grand Prix', icon: '🏎️', att: 'att_kart' }];
  var T = {
    title: '🏆 Leaderboards', back: '← Back', device: '📱 This device', family: '🏠 Family', week: 'This week', ever: 'Best ever',
    loading: 'Loading…', emptyWeek: 'No scores here yet this week. Be the first!', emptyEver: 'Nobody has a best here yet. Set one!',
    notOwned: 'You don’t have this game yet. You can still look.',
    signedOut: 'Sign in with your family account to see your family board. Ask a grown-up.',
    otherProfile: 'The family board follows the account signed in on this device',
    notOn: 'Your grown-up hasn’t switched the family board on yet.',
    notTicked: 'Your grown-up hasn’t added you to the family board yet.',
    offline: 'The family board needs the internet. Your own bests are still here.',
    rest: 'The family board isn’t ready yet. Your own bests are still here.',
    resting: 'The boards are resting until tomorrow. Your own bests are still here.',
    removed: 'Your grown-up took this one off the board. Set a new one!',
    cls: '🏫 ', wait: 'Your grown-up has asked for you to join ', wait2: '. Waiting for the class grown-up.',
    clsOff: 'This class board is switched off.',
    clsNet: 'The class board needs the internet. Your own bests are still here.',
    clsRemoved: 'The class grown-up took this one off the board. Set a new one!',
    gap: ' behind the next place',
    foot: '🎮 Game scores don’t earn or spend ⭐. Boards are for fun. Scores come from each player’s own device. This week’s board starts again every Monday.',
    /* an island that pays in 🪙 coins (F-KU5 review): '🎮 ' + the island's own line for it (world-copy games.noCoins), then this */
    footRest: ' Scores come from each player’s own device. This week’s board starts again every Monday.',
    takeOff: 'Take me off the boards', putBack: 'Put me back', offNow: 'You’re off the boards. Your bests are still yours.',
    tryLater: 'That didn’t work just now. Try again when you’re online.',
    refresh: '↻ Refresh', you: ' (you)', lead: '👑 You lead this week', beat: '🎯 To beat this week: ',
    /* chunk FR: the Challenge wins table */
    winsEver: 'All time', winsEmptyWeek: 'No challenge wins yet this week. Come 1st in a race or a challenge to be the first one here!',
    winsEmptyEver: 'No challenge wins yet. Every race and every challenge is a new chance!',
    winsDevice: 'Challenge wins are kept for your family and your class. Choose 🏠 Family to see them.',
    winsFoot: '🏆 A win is a race or a challenge round where you came 1st. Only wins are counted, never losses, and everyone who plays gets better.',
    winNow: '🏆 A challenge win! '
  };
  /* chunk FR: the Challenge wins table, beside the three games on the sheet */
  var WINS = { id: 'wins', name: 'Challenge wins', icon: '🏆' };

  var S = null, B = null;                   /* SLSocialCore and SLBoardsCore, once both are here */
  var over = {}, loading = null, loadFailed = false;
  var mem = fresh();                        /* everything about other children lives here, and only here */
  /* the reads and writes this page itself has made today, per profile ({name: {d, w, r}}): a
     floor under the notebook's own count, so a notebook that cannot be saved (storage full or
     blocked) still stops this page at the caps. Counts only; kept through reset() */
  var spent = Object.create(null);
  /* a group's cloud board resting after a refusal (an account id and a time): f the family, c the class */
  var rest = { f: { key: '', until: 0 }, c: { key: '', until: 0 } };
  /* chunk FR: the same for a group's Challenge wins alone (their rules may be published later than the boards'),
     and the last rounds a win was noted for (so a table sent again counts once) */
  var restW = { f: { key: '', until: 0 }, c: { key: '', until: 0 } }, wonRaces = [];
  var sheet = null, authOn = null, lastGame = '';

  function noop() {}
  function no() { return false; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* lists, loading and checked hold one entry per group (f, c); checked.k: when the child's own kids record was last
     read. code: the class the child's own grown-up asked for
     ('' when none); state: what that class last answered: 'wait' (asked for, no entry yet), 'off' (board off, class
     closed, or neither a request nor an entry), 'on', or '' (not asked yet) */
  function fresh() { return { who: null, uid: '', lists: {}, loading: {}, checked: {}, busy: null, timer: 0, code: '', state: '', wins: {}, loadingW: {}, winT: 0 }; }

  /* ---------- the page around us (each part can be replaced by a test) ---------- */
  function given(k, d) { return has(over, k) ? over[k] : d; }
  function env() {
    var nav = typeof navigator !== 'undefined' ? navigator : null, on = given('online', nav ? nav.onLine !== false : true), store = null;
    try { store = W ? W.localStorage : null; } catch (x) { store = null; }
    return {
      firebase: given('firebase', W && W.firebase ? W.firebase : null),
      cloudState: given('cloudState', W ? W.cloudState : null),
      state: given('state', typeof state !== 'undefined' ? state : null),
      saveState: given('saveState', typeof saveState === 'function' ? saveState : null),
      storage: given('storage', store),
      locks: given('locks', nav && nav.locks ? nav.locks : null),
      now: given('now', function () { return Date.now(); }),
      online: typeof on === 'function' ? !!on() : !!on,
      familyCfg: given('familyCfg', W ? W.slFamilyCfg : null),
      core: given('core', W ? W.SLWorldCore : null)
    };
  }
  /* the board's money line: while the island pays in 🪙 coins (its core's wallet), the island's own words for the two
     wallets (world-copy games.noCoins); otherwise, or without the copy table, V4.54's line */
  function footLine(e) {
    var C = e && e.core, CP = W && W.SLWorldCopy, s = '';
    try { if (C && typeof C.walletOf === 'function' && C.walletOf() === 'coins' && CP && typeof CP.t === 'function') s = CP.t('games.noCoins', null, ''); } catch (x) { s = ''; }
    return s ? '🎮 ' + s + T.footRest : T.foot;
  }
  function cores() {
    if (!S || !B) { S = (W && W.SLSocialCore) || null; B = (W && W.SLBoardsCore) || null; }
    return !!(S && B);
  }
  /* the two rule files, loaded once if nothing else has (a tag that fails is taken out, so a later call can ask again) */
  function ready() {
    if (cores()) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var left = 0;
      function settle(ok) { if (ok && cores()) { loadFailed = false; res(); } else { loading = null; loadFailed = true; rej(new Error('boards: rule files')); } }
      function need(global, file, id) {
        if (W[global]) return;
        var s = document.getElementById(id);
        if (!s) {
          s = document.createElement('script'); s.id = id; s.async = false;
          s.src = 'world/games/' + file + '?v=' + (W.SL_WORLD_VER || '1');
          document.head.appendChild(s);
        }
        left++;
        s.addEventListener('load', function () { if (--left === 0) settle(true); });
        s.addEventListener('error', function () { s.remove(); settle(false); });
      }
      need('SLSocialCore', 'social-core.js', 'slSocialCoreJs');
      need('SLBoardsCore', 'boards-core.js', 'slBoardsCoreJs');
      if (!left) settle(true);
    });
    return loading;
  }

  /* ---------- who is playing, and what they may see ---------- */
  function profile(name) {
    var st = env().state;
    return st && st.users && typeof name === 'string' && has(st.users, name) && st.users[name] && typeof st.users[name] === 'object' ? st.users[name] : null;
  }
  function nameOf(cfg) {
    var st = env().state;
    return cfg && typeof cfg.profileKey === 'string' ? cfg.profileKey : st && typeof st.activeUser === 'string' ? st.activeUser : '';
  }
  /* the island's day (server-anchored, handed over by the caller); worked out here only when it is missing */
  function dayOf(o) {
    var d = o && o.day, e;
    if (typeof d === 'string' && B.weekKey(d)) return d;
    e = env();
    try { d = e.core.dayKey(e.now(), 'Europe/London'); if (B.weekKey(d)) return d; } catch (x) {}
    return new Date(e.now()).toISOString().slice(0, 10);
  }
  function fbReady(e) { var f = e.firebase; return !!f && typeof f.firestore === 'function' && (!f.apps || f.apps.length > 0); }
  function boundEnv(name, e) { return { firebaseReady: fbReady(e), cloudState: e.cloudState, activeUser: e.state ? e.state.activeUser : null, profileKey: name }; }
  function boundAs(name, e) { return S.bound(boundEnv(name, e)); }
  /* Called at every entry point. A change of the active profile or of the signed-in account
     wipes every list first; → true when that profile is the one now playing */
  function guard(name) {
    var e = env(), act = e.state ? e.state.activeUser : null, cs = e.cloudState;
    var uid = cs && cs.user && typeof cs.user.uid === 'string' ? cs.user.uid : '', who = String(act) + '|' + uid;
    if (mem.who !== who) { reset(); mem.who = who; mem.uid = uid; }
    if (e.firebase && authOn !== e.firebase && typeof e.firebase.auth === 'function') {
      authOn = e.firebase;
      try { e.firebase.auth().onAuthStateChanged(function (user) { if ((user && user.uid ? user.uid : '') !== mem.uid) wipe(); }); } catch (x) {}
    }
    return typeof name === 'string' && !!name && name === act && !!profile(name);
  }
  function reset() {
    if (mem.timer) clearTimeout(mem.timer);
    if (mem.winT) clearTimeout(mem.winT);
    mem = fresh();
  }
  /* a sign-in, a sign-out, another profile, the page put away: nothing about another child
     stays on screen (an open sheet goes back to This device) */
  function wipe() {
    reset();
    if (!sheet) return;
    sheet.scope = 'device';
    try { draw(); } catch (x) {}
  }

  /* The family's board mode and order. From the family record the app already holds while
     this profile is the bound one (and remembered then); otherwise as last seen on this device */
  function modeOf(name) {
    var e = env(), r = null;
    try { r = JSON.parse(e.storage.getItem(CFG_KEY) || 'null'); } catch (x) { r = null; }
    if (!r || typeof r !== 'object') r = {};
    var out = { boards: r.boards === 'off' || r.boards === 'family' ? r.boards : 'device', order: r.order === 'az' ? 'az' : 'ranked' };
    if (!cores() || !e.familyCfg || !boundAs(name, e).ok) return out;
    var g = S.gamesCfg(e.familyCfg);
    if (r.boards !== g.boards || r.order !== g.order || r.setAt !== g.setAt) {
      try { e.storage.setItem(CFG_KEY, JSON.stringify({ boards: g.boards, order: g.order, setAt: g.setAt })); } catch (x) {}
    }
    return { boards: g.boards, order: g.order };
  }
  /* The one test before any cloud call, for the family board, (c) the class board or (kd) the
     child's own kids record alone: {ok, k, uid, code, fam, key} or {ok: false, why}; k is 'f'
     or 'c', code the family's or the class's. The class needs a class code already in memory
     and a family whose boards are not switched off; it does not need the family board. The
     kids record alone is read only while the family's mode is 'This device only', to learn
     the class (in 'family' mode the family transaction reads it).
     offToo: for 'Take me off' / 'Put me back', which must reach the card of a child who is off */
  function gates(name, offToo, c, kd) {
    var e = env(), b = boundAs(name, e), u = profile(name), fam = e.familyCfg, k = c ? 'c' : 'f', mode;
    if (!b.ok) return { ok: false, why: b.why };
    if (!u || !CODE_RE.test(b.familyCode)) return { ok: false, why: 'nofamily' };
    if (!offToo && B.notebook(u).off) return { ok: false, why: 'off' };
    if (!fam || typeof fam !== 'object') return { ok: false, why: 'nocfg' };
    mode = S.gamesCfg(fam).boards;
    if (kd ? !S.ON.classes || mode !== 'device' : c ? !S.ON.classes || mode === 'off' || !S.classLabel(mem.code) : mode !== 'family') return { ok: false, why: 'mode' };
    if (!S.memberOk(fam, b.uid)) return { ok: false, why: 'unticked' };
    if (rest[k].key === b.uid && e.now() < rest[k].until) return { ok: false, why: 'rest' };
    return { ok: true, k: k, uid: b.uid, code: c ? mem.code : b.familyCode, fam: fam, key: S.cacheKey(boundEnv(name, e)) };
  }
  function listFor(g) {
    var l = g.ok ? mem.lists[g.k] : null;
    return l && l.key === g.key && l.code === g.code && (g.k === 'f' || mem.state === 'on') ? l : null;
  }
  /* what standings is told about a group's list. A class: its top 10 and the child's own row, with no family ticks
     to look up (classmates are from other families), in the order the child's own grown-up chose */
  function famOpts(g, list) {
    var o = { roster: list.roster, isRude: S.rudeFrom(env().core), me: g.uid };
    if (g.k === 'c') { o.top = TOP; o.order = S.gamesCfg(g.fam).order; } else o.games = g.fam;
    return o;
  }
  /* the group's cards with this child's own as their device has it now (a result is posted 3 seconds later) */
  function withMine(list, g, u, week) {
    var own = list.cards.filter(function (c) { return c && c.uid === g.uid; })[0];
    var want = B.desiredCard(u, S.who(u), own ? own.card : null, week, SCOPE[g.k]);
    return want.card ? B.patchRow(list.cards, g.uid, want.card) : list.cards;
  }
  /* The class this child's own grown-up asked for, from the child's own record with the family, just read.
     Kept in memory only, and only when both of its words are known ones; a change forgets the old class */
  function setCode(kd) {
    var code = kd && typeof kd.cls === 'string' && S.classLabel(kd.cls) ? kd.cls : '';
    mem.checked.k = env().now();
    if (code === mem.code) return;
    mem.code = code; mem.state = ''; mem.checked.c = 0;
    delete mem.lists.c;
  }

  /* ---------- the board notebook (u.lb) ---------- */
  /* Every change to a profile's notebook goes through here, the island's own way: its lock,
     a fresh read of what is stored, the change, the fresh state put into memory as the
     island's adapter does, save. mutate(lb) gets a copy with defaults and returns the
     notebook to keep (null: no change). No profile object is held across a wait.
     → Promise of true when something was saved; never rejects */
  function lbCommit(name, mutate) {
    function run() {
      var e = env(), st = e.state;
      function read() { try { return JSON.parse(e.storage.getItem(STORE_KEY)); } catch (x) { return null; } }
      if (!st || !st.users || st.activeUser !== name || typeof e.saveState !== 'function' || !e.storage) return false;
      var disk = read(), inMem = st.users[name], onDisk = disk && disk.users ? disk.users[name] : null;
      /* this tab wrote the profile most recently: what memory holds goes to disk first, so the fresh read drops nothing */
      if (inMem && (!onDisk || (inMem._localUpdatedAt || 0) >= (onDisk._localUpdatedAt || 0))) { e.saveState(); disk = read(); }
      var u = disk && disk.users && disk.activeUser === name ? disk.users[name] : null;
      if (!u || typeof u !== 'object') return false;
      var next = mutate(B.notebook(u));
      if (!next || JSON.stringify(next) === JSON.stringify(u.lb)) return false;
      u.lb = next;
      Object.keys(disk).forEach(function (k) { st[k] = disk[k]; });
      e.saveState();
      return true;
    }
    var L = env().locks, p = null;
    try { p = L && typeof L.request === 'function' ? L.request(LOCK, run) : null; } catch (x) { p = null; }
    return Promise.resolve(p || Promise.resolve().then(run)).then(null, no);
  }
  /* ---------- the day's caps (boards-core: 40 card writes, 600 reads) ---------- */
  /* the notebook's count for the day, or what this page alone has made today when that is more */
  function withSpent(lb, name, day) {
    var m = has(spent, name) ? spent[name] : null;
    if (!m || m.d !== day) return lb;
    if (lb.n.d !== day) lb.n = { d: day, w: 0, r: 0 };
    lb.n.w = Math.max(lb.n.w, m.w); lb.n.r = Math.max(lb.n.r, m.r);
    return lb;
  }
  /* room today for one more card write ('w') or read ('r') */
  function room(name, day, what) { return B.tally(withSpent(B.notebook(profile(name)), name, day), day, what).ok; }
  /* A call has made these reads and writes ({r, w}): added to this page's own count at once,
     whatever becomes of the notebook, and → the change for the notebook (the caller's lbCommit
     applies it, so the count survives a reload, and is shared with the island's other tabs,
     when the notebook can be saved). Each call is counted once in each */
  function charge(name, day, n) {
    function add(lb) { ['r', 'w'].forEach(function (k) { lb = B.spend(lb, day, k, n[k] || 0); }); return lb; }
    if (B.weekKey(day)) {
      if (!has(spent, name) || spent[name].d !== day) spent[name] = { d: day, w: 0, r: 0 };
      spent[name] = add({ n: spent[name] }).n;
    }
    return add;
  }
  /* the This-device board: one card per profile in this browser, built from its own bests.
     mine stands in for the playing profile (its state before or after a result) */
  function localCards(week, name, mine) {
    var st = env().state, out = [];
    Object.keys((st && st.users) || {}).forEach(function (n) {
      var u = n === name && mine ? mine : st.users[n];
      if (!u || typeof u !== 'object' || B.notebook(u).off) return;
      var c = B.desiredCard(u, S.who(u), null, week, 'device').card;
      if (c) out[n === name ? 'unshift' : 'push']({ uid: n, card: c });
    });
    return out;
  }

  /* ---------- the family board and the class board in the database ---------- */
  /* a group's documents. mine: the child's own record with the group (the removal counts):
     the kids record of the family, or the entry the class grown-up made. asked: the request
     the child's own grown-up filed with a class (only whether it exists is ever looked at) */
  function refs(g, e) {
    var c = g.k === 'c', at = e.firebase.firestore().collection(c ? 'classes' : 'families').doc(g.code);
    return { at: at, cards: at.collection('boards'), card: at.collection('boards').doc(g.uid), mine: at.collection(c ? 'members' : 'kids').doc(g.uid),
      asked: c ? at.collection('requests').doc(g.uid) : null, roster: at.collection('private').doc('roster') };
  }
  /* a call that takes over 8 seconds counts as failed; a refusal rests that group's board for 10 minutes,
     with no pop-up, and its list in memory is dropped */
  function call(fn, g) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej({ code: 'timeout' }); }, CALL_MS);
      Promise.resolve().then(fn).then(function (v) { clearTimeout(t); res(v); }, function (x) { clearTimeout(t); rej(x); });
    }).then(null, function (x) {
      if (x && x.code === 'permission-denied') { rest[g.k] = { key: g.uid, until: env().now() + REST_MS }; delete mem.lists[g.k]; }
      throw x;
    });
  }
  /* One transaction for one group. Family: read this child's own record with the family (the
     removal counts, and the class their grown-up asked for) and own card, write the card only
     if it would change. Class (c): the same over the class's documents, and only when the
     class grown-up's entry for the child exists and the class record says the board is on and
     the class open (those two fields are all that is read from it); with no entry, one look
     at whether the request is still there tells waiting from a class that has gone. A card
     that is the 'Take me off' marker is left alone and remembered. act 'off' writes the marker, 'back' a normal
     card over it; with no class board to write to, either takes the child's card out of the
     class (cut), which, with no family sync beside it, leaves it as it should be. famOn: the
     family transaction has just found the family card to be a normal one.
     → Promise of true when the card is as it should be; never rejects */
  function sync(name, day, act, c, famOn) {
    if (!guard(name)) return Promise.resolve(false);
    var e = env(), g = gates(name, !!act, c), week = B.weekKey(day), was = mem, rec, rm = null, out = null, st = '', cut = false, reads = 0;
    if (!g.ok || !week) return Promise.resolve(false);
    var alone = !c || !gates(name, !!act).ok;      /* no family sync beside this one to say whether a post still waits */
    if (!e.online) return lbCommit(name, function (lb) { lb.d = 1; return lb; }).then(no);
    /* the day's caps; 'Take me off the boards' is never held back by them */
    if (act !== 'off' && (!room(name, day, 'w') || !room(name, day, 'r'))) return Promise.resolve(false);
    if (mem.busy) return mem.busy.then(function () { return sync(name, day, act, c, famOn); });
    mem.busy = call(function () {
      var r = refs(g, e);
      return e.firebase.firestore().runTransaction(function (tx) {
        /* every read is counted (a transaction tried again reads again), with the records the
           rules look up for it: none for the child's own records, 1 for the class record */
        function get(ref, looks) { reads += 1 + looks; return tx.get(ref); }
        return get(r.mine, 0).then(function (ms) {
          rec = ms.exists ? ms.data() : null;
          out = null; cut = false;
          if (!c) return true;
          if (!rec) return get(r.asked, 0).then(function (qs) { st = qs.exists ? 'wait' : 'off'; return false; });
          return get(r.at, 1).then(function (cs) {
            var cd = cs.exists ? cs.data() : null;
            st = cd && cd.on === true && cd.closed === false ? 'on' : 'off';
            return st === 'on';
          });
        }).then(function (go) {
          if (go) return get(r.card, RULE_GETS[g.k]);
          if (act && mem === was) { tx.delete(r.card); cut = true; }
          return null;
        }).then(function (cs) {
          var u = profile(name), cloud = cs && cs.exists ? cs.data() : null;
          rm = rec && rec.rm && typeof rec.rm === 'object' ? rec.rm : {};
          if (!cs || !u || mem !== was) return;
          out = { card: cloud, off: !!cloud && cloud.off === true, wrote: false };
          /* a marker still in the class after a 'Put me back' that reached only the family card is written over */
          var anew = act === 'back' || (!!c && out.off && famOn === true);
          var want = act === 'off' ? { card: B.markerCard(S.who(u), day), changed: !out.off } : B.desiredCard(u, S.who(u), anew ? null : cloud, week, SCOPE[g.k], rm);
          if (want.off || !want.card || !want.changed) return;
          var doc = JSON.parse(JSON.stringify(want.card));
          doc.at = e.firebase.firestore.FieldValue.serverTimestamp();
          tx.set(r.card, doc);
          out = { card: want.card, off: act === 'off', wrote: true };
        });
      });
    }, g).then(function () { return ''; }, function (x) { return x && x.code === 'permission-denied' ? 'no' : 'err'; }).then(function (bad) {
      /* quiet: the class has no board for this child just now (no entry yet, switched off, or refused), so nothing waits there */
      /* done: as it should be. A card cut from the class counts only with no family sync beside it (which has the lasting word) */
      var ok = !bad && !!out, quiet = !!c && !ok && bad !== 'err', done = ok || (!bad && cut && alone);
      var wrote = ok && out.wrote, counted = charge(name, day, { r: reads + (wrote ? RULE_GETS[g.k] : 0), w: wrote ? 1 : 0 });
      if (mem === was) {
        mem.busy = null;
        if (!c && rec !== undefined) setCode(rec);
        if (c && bad !== 'err') mem.state = bad ? 'wait' : st;
        if (ok || quiet) mem.checked[g.k] = e.now();
        /* the child's own row goes into the list in memory: the list is not read again */
        if (ok && out.card && mem.lists[g.k] && mem.lists[g.k].key === g.key) mem.lists[g.k].cards = B.patchRow(mem.lists[g.k].cards, g.uid, out.card);
      }
      return lbCommit(name, function (lb) {
        lb = counted(lb);                                   /* the reads made and the card written, against the day's caps */
        if (rm) lb = B.applyCuts(lb, SCOPE[g.k], rm, week); /* kept as soon as the counts are read, whatever became of the write */
        /* the class answered that it has no board for this child: with no family sync beside it, nothing waits */
        if (!done) { if (!quiet) lb.d = 1; else if (alone && !bad && st !== 'on') lb.d = 0; return lb; }
        if (alone) lb.d = 0;
        lb.off = !ok ? (act === 'off' ? 1 : 0) : out.off ? 1 : act === 'back' ? 0 : lb.off;
        return lb;
      }).then(function () { if (sheet) draw(); return done; });
    });
    return mem.busy;
  }
  /* the family card, then the card in the class: → true when one of them is as it should be */
  function syncAll(name, day, act) {
    return sync(name, day, act).then(function (f) { return sync(name, day, act, true, f).then(function (c) { return f || c; }); });
  }
  /* every card in the group and its roster of shown names, read together and kept together:
     5 minutes for the family, 10 for a class (asked only while its board is known to be on) */
  function loadList(name, day, c) {
    var e = env(), g = gates(name, false, c), was = mem, k = c ? 'c' : 'f', had = mem.lists[k];
    if (!g.ok || !e.online || (c && mem.state !== 'on')) return Promise.resolve(false);
    if (had && had.key === g.key && had.code === g.code && e.now() - had.at < (c ? CLS_MS : LIST_MS)) return Promise.resolve(true);
    if (mem.loading[k]) return mem.loading[k];
    if (!room(name, day, 'r')) return Promise.resolve(false);      /* the day's cap */
    /* what the two requests cost: each card (at least 1 for the list) and the roster, each request with the rules' look-ups */
    function count(n) { return lbCommit(name, charge(name, day, { r: Math.max(1, n) + 1 + 2 * RULE_GETS[k] })); }
    mem.loading[k] = call(function () { var r = refs(g, e); return Promise.all([r.cards.limit(B.MAX_CARDS).get(), r.roster.get()]); }, g).then(function (got) {
      var cards = [];
      got[0].forEach(function (d) { cards.push({ uid: d.id, card: d.data() }); });
      if (mem === was) {
        mem.lists[k] = { key: g.key, code: g.code, cards: cards, roster: got[1].exists ? got[1].data() : null, at: e.now() };
        mem.loading[k] = null;
      }
      return count(cards.length).then(function () { return mem === was; });
    }, function () { if (mem === was) mem.loading[k] = null; return count(1).then(no); });
    return mem.loading[k];
  }
  /* The family's mode is 'This device only': the class the child's own grown-up asked for is
     learnt from one read of the child's own kids record (in 'family' mode the family
     transaction reads it), and nothing else of the family is read or written. Once in a
     player's session, and for the sheet when the last read is over 5 minutes old. The read
     counts against the island's day (day) and waits for room under the cap, except when
     it is for 'Take me off the boards' (offToo).
     → Promise of true when the record was read just now; never rejects */
  function learn(name, offToo, opened, day) {
    var e = env(), g = gates(name, offToo, false, true), at = mem.checked.k, was = mem;
    if (!g.ok || !e.online || (at && !(opened && e.now() - at > LIST_MS))) return Promise.resolve(false);
    if (!offToo && !room(name, day, 'r')) return Promise.resolve(false);      /* the day's cap */
    if (mem.busy) return mem.busy.then(function () { return learn(name, offToo, opened, day); });
    function count(v) { return lbCommit(name, charge(name, day, { r: 1 })).then(function () { return v; }); }
    mem.busy = call(function () { return refs(g, e).mine.get(); }, g).then(function (ks) {
      if (mem !== was) return count(false);
      mem.busy = null;
      setCode(ks.exists ? ks.data() : null);
      return count(true);
    }, function () { if (mem === was) mem.busy = null; return count(false); });
    return mem.busy;
  }
  /* One group, when a game or the sheet has opened: bring the card up to date, then warm the
     list (a class list only for the sheet). The card is checked when
     something waits to be posted (d), once for each player's session, and, for the sheet
     (opened), when the last check is over 5 minutes old. Never on a timer.
     → Promise of true when the card was checked just now and is as it should be */
  function look(name, day, c, d, opened, famOn) {
    var e = env(), g = gates(name, false, c), at = mem.checked[c ? 'c' : 'f'];
    if (!g.ok || !e.online) return Promise.resolve(false);
    return (d || !at || (opened && e.now() - at > LIST_MS) ? sync(name, day, '', c, famOn) : Promise.resolve(false)).then(function (ok) {
      return (c && !opened ? Promise.resolve() : loadList(name, day, c)).then(function () { return ok; });
    });
  }
  /* the family first: its transaction is where the class code comes from (with the family board
     off, the kids record alone; for a child who is off, only to finish a 'Take me off') */
  function refresh(name, day, opened) {
    var lb = B.notebook(profile(name));
    return learn(name, !!lb.off && !!lb.d, opened, day).then(function () {
      lb = B.notebook(profile(name));
      /* a 'Take me off' whose marker card could not be written at the time is finished first */
      if (lb.off && lb.d && env().online && (gates(name, true).ok || gates(name, true, true).ok)) return syncAll(name, day, 'off').then(no);
      return look(name, day, false, lb.d, opened).then(function (f) { return look(name, day, true, lb.d, opened, f); });
    });
  }
  /* 3 seconds after a result: the family card, then the class card. Neither list is read again:
     the child's own row is put into a list already in memory, and the class list is read only
     when the sheet opens (a whole class list after every post was most of a class's reads) */
  function later(name, day) {
    if (mem.timer) clearTimeout(mem.timer);
    mem.timer = setTimeout(function () {
      mem.timer = 0;
      sync(name, day).then(function (f) { return look(name, day, true, 1, false, f); }).then(null, noop);
    }, SYNC_MS);
  }

  /* ---------- Challenge wins (chunk FR) ---------- */
  /* a call for the wins alone: 8 seconds, and a refusal rests the group's wins (not its board) for 10 minutes */
  function callW(fn, k, uid) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej({ code: 'timeout' }); }, CALL_MS);
      Promise.resolve().then(fn).then(function (v) { clearTimeout(t); res(v); }, function (x) { clearTimeout(t); rej(x); });
    }).then(null, function (x) {
      if (x && x.code === 'permission-denied') { restW[k] = { key: uid, until: env().now() + REST_MS }; delete mem.wins[k]; }
      throw x;
    });
  }
  function winsFor(g) {
    var l = g.ok ? mem.wins[g.k] : null;
    return l && l.key === g.key && l.code === g.code && (g.k === 'f' || mem.state === 'on') ? l : null;
  }
  /* A group's wins records, read when the sheet shows the Challenge wins table: one list
     read (with the rules' look-ups), kept in memory as long as the group's board list.
     The names come from the roster read with that list. → Promise of true when in memory */
  function loadWins(name, day, c) {
    var e = env(), g = gates(name, false, c), was = mem, k = c ? 'c' : 'f', had = mem.wins[k];
    if (!g.ok || !e.online || (c && mem.state !== 'on')) return Promise.resolve(false);
    if (had && had.key === g.key && had.code === g.code && e.now() - had.at < (c ? CLS_MS : LIST_MS)) return Promise.resolve(true);
    if (restW[k].key === g.uid && e.now() < restW[k].until) return Promise.resolve(false);
    if (mem.loadingW[k]) return mem.loadingW[k];
    if (!room(name, day, 'r')) return Promise.resolve(false);      /* the day's cap */
    function count(n) { return lbCommit(name, charge(name, day, { r: Math.max(1, n) + RULE_GETS[k] })); }
    mem.loadingW[k] = callW(function () { return refs(g, e).at.collection('wins').limit(B.MAX_CARDS).get(); }, k, g.uid).then(function (ws) {
      var docs = [];
      ws.forEach(function (d) { docs.push({ uid: d.id, doc: d.data() }); });
      if (mem === was) { mem.wins[k] = { key: g.key, code: g.code, docs: docs, at: e.now() }; mem.loadingW[k] = null; }
      return count(docs.length).then(function () { return mem === was; });
    }, function () { if (mem === was) mem.loadingW[k] = null; return count(1).then(no); });
    return mem.loadingW[k];
  }
  /* Who may add a win in a group, from what the page holds: the signed-in family profile now
     playing, not off the boards, with boards not switched off, ticked with a password of its
     own; the family while its races are on, or a class (by its code; the rules check the
     membership). {ok, k, uid, code, key} or {ok: false} */
  function winGate(name, scope, code) {
    var e = env(), b = boundAs(name, e), u = profile(name), fam = e.familyCfg, c = scope === 'class', k = c ? 'c' : 'f';
    if (!b.ok || !u || !CODE_RE.test(b.familyCode) || B.notebook(u).off || modeOf(name).boards === 'off') return { ok: false };
    if (!fam || typeof fam !== 'object' || !S.memberOk(fam, b.uid)) return { ok: false };
    if (c ? !(S.ON.classes && typeof code === 'string' && S.classLabel(code)) : !(code === b.familyCode && S.gamesCfg(fam).race === true)) return { ok: false };
    if (restW[k].key === b.uid && e.now() < restW[k].until) return { ok: false };
    return { ok: true, k: k, uid: b.uid, code: c ? code : b.familyCode, key: S.cacheKey(boundEnv(name, e)) };
  }
  function winNote(o, again) {
    var cfg = o.cfg || {}, name = nameOf(cfg);
    if (!S.ON.boards || !guard(name) || !B.cameFirst(o.rows)) return null;
    if (!again && o.race != null) {
      if (wonRaces.indexOf(o.race) >= 0) return null;
      wonRaces.push(o.race);
      if (wonRaces.length > 20) wonRaces.shift();
    }
    var e = env(), g = winGate(name, o.scope, o.code), day = dayOf(cfg), week = B.weekKey(day), was = mem, reads = 0, out = null, wait = 0;
    if (!g.ok || !e.online || !week || !fbReady(e)) return null;
    if (!room(name, day, 'w') || !room(name, day, 'r')) return null;      /* the day's caps */
    var db = e.firebase.firestore(), ref = db.collection(g.k === 'c' ? 'classes' : 'families').doc(g.code).collection('wins').doc(g.uid);
    return callW(function () {
      return db.runTransaction(function (tx) {
        reads += 1 + RULE_GETS[g.k];
        return tx.get(ref).then(function (snap) {
          var old = snap.exists ? snap.data() : null, u = profile(name), at = old && old.at;
          out = null;
          wait = B.winWait(at && typeof at.toMillis === 'function' ? at.toMillis() : NaN, e.now());
          if (!u || wait || mem !== was) return;
          var doc = B.nextWins(old, week, S.who(u));
          if (!doc) return;
          var w = JSON.parse(JSON.stringify(doc));
          w.at = e.firebase.firestore.FieldValue.serverTimestamp();
          tx.set(ref, w);
          out = doc;
        });
      });
    }, g.k, g.uid).then(function () { return true; }, function () { return false; }).then(function (fine) {
      var wrote = fine && !!out, counted = charge(name, day, { r: reads + (wrote ? RULE_GETS[g.k] : 0), w: wrote ? 1 : 0 });
      return lbCommit(name, counted).then(function () {
        /* the last win was under 30 seconds ago: once more, when the rules will take it */
        if (fine && wait && !again && mem === was) {
          return new Promise(function (res) {
            mem.winT = setTimeout(function () { mem.winT = 0; res(winNote(o, true)); }, wait);
          });
        }
        if (!wrote) return null;
        var list = mem === was ? mem.wins[g.k] : null;
        if (list && list.key === g.key && list.code === g.code) {
          list.docs = list.docs.filter(function (d) { return d && d.uid !== g.uid; }).concat([{ uid: g.uid, doc: out }]);
        }
        if (sheet) draw();
        return { text: T.winNow + B.winsText(out.wk.n) + ' this week.', kind: 'win', n: out.n, week: out.wk.n };
      });
    });
  }
  /* A race or challenge round has its final table. o = {scope: 'family' | 'class', code (the
     family's or the class's), rows (the table's rows: kind 'me' | 'kid' | 'crew', place),
     race (anything that names this round: a table sent again counts once), cfg}. When this
     child came 1st among the children, one win is added to its own record in that group.
     → Promise of {text, kind: 'win', n, week} or null; never rejects */
  function noteWin(o) {
    return ready().then(function () { return winNote(o || {}); }).then(null, function () { return null; });
  }

  /* ---------- a finished round ---------- */
  /* the one line under a result: the best news from the family board and the class board
     when their lists are in memory (the family's first when both have the same kind of
     news), else this device when two or more profiles have a score there. was / now: the
     profile before and after the result */
  function lineFor(name, key, week, was, now, shown) {
    var gs = [gates(name), gates(name, false, true)].filter(listFor), best = null;
    var order = gs.length ? S.gamesCfg(gs[0].fam).order : modeOf(name).order;
    (gs.length ? gs : [null]).forEach(function (g) {
      var list = g ? listFor(g) : null;
      ['week', 'ever'].forEach(function (period) {
        var before, after, o;
        if (list) {
          o = famOpts(g, list);
          before = B.standings(list.cards, key, period, week, o);
          after = B.standings(withMine(list, g, now, week), key, period, week, o);
        } else {
          o = { local: true, me: name, order: order };
          before = B.standings(localCards(week, name, was), key, period, week, o);
          after = B.standings(localCards(week, name, now), key, period, week, o);
          if (after.count < 2) return;
        }
        var ctx = { key: key, period: period, group: !list ? 'this device' : g.k === 'c' ? S.classLabel(g.code) : 'your family', order: order };
        if (typeof shown === 'string') ctx.course = shown;      /* the course as the menu calls it (the shell's menuName) */
        var line = B.moveLine(before, after, ctx);
        if (line && (!best || B.LINE_KINDS.indexOf(line.kind) < B.LINE_KINDS.indexOf(best.kind))) best = line;
      });
    });
    return best;
  }
  function note(a) {
    var o = a.outcome, cfg = a.cfg || {}, name = nameOf(cfg), res = a.result || {};
    if (!S.ON.boards || !o || o.ok !== true || !guard(name)) return null;
    var key = typeof o.key === 'string' ? o.key : String(a.game) + ':' + String(a.variant || 'std'), r = B.rule(key);
    var v = r ? (r.better === 'lower' ? res.ms : res.score) : null;
    if (!r || !B.validValue(key, v)) return null;
    lastGame = r.game;
    var day = dayOf(cfg), week = B.weekKey(day), u = profile(name), lb = B.notebook(u), noted = B.noteResult(lb, key, v, week);
    if (!noted.weekImproved && !noted.everImproved && o.isPB !== true) return null;
    /* the island has already saved the personal best: what it was before is in its answer */
    var pb = (u.world && u.world.pb) || {}, pbWas = {};
    Object.keys(pb).forEach(function (k) { pbWas[k] = pb[k]; });
    if (o.isPB === true) { if (o.prev) pbWas[key] = o.prev; else delete pbWas[key]; }
    function shot(l, p) { return { avatar: u.avatar, color: u.color, lb: l, world: { pb: p } }; }
    var line = modeOf(name).boards === 'off' ? null : lineFor(name, key, week, shot(lb, pbWas), shot(noted.lb, pb), typeof a.menuName === 'string' ? a.menuName : undefined);
    /* d: something to post at the next chance (left alone for a child who is off the boards) */
    lbCommit(name, function (cur) { var n = B.noteResult(cur, key, v, week).lb; if (!n.off) n.d = 1; return n; })
      .then(function () { if (guard(name) && (gates(name).ok || gates(name, false, true).ok)) later(name, day); });
    return line;
  }
  function onResult(a) {
    return ready().then(function () { return note(a || {}); }).then(null, function () { return null; });
  }
  function hintOf(st, key) {
    var rows = st.rows, i = -1, j;
    rows.forEach(function (r, n) { if (r.me) i = n; });
    if (rows.length < (i < 0 ? 1 : 2) || !rows.some(function (r) { return r.place != null; })) return '';   /* 'A to Z': no target */
    if (i < 0) j = rows.length - 1;
    else {
      j = i - 1;
      while (j >= 0 && rows[j].v === rows[i].v) j--;
      if (j < 0) return i === 0 && rows[1].v !== rows[0].v ? T.lead : '';
    }
    return T.beat + rows[j].n + ' ' + B.showValue(key, rows[j].v);
  }
  function menuHint(game, variant, cfg) {
    try {
      var name = nameOf(cfg);
      if (!cores() || !S.ON.boards || !guard(name)) return '';
      var m = modeOf(name), key = String(game) + ':' + String(variant || 'std'), week = B.weekKey(dayOf(cfg)), g = gates(name), list = listFor(g);
      if (m.boards === 'off') return '';
      if (!list) { g = gates(name, false, true); list = listFor(g); }      /* no family list in memory: the class's, when it is */
      return hintOf(list ? B.standings(withMine(list, g, profile(name), week), key, 'week', week, famOpts(g, list))
        : B.standings(localCards(week, name), key, 'week', week, { local: true, me: name, order: m.order }), key);
    } catch (x) { return ''; }
  }
  function prefetch(cfg) {
    ready().then(function () {
      var name = nameOf(cfg);
      if (S.ON.boards && guard(name)) return refresh(name, dayOf(cfg));
    }).then(null, noop);
  }
  function available(cfg) {
    try {
      var ok = cores(), name = nameOf(cfg);
      if (!ok) ready().then(null, noop);
      if (ok ? !S.ON.boards : loadFailed) return false;
      if (ok) guard(name);
      return modeOf(name).boards !== 'off';
    } catch (x) { return false; }
  }

  /* ---------- the sheet ---------- */
  function css() {
    if (document.getElementById('slbCss')) return;
    var c = document.createElement('style');
    c.id = 'slbCss';
    /* one column at any width; nothing moves or fades, so reduced motion needs no rule of its own */
    c.textContent = [
      '.slb{display:flex;flex-direction:column;gap:8px;width:100%;max-width:520px;margin:0 auto;text-align:left;font-family:system-ui,sans-serif;color:inherit;}',
      '.slb-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}',
      '.slb-chip{border:2px solid currentColor;background:transparent;color:inherit;border-radius:999px;min-height:44px;padding:4px 12px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;opacity:.85;touch-action:manipulation;}',
      '.slb-chip[aria-pressed=true]{background:#ffd23f;border-color:#ffd23f;color:#4a3200;opacity:1;}',
      '.slb-chip:disabled{opacity:.4;cursor:default;}',
      '.slb-chip:focus-visible,.slb-link:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;}',
      '.slb .slb-why,.slb .slb-note,.slb .slb-foot{margin:0;max-width:none;font-size:13px;font-weight:600;color:inherit;opacity:.85;}',
      '.slb .slb-note{font-size:15px;font-weight:700;opacity:1;}',
      '.slb-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:320px;max-height:min(44vh,320px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}',
      '.slb-row{display:flex;align-items:center;gap:8px;min-height:44px;padding:2px 10px;border-radius:12px;background:rgba(127,127,127,.16);font-weight:800;font-size:16px;}',
      '.slb-row.me{background:rgba(255,210,63,.3);outline:2px solid #ffd23f;outline-offset:-2px;}',
      '.slb-row.far{flex-wrap:wrap;}',
      '.slb-gap{flex:0 0 100%;margin:-4px 0 4px;text-align:right;font-size:13px;font-weight:700;}',
      '.slb-pl{flex:0 0 2.6em;}',
      '.slb-av{flex:0 0 34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;}',
      '.slb-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.slb-link{background:none;border:none;color:inherit;text-decoration:underline;font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-height:44px;padding:0 6px;}',
      '.slb-link:disabled{opacity:.4;cursor:default;}',
      '.slb-open{display:block;margin:0 0 10px;}'
    ].join('\n');
    document.head.appendChild(c);
  }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = text;
    return n;
  }
  function owns(u, att) { var o = u && u.world && u.world.owned; return !!o && o[att] > 0; }
  /* why the Family chip cannot be used: one plain line */
  function whyText(g, e) {
    var w = g.why, cs = e.cloudState;
    if (g.ok || w === 'nofirebase' || w === 'nocfg') return T.offline;
    if (w === 'otherprofile') return cs && typeof cs.boundName === 'string' && cs.boundName ? T.otherProfile + ' (' + cs.boundName + ').' : T.signedOut;
    return w === 'mode' ? T.notOn : w === 'unticked' ? T.notTicked : w === 'off' ? T.offNow : w === 'rest' ? T.rest : T.signedOut;
  }
  /* why the Class chip cannot be used: one plain line (label: 'Otter class'). A refusal reads
     as waiting: the class grown-up has still to add the child, or to add them again */
  function clsText(g, e, label) {
    if (!g.ok && g.why !== 'rest') return '';      /* the line for the Family chip has said it */
    if (mem.state === 'off') return T.clsOff;
    if (mem.state === 'wait' || !g.ok) return T.wait + label + T.wait2;
    return e.online ? '' : T.clsNet;
  }
  /* one row: place (when it has one), avatar on the child's colour, name, value. Text only.
     far: the child's own row under a class's top 10, with how far the next place is and no place */
  function rowEl(r, key, far) {
    var gap = far && r.gap > 0 ? B.fmtValue(key, r.gap) + T.gap : '';
    var li = mk('li', 'slb-row' + (r.me ? ' me' : '') + (gap ? ' far' : '')), place = r.place ? B.ordinal(r.place) : '', val = B.showValue(key, r.v);
    var av = mk('span', 'slb-av', S.avatarAt(r.ai));
    av.style.background = S.colorAt(r.ci);
    av.setAttribute('aria-hidden', 'true');
    li.appendChild(mk('span', 'slb-pl', place));
    li.appendChild(av);
    li.appendChild(mk('span', 'slb-nm', r.n + (r.me ? T.you : '')));
    li.appendChild(mk('span', 'slb-v', val));
    if (gap) li.appendChild(mk('span', 'slb-gap', gap));
    li.setAttribute('aria-label', [place, r.n + (r.me ? ', you' : ''), B.sayValue(key, r.v), gap.replace(/ s /, ' seconds ')].filter(Boolean).join(', '));
    return li;
  }
  /* chunk FR: one row of the Challenge wins table: place (when it has one), avatar, name, '3 wins'. Text only */
  function winsRowEl(r) {
    var li = mk('li', 'slb-row' + (r.me ? ' me' : '')), place = r.place ? B.ordinal(r.place) : '', val = B.winsText(r.v);
    var av = mk('span', 'slb-av', S.avatarAt(r.ai));
    av.style.background = S.colorAt(r.ci);
    av.setAttribute('aria-hidden', 'true');
    li.appendChild(mk('span', 'slb-pl', place));
    li.appendChild(av);
    li.appendChild(mk('span', 'slb-nm', r.n + (r.me ? T.you : '')));
    li.appendChild(mk('span', 'slb-v', val));
    li.setAttribute('aria-label', [place, r.n + (r.me ? ', you' : ''), val].filter(Boolean).join(', '));
    return li;
  }
  /* what winsTable is told: the group's roster and ticks as for its board, and the children who
     took themselves off the boards (their marker card in the list, or this child's own notebook) */
  function winsOpts(g, list, u) {
    var o = famOpts(g, list), hide = list.cards.filter(function (c) { return c && c.card && c.card.off === true; }).map(function (c) { return c.uid; });
    if (u && B.notebook(u).off) hide.push(g.uid);
    o.hide = hide;
    return o;
  }
  function draw() {
    var s = sheet;
    if (!s || !s.game) return;
    if (s.root.isConnected === false) { sheet = null; return; }      /* its game or overlay has gone */
    var e = env(), mine = guard(s.name), gf = gates(s.name), gc = gates(s.name, false, true), m = modeOf(s.name), week = B.weekKey(s.day);
    /* the Class chip: only for a child whose own grown-up asked for a class, and named by the label made from its code */
    var clsName = gc.ok || gc.why === 'rest' || gc.why === 'off' ? S.classLabel(mem.code) : '';
    var famOk = gf.ok && (!!listFor(gf) || e.online), clsOk = gc.ok && mem.state === 'on' && (!!listFor(gc) || e.online);
    if ((s.scope === 'family' && !famOk) || (s.scope === 'class' && !clsOk)) s.scope = 'device';
    /* net: a board from the database, the family's or (inCls) the class's */
    var inCls = s.scope === 'class', net = s.scope !== 'device', g = inCls ? gc : gf, list = net ? listFor(g) : null;
    var u = mine ? profile(s.name) : null, off = !!u && !!B.notebook(u).off;
    var cards = !net ? localCards(week, mine ? s.name : '') : !list ? [] : u ? withMine(list, g, u, week) : list.cards;
    var opts = net && list ? famOpts(g, list) : { local: true, me: mine ? s.name : '', order: m.order };
    function stand(key) { return B.standings(cards, key, s.period, week, opts); }
    /* chunk FR: the Challenge wins table instead of a game's boards */
    var isWins = s.game === WINS.id;
    /* a classic kart board only when somebody is on it in this scope and period */
    var rows = isWins ? [] : B.boards(s.game).filter(function (r) { return !r.classic || stand(r.key).count > 0; });
    if (!isWins && !rows.some(function (r) { return r.key === s.key; })) s.key = rows.length ? rows[0].key : '';
    var st = isWins ? { rows: [], count: 0 } : stand(s.key), root = s.root, game = GAMES.filter(function (x) { return x.id === s.game; })[0], keep = null;
    var wl = isWins && net && list ? winsFor(g) : null;
    var wt = wl ? B.winsTable(wl.docs, s.period, week, winsOpts(g, list, u)) : { rows: [], count: 0 };
    while (root.firstChild) root.removeChild(root.firstChild);
    function button(cls, text, go, dead) {
      var b = mk('button', cls, text);
      b.type = 'button';
      if (dead) b.disabled = true;
      b.addEventListener('click', function () { s.at = text; go(); if (sheet === s) draw(); });
      if (s.at === text) keep = b;
      return b;
    }
    function chips(label, items) {
      var d = mk('div', 'slb-chips');
      d.setAttribute('role', 'group'); d.setAttribute('aria-label', label);
      items.forEach(function (it) { d.appendChild(button('slb-chip', it.text, it.go, it.dead)).setAttribute('aria-pressed', it.on ? 'true' : 'false'); });
      root.appendChild(d);
      return d;
    }
    function line(cls, text) { if (text) root.appendChild(mk('p', cls, text)); }
    function pick(k, v) { return function () { s[k] = v; }; }
    if (s.o.host) root.appendChild(button('slb-chip', T.back, function () { shut(s); }));
    chips('Whose board', [{ text: T.device, on: !net, go: pick('scope', 'device') },
      { text: T.family, on: net && !inCls, dead: !famOk, go: function () { s.scope = 'family'; pull(s); } }]
      .concat(clsName ? [{ text: T.cls + clsName, on: inCls, dead: !clsOk, go: function () { s.scope = 'class'; pull(s); } }] : []));
    var why = famOk ? s.why : whyText(gf, e);
    line('slb-why', why);
    line('slb-why', clsName && !clsOk ? clsText(gc, e, clsName) : '');
    chips('Game', GAMES.concat([WINS]).map(function (x) {
      return { text: x.icon + ' ' + x.name, on: x.id === s.game, go: x.id === WINS.id ? function () { s.game = WINS.id; if (s.scope !== 'device') pull(s); } : pick('game', x.id) };
    }));
    if (!isWins) chips('Board', rows.map(function (r) { return { text: r.name, on: r.key === s.key, go: pick('key', r.key) }; }));
    chips('When', [{ text: T.week, on: s.period === 'week', go: pick('period', 'week') }, { text: isWins ? T.winsEver : T.ever, on: s.period === 'ever', go: pick('period', 'ever') }]);
    line('slb-why', game && u && !owns(u, game.att) ? T.notOwned : '');
    if (isWins) {
      /* chunk FR: only children with a win are listed; nobody is shown with none */
      if (wt.rows.length) {
        var wol = mk('ol', 'slb-list');
        wt.rows.forEach(function (r) { wol.appendChild(winsRowEl(r)); });
        root.appendChild(wol);
      } else line('slb-note', !net ? T.winsDevice : !list || !wl ? T.loading : s.period === 'week' ? T.winsEmptyWeek : T.winsEmptyEver);
    } else if (st.rows.length) {
      var ol = mk('ol', 'slb-list');
      st.rows.forEach(function (r, i) { ol.appendChild(rowEl(r, s.key, inCls && i >= TOP)); });
      root.appendChild(ol);
    } else line('slb-note', net && !list ? T.loading : s.period === 'week' ? T.emptyWeek : T.emptyEver);
    /* only while the removal is current: this week's board in the week it was learnt, best ever until a new value is set */
    line('slb-note', !isWins && net && u && B.removedNote(B.notebook(u), g.k, s.key, s.period, week) && !st.rows.some(function (r) { return r.me; }) ? (inCls ? T.clsRemoved : T.removed) : '');
    line('slb-note', s.note === why ? '' : s.note);
    line('slb-foot', isWins ? T.winsFoot : footLine(e));
    var links = mk('div', 'slb-chips');
    if (net) links.appendChild(button('slb-link', T.refresh, function () { s.askedAt = e.now(); if (mem.lists[g.k]) mem.lists[g.k].at = 0; if (mem.wins[g.k]) mem.wins[g.k].at = 0; pull(s); }, e.now() - s.askedAt < AGAIN_MS));
    if (mine) links.appendChild(button('slb-link', off ? T.putBack : T.takeOff, function () { setOff(s, !off); }));
    root.appendChild(links);
    if (keep && !keep.disabled) { try { keep.focus({ preventScroll: true }); } catch (x) {} }
  }
  /* the Family or the Class scope was chosen (or asked for again): post, read, then draw what came */
  function pull(s) {
    s.why = '';
    refresh(s.name, s.day, true).then(function () {
      /* chunk FR: the group's Challenge wins, read only while their table is the one shown */
      if (sheet === s && s.game === WINS.id && s.scope !== 'device') return loadWins(s.name, s.day, s.scope === 'class');
    }).then(function () {
      if (sheet !== s) return;
      var c = s.scope === 'class', g = gates(s.name, false, c);
      if (s.scope !== 'device' && !listFor(g)) { s.scope = 'device'; s.why = !g.ok ? '' : !room(s.name, s.day, 'r') ? T.resting : !c ? T.offline : mem.state === 'on' ? T.clsNet : ''; }
      draw();
    }).then(null, noop);
  }
  /* 'Take me off the boards' / 'Put me back'. With the family card within reach the marker
     (or a normal card) is written and the notebook follows, and the card in the class gets
     the same (with the family board off, a class not learnt yet in this session is learnt
     first). Out of reach, taking off still holds on this device at once and the marker is
     written at the next chance (off with d set); putting back waits for the card unless
     this profile can have none: no family card and no class card */
  function setOff(s, off) {
    var name = s.name;
    function may(g) { return g.ok || g.why === 'nocfg' || g.why === 'rest' || g.why === 'nofirebase'; }
    learn(name, true, false, s.day).then(function () {
      var g = gates(name, true), gc = gates(name, true, true), reach = (g.ok || gc.ok) && env().online;
      /* a class may still be out there while the kids record has not been read in this session */
      var none = !may(g) && !may(gc) && !(may(gates(name, true, false, true)) && !mem.checked.k);
      return (reach ? syncAll(name, s.day, off ? 'off' : 'back') : Promise.resolve(false)).then(function (ok) {
        if (ok || (!off && !none)) return ok;
        return lbCommit(name, function (lb) { lb.off = off ? 1 : 0; lb.d = 1; return lb; }).then(function () { return true; });
      });
    }).then(function (ok) {
      if (sheet !== s) return;
      /* 'Put me back' waits for room under the day's caps ('Take me off' never does) */
      s.note = !ok ? (!off && (!room(name, s.day, 'w') || !room(name, s.day, 'r')) ? T.resting : T.tryLater) : off ? T.offNow : '';
      draw();
    }).then(null, noop);
  }
  function shut(s) {
    if (sheet === s) sheet = null;
    try { if (s.ov && s.ov._close) s.ov._close(); else if (s.o.onClose) s.o.onClose(); } catch (x) {}
  }
  function open(o) {
    o = o || {};
    try {
      var root = null, ov = null, s = null;
      if (o.host) { o.host.appendChild(mk('h2', '', T.title)); root = o.host.appendChild(mk('div', 'slb')); }
      else if (typeof o.overlay === 'function') {
        ov = o.overlay('<h2>' + T.title + '</h2><div class="slb"></div>', { onClose: function () { if (sheet === s) sheet = null; } });
        root = ov.querySelector('.slb');
      }
      if (!root) return;
      css();
      /* at: the text of the button to keep the focus on (Back, when a game's menu opened the sheet) */
      s = sheet = { o: o, ov: ov, root: root, name: nameOf(o.cfg), day: '', scope: 'device', game: '', key: '', period: 'week', why: '', note: '', at: T.back, askedAt: 0 };
      root.appendChild(mk('p', 'slb-note', T.loading));
      ready().then(function () {
        if (sheet !== s) return;
        if (!S.ON.boards || modeOf(s.name).boards === 'off') return shut(s);
        guard(s.name);
        s.day = dayOf(o.day ? o : o.cfg);
        s.game = o.game && B.boards(o.game).length ? o.game : lastGame || 'course';
        s.key = s.game + ':' + String(o.variant || 'std');
        lastGame = s.game;
        if (gates(s.name).ok) { s.scope = 'family'; pull(s); }
        else if (gates(s.name, false, false, true).ok) pull(s);      /* the family board off: the class, from This device */
        draw();
      }).then(null, function () { shut(s); });
    } catch (x) {}
  }
  /* the Island games sheet gets one button; nothing is read or sent until it is pressed */
  function attach(el, o) {
    try {
      if (!el || !available() || el.querySelector('#slbOpen')) return;
      css();
      var b = mk('button', 'slw-btn slb-open', T.title), at = el.querySelector('.slw-games');
      b.type = 'button'; b.id = 'slbOpen';
      b.addEventListener('click', function () { open({ overlay: o && o.overlay, day: o && o.day }); });
      if (at && at.parentNode) at.parentNode.insertBefore(b, at); else el.appendChild(b);
    } catch (x) {}
  }
  function _env(o) {
    if (o === null) over = {};
    else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { over[k] = o[k]; });
    return env();
  }

  var API = { available: available, open: open, attach: attach, prefetch: prefetch, onResult: onResult, menuHint: menuHint, noteWin: noteWin, reset: wipe, _env: _env };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (W) {
    W.SLBoards = API;
    try { W.addEventListener('pagehide', wipe); } catch (x) {}
    ready().then(null, noop);
  }
})();
