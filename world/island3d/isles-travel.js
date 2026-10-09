/* ================================================================
   My Island v3 — SLIslesTravel: every trip between the sky islands (W4.2b, plan-v3 D74).
   window.SLIslesTravel (classic script); require() in Node gives the same object. It owns no THREE
   and no DOM of its own: it drives what island3d hands it (the v3 camera rig, SLSky3D, the actors,
   the scene's policy hooks and the stage's .slw-skydip div), so the whole state machine runs in Node
   against stubs. island3d's v3 path delegates to it: visits, the land unlock reveal, the Sky map,
   the Sky tour and its skip, the sky dip, the superseding promises and the tap routing.
   Nothing here reads, awards or spends points, stores anything or sends anything anywhere.

   create(o) → travel                                         (contracts.islesTravel)
     o.rig            the camera rig (SLIslandCamera.Rig, profile 'v3'): fly(isle, {reduced}),
                      skyMap(on, {reduced}), intro(), skip(), onDip(fn). Its running trip (rig.trip,
                      else info().trip) is read for the flight time and for busy. travel owns
                      rig.onDip: nothing else may register a dip handler.
     o.sky            SLSky3D: setVisit, setSkyMap, peek, buildBridge, wakeIsle (skyColor)
     o.actors         follow({isle, flight, instant}) → crossing s, setIsle(isle)
     o.view()         → the islandView of the scene's last sync (isle, unlockedIsles)
     o.policy(state)  → {isle: {lod, live, mode, terrain, …}}: the scene's wrapper over
                      SLIslesView.policy. It adds tier, quality, unlocked, cameraPos and the triangle
                      counts, passes state.visit and state.skyMap through, and draws every island in
                      state.pending as a preview (mode 'preview') until it wakes.
     o.apply(policyByIsle)   the scene re-batches, bakes or hides per island. Called on take-off
                      (the work runs in its time slices during the flight) and again on landing:
                      it must be idempotent.
     o.setLive(isle | null)  the island whose idles, acts, water and critters tick; null while the
                      Sky map or the Sky tour shows LOD1 bakes everywhere and every idle is parked
     o.routeTap(hit, {mode, visit, skyMap}) → route   (default: SLIslesView.routeTap when loaded)
     o.reduced()      → bool, read at every call (the stage's reduced-motion state)
     o.dipEl          the .slw-skydip div inside .slw-3d (the stage owns it; island-pixel.css fades
                      its opacity 0.3 s each way; travel sets --slw-dip and toggles .on)
     o.skyColor()     → '#RRGGBB' the dip colour (default: sky.skyColor(), the backdrop's mid band)
     o.on {arrive(isle), leave(isle), announce?(kind, isle)}
     optional:
       o.landmark(isle) → Promise | seconds   the scene drops that island's landmark in: the
                      'dropIn' controller anim on its copy (whose own cue puffs the dust where it
                      lands; NEW! is the host's anchor tag). Called after the island woke and went
                      live, so the scene starts it as soon as that copy exists.
       o.sound(name, vol)    flight sounds: 'whoosh' 0.35 at take-off and 'chip' 0.4 on landing;
                      a sky dip plays 'chip' only, at its cut (sky-world sound.flights)
       o.later(fn, ms) → handle · o.clear(handle)   the timers (default setTimeout / clearTimeout)
       o.visit        the island the scene mounted on and made live (default view().isle, 'home')
   → {visitIsle(isle, {instant}) → Promise<bool>, unlockIsle(isle) → Promise<bool>, skyMap(on) →
      Promise<bool>, intro() → Promise<bool>, skip() → bool, pick(hit, mode) → route, state(),
      info(), dispose(), busy (getter), visit (getter), skyMapOn (getter)}

   RULES
     Superseding: every call bumps a sequence number; the older promise resolves false (never
       rejects) and the newest call's end state wins. A superseded unlock still finishes the land
       at once in the background (bridge, wake, no landmark drop), so nothing is left half-built.
       skyMap(on) heading where the map already is (or goes) shares that promise / resolves true.
       An unknown island, or a call after dispose(), resolves false and supersedes nothing.
     visitIsle: rig.fly (D44: T = min(2.4, 1.2 + 0.045 × travel u)); on take-off the island that
       was live leaves, the policy is applied for the destination, a locked destination is peeked
       at (sky.peek, the one being left is restored) and the active pet sets off with the flight
       (actors.follow({isle, flight: T}), D29 / D83); on landing the destination goes live
       (sky.setVisit, setLive, on.arrive). {instant} or reduced motion: the sky dip (D45) — rig
       phases 'in' (the div fades in, in the sky's colour), 'cut' (every change above happens here,
       behind the opaque dip, the pet appears at the dock) and 'out'; it resolves after the fade.
       The island already live (no Sky map): the rig only re-centres; nothing leaves or arrives.
     unlockIsle: fly there (the land stays a pending preview), sky.setVisit, sky.buildBridge
       (≤ 2.4 s, its own unlock / coin / tada cues), sky.wakeIsle, then the policy without the
       pending flag, the island goes live, the pet crosses the new bridge, the landmark drops in
       (o.landmark) and it resolves true. No full-screen white anywhere. Reduced motion: the camera
       dips there and every step happens at once; it resolves true at once on the end state.
     skyMap(on): rig.skyMap; on take-off sky.setSkyMap (uFogMax → 0, D8) and the policy with skyMap
       (LOD1 bakes everywhere, D42); on the island parks; off lands it live again.
     intro(): the Sky tour (rig.intro: the map pose at yaw −8°, hold 0.9 s, fly 2.2 s); the policy
       treats it as the Sky map until it lands. Any tap, key or chip calls skip() (rig.skip: the
       end pose in 0.35 s, D83). Never under reduced motion (resolves true at once, nothing moves).
     pick(hit, mode): while a trip or the unlock reveal runs a tap only skips (rig.skip) and picks
       nothing ({kind: 'none', skipped}); otherwise it is routeTap(hit, {mode, visit, skyMap}).
       island3d turns a route to another island's body / bridge / gate into on.tapIsle / on.tapLand.
     on.leave(isle) / on.arrive(isle): one live island at a time; every leave follows its arrive.
       on.announce(kind 'visit' | 'unlock' | 'map' | 'unmap', isle) once per landed trip: the host's
       goIsle announces its own trips (#slwLive), so the scene forwards it only where it wants.
     Every promise settles on its own: each step waits for its promise or its expected time + 1 s,
       and every trip lands in its end state by DEADLINE (visit 3.25 s, unlock 7.75 s, map 2.75 s,
       tour 4.6 s of real time), inside the host's FALLBACK timers (3.5 / 8 / 3 s, D44), which stay
       authoritative. A rig that never moves (paused frames) catches up when frames run again.
     state() → {visit, skyMap (the map or the tour: LOD1 everywhere), map, tour, pending [isle],
       live, trip 'visit' | 'unlock' | 'map' | 'tour' | null, from}: island3d passes it to its
       policy wrapper on every sync too, so a sync never fights a trip.
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIslesTravel = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var SKY = ['pier', 'jungle', 'treetop', 'castle', 'ice'], ISLES = ['home'].concat(SKY);
  /* the host's fallback timers (D44): the host races its s3() calls with these, and they win */
  var FALLBACK = { visitIsle: 3.5, unlockIsle: 8, skyMap: 3 };
  /* this module lands every trip in its end state by these (s of real time), inside FALLBACK */
  var DEADLINE = { visit: 3.25, unlock: 7.75, map: 2.75, tour: 4.6 };
  /* a step waits for its promise, or its expected seconds + GUARD */
  var GUARD = 1;
  /* expected seconds when the rig or the sky cannot say (contracts.camera V3, SLMotion.BRIDGE_BUILD,
     isles-gl PREVIEW.peekSec, motion dropIn) */
  var SEC = { flight: 2.4, dip: 0.6, build: 2.4, wake: 0.6, drop: 0.55, tour: 3.1 };
  var SOUND = { takeoff: ['whoosh', 0.35], land: ['chip', 0.4] };
  var HEX = /^#[0-9a-fA-F]{6}$/;

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function thenable(p) { return !!p && (typeof p === 'object' || typeof p === 'function') && typeof p.then === 'function'; }
  function done(v) { return Promise.resolve(v); }
  /* a hook call that never throws into a trip */
  function safe(fn, self, a, b, c) {
    if (typeof fn !== 'function') return undefined;
    try { return fn.call(self, a, b, c); } catch (e) { return undefined; }
  }
  function call(obj, name, a, b, c) { return obj ? safe(obj[name], obj, a, b, c) : undefined; }
  /* SLIslesView (loaded just before this file; required lazily in Node), kept once found */
  var viewMod = null;
  function islesView() {
    if (viewMod) return viewMod;
    var v = root && root.SLIslesView;
    if (!v && typeof module === 'object' && module.exports && typeof require === 'function') { try { v = require('./isles-view.js'); } catch (e) { v = null; } }
    return (viewMod = v || null);
  }

  function create(o) {
    o = o || {};
    var rig = o.rig || null, sky = o.sky || null, actors = o.actors || null, on = o.on || {};
    var later = typeof o.later === 'function' ? o.later : function (fn, ms) { return setTimeout(fn, ms); };
    var clear = typeof o.clear === 'function' ? o.clear : function (h) { clearTimeout(h); };
    var seq = 0, job = null, disposed = false;
    var stats = { trips: 0, superseded: 0, late: 0, dips: 0 };

    /* ---------------- reading the scene ---------------- */
    function viewNow() {
      var v = safe(o.view);
      return v && typeof v === 'object' ? v : null;
    }
    function reduced() { return typeof o.reduced === 'function' ? !!safe(o.reduced) : !!o.reduced; }
    /* a land is locked when the last sync's unlockedIsles leaves it out (no view: open) */
    function locked(isle) {
      if (isle === 'home') return false;
      var v = viewNow(), u = v && v.unlockedIsles;
      return Array.isArray(u) ? u.indexOf(isle) < 0 : false;
    }
    var v0 = viewNow(), first = ISLES.indexOf(o.visit) >= 0 ? o.visit : v0 && ISLES.indexOf(v0.isle) >= 0 ? v0.isle : 'home';
    /* visit: the island being visited (the destination of the newest visit or unlock); live: the one
       that arrived and has not left; map / tour: the overview poses; pending: the land being unlocked
       (still a preview); peek: the locked land being looked at; from: the island the trip left */
    var st = { visit: first, live: first, map: false, tour: false, pending: null, peek: null, from: null };

    /* the rig's running trip: the object (rig.trip), its kind (info().trip), null, or undefined (unknown) */
    function rigTrip() {
      if (!rig) return null;
      if ('trip' in rig) return rig.trip || null;
      var i = call(rig, 'info');
      return i && typeof i === 'object' && 'trip' in i ? i.trip || null : undefined;
    }
    function newTrip(before) { var t = rigTrip(); return t === undefined ? true : !!t && t !== before; }
    /* a trip is on screen (a new one, or one this call carries on with) */
    function flying() { var t = rigTrip(); return t === undefined || !!t; }
    /* the running trip's length (the hold of the tour included); a sky dip is DIP in + out */
    function tripSec(dflt) {
      var T = rig && rig.trip;
      if (T && typeof T === 'object') {
        if (T.dip) return SEC.dip;
        if (T.sec > 0) return num(T.hold, 0) + T.sec;
      }
      return dflt;
    }
    function rigCall(name, a, b) {
      var p = rig ? call(rig, name, a, b) : undefined;
      return thenable(p) ? p : done(p !== false);
    }
    function sound(pair) { if (typeof o.sound === 'function') safe(o.sound, null, pair[0], pair[1]); }
    function hook(name, a, b) { safe(on[name], on, a, b); }
    function colour() {
      var c = typeof o.skyColor === 'function' ? safe(o.skyColor) : call(sky, 'skyColor');
      return typeof c === 'string' && HEX.test(c) ? c : null;
    }

    /* ---------------- the sky dip: the rig's phases on the stage's div ---------------- */
    function dipOn(show) {
      var el = o.dipEl;
      if (!el) return;
      try {
        if (show) {
          var c = colour();
          if (c && el.style && typeof el.style.setProperty === 'function') el.style.setProperty('--slw-dip', c);
          el.classList.add('on');
        } else el.classList.remove('on');
      } catch (e) {}
    }
    function onDip(phase) {
      if (disposed) return;
      if (phase === 'in') dipOn(true);
      else if (phase === 'out') dipOn(false);
      else if (phase === 'cut') cut();
    }
    /* the dip is opaque: the trip's whole island switch happens now, unseen */
    function cut() {
      var J = job;
      if (!J || J.over || !J.dip || J.cut) return;
      J.cut = true;
      takeOff(J);
      land(J);
      sound(SOUND.land);
    }
    if (rig && typeof rig.onDip === 'function') safe(rig.onDip, rig, onDip);

    /* ---------------- liveness, policy, the pet ---------------- */
    function state() {
      var J = job && !job.over ? job : null;
      return { visit: st.visit, skyMap: st.map || st.tour, map: st.map, tour: st.tour, pending: st.pending ? [st.pending] : [],
        live: st.live, trip: J ? J.kind : null, from: J ? st.from : null };
    }
    function applyPolicy() {
      if (typeof o.policy !== 'function' || typeof o.apply !== 'function') return;
      var p = safe(o.policy, null, state());
      if (p && typeof p === 'object') safe(o.apply, null, p);
    }
    function park() {
      if (st.live == null) return;
      var k = st.live;
      st.live = null;
      hook('leave', k);
      safe(o.setLive, null, null);
    }
    function arrive(k) {
      if (st.live === k) return;
      park();
      st.live = k;
      call(sky, 'setVisit', k);
      safe(o.setLive, null, k);
      hook('arrive', k);
    }
    function peekAt(k) {
      if (st.peek && st.peek !== k) { call(sky, 'peek', st.peek, false); st.peek = null; }
      if (k && !st.peek && locked(k)) { st.peek = k; call(sky, 'peek', k, true); }
    }
    /* the active pet: crosses with the flight (D29 / D83); appears at the dock at a cut */
    function follow(J, instant) {
      if (!actors) return;
      if (instant && typeof actors.setIsle === 'function') { safe(actors.setIsle, actors, J.isle); return; }
      J.crossing = num(call(actors, 'follow', { isle: J.isle, flight: instant ? 0 : tripSec(SEC.flight), instant: !!instant }), 0);
    }

    /* ---------------- jobs ---------------- */
    function timer(J, sec, fn) {
      var h = later(function () {
        var i = J.timers.indexOf(h);
        if (i >= 0) J.timers.splice(i, 1);
        fn();
      }, Math.max(0, sec) * 1000);
      J.timers.push(h);
      return h;
    }
    /* wait for a step: p = its promise (raced with sec of real time), a number of seconds, or
       anything else (no wait: the step had nothing to wait for). A job that is over ends every wait
       at once → 'ok' | 'late' | 'gone' (a rejection counts as 'ok': the step ended) */
    function wait(J, p, sec) {
      return new Promise(function (res) {
        var h = null, fin = function (v) {
          if (fin.done) return;
          fin.done = true;
          if (h != null) { var i = J.timers.indexOf(h); if (i >= 0) J.timers.splice(i, 1); clear(h); }
          var w = J.waits.indexOf(fin);
          if (w >= 0) J.waits.splice(w, 1);
          res(v);
        };
        var promised = thenable(p), s = promised ? sec : num(p, 0);
        if (J.over) { fin('gone'); return; }
        if (!promised && !(s > 0)) { fin('ok'); return; }
        J.waits.push(fin);
        if (promised) p.then(function () { fin('ok'); }, function () { fin('ok'); });
        if (s > 0) h = timer(J, s, function () { h = null; if (promised) J.late = true; fin(promised ? 'late' : 'ok'); });
      });
    }
    function settle(J, v) {
      if (J.over) return;
      J.over = true;
      J.timers.splice(0).forEach(function (h) { clear(h); });
      J.waits.slice().forEach(function (f) { f('gone'); });
      if (v && J.late) stats.late++;
      J.resolve(!!v);
    }
    function newJob(kind, isle, x) {
      var J = { seq: ++seq, kind: kind, isle: isle, dip: false, flew: false, same: false, off: false, landed: false, cut: false, over: false,
        step: 'start', timers: [], waits: [], crossing: 0 }, k, prev = job;
      for (k in x) J[k] = x[k];
      J.promise = new Promise(function (res) { J.resolve = res; });
      job = J;
      stats.trips++;
      if (prev && !prev.over) {
        stats.superseded++;
        if (prev.kind === 'unlock') finishLand(prev);         /* the land never stays half-built */
        if (prev.kind === 'tour') st.tour = false;
        settle(prev, false);
      }
      timer(J, DEADLINE[kind], function () {
        if (J.over) return;
        J.late = true;
        takeOff(J);
        land(J);
        if (J.kind === 'unlock') { finishLand(J); wake(J); }      /* the landmark is simply there */
        settle(J, true);
      });
      return J;
    }

    /* take-off: what the trip changes before the camera moves (at the cut for a dip) */
    function takeOff(J) {
      if (J.off) return;
      J.off = true;
      if (J.kind === 'map') {
        if (J.on) { st.tour = false; st.map = true; park(); call(sky, 'setSkyMap', true); }
        else { st.map = false; call(sky, 'setSkyMap', false); }
        applyPolicy();
        return;
      }
      if (J.kind === 'tour') {
        if (st.map) { st.map = false; call(sky, 'setSkyMap', false); }
        st.tour = true;
        park();
        applyPolicy();
        return;
      }
      /* a visit or an unlock */
      if (st.map) { st.map = false; call(sky, 'setSkyMap', false); }
      st.tour = false;
      if (J.same) return;
      park();
      st.from = st.visit; st.visit = J.isle;
      if (J.kind === 'unlock') st.pending = J.isle;
      else peekAt(J.isle);
      applyPolicy();
      if (J.kind === 'visit') follow(J, J.dip);
    }
    /* landing: the destination goes live (an unlock lands in wake()) */
    function land(J) {
      if (J.landed) return;
      J.landed = true;
      if (J.flew && !J.dip) sound(SOUND.land);
      if (J.kind === 'visit') {
        if (J.same) return;
        arrive(J.isle);
        applyPolicy();
        hook('announce', 'visit', J.isle);
      } else if (J.kind === 'map') {
        if (!J.on) { arrive(st.visit); applyPolicy(); }
        hook('announce', J.on ? 'map' : 'unmap', st.visit);
      } else if (J.kind === 'tour') {
        st.tour = false;
        applyPolicy();
        arrive(st.visit);
      } else if (J.kind === 'unlock') call(sky, 'setVisit', J.isle);
    }
    /* an unlock's land in its end state, at once (deadline, supersede, reduced motion) */
    function finishLand(J) {
      if (!J.bridge) { J.bridge = true; call(sky, 'buildBridge', J.isle); }
      if (!J.woke) { J.woke = true; call(sky, 'wakeIsle', J.isle); }
      if (st.pending === J.isle) st.pending = null;
      if (st.peek === J.isle) { st.peek = null; call(sky, 'peek', J.isle, false); }
    }
    /* the land is awake: its items draw, it goes live, the pet crosses the new bridge */
    function wake(J) {
      if (J.awake) return;
      J.awake = true;
      if (st.pending === J.isle) st.pending = null;
      if (st.peek === J.isle) { st.peek = null; call(sky, 'peek', J.isle, false); }
      applyPolicy();
      arrive(J.isle);
      if (actors) J.crossing = num(call(actors, 'follow', { isle: J.isle, instant: reduced() }), 0);
    }

    /* ---------------- the API ---------------- */
    function visitIsle(isle, opt) {
      if (disposed || ISLES.indexOf(isle) < 0) return done(false);
      var dip = !!(opt && opt.instant) || reduced(), before = rigTrip();
      var J = newJob('visit', isle, { dip: dip, same: st.live === isle && !st.map && !st.tour });
      var p = rigCall('fly', isle, { reduced: dip });
      J.flew = !J.same && flying();
      if (dip) stats.dips++;
      else { takeOff(J); if (!J.same && newTrip(before)) sound(SOUND.takeoff); }
      J.step = 'fly';
      wait(J, p, tripSec(dip ? SEC.dip : SEC.flight) + GUARD).then(function () {
        if (J.over) return;
        takeOff(J);
        land(J);
        settle(J, true);
      });
      return J.promise;
    }
    function unlockIsle(isle) {
      if (disposed || SKY.indexOf(isle) < 0) return done(false);
      var red = reduced(), before = rigTrip(), there = st.visit === isle && !st.map && !st.tour;
      var J = newJob('unlock', isle, { dip: red });
      var p = rigCall('fly', isle, { reduced: red });
      J.flew = !there && flying();
      var whoosh = !there && newTrip(before);
      takeOff(J);
      if (red) {
        /* reduced motion: the camera dips there; every step is its end state now */
        stats.dips++;
        land(J);
        finishLand(J);
        wake(J);
        J.step = 'landmark';
        safe(o.landmark, null, isle);
        hook('announce', 'unlock', isle);
        settle(J, true);
        return J.promise;
      }
      if (whoosh) sound(SOUND.takeoff);
      J.step = 'fly';
      wait(J, p, tripSec(SEC.flight) + GUARD).then(function () {
        if (J.over) return;
        land(J);
        J.step = 'bridge';
        J.bridge = true;
        var b = call(sky, 'buildBridge', isle);
        return wait(J, b, num(b && b.dur, SEC.build) + GUARD);
      }).then(function () {
        if (J.over) return;
        J.step = 'wake';
        J.woke = true;
        return wait(J, call(sky, 'wakeIsle', isle), SEC.wake + GUARD);
      }).then(function () {
        if (J.over) return;
        wake(J);
        J.step = 'landmark';
        var d = safe(o.landmark, null, isle);
        return wait(J, thenable(d) ? d : Math.min(num(d, 0), SEC.drop + GUARD), SEC.drop + GUARD);
      }).then(function () {
        if (J.over) return;
        hook('announce', 'unlock', isle);
        settle(J, true);
      });
      return J.promise;
    }
    function skyMap(onOff) {
      if (disposed) return done(false);
      var want = !!onOff, J0 = job && !job.over ? job : null;
      if (J0 && J0.kind === 'map' && J0.on === want) return J0.promise;          /* on its way already */
      if (!J0 && st.map === want) return done(true);                             /* already there */
      if (!want && !st.map && !(J0 && J0.kind === 'map')) return done(true);     /* not in the map: nothing to close */
      var dip = reduced(), before = rigTrip();
      var J = newJob('map', st.visit, { on: want, dip: dip });
      var p = rigCall('skyMap', want, { reduced: dip });
      J.flew = flying();
      if (dip) stats.dips++;
      else { takeOff(J); if (newTrip(before)) sound(SOUND.takeoff); }
      J.step = want ? 'map' : 'unmap';
      wait(J, p, tripSec(dip ? SEC.dip : SEC.flight) + GUARD).then(function () {
        if (J.over) return;
        takeOff(J);
        land(J);
        settle(J, true);
      });
      return J.promise;
    }
    function intro() {
      if (disposed) return done(false);
      if (reduced()) return done(true);                                           /* never under reduced motion */
      var J = newJob('tour', st.visit, {});
      var p = rigCall('intro');
      takeOff(J);
      J.step = 'tour';
      wait(J, p, tripSec(SEC.tour) + GUARD).then(function () {
        if (J.over) return;
        land(J);
        settle(J, true);
      });
      return J.promise;
    }
    /* any tap, key or chip during the tour or a flight: the end pose in 0.35 s (a dip is already short) */
    function skip() {
      if (disposed || !rig) return false;
      return !!call(rig, 'skip');
    }
    function busy() {
      if (disposed) return false;
      return !!(job && !job.over) || !!rigTrip();
    }
    function pick(hit, mode) {
      if (disposed) return { kind: 'none' };
      if (busy()) return { kind: 'none', skipped: skip() };
      var V = typeof o.routeTap === 'function' ? null : islesView(), fn = typeof o.routeTap === 'function' ? o.routeTap : V && V.routeTap;
      var r = typeof fn === 'function' ? safe(fn, V, hit, { mode: mode || 'play', visit: st.visit, skyMap: st.map }) : null;
      return r && typeof r === 'object' && typeof r.kind === 'string' ? r : { kind: 'none' };
    }
    function info() {
      var J = job && !job.over ? job : null;
      return { VERSION: VERSION, visit: st.visit, live: st.live, skyMap: st.map, tour: st.tour, pending: st.pending, peek: st.peek,
        busy: busy(), seq: seq, job: J ? { kind: J.kind, isle: J.isle, step: J.step, dip: J.dip } : null,
        trips: stats.trips, superseded: stats.superseded, late: stats.late, dips: stats.dips };
    }
    function dispose() {
      if (disposed) return;
      if (job && !job.over) settle(job, false);
      disposed = true;
      dipOn(false);
      if (rig && typeof rig.onDip === 'function' && (!('dipFn' in rig) || rig.dipFn === onDip)) safe(rig.onDip, rig, null);
    }

    var api = { VERSION: VERSION, visitIsle: visitIsle, unlockIsle: unlockIsle, skyMap: skyMap, intro: intro, skip: skip, pick: pick,
      state: state, info: info, dispose: dispose };
    Object.defineProperty(api, 'busy', { get: busy, enumerable: true });
    Object.defineProperty(api, 'visit', { get: function () { return st.visit; }, enumerable: true });
    Object.defineProperty(api, 'skyMapOn', { get: function () { return st.map; }, enumerable: true });
    return api;
  }

  return { VERSION: VERSION, ISLES: ISLES, FALLBACK: FALLBACK, DEADLINE: DEADLINE, GUARD: GUARD, SEC: SEC, SOUND: SOUND, create: create };
}));
