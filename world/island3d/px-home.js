/* ================================================================
   My Island 3D v3 — the voxel home (W2.3; voxel-engine PX5). window.SLPxHome in the browser
   (classic script; registers through SL3D.defineVox('home', factory)), module.exports in Node:
   the pure layer below (no THREE, no DOM) — every id's voxels(st) → VoxModel, the state
   resolver and keys, the perCopy layout and the idle / act timelines (tests).
     house_cottage                                   the 2×2 home, composed from
     shape (5) × crown (the roof slot dresses each shape's crown) × wall (9) × door (5) × details (5)
     wall_* · roof_* · door_* · detail_* · shape_*   each style id's model is the player's own house
                                                     wearing it (photocards), by SLIslandLook.resolveStyle
   houseState, stateKey, resolveStyle and HOUSE_H are world-look's, unchanged.

   GRAIN (D11). Authoring units are sixteenths of a u on four layers that share one lattice:
     A  G4 0.25 u, half a voxel off (bounds on odd eighths: 7 / 5 / 3 / 1 wide masses, centred)
     B  G4 0.25 u (bounds on quarters: the cottage's 6-wide walls, the tower's middle storey)
     T  G8 0.125 u — trims, doors, coping, crenels, turrets, chimney, deck and pool
     F  G16 0.0625 u — window panes, wires and bulbs, neon, drips, sprinkles, smoke, the flag
   Item space as the kit: base y = 0, pivot at the footprint centre, facing +z; shells stay inside
   ±0.875 (7 G4 voxels), proud trims inside ±0.9375; heights follow HOUSE_H (all ≤ 2.9).

   SHAPES (the default is the loft)
     shape_cottage  the mockup house: lilac chequer-rim base, 6-wide walls, a recessed door between two
                    sash windows, a four-step pyramid roof in the ROOF colours with a sunny cap
     shape_loft     a lower box under a cantilevered upper box (a porch on a post, three downlights),
                    a floor-to-ceiling glass wall, a ribbon window, a roof terrace
     shape_villa    an L of two low wings under stepped hip roofs, a plank deck round a plunge pool
                    (a ripple ring every 2.4 s) and a lounger
     shape_tower    three storeys telescoping 1.0 / 0.75 / 0.5 u on a base, every ledge roofed, an annex
                    with a stair, and a blade sign: a member-colour ✦ over the child's initial (the atlas
                    initialCell on the island; photocards show the ✦ pictogram)
     shape_dome     an observatory: a drum with block portholes and an airlock door that SLIDES 0.36 u,
                    a glowing band on its equator (a hue travelling at 0.25 Hz at night), a three-ring
                    dome (the crown), a glass pod and an antenna with a breathing tip
   Every non-cottage shape has 2 trims (state.variant): window rhythm and accent-panel side.
   CROWNS  red: two alternating tile tones (+ the sunny cap) · blue: slate bands + a lighter ridge ·
     thatch: three hashed straws, bumps and a fringe · candy: two pinks, a white icing lip with 12
     drips, 24 sprinkles and a cherry · castle: a stone slab, crenels and 2 turrets with stepped
     spires (generic battlements; it hides the rooftop flag, as houseState rules).
   WALLS   the LOCKED WALL hex + one pattern each (peach posts, specks, boards, siding, quoins,
     speckle, seams, cornice, pale trim; midnight's windows glow brighter).
   DOORS   blue / red / green: the atlas door cells · gold: an arched gold slab with 3 glint voxels
     (sparkles twice every 4 s) · glass: the atlas glass door in a dark frame.
   DETAILS window boxes · chimney + 5 smoke puffs · 11 fairy bulbs · flag · member-colour neon.

   PARTS (≤ 5; one 'vox' material)
     body               the shell, trims and static glow voxels
     state_windowGlow   window glass, glow mode: Water by day → Window Warm at night (D51)
     door               the door slab on pivot 'door' (its atlas decal and glints ride it)
     copy_0             perCopy lamps, glow mode, lit on the CPU: fairy bulbs, neon, the sign's ✦ and
                        its initial decal, the dome band and tip, the pool
     copy_1             perCopy movers, placed on the CPU: smoke puffs and the flag
   The mesher gives every pivot its own part, so only the door rides one: puffs and the pennant
   move as perCopy vertices instead (the v2 way), which keeps every house at ≤ 5 parts.
   Pivots: door, emitter, flag, glow (+ pool | sign | ring, tip; all but the door are positions
   only). Anchors: top, door, spot, bulb0–10 (with the lights), sign. A model's `home` block
   carries its lamps and movers as boxes; layout() maps the meshed quads onto them, so copies
   need no hand-kept vertex ranges.
   LOD1 is the house's own model (lod1(st), ns 'vox-lod1'): the same shell without the fine layer.

   HANDLERS {voxels, lod1, build, idle, act, show, animated, handle, forget, setUser} (one set for every id)
     act(a, name)   'home' opens the door (a 70° swing, or the dome's slide) in 0.3 s, holds and
                    closes by itself (≤ 3 s); 'homeClose' / 'homeSwing' as v2. SLMotion 'home' cues
                    except the opening 'pop' (its 3 'heart' particles, ✦ in the v3 fx atlas, leave
                    the 'door' anchor). Acts drive the pivot, sounds and fx only: never the score.
     handle(obj, o) a handle for an Object3D from SL3D.vox.make; {photocard: true} swaps the sign's
                    initial cell for the ✦ at once (no name or initial ever reaches an icon).
   Rates (RATES, Hz): every light ≤ 2, chases ≤ 1.5 a step; reduced motion = still end states.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxHome = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('home', api.factory);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  /* lazy, feature-detected siblings: Node requires them only when they are needed */
  var sibs = {};
  function sibling(name, path) {
    if (sibs[name]) return sibs[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) sibs[name] = m;
    return m || null;
  }
  function Vox() { return sibling('SLVox', './vox.js'); }
  function Look() { return sibling('SLIslandLook', '../world-look.js'); }
  function Motion() { return sibling('SLMotion', './motion.js'); }

  var VERSION = 3;
  var HOME = 'house_cottage', COTTAGE = 'shape_cottage', SOURCE = 'px-home';
  var DEFAULTS = { wall: 'wall_cream', roof: 'roof_red', door: 'door_blue', shape: 'shape_loft' };
  var WALLS = ['wall_cream', 'wall_pink', 'wall_mint', 'wall_sky', 'wall_lilac', 'wall_concrete', 'wall_gallery', 'wall_graphite', 'wall_midnight'];
  var ROOFS = ['roof_red', 'roof_blue', 'roof_thatch', 'roof_candy', 'roof_castle'];
  var DOORS = ['door_blue', 'door_red', 'door_green', 'door_gold', 'door_glass'];
  var DETAILS = ['detail_chimney', 'detail_flag', 'detail_lights', 'detail_neon', 'detail_windowbox'];
  var SHAPES = ['shape_cottage', 'shape_loft', 'shape_villa', 'shape_tower', 'shape_dome'];
  var STYLE_IDS = WALLS.concat(ROOFS, DOORS, DETAILS, SHAPES);
  var PARTS = { shell: 'body', window: 'state_windowGlow', door: 'door', bulb: 'copy_0', anim: 'copy_1' };
  var MAX_PARTS = 5, TRIS_CAP = 1800, MAX_H = 2.9;
  var G4 = 0.25;
  var SPOT = [-0.5, 0, 1.5];                 /* the avatar's spot: the left entrance cell, for every shape */
  var HOLD = { home: 2.4, swing: 0.6 };      /* open 0.3 + hold + close 0.3: 'home' stays ≤ 3 s */
  var OPEN_DEG = 70, SLIDE = 0.36;
  var FAIRY = ['Star Gold', 'Coral', 'Splash Blue', 'Leaf Mint', 'Grape'];
  var NEON3 = ['Neon Magenta', 'LED Cyan', 'Electric Violet'];
  var SMOKE = { n: 5, period: 2.4, rise: 0.6, drift: [0.12, -0.04], grow: 0.8 };
  var FLAG = { amp: 0.04, w: 6 };
  var GLINT = { period: 4, n: 2, gap: 0.6, fx: { token: 'Gold Light', size: 0.2 } };
  var POOL = { period: 2.4, hi: 'PX Sea Top 1' };
  /* every rate in Hz (the look's ART3.FREQS wins where it names one; all ≤ MAX_FLASH_HZ 2) */
  var RATES = { bulbDay: 0.5, bulbChase: 1.5, bulbGroups: 3, neon: 1, neonGroups: 4, sign: 0.5, signMin: 0.7, tip: 0.5, tipMin: 0.6,
                ring: 0.25, flag: 0.5, smoke: 1 / SMOKE.period, ripple: 1 / POOL.period, glint: 1 / GLINT.gap };
  function rate(name, key) {
    var L = Look(), f = L && L.ART3 && L.ART3.FREQS ? L.ART3.FREQS[key] : undefined;
    return Math.min(2, typeof f === 'number' && f > 0 ? f : RATES[name]);
  }

  /* ---------------- small helpers ---------------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function frac(v) { return v - Math.floor(v); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : (d || 0); }
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function pick(v, list, d) { return typeof v === 'string' && list.indexOf(v) >= 0 ? v : d; }
  /* '#RGB' / '#RRGGBB' / 'RRGGBB' → '#RRGGBB', else null (the runtime member colour) */
  function hexOf(v) {
    if (typeof v !== 'string') return null;
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
    if (!m) return null;
    return '#' + (m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1]).toUpperCase();
  }
  /* deterministic [0, 1) per voxel (nothing here is ever random) */
  function hash3(i, j, k, s) {
    var h = 0x811c9dc5 ^ (s | 0);
    h = Math.imul(h ^ (i & 0xffff), 0x01000193); h = Math.imul(h ^ (j & 0xffff), 0x01000193); h = Math.imul(h ^ (k & 0xffff), 0x01000193);
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ================================================================
     STATE: {wall, roof, door, details[], shape, variant} and its keys (as v2 / SLIslandLook)
     ================================================================ */
  function detailList(d) {
    var list = Array.isArray(d) ? d : (d && typeof d === 'object' ? Object.keys(d).filter(function (k) { return d[k]; }) : []), out = [];
    list.forEach(function (x) { if (DETAILS.indexOf(x) >= 0 && out.indexOf(x) < 0) out.push(x); });
    return out.sort();
  }
  /* unknown ids from a newer look table fall back to the defaults, so a build never throws */
  function fixState(r) {
    var shape = pick(r.shape, SHAPES, DEFAULTS.shape);
    var s = { wall: pick(r.wall, WALLS, DEFAULTS.wall), roof: pick(r.roof, ROOFS, DEFAULTS.roof), door: pick(r.door, DOORS, DEFAULTS.door),
              details: detailList(r.details), shape: shape, variant: shape === COTTAGE ? 0 : (r.variant | 0) > 0 ? 1 : 0 };
    if (s.roof === 'roof_castle') s.details = s.details.filter(function (d) { return d !== 'detail_flag'; });
    return s;
  }
  /* the resolved style for a build; a style id previews itself on the house. SLIslandLook.resolveStyle
     wins when it is loaded */
  function homeState(id, st) {
    var L = Look();
    if (L && typeof L.resolveStyle === 'function' && L.LOOK && L.LOOK[id]) {
      try { var r = L.resolveStyle(id, st || {}); if (r && typeof r.wall === 'string' && Array.isArray(r.details)) return fixState(r); } catch (e) { /* fall through */ }
    }
    st = st || {};
    var s = { wall: st.wall, roof: st.roof, door: st.door, details: detailList(st.details), shape: st.shape, variant: st.variant };
    var m = /^(wall|roof|door|detail|shape)_/.exec(String(id || ''));
    if (m && STYLE_IDS.indexOf(id) >= 0) { if (m[1] === 'detail') s.details = s.details.concat([id]); else s[m[1]] = id; }
    return fixState(s);
  }
  /* 'wall|roof|door|d:a,b' (the cottage: the exact v1 key) or that + '|s:<shape>|v:<n>' → state | null */
  var keyMemo = {};
  function parseKey(k) {
    if (typeof k !== 'string') return null;
    if (own(keyMemo, k)) return keyMemo[k];
    var p = k.split('|'), out = null, det = p.length >= 4 && p[3].slice(0, 2) === 'd:' ? (p[3].slice(2) ? p[3].slice(2).split(',') : []) : null;
    if (det && p.length === 4) out = fixState({ wall: p[0], roof: p[1], door: p[2], details: det, shape: COTTAGE, variant: 0 });
    else if (det && p.length === 6 && p[4].slice(0, 2) === 's:' && /^v:-?\d+$/.test(p[5])) {
      out = fixState({ wall: p[0], roof: p[1], door: p[2], details: det, shape: p[4].slice(2), variant: +p[5].slice(2) });
    }
    return (keyMemo[k] = out);
  }
  function stateKeyOf(s) {
    var k = s.wall + '|' + s.roof + '|' + s.door + '|d:' + s.details.join(',');
    return !s.shape || s.shape === COTTAGE ? k : k + '|s:' + s.shape + '|v:' + (s.variant ? 1 : 0);
  }
  function stateOf(v) { return typeof v === 'string' ? parseKey(v) : (v && v.wall ? fixState(v) : homeState(HOME, v)); }
  /* does a copy in this style need idle ticks? (smoke, flag, lights, neon, gold glints, and the
     villa ripple, tower sign and dome band / tip) */
  var LIVE_SHAPES = { shape_villa: 1, shape_tower: 1, shape_dome: 1 };
  function animated(v) {
    var s = stateOf(v);
    return !!s && (s.door === 'door_gold' || !!LIVE_SHAPES[s.shape] || s.details.some(function (d) { return d !== 'detail_windowbox'; }));
  }
  /* the template parts a state builds (≤ MAX_PARTS) */
  function partsFor(v) {
    var s = stateOf(v), out = [PARTS.shell, PARTS.window, PARTS.door];
    if (!s) return [];
    function has(d) { return s.details.indexOf(d) >= 0; }
    if (LIVE_SHAPES[s.shape] || has('detail_lights') || has('detail_neon')) out.push(PARTS.bulb);
    if (has('detail_chimney') || has('detail_flag')) out.push(PARTS.anim);
    return out;
  }
  /* every id this file registers: the house plus the CATALOG's home styles it understands */
  function homeIds() {
    var ids = [HOME].concat(STYLE_IDS), C = sibling('SLWorldCore', '../world-core.js');
    if (C && Array.isArray(C.CATALOG)) C.CATALOG.forEach(function (it) { if (it && it.kind === 'style' && STYLE_IDS.indexOf(it.id) >= 0 && ids.indexOf(it.id) < 0) ids.push(it.id); });
    return ids;
  }

  /* ================================================================
     STYLE TABLES — palette tokens only (D50: this file's own tokens go through addTokens)
     ================================================================ */
  /* a wall: k = its second tone (darker < 0 < lighter), y = its accent, pat(i, j, k, corner, top, base) → char */
  var WALL_STYLE = {
    wall_cream: { k: -0.07, y: 'PX Home Peach', pat: function (i, j, k, c, top) { return c ? 'y' : top ? 'x' : 'w'; } },
    wall_pink: { k: -0.1, y: 'Cloud White', pat: function (i, j, k) { return hash3(i, j, k, 11) < 0.2 ? 'x' : 'w'; } },
    wall_mint: { k: -0.1, y: 'Cloud White', pat: function (i, j, k) { return (i + k) & 1 ? 'x' : 'w'; } },
    wall_sky: { k: -0.1, y: 'Cloud White', pat: function (i, j) { return j & 1 ? 'x' : 'w'; } },
    wall_lilac: { k: -0.12, y: 'Cloud White', pat: function (i, j, k, c) { return c ? (j & 1 ? 'y' : 'x') : 'w'; } },
    wall_concrete: { k: -0.1, y: 'Concrete Light', pat: function (i, j, k, c, top) { return top ? 'y' : hash3(i, j, k, 23) < 0.3 ? 'x' : 'w'; } },
    wall_gallery: { k: -0.14, y: 'Concrete Light', pat: function (i, j, k, c, top, base) { return base || c ? 'x' : 'w'; } },
    wall_graphite: { k: 0.12, y: 'Bone White', pat: function (i, j, k, c, top) { return top ? 'y' : 'w'; } },
    wall_midnight: { k: 0.14, y: 'Holo Blue', pat: function (i, j, k, c, top) { return top ? 'y' : c ? 'x' : 'w'; } }
  };
  var WALL_HEX = { wall_cream: '#f7e6c4', wall_pink: '#f9b7cc', wall_mint: '#b8ecd6', wall_sky: '#a9d6f7', wall_lilac: '#d6bdf2',
                   wall_concrete: '#a9a5b3', wall_gallery: '#eceaf2', wall_graphite: '#34303f', wall_midnight: '#232a57' };
  var ROOF_STYLE = {
    roof_red: { r: 'ROOF.roof_red.0', R: 'ROOF.roof_red.1', q: 'PX Sunny' },
    roof_blue: { r: 'ROOF.roof_blue.0', R: 'ROOF.roof_blue.1', q: 'Holo Blue' },
    roof_thatch: { r: 'ROOF.roof_thatch.0', R: 'ROOF.roof_thatch.1', q: 'Butter' },
    roof_candy: { r: 'ROOF.roof_candy.0', R: 'ROOF.roof_candy.1', q: 'Cloud White' },
    roof_castle: { r: 'Castle Stone', R: 'PX Castle Stone Shade', q: 'Castle Tower' }
  };
  var DOOR_STYLE = {
    door_blue: { cell: 'door:blue', frame: 't' }, door_red: { cell: 'door:red', frame: 't' }, door_green: { cell: 'door:green', frame: 't' },
    door_gold: { cell: null, frame: 't', gold: true }, door_glass: { cell: 'door:glass', frame: 'V' }
  };
  function shadeName(wall) { var n = wall.slice(5); return 'PX Home ' + n.charAt(0).toUpperCase() + n.slice(1) + ' 2'; }
  /* k < 0 darkens toward black, k > 0 lightens toward white (sRGB channels) */
  function shadeHex(hex, k) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var sh = 16; sh >= 0; sh -= 8) {
      var c = (n >> sh) & 255;
      out += ('0' + Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k).toString(16)).slice(-2);
    }
    return out.toUpperCase();
  }
  /* this file's tokens: the base's chequer tone, the cream posts and each wall's second tone */
  var tokensDone = false;
  function ensureTokens() {
    var L = Look();
    if (tokensDone || !L || typeof L.addTokens !== 'function') return;
    var map = { 'PX Home Base 2': '#BFAAF0', 'PX Home Peach': '#FFC49A' };
    WALLS.forEach(function (w) { map[shadeName(w)] = shadeHex((L.LOCKED && L.LOCKED.WALL && L.LOCKED.WALL[w]) || WALL_HEX[w], WALL_STYLE[w].k); });
    L.addTokens(SOURCE, map);
    tokensDone = true;
  }
  function memberToken() { var L = Look(); return (L && L.MEMBER_FALLBACK) || 'Bubblegum'; }
  /* one palette for every house: the style picks the tokens behind the wall, roof and door chars */
  function paletteFor(s) {
    var R = ROOF_STYLE[s.roof], mem = memberToken();
    function lamp(token) { return { token: token, mode: 'glow', copy: true }; }
    function mover(token) { return { token: token, copy: 1 }; }
    return {
      w: 'WALL.' + s.wall, x: shadeName(s.wall), y: WALL_STYLE[s.wall].y, l: 'PX Lilac Base', L: 'PX Home Base 2', i: 'PX Ink Eye',
      t: 'Cloud White', V: 'Gunmetal', A: 'Gunmetal Mid', K: 'PX Tree Plank', H: 'Midnight Ink', J: 'PX Castle Stone', I: 'Lamp Post',
      g: { token: 'Water', mode: 'glow', state: { key: 'windowGlow', off: 'Water', on: s.wall === 'wall_midnight' ? 'PX Bulb Warm' : 'Window Warm' } },
      v: { token: 'PX Bulb Warm', mode: 'glow' }, G: { token: 'PX Glint', mode: 'glow' },
      r: R.r, R: R.R, q: R.q, Q: 'Castle Cone', u: 'Tulip Red', z: 'PX Leaf 2',
      d: 'DOOR.' + s.door, k: 'Gold Deep', c: 'PX Lilac', C: 'PX Castle Banner', p: 'Pole', W: 'Cloud White',
      o: 'PX Candy Pink', a: 'Tulip Red', b: 'PX Sunny', e: 'Cloud White', h: 'PX Lilac', D: { token: 'PX Pier Plank', mode: 'plank' },
      6: 'Star Gold', 7: 'Splash Blue', 8: 'Leaf Mint', 9: 'Grape', 0: 'Cloud White',
      1: lamp(FAIRY[0]), 2: lamp(FAIRY[1]), 3: lamp(FAIRY[2]), 4: lamp(FAIRY[3]), 5: lamp(FAIRY[4]),
      n: lamp(mem), N: lamp(mem), m: lamp(mem), M: lamp(mem), X: lamp(mem), B: lamp('Holo Blue'), T: lamp('Sunset Amber'),
      P: lamp('PX Sea Top 2'), O: lamp('PX Sea Top 2'),
      s: mover('Cloud White'), S: mover('Smoke'), f: mover('Star Gold'), j: mover('Star Gold'), U: mover('Star Gold')
    };
  }

  /* ================================================================
     THE BUILDER — coordinates are sixteenths of a u (integers), so every bound is checked
     against its layer's lattice and nothing is ever placed by float
     ================================================================ */
  function Layer(n, half, b) {
    this.n = n; this.off = half ? 2 : 0; this.b = b;
    this.o = Vox().grid({ grid: n / 16, origin: half ? [0.5, 0, 0.5] : [0, 0, 0] });
  }
  Layer.prototype.ix = function (v, axis) {
    var q = (v + (axis === 1 ? 0 : this.off)) / this.n, r = Math.round(q);
    if (r !== q) this.b.issues.push('house: ' + v + '/16 u is off the ' + this.n + '/16 lattice');
    return r;
  };
  /* a box [x0, x1) × [y0, y1) × [z0, z1); c = a palette char, null (carve) or a wall pattern */
  Layer.prototype.box = function (x0, x1, y0, y1, z0, z1, c) {
    var i0 = this.ix(x0, 0), i1 = this.ix(x1, 0) - 1, j0 = this.ix(y0, 1), j1 = this.ix(y1, 1) - 1, k0 = this.ix(z0, 2), k1 = this.ix(z1, 2) - 1;
    if (i1 < i0 || j1 < j0 || k1 < k0 || (this.n === 1 && this.b.lod && !this.b.pane)) return this;      /* LOD1 drops the fine layer */
    var wide = i1 - i0 > 3 && k1 - k0 > 3;                   /* corner posts and quoins only on masses ≥ 5 voxels wide */
    if (c && y1 > this.b.hi) this.b.hi = y1;
    this.o.box(i0, i1, j0, j1, k0, k1, typeof c !== 'function' ? c : function (i, j, k) {
      return c(i, j, k, wide && (i === i0 || i === i1) && (k === k0 || k === k1), j === j1, j === j0);
    });
    return this;
  };
  Layer.prototype.set = function (x, y, z, c) { return this.box(x, x + this.n, y, y + this.n, z, z + this.n, c); };

  function Build(s, lod) {
    this.s = s; this.issues = []; this.hi = 0; this.slide = false; this.glints = null; this.lod = !!lod; this.pane = false;
    this.A = new Layer(4, true, this); this.B = new Layer(4, false, this); this.T = new Layer(2, false, this); this.F = new Layer(1, false, this);
    this.decals = []; this.anchors = {}; this.pivots = {}; this.lamps = []; this.anim = [];
  }
  var BP = Build.prototype;
  function at4(x, y, z) { return [x / 4 - 0.5, y / 4 - 0.5, z / 4 - 0.5]; }      /* sixteenths → root (G4) voxel coords */
  BP.pivot = function (name, x, y, z) { this.pivots[name] = { at: at4(x, y, z) }; };
  BP.anchor = function (name, x, y, z) { this.anchors[name] = at4(x, y, z); };
  BP.walls = function (L, x0, x1, y0, y1, z0, z1) { L.box(x0, x1, y0, y1, z0, z1, WALL_STYLE[this.s.wall].pat); };
  /* is there shell (A, B or T) at this point? */
  BP.solid = function (x, y, z) {
    return this.A.o.has(Math.floor((x + 2) / 4), Math.floor(y / 4), Math.floor((z + 2) / 4)) ||
           this.B.o.has(Math.floor(x / 4), Math.floor(y / 4), Math.floor(z / 4)) || this.T.o.has(x >> 1, y >> 1, z >> 1);
  };
  /* a proud pane on a wall face f ('+z' | '-z' | '+x' | '-x'): lower-left (u, y) along the wall, at =
     the wall plane, w × h G16 voxels; a white frame, glazing bars every mx / my, glowing glass.
     Back ('-z') panes are for turntables: the island culls their faces and sees only thin edges */
  BP.win = function (f, u, y, at, w, h, mx, my) {
    this.pane = true;                                                             /* LOD1: one plain pane, no frame */
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = !this.lod && (!c || c === w - 1 || !r || r === h - 1 || (mx && c % mx === 0) || (my && r % my === 0)) ? 't' : 'g';
      if (f === '+z' || f === '-z') this.F.set(u + c, y + r, f === '+z' ? at : at - 1, ch); else this.F.set(f === '+x' ? at : at - 1, y + r, u + c, ch);
    }
    this.pane = false;
  };
  /* the door in its carved opening: foot centre (xc, y0), wall face zf. A 4 × 5 G8 slab recessed one
     voxel on pivot 'door' under a lintel; o.jamb adds the side frames of a 0.75 u opening, o.slide
     makes it the dome's airlock (jambs in front, the slab slides behind them) */
  BP.door = function (xc, y0, zf, o) {
    o = o || {};
    var T = this.T, F = this.F, D = DOOR_STYLE[this.s.door], fr = o.frame || D.frame, jz = o.slide ? zf - 2 : zf - 4, i0 = (xc - 4) / 2, i1 = (xc + 2) / 2;
    if (o.jamb) { T.box(xc - 6, xc - 4, y0, y0 + 12, jz, zf, fr); T.box(xc + 4, xc + 6, y0, y0 + 12, jz, zf, fr); }
    T.box(xc - 4, xc + 4, y0 + 10, y0 + 12, zf - 4, zf, fr);
    T.o.group('door', function () {
      T.box(xc - 4, xc + 4, y0, y0 + 10, zf - 4, zf - 2, D.gold ? function (i) { return i === i0 || i === i1 ? 'k' : 'd'; } : 'd');
      if (D.gold) { T.box(xc - 4, xc - 2, y0 + 8, y0 + 10, zf - 4, zf - 2, null); T.box(xc + 2, xc + 4, y0 + 8, y0 + 10, zf - 4, zf - 2, null); }
    });
    if (D.cell && !this.lod) this.decals.push({ face: '+z', at: [i0, y0 / 2, (zf - 4) / 2], size: [4, 5], cell: D.cell, pivot: 'door', layer: 2 });
    if (D.gold) {
      F.o.group('door', function () { [[-2, 6], [1, 4], [-1, 1]].forEach(function (g) { F.set(xc + g[0], y0 + g[1], zf - 2, 'G'); }); });
      this.glints = [[(xc - 1.5) / 16, (y0 + 6.5) / 16, zf / 16], [(xc + 1.5) / 16, (y0 + 4.5) / 16, zf / 16]];
    }
    this.slide = !!o.slide;
    this.pivot('door', o.slide ? xc : xc - 4, y0, zf - 2);
    this.anchor('door', xc, y0 + 5, zf + 2);
  };

  /* ---- fascia runs: where wires, bulbs, neon, drips and fringes go. A segment is {ax 'z' (a +z
     face along x) | 'x' (a ±x face along z, sg), a0 → a1, at (the face plane), lit}; cells are the
     G16 voxels just proud of it ---- */
  function cellOf(g, u, y) { return g.ax === 'z' ? [u, y, g.at] : [g.sg > 0 ? g.at : g.at - 1, y, u]; }
  function boxSegs(x0, x1, z0, z1) {
    return [{ ax: 'x', a0: z0, a1: z1, at: x0, sg: -1 }, { ax: 'z', a0: x0, a1: x1, at: z1, lit: true }, { ax: 'x', a0: z1, a1: z0, at: x1, sg: 1 }];
  }
  /* the front of a stepped octagon: steps [[half width, z of its front face]…] front row first, zb =
     where the two side runs end */
  function octSegs(steps, zb) {
    var out = [], n = steps.length - 1, e;
    out.push({ ax: 'x', a0: zb, a1: steps[n][1], at: -steps[n][0], sg: -1, lit: true });
    for (e = n; e > 0; e--) {
      out.push({ ax: 'z', a0: -steps[e][0], a1: -steps[e - 1][0], at: steps[e][1], lit: true });
      out.push({ ax: 'x', a0: steps[e][1], a1: steps[e - 1][1], at: -steps[e - 1][0], sg: -1, lit: true });
    }
    out.push({ ax: 'z', a0: -steps[0][0], a1: steps[0][0], at: steps[0][1], lit: true });
    for (e = 1; e <= n; e++) {
      out.push({ ax: 'x', a0: steps[e - 1][1], a1: steps[e][1], at: steps[e - 1][0], sg: 1, lit: true });
      out.push({ ax: 'z', a0: steps[e - 1][0], a1: steps[e][0], at: steps[e][1], lit: true });
    }
    out.push({ ax: 'x', a0: steps[n][1], a1: zb, at: steps[n][0], sg: 1, lit: true });
    return out;
  }
  /* fn(seg, u, n) for every proud cell along the run, in chase order */
  BP.run = function (segs, fn) {
    var n = 0;
    segs.forEach(function (g) {
      var d = g.a1 >= g.a0 ? 1 : -1;
      for (var u = g.a0; u !== g.a1; u += d) fn(g, d > 0 ? u : u - 1, n++);
    });
    return n;
  };
  /* n drips hanging from row y, 1…len voxels long, evenly along the run */
  BP.drips = function (segs, y, n, len, ch) {
    var cells = [], F = this.F;
    this.run(segs, function (g, u) { cells.push([g, u]); });
    for (var m = 0; m < n && cells.length; m++) {
      var e = cells[Math.floor((m + 0.5) * cells.length / n)], l = 1 + Math.floor(hash3(m, n, y, 47) * len);
      for (var d = 0; d < l; d++) { var c = cellOf(e[0], e[1], y - d); F.set(c[0], c[1], c[2], ch); }
    }
  };
  /* the n open cells (q sixteenths square) of the surfaces tops [[x0, x1, z0, z1, y]…] with the
     smallest hash: where sprinkles and straw bumps sit */
  BP.scatter = function (tops, q, n, seed) {
    var cells = [], self = this;
    tops.forEach(function (t) {
      for (var z = t[2]; z + q <= t[3]; z += q) for (var x = t[0]; x + q <= t[1]; x += q) {
        if (self.solid(x, t[4] - 1, z) && self.solid(x + q - 1, t[4] - 1, z + q - 1) && !self.solid(x, t[4], z) && !self.solid(x + q - 1, t[4], z + q - 1)) cells.push([x, t[4], z, hash3(x, t[4], z, seed)]);
      }
    });
    return cells.sort(function (a, c) { return a[3] - c[3] || a[0] - c[0] || a[2] - c[2]; }).slice(0, n);
  };
  /* crenels: every other q-cell on the outer edge of the surface at y */
  BP.crenels = function (y, q, x0, x1, z0, z1) {
    var self = this, list = [];
    function ledge(x, z) { return self.solid(x, y - 1, z) && !self.solid(x, y, z); }
    for (var z = z0; z < z1; z += q) for (var x = x0; x < x1; x += q) {
      if (ledge(x, z) && !(((x - x0) / q + (z - z0) / q) & 1) && !(self.solid(x - q, y - 1, z) && self.solid(x + q, y - 1, z) && self.solid(x, y - 1, z - q) && self.solid(x, y - 1, z + q))) list.push([x, z]);
    }
    list.forEach(function (c) { self.T.box(c[0], c[0] + q, y, y + q, c[1], c[1] + q, 'r'); });
  };
  /* a turret w wide from yb to yt with a stepped spire (w 8: +10, 4: +6, 2: +4) and a slit */
  BP.turret = function (x, z, w, yb, yt) {
    var self = this, y = yt;
    this.T.box(x, x + w, yb, yt, z, z + w, 'q');
    this.F.box(x + w / 2 - 1, x + w / 2 + 1, yt - 5, yt - 2, z + w, z + w + 1, 'I');
    (w === 8 ? [[8, 4], [4, 4], [2, 2]] : w === 4 ? [[4, 2], [2, 4]] : [[2, 4]]).forEach(function (t) {
      var d = (w - t[0]) / 2;
      (t[0] > 2 || !(d & 1) ? self.T : self.F).box(x + d, x + d + t[0], y, y + t[1], z + d, z + d + t[0], 'Q');
      y += t[1];
    });
  };
  BP.cherry = function (x, y, z, small) {
    if (small) { this.F.box(x, x + 3, y, y + 3, z, z + 3, 'u'); this.F.set(x + 1, y + 3, z + 1, 'z'); }
    else { this.T.box(x, x + 4, y, y + 4, z, z + 4, 'u'); this.F.box(x + 2, x + 3, y + 4, y + 6, z + 1, z + 2, 'z'); this.F.set(x + 3, y + 5, z + 1, 'z'); }
  };
  /* a crown level's tone: two alternating roof tones (n = the level), or three hashed straws */
  function roofTone(roof, n) {
    if (roof !== 'roof_thatch') return n & 1 ? 'R' : 'r';
    return function (i, j, k) { var h = hash3(i, j, k, 31); return h < 0.45 ? 'r' : h < 0.8 ? 'R' : 'q'; };
  }
  /* what thatch and candy add to any crown: a fringe and bumps · an icing lip, 12 drips, 24
     sprinkles and the cherry (ch [x, y, z, small]); lim caps the bumps' tops */
  BP.finish = function (roof, segs, y0, tops, ch, lim) {
    var F = this.F, T = this.T;
    if (roof === 'roof_thatch') {
      this.run(segs, function (g, u, n) {
        if (n % 3) return;
        for (var d = 1, l = hash3(u, n, y0, 5) < 0.5 ? 2 : 1; d <= l; d++) { var c = cellOf(g, u, y0 - d); F.set(c[0], c[1], c[2], d === 2 ? 'R' : 'r'); }
      });
      if (!this.lod) this.scatter(tops.filter(function (t) { return !lim || t[4] + 2 <= lim; }), 2, 10, 7).forEach(function (c) { T.box(c[0], c[0] + 2, c[1], c[1] + 2, c[2], c[2] + 2, 'q'); });
    } else if (roof === 'roof_candy') {
      this.run(segs, function (g, u) { var c = cellOf(g, u, y0); F.set(c[0], c[1], c[2], 'q'); });
      this.drips(segs, y0 - 1, 12, 3, 'q');
      this.scatter(tops, 1, 24, 9).forEach(function (c, n) { F.set(c[0], c[1], c[2], '67890'[n % 5]); });
      if (ch) this.cherry(ch[0], ch[1], ch[2], ch[3]);
    }
  };
  /* a flat crown on the box top R [x0, x1, z0, z1] at y P (tw = its turrets' width) → its roof top */
  BP.flat = function (roof, R, P, tw) {
    var T = this.T, x0 = R[0], x1 = R[1], z0 = R[2], z1 = R[3], blue = roof === 'roof_blue', zm = (z0 + z1) / 2;
    if (roof === 'roof_castle') {
      T.box(x0, x1, P, P + 2, z0, z1, 'r'); this.crenels(P + 2, 2, x0, x1, z0, z1);
      this.turret(x0, z1 - tw, tw, P, P + (tw === 4 ? 10 : 6)); this.turret(x1 - tw, z1 - tw, tw, P, P + (tw === 4 ? 10 : 6));
      return P + 2;
    }
    if (roof === 'roof_thatch') { T.box(x0, x1, P, P + 4, z0, z1, roofTone(roof, 0)); return P + 4; }
    if (roof === 'roof_candy') { T.box(x0, x1, P, P + 2, z0, z1, function (i, j, k) { return hash3(i, j, k, 13) < 0.3 ? 'R' : 'r'; }); return P + 2; }
    T.box(x0, x1, P, P + 2, z0, z1, blue ? 'R' : 'r');
    T.box(x0 + 2, x1 - 2, P + 2, P + 4, z0 + 2, z1 - 2, blue ? 'r' : function (i, j, k) { return k & 1 ? 'R' : 'r'; });
    if (blue) this.F.box(x0 + 4, x1 - 4, P + 4, P + 5, zm - 1, zm + 1, 'q');
    return P + 4;
  };

  /* ---- details ---- */
  BP.wbox = function (f, u, y, at, w) {
    for (var c = 0; c < w; c++) for (var d = 0; d < 2; d++) {
      var x = f === '+z' ? u + c : at + d, z = f === '+z' ? at + d : u + c;
      this.F.set(x, y, z, 'o');
      if (d) this.F.set(x, y + 1, z, 'abeh'[c & 3]);
    }
  };
  /* the stack (a lilac brick stack, or a steel flue) and its 5 puffs → its top */
  BP.chimney = function (x0, z0, y0, flue) {
    var top = y0 + 6;
    this.T.box(x0, x0 + 4, y0, y0 + 4, z0, z0 + 4, flue ? 'A' : 'c').box(x0, x0 + 4, y0 + 4, top, z0, z0 + 4, flue ? 'V' : 'C');
    for (var i = 0; i < SMOKE.n; i++) {
      var x = x0 + (i & 1 ? 2 : -1), y = top + 1 + 2 * i, z = z0 + 1;
      this.F.box(x, x + 2, y, y + 2, z, z + 2, i & 1 ? 'S' : 's');
      this.anim.push({ kind: 'puff', i: i, y0: top + 2, box: [x, y, z, x + 2, y + 2, z + 2] });
    }
    return top;
  };
  /* a pole h tall from y0 with a 6 × 4 pennant in three hinged pairs of columns → its top */
  BP.flag = function (x, y0, z, h, pole) {
    var top = y0 + h;
    if (pole !== false) this.F.box(x, x + 1, y0, top, z, z + 1, 'p');
    for (var c = 0; c < FLAG.w; c++) this.F.box(x + 1 + c, x + 2 + c, top - 5, top - 1, z, z + 1, 'fjU'[c >> 1]);
    this.anim.push({ kind: 'flag', x0: x + 1, w: FLAG.w, box: [x + 1, top - 5, z, x + 1 + FLAG.w, top - 1, z + 1] });
    return top;
  };
  /* a wire along the lit runs at row y with 11 bulbs hanging from it (anchors bulb0–10) */
  BP.lights = function (segs, y) {
    var F = this.F, cells = [];
    this.run(segs.filter(function (g) { return g.lit; }), function (g, u) { cells.push(cellOf(g, u, y)); });
    cells.forEach(function (c) { F.set(c[0], c[1], c[2], 'W'); });
    for (var i = 0; i < 11 && cells.length; i++) {
      var c = cells[Math.floor((i + 0.5) * cells.length / 11)], yb = y - (i & 1 ? 3 : 2);      /* a swag: every other bulb hangs lower */
      if (i & 1) F.set(c[0], y - 1, c[2], 'W');
      F.box(c[0], c[0] + 1, yb, yb + 2, c[2], c[2] + 1, String(1 + i % 5));
      this.lamps.push({ kind: 'fairy', i: i, tok: FAIRY[i % 5], box: [c[0], yb, c[2], c[0] + 1, yb + 2, c[2] + 1] });
      this.anchor('bulb' + i, c[0] + 0.5, yb + 1, c[2] + 0.5);
    }
  };
  /* a neon line along the runs at row y, in 7-voxel segments (chase order i, 4 chars so no two
     neighbours ever merge) */
  BP.neon = function (segs, y) {
    var F = this.F, lamps = this.lamps, cur = null;
    this.run(segs, function (g, u, n) {
      var c = cellOf(g, u, y), i = Math.floor(n / 7), b;
      F.set(c[0], c[1], c[2], 'nNmM'[i & 3]);
      if (!cur || cur.i !== i) lamps.push(cur = { kind: 'neon', i: i, tok: null, box: [c[0], y, c[2], c[0] + 1, y + 1, c[2] + 1] });
      b = cur.box;
      b[0] = Math.min(b[0], c[0]); b[2] = Math.min(b[2], c[2]); b[3] = Math.max(b[3], c[0] + 1); b[5] = Math.max(b[5], c[2] + 1);
    });
  };

  /* ================================================================
     SHAPES — each builds its body (unless crownOnly) and crown, and returns its site: the fascia
     runs {segs, y0 (wire row), y1}, an optional neon run, chimney [x, z, y, flue], flag [x, y, z, h,
     pole], window boxes [[face, u, y, at, w]…]
     ================================================================ */
  function cottage(b, s, crownOnly) {
    var A = b.A, B = b.B, roof = s.roof, castle = roof === 'roof_castle', segs = boxSegs(-14, 14, -14, 14);
    if (!crownOnly) {
      A.box(-14, 14, 0, 4, -14, 14, function (i, j, k) { return (Math.abs(i) === 3 || Math.abs(k) === 3) && ((i + k) & 1) ? 'L' : 'l'; });
      b.walls(B, -12, 12, 4, 20, -12, 12);
      B.box(-4, 4, 4, 16, 8, 12, null).box(-4, 4, 4, 16, 4, 8, 'i');
      b.door(0, 4, 12);
      b.F.box(-4, 4, 4, 5, 12, 14, 'o');                                           /* the door mat */
      [5, -11].forEach(function (x) { b.win('+z', x, 9, 12, 6, 7, 0, 3); b.win('-z', x, 9, -12, 6, 7, 0, 3); });
      [3, -9].forEach(function (z) { b.win('+x', z, 9, 12, 6, 7, 0, 3); b.win('-x', z, 9, -12, 6, 7, 0, 3); });
    }
    if (castle) {
      A.box(-14, 14, 20, 24, -14, 14, 'r'); b.crenels(24, 4, -14, 14, -14, 14);
      b.turret(-14, 6, 8, 24, 36); b.turret(6, 6, 8, 24, 36);
    } else {
      [14, 10, 6].forEach(function (h, n) { A.box(-h, h, 20 + 4 * n, 24 + 4 * n, -h, h, roofTone(roof, n)); });
      if (roof === 'roof_blue') A.box(-6, 6, 32, 36, -2, 2, 'q');                  /* a short lighter ridge */
      else A.box(-2, 2, 32, 36, -2, 2, roof === 'roof_red' ? 'q' : roof === 'roof_candy' ? 'u' : roofTone(roof, 3));
      if (roof === 'roof_candy') { b.F.box(0, 1, 36, 38, 0, 1, 'z'); b.F.set(1, 37, 0, 'z'); }
    }
    b.finish(roof, segs, 20, [[-14, 14, -14, 14, 24], [-10, 10, -10, 10, 28], [-6, 6, -6, 6, 32]]);
    return { segs: segs, y0: 20, y1: 24, chimney: [6, -6, castle ? 24 : 28], flag: [0, 36, 0, 9], boxes: [['+z', 5, 8, 12, 6], ['+z', -11, 8, 12, 6]] };
  }
  function loft(b, s, crownOnly) {
    var A = b.A, T = b.T, F = b.F, roof = s.roof, v = s.variant, R = [-14, 6, -10, 10], segs = boxSegs(-14, 6, -10, 10), top;
    if (!crownOnly) {
      b.walls(A, -10, 14, 0, 16, -14, 6); b.walls(A, -14, 6, 16, 28, -10, 10);
      A.box(v ? -14 : 2, v ? -6 : 6, 16, 28, 6, 10, 'd');                         /* the accent panel, in the door's colour */
      A.box(-6, 2, 0, 12, 2, 6, null).box(-6, 2, 0, 12, -2, 2, 'i');
      b.door(-2, 0, 6);
      F.box(-6, 2, 0, 1, 6, 8, 'o');                                              /* the door mat */
      T.box(-14, -12, 0, 16, 8, 10, 't');                                         /* the porch post */
      [-9, -3, 3].forEach(function (x) { F.set(x, 15, 8, 'v'); });                /* downlights under the soffit */
      b.win('+z', 4, 1, 6, 9, 13, 4, 6);                                          /* the glass wall */
      b.win('+z', v ? -5 : -12, 20, 10, v ? 9 : 13, 5, 4, 0);                     /* the ribbon window */
      b.win('+x', -9, 5, 14, 6, 7, 0, 3); b.win('+x', -7, 20, 6, 6, 5); b.win('-x', -5, 20, -14, 6, 5);
      b.win('-z', 3, 5, -14, 6, 7, 0, 3); b.win('-z', -7, 20, -10, 6, 5);
    }
    T.box(6, 14, 16, 18, -14, 6, roof === 'roof_castle' ? 'r' : 'R');             /* the roof terrace */
    top = b.flat(roof, R, 28, 4);
    b.finish(roof, segs, 28, [[-14, 6, -10, 10, top]], [-13, top, 6, true]);
    return { segs: segs, y0: 28, y1: 30, chimney: [8, -10, 18, true], flag: [-12, top, -8, 9],
             boxes: [['+z', v ? -5 : -12, 19, 10, v ? 9 : 13], ['+x', -7, 19, 6, 6]] };
  }
  function villa(b, s, crownOnly) {
    var A = b.A, T = b.T, F = b.F, roof = s.roof, v = s.variant, castle = roof === 'roof_castle';
    var segs = [{ ax: 'x', a0: -14, a1: 10, at: -14, sg: -1 }, { ax: 'z', a0: -14, a1: 2, at: 10, lit: true }, { ax: 'x', a0: 10, a1: -2, at: 2, sg: 1, lit: true },
                { ax: 'z', a0: 2, a1: 14, at: -2, lit: true }, { ax: 'x', a0: -2, a1: -14, at: 14, sg: 1 }];
    if (!crownOnly) {
      b.walls(A, -14, 14, 0, 12, -14, -2); b.walls(A, -14, 2, 0, 12, -2, 10);
      if (v) A.box(-2, 2, 0, 12, 6, 10, 'd'); else A.box(-14, -10, 0, 12, 6, 10, 'd');
      A.box(-10, -2, 0, 12, 6, 10, null).box(-10, -2, 0, 12, 2, 6, 'i');
      b.door(-6, 0, 10);
      F.box(-10, -2, 0, 1, 10, 12, 'o');
      T.box(2, 14, 0, 2, -2, 14, 'D');                                            /* the deck and its pool */
      T.box(4, 12, 0, 2, 2, 12, function (i, j, k) { return i > 2 && i < 5 && k > 1 && k < 5 ? 'P' : 'O'; });
      b.lamps.push({ kind: 'pool', i: 0, n: 2, tok: 'PX Sea Top 2', box: [6, 0, 4, 10, 2, 10] }, { kind: 'pool', i: 1, n: 2, tok: 'PX Sea Top 2', box: [4, 0, 2, 12, 2, 12] });
      b.pivot('pool', 8, 2, 7);
      F.box(4, 11, 2, 3, -1, 1, 'e'); F.box(4, 6, 3, 4, -1, 1, 'o');              /* a lounger by the sliders */
      b.win('+z', v ? 3 : 4, 1, -2, v ? 10 : 9, 9, v ? 3 : 4, 0);                 /* sliders: 2 panes, or 3 */
      b.win('+z', -14, 4, 10, 4, 7, 0, 3);
      [-11, 1].forEach(function (z) { b.win('-x', z, 4, -14, 6, 7, 0, 3); });
      [-9, 3].forEach(function (x) { b.win('-z', x, 4, -14, 6, 7, 0, 3); });
      b.win('+x', -11, 4, 14, 6, 7, 0, 3); b.win('+x', 1, 4, 2, 6, 7, 0, 3);
    }
    if (castle) {
      T.box(-14, 14, 12, 14, -14, -2, 'r'); T.box(-14, 2, 12, 14, -2, 10, 'r');
      b.crenels(14, 2, -14, 14, -14, 10);
      b.turret(-14, 6, 4, 14, 26); b.turret(10, -6, 4, 14, 26);
    } else {
      A.box(-14, 14, 12, 16, -14, -2, roofTone(roof, 0)); A.box(-14, 2, 12, 16, -2, 10, roofTone(roof, 0));
      A.box(-10, 10, 16, 20, -10, -6, roofTone(roof, 1)); A.box(-10, -2, 16, 20, -6, 6, roofTone(roof, 1));
      if (roof === 'roof_blue') F.box(-8, 8, 20, 21, -9, -7, 'q');
    }
    b.finish(roof, segs, 12, [[-14, 14, -14, -2, 16], [-14, 2, -2, 10, 16], [-10, 10, -10, 6, 20]], [-14, 16, 6], 18);
    return { segs: segs, y0: 12, y1: castle ? 14 : 16, chimney: [4, -10, castle ? 14 : 20], flag: [-6, 20, 2, 9], boxes: [['+x', 1, 3, 2, 6], ['+z', -14, 3, 10, 4]] };
  }
  function tower(b, s, crownOnly) {
    var A = b.A, B = b.B, T = b.T, F = b.F, roof = s.roof, v = s.variant, R = [-10, -2, -10, -2], segs = boxSegs(-10, -2, -10, -2), top, n;
    segs.forEach(function (g) { g.lit = true; });                                 /* a small crown: the lights go all the way round */
    if (!crownOnly) {
      A.box(-14, 2, 0, 4, -14, 6, function (i, j, k) { return k > 0 && ((i + k) & 1) ? 'L' : 'l'; });
      b.walls(A, -14, 2, 4, 16, -14, 2); b.walls(B, -12, 0, 16, 28, -12, 0); b.walls(A, -10, -2, 28, 36, -10, -2); b.walls(A, 2, 14, 0, 12, -10, 2);
      A.box(v ? -14 : -2, v ? -10 : 2, 4, 16, -2, 2, 'd');                        /* the accent panel beside the door */
      A.box(-10, -2, 4, 16, -2, 2, null).box(-10, -2, 4, 16, -6, -2, 'i');
      b.door(-6, 4, 2);
      F.box(-10, -2, 4, 5, 2, 4, 'o');
      for (n = 0; n < 6; n++) T.box(12 - 2 * n, 14 - 2 * n, 0, 2 * n + 2, 2, 6, 'J');   /* the stair up the annex */
      /* the blade sign on stand-off brackets: a member-colour ✦ over the child's initial */
      T.box(-14, -8, 16, 36, 2, 4, 'H').box(-12, -10, 20, 22, 0, 2, 'J').box(-12, -10, 30, 32, 0, 2, 'J');
      ['..X..', '..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..', '..X..'].forEach(function (row, r) { for (n = 0; n < 5; n++) if (row[n] === 'X') F.set(-13 + n, 34 - r, 4, 'X'); });
      b.lamps.push({ kind: 'sign', i: 0, tok: null, box: [-13, 28, 4, -8, 35, 5] });
      if (!b.lod) b.decals.push({ face: '+z', at: [-7, 9, 1], size: [3, 3], cell: 'initialCell', copy: true, layer: 2 });
      b.pivot('sign', -11, 26, 4); b.anchor('sign', -11, 31, 5);
      b.win('-x', -9, 9, -14, 6, 7, 0, 3); b.win('+x', -7, 4, 14, 6, 7, 0, 3);
      if (v) b.win('+z', -6, 19, 0, 5, 9, 0, 4); else b.win('+z', -7, 19, 0, 6, 7, 0, 3);
      b.win('+x', -9, 19, 0, 6, 7, 0, 3); b.win('-x', -9, 19, -12, 6, 7, 0, 3); b.win('-z', -9, 19, -12, 6, 7, 0, 3); b.win('-z', -9, 9, -14, 6, 7, 0, 3);
      b.win('+z', -9, 30, -2, 6, 5); b.win('+x', -9, 30, -2, 6, 5);
    }
    /* every ledge wears the roof: the two tiers and the annex, then the crown */
    [[-14, 2, 16, 'r'], [-12, 0, 28, 'R']].forEach(function (e) {
      T.box(e[0], e[1], e[2], e[2] + 2, e[0], e[0] + 2, e[3]).box(e[0], e[1], e[2], e[2] + 2, e[1] - 2, e[1], e[3]);
      T.box(e[0], e[0] + 2, e[2], e[2] + 2, e[0] + 2, e[1] - 2, e[3]).box(e[1] - 2, e[1], e[2], e[2] + 2, e[0] + 2, e[1] - 2, e[3]);
    });
    T.box(2, 14, 12, 14, -10, 2, 'r');
    top = b.flat(roof, R, 36, 2);
    b.finish(roof, segs, 36, [[-10, -2, -10, -2, top]], [-9, top, -6, true]);
    return { segs: segs, y0: 36, y1: 38, chimney: [8, -8, 14, true], flag: [-6, top, -6, Math.min(9, 46 - top)],
             boxes: [['+z', v ? -6 : -7, 18, 0, v ? 5 : 6], ['+x', -9, 18, 0, 6]] };
  }
  var OCT7 = [[6, 14], [10, 10], [14, 6]], OCT5 = [[6, 10], [10, 6]];
  function dome(b, s, crownOnly) {
    var A = b.A, F = b.F, roof = s.roof, v = s.variant, castle = roof === 'roof_castle', pat = WALL_STYLE[s.wall].pat, segs = octSegs(OCT7, -6);
    var sides = segs.filter(function (g) { return !(g.ax === 'z' && g.at === 14); });          /* not across the airlock */
    function disc(j, r, c) { A.o.lathe([[r, j, j, c]]); b.hi = Math.max(b.hi, 4 * j + 4); }
    if (!crownOnly) {
      [0, 1, 2].forEach(function (n) { disc(n, 3.3, function (i, j, k) { return pat(i, j, k, false, n === 2, n === 0); }); });   /* the drum */
      [[2, 2], [-2, 2], [2, -2], [-2, -2]].concat(v ? [[3, 1], [3, -1], [-3, 1], [-3, -1]] : [[3, 0], [-3, 0]]).forEach(function (p) { A.o.set(p[0], 1, p[1], 'g'); });   /* block portholes */
      A.box(-6, 6, 0, 12, 10, 14, null).box(-6, 6, 0, 12, 6, 10, 'i');
      b.door(0, 0, 14, { jamb: true, slide: true, frame: 'V' });                  /* the airlock */
    }
    /* the crown is the dome itself: three stepped rings on the drum */
    disc(3, 3.3, roofTone(roof, 0)); disc(4, 2.5, roofTone(roof, 1)); disc(5, 1.5, roof === 'roof_blue' ? 'q' : roofTone(roof, 2));
    if (castle) { b.crenels(16, 2, -14, 14, -14, 14); b.turret(-14, -6, 4, 16, 30); b.turret(10, -6, 4, 16, 30); }
    b.finish(roof, sides, 12, [[-14, 14, -14, 14, 16], [-10, 10, -10, 10, 20], [-6, 6, -6, 6, 24]], [2, 24, 2]);
    if (!crownOnly) {
      b.run(segs, function (g, u) { for (var y = 12; y < 14; y++) { var c = cellOf(g, u, y); F.set(c[0], c[1], c[2], 'B'); } });   /* the glowing band on the equator */
      b.lamps.push({ kind: 'ring', i: 0, tok: 'Holo Blue', box: [-15, 12, -15, 15, 14, 15] });
      A.o.set(0, 6, 0, 'g'); b.hi = Math.max(b.hi, 28);                           /* the glass pod */
      F.box(0, 1, 28, 35, 0, 1, 'A'); F.set(0, 35, 0, 'T');                       /* the antenna and its tip */
      b.lamps.push({ kind: 'tip', i: 0, tok: 'Sunset Amber', box: [0, 35, 0, 1, 36, 1] });
      b.pivot('ring', 0, 13, 0); b.pivot('tip', 0, 36, 0);
    }
    return { segs: segs, y0: 15, y1: 16, neonSegs: octSegs(OCT5, -6), neonY: 16, chimney: [10, 2, 16], flag: [0, 30, 0, 5, false],
             boxes: [['+z', 6, 3, 10, 4], ['+z', -10, 3, 10, 4]] };
  }
  var SHAPE_FN = { shape_cottage: cottage, shape_loft: loft, shape_villa: villa, shape_tower: tower, shape_dome: dome };

  /* ================================================================
     THE MODEL
     ================================================================ */
  /* house(state, {only: 'crown', lod: 1}) → VoxModel. o.only 'crown' keeps just the roof (the 25
     shape × roof crowns are compared by hash); o.lod builds the house's own LOD1: the same shell
     and G8 trims with the fine layer dropped (plain panes, no wires, bulbs, neon, drips, sprinkles,
     straw bumps, smoke, flag or decals), so far islands keep the exact silhouette at about a third of the cost */
  function house(st, o) {
    ensureTokens();
    var s = fixState(st || {}), only = !!(o && o.only === 'crown'), lod = !!(o && o.lod), b = new Build(s, lod), site = SHAPE_FN[s.shape](b, s, only), roofTop = b.hi, top = roofTop;
    function has(d) { return !only && s.details.indexOf(d) >= 0; }
    if (!only) {
      var ch = site.chimney, fl = site.flag, lit = site.segs.filter(function (g) { return g.lit; }), mid = lit[lit.length >> 1], mc = cellOf(mid, (mid.a0 + mid.a1) >> 1, site.y0);
      b.anchor('spot', SPOT[0] * 16, 0, SPOT[2] * 16);
      /* the four house pivots always exist, so a handler never writes an unknown one */
      b.pivot('emitter', ch[0] + 2, ch[2] + 6, ch[1] + 2); b.pivot('flag', fl[0], fl[1] + fl[3], fl[2]); b.pivot('glow', mc[0], mc[1], mc[2]);
      if (has('detail_windowbox')) site.boxes.forEach(function (e) { b.wbox(e[0], e[1], e[2], e[3], e[4]); });
      if (has('detail_chimney')) top = Math.max(top, b.chimney(ch[0], ch[1], ch[2], ch[3]));
      if (has('detail_flag')) top = Math.max(top, b.flag(fl[0], fl[1], fl[2], fl[3], fl[4]));
      if (has('detail_lights')) b.lights(site.segs, site.y0);
      if (has('detail_neon')) b.neon(site.neonSegs || site.segs, site.neonY != null ? site.neonY : site.y1 - 1);
      b.anchor('top', 0, top + 2.4, 0);
    }
    function vol(l) { var x = l.box; return (x[3] - x[0]) * (x[4] - x[1]) * (x[5] - x[2]); }
    b.lamps = b.lamps.map(function (l, n) { return [l, n]; }).sort(function (p, q) { return vol(p[0]) - vol(q[0]) || p[1] - q[1]; }).map(function (p) { return p[0]; });   /* the smallest box wins a quad */
    var model = {
      id: HOME, grid: G4, origin: [0, 0, 0], palette: paletteFor(s), cull: ['-y', '-z'],
      layers: [b.A, b.B, b.T, b.F].map(function (l) { return { vox: l.o.snapshot() }; }),
      pivots: b.pivots, anchors: b.anchors, decals: b.decals, hit: [2, Math.max(0.8, roofTop / 16), 2],
      home: { state: s, crown: only, lod: lod, top: roofTop / 16, slide: b.slide, glints: b.glints, lamps: b.lamps, anim: b.anim }
    };
    if (b.issues.length) model.issues = b.issues;
    return model;
  }
  function crown(shape, roof) { return house({ shape: shape, roof: roof }, { only: 'crown' }); }
  function voxelsFor(id, st, o) { return house(homeState(STYLE_IDS.indexOf(id) >= 0 ? id : HOME, st), o); }

  /* ---------------- the perCopy layout (pure) ----------------
     which lamp / mover owns each meshed quad of a part: the first entry whose box (sixteenths)
     holds the quad's centre. parts: [{name, arrays: {position, vuv}}] (SLVox.mesh parts, or a
     template's). → {state, slide, glints, bulb: {lamps, verts[], ang, sign, always, show} | null,
     anim: {items, verts[], rest} | null} */
  function assign(pos, list) {
    var verts = list.map(function () { return []; }), E = 1e-3;
    for (var q = 0; q + 5 < pos.length / 3; q += 6) {
      var cx = 0, cy = 0, cz = 0, v, e;
      for (v = q; v < q + 6; v++) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
      cx *= 16 / 6; cy *= 16 / 6; cz *= 16 / 6;
      for (e = 0; e < list.length; e++) {
        var b = list[e].box;
        if (cx >= b[0] - E && cx <= b[3] + E && cy >= b[1] - E && cy <= b[4] + E && cz >= b[2] - E && cz <= b[5] + E) { for (v = q; v < q + 6; v++) verts[e].push(v); break; }
      }
    }
    return verts;
  }
  function layout(model, parts) {
    var H = (model && model.home) || {}, out = { state: H.state || null, slide: !!H.slide, glints: H.glints || null, bulb: null, anim: null };
    (parts || []).forEach(function (p) {
      var pos = p.arrays && p.arrays.position, vuv = p.arrays && p.arrays.vuv, v;
      if (!pos) return;
      if (p.name === PARTS.bulb) {
        var lamps = H.lamps || [], B = out.bulb = { lamps: lamps, verts: assign(pos, lamps), ang: new Float32Array(pos.length / 3), sign: null, always: false, show: false };
        for (v = 0; v < B.ang.length; v++) B.ang[v] = Math.atan2(pos[v * 3 + 2], pos[v * 3]);
        lamps.forEach(function (l) { if (l.kind === 'fairy' || l.kind === 'tip' || l.kind === 'pool') B.always = true; else B.show = true; });
        /* the sign's initial decal: its 6 vertices and which corner of the cell each one is */
        var dv = [], u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (v = 0; vuv && v < vuv.length / 3; v++) if (Math.round(vuv[v * 3 + 2]) === 2) { dv.push(v); u0 = Math.min(u0, vuv[v * 3]); u1 = Math.max(u1, vuv[v * 3]); v0 = Math.min(v0, vuv[v * 3 + 1]); v1 = Math.max(v1, vuv[v * 3 + 1]); }
        if (dv.length) B.sign = { verts: dv, cu: dv.map(function (i) { return vuv[i * 3] > (u0 + u1) / 2 ? 1 : 0; }), cv: dv.map(function (i) { return vuv[i * 3 + 1] > (v0 + v1) / 2 ? 1 : 0; }) };
      } else if (p.name === PARTS.anim) {
        var items = (H.anim || []).map(function (e) {
          var b = e.box, it = { kind: e.kind, i: e.i, c: [(b[0] + b[3]) / 32, (b[1] + b[4]) / 32, (b[2] + b[5]) / 32] };
          if (e.kind === 'puff') it.y0 = e.y0 / 16; else { it.x0 = e.x0 / 16; it.w = e.w / 16; }
          return it;
        });
        out.anim = { items: items, verts: assign(pos, H.anim || []), rest: new Float32Array(pos) };
      }
    });
    return out;
  }

  /* ================================================================
     TIMELINES (pure functions of time; reduced motion = the still end state)
     ================================================================ */
  /* door openness for one act: 'home' opens 70° (0.3 s, outBack), holds HOLD.home and swings back;
     'homeClose' closes from `from`; 'homeSwing' opens, holds briefly, closes
     → out {deg, done, phase: 'open' | 'hold' | 'close' | 'rest'} */
  var _mo = {}, _mf = { deg: 0 }, _mopt = { reduced: false, from: _mf };
  function sampleDoor(act, t, from, reduced) {
    var M = Motion();
    if (M && typeof M.sample === 'function') { _mf.deg = from; _mopt.reduced = !!reduced; return M.sample(act, t, _mo, _mopt).deg; }
    var u = reduced ? 1 : clamp01(t / 0.3), e = u * u * (3 - 2 * u);
    return act === 'homeClose' ? from * (1 - e) : from + (OPEN_DEG - from) * e;
  }
  function doorAt(name, t, from, reduced, out) {
    out = out || {};
    var dur = reduced ? 0 : 0.3;
    from = num(from, name === 'homeClose' ? OPEN_DEG : 0);
    t = Math.max(0, num(t));
    if (name === 'homeClose') {
      out.deg = sampleDoor('homeClose', t, from, reduced);
      out.done = t >= dur; out.phase = out.done ? 'rest' : 'close';
      return out;
    }
    var tc = dur + (name === 'homeSwing' ? HOLD.swing : HOLD.home);
    if (t < tc) { out.deg = sampleDoor('home', t, from, reduced); out.phase = t < dur ? 'open' : 'hold'; out.done = false; }
    else { out.deg = sampleDoor('homeClose', t - tc, OPEN_DEG, reduced); out.done = t - tc >= dur; out.phase = out.done ? 'rest' : 'close'; }
    return out;
  }
  /* the pose: a swing turns rot° about the hinge; the dome's door slides (no overshoot, no turn) */
  function doorPose(slide, name, t, from, reduced, out) {
    out = doorAt(name, t, from, reduced, out);
    if (slide) { out.rot = 0; out.slide = SLIDE * clamp01(out.deg / OPEN_DEG); } else { out.rot = out.deg; out.slide = 0; }
    return out;
  }
  function doorDur(name, reduced) {
    var o = reduced ? 0 : 0.3;
    return name === 'homeClose' ? o : Math.round((o + (name === 'homeSwing' ? HOLD.swing : HOLD.home) + o) * 1e6) / 1e6;
  }
  /* puff i of n: rises SMOKE.rise and grows over a 2.4 s loop, appearing from and melting to
     nothing (scale: voxels are opaque) → out {x, y, z, s} */
  function smokeAt(t, i, n, phase, reduced, out) {
    out = out || {};
    var p = reduced ? (i + 0.5) / n : frac(num(t) / SMOKE.period + num(phase) + i / n);
    out.y = SMOKE.rise * p; out.x = SMOKE.drift[0] * p; out.z = SMOKE.drift[1] * p;
    out.s = (1 + SMOKE.grow * p) * (reduced ? 1 : Math.min(1, Math.sin(Math.PI * p) * 1.8));
    return out;
  }
  /* pennant flutter (u = 0 at the pole … 1 at the tip) */
  function clothAt(t, u, phase, reduced) {
    return reduced ? 0 : FLAG.amp * u * Math.sin(2 * Math.PI * (rate('flag', 'flagFlutter') * num(t) + num(phase)) - u * 2.4);
  }
  function chase(t, i, hz, groups) {
    var g = Math.max(1, groups | 0), local = ((t * hz - i) % g + g) % g;
    return 0.25 + 0.75 * (local < 1 ? Math.sin(Math.PI * local) : 0);
  }
  /* fairy bulb i: a soft 0.5 Hz twinkle by day → a chase at night (each bulb lit once per 3 steps
     of a 1.5 Hz clock); steady under reduced motion */
  function bulbLevel(t, i, k, phase, reduced) {
    var day, show;
    if (reduced) { day = 0.85; show = 0.9; }
    else {
      day = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (RATES.bulbDay * num(t) + num(phase) + i * 0.37)));
      show = 0.4 + 0.6 * (chase(num(t), i, rate('bulbChase', 'bulbChase'), RATES.bulbGroups) - 0.25) / 0.75;
    }
    return day + (show - day) * clamp01(num(k));
  }
  /* neon segment i: steady (1) by day; at night a 1 Hz chase between 0.45 and 1 */
  function neonLevel(t, i, k, phase, reduced) {
    k = clamp01(num(k));
    if (reduced || k <= 0) return 1;
    var c = chase(num(t) + num(phase) * RATES.neonGroups / RATES.neon, i, RATES.neon, RATES.neonGroups);
    return 1 + (0.45 + 0.55 * (c - 0.25) / 0.75 - 1) * k;
  }
  /* the tower sign: 0.9 by day; at night it breathes 70–100% at 0.5 Hz (a sine, never on / off) */
  function signLevel(t, k, phase, reduced) {
    var show = reduced ? 1 : RATES.signMin + (1 - RATES.signMin) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (RATES.sign * num(t) + num(phase))));
    return 0.9 + (show - 0.9) * clamp01(num(k));
  }
  /* the dome's antenna tip breathes 60–100% at 0.5 Hz (steady 0.8 under reduced motion) */
  function tipLevel(t, phase, reduced) {
    return reduced ? 0.8 : RATES.tipMin + (1 - RATES.tipMin) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (RATES.tip * num(t) + num(phase))));
  }
  /* the dome band: the NEON3 colour at angle ang → out {i, j, f} (blend i → j by f), once round
     every 1 / RATES.ring s (a moving hue, never a flash); fixed under reduced motion */
  function ringHue(t, ang, phase, reduced, out) {
    out = out || {};
    var u = frac(num(ang) / (2 * Math.PI) - (reduced ? 0 : RATES.ring * num(t)) + num(phase)) * 3, i = Math.floor(u) % 3, f = u - Math.floor(u);
    out.i = i; out.j = (i + 1) % 3; out.f = f * f * (3 - 2 * f);
    return out;
  }
  /* the villa pool: a highlight stepping out through its n rings every 2.4 s → ring i's level 0…1 */
  function rippleAt(t, i, n, phase, reduced) {
    var p = (reduced ? 0.5 : frac(num(t) / POOL.period + num(phase))) * (n + 1);
    return clamp01(1 - Math.abs(p - i - 0.5) / 0.75);
  }
  /* window glow for the Showtime mix k: off by day, 0.6 at sunset, full at night (PX presets) */
  function windowLevel(k) {
    var L = Look(), mid = L && L.PX_SUNSET && typeof L.PX_SUNSET.windowGlow === 'number' ? L.PX_SUNSET.windowGlow : 0.6;
    k = clamp01(num(k));
    return k <= 0.5 ? mid * k * 2 : mid + (1 - mid) * (k * 2 - 1);
  }
  /* which gold-door glint starts in (t − dt, t]: 2 glints 0.6 s apart every 4 s; −1 if none */
  function glintAt(t, dt, phase, reduced) {
    if (reduced || !(dt > 0) || dt > 1) return -1;
    var local = frac(t / GLINT.period + (phase || 0)) * GLINT.period;
    for (var i = 0; i < GLINT.n; i++) if (local >= i * GLINT.gap && local - dt < i * GLINT.gap) return i;
    return -1;
  }

  /* ================================================================
     FACTORY (browser): SL3D.defineVox('home', factory) → {id: handlers}
     ================================================================ */
  function factory(K0) {
    if (!K0) return {};
    var DEG = Math.PI / 180, LAY = new WeakMap(), MEM = new Map(), OBJ = new WeakMap(), cols = {}, epoch = 0, ONE = [1, 1, 1], ZERO = [0, 0, 0];
    function colOf(token) { return cols[token] || (cols[token] = K0.col(token)); }
    /* the child's member colour: a.member ('#hex') or a.user.color; the look's fallback when none */
    function memberOf(a) {
      var h = hexOf(a.member || (a.user && a.user.color) || '');
      return h ? (cols[h] || (cols[h] = K0.rgb(h))) : colOf(memberToken());
    }
    /* per-copy memory, by uid (or, for handle(obj), by the Object3D, held weakly) */
    function memOf(a) {
      var key = a.uid != null ? a.uid : a.object, store = key !== null && typeof key === 'object' ? OBJ : MEM, m = store.get(key);
      if (!m) store.set(key, m = { tpl: null, deg: 0, wl: -1, lit: '', still: '', cell: '' });
      return m;
    }
    function tplOf(a) { return a.template || (a.batch && a.batch.template) || (a.object && a.object.userData && a.object.userData.template) || null; }
    function geoOf(a, part) {
      try {
        var g = typeof a.copyGeometry === 'function' ? a.copyGeometry(part) : null, m = !g && a.object && a.object.userData && a.object.userData.meshes;
        return g || (m && m[part] && m[part].geometry) || null;
      } catch (e) { return null; }
    }
    function call(a, fn, x, y, z, w) { try { if (typeof a[fn] === 'function') a[fn](x, y, z, w); } catch (e) { /* a handle without it */ } }
    function setPivot(a, name, rot, pos) {
      try { var p = typeof a.pivot === 'function' ? a.pivot(name) : null; if (p && typeof p.set === 'function') p.set(rot, pos, ONE); } catch (e) { /* no such pivot */ }
    }

    /* the template, whatever id asked for it: a style preview is a whole house, so it is built
       against the house's look (budget, kind) and footprint */
    function build(ctx) {
      var L = Look(), model = voxelsFor(ctx.id, ctx.st, { lod: ctx.lod }), hctx = {}, k;
      for (k in ctx) hctx[k] = ctx[k];
      hctx.look = (L && L.LOOK && L.LOOK[HOME]) || ctx.look; hctx.fp = [2, 2]; hctx.lod = 0;       /* the LOD1 model is already coarse */
      var tpl = ctx.K.vox.template(hctx, model).done();
      if (!ctx.lod) {
        LAY.set(tpl, layout(model, tpl.parts.map(function (p) {
          var v = p.geo.getAttribute('vuv');
          return { name: p.name, arrays: { position: p.geo.getAttribute('position').array, vuv: v ? v.array : null } };
        })));
      }
      return tpl;
    }

    /* every CPU-lit lamp of a copy: glow voxels, so the vertex colour is the lamp's own */
    var _h = {};
    function lamps(a, B, t, k, ph, reduced, mem) {
      var geo = geoOf(a, PARTS.bulb), col = geo && geo.getAttribute('color');
      if (!col) return false;
      var moving = !reduced && (B.always || (B.show && k > 0.001)), mb = memberOf(a);
      var sig = moving ? '' : Math.round(k * 1000) + '|' + mb.r.toFixed(3) + mb.g.toFixed(3) + mb.b.toFixed(3) + (reduced ? '|r|' : '|') + epoch;
      if (!moving && mem.lit === sig) return false;
      var arr = col.array, n, i, v, L, vs, c, c2, lv, f, r, g, b;
      for (n = 0; n < B.lamps.length; n++) {
        L = B.lamps[n]; vs = B.verts[n]; lv = 1; c = mb;
        if (L.kind === 'ring') {
          /* every vertex its own hue by its angle round the dome; the band's own blue by day */
          var off = colOf(L.tok), N3 = NEON3.map(colOf), kk = clamp01(k);
          for (i = 0; i < vs.length; i++) {
            v = vs[i] * 3; ringHue(t, B.ang[vs[i]], ph, reduced, _h);
            c = N3[_h.i]; c2 = N3[_h.j];
            arr[v] = off.r + (c.r + (c2.r - c.r) * _h.f - off.r) * kk; arr[v + 1] = off.g + (c.g + (c2.g - c.g) * _h.f - off.g) * kk; arr[v + 2] = off.b + (c.b + (c2.b - c.b) * _h.f - off.b) * kk;
          }
          continue;
        }
        if (L.kind === 'fairy') { c = colOf(L.tok); lv = bulbLevel(t, L.i, k, ph, reduced); }
        else if (L.kind === 'neon') lv = neonLevel(t, L.i, k, ph, reduced);
        else if (L.kind === 'sign') lv = signLevel(t, k, ph, reduced);
        else if (L.kind === 'tip') { c = colOf(L.tok); lv = tipLevel(t, ph, reduced); }
        r = c.r * lv; g = c.g * lv; b = c.b * lv;
        if (L.kind === 'pool') { c = colOf(L.tok); c2 = colOf(POOL.hi); f = 0.7 * rippleAt(t, L.i, L.n, ph, reduced); r = c.r + (c2.r - c.r) * f; g = c.g + (c2.g - c.g) * f; b = c.b + (c2.b - c.b) * f; }
        for (i = 0; i < vs.length; i++) { v = vs[i] * 3; arr[v] = r; arr[v + 1] = g; arr[v + 2] = b; }
      }
      col.needsUpdate = true;
      mem.lit = sig;
      return moving;
    }
    /* chimney puffs and the pennant, from the rest pose */
    var _sm = {};
    function movers(a, A, t, ph, reduced, mem) {
      var geo = geoOf(a, PARTS.anim), pos = geo && geo.getAttribute('position');
      if (!pos || (reduced && mem.still === 'r' + epoch)) return false;
      var arr = pos.array, rest = A.rest, n, i, v, e, vs;
      for (n = 0; n < A.items.length; n++) {
        e = A.items[n]; vs = A.verts[n];
        if (e.kind === 'puff') {
          smokeAt(t, e.i, SMOKE.n, ph, reduced, _sm);
          for (i = 0; i < vs.length; i++) {
            v = vs[i] * 3;
            arr[v] = e.c[0] + _sm.x + (rest[v] - e.c[0]) * _sm.s; arr[v + 1] = e.y0 + _sm.y + (rest[v + 1] - e.c[1]) * _sm.s; arr[v + 2] = e.c[2] + _sm.z + (rest[v + 2] - e.c[2]) * _sm.s;
          }
        } else for (i = 0; i < vs.length; i++) { v = vs[i] * 3; arr[v + 2] = rest[v + 2] + clothAt(t, clamp01((rest[v] - e.x0) / e.w), ph, reduced); }
      }
      pos.needsUpdate = true;
      mem.still = reduced ? 'r' + epoch : '';
      return !reduced;
    }
    /* the tower sign's cell: the child's initial on island copies only; a photocard (or any copy
       outside a batch) shows the ✦ pictogram, so no initial ever reaches the shared icon cache */
    function signCell(a, B, mem) {
      var want = !a.photocard && (a.personal != null ? a.personal : a.batch) ? 'initialCell' : 'sparkle';
      if (!B.sign || mem.cell === want) return;
      var geo = geoOf(a, PARTS.bulb), at = geo && geo.getAttribute('vuv'), uv = null;
      try { uv = K0.vox ? K0.vox.atlas().cell(want) : null; } catch (e) { uv = null; }
      if (!at || !uv) return;
      B.sign.verts.forEach(function (v, n) { at.array[v * 3] = B.sign.cu[n] ? uv[2] : uv[0]; at.array[v * 3 + 1] = B.sign.cv[n] ? uv[3] : uv[1]; });
      at.needsUpdate = true;
      mem.cell = want;
    }
    function tick(a, k, live) {
      var tpl = tplOf(a), lay = tpl && LAY.get(tpl);
      if (!lay) return false;
      var mem = memOf(a), t = num(a.t), ph = num(a.phase), reduced = !!a.reduced, wl = windowLevel(k), moved = false;
      if (mem.tpl !== tpl) { mem.tpl = tpl; mem.wl = -1; mem.lit = ''; mem.still = ''; mem.cell = ''; }       /* a restyle: light it again */
      if (Math.abs(mem.wl - wl) > 0.002) { call(a, 'state', 'windowGlow', wl); mem.wl = wl; }
      if (lay.bulb) { signCell(a, lay.bulb, mem); moved = lamps(a, lay.bulb, t, k, ph, reduced, mem); }
      if (lay.anim) moved = movers(a, lay.anim, t, ph, reduced, mem) || moved;
      return live && lay.glints && !reduced ? glint(a, lay) : moved;
    }
    /* the gold door: a sparkle at each glint voxel, twice every 4 s */
    function glint(a, lay) {
      var g = glintAt(num(a.t), num(a.dt), num(a.phase), false);
      if (g >= 0) call(a, 'emit', 'sparkle', lay.glints[g].slice(), 1, { token: GLINT.fx.token, size: GLINT.fx.size });
      return true;
    }
    function idle(a) { return a ? tick(a, clamp01(num(a.show)), true) : false; }
    function show(a, k) { if (a) tick(a, clamp01(num(k)), false); }
    /* the door act → {name, dur, update(a, tAct) → alive, cancel()} */
    function act(a, name) {
      if (!a) return null;
      if (name !== 'homeClose' && name !== 'homeSwing') name = 'home';
      var tpl = tplOf(a), lay = tpl && LAY.get(tpl), slide = !!(lay && lay.slide), mem = memOf(a), reduced = !!a.reduced, from = mem.deg || 0;
      if (name === 'homeClose' && !(from > 0.01)) { setPivot(a, 'door', ZERO, ZERO); return null; }
      var M = Motion(), cues = [], fired = 0, pose = {}, dead = false, rot = [0, 0, 0], off = [0, 0, 0];
      if (name !== 'homeClose' && M && typeof M.cues === 'function') { try { cues = M.cues('home', { reduced: reduced }); } catch (e) { cues = []; } }
      cues = cues.filter(function (c) { return !(c.sfx === 'pop' && c.t < 0.05); });     /* the controller's tap squish owns the opening pop */
      return {
        name: name, dur: doorDur(name, reduced),
        update: function (a2, tAct) {
          if (dead) return false;
          a2 = a2 || a;
          doorPose(slide, name, tAct, from, reduced, pose);
          rot[1] = -pose.rot; off[0] = -pose.slide;
          setPivot(a2, 'door', rot, off);
          mem.deg = pose.deg;
          while (fired < cues.length && cues[fired].t <= tAct) {
            var c = cues[fired++];
            if (c.sfx) call(a2, 'sfx', c.sfx, c.vol, c.step);
            if (c.emit) call(a2, 'emit', c.emit, 'door', c.n || 1);
          }
          if (pose.done) { if (Math.abs(pose.deg) < 0.01) mem.deg = 0; return false; }
          return true;
        },
        cancel: function () { dead = true; }
      };
    }
    /* a handle for an Object3D from SL3D.vox.make (photocards, turntables, the lab), settled at
       once: {photocard: true} shows the ✦ in place of the initial before any frame is drawn */
    function handle(obj, o) {
      o = o || {};
      var ud = (obj && obj.userData) || {}, piv = {};
      function setter(node) {
        var bx = node ? node.position.x : 0, by = node ? node.position.y : 0, bz = node ? node.position.z : 0;
        return { set: function (rot, pos) {
          if (!node) return this;
          node.rotation.set((rot && rot[0] || 0) * DEG, (rot && rot[1] || 0) * DEG, (rot && rot[2] || 0) * DEG);
          node.position.set(bx + (pos && pos[0] || 0), by + (pos && pos[1] || 0), bz + (pos && pos[2] || 0));
          return this;
        } };
      }
      var a = {
        uid: o.uid != null ? o.uid : obj, id: ud.id, t: num(o.t), dt: num(o.dt), phase: num(o.phase), reduced: !!o.reduced, show: num(o.show), bpm: num(o.bpm),
        stateKey: ud.stateKey, template: ud.template || null, batch: null, object: obj, member: o.member || null, user: o.user || null,
        photocard: !!o.photocard, personal: !!o.personal && !o.photocard,
        pivot: function (n) { return piv[n] || (piv[n] = setter(ud.pivots && ud.pivots[n])); },
        state: function (key, v) { if (typeof ud.setState === 'function') ud.setState(key, v); },
        copyGeometry: function (part) { var m = ud.meshes && ud.meshes[part]; return (m && m.geometry) || null; },
        emit: o.emit || null, sfx: o.sfx || null
      };
      show(a, a.show);
      return a;
    }
    function forget(uid) { MEM.delete(uid); }
    function setUser() { epoch++; }                 /* a new child: every still lamp is lit again in their colour */

    var out = {};
    homeIds().forEach(function (id) {
      out[id] = { voxels: function (st) { return voxelsFor(id, st); }, lod1: function (st) { return voxelsFor(id, st, { lod: 1 }); }, build: build, idle: idle, act: act, show: show, animated: animated, handle: handle, forget: forget, setUser: setUser };
    });
    return out;
  }

  var voxels = {};
  [HOME].concat(STYLE_IDS).forEach(function (id) { voxels[id] = function (st, o) { return voxelsFor(id, st, o); }; });

  return {
    VERSION: VERSION, HOME: HOME, COTTAGE: COTTAGE, DEFAULTS: DEFAULTS, WALLS: WALLS, ROOFS: ROOFS, DOORS: DOORS, DETAILS: DETAILS, SHAPES: SHAPES,
    STYLE_IDS: STYLE_IDS, PARTS: PARTS, MAX_PARTS: MAX_PARTS, TRIS_CAP: TRIS_CAP, MAX_H: MAX_H, SPOT: SPOT, HOLD: HOLD, OPEN_DEG: OPEN_DEG, SLIDE: SLIDE,
    SMOKE: SMOKE, FLAG: FLAG, GLINT: GLINT, POOL: POOL, RATES: RATES, FAIRY: FAIRY, WALL_STYLE: WALL_STYLE, ROOF_STYLE: ROOF_STYLE, DOOR_STYLE: DOOR_STYLE,
    voxels: voxels, factory: factory,
    /* pure helpers */
    house: house, crown: crown, layout: layout, homeState: homeState, parseKey: parseKey, stateKeyOf: stateKeyOf, animated: animated, partsFor: partsFor,
    homeIds: homeIds, hexOf: hexOf, shadeName: shadeName, shadeHex: shadeHex, paletteFor: paletteFor,
    doorAt: doorAt, doorPose: doorPose, doorDur: doorDur, smokeAt: smokeAt, clothAt: clothAt, bulbLevel: bulbLevel, neonLevel: neonLevel,
    signLevel: signLevel, tipLevel: tipLevel, ringHue: ringHue, rippleAt: rippleAt, windowLevel: windowLevel, glintAt: glintAt
  };
}));
