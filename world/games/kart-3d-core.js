/* ================================================================
   Neon Grand Prix 3D — the view's pure maths (no DOM, no THREE).
   Classic UMD: window.SLKart3DCore in the browser (kart-3d.js imports
   it as a side-effect module), module.exports in Node tests.

   Everything the 3D view decides that can be decided without a GPU
   lives here so it is testable: the logic → world mapping, angle and
   easing helpers, the per-track look, the light-arc presets, the
   camera rigs, the ribbon / kerb / wall / scenery layouts built from
   the logic centreline, the set-piece and grandstand spots, the jump
   heights, the view-only squash / spin / wobble / crowd timelines,
   the HUD strings, the pop-word limiter and the photosensitivity list
   of every periodic visual (all ≤ 2 Hz). V4.55 adds the things on a
   Remix course's road: several ramps with their bands, obstacle spots,
   the crosser's place, sticky decals, the sign and the halo count.

   World mapping (spec-kart threeDScene): x = (lx − 1152)/40,
   z = (ly − 648)/40, y up; kart yaw = π/2 − h (models face +z).
   Positive logic lateral = the driver's right = (−t.y, t.x).
   ================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.SLKart3DCore = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;
  /* logic constants mirrored from kart-logic.js (a test pins them) */
  var U = 40, WW = 2304, WH = 1296, CX = WW / 2, CZ = WH / 2;
  var HW = 50, KERB = 8, VERGE = 46, WALL = HW + VERGE + 14, JUMP_LEN = 64, SPIN_T = 0.8, BEAT2 = 120 / 140;
  var CHECKS = [0.25, 0.5, 0.75];
  var PI = Math.PI, TAU = PI * 2, DEG = PI / 180;

  /* ---------------- small maths ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  /* shortest-arc angle interpolation */
  function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }
  /* frame-rate independent smoothing factor 1 − e^(−rate·dt) */
  function damp(rate, dt) { return rate <= 0 ? 1 : 1 - Math.exp(-rate * Math.max(0, dt)); }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function outBack(u) { u = clamp01(u); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  function inOutSine(u) { u = clamp01(u); return -(Math.cos(PI * u) - 1) / 2; }
  function outQuad(u) { u = clamp01(u); return 1 - (1 - u) * (1 - u); }
  function inQuad(u) { u = clamp01(u); return u * u; }
  function arc(u) { u = clamp01(u); return 4 * u * (1 - u); }

  /* ---------------- logic → world ---------------- */
  function wx(lx) { return (lx - CX) / U; }
  function wz(ly) { return (ly - CZ) / U; }
  function yawOf(h) { return PI / 2 - h; }
  /* yaw (about +y) that turns +z onto the logic direction (dx, dy) */
  function yawDir(dx, dy) { return Math.atan2(dx, dy); }

  /* ---------------- colour ---------------- */
  function normHex(h) {
    if (typeof h !== 'string') return null;
    var m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    return m ? '#' + m[1].toUpperCase() : null;
  }
  function hexRgb(h) {
    var n = parseInt((normHex(h) || '#CFC8DC').slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  /* linear-light RGB, the space THREE stores vertex colours in */
  function linearRgb(h) { var c = hexRgb(h); return [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])]; }
  function rgbHex(r, g, b) {
    function c(v) { var s = Math.round(clamp01(v) * 255).toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }
    return '#' + c(r) + c(g) + c(b);
  }
  function mixHex(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b);
    return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  }
  /* the colour a hex is read as with a different lightness (±, 0..1) */
  function shadeHex(h, d) {
    var c = hexRgb(h);
    return rgbHex(c[0] + d, c[1] + d, c[2] + d);
  }

  /* ---------------- palette (art bible tokens used by the view) ---------------- */
  var COL = {
    ink: '#3B2F4A', white: '#FFFFFF', asphalt: '#5B5670', dash: '#E6E1EF', kerbA: '#FF6B6B', kerbB: '#FFFFFF',
    checkA: '#2D2D3D', checkB: '#FFFFFF', neonPink: '#FF4FB8', neonCyan: '#3DF2FF', neonViolet: '#A66BFF', neonLime: '#B6FF5C',
    starGold: '#FFD23F', coral: '#FF6B6B', leafMint: '#7BD88F', grape: '#C38BFF', bubblegum: '#FF8FC8', butter: '#FFE27A',
    pebble: '#CFC8DC', holoPink: '#FFB3E6', holoBlue: '#B3E5FF', holoMint: '#C9FFE5', holoLemon: '#FFF3B3',
    sand: '#F3DC9A', wetSand: '#E8C77E', riserTop: '#FFF0FA', dust: '#E8DCC4', blush: '#FF9DB8',
    volcano: '#8A6B5A', lava: '#FF8A5C', smoke: '#D9C8F2', trunk: '#A5743F', frond: '#4FBF63', frondDark: '#3FA956'
  };
  var TIER_COL = [COL.pebble, COL.neonCyan, COL.neonPink, COL.starGold];
  var STACK_COL = [COL.holoPink, COL.holoBlue, COL.holoLemon];
  var CONFETTI = [COL.holoPink, COL.holoBlue, COL.holoMint, COL.holoLemon];
  var MEDAL_COL = ['#FFFFFF', '#C48A52', '#DDE3F0', '#F0C02F', '#FFB3E6'];
  /* LOCKED 2D colours (world-art.js KARTS / PETCOL; a test compares them) */
  var KARTS = { kart_red: '#e94b4b', kart_blue: '#3b7dd8', kart_lime: '#7ed957', kart_gold: '#f0c02f', kart_unicorn: '#ff8fd0' };
  var PETCOL = {
    pet_puppy: { body: '#e3b077', dark: '#b8834f', light: '#f6d9b3', nose: '#3b2f4a' },
    pet_kitten: { body: '#f0a35e', dark: '#c97834', light: '#fde2c6', nose: '#e86a8a' },
    pet_bunny: { body: '#f4f0ea', dark: '#d8cfc4', light: '#ffffff', nose: '#f08aa6' },
    pet_dragon: { body: '#5fc97a', dark: '#3a9a58', light: '#b9f0c6', nose: '#2e6b40' }
  };
  function kartHex(kartId) { return KARTS[kartId] || KARTS.kart_red; }
  function kartId(cfgKart) { return KARTS[cfgKart] ? cfgKart : 'kart_red'; }

  /* ---------------- per-track look (TRACK_LOOK) ---------------- */
  var TRACK_LOOK = {
    track_loop: { ground: '#7AD06A', side: '#5FBF55', verge: '#A6DC8E', scenery: 'palms', setPiece: 'tunnel', palms: 16, palmsLow: 8, sky: null },
    track_volcano: { ground: '#9CC46A', side: '#7FA857', verge: '#A6DC8E', scenery: 'trees', setPiece: 'crystals', palms: 12, palmsLow: 6,
      sky: { skyTop: '#A66BFF', skyMid: '#E79BC6', skyHorizon: '#FFB38A', fogColor: '#FFC6A8' } },
    track_beach: { ground: '#F3DC9A', side: '#E8C77E', verge: '#E9CF88', scenery: 'beach', setPiece: 'dolphins', palms: 6, palmsLow: 4, huts: 6, sky: null },
    /* Starlight Twist (V4.55): the art bible's dusk sky by day, with the star field already out */
    track_star: { ground: '#6FB7A8', side: '#5A9E90', verge: '#9AD2C4', scenery: 'trees', setPiece: 'tunnel', palms: 12, palmsLow: 6, stars: 0.7,
      sky: { skyTop: '#2B1E5C', skyMid: '#6A3D8F', skyHorizon: '#FF9A7A', fogColor: '#7E4E8E' } }
  };
  function hasLook(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(TRACK_LOOK, id); }
  /* The look for a track (or its id). A Remix course is drawn as the classic track whose road it
     uses (track.base; for a bare id the logic is asked, when it is loaded); a new road has its own
     entry; anything else is drawn as Island Loop. */
  function trackLook(t) {
    var obj = !!t && typeof t === 'object', id = obj ? t.id : t, base = obj ? t.base : null;
    if (hasLook(id)) return TRACK_LOOK[id];
    if (!base) {
      var g = typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : null, KL = g && g.SLKartLogic;
      try { base = KL && typeof KL.courseBase === 'function' ? KL.courseBase(id) : null; } catch (e) { base = null; }
    }
    return hasLook(base) ? TRACK_LOOK[base] : TRACK_LOOK.track_loop;
  }

  /* ---------------- the light arc: SOUNDCHECK → SHOWTIME → ENCORE ----------------
     Copies of world-look DAY / SHOW with tokens resolved (a test compares them);
     SOUNDCHECK warms the sun to #FFE3C0 at 2.2. Fog reaches further than on the
     island because a track is 57 u across. */
  var DAY = {
    hemiSky: '#DDF1FF', hemiGround: '#FFE0EC', hemiIntensity: 1.9, sunColor: '#FFE3C0', sunIntensity: 2.2,
    fogColor: '#FFE3F1', fogNear: 55, fogFar: 140, exposure: 1.0,
    skyTop: '#8FD3FF', skyMid: '#CDEBFF', skyHorizon: '#FFE3F1',
    seaShallow: '#7FE3F0', seaDeep: '#2F8FD8', foam: '#F2FCFF', haloScale: 1, haloOpacity: 0.5,
    rimColor: '#FFFFFF', rimStrength: 0.28
  };
  var SHOW = {
    hemiSky: '#6B5BD6', hemiGround: '#2A1840', hemiIntensity: 0.85, sunColor: '#B9C6FF', sunIntensity: 0.9,
    fogColor: '#3B1E6E', fogNear: 45, fogFar: 120, exposure: 1.08,
    skyTop: '#1A1240', skyMid: '#3B1E6E', skyHorizon: '#FF7AC8',
    seaShallow: '#3C6FD1', seaDeep: '#1B2A6B', foam: '#CFC4FF', haloScale: 1.6, haloOpacity: 0.9,
    rimColor: '#FF7AD9', rimStrength: 0.55
  };
  var ARC_K = [0, 0.5, 1];                  /* lapLight 0 / 1 / 2 → show mix */
  var ARC_SEC = 1.6, ARC_SEC_REDUCED = 0.25;
  function arcK(level) { return ARC_K[clamp(level | 0, 0, 2)]; }
  /* the Encore extras (stars, sweeping cones, lit wands, fireworks) ramp in over the second half */
  function encoreK(k) { return clamp01((k - 0.5) * 2); }
  /* the preset at mix k for a track or its id (out reused when given); at Showtime the rim takes
     40% of the child's member colour, as on the island */
  function arcPreset(k, trackId, out, memberHex) {
    out = out || {};
    k = clamp01(k);
    var day = DAY, sky = trackLook(trackId).sky;
    for (var key in DAY) {
      var a = sky && sky[key] != null ? sky[key] : day[key], b = SHOW[key];
      if (key === 'rimColor' && normHex(memberHex)) b = mixHex(b, memberHex, 0.4);
      out[key] = typeof a === 'string' ? mixHex(a, b, k) : a + (b - a) * k;
    }
    out.k = k;
    out.encore = encoreK(k);
    return out;
  }
  /* blend timeline from one level to another: progress u → mix */
  function arcBlend(fromK, toK, t, reduced) {
    var dur = reduced ? ARC_SEC_REDUCED : ARC_SEC;
    return lerp(fromK, toK, reduced ? clamp01(t / dur) : inOutSine(t / dur));
  }

  /* ---------------- cameras ---------------- */
  var CAMERAS = {
    chase: { up: 6.5, back: 7.5, ahead: 4, fov: 50, posRate: 8, yawRate: 5, yawRateDrift: 3, lookY: 0.5, boostFov: 7, boostBack: 0.6 },
    stage: { up: 3.4, back: 5.6, ahead: 5, fov: 56, posRate: 8, yawRate: 5, yawRateDrift: 3, lookY: 0.7, boostFov: 6, boostBack: 0.4 },
    map: { up: 28, back: 10, ahead: 0, fov: 40, posRate: 3, yawRate: 0, yawRateDrift: 0, lookY: 0, boostFov: 0, boostBack: 0, northUp: true },
    tv: { up: 2.6, side: 5.2, spacing: 14, fov: 36, posRate: 0, lookRate: 7, lookY: 0.5, boostFov: 0, boostBack: 0 }
  };
  var CAM_ORDER = ['chase', 'stage', 'map', 'tv'];
  var CAM_LABEL = { chase: 'Chase', stage: 'Stage', map: 'High', tv: 'TV' };
  function camMode(m) { return CAMERAS[m] ? m : 'chase'; }
  function nextCam(m) { return CAM_ORDER[(CAM_ORDER.indexOf(camMode(m)) + 1) % CAM_ORDER.length]; }
  /* the boost FOV kick: eases in over 0.25 s and out over 0.6 s (k follows its target) */
  function boostEase(cur, on, dt) {
    var r = on ? dt / 0.25 : -dt / 0.6;
    return clamp01(cur + r);
  }
  /* where a rig wants the camera for a kart at (x, z, yaw) [world], with boost 0..1 and
     jump lift 0..1. out = {px, py, pz, lx, ly, lz, fov} */
  function camDesired(mode, x, y, z, yaw, boost, jump, out) {
    var c = CAMERAS[camMode(mode)];
    out = out || {};
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (c.northUp) {
      out.px = x; out.py = c.up + y; out.pz = z + c.back;
      out.lx = x; out.ly = y; out.lz = z;
    } else {
      var back = c.back + c.boostBack * boost;
      out.px = x - fx * back; out.py = c.up + 0.8 * jump + y * 0.5; out.pz = z - fz * back;
      out.lx = x + fx * c.ahead; out.ly = c.lookY + y * 0.5; out.lz = z + fz * c.ahead;
    }
    out.fov = c.fov + c.boostFov * boost;
    return out;
  }
  /* the intro crane: from high above the finish gantry down to the chase spot (u 0..1) */
  function craneAt(u, gx, gz, gyaw, chase, out) {
    out = out || {};
    var e = inOutSine(u), fx = Math.sin(gyaw), fz = Math.cos(gyaw);
    var sx = gx - fx * 2 + fz * 7, sy = 14, sz = gz - fz * 2 - fx * 7;
    out.px = lerp(sx, chase.px, e); out.py = lerp(sy, chase.py, e); out.pz = lerp(sz, chase.pz, e);
    out.lx = lerp(gx, chase.lx, e); out.ly = lerp(2.4, chase.ly, e); out.lz = lerp(gz, chase.lz, e);
    out.fov = lerp(44, chase.fov, e);
    return out;
  }
  /* final-lap push-in: FOV 50 → 46 → 50 over 0.6 s (returns the FOV offset) */
  function pushIn(t) { return t < 0 || t > 0.6 ? 0 : -4 * Math.sin(PI * t / 0.6); }
  /* the finish orbit: a 90° swing round the kart over the 2.2 s coast */
  function orbitAngle(coastT) { return 0.5 * PI * inOutSine(coastT / 2.2); }
  /* camera shake (bump / spin): 0.06 u for 0.18 s, decaying */
  function shakeAmp(t) { return t < 0 || t >= 0.18 ? 0 : 0.06 * (1 - t / 0.18); }

  /* ---------------- track geometry helpers (logic px) ---------------- */
  /* point + unit tangent at arc position s (wraps) — the same maths as kart-logic pointAt */
  function pointAt(track, s, out) {
    var len = track.len, n = track.n, cum = track.cum;
    s = s % len; if (s < 0) s += len;
    var lo = 0, hi = n - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
    var i = lo, j = (i + 1) % n, a = track.pts[i], b = track.pts[j];
    var seg = (j === 0 ? len : cum[j]) - cum[i], f = seg > 0 ? (s - cum[i]) / seg : 0;
    var ta = track.tang[i], tb = track.tang[j], tx = ta[0] + (tb[0] - ta[0]) * f, ty = ta[1] + (tb[1] - ta[1]) * f, m = Math.hypot(tx, ty) || 1;
    out = out || {};
    out.x = a[0] + (b[0] - a[0]) * f; out.y = a[1] + (b[1] - a[1]) * f; out.tx = tx / m; out.ty = ty / m; out.i = f < 0.5 ? i : j;
    return out;
  }
  /* the logic point at arc s with a lateral offset (px, + = right) */
  function offsetAt(track, s, lat, out) {
    out = pointAt(track, s, out);
    out.x -= out.ty * lat; out.y += out.tx * lat;
    return out;
  }
  /* +1 when the right-hand side (positive lateral) is the infield */
  function infieldSide(track) {
    var a = 0, p = track.pts, n = p.length;
    for (var i = 0; i < n; i++) { var q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a >= 0 ? 1 : -1;
  }
  /* distance (px) from (x, y) to the nearest centreline sample, skipping samples within
     `skip` of index `self` (so a point is not measured against its own stretch) */
  function clearance(track, x, y, self, skip) {
    var best = Infinity, n = track.n;
    for (var j = 0; j < n; j++) {
      if (self != null) { var d = Math.abs(j - self); d = Math.min(d, n - d); if (d <= skip) continue; }
      var p = track.pts[j], dd = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  }
  function bbox(track) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    track.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  /* the grass island (world units): the track's box plus a margin wide enough for the stand */
  function islandRect(track, marginU) {
    var b = bbox(track), m = marginU == null ? 8 : marginU;
    var x0 = wx(b.x0) - m, x1 = wx(b.x1) + m, z0 = wz(b.y0) - m, z1 = wz(b.y1) + m;
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, r: 4 };
  }
  /* signed distance (u) from a world point to the island's rounded rectangle (outside > 0) */
  function islandSdf(rect, x, z) {
    var qx = Math.abs(x - rect.cx) - (rect.hx - rect.r), qz = Math.abs(z - rect.cz) - (rect.hz - rect.r);
    var ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - rect.r;
  }

  /* ---------------- the ribbon (one merged vertex-coloured mesh) ----------------
     Bands across the track (px from the centreline): verge to WALL, kerbs HW…HW+KERB
     (Coral / white blocks of 1 u), asphalt ±HW with dashes (0.4 u on, 0.45 u off), and
     a 2×10 start checker. Heights: verge 0.010, asphalt 0.016, kerbs 0.022, paint 0.026.
     Returns {position, normal, color} Float32Arrays (non-indexed, linear colours). */
  var RIB_Y = { verge: 0.010, asphalt: 0.016, kerb: 0.022, paint: 0.026, check: 0.027, zebra: 0.028, sticky: 0.030 };
  function kerbBlocks(len) { var n = Math.max(2, Math.round(len / U)); return n % 2 ? n + 1 : n; }
  function buildRibbon(track, opts) {
    opts = opts || {};
    var vergeHex = opts.verge || '#A6DC8E';
    var P = [], C = [];
    function tri(a, b, c, col) {
      /* faces up: flip any clockwise-from-above triangle */
      var cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (cy < 0) { var t = b; b = c; c = t; }
      P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      C.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    }
    function quad(a, b, c, d, col) { tri(a, b, c, col); tri(b, d, c, col); }
    function vtx(px, py, nx, ny, off, y) { return [wx(px + nx * off), y, wz(py + ny * off)]; }
    var n = track.n, pts = track.pts, tg = track.tang, i, j;
    var cVerge = linearRgb(vergeHex), cAsph = linearRgb(COL.asphalt), cDash = linearRgb(COL.dash);
    var cKA = linearRgb(COL.kerbA), cKB = linearRgb(COL.kerbB), cCA = linearRgb(COL.checkA), cCB = linearRgb(COL.checkB);
    /* verges + asphalt per centreline sample */
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      var a = pts[i], b = pts[j], na = [-tg[i][1], tg[i][0]], nb = [-tg[j][1], tg[j][0]];
      [[-WALL, -(HW + KERB)], [HW + KERB, WALL]].forEach(function (band) {
        quad(vtx(a[0], a[1], na[0], na[1], band[0], RIB_Y.verge), vtx(a[0], a[1], na[0], na[1], band[1], RIB_Y.verge),
             vtx(b[0], b[1], nb[0], nb[1], band[0], RIB_Y.verge), vtx(b[0], b[1], nb[0], nb[1], band[1], RIB_Y.verge), cVerge);
      });
      quad(vtx(a[0], a[1], na[0], na[1], -HW, RIB_Y.asphalt), vtx(a[0], a[1], na[0], na[1], HW, RIB_Y.asphalt),
           vtx(b[0], b[1], nb[0], nb[1], -HW, RIB_Y.asphalt), vtx(b[0], b[1], nb[0], nb[1], HW, RIB_Y.asphalt), cAsph);
    }
    /* kerbs: an even number of equal blocks so the colours alternate all the way round */
    var blocks = kerbBlocks(track.len), bl = track.len / blocks, sub = 3, p0 = {}, p1 = {};
    for (var k = 0; k < blocks; k++) {
      var col = k % 2 ? cKB : cKA;
      for (var q = 0; q < sub; q++) {
        pointAt(track, k * bl + q * bl / sub, p0); pointAt(track, k * bl + (q + 1) * bl / sub, p1);
        var n0x = -p0.ty, n0y = p0.tx, n1x = -p1.ty, n1y = p1.tx;
        for (var sd = -1; sd <= 1; sd += 2) {
          quad(vtx(p0.x, p0.y, n0x, n0y, sd * HW, RIB_Y.kerb), vtx(p0.x, p0.y, n0x, n0y, sd * (HW + KERB), RIB_Y.kerb),
               vtx(p1.x, p1.y, n1x, n1y, sd * HW, RIB_Y.kerb), vtx(p1.x, p1.y, n1x, n1y, sd * (HW + KERB), RIB_Y.kerb), col);
        }
      }
    }
    /* centre dashes: 0.4 u on, 0.45 u off, 0.1 u wide (none across the start checker) */
    var on = 0.4 * U, period = 0.85 * U, w = 0.05 * U;
    for (var s = 30; s + on < track.len - 10; s += period) {
      pointAt(track, s, p0); pointAt(track, s + on, p1);
      quad(vtx(p0.x, p0.y, -p0.ty, p0.tx, -w, RIB_Y.paint), vtx(p0.x, p0.y, -p0.ty, p0.tx, w, RIB_Y.paint),
           vtx(p1.x, p1.y, -p1.ty, p1.tx, -w, RIB_Y.paint), vtx(p1.x, p1.y, -p1.ty, p1.tx, w, RIB_Y.paint), cDash);
    }
    /* the start strip: 2 rows × 10 checker squares across the asphalt at the line */
    var sq = (2 * HW) / 10;
    for (var row = 0; row < 2; row++) {
      pointAt(track, row * sq, p0); pointAt(track, (row + 1) * sq, p1);
      for (var c = 0; c < 10; c++) {
        var l0 = -HW + c * sq, l1 = l0 + sq;
        quad(vtx(p0.x, p0.y, -p0.ty, p0.tx, l0, RIB_Y.check), vtx(p0.x, p0.y, -p0.ty, p0.tx, l1, RIB_Y.check),
             vtx(p1.x, p1.y, -p1.ty, p1.tx, l0, RIB_Y.check), vtx(p1.x, p1.y, -p1.ty, p1.tx, l1, RIB_Y.check), (c + row) % 2 ? cCB : cCA);
      }
    }
    var count = P.length / 3, N = new Float32Array(count * 3);
    for (i = 0; i < count; i++) N[i * 3 + 1] = 1;
    return { position: new Float32Array(P), normal: N, color: new Float32Array(C), tris: count / 3, kerbBlocks: blocks };
  }

  /* ---------------- tyre walls ----------------
     One stack every 6 samples per side at ±2.85 u, alternating candy tyres / foam blocks,
     pastel colour cycling; a stack that would stand on another stretch of track is skipped. */
  var STACK_OFF = 2.85 * U;
  function wallStacks(track) {
    var out = [], n = track.n;
    for (var i = 0; i < n; i += 6) {
      var p = track.pts[i], t = track.tang[i], nx = -t[1], ny = t[0];
      for (var sd = -1; sd <= 1; sd += 2) {
        var x = p[0] + nx * sd * STACK_OFF, y = p[1] + ny * sd * STACK_OFF;
        if (clearance(track, x, y, i, 14) < HW + KERB + 24) continue;
        out.push({ i: i, side: sd, x: x, y: y, ang: Math.atan2(t[1], t[0]), kind: ((i / 6) + (sd > 0 ? 0 : 1)) % 2 ? 'foam' : 'tyre', ci: (i / 6) % 3 });
      }
    }
    return out;
  }
  /* wall-stack bump wobble: scale 1 → 0.9 → 1.05 → 1 over 0.3 s */
  function wobbleScale(t) {
    if (t <= 0 || t >= 0.3) return 1;
    if (t < 0.1) return lerp(1, 0.9, outQuad(t / 0.1));
    if (t < 0.2) return lerp(0.9, 1.05, inOutSine((t - 0.1) / 0.1));
    return lerp(1.05, 1, inOutSine((t - 0.2) / 0.1));
  }
  /* the stack nearest a logic point (index into stacks) */
  function nearestStack(stacks, x, y) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < stacks.length; i++) {
      var d = (stacks[i].x - x) * (stacks[i].x - x) + (stacks[i].y - y) * (stacks[i].y - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ---------------- gates, gantry, grandstand, podium ---------------- */
  /* the checkpoint arches 1–3: the first sample at or past each fraction (as the 2D art draws them) */
  function gateSpots(track) {
    return CHECKS.map(function (f, g) {
      var target = f * track.len, idx = 0;
      while (idx < track.n - 1 && track.cum[idx] < target) idx++;
      var t = track.tang[idx];
      return { n: g + 1, i: idx, s: track.cum[idx], x: track.pts[idx][0], y: track.pts[idx][1], ang: Math.atan2(t[1], t[0]) };
    });
  }
  /* the grandstand: outside the finish straight (or the other side when that is crowded) */
  function grandstandSpot(track) {
    var inSide = infieldSide(track), tmp = {};
    var sides = [-inSide, inSide];
    for (var k = 0; k < sides.length; k++) {
      var side = sides[k], ok = true;
      for (var s = -6 * U; s <= 6 * U; s += U) {
        for (var off = 3.6 * U; off <= 6.4 * U; off += 0.7 * U) {
          offsetAt(track, s, side * off, tmp);
          /* only its own stretch of track may come near the stand */
          var c = clearance(track, tmp.x, tmp.y, tmp.i, 20);
          if (c < WALL + 0.6 * U) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok || k === sides.length - 1) {
        var mid = offsetAt(track, 0, side * 5 * U, {});
        return { side: side, x: mid.x, y: mid.y, ang: Math.atan2(mid.ty, mid.tx), width: 12, depth: 2.4, off: 5 * U, s: 0, clear: ok };
      }
    }
    return null;
  }
  /* the results podium: on the asphalt a few metres past the line, facing the infield */
  function podiumSpot(track) {
    var p = pointAt(track, 7 * U, {});
    return { x: p.x, y: p.y, ang: Math.atan2(p.ty, p.tx), face: infieldSide(track) };
  }
  /* podium step heights by place (P1 middle, P2 left, P3 right as seen from the front) */
  var PODIUM = { w: 1.25, d: 1.15, h: [0.9, 0.62, 0.42], x: [0, -1.3, 1.3] };

  /* ---------------- scenery scatter (the 2D art's deterministic positions) ---------------- */
  function scatter(track, count, opts) {
    opts = opts || {};
    var out = [], pool = opts.pool || 40, reserved = opts.reserved || [], rect = opts.rect || null;
    for (var i = 0; i < pool && out.length < count; i++) {
      var sx = (i * 619) % WW, sy = (i * 373) % WH, near = false;
      for (var q = 0; q < track.n; q += 4) { if (Math.hypot(track.pts[q][0] - sx, track.pts[q][1] - sy) < WALL + 60) { near = true; break; } }
      if (near) continue;
      for (var r = 0; r < reserved.length; r++) { if (Math.hypot(reserved[r].x - sx, reserved[r].y - sy) < reserved[r].r) { near = true; break; } }
      if (near) continue;
      if (rect && islandSdf(rect, wx(sx), wz(sy)) > -1.2) continue;
      out.push({ i: i, x: sx, y: sy, yaw: ((i * 137) % 360) * DEG, scale: 0.9 + ((i * 53) % 25) / 100 });
    }
    return out;
  }

  /* ---------------- set-pieces ---------------- */
  /* evenly spaced arc positions along a cyclic run of samples i0..i1; a run's physical
     straight reaches `extra` px (kart-logic's 200 px look-ahead) past its last sample */
  function runSpots(track, i0, i1, count, pad, extra) {
    var n = track.n, cnt = ((i1 - i0) % n + n) % n + 1, s0 = track.cum[i0], span = cnt * track.spacing + (extra || 0), out = [];
    pad = pad || 0;
    for (var k = 0; k < count; k++) out.push((s0 + pad + (span - 2 * pad) * (count > 1 ? k / (count - 1) : 0.5)) % track.len);
    return out;
  }
  /* GLOW TUNNEL: 8 neon arches spread evenly over the run, never within 2 u of the line or a gate */
  function tunnelArches(track, sp, count) {
    count = count || 8;
    var gates = [0].concat(CHECKS.map(function (f) { return f * track.len; }));
    var free = runSpots(track, sp.i0, sp.i1, 96, U, 160).filter(function (s) {
      return !gates.some(function (g) { var d = Math.abs(s - g) % track.len; return Math.min(d, track.len - d) < 2 * U; });
    });
    var out = [];
    if (!free.length) return out;
    for (var k = 0; k < count; k++) {
      var s = free[Math.round(k * (free.length - 1) / Math.max(1, count - 1))], p = pointAt(track, s, {});
      out.push({ k: k, s: s, x: p.x, y: p.y, ang: Math.atan2(p.ty, p.tx) });
    }
    return out;
  }
  /* CRYSTAL CHICANE: 8 gem rocks on the infield beside the run, each clear of every stretch */
  function crystalSpots(track, sp) {
    var side = infieldSide(track), out = [], tmp = {};
    runSpots(track, sp.i0, sp.i1, 10, U, 160).forEach(function (s, k) {
      if (out.length >= 8) return;
      var off = (WALL + 0.9 * U + (k % 3) * 0.35 * U) * side;
      offsetAt(track, s, off, tmp);
      if (clearance(track, tmp.x, tmp.y, null, 0) < WALL + 0.5 * U) return;
      out.push({ k: out.length, x: tmp.x, y: tmp.y, s: s, scale: 0.8 + (k % 3) * 0.2 });
    });
    return out;
  }
  /* DOLPHIN PALS: 3 dolphins in the sea beside the longest straights (outside the island) */
  function dolphinSpots(track, rect) {
    var runs = straightRuns(track).sort(function (a, b) { return b.count - a.count || a.start - b.start; });
    var out = [], side = -infieldSide(track), tmp = {};
    for (var r = 0; r < runs.length && out.length < 3; r++) {
      var mid = track.cum[(runs[r].start + Math.floor(runs[r].count / 2)) % track.n];
      pointAt(track, mid, tmp);
      /* walk outward from the track until we are 2.5 u out to sea */
      for (var off = WALL; off < 40 * U; off += U / 2) {
        var x = tmp.x - tmp.ty * side * off, y = tmp.y + tmp.tx * side * off;
        if (islandSdf(rect, wx(x), wz(y)) > 2.5) { out.push({ k: out.length, x: x, y: y, ang: Math.atan2(tmp.ty, tmp.tx), phase: out.length / 3 }); break; }
      }
    }
    return out;
  }
  /* straight runs (bend over 200 px < 0.35 rad), as kart-logic finds them */
  function straightRuns(track) {
    var n = track.n, ok = [], all = true, any = false, runs = [];
    var ahead = Math.round(200 / track.spacing);
    for (var i = 0; i < n; i++) {
      var a = track.tang[i], b = track.tang[(i + ahead) % n];
      var bend = Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
      ok.push(bend < 0.35); if (ok[i]) any = true; else all = false;
    }
    if (!any) return runs;
    if (all) return [{ start: 0, count: n }];
    for (var j = 0; j < n; j++) {
      if (ok[j] && !ok[(j - 1 + n) % n]) { var c = 0; while (c < n && ok[(j + c) % n]) c++; runs.push({ start: j, count: c }); }
    }
    return runs;
  }
  /* the cute volcano at logic (1152, 696): radius shrunk so its base never reaches a wall */
  var VOLCANO = { x: 1152, y: 696, r: 4.2, h: 3.6 };
  function volcanoFit(track) {
    var c = clearance(track, VOLCANO.x, VOLCANO.y, null, 0);
    var r = clamp((c - WALL) / U - 0.35, 1.2, VOLCANO.r);
    return { x: VOLCANO.x, y: VOLCANO.y, r: r, h: VOLCANO.h * Math.max(0.75, r / VOLCANO.r) };
  }
  /* trackside TV camera posts: every `spacing` u on the side with more room, 2.6 u up */
  function tvPosts(track) {
    var c = CAMERAS.tv, out = [], tmp = {}, n = Math.max(4, Math.round(track.len / (c.spacing * U)));
    for (var k = 0; k < n; k++) {
      var s = k * track.len / n, best = null;
      for (var sd = -1; sd <= 1; sd += 2) {
        offsetAt(track, s, sd * c.side * U, tmp);
        var cl = clearance(track, tmp.x, tmp.y, tmp.i, 10);
        if (!best || cl > best.cl) best = { s: s, x: tmp.x, y: tmp.y, side: sd, cl: cl };
      }
      out.push(best);
    }
    return out;
  }
  /* the post the TV camera cuts to: the first one ≥ 1.5 u ahead of arc position s */
  function tvPick(posts, s, len) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < posts.length; i++) {
      var d = ((posts[i].s - s) % len + len) % len;
      if (d < 1.5 * U) d += len;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ---------------- heights: the Stage Jump, and a course's other ramps ----------------
     A ramp wedge rises 0.35 u over the 64 px before the launch line (its lip). A course has several
     ramps, each with a band: a full ramp spans the tarmac and both kerbs, a Trick Ramp is the band
     w wide centred on its own x, y (which already sit off px to one side). J = one ramp or a list. */
  var RAMP_H = 0.35;
  function isTrick(J) { return !!J && J.w != null && J.w < 2 * (HW + KERB); }
  function rampHeight(J, x, y) {
    if (!J) return 0;
    if (Array.isArray(J)) {
      for (var i = 0, h = 0; i < J.length && !h; i++) h = rampHeight(J[i], x, y);
      return h;
    }
    var c = Math.cos(J.ang), s = Math.sin(J.ang), dx = x - J.x, dy = y - J.y;
    var d = dx * c + dy * s, lat = -dx * s + dy * c;
    if (Math.abs(lat) > (J.w != null ? J.w / 2 : HW + KERB) || d < -JUMP_LEN || d > 0) return 0;
    return RAMP_H * (d + JUMP_LEN) / JUMP_LEN;
  }
  /* the player's height (u): on a ramp, or airborne (the lip height fades over the flight) */
  function kartHeight(J, x, y, air, airH) {
    if (air && air.on && air.dur > 0) {
      var u = clamp01(air.t / air.dur);
      return airH / U + RAMP_H * (1 - u) * (1 - u);
    }
    return rampHeight(J, x, y);
  }
  /* a rival's height from its progress P: up a ramp, then the logic's view-only hop. Js = the
     jumps list (or one ramp's arc position, as before). A ramp with a band lifts only a racer inside
     it: lat is the racer's sideways place (px), and over is the logic's own verdict that it took the
     ramp (r.hopIn), used once it is past the lip. */
  function rampPass(js, off, w, len, P, hop, lat, over) {
    var d = ((P - js) % len + len) % len, inBand = w == null || lat == null || Math.abs(lat - off) <= w / 2;
    if (d > len - JUMP_LEN) return inBand ? RAMP_H * (d - (len - JUMP_LEN)) / JUMP_LEN : 0;
    if (d < 170 && (over == null ? inBand : !!over)) { var u = d / 170; return hop + RAMP_H * (1 - u) * (1 - u); }
    return 0;
  }
  function rivalHeight(Js, len, P, airHop, lat, over) {
    var hop = (airHop || 0) / U, h = 0;
    if (Js == null) return hop;
    if (typeof Js === 'number') return rampPass(Js, 0, null, len, P, hop, lat, over);
    for (var i = 0; i < Js.length; i++) h = Math.max(h, rampPass(Js[i].s, Js[i].off || 0, Js[i].w, len, P, hop, lat, over));
    return h;
  }

  /* ---------------- the things on a course's road (V4.55) ----------------
     Every reader takes the lists through jumpsOf / roadList, so a classic track (or a track from an
     older logic file) that has none of them reads as empty lists. */
  function jumpsOf(track) { var F = track && track.feat; return !F ? [] : F.jumps || (F.jump ? [F.jump] : []); }
  function roadList(track, key) { var F = track && track.feat; return (F && F[key]) || []; }
  /* is an item on the road on this lap (counted from 1)? An item with no laps list always is. */
  function outOn(rec, lap) { return !rec.laps || rec.laps.indexOf(lap) >= 0; }
  /* OBSTACLES: one spot per side an obstacle ever stands on (a mirrored one swaps sides on even
     laps), each with the laps it stands there → {ob, lat, x, y, ang, laps}. The same places as
     kart-logic obstacleAt. */
  function obstacleSpots(track) {
    var out = [], p = {};
    roadList(track, 'obstacles').forEach(function (o, i) {
      var seen = {};
      pointAt(track, o.s, p);
      (o.laps || []).forEach(function (lap) {
        var lat = o.mirror && lap % 2 === 0 ? -o.lat : o.lat, spot = seen[lat];
        if (!spot) {
          spot = seen[lat] = { ob: i, lat: lat, x: lat === o.lat ? o.x : p.x - p.ty * lat, y: lat === o.lat ? o.y : p.y + p.tx * lat, ang: Math.atan2(p.ty, p.tx), laps: [] };
          out.push(spot);
        }
        spot.laps.push(lap);
      });
    });
    return out;
  }
  /* CROSSERS: where crosser c is at race clock t → {x, y, tx, ty, lat, dir}: a triangle wave across
     the road, the same maths as kart-logic crosserAt (dir +1 = heading to the driver's right) */
  function crosserPos(track, c, t, out) {
    var u = t / c.period + c.phase + 0.75;
    u -= Math.floor(u);
    var lat = c.amp * (4 * Math.abs(u - 0.5) - 1);
    out = offsetAt(track, c.s, lat, out);
    out.lat = lat; out.dir = u >= 0.5 ? 1 : -1;
    return out;
  }
  /* the warning sign for a crosser: on the verge 250 px before it, on the driver's right unless the
     left is clearly further from every stretch of road (the outside of a bend, away from a neighbour) */
  var SIGN_BEFORE = 250, SIGN_OFF = HW + KERB + 20;
  function signSpot(track, c) {
    var best = null, tmp = {};
    for (var sd = 1; sd >= -1; sd -= 2) {
      offsetAt(track, c.s - SIGN_BEFORE, sd * SIGN_OFF, tmp);
      var cl = clearance(track, tmp.x, tmp.y, null, 0);
      if (!best || cl > best.clear + 0.5) best = { x: tmp.x, y: tmp.y, ang: Math.atan2(tmp.ty, tmp.tx), side: sd, clear: cl };
    }
    return best;
  }
  /* Easy Drive: the Glow Line shows no dot in the 150 px before a crosser that is out on that lap
     (the baked run met it at another moment, so its line there would mislead) */
  var GLOW_GAP = 150;
  function glowGap(track, P, lap) {
    var list = roadList(track, 'crossers'), len = track.len;
    for (var i = 0; i < list.length; i++) {
      if (outOn(list[i], lap) && ((list[i].s - P) % len + len) % len <= GLOW_GAP) return true;
    }
    return false;
  }
  /* STICKY PATCHES: fill and rim colour by skin, the patch (if any) over arc position s on a lap,
     and the flat decal — a darker rim round a lighter middle with rounded corners, one row every
     ≤ 16 px so it bends with the road, never outside the patch's own rectangle (s0…s1 × lat0…lat1).
     Returns ribbon-style arrays (world units, linear colours). */
  var STICKY_LOOK = {
    bubblegum: { fill: '#FF8FC8', rim: '#E0559E' }, 'toffee-lava': { fill: '#FF8A5C', rim: '#C9552B' },
    seaweed: { fill: '#4FBF63', rim: '#2F8F4A' }, 'wet-sand': { fill: '#C9A45E', rim: '#A07F3F' }
  };
  function stickyLook(skin) { return Object.prototype.hasOwnProperty.call(STICKY_LOOK, skin) ? STICKY_LOOK[skin] : STICKY_LOOK.bubblegum; }
  function stickyAt(track, s, lap) {
    var list = roadList(track, 'sticky'), len = track.len;
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (outOn(z, lap) && ((s - z.s0) % len + len) % len <= z.s1 - z.s0) return z;
    }
    return null;
  }
  function stickyDecal(track, list) {
    var P = [], C = [], a = {}, b = {};
    function tri(p, q, r, col) {
      if ((q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) < 0) { var t = q; q = r; r = t; }   /* faces up */
      P.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
      C.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    }
    list.forEach(function (z) {
      var look = stickyLook(z.skin), mid = (z.lat0 + z.lat1) / 2, half = Math.abs(z.lat1 - z.lat0) / 2;
      [[0, RIB_Y.sticky, look.rim], [5, RIB_Y.sticky + 0.002, look.fill]].forEach(function (layer) {
        var inset = layer[0], y = layer[1], col = linearRgb(layer[2]), span = z.s1 - z.s0 - 2 * inset, hw = half - inset;
        if (span <= 0 || hw <= 0) return;
        var cap = Math.min(hw, span / 4, 20), n = Math.max(2, Math.ceil((span - 2 * cap) / 16)), ds = [0, cap * 0.3], prev = null;
        for (var k = 0; k <= n; k++) ds.push(cap + (span - 2 * cap) * k / n);
        ds.push(span - cap * 0.3, span);
        ds.forEach(function (d) {
          var e = Math.min(d, span - d), w = hw - (e < cap ? cap - Math.sqrt(cap * cap - (cap - e) * (cap - e)) : 0);
          offsetAt(track, z.s0 + inset + d, mid - w, a); offsetAt(track, z.s0 + inset + d, mid + w, b);
          var row = [[wx(a.x), y, wz(a.y)], [wx(b.x), y, wz(b.y)]];
          if (prev) { tri(prev[0], prev[1], row[0], col); tri(prev[1], row[1], row[0], col); }
          prev = row;
        });
      });
    });
    var count = P.length / 3, N = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) N[i * 3 + 1] = 1;
    return { position: new Float32Array(P), normal: N, color: new Float32Array(C), tris: count / 3 };
  }
  /* the shared halo pool's capacity for a track: 3 gate arches × 14 bulbs, 14 gantry bulbs, 9 bank
     lenses, a wand per fan, one per Glow Note, 8 set-piece glints and 4 spare — then 16 marquee
     bulbs per full ramp, 12 per Trick Ramp, one per Zap Cell and one per crosser sign */
  function rampBulbs(J) { return isTrick(J) ? 12 : 16; }
  function haloNeed(track, nFans) {
    var n = 42 + 14 + 9 + (nFans || 0) + roadList(track, 'notes').length + 8 + 4;
    jumpsOf(track).forEach(function (J) { n += rampBulbs(J); });
    return n + roadList(track, 'cells').length + roadList(track, 'crossers').length;
  }

  /* ---------------- view-only kart animation ---------------- */
  /* squash timelines → {sy, sxz}: 'hop' (drift entry), 'land', 'bump' (x on the hit side) */
  function squashAt(kind, t, out) {
    out = out || {};
    out.sy = 1; out.sxz = 1;
    if (t < 0) return out;
    if (kind === 'hop') {
      if (t < 0.08) { var a = t / 0.08; out.sy = lerp(1, 0.8, a); out.sxz = lerp(1, 1.12, a); }
      else if (t < 0.28) { var b = outBack((t - 0.08) / 0.2); out.sy = lerp(0.8, 1, b); out.sxz = lerp(1.12, 1, b); }
    } else if (kind === 'land') {
      if (t < 0.07) { var c = t / 0.07; out.sy = lerp(1, 0.75, c); out.sxz = lerp(1, 1.15, c); }
      else if (t < 0.27) { var d = outBack((t - 0.07) / 0.2); out.sy = lerp(0.75, 1, d); out.sxz = lerp(1.15, 1, d); }
    } else if (kind === 'bump') {
      if (t < 0.06) out.sxz = lerp(1, 0.85, t / 0.06);
      else if (t < 0.3) out.sxz = lerp(0.85, 1, outBack((t - 0.06) / 0.24));
    }
    return out;
  }
  /* the cartoon spin-out: 2 visual turns and a 0.25 u hop over SPIN_T. A course's tumble is the
     same code for a shorter time: pass its length and 1 turn (the hop shrinks with the turns). */
  function spinPose(spinT, out, dur, turns) {
    out = out || {};
    turns = turns == null ? 2 : turns;
    var u = spinT > 0 ? clamp01(1 - spinT / (dur || SPIN_T)) : 0;
    out.turn = spinT > 0 ? turns * TAU * outQuad(u) : 0;
    out.hop = spinT > 0 ? 0.125 * turns * arc(u) : 0;
    return out;
  }
  /* roll (rad, + = top toward the driver's right) from the turn rate ω (rad/s) */
  function bodyRoll(omega, drifting) {
    var k = clamp(omega / 2.9, -1, 1);
    return k * (drifting ? 10 : 6) * DEG;
  }

  /* ---------------- crowd ---------------- */
  /* sway ±15° at 1 Hz with a per-fan phase */
  function crowdSway(t, phase, reduced) { return reduced ? 0 : 15 * DEG * Math.sin(TAU * (t + phase)); }
  /* the stadium wave: a 0.4 s hop travelling across the stand in 1.2 s (u = 0..1 along) */
  function waveLift(u, since) {
    if (since == null || since < 0) return 0;
    var t = since - u * 1.2;
    return t < 0 || t > 0.4 ? 0 : arc(t / 0.4);
  }

  /* ---------------- beat visuals (all at half-time of 140 BPM or slower) ---------------- */
  function beatPhase(t) { var p = (t % BEAT2) / BEAT2; return p < 0 ? p + 1 : p; }
  /* Beat Strip chevrons: 1 = Neon Pink (the lit half), 0 = Neon Cyan, a sine cross-fade */
  function chevronMix(phase) { return 0.5 + 0.5 * Math.cos(TAU * (phase - 0.25)); }
  /* marquee bulb chase at ≤ 1.17 Hz: bulb i of n */
  function bulbChase(i, n, t) { return 0.5 + 0.5 * Math.cos(TAU * (t / BEAT2 - i / n)); }
  /* GLOW TUNNEL: one arch lit per beat (140 BPM), in sequence (each arch 0.29 Hz) */
  function tunnelLit(k, count, t) {
    var beat = Math.floor(t / (60 / 140));
    return ((beat % count) + count) % count === k;
  }

  /* the rates (Hz) the track scene animates a course's road things at; the crosser's sweep is the
     logic's, listed at the fastest the fairness rules allow (a 3 s cycle; 4 s as authored) */
  var RATES = { zoomSlide: 1, cellSpin: 0.5, cellBob: 1, crossSweep: 1 / 3, shuffle: 2 };
  /* every periodic visual and its rate (Hz) — luminance ones must stay ≤ 1.17 Hz, all ≤ 2 */
  var PULSES = [
    { name: 'beat strip chevrons', hz: 1 / BEAT2, luminance: true },
    { name: 'gate arch bulb chase', hz: 1 / BEAT2, luminance: true },
    { name: 'gantry bulb chase', hz: 1 / BEAT2, luminance: true },
    { name: 'jump bulbs', hz: 1 / BEAT2, luminance: true },
    { name: 'glow tunnel arch', hz: 140 / 60 / 8, luminance: true },
    { name: 'crystal glint', hz: 1 / BEAT2, luminance: true },
    { name: 'countdown light banks', hz: 1, luminance: true },
    { name: 'wrong-way hologram', hz: 1, luminance: true },
    { name: 'hype wand bulb (HUD)', hz: 1, luminance: true },
    { name: 'spot cone sweep', hz: 0.12, luminance: false },
    { name: 'crowd sway', hz: 1, luminance: false },
    { name: 'glow note spin', hz: 0.5, luminance: false },
    { name: 'glow note bob', hz: 1, luminance: false },
    { name: 'dolphin leaps', hz: 1 / (8 * 60 / 140), luminance: false },
    { name: 'volcano smoke', hz: 1 / 3, luminance: false },
    /* V4.55, the things on a course's road: all movement, none of them changes brightness */
    { name: 'zoom strip arrow slide', hz: RATES.zoomSlide, luminance: false },
    { name: 'zap cell spin', hz: RATES.cellSpin, luminance: false },
    { name: 'zap cell bob', hz: RATES.cellBob, luminance: false },
    { name: 'crosser sweep', hz: RATES.crossSweep, luminance: false },
    { name: 'crosser shuffle', hz: RATES.shuffle, luminance: false }
  ];

  /* ---------------- occlusion: should a rival switch to its see-through sleeve? ---------------- */
  /* true when p (world) is within r of the segment cam → target, or within 0.6 u of target */
  function occludes(cx, cy, cz, tx, ty, tz, px, py, pz, r) {
    var dx = tx - cx, dy = ty - cy, dz = tz - cz, L2 = dx * dx + dy * dy + dz * dz;
    var ex = px - tx, ey = py - ty, ez = pz - tz;
    if (ex * ex + ey * ey + ez * ez < 0.36) return true;
    if (L2 < 1e-6) return false;
    var u = ((px - cx) * dx + (py - cy) * dy + (pz - cz) * dz) / L2;
    if (u <= 0 || u >= 1) return false;
    var qx = cx + dx * u - px, qy = cy + dy * u - py, qz = cz + dz * u - pz;
    return qx * qx + qy * qy + qz * qz < r * r;
  }

  /* ---------------- HUD strings ---------------- */
  function fmtMs(ms) {
    var t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60, s = sec.toFixed(2);
    if (Number(s) >= 60) { m++; s = '0.00'; }
    return m + ':' + (Number(s) < 10 ? '0' : '') + s;
  }
  function placeText(place, total) { return 'P' + place + '/' + total; }
  function gapText(gap, place) { return gap == null || place <= 1 ? '' : '+' + gap.toFixed(1) + ' s to P' + (place - 1); }
  /* a pacer split: ahead (dt ≤ 0) in Leaf Mint, behind in Coral */
  function splitText(icon, dt) { return { text: (icon ? icon + ' ' : '') + (dt <= 0 ? '−' : '+') + Math.abs(dt).toFixed(2), ahead: dt <= 0 }; }
  /* the Hype Wand pips (8 of 5 points; they drain through a Spotlight) */
  function wandPips(wand, spotT, spotDur, wandMax) {
    if (spotT > 0) return Math.max(0, Math.min(8, Math.ceil(8 * spotT / (spotDur || 6))));
    return Math.max(0, Math.min(8, Math.floor((wand || 0) / ((wandMax || 40) / 8))));
  }
  /* the gantry LED line */
  function ledText(o) {
    if (o.override) return o.override;
    var parts = ['NEON GRAND PRIX', 'LAP ' + Math.min(o.laps, o.lap + 1) + '/' + o.laps];
    if (o.place) parts.push('P' + o.place);
    return parts.join(' · ');
  }
  function finishLed(place, ms) { return (place ? 'P' + place : 'FINISH') + ' · ' + fmtMs(ms); }
  /* the gantry LED line when the course changes at a lap line (the logic's 'act' event) */
  function actLed(name) { return name === 'encore' ? 'ENCORE' : 'SHOWTIME'; }

  /* the centre pop words: one colour each; never more than 2 on screen */
  var WORDS = {
    rocket: { text: 'ROCKET START!', big: true, color: COL.starGold },
    spark: { text: 'SPARK BOOST!', big: true, color: COL.neonPink },
    spotlight: { text: 'SPOTLIGHT!', big: true, color: COL.starGold },
    onbeat: { text: 'ON BEAT!', big: false, color: COL.neonPink },
    clean: { text: 'CLEAN!', big: false, color: COL.leafMint },
    trail: { text: '♪ FULL TRAIL!', big: false, color: COL.neonPink },
    pass: { text: 'PASS!', big: false, color: null },
    scrape: { text: 'Scrape!', big: false, color: COL.coral },
    bump: { text: 'Bump!', big: false, color: COL.coral },
    spin: { text: 'Spin-out!', big: false, color: COL.coral },
    trick: { text: 'TRICK!', big: false, color: COL.starGold },
    zap: { text: 'ZAP!', big: false, color: COL.neonLime },
    bonk: { text: 'Bonk!', big: false, color: COL.coral },
    tumble: { text: 'Tumble!', big: false, color: COL.coral },
    sticky: { text: 'Sticky!', big: false, color: COL.bubblegum },
    showtime: { text: 'SHOWTIME!', big: true, color: COL.neonPink }
  };
  function WordLimiter(max, life) {
    this.max = max || 2; this.life = life || 0.9; this.times = [];
  }
  /* true when a word may show now (t in seconds); records it */
  WordLimiter.prototype.push = function (t) {
    var keep = [], life = this.life;
    for (var i = 0; i < this.times.length; i++) if (t - this.times[i] < life) keep.push(this.times[i]);
    this.times = keep;
    if (keep.length >= this.max) return false;
    keep.push(t);
    return true;
  };
  WordLimiter.prototype.clear = function () { this.times.length = 0; };

  /* the minimap: an SVG path for the centreline in a w-wide box (north up, like 2D) */
  function minimap(track, w) {
    var sx = w / WW, h = Math.round(WH * sx), d = '';
    for (var i = 0; i < track.n; i += 2) d += (i ? 'L' : 'M') + (track.pts[i][0] * sx).toFixed(1) + ' ' + (track.pts[i][1] * sx).toFixed(1);
    return { d: d + 'Z', w: w, h: h, sx: sx };
  }

  /* ---------------- particle budgets ---------------- */
  var PARTICLES = { LOW: 128, MID: 256, HIGH: 512 };
  var SPARK_RATE = [8, 8, 14, 20];             /* drift sparks per second by tier (0 = draining) */
  function particleCap(tier, scale) { return Math.max(32, Math.round((PARTICLES[tier] || 256) * (scale == null ? 1 : scale))); }
  /* particles under reduced motion are cut by 60% */
  function emitCount(n, reduced, scale) { var v = n * (reduced ? 0.4 : 1) * (scale == null ? 1 : scale); return Math.max(n > 0 ? 1 : 0, Math.round(v)); }
  /* whole emissions due this frame for a rate → {n, carry} (written into out when given) */
  function due(rate, dt, carry, out) {
    var v = (carry || 0) + Math.max(0, rate) * Math.max(0, dt), n = Math.floor(v);
    out = out || {};
    out.n = n; out.carry = v - n;
    return out;
  }

  return {
    VERSION: VERSION, U: U, WW: WW, WH: WH, CX: CX, CZ: CZ, HW: HW, KERB: KERB, VERGE: VERGE, WALL: WALL, JUMP_LEN: JUMP_LEN,
    SPIN_T: SPIN_T, BEAT2: BEAT2, CHECKS: CHECKS, DEG: DEG, TAU: TAU, RIB_Y: RIB_Y, STACK_OFF: STACK_OFF, RAMP_H: RAMP_H,
    COL: COL, TIER_COL: TIER_COL, STACK_COL: STACK_COL, CONFETTI: CONFETTI, MEDAL_COL: MEDAL_COL, KARTS: KARTS, PETCOL: PETCOL,
    TRACK_LOOK: TRACK_LOOK, DAY: DAY, SHOW: SHOW, ARC_K: ARC_K, ARC_SEC: ARC_SEC, ARC_SEC_REDUCED: ARC_SEC_REDUCED,
    CAMERAS: CAMERAS, CAM_ORDER: CAM_ORDER, CAM_LABEL: CAM_LABEL, PODIUM: PODIUM, VOLCANO: VOLCANO, PULSES: PULSES, WORDS: WORDS,
    PARTICLES: PARTICLES, SPARK_RATE: SPARK_RATE,
    clamp: clamp, clamp01: clamp01, lerp: lerp, wrapAngle: wrapAngle, lerpAngle: lerpAngle, damp: damp, smooth: smooth,
    outBack: outBack, inOutSine: inOutSine, outQuad: outQuad, inQuad: inQuad, arc: arc,
    wx: wx, wz: wz, yawOf: yawOf, yawDir: yawDir,
    normHex: normHex, hexRgb: hexRgb, srgbToLinear: srgbToLinear, linearRgb: linearRgb, rgbHex: rgbHex, mixHex: mixHex, shadeHex: shadeHex,
    kartHex: kartHex, kartId: kartId, trackLook: trackLook,
    arcK: arcK, encoreK: encoreK, arcPreset: arcPreset, arcBlend: arcBlend,
    camMode: camMode, nextCam: nextCam, boostEase: boostEase, camDesired: camDesired, craneAt: craneAt, pushIn: pushIn,
    orbitAngle: orbitAngle, shakeAmp: shakeAmp,
    pointAt: pointAt, offsetAt: offsetAt, infieldSide: infieldSide, clearance: clearance, bbox: bbox, islandRect: islandRect, islandSdf: islandSdf,
    kerbBlocks: kerbBlocks, buildRibbon: buildRibbon, wallStacks: wallStacks, wobbleScale: wobbleScale, nearestStack: nearestStack,
    gateSpots: gateSpots, grandstandSpot: grandstandSpot, podiumSpot: podiumSpot, scatter: scatter,
    runSpots: runSpots, tunnelArches: tunnelArches, crystalSpots: crystalSpots, dolphinSpots: dolphinSpots, straightRuns: straightRuns,
    volcanoFit: volcanoFit, tvPosts: tvPosts, tvPick: tvPick,
    rampHeight: rampHeight, kartHeight: kartHeight, rivalHeight: rivalHeight,
    RATES: RATES, STICKY_LOOK: STICKY_LOOK, GLOW_GAP: GLOW_GAP, SIGN_BEFORE: SIGN_BEFORE,
    isTrick: isTrick, jumpsOf: jumpsOf, roadList: roadList, outOn: outOn, obstacleSpots: obstacleSpots, crosserPos: crosserPos,
    signSpot: signSpot, glowGap: glowGap, stickyLook: stickyLook, stickyAt: stickyAt, stickyDecal: stickyDecal,
    rampBulbs: rampBulbs, haloNeed: haloNeed, actLed: actLed,
    squashAt: squashAt, spinPose: spinPose, bodyRoll: bodyRoll, crowdSway: crowdSway, waveLift: waveLift,
    beatPhase: beatPhase, chevronMix: chevronMix, bulbChase: bulbChase, tunnelLit: tunnelLit, occludes: occludes,
    fmtMs: fmtMs, placeText: placeText, gapText: gapText, splitText: splitText, wandPips: wandPips, ledText: ledText, finishLed: finishLed,
    WordLimiter: WordLimiter, minimap: minimap, particleCap: particleCap, emitCount: emitCount, due: due
  };
}));
