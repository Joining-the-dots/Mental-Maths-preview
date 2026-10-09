/* ================================================================
   My Island — the rewards world UI.
   Loaded lazily by index.html (slLoadWorld) when the 🏝️ tab opens.
   Reads/writes the existing profile model (state/ensureUser/saveState)
   through the commit protocol in world-core.js. Never awards points.
   ================================================================ */
(function () {
  'use strict';
  var C = window.SLWorldCore, ART = window.SLWorldArt;
  if (!C || !ART) return;
  /* one voice for every string (world/world-copy.js); the fallback keeps the island working without it */
  function tx(key, vars, fb) { var CP = window.SLWorldCopy; return CP ? CP.t(key, vars, fb) : (fb || key); }
  function dsc(it) { var CP = window.SLWorldCopy; return (CP && CP.desc(it.id)) || it.desc || ''; }
  function ico(name) { return typeof ART.uiIcon === 'function' ? ART.uiIcon(name) : ''; }
  function lbl(icon, text) { var i = ico(icon); return (i ? i + ' ' : '') + esc(text); }
  var CH = ART.CH, COLS = C.COLS, ROWS = C.ROWS;
  var PAD = 80;                               /* sky above row 0 for tall sprites */
  var STAGE_W = COLS * 100, STAGE_H = ROWS * CH + PAD, GROUND_H = ROWS * CH;
  var STORAGE_KEY = 'timesTableQuest_v1';
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* a parent can switch Reduce Motion on while the app stays open for days */
  try {
    var rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onRm = function () { reduced = !!rmq.matches; s3('setReduced', reduced); };
    if (rmq.addEventListener) rmq.addEventListener('change', onRm); else if (rmq.addListener) rmq.addListener(onRm);
  } catch (e) {}

  /* ---------------- tiny utils ---------------- */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n || 0).toLocaleString('en-GB'); }
  function pct(v, of) { return (v / of * 100).toFixed(4) + '%'; }
  function newTx() {
    var a = new Uint8Array(9);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return 'tx_' + Date.now().toString(36) + '_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function sfx(name) { try { if (typeof playSfx === 'function') playSfx(name); } catch (e) {} }
  function sample(name, vol) { try { if (typeof slSample === 'function') return slSample(name, vol); } catch (e) {} return false; }
  function me() { try { return ensureUser(); } catch (e) { return null; } }
  function W() { var u = me(); return u ? C.ensureWorld(u) : null; }
  /* free test mode (index.html: window.SL_WORLD_TRIAL = true): island items cost 0,
     children's ⭐ are never used, and each free item is tagged in the ledger */
  function trial() {
    if (window.SL_WORLD_TRIAL !== true) return false;
    /* optional hard end (ms since epoch), checked against the server-anchored clock */
    var until = +window.SL_WORLD_TRIAL_UNTIL || 0;
    if (until && nowMs() >= until) return false;
    /* optional allow-list of family codes; signed-out or other families pay real prices */
    var fams = window.SL_WORLD_TRIAL_FAMILIES;
    if (fams && fams.length) {
      var cs = window.cloudState, code = cs && cs.doc && cs.doc.familyCode;
      if (!code || fams.indexOf(code) < 0) return false;
    }
    return true;
  }
  function TO() { return { trial: trial() }; }
  function iState(u, id) { return C.itemState(u, id, TO()); }
  /* island music (world/music.js): starts after a tap, obeys mute, only on My Island */
  function musicOn() { try { return !!(window.SLMusic && SLMusic.enabled()); } catch (e) { return false; } }
  function islandMusic(ctxName) {
    var wv = document.getElementById('worldView');
    if (!wv || wv.classList.contains('hidden') || running) return;     /* never on learning screens or over a game */
    try { if (window.SLMusic) SLMusic.island(ctxName || 'island_day', { muted: function () { var u = me(); return !!(u && u.muted); } }); } catch (e) {}
  }

  /* ---------------- commit protocol (lock + fresh read + verify) ---------------- */
  function adapter() {
    var prev = null;
    return {
      read: function () { return JSON.parse(localStorage.getItem(STORAGE_KEY)); },
      write: function (st) {
        /* saveState() swallows storage errors, so remember what memory held:
           if the read-back can't find the change, rollback() puts it all back */
        prev = {};
        Object.keys(st).forEach(function (k) { prev[k] = state[k]; state[k] = st[k]; });
        saveState();
      },
      rollback: function () {
        if (!prev) return;
        Object.keys(prev).forEach(function (k) { state[k] = prev[k]; });
        prev = null;
      }
    };
  }
  /* If this tab was the last writer, flush its in-memory profile first so
     nothing it holds (e.g. telemetry) is lost; if another tab wrote since,
     never overwrite — the fresh read below takes theirs. */
  function flushIfCurrent() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      var name = state.activeUser;
      var mem = state.users[name], disk = stored && stored.users && stored.users[name];
      if (mem && (!disk || (mem._localUpdatedAt || 0) >= (disk._localUpdatedAt || 0))) saveState();
    } catch (e) {}
  }
  function withLock(fn) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request('sl-world-commit', function () { return fn(); });
    return Promise.resolve().then(fn);
  }
  function commit(mutate) {
    var name = state.activeUser;
    return withLock(function () {
      flushIfCurrent();
      return C.transact(adapter(), name, mutate, function () { return true; });
    }).then(function (res) { afterCommit(); return res; });
  }
  function commitPurchase(id, tx) {
    var name = state.activeUser;
    return withLock(function () {
      flushIfCurrent();
      return C.transactPurchase(adapter(), name, id, { tx: tx, trial: trial() });
    }).then(function (res) { afterCommit(); return res; });
  }
  function afterCommit() {
    try { if (typeof updatePointsDisplay === 'function') updatePointsDisplay(); } catch (e) {}
  }

  /* ---------------- module state ---------------- */
  var root = null, renderedFor = null;
  var mode = 'play';                     /* 'play' | 'edit' | 'place' */
  var placing = null;                    /* {id, uid, x, y, ox, oy, fromBuy, isle} */
  /* the sky islands (v3), memory only: nothing here is saved, tracked or sent */
  var visitIsle = 'home';                /* the island being visited; every open starts on Home */
  var skyMapOn = false;                  /* 3D only: the Sky map pose is showing */
  var travelSeq = 0;                     /* a newer trip supersedes an older one's continuation */
  var lmBusy = {};                       /* uid -> ms until a landmark act may run again */
  var shopIsle = 'all';                  /* the Sky islands tab's island (this page session only) */
  /* the land shops' folds (D99, D114), memory only: the one island open under 'All five' (this page session),
     the one land group open in the Crew tab (each shop opens on the island you are on), and whose Wear rows
     are open in the crew sheet (one member at a time; the runner first) */
  var shopAcc = null, crewAcc = null, wearOpen = null;
  var introDone = false, keepIsle = false, freshPets = {};   /* the Sky tour once per page session (D83); pets adopted this session (D112) */
  /* the crew out on the 2D island (D97, D112), memory only: Home shows the runner, this session's new pets,
     then the rest in turn (one step per My Island open); a land shows the runner and its own mascots */
  var PETS_2D = 6, LAND_MASCOTS_2D = 2, petTurn = 0, landTurn = {};
  var selectedUid = null;
  var lastUndo = null;
  var lit = {};                          /* uid -> lights on */
  var pendingTx = {};                    /* itemId -> tx kept for retries */
  var buying = false, confirming = false;
  var petTimers = [];
  /* "now" for the game-time day: server time (HTTP Date header) or the clock at
     load, carried forward by the monotonic performance clock — so changing the
     device clock while the app is open can't jump to a fresh day */
  var timeAnchor = { at: Date.now(), perf: (window.performance && performance.now) ? performance.now() : 0, server: false };

  /* ---------------- styles ---------------- */
  function injectCss() {
    if (document.getElementById('slwCss')) return;
    var css = document.createElement('style');
    css.id = 'slwCss';
    css.textContent = [
      '.slw{max-width:1120px;margin:0 auto;padding:0 4px 18px;font-family:inherit;}',
      '.slw-hud{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 10px;}',
      '.slw-learn{background:linear-gradient(135deg,#6c5ce7,#a86ff0);color:#fff;border:none;border-radius:999px;padding:10px 18px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(108,92,231,.35);}',
      '.slw-pts{background:linear-gradient(135deg,#ffe27a,#ffb347);color:#5a3700;border-radius:999px;padding:8px 16px;font-family:"Baloo 2",sans-serif;font-weight:800;font-size:18px;}',
      '.slw-goal{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:#fff;border:2px solid #f2e2a8;border-radius:14px;padding:6px 10px;cursor:pointer;font:inherit;text-align:left;}',
      '.slw-goal .gi{width:36px;height:36px;flex:0 0 36px;position:relative;}.slw-goal .gi svg{width:100%;height:100%;}',
      '.slw-goal .gb{height:10px;background:#f3eedf;border-radius:999px;overflow:hidden;margin-top:3px;}.slw-goal .gb>i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff9f43);border-radius:999px;}',
      '.slw-goal .gt{font-size:12.5px;font-weight:800;color:#6b5a22;}.slw-goal.ready{border-color:#2ecc71;background:#eafaf0;}.slw-goal.ready .gt{color:#1d8a4c;}',
      '.slw-acts{display:flex;gap:6px;flex-wrap:wrap;}',
      '.slw-btn{border:2px solid #d9d2ee;background:#fff;color:#4a3f75;border-radius:12px;padding:8px 12px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;min-height:42px;}',
      '.slw-btn.on{background:#6c5ce7;border-color:#6c5ce7;color:#fff;}',
      '.slw-btn.big{font-size:16px;padding:10px 16px;}',
      '.slw-btn:focus-visible,.slw-obj:focus-visible,.slw-cell:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;}',
      '.slw-stagewrap{position:relative;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(30,60,120,.25);background:#7fd6ff;}',
      '.slw-stage{position:relative;width:100%;aspect-ratio:' + STAGE_W + '/' + STAGE_H + ';touch-action:manipulation;user-select:none;-webkit-user-select:none;}',
      /* phones: keep island squares finger-sized (~47px) and let the island pan sideways */
      '@media (max-width: 700px){.slw-stagewrap{overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;}.slw-stage{width:760px;}.slw-pan{display:block !important;}}',
      '.slw-pan{display:none;text-align:center;font-size:12.5px;font-weight:800;color:#6b6390;margin:6px 0 0;}',
      '.slw-ground{position:absolute;left:0;right:0;bottom:0;height:' + (GROUND_H / STAGE_H * 100).toFixed(4) + '%;}.slw-ground svg{position:absolute;inset:0;width:100%;height:100%;}',
      '.slw-obj{position:absolute;padding:0;border:none;background:none;cursor:default;display:block;}',
      '.slw-obj svg{width:100%;height:100%;display:block;overflow:visible;}',
      'button.slw-obj{cursor:pointer;}',
      '.slw-obj.path{z-index:2;}',
      '.slw-tag{position:absolute;left:50%;transform:translateX(-50%);bottom:-6%;white-space:nowrap;font-family:"Baloo 2",sans-serif;font-weight:800;font-size:clamp(10px,1.3vw,14px);padding:2px 9px;border-radius:999px;pointer-events:none;}',
      '.slw-tag.play{background:#ffd23f;color:#4a3200;box-shadow:0 2px 8px rgba(0,0,0,.25);animation:slwPulse 1.8s infinite;}',
      '.slw-tag.lockg{background:#4a4468;color:#fff;}',
      '.slw-dot{position:absolute;right:8%;top:30%;width:clamp(14px,1.8vw,22px);height:clamp(14px,1.8vw,22px);border-radius:50%;background:#fff;border:2px solid #6c5ce7;display:flex;align-items:center;justify-content:center;font-size:clamp(8px,1vw,12px);pointer-events:none;}',
      '.slw-new{position:absolute;left:50%;top:-4%;transform:translateX(-50%);background:#ff5c8a;color:#fff;font-weight:800;font-size:clamp(9px,1.1vw,12px);border-radius:999px;padding:1px 8px;pointer-events:none;animation:slwPulse 1.4s infinite;}',
      '.slw-new.base{top:auto;bottom:2%;}',
      '.slw-free{display:inline-block;background:linear-gradient(135deg,#2ecc71,#1fa463);color:#fff;border-radius:999px;padding:1px 10px;font-weight:800;font-size:.8em;}',
      '.slw-goal.slw-trial{border-color:#2ecc71;background:#eafaf0;cursor:default;}.slw-goal.slw-trial .gt{color:#1d8a4c;}',
      '.slw-trialbar{margin:6px 0 2px;background:#eafaf0;border:2px solid #2ecc71;border-radius:12px;padding:6px 10px;font-weight:700;color:#1d6b40;font-size:14px;}',
      '@media (pointer: coarse){.slw-kbhint{display:none;}}',
      '@keyframes slwPulse{0%,100%{transform:translateX(-50%) scale(1);}50%{transform:translateX(-50%) scale(1.08);}}',
      '.slw-sign{position:absolute;transform:translate(-50%,-50%);background:rgba(40,34,70,.85);color:#fff;border:2px solid rgba(255,255,255,.6);border-radius:14px;padding:6px 10px;font:inherit;font-weight:800;font-size:clamp(10px,1.3vw,14px);cursor:pointer;z-index:900;text-align:center;line-height:1.2;}',
      '.slw-pet{position:absolute;z-index:500;width:' + pct(90, STAGE_W) + ';cursor:pointer;background:none;border:none;padding:0;transition-property:left,top;transition-timing-function:linear;}',
      '.slw-pet svg{width:100%;height:auto;display:block;}.slw-pet.flip svg{transform:scaleX(-1);}',
      '.slw-pet.hop{animation:slwHop .6s ease-out;}',
      '@keyframes slwHop{0%,100%{translate:0 0;}35%{translate:0 -38%;}}',
      '.slw-pet .nm{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);font-size:clamp(9px,1.1vw,12px);font-weight:800;background:#fff;border-radius:999px;padding:1px 7px;color:#4a3f75;white-space:nowrap;opacity:0;transition:opacity .3s;pointer-events:none;}',
      '.slw-pet:hover .nm,.slw-pet.say .nm,.slw-pet:focus-visible .nm{opacity:1;}',
      '.slw-me{position:absolute;z-index:480;width:' + pct(70, STAGE_W) + ';pointer-events:auto;cursor:pointer;background:none;border:none;padding:0;}',
      '.slw-me svg{width:100%;height:auto;display:block;}.slw-me .face{position:absolute;left:50%;top:6%;transform:translateX(-50%);font-size:clamp(14px,2.4vw,30px);line-height:1;}',
      '.slw-me.wave{animation:slwHop .6s ease-out;}',
      '.slw-fx{position:absolute;pointer-events:none;z-index:950;font-size:clamp(16px,2.6vw,30px);animation:slwFloat 1.1s ease-out forwards;}',
      '@keyframes slwFloat{0%{opacity:1;transform:translate(-50%,0) scale(.6);}100%{opacity:0;transform:translate(-50%,-140%) scale(1.3);}}',
      '.slw-bounce{animation:slwBounceObj .7s ease-out;}@keyframes slwBounceObj{0%,100%{transform:scaleY(1);}30%{transform:scaleY(.82);}60%{transform:scaleY(1.06);}}',
      '.slw-wiggle{animation:slwWiggle .5s;}@keyframes slwWiggle{25%{transform:rotate(-4deg);}75%{transform:rotate(4deg);}}',
      '.slw-wave{animation:slwWave 4s ease-in-out infinite;}@keyframes slwWave{0%,100%{transform:translateX(0);opacity:.7;}50%{transform:translateX(10px);opacity:.3;}}',
      '.slw-spin{animation:slwSpin 6s linear infinite;}.slw-spin.fast{animation-duration:.7s;}@keyframes slwSpin{to{transform:rotate(360deg);}}',
      '.slw-flag{animation:slwFlag 2.4s ease-in-out infinite;transform-origin:left center;}.slw-flag.fast{animation-duration:.4s;}@keyframes slwFlag{0%,100%{transform:skewY(0);}50%{transform:skewY(-6deg) scaleX(.94);}}',
      '.slw-swing.go{animation:slwSwing 1.6s ease-in-out 2;}@keyframes slwSwing{25%{transform:rotate(18deg);}75%{transform:rotate(-18deg);}}',
      '.slw-water{transform-origin:50px 74px;}.slw-water.go{animation:slwWater .9s ease-out 2;}@keyframes slwWater{50%{transform:scaleY(1.6);}}',
      '.slw-bubbles{opacity:.8;}.slw-bubbles.go{animation:slwBub 1.8s ease-out;}@keyframes slwBub{0%{transform:translateY(0);opacity:1;}100%{transform:translateY(-60px);opacity:0;}}',
      '.slw-twinkle{animation:slwTw 1.6s infinite;}@keyframes slwTw{50%{opacity:.35;}}',
      '.slw-smoke{animation:slwSmoke 3s ease-out infinite;}@keyframes slwSmoke{0%{transform:translateY(8px);opacity:.9;}100%{transform:translateY(-10px);opacity:0;}}',
      '.slw-cell{position:absolute;border:2px dashed rgba(255,255,255,.55);border-radius:10px;background:rgba(255,255,255,.08);z-index:600;padding:0;cursor:pointer;}',
      '.slw-cell.ok{background:rgba(46,204,113,.45);border:3px solid #2ecc71;}',
      '.slw-cell.bad{background:rgba(231,76,60,.42);border:3px solid #e74c3c;}',
      '.slw-cell.door{background:rgba(255,210,63,.25);border-color:#ffd23f;}',
      '.slw-ghost{position:absolute;z-index:650;opacity:.82;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3));}',
      '.slw-ghost.bad{opacity:.5;filter:grayscale(.6) drop-shadow(0 6px 10px rgba(0,0,0,.3));}',
      '.slw-ghost svg{width:100%;height:100%;display:block;}',
      '.slw-edit .slw-obj{cursor:pointer;}',
      '.slw-obj.sel{filter:drop-shadow(0 0 6px #ffd23f) drop-shadow(0 0 3px #ffd23f);}',
      '.slw-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;background:#fff;border-radius:16px;padding:10px;margin-top:10px;box-shadow:0 4px 16px rgba(0,0,0,.08);}',
      '.slw-bar .msg{font-weight:800;color:#4a3f75;font-size:14px;flex:1 1 220px;text-align:center;}',
      '.slw-bar .msg.bad{color:#c0392b;}',
      '.slw-tray{display:flex;gap:8px;overflow-x:auto;padding:8px 2px;}',
      '.slw-trayitem{flex:0 0 auto;width:86px;border:2px solid #e8e2f6;border-radius:14px;background:#fff;padding:6px;cursor:pointer;font:inherit;position:relative;}',
      '.slw-trayitem svg{width:100%;height:56px;display:block;}.slw-trayitem b{position:absolute;right:6px;top:4px;background:#6c5ce7;color:#fff;border-radius:999px;font-size:11px;padding:0 7px;}',
      '.slw-trayitem span{display:block;font-size:11px;font-weight:800;color:#4a3f75;margin-top:2px;}',
      '.slw-legend{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:12.5px;font-weight:700;color:var(--ink-soft,#7c8696);margin-top:8px;}',
      '.slw-legend span{display:inline-flex;align-items:center;gap:5px;}',
      '.slw-legend i{font-style:normal;display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:800;}',
      /* overlays */
      '.slw-ov{position:fixed;inset:0;z-index:9000;background:rgba(30,24,58,.55);display:flex;align-items:center;justify-content:center;padding:12px;}',
      '.slw-sheet{background:#fff;border-radius:22px;max-width:960px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3);padding:16px 16px 18px;position:relative;}',
      '.slw-sheet.small{max-width:440px;}',
      '.slw-sheet h2{margin:0 0 6px;font-family:"Baloo 2",sans-serif;padding-right:44px;}',   /* clear of the ✕ */
      '.slw-x{position:absolute;right:10px;top:10px;width:42px;height:42px;border-radius:50%;border:none;background:#f1edfb;font-size:20px;cursor:pointer;}',
      '.slw-cats{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px;}',
      '.slw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;}',
      '.slw-card{border:2px solid #ece6f8;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:5px;background:#fff;position:relative;}',
      '.slw-card .ic{height:92px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#eef9ff,#f7fff2);border-radius:12px;cursor:pointer;border:none;padding:4px;}',
      '.slw-card .ic svg{max-height:84px;max-width:100%;}',
      '.slw-card .nm{font-weight:800;font-size:14.5px;color:#2c2550;}',
      '.slw-card .ds{font-size:12px;color:#6b6585;line-height:1.35;min-height:32px;}',
      '.slw-card .pr{font-family:"Baloo 2",sans-serif;font-weight:800;color:#b9821a;font-size:15px;}',
      '.slw-card .chip{font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;align-self:flex-start;}',
      '.chip.own{background:#e5f6ea;color:#1e7d3f;}.chip.lock{background:#efeaf9;color:#5a4fd0;}.chip.rep{background:#fff3d9;color:#8a6100;}.chip.uni{background:#e8f4ff;color:#1f5f9e;}',
      '.slw-card .row{display:flex;gap:6px;margin-top:auto;}',
      '.slw-buy{flex:1;border:none;border-radius:12px;padding:9px 8px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;min-height:42px;}',
      '.slw-buy[disabled]{background:#e4e0ee;color:#4f4870;cursor:not-allowed;}',
      '.slw-goalbtn{border:2px solid #ffd166;background:#fffaf0;border-radius:12px;padding:6px 9px;font:inherit;font-weight:800;cursor:pointer;min-height:42px;}',
      '.slw-goalbtn.on{background:#ffd166;}',
      '.slw-need{font-size:12px;font-weight:800;color:#8a6100;}',
      '.slw-detail{display:flex;gap:16px;flex-wrap:wrap;}',
      '.slw-detail .big{flex:1 1 260px;min-height:200px;background:linear-gradient(180deg,#eef9ff,#f7fff2);border-radius:16px;display:flex;align-items:center;justify-content:center;padding:10px;position:relative;overflow:hidden;}',
      '.slw-detail .big svg{max-width:100%;max-height:240px;}',
      '.slw-detail .big canvas{width:100%;height:auto;border-radius:12px;display:block;}',
      '.slw-detail .info{flex:1 1 260px;display:flex;flex-direction:column;gap:8px;}',
      '.slw-unlocks{background:#f5f2ff;border-radius:12px;padding:8px 12px;font-size:13px;line-height:1.5;color:#4a3f75;}',
      '.slw-err{color:#c0392b;font-weight:800;font-size:13px;min-height:18px;}',
      '.slw-cele{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at center,rgba(49,25,122,.92),rgba(20,11,51,.94));color:#fff;text-align:center;padding:20px;cursor:pointer;}',
      /* the skins draw the card as ::before across the content rows of their grid: it must fill them
         (centring the rows here would squash it to its border, leaving the Pixel skin's dark text on the scrim) */
      '.slw-cele::before{align-self:stretch;}',
      /* the land reveal: a smaller landmark picture keeps the card low, so the real landmark shows above it */
      '.slw-cele.reveal .ic{width:min(140px,34vw,18vh);margin:6px auto;}',
      '.slw-cele .t{font-family:"Baloo 2",sans-serif;font-size:clamp(28px,5vw,48px);font-weight:800;line-height:1.1;}',
      '.slw-cele .s{font-size:16px;color:#d9d2f7;margin-top:8px;max-width:520px;}',
      '.slw-cele .ic{width:min(220px,40vw);margin:10px auto;}',
      '.slw-cele .ic svg{width:100%;height:auto;}',
      '.slw-cele .btns{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;justify-content:center;}',
      '.slw-cele.pop .ic{animation:slwPopIn .7s cubic-bezier(.2,1.6,.4,1);}@keyframes slwPopIn{from{transform:scale(.2);}to{transform:scale(1);}}',
      '.slw-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9600;background:#2c2550;color:#fff;border-radius:14px;padding:10px 14px;font-weight:800;display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;}',
      '.slw-toast button{border:none;border-radius:10px;background:#ffd23f;color:#4a3200;font:inherit;font-weight:800;padding:6px 10px;cursor:pointer;}',
      '.slw-intro .card{max-width:520px;text-align:center;}',
      '.slw-intro .hero{font-size:64px;line-height:1;margin:6px 0;}',
      '.slw-dots{display:flex;gap:6px;justify-content:center;margin:10px 0;}.slw-dots i{width:10px;height:10px;border-radius:50%;background:#ddd6f3;}.slw-dots i.on{background:#6c5ce7;}',
      '.slw-games{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;}',
      '.slw-game{border-radius:18px;padding:14px;color:#fff;display:flex;flex-direction:column;gap:6px;min-height:150px;background:var(--slw-g,#6c5ce7);}',
      '.slw-game h3{margin:0;font-family:"Baloo 2",sans-serif;font-size:20px;}',
      '.slw-game .pb{font-size:13px;font-weight:700;opacity:.9;}',
      '.slw-game .slw-btn{margin-top:auto;background:#fff;border-color:#fff;color:#2c2550;}',
      '.slw-game.locked{background:#5f5a7a !important;}',
      '.slw-time{background:#fff8e1;border:2px solid #ffd166;border-radius:12px;padding:8px 12px;font-size:13.5px;font-weight:700;color:#6b5a22;margin-bottom:10px;}',
      '.slw-loading{padding:40px;text-align:center;font-weight:800;color:#6c5ce7;}',
      '.slw-vh,#slwLive{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}',
      /* the island bar, the here row and the Sky islands tab (island-pixel.css draws the real look; these keep them usable without it) */
      '.slw-isles{display:flex;flex-direction:column;gap:6px;min-width:0;margin:0 0 10px;}',
      '.slw-islechips{display:flex;gap:8px;list-style:none;margin:0;padding:2px 2px 6px;overflow-x:auto;overscroll-behavior-x:contain;}.slw-islechips>li{flex:none;}',
      '.slw-islechip{display:inline-flex;align-items:center;gap:6px;min-width:44px;min-height:44px;padding:0 12px;border:2px solid #d9d2ee;border-radius:12px;background:#fff;color:#4a3f75;font:inherit;font-weight:800;font-size:14px;white-space:nowrap;cursor:pointer;}',
      '.slw-islechip .ic,.slw-here .ic{display:inline-flex;flex:none;width:22px;height:22px;}.slw-islechip .ic svg,.slw-here .ic svg{width:100%;height:100%;}',
      '.slw-islechip.here{background:#ffd23f;color:#4a3200;}.slw-islechip.locked,.slw-islechip[aria-disabled="true"]{border-style:dashed;}.slw-islechip[aria-pressed="true"]{background:#6c5ce7;border-color:#6c5ce7;color:#fff;}',
      '.slw-chipnew{background:#ff5c8a;color:#2c2550;border-radius:6px;padding:1px 6px;font-size:11px;}',
      '.slw-here{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;background:#fff;border-radius:14px;padding:8px 12px;}',
      '.slw-here .nm{display:flex;align-items:center;gap:8px;min-width:0;font-size:18px;color:#2c2550;}.slw-here .nm .tx{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.slw-here .st{flex:1 1 160px;min-width:0;color:#4a3f75;font-weight:700;font-size:14px;}',
      '.slw-shopisle{margin:0 0 16px;}.slw-shopisle h3{display:flex;align-items:center;gap:8px;}.slw-shopisle h3 svg{width:24px;height:24px;}',
      '.slw-isleline{margin:0 0 8px;font-weight:700;font-size:14px;}.slw-shelfhd{margin:14px 0 8px;}',
      '.slw-islefilter,.slw-shelfjump,.slw-isleacc{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px;}',
      /* the land shops' folds (W5b.1): a header's heading holds its toggle (two classes beat the skin's section h3);
         a Crew-tab land header is itself the button and says the short island name on phones */
      '.slw-isleacc .slw-acch,.slw-crewland .slw-acch{display:flex;align-items:center;flex:1 1 160px;min-width:0;margin:0;font:inherit;letter-spacing:normal;color:inherit;}',
      '.slw-crewacc{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;min-height:44px;padding:6px 12px;border:2px solid #d9d2ee;border-radius:12px;background:#fff;color:#2c2550;font:inherit;font-weight:800;text-align:left;cursor:pointer;}',
      '.slw-crewacc .nm{flex:1 1 auto;min-width:0;}.slw-crewacc .nm .sh{display:none;}',
      '@media (max-width:600px){.slw-crewacc .nm .fl{display:none;}.slw-crewacc .nm .sh{display:inline;}}',
      '.slw-crewlands{margin-top:22px;}.slw-crewland{margin:0 0 10px;}',
      /* 'All five': folded headers sit close together (no dotted rule between them); the open one's shop follows it */
      '.slw-shopisle.fold{margin:0 0 10px;padding:0;border-bottom:0;}.slw-isleopen{margin:14px 0 22px;}',
      /* the shop's rows stick at the sheet's very top on phones, over its top padding (else cards show above them) */
      '@media (max-width:600px),(orientation:landscape) and (max-height:540px){#slwCats{top:-18px;}}',
      '@media (max-width:600px){#slwShopBody .slw-islefilter.sticky{top:38px;}}',
      /* phones held sideways are short: the island row is one sideways strip there too (it scrolls away, the tabs stick) */
      '@media (orientation:landscape) and (max-height:540px){#slwShopBody .slw-islefilter{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:none;padding-bottom:6px;}#slwShopBody .slw-islefilter>.slw-btn{flex:0 0 auto;}}',
      '.slw-shelfhd{display:flex;align-items:center;gap:8px;}.slw-shelfhd .ic{display:inline-flex;flex:none;width:24px;height:24px;}.slw-shelfhd .ic svg{width:100%;height:100%;}',
      /* the crew sheet: one block per member (picture, name, from where, buttons), the name row, then its Wear rows */
      '.slw-crewnote{margin:2px 0 12px;font-weight:700;font-size:14px;line-height:1.4;}',
      '.slw-member{margin:0 0 12px;}.slw-mtop{display:flex;gap:12px;align-items:flex-start;}',
      '.slw-mpic{flex:none;padding:4px;border:2px solid #DAF2FF;border-radius:8px;background:linear-gradient(180deg,#DAF2FF 0%,#DAF2FF 62%,#FFFFFF 62%,#FFFFFF 100%);}',
      '.slw-mpic svg{display:block;width:100%;height:auto;}',
      '.slw-minfo{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px;}',
      '.slw-member .slw-mname{margin:0;font-size:18px;line-height:1.2;}.slw-mname .sp{font-weight:600;font-size:14px;}',
      '.slw-mrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;}.slw-minfo .slw-mrow{margin-top:0;}',
      '.slw-mrow label{display:flex;align-items:center;gap:6px;flex:none;max-width:100%;font-size:13px;font-weight:800;}',
      '.slw-mrow input{flex:none;width:170px;max-width:100%;min-height:44px;padding:6px 8px;border:2px solid #d9d2ee;border-radius:10px;font:inherit;}',
      '.slw-member [data-wear]::after{content:"";display:inline-block;width:0;height:0;margin-left:8px;border-style:solid;border-width:6px 0 6px 9px;border-color:transparent transparent transparent currentColor;}',
      '.slw-member [data-wear][aria-expanded="true"]::after{border-width:9px 6px 0;border-color:currentColor transparent transparent;}',
      '@media (max-width:420px){.slw-mtop{gap:10px;}.slw-mpic>div{width:84px !important;}.slw-mrow input{width:118px;}}',
      '.slw-member .slw-err{min-height:0;}.slw-member .slw-err:empty{display:none;}',
      '.slw-wearslots{display:flex;flex-direction:column;gap:6px;margin:10px 0 0;}.slw-wearslots .slw-wearrow{display:flex;align-items:center;gap:8px;min-width:0;}',
      '.slw-wearslots .lb{flex:0 0 48px;font-weight:800;font-size:13px;}.slw-wearslots .slw-tray{flex:1 1 auto;min-width:0;}',
      '.slw-wearslots .slw-trayitem[aria-pressed="true"]{border-color:#6c5ce7;background:#f1edfb;}',
      '.slw-trayitem .pv{display:block;position:relative;height:56px;}.slw-trayitem .pv svg{height:56px;}',
      /* the 2D sky islands (island-pixel.css draws the real look; these keep them usable without it) */
      '.slw-dock2d{position:absolute;z-index:1;pointer-events:none;}.slw-dock2d svg{width:100%;height:100%;display:block;}',
      '.slw-bridge2d{position:absolute;z-index:800;display:inline-flex;align-items:center;gap:6px;min-width:44px;min-height:44px;padding:6px 12px;border:2px solid #d9d2ee;border-radius:12px;background:#fff;color:#4a3f75;font:inherit;font-weight:800;font-size:14px;white-space:nowrap;cursor:pointer;}',
      '.slw-lock2d{position:absolute;left:50%;top:50%;z-index:700;transform:translate(-50%,-50%);display:inline-flex;flex-direction:column;align-items:center;gap:6px;min-height:56px;max-width:90%;padding:12px 20px;border:2px solid #d9d2ee;border-radius:16px;background:#fff;color:#4a3f75;font:inherit;font-weight:800;font-size:18px;text-align:center;cursor:pointer;}',
      '.slw-lock2d .pr{border-radius:6px;padding:2px 10px;background:#ffd23f;color:#4a3200;}',
      '.slw-bridge2d:focus-visible,.slw-lock2d:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;}',
      '@media (max-width:640px){.slw-pts{font-size:16px;padding:6px 12px;}.slw-btn{padding:7px 9px;font-size:13px;}.slw-learn{font-size:14px;padding:8px 12px;}}',
      /* Showtime day<->night page change fades instead of snapping (no strobing) */
      'html body .slw,html body .slw .slw-hud,html body .slw .slw-legend,html body .slw .slw-btn{transition:background-color .45s ease,background .45s ease,color .45s ease,border-color .45s ease;}',
      '@media (prefers-reduced-motion: reduce){.slw-wave,.slw-spin,.slw-flag,.slw-twinkle,.slw-smoke,.slw-tag.play,.slw-new{animation:none !important;}.slw-pet{transition-duration:0s !important;}.slw-cele.pop .ic{animation:none;}}'
    ].join('\n');
    document.head.appendChild(css);
    if (!document.getElementById('slwDefs')) {
      var d = document.createElement('div');
      d.id = 'slwDefs';
      d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
      d.innerHTML = ART.defs();
      document.body.appendChild(d);
    }
  }

  /* ---------------- style state for art ---------------- */
  /* FNV-1a of the profile key: each family's home gets its own stable trim (variant 0 or 1) */
  function famVariant() {
    var k = String(state.activeUser || '').toLowerCase(), h = 2166136261;
    for (var i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h % 2;
  }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0].slice(0, 12); }
  function artState(w) {
    var u = me() || {};
    return {
      wall: C.selected(w, 'wall'), roof: C.selected(w, 'roof'), door: C.selected(w, 'door'), details: w.details,
      shape: C.selected(w, 'shape'), variant: famVariant(), name: firstName(u.name), member: u.color || '#6C5CE7',
      course: C.selected(w, 'course'), ball: C.selected(w, 'ball'), stadium: C.selected(w, 'stadium'), kart: C.selected(w, 'kart')
    };
  }
  /* a city building's own trim (one of 3, by uid) for the 2D sprite; a sky-island thing wears the
     colourway the child chose (vr, D115), else its uid's starting look, as the 3D island does */
  function bldState(st, p) {
    var L = window.SLIslandLook, it = C.item(p.id);
    if (it && C.isV3(it)) return Object.assign({}, st, { variant: typeof p.vr === 'number' ? p.vr : (L && L.variantOf ? L.variantOf(p.uid, p.id) : 0) });
    if (!it || it.cat !== 'city') return st;
    var w = W();
    return Object.assign({}, st, { variant: (L && L.variantOf) ? L.variantOf(p.uid, p.id) : 0, pet: (w && C.activePetId(w)) || 'pet_puppy' });
  }

  /* ================================================================
     3D STAGE ADAPTER — the island is drawn by world/island3d/* when the
     device can (docs/island3d/CONTRACTS.md §5); this file stays the owner
     of state, rules, commits, HTML and sound decisions. Every call into
     the stage is guarded: any failure drops silently back to the 2D island.
     ================================================================ */
  var stage3d = null, use3D = null, booting3d = false, coverCount = 0, anim3d = {}, dispose3dTimer = 0, late3d = false, userChangedInGame = false, lastShowtimeTap = 0, encoreUntil = 0;
  var showtimeOn = (function () { try { return localStorage.getItem('slwShowtime') === '1'; } catch (e) { return false; } })();
  function s3(method) {
    if (!stage3d || typeof stage3d[method] !== 'function') return undefined;
    try { return stage3d[method].apply(stage3d, Array.prototype.slice.call(arguments, 1)); }
    catch (e) { disable3D('call:' + method); return undefined; }
  }
  function lowPanels() { try { document.documentElement.classList.add('sl-low'); } catch (e) {} }
  function disable3D(reason) {
    var st = stage3d; stage3d = null; use3D = false;
    lowPanels();
    if (st) { try { st.dispose(); } catch (e) {} }
    /* the 2D island draws every island: the child stays where they are (a trip in the air lands at once,
       its continuation is dropped) and only the Sky map, which 2D does not have, closes */
    skyMapOn = false; travelSeq++;
    try { if (window.SLIsland3D && SLIsland3D.remember2D && /perf|lost/.test(String(reason || ''))) SLIsland3D.remember2D(reason); } catch (e) {}
    if (root && document.getElementById('slwStage')) draw();
  }
  function userInfo() { var u = me() || {}; return { name: u.name || '', color: u.color || '#6C5CE7', avatar: u.avatar || '🙂', seed: String(state.activeUser || '').toLowerCase() }; }
  function maybeBoot3D() {
    if (stage3d || booting3d || use3D === false) return;
    try { if (localStorage.getItem('slNo3D') === '1') { use3D = false; lowPanels(); return; } } catch (e) {}
    if (typeof WebGL2RenderingContext === 'undefined') { use3D = false; lowPanels(); return; }
    booting3d = true;
    var v = '?v=' + (window.SL_WORLD_VER || '1');
    try { if (localStorage.getItem('slQaMode') === '1') v += '&qa=' + Date.now(); } catch (e) {}
    loadScript('world/island3d/stage.js' + v).then(function () {
      if (!window.SLIsland3D || typeof SLIsland3D.boot !== 'function') return false;
      if (SLIsland3D.remembered && SLIsland3D.remembered(window.SL_WORLD_VER)) return false;
      return SLIsland3D.boot({ ver: window.SL_WORLD_VER, deadlineMs: 8000 });
    }).then(function (ok) {
      booting3d = false;
      if (!ok || typeof SLIsland3D.mount !== 'function') {
        /* a slow first load can still finish: stay undecided and upgrade to 3D when it's ready */
        var gaveUp = !window.SLIsland3D || (SLIsland3D.failed && SLIsland3D.failed()) || (SLIsland3D.remembered && SLIsland3D.remembered(window.SL_WORLD_VER));
        use3D = gaveUp ? false : null;
        if (gaveUp) lowPanels();
        if (!gaveUp && SLIsland3D.ensure && !late3d) {
          late3d = true;
          SLIsland3D.ensure({ deadlineMs: 60000, groups: ['vox'] }).then(function (S) { late3d = false; if (S && root && renderedFor != null && !stage3d && !running) maybeBoot3D(); }, function () { late3d = false; });
        }
        return;
      }
      if (!root || renderedFor == null || stage3d) return;          /* the island closed meanwhile */
      /* the Sky tour plays on the first My Island open of this page session only, never under reduced motion (D83) */
      var intro = !introDone && !reduced;
      introDone = true;
      stage3d = SLIsland3D.mount({ reduced: reduced, user: userInfo(), intro: intro, skyline: intro, on: {
        tapItem: function (uid) { tapItem(uid, null); },
        tapPet: function (petId) {
          s3('emote', 'pet:' + petId, 'heart');
          try { if (window.SLSound) SLSound.make({ muted: function () { var u = me(); return !!(u && u.muted); } }).pet(petId, 0.8); } catch (e) {}
        },
        tapAvatar: function () { s3('emote', 'me', 'wave'); },
        /* a locked sky land (its preview or its Home gate) opens its sheet; an owned one flies there */
        tapLand: function (landId) {
          if (mode !== 'play') return;
          var it = C.item(landId);
          if (it && it.isle && C.ISLES[it.isle] && C.owns(W(), landId)) goIsle(it.isle); else openItem(landId);
        },
        /* another island's body, bridge or gate (play mode only; edit and place ignore other islands, D46) */
        tapIsle: function (isle) {
          if (mode !== 'play' || !C.ISLES[isle]) return;
          if (C.isleUnlocked(W(), isle)) goIsle(isle); else openItem(C.ISLES[isle].unlock);
        },
        tapCell: function (x, y, isle) { if (mode === 'place' && placing && (isle || 'home') === placing.isle) placeAtCell(x, y); },
        dragStart: function (uid) {
          if (mode !== 'edit') return;
          var f = findPlaced(W(), uid);
          if (f && f.isle === isleNow() && C.isPlaceable(C.item(f.p.id))) startPlacement(f.p.id, f.p.uid, false);
        },
        dragCell: function (x, y, isle) { if (mode === 'place' && placing && (isle || 'home') === placing.isle && (placing.x !== x || placing.y !== y)) { placing.x = x; placing.y = y; drawPlacement(); drawBar(); } },
        dragEnd: function () { if (mode === 'place' && placing && C.canPlace(W(), placing.id, placing.x, placing.y, placing.uid, placing.isle).ok) confirmPlacement(); },
        ready: function () { var wrap = root && root.querySelector('.slw-stagewrap'); if (wrap) wrap.classList.add('slw-is3d'); },
        fail: function (reason) { disable3D(reason || 'fail'); }
      } });
      if (!stage3d) { use3D = false; return; }
      use3D = true;
      /* a sheet that opened before the stage existed (the welcome, a goal card) still covers it: the stage
         waits to show itself, and the first-open Sky tour plays when the child can see it */
      if (coverCount > 0) s3('setCovered', true);
      if (showtimeOn) s3('showtime', true);
      var at = isleNow();
      if (at !== 'home' && !canTravel()) { if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); } mode = 'play'; selectedUid = null; visitIsle = at = 'home'; }
      draw();
      /* the 2D island may have travelled while 3D was loading: the scene opens on Home, so it lands there at once */
      if (at !== 'home') {
        var seq = ++travelSeq;
        race(s3('visitIsle', at, { instant: true }), 'visitIsle').then(function (ok) { if (seq === travelSeq && !ok) adoptStage('home', false); });
      }
    }).catch(function () { booting3d = false; use3D = false; });
  }
  /* one placement for the stage, with the child's chosen colourway (vr, D115) */
  function placement(p) { var o = { uid: p.uid, id: p.id, x: p.x, y: p.y }; if (p.vr != null) o.vr = p.vr; return o; }
  /* the view model the 3D stage renders (cheap; built after every commit) */
  function islandView() {
    var w = W(), u = me() || {};
    var a = anim3d; anim3d = {};
    var known = function (p) { return !!(p && C.item(p.id)); }, isles = {};
    /* the unlocked sky islands only (a dormant island's data stays untouched in the save and draws as a preview) */
    C.unlockedIsles(w).forEach(function (k) { if (k !== 'home') isles[k] = C.placedOn(w, k).filter(known).map(placement); });
    return {
      world: w,
      placed: w.placed.filter(known).map(placement),
      style: artState(w),
      unlocked: C.unlockedRegions(w),
      /* the whole crew through the core's crew API: a mascot's land and whether it joined this page session (D112) */
      pets: C.crewList(w).map(function (p) { var it = C.item(p.id); return { id: p.id, name: p.name, acc: C.wornBy(w, p.id), active: p.active, isle: (it && it.isle) || 'home', fresh: !!freshPets[p.id] }; }),
      avatar: { color: u.color || '#6C5CE7', emoji: u.avatar || '🙂', name: u.name || '' },
      mode: mode, selectedUid: selectedUid,
      isle: isleNow(), skyMap: skyMapOn, unlockedIsles: C.unlockedIsles(w), isles: isles,
      placing: placing ? placingView(w) : null,
      lit: lit, newUids: window._slwNew || {}, anim: a, showtime: showtimeOn
    };
  }
  function placingView(w) {
    var o = { id: placing.id, uid: placing.uid, x: placing.x, y: placing.y, isle: placing.isle, ok: C.canPlace(w, placing.id, placing.x, placing.y, placing.uid, placing.isle).ok, st: artState(w) };
    if (placing.vr != null) o.vr = placing.vr;
    return o;
  }
  /* the ✋ 'tap to play with it' badge: nearly every sky-island thing plays, so of those only a landmark
     wears it (V4.54 things keep theirs) and a full island is not lost under hands; the first-visit
     hint names the landmark */
  function handDot(it) { return !!(it.act && it.act !== 'home' && it.act !== 'launch' && (!it.isle || it.kind === 'landmark')); }
  /* HTML labels that float over the 3D items (same markup and classes as 2D) */
  function anchors3D() {
    var w = W(), list = [], k = isleNow();
    if (mode === 'play' && !skyMapOn) {
      C.placedOn(w, k).forEach(function (p) {          /* the visited island's tags only */
        var it = C.item(p.id); if (!it) return;
        var inner = '';
        if (it.act === 'launch') inner += '<span class="slw-tag play">▶ PLAY</span>';
        else if (handDot(it)) inner += '<span class="slw-dot" aria-hidden="true">✋</span>';
        if (window._slwNew && window._slwNew[p.uid]) inner += '<span class="slw-new">NEW!</span>';
        if (!inner) return;
        var el = document.createElement('div'); el.className = 'slw-tag3d'; el.innerHTML = inner;
        list.push({ el: el, uid: p.uid });
      });
    }
    if (mode === 'play') C.ISLE_ORDER.forEach(function (ik) { var sg = signEl(w, ik, k); if (sg) list.push({ el: sg, isle: ik }); });
    if (k !== 'home') return list;                     /* Home's locked-region signs show on Home only */
    var unlocked = {}; C.unlockedRegions(w).forEach(function (r) { unlocked[r] = 1; });
    Object.keys(C.REGIONS).forEach(function (rk) {
      var R = C.REGIONS[rk]; if (!R.unlock || unlocked[rk]) return;
      var it = C.item(R.unlock);
      var el = document.createElement('div'); el.className = 'slw-tag3d';
      el.innerHTML = '<button type="button" class="slw-sign" data-land="' + it.id + '">🔒 ' + esc(R.name) + (trial() ? '<br>FREE' : '<br>⭐ ' + fmt(it.price)) + '</button>';
      el.querySelector('button').addEventListener('click', function () { openItem(it.id); });
      list.push({ el: el, region: rk });
    });
    return list;
  }
  function drawStage3D() {
    var host = $('#slwStage', root); if (!host) return false;
    if (s3('attach', host) === undefined && !stage3d) return false;
    s3('sync', islandView());
    s3('setAnchors', anchors3D());
    return !!stage3d;
  }
  /* sheets pause the 3D render (the last frame stays behind the backdrop) */
  function cover(delta) {
    coverCount = Math.max(0, coverCount + delta);
    s3('setCovered', coverCount > 0);
  }
  /* shop/sheet icons: a 3D photocard when available, the SVG otherwise */
  function iconHtml(id, st) {
    var it = C.item(id), pst = st;
    if (it && it.kind === 'acc') {            /* accessories preview on the child's own runner (a mascot too) */
      var w = W(), run = w && C.activePetId(w);
      pst = Object.assign({}, st || {}, { pet: run, acc: run ? C.wornBy(w, run) : {} });
    }
    return '<span class="slw-pc" data-pc="' + esc(id) + '"' + (pst ? ' data-st="' + esc(JSON.stringify(pst)) + '"' : '') + '>' + ART.icon(id, st) + '</span>';
  }
  function fillPhotocards(el) {
    if (!use3D || !window.SLPhotocard || !el) return;
    /* the studio rim is the current player's colour (cheap and idempotent; icons are keyed by it) */
    try { if (SLPhotocard.setUser) SLPhotocard.setUser({ color: userInfo().color }); SLPhotocard.fill(el); } catch (e) {}
  }

  /* ================================================================
     SKY ISLANDS (v3) — which island the child is on, travel, and where
     things go. Visiting is memory only: no save field, nothing sent.
     Every placement call names its island; the core does every v3 write.
     ================================================================ */
  function isleNow() { return C.ISLES[visitIsle] ? visitIsle : 'home'; }
  function isleName(k) { return (C.ISLES[k] || C.ISLES.home).name; }
  /* a placed thing on ANY island → {p, isle}, or null */
  function findPlaced(w, uid) {
    var k = uid ? C.isleOf(w, uid) : null;
    if (k == null || !C.ISLES[k]) return null;
    var list = C.placedOn(w, k);
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].uid === uid) return { p: list[i], isle: k };
    return null;
  }
  /* one persistent live region outside the re-rendered root: each trip is spoken once */
  function announce(text) {
    var el = document.getElementById('slwLive');
    if (!el) {
      el = document.createElement('div'); el.id = 'slwLive'; el.className = 'slw-vh';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 60);
  }
  /* the host's fallback races (D44: visitIsle 3.5 s, unlockIsle 8 s, skyMap 3 s): a stage that never
     answers still lands the child; a call the stage superseded answers false */
  function fallbackSec(kind) {
    var T = window.SLIslesTravel, F = T && T.FALLBACK;
    return (F && +F[kind]) || { visitIsle: 3.5, unlockIsle: 8, skyMap: 3 }[kind];
  }
  function race(p, kind) {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { fin(true); }, fallbackSec(kind) * 1000);
      function fin(v) { if (!done) { done = true; clearTimeout(t); res(v); } }
      Promise.resolve(p).then(function (v) { fin(v !== false); }, function () { fin(true); });
    });
  }
  /* the 3D stage is drawing the island (else the 2D island is) */
  function on3D() { return !!(use3D && stage3d); }
  /* the 2D island draws every island and a v3 scene flies between them; only a scene without
     visitIsle (the V4.54 one) keeps the child on Home */
  function canTravel() { return !on3D() || typeof stage3d.visitIsle === 'function'; }
  /* the one way to travel → Promise<bool> (false when refused or superseded) */
  function goIsle(k, opts) {
    opts = opts || {};
    if (!C.ISLES[k]) return Promise.resolve(false);
    if (mode === 'place' && !opts.force) { toast(tx('isle.finishFirst')); return Promise.resolve(false); }
    if (!canTravel()) return Promise.resolve(k === isleNow() && !skyMapOn);
    if (!on3D() && k === isleNow()) return Promise.resolve(true);     /* 2D: already drawn there */
    /* a forced trip (a purchase, Take, Undo) never carries a half-done placement to another island */
    if (placing && placing.isle !== k) endPlacement(placing.fromBuy ? 'play' : 'edit');
    var seq = ++travelSeq, from = isleNow(), fromMap = skyMapOn;
    visitIsle = k; skyMapOn = false; selectedUid = null;      /* edit mode stays on, on the new island (D46) */
    if (!on3D()) {
      /* 2D: the frame shows the new island at once (a land's mascots take turns from visit to visit, D112) */
      landTurn[k] = (landTurn[k] || 0) + 1;
      drawStage(); drawBar(); drawIsleBar(); frame2d();
      arrived(k);
      return Promise.resolve(true);
    }
    s3('sync', islandView()); s3('setAnchors', anchors3D()); drawBar(); drawIsleBar();
    return race(s3('visitIsle', k, { instant: reduced || !!opts.instant }), 'visitIsle').then(function (ok) {
      if (seq !== travelSeq) return false;
      /* the stage refused the trip or its own trip took over: nothing is announced, and the host
         follows the stage (where the camera really is), else stays where it was */
      if (!ok) { adoptStage(from, fromMap); return false; }
      arrived(k);
      return true;
    });
  }
  /* the visited island changed under the stage without a trip: tell it, redraw the tags and the bar */
  function restage() { if (on3D()) { s3('sync', islandView()); s3('setAnchors', anchors3D()); } else drawStage(); drawBar(); drawIsleBar(); }
  /* after a refused or superseded trip, the stage's own visited island and pose win (a trip the
     stage refused leaves it where the host was; its first-open tour can take over a trip asked
     for before it was ready, and ends on that trip's island) */
  function adoptStage(from, fromMap) {
    var i = s3('info') || {};
    visitIsle = typeof i.isle === 'string' && C.ISLES[i.isle] ? i.isle : from;
    skyMapOn = typeof i.skyMap === 'boolean' ? i.skyMap : fromMap;
    restage();
  }
  function arrived(k) {
    var w = W(), open = C.isleUnlocked(w, k);
    announce(tx(open ? 'isle.arrived' : 'isle.arrivedLocked', { island: isleName(k) }));
    if (!open && mode !== 'play') { if (placing) endPlacement('play'); else { mode = 'play'; draw(); } toast(tx('isle.locked')); return; }
    if (open && k !== 'home' && !w.tutSeen['isle:' + k] && !document.querySelector('.slw-cele')) firstVisit(k);
  }
  /* the first time on an island you own: a hint for its landmark, with Edit (D47; never on a preview) */
  function firstVisit(k) {
    commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen['isle:' + k]) return { ok: false }; fw.tutSeen['isle:' + k] = true; return { ok: true }; }).then(function (res) {
      if (res && res.ok) drawIsleBar();                  /* its chip loses the New tag */
      if (!res || !res.ok || isleNow() !== k) return;
      toast(tx('isle.hint.' + k, null, tx('isle.firstVisit', { island: isleName(k) })), { label: 'Edit', fn: function () {
        if (mode === 'play' && isleNow() === k) { mode = 'edit'; selectedUid = null; draw(); }
      } });
    });
  }
  /* the Sky map pose (3D only; the island being visited stays the same underneath) */
  function skyMap(on) {
    if (!on3D() || typeof stage3d.skyMap !== 'function') return Promise.resolve(false);
    if (mode === 'place') { toast(tx('isle.finishFirst')); return Promise.resolve(false); }
    var seq = ++travelSeq, was = skyMapOn;
    skyMapOn = !!on; selectedUid = null;
    restage();
    return race(s3('skyMap', !!on), 'skyMap').then(function (ok) {
      if (seq !== travelSeq) return false;
      if (!ok) adoptStage(isleNow(), was);                      /* refused: the pose never changed */
      return !!ok;
    });
  }
  /* My Island opens on Home: a real open, leaving the tab, a profile switch */
  function resetIsle() {
    var away = visitIsle !== 'home' || skyMapOn;
    visitIsle = 'home'; skyMapOn = false; travelSeq++; lmBusy = {};
    if (away) s3('visitIsle', 'home', { instant: true });
  }

  /* ================================================================
     THE ISLAND BAR (host-ui hud.islandBar; D15, D24, D46): nav.slw-isles under the HUD, in 3D and 2D.
     3D: the Sky map chip first, then the six islands in ISLE_ORDER (2D: the islands only). Every chip is a
     plain button in the tab order (Left / Right also step between them); the strip scrolls sideways
     inside itself and keeps the island you are on in view. The here row under it names a sky island
     (its free squares, or Unlock while it is a preview) or the Sky map. Redrawn in place, focus kept.
     ================================================================ */
  function mapChip() { return on3D() && typeof stage3d.skyMap === 'function'; }
  function isleBarHtml() {
    var UI = window.SLIslesUI, w = W();
    if (!UI || !w || typeof ART.isleIcon !== 'function') return '';
    var k = isleNow(), off = mode === 'place' ? ' aria-disabled="true"' : '';      /* place mode: travel waits (D46) */
    var html = '<nav class="slw-isles" aria-label="' + esc(tx('isle.nav')) + '"><ul class="slw-islechips">';
    if (mapChip()) html += '<li><button type="button" class="slw-islechip map" data-isle="*" data-fk="isle:*" aria-pressed="' + skyMapOn + '" aria-label="' + esc(tx('isle.mapAria')) + '"' + off + '>' +
      '<span class="ic">' + ico('map') + '</span><span class="tx">' + esc(tx('isle.map')) + '</span></button></li>';
    /* a preview visit is 'here' AND locked: the state class alone, the lock on the icon */
    UI.chips(C, w, k, { t: tx, trial: trial(), skyMap: skyMapOn }).forEach(function (c) {
      html += '<li><button type="button" class="slw-islechip ' + c.state + (c.isNew ? ' new' : '') + '" data-isle="' + c.isle + '" data-fk="isle:' + c.isle + '" aria-label="' + esc(c.aria) + '"' +
        (c.state === 'here' ? ' aria-current="location"' : '') + off + '><span class="ic">' + ART.isleIcon(c.isle, { locked: c.locked }) + '</span><span class="tx">' + esc(c.short) + '</span>' +
        (c.isNew ? '<span class="slw-chipnew" aria-hidden="true">' + esc(tx('isle.chipNew')) + '</span>' : '') + '</button></li>';
    });
    return html + '</ul>' + hereHtml(w, k) + '</nav>';
  }
  /* the here row: hidden on Home; a sky island's name and room (editing: the name only, the edit bar
     counts the squares); a preview's Unlock (→ its land sheet, which holds the real Buy) and the way home */
  function hereHtml(w, k) {
    /* the icon sits inside the name, so on a phone (where the name takes a whole line) it never stands alone */
    if (skyMapOn) return '<div class="slw-here"><b class="nm"><span class="ic">' + ico('map') + '</span><span class="tx">' + esc(tx('isle.map')) + '</span></b><span class="st">' + esc(tx('isle.mapHint')) + '</span></div>';
    if (k === 'home') return '';
    var open = C.isleUnlocked(w, k), land = C.item(C.ISLES[k].unlock);
    var html = '<div class="slw-here"><b class="nm"><span class="ic">' + ART.isleIcon(k, { locked: !open }) + '</span><span class="tx">' + esc(isleName(k)) + '</span></b>';
    if (mode !== 'play') return html + '</div>';
    if (open) {
      var n = window.SLIslesUI.freeSquares(C, w, k);
      html += '<span class="st">' + esc(n === 0 ? tx('isle.takeFull') : n === 1 ? tx('isle.squareFree') : tx('isle.squaresFree', { n: n })) + '</span>';
    } else {
      html += '<span class="st">' + esc(tx('isle.lockedHint')) + '</span>' + (land ? '<button type="button" class="slw-buy" data-act="isle-unlock" data-land="' + land.id + '" data-fk="here:unlock">' +
        lbl('lock', trial() ? tx('isle.unlockFree') : tx('isle.unlockFor', { price: fmt(land.price) })) + '</button>' : '');
    }
    return html + '<button type="button" class="slw-btn" data-act="isle-home" data-fk="here:home">' + lbl('home', tx('isle.back')) + '</button></div>';
  }
  function wireIsleBar(nav, keepScroll) {
    nav.querySelectorAll('.slw-islechip').forEach(function (b) { b.addEventListener('click', onChip); });
    nav.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', onHudAction); });
    var strip = nav.querySelector('.slw-islechips');
    if (!strip) return;
    strip.addEventListener('keydown', chipKeys);
    if (keepScroll) strip.scrollLeft = keepScroll;
    showChip(strip, strip.querySelector('.here') || strip.querySelector('[aria-pressed="true"]'));
  }
  /* the bar again, in place (travel, the Sky map, a first visit): the chip that had focus keeps it */
  function drawIsleBar() {
    syncEdit();
    var old = root && root.querySelector('.slw-isles');
    if (!old) return;
    var strip = old.querySelector('.slw-islechips'), sl = strip ? strip.scrollLeft : 0, fk = focusKey(old);
    var box = document.createElement('div'); box.innerHTML = isleBarHtml();
    var nav = box.firstChild;
    if (nav) { old.parentNode.insertBefore(nav, old); wireIsleBar(nav, sl); }
    old.remove();
    if (fk) refocus(root, fk);
  }
  /* Edit waits on a locked preview: aria-disabled with the dashed off look, still focusable (D46) */
  function syncEdit() {
    var b = root && root.querySelector('.slw-hud [data-act="edit"]'), w = W();
    if (!b || !w) return;
    if (mode === 'play' && !C.isleUnlocked(w, isleNow())) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  }
  function onChip(e) {
    var b = e.currentTarget, k = b.getAttribute('data-isle');
    if (b.getAttribute('aria-disabled') === 'true') { toast(tx('isle.finishFirst')); return; }
    if (k === '*') { skyMap(!skyMapOn); return; }
    goIsle(k);
  }
  /* Left / Right from chip to chip (no wrap; never in place mode, where the arrows move the thing) */
  function chipKeys(e) {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || mode === 'place') return;
    var strip = e.currentTarget, list = Array.prototype.slice.call(strip.querySelectorAll('.slw-islechip'));
    var i = list.indexOf(document.activeElement), to = i < 0 ? null : list[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!to) return;
    e.preventDefault();
    try { to.focus({ preventScroll: true }); } catch (er) {}
    showChip(strip, to);
  }
  /* a sideways strip shows this button: scrollLeft only (scrollIntoView could scroll the page). Its start goes
     to the strip's start, which is a snap point of the strips (scroll-snap-align: start), so nothing re-snaps it
     half out of view */
  function showChip(strip, b) {
    if (!strip || !b || !(strip.scrollWidth > strip.clientWidth + 1)) return;
    var sr = strip.getBoundingClientRect(), br = b.getBoundingClientRect(), x0 = sr.left + (strip.clientLeft || 0);
    if (br.left < x0 - 0.5 || br.right > x0 + strip.clientWidth + 0.5) strip.scrollLeft += br.left - x0;
  }
  /* focus survives a redraw: the focused element's data-fk, found again in the new markup */
  function focusKey(scope) {
    var a = document.activeElement;
    return a && a !== document.body && scope && scope.contains(a) && a.getAttribute ? a.getAttribute('data-fk') : null;
  }
  function refocus(scope, fk) {
    var el = scope && scope.querySelector('[data-fk="' + fk + '"]');
    if (el) try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  /* 3D island signs (D55): one per island; the stage pins it to Home's gate pad, a land's dock or the Sky
     map, shows none for the island you are on (all six on the map) and none in edit or place mode */
  function signEl(w, ik, k) {
    var UI = window.SLIslesUI, s = UI && UI.lockSign(C, w, ik, { t: tx, trial: trial() });
    if (!s) return null;
    var open = C.isleUnlocked(w, ik), you = skyMapOn && ik === k, u = me() || {};
    var el = document.createElement('div'); el.className = 'slw-tag3d';
    el.innerHTML = '<button type="button" class="slw-sign isle' + (open ? ' open' : '') + (k === 'home' && !skyMapOn ? ' gate' : '') + '" data-isle="' + ik + '" aria-label="' +
      esc(you ? tx('isle.chipHere', { island: isleName(ik) }) : s.aria) + '">' + (open ? '' : ico('lock')) + '<span class="nm">' + esc(s.short) + (open && !you ? ' ›' : '') + '</span>' +
      (you ? '<span class="pr">' + esc((u.avatar || '🙂') + ' ' + tx('isle.you')) + '</span>' : s.priceText ? '<span class="pr">' + esc(s.priceText) + '</span>' : '') + '</button>';
    el.querySelector('button').addEventListener('click', function () {
      if (mode !== 'play') return;
      if (open) goIsle(ik); else openItem(C.ISLES[ik].unlock);
    });
    return el;
  }
  /* signs lose their price line on a narrow stage (< 480 px): the lock and the short name stay */
  function syncNarrow() {
    var wrap = root && root.querySelector('.slw-stagewrap');
    if (wrap) wrap.classList.toggle('slw-narrow', wrap.clientWidth > 0 && wrap.clientWidth < 480);
  }
  /* a land reveal: the reveal card sits low, so the page scrolls the stage up (never past its own top, under the
     app's sticky header) until its middle, where the camera frames the new landmark, is above the card. Before
     the card is up its top is taken as mid-screen */
  function revealView() {
    var wrap = root && root.querySelector('.slw-stagewrap'), vh = window.innerHeight || 0;
    if (!wrap || !vh || typeof window.scrollTo !== 'function') return;
    var hd = document.querySelector('header.topbar'), top = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0;
    var t = document.querySelector('.slw-cele.reveal .t'), cardTop = t ? t.getBoundingClientRect().top - 24 : vh * 0.5;
    var r = wrap.getBoundingClientRect(), dy = Math.min(r.top + r.height / 2 - (top + cardTop) / 2, r.top - top - 8);
    if (dy > 8) try { window.scrollTo({ top: (window.pageYOffset || 0) + dy, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) {}
  }
  var narrowQueued = false;
  try { window.addEventListener('resize', function () { if (narrowQueued) return; narrowQueued = true; setTimeout(function () { narrowQueued = false; syncNarrow(); }, 150); }); } catch (e) {}
  /* a just-bought placeable goes to the island it may stand on (D18): here when it fits here,
     else Home for a V4.54 thing, else its own island — travelling there first */
  function placeBought(it, quiet) {
    var UI = window.SLIslesUI, k = isleNow();
    var target = UI ? UI.placeTarget(C, W(), it.id, k) : (C.isV3(it) ? it.isle : 'home');
    if (!target) return;
    if (target === k) { if (!quiet) toast(it.name + ' is yours. Pick a spot.'); startPlacement(it.id, null, true, k); return; }
    toast(C.isV3(it) ? tx('isle.wrongIsle', { island: isleName(target) }) : tx('isle.homeOnly'));
    goIsle(target, { force: true }).then(function (ok) {
      if (ok && isleNow() === target) startPlacement(it.id, null, true, target);
      else toast(tx('edit.stored'));                    /* it waits in the bag; nothing is lost */
    });
  }
  /* 'Take to another island' (D20): two commits — into the bag, then fly and place */
  function openTake(uid) {
    var UI = window.SLIslesUI, w = W(), f = findPlaced(w, uid);
    if (!UI || !f) return;
    var it = C.item(f.p.id), targets = UI.takeTargets(C, w, uid);
    var ov = overlay('<h2>' + esc(tx('isle.takeTitle')) + '</h2><p style="font-size:12px;font-weight:700;color:#7c8696;">' + esc(tx('isle.takeHint')) + '</p><div class="slw-take">' +
      targets.map(function (t) {
        return '<button class="slw-btn big" type="button" data-take="' + t.isle + '"' + (t.full ? ' disabled' : '') + '>' +
          (typeof ART.isleIcon === 'function' ? ART.isleIcon(t.isle) + ' ' : '') + esc(t.name) + (t.full ? ' · ' + esc(tx('isle.takeFull')) : '') + '</button>';
      }).join('') + '</div>', { small: true });
    ov.querySelectorAll('[data-take]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.take, from = f.isle, p = f.p;
        ov._close();
        commit(function (u) { return C.store(u, uid); }).then(function (res) {
          if (!res || !res.ok) { toast('⚠️ ' + ((res && res.reason) || 'Couldn’t put that away.')); return; }
          lastUndo = { type: 'store', id: p.id, x: p.x, y: p.y, isle: from, vr: p.vr };
          s3('storeFx', uid);
          selectedUid = null;
          goIsle(k, { force: true }).then(function (ok) {
            if (ok && isleNow() === k) startPlacement(it.id, null, false, k, p.vr);
            else { draw(); toast(tx('edit.stored')); }
          });
        });
      });
    });
  }
  /* how long a landmark act keeps re-taps out (SLMotion.LANDMARK_BUSY, s → ms); 0 for any other act */
  function busyMs(act) {
    var M = window.SLMotion, B = (M && M.LANDMARK_BUSY) || { wheel: 6, lift: 4, zip: 4, drawbridge: 4, penguins: 6 };
    return Object.prototype.hasOwnProperty.call(B, act) ? (+B[act] || 0) * 1000 : 0;
  }
  /* how many colourways a placed v3 thing has ('Next colour', D115); 0 for a V4.54 thing */
  function colourCount(p) {
    var L = window.SLIslandLook, n = p && C.isV3(p.id) && L && L.VARIANTS ? +L.VARIANTS[p.id] || 0 : 0;
    return n > 1 ? n : 0;
  }
  function nextColour(uid) {
    var L = window.SLIslandLook, f = findPlaced(W(), uid), n = f ? colourCount(f.p) : 0;
    if (!n) return;
    var cur = typeof f.p.vr === 'number' ? f.p.vr : (L.variantOf ? L.variantOf(uid, f.p.id) : 0);
    commit(function (u) { return C.setVariant(u, uid, (cur + 1) % n); }).then(function (res) {
      if (res && res.ok) { sfx('tick'); if (on3D()) drawStage(); else redrawItem(uid); drawBar(); }   /* 2D: the crew keeps walking */
    });
  }

  /* ---------------- top-level render ---------------- */
  function render(again) {
    var keep = keepIsle; keepIsle = false;
    root = document.getElementById('worldView');
    if (!root) return;
    injectCss();
    /* a real open starts on Home; a refresh of the same child (another tab saved) stays where it was */
    if (!again && !keep) { resetIsle(); petTurn++; }       /* the Home crew's rotation steps once per open (D97) */
    var u = me();
    if (!u) { root.innerHTML = '<div class="slw-loading">' + esc(tx('player.pick')) + '</div>'; return; }
    var w = C.ensureWorld(u);
    /* what was placed before this open's repair (an old client may have covered a sky-island thing's square) */
    var UI = window.SLIslesUI, before = !again && UI ? JSON.parse(JSON.stringify(w)) : null, gone = [];
    /* first visit for this profile: grant the starter island exactly once */
    if (!again && (!w.starterGrantedAt || C.normalize(u))) {
      commit(function (fu) {
        var granted = C.grantStarter(fu);
        var fixed = C.normalize(fu);
        /* a brand-new island starts in the city and in the sky: neither makeover note is for it (D23) */
        if (granted) { var sw = C.ensureWorld(fu); sw.tutSeen.cityV2 = true; sw.tutSeen.pixelV3 = true; }
        /* the repair sent a sky-island thing back to the bag to make room (normalize N4): say so */
        gone = before && !granted ? UI.bumped(before, C.ensureWorld(fu)) : [];
        return { ok: granted || fixed };
      }).then(function () { render(true); bumpedToast(gone); });   /* once: the normal open (resume, intro, goal, 3D boot) */
      root.innerHTML = '<div class="slw-loading">Building your island…</div>';
      return;
    }
    if (dispose3dTimer) { clearTimeout(dispose3dTimer); dispose3dTimer = 0; }
    draw();
    if (!running) s3('resume');          /* never pull the shared canvas out from under a game */
    maybeIntro();
    checkGoalReached(true);
    measureServerTime();
    maybeBoot3D();
  }

  function draw() {
    if (!root) return;
    var u = me(); if (!u) return;
    var w = C.ensureWorld(u);
    renderedFor = state.activeUser;
    stopPets();
    var is3d = !!(use3D && stage3d), fk = focusKey(root);    /* the HUD button, chip or here-row button that had focus */
    root.innerHTML =
      '<div class="slw' + (mode !== 'play' ? ' slw-edit' : '') + (showtimeOn || (!is3d && Date.now() < encoreUntil) ? ' showtime' : '') + '">' +
        '<div class="slw-hud">' +
          '<button class="slw-learn" type="button" data-act="learn" data-fk="hud:learn">Back to learning</button>' +
          '<div class="slw-pts" title="Your spendable points">⭐ <span id="slwPts">' + fmt(u.points) + '</span></div>' +
          goalHtml(u) +
          '<div class="slw-acts">' +
            '<button class="slw-btn big" type="button" data-act="shop" data-fk="hud:shop">' + lbl('shop', 'Island Shop') + '</button>' +
            '<button class="slw-btn big" type="button" data-act="games" data-fk="hud:games">' + lbl('games', 'Games') + '</button>' +
            '<button class="slw-btn' + (mode === 'edit' ? ' on' : '') + '" type="button" data-act="edit" data-fk="hud:edit" aria-pressed="' + (mode === 'edit') + '">' + lbl('edit', mode === 'edit' ? 'Done' : 'Edit') + '</button>' +
            '<button class="slw-btn" type="button" data-act="pets" data-fk="hud:pets">' + lbl('crew', tx('label.crew')) + '</button>' +
            '<button class="slw-btn" type="button" data-act="showtime" data-fk="hud:light"' + (showtimeOn ? ' data-on="1"' : '') + ' aria-label="' + lightAria() + '">' + lightLabel() + '</button>' +
            '<button class="slw-btn" type="button" data-act="music" data-fk="hud:music" aria-pressed="' + musicOn() + '" aria-label="Music on or off">' + lbl('music', musicOn() ? 'On' : 'Off') + '</button>' +
            '<button class="slw-btn" type="button" data-act="sound" data-fk="hud:sound" aria-label="Sound on or off">' + (u.muted ? '🔇 Off' : '🔊 On') + '</button>' +
            '<button class="slw-btn" type="button" data-act="info" data-fk="hud:info" aria-label="How it works">❓</button>' +
          '</div>' +
        '</div>' +
        isleBarHtml() +
        '<div class="slw-stagewrap' + (is3d ? ' slw-is3d' : '') + '"><div class="slw-stage" id="slwStage"></div></div>' +
        '<div class="slw-pan" aria-hidden="true">Swipe the island sideways to see it all</div>' +
        '<div id="slwBar"></div>' +
        '<div class="slw-legend"><span><i style="background:#ffd23f;color:#4a3200;">▶ PLAY</i> tap to play a game</span>' +
          '<span><i style="background:#fff;border:2px solid #6c5ce7;">✋</i> tap to play with it</span>' +
          '<span><i style="background:#4a4468;color:#fff;">🔒</i> unlock in the Island Shop</span>' +
          '<span>Everything else is just for looks</span></div>' +
      '</div>';
    syncNarrow();
    drawStage();
    drawBar();
    islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
    fillPhotocards(root.querySelector('.slw-goal'));
    frame2d();
    root.querySelectorAll('.slw-hud [data-act]').forEach(function (b) { b.addEventListener('click', onHudAction); });
    var nav = root.querySelector('.slw-isles'); if (nav) wireIsleBar(nav);
    syncEdit();
    var g = root.querySelector('.slw-goal'); if (g) g.addEventListener('click', goalTap);
    if (fk) refocus(root, fk);
  }
  function goalTap() { var gid = C.goalId(W()); if (gid) openItem(gid); else openShop(); }

  /* the light toggle names what it switches to (D14): 'Daytime' while Showtime is on, else 'Showtime' */
  function lightLabel() { return showtimeOn ? lbl('sun', tx('light.day')) : lbl('moon', tx('light.showtime')); }
  function lightAria() { return esc(showtimeOn ? tx('light.toDay') : tx('light.toShow')); }
  function goalHtml(u) {
    if (trial()) return '<div class="slw-goal slw-trial" role="note"><span class="gt">Test mode: everything on the island is free. Your ⭐ stay put.</span></div>';
    var gp = C.goalProgress(u);
    if (!gp) return '<button class="slw-goal" type="button"><span class="gt">' + lbl('goal', 'Pick a savings goal in the Island Shop') + '</span></button>';
    return '<button class="slw-goal' + (gp.ready ? ' ready' : '') + '" type="button" aria-label="Savings goal: ' + esc(gp.name) + '">' +
      '<span class="gi">' + iconHtml(gp.id, artState(C.ensureWorld(u))) + '</span>' +
      '<span style="flex:1;min-width:0;"><span class="gt">' + (gp.ready ? 'Ready: you can buy ' + esc(gp.name) : '🎯 ' + esc(gp.name) + ' · ' + fmt(gp.have) + ' / ' + fmt(gp.price) + ' ⭐') + '</span>' +
      '<span class="gb" style="display:block;"><i style="width:' + gp.pct + '%"></i></span></span></button>';
  }

  /* ---------------- the island ---------------- */
  function drawStage() {
    if (use3D && stage3d && drawStage3D()) return;
    drawStage2D();
  }
  /* ================================================================
     THE 2D ISLAND (W4b.1; host-ui twoD, D49, D90, D110, D112). The visited island in the same
     16 × 10 frame, so STAGE_W / STAGE_H, the aspect ratio and the 760 px phone scroller never
     change: Home fills it, a sky island sits centred at SLIslesUI.offset with its dock planks and
     the way home, a locked one is its pale outline and one Unlock block. Every 2D position adds
     the island's (ox, oy); saves stay island-local. Pixel is daytime: no 'dusk'.
     ================================================================ */
  function off2d(k) {
    var UI = window.SLIslesUI, d = C.ISLES[k];
    if (UI && typeof UI.offset === 'function') return UI.offset(C, k);
    return !d || k === 'home' ? { ox: 0, oy: 0 } : { ox: Math.max(0, Math.floor((COLS - d.size[0]) / 2)), oy: Math.max(0, Math.floor((ROWS - d.size[1]) / 2)) };
  }
  function shiftCell(ck, o) { var q = String(ck).split(','); return (+q[0] + o.ox) + ',' + (+q[1] + o.oy); }
  /* one placed thing in the frame: a button when it can be tapped, else a picture (boxes, when given,
     collects each standing thing's drawn box in units) */
  function objHtml(p, it, st, o, boxes) {
    var sp = ART.sprite(p.id, Object.assign({ lit: !!lit[p.uid] }, bldState(st, p))); if (!sp) return '';
    var fw = it.fp[0], fh = it.fp[1], x = p.x + o.ox, y = p.y + o.oy;
    var hUnits = sp.h * (fw * 100 / sp.w);
    var top = PAD + (y + fh) * CH - hUnits;
    var isPath = it.kind === 'path';
    if (boxes && !isPath && hUnits > 0) boxes.push([x * 100, top, (x + fw) * 100, top + hUnits]);
    var interactive = mode !== 'play' || !!it.act;
    var tag = '';
    if (mode === 'play' && it.act === 'launch') tag = '<span class="slw-tag play">▶ PLAY</span>';
    else if (mode === 'play' && handDot(it)) tag = '<span class="slw-dot" aria-hidden="true">✋</span>';
    /* NEW! sits on the item's base (sprite boxes are taller than short art); games keep it on top, clear of ▶ PLAY */
    var newBadge = (window._slwNew && window._slwNew[p.uid]) ? '<span class="slw-new' + (it.act === 'launch' ? '' : ' base') + '">NEW!</span>' : '';
    var label = it.name + (it.act === 'launch' ? ' — tap to play' : it.act ? ' — tap to play with it' : '');
    var styleAttr = 'left:' + pct(x * 100, STAGE_W) + ';top:' + pct(top, STAGE_H) + ';width:' + pct(fw * 100, STAGE_W) + ';height:' + pct(hUnits, STAGE_H) + ';z-index:' + (isPath ? 2 : 10 + (y + fh) * 10) + ';';
    var cls = 'slw-obj' + (isPath ? ' path' : '') + (selectedUid === p.uid ? ' sel' : '');
    return interactive
      ? '<button type="button" class="' + cls + '" data-uid="' + p.uid + '" style="' + styleAttr + '" aria-label="' + esc(label) + '">' + sp.svg + tag + newBadge + '</button>'
      : '<div class="' + cls + '" data-uid="' + p.uid + '" style="' + styleAttr + '" role="img" aria-label="' + esc(it.name) + '">' + sp.svg + newBadge + '</div>';
  }
  function wireObj(el) {
    el.addEventListener('click', onObjectTap);
    if (screenProg[el.dataset.uid]) showProg(el, screenProg[el.dataset.uid]);   /* a redraw keeps the chosen show */
  }
  /* you: a little figure in your own colour (feet on the given point, in units) */
  function meHtml(u, mx, my, z) {
    return '<button type="button" class="slw-me" style="left:' + pct(mx, STAGE_W) + ';top:' + pct(my, STAGE_H) + ';z-index:' + z + ';" aria-label="That’s you!">' +
      '<svg viewBox="0 0 70 110"><ellipse cx="35" cy="104" rx="20" ry="5" fill="rgba(40,30,60,.18)"/><path d="M18 102 L22 58 Q35 48 48 58 L52 102 Z" fill="' + esc(u.color || '#6c5ce7') + '" stroke="#3b2f4a" stroke-width="3" stroke-linejoin="round"/><circle cx="35" cy="30" r="24" fill="#fff" stroke="#3b2f4a" stroke-width="3"/></svg>' +
      '<span class="face">' + esc(u.avatar || '🙂') + '</span></button>';
  }
  /* the bridge landing: plank pictograms laid across the way you walk (PX Plank, soil seams, bark rails),
     and outside it the first planks of the bridge home with their posts. a = along the walk (outward),
     b = across it; drawn per dockSide */
  var PLANK_PAL = { p: '#E9C9A0', s: '#C98B5A', r: '#A86E43', k: '#7A4E2D' }, plankMemo = {};
  function planks(side, stub) {
    var key = side + (stub ? '+' : ''), rows = [], x, y, a, b, ch;
    if (plankMemo[key]) return plankMemo[key];
    for (y = 0; y < 12; y++) {
      var row = '';
      for (x = 0; x < 12; x++) {
        a = side === 'e' ? x : side === 'w' ? 11 - x : side === 'n' ? 11 - y : y;
        b = side === 'e' || side === 'w' ? y : x;
        if (!stub) ch = b === 0 || b === 11 ? 'r' : a % 3 === 2 ? 's' : 'p';
        else if (a >= 9) ch = b === 1 || b === 2 || b === 9 || b === 10 ? 'k' : '.';
        else ch = b < 2 || b > 9 ? '.' : b === 2 || b === 9 ? 'r' : a % 3 === 2 ? 's' : 'p';
        row += ch;
      }
      rows.push(row);
    }
    return (plankMemo[key] = '<svg viewBox="0 0 100 ' + CH + '" preserveAspectRatio="none" shape-rendering="crispEdges">' + ART.pix(rows, PLANK_PAL, 100 / 12, 0, 0, CH / 12) + '</svg>');
  }
  var OUT = { w: [-1, 0], e: [1, 0], n: [0, -1], s: [0, 1] };
  /* the square just outside a landing (frame cells), or null off the frame */
  function stubOf(side, x, y) {
    var v = OUT[side] || OUT.s, sx = x + v[0], sy = y + v[1];
    return sx >= 0 && sy >= 0 && sx < COLS && sy < ROWS ? sx + ',' + sy : null;
  }
  function dockHtml(k, o) {
    var d = C.ISLES[k], side = d.dockSide || 's', html = '';
    if (typeof ART.pix !== 'function') return '';
    var cell = function (x, y, art) {
      return '<div class="slw-dock2d" aria-hidden="true" style="left:' + pct(x * 100, STAGE_W) + ';top:' + pct(PAD + y * CH, STAGE_H) + ';width:' + pct(100, STAGE_W) + ';height:' + pct(CH, STAGE_H) + ';">' + art + '</div>';
    };
    d.dock.forEach(function (xy) {
      var x = xy[0] + o.ox, y = xy[1] + o.oy, s = stubOf(side, x, y);
      html += cell(x, y, planks(side, false));
      if (s) html += cell(+s.split(',')[0], +s.split(',')[1], planks(side, true));
    });
    return html;
  }
  /* 'Back to Home Island' at the dock's outer edge (dockSide), right beside the landing when a spot there
     hides nothing that matters (the landing, you, any thing to tap: bare squares only); else, of those
     spots and the ones further along the frame's edge, the one that hides the least (a thing's share of
     its drawn box in `boxes`, in units, counts most) and is nearest the landing. Scored at a phone's
     button size and kept inside the frame (the phone scroller would clip it); a tie keeps the dockSide's
     own order */
  function bridgeHtml(k, o, boxes) {
    var d = C.ISLES[k], cells = d.dock.length ? d.dock : [d.centre], side = d.dockSide || 's';
    var BW = 400, BH = 100, G = 8, xs = [], ys = [], land = {}, keep = {}, soft = {};
    C.ISLE_CELLS[k].forEach(function (c) { land[shiftCell(c, o)] = 1; });
    cells.forEach(function (c) {
      var x = c[0] + o.ox, y = c[1] + o.oy, s = stubOf(side, x, y);
      xs.push(x); ys.push(y); keep[x + ',' + y] = 1; if (s) soft[s] = 1;
    });
    var x0 = Math.min.apply(null, xs) * 100, x1 = (Math.max.apply(null, xs) + 1) * 100, y0 = PAD + Math.min.apply(null, ys) * CH, y1 = PAD + (Math.max.apply(null, ys) + 1) * CH;
    var ym = (y0 + y1) / 2, xm = Math.max(BW / 2 + G, Math.min(STAGE_W - BW / 2 - G, (x0 + x1) / 2)), yu = Math.min(STAGE_H - BH - 4, y1 + G), ya = Math.max(4, y0 - G - BH);
    var you = [xs[0] * 100 + 15, y1 - 110, xs[0] * 100 + 85, y1];           /* you, standing on the landing */
    /* [left, top, css]: the css pins the button's edge nearest the landing (a desktop button is smaller) */
    var spots = {
      right: x1 + G + BW <= STAGE_W - G ? [x1 + G, ym - BH / 2, 'left:' + pct(x1 + G, STAGE_W) + ';top:' + pct(ym, STAGE_H) + ';transform:translateY(-50%);']
        : [STAGE_W - G - BW, ym - BH / 2, 'right:0.6%;top:' + pct(ym, STAGE_H) + ';transform:translateY(-50%);'],
      left: x0 - G - BW >= G ? [x0 - G - BW, ym - BH / 2, 'left:' + pct(x0 - G, STAGE_W) + ';top:' + pct(ym, STAGE_H) + ';transform:translate(-100%,-50%);']
        : [G, ym - BH / 2, 'left:0.6%;top:' + pct(ym, STAGE_H) + ';transform:translateY(-50%);'],
      under: [xm - BW / 2, yu, 'left:' + pct(xm, STAGE_W) + ';top:' + pct(yu, STAGE_H) + ';transform:translateX(-50%);'],
      underL: [G, yu, 'left:0.6%;top:' + pct(yu, STAGE_H) + ';'],
      underR: [STAGE_W - G - BW, yu, 'right:0.6%;top:' + pct(yu, STAGE_H) + ';'],
      above: [xm - BW / 2, ya, 'left:' + pct(xm, STAGE_W) + ';top:' + pct(ya + BH, STAGE_H) + ';transform:translate(-50%,-100%);'],
      aboveL: [G, ya, 'left:0.6%;top:' + pct(ya + BH, STAGE_H) + ';transform:translateY(-100%);'],
      aboveR: [STAGE_W - G - BW, ya, 'right:0.6%;top:' + pct(ya + BH, STAGE_H) + ';transform:translateY(-100%);']
    };
    var near = { w: ['left', 'under', 'above'], e: ['right', 'under', 'above'], n: ['right', 'left', 'above'], s: ['right', 'left', 'under'] }[side] || ['under'];
    var far = { w: ['underL', 'aboveL'], e: ['underR', 'aboveR'], n: ['aboveL', 'aboveR'], s: ['underL', 'underR'] }[side] || [];
    /* → [score, clean]: a sliver under the button's edge (< 15 × 12 units) still reads, so it is not hidden */
    var judge = function (r) {
      var n = 0, clean = true, cx, cy;
      for (cy = 0; cy < ROWS; cy++) for (cx = 0; cx < COLS; cx++) {
        var ox = Math.min(r[0] + BW, (cx + 1) * 100) - Math.max(r[0], cx * 100), oy = Math.min(r[1] + BH, PAD + (cy + 1) * CH) - Math.max(r[1], PAD + cy * CH), ck = cx + ',' + cy;
        if (ox < 15 || oy < 12) continue;
        if (keep[ck]) { n += 3; clean = false; } else if (soft[ck] || land[ck]) n += 1;
      }
      if (Math.min(r[0] + BW, you[2]) - Math.max(r[0], you[0]) > 0 && Math.min(r[1] + BH, you[3]) - Math.max(r[1], you[1]) > 0) { n += 3; clean = false; }
      (boxes || []).forEach(function (b) {
        var bx = Math.min(r[0] + BW, b[2]) - Math.max(r[0], b[0]), by = Math.min(r[1] + BH, b[3]) - Math.max(r[1], b[1]);
        if (bx >= 15 && by >= 12) { n += 6 * bx * by / ((b[2] - b[0]) * (b[3] - b[1])); clean = false; }
      });
      return [n, clean];
    };
    /* nearer the landing is better too (on a phone a far button scrolls the landing out of view): + 1 per 4 squares */
    var least = function (keys) {
      return keys.map(function (key) {
        var r = spots[key], dx = r[0] + BW / 2 - (x0 + x1) / 2, dy = r[1] + BH / 2 - ym;
        return { at: r, n: judge(r)[0] + Math.sqrt(dx * dx + dy * dy) / 400 };
      }).reduce(function (a, b) { return b.n < a.n ? b : a; });
    };
    var clean = near.filter(function (key) { return judge(spots[key])[1]; });
    var best = (clean.length ? least(clean) : least(near.concat(far))).at;
    return '<button type="button" class="slw-bridge2d" data-isle2d="home" style="' + best[2] + '">' + lbl('bridge', tx('isle.back')) + '</button>';
  }
  /* a locked island: one block with its name and price (FREE while we test) → the land's sheet */
  function lockHtml(k) {
    var land = C.item(C.ISLES[k].unlock); if (!land) return '';
    var name = tx('isle.unlockName', { island: isleName(k) }), price = trial() ? 'FREE' : '⭐ ' + fmt(land.price);
    return '<button type="button" class="slw-lock2d" data-land="' + land.id + '" aria-label="' + esc(name + ' · ' + price) + '">' + ico('lock') +
      '<span>' + esc(name) + '</span><span class="pr">' + esc(price) + '</span></button>';
  }
  function drawStage2D() {
    var stage = $('#slwStage', root); if (!stage) return;
    var u = me(), w = C.ensureWorld(u), st = artState(w), k = isleNow(), o = off2d(k), sky = k !== 'home', open = C.isleUnlocked(w, k);
    /* a redraw keeps keyboard focus: on the same thing when it is still drawn, else on the stage's first button */
    var act = document.activeElement, hadFocus = !!(act && act !== document.body && stage.contains(act));
    var focusKey = hadFocus && act.getAttribute ? act.getAttribute('data-uid') : null;
    var ground, cells, un = {};
    if (!sky) {
      C.unlockedRegions(w).forEach(function (r) { un[r] = 1; });
      ground = ART.island(COLS, ROWS, C.REGION_CELLS, un, { day: true, sky: true });
    } else {
      cells = {}; cells[k] = C.ISLE_CELLS[k].map(function (c) { return shiftCell(c, o); });
      if (open) un[k] = true;
      ground = ART.island(COLS, ROWS, cells, un, { day: true, sky: true, theme: k });
    }
    /* the island's things (a locked preview has none; unknown future ids stay in the save, not drawn) */
    var things = '', boxes = [];
    if (open) C.placedOn(w, k).forEach(function (p) {
      var it = p && C.item(p.id); if (!it) return;
      if (placing && placing.uid === p.uid) return;    /* drawn as the ghost while moving */
      things += objHtml(p, it, st, o, boxes);
    });
    var html = '<div class="slw-ground">' + ground + '</div>';
    /* the way home first, so it is the first stop for the keyboard (not shown in edit or place mode) */
    if (sky && mode === 'play') html += bridgeHtml(k, o, boxes);
    if (sky && !open) html += lockHtml(k);
    if (sky && open) html += dockHtml(k, o);
    html += things;
    if (!sky) {
      /* Home's locked land signs, on the outer edge of the locked land, clear of the home island */
      Object.keys(C.REGIONS).forEach(function (rk) {
        var R = C.REGIONS[rk]; if (!R.unlock || un[rk]) return;
        var rc = C.REGION_CELLS[rk], sy = 0, xs = [];
        rc.forEach(function (c) { var q = c.split(','); xs.push(+q[0]); sy += +q[1]; });
        var onLeft = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2 < C.COLS / 2;
        var it = C.item(R.unlock);
        html += '<button type="button" class="slw-sign" data-land="' + it.id + '" style="' + (onLeft ? 'left:1%;' : 'left:auto;right:1%;') + 'transform:translate(0,-50%);top:' + pct(PAD + (sy / rc.length + 0.5) * CH, STAGE_H) + ';">🔒 ' + esc(R.name) + (trial() ? '<br>FREE' : '<br>⭐ ' + fmt(it.price)) + '</button>';
      });
      /* you, beside the house */
      var house = w.placed.filter(function (p) { return p.id === 'house_cottage'; })[0];
      if (house) html += meHtml(u, house.x * 100 - 62, PAD + (house.y + 2) * CH - 110, 10 + (house.y + 2) * 10 + 4);
    } else if (open && C.ISLES[k].dock.length && mode !== 'place') {
      /* you, on the bridge landing (you came over the bridge); while placing, the landing's own square shows instead */
      var dk = C.ISLES[k].dock[0], dx = dk[0] + o.ox, dy = dk[1] + o.oy;
      html += meHtml(u, dx * 100 + 15, PAD + (dy + 1) * CH - 110, 10 + (dy + 1) * 10 + 4);
    }
    stage.innerHTML = html + '<div id="slwPets"></div><div id="slwPlace"></div>';
    stage.querySelectorAll('[data-uid]').forEach(wireObj);
    stage.querySelectorAll('[data-land]').forEach(function (el) { el.addEventListener('click', function () { openItem(el.dataset.land); }); });
    stage.querySelectorAll('[data-isle2d]').forEach(function (el) { el.addEventListener('click', function () { goIsle(el.dataset.isle2d); }); });
    var meEl = stage.querySelector('.slw-me');
    if (meEl) meEl.addEventListener('click', function () { meEl.classList.remove('wave'); void meEl.offsetWidth; meEl.classList.add('wave'); fx(meEl, '✦'); });
    if (mode === 'place') drawPlacement();
    startPets();
    if (hadFocus) {
      var back = (focusKey && stage.querySelector('[data-uid="' + focusKey + '"]')) || stage.querySelector('button');
      if (back) try { back.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  /* one thing redrawn in place (a 2D toggle): the crew keeps walking and focus stays on it */
  function redrawItem(uid) {
    var stage = $('#slwStage', root), old = stage && stage.querySelector('[data-uid="' + uid + '"]');
    var w = W(), f = findPlaced(w, uid), it = f && C.item(f.p.id);
    if (!old || !it || f.isle !== isleNow()) { drawStage(); return stage && stage.querySelector('[data-uid="' + uid + '"]'); }
    var box = document.createElement('div'); box.innerHTML = objHtml(f.p, it, artState(w), off2d(f.isle));
    var el = box.firstChild; if (!el) return null;
    var focused = document.activeElement === old;
    old.parentNode.insertBefore(el, old); old.remove();
    wireObj(el);
    if (focused) try { el.focus({ preventScroll: true }); } catch (e) {}
    return el;
  }
  /* phones: the 2D frame is wider than the screen. Home starts centred; a sky island starts with its
     Unlock block (a locked preview), then the way home, then you on the landing in view, each by the
     smallest sideways step from centre that keeps the ones before it on screen */
  function frame2d() {
    var wrap = root && root.querySelector('.slw-stagewrap');
    if (!wrap || on3D() || !(wrap.scrollWidth > wrap.clientWidth + 4)) return;
    var view = wrap.clientWidth, max = wrap.scrollWidth - view, lo = 0, hi = max, s = max / 2, wr = wrap.getBoundingClientRect();
    var sky = !!wrap.querySelector('.slw-bridge2d, .slw-lock2d');
    ['.slw-lock2d', '.slw-bridge2d'].concat(sky ? ['.slw-me'] : []).forEach(function (sel) {
      var b = wrap.querySelector(sel); if (!b) return;
      var br = b.getBoundingClientRect(), a = br.left - wr.left + wrap.scrollLeft - 12, z = br.right - wr.left + wrap.scrollLeft + 12;
      var from = Math.max(lo, z - view), to = Math.min(hi, a);          /* the scrolls that show it, inside the ones kept so far */
      if (from > to) { s = lo = hi = z - view > hi ? hi : lo; return; }  /* it cannot join the view: as much of it as fits, a swipe away (and that holds) */
      lo = from; hi = to; s = Math.max(lo, Math.min(hi, s));
    });
    wrap.scrollLeft = Math.max(0, Math.min(max, s));
  }

  function fx(el, txt) {
    if (reduced) return;                       /* reduced motion: the act's end state says it */
    var stage = $('#slwStage', root); if (!stage || !el) return;
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'slw-fx'; d.textContent = txt;
    d.style.left = ((r.left + r.width / 2 - s.left) / s.width * 100) + '%';
    d.style.top = ((r.top - s.top) / s.height * 100) + '%';
    stage.appendChild(d);
    setTimeout(function () { d.remove(); }, 1150);
  }

  /* ---------------- the crew out on the 2D island (D97, D112) ---------------- */
  function stopPets() { petTimers.forEach(function (t) { clearTimeout(t); }); petTimers = []; }
  /* who is out, through the core's crew API only. Home: the runner, the pets adopted this page session,
     then the rest taking turns (at most 6). A visited land: the runner and that land's own mascots (at
     most 2 of them; they take turns from visit to visit when more are owned). A locked preview: nobody. */
  function petsOut(w, k) {
    var crew = C.crewList(w), runner = crew.filter(function (p) { return p.active; })[0] || crew[0];
    if (!runner) return [];
    var others = crew.filter(function (p) { return p !== runner; });
    var turn = function (list, n) { var t = list.length ? n % list.length : 0; return list.slice(t).concat(list.slice(0, t)); };
    if (k !== 'home') {
      if (!C.isleUnlocked(w, k)) return [];
      var guests = others.filter(function (p) { var it = C.item(p.id); return !!(it && it.isle === k); });
      return [runner].concat(turn(guests, (landTurn[k] || 1) - 1).slice(0, LAND_MASCOTS_2D));
    }
    var fresh = others.filter(function (p) { return freshPets[p.id]; });
    var rest = turn(others.filter(function (p) { return !freshPets[p.id]; }), Math.max(0, petTurn - 1));
    return [runner].concat(fresh, rest).slice(0, PETS_2D);
  }
  /* a tapped pet answers in its own voice (SLSound.PET_VOICE: a mascot sounds like itself in 2D too, as in 3D) */
  function petVoice(id) {
    var S = window.SLSound;
    try { if (S && S.make) { S.make({ muted: function () { var u = me(); return !!(u && u.muted); } }).pet(id, 0.8); return; } } catch (e) {}
    sfx('unlock');
  }
  /* free squares nearest a point first (ties in a stable order) */
  function nearestFirst(cells, at) {
    var d = function (c) { var q = c.split(','); return Math.abs(+q[0] - at[0]) + Math.abs(+q[1] - at[1]) * 1.1; };
    return cells.slice().sort(function (a, b) { return d(a) - d(b) || (a < b ? -1 : a > b ? 1 : 0); });
  }
  function startPets() {
    stopPets();
    var host = $('#slwPets', root); if (!host) return;
    var u = me(), w = C.ensureWorld(u), k = isleNow(), o = off2d(k), d = C.ISLES[k];
    var pets = petsOut(w, k);
    host.innerHTML = '';
    if (!pets.length) return;
    var land = Object.keys(C.landSetOf(w, k));
    var occ = C.occupancy(w, undefined, k).occ;
    var free = land.filter(function (c) { return !occ[c] || occ[c].layer === 'ground'; });
    if (!free.length) return;
    /* on a land: the runner beside the bridge landing (it came over with you), the mascots near the landmark */
    var dock = {}; d.dock.forEach(function (xy) { dock[xy[0] + ',' + xy[1]] = 1; });
    var byDock = k === 'home' ? null : nearestFirst(free.filter(function (c) { return !dock[c]; }), d.dock[0] || d.centre);
    var byMark = k === 'home' ? null : nearestFirst(free, d.landmarkSpot || d.centre), used = {};
    var roam = free.filter(function (c) { return !dock[c]; });            /* you stand on the landing */
    if (!roam.length) roam = free;
    pets.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slw-pet';
      b.setAttribute('aria-label', p.name + ' the ' + C.item(p.id).name.toLowerCase() + (p.active ? ' (runs your Debut Run)' : ''));
      var frame = 0, worn = C.wornBy(w, p.id);
      b.innerHTML = '<span class="nm">' + esc(p.name) + (p.active ? ' 🏅' : '') + '</span>' + ART.pet(p.id, { acc: worn, frame: 0 });
      var pick = k === 'home' ? free[(i * 7 + 3) % free.length]
        : ((i === 0 ? byDock : byMark) || []).filter(function (c) { return !used[c]; })[0] || free[i % free.length];
      used[pick] = 1;
      var cell = pick.split(',');
      var pos = { x: +cell[0], y: +cell[1] };
      function zFor(y) { return 10 + (Math.round(y) + o.oy + 1) * 10 + 5; }
      function placeAt(x, y, dur, keepZ) {
        b.style.transitionDuration = (reduced ? 0 : dur) + 's';
        b.style.left = pct((x + o.ox) * 100 + 5, STAGE_W);
        b.style.top = pct(PAD + (y + o.oy + 1) * CH - 72, STAGE_H);
        if (!keepZ) b.style.zIndex = zFor(y);
      }
      placeAt(pos.x, pos.y, 0);
      b.addEventListener('click', function () {
        b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop');
        b.classList.add('say'); setTimeout(function () { b.classList.remove('say'); }, 1800);
        fx(b, ['♪', '✦', '★'][Math.floor(Math.random() * 3)]);
        petVoice(p.id);
      });
      host.appendChild(b);
      function wander() {
        if (!document.body.contains(b)) return;
        var target = roam[Math.floor(Math.random() * roam.length)].split(',');
        var tx = +target[0], ty = +target[1];
        var dist = Math.hypot(tx - pos.x, ty - pos.y);
        b.classList.toggle('flip', tx < pos.x);
        var dur = Math.max(0.8, dist * 0.7), y0 = pos.y, t0 = Date.now();
        placeAt(tx, ty, reduced ? 0 : dur, !reduced);
        var walk = setInterval(function () {
          if (!document.body.contains(b)) { clearInterval(walk); return; }
          /* depth follows the row the pet is crossing right now, so it walks
             behind the house instead of over its roof */
          var f = Math.min(1, (Date.now() - t0) / (dur * 1000));
          b.style.zIndex = zFor(y0 + (ty - y0) * f);
          frame = 1 - frame;
          var svgHost = b.querySelector('svg');
          if (svgHost && !reduced) svgHost.outerHTML = ART.pet(p.id, { acc: worn, frame: frame });
        }, 220);
        petTimers.push(setTimeout(function () { clearInterval(walk); b.style.zIndex = zFor(ty); }, dur * 1000));
        pos = { x: tx, y: ty };
        petTimers.push(setTimeout(wander, dur * 1000 + 1500 + Math.random() * 3500));
      }
      if (!reduced) petTimers.push(setTimeout(wander, 800 + i * 900));
    });
  }

  /* ---------------- HUD actions ---------------- */
  function onHudAction(e) {
    var a = e.currentTarget.dataset.act;
    if (a === 'learn') { closeAllOverlays(); if (typeof setActiveApp === 'function') setActiveApp('maths'); return; }
    /* on a sky island (owned or a preview) the shop opens on that island's own section; on Home as V4.54 (D16, D99) */
    if (a === 'shop') return isleNow() === 'home' ? openShop() : openShop('sky', { isle: isleNow() });
    if (a === 'isle-home') return goIsle('home');
    if (a === 'isle-unlock') return openItem(e.currentTarget.getAttribute('data-land'));
    if (a === 'games') return openGames();
    if (a === 'pets') return openPets();
    if (a === 'info') return openInfo();
    if (a === 'showtime') {
      var nowT = Date.now();
      if (nowT - lastShowtimeTap < 900) return;         /* no light/dark strobing from button mashing */
      lastShowtimeTap = nowT;
      showtimeOn = !showtimeOn;
      try { localStorage.setItem('slwShowtime', showtimeOn ? '1' : '0'); } catch (er) {}
      s3('showtime', showtimeOn);
      islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
      if (showtimeOn) { sample('sting', 0.6); try { if (window.SLSound) SLSound.make({ muted: function () { var u = me(); return !!(u && u.muted); } })('whoosh'); } catch (er) {} } else sample('chip', 0.5);
      var slw = root.querySelector('.slw'); if (slw) slw.classList.toggle('showtime', showtimeOn);
      e.currentTarget.innerHTML = lightLabel();
      e.currentTarget.setAttribute('aria-label', lightAria());
      if (showtimeOn) e.currentTarget.setAttribute('data-on', '1'); else e.currentTarget.removeAttribute('data-on');
      return;
    }
    if (a === 'music') {
      var onNow = !musicOn();
      try { if (window.SLMusic) SLMusic.setEnabled(onNow); } catch (er) {}
      if (onNow) islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
      e.currentTarget.innerHTML = lbl('music', onNow ? 'On' : 'Off');
      e.currentTarget.setAttribute('aria-pressed', String(onNow));
      return;
    }
    if (a === 'sound') {
      var u = me(); u.muted = !u.muted; saveState();
      try { if (typeof renderMuteBtn === 'function') renderMuteBtn(); } catch (er) {}
      e.currentTarget.textContent = u.muted ? '🔇 Off' : '🔊 On';
      if (!u.muted) sfx('correct');
      return;
    }
    if (a === 'edit') {
      var lk = isleNow();
      if (mode === 'play' && !C.isleUnlocked(W(), lk)) {   /* a locked island is a preview: nothing to edit yet (D46) */
        toast(tx('isle.locked'), { label: tx('isle.seeUnlock'), fn: function () { openItem(C.ISLES[lk].unlock); } });
        return;
      }
      if (mode === 'place') cancelPlacement();
      if (skyMapOn) skyMap(false);                          /* edit happens on the island, not over the Sky map */
      mode = mode === 'edit' ? 'play' : 'edit';
      selectedUid = null;
      draw();
    }
  }

  /* ---------------- tapping objects ---------------- */
  function onObjectTap(e) { tapItem(e.currentTarget.dataset.uid, e.currentTarget); }
  function tapItem(uid, el) {
    var w = W(), f = findPlaced(w, uid), p = f && f.p;
    if (!p) return;
    var it = C.item(p.id); if (!it) return;
    /* the stage picks only the visited island's things; anything else is a safety net: fly there, no act */
    if (f.isle !== isleNow()) { if (mode === 'play') goIsle(f.isle); return; }
    if (mode === 'edit') { selectedUid = uid; drawStage(); drawBar(); return; }
    if (mode === 'place') return;
    if (window._slwNew && window._slwNew[uid]) { delete window._slwNew[uid]; if (use3D && stage3d) s3('setAnchors', anchors3D()); }
    if (use3D && stage3d) {
      /* the 3D act plays its own animation and sounds; app-level effects stay here */
      switch (it.act) {
        case 'launch': {
          var go = false, start = function () { if (!go) { go = true; launch(it.game); } };
          Promise.resolve(s3('act', uid, 'launch')).then(start, start);
          setTimeout(start, 1200);
          return;
        }
        case 'home': s3('act', uid, 'home'); return openHome(uid);
        case 'glow': lit[uid] = !lit[uid]; s3('setLit', uid, lit[uid]); sample(lit[uid] ? 'star' : 'chip', 0.5) || sfx('tick'); return;
        case 'encore': {
          /* the stage's encore: 8 s of Showtime, then the child's own setting comes back */
          if (Date.now() < encoreUntil) return;
          encoreUntil = Date.now() + 8000;
          s3('act', uid, 'encore');                       /* its motion cue plays the sting */
          s3('showtime', true, { encoreMs: 8000 });
          return;
        }
        /* the castle keep: the bridge goes down or up, never twice at once (lit = lowered) */
        case 'drawbridge':
          if (Date.now() < (lmBusy[uid] || 0)) return;
          lmBusy[uid] = Date.now() + busyMs('drawbridge');
          lit[uid] = !lit[uid];
          s3('setLit', uid, lit[uid]); s3('act', uid, 'drawbridge');
          return;
        default: {
          if (!it.act) return;
          /* the other landmark acts (wheel, lift, zip, penguins) ignore re-taps while they run */
          if (busyMs(it.act)) { if (Date.now() < (lmBusy[uid] || 0)) return; lmBusy[uid] = Date.now() + busyMs(it.act); s3('act', uid, it.act); return; }
          /* a remembered on / off (open, scoop, bloom, peek, lights): a state toggle, like glow; the model plays its own cues */
          var ai = C.ACT_INFO && C.ACT_INFO[it.act];
          if (ai && ai.toggle) { lit[uid] = !lit[uid]; s3('setLit', uid, lit[uid]); return; }
          s3('act', uid, it.act); return;
        }
      }
    }
    if (!el) return;
    /* 2D (D110): a sprite whose act group carries an ACT_INFO class (every land-shop pictogram, the generic
       block of a v3 id with an act) plays through ACT_INFO, whatever its act is called */
    var grp = el.querySelector('.slw-act');
    if (grp && /(^|\s)slw-anim-/.test(grp.getAttribute('class') || '')) return actInfo2d(uid, it, el, grp);
    switch (it.act) {
      case 'launch': return launch(it.game);
      case 'home': return openHome();
      case 'glow': lit[uid] = !lit[uid]; sfx('tick'); redrawItem(uid); return;
      /* the first sky-island sprites (host-ui twoD.acts): the beach hut's doors and the keep's bridge are
         remembered toggles that redraw and settle; the rides and landmarks play their own group once */
      case 'open': case 'drawbridge': {
        if (busy2d(uid, it.act)) return;
        lit[uid] = !lit[uid];
        if (it.act === 'drawbridge') sample('sting', 0.5) || sfx('tick'); else sfx('tick');
        var nu = redrawItem(uid);
        if (nu && !reduced) go2d(nu, '.slw-act');
        return;
      }
      case 'ride': case 'slide': case 'wobble': case 'skate': case 'wheel': case 'lift': case 'zip': case 'penguins': {
        if (busy2d(uid, it.act)) return;
        if (!reduced) go2d(el, '.slw-act');
        fx(el, glyphOf(it.act)); sample('chip', 0.5) || sfx('tick');
        return;
      }
      case 'bounce': {
        el.classList.remove('slw-bounce'); void el.offsetWidth; el.classList.add('slw-bounce');
        var petEl = $('.slw-pet', root);
        if (petEl) { petEl.style.transitionDuration = '0.4s'; petEl.style.left = el.style.left; petEl.style.top = 'calc(' + el.style.top + ' + 2%)'; setTimeout(function () { petEl.classList.remove('hop'); void petEl.offsetWidth; petEl.classList.add('hop'); fx(el, '✦'); }, 420); }
        else fx(el, '✦');
        sample('chip', 0.6) || sfx('unlock');
        return;
      }
      case 'splash': { var wtr = el.querySelector('.slw-water'); if (wtr) { wtr.classList.remove('go'); void el.offsetWidth; wtr.classList.add('go'); } fx(el, '💦'); sfx('correct'); return; }
      case 'swing': { var sw = el.querySelector('.slw-swing'); if (sw) { sw.classList.remove('go'); void el.offsetWidth; sw.classList.add('go'); } fx(el, '🎶'); return; }
      case 'bubbles': { var bb = el.querySelector('.slw-bubbles'); if (bb) { bb.classList.remove('go'); void el.offsetWidth; bb.classList.add('go'); } fx(el, '🫧'); sfx('unlock'); return; }
      case 'spin': { var sp = el.querySelector('.slw-spin'); if (sp) { sp.classList.add('fast'); setTimeout(function () { sp.classList.remove('fast'); }, 2200); } fx(el, '🌬️'); return; }
      case 'wave': { var fl = el.querySelector('.slw-flag'); if (fl) { fl.classList.add('fast'); setTimeout(function () { fl.classList.remove('fast'); }, 1600); } fx(el, '🎉'); return; }
      /* the city buildings: restart the sprite's own hook (island-encore.css animates .go; every act ends within 3 s) */
      case 'snap': go2d(el, '.slw-strip'); fx(el, '✦'); sample('chip', 0.6) || sfx('tick'); return;
      case 'serve': go2d(el, '.slw-hatch'); go2d(el, '.slw-pearls'); fx(el, '♪'); sample('coins', 0.4) || sfx('correct'); return;
      case 'screen': {
        /* the LED tower cycles its four shows: name marquee, pixel pet, EQ, star field (≤ 2 changes a second) */
        var nowS = Date.now();
        if (nowS - (screenTap[uid] || 0) < 500) return;
        screenTap[uid] = nowS;
        screenProg[uid] = ((screenProg[uid] || 0) + 1) % 4;
        showProg(el, screenProg[uid]);
        go2d(el, '.slw-marquee'); sfx('tick'); return;
      }
      case 'record': go2d(el, '.slw-onair'); go2d(el, '.slw-eq'); fx(el, '♪'); sample('chip', 0.5) || sfx('tick'); return;
      case 'dance': go2d(el, '.slw-floor'); fx(el, '♪'); sample('star', 0.5) || sfx('correct'); return;
      case 'hangout': el.querySelectorAll('.slw-bean').forEach(function (b) { restart(b); }); fx(el, '✦'); sfx('tick'); return;
      case 'encore': {
        if (Date.now() < encoreUntil) return;
        encoreUntil = Date.now() + 8000;
        var slw = root.querySelector('.slw');
        if (slw && !showtimeOn) {
          slw.classList.add('showtime');
          setTimeout(function () { var s2 = root && root.querySelector('.slw'); if (s2 && !showtimeOn) s2.classList.remove('showtime'); }, 8000);
        }
        fx(el, '★'); sample('sting', 0.6) || sfx('fanfare');
        return;
      }
    }
  }
  var screenProg = {}, screenTap = {};
  function showProg(el, n) {
    var scr = el && el.querySelector('.slw-screen'); if (!scr) return;
    scr.setAttribute('data-prog', String(n));
    scr.querySelectorAll('.slw-prog').forEach(function (g) { g.setAttribute('display', g.classList.contains('p' + n) ? 'inline' : 'none'); });
  }
  function restart(node) { node.classList.remove('go'); void node.getBoundingClientRect(); node.classList.add('go'); }
  function go2d(el, sel) { var n = el.querySelector(sel); if (n) restart(n); }
  function glyphOf(act) { var ai = C.ACT_INFO && C.ACT_INFO[act]; return (ai && ai.glyph) || '✦'; }
  /* a landmark act ignores re-taps while it runs (SLMotion.LANDMARK_BUSY); true = still busy */
  function busy2d(uid, act) {
    var ms = busyMs(act);
    if (!ms) return false;
    if (Date.now() < (lmBusy[uid] || 0)) return true;
    lmBusy[uid] = Date.now() + ms;
    return false;
  }
  /* a 2D act through ACT_INFO (D110): a toggle flips lit and redraws the sprite; a one-shot restarts its
     act group once and shows the act's glyph; nothing moves under reduced motion (the rest pose is the
     end state). An act this build does not know does nothing. */
  function actInfo2d(uid, it, el, grp) {
    var ai = C.ACT_INFO && it.act && Object.prototype.hasOwnProperty.call(C.ACT_INFO, it.act) ? C.ACT_INFO[it.act] : null;
    if (!ai || busy2d(uid, it.act)) return;
    if (ai.toggle) {
      lit[uid] = !lit[uid];
      sample(lit[uid] ? 'star' : 'chip', 0.5) || sfx('tick');
      redrawItem(uid);
      return;
    }
    if (!reduced) restart(grp);
    fx(el, ai.glyph || '✦');
    sample('chip', 0.5) || sfx('tick');
  }

  /* ---------------- edit / placement ---------------- */
  function drawBar() {
    var bar = $('#slwBar', root); if (!bar) return;
    var w = W(), k = isleNow(), UI = window.SLIslesUI;
    if (mode === 'play') { bar.innerHTML = ''; return; }
    if (mode === 'place' && placing) {
      var chk = C.canPlace(w, placing.id, placing.x, placing.y, placing.uid, placing.isle);
      var it = C.item(placing.id);
      bar.innerHTML = '<div class="slw-bar"><div class="msg' + (chk.ok ? '' : ' bad') + '" id="slwPlaceMsg">' +
        (chk.ok ? 'Tap a square to move it, then confirm.' : esc(chk.reason)) + '</div>' +
        '<button class="slw-btn on big" type="button" id="slwPlaceOk"' + (chk.ok ? '' : ' disabled') + '>Put ' + esc(it.name.toLowerCase()) + ' here</button>' +
        '<button class="slw-btn big" type="button" id="slwPlaceCancel">' + (placing.uid ? 'Cancel move' : lbl('storage', 'Keep it for later')) + '</button>' +
        '<span class="slw-kbhint" style="font-size:12px;color:#7c8696;font-weight:700;">Keyboard: arrows move · Enter places · Esc cancels</span></div>';
      $('#slwPlaceOk', bar).addEventListener('click', confirmPlacement);
      $('#slwPlaceCancel', bar).addEventListener('click', cancelPlacement);
      return;
    }
    /* edit mode, always on the visited island: the selection's actions, then the ONE shared bag seen from here */
    var html = '<div class="slw-bar">', sel = selectedUid ? findPlaced(w, selectedUid) : null, sit = sel && C.item(sel.p.id);
    if (sit) {
      var takes = canTravel() && UI ? UI.takeTargets(C, w, selectedUid).filter(function (t) { return !t.full; }) : [];
      html += '<div class="msg">' + esc(sit.name) + '</div>' +
        '<button class="slw-btn on" type="button" id="slwMove">Move</button>' +
        (C.isStorable(sit) ? '<button class="slw-btn" type="button" id="slwStore">' + lbl('storage', 'Put away') + '</button>'
          : '<span style="font-size:12px;font-weight:700;color:#7c8696;">' + esc(sit.kind === 'landmark' ? tx('edit.landmarkStays') : 'This one always stays on your island — you can move it.') + '</span>') +
        (takes.length ? '<button class="slw-btn" type="button" id="slwTake">' + esc(tx('isle.take')) + '</button>' : '') +
        (colourCount(sel.p) ? '<button class="slw-btn slw-colourbtn" type="button" id="slwColour">' + esc(tx('edit.colour')) + '</button>' : '') +
        (sit.id === 'house_cottage' ? '<button class="slw-btn" type="button" id="slwHome">' + lbl('home', 'Restyle') + '</button>' : '');
    } else {
      var free = UI ? UI.freeSquares(C, w, k) : -1;
      html += '<div class="msg"><b>' + esc(tx('edit.editing', { island: isleName(k) })) + '</b>' +
        (free < 0 ? '' : ' · ' + esc(free === 1 ? tx('isle.squareFree') : tx('isle.squaresFree', { n: free }))) + '<br>' + esc(tx('edit.hint')) + '</div>';
    }
    html += '<button class="slw-btn" type="button" id="slwEditDone">Done</button></div>';
    var inv = C.inventory(w, k).filter(function (x) { return C.isPlaceable(C.item(x.id)); });
    var away = UI ? UI.bag(C, w, k).elsewhere : [];
    html += '<div style="font-size:13px;font-weight:700;color:#7c8696;padding:6px;">' + lbl('storage', tx('edit.bag')) + '</div>' +
      '<div class="slw-tray" aria-label="' + esc(tx('edit.bagHere', { island: isleName(k) })) + '">' + (inv.length
      ? inv.map(function (x) { var it2 = C.item(x.id); return '<button type="button" class="slw-trayitem" data-tray="' + x.id + '"><b>×' + x.count + '</b>' + ART.icon(x.id, artState(w)) + '<span>' + esc(it2.name) + '</span></button>'; }).join('')
      : '<div style="font-size:13px;font-weight:700;color:#7c8696;padding:6px;">' + esc(tx(away.length ? 'edit.bagEmptyHere' : 'edit.bagEmpty')) + '</div>') + '</div>';
    /* stored things that belong on another island: one line each, with a way there (never to a locked island) */
    if (away.length) html += '<div class="slw-bar">' + away.map(function (e) {
      return '<div class="msg">' + esc(tx('edit.bagElsewhere', { n: e.n, island: isleName(e.isle) })) + '</div>' +
        (canTravel() && C.isleUnlocked(w, e.isle) ? '<button class="slw-btn" type="button" data-goisle="' + e.isle + '">' + esc(tx('isle.goThere')) + '</button>' : '');
    }).join('') + '</div>';
    bar.innerHTML = html;
    var mv = $('#slwMove', bar); if (mv) mv.addEventListener('click', function () { var s = findPlaced(W(), selectedUid); if (s) startPlacement(s.p.id, s.p.uid, false); });
    var stb = $('#slwStore', bar); if (stb) stb.addEventListener('click', function () { storeSelected(); });
    var hm = $('#slwHome', bar); if (hm) hm.addEventListener('click', openHome);
    var tk = $('#slwTake', bar); if (tk) tk.addEventListener('click', function () { openTake(selectedUid); });
    var cb = $('#slwColour', bar); if (cb) cb.addEventListener('click', function () { nextColour(selectedUid); });
    $('#slwEditDone', bar).addEventListener('click', function () { mode = 'play'; selectedUid = null; draw(); });
    bar.querySelectorAll('[data-tray]').forEach(function (b) { b.addEventListener('click', function () { startPlacement(b.dataset.tray, null, false, k); }); });
    bar.querySelectorAll('[data-goisle]').forEach(function (b) { b.addEventListener('click', function () { goIsle(b.dataset.goisle); }); });
  }

  /* place a stored copy on isle (default: the visited one) or move a placed one on its own island;
     vr: the colourway a copy carried from another island ('Take to another island') */
  function startPlacement(id, uid, fromBuy, isle, vr) {
    var w = W(), it = C.item(id);
    if (!it || !C.isPlaceable(it)) return;
    var f = uid ? findPlaced(w, uid) : null, k = f ? f.isle : (isle || isleNow());
    if ((uid && !f) || k !== isleNow()) return;             /* only ever on the island on screen */
    var spot = f ? { x: f.p.x, y: f.p.y } : C.findSpot(w, id, undefined, undefined, k);
    var start = spot || { x: C.ISLES[k].centre[0], y: C.ISLES[k].centre[1] };
    placing = { id: id, uid: uid || null, x: start.x, y: start.y, ox: start.x, oy: start.y, fromBuy: !!fromBuy, isle: k };
    var keep = f ? f.p.vr : vr;
    if (typeof keep === 'number') placing.vr = keep;           /* a moved or taken copy keeps its colour (D115) */
    mode = 'place';
    document.addEventListener('keydown', placeKeys);
    draw();
    if (!spot) { var m = $('#slwPlaceMsg', root); if (m) m.textContent = k === 'home' ? 'Your island is full. Put something away first, or keep it for later.' : tx('isle.full', { island: isleName(k) }); }
  }
  function placeAtCell(nx, ny) {
    if (!placing) return;
    if (nx === placing.x && ny === placing.y && C.canPlace(W(), placing.id, nx, ny, placing.uid, placing.isle).ok) return confirmPlacement();
    placing.x = nx; placing.y = ny; drawPlacement(); drawBar();
  }
  function drawPlacement() {
    if (use3D && stage3d) { s3('sync', islandView()); return; }
    var host = $('#slwPlace', root); if (!host || !placing) return;
    var w = W(), it = C.item(placing.id), land = C.landSetOf(w, placing.isle), sh = off2d(placing.isle);
    var o = C.occupancy(w, placing.uid, placing.isle);
    var chk = C.canPlace(w, placing.id, placing.x, placing.y, placing.uid, placing.isle);
    var foot = {}; C.fpCells(it, placing.x, placing.y).forEach(function (c) { foot[c] = 1; });
    var html = '';
    /* island-local squares, drawn at the island's place in the frame: the bridge landing takes paths only, a doorway stays clear */
    Object.keys(land).forEach(function (ck) {
      var q = ck.split(','), x = +q[0], y = +q[1], r = o.reserved[ck];
      var cls = 'slw-cell' + (foot[ck] ? (chk.ok ? ' ok' : ' bad') : r === 'dock' ? ' dock' : r ? ' door' : '');
      html += '<button type="button" class="' + cls + '" data-cx="' + x + '" data-cy="' + y + '" aria-label="Square ' + (x + 1) + ', ' + (y + 1) + (r === 'dock' ? ' — bridge landing, paths only' : '') + '" style="left:' + pct((x + sh.ox) * 100 + 3, STAGE_W) + ';top:' + pct(PAD + (y + sh.oy) * CH + 3, STAGE_H) + ';width:' + pct(94, STAGE_W) + ';height:' + pct(CH - 6, STAGE_H) + ';"></button>';
    });
    /* the ghost wears the trim of the copy it becomes ('p' + nextUid is the uid C.place gives) */
    var sp = ART.sprite(placing.id, bldState(artState(w), { id: placing.id, uid: placing.uid != null ? placing.uid : 'p' + w.nextUid, vr: placing.vr }));
    if (sp) {
      var fw = it.fp[0], fh = it.fp[1], hUnits = sp.h * (fw * 100 / sp.w);
      html += '<div class="slw-ghost' + (chk.ok ? '' : ' bad') + '" style="left:' + pct((placing.x + sh.ox) * 100, STAGE_W) + ';top:' + pct(PAD + (placing.y + sh.oy + fh) * CH - hUnits, STAGE_H) + ';width:' + pct(fw * 100, STAGE_W) + ';height:' + pct(hUnits, STAGE_H) + ';">' + sp.svg + '</div>';
    }
    host.innerHTML = html;
    host.querySelectorAll('[data-cx]').forEach(function (b) {
      b.addEventListener('click', function () { placeAtCell(+b.dataset.cx, +b.dataset.cy); });
    });
  }
  function islandOnScreen() {
    var wv = document.getElementById('worldView');
    return !!(wv && !wv.classList.contains('hidden') && !document.querySelector('.slw-ov,.slw-cele,.slg'));
  }
  function placeKeys(e) {
    if (mode !== 'place' || !placing) return;
    if (!islandOnScreen()) return;   /* never steal keys from maths, games or dialogs */
    var tg = e.target && e.target.tagName;
    if ((e.key === 'Enter' || e.key === ' ') && (tg === 'BUTTON' || tg === 'INPUT' || tg === 'A')) return;
    var k = e.key, moved = true, size = C.ISLES[placing.isle].size;   /* the island's own grid */
    if (k === 'ArrowLeft') placing.x = Math.max(0, placing.x - 1);
    else if (k === 'ArrowRight') placing.x = Math.min(size[0] - 1, placing.x + 1);
    else if (k === 'ArrowUp') placing.y = Math.max(0, placing.y - 1);
    else if (k === 'ArrowDown') placing.y = Math.min(size[1] - 1, placing.y + 1);
    else if (k === 'Enter') { e.preventDefault(); confirmPlacement(); return; }
    else if (k === 'Escape') { e.preventDefault(); cancelPlacement(); return; }
    else moved = false;
    if (moved) { e.preventDefault(); drawPlacement(); drawBar(); }
  }
  function endPlacement(nextMode) {
    placing = null;
    document.removeEventListener('keydown', placeKeys);
    mode = nextMode || 'play';
    draw();
  }
  function confirmPlacement() {
    if (!placing) return;
    var pl = placing;
    if (!C.canPlace(W(), pl.id, pl.x, pl.y, pl.uid, pl.isle).ok) return;
    commit(function (u) {
      var r = C.place(u, pl.id, pl.x, pl.y, pl.uid || undefined, undefined, pl.isle);
      if (r.ok && !pl.uid && typeof pl.vr === 'number') C.setVariant(u, r.uid, pl.vr);   /* taken across in its colour */
      return r;
    }).then(function (res) {
      if (!res || !res.ok) { toast('⚠️ ' + ((res && res.reason) || 'Couldn’t save that — try again.')); return; }
      sfx('correct');
      lastUndo = pl.uid ? { type: 'move', uid: pl.uid, id: pl.id, x: pl.ox, y: pl.oy, isle: pl.isle } : { type: 'place', uid: res.uid, isle: pl.isle };
      if (!pl.uid) { window._slwNew = window._slwNew || {}; window._slwNew[res.uid] = 1; }
      anim3d.dropUid = pl.uid || res.uid;              /* the 3D drop-in plays on the next sync */
      endPlacement(pl.fromBuy ? 'play' : 'edit');
      toast(tx(pl.uid ? 'edit.moved' : 'edit.placed'), { label: '↩ Undo', fn: undo });
    });
  }
  function cancelPlacement() {
    if (!placing) return;
    var wasBuy = placing.fromBuy, wasNew = !placing.uid;
    endPlacement(wasBuy ? 'play' : 'edit');
    if (wasNew) toast(tx('edit.stored'));
  }
  function storeSelected() {
    var uid = selectedUid; if (!uid) return;
    var f = findPlaced(W(), uid); if (!f) return;
    var p = f.p;
    commit(function (u) { return C.store(u, uid); }).then(function (res) {
      if (!res || !res.ok) { toast('⚠️ ' + ((res && res.reason) || 'Couldn’t put that away.')); return; }
      lastUndo = { type: 'store', id: p.id, x: p.x, y: p.y, isle: f.isle, vr: p.vr };
      s3('storeFx', uid);
      selectedUid = null; draw();
      toast(tx('edit.stored'), { label: '↩ Undo', fn: undo });
    });
  }
  function undo() {
    var un = lastUndo; lastUndo = null; if (!un) return;
    var k = un.isle || 'home';
    /* an undo for another island flies there first, so the child sees it come back */
    (k === isleNow() ? Promise.resolve(true) : goIsle(k, { force: true })).then(function () {
      return commit(function (u) {
        if (un.type === 'move') return C.place(u, un.id, un.x, un.y, un.uid, undefined, k);
        if (un.type === 'place') return C.store(u, un.uid);
        if (un.type === 'store') {
          var r = C.place(u, un.id, un.x, un.y, undefined, undefined, k);
          if (r.ok && typeof un.vr === 'number') C.setVariant(u, r.uid, un.vr);   /* it comes back in its colour */
          return r;
        }
        return { ok: false };
      });
    }).then(function () { draw(); });
  }

  /* ---------------- overlays ---------------- */
  function overlay(inner, opts) {
    opts = opts || {};
    var ov = document.createElement('div');
    ov.className = 'slw-ov' + (opts.cls ? ' ' + opts.cls : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('data-sl-modal', '1');   /* the app's own pop-ups (Daily 30 etc.) wait for this */
    ov.innerHTML = '<div class="slw-sheet' + (opts.small ? ' small' : '') + '"><button class="slw-x" type="button" aria-label="Close">✕</button>' + inner + '</div>';
    var opener = document.activeElement;
    var h2 = ov.querySelector('h2'); if (h2) { h2.id = h2.id || ('slwH' + (++ovSeq)); ov.setAttribute('aria-labelledby', h2.id); }
    document.body.appendChild(ov);
    cover(+1);
    var closed = false;
    function close() {
      if (!closed) { closed = true; cover(-1); }
      ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose();
      try { if (opener && document.body.contains(opener) && opener.focus) opener.focus(); } catch (e) {}
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      var all = document.querySelectorAll('.slw-ov');
      if (all[all.length - 1] === ov && !document.querySelector('.slw-cele')) close();   /* one Esc = one dialog */
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    $('.slw-x', ov).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var focusable = ov.querySelector('button:not(.slw-x), input');
    setTimeout(function () { try { (focusable || $('.slw-x', ov)).focus(); } catch (e) {} }, 30);
    ov._close = close;
    return ov;
  }
  var ovSeq = 0;
  function closeAllOverlays() { document.querySelectorAll('.slw-ov,.slw-cele').forEach(function (o) { if (o._close) o._close(); else o.remove(); }); coverCount = 0; s3('setCovered', false); }
  function toast(msg, action) {
    var old = document.querySelector('.slw-toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'slw-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    document.body.appendChild(t);
    if (action) $('button', t).addEventListener('click', function () { t.remove(); action.fn(); });
    setTimeout(function () { if (t.parentNode) t.remove(); }, action ? 6000 : 3200);
  }

  /* ---------------- shop ---------------- */
  function shopCats() {
    return [['all', '⭐ All'], ['afford', 'I can buy'], ['garden', 'Garden'], ['paths', 'Paths'], ['fun', 'Fun'],
      ['city', lbl('city', tx('shop.tab.city', null, 'City'))], ['home', lbl('home', 'Home')], ['pets', lbl('crew', tx('label.crew', null, 'Crew'))],
      ['land', 'Land'], ['sky', lbl('isles', tx('shop.tab.sky'))], ['games', lbl('games', 'Games')]];
  }
  var shopCat = 'all';
  function catOf(it) {
    if (it.cat === 'lights' || it.cat === 'flags') return 'garden';
    return it.cat || 'garden';
  }
  function cardHtml(u, it) {
    var w = C.ensureWorld(u), s = iState(u, it.id), rep = C.isRepeatable(it);
    var chip = s.state === 'owned' ? '<span class="chip own">✓ Owned</span>'
      : s.state === 'locked' ? '<span class="chip lock">🔒 Needs ' + esc(C.item(s.needs[0]).name) + '</span>'
      : s.state === 'capped' ? '<span class="chip own">✓ Plenty for testing (' + s.copies + ')</span>'
      : rep ? '<span class="chip rep">' + (trial() ? 'Get as many as you like' : 'Buy as many as you like') + (s.copies ? ' · you have ' + s.copies : '') + '</span>'
      : '<span class="chip uni">' + (trial() ? 'Free while we test' : 'Buy once, keep forever') + '</span>';
    var buyLabel = s.state === 'owned' ? (it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant' ? 'Use it' : 'Owned ✓')
      : s.state === 'locked' ? '🔒 Locked' : s.state === 'short' ? 'Need ' + fmt(s.need) + ' more ⭐' : s.state === 'capped' ? 'Plenty ✓' : s.free ? 'Get it free' : 'Buy';
    var disabled = s.state === 'locked' || s.state === 'short' || s.state === 'capped' || (s.state === 'owned' && !(it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant'));
    var isGoal = C.goalId(w) === it.id;
    var goalBtn = (s.state === 'owned' || trial()) ? '' : '<button type="button" class="slw-goalbtn' + (isGoal ? ' on' : '') + '" data-goal="' + it.id + '" aria-pressed="' + isGoal + '" title="' + (isGoal ? 'This is your goal' : 'Make this my savings goal') + '">🎯</button>';
    var shine = (window.SLIslandLook && SLIslandLook.shineLevel) ? ' shine-' + SLIslandLook.shineLevel(it.price) : '';
    /* an owned sky land is a way there; a locked land's things are a preview: a look, never a Buy (D99) */
    var act = s.state === 'owned' && isleOfLand(it) && canTravel() ? '<button type="button" class="slw-buy" data-goisle="' + it.isle + '">' + esc(tx('isle.goThere')) + '</button>'
      : s.state === 'locked' && it.isle ? '<button type="button" class="slw-btn" data-open="' + it.id + '">' + esc(tx('shop.seeIt')) + '</button>'
      : '<button type="button" class="slw-buy" data-buy="' + it.id + '"' + (disabled ? ' disabled' : '') + '>' + buyLabel + '</button>';
    return '<div class="slw-card' + shine + '"><button type="button" class="ic" data-open="' + it.id + '" aria-label="See ' + esc(it.name) + '">' + iconHtml(it.id, artState(w)) + '</button>' +
      '<div class="nm">' + esc(it.name) + '</div><div class="ds">' + esc(dsc(it)) + '</div>' + chip +
      (trial() ? '<div class="pr"><s style="color:#9a94b5;font-weight:700;">⭐ ' + fmt(it.price) + '</s> <span class="slw-free">FREE</span></div>'
        : '<div class="pr">⭐ ' + fmt(it.price) + (rep ? ' <span style="font-size:11px;color:#8a84a3;">each</span>' : '') + '</div>') +
      '<div class="row">' + act + goalBtn + '</div></div>';
  }
  /* the sky island a land opens, or null (Meadow Hill and Beach Cove are Home's own land) */
  function isleOfLand(it) { return it && it.kind === 'land' && it.isle && C.ISLES[it.isle] ? it.isle : null; }
  /* the uid of the landmark standing on an island, or null */
  function landmarkUid(w, k) {
    var lm = C.ISLES[k] && C.ISLES[k].landmark, list = lm ? C.placedOn(w, k) : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === lm) return list[i].uid;
    return null;
  }
  /* a landmark comes free with its land: never bought, never a goal, no price line; 'See it' opens its sheet */
  function landmarkCardHtml(u, s) {
    var it = C.item(s.landmarkId); if (!it) return '';
    return '<div class="slw-card lm"><button type="button" class="ic" data-open="' + it.id + '" aria-label="See ' + esc(it.name) + '">' + iconHtml(it.id, artState(C.ensureWorld(u))) + '</button>' +
      '<div class="nm">' + esc(it.name) + '</div><div class="ds">' + esc(dsc(it)) + '</div>' +
      (s.owned ? '<span class="chip own">✓ ' + esc(tx('shop.onIsland')) + '</span>' : '<span class="chip uni">' + esc(tx('shop.comesWithLand', { land: s.name })) + '</span>') +
      '<div class="row"><button type="button" class="slw-btn" data-open="' + it.id + '">' + esc(tx('shop.seeIt')) + '</button></div></div>';
  }
  /* the Sky islands tab (D99; SLIslandShop.sections): the island chips ('All five', then each land) in a row that
     sticks under the tab row on phones, then one island's own shop: its heading, a status row (with 'Go there' /
     'Fly over for a look' unless you are there), its lead cards (the land while locked, then the landmark), the
     shelf jump chips, the shelves. Under 'All five' each land is a folded header and one opens at a time */
  function skyTabHtml(u) {
    var SH = window.SLIslandShop, w = C.ensureWorld(u);
    if (!SH) return '';
    var one = shopIsle !== 'home' && C.ISLES[shopIsle] ? shopIsle : null;
    var html = '<div class="slw-islefilter sticky" role="group" aria-label="' + esc(tx('isle.nav')) + '">' +
      '<button type="button" class="slw-btn' + (one ? '' : ' on') + '" data-sisle="all" data-fk="sisle:all" aria-pressed="' + !one + '">' + esc(tx('shop.isles.all')) + '</button>';
    C.ISLE_ORDER.forEach(function (k) {
      if (k === 'home') return;
      var own = C.isleUnlocked(w, k);
      html += '<button type="button" class="slw-btn' + (one === k ? ' on' : '') + '" data-sisle="' + k + '" data-fk="sisle:' + k + '" aria-pressed="' + (one === k) + '" aria-label="' + esc(isleName(k) + (own ? ', ' + tx('shop.unlocked').toLowerCase() : '')) + '">' +
        (typeof ART.isleIcon === 'function' ? ART.isleIcon(k, { locked: !own }) + ' ' : '') + esc(tx('isle.short.' + k, null, isleName(k))) + (own ? ' ✓' : '') + '</button>';
    });
    html += '</div>';
    SH.sections(C, u, { trial: trial(), isle: one }).forEach(function (s) { html += isleSectionHtml(u, s, !!one); });
    return html;
  }
  /* a land's status (Unlocked ✓ / ⭐ price / FREE), what its shop has, and the way there unless you are there */
  function isleStatusHtml(s, here) {
    var k = s.isle;
    return (s.status === 'open' ? '<span class="chip own">✓ ' + esc(tx('shop.unlocked')) + '</span>' : '<span class="chip lock">' + (s.status === 'free' ? 'FREE' : '⭐ ' + fmt(s.price)) + '</span>') +
      '<span class="ct">' + esc(tx('shop.isleCount', { n: s.counts.things })) + '</span>' +
      (here || !canTravel() ? '' : '<button type="button" class="slw-btn" data-goisle="' + k + '" data-fk="go:' + k + '">' + esc(tx(s.owned ? 'isle.goThere' : 'isle.visit')) + '</button>');
  }
  function isleSectionHtml(u, s, single) {
    var k = s.isle, here = isleNow() === k && !skyMapOn, open = single || shopAcc === k;
    var icon = typeof ART.isleIcon === 'function' ? ART.isleIcon(k, { locked: !s.owned }) : '';
    var html = '<section class="slw-shopisle' + (single ? '' : ' fold') + '" data-isle="' + k + '" aria-labelledby="slwSI-' + k + '">';
    if (single) {
      html += '<h3 id="slwSI-' + k + '">' + icon + esc(tx('shop.isleShop', { island: s.name })) + '</h3>';
      if (!s.owned) html += '<p class="slw-isleline">' + esc(tx('shop.isleLocked', { land: s.name })) + '</p>';
      else if (here) html += '<p class="slw-isleline">' + esc(tx('shop.isleHere', { island: s.name })) + '</p>';
      /* the status chip is styled inside an .slw-isleacc row (a plain row here: no toggle) */
      html += '<div class="slw-isleacc">' + isleStatusHtml(s, here) + '</div>';
    } else {
      /* 'All five' (D99): a folded header per land (a heading holding its toggle, then the status, the count and the
         way there); only the open one shows its shop, so the longest list is one island's shelves */
      html += '<div class="slw-isleacc' + (open ? ' open' : '') + '"><h3 class="slw-acch"><button type="button" class="tg" id="slwSI-' + k + '" data-isleacc="' + k + '" data-fk="acc:' + k + '" aria-expanded="' + open + '"' +
        (open ? ' aria-controls="slwSB-' + k + '"' : '') + '><span class="ic">' + icon + '</span><span class="nm">' + esc(s.name) + '</span></button></h3>' + isleStatusHtml(s, here) + '</div>';
      if (!open) return html + '</section>';
      html += '<div class="slw-isleopen" id="slwSB-' + k + '">' + (s.owned ? '' : '<p class="slw-isleline">' + esc(tx('shop.isleLocked', { land: s.name })) + '</p>');
    }
    html += '<div class="slw-grid">' + s.lead.map(function (id) { return id === s.landmarkId ? landmarkCardHtml(u, s) : cardHtml(u, C.item(id)); }).join('') + '</div>';
    if (s.shelves.length > 1) html += '<div class="slw-shelfjump"><span class="lb">' + esc(tx('shop.jump')) + '</span>' +
      s.shelves.map(function (sh) { return '<button type="button" class="slw-btn" data-jump="slwSh-' + k + '-' + sh.key + '">' + esc(tx(sh.labelKey)) + '</button>'; }).join('') + '</div>';
    s.shelves.forEach(function (sh) {
      html += '<h4 class="slw-shelfhd" id="slwSh-' + k + '-' + sh.key + '" tabindex="-1">' + esc(tx(sh.labelKey)) + ' <span class="n">' + sh.ids.length + '</span></h4>' +
        '<div class="slw-grid">' + sh.ids.map(function (id) { return cardHtml(u, C.item(id)); }).join('') + '</div>';
    });
    return html + (single ? '' : '</div>') + '</section>';
  }
  /* ⭐ All (D99): the V4.54 things and the five lands (never a land's own things), and for each owned land
     one doorway card into its shop */
  function allTabHtml(u) {
    var SH = window.SLIslandShop, w = C.ensureWorld(u), cards = '';
    if (!SH) return null;
    var tab = SH.allTab(C, u, TO());
    tab.isleCards.forEach(function (c) {
      var name = isleName(c.isle), land = C.ISLES[c.isle].unlock;
      cards += '<div class="slw-card isle" data-isle="' + c.isle + '"><button type="button" class="ic" data-isleshop="' + c.isle + '" aria-label="' + esc(tx('shop.isleOpen', { island: name })) + '">' + iconHtml(land, artState(w)) + '</button>' +
        '<div class="nm">' + esc(tx('shop.isleOpen', { island: name })) + '</div><div class="ds">' + esc(tx('shop.isleCount', { n: c.things })) + '</div>' +
        '<div class="row"><button type="button" class="slw-btn" data-isleshop="' + c.isle + '">' + lbl('shop', tx('isle.openShop')) + '</button></div></div>';
    });
    return cards + tab.ids.map(function (id) { return cardHtml(u, C.item(id)); }).join('');
  }
  /* a list's sub-heading with an island's pixel icon and a count (the 'I can buy' groups) */
  function isleHeadHtml(k, n) {
    return '<h4 class="slw-shelfhd" data-isle="' + k + '"><span class="ic">' + (typeof ART.isleIcon === 'function' ? ART.isleIcon(k, {}) : '') + '</span>' + esc(isleName(k)) + ' <span class="n">' + n + '</span></h4>';
  }
  /* 'I can buy' (D99; SLIslandShop.afford): what can be had now, cheapest first. Home's things first (as V4.54, no
     heading), then each land's under its own heading; on a sky island that island's group leads, and Home's then
     has a heading too. null = nothing to buy yet (the V4.54 'Next up' line) */
  function affordHtml(u) {
    var SH = window.SLIslandShop;
    if (!SH) return null;
    var groups = SH.afford(C, u, { trial: trial(), isle: isleNow() });
    if (!groups.length) return null;
    return groups.map(function (g, i) {
      return (g.isle || i > 0 ? isleHeadHtml(g.isle || 'home', g.ids.length) : '') +
        '<div class="slw-grid">' + g.ids.map(function (id) { return cardHtml(u, C.item(id)); }).join('') + '</div>';
    }).join('');
  }
  /* the Crew tab (D99, D114; SLIslandShop.crewAisle): Crew, Gear, then a folded group per land with its two mascots and
     four pieces of gear (the same six cards as that land's 'Mascots & gear' shelf). The header is the button: the
     land's name (the short one on phones), its status and how many are still to get; one group opens at a time,
     and each shop opens with the island you are on open */
  function crewTabHtml(u) {
    var SH = window.SLIslandShop, w = C.ensureWorld(u), top = '', lands = '';
    if (!SH) return null;
    var grid = function (ids, id) { return '<div class="slw-grid"' + (id ? ' id="' + id + '"' : '') + '>' + ids.map(function (x) { return cardHtml(u, C.item(x)); }).join('') + '</div>'; };
    SH.crewAisle(C, u, { isle: crewAcc, trial: trial() }).forEach(function (g) {
      if (g.key === 'pets' || g.key === 'gear') { top += '<h4 class="slw-shelfhd">' + esc(tx(g.labelKey)) + ' <span class="n">' + g.ids.length + '</span></h4>' + grid(g.ids); return; }
      var k = g.key, open = !g.collapsed, left = g.ids.filter(function (id) { return !C.owns(w, id); }).length;
      lands += '<div class="slw-crewland" data-isle="' + k + '"><h4 class="slw-acch"><button type="button" class="slw-crewacc' + (open ? ' open' : '') + '" data-crewacc="' + k + '" data-fk="crew:' + k + '" aria-expanded="' + open + '"' +
        (open ? ' aria-controls="slwCL-' + k + '"' : '') + '><span class="ic">' + (typeof ART.isleIcon === 'function' ? ART.isleIcon(k, { locked: !g.owned }) : '') + '</span>' +
        '<span class="nm"><span class="fl">' + esc(tx(g.labelKey, { island: g.name })) + '</span><span class="sh">' + esc(tx(g.labelKey, { island: tx('isle.short.' + k, null, g.name) })) + '</span></span>' +
        (g.owned ? '<span class="chip own">✓ ' + esc(tx('shop.unlocked')) + '</span>' : '<span class="chip lock">' + (g.status === 'free' ? 'FREE' : '⭐ ' + fmt(g.price)) + '</span>') +
        (left ? '<span class="ct">' + esc(tx('shop.isleCount', { n: left })) + '</span>' : '') + '</button></h4>' + (open ? grid(g.ids, 'slwCL-' + k) : '') + '</div>';
    });
    return top + '<div class="slw-crewlands">' + lands + '</div>';
  }
  /* a shelf jump chip: the sheet scrolls to that shelf (under the sticky rows on phones) and the
     heading takes focus, so the keyboard and a screen reader land there too */
  function jumpTo(ov, id) {
    var h = ov.querySelector('#' + id), sheet = ov.querySelector('.slw-sheet');
    if (!h || !sheet) return;
    var cs = window.getComputedStyle ? getComputedStyle(h) : null, m = (cs && parseFloat(cs.scrollMarginTop)) || 8;
    var top = sheet.scrollTop + h.getBoundingClientRect().top - sheet.getBoundingClientRect().top - m;
    try { sheet.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { sheet.scrollTop = top; }
    try { h.focus({ preventScroll: true }); } catch (e) {}
  }
  function openShop(cat, o) {
    if (cat) shopCat = cat;
    /* opened on a sky island, or from a land's reveal: the Sky islands tab shows that island's section only (D99) */
    if (o && o.isle && o.isle !== 'home' && C.ISLES[o.isle]) { shopCat = 'sky'; shopIsle = o.isle; }
    crewAcc = isleNow() !== 'home' ? isleNow() : null;    /* the Crew tab opens on the island you are on (D114) */
    var u = me();
    islandMusic('shop');
    var ov = overlay('<h2>' + lbl('shop', 'Island Shop') + '</h2><div style="font-weight:800;color:#6b5a22;">You have ⭐ <span id="slwShopPts">' + fmt(u.points) + '</span> ' + (trial() ? 'saved for the prize Shop (not used here)' : 'to spend. Learning earns more, and it’s the same balance as the prize Shop.') + '</div>' + (trial() ? '<div class="slw-trialbar">Test mode: everything in this shop is <b>free</b>. Your points aren’t used, so try anything.</div>' : '') + '<div class="slw-cats" id="slwCats"></div><div class="slw-err" id="slwShopErr" role="alert"></div><div id="slwShopBody"></div>', { onClose: function () { islandMusic(showtimeOn ? 'island_showtime' : 'island_day'); } });
    var cats = $('#slwCats', ov), body = $('#slwShopBody', ov), sheet = $('.slw-sheet', ov);
    /* a new tab or island starts at its top: under the tab row where that row sticks (phones), else with the row */
    function toTop() {
      var band = window.getComputedStyle && getComputedStyle(cats).position === 'sticky' ? cats.offsetHeight : 0;
      var top = (band ? body : cats).getBoundingClientRect().top - sheet.getBoundingClientRect().top - band;
      if (top < 0) sheet.scrollTop += top - 8;
    }
    /* how far below the sheet's content edge the rows that stick on phones reach once stuck (0 where nothing sticks) */
    function bands() {
      var b = 0;
      if (!window.getComputedStyle) return 0;
      [cats, $('.slw-islefilter', body)].forEach(function (el) {
        var cs = el && getComputedStyle(el);
        if (cs && cs.position === 'sticky') b = Math.max(b, (parseFloat(cs.top) || 0) + (el.offsetHeight || 0));
      });
      return b;
    }
    /* a fold opened or shut (D99, D114): an opened header rises to just under the sticky rows with its cards below
       it; a shut one stays where it was under the finger, even when the open fold above it closed */
    function refold(fk, opened) {
      var row = function () { var b = ov.querySelector('[data-fk="' + fk + '"]'); return b && /\btg\b/.test(b.className) ? b.parentNode.parentNode : b; };
      var r0 = row(), y0 = r0 ? r0.getBoundingClientRect().top : 0;
      paint();
      var r1 = row();
      if (!r1) return;
      var pad = window.getComputedStyle ? parseFloat(getComputedStyle(sheet).paddingTop) || 0 : 0;
      var to = opened ? sheet.getBoundingClientRect().top + (sheet.clientTop || 0) + pad + bands() + 8 : y0;
      sheet.scrollTop = (sheet.scrollTop || 0) + r1.getBoundingClientRect().top - to;
    }
    function paint() {
      var u2 = me(), fk = focusKey(ov), sl = cats.scrollLeft, fl0 = $('.slw-islefilter', body), fsl = fl0 ? fl0.scrollLeft : 0;
      $('#slwShopPts', ov).textContent = fmt(u2.points);
      cats.innerHTML = shopCats().map(function (c) { return '<button type="button" class="slw-btn' + (shopCat === c[0] ? ' on' : '') + '" data-cat="' + c[0] + '" data-fk="cat:' + c[0] + '" aria-pressed="' + (shopCat === c[0]) + '">' + c[1] + '</button>'; }).join('');
      var all = shopCat === 'all' ? allTabHtml(u2) : null;
      /* 'I can buy' and the Crew tab come grouped from the shop view-model (null: nothing to buy yet, or no view-model) */
      var grouped = shopCat === 'afford' ? affordHtml(u2) : shopCat === 'pets' ? crewTabHtml(u2) : null;
      var items = shopCat === 'sky' || all !== null || grouped !== null ? [] : C.shopItems().filter(function (it) {
        if (shopCat === 'afford') return iState(u2, it.id).state === 'affordable';
        /* ⭐ All without the shop view-model: a land's own things wait in the Sky islands tab */
        return shopCat === 'all' ? !(it.isle && it.kind !== 'land') : catOf(it) === shopCat;
      });
      /* affordable & useful first, owned uniques last */
      items.sort(function (a, b) {
        var sa = iState(u2, a.id).state, sb = iState(u2, b.id).state;
        var rank = { affordable: 0, short: 1, locked: 2, capped: 3, owned: 3 };
        return ((rank[sa] == null ? 9 : rank[sa]) - (rank[sb] == null ? 9 : rank[sb])) || (a.price - b.price);
      });
      var next = null;
      if (!items.length && shopCat === 'afford') {
        C.shopItems().forEach(function (it) { if (iState(u2, it.id).state === 'short' && (!next || it.price < next.price)) next = it; });
      }
      body.innerHTML = shopCat === 'sky' ? skyTabHtml(u2) : grouped !== null ? grouped : '<div class="slw-grid" id="slwShopGrid">' + (all || (items.length ? items.map(function (it) { return cardHtml(u2, it); }).join('')
        : trial() ? '<p style="grid-column:1/-1;font-weight:800;text-align:center;color:#1d8a4c;padding:18px;">You’ve got everything there is. Thanks for testing.</p>'
        : '<p style="grid-column:1/-1;font-weight:800;text-align:center;color:#6b6390;padding:18px;">Nothing to buy just yet — every bit of learning earns ⭐!' +
          (next ? '<br>Next up: <b>' + esc(next.name) + '</b> — just ' + fmt(next.price - (u2.points || 0)) + ' more ⭐.' : '') + '</p>')) + '</div>';
      fillPhotocards(ov);
      /* phones: the tab row and the island chips are sideways strips; the pressed ones come into view */
      cats.scrollLeft = sl; showChip(cats, $('.on', cats));
      var fl = $('.slw-islefilter', body);
      if (fl) { fl.scrollLeft = fsl; showChip(fl, $('[aria-pressed="true"]', fl)); }
      ov.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { shopCat = b.dataset.cat; paint(); toTop(); }); });
      body.querySelectorAll('[data-sisle]').forEach(function (b) { b.addEventListener('click', function () { shopIsle = b.dataset.sisle; paint(); toTop(); }); });
      body.querySelectorAll('[data-isleshop]').forEach(function (b) { b.addEventListener('click', function () { shopCat = 'sky'; shopIsle = b.dataset.isleshop; paint(); toTop(); }); });
      body.querySelectorAll('[data-jump]').forEach(function (b) { b.addEventListener('click', function () { jumpTo(ov, b.dataset.jump); }); });
      /* one fold open at a time: tapping the open one shuts it, tapping another moves the opening there */
      body.querySelectorAll('[data-isleacc]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.isleacc; shopAcc = shopAcc === k ? null : k; refold('acc:' + k, shopAcc === k); }); });
      body.querySelectorAll('[data-crewacc]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.crewacc; crewAcc = crewAcc === k ? null : k; refold('crew:' + k, crewAcc === k); }); });
      body.querySelectorAll('[data-goisle]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.goisle; ov._close(); goIsle(k); }); });
      if (fk) refocus(ov, fk);
      body.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openItem(b.dataset.open); }); });
      ov.querySelectorAll('[data-goal]').forEach(function (b) { b.addEventListener('click', function () { toggleGoal(b.dataset.goal).then(paint); }); });
      ov.querySelectorAll('[data-buy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var it = C.item(b.dataset.buy);
          if (iState(me(), it.id).state === 'owned') { useOwned(it); ov._close(); return; }
          buyFlow(it, b, $('#slwShopErr', ov), function (ok) { if (ok) { ov._close(); } else paint(); });
        });
      });
    }
    paint();
  }
  function toggleGoal(id) {
    var w = W();
    var target = C.goalId(w) === id ? null : id;      /* goal or goal3: the core routes a v3 id to goal3 */
    var it = target && C.item(target);
    return commit(function (u) {
      var r = C.setGoal(u, target);
      if (r.ok) { var fw = C.ensureWorld(u); fw.goalPrice = it ? it.price : null; fw.goalName = it ? it.name : null; }
      return r;
    }).then(function (res) {
      if (res && res.ok) { toast(target ? '🎯 New goal: ' + it.name : 'Goal cleared.'); draw(); return; }
      if (res && res.code === 'locked' && res.needs && C.goalId(W()) !== res.needs) {
        var pre = C.item(res.needs);
        return toggleGoal(res.needs).then(function () { toast(tx('goal.firstNeed', { land: pre.name })); });
      }
      if (res && res.reason) toast(res.reason);
    });
  }
  function useOwned(it) {
    if (it.kind === 'style') { commit(function (u) { return C.select(u, it.id); }).then(function () { draw(); openHome(); }); return; }
    if (it.kind === 'cosmetic' || it.kind === 'variant') { commit(function (u) { return C.select(u, it.id); }).then(function () { draw(); toast(tx('buy.cosmetic')); }); return; }
  }

  /* item detail sheet (preview, unlocks, buy, goal) */
  function unlockText(it) {
    var parts = [], ik = isleOfLand(it), UI = window.SLIslesUI;
    if (it.kind === 'attraction') parts.push(trial() ? '🎮 Unlocks a new game — tap it on your island to play.' : '🎮 Unlocks a new game for keeps — tap it on your island to play.');
    /* a sky land: the island, what comes with it, then what its shop sells (three examples) */
    if (ik) parts.push('🏝️ ' + esc(tx('unlock.isle', { n: C.ISLES[ik].cellCount })));
    (it.includes || []).forEach(function (inc) { var ii = C.item(inc); if (ii) parts.push('🎁 Comes with: ' + ii.name); });
    if (ik && UI) {
      var ids = UI.skySections(C, me(), { isle: ik })[0].itemIds;
      parts.push('🛍️ ' + esc(tx('unlock.isleItems', { n: ids.length, items: ids.slice(0, 3).map(function (id) { return C.item(id).name; }).join(', ') })));
    } else if (it.kind === 'land' && !ik) parts.push('🏝️ Opens ' + (C.REGION_CELLS[it.region] || []).length + ' new squares of island.');
    if (it.kind === 'landmark' && C.ISLES[it.isle]) parts.push(esc(tx('unlock.landmark', { land: isleName(it.isle) })));
    /* where a sky island's thing may stand (D18); a land's mascot and gear have their own lines */
    else if (C.isV3(it) && C.isPlaceable(it)) parts.push(esc(tx(C.scopeOf(it.id) === 'own' ? 'unlock.ownOnly' : 'unlock.anyIsle', { island: isleName(it.isle) })));
    if (it.kind === 'pet') parts.push(it.isle && C.ISLES[it.isle] ? esc(tx('unlock.mascot', { island: isleName(it.isle) })) : 'A new crew member who roams your island and can run the Debut Run.');
    if (it.kind === 'acc') parts.push(it.isle ? esc(tx('unlock.gear')) : 'Anyone in your crew can wear it, on the island and in the Debut Run.');
    if (it.kind === 'variant' && it.game === 'course') parts.push('A new Debut Run course, with its own best score.');
    if (it.kind === 'variant' && it.game === 'kart') parts.push('🏁 A new race track, with its own best time.');
    if (it.kind === 'cosmetic') parts.push('✨ Changes how the game looks — it doesn’t make it easier or harder.');
    if (it.kind === 'style' && it.slot === 'shape') parts.push(esc(tx('unlock.shape')));
    else if (it.kind === 'style') parts.push('Changes how your home looks. Switch between styles you own any time.');
    if (C.isRepeatable(it)) parts.push('🔁 Each one you buy is one more on your island. Put them away and bring them back any time.');
    if (it.cat === 'city') parts.push(esc(tx('unlock.city')));
    else if (it.kind === 'fun') parts.push('✋ Tap it on your island to play with it.');
    (it.requires || []).forEach(function (r) { parts.push('🔒 First you need: ' + C.item(r).name + '.'); });
    return parts.join('<br>');
  }
  function openItem(id) {
    var it = C.item(id); if (!it) return;
    var u = me(), w = C.ensureWorld(u), s = iState(u, id);
    var demoGame = it.kind === 'attraction' ? it.game : (it.kind === 'variant' ? it.game : null);
    /* a landmark comes with its land: no price, no Buy, no goal; 'Go see it' once its land is yours, else
       a way to the land's own sheet. A sky land flies over for a look, or is a way there once it is yours */
    var lm = it.kind === 'landmark' && C.ISLES[it.isle] ? it.isle : null, ik = isleOfLand(it);
    var lmOwned = lm && C.isleUnlocked(w, lm), there = isleNow() === (lm || ik) && !skyMapOn;
    var trip = !canTravel() ? '' : lm ? (lmOwned ? '<button class="slw-buy" type="button" id="slwIsleGo">' + esc(tx('isle.landmarkSee')) + '</button>' : '')
      : ik && !there ? '<button class="' + (s.state === 'owned' ? 'slw-buy' : 'slw-btn') + '" type="button" id="slwIsleGo">' + esc(tx(s.state === 'owned' ? 'isle.goThere' : 'isle.visit')) + '</button>' : '';
    var ov = overlay(
      '<div class="slw-detail"><div class="big" id="slwBig">' + iconHtml(id, artState(w)) + '</div>' +
      '<div class="info"><h2>' + esc(it.name) + '</h2><div style="color:#6b6585;">' + esc(dsc(it)) + '</div>' +
      '<div class="slw-unlocks">' + unlockText(it) + '</div>' +
      (lm ? '' : trial() ? '<div class="pr" style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:22px;color:#b9821a;"><s style="color:#9a94b5;">⭐ ' + fmt(it.price) + '</s> <span class="slw-free">FREE while we test</span></div>'
        : '<div class="pr" style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:22px;color:#b9821a;">⭐ ' + fmt(it.price) + (C.isRepeatable(it) ? ' each' : '') + '</div>') +
      '<div class="slw-need">' + (lm ? '' : s.state === 'short' ? 'You have ⭐ ' + fmt(u.points) + ' — just ' + fmt(s.need) + ' more to go!' : s.state === 'owned' ? 'You own this ✓' : '') + '</div>' +
      '<div class="slw-err" id="slwItemErr" role="alert"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        (lm ? (lmOwned ? '' : '<button class="slw-btn" type="button" id="slwSeeLand">' + esc(tx('isle.seeLand', { land: isleName(lm) })) + '</button>')
          : s.state === 'owned'
          ? ((it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant') ? '<button class="slw-buy" type="button" id="slwUse">Use it</button>' : '') +
            (it.kind === 'attraction' && it.game ? '<button class="slw-buy" type="button" id="slwPlayNow">▶ Play</button>' : '')
          : '<button class="slw-buy" type="button" id="slwBuyNow"' + (s.state !== 'affordable' ? ' disabled' : '') + '>' + (s.state === 'affordable' ? (s.free ? '🎁 Get it free' : 'Buy for ⭐ ' + fmt(it.price)) : s.state === 'locked' ? '🔒 Locked' : s.state === 'capped' ? 'Plenty for testing ✓' : 'Not enough ⭐ yet') + '</button>' +
            (trial() ? '' : '<button class="slw-goalbtn' + (C.goalId(w) === id ? ' on' : '') + '" type="button" id="slwGoalNow">🎯 ' + (C.goalId(w) === id ? 'My goal ✓' : 'Make it my goal') + '</button>')) +
        trip + (demoGame ? '<button class="slw-btn" type="button" id="slwDemo">▶ Watch a preview</button>' : '') +
      '</div></div></div>');
    fillPhotocards(ov);
    var ig = $('#slwIsleGo', ov);
    if (ig) ig.addEventListener('click', function () {
      var k = lm || ik, uid = lm ? landmarkUid(W(), lm) : null;
      closeAllOverlays();
      goIsle(k).then(function (ok) { if (ok && uid && isleNow() === k) s3('frameItem', uid); });
    });
    var sl = $('#slwSeeLand', ov); if (sl) sl.addEventListener('click', function () { ov._close(); openItem(C.ISLES[lm].unlock); });
    var bn = $('#slwBuyNow', ov);
    if (bn) bn.addEventListener('click', function () { buyFlow(it, bn, $('#slwItemErr', ov), function (ok) { if (ok) ov._close(); }); });
    var gn = $('#slwGoalNow', ov); if (gn) gn.addEventListener('click', function () { toggleGoal(id).then(function () { ov._close(); }); });
    var un = $('#slwUse', ov); if (un) un.addEventListener('click', function () { useOwned(it); ov._close(); });
    var pn = $('#slwPlayNow', ov); if (pn) pn.addEventListener('click', function () { ov._close(); closeAllOverlays(); launch(it.game); });
    var dm = $('#slwDemo', ov);
    if (dm) dm.addEventListener('click', function () {
      dm.disabled = true;
      loadGame(demoGame).then(function () {
        var host = $('#slwBig', ov); if (!host) return;
        host.innerHTML = '';
        var stop = window.SLGames[demoGame].demo(host, { variant: it.kind === 'variant' ? it.id : null, world: W(), seconds: 7, endText: s.state === 'owned' ? 'It’s yours — play it on your island!' : (trial() ? 'Get it free to play!' : 'Buy it to play!') });
        var prevClose = ov._close;
        ov._close = function () { try { stop(); } catch (e) {} prevClose(); };
        setTimeout(function () { dm.disabled = false; }, 7500);
      }).catch(function () { dm.textContent = 'Preview unavailable offline'; });
    });
  }

  /* the purchase flow: confirm (expensive only) → locked commit → celebrate */
  function buyFlow(it, btn, errEl, done) {
    if (buying || confirming) return;   /* a double-tap must not stack two confirm boxes */
    var u = me();
    var chk = C.purchaseCheck(u, it.id, TO());
    if (!chk.ok) { if (errEl) errEl.textContent = chk.reason; return done && done(false); }
    var proceed = function () {
      buying = true;
      if (btn) { btn.disabled = true; btn.textContent = trial() ? 'Getting it…' : 'Buying…'; }
      if (errEl) errEl.textContent = '';
      /* a v3 one-off gets the same tx on every device ('v3_<id>_<n>'), so two forks can never charge twice;
         a kept tx is retried after a save failure (pendingTx), never a fresh one */
      var tx = pendingTx[it.id] || (pendingTx[it.id] = C.purchaseTx(W(), it.id, newTx()));
      var wasGoal = C.goalId(W()) === it.id;
      commitPurchase(it.id, tx).then(function (res) {
        buying = false;
        if (res && res.ok) {
          delete pendingTx[it.id];
          if (done) done(true);
          afterPurchase(it, res, wasGoal);
        } else {
          /* definitive refusals free the tx; save failures keep it so a retry can't double-charge */
          if (!res || ['write_failed', 'not_saved', 'read_failed'].indexOf(res.code) < 0) delete pendingTx[it.id];
          if (errEl) errEl.textContent = (res && res.reason) || 'Something went wrong — nothing was spent.';
          if (btn) { btn.disabled = false; btn.textContent = 'Try again'; }
          if (done) done(false);
        }
      }).catch(function () {
        buying = false;
        if (errEl) errEl.textContent = 'Something went wrong — please try again.';
        if (btn) { btn.disabled = false; btn.textContent = 'Try again'; }
      });
    };
    if (!chk.trial && it.price >= C.ECONOMY.confirmAt) {
      var c = overlay('<h2>Buy ' + esc(it.name) + '?</h2><div class="big" style="width:140px;margin:8px auto;position:relative;">' + iconHtml(it.id, artState(W())) + '</div>' +
        '<p style="font-weight:700;">It costs <b>⭐ ' + fmt(it.price) + '</b>. You’ll have <b>⭐ ' + fmt((u.points || 0) - it.price) + '</b> left.</p>' +
        '<p style="font-size:13px;font-weight:700;color:#6b6390;margin-top:-4px;">These are the same ⭐ you save for real prizes in the 🎁 Shop.</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;"><button class="slw-btn big" type="button" id="slwNo">Not yet</button><button class="slw-buy" type="button" id="slwYes" style="flex:0 0 auto;padding:10px 22px;">Yes, buy it!</button></div>', { small: true, onClose: function () { confirming = false; } });
      confirming = true;
      fillPhotocards(c);
      $('#slwNo', c).addEventListener('click', function () { c._close(); });
      $('#slwYes', c).addEventListener('click', function () { c._close(); proceed(); });
      return;
    }
    proceed();
  }

  function afterPurchase(it, res, isGoal) {
    var w = W();
    /* bought in another tab meanwhile: no reveal; a sky land just takes the child there */
    if (res.replay) { toast('✓ ' + it.name + ' is yours.'); draw(); if (isleOfLand(it)) goIsle(it.isle); return; }
    sample('coins', 0.8) || sfx('fanfare');
    if (isGoal && it.kind !== 'attraction' && it.kind !== 'land') {
      draw();
      celebrate({ title: '🎯 Goal reached: ' + it.name, sub: tx('goal.reached'), icon: it.id, sfx: 'fanfare' });
      if (C.isPlaceable(it)) placeBought(it, true);
      return;
    }
    if (it.kind === 'land' && it.isle && C.ISLES[it.isle]) {
      /* a sky land: the stage flies there, builds the bridge and drops the landmark (3D), then the card */
      var k = it.isle, lm = C.item(C.ISLES[k].landmark), UI = window.SLIslesUI;
      var n = UI ? UI.skySections(C, me(), { isle: k })[0].itemIds.length : 0;
      if (res.placedUid) { window._slwNew = window._slwNew || {}; window._slwNew[res.placedUid] = 1; }   /* the landmark lands with NEW! */
      /* the card's buttons: tap the new landmark (framed first, so its act is seen), or this island's shop */
      var tapLm = function () {
        var uid = res.placedUid || landmarkUid(W(), k);
        if (!uid || isleNow() !== k || skyMapOn) return;
        if (on3D()) { s3('frameItem', uid); tapItem(uid, null); return; }
        var el = root && root.querySelector('#slwStage [data-uid="' + uid + '"]');
        if (el) tapItem(uid, el);
      };
      var card = function () {
        celebrate({ title: tx(isGoal ? 'celebrate.landGoalTitle' : 'celebrate.landTitle', { land: isleName(k) }), sub: tx('isle.openSub', { landmark: lm ? lm.name : '', n: n }),
          icon: lm ? lm.id : it.id, sfx: 'fanfare', cls: 'reveal', encore: false, onClose: function () { if (isleNow() === k && !skyMapOn) arrived(k); },
          btns: [{ label: tx('isle.openTap', { landmark: lm ? lm.name : isleName(k) }), fn: tapLm }, { label: tx('isle.openShop'), fn: function () { openShop('sky', { isle: k }); } }] });
      };
      if (!on3D() && mode !== 'place') {
        /* 2D: the frame shows the new land at once, with its landmark and NEW!, then the same card */
        closeAllOverlays(); travelSeq++;
        visitIsle = k; skyMapOn = false; selectedUid = null; landTurn[k] = (landTurn[k] || 0) + 1;
        draw(); card(); revealView();
        return;
      }
      if (!on3D() || !canTravel() || typeof stage3d.unlockIsle !== 'function' || mode === 'place') { draw(); card(); return; }
      closeAllOverlays();                             /* a shop left under the land's sheet too: the child watches the reveal */
      var seq = ++travelSeq, from = isleNow(), fromMap = skyMapOn;
      visitIsle = k; skyMapOn = false; selectedUid = null; mode = 'play';
      anim3d.unlockIsle = k;                          /* the stage keeps it a preview until unlockIsle runs */
      draw(); revealView();
      race(s3('unlockIsle', k), 'unlockIsle').then(function (ok) {
        /* a reveal the stage refused leaves the host where the stage is (the land is the child's either way) */
        if (seq === travelSeq) { if (ok) s3('setAnchors', anchors3D()); else adoptStage(from, fromMap); }
        card(); revealView();
      });
      return;
    }
    if (it.kind === 'land') {
      draw();
      var landCard = function () { celebrate({ title: (isGoal ? '🎯 Goal reached! ' : '🏝️ ') + it.name + ' is open!', sub: 'New land to build on. Tap ✏️ Edit to move things there.', icon: it.id, sfx: 'fanfare' }); };
      if (use3D && stage3d && it.region) { var shown = false, once = function () { if (!shown) { shown = true; landCard(); } }; Promise.resolve(s3('unlockLand', it.region)).then(once, once); setTimeout(once, 4000); return; }
      celebrate({ title: (isGoal ? '🎯 Goal reached! ' : '🏝️ ') + it.name + ' is open!', sub: 'New land to build on. Tap ✏️ Edit to move things there.', icon: it.id, sfx: 'fanfare' });
      return;
    }
    if (it.kind === 'attraction') {
      if (res.placedUid) { window._slwNew = window._slwNew || {}; window._slwNew[res.placedUid] = 1; }
      if (isleNow() !== 'home') goIsle('home', { force: true });   /* games stand on Home Island: go and see it */
      draw();
      celebrate({ title: (isGoal ? '🎯 Goal reached! ' : '🎉 ') + it.name + '!', sub: res.placedUid ? 'It’s on your island now — look for the ▶ PLAY sign.' + (trial() ? '' : ' Yours forever!') : 'Your island is full — put something away in ✏️ Edit to make room. You can play it from 🎮 Games right now.', icon: it.id, sfx: 'fanfare',
        btns: [{ label: '▶ Play now', fn: function () { launch(it.game); } }] });
      return;
    }
    if (it.kind === 'pet') {
      freshPets[it.id] = true;                        /* adopted this page session: always out on Home today (D112) */
      draw();
      var cp = C.crewPet(W(), it.id);                  /* a V4.54 pet or a land's mascot, through the crew API */
      /* 'Name them' opens the crew sheet on the newcomer with its name box ready */
      celebrate({ title: tx('crew.joined', { item: cp ? cp.name : it.name }), sub: tx('crew.joinedSub'), icon: it.id, sfx: 'fanfare', btns: [{ label: 'Name them', fn: function () { openPets(it.id, true); } }] });
      return;
    }
    if (it.kind === 'style') { draw(); celebrate({ title: it.name, sub: tx('buy.style'), icon: it.id }); return; }
    if (it.kind === 'acc') {
      var ap = C.activePetId(w);                       /* new gear goes on the runner, a mascot too */
      if (ap) commit(function (u) { return C.equipAccessory(u, ap, it.id); }).then(function () { draw(); });
      /* the card shows it on the runner; Crew opens the sheet there, Wear open, to swap it round */
      celebrate({ title: it.name, sub: tx('buy.acc'), icon: it.id, btns: ap ? [{ label: tx('label.crew'), fn: function () { openPets(ap); } }] : [] });
      return;
    }
    if (it.kind === 'cosmetic' || it.kind === 'variant') { draw(); celebrate({ title: it.name, sub: tx('buy.cosmetic'), icon: it.id }); return; }
    /* placeable decor/path/fun → straight into placement on the island it may stand on, which can be skipped */
    placeBought(it);
  }

  function celebrate(o) {
    var cel = document.createElement('div');
    cel.className = 'slw-cele' + (o.cls ? ' ' + o.cls : '') + (reduced ? '' : ' pop');
    cel.setAttribute('role', 'dialog'); cel.setAttribute('aria-live', 'polite'); cel.setAttribute('data-sl-modal', '1');
    var tid = 'slwCele' + (++ovSeq); cel.setAttribute('aria-labelledby', tid);      /* a labelled dialog (the land reveal too) */
    cel.innerHTML = '<div class="t" id="' + tid + '">' + esc(o.title) + '</div>' + (o.icon ? '<div class="ic">' + iconHtml(o.icon, artState(W())) + '</div>' : '') +
      '<div class="s">' + esc(o.sub || '') + '</div><div class="btns">' +
      (o.btns || []).map(function (b, i) { return '<button class="slw-btn big" type="button" data-b="' + i + '">' + esc(b.label) + '</button>'; }).join('') +
      '<button class="slw-btn big on" type="button" data-b="x">' + esc(tx('celebrate.ok')) + '</button></div>';
    document.body.appendChild(cel);
    fillPhotocards(cel);
    cover(+1);
    if (o.sfx) sample(o.sfx, 0.8);
    try { if (!reduced && typeof popConfetti === 'function') { popConfetti(); setTimeout(popConfetti, 300); } } catch (e) {}
    var closedC = false;
    function close() {
      cel.remove(); document.removeEventListener('keydown', onKey);
      if (closedC) return;
      closedC = true; cover(-1);
      if (o.encore !== false) s3('showtime', true, { encoreMs: 8000 });   /* a short encore on the island (not after a land reveal) */
      if (o.onClose) o.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && !(document.activeElement && cel.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON')) close();
    }
    document.addEventListener('keydown', onKey);
    cel._close = close;
    cel.querySelectorAll('[data-b]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); close(); var i = b.dataset.b; if (i !== 'x' && o.btns[+i]) o.btns[+i].fn(); });
    });
    cel.addEventListener('click', close);
    setTimeout(function () { try { $('[data-b="x"]', cel).focus(); } catch (e) {} }, 40);
  }

  /* ---------------- home customisation ---------------- */
  function openHome() {
    var w = W(), st = artState(w);
    function opts(slot) {
      return C.CATALOG.filter(function (it) { return it.kind === 'style' && it.slot === slot && !it.retired; }).map(function (it) {
        var own = C.owns(w, it.id), on = it.multi ? !!w.details[it.id] : st[slot] === it.id;
        /* shapes preview in the child's own colours; roofs and extras on the child's own shape */
        var pv = slot === 'shape' ? ART.sprite('house_cottage', Object.assign({}, st, { shape: it.id })).svg : ART.icon(it.id, st);
        return '<button type="button" class="slw-trayitem" data-style="' + it.id + '" ' + (own ? '' : 'data-locked="1"') + ' aria-pressed="' + on + '" style="' + (on ? 'border-color:#6c5ce7;background:#f1edfb;' : '') + (own ? '' : 'opacity:.55;') + '">' +
          pv + '<span>' + esc(it.name) + (own ? (on ? ' ✓' : '') : (trial() ? ' · FREE' : ' · ⭐' + fmt(it.price))) + '</span></button>';
      }).join('');
    }
    var ov = overlay('<h2>' + lbl('home', 'Your home') + '</h2><div class="slw-detail"><div class="big" style="max-width:300px;">' + ART.sprite('house_cottage', st).svg + '</div><div class="info">' +
      '<b>' + esc(tx('home.tray.shape')) + '</b><div class="slw-tray">' + opts('shape') + '</div>' +
      '<b>Walls</b><div class="slw-tray">' + opts('wall') + '</div><b>Roof</b><div class="slw-tray">' + opts('roof') + '</div>' +
      '<b>Door</b><div class="slw-tray">' + opts('door') + '</div><b>Extras (tap to switch on/off)</b><div class="slw-tray">' + opts('detail') + '</div>' +
      '<div style="font-size:12.5px;color:#7c8696;font-weight:700;">' + esc(tx('shop.dimmed')) + '</div></div></div>');
    ov.querySelectorAll('[data-style]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.style;
        if (b.dataset.locked) { ov._close(); openItem(id); return; }
        commit(function (u) { return C.select(u, id); }).then(function () { ov._close(); draw(); openHome(); sfx('correct'); });
      });
    });
  }

  /* ---------------- the crew sheet (D97, D99, D109) ---------------- */
  /* how many of the crew the island shows at once (D97): the stage's crewRigs (its tier's budget) in 3D, PETS_2D in 2D */
  function crewCap() {
    if (!on3D()) return PETS_2D;
    var i = s3('info') || {}, a = i.actors || {}, T = window.SLTier, B = T && T.BUDGETS && T.BUDGETS[i.tier];
    return a.crewRigs > 0 ? a.crewRigs : B && B.crewRigs > 0 ? B.crewRigs : PETS_2D;
  }
  /* everyone in the crew, through the core's crew API only (SLIslandShop.crewSheet over C.crewList: the V4.54 pets, then
     the lands' mascots with a 'From <island>' tag), how many rest indoors (crew.resting, D97), and for each member:
     Wear, 'Make them the runner' and a new name. Wear is four slot rows (Hats, Neck, Face, Back; SLIslandShop.wearTray),
     each a sideways tray of the owned pieces for that slot with the worn one pressed in; it opens for one member at a
     time, the runner first. Every change is C.renamePet, C.setActivePet or C.equipAccessory, and the sheet redraws in
     place (scroll and focus kept). focusId opens the sheet on that member; nameIt puts focus in its name box */
  function openPets(focusId, nameIt) {
    var SH = window.SLIslandShop, w0 = W(), busy = false;
    var first = typeof focusId === 'string' && C.crewPet(w0, focusId) ? focusId : null;
    wearOpen = first || C.activePetId(w0);
    /* p = a crew member as SLIslandShop.crewSheet lists it ({id, name, active, isle, from}); its outfit is C.wornBy */
    function trays(w, p, accs) {
      if (SH) return SH.wearTray(C, w, p.id);
      return ['hat', 'neck', 'face', 'back'].map(function (slot) {
        return { slot: slot, labelKey: 'crew.slot.' + slot, items: accs.filter(function (a) { return a.slot === slot; }).map(function (a) { return { id: a.id, on: C.wornBy(w, p.id)[slot] === a.id }; }) };
      });
    }
    /* the four rows; a slot with nothing owned yet offers the Crew aisle instead. Each piece shows on the runner, as
       on its shop card (one photocard for both) */
    function wearHtml(w, p, accs) {
      var id = p.id;
      if (!accs.length) return '<div class="slw-unlocks" id="slwWear-' + id + '">Caps, beanies, headphones and more are in the Island Shop’s Crew aisle.</div>';
      return '<div class="slw-wearslots" id="slwWear-' + id + '" role="group" aria-label="' + esc(tx('crew.wear') + ': ' + p.name) + '">' + trays(w, p, accs).map(function (r) {
        var lid = 'slwWL-' + id + '-' + r.slot;
        return '<div class="slw-wearrow"><span class="lb" id="' + lid + '">' + esc(tx(r.labelKey)) + '</span><div class="slw-tray" role="group" aria-labelledby="' + lid + '" data-slot="' + r.slot + '">' +
          (r.items.length ? r.items.map(function (a) {
            return '<button type="button" class="slw-trayitem' + (a.on ? ' on' : '') + '" data-acc="' + a.id + '" data-pet="' + id + '" data-fk="acc:' + id + ':' + a.id + '" aria-pressed="' + a.on + '">' +
              '<span style="display:block;position:relative;height:56px;">' + iconHtml(a.id) + '</span><span>' + esc(C.item(a.id).name) + (a.on ? ' ✓' : '') + '</span></button>';
          }).join('') : '<button type="button" class="slw-trayitem" data-more="1" data-fk="more:' + r.slot + '"><span class="pv">' + ico('shop') + '</span><span>More crew and gear</span></button>') + '</div></div>';
      }).join('') + '</div>';
    }
    function memberHtml(w, p, accs) {
      var it = C.item(p.id), id = p.id, open = wearOpen === id;
      return '<div class="slw-card slw-member" data-member="' + id + '"><div class="slw-mtop"><div class="slw-mpic"><div style="width:120px;position:relative;">' + iconHtml(p.id, { acc: C.wornBy(w, p.id) }) + '</div></div><div class="slw-minfo">' +
        '<h3 class="nm slw-mname">' + esc(p.name) + ' <span class="sp">the ' + esc(it.name.toLowerCase()) + '</span>' + (p.active ? ' 🏅' : '') + '</h3>' +
        (p.from ? '<span class="chip uni">' + esc(tx('crew.from', { island: p.from })) + '</span>' : '') +
        '<div class="slw-mrow"><button type="button" class="slw-btn' + (open ? ' on' : '') + '" data-wear="' + id + '" data-fk="wear:' + id + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="slwWear-' + id + '"' : '') + '>' + esc(tx('crew.wear')) + '</button>' +
        (p.active ? '' : '<button class="slw-btn" type="button" data-active="' + id + '" data-fk="run:' + id + '">🏅 Make them the runner</button>') + '</div></div></div>' +
        '<div class="slw-mrow"><label>New name <input data-name="' + id + '" data-fk="name:' + id + '" maxlength="14" value="' + esc(p.name) + '"></label>' +
        '<button class="slw-btn" type="button" data-rename="' + id + '" data-fk="rename:' + id + '">Save name</button></div><div class="slw-err" data-err="' + id + '" role="alert"></div>' +
        (open ? wearHtml(w, p, accs) : '') + '</div>';
    }
    /* the list: who rests indoors, then every member (the sheet is built with it, so its first focus is the first member) */
    function crewHtml() {
      var w = W(), cs = SH ? SH.crewSheet(C, w, crewCap()) : { list: C.crewList(w), resting: 0 };
      var accs = C.CATALOG.filter(function (it) { return it.kind === 'acc' && C.owns(w, it.id); });
      return (cs.resting ? '<p class="slw-crewnote">' + esc(tx('crew.resting', { n: cs.resting })) + '</p>' : '') +
        cs.list.map(function (p) { return memberHtml(w, p, accs); }).join('');
    }
    var ov = overlay('<h2>' + lbl('crew', tx('crew.title')) + '</h2><div style="font-size:13px;color:#6b6585;font-weight:700;margin-bottom:8px;">' + esc(tx('crew.neverSad')) + ' ' + esc(tx('crew.runner')) + '</div>' +
      '<div id="slwCrewBody">' + crewHtml() + '</div><button class="slw-btn" type="button" id="slwMorePets" data-fk="more">' + lbl('shop', 'More crew and gear') + '</button>');
    var sheet = $('.slw-sheet', ov), body = $('#slwCrewBody', ov);
    /* a member's block top, measured against the sheet (to keep it under the finger, or lift it to the top) */
    function memberTop(id) { var m = $('[data-member="' + id + '"]', body); return m ? m.getBoundingClientRect().top : null; }
    function paint(after) {
      var fk = focusKey(ov), top = sheet.scrollTop, left = {};
      body.querySelectorAll('.slw-tray').forEach(function (t) { left[t.getAttribute('data-slot')] = t.scrollLeft; });
      body.innerHTML = crewHtml();
      if (top != null) sheet.scrollTop = top;
      finish(left);
      if (fk) refocus(ov, fk);
      if (after) after();
    }
    /* photocards, trays and buttons: a tray keeps its place and its worn piece comes into view (trays keep catalogue order) */
    function finish(left) {
      fillPhotocards(ov);
      body.querySelectorAll('.slw-tray').forEach(function (t) { var k = t.getAttribute('data-slot'); if (left[k]) t.scrollLeft = left[k]; showChip(t, $('[aria-pressed="true"]', t)); });
      wire();
    }
    /* one change at a time (a double tap must not put a hat on and take it off again), then the island and the sheet */
    function act(mutate, fkAfter) {
      if (busy) return Promise.resolve(null);
      busy = true;
      return commit(mutate).then(function (res) {
        busy = false; draw(); paint();
        if (fkAfter) refocus(ov, fkAfter);
        return res;
      }, function () { busy = false; return null; });
    }
    function rename(id) {
      var inp = $('[data-name="' + id + '"]', ov), val = inp ? inp.value : '', err = $('[data-err="' + id + '"]', ov);
      var v = C.validatePetName(val);
      if (!v.ok) { if (err) err.textContent = v.reason; return; }
      act(function (u) { return C.renamePet(u, id, val); }).then(function (res) {
        if (res && res.ok) { toast(tx('crew.named', { name: res.name })); return; }
        var e2 = $('[data-err="' + id + '"]', ov);
        if (e2 && res) e2.textContent = res.reason || 'Couldn’t save that.';
      });
    }
    /* Wear for one member at a time: the opened member's block rises to the top of the sheet; a shut one stays put */
    function toggleWear(id) {
      var y0 = memberTop(id);
      wearOpen = wearOpen === id ? null : id;
      paint(function () {
        var y = memberTop(id);
        if (y == null || y0 == null) return;
        var to = wearOpen === id ? sheet.getBoundingClientRect().top + (sheet.clientTop || 0) + 8 : y0;
        sheet.scrollTop = (sheet.scrollTop || 0) + y - to;
      });
    }
    function wire() {
      body.querySelectorAll('[data-wear]').forEach(function (b) { b.addEventListener('click', function () { toggleWear(b.dataset.wear); }); });
      body.querySelectorAll('[data-rename]').forEach(function (b) { b.addEventListener('click', function () { rename(b.dataset.rename); }); });
      body.querySelectorAll('[data-name]').forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); rename(inp.dataset.name); } }); });
      body.querySelectorAll('[data-active]').forEach(function (b) { b.addEventListener('click', function () { var id = b.dataset.active; act(function (u) { return C.setActivePet(u, id); }, 'wear:' + id); }); });
      body.querySelectorAll('[data-acc]').forEach(function (b) { b.addEventListener('click', function () { act(function (u) { return C.equipAccessory(u, b.dataset.pet, b.dataset.acc); }); }); });
      body.querySelectorAll('[data-more]').forEach(function (b) { b.addEventListener('click', more); });
    }
    function more() { ov._close(); openShop('pets'); }
    $('#slwMorePets', ov).addEventListener('click', more);
    finish({});
    /* opened on one member ('Name them' after an adoption, the Crew button after new gear): after the sheet's own first
       focus, focus moves to its name box or its Wear button and its block comes up to the top of the sheet */
    if (first) setTimeout(function () {
      var el = $(nameIt ? '[data-name="' + first + '"]' : '[data-wear="' + first + '"]', ov), y = memberTop(first);
      try { if (el) { el.focus({ preventScroll: true }); if (nameIt && el.select) el.select(); } } catch (e) {}
      if (y != null) sheet.scrollTop = (sheet.scrollTop || 0) + y - (sheet.getBoundingClientRect().top + (sheet.clientTop || 0) + 8);
    }, 60);
  }

  /* ---------------- info ---------------- */
  function openInfo() {
    var st = arcadeState();
    var ov = overlay('<h2>❓ How My Island works</h2>' +
      '<p style="font-weight:700;line-height:1.6;">📚 <b>Learn</b> anywhere in the app → you earn ⭐ points.<br>' + (trial() ? '🧪 Everything in the Island Shop is <b>free while we test</b> — your ⭐ stay put.' : '🛍️ <b>Spend</b> them in the Island Shop → your island grows.') + '<br>' + esc(tx('info.sky')) + '<br>🎮 <b>Play</b> your island games — they’re just for fun and never cost or earn points.<br>' +
      esc(tx('crew.neverSad')) + (trial() ? '' : '<br>⭐ Spending points never lowers your total-earned score.') + '</p>' + timeHtml(st) +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="slw-btn" type="button" id="slwReplay">▶ Show the welcome again</button>' +
      (can3DAgain() ? '<button class="slw-btn" type="button" id="slw3dAgain">Try 3D again</button>' : '') + '</div>', { small: true });
    $('#slwReplay', ov).addEventListener('click', function () { ov._close(); showIntro(); });
    var again = $('#slw3dAgain', ov);
    if (again) again.addEventListener('click', function () {
      ov._close();
      try { SLIsland3D.forget(); } catch (e) {}
      try { localStorage.removeItem('slNo3D'); } catch (e) {}
      use3D = null; maybeBoot3D();
    });
  }
  /* this device fell back to the 2D island (a slow or lost 3D renderer): offer one more go */
  function can3DAgain() {
    if (use3D || stage3d) return false;
    try { return !!(window.SLIsland3D && SLIsland3D.forget && SLIsland3D.remembered && SLIsland3D.remembered(window.SL_WORLD_VER)); } catch (e) { return false; }
  }
  function timeHtml(st) {
    if (!st.status.limited) return '<div class="slw-time" style="background:#f1edfb;border-color:#d9d2ee;color:#4a3f75;">🎮 Island games have no daily time limit on this account.</div>';
    var m = Math.floor(st.status.leftSec / 60), s = Math.floor(st.status.leftSec % 60);
    return '<div class="slw-time">⏱️ Your grown-up set <b>' + Math.round(st.status.limitSec / 60) + ' minutes</b> of island games a day. ' +
      (st.status.exhausted ? 'That’s all for today — see you tomorrow! 📚 Learning is still open.' : '<b>' + m + ' min ' + (s ? s + ' s ' : '') + '</b> left today.') + '</div>';
  }

  /* ---------------- intro (once, skippable) ---------------- */
  function maybeIntro() {
    var w = W(); if (!w) return;
    if (!w.introSeen) { showIntro(); return; }
    if (!maybeMakeoverV3(w)) maybeMakeover(w);         /* the sky note first; the v2 city note waits for the next open */
    if (!trial() && !w.trialOverSeen && (w.ledger || []).some(function (e) { return e && e.trial; })) {
      var ov = overlay('<div class="slw-intro"><div class="card" style="margin:0 auto;"><div class="hero">⭐ 🏝️</div><h2>Testing’s over — thank you!</h2>' +
        '<p style="font-weight:700;color:#4a3f75;">From now on, island things cost ⭐ — the same ⭐ you save for real prizes in the 🎁 Shop. Everything you already picked is still on your island.</p>' +
        '<div style="display:flex;justify-content:center;"><button class="slw-btn big on" type="button" id="slwTrialOk">Got it</button></div></div></div>',
        { small: true, onClose: function () { commit(function (u) { var fw = C.ensureWorld(u); if (fw.trialOverSeen) return { ok: false }; fw.trialOverSeen = true; return { ok: true }; }); } });
      $('#slwTrialOk', ov).addEventListener('click', function () { ov._close(); });
    }
  }
  /* an island from before v3, once (D23): it moved up into the sky, with a way to see the other islands
     (3D only: the Sky map). The note waits for a stage still booting and for another toast to finish */
  var skyNoted = {};
  function maybeMakeoverV3(w) {
    if (w.tutSeen.pixelV3) return false;
    if (skyNoted[state.activeUser]) return true;               /* once, even if a refresh lands before the save */
    skyNoted[state.activeUser] = true;
    commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen.pixelV3) return { ok: false }; fw.tutSeen.pixelV3 = true; return { ok: true }; });
    var who = state.activeUser, tries = 0;
    (function later(ms) {
      setTimeout(function () {
        if (renderedFor !== who || !root) return;                 /* the island closed, or another child is on it */
        if ((booting3d || document.querySelector('.slw-toast,.slw-cele')) && ++tries < 12) return later(700);
        toast(tx('makeover.v3'), mapChip() ? { label: tx('makeover.v3Btn'), fn: function () { if (mode === 'play') skyMap(true); } } : null);
      }, ms);
    }(900));
    return true;
  }
  function bumpedToast(gone) {
    if (!gone || !gone.length) return;
    var it = C.item(gone[0].id);
    toast(gone.length === 1 && it ? tx('isle.bumped', { item: it.name }) : tx('isle.bumpedMany', { n: gone.length }));
  }
  /* islands made before Encore City now show the City loft: say so once, with a one-tap way back */
  function maybeMakeover(w) {
    if (w.sel.shape || w.tutSeen.cityV2 || !C.item('shape_cottage') || C.selected(w, 'shape') === 'shape_cottage') return;
    commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen.cityV2) return { ok: false }; fw.tutSeen.cityV2 = true; return { ok: true }; });
    setTimeout(function () {
      toast(tx('makeover.toast'), { label: tx('makeover.revert'), fn: function () {
        commit(function (u) { return C.select(u, 'shape_cottage'); }).then(function (res) { if (res && res.ok) { draw(); sfx('correct'); } });
      } });
    }, 900);
  }
  function showIntro() {
    /* the welcome: an island in the sky with five more floating nearby (the v2 slides promised a city across the bay) */
    var slides = [
      ['🏝️', tx('intro.1.title'), tx('intro.1.body')],
      ['📚 ➜ ⭐', 'Learn to earn', 'Every maths, spelling or flags session earns ⭐.'],
      trial() ? ['🧪 🎁', tx('intro.3.trialTitle'), tx('intro.3.trialBody')]
        : ['⭐ ➜ 🏝️', tx('intro.3.title'), tx('intro.3.body')]
    ];
    var i = 0;
    var ov = overlay('<div class="slw-intro"><div class="card" style="margin:0 auto;" id="slwIntro"></div></div>', { small: true, onClose: finish });
    function finish() { commit(function (u) { var w = C.ensureWorld(u); if (w.introSeen) return { ok: false }; w.introSeen = true; return { ok: true }; }); }
    function paint() {
      var s = slides[i];
      $('#slwIntro', ov).innerHTML = '<div class="hero">' + s[0] + '</div><h2>' + esc(s[1]) + '</h2><p style="font-weight:700;color:#4a3f75;">' + esc(s[2]) + '</p>' +
        '<div class="slw-dots">' + slides.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;"><button class="slw-btn" type="button" id="slwSkip">Skip</button><button class="slw-btn big on" type="button" id="slwNext">' + (i < slides.length - 1 ? 'Next ➜' : 'Let’s go') + '</button></div>';
      $('#slwSkip', ov).addEventListener('click', function () { ov._close(); });
      $('#slwNext', ov).addEventListener('click', function () { if (i < slides.length - 1) { i++; paint(); } else ov._close(); });
      try { $('#slwNext', ov).focus(); } catch (e) {}
    }
    paint();
  }

  /* ---------------- savings-goal reached ---------------- */
  function checkGoalReached(onOpen) {
    var u = me(); if (!u) return;
    var w = C.ensureWorld(u), gp = C.goalProgress(u);
    if (!gp || !gp.ready || w.goalNotified === gp.id) return;
    commit(function (fu) { var fw = C.ensureWorld(fu); if (fw.goalNotified === gp.id) return { ok: false }; fw.goalNotified = gp.id; return { ok: true }; });
    window._slwLastGoal = gp.id;
    if (onOpen) celebrate({ title: '🎯 Goal reached', sub: 'You’ve saved enough for ' + gp.name + '. Buy it now, or keep saving for something bigger.', icon: gp.id, sfx: 'fanfare', btns: [{ label: 'Go to it', fn: function () { openItem(gp.id); } }] });
  }

  /* ---------------- arcade time (parent limit) ---------------- */
  var qaArcade = null;   /* QA mode only: can IMPOSE a test limit, never lift a family one */
  var CFG_KEY = 'slArcadeCfg';
  function cleanCfg(a) {
    if (!a || typeof a !== 'object') return null;
    var m = +a.dailyMinutes;
    return { dailyMinutes: (m > 0 && m <= 1440) ? Math.round(m) : 0, tz: typeof a.tz === 'string' ? a.tz.slice(0, 64) : 'Europe/London', setAt: +a.setAt || 0 };
  }
  function familyArcadeCfg() {
    var live = null, u = me();
    try {
      var cs = window.cloudState;
      if (cs && cs.doc && cs.doc.familyCode && u && cs.boundName === u.name) live = cleanCfg(window.slFamilyCfg && window.slFamilyCfg.arcade);
    } catch (e) { live = null; }
    var dev = null; try { dev = cleanCfg(JSON.parse(localStorage.getItem(CFG_KEY) || 'null')); } catch (e) {}
    var prof = null; try { prof = cleanCfg(u && u.world && u.world.arcadeCfg); } catch (e) {}
    if (live) {
      /* remember the parent's latest setting; only a newer owner setting replaces it */
      if (!dev || live.setAt >= dev.setAt) { try { localStorage.setItem(CFG_KEY, JSON.stringify(live)); } catch (e) {} dev = live; }
      if (u && u.world && (!prof || live.setAt > prof.setAt || live.dailyMinutes !== prof.dailyMinutes)) { u.world.arcadeCfg = live; try { saveState(); } catch (e) {} }
      return live.dailyMinutes ? live : qaArcade;
    }
    /* signed out / offline / another profile on this device: the newest remembered setting applies */
    var best = [prof, dev].filter(Boolean).sort(function (a, b) { return b.setAt - a.setAt; })[0];
    if (best && best.dailyMinutes) return best;
    return qaArcade;
  }
  function perfNow() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function nowMs() { return timeAnchor.at + (perfNow() - timeAnchor.perf); }
  var measuring = false;
  function measureServerTime() {
    if (measuring) return;
    measuring = true;
    try {
      var p0 = perfNow();
      fetch(location.pathname + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        measuring = false;
        var d = r.headers.get('Date'); if (!d) return;
        var srv = Date.parse(d); if (!isFinite(srv)) return;
        var p1 = perfNow();
        timeAnchor = { at: srv + 500, perf: (p0 + p1) / 2, server: true };   /* Date header has 1 s resolution */
      }).catch(function () { measuring = false; });
    } catch (e) { measuring = false; }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) measureServerTime(); });
  function localKey() { return 'slArcade:' + String(state.activeUser || '').toLowerCase(); }
  function arcadeState() {
    var cfg = familyArcadeCfg();
    var tz = (cfg && cfg.tz) || 'Europe/London';
    var day = C.dayKey(nowMs(), tz);
    var w = W(), lk = null;
    try { lk = JSON.parse(localStorage.getItem(localKey()) || 'null'); } catch (e) {}
    var latest = Object.keys((w && w.arcade && w.arcade.days) || {}).concat(lk && lk.d ? [lk.d] : []).sort().pop();
    if (latest && day < latest) day = latest;
    var used = C.arcadeUsed(w, day);
    if (lk && lk.d === day && lk.s > used) used = lk.s;
    return { cfg: cfg, day: day, used: used, status: C.arcadeStatus(cfg, used) };
  }
  var sinceMirror = 0;
  function arcadeTick(sec) {
    /* counts one active second at a time; tabs share the per-device total */
    var st = arcadeState();
    var total = st.used + sec;
    try { localStorage.setItem(localKey(), JSON.stringify({ d: st.day, s: total })); } catch (e) {}
    sinceMirror += sec;
    if (sinceMirror >= 10) { sinceMirror = 0; arcadeMirror(st.day, total); }
    return arcadeState();
  }
  function arcadeMirror(day, total) {
    /* copy into the synced profile so other devices / reloads see it (max, never added twice) */
    try { var u = me(); if (C.arcadeMax(u, day, total)) saveState(); } catch (e) {}
  }
  function arcadeFlush() { var st = arcadeState(); sinceMirror = 0; arcadeMirror(st.day, st.used); }

  /* ---------------- games ---------------- */
  /* deps: extra world/games/ scripts loaded (in order) after shell.js + fx.js and
     before the game file; tutKey: which tutSeen flag the game's tutorial uses (course_v3: the
     cards now say 3 hearts that never come back, so every child sees them once more) */
  var GAMES = {
    course: { name: 'Debut Run', att: 'att_course', file: 'pet-course.js', deps: ['course-hud.js'], tutKey: 'course_v3', grad: 'linear-gradient(135deg,#43c66f,#2a9d8f)', emoji: '🐾' },
    penalty: { name: 'Encore Shootout', att: 'att_pitch', file: 'penalty.js', tutKey: 'penalty2', grad: 'linear-gradient(135deg,#4a8ff0,#6c5ce7)', emoji: '⚽' },
    kart: { name: 'Neon Grand Prix', att: 'att_kart', file: 'kart.js', deps: ['kart-logic.js'], tutKey: 'kart2', grad: 'linear-gradient(135deg,#ff8a3d,#e94b4b)', emoji: '🏎️' }
  };
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { delete loaded[src]; rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function loadGame(game) {
    var v = window.SL_WORLD_VER || '1';
    try { if (localStorage.getItem('slQaMode') === '1') v += '&qa=' + Date.now(); } catch (e) {}
    var chain = loadScript('world/games/shell.js?v=' + v)
      .then(function () { return loadScript('world/games/fx.js?v=' + v); });
    (GAMES[game].deps || []).forEach(function (d) { chain = chain.then(function () { return loadScript('world/games/' + d + '?v=' + v); }); });
    return chain.then(function () { return loadScript('world/games/' + GAMES[game].file + '?v=' + v); });
  }
  function pbText(game) {
    var w = W(), out = [];
    Object.keys(w.pb).forEach(function (k) {
      if (k.indexOf(game + ':') !== 0) return;
      var rec = w.pb[k], vid = k.split(':')[1], it = C.item(vid);
      var RIVAL = { std: 'Mochi', rival_bop: 'Bop', rival_glowy: 'Glowy', rival_flip: 'Flip' };
      if (game === 'penalty' && RIVAL[vid]) it = { name: RIVAL[vid] };
      /* [V4.55-COURSES] names for the Remix courses (world/games/kart-logic.js KL.COURSES); a test keeps them equal */
      var KCOURSE = { track_loop_remix: 'Island Loop Remix', track_volcano_remix: 'Volcano Ring Remix', track_beach_remix: 'Beach Hairpins Remix', track_star: 'Starlight Twist' };
      if (game === 'kart' && !it && KCOURSE[vid]) it = { name: KCOURSE[vid] };
      out.push((it ? it.name : 'Best') + ': ' + (rec.ms != null ? (rec.ms / 1000).toFixed(2) + 's' : 'score ' + fmt(rec.score)));
    });
    return out.length ? '🏆 ' + out.join(' · ') : 'No best yet — set one!';
  }
  function openGames() {
    var w = W(), st = arcadeState();
    var html = '<h2>' + lbl('games', 'Island games') + '</h2>' + timeHtml(st) + '<p style="font-size:12.5px;font-weight:700;color:#7c8696;margin:0 0 8px;">' + esc(tx('games.noPoints')) + '</p><div class="slw-games">';
    Object.keys(GAMES).forEach(function (g) {
      var G = GAMES[g], own = C.owns(w, G.att);
      /* the card's colours go in --slw-g (the Pixel skin draws them as a band; the injected rule fills the card) */
      html += '<div class="slw-game' + (own ? '' : ' locked') + '" style="--slw-g:' + G.grad + ';"><h3>' + esc(G.name) + '</h3>' +
        '<div class="pb">' + (own ? esc(pbText(g)) : '🔒 Unlock with the ' + esc(C.item(G.att).name) + ' in the Island Shop') + '</div>' +
        '<button class="slw-btn big" type="button" data-play="' + g + '">' + (own ? '▶ Play' : '👀 See it in the Island Shop') + '</button></div>';
    });
    var ov = overlay(html + '</div>');
    /* [V4.55-BOARDS] optional leaderboards (world/games/boards.js); this sheet works without it */
    (window.SLBoards ? Promise.resolve() : loadScript('world/games/boards.js?v=' + (window.SL_WORLD_VER || '1'))).then(function () { if (window.SLBoards && SLBoards.attach) SLBoards.attach(ov, { overlay: overlay, day: st.day }); }).catch(function () {});
    ov.querySelectorAll('[data-play]').forEach(function (b) { b.addEventListener('click', function () { ov._close(); launch(b.dataset.play); }); });
  }
  var running = null;
  function launch(game) {
    var G = GAMES[game]; if (!G) return;
    var w = W();
    /* ownership gate — every entry point (island, menu, URL) comes through here */
    if (!C.owns(w, G.att)) { openItem(G.att); return; }
    if (running) return;
    if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); mode = 'play'; draw(); }
    var st = arcadeState();
    if (C.roundGate(st.status).allowed === false) {
      var ov = overlay('<h2>⏱️ That’s all the game time for today</h2><p style="font-weight:700;">Your grown-up set ' + Math.round(st.status.limitSec / 60) + ' minutes of island games a day. Your games are still yours — come back tomorrow!</p><button class="slw-btn big on" type="button" id="slwToLearn">📚 Learning is open — let’s go</button>', { small: true });
      $('#slwToLearn', ov).addEventListener('click', function () { ov._close(); if (typeof setActiveApp === 'function') setActiveApp('maths'); });
      return;
    }
    var launchedFor = state.activeUser;
    running = { game: game };
    loadGame(game).then(function () {
      var world = W();
      /* the runner with its real ids (a mascot and land gear too, D98), through the crew API */
      var pet = C.crewPet(world, C.activePetId(world)) || C.crewList(world)[0];
      var cfg = {
        variant: game === 'course' ? C.selected(world, 'course') : game === 'kart' ? C.selected(world, 'track') : 'std',
        ownedVariants: C.CATALOG.filter(function (it) { return it.game === game && it.kind === 'variant' && C.owns(world, it.id); }).map(function (it) { return { id: it.id, name: it.name }; }),
        pet: pet ? { id: pet.id, name: pet.name, acc: C.wornBy(world, pet.id) } : { id: 'pet_puppy', name: 'Buddy', acc: {} },
        ball: C.selected(world, 'ball'), stadium: C.selected(world, 'stadium'), kart: C.selected(world, 'kart'),
        pb: world.pb, tutSeen: !!world.tutSeen[G.tutKey || game], reduced: reduced,
        /* who's playing: name, signature colour and avatar for 3D views, HUDs and results */
        user: { name: (me() || {}).name || '', color: (me() || {}).color || '#6C5CE7', avatar: (me() || {}).avatar || '🙂' },
        profileKey: launchedFor, day: arcadeState().day,
        muted: function () { var u = me(); return !!(u && u.muted); },
        toggleMute: function () { var u = me(); if (!u) return false; u.muted = !u.muted; saveState(); try { if (typeof renderMuteBtn === 'function') renderMuteBtn(); } catch (e) {} return u.muted; },
        arcade: {
          status: function () { return arcadeState().status; },
          gate: function () { return C.roundGate(arcadeState().status); },
          tick: function (sec) { return arcadeTick(sec).status; },
          flush: arcadeFlush
        },
        onTutorialSeen: function () { commit(function (u) { C.ensureWorld(u).tutSeen[G.tutKey || game] = true; return { ok: true }; }); },
        onSelectVariant: function (vid) { commit(function (u) { return C.select(u, vid); }); },
        onResult: function (variant, result) {
          /* results go only to the profile that launched the game, and never touch points */
          if (state.activeUser !== launchedFor) return Promise.resolve({ ok: false });
          return commit(function (u) { return C.recordResult(u, game, variant, result); });
        },
        onExit: function () {
          arcadeFlush();
          running = null;
          window.slGameBusy = false;
          if (userChangedInGame) { userChangedInGame = false; onUserChanged(); return; }
          s3('resume');
          draw();
        }
      };
      window.slGameBusy = true;
      s3('suspend');                                     /* the game borrows the 3D renderer */
      window.SLGames[game].start(cfg);
    }).catch(function () {
      /* a game that never started must not hold the app's pop-ups or the island's renderer */
      window.slGameBusy = false;
      s3('resume');
      running = null;
      toast('⚠️ Couldn’t load the game — check your connection and try again.');
    });
  }

  /* ---------------- leaving the island tab ---------------- */
  function onHide() {
    try { if (window.SLMusic) SLMusic.stopAll(200); } catch (e) {}   /* never on learning screens */
    if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); }
    mode = 'play'; selectedUid = null;
    stopPets();
    renderedFor = null;
    resetIsle();                         /* My Island always opens on Home */
    /* the 3D stage stops at once; its GPU memory goes after 30 s away */
    s3('suspend');
    if (dispose3dTimer) clearTimeout(dispose3dTimer);
    dispose3dTimer = setTimeout(function () {
      dispose3dTimer = 0;
      if (renderedFor != null || running) return;
      if (stage3d) { var st = stage3d; stage3d = null; try { st.dispose(); } catch (e) {} }
      use3D = null;
      /* free the shared renderer, programs and cached geometry too; the next open boots again */
      try { if (window.SLIsland3D && SLIsland3D.dispose) SLIsland3D.dispose({ keepKit: false }); } catch (e) {}
    }, 30000);
  }

  /* ---------------- profile switches / external changes ---------------- */
  function onUserChanged() {
    if (running) { userChangedInGame = true; return; }       /* a game owns the screen: catch up when it ends */
    if (!root || !document.getElementById('worldView') || document.getElementById('worldView').classList.contains('hidden')) {
      renderedFor = null; lit = {}; freshPets = {}; resetIsle(); s3('setUser', userInfo());
      return;
    }
    /* another tab saved the same child: stay on the island being visited (a now-locked one shows as a preview) */
    var same = renderedFor != null && renderedFor === state.activeUser;
    closeAllOverlays();
    placing = null; mode = 'play'; selectedUid = null;
    document.removeEventListener('keydown', placeKeys);
    lit = {};
    if (!same) freshPets = {};
    keepIsle = same;
    s3('setUser', userInfo());
    render();
  }
  function onPointsChanged() {
    if (!root) return;
    var el = document.getElementById('slwPts'); var u = me();
    if (el && u) el.textContent = fmt(u.points);
    var g = root.querySelector('.slw-goal');
    if (g && u) { var tmp = document.createElement('div'); tmp.innerHTML = goalHtml(u); g.replaceWith(tmp.firstChild); var ng = root.querySelector('.slw-goal'); if (ng) ng.addEventListener('click', goalTap); }
  }

  window.SLWorld = {
    render: render,
    onUserChanged: onUserChanged,
    onPointsChanged: onPointsChanged,
    onHide: onHide,
    renderedFor: function () { return renderedFor; },
    launch: launch,
    openShop: openShop,
    openItem: openItem,
    _qa: function () {
      try { if (localStorage.getItem('slQaMode') !== '1') return null; } catch (e) { return null; }
      return { C: C, commit: commit, commitPurchase: commitPurchase, arcadeState: arcadeState, arcadeTick: arcadeTick, stage: function () { return stage3d; }, state: function () { return { mode: mode, placing: placing, selectedUid: selectedUid, running: running, isle: isleNow(), skyMap: skyMapOn }; }, setServerOffset: function (ms) { timeAnchor = { at: Date.now() + ms, perf: perfNow(), server: true }; }, setArcadeCfg: function (cfg) { qaArcade = cfg || null; },
        /* scripted QA of the sky islands (QA mode only): which island, fly there, the Sky map */
        isle: isleNow, visit: function (k, o) { return goIsle(k, o); }, skyMap: skyMap };
    }
  };
})();
