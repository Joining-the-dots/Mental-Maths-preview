/* ================================================================
   My Island — the named sound set (window.SLSound).
   The shell's makeSound recipes (world/games/shell.js) lifted out so the
   island and the games share one set, plus synthesised pet voices and a
   subtle stereo pan by island x. Everything plays through the app's own
   synth rack and warm SFX bus (index.html: getAudioCtx, _sfxBus, _beep,
   _slide, _pluck, _bell, _thump, _tap, _swell, playSfx, slSample) and
   respects the app's mute. Big moments duck the music (SLMusic.duck).

     var sound = SLSound.make(cfg);       cfg.muted() optional
     sound(name, vol, step, pan)          pan -1..1 (island: panFor(x, w))
     sound.at(x, width)(name, vol, step)  the same, panned by island x
     sound.pet(petId, vol, pan)           the pet's own voice (PET_VOICE: the four
                                          V4.54 pets and the ten land mascots)

   My Island v3 adds six act sounds for the sky islands (synth only, never a
   file, none of them ducks the music), each under 1 s:
     splash    falls pool: a band-passed noise burst (1.2 -> 0.6 kHz) + two drops
     creak     rope / wood: a low 180 -> 140 Hz slide with a 9 Hz wobble
     zip       zip line: a soft sine rising 600 -> 1,400 Hz, then a short fall
     chain     drawbridge: 8 soft ticks at 10 a second, alternating pitch
     squeak    penguin: a 0.12 s 1,100 -> 1,500 Hz slide; step -6..6 shifts it
               a whole tone a step (one step per penguin)
     musicbox  a 6-note phrase on SCALE; step picks it like 'voice' does:
               0 carousel (bells), 1 jig (plucked, the maypole), 2 waltz (bells)

   The land shops add 13 more, by the same rules (plan-v3 catalogAdditions.sounds):
     drum      log drums: one soft thump; step 0-2 picks 110 / 150 / 200 Hz (0.18 s)
     xylo      log xylophone: one plucked bar on SCALE; step 0-7 picks the degree
     dong      bell tower: two low bell notes 0.5 s apart, rung out by 0.9 s
   and the ten mascot voices, each a short original call (never a sample):
     click     crab: two claw taps (1,900 then 2,300 Hz) and a bubble blip
     kee       gull: two soft falling slides, never a screech
     chatter   monkey: three quick rising chirps, the last with a soft pluck
     chirrup   capybara: a low whistle 420 -> 540 Hz and two quiet clicks
     churr     squirrel: four tiny rising chirps 60 ms apart, then a slide down
     hoot      owlet: 392 Hz, then 330 Hz with a slow 5 Hz vibrato
     quack     duckling: two short nasal blips (the moat bridge's ducks reuse it)
     neigh     pony: a whinny 900 -> 1,300 -> 600 Hz (11 Hz vibrato), two hoof taps
     peep      penguin chick: two bright chirps 1,500 -> 2,000 Hz
     arf       seal pup: two soft honks with a 20 Hz wobble, then a quiet pop
   PET_VOICE maps all 14 pets to their voice. VOICE_STEPS is the pinned order
   'voice' plays by step (0-13; the first four are V4.54's, so old cues keep
   their pet): the games read it to find a pet's step.

   Classic UMD: window.SLSound in the browser, module.exports in Node
   (where create(fakeGlobal) builds an instance against stubs).
   ================================================================ */
(function (root, factory) {
  var S = factory();
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (typeof window !== 'undefined') window.SLSound = S;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- the shell's tables, copied verbatim ---- */
  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  var SAMPLE_FILES = { right: 1, wrong: 1, fanfare: 1, sting: 1, chip: 1, coins: 1, unlock: 1, applause: 1, heartbeat: 1 };
  var DUCK = { fanfare: 1, tada: 1, applause: 1, sting: 1, cheer: 1, unlock: 1 };
  var APP_SFX = { correct: 1, wrong: 1, unlock: 1, fanfare: 1, tick: 1 };

  /* every name sound() understands (shell set + pet voices) */
  var NAMES = ['right', 'wrong', 'fanfare', 'sting', 'chip', 'coins', 'unlock', 'applause', 'heartbeat',
    'correct', 'tick',
    'jump', 'coin', 'bump', 'kick', 'beep', 'go', 'check', 'pop', 'boing', 'crash', 'oof', 'powerup', 'combo',
    'whoosh', 'boost', 'miss', 'star', 'shield', 'whistle', 'save', 'skid', 'cheer', 'tada',
    'yip', 'mew', 'thump', 'trill', 'voice',
    'splash', 'creak', 'zip', 'chain', 'squeak', 'musicbox',
    'drum', 'xylo', 'dong',
    'click', 'kee', 'chatter', 'chirrup', 'churr', 'hoot', 'quack', 'neigh', 'peep', 'arf'];
  var PET_VOICE = { pet_puppy: 'yip', pet_kitten: 'mew', pet_bunny: 'thump', pet_dragon: 'trill',
    pet_crab: 'click', pet_gull: 'kee', pet_capybara: 'chirrup', pet_monkey: 'chatter', pet_squirrel: 'churr',
    pet_owl: 'hoot', pet_duckling: 'quack', pet_pony: 'neigh', pet_penguin: 'peep', pet_seal: 'arf' };
  /* 'voice' with step 0-13, in the pinned order of plan-v3 catalogAdditions.sounds.voiceSteps:
     the four V4.54 pets keep steps 0-3, the mascots follow land by land */
  var VOICE_STEPS = ['yip', 'mew', 'thump', 'trill',
    'click', 'kee', 'chirrup', 'chatter', 'churr', 'hoot', 'quack', 'neigh', 'peep', 'arf'];
  var DRUM_HZ = [110, 150, 200];                           /* 'drum' with step 0-2: the three log drums */
  /* 'musicbox' with step 0-2: SCALE indexes, onsets (s) and accents; every phrase
     rings out by 0.9 s. The jig is plucked (the castle maypole), the others are bells. */
  var MUSICBOX = [
    { notes: [5, 4, 3, 4, 5, 7], at: [0, 0.12, 0.24, 0.36, 0.48, 0.6], acc: [1, 0.7, 0.7, 0.85, 0.7, 1] },        /* carousel: C A G A C E */
    { notes: [3, 2, 0, 2, 3, 5], at: [0, 0.1, 0.2, 0.3, 0.4, 0.5], acc: [1, 0.6, 0.7, 1, 0.6, 0.8], pluck: true }, /* jig: two groups of three */
    { notes: [7, 5, 5, 6, 4, 4], at: [0, 0.15, 0.3, 0.45, 0.6, 0.75], acc: [1, 0.55, 0.55, 1, 0.55, 0.55] }      /* waltz: ONE two three */
  ];
  var MUSICBOX_END = 0.9;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /* art bible: pan = (x / width - 0.5) x 0.6 — subtle, never hard-left/right */
  function panFor(x, width) {
    var w = +width, px = +x;
    if (!(w > 0) || !isFinite(px)) return 0;
    return Math.round((clamp(px / w, 0, 1) - 0.5) * 0.6 * 1000) / 1000;
  }
  function petVoice(petId) { return PET_VOICE[petId] || 'yip'; }

  /* build an instance that looks its helpers up on `g` (window in the browser) */
  function create(g) {
    g = g || {};
    function has(f) { return typeof g[f] === 'function'; }
    function globalMuted() {
      try {
        var u = has('currentUser') ? g.currentUser() : (has('ensureUser') ? g.ensureUser() : null);
        return !!(u && u.muted);
      } catch (e) { return false; }
    }
    function duckMusic() {
      var M = g.SLMusic;
      if (M && typeof M.duck === 'function') { try { M.duck(0.4, 350); } catch (e) {} }
    }

    /* ---- stereo pan: helpers look their bus up via _sfxBus(ctx), which returns
       ctx._slBus, so for the length of one synchronous call we point that at a
       StereoPanner feeding the real bus (echo send left as is), then restore it. */
    function pannerFor(ctx, real, pan) {
      var cache = ctx._slPanners || (ctx._slPanners = {});
      var key = String(Math.round(clamp(pan, -1, 1) * 20) / 20);       /* 41 positions max */
      if (!cache[key]) {
        var p = ctx.createStereoPanner();
        p.pan.value = +key;
        p.connect(real.input);
        cache[key] = p;
      }
      return cache[key];
    }
    function withPan(ctx, pan, fn) {
      if (!pan || typeof ctx.createStereoPanner !== 'function' || !has('_sfxBus')) return fn();
      var real = g._sfxBus(ctx);
      if (!real || !real.input) return fn();
      var node = pannerFor(ctx, real, pan);
      var had = Object.prototype.hasOwnProperty.call(ctx, '_slBus'), prev = ctx._slBus;
      ctx._slBus = { input: node, echo: real.echo };
      try { return fn(); } finally { if (had) ctx._slBus = prev; else delete ctx._slBus; }
    }
    /* the bus custom voices (mew) connect to; panned while withPan is active */
    function busOf(ctx) {
      if (has('_sfxBus')) { var b = g._sfxBus(ctx); if (b && b.input) return b; }
      return { input: ctx.destination, echo: null };
    }

    /* ---- pet voices (art bible: synthesised, original) ---- */
    function mew(ctx, t, vol) {
      var bus = busOf(ctx);
      var o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(900, t);
      o.frequency.linearRampToValueAtTime(650, t + 0.2);
      lfo.type = 'sine'; lfo.frequency.setValueAtTime(6, t);              /* 6 Hz vibrato */
      depth.gain.setValueAtTime(22, t);
      lfo.connect(depth); depth.connect(o.frequency);
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(vol, t + 0.02);
      gn.gain.setValueAtTime(vol, t + 0.14);
      gn.gain.exponentialRampToValueAtTime(0.0004, t + 0.2);
      gn.gain.linearRampToValueAtTime(0, t + 0.23);
      o.connect(gn); gn.connect(bus.input); if (bus.echo) gn.connect(bus.echo);
      o.start(t); lfo.start(t); o.stop(t + 0.25); lfo.stop(t + 0.25);
    }

    /* ---- v3 act voices the rack has no helper for ---- */
    /* the app's shared noise buffer (index.html _noiseBuf); without it, one of the same
       shape on the same cache key, filled by a fixed LCG (no randomness) */
    function noiseBuf(ctx) {
      if (has('_noiseBuf')) return g._noiseBuf(ctx);
      if (ctx._slNoise) return ctx._slNoise;
      var len = ctx.sampleRate | 0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), s = 0x2545f491;
      for (var i = 0; i < len; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; d[i] = (s >>> 8) / 8388608 - 1; }
      ctx._slNoise = buf;
      return buf;
    }
    /* splash: a noise burst whose band-pass falls f0 -> f1 Hz over dur s */
    function burst(ctx, t, dur, f0, f1, vol) {
      var bus = busOf(ctx);
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = noiseBuf(ctx);
      bp.type = 'bandpass'; bp.Q.value = 1.3;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(vol, t + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0004, t + dur);
      gn.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      src.connect(bp); bp.connect(gn); gn.connect(bus.input); if (bus.echo) gn.connect(bus.echo);
      src.start(t); src.stop(t + dur + 0.03);
    }
    /* one held voice along a pitch path [[hz, s from t], …] (creak, zip, and the held mascot
       calls): _slide's envelope dies away too fast for a 0.7 s ride. o.fade = when the fade-out
       starts (s); o.wobble = an amplitude wobble in Hz of size o.depth (the gain swings
       1 - 2 x depth .. 1); o.vib = a pitch vibrato in Hz, ± o.vibDepth Hz. */
    function glide(ctx, t, path, o) {
      var bus = busOf(ctx), end = t + path[path.length - 1][1];
      var osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), gn = ctx.createGain(), out = gn;
      osc.type = o.wave;
      osc.frequency.setValueAtTime(path[0][0], t);
      for (var i = 1; i < path.length; i++) osc.frequency.linearRampToValueAtTime(path[i][0], t + path[i][1]);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.lp, t); lp.Q.value = o.q || 0.7;
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(o.vol, t + 0.03);
      gn.gain.setValueAtTime(o.vol, t + o.fade);
      gn.gain.exponentialRampToValueAtTime(0.0004, end);
      gn.gain.linearRampToValueAtTime(0, end + 0.02);
      osc.connect(lp); lp.connect(gn);
      if (o.wobble) {
        var trem = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        trem.gain.setValueAtTime(1 - o.depth, t);
        lfo.type = 'sine'; lfo.frequency.setValueAtTime(o.wobble, t);
        depth.gain.setValueAtTime(o.depth, t);
        lfo.connect(depth); depth.connect(trem.gain);
        gn.connect(trem); out = trem;
        lfo.start(t); lfo.stop(end + 0.04);
      }
      if (o.vib) {
        var vib = ctx.createOscillator(), amount = ctx.createGain();
        vib.type = 'sine'; vib.frequency.setValueAtTime(o.vib, t);
        amount.gain.setValueAtTime(o.vibDepth, t);
        vib.connect(amount); amount.connect(osc.frequency);
        vib.start(t); vib.stop(end + 0.04);
      }
      out.connect(bus.input); if (bus.echo) out.connect(bus.echo);
      osc.start(t); osc.stop(end + 0.04);
    }
    /* drum: one soft hollow thump at f Hz, silent by dur s (the rack's _thump always rings
       0.24 s). A triangle, so the log still speaks on a phone speaker; dry, like _thump. */
    function thud(ctx, t, f, dur, vol) {
      var bus = busOf(ctx);
      var osc = ctx.createOscillator(), gn = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur * 0.6);
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(vol, t + 0.006);
      gn.gain.exponentialRampToValueAtTime(0.0004, t + dur);
      gn.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      osc.connect(gn); gn.connect(bus.input);
      osc.start(t); osc.stop(t + dur + 0.03);
    }

    /* the synth recipes, at an explicit start time t. Returns true if the name
       was handled. The shell set is copied faithfully from shell.js makeSound. */
    function recipe(ctx, name, t, v, step) {
      if (name === 'pop') { if (has('_pluck')) { g._pluck(ctx, 1320, t, { vol: 0.13 * v, dur: 0.22 }); g._pluck(ctx, 1760, t + 0.045, { vol: 0.1 * v, dur: 0.2 }); } else g._beep(ctx, 1320, t, 70, { vol: 0.12 * v }); return true; }
      if (name === 'boing') { if (has('_slide')) g._slide(ctx, 280, 760, t, 170, { wave: 'triangle', vol: 0.11 * v }); return true; }
      if (name === 'crash') { if (has('_thump')) g._thump(ctx, t, { f: 85, vol: 0.34 * v }); if (has('_tap')) { g._tap(ctx, t, { vol: 0.2 * v, f: 520 }); g._tap(ctx, t + 0.05, { vol: 0.14 * v, f: 340 }); } return true; }
      if (name === 'oof') { if (has('_slide')) g._slide(ctx, 440, 150, t, 280, { wave: 'triangle', vol: 0.16 * v }); if (has('_thump')) g._thump(ctx, t, { f: 110, vol: 0.2 * v }); return true; }
      if (name === 'powerup' || name === 'tada') { var notes = name === 'tada' ? [784, 988, 1175, 1568] : [659, 880, 1047, 1319]; notes.forEach(function (f, i) { if (has('_bell')) g._bell(ctx, f, t + i * 0.07, { vol: 0.09 * v, dur: 0.6 }); }); return true; }
      if (name === 'combo') { var k = Math.max(0, Math.min(SCALE.length - 1, step | 0)); if (has('_pluck')) { g._pluck(ctx, SCALE[k], t, { vol: 0.15 * v, dur: 0.3 }); g._pluck(ctx, SCALE[k] * 1.5, t + 0.05, { vol: 0.08 * v, dur: 0.25 }); } return true; }
      if (name === 'whoosh') { if (has('_swell')) g._swell(ctx, t, 0.32, { vol: 0.11 * v }); return true; }
      if (name === 'boost') { if (has('_swell')) g._swell(ctx, t, 0.45, { vol: 0.12 * v }); if (has('_slide')) g._slide(ctx, 180, 900, t, 420, { wave: 'sawtooth', vol: 0.05 * v }); return true; }
      if (name === 'miss') { if (has('_pluck')) { g._pluck(ctx, 220, t, { vol: 0.17 * v, dur: 0.4 }); g._pluck(ctx, 175, t + 0.13, { vol: 0.15 * v, dur: 0.45 }); } return true; }
      if (name === 'star') { if (has('_bell')) { g._bell(ctx, 1568, t, { vol: 0.08 * v, dur: 0.5 }); g._bell(ctx, 2093, t + 0.06, { vol: 0.07 * v, dur: 0.5 }); } return true; }
      if (name === 'shield') { if (has('_bell')) g._bell(ctx, 660, t, { vol: 0.1 * v, dur: 0.7 }); if (has('_slide')) g._slide(ctx, 500, 1000, t, 220, { wave: 'sine', vol: 0.06 * v }); return true; }
      if (name === 'whistle') { if (has('_slide')) { g._slide(ctx, 2100, 2350, t, 140, { wave: 'sine', vol: 0.08 * v }); g._slide(ctx, 2100, 2350, t + 0.2, 380, { wave: 'sine', vol: 0.08 * v }); } return true; }
      if (name === 'save') { if (has('_thump')) g._thump(ctx, t, { f: 70, vol: 0.3 * v }); if (has('_slide')) g._slide(ctx, 330, 140, t, 240, { wave: 'triangle', vol: 0.12 * v }); return true; }
      if (name === 'skid') { if (has('_tap')) { for (var s2 = 0; s2 < 4; s2++) g._tap(ctx, t + s2 * 0.04, { vol: 0.06 * v, f: 2400 - s2 * 300 }); } return true; }
      /* the original fixed-volume blips (the shell ignores vol for these) */
      if (name === 'jump') { g._beep(ctx, 520, t, 90, { wave: 'triangle', vol: 0.12 }); return true; }
      if (name === 'coin') { g._beep(ctx, 990, t, 60, { wave: 'sine', vol: 0.12 }); g._beep(ctx, 1320, t + 0.05, 80, { wave: 'sine', vol: 0.1 }); return true; }
      if (name === 'bump') { g._beep(ctx, 180, t, 140, { wave: 'triangle', vol: 0.18 }); return true; }
      if (name === 'kick') { g._beep(ctx, 140, t, 90, { wave: 'sine', vol: 0.3 }); return true; }
      if (name === 'beep') { g._beep(ctx, 660, t, 120, { wave: 'sine', vol: 0.15 }); return true; }
      if (name === 'go') { g._beep(ctx, 990, t, 260, { wave: 'sine', vol: 0.18 }); return true; }
      if (name === 'check') { g._beep(ctx, 880, t, 90, { wave: 'triangle', vol: 0.12 }); return true; }

      /* ---- pet voices ---- */
      if (name === 'yip') {                     /* puppy: 600->900 Hz triangle, 80 ms, twice, 60 ms gap */
        if (has('_slide')) { g._slide(ctx, 600, 900, t, 80, { wave: 'triangle', vol: 0.11 * v }); g._slide(ctx, 600, 900, t + 0.14, 80, { wave: 'triangle', vol: 0.1 * v }); }
        return true;
      }
      if (name === 'mew') { mew(ctx, t, 0.09 * v); return true; }             /* kitten: 900->650 Hz, 6 Hz vibrato */
      if (name === 'thump') {                   /* bunny: two soft thumps 90 ms apart, then a pop */
        if (has('_thump')) { g._thump(ctx, t, { f: 160, vol: 0.24 * v }); g._thump(ctx, t + 0.09, { f: 160, vol: 0.2 * v }); }
        recipe(ctx, 'pop', t + 0.2, v * 0.8, 0);
        return true;
      }
      if (name === 'trill') {                   /* dragon: rising 400->1200 Hz, a little swell, then a star */
        if (has('_slide')) g._slide(ctx, 400, 1200, t, 150, { wave: 'sine', vol: 0.09 * v });
        if (has('_swell')) g._swell(ctx, t, 0.2, { vol: 0.07 * v });
        recipe(ctx, 'star', t + 0.2, v * 0.8, 0);
        return true;
      }

      /* ---- v3 act sounds (sky-world sound.newRecipes) ---- */
      if (name === 'splash') {                  /* 0.25 s burst 1.2 -> 0.6 kHz, then two drops 80 ms apart */
        burst(ctx, t, 0.25, 1200, 600, 0.13 * v);
        if (has('_tap')) { g._tap(ctx, t + 0.12, { vol: 0.07 * v, f: 2300 }); g._tap(ctx, t + 0.2, { vol: 0.05 * v, f: 1800 }); }
        return true;
      }
      if (name === 'creak') {                   /* rope / wood: low, woody, a slow 9 Hz wobble */
        glide(ctx, t, [[180, 0], [140, 0.35]], { wave: 'sawtooth', vol: 0.05 * v, lp: 650, q: 1.6, fade: 0.25, wobble: 9, depth: 0.35 });
        return true;
      }
      if (name === 'zip') {                     /* 0.7 s soft sine 600 -> 1,400 Hz, then a short fall */
        glide(ctx, t, [[600, 0], [1400, 0.7], [1050, 0.82]], { wave: 'sine', vol: 0.07 * v, lp: 4500, fade: 0.7 });
        return true;
      }
      if (name === 'chain') {                   /* 8 soft ticks at 10 a second, alternating pitch (0.8 s) */
        if (has('_tap')) { for (var c = 0; c < 8; c++) g._tap(ctx, t + c * 0.1, { vol: (0.065 - (c % 2) * 0.012) * v, f: c % 2 ? 1250 : 1700 }); }
        return true;
      }
      if (name === 'squeak') {                  /* 0.12 s 1,100 -> 1,500 Hz; step shifts it a whole tone a step */
        var r = Math.pow(2, clamp(step | 0, -6, 6) / 6);
        if (has('_slide')) g._slide(ctx, 1100 * r, 1500 * r, t, 120, { wave: 'triangle', vol: 0.07 * v });
        return true;
      }
      if (name === 'musicbox') {                /* a 6-note phrase on SCALE, step 0-2 like 'voice' */
        var ph = MUSICBOX[clamp(step | 0, 0, MUSICBOX.length - 1)];
        ph.notes.forEach(function (k, i) {
          var at = t + ph.at[i], dur = Math.min(0.45, MUSICBOX_END - ph.at[i]);
          if (ph.pluck) { if (has('_pluck')) g._pluck(ctx, SCALE[k], at, { vol: 0.12 * ph.acc[i] * v, dur: dur }); }
          else if (has('_bell')) g._bell(ctx, SCALE[k], at, { vol: 0.07 * ph.acc[i] * v, dur: dur });
        });
        return true;
      }

      /* ---- land-shop act sounds (plan-v3 catalogAdditions.sounds) ---- */
      if (name === 'drum') {                    /* one soft thump, 0.18 s; step 0-2 picks the log: 110 / 150 / 200 Hz */
        thud(ctx, t, DRUM_HZ[clamp(step | 0, 0, DRUM_HZ.length - 1)], 0.18, 0.2 * v);
        return true;
      }
      if (name === 'xylo') {                    /* one plucked bar, 0.25 s; step 0-7 picks the degree of SCALE */
        if (has('_pluck')) g._pluck(ctx, SCALE[clamp(step | 0, 0, 7)], t, { vol: 0.15 * v, dur: 0.25 });
        return true;
      }
      if (name === 'dong') {                    /* two low bell notes 0.5 s apart (C4, then G3), rung out by 0.9 s */
        if (has('_bell')) { g._bell(ctx, 262, t, { vol: 0.12 * v, dur: 0.85 }); g._bell(ctx, 196, t + 0.5, { vol: 0.11 * v, dur: 0.4 }); }
        return true;
      }

      /* ---- mascot voices (one per species; each well under 1 s) ---- */
      if (name === 'click') {                   /* crab: two claw taps 80 ms apart, then a 90 ms bubble blip 420->880 Hz */
        if (has('_tap')) { g._tap(ctx, t, { vol: 0.09 * v, f: 1900 }); g._tap(ctx, t + 0.08, { vol: 0.08 * v, f: 2300 }); }
        if (has('_slide')) g._slide(ctx, 420, 880, t + 0.17, 90, { wave: 'sine', vol: 0.07 * v });
        return true;
      }
      if (name === 'kee') {                     /* gull: two soft falling slides (1,250->950, then 1,150->800 Hz) */
        if (has('_slide')) { g._slide(ctx, 1250, 950, t, 120, { wave: 'triangle', vol: 0.07 * v }); g._slide(ctx, 1150, 800, t + 0.15, 130, { wave: 'triangle', vol: 0.06 * v }); }
        return true;
      }
      if (name === 'chatter') {                 /* monkey: 520->820 Hz twice, then 700->1,150 Hz with a soft pluck */
        if (has('_slide')) {
          g._slide(ctx, 520, 820, t, 60, { wave: 'triangle', vol: 0.09 * v });
          g._slide(ctx, 520, 820, t + 0.09, 60, { wave: 'triangle', vol: 0.085 * v });
          g._slide(ctx, 700, 1150, t + 0.18, 80, { wave: 'triangle', vol: 0.09 * v });
        }
        if (has('_pluck')) g._pluck(ctx, 1150, t + 0.24, { vol: 0.06 * v, dur: 0.1 });
        return true;
      }
      if (name === 'chirrup') {                 /* capybara: a low whistle 420->540 Hz (160 ms), then two quiet clicks */
        if (has('_slide')) g._slide(ctx, 420, 540, t, 160, { wave: 'sine', vol: 0.1 * v });
        if (has('_tap')) { g._tap(ctx, t + 0.2, { vol: 0.05 * v, f: 1500 }); g._tap(ctx, t + 0.27, { vol: 0.045 * v, f: 1500 }); }
        return true;
      }
      if (name === 'churr') {                   /* squirrel: four 35 ms chirps 1,500->1,900 Hz, 60 ms apart, then 1,700->1,200 Hz */
        if (has('_slide')) {
          for (var q = 0; q < 4; q++) g._slide(ctx, 1500, 1900, t + q * 0.06, 35, { wave: 'triangle', vol: 0.07 * v });
          g._slide(ctx, 1700, 1200, t + 0.24, 90, { wave: 'triangle', vol: 0.07 * v });
        }
        return true;
      }
      if (name === 'hoot') {                    /* owlet: 392 Hz for 0.16 s, then 330 Hz for 0.3 s with a slow 5 Hz vibrato */
        glide(ctx, t, [[392, 0], [392, 0.16]], { wave: 'sine', vol: 0.1 * v, lp: 1600, fade: 0.1 });
        glide(ctx, t + 0.25, [[330, 0], [330, 0.3]], { wave: 'sine', vol: 0.1 * v, lp: 1600, fade: 0.2, vib: 5, vibDepth: 6 });
        return true;
      }
      if (name === 'quack') {                   /* duckling: two short nasal blips (620->430, then 560->400 Hz), quiet */
        if (has('_slide')) { g._slide(ctx, 620, 430, t, 90, { wave: 'sawtooth', vol: 0.05 * v }); g._slide(ctx, 560, 400, t + 0.15, 90, { wave: 'sawtooth', vol: 0.045 * v }); }
        return true;
      }
      if (name === 'neigh') {                   /* pony: a soft whinny 900->1,300->600 Hz (11 Hz vibrato), then two hoof taps */
        glide(ctx, t, [[900, 0], [1300, 0.12], [600, 0.4]], { wave: 'triangle', vol: 0.07 * v, lp: 3200, fade: 0.28, vib: 11, vibDepth: 45 });
        if (has('_tap')) { g._tap(ctx, t + 0.44, { vol: 0.08 * v, f: 700 }); g._tap(ctx, t + 0.54, { vol: 0.07 * v, f: 620 }); }
        return true;
      }
      if (name === 'peep') {                    /* penguin chick: two bright 70 ms chirps 1,500->2,000 Hz, 90 ms apart */
        if (has('_slide')) { g._slide(ctx, 1500, 2000, t, 70, { wave: 'triangle', vol: 0.07 * v }); g._slide(ctx, 1500, 2000, t + 0.16, 70, { wave: 'triangle', vol: 0.065 * v }); }
        return true;
      }
      if (name === 'arf') {                     /* seal pup: two soft 110 ms honks 330->250 Hz with a 20 Hz wobble, then a quiet pop */
        glide(ctx, t, [[330, 0], [250, 0.11]], { wave: 'triangle', vol: 0.1 * v, lp: 1400, fade: 0.07, wobble: 20, depth: 0.3 });
        glide(ctx, t + 0.15, [[330, 0], [250, 0.11]], { wave: 'triangle', vol: 0.09 * v, lp: 1400, fade: 0.07, wobble: 20, depth: 0.3 });
        if (has('_pluck')) g._pluck(ctx, 1320, t + 0.31, { vol: 0.06 * v, dur: 0.1 });
        return true;
      }

      /* ---- quiet synth stand-ins for produced samples that have not decoded yet
         (the shell is silent here; the island uses these names constantly) ---- */
      if (name === 'chip') { if (has('_tap')) g._tap(ctx, t, { vol: 0.1 * v, f: 2100 }); if (has('_pluck')) g._pluck(ctx, 1568, t + 0.01, { vol: 0.06 * v, dur: 0.12 }); return true; }
      if (name === 'coins') { if (has('_bell')) { g._bell(ctx, 1319, t, { vol: 0.07 * v, dur: 0.35 }); g._bell(ctx, 1760, t + 0.07, { vol: 0.07 * v, dur: 0.4 }); g._bell(ctx, 2093, t + 0.14, { vol: 0.06 * v, dur: 0.45 }); } return true; }
      if (name === 'sting') {
        if (has('_brass')) { [523, 659, 784].forEach(function (f) { g._brass(ctx, f, t, 0.32, { vol: 0.07 * v }); }); }
        if (has('_bell')) g._bell(ctx, 1047, t + 0.05, { vol: 0.08 * v, dur: 0.8 });
        return true;
      }
      if (name === 'applause') {                /* a patter of soft claps, fixed offsets (no randomness) */
        if (has('_tap')) { for (var a = 0; a < 12; a++) g._tap(ctx, t + a * 0.045 + (a % 3) * 0.011, { vol: (0.07 - a * 0.004) * v, f: 1300 + (a * 397) % 1100 }); }
        return true;
      }
      if (name === 'heartbeat') { if (has('_thump')) { g._thump(ctx, t, { f: 72, vol: 0.3 * v }); g._thump(ctx, t + 0.18, { f: 64, vol: 0.22 * v }); } return true; }
      if (name === 'right') { if (has('playSfx')) g.playSfx('correct'); return true; }
      return false;
    }

    function play(name, vol, step) {
      if (name === 'cheer') name = 'applause';
      if (name === 'voice') { name = VOICE_STEPS[clamp(step | 0, 0, VOICE_STEPS.length - 1)]; step = 0; }
      /* duck before the app-sfx early return, so fanfare and unlock duck too */
      if (DUCK[name]) duckMusic();
      if (APP_SFX[name]) { if (has('playSfx')) g.playSfx(name); return; }
      /* only real sample files go to slSample — anything else would 404 on audio/sfx/<name>.mp3 */
      if (SAMPLE_FILES[name] && has('slSample') && g.slSample(name, vol == null ? 0.8 : vol)) return;
      if (has('getAudioCtx') && has('_beep')) {
        var ctx = g.getAudioCtx(); if (!ctx) return;
        var t = ctx.currentTime, v = vol == null ? 1 : Math.max(0.1, Math.min(1.5, vol));
        recipe(ctx, name, t, v, step);
      }
    }

    function make(cfg) {
      cfg = cfg || {};
      function muted() {
        try { return typeof cfg.muted === 'function' ? !!cfg.muted() : globalMuted(); } catch (e) { return false; }
      }
      function sound(name, vol, step, pan) {
        try {
          if (muted()) return;
          var p = +pan || 0;
          if (p && has('getAudioCtx')) {
            var ctx = g.getAudioCtx();
            if (ctx) { withPan(ctx, p, function () { play(name, vol, step); }); return; }
          }
          play(name, vol, step);
        } catch (e) {}
      }
      sound.at = function (x, width) {
        var p = panFor(x, width);
        return function (name, vol, step) { sound(name, vol, step, p); };
      };
      sound.pet = function (petId, vol, pan) { sound(petVoice(petId), vol, 0, pan); };
      sound.muted = muted;
      return sound;
    }

    var plain = null;
    return {
      make: make,
      /* one-off convenience bound to the app's own mute */
      play: function (name, vol, step, pan) { (plain || (plain = make({})))(name, vol, step, pan); },
      panFor: panFor, petVoice: petVoice,
      NAMES: NAMES, PET_VOICE: PET_VOICE, VOICE_STEPS: VOICE_STEPS, DUCK: DUCK, SCALE: SCALE, SAMPLE_FILES: SAMPLE_FILES,
      create: create
    };
  }

  var G = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  return create(G);
}));
