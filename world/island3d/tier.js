/* ================================================================
   My Island 3D — device tiers, budgets, adaptive quality, frame pacing.
   PURE (no DOM, no THREE): window.SLTier in the browser, require() in
   Node tests. stage.js feeds it device facts and frame timings; every
   decision it makes is a plain function of its inputs.

   API
     SLTier.TIERS                       ['LOW', 'MID', 'HIGH']
     SLTier.BUDGETS[tier]               per-tier numbers (art bible performanceBudget + the v3 sky-island and land-shop budgets)
     SLTier.LADDER                      adaptive step-down order (outlines particles life decor isles | pixelRatio shadows water reflections cones)
     SLTier.STEP_KIND / stepKind(step)  'cpu' (draw calls, per-frame work) | 'gpu' (fill): which bottleneck a step relieves
     SLTier.ISLAND_ONLY                 ['isles', 'water']: steps only a holder that declares them takes (D82)
     SLTier.facts(nav, extra)           navigator-like → {ios, android, touch, desktop, cores, maxTex, caveat, saved}
     SLTier.decide(facts)               → 'LOW' | 'MID' | 'HIGH'   (decided BEFORE the renderer exists)
     SLTier.explain(facts)              → {tier, why}
     SLTier.budget(tier, dpr)           → a fresh budget object with .pixelRatio and .pixelated resolved (crispRatio)
     SLTier.crispRatio(dpr, cap)        → {ratio, n, pixelated}: the render scale whose upscale is none or a whole n× (crisp kit C5)
     SLTier.stepRatio(dpr, ratio)       → {ratio, n, pixelated}: where the adaptive 'pixelRatio' step goes from ratio
     SLTier.lower(tier) / parseTier(v)
     SLTier.AdaptiveQuality(opts)       → controller {sample(workMs, intervalMs, nowMs, targetMs), reset(), stats(), …}
     SLTier.FramePacer(opts)            → pacer {tick(now, animating), input(now), invalidate(), setReduced(on), …}
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLTier = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIERS = ['LOW', 'MID', 'HIGH'];

  /* ---------------- budgets (art bible performanceBudget + island architecture) ----------------
     drawCalls/tris are the island budgets; gameDrawCalls/gameTris the 3D games'.
     segScale: LOW cuts primitive segment counts by ~30%.
     Encore City (v2): cityBuildings = towers in the city across the bay, birds = harbour
     swifts, boats = water taxis + catamarans, lanterns = floating lanterns, reflections =
     light pillars in the sea, terrainSpacing = the terrain lattice step (divides 1, so cell
     edges are lattice lines).
     My Island v3 (Pixel Blocks sky islands; the games never read these): isleMode = how the
     islands the child is NOT on draw ('bake': one LOD1 InstancedMesh each; 'merger': live
     merged layers), waterFps = the rate the shared uWaterFrame uniform steps at (no texture
     uploads, D41), fallsCubes = falling waterfall cubes per fall on the visited island,
     critters / clouds / balloons / skyBirds = the sky life, snowCubes / fireflies / starCubes =
     the visited island's cube pool, previewTris = one locked-island preview, voxPrograms =
     the vox programs in use; callsHome / callsMap / trisHome / trisWorst = the v3 pose budgets
     (Home view of the max world, the Sky map, worst pose). The v2 drawCalls / tris / programs
     stay the hard ceilings. skyBirds and snowCubes are named apart from the v2 'birds' (harbour
     swifts) and 'snow' (the penalty game's snowfall reads it), which keep their values.
     The land shops (bigger islands, 240 ids, 14 pets; the games never read these either):
     trisVisited = the visited island's own triangle budget, its items and terrain (D106: over
     it, isles-view draws the repeatable decor, then every item without a live act, from its LOD1
     template); trisRest = the visited island plus the islands kept at LOD0 at rest, nearest
     first, the others drawing their LOD1 bakes (D89; 0 on LOW, which always bakes); crewRigs =
     the pet rigs out at once, one draw call each (D97: the runner and a rotation of the crew);
     landMascots = how many of a visited land's own mascots it hosts beside the runner, counted
     inside crewRigs (D112). */
  var BUDGETS = {
    LOW: {
      tier: 'LOW', pixelRatioCap: 1.0, antialias: false,
      drawCalls: 70, tris: 60000, gameDrawCalls: 60, gameTris: 50000,
      programs: 12, particles: 128, confetti: 120, bubbles: 24, petals: 40, snow: 60,
      stars: 120, crowd: 30, shadows: false, shadowMapSize: 0, outlines: false,
      bloom: false, segScale: 0.7, textureMB: 8,
      cityBuildings: 30, birds: 4, boats: 2, lanterns: 8, reflections: 4, terrainSpacing: 0.5,
      isleMode: 'bake', waterFps: 4, fallsCubes: 0, critters: 6, clouds: 6, balloons: 1, skyBirds: 3,
      snowCubes: 0, fireflies: 0, starCubes: 0, previewTris: 4000, voxPrograms: 7,
      callsHome: 30, callsMap: 45, trisHome: 40000, trisWorst: 58000,
      trisVisited: 36000, trisRest: 0, crewRigs: 4, landMascots: 1
    },
    MID: {
      tier: 'MID', pixelRatioCap: 2, antialias: true,         /* 1.5 until the crisp kit (C5); the 'pixelRatio' step returns to 1.5 */
      drawCalls: 100, tris: 120000, gameDrawCalls: 90, gameTris: 100000,
      programs: 16, particles: 256, confetti: 120, bubbles: 24, petals: 40, snow: 100,
      stars: 250, crowd: 60, shadows: true, shadowMapSize: 1024, outlines: true,
      bloom: false, segScale: 1, textureMB: 8,
      cityBuildings: 60, birds: 7, boats: 4, lanterns: 16, reflections: 6, terrainSpacing: 0.25,
      isleMode: 'merger', waterFps: 8, fallsCubes: 50, critters: 14, clouds: 12, balloons: 2, skyBirds: 6,
      snowCubes: 30, fireflies: 16, starCubes: 60, previewTris: 4000, voxPrograms: 9,
      callsHome: 40, callsMap: 60, trisHome: 75000, trisWorst: 100000,
      trisVisited: 60000, trisRest: 80000, crewRigs: 6, landMascots: 2
    },
    HIGH: {
      tier: 'HIGH', pixelRatioCap: 2, antialias: true,
      drawCalls: 150, tris: 200000, gameDrawCalls: 120, gameTris: 150000,
      programs: 16, particles: 512, confetti: 120, bubbles: 24, petals: 40, snow: 150,
      stars: 250, crowd: 60, shadows: true, shadowMapSize: 2048, outlines: true,
      /* bloom is optional on HIGH: UnrealBloomPass at half resolution, only after ≥ 55 fps was measured */
      bloom: 'optional', bloomMinFps: 55, segScale: 1, textureMB: 8,
      cityBuildings: 90, birds: 10, boats: 5, lanterns: 24, reflections: 10, terrainSpacing: 0.125,
      isleMode: 'merger', waterFps: 8, fallsCubes: 100, critters: 20, clouds: 16, balloons: 3, skyBirds: 9,
      snowCubes: 40, fireflies: 32, starCubes: 120, previewTris: 4000, voxPrograms: 9,
      callsHome: 45, callsMap: 70, trisHome: 95000, trisWorst: 150000,
      trisVisited: 90000, trisRest: 130000, crewRigs: 8, landMascots: 2
    }
  };

  /* adaptive quality step-down order; never stepped back up within a session. Each step relieves
     the CPU (draw calls and per-frame work: the character hulls, particles, ambient life, the
     decor idles) or the GPU (fill: pixel ratio, shadow sampling, the sea's light pillars, the
     Showtime cones). AdaptiveQuality takes the next step of the kind the frames show is slow —
     frame work over budget → the next CPU step, a slow cadence with cheap work → the next GPU
     step — and any step left once that kind runs out, so a draw-call-bound device sheds draw
     calls before it is ever judged for the 2D fallback (which still needs every step taken).
     In LADDER order the CPU steps come first: the island's LOW / MID tiers are the CPU-bound ones.
     v3 adds two ISLAND_ONLY steps the games never take (D82): 'isles' (cpu: the islands the child
     is not on drop to their LOD1 bakes) and 'water' (gpu: the water animation freezes). A holder
     that does not declare them (every game) steps exactly as before: AdaptiveQuality passes a
     step its opts.allow refuses over, neither taking nor counting it. */
  var LADDER = ['outlines', 'particles', 'life', 'decor', 'isles', 'pixelRatio', 'shadows', 'water', 'reflections', 'cones'];
  var STEP_KIND = {
    outlines: 'cpu', particles: 'cpu', life: 'cpu', decor: 'cpu', isles: 'cpu',
    pixelRatio: 'gpu', shadows: 'gpu', water: 'gpu', reflections: 'gpu', cones: 'gpu'
  };
  var ISLAND_ONLY = ['isles', 'water'];
  function stepKind(step) { return STEP_KIND[step] || 'gpu'; }

  function parseTier(v) {
    if (typeof v !== 'string') return null;
    var t = v.trim().toUpperCase();
    return TIERS.indexOf(t) >= 0 ? t : null;
  }
  function rank(t) { return TIERS.indexOf(t); }
  function lower(t) { var i = rank(parseTier(t) || 'MID'); return TIERS[Math.max(0, i - 1)]; }
  function minTier(a, b) { return rank(a) <= rank(b) ? a : b; }

  /* ---------------- device facts ----------------
     nav: anything navigator-like {userAgent, platform, maxTouchPoints, hardwareConcurrency}.
     extra: {maxTex, saved, caveat, touch}. iPadOS reports itself as a Mac, so a
     "Mac" with maxTouchPoints > 1 is treated as an iPad. */
  function facts(nav, extra) {
    nav = nav || {}; extra = extra || {};
    var ua = String(nav.userAgent || ''), plat = String(nav.platform || '');
    var mtp = Number(nav.maxTouchPoints) || 0;
    var macLike = /Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(plat);
    var ipadAsMac = macLike && mtp > 1 && !/iPhone|iPad|iPod/i.test(ua);
    var ios = /iPhone|iPad|iPod/i.test(ua) || /^(iPhone|iPad|iPod)/.test(plat) || ipadAsMac;
    var android = /Android/i.test(ua);
    var touch = extra.touch != null ? !!extra.touch : (mtp > 0 || ios || android);
    var cores = Number(nav.hardwareConcurrency);
    return {
      ios: ios, android: android, touch: touch, ipadAsMac: ipadAsMac,
      desktop: !ios && !android && !touch,
      cores: cores > 0 ? cores : 0,
      maxTex: Number(extra.maxTex) > 0 ? Number(extra.maxTex) : 0,
      caveat: !!extra.caveat,
      saved: parseTier(extra.saved)
    };
  }

  /* The tier table (art bible + architecture):
     LOW:  iOS/Android with ≤ 4 cores (or unknown cores), MAX_TEXTURE_SIZE < 8192,
           a software/"major performance caveat" context, or a saved LOW.
     HIGH: a desktop without touch and with ≥ 8 cores.
     MID:  everything else.
     A saved tier is the MEASURED tier from an earlier session: it can only lower
     the decision, never raise it. */
  function explain(f) {
    f = f || {};
    var mobile = !!(f.ios || f.android);
    var t, why;
    if (f.caveat) { t = 'LOW'; why = 'software or low-power GL context'; }
    else if (f.maxTex && f.maxTex < 8192) { t = 'LOW'; why = 'MAX_TEXTURE_SIZE ' + f.maxTex + ' < 8192'; }
    else if (mobile && (!f.cores || f.cores <= 4)) { t = 'LOW'; why = (f.ios ? 'iOS' : 'Android') + ' with ' + (f.cores || 'unknown') + ' cores'; }
    else if (!mobile && !f.touch && f.cores >= 8) { t = 'HIGH'; why = 'desktop, no touch, ' + f.cores + ' cores'; }
    else { t = 'MID'; why = mobile ? 'mobile with ' + f.cores + ' cores' : (f.touch ? 'touch device' : 'desktop with ' + (f.cores || 'unknown') + ' cores'); }
    var saved = parseTier(f.saved);
    if (saved && rank(saved) < rank(t)) { why = 'saved ' + saved + ' (decided ' + t + ': ' + why + ')'; t = saved; }
    return { tier: t, why: why };
  }
  function decide(f) { return explain(f).tier; }

  /* ---------------- the crisp pixel ratio (crisp kit C5) ----------------
     The render scale is picked so the browser's upscale of the canvas to the screen is either
     none or an exact whole number n, and a whole-number upscale is drawn nearest-neighbour
     (pixelated: every rendered pixel becomes an n×n block, so the voxel edges stay sharp
     instead of the blur of a 2.67× smooth stretch). q = dpr / cap:
       q ≤ 1          the screen's own ratio, no upscale                  {dpr, 1, false}
       q < 1.75       the cap, a mild smooth upscale (as before C5)      {cap, 1, false}
       otherwise      n = round(q), one more if dpr / n is over the cap  {dpr / n, n, true}
     LOW at DPR 2 (an iPad) renders 1.0 drawn ×2 pixelated; LOW at DPR 2.625 renders 0.875 ×3
     (cheaper than the 1.0 before); MID at DPR 2 renders 2.0 with no upscale. n > 1 only when
     pixelated. A cap that is not a positive number counts as 1. */
  function crispRatio(dpr, cap) {
    var d = Number(dpr) > 0 && isFinite(Number(dpr)) ? Number(dpr) : 1;
    var c = Number(cap) > 0 && isFinite(Number(cap)) ? Number(cap) : 1;
    var q = d / c;
    if (q <= 1) return { ratio: d, n: 1, pixelated: false };
    if (q < 1.75) return { ratio: c, n: 1, pixelated: false };
    var n = Math.round(q);
    if (d / n > c) n++;
    return { ratio: d / n, n: n, pixelated: true };
  }
  /* where the adaptive ladder's one 'pixelRatio' step goes from `ratio`: a ratio above 1.5
     (MID / HIGH at 2) goes to exactly 1.5, smooth (the MID look before C5); anything lower
     re-picks a crisp ratio under three quarters of it (LOW at DPR 1: 0.75 as before; LOW at
     DPR 2: 0.667 drawn ×3 pixelated, where the old 0.75 was a blurry ×2.67) */
  var STEP_TO = 1.5;
  function stepRatio(dpr, ratio) {
    var r = Number(ratio) > 0 ? Number(ratio) : 1;
    if (r > STEP_TO) return { ratio: STEP_TO, n: 1, pixelated: false };
    return crispRatio(dpr, r * 0.75);
  }

  /* a fresh budget object for one tier; pixelRatio / pixelated = crispRatio(dpr, cap) */
  function budget(tier, dpr) {
    var b = BUDGETS[parseTier(tier) || 'MID'], out = {};
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    var c = crispRatio(dpr, b.pixelRatioCap);
    out.pixelRatio = c.ratio;
    out.pixelated = c.pixelated;
    return out;
  }

  /* ---------------- AdaptiveQuality ----------------
     Rolling 120-frame averages of work time (update + render CPU) and of frame
     intervals. If they imply more than 24 ms per frame for 2 s, step down once
     (at most one step per 2 s): the first step left in LADDER of the slow kind —
     'cpu' when the average work is over 24 ms, else 'gpu' — or, once that kind
     is used up, the first step left of any kind. A steady ~33 ms cadence with low
     variance and cheap work is a 30 Hz cap (iOS Low Power Mode), not slowness.
     After every step is taken, frame rates under 20 fps sustained for
     fallbackHoldMs give the 'fallback' verdict (the caller switches to 2D).
     Only SUSTAINED slowness counts:
     - warm-up: the first warmupMs after every reset (a loop (re)start, a 60↔30
       switch, a step) is not measured — that is where one-off work lands
       (uploads, shader links, a rebuild after a context restore, the program
       recompile a step itself causes);
     - hitches: a frame whose interval or work is over hitchMs is a one-off stall
       (GC, a compile, a tab switch) and is skipped, unless the stalls run back to
       back for hitchSustainMs (then the device really is that slow and they count);
     - the 2 s hold (and the fallback hold) starts at the first slow verdict, never
       backdated over the window, so a few long frames in a short first window
       cannot satisfy it on their own.
     opts.allow(step) → bool (D82) is asked whenever a step is picked: a refused step is passed
     over (neither taken nor counted), and 'fallback' needs only every ALLOWED step taken. It is
     asked afresh each time, so a step refused while a game held the renderer is still there
     for the island once it is handed back. */
  function AdaptiveQuality(opts) {
    opts = opts || {};
    var N = opts.window || 120;
    var slowMs = opts.slowMs || 24;
    var holdMs = opts.holdMs != null ? opts.holdMs : 2000;
    var stepGapMs = opts.stepGapMs != null ? opts.stepGapMs : 2000;
    var fallbackFps = opts.fallbackFps || 20;
    var fallbackHoldMs = opts.fallbackHoldMs != null ? opts.fallbackHoldMs : 3000;
    var minSamples = opts.minSamples || 30;
    var warmupMs = opts.warmupMs != null ? opts.warmupMs : 500;
    var hitchMs = opts.hitchMs != null ? opts.hitchMs : 250;
    var hitchSustainMs = opts.hitchSustainMs != null ? opts.hitchSustainMs : 1000;
    var ladder = (opts.ladder || LADDER).slice();
    var skip = opts.skip || [];          /* steps that are already "off" on this tier (e.g. LOW has no shadows) */
    var allow = typeof opts.allow === 'function' ? opts.allow : null;

    var work = new Float64Array(N), intv = new Float64Array(N);
    var head = 0, count = 0, sumW = 0, sumI = 0, sumI2 = 0, firstAt = -1, startAt = -1, hitchRun = 0, hitches = 0;
    var slowSince = -1, lowSince = -1, lastStepAt = -Infinity;
    var taken = [], failed = false, lowPower = false;
    ladder.forEach(function (s) { if (skip.indexOf(s) >= 0) taken.push(s); });

    /* a throwing allow() never blocks a games' step, and never grants an island-only one */
    function allowed(step) {
      if (!allow) return true;
      try { return !!allow(step); } catch (e) { return ISLAND_ONLY.indexOf(step) < 0; }
    }
    function open(step) { return taken.indexOf(step) < 0 && allowed(step); }
    /* is any allowed step left? (no allocation: this runs every frame) */
    function pending() {
      for (var i = 0; i < ladder.length; i++) if (open(ladder[i])) return true;
      return false;
    }

    function reset() {
      head = 0; count = 0; sumW = 0; sumI = 0; sumI2 = 0; firstAt = -1; startAt = -1; hitchRun = 0;
      slowSince = -1; lowSince = -1; lowPower = false;
    }
    function push(w, i, now) {
      if (count === N) {               /* evict the oldest sample */
        var ow = work[head], oi = intv[head];
        sumW -= ow; sumI -= oi; sumI2 -= oi * oi;
      } else count++;
      work[head] = w; intv[head] = i;
      sumW += w; sumI += i; sumI2 += i * i;
      head = (head + 1) % N;
      if (firstAt < 0) firstAt = now;
    }
    function stats() {
      var aw = count ? sumW / count : 0, ai = count ? sumI / count : 0;
      var v = count ? Math.max(0, sumI2 / count - ai * ai) : 0;
      return {
        samples: count, avgWork: aw, avgInterval: ai, sdInterval: Math.sqrt(v),
        fps: ai > 0 ? 1000 / ai : 0, lowPower: lowPower, hitches: hitches,
        steps: taken.slice(), level: taken.length, done: !pending(), failed: failed
      };
    }
    /* workMs: CPU time of the frame; intervalMs: time since the previous rendered
       frame; targetMs: the pacer's intended interval (16.7 at 60 fps, 33.3 when
       idling at 30). Returns null or {type:'step', step, level} or {type:'fallback', why}. */
    function sample(workMs, intervalMs, nowMs, targetMs) {
      if (failed) return null;
      if (!(intervalMs > 0) || intervalMs > 1000 || !(workMs >= 0)) { reset(); return null; }   /* a pause, not a frame */
      if (startAt < 0) startAt = nowMs;
      if (nowMs - startAt < warmupMs) return null;                       /* warm-up after a (re)start */
      if (intervalMs > hitchMs || workMs > hitchMs) {
        hitchRun += intervalMs;
        if (hitchRun < hitchSustainMs) { hitches++; return null; }        /* a one-off stall, not the frame rate */
      } else hitchRun = 0;
      push(workMs, intervalMs, nowMs);
      var enough = count >= minSamples || (count >= 6 && nowMs - firstAt >= holdMs);
      if (!enough) return null;
      /* averages inline: this runs every frame and must not allocate */
      var aw = sumW / count, ai = sumI / count;
      var sd = Math.sqrt(Math.max(0, sumI2 / count - ai * ai));
      var target = targetMs > 0 ? targetMs : 1000 / 60;
      /* 30 Hz low-power cadence: steady ~33 ms intervals with cheap work, while we asked for faster */
      lowPower = target < 30 && Math.abs(ai - 1000 / 30) <= 4 && sd <= 4 && aw <= slowMs;
      var intLimit = Math.max(slowMs, target * 1.35);
      var slow = aw > slowMs || (ai > intLimit && !lowPower);

      if (pending()) {
        lowSince = -1;                   /* a step came back (the island was handed the renderer): no stale fallback hold */
        if (!slow) { slowSince = -1; return null; }
        /* the hold clock starts at this verdict: the average must STAY slow for holdMs
           while fresh frames roll in (a short first window is easily skewed) */
        if (slowSince < 0) slowSince = nowMs;
        if (nowMs - slowSince >= holdMs && nowMs - lastStepAt >= stepGapMs) {
          /* the bottleneck: the frame's own work (update + draw submission) or the cadence */
          var kind = aw > slowMs ? 'cpu' : 'gpu', step = null, li;
          for (li = 0; li < ladder.length && step === null; li++) if (open(ladder[li]) && stepKind(ladder[li]) === kind) step = ladder[li];
          for (li = 0; li < ladder.length && step === null; li++) if (open(ladder[li])) step = ladder[li];
          taken.push(step);
          lastStepAt = nowMs;
          reset();                       /* judge the next step on fresh frames */
          return { type: 'step', step: step, level: taken.length, kind: kind };
        }
        return null;
      }
      /* every allowed step taken: sustained < 20 fps (by cadence or by work) → fallback */
      var limit = 1000 / fallbackFps;
      var veryslow = ai > limit || aw > limit;
      if (!veryslow) { lowSince = -1; return null; }
      if (lowSince < 0) lowSince = nowMs;
      if (nowMs - lowSince >= fallbackHoldMs) {
        failed = true;
        return { type: 'fallback', why: 'performance' };
      }
      return null;
    }
    return {
      sample: sample, reset: reset, stats: stats,
      get steps() { return taken.slice(); },
      get level() { return taken.length; },
      get done() { return !pending(); },
      get failed() { return failed; },
      get lowPower() { return lowPower; },
      has: function (step) { return taken.indexOf(step) >= 0; },
      ladder: ladder.slice()
    };
  }

  /* ---------------- FramePacer ----------------
     Decides, on every display tick, whether to render. Caps fast screens
     (90/120/144 Hz) at 60 fps on average, drops to 30 fps after 20 s without
     input and returns to 60 on the next input, and under reduced motion
     renders only on demand (when something animates or invalidate() was called). */
  function FramePacer(opts) {
    opts = opts || {};
    var fps = opts.fps || 60, idleFps = opts.idleFps || 30;
    var idleAfterMs = opts.idleAfterMs != null ? opts.idleAfterMs : 20000;
    var tol = opts.tolMs != null ? opts.tolMs : 2;
    var reduced = !!opts.reduced;
    var lastInput = null, nextDue = null, dirty = true, renders = 0;

    function idle(now) { return lastInput != null && now - lastInput >= idleAfterMs; }
    function targetFps(now) { return idle(now) ? idleFps : fps; }
    function interval(now) { return 1000 / targetFps(now); }
    function tick(now, animating) {
      if (lastInput == null) lastInput = now;   /* the idle clock starts at the first tick */
      if (reduced && animating === false && !dirty) return false;
      var iv = interval(now);
      if (nextDue == null) nextDue = now;
      if (now < nextDue - tol) return false;
      nextDue += iv;
      if (nextDue < now - tol) nextDue = now + iv;   /* fell behind (a hitch): don't burst to catch up */
      dirty = false; renders++;
      return true;
    }
    function input(now) {
      var wasIdle = idle(now);
      lastInput = now;
      dirty = true;
      if (wasIdle || nextDue == null || nextDue > now + 1000 / fps) nextDue = now;   /* render on the next tick */
      return wasIdle;
    }
    return {
      tick: tick, input: input,
      invalidate: function () { dirty = true; },
      setReduced: function (on) { reduced = !!on; dirty = true; },
      reset: function (now) { nextDue = null; dirty = true; if (now != null) lastInput = now; },
      idle: idle, targetFps: targetFps, interval: interval,
      get reduced() { return reduced; },
      get dirty() { return dirty; },
      get renders() { return renders; }
    };
  }

  return {
    TIERS: TIERS, BUDGETS: BUDGETS, LADDER: LADDER, STEP_KIND: STEP_KIND, ISLAND_ONLY: ISLAND_ONLY, stepKind: stepKind,
    facts: facts, decide: decide, explain: explain, budget: budget, crispRatio: crispRatio, stepRatio: stepRatio,
    lower: lower, minTier: minTier, parseTier: parseTier,
    AdaptiveQuality: AdaptiveQuality, FramePacer: FramePacer
  };
}));
