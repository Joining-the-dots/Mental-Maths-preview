/* ================================================================
   My Island 3D — the camera rig (island chunk 10; classic script).
   window.SLIslandCamera in the browser, module.exports in Node. The rig
   and the gesture recognizer are PURE (no DOM, no THREE): numbers in,
   numbers out, so they run in Node tests. Controls() is the only DOM
   part; it turns pointer / wheel / key events into rig calls and hands
   taps, long-presses and item drags back to the scene (island3d.js).

   STATE  {tx, tz, yaw, elev, zoom}: target (x, 0.3, z) on the land, yaw
   (deg, ±35), elevation (deg, 34–67 in play, 40–67 while editing; 48 by
   default, edit / place tilt to 62), zoom (0.75–1.6; 2.45 on portrait
   phones, whose home view starts zoomed to 1.75 so a home-only island gets
   ~45 × 33 px cells on a 360 px stage). Portrait phones and the stage-cam
   moves: dist = fitDist(land, yaw, elev, aspect) / zoom (the same maths as
   SLGrid3D.fitCamera, allocation-free). Every other view frames the island
   as it really stands (FRAME: the organic coast, the pier / lookout, the
   rocks the land reaches; 2.9 u tall items included) with fitFrame, and in
   play keeps the top 18% of the frame for the city across the bay (the
   target slides toward it; the band eases out in edit / place and from zoom
   1 to 1.3). Zoomed in past 1.2 in play mode the target may also
   glide up to 2.5 u further toward -z (the city side of the bay). Input
   moves a GOAL; the shown state eases toward it (damping 0.12 per 60 Hz
   frame) and flicks carry inertia. Under reduced motion every change is a
   static cut and there is no inertia, orbit, dip or shake.

   API (pure)
     LIMITS, SKYLINE, TARGET_Y, DEG_PER_PX
     damp(dt, rate) · clamp · lerp · wrapDeg
     boundsOf(land) → {minX, maxX, minZ, maxZ, cx, cz, maxY, top, bottom}
     fitDist(b, yawDeg, elevDeg, aspect, fov?, margin?, near?) → dist
     FRAME · frameOf(land) → frame points · fitFrame(frame, yawDeg, elevDeg, aspect, band, out) → {depth, shift, dist}
     bandAt(zoom) → the share of the skyline band a zoom keeps
     basisInto(yawDeg, elevDeg, out) → out {Dx..Dz, Rx..Rz, Ux..Uz}
     panDelta(dxPx, dyPx, viewH, dist, fov, yawDeg, elevDeg, out) → {x, z}
     panLimit(b, zoom, slack) → {x, z} · backPanFor(zoom, mode) → extra -z travel (u)
     zoomMaxFor(touch, aspect) · homeZoomFor(touch, aspect) · isPhone(touch, aspect)
     orbitDip(orbitYaw, elev) → degrees the Showtime orbit lowers the view (≤ 6, never below 40)
     topRayDeg(pose) → the top frustum edge's angle above the horizontal (≥ 0: the sky shows)
     skylineFit(aspect, out) → {zoom, ty}   the hero shot's zoom / target height for a view aspect
     projectPose(p, pose, out) → {x, y, depth} (NDC) · groundAt(pose, nx, ny, y, out) → point | null
   Rig(o) → rig            o {grid, motion, reduced, touch, aspect, land}
     rig.setLand(land, {smooth}) · rig.resize(w, h) · rig.setTouch(on) · rig.setReduced(on)
     rig.setMode('play' | 'edit' | 'place', {keepZoom}?)   edit/place ease to yaw 0 / elev 62 in
                                             ~0.4 s (place on phones also zooms to ≥ 1.4× unless
                                             keepZoom: a drag carried the item); leaving restores the view
     rig.orbitBy(dYaw, dElev) · rig.panBy(dxPx, dyPx) · rig.zoomBy(f, focus?) → changed
     rig.fling(vx, vy, mode) · rig.command('left'|'right'|'up'|'down'|'in'|'out'|'reset')
     rig.reset(instant) · rig.focusOn(point, {zoom, instant}) · rig.keepInView(point, frac)
     rig.skyline({easeIn, hold, at}?) → Promise   the establishing hero shot (SKYLINE): elev 14, yaw -16,
                                             target raised to y 2.0 and 1.5 u toward the city, zoom 0.8 (wider
                                             than 4:3: skylineFit opens and lifts it so the tower tops stay in
                                             frame); hold 0.9 s, then 1.8 s inOutSine back to the user view. On mount it
                                             starts in the pose (easeIn 0); the stage encore eases in. Any user
                                             camera input releases it (0.45 s); reduced motion skips it
     rig.reveal() (= skyline()) · rig.crane(point) → Promise · rig.pushIn(point, {zoom}) → Promise
     rig.dance(point, sec) · rig.releaseMove(kind?) · rig.interrupt() → released a skippable move?
     rig.freeze(on)    a finger is down: a skippable move holds still (the press picks what it sees)
     rig.showOrbit(on) · rig.shake(amp, dur)
     rig.update(dt) → changed     (once per frame; zero allocation)
     rig.pose {px, py, pz, tx, ty, tz, yaw, elev, zoom, dist, fov, aspect, near, far}
     rig.version (bumps whenever the pose changes) · rig.moving · rig.apply(camera)
     rig.project(p, out) · rig.groundAt(nx, ny, y, out) · rig.zoomedIn() · rig.canOrbit() · rig.homeZoom() · rig.info()
   Gesture(o) → pure pointer recognizer (tap 8 px / up to 1 s — a slow press released in place is
     still a tap, also after the long-press —, long-press 450 ms, hold 1 s (no tap after it),
     claimed item drag 10 px, double tap 320 ms / 24 px, pinch + twist)
     down(id, x, y, tMs, {claim, cam}) / move / up / cancel(id) / tick(tMs) → events[] · nextTick(tMs)
     events: press · tap {count, long} · longpress · hold · dragstart · drag · dragend {cancelled} ·
             orbit | orbitX | pan {dx, dy} · pinch {scale, rotate, dx, dy, cx, cy} · release {vx, vy, mode}
   Controls(el, rig, hooks) → {key(e) → handled, setEnabled(on), cancel(), dispose()}   (browser only)
     hooks {press(x, y, e) → 'item' | 'ghost' | null, tap(x, y, count, long), longPress(x, y, claim),
            hold(x, y, claim), dragStart(x, y, x0, y0), drag(x, y), dragEnd(x, y, cancelled), camera(),
            input(kind)   ('press' | 'wheel' | 'key': any input, before it is handled),
            up()          (the last finger lifted or was cancelled)}
     dragEnd(…, cancelled = true) is a cancel, never a release: pointercancel, a second finger,
     cancel() / setEnabled(false), or a lost pointer capture that cannot be taken back (a capture lost
     while the finger is down — the element was re-parented — is re-taken and the gesture goes on).
     Mouse: left-drag orbits (play mode), right/shift-drag pans, wheel zooms toward the cursor.
     Touch: one finger orbits (yaw) — or pans once zoomed in —, two fingers pinch-zoom,
     twist-rotate and pan. Keys (while the camera buttons have focus): [ ] rotate,
     + − zoom, 0 reset, ←→ rotate, ↑↓ tilt, Shift+arrows pan.

   V3 — My Island v3, the sky world (W3.6, plan-v3 contracts.camera). Rig(o) takes o.profile 'v2' (the
   default: everything above, unchanged) | 'v3' (and o.elevDefault, lab 40–48). Under 'v3':
     V3 {ELEV_DEFAULT 44, FAR 240, BAND_HOME 0.18, BAND_ZOOM, BAND_SKY 0.10, VISIT_ZOOM_PHONE 1.5 (≤ 12
       columns; VISIT_ZOOM_PHONE_WIDE 1.75 above: the pier, D90), HOME_ZOOM_PHONE 1.75, TOUR, FLIGHT,
       DIP, SKYMAP, CULL_EPS}
     isleFrame(isle, placedTops?, {land}?) → the island's play framing (Home: v2's, with the five gate
       pads as free extras and no rocks; a land: its cells padded by the rim down to the slab bottom,
       2.9 u tops under the 0.10 sky band, taller tops (the landmark, ≤ 5.5 u) free into it, the dock
       and 1.5 u of its bridge) · visitPose(isle, aspect, touch, out) → {tx, ty, tz, yaw, elev, zoom}
     skyBox(isle) · skyMapFit(aspect, touch, out, {yaw}?) → {tx, ty, tz, yaw, elev, dist, zoom}
     flightSec(travelU) · flightPose(A, B, u, out, {pullBack, riseDeg}?) · inOutSine
     elevCapFor(yaw, aspect) · yawCapFor(aspect, elev): the face-culling guard (the steepest tilt / the
       widest orbit at which no ray of the frame looks back toward +z: the voxel engine culls '-z' and
       '-y' faces). The rig applies it to the user view, the Showtime sway, every move and flight.
     rig.setIsle(frame | isle, {smooth}) · rig.isle · rig.tyBase (the target height: island top + 0.3)
     rig.fly(frame | isle, {sec, reduced}) → Promise<bool> · rig.skyMap(on, {reduced}) → Promise<bool>
     rig.intro() → Promise<bool> (the Sky tour; skyline() / reveal() are its aliases, and an eased-in
       skyline (the encore) is rig.crane) · rig.skip() · rig.onDip(fn('in' | 'cut' | 'out'))
     Yaw ±35° round each island's lead yaw, the pan clamped to its own frame (travel is flight only);
     every stage-cam move works in the current island's frame. During a flight or the tour any camera
     gesture (and a press: rig.freeze) skips to the arrival in 0.35 s and is otherwise ignored; the
     held Sky map takes taps only. Reduced motion (or {reduced}) makes every trip a sky dip.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIslandCamera = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 2;
  var DEG = Math.PI / 180;
  var TARGET_Y = 0.3;

  var LIMITS = {
    fov: 30, near: 0.5, far: 200, margin: 0.06,
    /* v2: a lower, more cinematic default (the media barges and the quay's LED lip in frame);
       a deliberate downward drag in play reaches 34° and shows more of the city */
    yaw: 35, elevMin: 34, elevMinEdit: 40, elevMax: 67, elevDefault: 48, editElev: 62,
    zoomMin: 0.75, zoomMax: 1.6, zoomPhone: 2.45, zoomHomePhone: 1.75, placeZoomPhone: 1.4, pushZoomMax: 2.2,
    damping: 0.12,            /* per 60 Hz frame (the bible's inertia damping) */
    snapDamping: 0.2,         /* mode tilts / resets / framing: settle within ~0.4 s */
    snapSec: 0.45,
    flingKeep: 0.03,          /* velocity left after 1 s of coasting */
    panSlack: 0.35,           /* u the target may leave the framed centre at zoom ≤ 1 */
    /* zoomed in, the target may glide this much further toward -z (over the channel) */
    backPan: 2.5, backPanFrom: 1.2, backPanFull: 1.5,
    /* the Showtime orbit's elevation dip at full sway, never taking the view below the floor */
    orbitDeg: 8, orbitDip: 6, orbitDipFloor: 40,
    keyYaw: 15, keyElev: 5, keyZoom: 1.25, keyPanPx: 48
  };
  /* the establishing hero shot: low over the bay, the target raised and pulled toward the city so
     the towers, the Halo Wheel and the Lantern Bridge fill the top of the frame (top ray ≈ +1°).
     The shot is never quite still: its yaw creeps 2° over the whole move (a slow dolly).
     wide: up to 4:3 the land fits by width and the pose is exactly the one above; a wider view is
     height-limited, so per 16:9-minus-4:3 step of extra width (at most `max` steps) the shot opens
     by `zoom` and lifts the target by `ty`, keeping the tallest towers and the Signal Mast's tip
     inside the top edge (city3d LAYERS.L3 ≤ 9 u + the 1 u mast; tested at 16:10, 16:9 and 2.4:1) */
  var SKYLINE = { elev: 14, yaw: -16, ty: 2.0, dz: -1.5, zoom: 0.8, hold: 0.9, ease: 1.8, drift: 2, release: 0.45, freezeMax: 1.5,
    wide: { from: 4 / 3, step: 16 / 9 - 4 / 3, zoom: -0.12, ty: 0.5, max: 2 } };
  /* the play framing (landscape views and wide windows; portrait phones keep the plain fit and its
     finger-sized 1.75 home zoom). The island is fitted as it really stands, not as its cell squares:
     the organic coast reaches up to 0.85 u past the cells (terrain3d COAST.max with the cove / meadow
     biases), the cove pier and the meadow lookout stick out further, and Lantern Islet / the rock stacks
     belong in the picture once the land reaches them (rockNear). In play the top `band` of the frame is
     kept for the city across the bay: the island fills the frame below it (the target slides toward
     the city to centre it there), so the quay, the barges and the mid-rise skyline always show. The
     band eases out in edit / place, when zoomed in past 1–1.3 and under every stage-cam move (which
     keeps its own v2 pose). */
  var FRAME = {
    coast: 0.9, band: 0.18, bandZoom: [1, 1.3], rockNear: 1.8, edge: 0.98,
    /* [x, y, z, region, free] scenery past the coast (terrain3d STRUCT); free: may rise into the band */
    extras: [[4.2, 0.4, -5.85, 'home', 1] /* NE ferry jetty tip */, [9.7, 0.1, 0.4, 'cove', 0] /* cove pier tip */,
             [-9.05, 0.5, -3.63, 'meadow', 0] /* meadow lookout */],
    /* [x, z, r, h]: Lantern Islet and the two rock stacks (terrain3d STRUCT.islet / stacks) */
    rocks: [[-8.0, -5.4, 0.7, 0.6], [7.15, 5.45, 0.26, 0.9], [7.72, 5.82, 0.2, 0.55]]
  };
  var DEG_PER_PX = { yaw: 0.25, elev: 0.2 };
  var STEP_EPS = 1e-4;

  /* ---------------- maths ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function wrapDeg(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return d; }
  /* frame-rate independent smoothing: the fraction to close this frame */
  function damp(dt, rate) { return dt <= 0 ? 0 : 1 - Math.pow(1 - clamp(rate, 0, 0.999999), dt * 60); }
  function inOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

  function grid() {
    var g = root && root.SLGrid3D;
    if (!g && typeof require === 'function') { try { g = require('./grid3d.js'); } catch (e) { g = null; } }
    return g || null;
  }
  function motion() {
    var m = root && root.SLMotion;
    if (!m && typeof require === 'function') { try { m = require('./motion.js'); } catch (e) { m = null; } }
    return m || null;
  }

  /* D = from target toward the camera, R = screen right, U = screen up (never rolls).
     Same vectors as SLGrid3D.basis, written into `out` without allocating. */
  function basisInto(yawDeg, elevDeg, out) {
    var y = yawDeg * DEG, e = elevDeg * DEG, sy = Math.sin(y), cy = Math.cos(y), se = Math.sin(e), ce = Math.cos(e);
    out.Dx = sy * ce; out.Dy = se; out.Dz = cy * ce;
    out.Rx = cy; out.Ry = 0; out.Rz = -sy;
    out.Ux = -sy * se; out.Uy = ce; out.Uz = -cy * se;
    return out;
  }

  /* land bounds for framing: the land squares + the sand skirt, items up to ITEM_MAX_H */
  function boundsOf(land) {
    var G = grid();
    if (!G) return { minX: -8.25, maxX: 8.25, minZ: -5.25, maxZ: 5.25, cx: 0, cz: 0, maxY: 0.45, top: 3.35, bottom: -0.12 };
    var b = G.landBounds(land == null ? ['home'] : land, G.SAND_REACH);
    return {
      minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, cx: b.cx, cz: b.cz, maxY: b.maxY,
      top: G.ITEM_MAX_H + b.maxY, bottom: G.SAND_Y
    };
  }
  /* the distance that keeps every bounds corner inside NDC ±(1 - margin) looking at the land
     centre (target y 0.3; a v3 sky island's b.ty: its top + 0.3) — the scalar twin of
     SLGrid3D.fitCamera, zero allocation */
  var _fb = {};
  function fitDist(b, yawDeg, elevDeg, aspect, fov, margin, near) {
    fov = fov || LIMITS.fov; aspect = aspect > 0 ? aspect : 16 / 9;
    margin = margin == null ? LIMITS.margin : margin; near = near || LIMITS.near;
    var B = basisInto(yawDeg, elevDeg, _fb), m = 1 - margin, tanH = Math.tan(fov * DEG / 2), ty = b.ty != null ? b.ty : TARGET_Y;
    var Fx = -B.Dx, Fy = -B.Dy, Fz = -B.Dz, dist = near;
    for (var i = 0; i < 8; i++) {
      var qx = (i & 1 ? b.maxX : b.minX) - b.cx, qy = (i & 2 ? b.top : b.bottom) - ty, qz = (i & 4 ? b.maxZ : b.minZ) - b.cz;
      var f = qx * Fx + qy * Fy + qz * Fz;
      var r = Math.abs(qx * B.Rx + qy * B.Ry + qz * B.Rz) / (m * tanH * aspect) - f;
      var u = Math.abs(qx * B.Ux + qy * B.Uy + qz * B.Uz) / (m * tanH) - f;
      if (r > dist) dist = r;
      if (u > dist) dist = u;
      if (near * 2 - f > dist) dist = near * 2 - f;
    }
    return dist;
  }
  /* the play framing's points for a land (built on setLand; allocates): the convex hull of the cell
     corners padded by FRAME.coast (y SAND_Y), the hull of the cell corners at the tallest item's top,
     the scenery extras of the unlocked regions and the rocks the land reaches. cls 0 = island (below
     the band), 1 = free (may rise into the band), 2 = rock (anywhere inside FRAME.edge).
     o {extras, rocks} replace FRAME.extras / FRAME.rocks (v3 Home: the five gate pads, no rocks).
     → {cx, cz (the target: SLGrid3D.fitCamera's land centre), n, x, y, z, cls} */
  function hull2(P) {
    P.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  function frameOf(land, o) {
    var G = grid(), b = boundsOf(land), pts = [], i, k;
    var extras = o && o.extras ? o.extras : FRAME.extras, rocks = o && o.rocks ? o.rocks : FRAME.rocks;
    function add(x, y, z, cls) { pts.push([x, y, z, cls]); }
    if (G && typeof G.landFrom === 'function' && typeof G.cellCenter === 'function') {
      var set = G.landFrom(land == null ? ['home'] : land), keys = Object.keys(set), seen = {}, corners = [], regions = {};
      var bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
      for (i = 0; i < keys.length; i++) {
        var p = G.parseKey(keys[i]), c = G.cellCenter(p.c, p.r);
        if (typeof G.regionOf === 'function') regions[G.regionOf(p.c, p.r)] = 1;
        for (k = 0; k < 4; k++) {
          var x = c.x + (k & 1 ? 0.5 : -0.5), z = c.z + (k & 2 ? 0.5 : -0.5), key = x + ',' + z;
          if (seen[key]) continue;
          seen[key] = 1; corners.push([x, z]);
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
        }
      }
      /* the coast: each corner padded by a circle (8 points circumscribing radius FRAME.coast) */
      var R = FRAME.coast / Math.cos(Math.PI / 8), pad = [];
      for (i = 0; i < corners.length; i++) for (k = 0; k < 8; k++) {
        var a = (k + 0.5) * Math.PI / 4;
        pad.push([corners[i][0] + R * Math.cos(a), corners[i][1] + R * Math.sin(a)]);
      }
      var H = hull2(pad), Hc = hull2(corners.slice());
      for (i = 0; i < H.length; i++) add(H[i][0], G.SAND_Y, H[i][1], 0);
      for (i = 0; i < Hc.length; i++) add(Hc[i][0], b.top, Hc[i][1], 0);
      extras.forEach(function (e) { if (regions[e[3]]) add(e[0], e[1], e[2], e[4] ? 1 : 0); });
      var near = FRAME.rockNear, sea = G.SEA_Y;
      rocks.forEach(function (r) {
        if (r[0] < bx0 - near || r[0] > bx1 + near || r[1] < bz0 - near || r[1] > bz1 + near) return;
        var rr = (r[2] + 0.2) / Math.cos(Math.PI / 8);
        for (var j = 0; j < 8; j++) { var aa = (j + 0.5) * Math.PI / 4; add(r[0] + rr * Math.cos(aa), sea, r[1] + rr * Math.sin(aa), 2); }
        add(r[0], sea + r[3], r[1], 2);
      });
    } else {
      /* no grid: the padded bounds box */
      [b.minX - FRAME.coast, b.maxX + FRAME.coast].forEach(function (x) {
        [b.minZ - FRAME.coast, b.maxZ + FRAME.coast].forEach(function (z) { add(x, b.bottom, z, 0); add(x, b.top, z, 0); });
      });
    }
    var n = pts.length, fr = { cx: b.cx, cz: b.cz, n: n, x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), cls: new Uint8Array(n) };
    for (i = 0; i < n; i++) { fr.x[i] = pts[i][0]; fr.y[i] = pts[i][1]; fr.z[i] = pts[i][2]; fr.cls[i] = pts[i][3]; }
    return fr;
  }
  /* the play fit for a frame (zero allocation). Sliding the target by δ along the ground away from the
     camera lowers every point on screen by w = δ·sin(elev); s is the land centre's depth. Each point
     must stay inside its window — x within ±m (rocks ±edge), y within [−m, m − 2·band] for the island
     (free points and rocks up to +edge). The slide is the middle of the vertical slack at the smallest
     s that fits (scaled by band / FRAME.band, so band 0 never slides: the plain, centred fit of the real
     island), and the depth is the smallest that fits with that slide. A v3 island frame carries its own
     target height (fr.ty: the island top + 0.3) and full band (fr.band: Home 0.18, sky islands 0.10).
     → out {depth: s, shift: δ, dist: s + δ·cos(elev) (the camera's distance from the slid target)} */
  var _ff = {}, _fA = [0, 0, 0], _fB = [0, 0, 0], _fHi = [0, 0, 0], _fLo = [0, 0, 0], _fHx = [0, 0, 0];
  function fitFrame(fr, yawDeg, elevDeg, aspect, band, out, fov, margin, near) {
    out = out || {};
    fov = fov || LIMITS.fov; aspect = aspect > 0 ? aspect : 16 / 9;
    margin = margin == null ? LIMITS.margin : margin; near = near || LIMITS.near;
    band = clamp(band || 0, 0, 0.4);
    var B = basisInto(yawDeg, elevDeg, _ff), t = Math.tan(fov * DEG / 2), m = 1 - margin, e = FRAME.edge;
    _fHi[0] = m - 2 * band; _fHi[1] = e; _fHi[2] = e;
    _fLo[0] = m; _fLo[1] = m; _fLo[2] = e;
    _fHx[0] = m; _fHx[1] = m; _fHx[2] = e;
    _fA[0] = _fA[1] = _fA[2] = _fB[0] = _fB[1] = _fB[2] = -Infinity;
    /* per class: A = max(u − hi·t·f) (the top edge), Bc = max(−u − lo·t·f) (the bottom edge) */
    var Fx = -B.Dx, Fy = -B.Dy, Fz = -B.Dz, sH = near, i, c, ca, cb, ty = fr.ty != null ? fr.ty : TARGET_Y;
    for (i = 0; i < fr.n; i++) {
      var qx = fr.x[i] - fr.cx, qy = fr.y[i] - ty, qz = fr.z[i] - fr.cz;
      var f = qx * Fx + qy * Fy + qz * Fz, r = qx * B.Rx + qy * B.Ry + qz * B.Rz, u = qx * B.Ux + qy * B.Uy + qz * B.Uz;
      c = fr.cls[i];
      var h = Math.abs(r) / (_fHx[c] * t * aspect) - f;
      if (h > sH) sH = h;
      if (near * 2 - f > sH) sH = near * 2 - f;
      var a = u - _fHi[c] * t * f, bb = -u - _fLo[c] * t * f;
      if (a > _fA[c]) _fA[c] = a;
      if (bb > _fB[c]) _fB[c] = bb;
    }
    /* the smallest depth with a free slide: every top edge against every bottom edge */
    var s = sH;
    for (ca = 0; ca < 3; ca++) for (cb = 0; cb < 3; cb++) {
      if (_fA[ca] === -Infinity || _fB[cb] === -Infinity) continue;
      var v = (_fA[ca] + _fB[cb]) / (t * (_fHi[ca] + _fLo[cb]));
      if (v > s) s = v;
    }
    /* the slide's range there (w ≥ A − hi·t·s, w ≤ lo·t·s − Bc), its middle, scaled by the band */
    var wLo = -Infinity, wHi = Infinity;
    for (c = 0; c < 3; c++) {
      if (_fA[c] !== -Infinity && _fA[c] - _fHi[c] * t * s > wLo) wLo = _fA[c] - _fHi[c] * t * s;
      if (_fB[c] !== -Infinity && _fLo[c] * t * s - _fB[c] < wHi) wHi = _fLo[c] * t * s - _fB[c];
    }
    var w = isFinite(wLo) && isFinite(wHi) ? (wLo + wHi) / 2 : 0, full = fr.band != null ? fr.band : FRAME.band;
    w *= full > 0 ? clamp01(band / full) : 0;
    /* the smallest depth for that slide */
    var d = sH;
    for (c = 0; c < 3; c++) {
      if (_fA[c] !== -Infinity && (_fA[c] - w) / (_fHi[c] * t) > d) d = (_fA[c] - w) / (_fHi[c] * t);
      if (_fB[c] !== -Infinity && (w + _fB[c]) / (_fLo[c] * t) > d) d = (w + _fB[c]) / (_fLo[c] * t);
    }
    var se = Math.sin(elevDeg * DEG), ce = Math.cos(elevDeg * DEG);
    out.depth = d;
    out.shift = w / Math.max(0.05, se);
    out.dist = d + out.shift * ce;
    return out;
  }
  /* how much of FRAME.band a play view keeps at a zoom (1 up to zoom 1, 0 from 1.3) */
  function bandAt(zoom) {
    var z = FRAME.bandZoom, u = clamp01((zoom - z[0]) / (z[1] - z[0]));
    return 1 - u * u * (3 - 2 * u);
  }
  /* world-space target change for a screen drag of (dx, dy) px: the content follows the finger */
  var _pb = {};
  function panDelta(dxPx, dyPx, viewH, dist, fov, yawDeg, elevDeg, out) {
    out = out || {};
    var k = 2 * dist * Math.tan((fov || LIMITS.fov) * DEG / 2) / Math.max(1, viewH || 1);
    var y = yawDeg * DEG, se = Math.max(0.35, Math.sin(elevDeg * DEG));
    var rx = Math.cos(y), rz = -Math.sin(y);           /* screen right on the ground */
    var fx = -Math.sin(y), fz = -Math.cos(y);          /* away from the camera on the ground */
    out.x = -rx * dxPx * k + fx * dyPx * k / se;
    out.z = -rz * dxPx * k + fz * dyPx * k / se;
    return out;
  }
  /* how far the target may leave the land centre: none beyond a little slack at zoom 1,
     the uncovered half-extent once zoomed in */
  function panLimit(b, zoom, slack, out) {
    out = out || {};
    var f = Math.max(0, 1 - 1 / Math.max(zoom, 1e-3)), s = slack == null ? LIMITS.panSlack : slack;
    out.x = (b.maxX - b.minX) / 2 * f + s;
    out.z = (b.maxZ - b.minZ) / 2 * f + s;
    return out;
  }
  function isPhone(touch, aspect) { return !!touch && aspect > 0 && aspect < 1; }
  function zoomMaxFor(touch, aspect) { return isPhone(touch, aspect) ? LIMITS.zoomPhone : LIMITS.zoomMax; }
  /* the zoom of the home view: a portrait phone's width-limited fit starts zoomed in */
  function homeZoomFor(touch, aspect) { return isPhone(touch, aspect) ? LIMITS.zoomHomePhone : 1; }
  /* extra target travel toward -z (the city side only) once zoomed in past 1.2 in play mode,
     ramping smoothly to the full 2.5 u so zooming back out glides home instead of snapping */
  function backPanFor(zoom, mode) {
    if (mode === 'edit' || mode === 'place') return 0;
    var u = clamp01((zoom - LIMITS.backPanFrom) / (LIMITS.backPanFull - LIMITS.backPanFrom));
    return LIMITS.backPan * u * u * (3 - 2 * u);
  }
  /* the Showtime orbit's elevation dip: up to 6° at the full ±8° sway, never below 40° (a view
     already lower than that keeps its elevation) */
  function orbitDip(orbitYaw, elev) {
    var d = LIMITS.orbitDip * Math.min(1, Math.abs(orbitYaw || 0) / LIMITS.orbitDeg);
    return Math.max(0, Math.min(d, elev - LIMITS.orbitDipFloor));
  }
  /* the skyline shot's zoom and target height for a view aspect (SKYLINE.wide) → out {zoom, ty} */
  function skylineFit(aspect, out) {
    out = out || {};
    var S = SKYLINE, w = S.wide, u = w ? clamp(((aspect > 0 ? aspect : 16 / 9) - w.from) / w.step, 0, w.max) : 0;
    out.zoom = S.zoom + (w ? w.zoom * u : 0);
    out.ty = S.ty + (w ? w.ty * u : 0);
    return out;
  }
  /* the top frustum edge's angle above the horizontal for a pose (the camera never rolls) */
  var _tr = {};
  function topRayDeg(pose) {
    var B = basisInto(pose.yaw, pose.elev, _tr), t = Math.tan((pose.fov || LIMITS.fov) * DEG / 2);
    var dx = -B.Dx + B.Ux * t, dy = -B.Dy + B.Uy * t, dz = -B.Dz + B.Uz * t;
    return Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) / DEG;
  }

  /* NDC of a world point for a pose {px, py, pz, yaw, elev, fov, aspect} (= THREE lookAt) */
  var _pj = {};
  function projectPose(p, pose, out) {
    out = out || {};
    var B = basisInto(pose.yaw, pose.elev, _pj), tanH = Math.tan(pose.fov * DEG / 2);
    var vx = p.x - pose.px, vy = p.y - pose.py, vz = p.z - pose.pz;
    var depth = -(vx * B.Dx + vy * B.Dy + vz * B.Dz);
    out.depth = depth;
    out.x = (vx * B.Rx + vy * B.Ry + vz * B.Rz) / (depth * tanH * pose.aspect);
    out.y = (vx * B.Ux + vy * B.Uy + vz * B.Uz) / (depth * tanH);
    return out;
  }
  /* where the ray through NDC (nx, ny) meets the plane at height y (null above the horizon) */
  var _gb = {};
  function groundAt(pose, nx, ny, y, out) {
    var B = basisInto(pose.yaw, pose.elev, _gb), tanH = Math.tan(pose.fov * DEG / 2);
    var dx = -B.Dx + B.Rx * nx * tanH * pose.aspect + B.Ux * ny * tanH;
    var dy = -B.Dy + B.Ry * nx * tanH * pose.aspect + B.Uy * ny * tanH;
    var dz = -B.Dz + B.Rz * nx * tanH * pose.aspect + B.Uz * ny * tanH;
    if (dy > -1e-6) return null;
    var t = ((y || 0) - pose.py) / dy;
    if (!(t > 0)) return null;
    out = out || {};
    out.x = pose.px + dx * t; out.y = y || 0; out.z = pose.pz + dz * t;
    return out;
  }

  /* ================================================================
     V3 — My Island v3 (Pixel Blocks + the five sky islands): the pure framing behind Rig(o)
     profile 'v3'. Islands are axis-aligned at SLGrid3D.ISLE_LAYOUT (render-only, never saved).
     ================================================================ */
  /* the v3 constants (contracts.camera; the lab may tune them before it makes a rig). Home's view is
     the v2 play framing at ELEV_DEFAULT with the five gate pads (y PAD_Y) as its free extras and no
     rocks. A sky island's frame: its land cells padded by the beach + its rim (slab M 1.75, treetop
     lip 0.9) at the water, its item tops (≤ 5.5 u), the dock and the first BRIDGE_U of its bridge up
     to BRIDGE_H over the deck; its band is BAND_SKY. The portrait-phone visit zoom is
     VISIT_ZOOM_PHONE up to VISIT_WIDE_COLS columns and VISIT_ZOOM_PHONE_WIDE for a wider island (the
     16 × 10 pier, like Home: D90). The Sky map boxes reach from the slab bottom to the item tops
     (rim + its ±0.25 wobble, Home's boat lobe) plus each cake's tip under its centre. */
  var V3 = {
    ELEV_DEFAULT: 44, ELEV_LAB: [40, 48], FAR: 240,
    BAND_HOME: 0.18, BAND_ZOOM: [1, 1.3], BAND_SKY: 0.10, YAW: 35,
    VISIT_ZOOM_PHONE: 1.5, VISIT_ZOOM_PHONE_WIDE: 1.75, VISIT_WIDE_COLS: 12, HOME_ZOOM_PHONE: 1.75,
    TOUR: { yaw0: -8, holdSec: 0.9, flySec: 2.2 },
    FLIGHT: { baseSec: 1.2, perU: 0.045, maxSec: 2.4, pullBack: 0.35, riseDeg: 8, skipSec: 0.35 },
    DIP: { inSec: 0.3, outSec: 0.3 },
    SKYMAP: { elev: 56, elevPhone: 62, margin: 0.08 },
    ROCKS: [], PAD_Y: 0.8, BEACH: 0.3, WOBBLE: 0.25, BRIDGE_U: 1.5, BRIDGE_H: 1,
    TIP: { home: 5.75, land: 5.25 }, BOAT: [8.6, 4.4, 2.2]
  };
  var SKY_ISLES = ['pier', 'jungle', 'treetop', 'castle', 'ice'], ISLE_IDS = ['home'].concat(SKY_ISLES);

  function core() {
    var c = root && root.SLWorldCore;
    if (!c && typeof require === 'function') { try { c = require('../world-core.js'); } catch (e) { c = null; } }
    return c || null;
  }
  function v3Frame(isle) {
    var G = grid();
    return G && G.V3 && typeof G.V3.frame === 'function' && G.ISLE_LAYOUT && G.ISLE_LAYOUT[isle] ? G.V3.frame(isle) : null;
  }
  /* Home's free extras: the five bridge gate pads on its rim */
  function v3Extras() {
    var G = grid(), g = G && G.ISLE_LAYOUT && G.ISLE_LAYOUT.home ? G.ISLE_LAYOUT.home.gates : null, out = [];
    if (g) SKY_ISLES.forEach(function (k) { if (g[k]) out.push([g[k][0], V3.PAD_Y, g[k][2], 'home', 1]); });
    return out;
  }
  /* an island's land cells as 'c,r' keys: o.land (keys or a {key: 1} set), else the rule table */
  function landKeys(isle, land, F) {
    if (Array.isArray(land)) return land.filter(function (k) { return typeof k === 'string' && /^\d+,\d+$/.test(k); });
    if (land && typeof land === 'object') return Object.keys(land);
    var C = core(), list = C && C.ISLE_CELLS && C.ISLE_CELLS[isle];
    if (Array.isArray(list) && list.length) return list.slice();
    var all = [];
    for (var r = 0; r < F.rows; r++) for (var c = 0; c < F.cols; c++) all.push(c + ',' + r);
    return all;
  }
  /* isleFrame(isle, placedTops, o) → the play framing of one island (allocates; cached for a sky island
     framed at its full item height). Home: frameOf(o.land) with the gate pads and no rocks, exactly the
     v2 framing otherwise (placedTops is ignored: Home always frames 2.9 u items). A sky island:
     placedTops = a number (the tallest item there) or {'c,r': h} (each cell's item height; cells left
     out frame only their ground), capped at ISLAND_ITEM_MAX_H; null frames every cell at 5.5 u (the
     stable default). The frame also carries what the rig needs: {isle, tx, ty, tz (the island's home
     target, ty = its top + 0.3), yaw (its lead yaw), elev, band, cols, rows, top, b (bounds for the
     pan clamp and the phones' plain fit)}. */
  var FRAMES = Object.create(null);
  function isleFrame(isle, placedTops, o) {
    o = o || {};
    var G = grid(), F = isle && isle !== 'home' ? v3Frame(isle) : null, i, k;
    if (!F) {
      var land = o.land == null ? ['home'] : o.land, hf = frameOf(land, { extras: v3Extras(), rocks: V3.ROCKS });
      hf.isle = 'home'; hf.ty = TARGET_Y; hf.band = V3.BAND_HOME; hf.yaw = 0; hf.elev = V3.ELEV_DEFAULT;
      hf.cols = G ? G.COLS : 16; hf.rows = G ? G.ROWS : 10; hf.top = 0; hf.b = boundsOf(land); hf.tx = hf.cx; hf.tz = hf.cz;
      return hf;
    }
    var cache = placedTops == null && o.land == null;
    if (cache && FRAMES[isle]) return FRAMES[isle];
    var lay = G.ISLE_LAYOUT[isle], keys = landKeys(isle, o.land, F), x0 = F.offset[0], z0 = F.offset[1], top = F.top;
    var pts = [], corners = [], seen = {}, perCell = placedTops && typeof placedTops === 'object' ? placedTops : null;
    var hAll = typeof placedTops === 'number' && isFinite(placedTops) ? clamp(placedTops, 0, F.itemMaxH) : F.itemMaxH;
    /* every item but the landmark stands ≤ 2.9 u (D48): those tops stay under the band like Home's;
       anything taller (the landmark, up to 5.5 u) is a free point that may rise into the sky band */
    var hLow = G.ITEM_MAX_H;
    function add(x, y, z, cls) { pts.push(x, y, z, cls || 0); }
    function addTop(x, z, h) { add(x, top + Math.min(h, hLow), z, 0); if (h > hLow) add(x, top + h, z, 1); }
    function cellCorners(c, r, list) {
      for (var q = 0; q < 4; q++) {
        var x = x0 + c + (q & 1), z = z0 + r + (q >> 1), key = x + ',' + z;
        if (list === corners) { if (seen[key]) continue; seen[key] = 1; }
        list.push([x, z]);
      }
    }
    keys.forEach(function (key) { var p = key.split(','); cellCorners(+p[0], +p[1], corners); });
    /* the rim: each corner padded by a circle (8 points circumscribing the beach, the coast's wobble and
       the slab / lip), from the water down to the slab's bottom edge (the treetop's lip: 1 u), so the
       island is seen floating whole */
    var R = (V3.BEACH + V3.WOBBLE + F.pad) / Math.cos(Math.PI / 8), pad = [], yLow = F.slab ? top + G.V3.SLAB_B : top - 1;
    for (i = 0; i < corners.length; i++) for (k = 0; k < 8; k++) {
      var a = (k + 0.5) * Math.PI / 4;
      pad.push([corners[i][0] + R * Math.cos(a), corners[i][1] + R * Math.sin(a)]);
    }
    var H = hull2(pad), Hc = hull2(corners.slice()), yTop = top;
    for (i = 0; i < H.length; i++) { add(H[i][0], top + G.V3.SEA_Y, H[i][1]); add(H[i][0], yLow, H[i][1]); }
    for (i = 0; i < Hc.length; i++) add(Hc[i][0], top, Hc[i][1]);
    if (perCell) {
      var inLand = {};
      keys.forEach(function (key) { inLand[key] = 1; });
      Object.keys(perCell).forEach(function (key) {
        var h = +perCell[key];
        if (!inLand[key] || !(h > 0)) return;
        h = Math.min(h, F.itemMaxH);
        var p = key.split(','), cs = [];
        cellCorners(+p[0], +p[1], cs);
        cs.forEach(function (q) { addTop(q[0], q[1], h); });
        if (top + h > yTop) yTop = top + h;
      });
    } else if (hAll > 0) {
      for (i = 0; i < Hc.length; i++) addTop(Hc[i][0], Hc[i][1], hAll);
      yTop = top + hAll;
    }
    /* the dock and the first BRIDGE_U of the bridge (rails and lamp posts up to BRIDGE_H) */
    var br = G.V3.bridge(isle);
    if (br && br.length > 0) {
      var ux = (br.a.x - br.b.x) / br.length, uz = (br.a.z - br.b.z) / br.length, hw = br.width / 2 + 0.25;
      [0, V3.BRIDGE_U].forEach(function (s) {
        var px = br.b.x + ux * s, pz = br.b.z + uz * s, py = br.b.y + (br.a.y - br.b.y) * s / br.length;
        [-1, 1].forEach(function (side) {
          add(px - uz * hw * side, py, pz + ux * hw * side);
          add(px - uz * hw * side, py + V3.BRIDGE_H, pz + ux * hw * side);
        });
      });
    }
    var lb = F.landBounds(keys, G.SAND_REACH), n = pts.length / 4;
    var fr = { isle: isle, cx: lb.cx, cz: lb.cz, tx: lb.cx, tz: lb.cz, ty: top + TARGET_Y, band: V3.BAND_SKY,
      yaw: lay.visitPose.yaw, elev: lay.visitPose.elev, cols: F.cols, rows: F.rows, top: top,
      b: { minX: lb.minX, maxX: lb.maxX, minZ: lb.minZ, maxZ: lb.maxZ, cx: lb.cx, cz: lb.cz, maxY: lb.maxY, top: Math.max(yTop, top),
           bottom: top + G.SAND_Y, ty: top + TARGET_Y },
      n: n, x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), cls: new Uint8Array(n) };
    for (i = 0; i < n; i++) { fr.x[i] = pts[4 * i]; fr.y[i] = pts[4 * i + 1]; fr.z[i] = pts[4 * i + 2]; fr.cls[i] = pts[4 * i + 3]; }
    if (cache) FRAMES[isle] = fr;
    return fr;
  }
  /* the portrait-phone zoom of an island's home view (Home and the 16-column pier 1.75, the others 1.5) */
  function visitZoomFor(cols, touch, aspect) {
    if (!isPhone(touch, aspect)) return 1;
    return cols > V3.VISIT_WIDE_COLS ? V3.VISIT_ZOOM_PHONE_WIDE : V3.VISIT_ZOOM_PHONE;
  }
  /* visitPose(isle, aspect, touch, out) → {tx, ty, tz, yaw, elev, zoom}: an island's home view (the
     target before the play framing's slide; ISLE_LAYOUT visitPose yaw / elev; yaw limits ±35 round it) */
  function visitPose(isle, aspect, touch, out) {
    out = out || {};
    var fr = isleFrame(isle);
    out.tx = fr.tx; out.ty = fr.ty; out.tz = fr.tz; out.yaw = fr.yaw; out.elev = fr.elev;
    out.zoom = visitZoomFor(fr.cols, touch, aspect > 0 ? aspect : 16 / 9);
    return out;
  }
  /* an island's box for the Sky map: its slab (rim + wobble; Home's boat lobe) from the slab bottom to
     its tallest items, and the tip of its cake under the centre → {isle, x0, x1, z0, z1, y0, y1, tip,
     cx, cz} (cached) */
  var BOXES = Object.create(null);
  function skyBox(isle) {
    if (BOXES[isle]) return BOXES[isle];
    var G = grid(), F = v3Frame(isle);
    if (!F) return null;
    var home = isle === 'home', p = V3.BEACH + V3.WOBBLE + F.pad, b = F.bounds;
    var B = { isle: isle, x0: b.x0 - p, x1: b.x1 + p, z0: b.z0 - p, z1: b.z1 + p, y0: F.top + G.V3.SLAB_B,
      y1: b.yTop + F.itemMaxH, tip: F.top - (home ? V3.TIP.home : V3.TIP.land), cx: F.cx, cz: F.cz };
    if (home) {
      var L = V3.BOAT;
      B.x0 = Math.min(B.x0, L[0] - L[2]); B.x1 = Math.max(B.x1, L[0] + L[2]);
      B.z0 = Math.min(B.z0, L[1] - L[2]); B.z1 = Math.max(B.z1, L[1] + L[2]);
    }
    return (BOXES[isle] = B);
  }
  /* every Sky map point: the six boxes' corners and tips (cached) */
  var WORLD = null;
  function worldPoints() {
    if (WORLD) return WORLD;
    var list = [], x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    ISLE_IDS.forEach(function (k) {
      var B = skyBox(k);
      if (!B) return;
      for (var i = 0; i < 8; i++) list.push([i & 1 ? B.x1 : B.x0, i & 2 ? B.y1 : B.y0, i & 4 ? B.z1 : B.z0]);
      list.push([B.cx, B.tip, B.cz]);
      x0 = Math.min(x0, B.x0); x1 = Math.max(x1, B.x1); z0 = Math.min(z0, B.z0); z1 = Math.max(z1, B.z1);
    });
    if (!list.length) {
      var hb = boundsOf(['home']);
      [hb.minX, hb.maxX].forEach(function (x) { [hb.minZ, hb.maxZ].forEach(function (z) { list.push([x, hb.bottom, z], [x, hb.top, z]); }); });
      x0 = hb.minX; x1 = hb.maxX; z0 = hb.minZ; z1 = hb.maxZ;
    }
    var n = list.length, W = { n: n, x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), x0: x0, x1: x1, z0: z0, z1: z1 };
    for (var j = 0; j < n; j++) { W.x[j] = list[j][0]; W.y[j] = list[j][1]; W.z[j] = list[j][2]; }
    return (WORLD = W);
  }
  /* skyMapFit(aspect, touch, out, {yaw}?) → {tx, ty, tz, yaw, elev, dist, zoom: 1}: the pose that
     shows all six islands (elev 56, portrait phones 62; no sky band), every Sky map point inside NDC
     ±(1 − SKYMAP.margin). The target starts at the centre of the world box (y 0.3) and slides along
     the ground until the projected points sit centred on screen, so no side wastes the frame. */
  var _sk = {};
  function skyMapFit(aspect, touch, out, o) {
    out = out || {};
    aspect = aspect > 0 ? aspect : 16 / 9;
    var W = worldPoints(), S = V3.SKYMAP, elev = isPhone(touch, aspect) ? S.elevPhone : S.elev;
    var yaw = o && isFinite(o.yaw) ? o.yaw : 0, t = Math.tan(LIMITS.fov * DEG / 2), m = 1 - S.margin, near = LIMITS.near;
    var B = basisInto(yaw, elev, _sk), se = Math.max(0.2, Math.sin(elev * DEG)), fx = -Math.sin(yaw * DEG), fz = -Math.cos(yaw * DEG);
    var tx = (W.x0 + W.x1) / 2, ty = TARGET_Y, tz = (W.z0 + W.z1) / 2, d = near, i, it;
    for (it = 0; it < 24; it++) {
      d = near;
      for (i = 0; i < W.n; i++) {
        var qx = W.x[i] - tx, qy = W.y[i] - ty, qz = W.z[i] - tz;
        var f = -(qx * B.Dx + qy * B.Dy + qz * B.Dz), r = qx * B.Rx + qy * B.Ry + qz * B.Rz, u = qx * B.Ux + qy * B.Uy + qz * B.Uz;
        d = Math.max(d, Math.abs(r) / (m * t * aspect) - f, Math.abs(u) / (m * t) - f, near * 2 - f);
      }
      var nx0 = Infinity, nx1 = -Infinity, ny0 = Infinity, ny1 = -Infinity;
      for (i = 0; i < W.n; i++) {
        var px = W.x[i] - tx, py = W.y[i] - ty, pz = W.z[i] - tz, dep = d - (px * B.Dx + py * B.Dy + pz * B.Dz);
        var sx = (px * B.Rx + py * B.Ry + pz * B.Rz) / (dep * t * aspect), sy = (px * B.Ux + py * B.Uy + pz * B.Uz) / (dep * t);
        if (sx < nx0) nx0 = sx; if (sx > nx1) nx1 = sx; if (sy < ny0) ny0 = sy; if (sy > ny1) ny1 = sy;
      }
      var cx = (nx0 + nx1) / 2, cy = (ny0 + ny1) / 2;
      if (Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4) break;
      /* screen right along R on the ground; screen up by sliding along the ground away from the camera */
      var ws = cx * d * t * aspect * 0.8, wu = cy * d * t / se * 0.8;
      tx += B.Rx * ws + fx * wu; tz += B.Rz * ws + fz * wu;
    }
    out.tx = tx; out.ty = ty; out.tz = tz; out.yaw = yaw; out.elev = elev; out.dist = d; out.zoom = 1;
    return out;
  }
  /* THE FACE-CULLING GUARD. The voxel engine drops the '-z' (back) and '-y' (under) faces the island
     camera can never see (cullFor, D73), so in v3 no ray of the frame may look back toward +z or up.
     The islands are axis-aligned, so this is a rule on the ABSOLUTE yaw: a ray's z is cos(yaw)·(cos e −
     sin e·t) − |sin yaw|·t·aspect at a lower frame corner (t = tan(fov / 2)), which must stay ≤ −CULL_EPS.
     elevCapFor(yaw, aspect) → the steepest elevation that holds it (75° − ε at yaw 0; at the ±35° edge
     ≈ 66° on a 2:3 phone, 55° at 16:9, 52° at 2.1:1); yawCapFor(aspect, elev) → the widest yaw that
     holds it at that elevation (the play floor 34°: ≈ 73° on a phone, 53° at 16:9, 48° at 2.1:1). */
  V3.CULL_EPS = 0.01;
  function elevCapFor(yawDeg, aspect, fov) {
    var h = (fov || LIMITS.fov) * DEG / 2, t = Math.tan(h), cy = Math.cos(yawDeg * DEG), sy = Math.abs(Math.sin(yawDeg * DEG));
    if (cy <= 1e-6) return 0;
    var k = (sy * t * (aspect > 0 ? aspect : 16 / 9) + V3.CULL_EPS) * Math.cos(h) / cy;
    return k >= 1 ? 0 : (Math.acos(k) - h) / DEG;
  }
  function yawCapFor(aspect, elevDeg, fov) {
    var t = Math.tan((fov || LIMITS.fov) * DEG / 2), e = elevDeg * DEG, c = Math.cos(e) - Math.sin(e) * t, ta = t * (aspect > 0 ? aspect : 16 / 9);
    if (c <= 0) return 0;
    var r = Math.sqrt(c * c + ta * ta);
    return Math.max(0, (Math.acos(Math.min(1, V3.CULL_EPS / r)) - Math.atan2(ta, c)) / DEG);
  }
  /* T = min(2.4 s, 1.2 s + 0.045 s per u of target travel) (D44) */
  function flightSec(travelU) {
    var F = V3.FLIGHT;
    return Math.min(F.maxSec, F.baseSec + F.perU * Math.max(0, +travelU || 0));
  }
  /* flightPose(A, B, u, out, o?) → the pose u (0..1 of the flight time) along a flight between two
     poses {tx, ty, tz, yaw, elev, zoom, dist?}: s = inOutSine(u); target = lerp(A, B, s) in 3D; zoom =
     lerp(zA, zB, s) × (1 − pullBack · sin πs); elevation = lerp + riseDeg · sin πs; yaw along the shorter
     arc. With both dists, dist = lerp(dA·zA, dB·zB, s) / zoom: each end's own fit (its frame and band)
     blends into the other's. o {pullBack, riseDeg} (default FLIGHT; a Sky map end uses 0 / 0: the map
     is already the pulled-back view). u ≥ 1 is exactly B. */
  function flightPose(A, B, u, out, o) {
    out = out || {};
    u = clamp01(u);
    var pb = o && o.pullBack != null ? o.pullBack : V3.FLIGHT.pullBack, rise = o && o.riseDeg != null ? o.riseDeg : V3.FLIGHT.riseDeg;
    if (u >= 1) {
      out.tx = B.tx; out.ty = B.ty; out.tz = B.tz; out.yaw = B.yaw; out.elev = B.elev; out.zoom = B.zoom;
      if (A.dist > 0 && B.dist > 0) out.dist = B.dist;
      return out;
    }
    var s = inOutSine(u), arc = Math.sin(Math.PI * s);
    out.tx = lerp(A.tx, B.tx, s); out.ty = lerp(A.ty, B.ty, s); out.tz = lerp(A.tz, B.tz, s);
    out.yaw = A.yaw + wrapDeg(B.yaw - A.yaw) * s;
    out.elev = lerp(A.elev, B.elev, s) + rise * arc;
    out.zoom = lerp(A.zoom, B.zoom, s) * (1 - pb * arc);
    if (A.dist > 0 && B.dist > 0) out.dist = lerp(A.dist * A.zoom, B.dist * B.zoom, s) / out.zoom;
    return out;
  }

  /* ================================================================
     RIG
     ================================================================ */
  function editing(m) { return m === 'edit' || m === 'place'; }
  function view() { return { tx: 0, tz: 0, yaw: 0, elev: LIMITS.elevDefault, zoom: 1 }; }
  function copyView(a, b) { a.tx = b.tx; a.tz = b.tz; a.yaw = b.yaw; a.elev = b.elev; a.zoom = b.zoom; return a; }
  function P() { return typeof Promise === 'function' ? Promise : null; }

  function resolved(v) { return P() ? P().resolve(v) : null; }

  function Rig(o) {
    o = o || {};
    this.G = o.grid || grid();
    this.M = o.motion || motion();
    this.lim = {};
    for (var k in LIMITS) this.lim[k] = LIMITS[k];
    /* profile 'v3': the sky world (island frames, visits, the Sky map, flights, the Sky tour, the dip) */
    this.profile = o.profile === 'v3' ? 'v3' : 'v2';
    this.v3 = this.profile === 'v3';
    if (this.v3) {
      this.lim.elevDefault = clamp(o.elevDefault > 0 ? o.elevDefault : V3.ELEV_DEFAULT, V3.ELEV_LAB[0], V3.ELEV_LAB[1]);
      this.lim.far = V3.FAR;
    }
    this.isle = 'home';          /* the island the user view belongs to */
    this.isf = null;             /* its frame (isleFrame); homeFr = Home's, kept while visiting */
    this.homeFr = null;
    this.tyBase = TARGET_Y;      /* the target height: the visited island's top + 0.3 */
    this.yawC = 0;               /* the yaw the ±35° limits centre on (the island's lead yaw) */
    this.trip = null;            /* a flight, the Sky tour, a Sky map move or a sky dip (v3) */
    this.mapOn = false;          /* the Sky map pose is held */
    this.dipFn = null;
    this._tA = {}; this._tB = {}; this._tP = {}; this._mf = {}; this._mfKey = '';
    this.reduced = !!o.reduced;
    this.touch = !!o.touch;
    this.aspect = o.aspect > 0 ? o.aspect : 16 / 9;
    this.viewW = o.width || 0; this.viewH = o.height || 0;
    this.mode = 'play';
    this.b = null;
    this.cur = view(); this.goal = view(); this.home = view(); this.saved = null;
    this.vel = { yaw: 0, elev: 0, tx: 0, tz: 0 };
    this.move = null;
    this.orbitOn = false; this.orbitT = 0; this.orbitYaw = 0;
    this.shakeAmp = 0; this.shakeDur = 0; this.shakeT = 0;
    this.frozen = 0;           /* > 0: a finger is down, a skippable move holds still (s left) */
    this.fr = null;            /* the play framing's points (frameOf) */
    this.bandK = 1;            /* the skyline band's share: 1 in play, eases to 0 in edit / place */
    this._fit = {}; this._fd = {}; this._fd2 = {}; this._sb = {}; this._zp = {}; this._zn = {}; this._zf = {};
    this.t = 0;
    this.pose = { px: 0, py: 0, pz: 0, tx: 0, ty: TARGET_Y, tz: 0, yaw: 0, elev: this.lim.elevDefault, zoom: 1, dist: 10,
      fov: LIMITS.fov, aspect: this.aspect, near: LIMITS.near, far: this.lim.far };
    this.version = 0;
    this.moving = false;
    this._last = { px: NaN, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 0, aspect: 0 };
    this._camAspect = 0; this._camFov = 0;
    this._pd = {}; this._mk = {}; this._kv = {}; this._snapT = 0;
    this.setLand(o.land == null ? ['home'] : o.land, { instant: true });
  }
  var R = Rig.prototype;

  R.zoomMax = function () { return zoomMaxFor(this.touch, this.aspect); };
  R.homeZoom = function () {
    if (this.v3 && this.isf) return visitZoomFor(this.isf.cols, this.touch, this.aspect);
    return homeZoomFor(this.touch, this.aspect);
  };
  R.phone = function () { return isPhone(this.touch, this.aspect); };
  R.zoomedIn = function () { return this.goal.zoom > 1.05; };
  R.canOrbit = function () { return !editing(this.mode); };

  /* the framing everything is relative to (v3: Home's unlocked regions; re-frames Home when it is
     the island being visited, else keeps Home's new frame for the flight back) */
  R.setLand = function (land, o) {
    o = o || {};
    if (this.v3) {
      this.homeFr = isleFrame('home', null, { land: land });
      if (this.isle === 'home') this._useFrame(this.homeFr, o);
      return this;
    }
    var b = boundsOf(land), G = this.G;
    var fit = G && typeof G.fitCamera === 'function' ? G.fitCamera({ land: land, aspect: this.aspect, fov: this.lim.fov, yaw: 0, elev: this.lim.elevDefault }) : null;
    this.b = b;
    this.fr = frameOf(land);
    this.home.tx = fit ? fit.target.x : b.cx; this.home.tz = fit ? fit.target.z : b.cz;
    this.home.yaw = 0; this.home.elev = this.lim.elevDefault; this.home.zoom = this.homeZoom();
    if (o.instant || !this._landSet) {
      if (!this._landSet) { copyView(this.goal, this.home); copyView(this.cur, this.home); }
      else { this.goal.tx = this.home.tx; this.goal.tz = this.home.tz; this.cur.tx = this.goal.tx; this.cur.tz = this.goal.tz; }
    } else {
      /* a smooth reframe onto the bigger island (land unlock) */
      this.goal.tx = this.home.tx; this.goal.tz = this.home.tz;
    }
    this._landSet = true;
    this.clampGoal();
    return this;
  };
  /* v3: frame an island. The same island re-frames like a land unlock (o.instant snaps the target,
     else it eases); another island (or the first frame) puts its home view in place at once — the
     edit tilt stays on, and leaving edit there restores that island's home view. */
  R._useFrame = function (F, o) {
    o = o || {};
    var same = this._landSet && this.isf && this.isf.isle === F.isle, h = this.home, g = this.goal;
    this.isf = F; this.fr = F; this.b = F.b; this.isle = F.isle;
    if (F.isle === 'home') this.homeFr = F;
    this.tyBase = F.ty; this.yawC = F.yaw || 0;
    h.tx = F.tx; h.tz = F.tz; h.yaw = this.yawC; h.elev = this.lim.elevDefault; h.zoom = this.homeZoom();
    if (!same) { this._landSet = true; return this._goHome(); }
    g.tx = h.tx; g.tz = h.tz;
    this.clampGoal();
    if (o.instant) { this.cur.tx = g.tx; this.cur.tz = g.tz; }
    return this;
  };
  /* rig.setIsle(frame | isle, {smooth}): make an island the visited one (an isle id uses isleFrame with
     Home's current land). Another island is a cut unless o.smooth (the view then eases across);
     travel between islands is rig.fly. */
  R.setIsle = function (frame, o) {
    if (!this.v3) return this;
    o = o || {};
    var F = typeof frame === 'string' ? (frame === 'home' ? this.homeFr || isleFrame('home') : isleFrame(frame)) : frame;
    if (!F || !F.isle) return this;
    var other = this.isf && this.isf.isle !== F.isle;
    if (other && o.smooth) {
      var c = {}; copyView(c, this.cur);
      this._useFrame(F, {});
      copyView(this.cur, c);
      this._snapT = this.lim.snapSec;
      return this;
    }
    return this._useFrame(F, { instant: !o.smooth });
  };
  /* the device turned into (or out of) a portrait phone: the home zoom follows, and a view
     nobody has moved yet goes along with it (at once while nothing has been shown) */
  R._rehome = function () {
    var z = this.homeZoom(), old = this.home.zoom;
    if (z === old) return;
    this.home.zoom = z;
    var g = this.goal, c = this.cur, untouched = Math.abs(g.zoom - old) < 1e-6 && Math.abs(g.yaw - this.home.yaw) < 1e-6 &&
      Math.abs(g.tx - this.home.tx) < 1e-6 && Math.abs(g.tz - this.home.tz) < 1e-6;
    if (this.saved && Math.abs(this.saved.zoom - old) < 1e-6) this.saved.zoom = z;
    if (!untouched) return;
    g.zoom = z;
    if (this.version === 0 || Math.abs(c.zoom - old) < 1e-6) c.zoom = z;
  };
  R.resize = function (w, h) {
    if (!(w > 0 && h > 0)) return this;
    this.viewW = w; this.viewH = h;
    this.aspect = w / h;
    this._rehome();
    this.clampGoal();
    return this;
  };
  R.setTouch = function (on) { this.touch = !!on; this._rehome(); this.clampGoal(); return this; };
  R.setReduced = function (on) {
    this.reduced = !!on;
    if (this.reduced) {
      this.vel.yaw = this.vel.elev = this.vel.tx = this.vel.tz = 0;
      this.shakeAmp = 0; this.orbitYaw = 0;
      copyView(this.cur, this.goal);
      if (this.move && this.move.skippable) this._endMove(true);     /* the hero shot is skipped outright */
      /* a flight or the tour lands at once (a sky dip already is reduced-motion safe) */
      if (this.trip && !this.trip.dip) this._arrive(this.trip);
    }
    return this;
  };

  /* yaw ±35° round the island's lead yaw (v2 and Home: 0); v3 pans each island inside its own frame,
     and only Home keeps the zoomed-in glide toward its back */
  R.clampGoal = function () {
    var g = this.goal, l = this.lim, b = this.b;
    if (editing(this.mode)) g.yaw = 0;
    else g.yaw = clamp(g.yaw, this.yawC - l.yaw, this.yawC + l.yaw);
    g.elev = clamp(g.elev, editing(this.mode) ? l.elevMinEdit : l.elevMin, l.elevMax);
    /* v3: the face-culling guard (an orbit far round tilts the view down a little; never below the floor) */
    if (this.v3) {
      var ym = yawCapFor(this.aspect, l.elevMin, l.fov);
      g.yaw = clamp(g.yaw, -ym, ym);
      g.elev = Math.max(l.elevMin, Math.min(g.elev, elevCapFor(g.yaw, this.aspect, l.fov)));
    }
    g.zoom = clamp(g.zoom, l.zoomMin, this.zoomMax());
    if (b) {
      var pl = panLimit(b, g.zoom, l.panSlack, this._pd), back = this.v3 && this.isle !== 'home' ? 0 : backPanFor(g.zoom, this.mode);
      g.tx = clamp(g.tx, this.home.tx - pl.x, this.home.tx + pl.x);
      g.tz = clamp(g.tz, this.home.tz - pl.z - back, this.home.tz + pl.z);
    }
    if (this.reduced) copyView(this.cur, g);
    return this;
  };
  R._stopFling = function () { var v = this.vel; v.yaw = v.elev = v.tx = v.tz = 0; };

  /* ---------------- user input ----------------
     Any camera input from the child hands a running hero shot back to them. v3: during a flight or
     the Sky tour a camera gesture skips to the arrival and is otherwise ignored; the Sky map takes
     taps only (no orbit, pan or zoom). */
  R._input = function () { this.frozen = 0; this.interrupt(); this._stopFling(); };
  R._travelGate = function () {
    if (!this.v3 || !(this.trip || this.mapOn)) return false;
    this.skip();
    this._stopFling();
    return true;
  };
  R.orbitBy = function (dYaw, dElev) {
    if (!this.canOrbit()) return this;
    if (this._travelGate()) return this;
    this._input();
    this.goal.yaw += dYaw || 0; this.goal.elev += dElev || 0;
    return this.clampGoal();
  };
  R.panBy = function (dxPx, dyPx) {
    if (this._travelGate()) return this;
    this._input();
    var d = panDelta(dxPx, dyPx, this.viewH || 600, this.pose.dist, this.lim.fov, this.pose.yaw, this.pose.elev, this._pd);
    this.goal.tx += d.x; this.goal.tz += d.z;
    return this.clampGoal();
  };
  /* zoom by a factor; with a focus point (under the cursor / pinch centre, at the target height
     y 0.3) the target slides toward it so that point stays put on screen (exact while the pan
     clamp allows). → true when anything changed */
  R.zoomBy = function (f, focus) {
    var g = this.goal, z0 = g.zoom, z1 = clamp(z0 * (f > 0 ? f : 1), this.lim.zoomMin, this.zoomMax());
    if (Math.abs(z1 - z0) < 1e-6) return false;
    if (this._travelGate()) return false;
    this._input();
    if (focus && isFinite(focus.x) && isFinite(focus.z)) {
      /* where the point sits in the still view now, then the target moves so it sits there again (the
         play framing's band and slide change with the zoom, so this is solved, not scaled) */
      var fp = this._zf, fy = isFinite(focus.y) ? focus.y : this.tyBase;
      fp.x = focus.x; fp.y = fy; fp.z = focus.z;
      var n = projectPose(fp, this._staticPose(g, this._zp), this._zn), nx = n.x, ny = n.y;
      g.zoom = z1;
      var at = n.depth > 0 ? groundAt(this._staticPose(g, this._zp), nx, ny, fy, this._zn) : null;
      if (at) { g.tx += focus.x - at.x; g.tz += focus.z - at.z; }
    }
    g.zoom = z1;
    this.clampGoal();
    return true;
  };
  /* inertia after a flick (px/s on screen) */
  R.fling = function (vx, vy, mode) {
    if (this.reduced || (this.v3 && (this.trip || this.mapOn))) return this;
    var v = this.vel;
    if (mode === 'orbit' || mode === 'orbitX') {
      if (!this.canOrbit()) return this;
      v.yaw = clamp(vx * DEG_PER_PX.yaw, -120, 120);
      v.elev = mode === 'orbit' ? clamp(vy * DEG_PER_PX.elev, -60, 60) : 0;
    } else if (mode === 'pan') {
      var d = panDelta(vx, vy, this.viewH || 600, this.pose.dist, this.lim.fov, this.pose.yaw, this.pose.elev, this._pd);
      v.tx = clamp(d.x, -12, 12); v.tz = clamp(d.z, -12, 12);
    }
    return this;
  };
  R.command = function (cmd) {
    var l = this.lim;
    switch (cmd) {
      case 'left': this.orbitBy(-l.keyYaw, 0); break;
      case 'right': this.orbitBy(l.keyYaw, 0); break;
      case 'up': this.orbitBy(0, l.keyElev); break;
      case 'down': this.orbitBy(0, -l.keyElev); break;
      case 'in': this.zoomBy(l.keyZoom); break;
      case 'out': this.zoomBy(1 / l.keyZoom); break;
      case 'panL': this.panBy(l.keyPanPx, 0); break;
      case 'panR': this.panBy(-l.keyPanPx, 0); break;
      case 'panU': this.panBy(0, l.keyPanPx); break;
      case 'panD': this.panBy(0, -l.keyPanPx); break;
      case 'reset': this.reset(false); break;
      default: return false;
    }
    return true;
  };
  R.reset = function (instant) {
    this._input();
    this._snapT = this.lim.snapSec;
    copyView(this.goal, this.home);
    if (editing(this.mode)) { this.goal.yaw = 0; this.goal.elev = this.lim.editElev; }
    this.clampGoal();
    if (instant) copyView(this.cur, this.goal);
    return this;
  };
  /* frame a point (long-press on an item, double-tap dolly on the ground) */
  R.focusOn = function (p, o) {
    if (!p) return this;
    o = o || {};
    /* v3: during a flight the scene may frame an item on the destination: the flight lands on it */
    if (this.v3 && (this.trip || this.mapOn)) this._stopFling();
    else this._input();
    this._snapT = Math.max(this._snapT, 0.6);       /* the 0.6 s dolly */
    this.goal.tx = p.x; this.goal.tz = p.z;
    if (o.zoom != null) this.goal.zoom = o.zoom;
    this.clampGoal();
    if (o.instant) copyView(this.cur, this.goal);
    return this;
  };
  /* place mode on phones: pan so a point (the ghost) stays inside the central `frac` of the view */
  R.keepInView = function (p, frac) {
    if (!p) return this;
    frac = frac || 0.6;
    var n = projectPose(p, this.pose, this._kv);
    if (n.depth > 0 && Math.abs(n.x) <= frac && Math.abs(n.y) <= frac) return this;
    this.goal.tx += (p.x - this.goal.tx) * 0.6;
    this.goal.tz += (p.z - this.goal.tz) * 0.6;
    return this.clampGoal();
  };

  /* edit / place tilt: yaw 0, elevation 62° (arrow keys match grid directions); leaving restores */
  R.setMode = function (mode, o) {
    mode = mode === 'edit' || mode === 'place' ? mode : 'play';
    if (mode === this.mode) return this;
    var g = this.goal;
    this._stopFling();
    if (editing(mode) && !editing(this.mode)) this.saved = { yaw: g.yaw, elev: g.elev, zoom: g.zoom };
    if (editing(mode) !== editing(this.mode)) this._snapT = this.lim.snapSec;      /* the 0.4 s tilt */
    if (editing(mode)) this.interrupt();                 /* editing takes the camera back from the hero shot */
    this.mode = mode;
    if (editing(mode)) {
      g.yaw = 0; g.elev = this.lim.editElev;
      /* place mode on phones zooms in, except when a drag is carrying the item there */
      if (mode === 'place' && this.phone() && !(o && o.keepZoom)) g.zoom = Math.max(g.zoom, this.lim.placeZoomPhone);
    } else if (this.saved) {
      g.yaw = this.saved.yaw; g.elev = this.saved.elev; g.zoom = this.saved.zoom;
      this.saved = null;
    }
    return this.clampGoal();
  };

  /* ---------------- stage-cam moves ----------------
     One at a time: {kind, t, dur, kAt(t) → 0..1, tx, tz, ty?, elev, zoom, yaw? (absolute, + yawDrift × t / dur) | dyaw,
     hold, skippable, relT, relDur, resolve}. The shown pose = lerp(user view, move pose, k); a new
     move ends the old one. */
  R._startMove = function (m) {
    this._endMove(false);
    m.t = 0; m.relT = -1;
    var Pr = P(), self = this;
    m.promise = Pr ? new Pr(function (res) { m.resolve = res; }) : null;
    m.k = m.kAt(0, self.reduced);
    this.move = m;
    return m.promise;
  };
  R._endMove = function (ok) {
    var m = this.move;
    if (!m) return;
    this.move = null;
    this.frozen = 0;
    if (m.resolve) m.resolve(ok !== false);
  };
  /* the establishing hero shot over the bay (SKYLINE). o.easeIn > 0 eases into it first (the stage
     encore); o.at {x, z} pulls the target halfway toward a point; o.hold overrides the hold.
     Reduced motion skips it: the user view is simply there. */
  R.skyline = function (o) {
    o = o || {};
    /* v3: the hero shot is the Sky tour; the stage encore (an eased-in call) cranes on the stage */
    if (this.v3) return o.easeIn > 0 ? this.crane(o.at && isFinite(o.at.x) && isFinite(o.at.z) ? o.at : null) : this.intro();
    if (this.reduced) return P() ? P().resolve(true) : null;
    var S = SKYLINE, h = this.home, fit = skylineFit(this.aspect, {});
    var easeIn = o.easeIn > 0 ? o.easeIn : 0, hold = o.hold > 0 ? o.hold : S.hold, ease = S.ease;
    var at = o.at && isFinite(o.at.x) && isFinite(o.at.z) ? o.at : null;
    return this._startMove({
      kind: 'skyline', skippable: true, dur: easeIn + hold + ease,
      tx: at ? lerp(h.tx, at.x, 0.5) : h.tx, tz: h.tz + S.dz, ty: fit.ty,
      elev: S.elev, yaw: S.yaw, yawDrift: S.drift, zoom: fit.zoom,
      kAt: function (t, reduced) {
        if (reduced) return 0;
        if (t < easeIn) return inOutSine(t / easeIn);
        if (t < easeIn + hold) return 1;
        return 1 - inOutSine(clamp01((t - easeIn - hold) / ease));
      }
    });
  };
  /* kept for callers of the v1 mount reveal: the hero shot replaced it */
  R.reveal = function () { return this.skyline(); };
  /* hand a skippable move back to the user view over 0.45 s (a cut under reduced motion) */
  R.interrupt = function () {
    if (this.v3 && this.trip) return this.skip();
    var m = this.move;
    if (!m || !m.skippable) return false;
    this.frozen = 0;
    if (this.reduced) { this._endMove(true); return true; }
    if (m.relT < 0) { m.relT = m.t; m.relK = m.k; m.relDur = SKYLINE.release; }
    return true;
  };
  /* a finger is down: a skippable move holds still so a tap picks exactly what the child saw
     (never longer than SKYLINE.freezeMax, so a lost pointer cannot strand the shot) */
  R.freeze = function (on) {
    if (this.v3 && on && this.trip) { this.skip(); return this; }     /* v3: a press skips (no pick) */
    this.frozen = on && this.move && this.move.skippable ? SKYLINE.freezeMax : 0;
    return this;
  };
  /* land unlock: crane 52° → 40° toward the region over 1.4 s, hold 1.5 s, back over 1.0 s */
  R.crane = function (p) {
    var M = this.M, c = this.cur, scratch = {}, red = this.reduced;
    var C = (M && M.CRANE) || { out: 1.4, hold: 1.5, back: 1.0, to: 40 };
    var dur = (C.out + C.hold + C.back) || 3.9;
    return this._startMove({
      kind: 'crane', dur: dur,
      tx: p ? lerp(c.tx, p.x, 0.6) : c.tx, tz: p ? lerp(c.tz, p.z, 0.6) : c.tz,
      elev: C.to || 40, zoom: Math.max(c.zoom, 1.15), dyaw: 0,
      kAt: function (t, reduced) {
        if (M && typeof M.crane === 'function') return M.crane(t, reduced != null ? reduced : red, scratch).k;
        if (reduced) return t < C.out + C.hold ? 1 : 0;
        return t < C.out ? inOutSine(t / C.out) : t < C.out + C.hold ? 1 : 1 - inOutSine(clamp01((t - C.out - C.hold) / C.back));
      }
    });
  };
  /* game launch: push in toward the attraction over 0.7 s and hold until releaseMove();
     the promise resolves when the push-in arrives */
  R.pushIn = function (p, o) {
    o = o || {};
    var M = this.M, c = this.cur;
    var m = {
      kind: 'push', dur: 0.7, hold: true,
      tx: p ? p.x : c.tx, tz: p ? p.z : c.tz, elev: Math.max(this.lim.elevMinEdit, c.elev - 6),
      zoom: o.zoom || clamp(Math.max(c.zoom * 1.6, 1.8), 1, LIMITS.pushZoomMax), dyaw: 0,
      kAt: function (t, reduced) { return M && typeof M.pushIn === 'function' ? M.pushIn(t, reduced) : (reduced ? 1 : inOutSine(clamp01(t / 0.7))); }
    };
    m.arrive = true;            /* resolve on arrival, not on release */
    return this._startMove(m);
  };
  /* dance break: a gentle push-in on the house area for the 8 counts */
  R.dance = function (p, sec) {
    if (this.reduced) return P() ? P().resolve(true) : null;
    var c = this.cur, hold = Math.max(0, sec || 4.07);
    return this._startMove({
      kind: 'dance', dur: 0.8 + hold + 0.8,
      tx: p ? lerp(c.tx, p.x, 0.5) : c.tx, tz: p ? lerp(c.tz, p.z, 0.5) : c.tz,
      elev: c.elev, zoom: c.zoom * 1.15, dyaw: 0,
      kAt: function (t) {
        if (t < 0.8) return inOutSine(t / 0.8);
        if (t < 0.8 + hold) return 1;
        return 1 - inOutSine(clamp01((t - 0.8 - hold) / 0.8));
      }
    });
  };
  /* let a held move (the launch push-in) go: eases back over 0.5 s (a cut under reduced motion) */
  R.releaseMove = function (kind) {
    var m = this.move;
    if (!m || (kind && m.kind !== kind)) return this;
    if (this.reduced) { this._endMove(true); return this; }
    if (m.relT < 0) { m.relT = m.t; m.relK = m.k; }
    return this;
  };
  /* Showtime: a slow 8° orbit over 8 s and back, alternating sides, the view dipping up to 6° at
     full sway (orbitDip) so more of the lit quay and its reflections enter the frame */
  R.showOrbit = function (on) { this.orbitOn = !!on; if (on) this.orbitT = 0; return this; };
  R.shake = function (amp, dur) {
    if (this.reduced) return this;
    this.shakeAmp = Math.max(this.shakeAmp * Math.max(0, 1 - this.shakeT / (this.shakeDur || 1)), amp || 0.06);
    this.shakeDur = dur || 0.18; this.shakeT = 0;
    return this;
  };

  /* ---------------- v3 travel: flights, the Sky map, the Sky tour, the sky dip ----------------
     One trip at a time: {kind 'fly' | 'map' | 'unmap' | 'tour', A (the start pose), toMap (true: it
     ends in the held Sky map pose; false: it leaves it), t, hold, sec, pullBack, riseDeg, dip, cut,
     skipping, resolve}. A flight switches the user view to the destination when it starts, so the end
     pose is the live user pose (or the Sky map pose): a resize, the edit tilt or a focusOn during the
     flight move where it lands. A new trip supersedes the old one (whose promise resolves false) and
     starts from the pose on screen. Under reduced motion (or o.reduced) a trip is a sky dip:
     onDip('in'), the view holds DIP.inSec, cuts ('cut', 'out') and resolves DIP.outSec later; no pose
     is ever interpolated. update() returns true while a trip runs, so a sleeping loop keeps ticking. */
  function copyPose(out, s) {
    out.px = s.px; out.py = s.py; out.pz = s.pz; out.tx = s.tx; out.ty = s.ty; out.tz = s.tz;
    out.yaw = s.yaw; out.elev = s.elev; out.zoom = s.zoom; out.dist = s.dist;
    return out;
  }
  function gap3(a, b) { var dx = a.tx - b.tx, dy = a.ty - b.ty, dz = a.tz - b.tz; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  R.onDip = function (fn) { this.dipFn = typeof fn === 'function' ? fn : null; return this; };
  R._dip = function (phase) { var f = this.dipFn; if (f) { try { f(phase); } catch (e) {} } };
  /* the camera position of a pose from its target, yaw, elevation and distance */
  R._place = function (p) {
    var B = basisInto(p.yaw, p.elev, this._mk);
    p.px = p.tx + B.Dx * p.dist; p.py = p.ty + B.Dy * p.dist; p.pz = p.tz + B.Dz * p.dist;
    return p;
  };
  /* the Sky map pose (skyMapFit, cached per aspect / phone / yaw) into out */
  R._mapPose = function (out, yaw) {
    yaw = yaw || 0;
    var f = yaw ? this._mfT || (this._mfT = {}) : this._mf, ph = this.phone();
    if (f.aspect !== this.aspect || f.phone !== ph || f.yaw !== yaw) {
      skyMapFit(this.aspect, this.touch, f, { yaw: yaw });
      f.aspect = this.aspect; f.phone = ph;
    }
    out.tx = f.tx; out.ty = f.ty; out.tz = f.tz; out.yaw = f.yaw; out.elev = f.elev; out.zoom = 1; out.dist = f.dist;
    return this._place(out);
  };
  /* every trip starts here: v2 moves and inertia end, the pose on screen is the start */
  R._travelStart = function () {
    this._endMove(false); this._stopFling(); this.frozen = 0;
    return copyPose({}, this.pose);
  };
  R._startTrip = function (T) {
    var old = this.trip;
    this.trip = null;
    if (old) {
      if (old.dip && !old.cut && !T.dip) this._dip('out');
      if (old.resolve) old.resolve(false);
    }
    T.t = 0; T.cut = false; T.skipping = false; T.hold = T.hold || 0;
    var Pr = P();
    T.promise = Pr ? new Pr(function (res) { T.resolve = res; }) : null;
    this.trip = T;
    if (T.dip) this._dip('in');
    return T.promise;
  };
  R._arrive = function (T) {
    if (this.trip !== T) return;
    this.trip = null;
    if (T.toMap != null) this.mapOn = T.toMap;
    if (T.dip && !T.cut) { this._dip('cut'); this._dip('out'); }
    if (T.resolve) T.resolve(true);
  };
  /* the destination's home view as the user view (the edit tilt kept), at once */
  R._goHome = function () {
    var g = this.goal, h = this.home;
    this._stopFling();
    copyView(g, h);
    if (editing(this.mode)) {
      this.saved = { yaw: h.yaw, elev: h.elev, zoom: h.zoom };
      g.yaw = 0; g.elev = this.lim.editElev;
      if (this.mode === 'place' && this.phone()) g.zoom = Math.max(g.zoom, this.lim.placeZoomPhone);
    } else this.saved = null;
    this.clampGoal();
    copyView(this.cur, g);
    return this;
  };
  /* rig.fly(frame | isle, {sec, reduced}) → Promise<bool>: fly to an island's home view (T =
     flightSec of the target travel, the 35% pull-back and the 8° rise over the gap; from the Sky map
     or to the island already visited there is neither). Resolves true on arrival, false when
     superseded. Reduced: the sky dip. */
  R.fly = function (view, o) {
    if (!this.v3) return resolved(false);
    o = o || {};
    var F = typeof view === 'string' ? (view === 'home' ? this.homeFr || isleFrame('home') : isleFrame(view)) : view;
    if (!F || !F.isle) return resolved(false);
    var T = this.trip;
    /* the same chip again mid-flight: that flight simply goes on */
    if (T && T.kind === 'fly' && T.isle === F.isle && !(o.sec > 0) && !!T.dip === (this.reduced || !!o.reduced)) return T.promise;
    var A = this._travelStart(), fromMap = this.mapOn || !!(T && T.toMap === true);
    var same = !fromMap && !(T && T.kind !== 'unmap') && F.isle === this.isle;
    this.mapOn = false;
    this._useFrame(F, { instant: true });
    this._goHome();
    var B = this._staticPose(this.goal, this._tP), calm = fromMap || same;
    return this._startTrip({ kind: 'fly', isle: F.isle, A: A, toMap: null, sec: o.sec > 0 ? o.sec : flightSec(gap3(A, B)),
      dip: this.reduced || !!o.reduced, pullBack: calm ? 0 : V3.FLIGHT.pullBack, riseDeg: calm ? 0 : V3.FLIGHT.riseDeg });
  };
  /* rig.skyMap(on, {reduced}) → Promise<bool>: on = fly out to the Sky map pose and hold it (taps only);
     off = fly back to the visited island's view. A no-op resolves true at once. */
  R.skyMap = function (on, o) {
    if (!this.v3) return resolved(false);
    on = !!on; o = o || {};
    var T = this.trip, heading = T ? T.toMap === true : this.mapOn;
    if (heading === on) return T ? T.promise : resolved(true);      /* already there, or on the way */
    var A = this._travelStart();
    if (!on) this.mapOn = false;
    var B = on ? this._mapPose(this._tP, 0) : this._staticPose(this.goal, this._tP);
    return this._startTrip({ kind: on ? 'map' : 'unmap', A: A, toMap: on, sec: flightSec(gap3(A, B)),
      dip: this.reduced || !!o.reduced, pullBack: 0, riseDeg: 0 });
  };
  /* rig.intro() → Promise<bool>: the Sky tour. It starts in the Sky map pose at yaw −8°, holds 0.9 s,
     then flies 2.2 s to the user view (the yaw drifting to it). Never under reduced motion (resolves
     true at once: the user view is simply there). skyline() / reveal() are aliases. */
  R.intro = function () {
    if (!this.v3) return this.skyline();
    if (this.reduced) return resolved(true);
    this._travelStart();
    this.mapOn = false;
    var A = this._mapPose({}, V3.TOUR.yaw0), Tr = V3.TOUR;
    return this._startTrip({ kind: 'tour', A: A, liveA: true, toMap: null, hold: Tr.holdSec, sec: Tr.flySec, pullBack: 0, riseDeg: 0 });
  };
  /* rig.skip(): any tap, key or chip during the tour or a flight: from the pose on screen to the end
     pose in FLIGHT.skipSec (inOutSine). A sky dip is already that short: no skip. → skipped? */
  R.skip = function () {
    if (!this.v3) return this.interrupt();
    var T = this.trip;
    if (!T || T.dip || T.skipping) return false;
    copyPose(T.A, this.pose);
    T.liveA = false; T.t = 0; T.hold = 0; T.sec = V3.FLIGHT.skipSec; T.pullBack = 0; T.riseDeg = 0; T.skipping = true;
    return true;
  };
  /* one frame of the trip: p holds the composed user pose on entry and the pose to show on exit */
  R._tripStep = function (dt, p) {
    var T = this.trip, D = V3.DIP;
    T.t += dt;
    if (T.dip) {
      if (!T.cut) {
        if (T.t < D.inSec) { copyPose(p, T.A); return; }
        T.cut = true; T.tCut = T.t;
        if (T.toMap != null) this.mapOn = T.toMap;
        this._dip('cut'); this._dip('out');
      }
      if (this.mapOn) this._mapPose(p, 0);
      if (T.t - T.tCut >= D.outSec) this._arrive(T);
      return;
    }
    if (T.liveA) this._mapPose(T.A, V3.TOUR.yaw0);          /* the tour's start follows a resize while it holds */
    var B = T.toMap ? this._mapPose(this._tB, 0) : copyPose(this._tB, p);
    var u = T.t <= T.hold ? 0 : (T.t - T.hold) / Math.max(1e-6, T.sec);
    if (u > 0) T.liveA = false;
    flightPose(T.A, B, u, p, T);
    p.elev = Math.min(p.elev, elevCapFor(p.yaw, this.aspect, this.lim.fov));    /* the rise never breaks the guard */
    this._place(p);
    if (u >= 1) this._arrive(T);
  };

  /* the camera's distance from its target and the target's slide toward the city for a view (zero
     allocation): the play framing (FRAME), blended to the plain v2 fit by a stage-cam move's k (mk, so
     every move keeps its own pose) and the plain fit throughout on portrait phones → out {dist, slide} */
  R._frameDist = function (yaw, elev, zoom, mk, out) {
    var zk = Math.max(0.1, zoom), plain = fitDist(this.b, yaw, elev, this.aspect, this.lim.fov, this.lim.margin, this.lim.near) / zk;
    out.dist = plain; out.slide = 0;
    if (!this.fr || this.phone() || mk >= 1) return out;
    var band = (this.fr.band != null ? this.fr.band : FRAME.band) * this.bandK * bandAt(zoom) * (1 - mk);
    var F = fitFrame(this.fr, yaw, elev, this.aspect, band, this._fit, this.lim.fov, this.lim.margin, this.lim.near);
    out.slide = F.shift * (1 - mk);
    out.dist = lerp(F.depth / zk + out.slide * Math.cos(elev * DEG), plain, mk);
    return out;
  };
  /* the still pose of a view {tx, tz, yaw, elev, zoom} (no move, sway or shake) into out */
  R._staticPose = function (v, out) {
    var fd = this._frameDist(v.yaw, v.elev, v.zoom, 0, this._fd2), B = basisInto(v.yaw, v.elev, this._sb);
    out.tx = v.tx - Math.sin(v.yaw * DEG) * fd.slide; out.ty = this.tyBase; out.tz = v.tz - Math.cos(v.yaw * DEG) * fd.slide;
    out.px = out.tx + B.Dx * fd.dist; out.py = out.ty + B.Dy * fd.dist; out.pz = out.tz + B.Dz * fd.dist;
    out.yaw = v.yaw; out.elev = v.elev; out.zoom = v.zoom; out.dist = fd.dist; out.fov = this.lim.fov; out.aspect = this.aspect;
    return out;
  };

  /* ---------------- per frame (zero allocation) ---------------- */
  R.update = function (dt) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.t += dt;
    var g = this.goal, c = this.cur, v = this.vel, red = this.reduced;
    /* inertia */
    if (!red && (v.yaw || v.elev || v.tx || v.tz)) {
      g.yaw += v.yaw * dt; g.elev += v.elev * dt; g.tx += v.tx * dt; g.tz += v.tz * dt;
      var keep = Math.pow(this.lim.flingKeep, dt);
      v.yaw *= keep; v.elev *= keep; v.tx *= keep; v.tz *= keep;
      if (Math.abs(v.yaw) < 0.5 && Math.abs(v.elev) < 0.5 && Math.abs(v.tx) < 0.01 && Math.abs(v.tz) < 0.01) this._stopFling();
      this.clampGoal();
    }
    /* ease the shown view toward the goal */
    if (red) copyView(c, g);
    else {
      if (this._snapT > 0) this._snapT -= dt;
      var a = damp(dt, this._snapT > 0 ? this.lim.snapDamping : this.lim.damping);
      c.tx += (g.tx - c.tx) * a; c.tz += (g.tz - c.tz) * a; c.yaw += (g.yaw - c.yaw) * a;
      c.elev += (g.elev - c.elev) * a; c.zoom += (g.zoom - c.zoom) * a;
      if (Math.abs(g.tx - c.tx) < STEP_EPS) c.tx = g.tx;
      if (Math.abs(g.tz - c.tz) < STEP_EPS) c.tz = g.tz;
      if (Math.abs(g.yaw - c.yaw) < STEP_EPS) c.yaw = g.yaw;
      if (Math.abs(g.elev - c.elev) < STEP_EPS) c.elev = g.elev;
      if (Math.abs(g.zoom - c.zoom) < STEP_EPS) c.zoom = g.zoom;
    }
    /* the skyline band follows the mode with the same easing as the tilt */
    var bt = editing(this.mode) ? 0 : 1;
    if (red) this.bandK = bt;
    else if (this.bandK !== bt) {
      this.bandK += (bt - this.bandK) * damp(dt, this._snapT > 0 ? this.lim.snapDamping : this.lim.damping);
      if (Math.abs(bt - this.bandK) < STEP_EPS) this.bandK = bt;
    }
    /* the stage-cam move (a skippable one holds still while a finger is down) */
    var m = this.move, k = 0;
    if (m) {
      if (this.frozen > 0 && m.skippable && m.relT < 0) this.frozen = Math.max(0, this.frozen - dt);
      else m.t += dt;
      if (m.relT >= 0) {
        var u = clamp01((m.t - m.relT) / (m.relDur || 0.5));
        k = m.relK * (1 - inOutSine(u));
        if (u >= 1) { this._endMove(true); m = null; k = 0; }
      } else {
        k = m.kAt(m.t, red);
        if (m.arrive && m.resolve && m.t >= (red ? 0 : m.dur)) { var res = m.resolve; m.resolve = null; res(true); }
        if (!m.hold && m.t >= m.dur) { this._endMove(true); m = null; k = 0; }
      }
      if (m) m.k = k;
    }
    /* Showtime orbit */
    var M = this.M;
    if (this.orbitOn && !red && !editing(this.mode)) {       /* edit keeps yaw 0 for the arrow keys */
      this.orbitT += dt;
      var cyc = Math.floor(this.orbitT / 8), ct = this.orbitT - cyc * 8, sign = cyc % 2 ? -1 : 1;
      var o = M && typeof M.orbit === 'function' ? M.orbit(ct, false) : 8 * Math.sin(Math.PI * ct / 8);
      this.orbitYaw = sign * o;
    } else if (this.orbitYaw) {
      this.orbitYaw += (0 - this.orbitYaw) * (red ? 1 : damp(dt, editing(this.mode) ? this.lim.snapDamping : 0.05));
      if (Math.abs(this.orbitYaw) < 1e-3) this.orbitYaw = 0;
    }
    /* compose: the user view, the Showtime sway and its elevation dip, then the move on top */
    var yaw = c.yaw + this.orbitYaw, elev = c.elev, zoom = c.zoom, tx = c.tx, tz = c.tz, ty = this.tyBase;
    if (this.orbitYaw) elev -= orbitDip(this.orbitYaw, elev);
    if (m && k > 0) {
      tx = lerp(tx, m.tx, k); tz = lerp(tz, m.tz, k);
      if (m.ty != null) ty = lerp(ty, m.ty, k);
      if (m.elev != null) elev = lerp(elev, m.elev, k);
      if (m.zoom != null) zoom = lerp(zoom, m.zoom, k);
      if (m.yaw != null) yaw = lerp(yaw, m.yaw + (m.yawDrift ? m.yawDrift * clamp01(m.t / m.dur) : 0), k);
      else if (m.dyaw) yaw += m.dyaw * k;
    }
    /* v3: the face-culling guard holds through the Showtime sway and every stage-cam move too */
    if (this.v3) {
      var ym = yawCapFor(this.aspect, this.lim.elevMin, this.lim.fov);
      yaw = clamp(yaw, -ym, ym);
      elev = Math.min(elev, elevCapFor(yaw, this.aspect, this.lim.fov));
    }
    if (this.shakeAmp > 0) {
      this.shakeT += dt;
      var sk = 1 - this.shakeT / this.shakeDur;
      if (sk <= 0 || red) this.shakeAmp = 0;
      else { tx += this.shakeAmp * sk * Math.sin(this.shakeT * 91); tz += this.shakeAmp * sk * Math.cos(this.shakeT * 77); }
    }
    var p = this.pose, B = basisInto(yaw, elev, this._mk), fd = this._frameDist(yaw, elev, zoom, m ? k : 0, this._fd);
    var dist = fd.dist;
    tx -= Math.sin(yaw * DEG) * fd.slide; tz -= Math.cos(yaw * DEG) * fd.slide;      /* toward the city */
    p.tx = tx; p.ty = ty; p.tz = tz; p.yaw = yaw; p.elev = elev; p.zoom = zoom; p.dist = dist;
    p.px = tx + B.Dx * dist; p.py = ty + B.Dy * dist; p.pz = tz + B.Dz * dist;
    p.fov = this.lim.fov; p.aspect = this.aspect;
    /* v3: a trip (or the held Sky map) shows its own pose over the user view */
    if (this.trip) this._tripStep(dt, p);
    else if (this.mapOn) this._mapPose(p, 0);
    var L = this._last, changed = !(Math.abs(L.px - p.px) < 1e-5 && Math.abs(L.py - p.py) < 1e-5 && Math.abs(L.pz - p.pz) < 1e-5 &&
      Math.abs(L.tx - p.tx) < 1e-5 && Math.abs(L.ty - p.ty) < 1e-5 && Math.abs(L.tz - p.tz) < 1e-5 && L.fov === p.fov && L.aspect === p.aspect);
    if (changed) {
      L.px = p.px; L.py = p.py; L.pz = p.pz; L.tx = p.tx; L.ty = p.ty; L.tz = p.tz; L.fov = p.fov; L.aspect = p.aspect;
      this.version++;
    }
    this.moving = changed;
    return changed || !!this.trip;
  };
  /* write the pose into a THREE.PerspectiveCamera (duck-typed: no THREE import here) */
  R.apply = function (cam) {
    if (!cam) return this;
    var p = this.pose;
    if (this._camAspect !== p.aspect || this._camFov !== p.fov || cam.near !== p.near || cam.far !== p.far) {
      cam.fov = p.fov; cam.aspect = p.aspect; cam.near = p.near; cam.far = p.far;
      if (typeof cam.updateProjectionMatrix === 'function') cam.updateProjectionMatrix();
      this._camAspect = p.aspect; this._camFov = p.fov;
    }
    cam.position.set(p.px, p.py, p.pz);
    if (cam.up && cam.up.set) cam.up.set(0, 1, 0);
    if (typeof cam.lookAt === 'function') cam.lookAt(p.tx, p.ty, p.tz);
    if (typeof cam.updateMatrixWorld === 'function') cam.updateMatrixWorld();
    return this;
  };
  R.project = function (p, out) { return projectPose(p, this.pose, out); };
  R.groundAt = function (nx, ny, y, out) { return groundAt(this.pose, nx, ny, y, out); };
  R.info = function () {
    var p = this.pose;
    var out = {
      mode: this.mode, yaw: Math.round(p.yaw * 10) / 10, elev: Math.round(p.elev * 10) / 10, zoom: Math.round(p.zoom * 100) / 100,
      dist: Math.round(p.dist * 100) / 100, target: [p.tx, p.ty, p.tz], move: this.move ? this.move.kind : null,
      frozen: this.frozen > 0, orbit: this.orbitOn, aspect: Math.round(this.aspect * 1000) / 1000, zoomMax: this.zoomMax(),
      homeZoom: this.homeZoom(), phone: this.phone(), reduced: this.reduced, band: Math.round(this.bandK * 100) / 100
    };
    if (this.v3) { out.profile = 'v3'; out.isle = this.isle; out.skyMap = this.mapOn; out.trip = this.trip ? this.trip.kind : null; }
    return out;
  };
  R.dispose = function () {
    this._endMove(false);
    var T = this.trip;
    if (T) { this.trip = null; if (T.dip && !T.cut) this._dip('out'); if (T.resolve) T.resolve(false); }
  };

  /* ================================================================
     GESTURE — a pure pointer recognizer (times in ms, positions in CSS px)
     ================================================================ */
  /* young children press and hold: a press released within the slop counts as a tap for up to
     tapMs (1 s), even after the 450 ms long-press fired (that tap carries long: true and never
     forms a double tap). Held still until holdMs (= tapMs) it becomes a deliberate 'hold' (once),
     and the release is no tap. */
  function Gesture(o) {
    o = o || {};
    this.slop = o.slop || 8; this.dragPx = o.dragPx || 10;
    this.tapMs = o.tapMs || 1000; this.longMs = o.longMs || 450;
    this.holdMs = Math.max(this.longMs, o.holdMs || this.tapMs);
    this.doubleMs = o.doubleMs || 320; this.doublePx = o.doublePx || 24;
    this.flingMs = o.flingMs || 80;
    this.ptrs = [];
    this.lastTap = null;
    this._reset();
  }
  var GP = Gesture.prototype;
  GP._reset = function () {
    this.state = 'idle'; this.claim = null; this.cam = 'none'; this.long = false; this.held = false;
    this.vx = 0; this.vy = 0; this.lt = 0;
    this.pd = 0; this.pa = 0; this.pcx = 0; this.pcy = 0;
  };
  GP._find = function (id) { for (var i = 0; i < this.ptrs.length; i++) if (this.ptrs[i].id === id) return this.ptrs[i]; return null; };
  GP.has = function (id) { return !!this._find(id); };
  GP.active = function () { return this.ptrs.length > 0; };
  GP._pinchInit = function () {
    var a = this.ptrs[0], b = this.ptrs[1];
    this.pd = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    this.pa = Math.atan2(b.y - a.y, b.x - a.x);
    this.pcx = (a.x + b.x) / 2; this.pcy = (a.y + b.y) / 2;
  };
  GP.down = function (id, x, y, t, info) {
    info = info || {};
    if (this._find(id)) return [];
    var n = this.ptrs.length;
    if (n === 0) {
      this._reset();
      this.ptrs.push({ id: id, x: x, y: y, x0: x, y0: y, t0: t });
      this.state = 'press'; this.claim = info.claim || null; this.cam = info.cam || 'none'; this.lt = t;
      return [{ type: 'press', x: x, y: y, claim: this.claim }];
    }
    if (n === 1) {
      var out = [];
      if (this.state === 'drag') out.push({ type: 'dragend', x: this.ptrs[0].x, y: this.ptrs[0].y, cancelled: true });
      this.ptrs.push({ id: id, x: x, y: y, x0: x, y0: y, t0: t });
      this.state = 'multi';
      this._pinchInit();
      return out;
    }
    this.ptrs.push({ id: id, x: x, y: y, x0: x, y0: y, t0: t, extra: true });
    return [];
  };
  GP.move = function (id, x, y, t) {
    var p = this._find(id);
    if (!p || p.extra) return [];
    var dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    var st = this.state;
    if (st === 'press') {
      var dist = Math.hypot(x - p.x0, y - p.y0);
      if (this.claim) {
        if (dist <= this.dragPx) return [];
        this.state = 'drag';
        return [{ type: 'dragstart', x: x, y: y, x0: p.x0, y0: p.y0, claim: this.claim }, { type: 'drag', x: x, y: y }];
      }
      if (dist <= this.slop) return [];
      if (this.cam === 'none') { this.state = 'ignore'; return []; }
      this.state = 'camera'; this.lt = t; this.vx = this.vy = 0;
      return [{ type: this.cam, dx: x - p.x0, dy: this.cam === 'orbitX' ? 0 : y - p.y0 }];
    }
    if (st === 'camera') {
      var gap = t - this.lt;
      if (gap > 0) {
        this.vx = this.vx * 0.4 + (dx / gap * 1000) * 0.6;
        this.vy = this.vy * 0.4 + (dy / gap * 1000) * 0.6;
        this.lt = t;
      }
      return [{ type: this.cam, dx: dx, dy: this.cam === 'orbitX' ? 0 : dy }];
    }
    if (st === 'drag') return [{ type: 'drag', x: x, y: y }];
    if (st === 'multi' && this.ptrs.length >= 2) {
      var a = this.ptrs[0], b = this.ptrs[1];
      var d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang = Math.atan2(b.y - a.y, b.x - a.x);
      var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      var ev = { type: 'pinch', scale: d / this.pd, rotate: wrapDeg((ang - this.pa) / DEG), dx: cx - this.pcx, dy: cy - this.pcy, cx: cx, cy: cy };
      this.pd = d; this.pa = ang; this.pcx = cx; this.pcy = cy;
      return [ev];
    }
    return [];
  };
  GP._remove = function (id) {
    for (var i = 0; i < this.ptrs.length; i++) if (this.ptrs[i].id === id) { var p = this.ptrs[i]; this.ptrs.splice(i, 1); return p; }
    return null;
  };
  GP.up = function (id, x, y, t) {
    var p = this._find(id);
    if (!p) return [];
    if (x != null) { p.x = x; p.y = y; }
    var st = this.state, out = [];
    this._remove(id);
    if (p.extra) return out;
    if (st === 'press' && !this.ptrs.length) {
      var dist = Math.hypot(p.x - p.x0, p.y - p.y0);
      if (!this.held && t - p.t0 <= this.tapMs && dist <= this.slop) {
        var lt = this.lastTap, count = 1, slow = this.long;
        if (!slow && lt && t - lt.t <= this.doubleMs && Math.hypot(p.x - lt.x, p.y - lt.y) <= this.doublePx) count = 2;
        this.lastTap = count === 2 || slow ? null : { x: p.x, y: p.y, t: t };
        out.push({ type: 'tap', x: p.x, y: p.y, count: count, claim: this.claim, long: slow });
      }
    } else if (st === 'drag') {
      out.push({ type: 'dragend', x: p.x, y: p.y, cancelled: false });
    } else if (st === 'camera') {
      var fresh = t - this.lt <= this.flingMs;
      out.push({ type: 'release', vx: fresh ? this.vx : 0, vy: fresh ? (this.cam === 'orbitX' ? 0 : this.vy) : 0, mode: this.cam });
    } else if (st === 'multi') {
      /* the remaining finger must not start an orbit or a tap */
      if (this.ptrs.length) { this.state = 'wait'; return out; }
    }
    if (!this.ptrs.length) this._reset();
    else if (st !== 'multi' && st !== 'wait') this.state = 'wait';
    return out;
  };
  GP.cancel = function (id) {
    var p = this._find(id);
    if (!p) return [];
    var st = this.state, out = [];
    this._remove(id);
    if (!p.extra && st === 'drag') out.push({ type: 'dragend', x: p.x, y: p.y, cancelled: true });
    if (!this.ptrs.length) this._reset();
    else if (!p.extra) this.state = 'wait';
    return out;
  };
  GP.cancelAll = function () {
    var out = [];
    if (this.state === 'drag' && this.ptrs.length) out.push({ type: 'dragend', x: this.ptrs[0].x, y: this.ptrs[0].y, cancelled: true });
    this.ptrs.length = 0;
    this._reset();
    return out;
  };
  /* long-press / hold check (call from a timer): single pointer, still within the slop;
     'longpress' fires once at longMs, then 'hold' once at holdMs */
  GP.tick = function (t) {
    if (this.state !== 'press' || this.held || this.ptrs.length !== 1) return [];
    var p = this.ptrs[0];
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > this.slop) return [];
    var out = [];
    if (!this.long) {
      if (t - p.t0 < this.longMs) return out;
      this.long = true;
      out.push({ type: 'longpress', x: p.x, y: p.y, claim: this.claim });
    }
    if (t - p.t0 >= this.holdMs) {
      this.held = true;
      out.push({ type: 'hold', x: p.x, y: p.y, claim: this.claim });
    }
    return out;
  };
  /* ms until the next tick() can fire for the current press (-1 = nothing pending) */
  GP.nextTick = function (t) {
    if (this.state !== 'press' || this.held || this.ptrs.length !== 1) return -1;
    var p = this.ptrs[0];
    return Math.max(0, p.t0 + (this.long ? this.holdMs : this.longMs) - t);
  };

  /* ================================================================
     CONTROLS — DOM events → Gesture → rig / scene hooks (browser only)
     ================================================================ */
  function Controls(el, rig, hooks, o) {
    o = o || {};
    hooks = hooks || {};
    var g = new Gesture(o.gesture);
    var enabled = true, lpTimer = 0, disposed = false, kinds = {};
    var nowMs = (root.performance && root.performance.now) ? function () { return root.performance.now(); } : Date.now;
    function call(name) {
      var f = hooks[name];
      if (typeof f !== 'function') return undefined;
      try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { if (hooks.error) hooks.error(e); return undefined; }
    }
    function local(e) {
      var r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width || 1, h: r.height || 1 };
    }
    function ndcOf(x, y) { var r = el.getBoundingClientRect(); return { x: (x / (r.width || 1)) * 2 - 1, y: -((y / (r.height || 1)) * 2 - 1) }; }
    function camMode(e) {
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1 || e.shiftKey) return 'pan';
        return rig.canOrbit() ? 'orbit' : 'pan';
      }
      if (rig.zoomedIn()) return 'pan';
      return rig.canOrbit() ? 'orbitX' : 'none';
    }
    function dispatch(evs) {
      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        switch (ev.type) {
          case 'tap': call('tap', ev.x, ev.y, ev.count, !!ev.long); break;
          case 'longpress': call('longPress', ev.x, ev.y, ev.claim); break;
          case 'hold': call('hold', ev.x, ev.y, ev.claim); break;
          case 'dragstart': call('dragStart', ev.x, ev.y, ev.x0, ev.y0, ev.claim); break;
          case 'drag': call('drag', ev.x, ev.y); break;
          case 'dragend': call('dragEnd', ev.x, ev.y, ev.cancelled); break;
          case 'orbit': rig.orbitBy(ev.dx * DEG_PER_PX.yaw, ev.dy * DEG_PER_PX.elev); call('camera'); break;
          case 'orbitX': rig.orbitBy(ev.dx * DEG_PER_PX.yaw, 0); call('camera'); break;
          case 'pan': rig.panBy(ev.dx, ev.dy); call('camera'); break;
          case 'pinch': {
            var n = ndcOf(ev.cx, ev.cy), f = rig.groundAt(n.x, n.y, rig.tyBase != null ? rig.tyBase : TARGET_Y, {});
            rig.zoomBy(ev.scale, f);
            if (rig.canOrbit() && Math.abs(ev.rotate) > 0.05) rig.orbitBy(-ev.rotate, 0);
            if (ev.dx || ev.dy) rig.panBy(ev.dx, ev.dy);
            call('camera');
            break;
          }
          case 'release': rig.fling(ev.vx, ev.vy, ev.mode); break;
        }
      }
    }
    /* the long-press, then the hold: one timer at a time, re-armed after each tick */
    function armLong() {
      clearTimeout(lpTimer);
      var wait = g.nextTick(nowMs());
      if (wait < 0) return;
      lpTimer = setTimeout(function () {
        if (disposed) return;
        dispatch(g.tick(nowMs()));
        armLong();
      }, wait + 10);
    }
    function onDown(e) {
      if (!enabled || disposed) return;
      if (e.pointerType === 'mouse' && e.button > 2) return;
      call('input', 'press');
      var p = local(e);
      var claim = g.active() ? null : (call('press', p.x, p.y, e) || null);
      kinds[e.pointerId] = e.pointerType;
      var evs = g.down(e.pointerId, p.x, p.y, nowMs(), { claim: claim, cam: camMode(e) });
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      if (g.ptrs.length === 1) armLong(); else clearTimeout(lpTimer);
      dispatch(evs);
      if (e.pointerType === 'mouse') e.preventDefault();       /* no text selection / drag ghost */
    }
    function onMove(e) {
      if (disposed || !g.has(e.pointerId)) return;
      var p = local(e), before = g.state;
      var evs = g.move(e.pointerId, p.x, p.y, nowMs());
      if (g.state !== 'press') clearTimeout(lpTimer);
      dispatch(evs);
      if (g.state === 'camera' || g.state === 'drag' || g.state === 'multi' || before === 'multi') { if (e.cancelable) e.preventDefault(); }
    }
    function onUp(e) {
      if (disposed || !g.has(e.pointerId)) return;
      var p = local(e);
      clearTimeout(lpTimer);
      dispatch(g.up(e.pointerId, p.x, p.y, nowMs()));
      try { el.releasePointerCapture(e.pointerId); } catch (er) {}
      delete kinds[e.pointerId];
      if (!g.active()) call('up');
    }
    function onCancel(e) {
      if (disposed || !g.has(e.pointerId)) return;
      clearTimeout(lpTimer);
      dispatch(g.cancel(e.pointerId));
      delete kinds[e.pointerId];
      if (!g.active()) call('up');
    }
    /* capture lost while the finger is still down: the canvas was re-parented (the host redrew its
       page around the persistent stage) — take the capture back and carry on; only when that is
       impossible (the element left the page, the pointer is gone) is the gesture cancelled */
    function onLost(e) {
      if (disposed || !g.has(e.pointerId)) return;      /* after pointerup / pointercancel: nothing to do */
      if (el.isConnected !== false && typeof el.setPointerCapture === 'function') {
        try { el.setPointerCapture(e.pointerId); } catch (er) {}
        var kept = false;
        try { kept = typeof el.hasPointerCapture === 'function' ? !!el.hasPointerCapture(e.pointerId) : false; } catch (er2) { kept = false; }
        if (kept) return;
      }
      onCancel(e);
    }
    function onWheel(e) {
      if (!enabled || disposed) return;
      call('input', 'wheel');
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (!dy) return;
      var p = local(e), n = ndcOf(p.x, p.y), f = rig.groundAt(n.x, n.y, rig.tyBase != null ? rig.tyBase : TARGET_Y, {});   /* target height: the point stays put */
      var changed = rig.zoomBy(Math.exp(-clamp(dy, -240, 240) * 0.0015), f);
      if (changed) { e.preventDefault(); call('camera'); }     /* at a zoom limit the page scrolls on */
    }
    function onContext(e) { e.preventDefault(); }
    function cancelAll() {
      var had = g.active();
      clearTimeout(lpTimer);
      dispatch(g.cancelAll());
      if (had) call('up');
    }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onLost);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContext);

    var KEYMAP = { '[': 'left', ']': 'right', '+': 'in', '=': 'in', '-': 'out', '_': 'out', '0': 'reset', Home: 'reset' };
    return {
      gesture: g,
      /* keyboard (call from a keydown listener on the camera buttons) → true when handled */
      key: function (e) {
        if (!enabled || disposed || e.altKey || e.ctrlKey || e.metaKey) return false;
        var cmd = KEYMAP[e.key] || null;
        if (!cmd) {
          if (e.key === 'ArrowLeft') cmd = e.shiftKey ? 'panL' : 'left';
          else if (e.key === 'ArrowRight') cmd = e.shiftKey ? 'panR' : 'right';
          else if (e.key === 'ArrowUp') cmd = e.shiftKey ? 'panU' : 'up';
          else if (e.key === 'ArrowDown') cmd = e.shiftKey ? 'panD' : 'down';
        }
        if (!cmd) return false;
        rig.command(cmd);
        call('input', 'key'); call('camera');
        return true;
      },
      setEnabled: function (on) { enabled = !!on; if (!enabled) cancelAll(); },
      cancel: function () { cancelAll(); },
      busy: function () { return g.active(); },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        clearTimeout(lpTimer);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onCancel);
        el.removeEventListener('lostpointercapture', onLost);
        el.removeEventListener('wheel', onWheel, { passive: false });
        el.removeEventListener('contextmenu', onContext);
      }
    };
  }

  return {
    VERSION: VERSION, LIMITS: LIMITS, SKYLINE: SKYLINE, FRAME: FRAME, TARGET_Y: TARGET_Y, DEG_PER_PX: DEG_PER_PX,
    clamp: clamp, lerp: lerp, damp: damp, wrapDeg: wrapDeg,
    boundsOf: boundsOf, fitDist: fitDist, frameOf: frameOf, fitFrame: fitFrame, bandAt: bandAt,
    basisInto: basisInto, panDelta: panDelta, panLimit: panLimit, backPanFor: backPanFor,
    isPhone: isPhone, zoomMaxFor: zoomMaxFor, homeZoomFor: homeZoomFor, orbitDip: orbitDip, topRayDeg: topRayDeg,
    skylineFit: skylineFit, projectPose: projectPose, groundAt: groundAt,
    V3: V3, isleFrame: isleFrame, visitPose: visitPose, visitZoomFor: visitZoomFor, skyBox: skyBox, skyMapFit: skyMapFit,
    flightSec: flightSec, flightPose: flightPose, inOutSine: inOutSine, elevCapFor: elevCapFor, yawCapFor: yawCapFor,
    Rig: Rig, Gesture: Gesture, Controls: Controls,
    create: function (o) { return new Rig(o); }
  };
}));
