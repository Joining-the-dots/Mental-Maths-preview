/* ================================================================
   My Island v3 — SLPxMascotsA (W3b.8): the voxel rigs of five land mascots in Pixel Blocks —
   the crab and the seagull (Theme Park Pier), the monkey and the capybara (Jungle Treehouse
   Village) and the red squirrel (Treetop Adventure Park).
   window.SLPxMascotsA + SL3D.defineVox('mascots-a', factory) in the browser, module.exports in
   Node: {IDS, ROWS, voxels: {<id>: fn(st, ctx) → VoxModel}, register(PC), factory, …}.

   THE OPEN TABLE (D95, D96). Each species is a row of SLPxCharacters.SPECIES, registered with
   defineSpecies(id, row) when this file loads (so the portrait is drawn on every atlas already
   bound) and again by the factory if the table lost it. makeRig, the display models, sockets
   and portraits read the row; nothing here builds a THREE object. The factory registers the
   five vox handlers (SLPxCharacters.handler) and defines each 'portrait:<pet>' cell on the bound
   atlas (D76). Rows (contracts.characters):
     voxels(acc, ctx) → {bone: VoxModel}   pure; the rest pose in the ROOT frame of px-characters
                                           (GC 0.05 u voxels, voxel (i, j, k) centred on x = i·GC,
                                           z = k·GC, standing on y = j·GC; the pet faces +z, its
                                           left is +x); ctx.covered = a face piece hides the eyes
     sockets {hat, neck, face, back, seat: {bone, v, at, w, d, flags}}   v in voxels, at in u
     joints {bone: [x, y, z] u} for every bone · eyes [[i, j, k]…] · h, topY, biped, bodyY,
     wingRest, tailUp · portrait {rows[12], pal} (hand-drawn from the 2D head, world-art-crew)
   Bones are the v2 bones only (catalogAdditions.species.bones); a bone a species does not use
   stays empty, so every clip samples without branching. No built-in clothes, no teeth.

   THE FIVE (land-shops.json lands.<land>.mascots[].voxelLook; colours PETCOL3 only, D107):
     pet_crab      a low, wide sea-blue shell, an oval dome from above (widest at the rim, stepped
                   in a voxel a row), with three pale spots, a cream belly band and pink cheek dots;
                   two big pincers held forward and low on wingL / wingR (each a 3 × 3 × 3 claw
                   notched across its front into an open C, cream on the upper jaw), eight short
                   splayed stub legs two to a leg bone, a small head block on the front of the dome
                   with a small smile and two short stalks carrying cream eye bulbs whose pupils
                   look up and forward (a hat sits between them, a face piece across both bulbs).
                   No tail, no ears. The only pet wider than it is tall. Blue, with no grin or brows.
     pet_gull      biped (feet on legBL / legBR, wings on wingL / wingR): a soft-white round bird
                   with a blue-grey mantle, folded blue-grey wings tipped in ink with a white dot,
                   a chunky pointed sunny beak, sunny webbed feet and a fan tail on tail /
                   tailTip. Pet-sized with a yellow beak, so never one of the pier's small
                   coral-beaked gulls; no head tuft, no long neck.
     pet_monkey    golden, with a cream face mask round the eyes that wraps a voxel round the sides
                   of the head, over a cream muzzle and a plum nose; a little golden crest on the
                   crown (it gives way to a hat), big round ears out at the sides with cream insides
                   that show from the front and above, plum hands and feet, front legs a voxel
                   longer than the back, and a thin tail that rises above the head line and curls
                   forward over the back into a question mark with a cream tip (tail / tailTip,
                   upright: it wags like a wiper).
     pet_capybara  a long rounded barrel loaf (top and bottom edges, rump and chest stepped in) with
                   a low hump over the hindquarters and a pale belly; its own head, two voxels
                   narrower and a row lower, set forward: a flat-topped skull, then a deep blunt
                   muzzle three voxels long (a broad jaw under a narrower bridge, a dark nose band
                   with two nostrils, a pale chin), small sleepy lidded eyes high on the sides
                   beside the bridge, two tiny dark ears far back, four short dark-toed legs that
                   show under the barrel and NO tail (the tail bones stay empty). The neck socket
                   sits on the join behind the jaw, so a collar wraps the neck.
     pet_squirrel  slim and russet with a cream belly and muzzle, a pink nose, pointed ears with
                   dark tufts, small front paws, big hind feet, and a plume tail as big as the
                   rest of it that leaves the rump, keeps two voxels clear behind the back socket,
                   rises to head height and curls forward (upright: it wags like a wiper).
   Budgets (D108): ≤ 750 tris bare on every tier, one SkinnedMesh with any outfit (≤ 1,400). The
   LOW tier drops the inlaid detail (lod 'mid': shell spots, the crab's smile corners, the capybara's lids). Nothing here
   reads, awards or spends points; no random numbers: the same input gives the same model.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxMascotsA = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('mascots-a', api.factory);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxMascotsA: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC.defineSpecies === 'function' ? PC : null; }

  var VERSION = 1, GC = 0.05;
  var IDS = ['pet_crab', 'pet_gull', 'pet_monkey', 'pet_capybara', 'pet_squirrel'];
  var SOCKET_BONE = { hat: 'head', face: 'head', neck: 'neck', back: 'body', seat: 'body' };
  var PROUD = 0.004;                 /* inlays sit a hair proud of the face they lie on (= px-characters) */

  /* root-frame voxel coordinates (an integer is a voxel centre) → item metres */
  function u3(v) { return [v[0] * GC, (v[1] + 0.5) * GC, v[2] * GC]; }
  function grid() { return vox().grid({ grid: GC }); }
  /* the inlay layer of px-characters: half-voxel pixels a quarter voxel deep on the +z faces —
     GC column i is fine columns 2i, 2i + 1; row j is 2j, 2j + 1; the front of voxel k is 4k + 2 */
  function fine() { return vox().grid({ grid: [GC / 2, GC / 2, GC / 4], origin: [1, 0, 0] }); }
  /* a 1 × 2 eye on the front of voxels (i, j..j + 1, k), its glint in the upper corner */
  function eye(o, i, j, k, shine) {
    var a = 2 * i, b = 2 * j, c = 4 * k + 2;
    o.box(a, a + 1, b, b + 3, c, c, 'e');
    if (shine) o.set(a, b + 3, c, 'g');
  }
  /* a box whose twelve edges are cut one voxel (cut 2: corners too, a rounder blob) */
  function round(o, i0, i1, j0, j1, k0, k1, c, cut) {
    var n = cut || 2;
    return o.box(i0, i1, j0, j1, k0, k1, function (i, j, k) {
      return (i === i0 || i === i1) + (j === j0 || j === j1) + (k === k0 || k === k1) >= n ? null : typeof c === 'function' ? c(i, j, k) : c;
    });
  }
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

  /* ================================================================
     THE FIVE DESIGNS
     Each: eye {i, j, k} (the left eye's column, its lower row and the face voxel it sits on;
     the right one mirrors it) · joints (voxels; R twins mirror L) · sockets {slot: [v, w, d,
     flags]} · build(P): P.on(bone) a GC grid, P.fine(bone) its inlay layer, P.sides(fn(s, L)),
     P.acc the outfit. Palette b body · d dark · l light · n nose (PETCOL3.<id>.<part>) · e eye
     · g glint · k blush · s star + a species' own.
     ================================================================ */
  var DESIGNS = {
    /* ---------------- the crab: 15 wide with its pincers, 11 tall to the eye bulbs, 11 deep ---------------- */
    pet_crab: {
      h: 0.55, topY: 0.62, biped: false, bodyY: 0.17, top: 10, extra: { m: { token: 'PX Ink Eye', lod: 'mid' } },
      eye: { i: 2, j: 9, k: 3 }, blush: { i: 2, j: 6, k: 3 },
      joints: { body: [0, 3.5, 0], neck: [0, 5.5, 2], head: [0, 7, 2], earL: [2, 8, 2], tail: [0, 3.5, -3.5], tailTip: [0, 3.5, -4.5],
        legFL: [4.5, 2.5, 2], legBL: [4.5, 2.5, -2], wingL: [4.5, 3.5, 2.5] },
      sockets: { hat: [[0, 7.5, 2], 5, 3, { stalks: true }], face: [[0, 9.5, 3.5], 3, 3, { stalks: true }], neck: [[0, 6, 2], 5, 3, { noNeck: true }],
        back: [[0, 6.5, -1], 5, 3, {}], seat: [[0, 1.5, 0], 7, 5, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* the shell, an oval dome seen from above (11 × 9): the cream belly row, the rim widest at
           rows 3–4, then stepped in a voxel a row to the top; each row's half-widths run from the
           middle (k = 0) out to the front and the back */
        var HW = { 2: [4, 4, 4, 3], 3: [5, 5, 5, 4, 3], 4: [5, 5, 5, 4, 3], 5: [4, 4, 4, 3], 6: [3, 3, 2] };
        Object.keys(HW).forEach(function (j) {
          var w = HW[j], y = +j, n = w.length - 1;
          for (var k = -n; k <= (y === 6 ? 0 : n); k++) b.box(-w[Math.abs(k)], w[Math.abs(k)], y, y, k, k, y === 2 ? 'l' : 'b');   /* the head block caps the dome's front */
        });
        P.sides(function (s) { b.set(3 * s, 4, 4, 'n').set(5 * s, 3, 3, 'b'); });   /* pink cheek dots on the shell's front; the claws' shoulders */
        var sp = P.fine('body');                                                 /* three pale shell spots (MID / HIGH) */
        [[-3, 6, -1], [3, 6, -1], [0, 6, -2]].forEach(function (c) { sp.box(2 * c[0], 2 * c[0] + 1, 2 * c[1] + 2, 2 * c[1] + 2, 4 * c[2] - 1, 4 * c[2] + 1, 'p'); });
        /* the head block on the front of the dome, a small smile under the eyes; two short thick
           stalks carry cream eye bulbs whose dark pupils look up and forward (they read from above) */
        h.box(-2, 2, 6, 7, 1, 3, 'b');
        P.fine('head').box(-1, 2, 12, 12, 14, 14, 'e').set(-2, 13, 14, 'm').set(3, 13, 14, 'm');   /* its corners MID / HIGH */
        P.sides(function (s) { h.set(2 * s, 8, 2, 'b').box(2 * s, 3 * s, 9, 10, 2, 3, 'l').set(2 * s, 10, 3, 'e'); });
        /* two big pincers held forward and low beside the face, each on a short arm from the rim's
           front corner (clear of what hangs from the neck): a 3 × 3 × 3 claw with a notch cut across
           its front (an open C from the side), cream on the upper jaw */
        P.sides(function (s, L) {
          P.on('wing' + L).box(5 * s, 7 * s, 2, 4, 4, 6, function (i, j, k) { return k < 6 ? 'b' : j === 3 ? null : j === 4 ? 'l' : 'b'; });
        });
        /* eight stub legs, two to each leg bone, splayed: a hip bar under the belly's edge, then each
           leg steps out and down to its foot (no upright posts) */
        P.sides(function (s, L) {
          [['legF', [3, 1]], ['legB', [-1, -3]]].forEach(function (g) {
            var o = P.on(g[0] + L).box(5 * s, 5 * s, 1, 1, g[1][0], g[1][1], 'd');
            g[1].forEach(function (k) { o.set(6 * s, 0, k, 'd'); });
          });
        });
      } },

    /* ---------------- the seagull: 9 wide, 12 tall, 12 deep; two legs ---------------- */
    pet_gull: {
      h: 0.6, topY: 0.72, biped: true, bodyY: 0.22, top: 11, extra: { t: 'PX Ink Eye' },
      eye: { i: 2, j: 9, k: 4 }, blush: { i: 2, j: 8, k: 4 },
      joints: { body: [0, 4, -1.5], neck: [0, 6, 1], head: [0, 8.5, 1.5], earL: [2.5, 11, 1.5], tail: [0, 4.5, -4.5], tailTip: [0, 4.5, -5.5],
        legFL: [1.5, 2.5, 0], legBL: [2, 1.5, -1], wingL: [3.5, 6, -1] },
      sockets: { hat: [[0, 11.5, 1.5], 5, 4, {}], face: [[0, 9.5, 4.5], 5, 4, {}], neck: [[0, 6, 1.5], 5, 4, {}],
        back: [[0, 6.5, -2.5], 5, 2, { wings: true }], seat: [[0, 1.5, -1], 5, 4, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* a round, low-slung body, the blue-grey mantle over its back */
        round(b, -3, 3, 2, 6, -4, 1, function (i, j, k) { return j === 6 && k < 0 ? 'd' : 'b'; });
        round(h, -3, 3, 6, 11, -1, 4, 'b');                                    /* a round white head over the front */
        h.box(0, 0, 7, 8, 5, 6, 'n').set(0, 8, 7, 'n');                         /* the chunky, pointed sunny beak */
        P.sides(function (s, L) {
          /* blue-grey folded wings along the sides, tipped in ink with one white dot */
          P.on('wing' + L).box(4 * s, 4 * s, 4, 6, -4, 0, function (i, j, k) { return j === 4 && k === 0 ? null : 'd'; })
            .box(3 * s, 3 * s, 6, 6, -4, -1, 'd').box(4 * s, 4 * s, 3, 4, -6, -5, 't').set(4 * s, 4, -6, 'l');
          /* short sunny legs and three-wide webbed feet */
          P.on('legB' + L).set(2 * s, 1, -1, 'n').box(s, 3 * s, 0, 0, -1, -1, 'n').set(2 * s, 0, 0, 'n');
        });
        P.on('tail').box(-1, 1, 4, 5, -5, -5, 'b');                              /* the fan tail, grey at the tips */
        P.on('tailTip').box(-1, 1, 5, 5, -6, -6, 'd').set(-1, 4, -6, 'd').set(1, 4, -6, 'd');
      } },

    /* ---------------- the monkey: 11 wide with its ears, 14 tall to the curl, 11 deep + the tail ---------------- */
    pet_monkey: {
      h: 0.65, topY: 0.8, biped: false, bodyY: 0.26, top: 12, tailUp: true,
      eye: { i: 2, j: 9, k: 6 }, blush: { i: 2, j: 8, k: 6 },
      joints: { body: [0, 5, -1], neck: [0, 6.5, 2], head: [0, 9, 3], earL: [3.5, 10, 3], tail: [0, 5, -3.5], tailTip: [0, 12.5, -5],
        legFL: [1.5, 3.5, 0.5], legBL: [1.5, 2.5, -2.5], wingL: [2.5, 6, -1] },
      sockets: { hat: [[0, 12.5, 3], 5, 5, { earsSide: true }], face: [[0, 9.5, 6.5], 5, 4, { earsSide: true }], neck: [[0, 6, 3], 5, 4, {}],
        back: [[0, 6.5, -2], 5, 3, {}], seat: [[0, 2.5, -2], 5, 3, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* a slim body sitting slightly up: the chest a row higher than the rump, a cream tummy */
        b.box(-2, 2, 3, 6, -3, -1, 'b').box(-2, 2, 4, 7, 0, 1, function (i, j, k) { return k === 1 && Math.abs(i) < 2 && j < 7 ? 'l' : 'b'; });
        round(h, -3, 3, 6, 12, 0, 6, 'b');
        /* the cream face mask round the eyes, wrapping a voxel round each side of the head, over a
           cream muzzle with a plum nose */
        h.box(-2, 2, 7, 10, 6, 6, function (i, j) { return j === 10 && i === 0 ? 'b' : 'l'; });
        P.sides(function (s) { h.box(3 * s, 3 * s, 7, 10, 5, 5, 'l'); });
        h.box(-1, 1, 7, 8, 7, 7, 'l');
        P.fine('head').box(0, 1, 17, 17, 30, 30, 'n');
        if (!P.acc.hat) h.box(-1, 1, 13, 13, 4, 4, 'b').set(0, 13, 3, 'b');   /* a little golden crest (a hat sits there) */
        /* big round ears out at the sides, cream inside: the cream shows from the front and from above */
        P.sides(function (s, L) {
          P.on('ear' + L).box(4 * s, 5 * s, 9, 11, 2, 4, function (i, j, k) {
            var outer = Math.abs(i) === 5;
            if (outer && (j === 9 || j === 11) && (k === 2 || k === 4)) return null;
            return outer || k === 2 ? 'b' : 'l';
          });
        });
        /* legs: the front pair a voxel longer, plum hands and feet */
        [['legFL', 1, 0, 3], ['legFR', -2, 0, 3], ['legBL', 1, -3, 2], ['legBR', -2, -3, 2]].forEach(function (L) {
          P.on(L[0]).box(L[1], L[1] + 1, 0, L[3], L[2], L[2] + 1, function (i, j) { return j ? 'b' : 'd'; });
        });
        /* the tail: up from the rump, then a question-mark curl over the back — forward along the
           top above the head line, down at the front and back in on itself to a cream tip */
        P.on('tail').box(0, 0, 5, 5, -4, -4, 'b').box(0, 0, 5, 12, -5, -5, 'b');
        P.on('tailTip').box(0, 0, 13, 13, -5, -2, 'b').box(0, 0, 11, 12, -2, -2, 'b').set(0, 11, -3, 'l');
      } },

    /* ---------------- the capybara: 7 wide, 9 tall to the hump, 15 deep: the longest ---------------- */
    pet_capybara: {
      h: 0.5, topY: 0.66, biped: false, bodyY: 0.2, top: 8,
      eye: { i: 2, j: 5, k: 5 }, blush: { i: 2, j: 3, k: 8 },
      joints: { body: [0, 4, -2.5], neck: [0, 4.5, 1.5], head: [0, 4.5, 3], earL: [2, 8, 2], tail: [0, 4.5, -6.5], tailTip: [0, 4.5, -7],
        legFL: [1.5, 1.5, 0.5], legBL: [1.5, 1.5, -4.5], wingL: [3.5, 4, -2] },
      sockets: { hat: [[0, 7.5, 4], 5, 3, {}], face: [[0, 5.5, 5.5], 5, 4, {}], neck: [[0, 2, 3.5], 5, 4, {}],
        back: [[0, 8.5, -3.5], 3, 4, {}], seat: [[0, 1.5, -2], 5, 5, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* the barrel loaf, rounded: its top and bottom edges, the rump and the chest stepped in a
           voxel, the back rising a row into a hump from behind the shoulders (above the head's
           line), a pale belly underneath */
        b.box(-3, 3, 2, 8, -6, 1, function (i, j, k) {
          var ai = Math.abs(i), end = k === -6 || k === 1;
          if (j === 8) return k >= -5 && k <= -1 && ai < 2 ? 'b' : null;
          if (end) return j > 2 && j < 7 && ai < 3 ? 'b' : null;
          return (j === 2 || j === 7) && ai > 2 ? null : j === 2 ? 'l' : 'b';
        });
        /* its own head, two voxels narrower than the body and set forward, a dip at the nape: the
           flat-topped skull, then a deep, blunt muzzle three voxels long under the eyes (a face piece
           sits over the eyes, clear of it) — its front band dark with two nostrils, a pale chin —
           and small sleepy eyes high on the sides of the face */
        h.box(-2, 2, 2, 7, 2, 5, 'b');
        h.box(-2, 2, 2, 4, 6, 8, function (i, j, k) { return j === 2 ? 'l' : k === 8 ? 'd' : 'b'; });
        var f = P.fine('head');
        P.sides(function (s, L) {
          f.set(s > 0 ? 2 : -1, 9, 34, 'n');                                     /* nostrils high on the snout */
          f.box(s > 0 ? 4 : -4, s > 0 ? 5 : -3, 14, 14, 22, 22, 'L');            /* a sleepy lid over each eye (MID / HIGH) */
          P.on('ear' + L).set(2 * s, 8, 2, 'd');                                 /* tiny round ears far back */
        });
        /* four short legs, two rows showing under the barrel, dark toes */
        [['legFL', 1, 0], ['legFR', -2, 0], ['legBL', 1, -5], ['legBR', -2, -5]].forEach(function (L) {
          P.on(L[0]).box(L[1], L[1] + 1, 0, 1, L[2], L[2] + 1, function (i, j) { return j ? 'b' : 'd'; });
        });
      } },

    /* ---------------- the red squirrel: 7 wide, 12 tall to the ear tufts, 16 deep with the tail ---------------- */
    pet_squirrel: {
      h: 0.6, topY: 0.78, biped: false, bodyY: 0.25, top: 9, tailUp: true,
      eye: { i: 2, j: 7, k: 6 }, blush: { i: 2, j: 6, k: 6 },
      joints: { body: [0, 4.5, -0.5], neck: [0, 5.5, 2], head: [0, 7, 3.5], earL: [2.5, 9.5, 3], tail: [0, 3.5, -2.5], tailTip: [0, 9.5, -6],
        legFL: [1, 2.5, 0.5], legBL: [2, 3, -1.5], wingL: [2.5, 6, -0.5] },
      sockets: { hat: [[0, 9.5, 3.5], 5, 4, { earsUp: true }], face: [[0, 7.5, 6.5], 5, 4, { earsUp: true }], neck: [[0, 5, 3], 5, 4, {}],
        back: [[0, 7.5, -0.5], 5, 2, {}], seat: [[0, 2.5, 0], 3, 3, {}] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* a slim body with a cream front */
        b.box(-2, 2, 3, 7, -2, 1, function (i, j, k) {
          var ai = Math.abs(i);
          if (ai === 2 && (k === -2 || k === 1)) return null;
          if (j === 7 && k === 1) return null;
          return k === 1 ? 'l' : 'b';
        });
        round(h, -3, 3, 5, 9, 1, 6, 'b');
        h.box(-1, 1, 5, 6, 7, 7, 'l').set(0, 6, 7, 'n');                         /* the cream muzzle and a pink nose */
        P.sides(function (s, L) { P.on('ear' + L).box(2 * s, 3 * s, 10, 10, 3, 3, 'b').set(3 * s, 11, 3, 'd'); P.fine('ear' + L).box(4 * s, 4 * s + 1, 20, 21, 14, 14, 'l'); });   /* pointed ears, cream inside, dark tufts */
        /* small front paws; big hind haunches and feet */
        P.sides(function (s, L) {
          P.on('legF' + L).box(s, s, 0, 2, 0, 1, function (i, j) { return j ? 'b' : 'l'; });
          P.on('legB' + L).box(2 * s, 2 * s, 1, 3, -2, -1, 'b').box(s, 2 * s, 0, 0, -2, 1, 'd');
        });
        /* the plume: back from the rump, two voxels clear of the back, bushy up to head height … */
        var PLUME = { 3: [-7, -5, 1], 4: [-7, -5, 2], 5: [-8, -5, 2], 6: [-8, -5, 2], 7: [-8, -5, 2], 8: [-8, -5, 2], 9: [-8, -5, 2] };
        var CURL = { 10: [-8, -4, 2], 11: [-7, -3, 2], 12: [-6, -4, 1] };
        function plume(o, rows, tip) {
          Object.keys(rows).forEach(function (j) {
            var r = rows[j], y = +j;
            o.box(-r[2], r[2], y, y, r[0], r[1], function (i, jj, k) {
              if (Math.abs(i) === r[2] && r[2] > 1 && (k === r[0] || k === r[1])) return null;
              return tip && k >= -4 ? 'l' : 'b';
            });
          });
        }
        var t = P.on('tail');
        t.box(-1, 1, 3, 4, -4, -3, 'b');
        plume(t, PLUME, false);
        plume(P.on('tailTip'), CURL, true);                                   /* … curled forward, a cream tip */
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
    J.cape0 = [0, bk[1], bk[2] + 2]; J.cape1 = [0, bk[1], bk[2]]; J.cape2 = [0, bk[1], bk[2] - 2];
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
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' },
      p: { token: p + 'light', lod: 'mid' }, L: { token: p + 'dark', lod: 'mid' } }, g = {}, f = {}, c, out = {};
    for (c in D.extra || {}) pal[c] = D.extra[c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
      sides: function (fn) { fn(1, 'L'); fn(-1, 'R'); }
    };
    D.build(P);
    var E = D.eye, B = D.blush || { i: E.i, j: E.j - 1, k: E.k };
    P.sides(function (s) {
      eye(P.fine('eyes'), E.i * s, E.j, E.k, !(ctx && ctx.covered));
      var cb = 4 * B.k + 2;
      P.fine('blush').box(2 * B.i * s, 2 * B.i * s + 1, 2 * B.j, 2 * B.j + 1, cb, cb, 'k');
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

  /* ---------------- portraits: 12 × 12 from the front, hand-drawn from the 2D heads ----------------
     (the crab's and the monkey's follow their voxel rigs: cream eye bulbs on stalks, a smile and
     pincers held low; a golden crest in place of the plum tuft) */
  function pp(id, extra) {
    var p = 'PETCOL3.' + id + '.', o = { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye' }, k;
    for (k in extra || {}) o[k] = extra[k];
    return o;
  }
  var PORTRAITS = {
    pet_crab: { pal: pp('pet_crab'), rows: [
      '............', '..ll....ll..', '..le....el..', '..le....el..', '...b....b...', '..bbbbbbbb..',
      '.bbbbbbbbbb.', '.bnbdbbdbnb.', 'llbbbddbbbll', '..bllllllb..', 'bb.dd..dd.bb', '............'] },
    pet_gull: { pal: pp('pet_gull'), rows: [
      '............', '...bbbbbb...', '..bbbbbbbb..', '.bbbbbbbbbb.', '.bbebbbbebb.', '.bbebbbbebb.',
      '.bbbbnnbbbb.', '.dbbbnnbbbd.', '.ddbbbbbbdd.', '..ddbbbbdd..', '...dbbbbd...', '............'] },
    pet_monkey: { pal: pp('pet_monkey'), rows: [
      '.....bb.....', '...bbbbbb...', '..bbbbbbbb..', '.bbllbbllbb.', 'bblellllelbb', 'lblellllelbl',
      'bbllllllllbb', '.bllllllllb.', '.bbllnnllbb.', '..bllllllb..', '...bbbbbb...', '............'] },
    pet_capybara: { pal: pp('pet_capybara'), rows: [
      '..d......d..', '..bbbbbbbb..', '.bbbbbbbbbb.', '.bddbbbbddb.', '.bebbbbbbeb.', '.bebbbbbbeb.',
      '.bbbbbbbbbb.', '.bbnbbbbnbb.', '.bbbbbbbbbb.', '.bbllllllbb.', '..bbbbbbbb..', '............'] },
    pet_squirrel: { pal: pp('pet_squirrel'), rows: [
      '.d........d.', '.dd......dd.', '.bb......bb.', '.bbbbbbbbbb.', 'bbbbbbbbbbbb', 'bebbbbbbbbeb',
      'bebbbbbbbbeb', 'bbbllllllbbb', '.bbllnnllbb.', '..bllllllb..', '...bbbbbb...', '............'] }
  };
  /* the eyes in the hand-drawn portraits are two pixels tall, as on the rigs */

  var ROWS = {};
  IDS.forEach(function (id) { ROWS[id] = rowOf(id); });

  /* ================================================================
     REGISTRATION
     ================================================================ */
  /* put the five rows in the open table (again, if the table lost one) → how many were added */
  function register(PC) {
    PC = PC || chars();
    if (!PC || !PC.SPECIES) return 0;
    var n = 0;
    IDS.forEach(function (id) { if (PC.SPECIES[id] !== ROWS[id] && PC.defineSpecies(id, ROWS[id])) n++; });
    return n;
  }
  function atlasOf(K) { try { return K && K.vox && typeof K.vox.atlas === 'function' ? K.vox.atlas() : null; } catch (e) { return null; } }
  /* SL3D.defineVox('mascots-a'): the display handlers and the portrait cells on the bound atlas */
  function factory(K) {
    var PC = chars(), out = {}, A = atlasOf(K);
    if (!PC) return out;
    register(PC);
    IDS.forEach(function (id) {
      out[id] = PC.handler(id);
      if (A && !A.has('portrait:' + id)) PC.definePortrait(K, id);
    });
    return out;
  }
  /* Node: the display model of each mascot (= the handler's: every bone at rest, sockets as pivots) */
  var voxels = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st, ctx) { var PC = chars(); register(PC); return PC ? PC.displayVoxels(id, st, ctx) : null; };
  });

  return { VERSION: VERSION, GC: GC, IDS: IDS, ROWS: ROWS, DESIGNS: DESIGNS, PORTRAITS: PORTRAITS, voxels: voxels, register: register, factory: factory };
}));
