/* ================================================================
   My Island — SLPxCare (kids update P2.5; pets.json rigs.files['px-care.js'], lookNotes bowl /
   foodIcons / star): the care props in Pixel Blocks. No species, no catalogue art of its own
   beyond the six foods. window.SLPxCare + SL3D.defineVox('care', factory) +
   SL3D.defineVoxApi('makeBowl', …) in the browser, module.exports in Node. Pure data (voxels(st) →
   VoxModel: no THREE, no DOM, no random numbers: the same food gives the same voxels).
     food_*      the six foods' display models (LOOK kind 'food', TRIS_CAPS.food on every tier, the
                 LOOK h rule, only the LOOK row's colours): a paper bag (biscuits, the big sack: a
                 taller sack tied with rope), a slatted crate (veg, fruit), a round tin (fish) and a
                 glass jar (treats), each showing its food on top. Never placed, never worn, never a
                 photocard (photocard.pixelSpec returns null for kind 'food'; the shop and the pantry
                 draw world-art-pets.js's 2D icons).
     care_bowl   the feeding bowl: a 9 × 3 × 9 G16 octagon in PX Coral, a PX Glint rim and a paw print
                 inlay on its floor (MID / HIGH), with the meal's pile on pivot 'pile' (the floor's top
                 centre). st.food picks the pile: biscuits (tan squares), veg (orange and green), fish
                 (silver-blue fish shapes 3 voxels long), fruit (red, yellow and purple cubes), treat
                 (a pink and mint cookie) — the five piles, in the colours of each food's own LOOK row.
                 ≤ BOWL.tris LOW / MID-HIGH.
     care_star   the memory star (a farewell pet's star, skylife3d): a 4-point star of 5 × 5 × 1 glow
                 voxels in Star Gold (STAR: its rows, its glow and its slow drift for the sparks pool).
   makeBowl(food, tier) (SL3D.vox.makeBowl; actors.js holds it while a pet eats) → {root, mesh, tris,
     food, setLevel(n 0–4), setFood(food) → false (make a new one), dispose()}: ONE SkinnedMesh in the
     pixel-vox program (bones 'bowl' and 'pile'); setLevel scales the pile in 4 steps (PILE_SCALE).
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxCare = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('care', api.factory);
    if (root.SL3D && typeof root.SL3D.defineVoxApi === 'function') api.register(root.SL3D);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxCare: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }

  var VERSION = 1, G16 = 0.0625;
  var FOODS = ['food_biscuits', 'food_sack', 'food_veg', 'food_fish', 'food_fruit', 'food_treats'];
  var GROUP = { food_biscuits: 'biscuits', food_sack: 'biscuits', food_veg: 'veg', food_fish: 'fish', food_fruit: 'fruit', food_treats: 'treat' };
  var PILE_OF = { biscuits: 'food_biscuits', veg: 'food_veg', fish: 'food_fish', fruit: 'food_fruit', treat: 'food_treats' };
  /* the LOOK rows' colours (world-look.js, P1.3), used when no SLIslandLook is loaded */
  var COLORS = {
    food_biscuits: { main: 'PX Khaki', trim: 'PX Khaki Shade', label: 'PX Candy Pink', food: 'PX Waffle' },
    food_sack: { main: 'PX Khaki', trim: 'PX Jungle Rope', label: 'PX Sky Blue', food: 'PX Waffle' },
    food_veg: { main: 'PX Tree Plank', trim: 'PX Jungle Bark Light', food: 'PX Jungle Flower Orange', food2: 'PX Leaf', food3: 'PX Tree Oak Light' },
    food_fish: { main: 'PX Pier Stripe Blue', trim: 'PX Ice Snow Shade', label: 'PX Sunny', food: 'PX Ice Pebble 2', food2: 'PX Lens Pale' },
    food_fruit: { main: 'PX Tree Plank', trim: 'PX Jungle Bark Light', food: 'PX Jungle Parrot Red', food2: 'PX Banana', food3: 'PX Lilac' },
    food_treats: { main: 'PX Lens Pale', trim: 'PX Candy Pink', food: 'PX Candy Pink', food2: 'PX Mint' }
  };
  var BOWL = { r: 4, floor: 3, tris: { LOW: 120, MID: 220, HIGH: 220 }, coral: 'PX Coral', rim: 'PX Glint', paw: 'paw' };
  /* the pile's scale at each level (setLevel): empty, then the 4 steps up to full */
  var PILE_SCALE = [0, 0.45, 0.65, 0.83, 1];
  /* the memory star: a 4-point star (never 5-pointed), steady glow in Star Gold at 0.6, drifting ±10 % at 0.3 Hz */
  var STAR = { rows: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'], token: 'Star Gold', glow: 0.6, driftHz: 0.3, driftAmp: 0.1 };

  /* an octagon of half-width r (r 2: rows 3 5 5 5 3 · r 3: 3 5 7 7 7 5 3 · r 4: 5 7 9 9 9 7 5) */
  function oct(i, k, r) { var a = Math.abs(i), b = Math.abs(k); return a <= r && b <= r && a + b <= r + (r >> 1); }
  function blk(v) { return (v + 16) >> 1; }                    /* 2-voxel blocks: pieces read as squares, and merge */
  function colorsOf(id) {
    var L = look(), e = L && L.LOOK && L.LOOK[id], c = (e && e.colors) || COLORS[id] || COLORS.food_biscuits, out = {};
    Object.keys(c).forEach(function (k) { if (typeof c[k] === 'string') out[k] = c[k]; });
    return out;
  }
  function foodOf(st) {
    var f = typeof st === 'string' ? st : st && typeof st.food === 'string' ? st.food : 'food_biscuits';
    return GROUP[f] ? f : PILE_OF[f] || 'food_biscuits';
  }

  /* ================================================================
     THE MEAL (a pile in the bowl, and what peeks out of each food's pack)
     ================================================================ */
  /* a square of half-width r with its corners cut by cham (r 4 cham 1: the bowl's rounded outline) */
  function sq(i, k, r, cham) { var x = Math.abs(i), z = Math.abs(k); return x <= r && z <= r && x + z <= 2 * r - (cham || 0); }
  /* which colour a meal voxel of the crates takes (a, b, c = the food's food, food2 / trim, food3) */
  function mealChar(group, i, j, k) {
    switch (group) {
      case 'biscuits': return (blk(i) + blk(k) + j) & 1 ? 'a' : 'b';                  /* tan squares, two tans */
      case 'veg': return (k & 1) ? 'b' : (i + j) % 3 === 0 ? 'c' : 'a';               /* carrot rows, leafy rows, bamboo bits */
      case 'fruit': return 'abc'.charAt((blk(i) * 2 + blk(k) + j) % 3);               /* red, yellow and purple cubes */
      default: return 'a';
    }
  }
  function mealPal(id, group) {
    var c = colorsOf(id);
    if (group === 'biscuits') return { a: c.food, b: c.trim || c.main };
    if (group === 'treat') return { a: c.food, b: c.food2 || c.food };
    return { a: c.food, b: c.food2 || c.food, c: c.food3 || c.food2 || c.food };
  }
  /* the pieces on top of the mound (MID / HIGH): [char, i, j, k, length along x, along z] */
  var PIECES = {
    biscuits: [['b', -2, 3, -1], ['b', 2, 3, 1], ['b', 1, 3, -2], ['b', -1, 3, 2], ['b', 0, 4, 0]],
    veg: [['b', -2, 3, 0], ['b', 2, 3, -1], ['b', 0, 3, 2], ['c', 1, 3, -2], ['b', 0, 4, 0]],
    fish: [['b', -1, 3, 2, 3, 0], ['b', -2, 3, -1, 0, 3], ['b', -1, 4, 0, 3, 0]],
    fruit: [['b', -2, 3, -1], ['c', 2, 3, 0], ['b', 1, 3, 2], ['c', -1, 3, -2], ['b', 0, 4, 0]],
    treat: [['b', -1, 4, -1], ['b', 1, 4, 0], ['b', 0, 4, 1]]
  };
  /* the meal in the bowl (from j = 1, the floor's top): a stepped mound in the food's own colour (a
     pink, mint and pink sandwich cookie for a treat), and on MID / HIGH its pieces on top; chars a b c
     are written as abc */
  function buildPile(o, group, abc, rich) {
    var put = function (x, y, z, ch) { o.set(x, y, z, abc.charAt('abc'.indexOf(ch))); }, l, i, k;
    for (l = 0; l < 3; l++) {
      var r = group === 'treat' ? 2 : 3 - l;
      for (k = -r; k <= r; k++) for (i = -r; i <= r; i++) if (sq(i, k, r, group === 'treat' && rich ? 1 : 0)) put(i, 1 + l, k, group === 'treat' && l === 1 ? 'b' : 'a');
    }
    if (rich) (PIECES[group] || []).forEach(function (q) {
      for (var n = 0; n < Math.max(1, q[4] || 0, q[5] || 0); n++) put(q[1] + (q[4] ? n : 0), q[2], q[3] + (q[5] ? n : 0), q[0]);
    });
  }

  /* ================================================================
     THE BOWL (no AO: a small prop keeps to its budget; its rim and floor read by colour)
     ================================================================ */
  function bowlGrid(V, o) {
    for (var k = -BOWL.r; k <= BOWL.r; k++) for (var i = -BOWL.r; i <= BOWL.r; i++) {
      if (!sq(i, k, BOWL.r, 1)) continue;
      o.set(i, 0, k, 'c');                                                     /* the base and the floor */
      if (!sq(i, k, BOWL.floor, 0)) { o.set(i, 1, k, 'c'); o.set(i, 2, k, 'g'); }   /* the wall and its rim */
    }
  }
  /* the paw print inlaid in the floor (MID / HIGH): the atlas's paw pictogram over the middle 3 × 3 */
  function paw(o) { o.decal({ face: '+y', at: [-1, 0, -1], size: [3, 3], cell: BOWL.paw }); }
  var BOWL_PAL = { c: BOWL.coral, g: BOWL.rim };
  function pilePal(food) { var g = GROUP[food] || 'biscuits', m = mealPal(PILE_OF[g], g), out = {}; Object.keys(m).forEach(function (k) { out[k] = m[k]; }); return out; }
  /* the bowl and the meal as the rig's two models (item metres; the pile from the floor's top) for a tier */
  function bowlParts(st, tier) {
    var V = vox(), food = foodOf(st), group = GROUP[food];
    var b = V.grid({ grid: G16 }), rich = String(tier || 'MID').toUpperCase() !== 'LOW';
    bowlGrid(V, b);
    if (rich) paw(b);
    var bowl = b.model({ id: 'care_bowl', palette: BOWL_PAL, cull: [], ao: false });
    var p = V.grid({ grid: G16 });
    buildPile(p, group, 'abc', rich);
    return { bowl: bowl, pile: p.model({ id: 'care_bowl:' + group, palette: pilePal(food), cull: [], ao: false }), food: food, group: group, pivot: [0, G16, 0] };
  }
  /* 'care_bowl' as one VoxModel (the display / coverage view): the pile rides pivot 'pile' */
  function bowlVoxels(st) {
    var V = vox(), food = foodOf(st), o = V.grid({ grid: G16 }), pal = {}, pp = pilePal(food), k;
    bowlGrid(V, o);
    paw(o);
    o.pivot('pile', [0, 0.5, 0]);
    o.group('pile', function () { buildPile(o, GROUP[food], 'ABC', true); });
    for (k in pp) pal[k.toUpperCase()] = pp[k];
    for (k in BOWL_PAL) pal[k] = BOWL_PAL[k];
    return o.model({ id: 'care_bowl', palette: pal, cull: [], ao: false });
  }

  /* ================================================================
     THE SIX FOODS (display models: h = their LOOK h, colours = their LOOK colours)
     ================================================================ */
  /* a box of main voxels i0..i1 × j0..j1 × k0..k1 */
  function fill(o, i0, i1, j0, j1, k0, k1, c) { o.box(i0, i1, j0, j1, k0, k1, c); }
  function bagVoxels(id, big) {
    var V = vox(), o = V.grid({ grid: G16 }), c = colorsOf(id), W = big ? 3 : 2, D = big ? 2 : 1, H = big ? 7 : 6, i, k;
    fill(o, -W, W, 0, H - 1, -D, D, 'm');
    if (big) {                                                     /* the sack narrows to a neck tied with rope */
      for (k = -D; k <= D; k++) for (i = -W; i <= W; i++) if (Math.abs(i) === W || Math.abs(k) === D) o.set(i, H - 1, k, '.');
      for (k = -1; k <= 1; k++) for (i = -2; i <= 2; i++) o.set(i, H, k, Math.abs(i) === 2 || Math.abs(k) === 1 ? 't' : 'f');
      fill(o, -1, 1, H + 1, H + 1, -1, 1, 'f'); o.set(0, H + 2, 0, 'f'); o.set(-1, H + 2, 0, 'f');
    } else {                                                       /* the paper bag's rolled top and the biscuits in it */
      for (k = -D; k <= D; k++) for (i = -W; i <= W; i++) o.set(i, H, k, Math.abs(i) === W || Math.abs(k) === D ? 't' : 'f');
      fill(o, -1, 1, H + 1, H + 1, 0, 0, 'f'); o.set(0, H + 1, -1, 'f');
    }
    /* the label on the front, a piece of the food in the middle of it */
    var lw = big ? 2 : 1, ly0 = big ? 2 : 1, ly1 = big ? 4 : 3;
    for (var j = ly0; j <= ly1; j++) for (i = -lw; i <= lw; i++) o.set(i, j, D, i === 0 && j === (ly0 + ly1) / 2 ? 'f' : 'l');
    return o.model({ id: id, palette: { m: c.main, t: c.trim, l: c.label, f: c.food } });
  }
  function fgh(ch) { return 'fgh'.charAt('abc'.indexOf(ch)); }
  function crateVoxels(id) {
    var V = vox(), o = V.grid({ grid: G16 }), c = colorsOf(id), group = GROUP[id], i, k, j;
    fill(o, -3, 3, 0, 3, -2, 2, 'm');
    for (k = -2; k <= 2; k++) for (i = -3; i <= 3; i++) {
      var edge = Math.abs(i) === 3 || Math.abs(k) === 2, post = Math.abs(i) === 3 && Math.abs(k) === 2;
      if (edge && !post) o.set(i, 1, k, 't');                      /* the gap between the slats */
      if (post) for (j = 0; j <= 3; j++) o.set(i, j, k, 't');     /* the corner posts */
      if (!edge) o.set(i, 3, k, fgh(mealChar(group, i, 3, k)));
    }
    for (k = -1; k <= 1; k++) for (i = -2; i <= 2; i++) if (oct(i, k, 2)) o.set(i, 4, k, fgh(mealChar(group, i, 4, k)));
    [[-1, 0], [1, 0], [0, -1]].forEach(function (p) { o.set(p[0], 5, p[1], group === 'veg' ? 'g' : 'fgh'.charAt((p[0] + 3) % 3)); });
    return o.model({ id: id, palette: { m: c.main, t: c.trim, f: c.food, g: c.food2, h: c.food3 } });
  }
  function tinVoxels(id) {
    var V = vox(), o = V.grid({ grid: G16 }), c = colorsOf(id), i, k;
    for (k = -2; k <= 2; k++) for (i = -2; i <= 2; i++) {
      if (!oct(i, k, 2)) continue;
      var ring = !oct(i, k, 1);
      o.set(i, 0, k, 't'); o.set(i, 1, k, 'm'); o.set(i, 2, k, ring ? 'l' : 'm');
      o.set(i, 3, k, ring ? 't' : 'f');                            /* the silver rim round the open top */
    }
    [[-1, 4, -1, 1, 0], [-1, 4, 1, 1, 0]].forEach(function (f, n) { for (var s = 0; s < 3; s++) o.set(f[0] + s * f[3], f[1], f[2] + s * f[4], n ? 'g' : 'f'); });
    return o.model({ id: id, palette: { m: c.main, t: c.trim, l: c.label, f: c.food, g: c.food2 } });
  }
  function jarVoxels(id) {
    var V = vox(), o = V.grid({ grid: G16 }), c = colorsOf(id), i, k, j;
    for (k = -2; k <= 2; k++) for (i = -2; i <= 2; i++) {
      if (!oct(i, k, 2)) continue;
      for (j = 0; j <= 3; j++) o.set(i, j, k, !oct(i, k, 1) && j >= 1 && j <= 2 && ((i + k + j) & 1) ? (j === 1 ? 'f' : 'g') : 'm');   /* treats behind the glass */
      o.set(i, 4, k, 't');                                         /* the lid */
    }
    for (k = -1; k <= 1; k++) for (i = -1; i <= 1; i++) if (oct(i, k, 1)) o.set(i, 5, k, 'f');   /* a cookie on the lid */
    o.set(0, 6, 0, 'g');
    return o.model({ id: id, palette: { m: c.main, t: c.trim, f: c.food, g: c.food2 } });
  }
  var FOOD_VOXELS = {
    food_biscuits: function () { return bagVoxels('food_biscuits', false); },
    food_sack: function () { return bagVoxels('food_sack', true); },
    food_veg: function () { return crateVoxels('food_veg'); },
    food_fish: function () { return tinVoxels('food_fish'); },
    food_fruit: function () { return crateVoxels('food_fruit'); },
    food_treats: function () { return jarVoxels('food_treats'); }
  };

  /* ================================================================
     THE MEMORY STAR
     ================================================================ */
  function starCells() {
    var out = [];
    STAR.rows.forEach(function (row, r) { for (var c = 0; c < row.length; c++) if (row.charAt(c) === 'x') out.push([c - 2, 2 - r]); });
    return out;
  }
  function starVoxels() {
    var o = vox().grid({ grid: G16 });
    starCells().forEach(function (p) { o.set(p[0], p[1] + 2, 0, 's'); });
    return o.model({ id: 'care_star', palette: { s: { token: STAR.token, mode: 'glow' } }, cull: [] });
  }

  var voxels = { care_bowl: bowlVoxels, care_star: starVoxels };
  FOODS.forEach(function (id) { voxels[id] = FOOD_VOXELS[id]; });

  /* ================================================================
     makeBowl — one SkinnedMesh (bones 'bowl' and 'pile') through K.vox.rig
     ================================================================ */
  function makeBowl(SL3D, food, tier) {
    var K = SL3D.kit(tier), V = K && K.vox;
    if (!V || typeof V.rig !== 'function') return null;
    var parts = bowlParts(food, tier);
    var rig = V.rig({ name: 'care-bowl', bones: [{ name: 'bowl', origin: [0, 0, 0] }, { name: 'pile', parent: 'bowl', origin: parts.pivot }],
      voxelsPerBone: { bowl: parts.bowl, pile: parts.pile } });
    rig.mesh.castShadow = false;
    var level = -1;
    var out = {
      root: rig.root, mesh: rig.mesh, tris: rig.tris, food: parts.food, group: parts.group,
      setLevel: function (n) {
        n = Math.max(0, Math.min(4, Math.round(+n || 0)));
        if (n === level) return out;
        level = n;
        var s = PILE_SCALE[n] || 1e-3;
        rig.bones.pile.scale.set(s, s, s);
        return out;
      },
      /* a different food is another rig (the caller makes a new one); the same group keeps this one */
      setFood: function (f) { return GROUP[foodOf(f)] === parts.group; },
      dispose: function () { rig.dispose(); }
    };
    out.setLevel(4);
    return out;
  }

  /* ================================================================
     FACTORY — SL3D.defineVox('care', K → {id: {voxels}}) · SL3D.defineVoxApi('makeBowl')
     ================================================================ */
  function factory() {
    var out = {};
    Object.keys(voxels).forEach(function (id) { out[id] = { voxels: voxels[id] }; });
    return out;
  }
  function register(SL3D) {
    if (!SL3D || typeof SL3D.defineVoxApi !== 'function' || SL3D.__slPxCare) return false;
    SL3D.__slPxCare = true;
    SL3D.defineVoxApi('makeBowl', function (K, S) { return function (food, tier) { return makeBowl(S || SL3D, food, tier); }; });
    return true;
  }

  return {
    VERSION: VERSION, G16: G16, FOODS: FOODS, GROUP: GROUP, COLORS: COLORS, BOWL: BOWL, PILE_SCALE: PILE_SCALE, STAR: STAR,
    voxels: voxels, bowlParts: bowlParts, starCells: starCells, makeBowl: makeBowl, factory: factory, register: register, oct: oct
  };
}));
