/* ================================================================
   My Island v3 — SLSky3D: the sky world's environment (W3.3).
   window.SLSky3D (classic script; THREE from SL3D.THREE / K.THREE only). require() in Node gives the
   same object: its pure helpers run without THREE, create() runs on tests/helpers/mini-three.
   The env replacement on the v3 island (D5): island3d calls it by env's method names. It owns the
   sky backdrop, the two lights and the static shadow map, the Daytime ↔ Showtime blend, the
   pixel-vox haze uniforms (D8), the water (one mesh, one static canvas, D41) and the falling
   waterfall cubes, and it hosts SLIslesGL (the island meshes) and SLSkyLife3D (ambient life,
   feature-detected): it creates, forwards to and disposes them. Nothing here reads, awards or
   spends points.

   ON SCREEN (one draw call each)
     backdrop   scene.background = ONE 320 × 100 canvas (D7): NearestFilter, RepeatWrapping in x,
                repeat.x 0.5, sRGB (three leaves it un-tone-mapped) and no mipmaps (D81). 13 dithered
                bands, the pixel sun / crescent moon, the day rainbow framing Home from the left,
                sparkles or stars, 5 flat far clouds. offset.x follows the camera's yaw (and a little
                of its sideways travel): cheap parallax, no upload. Painted ≤ 15 fps while the bands
                move and, at night, every 0.5 s for the 12 star texels that twinkle; 0 otherwise.
     water      ONE InstancedMesh(1) on 'vox:water' over the wet columns of every open slab (Home,
                pier, jungle, castle, ice), sampling ONE static 1024 × 512 canvas at SLIsles3D's
                region rects: three depth tiers, the foam ring on the beach, two lapping rings whose
                checker swaps between frames A and B (one region width apart), the slab-edge lip,
                foam where the falls tip over, shallows texels, Home's locked regions as a pale
                sandbar with a dashed edge, lily pads (jungle) and floes (ice); LOW paints the floor
                in (opaque). Painted and uploaded once when the scene first runs, then one region
                (one upload) per land bought or region risen. The shared uWaterFrame steps at the
                tier's waterFps only while the visited island has water; uWaterAnim 0 under reduced
                motion or after the ladder's 'water' step. Crests and glints are the shader's.
     falls      one instancedCubes pool: fallsCubes per water fall of the visited island (LOW 0,
                MID 50, HIGH 100; halved by the 'particles' step) on pixel.js's parabola; hidden
                under reduced motion. Sheets, lip foam and mist are in the island's terrain.
   LIGHT  one HemisphereLight + one DirectionalLight at the visited island's centre + PX_SUN_POS;
     the moon shines from the same place, so the static shadow map (MID / HIGH, 1024 / 2048,
     framed on the visited island) re-renders only on arrival, an unlock, a layout change or
     invalidateShadows(). Changing the light colour never re-renders it.
   THE BLEND (SHOW_BLEND): k eases 2.0 s inOutSine (reduced motion: a 1.4 s linear fade) from where
     it is. The 13 bands wipe: night rolls down from the top band (each band 0.4 s, staggered
     0.12 s), day comes back from the horizon up. Edit / place eases the light (and the sky) back
     to Daytime over 0.6 s, or as long as LUMA_RULE needs: from Showtime that is the blend's time,
     so edit mode never changes the frame more than 0.20 per 0.5 s (reduced: a linear fade, a cut
     only when the change is that small). The mix models see (show) goes to K.setShow, isles-gl
     and the sky life. The 'lights on' ripple (wakeAt) spreads from the visited island's
     landmark, or Home's house, 40 ms per u, each light fading over 0.3 s; reversals never pop.
   HAZE (D8): uFogNear / uFogFar = settle(dist) + VOX_FOG; uFogMax 0.35 eases to 0 in the Sky map
     and is 0 while suspended for a game (D98); uSky = the light mix's haze colour.
   EXPOSURE (crisp C1): applyLight fits the shared uVoxGain to the two lights (K.vox.fitGain:
     Daytime 0.894, sunset and night 1; it only changes while the blend runs) and beforeRender
     writes it on every island frame, so a photocard or a game can never leave it wrong; suspend
     puts it back to 1 for the game (as the haze), resume restores the island's.

   API (contracts.sky3d)
     create(K, SL3D, {scene, renderer, tier, reduced, seed, name, unlocked (Home's regions),
       isles (unlocked lands), pending, visit, show, sound, fx}) → {VERSION 3, group, update(dt, t, showK?)
       → busy, beforeRender(renderer, camera), attach(renderer), setLand(unlocked, world?),
       riseRegion(region) → Promise (+ v2 handle), setIsles(unlocked, {pending}), buildBridge(isle),
       wakeIsle(isle), peek(isle, on), setVisit(isle), setSkyMap(on), setLayout(isle, footprints),
       showtime(on, {reduced}) → Promise (.dur), setShow(k), show (getter), light / lights
       {hemi, sun}, setEdit(on), setMember(hex), setUser({name, color, seed}), setSeed(seed),
       setReduced(on), setQuality(q), invalidateShadows(), lockedAt(x, z), heightAt(x, z),
       wakeAt(x, z) → 0..1, pick(origin, dir), signAnchor(isle, at), regionSign(region),
       skyColor() → '#hex' (the mid band now: the sky dip colour), settle(cameraDist),
       suspend(), resume(), hooks({sound, fx}), isles, life, info(), dispose()}
     v2 env calls with no v3 meaning are safe no-ops: aim, setConeMounts, reflections(),
       setPlaced (only Home's house, for the ripple); city is null.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLSky3D = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 3, TAU = Math.PI * 2;
  var ISLES = ['home', 'pier', 'jungle', 'treetop', 'castle', 'ice'];
  var BACKDROP = { W: 320, H: 100, repeatX: 0.5, bands: 13, mid: 6, slide: 0.0025 };
  var EDIT_SEC = 0.6, FOG_SEC = 1.0, SETTLE = 35;
  var WAKE = { perU: 0.04, fade: 0.3, settle: 1.2, chain: 16 };
  var TWINKLE = { every: 0.5, n: 12, min: 0.7 };
  var FALL = { rate: 0.22, size: 0.25, reach: 0.62, spread: 0.42, lip: 0.1, toks: ['PX Spray Pale', 'PX Spray', 'PX Glint', 'PX Spray Light', 'PX Spray Deep'] };
  var WATER = { alpha: [150, 205, 228], foam: 242, lap: [225, 205], lip: 238, sandbar: 0.45, shallows: 0.035 };
  var FALLBACK = { LOW: { waterFps: 4, fallsCubes: 0, shadows: false, shadowMapSize: 0 },
                   MID: { waterFps: 8, fallsCubes: 50, shadows: true, shadowMapSize: 1024 },
                   HIGH: { waterFps: 8, fallsCubes: 100, shadows: true, shadowMapSize: 2048 } };
  /* model-local colours (D50): the falling spray and the lapping foam */
  var TOKENS = { 'PX Spray Pale': '#BFF3FF', 'PX Spray': '#7FD8FF', 'PX Spray Light': '#9FE6FF', 'PX Spray Deep': '#5FCAF7', 'PX Water Lap': '#C4F1FF' };
  /* the backdrop's art in canvas texels (the Home view shows x 0 … 160) */
  var ART = {
    sun: { x: 22, y: 12, r: 4 }, moon: { x: 136, y: 14, r: 4, bite: [2, -1.2, 3.5] },
    rainbow: { x: 34, y: 76, r: 44, band: 2, squash: 1.15, alpha: 0.55 },
    clouds: [[18, 70], [140, 62], [70, 90], [30, 30], [112, 24]],
    sparkles: 16, sparkleTop: 45, stars: 60, plus: 12, starTop: 70
  };
  /* SLIsles3D's coast field (its fine column map), so the water lines up with the terrain's beach */
  var COAST = { pad: 0.3, wob: [0.16, 0.09], seed: 'sl-coast-v3:', margin: 3, beach: -0.3, S: 0.5, T: 8 };

  /* ---------------- siblings (browser globals; required lazily in Node) ---------------- */
  var sibs = {};
  function sibling(name, path, optional) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && typeof module === 'object' && module.exports && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (!m) { if (optional) return null; throw new Error('SLSky3D: ' + name + ' is not loaded'); }
    return (sibs[name] = m);
  }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function grid() { return sibling('SLGrid3D', './grid3d.js'); }
  function core() { return sibling('SLWorldCore', '../world-core.js'); }
  function bakes() { return sibling('SLIsles3D', './isles3d.js'); }

  /* ================================================================
     PURE HELPERS (Node-testable)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function inOutSine(t) { return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2; }
  function hash(a, b, s) {
    var h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B) ^ Math.imul((s | 0) + 1, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function rgbOf(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hexOf(c) { return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function tokens() { var L = look(); if (!L.resolve('PX Water Lap')) L.addTokens('sky3d', TOKENS); return L; }
  function tok(token) { var h = tokens().resolve(token); if (!h) throw new Error('SLSky3D: unknown colour ' + token); return rgbOf(h); }
  function blendSpec() { var L = look(); return L.SHOW_BLEND || { sec: 2, reducedSec: 1.4, bandFadeSec: 0.4, bandStaggerSec: 0.12, redrawFps: 15 }; }
  function lumaRule() { var L = look(); return L.LUMA_RULE || { maxDelta: 0.2, windowSec: 0.5 }; }

  /* ---------------- the light modes as plain numbers (pxPresetAt's piecewise mix, allocation-free) ---------------- */
  var PRE = null;
  function presets() {
    if (PRE) return PRE;
    var L = look();
    function one(k) {
      var p = L.pxPresetAt(k);
      return { bands: p.bands.map(rgbOf), hemiSky: rgbOf(p.hemi.sky), hemiGround: rgbOf(p.hemi.ground), hemiI: p.hemi.intensity, sun: rgbOf(p.sun.color),
        sunI: p.sun.intensity, haze: rgbOf(p.haze), farTop: rgbOf(p.farCloud.top), farUnder: rgbOf(p.farCloud.under), disc: rgbOf(p.disc.color), shade: rgbOf(p.disc.shade) };
    }
    PRE = [one(0), one(0.5), one(1)];
    PRE.rainbow = L.pxPresetAt(0).rainbow.map(rgbOf);
    PRE.glint = tok('PX Glint');
    return PRE;
  }
  /* key's colour (or band i's) at Showtime mix k into out (0..255 floats) */
  function mixColor(key, k, out, i) {
    var P = presets(), lo = k <= 0.5, t = lo ? k * 2 : k * 2 - 1, a = P[lo ? 0 : 1][key], b = P[lo ? 1 : 2][key];
    if (i != null) { a = a[i]; b = b[i]; }
    out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }
  function mixNum(key, k) { var P = presets(), lo = k <= 0.5, t = lo ? k * 2 : k * 2 - 1, a = P[lo ? 0 : 1][key]; return a + (P[lo ? 1 : 2][key] - a) * t; }

  /* ---------------- the Showtime blend and the band wipe ---------------- */
  function blendState(k) { k = clamp01(+k || 0); return { k: k, from: k, to: k, t: 0, dur: 0, reduced: false }; }
  /* from where k is toward target: SHOW_BLEND.sec inOutSine, or reducedSec linear (a colour fade) — on
     an island brighter by day than Home (the pier, Ice) the linear fade lengthens just enough to keep
     every 0.5 s window ≤ 0.18 of frame luminance (isle: the visited island) */
  function blendTo(b, target, reduced, isle) {
    var B = blendSpec(), L = look(), R = lumaRule();
    b.from = b.k; b.to = clamp01(+target || 0); b.t = 0; b.reduced = !!reduced;
    b.dur = b.from === b.to ? 0 : !b.reduced ? B.sec
      : Math.max(B.reducedSec, Math.abs(L.frameLuma(b.from, isle) - L.frameLuma(b.to, isle)) * R.windowSec / (0.9 * R.maxDelta));
    return b.dur;
  }
  function blendStep(b, dt) {
    if (b.t >= b.dur) { b.k = b.to; return false; }
    b.t = Math.min(b.dur, b.t + (dt > 0 ? dt : 0));
    var u = b.t / b.dur;
    b.k = b.t >= b.dur ? b.to : b.from + (b.to - b.from) * (b.reduced ? u : inOutSine(u));
    return true;
  }
  function wipeState(k) { k = clamp01(+k || 0); var ks = new Float64Array(13); ks.fill(k); return { ks: ks, to: k, t: 0, down: true }; }
  /* night rolls down from the top band, day comes back from the horizon band up */
  function wipeTo(w, target) { w.to = clamp01(+target || 0); w.down = w.to >= 0.5; w.t = 0; }
  /* each band waits its stagger, then moves at 1 / bandFadeSec per s from where it is (a reversal never jumps);
     reduced: every band is k. true while a band moved */
  function wipeStep(w, dt, reduced, k) {
    var B = blendSpec(), moved = false, i, v;
    if (reduced) { for (i = 0; i < 13; i++) if (w.ks[i] !== k) { w.ks[i] = k; moved = true; } return moved; }
    w.t += dt > 0 ? dt : 0;
    for (i = 0; i < 13; i++) {
      v = w.ks[i];
      if (v === w.to) continue;
      var run = Math.min(dt, w.t - B.bandStaggerSec * (w.down ? i : 12 - i));
      if (!(run > 0)) continue;
      var s = run / B.bandFadeSec;
      w.ks[i] = w.to > v ? Math.min(w.to, v + s) : Math.max(w.to, v - s);
      moved = true;
    }
    return moved;
  }
  /* how long the edit ease takes for a frame-luminance change d: EDIT_SEC, or long enough that no 0.5 s
     window changes more than 0.18 (inOutSine peaks at d · sin(π W / 2D)); reduced: a cut when d is that
     small, else a linear fade (d · W / D) */
  function editSec(d, reduced) {
    var W = lumaRule().windowSec, cap = 0.9 * lumaRule().maxDelta;
    d = Math.abs(d) || 0;
    if (reduced) return d <= cap ? 0 : d * W / cap;
    return d <= cap ? EDIT_SEC : Math.max(EDIT_SEC, Math.PI * W / (2 * Math.asin(cap / d)));
  }

  /* ---------------- the 'lights on' ripple (v2 env's WAKE rule, reversal-safe, allocation-free) ---------------- */
  function rippleNew(on) { return { base: on ? 1 : 0, on: !!on, t: 1e3, n: 0, segOn: [], segDur: [] }; }
  function rippleRun(w, on, since, delay, reduced) {
    var run = reduced ? since / blendSpec().reducedSec : (since - (delay || 0)) / WAKE.fade;
    if (!(run > 0)) return w;
    return on ? Math.min(1, w + run) : Math.max(0, w - run);
  }
  function rippleToggle(r, on) {
    on = !!on;
    if (on === r.on) return r;
    if (r.t >= WAKE.settle) { r.base = r.on ? 1 : 0; r.n = 0; }
    else {
      if (r.n >= WAKE.chain) {
        r.base = rippleRun(r.base, r.segOn[0], r.segDur[0], WAKE.settle / 2, false);
        for (var i = 1; i < r.n; i++) { r.segOn[i - 1] = r.segOn[i]; r.segDur[i - 1] = r.segDur[i]; }
        r.n--;
      }
      r.segOn[r.n] = r.on; r.segDur[r.n] = r.t; r.n++;
    }
    r.on = on; r.t = 0;
    return r;
  }
  function rippleAdvance(r, dt) { if (dt > 0 && r.t < 1e3) r.t = Math.min(1e3, r.t + dt); return r; }
  function rippleLevel(r, delay, reduced) {
    var w = r.base;
    for (var i = 0; i < r.n; i++) w = rippleRun(w, r.segOn[i], r.segDur[i], delay, reduced);
    w = rippleRun(w, r.on, r.t, delay, reduced);
    return w * w * (3 - 2 * w);
  }
  function wakeDelay(x, z, c) { return WAKE.perU * Math.sqrt((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z)); }

  /* ---------------- camera → backdrop offset, sun → shadow box ---------------- */
  /* yaw (rad, three's camera: 0 looks toward −z) and the camera's sideways position → texture.offset.x:
     a turn to the left slides the sky right, as a horizon would; sideways travel adds a little parallax */
  function backdropOffset(yaw, lateral) { var v = -yaw / TAU + (lateral || 0) * BACKDROP.slide; return v - Math.floor(v); }
  /* the shadow camera's box (light view space) round frame F's land, rim and item tops, light at sun */
  function shadowFit(F, sun) {
    var L = Math.sqrt(sun[0] * sun[0] + sun[1] * sun[1] + sun[2] * sun[2]), z = [sun[0] / L, sun[1] / L, sun[2] / L];
    var xl = Math.sqrt(z[2] * z[2] + z[0] * z[0]), x = [z[2] / xl, 0, -z[0] / xl], y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    var b = F.bounds, p = (F.pad || 0) + 0.7, o = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity, near: Infinity, far: -Infinity };
    [b.x0 - p, b.x1 + p].forEach(function (px) { [-2, (b.yTop - F.cy) + F.itemMaxH].forEach(function (py) { [b.z0 - p, b.z1 + p].forEach(function (pz) {
      var dx = px - F.cx, dz = pz - F.cz, u = dx * x[0] + py * x[1] + dz * x[2], v = dx * y[0] + py * y[1] + dz * y[2], d = L - (dx * z[0] + py * z[1] + dz * z[2]);
      o.left = Math.min(o.left, u); o.right = Math.max(o.right, u); o.bottom = Math.min(o.bottom, v); o.top = Math.max(o.top, v);
      o.near = Math.min(o.near, d); o.far = Math.max(o.far, d);
    }); }); });
    o.near = Math.max(0.5, o.near - 1); o.far += 1;
    return o;
  }

  /* ---------------- the twinkle: 12 of the 72 stars change every 0.5 s, each once per 3 s (≤ 0.5 Hz) ---------------- */
  function starLevel(s, step) { var ph = s % 6; return TWINKLE.min + (1 - TWINKLE.min) * hash(s, Math.floor((step - ph + 6) / 6), 77); }

  /* ---------------- the backdrop painter ---------------- */
  var SKYPX = null;
  function skyLayout() {
    if (SKYPX) return SKYPX;
    var W = BACKDROP.W, H = BACKDROP.H, rows = new Uint8Array(H), first = new Uint8Array(H), y, x, i;
    for (y = 0; y < H; y++) { rows[y] = Math.min(12, Math.floor(y * 13 / H)); first[y] = y && rows[y] !== rows[y - 1] ? 1 : 0; }
    var R = ART.rainbow, bow = [];
    for (y = 0; y < R.y; y++) for (x = -R.r; x < R.x + R.r; x++) {
      var band = Math.floor((R.r - Math.sqrt((x - R.x) * (x - R.x) + (y - R.y) * (y - R.y) * R.squash * R.squash)) / R.band);
      if (band >= 0 && band < 6 && x >= 0) bow.push(x, y, band);
    }
    function spots(n, top, salt, clearOf) {
      var out = [];
      for (i = 0; out.length < n * 2 && i < n * 20; i++) {
        var sx = Math.floor(hash(i, salt, 3) * W), sy = 2 + Math.floor(hash(i, salt, 4) * (top - 2));
        if (clearOf && clearOf(sx, sy)) continue;
        out.push(sx, sy);
      }
      return out;
    }
    var M = ART.moon, S = ART.sun;
    function clear(sx, sy) { return (Math.abs(sx - M.x) < M.r + 3 && sy < M.y + M.r + 3) || (Math.abs(sx - S.x) < S.r + 3 && sy < S.y + S.r + 3); }
    SKYPX = { rows: rows, first: first, bow: new Int16Array(bow), sparkles: spots(ART.sparkles, ART.sparkleTop, 11, clear),
              stars: spots(ART.stars + ART.plus, ART.starTop, 23, clear) };
    return SKYPX;
  }
  var _band = [], _c = [0, 0, 0], _d = [0, 0, 0];
  for (var bi = 0; bi < 13; bi++) _band.push([0, 0, 0]);
  function put(buf, x, y, c, a) {
    var W = BACKDROP.W;
    if (y < 0 || y >= BACKDROP.H) return;
    x = ((x % W) + W) % W;
    var o = (y * W + x) * 4;
    if (a >= 1) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; }
    else { buf[o] += (c[0] - buf[o]) * a; buf[o + 1] += (c[1] - buf[o + 1]) * a; buf[o + 2] += (c[2] - buf[o + 2]) * a; }
    buf[o + 3] = 255;
  }
  /* paint the whole backdrop into buf (W × H RGBA): bands[13] (each band's own k), k (the sun, moon,
     rainbow, stars and clouds), step (the twinkle step). Deterministic; allocation-free */
  function paintBackdrop(buf, bands, k, step) {
    var W = BACKDROP.W, H = BACKDROP.H, P = presets(), X = skyLayout(), x, y, i, n, o;
    for (i = 0; i < 13; i++) mixColor('bands', bands[i], _band[i], i);
    for (y = 0; y < H; y++) {
      n = X.rows[y];
      var cur = _band[n], prev = n ? _band[n - 1] : cur, f = X.first[y];
      for (x = 0; x < W; x++) {
        var c = f && ((x & 1) === (n & 1)) ? prev : cur;
        o = (y * W + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
      }
    }
    /* the soft day rainbow, gone by k 0.35 */
    var ra = ART.rainbow.alpha * clamp01(1 - k / 0.35);
    if (ra > 0.004) for (i = 0; i < X.bow.length; i += 3) put(buf, X.bow[i], X.bow[i + 1], P.rainbow[X.bow[i + 2]], ra);
    /* sparkles by day (16 → 0 by k 0.5), stars at night (0 → 60 + 12 plus stars from k 0.5) */
    var g = P.glint, moonK = k <= 0.5 ? 0 : k * 2 - 1, ns = Math.round(ART.sparkles * clamp01(1 - k * 2));
    for (i = 0; i < ns; i++) {
      x = X.sparkles[i * 2]; y = X.sparkles[i * 2 + 1];
      put(buf, x, y, g, 1);
      if (i % 3 === 0) { put(buf, x - 1, y, g, 0.7); put(buf, x + 1, y, g, 0.7); put(buf, x, y - 1, g, 0.7); put(buf, x, y + 1, g, 0.7); }
    }
    var np = Math.round(ART.stars * moonK), nq = Math.round(ART.plus * moonK);
    for (i = 0; i < ART.stars + ART.plus; i++) {
      var plus = i >= ART.stars;
      if (plus ? i - ART.stars >= nq : i >= np) continue;
      x = X.stars[i * 2]; y = X.stars[i * 2 + 1];
      var lv = starLevel(i, step);
      put(buf, x, y, g, lv);
      if (plus) { put(buf, x - 1, y, g, 0.6 * lv); put(buf, x + 1, y, g, 0.6 * lv); put(buf, x, y - 1, g, 0.6 * lv); put(buf, x, y + 1, g, 0.6 * lv); }
    }
    /* the pixel sun sinks to the lower edge by k 0.5 (turning sunset orange); the crescent moon rises after */
    var S = ART.sun, M = ART.moon, dx, dy, d2;
    if (k < 0.65) {
      var sy = k <= 0.5 ? S.y + (H - 1 - S.y) * inOutSine(k * 2) : H - 1 + 40 * (k - 0.5);
      mixColor('disc', Math.min(k, 0.5), _c);
      for (dy = -S.r - 2; dy <= S.r + 2; dy++) for (dx = -S.r - 2; dx <= S.r + 2; dx++) {
        d2 = dx * dx + dy * dy;
        if (d2 <= S.r * S.r + S.r * 0.6) put(buf, S.x + dx, Math.round(sy) + dy, _c, 1);
        else if (d2 <= (S.r + 1.6) * (S.r + 1.6)) put(buf, S.x + dx, Math.round(sy) + dy, _c, 0.25);
      }
    }
    if (moonK > 0) {
      var my = Math.round(M.y + (H + M.r + 2 - M.y) * (1 - inOutSine(moonK)));
      for (dy = -M.r; dy <= M.r; dy++) for (dx = -M.r; dx <= M.r; dx++) {
        if (dx * dx + dy * dy > M.r * M.r + M.r * 0.6) continue;
        var bx = dx - M.bite[0], by = dy - M.bite[1], b2 = bx * bx + by * by, rb = M.bite[2];
        if (b2 < rb * rb) continue;
        put(buf, M.x + dx, my + dy, b2 < (rb + 1.2) * (rb + 1.2) ? P[2].shade : P[2].disc, 1);
      }
    }
    /* five flat far clouds in front of it all */
    mixColor('farTop', k, _c); mixColor('farUnder', k, _d);
    for (i = 0; i < ART.clouds.length; i++) {
      var cx = ART.clouds[i][0], cy = ART.clouds[i][1];
      for (x = -6; x < 6; x++) { put(buf, cx + x, cy, _c, 1); put(buf, cx + x, cy + 1, _d, 1); }
      for (x = -4; x < 3; x++) { put(buf, cx + x, cy - 1, _c, 1); put(buf, cx + x, cy - 2, _c, 1); }
      for (x = -1; x < 3; x++) put(buf, cx + x, cy - 3, _c, 1);
    }
  }

  /* ---------------- water: SLIsles3D's slab columns, the region rects, the canvas texels ---------------- */
  function wobble(seed) {
    var h = grid().hash(String(seed)), p1 = (h & 0xffff) / 65536 * TAU, p2 = (h >>> 16) / 65536 * TAU;
    return function (x, z) { var t = Math.atan2(z, x); return COAST.wob[0] * Math.sin(5 * t + p1) + COAST.wob[1] * Math.sin(9 * t + p2); };
  }
  /* signed distance (cells) from grid point (gx, gz) to the union of the mask's cell squares: − inside */
  function cellDist(mask, cols, rows, gx, gz) {
    var c0 = Math.floor(gx), r0 = Math.floor(gz), inside = c0 >= 0 && r0 >= 0 && c0 < cols && r0 < rows && mask[r0 * cols + c0] === 1;
    var best = 49, R = inside ? 7 : 4;
    for (var r = r0 - R; r <= r0 + R; r++) for (var c = c0 - R; c <= c0 + R; c++) {
      if ((c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1) === inside) continue;
      var dx = gx < c ? c - gx : gx > c + 1 ? gx - c - 1 : 0, dz = gz < r ? r - gz : gz > r + 1 ? gz - r - 1 : 0, d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return inside ? -Math.sqrt(best) : Math.sqrt(best);
  }
  /* the thin decks over the water (SLIsles3D: the pier's stem and head, the jungle's jetty) */
  function deckOf(isle) {
    if (isle === 'pier') return function (c, r) { return r >= 6; };
    if (isle !== 'jungle') return null;
    var d = {};
    (core().ISLES.jungle.dock || []).forEach(function (p) { d[p[0] + ',' + p[1]] = 1; });
    return function (c, r) { return !!d[c + ',' + r]; };
  }
  /* the slab's 0.5 u columns as SLIsles3D bakes them: kind 0 sky · 1 water · 2 beach · 3 land, the coast
     (u, + inside) of the SOLID land, wet (water, or a deck over it) and locked (Home's locked cells).
     o {seed, land (Home's cell set)}; null for an island without a slab */
  function columns(isle, o) {
    o = o || {};
    var S = bakes(), G = grid(), C = core(), home = isle === 'home', slab = home ? S.homeSlab(o.seed) : S.skySlab(isle);
    if (!slab) return null;
    var F = G.V3.frame(isle), cols = F.cols, rows = F.rows, all = new Uint8Array(cols * rows), land, solid, deck = deckOf(isle), q, k, i;
    C.ISLE_CELLS[isle].forEach(function (key) { var p = key.split(','); all[+p[1] * cols + +p[0]] = 1; });
    if (home) {
      var set = o.land || G.landFrom(['home']);
      land = new Uint8Array(cols * rows);
      for (q = 0; q < land.length; q++) land[q] = all[q] && set[(q % cols) + ',' + ((q / cols) | 0)] ? 1 : 0;
    } else land = all;
    solid = land;
    if (deck) { solid = land.slice(); for (q = 0; q < solid.length; q++) if (deck(q % cols, (q / cols) | 0)) solid[q] = 0; }
    var n = 2, m = COAST.margin * n, w = cols * n + 2 * m, h = rows * n + 2 * m, N = w * h, wob = wobble(home ? COAST.seed + (o.seed == null ? '' : o.seed) : COAST.seed + isle);
    var out = { isle: isle, F: F, w: w, h: h, x0: F.offset[0] - COAST.margin, z0: F.offset[1] - COAST.margin, kind: new Uint8Array(N), coast: new Float32Array(N),
                wet: new Uint8Array(N), locked: new Uint8Array(N) };
    for (k = 0; k < h; k++) for (i = 0; i < w; i++) {
      var x = k * w + i, gx = (i - m + 0.5) * COAST.S, gz = (k - m + 0.5) * COAST.S, c = Math.floor(gx), r = Math.floor(gz), inG = c >= 0 && r >= 0 && c < cols && r < rows;
      var isLand = inG && land[r * cols + c] === 1, onDeck = isLand && !!deck && deck(c, r), coast = 1, kd = 3;
      if (!isLand || onDeck) {                                      /* solid land needs no coast: it is land */
        var wv = wob(gx - cols / 2, gz - rows / 2), dS = cellDist(solid, cols, rows, gx, gz);
        coast = COAST.pad - dS + wv;
        if (!isLand) {
          /* the slab: Home's field has the boat and gate lobes; a land's is its own coast round all its cells */
          var fv = home ? slab.field(F.offset[0] + gx, F.offset[1] + gz) : solid === all ? coast : COAST.pad - cellDist(all, cols, rows, gx, gz) + wv;
          kd = fv <= -slab.M ? 0 : coast >= COAST.beach ? 2 : 1;
        }
      }
      out.kind[x] = kd; out.coast[x] = coast;
      out.wet[x] = kd === 1 || onDeck ? 1 : 0;
      out.locked[x] = home && inG && all[r * cols + c] && !isLand ? 1 : 0;
    }
    return out;
  }
  /* the atlas rects (SLIsles3D.waterRegions' packer, without its outlines): {isle: {rect, frames, frameOffset, world, y}} */
  function regionRects(seed) {
    var S = bakes(), A = S.ATLAS, G = grid(), out = {}, x = A.gutter, y = A.gutter, rowH = 0;
    ISLES.forEach(function (isle) {
      var slab = isle === 'home' ? S.homeSlab(seed) : S.skySlab(isle);
      if (!slab) return;
      var b = slab.bounds, x0 = Math.floor(b.x0 * 2) / 2, x1 = Math.ceil(b.x1 * 2) / 2, z0 = Math.floor(b.z0 * 2) / 2, z1 = Math.ceil(b.z1 * 2) / 2;
      var w = (x1 - x0) * A.texels, h = (z1 - z0) * A.texels, frames = 2, need = 2 * w + A.gutter;
      if (x + need > A.w) { x = A.gutter; y += rowH + A.gutter; rowH = 0; }
      if (y + h > A.h) { frames = 1; need = w; }
      out[isle] = { rect: { x: x, y: y, w: w, h: h }, frames: frames, frameOffset: frames > 1 ? w + A.gutter : 0,
        world: { x0: x0, z0: z0, x1: x1, z1: z1 }, y: G.V3.frame(isle).cy + G.V3.SEA_Y };
      x += need + A.gutter; rowH = Math.max(rowH, h);
    });
    return out;
  }
  /* chessboard distance (texels, ≤ cap) to the nearest src texel: two passes */
  function chess(src, w, h, cap) {
    var d = new Uint8Array(w * h), x, y, i, v, n;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (src[i]) continue;
      v = cap;
      if (x && (n = d[i - 1] + 1) < v) v = n;
      if (y) {
        if ((n = d[i - w] + 1) < v) v = n;
        if (x && (n = d[i - w - 1] + 1) < v) v = n;
        if (x < w - 1 && (n = d[i - w + 1] + 1) < v) v = n;
      }
      d[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; v = d[i];
      if (!v) continue;
      if (x < w - 1 && (n = d[i + 1] + 1) < v) v = n;
      if (y < h - 1) {
        if ((n = d[i + w] + 1) < v) v = n;
        if (x < w - 1 && (n = d[i + w + 1] + 1) < v) v = n;
        if (x && (n = d[i + w - 1] + 1) < v) v = n;
      }
      d[i] = v;
    }
    return d;
  }
  var PADS = { jungle: { n: 9, rows: ['.##.', '####', '###.', '.##.'], ink: 'PX Jungle Canopy', hi: 'PX Jungle Canopy Light', dot: 'PX Jungle Flower Pink' },
               ice: { n: 7, rows: ['.###.', '#####', '.###.'], ink: 'PX Ice Snow 2', hi: 'PX Ice Snow', lo: 'PX Ice Snow Shade' } };
  /* one region's texels: frames A and B side by side (frameOffset apart), RGBA. o {seed, land, low} →
     {w (data width), h, data, cols} */
  function paintWater(isle, reg, o) {
    o = o || {};
    var col = columns(isle, o), th = look().ISLE_THEME[isle], R = reg.rect, w = R.w, h = R.h, N = w * h, T = COAST.T, TI = bakes().TIERS;
    var cls = new Uint8Array(N), tier = new Uint8Array(N), lock = new Uint8Array(N), x, y, i, t;
    /* the region starts on a column edge: texel (x, y) lies in column (ox + x / per, oz + y / per) */
    var per = COAST.S * T, ox = Math.round((reg.world.x0 - col.x0) / COAST.S), oz = Math.round((reg.world.z0 - col.z0) / COAST.S);
    for (y = 0; y < h; y++) {
      var cz = oz + ((y / per) | 0);
      if (cz < 0 || cz >= col.h) continue;
      for (x = 0; x < w; x++) {
        var cx = ox + ((x / per) | 0);
        if (cx < 0 || cx >= col.w) continue;
        var c = cz * col.w + cx, kd = col.kind[c], cs = -col.coast[c];
        i = y * w + x;
        cls[i] = !kd ? 0 : col.wet[c] ? 1 : 2;
        tier[i] = cs < TI[0] ? 0 : cs < TI[1] ? 1 : 2;
        lock[i] = col.locked[c];
      }
    }
    /* a one-texel checker where two tiers meet (pixel.js's dithered tier edge) */
    var dit = tier.slice();
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (cls[i] !== 1 || !((x + y) & 1)) continue;
      var lx = x % per, ly = y % per, j = lx === 0 ? i - 1 : lx === per - 1 ? i + 1 : ly === 0 ? i - w : ly === per - 1 ? i + w : -1;
      if (j >= 0 && j < N && cls[j] === 1 && tier[j] !== tier[i]) dit[i] = tier[j];
    }
    var dry = new Uint8Array(N), out = new Uint8Array(N), edge = new Uint8Array(N);
    for (i = 0; i < N; i++) { dry[i] = cls[i] === 2 ? 1 : 0; out[i] = cls[i] === 0 ? 1 : 0; }
    var dS = chess(dry, w, h, 24), dE = chess(out, w, h, 6);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (lock[i] && cls[i] === 1 && ((x && !lock[i - 1]) || (x < w - 1 && !lock[i + 1]) || (y && !lock[i - w]) || (y < h - 1 && !lock[i + w]))) edge[i] = 1;
    }
    /* stamps: lily pads (jungle) and floes (ice) clear of the beach foam and the rim, never touching */
    var ovr = new Int8Array(N).fill(-1), pal = [], pd = PADS[isle];
    if (pd) {
      pal = [tok(pd.ink), tok(pd.hi), tok(pd.dot || pd.lo)];
      var spots = [], placed = 0;
      for (i = 0; i < N; i++) if (cls[i] === 1 && dS[i] >= 4 && dE[i] >= 3) spots.push(i);
      for (t = 0; t < 120 && placed < pd.n && spots.length; t++) {
        var s0 = spots[Math.floor(hash(t, 5, isle.length) * spots.length)], px = s0 % w, py = (s0 / w) | 0, ok = true, a, b;
        for (b = -1; b <= pd.rows.length && ok; b++) for (a = -1; a <= pd.rows[0].length && ok; a++) {
          var q = (py + b) * w + px + a;
          if (px + a < 0 || py + b < 0 || px + a >= w || py + b >= h || cls[q] !== 1 || ovr[q] >= 0 || dS[q] < 3 || dE[q] < 2) ok = false;
        }
        if (!ok) continue;
        pd.rows.forEach(function (row, rb) { for (var ra = 0; ra < row.length; ra++) if (row[ra] === '#') ovr[(py + rb) * w + px + ra] = rb === 0 ? 1 : 0; });
        var cq = (py + (pd.rows.length >> 1)) * w + px + (pd.rows[0].length >> 1);
        if (pd.dot && placed % 2 === 0) ovr[cq] = 2;
        if (pd.lo) for (a = 0; a < pd.rows[0].length; a++) if (pd.rows[pd.rows.length - 1][a] === '#') ovr[(py + pd.rows.length - 1) * w + px + a] = 2;
        placed++;
      }
    }
    /* foam where each water fall tips over the rim */
    var foam = new Uint8Array(N);
    fallsOf(col).forEach(function (f) {
      if (f.kind !== 'water') return;
      var fx = (f.at[0] - f.dir[0] * 0.15 - reg.world.x0) * T - 0.5, fz = (f.at[2] - f.dir[1] * 0.15 - reg.world.z0) * T - 0.5, rr = 0.68 * T;
      for (y = Math.max(0, Math.floor(fz - rr)); y <= Math.min(h - 1, Math.ceil(fz + rr)); y++) for (x = Math.max(0, Math.floor(fx - rr)); x <= Math.min(w - 1, Math.ceil(fx + rr)); x++) {
        var dd = Math.sqrt((x - fx) * (x - fx) + (y - fz) * (y - fz)) / T;
        if (dd < 0.42) foam[y * w + x] = (x + y) & 1 ? 2 : 1; else if (dd < 0.68 && ((x + y) & 1) && !foam[y * w + x]) foam[y * w + x] = 1;
      }
    });
    var TOP = th.slab.tops.map(tok), FLOOR = th.slab.floor.map(tok), LIP = tok(th.slab.wall[0]), LAP = tok('PX Water Lap'), G = tok('PX Glint');
    var SAND = tok((look().ISLE_THEME.home.sandbar) || 'PX Sandbar'), frames = reg.frames > 1 ? 2 : 1, DW = frames > 1 ? reg.frameOffset + w : w;
    var data = new Uint8ClampedArray(DW * h * 4), cc = [0, 0, 0];
    for (var f = 0; f < frames; f++) for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (cls[i] !== 1) continue;
      var tr = dit[i], al = WATER.alpha[tr], top = TOP[tr], fl = FLOOR[tr], k2;
      for (k2 = 0; k2 < 3; k2++) cc[k2] = o.low ? fl[k2] + (top[k2] - fl[k2]) * al / 255 : top[k2];
      if (tr === 0 && hash(x, y, 31 + isle.length) < WATER.shallows) for (k2 = 0; k2 < 3; k2++) cc[k2] += (255 - cc[k2]) * 0.22;
      if (lock[i]) { for (k2 = 0; k2 < 3; k2++) cc[k2] += (SAND[k2] - cc[k2]) * WATER.sandbar; al += (255 - al) * WATER.sandbar; }
      var pc = null, pa = 0, par = (x + y) & 1;
      if (edge[i] && ((x + y) >> 1) & 1) { pc = G; pa = 230; }
      if (ovr[i] >= 0) { pc = pal[ovr[i]]; pa = 250; }
      if (foam[i]) { pc = foam[i] === 2 ? G : LAP; pa = 245; }
      if (dS[i] === 1) { pc = G; pa = WATER.foam; }
      else if (dS[i] === 2 && par === f) { pc = LAP; pa = WATER.lap[0]; }
      else if (dS[i] === 3 && par !== f) { pc = LAP; pa = WATER.lap[1]; }
      if (dE[i] === 1) { pc = LIP; pa = WATER.lip; }
      if (pc) { cc[0] = pc[0]; cc[1] = pc[1]; cc[2] = pc[2]; al = pa; }
      var o4 = (y * DW + x + f * reg.frameOffset) * 4;
      data[o4] = cc[0]; data[o4 + 1] = cc[1]; data[o4 + 2] = cc[2]; data[o4 + 3] = o.low ? 255 : al;
    }
    return { w: DW, h: h, data: data, cols: col };
  }
  /* the wet columns as merged rectangles (runs per row, stacked while identical): vox arrays at water
     height y, vuv = frame-A atlas UVs + waterZ(frameOffset) */
  function waterQuads(col, reg, atlas, out) {
    var A = atlas || bakes().ATLAS, T = A.texels, z4 = 4 + Math.max(0, Math.min(1023, reg.frameOffset)) / 2048, w = col.w, open = {}, rects = [], k, i;
    function close(key) { rects.push(open[key]); delete open[key]; }
    for (k = 0; k <= col.h; k++) {
      var runs = {};
      for (i = 0; k < col.h && i < w; i++) {
        if (!col.wet[k * w + i]) continue;
        var i0 = i;
        while (i + 1 < w && col.wet[k * w + i + 1]) i++;
        runs[i0 + ',' + i] = [i0, i];
      }
      Object.keys(open).forEach(function (key) { if (runs[key]) { open[key].k1 = k; delete runs[key]; } else close(key); });
      Object.keys(runs).forEach(function (key) { open[key] = { i0: runs[key][0], i1: runs[key][1], k0: k, k1: k }; });
    }
    out = out || { position: [], normal: [], color: [], vuv: [] };
    rects.forEach(function (r) {
      var x0 = col.x0 + r.i0 * COAST.S, x1 = col.x0 + (r.i1 + 1) * COAST.S, za = col.z0 + r.k0 * COAST.S, zb = col.z0 + (r.k1 + 1) * COAST.S;
      [[x0, za], [x0, zb], [x1, zb], [x0, za], [x1, zb], [x1, za]].forEach(function (p) {
        out.position.push(p[0], reg.y, p[1]); out.normal.push(0, 1, 0); out.color.push(1, 1, 1);
        out.vuv.push((reg.rect.x + (p[0] - reg.world.x0) * T) / A.w, 1 - (reg.rect.y + (p[1] - reg.world.z0) * T) / A.h, z4);
      });
    });
    return out;
  }
  /* where the falls pour off the rim, from the same columns (SLIsles3D.falls: the outermost slab column
     on each FALLS angle, its outward face, the mist below) */
  function fallsOf(col) {
    var F = col.F, S = COAST.S, m = COAST.margin * 2, home = col.isle === 'home', V3 = grid().V3, out = [];
    var iced = look().ISLE_THEME[col.isle].fallKind === 'iced';
    function kindAt(i, k) { i += m; k += m; return i < 0 || k < 0 || i >= col.w || k >= col.h ? 0 : col.kind[k * col.w + i]; }
    (bakes().FALLS[col.isle] || []).forEach(function (a) {
      var dx = Math.cos(a), dz = Math.sin(a), hit = null;
      for (var t = 0; t < 26; t += S / 4) { var i = Math.floor((dx * t + F.cols / 2) / S), k = Math.floor((dz * t + F.rows / 2) / S); if (kindAt(i, k) > 0) hit = [i, k]; }
      if (!hit) return;
      var ax = Math.abs(dx) >= Math.abs(dz), nx = ax ? (dx > 0 ? 1 : -1) : 0, nz = ax ? 0 : (dz > 0 ? 1 : -1);
      if (kindAt(hit[0] + nx, hit[1] + nz)) { nx = ax ? 0 : (dx > 0 ? 1 : -1); nz = ax ? (dz > 0 ? 1 : -1) : 0; }
      var x = (hit[0] + 0.5) * S - F.cols / 2 + nx * S / 2, z = (hit[1] + 0.5) * S - F.rows / 2 + nz * S / 2;
      out.push({ angle: a, kind: iced ? 'iced' : 'water', at: [F.cx + x, F.cy + V3.SEA_Y, F.cz + z], dir: [nx, nz],
                 mist: iced ? null : [F.cx + x + nx, F.cy + (home ? -4.75 : -4) + 0.25, F.cz + z + nz] });
    });
    return out;
  }
  /* a falling cube at cycle phase u: pixel.js's parabola from the lip (f: {at, dir, mist}, c: {j, j2}) */
  function fallAt(u, f, c, out) {
    var out2 = FALL.lip + FALL.reach * Math.sqrt(u) + c.j2 * (0.25 + u), sp = c.j * (0.5 + 0.6 * u) * FALL.spread;
    var y0 = f.at[1] - FALL.lip, drop = Math.max(1, y0 - (f.mist ? f.mist[1] - 0.15 : f.at[1] - 3.75));
    out.x = f.at[0] + f.dir[0] * out2 - f.dir[1] * sp;
    out.y = y0 - drop * (0.237 * u + 0.763 * u * u);
    out.z = f.at[2] + f.dir[1] * out2 + f.dir[0] * sp;
    out.s = FALL.size * (1 - 0.3 * u);
    return out;
  }

  /* ================================================================
     create(K, SL3D, opts)
     ================================================================ */
  function create(K, SL3D, opts) {
    opts = opts || {};
    var V = K && K.vox;
    if (!V || typeof V.terrainMesh !== 'function') throw new Error('SLSky3D.create needs K.vox (SLVoxGL bound to the kit)');
    var T = (SL3D && SL3D.THREE) || K.THREE || opts.THREE, L = tokens(), G = grid(), C = core(), S = bakes();
    var Tier = sibling('SLTier', './tier.js', true), up = typeof opts.tier === 'string' ? opts.tier.toUpperCase() : '';
    var tier = /^(LOW|MID|HIGH)$/.test(up) ? up : /^(LOW|MID|HIGH)$/.test(K.tier) ? K.tier : 'MID', low = tier === 'LOW';
    var budget = (SL3D && SL3D.budget) || (Tier && Tier.BUDGETS && Tier.BUDGETS[tier]) || FALLBACK[tier];
    if (budget.waterFps == null) budget = Object.assign({}, FALLBACK[tier], budget);
    var q0 = (SL3D && SL3D.quality) || {}, quality = { shadows: q0.shadows !== false, water: q0.water !== false, particleScale: q0.particleScale || 1 };
    var FOG = L.VOX_FOG || { nearAdd: 25, farAdd: 140, max: 0.35 }, U = V.uniforms, B = blendSpec();
    var warned = {};
    function warn(msg) { if (warned[msg]) return; warned[msg] = 1; if (typeof K.warn === 'function') K.warn('[sky3d] ' + msg); }
    function call(o, fn, a, b, c) {
      if (!o || typeof o[fn] !== 'function') return undefined;
      try { return o[fn](a, b, c); } catch (e) { warn(fn + ': ' + (e && e.message || e)); return undefined; }
    }
    function makeCanvas(w, h) {
      if (typeof opts.canvas === 'function') return opts.canvas(w, h);
      if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
      return null;
    }
    function canvasTex(cv, wrapX) {
      var t = new T.CanvasTexture(cv);
      t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace;
      if (wrapX) { t.wrapS = T.RepeatWrapping; t.repeat.set(BACKDROP.repeatX, 1); }
      return t;
    }
    var timers = [];
    function later(fn, ms) {
      var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); if (!st.disposed) fn(); }, ms);
      if (id && typeof id.unref === 'function') id.unref();
      timers.push(id);
    }
    function homeLand(arg) { return G.landFrom(arg == null ? ['home'] : arg); }
    function landSig(set) { return Object.keys(set).sort().join(';'); }

    var group = new T.Group();
    group.name = 'sky';
    var st = {
      reduced: !!opts.reduced, seed: opts.seed == null ? '' : opts.seed, visit: ISLES.indexOf(opts.visit) >= 0 ? opts.visit : 'home', skyMap: false,
      suspended: false, disposed: false, clock: 0, edit: false, editK: 0, editFrom: 0, editTo: 0, editT: 0, editDur: 0, editRed: false,
      kLight: -1, show: -1, fogTo: FOG.max, land: homeLand(opts.unlocked), open: {}, house: null,
      shadowDirty: true, shadowRenders: 0, wFrame: 0, wAcc: 0, falls: [], fallsDirty: true, risePending: false, voxGain: 1
    };
    var showWait = null;                                            /* the showtime() promise of the running blend */
    st.landSig = landSig(st.land);
    var blend = blendState(opts.show), wipe = wipeState(blend.k), ripple = rippleNew(blend.k > 0.5);
    var renderer = opts.renderer || null, camera = null, scene = opts.scene || null;
    var ctx = { camera: null, show: 0, visit: st.visit, edit: false };
    var _q = { x: 0, y: 0, z: 0, s: 0 }, _rgb = [0, 0, 0];

    /* ---------------- lights ---------------- */
    var hemi = new T.HemisphereLight(0xffffff, 0xffffff, 1), sun = new T.DirectionalLight(0xffffff, 1);
    hemi.name = 'sky:hemi'; sun.name = 'sky:sun';
    var SUN = L.PX_SUN_POS || [9, 18, 11];
    sun.castShadow = !!budget.shadows && quality.shadows;
    if (budget.shadowMapSize) sun.shadow.mapSize.set(budget.shadowMapSize, budget.shadowMapSize);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    group.add(hemi, sun, sun.target);
    var lightRig = { hemi: hemi, sun: sun };
    function placeSun() {
      var F = G.V3.frame(st.visit), sc = sun.shadow.camera, box = shadowFit(F, SUN);
      sun.target.position.set(F.cx, F.cy, F.cz);
      sun.position.set(F.cx + SUN[0], F.cy + SUN[1], F.cz + SUN[2]);
      sc.left = box.left; sc.right = box.right; sc.top = box.top; sc.bottom = box.bottom; sc.near = box.near; sc.far = box.far;
      sc.updateProjectionMatrix();
      st.shadowDirty = true;
    }
    /* the light mix k → hemi, sun / moon, the haze colour */
    var skyCol = new T.Color(1, 1, 1);
    U.uSky.value = skyCol;                                    /* our own colour: vox-gl's token cache is never mutated */
    function setColor(c, key, k) { mixColor(key, k, _rgb); c.setRGB(_rgb[0] / 255, _rgb[1] / 255, _rgb[2] / 255, T.SRGBColorSpace); }
    function applyLight(k) {
      st.kLight = k;
      setColor(hemi.color, 'hemiSky', k); setColor(hemi.groundColor, 'hemiGround', k); hemi.intensity = mixNum('hemiI', k);
      setColor(sun.color, 'sun', k); sun.intensity = mixNum('sunI', k);
      setColor(skyCol, 'haze', k);
      st.voxGain = typeof V.fitGain === 'function' ? V.fitGain(hemi, sun) : 1;     /* an old vox-gl: no uVoxGain */
    }
    function writeGain(g) { if (U.uVoxGain) U.uVoxGain.value = g; }

    /* ---------------- the backdrop ---------------- */
    var bgCanvas = makeCanvas(BACKDROP.W, BACKDROP.H), bgCtx = bgCanvas && bgCanvas.getContext ? bgCanvas.getContext('2d') : null, bgImg = null, bgTex = null;
    var bg = { paints: 0, uploads: 0, last: -1, bands: new Float64Array(13).fill(-1), k: -1, step: -1, twT: 0 }, _eff = new Float64Array(13);
    function effBands() { var e = 1 - st.editK; for (var i = 0; i < 13; i++) _eff[i] = wipe.ks[i] * e; return _eff; }
    function twinkling() { return !st.reduced && blend.k * (1 - st.editK) > 0.5; }
    function paintSky(force) {
      if (!bgImg) return false;
      var eb = effBands(), k = blend.k * (1 - st.editK), step = bg.step, same = k === bg.k && step === bg.stepPainted, i;
      for (i = 0; i < 13 && same; i++) same = eb[i] === bg.bands[i];
      if (same && !force) return false;
      if (!force && bg.last >= 0 && st.clock - bg.last < 1 / B.redrawFps - 1e-6) return true;       /* ≤ 15 fps: the next frame paints */
      paintBackdrop(bgImg.data, eb, k, step);
      bgCtx.putImageData(bgImg, 0, 0);
      bg.bands.set(eb); bg.k = k; bg.stepPainted = step; bg.last = st.clock; bg.paints++;
      if (bgTex) { bgTex.needsUpdate = true; bg.uploads++; }
      return false;
    }
    if (bgCtx) {
      bgImg = bgCtx.createImageData(BACKDROP.W, BACKDROP.H);
      bg.step = 0;
      paintSky(true);
      bgTex = canvasTex(bgCanvas, true);                         /* its first upload is the CanvasTexture's own */
      bgTex.name = 'sky:backdrop';
      if (scene) scene.background = bgTex;
    } else if (scene) { mixColor('bands', blend.k, _rgb, BACKDROP.mid); scene.background = new T.Color(_rgb[0] / 255, _rgb[1] / 255, _rgb[2] / 255); }

    /* ---------------- the water ---------------- */
    var wcv = null, wctx = null, wtex = null, wmesh = null, regions = regionRects(st.seed), drawn = {}, wdirty = {}, wdirtyAny = false, wcols = {}, water = { paints: 0, uploads: 0 };
    function hasSlab(isle) { return !!regions[isle]; }
    function waterOpen(isle) { return hasSlab(isle) && (isle === 'home' || !!st.open[isle]); }
    function sigOf(isle) { return isle === 'home' ? st.landSig + '|' + st.seed : isle; }
    function markWater(isle) { if (hasSlab(isle)) { wdirty[isle] = 1; wdirtyAny = true; } }
    /* paint every dirty open region, then ONE upload; the water mesh follows the open set */
    function flushWater() {
      if (!wdirtyAny || st.disposed) return;                     /* nothing to paint: no work, no allocation */
      var list = Object.keys(wdirty);
      wdirty = {}; wdirtyAny = false;
      var rects = regionRects(st.seed), moved = Object.keys(drawn).some(function (i) { return JSON.stringify(rects[i].rect) !== JSON.stringify(regions[i].rect); });
      regions = rects;
      if (moved) list = list.concat(Object.keys(drawn));          /* a new coast moved the packing: repaint what is drawn */
      if (!wctx) {
        wcv = makeCanvas(S.ATLAS.w, S.ATLAS.h); wctx = wcv && wcv.getContext ? wcv.getContext('2d') : null;
        if (!wctx) { warn('no canvas for the water'); return; }
      }
      var painted = 0, mesh = false;
      list.filter(function (isle, i) { return list.indexOf(isle) === i; }).forEach(function (isle) {
        if (!waterOpen(isle)) { if (drawn[isle]) { delete drawn[isle]; mesh = true; } return; }
        var sig = sigOf(isle);
        if (drawn[isle] === sig && !moved) return;
        var reg = regions[isle], p = paintWater(isle, reg, { seed: st.seed, land: st.land, low: low }), img = wctx.createImageData(p.w, p.h);
        img.data.set(p.data);
        wctx.putImageData(img, reg.rect.x, reg.rect.y);
        wcols[isle] = p.cols; drawn[isle] = sig; painted++; mesh = true; water.paints++;
      });
      if (painted) {
        if (!wtex) { wtex = canvasTex(wcv, false); wtex.name = 'sky:water'; V.setWater(wtex); }
        else wtex.needsUpdate = true;
        water.uploads++;
      }
      if (mesh) { buildWater(); st.fallsDirty = true; }
    }
    function buildWater() {
      var arrays = { position: [], normal: [], color: [], vuv: [] };
      Object.keys(drawn).forEach(function (isle) { waterQuads(wcols[isle], regions[isle], S.ATLAS, arrays); });
      if (wmesh) { group.remove(wmesh); wmesh.geometry.dispose(); if (typeof wmesh.dispose === 'function') wmesh.dispose(); wmesh = null; }
      if (!arrays.position.length) return;
      wmesh = V.terrainMesh(arrays, { material: 'vox:water', name: 'sky:water', castShadow: false, receiveShadow: true });
      wmesh.userData.kind = 'water';
      group.add(wmesh);
    }
    function waterAnim() { return !st.reduced && quality.water && !!drawn[st.visit]; }

    /* ---------------- the falling cubes ---------------- */
    var perFall = budget.fallsCubes | 0, cap = perFall * Math.max.apply(null, ISLES.map(function (i) { return (S.FALLS[i] || []).length; }));
    var pool = perFall > 0 ? V.instancedCubes(cap, { mode: 'block', size: 1, name: 'sky:falls' }) : null;
    if (pool) { pool.mesh.userData.kind = 'falls'; group.add(pool.mesh); }
    /* the visited island's water falls get perFall cubes each (re-dealt on a visit, a new coast, a
       quality step or when its water is first drawn) */
    function assignFalls() {
      st.fallsDirty = false;
      if (!pool) return;
      var n = Math.round(perFall * Math.min(1, quality.particleScale || 1)), col = drawn[st.visit] && wcols[st.visit];
      var list = col ? fallsOf(col).filter(function (f) { return f.kind === 'water'; }) : [];
      pool.clear(); st.falls = [];
      list.forEach(function (f, fi) {
        for (var c = 0; c < n; c++) {
          var k = pool.alloc();
          if (k < 0) return;
          pool.tint(k, FALL.toks[c % 5]);
          st.falls.push({ k: k, f: f, u0: c / n + hash(c, fi, 3) * 0.01, j: hash(c, fi, 4) - 0.5, j2: (hash(c, fi, 5) - 0.5) * 0.25 });
        }
      });
      stepFalls();
    }
    function stepFalls() {
      for (var i = 0; i < st.falls.length; i++) {
        var c = st.falls[i], u = (c.u0 + st.clock * FALL.rate) % 1;
        fallAt(u, c.f, c, _q);
        pool.set(c.k, _q.x, _q.y, _q.z, _q.s);
      }
      pool.commit();
    }

    /* ---------------- hosted modules ---------------- */
    var GL = opts.islesGl === false ? null : opts.islesGl || sibling('SLIslesGL', './isles-gl.js', true), isles = null;
    if (GL && typeof GL.create === 'function') {
      try {
        isles = GL.create(K, SL3D, { tier: tier, reduced: st.reduced, seed: st.seed, sound: opts.sound, fx: opts.fx, now: opts.now });
        group.add(isles.group);
      } catch (e) { warn('isles-gl: ' + (e && e.message || e)); isles = null; }
    }
    var Life = opts.skyLife === false ? null : opts.skyLife || sibling('SLSkyLife3D', './skylife3d.js', true), life = null;
    if (Life && typeof Life.create === 'function') {
      try {
        life = Life.create(K, SL3D, { tier: tier, reduced: st.reduced, isles: [] });
        if (life && life.group) group.add(life.group);
      } catch (e2) { warn('skylife: ' + (e2 && e2.message || e2)); life = null; }
    }

    /* ---------------- the ripple's centre: the visited land's landmark, or Home's house ---------------- */
    function centre() {
      var F = G.V3.frame(st.visit), I = C.ISLES[st.visit], p = null;
      try {
        if (st.visit === 'home') p = F.pivot('house_cottage', st.house ? st.house.x : 6, st.house ? st.house.y : 2);
        else if (I && I.landmark && I.landmarkSpot) p = F.pivot(I.landmark, I.landmarkSpot[0], I.landmarkSpot[1]);
      } catch (e) { p = null; }
      return p || { x: F.cx, z: F.cz };
    }
    var wakeC = centre();
    function setWake(on) { if (on !== ripple.on) rippleToggle(ripple, on); }

    /* ================================================================
       PER FRAME
       ================================================================ */
    function lightK() { return blend.k * (1 - st.editK); }
    function applyShow(force) {
      var k = lightK();
      if (force || Math.abs(k - st.kLight) > 1e-6) applyLight(k);
      if (force || k !== st.show) {
        st.show = k; ctx.show = k;
        call(K, 'setShow', k); call(isles, 'setShow', k); call(life, 'setShow', k);
      }
    }
    function update(dt, t, showK) {
      if (st.disposed || st.suspended) return false;
      dt = typeof dt === 'number' && dt > 0 ? Math.min(dt, 0.1) : 0;
      st.clock += dt;
      flushWater();
      var busy = false;
      if (typeof showK === 'number' && isFinite(showK)) { jump(showK); }
      else if (blendStep(blend, dt)) busy = true;
      if (showWait && blend.t >= blend.dur) settleShow();
      if (wipeStep(wipe, dt, st.reduced || blend.reduced, blend.k)) busy = true;
      if (st.editK !== st.editTo) {
        st.editT += dt;
        var u = st.editDur > 0 ? Math.min(1, st.editT / st.editDur) : 1;
        st.editK = u >= 1 ? st.editTo : st.editFrom + (st.editTo - st.editFrom) * (st.editRed ? u : inOutSine(u));
        busy = true;
      }
      applyShow(false);
      rippleAdvance(ripple, dt);
      if (ripple.t < WAKE.settle + 1) busy = true;
      if (U.uFogMax.value !== st.fogTo) {
        var f = U.uFogMax.value, s = st.reduced ? 1 : dt / FOG_SEC * FOG.max;
        U.uFogMax.value = st.fogTo > f ? Math.min(st.fogTo, f + s) : Math.max(st.fogTo, f - s);
        busy = true;
      }
      /* the backdrop: the wipe or the edit ease (≤ 15 fps), and the night's twinkle every 0.5 s */
      if (twinkling()) { bg.twT += dt; if (bg.twT >= TWINKLE.every) { bg.twT -= TWINKLE.every * Math.floor(bg.twT / TWINKLE.every); bg.step++; } busy = true; }
      if (paintSky(false)) busy = true;
      /* the water's frame steps (no upload: a uniform) */
      var anim = waterAnim();
      U.uWaterAnim.value = anim ? 1 : 0;
      if (anim) {
        st.wAcc += dt;
        var per = 1 / (budget.waterFps || 8);
        if (st.wAcc >= per) { var n = Math.floor(st.wAcc / per + 1e-9); st.wAcc -= n * per; st.wFrame = (st.wFrame + n) % 65536; U.uWaterFrame.value = st.wFrame; }
        busy = true;
      }
      if (pool) {
        if (st.fallsDirty) assignFalls();
        pool.mesh.visible = !st.reduced && st.falls.length > 0;
        if (pool.mesh.visible) { stepFalls(); busy = true; }
      }
      ctx.visit = st.visit; ctx.edit = st.edit;
      if (isles && call(isles, 'update', dt, t, ctx)) busy = true;
      if (life && call(life, 'update', dt, t, ctx)) busy = true;
      if (renderer) beforeRender(renderer, camera);
      return busy;
    }
    var _yaw = 0;
    function beforeRender(r, cam) {
      if (st.disposed) return;
      if (!st.suspended) writeGain(st.voxGain);                 /* the island's exposure fit, every island frame */
      flushWater();
      if (scene && bgTex && scene.background !== bgTex) scene.background = bgTex;     /* after a game held the renderer */
      if (cam) {
        camera = cam; ctx.camera = cam;
        var q = cam.quaternion, zx = 2 * (q.x * q.z + q.w * q.y), zz = 1 - 2 * (q.x * q.x + q.y * q.y);
        _yaw = Math.atan2(zx, zz);
        if (bgTex) bgTex.offset.x = backdropOffset(_yaw, cam.position.x * Math.cos(_yaw) - cam.position.z * Math.sin(_yaw));
        call(isles, 'setCamera', cam.position);
      }
      if (r && st.shadowDirty && r.shadowMap) {
        if (r.shadowMap.enabled && sun.castShadow) { r.shadowMap.needsUpdate = true; st.shadowRenders++; }
        st.shadowDirty = false;
      }
    }

    /* ================================================================
       CONTROLS
       ================================================================ */
    function jump(k) {
      k = clamp01(+k || 0);
      setWake(k > 0.5);
      blend.k = blend.from = blend.to = k; blend.t = blend.dur = 0;
      wipe.ks.fill(k); wipe.to = k;
      settleShow();
    }
    /* the running showtime() promise: true when its blend landed, false when a newer one took over */
    function settleShow() { var w = showWait; showWait = null; if (w) w.resolve(blend.to === w.target && blend.k === w.target); }
    function showtime(on, o) {
      var red = o && o.reduced != null ? !!o.reduced : st.reduced, w = { target: on ? 1 : 0, done: false }, p;
      p = new Promise(function (res) { w.resolve = function (v) { if (!w.done) { w.done = true; res(v); } }; });
      if (showWait) showWait.resolve(false);
      setWake(!!on);
      p.dur = blendTo(blend, w.target, red, st.visit);
      wipeTo(wipe, blend.to);
      showWait = w;
      if (!p.dur) settleShow();
      else later(function () { if (showWait === w) { showWait = null; w.resolve(blend.to === w.target); } }, (p.dur + 1.5) * 1000);     /* frames may be paused */
      return p;
    }
    function setEdit(on) {
      on = !!on;
      st.edit = on; ctx.edit = on;
      call(life, 'setEdit', on);
      var to = on ? 1 : 0;
      if (to === st.editTo) return;
      var L0 = look(), kNow = lightK(), kEnd = blend.to * (1 - to);
      st.editFrom = st.editK; st.editTo = to; st.editT = 0; st.editRed = st.reduced;
      st.editDur = editSec(L0.frameLuma(kNow, st.visit) - L0.frameLuma(kEnd, st.visit), st.reduced);
      if (!st.editDur) st.editK = to;
    }
    function setVisit(isle) {
      if (ISLES.indexOf(isle) < 0 || isle === st.visit) return;
      st.visit = isle; ctx.visit = isle;
      call(isles, 'setVisit', isle); call(life, 'setVisit', isle);
      placeSun(); wakeC = centre(); st.fallsDirty = true;
    }
    function setSkyMap(on) {
      on = !!on;
      st.skyMap = on;
      st.fogTo = on || st.suspended ? 0 : FOG.max;
      if (st.reduced) U.uFogMax.value = st.fogTo;
      call(isles, 'setSkyMap', on);
    }
    function setLand(unlocked, world) {
      if (st.disposed) return;
      if (world && Array.isArray(world.placed)) setPlaced(world.placed);
      var land = homeLand(unlocked), sig = landSig(land);
      call(isles, 'setLand', unlocked == null ? ['home'] : unlocked);
      if (sig === st.landSig) return;
      st.land = land; st.landSig = sig;
      if (!st.risePending) markWater('home');
      st.shadowDirty = true;
    }
    function setPlaced(placed) {
      var h = null;
      for (var i = 0; i < (placed || []).length; i++) if (placed[i] && placed[i].id === 'house_cottage' && (!placed[i].isle || placed[i].isle === 'home')) { h = placed[i]; break; }
      st.house = h ? { x: h.x, y: h.y } : null;
      if (st.visit === 'home') wakeC = centre();
    }
    function riseRegion(region) {
      var h = isles ? call(isles, 'riseRegion', region) : null;
      if (!h || typeof h.then !== 'function') {
        h = Promise.resolve(!!(C.REGION_CELLS && C.REGION_CELLS[region]) && region !== 'home');
        h.region = region; h.cells = []; h.dur = 0; h.done = true; h.promise = h; h.cancel = function () {};
      }
      st.risePending = true;
      if (C.REGION_CELLS && C.REGION_CELLS[region] && !st.land[C.REGION_CELLS[region][0]]) {
        var next = {}, k;
        for (k in st.land) next[k] = 1;
        C.REGION_CELLS[region].forEach(function (c) { next[c] = 1; });
        st.land = next; st.landSig = landSig(next);
      }
      h.then(function () { st.risePending = false; markWater('home'); st.shadowDirty = true; }, function () { st.risePending = false; markWater('home'); });
      return h;
    }
    function setIsles(unlocked, o) {
      if (st.disposed) return;
      var on = {}, pend = {};
      (Array.isArray(unlocked) ? unlocked : []).forEach(function (i) { on[i] = 1; });
      (o && Array.isArray(o.pending) ? o.pending : []).forEach(function (i) { pend[i] = 1; });
      call(isles, 'setIsles', unlocked, o);
      call(life, 'setIsles', unlocked);
      ISLES.forEach(function (isle) {
        if (isle === 'home') return;
        var open = !!on[isle] && (!pend[isle] || !!st.open[isle]);
        if (open === !!st.open[isle]) return;
        if (open) st.open[isle] = 1; else delete st.open[isle];
        markWater(isle); st.shadowDirty = true;
      });
    }
    function wakeIsle(isle) {
      var p = isles ? call(isles, 'wakeIsle', isle) : null;
      if (!p || typeof p.then !== 'function') p = Promise.resolve(ISLES.indexOf(isle) > 0);
      return p.then(function (ok) {
        if (ok && !st.disposed && !st.open[isle]) { st.open[isle] = 1; markWater(isle); st.shadowDirty = true; }
        return ok;
      });
    }
    function setSeed(seed) {
      seed = seed == null ? '' : seed;
      if (seed === st.seed) return;
      st.seed = seed;
      call(isles, 'setSeed', seed);
      markWater('home'); st.fallsDirty = true; st.shadowDirty = true;
    }
    function setReduced(on) {
      st.reduced = !!on;
      call(isles, 'setReduced', st.reduced); call(life, 'setReduced', st.reduced);
      if (st.reduced) U.uFogMax.value = st.fogTo;
    }
    function setQuality(q) {
      if (!q) return;
      if (q.shadows != null) quality.shadows = !!q.shadows;
      if (q.water != null) quality.water = !!q.water;
      if (q.particleScale && q.particleScale !== quality.particleScale) { quality.particleScale = q.particleScale; st.fallsDirty = true; }
      var cast = !!budget.shadows && quality.shadows;
      if (cast !== sun.castShadow) { sun.castShadow = cast; st.shadowDirty = true; }
      call(isles, 'setQuality', q); call(life, 'setQuality', q);
    }
    var unsubQ = SL3D && typeof SL3D.onQuality === 'function' ? SL3D.onQuality(function (q) { setQuality(q); }) : null;
    function skyColor() {
      var k = wipe.ks[BACKDROP.mid] * (1 - st.editK), P = presets(), lo = k <= 0.5;
      return look().mixHex(hexOf(P[lo ? 0 : 1].bands[BACKDROP.mid]), hexOf(P[lo ? 1 : 2].bands[BACKDROP.mid]), lo ? k * 2 : k * 2 - 1);
    }
    function settle(dist) {
      var d = Math.max(0, Number(dist) || 0);
      U.uFogNear.value = d + FOG.nearAdd; U.uFogFar.value = d + FOG.farAdd;
    }
    function info() {
      var calls = 0, tris = 0;
      group.traverse(function (o) {
        if (!o.isMesh || !o.visible || (o.isInstancedMesh && !o.count)) return;
        for (var p = o.parent; p && p !== group; p = p.parent) if (!p.visible) return;
        calls++;
        var g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
        tris += n / 3 * (o.isInstancedMesh ? o.count : 1);
      });
      return {
        VERSION: VERSION, tier: tier, calls: calls + (bgTex ? 1 : 0), tris: Math.round(tris) + (bgTex ? 2 : 0), show: st.show, light: st.kLight, k: blend.k, edit: st.editK,
        voxGain: st.voxGain,
        visit: st.visit, skyMap: st.skyMap, suspended: st.suspended, fogMax: U.uFogMax.value, wake: ripple.on,
        backdrop: { paints: bg.paints, uploads: bg.uploads, offset: bgTex ? bgTex.offset.x : 0, step: bg.step },
        water: { isles: Object.keys(drawn), paints: water.paints, uploads: water.uploads, frame: st.wFrame, anim: U.uWaterAnim.value, fps: budget.waterFps },
        falls: { perFall: perFall, cubes: st.falls.length, visible: !!(pool && pool.mesh.visible) },
        shadows: { cast: sun.castShadow, mapSize: budget.shadowMapSize || 0, renders: st.shadowRenders },
        isles: isles ? call(isles, 'info') : null, life: life ? call(life, 'info') : null
      };
    }
    function dispose() {
      if (st.disposed) return;
      st.disposed = true;
      timers.forEach(clearTimeout); timers.length = 0;
      if (unsubQ) unsubQ();
      call(isles, 'dispose'); call(life, 'dispose'); isles = life = null;
      if (wmesh) { wmesh.geometry.dispose(); if (typeof wmesh.dispose === 'function') wmesh.dispose(); }
      if (pool) pool.dispose();
      if (wtex) { V.setWater(null); wtex.dispose(); }
      if (bgTex) { if (scene && scene.background === bgTex) scene.background = null; bgTex.dispose(); }
      U.uWaterAnim.value = 0;
      writeGain(1);                                             /* the next holder starts from today's look */
      if (typeof sun.dispose === 'function') sun.dispose();
      if (typeof hemi.dispose === 'function') hemi.dispose();
      if (group.parent) group.parent.remove(group);
      group.clear();
      renderer = camera = scene = null;
    }

    /* the starting state: the visited island's light, the haze, the first light mix */
    U.uFogMax.value = FOG.max; settle(SETTLE); U.uWaterAnim.value = 0;
    placeSun();
    applyShow(true);
    if (opts.unlocked != null || opts.isles != null) {             /* setLand and setIsles as a pair: the cold set builds once */
      setLand(opts.unlocked == null ? ['home'] : opts.unlocked);
      setIsles(opts.isles || [], { pending: opts.pending || [] });
    }
    markWater('home');

    var api = {
      VERSION: VERSION, group: group, tier: tier, light: lightRig, lights: lightRig, city: null,
      update: update, beforeRender: beforeRender,
      attach: function (r) { renderer = r || null; st.shadowDirty = true; },
      setLand: setLand, setPlaced: setPlaced, riseRegion: riseRegion, setIsles: setIsles, wakeIsle: wakeIsle,
      buildBridge: function (isle) { var p = isles ? call(isles, 'buildBridge', isle) : null; return p && typeof p.then === 'function' ? p : Promise.resolve(false); },
      peek: function (isle, on) { call(isles, 'peek', isle, on); },
      setVisit: setVisit, setSkyMap: setSkyMap,
      setLayout: function (isle, fps) { call(isles, 'setLayout', isle, fps); st.shadowDirty = true; },
      showtime: showtime,
      setShow: function (k) { jump(k); applyShow(false); },
      setEdit: setEdit,
      setMember: function (hex) { call(life, 'setMember', hex); },
      setUser: function (u) { if (!u) return; if (u.color) api.setMember(u.color); if (u.seed != null) setSeed(u.seed); },
      setSeed: setSeed, setReduced: setReduced, setQuality: setQuality,
      invalidateShadows: function () { st.shadowDirty = true; },
      lockedAt: function (x, z) { return isles ? call(isles, 'lockedAt', x, z) || null : null; },
      heightAt: function (x, z) { var y = isles ? call(isles, 'heightAt', x, z) : undefined; return typeof y === 'number' ? y : G.V3.frame('home').seaY; },
      wakeAt: function (x, z) { return rippleLevel(ripple, wakeDelay(x, z, wakeC), st.reduced); },
      pick: function (o, d) { return isles ? call(isles, 'pick', o, d) || null : null; },
      signAnchor: function (isle, at) { return isles ? call(isles, 'signAnchor', isle, at) || null : null; },
      regionSign: function (region) { return isles ? call(isles, 'regionSign', region) || null : null; },
      hooks: function (o) { call(isles, 'hooks', o); },
      skyColor: skyColor, settle: settle,
      suspend: function () { st.suspended = true; st.fogTo = 0; U.uFogMax.value = 0; writeGain(1); },
      resume: function () { st.suspended = false; st.fogTo = st.skyMap ? 0 : FOG.max; U.uFogMax.value = st.fogTo; writeGain(st.voxGain); st.shadowDirty = true; },
      /* v2 env calls with no v3 meaning */
      aim: function () {}, setConeMounts: function () {}, reflections: function () { return null; },
      info: info, dispose: dispose
    };
    Object.defineProperty(api, 'show', { get: function () { return st.show; } });
    Object.defineProperty(api, 'reduced', { get: function () { return st.reduced; } });
    Object.defineProperty(api, 'isles', { get: function () { return isles; } });
    Object.defineProperty(api, 'life', { get: function () { return life; } });
    return api;
  }

  return {
    VERSION: VERSION, ISLES: ISLES, BACKDROP: BACKDROP, EDIT_SEC: EDIT_SEC, FOG_SEC: FOG_SEC, WAKE: WAKE, TWINKLE: TWINKLE, FALL: FALL, WATER: WATER,
    ART: ART, COAST: COAST, TOKENS: TOKENS,
    create: create,
    /* pure helpers (Node-testable) */
    blendState: blendState, blendTo: blendTo, blendStep: blendStep, wipeState: wipeState, wipeTo: wipeTo, wipeStep: wipeStep, editSec: editSec,
    rippleNew: rippleNew, rippleToggle: rippleToggle, rippleAdvance: rippleAdvance, rippleLevel: rippleLevel, wakeDelay: wakeDelay,
    backdropOffset: backdropOffset, shadowFit: shadowFit, starLevel: starLevel, paintBackdrop: paintBackdrop, mixColor: mixColor,
    columns: columns, regionRects: regionRects, paintWater: paintWater, waterQuads: waterQuads, fallsOf: fallsOf, fallAt: fallAt, chess: chess
  };
}));
