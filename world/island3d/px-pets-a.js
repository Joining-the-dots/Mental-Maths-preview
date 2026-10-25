/* ================================================================
   My Island v3, kids update — SLPxPetsA (P2.1): five of the fourteen new pets as voxel rigs in
   Pixel Blocks — the hamster, the guinea pig, the tortoise and the budgie (Home Pet Shop) and the
   river otter (Theme Park Pier).
   window.SLPxPetsA + SL3D.defineVox('pets-a', factory) in the browser, module.exports in Node:
   {IDS, ROWS, DESIGNS, voxels: {<id>: fn(st, ctx) → VoxModel}, register(PC) (= fill), factory, …}.

   THE OPEN TABLE (D95, D96; W3b.8's pattern). Each species is a row of SLPxCharacters.SPECIES,
   registered with defineSpecies(id, row) when this file loads (so the portrait is drawn on every
   atlas already bound) and again by the factory if the table lost it. makeRig, the display models,
   sockets and portraits read the row; nothing here builds a THREE object. The factory registers
   the five vox handlers (SLPxCharacters.handler) and defines each 'portrait:<pet>' cell on the
   bound atlas (D76). Rows (contracts.characters):
     voxels(acc, ctx) → {bone: VoxModel}   pure; the rest pose in the ROOT frame of px-characters
                                           (GC 0.05 u voxels, voxel (i, j, k) centred on x = i·GC,
                                           z = k·GC, standing on y = j·GC; the pet faces +z, its
                                           left is +x); ctx.covered = a face piece hides the eyes
     sockets {hat, neck, face, back, seat: {bone, v, at, w, d, flags}}   v in voxels, at in u
     joints {bone: [x, y, z] u} for every bone · eyes [[i, j, k]…] · h, topY, biped, bodyY,
     wingRest, tailUp · portrait {rows[12], pal}, hand-drawn from the rig (12 × 12, the frame
     filled as the V4.54 heads fill it)
   Bones are the v2 bones only (D95); a bone a species does not use stays empty, so every clip
   samples without branching. No built-in clothes, no teeth.

   THE FIVE (kids-update pets.json catalogue.new[].look; colours PETCOL3 only, D107, with the shared
   eye ink, glint, blush and dizzy stars; every face keeps a light part beside the body colour so the
   eyes read at island scale):
     pet_hamster    a golden ball 9 wide and 7 tall to the crown: a cream belly, chin and short muzzle
                    with a pink nose, puffed cheek pads a voxel out each side (a cream highlight,
                    MID / HIGH), small round ears on the crown's corners (pink inside, MID / HIGH),
                    four pink stub feet a voxel long and no tail. Golden all over with a cream front,
                    never round mouse ears on top.
     pet_guineapig  a long loaf 7 wide, 11 long and 6 tall in big blocky ginger, white and brown
                    patches (a white saddle, a brown rump), a blunt square face with a white blaze
                    down to a white muzzle and a pink nose, brown petal ears flopped at the sides,
                    tiny pink feet, no tail; whisker dots MID / HIGH only.
     pet_tortoise   a domed brown shell 11 × 11 and 5 tall over a sand plastron, a ring of sand plates
                    round its sides and one on top (voxels, so LOW keeps the two-colour ring), an
                    olive head with a sand jaw on a short neck poking forward, four thick olive legs
                    with dark toenail dots (MID / HIGH) and a stub tail. The back socket is the top
                    plate (flag shell: a back piece rides on top). A real land tortoise: no mask.
     pet_budgie     biped (feet on legBL / legBR, wings on wingL / wingR): a round green body, a
                    yellow face with a few dark throat dots (MID / HIGH), a blue cere above a small
                    sunny hooked beak, dark wavy bars on the folded wings and a long thin blue tail
                    on tail / tailTip; the duckling's foot geometry (GAIT_GEOM.waddle).
     pet_otter      long and low on its tummy like the seal (the galumph belly): a brown body, a
                    broad flat head with a cream face, chin and chest, small round ears low at the
                    sides, a broad dark nose with whisker dots (MID / HIGH), front paws on legFL /
                    legFR, webbed back feet on legBL / legBR and a thick tapering tail on tail /
                    tailTip. No pebble, no shell on the tummy.
   Budgets (D108): ≤ 750 tris bare on every tier, one SkinnedMesh with any outfit (≤ 1,400). The
   LOW tier drops the inlaid detail (lod 'mid'). Nothing here reads, awards or spends points; no
   random numbers: the same input gives the same model.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPetsA = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pets-a', api.factory);
  }
  api.register();
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPetsA: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC.defineSpecies === 'function' && PC.SPECIES ? PC : null; }

  var VERSION = 1, GC = 0.05;
  var IDS = ['pet_hamster', 'pet_guineapig', 'pet_tortoise', 'pet_budgie', 'pet_otter'];
  var SOCKET_BONE = { hat: 'head', face: 'head', neck: 'neck', back: 'body', seat: 'body' };
  var PROUD = 0.004;                 /* inlays sit a hair proud of the face they lie on (= px-characters) */

  /* ---------------- building blocks (pure; the conventions of px-characters) ---------------- */
  /* root-frame voxel coordinates (an integer is a voxel centre) → item metres */
  function u3(v) { return [v[0] * GC, (v[1] + 0.5) * GC, v[2] * GC]; }
  function grid() { return vox().grid({ grid: GC }); }
  /* the inlay layer: half-voxel pixels a quarter voxel deep on the +z faces — GC column i is fine
     columns 2i, 2i + 1; row j is 2j, 2j + 1; the front of voxel k is 4k + 2 */
  function fine() { return vox().grid({ grid: [GC / 2, GC / 2, GC / 4], origin: [1, 0, 0] }); }
  /* one GC pixel of inlay on the front of voxel (i, j, k) */
  function dot(o, i, j, k, ch) { var c = 4 * k + 2; return o.box(2 * i, 2 * i + 1, 2 * j, 2 * j + 1, c, c, ch); }
  /* a 1 × 2 eye on the front of voxels (i, j..j + 1, k), its glint in the upper corner */
  function eye(o, i, j, k, shine) {
    var a = 2 * i, b = 2 * j, c = 4 * k + 2;
    o.box(a, a + 1, b, b + 3, c, c, 'e');
    if (shine) o.set(a, b + 3, c, 'g');
  }
  /* a box with bevelled edges: bev {s side, b bottom, t top, k back, f front}; the edge between two
     faces is cut min(bev) voxels deep (1 = the edge, 2 = a two-step chamfer), or bev[pair] when it is
     given (tf: 0 keeps the top-front edge square). c: char | fn(i, j, k) */
  function shape(o, i0, i1, j0, j1, k0, k1, bev, c) {
    var B = { s: 0, b: 0, t: 0, k: 0, f: 0 }, n;
    for (n in bev || {}) B[n] = bev[n];
    function cut(a, da, b, db) { return da + db < (B[a + b] != null ? B[a + b] : Math.min(B[a], B[b])); }
    return o.box(i0, i1, j0, j1, k0, k1, function (i, j, k) {
      var ds = Math.min(i - i0, i1 - i), db = j - j0, dt = j1 - j, dk = k - k0, df = k1 - k;
      if (cut('s', ds, 'b', db) || cut('s', ds, 't', dt) || cut('s', ds, 'k', dk) || cut('s', ds, 'f', df) ||
          cut('b', db, 'k', dk) || cut('b', db, 'f', df) || cut('t', dt, 'k', dk) || cut('t', dt, 'f', df)) return null;
      return typeof c === 'function' ? c(i, j, k) : c;
    });
  }
  /* a box whose twelve edges are cut a voxel: the rounded balls and heads */
  function round(o, i0, i1, j0, j1, k0, k1, c) { return shape(o, i0, i1, j0, j1, k0, k1, { s: 1, b: 1, t: 1, k: 1, f: 1 }, c); }
  /* three ✦ on the dizzy ring round `at` (u), each a five-voxel plus: four points, never five */
  function stars(at) {
    var o = vox().grid({ grid: GC / 2 }), g = GC / 2;
    for (var n = 0; n < 3; n++) {
      var a = n * Math.PI * 2 / 3, x = Math.round(0.13 * Math.cos(a) / g), z = Math.round(0.13 * Math.sin(a) / g) + Math.round(at[2] / g);
      var y = Math.round((at[1] + 0.015 * Math.sin(2 * a + n)) / g);
      o.box(x - 1, x + 1, y, y, z, z, 's').box(x, x, y - 1, y + 1, z, z, 's');
    }
    return o;
  }
  function mid(token) { return { token: token, lod: 'mid' }; }    /* a detail the LOW tier drops */

  /* ================================================================
     THE FIVE DESIGNS
     Each: h (LOOK, u), topY, biped, bodyY (u), top (the crown row), eye {i, j, k} (the left eye's
     column, its lower row and the face voxel it sits on; the right one mirrors it), blush {i, j, k},
     joints (voxels; R twins mirror L), sockets {slot: [v, w, d, flags]}, extra palette, build(P):
     P.on(bone) a GC grid, P.fine(bone) its inlay layer, P.sides(fn(s, L)), P.acc the outfit. Palette
     b body · d dark · l light · n nose (PETCOL3.<id>.<part>) · e eye · g glint · k blush · s star +
     a species' own (mid() = MID / HIGH only).
     ================================================================ */
  var DESIGNS = {
    /* ---------------- the hamster: 9 wide, 7 tall to the crown (8 to the ears), 10 deep ---------------- */
    pet_hamster: {
      h: 0.35, topY: 0.45, biped: false, bodyY: 0.17, top: 6, extra: { c: mid('PETCOL3.pet_hamster.light'), q: mid('PETCOL3.pet_hamster.nose') },
      eye: { i: 2, j: 4, k: 4 }, blush: { i: 2, j: 3, k: 4 },
      joints: { body: [0, 3.5, -1.5], neck: [0, 2.5, 1], head: [0, 4, 1.5], earL: [2.5, 6.5, 1], tail: [0, 3, -4.5], tailTip: [0, 3, -5],
        legFL: [2.5, 0.5, 0], legBL: [2.5, 0.5, -3], wingL: [4, 4, -1.5] },
      sockets: { hat: [[0, 6.5, 2], 5, 3, { earsUp: true }], face: [[0, 4.5, 4.5], 5, 4, { earsUp: true }], neck: [[0, 2, 3], 9, 3, { noNeck: true }],
        back: [[0, 6.5, -1.5], 5, 2, {}], seat: [[0, 0.5, -2], 5, 4, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), f = P.fine('head');
        /* the ball: the body behind, its rump and shoulders rounded two steps, a cream belly up its
           lower sides; the head in front of it, the same height, so the back runs in one curve from
           the crown to the rump. Golden over the top, cream round the lower face and the cheeks */
        shape(b, -4, 4, 1, 6, -4, 1, { s: 2, b: 1, t: 2, k: 2, f: 1 }, function (i, j) { return j === 1 || (j === 2 && Math.abs(i) >= 3) ? 'l' : 'b'; });
        round(h, -3, 3, 2, 6, 0, 4, function (i, j, k) { return (j === 2 && k >= 1) || (j === 3 && k === 4 && Math.abs(i) <= 2) ? 'l' : 'b'; });
        h.box(-1, 1, 2, 3, 5, 5, 'l').set(0, 3, 5, 'n');                         /* the short cream muzzle, a pink nose on top */
        P.sides(function (s, L) {
          /* puffed cream cheek pads a voxel out from the face, golden on top with a cream highlight */
          h.box(3 * s, 4 * s, 2, 2, 1, 3, 'l').box(4 * s, 4 * s, 3, 3, 1, 3, 'l').set(4 * s, 4, 2, 'b');
          dot(f, 4 * s, 4, 2, 'c');
          /* small round ears on the crown's corners, pink inside */
          P.on('ear' + L).box(2 * s, 3 * s, 7, 7, 1, 1, 'b').set(3 * s, 6, 1, 'b');
          dot(P.fine('ear' + L), 2 * s, 7, 1, 'q');
          /* four stub feet, a voxel long */
          P.on('legF' + L).box(2 * s, 3 * s, 0, 0, 0, 0, 'n');
          P.on('legB' + L).box(2 * s, 3 * s, 0, 0, -3, -3, 'n');
        });
      } },

    /* ---------------- the guinea pig: 7 wide, 11 long, 6 tall ---------------- */
    pet_guineapig: {
      h: 0.35, topY: 0.45, biped: false, bodyY: 0.15, top: 5, extra: { w: mid('PETCOL3.pet_guineapig.dark') },
      eye: { i: 2, j: 3, k: 4 }, blush: { i: 2, j: 2, k: 4 },
      joints: { body: [0, 3, -2.5], neck: [0, 2.5, 1], head: [0, 3, 1.5], earL: [3.5, 5.5, 1.5], tail: [0, 3, -6.5], tailTip: [0, 3, -7],
        legFL: [2, 0.5, 2], legBL: [2, 0.5, -5], wingL: [3.5, 4, -2] },
      sockets: { hat: [[0, 5.5, 2], 5, 3, { earsSide: true }], face: [[0, 3.5, 4.5], 5, 4, { earsSide: true }], neck: [[0, 1, 2.5], 5, 4, { noNeck: true }],
        back: [[0, 5.5, -2.5], 5, 4, {}], seat: [[0, 0.5, -2], 5, 4, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* the loaf, in big blocks of colour (patches, not noise): ginger shoulders, a white saddle the
           brown patch bites into, a brown rump on its right, ginger on the left with a white spot */
        shape(b, -3, 3, 1, 5, -6, 0, { s: 1, b: 1, t: 1, k: 2 }, function (i, j, k) {
          if (k >= -1) return 'b';
          if (k >= -3) return k === -3 && i < -1 ? 'd' : 'l';
          if (i <= 0) return 'd';
          return j >= 4 && k <= -5 ? 'l' : 'b';
        });
        /* a blunt square face: the white blaze up its middle and over the brow, a white chin */
        shape(h, -3, 3, 1, 5, 1, 4, { s: 1, b: 1, t: 1, f: 1 }, function (i, j, k) {
          if (i === 0 && (k === 4 || (j === 5 && k >= 2))) return 'l';
          return j === 1 && k >= 3 ? 'l' : 'b';
        });
        h.box(-1, 1, 1, 2, 5, 5, 'l').set(0, 2, 5, 'n');                         /* the white muzzle, a pink nose */
        P.sides(function (s, L) {
          /* brown petal ears flopped at the sides */
          P.on('ear' + L).box(4 * s, 4 * s, 4, 4, 1, 2, 'd').set(4 * s, 5, 2, 'd');
          /* whisker dots on the muzzle (MID / HIGH) */
          var x = s > 0 ? 3 : -2;
          P.fine('head').box(x, x, 2, 2, 22, 22, 'w').box(x, x, 4, 4, 22, 22, 'w');
          /* tiny pink feet */
          P.on('legF' + L).set(2 * s, 0, 2, 'n');
          P.on('legB' + L).set(2 * s, 0, -5, 'n');
        });
      } },

    /* ---------------- the tortoise: 11 wide, 7 tall at the shell, 17 deep from the tail to the nose ---------------- */
    pet_tortoise: {
      h: 0.35, topY: 0.46, biped: false, bodyY: 0.2, top: 5, extra: { t: mid('PETCOL3.pet_tortoise.nose') },
      eye: { i: 1, j: 3, k: 11 }, blush: { i: 2, j: 2, k: 11 },
      joints: { body: [0, 4, 0], neck: [0, 2.5, 5.5], head: [0, 3.5, 8], earL: [1.5, 5.5, 9.5], tail: [0, 2, -5.5], tailTip: [0, 2, -6.5],
        legFL: [3.5, 1.5, 4.5], legBL: [3.5, 1.5, -4.5], wingL: [5.5, 4, 0] },
      sockets: { hat: [[0, 5.5, 9], 5, 3, {}], face: [[0, 3.5, 11.5], 3, 4, {}], neck: [[0, 2, 7.5], 3, 2, {}],
        back: [[0, 6.5, 0], 5, 3, { shell: true }], seat: [[0, 0.5, 0], 5, 5, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* the dome, an oval from above, stepped in row by row; half-widths by |k| from the middle */
        var HW = { 2: [5, 5, 5, 5, 4, 3], 3: [5, 5, 5, 5, 4, 3], 4: [4, 4, 4, 4, 3, 2], 5: [3, 3, 3, 2], 6: [2, 2, 1] };
        /* the ring of sand plates round its sides (rows 3–4, every other twelfth of the way round) and
           one on top, on the brown shell; the rim row brown */
        function plate(i, j, k) {
          if (j === 6) return Math.abs(i) <= 1 && Math.abs(k) <= 1 ? 'l' : 'd';
          if (j !== 3 && j !== 4) return 'd';
          var a = Math.atan2(i, k) / (2 * Math.PI) + 1 + 1 / 24;
          return Math.floor(a * 12) % 2 ? 'd' : 'l';
        }
        Object.keys(HW).forEach(function (key) {
          var w = HW[key], y = +key, n = w.length - 1;
          for (var k = -n; k <= n; k++) b.box(-w[Math.abs(k)], w[Math.abs(k)], y, y, k, k, function (i) { return plate(i, y, k); });
        });
        b.box(-4, 4, 1, 1, -4, 4, function (i, j, k) { return Math.abs(i) + Math.abs(k) > 7 ? null : 'l'; });   /* the sand plastron under it */
        /* the neck pokes forward under the shell's front, then the head: olive, a sand jaw */
        P.on('neck').box(-1, 1, 2, 3, 6, 7, 'b');
        shape(h, -2, 2, 2, 5, 8, 11, { s: 1, b: 1, t: 1, f: 1, tf: 0, st: 0 }, function (i, j) { return j === 2 ? 'l' : 'b'; });
        P.sides(function (s, L) {
          /* four thick legs under the rim, the front pair poking out ahead of it; toenail dots (MID / HIGH) */
          P.on('legF' + L).box(3 * s, 4 * s, 0, 1, 4, 5, 'b');
          P.on('legB' + L).box(3 * s, 4 * s, 0, 1, -5, -4, 'b');
          var tf = P.fine('legF' + L);
          [3, 4].forEach(function (i) { tf.set(2 * i * s + (s > 0 ? 0 : 1), 0, 22, 't'); });
        });
        P.on('tail').set(0, 2, -6, 'b');                                         /* a stub tail */
      } },

    /* ---------------- the budgie: 9 wide at the wings, 10 tall, 14 deep with the tail; two legs ---------------- */
    pet_budgie: {
      h: 0.45, topY: 0.56, biped: true, bodyY: 0.15, top: 9, extra: { D: mid('PETCOL3.pet_budgie.dark') },
      eye: { i: 2, j: 7, k: 4 }, blush: { i: 2, j: 6, k: 4 },
      joints: { body: [0, 3, -0.5], neck: [0, 5, 2], head: [0, 7, 2], earL: [2, 9, 2], tail: [0, 2, -3.5], tailTip: [0, 1.5, -5.5],
        legFL: [1.5, 1, 1], legBL: [1.5, 0.5, 0], wingL: [3.5, 5.5, -1.5] },
      sockets: { hat: [[0, 9.5, 2], 5, 3, {}], face: [[0, 7.5, 4.5], 5, 4, {}], neck: [[0, 5, 2], 5, 3, {}],
        back: [[0, 5.5, -1.5], 5, 2, { wings: true }], seat: [[0, 0.5, -1], 5, 4, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        round(b, -3, 3, 1, 5, -3, 2, 'b');                                      /* a round green body */
        /* a round head over the front: the sunny face, green over the crown and behind */
        round(h, -3, 3, 5, 9, 0, 4, function (i, j, k) { return k >= 3 && j < 9 ? 'l' : 'b'; });
        h.set(0, 7, 5, 'n').set(0, 6, 5, 'l').set(0, 5, 5, 'l');               /* the blue cere over a small hooked beak */
        [-2, 2].forEach(function (i) { P.fine('head').box(2 * i, 2 * i, 11, 11, 18, 18, 'D'); });   /* dark throat dots (MID / HIGH) */
        P.fine('head').set(-1, 10, 18, 'D').set(2, 10, 18, 'D');
        P.sides(function (s, L) {
          /* folded wings along the sides, dark wavy bars across them */
          P.on('wing' + L).box(4 * s, 4 * s, 2, 5, -4, 1, function (i, j, k) {
            if (j === 2 && k > -1) return null;
            return (k > -2 ? j === 5 || j === 3 : j === 4 || j === 2) ? 'd' : 'b';     /* two bars that step down a row: a wave */
          });
          /* short legs and three-long feet */
          P.on('legB' + L).box(s, 2 * s, 0, 0, -1, 1, 'n');
        });
        P.on('tail').box(0, 0, 2, 2, -4, -5, 'n');                                /* the long thin blue tail */
        P.on('tailTip').box(0, 0, 1, 1, -6, -8, 'n');
      } },

    /* ---------------- the otter: 9 wide with its paws, 8 tall at the head, 18 deep with the tail ---------------- */
    pet_otter: {
      h: 0.45, topY: 0.58, biped: false, bodyY: 0.12, top: 8, extra: { w: mid('PETCOL3.pet_otter.dark') },
      eye: { i: 2, j: 6, k: 6 }, blush: { i: 2, j: 5, k: 6 },
      joints: { body: [0, 2, -1], neck: [0, 3.5, 2.5], head: [0, 6, 3], earL: [3.5, 7.5, 3], tail: [0, 0.5, -5.5], tailTip: [0, 0.5, -8.5],
        legFL: [3.5, 1, 3.5], legBL: [2.5, 0.5, -5.5], wingL: [3.5, 3, -1] },
      sockets: { hat: [[0, 8.5, 4], 5, 3, { earsSide: true }], face: [[0, 6.5, 6.5], 5, 4, { earsSide: true }], neck: [[0, 4, 4], 5, 3, {}],
        back: [[0, 3.5, -2.5], 5, 4, {}], seat: [[0, -0.5, -2], 5, 4, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* long and low on its tummy, the cream chest at the front */
        shape(b, -3, 3, 0, 3, -6, 4, { s: 1, b: 1, t: 1, k: 2, f: 1 }, function (i, j, k) { return k >= 3 && Math.abs(i) <= 2 && j <= 2 ? 'l' : 'b'; });
        /* the broad flat head held up over the chest: brown, a cream face and chin */
        shape(h, -3, 3, 4, 8, 2, 6, { s: 1, b: 1, t: 1, k: 1, f: 1 }, function (i, j, k) { return (j === 4 && k >= 3) || (k === 6 && j <= 5) ? 'l' : 'b'; });
        h.box(-2, 2, 4, 5, 7, 7, function (i, j) { return j === 5 && Math.abs(i) === 2 ? null : 'l'; });   /* the broad cream muzzle … */
        h.set(0, 5, 7, 'n');                                                    /* … and its broad dark nose (inlays widen it) */
        P.fine('head').box(-1, 2, 11, 11, 30, 30, 'n');
        P.sides(function (s, L) {
          P.on('ear' + L).box(4 * s, 4 * s, 7, 7, 3, 3, 'd');                     /* small round ears low on the sides */
          var x = s > 0 ? 4 : -5;                                               /* whisker dots (MID / HIGH) */
          P.fine('head').set(x, 9, 30, 'w').set(x, 11, 30, 'w').set(s > 0 ? 5 : -6, 10, 30, 'w');
          P.on('legF' + L).box(3 * s, 4 * s, 0, 0, 3, 4, 'd');                    /* front paws, splayed */
          P.on('legB' + L).box(2 * s, 3 * s, 0, 0, -6, -5, 'd').set(3 * s, 0, -7, 'd');     /* webbed back feet */
        });
        /* the thick tail, tapering to a point */
        shape(P.on('tail'), -1, 1, 0, 1, -8, -6, { s: 1, t: 1 }, 'b');
        P.on('tailTip').box(0, 0, 0, 1, -9, -9, 'b').box(0, 0, 0, 0, -10, -11, 'b');
      } }
  };

  /* ================================================================
     ROWS: the species rows of the open table
     ================================================================ */
  function mirrorJoints(J) {
    ['ear', 'legF', 'legB', 'wing'].forEach(function (n) { if (J[n + 'L'] && !J[n + 'R']) J[n + 'R'] = [-J[n + 'L'][0], J[n + 'L'][1], J[n + 'L'][2]]; });
    return J;
  }
  function jointsOf(D) {
    var E = D.eye, S = D.sockets, J = { base: [0, -0.5, 0] }, k;
    for (k in D.joints) J[k] = D.joints[k].slice();
    mirrorJoints(J);
    var hj = J.head, eyeAt = [0, E.j + 0.5, E.k + 0.5];
    J.eyes = eyeAt.slice(); J.lens = eyeAt.slice(); J.scan = [0, E.j + 0.5, hj[2]];
    J.glint = [1, D.top + 1, S.hat[0][2] + 1]; J.spark = [0, D.top + 2.5, hj[2]];
    J.scarfTail = [1, S.neck[0][1] - 0.5, S.neck[0][2] + S.neck[2] / 2 + 1];
    J.blush = hj.slice(); J.nightH = hj.slice();
    var bk = S.back[0];
    J.cape0 = [0, bk[1], bk[2] + 1]; J.cape1 = [0, bk[1], bk[2]]; J.cape2 = [0, bk[1], bk[2] - 1];
    var out = {};
    for (k in J) out[k] = u3(J[k]);
    return out;
  }
  function socketsOf(D) {
    var out = {};
    Object.keys(D.sockets).forEach(function (s) {
      var e = D.sockets[s], f = {};
      Object.keys(e[3] || {}).forEach(function (k) { if (e[3][k]) f[k] = true; });
      out[s] = { bone: SOCKET_BONE[s], v: e[0].slice(), at: u3(e[0]), w: e[1], d: e[2], flags: f };
    });
    return out;
  }
  function voxelsOf(id, D, acc, ctx) {
    var p = 'PETCOL3.' + id + '.', pal = { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye',
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' } }, g = {}, f = {}, c, out = {};
    for (c in D.extra || {}) pal[c] = D.extra[c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
      sides: function (fn) { fn(1, 'L'); fn(-1, 'R'); }
    };
    D.build(P);
    var E = D.eye, B = D.blush;
    P.sides(function (s) {
      eye(P.fine('eyes'), E.i * s, E.j, E.k, !(ctx && ctx.covered));
      dot(P.fine('blush'), B.i * s, B.j, B.k, 'k');
    });
    g.spark = stars(u3([0, D.top + 2.5, D.joints.head[2]]));
    Object.keys(g).concat(Object.keys(f)).forEach(function (bone) {
      if (out[bone]) return;
      var m = (g[bone] || f[bone]).model({ id: id + ':' + bone, palette: pal, ground: false, ao: false });
      if (!g[bone]) m.layers[0].at = [0, 0, PROUD - GC / 4];
      else if (f[bone]) m.layers.push({ vox: f[bone].snapshot(), at: [0, 0, PROUD - GC / 4] });
      if (m.layers.some(function (ly) { return ly.vox && ly.vox.dims[0] > 0; })) out[bone] = m;
    });
    return out;
  }
  function rowOf(id) {
    var D = DESIGNS[id], E = D.eye;
    return { id: id, h: D.h, topY: D.topY, biped: !!D.biped, bodyY: D.bodyY, wingRest: D.wingRest || 0, tailUp: !!D.tailUp,
      joints: jointsOf(D), sockets: socketsOf(D), eyes: [[E.i, E.j, E.k], [E.i, E.j + 1, E.k], [-E.i, E.j, E.k], [-E.i, E.j + 1, E.k]],
      portrait: PORTRAITS[id], voxels: function (acc, ctx) { return voxelsOf(id, D, acc, ctx); } };
  }

  /* ---------------- portraits: 12 × 12 from the front, hand-drawn ----------------
     (D76; pets.json rigs.rules: hand rows where the head alone is ambiguous). Drawn from the voxel
     rigs like px-mascots-a's, filling the frame the way the V4.54 heads do: a head from the voxels
     would leave these small faces a speck in the photo booth's strip (the tortoise's small head
     under its shell read as a mushroom). Symmetric, two eyes two pixels tall, PETCOL3 parts only */
  function pp(id, extra) {
    var p = 'PETCOL3.' + id + '.', o = { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye' }, k;
    for (k in extra || {}) o[k] = extra[k];
    return o;
  }
  var PORTRAITS = {
    /* golden, small round ears pink inside, the cream cheeks and chin, a pink nose */
    pet_hamster: { pal: pp('pet_hamster'), rows: [
      '............', '............', '..bb....bb..', '.bnbbbbbbnb.', '.bbbbbbbbbb.', 'bbbebbbbebbb',
      'bbbebbbbebbb', 'lllbbnnbblll', 'llllllllllll', '.llllllllll.', '..llllllll..', '............'] },
    /* ginger, the white blaze down to a white muzzle, a pink nose, brown ears flopped at the sides */
    pet_guineapig: { pal: pp('pet_guineapig'), rows: [
      '............', '............', '...bbllbb...', '.dbbbllbbbd.', 'ddbbbllbbbdd', 'ddbebllbebdd',
      '.dbebllbebd.', '..bbllllbb..', '..bllnnllb..', '...llllll...', '............', '............'] },
    /* the brown dome and its sand plates behind an olive head, a sand jaw, the front feet */
    pet_tortoise: { pal: pp('pet_tortoise'), rows: [
      '............', '...dddddd...', '..dllddlld..', '.dddddddddd.', 'dlldbbbbdlld', 'dddbbbbbbddd',
      '..bbebbebb..', '..bbebbebb..', '..bbbbbbbb..', 'bb.llllll.bb', 'bb........bb', '............'] },
    /* a green crown and cheeks round the sunny face, the blue cere, two dark throat dots */
    pet_budgie: { pal: pp('pet_budgie'), rows: [
      '............', '....bbbb....', '..bbbbbbbb..', '.bbllllllbb.', '.blellllelb.', '.blelnnlelb.',
      '.bllllllllb.', '.blldlldllb.', '..bllllllb..', '...bbbbbb...', '............', '............'] },
    /* brown, small ears low at the sides, the cream face and chin, a broad dark nose */
    pet_otter: { pal: pp('pet_otter'), rows: [
      '............', '............', '...bbbbbb...', '.dbbbbbbbbd.', '.bbbbbbbbbb.', '.bbebbbbebb.',
      '.bbebbbbebb.', '.bllnnnnllb.', '..llllllll..', '...llllll...', '............', '............'] }
  };

  var ROWS = {};
  IDS.forEach(function (id) { ROWS[id] = rowOf(id); });

  /* ================================================================
     REGISTRATION
     ================================================================ */
  /* put the five rows in the open table (again, if the table lost one) → how many were added */
  function register(PC) {
    PC = PC || chars();
    if (!PC || !PC.SPECIES || typeof PC.defineSpecies !== 'function') return 0;
    var n = 0;
    IDS.forEach(function (id) { if (PC.SPECIES[id] !== ROWS[id] && PC.defineSpecies(id, ROWS[id])) n++; });
    return n;
  }
  function atlasOf(K) { try { return K && K.vox && typeof K.vox.atlas === 'function' ? K.vox.atlas() : null; } catch (e) { return null; } }
  /* SL3D.defineVox('pets-a'): the display handlers and the portrait cells on the bound atlas */
  function factory(K) {
    var PC = chars(), out = {}, A = atlasOf(K);
    if (!PC) return out;
    register(PC);
    IDS.forEach(function (id) {
      out[id] = typeof PC.handler === 'function' ? PC.handler(id) : { voxels: voxels[id] };
      if (A && !A.has('portrait:' + id) && typeof PC.definePortrait === 'function') PC.definePortrait(K, id);
    });
    return out;
  }
  /* Node: the display model of each pet (= the handler's: every bone at rest, sockets as pivots) */
  var voxels = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st, ctx) { var PC = chars(); register(PC); return PC ? PC.displayVoxels(id, st, ctx) : null; };
  });

  return { VERSION: VERSION, GC: GC, IDS: IDS, ROWS: ROWS, DESIGNS: DESIGNS, PORTRAITS: PORTRAITS, SOCKET_BONE: SOCKET_BONE,
    voxels: voxels, register: register, fill: register, factory: factory };
}));
