/* ================================================================
   My Island v3 — SLPxFun (W2.2): the four garden-fun items in Pixel Blocks (PX4).
   window.SLPxFun + SL3D.defineVox('fun', factory) in the browser, module.exports in Node. The
   models are pure data (voxels(st) → VoxModel: no THREE, no DOM); the handlers keep the v2 acts,
   pivots and anchors (models-fun.js), driven by the same SLMotion timelines.
     trampoline  G8: four legs under an octagonal pad ring in two colours; the 2-tone check mat
                 (G16) rides pivot 'mat' and sinks at each contact. Act 'bounce': asks
                 a.pets.perform('trampoline', uid) for the pet's run-over + 3 bounces; with no pet
                 (or reduced motion) the mat does one gentle boing. Anchors top, seat (on 'mat').
     fountain    G8: an octagonal basin with a pool, a plinth, a column and an upper bowl; three
                 stacked-water jets (G16, glow) on 'water' (centre; the act pivot), 'jetL', 'jetR'
                 breathe in y and play the 3 s splash show. Their state colour 'show' goes from
                 water to the LOOK's three show tints at Showtime (D51). Drops are fx 'drop'.
     swing       G8 trunk and limb under a G4 leaf canopy with blossom; G16 ropes and the seat hang
                 on 'swing' (hinge under the limb): ±4° idle pendulum, the act swings to ±38° and
                 decays. It keeps every face (cull []): the seat tips its underside to a low camera.
     bubbles     G8 speaker cabinet (atlas 'speaker' woofer) with a horn on 'emitter' (it rocks in
                 the act, which emits fx 'bubble'); two idle ring bubbles on 'bubA' / 'bubB'.
   Fun items are never jittered. Every act is ≤ its SLMotion duration, interruptible, never stacks
   (a re-tap supersedes and blends from the live pose), and plays its reduced variant (the end
   state and the same cues) under reduced motion; idles then hold the rest pose. Nothing here
   reads, awards or spends points.
   HANDLE used: a.uid a.t a.phase a.reduced a.show · a.pivot(name).set(rotDeg[3], pos[3], scale[3])
   · a.state(key, v) · a.emit(kind, localPos, n, opts) · a.sfx(name, vol, step) · a.pets
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxFun = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('fun', api.factory);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxFun: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function mo() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 1, IDS = ['trampoline', 'fountain', 'swing', 'bubbles'];
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, TAU = Math.PI * 2, DEG = Math.PI / 180;
  var NEON3 = ['Neon Magenta', 'LED Cyan', 'Electric Violet'];      /* = SLIslandLook.NEON3: the fountain's show tints */

  /* ================================================================
     LAYOUT (item-space u; every base inside the 0.875 u cell fit)
     ================================================================ */
  var T = { matY: 0.3125 };                                   /* the mat's top = pivot 'mat' = the seat */
  var F = {
    /* jets: the pivot, its origin (the foot of the jet), the rest height, the show tint it takes */
    jets: [{ pivot: 'water', p: [0, 0.75, 0], h: 0.25, neon: 1 }, { pivot: 'jetL', p: [-0.25, 0.125, 0], h: 0.1875, neon: 0 },
           { pivot: 'jetR', p: [0.25, 0.125, 0], h: 0.1875, neon: 2 }],
    bob: 0.18, bobPeriod: 1.2,                                /* breathing: ±18 % at 0.83 Hz, a third apart */
    spout: [0, 1, 0], dripEvery: 0.45, dripN: 2               /* fx 'drop' from the top of the centre jet */
  };
  var S = { pivot: [0.1875, 0.875, 0], seat: [0.1875, 0.375, 0], deg: 4, period: 2.4 };
  var B = {
    base: [0.125, 0.375, 0], mouth: [0.125, 0.5, 0],          /* the horn's foot (pivot 'emitter') and its mouth */
    rest: [{ p: [0.125, 0.6875, 0] }, { p: [-0.1875, 0.5, 0] }],   /* bubA just blown over the mouth, bubB resting on the cabinet */
    wandGain: 4, every: 2,                                    /* SLMotion's ±3° shake × 4; an idle bubble every 2 s */
    trackX0: 0.12, trackY0: 0.3, trackA: 0.45                 /* SLMotion.idleBubble's own start and peak alpha */
  };

  /* ================================================================
     VOXELS (pure)
     ================================================================ */
  /* root.model(meta) plus further layers [{g: Grid, at?: [x, y, z] u}] (each keeps its own grid) */
  function assemble(rootGrid, extra, meta) {
    var m = rootGrid.model(meta);
    extra.forEach(function (e) { m.layers.push(e.at ? { vox: e.g.snapshot(), at: e.at } : { vox: e.g.snapshot() }); });
    return m;
  }
  /* an octagon of half-width r on the voxel grid (r 3: rows 3 5 7 7 7 5 3) */
  function inOct(i, k, r) { var a = Math.abs(i), b = Math.abs(k); return a <= r && b <= r && a + b <= r + 1; }

  function trampolineVoxels() {
    var V = vox(), o = V.grid({ grid: G8 }), mat = V.grid({ grid: G16, origin: [1, 0, 1] }), i, k;
    /* the pad ring: a 7 × 7 square with the corners off round the mat; side pads and corner pads */
    for (k = -3; k <= 3; k++) for (i = -3; i <= 3; i++) {
      var a = Math.abs(i), b = Math.abs(k);
      if (a + b < 6 && !inOct(i, k, 2)) o.set(i, 2, k, a < 2 || b < 2 ? 'p' : 'q');
    }
    [[-2, -2], [2, -2], [2, 2], [-2, 2]].forEach(function (p) { o.box(p[0], p[0], 0, 1, p[1], p[1], 'l'); });
    mat.group('mat', function () {
      for (k = -2; k <= 2; k++) for (i = -2; i <= 2; i++) if (inOct(i, k, 2)) mat.box(2 * i, 2 * i + 1, 4, 4, 2 * k, 2 * k + 1, (i + k) & 1 ? 'n' : 'm');
    });
    o.pivot('mat', [0, T.matY / G8 - 0.5, 0]).anchor('seat', [0, T.matY / G8 - 0.5, 0], 'mat');
    return assemble(o, [{ g: mat }], { id: 'trampoline', palette: {
      p: 'PX Sky Blue', q: 'PX Sunny', l: 'Cloud White', m: 'PX Castle Iron', n: 'PX Penguin Back' } });
  }

  function fountainVoxels() {
    var V = vox(), o = V.grid({ grid: G8 }), jet = V.grid({ grid: G16, origin: [1, 0, 1] }), i, k;
    var lk = look(), e = lk && lk.LOOK && lk.LOOK.fountain, neon = e && e.show && Array.isArray(e.show.neon) && e.show.neon.length >= 3 ? e.show.neon : NEON3;
    for (k = -3; k <= 3; k++) for (i = -3; i <= 3; i++) {
      if (!inOct(i, k, 3)) continue;
      if (!inOct(i, k, 2)) { o.set(i, 0, k, 'a'); o.set(i, 1, k, 'b'); }             /* the basin wall and its coping */
      else o.set(i, 0, k, Math.abs(i) < 2 && Math.abs(k) < 2 ? 'v' : 'w');             /* the pool, a ripple round the column */
    }
    o.box(0, 0, 0, 3, 0, 0, 'a');                                /* column */
    o.box(-1, 1, 4, 4, -1, 1, 'b');                              /* upper bowl, its rim, the water in it */
    o.box(-1, 1, 5, 5, -1, 1, 'c'); o.set(0, 5, 0, 'w');
    /* jets (G16): a 2 × 2 column; the centre one rises from a 4 × 4 foam foot with the corners off */
    F.jets.forEach(function (J, n) {
      var x0 = Math.round(J.p[0] / G16), y0 = Math.round(J.p[1] / G16), top = y0 + Math.round(J.h / G16) - 1, ch = String(n + 1);
      jet.group(J.pivot, function () {
        jet.box(x0, x0 + 1, y0, top, 0, 1, ch);
        if (!n) for (var z = -1; z <= 2; z++) for (var x = -1; x <= 2; x++) if (!((x < 0 || x > 1) && (z < 0 || z > 1))) jet.set(x0 + x, y0, z, ch);
      });
      o.pivot(J.pivot, [J.p[0] / G8, J.p[1] / G8 - 0.5, 0]);
    });
    o.anchor('spout', [0, F.spout[1] / G8 - 0.5, 0]);
    var pal = { a: 'PX Lilac', b: 'PX Lilac Base', c: 'PX Candy Pink', w: { token: 'PX Sea Top 2', mode: 'soft' }, v: { token: 'PX Sea Top 1', mode: 'soft' } };
    F.jets.forEach(function (J, n) { pal[String(n + 1)] = { token: 'PX Sea Wall Lip', mode: 'glow', state: { key: 'show', off: 'PX Sea Wall Lip', on: neon[J.neon], initial: 0 } }; });
    return assemble(o, [{ g: jet }], { id: 'fountain', palette: pal });
  }

  function swingVoxels() {
    var V = vox(), o = V.grid({ grid: G8, origin: [0.5, 0, 0] }), rope = V.grid({ grid: G16 }), leaf = V.grid({ grid: G4, origin: [1.5, 0, 1.5] }), bloom = V.grid({ grid: G8 });
    o.box(-3, -2, 0, 7, -1, 0, 't');                              /* trunk, its root flare, the limb */
    o.box(-3, -1, 0, 0, -2, 1, 't'); o.clear(-1, 0, -2); o.clear(-1, 0, 1);
    o.box(-1, 3, 7, 7, -1, 0, 't');
    o.hashTone('t', 'u', 0.22, 'swing');
    o.group('swing', function () { o.box(0, 3, 2, 2, -1, 0, 's'); });
    rope.group('swing', function () { rope.box(0, 0, 6, 13, 0, 0, 'r'); rope.box(6, 6, 6, 13, 0, 0, 'r'); });
    /* the canopy: a 3 × 3 puff with a plus on top (G4, from y 1.0), set a little back and left */
    leaf.box(0, 2, 0, 0, 0, 2, 'l');
    leaf.box(0, 2, 1, 1, 1, 1, 'L'); leaf.box(1, 1, 1, 1, 0, 2, 'L');
    leaf.set(2, 0, 2, 'k'); leaf.set(0, 0, 1, 'k');
    /* blossom (G8) on the canopy's front, its right side and the corners of its lower tier */
    [[-2, 9, 3, 'p'], [1, 8, 3, 'w'], [3, 9, -1, 'p'], [-3, 10, 2, 'w'], [2, 10, 1, 'p'], [1, 10, -3, 'p']].forEach(function (b) { bloom.set(b[0], b[1], b[2], b[3]); });
    o.pivot('swing', [S.pivot[0] / G8, S.pivot[1] / G8 - 0.5, -0.5]).anchor('seat', [S.seat[0] / G8, S.seat[1] / G8 - 0.5, -0.5], 'swing');
    /* cull []: the seat tips its underside toward a low camera at the top of its swing, so every face stays */
    return assemble(o, [{ g: rope }, { g: leaf, at: [-0.0625, 1, -0.0625] }, { g: bloom }], { id: 'swing', cull: [], palette: {
      t: 'PX Trunk', u: 'PX Tree Bark', s: 'PX Coral', r: 'PX Tree Rope', p: 'PX Candy Pink', w: 'Holo Pink',
      l: { token: 'PX Leaf', mode: 'leaf' }, L: { token: 'PX Leaf Lit', mode: 'leaf' }, k: { token: 'PX Leaf 2', mode: 'leaf' } } });
  }

  /* a ring bubble facing the camera (G16, one voxel deep): the rim of an n × n disc with the corners
     stepped off — pale blue, a white glint on its upper-left arc, a pink one lower-right */
  function bubble(g, x0, y0, n) {
    var cut = n > 4 ? 2 : 1;
    function inside(x, y) { return x >= 0 && y >= 0 && x < n && y < n && Math.min(x, n - 1 - x) + Math.min(y, n - 1 - y) >= cut; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (!inside(x, y) || (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) continue;
      g.set(x0 + x, y0 + y, 0, x < n / 2 - 1 && y >= n / 2 ? 'W' : x >= n / 2 + 1 && y < n / 2 - (n > 4 ? 1 : 0) ? 'k' : 'u');
    }
  }
  function bubblesVoxels() {
    var V = vox(), o = V.grid({ grid: G8 }), d = V.grid({ grid: G16, origin: [1, 0, 1] });
    o.box(-2, 2, 0, 0, -1, 1, 'e');                               /* the cabinet on its base band */
    o.box(-2, 2, 1, 2, -1, 1, 'c');
    o.set(1, 2, 1, 'y'); o.set(2, 2, 1, 'm');                     /* two buttons beside the woofer */
    o.decal('+z', [-2, 1, 1], [2, 2], 'speaker');
    d.group('emitter', function () {                              /* the horn: a bell under a flared lip */
      d.box(1, 4, 6, 6, -1, 2, 'h');
      d.box(0, 5, 7, 7, -2, 3, 'm'); d.box(1, 4, 7, 7, -1, 2, null);
    });
    d.group('bubA', function () { bubble(d, 0, 8, 6); });
    d.group('bubB', function () { bubble(d, -4, 6, 4); });
    o.pivot('emitter', [B.base[0] / G8, B.base[1] / G8 - 0.5, 0]).anchor('wand', [B.mouth[0] / G8, B.mouth[1] / G8 - 0.5, 0], 'emitter');
    B.rest.forEach(function (r, n) { o.pivot(n ? 'bubB' : 'bubA', [r.p[0] / G8, r.p[1] / G8 - 0.5, r.p[2] / G8]); });
    return assemble(o, [{ g: d }], { id: 'bubbles', palette: {
      c: 'PX Candy Pink', e: 'PX Lilac', y: 'PX Sunny', m: 'PX Mint', h: 'PX Lilac', u: 'Bubble Rim', W: 'PX Glint', k: 'Holo Pink' } });
  }
  var voxels = { trampoline: trampolineVoxels, fountain: fountainVoxels, swing: swingVoxels, bubbles: bubblesVoxels };

  /* ================================================================
     PURE ANIMATION HELPERS (exported for Node tests)
     ================================================================ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  /* the swing's idle pendulum in degrees (±4° every 2.4 s) */
  function pendulum(t, deg, period, phase, reduced) { return reduced ? 0 : deg * Math.sin(TAU * (t / period + (phase || 0))); }
  /* jet j's breathing height factor (0.83 Hz, a third of a cycle apart) */
  function bubblerScale(t, j, phase, reduced) { return reduced ? 1 : 1 + F.bob * Math.sin(TAU * (t / F.bobPeriod + (phase || 0) + j / 3)); }
  /* the horn mouth after the horn rocks deg about z at its foot */
  function wandPoint(deg, out) {
    out = out || [0, 0, 0];
    var a = (deg || 0) * DEG, c = Math.cos(a), s = Math.sin(a), dx = B.mouth[0] - B.base[0], dy = B.mouth[1] - B.base[1];
    out[0] = B.base[0] + dx * c - dy * s; out[1] = B.base[1] + dx * s + dy * c; out[2] = B.mouth[2];
    return out;
  }
  /* idle bubble k: its pivot's offset from the rest spot {x, y, z} and scale s (SLMotion.idleBubble
     re-based to the horn mouth; the alpha fade becomes a grow-in / shrink-out). Reduced, or without
     SLMotion: the rest pose */
  var _b = {};
  function bubblePose(t, k, every, phase, reduced, out) {
    out = out || {};
    var M = mo(), rb = B.rest[k];
    if (reduced || !M || typeof M.idleBubble !== 'function') { out.x = out.y = out.z = 0; out.s = 1; return out; }
    M.idleBubble(t, k, every || B.every, phase || 0, false, _b);
    if (!(_b.a > 0)) { out.x = out.y = out.z = 0; out.s = 0; return out; }
    out.x = B.mouth[0] + (_b.x - B.trackX0) - rb.p[0];
    out.y = B.mouth[1] + (_b.y - B.trackY0) - rb.p[1];
    out.z = B.mouth[2] + _b.z - rb.p[2];
    out.s = Math.min(1, _b.a / B.trackA);
    return out;
  }
  /* the pet's run-over lead (s) from a.pets.perform's answer: a number or {lead} / {dur}; any other
     truthy answer means "coming" (the longest run-over); falsy or negative = no pet (−1) */
  function leadOf(ret, max) {
    max = max > 0 ? max : 1.2;
    if (ret == null || ret === false) return -1;
    var v = typeof ret === 'number' ? ret : typeof ret === 'object' && typeof ret.lead === 'number' ? ret.lead
      : typeof ret === 'object' && typeof ret.dur === 'number' ? ret.dur : max;
    if (v !== v) return max;
    return v < 0 ? -1 : v > max ? max : v;
  }

  /* ================================================================
     HANDLE HELPERS + THE ACT BOOK (one live act per uid, on an SLMotion timeline)
     ================================================================ */
  var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1];
  function pose(a, name, rx, ry, rz, px, py, pz, sx, sy, sz) {
    var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
    if (!pv || typeof pv.set !== 'function') return;
    R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = px; P3[1] = py; P3[2] = pz; S3[0] = sx; S3[1] = sy; S3[2] = sz;
    pv.set(R3, P3, S3);
  }
  function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0, 1, 1, 1); }
  function timeOf(a) { return a && typeof a.t === 'number' && isFinite(a.t) ? a.t : 0; }
  function phaseOf(a) {
    if (a && typeof a.phase === 'number' && isFinite(a.phase)) return a.phase;
    var M = mo();
    return M && a ? M.phaseOf(String(a.uid)) : 0;
  }
  /* spec: {name, reduced, lead?, apply(a, out, t, rec), rest(a), emitAt?(a, rec) → localPos, emitOpts?(a, rec)}
     → {name, dur, update(a, tAct) → alive, cancel()} | null (no SLMotion, or no such act) */
  var CARRY_WINDOW = 0.25;                   /* a cancel this recent is an interruption: carry the pose */
  function makeBook() {
    var recs = new Map();
    function fire(rec, h, t) {
      while (rec.ci < rec.cues.length && rec.cues[rec.ci].t <= t + 1e-6) {
        var c = rec.cues[rec.ci++];
        try {
          if (c.sfx) { if (typeof h.sfx === 'function') h.sfx(c.sfx, c.vol, c.step); }
          else if (c.emit && typeof h.emit === 'function') h.emit(c.emit, rec.spec.emitAt ? rec.spec.emitAt(h, rec) : 'top', c.n, rec.spec.emitOpts ? rec.spec.emitOpts(h, rec) : undefined);
        } catch (e) { /* a cue never stops its act */ }
      }
    }
    function step(rec, h, tAct) {
      if (rec.done) return false;
      if (h) rec.h = h; else h = rec.h;
      var t = tAct >= 0 ? +tAct : 0, tt = t < rec.dur ? t : rec.dur;
      rec.lastT = timeOf(h);
      fire(rec, h, t);
      mo().sample(rec.name, tt, rec.out, rec.o);
      rec.spec.apply(h, rec.out, tt, rec);
      if (t < rec.dur) return true;
      rec.done = true;                         /* the end pose is the rest pose */
      if (recs.get(rec.uid) === rec) recs.delete(rec.uid);
      return false;
    }
    function cancel(rec) {
      if (rec.done) return;
      rec.done = true; rec.cancelled = true;
      if (rec.h && rec.h.uid === rec.uid && rec.spec.rest) { try { rec.spec.rest(rec.h, rec); } catch (e) { /* the copy is gone */ } }
    }
    return {
      live: function (uid) { var r = recs.get(uid); return r && !r.done ? r : null; },
      forget: function (uid) { recs.delete(uid); },
      start: function (a, spec) {
        var M = mo();
        if (!a || !M || !M.ACTS || !M.ACTS[spec.name]) return null;
        var prev = recs.get(a.uid), now = timeOf(a), from = null;
        if (prev && prev.name === spec.name && (!prev.done || (prev.cancelled && Math.abs(now - prev.lastT) <= CARRY_WINDOW))) from = M.carry(spec.name, prev.out);
        if (prev && !prev.done) prev.done = true;                 /* never two on one uid */
        var o = { reduced: !!spec.reduced, from: from };
        if (spec.lead != null) o.lead = spec.lead;
        var rec = { uid: a.uid, name: spec.name, spec: spec, o: o, out: {}, cues: M.cues(spec.name, o), ci: 0, dur: M.durOf(spec.name, o),
                    done: false, cancelled: false, lastT: now, h: a };
        recs.set(a.uid, rec);
        return { name: spec.name, dur: rec.dur, update: function (h, tAct) { return step(rec, h, tAct); }, cancel: function () { cancel(rec); } };
      }
    };
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('fun', K → {id: {voxels, idle?, act, show?, forget}})
     ================================================================ */
  function factory() {
    var lk = look(), idleLook = (lk && lk.LOOK && lk.LOOK.swing && lk.LOOK.swing.idle) || {};
    var swingDeg = typeof idleLook.deg === 'number' ? idleLook.deg : S.deg, swingPeriod = typeof idleLook.period === 'number' ? idleLook.period : S.period;

    /* ---------- trampoline: the mat sinks by the timeline's dip ---------- */
    var tBook = makeBook();
    function matApply(a, out) { pose(a, 'mat', 0, 0, 0, 0, Math.min(0, out.matDip || 0), 0, 1, 1, 1); }
    function matRest(a) { rest(a, 'mat'); }
    function askPet(a) {
      var p = a.pets, M = mo();
      if (!p || typeof p.perform !== 'function') return -1;
      try {
        if (typeof p.active === 'function' && !p.active()) return -1;
        return leadOf(p.perform('trampoline', a.uid), M && M.BOUNCE && M.BOUNCE.maxLead);
      } catch (e) { return -1; }
    }

    /* ---------- fountain ---------- */
    var fBook = makeBook(), fStill = new Map(), fShow = new Map(), fDrip = new Map();
    function jetsPose(a, t, ph, reduced, out) {
      for (var j = 0; j < F.jets.length; j++) {
        var J = F.jets[j], v = out ? (j === 0 ? out.c : j === 1 ? out.l : out.r) || 0 : 0;
        var sy = bubblerScale(t, j, ph, reduced) + v / J.h, sx = 1 + 0.18 * clamp01(v / 0.9);
        pose(a, J.pivot, 0, 0, 0, 0, 0, 0, sx, sy, sx);
      }
    }
    function jetsRest(a) { jetsPose(a, 0, 0, true, null); }
    /* the Showtime mix on the jets' state colour, written only when it moves */
    function fountainShow(a, k) {
      k = clamp01(+k || 0);
      var prev = fShow.get(a.uid);
      if (prev !== undefined && Math.abs(k - prev) < 0.01 && !((k === 0 || k === 1) && prev !== k)) return;
      fShow.set(a.uid, k);
      if (typeof a.state === 'function') { try { a.state('show', k); } catch (e) { /* no such part on this copy */ } }
    }
    /* a couple of fx drops off the centre jet every F.dripEvery s (never under reduced motion) */
    function drip(a, t, ph) {
      var n = Math.floor(t / F.dripEvery + ph), was = fDrip.get(a.uid);
      if (was === n) return;
      fDrip.set(a.uid, n);
      if (was !== undefined && typeof a.emit === 'function') { try { a.emit('drop', F.spout, F.dripN); } catch (e) { /* fx is optional */ } }
    }

    /* ---------- swing ---------- */
    var sBook = makeBook(), sStill = new Map();
    function swingIdleDeg(a, reduced) { return pendulum(timeOf(a), swingDeg, swingPeriod, phaseOf(a), reduced); }
    function swingApply(a, out, t, rec) {
      pose(a, 'swing', (out.deg || 0) + (out.idleMix == null ? 1 : out.idleMix) * swingIdleDeg(a, rec.o.reduced), 0, 0, 0, 0, 0, 1, 1, 1);
    }

    /* ---------- bubble machine ---------- */
    var bBook = makeBook(), bStill = new Map(), _bp = {}, EP = [0, 0, 0], EMIT = { pearl: true, seed: 0, reduced: false, idle: false };
    function hornDeg(out) { return -(out && out.wobble || 0) * B.wandGain; }
    function bubbleOpts(a, rec) {
      var M = mo();
      EMIT.seed = ((M ? M.hash(String(a.uid)) : 0) + rec.ci * 2654435761) >>> 0;
      EMIT.reduced = !!rec.o.reduced;
      return EMIT;
    }

    function forget(uid) {
      [tBook, fBook, sBook, bBook, fStill, fShow, fDrip, sStill, bStill].forEach(function (m) { if (m.forget) m.forget(uid); else m.delete(uid); });
    }
    return {
      trampoline: {
        voxels: trampolineVoxels, forget: forget,
        /* no idle: the mat only moves in its act. With no pet (or reduced motion) it does its one gentle boing */
        act: function (a) {
          if (!a) return null;
          var lead = a.reduced ? -1 : askPet(a);
          return tBook.start(a, lead < 0 ? { name: 'bounce', reduced: true, apply: matApply, rest: matRest }
            : { name: 'bounce', reduced: false, lead: lead, apply: matApply, rest: matRest });
        }
      },
      fountain: {
        voxels: fountainVoxels, forget: forget,
        idle: function (a) {
          if (a.reduced) {
            if (fStill.get(a.uid) || fBook.live(a.uid)) return false;
            fStill.set(a.uid, true);
            jetsRest(a);
            return true;
          }
          fStill.delete(a.uid);
          var t = timeOf(a), ph = phaseOf(a);
          if (!fBook.live(a.uid)) jetsPose(a, t, ph, false, null);
          drip(a, t, ph);
          return true;
        },
        act: function (a) {
          if (!a) return null;
          return fBook.start(a, { name: 'splash', reduced: !!a.reduced, rest: jetsRest,
            apply: function (h, out, tt, rec) { jetsPose(h, timeOf(h), phaseOf(h), rec.o.reduced, out); } });
        },
        show: function (a, k) { if (a) fountainShow(a, k); }
      },
      swing: {
        voxels: swingVoxels, forget: forget,
        idle: function (a) {
          if (sBook.live(a.uid)) return true;                      /* the act owns the seat */
          if (a.reduced) {
            if (sStill.get(a.uid)) return false;
            sStill.set(a.uid, true);
            rest(a, 'swing');
            return true;
          }
          sStill.delete(a.uid);
          pose(a, 'swing', swingIdleDeg(a, false), 0, 0, 0, 0, 0, 1, 1, 1);
          return true;
        },
        act: function (a) {
          if (!a) return null;
          return sBook.start(a, { name: 'swing', reduced: !!a.reduced, apply: swingApply, rest: function (h) { rest(h, 'swing'); } });
        }
      },
      bubbles: {
        voxels: bubblesVoxels, forget: forget,
        idle: function (a) {
          if (a.reduced) {
            if (bStill.get(a.uid)) return false;
            bStill.set(a.uid, true);
            rest(a, 'bubA'); rest(a, 'bubB');
            return true;
          }
          bStill.delete(a.uid);
          var t = timeOf(a), ph = phaseOf(a);
          for (var k = 0; k < 2; k++) {
            bubblePose(t, k, B.every, ph, false, _bp);
            pose(a, k ? 'bubB' : 'bubA', 0, 0, 0, _bp.x, _bp.y, _bp.z, _bp.s, _bp.s, _bp.s);
          }
          return true;
        },
        act: function (a) {
          if (!a) return null;
          return bBook.start(a, { name: 'bubbles', reduced: !!a.reduced,
            apply: function (h, out) { pose(h, 'emitter', 0, 0, hornDeg(out), 0, 0, 0, 1, 1, 1); },
            rest: function (h) { rest(h, 'emitter'); },
            emitAt: function (h, rec) { return wandPoint(hornDeg(rec.out), EP); }, emitOpts: bubbleOpts });
        }
      }
    };
  }

  return {
    VERSION: VERSION, IDS: IDS, voxels: voxels, factory: factory, LAYOUT: { trampoline: T, fountain: F, swing: S, bubbles: B },
    pendulum: pendulum, bubblerScale: bubblerScale, wandPoint: wandPoint, bubblePose: bubblePose, leadOf: leadOf, makeBook: makeBook
  };
}));
