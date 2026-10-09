/* ================================================================
   My Island v3 — SLPxCity: the seven city buildings in Pixel Blocks (W2.4; voxel-engine PX6).
   window.SLPxCity in the browser (it registers SL3D.defineVox('city', factory)); require() in
   Node gives the pure layer: voxels {id: fn(st, o) → VoxModel} and the helpers the tests read.
     bld_photobooth (snap) · bld_boba (serve) · bld_ledtower (screen) · bld_recording (record) ·
     bld_dance (dance) · bld_rooftop (hangout) · bld_stage (encore)

   MODELS (pure data, SLVox format). G4 shells centred on the pivot column (3 / 7 / 11 voxels per
   1 / 2 / 3 cells: the base stays inside fp − 0.14 u), G8 details and G16 trims edge-aligned, so
   every finer face lands on a coarser one (D11). Item space as the kit: base y = 0, facing +z;
   only signs, canopies, the giant cup and the headphones overhang, above y 1.0. Palette tokens
   only (PALETTE_V3, the older tables and the 'PX City …' tokens this file adds, D50).
   TRIMS: stateKey 'v:<n>' → SLIslandLook.trimOf(id, n) = {accent, signSide, stripe}. The accent
   voxels take the child's member colour on trim 0 (they sit in the perCopy part, and this file
   writes the colour over their baked AO) and Neon Magenta / LED Cyan on trims 1 / 2; signSide 'R'
   mirrors the model across x; stripe A | B | C moves the accent to another band of the building.
   WORDS (D32): only the atlas cells 'word:PHOTO', 'word:ON AIR', 'word:DANCE', this file's own
   LED cell of the word ENCORE (all SIGN_WORDS) and the child's own name / initial cells; the
   café's sign is a cup and a heart, the stage's frame cycle a heart, a note and a 4-point ✦.

   PARTS (≤ 5): body · 'copy_fx', the one perCopy part of a building (its lamps: glow voxels
   whose vertex colours this file writes; its LED decals, whose atlas cell it moves; the member
   accent) · its pivots · 'state_onAir' / 'beacon_state_beacon' (D51). model.fx lists the lamps
   and LED screens as item-space boxes {lamps: [[x0, y0, z0, x1, y1, z1, group]], leds: [[…, name]]}.
     bld_photobooth  pivots flash (the lens), strip, curtainL, curtainR · anchors top spot strip
                     sign lens bulbs · lamps 0–2 the countdown bulbs, 3 the lens
     bld_boba        pivots hatch (the glass door), pearls, cup (the served one) · anchors top spot
                     seat table cup
     bld_ledtower    pivots screen, wipe ⊂ screen, beacon · anchors top spot glow screenFront ·
                     LED screens 'square' (initial / portrait / pictogram) and 'wide' (16×8 frames)
     bld_recording   pivots meter, mic, phones · anchors top spot onair porthole ringL ringR mic ·
                     lamps 0–7 the VU column
     bld_dance       pivots floor, speaker · anchors top spot floor door sign speaker · lamps 0–5
                     the deck tiles
     bld_rooftop     pivots deck (the beanbags), scope, bulbs · anchors top spot roof stair scope
                     bulbL bulbM bulbR · lamps 0–8 the string of bulbs
     bld_stage       pivots lights (the four moving heads tilt together), head0–3 ⊂ lights, crowd ·
                     anchors top spot deck cone0–2 mark0–3 (deck height) stepL stepR pit foot ·
                     lamps 0–7 the footlights, 8–11 the light pools · LED screen 'wall'. The crowd
                     (12 fans, 8 on LOW, in the pit in front of the footprint) exists only in the
                     island template (ctx.ns 'vox'): build() asks SL3D.vox.makeFan at build time
                     (D76; else its own hooded fans), keeps them inside the stage's triangle cap and
                     collapses their geometry in the template, so ghosts, bakes and photocards never
                     show them; the encore stands them up.

   LED SCREENS step atlas frames at FREQS.ledFrame (0.6 Hz, D83): a screen never changes sooner
   than 1 / ledFrame s after its last change, except for a tap's program change (the tower's wipe
   bar, the stage's ENCORE; ≥ RATE.screen 0.5 s apart). Photocards (a.photocard, or a handle
   without a batch) show the star field and no name, and take no member colour.
   ACTS: the SLMotion timelines of V4.54 (snap, serve, screen, record, dance, hangout, encore) on
   the same pivots, cues and perform kinds; one live act per uid, a re-tap restarts it from the
   interrupted pose, cancel rests the pivots, reduced motion is the instant end state. Chases
   light each lamp once per 4 beats (≤ 0.5 Hz), beat pulses ≤ 1.97 Hz, the bulb wave 0.8 Hz,
   the beacon breathes at 0.5 Hz, lamps slew ≥ 0.25 s. Nothing here reads or writes points.
   HANDLERS: voxels(st, ctx) · idle(a) · act(a) · show(a, k) · handle(obj, o) · forget(uid) ·
   setUser(u) (shared: the atlas's name / initial cells, the name pages, the member colour) ·
   build(ctx) on the stage only.
   ================================================================ */
(function (root, factory) {
  var api;
  if (typeof module === 'object' && module.exports) {
    var req = function (p) { try { return require(p); } catch (e) { return null; } };
    api = module.exports = factory(root, { vox: req('./vox.js'), look: req('../world-look.js'), motion: req('./motion.js'), gl: req('./vox-gl.js'), kit: req('./kit.js') });
  } else {
    api = root.SLPxCity = factory(root, {});
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('city', function (K, S) { return api.factory(K, S); });
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, N) {
  'use strict';

  var VERSION = 1;
  var IDS = ['bld_photobooth', 'bld_boba', 'bld_ledtower', 'bld_recording', 'bld_dance', 'bld_rooftop', 'bld_stage'];
  var ACT = { bld_photobooth: 'snap', bld_boba: 'serve', bld_ledtower: 'screen', bld_recording: 'record', bld_dance: 'dance', bld_rooftop: 'hangout', bld_stage: 'encore' };
  var PERFORM = { bld_photobooth: 'pose', bld_boba: 'sip', bld_dance: 'studio', bld_rooftop: 'roof', bld_stage: 'stage' };
  var G4 = 0.25, G8 = 0.125, G16 = 0.0625, GC = 0.05;
  var PI = Math.PI, TAU = PI * 2;
  var NEON4 = ['Neon Magenta', 'LED Cyan', 'Electric Violet', 'Laser Lime'];
  var TRIM = { accent: ['@member', 'Neon Magenta', 'LED Cyan'], signSide: ['L', 'R'], stripe: ['A', 'B', 'C'] };
  var PART = 'copy_fx';

  function vox() { return N.vox || root.SLVox; }
  function looks() { return N.look || root.SLIslandLook || null; }
  function mo() { return N.motion || root.SLMotion || null; }
  function gl() { return N.gl || root.SLVoxGL || null; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function frac(v) { return v - Math.floor(v); }

  /* ---------------- colour tokens this file adds (D50) ---------------- */
  var TOKENS = {
    'PX City Navy': '#2E2F6B', 'PX City Violet': '#7B5CFF', 'PX City Deck': '#D8CAFF', 'PX City Deck 2': '#C6B2FF',
    'PX City Rose': '#FFC4DD', 'PX City Steel': '#A7ACC9', 'PX City Truss': '#CFD3EA', 'PX City Slate': '#55597A', 'PX City Tea': '#E2B17C',
    'PX City Tea Light': '#F3DAB8', 'PX City Pearl': '#5A3426', 'PX City Straw': '#3FC8E6', 'PX City Straw Light': '#8FE4F4', 'PX City Clear': '#EEF8FF',
    'PX City Sky': '#9FDCFF', 'PX City Brick': '#FF9E8A', 'PX City Brick 2': '#F5866F', 'PX City Beacon Dim': '#B34A80'
  };
  var tokensDone = false;
  function tokens() {
    var L = looks();
    if (tokensDone || !L || typeof L.addTokens !== 'function') return;
    tokensDone = true;
    L.addTokens('px-city', TOKENS);
  }
  var BASE = {
    W: 'Cloud White', k: 'PX Penguin Back', n: 'PX City Navy', y: 'PX Sunny', o: 'Sunset Amber', p: 'PX Candy Pink', P: 'Primary Pink',
    r: 'PX City Rose', m: 'PX Mint', l: 'PX Lilac', L: 'PX Lilac Base', v: 'PX City Violet', d: 'PX City Deck',
    D: 'PX City Deck 2', b: 'PX Sky Blue', B: 'PX City Sky', c: 'PX Coral', g: 'PX City Steel', G: 'PX City Truss', s: 'PX City Slate',
    t: 'PX City Tea', T: 'PX City Tea Light', e: 'PX City Pearl', q: 'PX City Straw', Q: 'PX City Straw Light', i: 'PX City Clear',
    f: 'PX Cream Wall', w: { token: 'PX Tree Plank', mode: 'plank' }, z: 'Grape', h: { token: 'PX Glint', mode: 'glow' }
  };
  function glow(token, o) { return Object.assign({ token: token, mode: 'glow' }, o || {}); }
  var FX = { copy: 'fx' };

  /* ================================================================
     DRAFT — a model under construction: layers on their own grids; pivots, anchors, lamps and LED
     screens in item units. model() mirrors everything across x for a signSide 'R' trim.
     ================================================================ */
  function variantOf(st) { var v = st && typeof st.variant === 'number' && isFinite(st.variant) ? st.variant | 0 : 0; return v < 0 ? 0 : v > 2 ? 2 : v; }
  function Draft(id, st) {
    tokens();
    var L = looks(), v = variantOf(st);
    var t = L && typeof L.trimOf === 'function' ? L.trimOf(id, v) : { accent: TRIM.accent[v], signSide: TRIM.signSide[v % 2], stripe: TRIM.stripe[v] };
    this.id = id; this.stripe = t.stripe; this.flip = t.signSide === 'R'; this.member = t.accent === '@member';
    this.accent = this.member ? (L && L.MEMBER_FALLBACK) || 'Bubblegum' : t.accent;
    this.layers = []; this.pivots = {}; this.anchors = {}; this.lamps = []; this.leds = [];
    this.pal = Object.assign({}, BASE);
    this.pal.A = this.member ? { token: this.accent, copy: 'fx' } : this.accent;          /* the trim accent, and its glow twin */
    this.pal.F = this.member ? glow(this.accent, FX) : glow(this.accent);
  }
  /* a G4 layer is centred on the pivot column (odd widths); finer ones are edge-aligned unless centred */
  Draft.prototype.layer = function (g, at, centred) {
    var o = vox().grid({ grid: g, origin: g === G4 || centred ? [0.5, 0, 0.5] : [0, 0, 0] });
    this.layers.push({ o: o, at: at || [0, 0, 0] });
    return o;
  };
  /* the item-space box of a voxel range of layer o */
  Draft.prototype.box = function (o, i0, i1, j0, j1, k0, k1) {
    var ly = this.layers.filter(function (l) { return l.o === o; })[0], g = o.grid, og = o.origin, at = ly.at;
    return [(i0 - og[0]) * g[0] + at[0], (j0 - og[1]) * g[1] + at[1], (k0 - og[2]) * g[2] + at[2],
            (i1 + 1 - og[0]) * g[0] + at[0], (j1 + 1 - og[1]) * g[1] + at[1], (k1 + 1 - og[2]) * g[2] + at[2]];
  };
  /* lamp group n: the perCopy glow voxels inside this range (set them with their own palette char) */
  Draft.prototype.lamp = function (n, o, i0, i1, j0, j1, k0, k1) { this.lamps.push(this.box(o, i0, i1, j0, j1, k0, k1).concat(n)); return this; };
  /* an LED screen: one perCopy decal on the +z faces of at … at + size */
  Draft.prototype.screen = function (name, o, at, size, cell) {
    o.decal({ face: '+z', at: at, size: size, cell: cell, copy: 'fx' });
    this.leds.push(this.box(o, at[0], at[0] + size[0] - 1, at[1], at[1] + size[1] - 1, at[2], at[2]).concat(name));
    return this;
  };
  Draft.prototype.pivot = function (name, at, parent) { this.pivots[name] = { at: at, parent: parent || null }; return this; };
  Draft.prototype.anchor = function (name, at, pivot) { this.anchors[name] = { at: at, pivot: pivot || null }; return this; };
  Draft.prototype.model = function () {
    var s = this.flip ? -1 : 1, self = this;
    var m = { id: this.id, grid: G8, origin: [0, 0, 0], palette: this.pal, layers: [], pivots: {}, anchors: {}, decals: [], cull: ['-y', '-z'] };
    function at(p) { return [s * p[0] / G8 - 0.5, p[1] / G8 - 0.5, p[2] / G8 - 0.5]; }
    function box(b) { return s > 0 ? b : [-b[3], b[1], b[2], -b[0], b[4], b[5], b[6]]; }
    this.layers.forEach(function (ly, li) {
      if (s < 0) ly.o.mirrorX();
      ly.o.decals.forEach(function (dc) { var c = Object.assign({}, dc); c.layer = li; m.decals.push(c); });
      m.layers.push({ vox: ly.o.snapshot(), at: [s * ly.at[0], ly.at[1], ly.at[2]] });
    });
    Object.keys(this.pivots).forEach(function (n) { m.pivots[n] = { at: at(self.pivots[n].at), parent: self.pivots[n].parent }; });
    Object.keys(this.anchors).forEach(function (n) { var a = self.anchors[n]; m.anchors[n] = a.pivot ? { at: at(a.at), pivot: a.pivot } : at(a.at); });
    m.fx = { lamps: this.lamps.map(box), leds: this.leds.map(box), member: this.member, accent: this.accent };
    return m;
  };

  /* ================================================================
     THE MODELS
     ================================================================ */
  /* ---- Photo Booth (1×1, h 1.6): a sunny kiosk with a striped curtain between two posts, the
     PHOTO sign band, a white roof with three countdown bulbs and a chunky camera on top; the
     photo strip slides out of the sign side's wall ---- */
  function booth(st) {
    var d = new Draft('bld_photobooth', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8), f = d.layer(G16);
    Object.assign(d.pal, { u: glow('PX Sky Blue', FX), x: glow('PX Bulb Warm', FX) });
    s.box(-1, 1, 0, 4, -1, 0, function (i, j) { return j === 3 ? 'v' : j === 4 && sp === 'A' ? 'A' : j === 0 ? (sp === 'B' ? 'A' : 'o') : 'y'; });
    s.box(-1, 1, 3, 4, 1, 1, function (i, j) { return j === 3 ? 'v' : sp === 'A' ? 'A' : 'y'; });   /* the sign band over the curtain, the trim band */
    s.decal('+z', [-1, 3, 1], [3, 1], 'word:PHOTO');
    [-3, 2].forEach(function (i) { e.box(i, i, 0, 5, 1, 2, function (i2, j) { return j < 2 ? (sp === 'B' ? 'A' : 'o') : 'y'; }); });   /* door posts */
    f.box(-4, 3, 0, 11, 2, 2, 'n');                                   /* the dark inside, its mat and a stool */
    f.box(-4, 3, 0, 0, 3, 5, 'l');
    f.box(-2, 1, 1, 3, 3, 4, 'P');
    f.box(-7, 6, 20, 21, -7, 6, sp === 'C' ? 'A' : 'W');              /* the roof's eave and its three countdown bulbs */
    [-5, -1, 3].forEach(function (i, n) { f.box(i, i + 1, 20, 21, 7, 7, 'x'); d.lamp(n, f, i, i + 1, 20, 21, 7, 7); });
    e.box(-2, 1, 11, 12, -2, 0, 'c');                                 /* the camera: body, lens barrel, its glass (the flash), glint, shutter */
    e.box(-1, 0, 11, 12, 1, 1, 'k');
    f.box(-2, 1, 22, 25, 4, 4, function (i, j) { return i === -2 || i === 1 || j === 22 || j === 25 ? 'W' : 'u'; });
    f.set(-1, 24, 4, 'h');
    d.lamp(3, f, -1, 0, 23, 24, 4, 4);
    f.box(2, 3, 26, 26, -3, -2, 'y');
    f.group('curtainL', function () { f.box(-4, -1, 3, 11, 5, 5, function (i) { return (i + 4 >> 1) & 1 ? 'W' : 'P'; }); });
    f.group('curtainR', function () { f.box(0, 3, 3, 11, 5, 5, function (i) { return (i >> 1) & 1 ? 'P' : 'W'; }); });
    f.group('strip', function () { f.box(1, 4, 4, 11, 0, 0, 'W'); });
    f.decal('+z', [1, 4, 0], [4, 8], 'photoStrip');
    d.pivot('flash', [0, 1.5, 0.19]).pivot('strip', [0.1875, 0.5, 0.03]).pivot('curtainL', [-0.25, 0.75, 0.34]).pivot('curtainR', [0.25, 0.75, 0.34]);
    d.anchor('top', [0, 1.85, 0]).anchor('spot', [0, 0, 0.47]).anchor('strip', [0.5, 0.5, 0.06]).anchor('sign', [0, 0.875, 0.44])
      .anchor('lens', [0, 1.5, 0.34]).anchor('bulbs', [0, 1.3125, 0.5]);
    return d.model();
  }

  /* ---- Boba Café (2×1, h 1.95): the mockup's pink kiosk under a giant taro cup (pearls, a
     sealed striped lid, a fat straw): a counter window of cups under a scalloped awning, a glass
     serving hatch, the cup + heart plaque, an umbrella table and two stools ---- */
  function boba(st) {
    var d = new Draft('bld_boba', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8), f = d.layer(G16);
    var cup = d.layer(G8, [-0.4375, 0.875, -0.0625], true), tb = d.layer(G8, [0.5625, 0, 0], true), i, j, k;
    d.pal.E = { token: 'PX City Pearl', pivot: 'pearls' };
    s.box(-3, 1, 0, 2, -1, 0, function (i2, j2, k2) { return j2 === 0 ? (sp === 'C' ? 'A' : 'p') : k2 === 0 && (i2 === -3 || i2 === 1) ? 'W' : 'r'; });
    s.box(-2, 0, 1, 2, 0, 0, null);                                   /* the counter window, set back */
    s.decal('+z', [-2, 1, -1], [3, 2], 'counterCups');
    e.box(-7, 2, 6, 6, -3, 0, 'm');                                   /* the mint roof */
    e.box(-6, 2, 2, 2, 1, 1, 'W');                                    /* the counter ledge */
    var aw = sp === 'A' ? 'A' : 'P';                                  /* the awning and its scallops */
    e.box(-7, 0, 6, 6, 1, 2, function (i2) { return (i2 + 7 >> 1) & 1 ? 'W' : aw; });
    e.box(-7, 0, 5, 5, 2, 2, function (i2) { return (i2 + 7 >> 1) & 1 ? null : aw; });
    f.box(2, 5, 6, 11, 2, 2, 'n');                                    /* the hatch: a dark opening behind a little glass door */
    f.group('hatch', function () { f.box(2, 5, 6, 11, 3, 3, 'W'); });
    f.decal('+z', [2, 6, 3], [4, 6], 'door:glass');
    f.group('cup', function () { f.box(3, 4, 6, 8, -1, 0, 'P'); f.box(3, 4, 9, 9, -1, 0, 'W'); f.set(4, 10, -1, 'q'); });
    e.box(0, 1, 7, 10, -1, -1, 'W'); e.box(0, 1, 11, 11, -1, -1, 'P');   /* the plaque: a cup and a heart (D32) */
    e.decal('+z', [0, 7, -1], [2, 2], 'cup'); e.decal('+z', [0, 9, -1], [2, 2], 'heart');
    /* the giant cup: pearls in the bottom rows, milk tea, a white lid, the striped film, the fat straw */
    cup.lathe([[2.5, 0, 6, function (i2, j2, k2) { return j2 < 2 ? 'T' : j2 < 5 ? 't' : j2 === 5 ? 'W' : (i2 + k2) & 1 ? 'r' : 'P'; }]]);
    for (j = 0; j < 2; j++) for (k = -2; k <= 2; k++) for (i = -2; i <= 2; i++) {
      if (!cup.has(i, j, k) || (cup.has(i + 1, j, k) && cup.has(i - 1, j, k) && cup.has(i, j, k + 1) && cup.has(i, j, k - 1))) continue;
      if (j ? !((i - k) & 3) : (i + k) & 1) cup.set(i, j, k, (i + 2 * k) % 3 ? 'e' : 'E');   /* every third pearl swirls on the pivot */
    }
    cup.box(0, 1, 4, 8, -1, 0, function (i2, j2) { return sp === 'B' ? 'A' : j2 > 7 ? 'Q' : j2 & 1 ? 'q' : 'Q'; });
    tb.box(0, 0, 0, 8, 0, 0, 'W');                                    /* the umbrella table and its stools */
    tb.box(-1, 1, 3, 3, -1, 1, 'p');
    for (k = -2; k <= 2; k++) for (i = -2; i <= 2; i++) {
      var r = Math.max(Math.abs(i), Math.abs(k));
      if (r === 2) tb.set(i, 8, k, (Math.floor(Math.atan2(k, i) / (PI / 4) + 8.5) & 1) ? 'q' : 'W');
      else tb.set(i, 9 + (r ? 0 : 1), k, r ? 'W' : 'P');
    }
    [-2, 2].forEach(function (k2) { tb.box(0, 0, 0, 1, k2, k2, 'l'); });
    d.pivot('hatch', [0.25, 0.75, 0.1875]).pivot('pearls', [-0.4375, 1, -0.0625]).pivot('cup', [0.25, 0.375, 0]);
    d.anchor('top', [0, 2.15, 0]).anchor('spot', [-0.3, 0, 0.47]).anchor('seat', [0.5625, 0.27, 0.25]).anchor('table', [0.5625, 0.5, 0])
      .anchor('cup', [-0.4375, 1.4, 0.3]);
    return d.model();
  }

  /* ---- LED Screen Tower (1×1, h 2.5): a stepped plinth and a mint mast carrying a navy head
     with a square screen over a wide one, a scan bar and a breathing beacon ---- */
  function tower(st) {
    var d = new Draft('bld_ledtower', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8), f = d.layer(G16);
    Object.assign(d.pal, { '!': glow('PX City Beacon Dim', { state: { key: 'beacon', off: 'PX City Beacon Dim', on: 'Neon Magenta' } }), '=': glow('PX Glint') });
    s.box(-1, 1, 0, 0, -1, 1, sp === 'B' ? 'A' : 'L');
    s.box(0, 0, 1, 3, 0, 0, sp === 'A' ? 'A' : 'm');
    e.box(-2, 1, 2, 2, -2, 1, 'l'); e.box(-2, 1, 7, 7, -2, 1, 'l');   /* a step on the plinth, a collar under the head */
    e.box(-4, 3, 8, 19, -2, 0, function (i, j) { return j === 8 || j === 19 ? (sp === 'C' ? 'A' : 'l') : 'n'; });
    d.screen('wide', e, [-3, 9, 0], [6, 3], 'led:stars:0').screen('square', e, [-3, 13, 0], [6, 6], 'sparkle');
    e.box(-5, -5, 13, 16, -1, -1, 'l'); e.box(4, 4, 13, 16, -1, -1, 'l');   /* side grips */
    e.group('beacon', function () { e.box(-1, 0, 20, 20, -1, 0, '!'); });
    f.group('wipe', function () { f.box(-6, 5, 17, 17, 2, 2, '='); });
    d.pivot('screen', [0, 1.75, 0.125]).pivot('wipe', [0, 1.09, 0.16], 'screen').pivot('beacon', [0, 2.5, 0]);
    d.anchor('top', [0, 2.8, 0]).anchor('spot', [0, 0, 0.47]).anchor('glow', [0, 1.75, -0.1]).anchor('screenFront', [0, 1.75, 0.25]);
    return d.model();
  }

  /* ---- Recording Studio (2×1, h 1.85): a sky-blue block wearing giant headphones, a retro mic
     on the roof, a red door, a porthole, the ON AIR sign and a chunky VU column ---- */
  function studio(st) {
    var d = new Draft('bld_recording', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8), mic = d.layer(G8, [0, 1, 0.125], true);
    Object.assign(d.pal, { O: glow('PX City Navy', { state: { key: 'onAir', off: 'PX City Navy', on: 'PX Coral' } }), x: glow('Laser Lime', FX), X: glow('Laser Lime', FX) });
    s.box(-3, 3, 0, 3, -1, 1, function (i, j, k) {
      return j === 3 ? (sp === 'B' && k === 1 ? 'A' : 'i') : j === 0 ? (sp === 'A' ? 'A' : 'b') : sp === 'C' && (i === -3 || i === 3) ? 'A' : 'B';
    });
    s.box(0, 3, 3, 3, 1, 1, 'O');
    s.decal('+z', [0, 3, 1], [4, 1], 'word:ON AIR');
    s.decal('+z', [-3, 0, 1], [2, 3], 'door:red');
    s.decal('+z', [1, 1, 1], [2, 2], 'porthole');
    s.box(-1, -1, 0, 3, 1, 1, null);                                  /* the VU column: 8 segments, two voxels wide */
    e.box(-3, -2, 0, 7, 1, 1, 'k');
    for (var j = 0; j < 8; j++) { e.box(-3, -2, j, j, 2, 2, j & 1 ? 'X' : 'x'); d.lamp(j, e, -3, -2, j, j, 2, 2); }
    mic.group('mic', function () {                                    /* a round-headed mic with a dark grille band */
      mic.box(0, 0, 0, 1, 0, 0, 's');
      mic.box(-1, 1, 2, 4, -1, 1, function (i, j2, k) { return j2 === 3 ? 'k' : Math.abs(i) + Math.abs(k) === 2 ? null : 'G'; });
    });
    e.group('phones', function () {                                   /* the band over the roof, a round cup at each end */
      [-1, 0].forEach(function (k) { e.ring(-0.5, 8, k, 6.5, 4.9, 'z', function (i, j2) { return j2 < 12 ? null : 'y'; }); });
      [[-8, 1.5, 'W'], [-7, 2.5, 'c'], [-6, 2.5, 'c'], [5, 2.5, 'c'], [6, 2.5, 'c'], [7, 1.5, 'W']].forEach(function (c) { e.disc(c[0], 10, -0.5, c[1], 'x', c[2]); });
      [-5, 4].forEach(function (i) { e.box(i, i, 11, 12, -1, 0, 'y'); });   /* the band's yokes */
    });
    d.pivot('meter', [-0.25, 0, 0.375]).pivot('mic', [0, 1, 0.125]).pivot('phones', [0, 1, 0]);
    d.anchor('top', [0, 2, 0]).anchor('spot', [-0.625, 0, 0.47]).anchor('onair', [0.5, 0.875, 0.44]).anchor('porthole', [0.5, 0.6, 0.45])
      .anchor('ringL', [-0.75, 1.25, 0.2]).anchor('ringR', [0.75, 1.25, 0.2]).anchor('mic', [0, 1.7, 0.125]);
    return d.model();
  }

  /* ---- Dance Studio (2×2, h 2.25): a mint studio with a glass storefront and the DANCE sign, a
     3×2 light-up deck in front, a set-back upper floor crowned by five LED bars, the sneaker
     pictogram and a speaker stack on the terrace ---- */
  var TILES = ['PX Candy Pink', 'PX Sunny', 'PX Mint', 'PX Sky Blue', 'PX Lilac', 'PX Coral'];
  var FIN_X = [[-5, -5], [-3, -3], [-1, 0], [2, 2], [4, 4]];
  function finHeights(sp) { return sp === 'A' ? [3, 4, 5, 4, 3] : sp === 'B' ? [5, 3, 5, 3, 5] : [2, 3, 5, 4, 5]; }
  function dance(st) {
    var d = new Draft('bld_dance', st), s = d.layer(G4), e = d.layer(G8), fh = finHeights(d.stripe), r, c;
    TILES.forEach(function (t, n) { d.pal[String(n + 1)] = glow(t, FX); });
    s.box(-3, 3, 0, 3, -3, 0, function (i, j) { return j === 3 ? 'i' : 'm'; });
    s.box(-2, 0, 3, 3, 0, 0, 'P');
    s.decal('+z', [-2, 3, 0], [3, 1], 'word:DANCE');
    s.decal('+z', [-3, 0, 0], [4, 3], 'glassWall');
    s.decal('+z', [2, 0, 0], [2, 3], 'door:glass');
    s.box(-2, 2, 4, 6, -3, -1, function (i, j) { return j === 6 ? 'm' : 'f'; });
    s.decal('+z', [1, 4, -1], [2, 2], 'window:shine');
    FIN_X.forEach(function (x, n) { e.box(x[0], x[1], 14, 13 + fh[n], n === 2 ? -7 : -5, n === 2 ? -7 : -4, 'F'); });
    e.blob(-0.5, 15.5, -4.5, 2, 2, 2, function (i, j, k) { return (i + j + k) & 1 ? 'G' : (i * 3 + j * 5 + k) % 7 === 0 ? 'h' : 'W'; }, 2.6);   /* the mirror ball */
    e.box(3, 6, 6, 6, 1, 1, 'P');                                     /* the door canopy */
    e.box(-6, -3, 8, 11, -1, -1, 'P');                                /* the sneaker sign board */
    e.decal('+z', [-6, 8, -1], [4, 4], 'sneaker');
    e.group('speaker', function () { e.box(5, 6, 8, 11, -1, 0, 'k'); });
    e.decal('+z', [5, 8, 0], [2, 2], 'speaker'); e.decal('+z', [5, 10, 0], [2, 2], 'speaker');
    e.box(-7, 6, 0, 0, 1, 6, 'L');                                    /* the deck and its six tiles */
    for (r = 0; r < 2; r++) for (c = 0; c < 3; c++) {
      e.box(-7 + c * 5, -4 + c * 5, 0, 0, 1 + r * 3, 3 + r * 3, String(r * 3 + c + 1));
      d.lamp(r * 3 + c, e, -7 + c * 5, -4 + c * 5, 0, 0, 1 + r * 3, 3 + r * 3);
    }
    d.pivot('floor', [0, 0.125, 0.5]).pivot('speaker', [0.75, 1, 0]);
    d.anchor('top', [0, 2.45, 0]).anchor('spot', [0, 0, 1.45]).anchor('floor', [0, 0.14, 0.5]).anchor('door', [0.625, 0.5, 0.2])
      .anchor('sign', [-0.5625, 1.25, 0.05]).anchor('speaker', [0.75, 1.6, 0]);
    return d.model();
  }

  /* ---- Rooftop Hangout (2×2, h 2.3): a two-tone brick block with a roller door, a window and
     the ✦ mural, a chunky side stair up to the plank deck: two beanbags, a telescope, a potted
     plant and a string of nine bulbs ---- */
  var BULBS = [[-5, 13, 4], [-3, 13, 4], [-1, 13, 4], [1, 13, 4], [-7, 15, 4], [-7, 13, 2], [-7, 13, 0], [-7, 13, -2], [-7, 13, -4]];
  var PARTY = ['PX Candy Pink', 'PX Sunny', 'PX Mint', 'PX Sky Blue', 'PX Bulb Warm', 'PX Coral', 'PX Sunny', 'PX Mint', 'PX Candy Pink'];
  function rooftop(st) {
    var d = new Draft('bld_rooftop', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8), f = d.layer(G16), n;
    Object.assign(d.pal, { R: 'PX City Brick', S: 'PX City Brick 2', N: 'PX Leaf', M: 'PX Leaf 2', j: glow('PX Sky Blue') });
    PARTY.forEach(function (t, g) { d.pal[String(g + 1)] = glow(t, FX); });
    s.box(-3, 1, 0, 4, -3, 2, function (i, j) { return j === 4 ? 'w' : sp === 'C' && j === 0 ? 'A' : j & 1 ? 'S' : 'R'; });
    s.decal('+z', [-3, 2, 2], [2, 2], 'window:pane'); s.decal('+z', [-1, 2, 2], [2, 2], 'sparkle');
    s.decal('-x', [-3, 2, -1], [2, 2], 'window:pane');
    s.box(-1, 0, 0, 1, 2, 2, null);                                   /* the roller door */
    e.box(-3, 0, 0, 3, 4, 4, function (i, j) { return j & 1 ? 'G' : 'g'; });
    for (n = 0; n < 10; n++) e.box(3, 6, 0, n, 4 - n, 4 - n, stairTone(n, sp === 'B'));   /* the stair up the side, and its landing */
    e.box(3, 6, 0, 9, -7, -6, stairTone(9, false));
    var rim = sp === 'A' ? 'A' : 'f';                                 /* the parapet (open where the stair lands) */
    e.box(-7, 2, 10, 10, 4, 4, rim); e.box(-7, 2, 10, 10, -7, -7, rim); e.box(-7, -7, 10, 10, -6, 3, rim); e.box(2, 2, 10, 10, -4, 3, rim);
    e.group('deck', function () {                                     /* beanbags */
      e.box(-5, -3, 10, 10, -3, -1, 'z'); e.box(-5, -4, 11, 11, -3, -2, 'z');
      e.box(-2, 0, 10, 10, 0, 2, 'b'); e.box(-1, 0, 11, 11, 1, 2, 'b');
    });
    e.box(0, 0, 10, 11, -4, -4, 's');                                 /* the telescope on its post */
    e.group('scope', function () { e.box(0, 0, 12, 12, -5, -4, 'k'); e.box(0, 0, 13, 13, -3, -2, 'k'); e.set(0, 14, -1, 'j'); });
    e.box(-5, -4, 10, 10, -6, -5, 'W'); e.box(-5, -4, 11, 12, -6, -5, 'N'); e.set(-4, 13, -6, 'M'); e.set(-5, 13, -5, 'M');   /* a potted plant */
    [[-7, 4], [2, 4], [-7, -7]].forEach(function (p) { e.box(p[0], p[0], 10, 14, p[1], p[1], 'W'); });   /* posts, the wire and its nine bulbs */
    f.box(-12, 3, 29, 29, 8, 8, 's'); f.box(-14, -14, 29, 29, -12, 7, 's');
    BULBS.forEach(function (b, g) { e.set(b[0], b[1], b[2], String(g + 1)); d.lamp(g, e, b[0], b[0], b[1], b[1], b[2], b[2]); });
    d.pivot('deck', [-0.34, 1.25, -0.06]).pivot('scope', [0.0625, 1.5625, -0.5]).pivot('bulbs', [-0.25, 1.81, 0.56]);
    d.anchor('top', [0, 2.2, 0]).anchor('spot', [-0.125, 0, 0.9]).anchor('roof', [-0.5, 1.53, -0.25]).anchor('stair', [0.625, 0, 0.85])
      .anchor('scope', [0.0625, 1.85, -0.1]).anchor('bulbL', [-0.56, 1.81, 0.56]).anchor('bulbM', [-0.19, 1.81, 0.56]).anchor('bulbR', [0.19, 1.81, 0.56]);
    return d.model();
  }
  function stairTone(n, runner) { return function (i, j) { return j !== n ? 'g' : runner && (i === 4 || i === 5) ? 'A' : 'G'; }; }

  /* ---- Concert Stage (3×2, h 2.45): the mockup's chequered lilac deck behind a striped skirt
     board, a big pixel LED wall in a navy bezel, speaker stacks, a truss with four moving heads,
     eight rainbow footlights, four light pools on the marks and a mic stand; the crowd pit in
     front (island template only). The deck is 0.25 u: where the crew's brain looks for it ---- */
  var RAINBOW = ['PX Rainbow 1', 'PX Rainbow 2', 'PX Rainbow 3', 'PX Rainbow 4', 'PX Rainbow 5', 'PX Rainbow 6'];
  var HEAD_I = [-8, -3, 1, 6], FOOT_I = [-11, -8, -5, -2, 1, 4, 7, 10], MARK_I = [-3, -1, 1, 3], DECK_Y = 0.25;
  function skirt(sp, i) { return sp === 'A' ? i & 1 : sp === 'B' ? (i + 6 >> 1) & 1 : Math.abs(i) < 4; }
  function stage(st, o) {
    var d = new Draft('bld_stage', st), sp = d.stripe, s = d.layer(G4), e = d.layer(G8);
    RAINBOW.forEach(function (t, n) { d.pal['RSUXYZ'[n]] = glow(t, FX); });
    NEON4.forEach(function (t, n) { d.pal[String(n + 1)] = glow(t, { pivot: 'lights' }); d.pal[String(n + 5)] = glow('PX City Deck', FX); });
    d.pal.K = { token: 'PX Penguin Back', pivot: 'lights' };
    s.box(-5, 5, 0, 0, -3, 2, function (i, j, k) { return (i + k) & 1 ? 'd' : 'D'; });   /* the chequered deck */
    MARK_I.forEach(function (i, n) { s.set(i, 0, 0, String(n + 5)); d.lamp(8 + n, s, i, i, 0, 0, 0, 0); });   /* light pools on the marks */
    e.box(-11, 10, 0, 1, 5, 5, function (i) { return skirt(sp, (i + 11 >> 1) - 5) ? 'A' : 'y'; });   /* the skirt board, a step, the footlights */
    e.box(-3, 2, 0, 0, 6, 6, 'd');
    FOOT_I.forEach(function (i, n) { e.set(i, 2, 5, 'RSUXYZ'[n % 6]); d.lamp(n, e, i, i, 2, 2, 5, 5); });
    [-11, 9].forEach(function (i) {                                   /* speaker stacks */
      e.box(i, i + 1, 2, 7, -7, -6, 'k');
      for (var j = 2; j <= 6; j += 2) e.decal('+z', [i, j, -6], [2, 2], 'speaker');
    });
    e.box(-9, 8, 2, 11, -7, -6, 'n');                                 /* the LED wall */
    d.screen('wall', e, [-8, 3, -6], [16, 8], 'led:stars:0');
    [-11, 10].forEach(function (i) { e.box(i, i, 8, 16, -7, -7, 'G'); });   /* the truss: posts, a top chord, a dotted lower one */
    e.box(-11, 10, 16, 16, -7, -7, 'G');
    e.box(-10, 9, 15, 15, -7, -7, function (i) { return i & 1 ? null : 'G'; });
    HEAD_I.forEach(function (i, n) {                                  /* moving heads: they tilt together on 'lights' */
      e.box(i, i + 1, 14, 15, -7, -6, 'K'); e.box(i, i + 1, 14, 14, -5, -5, String(n + 1));
      d.pivot('head' + n, [(i + 1) * G8, 2, -0.8125], 'lights');
    });
    e.box(2, 2, 2, 7, 3, 3, 'g'); e.set(2, 8, 3, 'k');               /* mic stand */
    d.pivot('lights', [0, 2, -0.8125]).pivot('crowd', [0, 0, 1.5]);
    d.anchor('top', [0, 2.3, 0]).anchor('spot', [0, DECK_Y, 0.1]).anchor('deck', [0, DECK_Y, 0]).anchor('cone0', [-1.31, 2.15, -0.81])
      .anchor('cone1', [0, 2.15, -0.81]).anchor('cone2', [1.31, 2.15, -0.81]).anchor('stepL', [-0.25, 0, 1]).anchor('stepR', [0.25, 0, 1])
      .anchor('pit', [0, 0, 1.5]).anchor('foot', [0, 0.4, 0.69]);
    MARK_I.forEach(function (i, n) { d.anchor('mark' + n, [i * G4, DECK_Y, 0.1]); });
    var m = d.model(), L = looks();
    if (!o || !o.crowd) return m;
    var cap = (L && typeof L.trisCap === 'function' && L.trisCap('bld_stage', o.tier || 'MID')) || 2600;
    var all = vox().compose([{ model: m }, { model: crowd(o.tier, o.fan, cap - vox().stats(m, { full: true }).tris) }], { id: 'bld_stage' });
    all.fx = m.fx;
    return all;
  }

  /* ---- the stage crowd: fans in two staggered rows in the pit, backs to the camera ---- */
  var FAN_TONES = ['PX Candy Pink', 'PX Mint', 'PX Sunny', 'PX Sky Blue', 'PX Lilac', 'PX Coral'], CROWD_PART = 'crowd_copy_fan';
  function crowdSpots(tier) {
    var n = tier === 'LOW' ? 4 : 6, step = 2.2 / (n - 1), out = [];
    [1.3, 1.7].forEach(function (z, r) {
      for (var k = 0; k < n; k++) out.push({ x: Math.round((-1.1 + k * step + r * 0.2) * 20) / 20, z: z + (k % 2 ? 0.05 : -0.05) });
    });
    return out;
  }
  /* this file's own fan (when px-characters has not registered makeFan): a hooded figure with one
     arm up, holding a glow stick */
  function ownFan(n) {
    var o = vox().grid({ grid: GC, origin: [0.5, 0, 0.5] }), tall = n % 3 === 0 ? 1 : 0, side = n % 2 ? 3 : -3;
    o.box(-2, 2, 0, 4 + tall, -1, 1, 'a');
    o.box(-1, 1, 5 + tall, 7 + tall, -1, 1, 'a');
    o.box(side, side, 3 + tall, 7 + tall, 0, 0, 'a');
    o.set(side, 8 + tall, 0, 's'); o.set(side, 9 + tall, 0, 's');
    return o.model({ id: 'fan', palette: { a: FAN_TONES[n % FAN_TONES.length], s: glow(NEON4[n % 4]) } });
  }
  /* → one VoxModel of every fan, all on the 'crowd' pivot as one perCopy part, within `cap` triangles
     (what the stage leaves of its TRIS_CAPS): makeFan's models as they are, else their LOD1, else this
     file's own */
  function crowd(tier, fan, cap) {
    var V = vox(), spots = crowdSpots(tier), list = null;
    function build(make) { return spots.map(function (p, n) { return { model: make(n), at: [p.x, 0, p.z] }; }); }
    function fits(l) { var t = 0; l.forEach(function (e) { t += V.stats(e.model, { full: true }).tris; }); return t <= cap; }
    if (typeof fan === 'function') {
      try {
        list = build(function (n) { var r = fan(n + 1, tier, { night: true }); return r && r.model ? r.model : r && typeof r.voxels === 'function' ? r.voxels() : r; });
        if (!list.every(function (e) { return e.model && Array.isArray(e.model.layers); })) list = null;
        else if (!fits(list)) { list = list.map(function (e) { return { model: V.lod(e.model, 1), at: e.at }; }); if (!fits(list)) list = null; }
      } catch (err) { list = null; }
    }
    var m = V.compose(list || build(ownFan), { id: 'crowd' });
    Object.keys(m.palette).forEach(function (ch) {
      var e = m.palette[ch];
      m.palette[ch] = Object.assign({}, typeof e === 'string' ? { token: e } : e, { pivot: 'crowd', copy: 'fan' });
    });
    m.layers.forEach(function (ly) { ly.vox.p = new Uint8Array(ly.vox.p.length); ly.vox.names = [null]; });   /* a fan's own pivots are not the stage's */
    m.pivots = {}; m.anchors = {};
    m.ownFans = !list;
    return m;
  }

  var MODELS = { bld_photobooth: booth, bld_boba: boba, bld_ledtower: tower, bld_recording: studio, bld_dance: dance, bld_rooftop: rooftop, bld_stage: stage };
  var VOXELS = {};
  IDS.forEach(function (id) { VOXELS[id] = function (st, o) { return MODELS[id](st || {}, o || {}); }; });

  /* ================================================================
     PURE HELPERS (exported for the tests)
     ================================================================ */
  var NOTE_CELL = 'city:note', ENCORE_CELL = 'city:encore:';
  var NOTE_ROWS = ['nynnnnnnnnnnnnnn', 'nnnnnnccccccnnnn', 'nnnnnnccccccnnnn', 'nnnnnncnnnncnnnn', 'nnnnnncnnnncnnnn', 'nnnncccnncccnnnn', 'nnnncccnncccnnnn', 'nnnnnnnnnnnnnnmn'];
  var CYCLE = ['name', 'pet', 'eq', 'stars'];                 /* the tower's programs, in the V4.54 order */
  var WALL_DAY = ['led:heart:1', NOTE_CELL, 'led:spin:0'];    /* D32: the heart / note / ✦ frame cycle */
  var WALL_NIGHT = ['spin', 'name', 'eq', 'stars'];           /* Showtime: one per 8 bars */
  var COUNTDOWN = 1.5, CARRY_WINDOW = 0.25, STRIP_OUT = 0.3125, WIPE_TRAVEL = 1.25, NIGHT_ON = 0.35, SLEW = 0.25, EPS = 1e-3;
  /* every atlas cell a screen or sign of this file can show (words: SIGN_WORDS and the child's own cells) */
  var CELLS = ['word:PHOTO', 'word:ON AIR', 'word:DANCE', 'photoStrip', 'nameCell', 'initialCell', 'counterCups', 'cup', 'heart', 'note', 'sparkle',
    'sneaker', 'speaker', 'porthole', 'glassWall', 'door:red', 'door:glass', 'window:shine', 'window:pane', NOTE_CELL, 'led:stars:0', 'led:stars:1',
    'led:eq:0', 'led:eq:1', 'led:heart:0', 'led:heart:1', 'led:spin:0', 'led:spin:1', ENCORE_CELL + 0, ENCORE_CELL + 1, 'portrait:*'];

  function ledHz() { var M = mo(), f = M && typeof M.freq === 'function' ? M.freq('ledFrame') : 0.6; return f > 0 && f < 0.6 ? f : 0.6; }
  /* the LED frame clock: an integer that steps FREQS.ledFrame times a second (never under reduced motion) */
  function ledStep(t, reduced) { return reduced || !(t > 0) ? 0 : Math.floor(t * ledHz() + 1e-9); }
  /* the child's first name on a 2:1 screen: 24-px windows of the atlas nameCell (64×12, drawn as
     SLVoxGL draws it), four glyphs a page, cut on glyph edges → [window start px, …]; [] without a name */
  function namePages(name) {
    var GL = gl(), KT = N.kit || root.SLKit;
    var n = KT && typeof KT.signName === 'function' ? KT.signName(name) : String(name == null ? '' : name).trim().split(/\s+/)[0].toUpperCase().slice(0, 12);
    if (!GL || typeof GL.textWidth !== 'function' || !n) return [];
    if (typeof n.normalize === 'function') n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var gap = GL.textWidth(n, 1) <= 62 ? 1 : 0, x = Math.floor((63 - GL.textWidth(n, gap)) / 2), xs = [], out = [], i;
    for (i = 0; i < n.length; i++) { var g = GL.glyphOf(n[i]); if (g) { xs.push(x); x += g[0].length + gap; } }
    if (!xs.length) return [];
    if (xs.length <= 4) return [20];
    for (i = 0; i + 4 < xs.length; i += 4) out.push(xs[i] - 1);
    out.push(xs[xs.length - 4] - 1);
    return out.map(function (v) { return Math.max(0, Math.min(40, v)); });
  }
  /* the tower's two cells for a program at LED frame f: [the square screen, the wide one] */
  function towerCells(prog, f, pages, pet) {
    if (prog === 'name') return ['initialCell', 'name:' + (pages ? f % pages : 0)];
    if (prog === 'pet') return ['portrait:' + pet, 'led:heart:' + (f & 1)];
    if (prog === 'eq') return ['note', 'led:eq:' + (f & 1)];
    return ['sparkle', 'led:stars:' + (f & 1)];
  }
  function nextProgram(i, pages, pet) {
    for (var n = 1; n <= CYCLE.length; n++) {
      var p = CYCLE[(i + n) % CYCLE.length];
      if ((p !== 'name' || pages) && (p !== 'pet' || pet)) return (i + n) % CYCLE.length;
    }
    return i;
  }
  /* the stage wall's cell: o {f, k, bar, pages, hold (the LED frame since the encore began, or null), card} */
  function wallCell(o) {
    if (o.card) return 'led:stars:0';
    if (o.hold != null) return ENCORE_CELL + (o.hold & 1);
    if (!(o.k >= 0.5)) return WALL_DAY[o.f % 3];
    var p = WALL_NIGHT[(((o.bar | 0) >> 3) % 4 + 4) % 4];
    if (p === 'name' && !o.pages) p = 'spin';
    return p === 'name' ? 'name:' + o.f % o.pages : 'led:' + p + ':' + (o.f & 1);
  }
  /* the ENCORE cell (38×19, LED palette chars): magenta letters on a violet shadow, gold / cyan dots */
  function encoreRows(font, f) {
    var W = 38, H = 19, g = [], x = 2, y, n;
    for (y = 0; y < H; y++) g.push(new Array(W + 1).join('n').split(''));
    'ENCORE'.split('').forEach(function (ch) {
      var gl5 = font[ch] || [];
      for (var pass = 0; pass < 2; pass++) for (y = 0; y < gl5.length; y++) for (n = 0; n < gl5[y].length; n++) {
        if (gl5[y][n] === '#') g[6 + y + 1 - pass][x + n + 1 - pass] = pass ? 'm' : 'v';
      }
      x += 6;
    });
    for (n = 0; n < 9; n++) { g[2][3 + n * 4] = (n + f) & 1 ? 'y' : 'c'; g[16][3 + n * 4] = (n + f) & 1 ? 'c' : 'y'; }
    return g.map(function (r) { return r.join(''); });
  }
  /* the crowd's rise (0..1): up 0.25 → 0.65 s into the act, held through the encore, down in 0.5 s */
  function crowdU(tAct, now, hold) {
    if (tAct != null) return clamp01((tAct - 0.25) / 0.4);
    if (hold == null) return 0;
    return now < hold ? 1 : 1 - clamp01((now - hold) / 0.5);
  }
  /* linear rgb of a token or '#rrggbb' (cached) */
  var COL = {};
  function lin(tok) {
    var c = COL[tok];
    if (c) return c;
    var L = looks(), h = typeof tok === 'string' && tok.charAt(0) === '#' ? tok : L && typeof L.resolve === 'function' ? L.resolve(tok) : null;
    c = [1, 1, 1];
    if (h && /^#[0-9a-f]{6}$/i.test(h)) {
      var n = parseInt(h.slice(1), 16);
      [n >> 16 & 255, n >> 8 & 255, n & 255].forEach(function (b, i) { var x = b / 255; c[i] = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    }
    return (COL[tok] = c);
  }
  function mix(out, a, b, k) { out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k; out[2] = a[2] + (b[2] - a[2]) * k; return out; }
  function hex6(v) {
    var m = typeof v === 'string' ? /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim()) : null, h = m ? m[1] : '';
    return !m ? null : '#' + (h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h).toUpperCase();
  }
  /* which box of list [[x0, y0, z0, x1, y1, z1, tag]] holds a point → its tag, else null */
  function boxAt(list, x, y, z) {
    for (var n = 0; n < list.length; n++) {
      var b = list[n];
      if (x >= b[0] - EPS && x <= b[3] + EPS && y >= b[1] - EPS && y <= b[4] + EPS && z >= b[2] - EPS && z <= b[5] + EPS) return b[6];
    }
    return null;
  }
  /* sort the quads of a copy part (runs of 6 vertices) by the model's fx boxes → {lamps: [[first
     vertex, …] per group], glow: [the accent's glow quads], lit: [its lit quads], ao: their baked
     AO per vertex, led: {name: {at, bits}}}; arrays are the part's position / vuv / color */
  function sortQuads(P, V, C, fx, accent) {
    var rec = { lamps: [], glow: [], lit: [], ao: null, led: {}, last: [], tint: undefined }, n = Math.floor(P.length / 18), q, k;
    var fb = lin(accent), ch = fb[0] >= fb[1] && fb[0] >= fb[2] ? 0 : fb[1] >= fb[2] ? 1 : 2;
    for (q = 0; q < n; q++) {
      var v = q * 6, x = 0, y = 0, z = 0, mode = Math.round(V[v * 3 + 2]), tag;
      for (k = v; k < v + 6; k++) { x += P[k * 3] / 6; y += P[k * 3 + 1] / 6; z += P[k * 3 + 2] / 6; }
      if (mode === 2) {
        if ((tag = boxAt(fx.leds, x, y, z)) == null) continue;
        var u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, bits = [];
        for (k = v; k < v + 6; k++) { u0 = Math.min(u0, V[k * 3]); u1 = Math.max(u1, V[k * 3]); v0 = Math.min(v0, V[k * 3 + 1]); v1 = Math.max(v1, V[k * 3 + 1]); }
        for (k = v; k < v + 6; k++) bits.push((V[k * 3] > (u0 + u1) / 2 ? 1 : 0) | (V[k * 3 + 1] > (v0 + v1) / 2 ? 2 : 0));
        rec.led[tag] = { at: v, bits: bits, cell: null, t: null };
      } else if (mode === 3) {
        if ((tag = boxAt(fx.lamps, x, y, z)) == null) rec.glow.push(v);
        else (rec.lamps[tag] = rec.lamps[tag] || []).push(v);
      } else rec.lit.push(v);
    }
    if (C && rec.lit.length && fb[ch] > 0) {
      rec.ao = new Float32Array(rec.lit.length * 6);
      for (q = 0; q < rec.lit.length; q++) for (k = 0; k < 6; k++) rec.ao[q * 6 + k] = Math.min(1, C[(rec.lit[q] + k) * 3 + ch] / fb[ch]);
    }
    return rec;
  }

  /* ---------------- handle helpers (they only call what the handle has) ---------------- */
  var R3 = [0, 0, 0], P3 = [0, 0, 0], S3 = [1, 1, 1], C3 = [0, 0, 0];
  function pose(a, name, rx, ry, rz, px, py, pz, sx, sy, sz) {
    var pv = a && typeof a.pivot === 'function' ? a.pivot(name) : null;
    if (!pv || typeof pv.set !== 'function') return;
    R3[0] = rx; R3[1] = ry; R3[2] = rz; P3[0] = px; P3[1] = py; P3[2] = pz; S3[0] = sx; S3[1] = sy; S3[2] = sz;
    pv.set(R3, P3, S3);
  }
  function rest(a, name) { pose(a, name, 0, 0, 0, 0, 0, 0, 1, 1, 1); }
  function timeOf(a) { return a && typeof a.t === 'number' && isFinite(a.t) ? a.t : 0; }
  function showOf(a) { return a && typeof a.show === 'number' && isFinite(a.show) ? clamp01(a.show) : 0; }
  function phaseOf(a) { return a && typeof a.phase === 'number' && isFinite(a.phase) ? a.phase : 0; }
  function call(fn, self, x, y, z, w) { try { return fn.call(self, x, y, z, w); } catch (e) { return undefined; } }
  function isCard(a) { return !!(a && (a.photocard || (!a.batch && a.object))); }
  function trimOfHandle(a) {
    var m = /(?:^|\|)v:(\d+)/.exec(String((a && a.stateKey) || ''));
    return a && a.st && a.st.variant >= 0 ? variantOf(a.st) : m ? variantOf({ variant: +m[1] }) : 0;
  }
  function sideOf(a) { return trimOfHandle(a) % 2 ? -1 : 1; }
  function copyGeo(a, part) { try { return a && typeof a.copyGeometry === 'function' ? a.copyGeometry(part) || null : null; } catch (e) { return null; } }
  function attr(geo, name) { return !geo ? null : typeof geo.getAttribute === 'function' ? geo.getAttribute(name) || null : (geo.attributes && geo.attributes[name]) || null; }
  function petOf(a) {
    var p = a && a.pets, v = p && typeof p.active === 'function' ? call(p.active, p) : null;
    return typeof v === 'string' && /^pet_/.test(v) ? v : null;
  }
  /* the pet's part of an act: perform(kind, uid) → lead seconds (0: no pet; the building plays alone) */
  function askPet(a, kind) {
    var p = a && a.pets, r = p && typeof p.perform === 'function' ? call(p.perform, p, kind, a.uid) : 0;
    return typeof r === 'number' && r > 0 ? r : 0;
  }
  /* the integer beat under a handle: the bar from the clock plus the beat wraps counted inside it */
  function beatOf(s, a) {
    var f = a && typeof a.beat === 'number' && isFinite(a.beat) ? frac(a.beat) : 0, bar = a ? a.bar | 0 : 0;
    if (s.bbar !== bar) { s.bbar = bar; s.bk = 0; }
    else if (f < s.bf - 0.5 && s.bk < 3) s.bk++;
    s.bf = f;
    return bar * 4 + s.bk;
  }
  /* a level that moves to its target no faster than 0 → 1 in SLEW s: a mashed tap can never
     blink a lamp faster than MAX_FLASH_HZ */
  function slew(cur, target, dt, reduced) {
    if (reduced || cur == null) return target;
    var d = Math.max(0, dt) / SLEW;
    return target > cur ? Math.min(target, cur + d) : Math.max(target, cur - d);
  }

  /* ================================================================
     ACT BOOK — one live act per uid on an SLMotion timeline (as V4.54's)
     spec {name, reduced, apply(a, out, t, rec), rest(a, rec), emitAt(kind) → anchor, start(a, rec)}
     ================================================================ */
  var VOICE = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];
  function makeBook() {
    var recs = new Map();
    function live(uid) { var r = recs.get(uid); return r && !r.done ? r : null; }
    function step(rec, h, tAct) {
      if (rec.done) return false;
      if (h) rec.h = h; else h = rec.h;
      var t = tAct >= 0 ? +tAct : 0, cues = rec.cues;
      rec.lastT = timeOf(h);
      while (rec.ci < cues.length && cues[rec.ci].t <= t + 1e-6) {
        var c = cues[rec.ci++];
        if (c.sfx && typeof h.sfx === 'function') {
          if (c.sfx === 'pop' && c.t < 0.05) continue;              /* the controller's tap squish owns it */
          if (c.pet) { var pet = petOf(h), vs = pet ? VOICE.indexOf(pet) : -1; if (vs >= 0) call(h.sfx, h, 'voice', c.vol, vs); }
          else call(h.sfx, h, c.sfx, c.vol, c.step);
        } else if (c.emit && typeof h.emit === 'function') call(h.emit, h, c.emit, rec.spec.emitAt ? rec.spec.emitAt(c.emit) : 'top', c.n);
      }
      var tt = t < rec.dur ? t : rec.dur;
      mo().sample(rec.name, tt, rec.out, rec.o);
      rec.spec.apply(h, rec.out, tt, rec);
      if (t >= rec.dur) { rec.done = true; if (recs.get(rec.uid) === rec) recs.delete(rec.uid); return false; }
      return true;
    }
    function start(a, spec) {
      var M = mo();
      if (!a || !M || !M.ACTS || !M.ACTS[spec.name]) return null;
      var prev = recs.get(a.uid), now = timeOf(a), from = null;
      if (prev && (!prev.done || (prev.cancelled && Math.abs(now - prev.lastT) <= CARRY_WINDOW))) from = M.carry(spec.name, prev.out);
      if (prev && !prev.done) prev.done = true;                     /* never two on one uid */
      var o = { reduced: !!spec.reduced, from: from };
      var rec = { uid: a.uid, name: spec.name, spec: spec, o: o, out: {}, cues: M.cues(spec.name, o), ci: 0, dur: M.durOf(spec.name, o), done: false, cancelled: false, lastT: now, t0: now, h: a };
      recs.set(a.uid, rec);
      if (spec.start) spec.start(a, rec);
      return {
        name: spec.name, dur: rec.dur,
        update: function (h, tAct) { return step(rec, h, tAct); },
        cancel: function () {
          if (rec.done) return;
          rec.done = true; rec.cancelled = true;
          if (rec.h && rec.h.uid === rec.uid && spec.rest) { try { spec.rest(rec.h, rec); } catch (e) { /* a handle already rebound */ } }
        }
      };
    }
    return { live: live, start: start, forget: function (uid) { var r = recs.get(uid); if (r) { r.done = true; recs.delete(uid); } } };
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('city', (K, SL3D) → {id: handler})
     ================================================================ */
  function factory(K, SL) {
    tokens();
    var WM = typeof WeakMap === 'function' ? WeakMap : Map;
    var book = makeBook(), ST = new Map(), USER = { name: '', pages: [], hex: null }, META = {}, RECS = new WM(), BASE_POS = new WM();
    function stOf(a) { var s = ST.get(a.uid); if (!s) { s = { k: showOf(a) }; ST.set(a.uid, s); } return s; }
    function forget(uid) { ST.delete(uid); book.forget(uid); }
    function atlas() { try { return K && K.vox && typeof K.vox.atlas === 'function' ? K.vox.atlas() : null; } catch (e) { return null; } }
    function rate(name) { var M = mo(); return M && M.RATE && M.RATE[name] > 0 ? M.RATE[name] : name === 'bloom' ? 1.5 : 0.5; }
    function allow(last, t, gap) { return last == null || !(t - last < gap - 1e-6); }
    /* this file's own LED cells: the note frame of the stage's day cycle (no letters) and the whole
       word ENCORE (a SIGN_WORD, in PIX5) between two rows of dots that swap between its two frames */
    (function () {
      var A = atlas(), GL = gl(), B = GL && GL.BITMAPS;
      if (!A || typeof A.define !== 'function' || !B) return;
      A.define(NOTE_CELL, { w: 16, h: 8, rows: NOTE_ROWS, pal: B.LED_PAL });
      [0, 1].forEach(function (f) { A.define(ENCORE_CELL + f, { w: 38, h: 19, rows: encoreRows(B.PIX5, f), pal: B.LED_PAL }); });
    }());

    /* the child: the atlas's name / initial cells (only they are redrawn), the name pages and the member colour */
    function setUser(u) {
      var A = atlas();
      u = u && typeof u === 'object' ? u : {};
      if (A && typeof A.setUser === 'function') call(A.setUser, A, u);
      if (typeof u.name === 'string' && u.name !== USER.name) { USER.name = u.name; USER.pages = namePages(u.name); }
      if (u.color !== undefined) USER.hex = hex6(u.color);
      return USER.pages.length;
    }
    function syncUser(a) { var u = a && a.user; if (u && typeof u.name === 'string' && u.name !== USER.name) setUser({ name: u.name }); }
    function pagesFor(a) { return isCard(a) ? 0 : USER.pages.length; }

    /* ---------- the copy's own part: its lamps, its LED screens, its member accent ---------- */
    function fxOf(a) {
      var id = VOXELS[a.id] ? a.id : a.template && a.template.id, key = id + '|' + trimOfHandle(a);
      return META[key] || (META[key] = VOXELS[id]({ variant: trimOfHandle(a) }).fx);
    }
    function recOf(a) {
      var geo = copyGeo(a, PART), r = geo ? RECS.get(geo) : null;
      if (!geo || r) return r;
      var pa = attr(geo, 'position'), vu = attr(geo, 'vuv'), ca = attr(geo, 'color'), fx = fxOf(a);
      r = pa && vu ? sortQuads(pa.array, vu.array, ca ? ca.array : null, fx, fx.accent) : { lamps: [], glow: [], lit: [], led: {}, last: [] };
      r.geo = geo; r.member = fx.member;
      RECS.set(geo, r);
      return r;
    }
    /* lamp groups 0 … n − 1 take colour(g, out) → linear rgb; a group is written only when it changes */
    function lamps(a, n, colour) {
      var r = recOf(a), ca = r ? attr(r.geo, 'color') : null, any = false;
      if (!ca) return;
      for (var g = 0; g < n; g++) {
        var list = r.lamps[g], last = r.last[g] || (r.last[g] = [-1, -1, -1]);
        if (!list) continue;
        colour(g, C3);
        if (Math.abs(last[0] - C3[0]) < 2e-3 && Math.abs(last[1] - C3[1]) < 2e-3 && Math.abs(last[2] - C3[2]) < 2e-3) continue;
        last[0] = C3[0]; last[1] = C3[1]; last[2] = C3[2]; any = true;
        for (var q = 0; q < list.length; q++) for (var e = list[q] * 3, end = e + 18; e < end; e += 3) { ca.array[e] = C3[0]; ca.array[e + 1] = C3[1]; ca.array[e + 2] = C3[2]; }
      }
      if (any) ca.needsUpdate = true;
    }
    /* trim 0 wears the child's member colour (never on a photocard): glow quads take it as it is, lit ones over their AO */
    function accent(a) {
      var r = recOf(a), ca = r && r.member ? attr(r.geo, 'color') : null;
      if (!ca || isCard(a)) return;
      var hex = hex6(a.member) || hex6(a.user && a.user.color) || USER.hex, q, k, e;
      if (r.tint === hex || (r.tint === undefined && !hex)) { r.tint = hex; return; }
      r.tint = hex;
      var c = lin(hex || fxOf(a).accent), C = ca.array;
      for (q = 0; q < r.glow.length; q++) for (e = r.glow[q] * 3, k = 0; k < 6; k++, e += 3) { C[e] = c[0]; C[e + 1] = c[1]; C[e + 2] = c[2]; }
      for (q = 0; q < r.lit.length; q++) for (e = r.lit[q] * 3, k = 0; k < 6; k++, e += 3) { var ao = r.ao ? r.ao[q * 6 + k] : 1; C[e] = c[0] * ao; C[e + 1] = c[1] * ao; C[e + 2] = c[2] * ao; }
      ca.needsUpdate = true;
    }
    var UV = [0, 0, 0, 0];
    function uvOf(cell) {
      var A = atlas();
      if (!A || typeof A.cell !== 'function') return null;
      if (cell.indexOf('name:') === 0) {
        var c = A.cell('nameCell'), x = USER.pages[+cell.slice(5)] || 0;
        if (!c) return null;
        UV[0] = c[0] + (c[2] - c[0]) * x / 64; UV[1] = c[1]; UV[2] = c[0] + (c[2] - c[0]) * (x + 24) / 64; UV[3] = c[3];
        return UV;
      }
      return A.cell(cell) || A.cell('none') || null;
    }
    /* show `cell` on LED screen `name`: on its own a screen changes at most every 1 / ledFrame s; a
       tap's program change (forced) at most every RATE.screen s → true once the screen shows it */
    function screen(a, name, cell, forced) {
      var r = recOf(a), q = r ? r.led[name] : null, now = timeOf(a);
      if (!q || q.cell === cell) return true;
      if (q.cell !== null && !allow(q.t, now, forced ? rate('screen') : 1 / ledHz())) return false;
      var uv = uvOf(cell), vu = attr(r.geo, 'vuv');
      if (!uv || !vu) return true;
      for (var k = 0; k < 6; k++) { vu.array[(q.at + k) * 3] = uv[q.bits[k] & 1 ? 2 : 0]; vu.array[(q.at + k) * 3 + 1] = uv[q.bits[k] & 2 ? 3 : 1]; }
      vu.needsUpdate = true;
      q.cell = cell; q.t = now;
      return true;
    }
    function setState(a, s, key, v) {
      v = Math.round(clamp01(v) * 50) / 50;
      if (s['st_' + key] === v || typeof a.state !== 'function') return;
      s['st_' + key] = v;
      call(a.state, a, key, v);
    }
    /* night halos (they grow in with the mix, so none pops at full size) and the uplight pool */
    var HALO = { bld_photobooth: ['bulbs', 'PX Bulb Warm', 0.3], bld_boba: ['cup', 'PX Candy Pink', 0.7], bld_ledtower: ['glow', 'Electric Violet', 1.1],
      bld_recording: ['ringL', 'Electric Violet', 0.4], bld_dance: ['sign', 'Neon Magenta', 0.9], bld_rooftop: ['bulbM', 'Sunset Amber', 0.3], bld_stage: ['foot', 'PX Bulb Warm', 0.4] };
    function night(a, s, k, id) {
      s.k = clamp01(+k || 0);
      if (isCard(a)) return;
      var h = HALO[id], on = s.k > NIGHT_ON, size = h ? Math.round(h[2] * lerp(0.55, 1, s.k) * 20) / 20 : 0;
      if (h && typeof a.halo === 'function' && (s.haloOn !== on || (on && s.haloSize !== size))) { s.haloOn = on; s.haloSize = size; call(a.halo, a, h[0], on, size, h[1]); }
      if (typeof a.decal === 'function' && s.pool !== on) { s.pool = on; call(a.decal, a, on, h ? h[1] : 'PX Lamp Warm'); }
    }
    function dtOf(a, s) { var now = timeOf(a), dt = s.pt == null ? 0 : Math.min(0.1, Math.max(0, now - s.pt)); s.pt = now; return dt; }
    /* draw(a, s, out, tt, rec) poses and lights a copy (out: the live act's sample, else null) → true while it moves on its own */
    function handler(id, draw, act, extra) {
      var h = {
        voxels: function (st, ctx) { return VOXELS[id](st, ctx); },
        idle: function (a) {
          if (!a) return false;
          var s = stOf(a);
          syncUser(a);
          if (book.live(a.uid)) return true;                        /* the act owns the copy */
          accent(a);
          return !!draw(a, s, null, 0) && !a.reduced && !isCard(a);
        },
        act: function (a) {
          if (!a) return null;
          var s = stOf(a), spec = act ? act(a, s) : {};
          if (PERFORM[id] && !a.reduced) askPet(a, PERFORM[id]);
          spec.name = ACT[id]; spec.reduced = !!a.reduced;
          spec.apply = function (hd, out, tt, rec) { draw(hd, stOf(hd), out, tt, rec); };
          if (!spec.rest) spec.rest = function (hd) { draw(hd, stOf(hd), null, 0); };
          return book.start(a, spec);
        },
        show: function (a, k) {
          if (!a) return;
          var s = stOf(a);
          syncUser(a);
          night(a, s, k, id);
          accent(a);
          if (!book.live(a.uid)) draw(a, s, null, 0);
        },
        /* a standalone copy (K.instantiate: photocards, turntables): its still look → the handle it was drawn through */
        handle: function (obj, o) {
          var ud = (obj && obj.userData) || {}, tpl = ud.template || null, pv = {};
          var a = {
            uid: obj, id: id, t: 0, dt: 0, phase: 0, reduced: true, beat: 0, bar: 0, show: 0, photocard: !o || o.photocard !== false, batch: null, object: obj,
            template: tpl, stateKey: ud.stateKey || (tpl && tpl.stateKey) || '', user: (o && o.user) || null, member: (o && o.member) || null,
            copyGeometry: function (part) { return ud.meshes && ud.meshes[part] ? ud.meshes[part].geometry : null; },
            pivot: function (name) {
              return pv[name] || (pv[name] = { set: function (rot, pos, sc) {
                var n = ud.pivots && ud.pivots[name], og = tpl && tpl.pivots[name] ? tpl.pivots[name].origin : null, par = og && tpl.pivots[name].parent ? tpl.pivots[tpl.pivots[name].parent].origin : [0, 0, 0];
                if (!n || !og) return this;
                n.rotation.set(rot[0] * PI / 180, rot[1] * PI / 180, rot[2] * PI / 180);
                n.position.set(og[0] - par[0] + pos[0], og[1] - par[1] + pos[1], og[2] - par[2] + pos[2]);
                n.scale.set(sc[0] || 1e-4, sc[1] || 1e-4, sc[2] || 1e-4);
                return this;
              } });
            },
            state: function (key, v) { if (typeof ud.setState === 'function') ud.setState(key, v); }
          };
          h.show(a, 0); h.idle(a);
          ST.delete(obj);
          return a;
        },
        forget: forget, setUser: setUser
      };
      if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
      return h;
    }
    function emitTo(map) { return function (kind) { return map[kind] || 'top'; }; }

    /* ---------- Photo Booth: curtains sway, the bulbs count down, the lens blooms, the strip slides out ---------- */
    var LAMP_OFF = lin('PX Lamp Off'), LAMP_ON = lin('PX Bulb Warm'), LENS = lin('PX Sky Blue'), WHITE = lin('PX Glint');
    function stripSec() { var M = mo(); return M && M.STRIP_SEC > 0 ? M.STRIP_SEC : 6; }
    function boothDraw(a, s, out, tt, rec) {
      var side = sideOf(a), red = !!a.reduced, card = isCard(a), now = timeOf(a), dt = dtOf(a, s), lv = s.lv || (s.lv = [null, null, null, null]);
      if (out) {
        if (tt >= 1.45 && out.bloom > 0.01 && !rec.bloomed) {       /* this act's bloom moment: ≤ 1 per RATE.bloom per booth */
          rec.bloomed = true;
          if (!red && allow(s.bloomAt, now, rate('bloom'))) {
            s.bloomAt = now;
            s.halo = !(typeof a.bloom === 'function' && call(a.bloom, a, 'lens', 0.5, 'PX Bulb Warm') === true);
            if (s.halo && typeof a.halo === 'function') call(a.halo, a, 'lens', true, 0.5, 'PX Bulb Warm');
          }
        }
        s.strip = Math.max(out.strip, (rec.carry || 0) * (1 - clamp01(tt / 0.3)));
        if (tt >= rec.dur) s.stripAt = now;
      } else if (s.strip > 0) {                                     /* the strip waits STRIP_SEC, then slides back in */
        if (s.stripAt == null) s.stripAt = now;
        var over = now - s.stripAt - stripSec();
        if (over >= 0) { s.strip = red ? 0 : 1 - clamp01(over / 0.4); if (!(s.strip > 0)) { s.strip = 0; s.stripAt = null; } }
      }
      if (s.halo && !(now - s.bloomAt < 0.5)) { s.halo = false; if (typeof a.halo === 'function') call(a.halo, a, 'lens', false, 0.5, 'PX Bulb Warm'); }
      var kick = out && !red ? Math.abs(out.curtain || 0) * 8 : 0, sw = red || card ? 0 : 3 * Math.sin(TAU * (0.25 * now + phaseOf(a)));
      pose(a, 'curtainL', 0, side * (kick + Math.max(0, sw)), 0, 0, 0, 0, 1, 1, 1);
      pose(a, 'curtainR', 0, -side * (kick + Math.max(0, -sw)), 0, 0, 0, 0, 1, 1, 1);
      pose(a, 'strip', 0, 0, 0, side * STRIP_OUT * clamp01(card ? 0 : s.strip || 0), 0, 0, 1, 1, 1);
      var M = mo(), bloom = out ? clamp01(out.bloom) : 0;
      for (var i = 0; i < 3; i++) {
        var tg = out ? (tt < COUNTDOWN ? (out.bulbs >= (i + 1) / 3 - 1e-6 ? 1 : 0.1) : Math.max(0.1, out.bulbs)) : card ? 0.9 : lerp(0.9, M ? M.chase(now, i, 0.5, 3, red) : 0.8, s.k);
        lv[i] = slew(lv[i], tg, dt, red);
      }
      lv[3] = slew(lv[3], bloom, dt, red);
      lamps(a, 4, function (g, c) { return g < 3 ? mix(c, LAMP_OFF, LAMP_ON, lv[g]) : mix(c, LENS, WHITE, lv[3]); });
      return true;
    }
    function boothAct(a, s) {
      var A = atlas();
      if (A && typeof A.setStrip === 'function' && !isCard(a)) call(A.setStrip, A, petOf(a) || 'pet_puppy');   /* redrawn on a tap only */
      return { emitAt: emitTo({ sparkle: 'lens' }), start: function (h, rec) { rec.carry = s.strip || 0; s.stripAt = null; } };
    }

    /* ---------- Boba Café: the hatch flips up, a cup slides out along the counter and hops to the table, the pearls swirl ---------- */
    var CUP_REST = [0.25, 0.375, 0], CUP_OUT = 0.1875, TABLE = [0.5625, 0.5, 0];
    function bobaDraw(a, s, out) {
      var side = sideOf(a), red = !!a.reduced, M = mo(), sw = out ? clamp01(out.swirl) : 0, e = 0.5 - 0.5 * Math.cos(PI * sw);
      var bob = red || isCard(a) || !M ? 0 : (M.bob(timeOf(a), 2, 2.4, phaseOf(a), false) - 1) * 0.5, bulge = 1 + 0.3 * Math.sin(PI * sw);
      pose(a, 'hatch', -(out ? out.hatch : 0), 0, 0, 0, 0, 0, 1, 1, 1);
      pose(a, 'pearls', 0, side * 360 * e, 0, 0, 0.375 * Math.sin(PI * sw) + bob, 0, bulge, 1, bulge);
      if (!out || !(out.cupA > 1e-3)) { rest(a, 'cup'); return true; }
      var u = clamp01(out.cup), c = clamp01((u - 0.4) / 0.6), sc = Math.max(1e-3, out.cupA) * (1 + c);
      pose(a, 'cup', 0, 0, 0, side * lerp(0, TABLE[0] - CUP_REST[0], c), lerp(0, TABLE[1] - CUP_REST[1], c) + 0.2 * Math.sin(PI * c),
        lerp(lerp(0, CUP_OUT - CUP_REST[2], clamp01(u / 0.4)), TABLE[2] - CUP_REST[2], c), sc, sc, sc);
      return true;
    }

    /* ---------- LED Screen Tower: two screens, the scan bar, the breathing beacon ---------- */
    function towerDraw(a, s, out, tt, rec) {
      var red = !!a.reduced, card = isCard(a), now = timeOf(a), pet = card ? null : petOf(a), pages = pagesFor(a);
      if (s.prog == null) s.prog = pages ? 0 : 3;
      if (out) {                                                    /* a tap: the next program behind the wipe bar */
        if (out.prog >= 1 && !rec.flipped && allow(s.progAt, now, rate('screen'))) { rec.flipped = true; s.prog = nextProgram(s.prog, pages, pet); s.progAt = now; s.forced = true; }
      } else if (!card && !red) {                                   /* Showtime: the next program every 8 bars, as a frame step */
        var grp = (a.bar | 0) >> 3;
        if (s.k >= 0.5 && s.grp != null && grp !== s.grp) s.prog = nextProgram(s.prog, pages, pet);
        s.grp = s.k >= 0.5 ? grp : null;
      }
      if (out && out.band > 1e-3) pose(a, 'wipe', 0, 0, 0, 0, WIPE_TRAVEL * (1 - clamp01(out.wipe)), 0, 1, 1 + 2 * out.band, 1); else rest(a, 'wipe');
      var prog = card ? 'stars' : CYCLE[s.prog];
      if ((prog === 'name' && !pages) || (prog === 'pet' && !pet)) { s.prog = nextProgram(s.prog, pages, pet); prog = CYCLE[s.prog]; }
      var cells = towerCells(prog, card ? 0 : ledStep(now + 3 * phaseOf(a), red), pages, pet), f = !!s.forced;
      var shown = screen(a, 'square', cells[0], f);
      if (screen(a, 'wide', cells[1], f) && shown) s.forced = false;
      setState(a, s, 'beacon', red || card ? 0.8 : 0.8 + 0.2 * Math.sin(TAU * (0.5 * now + phaseOf(a))));
      return true;
    }

    /* ---------- Recording Studio: ON AIR, the VU column on the beat, the mic and the headphones groove ---------- */
    var VU_TOK = ['Laser Lime', 'Laser Lime', 'Laser Lime', 'Laser Lime', 'Laser Lime', 'PX Sunny', 'PX Sunny', 'PX Coral'].map(lin), VU_OFF = lin('PX City Slate');
    function studioDraw(a, s, out, tt, rec) {
      var red = !!a.reduced, card = isCard(a), now = timeOf(a), M = mo(), bn = beatOf(s, a), bf = s.bf, lvl = out && !red ? out.level : 0;
      if (out) { s.onAir = out.onAir; s.tapAt = rec.t0; }
      else if (s.tapAt != null) {                                   /* ON AIR stays lit ON_AIR_SEC after the tap, then fades */
        var over = now - s.tapAt - (M && M.ON_AIR_SEC > 0 ? M.ON_AIR_SEC : 4);
        s.onAir = over < 0 ? 1 : red ? 0 : 1 - clamp01(over / 0.3);
        if (!(s.onAir > 0)) { s.onAir = 0; s.tapAt = null; }
      }
      setState(a, s, 'onAir', card ? 1 : s.onAir || 0);
      var top = out && !red && M ? Math.max(1, Math.round(M.vu(0, bn, bf, lvl, red) * 8)) : 8;   /* a full bar at rest; it follows the beat in the act */
      lamps(a, 8, function (g, c) { return mix(c, VU_OFF, VU_TOK[g], g < top ? 1 : 0.25); });
      pose(a, 'mic', 0, 0, 6 * lvl * Math.sin(TAU * bf), 0, 0, 0, 1, 1, 1);
      pose(a, 'phones', 0, 0, 0, 0, 0.03 * lvl * (0.5 - 0.5 * Math.cos(TAU * bf)), 0, 1, 1, 1);
      if (!card && typeof a.halo === 'function' && s.airHalo !== (s.onAir > 0.5)) { s.airHalo = s.onAir > 0.5; call(a.halo, a, 'onair', s.airHalo, 0.35, 'PX Coral'); }
      return s.tapAt != null;
    }
    function studioAct(a) {
      var m = a.music, Mus = root.SLMusic;
      if (m && m.playing !== false && Mus && typeof Mus.drop === 'function') call(Mus.drop, Mus);
      return { emitAt: emitTo({ note: 'mic', sparkle: 'onair' }) };
    }

    /* ---------- Dance Studio: the deck chases on the beat, the speaker pumps ---------- */
    var TILE_COL = TILES.map(lin);
    function danceDraw(a, s, out) {
      var red = !!a.reduced, M = mo(), bn = beatOf(s, a), bf = s.bf, amt = isCard(a) ? 0 : Math.max(out ? clamp01(out.chase) : 0, s.k);
      var hue = !red && amt > 0.01 ? bn >> 1 : 0, p = out && !red ? 1 + 0.06 * clamp01(out.pump) * (0.5 + 0.5 * Math.cos(TAU * bf)) : 1;
      pose(a, 'speaker', 0, 0, 0, 0, 0, 0, p, p, p);
      lamps(a, 6, function (g, c) {
        return mix(c, TILE_COL[(g + hue) % 6], WHITE, 0.6 * amt * clamp01(((M ? M.diagChase(g % 3, g > 2 ? 1 : 0, bn, bf, 4, red) : 0.8) - 0.35) / 0.65));
      });
      return amt > 0.01;
    }

    /* ---------- Rooftop Hangout: the telescope swings up, the beanbags squish, the bulbs run a slow wave ---------- */
    var PARTY_COL = PARTY.map(lin);
    function roofDraw(a, s, out) {
      var red = !!a.reduced, now = timeOf(a), M = mo(), wave = out ? clamp01(out.wave) : 0, base = isCard(a) ? 0.85 : lerp(0.8, 1, s.k);
      var sq = out && out.squish != null ? out.squish : 1, xz = 1 + (1 - sq) * 0.5;
      pose(a, 'scope', -(out ? out.scope || 0 : 0), 0, 0, 0, 0, 0, 1, 1, 1);
      pose(a, 'deck', 0, 0, 0, 0, 0, 0, xz, sq, xz);
      lamps(a, 9, function (g, c) { return mix(c, LAMP_OFF, PARTY_COL[g], clamp01(Math.max(base, wave) * (M ? M.wave(now, g, 9, 0.8, wave, red) : 1))); });
      return false;
    }

    /* ---------- Concert Stage: the LED wall, footlights, light pools, moving heads and the crowd ---------- */
    var NEON = NEON4.map(lin), POOL_OFF = lin('PX City Deck'), FOOT_COL = RAINBOW.map(lin);
    function holdSec() { var L = looks(); return L && L.TEMPO && L.TEMPO.encoreSec > 0 ? L.TEMPO.encoreSec : 8; }
    function collapseInto(arr, p) { for (var v = 0; v < arr.length; v += 3) { arr[v] = p[0]; arr[v + 1] = p[1]; arr[v + 2] = p[2]; } }
    function stageDraw(a, s, out, tt, rec) {
      var red = !!a.reduced, card = isCard(a), now = timeOf(a), M = mo(), bn = beatOf(s, a), bf = s.bf, k = s.k;
      var heads = out ? clamp01(out.heads) : 0, chase = Math.max(out ? clamp01(out.chase) : 0, card ? 0 : k), beams = Math.max(out ? clamp01(out.beams) : 0, card ? 0 : 0.6 * k);
      if (out && rec && !rec.held) { rec.held = true; s.t0 = rec.t0; s.hold = rec.t0 + holdSec(); s.forced = true; }
      var hold = !card && s.hold != null && now < s.hold;
      if (!hold && s.held) s.forced = true;                         /* the wall goes back to its own program */
      s.held = hold;
      if (screen(a, 'wall', wallCell({ f: card ? 0 : ledStep(now, red), k: k, bar: a.bar, pages: pagesFor(a), hold: hold ? ledStep(now - s.t0, red) : null, card: card }), !!s.forced)) s.forced = false;
      var hue = !red && chase > 0.01 ? bn >> 2 : 0;                  /* the footlights' rainbow steps on once per bar while they chase */
      lamps(a, 12, function (g, c) {
        if (g > 7) return mix(c, POOL_OFF, NEON[g - 8], lerp(0.4, 1, beams));
        return mix(c, FOOT_COL[(g + hue) % 6], WHITE, 0.6 * chase * clamp01(((M ? M.diagChase(g, 0, bn, bf, 4, red) : 0.8) - 0.35) / 0.65));
      });
      /* the heads: parked by day, a slow nod at night, down onto the deck in the act */
      pose(a, 'lights', lerp(8, 32, heads) + (red || card ? 0 : 10 * k * (1 - heads) * Math.sin(TAU * 0.12 * now)), 0, 0, 0, 0, 0, 1, 1, 1);
      /* the crowd stands up for the act and the encore hold (never under reduced motion): its geometry
         is collapsed in the template and stands in this copy only while it shows */
      var u = red || card ? 0 : crowdU(out ? tt : null, now, s.hold), up = u > 1e-3, piv = a.template && a.template.pivots;
      if (up !== !!s.crowdUp) {
        var pa = attr(copyGeo(a, CROWD_PART), 'position'), base = BASE_POS.get(a.template);
        if (pa && base && base.length === pa.array.length) {
          if (up) pa.array.set(base); else collapseInto(pa.array, piv && piv.crowd ? piv.crowd.origin : [0, 0, 1.5]);
          pa.needsUpdate = true;
        }
        s.crowdUp = up;
      }
      if (up) pose(a, 'crowd', 0, 0, 0, 0, 0.03 * u * (0.5 - 0.5 * Math.cos(TAU * bf)), 0, 1, Math.max(1e-3, u), 1);
      else if (s.crowdUp === false) { rest(a, 'crowd'); s.crowdUp = null; }
      if (s.hold != null && now >= s.hold + 0.5) s.hold = null;
      return true;
    }
    /* the island template (ns 'vox', LOD0) carries the crowd, collapsed onto its pivot: placement
       ghosts, drop-ins and static bakes never show it. makeFan is looked up now, never at factory time (D76) */
    function stageVoxels(st, ctx) {
      ctx = ctx || {};
      var want = ctx.crowd != null ? !!ctx.crowd : ctx.ns === 'vox' && !ctx.lod && !ctx.full;
      return VOXELS.bld_stage(st, { tier: ctx.tier, crowd: want, fan: SL && SL.vox && typeof SL.vox.makeFan === 'function' ? SL.vox.makeFan : null });
    }
    function stageBuild(ctx) {
      var tpl = ((ctx.K && ctx.K.vox) || K.vox).template(ctx, stageVoxels(ctx.st, ctx)).done(), part = null, i;
      for (i = 0; i < tpl.parts.length; i++) if (tpl.parts[i].name === CROWD_PART) part = tpl.parts[i];
      var pa = part ? attr(part.geo, 'position') : null;
      if (pa && pa.array) {
        BASE_POS.set(tpl, new Float32Array(pa.array));
        collapseInto(pa.array, tpl.pivots.crowd ? tpl.pivots.crowd.origin : [0, 0, 1.5]);
        pa.needsUpdate = true;
        if (typeof part.geo.computeBoundingBox === 'function') part.geo.computeBoundingBox();
        if (typeof part.geo.computeBoundingSphere === 'function') part.geo.computeBoundingSphere();
      }
      return tpl;
    }

    return {
      bld_photobooth: handler('bld_photobooth', boothDraw, boothAct),
      bld_boba: handler('bld_boba', bobaDraw, function () { return { emitAt: emitTo({ heart: 'table', sparkle: 'cup' }) }; }),
      bld_ledtower: handler('bld_ledtower', towerDraw, function () { return { emitAt: emitTo({ sparkle: 'screenFront' }) }; }),
      bld_recording: handler('bld_recording', studioDraw, studioAct),
      bld_dance: handler('bld_dance', danceDraw, function () { return { emitAt: emitTo({ note: 'speaker', sparkle: 'floor' }) }; }),
      bld_rooftop: handler('bld_rooftop', roofDraw, function () { return { emitAt: emitTo({ star: 'scope', sparkle: 'roof' }) }; }),
      bld_stage: handler('bld_stage', stageDraw, function () { return { emitAt: emitTo({ confetti: 'cone1', sparkle: 'spot' }) }; }, { voxels: stageVoxels, build: stageBuild })
    };
  }

  return {
    VERSION: VERSION, IDS: IDS, ACT: ACT, PERFORM: PERFORM, TOKENS: TOKENS, CELLS: CELLS, NOTE_CELL: NOTE_CELL, NOTE_ROWS: NOTE_ROWS, ENCORE_CELL: ENCORE_CELL, encoreRows: encoreRows, CYCLE: CYCLE,
    WALL_DAY: WALL_DAY, WALL_NIGHT: WALL_NIGHT, PART: PART, CROWD_PART: CROWD_PART, DECK_Y: DECK_Y, voxels: VOXELS, factory: factory,
    /* pure helpers */
    ledHz: ledHz, ledStep: ledStep, namePages: namePages, towerCells: towerCells, nextProgram: nextProgram, wallCell: wallCell,
    crowdSpots: crowdSpots, crowdU: crowdU, ownFan: ownFan, crowd: crowd, slew: slew, sortQuads: sortQuads, boxAt: boxAt, makeBook: makeBook
  };
}));
