/* ================================================================
   My Island v3, kids update — SLGamePeople (KU-CH16): the games' people helper.
   window.SLGamePeople in the browser (each game's deps, KU-CH17), module.exports in Node. Pure,
   with a thin browser part (the vox load, the sprite images): no DOM, no THREE (a rig comes from
   the runtime the game hands in), no storage, no network, no random numbers.

   WHO PLAYS (plan-ku KU8, characters.json design.games, CH-D11). The player figure is cfg.char
   (SLPeopleCore.avatarInfo: the child's active character) as a person rig, else the classic avatar
   (cfg.char null, no voxels, or the person rig failed). The sidekick is cfg.pet (careRunner's pet);
   cfg.pet null → no sidekick. The figure is visual only: nothing here touches a rule, a hitbox, a
   timing, a score, a medal or a board key, and nothing here reads the pet's care.

   API
     playerRig(SL3D, cfg, tier, scale, o) → Promise<rig | null>   never rejects
        cfg.char set and the person rig can be built → SL3D.vox.makePerson({look, wear, vr, member,
        sig}, tier) (else SLPxPeople.makePerson on a bound VoxHub); cfg.char set and SL3D.vox missing
        (a 3D game started from the 2D island) → SLIsland3D.loadGroup('vox') once (feature-detected,
        shared by every caller while it runs), then window.slLoadPeople() when the people shapes are
        not in yet, both inside o.deadlineMs (the rest of the game's loading deadline, default
        DEADLINE_MS; under MIN_LOAD_MS left no load is begun); a miss or a failure → the classic
        avatar, never a failed launch. The load time
        is kept for the lab (info().voxLoads) and logged through SL3D.log (KQ5).
        The classic avatar is SL3D.makeAvatar({color, emoji}, tier) (models-characters' toon avatar,
        exactly as the games ask today); when that is missing or throws → null (the game's own).
        o {deadlineMs, color, emoji, classic: false (no classic: null instead), slide: true (the
        Debut Run: fitSlide on the rig)}. The rig keeps its AvatarRig shape; root.scale = scale and
        rig.figure 'person' | 'classic', rig.gameScale. The game owns it from here (dispose()).
     rigNow(SL3D, cfg, tier, scale, o) → rig | null    the same choice now, with no loading
     fitSlide(rig, {scale, maxH}) → rig.slideFit {sz, y, h} | null   the flatten and lift that keep
        slideFlat between the floor and SLIDE_MAX_H (0.36 u, under the LED gate's 0.40 u) for this look
     playClip(rig, clip, t, o) → pose   rig.play plus the slide fit: the per-frame call
     voxMissing(SL3D) → bool          no way to build a person rig on this runtime yet
     charOf(cfg) · petOf(cfg) → the figure's info / the sidekick {id, name, acc}, or null
     sigOf(cfg) → the character's signature clip ('sigFreeze' …) or null
     sprites(cfg, poses, o) → Promise<{pose: Image}>   the 2D frames through SLGameShell.svgImage:
        poses = a game key ('run' | 'shootout' | 'kart': its frames) or frame names (SLPeopleArt
        GAME_SPRITES / FRAMES; 'portrait' = the HUD head and shoulders). {} with no character, no
        art (window.slLoadPeople is awaited inside o.deadlineMs first) or no shell; a frame whose
        image fails is left out (the game keeps today's pet sprite). o {game, color, facing, unit,
        size, deadlineMs}
     spriteSvgs(cfg, poses, o) → {pose: svg}   the same, as SVG strings (pure)
     petTrail(o) → trail       follow-the-leader for the Debut Run sidekick (CH-D12): a fixed ring
        of TRAIL.size samples, nothing allocated per step. push(t, x, y, sliding, airborne) each step
        (any units; t in s, rising; t going back starts a new trail); read(out, delay = TRAIL.delay) →
        out {ok, t, x, y, vx, vy, sliding (both neighbours: the cautious box), airborne, lift}: the
        leader's own path `delay` s before its newest sample, so the pet clears exactly what the
        leader cleared. lift 0..1 is the room for a flying pet's FLY_LIFT: 0 wherever the leader
        slid within LIFT_EASE s (under an LED gate), easing to 1 away from it. reset(t, x, y, vx)
        = a straight run-in (vx per s), clear(), length, size, delay, span()
     clipFor(role, gameClip, o) → clip   one game moment → the clip that plays it. role 'runner'
        (Debut Run), 'kicker' (Shootout), 'driver' (kart): the person / avatar clips; 'sidekick':
        the pet clip layer. o {sig: sigOf(cfg), pet: a sidekick is there, res: 'goal' | 'save' |
        'miss', star: a Star Strike / Encore Mode goal}. 'sig' → the signature move, else duo beside
        the pet (runner, driver), else cheer. Never 'sad'; an unknown moment → 'idle'
     flies(petId) → bool       a winged species (the dragon's flutter, the birds standing in as it)
     SCALE {run 0.9, shootout 1.35, kart 0.7} · TRAIL {size 64, delay 0.35} · FLY_LIFT 0.2 u ·
     LIFT_EASE · SLIDE_MAX_H · DEADLINE_MS · MIN_LOAD_MS · CLIPS · info() {voxLoads [{ms, ok, all, tier, at}], loading}
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLGamePeople = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1;
  var SCALE = { run: 0.9, shootout: 1.35, kart: 0.7 };           /* design.games: the person in each game */
  var TRAIL = { size: 64, delay: 0.35 };                          /* CH-D12: 0.35 s behind, 64 samples */
  var FLY_LIFT = 0.2, LIFT_EASE = 0.15;                           /* u above the path; s of ease around a slide */
  var DEADLINE_MS = 4000;                                         /* the vox load when a game gives none */
  var MIN_LOAD_MS = 250;                                          /* less left than this: no load (it could only land mid-game) */
  var LOG_MAX = 8;

  /* ---------------- siblings: the page's globals; the pure clip and look tables also by require() ---------------- */
  var sibs = {};
  function sibling(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || !path || typeof require !== 'function') return null;
    if (!Object.prototype.hasOwnProperty.call(sibs, name)) { try { sibs[name] = require(path) || null; } catch (e) { sibs[name] = null; } }
    return sibs[name];
  }
  function clips() { var CH = sibling('SLCharacters', '../island3d/models-characters.js'); return CH && CH.AV_INFO ? CH : null; }
  function lookM() { return sibling('SLIslandLook', '../world-look.js'); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function now() { try { if (root.performance && typeof root.performance.now === 'function') return root.performance.now(); } catch (e) { /* no clock */ } return Date.now(); }
  function hexOf(c) { var m = typeof c === 'string' && /^#?([0-9a-f]{6})$/i.exec(c.trim()); return m ? '#' + m[1].toUpperCase() : null; }

  /* ================================================================
     WHO PLAYS
     ================================================================ */
  /* the figure's info (avatarInfo's shape) when it can be drawn: a look object */
  function charOf(cfg) { var c = cfg && cfg.char; return plain(c) && plain(c.look) ? c : null; }
  /* the sidekick: careRunner's pet {id, name, acc}; anything else (null, no id) → none */
  function petOf(cfg) { var p = cfg && cfg.pet; return plain(p) && typeof p.id === 'string' && p.id ? p : null; }
  function whoOf(cfg) { return (cfg && (plain(cfg.member) ? cfg.member : plain(cfg.user) ? cfg.user : null)) || {}; }
  function sigOf(cfg) {
    var c = charOf(cfg), CH = clips(), s = c && c.sig;
    return typeof s === 'string' && CH && Object.prototype.hasOwnProperty.call(CH.AV_INFO, s) && CH.AV_INFO[s].sig ? s : null;
  }
  /* the person builder this runtime has: the stage's vox API (px-people's registration), else px-people
     itself on a bound VoxHub; null = SL3D.vox missing (a game opened from the 2D island) */
  function personMaker(SL3D) {
    var V = SL3D && SL3D.vox;
    if (!V) return null;
    if (typeof V.makePerson === 'function') return function (o, tier) { return V.makePerson(o, tier); };
    var PP = root.SLPxPeople;
    if (V.ready && PP && typeof PP.makePerson === 'function') return function (o, tier) { return PP.makePerson(SL3D, o, tier); };
    return null;
  }
  function voxMissing(SL3D) { return !personMaker(SL3D); }
  /* the people shapes (window.slLoadPeople is lazy): makePerson throws without them */
  function shapesIn() {
    var PP = root.SLPxPeople;
    if (!PP || typeof PP.ready !== 'function') return true;               /* nothing to ask: makePerson decides */
    try { return !!PP.ready(); } catch (e) { return false; }
  }
  function isRig(r) { return !!(r && r.root && typeof r.play === 'function' && typeof r.setPose === 'function'); }
  function drop(r) { try { if (r && typeof r.dispose === 'function') r.dispose(); } catch (e) { /* already gone */ } }
  function personRig(SL3D, ch, tier, color) {
    var mk = personMaker(SL3D), r = null;
    if (!mk) return null;
    try { r = mk({ look: ch.look, wear: plain(ch.wear) ? ch.wear : {}, vr: plain(ch.vr) ? ch.vr : {}, member: color, sig: ch.sig || null }, tier); } catch (e) { r = null; }
    if (r && !isRig(r)) { drop(r); r = null; }
    return r;
  }
  function classicRig(SL3D, cfg, tier, o) {
    if (o.classic === false || !SL3D || typeof SL3D.makeAvatar !== 'function') return null;
    var who = whoOf(cfg), r = null, emoji = typeof o.emoji === 'string' && o.emoji ? o.emoji : typeof who.avatar === 'string' && who.avatar ? who.avatar : '🙂';
    try { r = SL3D.makeAvatar({ color: o.color || who.color, emoji: emoji }, tier); } catch (e) { r = null; }
    return r && r.root ? r : null;
  }
  function placed(r, figure, scale) {
    var s = num(scale, 1) > 0 ? num(scale, 1) : 1;
    try { if (r.root.scale && typeof r.root.scale.setScalar === 'function') r.root.scale.setScalar(s); } catch (e) { /* the game scales it */ }
    r.figure = figure; r.gameScale = s;
    return r;
  }
  /* ---------------- the Debut Run slide under the LED gate (design.games.debutRun.fit, K16) ----------------
     slideFlat lies the figure on its back, so the head's depth (and a hat, a helmet's visor, a surfboard on
     the back) becomes its height: measured on the real rig, some looks stand 0.41 u tall at scale 0.9 or dip
     0.18 u into the floor. fitSlide measures this rig's slide (rigid skinning: each bone's rest box moved by
     the posed bones, root-relative, no THREE needed) and finds the extra flatten (pose sz × k) and lift
     (pose y + dy) that keep the whole figure between the floor and maxH (0.36 u, under the gate's 0.40 u). */
  var SLIDE_MAX_H = 0.36;
  function mul(a, b, out) {                                       /* column-major 4 × 4 (three's elements) */
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return out;
  }
  function meshOf(rig) { var m = rig && rig.meshes && rig.meshes.body; return m && m.isSkinnedMesh && m.skeleton && m.geometry && m.geometry.attributes ? m : null; }
  function restBoxes(mesh) {
    var at = mesh.geometry.attributes, P = at.position && at.position.array, S = at.skinIndex && at.skinIndex.array, box = {};
    if (!P || !S) return null;
    for (var i = 0, n = P.length / 3; i < n; i++) {
      var b = S[i * 4], e = box[b] || (box[b] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
      for (var a = 0; a < 3; a++) { var v = P[i * 3 + a]; if (v < e[a]) e[a] = v; if (v > e[3 + a]) e[3 + a] = v; }
    }
    return box;
  }
  /* the posed figure's lowest and highest y (rig units, the root's own frame) */
  var M1 = new Array(16), I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function extentY(rig, mesh, box) {
    rig.root.updateMatrixWorld(true);
    var bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses, rel = new Map(), lo = Infinity, hi = -Infinity;
    function relOf(o) {                                           /* the bone's matrix relative to the rig's root */
      if (!o || o === rig.root) return I16;
      if (rel.has(o)) return rel.get(o);
      var m = mul(relOf(o.parent), o.matrix.elements, new Array(16));
      rel.set(o, m);
      return m;
    }
    Object.keys(box).forEach(function (k) {
      var b = bones[k], e = box[k];
      if (!b || !inv[k]) return;
      mul(relOf(b), inv[k].elements, M1);
      var y = M1[13], y0 = y, y1 = y;
      for (var a = 0; a < 3; a++) { var p = M1[a * 4 + 1] * e[a], q = M1[a * 4 + 1] * e[3 + a]; y0 += Math.min(p, q); y1 += Math.max(p, q); }
      if (y0 < lo) lo = y0; if (y1 > hi) hi = y1;
    });
    return { lo: lo, hi: hi };
  }
  function slideExtent(rig, mesh, box, k) {
    var lo = Infinity, hi = -Infinity;
    for (var t = 0; t < 1; t += 0.125) {                          /* one 1 Hz wiggle cycle */
      var pose = rig.play('slideFlat', t, { reduced: false });
      if (!pose) return null;
      pose.sz = num(pose.sz, 1) * k; rig.setPose(pose);
      var e = extentY(rig, mesh, box);
      lo = Math.min(lo, e.lo); hi = Math.max(hi, e.hi);
    }
    return { lo: lo, hi: hi };
  }
  function fitSlide(rig, o) {
    o = o || {};
    try {
      var mesh = meshOf(rig), box = mesh ? restBoxes(mesh) : null;
      if (!box || typeof rig.play !== 'function' || typeof rig.setPose !== 'function') return null;
      var scale = num(o.scale, num(rig.gameScale, 1)) || 1, H = num(o.maxH, SLIDE_MAX_H) / scale, k = 1, e = null;
      for (var it = 0; it < 5; it++) {
        e = slideExtent(rig, mesh, box, k);
        if (!e || e.hi - e.lo <= H) break;
        k = Math.max(0.35, k * (H / (e.hi - e.lo)) * 0.99);
      }
      if (!e || !isFinite(e.lo)) return null;
      rig.play('idle', 0, { reduced: true });
      rig.slideFit = { sz: k, y: -e.lo, h: (e.hi - e.lo) * scale };
      return rig.slideFit;
    } catch (err) { return null; }
  }
  /* rig.play, plus the slide fit when the rig has one: the one call the games make per frame */
  function playClip(rig, clip, t, o) {
    var pose = rig.play(clip, t, o), f = clip === 'slideFlat' ? rig.slideFit : null;
    if (f && pose) { pose.sz = num(pose.sz, 1) * f.sz; pose.y = num(pose.y, 0) + f.y; rig.setPose(pose); }
    return pose;
  }

  function rigNow(SL3D, cfg, tier, scale, o) {
    o = o || {};
    try {
      var ch = charOf(cfg), color = hexOf(o.color) || hexOf(whoOf(cfg).color) || undefined;
      var r = ch ? personRig(SL3D, ch, tier, color) : null;
      if (r) placed(r, 'person', scale);
      else if ((r = classicRig(SL3D, cfg, tier, o))) placed(r, 'classic', scale);
      if (r && o.slide) fitSlide(r);                               /* the Debut Run: under the LED gate */
      return r;
    } catch (e) { return null; }
  }

  /* ---------------- the 2D-island case: the vox group inside the game's deadline (KU8) ---------------- */
  var voxLoad = null, voxIS = null, loads = [];
  function within(p, ms) {
    return new Promise(function (res) {
      var done = false, id = setTimeout(function () { if (!done) { done = true; res('timeout'); } }, Math.max(0, ms));
      Promise.resolve(p).then(function (v) { if (!done) { done = true; clearTimeout(id); res(v); } },
        function () { if (!done) { done = true; clearTimeout(id); res(false); } });
    });
  }
  function note(SL3D, rec) {
    loads.push(rec);
    if (loads.length > LOG_MAX) loads.shift();
    try { if (SL3D && typeof SL3D.log === 'function') SL3D.log('game-people: vox group ' + (rec.ok ? 'in ' : 'failed after ') + rec.ms + ' ms (' + rec.tier + ')'); } catch (e) { /* QA log only */ }
  }
  /* one loadGroup('vox') per runtime at a time, whoever asks; the settle time is kept even after a miss */
  function loadVox(SL3D, IS, tier) {
    if (voxLoad && voxIS === IS) return voxLoad;
    var t0 = now(), p;
    try { p = Promise.resolve(IS.loadGroup('vox')); } catch (e) { p = Promise.resolve(false); }
    voxIS = IS;
    /* ok = a person can be built now (the stage says false while a later wave's vox file is not built, and
       that never matters here); all = every file of the group arrived */
    voxLoad = p.then(function (ok) { return ok; }, function () { return false; }).then(function (ok) {
      note(SL3D, { ms: Math.round(now() - t0), ok: !voxMissing(SL3D), all: ok === true, tier: String(tier || (SL3D && SL3D.tier) || '?'), at: Date.now() });
      voxLoad = null; voxIS = null;
      return ok;
    });
    return voxLoad;
  }
  function playerRig(SL3D, cfg, tier, scale, o) {
    o = o || {};
    var t0 = now(), ms = Math.max(0, num(o.deadlineMs, DEADLINE_MS));
    function left() { return Math.max(0, ms - (now() - t0)); }
    return new Promise(function (res) {
      var ch = charOf(cfg), IS = root.SLIsland3D;
      if (!ch || !SL3D) { res(rigNow(SL3D, cfg, tier, scale, o)); return; }
      var step = Promise.resolve();
      /* a load that cannot land before the game starts is not begun: binding the voxels mid-run would only cost
         an old iPad a hitch (one already running is still waited for) */
      if (voxMissing(SL3D) && IS && typeof IS.loadGroup === 'function' && (left() >= MIN_LOAD_MS || (voxLoad && voxIS === IS))) step = within(loadVox(SL3D, IS, tier), left());
      step.then(function () {
        if (voxMissing(SL3D) || shapesIn() || typeof root.slLoadPeople !== 'function') return null;
        var p;
        try { p = root.slLoadPeople(); } catch (e) { p = null; }
        return within(p, left());
      }).then(function () { res(rigNow(SL3D, cfg, tier, scale, o)); }, function () { res(rigNow(SL3D, cfg, tier, scale, o)); });
    });
  }

  /* ================================================================
     THE 2D FRAMES (SLPeopleArt: one recipe, two renderers)
     ================================================================ */
  function frameList(poses, A) {
    var G = (A && A.GAME_SPRITES) || {};
    if (typeof poses === 'string') return Object.prototype.hasOwnProperty.call(G, poses) ? { game: poses, names: G[poses].frames.slice() } : { game: null, names: [poses] };
    return { game: null, names: Array.isArray(poses) ? poses.filter(function (n) { return typeof n === 'string' && n; }) : [] };
  }
  function spriteSvgs(cfg, poses, o, A) {
    o = o || {};
    A = A || root.SLPeopleArt;
    var info = charOf(cfg), out = {};
    if (!info || !A || typeof A.gameSprite !== 'function') return out;
    var fl = frameList(poses, A), color = hexOf(o.color) || hexOf(whoOf(cfg).color) || undefined;
    fl.names.forEach(function (n) {
      var s = '';
      try {
        s = n === 'portrait' ? (typeof A.portrait === 'function' ? A.portrait(info, { size: num(o.size, 64), color: color }) : '')
          : A.gameSprite(info, n, { game: o.game || fl.game || undefined, color: color, facing: o.facing, unit: o.unit });
      } catch (e) { s = ''; }
      if (typeof s === 'string' && s) out[n] = s;
    });
    return out;
  }
  function artReady(o) {
    if (root.SLPeopleArt) return Promise.resolve(root.SLPeopleArt);
    if (typeof root.slLoadPeople !== 'function') return Promise.resolve(null);
    var p;
    try { p = root.slLoadPeople(); } catch (e) { return Promise.resolve(null); }
    return within(p, Math.max(0, num(o.deadlineMs, DEADLINE_MS))).then(function () { return root.SLPeopleArt || null; });
  }
  function sprites(cfg, poses, o) {
    o = o || {};
    if (!charOf(cfg)) return Promise.resolve({});
    return artReady(o).then(function (A) {
      var Shell = root.SLGameShell, svgs = A ? spriteSvgs(cfg, poses, o, A) : {}, names = Object.keys(svgs);
      if (!names.length || !Shell || typeof Shell.svgImage !== 'function') return {};
      return Promise.all(names.map(function (n) { try { return Promise.resolve(Shell.svgImage(svgs[n])).catch(function () { return null; }); } catch (e) { return null; } }))
        .then(function (imgs) { var out = {}; names.forEach(function (n, i) { if (imgs[i]) out[n] = imgs[i]; }); return out; });
    }).catch(function () { return {}; });
  }

  /* ================================================================
     FOLLOW THE LEADER (CH-D12)
     ================================================================ */
  function petTrail(o) {
    o = o || {};
    var N = Math.max(16, Math.floor(num(o.size, TRAIL.size))), D = Math.max(0.01, num(o.delay, TRAIL.delay));
    /* a sample closer than GAP to the one before it replaces the newest instead of using a slot, so the
       ring always reaches more than D back (N − 2 slots × GAP ≥ 1.1 D) at any push rate */
    var GAP = D / (N - 8);
    var T = new Float64Array(N), X = new Float64Array(N), Y = new Float64Array(N), F = new Uint8Array(N);
    var head = -1, count = 0;
    function at(k) { return (head - k + N) % N; }                      /* k = 0 the newest */
    function put(i, t, x, y, f) { T[i] = t; X[i] = x; Y[i] = y; F[i] = f; }
    var trail = {
      size: N, delay: D,
      get length() { return count; },
      clear: function () { head = -1; count = 0; return trail; },
      push: function (t, x, y, sliding, airborne) {
        if (!isFinite(t) || !isFinite(x) || !isFinite(y)) return trail;
        var f = (sliding ? 1 : 0) | (airborne ? 2 : 0);
        if (count && t < T[head] - 1e-9) trail.clear();               /* time ran back: a new round */
        if (count && t - T[head] < 1e-9) { put(head, T[head], x, y, f); return trail; }
        if (count >= 2 && T[head] - T[at(1)] < GAP) { put(head, t, x, y, f); return trail; }   /* the newest is not settled yet */
        head = (head + 1) % N; if (count < N) count++;
        put(head, t, x, y, f);
        return trail;
      },
      /* a straight run-in at vx per second ending at (x, y) now: the pet starts behind, never on the leader */
      reset: function (t, x, y, vx) {
        trail.clear();
        var b = 1.5 * D;
        trail.push(num(t, 0) - b, num(x, 0) - num(vx, 0) * b, num(y, 0), false, false);
        return trail.push(num(t, 0), num(x, 0), num(y, 0), false, false);
      },
      span: function () { return count ? T[head] - T[at(count - 1)] : 0; },
      read: function (out, delay) {
        out = out || {};
        var d = Math.max(0, num(delay, D));
        if (!count) { out.ok = false; out.t = out.x = out.y = out.vx = out.vy = 0; out.sliding = out.airborne = false; out.lift = 1; return out; }
        var tq = T[head] - d, k = 0;
        while (k < count - 1 && T[at(k)] > tq) k++;                   /* at(k): the newest sample at or before tq */
        var i0 = at(k), i1 = k > 0 ? at(k - 1) : i0, u = 0;
        if (i1 !== i0 && T[i1] > T[i0]) u = Math.max(0, Math.min(1, (tq - T[i0]) / (T[i1] - T[i0])));
        var dt = T[i1] - T[i0];
        out.ok = T[i0] <= tq + 1e-9;                                  /* false: the trail is younger than delay (clamped to its oldest) */
        out.t = Math.max(tq, T[i0]);
        out.x = X[i0] + (X[i1] - X[i0]) * u; out.y = Y[i0] + (Y[i1] - Y[i0]) * u;
        out.vx = dt > 0 ? (X[i1] - X[i0]) / dt : 0; out.vy = dt > 0 ? (Y[i1] - Y[i0]) / dt : 0;
        out.sliding = !!(F[i0] & F[i1] & 1);
        out.airborne = !!((u < 0.5 ? F[i0] : F[i1]) & 2);
        /* the room to flutter: a tent of LIFT_EASE s round every sliding sample, 0 under it */
        var lift = (F[i0] | F[i1]) & 1 ? 0 : 1;
        for (var j = 0; j < count && lift > 0; j++) {
          var ij = at(j), g = Math.abs(T[ij] - out.t);
          if ((F[ij] & 1) && g < LIFT_EASE) lift = Math.min(lift, g / LIFT_EASE);
        }
        out.lift = lift;
        return out;
      }
    };
    return trail;
  }

  /* ================================================================
     CLIPS: one game moment → the clip that plays it
     ================================================================ */
  var CLIPS = {
    /* Debut Run (design.games.debutRun.clips): the gait by speed; the double jump flips once; a slip is a brief dizzy;
       the Encore plays the signature move (or duo); the curtain call a gentle bow (the clip layer's only bow) */
    runner: { idle: 'idle', menu: 'idle', run: 'run', land: 'run', takeoff: 'jump', jump: 'jump', fall: 'fall', dj: 'jumpTuck',
              slide: 'slideFlat', bump: 'tumble', tumble: 'tumble', dizzy: 'dizzy', slip: 'dizzy', splash: 'dizzy',
              finish: 'cheer', encore: 'sig', curtain: 'sigBow', wave: 'wave' },
    /* Encore Shootout (design.games.encoreShootout, KU gameEvents): petStage's names, then the results */
    kicker: { idle: 'idle', walk: 'walk', kick: 'shoot', cheer: 'cheer', goal: 'cheer', starGoal: 'sig', save: 'shrug', thumbs: 'oops',
              miss: 'oops', decider: 'ready', wave: 'wave', clap: 'clap' },
    /* Neon Grand Prix (design.games.neonGrandPrix): drive on the seat; standing and waving on the riser and podium */
    driver: { idle: 'idle', drive: 'drive', riser: 'wave', podium: 'wave', menu: 'wave', wave: 'wave', finish: 'cheer', win: 'cheer', celebrate: 'sig' },
    /* the pet (its own clip layer): a worried hop when the leader tumbles, never 'sad' */
    sidekick: { idle: 'idle', run: 'run', land: 'run', takeoff: 'jump', jump: 'jump', dj: 'jump', fall: 'fall', slide: 'slide',
                bump: 'hop', tumble: 'hop', dizzy: 'hop', slip: 'hop', splash: 'hop', finish: 'cheer', encore: 'dance', curtain: 'sit',
                goal: 'hop', starGoal: 'dance', encoreMode: 'dance', save: 'sit', miss: 'sit', decider: 'idle',
                drive: 'ride', ride: 'ride', riser: 'cheer', podium: 'cheer', win: 'cheer', walk: 'walk', cheer: 'cheer' }
  };
  function clipFor(role, gameClip, o) {
    o = o || {};
    var map = Object.prototype.hasOwnProperty.call(CLIPS, role) ? CLIPS[role] : null, g = String(gameClip == null ? '' : gameClip);
    if (!map) return 'idle';
    /* petStage's result clips read the result: a goal dances its counts 5-6 (the signature on a Star Strike or in Encore
       Mode), a save shrugs, a miss is an oops */
    if (role === 'kicker' && (g === 'dance' || g === 'sad')) g = g === 'sad' ? (o.res === 'save' ? 'save' : 'miss') : o.star ? 'starGoal' : 'goal';
    if (role === 'sidekick' && g === 'goal' && o.star) g = 'starGoal';
    var c = Object.prototype.hasOwnProperty.call(map, g) ? map[g] : null;
    if (c === 'sig') {
      var CH = clips(), s = typeof o.sig === 'string' && CH && Object.prototype.hasOwnProperty.call(CH.AV_INFO, o.sig) && CH.AV_INFO[o.sig].sig ? o.sig : null;
      c = s || ((role === 'runner' || role === 'driver') && o.pet ? 'duo' : 'cheer');   /* duo: side by side with the pet */
    }
    return c && c !== 'sad' ? c : 'idle';
  }

  /* ---------------- flying species: the dragon's flutter, and the birds that stand in as the dragon ---------------- */
  function flies(petId) {
    if (typeof petId !== 'string') return false;
    var CH = clips(), L = lookM(), sp = null, row = L && L.SPECIES3 && Object.prototype.hasOwnProperty.call(L.SPECIES3, petId) ? L.SPECIES3[petId] : null;
    try { sp = CH && typeof CH.speciesOf === 'function' && (CH.canRig ? CH.canRig(petId) : true) ? CH.speciesOf(petId) : null; } catch (e) { sp = null; }
    if (sp && sp.gait === 'flutter') return true;
    return !!(row && row.biped && row.standIn === 'pet_dragon');
  }

  return {
    VERSION: VERSION, SCALE: SCALE, TRAIL: TRAIL, FLY_LIFT: FLY_LIFT, LIFT_EASE: LIFT_EASE, DEADLINE_MS: DEADLINE_MS, MIN_LOAD_MS: MIN_LOAD_MS, CLIPS: CLIPS,
    SLIDE_MAX_H: SLIDE_MAX_H, fitSlide: fitSlide, playClip: playClip,
    playerRig: playerRig, rigNow: rigNow, voxMissing: voxMissing, charOf: charOf, petOf: petOf, sigOf: sigOf,
    sprites: sprites, spriteSvgs: function (cfg, poses, o) { return spriteSvgs(cfg, poses, o); },
    petTrail: petTrail, clipFor: clipFor, flies: flies,
    info: function () { return { voxLoads: loads.slice(), loading: !!voxLoad }; }
  };
}));
