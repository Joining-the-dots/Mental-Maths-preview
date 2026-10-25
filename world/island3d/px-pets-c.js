/* ================================================================
   My Island kids update — SLPxPetsC (P2.3): four of the fourteen new pets as voxel species — the
   goat kid and the peacock (castle), the reindeer calf and the snow leopard cub (ice).
   window.SLPxPetsC + SL3D.defineVox('pets-c', factory) in the browser, module.exports in Node.
   Each species is a row of the open table SLPxCharacters.SPECIES (px-characters.js), registered
   with defineSpecies when this file loads (so makeRig, the sockets, the photocards and the
   'portrait:<pet>' atlas cells read it like every other pet); the factory gives the four vox
   handlers and draws their portraits on the bound atlas (D76). Voxels are pure data on the crew
   grid GC 0.05 u in the ROOT frame of px-characters (voxel (i, j, k) is centred on x = i·GC,
   z = k·GC and stands on y = j·GC; the pet faces +z, its left is +x). No THREE, no DOM, no random
   numbers; one colour per voxel, palette tokens only (each species' own PETCOL3 parts and the
   shared eye ink, glint, blush and dizzy stars; nothing darker than PX Ink Eye). Nothing here
   reads, awards or spends anything.

   THE FOUR (kids-update pets.json catalogue.new look / avoid notes; the v2 bones only, D95):
     pet_goatkid      the pony's frame exactly (GAIT_GEOM.canter: legs 0.25 u on the same hips): a
                      creamy white kid on long legs with grey-brown hooves, a grey-brown saddle patch
                      (so it reads on the castle's stone), a big-browed face with a white blaze down
                      to a white muzzle and a pink nose, long ears held out sideways with drooping
                      tips, two rounded grey horn nubs one row high at the crown's edges (hat flag
                      horns: a hat sits between them), a short upturned tail with a white tip that
                      flicks like a wiper; no beard; 0.7 u
     pet_peacock      a biped on legBL / legBR (GAIT_GEOM_SPECIES.pet_peacock: legs 0.14 u, the feet
                      ±0.08 u) with its wings folded on wingL / wingR: a blue body and neck, a small
                      head with a white face patch and a tan beak, a crest of three pale stalks with
                      blue tips (flag earsUp; left out under a hat, which would bury it), and a green-
                      teal train lying flat behind on tail / tailTip — a half-disc 13 voxels across
                      and 7 deep, its straight edge hinged at the top of the rump, with gold eye spots
                      with blue centres (seven on MID / HIGH, three on LOW). In the 'fan' move
                      tailPitch lifts it to an upright half-disc behind the body (no new bone) whose
                      rim stays under the LOOK h rule + 0.25 u; 0.75 u to the crest
     pet_reindeer     the pony's frame: a brown calf with a cream neck ruff, belly and rump patch,
                      dark legs and darker hooves, a long face with a pale muzzle and a dark brown
                      nose (never red, never glowing), small ears held out, two short velvety
                      antlers at the crown's edges, each a stem and one fork opening outwards (hat
                      flag horns), a white tail tuft; no harness and no bells (the sleigh-bell
                      collar is an accessory any pet can wear); 0.8 u to the antler tips
     pet_snowleopard  the kitten's frame (the trot): a fluffy smoky-grey cub with big white paws, a
                      white belly and muzzle, a pink nose, small round ears with dark backs, a few
                      slate spots on the crown, seven broken-ring rosettes in slate (three cells of a
                      2 × 2, the fourth the body showing through) on its back and both sides — on
                      every tier, so the plan's 'six at LOW' holds — and a very long thick tail with
                      dark rings and a dark tip that curls up (tail / tailTip, held out behind and
                      swished side to side); cub proportions, no fangs; 0.6 u
   Every v2 bone exists (empty bones are allowed), so every clip samples without branching; the
   gaits, the pace and the biped wing map are the clip layer's (models-characters.js). Every face
   keeps a light part beside its body colour, so the eyes read at island scale (lookNotes.crisp),
   and every eye sits at least a row under the crown's top row, which a pulled-on hat wraps.

   SOCKETS (D96; the v of px-characters: an integer is a voxel centre, .5 a face): hat = the middle
   of the crown's top face (w × d = the flat of the crown), face = between the eyes on the face
   plane (w = the span of the eyes), neck = the centre of the ring row under the head (w × d = what
   the ring wraps), back = the middle of the free deck, which ends flush with the back so a cape's
   hem hangs down it, seat = under the rump.
   Budgets (D108): ≤ 750 tris bare on every tier, ≤ 1,400 with one piece per slot at its cap, one
   draw. LOW drops the details tagged lod 'mid' (the peacock's four extra eye-spot centres).

   Node: {IDS, ROWS, voxels: {id: fn(st, ctx) → display VoxModel}, speciesVoxels(id, acc, ctx),
   TRAIN (the peacock's train), register(PC) / fill(PC) → n registered, factory(K) → {id: handler}}.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPetsC = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pets-c', api.factory);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPetsC: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC === 'object' && PC.SPECIES ? PC : null; }

  var VERSION = 1, GC = 0.05, PROUD = 0.004;
  var IDS = ['pet_goatkid', 'pet_peacock', 'pet_reindeer', 'pet_snowleopard'];

  /* ---------------- building blocks (pure; the conventions of px-characters) ---------------- */
  function u3(v) { return [v[0] * GC, (v[1] + 0.5) * GC, v[2] * GC]; }
  function grid() { return vox().grid({ grid: GC }); }
  /* the face layer: half-voxel pixels a quarter voxel deep, PROUD of the face (GC column i = fine
     columns 2i, 2i + 1; row j = 2j, 2j + 1; the front of GC voxel k = fine layer 4k + 2) */
  function fine() { return vox().grid({ grid: [GC / 2, GC / 2, GC / 4], origin: [1, 0, 0] }); }
  /* the top layer: half-voxel pixels a quarter voxel thick, PROUD of a top face (fine column 2i is
     centred on GC column i, the same along z; the top of GC row j = fine row 4j + 3) */
  function topFine() { return vox().grid({ grid: [GC / 2, GC / 4, GC / 2], origin: [0.5, 0, 0.5] }); }
  function eye(o, i, j, k, shine) {
    var a = 2 * i, b = 2 * j, c = 4 * k + 2;
    o.box(a, a + 1, b, b + 3, c, c, 'e');
    if (shine) o.set(a, b + 3, c, 'g');
  }
  function dot(o, i, j, k, ch) { var c = 4 * k + 2; o.box(2 * i, 2 * i + 1, 2 * j, 2 * j + 1, c, c, ch); }
  /* three ✦ round (at) for the dizzy ring, each a five-voxel plus (four points, never five) */
  function stars(at) {
    var o = vox().grid({ grid: GC / 2 }), g = GC / 2;
    for (var n = 0; n < 3; n++) {
      var a = n * Math.PI * 2 / 3, x = Math.round(0.13 * Math.cos(a) / g), z = Math.round(0.13 * Math.sin(a) / g) + Math.round(at[2] / g);
      var y = Math.round((at[1] + 0.015 * Math.sin(2 * a + n)) / g);
      o.box(x - 1, x + 1, y, y, z, z, 's').box(x, x, y - 1, y + 1, z, z, 's');
    }
    return o;
  }
  /* a box with bevelled edges: bev {s side, b bottom, t top, k back, f front}; an edge between two
     faces is cut min(bev) voxels deep, or bev[pair] when it is given (tk: 0 keeps the top-back edge
     square). c: char | fn(i, j, k) */
  function shape(o, i0, i1, j0, j1, k0, k1, bev, c) {
    var B = { s: 0, b: 0, t: 0, k: 0, f: 0 }, n;
    for (n in bev || {}) B[n] = bev[n];
    function cut(a, da, b, db) { var e = B[a + b] != null ? B[a + b] : Math.min(B[a], B[b]); return da + db < e; }
    return o.box(i0, i1, j0, j1, k0, k1, function (i, j, k) {
      var ds = Math.min(i - i0, i1 - i), db = j - j0, dt = j1 - j, dk = k - k0, df = k1 - k;
      if (cut('s', ds, 'b', db) || cut('s', ds, 't', dt) || cut('s', ds, 'k', dk) || cut('s', ds, 'f', df) ||
          cut('b', db, 'k', dk) || cut('b', db, 'f', df) || cut('t', dt, 'k', dk) || cut('t', dt, 'f', df)) return null;
      return typeof c === 'function' ? c(i, j, k) : c;
    });
  }
  /* the canter frame's four straight legs (the pony's: 2 × 2, five rows, hips 0.25 u up) */
  function canterLegs(P, hoof, leg) {
    [['legFL', 1, 1], ['legFR', -2, 1], ['legBL', 1, -4], ['legBR', -2, -4]].forEach(function (L) {
      P.on(L[0]).box(L[1], L[1] + 1, 0, 4, L[2], L[2] + 1, function (i, j) { return j === 0 ? hoof : leg; });
    });
  }

  /* ---------------- the peacock's train ----------------
     A half-disc of radius 7 about its straight edge (the hinge line, the back face of the rump at
     k = −3.5): rows k = −4 … −10, 13 / 13 / 13 / 13 / 11 / 9 / 5 voxels across. The near four rows
     ride 'tail', the far three 'tailTip' (whose joint is on the hinge's line of travel, so the
     train lifts as one piece). The eye spots: gold cells with a blue centre on the top face; the
     three CORE spots keep their centres on LOW, the other four are lod 'mid'. */
  var TRAIN = { row: 7, hinge: -3.5, rows: [6, 6, 6, 6, 5, 4, 2], tipFrom: 4, width: 13, depth: 7,
    spots: [[0, -9], [3, -8], [-3, -8], [5, -5], [-5, -5], [2, -5], [-2, -5]], core: 3 };

  /* ================================================================
     THE FOUR SPECIES
     Each: rows (to the top), topY, biped, bodyY (u), wingRest (deg), tailUp, joints (voxel
     coords, → u3), sockets {slot: [v, w, d, flags?]}, eyes {i, j, k} (the cells of the two eyes:
     ±i, rows j..j + 1, on the face of voxel k), cheeks [[i, j, k]] (blush, mirrored), spark (the
     dizzy ring's centre), build(P). P.on(bone) is that bone's GC grid, P.fine(bone) its face inlay
     layer, P.top(bone) its top inlay layer, P.acc the outfit {slot: id}, P.sides(fn(s, 'L' | 'R')).
     ================================================================ */
  var DEF = {
    /* ---- Castle: the goat kid ---- */
    pet_goatkid: { rows: 14, topY: 0.8, biped: false, bodyY: 0.33, wingRest: 0, tailUp: true,
      joints: { body: [0, 6, -1], neck: [0, 7.5, 1.5], head: [0, 10.5, 4.5], earL: [2.5, 12, 4.5], tail: [0, 7.5, -4.5], tailTip: [0, 8.5, -5],
        legFL: [1.5, 4.5, 1.5], legBL: [1.5, 4.5, -3.5], wingL: [2.5, 7, -1] },
      sockets: { hat: [[0, 12.5, 5], 5, 3, { horns: true }], face: [[0, 10.5, 6.5], 3, 4, { horns: true }], neck: [[0, 9, 1.5], 3, 2],
        back: [[0, 7.5, -2.5], 5, 4], seat: [[0, 4.5, -1], 5, 4] },
      eyes: { i: 1, j: 10, k: 6 }, cheeks: [[2, 10, 6]], spark: [0, 15.5, 4.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        canterLegs(P, 'd', 'b');                                                 /* long legs, grey-brown hooves */
        /* a short barrel: a white belly, a grey-brown saddle patch on the back */
        shape(b, -2, 2, 5, 7, -4, 2, { s: 1, b: 1, k: 1, f: 1 }, function (i, j, k) {
          if (j === 5 && Math.abs(i) <= 1 && k > -4 && k < 2) return 'l';
          return j === 7 && Math.abs(i) <= 1 && k >= -3 && k <= -1 ? 'd' : 'b';
        });
        P.on('neck').box(-1, 1, 8, 10, 1, 2, 'b');                               /* the neck from the withers */
        /* the long face: a brow with the eyes either side of a white blaze running down to a white
           muzzle, which juts out under the eyes (it stays clear of the chest, where neck pieces hang) */
        shape(h, -2, 2, 9, 12, 3, 6, { t: 1, b: 1, k: 1 }, 'b');
        h.box(0, 0, 10, 12, 6, 6, 'l');
        shape(h, -1, 1, 8, 9, 4, 7, { b: 1, k: 1 }, 'l');
        h.set(0, 9, 7, 'n');                                                     /* the pink nose */
        P.sides(function (s, L) {
          h.box(2 * s, 2 * s, 13, 13, 4, 5, 'd');                                /* a rounded horn nub at the crown's edge */
          P.on('ear' + L).box(3 * s, 4 * s, 12, 12, 4, 5, 'b').box(5 * s, 5 * s, 11, 11, 4, 5, 'b');     /* long ears held out sideways, the tips drooping */
        });
        P.on('tail').box(0, 0, 7, 8, -5, -5, 'b');                               /* short and upturned, a white tip */
        P.on('tailTip').set(0, 9, -5, 'l');
      } },

    /* ---- Castle: the peacock ---- */
    pet_peacock: { rows: 15, topY: 0.85, biped: true, bodyY: 0.34, wingRest: 0, tailUp: false,
      joints: { body: [0, 5, -0.5], neck: [0, 7.5, 1.5], head: [0, 9.5, 1.5], earL: [1, 13, 1], tail: [0, TRAIN.row, TRAIN.hinge],
        tailTip: [0, TRAIN.row, TRAIN.hinge - TRAIN.tipFrom], legFL: [1.5, 1.5, 1], legBL: [1.6, 2.3, 0], wingL: [2.5, 7, -0.5] },
      sockets: { hat: [[0, 12.5, 1], 5, 3, { earsUp: true }], face: [[0, 10.5, 3.5], 3, 4, { earsUp: true }], neck: [[0, 8, 1.5], 3, 2],
        back: [[0, 7.5, -2], 3, 3, { wings: true }], seat: [[0, 2.5, -1], 3, 4] },
      eyes: { i: 1, j: 10, k: 3 }, cheeks: [[1, 9, 3]], spark: [0, 16, 1],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), i, d, k, w;
        /* an egg of a body, flat across the back for a back piece, rounded under */
        shape(b, -2, 2, 3, 7, -3, 2, { s: 1, b: 2, k: 1, f: 1 }, 'b');
        P.on('neck').box(-1, 1, 8, 8, 1, 2, 'b');
        /* a round-cornered head: a white face patch round the eyes, the beak under them */
        shape(h, -2, 2, 9, 12, 0, 3, { s: 1, f: 1 }, 'b');
        h.box(-1, 1, 10, 11, 3, 3, 'l');
        h.set(0, 9, 4, 'n');
        /* the crest: three pale stalks fanning to blue tips (left out under a hat, which would bury it) */
        if (!P.acc.hat) h.box(-1, 1, 13, 13, 1, 1, 'l').set(-2, 14, 1, 'b').set(0, 14, 1, 'b').set(2, 14, 1, 'b');
        P.sides(function (s, L) {
          P.on('wing' + L).box(3 * s, 3 * s, 4, 6, -2, 1, function (i2, j2, k2) { return j2 === 4 && k2 === 1 ? null : 'd'; });
          P.on('legB' + L).box(s, s, 1, 2, 0, 0, 'n').box(s, 2 * s, 0, 0, -1, 1, 'n');
        });
        /* the train: a flat half-disc behind the rump at the back's height; gold eye spots, blue centres */
        var spot = {}, top = { tail: P.top('tail'), tailTip: P.top('tailTip') };
        TRAIN.spots.forEach(function (p, n) { spot[p[0] + ',' + p[1]] = n; });
        for (d = 0; d < TRAIN.depth; d++) {
          k = Math.round(TRAIN.hinge - 0.5 - d); w = TRAIN.rows[d];
          var bone = d < TRAIN.tipFrom ? 'tail' : 'tailTip', g = P.on(bone);
          for (i = -w; i <= w; i++) {
            var n = spot[i + ',' + k];
            g.set(i, TRAIN.row, k, n == null ? 'd' : 'n');
            if (n != null) top[bone].set(2 * i, 4 * TRAIN.row + 3, 2 * k, n < TRAIN.core ? 'b' : 'q');
          }
        }
      } },

    /* ---- Ice: the reindeer calf ---- */
    pet_reindeer: { rows: 16, topY: 0.86, biped: false, bodyY: 0.33, wingRest: 0, tailUp: true,
      joints: { body: [0, 6.5, -1], neck: [0, 8.5, 1.5], head: [0, 11, 4.5], earL: [2.5, 12, 4], tail: [0, 8.5, -4.5], tailTip: [0, 8.5, -5],
        legFL: [1.5, 4.5, 1.5], legBL: [1.5, 4.5, -3.5], wingL: [2.5, 8, -1] },
      sockets: { hat: [[0, 12.5, 5], 5, 3, { horns: true }], face: [[0, 10.5, 6.5], 3, 4, { horns: true }], neck: [[0, 9, 1.5], 3, 2],
        back: [[0, 8.5, -2.5], 5, 4], seat: [[0, 4.5, -2], 5, 4] },
      eyes: { i: 1, j: 10, k: 6 }, cheeks: [[2, 10, 6]], spark: [0, 17.5, 4.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        canterLegs(P, 'n', 'd');                                                 /* dark legs, darker hooves */
        /* the barrel: a cream belly, a cream rump patch, a cream bib at the chest */
        shape(b, -2, 2, 5, 8, -4, 2, { s: 1, b: 1, k: 1, f: 1 }, function (i, j, k) {
          if (j === 5 && Math.abs(i) <= 1 && k > -4 && k < 2) return 'l';
          if (k === -4 && j >= 6 && Math.abs(i) <= 1) return 'l';
          return k === 2 && j >= 7 && Math.abs(i) <= 1 ? 'l' : 'b';
        });
        /* the neck with its cream ruff down the front */
        P.on('neck').box(-1, 1, 9, 11, 1, 2, function (i, j, k) { return k === 2 ? 'l' : 'b'; });
        /* the long face: the brow, a pale muzzle below it with the dark nose (never red) */
        shape(h, -2, 2, 10, 12, 3, 6, { t: 1, k: 1 }, 'b');
        shape(h, -1, 1, 8, 9, 4, 7, { b: 1, k: 1 }, 'l');
        h.set(0, 9, 7, 'n');
        P.sides(function (s, L) {
          /* a short velvety antler at the crown's edge: a stem, then one fork opening outwards */
          h.box(2 * s, 2 * s, 13, 15, 4, 4, 'd').set(3 * s, 14, 4, 'd').set(4 * s, 15, 4, 'd');
          P.on('ear' + L).box(3 * s, 4 * s, 12, 12, 4, 4, 'b');                  /* small ears held out, pale inside */
          dot(P.fine('ear' + L), 3 * s, 12, 4, 'l');
        });
        P.on('tail').box(0, 0, 7, 8, -5, -5, 'l');                               /* the white tuft */
      } },

    /* ---- Ice: the snow leopard cub ---- */
    pet_snowleopard: { rows: 12, topY: 0.68, biped: false, bodyY: 0.25, wingRest: 0, tailUp: false,
      joints: { body: [0, 4.5, -1], neck: [0, 5.5, 2], head: [0, 7, 3], earL: [2.5, 10.5, 2.5], tail: [0, 4.5, -4.5], tailTip: [0, 4.5, -9.5],
        legFL: [1.5, 2.5, 1.5], legBL: [1.5, 2.5, -3.5], wingL: [2.5, 6, -1] },
      sockets: { hat: [[0, 10.5, 3.5], 5, 4, { earsUp: true }], face: [[0, 8.5, 6.5], 5, 4, { earsUp: true }], neck: [[0, 5, 3.5], 5, 4],
        back: [[0, 6.5, -2], 5, 5], seat: [[0, 2.5, -2], 5, 4] },
      eyes: { i: 2, j: 8, k: 6 }, cheeks: [[2, 7, 6]], spark: [0, 12.5, 3.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), k;
        /* short legs on big white paws (each paw reaches a voxel forward) */
        [['legFL', 1, 1], ['legFR', -2, 1], ['legBL', 1, -4], ['legBR', -2, -4]].forEach(function (L) {
          P.on(L[0]).box(L[1], L[1] + 1, 1, 2, L[2], L[2] + 1, 'b').box(L[1], L[1] + 1, 0, 0, L[2], L[2] + 2, 'l');
        });
        /* the body, a white belly; broken-ring rosettes in slate on the back and both sides */
        b.box(-2, 2, 3, 6, -4, 2, function (i, j, k2) {
          return Math.abs(i) === 2 && k2 === -4 && (j === 3 || j === 6) ? null : j === 3 && Math.abs(i) < 2 && k2 > -4 && k2 < 2 ? 'l' : 'b';
        });
        [[2, 5, -3], [2, 5, -2], [2, 4, -3], [2, 5, 0], [2, 4, 0], [2, 4, 1], [-2, 5, -2], [-2, 4, -2], [-2, 5, -1], [-2, 5, 1], [-2, 4, 1], [-2, 4, 0],
          [-1, 6, -3], [0, 6, -3], [-1, 6, -2], [1, 6, -1], [1, 6, 0], [0, 6, 0], [0, 6, -4], [1, 6, -4], [1, 6, -3]].forEach(function (c) { b.set(c[0], c[1], c[2], 'd'); });
        /* a round head: a white muzzle with the pink nose on it, a few spots on the crown */
        h.box(-3, 3, 5, 10, 1, 6, function (i, j, k2) {
          return (Math.abs(i) === 3) + (j === 5 || j === 10) + (k2 === 1 || k2 === 6) >= 2 ? null : 'b';
        });
        h.box(-1, 1, 6, 7, 6, 6, 'l').box(-1, 1, 6, 6, 7, 7, 'l').set(0, 7, 7, 'n');
        [[-2, 10, 3], [1, 10, 4], [-1, 10, 2], [2, 10, 2]].forEach(function (c) { h.set(c[0], c[1], c[2], 'd'); });
        P.sides(function (s, L) {
          /* small round ears on the crown's corners, dark at the back */
          P.on('ear' + L).box(2 * s, 2 * s, 11, 11, 2, 3, function (i, j, k2) { return k2 === 2 ? 'd' : 'b'; })
            .box(3 * s, 3 * s, 10, 11, 2, 3, function (i, j, k2) { return k2 === 2 ? 'd' : 'b'; });
        });
        /* the long thick tail held out behind: dark rings, then the tip curls up dark */
        var T = P.on('tail'), TT = P.on('tailTip');
        for (k = -5; k >= -9; k--) { var c = k === -6 || k === -8 ? 'd' : 'b'; T.box(-1, 1, 4, 4, k, k, c).set(0, 5, k, c); }
        TT.box(-1, 1, 4, 4, -10, -10, 'b').set(0, 5, -10, 'b').box(-1, 1, 4, 4, -11, -11, 'd').set(0, 5, -11, 'd')
          .box(0, 0, 6, 7, -11, -11, 'd');
      } }
  };
  /* the peacock's eye-spot centres: three on every tier, four more on MID / HIGH */
  var EXTRA = { pet_peacock: { q: { token: 'PETCOL3.pet_peacock.body', lod: 'mid' } } };

  /* bone origins: every v2 bone and cape0–2 (root-frame voxel coordinates → u) */
  function jointsOf(S) {
    var e = S.eyes, f = S.sockets.face[0], hat = S.sockets.hat[0], back = S.sockets.back[0], neck = S.sockets.neck[0];
    var J = { base: [0, -0.5, 0], eyes: [0, e.j + 0.5, e.k + 0.5], lens: f.slice(), glint: [1, hat[1] + 0.5, hat[2]], spark: S.spark.slice(),
      scarfTail: [1, neck[1] - 0.5, neck[2] + 2], scan: [0, e.j + 0.5, hat[2]],
      cape0: [0, back[1], back[2] + 1], cape1: [0, back[1], back[2]], cape2: [0, back[1], back[2] - 1] }, k, out = {};
    for (k in S.joints) J[k] = S.joints[k];
    J.blush = J.head.slice(); J.nightH = J.head.slice();
    ['ear', 'legF', 'legB', 'wing'].forEach(function (n) { if (!J[n + 'R']) J[n + 'R'] = [-J[n + 'L'][0], J[n + 'L'][1], J[n + 'L'][2]]; });
    for (k in J) out[k] = u3(J[k]);
    return out;
  }
  function sockOf(bone, e) { return { bone: bone, v: e[0].slice(), at: u3(e[0]), w: e[1], d: e[2], flags: e[3] || {} }; }
  var SOCKET_BONE = { hat: 'head', neck: 'neck', face: 'head', back: 'body', seat: 'body' };
  function socketsOf(S) {
    var out = {};
    Object.keys(SOCKET_BONE).forEach(function (s) { out[s] = sockOf(SOCKET_BONE[s], S.sockets[s]); });
    return out;
  }

  /* a species in an outfit → {bone: VoxModel} in the root frame (px-characters' row.voxels) */
  function speciesVoxels(id, acc, ctx) {
    var S = DEF[id];
    if (!S) return null;
    var p = 'PETCOL3.' + id + '.', pal = { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye',
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' } }, g = {}, f = {}, t = {}, c, out = {};
    for (c in EXTRA[id] || {}) pal[c] = EXTRA[id][c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
      top: function (bone) { return t[bone] || (t[bone] = topFine()); },
      sides: function (fn) { fn(1, 'L'); fn(-1, 'R'); }
    };
    S.build(P);
    var e = S.eyes, ch = S.cheeks;
    P.sides(function (s) {
      eye(P.fine('eyes'), s * e.i, e.j, e.k, !(ctx && ctx.covered));
      ch.forEach(function (q) { dot(P.fine('blush'), s * q[0], q[1], q[2], 'k'); });
    });
    g.spark = stars(u3(S.spark));
    Object.keys(g).concat(Object.keys(f)).forEach(function (bone) {
      if (out[bone]) return;
      var m = (g[bone] || f[bone]).model({ id: id + ':' + bone, palette: pal, ground: false, ao: false });
      if (!g[bone]) m.layers[0].at = [0, 0, PROUD - GC / 4];
      else if (f[bone]) m.layers.push({ vox: f[bone].snapshot(), at: [0, 0, PROUD - GC / 4] });
      if (g[bone] && t[bone]) m.layers.push({ vox: t[bone].snapshot(), at: [0, PROUD, 0] });
      out[bone] = m;
    });
    return out;
  }

  /* the rows of SLPxCharacters.SPECIES */
  var ROWS = {};
  IDS.forEach(function (id) {
    var S = DEF[id], e = S.eyes;
    ROWS[id] = { h: S.rows * GC, topY: S.topY, biped: S.biped, bodyY: S.bodyY, wingRest: S.wingRest, tailUp: S.tailUp,
      joints: jointsOf(S), sockets: socketsOf(S),
      eyes: [[e.i, e.j, e.k], [e.i, e.j + 1, e.k], [-e.i, e.j, e.k], [-e.i, e.j + 1, e.k]],
      voxels: function (acc, ctx) { return speciesVoxels(id, acc, ctx); } };
  });

  /* put the four rows in the open table (again, if the table lost one; a table that is not there
     yet is filled on the next call: when the factory runs, or when a test hands the module over)
     → how many were added */
  function register(PC) {
    PC = PC || chars();
    if (!PC || !PC.SPECIES || typeof PC.defineSpecies !== 'function') return 0;
    var n = 0;
    IDS.forEach(function (id) { if (PC.SPECIES[id] !== ROWS[id] && PC.defineSpecies(id, ROWS[id])) n++; });
    return n;
  }

  /* the display model (photocards, coverage): px-characters' displayVoxels for this species */
  var voxels = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st, ctx) { var PC = chars(); register(PC); return PC ? PC.displayVoxels(id, st, ctx) : null; };
  });

  /* SL3D.defineVox('pets-c', factory): the four vox handlers; the 'portrait:<pet>' cells (D76) on
     this hub's atlas (a row registered after the characters factory ran is drawn here) */
  function factory(K) {
    var PC = chars(), out = {};
    if (!PC) return out;
    register(PC);
    IDS.forEach(function (id) {
      if (PC.SPECIES[id] !== ROWS[id]) return;
      out[id] = typeof PC.handler === 'function' ? PC.handler(id) : { voxels: voxels[id] };
      if (typeof PC.definePortrait === 'function') PC.definePortrait(K, id);
    });
    return out;
  }

  return {
    VERSION: VERSION, GC: GC, IDS: IDS, ROWS: ROWS, SOCKET_BONE: SOCKET_BONE, TRAIN: TRAIN,
    speciesVoxels: speciesVoxels, voxels: voxels, register: register, fill: register, factory: factory
  };
}));
