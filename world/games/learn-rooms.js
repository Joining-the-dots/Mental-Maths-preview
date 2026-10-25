/* ================================================================
   The four learning challenges (Flags, Times Tables, Debate and the
   1% Challenge): who a child may challenge, and where the room is
   (window.SLLearnRooms). Classic UMD: module.exports in Node. No DOM,
   no browser storage. index.html loads it, with social-core.js, the
   first time a child taps 🤝 Challenge a friend.

   V4.55 (James, 24 Oct 2026: family and class only). Rooms live only
   inside a family or a class a grown-up set up, as Race together's do:
   the room's address hashes that group's race key with the game and
   the code word, so a code word on its own finds nothing, and a device
   that cannot read the race key can neither open nor join a room. A
   class room, and a family room whose grown-up said some devices are
   in other homes, links through the relay only.

   open() asks the cloud afresh, in this order: the family record (so
   the grown-up's tick is current; it is handed to the page as well),
   the child's kids record and the class it names, then, for each group
   the child may play in, its race key and the roster of shown names
   the grown-up approved: the child must be on it. A group whose key
   cannot be read is left out. Who may play is the rule Race together
   and the island challenges use: ticked by the family's grown-up with
   a password of its own, and races on in the family, or in a class
   that is open and has the child in it. Race keys are kept in this
   file's memory only, never handed out, and wiped by close(), a
   profile switch and a sign-out.

   While a challenge is open, watch() reads the group's race key again
   every 45 seconds. The security rules refuse that read once a grown-up
   unticks the child, switches races off or closes the class, and 'New
   race key' changes it, so a challenge being played ends within about
   a minute. A profile switch or a sign-out ends it within a second.

   Nothing here writes anywhere, sends anything to another device or
   touches points. Names never travel: the games show 'Friend'.

     GAMES, KINDS, T, KEY_RE, WORD_RE
     roomText(kind, key, game, word)   'sl-learn1|kind|key|game|WORD' (throws on bad input)
     roomId(kind, key, game, word)     'ttq-lc-…', the room's address on the link-up server
     peerOpts(base, relay)             a copy of the PeerJS options; relay → config.iceTransportPolicy 'relay'
     open(env)                         Promise → {groups: [{kind, label, relay}]}; rejects {code, text}:
                                       offline, notfamily, notswitched, check
     groups()                          the groups of the open lobby (no keys), [] when there is none
     room(kind, game, word)            that group's room address (throws when it has no key)
     relay(kind)                       true when that group links through the relay only
     watch(kind, onEnd)                → stop(); onEnd({code: 'ended' | 'switched', text}) at most once
     alive()                           a lobby is open for the same signed-in profile
     close()                           forget the keys, stop every watch (no onEnd)
     env (test seam)                   firebase, cloudState, applyFamilyCfg, SC, now, timers, profile, online
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays, with its open lobby */
  if (typeof window !== 'undefined' && window.SLLearnRooms) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLLearnRooms;
    return;
  }
  var W = typeof window !== 'undefined' ? window : null;
  var NODE = typeof module === 'object' && !!module.exports && typeof require === 'function';

  var CALL_MS = 8000, WATCH_MS = 45000, BOUND_MS = 1000;
  var KEY_RE = /^[0-9a-f]{32}$/, FAM_RE = /^[A-Za-z0-9_-]{1,40}$/, WORD_RE = /^[A-Z0-9]{4}$/;
  var GAMES = ['flags', 'tt', 'debate', 'onepct'];
  var KINDS = ['family', 'class'];

  /* every line a child sees from this file: UK English, kind, no names */
  var T = {
    offline: 'Challenges need the internet.',
    notfamily: 'Challenges are for family logins. Ask a grown-up to sign you in.',
    notswitched: 'Ask your grown-up to switch on challenges in the Control Centre.',
    check: 'Can’t check who you can play with just now. Try again.',
    checking: 'Checking who you can play with…',
    ended: 'This challenge has stopped: a grown-up changed who can play.',
    switched: 'This challenge has stopped: the player on this device changed.',
    family: '🏠 Family'
  };

  var M = null;          /* the open lobby: {e, S, pk, who, uid, groups: [{kind, label, relay, ref, key}], watches} */
  var authOn = null;

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function why(code) { return { code: code, text: T[code] }; }
  function refused(x) { return !!x && x.code === 'permission-denied'; }
  function need(name, file) {
    if (W && W[name]) return W[name];
    if (NODE) { try { return require(file); } catch (x) {} }
    return null;
  }

  /* ---------- the room address ---------- */
  /* FNV-1a, 32 bits, whole-number maths (kart-net's own), so every browser and Node agree */
  function fnv(text, h) {
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function bad(text) { var x = new Error(text); x.code = 'invalid'; return x; }
  function roomText(kind, key, game, word) {
    if (KINDS.indexOf(kind) < 0) throw bad('A challenge room is a family or a class room.');
    if (typeof key !== 'string' || !KEY_RE.test(key)) throw bad('A challenge room needs its group\'s race key.');
    if (GAMES.indexOf(game) < 0) throw bad('Unknown challenge game.');
    if (typeof word !== 'string' || !WORD_RE.test(word)) throw bad('A code word is four capital letters or digits.');
    return 'sl-learn1|' + kind + '|' + key + '|' + game + '|' + word;
  }
  /* two hashes of the room text: nothing in the address names the family, the class or the word */
  function roomId(kind, key, game, word) {
    var text = roomText(kind, key, game, word);
    return 'ttq-lc-' + fnv(text, 0x811c9dc5).toString(36) + fnv(text, 0x01234567).toString(36);
  }
  /* a deep copy, so the page's own options are never changed; the relay rule goes inside
     config, where PeerJS reads it */
  function peerOpts(base, relay) {
    var o = {};
    try { o = JSON.parse(JSON.stringify(isObj(base) ? base : {})); } catch (x) { o = {}; }
    if (relay === true) { if (!isObj(o.config)) o.config = {}; o.config.iceTransportPolicy = 'relay'; }
    return o;
  }

  /* ---------- the page around us (env replaces any part) ---------- */
  function envOf(given) {
    var g = isObj(given) ? given : {}, nav = typeof navigator !== 'undefined' ? navigator : null;
    function pick(k, d) { return has(g, k) ? g[k] : d; }
    var on = pick('online', nav ? nav.onLine !== false : true);
    return {
      firebase: pick('firebase', W && W.firebase ? W.firebase : null), cloudState: pick('cloudState', W ? W.cloudState : null),
      applyFamilyCfg: pick('applyFamilyCfg', W ? W.slFamilyCfgApply : null),
      SC: pick('SC', need('SLSocialCore', './social-core.js')),
      now: pick('now', function () { return Date.now(); }),
      timers: pick('timers', { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); },
        setInterval: function (f, ms) { return setInterval(f, ms); }, clearInterval: function (id) { clearInterval(id); } }),
      profile: pick('profile', activeProfile),
      online: typeof on === 'function' ? !!on() : !!on
    };
  }
  /* the profile now playing, from the app's own state: {name} */
  function activeProfile() {
    var st = typeof state !== 'undefined' ? state : null, n = st ? st.activeUser : null;
    return st && st.users && typeof n === 'string' && has(st.users, n) ? { name: n } : null;
  }
  function profileOf(e) {
    var p = null;
    try { p = typeof e.profile === 'function' ? e.profile() : e.profile; } catch (x) { p = null; }
    return isObj(p) ? p : null;
  }
  function fbReady(e) { var f = e.firebase; return !!f && typeof f.firestore === 'function' && (!f.apps || f.apps.length > 0); }
  /* SLSocialCore.bound with the profile now playing as both the active profile and the one
     the lobby was opened for: a second local profile on a shared tablet is not bound */
  function boundEnv(e, pk) {
    var p = profileOf(e);
    return { firebaseReady: fbReady(e), cloudState: e.cloudState, activeUser: p ? p.name : null, profileKey: pk };
  }
  /* a database call that takes over 8 seconds counts as failed */
  function call(e, fn) {
    var tm = e.timers;
    return new Promise(function (res, rej) {
      var t = tm.setTimeout(function () { rej({ code: 'timeout' }); }, CALL_MS);
      Promise.resolve().then(fn).then(function (v) { tm.clearTimeout(t); res(v); }, function (x) { tm.clearTimeout(t); rej(x); });
    });
  }
  /* still the lobby that is open, for the same signed-in profile? */
  function aliveM(m) {
    if (!m || M !== m) return false;
    try { return m.S.cacheKey(boundEnv(m.e, m.pk)) === m.who; } catch (x) { return false; }
  }
  /* a change of the signed-in account forgets everything at once */
  function hookAuth(e) {
    var f = e.firebase;
    if (authOn === f || !f || typeof f.auth !== 'function') return;
    authOn = f;
    try { f.auth().onAuthStateChanged(function (user) { if (M && (user && user.uid ? user.uid : '') !== M.uid) shut(true); }); } catch (x) {}
  }

  /* ---------- open: the groups this child may challenge in ---------- */
  /* the class named in the child's own kids record, when its races are on, it is open and the
     child is in it. Of the class only its code is used, as a label ('Otter class'). A read that
     fails leaves the class out. */
  function classOf(m, db, famRef) {
    var S = m.S;
    if (S.ON && S.ON.classes === false) return Promise.resolve(null);
    return call(m.e, function () { return famRef.collection('kids').doc(m.uid).get(); }).then(function (s) {
      var d = s && s.exists ? s.data() : null, id = d && typeof d.cls === 'string' ? d.cls : '', label = S.classLabel(id), c;
      if (!label) return null;
      c = db.collection('classes').doc(id);
      return call(m.e, function () { return Promise.all([c.collection('members').doc(m.uid).get(), c.get()]); }).then(function (got) {
        var k = got[1] && got[1].exists ? got[1].data() : null;
        return got[0] && got[0].exists && k && k.race === true && k.closed === false ? { kind: 'class', label: label, relay: true, ref: c, key: '' } : null;
      });
    }).then(null, function () { return null; });
  }
  /* the group's race key and roster, read afresh. → the group with its key; null when the
     rules refuse, there is no key or the child is not on the roster; false when a read failed */
  function keyed(m, g) {
    var priv = g.ref.collection('private');
    return call(m.e, function () { return Promise.all([priv.doc('games').get(), priv.doc('roster').get()]); }).then(function (got) {
      var S = m.S, k = got[0] && got[0].exists ? got[0].data() : null, tags;
      var key = k && typeof k.raceKey === 'string' && KEY_RE.test(k.raceKey) ? k.raceKey : '';
      if (!key) return null;
      tags = S.tagMap(key, got[1] && got[1].exists ? got[1].data() : null);
      if (!has(tags, S.seatTag(key, m.uid)) || tags[S.seatTag(key, m.uid)] !== m.uid) return null;
      g.key = key;
      return g;
    }, function (x) { return refused(x) ? null : false; });
  }
  function pub(g) { return { kind: g.kind, label: g.label, relay: g.relay === true }; }
  function open(given) {
    var e, S, pk, benv, b, m, db, famRef;
    try {
      e = envOf(given); S = e.SC;
      shut(false);
      if (!S || !e.online || !fbReady(e)) return Promise.reject(why('offline'));
      pk = (profileOf(e) || {}).name || null;
      benv = boundEnv(e, pk);
      b = S.bound(benv);
      if (!b.ok) return Promise.reject(why(b.why === 'nofirebase' ? 'offline' : 'notfamily'));
      if (!FAM_RE.test(b.familyCode)) return Promise.reject(why('notfamily'));
      if (S.ON && S.ON.race === false) return Promise.reject(why('notswitched'));
      db = e.firebase.firestore();
      famRef = db.collection('families').doc(b.familyCode);
    } catch (x) { return Promise.reject(why('offline')); }
    m = M = { e: e, S: S, pk: pk, who: S.cacheKey(benv), uid: b.uid, groups: [], watches: [] };
    hookAuth(e);
    return call(e, function () { return famRef.get(); }).then(function (s) {
      var fam = s && s.exists ? s.data() : null, g, list = [];
      if (!aliveM(m)) throw why('notfamily');
      if (fam && typeof e.applyFamilyCfg === 'function') { try { e.applyFamilyCfg(fam); } catch (x) {} }
      if (!fam || !S.memberOk(fam, m.uid)) throw why('notswitched');
      g = S.gamesCfg(fam);
      if (g.race) list.push({ kind: 'family', label: T.family, relay: g.relay === true, ref: famRef, key: '' });
      return classOf(m, db, famRef).then(function (c) { if (c) list.push(c); return list; });
    }).then(function (list) {
      if (!list.length) throw why('notswitched');
      return Promise.all(list.map(function (g) { return keyed(m, g); }));
    }).then(function (res) {
      var ok = res.filter(function (g) { return !!g && !!g.key; });
      if (!aliveM(m)) throw why('notfamily');
      if (!ok.length) throw why(res.indexOf(false) >= 0 ? 'check' : 'notswitched');
      m.groups = ok;
      return { groups: ok.map(pub) };
    }).then(null, function (x) {
      if (M === m) shut(false);
      throw x && typeof x.code === 'string' && has(T, x.code) && x.text === T[x.code] ? x : why('check');
    });
  }

  /* ---------- what the page asks while a lobby is open ---------- */
  function groupOf(m, kind) {
    if (!aliveM(m)) return null;
    for (var i = 0; i < m.groups.length; i++) if (m.groups[i].kind === kind && m.groups[i].key) return m.groups[i];
    return null;
  }
  function groups() { return aliveM(M) ? M.groups.map(pub) : []; }
  function room(kind, game, word) {
    var g = groupOf(M, kind);
    if (!g) throw bad('No challenge room without a group.');
    return roomId(kind, g.key, game, word);
  }
  function relay(kind) { var g = groupOf(M, kind); return !g || g.relay === true; }
  function alive() { return aliveM(M); }

  /* ---------- the watch while a challenge is open ---------- */
  function watch(kind, onEnd) {
    var m = M, g = groupOf(m, kind), done = false, busy = false, t1 = null, t2 = null, tm = null;
    function stop() {
      if (t1 !== null) { tm.clearInterval(t1); t1 = null; }
      if (t2 !== null) { tm.clearInterval(t2); t2 = null; }
    }
    function quiet() { done = true; if (tm) stop(); }
    function end(code) {
      if (done) return;
      done = true;
      if (tm) stop();
      if (code === 'switched' && M === m) shut(true);
      try { if (typeof onEnd === 'function') onEnd(why(code)); } catch (x) {}
    }
    if (!g) {
      /* no group to play in (a sign-out or a profile switch got here first): the challenge ends */
      Promise.resolve().then(function () { end('switched'); });
      return quiet;
    }
    tm = m.e.timers;
    t1 = tm.setInterval(function () {
      if (done) return;
      if (M !== m) { quiet(); return; }           /* the page closed the lobby itself */
      if (!aliveM(m)) end('switched');
    }, BOUND_MS);
    t2 = tm.setInterval(function () {
      if (done || busy) return;
      busy = true;
      call(m.e, function () { return g.ref.collection('private').doc('games').get(); }).then(function (s) {
        var k = s && s.exists ? s.data() : null;
        busy = false;
        if (!done && (!k || k.raceKey !== g.key)) end('ended');
      }, function (x) {
        busy = false;
        if (!done && refused(x)) end('ended');    /* unticked, races off, class closed: the rules refuse */
      });
    }, WATCH_MS);
    m.watches.push({ quiet: quiet, end: end });
    return quiet;
  }

  /* ---------- close ---------- */
  /* forget the keys. switched: the signed-in account changed, so a challenge being played
     ends ('switched'); otherwise the page closed the lobby itself and its watches just stop */
  function shut(switched) {
    var m = M, list;
    if (!m) return;
    M = null;
    list = m.watches; m.watches = [];
    m.groups.forEach(function (g) { g.key = ''; g.ref = null; });
    m.groups = [];
    list.forEach(function (w) { try { if (switched) w.end('switched'); else w.quiet(); } catch (x) {} });
  }
  function close() { shut(false); }

  var API = {
    GAMES: GAMES, KINDS: KINDS, T: T, KEY_RE: KEY_RE, WORD_RE: WORD_RE, WATCH_MS: WATCH_MS,
    roomText: roomText, roomId: roomId, peerOpts: peerOpts,
    open: open, groups: groups, room: room, relay: relay, watch: watch, alive: alive, close: close
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (W) W.SLLearnRooms = API;
})();
