/* ================================================================
   My Island — shared mini-game shell.
   Fixed-timestep loop (120 Hz) so movement is identical at any frame
   rate; pauses on focus loss (and never "catches up" on return);
   letterboxed logical canvas that survives resizes/rotation; menus,
   first-play tutorial, pause/resume/restart/exit, results, personal
   bests, parent time limits, sound toggle, reduced motion, cleanup.
   Games never touch points.
   ================================================================ */
(function () {
  'use strict';
  var STEP = 1 / 120, MAX_FRAME = 0.1;
  /* a live round (a shared race) runs on real time: a frame plays up to LIVE_FRAME and
     the rest is lost time, told to round.late. performance.now() can stand still while
     a device sleeps, so once it and Date.now() disagree by more than CLOCK_SLIP the
     larger gap is taken as the real one */
  var LIVE_FRAME = 0.25, CLOCK_SLIP = 0.5;
  /* 3D draw rates: play at ~60 fps even on 90/120/144 Hz screens (the logic still
     steps every frame), menus/results at ~30 fps — the contract's numbers */
  var PLAY_FPS = 60, IDLE_FPS = 30;
  /* count-in rings are a beat pulse: never more often than the art bible's 1.97 Hz
     (118 BPM). A faster count-in (Debut Run, 128 BPM) rings every other beat. */
  var BEAT_PULSE_HZ = 1.97, RING_GAP_MS = 1000 / BEAT_PULSE_HZ;
  /* a game's def.preload gets PRELOAD_MS to settle, then 'Couldn’t start' (Try again · Back);
     results buttons wake GUARD_MS after the sheet is drawn (a tapping finger can't hit them) */
  var PRELOAD_MS = 10000, GUARD_MS = 650;
  window.SLGames = window.SLGames || {};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function injectCss() {
    if (document.getElementById('slgCss')) return;
    var c = document.createElement('style'); c.id = 'slgCss';
    c.textContent = [
      '.slg{position:fixed;inset:0;z-index:9700;background:#130c2e;display:flex;flex-direction:column;color:#fff;font-family:"Baloo 2",system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:none;}',
      '.slg-top{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,.25);flex:0 0 auto;}',
      '.slg-top .ttl{font-weight:800;font-size:18px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      /* the title gives way first (its flex basis is 0), then the HUD pill (ellipsis), so
         🔊 ⏸ 🏝️ Exit can never be pushed past the right edge. QA round 2: before the pill is
         cut, a game is asked for its compact pill (hudOpt.narrow, pillFits below) */
      '.slg-top .hud{font-weight:800;font-size:16px;background:rgba(255,255,255,.12);border-radius:999px;padding:4px 12px;white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}',
      '.slg-top .slg-b{flex:0 0 auto;white-space:nowrap;}',
      '.slg-b{border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;border-radius:12px;min-width:44px;min-height:44px;padding:4px 10px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;touch-action:manipulation;}',
      '.slg-b:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;}',
      '.slg-b.go{background:#ffd23f;color:#4a3200;border-color:#ffd23f;font-size:20px;padding:10px 26px;}',
      '.slg-b.alt{background:#fff;color:#2c2550;border-color:#fff;}',
      '.slg-mid{position:relative;flex:1;min-height:0;}',
      '.slg-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;}',
      '.slg-touch{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:10px;pointer-events:none;gap:10px;}',
      '.slg-touch .grp{display:flex;gap:10px;pointer-events:auto;}',
      '.slg-pad{width:clamp(64px,13vmin,104px);height:clamp(64px,13vmin,104px);border-radius:50%;border:3px solid rgba(255,255,255,.55);background:rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:800;font-size:clamp(14px,3vmin,22px);touch-action:none;cursor:pointer;}',
      '.slg-pad.wide{width:clamp(110px,22vmin,170px);border-radius:999px;}',
      '.slg-pad.on{background:rgba(255,210,63,.6);border-color:#ffd23f;}',
      /* a sheet's content sits in .slg-in: its auto margins centre it when it fits, and
         when it is taller than the sheet it starts at the top and scrolls down (flex
         centring would spill the title above the scroll origin, out of reach) */
      '.slg-scr{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;flex-direction:column;gap:12px;background:rgba(19,12,46,.94);text-align:center;padding:18px;z-index:5;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}',
      '.slg-in{display:flex;flex-direction:column;align-items:center;gap:inherit;width:100%;margin:auto 0;flex:0 0 auto;}',
      '.slg-emo{font-size:54px;}',
      '.slg-pbslot{min-height:40px;}',
      '.slg-boardslot{min-height:22px;font:800 15px system-ui,sans-serif;color:#ffe27a;}',
      '.slg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}',
      '.slg-scr h2{margin:0;font-size:clamp(26px,5vw,40px);line-height:1.1;}',
      '.slg-scr p{margin:0;max-width:560px;font-size:17px;color:#e3dcff;font-family:system-ui,sans-serif;font-weight:600;}',
      '.slg-scr .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}',
      '.slg-tut{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}',
      '.slg-tut div{background:rgba(255,255,255,.1);border-radius:16px;padding:12px;width:170px;font-family:system-ui,sans-serif;font-weight:700;font-size:15px;color:#fff;}',
      '.slg-tut b{display:block;font-size:34px;margin-bottom:4px;}',
      '.slg-var{border:3px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;border-radius:14px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer;min-height:44px;}',
      '.slg-var.on{border-color:#ffd23f;background:rgba(255,210,63,.2);}',
      '.slg-big{font-size:clamp(40px,9vw,80px);font-weight:800;line-height:1;}',
      '.slg-pb{background:linear-gradient(135deg,#ffd23f,#ff9f43);color:#4a3200;border-radius:999px;padding:6px 16px;font-weight:800;font-size:20px;animation:slgPop .6s cubic-bezier(.2,1.6,.4,1);}',
      '@keyframes slgPop{from{transform:scale(.3);}to{transform:scale(1);}}',
      '.slg-banner{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffd23f;color:#4a3200;font-weight:800;border-radius:999px;padding:6px 16px;z-index:4;box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:15px;max-width:92%;text-align:center;}',
      '.slg-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(70px,18vw,160px);font-weight:800;color:#ffd23f;text-shadow:0 8px 40px rgba(0,0,0,.5);z-index:3;pointer-events:none;}',
      /* the portrait "turn sideways" hint lives IN the menu / tutorial / pause sheets
         (where the child can rotate), never over a game's HUD during play */
      '.slg-rot{display:none;max-width:100%;background:rgba(255,255,255,.12);border:2px dashed rgba(255,255,255,.35);border-radius:999px;padding:6px 14px;font-weight:800;font-size:15px;line-height:1.3;pointer-events:none;}',
      '@media (orientation: portrait) and (max-width: 760px){.slg-rot{display:block;}}',
      '.slg-gl{position:absolute;inset:0;width:100%;height:100%;display:block;transition:opacity .3s;}',
      '.slg-pad[data-st=s1]{border-color:#3DF2FF;box-shadow:0 0 12px #3DF2FF;}.slg-pad[data-st=s2]{border-color:#FF4FB8;box-shadow:0 0 14px #FF4FB8;}',
      '.slg-pad[data-st=s3]{border-color:#FFD23F;box-shadow:0 0 16px #FFD23F;}.slg-pad[data-st=grey]{border-color:#CFC8DC;opacity:.75;}.slg-pad[data-st=ready]{border-color:#FFD23F;}',
      '.slg-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}.slg-badge{border-radius:999px;padding:4px 12px;font-weight:800;font-size:15px;background:rgba(255,255,255,.14);}',
      '.slg-badge.bronze{background:linear-gradient(135deg,#e8a15b,#b86b2c);}.slg-badge.silver{background:linear-gradient(135deg,#e9edf5,#9aa6bd);color:#2b2140;}.slg-badge.gold{background:linear-gradient(135deg,#ffe89a,#f0c02f);color:#4a3200;}.slg-badge.crown{background:linear-gradient(135deg,#ffb3e6,#b3e5ff,#c9ffe5,#fff3b3);color:#2b2140;}',
      /* the results glass keeps the bottom 58% when its content fits and grows (up to the
         whole stage, then scrolls) when it doesn't */
      '.slg-scr.glass{top:auto;height:auto;min-height:58%;max-height:100%;background:rgba(26,18,64,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-radius:22px 22px 0 0;}',
      '.slg-opt{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;}.slg-opt .lb{font-weight:800;font-size:14px;opacity:.85;}.slg-lock{font-size:13px;opacity:.7;margin:0;}',
      '@media (prefers-reduced-motion: reduce){.slg-pb{animation:none;}}',
      /* short screens (phones held sideways): compact sheets so results / tutorial fit.
         The html-body selectors out-rank island-encore.css only inside this query. */
      '@media (max-height: 520px){',
      '.slg-scr{padding:10px 14px;}.slg-scr p{font-size:15px;}.slg-emo{font-size:34px;line-height:1;}.slg-pbslot{min-height:34px;}',
      '.slg-tut{gap:8px;}.slg-tut div{width:150px;padding:8px 10px;font-size:14px;}.slg-tut b{font-size:24px;}',
      'html body .slg .slg-scr{gap:6px;}',
      'html body .slg .slg-scr h2{font-size:clamp(22px,min(6vw,8.5vh),50px);}',
      'html body .slg .slg-big{font-size:clamp(32px,min(10vw,13vh),88px);}',
      'html body .slg .slg-tut b{height:40px;min-width:40px;font-size:22px;margin-bottom:4px;}',
      'html body .slg .slg-scr .slg-b.go{padding:6px 22px;font-size:18px;}',
      'html body .slg .slg-pb{font-size:16px;padding:4px 14px;}',
      '}'
    ].join('\n');
    document.head.appendChild(c);
    injectCssR2();
  }
  /* QA round 2: its own small sheet, so #slgCss stays the V4.54 one (tests/shell-social.test.js) */
  function injectCssR2() {
    if (document.getElementById('slgCssR2')) return;
    var c = document.createElement('style'); c.id = 'slgCssR2';
    c.textContent = [
      /* QA2C-12: the title gives way first (ellipsis). Whenever the full HUD pill (the kart clock,
         the kick) would not fit — ≤ 420 px, and an upright iPhone Plus / Pro Max (428–440 px) or
         any width where it is too long — a game's pill is its compact form (hud({narrow}), see
         pillFits), and at ≤ 420 px the buttons are tighter. Only if even that is too long does
         the pill shrink (ellipsis): 🔊 ⏸ 🏝️ Exit are never pushed past the right edge */
      'html body .slg .slg-top .hud{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}',
      /* QA2C-14: ⏸ only while there is something to pause */
      '.slg.slg-nopause #slgPause{display:none;}',
      /* QA2C-17: a sheet's spotlight layer (the island skin's .slg-scr::before) is one screen
         tall and scrolls with a long list, so it ended in a hard line: it fades out instead */
      'html body .slg .slg-mid .slg-scr::before{-webkit-mask-image:linear-gradient(#000 35%,transparent 92%);mask-image:linear-gradient(#000 35%,transparent 92%);}',
      /* narrow phones: a tighter top bar (QA2C-12) and compact course / rival chips, two to a row
         (QA2C-11: ▶ Play stays well clear of the bottom) */
      '@media (max-width: 420px){',
      'html body .slg .slg-top{gap:6px;padding-left:max(8px, env(safe-area-inset-left));padding-right:max(8px, env(safe-area-inset-right));}',
      'html body .slg .slg-top .slg-b{padding:6px 9px;}',
      'html body .slg .slg-top .hud{padding:4px 10px;}',
      'html body .slg .slg-scr .row > .slg-var[data-mvar],html body .slg .slg-scr .row > .slg-var[data-var]{flex:1 1 calc(50% - 6px);max-width:calc(50% - 6px);padding:4px 8px;font-size:14px;line-height:1.15;}',
      '}'
    ].join('\n');
    document.head.appendChild(c);
  }
  /* API 3 sheets only (the focus-order results): their own small sheet, so a game that uses
     none of the new hooks gets exactly the V4.54 styles. The selectors out-rank the island
     skin's 'html body .slg .slg-scr p' */
  function injectCss3() {
    if (document.getElementById('slgCss3')) return;
    var c = document.createElement('style'); c.id = 'slgCss3';
    c.textContent = [
      'html body .slg .slg-scr p.slg-next{font-weight:800;color:#ffe27a;}',
      'html body .slg .slg-b.slg-more{font-size:15px;background:transparent;border-color:rgba(255,255,255,.3);}',
      '.slg-details{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;}',
      '.slg-details[hidden]{display:none;}',
      'html body .slg .slg-scr .slg-details p{font-size:15px;white-space:pre-line;}'
    ].join('\n');
    document.head.appendChild(c);
  }
  /* the Exit check (James, 25 Oct 2026: "Add a check"): its own small sheet, added only when it is
     first asked, so every other sheet keeps its V4.54 / API 3 styles. A card over the whole game
     (the top bar too); it only fades in, and not at all under reduced motion */
  var ASK = {
    race: { title: 'Leave the race?', text: 'Your time won’t count.' },
    game: { title: 'Leave the game?', text: 'This round won’t count.' },
    stay: 'Keep playing', leave: 'Leave'
  };
  function injectCssAsk() {
    if (document.getElementById('slgCssAsk')) return;
    var c = document.createElement('style'); c.id = 'slgCssAsk';
    c.textContent = [
      '.slg:focus{outline:none;}',
      '.slg-ask{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(11,10,31,.62);touch-action:manipulation;}',
      '.slg-ask-card{width:min(420px,100%);max-height:100%;overflow:auto;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:20px 18px 18px;border-radius:20px;',
      '  background:#1d1542;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 48px rgba(0,0,0,.5);animation:slgAskIn .18s ease-out;}',
      '.slg-ask-card h2{margin:0;font-family:var(--sle-display,inherit);font-weight:800;font-size:clamp(22px,4.6vw,30px);line-height:1.15;color:#fff;}',
      '.slg-ask-card p{margin:0;font-family:var(--sle-body,system-ui,sans-serif);font-weight:600;font-size:17px;color:#e6e1f7;}',
      '.slg-ask-card .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px;}',
      '@keyframes slgAskIn{from{opacity:0;}to{opacity:1;}}',
      '.slg-ask.rm .slg-ask-card{animation:none;}',
      '@media (prefers-reduced-motion: reduce){.slg-ask-card{animation:none;}}',
      '@media (max-height: 520px){.slg-ask-card{padding:12px 14px;gap:6px;}}'
    ].join('\n');
    document.head.appendChild(c);
  }

  /* ---------- sound helpers (respect the app's mute) ---------- */
  /* Sound names games can use (api.sound(name, vol, step)):
       samples  right · wrong · fanfare · sting · chip · coins · unlock · applause · heartbeat
       app sfx  correct · wrong · unlock · fanfare · tick
       synth    jump · coin · bump · kick · beep · go · check · pop · boing · crash · oof ·
                powerup · combo (step = 0,1,2… climbs the scale) · whoosh · boost · miss ·
                star · shield · whistle · save · skid · cheer · tada
     Everything respects the app's mute. */
  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  var SAMPLE_FILES = { right: 1, wrong: 1, fanfare: 1, sting: 1, chip: 1, coins: 1, unlock: 1, applause: 1, heartbeat: 1 };
  var DUCK = { fanfare: 1, tada: 1, applause: 1, sting: 1, cheer: 1, unlock: 1 };
  function makeSound(cfg) {
    return function (name, vol, step) {
      try {
        if (cfg.muted && cfg.muted()) return;
        if (name === 'correct' || name === 'wrong' || name === 'unlock' || name === 'fanfare' || name === 'tick') { if (typeof playSfx === 'function') playSfx(name); return; }
        if (name === 'cheer') name = 'applause';
        if (DUCK[name] && window.SLMusic && typeof SLMusic.duck === 'function') { try { SLMusic.duck(0.4, 350); } catch (e) {} }
        /* only real sample files go to slSample — anything else would 404 on audio/sfx/<name>.mp3 */
        if (SAMPLE_FILES[name] && typeof slSample === 'function' && slSample(name, vol == null ? 0.8 : vol)) return;
        if (typeof getAudioCtx === 'function' && typeof _beep === 'function') {
          var ctx = getAudioCtx(); if (!ctx) return;
          var t = ctx.currentTime, v = vol == null ? 1 : Math.max(0.1, Math.min(1.5, vol));
          var has = function (f) { return typeof window[f] === 'function'; };
          if (name === 'pop') { if (has('_pluck')) { _pluck(ctx, 1320, t, { vol: 0.13 * v, dur: 0.22 }); _pluck(ctx, 1760, t + 0.045, { vol: 0.1 * v, dur: 0.2 }); } else _beep(ctx, 1320, t, 70, { vol: 0.12 * v }); return; }
          if (name === 'boing') { if (has('_slide')) _slide(ctx, 280, 760, t, 170, { wave: 'triangle', vol: 0.11 * v }); return; }
          if (name === 'crash') { if (has('_thump')) _thump(ctx, t, { f: 85, vol: 0.34 * v }); if (has('_tap')) { _tap(ctx, t, { vol: 0.2 * v, f: 520 }); _tap(ctx, t + 0.05, { vol: 0.14 * v, f: 340 }); } return; }
          if (name === 'oof') { if (has('_slide')) _slide(ctx, 440, 150, t, 280, { wave: 'triangle', vol: 0.16 * v }); if (has('_thump')) _thump(ctx, t, { f: 110, vol: 0.2 * v }); return; }
          if (name === 'powerup' || name === 'tada') { var notes = name === 'tada' ? [784, 988, 1175, 1568] : [659, 880, 1047, 1319]; notes.forEach(function (f, i) { if (has('_bell')) _bell(ctx, f, t + i * 0.07, { vol: 0.09 * v, dur: 0.6 }); }); return; }
          if (name === 'combo') { var k = Math.max(0, Math.min(SCALE.length - 1, step | 0)); if (has('_pluck')) { _pluck(ctx, SCALE[k], t, { vol: 0.15 * v, dur: 0.3 }); _pluck(ctx, SCALE[k] * 1.5, t + 0.05, { vol: 0.08 * v, dur: 0.25 }); } return; }
          if (name === 'whoosh') { if (has('_swell')) _swell(ctx, t, 0.32, { vol: 0.11 * v }); return; }
          if (name === 'boost') { if (has('_swell')) _swell(ctx, t, 0.45, { vol: 0.12 * v }); if (has('_slide')) _slide(ctx, 180, 900, t, 420, { wave: 'sawtooth', vol: 0.05 * v }); return; }
          if (name === 'miss') { if (has('_pluck')) { _pluck(ctx, 220, t, { vol: 0.17 * v, dur: 0.4 }); _pluck(ctx, 175, t + 0.13, { vol: 0.15 * v, dur: 0.45 }); } return; }
          if (name === 'star') { if (has('_bell')) { _bell(ctx, 1568, t, { vol: 0.08 * v, dur: 0.5 }); _bell(ctx, 2093, t + 0.06, { vol: 0.07 * v, dur: 0.5 }); } return; }
          if (name === 'shield') { if (has('_bell')) _bell(ctx, 660, t, { vol: 0.1 * v, dur: 0.7 }); if (has('_slide')) _slide(ctx, 500, 1000, t, 220, { wave: 'sine', vol: 0.06 * v }); return; }
          if (name === 'whistle') { if (has('_slide')) { _slide(ctx, 2100, 2350, t, 140, { wave: 'sine', vol: 0.08 * v }); _slide(ctx, 2100, 2350, t + 0.2, 380, { wave: 'sine', vol: 0.08 * v }); } return; }
          if (name === 'save') { if (has('_thump')) _thump(ctx, t, { f: 70, vol: 0.3 * v }); if (has('_slide')) _slide(ctx, 330, 140, t, 240, { wave: 'triangle', vol: 0.12 * v }); return; }
          if (name === 'skid') { if (has('_tap')) { for (var s2 = 0; s2 < 4; s2++) _tap(ctx, t + s2 * 0.04, { vol: 0.06 * v, f: 2400 - s2 * 300 }); } return; }
          if (name === 'jump') _beep(ctx, 520, t, 90, { wave: 'triangle', vol: 0.12 });
          else if (name === 'coin') { _beep(ctx, 990, t, 60, { wave: 'sine', vol: 0.12 }); _beep(ctx, 1320, t + 0.05, 80, { wave: 'sine', vol: 0.1 }); }
          else if (name === 'bump') _beep(ctx, 180, t, 140, { wave: 'triangle', vol: 0.18 });
          else if (name === 'kick') _beep(ctx, 140, t, 90, { wave: 'sine', vol: 0.3 });
          else if (name === 'beep') _beep(ctx, 660, t, 120, { wave: 'sine', vol: 0.15 });
          else if (name === 'go') _beep(ctx, 990, t, 260, { wave: 'sine', vol: 0.18 });
          else if (name === 'check') _beep(ctx, 880, t, 90, { wave: 'triangle', vol: 0.12 });
        }
      } catch (e) {}
    };
  }

  /* ================================================================
     OPTIONAL HOOKS (see docs/island3d/CONTRACTS.md) — every one defaults to
     today's behaviour, so a game only opts in to what it uses:
       def.view3d {src}            ES module exporting create(mid, opts) -> view
                                   view: {canvas, frame(round, dt, alpha, phase, countT),
                                          resize(w, h), dispose(), setRound?(round, variant)}
       def.hud {mount(mid, cfg, api) -> {update(round, phase), dispose()}}
       def.countIn {beats, bpm, labels[]}   beat count-in instead of 'countdown' seconds
       def.controlsFor(cfg)        touch pads per config
       def.menuVariants(cfg)       [{id, name, icon, tip, locked, lockText, medal, best}]
       def.menuVariantsLabel       e.g. 'rival' ('Change rival')
       def.menuOptions(cfg)        [{id, label, value, options:[{value, label, locked, note}], below}]
                                   below: true draws the row under the Play row (QA 25 Oct #5:
                                   extra choices a child opens never push ▶ Play down)
       def.setOption(cfg, id, value)
       def.pbText(rec, variant, cfg)
       def.music {track}           with window.SLMusic present
       def.resultsGlass            results sheet as glass over the 3D scene
       round.wantEvents/events[]   logic pushes view events only while wantEvents; the shell
                                   empties events after every draw
       round.countdown(countT, held, isStart), round.pauseReset(), round.padState(id),
       round.summaryBadges() -> [{text, kind}], round.onFinish()
     API 2 (V4.55 game boards and shared rounds; SLGameShell.API tells a game they exist):
       def.menuButtons(cfg)        [{id, label, note, disabled}] extra buttons in the Play
                                   row ([data-mbtn=id]); note is one line under the row
       def.onMenuButton(id, ctl, cfg)
       ctl                         {screen(html, noFocus) -> the sheet, sheet() -> the content
                                   element of an empty sheet (fill it with DOM nodes), menu(),
                                   exit(), phase(), banner(text), say(text), esc(s),
                                   sound(name, vol, step), preview(variant), beginRound(opts)}
       beginRound({variant, goAt}) -> false (and the time-up sheet) when the gate refuses.
                                   variant: the course for this round only (newRound, the
                                   personal best and cfg.onResult get it; cfg.onSelectVariant
                                   and the menu choice are left alone). goAt: performance.now()
                                   of GO — the count shows 🏁 until the usual count is left, and
                                   up to 0.25 s past GO is played, not lost
       round.live                  a round on real time: blur / hidden / Esc / P do not pause,
                                   ⏸ calls round.onPause(ctl) while it runs on, a frame plays
                                   at most 0.25 s and round.late(sec) gets the rest (a stall, a
                                   sleep, a late start); no 'Change course' on its results
       round.resultsExtra(el, ctl) fills <div id="slgExtra"> under the badges
       round.again(ctl), round.againLabel, round.againState() -> {disabled, note}
                                   the results' main button, in place of Play again
       round.detach()              exit() calls it before round.dispose()
       window.SLBoards             optional leaderboards (world/games/boards.js, one script
                                   tag added by start()): available(cfg) puts 🏆 Leaderboards
                                   (#slgBoards) in the Play row, menuHint(game, variant, cfg)
                                   one line under the personal best, onResult({game, variant,
                                   result, outcome, cfg, menuName}) one line in #slgBoardSlot on
                                   the results sheet (menuName: the course as the menu calls it,
                                   '' for none, undefined: the board's name); prefetch(cfg),
                                   open({host, …})
     API 3 (V4.55 fixes; each optional — a game using none of them draws the API 2 sheets):
       round.nextStep()            ONE next step, a line under the personal best ('Only 130
                                   more for Gold!'). With it the results read: title, big line,
                                   the medal badges → the personal best (+ board line) → this
                                   line (#slgNextStep) → the buttons; summaryText(), the 'hint'
                                   badges and round.summaryDetails() (more lines) go behind
                                   📊 Details (#slgDetailsBtn / #slgDetails), with the stars line
       round.nextVariant()         {id, label, again}, null (offer nothing) or undefined (no
                                   opinion): the course / rival to try next. Asked once
                                   cfg.onResult answered (cfg.pb holds the new best by then; at
                                   once with no cfg.onResult). Its button (#slgNext) is the main
                                   one and Play again becomes `again`. Without an answer (no hook,
                                   or undefined) the shell offers the first course / rival this round unlocked
                                   in def.menuVariants ('🎧 Try Bop' · '↻ Replay Mochi'), and
                                   'Change course' is re-checked then too (a first unlock). Never
                                   on a live round, a round with its own again, or out of time
       round.hud3d()               the top-bar pill while a 3D view (which has its own HUD) is
                                   drawn; '' empties it (the island skin hides an empty pill)
     QA round 2 (all optional; a game that ignores them is unchanged):
       round.hud(o) / hud3d(o)     o.narrow: the stage is 420 px wide or less, or the full pill
                                   did not fit beside 🔊 ⏸ 🏝️ Exit at this width (measured once per
                                   new shape of the text, then kept until the width changes) — a
                                   game gives its compact form ('1/2 · ⏱ 0:12.3'); the pill is cut
                                   (ellipsis) only if even that is too long
       def.pbText(rec, v, cfg, o)  o = {results: true, result} on the results sheet: leave out
                                   what the sheet already says (the next medal's gap, the medal
                                   of this very round)
       menuVariants' lockBelow     that lock line goes under the Play row, with the extras
       api.hudPill                 true while the top bar's text pill shows round.hud() (a 2D
                                   canvas then draws no second copy of those numbers)
       ⏸                           shown only for a count, a round or the pause sheet; out of game
                                   time the results show no next step and Change … is off
       the shell itself            a modal dialog: aria-modal, the page behind it inert, Tab
                                   kept inside, focus handed back on exit; def.preload has
                                   PRELOAD_MS (10 s), then 'Couldn’t start' · Try again · Back
     The Exit check (James, 25 Oct 2026; no hook, every game gets it):
       🏝️ Exit (the top bar's, and the pause sheet's) during a count, a round or the pause sheet
                                   asks first (#slgAsk, an alertdialog): 'Leave the race? Your
                                   time won’t count.' for the kart (def.key 'kart'), 'Leave the
                                   game? This round won’t count.' for the rest (SLGameShell.ASK).
                                   Keep playing (focused; Esc too) goes back, with the shell's
                                   usual count-in; Leave is exit(). A round on the shell's clock
                                   is paused while it asks (no Paused sheet shows under it); a live
                                   round runs on with its keys and pads let go. Tab stays in the
                                   card and the focus goes back after. On the menu, the tutorial,
                                   the results and every other sheet, Exit leaves at once
       round.ended(), round.endNow()  (optional, both or neither) ended(): the result is final and
                                   only the round's closing show plays on (the Debut Run's finish
                                   dance or out-of-hearts curtain, the kart's coast past the line,
                                   the Shootout's last kick landing); endNow() skips the rest of
                                   it (round.done, the result unchanged). Then 🏝️ Exit asks
                                   nothing: the results come up at once, the result saved as at
                                   the end of the show (🏝️ Back to my island is one tap more);
                                   Resume after a pause there has no count-in; a live round that
                                   ends under the card shows its results at once
     The shell also owns, for every 3D view: the stage's 2D verdict (no 3D view —
     so no WebGL context — once SLIsland3D.failed() or .remembered() says 2D), a
     ~60 fps draw cap (logic still steps every frame), ~30 fps menus/results, and a
     frame-rate watchdog (sustained < 20 fps in play → the same round goes 2D).
     ================================================================ */

  /* ---------- pure helpers (exported on SLGameShell for tests) ---------- */
  /* Paces draws to `fps` on any display rate; a hitch never makes it burst to
     catch up. tick(now ms) → true when a draw is due. */
  function makePacer(fps, tolMs) {
    var iv = 1000 / fps, tol = tolMs == null ? 4 : tolMs, next = null;
    return {
      tick: function (now) {
        if (next == null) { next = now + iv; return true; }
        if (now < next - tol) return false;
        next += iv;
        if (next < now - tol) next = now + iv;
        return true;
      },
      reset: function () { next = null; }
    };
  }
  /* Frame-rate watchdog for a 3D view the shell drives. Draw intervals and draw work
     (ms) are smoothed; once they average slower than `fps` (20) for `holdMs` of
     continuous play, sample() returns true (once). A gap over 1 s (pause, hidden
     page) restarts it, and so does reset() — the shell calls it on every stage
     quality step, so a view on the stage lease is judged by the stage first (its
     steps, then its own 2D verdict) and this only catches what nothing else does. */
  function makeFrameWatch(o) {
    o = o || {};
    var limit = 1000 / (o.fps || 20), hold = o.holdMs != null ? o.holdMs : 6000, minFrames = o.minFrames || 12;
    var ai = 0, aw = 0, n = 0, since = -1, fired = false;
    function reset() { ai = 0; aw = 0; n = 0; since = -1; }
    return {
      sample: function (intervalMs, workMs, now) {
        if (fired) return false;
        if (!(intervalMs > 0) || intervalMs > 1000) { reset(); return false; }
        var w = workMs > 0 ? workMs : 0;
        ai = n ? ai * 0.9 + intervalMs * 0.1 : intervalMs;
        aw = n ? aw * 0.9 + w * 0.1 : w;
        n++;
        if (n < minFrames) return false;
        if (ai <= limit && aw <= limit) { since = -1; return false; }
        if (since < 0) since = now;
        if (now - since >= hold) { fired = true; return true; }
        return false;
      },
      reset: reset,
      stats: function () { return { fps: ai > 0 ? Math.round(10000 / ai) / 10 : 0, workMs: Math.round(aw * 100) / 100, frames: n, slow: since >= 0, fired: fired }; }
    };
  }
  /* The stage's 2D verdict (world/island3d/stage.js): a 3D failure this session
     (performance, context loss, load) or a remembered "2D on this device" record.
     A game must not open a second WebGL context against it. → reason | null */
  function verdict2d(w) {
    w = w || {};
    var IS = w.SLIsland3D;
    if (!IS) return storedVerdict(w);
    try { var f = typeof IS.failed === 'function' ? IS.failed() : null; if (f) return 'failed:' + f; } catch (e) {}
    try { var r = typeof IS.remembered === 'function' ? IS.remembered(w.SL_WORLD_VER) : null; if (r && r.off) return 'remembered:' + (r.why || '2d'); } catch (e) {}
    return null;
  }
  /* stage.js not loaded: read its remembered record by the same rule as its
     rememberedFrom (stale once SL_WORLD_VER changes, when undated, after REMEMBER_DAYS
     or dated over a day ahead; ?3d=1 lets a parent retry 3D). REMEMBER_DAYS mirrors
     stage.js's (tests/fix-shell.test.js checks they agree). */
  var REMEMBER_DAYS = 7, DAY_MS = 24 * 60 * 60 * 1000;
  function storedVerdict(w) {
    try {
      if (/[?&]3d=1(&|$)/.test(String((w.location && w.location.search) || ''))) return null;
      var rec = w.localStorage ? JSON.parse(w.localStorage.getItem('slIsland3D') || 'null') : null;
      if (!rec || typeof rec !== 'object' || !rec.off || String(rec.ver) !== String(w.SL_WORLD_VER || '1')) return null;
      var at = Number(rec.at), now = Date.now();
      if (rec.at == null || !isFinite(at) || now - at > REMEMBER_DAYS * DAY_MS || at - now > DAY_MS) return null;
      return 'remembered:' + (rec.why || '2d');
    } catch (e) {}
    return null;
  }
  /* compat-1 (RELEASE-FIXES, 25 Oct 2026): Safari 15.0-16.3 has WebGL2 but no import maps, so `three`
     can never load there. A browser that says it has none (no HTMLScriptElement.supports, or it answers
     false for 'importmap') plays in 2D at once; one that cannot be asked at all (no HTMLScriptElement:
     not a browser) is left to the loader as before */
  function importMaps(w) {
    try {
      var S = (w || {}).HTMLScriptElement;
      if (typeof S === 'undefined') return true;
      return typeof S.supports === 'function' && S.supports('importmap') === true;
    } catch (e) { return true; }
  }
  /* a list of short phrases read as sentences by a screen reader */
  function sentences(parts) {
    return parts.filter(function (s) { return s != null && String(s).trim(); }).map(function (s) {
      s = String(s).trim(); return /[.!?…]$/.test(s) ? s : s + '.';
    }).join(' ');
  }
  /* E5: while a game is up the page behind it is inert (no Tab stops, hidden from screen
     readers; aria-hidden too, for an iPad without inert). Only what this changed is put back. */
  var NOT_SHOWN = /^(script|style|link|meta|template|noscript)$/i;
  function shutBehind(root) {
    var out = [], host = root && root.parentNode, kids = host ? host.children : [];
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (!n || n === root || NOT_SHOWN.test(n.localName || '')) continue;
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
  /* what Tab can reach inside the game: enabled, not tabindex -1, not in a hidden part */
  function tabStops(root) {
    return Array.prototype.filter.call(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]'), function (n) {
      if (n.disabled || n.getAttribute('tabindex') === '-1') return false;
      for (var p = n; p && p !== root; p = p.parentNode) if (p.hidden || (p.style && p.style.display === 'none')) return false;
      return true;
    });
  }
  var ROT_HTML = '<div class="slg-rot" aria-hidden="true">📱↻ Turn sideways for a bigger view</div>';
  /* ================================================================
     define(def) -> { start(cfg), demo(host, opts) }
     def: key, title, emoji, LW, LH, tutorial[], controls[], keys{},
          countdown (secs), preload(cfg), newRound(api, variant, cfg),
          roundSecsMax (hard cap so a round always ends)
     round: step(dt), render(ctx), input(id, down), pointer(type, x, y),
            done, hud(), result(), summary(), forceEnd(), autopilot(dt)
     ================================================================ */
  function define(def) {
    function start(cfg) {
      injectCss();
      var ac = new AbortController(), sig = { signal: ac.signal };
      /* one shared sound set when the island has loaded it (adds pet voices etc.) */
      var sound = (window.SLSound && typeof SLSound.make === 'function') ? SLSound.make(cfg) : makeSound(cfg);
      var title = def.titleFor ? (function () { try { return def.titleFor(cfg) || def.title; } catch (e) { return def.title; } })() : def.title;
      var reduced = !!cfg.reduced;
      /* E5: a modal dialog — the focus it took over goes back on exit */
      var prevFocus = null; try { prevFocus = document.activeElement; } catch (e) { prevFocus = null; }
      var root = el('div', 'slg');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', title);
      root.setAttribute('tabindex', '-1');
      root.setAttribute('data-sl-modal', '1');          /* the app's one-off popups wait for it */
      /* skin hooks (world/island-encore.css): the player's colour and the count-in beat */
      if (cfg.user && /^#[0-9a-f]{6}$/i.test(cfg.user.color || '')) root.style.setProperty('--sle-member', cfg.user.color);
      if (def.countIn && def.countIn.bpm > 0) root.style.setProperty('--slg-beat', (60 / def.countIn.bpm).toFixed(3) + 's');
      root.innerHTML =
        '<div class="slg-top"><span class="ttl">' + def.emoji + ' ' + esc(title) + '</span><span class="hud" id="slgHud" aria-live="off"></span>' +
        '<button class="slg-b" type="button" id="slgSound" aria-label="Sound on or off"></button>' +
        '<button class="slg-b" type="button" id="slgPause" aria-label="Pause">⏸</button>' +
        '<button class="slg-b" type="button" id="slgExit" aria-label="Back to my island">🏝️ Exit</button></div>' +
        '<div class="slg-mid" id="slgMid"><canvas class="slg-canvas" id="slgCanvas"></canvas><div class="slg-touch" id="slgTouch"></div></div>' +
        '<div class="slg-sr" id="slgLive" role="status" aria-live="polite" aria-atomic="true"></div>';
      document.body.appendChild(root);
      var behind = shutBehind(root);
      var mid = root.querySelector('#slgMid'), canvas = root.querySelector('#slgCanvas'), ctx = canvas.getContext('2d');
      var hudEl = root.querySelector('#slgHud'), ttlEl = root.querySelector('.slg-top .ttl'), soundBtn = root.querySelector('#slgSound'), pauseBtn = root.querySelector('#slgPause');
      var liveEl = root.querySelector('#slgLive'), liveTimer = 0, livePending = '';
      /* screen-reader announcements (results, a new personal best): the region is
         emptied first so a repeated line is read again */
      function say(text) {
        if (!liveEl || !text) return;
        livePending = livePending ? livePending + ' ' + text : String(text);
        if (liveTimer) return;
        liveEl.textContent = '';
        liveTimer = setTimeout(function () { liveTimer = 0; var t = livePending; livePending = ''; if (!exited) liveEl.textContent = t; }, 80);
      }
      function paintSound() { soundBtn.textContent = (cfg.muted && cfg.muted()) ? '🔇' : '🔊'; }
      paintSound();
      soundBtn.addEventListener('click', function () { if (cfg.toggleMute) cfg.toggleMute(); paintSound(); }, sig);

      var view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
      /* QA2C-12: the pill asks a game for its compact form, hud(hudOpt), on a narrow phone and
         whenever the full form did not fit at this width (pillFits); a new width starts again */
      var hudOpt = { narrow: false }, pillW = -1, pillOk = {}, PILL_SPARE = 16;
      /* a web font that arrives mid-game changes the pill's width: measure again */
      try { if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { pillOk = {}; }, sig); } catch (e) {}
      function resize() {
        var r = mid.getBoundingClientRect();
        if (r.width !== pillW) { pillW = r.width; hudOpt.narrow = r.width > 0 && r.width <= 420; pillOk = {}; }
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        var s = Math.min(r.width / def.LW, r.height / def.LH);
        view = { scale: s, ox: (r.width - def.LW * s) / 2, oy: (r.height - def.LH * s) / 2, dpr: dpr };
        if (v3) { try { v3.resize(r.width, r.height); } catch (e) { fail3d('resize'); } }
        draw();
      }
      var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(resize) : null;
      if (ro) ro.observe(mid); else window.addEventListener('resize', resize, sig);
      window.addEventListener('orientationchange', function () { setTimeout(resize, 200); }, sig);

      /* ---------- state machine ---------- */
      var phase = 'menu';          /* menu | tutorial | countdown | playing | paused | results | timeup */
      var variant = cfg.variant;
      /* API 2: the round's own course (beginRound's opts.variant, else the menu choice), the
         time of GO when one was given, the live-round flag and its wall clock, the menu sheet */
      var rVariant = variant, goAt = null, live = false, lastWall = 0, menuSc = null;
      var round = null, raf = 0, last = 0, acc = 0, countT = 0, playSecAcc = 0, hardStop = Infinity, graceNote = false;
      var lastDt = 0, countIsStart = true, v3 = null, v3mod = null, v3failed = false, idleRaf = 0, idleLast = 0, hudObj = null;
      var playPace = makePacer(PLAY_FPS), idlePace = makePacer(IDLE_FPS), watch = makeFrameWatch(), lastDrawAt = 0, lastWork = 0, unsubQ = null;
      var hudText = null, pads = [], countEl = null, countTxt = '', ringEl = null, ringAt = -Infinity;
      function countTotal() { return def.countIn ? def.countIn.beats * 60 / def.countIn.bpm : (def.countdown || 0); }
      function countLabel() {
        if (goAt != null && countT > countTotal()) return '🏁';   /* waiting for a given GO */
        if (!def.countIn) return String(Math.max(1, Math.ceil(countT)));
        var beat = 60 / def.countIn.bpm, i = Math.min(def.countIn.beats - 1, Math.floor((countTotal() - countT) / beat));
        return (def.countIn.labels && def.countIn.labels[i]) || String(def.countIn.beats - i);
      }
      function mus(method) {
        var m = api && api.music; if (!m || typeof m[method] !== 'function') return;
        try { m[method].apply(m, Array.prototype.slice.call(arguments, 1)); } catch (e) {}
      }
      /* stored rival/variant choice for games with their own variant list */
      if (def.menuVariants) {
        try {
          var stored = localStorage.getItem('slgVar:' + def.key), list0 = def.menuVariants(cfg) || [];
          if (stored && list0.some(function (v) { return v.id === stored && !v.locked; })) variant = stored;
          else if (!list0.some(function (v) { return v.id === variant && !v.locked; }) && list0.length) variant = (list0.filter(function (v) { return !v.locked; })[0] || list0[0]).id;
        } catch (e) {}
      }
      var screen = null, banner = null;
      var held = {};
      /* the Exit check: its card, the focus it took, what it made inert; pausedFrom: the phase a pause left */
      var askEl = null, askFocus = null, askShut = [], askHid = null, pausedFrom = null;

      /* QA2C-14: ⏸ only while there is something to pause (a count, a round, the pause sheet).
         Every phase change draws a sheet (setScreen) or starts the loop (startLoop); both ask */
      function syncPause() {
        var on = phase === 'playing' || phase === 'countdown' || phase === 'paused';
        if (root.classList.contains('slg-nopause') === on) root.classList.toggle('slg-nopause', !on);
      }
      /* noFocus: the caller focuses later (results wake their buttons after a guard) */
      function setScreen(html, noFocus) {
        if (askEl) closeAsk(false);                   /* a new sheet (results of a live race, a menu): the question is over */
        if (screen) screen.remove();
        screen = null;
        syncPause();
        if (html == null) return;
        var s = screen = el('div', 'slg-scr');
        s.appendChild(el('div', 'slg-in', html));
        mid.appendChild(s);
        if (!noFocus) setTimeout(function () { if (screen === s) focusMain(s); }, 30);
        return s;
      }
      /* the sheet's main button takes focus (Enter / Space press it) without scrolling
         a tall sheet away from its title */
      function focusMain(sc) {
        var f = sc.querySelector('.slg-b.go');
        if (!f || f.disabled) f = sc.querySelector('.slg-b.alt');
        if (!f || f.disabled) f = Array.prototype.filter.call(sc.querySelectorAll('button'), function (b) { return !b.disabled; })[0];
        if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
      }
      function setBanner(txt) {
        if (banner) { banner.remove(); banner = null; }
        if (!txt) return;
        banner = el('div', 'slg-banner'); banner.textContent = txt; banner.setAttribute('role', 'status');
        mid.appendChild(banner);
      }
      /* o (optional): {results: true, result} on the results sheet — a game's pbText then leaves
         out what the sheet already says (QA2C-1: the kart's 'Next: 🥇 Gold … to go' is the next
         step there; QA2C-8: the Debut Run's medal when it is this round's badge) */
      function pbLine(v, o) {
        var key = def.key + ':' + String(v || 'std');
        var rec = cfg.pb && cfg.pb[key];
        if (!rec) return 'No personal best yet — set one!';
        if (def.pbText) { try { var t = o ? def.pbText(rec, v, cfg, o) : def.pbText(rec, v, cfg); if (t) return t; } catch (e) {} }
        return '🏆 Your best: ' + (rec.ms != null ? (rec.ms / 1000).toFixed(2) + ' s' : 'score ' + String(rec.score).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      }
      function lockP(v) { return '<p class="slg-lock">🔒 ' + esc(v.name) + ': ' + esc(v.lockText) + '</p>'; }
      function menu() {
        phase = 'menu'; stopLoop(); setBanner(null); renderTouch(false);
        setHudText('');                                   /* QA2C-7: no stale 'FINAL KICK' / 'Lap 1/2' pill */
        mus('menuMode', true);
        var vhtml = '', locksBelow = '';
        if (def.menuVariants) {
          var mv = def.menuVariants(cfg) || [];
          vhtml = '<p class="lb" style="font-weight:800;margin:0;">' + esc(def.menuVariantsTitle || 'Choose') + '</p><div class="row">' + mv.map(function (v) {
            return '<button class="slg-var' + (v.id === variant ? ' on' : '') + '" type="button" data-mvar="' + esc(v.id) + '"' + (v.locked ? ' disabled' : '') + ' title="' + esc(v.tip || '') + '">' +
              (v.icon ? esc(v.icon) + ' ' : '') + esc(v.name) + (v.medal ? ' ' + esc(v.medal) : '') + (v.locked ? ' 🔒' : '') + '</button>';
          }).join('') + '</div>' + mv.filter(function (v) { return v.locked && v.lockText && !v.lockBelow; }).map(lockP).join('');
          /* v.lockBelow: its lock line goes under the Play row with the opened extras (QA2C-11) */
          locksBelow = mv.filter(function (v) { return v.locked && v.lockText && v.lockBelow; }).map(lockP).join('');
        } else {
          var vars = (cfg.ownedVariants || []);
          vhtml = vars.length > 1 ? '<div class="row">' + vars.map(function (v) { return '<button class="slg-var' + (v.id === variant ? ' on' : '') + '" type="button" data-var="' + esc(v.id) + '">' + esc(v.name) + '</button>'; }).join('') + '</div>' : '';
        }
        var ohtml = '', lhtml = '';
        if (def.menuOptions) {
          (def.menuOptions(cfg) || []).forEach(function (o) {
            var h = '<div class="slg-opt" role="group" aria-label="' + esc(o.label) + '"><span class="lb">' + esc(o.label) + '</span>' + (o.options || []).map(function (op) {
              var on = op.value === o.value;
              return '<button class="slg-var' + (on ? ' on' : '') + '" type="button" aria-pressed="' + on + '" data-opt="' + esc(o.id) + '" data-val="' + esc(String(op.value)) + '"' + (op.locked ? ' disabled' : '') + '>' + (op.locked ? '🔒 ' : '') + esc(op.label) + '</button>';
            }).join('') + '</div>' + (o.options || []).filter(function (op) { return op.locked && op.note; }).map(function (op) { return '<p class="slg-lock">' + esc(op.note) + '</p>'; }).join('');
            if (o.below === true) lhtml += h; else ohtml += h;
          });
        }
        /* a game's own buttons in the Play row (def.menuButtons), each with one note line */
        var bhtml = '', nhtml = '';
        if (def.menuButtons) {
          var mbs = []; try { mbs = def.menuButtons(cfg) || []; } catch (e) { mbs = []; }
          mbs.forEach(function (b) {
            bhtml += '<button class="slg-b" type="button" data-mbtn="' + esc(b.id) + '"' + (b.disabled ? ' disabled' : '') + '>' + esc(b.label) + '</button>';
            if (b.note) nhtml += '<p class="slg-lock">' + esc(b.note) + '</p>';
          });
        }
        var sc = menuSc = setScreen(ROT_HTML + '<div class="slg-emo">' + def.emoji + '</div><h2>' + esc(title) + '</h2>' + vhtml + ohtml + '<p>' + esc(pbLine(variant)) + '</p>' +
          '<div class="row"><button class="slg-b go" type="button" id="slgPlay">▶ Play</button><button class="slg-b" type="button" id="slgHow">❓ How to play</button>' + bhtml + '</div>' + nhtml + lhtml + locksBelow);
        if (bhtml) sc.querySelectorAll('[data-mbtn]').forEach(function (b) { b.addEventListener('click', function () { try { if (def.onMenuButton) def.onMenuButton(b.dataset.mbtn, ctl, cfg); } catch (e) {} }); });
        menuBoards(sc, false);
        sc.querySelectorAll('[data-var]').forEach(function (b) { b.addEventListener('click', function () { variant = b.dataset.var; cfg.variant = variant; if (cfg.onSelectVariant) cfg.onSelectVariant(variant); if (v3 && v3.setRound) v3.setRound(null, variant); menu(); }); });
        sc.querySelectorAll('[data-mvar]').forEach(function (b) { b.addEventListener('click', function () { variant = b.dataset.mvar; cfg.variant = variant; try { localStorage.setItem('slgVar:' + def.key, variant); } catch (e) {} if (v3 && v3.setRound) v3.setRound(null, variant); menu(); }); });
        sc.querySelectorAll('[data-opt]').forEach(function (b) {
          b.addEventListener('click', function () {
            var o = ((def.menuOptions && def.menuOptions(cfg)) || []).filter(function (x) { return x.id === b.dataset.opt; })[0];
            var op = o && (o.options || []).filter(function (x) { return String(x.value) === b.dataset.val; })[0];
            if (op && def.setOption) def.setOption(cfg, o.id, op.value);
            menu();
          });
        });
        sc.querySelector('#slgPlay').addEventListener('click', function () { cfg.tutSeen ? beginRound() : tutorial(); });
        sc.querySelector('#slgHow').addEventListener('click', tutorial);
        if (v3) { if (v3.setRound) v3.setRound(null, variant); startIdle(); } else drawIdle();
      }
      /* optional leaderboards (window.SLBoards): 🏆 Leaderboards in the Play row and one hint
         line. boards.js may land after the menu was drawn (late): the sheet is only added
         to, never drawn again, so focus stays put and Play does not move under a finger —
         the hint then goes under the row, not above it */
      function menuBoards(sc, late) {
        var B = window.SLBoards, play = sc.querySelector('#slgPlay'), row = play && play.parentNode;
        if (!B || !row || sc.querySelector('#slgBoards')) return;
        try { if (typeof B.available !== 'function' || B.available(cfg) !== true) return; } catch (e) { return; }
        var b = el('button', 'slg-b'); b.type = 'button'; b.id = 'slgBoards'; b.textContent = '🏆 Leaderboards';
        b.addEventListener('click', function () {
          try { B.open({ host: ctl.sheet(), game: def.key, variant: variant, cfg: cfg, day: cfg.day, onClose: menu }); }
          catch (e) { if (!exited) menu(); }
        });
        row.appendChild(b);
        var hint = ''; try { hint = typeof B.menuHint === 'function' ? B.menuHint(def.key, variant, cfg) : ''; } catch (e) { hint = ''; }
        if (hint) { var p = el('p'); p.id = 'slgBoardHint'; p.textContent = String(hint); row.parentNode.insertBefore(p, late ? null : row); }
      }
      /* boards.js is here (already loaded, or its script tag just was) */
      function boardsReady() {
        var B = window.SLBoards;
        if (!B || exited) return;
        try { if (typeof B.prefetch === 'function') B.prefetch(cfg); } catch (e) {}
        if (phase === 'menu' && screen && screen === menuSc) menuBoards(menuSc, true);
      }
      function tutorial() {
        phase = 'tutorial'; if (v3) startIdle();
        var sc = setScreen(ROT_HTML + '<h2>How to play</h2><div class="slg-tut">' + def.tutorial.map(function (t) { return '<div><b>' + t[0] + '</b>' + esc(t[1]) + '</div>'; }).join('') + '</div>' +
          '<div class="row"><button class="slg-b go" type="button" id="slgGotIt">Got it — let’s go!</button><button class="slg-b" type="button" id="slgBack">Back</button></div>');
        sc.querySelector('#slgGotIt').addEventListener('click', function () { if (!cfg.tutSeen) { cfg.tutSeen = true; if (cfg.onTutorialSeen) cfg.onTutorialSeen(); } beginRound(); });
        sc.querySelector('#slgBack').addEventListener('click', menu);
      }
      function timeUpScreen(afterRound) {
        phase = 'timeup'; stopLoop(); setBanner(null); renderTouch(false); mus('menuMode', true); if (v3) startIdle();
        var sc = setScreen('<div class="slg-emo">⏱️</div><h2>That’s all the game time for today</h2><p>' + (afterRound ? 'Great finish! ' : '') + 'Your games are still yours — come back tomorrow. 📚 Learning is open whenever you like.</p>' +
          '<div class="row"><button class="slg-b go" type="button" id="slgOut">🏝️ Back to my island</button></div>');
        sc.querySelector('#slgOut').addEventListener('click', exit);
      }
      /* opts (API 2, both optional): variant = the course for this round only; goAt = the
         performance.now() time of GO. → false (and the time-up sheet) when the gate refuses */
      function beginRound(opts) {
        var gate = cfg.arcade ? cfg.arcade.gate() : { allowed: true, hardStopAtUsed: Infinity };
        if (!gate.allowed) { timeUpScreen(false); return false; }
        hardStop = gate.hardStopAtUsed; graceNote = false;
        setScreen(null); setBanner(null);
        rVariant = (opts && opts.variant != null) ? String(opts.variant) : variant;
        goAt = (opts && typeof opts.goAt === 'number' && isFinite(opts.goAt)) ? opts.goAt : null;
        round = def.newRound(api, rVariant, cfg);
        round.wantEvents = true; if (!round.events) round.events = [];
        live = round.live === true;
        held = {};
        renderTouch(true);
        acc = 0; playSecAcc = 0; countIsStart = true;
        if (!v3) mount3d();
        if (v3 && v3.setRound) { try { v3.setRound(round, rVariant); } catch (e) { fail3d('setRound'); } }
        /* with goAt the count is the real time left to GO (the music count-in too), and the
           loop runs through the wait, so the grid is drawn while the others get ready */
        var lead = goAt != null ? (goAt - performance.now()) / 1000 : countTotal();
        if (def.music) mus('play', def.music.track, { countInSec: Math.max(0, lead) });
        if (goAt != null || lead) { phase = 'countdown'; countT = lead; } else { phase = 'playing'; mus('menuMode', false); }
        var st = cfg.arcade && cfg.arcade.status();
        if (st && st.limited && st.warn) setBanner('⏱️ About 1 minute of game time left today');
        startLoop();
        return true;
      }
      /* Play again / Restart: the same course as the round on screen */
      function replay() { beginRound({ variant: rVariant }); }
      function finishRound() {
        if (!round || phase === 'results') return;
        if (round.onFinish) { try { round.onFinish(); } catch (e) {} }
        phase = 'results'; stopLoop(); renderTouch(false); setBanner(null);
        mus('menuMode', true);
        if (cfg.arcade) cfg.arcade.flush();
        var res = round.result(), rnd = round, rv = rVariant;
        /* QA2C-10: out of game time for today the sheet invites no more play: no next step, no
           next course / rival, and Change course / rival is off (🏝️ Back to my island stays) */
        var st0 = cfg.arcade && cfg.arcade.status(), timeUp = !!(st0 && st0.exhausted);
        var badges = '', badgeList = [];
        if (round.summaryBadges) { try { badgeList = round.summaryBadges() || []; badges = badgeHtml(badgeList); } catch (e) { badges = ''; badgeList = []; } }
        var sTitle = round.summaryTitle ? round.summaryTitle() : 'Finished!', sBig = round.summaryBig(), sText = round.summaryText ? round.summaryText() : '';
        /* API 2: a round may bring its own block (resultsExtra) and main button (again, with
           one note line under the row); a board line gets a slot while boards.js is loaded */
        var extra = typeof rnd.resultsExtra === 'function', own = typeof rnd.again === 'function', waits = own && typeof rnd.againState === 'function';
        var boardSlot = false; try { boardSlot = !!(window.SLBoards && typeof window.SLBoards.onResult === 'function'); } catch (e) {}
        /* API 3 (B7): with round.nextStep the sheet reads achievement → best → ONE next step →
           buttons, and the numbers wait behind 📊 Details */
        var focusL = typeof rnd.nextStep === 'function', nextLine = '', details = [], shown = badgeList;
        if (focusL) {
          try { nextLine = timeUp ? '' : String(rnd.nextStep() || '').trim(); } catch (e) { nextLine = ''; }
          shown = badgeList.filter(function (b) { return b && b.kind !== 'hint'; });
          if (sText) details.push(sText);
          if (typeof rnd.summaryDetails === 'function') {
            try { var sd = rnd.summaryDetails(); if (sd != null) details = details.concat(Array.isArray(sd) ? sd : [sd]); } catch (e) {}
          }
          badgeList.forEach(function (b) { if (b && b.kind === 'hint' && b.text) details.push(b.text); });
          details = details.filter(function (t) { return t != null && String(t).trim(); }).map(String);
          injectCss3();
        }
        /* the money line: an island that pays in 🪙 coins says so (world-copy games.noCoins, F-KU5 review); a core that pays in ⭐ keeps V4.54's */
        var CW = window.SLWorldCore, coinsP = !!(CW && typeof CW.walletOf === 'function' && CW.walletOf() === 'coins');
        var STARS_P = '<p style="font-size:13px;opacity:.75;margin:0 0 8px;">' + (coinsP ? '🎮 Games are just for fun. They never earn or spend coins or points.' : '🎮 Game scores don’t earn or spend ⭐ — learning earns ⭐.') + '</p>';
        var ROW = '<div class="row"><button class="slg-b go" type="button" id="slgAgain">' + (own && rnd.againLabel ? esc(rnd.againLabel) : '↻ Play again') + '</button>' +
          (!live && variantChoices() > 1 ? '<button class="slg-b" type="button" id="slgMenu">🗺️ Change ' + esc(def.menuVariantsLabel || 'course') + '</button>' : '') +
          '<button class="slg-b alt" type="button" id="slgHome">🏝️ Back to my island</button></div>' + (waits ? '<p class="slg-lock" id="slgAgainNote"></p>' : '');
        var SLOTS = '<div id="slgPbSlot" class="slg-pbslot"></div>' + (boardSlot ? '<div id="slgBoardSlot" class="slg-boardslot"></div>' : '');
        var sc = setScreen(!focusL
          ? '<h2>' + esc(sTitle) + '</h2><div class="slg-big">' + esc(sBig) + '</div><p>' + esc(sText) + '</p>' + badges + (extra ? '<div id="slgExtra"></div>' : '') + SLOTS + STARS_P + ROW
          : '<h2>' + esc(sTitle) + '</h2><div class="slg-big">' + esc(sBig) + '</div>' + (shown.length ? badgeHtml(shown) : '') + (extra ? '<div id="slgExtra"></div>' : '') + SLOTS +
            (nextLine ? '<p class="slg-next" id="slgNextStep">' + esc(nextLine) + '</p>' : '') + ROW +
            (details.length ? '<div class="row"><button class="slg-b slg-more" type="button" id="slgDetailsBtn" aria-expanded="false" aria-controls="slgDetails">📊 Details</button></div>' +
              '<div id="slgDetails" class="slg-details" hidden>' + details.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' : '') + STARS_P, true);
        /* tell a screen reader how it went (title, score, summary, medals — or, in the focus
           order, the medals and the next step; Details is read when it is opened) */
        say(sentences(focusL ? [sTitle, sBig].concat(shown.map(function (b) { return b && b.text; }), [nextLine]) : [sTitle, sBig, sText].concat(badgeList.map(function (b) { return b && b.text; }))));
        if (v3 && def.resultsGlass) sc.classList.add('glass');
        if (v3) startIdle();
        if (extra) { try { rnd.resultsExtra(sc.querySelector('#slgExtra'), ctl); } catch (e) {} }
        sc.querySelector('#slgAgain').addEventListener('click', own ? function () { try { rnd.again(ctl); } catch (e) {} } : replay);
        var mb = sc.querySelector('#slgMenu'); if (mb) mb.addEventListener('click', menu);
        sc.querySelector('#slgHome').addEventListener('click', exit);
        var db = sc.querySelector('#slgDetailsBtn');
        if (db) db.addEventListener('click', function () {
          var box = sc.querySelector('#slgDetails'); if (!box) return;
          var open = !!box.hidden; box.hidden = !open; db.setAttribute('aria-expanded', String(open));
        });
        var again = sc.querySelector('#slgAgain');
        if (timeUp) {
          again.textContent = '⏱️ Time’s up for today'; again.disabled = true; again.dataset.stay = '1'; again.classList.remove('go');
          if (mb) { mb.disabled = true; mb.dataset.stay = '1'; }
        }
        /* B10: what this round opened up. The menu's open choices before the result is saved;
           once it is (cfg.pb has the new best) a first unlock gets 'Change …' and its own main
           button. Buttons added while the tap guard is up wait with the others; later ones
           wait GUARD_MS on their own and never take the focus */
        var before = openChoices().map(function (v) { return v.id; }), guarded = null, guardOn = true;
        function offerNext() {
          if (exited || screen !== sc || live || own || timeUp) return;
          var row = again.parentNode, home = sc.querySelector('#slgHome'), added = [];
          if (!row || !home) return;
          if (!sc.querySelector('#slgMenu') && variantChoices() > 1) {
            var cb = el('button', 'slg-b'); cb.setAttribute('type', 'button'); cb.id = 'slgMenu';
            cb.textContent = '🗺️ Change ' + (def.menuVariantsLabel || 'course');
            cb.addEventListener('click', menu);
            row.insertBefore(cb, home); added.push(cb);
          }
          var nv = sc.querySelector('#slgNext') ? null : nextChoice(rnd, rv, before);
          if (nv) {
            var nb = el('button', 'slg-b go'); nb.setAttribute('type', 'button'); nb.id = 'slgNext'; nb.textContent = nv.label;
            nb.addEventListener('click', function () { chooseVariant(nv.id); });
            row.insertBefore(nb, again); added.push(nb);
            again.classList.remove('go'); again.textContent = nv.again;
          }
          added.forEach(function (b) {
            if (!guarded) return;                         /* drawn before the guard: it takes them */
            b.disabled = true;
            if (guardOn) guarded.push(b);
            else setTimeout(function () { if (screen === sc && !exited) b.disabled = false; }, GUARD_MS);
          });
        }
        if (res && cfg.onResult) {
          Promise.resolve(cfg.onResult(rv, res)).then(function (r) {
            boardLine(sc, rv, res, r);
            var slot = sc.querySelector('#slgPbSlot'); if (!slot) return;
            if (r && r.isPB) {
              slot.innerHTML = '<span class="slg-pb">🏆 NEW PERSONAL BEST!</span>';
              sound('fanfare');
              if (screen === sc) say('New personal best!');
              var key = def.key + ':' + String(rv || 'std');
              var rec = res.ms != null ? { ms: res.ms } : { score: res.score };
              if (typeof res.extra === 'number' && res.extra === Math.floor(res.extra)) rec.extra = res.extra;   /* the menu's best line keeps its medal */
              cfg.pb = cfg.pb || {}; cfg.pb[key] = rec;
            } else if (r && r.prev) {
              slot.innerHTML = '<span style="font-weight:700;color:#d9d2f7;">' + esc(pbLine(rv, { results: true, result: res })) + '</span>';
            }
            offerNext();
          }).catch(function () {});
        } else offerNext();
        /* a round with its own main button may hold it back with one line ('Waiting for …'):
           asked now and then twice a second while the sheet is up. The line keeps its height
           when empty, so nothing moves when the wait ends */
        var note = (waits && !timeUp) ? sc.querySelector('#slgAgainNote') : null;
        function syncAgain() {
          var s = null; try { s = rnd.againState(); } catch (e) {}
          var line = (s && s.note) ? String(s.note) : '\u00a0';
          if (note.textContent !== line) { note.textContent = line; if (s && s.note && screen === sc) say(line); }
          again.disabled = !!(s && s.disabled);
        }
        function pollAgain() { if (screen !== sc || exited) return; syncAgain(); setTimeout(pollAgain, 500); }
        if (note) syncAgain();
        /* a finger still tapping the game mustn't hit Play again / Exit by accident: the
           buttons wake after 0.65 s and then the main one takes focus (a disabled button
           can't, so focusing it earlier did nothing and Enter / Space went nowhere) */
        guarded = Array.prototype.filter.call(sc.querySelectorAll('button'), function (b) { return !b.disabled; });
        guarded.forEach(function (b) { b.disabled = true; });
        setTimeout(function () {
          guardOn = false;
          guarded.forEach(function (b) { if (!b.dataset.stay) b.disabled = false; });
          if (note) pollAgain();
          if (screen === sc && !exited) focusMain(sc);
        }, GUARD_MS);
      }
      function badgeHtml(list) {
        return '<div class="slg-badges">' + list.map(function (b) { return '<span class="slg-badge ' + esc(b.kind || '') + '">' + esc(b.text) + '</span>'; }).join('') + '</div>';
      }
      /* the menu's open choices now: [{id, name, icon}] (def.menuVariants, else the owned courses) */
      function openChoices() {
        if (def.menuVariants) { try { return (def.menuVariants(cfg) || []).filter(function (v) { return v && !v.locked && v.id != null; }); } catch (e) { return []; } }
        return (cfg.ownedVariants || []).filter(function (v) { return v && v.id != null; });
      }
      /* B10: the course / rival to offer after a round on rv → {id, label, again} or null */
      function nextChoice(rnd, rv, before) {
        var now = openChoices(), find = function (id) { for (var i = 0; i < now.length; i++) if (String(now[i].id) === String(id)) return now[i]; return null; };
        var cur = find(rv), againTxt = cur && cur.name ? '↻ Replay ' + cur.name : '↻ Play again';
        function tryLabel(v) { return (v.icon ? v.icon : '▶') + ' Try ' + v.name; }
        var o;                                             /* undefined: the game has no opinion */
        if (typeof rnd.nextVariant === 'function') { try { o = rnd.nextVariant(); } catch (e) { o = null; } }
        if (o !== undefined) {
          var v = o && o.id != null && String(o.id) !== String(rv) ? find(o.id) : null;
          return v ? { id: v.id, label: String(o.label || tryLabel(v)), again: String(o.again || againTxt) } : null;
        }
        if (!def.menuVariants) return null;                /* owned courses come from the shop, not from a round */
        for (var i = 0; i < now.length; i++) if (before.indexOf(now[i].id) < 0 && String(now[i].id) !== String(rv)) return { id: now[i].id, label: tryLabel(now[i]), again: againTxt };
        return null;
      }
      /* choose a course / rival exactly as its menu chip does, and play it */
      function chooseVariant(id) {
        variant = id; cfg.variant = id;
        if (def.menuVariants) { try { localStorage.setItem('slgVar:' + def.key, id); } catch (e) {} }
        else if (cfg.onSelectVariant) { try { cfg.onSelectVariant(id); } catch (e) {} }
        beginRound();
      }
      /* the board line under the personal best (optional): asked once per finished round
         that was saved; whatever boards.js does, the sheet is not held up */
      function boardLine(sc, v, res, r) {
        try {
          var B = window.SLBoards;
          if (!r || r.ok !== true || !B || typeof B.onResult !== 'function') return;
          Promise.resolve(B.onResult({ game: def.key, variant: v, result: res, outcome: r, cfg: cfg, menuName: menuName(v) })).then(function (info) {
            var slot = sc.querySelector('#slgBoardSlot');
            if (!slot || !info || !info.text || exited) return;
            slot.textContent = String(info.text);
            if (screen === sc) say(String(info.text));
          }).catch(function () {});
        } catch (e) {}
      }
      /* QA 25 Oct #11: the course v as this menu names it, for the board line: '' when the menu offers
         no choice of course (one owned course: the menu shows only the game's title, so 'on Meadow
         Dash' would be a name the child never meets), the owned course's name when it offers
         several; undefined for a game with its own list (rivals, kart courses), whose boards keep
         their own names */
      function menuName(v) {
        if (def.menuVariants) return undefined;
        var own = cfg.ownedVariants || [];
        if (own.length < 2) return '';
        for (var i = 0; i < own.length; i++) if (own[i] && String(own[i].id) === String(v) && own[i].name) return String(own[i].name);
        return undefined;
      }
      function variantChoices() {
        if (def.menuVariants) { try { return (def.menuVariants(cfg) || []).filter(function (v) { return !v.locked; }).length; } catch (e) { return 0; } }
        return (cfg.ownedVariants || []).length;
      }
      /* quiet === true: paused with no Paused sheet (the Exit check puts up its own card) → true when it paused */
      function pause(quiet) {
        if (phase !== 'playing' && phase !== 'countdown') return false;
        if (live) return false;      /* a live round runs on real time: time away goes on its clock */
        goAt = null;                 /* a count that was paused goes on frame by frame */
        if (round && round.pauseReset) { try { round.pauseReset(); } catch (e) {} }
        mus('pause', 200);
        pausedFrom = phase; phase = 'paused'; stopLoop(); held = {}; renderTouchHeld();
        if (quiet === true) { syncPause(); return true; }
        var sc = setScreen(ROT_HTML + '<div class="slg-emo">⏸</div><h2>Paused</h2><p>Take your time.</p><div class="row"><button class="slg-b go" type="button" id="slgResume">▶ Resume</button><button class="slg-b" type="button" id="slgRestart">↻ Restart</button><button class="slg-b alt" type="button" id="slgQuit">🏝️ Exit</button></div>');
        sc.querySelector('#slgResume').addEventListener('click', resume);
        sc.querySelector('#slgRestart').addEventListener('click', replay);
        sc.querySelector('#slgQuit').addEventListener('click', askLeave);
        return true;
      }
      /* back from a pause: a round that was playing counts in again first */
      function resume() {
        if (phase !== 'paused') return;
        var was = pausedFrom || 'playing'; pausedFrom = null;
        setScreen(null);
        countIsStart = false;
        /* a round whose result is final has nothing to get ready for: its closing show goes on, no count-in */
        if (was === 'playing' && !roundEnded()) { phase = 'countdown'; countT = def.countIn ? countTotal() : Math.max(countT, 2); } else phase = was;
        mus('resume', 300);
        startLoop();
      }
      /* ---------- the Exit check (see OPTIONAL HOOKS) ---------- */
      function inRound() { return !!round && (phase === 'countdown' || phase === 'playing' || phase === 'paused'); }
      /* the round's result is final and only its closing show plays on (round.ended + round.endNow) */
      function roundEnded() {
        if (!round || round.done || typeof round.ended !== 'function' || typeof round.endNow !== 'function') return false;
        try { return !!round.ended(); } catch (e) { return false; }
      }
      /* skip that closing show: the results come up now, the result saved as at its end → true when they did */
      function resultsNow() {
        var was = phase;
        try { round.endNow(); } catch (e) {}
        if (!round.done) return false;
        if (was === 'paused') { pausedFrom = null; mus('resume', 0); }   /* the results' music, as after the show */
        finishRound();
        return true;
      }
      /* a live round runs on under the card: whatever was held down is let go, so it does not drive on */
      function letGo() {
        Object.keys(held).forEach(function (id) { if (held[id]) { held[id] = false; if (round && round.input) { try { round.input(id, false); } catch (e) {} } } });
        renderTouchHeld();
      }
      function askLeave() {
        if (exited || askEl) return;
        if (!inRound()) { exit(); return; }
        /* after the finish line or the last heart nothing is left to lose: no question, the results */
        if (roundEnded() && resultsNow()) return;
        try { askFocus = document.activeElement; } catch (e) { askFocus = null; }
        if (live) letGo(); else if (phase !== 'paused') pause(true);
        injectCssAsk();
        var w = ASK[def.key === 'kart' ? 'race' : 'game'];
        var a = askEl = el('div', 'slg-ask' + (reduced ? ' rm' : ''));
        a.id = 'slgAsk';
        a.innerHTML = '<div class="slg-ask-card" role="alertdialog" aria-modal="true" aria-labelledby="slgAskT" aria-describedby="slgAskP">' +
          '<h2 id="slgAskT">' + esc(w.title) + '</h2><p id="slgAskP">' + esc(w.text) + '</p>' +
          '<div class="row"><button class="slg-b go" type="button" id="slgStay">' + esc(ASK.stay) + '</button>' +
          '<button class="slg-b" type="button" id="slgLeave">' + esc(ASK.leave) + '</button></div></div>';
        root.appendChild(a);
        askShut = shutBehind(a);                         /* the top bar and the stage: no taps, no Tab stops */
        /* asked from the Paused sheet: that sheet steps aside, so the card reads alone over the stage */
        if (screen && phase === 'paused') { askHid = screen; screen.style.visibility = 'hidden'; }
        a.querySelector('#slgStay').addEventListener('click', keepPlaying);
        a.querySelector('#slgLeave').addEventListener('click', function () { closeAsk(false); exit(); });
        try { a.querySelector('#slgStay').focus({ preventScroll: true }); } catch (e) {}
      }
      function closeAsk() {
        if (!askEl) return;
        var a = askEl; askEl = null; askFocus = null;
        openBehind(askShut); askShut = [];
        if (askHid) { try { askHid.style.visibility = ''; } catch (e) {} askHid = null; }
        a.remove();
      }
      /* Keep playing (or Esc): the card goes, a paused round resumes, and the focus goes back where it was
         (the dialog itself when that button has gone with the pause sheet) */
      function keepPlaying() {
        if (!askEl) return;
        var f = askFocus;
        closeAsk();
        if (phase === 'paused') resume();
        try {
          if (f && f !== root && root.contains(f) && f.isConnected !== false && !f.disabled) f.focus({ preventScroll: true });
          else root.focus({ preventScroll: true });
        } catch (e) {}
      }
      pauseBtn.addEventListener('click', function () {
        if (askEl) return;
        /* a live round has no pause: the round says so (round.onPause) and runs on */
        if (live && (phase === 'playing' || phase === 'countdown')) { if (round && round.onPause) { try { round.onPause(ctl); } catch (e) {} } return; }
        if (phase === 'paused') { var r = screen && screen.querySelector('#slgResume'); if (r) r.click(); } else pause();
      }, sig);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) pause();
        else if (v3 && !exited && phase !== 'playing' && phase !== 'countdown' && phase !== 'paused') startIdle();   /* the menu/results 3D backdrop wakes up again */
      }, sig);
      window.addEventListener('blur', function () { pause(); }, sig);

      /* ---------- loop ---------- */
      function startLoop() {
        syncPause();
        stopLoop(); stopIdle();
        last = performance.now(); lastWall = Date.now(); lastDrawAt = last; playPace.reset(); watch.reset();
        raf = requestAnimationFrame(frame);
      }
      function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
      /* menus/results keep the 3D scene alive at ~30 fps (static 2D needs no loop) */
      function startIdle() { if (!v3 || idleRaf || exited) return; idleLast = performance.now(); idlePace.reset(); idleRaf = requestAnimationFrame(idleFrame); }
      function stopIdle() { if (idleRaf) cancelAnimationFrame(idleRaf); idleRaf = 0; }
      function idleFrame(now) {
        idleRaf = 0;
        if (!v3 || exited || document.hidden || phase === 'playing' || phase === 'countdown' || phase === 'paused') return;
        if (idlePace.tick(now)) {
          var dt = Math.min(MAX_FRAME, Math.max(0, (now - idleLast) / 1000)); idleLast = now;
          try { v3.frame(round, dt, 0, phase, 0); } catch (e) { fail3d('frame'); return; }
        }
        idleRaf = requestAnimationFrame(idleFrame);
      }
      /* a live round's lost time (a stall, a hidden page, a sleep, a late start) goes on
         that child's own race clock, with the kart stopped */
      function roundLate(sec) {
        if (sec > 0 && round && typeof round.late === 'function') { try { round.late(sec); } catch (e) {} }
      }
      function frame(now) {
        raf = 0;
        var gap = Math.max(0, (now - last) / 1000), dt = Math.min(MAX_FRAME, gap);
        last = now;
        if (live) {
          /* real time since the last frame: the wall clock is believed when it ran on
             while performance.now() stood still (CLOCK_SLIP) */
          var wall = Date.now(), slept = (wall - lastWall) / 1000 - gap;
          lastWall = wall;
          if (slept > CLOCK_SLIP) {
            gap += slept;
            if (phase === 'countdown' && goAt != null) goAt -= slept * 1000;   /* GO did not wait for the sleep */
          }
          dt = Math.min(LIVE_FRAME, gap);
          /* the parent's time limit counts every real second of a live round */
          if (phase === 'playing' && gap > LIVE_FRAME) { playSecAcc += gap - LIVE_FRAME; roundLate(gap - LIVE_FRAME); }
        }
        advance(dt, now);
        if (!v3) { lastDt = dt; draw(); }
        else if (playPace.tick(now)) {
          /* 3D draws at ~60 fps on any screen; the view's dt is the time since ITS last draw */
          var iv = now - lastDrawAt;
          lastDrawAt = now; lastDt = Math.min(MAX_FRAME, Math.max(0, iv / 1000));
          draw();
          if (v3 && (phase === 'playing' || phase === 'countdown') && watch.sample(iv, lastWork, now)) fail3d('slow');
        }
        if (phase === 'playing' || phase === 'countdown') raf = requestAnimationFrame(frame);
      }
      /* exposed for automated QA: advance the simulation by real seconds */
      function advance(dt, now) {
        if (phase === 'countdown') {
          var before = countLabel();
          /* a given GO (goAt) is read off the clock, so it lands on time at any frame rate */
          if (goAt != null) countT = (goAt - (now == null ? performance.now() : now)) / 1000; else countT -= dt;
          if (round && round.countdown) { try { round.countdown(Math.max(0, countT), held, countIsStart); } catch (e) {} }
          if (countLabel() !== before && countT > 0) sound('beep');
          if (countT <= 0) {
            phase = 'playing'; sound('go'); mus('menuMode', false);
            /* keys/pads held through the count fire as fresh presses at GO */
            if (round && round.input) Object.keys(held).forEach(function (id) { if (held[id]) round.input(id, true); });
            if (goAt != null) {
              /* GO was at goAt, not at this frame: up to LIVE_FRAME of the overshoot is played
                 as this frame's steps; a live round is first told the rest, once (a slow or
                 sleeping device starts late on its own clock) */
              var over = -countT, carry = Math.min(over, LIVE_FRAME);
              goAt = null;
              if (live) { playSecAcc += over - carry; roundLate(over - carry); }
              advance(carry);
            }
          }
          return;
        }
        if (phase !== 'playing' || !round) return;
        acc += dt;
        /* (a live round that round.late just ended takes no further step) */
        while (acc >= STEP && !(live && round.done)) { round.step(STEP, held); acc -= STEP; if (round.done) break; }
        /* parent time limit: count active play only */
        playSecAcc += dt;
        if (playSecAcc >= 1 && cfg.arcade) {
          var whole = Math.floor(playSecAcc); playSecAcc -= whole;
          var st = cfg.arcade.tick(whole);
          if (st && st.limited) {
            if (st.exhausted && !graceNote) { graceNote = true; setBanner('⏱️ Time’s up after this round — finish it off!'); }
            else if (!st.exhausted && st.warn && !banner) setBanner('⏱️ About 1 minute of game time left today');
            var ceiling = Math.min(hardStop, st.hardStopAtUsed != null ? st.hardStopAtUsed : Infinity);
            if (st.usedSec >= ceiling) { round.forceEnd(); }
          }
        }
        /* a live round that crossed the line while the Exit check asks: its results now (the card goes with them) */
        if (askEl && roundEnded()) { try { round.endNow(); } catch (e) {} }
        if (round.done) finishRound();
      }

      /* ---------- drawing ---------- */
      function begin() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#130c2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, def.LW, def.LH); ctx.clip();
      }
      function draw() {
        if (v3) {
          var t0 = performance.now();
          try { v3.frame(round, lastDt, acc / STEP, phase, countT); }
          catch (e) { fail3d('frame'); return draw(); }
          lastWork = performance.now() - t0;
        } else {
          if (!round) { drawIdle(); return; }
          begin();
          round.render(ctx);
          ctx.restore();
        }
        /* the text HUD only when no HTML HUD replaced it, and the DOM only on a change; over a
           3D view (with its own HUD) a round's hud3d() is the shorter pill (B11) */
        if (round && hudEl && !hudObj) {
          pillText();
          /* QA2C-12: the full pill did not fit (an upright iPhone Plus / Pro Max is 428–440 px):
             the compact form from now on at this width, set before the frame is painted */
          if (!hudOpt.narrow && hudText && !pillFits()) { hudOpt.narrow = true; pillText(); }
        }
        if (hudObj) { try { hudObj.update(round, phase); } catch (e) {} }
        if (round && round.padState) {
          for (var i = 0; i < pads.length; i++) { var p = pads[i], st = round.padState(p.id) || ''; if (p.st !== st) { p.st = st; p.b.dataset.st = st; } }
        }
        if (phase === 'countdown') {
          /* .slg-rings: the shell draws the rings, so the CSS fallback ring stays off */
          if (!countEl) { countEl = el('div', 'slg-count slg-rings'); mid.appendChild(countEl); countTxt = null; }
          var lbl = countLabel();
          if (lbl !== countTxt) {
            countTxt = lbl; countEl.textContent = lbl;
            /* a ring on the beat (the CSS plays it once), at most BEAT_PULSE_HZ — a resume
               right after a ring waits too. It sits beside the digits, so the next label
               never cuts it short; reduced motion keeps the digit only */
            var nowR = performance.now();
            if (!reduced && nowR - ringAt >= RING_GAP_MS) {
              if (ringEl) ringEl.remove();
              ringEl = el('span', 'slg-ring'); mid.insertBefore(ringEl, countEl); ringAt = nowR;
            }
          }
        } else if (countEl) { countEl.remove(); countEl = null; if (ringEl) { ringEl.remove(); ringEl = null; } }
        if (round && round.events && round.events.length) round.events.length = 0;
      }
      function setHudText(t) {
        t = t == null ? '' : String(t);
        if (t !== hudText) { hudText = t; hudEl.textContent = t; }
      }
      /* the round's pill for this frame: hud3d() over a 3D view (B11), else hud() */
      function pillText() {
        if (v3 && typeof round.hud3d === 'function') { var h3 = ''; try { h3 = round.hud3d(hudOpt); } catch (e) { h3 = ''; } setHudText(h3); }
        else if (round.hud) setHudText(round.hud(hudOpt));
      }
      /* QA2C-12: does the full pill fit? Not if it is cut (ellipsis) or the title has less than
         PILL_SPARE px left (one more digit would cut it). The top bar is read once per new shape of
         the text (its digits read as 0: the clock ticking is the same shape), never every frame;
         pillOk is emptied when the width changes (resize). A pill not laid out counts as fitting */
      function pillFits() {
        var shape = hudText.replace(/\d/g, '0');
        if (pillOk[shape]) return true;
        var cw = hudEl.clientWidth;
        if (!(cw > 0)) return true;
        var room = Infinity;
        if (ttlEl && ttlEl.getClientRects && ttlEl.getClientRects().length) room = ttlEl.getBoundingClientRect().width;
        if (hudEl.scrollWidth > cw + 1 || room < PILL_SPARE) return false;
        pillOk[shape] = true;
        return true;
      }
      function drawIdle() {
        begin();
        if (def.idle) def.idle(ctx, cfg); else { ctx.fillStyle = '#2a1b5e'; ctx.fillRect(0, 0, def.LW, def.LH); }
        ctx.restore();
        setHudText('');
      }

      /* ---------- input ---------- */
      var keyMap = def.keys || {};
      window.addEventListener('keydown', function (e) {
        /* the Exit check is up: Esc keeps playing, Tab stays in the card, Enter / Space press its
           focused button, and the round hears nothing */
        if (askEl) {
          if (e.key === 'Tab') keepTab(e);
          else if (e.key === 'Escape') { e.preventDefault(); keepPlaying(); }
          return;
        }
        if (e.key === 'Tab') { keepTab(e); return; }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (phase === 'playing' || phase === 'countdown') { e.preventDefault(); pause(); } return; }
        var id = keyMap[e.key];
        if (!id) return;
        if (phase !== 'playing' && phase !== 'countdown') return;   /* let Enter/Space press the focused button */
        if (live && screen) return;                                 /* …and on a sheet a live round put up (round.onPause) */
        e.preventDefault();
        if (!held[id]) { held[id] = true; if (phase === 'playing' && round && round.input) round.input(id, true); renderTouchHeld(); }
      }, sig);
      window.addEventListener('keyup', function (e) {
        var id = keyMap[e.key]; if (!id) return;
        if (held[id]) { held[id] = false; if (round && round.input) round.input(id, false); renderTouchHeld(); }
      }, sig);
      /* E5: Tab and Shift+Tab go round the game's own buttons and never out to the page */
      function keepTab(e) {
        if (exited) return;
        var box = askEl || root;                          /* the Exit check's card while it is up */
        var list = tabStops(box), a = document.activeElement, inside = !!a && a !== box && box.contains(a);
        if (!list.length) { e.preventDefault(); try { root.focus({ preventScroll: true }); } catch (x) {} return; }
        var first = list[0], last = list[list.length - 1];
        if (!inside || (e.shiftKey ? a === first : a === last)) {
          e.preventDefault();
          try { (e.shiftKey ? last : first).focus({ preventScroll: true }); } catch (x) {}
        }
      }
      function toLogical(e) {
        var r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale };
      }
      canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (phase !== 'playing' || !round) return;
        var p = toLogical(e);
        if (round.pointer) round.pointer('down', p.x, p.y);
        else if (def.tapAction) { held[def.tapAction] = true; round.input(def.tapAction, true); setTimeout(function () { held[def.tapAction] = false; if (round) round.input(def.tapAction, false); }, 120); }
      }, sig);
      canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false, signal: ac.signal });
      var touchHost = root.querySelector('#slgTouch');
      function renderTouch(show) {
        touchHost.innerHTML = '';
        pads = [];
        var controls = def.controlsFor ? def.controlsFor(cfg) : def.controls;
        if (!show || !controls) return;
        var left = el('div', 'grp'), right = el('div', 'grp');
        controls.forEach(function (c) {
          var b = el('button', 'slg-pad' + (c.wide ? ' wide' : ''), c.label);
          b.type = 'button'; b.dataset.ctl = c.id; b.setAttribute('aria-label', c.aria || c.label);
          function down(e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) {} if (phase !== 'playing' && phase !== 'countdown') return; held[c.id] = true; if (phase === 'playing' && round && round.input) round.input(c.id, true); renderTouchHeld(); }
          function up(e) { e.preventDefault(); if (held[c.id]) { held[c.id] = false; if (round && round.input) round.input(c.id, false); renderTouchHeld(); } }
          b.addEventListener('pointerdown', down, sig);
          b.addEventListener('pointerup', up, sig);
          b.addEventListener('pointercancel', up, sig);
          b.addEventListener('lostpointercapture', up, sig);
          b.addEventListener('contextmenu', function (e) { e.preventDefault(); }, sig);
          (c.side === 'left' ? left : right).appendChild(b);
          pads.push({ b: b, id: c.id, st: null });
        });
        touchHost.appendChild(left); touchHost.appendChild(right);
      }
      function renderTouchHeld() { pads.forEach(function (p) { p.b.classList.toggle('on', !!held[p.id]); }); }

      /* ---------- exit / cleanup ---------- */
      var exited = false;
      function exit() {
        if (exited) return; exited = true;
        askEl = null; askFocus = null; askShut = []; askHid = null;   /* the card goes with the game */
        stopLoop(); stopIdle(); unwatchQuality(); clearTimeout(liveTimer); liveTimer = 0;
        if (v3) { try { v3.dispose(); } catch (e) {} if (v3.canvas && v3.canvas.parentNode) v3.canvas.parentNode.removeChild(v3.canvas); v3 = null; }
        if (hudObj) { try { hudObj.dispose(); } catch (e) {} hudObj = null; }
        mus('stop', 200);
        /* a live round's session may have to go on with no screen (the others are still racing) */
        if (round && typeof round.detach === 'function') { try { round.detach(); } catch (e) {} }
        if (round && round.dispose) round.dispose();
        round = null;
        ac.abort();
        if (ro) ro.disconnect();
        root.remove();
        /* the page comes back: no longer inert, and the focus goes back where it was (the
           host may move it on in onExit) */
        openBehind(behind); behind = [];
        try {
          if (prevFocus && prevFocus !== document.body && prevFocus.isConnected !== false && !prevFocus.disabled && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true });
        } catch (e) {}
        prevFocus = null;
        if (cfg.arcade) cfg.arcade.flush();
        if (cfg.onExit) cfg.onExit();
      }
      /* during a round 🏝️ Exit asks first (the Exit check); anywhere else it leaves at once */
      root.querySelector('#slgExit').addEventListener('click', askLeave, sig);

      var api = { sound: sound, reduced: reduced, LW: def.LW, LH: def.LH };
      api.music = (window.SLMusic && typeof SLMusic.channel === 'function') ? (function () { try { return SLMusic.channel({ muted: cfg.muted }); } catch (e) { return null; } })() : null;
      /* API 2: what a game's own sheets (def.onMenuButton) and live rounds may ask of the shell */
      var ctl = {
        screen: setScreen,
        /* an empty sheet's content element, to fill with DOM nodes (its parent is the sheet) */
        sheet: function () { return setScreen('', true).firstChild; },
        menu: menu, exit: exit, phase: function () { return phase; }, banner: setBanner, say: say, esc: esc, sound: sound,
        /* shows a course in the 3D backdrop without choosing it → false in 2D or during a round */
        preview: function (v) {
          if (!v3 || !v3.setRound || phase === 'playing' || phase === 'countdown' || phase === 'paused') return false;
          try { v3.setRound(null, v); } catch (e) { fail3d('setRound'); return false; }
          return true;
        },
        beginRound: beginRound
      };

      /* ---------- optional 3D view (falls back to the 2D canvas silently) ---------- */
      function can3d() {
        if (!def.view3d || cfg.demo || v3failed) return false;
        try { if (localStorage.getItem('slNo3D') === '1' || sessionStorage.getItem('slNo3dGame') === '1') return false; } catch (e) {}
        /* the stage already judged this device 2D (too slow, lost contexts, no 3D):
           don't open a second WebGL context the island just gave up on */
        if (verdict2d(window)) return false;
        if (!importMaps(window)) return false;           /* compat-1: no import maps, no three */
        return typeof WebGL2RenderingContext !== 'undefined' && typeof window.slLoad3D === 'function';
      }
      function load3d() {
        if (!can3d()) return Promise.resolve(null);
        var v = window.SL_WORLD_VER || '1';
        try { if (localStorage.getItem('slQaMode') === '1') v += '&qa=' + Date.now(); } catch (e) {}
        var url = new URL(def.view3d.src + '?v=' + v, document.baseURI).href;
        var p = window.slLoad3D().then(function (T) {
          if (!T) return null;
          return new Function('u', 'return import(u)')(url).then(function (m) { return (m && m.create) ? { THREE: T, m: m } : null; });
        });
        var to = new Promise(function (res) { setTimeout(function () { res(null); }, 8000); });
        return Promise.race([p, to]).catch(function () { return null; });
      }
      function mount3d() {
        if (v3 || !v3mod || v3failed || exited || !can3d()) return;   /* the verdict may have changed since load */
        try {
          var made = v3mod.m.create(mid, { THREE: v3mod.THREE, cfg: cfg, api: api, def: def, reduced: reduced, onFail: fail3d });
          Promise.resolve(made).then(function (vw) {
            if (exited || v3failed || !vw || !vw.canvas) { if (vw && vw.dispose) try { vw.dispose(); } catch (e) {} return; }
            v3 = vw;
            v3.canvas.classList.add('slg-gl');
            mid.insertBefore(v3.canvas, canvas);
            canvas.style.opacity = '0';                 /* the 2D canvas stays on top as the tap target */
            var r = mid.getBoundingClientRect();
            v3.resize(r.width, r.height);
            if (v3.setRound) v3.setRound(round, (phase === 'menu' || phase === 'tutorial' || phase === 'timeup') ? variant : rVariant);
            playPace.reset(); watch.reset(); lastDrawAt = performance.now(); watchQuality();
            cfg.view3d = true;
            if (phase === 'playing' || phase === 'countdown') draw();
            else if (phase === 'menu' && screen === menuSc) menu();
            else { if (phase === 'menu' && v3.setRound) v3.setRound(null, variant); startIdle(); }   /* a game's own sheet (boards, a lobby) stays up */
          }).catch(function () { fail3d('create'); });
        } catch (e) { fail3d('create'); }
      }
      /* a stage quality step (SL3D.onQuality) restarts the shell's watchdog: the stage
         gets to finish its own ladder (and its own 2D verdict) first */
      function watchQuality() {
        unwatchQuality();
        try { var S = window.SL3D; if (S && typeof S.onQuality === 'function') unsubQ = S.onQuality(function () { watch.reset(); }); } catch (e) { unsubQ = null; }
      }
      function unwatchQuality() { if (unsubQ) { try { unsubQ(); } catch (e) {} unsubQ = null; } }
      function fail3d(reason) {
        v3failed = true; stopIdle(); unwatchQuality();
        if (v3) { try { v3.dispose(); } catch (e) {} if (v3.canvas && v3.canvas.parentNode) v3.canvas.parentNode.removeChild(v3.canvas); v3 = null; }
        canvas.style.opacity = '';
        if (reason !== 'qa') { try { sessionStorage.setItem('slNo3dGame', '1'); } catch (e) {} }
        if (!exited) draw();
      }
      if (def.hud && def.hud.mount) { try { hudObj = def.hud.mount(mid, cfg, api); } catch (e) { hudObj = null; } }
      if (hudObj) hudEl.style.display = 'none';
      /* QA2C-15: the top bar's text pill shows round.hud() over a 2D canvas, so a game draws no
         second HUD of the same numbers there (api.hudPill) */
      api.hudPill = !hudObj;

      var ready3d = load3d().then(function (m) { v3mod = m; if (!m) cfg.view3d = false; });
      /* E7: def.preload (a throw, a rejection, or nothing for PRELOAD_MS) never leaves the child
         on 'Loading…' for good: 'Couldn’t start' offers Try again (preload once more) and Back.
         The 3D wait is brief, so the menu can open in 3D; a slow load just keeps 2D */
      var startTry = 0;
      function startUp() {
        var mine = ++startTry, timer = 0;
        setScreen('<p>Loading…</p>');
        var pre;
        try { pre = Promise.resolve(def.preload ? def.preload(cfg) : null); } catch (e) { pre = Promise.reject(e); }
        var dead = new Promise(function (res, rej) { timer = setTimeout(function () { timer = 0; rej(new Error('preload: no answer')); }, PRELOAD_MS); });
        var ready = Promise.race([pre, dead]);
        ready.then(function () { clearTimeout(timer); }, function () { clearTimeout(timer); });
        Promise.all([ready, Promise.race([ready3d, new Promise(function (r) { setTimeout(r, 2500); })])]).then(function () {
          if (exited || mine !== startTry) return;
          resize(); menu();
          if (v3mod) mount3d(); else ready3d.then(function () { if (!exited && v3mod && !v3) mount3d(); });
        }, function () {
          if (exited || mine !== startTry) return;
          cantStart();
        });
      }
      function cantStart() {
        phase = 'menu'; renderTouch(false);
        var sc = setScreen('<div class="slg-emo">😕</div><h2>Couldn’t start</h2><p>The game didn’t load. Check the internet, then try again.</p>' +
          '<div class="row"><button class="slg-b go" type="button" id="slgRetry">↻ Try again</button><button class="slg-b alt" type="button" id="slgLoadBack">🏝️ Back</button></div>');
        sc.querySelector('#slgRetry').addEventListener('click', startUp);
        sc.querySelector('#slgLoadBack').addEventListener('click', exit);
        say('Couldn’t start. Try again, or go back.');
      }
      startUp();

      /* optional leaderboards: one async script tag per page (never for a shop preview);
         the open menu gains its button when the file lands. A tag that failed to load is
         taken out again, so the next game can ask once more */
      if (!cfg.demo) {
        if (window.SLBoards) boardsReady();
        else {
          var bjs = document.getElementById('slBoardsJs');
          if (!bjs) {
            bjs = document.createElement('script'); bjs.id = 'slBoardsJs'; bjs.async = true;
            bjs.src = 'world/games/boards.js?v=' + (window.SL_WORLD_VER || '1');
            bjs.addEventListener('error', function () { bjs.remove(); });
            document.head.appendChild(bjs);
          }
          bjs.addEventListener('load', boardsReady, sig);
        }
      }

      /* QA hook (inert unless localStorage.slQaMode === '1') */
      try {
        if (localStorage.getItem('slQaMode') === '1') {
          window._slGame = { phase: function () { return phase; }, round: function () { return round; }, advance: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) advance(0.05); draw(); }, beginRound: beginRound, pause: pause, exit: exit, variant: function () { return variant; }, view: function () { return v3 ? '3d' : '2d'; }, v3: function () { return v3; }, force2d: function () { fail3d('qa'); }, hud: function () { return hudObj; }, watch: function () { return watch.stats(); }, asking: function () { return !!askEl; }, askLeave: askLeave, ended: roundEnded };
          /* always the live held-input object (beginRound replaces it) */
          Object.defineProperty(window._slGame, 'held', { get: function () { return held; } });
        }
      } catch (e) {}
      return { exit: exit };
    }

    /* ---------- non-interactive preview (shop) ---------- */
    function demo(host, opts) {
      opts = opts || {};
      var canvas = document.createElement('canvas');
      canvas.width = def.LW; canvas.height = def.LH;
      canvas.setAttribute('aria-label', 'Preview of ' + def.title);
      host.appendChild(canvas);
      var label = document.createElement('div');
      label.textContent = 'PREVIEW';
      label.style.cssText = 'position:absolute;left:10px;top:10px;background:rgba(0,0,0,.55);color:#fff;font-weight:800;font-size:12px;border-radius:999px;padding:2px 10px;';
      host.appendChild(label);
      var ctx = canvas.getContext('2d');
      var cfg = { variant: opts.variant || null, pet: opts.pet || { id: 'pet_puppy', name: 'Biscuit', acc: {} }, ball: null, stadium: null, kart: null, demo: true, reduced: true };
      var api = { sound: function () {}, reduced: true, LW: def.LW, LH: def.LH };
      var round = null, raf = 0, last = 0, t = 0, acc = 0, stopped = false;
      Promise.resolve(def.preload ? def.preload(cfg) : null).then(function () {
        if (stopped) return;
        round = def.newRound(api, cfg.variant || def.defaultVariant, cfg);
        if (def.countdown && round.skipCountdown) round.skipCountdown();
        last = performance.now();
        raf = requestAnimationFrame(loop);
      });
      function loop(now) {
        var dt = Math.min(MAX_FRAME, (now - last) / 1000); last = now; t += dt;
        acc += dt;
        while (acc >= STEP) { if (round.autopilot) round.autopilot(STEP); round.step(STEP, round.autoHeld || {}); acc -= STEP; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        round.render(ctx);
        if (t < (opts.seconds || 7) && !round.done && !stopped) raf = requestAnimationFrame(loop);
        else { ctx.fillStyle = 'rgba(19,12,46,.6)'; ctx.fillRect(0, 0, def.LW, def.LH); ctx.fillStyle = '#fff'; ctx.font = '800 40px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(opts.endText || 'Buy it to play!', def.LW / 2, def.LH / 2); }
      }
      return function stop() { stopped = true; if (raf) cancelAnimationFrame(raf); };
    }

    var g = { start: start, demo: demo, def: def };
    window.SLGames[def.key] = g;
    return g;
  }

  /* deterministic RNG for fair, varied layouts */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /* SVG string → Image (resolves when decoded) */
  function svgImage(svgStr) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  /* API 2: the boards slot, menu buttons, ctl and live rounds; API 3: nextStep / Details,
     nextVariant, hud3d and the modal shell (see OPTIONAL HOOKS). Games test API >= n. */
  window.SLGameShell = { API: 3, define: define, rng: rng, svgImage: svgImage, STEP: STEP, makePacer: makePacer, makeFrameWatch: makeFrameWatch, verdict2d: verdict2d, REMEMBER_DAYS: REMEMBER_DAYS, importMaps: importMaps, BEAT_PULSE_HZ: BEAT_PULSE_HZ, PRELOAD_MS: PRELOAD_MS, GUARD_MS: GUARD_MS, ASK: ASK };
})();
