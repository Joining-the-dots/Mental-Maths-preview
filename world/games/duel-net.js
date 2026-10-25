/* ================================================================
   Debut Run and Encore Shootout: challenge a friend, the session (no
   DOM, no browser store, no Firestore). Classic UMD: window.SLDuelNet
   in the browser, module.exports in Node.

   Up to 5 children (Debut Run) or exactly 2 (Encore Shootout) play
   the same round at the same moment, each on their own device. The
   child who opened the challenge is the hub: the others link to that
   device only, and it passes everyone's progress on. Every device
   plays its own round from the same seed, so a slow link can delay a
   comparison but never change a score (games G7).

   A room is addressed by a game word and the family's or the class's
   race key (SLDuelCore.roomId). A class room always goes through the
   relay; a family room does when the family's relay switch is on.
   There is no code room in this release (plan-ku KU14): kind 'code'
   is refused here, as it is in duel-core.

   What travels: a seat tag (8 hex digits), avatar and colour as index
   numbers, the round's seed and variant id, progress, kick results
   and scores. Never a name, a look, an outfit, a pet, or anything a
   child typed: the 4-letter word only picks the room address and is
   never sent. Each device shows nameOf(tag, seat) from its own copy
   of the roster a grown-up approved. A received value is used only if
   it is a string of at most 1,200 characters holding one known message
   with exactly its listed fields, each in range; anything else is
   dropped, and a guest that sends rubbish or floods (the 91st message
   inside 3 s) is closed. Games never award or spend anything.

     PROTO, SEATS, TRIES, KICKS, DECIDERS, MS     protocol number; seats per game; team tries; kicks; timings
     check(msg, fromHost, game)                   the message, or null
     relayFor(kind, familyRelay)                  must this room use the relay?
     transport(Net, Peer, peerOpts, {kind, relay, timers})   SLKartNet.peerTransport, relay-only as relayFor says
     places(rows)                                 places of a finished Debut Run (ties share; one row alone has none)
     create(cfg) → session                        host, join, ready, start, progress, kick, finish, rematch, prune (= recheck), leave, on
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLDuelNet) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLDuelNet;
    return;
  }

  var PROTO = 1, GAMES = ['course', 'penalty'], KINDS = ['family', 'class'], SEATS = { course: 5, penalty: 2 };
  var TRIES = 3, KICKS = 8, DECIDERS = 5, JOIN_TRIES = 3, WORD_TRIES = 5, MAX_CHARS = 1200, LOOKERS = 6;
  var MS = {
    ping: 1000, send: 500, room: 2000, roomPlay: 5000, resend: 2000, goGap: 300, grace: 300, endGap: 1000, endMax: 10000,
    weak: 4000, left: 30000, look: 20000, open: 180000, stall: 2500, redial: 1000,
    dial: 3000, dialRelay: 6000, joinGap: 3500, seat: 8000,
    readyWait: 8000, tryWait: 12000, lead: 4000, leadMin: 4500, leadMax: 6000,
    kickCap: 12000, decide: 20000, hold: 2500, after: 20000, silentCap: 90000, cap: 150000,
    archMin: 60000, kickMax: 30000, capPad: 60000
  };
  var RATE_MAX = 30, RATE_SECS = 3, QUIET_MS = 2000, OWED_PER_S = 12;
  var KEY_RE = /^[0-9a-f]{32}$/;

  function noop() {}
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fin(n) { return typeof n === 'number' && isFinite(n); }
  function isInt(n) { return fin(n) && Math.floor(n) === n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- message checking ---------- */
  function num(lo, hi) { return function (x) { return fin(x) && x >= lo && x <= hi; }; }
  function int(lo, hi) { return function (x) { return isInt(x) && x >= lo && x <= hi; }; }
  function re(r) { return function (x) { return typeof x === 'string' && r.test(x); }; }
  function oneOf(list) { return function (x) { return typeof x === 'string' && list.indexOf(x) >= 0; }; }
  function bool(x) { return x === true || x === false; }
  function opt(f) { return function (x) { return x === undefined || f(x); }; }
  function orNull(f) { return function (x) { return x === null || f(x); }; }
  function listOf(max, f) {
    return function (a) {
      if (!Array.isArray(a) || a.length > max) return false;
      for (var i = 0; i < a.length; i++) if (!f(a[i])) return false;
      return true;
    };
  }
  function tuple(fs) {
    return function (a) {
      if (!Array.isArray(a) || a.length !== fs.length) return false;
      for (var i = 0; i < fs.length; i++) if (!fs[i](a[i])) return false;
      return true;
    };
  }
  /* exactly these fields and no others: a message with a name, or anything extra, fails */
  function shape(spec) {
    return function (o) {
      if (!isObj(o)) return false;
      var keys = Object.keys(o), i;
      for (i = 0; i < keys.length; i++) if (!has(spec, keys[i])) return false;
      for (var k in spec) if (has(spec, k) && !spec[k](has(o, k) ? o[k] : undefined)) return false;
      return true;
    };
  }
  var vT = function (x) { return typeof x === 'string'; };
  var vTag = re(/^[0-9a-f]{8}$/), vHex16 = re(/^[0-9a-f]{16}$/), vVar = re(/^[a-z][a-z0-9_]{0,39}$/), vGame = oneOf(GAMES);
  var vSeat = int(0, 4), vAi = int(0, 23), vCi = int(0, 7), vR = int(1, 1e6), vQ = int(0, 1e9), vVer = int(0, 1e6), vClock = num(-1e15, 1e15);
  var vSec = int(0, 5), vProg = int(0, 1000), vScore = int(0, 5000), vK = int(0, KICKS + DECIDERS - 1), vRes = oneOf(['goal', 'save', 'miss']);
  var vPts = function (x) { return isInt(x) && x >= 0 && x <= 150 && x % 10 === 0; };
  var vExtra = int(0, 0x7fffffff), vTries = int(0, TRIES), vSeed = int(1, 4294967295), vPlace = int(1, 5);
  /* a show's state; a row's adds 'weak' (its device silent for 4 s) and 'left' (gone for 30 s, or said bye) */
  var RUN = ['run', 'pause', 'bow', 'arch', 'done'], ROW = RUN.concat(['weak', 'left']), FINAL = ['bow', 'arch', 'left'];
  var vEndRow = tuple([vSeat, orNull(vScore), orNull(vExtra), oneOf(ROW), orNull(vPlace)]);
  var endShape = shape({ t: vT, why: oneOf(['done', 'tie', 'closed']), r: opt(vR), rows: opt(listOf(5, vEndRow)) });
  /* 'end' of a round carries its number and table; 'end' alone (the room closed) carries neither */
  function vEnd(o) { return endShape(o) && (o.r === undefined) === (o.rows === undefined) && (o.r !== undefined || o.why === 'closed'); }
  var FROM_GUEST = {
    hello: shape({ t: vT, v: vVer, rules: vVer, game: vGame }),
    join: shape({ t: vT, tag: vTag, ai: vAi, ci: vCi, tok: opt(vHex16) }),
    p: shape({ t: vT, c: vClock, rt: opt(num(0, 60000)) }),
    rdy: shape({ t: vT, built: bool }),
    s: shape({ t: vT, r: vR, q: vQ, sec: vSec, prog: vProg, score: vScore, st: oneOf(RUN) }),
    w: shape({ t: vT, r: vR, k: vK }),
    k: shape({ t: vT, r: vR, k: vK, res: vRes, pts: vPts }),
    f: shape({ t: vT, r: vR, score: vScore, extra: vExtra, st: oneOf(['bow', 'arch', 'done']) }),
    back: shape({ t: vT }),
    bye: shape({ t: vT })
  };
  var FROM_HOST = {
    info: shape({ t: vT, v: vVer, rules: vVer, game: vGame, tag: vTag, ai: vAi, ci: vCi, used: int(1, 5), state: oneOf(['lobby', 'playing', 'full']), variant: vVar, r: vHex16, h: vHex16 }),
    no: shape({ t: vT, why: oneOf(['full', 'version', 'closed']) }),
    seat: shape({ t: vT, seat: int(1, 4), tok: vHex16 }),
    room: shape({ t: vT, q: vQ, state: oneOf(['lobby', 'playing', 'results']), variant: vVar,
      players: listOf(5, shape({ seat: vSeat, tag: vTag, ai: vAi, ci: vCi, st: oneOf(['lobby', 'playing', 'results', 'weak']), rdy: bool })) }),
    q: shape({ t: vT, c: vClock, h: vClock }),
    go: shape({ t: vT, r: vR, seed: vSeed, variant: vVar, goAt: vClock, tries: vTries, players: listOf(5, tuple([vSeat, vTag, vAi, vCi])) }),
    open: shape({ t: vT, r: vR, k: vK }),
    rv: shape({ t: vT, r: vR, k: vK, rows: listOf(2, tuple([vSeat, vRes, vPts])) }),
    dec: shape({ t: vT, r: vR, n: int(1, DECIDERS), tries: vTries }),
    rel: shape({ t: vT, r: vR, rows: listOf(5, tuple([vSeat, vSec, vProg, vScore, oneOf(ROW)])) }),
    end: vEnd
  };
  var ONLY = { s: 'course', rel: 'course', w: 'penalty', k: 'penalty', open: 'penalty', rv: 'penalty', dec: 'penalty' };
  /* a score the boards could hold: Debut Run 0-5,000; Encore Shootout 0-1,200 in steps of 10 */
  function okScore(game, n) { return game === 'penalty' ? isInt(n) && n >= 0 && n <= 1200 && n % 10 === 0 : isInt(n) && n >= 0 && n <= 5000; }
  /* The message itself when this side may receive it and every field is the right type and in
     range; otherwise null. With game, a message of the other game, a score the game cannot
     make, a goal worth nothing or a miss worth something, and a Shootout table of more than two,
     are refused too. Never throws. */
  function check(msg, fromHost, game) {
    try {
      if (!isObj(msg) || typeof msg.t !== 'string') return null;
      var table = fromHost ? FROM_HOST : FROM_GUEST, t = msg.t, i;
      if (!has(table, t) || !table[t](msg)) return null;
      if (game === undefined) return msg;
      if (GAMES.indexOf(game) < 0 || (has(ONLY, t) && ONLY[t] !== game)) return null;
      if (t === 'hello' || t === 'info') { if (msg.game !== game) return null; }
      if (t === 'f' && (!okScore(game, msg.score) || (game === 'course') !== (msg.st !== 'done'))) return null;
      if (t === 'k' && (msg.res === 'goal') !== (msg.pts > 0)) return null;
      if (t === 'rv') for (i = 0; i < msg.rows.length; i++) if ((msg.rows[i][1] === 'goal') !== (msg.rows[i][2] > 0)) return null;
      if (t === 'end' && msg.rows) for (i = 0; i < msg.rows.length; i++) if (msg.rows[i][1] !== null && !okScore(game, msg.rows[i][1])) return null;
      if (game === 'penalty' && ((t === 'room' || t === 'go' || t === 'end') && (msg.players || msg.rows || []).length > SEATS.penalty)) return null;
      return msg;
    } catch (e) { return null; }
  }
  /* what came down a link: a string of at most 1,200 characters holding one JSON object, or null */
  function parse(data) {
    if (typeof data !== 'string' || data.length > MAX_CHARS) return null;
    try { var o = JSON.parse(data); return isObj(o) ? o : null; } catch (e) { return null; }
  }

  /* ---------- relay and the link ---------- */
  /* A class room always uses the relay (its devices are in many homes); a family room only
     when the grown-up switched on 'some of these devices are in other homes' (D42). */
  function relayFor(kind, familyRelay) { return kind !== 'family' || familyRelay === true; }
  function transport(Net, Peer, peerOpts, o) {
    var x = isObj(o) ? o : {};
    return Net.peerTransport(Peer, peerOpts, { relayOnly: relayFor(x.kind, x.relay), timers: x.timers });
  }

  /* ---------- places ---------- */
  /* rows: [{seat, score}] that can be compared (finished, with a score the board could hold).
     Higher is better and equal scores share a place (1, 2, 2, 4). Every round is ranked
     (James, 24 Oct 2026: 1st, 2nd, 3rd; the results word the last place kindly, SLDuelCore);
     one row alone has no place (nobody to compare with). Returns {seat: place or null}. */
  function places(rows) {
    var out = {}, i;
    var list = (Array.isArray(rows) ? rows : []).filter(function (r) { return isObj(r) && isInt(r.score); })
      .sort(function (a, b) { return b.score - a.score || a.seat - b.seat; });
    if (list.length < 2) { list.forEach(function (r) { out[r.seat] = null; }); return out; }
    for (i = 0; i < list.length; i++) out[list[i].seat] = i && list[i].score === list[i - 1].score ? out[list[i - 1].seat] : i + 1;
    return out;
  }

  function coreOf(c) {
    if (c.core) return c.core;
    if (typeof window !== 'undefined' && window.SLDuelCore) return window.SLDuelCore;
    if (typeof module === 'object' && typeof require === 'function') { try { return require('./duel-core.js'); } catch (e) {} }
    return null;
  }
  function netOf(c) {
    if (c.Net) return c.Net;
    if (typeof window !== 'undefined' && window.SLKartNet) return window.SLKartNet;
    if (typeof module === 'object' && typeof require === 'function') { try { return require('./kart-net.js'); } catch (e) {} }
    return null;
  }

  /* ---------- the session ---------- */
  /* cfg = {game: 'course' | 'penalty', kind: 'family' | 'class', raceKey (the group's race key,
     32 hex), tags (SLSocialCore.tagMap of the group's roster; read at each join, so the lobby
     may replace it), relay (the family's relay switch), transport (SLKartNet.peerTransport, or
     the same shape: open, listen, dial, close, relayOnly), clock: {now()}, timers: {setTimeout,
     clearTimeout, setInterval, clearInterval}, me: {tag, ai, ci} (nothing else of it is read),
     nameOf(tag, seat) → string, tickets: {open(0, r), prove(h), checkHost(tag, 0, r),
     checkJoiner(tag, h), close()} each returning a Promise, or function(roomText) returning
     them (the room text is SLDuelCore.roomText of the word the room ends up with), rules (the
     game's COURSE_RULES / PENALTY_RULES), SC (SLSocialCore), getRandomValues (optional),
     core (optional: SLDuelCore), Net (optional: SLKartNet), archMs (optional: the earliest a
     Debut Run show can reach the arch after GO, 0 to 60,000 ms; 60 s when not given, as the
     arch is 68.4 s into the song; an earlier 'arch' counts as a curtain call)}.
     Seats are 0 to 4; seat 0 is the host. session.state is 'idle', 'opening', 'joining',
     'lobby', 'starting', 'playing', 'results', 'detached' (a host whose screen has gone, still
     passing messages on until the round ends) or 'closed'; session.room and session.go hold what
     the last 'room' and 'go' events carried; session.word is the room's word.
     Events (session.on): 'room' {state, variant, seat, host, open, players: [{seat, tag, name,
     ai, ci, st, rdy, weak, me}]}; 'ready' {all, some, waiting: [names]}; 'go' {r, seed,
     variant, goAt (my clock, ms; never in the past), late, tries, seat, players}; 'rel' {rows:
     [{seat, name, sec, prog, score, st, weak, me}]} (Debut Run); 'open' {k} (Shootout: kick k
     may start here now); 'rv' {k, rows: [{seat, name, res, pts, me}]}; 'dec' {n, tries,
     retake}; 'end' {rows: [{seat, name, score, extra, st, place, me}], why, outcome: {top,
     shared, deciders, tries, why}, teamTry} (a Shootout row also has dec, its decider goals);
     'sitout' {why: 'late'}; 'weak' {seat, on}; 'left' {seat};
     'closed' {why}. */
  function create(cfg) {
    var c = isObj(cfg) ? cfg : {};
    var game = c.game, kind = c.kind, tr = c.transport, clock = c.clock, tm = c.timers, SC = c.SC, core = coreOf(c), Net = netOf(c);
    if (GAMES.indexOf(game) < 0) throw new Error('SLDuelNet: the game is course or penalty');
    if (KINDS.indexOf(kind) < 0) throw new Error('SLDuelNet: only family and class rooms are built; ' + String(kind) + ' is refused');
    if (!tr || !clock || !tm || !SC || typeof SC.newNonce !== 'function') throw new Error('SLDuelNet: transport, clock, timers and SC are needed');
    if (!core || typeof core.roomId !== 'function' || typeof core.roomText !== 'function' || typeof core.isWord !== 'function' || !Array.isArray(core.WORDS)) throw new Error('SLDuelNet: SLDuelCore is needed');
    if (!Net || typeof Net.ClockDiff !== 'function') throw new Error('SLDuelNet: SLKartNet is needed');
    if (typeof c.raceKey !== 'string' || !KEY_RE.test(c.raceKey)) throw new Error('SLDuelNet: the group\'s race key is needed');
    if (!vVer(c.rules)) throw new Error('SLDuelNet: the game\'s rules number is needed');
    if (relayFor(kind, c.relay) && tr.relayOnly !== true) throw new Error('SLDuelNet: this room must use the relay');
    var who = isObj(c.me) ? c.me : {};
    var me = { tag: vTag(who.tag) ? who.tag : '', ai: vAi(who.ai) ? who.ai : 0, ci: vCi(who.ci) ? who.ci : 0 };
    if (!me.tag) throw new Error('SLDuelNet: this child\'s seat tag is needed');
    var rand = typeof c.getRandomValues === 'function' ? c.getRandomValues
      : typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function' ? function (a) { return crypto.getRandomValues(a); } : null;
    var GUESTS = SEATS[game] - 1, course = game === 'course', dialMs = tr.relayOnly === true ? MS.dialRelay : MS.dial;
    var archMin = isInt(c.archMs) && c.archMs >= 0 && c.archMs <= MS.archMin ? c.archMs : MS.archMin;   /* the earliest arch after GO */
    var on = {}, ivals = [], dead = false, role = null, tk = null, variant = '', word = '', lastGo = 0;
    var H = null, G = null, V = null, seen = null, roomSig = '', readySig = '';   /* the hub; the guest; the round as this device shows it */
    var ses = { state: 'idle', role: null, seat: -1, word: '', room: null, go: null };

    function now() { return clock.now(); }
    function emit(name, a) { var l = (on[name] || []).slice(), i; for (i = 0; i < l.length; i++) { try { l[i](a); } catch (e) {} } }
    function later(fn, ms) { return tm.setTimeout(function () { if (!dead) fn(); }, ms); }
    function every(fn, ms) { var id = tm.setInterval(function () { if (!dead) fn(); }, ms); ivals.push(id); return id; }
    function ask(name, a, b, d) { try { return Promise.resolve(tk[name](a, b, d)); } catch (e) { return Promise.reject(e); } }
    function bind(text) { var t = null; try { t = typeof c.tickets === 'function' ? c.tickets(text) : c.tickets; } catch (e) { t = null; } tk = isObj(t) ? t : {}; }
    function nonce() { return SC.newNonce(rand); }
    function bytes(n) { var a = new Uint8Array(n); rand(a); return a; }
    /* a fresh word for a room (none of the words already tried: a word or a list), every word equally likely */
    function drawWord(not) {
      var nots = [].concat(not), list = core.WORDS.filter(function (w) { return nots.indexOf(w) < 0; }), b, i;
      if (!list.length) list = core.WORDS.slice();
      for (i = 0; i < 64; i++) { b = bytes(1)[0]; if (b < 256 - 256 % list.length) return list[b % list.length]; }
      return list[0];
    }
    function newSeed() { var b = bytes(4), s = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0; return s || 1; }
    /* the name this device shows for a seat: from its own roster, never from the wire */
    function nm(tag, seat) {
      var n = '';
      try { n = c.nameOf(tag, seat); } catch (e) { n = ''; }
      return typeof n === 'string' && n && n.length <= 24 ? n : 'Player ' + (seat + 1);
    }

    /* ---------- links ---------- */
    /* strict (the hub's side): rubbish, a non-string, an over-long string, or the 91st message
       inside 3 s closes the link. A link silent for 2 s or more is owed what a guest sends
       meanwhile (12 a second of the silence, 30 s at most), so a backlog that a stalled network
       or the hub's own sleep delivers at once is not counted. A guest just drops what fails.
       init(L) sets L up (onMsg, onGone, where it is kept) BEFORE the link is listened to: the
       transport hands over what it held for the link, and tells of a link already closed, the
       moment it is listened to (a relay room's hub checks the relay 0.3 s more while the
       guest's hello is already waiting). */
    function wire(link, fromHost, strict, init) {
      var L = { link: link, open: true, deaf: false, onMsg: null, onGone: null, seat: null, looker: false, times: [], lastAt: now(), owed: 0 };
      if (init) init(L);
      link.onMessage(function (data) {
        if (!L.open || L.deaf || dead) return;
        var t = now(), o = parse(data), m;
        if (strict && o) {
          if (t - L.lastAt >= QUIET_MS) L.owed = Math.floor(Math.min(t - L.lastAt, MS.left) / 1000 * OWED_PER_S);
          L.lastAt = t;
        }
        if (strict && o && L.owed > 0) L.owed--;
        else if (strict && (!o || (L.times.push(t) > RATE_MAX * RATE_SECS && t - L.times.shift() < RATE_SECS * 1000))) { kill(L); return; }
        m = o && check(o, fromHost, game);
        if (m && L.onMsg) L.onMsg(m, L);
      });
      link.onClose(function () { if (L.open) { L.open = false; if (!dead && L.onGone) L.onGone(L); } });
      return L;
    }
    function send(L, msg) { if (L && L.open) { try { L.link.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) {} } }
    function shut(L) { if (L && L.open) { L.open = false; try { L.link.close(); } catch (e) {} } }
    function kill(L) { var g = L.onGone; shut(L); if (g) g(L); }
    /* stop listening now; close once what was just sent has had time to leave */
    function drop(L) { if (L && L.open && !L.deaf) { L.deaf = true; tm.setTimeout(function () { shut(L); }, MS.grace); } }

    /* ---------- what every device shows ---------- */
    function showRoom(m) {
      var mineSeat = ses.seat, next = {}, wait = [], any = false, some = false, sig;
      m.players.forEach(function (p) {
        var weak = p.st === 'weak', was = seen && seen[p.tag];
        next[p.tag] = { seat: p.seat, weak: weak };
        if (p.seat !== mineSeat && was && was.weak !== weak) emit('weak', { seat: p.seat, on: weak });
        if (m.state === 'lobby' && p.seat && (p.st === 'lobby' || weak)) { any = true; if (p.rdy) some = true; else wait.push(nm(p.tag, p.seat)); }
      });
      if (seen) Object.keys(seen).forEach(function (tag) { if (!has(next, tag) && tag !== me.tag) emit('left', { seat: seen[tag].seat }); });
      seen = next;
      var view = { state: m.state, variant: m.variant, seat: mineSeat, host: role === 'host', open: role === 'host' && joinable(),
        players: m.players.map(function (p) { return { seat: p.seat, tag: p.tag, name: nm(p.tag, p.seat), ai: p.ai, ci: p.ci, st: p.st, rdy: p.rdy, weak: p.st === 'weak', me: p.seat === mineSeat }; }) };
      sig = JSON.stringify(view);
      if (sig !== roomSig) { roomSig = sig; ses.room = view; emit('room', view); }
      sig = JSON.stringify([any && !wait.length, some, wait]);
      if (sig !== readySig) { readySig = sig; emit('ready', { all: any && !wait.length, some: some, waiting: wait }); }
    }
    function weakSeat(seat) { var p; for (p in seen || {}) if (has(seen, p) && seen[p].seat === seat) return seen[p].weak; return false; }
    function applyGo(m, at) {
      var t = now();
      if (m.r <= lastGo) return;
      lastGo = m.r;
      V = { r: m.r, seed: m.seed, variant: m.variant, tries: m.tries, players: m.players.map(function (p) { return { seat: p[0], tag: p[1], ai: p[2], ci: p[3] }; }),
        rows: {}, openK: -1, myK: -1, myAt: 0, opened: {}, rv: {}, decN: 0, ended: false, fin: null, mine: {}, park: null, myFin: false, backSent: false, sAt: -Infinity, lastSt: '', q: 0, teamTry: false };
      V.players.forEach(function (p) { V.rows[p.seat] = [p.seat, 0, 0, 0, 'run']; });
      if (ses.state !== 'detached') ses.state = 'playing';
      ses.go = { r: m.r, seed: m.seed, variant: m.variant, goAt: Math.max(at, t), late: at < t, tries: m.tries, seat: ses.seat,
        players: V.players.map(function (p) { return { seat: p.seat, tag: p.tag, name: nm(p.tag, p.seat), ai: p.ai, ci: p.ci, me: p.seat === ses.seat }; }) };
      emit('go', ses.go);
    }
    /* links may overtake each other: a row never goes back along the song, and an ended show stays ended */
    function applyRel(m) {
      if (!V || m.r !== V.r || V.ended) return;
      m.rows.forEach(function (w) {
        var o = V.rows[w[0]];
        if (o && !(FINAL.indexOf(o[4]) >= 0 && FINAL.indexOf(w[4]) < 0)) V.rows[w[0]] = [w[0], Math.max(o[1], w[1]), Math.max(o[2], w[2]), Math.max(o[3], w[3]), w[4]];
      });
      emit('rel', { rows: V.players.map(function (p) {
        var w = V.rows[p.seat];
        return { seat: p.seat, name: nm(p.tag, p.seat), sec: w[1], prog: w[2], score: w[3], st: w[4], weak: w[4] === 'weak' || (p.seat !== ses.seat && weakSeat(p.seat)), me: p.seat === ses.seat };
      }) });
    }
    /* 'open' fires once per kick, when the host has opened it AND this device is waiting at it */
    function maybeOpen() {
      if (!V || V.ended || V.myK < 0 || V.opened[V.myK] || V.myK > V.openK) return;
      V.opened[V.myK] = true;
      emit('open', { k: V.myK });
    }
    function applyOpen(m) { if (!V || m.r !== V.r) return; V.openK = Math.max(V.openK, m.k); maybeOpen(); }
    function tagOf(seat) { for (var i = 0; V && i < V.players.length; i++) if (V.players[i].seat === seat) return V.players[i].tag; return ''; }
    function applyRv(m) {
      if (!V || m.r !== V.r || V.rv[m.k]) return;
      V.rv[m.k] = m.rows;
      emit('rv', { k: m.k, rows: m.rows.map(function (w) { return { seat: w[0], name: nm(tagOf(w[0]), w[0]), res: w[1], pts: w[2], me: w[0] === ses.seat }; }) });
      unpark(false);
    }
    /* A Shootout decision ('dec' n, or 'end') can overtake the reveals it follows: a guest holds
       it until they are in (asking for them again), for 2.5 s at most, so the pips, the decider
       goals and the retake flag are right on every device. The host's own come in order. */
    function due(m) { return m.t === 'dec' ? !!V.rv[KICKS - 2 + m.n] : Object.keys(V.mine).every(function (k) { return !!V.rv[k]; }); }
    function hold(m, force) {
      if (force || !G || course || due(m)) return false;
      if (V.park && V.park.m.t === m.t && (m.t !== 'dec' || V.park.m.n === m.n)) return true;    /* a copy of the one held */
      if (V.park) unpark(true);                                                                   /* a later decision: the held one first */
      if (V.ended) return true;
      V.park = { m: m, at: now() };
      resend();
      return true;
    }
    function unpark(force) {
      var p = V && V.park;
      if (!p || (force !== true && !due(p.m))) return;
      V.park = null;
      if (p.m.t === 'dec') applyDec(p.m, true); else applyEnd(p.m, true);
    }
    function applyDec(m, force) {
      if (!V || m.r !== V.r || V.ended || m.n <= V.decN || hold(m, force)) return;
      var lead = V.rv[KICKS - 2 + m.n];       /* the decider before: both missed → this is the retake */
      var retake = m.n > 1 && (lead && lead.length > 1 ? lead.every(function (w) { return w[1] !== 'goal'; }) : m.tries < V.tries);
      V.decN = m.n; V.tries = m.tries;
      emit('dec', { n: m.n, tries: m.tries, retake: retake });
    }
    /* the Shootout's decider goals of a seat, from the reveals (rows as SLDuelCore.standings takes them) */
    function decGoals(seat) {
      var n = 0, k, i, rs;
      for (k = KICKS; k < KICKS + DECIDERS; k++) { rs = V.rv[k]; if (rs) for (i = 0; i < rs.length; i++) if (rs[i][0] === seat && rs[i][1] === 'goal') n++; }
      return n;
    }
    /* Why the Shootout ended as it did (SLDuelCore.line words a shared top spot after the team
       tries ran out as 'both keepers did brilliantly'): 'goals', 'deciders', 'tries', 'cap',
       'level' (deciders were not possible), or 'stall' (no head to head) */
    function shootWhy(top) {
      var last = V.rv[KICKS - 1 + V.decN], miss = !!last && last.length > 1 && last.every(function (w) { return w[1] !== 'goal'; });
      if (top.length === 1) return V.decN ? 'deciders' : 'goals';
      if (!top.length) return 'stall';
      return !V.decN ? 'level' : miss && !V.tries ? 'tries' : V.decN >= DECIDERS ? 'cap' : 'stall';
    }
    function applyEnd(m, force) {
      if (!V || m.r !== V.r || V.ended || hold(m, force)) return;
      var rows, top = [], live = [];
      V.ended = true; V.park = null; V.fin = null;
      rows = m.rows.map(function (w) {
        if (w[4] === 1) top.push(w[0]);
        if (w[3] !== 'left') live.push(w[3]);
        var row = { seat: w[0], name: nm(tagOf(w[0]), w[0]), score: w[1], extra: w[2], st: w[3], place: w[4], me: w[0] === ses.seat };
        if (!course) row.dec = decGoals(w[0]);
        return row;
      });
      /* every show still in it ended in a curtain call before the arch, and a team try is left */
      V.teamTry = course && m.why !== 'closed' && V.tries > 0 && live.length > 0 && live.every(function (st) { return st === 'bow'; });
      if (ses.state !== 'detached') ses.state = 'results';
      emit('end', { rows: rows, why: m.why, outcome: { top: top, shared: top.length > 1, deciders: V.decN, tries: V.tries, why: course ? null : shootWhy(top) },
        teamTry: V.teamTry });
      maybeBack();
      if (G && G.closing) closed();
    }
    /* a guest that has its own results on screen tells the host it is back (ready for a rematch) */
    function maybeBack() { if (G && V && V.ended && V.myFin && !V.backSent && ses.seat > 0) { V.backSent = true; send(G.L, { t: 'back' }); } }

    /* ---------- the hub ---------- */
    function seated() { var out = [], i; for (i = 1; i <= GUESTS; i++) if (H.seats[i]) out.push(H.seats[i]); return out; }
    function everyone() { return [H.me].concat(seated()); }
    function seatOf(tag) { var a = seated(), i; for (i = 0; i < a.length; i++) if (a[i].tag === tag) return a[i]; return null; }
    function cast(msg) { var text = typeof msg === 'string' ? msg : JSON.stringify(msg), a = seated(), i; for (i = 0; i < a.length; i++) send(a[i].L, text); }
    function joinable() { return !!H && H.open && !H.started && !H.detached && ses.state === 'lobby' && now() < H.openUntil; }
    function room() {
      if (!H || dead) return;
      var st = ses.state, msg = { t: 'room', q: ++H.rq, state: st === 'playing' || st === 'detached' ? 'playing' : st === 'results' ? 'results' : 'lobby', variant: variant,
        players: everyone().map(function (s) { return { seat: s.seat, tag: s.tag, ai: s.ai, ci: s.ci, st: s.weak ? 'weak' : s.st, rdy: s.rdy }; }) };
      H.roomAt = now();
      cast(msg); showRoom(msg);
    }
    function onCaller(link) {
      if (!H || dead) { try { link.close(); } catch (e) {} return; }
      var L = wire(link, false, true, function (x) {
        x.looker = true; x.over = ++H.lookers > LOOKERS;
        x.onMsg = hostMsg; x.onGone = hostGone;
        H.links.push(x);
      });
      tm.setTimeout(function () { if (L.looker && L.open) kill(L); }, MS.look);
    }
    function hostGone(L) {
      if (L.looker) { L.looker = false; H.lookers--; }
      if (L.seat && L.seat.L === L) L.seat.L = null;     /* the seat waits 30 s for a rejoin with its token */
    }
    function bye(L) { hostGone(L); drop(L); }
    function refuse(L, why) { send(L, { t: 'no', why: why }); bye(L); }
    function hello(m, L) {
      if (!H.open) { L.wait = m; return; }               /* the ticket is not written yet: answer when it is */
      if (m.v !== PROTO || m.rules !== c.rules || m.game !== game) return refuse(L, 'version');
      var used = seated().length + 1, full = L.over || used > GUESTS;
      L.h = nonce();
      /* 'playing': the challenge has started (or its 3 minutes are up), so there is no seat to take */
      send(L, { t: 'info', v: PROTO, rules: c.rules, game: game, tag: me.tag, ai: me.ai, ci: me.ci, used: used,
        state: full ? 'full' : joinable() ? 'lobby' : 'playing', variant: variant, r: H.r, h: L.h });
      if (full) refuse(L, 'full');
    }
    function sit(s, L) {
      if (L.looker) { L.looker = false; H.lookers--; }
      s.L = L; L.seat = s; s.heard = now(); s.weak = false;
      send(L, { t: 'seat', seat: s.seat, tok: s.tok });
      room();
      /* back with its token while its round is on: the GO, or the end, it may have missed; an end
         comes after every reveal of the round, so its decider goals are the host's own */
      if (H.round && inRound(s.seat) && H.round.ended) Object.keys(H.round.rv).forEach(function (k) { send(L, H.round.rv[k]); });
      if (H.round && inRound(s.seat)) send(L, H.round.ended ? H.endMsg : H.goMsg);
    }
    function joinReq(m, L) {
      var tags = isObj(c.tags) ? c.tags : {}, s, i, h = L.h;
      if (L.seat || L.asking) return;
      if (m.tok) {                                       /* back into the same seat: the token stands in for the ticket, */
        s = seatOf(m.tag);                               /* but only for a child still in the roster the lobby holds now */
        if (!s || s.tok !== m.tok) return refuse(L, 'closed');
        if (!has(tags, m.tag)) { refuse(L, 'closed'); freeSeat(s, false); return; }   /* and that child's seat goes */
        if (s.L && s.L !== L) { s.L.seat = null; bye(s.L); }
        return sit(s, L);
      }
      if (!joinable() || !h || !has(tags, m.tag) || m.tag === me.tag || seatOf(m.tag)) return refuse(L, 'closed');
      if (seated().length >= GUESTS) return refuse(L, 'full');
      L.asking = true; L.h = '';                         /* the number is good for one try */
      ask('checkJoiner', m.tag, h).then(function (ok) { return ok === true; }, function () { return false; }).then(function (ok) {
        L.asking = false;
        if (dead || !H || !L.open || L.deaf) return;
        if (!ok || seatOf(m.tag) || !joinable()) return refuse(L, 'closed');
        for (i = 1; i <= GUESTS && H.seats[i]; i++) {}
        if (i > GUESTS) return refuse(L, 'full');
        s = H.seats[i] = { seat: i, tag: m.tag, ai: m.ai, ci: m.ci, tok: nonce(), L: null, st: 'lobby', rdy: false, back: true, rt: 0, q: -1, heard: now(), weak: false };
        sit(s, L);
      });
    }
    function freeSeat(s, tell) {
      H.seats[s.seat] = null;
      if (s.L) { if (tell) send(s.L, { t: 'no', why: 'closed' }); s.L.seat = null; bye(s.L); }
      if (inRound(s.seat)) gone(s.seat);
      room(); tryGo();
    }
    /* every seat whose child has left the roster the lobby holds now (c.tags: a grown-up
       unticked them, or the lobby read the roster again) is freed and told {no: closed}; in a
       round that child has left it (a Shootout ends with no top spot). How many were. */
    function prune() {
      var tags = isObj(c.tags) ? c.tags : {}, n = 0;
      if (!H || dead) return 0;
      seated().forEach(function (s) { if (!has(tags, s.tag) && H.seats[s.seat] === s) { n++; freeSeat(s, true); } });
      return n;
    }
    function hostMsg(m, L) {
      var s = L.seat, t = m.t, R = H.round, mine;
      if (t === 'hello') return hello(m, L);
      if (t === 'join') return joinReq(m, L);
      if (!s) return;                                    /* everything else needs a seat */
      s.heard = now();
      if (s.weak) { s.weak = false; room(); }
      mine = !!R && m.r === R.r && inRound(s.seat) && !R.gone[s.seat];
      if (t === 'p') { if (fin(m.rt)) s.rt = m.rt; send(L, { t: 'q', c: m.c, h: now() }); }
      else if (t === 'rdy') { if (s.st === 'lobby' && s.rdy !== m.built) { s.rdy = m.built; room(); tryGo(); } }
      else if (t === 's') { if (mine && !R.ended && m.q > s.q) { s.q = m.q; note(s.seat, m); } }
      else if (t === 'w') { if (mine) atKick(s.seat, m.k); }
      else if (t === 'k') { if (mine) gotKick(s.seat, m.k, m.res, m.pts); }
      else if (t === 'f') { if (mine) { if (R.ended) send(L, H.endMsg); else gotFin(s.seat, m.score, m.extra, m.st); } }
      else if (t === 'back') { if (s.st === 'results' && !s.back) { s.st = ses.state === 'results' ? 'results' : 'lobby'; s.back = true; s.rdy = false; room(); tryGo(); } }   /* once a round: a guest says it again after a drop */
      else if (t === 'bye') freeSeat(s, false);
    }
    /* once a second: weak and left seats, the room list, the time rules of the round. A tick more
       than 2.5 s late means this device itself was asleep: nobody's silence counts on that tick. */
    function hostTick() {
      var t = now(), slept = t - H.tickAt > MS.stall, changed = false, i, s, quiet;
      H.tickAt = t;
      for (i = 1; i <= GUESTS; i++) {
        s = H.seats[i];
        if (!s) continue;
        if (slept) { s.heard = Math.max(s.heard, t); continue; }
        quiet = t - s.heard;
        if (quiet > MS.left) { freeSeat(s, true); continue; }
        if ((quiet > MS.weak) !== s.weak) { s.weak = !s.weak; changed = true; }
      }
      if (!H.started && ses.state === 'lobby' && !seated().length && t >= H.openUntil) return closeRoom('alone');
      if (H.round && !H.round.ended) { if (course) courseCheck(); else decideNext(); }
      if (!dead && (changed || t - H.roomAt >= (ses.state === 'playing' || ses.state === 'detached' ? MS.roomPlay : MS.room))) room();
      H.links = H.links.filter(function (L) { return L.open; });
    }
    function inRound(seat) { return !!H && !!H.round && has(H.round.rows, seat); }
    function present() { var R = H.round; return R.players.map(function (p) { return p.seat; }).filter(function (q) { return !R.gone[q]; }); }
    function gone(seat) {
      var R = H.round;
      if (!R || R.ended || R.gone[seat]) return;
      R.gone[seat] = true; R.rows[seat].at = now();
      if (course) courseCheck(); else settle();
    }

    /* ---------- starting a round ---------- */
    function lobbyGuests() { return seated().filter(function (s) { return s.st === 'lobby'; }); }
    function tryGo() { if (H && ses.state === 'starting' && H.me.rdy && lobbyGuests().every(function (s) { return s.rdy; }) && lobbyGuests().length) fire(); }
    /* GO is 4.5 to 6 s ahead on the hub's clock: 4 s plus twice the slowest round trip. A friend
       not ready by then, or whose link is down just then, sits this round out and is in the next */
    function fire() {
      if (!H || ses.state !== 'starting') return;
      var kids = lobbyGuests().filter(function (s) { return s.rdy && !!s.L && s.L.open; }), rt = 0, used = {}, at, go;
      tm.clearTimeout(H.goT);
      if (!H.me.rdy) { H.goT = later(fire, 1000); return; }   /* this device's own round is not built yet */
      if (!kids.length) { ses.state = 'lobby'; H.retry = false; room(); return; }
      kids.forEach(function (s) { rt = Math.max(rt, s.rt); s.st = 'playing'; s.q = -1; s.back = false; });
      H.me.st = 'playing';
      at = now() + clamp(MS.lead + 2 * rt, MS.leadMin, MS.leadMax);
      go = { t: 'go', r: ++H.rn, seed: H.retry && H.round ? H.round.seed : newSeed(), variant: variant, goAt: at, tries: H.tries,
        players: [H.me].concat(kids).map(function (s) {      /* two children with one colour: the later seat takes the next free one, this round only */
          var ci = s.ci;
          while (used[ci]) ci = (ci + 1) % 8;
          used[ci] = true;
          return [s.seat, s.tag, s.ai, ci];
        }) };
      H.retry = false;
      H.goMsg = JSON.stringify(go);
      cast(H.goMsg); later(function () { cast(H.goMsg); }, MS.goGap); later(function () { cast(H.goMsg); }, 2 * MS.goGap);   /* a device acts on the first copy only */
      H.round = { r: go.r, seed: go.seed, goAt: at, players: go.players.map(function (p) { return { seat: p[0] }; }), ended: false,
        rows: {}, gone: {}, kicks: {}, at: {}, k7: {}, first: {}, rv: {}, openK: -1, decN: 0, decAt: 0, limit: KICKS, archAt: 0, relAt: -Infinity, relSig: '' };
      go.players.forEach(function (p) { H.round.rows[p[0]] = { sec: 0, prog: 0, score: 0, st: 'run', fin: false, extra: 0, at: 0 }; H.round.kicks[p[0]] = {}; H.round.at[p[0]] = -1; });
      ses.state = 'playing';
      applyGo(go, at);
      if (course) { tm.clearInterval(H.relayIv); H.relayIv = every(relay, MS.send); }
      room();
    }

    /* ---------- the Debut Run round ---------- */
    function note(seat, m) {
      var row = H.round.rows[seat];
      if (row.fin || H.round.gone[seat]) return;
      row.sec = m.sec; row.prog = m.prog; row.score = m.score; row.st = m.st;
    }
    /* a row's state as everyone sees it: 'left', 'weak' while its device is silent and its show
       has not ended, else the show's own */
    function rowSt(seat) {
      var R = H.round, w = R.rows[seat], s = seat ? H.seats[seat] : H.me;
      return R.gone[seat] ? 'left' : !w.fin && s && s.weak ? 'weak' : w.st;
    }
    /* everyone's progress, twice a second while it changes (every 2 s while it does not); force:
       at once (a show has ended) */
    function relay(force) {
      var R = H && H.round, t = now(), msg, sig;
      if (!R || R.ended || !course || (force !== true && t - R.relAt < MS.send)) return;
      msg = { t: 'rel', r: R.r, rows: R.players.map(function (p) { var w = R.rows[p.seat]; return [p.seat, w.sec, w.prog, w.score, rowSt(p.seat)]; }) };
      sig = JSON.stringify(msg.rows);
      if (sig === R.relSig && t - R.relAt < MS.room) return;
      R.relSig = sig; R.relAt = t;
      cast(msg); applyRel(msg);
    }
    function gotFin(seat, score, extra, st) {
      var R = H.round, row = R.rows[seat], t = now();
      if (!row || row.fin || R.gone[seat] || R.ended) return;
      if (!course) return;                               /* the Shootout's table comes from the kicks */
      /* C2: the arch is 68 s into the song, so an 'arch' sooner than GO + 60 s is a curtain call:
         it never starts everyone's 20 s to the end */
      if (st === 'arch' && t < R.goAt + archMin) st = 'bow';
      row.fin = true; row.at = t; row.st = st === 'arch' ? 'arch' : 'bow'; row.score = okScore(game, score) ? score : null; row.extra = extra;
      if (row.st === 'arch') { row.prog = 1000; R.archAt = Math.max(R.archAt, t); }
      relay(true); courseCheck();
    }
    /* The round ends when every show has ended (or its device has left); 20 s after the latest
       arrival at the arch for anyone still out there; 20 s after the latest result when everyone
       still out there is paused or silent (and at GO + 90 s for those); and at GO + 150 s at most. */
    function courseCheck() {
      var R = H.round, t = now(), out = [], last = 0, stuck = true;
      if (!R || R.ended) return;
      R.players.forEach(function (p) {
        var w = R.rows[p.seat], s = p.seat ? H.seats[p.seat] : H.me;
        if (w.fin || R.gone[p.seat]) { last = Math.max(last, w.at); return; }
        out.push(p.seat);
        if (!(!s || s.weak || w.st === 'pause')) stuck = false;
      });
      if (!out.length || t >= R.goAt + MS.cap || (R.archAt && t >= R.archAt + MS.after) ||
        (stuck && ((last && t >= last + MS.after) || t >= R.goAt + MS.silentCap))) endCourse();
    }
    function endCourse() {
      var R = H.round, cmp = [], pl;
      R.players.forEach(function (p) { var w = R.rows[p.seat]; if (w.fin && !R.gone[p.seat] && w.score !== null) cmp.push({ seat: p.seat, score: w.score }); });
      pl = places(cmp);
      relay(true);
      endRound(R.players.map(function (p) {
        var w = R.rows[p.seat], done = w.fin && !R.gone[p.seat];
        return [p.seat, done ? w.score : null, done ? w.extra : null, rowSt(p.seat), has(pl, p.seat) ? pl[p.seat] : null];
      }));
    }

    /* ---------- the Encore Shootout round: kick by kick ---------- */
    /* kick k opens on every device when all are waiting at it, or 12 s after the first was */
    function atKick(seat, k) {
      var R = H.round;
      if (!R || R.ended || R.gone[seat] || k >= R.limit) return;
      if (k <= R.openK) { if (seat) send(H.seats[seat].L, { t: 'open', r: R.r, k: R.openK }); else applyOpen({ r: R.r, k: R.openK }); return; }
      R.at[seat] = Math.max(R.at[seat], k);
      lockstep();
    }
    function lockstep() {
      var R = H.round, ps = present(), k = R.openK + 1;
      if (R.ended || k >= R.limit || !ps.length || !ps.some(function (q) { return R.at[q] >= k; })) return;
      if (ps.every(function (q) { return R.at[q] >= k; })) return openKick(k);
      if (!has(R.first, k)) { R.first[k] = now(); later(function () { if (H && H.round === R && !R.ended && R.openK === k - 1) openKick(k); }, MS.kickCap); }
    }
    function openKick(k) {
      var R = H.round, m = { t: 'open', r: R.r, k: k };
      R.openK = k;
      cast(m); applyOpen(m);
      lockstep();
    }
    function gotKick(seat, k, res, pts) {
      var R = H.round, n;
      if (R.gone[seat] || k >= R.limit) return;
      if (has(R.kicks[seat], k)) {                       /* a copy: what that device may have missed */
        if (!seat) return;
        if (R.rv[k]) send(H.seats[seat].L, R.rv[k]);
        n = k - (KICKS - 1);
        if (R.ended) send(H.seats[seat].L, H.endMsg); else if (n >= 0 && R.decN > n && H.decMsg) send(H.seats[seat].L, H.decMsg);
        return;
      }
      /* C2: no kick before GO, and no guest kick the host has not opened yet: a guest kicks an
         opened kick (or, with the host silent, its own after 12 s, which it repeats every 2 s
         until it is revealed), so an early one is taken as waiting at it and counted when it
         comes again. The host's own kicks are never repeated, so they always count. */
      if (now() < R.goAt) return;
      if (seat && k > R.openK) { R.at[seat] = Math.max(R.at[seat], k); lockstep(); return; }
      R.kicks[seat][k] = { res: res, pts: pts, at: now() };
      R.at[seat] = Math.max(R.at[seat], k);
      if (k === KICKS - 1) R.k7[seat] = now();
      settle();
    }
    /* every kick that all who are still in it have taken is revealed (never before a device's own
       kick); then what comes next is decided */
    function settle() {
      var R = H.round, ps = present(), k, m;
      if (R.ended) return;
      for (k = 0; k < R.limit; k++) {
        if (R.rv[k] || !ps.length || !ps.every(function (q) { return has(R.kicks[q], k); })) continue;
        m = { t: 'rv', r: R.r, k: k, rows: ps.map(function (q) { return [q, R.kicks[q][k].res, R.kicks[q][k].pts]; }) };
        R.rv[k] = JSON.stringify(m);
        cast(R.rv[k]); applyRv(m);
      }
      lockstep();
      decideNext();
    }
    function goals(q) { var ks = H.round.kicks[q], g = 0, k; for (k = 0; k < KICKS; k++) if (has(ks, k) && ks[k].res === 'goal') g++; return g; }
    /* After the 8 kicks: more goals came out on top; level goals go to decider kicks, but only
       when both reported their 8th kick within 20 s of each other. A decider: one goal and one
       not ends it; two goals, the next decider; two misses, a team try and the kick again; no
       try left, or 5 deciders gone, a shared top spot. A result still missing 20 s after the
       other's ends it there and then, with no forfeit. */
    function regDone(q) { var ks = H.round.kicks[q], k; for (k = 0; k < KICKS; k++) if (!has(ks, k)) return false; return true; }
    function decideNext() {
      var R = H.round, ps = present(), t = now(), n = R.decN, k = KICKS - 1 + n, first = Infinity, got, ga, gb, scored;
      if (R.ended) return;
      if (!ps.length) return endShoot([]);
      /* C1: deadlines that hold even while both children sit on the Paused sheet with their links
         up: the whole shoot-out by GO + 13 kicks × 30 s + 60 s (level after the 8 kicks: a shared
         top spot; otherwise no head to head), and a decider kick nobody has taken within 12 s of
         the gate and twice 20 s after it was called (the goals were level: a shared top spot) */
      if (t >= R.goAt + (KICKS + DECIDERS) * MS.kickMax + MS.capPad) return endShoot(n && ps.length > 1 ? ps : []);
      if (n && ps.length > 1 && t >= R.decAt + MS.kickCap + 2 * MS.decide && ps.every(function (q) { return !has(R.kicks[q], k); })) return endShoot(ps);
      if (!n) {                                          /* the 8 kicks: every one of them in, for everyone still in it */
        got = ps.filter(regDone);
        ps.forEach(function (q) { if (has(R.k7, q)) first = Math.min(first, R.k7[q]); });
        if (got.length < ps.length) { if (t - first > MS.decide) endShoot([]); return; }
        if (ps.length < 2) return endShoot([]);
        ga = goals(ps[0]); gb = goals(ps[1]);
        if (ga !== gb) return endShoot([ga > gb ? ps[0] : ps[1]]);
        if (Math.abs(R.k7[ps[0]] - R.k7[ps[1]]) > MS.decide) return endShoot(ps);
        return decider(1);
      }
      if (ps.length < 2) return endShoot([]);           /* a friend who left mid-decider: no forfeit, no head to head */
      got = ps.filter(function (q) { return has(R.kicks[q], k); });
      if (got.length < ps.length) {
        if (got.length && t - R.kicks[got[0]][k].at > MS.decide) endShoot(ps);
        return;
      }
      scored = ps.filter(function (q) { return R.kicks[q][k].res === 'goal'; });
      if (scored.length === 1) return endShoot(scored);
      if (!scored.length && H.tries <= 0) return endShoot(ps);
      if (n >= DECIDERS) return endShoot(ps);
      if (scored.length === ps.length) return decider(n + 1);
      H.tries--;
      decider(n + 1);
    }
    function decider(n) {
      var R = H.round, m = { t: 'dec', r: R.r, n: n, tries: H.tries };
      R.decN = n; R.limit = KICKS + n; R.decAt = now();
      H.decMsg = JSON.stringify(m);
      cast(H.decMsg); applyDec(m);
      lockstep();
    }
    /* the table: the 8 regulation kicks only (deciders never add to a score), the top spot(s) */
    function endShoot(top) {
      var R = H.round, done = 0, rows;
      rows = R.players.map(function (p) {
        var ks = R.kicks[p.seat], score = 0, all = true, k;
        for (k = 0; k < KICKS; k++) { if (has(ks, k)) score += ks[k].pts; else all = false; }
        if (all && !R.gone[p.seat]) done++;
        return [p.seat, all ? score : null, all ? goals(p.seat) : null, R.gone[p.seat] ? 'left' : all ? 'done' : 'run', null];
      });
      /* the top spot(s) 1st; with one top spot the other finished shooter is 2nd */
      rows.forEach(function (w) { if (done > 1 && w[3] === 'done') w[4] = top.indexOf(w[0]) >= 0 ? 1 : top.length === 1 ? 2 : null; });
      endRound(rows);
    }

    /* ---------- the end of a round ---------- */
    function endRound(rows) {
      var R = H.round, top = rows.filter(function (w) { return w[4] === 1; }), m = { t: 'end', r: R.r, why: top.length > 1 ? 'tie' : 'done', rows: rows };
      R.ended = true;
      tm.clearInterval(H.relayIv);
      everyone().forEach(function (s) { if (s.st === 'playing') { s.st = 'results'; s.back = !s.seat; s.rdy = false; } });
      H.endMsg = JSON.stringify(m);
      cast(H.endMsg); later(function () { cast(H.endMsg); }, MS.goGap);
      if (ses.state !== 'detached') ses.state = 'results';
      applyEnd(m);
      room();
      if (H.detached) later(function () { closeRoom('left'); }, MS.endGap);   /* the table first, then the room closes */
    }
    /* The host closes the room for everyone: 'end' alone. The links stay open until each guest
       has closed its own (it does on 'end'), with 'end' sent again every second, for 10 s at most. */
    function closeRoom(why) {
      H.end = JSON.stringify({ t: 'end', why: 'closed' });
      cast(H.end);
      shutdown(why);
    }

    /* ---------- a guest ---------- */
    function rdyTry() {    /* 'rdy' says whether the round is built, once the clock has 3 fresh samples */
      if (!G || G.ok || ses.seat < 0) return;
      var want = G.built && G.cd.ready(now());
      if (G.sentRdy === want) return;
      G.sentRdy = want;
      send(G.L, { t: 'rdy', built: want });
    }
    /* what may have been lost on the way is said again every 2 s: my finish, my last kick, that I
       wait at a kick */
    function resend() {
      if (!G || !V || V.ended || !G.L) return;
      G.sentAt = now();
      if (V.fin) send(G.L, V.fin);
      /* each kick not yet revealed; and the last one until the decision after it has come */
      Object.keys(V.mine).forEach(function (k) { k = +k; if (!V.rv[k] || (k >= KICKS - 1 && V.decN <= k - (KICKS - 1) && !V.park)) send(G.L, V.mine[k]); });
      if (!course && V.myK > V.openK) send(G.L, { t: 'w', r: V.r, k: V.myK });
    }
    /* once a second. A tick more than 2.5 s late means this device itself was asleep (the hub's
       own rule): what the host sent meanwhile is still on its way, so the silence is counted
       afresh from now, and a guest whose timers wake first does not give the challenge up */
    function guestTick() {
      var t = now(), slept = t - G.tickAt > MS.stall, quiet, rt = G.cd.rtt(t), weak;
      G.tickAt = t;
      if (slept) G.heard = Math.max(G.heard, t);
      quiet = t - G.heard; weak = quiet > MS.weak;
      send(G.L, rt === null ? { t: 'p', c: t } : { t: 'p', c: t, rt: Math.min(60000, Math.round(rt)) });
      if (weak !== G.weak) { G.weak = weak; emit('weak', { seat: 0, on: weak }); }
      if (quiet > MS.left) return lost();
      if (t - G.sentAt >= MS.resend) resend();
      if (V && V.park && t - V.park.at >= MS.hold) unpark(true);
      /* a device never waits more than 12 s at a kick, even when the host has gone quiet */
      if (V && !V.ended && !course && V.myK > V.openK && t - V.myAt > MS.kickCap + MS.ping) { V.openK = V.myK; maybeOpen(); }
    }
    /* The host's device has gone for 30 s: this child's own round carries on; the challenge has ended */
    function lost() {
      if (dead || !G || G.ok) return;
      emit('left', { seat: 0 });
      shutdown('lost');
    }
    /* the link closed: dial the room again (with the seat's token) until 30 s of silence */
    function guestGone(L) {
      if (dead || !G || G.L !== L) return;
      if (G.ok) { var no = G.no; G.ok = G.no = null; if (no) no('none'); return; }
      if (!G.tok) return lost();
      var n = ++G.tryN, id = core.roomId(kind, c.raceKey, game, word);
      (function dial() {
        if (dead || !G || G.tryN !== n) return;
        var left = MS.left - (now() - G.heard);
        if (left <= 0) return lost();
        Promise.resolve(tr.dial(id, Math.max(1, Math.min(dialMs, left)))).then(function (link) {
          if (dead || !G || G.tryN !== n) { try { link.close(); } catch (e) {} return; }
          wire(link, true, false, function (x) { G.L = x; x.onMsg = guestMsg; x.onGone = guestGone; });
          send(G.L, { t: 'join', tag: me.tag, ai: me.ai, ci: me.ci, tok: G.tok });
        }, function () { if (!dead && G && G.tryN === n) later(dial, MS.redial); });
      })();
    }
    function guestGo(m) {
      var d = G.cd.diff(now()), mine = false, i;
      if (m.r <= lastGo) return;
      for (i = 0; i < m.players.length; i++) if (m.players[i][0] === ses.seat && m.players[i][1] === me.tag) mine = true;
      if (!mine) { lastGo = m.r; emit('sitout', { why: 'late' }); return; }   /* in the next round */
      applyGo(m, d === null ? now() : m.goAt - d);                             /* no clock yet: at once */
    }
    function guestMsg(m, L) {
      var t = m.t, mine = null, i, ok;
      if (!G || L !== G.L) return;
      G.heard = now();
      if (G.weak) { G.weak = false; emit('weak', { seat: 0, on: false }); }
      if (t === 'seat') {
        if (G.ok) { ok = G.ok; G.ok = G.no = null; ses.seat = m.seat; role = ses.role = 'guest'; ses.state = 'lobby'; G.tickAt = now(); every(guestTick, MS.ping); guestTick(); ok(m.seat); }
        else if (m.seat !== ses.seat) return lost();
        G.tok = m.tok; G.tryN++;
        resend();
        /* back with my token after my results came up: my 'back' may have gone into the dead link
           (kart-net's rule); the host takes one 'back' per round, so a repeat changes nothing */
        if (V && V.ended && V.myFin && ses.seat > 0) send(G.L, { t: 'back' });
      } else if (t === 'no') { if (G.no) G.no(m.why); else if (!V || V.ended) shutdown('closed'); else lost(); }
      else if (ses.seat < 0) return;
      else if (t === 'q') { G.cd.add(m.c, m.h, now()); rdyTry(); }
      else if (t === 'room') {
        if (m.q <= G.rq) return;
        G.rq = m.q;
        if (m.variant !== variant) { variant = m.variant; G.built = false; }
        for (i = 0; i < m.players.length; i++) if (m.players[i].seat === ses.seat) mine = m.players[i];
        /* the host is back in the lobby (Rematch) and still has me at the results: my 'back' was lost */
        if (mine && mine.st === 'results' && m.state === 'lobby' && V && V.ended && V.myFin) send(G.L, { t: 'back' });
        if (mine && (mine.st === 'lobby' || mine.st === 'weak')) {
          if (ses.state === 'results' && V && V.backSent) ses.state = 'lobby';   /* the host pressed Rematch */
          if (mine.rdy !== (G.built && G.cd.ready(now()))) G.sentRdy = null;    /* my last 'rdy' was lost, or the host cleared it */
          rdyTry();
        }
        showRoom(m);
      } else if (t === 'go') guestGo(m);
      else if (t === 'rel') applyRel(m);
      else if (t === 'open') applyOpen(m);
      else if (t === 'rv') applyRv(m);
      else if (t === 'dec') applyDec(m);
      else if (t === 'end') { if (m.r !== undefined) applyEnd(m); else if (V && !V.ended) { if (!G.closing) { G.closing = true; later(closed, MS.hold); } } else closed(); }
    }
    /* the room closed; a round's own end that this overtook (links are unordered) still comes first */
    function closed() { unpark(true); shutdown('closed'); }
    /* hello, the host's ticket checked, mine written, then 'join' and a seat */
    function knock(link) {
      return new Promise(function (res, rej) {
        var L = null, done = false, timer = null;
        function end(err, seat) {
          if (done) return;
          done = true; tm.clearTimeout(timer);
          if (err) { if (G && G.L === L) G = null; shut(L); rej(err); } else res(seat);
        }
        if (dead || ses.state !== 'joining') { try { link.close(); } catch (e) {} return rej({ code: 'busy' }); }
        wire(link, true, false, function (x) { L = x; L.onGone = function () { end({ code: 'none' }); }; L.onMsg = onInfo; });
        function onInfo(m) {
          if (m.t === 'no') return end({ code: m.why });
          if (m.t !== 'info' || L.info) return;
          L.info = m;
          if (m.v !== PROTO || m.rules !== c.rules || m.game !== game) return end({ code: 'version' });
          if (m.tag === me.tag) return end({ code: 'self' });       /* this child's own room, on another device (one login shared) */
          if (m.state === 'full') return end({ code: 'full' });
          if (m.state !== 'lobby') return end({ code: 'started' }); /* it has started (or stopped taking anyone): nothing is written */
          var tags = isObj(c.tags) ? c.tags : {};
          variant = m.variant;                           /* so the round can be built while the seat comes */
          tm.clearTimeout(timer); timer = tm.setTimeout(function () { end({ code: 'timeout' }); }, MS.seat);
          (has(tags, m.tag) && m.tag !== me.tag ? ask('checkHost', m.tag, 0, m.r).then(function (ok) { return ok === true; }, function () { return false; }) : Promise.resolve(false)).then(function (ok) {
            if (done) return;
            if (!ok) return end({ code: 'closed' });       /* a room whose host's ticket does not check out */
            return ask('prove', m.h).then(function () {
              if (done) return;
              if (dead || !L.open) return end({ code: 'none' });
              G = { L: L, tok: '', cd: Net.ClockDiff(), heard: now(), rq: -1, weak: false, built: false, sentRdy: false, sentAt: 0, tryN: 0, tickAt: now(),
                ok: function (seat) { end(null, seat); }, no: function (why) { end({ code: why || 'closed' }); } };
              L.onMsg = guestMsg; L.onGone = guestGone;
              send(L, { t: 'join', tag: me.tag, ai: me.ai, ci: me.ci });
              tm.clearTimeout(timer); timer = tm.setTimeout(function () { end({ code: 'timeout' }); }, MS.seat);
            }, function () { end({ code: 'ticket' }); });
          });
        }
        if (done) return;                                /* the link had already closed */
        send(L, { t: 'hello', v: PROTO, rules: c.rules, game: game });
        timer = tm.setTimeout(function () { end({ code: 'timeout' }); }, dialMs);
      });
    }
    /* 3 tries over about 10 s; a room that is not there answers at once, so the tries are spaced */
    function dialRoom(id, n) {
      var t0 = now();
      return Promise.resolve(tr.dial(id, dialMs)).then(null, function () {
        if (dead || ses.state !== 'joining') throw { code: 'busy' };
        if (n + 1 >= JOIN_TRIES) throw { code: 'none' };
        return new Promise(function (res, rej) {
          tm.setTimeout(function () { if (dead || ses.state !== 'joining') rej({ code: 'busy' }); else res(dialRoom(id, n + 1)); }, Math.max(0, MS.joinGap - (now() - t0)));
        });
      });
    }

    /* ---------- closing ---------- */
    function shutdown(why) {
      if (dead) return;
      dead = true;
      var links = (H ? H.links : []).concat(G && G.L ? [G.L] : []), lis = H ? H.lis : null, end = H ? H.end : '', wait = end ? seated() : [], t0 = now(), no = G && G.no;
      ivals.forEach(function (id) { tm.clearInterval(id); }); ivals = [];
      (function out(ms) {
        tm.setTimeout(function () {
          var open = wait.filter(function (s) { return s.L && s.L.open; });
          if (open.length && now() - t0 < MS.endMax) { open.forEach(function (s) { send(s.L, end); }); return out(MS.endGap); }
          links.forEach(shut);
          if (lis) { try { lis.close(); } catch (e) {} }
          try { tr.close(); } catch (e) {}
        }, ms);
      })(MS.grace);
      if (tk) ask('close').then(null, noop);
      ses.state = 'closed';
      if (no) { G.ok = G.no = null; no('closed'); }
      emit('closed', { why: why });
    }

    /* ---------- the API ---------- */
    ses.on = function (name, fn) { if (typeof fn === 'function') (on[name] = on[name] || []).push(fn); return ses; };
    /* Open a challenge under word (or a word drawn here), with the host's course or rival. A word
       someone in the group already holds for this game is swapped for another, 5 tries in all.
       Resolves {word}; rejects {code: 'busy' | 'variant' | 'taken' | 'unreachable' | 'ticket'}. */
    ses.host = function (o) {
      var x = isObj(o) ? o : {}, w = typeof x.word === 'string' ? x.word.toUpperCase() : '';
      if (dead || ses.state !== 'idle') return Promise.reject({ code: 'busy' });
      if (!vVar(x.variant)) return Promise.reject({ code: 'variant' });
      if (!rand) return Promise.reject({ code: 'unreachable' });
      if (!core.isWord(w)) w = drawWord('');
      ses.state = 'opening'; variant = x.variant;
      H = { open: false, started: false, detached: false, lis: null, r: '', seats: [null, null, null, null, null], links: [], lookers: 0, rq: 0, rn: 0, roomAt: 0, tickAt: 0,
        openUntil: 0, goT: null, relayIv: null, goMsg: '', endMsg: '', decMsg: '', end: '', round: null, retry: false, tries: TRIES,
        me: { seat: 0, tag: me.tag, ai: me.ai, ci: me.ci, st: 'lobby', rdy: false, built: false, back: true, weak: false } };
      var tried = [];
      function claim(w, n) {
        tried.push(w);
        return Promise.resolve(tr.listen(core.roomId(kind, c.raceKey, game, w), onCaller)).then(function (lis) { return { lis: lis, w: w }; }, function (err) {
          if (err && err.code === 'taken' && n + 1 < WORD_TRIES) return claim(drawWord(tried), n + 1);
          throw { code: err && err.code === 'taken' ? 'taken' : 'unreachable' };
        });
      }
      return Promise.resolve().then(function () { return tr.open(); }).then(function () { return claim(w, 0); }, function () { throw { code: 'unreachable' }; }).then(function (got) {
        if (dead) { try { got.lis.close(); } catch (e) {} throw { code: 'busy' }; }
        H.lis = got.lis; word = ses.word = got.w; H.r = nonce();
        bind(core.roomText(kind, c.raceKey, game, word));
        return ask('open', 0, H.r).then(function () {
          if (dead) throw { code: 'busy' };
          role = ses.role = 'host'; ses.seat = 0; ses.state = 'lobby'; H.open = true; H.openUntil = now() + MS.open; H.tickAt = now();
          H.links.forEach(function (L) { if (L.wait && L.open) hello(L.wait, L); });
          every(hostTick, MS.ping);
          room();
          return { word: word };
        }, function () { try { got.lis.close(); } catch (e) {} throw { code: 'ticket' }; });
      }).then(null, function (err) { if (!dead && ses.state === 'opening') { H = null; tk = null; ses.state = 'idle'; } throw err; });
    };
    /* Join the room under word, as typed (upper-cased) or from a pop-up. A word that is not one of
       the game words dials nothing. Resolves {seat, word}; rejects {code: 'word' | 'none' | 'full'
       | 'version' | 'closed' | 'started' (it has begun) | 'self' (this child's own room, on another
       device) | 'ticket' | 'unreachable' | 'busy' | 'timeout'}. After a refusal the
       session is idle again, so ↻ Try again can call join once more. */
    ses.join = function (o) {
      var w = isObj(o) && typeof o.word === 'string' ? o.word.toUpperCase() : '';
      if (dead || ses.state !== 'idle') return Promise.reject({ code: 'busy' });
      if (!core.isWord(w)) return Promise.reject({ code: 'word' });
      ses.state = 'joining'; word = ses.word = w;
      bind(core.roomText(kind, c.raceKey, game, w));
      return Promise.resolve().then(function () { return tr.open(); }).then(function () { return dialRoom(core.roomId(kind, c.raceKey, game, w), 0); }, function () { throw { code: 'unreachable' }; })
        .then(knock).then(function (seat) { return { seat: seat, word: w }; }, function (err) {
          if (!dead && ses.state === 'joining') { G = null; ses.state = 'idle'; ask('close').then(null, noop); }
          throw isObj(err) && typeof err.code === 'string' ? err : { code: 'none' };
        });
    };
    /* this device has built its round for the room's course or rival (false: not, or not any more) */
    ses.ready = function (built) {
      built = built !== false;
      if (dead) return false;
      if (role === 'host') {
        H.me.built = built;
        if (H.me.st === 'lobby' && H.me.rdy !== built) { H.me.rdy = built; room(); tryGo(); }
        return true;
      }
      if (!G || ses.seat < 0) return false;
      G.built = built;
      rdyTry();
      return true;
    };
    /* Start: GO follows when every friend in the lobby is ready, and after 8 s without whoever is
       not. Needs one ready friend (the Shootout's one friend). */
    ses.start = function () {
      if (role !== 'host' || dead || ses.state !== 'lobby' || H.detached) return false;
      prune();
      if (!lobbyGuests().some(function (s) { return s.rdy; })) return false;
      ses.state = 'starting'; H.started = true;
      room(); tryGo();
      if (ses.state === 'starting') { tm.clearTimeout(H.goT); H.goT = later(fire, MS.readyWait); }
      return true;
    };
    /* Debut Run: {sec, prog, score, st} at most twice a second (a change of st at once).
       Encore Shootout: {k, phase}; phase 'ready' means this device waits at kick k. */
    ses.progress = function (snap) {
      var o = isObj(snap) ? snap : {}, t = now(), sec, prog, score, st;
      if (dead || !V || V.ended || (ses.state !== 'playing' && ses.state !== 'detached')) return false;
      if (course) {
        sec = clamp(Math.floor(+o.sec || 0), 0, 5); prog = clamp(Math.round(+o.prog || 0), 0, 1000); score = clamp(Math.round(+o.score || 0), 0, 5000);
        st = RUN.indexOf(o.st) >= 0 ? o.st : 'run';
        if (t - V.sAt < MS.send && st === V.lastSt) return false;
        V.sAt = t; V.lastSt = st;
        if (role === 'host') { note(0, { sec: sec, prog: prog, score: score, st: st }); relay(); }
        else send(G.L, { t: 's', r: V.r, q: ++V.q, sec: sec, prog: prog, score: score, st: st });
        return true;
      }
      if (!vK(o.k) || o.phase !== 'ready') return false;
      if (o.k <= V.myK) { maybeOpen(); return false; }
      V.myK = o.k; V.myAt = t;
      if (role === 'host') atKick(0, o.k); else send(G.L, { t: 'w', r: V.r, k: o.k });
      maybeOpen();
      return true;
    };
    /* Encore Shootout: kick k's result, as its result phase begins (once per kick) */
    ses.kick = function (k, res, pts) {
      if (dead || course || !V || V.ended || !vK(k) || !vRes(res) || V.mine[k]) return false;
      pts = res === 'goal' ? pts : 0;
      if (!vPts(pts) || (res === 'goal') !== (pts > 0)) return false;
      V.mine[k] = { t: 'k', r: V.r, k: k, res: res, pts: pts };
      if (role === 'host') gotKick(0, k, res, pts); else send(G.L, V.mine[k]);
      return true;
    };
    /* the round is over on this device: its score, its extra bits, and st ('bow' a curtain call,
       'arch' the show reached the arch; the Shootout's is 'done'). Once per round. */
    ses.finish = function (score, extra, st) {
      if (dead || !V || V.myFin) return false;
      score = Math.round(+score) || 0;
      score = course ? clamp(score, 0, 5000) : clamp(Math.round(score / 10) * 10, 0, 1200);
      extra = isInt(extra) && extra >= 0 && extra <= 0x7fffffff ? extra : 0;
      st = course ? (st === 'arch' ? 'arch' : 'bow') : 'done';
      V.myFin = true;
      if (role === 'host') gotFin(0, score, extra, st);
      else if (!V.ended) { V.fin = { t: 'f', r: V.r, score: score, extra: extra, st: st }; send(G.L, V.fin); }
      else send(G.L, { t: 'f', r: V.r, score: score, extra: extra, st: st });
      maybeBack();
      return true;
    };
    /* After the results, the host only. {variant}: a new round (a new seed) on that course or
       rival, or the same; {useTry: true}: a team try, the same seed and course again, starting as
       soon as everyone is ready (only when 'end' offered it). False when refused. */
    ses.rematch = function (o) {
      var x = isObj(o) ? o : {};
      if (role !== 'host' || dead || ses.state !== 'results' || !H.round || !H.round.ended || H.detached) return false;
      if (x.useTry) { if (!V || !V.teamTry || H.tries <= 0) return false; H.tries--; H.retry = true; }
      else {
        if (x.variant !== undefined && !vVar(x.variant)) return false;
        if (x.variant && x.variant !== variant) { variant = x.variant; H.me.built = false; }
        H.retry = false;
      }
      ses.state = 'lobby'; H.me.st = 'lobby'; H.me.rdy = H.me.built;
      prune();
      seated().forEach(function (s) { if (s.st === 'results' && s.back) s.st = 'lobby'; s.rdy = false; });
      room();
      if (x.useTry) { ses.state = 'starting'; room(); tryGo(); if (ses.state === 'starting') { tm.clearTimeout(H.goT); H.goT = later(fire, MS.tryWait); } }
      return true;
    };
    /* The host only: free every seat whose child is no longer in the roster the lobby holds
       (cfg.tags, read again by the lobby) and tell that child {no: closed}; in a round that
       child has left it. Start and Rematch do this themselves; the lobby calls it after each
       roster re-read. Returns how many seats were freed (0 for a guest). recheck is the same. */
    ses.prune = ses.recheck = function () { return role === 'host' ? prune() : 0; };
    /* Leaving on purpose. A host in the middle of a round keeps passing messages on, with no
       screen, until the round ends, and then closes the room; otherwise, or with atOnce true (the
       challenge may not go on: a grown-up's change), the host closes it at once ('end' alone:
       'The challenge was closed.'; each guest's own round plays on). A guest says bye. */
    ses.leave = function (why, atOnce) {
      if (dead) return;
      why = typeof why === 'string' ? why : 'left';
      if (role === 'host' && H) {
        if (H.round && !H.round.ended && atOnce !== true) { on = {}; H.detached = true; ses.state = 'detached'; gone(0); return; }
        return closeRoom(why);
      }
      if (G && G.L && !G.ok) send(G.L, { t: 'bye' });
      shutdown(why);
    };
    return ses;
  }

  var API = {
    PROTO: PROTO, SEATS: SEATS, TRIES: TRIES, KICKS: KICKS, DECIDERS: DECIDERS, MAX_CHARS: MAX_CHARS, MS: MS,
    check: check, relayFor: relayFor, transport: transport, places: places, create: create
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLDuelNet = API;
})();
