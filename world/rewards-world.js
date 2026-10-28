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
  /* the island's money (F-KU5; James, 24 Oct 2026: two wallets). Learning earns ⭐ for 🎁 My rewards and the same
     number of 🪙 coins, and My Island pays only in 🪙 (C.walletOf() 'coins'). Every island price, balance and
     shortfall on these screens reads these, never it.price or u.points; a core that pays in ⭐ reads as before.
     In free test mode nothing moves in either wallet, and the prices still show (struck through) */
  function coinsOn() { return typeof C.walletOf === 'function' && C.walletOf() === 'coins'; }
  function SYM() { return coinsOn() ? (C.COIN && C.COIN.sym) || '🪙' : '⭐'; }
  function priceOf(it) { var p = it && typeof C.priceOf === 'function' ? C.priceOf(it) : null; return typeof p === 'number' && isFinite(p) ? p : it ? it.price : 0; }
  function balOf(u) { return !u ? 0 : typeof C.walletBalance === 'function' ? C.walletBalance(u) : u.points || 0; }
  function money(n) { return SYM() + ' ' + fmt(n); }
  /* d-island (James, 25 Oct 2026): one wording for every shortfall, 'Need N more 🪙' (need.coins), and one for every goal
     button, '🎯 My goal' (goal.my; ' ✓' while it is the goal). Plain text: the caller escapes it */
  function needLine(n) { return coinsOn() ? tx('need.coins', { n: fmt(n) }, 'Need ' + fmt(n) + ' more 🪙') : 'Need ' + fmt(n) + ' more ⭐'; }
  function goalWord(on) { return tx('goal.my', null, '🎯 My goal') + (on ? ' ✓' : ''); }
  /* a price badge (a sign, a land chip, a tray): 'Free' in test mode (the one word, wardrobe.free; R2, QA2A-12), else the
     price in the island's money. Plain text: the caller escapes it */
  function freeOr(n) { return trial() ? tx('wardrobe.free') : money(n); }
  function balTitle() { return coinsOn() ? tx('coins.balance') : 'Your spendable points'; }
  /* a pet the pet cap shuts out (itemState 'full', code own_full: F-KU4's A4): its chip, '3 of 3 pets' (an old save
     above the cap: 'Full: you have 5 pets'), the Pet Shop's own words (F-KU2) */
  function capChip(s) {
    var max = s && typeof s.max === 'number' ? s.max : C.CARE ? C.CARE.homeMax : 3, n = s && typeof s.count === 'number' ? s.count : max;
    return tx(n > max ? 'care.shop.capKeep' : 'care.shop.capFull', { n: n });
  }
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
    commitRev++;                         /* island activities (IA-5): today's island day is worked out again */
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
  /* whose Wear rows are open in the crew sheet, memory only (one member at a time; the runner first). The shop's own
     memory (the land on show, 'I can buy', the Wardrobe page) is with openShop (wave 3) */
  var wearOpen = null;
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
  /* island activities v1 (IA-5): every commit's number (today's island day is worked out again after one), a real open's
     island-day count still to do, a feeding moment playing (the visitor steps aside). Memory only */
  var commitRev = 0, dayOpen = false, feedingNow = false, wxDue = false, metaOpen = false;
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
      /* c-island: above the theme's soft background blobs (slTheme body::before / ::after, z-index 0), as island-pixel.css */
      '.slw{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:0 4px 18px;font-family:inherit;}',
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
      /* the sticky sheet header (A9): the title, the ⭐ balance and the ✕ stay at the top of the sheet while it scrolls
         (iPad too). It sits flush with the sheet's top edge: its margins and top undo the sheet's top padding. A sheet
         with no title of its own keeps a zero-height header that only holds the ✕ in view */
      '.slw-sheethd{position:-webkit-sticky;position:sticky;top:-16px;z-index:8;display:flex;align-items:center;gap:10px;margin:-16px -16px 8px;padding:10px 16px 8px;background:#fff;}',
      '.slw-sheethd h2{flex:1 1 auto;min-width:0;margin:0;padding-right:0;}',
      '.slw-sheethd .slw-x{position:static;flex:none;margin-left:auto;}',
      '.slw-sheethd.bare{height:0;min-height:0;padding:0;margin-bottom:16px;background:transparent;}',
      '.slw-sheethd.bare .slw-x{position:absolute;right:10px;top:10px;}',
      '.slw-hdpts{flex:none;font-weight:800;color:#6b5a22;font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '.slw-carderr{font-size:12.5px;min-height:0;}',
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
      '.slw-need{font-size:12px;font-weight:800;color:#8a6100;}.slw-need.slw-capline{color:#4a3f75;}',
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
      '.slw-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9600;background:#2c2550;color:#fff;border-radius:14px;padding:10px 14px;font-weight:800;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3);box-sizing:border-box;max-width:calc(100vw - 24px);}.slw-toast>span{flex:1 1 12em;min-width:0;}',
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
      /* the shop's land chips stick on every size right under the sheet's sticky header (--slw-hdh, its measured height;
         the − 18px undoes the sheet's top padding, else cards show between them); on phones the Wardrobe page's slot
         chips stick under them (wave 3) */
      '#slwShopLand{top:calc(var(--slw-hdh, 0px) - 18px);}',
      /* a card that takes keyboard focus scrolls clear of the sticky header and land band (WCAG 2.4.11; island-pixel.css
         adds its sticky Jump to row's band) */
      '.slw-sheet.slw-shopsheet{scroll-padding-top:calc(var(--slw-hdh, 0px) + 64px);}',
      '@media (max-width:600px){#slwShopBody .slw-islefilter.sticky{top:calc(var(--slw-hdh, 0px) + 38px);}}',
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
      /* the kids update (KU-CH17): the ✎ on 'That’s you!' while there is no character (2D: a chip on the figure;
         3D: a 44 px button over it), a land's lead Dress-up card, the people cards' extra lines */
      '.slw-mebadge{position:absolute;right:-24%;top:-2%;width:clamp(22px,2.9vw,30px);height:clamp(22px,2.9vw,30px);border-radius:50%;background:#ffd23f;color:#4a3200;border:2px solid #2c2550;display:flex;align-items:center;justify-content:center;font-size:clamp(11px,1.6vw,17px);font-weight:800;line-height:1;pointer-events:none;box-shadow:0 2px 0 #2c2550;}',
      '.slw-mebadge3d{width:44px;height:44px;padding:0;border-radius:50%;border:3px solid #2c2550;background:#ffd23f;color:#4a3200;font:inherit;font-size:21px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 3px 0 #2c2550;}',
      '.slw-mebadge3d:focus-visible{outline:3px solid #fff;outline-offset:2px;}.slw-me .slw-mebadge svg,.slw-mebadge3d svg{display:block;width:66%;height:66%;margin:auto;}',
      '.slw-card.lead{border-color:#ffd23f;box-shadow:0 0 0 2px #ffd23f inset;}.slw-card .ln{font-size:12px;font-weight:700;color:#4a3f75;line-height:1.35;}',
      '.slw-toast.over{z-index:9800;}',
      /* the kids update (P4.1): a pet's care badge (2D: on its sprite, outside the picture; 3D: an anchor over it), the 2D
         feeding moment (pets U13: a bowl under the sprite, three bits, three nods at 1.5 Hz, two hearts; never over 2 Hz),
         the memory stars in the 2D night sky, the Crew aisle's Pet Shop row and the intro's care picture */
      '.slw-pet .slw-carebadge{position:absolute;right:-12%;top:-8%;width:40%;pointer-events:none;}.slw-carebadge svg{display:block;width:100%;height:auto;}',
      '.slw-carebadge3d{pointer-events:none;}.slw-carebadge3d .slw-carebadge{display:block;width:30px;height:30px;}',
      /* the eating pet comes forward and grows to read on a phone (its neighbours never hide its bowl) */
      '.slw-pet.slw-eat{z-index:960 !important;scale:1.7;transform-origin:50% 100%;animation:slwEatIn .3s ease-out;}@keyframes slwEatIn{from{scale:1;}}',
      '.slw-pet.slw-eat>svg{transform-origin:50% 92%;animation:slwNod .667s ease-in-out .45s 3;}.slw-pet.slw-eat.still,.slw-pet.slw-eat.still>svg{animation:none;}',
      '@keyframes slwNod{50%{rotate:9deg;}}',
      '.slw-feed2d{position:absolute;left:52%;bottom:-6%;width:58%;pointer-events:none;}.slw-pet.flip .slw-feed2d{left:-10%;}',
      '.slw-feed2d .bowl svg,.slw-feed2d .bit svg,.slw-feed2d .love svg{display:block;width:100%;height:auto;}',
      '.slw-feed2d .bit{position:absolute;left:30%;bottom:40%;width:40%;opacity:0;animation:slwBit .45s ease-in forwards;}',
      '@keyframes slwBit{0%{opacity:0;translate:0 -170%;}25%{opacity:1;}85%{opacity:1;translate:0 0;}100%{opacity:0;translate:0 0;}}',
      '.slw-feed2d .love{position:absolute;left:0;right:0;bottom:120%;height:0;}.slw-feed2d .love i{position:absolute;left:4%;bottom:0;width:46%;opacity:0;animation:slwLove .9s ease-out 2.1s forwards;}',
      '.slw-feed2d .love i+i{left:50%;animation-delay:2.25s;}@keyframes slwLove{0%{opacity:0;translate:0 0;}30%{opacity:1;}100%{opacity:0;translate:0 -110%;}}',
      '.slw-feed2d.still .love i{animation:none;opacity:1;}.slw-feed2d.still .bit{display:none;}',
      '.slw-stars2d{display:none;position:absolute;left:30%;right:30%;top:1%;z-index:6;justify-content:center;gap:4%;}.slw.showtime .slw-stars2d{display:flex;}',
      '.slw-star2d{width:44px;height:44px;padding:4px;border:none;background:none;cursor:pointer;}.slw-star2d svg{display:block;width:100%;height:100%;}',
      '.slw-star2d:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;border-radius:50%;}',
      '.slw-petshoprow{display:flex;margin:4px 0 10px;}.slw-intro .hero .slw-carehero{display:inline-flex;align-items:flex-end;gap:4px;height:84px;}.slw-carehero svg{height:100%;width:auto;}.slw-carehero svg+svg{height:52%;}',
      /* wave 3 (WAVE3-PLAN §3, §5; island-pixel.css draws the real look, these keep them usable without it): the Next step
         card in the HUD's goal slot, the shop's sticky land chips, its 'I can buy' + 'Jump to' row, door cards, Learn buttons */
      '.slw-goal.slw-next{cursor:default;flex-wrap:wrap;}.slw-next .nx{flex:1 1 160px;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '.slw-next .lb{font-size:11px;font-weight:800;color:#6b6390;text-transform:none;}.slw-next .gt{font-size:13.5px;line-height:1.3;}',
      '.slw-nextbtn,.slw-learnbtn{border:none;border-radius:12px;padding:8px 12px;min-height:44px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#6c5ce7,#a86ff0);color:#fff;}',
      '.slw-nextbtn{flex:0 0 auto;}',
      /* a card's 📚 Learn keeps its words (never squeezed under them); a row it shares with a long button wraps */
      '.slw-learnbtn{white-space:nowrap;}.slw-card .row>.slw-learnbtn{flex:1 0 auto;}.slw-card .row.slw-learnrow{flex-wrap:wrap;}.slw-card.ppl .row.slw-learnrow>.slw-goalbtn{flex:1 1 auto;}',
      '.slw-shopland{position:-webkit-sticky;position:sticky;top:calc(var(--slw-hdh, 0px) - 18px);z-index:6;display:flex;gap:8px;flex-wrap:nowrap;margin:10px -16px 8px;padding:6px 16px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:none;background:#fff;}',
      '.slw-shopland>.slw-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;}.slw-shopland .slw-btn svg{width:22px;height:22px;flex:none;}',
      '.slw-shopfilter{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;margin:0 0 12px;padding:2px 2px 8px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;}.slw-shopfilter>*{flex:0 0 auto;}.slw-shopfilter .lb{font-size:13px;font-weight:700;margin-left:4px;}',
      '.slw-card.door{background:#f7f4ff;border-color:#d9d2ee;}.slw-card.door .ic{cursor:pointer;}',
      '.slw-shopempty{text-align:center;font-weight:800;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;}.slw-shopempty p{margin:0;}',
      '.slw-learntime{flex:1 0 100%;font-size:13px;font-weight:700;color:#4a3f75;}.slw-shopback{margin:0 0 10px;}',
      '.slw-wardpage h3{display:flex;align-items:center;gap:8px;margin:4px 0 10px;}.slw-wardpage h3 svg{width:24px;height:24px;}',
      '.slw-game .what{margin:0;font-size:14px;font-weight:700;opacity:.95;}',
      /* R2: the HUD's music, sound and ❓ squares (island-pixel.css draws the real look) */
      '.slw-hud[aria-busy="true"]>*{opacity:.55;}',
      '.slw-card .row{flex-wrap:wrap;}.slw-card .row>.slw-cardgoal{flex:1 0 100%;}.slw-learnwrap{display:flex;flex-direction:column;align-items:flex-start;gap:6px;}.slw-learnwrap>.slw-learntime{flex:none;}',
      /* R2: a closed shelf's other cards, 'See all', the 'I can buy' switch (island-pixel.css draws the real look) */
      '.slw-grid>.slw-card[hidden],.slw-seeall[hidden]{display:none !important;}.slw-seeall{display:flex;margin:-2px auto 16px;}',
      /* d-island: the HUD's 📚 Learn steps aside while the Next step card shows its own */
      '.slw-hud .slw-learn[hidden]{display:none !important;}',
      '.slw-shopswitch{display:flex;justify-content:flex-end;margin:0 0 8px;}.slw-switch{display:inline-flex;align-items:center;gap:8px;min-height:44px;background:none;border:0;font:inherit;font-weight:800;cursor:pointer;}',
      '.slw-switch .tk{position:relative;width:46px;height:26px;border-radius:13px;background:#d9d2ee;}.slw-switch .tk>i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;}',
      '.slw-switch[aria-checked="true"] .tk{background:#6c5ce7;}.slw-switch[aria-checked="true"] .tk>i{left:auto;right:3px;}.slw-sheet.slw-shopsheet{height:92vh;}',
      '.slw-togs{display:flex;gap:6px;flex:0 0 auto;align-items:center;}.slw-tog{position:relative;width:44px;min-width:44px;min-height:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:18px;}',
      '.slw-tog .slw-togic{display:inline-flex;align-items:center;justify-content:center;}.slw-tog .slw-togic svg{width:22px;height:22px;}',
      /* c-island: the ⋯ square (Sound and help) in place of sound and ❓ on a phone up to 400px wide */
      '.slw-togs .slw-more{display:none;}@media (max-width: 400px){.slw-togs .slw-tog[data-act="sound"],.slw-togs .slw-tog[data-act="info"]{display:none;}.slw-togs .slw-tog.slw-more{display:inline-flex;}}',
      /* phones: the HUD's buttons wrap (no sideways strip that hides My pets, QA#6) and the Next step card takes a whole row */
      '@media (max-width:640px){.slw-goal.slw-next{flex:1 1 100%;}}',
      /* island activities v1 (IA-5; island-pixel.css draws the real look, these keep them usable without it): the 📋 Today
         sign and its sheet, the visitor (2D, its portrait tag and card), the play strip pinned to the stage's top (sticky, so
         a phone's sideways 2D island keeps it in view; it takes no row of its own), the HUD's places stepping aside while a
         pet plays or a show runs (kept in their row: nothing moves), speech bubbles, the 2D fetch and hide, the weather
         overlay (≤ 0.1 Hz, still under reduced motion), the 'Show today' pill, the explorer flag, the Games sheet's block */
      '.slw-todaysign{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 12px;border:2px solid #2B3A80;border-radius:12px;background:#fff;color:#1B2150;font:inherit;font-weight:800;font-size:15px;white-space:nowrap;cursor:pointer;position:relative;}',
      '.slw-stage>.slw-today2d{position:absolute;z-index:905;transform:translate(-50%,-100%);}.slw-todaysign[hidden],.slw-tag3d .slw-tag[hidden]{display:none !important;}',
      '.slw-tdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--slw-me,#6c5ce7);border:2px solid #fff;box-shadow:0 0 0 2px #2B3A80;}',
      '.slw-visitor2d{position:absolute;width:' + pct(70, STAGE_W) + ';padding:0;border:none;background:none;cursor:pointer;}.slw-visitor2d svg{width:100%;height:auto;display:block;}',
      '.slw-visitor2d .nm,.slw-vistag .nm{display:block;margin:2px auto 0;width:max-content;max-width:140px;padding:1px 8px;border-radius:999px;background:#fff;color:#1B2150;font-size:12px;font-weight:800;}',
      '.slw-visitor2d.wave{animation:slwHop .6s ease-out;}',
      '.slw-vistag{display:flex;flex-direction:column;align-items:center;min-width:48px;min-height:48px;padding:4px;border:2px solid #2B3A80;border-radius:12px;background:#fff;cursor:pointer;}.slw-vistag .slw-pc{display:block;width:44px;height:44px;}.slw-vistag svg{width:100%;height:100%;}',
      '.slw-playbar{position:-webkit-sticky;position:sticky;left:0;top:0;z-index:1100;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-height:48px;margin-bottom:-48px;padding:4px 8px;box-sizing:border-box;width:100%;background:rgba(255,255,255,.95);border-bottom:2px solid #2B3A80;}',
      /* 3D: over the stage's own layer (.slw-3d, z 1000), clear of its camera buttons down the right-hand side */
      '.slw-stagewrap.slw-is3d>.slw-playbar{width:calc(100% - 64px);}',
      '.slw-playbar .slw-pbtx{flex:1 1 12em;min-width:0;font-weight:800;color:#1B2150;font-size:15px;line-height:1.3;}.slw-playbar.slw-pb-spy .slw-pbtx{font-size:17px;}',
      '.slw-playbar .slw-pbbtns{display:flex;gap:6px;flex-wrap:wrap;}.slw-playbar .slw-btn{min-height:44px;}',
      '.slw[data-playing] .slw-acts{opacity:.45;}',
      '.slw-say2d{position:absolute;z-index:970;transform:translate(-50%,-100%);max-width:min(260px,40%);padding:6px 10px;border:2px solid #2B3A80;border-radius:12px;background:#fff;color:#1B2150;font-weight:800;font-size:14px;line-height:1.3;text-align:center;pointer-events:none;}',
      '.slw-pet.slw-busy{z-index:955;}.slw-pet.slw-hid2d{z-index:auto;}',
      '.slw-ball2d{position:absolute;z-index:956;transform:translate(-50%,-50%);font-size:clamp(16px,2.4vw,26px);pointer-events:none;}',
      '.slw-veil{position:absolute;inset:0;z-index:1050;background:#1B2150;opacity:0;pointer-events:none;animation:slwVeil 2s ease-in-out forwards;}@keyframes slwVeil{0%{opacity:0;}25%,75%{opacity:.92;}100%{opacity:0;}}',
      '.slw-wob2d{animation:slwWob 1.2s ease-out;transform-origin:50% 100%;}@keyframes slwWob{0%,100%{transform:rotate(0);}20%{transform:rotate(-6deg);}50%{transform:rotate(5deg);}80%{transform:rotate(-3deg);}}',
      '.slw-spyglow{outline:4px solid #FFD23F;outline-offset:2px;border-radius:8px;}',
      '.slw-wx{position:absolute;inset:0;z-index:890;overflow:hidden;pointer-events:none;}.slw-wx.slw-wx3d{z-index:1040;}.slw-wxf{position:absolute;font-size:clamp(12px,1.8vw,20px);animation:slwWxFall 14s linear infinite;}',
      '.slw-wxf>i{display:inline-block;font-style:normal;animation:slwWxSway 8s ease-in-out infinite alternate;}@keyframes slwWxFall{from{top:-8%;}to{top:104%;}}@keyframes slwWxSway{from{transform:translateX(-10px);}to{transform:translateX(10px);}}',
      '.slw-chipshow{background:#FFD23F;color:#1B2150;border-radius:6px;padding:1px 6px;font-size:11px;}',
      '.slw-tag.slw-showtag{position:static;transform:none;display:inline-block;margin-left:4px;background:#FFD23F;color:#1B2150;}',
      '.slw-flagmark{margin-right:4px;}.slw-flag2d{position:absolute;z-index:6;font-size:clamp(14px,2vw,24px);pointer-events:none;}',
      '.slw-petchips{display:flex;gap:6px;}.slw-petchips .slw-btn{min-height:44px;white-space:nowrap;}#slwPets>.slw-petchips{position:absolute;z-index:958;transform:translate(-20%,-120%);}',
      '.slw-trows{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:8px;}.slw-trow{display:flex;align-items:center;gap:10px;padding:8px;border:2px solid #d9d2ee;border-radius:12px;}',
      '.slw-trow .ic{flex:none;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;}.slw-trow .ic svg,.slw-trow .ic .slw-pc{width:40px;height:40px;display:block;}',
      '.slw-trow .tx{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}.slw-trow .ln{font-weight:800;}.slw-trow .sub{font-size:13px;font-weight:700;color:#4a3f75;}',
      '.slw-trow .slw-btn{flex:none;min-height:48px;}.slw-tdone{flex:none;font-weight:800;color:#17663A;}.slw-tday{margin:0 0 4px;font-weight:800;}.slw-tcalm{margin:8px 0 0;font-size:13px;font-weight:700;color:#4a3f75;}',
      '.slw-vistop{display:flex;align-items:center;gap:12px;}.slw-visface{flex:none;width:72px;height:72px;}.slw-visface svg,.slw-visface .slw-pc{width:72px;height:72px;display:block;}',
      '.slw-visbtns{display:flex;flex-direction:column;gap:8px;margin-top:10px;}.slw-visbtns .slw-btn{min-height:48px;}',
      '.slw-freeplay{margin:16px 0 0;}.slw-freeplay h3{margin:0 0 4px;}.slw-freenote{margin:0 0 8px;font-size:13px;font-weight:700;}.slw-freelist{display:flex;flex-wrap:wrap;gap:8px;}.slw-freelist .slw-btn{flex:1 1 220px;min-height:48px;}',
      '.slw-looks{margin:10px 0;}.slw-lookshelp,.slw-helptoday{margin:4px 0;font-size:13px;font-weight:700;}',
      '@media (prefers-reduced-motion: reduce){.slw-wxf,.slw-wxf>i,.slw-veil,.slw-wob2d,.slw-visitor2d.wave{animation:none !important;}.slw-veil{display:none;}}',
      '@media (prefers-reduced-motion: reduce){.slw-pet.slw-eat,.slw-pet.slw-eat>svg,.slw-feed2d .bit,.slw-feed2d .love i{animation:none !important;}}',
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
    return Object.assign({}, st, { variant: (L && L.variantOf) ? L.variantOf(p.uid, p.id) : 0, pet: (w && runnerId(w)) || 'pet_puppy' });
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
    var r;
    try { r = stage3d[method].apply(stage3d, Array.prototype.slice.call(arguments, 1)); }
    catch (e) { disable3D('call:' + method); return undefined; }
    if (method === 'sync') visTagCheck();          /* the visitor's figure may have come or gone with it (IA-5) */
    return r;
  }
  function lowPanels() { try { document.documentElement.classList.add('sl-low'); } catch (e) {} }
  function disable3D(reason) {
    var st = stage3d; stage3d = null; use3D = false;
    endActivity('stage');                              /* a 3D game in play ends with its stage (IA-5) */
    hudBusy = false;                                   /* the 2D island answers at once */
    lowPanels();
    if (st) { try { st.dispose(); } catch (e) {} }
    /* the 2D island draws every island: the child stays where they are (a trip in the air lands at once,
       its continuation is dropped) and only the Sky map, which 2D does not have, closes */
    skyMapOn = false; travelSeq++;
    try { if (window.SLIsland3D && SLIsland3D.remember2D && /perf|lost/.test(String(reason || ''))) SLIsland3D.remember2D(reason); } catch (e) {}
    if (root && document.getElementById('slwStage')) draw();
  }
  function userInfo() { var u = me() || {}; return { name: u.name || '', color: u.color || '#6C5CE7', avatar: u.avatar || '🙂', seed: String(state.activeUser || '').toLowerCase() }; }
  /* R2 (QA2D-3): while the 3D stage boots (its scripts load and compile, the mount and the first draw, no first frame
     yet, or the visited island's own display still building) the main thread is busy for a second or two and a tap is
     answered late: the HUD says so calmly, aria-busy and dimmed (island-pixel.css), no new words, no motion. It starts
     with the boot (maybeBoot3D) and is on screen before the mount holds the page (afterPaint). Its buttons still work: a
     tap runs as soon as the thread is free. It ends at the stage's quiet moment (stage.booting() false) or HUD_BUSY_MAX
     after the mount, and at once if 3D gives up */
  var hudBusy = false, hudBusyT = 0, HUD_BUSY_MAX = 8000;
  /* hudShown: a HUD of the shown island has been on screen (a moment after a draw; cleared on hide). busyPainted: a
     display frame has come since the boot dimmed it */
  var hudShown = false, busyPainted = false;
  function hudBusySync() {
    var hud = root && root.querySelector('.slw-hud');
    if (hud) { if (hudBusy) hud.setAttribute('aria-busy', 'true'); else hud.removeAttribute('aria-busy'); }
  }
  function hudBusyFrom(st) {
    var t0 = Date.now();
    hudBusy = true; hudBusySync();
    if (hudBusyT) clearTimeout(hudBusyT);
    (function poll() {
      hudBusyT = setTimeout(function () {
        hudBusyT = 0;
        var still = stage3d === st && !!root && renderedFor != null && Date.now() - t0 < HUD_BUSY_MAX && (!stageShown || s3('booting') === true);
        if (still) { poll(); return; }
        hudBusy = false; hudBusySync();
      }, 300);
    }());
  }
  /* compat-1 (RELEASE-FIXES, d-island): Safari 15.0-16.3 has WebGL2 but no import maps, so `three` can never load there.
     Without them the 2D island is the island at once and stage.js (and its 3.4 MB of 3D code) is never fetched. Safari
     16.0-16.3 has HTMLScriptElement.supports() but says no to 'importmap'; 15.x has no supports() at all */
  function importMaps() {
    try { return typeof HTMLScriptElement !== 'undefined' && typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('importmap') === true; }
    catch (e) { return false; }
  }
  function maybeBoot3D() {
    if (stage3d || booting3d || use3D === false) return;
    try { if (localStorage.getItem('slNo3D') === '1') { use3D = false; lowPanels(); return; } } catch (e) {}
    if (typeof WebGL2RenderingContext === 'undefined') { use3D = false; lowPanels(); return; }
    if (!importMaps()) { use3D = false; lowPanels(); return; }
    booting3d = true;
    /* R2 (QA2D-3): calm and not ready from the boot's first moment: the 3D scripts compile, then the stage's first build
       holds the page for a second or two, and a HUD that still looked ready then would answer a tap late */
    hudBusy = true; hudBusySync();
    busyPainted = false;
    try { requestAnimationFrame(function () { busyPainted = true; }); } catch (e) {}
    var v = '?v=' + (window.SL_WORLD_VER || '1');
    try { if (localStorage.getItem('slQaMode') === '1') v += '&qa=' + Date.now(); } catch (e) {}
    loadScript('world/island3d/stage.js' + v).then(function () {
      if (!window.SLIsland3D || typeof SLIsland3D.boot !== 'function') return false;
      if (SLIsland3D.remembered && SLIsland3D.remembered(window.SL_WORLD_VER)) return false;
      return SLIsland3D.boot({ ver: window.SL_WORLD_VER, deadlineMs: 8000 });
    }).then(function (ok) {
      if (!ok || typeof SLIsland3D.mount !== 'function') {
        booting3d = false; hudBusy = false; hudBusySync();      /* the 2D island answers at once */
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
      /* the dimmed HUD is on screen before the mount and the first draw hold the page: a HUD the child could already see
         (the late 3D retry; a stage loaded before) waits for a paint of its dimmed look when no frame has come since the
         boot began; a HUD drawn in this same moment (My Island just tapped) is first painted dimmed anyway */
      if (hudShown && !busyPainted) return afterPaint().then(mount3D);
      mount3D();
    }).catch(function () { booting3d = false; use3D = false; hudBusy = false; hudBusySync(); });
  }
  /* the next paint: a frame, then a task after it (a hidden page draws no frames: 120 ms at most) */
  function afterPaint() {
    return new Promise(function (res) {
      var done = false, fin = function () { if (!done) { done = true; setTimeout(res, 0); } };
      try { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fin); } catch (e) {}
      setTimeout(fin, 120);
    });
  }
  /* the stage itself, once the boot is done (its body keeps the indent it had inside maybeBoot3D's promise) */
  function mount3D() {
      booting3d = false;
      if (!root || renderedFor == null || stage3d) { hudBusy = false; hudBusySync(); return; }   /* the island closed meanwhile */
      /* the Sky tour plays on the first My Island open of this page session only, never under reduced motion (D83) */
      var intro = !introDone && !reduced;
      introDone = true;
      stageShown = false; stageShownAt = 0; stageMountedAt = Date.now(); tourOn = intro;   /* the welcome waits for this stage's first frame (and its tour) */
      stage3d = SLIsland3D.mount({ reduced: reduced, user: userInfo(), intro: intro, skyline: intro, on: {
        tapItem: function (uid) { tapItem(uid, null); },
        /* a tap is the day's pat (P4.1); a hungry pet answered softly and the stage showed its bubble, so its voice is
           quieter and there is no heart (P3.3) */
        tapPet: function (petId, o) {
          var hungry = !!(o && o.hungry);
          if (!hungry) s3('emote', 'pet:' + petId, 'heart');
          try { if (window.SLSound) SLSound.make({ muted: function () { var u = me(); return !!(u && u.muted); } }).pet(petId, hungry ? 0.6 : 0.8); } catch (e) {}
          petTapped(petId);                       /* the pat, and island activities' pet moments (IA-5) */
        },
        /* island activities (IA-5): today's visitor → its card; a fetch's throw at a land point or into the sea */
        tapVisitor: function () { if (mode === 'play' && !activity) openVisitor(); },
        tapSea: function (x, z) { fetchThrow(x, z); },
        /* a memory star (the farewell, a grown-up's switch): its memory card in the Memory Book */
        tapStar: function (petId) { if (mode === 'play' && care()) openMemories({ petId: petId }); },
        tapAvatar: function () { s3('emote', 'me', 'wave'); meTapped(); },
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
        tapCell: function (x, y, isle) {
          var pt = arguments[3];                  /* IA-3: the land point of a tap while a play session takes the taps */
          if (mode === 'place' && placing && (isle || 'home') === placing.isle) placeAtCell(x, y);
          else if (mode === 'play' && pt && typeof pt.x === 'number') fetchThrow(pt.x, pt.z);      /* IA-5: a fetch's throw */
        },
        dragStart: function (uid) {
          if (mode !== 'edit') return;
          var f = findPlaced(W(), uid);
          if (f && f.isle === isleNow() && C.isPlaceable(C.item(f.p.id))) startPlacement(f.p.id, f.p.uid, false);
        },
        dragCell: function (x, y, isle) { if (mode === 'place' && placing && (isle || 'home') === placing.isle && (placing.x !== x || placing.y !== y)) { placing.x = x; placing.y = y; drawPlacement(); drawBar(); } },
        dragEnd: function () { if (mode === 'place' && placing && C.canPlace(W(), placing.id, placing.x, placing.y, placing.uid, placing.isle).ok) confirmPlacement(); },
        ready: function () { stageShown = true; var wrap = root && root.querySelector('.slw-stagewrap'); if (wrap) wrap.classList.add('slw-is3d'); stageShownAt = Date.now(); fitStage(); },
        fail: function (reason) { disable3D(reason || 'fail'); }
      } });
      if (!stage3d) { use3D = false; hudBusy = false; hudBusySync(); return; }
      use3D = true;
      hudBusyFrom(stage3d);                       /* still calm and not ready until the stage is quiet (R2) */
      /* a sheet that opened before the stage existed (the welcome, a goal card) still covers it: the stage
         waits to show itself, and the first-open Sky tour plays when the child can see it */
      if (coverCount > 0) s3('setCovered', true);
      if (showtimeOn) s3('showtime', true);
      var at = isleNow();
      if (at !== 'home' && !canTravel()) { if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); } mode = 'play'; selectedUid = null; visitIsle = at = 'home'; }
      endActivity('stage');                       /* a 2D game in play ends: the 3D island takes over (IA-5) */
      draw();
      applyWeather();                             /* the new sky draws the day's weather itself, or the overlay does (IA-5) */
      /* the 2D island may have travelled while 3D was loading: the scene opens on Home, so it lands there at once */
      if (at !== 'home') {
        var seq = ++travelSeq;
        race(s3('visitIsle', at, { instant: true }), 'visitIsle').then(function (ok) { if (seq === travelSeq && !ok) adoptStage('home', false); });
      }
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
    var moods = careMoods(w);
    return {
      world: w,
      placed: w.placed.filter(known).map(placement),
      style: artState(w),
      unlocked: C.unlockedRegions(w),
      /* the crew through the core's crew API: a mascot's land and whether it joined this page session (D112). With pet
         care, the home pets that are not at the Pet Rescue, careRunner's pet the runner, each with its mood (KU9, P3.3) */
      pets: crewOut(w).map(function (p) {
        var it = C.item(p.id), o = { id: p.id, name: p.name, acc: C.wornBy(w, p.id), active: p.active, isle: (it && it.isle) || 'home', fresh: !!freshPets[p.id] };
        if (moods[p.id]) o.mood = moods[p.id].mood;
        return o;
      }),
      avatar: avatarView(w, u),                   /* the classic figure, or the child's character (KU-CH17) */
      /* island activities (IA-5): today's visitor on Home in play mode (never over a feed, a game, the Sky map or travel) */
      visitor: visitorView(w),
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
  /* D-3D (James, 25 Oct: "Name them"): a game's ▶ sign says which game it opens, in 2D and over the 3D island
     (play.sign.<game>); a game with no sign word of its own is named by its item (▶ <name>), never a bare ▶ PLAY.
     The same words are in the bought-a-game card ('look for the ▶ Kart sign'), the legend's example sign and the
     game's spoken label (label in name: 'Penalty Pitch — tap to play Shootout'; island3d / isles-view say the same) */
  var PLAY_SIGN = { course: ['play.sign.course', '▶ Debut Run'], penalty: ['play.sign.penalty', '▶ Shootout'], kart: ['play.sign.kart', '▶ Kart'] };
  function playSign(it) {
    var s = it && Object.prototype.hasOwnProperty.call(PLAY_SIGN, it.game) ? PLAY_SIGN[it.game] : null;
    return s ? String(tx(s[0], null, s[1])) : '▶ ' + ((it && it.name) || 'Play');
  }
  function playTag(it) { return '<span class="slw-tag play">' + esc(playSign(it)) + '</span>'; }
  /* d-3d's copy keys, in world-copy.js word for word since c-copy-core (26 Oct): the island reads the table's words, and
     these fallbacks are the same text for a page without the copy (tests/w3-copy.test.js checks they always match).
     buy.game.look's {sign} is a game's playSign, its ▶ kept with the name on a narrow card */
  var SIGN_WORDS = { legend: ['legend.play', 'tap a game’s sign to play'], look: ['buy.game.look', 'It’s on your island now — look for the {sign} sign.'] };
  function signWords(k, it) {
    var w = SIGN_WORDS[k];
    return String(tx(w[0], null, w[1])).replace('{sign}', function () { return playSign(it).replace(/▶ /, '▶\u00a0'); });
  }
  /* a game's spoken label: what it is, what a tap does and its sign's words (without the ▶) */
  function playLabel(it) {
    var w = playSign(it).replace(/^\s*▶\s*/, '');
    return it.name + ' — tap to play' + (w && w !== it.name ? ' ' + w : '');
  }
  /* HTML labels that float over the 3D items (same markup and classes as 2D) */
  function anchors3D() {
    var w = W(), list = [], k = isleNow();
    visTagAt = false;
    /* the ✎ over you while there is no character (KU-CH17). It steps aside while a game or a show plays, as the 📋 sign
       does (the post-merge QA, 28 Oct: over the house in hide and seek's last round it took the look behind the house,
       and its sheet ended the game); a press on one still on screen waits for the game, as a tap on the figure does */
    if (mode === 'play' && !skyMapOn && !activity && badgeOn(w, me())) {
      var mb = document.createElement('div'); mb.className = 'slw-tag3d';
      mb.innerHTML = '<button type="button" class="slw-mebadge3d" aria-label="' + esc(tx('char.badge')) + '">' + PENCIL() + '</button>';
      mb.querySelector('button').addEventListener('click', function () { if (!activity) openMyChar(); });
      list.push({ el: mb, me: true, dy: 0.12 });
    }
    if (mode === 'play' && !skyMapOn) {
      var showK = showToday();
      C.placedOn(w, k).forEach(function (p) {          /* the visited island's tags only */
        var it = C.item(p.id); if (!it) return;
        var inner = '';
        if (it.act === 'launch') inner += playTag(it);
        else if (handDot(it)) inner += '<span class="slw-dot" aria-hidden="true">✋</span>';
        if (window._slwNew && window._slwNew[p.uid]) inner += '<span class="slw-new">NEW!</span>';
        if (showK === k && it.kind === 'landmark') inner += showTagHtml();            /* the show's island: its landmark (IA-5) */
        if (!inner) return;
        var el = document.createElement('div'); el.className = 'slw-tag3d'; el.innerHTML = inner;
        list.push({ el: el, uid: p.uid });
      });
      /* island activities (IA-5): 📋 Today over Home's house, the visitor's portrait when the stage has no person for it,
         and a patted pet's 🎾 / 🙈 chips */
      var house = k === 'home' ? houseOf(w) : null, sign = house && !activity ? todaySignHtml() : '';
      if (sign) {
        /* the stage keeps its island signs clear of a tag that holds a ▶ sign (island3d tagKind 'play', placed first and
           drawn over the signs): the sign over the house carries an empty, hidden one so the gate signs stand aside too */
        var te = document.createElement('div'); te.className = 'slw-tag3d slw-todaytag'; te.innerHTML = sign + '<span class="slw-tag play" hidden></span>';
        te.querySelector('button').addEventListener('click', function () { if (mode === 'play') openToday(); });
        list.push({ el: te, uid: house.uid, dy: 0.5 });
      }
      var vis = k === 'home' ? visitorNow(w) : null;
      if (vis && visitorTagged()) { list.push({ el: visitorTagEl(vis), visitor: true }); visTagAt = true; }
      var pc = petChipsAt && petChipsAt.who === state.activeUser && Date.now() < petChipsAt.until && !activity ? petChipsEl(petChipsAt.id) : null;
      if (pc) list.push({ el: pc, pet: petChipsAt.id, dy: 0.3 });
    }
    /* a peckish or hungry home pet's badge over it (P4.1), on the island being visited */
    if (mode === 'play' && !skyMapOn && care()) {
      var cm = careMoods(w);
      homeOut(w, k).forEach(function (p) {
        var b = cm[p.id] ? badgeHtml(p.name, cm[p.id]) : '';
        if (!b) return;
        var el = document.createElement('div'); el.className = 'slw-tag3d slw-carebadge3d'; el.innerHTML = b;
        list.push({ el: el, pet: p.id, dy: 0.06 });
      });
    }
    if (mode === 'play') C.ISLE_ORDER.forEach(function (ik) { var sg = signEl(w, ik, k); if (sg) list.push({ el: sg, isle: ik }); });
    if (k !== 'home') return list;                     /* Home's locked-region signs show on Home only */
    var unlocked = {}; C.unlockedRegions(w).forEach(function (r) { unlocked[r] = 1; });
    Object.keys(C.REGIONS).forEach(function (rk) {
      var R = C.REGIONS[rk]; if (!R.unlock || unlocked[rk]) return;
      var it = C.item(R.unlock);
      var el = document.createElement('div'); el.className = 'slw-tag3d';
      el.innerHTML = '<button type="button" class="slw-sign" data-land="' + it.id + '">🔒 ' + esc(R.name) + '<br>' + esc(freeOr(priceOf(it))) + '</button>';
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
    syncStars();
    return !!stage3d;
  }
  /* sheets pause the 3D render (the last frame stays behind the backdrop) */
  function cover(delta) {
    coverCount = Math.max(0, coverCount + delta);
    s3('setCovered', coverCount > 0);
  }
  /* shop/sheet icons: a 3D photocard when available, the SVG otherwise (a character or a piece: SLPeopleArt's) */
  function iconHtml(id, st) {
    var it = C.item(id), pst = st;
    if (isPeople(it)) return peopleIconHtml(id);
    /* a pet food is a 2D picture, never a photocard (KU37) */
    if (it && it.kind === 'food') { var AP = window.SLWorldArtPets; return AP && typeof AP.foodIcon === 'function' ? AP.foodIcon(id) : ''; }
    if (it && it.kind === 'acc') {            /* accessories preview on the child's own runner (a mascot too) */
      var w = W(), run = w && runnerId(w);
      pst = Object.assign({}, st || {}, { pet: run, acc: run ? C.wornBy(w, run) : {} });
    }
    return '<span class="slw-pc" data-pc="' + esc(id) + '"' + (pst ? ' data-st="' + esc(JSON.stringify(pst)) + '"' : '') + '>' + ART.icon(id, st) + '</span>';
  }
  function fillPhotocards(el) {
    fillPeople(el);                           /* the people pictures come with their files (KU21) */
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
    endActivity('travel');                                            /* a game or a show stays on its island (IA-5) */
    /* a forced trip (a purchase, Take, Undo) never carries a half-done placement to another island */
    if (placing && placing.isle !== k) endPlacement(placing.fromBuy ? 'play' : 'edit');
    var seq = ++travelSeq, from = isleNow(), fromMap = skyMapOn;
    if (from !== k) nextLeft = from;                           /* the Next step card offers no visit straight back (d-island) */
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
    syncNext();                                   /* d-island: the Next step card's ideas are this island's now */
    announce(tx(open ? 'isle.arrived' : 'isle.arrivedLocked', { island: isleName(k) }));
    if (!open && mode !== 'play') { if (placing) endPlacement('play'); else { mode = 'play'; draw(); } toast(tx('isle.locked')); return; }
    if (open && k !== 'home' && !w.tutSeen['isle:' + k] && !document.querySelector('.slw-cele')) firstVisit(k);
    if (open && mode === 'play') arrivedActs(k);       /* island activities (IA-5): the visit stamp, the passport, a visit wish */
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
    if (on) { endActivity('map'); noteFind({ kind: 'map', isle: 'home' }); }   /* the Sky map stamp (IA-5) */
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
    visitIsle = 'home'; skyMapOn = false; travelSeq++; lmBusy = {}; nextLeft = null;
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
    /* a preview visit is 'here' AND locked: the state class alone, the lock on the icon. Island activities (IA-5): the day's
       show island wears a 'Show today' pill */
    var showK = showToday(), pill = tx('act.show.pill');
    UI.chips(C, w, k, { t: tx, trial: trial(), skyMap: skyMapOn }).forEach(function (c) {
      var sh = showK === c.isle && !c.locked;
      html += '<li><button type="button" class="slw-islechip ' + c.state + (c.isNew ? ' new' : '') + '" data-isle="' + c.isle + '" data-fk="isle:' + c.isle + '" aria-label="' + esc(c.aria + (sh ? '. ' + pill : '')) + '"' +
        (c.state === 'here' ? ' aria-current="location"' : '') + off + '><span class="ic">' + ART.isleIcon(c.isle, { locked: c.locked }) + '</span><span class="tx">' + esc(c.short) + '</span>' +
        (c.isNew ? '<span class="slw-chipnew" aria-hidden="true">' + esc(tx('isle.chipNew')) + '</span>' : '') + (sh ? '<span class="slw-chipshow" aria-hidden="true">' + esc(pill) + '</span>' : '') + '</button></li>';
    });
    return html + '</ul>' + hereHtml(w, k) + '</nav>';
  }
  /* the here row's 📚 Learn (a learn-and-come-back trip for the land): a locked island the child is looking at, in play
     mode, with real prices, short of its land → the land's id, else null (d-island: the HUD's Learn and the Next step
     card's 📚 Learn idea give way to it) */
  function hereLearn() {
    var w = W(), k = isleNow();
    if (!w || skyMapOn || k === 'home' || mode !== 'play' || trial() || C.isleUnlocked(w, k)) return null;
    var land = C.item(C.ISLES[k].unlock), u = me(), ls = land && u ? iState(u, land.id) : null;
    return ls && ls.state === 'short' ? land.id : null;
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
      /* R2 (QA2A-16): 'Unlock for 🪙 2,400' only when the child can afford it; short of it, the card's own 'Need N more 🪙'
         and '📚 Learn' (a learn-and-come-back trip for the land), never a big green button that looks buyable */
      var ls = land && !trial() ? iState(me(), land.id) : null;
      html += '<span class="st">' + esc(tx('isle.lockedHint')) + '</span>' + (!land ? ''
        : ls && ls.state === 'short' ? '<span class="slw-need">' + esc(needLine(ls.need)) + '</span>' + learnBtnHtml(land.id, 'here')
        : '<button type="button" class="slw-buy" data-act="isle-unlock" data-land="' + land.id + '" data-fk="here:unlock">' +
          lbl('lock', trial() ? tx('isle.unlockFree') : tx(coinsOn() ? 'isle.unlockForCoins' : 'isle.unlockFor', { price: fmt(priceOf(land)) })) + '</button>');
    }
    return html + '<button type="button" class="slw-btn" data-act="isle-home" data-fk="here:home">' + lbl('home', tx('isle.back')) + '</button></div>';
  }
  function wireIsleBar(nav, keepScroll) {
    nav.querySelectorAll('.slw-islechip').forEach(function (b) { b.addEventListener('click', onChip); });
    nav.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', onHudAction); });
    nav.querySelectorAll('[data-learn]').forEach(function (b) { b.addEventListener('click', function () { startTrip(b.getAttribute('data-learn'), 'card'); }); });
    var strip = nav.querySelector('.slw-islechips');
    if (!strip) return;
    strip.addEventListener('keydown', chipKeys);
    if (keepScroll) strip.scrollLeft = keepScroll;
    showChip(strip, strip.querySelector('.here') || strip.querySelector('[aria-pressed="true"]'));
    wireEdges(strip);                        /* R2: an arrow at the end with more islands to see (phones) */
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
    /* the here row's own 📚 Learn came or went (d-island): the card gives way to it or comes back, the HUD's follows */
    if (nextEnv && nextCard && !!nextEnv.learnHere !== !!hereLearn()) syncNext(); else syncLearn();
    fitStage();                          /* the here row comes and goes: the stage's top moves */
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
  /* focus survives a redraw: the focused element's data-fk, found again in the new markup. A card button with no
     key of its own (a character's Play as, a piece's Wear) is found again by its action and its item id */
  var FK_ACTS = ['data-pplay', 'data-pwear', 'data-buy', 'data-goal'];
  function focusKey(scope) {
    var a = document.activeElement;
    if (!(a && a !== document.body && scope && scope.contains(a) && a.getAttribute)) return null;
    var k = a.getAttribute('data-fk');
    for (var i = 0; !k && i < FK_ACTS.length; i++) { var v = a.getAttribute(FK_ACTS[i]); if (v) k = '@' + FK_ACTS[i] + '=' + v; }
    return k || null;
  }
  function refocus(scope, fk) {
    var m = /^@([\w-]+)=(.+)$/.exec(String(fk));
    var el = scope && scope.querySelector(m ? '[' + m[1] + '="' + m[2] + '"]' : '[data-fk="' + fk + '"]');
    if (!el || el.disabled) return false;
    try { el.focus({ preventScroll: true }); } catch (e) { return false; }
    return true;
  }
  /* 3D island signs (D55): one per island; the stage pins it to Home's gate pad, a land's dock or the Sky
     map, shows none for the island you are on (all six on the map) and none in edit or place mode */
  function signEl(w, ik, k) {
    /* the Sky map's sign for the island you are on says so in the chip's words (a locked preview: looking around, A5) */
    var you = skyMapOn && ik === k, UI = window.SLIslesUI, s = UI && UI.lockSign(C, w, ik, { t: tx, trial: trial(), here: you });
    if (!s) return null;
    var open = C.isleUnlocked(w, ik), u = me() || {};
    /* test mode's price word is the shop's one word, 'Free' (wardrobe.free; R2, QA2A-12), never the isles UI's 'FREE' */
    var free = tx('wardrobe.free'), pt = s.priceText && trial() && !open ? free : s.priceText, aria = trial() ? String(s.aria || '').replace(/\bFREE\b/g, free) : s.aria;
    var el = document.createElement('div'); el.className = 'slw-tag3d';
    /* island activities (IA-5): a land whose book page is complete has its explorer flag by its bridge (never sold) */
    var flag = open && ik !== 'home' && pageDone(w, ik) ? '<span class="slw-flagmark" aria-hidden="true">🚩</span>' : '';
    el.innerHTML = '<button type="button" class="slw-sign isle' + (open ? ' open' : '') + (k === 'home' && !skyMapOn ? ' gate' : '') + '" data-isle="' + ik + '" aria-label="' +
      esc(aria) + '">' + (open ? flag : ico('lock')) + '<span class="nm">' + esc(s.short) + (open && !you ? ' ›' : '') + '</span>' +
      (you ? '<span class="pr">' + esc((u.avatar || '🙂') + ' ' + tx('isle.you')) + '</span>' : pt ? '<span class="pr">' + esc(pt) + '</span>' : '') + '</button>';
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
  try { window.addEventListener('resize', function () { if (narrowQueued) return; narrowQueued = true; setTimeout(function () { narrowQueued = false; syncNarrow(); fitStage(); rowEdges(root && root.querySelector('.slw-islechips')); }, 150); }); } catch (e) {}
  /* ---------------- the stage fits the window (E2) ---------------- */
  /* the 3D stage is never taller than the window below it, so the front lawn (the starter pet, the child) is on
     screen when My Island opens: --slw-fit = the window's height − the stage's top on the page − FIT_GAP (its
     frame and lip), and the camera refits to the new size. Where even the stage's minimum does not fit (phones:
     the app's header and tabs fill the top) the page may lift the island, never further than the HUD's top
     reaching the app's sticky header, and a real open (open = true) or a row that comes above the stage (the here
     row, QA#8) scrolls by that much (never back up, never on a plain redraw). Measured on every draw, a resize,
     the 3D stage's first frame, the here row and the fonts */
  var FIT_GAP = 10, openFit = false, fitWas = null, fitTop = null;
  function fitStage(open) {
    var stage = root && $('#slwStage', root), vh = window.innerHeight || 0, cs = window.getComputedStyle;
    if (!stage || !vh || !stage.getBoundingClientRect || !cs) return;
    var sr = stage.getBoundingClientRect();
    if (!sr.width && !sr.height) return;                    /* the island tab is hidden: nothing to measure */
    var y = window.pageYOffset || 0, top = sr.top + y;
    var hud = $('.slw-hud', root) || $('.slw', root), hd = document.querySelector('header.topbar');
    var hdH = hd && /sticky|fixed/.test(cs(hd).position) ? hd.getBoundingClientRect().height : 0;
    var lift = Math.max(0, Math.floor((hud ? hud.getBoundingClientRect().top + y : top) - hdH - 2));   /* the HUD stays whole, just under the header */
    /* the 3D stage's own minimum; before the 3D stage shows, the one it will have (phones held upright: 340px) */
    var is3d = /\bslw-is3d\b/.test((stage.parentNode && stage.parentNode.className) || '');
    var phone = !!(window.matchMedia && window.matchMedia('(orientation: portrait) and (max-width: 700px)').matches);
    var min = is3d ? parseFloat(cs(stage).minHeight) || 0 : phone ? 340 : 260;
    /* placing a thing (QA#3): the stage leaves room under it for the placement bar (Put it here / Keep it for later) */
    var bar = mode === 'place' ? $('#slwBar', root) : null, room = bar && bar.offsetHeight ? bar.offsetHeight + 16 : 0;
    var r = stageFit(vh - room, top, lift, min), v = Math.round(r.fit) + 'px';
    if (v !== fitWas) { fitWas = v; try { root.style.setProperty('--slw-fit', v); } catch (e) {} }
    /* QA#8: a row that comes above the stage (a sky island's here row, a HUD row) pushes it down: the page follows
       as an open does, only as far as the whole stage (its recentre button too) needs, never past the HUD's lift */
    var pushed = fitTop != null && top > fitTop + 1; fitTop = top;
    if ((open || pushed) && r.scroll > y + 4) try { window.scrollTo({ top: r.scroll, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) {}
  }
  /* → {fit, scroll}: the stage's cap and the page scroll that shows all of it — none when it fits at its minimum
     below where it is, else lifted by at most `lift` */
  function stageFit(vh, top, lift, min) {
    var fit = vh - top - FIT_GAP;
    if (fit >= min) return { fit: fit, scroll: 0 };
    var lifted = Math.max(min, vh - (top - lift) - FIT_GAP);
    return { fit: lifted, scroll: Math.min(lift, Math.max(0, Math.ceil(top + lifted + FIT_GAP - vh))) };
  }
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitStage(); }); } catch (e) {}
  /* a just-bought placeable goes to the island it may stand on (D18): here when it fits here,
     else Home for a V4.54 thing, else its own island — travelling there first */
  function placeBought(it, quiet) {
    var UI = window.SLIslesUI, k = isleNow();
    var target = UI ? UI.placeTarget(C, W(), it.id, k) : (C.isV3(it) ? it.isle : 'home');
    if (!target) return;
    /* QA#3: the shop (and an item sheet over it) close, so the placement bar is what the child sees; 'Placed.' then
       offers Back to the shop, on the same land, scroll and card (shopSnap; a goal's card stays up) */
    var back = shopSnap ? shopSnap() : shopLast;
    closeSheets();
    var place = function (at) { startPlacement(it.id, null, true, at); if (placing && placing.id === it.id && !placing.uid) placing.back = back; };
    if (target === k) { if (!quiet) toast(it.name + ' is yours. Pick a spot.'); place(k); return; }
    toast(C.isV3(it) ? tx('isle.wrongIsle', { island: isleName(target) }) : tx('isle.homeOnly'));
    goIsle(target, { force: true }).then(function (ok) {
      if (ok && isleNow() === target) place(target);
      else toast(tx('edit.stored'));                    /* it waits in the bag; nothing is lost */
    });
  }
  /* the sheets only (a celebration card stays up); the stage is uncovered once nothing covers it */
  function closeSheets() {
    document.querySelectorAll('.slw-ov').forEach(function (o) { if (o._close) o._close(); else o.remove(); });
    if (!document.querySelector('.slw-ov, .slw-cele')) { coverCount = 0; s3('setCovered', false); }
  }
  /* QA#3: a just-bought thing's placement bar comes into view (the 3D stage already left room for it, fitStage) */
  function showPlaceBar() {
    var bar = root && $('#slwBar .slw-bar', root), vh = window.innerHeight || 0;
    if (!bar || !vh || typeof window.scrollTo !== 'function' || !bar.getBoundingClientRect) return;
    var r = bar.getBoundingClientRect();
    if (r.height && r.bottom > vh - 8) try { window.scrollTo({ top: (window.pageYOffset || 0) + r.bottom - vh + 12, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) {}
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
    if (!again && !keep) openFit = true;          /* a real open may lift the island into view (kept through the starter grant) */
    root = document.getElementById('worldView');
    if (!root) return;
    injectCss();
    /* a real open starts on Home; a refresh of the same child (another tab saved) stays where it was */
    if (!again && !keep) { resetIsle(); petTurn++; }       /* the Home crew's rotation steps once per open (D97) */
    if (!again && !keep) nextOpens++;                     /* and the Next step card's turn (d-island) */
    if (!again && !keep) openPending = true;              /* the island-open queue runs once per real open (KU13) */
    if (!again && !keep) careOpen = kidDue = true;        /* and the pets' island day (P4.1) */
    if (!again && !keep) { dayOpen = wxDue = true; daysMemo = null; }   /* and the island day's count and weather (IA-5) */
    if (!again) metaOpen = true;                          /* the goal's saved name and price, after any open commit (R2; IA-5) */
    loadNextStep();                                       /* the Next step card's rules (wave 3; the goal bar until they are in) */
    loadIslandDays();                                     /* island activities' day rules (IA-5; nothing new shows until they are in) */
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
    /* the pets' island day (P4.1; pets.json care.careStep): after the repair and before the first draw, once per real
       open, the grown-up's settings and the day's step in one commit; its card or toast comes with the queue. Island
       activities (IA-5): the same commit counts the island day (C.countIslandDay, with its own due check), also
       without pet care */
    if (careOpen || dayOpen) {
      var dueCare = careOpen && careQueue() && careDue(w), dueDay = dayOpen && dayDue(w);
      careOpen = dayOpen = false;
      if (dueCare || dueDay) {
        var who = state.activeUser;
        commit(function (fu) { return openStep(fu, dueCare, dueDay); }).then(function (res) { careDone(who, res); render(true); }, function () { render(true); });
        root.innerHTML = '<div class="slw-loading">Building your island…</div>';
        return;
      }
    }
    /* a character goal's saved name and price, as index.html's 'Saving for…' line reads them, put right once (R2) */
    if (metaOpen) { metaOpen = false; if (goalMetaStale(w)) commit(function (fu) { return { ok: goalMeta(C.ensureWorld(fu)) }; }); }
    if (dispose3dTimer) { clearTimeout(dispose3dTimer); dispose3dTimer = 0; }
    draw();
    fitStage(openFit); openFit = false;
    if (wxDue) { wxDue = false; applyWeather(); }         /* the day's weather as the island opens, never mid-visit (IA-5) */
    if (!running) s3('resume');          /* never pull the shared canvas out from under a game */
    maybeIntro();
    var goalCard = checkGoalReached(true);                /* 'Goal reached' is this open's one unasked card (R2) */
    if (kidDue) { kidDue = false; readKidPets(); }
    if (openPending) { openPending = false; startOpenQueue({ cards: goalCard ? 1 : 0 }); }
    if (charInfo(w, u) && !peopleArt()) wantPeople();    /* a character to draw: its files come now (KU21) */
    measureServerTime();
    maybeBoot3D();
  }

  function draw() {
    if (!root) return;
    var u = me(); if (!u) return;
    var w = C.ensureWorld(u);
    renderedFor = state.activeUser;
    if (!hudShown) setTimeout(function () { if (renderedFor != null && root) hudShown = true; }, 0);
    stopPets();
    var is3d = !!(use3D && stage3d), fk = focusKey(root);    /* the HUD button, chip or here-row button that had focus */
    /* the Next step card first: while it shows its own 📚 Learn the HUD's hides (d-island: never three Learn buttons
       with the top bar's) */
    var nx = nextHtml(u);
    root.innerHTML =
      '<div class="slw' + (mode !== 'play' ? ' slw-edit' : '') + (showtimeOn || (!is3d && Date.now() < encoreUntil) ? ' showtime' : '') + '">' +
        '<div class="slw-hud"' + (hudBusy && (is3d || booting3d) ? ' aria-busy="true"' : '') + '>' +
          '<button class="slw-learn" type="button" data-act="learn" data-fk="hud:learn"' + (hudLearnTo() ? ' hidden' : '') + '>' + esc(tx('learn.go')) + '</button>' +
          '<div class="slw-pts" title="' + esc(balTitle()) + '">' + SYM() + ' <span id="slwPts">' + fmt(balOf(u)) + '</span></div>' +
          nx +
          /* R2 (QA2B-1): music, sound and ❓ are one compact group of icon squares beside the Next step card (the HUD keeps
             two rows on an iPad held sideways); the two toggles say what they switch (Music, Sound) and whether it is on
             (aria-pressed), never two buttons that both just say 'On' */
          '<span class="slw-togs">' +
            '<button class="slw-btn slw-tog" type="button" data-act="music" data-fk="hud:music" aria-pressed="' + musicOn() + '" aria-label="Music" title="Music">' + musicIco() + '</button>' +
            '<button class="slw-btn slw-tog" type="button" data-act="sound" data-fk="hud:sound" aria-pressed="' + !u.muted + '" aria-label="Sound" title="Sound">' + soundIco(u.muted) + '</button>' +
            '<button class="slw-btn slw-tog" type="button" data-act="info" data-fk="hud:info" aria-label="Help" title="Help"><span aria-hidden="true">❓</span></button>' +
            /* c-island: on a phone up to 400px wide, sound and ❓ fold into one ⋯ square (island-pixel.css), so 📚 Learn,
               🪙 (even 9,999), music and ⋯ share row 1 and the whole 3D stage fits a 360 × 740 phone */
            '<button class="slw-btn slw-tog slw-more" type="button" data-act="more" data-fk="hud:more" aria-haspopup="dialog" aria-label="' + esc(MORE_NAME) + '" title="' + esc(MORE_NAME) + '"><span aria-hidden="true">⋯</span></button>' +
          '</span>' +
          '<div class="slw-acts">' +
            '<button class="slw-btn big" type="button" data-act="shop" data-fk="hud:shop">' + lbl('shop', 'Island Shop') + '</button>' +
            '<button class="slw-btn big" type="button" data-act="games" data-fk="hud:games">' + lbl('games', 'Games') + '</button>' +
            '<button class="slw-btn' + (mode === 'edit' ? ' on' : '') + '" type="button" data-act="edit" data-fk="hud:edit" aria-pressed="' + (mode === 'edit') + '">' + lbl('edit', mode === 'edit' ? 'Done' : 'Edit') + '</button>' +
            '<button class="slw-btn" type="button" data-act="pets" data-fk="hud:pets">' + lbl('crew', tx('label.crew')) + '</button>' +
            (PC() && peopleReachable() ? '<button class="slw-btn" type="button" data-act="char" data-fk="hud:char">' + ME_ICO + ' ' + esc(tx('char.my')) + '</button>' : '') +
            '<button class="slw-btn" type="button" data-act="showtime" data-fk="hud:light"' + (showtimeOn ? ' data-on="1"' : '') + ' aria-label="' + lightAria() + '">' + lightLabel() + '</button>' +
          '</div>' +
        '</div>' +
        isleBarHtml() +
        '<div class="slw-stagewrap' + (is3d ? ' slw-is3d' : '') + '"><div class="slw-stage" id="slwStage"></div></div>' +
        '<div class="slw-pan" aria-hidden="true">Swipe the island sideways to see it all</div>' +
        '<div id="slwBar"></div>' +
        /* d-3d: the legend's example sign is one every child has (the starter course's), and says what a sign is for
           (legend.play: SIGN_WORDS) */
        '<div class="slw-legend"><span><i style="background:#ffd23f;color:#4a3200;">' + esc(playSign(C.item('att_course'))) + '</i> ' + esc(signWords('legend')) + '</span>' +
          '<span><i style="background:#fff;border:2px solid #6c5ce7;">✋</i> tap to play with it</span>' +
          '<span><i style="background:#4a4468;color:#fff;">🔒</i> unlock in the Island Shop</span>' +
          '<span>Everything else is just for looks</span></div>' +
      '</div>';
    syncNarrow();
    drawStage();
    drawBar();
    drawActs();                          /* island activities (IA-5): the play strip, the 'playing' look, the 3D weather overlay */
    islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
    fillPhotocards(root.querySelector('.slw-goal'));
    frame2d();
    root.querySelectorAll('.slw-hud [data-act]').forEach(function (b) { b.addEventListener('click', onHudAction); });
    var nav = root.querySelector('.slw-isles'); if (nav) wireIsleBar(nav);
    syncEdit();
    wireGoal(root.querySelector('.slw-goal'));
    if (fk === 'hud:learn' && hudLearnTo()) fk = hudLearnTo();   /* the HUD's Learn hid: the card's own, or the here row's (d-island) */
    if (fk) refocus(root, fk);
    fitStage();                          /* the HUD may have changed its rows (Edit / Done, the goal) */
  }
  function goalTap() { var gid = C.goalId(W()); if (gid) openItem(gid); else openShop(); }

  /* the light toggle names what it switches to (D14): 'Daytime' while Showtime is on, else 'Showtime' */
  function lightLabel() { return showtimeOn ? lbl('sun', tx('light.day')) : lbl('moon', tx('light.showtime')); }
  function lightAria() { return esc(showtimeOn ? tx('light.toDay') : tx('light.toShow')); }
  /* the music and sound toggles' pictures (their aria-labels and aria-pressed say the rest; music off wears a slash) */
  function musicIco() { return '<span class="slw-togic" aria-hidden="true">' + (ico('music') || '🎵') + '</span>'; }
  function soundIco(muted) { return '<span class="slw-togic" aria-hidden="true">' + (muted ? '🔇' : '🔊') + '</span>'; }
  /* sound on / off (the child's own u.muted, as the app's mute button): the HUD's 🔊 square and the ⋯ sheet's Sound
     button both come here, and the square is put right whichever was tapped → muted now */
  function flipSound() {
    var u = me(); if (!u) return null;
    u.muted = !u.muted; saveState();
    try { if (typeof renderMuteBtn === 'function') renderMuteBtn(); } catch (er) {}
    var sq = root && root.querySelector('.slw-hud [data-act="sound"]');
    if (sq) { sq.innerHTML = soundIco(u.muted); sq.setAttribute('aria-pressed', String(!u.muted)); }
    if (!u.muted) sfx('correct');
    return u.muted;
  }
  /* c-island: the ⋯ square on a narrow phone (island-pixel.css shows it at 400px and less, in place of sound and ❓):
     a small card with the same two controls, Sound (on / off, aria-pressed, as the square) and Help (the ❓ card) */
  var MORE_NAME = 'Sound and help';
  function openMore() {
    var u = me(); if (!u) return null;
    var ov = overlay('<h2>' + esc(MORE_NAME) + '</h2>' +
      '<div class="slw-morelist" style="display:flex;flex-direction:column;gap:10px;">' +
        '<button class="slw-btn big" type="button" id="slwMoreSound" aria-pressed="' + !u.muted + '">' + soundWords(u.muted) + '</button>' +
        '<button class="slw-btn big" type="button" id="slwMoreHelp">' + esc('❓ How My Island works') + '</button>' +
      '</div>', { small: true, cls: 'slw-moresheet' });
    var sb = $('#slwMoreSound', ov);
    sb.addEventListener('click', function () {
      var m = flipSound(); if (m == null) return;
      sb.innerHTML = soundWords(m); sb.setAttribute('aria-pressed', String(!m));
    });
    $('#slwMoreHelp', ov).addEventListener('click', function () { ov._close(); openInfo(); });
    return ov;
  }
  /* the sheet's Sound button: its picture says on or off, its name stays 'Sound' (aria-pressed says the rest) */
  function soundWords(muted) { return '<span aria-hidden="true">' + (muted ? '🔇' : '🔊') + '</span> Sound'; }
  function goalHtml(u) {
    if (trial()) return '<div class="slw-goal slw-trial" role="note"><span class="gt">' + (coinsOn() ? esc(tx('coins.goal.trial')) : 'Test mode: everything on the island is free. Your ⭐ stay put.') + '</span></div>';
    var gp = C.goalProgress(u);
    if (!gp) return '<button class="slw-goal" type="button"><span class="gt">' + lbl('goal', 'Pick a savings goal in the Island Shop') + '</span></button>';
    /* a pet goal the pet cap shuts out (goalProgress full, A4): never 'Ready', the cap instead; its sheet has the Pet Corner */
    var ready = gp.ready && !gp.full;
    return '<button class="slw-goal' + (ready ? ' ready' : '') + '" type="button" aria-label="Savings goal: ' + esc(gp.name) + '">' +
      '<span class="gi">' + iconHtml(gp.id, artState(C.ensureWorld(u))) + '</span>' +
      '<span style="flex:1;min-width:0;"><span class="gt">' + (gp.full ? '🎯 ' + esc(gp.name) + ' · ' + esc(capChip(C.petRoom ? C.petRoom(C.ensureWorld(u)) : null)) : ready ? 'Ready: you can buy ' + esc(gp.name) : '🎯 ' + esc(gp.name) + ' · ' + fmt(gp.have) + ' / ' + fmt(gp.price) + ' ' + SYM()) + '</span>' +
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
    var interactive = mode !== 'play' || !!it.act || shakeable(it);      /* a Home tree shakes (island activities, IA-5) */
    var tag = '';
    if (mode === 'play' && it.act === 'launch') tag = playTag(it);
    else if (mode === 'play' && handDot(it)) tag = '<span class="slw-dot" aria-hidden="true">✋</span>';
    if (mode === 'play' && it.kind === 'landmark' && showToday() === isleNow()) tag += showTagHtml();   /* the day's show (IA-5) */
    /* NEW! sits on the item's base (sprite boxes are taller than short art); games keep it on top, clear of the ▶ sign */
    var newBadge = (window._slwNew && window._slwNew[p.uid]) ? '<span class="slw-new' + (it.act === 'launch' ? '' : ' base') + '">NEW!</span>' : '';
    var label = it.act === 'launch' ? playLabel(it) : it.name + (it.act ? ' — tap to play with it' : '');
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
  /* you: a little figure in your own colour (feet on the given point, in units); with a character, that
     character in 2D (SLPeopleArt.figure, the same 70 × 110 box), and the ✎ while there is none yet (KU-CH17) */
  function meHtml(u, mx, my, z) {
    var w = C.ensureWorld(u), ci = charInfo(w, u), A = peopleArt(), fig = '', badge = mode === 'play' && badgeOn(w, u);
    if (ci && A && typeof A.figure === 'function') { try { fig = A.figure(ci, { color: u.color || '#6C5CE7' }) || ''; } catch (e) { fig = ''; } }
    if (ci && !fig && !A) wantPeople();
    return '<button type="button" class="slw-me' + (fig ? ' person' : '') + '" style="left:' + pct(mx, STAGE_W) + ';top:' + pct(my, STAGE_H) + ';z-index:' + z + ';" aria-label="That’s you!' + (badge ? ' ' + esc(tx('char.badge')) : '') + '">' +
      (fig || '<svg viewBox="0 0 70 110"><ellipse cx="35" cy="104" rx="20" ry="5" fill="rgba(40,30,60,.18)"/><path d="M18 102 L22 58 Q35 48 48 58 L52 102 Z" fill="' + esc(u.color || '#6c5ce7') + '" stroke="#3b2f4a" stroke-width="3" stroke-linejoin="round"/><circle cx="35" cy="30" r="24" fill="#fff" stroke="#3b2f4a" stroke-width="3"/></svg>' +
      '<span class="face">' + esc(u.avatar || '🙂') + '</span>') + (badge ? '<span class="slw-mebadge" aria-hidden="true">' + PENCIL() + '</span>' : '') + '</button>';
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
    /* island activities (IA-5): a completed book page's explorer flag by the bridge (HTML, never an item) */
    if (d.dock.length && pageDone(W(), k)) html += '<div class="slw-flag2d" aria-hidden="true" style="left:' + pct((d.dock[0][0] + o.ox) * 100 + 70, STAGE_W) + ';top:' + pct(PAD + (d.dock[0][1] + o.oy) * CH - 40, STAGE_H) + ';">🚩</div>';
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
  /* a locked island: one block with its name and price (Free while we test) → the land's sheet */
  function lockHtml(k) {
    var land = C.item(C.ISLES[k].unlock); if (!land) return '';
    var name = tx('isle.unlockName', { island: isleName(k) }), price = freeOr(priceOf(land));
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
        html += '<button type="button" class="slw-sign" data-land="' + it.id + '" style="' + (onLeft ? 'left:1%;' : 'left:auto;right:1%;') + 'transform:translate(0,-50%);top:' + pct(PAD + (sy / rc.length + 0.5) * CH, STAGE_H) + ';">🔒 ' + esc(R.name) + '<br>' + esc(freeOr(priceOf(it))) + '</button>';
      });
      /* you, beside the house */
      var house = w.placed.filter(function (p) { return p.id === 'house_cottage'; })[0];
      if (house) html += meHtml(u, house.x * 100 - 62, PAD + (house.y + 2) * CH - 110, 10 + (house.y + 2) * 10 + 4);
      html += stars2dHtml(w);                          /* the memory stars: Home's night sky (pets U11; shown at Showtime) */
      /* island activities (IA-5): 📋 Today over the house and today's visitor by its door (play mode) */
      if (mode === 'play') html += today2dHtml(w, st) + (visitorNow(w) ? visitor2dHtml(w, visitorNow(w)) : '');
    } else if (open && C.ISLES[k].dock.length && mode !== 'place') {
      /* you, on the bridge landing (you came over the bridge); while placing, the landing's own square shows instead */
      var dk = C.ISLES[k].dock[0], dx = dk[0] + o.ox, dy = dk[1] + o.oy;
      html += meHtml(u, dx * 100 + 15, PAD + (dy + 1) * CH - 110, 10 + (dy + 1) * 10 + 4);
    }
    stage.innerHTML = html + wxHtml() + '<div id="slwPets"></div><div id="slwPlace"></div>';    /* + the day's weather (IA-5) */
    stage.querySelectorAll('[data-uid]').forEach(wireObj);
    stage.querySelectorAll('[data-today]').forEach(function (el) { el.addEventListener('click', function () { if (mode === 'play') openToday(); }); });
    stage.querySelectorAll('.slw-visitor2d').forEach(function (el) { el.addEventListener('click', function () { if (mode === 'play' && !activity) openVisitor(); }); });
    stage.querySelectorAll('[data-land]').forEach(function (el) { el.addEventListener('click', function () { openItem(el.dataset.land); }); });
    stage.querySelectorAll('[data-isle2d]').forEach(function (el) { el.addEventListener('click', function () { goIsle(el.dataset.isle2d); }); });
    stage.querySelectorAll('[data-star]').forEach(function (el) { el.addEventListener('click', function () { if (mode === 'play') openMemories({ petId: el.dataset.star }); }); });
    var meEl = stage.querySelector('.slw-me');
    if (meEl) meEl.addEventListener('click', function () { meEl.classList.remove('wave'); void meEl.offsetWidth; meEl.classList.add('wave'); fx(meEl, '✦'); meTapped(); });
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
    if (care()) return homeOut(w, k);                  /* with pet care: the home pets only (KU9) */
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
  function petVoice(id, vol) {
    var S = window.SLSound;
    try { if (S && S.make) { S.make({ muted: function () { var u = me(); return !!(u && u.muted); } }).pet(id, vol || 0.8); return; } } catch (e) {}
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
    var cm = careMoods(w);
    pets.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slw-pet';
      b.setAttribute('data-pet', p.id);
      b.setAttribute('aria-label', p.name + ' the ' + C.item(p.id).name.toLowerCase() + (p.active ? ' (runs your Debut Run)' : ''));
      /* a hungry pet wears its badge and moves at 0.6× (pets U13) */
      var frame = 0, worn = C.wornBy(w, p.id), c = cm[p.id], slow = c && c.mood.hunger >= 2 ? 0.6 : 1;
      b.innerHTML = '<span class="nm">' + esc(p.name) + (p.active ? ' 🏅' : '') + '</span>' + ART.pet(p.id, { acc: worn, frame: 0 }) + (c ? badgeHtml(p.name, c) : '');
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
        petVoice(p.id, slow < 1 ? 0.6 : 0.8);
        petTapped(p.id);                               /* the day's pat (P4.1) and island activities' pet moments (IA-5) */
      });
      host.appendChild(b);
      function wander() {
        if (!document.body.contains(b)) return;
        if (b.classList.contains('slw-eat') || b.classList.contains('slw-busy')) { petTimers.push(setTimeout(wander, 1500)); return; }   /* eating, or in a game (IA-5): stays put */
        var target = roam[Math.floor(Math.random() * roam.length)].split(',');
        var tx = +target[0], ty = +target[1];
        var dist = Math.hypot(tx - pos.x, ty - pos.y);
        b.classList.toggle('flip', tx < pos.x);
        var dur = Math.max(0.8, dist * 0.7) / slow, y0 = pos.y, t0 = Date.now();
        placeAt(tx, ty, reduced ? 0 : dur, !reduced);
        var walk = setInterval(function () {
          if (!document.body.contains(b)) { clearInterval(walk); return; }
          /* depth follows the row the pet is crossing right now, so it walks
             behind the house instead of over its roof */
          var f = Math.min(1, (Date.now() - t0) / (dur * 1000));
          b.style.zIndex = zFor(y0 + (ty - y0) * f);
          frame = 1 - frame;
          var svgHost = b.querySelector('svg');
          if (svgHost && !reduced && !b.classList.contains('slw-eat')) svgHost.outerHTML = ART.pet(p.id, { acc: worn, frame: frame });
        }, 220 / slow);
        petTimers.push(setTimeout(function () { clearInterval(walk); b.style.zIndex = zFor(ty); }, dur * 1000));
        pos = { x: tx, y: ty };
        petTimers.push(setTimeout(wander, dur * 1000 + 1500 + Math.random() * 3500));
      }
      if (!reduced) petTimers.push(setTimeout(wander, 800 + i * 900));
    });
    acts2dPets(); chipsNow();                          /* a game in play keeps its pet where it is; a patted pet's chips (IA-5) */
  }

  /* ---------------- HUD actions ---------------- */
  function onHudAction(e) {
    var a = e.currentTarget.dataset.act;
    /* 📚 Learn (wave 3): with a savings goal still short, a learn-and-come-back trip for it; else the last subject */
    if (a === 'learn') { var sg = shortGoal(); if (sg) startTrip(sg, 'hud'); else { closeAllOverlays(); goLearn(); } return; }
    /* the shop opens on the land the child is standing on (Home, or a sky island owned or a preview; WAVE3-PLAN §5) */
    if (a === 'shop') return openShop({ isle: isleNow() });
    if (a === 'isle-home') return goIsle('home');
    if (a === 'isle-unlock') return openItem(e.currentTarget.getAttribute('data-land'));
    if (a === 'games') return openGames();
    if (a === 'pets') return careUI() ? openCareCorner() : openPets();   /* 🐾: the Pet Corner, else W5b.1's crew sheet (KU28) */
    if (a === 'char') return openMyChar();
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
      if (showtimeOn) noteFind({ kind: 'showtime', isle: isleNow() });   /* the Showtime stamps (IA-5) */
      return;
    }
    if (a === 'music') {
      var onNow = !musicOn();
      try { if (window.SLMusic) SLMusic.setEnabled(onNow); } catch (er) {}
      if (onNow) islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
      e.currentTarget.setAttribute('aria-pressed', String(onNow));
      return;
    }
    if (a === 'sound') { flipSound(); return; }
    if (a === 'more') return openMore();
    if (a === 'edit') {
      var lk = isleNow();
      if (mode === 'play' && !C.isleUnlocked(W(), lk)) {   /* a locked island is a preview: nothing to edit yet (D46) */
        toast(tx('isle.locked'), { label: tx('isle.seeUnlock'), fn: function () { openItem(C.ISLES[lk].unlock); } });
        return;
      }
      if (mode === 'place') cancelPlacement();
      if (skyMapOn) skyMap(false);                          /* edit happens on the island, not over the Sky map */
      endActivity('edit');                                  /* a game or a show ends with Edit (IA-5) */
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
    actTap(uid, it, el);                                  /* island activities (IA-5): stamps, the visitor's tour, wishes, I spy, hide and seek */
    if (shakeTree(uid, it, el)) return;                   /* a Home tree: its season's burst */
    /* in I spy, hide and seek or fetch the house is one more thing to tap (the biggest thing, a hiding place, a throw):
       it plays, and its sheet waits for the next tap after the game, so the game never ends under the child's finger.
       A game's ▶ sign the same (the post-merge QA, 28 Oct: a throw at the Debut Run gate opened its lobby and ended
       fetch): the stage's squish and the game's own answer (the throw, the look, the clue) only, no 'launch' push-in;
       its game waits for a tap after this one */
    if ((it.act === 'home' || it.act === 'launch') && (actLive('spy') || actLive('hide') || actLive('fetch'))) {
      if (it.act === 'home' && use3D && stage3d) s3('act', uid, 'home'); else if (el) fx(el, '✦');
      return;
    }
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
    if (fromBuy) showPlaceBar();                                /* QA#3: Put it here / Keep it for later in view */
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
      /* just bought from the shop: 'Placed.' also goes back to the shop, on the same land, scroll and card (WAVE3-PLAN §5) */
      var back = !pl.uid && pl.back ? pl.back : null;
      toast(tx(pl.uid ? 'edit.moved' : 'edit.placed'), [{ label: '↩ Undo', fn: undo }, back ? { label: tx('shop.back'), fn: function () { openShop(back); } } : null]);
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
  /* R2 (QA2D-2): the last finger (or mouse) down and the last key, by the monotonic clock, from the document's capture
     phase. A card that opens just as the child taps never takes that tap: its backdrop ignores a click whose press came
     before the card or in its first ARM_MS, and the island-open queue and the welcome wait QUIET_MS after the last tap
     or key before they open (openBlocked, introWhenDrawn). Memory only */
  var lastDown = 0, lastInput = 0, ARM_MS = 400, QUIET_MS = 1000;
  function onDown() { lastDown = lastInput = perfNow(); }
  function onKeyIn() { lastInput = perfNow(); }
  try {
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (t) { document.addEventListener(t, onDown, { capture: true, passive: true }); });
    document.addEventListener('keydown', onKeyIn, true);
  } catch (e) {}
  /* the child has just tapped or pressed a key (QUIET_MS): no unasked card now */
  function busyHands() { return !!lastInput && perfNow() - lastInput < QUIET_MS; }
  /* opts.noBackdrop: a once-only card (the welcome, Island coins are here, Testing’s over) closes only on purpose, with
     its own button, ✕ or Esc; a tap beside it does nothing. opts.onClose(how): how the sheet went: 'x' (✕), 'esc',
     'backdrop', 'all' (closeAllOverlays: the island moving on, never the child's choice), or undefined (the sheet's own
     buttons, through ov._close()) */
  function overlay(inner, opts) {
    opts = opts || {};
    endActivity('sheet');                     /* island activities (IA-5): a sheet over the island ends a game or a show */
    var born = perfNow();
    var ov = document.createElement('div');
    ov.className = 'slw-ov' + (opts.cls ? ' ' + opts.cls : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('data-sl-modal', '1');   /* the app's own pop-ups (Daily 30 etc.) wait for this */
    ov.innerHTML = '<div class="slw-sheet' + (opts.small ? ' small' : '') + '"><div class="slw-sheethd"><button class="slw-x" type="button" aria-label="Close">✕</button></div>' + inner + '</div>';
    sheetHead(ov, opts);
    var opener = document.activeElement;
    var h2 = ov.querySelector('h2'); if (h2) { h2.id = h2.id || ('slwH' + (++ovSeq)); ov.setAttribute('aria-labelledby', h2.id); }
    document.body.appendChild(ov);
    var behind = shutBehind(ov);              /* QA#10: the island and the page behind are out of reach while it is up */
    cover(+1);
    var closed = false, done = [];
    measureHead(ov);
    function onResize() { measureHead(ov); }
    try { window.addEventListener('resize', onResize); } catch (e) {}
    function close(how) {
      var first = !closed;
      if (typeof how !== 'string') how = undefined;
      if (first) { closed = true; cover(-1); openBehind(behind); behind = []; }
      ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(how);
      try { window.removeEventListener('resize', onResize); } catch (e) {}
      /* c-island: focus goes back without moving the page. A card the island opens by itself has, as its opener, the top
         bar's 🏝️ My Island button, which the open's lift (fitStage) has just put under the sticky header; a plain focus()
         scrolled the page back to it and pushed the stage's bottom off a phone's screen (360 × 740: 8px) */
      try { if (opener && document.body.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); } catch (e) {}
      if (first) done.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    }
    function onKey(e) {
      if (e.key !== 'Escape' && e.key !== 'Tab') return;
      var all = document.querySelectorAll('.slw-ov');
      if (all[all.length - 1] !== ov || document.querySelector('.slw-cele')) return;   /* only the top sheet answers */
      if (e.key === 'Tab') { keepTab(ov, e); return; }                                   /* Tab goes round inside it (QA#10) */
      close('esc');                                                                      /* one Esc = one dialog */
    }
    /* the backdrop: never a tap that began before this sheet was there or in its first ARM_MS (R2, QA2D-2), never on a
       once-only card */
    ov.addEventListener('click', function (e) {
      if (e.target !== ov || opts.noBackdrop) return;
      if (lastDown && lastDown < born + ARM_MS) return;
      close('backdrop');
    });
    $('.slw-x', ov).addEventListener('click', function () { close('x'); });
    document.addEventListener('keydown', onKey);
    var focusable = ov.querySelector('button:not(.slw-x), input');
    setTimeout(function () { try { (focusable || $('.slw-x', ov)).focus(); } catch (e) {} }, 30);
    ov._close = function (how) { close(how); };
    ov._whenClosed = function (f) { if (typeof f !== 'function') return; if (closed) f(); else done.push(f); };   /* wave 3: the queue and go() wait on it */
    return ov;
  }
  var ovSeq = 0;
  /* QA#10 (as the game shell's E5): while a sheet is up, what is behind it is inert (no Tab stops) and hidden from screen
     readers (aria-hidden too, for an iPad without inert). Toasts and the live region stay reachable: the island's own
     (.slw-toast, #slwLive) and the app's toast host (#slToasts, above every sheet: 'You’re signed out … Log back in'
     keeps its button). Only what this changed is put back */
  var NOT_SHUT = /^(script|style|link|meta|template|noscript)$/i;
  function shutBehind(ov) {
    var out = [], kids = ov && ov.parentNode ? ov.parentNode.children : [];
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (!n || n === ov || NOT_SHUT.test(n.localName || '') || n.id === 'slwLive' || n.id === 'slToasts' || /\bslw-toast\b/.test(String(n.className || ''))) continue;
      var rec = { n: n, inert: n.hasAttribute('inert'), hid: n.getAttribute('aria-hidden') };
      if (!rec.inert) { n.setAttribute('inert', ''); try { n.inert = true; } catch (e) {} }
      if (rec.hid == null) n.setAttribute('aria-hidden', 'true');
      out.push(rec);
    }
    return out;
  }
  function openBehind(list) {
    (list || []).forEach(function (r) {
      try {
        if (!r.inert) { r.n.removeAttribute('inert'); try { r.n.inert = false; } catch (e) {} }
        if (r.hid == null) r.n.removeAttribute('aria-hidden');
      } catch (e) {}
    });
  }
  /* Tab and Shift+Tab go round the sheet's own buttons: from the last to the first and back, never out to the page */
  function tabStops(scope) {
    return Array.prototype.filter.call(scope.querySelectorAll('button, [href], input, select, textarea, [tabindex]'), function (n) {
      if (n.disabled || n.getAttribute('tabindex') === '-1' || n.getAttribute('aria-hidden') === 'true') return false;
      return !n.getClientRects || n.getClientRects().length > 0;
    });
  }
  function keepTab(ov, e) {
    var list = tabStops(ov), a = document.activeElement, inside = !!a && ov.contains(a);
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (!inside || (e.shiftKey ? a === first : a === last)) {
      e.preventDefault();
      try { (e.shiftKey ? last : first).focus(); } catch (x) {}
    }
  }
  /* the sheet's sticky header (A9): the sheet's own title (its leading h2) and, on a big sheet, the ⭐ balance
     join the ✕, so all three stay at the top while the sheet scrolls. A sheet that starts with something else
     (the welcome, a card) keeps a bare header: just the ✕, still always in reach */
  function sheetHead(ov, opts) {
    var sheet = $('.slw-sheet', ov), hd = sheet && $('.slw-sheethd', sheet), x = hd && $('.slw-x', hd);
    if (!hd || !x) return;
    var first = sheet.children[1];
    var titled = !!(first && String(first.tagName).toUpperCase() === 'H2');
    if (titled) hd.insertBefore(first, x);
    if (titled && opts.pts !== false && !opts.small) {
      var u = me(), p = document.createElement('span');
      p.className = 'slw-hdpts'; p.setAttribute('title', balTitle());
      p.innerHTML = SYM() + ' <b class="n">' + fmt(balOf(u)) + '</b>';
      hd.insertBefore(p, x);
    }
    if (!titled) hd.className += ' bare';
  }
  /* how tall the header is (0 for a bare one): the rows that stick under it (the shop's tab and island rows) read
     it as --slw-hdh, and the sheet's own scrolls (a new tab, a fold, a shelf, a crew member) land below it */
  function headH(scope) {
    var hd = scope && $('.slw-sheethd', scope);
    return hd && !/\bbare\b/.test(hd.className) && hd.offsetHeight > 0 ? hd.offsetHeight : 0;
  }
  function measureHead(ov) {
    var sheet = $('.slw-sheet', ov), h = headH(ov);
    if (sheet && sheet.style && sheet.style.setProperty) try { sheet.style.setProperty('--slw-hdh', h + 'px'); } catch (e) {}
  }
  /* every open sheet's balance (🪙, F-KU5) follows the wallet (a purchase, learning in another tab) */
  function syncHeadPts() {
    var u = me(); if (!u) return;
    document.querySelectorAll('.slw-hdpts .n').forEach(function (n) { n.textContent = fmt(balOf(u)); });
  }
  function closeAllOverlays() {
    closePhoto();                             /* the photo sheet stops its camera itself (KU-CH14): never a bare remove */
    document.querySelectorAll('.slw-ov,.slw-cele').forEach(function (o) { if (o._close) o._close('all'); else o.remove(); }); coverCount = 0; s3('setCovered', false);
  }
  function closePhoto() { var PU = window.SLPhotoCartoonUI; try { if (PU && typeof PU.closeAll === 'function') PU.closeAll(); } catch (e) {} }
  /* o.ms: how long it stays (a 'Loading…' toast stays until its game starts or gives up); → the toast element */
  /* action: {label, fn}, or a list of them (wave 3: 'Placed.' has ↩ Undo and Back to the shop) */
  function toast(msg, action, o) {
    var old = document.querySelector('.slw-toast'); if (old) old.remove();
    var acts = !action ? [] : Array.isArray(action) ? action.filter(Boolean) : [action];
    var t = document.createElement('div'); t.className = 'slw-toast' + (o && o.over ? ' over' : ''); t.setAttribute('role', 'status');   /* over: above a game */
    t.innerHTML = '<span>' + esc(msg) + '</span>' + acts.map(function (a) { return '<button type="button">' + esc(a.label) + '</button>'; }).join('');
    document.body.appendChild(t);
    t.querySelectorAll('button').forEach(function (b, i) { b.addEventListener('click', function () { t.remove(); acts[i].fn(); }); });
    setTimeout(function () { if (t.parentNode) t.remove(); }, (o && o.ms) || (acts.length ? 6000 : 3200));
    return t;
  }

  /* ---------------- shop (wave 3: one land and a few shelves; WAVE3-PLAN §5, SLIslandShop.landShop, W3-2) ----------------
     The Island Shop is ONE land: a row of land chips (sticky on every size, 'Shop at') picks it, and it opens on the
     land the child is standing on. Home's things sit on six shelves, with door cards for what has its own page (My
     pets, the Pet Shop, your home's styles, the Wardrobe); a sky land keeps its own shelves. 'I can buy' filters the
     land on show. Memory only: nothing here is stored. The old tab names still open the right place (SHOP_OLD) */
  var shopLand = 'home', shopFilter = 'all', shopWard = false, shopSnap = null, shopFocus = null;
  var shopAll = {};                      /* '<land>:<shelf>' → 'See all' tapped (R2): memory only, for this shop's visit */
  /* an old tab name → [land, shelf to jump to, filter, the Wardrobe page]: people-ui's 'Shop more', the crew sheet, index.html */
  var SHOP_OLD = { all: ['home'], afford: ['home', null, 'afford'], garden: ['home', 'decor'], city: ['home', 'decor'], paths: ['home', 'fun'],
    fun: ['home', 'fun'], home: ['home', 'more'], pets: ['home', 'pets'], games: ['home', 'games'], land: ['home', 'lands'], wardrobe: ['home', null, null, true] };
  /* where openShop(cat, o) / openShop(o) opens: {isle, shelf, filter, ward}. A land asked for wins; 'sky' alone is the sky
     island the child is on, else the first one; nothing asked for is the land the child is standing on */
  function shopTarget(cat, o) {
    var k = typeof o.isle === 'string' && C.ISLES[o.isle] ? o.isle : null;
    var old = typeof cat === 'string' && Object.prototype.hasOwnProperty.call(SHOP_OLD, cat) ? SHOP_OLD[cat] : null;
    var at = { isle: old ? old[0] : k || isleNow(), shelf: old ? old[1] : null, filter: old && old[2] ? old[2] : 'all', ward: !!(old && old[3]) };
    if (cat === 'sky') at.isle = k && k !== 'home' ? k : isleNow() !== 'home' ? isleNow() : C.ISLE_ORDER.filter(function (x) { return x !== 'home'; })[0];
    if (typeof o.shelf === 'string') at.shelf = o.shelf;
    if (o.filter === 'afford' || o.filter === 'all') at.filter = o.filter;
    if (o.ward === true) at.ward = true;
    if (!C.ISLES[at.isle]) at.isle = 'home';
    return at;
  }
  /* '📚 Learn' on a card that is short (never in test mode): a learn-and-come-back trip for it */
  function learnBtnHtml(id, cls) {
    return '<button type="button" class="slw-learnbtn' + (cls ? ' ' + cls : '') + '" data-learn="' + esc(id) + '" data-fk="card:learn:' + esc(id) + '">' + esc(tx('learn.go')) + '</button>';
  }
  /* a repeatable's chip: 'Buy as many as you like' (test mode: 'Get as many…') and how many the child has; a blurb that
     says 'as many as you like' already keeps only 'You have 2' (R2, QA2A-12), and nothing when there are none yet */
  function repChip(it, s) {
    var said = /as many as you like/i.test(dsc(it)), have = s.copies ? 'you have ' + s.copies : '';
    if (said) return have ? '<span class="chip rep">' + esc(have.charAt(0).toUpperCase() + have.slice(1)) + '</span>' : '';
    return '<span class="chip rep">' + (trial() ? 'Get as many as you like' : 'Buy as many as you like') + (have ? ' · ' + have : '') + '</span>';
  }
  function cardHtml(u, it, lead) {
    if (isPeople(it)) return peopleCardHtml(u, it.id, lead);        /* a character or a piece: its own card */
    if (it.kind === 'pet') { var pet = petCardHtml(u, it); if (pet) return pet; }   /* F-KU3: where a pet is; the cap */
    var w = C.ensureWorld(u), s = iState(u, it.id), rep = C.isRepeatable(it);
    var chip = s.state === 'owned' ? '<span class="chip own">✓ Owned</span>'
      : s.state === 'locked' ? '<span class="chip lock">🔒 Needs ' + esc(C.item(s.needs[0]).name) + '</span>'
      : s.state === 'full' ? '<span class="chip uni">' + esc(capChip(s)) + '</span>'
      : s.state === 'capped' ? '<span class="chip own">✓ Plenty for testing (' + s.copies + ')</span>'
      : rep ? repChip(it, s)
      : '<span class="chip uni">' + (trial() ? esc(tx('intro.3.trialTitle')) : 'Buy once, keep forever') + '</span>';
    var buyLabel = s.state === 'owned' ? (it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant' ? 'Use it' : 'Owned ✓')
      : s.state === 'locked' ? '🔒 Locked' : s.state === 'short' ? needLine(s.need) : s.state === 'capped' ? 'Plenty ✓' : s.free ? 'Get it free' : 'Buy';
    var disabled = s.state === 'locked' || s.state === 'short' || s.state === 'capped' || (s.state === 'owned' && !(it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant'));
    var isGoal = C.goalId(w) === it.id;
    /* every card button carries a focus key (card:<what>:<id>), so a repaint (a goal set, a buy refused) keeps focus on it */
    /* R2 (QA2B-5): the goal button says what it does in the item sheet's own words, on a row of its own under the card's
       button (never a lone 🎯 with only a tooltip) */
    var goalBtn = (s.state === 'owned' || s.state === 'full' || trial()) ? '' : '<button type="button" class="slw-goalbtn slw-cardgoal' + (isGoal ? ' on' : '') + '" data-goal="' + it.id + '" data-fk="card:goal:' + it.id + '" aria-pressed="' + isGoal + '">' + esc(goalWord(isGoal)) + '</button>';
    var shine = (window.SLIslandLook && SLIslandLook.shineLevel) ? ' shine-' + SLIslandLook.shineLevel(it.price) : '';
    /* an owned sky land is a way there; a locked land's things are a preview: a look, never a Buy (D99) */
    /* wave 3: no dead Buy. A locked thing is a look (its sheet says what it needs); one the child is short of keeps
       F-KU5's 'Need N more 🪙' as a line and gets '📚 Learn' (a learn-and-come-back trip) */
    var act = s.state === 'owned' && isleOfLand(it) && canTravel() ? '<button type="button" class="slw-buy" data-goisle="' + it.isle + '" data-fk="card:go:' + it.id + '">' + esc(tx('isle.goThere')) + '</button>'
      : s.state === 'locked' ? '<button type="button" class="slw-btn" data-open="' + it.id + '" data-fk="card:see:' + it.id + '">' + esc(tx('shop.seeIt')) + '</button>'
      /* the pet cap (itemState 'full', A4): the pets the child has, in the Pet Corner, never a Buy that does nothing */
      : s.state === 'full' ? '<button type="button" class="slw-btn" data-corner="" data-ctab="home" data-fk="card:corner:' + it.id + '">' + esc(tx('care.corner.title')) + '</button>'
      : s.state === 'short' ? learnBtnHtml(it.id)
      : '<button type="button" class="slw-buy" data-buy="' + it.id + '" data-fk="card:buy:' + it.id + '"' + (disabled ? ' disabled' : '') + '>' + buyLabel + '</button>';
    var need = s.state === 'short' ? '<div class="slw-need">' + esc(buyLabel) + '</div>' : '';
    var game = gameOf(it);
    return '<div class="slw-card' + shine + '"><button type="button" class="ic" data-open="' + it.id + '" aria-label="See ' + esc(it.name) + '">' + iconHtml(it.id, artState(w)) + '</button>' +
      '<div class="nm">' + esc(it.name) + '</div><div class="ds">' + esc(dsc(it)) + '</div>' + (game ? '<div class="slw-plays">🎮 ' + esc(game.name + ': ' + game.what) + '</div>' : '') + chip +
      /* R2 (QA2A-12): one way to say it. Owned: the chip alone, no price; test mode: the chip, the struck price and 'Get
         it free' (no FREE badge as well) */
      (s.state === 'owned' ? '' : trial() ? '<div class="pr"><s style="color:#9a94b5;font-weight:700;">' + money(priceOf(it)) + '</s></div>'
        : '<div class="pr">' + money(priceOf(it)) + (rep ? ' <span style="font-size:11px;color:#8a84a3;">each</span>' : '') + '</div>') +
      need + '<div class="row' + (s.state === 'short' ? ' slw-learnrow' : '') + '">' + act + goalBtn + '</div></div>';
  }
  /* a pet the child has, or one the cap shuts out (F-KU3: SLIslandShop.shopPet): where it is (At home, At the Pet
     Hotel, Safe at the Pet Rescue) or '3 of 3 pets', and the Pet Corner instead of a Buy that would do nothing.
     '' for every other pet: the card above draws it (adopt, locked) */
  function shopPetOf(u, id) {
    var SH = window.SLIslandShop;
    try { return SH && typeof SH.shopPet === 'function' ? SH.shopPet(C, u, id, TO()) : null; } catch (e) { return null; }
  }
  function petCardHtml(u, it) {
    var c = shopPetOf(u, it.id);
    if (!c || !(c.act === 'corner' || c.act === 'room')) return '';
    var w = C.ensureWorld(u), shine = (window.SLIslandLook && SLIslandLook.shineLevel) ? ' shine-' + SLIslandLook.shineLevel(it.price) : '';
    var chip = c.chip ? '<span class="chip ' + c.chip.cls + '">' + (c.owned ? '✓ ' : '') + esc(tx(c.chip.key, c.chip.params || undefined)) + '</span>' : '';
    var act = c.act === 'corner' ? '<button type="button" class="slw-btn" data-corner="' + esc(c.corner.petId || '') + '" data-ctab="' + c.corner.tab + '" data-fk="corner:' + it.id + '">' + esc(tx(c.actKey)) + '</button>'
      /* Make room the price does not allow yet: '📚 Learn' instead of a dead button (wave 3) */
      : c.enabled || trial() ? '<button type="button" class="slw-buy" data-buy="' + it.id + '"' + (c.enabled ? '' : ' disabled') + '>' + esc(tx(c.actKey)) + '</button>' : learnBtnHtml(it.id);
    return '<div class="slw-card' + shine + '"><button type="button" class="ic" data-open="' + it.id + '" aria-label="See ' + esc(it.name) + '">' + iconHtml(it.id, artState(w)) + '</button>' +
      '<div class="nm">' + esc(it.name) + '</div><div class="ds">' + esc(dsc(it)) + '</div>' + chip +
      (c.owned ? '' : trial() ? '<div class="pr"><s style="color:#9a94b5;font-weight:700;">' + money(c.price) + '</s></div>' : '<div class="pr">' + money(c.price) + '</div>') +
      /* w3-int (W3-4's QA#12 hand-over): a pet the cap shuts out says why, in the Pet Shop's words, so it never reads
         like one of the child's own pets (owned cards say where the pet is instead) */
      (c.state === 'ownFull' ? '<div class="slw-need slw-capline">' + esc(tx('care.welcome.capTotal')) + '</div>'
        : c.state === 'homeFull' && c.line ? '<div class="slw-need slw-capline">' + esc(tx(c.line.key, c.line.params || undefined)) + '</div>' : '') +
      '<div class="row' + (c.act === 'room' && !c.enabled && !trial() ? ' slw-learnrow' : '') + '">' + act + '</div></div>';
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
  /* a land's status (Unlocked ✓ / 🪙 price / FREE), what its shop has, and the way there unless you are there (Home has
     no status chip: it is always yours) */
  function isleStatusHtml(s, here) {
    var k = s.isle;
    return (k === 'home' ? '' : s.status === 'open' ? '<span class="chip own">✓ ' + esc(tx('shop.unlocked')) + '</span>' : '<span class="chip lock">' + esc(s.status === 'free' ? tx('wardrobe.free') : money(s.price)) + '</span>') +
      '<span class="ct">' + esc(tx('shop.isleCount', { n: s.counts.things })) + '</span>' +
      (here || !canTravel() ? '' : '<button type="button" class="slw-btn" data-goisle="' + k + '" data-fk="go:' + k + '">' + esc(tx(s.owned ? 'isle.goThere' : 'isle.visit')) + '</button>');
  }
  /* the land chips ('Shop at'; landShop's picker): Home first, then the sky lands by their short names; an owned sky land
     says ' ✓', a locked one wears the lock on its icon; the land on show is pressed in */
  function shopPickerHtml(v) {
    return v.picker.map(function (p) {
      var k = p.isle, open = !!p.owned, sky = k !== 'home';
      return '<button type="button" class="slw-btn' + (p.on ? ' on' : '') + (p.here ? ' here' : '') + (open ? '' : ' locked') + '" data-shopland="' + k + '" data-fk="shopland:' + k + '" aria-pressed="' + !!p.on + '" aria-label="' +
        esc(isleName(k) + (sky && open ? ', ' + tx('shop.unlocked').toLowerCase() : '')) + '">' + (typeof ART.isleIcon === 'function' ? ART.isleIcon(k, { locked: !open }) : '') +
        '<span>' + esc(tx('isle.short.' + k, null, isleName(k)) + (sky && open ? ' ✓' : '')) + '</span></button>';
    }).join('');
  }
  /* a door card (landShop's doors): the way into what has its own page (My pets, the Pet Shop, your home's styles, the
     Wardrobe), never a thing to buy here. The picture is a look only; the button is the one tab stop */
  function doorHtml(u, d) {
    var w = C.ensureWorld(u), pic = '', run = runnerId(w), sp;
    if (d.key === 'pets') pic = run && C.item(run) ? iconHtml(run, { acc: C.wornBy(w, run) }) : '';
    else if (d.key === 'house') { sp = ART.sprite('house_cottage', artState(w)); pic = sp ? '<span class="slw-pc">' + sp.svg + '</span>' : ''; }
    else if (d.key === 'clothes') { var face = d.ids.filter(function (id) { var it = C.item(id); return !!it && it.kind === 'char'; })[0] || d.ids[0]; pic = face ? peopleIconHtml(face) : ''; }
    else if (d.ids.length && C.item(d.ids[0])) pic = iconHtml(d.ids[0], artState(w));
    return '<div class="slw-card door" data-door="' + d.key + '"><button type="button" class="ic" data-door="' + d.key + '" tabindex="-1" aria-hidden="true">' + pic + '</button>' +
      '<div class="nm">' + esc(tx(d.titleKey)) + '</div><div class="ds">' + esc(tx(d.lineKey, d.lineParams || undefined)) + '</div>' +
      '<div class="row"><button type="button" class="slw-btn" data-door="' + d.key + '" data-fk="door:' + d.key + '">' + (d.key === 'clothes' ? ME_ICO + ' ' : '') + esc(tx(d.btnKey)) + '</button></div></div>';
  }
  /* 'I can buy' with nothing to buy on this land: say so, then the cheapest thing here still to save for and '📚 Learn' */
  function shopEmptyHtml(v) {
    var nx = v.next && C.item(v.next.id);
    return '<div class="slw-shopempty" role="status"><p>' + esc(tx('shop.filter.none')) + '</p>' +
      (nx ? '<p>' + esc(tx('shop.filter.next', { item: nx.name, n: fmt(v.next.need) })) + '</p>' + learnBtnHtml(nx.id) : '') + '</div>';
  }
  /* one land's shop (landShop's section): its heading, where you are, the status row, then ONE sideways row with 'I can
     buy' (never in test mode) and the 'Jump to' chips, the lead cards (a sky land: the land while locked, then the
     landmark), the shelves (door cards first; the order never changes after a buy), and the empty state */
  function isleSectionHtml(u, v) {
    var s = v.section, k = s.isle, here = isleNow() === k && !skyMapOn, on = v.filter === 'afford';
    var icon = typeof ART.isleIcon === 'function' ? ART.isleIcon(k, { locked: !s.owned }) : '';
    var html = '<section class="slw-shopisle" data-isle="' + k + '" aria-labelledby="slwSI-' + k + '"><h3 id="slwSI-' + k + '">' + icon + esc(tx('shop.isleShop', { island: s.name })) + '</h3>';
    if (!s.owned) html += '<p class="slw-isleline">' + esc(tx('shop.isleLocked', { land: s.name })) + '</p>';
    else if (here) html += '<p class="slw-isleline">' + esc(tx('shop.isleHere', { island: s.name })) + '</p>';
    /* the status row (a sky land's status and count, and the way there); on Home, only when the child is elsewhere */
    if (k !== 'home' || !here) html += '<div class="slw-isleacc">' + isleStatusHtml(s, here) + '</div>';
    /* R2 (QA2A-19): 'I can buy' is an on/off switch with a visible track (role switch), on a row of its own, set apart
       from the Jump to chips (never in test mode: everything is free) */
    if (!trial()) html += '<div class="slw-shopswitch"><button type="button" class="slw-switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" data-shopfilter="afford" data-fk="shop:afford">' +
      '<span class="tk" aria-hidden="true"><i></i></span><span class="tx">' + esc(tx('shop.filter.afford')) + '</span></button></div>';
    var row = s.shelves.length > 1 ? '<span class="lb">' + esc(tx('shop.jump')) + '</span>' + s.shelves.map(function (sh) {
      return '<button type="button" class="slw-btn slw-jump" data-jump="slwSh-' + k + '-' + sh.key + '" data-fk="jump:' + sh.key + '">' + esc(tx(sh.labelKey)) + '</button>';
    }).join('') : '';
    if (row) html += '<div class="slw-shopfilter">' + row + '</div>';
    /* the lead cards share one row that they fill, side by side as wide cards (QA 13) */
    if (s.lead.length) html += '<div class="slw-grid slw-leadrow">' + s.lead.map(function (id) { return id === s.landmarkId ? landmarkCardHtml(u, s) : cardHtml(u, C.item(id)); }).join('') + '</div>';
    /* R2 (QA2D-4): each shelf shows its first cards (one row on an iPad and up, 4 on a phone; fitShelves) and 'See all
       {n}' under it opens the rest in place. Door cards always show. Every card is drawn (the order never changes) */
    s.shelves.forEach(function (sh) {
      var all = !!shopAll[k + ':' + sh.key];
      html += '<h4 class="slw-shelfhd" id="slwSh-' + k + '-' + sh.key + '" tabindex="-1">' + esc(tx(sh.labelKey)) + (sh.ids.length ? ' <span class="n">' + sh.ids.length + '</span>' : '') + '</h4>' +
        '<div class="slw-grid slw-shelf' + (all ? ' all' : '') + '" data-shelf="' + sh.key + '">' + (sh.doors || []).map(function (d) { return doorHtml(u, d); }).join('') + sh.ids.map(function (id) { return cardHtml(u, C.item(id), id === sh.lead); }).join('') + '</div>' +
        (all || !sh.ids.length ? '' : '<button type="button" class="slw-btn slw-seeall" data-seeall="' + sh.key + '" data-fk="seeall:' + sh.key + '" hidden>' + esc(tx('shop.seeAll', { n: sh.ids.length }, 'See all ' + sh.ids.length)) + '</button>');
    });
    if (on && !s.lead.length && !s.shelves.length) html += shopEmptyHtml(v);
    return html + '</section>';
  }
  /* the 👕 Wardrobe (Home's clothes door): a page of its own inside the Island Shop, 'Back to the shop' first, then its
     title (the door's button: the person icon and 'Wardrobe', so the child sees where they are; the land chips still
     say Home), then its slot chips */
  function wardPageHtml(u) {
    return '<section class="slw-wardpage" aria-labelledby="slwWardT"><button type="button" class="slw-btn slw-shopback" data-shopback="1" data-fk="shop:back">' + esc(tx('shop.back')) + '</button>' +
      '<h3 id="slwWardT">' + ME_ICO + ' ' + esc(tx('wardrobe.title')) + '</h3>' + wardrobeTabHtml(u) + '</section>';
  }
  /* the shop's view-model call (SLIslandShop.landShop, W3-2): the land on show, where the child stands, test mode, the
     island's wallet, 'I can buy', the Pet Shop door only with pet care, the Wardrobe door only with the people plug-in */
  function shopView(u) {
    var SH = window.SLIslandShop;
    if (!SH || typeof SH.landShop !== 'function') return null;
    var o = { isle: shopLand, here: isleNow(), trial: trial(), filter: shopFilter, petShop: !!care(), people: wardrobeOn() };
    if (typeof C.walletOf === 'function') o.wallet = C.walletOf();
    try { return SH.landShop(C, u, o); } catch (e) { return null; }
  }
  /* without the shop view-model: the V4.54 things and the lands, cheapest first in one grid */
  function shopListHtml(u) {
    var items = C.shopItems().filter(function (it) { return !(it.isle && it.kind !== 'land'); })
      .sort(function (a, b) { return (priceOf(a) - priceOf(b)) || (a.price - b.price); });
    return '<div class="slw-grid" id="slwShopGrid">' + items.map(function (it) { return cardHtml(u, it); }).join('') + '</div>';
  }
  /* a shelf jump chip: the sheet scrolls to that shelf (under the sticky rows) and the heading takes focus, so the
     keyboard and a screen reader land there too */
  function jumpTo(ov, id) {
    var h = ov.querySelector('#' + id), sheet = ov.querySelector('.slw-sheet');
    if (!h || !sheet) return;
    var cs = window.getComputedStyle ? getComputedStyle(h) : null, m = ((cs && parseFloat(cs.scrollMarginTop)) || 8) + headH(ov);
    var top = sheet.scrollTop + h.getBoundingClientRect().top - sheet.getBoundingClientRect().top - m;
    try { sheet.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { sheet.scrollTop = top; }
    try { h.focus({ preventScroll: true }); } catch (e) {}
  }
  /* the Island Shop → its sheet. openShop() and openShop({isle}) open on that land (the HUD: the land the child stands on);
     openShop({isle, shelf, filter, ward, slot, scroll, focus}) also jumps to a shelf, turns 'I can buy' on, opens the
     Wardrobe page, or comes back to where the child was (scroll, the card's button: 'Back to the shop'). An old tab name
     still works: openShop('pets'), openShop('sky', {isle}), openShop('wardrobe', {slot}) (SHOP_OLD) */
  var shopLast = null;
  /* a buy that goes onto the island (a placeable, a land, a game) or a pet (its adopt flow) closes the shop; clothes, pet
     gear, game extras and styles do not (R2, QA2A-8) */
  function shopCloses(it) {
    return !!it && (it.kind === 'land' || it.kind === 'attraction' || it.kind === 'pet' || it.kind === 'landmark' || (typeof C.isPlaceable === 'function' && C.isPlaceable(it)));
  }
  /* R2 (QA2D-4): how many cards a closed shelf shows: one row from 768px (the grid's own columns), 4 on a phone. Door
     cards always show and count in that row. The rest are hidden (still drawn, so the order and every test hook stay)
     and the shelf's 'See all {n}' appears */
  var SHELF_PHONE = 4, SHELF_COLS = 5;
  function shelfCols(grid) {
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(grid) : null, t = cs && cs.gridTemplateColumns;
      if (t && t !== 'none') { var n = String(t).trim().split(/\s+/).length; if (n > 0) return n; }
    } catch (e) {}
    return SHELF_COLS;
  }
  function fitShelves(scope) {
    var phone = typeof window.innerWidth === 'number' && window.innerWidth > 0 && window.innerWidth < 768;
    (scope ? scope.querySelectorAll('.slw-shelf') : []).forEach(function (g) {
      var cards = Array.prototype.filter.call(g.children, function (c) { return /\bslw-card\b/.test(c.className || ''); });
      var doors = cards.filter(function (c) { return /\bdoor\b/.test(c.className); }).length, all = /\ball\b/.test(g.className);
      var room = all ? Infinity : Math.max(0, (phone ? SHELF_PHONE : shelfCols(g)) - doors), shown = 0, hid = 0;
      cards.forEach(function (c) {
        if (/\bdoor\b/.test(c.className)) return;
        var keep = shown < room; if (keep) shown++; else hid++;
        if (keep) c.removeAttribute('hidden'); else c.setAttribute('hidden', '');
      });
      var more = g.parentNode && g.parentNode.querySelector('[data-seeall="' + g.getAttribute('data-shelf') + '"]');
      if (more) { if (hid) more.removeAttribute('hidden'); else more.setAttribute('hidden', ''); }
    });
  }
  /* R2 (QA2A-7): a sideways row (the land chips, Jump to, the island's chips) marks the end with more to see (data-more
     'l', 'r' or 'lr', the stylesheet's soft fade and arrow: the Maths topics' pattern, index.html slNavEdges), kept up to
     date as it scrolls; a tap on an arrow (the row itself, within its end) slides it along at once, never animated */
  function rowEdges(row) {
    if (!row || !row.getAttribute) return '';
    /* a few px of slack at each end: a row's snap point can rest a little way in (the Jump to label's own margin) */
    var max = (row.scrollWidth || 0) - (row.clientWidth || 0), x = row.scrollLeft || 0, m = '';
    if (max > 8) m = (x > 8 ? 'l' : '') + (x < max - 8 ? 'r' : '');
    if ((row.getAttribute('data-more') || '') !== m) { if (m) row.setAttribute('data-more', m); else row.removeAttribute('data-more'); }
    return m;
  }
  function rowSlide(row, e) {
    var m = row.getAttribute('data-more') || '';
    if (!m || !e || e.target !== row || typeof row.getBoundingClientRect !== 'function') return 0;
    var b = row.getBoundingClientRect(), x = e.clientX - b.left, end = 56;
    var dir = x >= b.width - end && m.indexOf('r') >= 0 ? 1 : x <= end && m.indexOf('l') >= 0 ? -1 : 0;
    if (dir) { row.scrollLeft = Math.max(0, (row.scrollLeft || 0) + dir * Math.round((row.clientWidth || 0) * 0.6)); rowEdges(row); }
    return dir;
  }
  function wireEdges(row) {
    if (!row || row._slwEdges) { rowEdges(row); return; }
    row._slwEdges = true;
    row.addEventListener('scroll', function () { rowEdges(row); }, { passive: true });
    row.addEventListener('click', function (e) { rowSlide(row, e); });
    rowEdges(row);
  }
  /* fn once no celebration card is up (it comes over the shop after a buy); 1 min at most */
  function afterCele(fn) {
    var t0 = Date.now();
    function wait() {
      if (document.querySelector('.slw-cele') && Date.now() - t0 < 60000) { setTimeout(wait, 200); return; }
      fn();
    }
    setTimeout(wait, 50);                                /* the celebration is drawn just after the buy says done */
  }
  function openShop(a, b) {
    var o = a && typeof a === 'object' ? a : b && typeof b === 'object' ? b : {}, at = shopTarget(typeof a === 'string' ? a : null, o);
    var u = me();
    if (!u) return null;
    shopLand = at.isle; shopFilter = trial() ? 'all' : at.filter; shopWard = at.ward && wardrobeOn(); shopFocus = null;
    if (shopWard && typeof o.slot === 'string') wardSlot = o.slot;   /* 'Shop more' names its slot */
    islandMusic('shop');
    /* the balance (🪙, F-KU5) is in the sheet's sticky header. Under the title ONE line (QA#15): with real prices, which
       money the island uses (the ⭐ for My rewards are never spent here); in test mode, only the green test-mode bar */
    var line = trial() ? '<div class="slw-trialbar">Test mode: everything in this shop is <b>free</b>' + (coinsOn() ? ', so try anything.' : '. Your points aren’t used, so try anything.') + '</div>'
      : '<div class="slw-moneyline" style="font-weight:800;color:#6b5a22;">' + (coinsOn() ? esc(tx('coins.shop.line')) : 'Learning earns more ⭐. It’s the same balance as My rewards.') + '</div>';
    /* a fresh visit starts with every shelf closed; coming back to where the child was ('Back to the shop') keeps them */
    if (!(typeof o.scroll === 'number' && o.scroll > 0) && typeof o.focus !== 'string') shopAll = {};
    var ov = overlay('<h2>' + lbl('shop', 'Island Shop') + '</h2>' + line + '<div class="slw-shopland" id="slwShopLand" role="group" aria-label="' + esc(tx('shop.at')) + '"></div><div id="slwShopBody"></div>',
      { onClose: function () {
        if (shopSnap === snap) shopSnap = null; islandMusic(showtimeOn ? 'island_showtime' : 'island_day');
        try { window.removeEventListener('resize', onFit); } catch (e) {}
      } });
    var land = $('#slwShopLand', ov), body = $('#slwShopBody', ov), sheet = $('.slw-sheet', ov);
    sheet.className += ' slw-shopsheet';      /* its scroll-padding keeps a focused card clear of the sticky bands */
    /* R2: the shelves' first rows follow the window (an iPad turned round); the rows' arrows and the shelf in view too */
    var fitQ = false, markQ = false;
    function onFit() { if (fitQ) return; fitQ = true; setTimeout(function () { fitQ = false; if (!ov.isConnected) return; fitShelves(body); wireEdges(land); wireEdges($('.slw-shopfilter', body)); markShelf(); }, 120); }
    try { window.addEventListener('resize', onFit); } catch (e) {}
    /* R2 (QA2A-7): Jump to marks the shelf in view (aria-current and the 'on' look): the last shelf whose heading has come
       up to the Jump to band, else the first */
    function markShelf() {
      var row = $('.slw-shopfilter', body), chips = row ? row.querySelectorAll('[data-jump]') : [];
      if (!chips.length) return;
      var band = row.getBoundingClientRect ? row.getBoundingClientRect().bottom : 0, cur = null;
      Array.prototype.forEach.call(chips, function (c, i) {
        var h = ov.querySelector('#' + c.getAttribute('data-jump'));
        if (h && (i === 0 || (h.getBoundingClientRect && h.getBoundingClientRect().top <= band + 24))) cur = c;
      });
      Array.prototype.forEach.call(chips, function (c) {
        var on = c === cur; c.classList.toggle('on', on);
        if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
      if (cur) showChip(row, cur);
    }
    try { sheet.addEventListener('scroll', function () { if (markQ) return; markQ = true; setTimeout(function () { markQ = false; if (ov.isConnected) markShelf(); }, 80); }, { passive: true }); } catch (e) {}
    /* where the child is in this shop, for 'Back to the shop' after a placement (QA#3) */
    function snap() { return { isle: shopLand, filter: shopFilter, ward: shopWard, scroll: sheet.scrollTop || 0, focus: shopFocus }; }
    shopSnap = snap;
    /* a new land or page starts at its top, just under the sticky land chips */
    function toTop() {
      var band = window.getComputedStyle && getComputedStyle(land).position === 'sticky' ? land.offsetHeight : 0;
      var top = body.getBoundingClientRect().top - sheet.getBoundingClientRect().top - band - headH(ov);
      if (top < 0) sheet.scrollTop += top - 8;
    }
    /* a door: the Wardrobe is a page here; My pets, the Pet Shop and your home are sheets of their own */
    function door(key) {
      if (!ov.isConnected) return;               /* one tap, one place: the shop already went for this door */
      if (key === 'clothes') {
        if (!wardrobeOn()) return;
        shopWard = true; cardErr = null; paint(); toTop();
        var bk = $('[data-shopback]', body); if (bk) try { bk.focus({ preventScroll: true }); } catch (e) {}
        return;
      }
      ov._close();
      if (key === 'pets') { if (careUI()) openCareCorner({}); else openPets(); }
      else if (key === 'petShop') openPetShop({ filter: 'all' });
      else if (key === 'house') openHome();
    }
    /* a buy that couldn't go ahead says why on its own card, next to its button ({id, msg}); it stays through a
       repaint and goes when the child tries again or moves to another land */
    var cardErr = null;
    function showCardErr() {
      body.querySelectorAll('.slw-carderr').forEach(function (e) { e.remove(); });
      if (!cardErr) return;
      /* the card by its Buy, or by its 📚 Learn when the refusal left the child short (wave 3) */
      var b = body.querySelector('[data-buy="' + cardErr.id + '"]') || body.querySelector('[data-learn="' + cardErr.id + '"]'), card = b;
      while (card && !/\bslw-card\b/.test(card.className || '')) card = card.parentNode;
      if (!card) { toast('⚠️ ' + cardErr.msg); cardErr = null; return; }     /* the card isn't on this tab: a toast instead */
      var e = document.createElement('div');
      e.className = 'slw-err slw-carderr'; e.setAttribute('role', 'alert'); e.textContent = cardErr.msg;
      card.insertBefore(e, $('.row', card));
    }
    /* where buyFlow (and any buy helper) says a refusal: an errEl whose textContent goes on this card */
    function cardErrFor(id) {
      var el = {};
      Object.defineProperty(el, 'textContent', {
        get: function () { return cardErr && cardErr.id === id ? cardErr.msg : ''; },
        set: function (msg) { cardErr = msg ? { id: id, msg: String(msg) } : null; showCardErr(); }
      });
      return el;
    }
    function paint() {
      var u2 = me(), fk = focusKey(ov), sl = land.scrollLeft, r0 = $('.slw-shopfilter', body), rsl = r0 ? r0.scrollLeft : 0;
      if (!u2) return;
      var pn = $('.slw-hdpts .n', ov); if (pn) pn.textContent = fmt(balOf(u2));
      var v = shopView(u2);
      if (v) { shopLand = v.isle; shopFilter = v.filter; }
      land.innerHTML = v ? shopPickerHtml(v) : '';
      body.innerHTML = shopWard ? wardPageHtml(u2) : v ? isleSectionHtml(u2, v) : shopListHtml(u2);
      fillPhotocards(ov);
      /* phones: the land chips, the 'I can buy' + 'Jump to' row and the Wardrobe chips are sideways strips; the pressed ones come into view */
      land.scrollLeft = sl; showChip(land, $('.on', land));
      var r1 = $('.slw-shopfilter', body); if (r1) { r1.scrollLeft = rsl; showChip(r1, $('[aria-pressed="true"]', r1)); }
      var ws = $('.slw-islefilter', body); if (ws) showChip(ws, $('[aria-pressed="true"]', ws));
      /* R2: the shelves' first cards, the rows' arrows, the shelf in view */
      fitShelves(body); wireEdges(land); wireEdges($('.slw-shopfilter', body)); markShelf();
      body.querySelectorAll('[data-seeall]').forEach(function (bt) {
        bt.addEventListener('click', function () {
          var key = bt.getAttribute('data-seeall'), g = body.querySelector('.slw-shelf[data-shelf="' + key + '"]');
          var first = g ? Array.prototype.filter.call(g.children, function (c) { return c.hasAttribute('hidden'); })[0] : null;
          shopAll[shopLand + ':' + key] = true;
          if (g) g.className += ' all';
          fitShelves(body);
          /* focus goes to the first card that came into view, and the button goes (the shelf is all there now) */
          var ic = first && first.querySelector('button');
          bt.remove();
          if (ic) try { ic.focus({ preventScroll: false }); } catch (e) {}
        });
      });
      land.querySelectorAll('[data-shopland]').forEach(function (bt) { bt.addEventListener('click', function () { shopLand = bt.dataset.shopland; shopWard = false; cardErr = null; paint(); toTop(); }); });
      body.querySelectorAll('[data-shopfilter]').forEach(function (bt) { bt.addEventListener('click', function () { shopFilter = shopFilter === 'afford' ? 'all' : 'afford'; cardErr = null; paint(); }); });
      body.querySelectorAll('[data-jump]').forEach(function (bt) { bt.addEventListener('click', function () { jumpTo(ov, bt.dataset.jump); }); });
      body.querySelectorAll('[data-goisle]').forEach(function (bt) { bt.addEventListener('click', function () { var k = bt.dataset.goisle; ov._close(); goIsle(k); }); });
      /* only the door's buttons (its picture and its button): the card itself carries data-door too, for its look, and a
         tap on a button goes up to it, so binding the card as well opened the place twice (R2: two Pet Shops) */
      body.querySelectorAll('button[data-door]').forEach(function (bt) { bt.addEventListener('click', function () { door(bt.dataset.door); }); });
      body.querySelectorAll('[data-shopback]').forEach(function (bt) { bt.addEventListener('click', function () { shopWard = false; paint(); jumpTo(ov, 'slwSh-home-more'); refocus(ov, 'door:clothes'); }); });
      body.querySelectorAll('[data-learn]').forEach(function (bt) { bt.addEventListener('click', function () { startTrip(bt.dataset.learn, 'card'); }); });
      /* the characters and their wear (KU-CH17): the Wardrobe's slot chips, Play as, Wear, Make me */
      body.querySelectorAll('[data-wslot]').forEach(function (bt) { bt.addEventListener('click', function () { wardSlot = bt.dataset.wslot; paint(); toTop(); }); });
      body.querySelectorAll('[data-pplay]').forEach(function (bt) { bt.addEventListener('click', function () { setActiveChar(bt.dataset.pplay).then(paint); }); });
      body.querySelectorAll('[data-pwear]').forEach(function (bt) { bt.addEventListener('click', function () { wearPiece(bt.dataset.pwear).then(paint); }); });
      body.querySelectorAll('[data-pmake]').forEach(function (bt) { bt.addEventListener('click', function () { ov._close(); openMyChar(); }); });
      /* a pet card's My pets (F-KU3): on that pet's group, or At home at the cap */
      body.querySelectorAll('[data-corner]').forEach(function (bt) { bt.addEventListener('click', function () { var id = bt.dataset.corner; ov._close(); openCareCorner(id ? { petId: id, tab: bt.dataset.ctab } : { tab: bt.dataset.ctab }); }); });
      if (fk) refocus(ov, fk);
      body.querySelectorAll('[data-open]').forEach(function (bt) { bt.addEventListener('click', function () { shopFocus = 'card:buy:' + bt.dataset.open; openItem(bt.dataset.open); }); });
      ov.querySelectorAll('[data-goal]').forEach(function (bt) { bt.addEventListener('click', function () { toggleGoal(bt.dataset.goal).then(paint); }); });
      ov.querySelectorAll('[data-buy]').forEach(function (bt) {
        bt.addEventListener('click', function () {
          var it = C.item(bt.dataset.buy);
          shopFocus = 'card:buy:' + it.id;
          if (iState(me(), it.id).state === 'owned') { useOwned(it); ov._close(); return; }
          /* bought: the shop closes for what goes onto the island (a placeable, a land, a game, a pet: where the child was
             is kept for 'Back to the shop' after a placement). Clothes, pet gear, game extras and styles keep the Island Shop open
             (R2, QA2A-8): the sheet repaints with the card's button in focus, the celebration comes over it, and closing
             that leaves the child on the same land, shelf and scroll */
          buyItem(it, bt, cardErrFor(it.id), function (ok) {
            if (!ok) { paint(); return; }
            if (shopCloses(it)) { shopLast = snap(); ov._close(); return; }
            var fkey = 'card:buy:' + it.id, keep = sheet.scrollTop;
            paint(); sheet.scrollTop = keep;
            afterCele(function () { if (ov.isConnected) { sheet.scrollTop = keep; if (!refocus(ov, fkey)) refocus(ov, '@data-open=' + it.id); } });
          });
        });
      });
      showCardErr();
    }
    paint();
    /* come back to a shelf, a scroll position or a card (after the sheet's own first focus). The sheet first focuses
       its first button, a sticky land chip, and in a browser that focus scrolls the sheet (w3-int: 'Back to the shop'
       came back about 400px short, its card under the fold), so the scroll is set again once that focus is done */
    var back = typeof o.scroll === 'number' && o.scroll > 0 ? o.scroll : 0;
    if (back) sheet.scrollTop = back;
    var shelf = at.shelf && !shopWard ? 'slwSh-' + shopLand + '-' + at.shelf : null;
    if (shelf || o.focus || back) setTimeout(function () {
      if (!ov.isConnected) return;
      if (back) sheet.scrollTop = back;
      if (shelf) jumpTo(ov, shelf);
      if (typeof o.focus === 'string') refocus(ov, o.focus);
    }, 40);
    return ov;
  }
  /* set or clear the savings goal → Promise<bool> (did it change). Swapping one goal for a different one asks
     first ('Keep <goal>' / 'Yes, switch'); sure = already asked, so the land a locked thing needs takes the goal
     without a second question */
  function toggleGoal(id, sure) {
    var w = W(), cur = C.goalId(w);
    var target = C.goalId(w) === id ? null : id;      /* goal or goal3: the core routes a v3 id to goal3 */
    var it = target && C.item(target);
    if (target && cur && !sure) {
      /* a locked thing's goal goes to the land it needs: nothing to ask when that land is the goal already */
      var s = iState(me(), target), lands = s && s.state === 'locked' && s.needs ? s.needs[0] : target;
      if (lands !== cur) return askGoal(C.item(cur), it).then(function (yes) { return yes ? toggleGoal(id, true) : false; });
    }
    return commit(function (u) {
      var r = C.setGoal(u, target);
      if (r.ok) { var fw = C.ensureWorld(u); if (!it) { fw.goalPrice = null; fw.goalName = null; } else goalMeta(fw); }   /* in the island's money (F-KU5) */
      return r;
    }).then(function (res) {
      if (res && res.ok) { toast(target ? '🎯 New goal: ' + it.name : 'Goal cleared.'); draw(); return true; }
      if (res && res.code === 'locked' && res.needs && C.goalId(W()) !== res.needs) {
        var pre = C.item(res.needs);
        return toggleGoal(res.needs, true).then(function (ok) { if (ok) toast(tx('goal.firstNeed', { land: pre.name })); return ok; });
      }
      if (res && res.reason) toast(res.reason);
      return false;
    });
  }
  /* the goal's name and price as saved beside it (w.goalName / w.goalPrice): what index.html's 'Saving for…' line and goal
     toast read while a character's catalogue is not loaded (learning screens). The price is in the island's money: with
     coins on, the coin price or null, never the ⭐ price (R2, QA2D: 'Lena: 590 more 🪙' from a ⭐ 650 saved by an older
     build, or by people-ui's own 'Save up for it', which writes the goal alone). → true when it changed something */
  function goalMeta(fw) {
    var gid = C.goalId(fw), it = gid ? C.item(gid) : null;
    if (!it) return false;                              /* not in the catalogue here (a plug-in not loaded): left as it is */
    var p = coinsOn() ? (typeof C.priceOf === 'function' ? C.priceOf(it) : null) : it.price;
    if (typeof p !== 'number' || !isFinite(p)) p = null;
    if (fw.goalPrice === p && fw.goalName === it.name) return false;
    fw.goalPrice = p; fw.goalName = it.name;
    return true;
  }
  /* a real open: a character or clothes goal (w.goalK, the only kind index.html prices from w.goalPrice) whose saved name
     or price is out of date is put right, in one quiet commit */
  function goalMetaStale(w) {
    var gid = w && w.goalK, it = gid && gid === C.goalId(w) ? C.item(gid) : null;
    if (!it) return false;
    var p = coinsOn() ? C.priceOf(it) : it.price;
    return w.goalName !== it.name || w.goalPrice !== (typeof p === 'number' && isFinite(p) ? p : null);
  }
  /* 'Change your goal?' → Promise<bool>; closing the card (✕, Esc, the backdrop) keeps the goal. One at a time */
  var askingGoal = null;
  function askGoal(was, it) {
    if (askingGoal) return askingGoal.then(function () { return false; });
    askingGoal = new Promise(function (resolve) {
      var done = false;
      function answer(v) { if (done) return; done = true; askingGoal = null; resolve(v); }
      var c = overlay('<h2>🎯 Change your goal?</h2><p style="font-weight:700;">You’re saving for <b>' + esc(was ? was.name : '') + '</b>. Save for <b>' + esc(it ? it.name : '') + '</b> instead?</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;"><button class="slw-btn big" type="button" id="slwGoalKeep">Keep ' + esc(was ? was.name : 'my goal') + '</button>' +
        '<button class="slw-buy" type="button" id="slwGoalSwap" style="flex:0 0 auto;padding:10px 22px;">Yes, switch</button></div>', { small: true, onClose: function () { answer(false); } });
      $('#slwGoalKeep', c).addEventListener('click', function () { answer(false); c._close(); });
      $('#slwGoalSwap', c).addEventListener('click', function () { answer(true); c._close(); });
    });
    return askingGoal;
  }
  function useOwned(it) {
    if (it.kind === 'style') { commit(function (u) { return C.select(u, it.id); }).then(function () { draw(); openHome(); }); return; }
    if (it.kind === 'cosmetic' || it.kind === 'variant') { commit(function (u) { return C.select(u, it.id); }).then(function () { draw(); toast(tx('buy.cosmetic')); }); return; }
  }

  /* item detail sheet (preview, unlocks, buy, goal) */
  function unlockText(it) {
    var parts = isPeople(it) ? peopleLines(it) : [], ik = isleOfLand(it), UI = window.SLIslesUI;
    /* a game names itself, as the Games sheet does: what it is and where to play it */
    var game = gameOf(it);
    if (game) parts.push(esc('🎮 Unlocks ' + game.name + (trial() ? '' : ' for keeps') + ': ' + game.what + '. Play it from 🎮 Games.'));
    else if (it.kind === 'attraction') parts.push(trial() ? '🎮 Unlocks a new game — tap it on your island to play.' : '🎮 Unlocks a new game for keeps — tap it on your island to play.');
    /* a sky land: the island, what comes with it, then what its shop sells (three examples) */
    if (ik) parts.push('🏝️ ' + esc(tx('unlock.isle', { n: C.ISLES[ik].cellCount })));
    /* a character's own lines (peopleLines) already say what comes with it (char.cast.comes): never twice (R2, QA2B-4) */
    if (!(isPeople(it) && parts.length)) (it.includes || []).forEach(function (inc) { var ii = C.item(inc); if (ii) parts.push('🎁 Comes with: ' + esc(ii.name)); });
    if (ik && UI) {
      var ids = UI.skySections(C, me(), { isle: ik })[0].itemIds;
      parts.push('🛍️ ' + esc(tx('unlock.isleItems', { n: ids.length, items: ids.slice(0, 3).map(function (id) { return C.item(id).name; }).join(', ') })));
    } else if (it.kind === 'land' && !ik) parts.push('🏝️ Opens ' + (C.REGION_CELLS[it.region] || []).length + ' new squares of island.');
    if (it.kind === 'landmark' && C.ISLES[it.isle]) parts.push(esc(tx('unlock.landmark', { land: isleName(it.isle) })));
    /* where a sky island's thing may stand (D18); a land's mascot and gear have their own lines */
    else if (C.isV3(it) && C.isPlaceable(it)) parts.push(esc(tx(C.scopeOf(it.id) === 'own' ? 'unlock.ownOnly' : 'unlock.anyIsle', { island: isleName(it.isle) })));
    if (it.kind === 'pet') parts.push(it.isle && C.ISLES[it.isle] ? esc(tx('unlock.mascot', { island: isleName(it.isle) })) : esc(tx('unlock.pet')));
    if (it.kind === 'acc') parts.push(it.isle ? esc(tx('unlock.gear')) : esc(tx('unlock.petGear')));
    if (it.kind === 'variant' && it.game === 'course') parts.push('A new Debut Run course, with its own best score.');
    if (it.kind === 'variant' && it.game === 'kart') parts.push('🏁 A new race track, with its own best time.');
    if (it.kind === 'cosmetic') parts.push('✨ Changes how the game looks — it doesn’t make it easier or harder.');
    if (it.kind === 'style' && it.slot === 'shape') parts.push(esc(tx('unlock.shape')));
    else if (it.kind === 'style') parts.push('Changes how your home looks. Switch between styles you own any time.');
    if (C.isRepeatable(it)) parts.push('🔁 Each one you buy is one more on your island. Put them away and bring them back any time.');
    if (it.cat === 'city') parts.push(esc(tx('unlock.city')));
    else if (it.kind === 'fun') parts.push('✋ Tap it on your island to play with it.');
    /* a requirement still to get says so; one already met says it is done (QA 11): never 'First you need' for it */
    var w = W();
    (it.requires || []).forEach(function (r) {
      var ri = C.item(r); if (!ri) return;
      if (!w || !C.owns(w, r)) { parts.push('🔒 First you need: ' + esc(ri.name) + '.'); return; }
      var rk = isleOfLand(ri);
      parts.push('✓ ' + esc(rk ? tx('isle.short.' + rk, null, isleName(rk)) + ' is open.' : 'You have the ' + ri.name + '.'));
    });
    return parts.join('<br>');
  }
  /* the item sheet's shortfall (escaped HTML). d-island (James, 25 Oct 2026): the one wording, 'Need N more 🪙', from 0
     or nearly there alike (it was 'You have 🪙 400 — just 200 more to go!'); the sheet's header shows the balance, and
     the time line under 📚 Learn and come back says how long it is */
  function shortLine(bal, need) { return esc(needLine(need)); }
  /* → the sheet (wave 3: o.onClose, and the queue and go() wait on it), or null */
  function openItem(id, o) {
    var it = C.item(id); if (!it) return null;
    if (it.kind === 'food') { openPetShop({ filter: 'food', id: id }); return null; }   /* food is the Pet Shop's (meals, never 'each one you buy…') */
    var u = me(); if (!u) return null;
    var w = C.ensureWorld(u), s = iState(u, id);
    /* a pet the child has or one the cap shuts out (F-KU3): where it is or why, and the Pet Corner */
    var pc = it.kind === 'pet' ? shopPetOf(u, id) : null;
    if (pc && pc.act !== 'corner') pc = null;
    var demoGame = it.kind === 'attraction' ? it.game : (it.kind === 'variant' ? it.game : null);
    /* a landmark comes with its land: no price, no Buy, no goal; 'Go see it' once its land is yours, else
       a way to the land's own sheet. A sky land flies over for a look, or is a way there once it is yours */
    var lm = it.kind === 'landmark' && C.ISLES[it.isle] ? it.isle : null, ik = isleOfLand(it);
    var lmOwned = lm && C.isleUnlocked(w, lm), there = isleNow() === (lm || ik) && !skyMapOn;
    var trip = !canTravel() ? '' : lm ? (lmOwned ? '<button class="slw-buy" type="button" id="slwIsleGo">' + esc(tx('isle.landmarkSee')) + '</button>' : '')
      : ik && !there ? '<button class="' + (s.state === 'owned' ? 'slw-buy' : 'slw-btn') + '" type="button" id="slwIsleGo">' + esc(tx(s.state === 'owned' ? 'isle.goThere' : 'isle.visit')) + '</button>' : '';
    /* wave 3 (WAVE3-PLAN §6): short of it, '📚 Learn and come back' beside the goal button and how long that is ('That’s
       about 10 minutes of learning.'); locked, a way to what it needs. Never a dead Buy */
    var goalB = trial() ? '' : '<button class="slw-goalbtn' + (C.goalId(w) === id ? ' on' : '') + '" type="button" id="slwGoalNow" aria-pressed="' + (C.goalId(w) === id) + '">' + esc(goalWord(C.goalId(w) === id)) + '</button>';
    var learnAt = s.state === 'short' && !trial() ? learnTime(s.need) : '', needIt = s.state === 'locked' && s.needs && C.item(s.needs[0]);
    /* the name leads the sheet, so it rides in the sticky header with the ⭐ balance and the ✕ (A9) */
    var ov = overlay(
      '<h2>' + esc(it.name) + '</h2><div class="slw-detail"><div class="big" id="slwBig">' + iconHtml(id, artState(w)) + '</div>' +
      '<div class="info"><div style="color:#6b6585;">' + esc(dsc(it)) + '</div>' +
      '<div class="slw-unlocks">' + unlockText(it) + '</div>' +
      /* owned: 'You own this ✓' below says it, no price (R2, QA2A-12); test mode: the struck price and the one test-mode line */
      (lm || (s.state === 'owned' && !C.isRepeatable(it)) ? '' : trial() ? '<div class="pr" style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:22px;color:#b9821a;"><s style="color:#9a94b5;">' + money(priceOf(it)) + '</s> <span class="slw-free">' + esc(tx('intro.3.trialTitle')) + '</span></div>'
        : '<div class="pr" style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:22px;color:#b9821a;">' + money(priceOf(it)) + (C.isRepeatable(it) ? ' each' : '') + '</div>') +
      '<div class="slw-need">' + (pc ? esc(pc.line ? tx(pc.line.key, pc.line.params || undefined) : tx(pc.chip.key, pc.chip.params || undefined)) : lm ? '' : s.state === 'full' ? esc(tx('care.ownFull', { n: s.count })) : s.state === 'short' ? shortLine(balOf(u), s.need) : s.state === 'owned' ? 'You own this ✓' : '') + '</div>' +
      '<div class="slw-err" id="slwItemErr" role="alert"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        (pc ? '<button class="slw-buy" type="button" id="slwCornerNow">' + esc(tx(pc.actKey)) + '</button>'
          /* the pet cap without the shop view-model (A4): the Pet Corner, never a Buy that does nothing */
          : s.state === 'full' ? '<button class="slw-buy" type="button" id="slwCornerNow">' + esc(tx('care.corner.title')) + '</button>'
          : lm ? (lmOwned ? '' : '<button class="slw-btn" type="button" id="slwSeeLand">' + esc(tx('isle.seeLand', { land: isleName(lm) })) + '</button>')
          : s.state === 'owned'
          ? ((it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant') ? '<button class="slw-buy" type="button" id="slwUse">Use it</button>' : '') +
            (it.kind === 'attraction' && it.game ? '<button class="slw-buy" type="button" id="slwPlayNow">▶ Play</button>' : '')
          /* the time line sits right under these two, before Watch a preview (a full-width line in the same row) */
          /* R2 (QA2B-11): the time line sits right under '📚 Learn and come back' at every width (the two in one column),
             with 🎯 beside them or under them: never a line that reads as if it were about the goal button */
          : s.state === 'short' && !trial() ? '<div class="slw-learnwrap"><button class="slw-learnbtn" type="button" id="slwLearnNow" data-fk="item:learn">' + esc(tx('learn.andBack')) + '</button>' +
            (learnAt ? '<div class="slw-learntime">' + esc(learnAt) + '</div>' : '') + '</div>' + goalB
          : needIt ? '<button class="slw-btn" type="button" id="slwSeeNeed">' + esc(tx('isle.seeLand', { land: needIt.name })) + '</button>' + goalB
          : '<button class="slw-buy" type="button" id="slwBuyNow"' + (s.state !== 'affordable' ? ' disabled' : '') + '>' + (s.state === 'affordable' ? (s.free ? '🎁 Get it free' : 'Buy for ' + money(priceOf(it))) : s.state === 'locked' ? '🔒 Locked' : s.state === 'capped' ? 'Plenty for testing ✓' : 'Not enough ' + SYM() + ' yet') + '</button>' +
            goalB) +
        trip + (demoGame ? '<button class="slw-btn" type="button" id="slwDemo">▶ Watch a preview</button>' : '') + peopleBtns(it, s) +
      '</div></div></div>', { onClose: o && o.onClose });
    ov.setAttribute('data-item', id);
    var ln = $('#slwLearnNow', ov); if (ln) ln.addEventListener('click', function () { startTrip(id, 'item'); });
    var sn = $('#slwSeeNeed', ov); if (sn) sn.addEventListener('click', function () { ov._close(); openItem(needIt.id); });
    fillPhotocards(ov);
    wirePeopleBtns(ov, it);
    var ig = $('#slwIsleGo', ov);
    if (ig) ig.addEventListener('click', function () {
      var k = lm || ik, uid = lm ? landmarkUid(W(), lm) : null;
      closeAllOverlays();
      goIsle(k).then(function (ok) { if (ok && uid && isleNow() === k) s3('frameItem', uid); });
    });
    var sl = $('#slwSeeLand', ov); if (sl) sl.addEventListener('click', function () { ov._close(); openItem(C.ISLES[lm].unlock); });
    var cn = $('#slwCornerNow', ov); if (cn) cn.addEventListener('click', function () { closeAllOverlays(); openCareCorner(pc ? (pc.corner.petId ? { petId: pc.corner.petId, tab: pc.corner.tab } : { tab: pc.corner.tab }) : { tab: 'home' }); });
    var bn = $('#slwBuyNow', ov);
    if (bn) bn.addEventListener('click', function () { buyItem(it, bn, $('#slwItemErr', ov), function (ok) { if (ok) ov._close(); }); });
    var gn = $('#slwGoalNow', ov); if (gn) gn.addEventListener('click', function () { toggleGoal(id).then(function (changed) { if (changed !== false) ov._close(); }); });
    var un = $('#slwUse', ov); if (un) un.addEventListener('click', function () { useOwned(it); ov._close(); });
    var pn = $('#slwPlayNow', ov); if (pn) pn.addEventListener('click', function () { ov._close(); closeAllOverlays(); launch(it.game); });
    var dm = $('#slwDemo', ov);
    if (dm) dm.addEventListener('click', function () {
      dm.disabled = true;
      loadGameWithin(demoGame).then(function () {
        var host = $('#slwBig', ov); if (!host) return;
        host.innerHTML = '';
        var stop = window.SLGames[demoGame].demo(host, { variant: it.kind === 'variant' ? it.id : null, world: W(), seconds: 7, endText: s.state === 'owned' ? 'It’s yours — play it on your island!' : (trial() ? 'Get it free to play!' : 'Buy it to play!') });
        var prevClose = ov._close;
        ov._close = function () { try { stop(); } catch (e) {} prevClose(); };
        setTimeout(function () { dm.disabled = false; }, 7500);
      }).catch(function () { dm.textContent = 'Preview unavailable offline'; });
    });
    return ov;
  }

  /* the purchase flow: confirm (expensive only) → locked commit → celebrate. o.quiet (people-ui's buy, KU-CH13) and
     o.care (the Pet Shop's buy, P3.2): no celebration of the host's own (the sheet plays its own), and 'Not yet' on the
     confirm card answers done(false). o.answer (the Pet Shop's Clothes, d-pets): the host's own celebration, and 'Not
     yet' (or a throw) still answers done(false) */
  function buyFlow(it, btn, errEl, done, o) {
    var quiet = !!(o && (o.quiet || o.care)), answer = quiet || !!(o && o.answer), went = false;
    if (buying || confirming) return;   /* a double-tap must not stack two confirm boxes */
    var u = me();
    var chk = C.purchaseCheck(u, it.id, TO());
    if (!chk.ok) { if (errEl) errEl.textContent = chk.reason; return done && done(false); }
    var proceed = function () {
      buying = true; went = true;
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
          endTrip(it.id);                                 /* a learn-and-come-back trip for it is over (wave 3) */
          if (done) done(true);
          if (o && o.care) careBought(it); else if (quiet) peopleChanged(); else afterPurchase(it, res, wasGoal);
          shopLast = null;                                /* only a placement started by this buy goes back to the shop */
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
        if (answer && done) done(false);
      });
    };
    /* the price in the wallet the purchase uses (chk.price: 🪙 since the two wallets, F-KU5); ECONOMY.confirmAt is in that money too */
    var cost = typeof chk.price === 'number' ? chk.price : priceOf(it);
    if (!chk.trial && cost >= C.ECONOMY.confirmAt) {
      var c = overlay('<h2>Buy ' + esc(it.name) + '?</h2><div class="big" style="width:140px;margin:8px auto;position:relative;">' + iconHtml(it.id, artState(W())) + '</div>' +
        '<p style="font-weight:700;">It costs <b>' + money(cost) + '</b>. You’ll have <b>' + money(balOf(u) - cost) + '</b> left.</p>' +
        '<p class="slw-moneynote" style="font-size:13px;font-weight:700;color:#6b6390;margin-top:-4px;">' + (coinsOn() ? esc(tx('coins.confirm.note')) : 'These are the same ⭐ you save for real prizes in 🎁 My rewards.') + '</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;"><button class="slw-btn big" type="button" id="slwNo">Not yet</button><button class="slw-buy" type="button" id="slwYes" style="flex:0 0 auto;padding:10px 22px;">Yes, buy it!</button></div>', { small: true, onClose: function () { confirming = false; if (answer && !went && done) done(false); } });
      confirming = true;
      fillPhotocards(c);
      $('#slwNo', c).addEventListener('click', function () { c._close(); });
      $('#slwYes', c).addEventListener('click', function () { went = true; c._close(); proceed(); });
      return;
    }
    proceed();
  }

  function afterPurchase(it, res, isGoal) {
    var w = W();
    /* bought in another tab meanwhile: no reveal; a sky land just takes the child there */
    if (res.replay) { toast('✓ ' + it.name + ' is yours.'); draw(); if (isleOfLand(it)) goIsle(it.isle); return; }
    sample('coins', 0.8) || sfx('fanfare');
    if (isPeople(it)) { draw(); peopleBought(it, isGoal); return; }     /* a character or a piece (KU-CH17) */
    if (isGoal && it.kind !== 'attraction' && it.kind !== 'land') {
      if (it.kind === 'pet') freshPets[it.id] = true;   /* a goal pet walks out on Home too (D112) */
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
        if (isleNow() !== k) nextLeft = isleNow();     /* the Next step card offers no visit straight back (d-island) */
        visitIsle = k; skyMapOn = false; selectedUid = null; landTurn[k] = (landTurn[k] || 0) + 1;
        draw(); card(); revealView();
        return;
      }
      if (!on3D() || !canTravel() || typeof stage3d.unlockIsle !== 'function' || mode === 'place') { draw(); card(); return; }
      closeAllOverlays();                             /* a shop left under the land's sheet too: the child watches the reveal */
      var seq = ++travelSeq, from = isleNow(), fromMap = skyMapOn;
      if (from !== k) nextLeft = from;
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
      /* d-3d: the card names the game's own sign (buy.game.look: SIGN_WORDS) */
      celebrate({ title: (isGoal ? '🎯 Goal reached! ' : '🎉 ') + it.name + '!', sub: res.placedUid ? signWords('look', it) + (trial() ? '' : ' Yours forever!') : 'Your island is full — put something away in ✏️ Edit to make room. You can play it from 🎮 Games right now.', icon: it.id, sfx: 'fanfare',
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
      var ap = runnerId(w);                            /* new gear goes on the runner, a mascot too */
      if (ap) commit(function (u) { return C.equipAccessory(u, ap, it.id); }).then(function () { draw(); });
      /* the card shows it on the runner; the button opens the Pet Corner on the runner with its wear tray open (the
         legacy crew sheet only without pet care), to swap it round (F-KU2, review A2) */
      /* the line names the pet wearing it ('Biscuit is wearing it…', r2-pets' buy.accPet; QA2A-15), never 'your runner' */
      var apc = ap ? C.crewPet(w, ap) : null;
      celebrate({ title: it.name, sub: apc && apc.name ? tx('buy.accPet', { name: apc.name }, tx('buy.acc')) : tx('buy.acc'), icon: it.id, btns: ap ? [{ label: tx('label.crew'), fn: function () { if (careUI()) openCareCorner({ petId: ap, dress: true }); else openPets(ap); } }] : [] });
      return;
    }
    if (it.kind === 'cosmetic' || it.kind === 'variant') { draw(); celebrate({ title: it.name, sub: tx('buy.cosmetic'), icon: it.id }); return; }
    /* pet food goes into the pantry (never onto the island): how much is there now */
    if (it.kind === 'food') { draw(); toast(tx('care.pantry') + ': ' + it.name + ' × ' + (typeof C.pantryCount === 'function' ? C.pantryCount(W(), it.id) : 0)); return; }
    /* placeable decor/path/fun → straight into placement on the island it may stand on, which can be skipped */
    placeBought(it);
  }

  function celebrate(o) {
    endActivity('sheet');                     /* (IA-5) */
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
          pv + '<span>' + esc(it.name) + (own ? (on ? ' ✓' : '') : ' · ' + esc(freeOr(priceOf(it)))) + '</span></button>';
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
      if (!accs.length) return '<div class="slw-unlocks" id="slwWear-' + id + '">' + esc(tx('crew.wearNone')) + '</div>';
      return '<div class="slw-wearslots" id="slwWear-' + id + '" role="group" aria-label="' + esc(tx('crew.wear') + ': ' + p.name) + '">' + trays(w, p, accs).map(function (r) {
        var lid = 'slwWL-' + id + '-' + r.slot;
        return '<div class="slw-wearrow"><span class="lb" id="' + lid + '">' + esc(tx(r.labelKey)) + '</span><div class="slw-tray" role="group" aria-labelledby="' + lid + '" data-slot="' + r.slot + '">' +
          (r.items.length ? r.items.map(function (a) {
            return '<button type="button" class="slw-trayitem' + (a.on ? ' on' : '') + '" data-acc="' + a.id + '" data-pet="' + id + '" data-fk="acc:' + id + ':' + a.id + '" aria-pressed="' + a.on + '">' +
              '<span style="display:block;position:relative;height:56px;">' + iconHtml(a.id) + '</span><span>' + esc(C.item(a.id).name) + (a.on ? ' ✓' : '') + '</span></button>';
          }).join('') : '<button type="button" class="slw-trayitem" data-more="1" data-fk="more:' + r.slot + '"><span class="pv">' + ico('shop') + '</span><span>' + esc(tx('crew.more')) + '</span></button>') + '</div></div>';
      }).join('') + '</div>';
    }
    function memberHtml(w, p, accs) {
      var it = C.item(p.id), id = p.id, open = wearOpen === id;
      return '<div class="slw-card slw-member" data-member="' + id + '"><div class="slw-mtop"><div class="slw-mpic"><div style="width:120px;position:relative;">' + iconHtml(p.id, { acc: C.wornBy(w, p.id) }) + '</div></div><div class="slw-minfo">' +
        '<h3 class="nm slw-mname">' + esc(p.name) + ' <span class="sp">the ' + esc(it.name.toLowerCase()) + '</span>' + (p.active ? ' 🏅' : '') + '</h3>' +
        (p.from ? '<span class="chip uni">' + esc(tx('crew.from', { island: p.from })) + '</span>' : '') +
        '<div class="slw-mrow"><button type="button" class="slw-btn' + (open ? ' on' : '') + '" data-wear="' + id + '" data-fk="wear:' + id + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="slwWear-' + id + '"' : '') + '>' + esc(tx('crew.wear')) + '</button>' +
        (p.active ? '' : '<button class="slw-btn" type="button" data-active="' + id + '" data-fk="run:' + id + '">' + esc(tx('crew.makeRunner')) + '</button>') + '</div></div></div>' +
        '<div class="slw-mrow"><label>New name <input data-name="' + id + '" data-fk="name:' + id + '" maxlength="14" value="' + esc(p.name) + '"></label>' +
        '<button class="slw-btn" type="button" data-rename="' + id + '" data-fk="rename:' + id + '">Save name</button></div><div class="slw-err" data-err="' + id + '" role="alert"></div>' +
        (open ? wearHtml(w, p, accs) : '') + '</div>';
    }
    /* the list: who rests indoors, then every member (the sheet is built with it, so its first focus is the first member) */
    function crewHtml() {
      var w = W(), cs = SH ? SH.crewSheet(C, w, crewCap()) : { list: C.crewList(w), resting: 0 };
      var accs = C.CATALOG.filter(function (it) { return it.kind === 'acc' && C.owns(w, it.id); });
      /* with pet care the sheet is home, and the line says who is at the Pet Hotel (KU9) */
      return (cs.hotel ? '<p class="slw-crewnote">' + esc(tx('care.hotel.count', { n: cs.hotel })) + '</p>'
        : cs.resting ? '<p class="slw-crewnote">' + esc(tx('crew.resting', { n: cs.resting })) + '</p>' : '') +
        cs.list.map(function (p) { return memberHtml(w, p, accs); }).join('');
    }
    var ov = overlay('<h2>' + lbl('crew', tx('crew.title')) + '</h2><div style="font-size:13px;color:#6b6585;font-weight:700;margin-bottom:8px;">' + esc(promiseLine()) + ' ' + esc(tx('crew.runner')) + '</div>' +
      '<div id="slwCrewBody">' + crewHtml() + '</div><button class="slw-btn" type="button" id="slwMorePets" data-fk="more">' + lbl('shop', tx('crew.more')) + '</button>');
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
        var to = wearOpen === id ? sheet.getBoundingClientRect().top + (sheet.clientTop || 0) + headH(ov) + 8 : y0;
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
    function more() { ov._close(); openShop({ isle: 'home', shelf: 'pets' }); }   /* Home's Pets shelf (wave 3) */
    $('#slwMorePets', ov).addEventListener('click', more);
    finish({});
    /* opened on one member ('Name them' after an adoption, the Crew button after new gear): after the sheet's own first
       focus, focus moves to its name box or its Wear button and its block comes up to the top of the sheet */
    if (first) setTimeout(function () {
      var el = $(nameIt ? '[data-name="' + first + '"]' : '[data-wear="' + first + '"]', ov), y = memberTop(first);
      try { if (el) { el.focus({ preventScroll: true }); if (nameIt && el.select) el.select(); } } catch (e) {}
      if (y != null) sheet.scrollTop = (sheet.scrollTop || 0) + y - (sheet.getBoundingClientRect().top + (sheet.clientTop || 0) + headH(ov) + 8);
    }, 60);
  }

  /* ---------------- info ---------------- */
  function openInfo() {
    var st = arcadeState();
    var ov = overlay('<h2>❓ How My Island works</h2>' +
      (coinsOn() ? '<p class="slw-howmoney" style="font-weight:700;line-height:1.6;">📚 <b>Learn</b> anywhere in the app → you earn coins for your island, and the same number of points for My rewards.<br>' +
        (trial() ? '🧪 Everything in the Island Shop is <b>free while we test</b>. Nothing is spent.' : '🪙 <b>Spend</b> coins in the Island Shop → your island grows.') + '<br>' + esc(tx('info.sky')) +
        '<br>🎮 <b>Play</b> your island games: playing never costs or earns coins or points.<br>' + esc(promiseLine()) + '<br>⭐ The island never spends your points. They stay for My rewards.</p>'
      : '<p style="font-weight:700;line-height:1.6;">📚 <b>Learn</b> anywhere in the app → you earn ⭐ points.<br>' + (trial() ? '🧪 Everything in the Island Shop is <b>free while we test</b> — your ⭐ stay put.' : '🛍️ <b>Spend</b> them in the Island Shop → your island grows.') + '<br>' + esc(tx('info.sky')) + '<br>🎮 <b>Play</b> your island games — they’re just for fun and never cost or earn points.<br>' +
      esc(promiseLine()) + (trial() ? '' : '<br>⭐ Spending points never lowers your total-earned score.') + '</p>') + timeHtml(st) + looksHtml() +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="slw-btn" type="button" id="slwReplay">▶ Show the welcome again</button>' +
      (can3DAgain() ? '<button class="slw-btn" type="button" id="slw3dAgain">Try 3D again</button>' : '') + '</div>', { small: true });
    $('#slwReplay', ov).addEventListener('click', function () { ov._close(); showIntro(); });
    wireLooks(ov);
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
    if (!st.status.limited) return '<div class="slw-time" style="background:#f1edfb;border-color:#d9d2ee;color:#4a3f75;">🎮 ' + esc(tx('games.noLimit', null, 'There’s no daily game time limit for you.')) + '</div>';
    var m = Math.floor(st.status.leftSec / 60), s = Math.floor(st.status.leftSec % 60);
    /* under a minute: '50 seconds left today', never '0 min 50 s' (R2, QA2C-10) */
    var left = m > 0 ? m + ' min ' + (s ? s + ' s ' : '') : s + (s === 1 ? ' second' : ' seconds');
    return '<div class="slw-time">⏱️ Your grown-up set <b>' + Math.round(st.status.limitSec / 60) + ' minutes</b> of island games a day. ' +
      (st.status.exhausted ? 'That’s all for today — see you tomorrow! 📚 Learning is still open.' : '<b>' + left.replace(/\s+$/, '') + '</b> left today.') + '</div>';
  }

  /* ---------------- intro (once, skippable) ---------------- */
  /* the welcome waits until the island is drawn (D2): the 2D island draws at once; a 3D stage first shows its
     first frame and, on the first open, plays its Sky tour (about 3 s), so the slides sit over the island and not
     over an empty frame (the 2D island stays up while a slow 3D load is still on its way, so nothing is lost). It
     also waits while a sheet or a game is open. A mounted stage that shows no frame within INTRO_STUCK gets it
     anyway; after INTRO_GIVEUP it waits for the next open (introSeen stays unset) */
  var INTRO_POLL = 250, INTRO_TOUR = 3600, INTRO_STUCK = 20000, INTRO_GIVEUP = 120000;
  var introWait = 0, stageShownAt = 0, stageMountedAt = 0, tourOn = false;
  function islandDrawn() {
    if (stage3d) return stageShownAt ? Date.now() - stageShownAt >= (tourOn ? INTRO_TOUR : 300) : Date.now() - stageMountedAt >= INTRO_STUCK;
    return !booting3d && !late3d;                   /* 2D for good, not a 3D stage still on its way (a slow first load) */
  }
  function introWhenDrawn() {
    if (introWait) return;
    var who = state.activeUser, t0 = Date.now();
    (function poll() {
      introWait = setTimeout(function () {
        introWait = 0;
        if (renderedFor !== who || !root) return;                            /* the island closed, or another child */
        var w = W(), waited = Date.now() - t0;
        if (!w || w.introSeen || document.querySelector('.slw-intro')) return;
        /* never under a finger: 1 s after the last tap or key (R2, QA2D-2), or the tap ends the welcome unread */
        if (!running && coverCount === 0 && islandDrawn() && !busyHands()) showIntro();
        else if (waited < INTRO_GIVEUP) poll();
      }, INTRO_POLL);
    }());
  }
  function maybeIntro() {
    var w = W(); if (!w) return;
    if (!w.introSeen) { introWhenDrawn(); return; }
    if (!maybeMakeoverV3(w)) maybeMakeover(w);         /* the sky note first; the v2 city note waits for the next open */
    /* 'Testing’s over' is the island-open queue's card now (trial.over, before the coins card; R2, QA2B-2): one card per
       open, after the notes, never under a toast */
  }
  /* 'Testing’s over — thank you!' → a promise that settles when it closes. Seen only when the child closes it (Got it, ✕,
     Esc): it tells them about the coins too, so no 'Island coins are here' after it (F-KU5 review) */
  function showTrialOver() {
    return new Promise(function (resolve) {
      var ov = overlay('<div class="slw-intro slw-trialover"><div class="card" style="margin:0 auto;"><div class="hero">' + (coinsOn() ? '🪙 🏝️' : '⭐ 🏝️') + '</div><h2>Testing’s over — thank you!</h2>' +
        (coinsOn() ? '<p style="font-weight:700;color:#4a3f75;">' + esc(tx('coins.trialOver.body')) + '</p><p style="font-weight:700;color:#4a3f75;">' + esc(tx('coins.trialOver.keep')) + '</p>'
          : '<p style="font-weight:700;color:#4a3f75;">From now on, island things cost ⭐ — the same ⭐ you save for real prizes in 🎁 My rewards. Everything you already picked is still on your island.</p>') +
        '<div style="display:flex;justify-content:center;"><button class="slw-btn big on" type="button" id="slwTrialOk">Got it</button></div></div></div>',
        { small: true, noBackdrop: true, onClose: function (how) {
          if (how === 'all' || how === 'backdrop') { resolve(); return; }
          commit(function (u) {
            var fw = C.ensureWorld(u); if (fw.trialOverSeen) return { ok: false };
            fw.trialOverSeen = true;
            if (coinsOn() && fw.tutSeen) fw.tutSeen.coins = true;
            return { ok: true };
          }).then(resolve, resolve);
        } });
      $('#slwTrialOk', ov).addEventListener('click', function () { ov._close(); });
    });
  }
  /* 'Testing’s over' is still to show on this island (test mode off, free things tagged, the card not seen) */
  function trialOverDue(w) { return !trial() && !!w && !w.trialOverSeen && (w.ledger || []).some(function (e) { return e && e.trial; }); }
  /* an island from before v3, once (D23): it moved up into the sky, with a way to see the other islands
     (3D only: the Sky map). The note waits for a stage still booting and for another toast to finish */
  var skyNoted = {};
  function maybeMakeoverV3(w) {
    if (w.tutSeen.pixelV3) return false;
    if (skyNoted[state.activeUser]) return true;               /* once, even if a refresh lands before the save */
    skyNoted[state.activeUser] = true;
    commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen.pixelV3) return { ok: false }; fw.tutSeen.pixelV3 = true; return { ok: true }; });
    noteWhenQuiet(function () {
      toast(tx('makeover.v3'), mapChip() ? { label: tx('makeover.v3Btn'), fn: function () { if (mode === 'play') skyMap(true); } } : null);
    });
    return true;
  }
  /* a note toast (the sky move, the city makeover) once the island is quiet. The island-open queue waits for it (notesDue).
     It waits for a stage still booting and for another toast (about 8 s at most), and for as long as any sheet, card or
     the app's own pop-up is up (OPEN_WAIT at most, as the queue does): never a toast over a card (R2, QA2B-2) */
  function noteWhenQuiet(show) {
    var who = state.activeUser, tries = 0, t0 = Date.now();
    notesDue++;
    (function later(ms) {
      setTimeout(function () {
        if (renderedFor !== who || !root) { notesDue--; return; }   /* the island closed, or another child is on it */
        if (document.querySelector('.slw-ov, .slw-cele, [data-sl-modal]')) {
          if (Date.now() - t0 < OPEN_WAIT) return later(700);
          notesDue--; return;                                       /* a sheet up for minutes: the note is let go */
        }
        if ((booting3d || document.querySelector('.slw-toast')) && ++tries < 12) return later(700);
        notesDue--;
        show();
      }, ms);
    }(900));
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
    noteWhenQuiet(function () {
      toast(tx('makeover.toast'), { label: tx('makeover.revert'), fn: function () {
        commit(function (u) { return C.select(u, 'shape_cottage'); }).then(function (res) { if (res && res.ok) { draw(); sfx('correct'); } });
      } });
    });
  }
  function showIntro() {
    /* the welcome: an island in the sky with five more floating nearby (the v2 slides promised a city across the bay) */
    var slides = [
      ['🏝️', tx('intro.1.title'), tx('intro.1.body')],
      coinsOn() ? ['📚 ➜ 🪙', 'Learn to earn', tx('intro.2.coinsBody')] : ['📚 ➜ ⭐', 'Learn to earn', 'Every maths, spelling or flags session earns ⭐.'],
      trial() ? ['🧪 🎁', tx('intro.3.trialTitle'), coinsOn() ? tx('intro.3.trialCoins') : tx('intro.3.trialBody')]
        : coinsOn() ? ['🪙 ➜ 🏝️', tx('intro.3.title'), tx('intro.3.coinsBody')] : ['⭐ ➜ 🏝️', tx('intro.3.title'), tx('intro.3.body')]
    ];
    /* pet care (pets U2): one more slide, a pet beside its bowl; care starts when the welcome closes, and a new player
       is offered the Pet Shop after it (pets.adoptOffer, KU13) */
    var P = care(), who = state.activeUser;
    if (P) slides.splice(2, 0, [careHero(), tx('care.corner.title'), tx('care.intro')]);
    var i = 0;
    /* the open that shows the welcome shows nothing unasked after it (R2, QA2A-3): the queue's run knows */
    if (openRun && openRun.who === who) openRun.welcome = true;
    /* once only: a tap beside it does nothing, and only a close the child chose (Let’s go, Skip, ✕, Esc) marks it seen;
       closed by the island moving on (another child, a trip), it comes again on the next open */
    var ov = overlay('<div class="slw-intro"><div class="card" style="margin:0 auto;" id="slwIntro"></div></div>', { small: true, noBackdrop: true, onClose: function (how) { if (how !== 'all' && how !== 'backdrop') finish(); } });
    function finish() {
      var day = careDay(), ms = nowMs(), fresh = false;
      commit(function (u) {
        var w = C.ensureWorld(u);
        if (w.introSeen) return { ok: false };
        w.introSeen = true;
        if (coinsOn() && w.tutSeen) w.tutSeen.coins = true;   /* the welcome told a new player about the coins: no coin card for them (F-KU5) */
        if (P && !careStarted(w)) fresh = !!P.start(u, day, ms).started;
        return { ok: true };
      }).then(function (res) { if (res && res.ok && fresh) { adoptDue[who] = true; careChanged(); } });
    }
    function paint() {
      var s = slides[i], last = i === slides.length - 1;
      /* the last slide has only Let’s go: Skip beside it would do the same (R2, QA2A-13) */
      $('#slwIntro', ov).innerHTML = '<div class="hero">' + s[0] + '</div><h2>' + esc(s[1]) + '</h2><p style="font-weight:700;color:#4a3f75;">' + esc(s[2]) + '</p>' +
        '<div class="slw-dots">' + slides.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;">' + (last ? '' : '<button class="slw-btn" type="button" id="slwSkip">Skip</button>') + '<button class="slw-btn big on" type="button" id="slwNext">' + (last ? 'Let’s go' : 'Next ➜') + '</button></div>';
      var sk = $('#slwSkip', ov); if (sk) sk.addEventListener('click', function () { ov._close(); });
      $('#slwNext', ov).addEventListener('click', function () { if (i < slides.length - 1) { i++; paint(); } else ov._close(); });
      try { $('#slwNext', ov).focus(); } catch (e) {}
    }
    paint();
  }

  /* ---------------- savings-goal reached ---------------- */
  /* never in test mode (QA 9): everything is free there, so 'you've saved enough' means nothing; nothing is marked
     as told either, so the card still comes once real prices are back */
  function checkGoalReached(onOpen) {
    var u = me(); if (!u || trial()) return false;
    var w = C.ensureWorld(u), gp = C.goalProgress(u);
    if (!gp || !gp.ready || gp.full || w.goalNotified === gp.id) return false;   /* full: a pet goal the pet cap shuts out (A4) */
    commit(function (fu) { var fw = C.ensureWorld(fu); if (fw.goalNotified === gp.id) return { ok: false }; fw.goalNotified = gp.id; return { ok: true }; });
    window._slwLastGoal = gp.id;
    if (onOpen) goalShown = { id: gp.id, at: Date.now() };   /* wave 3: a trip for this goal does not open its sheet as well */
    if (onOpen) celebrate({ title: '🎯 Goal reached', sub: 'You’ve saved enough for ' + gp.name + '. Buy it now, or keep saving for something bigger.', icon: gp.id, sfx: 'fanfare', btns: [{ label: 'Go to it', fn: function () { openItem(gp.id); } }] });
    return !!onOpen;
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

  /* ================================================================
     THE KIDS UPDATE: CHARACTERS AND THE ISLAND-OPEN QUEUE (KU-CH17; plan-ku KU13, KU20, KU21, KU28,
     KU34; characters.json design.avatarReplacement and uiFlows.child). Inert without its module: no
     SLPeopleCore → no character card, no ✎ badge, no My character, no Wardrobe tab, the classic
     avatar everywhere. SLPeopleUI draws the character sheets with the ctx built here; the people files
     come through window.slLoadPeople() the first time a character is drawn, the first-open card shows or
     a people card draws (KU21). Nothing here is stored: the ✎ badge is derived, the queue is memory only.
     ================================================================ */
  function PC() { return window.SLPeopleCore || null; }
  function isPeople(it) { return !!it && (it.kind === 'char' || it.kind === 'wear'); }
  /* the child's character (SLPeopleCore.avatarInfo, the one source), or null: the classic avatar */
  function charInfo(w, u) {
    var P = PC();
    if (!P || !w || typeof P.avatarInfo !== 'function') return null;
    try { return P.avatarInfo(w, u) || null; } catch (e) { return null; }
  }
  function peopleArt() { return window.SLPeopleArt || null; }
  function peopleReachable() { return !!window.SLPeopleUI || typeof window.slLoadPeople === 'function'; }
  /* the ✎ on 'That’s you!' while there is no character yet: derived, never stored */
  function badgeOn(w, u) { return !!PC() && peopleReachable() && !!w && !charInfo(w, u); }
  /* My character's icon in the island bar: a person in the bar's line set (24 grid, 2px round strokes, currentColor) */
  /* the ✎: the bar's own pencil (ART.uiIcon edit), drawn in the badge's ink; the glyph only without the icon set */
  function PENCIL() { return ico('edit') || '✎'; }
  var ME_ICO = '<svg class="slw-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.6-4.2 3.4-6.8 7-6.8s6.4 2.6 7 6.8"/></svg>';
  var peopleLoad = null, peopleFailAt = -1e9;
  /* the people files, once (index.html's slLoadPeople) → Promise<bool>. A failed load may be tried again: at once
     for a tap (force), else not for PEOPLE_RETRY ms, so an offline 2D island never asks on every redraw */
  var PEOPLE_RETRY = 20000;
  function loadPeople(force) {
    if (peopleArt() && window.SLPeopleUI) return Promise.resolve(true);
    if (peopleLoad) return peopleLoad;
    var f = window.slLoadPeople;
    if (typeof f !== 'function') return Promise.resolve(!!peopleArt());
    if (!force && Date.now() - peopleFailAt < PEOPLE_RETRY) return Promise.resolve(false);
    peopleLoad = Promise.resolve().then(function () { return f(); }).then(function () {
      peopleLoad = null;
      var ok = !!peopleArt();
      if (ok) visitorPeopleIn();                       /* a 3D visitor's portrait becomes its figure (IA-5) */
      return ok;
    }, function () { peopleLoad = null; peopleFailAt = Date.now(); return false; });
    return peopleLoad;
  }
  /* a character to draw before its files are in (the classic figure stands in meanwhile): load, then draw it */
  function wantPeople() {
    if (!PC()) return;
    var who = state.activeUser;
    loadPeople().then(function (ok) {
      if (!ok || !root || renderedFor !== who || running) return;
      if (on3D()) s3('sync', islandView());
      else if (peopleArt()) drawStage();
    });
  }
  /* the stage's player figure: the classic {color, emoji, name}, plus the character's look, wear, colourways,
     move and codes when there is one (plan-ku contracts.avatarInfo); no look = the classic avatar */
  function avatarView(w, u) {
    var av = { color: u.color || '#6C5CE7', emoji: u.avatar || '🙂', name: u.name || '' }, ci = charInfo(w, u);
    if (ci && ci.look) ['look', 'wear', 'vr', 'sig', 'lk', 'wr'].forEach(function (k) { if (ci[k] != null) av[k] = ci[k]; });
    var PX = window.SLPxPeople;
    if (ci && PX && typeof PX.ready === 'function' && !PX.ready()) wantPeople();
    return av;
  }
  /* a character's or a piece's picture (SLPeopleArt.icon: head and shoulders, or the Fitting Friend wearing it) in a
     photocard slot; empty until the people files are in, then filled in place (fillPeople) */
  function peopleIconHtml(id) {
    var A = peopleArt(), svg = '';
    if (A && typeof A.icon === 'function') { try { svg = A.icon(id, { color: userInfo().color }) || ''; } catch (e) { svg = ''; } }
    return '<span class="slw-pc slw-ppic" data-pc="' + esc(id) + '" data-pp="' + (svg ? '1' : '0') + '">' + svg + '</span>';
  }
  function fillPeople(el) {
    if (!el || !el.querySelector('[data-pp="0"]')) return;
    loadPeople().then(function (ok) {
      var A = peopleArt();
      if (!ok || !A || !el.isConnected) return;
      el.querySelectorAll('[data-pp="0"]').forEach(function (s) {
        var svg = '';
        try { svg = A.icon(s.getAttribute('data-pc'), { color: userInfo().color }) || ''; } catch (e) { svg = ''; }
        if (svg && !s.firstChild) { s.innerHTML = svg; s.setAttribute('data-pp', '1'); }
      });
    });
  }
  /* the island again after a character change in a sheet (the 3D figure or the 2D one, and the ✎) */
  function peopleChanged() {
    if (!root || running || renderedFor == null) return;
    if (on3D()) { s3('sync', islandView()); s3('setAnchors', anchors3D()); } else drawStage();
  }
  /* KU34: 'Find me on the island' (3D only, and only when the stage has focusMe; the Sky map closes first) */
  function canFindMe() { var IS = window.SLIsland3D; return on3D() && !!IS && typeof IS.focusMe === 'function'; }
  function findMe() {
    if (!canFindMe()) return;
    (skyMapOn ? skyMap(false) : Promise.resolve(true)).then(function () {
      try { window.SLIsland3D.focusMe({}); } catch (e) {}
      noteFind({ kind: 'findme', isle: 'home' });                 /* the 'Find yourself' stamp (IA-5) */
      var wrap = root && root.querySelector('.slw-stagewrap'), vh = window.innerHeight || 0;
      if (!wrap || !vh || typeof window.scrollTo !== 'function') return;
      var hd = document.querySelector('header.topbar'), top = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0, r = wrap.getBoundingClientRect();
      if (r.top < top || r.bottom > vh) try { window.scrollTo({ top: (window.pageYOffset || 0) + r.top - top - 8, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) {}
    });
  }
  /* KU-CH13's buy: the host's buy flow (the confirm card at ≥ 300, test mode, the fixed tx, the save) with no
     celebration of its own (people-ui plays the debut) → Promise<{ok}>; a confirm card closed with Not yet is {ok: false} */
  function buyQuiet(id) {
    var it = C.item(id);
    if (!isPeople(it) || buying || confirming) return Promise.resolve({ ok: false });
    return new Promise(function (res) {
      var settled = false;
      buyFlow(it, null, null, function (ok) { if (!settled) { settled = true; res({ ok: !!ok }); } }, { quiet: true });
    });
  }
  /* the ctx people-ui's sheets work through (people-ui.js header; KU-CH13) */
  function peopleCtx() {
    var ctx = {
      user: me,
      /* people-ui's 'Save up for it' sets the goal alone (C.setGoal): its saved name and price follow it here (R2) */
      commit: function (fn) {
        return commit(function (u) {
          var r = fn(u);
          if (r && r.ok) { try { goalMeta(C.ensureWorld(u)); } catch (e) {} }
          return r;
        }).then(function (res) { if (res && res.ok) peopleChanged(); return res; });
      },
      buy: buyQuiet, trial: trial, cover: cover, reduced: reduced, color: userInfo().color,
      openShop: function (slot) { openShop('wardrobe', { slot: slot }); },
      /* wave 3 (contract 5): a short character card's '📚 Learn': a learn-and-come-back trip that reopens it */
      learnFor: function (id) { return startTrip(id, 'cast'); },
      /* c-island (James, 26 Oct: 'Ask there too'): a cast card's '🎯 My goal' goes through the Island Shop's own
         toggleGoal, so swapping one goal for another asks 'Change your goal?' (Keep X / Yes, switch) there too.
         → Promise<bool> (did it change); one argument only (never the shop's `sure`) */
      toggleGoal: function (id) { return toggleGoal(id); },
      use3D: on3D() && !document.documentElement.classList.contains('sl-low')
    };
    if (canFindMe()) ctx.findMe = findMe;
    return ctx;
  }
  /* My character (the HUD entry, a tap on 'That’s you!', the ✎): people-ui shows the three choices when there
     is no character yet */
  var myOpening = false, meTapT = 0;
  function openMyChar(o) {
    if (!PC() || !peopleReachable() || myOpening || running || document.querySelector('.slp-ov')) return Promise.resolve(false);
    myOpening = true;
    return loadPeople(true).then(function () {
      myOpening = false;
      if (!window.SLPeopleUI || !root || running) return false;
      window.SLPeopleUI.openMy(peopleCtx(), o || {});
      return true;
    }, function () { myOpening = false; return false; });
  }
  /* a tap on 'That’s you!': the wave (2D) or the actors' own reaction (3D) is seen first, then My character */
  function meTapped() {
    /* island activities (IA-5): a tap on 'That’s you!' is finding yourself on the island too (the stamp's only way on the
       2D island, which has no Find me) */
    if (mode === 'play') noteFind({ kind: 'findme', isle: 'home' });
    if (!PC() || mode !== 'play' || Date.now() - meTapT < 900) return;
    /* the integration pass: during I spy, fetch or hide and seek the figure only waves; its sheet (My character, or
       'Who's going on your island?') would end the game under the child's finger, as the house's would (a show has
       ended on the tap already) */
    if (activity) return;
    meTapT = Date.now();
    setTimeout(function () { if (mode === 'play' && !document.querySelector('.slw-ov,.slw-cele')) openMyChar(); }, reduced ? 0 : 600);   /* the hop or the emote reads first */
  }
  /* a character or a piece bought in the Island Shop: its card, with the next step on it */
  function peopleBought(it, isGoal) {
    var w = W(), ci = charInfo(w, me()), btns = [], sub = isGoal ? tx('goal.reached') : '';
    if (it.kind === 'char') {
      var on = !!(ci && ci.id === it.id);
      if (!on) btns.push({ label: tx('char.cast.play', { name: it.name }), fn: function () { setActiveChar(it.id); } });
      celebrate({ title: on ? tx('char.debut', { name: it.name }) : it.name, sub: sub || (on ? '' : tx('char.cast.playNow', { name: it.name })), icon: it.id, sfx: 'fanfare', btns: btns });
      return;
    }
    if (ci) btns.push({ label: tx('wardrobe.wear'), fn: function () { wearPiece(it.id); } });
    else if (peopleReachable()) btns.push({ label: tx('char.badge'), fn: function () { openMyChar(); } });
    celebrate({ title: it.name, sub: sub, icon: it.id, sfx: 'fanfare', btns: btns });
  }
  function setActiveChar(id) {
    return commit(function (u) { return PC().setActive(u, id); }).then(function (res) { if (res && res.ok) { sfx('correct'); peopleChanged(); } return res; });
  }
  /* is this piece on the character now (a dye: its hair colour is the character's) */
  function wornNow(ci, it) { return !!(ci && it && (it.slot === 'dye' ? ci.look && ci.look.hc === it.hc : ci.wear && ci.wear[it.slot] === it.id)); }
  /* wear a piece on the active character (one commit, like the crew's wear trays); worn already = take it off.
     A hair dye sets the character's hair colour (as people-ui's wardrobe does) */
  function wearPiece(id) {
    var it = C.item(id);
    return commit(function (u) {
      var ci = charInfo(C.ensureWorld(u), u);
      if (!ci || !isPeople(it)) return { ok: false };
      return it.slot === 'dye' ? PC().setLook(u, ci.id, { hc: it.hc }) : PC().wear(u, ci.id, id);
    }).then(function (res) { if (res && res.ok) { sfx('correct'); peopleChanged(); } return res; });
  }

  /* ---------------- the Island Shop's people (KU-CH15's view-model: SLIslandShop.wardrobeTab / wardrobeCard) ----------------
     The 👕 Wardrobe tab (its slot chips, then that slot's cards), a land's Dress-up shelf (its character the lead
     card), the folded Wardrobe group in 'I can buy' and the All tab's one doorway. Every word on a people card is a
     world-copy key or catalogue data (names, themes, descriptions, land names): no literal text */
  var wardSlot = null;                               /* the open chip (null: the view-model's default, Outfits; F-KU3): this page session only */
  function wardrobeOn() { var SH = window.SLIslandShop; return !!PC() && !!SH && typeof SH.wardrobeTab === 'function' && typeof SH.wardrobeCard === 'function'; }
  function peopleCardHtml(u, id, lead) {
    var SH = window.SLIslandShop, it = C.item(id), c = null;
    try { c = wardrobeOn() ? SH.wardrobeCard(C, u, id, TO()) : null; } catch (e) { c = null; }
    if (!c || !it) return '';
    var ci = charInfo(C.ensureWorld(u), u), on = c.kind === 'char' ? !!c.active : wornNow(ci, it);
    var line = c.line ? tx(c.line.key, c.line.params) : '', price = money(c.price), chip = '', act = '';
    if (c.state === 'owned') {
      chip = '<span class="chip own">✓</span>';
      act = c.kind === 'char' ? '<button type="button" class="slw-buy" data-pplay="' + id + '" aria-pressed="' + on + '"' + (on ? ' disabled' : '') + '>' + (on ? '✓ ' : '') + esc(tx('char.cast.play', { name: c.name })) + '</button>'
        : ci ? '<button type="button" class="slw-buy" data-pwear="' + id + '" aria-pressed="' + on + '"' + (on && it.slot === 'dye' ? ' disabled' : '') + '>' + esc(tx(on && it.slot !== 'dye' ? 'wardrobe.off' : 'wardrobe.wear')) + '</button>'
        : peopleReachable() ? '<button type="button" class="slw-btn" data-pmake="1">' + esc(tx('char.badge')) + '</button>' : '';
    } else if (c.state === 'locked') {
      chip = '<span class="chip lock">🔒 ' + esc(line) + '</span>';
      act = '<button type="button" class="slw-btn" data-open="' + id + '">' + esc(tx('shop.seeIt')) + '</button>';
    } else if (c.state === 'short') {
      /* wave 3: the need line, then '📚 Learn' (a learn-and-come-back trip) beside the goal button */
      act = '<span class="slw-need">' + esc(line) + '</span>' + (trial() ? '' : '</div><div class="row slw-learnrow">' + learnBtnHtml(id) + '<button type="button" class="slw-goalbtn' + (c.goal ? ' on' : '') + '" data-goal="' + id + '" aria-pressed="' + c.goal + '">' + esc(goalWord(c.goal)) + '</button>');
    } else if (c.can) {
      act = '<button type="button" class="slw-buy" data-buy="' + id + '" aria-label="' + esc(c.name + ', ' + (c.free ? tx('wardrobe.free') : price)) + '">' + (c.free ? esc(tx('isle.unlockFree')) : price) + '</button>';
    }
    var LK = window.SLIslandLook, shine = LK && LK.shineLevel ? ' shine-' + LK.shineLevel(it.price) : '';   /* the catalogue ⭐ price, as every other card (the shine bands are in ⭐) */
    return '<div class="slw-card ppl' + (lead ? ' lead' : '') + shine + '" data-ppl="' + id + '"><button type="button" class="ic" data-open="' + id + '" aria-label="' + esc(c.name) + '">' + peopleIconHtml(id) + '</button>' +
      '<div class="nm">' + esc(c.name) + '</div><div class="ds">' + esc(dsc(it)) + '</div>' + peopleLines(it, c).map(function (l) { return '<div class="ln">' + l + '</div>'; }).join('') + chip +
      /* R2 (QA2A-12): owned, no price; free while we test, the struck price and 'Get it free' (no second 'Free' badge) */
      (c.state === 'owned' ? '' : c.free ? '<div class="pr"><s style="color:#9a94b5;font-weight:700;">' + price + '</s></div>' : '<div class="pr">' + price + '</div>') +
      '<div class="row">' + act + '</div></div>';
  }
  /* a character's theme, special move and what it comes with; a piece's slot (escaped HTML, one per line) */
  function peopleLines(it, c) {
    var SH = window.SLIslandShop, out = [];
    try { c = c || (wardrobeOn() ? SH.wardrobeCard(C, me(), it.id, TO()) : null); } catch (e) { c = null; }
    if (!c) return out;
    if (c.kind === 'char') {
      if (c.theme) out.push(esc(c.theme));
      if (c.move) out.push(esc(tx('char.cast.move', { move: tx(c.move.key) })));
      if (c.comes && c.comes.length) out.push(esc(tx('char.cast.comes', { items: c.comes.map(function (x) { var p = C.item(x); return p ? p.name : ''; }).filter(Boolean).join(', ') })));
    } else if (c.slotKey) out.push(esc(tx(c.slotKey)));
    return out;
  }
  function wardrobeTabHtml(u) {
    var tab = [];
    try { tab = wardrobeOn() ? window.SLIslandShop.wardrobeTab(C, u, { trial: trial(), slot: wardSlot }) : []; } catch (e) { tab = []; }
    if (!tab.length) return '';
    var open = tab.filter(function (s) { return s.open; })[0] || tab[0];
    wardSlot = open.key;
    return '<div class="slw-islefilter sticky" role="group" aria-label="' + esc(tx('wardrobe.title')) + '">' + tab.map(function (s) {
      var on = s === open;
      return '<button type="button" class="slw-btn' + (on ? ' on' : '') + '" data-wslot="' + s.key + '" data-fk="wslot:' + s.key + '" aria-pressed="' + on + '">' + esc(tx(s.labelKey)) + '</button>';
    }).join('') + '</div><div class="slw-grid">' + open.ids.map(function (id) { return peopleCardHtml(u, id); }).join('') + '</div>';
  }
  /* the detail sheet's people buttons: Try it on (a piece; preview only), Play as (an owned character), Wear / Take off */
  function peopleBtns(it, s) {
    if (!isPeople(it) || !PC()) return '';
    var ci = charInfo(W(), me()), html = '';
    if (it.kind === 'wear' && peopleReachable()) html += '<button class="slw-btn" type="button" id="slwTryOn">' + esc(tx('wardrobe.tryOn')) + '</button>';
    if (s.state === 'owned' && it.kind === 'char' && !(ci && ci.id === it.id)) html += '<button class="slw-buy" type="button" id="slwPlayAs">' + esc(tx('char.cast.play', { name: it.name })) + '</button>';
    if (s.state === 'owned' && it.kind === 'wear' && ci && !(it.slot === 'dye' && wornNow(ci, it))) html += '<button class="slw-buy" type="button" id="slwWearIt">' + esc(tx(wornNow(ci, it) ? 'wardrobe.off' : 'wardrobe.wear')) + '</button>';
    return html;
  }
  function wirePeopleBtns(ov, it) {
    var t = $('#slwTryOn', ov), p = $('#slwPlayAs', ov), wr = $('#slwWearIt', ov);
    if (t) t.addEventListener('click', function () { loadPeople(true).then(function () { if (window.SLPeopleUI && ov.isConnected) window.SLPeopleUI.tryOn(peopleCtx(), it.id); }); });
    if (p) p.addEventListener('click', function () { ov._close(); setActiveChar(it.id); });
    if (wr) wr.addEventListener('click', function () { ov._close(); wearPiece(it.id); });
  }

  /* ---------------- the island-open queue (KU13; plan-ku contracts.islandOpenQueue) ----------------
     enqueueOpen({id, prio, when(w, ctx) → bool, show(ctx) → Promise}). After a real My Island open the queue
     waits for the Sky tour, a land reveal, the welcome and the makeover notes, and any sheet, card or toast;
     then it shows the lowest prio whose when() holds, waits for it to finish, and goes on, at most OPEN_MAX
     cards per open (each entry once). The rest wait for the next open. Leaving the island, a game, another
     child or a newer open ends the run; so does OPEN_WAIT without a quiet moment. */
  /* R2 (QA2A-3, QA2B-2; James's list): a 7-year-old reaches the island after the welcome, or after ONE card. An open that
     shows the welcome shows nothing unasked after it (char.meet and the adopt offer wait for the next open; adoptDue is
     kept for it); any other open shows at most OPEN_MAX unasked cards ('Goal reached' on the open counts as one). What
     the child asked for (e.asked: nav.go, learn.trip, pets.feedAsk) always comes and never counts */
  var OPENQ = [], openRun = null, openPending = false, stageShown = false, notesDue = 0;
  var OPEN_MAX = 1, OPEN_POLL = 400, OPEN_WAIT = 300000, OPEN_STAGE = 15000;   /* 1 unasked card; 5 min for a quiet moment */
  function enqueueOpen(e) {
    if (!e || typeof e.id !== 'string' || typeof e.prio !== 'number' || typeof e.when !== 'function' || typeof e.show !== 'function') return false;
    OPENQ = OPENQ.filter(function (x) { return x.id !== e.id; }).concat([{ id: e.id, prio: e.prio, when: e.when, show: e.show, asked: e.asked === true, quiet: e.quiet === true }]);
    OPENQ.sort(function (a, b) { return a.prio - b.prio; });
    return true;
  }
  /* o.cards: unasked cards this open has shown already (the 'Goal reached' card) */
  function startOpenQueue(o) {
    if (!OPENQ.length) return;
    var w = W();
    var run = openRun = { who: state.activeUser, shown: (o && o.cards) || 0, done: {}, t0: Date.now(), until: Date.now() + OPEN_WAIT,
      welcome: !!(w && !w.introSeen) };                         /* the welcome is to come on this open */
    setTimeout(function () { stepOpenQueue(run); }, OPEN_POLL);
  }
  function worldShown() { var wv = document.getElementById('worldView'); return !!(wv && !wv.classList.contains('hidden')); }
  /* not now: edit mode, a stage still booting or not yet shown (OPEN_STAGE at most) or on its Sky tour, the welcome or a note
     still to come, any sheet, card or toast up (the app's own pop-ups too) */
  function openBlocked(run) {
    if (mode !== 'play' || booting3d || notesDue > 0 || introWait) return true;   /* introWait: the welcome is waiting for the drawn island (D2) */
    if (document.querySelector('.slw-ov, .slw-cele, .slw-toast, [data-sl-modal]')) return true;
    if (busyHands()) return true;                                                  /* 1 s after the last tap or key (R2, QA2D-2) */
    return on3D() && ((!stageShown && Date.now() - run.t0 < OPEN_STAGE) || !!(s3('info') || {}).tour);
  }
  /* an unasked card may still come on this run: not after the welcome, and OPEN_MAX at most */
  function unaskedRoom(run) { return !run.welcome && run.shown < OPEN_MAX; }
  function stepOpenQueue(run) {
    if (run !== openRun) return;
    if (!root || renderedFor !== run.who || running || !worldShown() || Date.now() > run.until) { openRun = null; return; }
    var w = W(), ctx = peopleCtx(), e = null, room = unaskedRoom(run);
    for (var i = 0; i < OPENQ.length && !e; i++) {
      var c = OPENQ[i], ok = false;
      /* island activities (IA-5, plan §6): a quiet entry (a scene beat, never a sheet, card or toast) never counts toward
         OPEN_MAX and is skipped on the welcome open */
      if (run.done[c.id] || (!c.asked && !c.quiet && !room) || (c.quiet && run.welcome)) continue;
      try { ok = !!c.when(w, ctx); } catch (er) { ok = false; }
      if (ok) e = c;
    }
    /* nothing due yet, but the welcome is still to come or still up: the child may ask for a place meanwhile (nav.go, the
       top bar), so the run waits for it (OPEN_WAIT at most) */
    if (!e && (introWait || document.getElementById('slwIntro'))) { setTimeout(function () { stepOpenQueue(run); }, OPEN_POLL); return; }
    if (!e) { openRun = null; return; }
    if (openBlocked(run)) { setTimeout(function () { stepOpenQueue(run); }, OPEN_POLL); return; }
    run.done[e.id] = true;
    var p;
    try { p = Promise.resolve(e.show(ctx)); } catch (er) { p = Promise.reject(er); }
    var next = function () { setTimeout(function () { stepOpenQueue(run); }, OPEN_POLL); };
    p.then(function () { if (!e.asked && !e.quiet) run.shown++; next(); }, next);
  }
  /* 'Who’s going on your island?' (prio 20): once, until it is answered (people-ui sets tutSeen.chars) */
  enqueueOpen({ id: 'char.meet', prio: 20,
    when: function (w) { return !!PC() && peopleReachable() && !!w && !w.tutSeen.chars && !charInfo(w, me()); },
    show: function (ctx) {
      return loadPeople(true).then(function () {
        if (!window.SLPeopleUI) throw new Error('people-ui');
        return window.SLPeopleUI.meetCard(ctx);
      }).then(function (r) { peopleChanged(); return r; });
    } });
  /* 'Island coins are here' (prio 6; F-KU5): once, for a child who had an island before the two wallets (the
     welcome tells a new player and sets the same tutSeen.coins). Coins come from learning, the ⭐ stay for My rewards,
     everything they have stays theirs; in test mode the coins wait for later. Seen when it closes */
  function coinsNewsHtml() {
    var lines = ['coins.news.earn', 'coins.news.stars', 'coins.news.keep', trial() ? 'coins.news.trial' : 'coins.news.start'];
    return '<div class="slw-intro slw-coinsnews"><div class="card" style="margin:0 auto;"><div class="hero">' + esc(SYM()) + '</div><h2>' + esc(tx('coins.news.title')) + '</h2>' +
      lines.map(function (k) { return '<p style="font-weight:700;color:#4a3f75;">' + esc(tx(k)) + '</p>'; }).join('') +
      '<div style="display:flex;justify-content:center;"><button class="slw-btn big on" type="button" id="slwCoinsOk">' + esc(tx('coins.news.ok')) + '</button></div></div></div>';
  }
  /* 'Testing’s over — thank you!' (prio 5.5, before the coins card; R2): once, when test mode has ended on an island that
     got free things while it was on */
  enqueueOpen({ id: 'trial.over', prio: 5.5,
    when: function (w) { return !!w && !!w.introSeen && trialOverDue(w); },
    show: function () { return showTrialOver(); } });
  enqueueOpen({ id: 'coins.news', prio: 6,
    when: function (w) { return coinsOn() && !!w && !!w.introSeen && !(w.tutSeen && w.tutSeen.coins) && !trialOverDue(w); },   /* 'Testing’s over' says it in one card */
    show: function () {
      return new Promise(function (resolve) {
        /* once only: seen when the child closes it (Got it, ✕, Esc); a tap beside it does nothing (R2, QA2D-2) */
        var ov = overlay(coinsNewsHtml(), { small: true, noBackdrop: true, onClose: function (how) {
          if (how === 'all' || how === 'backdrop') { resolve(); return; }
          commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen.coins) return { ok: false }; fw.tutSeen.coins = true; return { ok: true }; }).then(resolve, resolve);
        } });
        var ok = $('#slwCoinsOk', ov);
        if (ok) ok.addEventListener('click', function () { ov._close(); });
      });
    } });

  /* ================================================================
     THE KIDS UPDATE: PET CARE ON MY ISLAND (P4.1; plan-ku KU4, KU8, KU9, KU13, KU19, KU21, KU28, KU37, KU40;
     pets.json care.careStep, care.family, ui.child U1–U13). Inert without SLPetCare and SLPetCareUI (both come with
     the world scripts, KU21): no care step and no care cards, the whole crew out as before, the crew sheet behind 🐾.
     With them:
       · each real My Island open, after the repair and before the first draw: the grown-up's settings
         (slFamilyCfg.petCare, cached in care3.cfg) and the island day's step (SLPetCare.tick: once per island day)
         in one commit; then the grown-up's commands (families/{code}/kids/{uid}.pets), read once
       · the island-open queue's pets entries: pets.news 10, care.rule 15, pets.adoptOffer 30, care.day 40
       · the island shows the home pets that are not at the Pet Rescue (KU9) and careRunner's pet runs, follows
         you over the bridges and plays in the games (KU8); a peckish or hungry pet wears its badge; a tap is a pat
       · 🐾 opens the Pet Corner (P3.1); the Pet Shop (P3.2) is loaded on its first use; pets bought in the Island
         Shop are adopted through it (the cap's question, the name step)
       · the feeding moment plays on the 3D island (P3.3) or on the 2D island's sprite (pets U13)
     Every write is SLPetCare's or the core's, inside commit(); nothing awards ⭐ and nothing new is stored: which
     cards are due is memory only. Every word is a world-copy key or catalogue data (KU19).
     ================================================================ */
  function care() {
    var P = window.SLPetCare;
    return P && window.SLPetCareUI && typeof P.ready === 'function' && P.ready() && typeof C.petRoom === 'function' && typeof C.homePets === 'function' ? P : null;
  }
  function careUI() { return care() ? window.SLPetCareUI : null; }
  function careStarted(w) { var cc = w && typeof C.careOf === 'function' ? C.careOf(w) : null; return !!(cc && /^\d{4}-\d{2}-\d{2}$/.test(cc.day)); }
  /* who runs: careRunner (never a star; a home pet first), else the V4.54 runner */
  function runnerId(w) { return typeof C.careRunner === 'function' ? C.careRunner(w) : C.activePetId(w); }
  /* the island day: the server-anchored clock in the family's time zone (the arcade's), 'YYYY-MM-DD' */
  function careDay() {
    var a = null;
    try { a = cleanCfg(window.slFamilyCfg && window.slFamilyCfg.arcade) || cleanCfg(W() && W().arcadeCfg); } catch (e) { a = null; }
    return C.dayKey(nowMs(), (a && a.tz) || 'Europe/London');
  }
  /* what the island tells a child about hunger: the old 'never sad' promise only without pet care (pets P21) */
  function promiseLine() { return tx(care() ? 'care.promise' : 'crew.neverSad'); }

  /* ---------------- who is out (KU9) ---------------- */
  /* the crew the island shows: with care, the home pets that are not at the Pet Rescue (≤ 3, the child's order) with
     careRunner's pet as the active one; hotel guests, Rescue pets and stars are never drawn. Without it: the crew */
  function crewOut(w) {
    var crew = C.crewList(w);
    if (!care()) return crew;
    var by = {}, run = runnerId(w), out = [];
    crew.forEach(function (p) { by[p.id] = p; });
    C.homePets(w).forEach(function (id) { if (by[id] && out.indexOf(by[id]) < 0 && C.petWhere(w, id) === 'home') out.push(by[id]); });
    out.forEach(function (p) { p.active = p.id === run; });
    return out;
  }
  /* on the 2D island k: Home, all of them (the runner first); a land, the runner and the home pets whose land it is
     (LAND_MASCOTS_2D at most; the 3D stage caps them by BUDGETS.landMascots); a locked preview, nobody */
  function homeOut(w, k) {
    var home = crewOut(w), runner = home.filter(function (p) { return p.active; })[0] || null;
    var rest = home.filter(function (p) { return p !== runner; });
    if (k !== 'home') {
      if (!C.isleUnlocked(w, k)) return [];
      rest = rest.filter(function (p) { var it = C.item(p.id); return !!(it && it.isle === k); }).slice(0, LAND_MASCOTS_2D);
    }
    return (runner ? [runner] : []).concat(rest);
  }
  /* each home pet's mood {hunger 0–3, happy 0–4, sitter} for the stage (P3.3) and its tummy level for the badge */
  function careMoods(w) {
    var P = care(), out = {}, cst = null;
    if (!P || !careStarted(w)) return out;
    try { cst = P.status(w, careDay()); } catch (e) { cst = null; }
    if (cst) cst.pets.forEach(function (p) {
      if (p.where === 'home') out[p.id] = { mood: { hunger: P.ALERT_LV[p.level] || 0, happy: p.happy, sitter: !!cst.sitter }, level: p.level };
    });
    return out;
  }
  /* a care badge (world-art-pets: a white symbol on a deep plate), named in words: never colour alone */
  function badgeHtml(name, c) {
    var A = window.SLWorldArtPets, P = care(), kind = c.mood.hunger >= 2 ? 'hungry' : c.mood.hunger === 1 ? 'peckish' : null;
    if (!kind || !P || !A || typeof A.badge !== 'function') return '';
    return '<span class="slw-carebadge" role="img" aria-label="' + esc(name + ': ' + tx(P.tummyKey(c.level))) + '">' + A.badge(kind) + '</span>';
  }
  /* the memory stars in the 2D night sky (pets U11): the newest 5, a tap opens the memory card */
  function stars2dHtml(w) {
    var P = care(), A = window.SLWorldArtPets;
    if (!P || !A || typeof A.star !== 'function') return '';
    var list = P.memories(w).filter(function (m) { return !m.returned; }).slice(-5);
    return list.length ? '<div class="slw-stars2d">' + list.map(function (m) {
      return '<button type="button" class="slw-star2d" data-star="' + esc(m.id) + '" aria-label="' + esc(m.name) + '">' + A.star() + '</button>';
    }).join('') + '</div>' : '';
  }
  /* the 3D memory stars, at open and whenever they change (a 'star' step, a grown-up's Bring back) */
  var starSig = null, starStage = null;
  function syncStars() {
    var P = care();
    if (!P || !stage3d || typeof stage3d.setPetStars !== 'function') return;
    var list = P.memories(W()), sig = JSON.stringify(list.map(function (m) { return [m.id, m.to, !!m.returned]; }));
    if (starStage === stage3d && sig === starSig) return;
    starStage = stage3d; starSig = sig;
    s3('setPetStars', list);
  }
  /* the island again after a care change (the stage, its badges and stars; or the 2D island) */
  function careChanged() {
    if (!root || running || renderedFor == null) return;
    if (on3D()) { s3('sync', islandView()); s3('setAnchors', anchors3D()); syncStars(); } else drawStage();
    syncNext();                                  /* a pet fed or visited: the Next step card moves on (wave 3) */
  }

  /* ---------------- the island day (pets.json care.careStep, care.family) ---------------- */
  var careOpen = false, kidDue = false, careQ = false, careNews = null, adoptDue = {}, pcSeen = {}, kidReadAt = {}, patting = {};
  /* the grown-up's settings, only for the profile this device's account drives (as the arcade's) */
  function famPetCare() {
    try {
      var cs = window.cloudState, u = me(), pc = window.slFamilyCfg && window.slFamilyCfg.petCare;
      if (!cs || !cs.doc || !cs.doc.familyCode || !u || cs.boundName !== u.name) return null;
      return pc && typeof pc === 'object' ? pc : null;
    } catch (e) { return null; }
  }
  /* a step is due: a new island day (or a clock that was wrong), or settings this page has not applied yet */
  function careDue(w) {
    var P = care(), cc = careStarted(w) ? C.careOf(w) : null;
    if (!P || !cc) return false;
    var d = P.dayNum(careDay()), c = P.dayNum(cc.day), pc = famPetCare();
    return d > c || c - d > C.CARE.clockSkewDays || (!!pc && pcSeen[state.activeUser] !== JSON.stringify(pc));
  }
  /* inside commit(): the settings first (the sitter decides the step), then the step; no change → no write */
  function careStep(u) {
    var P = care(), day = careDay(), ms = nowMs(), pc = famPetCare(), out = { ok: false, events: [] };
    if (!P) return out;
    if (pc) {
      pcSeen[state.activeUser] = JSON.stringify(pc);
      var a = P.applyFamily(u, { petCare: pc }, day, ms);
      if (a && a.ok && a.changed) out.ok = true;
    }
    var t = P.tick(u, day, ms);
    if (t && t.ok && t.changed) { out.ok = true; out.events = t.events || []; }
    return out;
  }
  /* the step's news: its card waits in the queue (care.day), a peckish or hungry day is a toast */
  function careDone(who, res) {
    var P = care(), U = careUI(), ev = res && res.ok && Array.isArray(res.events) ? res.events : [];
    if (!P || !U || !ev.length || state.activeUser !== who) return;
    if (P.cardOf(ev)) { careNews = { who: who, day: careDay(), events: ev }; return; }
    var t = P.toastOf(ev), text = t ? U.dayToast(careCtx(), ev) : null;
    if (text) careToast(text, t.id);
  }
  /* the toast waits for a quiet island (a stage booting, a sheet, another toast); the queue waits for it */
  function careToast(text, petId) {
    noteWhenQuiet(function () { toast(text, { label: tx('care.feed'), fn: function () { openCareCorner({ petId: petId, feed: true }); } }); });
  }
  /* the grown-up's 'Bring home now' and 'Bring back' (kids/{uid}.pets): read once a minute at most, only when this
     device's account is the child's own (signed in with their own password); each command applies once (care3.done) */
  function kidBound(u) {
    var cs = window.cloudState, fb = window.firebase, g = window.slFamilyCfg && window.slFamilyCfg.games;
    var user = cs && cs.user, doc = (cs && cs.doc) || {};
    if (!fb || typeof fb.firestore !== 'function' || !user || !user.uid || user.isAnonymous || doc.anon || !doc.familyCode) return null;
    if (cs.boundName !== state.activeUser || cs.boundName !== u.name) return null;
    return g && g.pw && g.pw[user.uid] === true ? { uid: user.uid, code: doc.familyCode } : null;
  }
  function readKidPets() {
    var P = care(), u = me(), b = P && u && careStarted(W()) ? kidBound(u) : null, who = state.activeUser;
    if (!b || Date.now() - (kidReadAt[who] || 0) < 60000) return;
    kidReadAt[who] = Date.now();
    try {
      window.firebase.firestore().collection('families').doc(b.code).collection('kids').doc(b.uid).get().then(function (snap) {
        var kd = snap && snap.exists && typeof snap.data === 'function' ? snap.data() : null, kid = kd && kd.pets;
        if (!kid || typeof kid !== 'object' || state.activeUser !== who) return;
        var day = careDay(), ms = nowMs();
        return commit(function (fu) { var r = P.applyFamily(fu, { kid: kid }, day, ms); return r && r.ok && r.changed ? r : { ok: false }; }).then(function (res) {
          if (!res || !res.ok) return;
          careChanged();
          var a = (res.applied || [])[0], cp = a && C.crewPet(W(), a.id);
          if (cp) toast(tx(a.kind === 'unstar' ? 'care.star.back' : 'care.rescue.home', { name: cp.name }));
        });
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------------- the pets' entries in the island-open queue (KU13; contracts.islandOpenQueue) ---------------- */
  function careQueue() {
    if (!care()) return false;
    if (careQ) return true;
    careQ = true;
    /* 10: 'News from the Pet Shop' for a child who had pets before care (+ the picker), then care starts */
    enqueueOpen({ id: 'pets.news', prio: 10,
      when: function (w) { return !!careUI() && !!w && !!w.introSeen && !careStarted(w); },
      show: function () { return careUI().newsCard(careCtx()).then(function (r) { careChanged(); return r; }); } });
    /* 15: the one-time farewell rule card, after a grown-up switched it on (KU40) */
    enqueueOpen({ id: 'care.rule', prio: 15,
      when: function (w) { var P = care(); return !!P && careStarted(w) && P.ruleNews(w) !== null; },
      show: function () { return careUI().ruleCard(careCtx()).then(function (r) { careChanged(); return r; }); } });
    /* 30: a new player's 'Adopt a friend for {name}?' (after the welcome and the character card) */
    enqueueOpen({ id: 'pets.adoptOffer', prio: 30,
      when: function (w) { return !!adoptDue[state.activeUser] && !!care() && careStarted(w) && C.petRoom(w).canAdopt; },
      show: function () {
        delete adoptDue[state.activeUser];
        return loadPetShop().then(function (ok) {
          if (!ok) throw new Error('pet-shop-ui');
          return window.SLPetShopUI.adoptOffer(careCtx());
        }).then(function (r) { careChanged(); return r; });
      } });
    /* 5: the hungry-pet reminder's 'Feed {name}' (index.html [KU-CARE] sets window.slCareFeed = {who, id, at} and opens
       My Island; F-KU2, review E3): first in line, the Pet Corner on that pet with its food open (no id: At home) */
    enqueueOpen({ id: 'pets.feedAsk', prio: 5, asked: true,
      when: function (w) {
        var f = window.slCareFeed;
        if (f && (f.who !== state.activeUser || !(Date.now() - f.at < 60000))) { window.slCareFeed = null; return false; }
        return !!f && !!careUI() && careStarted(w);
      },
      show: function () {
        var f = window.slCareFeed; window.slCareFeed = null;
        return openCareCorner(f && typeof f.id === 'string' ? { petId: f.id, feed: true } : {});
      } });
    /* 40: the island day's card (from the second island day; the most important event, one at most) */
    enqueueOpen({ id: 'care.day', prio: 40,
      when: function (w) {
        var n = careNews, P = care();
        if (!P || !n || n.who !== state.activeUser || n.day !== careDay() || !careStarted(w) || C.careOf(w).days < 2) return false;
        if (!P.cardOf(dayNews(w, n.events))) { careNews = null; return false; }
        return true;
      },
      show: function () {
        var n = careNews; careNews = null;
        return careUI().dayCard(careCtx(), { events: dayNews(W(), n.events) }).then(function (r) { careChanged(); return r; });
      } });
    return true;
  }
  /* the island day's news as it stands now: a 'very hungry' or 'last day' line is about a pet at home at that level; once
     the pet has been fed since the day began (the Next step card's Feed, the reminder's Feed: both come before this card)
     or has left home, it is old news, never shown. Read through careMoods (the care status list, as the stage reads it) */
  function dayNews(w, events) {
    var moods = careMoods(w);
    return (events || []).filter(function (e) {
      if (!e || (e.type !== 'warn' && e.type !== 'last')) return true;
      var m = moods[e.id];
      return !!m && (m.level === 'warn' || m.level === 'last');
    });
  }

  /* ---------------- the ctx the Pet Corner (P3.1) and the Pet Shop (P3.2) work through ---------------- */
  function careCtx() {
    var ctx = {
      user: me, C: C, care: window.SLPetCare, tx: tx, day: careDay, now: nowMs,
      commit: function (fn) { return commit(fn).then(function (res) { if (res && res.ok) careChanged(); return res; }); },
      overlay: overlay, cover: cover, iconHtml: iconHtml, fillPhotocards: fillPhotocards, celebrate: celebrate,
      toast: function (t) { toast(t); }, sound: careSound, trial: trial, reduced: function () { return reduced; },
      use3D: function () { return on3D() && !document.documentElement.classList.contains('sl-low'); },
      stageFeed: stageFeed, buy: buyCare,
      /* island activities (IA-5): My pets → Play's island moment; the island day's rules and board for the wish lines */
      stagePlay: stagePlay, D: DAYS() || undefined, days: function () { return dayNow(); }, people: PC() || undefined,
      /* d-pets: the Pet Shop opens on the land the child is on, and its Clothes shelf buys through the ordinary flow */
      here: function () { return isleNow(); }, buyGear: buyGearCare,
      openShop: openPetShop, openMemories: openMemories,
      openCorner: function (petId) { return openCareCorner(typeof petId === 'string' ? { petId: petId } : {}); },
      openGear: function () { openShop({ isle: 'home', shelf: 'pets' }); },   /* Home's Pets shelf: the pet gear (wave 3) */
      goLearn: function () { closeAllOverlays(); goLearn(); },
      /* wave 3 (contract 5): a short pet or food card's '📚 Learn': a learn-and-come-back trip that reopens the Pet Shop on it */
      learnFor: function (id) { return startTrip(id, 'petShop'); },
      document: document, setTimeout: function (f, t) { return setTimeout(f, t); }, clearTimeout: function (h) { clearTimeout(h); }
    };
    if (window.SLPhotocard) ctx.photocard = window.SLPhotocard;
    return ctx;
  }
  /* SLSound's names, muted with the child's sound switch; a pet's own voice for a pat */
  function careSound(name, petId) {
    try {
      var S = window.SLSound; if (!S || typeof S.make !== 'function') return;
      var s = S.make({ muted: function () { var u = me(); return !!(u && u.muted); } });
      if (petId && typeof s.pet === 'function') s.pet(petId, 0.8); else s(name);
    } catch (e) {}
  }
  /* 🐾: the Pet Corner (one at a time); the island again when it closes */
  function openCareCorner(o) {
    var U = careUI();
    if (!U) { openPets(o && o.petId); return Promise.resolve(false); }
    if (document.querySelector('.slw-pcc')) return Promise.resolve(false);
    return Promise.resolve(U.openCorner(careCtx(), o || {})).then(function (r) { careChanged(); return r; }, function () { return false; });
  }
  /* the Pet Shop's file, once, on its first use (KU21); offline, the Island Shop's Crew aisle stands in */
  var petShopLoad = null;
  function loadPetShop() {
    if (window.SLPetShopUI) return Promise.resolve(true);
    if (!petShopLoad) petShopLoad = loadScript('world/pet-shop-ui.js?v=' + (window.SL_WORLD_VER || '1')).then(function () { petShopLoad = null; return !!window.SLPetShopUI; }, function () { petShopLoad = null; return false; });
    return petShopLoad;
  }
  function openPetShop(o) {
    return loadPetShop().then(function (ok) {
      if (!root || renderedFor == null) return null;
      if (!ok) { openShop({ isle: 'home', shelf: 'pets' }); return null; }   /* offline: Home's Pets shelf stands in (wave 3) */
      return window.SLPetShopUI.openPetShop(careCtx(), o || {});
    }).then(function (r) { careChanged(); return r; });
  }
  function openMemories(o) {
    return loadPetShop().then(function (ok) {
      if (ok) return window.SLPetShopUI.openMemories(careCtx(), o || {});
      var U = careUI();
      return U ? U.openCorner(careCtx(), { tab: 'memories' }) : null;
    });
  }
  /* a pet from the Island Shop is adopted through the Pet Shop's flow: the cap's question before the 3rd pet (KU4),
     'Make room' (cap 'home'), the name step and the celebration; without that file, the buy flow as before */
  function buyItem(it, btn, errEl, done) {
    if (!(it.kind === 'pet' && care())) { buyFlow(it, btn, errEl, done); return; }
    if (buying || confirming) return;
    loadPetShop().then(function (ok) {
      if (!ok) return new Promise(function (res) { buyFlow(it, btn, errEl, function (v) { res(!!v); }); });
      return window.SLPetShopUI.adopt(careCtx(), it.id, { btn: btn, err: errEl });
    }).then(function (ok) { if (done) done(!!ok); }, function () { if (done) done(false); });
  }
  /* the Pet Shop's buy (P3.2): the host's buy flow with no celebration of its own (the shop names the pet and
     celebrates); a new pet still walks out on Home today and the island redraws */
  function buyCare(id, o) {
    var it = C.item(id);
    if (!it || (it.kind !== 'pet' && it.kind !== 'food') || buying || confirming) return Promise.resolve(false);
    return new Promise(function (res) {
      var settled = false;
      buyFlow(it, (o && o.btn) || null, (o && o.err) || null, function (ok) { if (!settled) { settled = true; res(!!ok); } }, { care: true });
    });
  }
  /* d-pets: the Pet Shop's Clothes shelf (kind 'acc'): the host's ordinary buy flow WITH its own celebration (the piece
     goes on the runner and the card names who wears it, as from the Island Shop); 'Not yet' on the confirm card, a
     refusal or a failed save answer false, so the shop's card is free again */
  function buyGearCare(id, o) {
    var it = C.item(id);
    if (!it || it.kind !== 'acc' || buying || confirming) return Promise.resolve(false);
    return new Promise(function (res) {
      var settled = false;
      buyFlow(it, (o && o.btn) || null, (o && o.err) || null, function (ok) { if (!settled) { settled = true; res(!!ok); } }, { answer: true });
    });
  }
  function careBought(it) {
    if (it.kind === 'pet') freshPets[it.id] = true;
    draw();
  }
  /* a tap on a pet out on the island: the day's pat (once per island day; '+1 happy' said once) */
  function patPet(id) {
    var P = care(), w = W();
    if (!P || !careStarted(w) || patting[id] || C.petWhere(w, id) !== 'home') return;
    var day = careDay(), ms = nowMs(), cp = C.crewPet(w, id);
    patting[id] = true;
    commit(function (u) { var r = P.pat(u, id, day, ms); return r && r.ok && r.counted ? r : { ok: false }; }).then(function (res) {
      patting[id] = false;
      if (!res || !res.ok) return;
      if (on3D()) s3('sync', islandView());
      if (cp && !document.querySelector('.slw-toast button, .slw-ov, .slw-cele')) toast(tx('care.happyUp', { name: cp.name }));
    }, function () { patting[id] = false; });
  }

  /* ---------------- the feeding moment (decision P22; pets U6, U13) ----------------
     The Pet Corner commits the meal first, then asks here. 3D: the stage plays it (P3.3) with the island uncovered.
     2D: the pet's sprite plays it on the island. false when the pet is not out on the island being shown: the strip
     plays it on the portrait. The strip's tap or Esc (Enter, Space) skips to the end state. */
  var feeding2d = null;
  function stageFeed(petId, foodId, o) {
    var red = reduced || !!(o && o.reduced);
    if (on3D()) {
      if (typeof stage3d.feed !== 'function') return Promise.resolve(false);
      s3('setCovered', false);
      /* island activities (IA-5): today's visitor steps aside for the feeding moment and comes back after it */
      var vis = !!visitorNow(W());
      if (vis) { feedingNow = true; s3('sync', islandView()); }
      var p = s3('feed', petId, foodId, { fav: !!(o && o.fav), reduced: red });
      var back = function () { if (feedingNow) { feedingNow = false; if (on3D() && !running) s3('sync', islandView()); } };
      if (!p || typeof p.then !== 'function') { back(); return Promise.resolve(false); }
      var off = skipHooks(function () { s3('skipFeed'); });
      return p.then(function (ok) { off(); back(); return ok !== false; }, function () { off(); back(); return false; });
    }
    return feed2d(petId, foodId, red);
  }
  function skipHooks(fn) {
    var onKey = function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') fn(); };
    var onTap = function (e) { for (var n = e.target; n; n = n.parentNode) if (n.classList && n.classList.contains('slw-pcc-stripwrap')) { fn(); return; } };
    window.addEventListener('keydown', onKey, true); document.addEventListener('click', onTap, true);
    return function () { window.removeEventListener('keydown', onKey, true); document.removeEventListener('click', onTap, true); };
  }
  function feed2d(petId, foodId, red) {
    var A = window.SLWorldArtPets, host = root && $('#slwPets', root), b = null;
    if (host) host.querySelectorAll('.slw-pet').forEach(function (x) { if (x.getAttribute('data-pet') === petId) b = x; });
    if (!b || !A || typeof A.bowl !== 'function') return Promise.resolve(false);
    if (feeding2d) feeding2d.end();
    var it = C.item(foodId), group = (it && it.group) || 'biscuits', box = document.createElement('span'), bits = '';
    for (var i = 0; i < 3; i++) bits += '<span class="bit" style="animation-delay:' + (i * 150) + 'ms">' + A.bit(group, i) + '</span>';
    box.className = 'slw-feed2d ' + (red ? 'still' : 'go');
    box.innerHTML = '<span class="bowl">' + A.bowl({ group: group, pile: red ? 0 : 4 }) + '</span>' + (red ? '' : bits) +
      '<span class="love"><i>' + A.hearts(1, { max: 1 }) + '</i><i>' + A.hearts(1, { max: 1 }) + '</i></span>';
    /* a pet on its way somewhere stops where it is to eat */
    try { var cs = window.getComputedStyle(b); b.style.transitionDuration = '0s'; b.style.left = cs.left; b.style.top = cs.top; } catch (e) {}
    b.classList.add('slw-eat'); if (red) b.classList.add('still');
    b.appendChild(box);
    show2d(b);
    return new Promise(function (res) {
      var timers = [], bowl = box.querySelector('.bowl');
      function end() {
        timers.forEach(function (t) { clearTimeout(t); });
        box.remove(); b.classList.remove('slw-eat'); b.classList.remove('still');
        if (feeding2d && feeding2d.end === end) feeding2d = null;
        off(); res(true);
      }
      var off = skipHooks(end);
      feeding2d = { end: end };
      if (!red) [3, 2, 1, 0].forEach(function (n, k) { timers.push(setTimeout(function () { if (bowl) bowl.innerHTML = A.bowl({ group: group, pile: n }); }, 600 + k * 500)); });
      timers.push(setTimeout(end, red ? 1200 : 3200));
    });
  }
  /* the sprite in view: the phone's sideways strip, then the page (never scrollIntoView, which moves the strip's page) */
  function show2d(b) {
    var wrap = root && root.querySelector('.slw-stagewrap');
    if (!wrap || !b.getBoundingClientRect) return;
    var wr = wrap.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (wrap.scrollWidth > wrap.clientWidth + 4) wrap.scrollLeft = Math.max(0, Math.min(wrap.scrollWidth - wrap.clientWidth, br.left - wr.left + wrap.scrollLeft + br.width / 2 - wrap.clientWidth / 2));
    var vh = window.innerHeight || 0, hd = document.querySelector('header.topbar'), top = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0;
    br = b.getBoundingClientRect();
    if (vh && typeof window.scrollTo === 'function' && (br.top < top + 40 || br.bottom > vh - 130)) try { window.scrollTo({ top: (window.pageYOffset || 0) + br.top - (top + vh - 130) / 2, behavior: 'auto' }); } catch (e) {}
  }
  /* the intro's care picture: the runner beside its bowl */
  function careHero() {
    var A = window.SLWorldArtPets, w = W(), run = (w && runnerId(w)) || 'pet_puppy';
    return '<span class="slw-carehero" aria-hidden="true">' + ART.pet(run, { acc: w ? C.wornBy(w, run) : {}, frame: 0 }) + (A && A.bowl ? A.bowl({ group: 'biscuits', pile: 4 }) : '') + '</span>';
  }

  /* ---------------- games ---------------- */
  /* deps: extra world/games/ scripts loaded (in order) after shell.js + fx.js and
     before the game file; tutKey: which tutSeen flag the game's tutorial uses (course_v3: the
     cards now say 3 hearts that never come back, so every child sees them once more) */
  var GAMES = {
    course: { name: 'Debut Run', what: 'an obstacle run with your pet', att: 'att_course', file: 'pet-course.js', deps: ['course-hud.js'], tutKey: 'course_v3', grad: 'linear-gradient(135deg,#43c66f,#2a9d8f)', emoji: '🐾' },
    penalty: { name: 'Encore Shootout', what: 'football penalties', att: 'att_pitch', file: 'penalty.js', tutKey: 'penalty2', grad: 'linear-gradient(135deg,#4a8ff0,#6c5ce7)', emoji: '⚽' },
    kart: { name: 'Neon Grand Prix', what: 'kart racing', att: 'att_kart', file: 'kart.js', deps: ['kart-logic.js'], tutKey: 'kart2', grad: 'linear-gradient(135deg,#ff8a3d,#e94b4b)', emoji: '🏎️' }
  };
  /* the game an attraction unlocks, by the name the Games sheet uses ({name, what}), or null */
  function gameOf(it) { return it && it.kind === 'attraction' && it.game && GAMES[it.game] ? GAMES[it.game] : null; }
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
  /* the kids update's deps for every game (KU-CH17; plan-ku contracts.gameCfg, KU-CH16, KG8): the people helper
     (game-people.js: the child's character plays) and the challenges' release switch (social-core.js:
     cfg.duels). Each is skipped when its global is in, and a failure never stops the game (it plays as
     V4.55: the classic figure, no ⚔️ / 🔑). The four challenge files and kart-net come on the first ⚔️ / 🔑
     tap, through the game's own loader (KG3 / KG4 / KG7), so no game start carries them */
  var KU_DEPS = [['SLSocialCore', 'social-core.js'], ['SLGamePeople', 'game-people.js']];
  /* the game's scripts within a deadline (E7): a load that hangs rejects with 'timeout' after LOAD_MS, so a tap on
     Play never waits for ever and the running lock is freed; the request itself carries on, and a later try reuses it */
  var LOAD_MS = 12000;
  function loadGameWithin(game, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('timeout')); }, ms || LOAD_MS);
      loadGame(game).then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function loadGame(game) {
    var v = window.SL_WORLD_VER || '1';
    try { if (localStorage.getItem('slQaMode') === '1') v += '&qa=' + Date.now(); } catch (e) {}
    var chain = loadScript('world/games/shell.js?v=' + v)
      .then(function () { return loadScript('world/games/fx.js?v=' + v); });
    (GAMES[game].deps || []).forEach(function (d) { chain = chain.then(function () { return loadScript('world/games/' + d + '?v=' + v); }); });
    KU_DEPS.forEach(function (d) {
      chain = chain.then(function () { return window[d[0]] ? null : loadScript('world/games/' + d[1] + '?v=' + v).catch(function () { return null; }); });
    });
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
  /* the Games sheet → the sheet. o.onClose: told when it closes (the top bar's Games, WAVE3-PLAN §1 / contract 3). Each
     card says what the game is under its name ('An obstacle run with your pet', WAVE3-PLAN §4) */
  function openGames(o) {
    o = o || {};
    var w = W(), st = arcadeState(), over = !!(st.status && st.status.exhausted);
    var html = '<h2>' + lbl('games', 'Island games') + '</h2>' + timeHtml(st) + '<p style="font-size:12.5px;font-weight:700;color:#7c8696;margin:0 0 8px;">' + esc(tx(coinsOn() ? 'games.noCoins' : 'games.noPoints')) + '</p><div class="slw-games">';
    Object.keys(GAMES).forEach(function (g) {
      var G = GAMES[g], own = C.owns(w, G.att);
      /* the card's colours go in --slw-g (the Pixel skin draws them as a band; the injected rule fills the card). With the
         day's game time used up, ▶ Play is dimmed and does nothing (aria-disabled; the line above says why), never a
         Play that only opens the time-up card (R2, QA2C-10) */
      html += '<div class="slw-game' + (own ? '' : ' locked') + '" style="--slw-g:' + G.grad + ';"><h3>' + esc(G.name) + '</h3><p class="what">' + esc(G.what.charAt(0).toUpperCase() + G.what.slice(1)) + '</p>' +
        '<div class="pb">' + (own ? esc(pbText(g)) : '🔒 Unlock with the ' + esc(C.item(G.att).name) + ' in the Island Shop') + '</div>' +
        '<button class="slw-btn big" type="button" data-play="' + g + '"' + (own && over ? ' aria-disabled="true"' : '') + '>' + (own ? '▶ Play' : '👀 See it in the Island Shop') + '</button></div>';
    });
    var ov = overlay(html + '</div>');
    /* [V4.55-BOARDS] optional leaderboards (world/games/boards.js); this sheet works without it */
    (window.SLBoards ? Promise.resolve() : loadScript('world/games/boards.js?v=' + (window.SL_WORLD_VER || '1'))).then(function () { if (window.SLBoards && SLBoards.attach) SLBoards.attach(ov, { overlay: overlay, day: st.day }); }).catch(function () {});
    addFree(ov);                                         /* island activities (IA-5): 'Play on your island' under the games, free play */
    if (typeof o.onClose === 'function') ov._whenClosed(o.onClose);
    ov.querySelectorAll('[data-play]').forEach(function (b) { b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') === 'true') return; ov._close(); launch(b.dataset.play); }); });
    return ov;
  }
  var running = null;
  /* opts.challenge = {join: 'FROG'} (a family pop-up's Join, through joinChallenge): the game opens on its join sheet */
  function launch(game, opts) {
    var G = GAMES[game]; if (!G) return;
    var join = opts && opts.challenge ? joinWord(opts.challenge.join) : null;
    var w = W();
    /* ownership gate — every entry point (island, menu, URL) comes through here */
    if (!C.owns(w, G.att)) { openItem(G.att); return; }
    if (running) return;
    if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); mode = 'play'; draw(); }
    endActivity('game');                      /* island activities (IA-5): a game ends a pet game, a show or I spy */
    var st = arcadeState();
    if (C.roundGate(st.status).allowed === false) {
      var ov = overlay('<h2>⏱️ That’s all the game time for today</h2><p style="font-weight:700;">Your grown-up set ' + Math.round(st.status.limitSec / 60) + ' minutes of island games a day. Your games are still yours — come back tomorrow!</p><button class="slw-btn big on" type="button" id="slwToLearn">📚 Learning is open — let’s go</button>', { small: true });
      $('#slwToLearn', ov).addEventListener('click', function () { ov._close(); goLearn(); });   /* the last subject (wave 3) */
      return;
    }
    var launchedFor = state.activeUser;
    running = { game: game };
    /* a load that takes a moment says so ('Loading Encore Shootout…') until the game starts or gives up */
    var loadTip = null, slow = setTimeout(function () { loadTip = toast('Loading ' + G.name + '…', null, { ms: LOAD_MS + 1000 }); }, 300);
    function loaded() { clearTimeout(slow); if (loadTip && loadTip.parentNode) loadTip.remove(); }
    loadGameWithin(game).then(function () {
      loaded();
      var world = W();
      /* the sidekick: careRunner's pet with its real ids (a mascot and land gear too, D98), through the crew API; never
         a star, null with no pet (KU8, contracts.gameCfg; a core without careRunner: the V4.54 runner or the first) */
      var pet = C.crewPet(world, runnerId(world)) || (typeof C.careRunner === 'function' ? null : C.crewList(world)[0]);
      var cfg = {
        variant: game === 'course' ? C.selected(world, 'course') : game === 'kart' ? C.selected(world, 'track') : 'std',
        ownedVariants: C.CATALOG.filter(function (it) { return it.game === game && it.kind === 'variant' && C.owns(world, it.id); }).map(function (it) { return { id: it.id, name: it.name }; }),
        pet: pet ? { id: pet.id, name: pet.name, acc: C.wornBy(world, pet.id) } : null,
        ball: C.selected(world, 'ball'), stadium: C.selected(world, 'stadium'), kart: C.selected(world, 'kart'),
        pb: world.pb, tutSeen: !!world.tutSeen[G.tutKey || game], reduced: reduced,
        /* who's playing: name, signature colour and avatar for 3D views, HUDs and results */
        user: { name: (me() || {}).name || '', color: (me() || {}).color || '#6C5CE7', avatar: (me() || {}).avatar || '🙂' },
        profileKey: launchedFor, day: arcadeState().day,
        /* C10: the lobbies date tickets with this server-anchored clock, not the device clock */
        wall: nowMs,
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
      /* the kids update (plan-ku contracts.gameCfg): who plays (the child's character, never sent anywhere),
         and the challenges while their release switch is on (KG8) */
      cfg.char = charInfo(world, me());
      var SC = window.SLSocialCore;
      if (SC && SC.ON && SC.ON.duels) cfg.duels = true;
      if (join) cfg.challenge = { join: join };
      /* R2 (QA2C-4): the Next step card's 'Try the Remix' names that Remix: the kart menu opens with it picked (kart.js
         takes cfg.openCourse when it is one of its unlocked chips; r2-games). Still the menu, never straight into a race */
      if (game === 'kart' && opts && typeof opts.course === 'string' && /^track_[a-z0-9_]+$/.test(opts.course)) cfg.openCourse = opts.course;
      window.slGameBusy = true;
      s3('suspend');                                     /* the game borrows the 3D renderer */
      window.SLGames[game].start(cfg);
    }).catch(function () {
      /* a game that never started (a failed or a 12 s load) must not hold the app's pop-ups, the island's renderer
         or the running lock: the next tap on Play tries again */
      loaded();
      window.slGameBusy = false;
      s3('resume');
      running = null;
      toast('⚠️ Couldn’t load the game — check your connection and try again.');
    });
  }

  /* ---------------- joining a family challenge (games.json challenges.flows.popup; KG8's [KU-GAMES]) ----------------
     index.html's family pop-up → Join → SLWorld.joinChallenge(game, word): My Island comes up, then the game
     opens straight on its join sheet with the word in (launch's ownership gate opens the shop item when the
     game is not the child's). While a game runs: the duel copy's 'Finish your game first' toast, over the game */
  function joinWord(w) {
    var s = typeof w === 'string' ? w.replace(/\s+/g, '').toUpperCase() : '';
    return /^[A-Z0-9]{4}$/.test(s) ? s : null;
  }
  function joinChallenge(game, word) {
    var w = joinWord(word);
    if (!GAMES[game] || !w || !me()) return false;          /* nobody signed in on this device: nothing to join with */
    if (running) { joinBusy(w); return false; }
    var go = function () { closeAllOverlays(); launch(game, { challenge: { join: w } }); };
    if (worldShown() && renderedFor != null) { go(); return true; }
    if (typeof setActiveApp === 'function') try { setActiveApp('world'); } catch (e) {}
    var tries = 0;
    (function wait() { if (renderedFor != null || ++tries > 40) go(); else setTimeout(wait, 100); }());   /* the island draws first (≤ 4 s) */
    return true;
  }
  function joinBusy(w) {
    var show = function () {
      var D = window.SLDuelCore, t = D && D.T && D.T.popup && D.T.popup.busy;
      if (t && typeof D.fill === 'function') toast(D.fill(t, { code: w }), null, { over: true });
    };
    if (window.SLDuelCore) return show();
    loadScript('world/games/duel-core.js?v=' + (window.SL_WORLD_VER || '1')).then(show, function () {});
  }

  /* ================================================================
     WAVE 3 (WAVE3-PLAN §3, §7; contracts 1, 3, 4, 5): the Next step card in the HUD, the learn-and-come-back trip,
     and SLWorld.go. Memory only: the trip is window.slLearnTrip (never saved, never sent), and the card is worked
     out afresh from the save on each draw by SLNextStep (world/next-step.js, W3-2; loaded here like the Pet Shop,
     precached in sw.js). Until it is in, or when no rule fits, the old savings-goal bar / test-mode note stands.
     The host acts on the card's btn.go.to, never on its id alone.
     ================================================================ */
  var nextCard = null, goalShown = null, TRIP_MS = 3 * 60 * 60 * 1000, TRIP_KEEP_MS = 12 * 60 * 60 * 1000;
  var TRIP_FROM = { item: 1, card: 1, next: 1, hud: 1, petShop: 1, cast: 1 };
  /* d-island: the card's turn (SLNextStep env.turn, the contract): the island day's number plus the real My Island opens
     of this page session (render() moves nextOpens on), so each open, and each new day after a reload, comes round to
     the next island idea; plus the cards acted on (onNext moves nextActs on), so the card after Fly there, ✋ Have a go
     or Open my bag is the next idea, never the same one again. Memory only. qaTurn: a QA script's fixed turn (QA mode
     only). nextLeft: the island the child last flew from in this open (env.left: no visit straight back) */
  var nextOpens = 0, nextActs = 0, qaTurn = null, nextEnv = null, nextLeft = null, nextHold = null;
  function nextTurn() {
    if (typeof qaTurn === 'number') return qaTurn;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(careDay() || ''));
    return (m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0) + nextOpens + nextActs;
  }
  function loadNextStep() {
    if (window.SLNextStep) return;
    loadScript('world/next-step.js?v=' + (window.SL_WORLD_VER || '1')).then(function () { if (window.SLNextStep) syncNext(); }, function () {});
  }
  /* SLNextStep.island with the host's env (W3-2 as built): test mode, the island's wallet, the care rules once they are
     ready and the island day, the trip, who is playing and whether today's game time has room for a ▶ Play; d-island:
     the island the child is on, whether the stage can fly, the turn, the island just left and whether the here row
     shows its own 📚 Learn */
  function nextOf(u) {
    var N = window.SLNextStep;
    if (!N || typeof N.island !== 'function' || !u) return null;
    try {
      var env = { trial: trial(), care: care(), day: careDay(), now: Date.now(), trip: window.slLearnTrip || null, who: state.activeUser,
        games: C.roundGate(arcadeState().status).allowed !== false, isle: isleNow(), travel: canTravel(), turn: nextTurn(),
        left: nextLeft && nextLeft !== isleNow() ? nextLeft : null, learnHere: !!hereLearn() };
      if (typeof C.walletOf === 'function') env.wallet = C.walletOf();
      /* island activities (IA-2's env, as built): the island day, the turn without its calendar day (days.n is the day
         part), the pet that can play here and the card on show (kept while it still fits: the same open, the same turn) */
      var days = dayNow(u);
      if (days) {
        env.days = days;
        env.turn = typeof qaTurn === 'number' ? qaTurn : nextOpens + nextActs;
        var pp = playPet();
        if (pp) env.pet = pp;
        if (nextHold && nextHold.who === state.activeUser && nextHold.turn === env.turn) env.hold = { id: nextHold.id, go: nextHold.go };
      }
      nextEnv = env;
      var n = N.island(C, u, env);
      nextHold = days && n && n.btn && n.btn.go ? { id: n.id, go: n.btn.go, turn: env.turn, who: state.activeUser } : null;
      return n && n.text && typeof n.text.key === 'string' ? n : null;
    } catch (e) { return null; }
  }
  /* the card on show has its own 📚 Learn: the HUD's hides (d-island) */
  function learnInCard() { return !!(nextCard && nextCard.btn && nextCard.btn.key === 'learn.go'); }
  /* the HUD's 📚 Learn hides while My Island shows its own: the card's, or the here row's on a locked island the child
     is short of (d-island: never three Learn buttons with the top bar's) → where focus on it goes, or null */
  function hudLearnTo() {
    if (learnInCard()) return 'hud:next';
    var id = hereLearn();
    return id ? 'card:learn:' + id : null;
  }
  /* the HUD's Learn hidden or back, in place (the card or the here row just changed); focus on it moves to the one on show */
  function syncLearn() {
    var lb = root && root.querySelector('.slw-hud [data-act="learn"]');
    if (!lb) return;
    var to = hudLearnTo();
    if (to && document.activeElement === lb) refocus(root, to);
    if (to) lb.setAttribute('hidden', ''); else lb.removeAttribute('hidden');
  }
  /* the card (keeps the .slw-goal classes, so it sits where the goal bar was; a whole row on phones): a small 'Next step'
     label, the pet's portrait or the thing's picture, one sentence, at most one button, the bar while saving */
  function nextHtml(u) {
    var n = nextCard = nextOf(u);
    if (!n) return goalHtml(u);
    var w = C.ensureWorld(u), ic = n.icon || {}, pic = '', p = n.progress, label = esc(tx('next.label'));
    if (ic.kind === 'pet' && C.item(ic.id)) pic = iconHtml(ic.id, { acc: C.wornBy(w, ic.id) });
    else if (ic.kind === 'char' && ic.id) pic = peopleIconHtml(ic.id);                  /* today's visitor (IA-2) */
    else if (ic.kind === 'isle' && C.ISLES[ic.id]) pic = typeof ART.isleIcon === 'function' ? ART.isleIcon(ic.id, { locked: !C.isleUnlocked(w, ic.id) }) : '';   /* an island's own icon (d-island) */
    else if (ic.id && C.item(ic.id)) pic = iconHtml(ic.id, artState(w));
    return '<div class="slw-goal slw-next' + (n.id === 'enough' ? ' ready' : '') + '" role="group" aria-label="' + label + '" data-next="' + esc(n.id) + '">' +
      (pic ? '<span class="gi" aria-hidden="true">' + pic + '</span>' : '') +
      '<span class="nx"><span class="lb" aria-hidden="true">' + label + '</span><span class="gt">' + esc(tx(n.text.key, n.text.params || undefined)) + '</span>' +
      (p ? '<span class="gb" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.price + '" aria-valuenow="' + Math.min(p.have, p.price) + '" aria-label="' +
        esc(tx(p.key || 'next.progress', { n: fmt(p.have), price: fmt(p.price) })) + '" style="display:block;"><i style="width:' + p.pct + '%"></i></span>' : '') + goalBarHtml(n.goalBar) + '</span>' +
      (n.btn ? '<button type="button" class="slw-nextbtn" data-fk="hud:next">' + esc(tx(n.btn.key, n.btn.params || undefined)) + '</button>' : '') + '</div>';
  }
  /* the card answers a tap anywhere on it (its button is the keyboard's way in, and the tap stops there: one act per
     tap); the old goal bar keeps goalTap */
  function wireGoal(g) {
    if (!g) return;
    if (!/\bslw-next\b/.test(g.className || '')) { g.addEventListener('click', goalTap); return; }
    var b = g.querySelector('.slw-nextbtn');
    if (b) b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); onNext(); });
    g.addEventListener('click', function () { onNext(); });
  }
  /* the card again, in place (the wallet, a pet fed, the rules just loaded): focus stays on its button */
  function syncNext() {
    if (!root || renderedFor == null) return;
    var g = root.querySelector('.slw-hud .slw-goal'), u = me();
    if (!g || !u || !g.parentNode) return;
    var fk = focusKey(g), box = document.createElement('div');
    box.innerHTML = nextHtml(u);
    var ng = box.firstChild; if (!ng) return;
    g.parentNode.insertBefore(ng, g); g.remove();
    wireGoal(ng); fillPhotocards(ng);
    if (fk) refocus(ng, fk);
    syncLearn();                                  /* the HUD's 📚 Learn hides while the card has its own, and comes back after */
    fitStage();
  }
  /* d-island: acting on the card moves its turn on, so the card after it (worked out again when the place is done; a
     sheet's close first, so its focus goes back to the card) is the next idea, never the one just done */
  function onNext() {
    var n = nextCard, g = n && n.btn && n.btn.go;
    if (!g || typeof g.to !== 'string') return;
    if (g.to === 'learn') { if (typeof g.id === 'string') startTrip(g.id, 'next'); return; }
    nextActs++;
    Promise.resolve(goNow(g.to, g)).then(function () { syncNext(); }, function () {});
  }
  /* the savings goal while it is still short (real prices only): 📚 Learn in the HUD makes the trip for it */
  function shortGoal() {
    var u = me(); if (!u || trial()) return null;
    var gp = C.goalProgress(u);
    if (!gp || gp.ready || gp.full || gp.locked || !C.item(gp.id)) return null;
    var s = iState(u, gp.id);
    return s && s.state === 'short' ? gp.id : null;
  }
  /* 'That’s about 10 minutes of learning.' (SLNextStep.time); '' until the rules are in */
  function learnTime(need) {
    var N = window.SLNextStep, t = null;
    try { t = N && typeof N.time === 'function' ? N.time(need, C) : null; } catch (e) { t = null; }
    return t ? tx(t.key === 'days' ? 'learn.aboutDays' : 'learn.aboutMins', { n: t.n }) : '';
  }
  /* the learning screens: the last subject (index.html's slGoLearn, W3-1), else Maths */
  function goLearn() {
    if (typeof window.slGoLearn === 'function') { try { window.slGoLearn(); return; } catch (e) {} }
    if (typeof setActiveApp === 'function') setActiveApp('maths');
  }
  /* the trip (contract 1): {v: 1, who, id, name, price, wallet, at (ms), from}, in memory only. Never in test mode (nothing
     is short there): the Learn buttons only ever show with real prices */
  function tripOn(t) {
    /* island activities §4.1 (IA-7's contract): a trip that names its island day lasts until that day ends (12 hours at
       most), whichever way My Island opens; one without a day keeps the 3-hour rule */
    var N = window.SLNextStep, now = Date.now(), day = t && typeof t.day === 'string' ? careDay() : undefined;
    if (N && typeof N.tripLive === 'function') return N.tripLive(t, state.activeUser, now, day);
    if (!t || t.v !== 1 || t.who !== state.activeUser || typeof t.at !== 'number' || now - t.at < 0) return false;
    return day !== undefined ? t.day === day && now - t.at <= TRIP_KEEP_MS : now - t.at <= TRIP_MS;
  }
  function startTrip(id, from) {
    var it = C.item(id);
    closeAllOverlays();
    if (it && me() && !trial()) {
      window.slLearnTrip = { v: 1, who: state.activeUser, id: id, name: it.name, price: priceOf(it), wallet: coinsOn() ? 'coins' : 'stars', at: Date.now(),
        from: Object.prototype.hasOwnProperty.call(TRIP_FROM, from) ? from : 'item', day: careDay() };
      tripSave(window.slLearnTrip);                 /* kept on this device to the end of its island day (IA-7's seam) */
      tripGoal(id);                                  /* and 🎯 My goal when there is none (§4.2) */
    }
    goLearn();
    return true;
  }
  function endTrip(id) { var t = window.slLearnTrip; if (t && (id == null || t.id === id)) tripSave(null); }
  /* a sheet's close as a promise (the island-open queue waits for it) */
  function untilClosed(ov) { return new Promise(function (res) { if (ov && typeof ov._whenClosed === 'function') ov._whenClosed(res); else res(); }); }
  /* 3: the trip's way back. When My Island opens again (any route), the thing's sheet opens first, once: a Pet Shop
     trip opens the Pet Shop on that animal (or the food). Not when its 'Goal reached' card was just up, not for another
     child (that trip ends), nor after 3 hours, nor once it is the child's (bought meanwhile) */
  enqueueOpen({ id: 'learn.trip', prio: 3, asked: true,
    when: function () {
      var t = window.slLearnTrip, u = me();
      if (!t) return false;
      var it = C.item(t.id);
      if (!u || !it || !tripOn(t)) { window.slLearnTrip = null; return false; }
      if (goalShown && goalShown.id === t.id && Date.now() - goalShown.at < 120000) { window.slLearnTrip = null; return false; }
      if (iState(u, t.id).state === 'owned' && !C.isRepeatable(it)) { window.slLearnTrip = null; return false; }
      return true;
    },
    show: function () {
      var t = window.slLearnTrip, it = t && C.item(t.id);
      tripSave(null);                                    /* once: the trip ends when the child is back (and on this device) */
      if (!it) return Promise.resolve();
      /* (d-pets: a piece of pet clothes from the Pet Shop's Clothes shelf comes back there too) */
      if (care() && (it.kind === 'food' || ((it.kind === 'pet' || it.kind === 'acc') && t.from === 'petShop'))) return openPetShop({ filter: it.kind === 'food' ? 'food' : 'all', id: t.id });
      return untilClosed(openItem(t.id));
    } });
  /* SLWorld.go(to, o) (contract 3; the top bar, the goal toast, the Next step card): to = island | games | shop | item | pets
     | play | learn | char. My Island comes up first when it is hidden (≤ 4 s, as joinChallenge); while the welcome is still
     to come the place waits for it, first in the island-open queue. false with nobody signed in or while a game runs */
  /* d-island: + land (fly to o.isle), ride (o.uid on o.isle, framed and played as a tap would) and edit (Edit mode on
     o.isle, the bag in view), the Next step card's island ideas */
  var GO_TO = { island: 1, games: 1, shop: 1, item: 1, pets: 1, play: 1, learn: 1, char: 1, land: 1, ride: 1, edit: 1,
    today: 1, visitor: 1, book: 1, show: 1, spy: 1, isle: 1, fetch: 1, hide: 1 };      /* + island activities' places (IA-2 / IA-5) */
  function go(to, o) {
    o = o && typeof o === 'object' ? o : {};
    if (typeof to !== 'string' || !Object.prototype.hasOwnProperty.call(GO_TO, to) || !me() || running) return false;
    if (to === 'learn') { if (typeof o.id === 'string' && C.item(o.id)) startTrip(o.id, o.from || 'next'); else { closeAllOverlays(); goLearn(); } return true; }
    /* R2 (QA2B-8; default on James's list): a live trip is a promise to reopen ONE thing. Going anywhere else (Games, the
       shop, My pets, a game) ends it quietly, so its sheet never pops up over the place the child picked; My Island
       itself and that thing's own sheet keep it. A goal stays a goal */
    var tp = window.slLearnTrip;
    if (tp && to !== 'island' && !(to === 'item' && o.id === tp.id)) endTrip();
    var who = state.activeUser;
    var run = function () {
      if (state.activeUser !== who || running || !root) return;
      var w = W();
      if (w && !w.introSeen) {
        var at = Date.now();
        enqueueOpen({ id: 'nav.go', prio: 1, asked: true,
          when: function () { return state.activeUser === who && Date.now() - at < OPEN_WAIT; },
          show: function () { OPENQ = OPENQ.filter(function (e) { return e.id !== 'nav.go'; }); return goNow(to, o); } });
        if (!openRun) startOpenQueue();
        return;
      }
      goNow(to, o);
    };
    if (worldShown() && renderedFor != null) { run(); return true; }
    if (typeof setActiveApp === 'function') try { setActiveApp('world'); } catch (e) {}
    var tries = 0;
    (function wait() { if (renderedFor != null || ++tries > 40) run(); else setTimeout(wait, 100); }());   /* the island draws first (≤ 4 s) */
    return true;
  }
  /* the place itself, on a quiet island (every sheet closed first) → a promise that settles when its sheet closes */
  function goNow(to, o) {
    o = o || {};
    if (running || !root) return Promise.resolve(false);
    closeAllOverlays();
    var ov = null;
    if (to === 'games') ov = openGames({ onClose: o.onClose });
    else if (to === 'shop') ov = openShop(o);
    else if (to === 'item') { if (typeof o.id === 'string' && C.item(o.id)) { endTrip(o.id); ov = openItem(o.id); } }
    else if (to === 'pets') {
      var po = {};
      ['petId', 'tab'].forEach(function (k) { if (typeof o[k] === 'string') po[k] = o[k]; });
      ['feed', 'visit', 'dress'].forEach(function (k) { if (o[k] === true) po[k] = true; });
      return Promise.resolve(openCareCorner(po));
    }
    else if (to === 'play') { if (GAMES[o.game]) launch(o.game, typeof o.course === 'string' ? { course: o.course } : null); }
    else if (to === 'char') return Promise.resolve(openMyChar({}));
    else if (to === 'land') return typeof o.isle === 'string' && C.ISLES[o.isle] ? goIsle(o.isle) : Promise.resolve(false);
    else if (to === 'ride') return rideNow(o.uid, o.isle);
    else if (to === 'edit') return editNow(o.isle, o.id);
    else if (ACT_GO[to]) return goAct(to, o);
    return untilClosed(ov);
  }
  /* there first: the island o.isle names (the one the child is on when it names none), off the Sky map → Promise<bool> */
  function landFirst(k) {
    var at = typeof k === 'string' && C.ISLES[k] ? k : isleNow();
    if (at === isleNow() && !skyMapOn) return Promise.resolve(true);
    return goIsle(at).then(function (ok) { return !!ok && isleNow() === at && !skyMapOn; });
  }
  /* the Next step card's ✋ Have a go (d-island), whichever words the card has: 'Have a go on the {item}.' for a ride,
     'Try the {item}.' for anything else (c-copy-core, by SLWorldCore.RIDE_ACTS). Play mode, then the thing is framed and
     plays its act once, exactly as a tap on it would (reduced motion, its sounds and its re-tap guard included) */
  function rideNow(uid, k) {
    if (typeof uid !== 'string' || !uid) return Promise.resolve(false);
    if (mode === 'place') { toast(tx('isle.finishFirst')); return Promise.resolve(false); }
    if (mode === 'edit') { mode = 'play'; selectedUid = null; draw(); }
    return landFirst(k).then(function (ok) {
      var f = ok && root ? findPlaced(W(), uid) : null;
      if (!f || f.isle !== isleNow()) return false;
      if (on3D()) { s3('frameItem', uid); tapItem(uid, null); return true; }
      var el = root.querySelector('#slwStage [data-uid="' + uid + '"]');
      if (!el) return false;
      show2d(el);
      tapItem(uid, el);
      return true;
    });
  }
  /* the room a floating chip of the app's takes at the foot of the screen (the Daily 30 pill, bottom left; 0 when there
     is none): what scrolls into view stops above it, so the chip never covers a label. A pill hidden for a moment (the
     app shows it again up to a second after a sheet closes) keeps its usual room, FOOT_CHIP */
  var FOOT_CHIP = 64;
  function footChip(vh) {
    var c = document.querySelector('.d30-chip'), r = c && c.getBoundingClientRect ? c.getBoundingClientRect() : null;
    if (!c) return 0;
    return r && r.height > 0 ? (r.top < vh ? Math.max(0, vh - r.top) : 0) : FOOT_CHIP;
  }
  /* 'Your bag has N things to put out.' (d-island): Edit mode on that island, the bag's first thing focused and in view
     (above the Daily 30 pill on a phone) */
  function editNow(k, id) {
    if (mode === 'place') { toast(tx('isle.finishFirst')); return Promise.resolve(false); }
    return landFirst(k).then(function (ok) {
      if (!ok || !root || !C.isleUnlocked(W(), isleNow())) return false;
      if (mode !== 'edit') { mode = 'edit'; selectedUid = null; draw(); }
      var tray = $('#slwBar .slw-tray', root), first = tray && ((typeof id === 'string' && tray.querySelector('[data-tray="' + id + '"]')) || tray.querySelector('[data-tray]')), vh = window.innerHeight || 0;
      if (tray && vh && tray.getBoundingClientRect && typeof window.scrollTo === 'function') {
        var r = tray.getBoundingClientRect(), gap = 12 + footChip(vh);
        if (r.height && r.bottom > vh - gap + 4) try { window.scrollTo({ top: (window.pageYOffset || 0) + r.bottom - vh + gap, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) {}
      }
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
      return true;
    });
  }

  /* ---------------- leaving the island tab ---------------- */
  function onHide() {
    try { if (window.SLMusic) SLMusic.stopAll(200); } catch (e) {}   /* never on learning screens */
    closePhoto();                        /* a camera never stays on behind another tab (KU-CH14) */
    if (placing) { placing = null; document.removeEventListener('keydown', placeKeys); }
    endActivity('hide'); flushFinds(); tourUntil = 0; petChipsAt = null;   /* island activities (IA-5): what was done is kept */
    mode = 'play'; selectedUid = null;
    stopPets();
    renderedFor = null; hudShown = false;
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
    var tp = window.slLearnTrip; if (tp && tp.who !== state.activeUser) window.slLearnTrip = null;   /* a trip ends with a profile change (wave 3) */
    /* island activities (IA-5): a game, a show or I spy ends; the last child's notes are let go (never written on this one) */
    endActivity('user'); findQ = []; tourUntil = 0; petChipsAt = null; daysMemo = null;
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
    if (el && u) el.textContent = fmt(balOf(u));
    syncHeadPts();
    syncNext();                                  /* the Next step card (or the goal bar) follows the wallet (wave 3) */
  }

  /* ================================================================
     ISLAND ACTIVITIES v1 — THE ISLAND HOST (chunk IA-5; chatgpt-feedback/ISLAND-ACTIVITIES-PLAN.md §2, §4, §5 IA-5, §6
     and §7, as James approved it on 25-26 Oct 2026: build all 7; island activities are FREE PLAY and never use the
     daily island-game time; 'Island day N' is shown; 'Learn and come back' sets 🎯 My goal when none is set; the plan's
     other §9 questions take their recommended defaults). Built on the decisions build (the rotating Next step card,
     '🎯 My goal' / 'Need N more 🪙', the named ▶ signs, the slim phone header) and on the chunks merged before it:
       IA-1  SLIslandDays (world/island-days.js, loaded here like next-step.js) and world-core's w.days3 / w.finds3
             writers (C.countIslandDay, C.markDid, C.addFinds, C.seeFinds)
       IA-2  SLNextStep's MIX (env.days, env.turn, env.pet, env.hold; card.goalBar; the new go targets)
       IA-3  the 3D stage: view.visitor, on.tapVisitor / on.tapSea, say, play, playTaps, throwTo, hideIn, wobble,
             burst, setWeather (a stub or older stage answers false / null / -1 / 0, and its part steps aside)
       IA-4  the sky's weather and seasons, through the stage's setWeather({weather, season, looks})
       IA-6  SLIslandBookUI (world/island-book-ui.js, loaded on its first use)
       IA-7  index.html's trip seam (window.slTripSave; window.slLearnTrip is mirrored on this device)
     Without island-days.js nothing here shows (no sign, visitor, chips, book or Today rows): the island works as the
     decisions build. Nothing here earns or spends ⭐ or 🪙, rolls a number or keeps a clock of its own: the island
     day is careDay(), every schedule is SLIslandDays' fixed order, and the only writes are world-core's, inside
     commit(), plus one switch kept on this device (Season looks, localStorage 'slwSeasons').
       📋 Today      a sign over Home's house in play mode (a soft dot in the child's colour while the book has new
                     stamps, never a number) → the Today sheet: the weather, who is visiting, the day's show, today's
                     I spy, a pet's wish, 🎯 My goal and 📖 My island book, each row with one button that goes there
       the visitor   today's character on Home (3D: Home's land-guest slot; 2D, or a LOW stage with no person
                     shapes yet: its portrait), a tap → its card: 👋 Say hello, Show me round, Show me your move!
       activities    one at a time (activity), each with a 48 px strip pinned to the top of the stage
                     (#slwPlayBar): the show, I spy, 🎾 Fetch and 🙈 Hide and seek. Each ends on its own Done / ✕ /
                     Skip, Esc, a sheet, Edit, travel, a game, leaving the island or another child
       stamps        what the child does is noted (noteFind) and written 1.5 s later in one commit
                     (SLIslandDays.note → C.addFinds); a new stamp or a completed page says so once the island is quiet
       the weather   the sky's own (3D) or a drifting overlay (2D, LOW): Season looks in ❓ Help switches it off
   ================================================================ */
  /* ---------------- the rules (world/island-days.js) and today's island day ---------------- */
  function DAYS() { var D = window.SLIslandDays; return D && typeof D.today === 'function' && typeof D.note === 'function' && typeof D.book === 'function' ? D : null; }
  var daysAsked = false;
  function loadIslandDays() {
    if (DAYS() || daysAsked) return;
    daysAsked = true;
    loadScript('world/island-days.js?v=' + (window.SL_WORLD_VER || '1')).then(function () { daysAsked = false; if (DAYS()) daysArrived(); }, function () { daysAsked = false; });
  }
  /* the rules came after the island was drawn: the sign, the visitor, the show's pill, the card and the weather now */
  function daysArrived() {
    daysMemo = null;
    if (!root || renderedFor == null || running) return;
    if (on3D()) { s3('sync', islandView()); s3('setAnchors', anchors3D()); } else drawStage();
    drawIsleBar(); syncNext();
    applyWeather();
  }
  /* SLIslandDays.today() for the child on now: worked out once per save revision, island day and loaded module (a
     commit, another day, the people core or the care rules arriving all make it again) */
  var daysMemo = null;
  function dayNow(u) {
    var D = DAYS();
    u = u || me();
    if (!D || !u) return null;
    var day = careDay(), key = [state.activeUser, day, commitRev, trial(), !!PC(), !!care(), coinsOn()].join('|');
    if (daysMemo && daysMemo.key === key && daysMemo.u === u) return daysMemo.t;
    var t = null;
    try { t = D.today(C, u, { day: day, people: PC(), care: care(), wallet: typeof C.walletOf === 'function' ? C.walletOf() : undefined, trial: trial() }); } catch (e) { t = null; }
    daysMemo = { key: key, u: u, t: t };
    return t;
  }
  function didSet(t) { var o = {}; ((t && t.did) || []).forEach(function (f) { o[f] = true; }); return o; }
  /* the island day is counted by the first real My Island open on a new island day (world-core's own rule: a day not
     after the last one counted changes nothing) */
  function dayDue(w) {
    if (typeof C.countIslandDay !== 'function' || !w) return false;
    var d = typeof C.daysOf === 'function' ? C.daysOf(w) : null;
    return !(d && typeof d.day === 'string' && d.day >= careDay());
  }
  /* inside the open's one commit (render): the pets' step (P4.1) and the island day's count, side by side */
  function openStep(u, dueCare, dueDay) {
    var out = dueCare ? careStep(u) : { ok: false, events: [] };
    if (dueDay) {
      var r = C.countIslandDay(u, careDay(), nowMs(), typeof C.walletOf === 'function' ? { wallet: C.walletOf() } : undefined);
      if (r && r.ok && r.changed) { out.ok = true; out.counted = { n: r.n, up: r.up }; }
    }
    return out;
  }
  /* writes for today's done flags (and what goes with them) in one commit: fn(u, day, ms) → true when it changed
     something. The Next step card is worked out again afterwards (its card moves on once its thing is done) */
  function dayWrite(fn) {
    var day = careDay(), ms = nowMs(), who = state.activeUser;
    return commit(function (u) { return fn(u, day, ms) ? { ok: true } : { ok: false }; }).then(function (res) {
      if (res && res.ok && state.activeUser === who) syncNext();
      return !!(res && res.ok);
    }, function () { return false; });
  }
  function markDay(flag, opts) {
    if (typeof C.markDid !== 'function') return Promise.resolve(false);
    return dayWrite(function (u, day, ms) { var r = C.markDid(u, flag, day, ms, opts); return !!(r && r.ok && r.changed); });
  }
  /* the pet's once-a-day play (+1 happy, as My pets → Play; James's default §9.9), inside a commit → true when it counted */
  function playOnce(u, petId, day, ms) {
    var P = care(), w = C.ensureWorld(u);
    if (!P || !careStarted(w) || C.petWhere(w, petId) !== 'home') return false;
    var r = P.play(u, petId, day, ms);
    return !!(r && r.ok && r.counted);
  }
  function happyToast(petId) {
    var cp = C.crewPet(W(), petId);
    if (cp && !document.querySelector('.slw-toast button, .slw-ov, .slw-cele')) toast(tx('care.happyUp', { name: cp.name }));
  }

  /* ---------------- 📋 Today: the sign over the house and its sheet ---------------- */
  function houseOf(w) { var l = C.placedOn(w, 'home'); for (var i = 0; i < l.length; i++) { var it = l[i] && C.item(l[i].id); if (it && it.act === 'home') return l[i]; } return null; }
  /* new stamps since the book was last closed (the sign's dot): the core's own count, never shown as a number */
  function bookNew(w) {
    var f = w && typeof C.findsOf === 'function' ? C.findsOf(w) : null;
    return !!f && typeof C.stampCount === 'function' && C.stampCount(f) > (typeof f.seen === 'number' ? f.seen : 0);
  }
  function todaySignHtml(cls, style) {
    var w = W();
    if (!DAYS() || !w) return '';
    var dot = bookNew(w);
    return '<button type="button" class="slw-todaysign' + (cls ? ' ' + cls : '') + '"' + (style ? ' style="' + style + '"' : '') + ' data-today="1" aria-label="' + esc(tx('act.today.title') + (dot ? '. ' + tx('act.today.newStamps') : '')) + '">' +
      '<span class="tx">' + esc(tx('act.today.sign')) + '</span>' + (dot ? '<span class="slw-tdot" style="--slw-me:' + esc(userInfo().color) + ';"></span>' : '') + '</button>';
  }
  /* 2D: the sign stands over the house's roof (the house sprite's own box, as objHtml draws it) */
  function today2dHtml(w, st) {
    var h = houseOf(w), it = h && C.item(h.id);
    if (!it || activity || !DAYS()) return '';
    var sp = ART.sprite(h.id, Object.assign({ lit: !!lit[h.uid] }, bldState(st, h))), fw = it.fp[0], fh = it.fp[1];
    var top = PAD + (h.y + fh) * CH - (sp ? sp.h * (fw * 100 / sp.w) : CH * 2);
    return todaySignHtml('slw-today2d', 'left:' + pct((h.x + fw / 2) * 100, STAGE_W) + ';top:' + pct(Math.max(48, top + 6), STAGE_H) + ';');
  }
  function showToday() { var t = DAYS() ? dayNow() : null; return t && t.show ? t.show.isle : null; }
  function showTagHtml() { return '<span class="slw-tag slw-showtag">' + esc(tx('act.show.pill')) + '</span>'; }
  /* the dot in place (a stamp found, the book closed), on whichever island picture holds the sign */
  function syncTodaySign() {
    var w = W(), dot = bookNew(w);
    document.querySelectorAll('.slw-todaysign').forEach(function (b) {
      var d = b.querySelector('.slw-tdot');
      b.setAttribute('aria-label', tx('act.today.title') + (dot ? '. ' + tx('act.today.newStamps') : ''));
      if (dot && !d) { d = document.createElement('span'); d.className = 'slw-tdot'; d.setAttribute('style', '--slw-me:' + userInfo().color + ';'); b.appendChild(d); }
      else if (!dot && d) d.remove();
    });
  }
  var WX_ICON = { sunny: '☀️', breezy: '☁️', starry: '✨', snow: '❄️' };
  /* one row: its picture, its lines (escaped here), at most one button, a ✓ once its thing is done today */
  function todayRow(kind, pic, lines, btn, done) {
    return '<li class="slw-trow' + (done ? ' done' : '') + '" data-row="' + kind + '"><span class="ic" aria-hidden="true">' + pic + '</span><span class="tx">' +
      lines.filter(Boolean).map(function (l, i) { return '<span class="' + (i ? 'sub' : 'ln') + '">' + esc(l) + '</span>'; }).join('') + '</span>' +
      (done ? '<span class="slw-tdone" role="img" aria-label="' + esc(tx('act.pet.done')) + '">✓</span>' : '') +
      (btn ? '<button type="button" class="slw-btn" data-tgo="' + kind + '">' + esc(btn) + '</button>' : '') + '</li>';
  }
  /* the first home pet with a wish today (the home order), or null */
  function firstWish(t, w) {
    var W0 = t && t.wishes;
    if (!W0) return null;
    var list = crewOut(w);
    for (var i = 0; i < list.length; i++) if (Object.prototype.hasOwnProperty.call(W0, list[i].id)) return W0[list[i].id];
    return null;
  }
  /* the Today sheet (≤ 7 rows, the empty ones left out): the weather, the visitor, the show, I spy, a wish, 🎯 My goal,
     📖 My island book. Each button goes there (SLWorld.go's island places); free test mode has no goal row */
  function openToday() {
    var D = DAYS(), u = me(), w = W(), t = dayNow(u);
    if (!D || !u || !w || !t || running) return null;
    var did = didSet(t), rows = [], go = {};
    if (t.weather) rows.push(todayRow('weather', WX_ICON[t.weather.kind] || '', [tx(t.weather.key), tx(t.weather.nextKey), looksOn() && t.season ? tx('act.wx.' + t.season) : ''], null, false));
    if (t.visitor) {
      rows.push(todayRow('visitor', peopleIconHtml(t.visitor.id), [tx('act.today.visitor', { name: t.visitor.name }), t.nextVisitor && t.nextVisitor.id !== t.visitor.id ? tx('act.today.nextVisitor', { name: t.nextVisitor.name }) : ''],
        tx('act.vis.hello'), !!did.hello));
      go.visitor = function () { goNow('visitor', {}); };
    }
    if (t.show && showCan(t.show.isle)) {
      rows.push(todayRow('show', typeof ART.isleIcon === 'function' ? ART.isleIcon(t.show.isle) : '', [tx('act.today.show', { island: isleName(t.show.isle) }),
        t.show.next && t.show.next !== t.show.isle ? tx('act.today.nextShow', { island: isleName(t.show.next) }) : ''], tx('act.today.watch'), !!did['show:' + t.show.isle]));
      go.show = function () { goNow('show', { isle: t.show.isle }); };
    }
    if (t.spy) {
      rows.push(todayRow('spy', '👀', [tx('act.today.spy', { island: isleName(t.spy.isle) })], tx('isle.goThere'), !!did['spy:' + t.spy.isle]));
      go.spy = function () { goNow('spy', { isle: t.spy.isle }); };
    }
    var wi = firstWish(t, w);
    if (wi) {
      var meet = wi.kind === 'meet', wl = wi.done ? tx(wi.doneKey, wi.doneParams) : tx(wi.key, wi.params);
      rows.push(todayRow('wish', iconHtml(wi.petId, { acc: C.wornBy(w, wi.petId) }), [wl, wi.done ? '' : tx('act.wish.calm')], wi.done ? null : meet ? tx('act.vis.hello') : tx('isle.goThere'), !!wi.done));
      go.wish = function () { goNow(meet ? 'visitor' : 'isle', meet ? { petId: wi.petId } : { isle: wi.isle, uid: wi.uid, petId: wi.petId }); };
    }
    if (t.goal && C.item(t.goal.id)) {
      var g = t.goal, gs = iState(u, g.id), st = gs && gs.state;
      rows.push(todayRow('goal', iconHtml(g.id, artState(w)), [tx('act.today.goal', { item: g.name }), g.up > 0 ? tx('act.today.up', { n: fmt(g.up) }) : '',
        st === 'affordable' ? tx('next.enough', { item: g.name }) : st === 'short' ? needLine(gs.need) : ''], st === 'affordable' ? tx('next.getIt') : st === 'short' ? tx('learn.go') : null, false));
      go.goal = function () { if (st === 'short') startTrip(g.id, 'item'); else goNow('item', { id: g.id }); };
    }
    /* the book: '{n} stamps so far' (never 'x of y'); the soft dot while it has new stamps */
    var bk = null;
    try { bk = D.book(C, w, PC()); } catch (e) { bk = null; }
    rows.push(todayRow('book', bookNew(w) ? '<span class="slw-tdot" role="img" aria-label="' + esc(tx('act.today.newStamps')) + '" style="--slw-me:' + esc(userInfo().color) + ';"></span>' : '📖',
      [bk ? tx(bk.key, bk.params) : ''], tx('act.book.open'), false));
    go.book = function () { goNow('book', {}); };
    var ov = overlay('<h2>' + esc(tx('act.today.title')) + '</h2><p class="slw-tday">' + esc(tx('act.today.day', { n: t.n })) + '</p><ul class="slw-trows" role="list">' + rows.join('') + '</ul>' +
      '<p class="slw-tcalm">' + esc(tx('act.today.calm')) + '</p>', { small: true, cls: 'slw-todaysheet' });
    ov.querySelectorAll('[data-tgo]').forEach(function (b) {
      b.addEventListener('click', function () { var f = go[b.getAttribute('data-tgo')]; ov._close(); if (f) f(); });
    });
    fillPhotocards(ov);
    return ov;
  }

  /* ---------------- the visitor (A2): who is out on Home, its card and its three things ---------------- */
  /* today's visitor while it may be out: Home, play mode, never over a feeding moment, a game, the Sky map or travel */
  function visitorNow(w) {
    if (!DAYS() || !PC() || !w || mode !== 'play' || skyMapOn || isleNow() !== 'home' || running || feedingNow) return null;
    var t = dayNow(), v = t && t.visitor;
    return v && typeof v.id === 'string' ? v : null;
  }
  /* islandView().visitor: an SLPeopleCore.avatarInfo-style record (the character's own look and wear), or null */
  function visitorView(w) {
    var v = visitorNow(w), P = PC(), d = null;
    if (!v || typeof P.display !== 'function') return null;
    try { d = P.display(v.id); } catch (e) { d = null; }
    if (!d) return null;
    var o = { id: v.id, name: v.name, look: d.look, wear: d.wear, vr: d.vr || {}, sig: v.sig || null };
    try { if (typeof P.lookCode === 'function') o.lk = P.lookCode(d.look); if (typeof P.wearCode === 'function') o.wr = P.wearCode(d.wear, d.vr || {}); } catch (e) {}
    if (reduced) o.instant = true;
    return o;
  }
  /* the stage shows the visitor without a person rig (LOW before the people shapes, an older stage): its portrait tag */
  function visitorTagged() {
    var a = (s3('info') || {}).activities, v = a && a.visitor;
    return !!(v && v.shown !== false && v.rig === false);
  }
  /* the portrait tag follows the stage: the anchors last set carry it (visTagAt). The figure comes or goes only with a
     sync (LOW's people shapes arriving, the visitor stepping aside for a feeding moment and back), so after each one
     the anchors are set again when the tag's place changed; never a second time otherwise */
  var visTagAt = false;
  function visTagCheck() {
    if (!stage3d || !root || renderedFor == null || running) return;          /* a game's stage is the game's */
    var want = !!visitorNow(W()) && visitorTagged();
    if (want !== visTagAt) s3('setAnchors', anchors3D());
  }
  /* the people files came in while the 3D visitor stands as its portrait: the stage draws its figure now (the sync
     takes the tag away) */
  function visitorPeopleIn() {
    if (visTagAt && on3D() && root && renderedFor != null && !running) s3('sync', islandView());
  }
  function visitorTagEl(v) {
    var el = document.createElement('div'); el.className = 'slw-tag3d';
    el.innerHTML = '<button type="button" class="slw-vistag" aria-label="' + esc(tx('act.vis.title', { name: v.name })) + '">' + peopleIconHtml(v.id) + '<span class="nm">' + esc(v.name) + '</span></button>';
    el.querySelector('button').addEventListener('click', function () { if (mode === 'play' && !activity) openVisitor(); });   /* as the 3D and 2D visitor: never over a game */
    fillPeople(el);
    return el;
  }
  /* the 2D visitor: a free square nearest the house's front, never the child's own spot */
  function visitorCell2d(w) {
    var h = houseOf(w), it = h && C.item(h.id);
    if (!h || !it) return null;
    var occ = C.occupancy(w, undefined, 'home'), land = Object.keys(C.landSetOf(w, 'home'));
    var isFree = function (c) { return !(occ.occ[c] && occ.occ[c].layer !== 'ground') && !occ.reserved[c]; };
    var free = land.filter(isFree), near = nearestFirst(free, [h.x + it.fp[0], h.y + it.fp[1] - 1]);
    /* the nearest free square with nothing standing in front of it (a thing's picture there would hide the visitor and
       take its taps), else the nearest */
    var front = near.filter(function (c) { var q = c.split(','), f = q[0] + ',' + (+q[1] + 1); return isFree(f) || land.indexOf(f) < 0; });
    var at = front[0] || near[0];
    return at ? { x: +at.split(',')[0], y: +at.split(',')[1] } : null;
  }
  function visitor2dHtml(w, v) {
    var at = visitorCell2d(w), A = peopleArt(), P = PC(), fig = '';
    if (!at) return '';
    if (A && typeof A.figure === 'function' && P) { try { fig = A.figure(P.display(v.id), {}) || ''; } catch (e) { fig = ''; } }
    if (!fig) wantPeople();
    return '<button type="button" class="slw-visitor2d" style="left:' + pct(at.x * 100 + 15, STAGE_W) + ';top:' + pct(PAD + (at.y + 1) * CH - 110, STAGE_H) + ';z-index:' + (10 + (at.y + 2) * 10 + 4) + ';" aria-label="' +
      esc(tx('act.vis.title', { name: v.name })) + '">' + (fig || peopleIconHtml(v.id)) + '<span class="nm">' + esc(v.name) + '</span></button>';
  }
  function openVisitor() {
    var w = W(), v = visitorNow(w);
    if (!v) return null;
    var did = didSet(dayNow());
    var btn = function (id, label, on) { return '<button type="button" class="slw-btn big' + (on ? ' on' : '') + '" data-vis="' + id + '">' + esc(label) + (on ? ' ✓' : '') + '</button>'; };
    var ov = overlay('<h2>' + esc(tx('act.vis.title', { name: v.name })) + '</h2><div class="slw-vistop"><span class="slw-visface" aria-hidden="true">' + peopleIconHtml(v.id) + '</span><p>' +
      esc(tx('act.vis.hi', { name: v.name })) + '</p></div><div class="slw-visbtns">' + btn('hello', tx('act.vis.hello'), !!did.hello) + btn('tour', tx('act.vis.tour'), !!did.tour) +
      (v.move ? btn('move', tx('act.vis.move'), !!did.move) : '') + '</div>', { small: true, cls: 'slw-vissheet' });
    ov.querySelectorAll('[data-vis]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-vis');
        ov._close();
        if (k === 'hello') sayHello(); else if (k === 'tour') tourStart(); else moveShow();
      });
    });
    fillPhotocards(ov);
    return ov;
  }
  function hop2d(sel) {
    var el = root && root.querySelector('#slwStage ' + sel);
    if (!el || reduced) return;
    el.classList.remove('wave'); void el.offsetWidth; el.classList.add('wave');
  }
  /* 👋 Say hello: the child and the visitor wave; the greeting is counted once an island day (days3.met), each home pet's
     'meet' wish comes true with it (its once-a-day play), and the stamp 'Say hello to a visitor' */
  var byeSaid = -1;
  function sayHello() {
    var w = W(), v = visitorNow(w);
    if (!v) return false;
    if (on3D()) { s3('emote', 'me', 'wave'); s3('emote', 'visitor', 'wave'); } else { hop2d('.slw-me'); hop2d('.slw-visitor2d'); }
    announce(tx('act.vis.waves', { name: v.name }));
    var t = dayNow(), meets = [], played = [];
    Object.keys((t && t.wishes) || {}).forEach(function (id) { var wi = t.wishes[id]; if (wi.kind === 'meet' && !wi.done) meets.push(wi); });
    dayWrite(function (u, day, ms) {
      var r = C.markDid(u, 'hello', day, ms, { met: v.id }), ch = !!(r && r.ok && r.changed);
      meets.forEach(function (wi) {
        var m = C.markDid(u, 'wish:' + wi.petId, day, ms);
        if (m && m.ok && m.changed) { ch = true; if (playOnce(u, wi.petId, day, ms)) played.push(wi.petId); }
      });
      return ch;
    }).then(function (ok) {
      if (!ok) return;
      meets.forEach(function (wi, i) { setTimeout(function () { if (mode === 'play') sayOn('pet:' + wi.petId, tx(wi.doneKey, wi.doneParams)); }, 1200 + i * 4200); });
      if (played.length) happyToast(played[0]);
      visitorBye(meets.length ? 4200 * meets.length + 1200 : 1500);
    });
    noteFind({ kind: 'hello', isle: 'home' });
    return true;
  }
  /* Show me round: the next acted thing tapped on Home in the next 60 s, the visitor turns to it and cheers */
  var tourUntil = 0;
  function tourStart() {
    var v = visitorNow(W());
    if (!v) return;
    tourUntil = Date.now() + 60000;
    sayOn('visitor', tx('act.vis.tourAsk'));
    markDay('tour');
  }
  function tourTap(uid, it) {
    if (!tourUntil || Date.now() > tourUntil || isleNow() !== 'home' || !it.act || it.act === 'launch' || it.act === 'home') return;
    var v = visitorNow(W());
    tourUntil = 0;
    if (!v) return;
    s3('emote', 'visitor', 'cheer', uid);
    if (!on3D()) hop2d('.slw-visitor2d');
    setTimeout(function () { if (mode === 'play') sayOn('visitor', tx('act.vis.loved', { name: v.name, item: it.name })); }, 700);
    visitorBye(5000);
  }
  function moveShow() {
    var v = visitorNow(W());
    if (!v) return;
    if (!s3('emote', 'visitor', 'move')) hop2d('.slw-visitor2d');
    sayOn('visitor', tx('act.vis.moveSay', { move: v.moveKey ? tx(v.moveKey, null, v.moveName || '') : (v.moveName || '') }));
    markDay('move').then(function () { visitorBye(4500); });
  }
  /* after all three: 'Thanks for having me! See you another day.' (once an open) */
  function visitorBye(ms) {
    setTimeout(function () {
      var v = visitorNow(W()), did = didSet(dayNow());
      if (!v || byeSaid === nextOpens || !did.hello || !did.tour || (v.move && !did.move)) return;
      byeSaid = nextOpens;
      sayOn('visitor', tx('act.vis.bye'));
    }, ms || 0);
  }

  /* ---------------- speech bubbles: the stage's say(), else a 2D bubble over the picture ---------------- */
  function el2d(target) {
    var st = root && $('#slwStage', root);
    if (!st || typeof target !== 'string') return null;
    if (target === 'visitor') return st.querySelector('.slw-visitor2d');
    if (target === 'me') return st.querySelector('.slw-me');
    if (target.indexOf('pet:') === 0) return pet2d(target.slice(4));
    if (target.indexOf('u:') === 0) return st.querySelector('[data-uid="' + target.slice(2) + '"]');
    return null;
  }
  /* a 2D picture's placing ('left', 'top', 'width', 'height', 'z-index'), from its style, as drawn inline */
  function css2d(el, prop) {
    var v = el && el.style ? el.style[prop === 'z-index' ? 'zIndex' : prop] : '';
    if (v) return String(v);
    var m = el && el.getAttribute ? new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(el.getAttribute('style') || '') : null;
    return m ? m[1].trim() : '';
  }
  function bubble2d(el, text, sec) {
    var st = root && $('#slwStage', root);
    if (!st || !el) return false;
    var old = st.querySelector('.slw-say2d'); if (old) old.remove();
    var b = document.createElement('div'), r = el.getBoundingClientRect(), s = st.getBoundingClientRect();
    var x = s.width ? (r.left + r.width / 2 - s.left) / s.width * 100 : (parseFloat(css2d(el, 'left')) || 50) + 3, y = s.height ? (r.top - s.top) / s.height * 100 : (parseFloat(css2d(el, 'top')) || 40);
    b.className = 'slw-say2d'; b.textContent = text;
    b.style.left = Math.max(14, Math.min(86, isFinite(x) ? x : 50)) + '%';
    b.style.top = Math.max(16, isFinite(y) ? y : 40) + '%';
    st.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.remove(); }, (sec || 4) * 1000);
    return true;
  }
  /* a bubble over target ('visitor' | 'me' | 'pet:<id>' | 'u:<uid>') for sec s, read out for screen readers; → shown */
  function sayOn(target, text, sec) {
    if (!text) return false;
    if (on3D() && typeof stage3d.say === 'function') return s3('say', target, text, { sec: sec || 4 }) === true;
    var el = el2d(target);
    announce(text);
    return el ? bubble2d(el, text, sec) : false;
  }

  /* ---------------- one activity at a time: the show, I spy, fetch, hide and seek ---------------- */
  var activity = null, actSeq = 0, actQuiet = false;
  function actLive(kind) { return !!activity && (!kind || activity.kind === kind); }
  function startActivity(a) {
    endActivity('replaced');
    petChipsAt = null;
    a.id = ++actSeq; a.who = state.activeUser; a.timers = [];
    activity = a;
    document.addEventListener('keydown', actKeys);
    drawActs();
    if (on3D()) s3('setAnchors', anchors3D());          /* the 📋 sign and a pet's chips step aside while it plays */
    return a;
  }
  /* why: done, esc, sheet, edit, travel, map, game, hide (the tab), user, tap, replaced … */
  function endActivity(why) {
    var a = activity;
    if (!a) return false;
    activity = null;
    document.removeEventListener('keydown', actKeys);
    a.timers.forEach(function (h) { clearTimeout(h); });
    try { if (a.stop) a.stop(a, why); } catch (e) {}
    drawActs();
    if (on3D() && root && renderedFor != null) s3('setAnchors', anchors3D());
    return true;
  }
  /* a timer that only fires while this activity is still the live one */
  function later(a, ms, fn) { a.timers.push(setTimeout(function () { if (activity === a) fn(); }, ms)); }
  function actKeys(e) { if (e.key === 'Escape' && activity && islandOnScreen()) { e.preventDefault(); endActivity('esc'); } }
  /* the strip pinned to the top of the stage: what is going on and its buttons (≥ 48 px) */
  function barBtn(id, label, aria) { return '<button type="button" class="slw-btn" data-pb="' + id + '" data-fk="pb:' + id + '"' + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + esc(label) + '</button>'; }
  function barHtml(a) {
    var line = '', b = [], k = a.kind, done = barBtn('done', tx('act.pet.done'));
    if (k === 'show') {
      line = a.phase === 'end' ? tx('act.show.end') : tx('act.show.open', { island: isleName(a.isle) });
      b = a.phase === 'end' ? [barBtn('again', tx('act.show.again')), done] : [barBtn('skip', tx('act.show.skip'))];
    } else if (k === 'spy') {
      line = a.line || (a.clue ? tx(a.clue.key, a.clue.params || undefined) : '');
      if (a.line && a.waitNext) b.push(barBtn('next', tx('act.spy.next')));
      else if (a.clue) {
        if (speech()) b.push(barBtn('read', tx('act.spy.read')));
        b.push(a.hint ? barBtn('show', tx('act.spy.show')) : barBtn('clue', tx('act.spy.clue')));
      }
      b.push(barBtn('close', '✕', 'Close'));
    } else if (k === 'fetch') {
      line = a.phase === 'end' ? tx('act.fetch.done', { name: a.name }) : a.line || tx('act.fetch.how');
      b = a.phase === 'end' ? [barBtn('again', tx('act.pet.again')), done] : [done];
    } else if (k === 'hide') {
      line = a.phase === 'end' ? tx('act.hide.end', { name: a.name, n: a.round }) : a.phase === 'count' ? tx('act.hide.count') : a.line || tx(a.two ? 'act.hide.where2d' : 'act.hide.where', { name: a.name });   /* the 2D island cannot turn */
      b = a.phase === 'end' ? [barBtn('again', tx('act.pet.again')), done] : a.phase === 'seek' && !a.wob ? [barBtn('clue', tx('act.spy.clue')), done] : [done];
    }
    return '<div id="slwPlayBar" class="slw-playbar slw-pb-' + k + '" role="group" aria-label="' + esc(tx('act.free.title')) + '"><span class="slw-pbtx" role="status">' + esc(line) + '</span>' +
      '<span class="slw-pbbtns">' + b.join('') + '</span></div>';
  }
  /* the strip, the HUD's 'playing' look (its places go quiet while a pet plays or a show runs: .slw[data-playing] dims
     them in their row, so nothing moves; a tap on one still works and ends the game, as a sheet, Edit or a game does),
     the 3D weather overlay and the 2D fetch taps, after every draw and change */
  function drawActs() {
    var wrap = root && root.querySelector('.slw-stagewrap'), slw = root && root.querySelector('.slw');
    if (!wrap) return;
    var a = activity && activity.who === state.activeUser ? activity : null;
    if (slw) { if (a && a.kind !== 'spy') slw.setAttribute('data-playing', a.kind); else slw.removeAttribute('data-playing'); }
    var old = wrap.querySelector('#slwPlayBar'), fk = old ? focusKey(old) : null;
    if (old) old.remove();
    wrap.classList.toggle('slw-barup', !!a);                     /* the camera buttons step under the strip (phones) */
    wrap.querySelectorAll('.slw-today2d').forEach(function (b) { b.hidden = !!a; });   /* 📋 steps aside while it plays (as in 3D) */
    if (a) {
      var box = document.createElement('div'); box.innerHTML = barHtml(a);
      var bar = box.firstChild;
      wrap.insertBefore(bar, wrap.firstChild);
      bar.querySelectorAll('[data-pb]').forEach(function (b) { b.addEventListener('click', function () { barTap(a, b.getAttribute('data-pb')); }); });
      if (fk && !refocus(bar, fk)) { var first = bar.querySelector('button'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {} }
      /* the strip lies over the stage's top whatever its height (a phone wraps its buttons onto a second row): the stage
         never moves, and the camera buttons step under it (--slw-barh, island-pixel.css) */
      var bh = bar.offsetHeight || 0;
      if (bh > 0) { bar.style.marginBottom = -bh + 'px'; try { wrap.style.setProperty('--slw-barh', bh + 'px'); } catch (e) {} }
    }
    var wx = wrap.querySelector('.slw-wx3d');
    if (on3D() && wxNow) { if (!wx) { var bx = document.createElement('div'); bx.innerHTML = wxHtml('slw-wx3d'); if (bx.firstChild) wrap.appendChild(bx.firstChild); } }
    else if (wx) wx.remove();
    var st = $('#slwStage', root);
    if (st && !st._slwFetch) { st._slwFetch = true; st.addEventListener('click', fetch2dTap); }
  }
  function barTap(a, id) {
    if (activity !== a) return;
    if (id === 'done' || id === 'close' || id === 'skip') { endActivity(id); return; }
    if (a.kind === 'show' && id === 'again') { var k = a.isle; endActivity('again'); startShow(k); return; }
    if (a.kind === 'spy') { spyBar(a, id); return; }
    if (a.kind === 'fetch' && id === 'again') { a.n = 0; a.phase = 'throw'; a.line = null; s3('playTaps', true); drawActs(); return; }
    if (a.kind === 'hide') { if (id === 'again') { a.round = 0; hideRound(a); } else if (id === 'clue') hideClue(a); }
  }

  /* ---------------- the show (A3): today's island, or the one the child is on, any time ---------------- */
  function showPlanOf(k) {
    var D = DAYS(), w = W();
    if (!D || !w || !C.ISLES[k] || !C.isleUnlocked(w, k)) return null;
    var info = on3D() ? s3('info') || {} : {};
    return D.showPlan(C, w, k, info.tier || 'mid');
  }
  function showCan(k) { var p = showPlanOf(k); return !!p && (!!p.landmark || p.uids.length > 0 || !!p.finale); }
  function startShow(isle) {
    var k = typeof isle === 'string' && C.ISLES[isle] ? isle : isleNow();
    if (mode !== 'play' || running || skyMapOn || k !== isleNow()) return false;
    var plan = showPlanOf(k);
    if (!plan || !(plan.landmark || plan.uids.length || plan.finale)) return false;
    var steps = (plan.landmark ? [plan.landmark] : []).concat(plan.uids);
    var a = startActivity({ kind: 'show', isle: k, steps: steps, finale: plan.finale, i: 0, phase: 'on', lit0: {}, stop: showStop });
    steps.concat(plan.finale ? [plan.finale] : []).forEach(function (uid) { a.lit0[uid] = !!lit[uid]; });
    document.addEventListener('pointerdown', showTapOff, true);
    /* show day: its host (Home: today's visitor beside the stage; a land: a bubble over the landmark names its character) */
    var t = dayNow(), host = t && t.show && t.show.isle === k ? t.show.host : null;
    if (host && host.name) {
      var hl = tx('act.show.host', { name: host.name });
      if (k === 'home') sayOn('visitor', hl); else if (plan.landmark) sayOn('u:' + plan.landmark, hl);
    }
    later(a, host ? 2200 : 900, function () { showStep(a); });
    return true;
  }
  /* any tap on the stage ends the show (its strip's own buttons are outside the stage) */
  function showTapOff(e) {
    var st = root && root.querySelector('#slwStage');
    if (actLive('show') && st && e && e.target && st.contains(e.target)) endActivity('tap');
  }
  /* a thing plays as a tap would (its sounds, its re-tap guard, reduced motion), framed first */
  function showPlay(uid) {
    var el = null;
    if (on3D()) s3('frameItem', uid);
    else { el = root && root.querySelector('#slwStage [data-uid="' + uid + '"]'); if (el) show2d(el); }
    actQuiet = true;
    try { tapItem(uid, el); } finally { actQuiet = false; }
  }
  function relit(uid, v) { lit[uid] = v; if (on3D()) s3('setLit', uid, v); else redrawItem(uid); }
  function showStep(a) {
    if (a.i >= a.steps.length) { showFinale(a); return; }
    var uid = a.steps[a.i++], f = findPlaced(W(), uid), it = f && C.item(f.p.id);
    if (!f || !it || f.isle !== a.isle || f.isle !== isleNow()) { showStep(a); return; }
    var ai = C.ACT_INFO && it.act ? C.ACT_INFO[it.act] : null, sec = ai && ai.sec > 0 ? ai.sec : 2;
    showPlay(uid);
    later(a, reduced ? 1500 : Math.min(9000, Math.round((sec + 1) * 1000)), function () {
      if (ai && ai.toggle && it.act !== 'drawbridge' && !!lit[uid] !== a.lit0[uid]) relit(uid, a.lit0[uid]);   /* lit up, then back */
      showStep(a);
    });
  }
  /* the crew's dance break, then Home's Concert Stage encore when one is placed */
  function showFinale(a) {
    if (on3D()) s3('danceNow');
    later(a, on3D() && !reduced ? 4500 : 600, function () {
      if (!a.finale) { showEnd(a); return; }
      showPlay(a.finale);
      later(a, reduced ? 1500 : 8500, function () { showEnd(a); });
    });
  }
  function showEnd(a) {
    a.phase = 'end';
    showRestore(a);
    drawActs();
    markDay('show:' + a.isle);
    noteFind({ kind: 'show', isle: a.isle });
    later(a, 10000, function () { endActivity('ended'); });
  }
  /* lights and the drawbridge go back as they were */
  function showRestore(a) { Object.keys(a.lit0).forEach(function (uid) { if (!!lit[uid] !== a.lit0[uid]) relit(uid, a.lit0[uid]); }); }
  function showStop(a) { document.removeEventListener('pointerdown', showTapOff, true); showRestore(a); }

  /* ---------------- I spy (A4): the island's next clue; any thing that fits counts, nothing is ever 'wrong' ---------------- */
  /* a thing's name inside a line ('Yes! The {item} fits.', 'Look near the {item}.', 'Not behind the {item}…'): the house
     is 'house' (home.house), as its catalogue name 'Your Home' would read 'the Your Home' */
  function lineName(it) { return it && it.kind === 'house' ? tx('home.house', null, 'house') : (it && it.name) || ''; }
  function speech() { try { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function'; } catch (e) { return false; } }
  function spyCan(k) { var D = DAYS(), w = W(); return !!(D && w && C.ISLES[k] && C.isleUnlocked(w, k) && D.clues(C, w, k, { n: (dayNow() || {}).n || 0 }).length > 0); }
  function startSpy(isle) {
    var k = typeof isle === 'string' && C.ISLES[isle] ? isle : isleNow();
    if (!DAYS() || mode !== 'play' || running || skyMapOn || k !== isleNow() || !spyCan(k)) return false;
    var a = startActivity({ kind: 'spy', isle: k, n: (dayNow() || {}).n || 0, skip: [], clue: null, hint: 0, line: null, waitNext: false, said: false, stop: spyStop });
    spyNext(a);
    return activity === a;
  }
  function spyNext(a) {
    var D = DAYS(), w = W(), cl = D && w ? D.clues(C, w, a.isle, { n: a.n, skip: a.skip }) : [];
    if (!cl.length) { endActivity('none'); return; }
    var c = cl[0];
    a.hint = 0; a.line = null; a.waitNext = false;
    if (c.again && !a.said) { a.said = true; a.clue = null; a.line = tx('act.spy.again'); a.waitNext = true; drawActs(); return; }
    a.clue = c;
    drawActs();
  }
  function spyBar(a, id) {
    var c = a.clue;
    if (id === 'next') { spyNext(a); return; }
    if (!c) return;
    if (id === 'read') {
      try { var s = new window.SpeechSynthesisUtterance(tx(c.key, c.params || undefined)); s.lang = 'en-GB'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(s); } catch (e) {}
      return;
    }
    if (id === 'clue') {
      var nb = spyNear(a, c);
      if (nb) sayOn('u:' + nb.uid, tx('act.spy.near', { item: nb.name }));
      a.hint = 1; drawActs(); return;
    }
    if (id === 'show') {
      var uid = spyUids(a, c)[0], el = uid && root && root.querySelector('#slwStage [data-uid="' + uid + '"]');
      if (!uid) return;
      if (on3D()) { s3('frameItem', uid); s3('focusItem', 'u:' + uid); later(a, 2500, function () { s3('focusItem', null); }); }
      else if (el) { show2d(el); el.classList.add('slw-spyglow'); setTimeout(function () { el.classList.remove('slw-spyglow'); }, 1000); }
    }
  }
  /* what answers the clue now: the uids the rules gave, and anything placed since that fits (matches) */
  function spyUids(a, c) {
    var D = DAYS(), w = W(), out = (c.uids || []).filter(function (u) { var f = findPlaced(w, u); return !!f && f.isle === a.isle; });
    C.placedOn(w, a.isle).forEach(function (p) { if (out.indexOf(p.uid) < 0 && D && D.matches(C, c.id, p.id, w, a.isle)) out.push(p.uid); });
    return out;
  }
  /* the thing nearest the first answer that is not an answer itself (the clue names it: 'Look near the …') */
  function spyNear(a, c) {
    var w = W(), ans = spyUids(a, c), f = ans[0] && findPlaced(w, ans[0]);
    if (!f) return null;
    var best = null;
    C.placedOn(w, a.isle).forEach(function (p) {
      var it = C.item(p.id);
      if (!it || it.kind === 'path' || ans.indexOf(p.uid) >= 0) return;
      var d = Math.abs(p.x - f.p.x) + Math.abs(p.y - f.p.y);
      if (!best || d < best.d) best = { uid: p.uid, name: lineName(it), d: d };
    });
    return best;
  }
  function spyTap(a, uid, it) {
    var c = a.clue;
    if (!c || a.isle !== isleNow() || spyUids(a, c).indexOf(uid) < 0) return;
    a.skip.push(c.id); a.clue = null; a.line = tx('act.spy.yes', { item: lineName(it) });
    drawActs();
    later(a, 400, function () { sayOn('u:' + uid, a.line); });
    if (!c.again) noteFind({ kind: 'spy', isle: a.isle, clue: c.id });
    markDay('spy:' + a.isle);
    later(a, 2600, function () { spyNext(a); });
  }
  function spyStop() { if (on3D()) s3('focusItem', null); }

  /* ---------------- play with your pet (A5): 🎾 Fetch and 🙈 Hide and seek ---------------- */
  /* a home pet out on the island shown (the runner first), not hungry, while the island can play: {id, name} | null */
  function playPet(id) {
    var w = W();
    if (!w || mode !== 'play' || skyMapOn || running || !C.isleUnlocked(w, isleNow())) return null;
    if (on3D() && typeof stage3d.play !== 'function') return null;
    var k = isleNow(), list = care() ? homeOut(w, k) : petsOut(w, k), moods = careMoods(w);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if ((id && p.id !== id) || (moods[p.id] && moods[p.id].mood.hunger >= 2)) continue;
      return { id: p.id, name: p.name };
    }
    return null;
  }
  function pet2d(id) {
    var host = root && $('#slwPets', root), b = null;
    if (host) host.querySelectorAll('.slw-pet').forEach(function (x) { if (x.getAttribute('data-pet') === id) b = x; });
    return b;
  }
  /* a pat (3D tapPet, a 2D sprite's tap): the day's pat, the pat stamp, the pet's wish once an open and the 🎾 / 🙈 chips
     for 5 s; while hide and seek is on, a tap on the hiding pet finds it */
  var petChipsAt = null, wishSaid = {};
  function petTapped(id) {
    var a = activity;
    if (a && a.kind === 'hide' && a.petId === id && a.phase === 'seek') { hideFound(a); return; }
    patPet(id);
    if (mode !== 'play') return;
    noteFind({ kind: 'pat', isle: isleNow(), petId: id, gear: wearsGear(id, isleNow()) });
    if (a) return;
    wishBubble(id);
    showPetChips(id);
  }
  /* the pet's wish in its tap bubble, once an open */
  function wishBubble(id) {
    var t = dayNow(), wi = t && t.wishes && t.wishes[id];
    if (!wi || wi.done || wishSaid[id] === nextOpens) return;
    wishSaid[id] = nextOpens;
    setTimeout(function () { if (mode === 'play' && !activity) sayOn('pet:' + id, tx(wi.key, wi.params)); }, 500);
  }
  function showPetChips(id) {
    if (!DAYS() || !playPet(id)) return;
    var at = petChipsAt = { id: id, until: Date.now() + 5000, who: state.activeUser };
    chipsNow();
    setTimeout(function () { if (petChipsAt === at) { petChipsAt = null; chipsNow(); } }, 5000);
  }
  function chipsNow() {
    if (!root || renderedFor == null) return;
    if (on3D()) { s3('setAnchors', anchors3D()); return; }
    var host = $('#slwPets', root), old = host && host.querySelector('.slw-petchips');
    if (old) old.remove();
    var c = petChipsAt, b = c && c.who === state.activeUser ? pet2d(c.id) : null;
    if (!b) return;
    var el = petChipsEl(c.id);
    if (!el) return;
    el.style.left = b.style.left; el.style.top = b.style.top;
    host.appendChild(el);
  }
  function petChipsEl(id) {
    var p = playPet(id);
    if (!p) return null;
    var el = document.createElement('div'); el.className = 'slw-tag3d slw-petchips';
    el.innerHTML = '<button type="button" class="slw-btn" data-pchip="fetch">' + esc(tx('act.fetch.chip')) + '</button><button type="button" class="slw-btn" data-pchip="hide">' + esc(tx('act.hide.chip')) + '</button>';
    el.querySelectorAll('[data-pchip]').forEach(function (b) { b.addEventListener('click', function () { petChipsAt = null; startPlay(b.getAttribute('data-pchip'), id); }); });
    return el;
  }
  /* the pet wears a piece of this land's gear (the 'Bring a pet in {land} gear' stamp) */
  function wearsGear(id, k) {
    if (k === 'home') return false;
    var w = W(), worn = w && id ? C.wornBy(w, id) : null;
    return !!worn && Object.keys(worn).some(function (s) { var it = C.item(worn[s]); return !!(it && it.kind === 'acc' && it.isle === k); });
  }
  function startPlay(kind, petId) {
    if ((kind !== 'fetch' && kind !== 'hide') || !DAYS()) return false;
    var p = playPet(petId);
    if (!p) return false;
    var a = startActivity({ kind: kind, petId: p.id, name: p.name, isle: isleNow(), n: 0, round: 0, looks: 0, at: null, phase: kind === 'fetch' ? 'throw' : 'count', line: null, counted: false, two: !on3D(), stop: playStop });
    if (!a.two) {
      var s = s3('play', kind, { petId: p.id, onEvent: function (ev) { if (activity === a) playEvent(a, ev); } });
      if (!s) { endActivity('refused'); return false; }
      a.session = s;
      if (kind === 'fetch') s3('playTaps', true);
      if (s.done && typeof s.done.then === 'function') s.done.then(function (r) { if (activity === a) endActivity((r && r.reason) || 'gone'); });
    }
    if (kind === 'hide') hideRound(a);
    return true;
  }
  function playStop(a, why) {
    if (a.session) { try { if (a.session.live && a.session.live()) a.session.end(why || 'end'); } catch (e) {} s3('playTaps', false); }
    var veil = root && root.querySelector('.slw-veil'); if (veil) veil.remove();
    if (a.two) { var b = pet2d(a.petId); if (b) back2d(b); var ball = root && root.querySelector('.slw-ball2d'); if (ball) ball.remove(); }
  }
  /* the pet's once-a-day play, the stamp and today's flag: the first time a game goes right (a fetch, a find) */
  function playCounted(a) {
    if (a.counted) return;
    a.counted = true;
    var played = false;
    dayWrite(function (u, day, ms) {
      var r = typeof C.markDid === 'function' ? C.markDid(u, a.kind, day, ms) : null;
      played = playOnce(u, a.petId, day, ms);
      return played || !!(r && r.ok && r.changed);
    }).then(function () { if (played) happyToast(a.petId); });
    noteFind({ kind: a.kind, isle: a.isle });
  }
  function playEvent(a, ev) {
    if (a.kind === 'fetch' && ev.type === 'caught') sayOn('pet:' + a.petId, tx('act.fetch.good', { name: a.name }));
    if (a.kind !== 'fetch' || ev.type !== 'fetched' || a.phase !== 'throw') return;
    a.n++;
    playCounted(a);
    if (a.n >= 5) { a.phase = 'end'; s3('playTaps', false); drawActs(); }
  }
  /* fetch: a tap on land throws to that point (3D: on.tapCell's point), on the sea to the nearest beach (on.tapSea) */
  function fetchThrow(x, z) {
    var a = activity;
    if (!a || a.kind !== 'fetch' || a.phase !== 'throw' || !a.session || typeof a.session.throwTo !== 'function') return false;
    return a.session.throwTo(x, z) >= 0;
  }
  /* plan §7: fetch takes any land or sea tap. A tap on a thing (a busy island is mostly things) plays it as ever and
     throws the ball there too: 3D at its footprint's middle (SLGrid3D's island frame; the brain lands the ball on the
     nearest free square), 2D at its picture */
  function fetchAt(a, uid, el) {
    if (a.phase !== 'throw') return;
    var f = findPlaced(W(), uid), it = f && C.item(f.p.id);
    if (!f || !it || f.isle !== isleNow()) return;
    if (!a.two) {
      var G = window.SLGrid3D, F = null;
      try { F = G && G.V3 && typeof G.V3.frame === 'function' ? G.V3.frame(f.isle) : null; } catch (e) { F = null; }
      var fp = it.fp || [1, 1], c = F && typeof F.cellCenter === 'function' ? F.cellCenter(f.p.x + (fp[0] - 1) / 2, f.p.y + (fp[1] - 1) / 2) : null;
      if (c) fetchThrow(c.x, c.z);
      return;
    }
    if (!el || a.flying) return;
    var x = parseFloat(css2d(el, 'left')) + parseFloat(css2d(el, 'width')) / 2, y = parseFloat(css2d(el, 'top')) + parseFloat(css2d(el, 'height'));
    if (!isFinite(x) || !isFinite(y)) return;
    a.flying = run2d(pet2d(a.petId), x, y, reduced, function (ms, fn) { later(a, ms, fn); }, function () { a.flying = false; playEvent(a, { type: 'fetched' }); });
  }
  /* 2D fetch: a tap on the ground sends the pet running there with the ball and back to the child */
  function fetch2dTap(e) {
    var a = activity, st = root && $('#slwStage', root);
    if (!a || a.kind !== 'fetch' || !a.two || a.phase !== 'throw' || a.flying || !st) return;
    for (var n = e && e.target; n && n !== st; n = n.parentNode) if (n.tagName === 'BUTTON') return;      /* things and pets play as ever */
    var r = st.getBoundingClientRect(), x = r.width ? (e.clientX - r.left) / r.width * 100 : 50, y = r.height ? (e.clientY - r.top) / r.height * 100 : 60;
    a.flying = run2d(pet2d(a.petId), isFinite(x) ? x : 50, isFinite(y) ? y : 60, reduced, function (ms, fn) { later(a, ms, fn); }, function () { a.flying = false; playEvent(a, { type: 'fetched' }); });
  }
  /* the sprite b runs to (x, y) (% of the stage) after the ball, then back to the child with it; tick(ms, fn) is the
     caller's timer; red: the end state at once */
  function run2d(b, x, y, red, tick, done) {
    var st = root && $('#slwStage', root);
    if (!b || !st) return false;
    b.classList.add('slw-busy');
    var ball = document.createElement('span'); ball.className = 'slw-ball2d'; ball.setAttribute('aria-hidden', 'true'); ball.textContent = '🎾';
    ball.style.left = x + '%'; ball.style.top = y + '%';
    st.appendChild(ball);
    var me2 = st.querySelector('.slw-me'), home = me2 ? { l: (parseFloat(css2d(me2, 'left')) || 40) + 5, t: (parseFloat(css2d(me2, 'top')) || 50) + 4 } : { l: 45, t: 60 };
    var fin = function () { if (ball.parentNode) ball.remove(); b.classList.remove('hop'); void b.offsetWidth; if (!red) b.classList.add('hop'); done(); };
    if (red) { b.style.transitionDuration = '0s'; b.style.left = home.l + '%'; b.style.top = home.t + '%'; tick(300, fin); return true; }
    b.style.transitionDuration = '0.7s'; b.style.zIndex = '955';
    b.classList.toggle('flip', x < (parseFloat(css2d(b, 'left')) || 0));
    b.style.left = Math.max(0, x - 4) + '%'; b.style.top = Math.max(0, y - 12) + '%';
    tick(750, function () { if (ball.parentNode) ball.remove(); b.classList.toggle('flip', home.l < x); b.style.left = home.l + '%'; b.style.top = home.t + '%'; });
    tick(1500, fin);
    return true;
  }
  /* the pet's 2D sprite back to its own life (wandering again) */
  function back2d(b) { b.classList.remove('slw-busy'); b.classList.remove('slw-hid2d'); b.style.zIndex = ''; }
  /* hide and seek: one round — 'Close your eyes… 3, 2, 1!' under a 2 s veil (none under reduced motion) while the pet
     trots behind the round's spot (SLIslandDays.hideOrder: a fixed order from the day and the round) */
  function hideRound(a) {
    a.phase = 'count'; a.looks = 0; a.wob = false; a.line = null; a.at = null;
    drawActs();
    var wrap = root && root.querySelector('.slw-stagewrap');
    if (wrap && !reduced) { var v = document.createElement('div'); v.className = 'slw-veil'; v.setAttribute('aria-hidden', 'true'); wrap.appendChild(v); later(a, 2000, function () { v.remove(); }); }
    var D = DAYS(), order = D ? D.hideOrder(C, W(), a.isle, careDay(), a.round) : [];
    /* 2D: the first spot in the order where the pet's peeking side shows (no thing in front covers it); else the first
       spot it fits at all */
    if (a.two) for (var j = 0; j < order.length && !a.at; j++) if (hide2d(a, order[j], false, true)) a.at = order[j];
    for (var i = 0; i < order.length && !a.at; i++) if (a.two ? hide2d(a, order[i]) : a.session.hideIn(order[i])) a.at = order[i];
    if (!a.at) { endActivity('nowhere'); return; }
    later(a, reduced ? 300 : 2000, function () { a.phase = 'seek'; drawActs(); });
  }
  /* the 2D pet sprite's size (% of the stage): what hide2d tucks behind a thing and cover2d measures */
  var PET2D = { w: 90 / STAGE_W * 100, h: 72 / STAGE_H * 100 };
  function box2d(el) {
    var L = parseFloat(css2d(el, 'left')), T = parseFloat(css2d(el, 'top')), Wd = parseFloat(css2d(el, 'width')), Hd = parseFloat(css2d(el, 'height')), z = parseInt(css2d(el, 'z-index'), 10);
    return isFinite(L) && isFinite(T) && isFinite(Wd) && isFinite(Hd) ? { l: L, t: T, w: Wd, h: Hd, z: isFinite(z) ? z : 10 } : null;
  }
  /* the things drawn over a z (the 2D island's pictures, but the one named) */
  function fronts2d(z, but) {
    var st = root && $('#slwStage', root), out = [];
    if (st) st.querySelectorAll('[data-uid]').forEach(function (e) { var b = e.getAttribute('data-uid') !== but && box2d(e); if (b && b.z > z) out.push(b); });
    return out;
  }
  /* peek: only a spot where the pet's peeking side (the quarter past the thing's far edge) is not hidden by a thing in
     front (≥ 3 of its 4 sample points covered) */
  function hide2d(a, uid, instant, peek) {
    var b = pet2d(a.petId), el = root && root.querySelector('#slwStage [data-uid="' + uid + '"]'), r = el && box2d(el);
    if (!b || !r) return false;
    var x = r.l + r.w - PET2D.w * 0.72, y = r.t + r.h - PET2D.h - 1.5, z = Math.max(1, r.z - 1);   /* tucked behind its far side: a quarter of it (an ear, a tail) peeps out */
    if (peek) {
      var fr = fronts2d(r.z - 1, uid), hid = 0, x0 = r.l + r.w, x1 = x + PET2D.w;
      [[0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]].forEach(function (q) {
        var px = x0 + (x1 - x0) * q[0], py = y + PET2D.h * q[1];
        if (fr.some(function (f) { return px >= f.l && px <= f.l + f.w && py >= f.t && py <= f.t + f.h; })) hid++;
      });
      if (hid >= 3) return false;
    }
    b.classList.add('slw-busy'); b.classList.add('slw-hid2d');
    b.style.transitionDuration = reduced || instant ? '0s' : '1.4s';
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.style.zIndex = String(z);
    return true;
  }
  /* a look at a thing drawn over the hiding pet (2D: its picture covers a quarter of the pet's; 3D: the stage's
     covers(), the line from the camera to the pet goes through it) finds the pet as the hiding place itself does:
     the child saw it go behind there */
  function hideCovers(a, uid) {
    if (!a.two) { try { return !!(a.session && typeof a.session.covers === 'function' && a.session.covers(uid)); } catch (e) { return false; } }
    var b = pet2d(a.petId), el = root && root.querySelector('#slwStage [data-uid="' + uid + '"]'), r = el && box2d(el);
    var px = b && parseFloat(css2d(b, 'left')), py = b && parseFloat(css2d(b, 'top')), pz = b && parseInt(css2d(b, 'z-index'), 10);
    if (!r || !isFinite(px) || !isFinite(py) || !isFinite(pz) || !(r.z > pz)) return false;
    var ox = Math.min(r.l + r.w, px + PET2D.w) - Math.max(r.l, px), oy = Math.min(r.t + r.h, py + PET2D.h) - Math.max(r.t, py);
    return ox > 0 && oy > 0 && ox * oy >= 0.25 * PET2D.w * PET2D.h;
  }
  /* a look behind a thing (any tap on a thing while seeking): the right one finds the pet; any other plays as ever and
     says 'Not behind the …'; after 3 looks the right thing wobbles */
  function hideTap(a, uid, it) {
    if (a.phase !== 'seek' || a.isle !== isleNow()) return;
    if (uid === a.at || hideCovers(a, uid)) { hideFound(a); return; }
    later(a, 300, function () { sayOn('u:' + uid, tx('act.hide.no', { item: lineName(it) })); });
    if (++a.looks >= 3 && !a.wob) hideClue(a);
  }
  function hideClue(a) {
    if (a.phase !== 'seek' || !a.at) return;
    a.wob = true; a.line = tx('act.hide.wobble');
    if (a.two) {
      var el = root && root.querySelector('#slwStage [data-uid="' + a.at + '"]');
      if (el) { el.classList.remove('slw-wob2d'); void el.offsetWidth; el.classList.add('slw-wob2d'); setTimeout(function () { el.classList.remove('slw-wob2d'); }, 1300); }
    } else if (a.session && typeof a.session.wobble === 'function') a.session.wobble(a.at);
    drawActs();
  }
  function hideFound(a) {
    if (a.phase !== 'seek') return;
    a.phase = 'found'; a.round++; a.line = tx('act.hide.found', { name: a.name });
    if (a.two) { var b = pet2d(a.petId); if (b) { back2d(b); b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); fx(b, '✦'); } }
    else if (a.session && typeof a.session.found === 'function') a.session.found();
    sayOn('pet:' + a.petId, a.line);
    playCounted(a);
    drawActs();
    later(a, 2600, function () {
      if (a.round >= 3) { a.phase = 'end'; drawActs(); return; }
      hideRound(a);
    });
  }
  /* a redraw of the 2D island mid-game puts the playing pet back where the game has it */
  function acts2dPets() {
    var a = activity;
    if (!a || !a.two || (a.kind !== 'fetch' && a.kind !== 'hide')) return;
    var b = pet2d(a.petId);
    if (!b) return;
    b.classList.add('slw-busy');
    if (a.kind === 'hide' && a.at && (a.phase === 'seek' || a.phase === 'count')) hide2d(a, a.at, true);
  }
  /* My pets → Play (pet-care-ui's stagePlay seam): three automatic throws on the island (about 6 s), true when they
     played; false when the pet is not out on the island shown (the portrait bounces instead) */
  function stagePlay(petId, o) {
    var red = reduced || !!(o && o.reduced);
    if (on3D()) {
      if (typeof stage3d.play !== 'function') return Promise.resolve(false);
      s3('setCovered', false);                          /* the Pet Corner's strip shows the island: the stage may play */
      var s = s3('play', 'fetch', { petId: petId, auto: 3 });
      if (!s || !s.done || typeof s.done.then !== 'function') return Promise.resolve(false);
      return s.done.then(function (r) { return !!r; }, function () { return false; });
    }
    var b = pet2d(petId);
    if (!b || mode !== 'play' || activity) return Promise.resolve(false);
    var tick = function (ms, fn) { setTimeout(function () { if (b.isConnected) fn(); }, ms); };
    return new Promise(function (res) {
      var k = 0, spots = [[38, 70], [62, 66], [50, 76]], end = function () { back2d(b); res(true); };
      (function next() {
        if (k >= spots.length || !b.isConnected) { end(); return; }
        var s2 = spots[k++];
        if (!run2d(b, s2[0], s2[1], red, tick, next)) end();
      }());
      setTimeout(function () { if (b.isConnected) back2d(b); }, 8000);
    });
  }

  /* ---------------- the pets' wishes (A1): a ride or a rest on the thing, a visit, meeting the visitor ---------------- */
  function wishDone(wi, at) {
    var played = false;
    dayWrite(function (u, day, ms) {
      var r = C.markDid(u, 'wish:' + wi.petId, day, ms);
      if (!(r && r.ok && r.changed)) return false;
      played = playOnce(u, wi.petId, day, ms);
      return true;
    }).then(function (ok) {
      if (!ok) return;
      var line = tx(wi.doneKey, wi.doneParams);
      setTimeout(function () {
        if (mode !== 'play') return;
        if (on3D()) s3('emote', 'pet:' + wi.petId, 'heart');
        if (!sayOn('pet:' + wi.petId, line) && at) sayOn(at, line);
      }, 900);
      if (played) happyToast(wi.petId);
    });
  }
  function wishTap(uid) {
    var t = dayNow(), W0 = (t && t.wishes) || {};
    Object.keys(W0).forEach(function (id) { var wi = W0[id]; if (!wi.done && (wi.kind === 'ride' || wi.kind === 'rest') && wi.uid === uid) wishDone(wi, 'u:' + uid); });
  }

  /* ---------------- the hooks in the island's own handlers ---------------- */
  /* a tap on a thing in play mode (tapItem; never the show's own plays): the stamp, Show me round, a wish, I spy, hide
     and seek; a tap on the stage ends a show */
  function actTap(uid, it, el) {
    if (mode !== 'play' || actQuiet) return;
    if (actLive('show')) endActivity('tap');
    noteFind({ kind: 'act', isle: isleNow(), uid: uid });
    tourTap(uid, it);
    wishTap(uid);
    if (actLive('spy')) spyTap(activity, uid, it, el);
    if (actLive('hide')) hideTap(activity, uid, it);
    if (actLive('fetch')) fetchAt(activity, uid, el);
  }
  /* Shake a tree (a Home tree has no act): its season's leaves, blossom, snow or butterflies (one burst ≤ 1 s) */
  var SEASON_GLYPH = { spring: '🌸', summer: '🦋', autumn: '🍂', winter: '❄' };
  function shakeable(it) { return !!it && !it.act && typeof it.id === 'string' && it.id.indexOf('tree_') === 0 && !!DAYS() && isleNow() === 'home'; }
  function shakeTree(uid, it, el) {
    if (!shakeable(it) || mode !== 'play') return false;
    var t = dayNow(), season = t && t.season, on = looksOn() && !!season;
    if (on3D()) { if (on) s3('burst', uid, season); }
    else if (el) { el.classList.remove('slw-wiggle'); void el.offsetWidth; el.classList.add('slw-wiggle'); if (on) fx(el, SEASON_GLYPH[season] || '✦'); }
    sample('chip', 0.4) || sfx('tick');
    noteFind({ kind: 'tree', isle: 'home', uid: uid });
    return true;
  }
  /* the pet travelling with the child to island k: the runner the island draws there (petsOut's first; with pet care
     only a pet really at home, never one at the Pet Rescue or the Pet Hotel, nor a star), or null */
  function travelPet(w, k) {
    var p = w ? petsOut(w, k)[0] : null;
    return p && (!care() || (p.active && C.petWhere(w, p.id) === 'home')) ? p.id : null;
  }
  /* on a land the child owns: the visit stamp (and its pet passport: the pet that travels with the child), Showtime's,
     the gear stamp and a visit wish */
  function arrivedActs(k) {
    var w = W(), out = travelPet(w, k);
    noteFind({ kind: 'visit', isle: k, petId: k !== 'home' && out ? out : undefined, gear: out ? wearsGear(out, k) : false });
    if (showtimeOn && k !== 'home') noteFind({ kind: 'night', isle: k });
    var t = dayNow(), wi = out && t && t.wishes ? t.wishes[out] : null;
    if (wi && !wi.done && wi.kind === 'visit' && wi.isle === k) wishDone(wi, null);
  }

  /* ---------------- stamps: noted now, written 1.5 s later in one commit ---------------- */
  var findQ = [], findT = 0, findWho = null, FIND_MS = 1500;
  /* ev = SLIslandDays.note's event ({kind, isle, id?, uid?, petId?, gear?, clue?}); never in edit or place mode, over
     a game or without the rules → whether it was noted */
  function noteFind(ev) {
    if (!ev || !DAYS() || typeof C.addFinds !== 'function' || mode !== 'play' || running || !me()) return false;
    if (findWho !== state.activeUser) { findQ = []; findWho = state.activeUser; }
    var e = {};
    Object.keys(ev).forEach(function (k) { if (ev[k] != null && ev[k] !== false) e[k] = ev[k]; });
    if (typeof e.isle !== 'string') e.isle = isleNow();
    findQ.push(e);
    if (!findT) findT = setTimeout(flushFinds, FIND_MS);
    return true;
  }
  function flushFinds() {
    if (findT) { clearTimeout(findT); findT = 0; }
    var evs = findQ, who = findWho, D = DAYS();
    findQ = [];
    if (!evs.length || !D || who !== state.activeUser) return Promise.resolve(null);
    var day = careDay(), ms = nowMs();
    return commit(function (u) {
      var r = D.note(C, C.ensureWorld(u), evs, day);
      if (D.empty(r)) return { ok: false };
      var res = C.addFinds(u, r, day, ms);
      return res && res.ok && res.changed ? res : { ok: false };
    }).then(function (res) {
      if (res && res.ok && state.activeUser === who) findsDone(who, res);
      return res || null;
    }, function () { return null; });
  }
  /* what the commit found: the stamps to say (never the I spy clue records), the pages it completed */
  var stampsDue = [], pagesDue = [], stampsWho = null, stampsWait = false;
  function findsDone(who, res) {
    if (stampsWho !== who) { stampsDue = []; pagesDue = []; stampsWho = who; }
    (res.newIds || []).forEach(function (id) { if (id.indexOf('spy.') !== 0 && stampsDue.indexOf(id) < 0) stampsDue.push(id); });
    (res.completed || []).forEach(function (k) { if (pagesDue.indexOf(k) < 0) pagesDue.push(k); });
    syncTodaySign();
    if (on3D()) s3('setAnchors', anchors3D());
    if ((stampsDue.length || pagesDue.length) && !stampsWait) { stampsWait = true; whenQuiet(who, stampsNews); }
  }
  /* the island is quiet: no open queue running, no welcome, no sheet, card or toast, no game, no activity, no finger */
  function whenQuiet(who, fn) {
    var t0 = Date.now();
    (function wait(ms) {
      setTimeout(function () {
        if (renderedFor !== who || !root || state.activeUser !== who) { stampsWait = false; return; }
        var w = W(), busy = !!openRun || notesDue > 0 || !!introWait || !(w && w.introSeen) || !!document.getElementById('slwIntro') || busyHands() || !!activity ||
          !!document.querySelector('.slw-ov, .slw-cele, .slw-toast, [data-sl-modal]') || booting3d || !!running || mode !== 'play';
        if (!busy) { fn(); return; }
        if (Date.now() - t0 < OPEN_WAIT) wait(700); else stampsWait = false;
      }, ms);
    }(700));
  }
  /* '📖 New stamp: Tap your house' (several: '📖 New stamps in your book: 3') with Open my book; then each completed page
     once, one card after another */
  function stampsNews() {
    stampsWait = false;
    var D = DAYS(), w = W(), ids = stampsDue, pages = pagesDue;
    stampsDue = []; pagesDue = [];
    if (!D || !w) return;
    if (pages.length) { pageCards(pages, 0); return; }
    if (!ids.length) return;
    var s = ids.length === 1 ? D.stampInfo(C, w, ids[0]) : null;
    var msg = s ? tx('act.book.newOne', { item: tx(s.key, s.params || undefined) }) : tx('act.book.newMany', { n: ids.length });
    toast(msg, { label: tx('act.book.open'), fn: function () { openBook({ page: s ? s.isle : isleNow() }); } }, { ms: 3500 });
  }
  function pageCards(pages, i) {
    if (i >= pages.length) return;
    var k = pages[i], short = tx('isle.short.' + k, null, isleName(k));
    celebrate({ title: tx('act.book.complete', { island: short }), sub: k !== 'home' ? tx('act.book.flag') : '', encore: false,
      btns: [{ label: tx('act.book.open'), fn: function () { openBook({ page: k }); } }], onClose: function () { pageCards(pages, i + 1); } });
  }
  /* a land's page is complete (finds3.done): its explorer flag by the bridge */
  function pageDone(w, k) { var f = w && typeof C.findsOf === 'function' ? C.findsOf(w) : null; return !!(f && f.done && typeof f.done[k] === 'string'); }

  /* ---------------- 📖 My island book (IA-6), loaded on its first use ---------------- */
  var bookLoad = null;
  function loadBook() {
    var B = window.SLIslandBookUI;
    if (B && typeof B.open === 'function') return Promise.resolve(true);
    if (!bookLoad) bookLoad = loadScript('world/island-book-ui.js?v=' + (window.SL_WORLD_VER || '1')).then(function () { bookLoad = null; return !!(window.SLIslandBookUI && typeof window.SLIslandBookUI.open === 'function'); }, function () { bookLoad = null; return false; });
    return bookLoad;
  }
  function bookCtx() {
    return { overlay: overlay, tx: tx, iconHtml: iconHtml, fillPhotocards: fillPhotocards, C: C, D: DAYS(), people: PC(), user: me,
      commit: function (fn) { return commit(fn).then(function (res) { if (res && res.ok) careChanged(); return res; }); },
      day: careDay, now: nowMs, celebrate: celebrate, go: go, here: function () { return isleNow(); }, document: document,
      setTimeout: function (f, t) { return setTimeout(f, t); } };
  }
  function openBook(o) {
    if (!DAYS() || running) return Promise.resolve(null);
    var who = state.activeUser;
    flushFinds();                                      /* what was just done is in the book */
    return loadBook().then(function (ok) {
      if (!ok || !root || renderedFor !== who || running) return null;
      return window.SLIslandBookUI.open(bookCtx(), { page: o && typeof o.page === 'string' ? o.page : undefined });
    }).then(function (r) { syncTodaySign(); if (on3D()) s3('setAnchors', anchors3D()); return r; }, function () { return null; });
  }

  /* ---------------- the weather (A7): the sky's own in 3D, else a drifting overlay; Season looks ---------------- */
  var wxNow = null, WX_GLYPH = { snow: '❄', spring: '🌸', summer: '🦋', autumn: '🍂' };
  function looksOn() { try { return localStorage.getItem('slwSeasons') !== '0'; } catch (e) { return true; } }
  /* when the island opens (never mid-visit), the rules arrive, a 3D stage mounts or Season looks changes */
  function applyWeather() {
    var t = dayNow(), o = t && t.weather ? { weather: t.weather, season: t.season, looks: looksOn() } : null, drawn = false;
    if (on3D() && typeof stage3d.setWeather === 'function') drawn = s3('setWeather', o) === true;
    var k = o && o.looks && !drawn ? (o.weather.kind === 'snow' ? 'snow' : o.season !== 'winter' && WX_GLYPH[o.season] ? o.season : null) : null;
    if (k === wxNow) return;
    wxNow = k;
    if (on3D()) drawActs(); else if (root && renderedFor != null) drawStage();
  }
  /* ❓ Help: what 📋 Today is, and the Season looks switch (this device only; on by default, James's default §9.4) */
  function looksHtml() {
    if (!DAYS()) return '';
    return '<p class="slw-helptoday">' + esc(tx('act.help.today')) + '</p><div class="slw-looks"><button type="button" class="slw-switch" role="switch" id="slwLooks" aria-checked="' + looksOn() + '">' +
      '<span class="tk" aria-hidden="true"><i></i></span><span>' + esc(tx('act.wx.looks')) + '</span></button><p class="slw-lookshelp">' + esc(tx('act.wx.looksHelp')) + '</p></div>';
  }
  function wireLooks(ov) {
    var b = $('#slwLooks', ov);
    if (!b) return;
    b.addEventListener('click', function () {
      try { localStorage.setItem('slwSeasons', looksOn() ? '0' : '1'); } catch (e) {}
      b.setAttribute('aria-checked', String(looksOn()));
      applyWeather();
    });
  }
  /* 12 glyphs (6 butterflies) on fixed lanes, drifting down at ≤ 0.1 Hz; still under reduced motion */
  function wxHtml(cls) {
    if (!wxNow) return '';
    var n = wxNow === 'summer' ? 6 : 12, out = '';
    for (var i = 0; i < n; i++) out += '<span class="slw-wxf" style="left:' + ((i * 37 + 11) % 96) + '%;top:' + ((i * 29 + 7) % 88) + '%;animation-delay:-' + (i * 1.17).toFixed(2) + 's;"><i>' + WX_GLYPH[wxNow] + '</i></span>';
    return '<div class="slw-wx ' + wxNow + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + out + '</div>';
  }

  /* ---------------- the Games sheet's 'Play on your island' (free play: never the game time) ---------------- */
  function freeHtml() {
    var w = W();
    if (!DAYS() || !w) return '';
    var k = isleNow(), p = playPet(), rows = [['today', tx('act.free.today')]];
    if (C.isleUnlocked(w, k) && spyCan(k)) rows.push(['spy', tx('act.free.spy')]);
    if (showCan(k)) rows.push(['show', tx('act.show.here')]);
    if (p) { rows.push(['fetch', tx('act.free.fetch', { name: p.name }), p.id]); rows.push(['hide', tx('act.free.hide', { name: p.name }), p.id]); }
    rows.push(['book', tx('act.today.book')]);
    return '<section class="slw-freeplay" aria-labelledby="slwFreeH"><h3 id="slwFreeH">' + esc(tx('act.free.title')) + '</h3><p class="slw-freenote">' + esc(tx('act.free.note')) + '</p><div class="slw-freelist">' +
      rows.map(function (r) { return '<button type="button" class="slw-btn big" data-free="' + r[0] + '"' + (r[2] ? ' data-pet="' + esc(r[2]) + '"' : '') + '>' + esc(r[1]) + '</button>'; }).join('') + '</div></section>';
  }
  function addFree(ov) {
    var g = ov && ov.querySelector('.slw-games'), box = document.createElement('div');
    box.innerHTML = freeHtml();
    if (!g || !box.firstChild) return;
    g.parentNode.appendChild(box.firstChild);
    ov.querySelectorAll('[data-free]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-free'), pet = b.getAttribute('data-pet');
        ov._close();
        if (k === 'today') openToday(); else if (k === 'book') openBook({}); else if (k === 'spy') startSpy(); else if (k === 'show') startShow();
        else startPlay(k, pet);
      });
    });
  }

  /* ---------------- SLWorld.go's island places (IA-2's go targets; the Today rows) ---------------- */
  var ACT_GO = { today: 1, visitor: 1, book: 1, show: 1, spy: 1, isle: 1, fetch: 1, hide: 1 };
  /* the slim 🎯 goal bar under a Next step card that is not about the goal (IA-2's card.goalBar, §4.4) */
  function goalBarHtml(g) {
    if (!g || typeof g.price !== 'number' || !(g.price > 0)) return '';
    var p = g.params || {};
    return '<span class="gb slw-goalbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + g.price + '" aria-valuenow="' + Math.min(g.have, g.price) + '" aria-label="' +
      esc(tx(g.key || 'act.next.goalBar', { item: p.item, n: fmt(p.n), price: fmt(p.price) })) + '" style="display:block;"><i style="width:' + g.pct + '%"></i></span>';
  }
  function goAct(to, o) {
    if (to === 'today') return untilClosed(openToday());
    if (to === 'book') return openBook({ page: o.page });
    if (to === 'visitor') return landFirst('home').then(function (ok) { return ok && sayHello(); });
    if (to === 'show') return landFirst(o.isle).then(function (ok) { return ok && startShow(isleNow()); });
    if (to === 'spy') return landFirst(o.isle).then(function (ok) { return ok && startSpy(isleNow()); });
    if (to === 'fetch' || to === 'hide') return Promise.resolve(startPlay(to, typeof o.petId === 'string' ? o.petId : undefined));
    /* isle: there; with a thing (a pet's wish for a ride or a rest), it is framed and has its go, as a tap would */
    if (typeof o.uid === 'string' && o.uid) return rideNow(o.uid, o.isle);
    return landFirst(o.isle);
  }

  /* ---------------- the island-open queue: the one-time hint and the visitor's hello ---------------- */
  /* 45: '📋 New on your island: tap Today over your house…' once (tutSeen.today), never on the welcome open; it is this
     open's one unasked card */
  enqueueOpen({ id: 'act.today.hint', prio: 45,
    when: function (w) { return !!DAYS() && !!w && !!w.introSeen && !(w.tutSeen && w.tutSeen.today) && isleNow() === 'home' && !skyMapOn; },
    show: function () {
      commit(function (u) { var fw = C.ensureWorld(u); if (fw.tutSeen.today) return { ok: false }; fw.tutSeen.today = true; return { ok: true }; });
      toast(tx('act.today.hint'), { label: tx('shop.seeIt'), fn: function () { openToday(); } });
      return Promise.resolve();
    } });
  /* 60, quiet: the visitor waves and says hello (a 4 s bubble); never a card, never counted, not on the welcome open */
  enqueueOpen({ id: 'act.hello', prio: 60, quiet: true,
    when: function (w) { return !!visitorNow(w); },
    show: function () {
      var v = visitorNow(W());
      if (!v) return Promise.resolve();
      if (!s3('emote', 'visitor', 'wave')) hop2d('.slw-visitor2d');
      sayOn('visitor', tx('act.vis.hi', { name: v.name }), 4);
      return new Promise(function (res) { setTimeout(res, 4000); });
    } });

  /* ---------------- the learn-and-come-back trip (§4.1, §4.2; IA-7's seam) ---------------- */
  /* this device keeps the trip (index.html's window.slTripSave; window.slLearnTrip itself where it is not there) */
  function tripSave(t) {
    try { if (typeof window.slTripSave === 'function') { window.slTripSave(t); return; } } catch (e) {}
    window.slLearnTrip = t;
  }
  /* 📚 Learn and come back makes the thing 🎯 My goal when no goal is set (one commit, 'My goal is now …'): never over a
     different goal (that asks 'Change your goal?' as ever), never for a thing the child cannot save for now (a pet the
     cap shuts out, a locked one), never in test mode */
  function tripGoal(id) {
    var u = me(), w = W(), it = C.item(id), s = u && it ? iState(u, id) : null;
    if (!u || !w || !it || trial() || C.goalId(w) || !s || s.state !== 'short') return;
    var who = state.activeUser;
    commit(function (fu) {
      var fw = C.ensureWorld(fu);
      if (C.goalId(fw)) return { ok: false };
      var r = C.setGoal(fu, id);
      if (r && r.ok) goalMeta(fw);
      return r;
    }).then(function (res) { if (res && res.ok && state.activeUser === who) toast(tx('act.goal.set', { item: it.name })); });
  }

  window.SLWorld = {
    render: render,
    onUserChanged: onUserChanged,
    onPointsChanged: onPointsChanged,
    onHide: onHide,
    renderedFor: function () { return renderedFor; },
    launch: launch,
    joinChallenge: joinChallenge,
    openShop: openShop,
    openItem: openItem,
    go: go,                                       /* wave 3 (contract 3): the top bar, the goal toast, the Next step card */
    _qa: function () {
      try { if (localStorage.getItem('slQaMode') !== '1') return null; } catch (e) { return null; }
      return { C: C, commit: commit, commitPurchase: commitPurchase, arcadeState: arcadeState, arcadeTick: arcadeTick, stage: function () { return stage3d; }, state: function () { return { mode: mode, placing: placing, selectedUid: selectedUid, running: running, isle: isleNow(), skyMap: skyMapOn, use3D: use3D, booting3d: booting3d, late3d: late3d, stageShownAt: stageShownAt, drawn: islandDrawn() }; }, setServerOffset: function (ms) { timeAnchor = { at: Date.now() + ms, perf: perfNow(), server: true }; }, setArcadeCfg: function (cfg) { qaArcade = cfg || null; },
        /* scripted QA of the sky islands (QA mode only): which island, fly there, the Sky map */
        isle: isleNow, visit: function (k, o) { return goIsle(k, o); }, skyMap: skyMap,
        /* the island-open queue (KU13): add an entry; what is queued and the run in progress */
        enqueueOpen: enqueueOpen, openQueue: function () { return { ids: OPENQ.map(function (e) { return e.id; }), run: openRun ? { shown: openRun.shown, done: Object.keys(openRun.done) } : null }; },
        /* pet care (P4.1): the island day, the ctx the Pet Corner and the Pet Shop get, and the feeding moment */
        careDay: careDay, careCtx: careCtx, stageFeed: stageFeed,
        /* wave 3: the Next step card on show, and the trip; d-island: the env it was worked out with, and a fixed turn
           (a number; anything else goes back to the island day + this session's opens), the card redrawn */
        next: function () { return nextCard; }, trip: function () { return window.slLearnTrip || null; },
        nextEnv: function () { return nextEnv; }, setTurn: function (n) { qaTurn = typeof n === 'number' && isFinite(n) ? n : null; syncNext(); return nextCard; },
        /* island activities (IA-5): today's island day, the activity on, the notes waiting, and their entry points */
        today: function () { return dayNow(); }, activity: function () { return activity ? { kind: activity.kind, phase: activity.phase || null, isle: activity.isle, petId: activity.petId || null, n: activity.n, round: activity.round, at: activity.at || null, clue: activity.clue ? activity.clue.id : null, i: activity.i } : null; },
        notes: function () { return findQ.slice(); }, flushFinds: flushFinds, openToday: openToday, openVisitor: openVisitor, openBook: openBook,
        startShow: startShow, startSpy: startSpy, startPlay: startPlay, endActivity: endActivity, stagePlay: stagePlay, weather: function () { return wxNow; } };
    }
  };
})();
