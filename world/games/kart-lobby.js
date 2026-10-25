/* ================================================================
   Neon Grand Prix — Race together, the lobby (window.SLKartLobby).
   kart.js loads this file, with social-core.js and kart-net.js, only
   when a child taps Race together. Solo play never does.

   open(), in this order: the family record is read afresh (so the
   grown-up's tick and the game-time limit are current); game time
   used today on another device is counted; the game-time gate is
   asked (the shell's own time-up sheet on a no); the groups the child
   may race in are read (the family, and the class their grown-up
   asked for); with none, one line says to ask the grown-up, and the
   button is greyed with it for 10 minutes or until the family record
   changes; a child who has not seen the How-to-play cards sees them;
   then the chosen group's race key and roster of shown names, into
   memory only; the open races are listed; the lobby runs inside the
   shell's sheets; and at GO the session is handed to kart.js
   (cfg.kartLive, for that one round) and the round begins.

   What another child's device gets of this one: a seat tag, and the
   avatar and colour as index numbers. No name is sent or taken from
   the wire: a name on screen is the one a grown-up approved in the
   group's roster (SLSocialCore.rosterName), else 'Racer 2'. A child
   types nothing here and there is nowhere to type. Whatever comes
   from the database or another device is checked, then written with
   textContent. The class a child is in shows only as the label made
   from its code ('Otter class'); the name a grown-up typed for it is
   never read.

   The one thing this file writes anywhere is the child's own lobby
   ticket (a random number bound to the room's key, a room number, the
   server's time; written again every 5 minutes while the child's own
   race is open), which it deletes when the lobby closes. A starter's
   ticket counts only while it is under 15 minutes old, by the
   server-anchored clock the host hands over (cfg.wall), so a device
   clock that is wrong does not hide a race (C10). Only one device at a
   time can race on one login: a race opened on another device with
   this child's own login is never listed, and the lobby says each
   child needs their own login (it would overwrite that device's ticket
   otherwise). Nothing about another child goes into the profile or the
   browser's storage. Games never award or spend anything.

   A grown-up's change ends a race or a challenge within about a minute
   (C7): while the lobby is open, the group's race key is read again
   every 45 s (the starter of a room with others in it reads the roster
   too), and again before every Race again. A refusal (the child
   unticked, races switched off, the class closed or the child taken
   out of it), a key that is gone or new (every Control Centre save
   makes a new one), or the child's own tag gone from the roster closes
   the lobby and leaves the room: a starter's ends for everyone. A
   starter frees the seat of a child whose tag left the roster
   (session.prune, when the race network has it; without it the room
   ends). A read that only failed (offline, too slow) changes nothing;
   the next one is in 45 s.

   Challenges (the kids update, KG7; plan-ku KU14): ⚔️ Challenge and
   🔑 Join with a code on the kart menu open these same sheets with a
   room addressed by one of the 50 game words (SLDuelCore.WORDS): the
   room key is 'slk-word|' + the group's race key + '|' + the word, so
   only a ticked child of that family or class can reach it, and its
   tickets never match a word-less race's. Seat tags, names and the
   roster still come from the real race key. Family and class rooms
   only: there are no rooms with a code for friends from other
   families. A starter's family room is announced on the challenge
   channel with the word only (window.cloudAnnounceChallenge('kart',
   word)) and taken back at GO, Cancel, a full room or after 3
   minutes; a class room is never announced. The 4-character code is
   the one thing a child types here: it is checked against the game
   words before anything is dialled, used only to find the room, and
   never sent or shown to another device. Everything after the word is
   Race together's: GO, ghosts, finishing, the table, a starter who
   leaves, Race again.

     reason(cfg, env)     null, or {code, text}: 'offline', 'notfamily', 'notswitched', 'notime'
     open(ctl, cfg, env, opts)  the Race together sheet (ctl: the shell's control object). opts.mode:
                          'race' (Race together), 'host' (⚔️ open a challenge), 'join' (🔑, with
                          opts.code from a family pop-up); without opts, the mode this cfg last used
     close()              leave the race (a starter whose race is still going passes messages on,
                          unseen, until it ends), delete the ticket, forget the key, roster and tags
     prewarm(trackId)     build that course a step at a time, then say this device is ready
     cfg.wall             (optional, the host's) the server-anchored wall clock in ms since 1970
     env (test seam)      Peer, peerOpts, firebase, cloudState, familyCfg, applyFamilyCfg, core, SC,
                          Net, KL, now, wall, timers, wakeLock, profile, online, Duel (SLDuelCore),
                          announce(game, word), retract(), random
     _mem()               the open lobby's memory, or null (tests only)
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays, with its open lobby */
  if (typeof window !== 'undefined' && window.SLKartLobby) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLKartLobby;
    return;
  }
  var W = typeof window !== 'undefined' ? window : null;

  var CALL_MS = 8000, WATCH_MS = 1000, ROSTER_MS = 30000, STEP_MS = 30, SEATS = 5;
  var TICKET_EVERY_MS = 5 * 60000, TICKET_MAX_MS = 15 * 60000, NONE_MS = 10 * 60000;
  var GUARD_MS = 45000;          /* C7: the race key read again this often while the lobby is open (≈1 read a minute) */
  var CODE_RE = /^[A-Za-z0-9_-]{1,40}$/, KEY_RE = /^[0-9a-f]{32}$/;
  var CREW = [['gentle', 'Gentle crew'], ['quick', 'Quick crew'], ['headline', 'Headline crew'], ['none', 'Children only']];
  var T = {
    title: '🏁 Race together', how: 'How to play', gotIt: 'Got it — let’s go!', back: '← Back', wait: 'Getting ready…',
    offline: 'Race together needs the internet.',
    notfamily: 'Race together is for family logins. Ask a grown-up to sign you in.',
    notswitched: 'Ask your grown-up to switch on Race together for you in the Control Centre.',
    notime: 'That’s all the game time for today.',
    family: '🏠 Family', inFamily: 'your family', start: '🏁 Start a race', looking: 'Looking for races in ', none: 'No races yet. Start one!',
    again: '↻ Look again', own: '🏎️ Race on your own', opening: 'Opening your race…', joining: 'Joining ',
    full3: '3 races are already going. Join one!', raceFull: 'This race is full', raceBusy: 'Busy just now · Look again in a moment', check: 'Can’t check who is racing. Try again.',
    server: 'Can’t reach the game server.', retry: '↻ Try again', closed: 'The race was closed.',
    update: 'A device needs the update. Reload the game on every device.', sat: 'This device wasn’t ready in time. You’re in the next race.',
    noPause: 'No pausing in a shared race.', screenOn: 'Keep the screen on.',
    yours: '🏁 Your race', go: '🏁 Start race', closeRace: 'Close race', leave: 'Leave', alone: 'Waiting for someone to join…', back2: 'Waiting for the others to come back…', starting: 'Starting…', empty: 'waiting…',
    ended: 'Your grown-up changed the Race together settings, so this race has ended.',
    endedCh: 'Your grown-up changed the challenge settings, so this challenge has ended.',
    ownLogin: 'Your login is already in a race on another device. Each child needs their own login.', checking: 'Checking who can race…',
    /* challenges: every other line is SLDuelCore.T's */
    game: 'Neon Grand Prix', theirs: '’s challenge'
  };
  /* challenges: a starter's room stays open 3 minutes for a first friend (the pop-up's life); a joiner
     looks 3 times, 4 s apart; a starter whose word another room holds right now draws another, 5 at most */
  var CH_OPEN_MS = 3 * 60000, CH_LOOKS = 3, CH_GAP_MS = 4000, CH_WORDS = 5, GAME = 'kart';

  var M = null;                 /* the open lobby. Everything about other children lives here, and only here */
  var authOn = null, infos = {};
  /* the last open() that found no group for its account: {who, sig (the family's games record), at} */
  var none = null;

  function noop() {}
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  /* ---------- the page around us (the third argument of open and reason replaces any part) ---------- */
  /* C10: the wall clock for the age of a ticket the server stamped. The host's own clock when it
     hands one over (cfg.wall: the island's, anchored to the server's time and carried on by the
     steady clock), so a device whose clock is wrong still sees a fresh ticket as fresh; this
     device's clock only without one. */
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
      Peer: pick('Peer', W ? W.Peer : null), peerOpts: pick('peerOpts', W ? W.SL_PEER_OPTS : null),
      firebase: pick('firebase', W && W.firebase ? W.firebase : null), cloudState: pick('cloudState', W ? W.cloudState : null),
      familyCfg: pick('familyCfg', W ? W.slFamilyCfg : null), applyFamilyCfg: pick('applyFamilyCfg', W ? W.slFamilyCfgApply : null),
      core: pick('core', W ? W.SLWorldCore : null), SC: pick('SC', W ? W.SLSocialCore : null),
      Net: pick('Net', W ? W.SLKartNet : null), KL: pick('KL', W ? W.SLKartLogic : null),
      /* the 🏆 Challenge wins (boards.js), looked up when a race's table is final: it may load after the lobby */
      boards: pick('boards', function () { return W ? W.SLBoards : null; }),
      /* the race clock is performance.now(): the shell counts down to GO (beginRound's goAt) on it */
      now: pick('now', function () { return performance.now(); }),
      /* the wall clock, for the age of a ticket the server stamped */
      wall: pick('wall', wallOf(cfg)),
      timers: pick('timers', { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); },
        setInterval: function (f, ms) { return setInterval(f, ms); }, clearInterval: function (id) { clearInterval(id); } }),
      wakeLock: pick('wakeLock', nav && nav.wakeLock ? nav.wakeLock : null),
      profile: pick('profile', activeProfile),
      online: typeof on === 'function' ? !!on() : !!on,
      /* challenges: the words and their copy, and the family pop-up (the app's own, looked up when used) */
      Duel: pick('Duel', W ? W.SLDuelCore : null),
      announce: pick('announce', function (game, word) { if (W && typeof W.cloudAnnounceChallenge === 'function') W.cloudAnnounceChallenge(game, word); }),
      retract: pick('retract', function () { if (W && typeof W.cloudRetractChallenge === 'function') W.cloudRetractChallenge(); }),
      random: pick('random', Math.random)
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
  /* the gates that need no read: online, and this profile is the signed-in family profile */
  function local(cfg, e) {
    var S = e.SC, b;
    if (!S || !e.online || !fbReady(e)) return { code: 'offline' };
    b = S.bound(boundEnv(cfg, e));
    if (!b.ok) return { code: b.why === 'nofirebase' ? 'offline' : 'notfamily' };
    if (!CODE_RE.test(b.familyCode)) return { code: 'notfamily' };
    return S.ON.race === false ? { code: 'notswitched' } : { b: b };
  }
  /* ticked by the grown-up, with a password of its own; and races on in the family, or a class still possible */
  function ticked(S, fam, uid) { return S.memberOk(fam, uid) && (S.gamesCfg(fam).race || S.ON.classes !== false); }
  function sigOf(S, fam) { try { return JSON.stringify(S.gamesCfg(fam)); } catch (x) { return ''; } }
  /* an open() for this account found no group to race in (races off in the family, no class with races on),
     under the same family record, in the last 10 minutes: the button says so before any tap */
  function noGroup(cfg, e) {
    var n = none;
    return !!n && n.who === e.SC.cacheKey(boundEnv(cfg, e)) && n.sig === sigOf(e.SC, e.familyCfg) && e.now() - n.at < NONE_MS;
  }
  /* Why Race together cannot be offered now, from what the page already holds (no read). open() asks again, with a fresh family record. */
  function reason(cfg, given) {
    var code = 'offline', e, l, g;
    try {
      e = envOf(given, cfg); l = local(cfg, e); code = l.code || '';
      if (!code && isObj(e.familyCfg) && (!ticked(e.SC, e.familyCfg, l.b.uid) || noGroup(cfg, e))) code = 'notswitched';
      if (!code && cfg && cfg.arcade) { g = cfg.arcade.gate(); if (g && g.allowed === false) code = 'notime'; }
    } catch (x) { code = code || 'offline'; }
    return code ? { code: code, text: T[code] } : null;
  }
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
    if (M !== m) return false;
    if (m.E.SC.cacheKey(boundEnv(m.cfg, m.E)) === m.who) return true;
    shut();
    return false;
  }

  /* ---------- sheets: DOM nodes and textContent only ---------- */
  function css() {
    if (document.getElementById('slkCss')) return;
    var c = document.createElement('style');
    c.id = 'slkCss';
    /* nothing here moves, fades or blinks, so reduced motion needs no rule of its own */
    c.textContent = [
      '.slk-seats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;width:100%;max-width:440px;}',
      '.slk-seat{display:flex;align-items:center;gap:8px;min-height:40px;padding:2px 10px;border-radius:12px;background:rgba(255,255,255,.1);font:800 16px system-ui,sans-serif;text-align:left;}',
      '.slk-seat.me{outline:2px solid #ffd23f;outline-offset:-2px;}',
      '.slk-seat.weak{opacity:.5;}',
      '.slk-av{flex:0 0 32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;}',
      '.slk-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.slk-st{font-size:13px;opacity:.85;}',
      '.slk-race{display:block;width:100%;max-width:440px;text-align:left;}',
      '.slg-scr p.slk-note{color:#ffe27a;}',
      /* a challenge's word: big ink letters on a lemon pill (contrast over 10:1), and the box a joiner types it in */
      '.slk-word{display:inline-flex;align-items:center;gap:12px;padding:2px 22px 4px;border-radius:20px;background:#ffe27a;color:#3b2f4a;font:800 64px/1.15 "Baloo 2",system-ui,sans-serif;letter-spacing:.14em;}',
      '.slk-word .slk-emo{font-size:40px;letter-spacing:0;}',
      '.slk-boxrow{align-items:center;}',
      /* the shell draws a disabled button like a live one: Start race before anyone is ready, Join while looking, look greyed */
      '.slg-scr .slk-boxrow .slg-b:disabled,.slg-scr .row.slk-act .slg-b:disabled{opacity:.5;cursor:default;}',
      '.slk-box{width:5.2em;box-sizing:border-box;padding:2px 10px;border:3px solid #ffe27a;border-radius:16px;background:#fff;color:#3b2f4a;font:800 40px/1.2 "Baloo 2",system-ui,sans-serif;letter-spacing:.14em;text-align:center;text-transform:uppercase;}',
      '.slk-box:focus{outline:3px solid #3df2ff;outline-offset:2px;}',
      '.slk-box:disabled{opacity:.7;}',
      /* a phone held sideways: the seats two to a line, and the lobby's own buttons (Start race,
         Close race, Leave) held at the foot of the sheet, in reach however far it scrolls */
      '@media (max-height: 520px){',
      '.slk-seats{display:grid;grid-template-columns:1fr 1fr;}',
      '.slg-scr .row.slk-act{position:sticky;bottom:-10px;z-index:2;width:100%;padding:6px 0 10px;margin-bottom:-10px;background:#170f38;box-shadow:0 -6px 10px rgba(19,12,46,.85);}',
      '.slk-word{font-size:40px;padding:0 16px 2px;}.slk-word .slk-emo{font-size:26px;}.slk-box{font-size:30px;}',
      '}'
    ].join('\n');
    document.head.appendChild(c);
  }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = text;
    return n;
  }
  function line(root, text, cls) { return text ? root.appendChild(mk('p', cls || '', text)) : null; }
  /* k names a button, so the focus can stay on it when the sheet is filled again */
  function btn(cls, text, k, go, dead) {
    var b = mk('button', cls, text);
    b.type = 'button'; b.setAttribute('data-k', k);
    if (dead) b.disabled = true;
    b.addEventListener('click', function () { try { go(); } catch (x) {} });
    return b;
  }
  function chips(root, label, items, unlabelled) {
    var d = root.appendChild(mk('div', 'slg-opt'));
    d.setAttribute('role', 'group'); d.setAttribute('aria-label', label);
    if (!unlabelled) d.appendChild(mk('span', 'lb', label));
    items.forEach(function (it) { d.appendChild(btn('slg-var' + (it.on ? ' on' : ''), it.text, it.k, it.go, it.dead)).setAttribute('aria-pressed', it.on ? 'true' : 'false'); });
  }
  /* One sheet of the shell's, filled again on every change. The focus moves only on a new
     sheet or when it was inside this one. A sheet the shell has taken away (a round began)
     is never taken back from here. */
  function paint(m, title, fill) {
    var root = m.root, act = null, k = '', f = null;
    if (root && root.isConnected === false) { m.root = null; m.view = ''; return; }
    if (!root) { root = m.root = m.ctl.sheet(); css(); k = 'main'; }
    else { act = document.activeElement; if (act && act !== root && root.contains(act)) k = (act.getAttribute && act.getAttribute('data-k')) || 'main'; }
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(mk('h2', '', title));
    fill(root);
    if (!k) return;
    f = root.querySelector('[data-k="' + k + '"]');
    if (!f || f.disabled) f = Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return !b.disabled; })[0];
    if (f) { try { f.focus({ preventScroll: true }); } catch (x) {} }
  }
  /* one line and its buttons; the way back to the game's own menu is always there */
  function message(m, text, more) {
    m.view = 'msg';
    paint(m, titleOf(m), function (root) {
      var row, own = !!more && !m.ch;
      line(root, text);
      row = root.appendChild(mk('div', 'row'));
      (more || []).forEach(function (b) { row.appendChild(b); });
      row.appendChild(btn('slg-b' + (more ? '' : ' go'), own ? T.own : T.back, own ? 'own' : more ? 'back' : 'main', function () { leave(m); }));
    });
  }
  function say(m, text) { try { m.ctl.say(text); } catch (x) {} }
  function leave(m) { if (M === m) close(); try { m.ctl.menu(); } catch (x) {} }
  function stop(m, code) { close(); message(m, words(m, code)); }
  /* a sheet's title: Race together's, or the challenge's (⚔️ Challenge — Neon Grand Prix, 🔑 Join with a code) */
  function titleOf(m) {
    var D = m.ch ? m.D : null;
    if (!D) return T.title;
    return m.ch.mode === 'join' ? D.T.join.title : D.fill(D.T.host.title, { game: T.game });
  }
  /* why it can't go on, in Race together's words or a challenge's */
  function words(m, code) {
    var D = m.ch ? m.D : null;
    return D && D.T.reason[code] ? D.T.reason[code] : D && code === 'check' ? D.T.net.check : D && code === 'server' ? D.T.net.server : T[code];
  }

  /* ---------- open: steps 1 to 5 ---------- */
  function open(ctl, cfg, given, opts) {
    try {
      if (!ctl || !cfg) return;
      var e = envOf(given, cfg), l, m, ch = modeOf(cfg, opts), D = isObj(e.Duel) && isObj(e.Duel.T) ? e.Duel : null;
      /* 'Race again' (no mode given) goes back to the open race; a menu button for another kind of room does not */
      if (M && M.cfg === cfg && (!isObj(opts) || (M.ch ? M.ch.mode : 'race') === (ch ? ch.mode : 'race')) && rejoin(M, ctl)) return;
      close();
      l = local(cfg, e);
      if (ch && !D) l = { code: l.code || 'server' };              /* a challenge with no word list: nothing is dialled */
      if (l.code || !e.Net || !e.KL || !e.Peer) return message({ ctl: ctl, root: null, ch: D ? ch : null, D: D }, words({ ch: D ? ch : null, D: D }, l.code || 'offline'));
      hook(cfg, e);
      m = M = { E: e, ctl: ctl, cfg: cfg, given: given, b: l.b, who: e.SC.cacheKey(boundEnv(cfg, e)), fam: null, groups: [], group: null, key: null, roster: null, tags: null, tag: '',
        net: null, tr: null, ses: null, tk: null, root: null, view: '', rows: [], note: '', busy: '', finding: null, ready: null, other: null, seen: null, stale: null,
        warm: '', warmed: '', warmRun: 0, rereadAt: -Infinity, bad: false, stuck: false, wake: null, watch: 0, onVis: null, famSig: '', ch: ch, D: D,
        guard: 0, checking: null, again: false, self: false };
      m.watch = e.timers.setInterval(function () { alive(m); }, WATCH_MS);
      m.guard = e.timers.setInterval(function () { guard(m, false); }, GUARD_MS);
      /* back at the front: the screen lock again, and the clock difference measured afresh */
      m.onVis = function () { if (M !== m || document.hidden) return; wake(m); if (m.ses) { try { m.ses.resync(); } catch (x) {} } };
      document.addEventListener('visibilitychange', m.onVis);
      begin(m);
    } catch (x) {}
  }
  /* leaving the game closes the lobby (once per game), and so does any change of the signed-in account */
  function hook(cfg, e) {
    var orig = cfg.onExit, f = e.firebase;
    if (!cfg._kartLobbyExit) {
      cfg._kartLobbyExit = true;
      cfg.onExit = function () { close(); if (typeof orig === 'function') return orig.apply(this, arguments); };
    }
    if (authOn !== f && typeof f.auth === 'function') {
      authOn = f;
      try { f.auth().onAuthStateChanged(function (user) { if (M && (user && user.uid ? user.uid : '') !== M.b.uid) shut(); }); } catch (x) {}
    }
  }
  /* 'Race again' or 'Back to the lobby' with the race's session still going: its lobby again at
     once. The game-time gate is asked again, and the race key (and, for a starter, the roster)
     is read again before the next race can start (C7). → false when a fresh open is needed */
  function rejoin(m, ctl) {
    var ses = m.ses, st = ses ? ses.state : '', g = null;
    if (st !== 'lobby' && st !== 'results') return false;
    m.ctl = ctl; m.root = null;
    if (!alive(m)) return false;
    try { g = m.cfg.arcade ? m.cfg.arcade.gate() : null; } catch (x) { g = null; }
    if (g && g.allowed === false) { close(); try { ctl.beginRound(); } catch (x) {} return true; }
    if (st === 'results' && !ses.backToLobby()) return false;
    lobby(m);
    guard(m, true);
    return true;
  }

  /* ---------- C7: a grown-up's change ends a race within about a minute ---------- */
  function hosting(m) { var v = m.ses && m.ses.room; return !!v && v.host === true; }
  function company(m) { return hosting(m) && Array.isArray(m.ses.room.players) && m.ses.room.players.some(function (p) { return p && !p.me; }); }
  /* the players in this child's own race whose tag the roster just read no longer has */
  function strays(m) {
    var v = hosting(m) ? m.ses.room : null;
    return v && Array.isArray(v.players) ? v.players.filter(function (p) { return p && !p.me && !has(m.tags || {}, p.tag); }) : [];
  }
  /* The group's race key (and the roster, when asked) read again. → 'ok', 'off' (refused, gone,
     or this child is not in the roster any more), 'key' (a new race key), 'net' (the read only
     failed: nothing is known) or 'stale' (the lobby moved on meanwhile) */
  function recheck(m, withRoster) {
    var g = m.group, key = m.key, priv = g.ref.collection('private');
    return call(m, function () { return Promise.all(withRoster ? [priv.doc('games').get(), priv.doc('roster').get()] : [priv.doc('games').get()]); }).then(function (got) {
      var k = got[0] && got[0].exists ? got[0].data() : null, now = isObj(k) && typeof k.raceKey === 'string' && KEY_RE.test(k.raceKey) ? k.raceKey : '';
      if (M !== m || m.group !== g || m.key !== key) return 'stale';
      if (!now) return 'off';
      if (now !== key) return 'key';
      if (got.length > 1) {
        m.roster = got[1] && got[1].exists ? got[1].data() : null;
        m.tags = m.E.SC.tagMap(key, m.roster);
        if (m.net) m.net.tags = m.tags;
        m.rereadAt = m.E.now();
        if (m.tags[m.tag] !== m.b.uid) return 'off';
      }
      return 'ok';
    }, function (x) { return x && x.code === 'permission-denied' ? 'off' : 'net'; });
  }
  /* every 45 s, with the roster too for a starter with others in the race (force: Race again,
     which also holds the Start button until it is answered) */
  function guard(m, force) {
    var run;
    if (M !== m || !m.group || !m.key || (m.checking && !force)) return;
    if (force) { m.again = true; draw(m); }
    run = m.checking = recheck(m, company(m)).then(function (v) {
      if (m.checking === run) m.checking = null;
      if (force) m.again = false;
      if (M !== m) return;
      if (v === 'off' || v === 'key') return revoke(m);
      if (v === 'ok') prune(m);
      draw(m);
    });
  }
  /* A starter frees the seat of each child whose tag left the roster. Without session.prune
     (an older race network) the race ends instead: nobody stays in it without the grown-up's
     tick. */
  function prune(m) {
    var ses = m.ses;
    if (!ses || !strays(m).length) return;
    if (typeof ses.prune === 'function') { try { ses.prune(); return; } catch (x) {} }
    revoke(m);
  }
  /* the lobby closes and the race is left (a starter's ends for everyone); a sheet of this
     file's says why, a round being driven is left to run on alone (its table says the rest) */
  function revoke(m) {
    var ses = m.ses, ctl = m.ctl, cfg = m.cfg, given = m.given, up = !!m.view && !!m.root && m.root.isConnected !== false;
    var text = m.ch ? T.endedCh : T.ended;
    m.ses = null;
    if (ses) { try { ses.leave('revoked'); } catch (x) {} }
    close();
    say(m, text);
    /* Look again opens afresh, in the mode this game last used (a challenge's word is not kept) */
    if (up) message({ ctl: ctl, root: null, ch: m.ch, D: m.D }, text, [btn('slg-b go', T.again, 'main', function () { open(ctl, cfg, given); })]);
  }
  /* steps 1 to 3: the family record afresh, game time used elsewhere, the time gate */
  function begin(m) {
    var e = m.E, S = e.SC, db = e.firebase.firestore(), uid = m.b.uid;
    message(m, T.wait);
    call(m, function () { return db.collection('families').doc(m.b.familyCode).get(); }).then(function (s) {
      var fam = s && s.exists ? s.data() : null;
      if (!alive(m)) return;
      if (fam && typeof e.applyFamilyCfg === 'function') { try { e.applyFamilyCfg(fam); } catch (x) {} }
      if (!fam || !ticked(S, fam, uid)) return stop(m, 'notswitched');
      m.fam = S.gamesCfg(fam); m.famSig = sigOf(S, fam);
      return call(m, function () { return db.collection('users').doc(uid).get(); }).then(function (us) { if (M === m) elsewhere(m, us); }, noop).then(function () { if (alive(m)) gate(m); });
    }).then(null, function () { if (alive(m)) stop(m, 'offline'); });
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
  /* step 3: no game time left → the shell's own time-up sheet; then the groups */
  function gate(m) {
    var a = m.cfg.arcade, ctl = m.ctl, g = null;
    try { g = a ? a.gate() : null; } catch (x) { g = null; }
    if (g && g.allowed === false) { close(); try { ctl.beginRound(); } catch (x) {} return; }
    groups(m);
  }
  /* step 5: the How-to-play cards, once, for a child who has somewhere to race; then next() */
  function cards(m, next) {
    if (m.cfg.tutSeen) return next();
    m.view = 'cards';
    paint(m, T.how, function (root) {
      var box = root.appendChild(mk('div', 'slg-tut')), row = mk('div', 'row'), list = [];
      try { list = W.SLGames.kart.def.tutorial || []; } catch (x) { list = []; }
      list.forEach(function (c) { var d = box.appendChild(mk('div')); d.appendChild(mk('b', '', c[0])); d.appendChild(document.createTextNode(String(c[1]))); });
      row.appendChild(btn('slg-b go', T.gotIt, 'main', function () {
        if (!m.cfg.tutSeen) { m.cfg.tutSeen = true; try { if (m.cfg.onTutorialSeen) m.cfg.onTutorialSeen(); } catch (x) {} }
        if (alive(m)) next();
      }));
      row.appendChild(btn('slg-b', T.back, 'back', function () { leave(m); }));
      root.appendChild(row);
    });
  }
  /* step 4: the groups this child may race in. The family when its races are on; the class
     named in the child's own record with the family, when the child's own entry is in it and
     its races are on. Of the class only its code is used, as a label ('Otter class'). With
     none, the one line, and the button stays greyed with it (noGroup) */
  function groups(m) {
    var e = m.E, S = e.SC, db = e.firebase.firestore(), uid = m.b.uid, fam = db.collection('families').doc(m.b.familyCode), known = false;
    message(m, T.wait);
    m.groups = m.fam.race ? [{ id: 'family', label: T.family, where: T.inFamily, ref: fam, relay: m.fam.relay }] : [];
    call(m, function () { return fam.collection('kids').doc(uid).get(); }).then(function (s) {
      var d = s && s.exists ? s.data() : null, cls = d && typeof d.cls === 'string' ? d.cls : '', label = S.ON.classes === false ? '' : S.classLabel(cls), c;
      if (!label) { known = true; return; }
      c = db.collection('classes').doc(cls);
      return call(m, function () { return Promise.all([c.collection('members').doc(uid).get(), c.get()]); }).then(function (got) {
        var k = got[1].exists ? got[1].data() : null;
        if (got[0].exists && k && k.race === true && k.closed === false) m.groups.push({ id: 'class', label: label, where: label, ref: c, relay: true });
        known = true;                                    /* every read answered: 'no group' is the real answer, not a lost read */
      });
    }).then(null, noop).then(function () {
      if (!alive(m)) return;
      if (!m.groups.length) { if (known) none = { who: m.who, sig: m.famSig, at: e.now() }; return stop(m, 'notswitched'); }
      if (none && none.who === m.who) none = null;
      cards(m, function () { wake(m); if (m.ch) chStart(m); else pick(m, m.groups[0]); });
    });
  }
  /* The group's race key and roster, read afresh into memory only. Rejects {code: 'check'} when
     either can't be read or this child is not in the roster the grown-up approved, {code: 'gone'}
     when the lobby or the group changed meanwhile. */
  function keyFor(m, g) {
    var S = m.E.SC, priv = g.ref.collection('private');
    return call(m, function () { return Promise.all([priv.doc('games').get(), priv.doc('roster').get()]); }).then(function (got) {
      var k = got[0].exists ? got[0].data() : null, key = k && typeof k.raceKey === 'string' && KEY_RE.test(k.raceKey) ? k.raceKey : '';
      if (!alive(m) || m.group !== g) throw { code: 'gone' };
      if (!key) throw { code: 'check' };
      m.key = key; m.roster = got[1].exists ? got[1].data() : null;
      m.tags = S.tagMap(key, m.roster); m.tag = S.seatTag(key, m.b.uid);
      if (m.tags[m.tag] !== m.b.uid) throw { code: 'check' };
    }, function () { throw { code: 'check' }; });
  }
  /* the chosen group, its key and roster; then its open races (next: a challenge's own step instead) */
  function pick(m, g, next) {
    var old = m.ses;
    m.ses = null; m.group = g; m.key = m.roster = m.tags = null; m.busy = '';
    if (old) { try { old.leave(); } catch (x) {} }
    message(m, T.wait);
    function trouble() { message(m, words(m, 'check'), [btn('slg-b go', T.retry, 'main', function () { pick(m, g, next); })]); }
    keyFor(m, g).then(function () {
      if (!alive(m) || m.group !== g) return;
      if (next) next(); else finder(m, '');
    }, function () { if (alive(m) && m.group === g) trouble(); });
  }
  function wake(m) {
    var wl = m.E.wakeLock;
    if (!wl || typeof wl.request !== 'function') return;
    try { Promise.resolve(wl.request('screen')).then(function (s) { if (M === m) m.wake = s; else if (s && s.release) s.release(); }, noop); } catch (x) {}
  }

  /* ---------- the race network ---------- */
  /* the name this device shows for a seat tag: from its own copy of the roster, never from the wire */
  function nameOf(m, tag, seat) {
    var fb = 'Racer ' + (seat + 1), S = m.E.SC;
    return m.roster && m.tags && has(m.tags, tag) ? S.rosterName(m.roster, m.tags[tag], fb, S.rudeFrom(m.E.core)) : fb;
  }
  /* what the race needs to know of a course, or null for one this device does not have. The
     race is closed at Bronze × 1.5 + 10 s (a course with no medal times: its base track's) */
  function courseInfo(KL, id) {
    var tr, floor, par;
    if (typeof id !== 'string') return null;
    if (has(infos, id)) return infos[id];
    try {
      if (KL.courseIds().indexOf(id) < 0) return null;
      tr = KL.buildTrack(id); floor = KL.floorMs(id); par = KL.PAR[id] || KL.PAR[KL.courseBase(id)] || null;
      return (infos[id] = { len: tr.len, laps: tr.laps, floorMs: floor, layoutKey: KL.layoutKey(id), capMs: Math.round((par ? par.bronze : floor * 2) * 1.5 + 10000) });
    } catch (x) { return null; }
  }
  function best(cfg, id) { var r = cfg.pb && cfg.pb['kart:' + id]; return !!r && r.ms != null; }
  /* the courses a starter may choose: the ones open on their own menu that this device has */
  function courses(m) {
    var list = [], KL = m.E.KL;
    try { list = W.SLGames.kart.def.menuVariants(m.cfg) || []; } catch (x) { list = []; }
    return list.filter(function (v) { return v && !v.locked && !!courseInfo(KL, v.id); }).map(function (v) { return { id: v.id, name: String(v.name) }; });
  }
  /* Lobby tickets (decision D35), handed to the session: {c, s, at} under the child's own
     account id in the group. A starter writes its room number and slot before anyone may
     look in; a joiner writes the number the starter handed it before it asks for a seat;
     each side reads the other's ticket through the tag map. A read or write that fails
     shows one line. c is the number bound to the group's race key (SLKartNet.ticketC), so a
     ticket left behind under an older key never matches; a starter writes its ticket again
     every 5 minutes while its race is open, and a starter's ticket is taken only while it is
     under 15 minutes old by the host's server-anchored clock (cfg.wall: one left behind when a
     tab was killed stops counting, and a device clock that is wrong changes nothing). A joiner's
     ticket needs no age: the number in it is fresh for each look. */
  function tickets(m, g) {
    var col = g.ref.collection('lobby'), mine = col.doc(m.b.uid), stamp = m.E.firebase.firestore.FieldValue, used = false, tk;
    var key = roomKey(m), Net = m.E.Net, e = m.E, again = null;
    function mark(n) { return Net.ticketC(key, n); }
    function bad(x) { m.bad = true; if (M === m && m.view === 'lobby') { m.note = T.check; draw(m); } throw x; }
    function write(c, s) { return call(m, function () { return mine.set({ c: c, s: s, at: stamp.serverTimestamp() }); }); }
    function put(c, s) { used = true; return write(c, s).then(null, bad); }
    function quiet() { if (again !== null) { e.timers.clearInterval(again); again = null; } }
    function fresh(at) {
      var t = at && typeof at.toMillis === 'function' ? at.toMillis() : NaN;
      return isFinite(t) && e.wall() - t <= TICKET_MAX_MS;
    }
    /* never this child's own ticket: a race that answers with this child's own tag was opened on
       another device with the same login (a sibling on one login). It is not listed, nothing is
       joined (a join would overwrite that device's ticket and hide its race), and the list says why. */
    function read(tag, test, looking) {
      var uid = m.tk === tk && m.tags && has(m.tags, tag) ? m.tags[tag] : '';
      if (uid && uid === m.b.uid) { if (looking && M === m) m.self = true; return Promise.resolve(false); }
      if (!uid) return Promise.resolve(false);
      return call(m, function () { return col.doc(uid).get(); }).then(function (s) { return s.exists && test(s.data() || {}); }, bad);
    }
    tk = {
      open: function (slot, r) {
        var c = mark(r);
        quiet();
        return put(c, slot).then(function () {
          again = e.timers.setInterval(function () { if (m.tk === tk && used) write(c, slot).then(null, noop); else quiet(); }, TICKET_EVERY_MS);
        });
      },
      prove: function (h) { quiet(); return put(mark(h), 0); },
      checkHost: function (tag, slot, r) { return read(tag, function (d) { return d.c === mark(r) && d.s === slot && fresh(d.at); }, true); },
      checkJoiner: function (tag, h) { return read(tag, function (d) { return d.c === mark(h); }); },
      close: function () {
        var del = used && m.tk === tk;
        quiet();
        if (m.tk === tk) m.tk = null;
        used = false;
        return del ? mine.delete().then(null, noop) : Promise.resolve();
      }
    };
    return (m.tk = tk);
  }
  /* What the room's address and its tickets are bound to: the group's race key, and for a challenge
     the word too. The seat tags and the roster stay on the race key itself. */
  function roomKey(m) { return m.ch && m.ch.word ? 'slk-word|' + m.key + '|' + m.ch.word : m.key; }
  /* a new session for the chosen group: its own link, relay-only for a class and for a family whose devices are in other homes */
  function session(m) {
    var e = m.E, S = e.SC, KL = e.KL, g = m.group, who = S.who(profileOf(e) || m.cfg.user), tr, dial, ses;
    tr = m.tr = e.Net.peerTransport(e.Peer, e.peerOpts, { relayOnly: !!g.relay, timers: e.timers });
    /* the link-up server is gone for good, or a link that had to be relayed was not */
    if (typeof tr.onDown === 'function') tr.onDown(function () { if (M === m && m.tr === tr && m.view) { m.note = T.server; draw(m); } });
    if (g.relay) {              /* a room that is there but never links within the watchdog: no relay path opened */
      dial = tr.dial;
      tr.dial = function (id, ms) { return dial.call(tr, id, ms).then(null, function (x) { if (x && x.code === 'timeout' && m.tr === tr) m.stuck = true; throw x; }); };
    }
    m.ready = null; m.seen = null; m.stale = null; m.warm = '';
    m.net = { transport: tr, clock: { now: e.now }, timers: e.timers, me: { tag: m.tag, ai: who.ai, ci: who.ci }, groupKey: roomKey(m), tags: m.tags,
      nameOf: function (tag, seat) { return nameOf(m, tag, seat); }, rules: KL.RULES, courseInfo: function (id) { return courseInfo(KL, id); },
      crewTimes: function (id, pace, n) { return KL.fillTimes(id, pace, n); }, tickets: tickets(m, g), SC: S };
    ses = m.ses = e.Net.create(m.net);
    ses.on('room', function (v) { if (m.ses === ses && alive(m)) room(m, v); });
    ses.on('ready', function (r) {
      if (m.ses !== ses) return;
      m.ready = r;
      if (r && !r.allBest && ses.room && ses.room.host && ses.room.crew === 'none') ses.setCrew('gentle');     /* a child with no best came in */
      draw(m);
    });
    ses.on('other', function (row) { if (m.ses === ses) { m.other = row; draw(m); } });
    ses.on('sitout', function (o) { if (m.ses === ses) { m.note = o && o.why === 'update' ? T.update : T.sat; draw(m); } });
    ses.on('go', function (go) { if (m.ses === ses && alive(m)) started(m, ses, go); });
    /* the starter closed the race while this child waited in it: back to the list (a challenge: the one line) */
    ses.on('closed', function () { if (m.ses === ses && M === m && m.view) { m.ses = null; if (m.ch) message(m, m.D.T.results.closed); else finder(m, T.closed); } });
    return ses;
  }
  function renew(m) {
    var old = m.ses;
    m.ses = null;
    if (old) { try { old.leave(); } catch (x) {} }
    return session(m);
  }
  /* the room changed: say who came and went, read the roster once more for a tag it does not know, build a new course */
  function room(m, v) {
    var old = m.seen, now = {}, unknown = false;
    v.players.forEach(function (p) {
      now[p.tag] = p.seat;
      if (p.me) return;
      if (!has(m.tags || {}, p.tag)) unknown = true;
      if (old && !has(old, p.tag)) say(m, nameOf(m, p.tag, p.seat) + ' joined');
    });
    Object.keys(old || {}).forEach(function (t) { if (!has(now, t)) say(m, nameOf(m, t, old[t]) + ' left'); });
    m.seen = now;
    if (m.ch && m.ch.hosted) {
      if (v.players.length > 1) m.ch.met = true;                  /* somebody came: the room stays open */
      if (v.players.length >= SEATS) unannounce(m);              /* a full room: the pop-up is taken back */
    }
    if (unknown) reroster(m);
    if (v.trackOk && v.track !== m.warm) prewarm(v.track);
    draw(m);
  }
  function reroster(m) {
    var g = m.group, e = m.E, t = e.now();
    if (t - m.rereadAt < ROSTER_MS) return;            /* at most once every 30 s */
    m.rereadAt = t;
    call(m, function () { return g.ref.collection('private').doc('roster').get(); }).then(function (s) {
      if (!alive(m) || m.group !== g || !m.key) return;
      m.roster = s.exists ? s.data() : null;
      m.tags = m.net.tags = e.SC.tagMap(m.key, m.roster);
      if (m.tags[m.tag] !== m.b.uid) return revoke(m);         /* this child is not in the roster any more */
      prune(m);
      draw(m);
    }, noop);
  }
  /* GO: the session goes to kart.js for this one round. A device that cannot start (no game
     time left) sends the one neutral 'didn't finish'. */
  function started(m, ses, go) {
    var ok = false;
    m.view = ''; m.root = null; m.note = '';
    unannounce(m);
    say(m, 'The race is starting');
    m.cfg.kartLive = { session: ses };
    /* chunk FR: this round's final table, once, goes to the group's 🏆 Challenge wins (boards.js counts a 1st among the children) */
    var g = m.group, cfg = m.cfg, e = m.E, noted = false;
    try {
      ses.on('table', function (t) {
        var B = null;
        if (noted || !t || !t.final || ses.go !== go || !g || !g.ref) return;
        try { B = typeof e.boards === 'function' ? e.boards() : e.boards; } catch (x) { B = null; }
        if (!B || typeof B.noteWin !== 'function') return;
        noted = true;
        B.noteWin({ scope: g.id === 'class' ? 'class' : 'family', code: g.ref.id, rows: t.rows, race: 'kart:' + go.track + ':' + go.goAt, cfg: cfg });
      });
    } catch (x) {}
    try { ok = m.ctl.beginRound({ variant: go.track, goAt: go.goAt }) === true; } catch (x) { ok = false; }
    m.cfg.kartLive = null;
    if (!ok) { try { ses.sendFinish(null, 0); } catch (x) {} }
  }
  /* Build the course before the start, a step at a time so the sheet stays live: the track,
     its reference run, the 3D backdrop or (in 2D) the course picture; then tell the race this
     device is ready, and whether the child has a best on the course. */
  function prewarm(id) {
    var m = M, e, KL, n = 0, steps, run;
    if (!m || !m.ses || typeof id !== 'string') return;
    e = m.E; KL = e.KL; m.warm = id; run = ++m.warmRun;
    steps = m.warmed === id ? [] : [function () { KL.buildTrack(id); }, function () { KL.bakeRef(id); }, function () { if (!m.ctl.preview(id)) picture(m, id); }];
    steps.push(function () { m.warmed = id; m.ses.ready(id, best(m.cfg, id)); });
    (function next() {
      e.timers.setTimeout(function () {
        if (M !== m || m.warmRun !== run || !m.ses) return;   /* the course changed, or the lobby closed */
        try { steps[n](); } catch (x) {}
        if (++n < steps.length) next();
      }, STEP_MS);
    })();
  }
  /* the 2D course picture is kart.js's own: one idle frame of that course, drawn into a scratch canvas, makes it */
  function picture(m, id) {
    var cv = document.createElement('canvas'), c2 = Object.create(m.cfg);
    c2.variant = id; cv.width = cv.height = 8;
    W.SLGames.kart.def.idle(cv.getContext('2d'), c2);
    cv.width = 0;
  }

  /* ---------- step 6: the races open now ---------- */
  /* the search is this one until a tap on a race takes over (join() clears m.finding) */
  function finder(m, note) {
    var ses = m.ses && m.ses.state === 'idle' ? m.ses : renew(m), over = false, run;
    m.view = 'find'; m.rows = []; m.note = note || ''; m.busy = ''; m.other = null; m.bad = m.stuck = m.self = false;
    run = m.finding = ses.find(function (row) { if (m.ses === ses && m.finding === run && !over) { m.rows.push(row); draw(m); } })
      .then(function () { return true; }, function (x) { return !(x && x.code === 'unreachable'); }).then(function (ok) {
        over = true;
        if (m.ses !== ses || !alive(m) || m.finding !== run) return;
        m.finding = null;
        if (!ok) return unreachable(m);
        if (!m.note) m.note = m.self ? T.ownLogin : m.bad ? T.check : m.stuck && !m.rows.length ? T.server : '';
        draw(m);
      });
    draw(m);
  }
  function unreachable(m) {
    var old = m.ses;
    m.ses = null;
    if (old) { try { old.leave(); } catch (x) {} }
    message(m, T.server, [btn('slg-b go', T.retry, 'main', function () { finder(m, ''); })]);
  }
  /* a race that could not be opened or joined: one plain line, and the list again */
  function failed(m, x, full) {
    var c = x && x.code;
    if (c === 'unreachable') return unreachable(m);
    finder(m, c === 'full' ? full : c === 'ticket' || m.bad ? T.check : c === 'version' ? T.update : T.closed);
  }
  function host(m) {
    var list = courses(m), ses, track;
    if (m.busy) return;
    if (m.self) { m.note = T.ownLogin; return draw(m); }        /* opening one would hide the other device's race */
    if (!list.length) { m.note = T.update; return draw(m); }
    ses = m.ses && m.ses.state === 'idle' ? m.ses : renew(m);          /* still looking: a new session opens the race at once */
    track = list.some(function (c) { return c.id === m.cfg.variant; }) ? m.cfg.variant : list[0].id;
    m.busy = T.opening; m.finding = null; m.note = ''; draw(m);
    ses.host({ track: track, crew: 'gentle' }).then(function () { if (m.ses === ses && alive(m)) lobby(m); },
      function (x) { if (m.ses === ses && alive(m)) failed(m, x, T.full3); });
  }
  /* A tap on a race: at once, even with the search still on (it ends there), prove who this is
     (the ticket), then ask for a seat. Only if that race's link has closed meanwhile ('busy')
     does the tap wait for the search to end, and try once more. */
  function join(m, row) {
    var ses = m.ses, search = m.finding;
    if (m.busy || !ses || !row) return;
    if (m.self) { m.note = T.ownLogin; return draw(m); }        /* joining would overwrite the other device's ticket */
    m.view = 'find'; m.busy = T.joining + nameOf(m, row.tag, 0) + '’s race…'; m.note = ''; m.rows = []; m.stale = ses.room; m.finding = null; draw(m);
    function sit() { return Promise.resolve().then(function () { return ses.join(row); }); }
    sit().then(null, function (x) { if (x && x.code === 'busy' && search) return search.then(sit); throw x; })
      .then(function () { if (m.ses === ses && alive(m)) lobby(m); }, function (x) { if (m.ses === ses && alive(m)) failed(m, x, T.raceFull + '.'); });
  }
  function drawFind(m) {
    paint(m, T.title, function (root) {
      var g = m.group, S = m.E.SC, KL = m.E.KL, row = mk('div', 'row');
      if (m.groups.length > 1) {
        chips(root, 'Race with', m.groups.map(function (x) { return { text: x.label, k: 'g-' + x.id, on: x === g, dead: !!m.busy, go: function () { if (x !== m.group) pick(m, x); } }; }));
      }
      /* a race on this child's own login elsewhere: no new one over it (its line says why) */
      root.appendChild(row).appendChild(btn('slg-b go', T.start, 'main', function () { host(m); }, !!m.busy || (m.self && !m.finding)));
      line(root, m.busy || (m.finding ? T.looking + g.where + '…' : m.rows.length || m.self ? '' : T.none));
      m.rows.forEach(function (r) {
        /* 'full' with a seat still free: the starter's device is answering as many lookers as it
           takes just now (a class opening the list together), so: busy, look again */
        var full = r.state === 'full', busy = full && r.used < SEATS;
        if (r.state === 'version' || !r.trackOk) return line(root, T.update, 'slg-lock');
        root.appendChild(btn('slg-var slk-race', S.avatarAt(r.ai) + ' ' + nameOf(m, r.tag, 0) + '’s race · ' + (KL.courseName(r.track) || '') + ' · ' +
          (busy ? r.used + ' of ' + SEATS + ' · ' + T.raceBusy : full ? T.raceFull : r.used + ' of ' + SEATS + (r.state === 'racing' ? ' · racing now' : '')), 'r-' + r.slot, function () { join(m, r); }, full || !!m.busy));
      });
      line(root, m.note, 'slk-note');
      row = root.appendChild(mk('div', 'row'));
      row.appendChild(btn('slg-b', T.again, 'again', function () { finder(m, ''); }, !!m.busy || !!m.finding));
      row.appendChild(btn('slg-b', T.own, 'own', function () { leave(m); }));
    });
  }

  /* ---------- step 7: the lobby ---------- */
  function lobby(m) {
    var v = m.ses.room;
    m.view = 'lobby'; m.busy = ''; m.other = null; m.finding = null; m.rows = []; m.note = m.bad ? T.check : '';
    draw(m);
    /* built already: ready is said again, with the best the child may have set since */
    if (v && v.trackOk && (m.warm !== v.track || m.warmed === v.track)) prewarm(v.track);
  }
  /* 'Close race' for the starter (it ends for everyone), 'Leave' for a joiner: back to the list */
  function away(m) {
    var old = m.ses;
    m.ses = null;
    if (old) { try { old.leave(); } catch (x) {} }
    finder(m, '');
  }
  function crewName(pace) { var c = CREW.filter(function (x) { return x[0] === pace; })[0]; return c ? c[1] : CREW[0][1]; }
  function drawLobby(m) {
    var ses = m.ses, v = ses && ses.room !== m.stale ? ses.room : null, S = m.E.SC, KL = m.E.KL;
    var c = m.ch, D = c ? m.D : null;
    /* a challenge: Cancel and Leave go back to the game's menu (there is no list of challenges) */
    function out() { if (c) leave(m); else away(m); }
    if (!v) return paint(m, titleOf(m), function (root) { line(root, T.wait); root.appendChild(mk('div', 'row slk-act')).appendChild(btn('slg-b', T.leave, 'away', out)); });
    function nm(p) { return nameOf(m, p.tag, p.seat); }
    var hp = v.players.filter(function (p) { return p.seat === 0; })[0], hn = hp ? nm(hp) : 'Racer 1', open = v.state === 'lobby';
    var here = v.players.filter(function (p) { return p.st === 'lobby' || p.st === 'weak'; }), rdy = here.filter(function (p) { return p.rdy; });
    var others = here.filter(function (p) { return !p.me; }).length;
    paint(m, c ? (v.host ? D.T.host.yours : '⚔️ ' + hn + T.theirs) : v.host ? T.yours : '🏁 ' + hn + '’s race', function (root) {
      if (c) wordBox(m, root, v.host);
      var ol = root.appendChild(mk('ol', 'slk-seats')), row = mk('div', 'row slk-act'), i, p, li, av;
      for (i = 0; i < SEATS; i++) {
        p = v.players[i];
        li = ol.appendChild(mk('li', 'slk-seat' + (p && p.me ? ' me' : '') + (p && p.st === 'weak' ? ' weak' : '')));
        if (!p) { li.appendChild(mk('span', 'slk-st', T.empty)); continue; }
        av = li.appendChild(mk('span', 'slk-av', S.avatarAt(p.ai)));
        av.style.background = S.colorAt(p.ci); av.setAttribute('aria-hidden', 'true');
        li.appendChild(mk('span', 'slk-nm', nm(p) + (p.me ? ' (you)' : '')));
        li.appendChild(mk('span', 'slk-st', p.st === 'weak' ? 'weak signal' : p.st === 'racing' ? 'racing' : p.st === 'results' ? 'at the results' : p.rdy ? '✓ ready' : 'getting ready…'));
      }
      if (v.host) {
        chips(root, 'Course', courses(m).map(function (c) { return { text: c.name, k: 'c-' + c.id, on: c.id === v.track, dead: !open, go: function () { ses.setTrack(c.id); } }; }));
        /* 'Children only' is there only when every child in the lobby already has a best on this course */
        chips(root, 'Glow Crew', CREW.filter(function (c) { return c[0] !== 'none' || (!!m.ready && m.ready.allBest === true); }).map(function (c) {
          return { text: c[1], k: 'p-' + c[0], on: c[0] === v.crew, dead: !open, go: function () { ses.setCrew(c[0]); } };
        }));
        line(root, !open ? T.starting : m.again ? T.checking : others ? '' : v.players.length > 1 ? T.back2 : T.alone);     /* after a race the others are still at their results */
        /* Race again: not before the race key (and the roster) have been read again */
        row.appendChild(btn('slg-b go', T.go + (others ? ' · ' + rdy.length + ' of ' + here.length + ' ready' : ''), 'main', function () { if (!m.again && ses.start()) { m.note = ''; say(m, T.starting); } }, !open || !others || m.again));
        row.appendChild(btn('slg-b', c ? D.T.host.cancel : T.closeRace, 'away', out));
        if (!others && !c) row.appendChild(btn('slg-b', T.own, 'own', function () { leave(m); }));
        if (m.other && open && !others && !c) row.appendChild(btn('slg-b', 'Join ' + nameOf(m, m.other.tag, 0) + '’s race instead', 'other', function () { join(m, m.other); }));
      } else {
        line(root, 'Course: ' + (KL.courseName(v.track) || '') + ' · ' + crewName(v.crew));
        line(root, !v.trackOk ? T.update : !open && hp && hp.st === 'lobby' ? T.starting : !open && hp && hp.st === 'racing' ? hn + '’s race is on. You’re in the next one.' : c ? D.T.join.joined : 'Waiting for ' + hn + ' to start…');
        row.appendChild(btn('slg-b', c ? D.T.join.leave : T.leave, 'away', out));
      }
      root.appendChild(row);
      if (others) line(root, 'Ready: ' + (rdy.map(nm).join(', ') || 'nobody yet') + (rdy.length < here.length ? ' · Getting ready: ' + here.filter(function (p) { return !p.rdy; }).map(nm).join(', ') : ''), 'slg-lock');
      line(root, m.note, 'slk-note');
      line(root, T.noPause + (m.E.wakeLock ? '' : ' ' + T.screenOn), 'slg-lock');
    });
  }
  function draw(m) {
    if (M !== m) return;
    if (m.view === 'find') drawFind(m); else if (m.view === 'lobby') drawLobby(m);
  }

  /* ---------- challenges: a room with a word (KG7) ---------- */
  /* What this open is: null for Race together, else {mode: 'host' | 'join', code}. A menu button says
     ('race', 'host' or 'join'); 'Race again' and 'Start a new race' say nothing and keep the mode this
     game last used (cfg._kartChallenge, the mode only: never a word, a key or a name). */
  function modeOf(cfg, opts) {
    var mode = isObj(opts) && typeof opts.mode === 'string' ? opts.mode : cfg._kartChallenge || 'race';
    if (mode !== 'host' && mode !== 'join') { if (cfg._kartChallenge) cfg._kartChallenge = null; return null; }
    cfg._kartChallenge = mode;
    return { mode: mode, code: mode === 'join' && isObj(opts) && typeof opts.code === 'string' ? opts.code.slice(0, 12) : '', word: '', kind: '',
      pickG: null, hosted: false, met: false, told: false, lone: null, looking: null, failed: false };
  }
  /* after the groups and the cards: a joiner's code box; a starter picks the group (when there are two) */
  function chStart(m) {
    if (m.ch.mode === 'join') {
      var w = m.D.word(m.ch.code);
      if (!w) return chSheet(m, '');
      m.ch.word = w; chLook(m);                              /* a family pop-up's word: looking at once */
      return;
    }
    if (m.groups.length > 1) return chWho(m);
    chPick(m, m.groups[0]);
  }
  function chPick(m, g) { pick(m, g, function () { chHost(m, []); }); }
  function whoLabel(m, g) { return g.id === 'family' ? m.D.T.host.family : m.D.fill(m.D.T.host.klass, { cls: g.label }); }
  function chWho(m) {
    var D = m.D, g = m.ch.pickG || m.groups[0];
    m.view = 'who';
    paint(m, titleOf(m), function (root) {
      var row;
      line(root, D.T.host.who);                              /* the question in full, the chips under it */
      chips(root, D.T.host.who, m.groups.map(function (x) { return { text: whoLabel(m, x), k: 'g-' + x.id, on: x === g, go: function () { m.ch.pickG = x; chWho(m); } }; }), true);
      row = root.appendChild(mk('div', 'row'));
      row.appendChild(btn('slg-b go', D.T.host.open, 'main', function () { chPick(m, g); }));
      row.appendChild(btn('slg-b', T.back, 'back', function () { leave(m); }));
    });
  }
  /* Open the room under a fresh word. Rooms with a word use slot 1 only: a room there already (the
     same word, open in this group right now) or all three taken means another word, 5 at most. */
  function chHost(m, tried) {
    var c = m.ch, list = courses(m), ses, track;
    if (!list.length) return message(m, T.update);
    c.word = m.D.newWord(m.E.random, tried); c.kind = m.group.id; tried.push(c.word);
    ses = renew(m);
    track = list.some(function (x) { return x.id === m.cfg.variant; }) ? m.cfg.variant : list[0].id;
    message(m, m.D.T.host.opening);
    function again() { return tried.length < CH_WORDS ? (chHost(m, tried), true) : false; }
    ses.host({ track: track, crew: 'gentle' }).then(function (r) {
      if (m.ses !== ses || !alive(m)) return;
      if (r && r.slot === 1) return chOpen(m, ses);
      if (!again()) chTrouble(m, 'server');
    }, function (x) {
      if (m.ses !== ses || !alive(m)) return;
      if (x && x.code === 'full' && again()) return;
      chTrouble(m, x && x.code === 'ticket' ? 'check' : x && x.code === 'track' ? 'update' : 'server');
    });
  }
  /* a room that could not be opened: the one line, and a fresh try (the key and roster read again) */
  function chTrouble(m, code) {
    var old = m.ses, g = m.group;
    m.ses = null; m.ch.word = '';
    if (old) { try { old.leave(); } catch (x) {} }
    message(m, words(m, code), [btn('slg-b go', T.retry, 'main', function () { chPick(m, g); })]);
  }
  /* the room is open: the family hears of it (the word only), the word is said aloud, and the room
     closes after 3 minutes if nobody has come */
  function chOpen(m, ses) {
    var c = m.ch, D = m.D;
    c.hosted = true; c.met = false;
    if (c.kind === 'family') { c.told = true; try { m.E.announce(GAME, c.word); } catch (x) {} }
    c.lone = m.E.timers.setTimeout(function () { lonely(m, ses); }, CH_OPEN_MS);
    say(m, D.fill(D.T.host.say, { letters: D.spell(c.word) }));
    lobby(m);
  }
  function lonely(m, ses) {
    var c = m.ch;
    if (M !== m || m.ses !== ses || !c || c.met || ses.state !== 'lobby') return;
    unannounce(m);
    m.ses = null; c.word = '';
    try { ses.leave(); } catch (x) {}
    message(m, m.D.T.host.nobody);
  }
  function unannounce(m) {
    if (!m.ch || !m.ch.told) return;
    m.ch.told = false;
    try { m.E.retract(); } catch (x) {}
  }
  /* the word, big, with what the starter tells the others (family: the pop-up; class: say it) */
  function wordBox(m, root, host) {
    var c = m.ch, D = m.D, box = root.appendChild(mk('div', 'slk-word'));
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', D.fill(D.T.host.say, { letters: D.spell(c.word) }));
    box.appendChild(mk('span', 'slk-emo', '🏎️')).setAttribute('aria-hidden', 'true');
    box.appendChild(mk('span', '', c.word)).setAttribute('aria-hidden', 'true');
    if (host) line(root, c.kind === 'family' ? D.T.host.tellFamily : D.T.host.tellClass);
  }
  /* The joiner's sheet: the 4-character box (letters and digits; the list has OWL2), ▶ Join, Back.
     What is typed is checked against the game words before anything is dialled; it is never shown
     to anyone else, never sent and never kept (the box is made afresh with each sheet). */
  function chSheet(m, note) {
    var c = m.ch, D = m.D, box = null, act = null;
    try { act = document.activeElement; } catch (x) { act = null; }
    m.view = 'join';
    function go() {
      var w = D.word(String((box && box.value) || ''));
      c.code = String((box && box.value) || '').slice(0, 12);
      if (!w) return chSheet(m, D.T.join.notWord);
      c.word = w; chLook(m);
    }
    paint(m, D.T.join.title, function (root) {
      var row = mk('div', 'row slk-boxrow');
      line(root, D.T.join.prompt);
      box = mk('input', 'slk-box');
      box.type = 'text'; box.value = c.code;
      [['data-k', 'main'], ['aria-label', D.T.join.aria], ['maxlength', '6'], ['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'characters'], ['spellcheck', 'false'], ['enterkeyhint', 'go']]
        .forEach(function (a) { box.setAttribute(a[0], a[1]); });
      if (c.looking) box.disabled = true;
      box.addEventListener('keydown', function (ev) { if (ev && ev.key === 'Enter' && !c.looking) { try { ev.preventDefault(); } catch (x) {} go(); } });
      row.appendChild(box);
      row.appendChild(btn('slg-b go', c.failed ? T.retry : D.T.join.go, 'go', go, !!c.looking));
      root.appendChild(row);
      line(root, c.looking ? D.fill(D.T.join.looking, { code: c.word }) : note, 'slk-note');
      root.appendChild(mk('div', 'row')).appendChild(btn('slg-b', T.back, 'back', function () { leave(m); }));
    });
    /* a word to check again (not a game word, or not found): back in the box, when the focus was on this sheet */
    if (note && box && !box.disabled && act && m.root && act !== box && (act.isConnected === false || m.root.contains(act))) { try { box.focus({ preventScroll: true }); } catch (x) {} }
  }
  /* Look for the word's room in every group this child may play in (the family's, the class's), a
     group at a time, 3 times 4 s apart; join the first room that answers. Nothing else is dialled. */
  function chLook(m) {
    var c = m.ch, D = m.D, run = {}, n = 0, seen = { tried: 0, check: 0, server: 0, full: false, update: false, keys: {} };
    c.looking = run; c.failed = false; m.self = false;
    chSheet(m, '');
    say(m, D.fill(D.T.join.looking, { code: D.spell(c.word) }));
    function on() { return M === m && m.ch === c && c.looking === run && alive(m); }
    function attempt() {
      var i = 0;
      (function next() {
        if (!on()) return;
        if (i >= m.groups.length) return ++n < CH_LOOKS ? m.E.timers.setTimeout(function () { if (on()) attempt(); }, CH_GAP_MS) : none();
        chFind(m, m.groups[i++], seen).then(function (row) { if (on()) { if (row) { seen.keys = {}; chJoin(m, row); } else next(); } });
      })();
    }
    /* nothing found: the plainest true line */
    function none() {
      var old = m.ses;
      m.ses = null; c.looking = null; c.failed = true; seen.keys = {};
      if (old) { try { old.leave(); } catch (x) {} }
      /* the room is this child's own login's, on another device: joining it would overwrite that device's ticket */
      chSheet(m, m.self ? T.ownLogin : seen.full ? D.T.join.full : seen.update ? T.update : seen.server === seen.tried ? D.T.net.server : seen.check === seen.tried ? D.T.net.check : D.fill(D.T.join.notFound, { code: c.word }));
    }
    attempt();
  }
  /* one group: its key and roster (read afresh on this search's first look, in its memory after), a
     session for its word room, and the first room in it that takes a seat now → the row, or null
     (seen counts why not) */
  function chFind(m, g, seen) {
    var old = m.ses, had = seen.keys[g.id];
    m.ses = null; m.group = g; m.key = m.roster = m.tags = null;
    if (old) { try { old.leave(); } catch (x) {} }
    seen.tried++;
    return (had ? Promise.resolve().then(function () {
      if (!alive(m) || m.group !== g) throw { code: 'gone' };
      m.key = had.key; m.roster = had.roster; m.tags = had.tags; m.tag = had.tag;
    }) : keyFor(m, g).then(function () { seen.keys[g.id] = { key: m.key, roster: m.roster, tags: m.tags, tag: m.tag }; })).then(function () {
      var ses = renew(m), got = null;
      return new Promise(function (res) {
        m.finding = ses.find(function (row) {
          if (got || m.ses !== ses || !row) return;
          if (row.state === 'version' || !row.trackOk) { seen.update = true; return; }
          if (row.state === 'full') { if (row.used >= SEATS) seen.full = true; return; }
          got = row; res(row);
        }).then(function () { res(got); }, function (x) { if (x && x.code === 'unreachable') seen.server++; res(got); });
      });
    }, function (x) { if (!x || x.code !== 'gone') seen.check++; return null; });
  }
  /* take the seat at once (the search ends there); a room whose link closed meanwhile is asked again once the search is over */
  function chJoin(m, row) {
    var ses = m.ses, c = m.ch, D = m.D, search = m.finding;
    c.looking = null; m.finding = null;
    function sit() { return Promise.resolve().then(function () { return ses.join(row); }); }
    sit().then(null, function (x) { if (x && x.code === 'busy' && search) return search.then(sit); throw x; }).then(function () {
      if (m.ses !== ses || !alive(m)) return;
      say(m, D.T.join.joined);
      lobby(m);
    }, function (x) {
      var k = x && x.code;
      if (m.ses !== ses || !alive(m)) return;
      m.ses = null; c.failed = true;
      try { ses.leave(); } catch (y) {}
      chSheet(m, k === 'full' ? D.T.join.full : k === 'version' ? T.update : k === 'ticket' ? D.T.net.check : k === 'unreachable' ? D.T.net.server : D.fill(D.T.join.notFound, { code: c.word }));
    });
  }

  /* ---------- closing ---------- */
  /* On exit, a profile change, any change of the signed-in account and pagehide. A starter
     whose race is still going keeps passing messages on with no screen until its table is
     final (the session's own detach); anyone else leaves. The ticket is deleted, and the
     key, the roster and the tag map are forgotten, in the session's own copy too. */
  function close() {
    var m = M, ses;
    if (!m) return;
    M = null;
    ses = m.ses;
    m.ses = null; m.view = ''; m.root = null; m.warm = ''; m.warmRun++; m.finding = null;
    if (m.ch) { unannounce(m); m.E.timers.clearTimeout(m.ch.lone); m.ch.looking = null; m.ch.word = m.ch.code = ''; }
    if (ses) { try { ses.detach(); } catch (x) {} }
    if (m.tk) m.tk.close();
    m.E.timers.clearInterval(m.watch);
    m.E.timers.clearInterval(m.guard); m.checking = null; m.again = false;
    try { document.removeEventListener('visibilitychange', m.onVis); } catch (x) {}
    try { if (m.wake && m.wake.release) Promise.resolve(m.wake.release()).then(null, noop); } catch (x) {}
    m.wake = null; m.key = m.roster = m.tags = null; m.rows = []; m.groups = []; m.group = null; m.other = null; m.seen = null; m.tr = null;
    if (m.net) { m.net.groupKey = null; m.net.tags = null; }
  }
  /* A profile switch, a sign-in or sign-out, the page put away: the lobby closes and nothing of
     another child stays on screen. A sheet of this file's, or the results of a shared race
     (its table), gives way to the game's own menu; a round still being driven runs on alone. */
  function shut() {
    var m = M, up = false;
    if (!m) return;
    try { up = (!!m.view && !!m.root && m.root.isConnected !== false) || m.ctl.phase() === 'results'; } catch (x) {}
    close();
    if (up) { try { m.ctl.menu(); } catch (x) {} }
  }

  var API = { reason: reason, open: open, close: close, prewarm: prewarm, _mem: function () { return M; } };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (W) {
    W.SLKartLobby = API;
    try { W.addEventListener('pagehide', shut); } catch (x) {}
  }
})();
