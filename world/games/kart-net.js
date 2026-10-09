/* ================================================================
   Neon Grand Prix — Race together, the network core (no DOM, no
   browser store, no Firestore). Classic UMD: window.SLKartNet in
   the browser, module.exports in Node.

   Up to 5 children race the same course, each on their own device.
   The child who starts the race is the hub: at most 4 others link to
   that device only, and it passes everyone's position on. Each
   device drives its own kart alone, so nothing that arrives here can
   change a child's own time. Karts pass through each other.

   Transport, clock, timers and the lobby-ticket checks are passed
   in, so a whole race runs in a Node test with no network. Only
   peerTransport() touches PeerJS.

   What travels: a seat tag (8 hex digits), avatar and colour as
   index numbers, positions and times. Never a name and never text a
   child typed: each device shows nameOf(tag, seat) from its own copy
   of the roster a grown-up approved. A received value is used only
   if it is a string of at most 1,200 characters holding one known
   message with exactly its listed fields, each in range; anything
   else is dropped. Games never award or spend anything.

     PROTO, PACES                    protocol number; crew paces
     roomId(groupKey, slot)          a race room's address on the link-up server
     ticketC(groupKey, n)            what a lobby ticket holds for room or join number n (bound to the race key)
     check(msg, fromHost)            the message, or null
     ClockDiff()                     my clock against the starter's (fastest of the last 8 round trips)
     GhostBuf()                      where another child's kart is at my race clock
     evidence(), hostVerdict(row, evidence, info) → 'ok' | 'dash'
     create(cfg) → session           find, host, join, leave, setTrack, setCrew, ready, start, sendState,
                                     sendFinish, backToLobby, detach, resync, ghosts, table, on
     peerTransport(Peer, peerOpts, {relayOnly}) → transport
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLKartNet) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLKartNet;
    return;
  }

  var PROTO = 1, PACES = ['gentle', 'quick', 'headline', 'none'];
  var MAX_CHARS = 1200, GUESTS = 4, LOOKERS = 6, SLOTS = 3;
  var VCAP = 350, WALL = 110;                    /* the race logic's own numbers (a test keeps them equal) */
  var SEND_MS = 100, PING_MS = 1000, ROOM_MS = 2000, FIN_MS = 2000, FINAL_MS = 10000, GO_GAP_MS = 300, GRACE_MS = 300, END_GAP_MS = 1000, END_MS = 10000;
  var WEAK_MS = 4000, GONE_MS = 6000, FREE_MS = 8000, LOST_MS = 30000, LOOK_MS = 20000, FIND_MS = 4500, FIND_RELAY_MS = 8000;
  var READY_WAIT_MS = 8000, LEAD_MS = 3500, LEAD_MIN = 4000, LEAD_MAX = 6000, GO_WINDOW_MS = 10000;
  var RATE_MAX = 30, RATE_SECS = 3, QUIET_MS = 2000, OWED_PER_S = 12, RESCAN_MS = [5000, 5000, 10000], RESCAN_EVERY_MS = 30000;
  var STALL_MS = 2500, REDIAL_MS = 1000;                           /* a hub tick this late: the hub itself was asleep; a refused rejoin dial again */
  var FRESH_MS = 10000, SAMPLES = 8, NEED = 3, JUMP_MS = 250, JUMP_RT_MS = 50;   /* ClockDiff */
  var KEEP = 6, CARRY_S = 0.4, WEAK_S = 1.5, GONE_S = 6;            /* GhostBuf */
  var BURST_S = 3, LINE_PX = 48, OPEN_MS = 50, AHEAD_MS = 250;      /* hostVerdict */
  var BROKER_MS = 8000, KEEP_MS = 2500, KEEP_TRIES = 8, STATS_MS = 300, STATS_TRIES = 3;   /* peerTransport */

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fin(n) { return typeof n === 'number' && isFinite(n); }
  function isInt(n) { return fin(n) && Math.floor(n) === n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ---------- room address ---------- */
  /* FNV-1a, 32 bits, whole-number maths only, so every browser and Node agree */
  function fnv(text, h) {
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /* groupKey is the race key a grown-up's Control Centre wrote, never a family code.
     Only two hashes of it appear in the address. slot is 1, 2 or 3. */
  function roomId(groupKey, slot) {
    var text = 'slkart1|' + (typeof groupKey === 'string' ? groupKey : '');
    return 'ttq-kart-' + fnv(text, 0x811c9dc5).toString(36) + fnv(text, 0x01234567).toString(36) + '-' + (slot === 2 || slot === 3 ? slot : 1);
  }
  /* What a lobby ticket holds (its c, 16 hex digits) for a room number or a join number n: two
     hashes of the race key with n. The number travels in 'info'; the ticket holds this, so a
     ticket left behind under an older race key never matches again ('New race key' clears it). */
  function ticketC(groupKey, n) {
    var text = 'slticket1|' + (typeof groupKey === 'string' ? groupKey : '') + '|' + (typeof n === 'string' ? n : '');
    return ('0000000' + fnv(text, 0x811c9dc5).toString(16)).slice(-8) + ('0000000' + fnv(text, 0x01234567).toString(16)).slice(-8);
  }

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
  var kind = function (x) { return typeof x === 'string'; };
  var vTag = re(/^[0-9a-f]{8}$/), vHex16 = re(/^[0-9a-f]{16}$/), vTrack = re(/^[a-z][a-z0-9_]{0,39}$/), vLayout = re(/^[0-9a-f]{0,8}$/);
  var vSeat = int(0, GUESTS), vAi = int(0, 23), vCi = int(0, 7), vRace = int(0, 1e6), vSeq = int(0, 1e9), vVer = int(0, 1e6), vClock = num(-1e15, 1e15);
  var vT = num(0, 1800), vP = num(-200, 1e5), vLat = num(-(WALL + 5), WALL + 5), vV = num(-120, 360), vFlags = int(0, 127), vMs = orNull(int(0, 1800000));
  var ROW_STATES = ['racing', 'done', 'dnf', 'gone', 'dash'];
  var vRows = listOf(GUESTS + 1, tuple([vSeat, vMs, int(0, 9), oneOf(ROW_STATES)]));
  /* 'end' alone, or 'end' carrying the final table of race r: both r and rows, or neither */
  var endShape = shape({ t: kind, why: oneOf(['closed']), r: opt(vRace), rows: opt(vRows) });
  function vEnd(o) { return endShape(o) && (o.r === undefined) === (o.rows === undefined); }
  var FROM_GUEST = {
    hello: shape({ t: kind, v: vVer, rules: vVer }),
    join: shape({ t: kind, tag: vTag, ai: vAi, ci: vCi, tok: opt(vHex16) }),
    p: shape({ t: kind, c: vClock, rt: opt(num(0, 60000)) }),
    rdy: shape({ t: kind, track: vTrack, hb: bool }),
    s: shape({ t: kind, r: vRace, q: vSeq, T: vT, P: vP, l: vLat, v: vV, f: vFlags }),
    f: shape({ t: kind, r: vRace, ms: vMs, P: vP }),
    back: shape({ t: kind }),
    bye: shape({ t: kind })
  };
  var FROM_HOST = {
    info: shape({ t: kind, v: vVer, rules: vVer, tag: vTag, ai: vAi, ci: vCi, track: vTrack, used: int(1, GUESTS + 1), state: oneOf(['lobby', 'racing', 'full']), r: vHex16, h: vHex16 }),
    no: shape({ t: kind, why: oneOf(['full', 'version', 'closed']) }),
    seat: shape({ t: kind, seat: int(1, GUESTS), tok: vHex16, r: vRace }),
    room: shape({ t: kind, q: vSeq, state: oneOf(['lobby', 'racing', 'results']), track: vTrack, crew: oneOf(PACES),
      players: listOf(GUESTS + 1, shape({ seat: vSeat, tag: vTag, ai: vAi, ci: vCi, st: oneOf(['lobby', 'racing', 'results', 'weak']), rdy: bool })) }),
    q: shape({ t: kind, c: vClock, h: vClock }),
    go: shape({ t: kind, r: vRace, at: vClock, track: vTrack, laps: int(1, 9), rules: vVer, layout: vLayout, crew: shape({ pace: oneOf(PACES), n: int(0, 5) }),
      players: listOf(GUESTS + 1, shape({ seat: vSeat, tag: vTag, ai: vAi, ci: vCi })) }),
    S: shape({ t: kind, r: vRace, q: vSeq, k: listOf(GUESTS + 1, tuple([vSeat, vT, vP, vLat, vV, vFlags])) }),
    res: shape({ t: kind, r: vRace, final: bool, rows: vRows }),
    rematch: shape({ t: kind }),
    end: vEnd
  };
  /* The message itself when it is one this side may receive and every field is the right
     type and in range; otherwise null. Type 'e' (stickers) is reserved and, like any
     unknown type, simply not known here. Never throws. */
  function check(msg, fromHost) {
    try {
      if (!isObj(msg) || typeof msg.t !== 'string') return null;
      var table = fromHost ? FROM_HOST : FROM_GUEST;
      return has(table, msg.t) && table[msg.t](msg) ? msg : null;
    } catch (e) { return null; }
  }
  /* what came down a link: a string of at most 1,200 characters holding one JSON object, or null */
  function parse(data) {
    if (typeof data !== 'string' || data.length > MAX_CHARS) return null;
    try { var o = JSON.parse(data); return isObj(o) ? o : null; } catch (e) { return null; }
  }

  /* ---------- clock difference ---------- */
  /* add(c, h, now): my clock when the ping left, the starter's clock in the reply, my clock
     now. The difference (starter's clock minus mine) is taken from the fastest round trip
     of the last 8 samples newer than 10 s, so it is wrong by at most half that trip's
     asymmetry. A new sample more than 250 ms away from the best one, on a trip about as
     fast as the best (at most 50 ms slower), means a clock stood still or jumped:
     everything older is thrown away. The same disagreement on a slow trip is one delayed
     ping (Wi-Fi power-save, a busy starter): it is dropped (false), and the good samples stay. */
  function ClockDiff() {
    var S = [];
    function best(now) {
      while (S.length && (now - S[0].at > FRESH_MS || S.length > SAMPLES)) S.shift();
      var b = null, i;
      for (i = 0; i < S.length; i++) if (!b || S[i].rt < b.rt) b = S[i];
      return b;
    }
    return {
      add: function (c, h, now) {
        if (!fin(c) || !fin(h) || !fin(now) || now < c) return false;
        var rt = now - c, d = h + rt / 2 - now, b = best(now);
        if (b && Math.abs(d - b.d) > JUMP_MS) {
          if (rt > b.rt + JUMP_RT_MS) return false;
          S.length = 0;
        }
        S.push({ at: now, rt: rt, d: d });
        return true;
      },
      ready: function (now) { best(now); return S.length >= NEED; },
      diff: function (now) { var b = best(now); return b ? b.d : null; },
      rtt: function (now) { var b = best(now); return b ? b.rt : null; },
      reset: function () { S.length = 0; }
    };
  }

  /* ---------- another child's kart ---------- */
  /* The last 6 samples {T, P, l, v, f} of one racer. at(T) gives where to draw it at my
     race clock: between two samples when T is bracketed; carried forward at the speed of
     the last two for at most 0.4 s when T is newer; then held. weak after 1.5 s without
     news and gone after 6 s (never for a kart that has finished). The returned object is
     reused. Every race clock is real time from the same GO, so my T is the right ruler. */
  function GhostBuf() {
    var S = [], lastQ = -1, out = { P: 0, lat: 0, v: 0, flags: 0, weak: false, gone: false };
    return {
      add: function (q, T, P, l, v, f) {
        if (!(q > lastQ) || !fin(T) || !fin(P) || !fin(l) || !fin(v)) return false;
        lastQ = q;
        if (S.length && T <= S[S.length - 1].T) return false;
        S.push({ T: T, P: P, l: l, v: v, f: isInt(f) ? f : 0 });
        if (S.length > KEEP) S.shift();
        return true;
      },
      at: function (T) {
        var n = S.length, a = null, b = n ? S[n - 1] : null, i, u, age;
        if (!fin(T)) T = 0;
        age = T - (b ? b.T : 0);
        if (!b) { out.P = 0; out.lat = 0; out.v = 0; out.flags = 0; }
        else if (T >= b.T) {
          a = n > 1 ? S[n - 2] : null;
          u = a ? clamp((b.P - a.P) / (b.T - a.T), -120, VCAP * 1.5) : b.v;
          out.P = b.P + u * Math.min(age, CARRY_S); out.lat = b.l; out.v = b.v; out.flags = b.f;
        } else {
          for (i = n - 1; i > 0 && S[i - 1].T > T; i--) {}
          b = S[i]; a = i ? S[i - 1] : b;
          u = a === b ? 0 : (T - a.T) / (b.T - a.T);
          out.P = a.P + (b.P - a.P) * u; out.lat = a.l + (b.l - a.l) * u; out.v = a.v + (b.v - a.v) * u; out.flags = a.f;
        }
        var done = (out.flags & 16) !== 0;
        out.weak = !done && age > WEAK_S; out.gone = !done && age > GONE_S;
        return out;
      },
      reset: function () { S.length = 0; lastQ = -1; }
    };
  }

  /* ---------- the starter's checks on a reported finish ---------- */
  /* What the hub saw of one racer: the furthest distance reported, the fastest advance
     over any 3 s (px/s), and the latest race clock at which that kart said it was still
     driving. hostMs is the hub's own race clock when the finish message arrived. */
  function evidence() {
    var W = [], e = { maxP: 0, burst: 0, openT: 0, hostMs: 0 };
    e.note = function (T, P, f) {
      if (!fin(T) || !fin(P)) return;
      W.push([T, P]);
      while (W.length > 1 && T - W[0][0] > BURST_S) W.shift();
      e.burst = Math.max(e.burst, (P - W[0][1]) / BURST_S);
      e.maxP = Math.max(e.maxP, P);
      if (!(f & 16)) e.openT = Math.max(e.openT, T);
    };
    return e;
  }
  /* row = {ms, P} as reported; info = {len, laps, floorMs}. 'dash' only on evidence: the
     time is under the course floor, the kart never reported the whole distance, it moved
     faster than top speed × 1.5 averaged over 3 s, it said it was still driving after the
     time it now claims, or the time is ahead of the hub's own clock. A finish that simply
     arrives late is 'ok'. The hub never puts a time of its own in a row. */
  function hostVerdict(row, ev, info) {
    var r = isObj(row) ? row : {}, e = isObj(ev) ? ev : {}, c = isObj(info) ? info : {}, ms = r.ms;
    if (!isInt(ms) || !(ms >= c.floorMs)) return 'dash';
    if (!(Math.max(fin(r.P) ? r.P : 0, fin(e.maxP) ? e.maxP : 0) >= c.laps * c.len - LINE_PX)) return 'dash';
    if (e.burst > (c.vcap > 0 ? c.vcap : VCAP) * 1.5) return 'dash';
    if (e.openT * 1000 > ms + OPEN_MS) return 'dash';
    if (fin(e.hostMs) && ms > e.hostMs + AHEAD_MS) return 'dash';
    return 'ok';
  }

  /* ---------- the session ---------- */
  /* cfg = {transport, clock: {now()}, timers: {setTimeout, clearTimeout, setInterval,
     clearInterval}, me: {tag, ai, ci}, groupKey, tags (SLSocialCore.tagMap; read at each
     join, so the lobby may replace it), nameOf(tag, seat) → string, rules, courseInfo(id)
     → {len, laps, floorMs, layoutKey, capMs} or null, crewTimes(id, pace, n) → [ms],
     tickets: {open(slot, r), prove(h), checkHost(tag, slot, r), checkJoiner(tag, h),
     close()} each returning a Promise, SC (SLSocialCore), getRandomValues (optional; the
     browser's own by default)}.
     transport = {open() → Promise, listen(id, onLink) → Promise<{close}> (rejects {code:
     'taken'} for a room in use), dial(id, ms) → Promise<link>, close(), relayOnly};
     link = {send(text), onMessage(fn), onClose(fn), close()}. The session closes the
     transport when it closes.
     Seats are 0 to 4; seat 0 is the starter. session.state is 'idle', 'finding', 'lobby',
     'starting', 'racing', 'results', 'detached', 'lost' or 'closed'; session.room and
     session.go hold what the last 'room' and 'go' events carried.
     Events (session.on): 'room' {state, track, trackOk, crew, seat, host, players: [{seat,
     tag, name, ai, ci, st, rdy, me}]}; 'ready' {all, waiting: [names], allBest}; 'go' {r, track, goAt
     (my clock, ms), laps, layout, crew: {pace, n}, seat, players}; 'table' (see table());
     'weak' {on}; 'rematch'; 'sitout' {why: 'update' | 'clock'}; 'other' (a row, for a
     starter waiting alone); 'lost'; 'closed' {why}. */
  function create(cfg) {
    var c = isObj(cfg) ? cfg : {};
    var tr = c.transport, clock = c.clock, tm = c.timers, tk = isObj(c.tickets) ? c.tickets : {}, SC = c.SC;
    if (!tr || !clock || !tm || !SC || typeof c.courseInfo !== 'function') throw new Error('SLKartNet: transport, clock, timers, SC and courseInfo are needed');
    var who = isObj(c.me) ? c.me : {};
    var me = { tag: typeof who.tag === 'string' ? who.tag : '', ai: vAi(who.ai) ? who.ai : 0, ci: vCi(who.ci) ? who.ci : 0 };
    var rand = typeof c.getRandomValues === 'function' ? c.getRandomValues
      : typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function' ? function (a) { return crypto.getRandomValues(a); } : null;
    var findMs = tr.relayOnly === true ? FIND_RELAY_MS : FIND_MS;
    var on = {}, ivals = [], dead = false, role = null;
    var track = '', crew = 'gentle', raceNo = 0, race = null, ghosts = [], sentAt = -Infinity, roomSig = '', readySig = '';
    var H = null, G = null, F = null, looks = {}, hostsOk = {};       /* F: the search under way */
    var ses = { state: 'idle', role: null, seat: -1, slot: 0, room: null, go: null };

    function now() { return clock.now(); }
    function emit(name, a) { var l = (on[name] || []).slice(), i; for (i = 0; i < l.length; i++) { try { l[i](a); } catch (e) {} } }
    function later(fn, ms) { return tm.setTimeout(function () { if (!dead) fn(); }, ms); }
    function every(fn, ms) { var id = tm.setInterval(function () { if (!dead) fn(); }, ms); ivals.push(id); return id; }
    function ask(name, a, b, d) { try { return Promise.resolve(tk[name](a, b, d)); } catch (e) { return Promise.reject(e); } }
    function nonce() { return SC.newNonce(rand); }
    function courseOf(id) {
      var i = null;
      try { i = c.courseInfo(id); } catch (e) { i = null; }
      return isObj(i) && i.len > 0 && isInt(i.laps) && i.laps > 0 && i.floorMs > 0 && i.capMs > 0 ? i : null;
    }
    /* the name this device shows for a seat: from its own roster, never from the wire */
    function nm(tag, seat) {
      var n = '';
      try { n = c.nameOf(tag, seat); } catch (e) { n = ''; }
      return typeof n === 'string' && n && n.length <= 24 ? n : 'Racer ' + (seat + 1);
    }

    /* ---------- links ---------- */
    /* strict (the hub's side): rubbish, a non-string, an over-long string, or the 91st
       message inside 3 s (more than 30 a second) closes the link. A link that was silent for
       2 s or more is owed what a guest sends meanwhile (12 a second of the silence, 30 s at
       most): a backlog that a stalled network, or a starter's own sleep, delivers in one burst
       is not counted. A silence buys at most that once, so a flood is closed as before as soon
       as what it is owed has gone. A guest just drops what fails. */
    function wire(link, fromHost, strict) {
      var L = { link: link, open: true, deaf: false, onMsg: null, onGone: null, seat: null, looker: false, times: [], lastAt: now(), owed: 0 };
      link.onMessage(function (data) {
        if (!L.open || L.deaf || dead) return;
        var t = now(), o = parse(data), m;
        if (strict && o) {
          if (t - L.lastAt >= QUIET_MS) L.owed = Math.floor(Math.min(t - L.lastAt, LOST_MS) / 1000 * OWED_PER_S);
          L.lastAt = t;
        }
        if (strict && o && L.owed > 0) L.owed--;
        else if (strict && (!o || (L.times.push(t) > RATE_MAX * RATE_SECS && t - L.times.shift() < RATE_SECS * 1000))) { kill(L); return; }
        m = o && check(o, fromHost);
        if (m && L.onMsg) L.onMsg(m, L);
      });
      /* a closing session still learns which links the far end has closed (a starter waits for that after 'end') */
      link.onClose(function () { if (L.open) { L.open = false; if (!dead && L.onGone) L.onGone(L); } });
      return L;
    }
    function send(L, msg) { if (L && L.open) { try { L.link.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) {} } }
    function shut(L) { if (L && L.open) { L.open = false; try { L.link.close(); } catch (e) {} } }
    function kill(L) { var g = L.onGone; shut(L); if (g) g(L); }
    /* stop listening now; close once what was just sent has had time to leave */
    function drop(L) { if (L && L.open && !L.deaf) { L.deaf = true; tm.setTimeout(function () { shut(L); }, GRACE_MS); } }

    /* ---------- what both sides show ---------- */
    /* the room as this device shows it; the events fire only when something changed */
    function showRoom(m) {
      var wait = [], sig = '', best = !!H, i, p, s;
      var view = { state: m.state, track: m.track, trackOk: !!courseOf(m.track), crew: m.crew, seat: ses.seat, host: role === 'host', players: m.players.map(function (q) {
        return { seat: q.seat, tag: q.tag, name: nm(q.tag, q.seat), ai: q.ai, ci: q.ci, st: q.st, rdy: q.rdy, me: q.seat === ses.seat };
      }) };
      sig = JSON.stringify(view);
      if (sig !== roomSig) { roomSig = sig; ses.room = view; emit('room', view); }
      sig = '';
      /* who the starter's button is waiting for: children in the lobby whose device has not built the course */
      for (i = 0; i < m.players.length; i++) {
        p = m.players[i];
        if (p.st !== 'lobby' && p.st !== 'weak') continue;
        s = H ? (p.seat ? H.seats[p.seat] : H.me) : null;
        if (!s || !s.hb) best = false;
        sig += p.seat + (p.rdy ? 'y' : 'n');
        if (!p.rdy) wait.push(nm(p.tag, p.seat));
      }
      sig += best + m.track;
      if (sig !== readySig) { readySig = sig; emit('ready', { all: !wait.length, waiting: wait, allBest: best }); }
    }
    function goView(m, goAt) {
      return { r: m.r, track: m.track, goAt: goAt, laps: m.laps, layout: m.layout, crew: { pace: m.crew.pace, n: m.crew.n }, seat: ses.seat,
        players: race.players.map(function (p) { return { seat: p.seat, tag: p.tag, name: nm(p.tag, p.seat), ai: p.ai, ci: p.ci, me: p.seat === ses.seat }; }) };
    }
    /* a new race on this device: rows, ghost buffers and the crew's fixed times */
    function begin(m, goAt, info) {
      var R = { r: m.r, track: m.track, info: info, goAt: goAt, crew: m.crew, players: [], rows: {}, bufs: {}, ev: {}, last: {}, dirty: {},
        final: false, finalAt: 0, mine: null, maxP: info.laps * info.len + 400, crewMs: [] }, ct;
      ghosts.length = 0;
      m.players.forEach(function (p) {
        if (has(R.rows, p.seat)) return;
        R.players.push(p);
        R.rows[p.seat] = { ms: null, laps: 0, state: 'racing' };
        R.ev[p.seat] = evidence();
        if (p.seat === ses.seat) return;
        R.bufs[p.seat] = GhostBuf();
        ghosts.push({ seat: p.seat, P: 0, lat: 0, v: 0, flags: 0, weak: false, gone: false, finishMs: null });
      });
      if (m.crew.n > 0) { try { ct = c.crewTimes(m.track, m.crew.pace, m.crew.n); if (Array.isArray(ct)) R.crewMs = ct.filter(isInt).slice(0, 5); } catch (e) {} }
      race = R; sentAt = -Infinity; track = m.track;
      ses.state = 'starting';
      later(function () { if (race === R && ses.state === 'starting') ses.state = 'racing'; }, Math.max(0, goAt - now()));
      ses.go = goView(m, goAt);
      emit('go', ses.go);
    }
    function rowOpen(seat) { var row = race && race.rows[seat]; return !!row && (row.state === 'racing' || row.state === 'gone'); }
    /* the hub's row for whoever sits in seat s now: only when that child is the one the race
       started with in that seat (a seat freed mid-race may be given to a newcomer) */
    function rowFor(s) {
      var R = race, i;
      if (!R || !s || !R.rows[s.seat]) return null;
      for (i = 0; i < R.players.length; i++) if (R.players[i].seat === s.seat) return R.players[i].tag === s.tag ? R.rows[s.seat] : null;
      return null;
    }
    function rowOpenFor(s) { var row = rowFor(s); return !!row && (row.state === 'racing' || row.state === 'gone'); }

    /* ---------- the hub ---------- */
    function seated() { var out = [], i; for (i = 1; i <= GUESTS; i++) if (H.seats[i]) out.push(H.seats[i]); return out; }
    function inLobby() { return seated().filter(function (s) { return s.st === 'lobby'; }); }
    function seatOf(tag) { var a = seated(), i; for (i = 0; i < a.length; i++) if (a[i].tag === tag) return a[i]; return null; }
    function cast(msg) { var text = typeof msg === 'string' ? msg : JSON.stringify(msg), a = seated(), i; for (i = 0; i < a.length; i++) send(a[i].L, text); }
    function room() {
      if (!H || dead) return;
      var msg = { t: 'room', q: ++H.rq, state: ses.state === 'lobby' ? 'lobby' : ses.state === 'results' ? 'results' : 'racing', track: track, crew: crew,
        players: [H.me].concat(seated()).map(function (s) { return { seat: s.seat, tag: s.tag, ai: s.ai, ci: s.ci, st: s.weak ? 'weak' : s.st, rdy: s.rdy }; }) };
      H.roomAt = now();
      cast(msg); showRoom(msg);
    }
    function onCaller(link) {
      if (!H || dead) { try { link.close(); } catch (e) {} return; }
      var L = wire(link, false, true);
      L.looker = true; L.over = ++H.lookers > LOOKERS;
      L.onMsg = hostMsg; L.onGone = hostGone;
      H.links.push(L);
      tm.setTimeout(function () { if (L.looker && L.open) kill(L); }, LOOK_MS + 5000);
    }
    function hostGone(L) {
      if (L.looker) { L.looker = false; H.lookers--; }
      if (L.seat && L.seat.L === L) L.seat.L = null;     /* the seat waits for a rejoin with its token; the 1 s tick frees or marks it */
    }
    function bye(L) { hostGone(L); drop(L); }
    function refuse(L, why) { send(L, { t: 'no', why: why }); bye(L); }
    function hello(m, L) {
      if (!H.open) { L.wait = m; return; }               /* the ticket is not written yet: answer when it is */
      if (m.v !== PROTO || m.rules !== c.rules) return refuse(L, 'version');
      if (ses.state === 'detached') return refuse(L, 'closed');
      var used = seated().length + 1;
      L.h = nonce();
      send(L, { t: 'info', v: PROTO, rules: c.rules, tag: me.tag, ai: me.ai, ci: me.ci, track: track, used: used,
        state: L.over || used > GUESTS ? 'full' : ses.state === 'lobby' ? 'lobby' : 'racing', r: H.r, h: L.h });
      if (L.over) bye(L);                                /* a 7th looker still learns the race exists, and that it is full */
    }
    function sit(s, L) {
      var row = rowFor(s);
      if (L.looker) { L.looker = false; H.lookers--; }
      s.L = L; L.seat = s; s.heard = now(); s.weak = false;
      send(L, { t: 'seat', seat: s.seat, tok: s.tok, r: raceNo });
      room();
      if (row) send(L, resMsg());
      /* back with its token while its row still waits for a first word from it: the GO it may
         never have had (its link was re-forming as GO went). It races, or sits out and says so */
      if (row && !race.final && row.state === 'racing' && s.q < 0 && H.goMsg) send(L, H.goMsg);
    }
    function joinReq(m, L) {
      var tags = isObj(c.tags) ? c.tags : {}, s, i, h = L.h;
      if (L.seat || L.asking) return;
      if (m.tok) {                                       /* back into the same seat: the token stands in for the ticket */
        s = seatOf(m.tag);
        if (!s || s.tok !== m.tok) return refuse(L, 'closed');
        if (s.L && s.L !== L) { s.L.seat = null; bye(s.L); }
        return sit(s, L);
      }
      if (ses.state === 'detached' || !h || !has(tags, m.tag) || m.tag === me.tag || seatOf(m.tag)) return refuse(L, 'closed');
      if (seated().length >= GUESTS) return refuse(L, 'full');
      L.asking = true; L.h = '';                         /* the number is good for one try */
      ask('checkJoiner', m.tag, h).then(function (ok) { return ok === true; }, function () { return false; }).then(function (ok) {
        L.asking = false;
        if (dead || !H || !L.open || L.deaf) return;
        if (!ok || seatOf(m.tag)) return refuse(L, 'closed');
        for (i = 1; i <= GUESTS && H.seats[i]; i++) {}
        if (i > GUESTS) return refuse(L, 'full');
        s = H.seats[i] = { seat: i, tag: m.tag, ai: m.ai, ci: m.ci, tok: nonce(), L: null, st: 'lobby', rdy: false, hb: false, rt: 0, q: -1, heard: now(), weak: false };
        sit(s, L);
      });
    }
    function freeSeat(s, tell) {
      var row = rowFor(s);
      H.seats[s.seat] = null;
      if (s.L) { if (tell) send(s.L, { t: 'no', why: 'closed' }); s.L.seat = null; bye(s.L); }
      if (row && (row.state === 'racing' || row.state === 'gone')) { row.state = 'gone'; sendRes(); }
      room(); tryGo();
    }
    function hostMsg(m, L) {
      var s = L.seat, t = m.t, row;
      if (t === 'hello') return hello(m, L);
      if (t === 'join') return joinReq(m, L);
      if (!s) return;                                    /* everything else needs a seat */
      row = rowFor(s);                                   /* this child's own row in the race, if it is in it */
      /* heard again after more than 4 s of silence: the final table once more, in case it went by meanwhile */
      if (race && race.final && row && now() - s.heard > WEAK_MS) send(L, resMsg());
      s.heard = now();
      if (t === 'p') { if (fin(m.rt)) s.rt = m.rt; send(L, { t: 'q', c: m.c, h: now() }); }
      else if (t === 'rdy') { if (m.track === track && !(s.rdy && s.hb === m.hb)) { s.rdy = true; s.hb = m.hb; room(); tryGo(); } }
      else if (t === 's') { if (row && m.r === race.r && m.q > s.q && m.P <= race.maxP) { s.q = m.q; note(s.seat, m.q, m.T, m.P, m.l, m.v, m.f); relay(); } }
      else if (t === 'f') { if (row && m.r === race.r && !decide(s.seat, m.ms, m.P)) send(L, resMsg()); }
      else if (t === 'back') { if (!rowOpenFor(s) || race.final) { s.st = 'lobby'; room(); } }
      else if (t === 'bye') freeSeat(s, false);
    }
    /* once a second: weak and freed seats, the 2 s room list, the 2 s table (for 10 s more once
       it is final: a guest that missed the last copy gets another), the race cap. A tick more
       than 2.5 s after the last one means this device itself was asleep (an app switch, a
       locked screen): what the guests sent meanwhile is still on its way, so nobody's silence
       is counted against them on that tick; it is counted afresh from now. */
    function hostTick() {
      var t = now(), R = race, changed = false, moved = false, slept = t - H.tickAt > STALL_MS, i, s, row, quiet, st;
      H.tickAt = t;
      for (i = 1; i <= GUESTS; i++) {
        s = H.seats[i];
        if (!s) continue;
        if (slept) { s.heard = Math.max(s.heard, t); continue; }
        quiet = t - s.heard; row = rowFor(s);
        if (ses.state === 'lobby' && quiet > FREE_MS) { freeSeat(s, true); continue; }
        if ((quiet > WEAK_MS) !== s.weak) { s.weak = !s.weak; changed = true; }
        /* still driving, as far as the hub can tell, until its link has been closed for 6 s or silent for 30 s */
        if (row && !R.final && (row.state === 'racing' || row.state === 'gone')) {
          st = quiet > (s.L ? LOST_MS : GONE_MS) ? 'gone' : 'racing';
          if (st !== row.state) { row.state = st; moved = true; }
        }
      }
      if (R && !R.final && (moved || t - H.resAt >= ROOM_MS || t >= R.goAt + R.info.capMs)) sendRes();
      else if (R && R.final && t - R.finalAt < FINAL_MS && t - H.resAt >= ROOM_MS) { H.resAt = t; cast(resMsg()); }
      if (!dead && (changed || t - H.roomAt >= ROOM_MS)) room();
      H.links = H.links.filter(function (L) { return L.open; });
    }

    /* positions: stored as they arrive, passed on at most every 100 ms */
    function note(seat, q, T, P, l, v, f) {
      var R = race;
      if (R.bufs[seat] && !R.bufs[seat].add(q, T, P, l, v, f)) return;
      R.ev[seat].note(T, P, f);
      R.last[seat] = [seat, r2(T), r1(P), r1(l), Math.round(v), f]; R.dirty[seat] = true;
    }
    function relay() {
      var R = race, t = now(), k = [], i;
      if (!R || !H || t - H.sAt < SEND_MS) return;
      for (i = 0; i <= GUESTS; i++) if (R.dirty[i]) { k.push(R.last[i]); R.dirty[i] = false; }
      if (!k.length) return;
      H.sAt = t;
      cast({ t: 'S', r: R.r, q: ++H.sq, k: k });
    }
    function resMsg() {
      var R = race;
      return { t: 'res', r: R.r, final: R.final, rows: R.players.map(function (p) {
        var row = R.rows[p.seat];
        if (row.state !== 'done') row.laps = clamp(Math.floor(R.ev[p.seat].maxP / R.info.len), 0, R.info.laps);
        return [p.seat, row.ms, row.laps, row.state];
      }) };
    }
    /* The table goes out whenever it changes and every 2 s until it is final: when every
       child has finished, stopped or gone, or at the race cap (then anyone still driving
       is 'didn't finish'). The final table then goes again every 2 s for 10 s (hostTick),
       counted from its last change. */
    function sendRes() {
      var R = race, was = R.final, over = now() >= R.goAt + R.info.capMs, open = 0;
      R.players.forEach(function (p) { var row = R.rows[p.seat]; if (row.state === 'racing') { if (over) row.state = 'dnf'; else open++; } });
      if (!open && !was) {                               /* nobody is driving any more */
        R.final = true;
        [H.me].concat(seated()).forEach(function (s) { if (s.st === 'racing') s.st = 'results'; });
      }
      if (R.final) R.finalAt = now();
      H.resAt = now();
      cast(resMsg());
      emit('table', ses.table());
      if (R.final && !was) {
        tm.clearInterval(H.relayIv);
        if (ses.state === 'detached') endRace('detached');
      }
    }
    /* The starter closes the race for everyone: 'end', with the final table inside it when there
       is one, so a guest that hears 'end' has that table even if 'end' overtook the last 'res' or
       that 'res' was lost. shutdown() then keeps each guest's link open, sending 'end' again,
       until the guest has closed it. */
    function endRace(why) {
      var R = race, msg = { t: 'end', why: 'closed' };
      if (R && R.final) { msg.r = R.r; msg.rows = resMsg().rows; }
      H.end = JSON.stringify(msg);
      cast(H.end);
      shutdown(why);
    }
    /* the first report for a seat is the one that counts; a later copy changes nothing */
    function decide(seat, ms, P) {
      var R = race, row = R.rows[seat], ev = R.ev[seat], s = seat ? H.seats[seat] : H.me;
      if (row.state !== 'racing' && row.state !== 'gone') return false;
      ev.hostMs = now() - R.goAt;
      if (ms === null) row.state = 'dnf';
      else if (hostVerdict({ ms: ms, P: P }, ev, R.info) === 'ok') { row.ms = ms; row.laps = R.info.laps; row.state = 'done'; }
      else row.state = 'dash';                           /* shown as a dash, with no comment */
      if (s) s.st = 'results';
      sendRes(); room();
      return true;
    }
    function tryGo() { if (H && ses.state === 'starting' && !H.fired && H.me.rdy && inLobby().every(function (s) { return s.rdy; })) fire(); }
    /* GO is 4 to 6 s ahead on the hub's clock: 3.5 s plus twice the slowest round trip. A seat
       whose link is down just then (it is coming back with its token) is in the next race, not
       this one: it could not be told, and its row would hold the table open until the cap */
    function fire() {
      if (!H || ses.state !== 'starting' || H.fired) return;
      var kids = inLobby().filter(function (s) { return !!s.L && s.L.open; }), info = courseOf(track), rt = 0, used = {}, at, go, n;
      if (!kids.length || !info) { ses.state = 'lobby'; room(); return; }
      H.fired = true; tm.clearTimeout(H.goT);
      kids.forEach(function (s) { rt = Math.max(rt, s.rt); s.st = 'racing'; s.q = -1; });
      H.me.st = 'racing';
      at = now() + clamp(LEAD_MS + 2 * rt, LEAD_MIN, LEAD_MAX);
      go = { t: 'go', r: ++raceNo, at: at, track: track, laps: info.laps, rules: c.rules, layout: typeof info.layoutKey === 'string' ? info.layoutKey : '',
        crew: { pace: crew, n: crew === 'none' ? 0 : Math.max(0, 5 - kids.length) },
        players: [H.me].concat(kids).map(function (s) {     /* two children with one colour: the later seat takes the next free one, for this race only */
          var ci = s.ci;
          while (used[ci]) ci = (ci + 1) % 8;
          used[ci] = true;
          return { seat: s.seat, tag: s.tag, ai: s.ai, ci: ci };
        }) };
      n = H.goMsg = JSON.stringify(go);
      cast(n); later(function () { cast(n); }, GO_GAP_MS); later(function () { cast(n); }, 2 * GO_GAP_MS);   /* a device acts on the first copy only */
      H.sAt = -Infinity; H.resAt = now();
      begin(go, at, info);
      H.relayIv = every(relay, SEND_MS);
      room();
    }
    /* the other rooms, for a starter still waiting alone: after 5, 10 and 20 s, then every
       30 s; only slots below its own, so only the starter in the higher slot is offered the switch */
    /* one schedule per race opened: it stops when that race is given up (unhost) */
    function rescan(i, h0) {
      later(function () {
        if (!H || H !== h0) return;
        var s;
        if (ses.state === 'lobby' && !seated().length) for (s = 1; s < H.slot; s++) look(s, offer);
        rescan(i + 1, h0);
      }, i < RESCAN_MS.length ? RESCAN_MS[i] : RESCAN_EVERY_MS);
    }
    function offer(row) {
      if (!row) return;
      if (looks[row.slot]) { shut(looks[row.slot].L); delete looks[row.slot]; }
      if (row.tag && H && ses.state === 'lobby' && !seated().length) emit('other', row);
    }
    function unhost() {
      var h = H;
      H = null; role = ses.role = null; ses.seat = -1;
      ivals.forEach(function (id) { tm.clearInterval(id); }); ivals = [];
      h.links.forEach(shut);
      try { h.lis.close(); } catch (e) {}
    }

    /* ---------- finding and joining ---------- */
    /* was this room opened by the account its tag points to? Remembered per room and number. */
    function hostOk(tag, slot, r) {
      var key = slot + '|' + r + '|' + tag;
      if (!has(isObj(c.tags) ? c.tags : {}, tag)) return Promise.resolve(false);
      if (has(hostsOk, key)) return Promise.resolve(hostsOk[key]);
      return ask('checkHost', tag, slot, r).then(function (ok) { hostsOk[key] = ok === true; return ok === true; }, function () { return false; });
    }
    /* dial one room, say hello and hand back a row for the list, or null. keep(), when given,
       says whether the answer is still wanted (a search a tap has ended keeps no link). */
    function look(slot, cb, keep) {
      var L = null, settled = false;
      function end(row) {
        if (settled) return;
        settled = true;
        if (L && !(row && row.tag)) shut(L);
        cb(row || null);
      }
      tr.dial(roomId(c.groupKey, slot), findMs).then(function (link) {
        if (dead || settled || (keep && !keep())) { try { link.close(); } catch (e) {} return; }
        L = wire(link, true, false);
        L.onGone = function () { end(null); };
        L.onMsg = function (m) {
          if (settled) return;
          if (m.t === 'no') return end(m.why === 'version' ? { slot: slot, state: 'version' } : null);
          if (m.t !== 'info') return;
          if (m.v !== PROTO || m.rules !== c.rules) return end({ slot: slot, state: 'version' });
          hostOk(m.tag, slot, m.r).then(function (ok) {
            if (!ok || dead || settled || (keep && !keep())) return end(null);
            if (looks[slot]) shut(looks[slot].L);
            looks[slot] = { L: L, info: m };
            L.onGone = null; L.onMsg = null;
            later(function () { if (looks[slot] && looks[slot].L === L) { shut(L); delete looks[slot]; } }, LOOK_MS);
            end({ slot: slot, tag: m.tag, name: nm(m.tag, 0), ai: m.ai, ci: m.ci, track: m.track, trackOk: !!courseOf(m.track), used: m.used, state: m.state });
          });
        };
        send(L, { t: 'hello', v: PROTO, rules: c.rules });
        later(function () { end(null); }, findMs);
      }, function () { end(null); });
    }
    function closeLooks() { for (var k in looks) if (has(looks, k)) shut(looks[k].L); looks = {}; }
    /* a tap on a listed race ends the search: it answers with the rows so far and reports no more */
    function endFind() { var f = F; F = null; if (f) f.done(f.rows); }
    function joinFail(code) {
      var g = G;
      if (!g || !g.no) return;
      G = null; role = ses.role = null; ses.state = 'idle';
      shut(g.L);
      g.no({ code: code });
    }

    /* ---------- a guest ---------- */
    function rdyTry() {    /* 'rdy' goes once the course is built AND the clock has 3 fresh samples */
      if (!G || G.rdySent || !G.rdyTrack || G.rdyTrack !== track || !G.cd.ready(now())) return false;
      G.rdySent = true;
      send(G.L, { t: 'rdy', track: track, hb: G.hb });
      return true;
    }
    /* re-sent every 2 s until a table holds this seat or the session closes; there is no cap */
    function pushFin() {
      if (!G || !G.fin || dead) return;
      send(G.L, G.fin);
      tm.clearTimeout(G.finT);
      G.finT = later(pushFin, FIN_MS);
    }
    function guestTick() {
      var t = now(), quiet = t - G.heard, rt = G.cd.rtt(t), weak = quiet > WEAK_MS;
      if (ses.state === 'lost') return;
      send(G.L, rt === null ? { t: 'p', c: t } : { t: 'p', c: t, rt: Math.min(60000, Math.round(rt)) });
      if (weak !== G.weak) { G.weak = weak; emit('weak', { on: weak }); }
      if (quiet > LOST_MS) lost();
    }
    /* No hub any more. In the lobby the race is simply closed; in a race this child's own
       round carries on alone and the session stays readable (table, ghosts) in 'lost'. */
    function lost() {
      if (dead || !G || ses.state === 'lost') return;
      if (G.no) return joinFail('none');
      if (ses.state === 'lobby') return shutdown('lost');
      ivals.forEach(function (id) { tm.clearInterval(id); }); ivals = [];
      shut(G.L); G.fin = null;
      ask('close').then(null, function () {});
      ses.state = 'lost';
      emit('lost', {}); emit('table', ses.table());
    }
    /* One try to get the same seat back with its token. A dial refused at once ('none': this
       device's own peer, or the room's, is still re-forming with the link-up server) is not
       that try: the dial is made again every second until it links or findMs is up. */
    function guestGone(L) {
      if (dead || !G || G.L !== L) return;
      if (!G.tok || G.tried) return lost();
      var n = ++G.tryN, until = now() + findMs;
      G.tried = true;
      (function dial() {
        tr.dial(roomId(c.groupKey, G.slot), Math.max(1, until - now())).then(function (link) {
          if (dead || !G || ses.state === 'lost' || G.tryN !== n) { try { link.close(); } catch (e) {} return; }
          G.L = wire(link, true, false);
          G.L.onMsg = guestMsg; G.L.onGone = guestGone;
          send(G.L, { t: 'join', tag: me.tag, ai: me.ai, ci: me.ci, tok: G.tok });
          later(function () { if (G && G.tried && G.tryN === n) lost(); }, findMs);
        }, function (err) {
          if (dead || !G || G.tryN !== n) return;
          if (err && err.code === 'none' && now() + REDIAL_MS < until) { later(dial, REDIAL_MS); return; }
          lost();
        });
      })();
    }
    function guestGo(m) {
      var mine = false, info, d, why, i;
      if (m.r <= G.goR) return;                          /* the first copy of each race number only */
      G.goR = m.r;
      for (i = 0; i < m.players.length; i++) if (m.players[i].seat === ses.seat && m.players[i].tag === me.tag) mine = true;
      if (!mine) return;                                 /* still at the results, or joined late: in the next one */
      info = courseOf(m.track); d = G.cd.diff(now());
      why = !info || m.laps !== info.laps || m.rules !== c.rules || m.layout !== (typeof info.layoutKey === 'string' ? info.layoutKey : '') ? 'update'
        : d === null || Math.abs(m.at - (now() + d)) > GO_WINDOW_MS ? 'clock' : '';
      if (why) {                                         /* sit this one out: one neutral message, no reason sent */
        G.fin = { t: 'f', r: m.r, ms: null, P: 0 }; pushFin();
        emit('sitout', { why: why });
        return;
      }
      begin(m, m.at - d, info);
    }
    function guestRes(m) {
      var R = race, i, r, row, st, ms;
      /* the hub has my finish: stop repeating it */
      if (G.fin && m.r === G.fin.r) for (i = 0; i < m.rows.length; i++) if (m.rows[i][0] === ses.seat && m.rows[i][3] !== 'racing' && m.rows[i][3] !== 'gone') G.fin = null;
      if (!R || m.r !== R.r || (R.final && !m.final)) return;                    /* once final, only a final table (a copy, or a late finish taken) */
      for (i = 0; i < m.rows.length; i++) {
        r = m.rows[i]; row = R.rows[r[0]]; st = r[3]; ms = r[1];
        if (!row || ((st === 'racing' || st === 'gone') && row.state !== 'racing' && row.state !== 'gone')) continue;   /* an older copy never undoes a result */
        if (st === 'done' && !(ms >= R.info.floorMs)) st = 'dash';             /* a time under the floor never shows */
        row.state = st; row.ms = st === 'done' ? ms : null; row.laps = Math.max(row.laps, Math.min(r[2], R.info.laps));
      }
      R.final = R.final || m.final;
      emit('table', ses.table());
    }
    function guestMsg(m, L) {
      var t = m.t, R = race, i, k;
      if (!G || L !== G.L) return;
      G.heard = now();
      if (t === 'seat') {
        if (G.ok) { ses.seat = m.seat; ses.state = 'lobby'; G.ok({ seat: m.seat }); G.ok = G.no = null; every(guestTick, PING_MS); guestTick(); }
        else if (m.seat !== ses.seat) return lost();
        G.tok = m.tok; G.tried = false;
        if (G.fin) pushFin();
      } else if (t === 'no') { if (G.no) joinFail(m.why); else if (ses.state === 'lobby') shutdown('closed'); else lost(); }
      else if (ses.seat < 0) return;
      else if (t === 'q') { G.cd.add(m.c, m.h, now()); rdyTry(); }
      else if (t === 'room') {
        if (m.q <= G.rq) return;
        G.rq = m.q; crew = m.crew;
        if (m.track !== track) { track = m.track; G.rdySent = false; }
        for (i = 0; i < m.players.length; i++) {
          k = m.players[i];
          if (k.seat !== ses.seat) continue;
          if (!k.rdy) { G.rdySent = false; rdyTry(); }                               /* my 'rdy' has not arrived: say it again */
          if (k.st === 'results' && ses.state === 'lobby') send(G.L, { t: 'back' }); /* and so has my 'back' (or I sat the race out) */
        }
        showRoom(m);
      } else if (t === 'go') guestGo(m);
      else if (t === 'S') {
        if (!R || m.r !== R.r || m.q <= G.sq) return;
        G.sq = m.q;
        for (i = 0; i < m.k.length; i++) { k = m.k[i]; if (R.bufs[k[0]] && k[2] <= R.maxP) R.bufs[k[0]].add(m.q, k[1], k[2], k[3], k[4], k[5]); }
      } else if (t === 'res') guestRes(m);
      else if (t === 'rematch') emit('rematch', {});
      else if (t === 'end') {
        if (m.rows) guestRes({ t: 'res', r: m.r, final: true, rows: m.rows });   /* the final table came with it */
        shutdown('closed');
      }
    }

    /* ---------- closing ---------- */
    function shutdown(why) {
      if (dead) return;
      dead = true;
      var links = (H ? H.links : []).concat(G && G.L ? [G.L] : []), no = G && G.no, lis = H ? H.lis : null, end = H ? H.end : '', wait = end ? seated() : [], t0 = now(), k;
      for (k in looks) if (has(looks, k)) links.push(looks[k].L);
      looks = {};
      ivals.forEach(function (id) { tm.clearInterval(id); });
      /* The links close once what was just sent has had time to leave. After a starter's 'end'
         each guest's link stays open until that guest closes it (it does on 'end'), with 'end'
         sent again every second meanwhile, for 10 s at most. The room closes with the links, not
         before: closing it (destroying its PeerJS peer) would cut them. Meanwhile a caller is
         turned away at once (onCaller), and the ticket is already gone. */
      (function out(ms) {
        tm.setTimeout(function () {
          var open = wait.filter(function (s) { return s.L && s.L.open; });
          if (open.length && now() - t0 < END_MS) { open.forEach(function (s) { send(s.L, end); }); return out(END_GAP_MS); }
          links.forEach(shut);
          if (lis) { try { lis.close(); } catch (e) {} }
          try { tr.close(); } catch (e) {}
        }, ms);
      })(GRACE_MS);
      ask('close').then(null, function () {});
      ses.state = 'closed';
      if (no) { G.ok = G.no = null; no({ code: 'closed' }); }
      emit('closed', { why: why });
    }

    /* ---------- the API ---------- */
    ses.on = function (name, fn) { if (typeof fn === 'function') (on[name] = on[name] || []).push(fn); return ses; };
    /* Look in the 3 rooms. onRow gets {slot, tag, name, ai, ci, track, trackOk, used, state:
       'lobby' | 'racing' | 'full'} for each race whose starter's ticket checks out, or {slot,
       state: 'version'} when a device there needs the update. trackOk is false for a course
       this device does not have. Resolves with the rows when all three have answered or timed
       out, or with the rows so far when a tap on one of them (join) ends the search; rejects
       {code: 'unreachable'} with no link-up server. */
    ses.find = function (onRow) {
      if (dead || ses.state !== 'idle') return Promise.reject({ code: 'busy' });
      closeLooks();
      ses.state = 'finding';
      return Promise.resolve().then(function () { return tr.open(); }).then(function () {
        return new Promise(function (resolve) {
          var f = F = { rows: [], done: resolve }, left = SLOTS, slot;
          function mine() { return F === f; }
          function got(row) {
            if (!mine()) return;
            if (row) { f.rows.push(row); if (typeof onRow === 'function') { try { onRow(row); } catch (e) {} } }
            if (--left > 0 || !mine()) return;
            F = null;
            if (ses.state === 'finding') ses.state = 'idle';
            resolve(f.rows);
          }
          for (slot = 1; slot <= SLOTS; slot++) look(slot, got, mine);
        });
      }, function () { if (ses.state === 'finding') ses.state = 'idle'; throw { code: 'unreachable' }; });
    };
    /* Open a race in the first free room. Resolves {slot}; rejects {code: 'full'} when all
       three rooms are taken, 'ticket' when the ticket cannot be written, 'unreachable', 'track'. */
    ses.host = function (o) {
      var want = isObj(o) ? o : {};
      if (dead || ses.state !== 'idle') return Promise.reject({ code: 'busy' });
      if (!courseOf(want.track)) return Promise.reject({ code: 'track' });
      closeLooks();
      ses.state = 'finding'; track = want.track; crew = PACES.indexOf(want.crew) >= 0 ? want.crew : 'gentle';
      function claim(slot) {
        if (slot > SLOTS) return Promise.reject({ code: 'full' });
        return tr.listen(roomId(c.groupKey, slot), onCaller).then(function (lis) { return { lis: lis, slot: slot }; },
          function (err) { if (err && err.code === 'taken') return claim(slot + 1); throw { code: 'unreachable' }; });
      }
      H = { open: false, lis: null, slot: 0, r: '', seats: [null, null, null, null, null], links: [], lookers: 0, rq: 0, sq: 0, sAt: -Infinity, roomAt: 0, resAt: 0, fired: false, goT: null, relayIv: null, end: '', goMsg: '', tickAt: 0,
        me: { seat: 0, tag: me.tag, ai: me.ai, ci: me.ci, st: 'lobby', rdy: false, hb: false, weak: false } };
      return Promise.resolve().then(function () { return tr.open(); }).then(function () { return claim(1); }, function () { throw { code: 'unreachable' }; }).then(function (got) {
        if (dead) { try { got.lis.close(); } catch (e) {} throw { code: 'busy' }; }
        H.lis = got.lis; H.slot = got.slot; H.r = nonce();
        return ask('open', got.slot, H.r).then(function () {
          if (dead) throw { code: 'busy' };
          role = ses.role = 'host'; ses.seat = 0; ses.slot = H.slot; ses.state = 'lobby'; H.open = true;
          H.links.forEach(function (L) { if (L.wait && L.open) hello(L.wait, L); });
          H.tickAt = now();
          every(hostTick, PING_MS);
          rescan(0, H);
          room();
          return { slot: H.slot };
        }, function () { try { got.lis.close(); } catch (e) {} throw { code: 'ticket' }; });
      }).then(null, function (err) { if (!dead && ses.state === 'finding') { H = null; ses.state = 'idle'; } throw err; });
    };
    /* Take a seat in a race from the list. Resolves {seat}; rejects {code: 'full' | 'closed' |
       'version' | 'ticket' | 'none' | 'timeout'}. A starter still waiting alone may call it to
       take the other race instead. While the search is still on, a race it has listed (its
       link is open) is joined at once and the search ends there; any other race rejects
       {code: 'busy'} until the search is over. */
    ses.join = function (row) {
      var slot = isObj(row) ? row.slot : 0, alone = role === 'host' && ses.state === 'lobby' && !seated().length, early;
      if (dead || !(slot >= 1 && slot <= SLOTS)) return Promise.reject({ code: 'busy' });
      early = !!F && ses.state === 'finding' && has(looks, slot) && looks[slot].L.open;
      if (ses.state !== 'idle' && !alone && !early) return Promise.reject({ code: 'busy' });
      if (alone) unhost();
      if (early) endFind();
      ses.state = 'finding';
      return Promise.resolve().then(function () { return tr.open(); }).then(function () {
        return looks[slot] && looks[slot].L.open ? looks[slot] : new Promise(function (res, rej) {
          look(slot, function (r) { if (r && looks[slot]) res(looks[slot]); else rej({ code: r ? 'version' : 'none' }); });
        });
      }, function () { throw { code: 'unreachable' }; }).then(function (lk) {
        return ask('prove', lk.info.h).then(function () {
          return new Promise(function (res, rej) {
            if (dead || !lk.L.open) return rej({ code: 'none' });
            delete looks[slot]; closeLooks();
            role = ses.role = 'guest'; ses.slot = slot;
            G = { L: lk.L, slot: slot, tok: '', cd: ClockDiff(), heard: now(), rq: -1, sq: -1, q: 0, goR: -1, fin: null, finT: null, rdyTrack: '', hb: false, rdySent: false,
              weak: false, tried: false, tryN: 0, ok: res, no: rej };
            lk.L.onMsg = guestMsg; lk.L.onGone = guestGone;
            send(lk.L, { t: 'join', tag: me.tag, ai: me.ai, ci: me.ci });
            later(function () { joinFail('timeout'); }, findMs);
          });
        }, function () { throw { code: 'ticket' }; });
      }).then(null, function (err) { if (!dead && ses.state === 'finding') ses.state = 'idle'; throw err; });
    };
    /* Leaving on purpose. A starter closes the race for everyone ('end', with the final table
       in it when there is one; the session reads 'closed' at once, and its links close as
       each guest closes its own); a guest still driving first sends the one neutral 'didn't finish'. */
    ses.leave = function (why) {
      if (dead) return;
      why = typeof why === 'string' ? why : 'left';
      if (role === 'host' && H) return endRace(why);
      if (G && ses.state !== 'lost') {
        if (race && !race.mine && rowOpen(ses.seat)) send(G.L, { t: 'f', r: race.r, ms: null, P: 0 });
        send(G.L, { t: 'bye' });
      }
      shutdown(why);
    };
    /* The starter's screen goes away (back to the island, out of game time) while others
       are still driving: keep passing messages on with no screen until the table is final,
       then send 'end' (which carries that table) and close. Anything else is a plain leave. */
    ses.detach = function () {
      if (role !== 'host' || !race || race.final || dead) return ses.leave('left');
      on = {};
      ses.state = 'detached';
      if (rowOpen(0)) decide(0, null, 0); else sendRes();
    };
    ses.setTrack = function (id) {
      if (role !== 'host' || ses.state !== 'lobby' || !courseOf(id)) return false;
      if (id !== track) { track = id; H.me.rdy = false; seated().forEach(function (s) { s.rdy = false; }); }
      room();
      return true;
    };
    ses.setCrew = function (pace) {
      if (role !== 'host' || ses.state !== 'lobby' || PACES.indexOf(pace) < 0) return false;
      crew = pace; room();
      return true;
    };
    /* this device has built the course (and says whether the child has a best on it) */
    ses.ready = function (id, hasBest) {
      if (dead || !id || id !== track) return false;
      if (role === 'host') { H.me.rdy = true; H.me.hb = !!hasBest; room(); tryGo(); return true; }
      if (!G || ses.seat < 0) return false;
      G.rdyTrack = id; G.hb = !!hasBest; G.rdySent = false;
      rdyTry();
      return true;
    };
    /* the page came back to the front: measure the clock difference afresh */
    ses.resync = function () { if (G) G.cd.reset(); };
    /* The starter pressed Start. GO follows as soon as every device in the lobby is ready,
       and after 8 s whoever is not. */
    ses.start = function () {
      if (role !== 'host' || ses.state !== 'lobby' || !inLobby().length) return false;
      ses.state = 'starting'; H.fired = false;
      room(); tryGo();
      tm.clearTimeout(H.goT);
      H.goT = later(fire, READY_WAIT_MS);
      return true;
    };
    /* my kart, at most 10 times a second: race clock (s), distance along the course (px),
       sideways offset (px), speed (px/s) and the view flags */
    ses.sendState = function (T, P, lat, v, flags) {
      var R = race, t = now();
      if (dead || !R || !fin(T) || !fin(P) || !fin(lat) || !fin(v)) return false;
      if (ses.state === 'starting') ses.state = 'racing';
      if ((ses.state !== 'racing' && ses.state !== 'results' && ses.state !== 'detached') || t - sentAt < SEND_MS) return false;
      sentAt = t;
      T = clamp(T, 0, 1800); P = clamp(P, -200, R.maxP); lat = clamp(lat, -(WALL + 5), WALL + 5); v = clamp(v, -120, 360); flags = isInt(flags) ? flags & 127 : 0;
      if (role === 'host') { note(0, 0, T, P, lat, v, flags); relay(); }
      else send(G.L, { t: 's', r: R.r, q: ++G.q, T: r2(T), P: r1(P), l: r1(lat), v: Math.round(v), f: flags });
      return true;
    };
    /* my finish time in ms, or null for 'didn't finish' (no game time, left, stopped): once per race */
    ses.sendFinish = function (ms, P) {
      var R = race;
      if (!R || R.mine) return false;
      ms = isInt(ms) && ms >= 0 && ms <= 1800000 ? ms : null;
      P = fin(P) ? clamp(P, -200, R.maxP) : 0;
      R.mine = { ms: ms, state: ms === null ? 'dnf' : 'done' };
      if (dead || ses.state === 'lost') { emit('table', ses.table()); return true; }
      if (role === 'host') { if (ses.state !== 'detached') ses.state = 'results'; decide(0, ms, P); }
      else { ses.state = 'results'; G.fin = { t: 'f', r: R.r, ms: ms, P: r1(P) }; pushFin(); emit('table', ses.table()); }
      return true;
    };
    /* After the results. The starter may go back (and so offer a rematch) only when the
       table is final: nobody still driving is left out. Returns false when refused. */
    ses.backToLobby = function () {
      if (dead || ses.state !== 'results') return false;
      if (role === 'host') {
        if (!race || !race.final) return false;
        ses.state = 'lobby'; H.me.st = 'lobby'; H.fired = false;
        cast({ t: 'rematch' }); room();
        return true;
      }
      ses.state = 'lobby';
      send(G.L, { t: 'back' });
      G.rdySent = false; rdyTry();
      return true;
    };
    /* the other children's karts at my race clock T (s): a reused array, one entry per child */
    ses.ghosts = function (T) {
      var R = race, cut = role !== 'host' && (dead || ses.state === 'lost'), quiet = !!G && now() - G.heard > WEAK_MS, i, g, o, row, open;
      if (!R) { ghosts.length = 0; return ghosts; }
      for (i = 0; i < ghosts.length; i++) {
        g = ghosts[i]; o = R.bufs[g.seat].at(T); row = R.rows[g.seat]; open = row.state === 'racing';
        g.P = o.P; g.lat = o.lat; g.v = o.v; g.flags = o.flags;
        g.finishMs = row.state === 'done' ? row.ms : null;
        g.weak = open && (o.weak || quiet || cut);
        g.gone = row.state === 'gone' || row.state === 'dnf' || (open && (o.gone || cut));
      }
      return ghosts;
    };
    /* Finished rows first, by time, with a shared place for equal times; then everyone
       without a time, with no place number. Crew rows (seat 5 and up) carry their fixed
       times. waitingFor names the other children still driving. */
    ses.table = function () {
      var R = race, rows = [], wait = [], cut = role !== 'host' && (dead || ses.state === 'lost'), i, p, row, st, ms, mine;
      if (!R) return { final: false, waitingFor: wait, rows: rows };
      for (i = 0; i < R.players.length; i++) {
        p = R.players[i]; row = R.rows[p.seat]; st = row.state; ms = row.ms; mine = p.seat === ses.seat;
        if (mine && R.mine && (st === 'racing' || st === 'gone')) { st = R.mine.state; ms = R.mine.ms; }   /* my own finish, until the hub's table has it */
        if (!mine && cut && st === 'racing') st = 'gone';
        if (!mine && st === 'racing') wait.push(nm(p.tag, p.seat));
        rows.push({ seat: p.seat, kind: mine ? 'me' : 'kid', name: nm(p.tag, p.seat), ai: p.ai, ci: p.ci, ms: ms, laps: st === 'done' ? R.info.laps : row.laps, place: null, state: st });
      }
      for (i = 0; i < R.crewMs.length; i++) rows.push({ seat: GUESTS + 1 + i, kind: 'crew', name: 'Glow Crew', ai: -1, ci: -1, ms: R.crewMs[i], laps: R.info.laps, place: null, state: 'done' });
      rows.sort(function (a, b) { return (a.ms === null) - (b.ms === null) || (a.ms === null ? b.laps - a.laps : a.ms - b.ms) || a.seat - b.seat; });
      for (i = 0; i < rows.length && rows[i].ms !== null; i++) rows[i].place = i && rows[i - 1].ms === rows[i].ms ? rows[i - 1].place : i + 1;
      return { final: R.final || (cut && !!R.mine), waitingFor: wait, rows: rows };
    };
    return ses;
  }

  /* ---------- the PeerJS adapter ---------- */
  /* The only code that touches PeerJS. Links are opened with serialization 'raw' and carry
     JSON text; no 'call' handler is ever registered. With relayOnly the options are a deep
     copy with config.iceTransportPolicy = 'relay' (inside config, where PeerJS reads it),
     and a link stays open only if the candidate pair it actually chose is a relay at both
     ends: there is no quiet fall-back to a direct link.
       open() → Promise                        my own peer on the link-up server (8 s watchdog, one retry)
       listen(id, onLink) → Promise<{close}>   rejects {code: 'taken' | 'unreachable'}
       dial(id, ms) → Promise<link>            rejects {code: 'none' | 'timeout' | 'relay'}
       link: {send(text), onMessage(fn), onClose(fn), close()}
       onDown(fn(why)), close(), relayOnly */
  function peerTransport(Peer, peerOpts, o) {
    var relay = isObj(o) && o.relayOnly === true;
    var tm = isObj(o) && o.timers ? o.timers : { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); } };
    var opts = relay ? JSON.parse(JSON.stringify(peerOpts || {})) : peerOpts;
    var mine = null, opening = null, peers = [], down = [], waiting = {}, closed = false;
    if (relay) { if (!isObj(opts.config)) opts.config = {}; opts.config.iceTransportPolicy = 'relay'; }

    function tell(why) { for (var i = 0; i < down.length; i++) { try { down[i](why); } catch (e) {} } }
    /* one link. Messages that arrive before the session listens are held, not missed. */
    function wrap(conn) {
      var fn = null, held = [], gone = [], open = true;
      function end() { var i; if (!open) return; open = false; for (i = 0; i < gone.length; i++) { try { gone[i](); } catch (e) {} } }
      conn.on('data', function (d) { if (!open) return; if (fn) fn(d); else if (held.length < 16) held.push(d); });
      conn.on('close', end);
      conn.on('error', end);
      return {
        send: function (text) { if (open) { try { conn.send(text); } catch (e) {} } },
        onMessage: function (f) { var h = held, i; fn = f; held = []; for (i = 0; i < h.length; i++) f(h[i]); },
        onClose: function (f) { gone.push(f); },
        close: function () { if (!open) return; open = false; try { conn.close(); } catch (e) {} }
      };
    }
    /* with relayOnly: is the pair in use a relay at both ends? A pair the browser has not
       reported yet is looked for twice more, 0.3 s apart; anything unreadable counts as no. */
    function relayed(conn, n) {
      if (!relay) return Promise.resolve(true);
      try {
        return Promise.resolve(conn.peerConnection.getStats()).then(function (rep) {
          var by = {}, pairId = null, pair = null, a, b;
          rep.forEach(function (s) { if (isObj(s)) { by[s.id] = s; if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId; } });
          if (pairId) pair = by[pairId];
          if (!pair) rep.forEach(function (s) { if (!pair && isObj(s) && s.type === 'candidate-pair' && (s.selected === true || (s.nominated === true && s.state === 'succeeded'))) pair = s; });
          a = pair && by[pair.localCandidateId]; b = pair && by[pair.remoteCandidateId];
          if (a && b) return a.candidateType === 'relay' && b.candidateType === 'relay';
          if ((n || 1) >= STATS_TRIES) return false;
          return new Promise(function (res) { tm.setTimeout(res, STATS_MS); }).then(function () { return relayed(conn, (n || 1) + 1); });
        }, function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    }
    /* The link-up server dropped this peer: ask for the same id again 2.5 s later, and again
       2.5 s after each try that fails, 8 tries in all, then say so once. One schedule per peer:
       the tries are counted across its 'disconnected' events (PeerJS sends one for every try
       that fails) and start again from nothing only once it is back ('open'). Never a try
       straight from the event: a link-up server that refuses at once would be asked back to back. */
    function keep(p) {
      var tries = 0, wait = null, told = false;
      p.on('open', function () { tries = 0; told = false; });
      p.on('disconnected', function () {
        if (wait || closed || p.destroyed) return;
        if (tries >= KEEP_TRIES) { if (!told) { told = true; tell('broker'); } return; }
        wait = tm.setTimeout(function () {
          wait = null;
          if (closed || p.destroyed || !p.disconnected) return;
          tries++;
          try { p.reconnect(); } catch (e) {}
        }, KEEP_MS);
      });
    }
    /* a peer on the link-up server: 8 s watchdog, then one retry */
    function boot(id) {
      return new Promise(function (resolve, reject) {
        var tries = 0;
        (function attempt() {
          var p = id ? new Peer(id, opts) : new Peer(opts), done = false;
          var w = tm.setTimeout(function () {
            if (done) return;
            done = true;
            try { p.destroy(); } catch (e) {}
            if (++tries < 2 && !closed) attempt(); else reject({ code: 'unreachable' });
          }, BROKER_MS);
          p.on('open', function () {
            if (done) return;
            done = true; tm.clearTimeout(w);
            /* closed while it was still booting: no one will ever destroy it but us */
            if (closed) { try { p.destroy(); } catch (e) {} reject({ code: 'unreachable' }); return; }
            peers.push(p); keep(p); resolve(p);
          });
          p.on('error', function (err) {
            var type = err && err.type, text = String((err && err.message) || ''), k;
            if (type === 'peer-unavailable') { for (k in waiting) if (has(waiting, k) && text.indexOf(k) >= 0) waiting[k](); return; }   /* a dial to an empty room */
            if (done) return;
            done = true; tm.clearTimeout(w);
            try { p.destroy(); } catch (e) {}
            reject({ code: type === 'unavailable-id' ? 'taken' : 'unreachable' });
          });
        })();
      });
    }
    return {
      relayOnly: relay,
      open: function () {
        if (closed) return Promise.reject({ code: 'unreachable' });
        if (!opening) opening = boot(null).then(function (p) { mine = p; }, function (err) { opening = null; throw err; });
        return opening;
      },
      listen: function (id, onLink) {
        return boot(id).then(function (p) {
          p.on('connection', function (conn) {
            var link = wrap(conn);
            conn.on('open', function () {
              if (closed || conn.serialization !== 'raw') { link.close(); return; }       /* a hub closes any link that is not raw */
              relayed(conn).then(function (ok) { if (ok && !closed) onLink(link); else { link.close(); if (!ok) tell('relay'); } });
            });
          });
          return { close: function () { try { p.destroy(); } catch (e) {} } };
        });
      },
      dial: function (id, ms) {
        return new Promise(function (resolve, reject) {
          var conn = null, link = null, done = false, w = null;
          function fail(code) {
            if (done) return;
            done = true; tm.clearTimeout(w); delete waiting[id];
            if (link) link.close();
            reject({ code: code });
          }
          if (!mine || closed) return reject({ code: 'none' });
          try { conn = mine.connect(id, { serialization: 'raw' }); } catch (e) { conn = null; }
          if (!conn) return reject({ code: 'none' });
          link = wrap(conn);
          waiting[id] = function () { fail('none'); };
          w = tm.setTimeout(function () { fail('timeout'); }, ms);
          conn.on('open', function () {
            relayed(conn).then(function (ok) {
              if (done) return;
              if (!ok) { tell('relay'); return fail('relay'); }
              done = true; tm.clearTimeout(w); delete waiting[id];
              resolve(link);
            });
          });
          conn.on('error', function () { fail('none'); });
        });
      },
      onDown: function (fn) { if (typeof fn === 'function') down.push(fn); },
      close: function () { closed = true; peers.forEach(function (p) { try { p.destroy(); } catch (e) {} }); peers = []; mine = null; }
    };
  }

  var API = {
    PROTO: PROTO, PACES: PACES, VCAP: VCAP, WALL: WALL, MAX_CHARS: MAX_CHARS,
    roomId: roomId, ticketC: ticketC, check: check, ClockDiff: ClockDiff, GhostBuf: GhostBuf, evidence: evidence, hostVerdict: hostVerdict,
    create: create, peerTransport: peerTransport
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLKartNet = API;
})();
