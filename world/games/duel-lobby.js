/* ================================================================
   Debut Run and Encore Shootout — the challenge sheets (window.SLDuelLobby).
   Classic UMD (module.exports in Node). Loaded lazily with social-core.js,
   kart-net.js, duel-core.js, duel-net.js and lobby-groups.js the first time
   a child taps ⚔️ Challenge or 🔑 Join with a code; solo play never loads it.

   Sheets, inside the shell's own (ctl.sheet()), built from DOM nodes with
   textContent only:
     host   the groups and the course (Debut Run) or rival (Shootout) →
            ▶ Open the challenge → the word, big and spoken, who can join, the
            seats with ready ticks, ▶ Start once a friend is ready, Cancel
     join   the 4-character box (only the 50 game words dial anything; the
            family pop-up fills it) → every group the child may play in is
            tried at once and the first room that answers is joined → the same
            seats, and Leave
   At GO it sets cfg.challengeRound and calls ctl.beginRound({variant, goAt});
   the game hands its round to wrap(), which adds the progress pump, the
   friends' strip (Debut Run) or kick pips (Shootout), the head-to-head block,
   team tries and ⚔️ Rematch.

   Rooms are family or class rooms only (plan-ku KU14). What leaves this
   device is duel-net's: a seat tag, avatar and colour as index numbers,
   progress, kick results and scores. A name on screen comes from this
   device's own copy of the roster a grown-up approved (SLLobbyGroups.nameOf),
   never from the wire; the typed code only picks a room and is forgotten when
   the lobby closes. Nothing about another child is stored. Games never award
   or spend anything, and nothing here plays a sound.

     open(ctl, cfg, {game, mode: 'host' | 'join', code?}, env?)
     wrap(round, cfg)         the same round, with resultsExtra, again / againLabel /
                              againState, the progress pump and detach
     strip(mid, data)         mounts / updates the strip or pips (data null: removes it)
     layout(game, vw, vh)     where the strip, runway markers or pips sit (tests)
     close()                  leave, delete the ticket, take the pop-up back, forget everything
     env (test seam)          LG, Duel, Net, KN, SC, Peer, peerOpts, games, lg (lobby-groups' own
                              env), timers, now, random, transport(kind, relay), rules
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays, with its open lobby */
  if (typeof window !== 'undefined' && window.SLDuelLobby) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLDuelLobby;
    return;
  }
  var W = typeof window !== 'undefined' ? window : null;

  /* the lines these sheets need beyond SLDuelCore.T (copy-checked like it) */
  var LT = Object.freeze({
    wait: 'Getting ready…', back: 'Back', how: 'How to play', gotIt: 'Got it — let’s go!',
    you: 'You', me: ' (you)', theirs: '⚔️ {name}’s challenge', course: 'Course: {name}', rival: 'Rival: {name}',
    starting: 'Starting…', playing: 'playing', results: 'at the results', weak: 'weak signal',
    joined: '{name} joined.', left: '{name} left the challenge.', allLeft: 'Everyone else has left the challenge.',
    waitEnd: 'Waiting for the others to finish…', rings: '🎯 {name} played with Timing rings.'
  });

  /* Where the friends' strip, its runway markers and the kick pips sit on the stage (.slg-mid),
     clear of every HUD box (course-hud.js, the Shootout's 3D HUD and 2D canvas HUD, the pads).
     The CSS below is made from these numbers and layout() gives the tests the same boxes.
       course    top right under the counter, beside the HYPE panel: 28 px pills, two to a row when
                 there is room; narrow screens (portrait phones): under the HYPE panel, full width;
                 short landscape (phones held sideways: the top band is where the action flies):
                 a marker per friend on the mini runway instead
       penalty   bottom left, above the prompt line and the KICK pad's top */
  var LAY = {
    pill: 28, gap: 4, minPill: 146, side: 10,
    course: { top: 52, midMax: 330, midVw: 0.46, midPad: 26, midGap: 8, maxPart: 0.34 },
    narrow: { mq: '(max-width: 560px)', top: 132 },
    compact: { mq: '(max-height: 500px) and (orientation: landscape)', bottom: 12, side: 150, max: 420, mark: 24 },
    pen: { left: 12, lift: 18, row: 22, pad: 5, name: 54, pip: 16, max: 300 }
  };
  var STRIP_MS = 250, WATCH_MS = 500, START_MS = 15000, STALE_TICKS = 4;

  var M = null;             /* the open lobby: everything about other children lives here, and only here */

  function noop() {}
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function fmt(n) { return String(Math.max(0, Math.round(+n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- the page around us (the 4th argument of open replaces any part) ---------- */
  function envOf(given) {
    var g = isObj(given) ? given : {};
    function pick(k, d) { return has(g, k) ? g[k] : d; }
    var cr = W && W.crypto && typeof W.crypto.getRandomValues === 'function' ? function (a) { return W.crypto.getRandomValues(a); } : null;
    return {
      LG: pick('LG', W && W.SLLobbyGroups), Duel: pick('Duel', W && W.SLDuelCore), Net: pick('Net', W && W.SLDuelNet),
      KN: pick('KN', W && W.SLKartNet), SC: pick('SC', W && W.SLSocialCore), Peer: pick('Peer', W ? W.Peer : null),
      peerOpts: pick('peerOpts', W ? W.SL_PEER_OPTS : null), games: pick('games', W && W.SLGames), lg: pick('lg', undefined),
      timers: pick('timers', { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); },
        setInterval: function (f, ms) { return setInterval(f, ms); }, clearInterval: function (id) { clearInterval(id); } }),
      /* performance.now(): the shell counts down to GO (beginRound's goAt) on the same clock */
      now: pick('now', function () { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }),
      random: pick('random', cr), transport: pick('transport', null), rules: pick('rules', null)
    };
  }

  /* ---------- CSS: scoped, made once per document from LAY ---------- */
  function css(doc) {
    if (!doc || !doc.head || doc.getElementById('sldCss')) return;
    var C = LAY.course, K = LAY.compact, N = LAY.narrow, P = LAY.pen, px = function (v) { return v + 'px'; };
    /* the HYPE panel's half width plus a gap, as course-hud.js lays it out (min(330px, 46vw) + padding) */
    var stripW = 'min(' + (C.maxPart * 100) + '%,max(calc(50% - ' + px(C.midMax / 2 + C.midPad / 2 + C.midGap + LAY.side) + '),calc(' +
      ((0.5 - C.midVw / 2) * 100).toFixed(0) + '% - ' + px(C.midPad / 2 + C.midGap + LAY.side) + ')))';
    var st = doc.createElement('style');
    st.id = 'sldCss';
    st.textContent = [
      /* the word: big ink letters on a lemon pill; the code box; the seats */
      '.sld-word{display:inline-flex;align-items:center;gap:12px;padding:2px 22px 4px;border-radius:20px;background:#ffe27a;color:#3b2f4a;font:800 64px/1.15 "Baloo 2",system-ui,sans-serif;letter-spacing:.14em;}',
      '.sld-word .sld-emo{font-size:40px;letter-spacing:0;}',
      '@media (max-width: 380px){.sld-word{font-size:48px;padding:2px 16px 4px;}.sld-word .sld-emo{font-size:30px;}}',
      '.sld-box{width:5.2em;box-sizing:border-box;padding:2px 10px;border:3px solid #ffe27a;border-radius:16px;background:#fff;color:#3b2f4a;font:800 40px/1.2 "Baloo 2",system-ui,sans-serif;letter-spacing:.14em;text-align:center;text-transform:uppercase;}',
      '.sld-box:focus{outline:3px solid #3df2ff;outline-offset:2px;}',
      '.sld-seats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;width:100%;max-width:440px;}',
      '.sld-seat{display:flex;align-items:center;gap:8px;min-height:44px;padding:2px 10px;border-radius:12px;background:rgba(255,255,255,.1);font:800 16px system-ui,sans-serif;text-align:left;}',
      '.sld-seat.me{outline:2px solid #ffd23f;outline-offset:-2px;}',
      /* a phone held sideways: the seats two to a line, a smaller word, and Start / Cancel / Leave held at the foot of the sheet */
      '@media (max-height: 520px){.sld-seats{display:grid;grid-template-columns:1fr 1fr;}.sld-seat{min-height:36px;}.sld-word{font-size:40px;padding:0 16px 2px;}.sld-word .sld-emo{font-size:26px;}.sld-box{font-size:30px;}' +
        '.slg-scr .row.sld-foot{position:sticky;bottom:-10px;z-index:2;width:100%;padding:6px 0 10px;margin-bottom:-10px;background:#170f38;box-shadow:0 -6px 10px rgba(19,12,46,.85);}}',
      '.sld-av{flex:0 0 32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;}',
      '.sld-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.sld-st{font-size:15px;color:#e3dcff;}',
      '.slg-scr p.sld-note{color:#ffe27a;}',
      '.slg-scr .slg-var:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;}',
      /* the shell draws a disabled button like a live one: these look greyed */
      '.slg-scr .sld-act .slg-b:disabled,.slg-scr .sld-act .slg-var:disabled,.sld-res .slg-b:disabled{opacity:.5;cursor:default;}',
      /* the friends' strip: light pills with ink text (contrast over 10:1), never blurred */
      '.sld-hud{position:absolute;inset:0;pointer-events:none;z-index:1;font-family:system-ui,sans-serif;}',
      '.sld-strip{position:absolute;right:' + px(LAY.side) + ';top:' + px(C.top) + ';width:' + stripW + ';display:grid;grid-template-columns:repeat(auto-fill,minmax(' + px(LAY.minPill) + ',1fr));gap:' + px(LAY.gap) + ';}',
      '.sld-pill{display:flex;align-items:center;gap:6px;height:' + px(LAY.pill) + ';box-sizing:border-box;padding:0 9px 0 6px;border-radius:14px;background:#fff6d6;color:#2b2140;box-shadow:0 2px 8px rgba(14,11,26,.35);font:800 15px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:0;}',
      '.sld-dot{flex:0 0 12px;height:12px;border-radius:50%;box-shadow:0 0 0 2px #2b2140;}',
      '.sld-pill b{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.sld-bar{flex:1 1 16px;min-width:16px;height:6px;border-radius:3px;background:rgba(43,33,64,.2);position:relative;overflow:hidden;}',
      '.sld-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#2b2140;transition:width .4s linear;}',
      '.sld-sc{flex:0 0 auto;}',
      '.sld-ic{flex:1 1 16px;min-width:16px;text-align:center;font-size:15px;}',
      '.sld-run{display:none;position:absolute;left:50%;transform:translateX(-50%);bottom:' + px(K.bottom) + ';width:min(' + px(K.max) + ',calc(100% - ' + px(2 * K.side) + '));height:26px;}',
      '.sld-mk{position:absolute;top:1px;width:' + px(K.mark) + ';height:' + px(K.mark) + ';margin-left:' + px(-K.mark / 2) + ';border-radius:50%;box-shadow:0 0 0 2px #fff6d6,0 2px 4px rgba(14,11,26,.5);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:left .4s linear;}',
      '@media ' + N.mq + '{.sld-strip{top:' + px(N.top) + ';left:' + px(LAY.side) + ';width:auto;grid-template-columns:1fr 1fr;}}',
      '@media ' + K.mq + '{.sld-strip{display:none;}.sld-run{display:block;}}',
      /* the kick pips: you and your friend, a row each, then the deciders */
      '.sld-pips{position:absolute;left:' + px(P.left) + ';bottom:calc(clamp(64px,13vmin,104px) + ' + px(P.lift) + ');max-width:min(' + px(P.max) + ',calc(100% - ' + px(2 * P.left) + '));box-sizing:border-box;padding:' + px(P.pad) + ' 10px;border-radius:12px;background:#fff6d6;color:#2b2140;box-shadow:0 2px 8px rgba(14,11,26,.35);display:flex;flex-direction:column;gap:2px;}',
      '.sld-prow{display:flex;align-items:center;gap:1px;height:' + px(P.row) + ';font:800 15px/1 system-ui,sans-serif;white-space:nowrap;}',
      '.sld-prow b{width:' + px(P.name) + ';overflow:hidden;text-overflow:ellipsis;margin:0 4px 0 6px;}',
      '.sld-pip{width:' + px(P.pip) + ';text-align:center;font-size:14px;}',
      '.sld-pip.f{color:rgba(43,33,64,.35);}',
      '.sld-pip.dec{border-left:2px solid rgba(43,33,64,.35);}',
      '.sld-pw{margin:0;font:700 15px/1.2 system-ui,sans-serif;max-width:' + px(P.max - 20) + ';white-space:normal;}',
      /* the head-to-head block on the results sheet */
      '.sld-res{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;max-width:480px;}',
      '.slg-scr .sld-res p.sld-line{font:800 20px/1.25 system-ui,sans-serif;color:#fff;text-wrap:balance;}',
      '.slg-scr .sld-res p.sld-line.top{color:#ffe27a;}',
      /* the place: big, before the line; in the list a column of its own, and 'Great effort!' beside the last place's name */
      '.slg-scr .sld-res p.sld-rank{margin:0;font:800 26px/1.2 system-ui,sans-serif;color:#fff;font-variant-numeric:tabular-nums;}',
      '.slg-scr .sld-res p.sld-rank.top{color:#ffe27a;}',
      '.sld-list .sld-pl{flex:0 0 2.4em;text-align:left;}',
      '.sld-list .sld-ke{flex:0 0 auto;font-size:13px;color:#ffe27a;}',
      '.sld-list{list-style:none;margin:0;padding:0;width:100%;display:flex;flex-direction:column;gap:3px;}',
      '.sld-list li{display:flex;align-items:center;gap:8px;min-height:30px;padding:1px 12px;border-radius:12px;background:rgba(255,255,255,.12);font:800 16px system-ui,sans-serif;font-variant-numeric:tabular-nums;}',
      '.sld-list li.me{outline:2px solid #ffd23f;outline-offset:-2px;}',
      '.sld-list .sld-nm{text-align:left;}',
      '.sld-res .sld-pips{position:static;max-width:100%;}.sld-res .sld-prow{height:26px;}.sld-res .sld-pip{width:20px;font-size:17px;}',
      '.sld-res .sld-strip{position:static;width:100%;}',
      /* nothing blinks; bars and markers glide (reduced motion: they jump to where they are) */
      '.sld-rm .sld-bar i,.sld-rm .sld-mk{transition:none;}',
      '@media (prefers-reduced-motion: reduce){.sld-bar i,.sld-mk{transition:none;}}'
    ].join('\n');
    doc.head.appendChild(st);
  }

  /* ---------- where things sit (pure; vw × vh is the window, the stage is vh − 61 tall) ---------- */
  function layout(game, vw, vh, friends) {
    var H = vh - 61, n = clamp(friends | 0 || 1, 1, 4), C = LAY.course, K = LAY.compact, P = LAY.pen, x0, w, cols, rows, y0;
    if (game === 'penalty') {
      var pad = clamp(0.13 * Math.min(vw, vh), 64, 104), h = 2 * P.pad + 2 * P.row + 2 + 2 + 2 * 18;    /* two rows and a two-line status */
      w = Math.min(P.max, vw - 2 * P.left);
      return { mode: 'pips', box: { x0: P.left, x1: P.left + w, y0: H - pad - P.lift - h, y1: H - pad - P.lift } };
    }
    if (vh <= 500 && vw > vh) {
      w = Math.min(K.max, vw - 2 * K.side);
      return { mode: 'runway', box: { x0: vw / 2 - w / 2 - K.mark / 2, x1: vw / 2 + w / 2 + K.mark / 2, y0: H - K.bottom - 26, y1: H - K.bottom } };
    }
    if (vw <= 560) { x0 = LAY.side; w = vw - 2 * LAY.side; cols = 2; y0 = LAY.narrow.top; }
    else {
      w = Math.min(C.maxPart * vw, Math.max(vw / 2 - C.midMax / 2 - C.midPad / 2 - C.midGap - LAY.side, (0.5 - C.midVw / 2) * vw - C.midPad / 2 - C.midGap - LAY.side));
      x0 = vw - LAY.side - w; cols = w >= 2 * LAY.minPill + LAY.gap ? 2 : 1; y0 = C.top;
    }
    rows = Math.ceil(n / cols);
    return { mode: 'pills', cols: cols, box: { x0: x0, x1: x0 + w, y0: y0, y1: y0 + rows * LAY.pill + (rows - 1) * LAY.gap } };
  }

  /* ---------- DOM: nodes and textContent only ---------- */
  function mk(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = String(text);
    return n;
  }
  function line(m, root, text, cls) { return text ? root.appendChild(mk(m.doc, 'p', cls || '', text)) : null; }
  /* k names a button, so the focus can stay on it when the sheet is filled again */
  function btn(m, cls, text, k, go, dead) {
    var b = mk(m.doc, 'button', cls, text);
    b.setAttribute('type', 'button'); b.setAttribute('data-k', k);
    if (dead) b.disabled = true;
    b.addEventListener('click', function () { if (!b.disabled) { try { go(); } catch (x) {} } });
    return b;
  }
  function chips(m, root, label, items) {
    var d = root.appendChild(mk(m.doc, 'div', 'slg-opt sld-act'));
    d.setAttribute('role', 'group'); d.setAttribute('aria-label', label);
    items.forEach(function (it) { d.appendChild(btn(m, 'slg-var' + (it.on ? ' on' : ''), it.text, it.k, it.go, it.dead)).setAttribute('aria-pressed', it.on ? 'true' : 'false'); });
  }
  /* One sheet of the shell's, filled again on every change; the focus moves only on a new sheet
     or when it was inside this one. A sheet the shell has taken away (a round began) is never
     taken back from here, except by a new sheet a child's tap asked for. */
  function paint(m, title, fill) {
    var root = m.root, act = null, k = '', f;
    if (root && root.isConnected === false) root = m.root = null;
    if (!root) { try { root = m.root = m.ctl.sheet(); } catch (x) { return; } m.doc = root.ownerDocument; css(m.doc); k = 'main'; }
    else { act = m.doc.activeElement; if (act && act !== root && root.contains(act)) k = (act.getAttribute && act.getAttribute('data-k')) || 'main'; }
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(mk(m.doc, 'h2', '', title));
    fill(root);
    if (!k) return;
    f = root.querySelector('[data-k="' + k + '"]');
    if (!f || f.disabled) f = Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return !b.disabled; })[0];
    if (f) { try { f.focus({ preventScroll: true }); } catch (x) {} }
  }
  function D(m) { return m.E.Duel; }
  function titleOf(m) { return D(m).fill(D(m).T.host.title, { game: D(m).T.game[m.game] }); }
  /* one line and its buttons; the way back to the game's own menu is always there */
  function message(m, text, more) {
    m.view = 'msg';
    paint(m, m.mode === 'join' ? D(m).T.join.title : titleOf(m), function (root) {
      line(m, root, text);
      var row = root.appendChild(mk(m.doc, 'div', 'row sld-act'));
      (more || []).forEach(function (b) { row.appendChild(b); });
      row.appendChild(btn(m, 'slg-b' + (more ? '' : ' go'), LT.back, more ? 'back' : 'main', function () { leave(m); }));
    });
  }
  function say(m, text) { try { if (text) m.ctl.say(text); } catch (x) {} }
  function leave(m) { if (M === m) close(); try { m.ctl.menu(); } catch (x) {} }
  /* a fresh start: the family record, the groups, their keys and rosters read again */
  function again(m) { return function () { open(m.ctl, m.cfg, { game: m.game, mode: m.mode, code: m.code }, m.given); }; }
  function trouble(m, text) { message(m, text, [btn(m, 'slg-b go', D(m).T.net.retry, 'main', again(m))]); }

  /* ---------- open: the reads, the cards, then the host's or the joiner's sheet ---------- */
  function open(ctl, cfg, opts, given) {
    if (!ctl || !isObj(cfg)) return;
    close();
    var o = isObj(opts) ? opts : {}, e = envOf(given), m;
    m = M = { E: e, given: given, ctl: ctl, cfg: cfg, game: o.game === 'penalty' ? 'penalty' : 'course', mode: o.mode === 'join' ? 'join' : 'host',
      code: typeof o.code === 'string' ? o.code.slice(0, 12) : '', doc: null, root: null, mid: null, view: '', groups: [], me: { ai: 0, ci: 0 },
      group: null, ses: null, trying: [], looking: null, failed: false, word: '', note: '', variant: '', readyFor: '', ready: null, seen: null,
      live: null, autoStart: 0, watch: null, checking: false, revoked: false };
    var missing = !e.Duel || !isObj(e.Duel.T) || !e.LG || !e.Net || !e.KN || !e.SC || !e.Peer;
    if (!e.Duel || !isObj(e.Duel.T)) e.Duel = { T: { host: { title: '⚔️ Challenge' }, join: { title: '🔑 Join with a code' }, game: {}, reason: { offline: 'Challenges need the internet.' } }, fill: function (t) { return t; } };
    m.view = 'wait';
    paint(m, m.mode === 'join' ? D(m).T.join.title : titleOf(m), function (root) { line(m, root, LT.wait); });
    if (!m.root) { M = null; return; }
    m.mid = m.root.parentNode && m.root.parentNode.parentNode;
    hook(cfg);
    m.watch = e.timers.setInterval(function () { watch(m); }, WATCH_MS);
    if (missing) return message(m, D(m).T.reason.offline);
    Promise.resolve().then(function () { return e.LG.open(cfg, e.lg); }).then(function (r) {
      if (M !== m) return;
      m.groups = r.groups || []; m.me = r.me || m.me; m.group = m.groups[0] || null;
      if (!m.group) return trouble(m, D(m).T.net.check);
      cards(m, function () { if (m.mode === 'join') joinStart(m); else pickSheet(m); });
    }, function (x) {
      if (M !== m) return;
      var code = x && x.code;
      if (code === 'closed') return leave(m);
      if (code === 'notime') { close(); try { ctl.beginRound(); } catch (y) {} return; }       /* the shell's own time-up sheet */
      if (code === 'check' || code === 'offline') return trouble(m, (x && x.text) || D(m).T.net.check);
      message(m, (x && x.text) || D(m).T.reason.offline);
    });
  }
  /* leaving the game closes the lobby (once per cfg) */
  function hook(cfg) {
    if (cfg._duelLobbyExit) return;
    var orig = cfg.onExit;
    cfg._duelLobbyExit = true;
    cfg.onExit = function () { close(); if (typeof orig === 'function') return orig.apply(this, arguments); };
  }
  /* the game's How-to-play cards, once, for a child who has not seen them */
  function cards(m, next) {
    if (m.cfg.tutSeen) return next();
    var def = null, list = [];
    try { def = m.E.games[m.game].def; list = (typeof def.tutorialFor === 'function' ? def.tutorialFor(m.cfg) : def.tutorial) || []; } catch (x) { list = []; }
    if (!list.length) return next();
    m.view = 'cards';
    paint(m, LT.how, function (root) {
      var box = root.appendChild(mk(m.doc, 'div', 'slg-tut')), row = mk(m.doc, 'div', 'row');
      list.forEach(function (c) { var d = box.appendChild(mk(m.doc, 'div')); d.appendChild(mk(m.doc, 'b', '', c[0])); d.appendChild(m.doc.createTextNode(String(c[1]))); });
      row.appendChild(btn(m, 'slg-b go', LT.gotIt, 'main', function () {
        if (!m.cfg.tutSeen) { m.cfg.tutSeen = true; try { if (m.cfg.onTutorialSeen) m.cfg.onTutorialSeen(); } catch (x) {} }
        if (M === m) next();
      }));
      row.appendChild(btn(m, 'slg-b', LT.back, 'back', function () { leave(m); }));
      root.appendChild(row);
    });
  }

  /* ---------- the host: who, the course or rival, then the room ---------- */
  /* the courses or rivals the host may choose: the ones open on their own menu */
  function choices(m) {
    var G = D(m).GAMES[m.game], list = [];
    try {
      if (m.game === 'penalty') list = m.E.games.penalty.def.menuVariants(m.cfg).filter(function (v) { return v && !v.locked; }).map(function (v) { return { id: v.id, name: (v.icon ? v.icon + ' ' : '') + v.name }; });
      else list = (m.cfg.ownedVariants || []).map(function (v) { return { id: v.id, name: v.name }; });
    } catch (x) { list = []; }
    list = list.filter(function (v) { return v && G.variants.indexOf(v.id) >= 0; });
    return list.length ? list : [{ id: G.variants[0], name: D(m).T.game[m.game] }];
  }
  function nameOfVariant(m, id) { var c = choices(m).filter(function (v) { return v.id === id; })[0]; return c ? c.name : ''; }
  function pickSheet(m) {
    var T = D(m).T, list = choices(m), g = m.group;
    if (!list.some(function (v) { return v.id === m.variant; })) m.variant = list.some(function (v) { return v.id === m.cfg.variant; }) ? m.cfg.variant : list[0].id;
    m.view = 'pick';
    try { m.ctl.preview(m.variant); } catch (x) {}
    paint(m, titleOf(m), function (root) {
      var row;
      if (m.groups.length > 1) {
        line(m, root, T.host.who);
        chips(m, root, T.host.who, m.groups.map(function (x) { return { text: x.label, k: 'g-' + x.kind, on: x === g, go: function () { m.group = x; pickSheet(m); } }; }));
      }
      if (list.length > 1) {
        line(m, root, m.game === 'penalty' ? T.host.pickRival : T.host.pickCourse);
        chips(m, root, m.game === 'penalty' ? T.host.pickRival : T.host.pickCourse, list.map(function (v) {
          return { text: v.name, k: 'v-' + v.id, on: v.id === m.variant, go: function () { m.variant = v.id; pickSheet(m); } };
        }));
      } else line(m, root, D(m).fill(m.game === 'penalty' ? LT.rival : LT.course, { name: list[0].name }));
      if (m.game === 'penalty') line(m, root, T.host.onlyOne, 'slg-lock');
      row = root.appendChild(mk(m.doc, 'div', 'row sld-act'));
      row.appendChild(btn(m, 'slg-b go', T.host.open, 'main', function () { hostRoom(m, g); }));
      row.appendChild(btn(m, 'slg-b', LT.back, 'back', function () { leave(m); }));
    });
  }
  /* a session for one group: its own link to the link-up server (relay-only for a class, and for a
     family whose devices are in other homes) */
  function session(m, g) {
    var e = m.E, G = D(m).GAMES[m.game], tr, ses, rules = e.rules;
    if (rules == null) {
      try { rules = m.game === 'penalty' ? W.SLPenaltyLogic.PENALTY_RULES : W.SLCourse.COURSE_RULES; } catch (x) { rules = null; }
      if (typeof rules !== 'number') rules = G.rules;
    }
    try {
      tr = e.transport ? e.transport(g.kind, g.relay) : e.Net.transport(e.KN, e.Peer, e.peerOpts, { kind: g.kind, relay: g.relay, timers: e.timers });
      ses = e.Net.create({ game: m.game, kind: g.kind, raceKey: g.raceKey, tags: g.tags, relay: g.relay, transport: tr, clock: { now: e.now }, timers: e.timers,
        me: { tag: g.myTag, ai: m.me.ai, ci: m.me.ci }, nameOf: function (tag, seat) { return e.LG.nameOf(g, tag, seat); },
        tickets: function (text) { return e.LG.tickets(g, text); }, rules: rules, SC: e.SC, getRandomValues: e.random });
    } catch (x) { try { if (tr) tr.close(); } catch (y) {} return null; }
    wire(m, ses, g);
    return ses;
  }
  function hostRoom(m, g) {
    var T = D(m).T, ses = session(m, g);
    m.group = g;
    if (!ses) return trouble(m, T.net.server);
    m.ses = ses;
    message(m, T.host.opening);
    ses.host({ variant: m.variant }).then(function (r) {
      if (M !== m || m.ses !== ses) return;
      m.word = r.word;
      if (g.kind === 'family') { try { m.E.LG.announce(m.game, r.word, g, ses); } catch (x) {} }
      say(m, D(m).fill(T.host.say, { letters: D(m).spell(r.word) }));
      lobby(m);
      ready(m, m.variant);
    }, function (x) {
      if (M !== m || m.ses !== ses) return;
      m.ses = null;
      try { ses.leave(); } catch (y) {}
      trouble(m, x && x.code === 'ticket' ? T.net.check : T.net.server);
    });
  }
  /* this device has its course or rival up (the 3D backdrop shows it): tell the room it is ready */
  function ready(m, variant) {
    var ses = m.ses;
    if (!ses || !variant) return;
    m.readyFor = variant;
    try { m.ctl.preview(variant); } catch (x) {}
    m.E.timers.setTimeout(function () { if (M === m && m.ses === ses && m.readyFor === variant) { try { ses.ready(true); } catch (x) {} } }, 300);
  }

  /* ---------- the joiner: the box, then every group at once ---------- */
  function joinStart(m) {
    var w = D(m).word(m.code);
    if (w) return look(m, w);
    joinSheet(m, m.code ? D(m).T.join.notWord : '');
  }
  /* the 4-character box (letters; the old word OWL2, digit and all, is still taken). What is typed is checked against
     the game words before anything is dialled; it is never shown to anyone else, never sent and
     never kept past the lobby */
  function joinSheet(m, note) {
    var T = D(m).T, box = null, act = null;
    try { act = m.doc.activeElement; } catch (x) { act = null; }
    m.view = 'join';
    function go() {
      var typed = String((box && box.value) || '').slice(0, 12), w = D(m).word(typed);
      m.code = typed;
      if (!w) return joinSheet(m, T.join.notWord);
      look(m, w);
    }
    paint(m, T.join.title, function (root) {
      var row = mk(m.doc, 'div', 'row sld-act');
      line(m, root, T.join.prompt);
      box = mk(m.doc, 'input', 'sld-box');
      box.type = 'text'; box.value = m.looking ? m.word : m.code;
      [['data-k', 'main'], ['aria-label', T.join.aria], ['maxlength', '6'], ['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'characters'], ['spellcheck', 'false'], ['enterkeyhint', 'go'], ['inputmode', 'text']]
        .forEach(function (a) { box.setAttribute(a[0], a[1]); });
      if (m.looking) box.disabled = true;
      box.addEventListener('keydown', function (ev) { if (ev && ev.key === 'Enter' && !m.looking) { try { ev.preventDefault(); } catch (x) {} go(); } });
      row.appendChild(box);
      row.appendChild(btn(m, 'slg-b go', m.failed ? T.net.retry : T.join.go, 'go', go, !!m.looking));
      root.appendChild(row);
      line(m, root, m.looking ? D(m).fill(T.join.looking, { code: m.word }) : note, 'sld-note');
      root.appendChild(mk(m.doc, 'div', 'row')).appendChild(btn(m, 'slg-b', LT.back, 'back', function () { leave(m); }));
    });
    /* a word to check again: the box takes the focus back */
    if (note && box && !box.disabled && m.root && (!act || act === m.doc.body || act.isConnected === false || m.root.contains(act))) { try { box.focus({ preventScroll: true }); } catch (x) {} }
  }
  /* Every group the child may play in (its family room, its class room), all at once; the first
     room that answers is joined and the other tries are left. duel-net dials 3 times over ~10 s. */
  function look(m, w) {
    var T = D(m).T, run = {}, tries = [], why = [], left;
    m.word = w; m.looking = run; m.failed = false;
    joinSheet(m, '');
    say(m, D(m).fill(T.join.looking, { code: D(m).spell(w) }));
    m.groups.forEach(function (g) { var s = session(m, g); if (s) tries.push({ g: g, s: s }); });
    m.trying = tries.map(function (t) { return t.s; });
    left = tries.length;
    if (!left) return lookDone(m, run, ['unreachable']);
    tries.forEach(function (t) {
      t.s.join({ word: w }).then(function () {
        if (M !== m || m.looking !== run || m.ses) { try { t.s.leave(); } catch (x) {} return; }
        m.ses = t.s; m.group = t.g; m.looking = null; m.code = '';
        m.trying.forEach(function (s) { if (s !== t.s) { try { s.leave(); } catch (x) {} } });
        m.trying = [];
        say(m, T.join.joined);
        lobby(m);
        if (t.s.room) room(m, t.s, t.s.room);
      }, function (x) {
        try { t.s.leave(); } catch (y) {}
        why.push(x && x.code);
        if (--left === 0 && M === m && m.looking === run && !m.ses) lookDone(m, run, why);
      });
    });
  }
  /* nothing found: the plainest true line, and ↻ Try again */
  function lookDone(m, run, why) {
    var T = D(m).T, has1 = function (c) { return why.indexOf(c) >= 0; }, all = function (c) { return why.every(function (x) { return x === c; }); };
    m.looking = null; m.failed = true; m.trying = [];
    joinSheet(m, has1('self') && T.join.self ? T.join.self : has1('full') ? T.join.full : has1('started') && T.join.started ? T.join.started :
      has1('version') ? T.results.version : all('unreachable') ? T.net.server :
      has1('ticket') ? T.net.check : D(m).fill(T.join.notFound, { code: m.word }));
  }

  /* ---------- the session's events ---------- */
  function wire(m, ses, g) {
    function mine() { return M === m && m.ses === ses; }
    ses.on('room', function (v) { if (mine()) room(m, ses, v); });
    ses.on('ready', function (r) {
      if (!mine()) return;
      m.ready = r;
      if (m.autoStart && r && r.some) { m.autoStart = 0; try { ses.start(); } catch (x) {} }
      draw(m);
    });
    ses.on('go', function (go) { if (mine()) startRound(m, go); });
    ses.on('sitout', function () { if (mine()) { m.note = D(m).T.net.sat; draw(m); paintBlock(m); } });
    ses.on('rel', function (x) {
      var L = m.live;
      if (!mine() || !L) return;
      L.rows = x.rows; L.dirty = true;
      paintStrip(m);
      if (L.block && !L.end) paintBlock(m);                     /* this show is over: the others' strip lives in the block */
    });
    ses.on('open', function (x) { var L = m.live; if (mine() && L && L.round && typeof L.round.open === 'function') L.round.open(x.k); });
    ses.on('rv', function (x) { var L = m.live; if (mine() && L) { L.rv[x.k] = x.rows; paintStrip(m); } });
    ses.on('dec', function (x) {
      var L = m.live;
      if (!mine() || !L) return;
      L.status = x.retake ? D(m).T.play.usedTry : x.n === 1 ? D(m).T.play.decider : '';
      L.decN = x.n;
      if (L.round && typeof L.round.decide === 'function') L.round.decide('decider', x.n);
      paintStrip(m);
    });
    ses.on('end', function (x) {
      var L = m.live;
      if (!mine() || !L) return;
      L.end = x; L.status = '';
      if (m.game === 'penalty' && L.round && typeof L.round.decide === 'function') L.round.decide('end');
      paintStrip(m); paintBlock(m);
      wonRound(m, x, L);
    });
    ses.on('weak', function () { if (mine() && m.live) paintStrip(m); });
    ses.on('left', function (x) {
      var L = m.live;
      if (!mine()) return;
      if (L) { L.left[x.seat] = true; if (m.game === 'penalty' && L.round) L.round.hold = false; paintStrip(m); paintBlock(m); }
    });
    ses.on('closed', function (x) { if (M === m && m.ses === ses) closed(m, ses, x && x.why); });
  }
  /* the room changed: who came and went (said aloud), a tag this device does not know (the roster
     read again), a guest's course to get ready for */
  function room(m, ses, v) {
    var old = m.seen, now = {}, unknown = false;
    v.players.forEach(function (p) {
      now[p.tag] = p.name;
      if (p.me) return;
      if (!has(m.group && m.group.tags, p.tag)) unknown = true;
      if (old && !has(old, p.tag)) say(m, D(m).fill(LT.joined, { name: p.name }));
    });
    Object.keys(old || {}).forEach(function (t) { if (!has(now, t)) say(m, D(m).fill(LT.left, { name: old[t] })); });
    m.seen = now;
    if (unknown) { try { m.E.LG.reroster(m.group); } catch (x) {} }
    if (!v.host && v.state === 'lobby') {
      var me = v.players.filter(function (p) { return p.me; })[0];
      if (me && !me.rdy && m.readyFor !== v.variant) ready(m, v.variant);
    }
    draw(m);
  }
  /* the room has gone: in the lobby one line; during a round the child plays on; on the results
     the block says so and Rematch rests */
  function closed(m, ses, why) {
    var L = m.live, T = D(m).T;
    m.ses = null; m.autoStart = 0;
    if (L && !m.view) {
      L.closed = why || 'closed';
      if (L.round) { L.round.hold = false; if (m.game === 'penalty' && typeof L.round.decide === 'function') L.round.decide('end'); }
      paintStrip(m); paintBlock(m);
      return;
    }
    if (m.view === 'lobby' || m.view === 'picker' || m.view === 'msg') message(m, why === 'alone' ? T.host.nobody : why === 'version' ? T.results.version : T.results.closed);
  }
  /* has lobby-groups closed its lobby? (an older lobby-groups without alive(): never) */
  function lgGone(m) {
    var LG = m.E.LG;
    try { return !!LG && typeof LG.alive === 'function' && LG.alive() === false; } catch (x) { return false; }
  }
  /* why it closed, as lobby-groups words it (LG.ended() → {code, text} | null), or the plain line */
  function endedText(m) {
    var LG = m.E.LG, why = null;
    try { why = LG && typeof LG.ended === 'function' ? LG.ended() : null; } catch (x) { why = null; }
    return isObj(why) && typeof why.text === 'string' && why.text ? why.text : D(m).T.results.closed;
  }
  /* The challenge may not go on: every session leaves at once (a host closes the room for everyone
     even mid-round: the others play their own round on and their results say it was closed); in
     a round this child plays on alone and the results say why; in a lobby sheet, one line and Back. */
  function revoked(m) {
    var L = m.live, list = (m.ses ? [m.ses] : []).concat(m.trying || []), text = endedText(m);
    m.revoked = true; m.ses = null; m.trying = []; m.looking = null;
    if (m.autoStart) { try { m.E.timers.clearTimeout(m.autoStart); } catch (x) {} m.autoStart = 0; }
    list.forEach(function (s) { try { s.leave('revoked', true); } catch (x) {} });
    if (L && !m.view) {
      L.closed = 'revoked'; L.closedText = text;
      if (L.round) { L.round.hold = false; if (m.game === 'penalty' && typeof L.round.decide === 'function') { try { L.round.decide('end'); } catch (x) {} } }
      paintStrip(m); paintBlock(m);
      return;
    }
    message(m, text);
  }
  /* Before each rematch or team try: lobby-groups reads the group's switches and roster again
     (LG.recheck(group) → Promise<boolean>; false: revoked, and it has closed itself). A failed read
     (offline) does not hold the children up; an older lobby-groups without recheck(): at once. */
  function checked(m, go) {
    var LG = m.E.LG, ses = m.ses, p = null;
    if (m.checking) return;
    try { p = LG && typeof LG.recheck === 'function' ? LG.recheck(m.group) : null; } catch (x) { p = null; }
    if (!p || typeof p.then !== 'function') return go();
    m.checking = true; draw(m);
    p.then(function (ok) { return ok; }, function () { return true; }).then(function (ok) {
      m.checking = false;
      if (M !== m || m.ses !== ses || !ses) return;
      if (ok === false) return revoked(m);
      go();
    });
  }
  function draw(m) {
    if (M !== m) return;
    if (m.view === 'lobby') drawLobby(m);
    else if (m.view === 'picker') picker(m);
  }

  /* ---------- the lobby: the word, the seats, Start / Cancel / Leave ---------- */
  function lobby(m) { m.view = 'lobby'; m.note = ''; drawLobby(m); }
  function wordBox(m, root) {
    var box = root.appendChild(mk(m.doc, 'div', 'sld-word'));
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', D(m).fill(D(m).T.host.say, { letters: D(m).spell(m.word) }));
    box.appendChild(mk(m.doc, 'span', 'sld-emo', D(m).GAMES[m.game].emoji)).setAttribute('aria-hidden', 'true');
    box.appendChild(mk(m.doc, 'span', '', m.word)).setAttribute('aria-hidden', 'true');
  }
  function seats(m, root, v) {
    var S = m.E.SC, T = D(m).T, ol = root.appendChild(mk(m.doc, 'ol', 'sld-seats'));
    v.players.forEach(function (p) {
      var li = ol.appendChild(mk(m.doc, 'li', 'sld-seat' + (p.me ? ' me' : ''))), av = li.appendChild(mk(m.doc, 'span', 'sld-av', S.avatarAt(p.ai)));
      av.style.background = S.colorAt(p.ci); av.setAttribute('aria-hidden', 'true');
      li.appendChild(mk(m.doc, 'span', 'sld-nm', p.name + (p.me ? LT.me : '')));
      li.appendChild(mk(m.doc, 'span', 'sld-st', p.st === 'weak' ? '📶 ' + LT.weak : p.st === 'playing' ? LT.playing : p.st === 'results' ? LT.results : p.rdy ? '✓ ' + T.host.ready : T.host.waiting));
    });
  }
  function drawLobby(m) {
    var T = D(m).T, ses = m.ses, v0 = ses && ses.room, host = v0 ? v0.host : !!ses && ses.role === 'host';
    /* (before the room's first word: the word, no seats yet) */
    var v = v0 || { state: 'lobby', variant: host ? m.variant : '', host: host, players: [] };
    var hp = v.players.filter(function (p) { return p.seat === 0; })[0], others = v.players.filter(function (p) { return !p.me; });
    var starting = v.state === 'lobby' && !!ses && ses.state === 'starting', some = !!(m.ready && m.ready.some);
    paint(m, host ? T.host.yours : hp ? D(m).fill(LT.theirs, { name: hp.name }) : T.join.title, function (root) {
      var row = mk(m.doc, 'div', 'row sld-act sld-foot');
      wordBox(m, root);
      if (host) line(m, root, m.group && m.group.kind === 'class' ? T.host.tellClass : T.host.tellFamily);
      seats(m, root, v);
      if (host && !others.length) line(m, root, m.game === 'penalty' ? T.host.onlyOne : T.host.alone);
      if (v.variant) line(m, root, D(m).fill(m.game === 'penalty' ? LT.rival : LT.course, { name: nameOfVariant(m, v.variant) || D(m).T.game[m.game] }), 'slg-lock');
      if (host) {
        row.appendChild(btn(m, 'slg-b go', T.host.start, 'main', function () {
          if (ses.start()) { say(m, LT.starting); drawLobby(m); }
        }, starting || !some || !!m.autoStart));
        row.appendChild(btn(m, 'slg-b', T.host.cancel, 'away', function () { leave(m); }));
      } else {
        line(m, root, T.join.joined);
        row.appendChild(btn(m, 'slg-b', T.join.leave, 'away', function () { leave(m); }));
      }
      root.appendChild(row);
      if (starting || m.autoStart) line(m, root, LT.starting, 'sld-note');
      line(m, root, m.note, 'sld-note');
    });
  }
  /* ⚔️ Rematch (the host): a new stage or new marker starts, any course or rival, the same word and
     group; Start sets it up and starts as soon as a friend is ready */
  function picker(m) {
    var T = D(m).T, ses = m.ses, v = ses && ses.room, list = choices(m);
    if (!v) return;
    m.view = 'picker';
    paint(m, T.host.yours, function (root) {
      var row = mk(m.doc, 'div', 'row sld-act sld-foot');
      wordBox(m, root);
      if (list.length > 1) chips(m, root, m.game === 'penalty' ? T.host.pickRival : T.host.pickCourse, list.map(function (c) {
        return { text: c.name, k: 'v-' + c.id, on: c.id === m.variant, dead: !!m.autoStart, go: function () { m.variant = c.id; try { m.ctl.preview(c.id); } catch (x) {} picker(m); } };
      }));
      seats(m, root, v);
      row.appendChild(btn(m, 'slg-b go', T.host.start, 'main', function () { rematch(m); }, !!m.autoStart || !!m.checking));
      row.appendChild(btn(m, 'slg-b', T.host.cancel, 'away', function () { leave(m); }));
      root.appendChild(row);
      if (m.autoStart) line(m, root, LT.starting, 'sld-note');
      line(m, root, m.note, 'sld-note');
    });
  }
  function rematch(m) {
    if (!m.ses || m.checking) return;
    checked(m, function () {                                      /* the grown-up's switches and the roster, read again first */
      var ses = m.ses;
      if (!ses || !ses.rematch({ variant: m.variant })) { draw(m); return; }
      setUp(m);
    });
  }
  function setUp(m) {
    m.live = null; m.note = '';
    m.autoStart = m.E.timers.setTimeout(function () { if (M === m && m.autoStart) { m.autoStart = 0; draw(m); } }, START_MS) || 1;
    lobby(m);
    ready(m, m.variant);
  }

  /* ---------- GO: one round, handed to the game ---------- */
  function startRound(m, go) {
    var cfg = m.cfg, cr = { seed: go.seed, variant: go.variant }, ok = false;
    /* the Shootout's keeper reacts to the ball (PENALTY_RULES 3): there are no keeper moves to hand over */
    if (m.game === 'penalty') cr.duel = { hold: true, deciders: true };
    if (m.autoStart) { m.E.timers.clearTimeout(m.autoStart); m.autoStart = 0; }
    m.live = { r: go.r, seat: go.seat, players: go.players, tries: go.tries, round: null, rows: null, rv: {}, mine: {}, end: null, closed: '', left: {},
      atK: -1, lastK: -1, decN: 0, held: false, logN: 0, fin: false, said: false, steps: 0, seenSteps: 0, stale: 0, block: null, nextT: 0, lastSt: '', paused: false, status: '', offer: true, dirty: true, sig: '' };
    m.view = ''; m.root = null; m.note = '';
    cfg.challengeRound = cr;
    try { ok = m.ctl.beginRound({ variant: go.variant, goAt: go.goAt }) === true; } catch (x) { ok = false; }
    if (cfg.challengeRound === cr) cfg.challengeRound = null;     /* never left for a solo round */
    if (!ok) { m.live = null; close(); }                           /* no game time left: the shell says so, this device leaves */
  }

  /* ---------- wrap: the challenge around the game's own round (the same object comes back) ---------- */
  function wrap(round, cfg) {
    var m = M, L = m && m.live;
    if (!round || !L || L.round || m.cfg !== cfg || typeof round.step !== 'function') return round;
    L.round = round;
    var step0 = round.step, extra0 = round.resultsExtra, detach0 = round.detach, finish0 = round.onFinish;
    round.step = function (dt, held) { step0.call(round, dt, held); L.steps++; if (M === m && m.live === L) pump(m, L); };
    round.onFinish = function () { if (finish0) finish0.apply(round, arguments); if (M === m && m.live === L) done(m, L); };
    round.resultsExtra = function (el, ctl) {
      if (M === m && m.live === L && el) {
        done(m, L);
        strip(m.mid, null);
        L.block = el.appendChild(mk(el.ownerDocument, 'div', 'sld-res'));
        paintBlock(m);
        /* the course or rival is the host's: 🗺️ Change course would leave the challenge without a word */
        var chg = el.parentNode && el.parentNode.querySelector ? el.parentNode.querySelector('#slgMenu') : null;
        if (chg) chg.remove();
      }
      /* the game's own block (the coach line) — without the solo 🎯 retry, which would leave the challenge */
      if (typeof extra0 === 'function') extra0.call(round, el, { say: ctl && ctl.say, esc: ctl && ctl.esc, phase: ctl && ctl.phase });
    };
    round.againLabel = D(m).T.results.rematch;
    round.again = function () { if (M === m && againState(m).disabled === false) picker(m); };
    round.againState = function () { return M === m ? againState(m) : { disabled: true, note: D(m).T.results.closed }; };
    round.detach = function () {
      if (detach0) { try { detach0.apply(round, arguments); } catch (x) {} }
      if (M === m) close();
    };
    paintStrip(m);
    return round;
  }
  /* each step of the round: what the challenge needs to know, sent at once or at most 4 times a second */
  function pump(m, L) {
    var r = L.round, s = r.state, ses = m.ses, lg, k;
    if (r.done) { done(m, L); return; }
    if (!ses || !s) return;
    if (m.game === 'course') {
      var st = s.curtain ? 'bow' : s.finished ? 'arch' : 'run';
      if (s.t < L.nextT && st === L.lastSt) return;
      L.nextT = s.t + STRIP_MS / 1000; L.lastSt = st;
      send(m, L, st);
      return;
    }
    /* the Shootout: waiting at kick k (lockstep), then each kick's result as it lands */
    if (s.phase === 'ready' && !s.waitDecide && s.kick !== L.atK) { L.atK = s.kick; ses.progress({ k: s.kick, phase: 'ready' }); paintStrip(m); }
    if (!!s.held !== L.held) { L.held = !!s.held; paintStrip(m); }
    if (s.log.length > L.logN) {
      L.logN = s.log.length; lg = s.log[s.log.length - 1]; k = s.kick;
      L.mine[k] = lg.res; L.lastK = k;
      /* a decider goal carries a nominal 100 (deciders never count towards a score) */
      ses.kick(k, lg.res, lg.res === 'goal' ? lg.pts || 100 : 0);
      paintStrip(m);
    }
  }
  function send(m, L, st) {
    var r = L.round, s = r.state, sc = 0;
    try { sc = r.score(); } catch (x) { sc = 0; }
    if (m.ses) m.ses.progress({ sec: Math.min(5, s.section | 0), prog: Math.round((s.progress || 0) * 1000), score: sc, st: st });
  }
  /* Twice a second while the lobby is open. The child has left the challenge through the shell
     (back on the game's menu with no sheet of ours up, or ↻ Restart from the pause sheet: the shell
     plays a new solo round and this one stops stepping): the lobby closes, so the friends see this
     device leave. A paused show (the shell's own pause sheet) is ⏸ for the others. */
  function watch(m) {
    var L = m.live, r = L && L.round, ph = '';
    if (M !== m) { m.E.timers.clearInterval(m.watch); return; }
    /* C8: the groups' lobby has closed itself (a sign-out, another profile, or a grown-up's change:
       unticked, challenges off, a new race key, the class closed): this challenge ends too */
    if (!m.revoked && (m.ses || L || (m.trying && m.trying.length)) && lgGone(m)) return revoked(m);
    /* C7: a host frees the seat of a child who has left the roster lobby-groups holds (it reads it
       again in place: reroster, recheck), mid-round too, so an unticked child's challenge ends */
    if (m.ses && m.ses.role === 'host' && typeof m.ses.prune === 'function') { try { m.ses.prune(); } catch (x) {} }
    try { ph = m.ctl.phase(); } catch (x) { ph = ''; }
    if (!m.view && (ph === 'menu' || ph === 'tutorial' || ph === 'timeup')) return close();
    if (!r || L.fin) return;
    L.stale = ph === 'playing' && L.steps === L.seenSteps ? L.stale + 1 : 0;
    L.seenSteps = L.steps;
    if (L.stale >= STALE_TICKS) return close();
    if (m.game === 'course' && (ph === 'paused') !== L.paused) { L.paused = ph === 'paused'; send(m, L, L.paused ? 'pause' : r.state.curtain ? 'bow' : r.state.finished ? 'arch' : 'run'); }
    if (L.dirty) paintStrip(m);
  }
  /* this device's round is over: its result to the room, once */
  function done(m, L) {
    if (L.fin) return;
    L.fin = true;
    var r = L.round, s = r.state || {}, res = null;
    try { res = r.result(); } catch (x) { res = null; }
    res = res || { score: 0, extra: 0 };
    if (m.ses) { try { m.ses.finish(res.score, res.extra, m.game === 'course' ? (s.finished ? 'arch' : 'bow') : 'done'); } catch (x) {} }
  }
  /* Rematch: the host, once the table is in and a friend is still here; a guest waits for the host */
  function againState(m) {
    var T = D(m).T, L = m.live, ses = m.ses, v = ses && ses.room, hp, friends;
    if (!ses || (L && L.closed)) return { disabled: true, note: L && L.block ? '' : L && L.closed === 'revoked' ? L.closedText : T.results.closed };
    if (!L || !L.end) return { disabled: true, note: '' };
    friends = v ? v.players.filter(function (p) { return !p.me; }) : [];
    if (!friends.length) return { disabled: true, note: LT.allLeft };
    if (v.host) return { disabled: false, note: '' };
    hp = v.players.filter(function (p) { return p.seat === 0; })[0];
    return { disabled: true, note: D(m).fill(T.results.waitRematch, { name: hp ? hp.name : 'Player 1' }) };
  }

  /* ---------- the strip (Debut Run) and the kick pips (Shootout) ---------- */
  function seatInfo(L, seat) { for (var i = 0; i < L.players.length; i++) if (L.players[i].seat === seat) return L.players[i]; return null; }
  /* full: the results' rows (every kick, the deciders after a bar); during play the Shootout's rows
     show the 8 kicks, then only the decider kicks (the goals were level), so the box stays narrow */
  function stripData(m, full) {
    var L = m.live, rows = [], me = L.seat;
    if (m.game === 'course') {
      (L.rows || L.players.map(function (p) { return { seat: p.seat, name: p.name, prog: 0, score: 0, st: 'run', weak: false, me: p.me }; })).forEach(function (r) {
        var p = seatInfo(L, r.seat);
        if (r.me || r.seat === me || r.st === 'left' || L.left[r.seat] || !p) return;
        rows.push({ seat: r.seat, name: r.name, ai: p.ai, ci: p.ci, prog: r.prog, score: r.score, st: r.st, weak: !!r.weak });
      });
      return { game: 'course', rows: rows };
    }
    var friend = L.players.filter(function (p) { return p.seat !== me; })[0], mine = [], theirs = [], k, dn = Math.max(L.decN || 0, deciders(L)), wait = '';
    for (k = !full && dn ? 8 : 0; k < 8 + dn; k++) {
      var rv = L.rv[k], fr = null;
      if (rv) rv.forEach(function (w) { if (w.seat !== me) fr = w.res; });
      mine.push(L.mine[k] || null);
      theirs.push(fr || (L.mine[k] && friend && !L.left[friend.seat] && !L.closed ? 'wait' : null));
    }
    var held = L.round && L.round.state && (L.round.state.held || (L.lastK >= 0 && !L.rv[L.lastK]));
    if (friend && !L.end && !L.closed && !L.left[friend.seat] && held) wait = D(m).fill(D(m).T.play.waitingKick, { name: friend.name });
    rows.push({ seat: me, name: LT.you, ci: (seatInfo(L, me) || {}).ci, pips: mine, me: true, dec: !full && dn > 0 });
    if (friend) rows.push({ seat: friend.seat, name: friend.name, ci: friend.ci, pips: theirs, dec: !full && dn > 0 });
    return { game: 'penalty', rows: rows, status: wait || L.status || '' };
  }
  function deciders(L) { var n = 0; for (var k in L.rv) if (has(L.rv, k) && +k >= 8) n = Math.max(n, +k - 7); for (var j in L.mine) if (has(L.mine, j) && +j >= 8) n = Math.max(n, +j - 7); return n; }
  function paintStrip(m) {
    var L = m.live;
    if (!L || !L.round || L.fin || !m.mid) return;
    L.dirty = false;
    strip(m.mid, stripData(m), m);
  }
  function pipRow(doc, S, r) {
    var row = mk(doc, 'div', 'sld-prow' + (r.me ? ' me' : '')), dot = row.appendChild(mk(doc, 'i', 'sld-dot'));
    dot.style.background = S ? S.colorAt(r.ci) : '#8a5cff';
    row.appendChild(mk(doc, 'b', '', r.name));
    if (r.dec) row.appendChild(mk(doc, 'span', 'sld-pip', '⚡'));
    r.pips.forEach(function (p, i) {
      var c = 'sld-pip' + (i === 8 ? ' dec' : '') + (p ? '' : ' f');
      row.appendChild(mk(doc, 'span', c, p === 'goal' ? '⚽' : p === 'wait' ? '…' : p ? '•' : '○'));
    });
    return row;
  }
  /* ⏸ paused, 📶 silent for 4 s, 🎭 the show ended early (a curtain call), 🏁 at the arch */
  function statusIcon(r) { return r.st === 'bow' ? '🎭' : r.st === 'arch' ? '🏁' : r.weak ? '📶' : r.st === 'pause' ? '⏸' : ''; }
  function pill(doc, S, r) {
    var p = mk(doc, 'div', 'sld-pill'), dot = p.appendChild(mk(doc, 'i', 'sld-dot')), bar, ic;
    dot.style.background = S ? S.colorAt(r.ci) : '#8a5cff';
    p.appendChild(mk(doc, 'b', '', r.name));
    ic = statusIcon(r);
    if (ic) p.appendChild(mk(doc, 'span', 'sld-ic', ic));
    else { bar = p.appendChild(mk(doc, 'span', 'sld-bar')).appendChild(mk(doc, 'i')); bar.style.width = clamp(Math.round((r.prog || 0) / 10), 0, 100) + '%'; }
    p.appendChild(mk(doc, 'span', 'sld-sc', fmt(r.score)));
    return p;
  }
  /* mounts, updates or (data null) removes the strip or pips in the stage; DOM only on a change */
  function strip(mid, data, m) {
    var doc = mid && mid.ownerDocument, el = mid && mid.querySelector ? mid.querySelector('.sld-hud') : null, sig, S, inner, box, rows;
    if (!mid || !doc) return null;
    if (!data || !data.rows || !data.rows.length) { if (el) el.remove(); return null; }
    css(doc);
    sig = JSON.stringify(data);
    if (el && el.getAttribute('data-sig') === sig) return el;
    S = (m && m.E.SC) || (W && W.SLSocialCore) || null;
    if (!el) { el = mid.appendChild(mk(doc, 'div', 'sld-hud')); el.setAttribute('aria-hidden', 'true'); }
    el.className = 'sld-hud' + ((m && m.cfg && m.cfg.reduced) || data.reduced ? ' sld-rm' : '');
    el.setAttribute('data-sig', sig);
    while (el.firstChild) el.removeChild(el.firstChild);
    if (data.game === 'penalty') {
      box = el.appendChild(mk(doc, 'div', 'sld-pips'));
      data.rows.forEach(function (r) { box.appendChild(pipRow(doc, S, r)); });
      if (data.status) box.appendChild(mk(doc, 'p', 'sld-pw', data.status));
      return el;
    }
    inner = el.appendChild(mk(doc, 'div', 'sld-strip'));
    rows = el.appendChild(mk(doc, 'div', 'sld-run'));
    data.rows.slice(0, 4).forEach(function (r) {
      var mkr = rows.appendChild(mk(doc, 'span', 'sld-mk', statusIcon(r) || (S ? S.avatarAt(r.ai) : '')));
      mkr.style.left = clamp(Math.round((r.prog || 0) / 10), 0, 100) + '%';
      mkr.style.background = S ? S.colorAt(r.ci) : '#8a5cff';
      inner.appendChild(pill(doc, S, r));
    });
    return el;
  }

  /* ---------- chunk FR: a 1st place counts on the group's 🏆 Challenge wins ----------
     Once per round, when its final table arrives: the places duel-core gives (ties share a place),
     the child's own row as 'me' and every other child's as 'kid', handed to SLBoards.noteWin with the
     group this challenge is in (its family, or its class, by the code its record is under).
     boards.js decides whether this child came 1st among the children and writes one more win in the
     child's own record there; it makes no call at all without every gate (and without boards.js).
     The 4th argument of open() may hand it in as boards (a test seam) */
  function wonRound(m, x, L) {
    try {
      var B = has(m.given, 'boards') ? m.given.boards : W && W.SLBoards, g = m.group, Dc = D(m), code = g && g.ref && typeof g.ref.id === 'string' ? g.ref.id : '';
      if (!B || typeof B.noteWin !== 'function' || !g || !code || !x || !Array.isArray(x.rows) || L.won === x) return;
      L.won = x;
      var st = Dc.standings(x.rows.map(function (r) { return { seat: r.seat, score: r.score, extra: r.extra, st: r.st, dec: r.dec }; }), m.game);
      B.noteWin({ scope: g.kind === 'class' ? 'class' : 'family', code: code, race: x, cfg: m.cfg,
        rows: st.map(function (r) { return { kind: r.seat === L.seat ? 'me' : 'kid', place: r.ok ? r.place : null }; }) });
    } catch (e) {}
  }

  /* ---------- the head-to-head block on the results sheet ---------- */
  /* why the challenge ended early, in one line */
  function closedLine(m, L) {
    var T = D(m).T;
    return L.closed === 'lost' ? T.results.ended : L.closed === 'version' ? T.results.version : L.closed === 'revoked' && L.closedText ? L.closedText : T.results.closed;
  }
  function paintBlock(m) {
    var L = m.live, el = L && L.block, Dc = D(m), T = Dc.T, doc, x, names, ln, ses = m.ses, v = ses && ses.room, host = !!(v && v.host);
    if (!el || el.isConnected === false) return;
    doc = el.ownerDocument;
    while (el.firstChild) el.removeChild(el.firstChild);
    x = L.end;
    if (!x) {
      line(m, el, L.closed ? closedLine(m, L) : LT.waitEnd, 'sld-line');
      var d = !L.closed && stripData(m);
      if (d && m.game === 'course' && d.rows.length) { var s0 = el.appendChild(mk(doc, 'div', 'sld-strip')); d.rows.forEach(function (r) { s0.appendChild(pill(doc, m.E.SC, r)); }); }
      return;
    }
    names = function (seat) { var r = x.rows.filter(function (w) { return w.seat === seat; })[0]; return r ? r.name : 'Player ' + (seat + 1); };
    ln = Dc.line(L.seat, x.rows, m.game, names, x.outcome);
    /* the child's place in the round (James, 24 Oct 2026: rank and compare), the last place with
       the kind words; then the head-to-head line. An older duel-core has no rank: the line alone */
    if (ln.rank) line(m, el, ln.rank, 'sld-rank' + (ln.place === 1 ? ' top' : ''));
    line(m, el, ln.text, 'sld-line' + (ln.kind === 'top' || ln.kind === 'tie' ? ' top' : ''));
    if (!L.said) { L.said = true; say(m, ln.rank ? ln.rank + (/[!.?]$/.test(ln.rank) ? ' ' : '. ') + ln.text : ln.text); }
    var st = Dc.standings(x.rows.map(function (r) { return { seat: r.seat, score: r.score, extra: r.extra, st: r.st, dec: r.dec }; }), m.game);
    if (m.game === 'penalty') {
      var box = el.appendChild(mk(doc, 'div', 'sld-pips')), dd = stripData(m, true);
      dd.rows.forEach(function (r) { box.appendChild(pipRow(doc, m.E.SC, r)); });
    } else if (st.length >= 3) {
      var ol = el.appendChild(mk(doc, 'ol', 'sld-list')), ranked = typeof Dc.rank === 'function' && st.some(function (q) { return !!q.rank; });
      st.forEach(function (r) {
        var li = ol.appendChild(mk(doc, 'li', r.seat === L.seat ? 'me' : '')), rings = Dc.ringsOn('course', r.extra);
        /* the place in a column of its own (ties show the same place); the last place has 'Great effort!' beside the name */
        if (ranked) li.appendChild(mk(doc, 'span', 'sld-pl', r.rank ? Dc.rank(r.place) : ''));
        li.appendChild(mk(doc, 'span', 'sld-nm', (r.place === 1 ? '🏆 ' : '') + names(r.seat) + (rings ? ' 🎯' : '')));
        if (ranked && r.last && T.results.effort) li.appendChild(mk(doc, 'span', 'sld-ke', T.results.effort));
        li.appendChild(mk(doc, 'span', 'sld-sc', r.ok ? fmt(r.score) : '—'));
      });
    } else {
      st.forEach(function (r) { if (r.ok && Dc.ringsOn('course', r.extra)) line(m, el, Dc.fill(LT.rings, { name: r.seat === L.seat ? LT.you : names(r.seat) })); });
    }
    x.rows.forEach(function (r) { if (!r.me && r.st === 'left') line(m, el, Dc.fill(T.results.lost, { name: r.name })); });
    if (L.closed) line(m, el, closedLine(m, L), 'sld-note');
    if (m.note) line(m, el, m.note, 'sld-note');
    /* the Debut Run team try: everyone took a bow before the arch and a try is left */
    if (m.game === 'course' && x.teamTry && L.offer && ses && !L.closed) {
      line(m, el, Dc.fill(T.results.allBowed, { n: x.outcome && x.outcome.tries != null ? x.outcome.tries : L.tries }));
      if (host) {
        var row = el.appendChild(mk(doc, 'div', 'row'));
        row.appendChild(btn(m, 'slg-b go', T.results.tryAgain, 'try', function () {
          if (M !== m || !m.ses) return;
          checked(m, function () { if (m.ses && m.ses.rematch({ useTry: true })) { L.offer = false; paintBlock(m); } });
        }));
        row.appendChild(btn(m, 'slg-b', T.results.done, 'done', function () { L.offer = false; paintBlock(m); }));
      } else {
        var hp = v && v.players.filter(function (p) { return p.seat === 0; })[0];
        line(m, el, Dc.fill(T.results.waitTry, { name: hp ? hp.name : 'Player 1' }));
      }
    }
  }

  /* ---------- closing ---------- */
  /* On Back, Cancel, Leave, exit, a profile switch (lobby-groups closes itself) and pagehide. A host
     whose round is still going keeps passing messages on, unseen, until it ends (duel-net). The
     ticket is deleted and the key, roster and tag map are forgotten (lobby-groups). */
  function close() {
    var m = M, list;
    if (!m) return;
    M = null;
    list = (m.ses ? [m.ses] : []).concat(m.trying || []);
    m.ses = null; m.trying = []; m.looking = null; m.view = ''; m.root = null; m.code = ''; m.word = ''; m.seen = null; m.ready = null;
    if (m.autoStart) { try { m.E.timers.clearTimeout(m.autoStart); } catch (x) {} m.autoStart = 0; }
    try { m.E.timers.clearInterval(m.watch); } catch (x) {}
    if (m.live) { m.live.players = []; m.live.rows = null; m.live.rv = {}; m.live = null; }
    list.forEach(function (s) { try { s.leave(); } catch (x) {} });
    try { if (m.E.LG) m.E.LG.close(); } catch (x) {}
    try { strip(m.mid, null); } catch (x) {}
    m.groups = []; m.group = null;
    if (m.cfg && m.cfg.challengeRound) m.cfg.challengeRound = null;
  }

  var API = { open: open, wrap: wrap, strip: strip, layout: layout, close: close, LT: LT, LAY: LAY, _mem: function () { return M; } };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (W) {
    W.SLDuelLobby = API;
    try { W.addEventListener('pagehide', close); } catch (x) {}
  }
})();
