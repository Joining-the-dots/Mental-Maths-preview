/* ================================================================
   My Island 3D — motion timelines (pure; no DOM, no THREE).
   window.SLMotion in the browser, module.exports in Node.
   Every idle loop and every act is a pure function of time, so the
   same t always gives the same pose: frame-rate independent, testable,
   and allocation-free in the frame loop (pass an `out` object to reuse).
   Easing reuses SLGameFX.ease (world/games/fx.js) when it is present.

   API (frozen contract):
     MAX_FLASH_HZ = 2 · safeHz(hz) · ease{...} · clamp · lerp · smoothstep · frac
     hash(str) · phaseOf(uid) → [0, 1)  (same FNV-1a as SLGrid3D.hash01)
     beatInfo(t, bpm, t0, out) → {beat, frac, bar, beatInBar, count}  (count 1..8)
   IDLE (reduced = true gives the static pose):
     sway(t, deg, period, phase, reduced, out) → {x, z} degrees about the base
     bob(t, pct, period, phase, reduced) → scale
     spin(t, rps, phase, reduced) → degrees
     flutter(t, amp, hz, u, phase, reduced) → cloth offset (u = 0 at the pole … 1 free edge)
     pennant(t, i, deg, hz, phase, reduced) → degrees
     every(t, minGap, maxGap, seed, out) → {n, t0, since, next}  (gaps always in [min, max])
     blink(t, seed, minGap, maxGap, reduced) → eye openness 0..1
     pulse(beatFrac, pct, reduced) → scale (once per beat)
     twinkle(t, hz, phase, reduced) · chase(t, i, hz, groups, reduced) ·
       chaseWave(t, d, speed, spacing, reduced) · glint(t, period, n, phase, reduced)   → 0..1 light
     smoke(t, i, n, period, phase, reduced, out) → {y, s, a}
     drop(t, i, n, streams, period, phase, reduced, out) → {x, y, z, a}   fountain trickle
     idleBubble(t, k, every, phase, reduced, out) → {x, y, z, r, a}
     petal(t, i, seed, reduced, out) → {x, y, z, rot, a}
     snowSparkle(t, i, n, phase, reduced, out) → {x, y, z, a}
     avatarBob(t, phase, reduced) → dy · beamAngle(t, rps, phase, reduced) → deg
     beamColor(t, every, n, out) → {i, j, k} · coneSweep(t, i, reduced) → deg · drift(t, speed, span, offset)
     bubbleTrack(age, seed, out) → {x, y, z, r, a, popped}
   ACTS (each ≤ 3 s; the swing's decay and the v3 landmark acts are the exceptions):
     ACTS[name] = {name, dur, reducedDur, end, endReduced?, mod?, hold?, keys, cues, reducedCues, sample}
     sample(name, t, out, o) → out      o = {reduced, from, lead, off}
     carry(name, out) → from            hand an interrupted act's pose to its restart
     cues(name, o) → [{t, sfx, vol, step} | {t, emit, n}]
     durOf(name, o) · actFor(catalogAct, id, lit) → act name
     names: squish dropIn store glowOn glowOff flag bunting spin swing splash bounce
            bubbles launch kartRev home homeClose debut hop
            city buildings (3 s; 'screen' 0.5 s; reduced = the instant end state):
            snap {bulbs, bloom, strip, curtain} · serve {hatch, cup, cupA, swirl} ·
            screen {wipe, band, prog} · record {onAir, level} · dance {chase, pump} ·
            hangout {scope, wave, squish} · encore {wall, heads, chase, beams}
            (a cue with pet: true is the active pet's voice: SLSound 'voice' at that pet's step)
     ripple(u, front, amp) → bunting pennant extra degrees
     ON_AIR_SEC (4) · STRIP_SEC (6) · RATE {bloom 1.5, screen 0.5} · allow(lastT, t, gap) → bool
     vu(i, beat, beatFrac, level, reduced) → bar height · diagChase(cx, cz, beat, beatFrac, groups,
       reduced) → tile light · wave(t, i, n, hz, level, reduced) → bulb light (≤ ±35%)
            sky-island acts (My Island v3; spec.v3, spec.maxSec; reduced = the end state at once):
            ride {deg, bob} · slide {climb, slide} · open / close {deg} · wobble {cross, amp} ·
            skate {lap, glide} · wheel {deg, bulbs} · lift {basket, lamps} · zip {climb, zip, wave} ·
            drawbridge / drawbridgeUp {down, banners, trot} · penguins {p0, p1, p2, rock}
            (landmarks wheel lift zip drawbridge penguins ≤ 6 s; the rest ≤ 3 s; landmark drops
            reuse 'dropIn')
     V3_ACTS · LANDMARK_BUSY {wheel 6, lift 4, zip 4, drawbridge 4, penguins 6} (s: the host's
       re-tap guard) · freq(name) → Hz (SLIslandLook.ART3.FREQS, else the contract value) ·
       wheelBulb(t, i, n, reduced) → spoke bulb light · wobbleDeg(t, i, n, s, reduced) → plank tilt ·
       penguinLeg(u) → {leg, k} (0 to the door · 1 inside · 2 up to the ramp top · 3 belly slide)
     bridgeBuild(tSec, lengthU, reduced, out) → {segments, total, stagger, done, scaleAt(i),
       startAt(i), span(i, out) → {u0, u1} (0 = the Home gate), cues()}  a land's bridge build
       (BRIDGE_BUILD {seg 0.5, each 0.12, perU 0.22, maxSec 2.4, coinEvery 4, coinHz 4})
            land-shop acts (My Island v3 wave 1b; spec.themed; ≤ 3 s; reduced = the end state at once):
            every one samples {k, swing, bob, petT} (k 0 → 1 progress · swing −1 … 1 · bob 0 … 1 ·
            petT the pet's 0 → 1), built by defThemed from one table. spec = {kind, toggle, pet, of,
            rates, lag, parts, each, end, endOff?, offDur?, offCues?}; kinds path spin swing pop
            toggle fx.
            Pier: mirrors droptower teacups chairs swingship train dodgems flume coaster floss
            popcorn scoop* lounge liftoff · Jungle: canoe climb camp bars drum bloom* rock coconut
            juggle chirp · Treetop: feed chime peek* crawl balance seesaw spy scramble leap zipline ·
            Castle: rustle knock (fx) bucket salute royal toss ducks bell joust maze spout · Ice:
            shake waddle fish pose popup sing chairlift lights* · and glow* (0.3 s fade), wave (a
            1.6 s sway), so every SLWorldCore.ACTS key has a timeline.
            * a remembered toggle: one timeline both ways; o.off = true plays it shut / dark
              (durOf and cues take the same o; end = on, endOff = off).
            An item with its own show under a shared act: climbDeck (treetop_platform), climbSlide
            (jungle_den), chimeTurn (ice_sculpture), shakeGlobe (ice_snowglobe); actFor picks by id.
            cues('chime', {tune}) plays CHIME_TUNES[tune % 3] (five 'xylo' notes).
     THEMED_ACTS (every name above) · THEMED_KINDS · CHIME_TUNES · part(name, k, i) → 0..1 (bud i of
       'bloom', lantern row i of 'lights': its own level for the toggle's k)
   SCENE TIMELINES:
     showMix(t, k0, target, reduced) → k · landRise(t, delay, reduced, out) → {y01, a} ·
     riseDur(n) · crane(t, reduced, out) → {k, elev} · pushIn(t, reduced) · orbit(t, reduced)
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var fx = null, look = null;
    try { fx = require('../games/fx.js'); } catch (e) { fx = null; }
    try { look = require('../world-look.js'); } catch (e) { look = null; }
    module.exports = factory(root, fx, look);
  } else root.SLMotion = factory(root, null, null);
}(typeof self !== 'undefined' ? self : this, function (root, FX0, L0) {
  'use strict';

  var MAX_FLASH_HZ = 2;
  var PI = Math.PI, TAU = PI * 2;

  /* ---------------- maths ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smoothstep(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function frac(v) { return v - Math.floor(v); }
  function safeHz(hz) { return hz > MAX_FLASH_HZ ? MAX_FLASH_HZ : hz < 0 ? 0 : hz; }

  var ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    inSine: function (t) { return 1 - Math.cos(t * PI / 2); },
    outSine: function (t) { return Math.sin(t * PI / 2); },
    inOutSine: function (t) { return -(Math.cos(PI * t) - 1) / 2; },
    inBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * PI) / 3) + 1; }
  };
  /* the games' shared juice module wins where it defines the same curve */
  var FXM = FX0 || (root && root.SLGameFX) || null;
  if (FXM && FXM.ease) Object.keys(FXM.ease).forEach(function (k) { if (typeof FXM.ease[k] === 'function') ease[k] = FXM.ease[k]; });

  /* FNV-1a 32-bit, identical to SLGrid3D.hash */
  function hash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function phaseOf(uid) { return hash(uid) / 4294967296; }
  /* integer mix of (seed, n) → [0, 1) without allocating */
  function mix01(seed, n) {
    var h = (seed ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function seedOf(s) { return typeof s === 'number' ? (s >>> 0) : hash(s); }

  function beatInfo(t, bpm, t0, out) {
    out = out || {};
    var b = (t - (t0 || 0)) * bpm / 60, n = Math.floor(b);
    out.beat = n; out.frac = b - n;
    out.bar = Math.floor(n / 4); out.beatInBar = ((n % 4) + 4) % 4;
    out.count = ((n % 8) + 8) % 8 + 1;
    return out;
  }

  /* ---------------- idle loops ---------------- */
  function sway(t, deg, period, phase, reduced, out) {
    out = out || {};
    if (reduced) { out.x = 0; out.z = 0; return out; }
    var a = TAU * (t / period + (phase || 0));
    out.z = deg * Math.sin(a);
    out.x = deg * 0.3 * Math.cos(a);          /* a slight ellipse reads as wind, not a metronome */
    return out;
  }
  function bob(t, pct, period, phase, reduced) {
    return reduced ? 1 : 1 + pct / 100 * Math.sin(TAU * (t / period + (phase || 0)));
  }
  function spin(t, rps, phase, reduced) {
    return reduced ? frac(phase || 0) * 360 : frac(t * rps + (phase || 0)) * 360;
  }
  function flutter(t, amp, hz, u, phase, reduced) {
    if (reduced) return 0;
    return amp * u * Math.sin(TAU * (hz * t + (phase || 0)) - u * 2.4);
  }
  function pennant(t, i, deg, hz, phase, reduced) {
    return reduced ? 0 : deg * Math.sin(TAU * (hz * t + (phase || 0)) + i * 0.9);
  }
  /* event n happens at (n + phase)·mean + j(n) with |j| ≤ spread/2, so every gap is in [min, max] */
  function eventAt(n, s, ph, mean, spread) { return (n + ph) * mean + (mix01(s, n) - 0.5) * spread; }
  function every(t, minGap, maxGap, seed, out) {
    out = out || {};
    var mean = (minGap + maxGap) / 2, spread = (maxGap - minGap) / 2, s = seedOf(seed), ph = mix01(s, -1);
    var n = Math.floor(t / mean - ph) + 1;
    while (eventAt(n, s, ph, mean, spread) > t) n--;
    out.n = n; out.t0 = eventAt(n, s, ph, mean, spread); out.since = t - out.t0; out.next = eventAt(n + 1, s, ph, mean, spread);
    return out;
  }
  var _ev = {};
  function blink(t, seed, minGap, maxGap, reduced) {
    if (reduced) return 1;
    every(t, minGap == null ? 5 : minGap, maxGap == null ? 9 : maxGap, seed, _ev);
    var d = 0.18;
    return _ev.since < d ? 1 - Math.sin(PI * _ev.since / d) : 1;
  }
  /* lit lanterns/mushrooms on the music beat: one smooth swell per beat (≤ 1.97 Hz at 118 BPM) */
  function pulse(beatFrac, pct, reduced) {
    return reduced ? 1 : 1 + pct / 100 * Math.cos(TAU * beatFrac);
  }
  function twinkle(t, hz, phase, reduced) {
    if (reduced) return 0.85;
    return 0.5 + 0.5 * Math.sin(TAU * (safeHz(hz) * t + (phase || 0)));
  }
  /* bulb i of a chase advancing `hz` steps a second; each bulb lights once per `groups` steps */
  function chase(t, i, hz, groups, reduced) {
    if (reduced) return 0.8;
    var g = Math.max(1, groups | 0), local = ((t * safeHz(hz) - i) % g + g) % g;
    return 0.25 + 0.75 * (local < 1 ? Math.sin(PI * local) : 0);
  }
  /* the Showtime path runway: a pulse travelling `speed` cells/s, one every `spacing` cells */
  function chaseWave(t, d, speed, spacing, reduced) {
    if (reduced) return 0.8;
    var sp = Math.max(spacing, speed / MAX_FLASH_HZ), local = frac((t * speed - d) / sp) * sp;
    return 0.25 + 0.75 * (local < 1 ? Math.sin(PI * local) : 0);
  }
  /* n soft sheen sweeps (0.4 s each, 0.6 s apart) at the start of every period */
  function glint(t, period, n, phase, reduced) {
    if (reduced) return 0;
    var local = frac(t / period + (phase || 0)) * period;
    for (var i = 0; i < n; i++) {
      var s = local - i * 0.6;
      if (s >= 0 && s < 0.4) return Math.sin(PI * s / 0.4);
    }
    return 0;
  }
  function smoke(t, i, n, period, phase, reduced, out) {
    out = out || {};
    var p = reduced ? (i + 0.5) / n : frac(t / period + (phase || 0) + i / n);
    out.y = 0.6 * p; out.s = 1 + 0.8 * p; out.a = reduced ? 0.6 : Math.sin(PI * p) * 0.9;
    return out;
  }
  function drop(t, i, n, streams, period, phase, reduced, out) {
    out = out || {};
    if (reduced) { out.x = out.y = out.z = 0; out.a = 0; return out; }
    var k = i % streams, per = Math.max(1, Math.floor(n / streams));
    var ang = TAU * (k / streams + (phase || 0)), p = frac(t / period + Math.floor(i / streams) / per);
    out.x = Math.cos(ang) * 0.32 * p; out.z = Math.sin(ang) * 0.32 * p;
    out.y = 0.42 * 4 * p * (1 - p); out.a = p < 0.85 ? 1 : (1 - p) / 0.15;
    return out;
  }
  function idleBubble(t, k, everySec, phase, reduced, out) {
    out = out || {};
    var life = 3.4, age = ((t + (phase || 0) * everySec) % everySec + everySec) % everySec + k * everySec;
    if (reduced || age > life) { out.x = out.y = out.z = 0; out.r = 0; out.a = 0; return out; }
    out.y = 0.3 + 0.42 * age; out.x = 0.12 + 0.07 * Math.sin(age * 2.6 + k); out.z = 0.05 * Math.cos(age * 2.1 + k);
    out.r = 0.05 + 0.015 * k; out.a = 0.45 * Math.min(1, age / 0.3) * Math.min(1, (life - age) / 0.4);
    return out;
  }
  function petal(t, i, seed, reduced, out) {
    out = out || {};
    var s = seedOf(seed), h = mix01(s, i), period = 4.8, p = frac(t / period + h);
    if (reduced) { out.x = out.y = out.z = out.rot = 0; out.a = 0; return out; }
    var a = TAU * (h + p * 0.6);
    out.y = 1.3 * (1 - p); out.x = Math.cos(a) * (0.25 + 0.3 * p); out.z = Math.sin(a) * (0.25 + 0.3 * p);
    out.rot = (p * 2 + h) * 360; out.a = Math.min(1, p / 0.1) * Math.min(1, (1 - p) / 0.15);
    return out;
  }
  function snowSparkle(t, i, n, phase, reduced, out) {
    out = out || {};
    var u = i / n + (phase || 0), p = reduced ? frac(u) : frac(t / 6 + u), ang = TAU * (reduced ? u : t / 9 + u);
    out.x = Math.cos(ang) * 0.4; out.z = Math.sin(ang) * 0.4; out.y = 0.15 + 0.75 * p;
    out.a = reduced ? 0.6 : 0.3 + 0.7 * Math.sin(PI * p);
    return out;
  }
  function avatarBob(t, phase, reduced) { return reduced ? 0 : 0.02 * Math.sin(TAU * (0.5 * t + (phase || 0))); }
  function beamAngle(t, rps, phase, reduced) { return reduced ? frac(phase || 0) * 360 : frac(t * rps + (phase || 0)) * 360; }
  /* a colour cycle (lighthouse at Showtime): hold, then a 0.5 s crossfade to the next */
  function beamColor(t, everySec, n, out) {
    out = out || {};
    var step = Math.floor(t / everySec), local = t - step * everySec;
    out.i = ((step % n) + n) % n; out.j = (out.i + 1) % n; out.k = smoothstep(everySec - 0.5, everySec, local);
    return out;
  }
  function coneSweep(t, i, reduced) { return reduced ? 0 : 25 * Math.sin(TAU * (0.12 * t + i / 3)); }
  function drift(t, speed, span, offset) { return frac((t * speed + (offset || 0)) / span + 0.5) * span - span / 2; }
  /* one PEARL bubble from the machine act: rises 1.5–3 u, wobbles, pops at the end of its life */
  function bubbleTrack(age, seed, out) {
    out = out || {};
    var s = seedOf(seed), rise = 1.5 + 1.5 * mix01(s, 1), life = 1.6 + 0.8 * mix01(s, 2), w = mix01(s, 3) * TAU;
    var u = clamp01(age / life);
    out.popped = age >= life;
    out.y = 0.35 + rise * ease.outQuad(u);
    out.x = 0.14 * Math.sin(age * 4 + w) + (mix01(s, 4) - 0.5) * 0.6 * u;
    out.z = 0.14 * Math.cos(age * 3.3 + w) + (mix01(s, 5) - 0.5) * 0.6 * u;
    out.r = 0.04 + 0.08 * mix01(s, 6);
    out.a = out.popped || age < 0 ? 0 : 0.45 * Math.min(1, age / 0.15);
    return out;
  }

  /* ---------------- acts ---------------- */
  var BLEND = 0.12;        /* a restarted act eases out of the interrupted pose over this long */
  function blendFrom(out, from, keys, t) {
    if (!from) return out;
    var k = smoothstep(0, BLEND, t);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof from[key] === 'number' && typeof out[key] === 'number') out[key] = from[key] + (out[key] - from[key]) * k;
    }
    return out;
  }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  /* a jet that rises over `up`, holds, and falls by `end` */
  function jet(t, start, up, holdTo, end, H) {
    if (t < start || t >= end) return 0;
    if (t < start + up) return H * ease.outQuad(seg(t, start, start + up));
    if (t < holdTo) return H;
    return H * (1 - ease.inQuad(seg(t, holdTo, end)));
  }

  var ACTS = {};
  /* cues may be a list or a function(o) (when they depend on the restart phase or the
     pet's run-over); by default the reduced variant fires the same cues at t = 0 */
  function defAct(spec) {
    spec.keys = Object.keys(spec.end);
    spec.cues = spec.cues || [];
    if (!spec.reducedCues) {
      spec.reducedCues = typeof spec.cues === 'function' ? spec.cues
        : spec.cues.map(function (c) { var o = {}; for (var k in c) o[k] = c[k]; o.t = 0; return o; });
    }
    ACTS[spec.name] = spec;
  }

  /* universal tap feedback: 1 → 0.92 → 1.06 → 1 over 0.25 s */
  defAct({ name: 'squish', dur: 0.25, reducedDur: 0.12, end: { sy: 1, sxz: 1 }, cues: [{ t: 0, sfx: 'pop' }],
    sample: function (t, out, o) {
      var s;
      if (o.reduced) s = t >= 0.12 || t <= 0 ? 1 : 1 - 0.03 * Math.sin(PI * t / 0.12);
      else if (t <= 0 || t >= 0.25) s = 1;
      else if (t < 0.07) s = lerp(1, 0.92, ease.outQuad(t / 0.07));
      else if (t < 0.16) s = lerp(0.92, 1.06, ease.inOutSine((t - 0.07) / 0.09));
      else s = lerp(1.06, 1, ease.inOutSine((t - 0.16) / 0.09));
      out.sy = s; out.sxz = 1 + (1 - s) * 0.5;
      return blendFrom(out, o.from, this.keys, t);
    } });

  /* placement: fall 1.2 u in 0.22 s (inQuad), squash y 0.8 / xz 1.12 for 0.08 s, outBack rebound 0.25 s.
     A re-drop always falls from 1.2 (it is a new placement); the squash blends. */
  var DROP_BLEND = ['sy', 'sxz', 'a'];
  defAct({ name: 'dropIn', dur: 0.55, reducedDur: 0.15, end: { dy: 0, sy: 1, sxz: 1, a: 1 },
    cues: [{ t: 0.22, sfx: 'chip' }, { t: 0.22, sfx: 'pop' }, { t: 0.22, emit: 'dust', n: 6 }],
    reducedCues: [{ t: 0, sfx: 'chip' }, { t: 0, sfx: 'pop' }, { t: 0, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      out.dy = 0; out.sy = 1; out.sxz = 1; out.a = 1;
      if (o.reduced) { out.a = clamp01(t / 0.15); return out; }
      if (t < 0.22) out.dy = 1.2 * (1 - ease.inQuad(clamp01(t / 0.22)));
      else if (t < 0.30) { out.sy = 0.8; out.sxz = 1.12; }
      else if (t < 0.55) { var e = ease.outBack((t - 0.30) / 0.25); out.sy = 0.8 + 0.2 * e; out.sxz = 1.12 - 0.12 * e; }
      return blendFrom(out, o.from, DROP_BLEND, t);
    } });

  /* storing: anticipate, shrink into a sparkle, and the sparkle flies to the tray */
  defAct({ name: 'store', dur: 0.75, reducedDur: 0.3, end: { s: 0, flight: 1, a: 0 },
    cues: [{ t: 0, sfx: 'whoosh' }, { t: 0.25, emit: 'sparkle', n: 6 }],
    sample: function (t, out, o) {
      if (o.reduced) { var r = clamp01(t / 0.3); out.s = 1 - r; out.flight = r; out.a = 1 - r; return out; }
      out.s = t < 0.25 ? 1 - ease.inBack(clamp01(t / 0.25)) : 0;
      out.flight = t < 0.25 ? 0 : ease.outQuad(seg(t, 0.25, 0.75));
      out.a = t < 0.25 ? 1 : 1 - seg(t, 0.25, 0.75);
      return blendFrom(out, o.from, ['s'], t);
    } });

  /* lamps: 3 gentle, rising steps over 0.25 s, then on — never a dip, so never a strobe */
  var GLOW_STEPS = [0.35, 0.6, 0.8, 1];
  defAct({ name: 'glowOn', dur: 0.25, reducedDur: 0, end: { level: 1 }, cues: [{ t: 0, sfx: 'star' }],
    sample: function (t, out, o) {
      var f = o.from ? clamp01(o.from.level) : 0;
      if (o.reduced || t >= 0.25) { out.level = 1; return out; }
      var i = Math.min(3, Math.floor(Math.max(0, t) / (0.25 / 3))), into = (Math.max(0, t) - i * 0.25 / 3) / 0.03;
      var lv = i === 0 ? GLOW_STEPS[0] : lerp(GLOW_STEPS[i - 1], GLOW_STEPS[i], clamp01(into));
      out.level = f + (1 - f) * lv;
      return out;
    } });
  defAct({ name: 'glowOff', dur: 0.15, reducedDur: 0, end: { level: 0 }, cues: [{ t: 0, sfx: 'chip' }],
    sample: function (t, out, o) {
      var f = o.from ? clamp01(o.from.level) : 1;
      out.level = o.reduced ? 0 : f * (1 - ease.outQuad(clamp01(t / 0.15)));
      return out;
    } });

  /* flag pole: flutters harder (0.12 u) for 1.2 s, back to the 0.04 u idle */
  defAct({ name: 'flag', dur: 1.2, reducedDur: 0, end: { amp: 0.04, hz: 2 }, endReduced: { amp: 0, hz: 2 },
    cues: [{ t: 0, sfx: 'whoosh', vol: 0.5 }],
    sample: function (t, out, o) {
      out.hz = 2;
      if (o.reduced) { out.amp = 0; return out; }
      var env = t < 0.15 ? ease.outQuad(clamp01(t / 0.15)) : t < 0.6 ? 1 : 1 - ease.inOutSine(seg(t, 0.6, 1.2));
      out.amp = 0.04 + 0.08 * env;
      return blendFrom(out, o.from, ['amp'], t);
    } });

  /* bunting: a ripple runs left to right along the line in 0.6 s */
  function ripple(u, front, amp) { var x = (u - front) / 0.15; return amp * Math.exp(-x * x); }
  defAct({ name: 'bunting', dur: 0.8, reducedDur: 0, end: { front: 1.3, amp: 0 },
    cues: [{ t: 0, sfx: 'whoosh', vol: 0.5 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.front = 1.3; out.amp = 0; return out; }
      out.front = -0.3 + 1.6 * clamp01(t / 0.6);
      out.amp = 14 * (1 - smoothstep(0.55, 0.8, t));
      return blendFrom(out, o.from, ['amp'], t);
    } });

  /* windmill: spin up to 2.5 rev/s in 1/3 s, ease back to the 0.25 rev/s idle by 3 s.
     The extra turn always totals a whole number of quarter turns (the sails have
     4-fold symmetry), so the idle carries on seamlessly; a restart keeps the current
     speed and the pose (mod 90°) and re-solves the peak so it still lands square. */
  var SPIN = { idle: 0.25, peak: 2.5, up: 1 / 3, down: 8 / 3, quarter: 0.25 };
  var _plan = { w0: 0, c: 0, P: 0, need: 0 };      /* scratch: sampled every frame, so no allocation */
  function spinPlan(from) {
    var A = SPIN.up, B = SPIN.down, W = SPIN.idle;
    var w0 = from && typeof from.rps === 'number' ? from.rps : W;
    var c = from && typeof from.extraDeg === 'number' ? frac(from.extraDeg / 360 / SPIN.quarter) * SPIN.quarter : 0;
    var lin = (w0 - W) * A - w0 * (2 * A / 3) - W * (B / 2), coef = 2 * A / 3 + B / 2;
    var natural = SPIN.peak * coef + lin;
    var k = Math.max(1, Math.round((c + natural) / SPIN.quarter)), need = k * SPIN.quarter - c;
    _plan.w0 = w0; _plan.c = c; _plan.need = need; _plan.P = (need - lin) / coef;
    return _plan;
  }
  defAct({ name: 'spin', dur: 3, reducedDur: 0.6, end: { rps: 0.25, extraDeg: 0 }, mod: { extraDeg: 90 },
    cues: [{ t: 0, sfx: 'whoosh' }, { t: 0, sfx: 'boost', vol: 0.4 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.rps = SPIN.idle; out.extraDeg = 90 * ease.inOutSine(clamp01(t / 0.6)); return out; }
      var A = SPIN.up, B = SPIN.down, W = SPIN.idle, pl = spinPlan(o.from), E;
      if (t <= 0) { out.rps = pl.w0; E = 0; }
      else if (t < A) {
        var u = t / A;
        out.rps = pl.w0 + (pl.P - pl.w0) * (1 - (1 - u) * (1 - u));
        E = (pl.w0 - W) * t + (pl.P - pl.w0) * (t - (A / 3) * (1 - Math.pow(1 - u, 3)));
      } else if (t < A + B) {
        var v = (t - A) / B, Ea = (pl.w0 - W) * A + (pl.P - pl.w0) * (2 * A / 3);
        out.rps = W + (pl.P - W) * (1 + Math.cos(PI * v)) / 2;
        E = Ea + (pl.P - W) * B * (v / 2 + Math.sin(PI * v) / (2 * PI));
      } else { out.rps = W; E = pl.need; }
      out.extraDeg = (pl.c + E) * 360;
      return out;
    } });

  /* swing: a pendulum to ±38° (period 1.6 s) that decays to rest over 4 s, the one act
     allowed past 3 s. A restart keeps the angle and direction (phase-matched) and refills
     the swing to full height. idleMix fades the ±4° idle out under the big swing. */
  var SWING = { amp: 38, period: 1.6, dur: 4 };
  function swingPhase(from) {
    if (!from || typeof from.deg !== 'number') return 0;
    var phi = Math.asin(clamp(from.deg / SWING.amp, -1, 1));
    return from.dir < 0 ? PI - phi : phi;
  }
  function swingFirstPeak(phi) { var w = TAU / SWING.period; return (((PI / 2 - phi) % PI) + PI) % PI / w; }
  defAct({ name: 'swing', dur: SWING.dur, reducedDur: 0, end: { deg: 0, dir: 1, idleMix: 1 },
    cues: function (o) {
      if (o && o.reduced) return [{ t: 0, sfx: 'whoosh' }];
      var t1 = swingFirstPeak(swingPhase(o && o.from)), half = SWING.period / 2;
      return [0, 1, 2].map(function (k) { return { t: t1 + k * half, sfx: 'whoosh' }; });
    },
    sample: function (t, out, o) {
      if (o.reduced || t >= SWING.dur) { out.deg = 0; out.dir = 1; out.idleMix = 1; return out; }
      var phi = swingPhase(o.from), t1 = swingFirstPeak(phi), w = TAU / SWING.period, a = w * Math.max(0, t) + phi;
      var env = t <= t1 ? 1 : Math.pow(clamp01((SWING.dur - t) / (SWING.dur - t1)), 1.5);
      out.deg = SWING.amp * env * Math.sin(a);
      out.dir = Math.cos(a) < 0 ? -1 : 1;
      out.idleMix = 1 - env;
      return blendFrom(out, o.from, ['idleMix'], t);
    } });

  /* fountain: a 3 s concert show — centre, left, right, then all together */
  defAct({ name: 'splash', dur: 3, reducedDur: 0.6, end: { c: 0, l: 0, r: 0 },
    cues: [{ t: 0, sfx: 'whoosh' }, { t: 0, sfx: 'combo', step: 0 }, { t: 0.6, sfx: 'combo', step: 1 },
           { t: 1.2, sfx: 'combo', step: 2 }, { t: 1.8, sfx: 'combo', step: 3 }, { t: 2.6, sfx: 'star' }],
    reducedCues: [{ t: 0, sfx: 'whoosh' }, { t: 0.4, sfx: 'star' }],
    sample: function (t, out, o) {
      if (o.reduced) { var h = jet(t, 0, 0.2, 0.4, 0.6, 0.5); out.c = out.l = out.r = h; return out; }
      var fin = jet(t, 1.8, 0.25, 2.35, 2.7, 1.2);
      out.c = Math.max(jet(t, 0, 0.2, 0.45, 0.6, 0.9), fin);
      out.l = Math.max(jet(t, 0.6, 0.2, 1.05, 1.2, 0.9), fin);
      out.r = Math.max(jet(t, 1.2, 0.2, 1.65, 1.8, 0.9), fin);
      return blendFrom(out, o.from, this.keys, t);
    } });

  /* trampoline: after the pet's run-over (o.lead ≤ 1.2 s) 3 bounces of 0.5, 0.75 and 1.0 u
     with a front flip on the last; the mat dips 0.12 u at each contact; 'boing' with
     combo steps 0, 2, 4 layered on top ('boing' itself ignores step) */
  var BOUNCE = { g: 24, contact: 0.075, heights: [0.5, 0.75, 1.0], dip: 0.12, maxLead: 1.2 };
  BOUNCE.flights = BOUNCE.heights.map(function (h) { return 2 * Math.sqrt(2 * h / BOUNCE.g); });
  BOUNCE.length = 4 * BOUNCE.contact + BOUNCE.flights.reduce(function (a, b) { return a + b; }, 0);
  function leadOf(o) { return clamp(o && o.lead || 0, 0, BOUNCE.maxLead); }
  defAct({ name: 'bounce', dur: BOUNCE.maxLead + BOUNCE.length, reducedDur: 0.2, end: { matDip: 0, petY: 0, flip: 0 },
    cues: function (o) {
      if (o && o.reduced) return [{ t: 0, sfx: 'boing' }];
      var t = leadOf(o), out = [];
      for (var i = 0; i < 3; i++) {
        out.push({ t: t, sfx: 'boing' }, { t: t, sfx: 'combo', step: i * 2 });
        t += BOUNCE.contact + BOUNCE.flights[i];
      }
      return out;
    },
    sample: function (t, out, o) {
      out.matDip = 0; out.petY = 0; out.flip = 0;
      if (o.reduced) { out.matDip = t > 0 && t < 0.2 ? -0.06 * Math.sin(PI * t / 0.2) : 0; return out; }
      var s = t - leadOf(o);
      for (var i = 0; i < 4 && s >= 0; i++) {
        if (s < BOUNCE.contact) { out.matDip = -BOUNCE.dip * Math.sin(PI * s / BOUNCE.contact); out.petY = out.matDip; break; }
        s -= BOUNCE.contact;
        if (i === 3) break;
        var f = BOUNCE.flights[i];
        if (s < f) {
          var v = Math.sqrt(2 * BOUNCE.g * BOUNCE.heights[i]);
          out.petY = v * s - BOUNCE.g * s * s / 2;
          if (i === 2) out.flip = s / f;
          break;
        }
        s -= f;
      }
      return blendFrom(out, o.from, ['matDip', 'petY'], t);
    } });

  /* bubble machine: a happy shake while 24 PEARL bubbles leave in 6 bursts; ≤ 6 audible
     pops with the combo stepping up underneath */
  var BUBBLE_CUES = [];
  for (var bi = 0; bi < 6; bi++) BUBBLE_CUES.push({ t: bi * 0.15, emit: 'bubble', n: 4 });
  for (var bp = 0; bp < 6; bp++) BUBBLE_CUES.push({ t: 1.6 + bp * 0.22, sfx: 'pop' }, { t: 1.6 + bp * 0.22, sfx: 'combo', step: bp });
  defAct({ name: 'bubbles', dur: 3, reducedDur: 0.6, end: { wobble: 0 }, cues: BUBBLE_CUES,
    reducedCues: [{ t: 0, emit: 'bubble', n: 6 }, { t: 0.4, sfx: 'pop' }],
    sample: function (t, out, o) {
      out.wobble = o.reduced || t >= 0.9 ? 0 : 3 * Math.sin(TAU * 3 * t) * (1 - t / 0.9);
      return blendFrom(out, o.from, this.keys, t);
    } });

  /* course gate / pitch: sparkle ring, stars spin two turns, the ball hops, 0.7 s push-in */
  defAct({ name: 'launch', dur: 0.7, reducedDur: 0, end: { k: 1, hop: 0, spinDeg: 0 }, mod: { spinDeg: 360 },
    cues: [{ t: 0, sfx: 'whoosh' }, { t: 0, emit: 'sparkleRing', n: 12 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.k = 1; out.hop = 0; out.spinDeg = 0; return out; }
      var u = clamp01(t / 0.7);
      out.k = ease.inOutSine(u); out.hop = 0.15 * Math.sin(PI * clamp01(t / 0.4)); out.spinDeg = 720 * ease.outQuad(u);
      return out;
    } });
  /* garage: the parked kart revs with a 3 Hz wobble and 2 pastel exhaust puffs */
  defAct({ name: 'kartRev', dur: 0.7, reducedDur: 0, end: { k: 1, wobble: 0 },
    cues: [{ t: 0, sfx: 'boost' }, { t: 0.1, emit: 'exhaust', n: 1 }, { t: 0.35, emit: 'exhaust', n: 1 }, { t: 0.35, sfx: 'whoosh' }],
    sample: function (t, out, o) {
      if (o.reduced) { out.k = 1; out.wobble = 0; return out; }
      var u = clamp01(t / 0.7);
      out.k = ease.inOutSine(u); out.wobble = 3 * Math.sin(TAU * 3 * t) * (1 - u);
      return out;
    } });

  /* house door: swings open 70° in 0.3 s and HOLDS until homeClose */
  defAct({ name: 'home', dur: 0.3, reducedDur: 0, hold: true, end: { deg: 70 },
    cues: [{ t: 0, sfx: 'pop' }, { t: 0.05, sfx: 'unlock' }, { t: 0.15, emit: 'heart', n: 3 }],
    sample: function (t, out, o) {
      var d0 = o.from ? o.from.deg : 0;
      out.deg = o.reduced || t >= 0.3 ? 70 : d0 + (70 - d0) * ease.outBack(clamp01(t / 0.3));
      return out;
    } });
  defAct({ name: 'homeClose', dur: 0.3, reducedDur: 0, end: { deg: 0 }, cues: [],
    sample: function (t, out, o) {
      var d0 = o.from ? o.from.deg : 70;
      out.deg = o.reduced || t >= 0.3 ? 0 : d0 * (1 - ease.inOutSine(clamp01(t / 0.3)));
      return out;
    } });

  /* a new purchase on the stage riser: pop in and turn once (1.2 s) */
  defAct({ name: 'debut', dur: 1.2, reducedDur: 0.3, end: { deg: 0, s: 1, a: 1 }, mod: { deg: 360 },
    cues: [{ t: 0, emit: 'sparkle', n: 16 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.deg = 0; out.s = 1; out.a = clamp01(t / 0.3); return out; }
      out.deg = t >= 1.2 ? 0 : 360 * ease.inOutSine(clamp01(t / 1.2));
      out.s = t < 0.3 ? 0.6 + 0.4 * ease.outBack(clamp01(t / 0.3)) : 1;
      out.a = 1;
      return out;
    } });

  /* a pet's or the avatar's happy hop on tap */
  defAct({ name: 'hop', dur: 0.45, reducedDur: 0, end: { dy: 0, sy: 1 }, cues: [{ t: 0, emit: 'emote', n: 1 }],
    sample: function (t, out, o) {
      if (o.reduced || t <= 0 || t >= 0.45) { out.dy = 0; out.sy = 1; }
      else { var u = t / 0.45; out.dy = 0.18 * 4 * u * (1 - u); out.sy = 1 + 0.08 * Math.sin(PI * u); }
      return blendFrom(out, o.from, this.keys, t);
    } });

  /* ---------------- city building acts (Encore City) ----------------
     Each lasts ≤ 3 s on the building's ACT_PIVOT pivot, restarts on a re-tap (blending the
     keys that must not jump), never plays 'pop' in its first 0.05 s (the controller's tap
     squish owns that), and never involves points or chance. Reduced motion: the instant end
     state, one sparkle, and the same sounds at t = 0. Longer pet performances run in
     pets-brain; the models fire them alongside. */
  /* 0 before a, up to 1 by b (inOutSine), held to c, back to 0 by d */
  function env(t, a, b, c, d) {
    if (t <= a || t >= d) return 0;
    if (t < b) return ease.inOutSine((t - a) / (b - a));
    if (t <= c) return 1;
    return 1 - ease.inOutSine((t - c) / (d - c));
  }
  function reducedOf(list) {
    var out = [];
    list.forEach(function (c) { if (c.sfx) { var o = {}; for (var k in c) o[k] = c[k]; o.t = 0; out.push(o); } });
    out.push({ t: 0, emit: 'sparkle', n: 1 });
    return out;
  }
  function endInto(out, end) { for (var k in end) out[k] = end[k]; return out; }
  function defBuildingAct(spec0) {
    spec0.reducedDur = 0;
    spec0.reducedCues = reducedOf(spec0.cues);
    defAct(spec0);
  }
  /* the ON AIR sign stays lit this long after a tap (past the 3 s act; the model fades it),
     and the photo strip waits this long before it fades (or until the next tap) */
  var ON_AIR_SEC = 4, STRIP_SEC = 6;

  /* Photo Booth: the countdown rings light one by one (1.67 Hz), a local lens bloom at
     1.5 s, then the strip slides out of the slot (it stays out at the end) */
  defBuildingAct({ name: 'snap', dur: 3, end: { bulbs: 0, bloom: 0, strip: 1, curtain: 0 },
    cues: [{ t: 0.1, sfx: 'tick', step: 0 }, { t: 0.7, sfx: 'tick', step: 2 }, { t: 1.3, sfx: 'tick', step: 4 },
           { t: 1.5, sfx: 'star' }, { t: 1.5, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      out.bulbs = t < 0.1 ? 0 : t < 0.7 ? 1 / 3 : t < 1.3 ? 2 / 3 : t < 1.5 ? 1 : 1 - clamp01((t - 1.5) / 0.3);
      out.bloom = t < 1.5 ? 0 : t < 1.75 ? ease.outQuad((t - 1.5) / 0.25) : 1 - ease.inQuad(clamp01((t - 1.75) / 0.5));
      out.strip = t < 1.7 ? 0 : ease.outQuad(clamp01((t - 1.7) / 0.6));
      out.curtain = t < 0.5 ? 4 * Math.sin(TAU * 2 * t) * (1 - t / 0.5) : 0;
      return blendFrom(out, o.from, ['bloom', 'curtain'], t);
    } });

  /* Boba Café: the hatch flips up, a cup slides along the counter to the table, the giant
     sign's pearls swirl up a helix and settle, two hearts, the hatch closes */
  defBuildingAct({ name: 'serve', dur: 3, end: { hatch: 0, cup: 1, cupA: 0, swirl: 0 },
    cues: [{ t: 0.1, sfx: 'whoosh' }, { t: 0.9, sfx: 'pop', step: 0 }, { t: 1.1, sfx: 'pop', step: 2 },
           { t: 1.3, sfx: 'pop', step: 4 }, { t: 1.4, emit: 'heart', n: 2 }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      out.hatch = t < 0.1 ? 0 : t < 0.35 ? 110 * ease.outBack((t - 0.1) / 0.25) : t < 2.6 ? 110 : 110 * (1 - ease.inOutSine(clamp01((t - 2.6) / 0.3)));
      out.cup = t < 0.35 ? 0 : ease.inOutSine(clamp01((t - 0.35) / 0.5));
      out.cupA = t < 0.35 ? 0 : t < 2.4 ? clamp01((t - 0.35) / 0.1) : 1 - clamp01((t - 2.4) / 0.5);
      out.swirl = t < 0.9 ? 0 : t < 1.4 ? ease.inOutSine((t - 0.9) / 0.5) : 1 - ease.inOutSine(clamp01((t - 1.4) / 0.6));
      return blendFrom(out, o.from, ['hatch'], t);
    } });

  /* LED Screen Tower: a dark scanline band sweeps top to bottom (a moving wipe, never a
     dimming); prog flips 0 → 1 at 0.2 s = advance the program (the model rate-limits
     changes to one per RATE.screen s) */
  defBuildingAct({ name: 'screen', dur: 0.5, end: { wipe: 1, band: 0, prog: 1 },
    cues: [{ t: 0.2, sfx: 'beep' }, { t: 0.4, sfx: 'chip' }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 0.5) return endInto(out, this.end);
      out.wipe = clamp01((t - 0.05) / 0.3);
      out.band = t < 0.05 ? 0 : t < 0.1 ? (t - 0.05) / 0.05 : t < 0.3 ? 1 : 1 - clamp01((t - 0.3) / 0.05);
      out.prog = t < 0.2 ? 0 : 1;
      return blendFrom(out, o.from, ['band'], t);
    } });

  /* Recording Studio: ON AIR switches on (and stays on: a re-tap never toggles it off), the
     VU level envelope runs 0.3–2.7 s (bar heights follow the music beat via vu()), a
     4-note phrase on the beeps and the active pet's voice (cue pet: true → that pet's step) */
  var RECORD_CUES = [];
  [[0.4, 0], [1.0, 2], [1.6, 4], [2.2, 7]].forEach(function (b) {
    RECORD_CUES.push({ t: b[0], sfx: 'beep', step: b[1] }, { t: b[0], emit: 'note', n: 1 });
  });
  RECORD_CUES.push({ t: 2.4, sfx: 'voice', pet: true });
  defBuildingAct({ name: 'record', dur: 3, end: { onAir: 1, level: 0 }, cues: RECORD_CUES,
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      var held = o.from && typeof o.from.onAir === 'number' ? clamp01(o.from.onAir) : 0;
      out.onAir = Math.max(held, ease.inOutSine(clamp01((t - 0.1) / 0.15)));
      out.level = env(t, 0.3, 0.5, 2.5, 2.7);
      return blendFrom(out, o.from, ['level'], t);
    } });

  /* Dance Studio: the floor chase and the speaker pump run under this envelope (the tiles
     step on the beat via diagChase(), each tile at most once per 4 beats) */
  defBuildingAct({ name: 'dance', dur: 3, end: { chase: 0, pump: 0 },
    cues: [{ t: 0.1, sfx: 'go' }, { t: 0.1, emit: 'note', n: 3 }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      out.chase = env(t, 0.1, 0.3, 2.6, 3);
      out.pump = env(t, 0.1, 0.3, 2.6, 3);
      return blendFrom(out, o.from, this.keys, t);
    } });

  /* Rooftop Hangout: the telescope swings 40° to the sky and back, the beanbags squish, the
     festoon bulbs brighten in a 0.8 Hz wave (wave() under this envelope), stars at 2.2 s */
  defBuildingAct({ name: 'hangout', dur: 3, end: { scope: 0, wave: 0, squish: 1 },
    cues: [{ t: 0.1, sfx: 'whoosh' }, { t: 2.2, sfx: 'star' }, { t: 2.2, emit: 'star', n: 3 }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      out.scope = 40 * env(t, 0.1, 0.7, 2.4, 3);
      out.wave = env(t, 0.3, 0.5, 1.8, 2);
      out.squish = t < 0.3 || t >= 0.8 ? 1 : t < 0.45 ? lerp(1, 0.92, ease.outQuad((t - 0.3) / 0.15))
        : t < 0.62 ? lerp(0.92, 1.03, ease.inOutSine((t - 0.45) / 0.17)) : lerp(1.03, 1, ease.inOutSine((t - 0.62) / 0.18));
      return blendFrom(out, o.from, ['scope', 'squish'], t);
    } });

  /* Concert Stage (building part): sting, the LED wall wipes to ENCORE (and stays there for
     the encore moment, which the scene owns), the moving heads swing to centre and back, the
     footlights chase, beams (alpha ≤ 0.18) under their envelope, confetti at 2.6 s */
  defBuildingAct({ name: 'encore', dur: 3, end: { wall: 1, heads: 0, chase: 0, beams: 0 },
    cues: [{ t: 0.1, sfx: 'sting' }, { t: 2.6, sfx: 'tada' }, { t: 2.6, emit: 'confetti', n: 30 }],
    sample: function (t, out, o) {
      if (o.reduced || t >= 3) return endInto(out, this.end);
      out.wall = clamp01((t - 0.1) / 0.4);
      out.heads = env(t, 0.1, 0.8, 2.4, 3);
      out.chase = env(t, 0.2, 0.4, 2.6, 3);
      out.beams = env(t, 0.1, 0.4, 2.5, 3);
      return blendFrom(out, o.from, ['heads', 'chase', 'beams'], t);
    } });

  /* ---------------- flash-safe light helpers for the city buildings ---------------- */
  /* rate gates: one local bloom per item per 1.5 s; one screen program change per 0.5 s */
  var RATE = { bloom: 1.5, screen: 0.5 };
  function allow(lastT, t, gap) { return lastT == null || !(t - lastT < gap); }
  /* VU bar i: smooth heights on a 4-beat pattern (no on/off), scaled by the act envelope */
  var VU = [0.55, 0.9, 0.7, 1.0];
  function vu(i, beat, beatFrac, level, reduced) {
    if (reduced) return 0.75 * level;
    var b = ((beat + i) % 4 + 4) % 4;
    return level * lerp(VU[b], VU[(b + 1) % 4], smoothstep(0, 1, beatFrac));
  }
  /* light-up floor tile (cx, cz): its diagonal lights for one beat in every `groups` beats,
     a soft sine within the beat; steady under reduced motion */
  function diagChase(cx, cz, beat, beatFrac, groups, reduced) {
    if (reduced) return 0.8;
    var g = Math.max(2, groups | 0), on = ((cx + cz) % g + g) % g === ((beat % g) + g) % g;
    return 0.35 + (on ? 0.65 * Math.sin(PI * clamp01(beatFrac)) : 0);
  }
  /* a travelling brightness wave over n lights at hz (≤ ±35%), scaled by an envelope */
  function wave(t, i, n, hz, level, reduced) {
    if (reduced) return 1;
    return 1 - 0.35 * clamp01(level) * (0.5 - 0.5 * Math.cos(TAU * (safeHz(hz) * t - i / Math.max(1, n))));
  }

  /* ================================================================
     Sky-island acts (My Island v3; world-model acts.new). Island-only fun:
     no game, no points. Item acts last ≤ 3 s (the beach hut 0.6 s); the five
     landmark acts ≤ 6 s and the host ignores re-taps while they run
     (LANDMARK_BUSY, keyed by CATALOG act). An act's rest pose IS its end
     state, so a model at rest, the end of a played act and a reduced-motion
     tap agree: reduced motion is that end state at once (reducedDur 0), one
     sparkle, and the same sounds at t = 0. Toggles pair like glowOn /
     glowOff (actFor picks by the lit memory): 'open' / 'close' for the beach
     hut, 'drawbridge' / 'drawbridgeUp' for the keep. A 'mod' key ends on a
     whole step of a symmetric part (a carousel mount, a wheel gondola, a rink
     anchor, a penguin's round trip): the model folds that extra into its
     resting pose. Light rates come from SLIslandLook.ART3.FREQS (freq()).
     ================================================================ */
  /* the contract values; world-look's ART3.FREQS wins */
  var FREQ_DEFAULT = { bulbChase: 1.5, breathe: 1.0, birdFlap: 1.6, critterFlap: 2 };
  function look() { return L0 || (root && root.SLIslandLook) || null; }
  function freq(name) {
    var lk = look(), f = lk && lk.ART3 && lk.ART3.FREQS ? lk.ART3.FREQS[name] : undefined;
    return safeHz(typeof f === 'number' && f > 0 ? f : (FREQ_DEFAULT[name] || 0));
  }
  function ledHz() { var lk = look(); return lk && lk.LED_CHASE_HZ > 0 ? lk.LED_CHASE_HZ : 1.5; }
  var V3_ACTS = [];
  var LANDMARK_BUSY = Object.freeze({ wheel: 6, lift: 4, zip: 4, drawbridge: 4, penguins: 6 });
  function defIsleAct(spec0) {
    spec0.v3 = true;
    spec0.reducedDur = 0;
    spec0.reducedCues = reducedOf(spec0.cues);
    defAct(spec0);
    V3_ACTS.push(spec0.name);
  }
  /* 0 → 1 between a and b on an easing curve (never −0: poses compare exactly at rest) */
  function ramp(t, a, b, fn) { var v = (fn || ease.inOutSine)(seg(t, a, b)); return v === 0 ? 0 : v; }
  function num(from, k, d) { return from && typeof from[k] === 'number' ? from[k] : d; }

  /* Sea-creature carousel: half a revolution in 3 s while the six mounts bob ±0.15 u (alternate
     mounts opposite, under 1 Hz); the active pet rides the seahorse (pets-brain 'ride').
     deg = extra turn on the 'spin' pivot (mod 45°). Reduced: one eighth of a turn, at once. */
  var RIDE = { turn: 180, index: 45, bob: 0.15, bobHz: 2 / 3 };
  defIsleAct({ name: 'ride', dur: 3, maxSec: 3, end: { deg: 0, bob: 0 }, mod: { deg: RIDE.index },
    cues: [{ t: 0.1, sfx: 'musicbox', step: 0 }, { t: 1.5, sfx: 'voice', pet: true }, { t: 2.9, sfx: 'star', vol: 0.6 },
           { t: 2.9, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.deg = RIDE.index; out.bob = 0; return out; }
      out.deg = RIDE.turn * ramp(t, 0.1, 2.9);
      out.bob = RIDE.bob * env(t, 0.1, 0.6, 2.4, 2.9) * Math.sin(TAU * RIDE.bobHz * Math.max(0, t - 0.1)) + 0;
      return blendFrom(out, o.from, ['bob'], t);
    } });

  /* Helter-skelter and ice slide: the pet climbs (three ticks), then slides from the top (s0 → s7
     round the spiral, or a belly-slide) and lands on its mat. climb / slide are the pet's progress
     (pets-brain 'slide'). Reduced: at the foot, on its mat. */
  defIsleAct({ name: 'slide', dur: 3, maxSec: 3, end: { climb: 1, slide: 1 },
    cues: [{ t: 0.2, sfx: 'tick', step: 0 }, { t: 0.6, sfx: 'tick', step: 2 }, { t: 1.0, sfx: 'tick', step: 4 },
           { t: 1.4, sfx: 'whoosh' }, { t: 2.5, sfx: 'skid', vol: 0.6 }, { t: 2.5, emit: 'sparkle', n: 4 },
           { t: 2.7, sfx: 'voice', pet: true }],
    sample: function (t, out, o) {
      if (o.reduced) { out.climb = 1; out.slide = 1; return out; }
      out.climb = ramp(t, 0.1, 1.3);
      out.slide = ramp(t, 1.4, 2.5, ease.inQuad);
      return out;
    } });

  /* Beach hut (a toggle like the lamps; lit memory = open): both doors swing 100° in 0.4 s to show
     the deckchair and the bucket and spade; 'close' swings them shut. deg drives doorL (−) and
     doorR (+). Reduced: open / shut at once. */
  var HUT = { deg: 100, swing: 0.4 };
  defIsleAct({ name: 'open', dur: 0.6, maxSec: 0.6, end: { deg: HUT.deg },
    cues: [{ t: 0, sfx: 'creak' }, { t: HUT.swing, emit: 'sparkle', n: 2 }],
    sample: function (t, out, o) {
      var d0 = num(o.from, 'deg', 0);
      out.deg = o.reduced || t >= HUT.swing ? HUT.deg : d0 + (HUT.deg - d0) * ease.outCubic(clamp01(t / HUT.swing));
      return out;
    } });
  defIsleAct({ name: 'close', dur: 0.6, maxSec: 0.6, end: { deg: 0 },
    cues: [{ t: 0, sfx: 'creak', step: 1 }, { t: HUT.swing, sfx: 'chip' }],
    sample: function (t, out, o) {
      var d0 = num(o.from, 'deg', HUT.deg);
      out.deg = o.reduced || t >= HUT.swing ? 0 : d0 * (1 - ease.inOutSine(clamp01(t / HUT.swing)));
      return out;
    } });

  /* Rope bridge: the pet edges from postL to postR while the planks p0–p5 tilt up to ±6° in a wave
     travelling along the bridge, strongest round the pet (wobbleDeg). Reduced: the pet at postR. */
  var WOBBLE = { deg: 6, hz: 1.2, lag: 0.9, reach: 0.06 };
  defIsleAct({ name: 'wobble', dur: 3, maxSec: 3, end: { cross: 1, amp: 0 },
    cues: [{ t: 0.2, sfx: 'creak', step: 0 }, { t: 1.1, sfx: 'creak', step: 1 }, { t: 2.0, sfx: 'creak', step: 2 },
           { t: 2.8, sfx: 'voice', pet: true }],
    sample: function (t, out, o) {
      if (o.reduced) { out.cross = 1; out.amp = 0; return out; }
      out.cross = ramp(t, 0.3, 2.7);
      out.amp = WOBBLE.deg * env(t, 0.2, 0.5, 2.5, 2.9);
      return blendFrom(out, o.from, ['amp'], t);
    } });
  /* plank i of n: its tilt in degrees for a sampled 'wobble' pose s ({cross, amp}) at act time t */
  function wobbleDeg(t, i, n, s, reduced) {
    if (reduced || !s || !(s.amp > 0)) return 0;
    var u = (i + 0.5) / Math.max(1, n | 0) - (s.cross || 0);
    return s.amp * Math.sin(TAU * WOBBLE.hz * t - i * WOBBLE.lag) * (0.35 + 0.65 * Math.exp(-u * u / WOBBLE.reach));
  }

  /* Ice rink: one figure-of-eight through lap0 … lap7 and back (lap = the pet's progress, 1 = the
     whole loop), gliding to a stop; scratch lines (fx 'trail') fade over 2 s. lap is mod 1/8 (an
     anchor). Reduced: one anchor on, in the glide pose. */
  var SKATE = { anchors: 8 };
  defIsleAct({ name: 'skate', dur: 3, maxSec: 3, end: { lap: 0, glide: 1 }, mod: { lap: 1 / SKATE.anchors },
    cues: [{ t: 0.2, sfx: 'whoosh', vol: 0.5 }, { t: 0.3, emit: 'trail', n: 1 }, { t: 1.4, sfx: 'skid', vol: 0.5 },
           { t: 1.4, emit: 'trail', n: 1 }, { t: 2.7, sfx: 'voice', pet: true }],
    sample: function (t, out, o) {
      if (o.reduced) { out.lap = 1 / SKATE.anchors; out.glide = 1; return out; }
      out.lap = ramp(t, 0.2, 2.6);
      out.glide = smoothstep(2.2, 2.8, t);
      return out;
    } });

  /* Big Wheel (landmark): a quarter turn in 4 s (0.0625 rev/s on average) with the active pet in
     the front gondola (g0–g7 counter-rotate to hang level) while the spoke bulbs chase round the
     rim (wheelBulb). deg = extra turn on the 'wheel' pivot (mod 45°: one gondola); bulbs = the
     chase envelope. Reduced: one gondola on, at once; the bulbs stay steady. */
  var WHEEL = { turn: 90, index: 45, from: 0.2, to: 3.8, chaseFrom: 0.3, chaseEnd: 3.9, steady: 0.8 };
  WHEEL.snap = Math.acos((WHEEL.steady - 0.625) / 0.375);   /* the chase phase where a bulb shows the steady glow */
  defIsleAct({ name: 'wheel', dur: 4, maxSec: 6, end: { deg: 0, bulbs: 0 }, mod: { deg: WHEEL.index }, rates: { bulbs: 'bulbChase' },
    cues: [{ t: 0.1, sfx: 'creak' }, { t: 0.3, sfx: 'musicbox', step: 1 }, { t: 2, sfx: 'voice', pet: true },
           { t: 3.8, sfx: 'star', vol: 0.6 }, { t: 3.8, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.deg = WHEEL.index; out.bulbs = 0; return out; }
      out.deg = WHEEL.turn * ramp(t, WHEEL.from, WHEEL.to);
      out.bulbs = env(t, WHEEL.chaseFrom, 0.6, 3.3, WHEEL.chaseEnd);
      return out;
    } });
  /* spoke bulb i of n at act time t: a full-contrast chase (0.25 … 1) round the rim, each bulb
     peaking at ART3.FREQS.bulbChase (never above LED_CHASE_HZ). A bulb joins the chase at the first
     moment after chaseFrom that its chase value equals the steady glow and leaves it the same way
     by chaseEnd, so nothing steps and no bulb peaks faster than the rate. Otherwise: steady. */
  function wheelBulb(t, i, n, reduced) {
    var hz = Math.min(freq('bulbChase'), ledHz());
    if (reduced || !(hz > 0)) return WHEEL.steady;
    var m = Math.max(1, n | 0), off = i / m + WHEEL.snap / TAU;
    var on = (Math.ceil(hz * WHEEL.chaseFrom - off) + off) / hz, stop = (Math.floor(hz * WHEEL.chaseEnd - off) + off) / hz;
    if (t < on || t >= stop) return WHEEL.steady;
    return 0.625 + 0.375 * Math.cos(TAU * (hz * t - i / m));
  }

  /* Great Treehouse lift (landmark): the basket, resting at the top deck, drops to the ground for
     the pet and carries it up to deck2; the deck lamps dim while it is down, fade back on as it
     rises and breathe whole breaths at ART3.FREQS.breathe (never off). basket 0 = ground … 1 = deck2
     on the 'lift' pivot. Reduced: basket and pet at the top, lamps on. */
  var LIFT = { downA: 0.1, downB: 1.1, upA: 1.5, upB: 3.4, dim: 0.35, breatheAt: 2.6, breatheEnd: 3.9, depth: 0.25 };
  function breath(t) {
    var hz = freq('breathe'), s = t - LIFT.breatheAt;
    if (!(hz > 0) || s <= 0) return 0;
    var whole = Math.floor((LIFT.breatheEnd - LIFT.breatheAt) * hz + 1e-9);
    return s >= whole / hz ? 0 : 0.5 - 0.5 * Math.cos(TAU * hz * s);
  }
  defIsleAct({ name: 'lift', dur: 4, maxSec: 4, end: { basket: 1, lamps: 1 }, rates: { lamps: 'breathe' },
    cues: [{ t: 0.1, sfx: 'creak', step: 0 }, { t: 1.2, sfx: 'voice', pet: true }, { t: 1.5, sfx: 'creak', step: 2 },
           { t: 3.5, sfx: 'star', vol: 0.6 }, { t: 3.5, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.basket = 1; out.lamps = 1; return out; }
      var b0 = clamp01(num(o.from, 'basket', 1));
      out.basket = t < LIFT.upA ? b0 * (1 - ramp(t, LIFT.downA, LIFT.downB)) : ramp(t, LIFT.upA, LIFT.upB);
      out.lamps = 1 - (1 - LIFT.dim) * env(t, LIFT.downA, 0.6, LIFT.upA, LIFT.breatheAt) - LIFT.depth * breath(t);
      return blendFrom(out, o.from, ['lamps'], t);
    } });

  /* Treetop Lookout zip line (landmark): the trolley, resting at the landing, runs back up to the
     nest while the pet climbs the tower; then the pet zips nest → landing and waves. zip 0 = nest …
     1 = landing on the 'zip' pivot; climb and wave are the pet's (pets-brain 'zip').
     Reduced: the pet at the landing post, waving. */
  var ZIP = { backA: 0.1, backB: 1.2, climbB: 1.3, goA: 1.5, goB: 3.0, waveA: 3.05, waveB: 3.35 };
  defIsleAct({ name: 'zip', dur: 4, maxSec: 4, end: { climb: 1, zip: 1, wave: 1 },
    cues: [{ t: 0.2, sfx: 'tick', step: 0 }, { t: 0.6, sfx: 'tick', step: 2 }, { t: 1.0, sfx: 'tick', step: 4 },
           { t: 1.5, sfx: 'zip' }, { t: 3.0, sfx: 'chip' }, { t: 3.1, sfx: 'voice', pet: true }, { t: 3.1, emit: 'sparkle', n: 4 }],
    sample: function (t, out, o) {
      if (o.reduced) { out.climb = 1; out.zip = 1; out.wave = 1; return out; }
      var z0 = clamp01(num(o.from, 'zip', 1));
      out.climb = ramp(t, ZIP.backA, ZIP.climbB);
      out.zip = t < ZIP.goA ? z0 * (1 - ramp(t, ZIP.backA, ZIP.backB)) : ramp(t, ZIP.goA, ZIP.goB, ease.inOutQuad);
      out.wave = ramp(t, ZIP.waveA, ZIP.waveB);
      return out;
    } });

  /* Castle Keep drawbridge (landmark; a toggle, lit memory = down): the bridge lowers on its chains
     over 1.5 s, the banners unfurl with a fanfare and the pet trots from the door to the gate;
     'drawbridgeUp' raises it and furls the banners. down 0 = up … 1 = down on the 'bridge' pivot;
     banners 0 = furled … 1 = unfurled; trot is the pet's (pets-brain 'cross').
     Reduced: down / up at once, banners unfurled when down. */
  var KEEP = { a: 0.2, b: 1.7, unfurl: 2.3, trotB: 3.8 };
  defIsleAct({ name: 'drawbridge', dur: 4, maxSec: 4, end: { down: 1, banners: 1, trot: 1 },
    cues: [{ t: 0.1, sfx: 'chain' }, { t: KEEP.b, sfx: 'chip' }, { t: 1.8, sfx: 'fanfare' }, { t: 1.8, emit: 'sparkle', n: 6 },
           { t: 2.4, sfx: 'voice', pet: true }],
    sample: function (t, out, o) {
      if (o.reduced) { out.down = 1; out.banners = 1; out.trot = 1; return out; }
      var d0 = clamp01(num(o.from, 'down', 0));
      out.down = d0 + (1 - d0) * ramp(t, KEEP.a, KEEP.b);
      out.banners = Math.max(clamp01(num(o.from, 'banners', 0)), ramp(t, KEEP.b, KEEP.unfurl, ease.outCubic));
      out.trot = ramp(t, KEEP.unfurl, KEEP.trotB);
      return out;
    } });
  defIsleAct({ name: 'drawbridgeUp', dur: 2, maxSec: 4, end: { down: 0, banners: 0, trot: 0 },
    cues: [{ t: 0.1, sfx: 'chain' }, { t: KEEP.b, sfx: 'chip' }],
    sample: function (t, out, o) {
      if (o.reduced) { out.down = 0; out.banners = 0; out.trot = 0; return out; }
      var d0 = clamp01(num(o.from, 'down', 1)), b0 = clamp01(num(o.from, 'banners', 1));
      out.down = d0 * (1 - ramp(t, KEEP.a, KEEP.b));
      out.banners = b0 * (1 - ramp(t, 0, 0.5));
      out.trot = 0;
      return out;
    } });

  /* Great Igloo (landmark): the three penguins standing at the foot of the ice ramp waddle in at the
     door one after another, pop back out, waddle up to the ramp top and belly-slide down to the foot
     again, a squeak each. p0–p2 = each penguin's way round, 0 … 4 (penguinLeg; mod 4, so the trip
     ends where it began and the reduced variant is the three at rampFoot); rock = the shared waddle
     tilt in degrees (alternate penguins mirrored; only while waddling). */
  var PENGUIN = { start: 0.2, gap: 0.45, legs: [1.1, 0.7, 1.4, 0.8], rock: 10, rockHz: 1.6 };
  var PEN_KEYS = ['p0', 'p1', 'p2'];
  function penguinRoute(t, i) {
    var s = t - PENGUIN.start - i * PENGUIN.gap;
    if (s <= 0) return 0;
    for (var k = 0; k < 4; k++) {
      var len = PENGUIN.legs[k];
      if (s < len) { var u = s / len; return k + (k === 1 ? u : k === 3 ? ease.inQuad(u) : ease.inOutSine(u)); }
      s -= len;
    }
    return 4;
  }
  /* a way-round value → {leg, k}: 0 waddle to the door · 1 inside (hidden) · 2 waddle out and up
     to the ramp top · 3 belly-slide to the foot; k = how far along that leg */
  function penguinLeg(u, out) {
    out = out || {};
    var w = ((u % 4) + 4) % 4, leg = Math.min(3, Math.floor(w));
    out.leg = leg; out.k = w - leg;
    return out;
  }
  var PEN_CUES = [];
  for (var pq = 0; pq < 3; pq++) PEN_CUES.push({ t: PENGUIN.start + pq * PENGUIN.gap + PENGUIN.legs[0] + PENGUIN.legs[1], sfx: 'squeak', step: pq });
  PEN_CUES.push({ t: PENGUIN.start + PENGUIN.legs[0] + PENGUIN.legs[1] + PENGUIN.legs[2], sfx: 'whoosh', vol: 0.4 },
                { t: 5.2, sfx: 'star', vol: 0.6 }, { t: 5.2, emit: 'sparkle', n: 4 });
  defIsleAct({ name: 'penguins', dur: 6, maxSec: 6, end: { p0: 0, p1: 0, p2: 0, rock: 0 }, mod: { p0: 4, p1: 4, p2: 4 },
    cues: PEN_CUES,
    sample: function (t, out, o) {
      if (o.reduced) { out.p0 = 0; out.p1 = 0; out.p2 = 0; out.rock = 0; return out; }
      for (var i = 0; i < 3; i++) out[PEN_KEYS[i]] = penguinRoute(t, i);
      out.rock = PENGUIN.rock * env(t, PENGUIN.start, 0.5, 4.4, 4.9) * Math.sin(TAU * PENGUIN.rockHz * Math.max(0, t - PENGUIN.start)) + 0;
      return out;
    } });
  Object.freeze(V3_ACTS);

  /* ---------------- a land's bridge build (the unlock) ----------------
     The deck builds from the Home gate outward in 0.5 u segments: each scales 0 → 1 over 0.12 s
     (outQuad, no overshoot), staggered so the whole bridge takes min(2.4 s, 0.22 s per u). Segment
     0 touches the Home gate; span(i) is its stretch as fractions of the way to the dock
     (SLGrid3D.V3.bridge(isle) a → b). Sounds: 'unlock', a 'coin' one step higher every 4th segment
     (≤ 4 a second), 'tada' 0.6 as the last lands. Reduced motion: built at once, one sparkle at
     the gate. Pass the previous result as `out` to reuse it every frame. */
  var BRIDGE_BUILD = { seg: 0.5, each: 0.12, perU: 0.22, maxSec: 2.4, coinEvery: 4, coinHz: 4 };
  function BridgeBuild() { this.t = 0; this.length = 0; this.segments = 0; this.total = 0; this.stagger = 0; this.reduced = false; this.done = false; }
  BridgeBuild.prototype.startAt = function (i) { return this.reduced ? 0 : Math.max(0, i) * this.stagger; };
  BridgeBuild.prototype.scaleAt = function (i) {
    if (!(i >= 0 && i < this.segments)) return 0;
    if (this.reduced) return 1;
    return ease.outQuad(clamp01((this.t - i * this.stagger) / BRIDGE_BUILD.each));
  };
  BridgeBuild.prototype.span = function (i, out) {
    out = out || {};
    var L = this.length > 0 ? this.length : 1;
    out.u0 = clamp01(i * BRIDGE_BUILD.seg / L); out.u1 = clamp01((i + 1) * BRIDGE_BUILD.seg / L);
    return out;
  };
  BridgeBuild.prototype.cues = function () {
    if (this.reduced) return [{ t: 0, sfx: 'unlock' }, { t: 0, sfx: 'tada', vol: 0.6 }, { t: 0, emit: 'sparkle', n: 1 }];
    var list = [{ t: 0, sfx: 'unlock' }], every = BRIDGE_BUILD.coinEvery;
    while (this.segments > 1 && every * this.stagger < 1 / BRIDGE_BUILD.coinHz - 1e-9) every++;
    for (var i = 0, k = 0; i < this.segments; i += every, k++) list.push({ t: this.startAt(i), sfx: 'coin', step: k });
    list.push({ t: this.total, sfx: 'tada', vol: 0.6 });
    return list;
  };
  function bridgeBuild(tSec, lengthU, reduced, out) {
    var b = out instanceof BridgeBuild ? out : new BridgeBuild();
    var len = Math.max(0, +lengthU || 0), n = Math.max(1, Math.ceil(len / BRIDGE_BUILD.seg - 1e-9));
    b.t = +tSec || 0; b.length = len; b.segments = n; b.reduced = !!reduced;
    b.total = b.reduced ? 0 : Math.max(BRIDGE_BUILD.each, Math.min(BRIDGE_BUILD.maxSec, BRIDGE_BUILD.perU * len));
    b.stagger = !b.reduced && n > 1 ? (b.total - BRIDGE_BUILD.each) / (n - 1) : 0;
    b.done = b.reduced || b.t >= b.total;
    return b;
  }

  /* ================================================================
     Land-shop acts (My Island v3 wave 1b; catalogAdditions.acts.new, D86 / D110).
     One factory, defThemed(name, {dur, kind, cues, pet, toggle, …}), builds every
     timeline below from a table row. They all sample the same four channels,
     which each item's own act handler maps onto its pivots:
       k      0 → 1    the main progress (a lap, a turn, a ramp); one way
       swing  −1 … 1   a swing about rest that ends at rest (× the model's degrees)
       bob    0 … 1    hops, or one rise, hold and fall (× the model's height)
       petT   0 → 1    the active pet's way through its part (0 when no pet takes part)
     Kinds: 'path' (k carries something along a route) · 'spin' (k turns a part) ·
     'swing' (the swing leads) · 'pop' (the bob leads) · 'toggle' (remembered, like a
     lamp: k is the open / lit level; sample with o.off = true to play it shut from
     wherever it was; end = on, endOff = off) · 'fx' (sound and particles only:
     nothing moves). Row shapes, all optional (the kind picks the defaults):
       k     [a, b, ease]              the ramp's seconds (and its curve)
       swing {at, hz, n, hold, to}     n cycles (whole halves) from `at`, dying away unless hold
       bob   {at, hz, n}               n hops · or {up: [a, b], down: [c, d], bounce: [h…], hz}
       pet   true | [a, b]             the seconds petT runs over (true = the whole act)
       lag, parts, each   parts that go one after another, `lag` s apart: a one-shot's (three
             fruits, two fish) sample the same timeline `lag` s apart; a toggle's (six buds, four
             rows of lanterns, `each` s long) all follow its one k through part(name, k, i), so
             they turn round together
       light an ART3.FREQS name: the rate of a light the model runs under the act
       fade, off, offCues   a toggle's ramp seconds both ways (0.4), its seconds and sounds when shut
       of, ids              an item's own show: the act it stands in for and the item ids that play it
     Every act lasts ≤ 3 s and nothing repeats faster than 2 Hz. A rate given as a
     name reads SLIslandLook.ART3.FREQS (spec.rates). Reduced motion is the end
     state at once (reducedDur 0), one sparkle and the same sounds at t = 0. A
     restart blends swing and bob out of the interrupted pose; k starts again (a
     toggle's carries on). An item that plays a shared act its own way has its own
     timeline (`of`, `ids`): actFor picks it by id. Island-only fun: no game, and
     nothing here awards or spends points.
     ================================================================ */
  var THEMED_ACTS = [], THEMED_KINDS = Object.freeze(['path', 'spin', 'swing', 'pop', 'toggle', 'fx']);
  var THEMED_BLEND = ['swing', 'bob'], THEMED_VARIANT = {};      /* 'act@id' → that item's own timeline */
  function rate(hz) { return typeof hz === 'string' ? freq(hz) : safeHz(hz); }
  /* as many of c.n cycles (in steps of `step`) as fit between c.at and the end at this rate */
  function fit(c, hz, end, step) { return Math.min(c.n, Math.floor((end - c.at) * hz / step + 1e-9) * step); }
  function swingAt(t, c, dur) {
    var hz = rate(c.hz), s = t - c.at;
    if (!(hz > 0) || s <= 0) return 0;
    var len = fit(c, hz, c.to || dur, 0.5) / hz;
    if (s >= len - 1e-9) return 0;
    var v = Math.sin(TAU * hz * s) * (c.hold ? 1 : 1 - ease.inQuad(s / len));
    return v === 0 ? 0 : v;
  }
  function bobAt(t, c, dur) {
    var hz = rate(c.hz || MAX_FLASH_HZ), s;
    if (!(hz > 0)) return 0;
    if (!c.up) { s = t - c.at; return s <= 0 || s >= fit(c, hz, dur, 1) / hz - 1e-9 ? 0 : Math.sin(PI * frac(s * hz)); }
    if (t < c.down[1]) return env(t, c.up[0], c.up[1], c.down[0], c.down[1]);
    s = (t - c.down[1]) * hz;
    return c.bounce && s < c.bounce.length ? c.bounce[Math.floor(s)] * Math.sin(PI * frac(s)) : 0;
  }
  function defThemed(name, row) {
    if (ACTS[name]) throw new Error('SLMotion: act ' + name + ' is already defined');
    if (THEMED_KINDS.indexOf(row.kind) < 0) throw new Error('SLMotion: unknown act kind ' + row.kind);
    if (!(row.dur > 0 && row.dur <= 3)) throw new Error('SLMotion: ' + name + ' must last up to 3 s');
    var dur = row.dur, kind = row.kind, toggle = !!row.toggle, fx = kind === 'fx', fade = row.fade || 0.4;
    var kw = row.k || (kind === 'toggle' ? [0, fade, 'outCubic'] : kind === 'path' || kind === 'spin' ? [0.1, dur - 0.1] : [0, dur, 'linear']);
    var kFn = ease[kw[2] || 'inOutSine'], pw = row.pet === true ? [0, dur] : row.pet || null;
    var sw = row.swing || null, bb = row.bob || null, list = row.cues || [], rates = {};
    if (sw && typeof sw.hz === 'string') rates.swing = sw.hz;
    if (bb && typeof bb.hz === 'string') rates.bob = bb.hz;
    if (row.light) rates.light = row.light;
    var end = { k: fx ? 0 : 1, swing: 0, bob: 0, petT: pw ? 1 : 0 }, off = { k: 0, swing: 0, bob: 0, petT: 0 };
    var spec0 = { name: name, themed: true, kind: kind, toggle: toggle, pet: !!pw, of: row.of || name, dur: dur, reducedDur: 0,
      ids: row.ids || null, end: end, rates: rates, lag: row.lag || 0, parts: row.parts || 1, each: row.each || 0, cues: list,
      reducedCues: typeof list === 'function' ? function (o) { return reducedOf(list(o)); } : reducedOf(list),
      sample: function (t, out, o) {
        if (toggle && o.off) {
          endInto(out, off);
          if (!o.reduced && t < fade) out.k = clamp01(num(o.from, 'k', 1)) * (1 - ramp(t, 0, fade));
          return out;
        }
        if (fx || o.reduced || t >= dur) return endInto(out, end);
        var k0 = toggle ? clamp01(num(o.from, 'k', 0)) : 0;
        out.k = k0 + (1 - k0) * ramp(t, kw[0], kw[1], kFn);
        out.swing = sw ? swingAt(t, sw, dur) : 0;
        out.bob = bb ? bobAt(t, bb, dur) : 0;
        out.petT = pw ? seg(t, pw[0], pw[1]) : 0;
        return blendFrom(out, o.from, THEMED_BLEND, t);
      } };
    if (toggle) {
      spec0.endOff = off; spec0.offDur = row.off || dur;
      spec0.offCues = row.offCues || []; spec0.offReducedCues = reducedOf(spec0.offCues);
    }
    defAct(spec0);
    (row.ids || []).forEach(function (id) { THEMED_VARIANT[spec0.of + '@' + id] = name; });
    THEMED_ACTS.push(name);
    return spec0;
  }

  /* ---- Funfair Pier ---- */
  /* wobbly mirrors: swing + = the pet tall and thin (0.8 s), − = short and wide (0.8 s); bob = the spring-back hop */
  defThemed('mirrors', { dur: 2.5, kind: 'pop', pet: [0.1, 2.3], light: 'breathe',
    swing: { at: 0.2, hz: 0.625, n: 1, hold: true }, bob: { at: 1.8, hz: 2, n: 1 },
    cues: [{ t: 0.2, sfx: 'squeak', step: 0 }, { t: 1.0, sfx: 'squeak', step: 2 }, { t: 1.8, sfx: 'boing' }] });
  /* drop tower: bob = the seat ring's height (up in 1.4 s, a 0.4 s wait, a soft drop, two bounces) */
  defThemed('droptower', { dur: 3, kind: 'pop', pet: true, light: 'breathe',
    bob: { up: [0, 1.4], down: [1.8, 2.0], bounce: [0.14, 0.05], hz: 2 },
    cues: [{ t: 0.2, sfx: 'tick', step: 0 }, { t: 0.7, sfx: 'tick', step: 2 }, { t: 1.2, sfx: 'tick', step: 4 },
           { t: 1.8, sfx: 'whoosh' }, { t: 2.0, sfx: 'boing', vol: 0.6 }] });
  /* teacups: k = the floor's half turn (and each cup's own spin) */
  defThemed('teacups', { dur: 3, kind: 'spin', pet: true,
    cues: [{ t: 0.1, sfx: 'musicbox', step: 2 }, { t: 2.9, sfx: 'chip' }] });
  /* flying chairs: k = the canopy's three-quarter turn; bob = how far the chairs swing out */
  defThemed('chairs', { dur: 3, kind: 'spin', pet: true, light: 'breathe', bob: { up: [0.2, 0.9], down: [2.2, 2.9] },
    cues: [{ t: 0.1, sfx: 'musicbox', step: 0 }, { t: 0.5, sfx: 'whoosh', vol: 0.5 }] });
  /* swing ship: out and back twice at 0.7 Hz, then at rest */
  defThemed('swingship', { dur: 3, kind: 'swing', pet: true, swing: { at: 0.1, hz: 0.7, n: 2 },
    cues: [{ t: 0.1, sfx: 'creak' }, { t: 0.45, sfx: 'whoosh', vol: 0.6 }, { t: 1.9, sfx: 'whoosh', vol: 0.4 }] });
  /* little train: k = one lap of the oval (the signal lifts with it); three funnel puffs 0.7 s apart */
  defThemed('train', { dur: 3, kind: 'path', pet: true, k: [0.2, 2.8],
    cues: [{ t: 0.1, sfx: 'beep' }, { t: 0.3, sfx: 'chain' }, { t: 0.4, emit: 'dust', n: 1 }, { t: 1.1, emit: 'dust', n: 1 },
           { t: 1.8, emit: 'dust', n: 1 }, { t: 2.8, sfx: 'tick' }] });
  /* dodgems: k = the cars' lap of the floor; bob = the soft bump */
  defThemed('dodgems', { dur: 3, kind: 'path', pet: true, k: [0.1, 2.8], bob: { at: 1.4, hz: 2, n: 1 },
    cues: [{ t: 0.1, sfx: 'beep' }, { t: 1.5, sfx: 'boing', vol: 0.6 }] });
  /* log flume: k = the log round the channel and over the drop (it gathers speed); bob = its bob in the pool */
  defThemed('flume', { dur: 3, kind: 'path', pet: true, k: [0.1, 2.4, 'inQuad'], bob: { at: 2.4, hz: 2, n: 1 },
    cues: [{ t: 1.8, sfx: 'whoosh' }, { t: 2.4, sfx: 'splash' }, { t: 2.4, emit: 'drop', n: 8 }] });
  /* coaster: k = one lap (lift hill, loop, station) */
  defThemed('coaster', { dur: 3, kind: 'path', pet: true, light: 'breathe', k: [0.1, 2.8, 'inOutQuad'],
    cues: [{ t: 0.1, sfx: 'chain' }, { t: 1.3, sfx: 'whoosh' }, { t: 2.8, sfx: 'tada', vol: 0.5 }] });
  /* candyfloss: k = the drum's spin and the cloud's three steps; bob = the pet's hop for a nibble */
  defThemed('floss', { dur: 2, kind: 'spin', pet: [1.4, 1.9], k: [0.1, 1.5], bob: { at: 1.5, hz: 2, n: 1 },
    cues: [{ t: 0.1, sfx: 'whoosh', vol: 0.4 }, { t: 1.5, sfx: 'chip' }] });
  /* popcorn: bob = three kernel hops; the bag pops out at 1.6 s */
  defThemed('popcorn', { dur: 2, kind: 'pop', pet: [1.5, 1.9], bob: { at: 0.1, hz: 2, n: 3 },
    cues: [{ t: 0.1, sfx: 'tick', step: 0 }, { t: 0.6, sfx: 'tick', step: 2 }, { t: 1.1, sfx: 'tick', step: 4 }, { t: 1.6, sfx: 'chip' }] });
  /* ice-cream kiosk (toggle; lit = hatch open, cone on the counter) */
  defThemed('scoop', { dur: 0.6, kind: 'toggle', toggle: true, pet: true,
    cues: [{ t: 0, sfx: 'chip' }, { t: 0.4, emit: 'sparkle', n: 2 }], offCues: [{ t: 0, sfx: 'chip', step: 1 }] });
  /* deckchair: bob = the canvas sagging while the pet sits back */
  defThemed('lounge', { dur: 2, kind: 'pop', pet: [0.1, 1.9], bob: { up: [0.4, 0.6], down: [1.5, 1.7] },
    cues: [{ t: 0.5, sfx: 'creak' }] });
  /* balloon stand: bob = the lift off the ground; swing = two gentle bobs in the air at 1 Hz */
  defThemed('liftoff', { dur: 2.5, kind: 'pop', pet: true, bob: { up: [0.1, 0.5], down: [2.0, 2.4] },
    swing: { at: 0.5, hz: 1, n: 1.5, hold: true },
    cues: [{ t: 0.1, sfx: 'squeak' }, { t: 0.2, sfx: 'whoosh', vol: 0.4 }, { t: 2.4, sfx: 'boing', vol: 0.6 }] });

  /* ---- Jungle Falls ---- */
  /* canoe: k = one lap of the creek; bob = the frog hopping out of the way */
  defThemed('canoe', { dur: 3, kind: 'path', pet: true, k: [0.3, 2.8], bob: { at: 1.1, hz: 2, n: 1 },
    cues: [{ t: 0.2, sfx: 'splash', vol: 0.4 }, { t: 1.5, sfx: 'creak' }, { t: 2.8, sfx: 'voice', pet: true }] });
  /* climbing wall: bob = four hops up the holds at 1.5 Hz; swing = the bell's one swing at the top */
  defThemed('climb', { dur: 3, kind: 'pop', pet: [0.05, 2.7], bob: { at: 0.05, hz: 1.5, n: 4 }, swing: { at: 2.6, hz: 1.25, n: 0.5 },
    cues: [{ t: 0.05, sfx: 'chip', step: 0 }, { t: 0.72, sfx: 'chip', step: 1 }, { t: 1.38, sfx: 'chip', step: 2 },
           { t: 2.05, sfx: 'chip', step: 3 }, { t: 2.7, sfx: 'star' }, { t: 2.85, sfx: 'voice', pet: true }] });
  /* … the platform tree: three hops up the ladder, a wave, and down by 2.5 s */
  defThemed('climbDeck', { of: 'climb', ids: ['treetop_platform'], dur: 2.5, kind: 'pop', pet: [0.05, 2.4], bob: { at: 0.05, hz: 1.5, n: 3 },
    cues: [{ t: 0.05, sfx: 'chip', step: 0 }, { t: 0.72, sfx: 'chip', step: 1 }, { t: 1.38, sfx: 'chip', step: 2 },
           { t: 2.1, sfx: 'voice', pet: true }] });
  /* … the jungle den: k = the pet's trail (rope ladder, deck, a wave at the window, down the bamboo slide) */
  defThemed('climbSlide', { of: 'climb', ids: ['jungle_den'], dur: 3, kind: 'path', pet: [0.1, 2.8], k: [0.1, 2.8, 'linear'],
    cues: [{ t: 0.2, sfx: 'creak' }, { t: 1.8, sfx: 'whoosh' }, { t: 2.8, sfx: 'voice', pet: true }] });
  /* explorer camp: bob = the tent flap lifted; k = the spyglass's one sweep (60° in 1.2 s) */
  defThemed('camp', { dur: 3, kind: 'pop', pet: [0.3, 1.4], bob: { up: [0.1, 0.4], down: [2.5, 2.9] }, k: [1.4, 2.6],
    cues: [{ t: 0.1, sfx: 'chip' }, { t: 1.4, sfx: 'whoosh', vol: 0.4 }, { t: 2.6, sfx: 'voice', pet: true }] });
  /* monkey bars: k = along the five rungs; bob = the four swings between them (under 2 a second) */
  defThemed('bars', { dur: 3, kind: 'path', pet: [0.2, 2.8], k: [0.4, 2.6, 'linear'], bob: { at: 0.4, hz: 1 / 0.55, n: 4 },
    cues: [{ t: 0.4, sfx: 'whoosh', vol: 0.35 }, { t: 0.95, sfx: 'whoosh', vol: 0.35 }, { t: 1.5, sfx: 'whoosh', vol: 0.35 },
           { t: 2.05, sfx: 'whoosh', vol: 0.35 }, { t: 2.7, sfx: 'voice', pet: true }] });
  /* log drums: bob = four beats 0.55 s apart (the hit drum's top dips at each peak): low, low, middle, high */
  defThemed('drum', { dur: 2.4, kind: 'pop', pet: true, bob: { at: 0.05, hz: 1 / 0.55, n: 4 },
    cues: [{ t: 0.325, sfx: 'drum', step: 0 }, { t: 0.875, sfx: 'drum', step: 0 }, { t: 1.425, sfx: 'drum', step: 1 },
           { t: 1.975, sfx: 'drum', step: 2 }, { t: 1.975, emit: 'leaf', n: 2 }, { t: 2.3, sfx: 'voice', pet: true }] });
  /* flower arch (toggle; lit = in flower): k opens the six buds in turn (0.2 s apart, 0.3 s each); shut in 0.4 s */
  defThemed('bloom', { dur: 2.5, kind: 'toggle', toggle: true, pet: [0.3, 2.3], k: [0.1, 1.4, 'linear'], off: 0.4, lag: 0.2, parts: 6, each: 0.3,
    cues: [{ t: 0.1, sfx: 'chip', step: 0 }, { t: 0.5, sfx: 'chip', step: 2 }, { t: 0.9, sfx: 'chip', step: 4 }, { t: 1.4, sfx: 'star', vol: 0.4 }],
    offCues: [{ t: 0, sfx: 'chip' }] });
  /* hammock: the sling rocks at 0.6 Hz and settles */
  defThemed('rock', { dur: 3, kind: 'swing', pet: true, swing: { at: 0.4, hz: 0.6, n: 1.5 },
    cues: [{ t: 0.4, sfx: 'creak', vol: 0.4 }, { t: 2.6, sfx: 'voice', pet: true }] });
  /* coconut palm: swing = the crown's nod; k = the coconut's drop and roll to the trunk; bob = its one bounce */
  defThemed('coconut', { dur: 2.5, kind: 'swing', swing: { at: 0.1, hz: 1.25, n: 1 }, k: [0.6, 1.9], bob: { at: 1.0, hz: 2, n: 1 },
    cues: [{ t: 1.0, sfx: 'tick' }, { t: 2.2, sfx: 'pop', vol: 0.6 }, { t: 2.2, emit: 'sparkle', n: 1 }] });
  /* fruit stall: bob = one fruit's hop (three fruits, 0.25 s apart) */
  defThemed('juggle', { dur: 1.2, kind: 'pop', lag: 0.25, parts: 3, bob: { at: 0.1, hz: 1 / 0.6, n: 1 },
    cues: [{ t: 0.1, sfx: 'pop', step: 0 }, { t: 0.35, sfx: 'pop', step: 2 }, { t: 0.6, sfx: 'pop', step: 4 }] });
  /* parrot perch: bob = the hop along the perch; swing = two wing beats at the ambient parrots' rate */
  defThemed('chirp', { dur: 1.2, kind: 'pop', bob: { at: 0.05, hz: 2, n: 1 }, swing: { at: 0.2, hz: 'birdFlap', n: 1.5, hold: true },
    cues: [{ t: 0.1, sfx: 'trill' }] });

  /* ---- Treetop Adventure Park ---- */
  /* bird table: bob = the two birds down on the tray; swing = three pecks (− = heads down) */
  defThemed('feed', { dur: 2.5, kind: 'pop', bob: { up: [0.1, 0.6], down: [2.1, 2.5] },
    swing: { at: 0.6, hz: 'critterFlap', n: 3, hold: true, to: 2.1 },
    cues: [{ t: 0.6, sfx: 'squeak', step: 2, vol: 0.4 }, { t: 1.6, sfx: 'squeak', step: 4, vol: 0.4 }] });
  /* log xylophone: bob = the five bars dipping left to right, one every 0.5 s; cues(…, {tune}) plays
     CHIME_TUNES[tune % 3] (the model steps through them in order, one a tap) */
  var CHIME_TUNES = Object.freeze([Object.freeze([0, 1, 2, 3, 4]), Object.freeze([4, 2, 3, 1, 0]), Object.freeze([0, 2, 4, 2, 5])]);
  defThemed('chime', { dur: 2.5, kind: 'pop', pet: true, bob: { at: 0, hz: 2, n: 5 },
    cues: function (o) {
      var tune = CHIME_TUNES[(((o && o.tune) | 0) % 3 + 3) % 3];
      return tune.map(function (step, i) { return { t: 0.25 + 0.5 * i, sfx: 'xylo', step: step }; });
    } });
  /* … the snowflake sculpture: k = a quarter turn in 0.8 s */
  defThemed('chimeTurn', { of: 'chime', ids: ['ice_sculpture'], dur: 1.5, kind: 'spin', k: [0, 0.8],
    cues: [{ t: 0.05, sfx: 'musicbox', step: 2 }] });
  /* tree pod (toggle; lit = hatch open, the squirrel peeking out) */
  defThemed('peek', { dur: 0.6, kind: 'toggle', toggle: true,
    cues: [{ t: 0.05, sfx: 'squeak', step: 2 }], offCues: [{ t: 0, sfx: 'squeak', step: 0 }] });
  /* log tunnel: k = the pet through the tunnel (at the knothole round the middle); swing = its one shake */
  defThemed('crawl', { dur: 2.5, kind: 'path', pet: [0.1, 2.0], k: [0.1, 2.0, 'linear'], swing: { at: 2.0, hz: 2, n: 1 },
    cues: [{ t: 0.1, sfx: 'chip' }, { t: 1.05, sfx: 'chip', step: 2 }, { t: 1.05, emit: 'leaf', n: 2 }, { t: 2.1, sfx: 'voice', pet: true }] });
  /* balance beams: swing = the middle beam's one wobble as the pet crosses it */
  defThemed('balance', { dur: 3, kind: 'swing', pet: [0.2, 2.5], swing: { at: 1.0, hz: 1.25, n: 1 },
    cues: [{ t: 0.3, sfx: 'creak' }, { t: 1.0, sfx: 'creak', step: 1 }, { t: 2.6, sfx: 'cheer', vol: 0.5 }] });
  /* seesaw: the plank rocks at 1 Hz for 2 s */
  defThemed('seesaw', { dur: 3, kind: 'swing', pet: true, swing: { at: 0.5, hz: 1, n: 2 },
    cues: [{ t: 0.5, sfx: 'creak' }, { t: 1.5, sfx: 'creak', step: 1 }, { t: 2.6, sfx: 'voice', pet: true }] });
  /* telescope: bob = two hops up the pegs; k = the one sweep (60° in 1.2 s); the bubble shows at the star */
  defThemed('spy', { dur: 3, kind: 'pop', pet: [0, 1.0], bob: { at: 0, hz: 2, n: 2 }, k: [1.1, 2.3],
    cues: [{ t: 0, sfx: 'chip', step: 0 }, { t: 0.5, sfx: 'chip', step: 2 }, { t: 1.1, sfx: 'creak' }, { t: 2.4, sfx: 'star' }] });
  /* cargo net: bob = the net sagging under the pet (up the front, a sit on the top log, down the back) */
  defThemed('scramble', { dur: 3, kind: 'pop', pet: [0.1, 2.9], bob: { up: [0.1, 0.5], down: [2.5, 2.9] },
    cues: [{ t: 0.2, sfx: 'creak' }, { t: 1.5, sfx: 'chip' }] });
  /* leaf pile: bob = two hops up the stumps; petT ends as the pet lands; swing = the heap's squash */
  defThemed('leap', { dur: 3, kind: 'pop', pet: [0.1, 1.8], bob: { at: 0.1, hz: 2, n: 2 }, swing: { at: 1.8, hz: 1, n: 0.5 },
    cues: [{ t: 1.2, sfx: 'whoosh' }, { t: 1.8, sfx: 'chip' }, { t: 1.8, emit: 'leaf', n: 12 }, { t: 2.3, sfx: 'voice', pet: true }] });
  /* mini zip line (its own key: the landmark's 'zip' has the re-tap guard): k = the handle down the line */
  defThemed('zipline', { dur: 2.5, kind: 'path', pet: [0.1, 2.1], k: [0.9, 2.0, 'inOutQuad'],
    cues: [{ t: 0.9, sfx: 'zip' }, { t: 2.1, sfx: 'cheer', vol: 0.5 }] });

  /* ---- Castle Kingdom ---- */
  /* herb tub: the leaves shiver at 1.5 Hz */
  defThemed('rustle', { dur: 1.2, kind: 'swing', swing: { at: 0.1, hz: 1.5, n: 1.5 },
    cues: [{ t: 0.05, sfx: 'chip', vol: 0.25 }, { t: 0.3, emit: 'leaf', n: 3 }] });
  /* castle wall: two soft knocks and a dust puff; nothing moves (the joined pieces are never re-meshed) */
  defThemed('knock', { dur: 0.5, kind: 'fx',
    cues: [{ t: 0.05, sfx: 'tick' }, { t: 0.2, sfx: 'tick', step: 1 }, { t: 0.2, emit: 'dust', n: 1 }] });
  /* wishing well: bob = the bucket down in the well (k turns the crank) */
  defThemed('bucket', { dur: 2.5, kind: 'pop', pet: [0.3, 2.2], bob: { up: [0.1, 0.9], down: [1.2, 2.2] },
    cues: [{ t: 0.1, sfx: 'creak' }, { t: 0.9, sfx: 'splash' }, { t: 0.9, emit: 'splash', n: 1 }] });
  /* knight statue: bob = the visor up and the robin out; swing = the pennant's one wave */
  defThemed('salute', { dur: 2, kind: 'pop', bob: { up: [0.05, 0.35], down: [1.6, 1.95] }, swing: { at: 0.8, hz: 1.25, n: 1 },
    cues: [{ t: 0.5, sfx: 'squeak', step: 2 }, { t: 0.9, sfx: 'squeak', step: 4 }] });
  /* throne: bob = the pet's hop up the step; k = the three pennants unfurling */
  defThemed('royal', { dur: 2.5, kind: 'pop', pet: [0.1, 0.8], bob: { at: 0.1, hz: 2, n: 1 }, k: [0.8, 1.4, 'outCubic'],
    cues: [{ t: 0.8, sfx: 'fanfare', vol: 0.4 }, { t: 1.8, sfx: 'voice', pet: true }] });
  /* flower flinger: bob = the basket end up while the petals drift down */
  defThemed('toss', { dur: 3, kind: 'pop', pet: [0.05, 0.4], bob: { up: [0.3, 0.5], down: [2.5, 2.9] },
    cues: [{ t: 0.3, sfx: 'go', vol: 0.5 }, { t: 0.35, sfx: 'whoosh' }, { t: 0.4, emit: 'petal', n: 24 }] });
  /* moat bridge: k = the pet over the hump; bob = the two ducks out from under the arch; swing = their one bob */
  defThemed('ducks', { dur: 3, kind: 'path', pet: [0.1, 2.6], k: [0.1, 2.6, 'linear'], bob: { up: [0.4, 1.2], down: [1.9, 2.7] },
    swing: { at: 1.2, hz: 1, n: 0.5 },
    cues: [{ t: 0.4, sfx: 'splash', vol: 0.3 }, { t: 1.2, emit: 'splash', n: 1 }, { t: 1.4, sfx: 'quack' }] });
  /* bell tower: petT = the pet up the steps; the bell swings twice at 1 Hz */
  defThemed('bell', { dur: 3, kind: 'swing', pet: [0.05, 1.0], swing: { at: 0.9, hz: 1, n: 2 },
    cues: [{ t: 1.0, sfx: 'dong' }] });
  /* jousting lane: petT = the gallop down the lane; k = the dummy's one eased turn; swing = its wobble to rest */
  defThemed('joust', { dur: 3, kind: 'spin', pet: [0.1, 1.3], k: [1.3, 2.3], swing: { at: 2.3, hz: 1.5, n: 1 },
    cues: [{ t: 0.1, sfx: 'go', vol: 0.5 }, { t: 1.3, sfx: 'boing' }, { t: 2.5, sfx: 'voice', pet: true }] });
  /* hedge maze: k = the pet round the spiral (a leaf puff at each turn); swing = the pennant's one wave */
  defThemed('maze', { dur: 3, kind: 'path', pet: [0.1, 2.2], k: [0.1, 2.2, 'linear'], swing: { at: 2.2, hz: 1.25, n: 1 },
    cues: [{ t: 0.1, sfx: 'go', vol: 0.3 }, { t: 0.62, sfx: 'chip', step: 0, vol: 0.5 }, { t: 0.62, emit: 'leaf', n: 4 },
           { t: 1.15, sfx: 'chip', step: 1, vol: 0.5 }, { t: 1.15, emit: 'leaf', n: 4 }, { t: 1.67, sfx: 'chip', step: 2, vol: 0.5 },
           { t: 1.67, emit: 'leaf', n: 4 }, { t: 2.3, sfx: 'voice', pet: true }] });
  /* dragon fountain: bob = the head lifted while it blows water (never fire); swing = one wing flap */
  defThemed('spout', { dur: 3, kind: 'pop', pet: [0.2, 1.6], bob: { up: [0.1, 0.5], down: [1.9, 2.3] }, swing: { at: 2.25, hz: 1.5, n: 1 },
    cues: [{ t: 0.5, sfx: 'whoosh' }, { t: 0.6, emit: 'drop', n: 6 }, { t: 0.9, sfx: 'splash', vol: 0.6 }, { t: 1.2, emit: 'drop', n: 6 },
           { t: 1.8, emit: 'splash', n: 1 }] });

  /* ---- Ice Palace ---- */
  /* snowy pine: two sways at 1 Hz; k = the snow caps building back (1.5 s) */
  defThemed('shake', { dur: 2.5, kind: 'swing', swing: { at: 0.1, hz: 1, n: 2 }, k: [1.0, 2.5, 'linear'],
    cues: [{ t: 0.1, sfx: 'whoosh' }, { t: 2.4, sfx: 'pop', vol: 0.5 }] });
  /* … the snow globe: two rocks at 1 Hz; k = the flakes swirling up and drifting down */
  defThemed('shakeGlobe', { of: 'shake', ids: ['ice_snowglobe'], dur: 2.5, kind: 'swing', swing: { at: 0.1, hz: 1, n: 2 },
    cues: [{ t: 0.1, sfx: 'musicbox', step: 2 }] });
  /* penguin pair: k = the grown-up's tight circle; swing = its waddle roll; bob = the bow to the chick */
  defThemed('waddle', { dur: 2.5, kind: 'swing', k: [0.3, 1.9], swing: { at: 0.3, hz: 1.6, n: 2.5, hold: true },
    bob: { up: [1.9, 2.05], down: [2.25, 2.4] },
    cues: [{ t: 0.1, sfx: 'squeak' }, { t: 1.9, sfx: 'squeak', step: 2 }] });
  /* fishing hole: bob = one fish's leap (the smaller one follows 0.5 s later); nothing is caught */
  defThemed('fish', { dur: 2, kind: 'pop', pet: [0, 1.6], lag: 0.5, parts: 2, bob: { at: 0.1, hz: 1.25, n: 1 },
    cues: [{ t: 0.9, sfx: 'splash' }, { t: 0.9, emit: 'splash', n: 1 }, { t: 1.4, sfx: 'splash', vol: 0.6 }, { t: 1.4, emit: 'splash', n: 1 }] });
  /* ice bear: k = the shine from nose to tail (1 s); bob = the pet holding the nose-up pose (1.5 s) */
  defThemed('pose', { dur: 2.5, kind: 'pop', pet: [0.1, 1.0], k: [0.1, 1.1, 'linear'], bob: { up: [0.8, 1.0], down: [2.3, 2.5] },
    cues: [{ t: 0.1, sfx: 'star' }] });
  /* snow fort: bob = the pet's two pop-ups (front wall, then the turret); k = the pennant up its pole */
  defThemed('popup', { dur: 3, kind: 'pop', pet: [0.1, 1.9], bob: { at: 0.5, hz: 1.25, n: 2 }, k: [1.6, 2.6, 'outCubic'],
    cues: [{ t: 0.9, sfx: 'pop' }, { t: 1.7, sfx: 'pop', step: 2 }, { t: 2.6, sfx: 'tada', vol: 0.4 }] });
  /* penguin choir: the three sway at 1 Hz and sing low, middle, high twice over the music box */
  defThemed('sing', { dur: 3, kind: 'swing', pet: true, swing: { at: 0.2, hz: 1, n: 2.5 },
    cues: [{ t: 0.1, sfx: 'musicbox', step: 0 }, { t: 0.3, sfx: 'squeak', step: 0, vol: 0.5 }, { t: 0.65, sfx: 'squeak', step: 2, vol: 0.5 },
           { t: 1.0, sfx: 'squeak', step: 4, vol: 0.5 }, { t: 1.35, sfx: 'squeak', step: 0, vol: 0.5 }, { t: 1.7, sfx: 'squeak', step: 2, vol: 0.5 },
           { t: 2.05, sfx: 'squeak', step: 4, vol: 0.5 }, { t: 2.5, sfx: 'voice', pet: true }] });
  /* ski lift: k = the cable carrying the chairs up; swing = the chairs' bob at 1 Hz */
  defThemed('chairlift', { dur: 3, kind: 'path', pet: [0.1, 2.8], k: [0.3, 2.5], swing: { at: 0.5, hz: 1, n: 2, hold: true },
    cues: [{ t: 0.2, sfx: 'chain' }, { t: 1.2, sfx: 'creak' }, { t: 1.8, sfx: 'zip', vol: 0.4 }] });
  /* ice castle (toggle; lit = lights on): k lights the four lantern rows from the bottom (0.5 s apart, 0.4 s
     each, never a flash); dims in 0.4 s */
  defThemed('lights', { dur: 3, kind: 'toggle', toggle: true, pet: [1.0, 2.6], k: [0.2, 2.1, 'linear'], off: 0.4, lag: 0.5, parts: 4, each: 0.4,
    cues: [{ t: 0.2, sfx: 'musicbox', step: 2 }, { t: 2.2, sfx: 'tada', vol: 0.5 }], offCues: [{ t: 0, sfx: 'chip' }] });

  /* ---- the two V4.54 names that had no timeline (D110; the V4.54 models never read them) ---- */
  /* a lamp fading on or off in 0.3 s (the v3 lanterns; lit memory) */
  defThemed('glow', { dur: 0.3, kind: 'toggle', toggle: true, fade: 0.3,
    cues: [{ t: 0, sfx: 'star', vol: 0.6 }], offCues: [{ t: 0, sfx: 'chip' }] });
  /* a 1.6 s sway (banana leaves, the long banner, the snow penguin's flippers) */
  defThemed('wave', { dur: 1.6, kind: 'swing', swing: { at: 0, hz: 1.25, n: 2 },
    cues: [{ t: 0, sfx: 'whoosh', vol: 0.5 }] });
  Object.freeze(THEMED_ACTS);

  var NOOPT = {};
  function spec(name) { var s = ACTS[name]; if (!s) throw new Error('SLMotion: unknown act ' + name); return s; }
  /* part i of a toggle whose parts go one after another: its own 0 → 1 for the toggle's level k */
  function part(name, k, i) {
    var s = spec(name), each = s.each || 1, lag = s.lag || 0;
    if (!(k > 0)) return 0;
    return k >= 1 ? 1 : clamp01((k * (lag * ((s.parts || 1) - 1) + each) - lag * i) / each);
  }
  function sample(name, t, out, o) { var s = spec(name); return s.sample(t, out || {}, o || NOOPT); }
  /* the pose to hand a restarted act (called once at the restart, so it may allocate) */
  function carry(name, out) {
    spec(name);
    var c = {};
    for (var k in out) if (typeof out[k] === 'number') c[k] = out[k];
    return c;
  }
  function cues(name, o) {
    var s = spec(name), red = !!(o && o.reduced);
    var list = o && o.off && s.offCues ? (red ? s.offReducedCues : s.offCues) : red ? s.reducedCues : s.cues;
    if (typeof list === 'function') list = list(o || {});
    return list.slice().sort(function (a, b) { return a.t - b.t; });
  }
  function durOf(name, o) {
    var s = spec(name);
    if (o && o.reduced) return s.reducedDur;
    if (name === 'bounce') return leadOf(o) + BOUNCE.length;
    return o && o.off && s.offDur ? s.offDur : s.dur;
  }
  /* CATALOG act → act timeline */
  function actFor(act, id, lit) {
    switch (act) {
      case 'glow': return lit ? 'glowOff' : 'glowOn';
      case 'wave': return id === 'bunting' ? 'bunting' : id === 'flag_pole' ? 'flag' : 'wave';
      case 'spin': return 'spin';
      case 'bounce': return 'bounce';
      case 'splash': return 'splash';
      case 'swing': return 'swing';
      case 'bubbles': return 'bubbles';
      case 'home': return 'home';
      case 'launch': return id === 'att_kart' ? 'kartRev' : 'launch';
      case 'serve': case 'snap': case 'screen': case 'record': case 'dance': case 'hangout': case 'encore': return act;
      /* the sky islands (lit = the toggle's memory: doors open, drawbridge down) */
      case 'ride': case 'slide': case 'wobble': case 'skate': case 'wheel': case 'lift': case 'zip': case 'penguins': return act;
      case 'open': return lit ? 'close' : 'open';
      case 'drawbridge': return lit ? 'drawbridgeUp' : 'drawbridge';
    }
    /* the land shops: the act's own timeline, or the one an item plays in its place (a toggle
       keeps its name both ways: sample it with o.off = lit) */
    return ACTS[act] && ACTS[act].themed ? THEMED_VARIANT[act + '@' + id] || act : null;
  }

  /* ---------------- scene timelines ---------------- */
  var SHOW_MIX_SEC = 1.6, SHOW_MIX_REDUCED_SEC = 0.25;
  /* Day ↔ Showtime: from k0 toward target over 1.6 s inOutSine (0.25 s linear under reduced motion) */
  function showMix(t, k0, target, reduced) {
    var d = reduced ? SHOW_MIX_REDUCED_SEC : SHOW_MIX_SEC, u = clamp01(t / d);
    return k0 + (target - k0) * (reduced ? u : ease.inOutSine(u));
  }
  /* land unlock: each cell pops up 0.35 s (outBack) after its stagger delay */
  var RISE = { stagger: 0.05, each: 0.35 };
  function landRise(t, delay, reduced, out) {
    out = out || {};
    if (reduced) { out.y01 = 1; out.a = clamp01(t / 0.25); return out; }
    var u = clamp01((t - (delay || 0)) / RISE.each);
    out.y01 = u <= 0 ? 0 : ease.outBack(u); out.a = 1;
    return out;
  }
  function riseDur(n) { return Math.max(0, n - 1) * RISE.stagger + RISE.each; }
  /* camera reveal moves (inOutSine; instant cuts under reduced motion) */
  var CRANE = { from: 52, to: 40, out: 1.4, hold: 1.5, back: 1.0 };
  CRANE.dur = CRANE.out + CRANE.hold + CRANE.back;
  function crane(t, reduced, out) {
    out = out || {};
    var k;
    if (reduced) k = t >= 0 && t < CRANE.out + CRANE.hold ? 1 : 0;
    else if (t < CRANE.out) k = ease.inOutSine(clamp01(t / CRANE.out));
    else if (t < CRANE.out + CRANE.hold) k = 1;
    else k = 1 - ease.inOutSine(clamp01((t - CRANE.out - CRANE.hold) / CRANE.back));
    out.k = k; out.elev = lerp(CRANE.from, CRANE.to, k);
    return out;
  }
  function pushIn(t, reduced) { return reduced ? 1 : ease.inOutSine(clamp01(t / 0.7)); }
  function orbit(t, reduced) { return reduced || t <= 0 || t >= 8 ? 0 : 8 * Math.sin(PI * t / 8); }

  return {
    MAX_FLASH_HZ: MAX_FLASH_HZ, safeHz: safeHz, ease: ease,
    clamp: clamp, clamp01: clamp01, lerp: lerp, smoothstep: smoothstep, frac: frac,
    hash: hash, phaseOf: phaseOf, beatInfo: beatInfo,
    sway: sway, bob: bob, spin: spin, flutter: flutter, pennant: pennant, every: every, blink: blink,
    pulse: pulse, twinkle: twinkle, chase: chase, chaseWave: chaseWave, glint: glint,
    smoke: smoke, drop: drop, idleBubble: idleBubble, petal: petal, snowSparkle: snowSparkle,
    avatarBob: avatarBob, beamAngle: beamAngle, beamColor: beamColor, coneSweep: coneSweep, drift: drift,
    bubbleTrack: bubbleTrack, ripple: ripple,
    ACTS: ACTS, BLEND: BLEND, SPIN: SPIN, SWING: SWING, BOUNCE: BOUNCE,
    sample: sample, carry: carry, cues: cues, durOf: durOf, actFor: actFor,
    ON_AIR_SEC: ON_AIR_SEC, STRIP_SEC: STRIP_SEC, RATE: RATE, allow: allow, vu: vu, diagChase: diagChase, wave: wave,
    V3_ACTS: V3_ACTS, LANDMARK_BUSY: LANDMARK_BUSY, freq: freq, wheelBulb: wheelBulb, wobbleDeg: wobbleDeg,
    penguinLeg: penguinLeg, bridgeBuild: bridgeBuild, BRIDGE_BUILD: BRIDGE_BUILD,
    THEMED_ACTS: THEMED_ACTS, THEMED_KINDS: THEMED_KINDS, CHIME_TUNES: CHIME_TUNES, part: part,
    SHOW_MIX_SEC: SHOW_MIX_SEC, SHOW_MIX_REDUCED_SEC: SHOW_MIX_REDUCED_SEC, showMix: showMix,
    RISE: RISE, landRise: landRise, riseDur: riseDur, CRANE: CRANE, crane: crane, pushIn: pushIn, orbit: orbit
  };
}));
