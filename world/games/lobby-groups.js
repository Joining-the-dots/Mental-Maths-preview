/* ================================================================
   Challenges for Debut Run and Encore Shootout — who a child may
   challenge, read from the cloud (window.SLLobbyGroups). Classic UMD:
   module.exports in Node. No DOM, no browser storage, no THREE.
   Loaded lazily with social-core.js, kart-net.js, duel-core.js,
   duel-net.js and duel-lobby.js, the first time a child taps
   ⚔️ Challenge or 🔑 Join with a code.

   This file mirrors Race together's lobby (kart-lobby.js: groups,
   pick, tickets, nameOf) for the challenge sheets of duel-lobby.js:

   reason() answers from what the page already holds (no read), for the
   greyed buttons on the game's menu. open() asks again with fresh
   reads, in this order: the family record (so the grown-up's tick and
   the game-time limit are current), game time used today on another
   device, the child's kids record and class, then, for every group the
   child may challenge in (decided by SLDuelCore.eligibility), its race
   key and the roster of shown names. A group whose race key cannot be
   read is left out, so no room is ever opened or joined without it;
   firestore-off.rules refuses that read, which stops every challenge.

   Rooms live only inside a family or a class a grown-up set up
   (plan-ku KU14): there is no code room, no 'Friend N' and no code
   ticket. A name on screen is the one the grown-up approved in the
   group's roster (SLSocialCore.rosterName), else 'Player 2'; it is
   never sent and never taken from the wire.

   What this file writes anywhere: the child's own lobby ticket in the
   group, {c, s: 0, at} with c = SLKartNet.ticketC(room text, number),
   so a challenge ticket never matches a race ticket or another room;
   it is deleted when the room closes. The family pop-up is announced
   only for a family room this device hosts, with the game and the word
   only, and taken back at Start, Cancel, a full room, after 3 minutes
   and when the lobby closes. Race keys, rosters, seat tags and names
   are kept in memory only, and wiped (in the group objects handed out
   too) on close(), a profile switch, a sign-in or sign-out, leaving
   the game and pagehide. Games never award or spend anything.

   A grown-up's change ends a challenge within about a minute (C7):
   while a group has this child's ticket in it (a room hosted or
   joined), its race key is read again every 45 s (the host's roster
   too), and again on recheck() before a rematch. A refusal (the child
   unticked, challenges switched off, the class closed or the child
   taken out of it), a key that is gone or new (every Control Centre
   save makes a new one), or the child's own tag gone from the roster
   closes the lobby: alive() is false from then on (duel-lobby closes
   its session on that, C8) and ended() says why. A read that only
   failed (offline, too slow) changes nothing. A host's ticket counts
   while under 15 minutes old by the host's server-anchored clock
   (cfg.wall) when it hands one over (C10).

     reason(cfg, env)            null | {code, text}: offline, notfamily, notswitched, notime
     open(cfg, env)              Promise → {groups: [{kind, label, ref, raceKey, roster, tags, myTag, relay}], me: {ai, ci}}
                                 rejects {code, text}: the four reasons, 'check' (a read failed), 'closed'
     tickets(group, roomText)    {open(0, r), prove(h), checkHost(tag, 0, r), checkJoiner(tag, h), close(), failed}
     nameOf(group, tag, seat)    the roster name, or 'Player ' + (seat + 1)
     reroster(group)             read the roster again (at most every 30 s); Promise → true when read
     recheck(group, session?)    the race key and roster read again now (before a rematch): Promise →
                                 false when the grown-up's change closed the lobby; true otherwise (a
                                 read that only failed too), after session.prune() when it has one
     ended()                     null, or {code: 'off' | 'key', text} when a grown-up's change closed the
                                 last lobby (cleared by the next open())
     cfg.wall                    (optional, the host's) the server-anchored wall clock in ms since 1970
     announce(game, word, group?, session?)  the family pop-up for the room this device hosts → true when sent
     retract()                   take the pop-up back now
     alive()                     a lobby is open for the same signed-in profile
     close()                     forget everything, delete the tickets, take the pop-up back
     env (test seam)             firebase, cloudState, familyCfg, applyFamilyCfg, core (SLWorldCore), SC, Duel,
                                 Net, now, wall, timers, profile, online, announce, retract
     _mem()                      the open lobby's memory, or null (tests only)
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays, with its open lobby */
  if (typeof window !== 'undefined' && window.SLLobbyGroups) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLLobbyGroups;
    return;
  }
  var W = typeof window !== 'undefined' ? window : null;
  var NODE = typeof module === 'object' && !!module.exports && typeof require === 'function';

  var CALL_MS = 8000, WATCH_MS = 1000, ROSTER_MS = 30000, NONE_MS = 10 * 60000;
  var GUARD_MS = 45000;               /* C7: a group in play has its race key read again this often (≈1 read a minute) */
  var ENDED = 'Your grown-up changed the challenge settings, so this challenge has ended.';
  var TICKET_MAX_MS = 15 * 60000;     /* a host's ticket counts while under 15 minutes old (Race together's rule) */
  var ANNOUNCE_MS = 3 * 60000;        /* the room is open for joining 3 minutes (RV1a's CH_MAX_AGE_MS) */
  var CODE_RE = /^[A-Za-z0-9_-]{1,40}$/, KEY_RE = /^[0-9a-f]{32}$/, NUM_RE = /^[0-9a-f]{16}$/;
  /* duel-core's T.reason.offline, for a page where duel-core did not load (a test keeps them equal) */
  var OFFLINE = 'Challenges need the internet.';

  var M = null;          /* the open lobby. Everything about other children lives here, and in its groups */
  var none = null;       /* the last open() that found no group: {who, sig, at} */
  var ended = null;      /* C7: why a grown-up's change closed the last lobby, {code, text}, until the next open() */
  var A = null;          /* the pop-up this device announced: {m, group, tk, game, word, timer, retract} */
  var authOn = null;

  function noop() {}
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function need(name, file) {
    if (W && W[name]) return W[name];
    if (NODE) { try { return require(file); } catch (x) {} }
    return null;
  }

  /* ---------- the page around us (env replaces any part) ---------- */
  /* C10: the wall clock for the age of a host's ticket (the server stamped it): the host's own
     server-anchored clock when it hands one over (cfg.wall), this device's only without one */
  function wallOf(cfg) {
    return function () {
      var w = NaN;
      try { w = cfg && typeof cfg.wall === 'function' ? Number(cfg.wall()) : NaN; } catch (x) { w = NaN; }
      return isFinite(w) && w > 0 ? w : Date.now();
    };
  }
  function envOf(given, cfg) {
    var g = isObj(given) ? given : {}, nav = typeof navigator !== 'undefined' ? navigator : null;
    function pick(k, d) { return has(g, k) ? g[k] : d; }
    var on = pick('online', nav ? nav.onLine !== false : true);
    return {
      firebase: pick('firebase', W && W.firebase ? W.firebase : null), cloudState: pick('cloudState', W ? W.cloudState : null),
      familyCfg: pick('familyCfg', W ? W.slFamilyCfg : null), applyFamilyCfg: pick('applyFamilyCfg', W ? W.slFamilyCfgApply : null),
      core: pick('core', W ? W.SLWorldCore : null), SC: pick('SC', need('SLSocialCore', './social-core.js')),
      Duel: pick('Duel', need('SLDuelCore', './duel-core.js')), Net: pick('Net', need('SLKartNet', './kart-net.js')),
      now: pick('now', function () { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }),
      wall: pick('wall', wallOf(cfg)),
      timers: pick('timers', { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); },
        setInterval: function (f, ms) { return setInterval(f, ms); }, clearInterval: function (id) { clearInterval(id); } }),
      profile: pick('profile', activeProfile),
      online: typeof on === 'function' ? !!on() : !!on,
      /* the RV1a pop-up (index.html), looked up when it is used */
      announce: pick('announce', function (game, w) { if (W && typeof W.cloudAnnounceChallenge === 'function') W.cloudAnnounceChallenge(game, w); }),
      retract: pick('retract', function () { if (W && typeof W.cloudRetractChallenge === 'function') W.cloudRetractChallenge(); })
    };
  }
  /* the profile now playing, from the app's own state: {name, avatar, color} */
  function activeProfile() {
    var st = typeof state !== 'undefined' ? state : null, n = st ? st.activeUser : null;
    var u = st && st.users && typeof n === 'string' && has(st.users, n) ? st.users[n] : null;
    return isObj(u) ? { name: n, avatar: u.avatar, color: u.color } : null;
  }
  function profileOf(e) {
    var p = null;
    try { p = typeof e.profile === 'function' ? e.profile() : e.profile; } catch (x) { p = null; }
    return isObj(p) ? p : null;
  }
  function fbReady(e) { var f = e.firebase; return !!f && typeof f.firestore === 'function' && (!f.apps || f.apps.length > 0); }
  function boundEnv(cfg, e) {
    var p = profileOf(e);
    return { firebaseReady: fbReady(e), cloudState: e.cloudState, activeUser: p ? p.name : null, profileKey: cfg ? cfg.profileKey : null };
  }
  /* the line for a reason, from duel-core's copy; 'check' is the network line */
  function why(e, code) {
    var T = e && e.Duel && isObj(e.Duel.T) ? e.Duel.T : null, text = '';
    if (T && code === 'check') text = T.net.check;
    else if (T && T.reason && has(T.reason, code)) text = T.reason[code];
    else if (code !== 'closed') text = OFFLINE;
    return { code: code, text: text };
  }
  /* the gates that need no read: online, the files here, this profile is the signed-in family profile */
  function local(cfg, e) {
    var S = e.SC, b;
    if (!S || !e.Duel || typeof e.Duel.eligibility !== 'function' || !e.Net || !e.online || !fbReady(e)) return { code: 'offline' };
    b = S.bound(boundEnv(cfg, e));
    if (!b.ok) return { code: b.why === 'nofirebase' ? 'offline' : 'notfamily' };
    if (!CODE_RE.test(b.familyCode)) return { code: 'notfamily' };
    return { b: b };
  }
  function sigOf(S, fam) { try { return JSON.stringify(S.gamesCfg(fam)); } catch (x) { return ''; } }
  function gateOf(cfg) {
    var g = null;
    try { g = cfg && cfg.arcade && typeof cfg.arcade.gate === 'function' ? cfg.arcade.gate() : null; } catch (x) { g = null; }
    return isObj(g) ? g : null;
  }
  /* an open() for this account found no group (challenges off in the family, no class with races
     on), under the same family record, in the last 10 minutes: the buttons say so before any tap */
  function noGroup(cfg, e) {
    var n = none;
    return !!n && n.who === e.SC.cacheKey(boundEnv(cfg, e)) && n.sig === sigOf(e.SC, e.familyCfg) && e.now() - n.at < NONE_MS;
  }
  /* Why challenges cannot be offered now, from what the page holds. With no family record loaded
     yet, ticked and the switches count as on: open() asks again with a fresh one. */
  function reason(cfg, given) {
    var e = null, l, S, fam, g, out;
    try {
      e = envOf(given, cfg); l = local(cfg, e);
      if (l.code) return why(e, l.code);
      S = e.SC; fam = isObj(e.familyCfg) ? e.familyCfg : null; g = S.gamesCfg(fam);
      out = e.Duel.eligibility({
        online: true, signedIn: true, bound: true, ON: S.ON, gate: gateOf(cfg),
        ticked: fam ? S.memberOk(fam, l.b.uid) : true,
        race: fam ? g.race : true,
        classRace: !noGroup(cfg, e)              /* a class is still possible until an open() finds none */
      });
      return out && out.reason ? { code: out.reason.code, text: out.reason.text } : null;
    } catch (x) { return why(e, 'offline'); }
  }

  /* ---------- the lobby's memory ---------- */
  /* a database call that takes over 8 seconds counts as failed */
  function call(m, fn) {
    var tm = m.E.timers;
    return new Promise(function (res, rej) {
      var t = tm.setTimeout(function () { rej({ code: 'timeout' }); }, CALL_MS);
      Promise.resolve().then(fn).then(function (v) { tm.clearTimeout(t); res(v); }, function (x) { tm.clearTimeout(t); rej(x); });
    });
  }
  /* still the lobby that is open, for the same signed-in profile? A profile switch or a sign-out closes it */
  function alive(m) {
    if (!m || M !== m) return false;
    var k = '';
    try { k = m.E.SC.cacheKey(boundEnv(m.cfg, m.E)); } catch (x) { k = ''; }
    if (k && k === m.who) return true;
    close();
    return false;
  }
  function owns(m, g) { return !!m && m.groups.indexOf(g) >= 0; }
  /* leaving the game closes the lobby (once per game), and so does any change of the signed-in account */
  function hook(cfg, e) {
    var orig = cfg.onExit, f = e.firebase;
    if (!cfg._lobbyGroupsExit) {
      cfg._lobbyGroupsExit = true;
      cfg.onExit = function () { close(); if (typeof orig === 'function') return orig.apply(this, arguments); };
    }
    if (authOn !== f && typeof f.auth === 'function') {
      authOn = f;
      try { f.auth().onAuthStateChanged(function (user) { if (M && (user && user.uid ? user.uid : '') !== M.b.uid) close(); }); } catch (x) {}
    }
  }

  /* ---------- open: the family record, game time, the groups, their keys and rosters ---------- */
  function open(cfg, given) {
    var e = null, l, m;
    try {
      close();
      ended = null;
      e = envOf(given, cfg);
      if (!isObj(cfg)) return Promise.reject(why(e, 'offline'));
      l = local(cfg, e);
      if (l.code) return Promise.reject(why(e, l.code));
      if (e.SC.ON && e.SC.ON.duels === false) return Promise.reject(why(e, 'notswitched'));     /* the release switch: no read at all */
      hook(cfg, e);
      m = M = { E: e, cfg: cfg, b: l.b, who: e.SC.cacheKey(boundEnv(cfg, e)), fam: null, sig: '', groups: [], tks: [], writer: {}, readAt: {}, watch: null,
        guard: null, checking: {} };
      m.watch = e.timers.setInterval(function () { alive(m); }, WATCH_MS);
      m.guard = e.timers.setInterval(function () { guard(m); }, GUARD_MS);
    } catch (x) { return Promise.reject(why(e, 'offline')); }
    return begin(m).then(null, function (x) {
      var out = isObj(x) && typeof x.code === 'string' && typeof x.text === 'string' ? x : why(e, 'check');
      if (M === m) close();
      throw out;
    });
  }
  function stop(m, code) { throw M === m ? why(m.E, code) : why(m.E, 'closed'); }
  function begin(m) {
    var e = m.E, S = e.SC, db = e.firebase.firestore(), uid = m.b.uid, famRef = db.collection('families').doc(m.b.familyCode);
    return call(m, function () { return famRef.get(); }).then(function (s) {
      var fam = s && s.exists ? s.data() : null;
      if (!alive(m)) return stop(m, 'closed');
      if (fam && typeof e.applyFamilyCfg === 'function') { try { e.applyFamilyCfg(fam); } catch (x) {} }
      /* not ticked (or no password of its own): nothing past the family record is read */
      if (!fam || !S.memberOk(fam, uid)) return stop(m, 'notswitched');
      m.fam = S.gamesCfg(fam); m.sig = sigOf(S, fam);
      return call(m, function () { return db.collection('users').doc(uid).get(); }).then(function (us) { if (M === m) elsewhere(m, us); }, noop);
    }, function () { return stop(m, alive(m) ? 'offline' : 'closed'); }).then(function () {
      if (!alive(m)) return stop(m, 'closed');
      return candidates(m, famRef);
    }).then(function (found) {
      var out;
      if (!alive(m)) return stop(m, 'closed');
      out = e.Duel.eligibility({ online: true, signedIn: true, bound: true, ticked: true, race: m.fam.race, classRace: !!found.cls, ON: S.ON, gate: gateOf(m.cfg) });
      if (out.reason) {
        if (out.reason.code === 'notswitched' && found.known) none = { who: m.who, sig: m.sig, at: e.now() };
        if (out.reason.code === 'notswitched' && !found.known) return stop(m, 'check');
        return stop(m, out.reason.code);
      }
      if (none && none.who === m.who) none = null;
      var list = [];
      if (out.family) list.push({ kind: 'family', label: e.Duel.T.host.family, ref: famRef, relay: m.fam.relay === true });
      if (out['class']) list.push({ kind: 'class', label: e.Duel.fill(e.Duel.T.host.klass, { cls: found.label }), ref: found.cls, relay: true });
      /* the race key and roster of each group, read afresh: a group whose key is refused is left out */
      return Promise.all(list.map(function (g) { return keyOf(m, g).then(function () { return g; }, function () { return null; }); }));
    }).then(function (got) {
      if (!alive(m)) return stop(m, 'closed');
      m.groups = got.filter(function (g) { return !!g; });
      if (!m.groups.length) return stop(m, 'check');
      return { groups: m.groups.slice(), me: S.who(profileOf(e) || m.cfg.user) };
    });
  }
  /* game time used today on another device counts on this one too: the difference is added before the gate is asked */
  function elsewhere(m, snap) {
    var a = m.cfg.arcade, days, cloud, used;
    try {
      days = snap.data().state.world.arcade.days;
      cloud = has(days, m.cfg.day) ? days[m.cfg.day] : 0; used = a.status().usedSec;
      if (typeof cloud === 'number' && isFinite(cloud) && typeof used === 'number' && cloud > used) a.tick(Math.min(86400, Math.round(cloud - used)));
    } catch (x) {}
  }
  /* The class named in the child's own record with the family, when the child's own entry is in
     it and its races are on. Of the class only its code is used, as a label ('Otter class').
     known: every read answered, so 'no class' is the real answer, not a lost read. */
  function candidates(m, famRef) {
    var e = m.E, S = e.SC, db = e.firebase.firestore(), uid = m.b.uid, out = { cls: null, label: '', known: false };
    if (S.ON && (S.ON.duels === false || S.ON.classes === false)) { out.known = true; return Promise.resolve(out); }
    return call(m, function () { return famRef.collection('kids').doc(uid).get(); }).then(function (s) {
      var d = s && s.exists ? s.data() : null, cls = d && typeof d.cls === 'string' ? d.cls : '', label = S.classLabel(cls), c;
      if (!label) { out.known = true; return out; }
      c = db.collection('classes').doc(cls);
      return call(m, function () { return Promise.all([c.collection('members').doc(uid).get(), c.get()]); }).then(function (got) {
        var k = got[1] && got[1].exists ? got[1].data() : null;
        if (got[0] && got[0].exists && isObj(k) && k.race === true && k.closed === false) { out.cls = c; out.label = label; }
        out.known = true;
        return out;
      });
    }).then(null, function () { return out; });
  }
  /* the group's race key and roster into memory; the child must be in the roster the grown-up approved */
  function keyOf(m, g) {
    var S = m.E.SC, priv = g.ref.collection('private'), uid = m.b.uid;
    return call(m, function () { return Promise.all([priv.doc('games').get(), priv.doc('roster').get()]); }).then(function (got) {
      var k = got[0] && got[0].exists ? got[0].data() : null, key = isObj(k) && typeof k.raceKey === 'string' && KEY_RE.test(k.raceKey) ? k.raceKey : '';
      var roster = got[1] && got[1].exists ? got[1].data() : null, tags, tag;
      if (!key) throw { code: 'check' };
      tags = S.tagMap(key, roster); tag = S.seatTag(key, uid);
      if (tags[tag] !== uid) throw { code: 'check' };        /* not in the roster the grown-up approved */
      g.raceKey = key; g.roster = roster; g.tags = tags; g.myTag = tag;
      m.readAt[g.kind] = clock(m);
    });
  }
  function clock(m) { try { return m.E.now(); } catch (x) { return 0; } }
  /* the roster once more (a child ticked since, or a tag this device does not know), at most every 30 s.
     The tag map is refilled in place, so a session holding it sees the new one at its next join. */
  function reroster(g) {
    var m = M, t;
    if (!owns(m, g) || !alive(m) || !g.raceKey) return Promise.resolve(false);
    t = clock(m);
    if (t - (has(m.readAt, g.kind) ? m.readAt[g.kind] : -Infinity) < ROSTER_MS) return Promise.resolve(false);
    m.readAt[g.kind] = t;
    return call(m, function () { return g.ref.collection('private').doc('roster').get(); }).then(function (s) {
      if (!owns(m, g) || !alive(m) || !g.raceKey) return false;
      refill(m, g, s);
      if (g.tags[g.myTag] !== m.b.uid) { end(m, 'off'); return false; }      /* this child is not in the roster any more */
      return true;
    }, function () { return false; });
  }
  /* the roster just read, into the group: its tag map refilled in place (a session holds that map) */
  function refill(m, g, snap) {
    var tags;
    g.roster = snap && snap.exists ? snap.data() : null;
    tags = m.E.SC.tagMap(g.raceKey, g.roster);
    Object.keys(g.tags).forEach(function (k) { delete g.tags[k]; });
    Object.keys(tags).forEach(function (k) { g.tags[k] = tags[k]; });
  }

  /* ---------- C7: a grown-up's change ends a challenge within about a minute ---------- */
  /* The group's race key (and its roster, when asked) read again. → 'ok', 'off' (refused, gone, or
     this child is not in the roster any more), 'key' (a new race key), 'net' (the read only failed:
     nothing is known) or 'stale' (the lobby or the group moved on meanwhile) */
  function check(m, g, withRoster) {
    var key = g.raceKey, priv = g.ref.collection('private');
    return call(m, function () { return Promise.all(withRoster ? [priv.doc('games').get(), priv.doc('roster').get()] : [priv.doc('games').get()]); }).then(function (got) {
      var k = got[0] && got[0].exists ? got[0].data() : null, now = isObj(k) && typeof k.raceKey === 'string' && KEY_RE.test(k.raceKey) ? k.raceKey : '';
      if (M !== m || !owns(m, g) || !key || g.raceKey !== key) return 'stale';
      if (!now) return 'off';
      if (now !== key) return 'key';
      if (got.length > 1) {
        refill(m, g, got[1]);
        m.readAt[g.kind] = clock(m);
        if (g.tags[g.myTag] !== m.b.uid) return 'off';
      }
      return 'ok';
    }, function (x) { return isObj(x) && x.code === 'permission-denied' ? 'off' : 'net'; });
  }
  /* the lobby closes on the grown-up's change; ended() says why */
  function end(m, code) {
    if (M !== m) return;
    ended = { code: code, text: ENDED };
    close();
  }
  /* every 45 s: each group with this child's ticket in it (a room hosted or joined), one read at a
     time per group; the host's roster too */
  function guard(m) {
    if (!alive(m)) return;
    m.groups.forEach(function (g) {
      var w = m.writer[g.kind];
      if (!w || m.checking[g.kind] || !g.raceKey) return;
      m.checking[g.kind] = true;
      check(m, g, !!m.host && m.host.group === g).then(function (v) {
        if (M !== m) return;
        m.checking[g.kind] = false;
        if (v === 'off' || v === 'key') end(m, v);
      });
    });
  }
  /* before a rematch: the race key and the roster now (no 30 s wait). → false when the grown-up's
     change closed the lobby; true otherwise, after session.prune() (a seat whose tag left the
     roster is freed) when the session has one */
  function recheck(g, ses) {
    var m = M;
    if (!owns(m, g) || !alive(m) || !g.raceKey) return Promise.resolve(false);
    return check(m, g, true).then(function (v) {
      if (v === 'off' || v === 'key') { end(m, v); return false; }
      if (v === 'ok' && ses && typeof ses.prune === 'function') { try { ses.prune(); } catch (x) {} }
      return M === m && owns(m, g);
    });
  }

  /* ---------- names ---------- */
  /* the name this device shows for a seat tag: from its own copy of the roster, never from the wire */
  function nameOf(g, tag, seat) {
    var fb = isInt(seat) && seat >= 0 && seat <= 4 ? 'Player ' + (seat + 1) : 'Player', m = M, S;
    if (!owns(m, g) || !alive(m) || !isObj(g.tags) || typeof tag !== 'string' || !has(g.tags, tag)) return fb;
    S = m.E.SC;
    try { return S.rosterName(g.roster, g.tags[tag], fb, S.rudeFrom(m.E.core)); } catch (x) { return fb; }
  }

  /* ---------- lobby tickets (D35), bound to the room's text ---------- */
  /* A host writes its ticket when it opens the room (open(0, r): r is the number it sends in
     'info'); a joiner writes the number the host handed it (prove(h)) before it asks for a seat;
     each side reads the other's ticket through the group's tag map. c = ticketC(roomText, n):
     the room text holds the group's race key, the game and the word, so a ticket left from a
     race, another room or an older key never matches. s is always 0. A host's ticket counts
     only while under 15 minutes old by this device's clock. A ticket is deleted on close(),
     unless a newer one of this child's in the same group has replaced it. */
  function bound(m, g, text) {
    var p = typeof text === 'string' && text.length <= 200 ? text.split('|') : [];
    if (!owns(m, g) || !g.raceKey || p.length !== 5) return false;
    try { return m.E.Duel.roomText(g.kind, g.raceKey, p[3], p[4]) === text; } catch (x) { return false; }
  }
  function deadTickets() {
    function no() { return Promise.reject({ code: 'ticket' }); }
    function nope() { return Promise.resolve(false); }
    return { open: no, prove: no, checkHost: nope, checkJoiner: nope, close: function () { return Promise.resolve(); }, failed: true };
  }
  function tickets(g, roomText) {
    var m = M;
    if (!alive(m) || !bound(m, g, roomText)) return deadTickets();
    var e = m.E, col = g.ref.collection('lobby'), mine = col.doc(m.b.uid), stamp = e.firebase.firestore.FieldValue;
    var used = false, live = true, hosting = false, tk;
    function mark(n) { return e.Net.ticketC(roomText, n); }
    function ok() { return live && M === m && alive(m) && owns(m, g); }
    function bad(x) { tk.failed = true; throw isObj(x) && x.code === 'timeout' ? x : { code: 'ticket' }; }
    function put(n) {
      if (!ok() || typeof n !== 'string' || !NUM_RE.test(n)) return Promise.reject({ code: 'ticket' });
      used = true; m.writer[g.kind] = tk;
      return call(m, function () { return mine.set({ c: mark(n), s: 0, at: stamp.serverTimestamp() }); }).then(noop, bad);
    }
    function fresh(at) {
      var t = at && typeof at.toMillis === 'function' ? at.toMillis() : NaN;
      return isFinite(t) && e.wall() - t <= TICKET_MAX_MS;
    }
    function read(tag, n, test) {
      var uid = ok() && typeof tag === 'string' && has(g.tags, tag) ? g.tags[tag] : '';
      if (!uid || uid === m.b.uid || typeof n !== 'string' || !NUM_RE.test(n)) return Promise.resolve(false);
      return call(m, function () { return col.doc(uid).get(); }).then(function (s) {
        var d = s && s.exists ? s.data() : null;
        return ok() && isObj(d) && d.c === mark(n) && d.s === 0 && test(d);
      }, bad);
    }
    tk = {
      failed: false,
      open: function (slot, r) {
        if (slot !== 0) return Promise.reject({ code: 'ticket' });
        return put(r).then(function () {
          if (!ok()) throw { code: 'ticket' };              /* closed while the write was on its way: no room */
          hosting = true; m.host = { tk: tk, group: g, text: roomText };
        });
      },
      prove: function (h) { return put(h); },
      checkHost: function (tag, slot, r) { return slot === 0 ? read(tag, r, function (d) { return fresh(d.at); }) : Promise.resolve(false); },
      checkJoiner: function (tag, h) { return read(tag, h, function () { return true; }); },
      close: function () {
        var del = used && m.writer[g.kind] === tk;
        live = false; used = false;
        if (del) m.writer[g.kind] = null;
        if (hosting && m.host && m.host.tk === tk) m.host = null;
        if (A && A.tk === tk) retract();
        m.tks = m.tks.filter(function (x) { return x !== tk; });
        return del ? call(m, function () { return mine.delete(); }).then(noop, noop) : Promise.resolve();
      }
    };
    m.tks.push(tk);
    return tk;
  }

  /* ---------- the family pop-up (RV1a) ---------- */
  /* Only for a family room this device hosts (its ticket written for that room), with the game and
     the word, both checked against the room's text. Taken back at Start, Cancel (the ticket
     closes), a full room and after 3 minutes; with the session given, its 'room', 'go' and
     'closed' events take it back by themselves. */
  function announce(game, word, group, ses) {
    var m = M, h, parts, g, a, D, max;
    if (!alive(m) || !m.host) return false;
    h = m.host; g = group == null ? h.group : group; D = m.E.Duel;
    if (g !== h.group || !owns(m, g) || g.kind !== 'family' || !D || !D.isWord(word) || !isObj(D.GAMES) || !has(D.GAMES, game)) return false;
    parts = h.text.split('|');
    if (parts[1] !== 'family' || parts[3] !== game || parts[4] !== word) return false;
    max = D.GAMES[game].max;
    if (ses && ses.room && (ses.room.open === false || (Array.isArray(ses.room.players) && ses.room.players.length >= max))) return false;
    retract();
    try { m.E.announce(game, word); } catch (x) { return false; }
    a = A = { m: m, group: g, tk: h.tk, game: game, word: word, timer: null, retract: m.E.retract };
    a.timer = m.E.timers.setTimeout(function () { if (A === a) retract(); }, ANNOUNCE_MS);
    if (ses && typeof ses.on === 'function') {
      ses.on('room', function (v) {
        if (A === a && (!isObj(v) || v.open === false || v.state !== 'lobby' || (Array.isArray(v.players) && v.players.length >= max))) retract();
      });
      ses.on('go', function () { if (A === a) retract(); });
      ses.on('closed', function () { if (A === a) retract(); });
    }
    return true;
  }
  /* takes back only what this file announced */
  function retract() {
    var a = A;
    if (!a) return false;
    A = null;
    try { a.m.E.timers.clearTimeout(a.timer); } catch (x) {}
    try { a.retract(); } catch (x) {}
    return true;
  }

  /* ---------- closing ---------- */
  /* forget the key, the roster and the tag map of every group (in the objects handed out too),
     delete this child's tickets and take the pop-up back */
  function close() {
    var m = M;
    if (!m) { retract(); return; }
    M = null;
    retract();
    m.tks.slice().forEach(function (tk) { try { tk.close(); } catch (x) {} });
    try { m.E.timers.clearInterval(m.watch); } catch (x) {}
    try { m.E.timers.clearInterval(m.guard); } catch (x) {}
    m.checking = {};
    m.groups.forEach(function (g) {
      g.raceKey = ''; g.roster = null; g.myTag = '';
      if (isObj(g.tags)) Object.keys(g.tags).forEach(function (k) { delete g.tags[k]; });
    });
    m.groups = []; m.tks = []; m.host = null; m.fam = null; m.readAt = {};
  }

  var API = {
    reason: reason, open: open, tickets: tickets, nameOf: nameOf, reroster: reroster, recheck: recheck,
    announce: announce, retract: retract, close: close,
    alive: function () { return alive(M); },
    ended: function () { return ended ? { code: ended.code, text: ended.text } : null; },
    _mem: function () { return M; }
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (W) {
    W.SLLobbyGroups = API;
    try { W.addEventListener('pagehide', close); } catch (x) {}
  }
})();
