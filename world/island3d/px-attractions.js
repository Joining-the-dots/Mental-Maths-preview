/* ================================================================
   My Island v3 — SLPxAttractions: the voxel attractions, the game cosmetics they display and
   the two Home land dioramas (W2.5; voxel-engine PX7 + PX9, D11 grain, D32 pictograms, D34).
   Classic UMD: window.SLPxAttractions + SL3D.defineVox('attractions', models) in the browser,
   module.exports in Node. Every model is DATA from a pure builder (SLVox grids, no THREE): the
   island, the photocards and the Node tests mesh the same source.

   IDS (item space: base y = 0, pivot at the footprint centre, facing +z)
     att_course   2×2 start gate on a pad in THEME[course][0]: chunky chequered feet, stacked
                  rainbow-ring posts (G4), a banner in THEME[course][1] whose sign plate carries
                  'PET COURSE' (atlas cell 'word:PET COURSE', PIX5) over the member underline, a
                  chequered-flag and an arrow placard (D32: the mockup's GO!), 14 bulbs, a spinning
                  ✦, a chequered start line, 2 cones, 2 mini hurdles and the course's dressing
                  pivots spin (the ✦), glow (the bulbs) · states bulbA / bulbB: 'day' | 'pink' |
                  'cyan' | 'violet' | 'dim' · anchors top, spot, banner
     att_pitch    3×2 striped pitch in STADIA[stadium][1] (G16), white lines, two net goals, corner
                  flags, a 3-tier stand in STADIA[stadium][0] with 20 voxel fans (LOW 12: the rest
                  are tagged lod 'mid') holding glow sticks, the selected ball on the spot; night:
                  four light towers, beach: palms and a beach ball, snow: banks and blue lines
                  pivots ball, crowd, wands ⊂ crowd · state wands 0 dim … 1 lit · anchors top, spot
     att_kart     2×2 pit garage: G4 box with a striped roller door, a cantilevered roof, a
                  chequered fascia, a lime glow bolt sign, a tool chest, 3 tyre stacks and the
                  selected kart parked out front at half scale
                  pivot kart · anchors top, spot, seat and exhaust (both ride the kart, K8)
     course_*     the gate dressed as that course · stadium_*   a mini stadium diorama (21 × 11)
     ball_*       the ball (G32, d 7) on a low riser; pivot 'ball' at its centre
     kart_*       the kart in its LOCKED colour; pivots seat, steer, wheelF ⊂ steer, wheelB
     track_*      a mini track diorama: oval road, red / white kerbs, start line, the track's props
     land_cove · land_meadow   a mini beach and a terraced hill on candy strata (icons, land sheets)

   LOCKED THEME / KARTS / BALLS / STADIA / TRACKS colours are used as they are (palette tokens
   only; the few module tokens are registered through SLIslandLook.addTokens, D50).
   CULLING: parts that turn keep the faces a turn can show — the gate keeps '-z' (the ✦ spins
   about y), the pitch '-y' (the ball rolls), karts and balls every face. The pitch and the mini
   stadiums opt out of corner AO: on G16 fans and nets it only splits the greedy quads.
   HANDLERS {voxels(st, ctx) → VoxModel, build?, idle?, show?, act?, forget?, setUser?, setMember?};
   the kit builds K.vox.template(ctx, voxels(st, ctx)). Acts are SLMotion's own timelines on
   LAUNCH_PIVOT ('launch' for the gate and the pitch, 'kartRev' for the garage) with their reduced
   variants and cues; the bulb chase and the crowd bounce read ART3.FREQS (≤ 1.5 Hz per bulb,
   ≤ 1.97 Hz), and reduced motion holds every idle at its end state.
   THE MEMBER UNDERLINE is the atlas cell 'att:member', defined by this factory and redrawn in
   the child's colour by setUser / setMember (one small upload; every gate, bake and card follows).
   No model, act or idle reads or writes the child's score, any storage or the network.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports, api = factory(root, node);
  if (node) { module.exports = api; return; }
  root.SLPxAttractions = api;
  if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('attractions', api.models);
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
  function VX() { var v = sibling('SLVox', './vox.js'); if (!v) throw new Error('SLPxAttractions: vox.js (SLVox) is not loaded'); return v; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }

  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, G32 = 0.03125;
  var IDS = {
    attractions: ['att_course', 'att_pitch', 'att_kart'],
    courses: ['course_meadow', 'course_beach', 'course_snow', 'course_candy'],
    balls: ['ball_classic', 'ball_rainbow', 'ball_planet', 'ball_gold'],
    stadiums: ['stadium_day', 'stadium_night', 'stadium_beach', 'stadium_snow'],
    karts: ['kart_red', 'kart_blue', 'kart_lime', 'kart_unicorn', 'kart_gold'],
    tracks: ['track_loop', 'track_volcano', 'track_beach'],
    lands: ['land_cove', 'land_meadow']
  };
  var ALL_IDS = [].concat(IDS.attractions, IDS.courses, IDS.balls, IDS.stadiums, IDS.karts, IDS.tracks, IDS.lands);
  var SLOTS = { course: IDS.courses, ball: IDS.balls, stadium: IDS.stadiums, kart: IDS.karts };
  var SLOT_DEFAULTS = { course: 'course_meadow', ball: 'ball_classic', stadium: 'stadium_day', kart: 'kart_red' };
  function pick(slot, st) {
    var v = st && st[slot];
    return typeof v === 'string' && SLOTS[slot].indexOf(v) >= 0 ? v : SLOT_DEFAULTS[slot];
  }

  /* module tokens (D50): the pitch's second stripe per stadium and the volcano's lit rock */
  var TOKENS = { 'PX Att Turf Day': '#5FB862', 'PX Att Turf Night': '#378C42', 'PX Att Turf Beach': '#72C493', 'PX Att Turf Snow': '#AEDCB9', 'PX Att Rock Lit': '#A58470' };
  var MEMBER = 'Bubblegum', CELL_MEMBER = 'att:member';
  var RAINBOW = ['Coral', 'Rainbow Orange', 'Star Gold', 'Leaf Mint', 'Splash Blue', 'Grape'];
  var BULBS = { day: 'Holo Lemon', pink: 'Neon Magenta', cyan: 'LED Cyan', violet: 'Electric Violet', dim: 'PX Ink Eye' };
  var FANS = ['PX Candy Pink', 'PX Sunny', 'PX Mint', 'PX Lilac', 'PX Coral', 'PX Sky Blue'];
  var KART_GLOW = { kart_red: 'Neon Pink', kart_blue: 'Neon Cyan', kart_lime: 'Neon Lime', kart_unicorn: 'Neon Pink', kart_gold: 'Star Gold' };
  var KART_TRIM = { kart_red: 'Cloud White', kart_blue: 'Cloud White', kart_lime: 'Star Gold', kart_unicorn: 'Cloud White', kart_gold: 'Chrome' };
  /* ✦: four tips, never the five-point ⭐ (D32) · the garage's bolt (rows top → bottom) */
  var SPARK = ['...#...', '...#...', '..#+#..', '##+++##', '..#+#..', '...#...', '...#...'];
  var BOLT = ['....##', '...##.', '..##..', '.#####', '...##.', '..##..', '.##...', '##....'];

  var tokensFor = null;
  function ready() {
    var L = look();
    if (L && tokensFor !== L && typeof L.addTokens === 'function') { L.addTokens('px-attractions', TOKENS); tokensFor = L; }
  }
  /* a builder grid: even (voxel 0 starts on the pivot plane) or odd (voxel 0 is centred on it) per axis */
  function grid(g, oddX, oddZ) { return VX().grid({ grid: g, origin: [oddX ? 0.5 : 0, 0, oddZ ? 0.5 : 0] }); }
  function mix() { var o = {}; for (var n = 0; n < arguments.length; n++) for (var k in arguments[n]) o[k] = arguments[n][k]; return o; }
  /* item metres → the root frame (G8, origin 0), where an integer is a voxel centre */
  function U(p) { return [p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
  /* a VoxModel from layers [grid | [grid, at]] (each grid's own decals follow it); o.pivots
     {name: [x, y, z, parent?]} and o.anchors {name: [x, y, z, pivot?]} in item metres */
  function model(id, pal, layers, o) {
    o = o || {};
    var m = { id: id, grid: G8, origin: [0, 0, 0], palette: pal, layers: [], pivots: {}, anchors: {}, decals: [] }, issues = [];
    layers.forEach(function (l, n) {
      var g = Array.isArray(l) ? l[0] : l;
      m.layers.push({ vox: g.snapshot(), at: (Array.isArray(l) && l[1]) || [0, 0, 0] });
      g.decals.forEach(function (d) { var c = mix(d); c.layer = n; m.decals.push(c); });
      g.issues.forEach(function (s) { issues.push(s); });
    });
    Object.keys(o.pivots || {}).forEach(function (n) { var p = o.pivots[n]; m.pivots[n] = { at: U(p), parent: p[3] || null }; });
    Object.keys(o.anchors || {}).forEach(function (n) { var a = o.anchors[n]; m.anchors[n] = a[3] ? { at: U(a), pivot: a[3] } : U(a); });
    if (o.cull) m.cull = o.cull;
    if (o.ao === false) m.ao = false;
    if (issues.length) m.issues = issues;
    return m;
  }

  /* ================================================================
     THE COURSE GATE (att_course and the course_* displays)
     ================================================================ */
  function bulbState(key) { return { key: key, off: BULBS.day, on: BULBS.pink, initial: 0, map: BULBS }; }
  function cone(o, i, k) { o.box(i, i + 3, 1, 1, k, k + 3, 'o').box(i + 1, i + 2, 2, 5, k + 1, k + 2, function (a, j) { return j === 4 ? 'w' : 'o'; }); }
  function hurdle(o, i, k, c) { o.box(i, i, 1, 3, k, k, 'w').box(i + 7, i + 7, 1, 3, k, k, 'w').box(i, i + 7, 4, 4, k, k, c); }
  function palm(o, i, k, h) {
    o.box(i, i, 1, h, k, k, 'P').set(i, h + 1, k, 'F');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { o.set(i + d[0], h + 1, k + d[1], 'F').set(i + 2 * d[0], h, k + 2 * d[1], 'F'); });
  }
  function flower(o, i, k, h, c) { o.box(i, i, 1, h, k, k, 'S').box(i, i + 1, h + 1, h + 2, k, k + 1, c); }
  /* the course's own dressing: on the pad (o: G16, j = 1 is the pad's top) and on the banner (top) */
  function dressing(o, top, course) {
    if (course === 'course_beach') {
      palm(o, -12, 4, 6);                                                             /* a palm sprout */
      o.box(10, 11, 1, 1, 3, 4, 'h').set(11, 2, 4, 'h').box(-5, -4, 1, 1, -12, -11, 'h').set(-5, 2, -12, 'h');   /* shells */
      o.box(-10, -8, 1, 1, 8, 8, 'f').box(-9, -9, 1, 1, 7, 9, 'f');                   /* a starfish */
    } else if (course === 'course_snow') {
      top.box(-10, -5, 25, 25, -4, -1, 'n').box(4, 9, 25, 25, -4, -1, 'n').box(-9, -7, 26, 26, -3, -2, 'n').box(5, 8, 26, 26, -3, -2, 'n');   /* caps */
      [[-14, -7], [6, 13]].forEach(function (x) {
        o.box(x[0], x[1], 4, 4, -6, 1, function (i, j, k) { return i >= x[0] + 2 && i <= x[1] - 2 && k >= -4 && k <= -1 ? null : 'n'; });
      });
      [[-12, 1], [-6, 2], [5, 1], [11, 2]].forEach(function (c) { top.box(c[0], c[0], 20 - c[1], 19, -1, -1, 'I'); });   /* 4 icicles */
      o.box(-13, -11, 1, 2, 3, 5, 'n').box(-10, -8, 1, 2, 4, 6, 'n').box(-12, -10, 3, 4, 4, 5, 'n');                    /* a snowball pile */
    } else if (course === 'course_candy') {
      [[-12, 3, 6], [11, 4, 8]].forEach(function (l) {                                /* two swirl lollipops */
        o.box(l[0], l[0], 1, l[2], l[1], l[1], 'w');
        o.disc(l[0], l[2] + 3, l[1], 2.3, 'z', function (i, j) { return (i - l[0]) * (j - l[2] - 3) >= 0 ? 'x' : 'w'; });
      });
      [[-9, 10, 'y'], [-5, 12, 'x'], [-2, 7, 'M'], [3, 5, 'y'], [6, 12, 'x'], [-11, -9, 'M'], [10, -10, 'y'], [0, 11, 'B']].forEach(function (s) { o.set(s[0], 1, s[1], s[2]); });
    } else {
      [[-12, -11, 3, 'x'], [-8, -13, 2, 'w'], [7, -13, 3, 'y'], [11, -11, 2, 'x'], [-14, 4, 2, 'w'], [12, 4, 2, 'w'], [-6, 12, 2, 'x'], [5, 12, 2, 'y']]
        .forEach(function (f) { flower(o, f[0], f[1], f[2], f[3]); });
      [[-14, -13], [-10, -9], [9, -10], [13, -13], [-4, -12], [3, -11], [-14, 8], [13, 7]].forEach(function (t, n) { o.box(t[0], t[0], 1, 1 + (n & 1), t[1], t[1], 'T'); });
    }
  }
  function gate(id, course) {
    var candy = course === 'course_candy';
    var pal = {
      p: 'THEME.' + course + '.0', b: 'THEME.' + course + '.1', w: 'Cloud White', k: 'PX Penguin Back', s: 'PX Castle Banner', u: MEMBER, c: 'PX Cream Wall',
      o: 'Carrot', x: candy ? 'Tulip Pink' : 'Coral', y: 'Star Gold', S: 'Stem', T: 'PX Tuft', P: 'Palm Bark', F: 'Frond', h: 'Blossom Light', f: 'Peach Coral',
      n: 'Snow', I: 'PX Ice', M: 'Leaf Mint', B: 'Splash Blue', '*': { token: 'Star Gold', mode: 'glow' }, '+': { token: 'Gold Light', mode: 'glow' },
      A: { token: BULBS.day, mode: 'glow', state: bulbState('bulbA') }, Z: { token: BULBS.day, mode: 'glow', state: bulbState('bulbB') }
    };
    RAINBOW.forEach(function (t, n) { pal[n + 1] = t; });
    /* the pad with its chequered start line */
    var pad = grid([G8, G16, G8]);
    pad.box(-7, 6, 0, 0, -7, 6, function (i, j, k) { return i >= -3 && i <= 2 && k >= -1 && k <= 1 ? ((i + k) & 1 ? 'k' : 'w') : 'p'; });
    /* chunky chequered feet, rainbow-ring posts (candy: striped) */
    var feet = grid(G8), posts = grid(G4);
    [-7, 3].forEach(function (i0) { feet.box(i0, i0 + 3, 0, 1, -3, 0, function (i, j, k) { return (i + k) & 1 ? 'w' : 'b'; }); });
    [[-3, 0], [2, 2]].forEach(function (p) { for (var j = 1; j <= 4; j++) posts.set(p[0], j, -1, candy ? (j & 1 ? 'x' : 'w') : String((j - 1 + p[1]) % 6 + 1)); });
    /* the banner on the posts and its two pictogram placards (D32); cones, hurdles, dressing */
    var ban = grid(G16), fine = grid(G16);
    ban.box(-16, 15, 20, 24, -4, -1, function (i) { return i < -14 || i > 13 ? 'w' : 'b'; });
    ban.box(-16, -11, 25, 30, -2, -2, 'c').decal('+z', [-16, 25, -2], [6, 6], 'flagChequer');
    ban.box(10, 15, 25, 30, -2, -2, 'c').decal('+z', [10, 25, -2], [6, 6], 'arrow');
    cone(fine, -13, 9); cone(fine, 9, 9); hurdle(fine, -8, 5, 'x'); hurdle(fine, 1, 9, 'y');
    dressing(fine, ban, course);
    /* the sign plate: PET COURSE over the member underline; 14 bulbs in two chase groups */
    var sign = grid(G16, true);
    sign.box(-14, 14, 20, 24, 0, 0, function (i, j) { return j === 20 && Math.abs(i) <= 11 ? 'u' : 's'; });
    sign.decal('+z', [-14, 21, 0], [29, 4], 'word:PET COURSE').decal('+z', [-11, 20, 0], [23, 1], CELL_MEMBER);
    sign.group('glow', function () { for (var n = 0; n < 14; n++) sign.set(-13 + 2 * n, 25, 0, n & 1 ? 'Z' : 'A'); });
    /* the spinning ✦ perched on the banner */
    var star = grid(G16, true);
    star.group('spin', function () { star.bitmap(SPARK, { '#': '*', '+': '+' }, { at: [-3, 25, -3], depth: 2 }); });
    return model(id, pal, [pad, feet, posts, ban, fine, sign, star], {
      pivots: { spin: [0, 1.78125, -0.125], glow: [0, 1.59375, 0.03125] },
      anchors: { spot: [0, 0.0625, 0.45], banner: [0, 1.5625, 0.0625] }, cull: ['-y']
    });
  }

  /* ================================================================
     BALLS (G32; the pitch's ball and the ball_* displays)
     ================================================================ */
  var RAINBOW_BAND = { 3: '1', 2: '2', 1: '3', 0: '4', '-1': '5', '-2': '5', '-3': '6' };
  function ballPal(id) {
    var pal = { w: 'BALLS.' + id + '.0', d: 'BALLS.' + id + '.1', i: 'Iridescent Rim', '!': { token: 'PX Glint', mode: 'glow' } };
    RAINBOW.forEach(function (t, n) { pal[n + 1] = t; });
    return pal;
  }
  /* the ball into o (odd grid) with its base at voxel row j0: d voxels across, riding pivot */
  function ballInto(o, id, d, j0, pivot) {
    var r = (d - 1) / 2, lim = d === 7 ? 10.5 : 5;
    function colour(i, j, k) {
      if (id === 'ball_rainbow') return RAINBOW_BAND[j] || '4';
      if (id === 'ball_planet') return j === 1 ? 'i' : 'w';
      if (id === 'ball_gold') return (i === -2 && j === 2 && k === 1) || (i === -1 && j === 2 && k === 2) ? '!' : j <= -2 ? 'd' : 'w';
      var a = [Math.abs(i), Math.abs(j), Math.abs(k)].sort(function (p, q) { return q - p; });
      if (d === 5) return (a[0] + a[1] + a[2]) % 3 === 0 && i * i + j * j + k * k >= 4 ? 'd' : 'w';
      return a[0] === 3 ? 'd' : 'w';
    }
    o.group(pivot, function () {
      for (var j = -r; j <= r; j++) for (var k = -r; k <= r; k++) for (var i = -r; i <= r; i++) if (i * i + j * j + k * k <= lim) o.set(i, j0 + r + j, k, colour(i, j, k));
      if (id === 'ball_planet') {                                                     /* a tilted one-voxel ring */
        for (k = -5; k <= 5; k++) for (i = -5; i <= 5; i++) if (Math.round(Math.sqrt(i * i + k * k)) === 5) o.set(i, j0 + r + Math.round(i * 0.3), k, 'd');
      }
    });
    return o;
  }
  function ball(id) {
    var o = grid(G32, true, true);
    o.lathe([[4.4, 0, 0, 'r'], [3.2, 1, 1, 'q']]);
    ballInto(o, id, 7, 2, 'ball');
    return model(id, mix(ballPal(id), { r: 'Stone Light', q: 'PX Mint' }), [o],
      { pivots: { ball: [0, 0.171875, 0] }, anchors: { spot: [0, 0.0625, 0], ball: [0, 0.171875, 0] }, cull: [] });
  }

  /* ================================================================
     THE PITCH (att_pitch) AND THE MINI STADIUMS (stadium_*)
     ================================================================ */
  var TURF = { stadium_day: 'PX Att Turf Day', stadium_night: 'PX Att Turf Night', stadium_beach: 'PX Att Turf Beach', stadium_snow: 'PX Att Turf Snow' };
  /* big: the 3×2 attraction; else the 1×1 display diorama. One G16 grid (odd in x) + the ball's */
  function stadium(id, sid, big, ballId) {
    var night = sid === 'stadium_night', beach = sid === 'stadium_beach', snow = sid === 'stadium_snow';
    var hx = big ? 19 : 10, k0 = big ? -8 : -5, k1 = big ? 12 : 5, kc = big ? 2 : 0, cr = big ? 3 : 2, bx = big ? 13 : 7, bw = big ? 4 : 2, sw = big ? 5 : 3;
    var pt = big ? 2 : 1, ph = big ? 6 : 3, gm = big ? 6 : 2, tiers = big ? 3 : 2, per = big ? 7 : 5, step = big ? 5 : 4;
    var wand = { key: 'wands', off: night ? 'PX Bulb Warm' : 'Pebble', on: 'PX Bulb Warm', initial: 0 };
    var pal = mix(ballPal(ballId), {
      g: 'STADIA.' + sid + '.1', t: TURF[sid], S: 'STADIA.' + sid + '.0', l: snow ? 'PX Ice Deep' : 'Cloud White', W: 'Cloud White', n: 'Holo Blue',
      y: 'PX Sunny', x: 'PX Coral', P: night ? 'Pole' : 'Palm Bark', F: 'Frond', L: { token: 'Lamp Halo', mode: 'glow' }, s: 'Snow', b: 'Splash Blue',
      H: 'PX Cream Wall', h: { token: 'PX Cream Wall', lod: 'mid' },
      G: { token: 'PX Bulb Warm', mode: 'glow', state: wand }, V: { token: 'PX Bulb Warm', mode: 'glow', state: wand, lod: 'mid' }
    });
    FANS.forEach(function (t, n) { pal['ABCDEJ'[n]] = t; pal['jkmopq'[n]] = { token: t, lod: 'mid' }; });
    var o = grid(G16, true), t, n;
    /* the plate: stripes, touchlines, halfway line, centre circle, both penalty boxes */
    o.box(-hx, hx, 0, 0, k0, k1, function (i, j, k) {
      var ai = Math.abs(i), dk = Math.abs(k - kc);
      if (ai === hx || k === k0 || k === k1) return 'g';
      if (ai === hx - 1 || k === k0 + 1 || k === k1 - 1 || i === 0 || Math.round(Math.sqrt(i * i + dk * dk)) === cr) return 'l';
      if ((ai >= bx && dk === bw) || (ai === bx && dk < bw)) return 'l';
      return Math.floor((i + (sw >> 1) + 20 * sw) / sw) % 2 ? 'g' : 't';
    });
    /* two goals: posts, crossbar and a see-through pixel net */
    [-1, 1].forEach(function (s) {
      var i0 = s > 0 ? hx - pt + 1 : -hx, i1 = i0 + pt - 1, n0 = s * (hx + 1), k, j;
      o.box(i0, i1, 1, ph, kc - gm, kc - gm + pt - 1, 'W').box(i0, i1, 1, ph, kc + gm - pt + 1, kc + gm, 'W').box(i0, i1, ph - pt + 1, ph, kc - gm, kc + gm, 'W');
      for (k = kc - gm; k <= kc + gm; k++) for (j = 1; j <= ph; j++) if (!((Math.floor((j - 1) / pt) + Math.floor((k - kc + gm) / pt)) & 1)) o.set(n0, j, k, 'n');
    });
    /* corner flags (night: light towers; beach: two palms at the front) */
    [[-hx, k0, 1], [hx, k0, -1], [-hx, k1, 1], [hx, k1, -1]].forEach(function (c, m) {
      if (night) { o.box(c[0], c[0], 1, 5, c[1], c[1], 'P'); o.box(Math.min(c[0], c[0] + c[2]), Math.max(c[0], c[0] + c[2]), 6, 7, c[1], c[1], 'L'); }
      else if (beach && m > 1) palm(o, c[0] + 2 * c[2], c[1] - 2, 5);
      else { o.box(c[0], c[0], 1, 4, c[1], c[1], 'W'); o.box(c[0] + c[2], c[0] + c[2], 3, 4, c[1], c[1], c[2] > 0 ? 'x' : 'y'); }
    });
    /* the stand and its crowd: 2 × 3 × 2 fans, each with a glow stick */
    for (t = 0; t < tiers; t++) o.box(-hx, hx, 0, t + 1, k0 - 2 * t - 2, k0 - 2 * t - 1, 'S');
    function fan(i, j, k, c, mid) {
      o.group('crowd', function () {
        o.box(i, i + 1, j, j + 1, k - 1, k, (mid ? 'jkmopq' : 'ABCDEJ')[c]).box(i, i + 1, j + 2, j + 2, k - 1, k, mid ? 'h' : 'H');
      });
      o.group('wands', function () { o.box(i + 2, i + 2, j + 2, j + 3, k, k, mid ? 'V' : 'G'); });
    }
    for (t = 0; t < tiers; t++) {
      for (n = 0; n < per; n++) {
        var fi = -hx + (big ? 3 : 1) + (t & 1 ? (big ? 2 : 1) : 0) + step * n, fk = k0 - 2 * t - 1;
        if (big && t === 2 && n === 3) continue;
        if (beach && t === 0 && n === (big ? 3 : 1)) o.box(fi, fi + 2, 2, 4, fk - 1, fk + 1, function (i) { return 'xWb'[i - fi]; });   /* a beach ball */
        else fan(fi, t + 2, fk, (n + 2 * t) % 6, big && (n & 1) === 1);
      }
    }
    if (snow) {                                                                       /* snow banks along the stand */
      [-hx + 2, hx - 2].forEach(function (i) { o.blob(i, 1, k0 + 0.5, 2.4, 1.6, 1.4, 's', 2); });
      o.box(-hx, hx, tiers + 1, tiers + 1, k0 - 2 * tiers, k0 - 2 * tiers, 's');
    }
    /* the ball on the spot */
    var b = grid(G32, true, true), bd = big ? 7 : 5, at = big ? [0.5, G16, (kc + 0.5) * G16] : [0.21875, G16, (kc + 0.5) * G16];
    ballInto(b, ballId, bd, 0, 'ball');
    return model(id, pal, [o, [b, at]], {
      pivots: { ball: [at[0], G16 + bd * G32 / 2, at[2]], crowd: [0, 0.125, (k0 - 3) * G16], wands: [0, 0.25, (k0 - 3) * G16, 'crowd'] },
      anchors: { spot: [at[0], G16, at[2]] }, cull: ['-z'], ao: false
    });
  }

  /* ================================================================
     KARTS AND THE GARAGE
     ================================================================ */
  function kartPal(id) {
    var L = look(), glow = (L && L.LOOK && L.LOOK[id] && L.LOOK[id].colors && L.LOOK[id].colors.glow) || KART_GLOW[id];
    return { B: 'KARTS.' + id, a: KART_TRIM[id], k: 'PX Penguin Back', d: 'Ink', h: 'Pebble', c: 'Chrome', w: 'Cloud White', y: 'Star Gold', G: 'Gold Base',
      1: 'PX Sunny', 2: 'PX Mint', 3: 'PX Lilac', u: { token: glow, mode: 'glow' }, '!': { token: 'PX Glint', mode: 'glow' } };
  }
  /* the kart into o (even grid, 14 × 8 × 20 voxels, facing +z). piv: every voxel rides that pivot
     (the garage's parked kart); else the wheels ride wheelF / wheelB */
  function kartInto(o, id, piv) {
    function body(fn) { if (piv) o.group(piv, fn); else fn(); }
    body(function () {
      o.box(-4, 3, 0, 0, -4, 3, 'u');                                                 /* under-glow */
      o.box(-5, 4, 1, 2, -9, 5, 'B').box(-3, 2, 1, 2, 6, 8, 'B').box(-5, 4, 1, 1, 9, 9, 'c');   /* floor pan, nose, bumper */
      o.box(-4, 3, 3, 3, -9, -5, 'B').box(-3, 2, 3, 3, 3, 6, 'B');                    /* engine cover, hood */
      o.box(-4, 3, 3, 3, -4, 2, function (i, j, k) { return i === -4 || i === 3 || k === 2 ? 'B' : null; });   /* cockpit rim */
      o.box(-2, 1, 2, 2, -3, 1, 'd').box(-2, 1, 3, 5, -4, -4, 'd').box(-1, 0, 3, 4, 2, 2, 'd');   /* seat, seat back, wheel */
      o.box(-4, -4, 4, 5, -9, -9, 'B').box(3, 3, 4, 5, -9, -9, 'B').box(-6, 5, 6, 6, -10, -8, 'a');   /* spoiler */
      o.set(-3, 2, -10, 'c').set(2, 2, -10, 'c');                                     /* exhausts */
      if (id === 'kart_blue') {
        o.box(-2, -2, 3, 3, 3, 6, 'w').box(1, 1, 3, 3, 3, 6, 'w').box(-2, -2, 3, 3, -9, -5, 'w').box(1, 1, 3, 3, -9, -5, 'w');
        o.set(-6, 7, -9, 'w').set(5, 7, -9, 'w');
      } else if (id === 'kart_lime') {
        [[0, 6], [-1, 5], [0, 5], [1, 4], [0, 4], [-1, 3]].forEach(function (p) { o.set(p[0], 3, p[1], 'y'); });
        o.box(-1, 0, 3, 3, -9, -5, 'y');
      } else if (id === 'kart_unicorn') {
        o.box(-1, 0, 3, 4, 7, 8, 'G').box(-1, 0, 5, 6, 8, 8, 'G').set(0, 7, 8, 'G');  /* the horn */
        for (var k = -5; k >= -10; k--) o.box(-1, 0, 4, 4 + (k & 1), k, k, String((-k - 5) % 3 + 1));   /* a 3-colour mane */
        o.box(-1, 0, 6, 6, -4, -4, '2');
      } else if (id === 'kart_gold') {
        o.box(-1, 0, 3, 3, 3, 8, 'w').set(-3, 3, 6, '!').set(5, 6, -9, '!').set(-5, 2, 0, '!');
      } else o.box(-1, 0, 3, 3, 4, 5, 'w');
    });
    [['wheelB', -8], ['wheelF', 4]].forEach(function (w) {
      o.group(piv || w[0], function () {
        [-7, 5].forEach(function (i0) {
          var io = i0 < 0 ? i0 : i0 + 1;
          o.box(i0, i0 + 1, 1, 2, w[1], w[1] + 3, 'k').box(i0, i0 + 1, 0, 3, w[1] + 1, w[1] + 2, 'k').box(io, io, 1, 2, w[1] + 1, w[1] + 2, 'h');
        });
      });
    });
    return o;
  }
  var KART = { seat: [0, 0.1875, -0.15625], axleF: [0, 0.125, 0.375], axleB: [0, 0.125, -0.375], nose: [0, 0.125, 0.625], exhaust: [0, 0.15625, -0.65] };
  function kart(id) {
    return model(id, kartPal(id), [kartInto(grid(G16), id, null)], {
      pivots: { seat: KART.seat, steer: KART.axleF, wheelF: KART.axleF.concat('steer'), wheelB: KART.axleB },
      anchors: { seat: KART.seat, nose: KART.nose, exhaust: KART.exhaust }, cull: []
    });
  }
  var PARKED = { x: 0.125, z: 0.59375, s: 0.5 };
  function parked(p) { return [PARKED.x + p[0] * PARKED.s, p[1] * PARKED.s, PARKED.z + p[2] * PARKED.s]; }
  function tyres(o, i0, k0, n) {
    for (var j = 0; j < 2 * n; j++) for (var a = 0; a < 4; a++) for (var c = 0; c < 4; c++) if ((a % 3 === 0) !== (c % 3 === 0)) o.set(i0 + a, j, k0 + c, j & 1 ? 'k' : 'd');
    o.box(i0 + 1, i0 + 2, 2 * n - 2, 2 * n - 2, k0 + 1, k0 + 2, 'h');
  }
  function garage(st) {
    var kid = pick('kart', st);
    var pal = mix(kartPal(kid), { W: 'PX Sky Blue', R: 'PX Sunny', r: 'Roller Door', l: 'Door Slat', x: 'PX Coral', '*': { token: 'Laser Lime', mode: 'glow' } });
    /* the box with its door recess, the cantilevered roof */
    var box = grid(G4), i, j;
    box.box(-3, 2, 0, 3, -3, 0, 'W').box(-4, 3, 4, 4, -3, 1, function (a) { return a === -2 || a === 1 ? 'w' : 'R'; });
    for (i = -2; i <= 1; i++) for (j = 0; j <= 2; j++) box.clear(i, j, 0);
    /* the striped roller door, the chequered fascia, the tool chest */
    var det = grid(G8);
    det.box(-4, 3, 0, 5, 0, 0, function (a, b) { return b & 1 ? 'l' : 'r'; }).box(-1, 0, 0, 0, 0, 0, 'c');
    det.box(-8, 7, 8, 9, 4, 4, function (a, b) { return a >= -3 && a <= 2 ? null : (a + b) & 1 ? 'k' : 'w'; });
    det.box(-6, -5, 0, 1, 2, 3, 'x').box(-6, -5, 2, 2, 2, 3, 'c');
    /* the bolt sign on the roof edge, three tyre stacks */
    var fine = grid(G16);
    fine.box(-6, 5, 16, 23, 8, 9, 'k').bitmap(BOLT, { '#': '*' }, { at: [-3, 16, 9] });
    tyres(fine, 9, 5, 3); tyres(fine, 9, 10, 2); tyres(fine, -13, 9, 2);
    var k = kartInto(grid(G32), kid, 'kart');
    return model('att_kart', pal, [box, det, fine, [k, [PARKED.x, 0, PARKED.z]]], {
      pivots: { kart: [PARKED.x, 0, PARKED.z] },
      anchors: { spot: [-0.3, 0, 0.72], seat: parked(KART.seat).concat('kart'), exhaust: parked(KART.exhaust).concat('kart') }
    });
  }

  /* ================================================================
     TRACK DIORAMAS (track_*): an oval road on a rounded slab (G16, 32 × 22)
     ================================================================ */
  function puff(o, i, k, h, leaf, lit) {
    o.box(i, i + 1, 2, h, k, k + 1, 'P');
    o.blob(i + 0.5, h + 3, k + 0.5, 3.2, 2.8, 3.2, function (a, j) { return j > h + 3 ? lit : leaf; }, 2.6);
  }
  function track(id) {
    var o = grid(G16), A = 5, volcano = id === 'track_volcano', beach = id === 'track_beach', i, k;
    var pal = { g: 'TRACKS.' + id + '.grass', r: 'Asphalt', l: 'Cloud White', x: 'Coral', w: 'Cloud White', k: 'PX Penguin Back', P: beach ? 'Palm Bark' : 'PX Trunk',
      F: 'Frond', e: 'PX Leaf', E: 'PX Leaf Lit', c: 'Volcano Rock', C: 'PX Att Rock Lit', '*': { token: 'Rainbow Orange', mode: 'glow' },
      a: 'PX Sea Top 2', f: 'Foam', K: volcano ? 'KARTS.kart_gold' : beach ? 'KARTS.kart_blue' : 'KARTS.kart_red', h: 'Blossom Light', s: 'Peach Coral' };
    for (k = -11; k <= 10; k++) for (i = -16; i <= 15; i++) {
      var x = Math.abs(i + 0.5) - A, z = k + 0.5, d = x > 0 ? Math.sqrt(x * x + z * z) : Math.abs(z);
      if (d > 10.7) continue;
      var seg = x > 0 ? Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 7)) : Math.floor((i + 16) / 2), c = 'g';
      if (beach && d > 9.9 && k > 3) { o.set(i, 0, k, d > 10.3 ? 'a' : 'f'); continue; }   /* a little water edge */
      if (d > 5 && d <= 6) c = seg & 1 ? 'x' : 'w';
      else if (d > 9 && d <= 10) c = seg & 1 ? 'w' : 'x';
      else if (d > 6 && d <= 9) c = k > 0 && (i === 0 || i === 1) ? ((i + k) & 1 ? 'k' : 'w') : d > 7 && d <= 8 && x <= 0 && seg % 3 === 0 ? 'l' : 'r';
      o.set(i, 0, k, 'g').set(i, 1, k, c);
    }
    /* the start flag, a little kart on the grid */
    o.box(-1, -1, 2, 9, 4, 4, 'w').box(0, 4, 6, 9, 4, 4, function (a, j) { return (a + j) & 1 ? 'k' : 'w'; });
    o.box(4, 8, 2, 3, 6, 8, 'K').set(6, 4, 7, 'k');
    [[4, 6], [8, 6], [4, 8], [8, 8]].forEach(function (w) { o.box(w[0], w[0], 2, 2, w[1], w[1], 'k'); });
    if (volcano) {                                                                    /* a stepped volcano, steady lava glow */
      o.lathe([[4.6, 2, 2, 'c'], [4, 3, 3, 'c'], [3.4, 4, 4, 'c'], [2.8, 5, 5, 'c'], [2.2, 6, 7, 'c'], [1.6, 8, 9, 'c']], { at: [-3.5, -0.5] });
      o.hashTone('c', 'C', 0.3, 'volcano');
      o.box(-4, -3, 8, 9, -1, 0, '*').box(-4, -4, 5, 7, 1, 1, '*').set(-2, 5, 2, '*').set(-2, 4, 2, '*');
      o.box(5, 6, 2, 3, -2, -1, 'c').set(7, 2, 1, 'C').box(-10, -9, 2, 2, 0, 1, 'C');
    } else if (beach) {
      palm(o, -6, -1, 7); palm(o, 5, 1, 6);
      o.box(-2, 0, 2, 2, -2, -2, 's').box(-1, -1, 2, 2, -3, -1, 's').box(9, 10, 2, 2, -2, -1, 'h');
    } else { puff(o, -8, -1, 4, 'e', 'E'); puff(o, 5, -2, 3, 'e', 'E'); }
    return model(id, pal, [o], { anchors: { spot: [0, 0.125, 0] } });
  }

  /* ================================================================
     THE HOME LAND DIORAMAS (land_cove, land_meadow): a mini island on candy strata (G8)
     ================================================================ */
  function isle(o, top) {
    for (var k = -6; k <= 5; k++) for (var i = -7; i <= 6; i++) {
      var e = Math.pow(Math.abs(i + 0.5) / 7.2, 2.6) + Math.pow(Math.abs(k + 0.5) / 6.2, 2.6);
      if (e > 1) continue;
      if (e <= 0.3) o.set(i, 0, k, '3');
      if (e <= 0.58) o.set(i, 1, k, '2');
      if (e <= 0.84) o.set(i, 2, k, '1');
      o.set(i, 3, k, 'e');
      top(i, k, e, Math.sin(i * 0.9 + 1) + Math.cos(k * 1.1) > 0.3);
    }
  }
  var STRATA = { 1: { token: 'PX Home Strata 1', mode: 'soft' }, 2: { token: 'PX Home Strata 2', mode: 'soft' }, 3: { token: 'PX Home Strata 3', mode: 'soft' }, e: { token: 'PX Edge', mode: 'soft' } };
  function cove() {
    var o = grid(G8), pal = mix(STRATA, { s: { token: 'PX Cove Sand', mode: 'soft' }, t: { token: 'PX Beach 2', mode: 'soft' }, a: 'PX Sea Top 1', b: 'PX Sea Top 2', f: 'Foam',
      P: 'Palm Bark', F: 'Frond', G: 'Frond Light', c: 'Peach Coral', h: 'Blossom Light', w: 'Cloud White', x: 'PX Coral' });
    isle(o, function (i, k, e, alt) {
      var r = Math.sqrt((i - 3) * (i - 3) + (k - 4) * (k - 4));                       /* the lagoon bites into the front */
      if (r <= 3.7) o.set(i, 3, k, r <= 2 ? 'b' : r <= 2.9 ? 'a' : 'f');
      else o.set(i, 4, k, alt ? 't' : 's');
    });
    o.box(-4, -4, 5, 6, -2, -2, 'P').box(-3, -3, 7, 8, -2, -2, 'P').set(-3, 10, -2, 'G');   /* a leaning palm */
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { o.set(-3 + d[0], 9, -2 + d[1], 'F').set(-3 + 2 * d[0], 9, -2 + 2 * d[1], 'F').set(-3 + 3 * d[0], 8, -2 + 3 * d[1], 'F'); });
    o.set(-3, 9, -2, 'F');
    o.box(-2, 0, 5, 5, 2, 2, 'c').box(-1, -1, 5, 5, 1, 3, 'c').set(-5, 5, 2, 'h').set(2, 5, -4, 'h');   /* starfish, shells */
    o.box(3, 3, 5, 8, -3, -3, 'w').disc(3, 9, -3, 2.3, 'y', function (i, j, k) { return (i - 3) * (k + 3) >= 0 ? 'x' : 'w'; }).set(3, 10, -3, 'x');   /* a parasol */
    return model('land_cove', pal, [o], { anchors: { spot: [0, 0.625, 0] } });
  }
  function meadow() {
    var o = grid(G8), fl = grid(G16), pal = mix(STRATA, { m: { token: 'PX Meadow', mode: 'soft' }, n: { token: 'PX Meadow 2', mode: 'soft' }, r: 'PX Meadow Cliff',
      P: 'PX Trunk', l: 'PX Leaf', L: 'PX Leaf Lit', S: 'Stem', w: 'Cloud White', y: 'Tulip Yellow', p: 'Tulip Pink' });
    isle(o, function (i, k, e, alt) {                                                 /* two chunky ledges rising to the west */
      var h = e > 0.93 ? 4 : i <= -3 ? 8 : i <= 0 ? 6 : 4;
      for (var j = 4; j <= h; j++) o.set(i, j, k, alt ? 'n' : 'm');
    });
    o.set(1, 5, -2, 'r').box(1, 1, 5, 5, 2, 3, 'r').set(-2, 7, 0, 'r').set(-2, 7, -4, 'r').set(5, 5, -3, 'r');   /* warm stone */
    o.box(-5, -5, 9, 10, -1, -1, 'P').blob(-5, 12.6, -1, 2.6, 2.3, 2.6, function (i, j) { return j > 12 ? 'L' : 'l'; }, 2.6);   /* a puff tree */
    [[6, 10, 2, 'w'], [9, 10, -6, 'y'], [3, 10, 6, 'p'], [-4, 14, 5, 'w'], [-2, 14, -7, 'p'], [-11, 18, 4, 'y'], [-9, 18, -6, 'w'], [8, 10, 5, 'p']]
      .forEach(function (f) { fl.box(f[0], f[0], f[1], f[1] + 1, f[2], f[2], 'S').box(f[0], f[0] + 1, f[1] + 2, f[1] + 3, f[2], f[2] + 1, f[3]); });
    return model('land_meadow', pal, [o, fl], { anchors: { spot: [0.4, 0.625, 0.2] } });
  }

  /* ================================================================
     PURE VOXELS (Node tests, coverage, photocards): voxels[id](st, ctx) → VoxModel
     ================================================================ */
  var voxels = {
    att_course: function (st) { ready(); return gate('att_course', pick('course', st)); },
    att_pitch: function (st) { ready(); return stadium('att_pitch', pick('stadium', st), true, pick('ball', st)); },
    att_kart: function (st) { ready(); return garage(st); },
    land_cove: function () { ready(); return cove(); },
    land_meadow: function () { ready(); return meadow(); }
  };
  function each(list, fn) { list.forEach(function (id) { voxels[id] = function () { ready(); return fn(id); }; }); }
  each(IDS.courses, function (id) { return gate(id, id); });
  each(IDS.balls, ball);
  each(IDS.stadiums, function (id) { return stadium(id, id, false, 'ball_classic'); });
  each(IDS.karts, kart);
  each(IDS.tracks, track);

  /* ================================================================
     ANIMATION (the documented handle a; no allocation per frame)
     ================================================================ */
  var M = null, R3 = [0, 0, 0], P3 = [0, 0, 0], CH = {}, CP = {}, memo = Object.create(null);
  function freq(name, dflt) { var L = look(), f = L && L.ART3 && L.ART3.FREQS && L.ART3.FREQS[name]; return f > 0 ? f : dflt; }
  /* the Showtime bulb chase: the two groups swap every beat and step Magenta → Cyan → Violet every
     2 beats. A bulb's on / off cycle is 2 beats, held to ART3.FREQS.bulbChase; steady when reduced */
  var CHASE = ['pink', 'cyan', 'violet'];
  function chaseState(t, bpm, show, reduced, out) {
    out = out || {};
    if (!(show > 0.5)) { out.a = 'day'; out.b = 'day'; return out; }
    if (reduced) { out.a = 'pink'; out.b = 'cyan'; return out; }
    var n = Math.floor((t || 0) * Math.min((bpm > 0 ? bpm : 118) / 60, 2 * freq('bulbChase', 1.5)));
    var col = CHASE[((Math.floor(n / 2) % 3) + 3) % 3];
    if (n & 1) { out.a = 'dim'; out.b = col; } else { out.a = col; out.b = 'dim'; }
    return out;
  }
  /* the crowd: a soft breath by day; a beat bounce and stick sway at Showtime (≤ FREQS.beatPulse) */
  function crowdPose(t, bpm, show, reduced, phase, out) {
    out = out || {};
    out.cy = 0; out.wx = 0; out.wy = 0;
    if (reduced) return out;
    t = t || 0;
    if (show > 0.5) {
      var s = Math.sin(Math.PI * t * Math.min((bpm > 0 ? bpm : 118) / 60, freq('beatPulse', 118 / 60)));
      out.cy = 0.012 * Math.abs(s); out.wx = 0.022 * s; out.wy = 0.006 * Math.abs(s);
    } else out.cy = 0.004 * Math.sin(2 * Math.PI * (t / 2.4 + (phase || 0)));
    return out;
  }
  function pose(a, name, rx, ry, rz, px, py, pz) {
    if (!a || typeof a.pivot !== 'function') return;
    var p = a.pivot(name);
    if (!p || typeof p.set !== 'function') return;
    R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = px; P3[1] = py; P3[2] = pz;
    p.set(R3, P3, 1);
  }
  function setState(a, key, v) { if (a && typeof a.state === 'function') a.state(key, v); }
  function mem(a) {
    var k = a && a.uid != null ? a.uid : '_';
    return memo[k] || (memo[k] = { spin: 0, cheer: 0, a: '', b: '', w: -1, tw: -1 });
  }
  function forget(uid) { delete memo[uid != null ? uid : '_']; }
  function stale(a, m) { var t = a.t || 0; return !(t - m.tw < 0.5 && t >= m.tw); }   /* re-send every 0.5 s: a restyle resets instance colours */
  function courseBulbs(a, m, k) {
    chaseState(a.t, a.bpm, k, !!a.reduced, CH);
    var old = stale(a, m);
    if (CH.a !== m.a || old) { m.a = CH.a; setState(a, 'bulbA', CH.a); }
    if (CH.b !== m.b || old) { m.b = CH.b; setState(a, 'bulbB', CH.b); }
    if (old) m.tw = a.t || 0;
  }
  function courseIdle(a) {
    if (!a) return false;
    var m = mem(a), red = !!a.reduced, t = a.t || 0, base = M ? M.spin(t, 0.25, a.phase || 0, red) : 0;
    pose(a, 'spin', 0, base + m.spin, 0, 0, red ? 0 : 0.02 * Math.sin(2 * Math.PI * (t / 4 + (a.phase || 0))), 0);
    courseBulbs(a, m, a.show || 0);
    memberFrom(a);
    return !red;
  }
  function courseShow(a, k) { if (a) { var m = mem(a); m.tw = -1; courseBulbs(a, m, k); memberFrom(a); } }
  function pitchWands(a, m, k) {
    var v = k > 1 ? 1 : k > 0 ? k : 0;
    if (Math.abs(v - m.w) > 0.02 || stale(a, m)) { m.w = v; m.tw = a.t || 0; setState(a, 'wands', v); }
  }
  function pitchIdle(a) {
    if (!a) return false;
    var m = mem(a), red = !!a.reduced;
    crowdPose(a.t, a.bpm, a.show || 0, red, a.phase, CP);
    pose(a, 'crowd', 0, 0, 0, 0, CP.cy + 0.03 * m.cheer, 0);
    pose(a, 'wands', 0, 0, 0, CP.wx, CP.wy, 0);
    pitchWands(a, m, a.show || 0);
    return !red;
  }
  function pitchShow(a, k) { if (a) { var m = mem(a); m.tw = -1; pitchWands(a, m, k); } }
  /* one SLMotion act: samples the timeline, applies it, fires its cues (sfx + emits) */
  function timeline(a, name, apply, done, where) {
    if (!M || !M.ACTS || !M.ACTS[name]) return null;
    var o = { reduced: !!(a && a.reduced) }, dur = M.durOf(name, o), cues = M.cues(name, o), ci = 0, out = {}, ended = false;
    function end(h) { if (!ended) { ended = true; done(h || a); } }
    return {
      name: name, dur: dur,
      update: function (h, t) {
        if (ended) return false;
        h = h || a; t = t > 0 ? t : 0;
        M.sample(name, t < dur ? t : dur, out, o);
        apply(h, out, t);
        while (ci < cues.length && cues[ci].t <= t) fire(h, cues[ci++], where);
        if (t >= dur) { end(h); return false; }
        return true;
      },
      cancel: function () { end(a); }
    };
  }
  function fire(h, c, where) {
    try {
      if (c.sfx && typeof h.sfx === 'function') h.sfx(c.sfx, c.vol == null ? 1 : c.vol, c.step);
      if (c.emit && typeof h.emit === 'function') h.emit(c.emit, where, c.n || 1);
    } catch (e) { /* a missing sound or particle never breaks the act */ }
  }
  /* gate: the ✦ whirls two extra turns · pitch: the ball hops and rolls, the crowd jumps ·
     garage: the parked kart revs (a 3 Hz wobble of a few degrees, two exhaust puffs) */
  function courseAct(a, name) {
    if (name && name !== 'launch') return null;
    var m = mem(a);
    return timeline(a, 'launch', function (h, out) { m.spin = out.spinDeg || 0; courseIdle(h); }, function (h) { m.spin = 0; courseIdle(h); }, 'banner');
  }
  function pitchAct(a, name) {
    if (name && name !== 'launch') return null;
    var m = mem(a);
    return timeline(a, 'launch', function (h, out, t) {
      pose(h, 'ball', 0, 0, -(out.spinDeg || 0) * 0.5, 0, (out.hop || 0) * 0.6, 0);
      m.cheer = t > 0 && t < 0.6 ? Math.sin(Math.PI * t / 0.6) : 0;
      pitchIdle(h);
    }, function (h) { pose(h, 'ball', 0, 0, 0, 0, 0, 0); m.cheer = 0; pitchIdle(h); }, 'spot');
  }
  function kartAct(a, name) {
    if (name && name !== 'launch' && name !== 'kartRev') return null;
    return timeline(a, 'kartRev', function (h, out, t) {
      pose(h, 'kart', 0, 0, out.wobble || 0, 0, 0.01 * Math.abs(Math.sin(Math.PI * 6 * t)) * (1 - (out.k || 0)), 0);
    }, function (h) { pose(h, 'kart', 0, 0, 0, 0, 0, 0); }, 'exhaust');
  }

  /* ---------------- the member underline (atlas cell CELL_MEMBER) ---------------- */
  var atlasOf = null, memberHex = null, memberSeen = null;
  function drawMember() {
    var A = null, L = look(), hex = memberHex || (L && typeof L.resolve === 'function' && L.resolve(MEMBER)) || '#FF8FC8';
    try { A = atlasOf ? atlasOf() : null; } catch (e) { A = null; }
    if (A && typeof A.define === 'function') A.define(CELL_MEMBER, { w: 4, h: 4, draw: function (c) { c.fillStyle = hex; c.fillRect(0, 0, 4, 4); } });
  }
  function setMember(hex) {
    var s = typeof hex === 'string' ? hex.trim() : '', h = /^#?[0-9a-f]{6}$/i.test(s) ? ('#' + s.replace('#', '')).toUpperCase() : null;
    if (!h) return false;
    if (h !== memberHex) { memberHex = h; drawMember(); }
    return true;
  }
  function setUser(u) { return !!(u && setMember(u.color)); }
  function memberFrom(a) {
    var h = a && !a.photocard && (typeof a.member === 'string' ? a.member : a.user && typeof a.user.color === 'string' ? a.user.color : null);
    if (h && h !== memberSeen) { memberSeen = h; setMember(h); }
  }

  /* ================================================================
     REGISTRATION: SL3D.defineVox('attractions', models) → {id: handler}
     ================================================================ */
  /* a course or a ball displays more than its v2 look.tris (the dressing alone, a bare ball): its
     template is built against the v3 cap, so the kit's QA budget warning stays meaningful */
  function build(id) {
    return function (ctx) {
      var L = look(), V = ctx.K && ctx.K.vox, c = mix(ctx);
      if (!V || typeof V.template !== 'function') throw new Error('no VoxHub bound (vox-gl.js)');
      c.look = mix(ctx.look, { tris: L && typeof L.trisCap === 'function' ? L.trisCap(id, ctx.tier) : 2600 });
      return V.template(c, voxels[id](ctx.st, ctx)).done();
    };
  }
  function models(K) {
    M = (root && root.SLMotion) || sibling('SLMotion', './motion.js') || M;
    ready();
    atlasOf = K ? function () { var V = K.vox; return V && typeof V.atlas === 'function' ? V.atlas() : null; } : null;
    drawMember();
    var out = {}, gateExtra = { idle: courseIdle, show: courseShow, forget: forget, setUser: setUser, setMember: setMember };
    ALL_IDS.forEach(function (id) { out[id] = { voxels: voxels[id] }; });
    ['att_course'].concat(IDS.courses).forEach(function (id) { out[id] = mix(out[id], gateExtra); });
    IDS.courses.concat(IDS.balls).forEach(function (id) { out[id].build = build(id); });
    out.att_course.act = courseAct;
    out.att_pitch.idle = pitchIdle; out.att_pitch.show = pitchShow; out.att_pitch.act = pitchAct; out.att_pitch.forget = forget;
    IDS.stadiums.forEach(function (id) { out[id].show = pitchShow; out[id].forget = forget; });
    out.att_kart.act = kartAct;
    return out;
  }

  ready();
  return {
    IDS: IDS, ALL_IDS: ALL_IDS, SLOTS: SLOTS, SLOT_DEFAULTS: SLOT_DEFAULTS, TOKENS: TOKENS, BULBS: BULBS, SPARK: SPARK, KART: KART, PARKED: PARKED,
    CELL_MEMBER: CELL_MEMBER, pick: pick, voxels: voxels, chaseState: chaseState, crowdPose: crowdPose, setMember: setMember, models: models
  };
}));
