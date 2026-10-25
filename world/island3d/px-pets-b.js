/* ================================================================
   My Island v3 — SLPxPetsB (kids update P2.2): five new land pets as voxel rigs — the flamingo
   (Theme Park Pier), the sloth and the toucan (Jungle Treehouse Village), the red panda and the
   hedgehog (Treetop Adventure Park).
   window.SLPxPetsB + SL3D.defineVox('pets-b', factory) in the browser, module.exports in Node:
   {IDS, ROWS, DEF, PORTRAITS, voxels: {<id>: fn(st, ctx) → VoxModel}, speciesVoxels(id, acc, ctx),
   register(PC) (= fill) → n registered, factory(K) → {id: handler}}.

   THE OPEN TABLE (D95, D96; pets.json P2). Each species is a row of SLPxCharacters.SPECIES,
   registered with defineSpecies when this file loads (so the portrait is drawn on every atlas
   already bound) and again by register / the factory if the table lost it (first wins: a row
   that is there already is left alone). makeRig, the display models, sockets, photocards and the
   'portrait:<pet>' atlas cells read the row; nothing here builds a THREE object. Voxels are pure
   data on the crew grid GC 0.05 u in the ROOT frame of px-characters (voxel (i, j, k) is centred
   on x = i·GC, z = k·GC and stands on y = j·GC; the pet faces +z, its left is +x). No THREE, no
   DOM, no random numbers (the same input gives the same model), no ink hulls; one colour per
   voxel, palette tokens only: each species' own PETCOL3 parts (D107; world-look's PETCOL3, which
   P1.3 retuned so each body reads against its land's ground) plus the shared eye ink, glint,
   blush and dizzy stars. Nothing is darker than PX Ink Eye. Nothing here reads, awards or spends
   points.

   THE FIVE (pets.json catalogue.new[].look and .avoid; the same eye as every pet: two voxels
   tall, a glint in its upper corner, blush under it; each face keeps a light part beside its
   eyes so they read at island scale, lookNotes.crisp):
     pet_flamingo  biped on two long thin pink legs (the hips 0.22 u up: rigs.gaitOverrides
                   GAIT_GEOM_SPECIES.pet_flamingo, feet at x ±0.05 with heel and toe at z ±0.05),
                   a round pink body with darker wing coverts and ink-tipped flight feathers on
                   wingL / wingR, a short dark tail tuft, an S-curved neck on the neck bone (three
                   stacked offsets), a small head with pale lores between wide-set eyes and a bent
                   beak, pale at the base and dark at the tip, hooking down; the tallest pet
                   (0.8 u to the crown). No sunglasses or float of its own (those are accessories).
     pet_sloth     low and shaggy: a fawn body with a ragged fringe, long front arms a voxel longer
                   than the back legs with broad paws and three cream claws each (fine inlays, every
                   tier), a round head set forward with a pale face mask, the three-toed sloth's dark
                   eye stripes running back from the eyes, a small dark nose and a closed smile
                   (lod 'mid'); no tail, no ears. Never a ground sloth, no acorn.
     pet_toucan    biped, an upright charcoal-navy pear (never pure black) with a big cream bib up to
                   the throat, orange bare skin round the eyes, an outsized plain orange beak (5
                   voxels long, 3 tall) with a dark tip below the eyes, short dark wings, a short
                   square tail; dark feet on legBL / legBR. Never a striped rainbow beak.
     pet_redpanda  small and round (cub proportions): a russet back and head, a white face mask
                   (muzzle, cheeks and brows) with russet tear marks under the eyes, pointed ears
                   with white fronts, dark legs and belly, and a thick tail of four pale rings that
                   rises behind on tail / tailTip (upright: it wags like a wiper). No human faces.
     pet_hedgehog  a dome of spines in staggered rows — brown and dark-brown bands, the outer rows
                   tipped pale (rows, never single spikes at the camera) — a cream face on its own
                   spiny-capped head, a pointed snout with a dark button nose, small round ears and
                   short legs. Its back socket is the flat top of the dome (flag spines: back pieces
                   sit on top). Brown and cream only, never blue, no shoes, never upright.
   Every v2 bone exists (empty bones are allowed), so every clip samples without branching; the
   gaits (waddle for the two birds, trot for the rest), pace and the flamingo's long-leg contact
   geometry are the clip layer's (models-characters.js, P2.4). What a worn piece would bury is
   left out: the hedgehog's crown spines under a hat, its top tips under a back piece.

   SOCKETS (D96; the v of px-characters: an integer is a voxel centre, .5 a face): hat = the
   middle of the crown's top face (w × d = the flat of the crown; earsUp where the red panda's
   ears stand at its sides), face = between the eyes on the face plane (w = the span of the eyes),
   neck = the centre of the ring row under the head (w × d = what the ring wraps: the flamingo's
   lowest neck segment, the head's lowest row on the others; noNeck on the hedgehog), back = the
   middle of the free deck behind the head, which ends flush with the back so a cape's hem hangs
   down it (wings on the two birds, spines on the hedgehog), seat = under the rump.
   Budgets (D108): ≤ 750 tris bare on every tier, ≤ 1,400 with one piece per slot at its cap, one
   draw. LOW drops the lod 'mid' inlay (the sloth's smile).
   Portraits (D76, 12 × 12): drawn from the head voxels, hand rows for the flamingo (its neck and
   bent beak) and the toucan (its beak seen end-on).
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPetsB = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('pets-b', api.factory);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPetsB: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC === 'object' && PC.SPECIES && typeof PC.defineSpecies === 'function' ? PC : null; }

  var VERSION = 1, GC = 0.05, PROUD = 0.004;
  var IDS = ['pet_flamingo', 'pet_sloth', 'pet_toucan', 'pet_redpanda', 'pet_hedgehog'];

  /* ---------------- building blocks (pure; the conventions of px-characters) ---------------- */
  function u3(v) { return [v[0] * GC, (v[1] + 0.5) * GC, v[2] * GC]; }
  function grid() { return vox().grid({ grid: GC }); }
  /* the face layer: half-voxel pixels a quarter voxel deep, PROUD of the face (GC column i = fine
     columns 2i, 2i + 1; row j = 2j, 2j + 1; the front of GC voxel k = fine layer 4k + 2) */
  function fine() { return vox().grid({ grid: [GC / 2, GC / 2, GC / 4], origin: [1, 0, 0] }); }
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
     faces is cut min(bev) voxels deep, or bev[pair] when it is given (st: 0 keeps the side-top
     edges square). c: char | fn(i, j, k) → char | null */
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
  /* rows of a footprint: R {j: [halfWidth, k0, k1]} — a rounded solid built a row at a time */
  function rows(o, R, c) {
    Object.keys(R).forEach(function (j) {
      var r = R[j], y = +j;
      o.box(-r[0], r[0], y, y, r[1], r[2], function (i, jj, k) { return typeof c === 'function' ? c(i, y, k, r) : c; });
    });
    return o;
  }
  function mid(token) { return { token: token, lod: 'mid' }; }    /* a detail the LOW tier drops */

  /* ================================================================
     THE FIVE SPECIES
     Each: rows (to the crown), topY, biped, bodyY (u: the centre whole-body turns pivot on),
     wingRest (deg), tailUp, joints (voxel coords, → u3), sockets {slot: [v, w, d, flags?]}, eyes
     {i, j, k} (the cells of the two eyes: ±i, rows j..j + 1, on the face of voxel k), cheeks
     [[i, j, k]] (blush, mirrored), spark (the dizzy ring's centre), build(P). P.on(bone) is that
     bone's GC grid, P.fine(bone) its inlay layer, P.acc the outfit {slot: id}, P.sides(fn(s, L)).
     Palette b body · d dark · l light · n nose (PETCOL3.<id>.<part>) · e eye · g glint · k blush ·
     s star (+ m: a lod 'mid' inlay in the nose colour).
     ================================================================ */
  var DEF = {
    /* ---- Pier: the flamingo — 9 wide with its wings, 16 tall, 11 deep with the beak ---- */
    pet_flamingo: { rows: 16, topY: 0.92, biped: true, bodyY: 0.42, wingRest: 0, tailUp: false,
      joints: { body: [0, 6, -1], neck: [0, 8.5, 1.5], head: [0, 12, 1.5], earL: [2, 14, 1.5], tail: [0, 7.5, -4.5], tailTip: [0, 8.5, -5.5],
        legFL: [1.5, 5, 1], legBL: [1, 3.9, 0], wingL: [3.5, 7.5, 0] },
      sockets: { hat: [[0, 15.5, 1.5], 5, 2], face: [[0, 13.5, 3.5], 5, 4], neck: [[0, 9, 1.5], 3, 2],
        back: [[0, 8.5, -2], 5, 3, { wings: true }], seat: [[0, 3.5, -1], 5, 4] },
      eyes: { i: 2, j: 13, k: 3 }, cheeks: [[1, 12, 2]], spark: [0, 17.5, 1.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), n = P.on('neck');
        /* the body: a round egg carried level, its tail end tapering up into a dark tuft; the top
           behind the neck is the deck a back piece lies on */
        shape(b, -3, 3, 4, 8, -4, 2, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        /* the S-curved neck: three stacked offsets (forward, back, forward), the lowest filling the
           body's front shoulder where a ring wraps it */
        n.box(-1, 1, 8, 8, 2, 2, 'b').box(-1, 1, 9, 9, 1, 2, 'b');
        n.box(0, 0, 10, 10, 0, 1, 'b').box(0, 0, 11, 11, 1, 2, 'b');
        /* a small head: square at the face's sides so the eyes sit wide on its front corners, pale
           lores between them; the bent beak, pale at the base, hooks down to a dark tip */
        shape(h, -2, 2, 12, 15, 0, 3, { s: 1, b: 1, t: 1, k: 1, f: 1, st: 0, sf: 0 }, 'b');
        h.box(-1, 1, 13, 14, 3, 3, 'l');
        h.box(0, 0, 12, 12, 3, 5, 'l').box(0, 0, 10, 11, 5, 5, 'n');
        P.sides(function (s, L) {
          /* darker coverts folded on the sides, the flight feathers' ink tips at the back */
          P.on('wing' + L).box(4 * s, 4 * s, 5, 7, -3, 0, function (i, j, k) { return j === 5 && k === 0 ? null : 'd'; })
            .box(4 * s, 4 * s, 6, 7, -4, -4, 'n');
          /* a long thin leg straight under the hip and a webbed foot, heel to toe */
          P.on('legB' + L).box(s, s, 1, 3, 0, 0, 'd').box(s, s, 0, 0, -1, 1, 'd');
        });
        P.on('tail').box(-1, 1, 7, 8, -5, -5, 'd');
        P.on('tailTip').set(0, 9, -5, 'd');
      } },

    /* ---- Jungle: the sloth — 13 wide with its splayed arms, 10 tall to its tuft, 10 deep ---- */
    pet_sloth: { rows: 10, topY: 0.62, biped: false, bodyY: 0.2, wingRest: 0, tailUp: false,
      joints: { body: [0, 4, -1.5], neck: [0, 4.5, 0.5], head: [0, 5.5, 2.5], earL: [3, 7, 3], tail: [0, 4, -4.5], tailTip: [0, 4, -5.5],
        legFL: [3.5, 4, 0.5], legBL: [2.5, 1.5, -3.5], wingL: [3.5, 5, -1.5] },
      sockets: { hat: [[0, 8.5, 3], 5, 3], face: [[0, 6.5, 5.5], 5, 4], neck: [[0, 4, 3], 5, 3],
        back: [[0, 6.5, -2], 5, 3], seat: [[0, 1.5, -2], 5, 3] },
      eyes: { i: 2, j: 6, k: 5 }, cheeks: [[2, 5, 5]], spark: [0, 11.5, 3],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), f = P.fine('head');
        /* a long, low, shaggy body, rounded at the rump, a ragged fringe of fur along its sides and
           a few darker streaks */
        shape(b, -3, 3, 2, 6, -4, 0, { s: 1, b: 1, t: 1, k: 2, f: 1 }, 'b');
        P.sides(function (s) { [-3, -1].forEach(function (k) { b.set(3 * s, 1, k, 'b'); }); b.set(3 * s, 5, -2, 'd').set(3 * s, 4, -1, 'd').set(3 * s, 3, -3, 'd'); });
        /* the round head held low at the front: the pale face mask, the dark stripes running back
           from the eyes, a small dark nose, a closed smile (MID / HIGH) and a tuft on the crown
           (a hat sits there instead) */
        shape(h, -3, 3, 4, 8, 1, 5, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        h.box(-2, 2, 5, 7, 5, 5, function (i, j) { return Math.abs(i) === 2 && j === 7 ? 'b' : 'l'; });
        h.box(-1, 1, 4, 4, 5, 5, 'l').set(0, 5, 5, 'n');
        P.sides(function (s) { h.box(3 * s, 3 * s, 6, 7, 3, 4, 'd'); h.set(3 * s, 6, 2, 'd'); });
        f.box(0, 1, 8, 8, 22, 22, 'm').set(-1, 9, 22, 'm').set(2, 9, 22, 'm');
        if (!P.acc.hat) h.set(-1, 9, 3, 'b').box(0, 0, 9, 9, 2, 3, 'b').set(1, 9, 2, 'b');
        /* long arms reaching out and down from the shoulders to broad paws, three cream claws on
           each; short back legs splayed under the rump, dark feet */
        P.sides(function (s, L) {
          var a = P.on('legF' + L), c = P.fine('legF' + L);
          a.box(3 * s, 4 * s, 3, 4, 0, 1, 'b').box(4 * s, 5 * s, 1, 2, 0, 1, 'b').box(4 * s, 6 * s, 0, 0, 0, 1, 'b');
          [4, 5, 6].forEach(function (i) { var x = s > 0 ? 2 * i : -2 * i + 1; c.box(x, x, 0, 1, 6, 6, 'l'); });
          P.on('legB' + L).box(2 * s, 3 * s, 1, 1, -4, -3, 'b').box(3 * s, 4 * s, 0, 0, -4, -3, 'd');
        });
      } },

    /* ---- Jungle: the toucan — 9 wide, 12 tall, 14 deep with the beak and tail ---- */
    pet_toucan: { rows: 12, topY: 0.72, biped: true, bodyY: 0.25, wingRest: 0, tailUp: false,
      joints: { body: [0, 3, -1], neck: [0, 6, 1], head: [0, 8, 1], earL: [2, 11, 1], tail: [0, 2.5, -4.5], tailTip: [0, 1.5, -5.5],
        legFL: [1.5, 1.5, 1], legBL: [1.5, 1, 0], wingL: [4, 5, -1] },
      sockets: { hat: [[0, 11.5, 1], 5, 3], face: [[0, 9.5, 3.5], 5, 4], neck: [[0, 6, 1], 5, 3],
        back: [[0, 5.5, -2.5], 5, 2, { wings: true }], seat: [[0, 0.5, -1], 5, 4] },
      eyes: { i: 2, j: 9, k: 3 }, cheeks: [[2, 8, 3]], spark: [0, 13.5, 1],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), n = P.on('neck');
        /* the pear: a round body, the big cream bib down its front, square across the back */
        shape(b, -3, 3, 1, 5, -4, 2, { s: 2, b: 2, t: 1, k: 1, f: 1 }, function (i, j, k) { return k >= 1 && j >= 2 && Math.abs(i) <= 2 ? 'l' : 'b'; });
        n.box(-2, 2, 6, 6, 0, 2, function (i, j, k) { return k === 2 ? 'l' : 'b'; });
        /* the head: dark crown and nape, cream throat, orange bare skin round each eye */
        shape(h, -3, 3, 7, 11, -1, 3, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        h.box(-2, 2, 8, 8, 3, 3, 'l');
        P.sides(function (s) { h.box(3 * s, 3 * s, 8, 8, 1, 2, 'l').box(3 * s, 3 * s, 9, 10, 1, 2, 'n'); });
        /* the beak: plain orange, five voxels long and three tall, below the eyes, a dark tip */
        h.box(-1, 1, 6, 7, 3, 3, 'n');
        h.box(-1, 1, 6, 8, 4, 7, function (i, j, k) { return j === 8 && k === 7 ? null : 'n'; });
        h.box(-1, 1, 6, 7, 8, 8, 'd');
        P.sides(function (s, L) {
          P.on('wing' + L).box(4 * s, 4 * s, 2, 4, -3, 0, function (i, j, k) { return j === 2 && k === 0 ? null : 'd'; });
          P.on('legB' + L).box(s, 2 * s, 0, 0, -1, 1, 'd').set(s, 1, 0, 'd');
        });
        P.on('tail').box(-1, 1, 2, 3, -5, -5, 'd');
        P.on('tailTip').box(-1, 1, 1, 2, -6, -6, 'd');
      } },

    /* ---- Treetop: the red panda — 7 wide, 11 tall to the ears, 13 deep with the tail ---- */
    pet_redpanda: { rows: 11, topY: 0.68, biped: false, bodyY: 0.22, wingRest: 0, tailUp: true,
      joints: { body: [0, 4.5, -1.5], neck: [0, 4.5, 1], head: [0, 6, 3], earL: [2.5, 9, 3.5], tail: [0, 4.5, -4.5], tailTip: [0, 6.5, -5.5],
        legFL: [1.5, 2.5, 0.5], legBL: [1.5, 2.5, -3.5], wingL: [2.5, 5.5, -1.5] },
      sockets: { hat: [[0, 8.5, 3.5], 5, 4, { earsUp: true }], face: [[0, 6.5, 6.5], 5, 4, { earsUp: true }], neck: [[0, 4, 3], 5, 3],
        back: [[0, 6.5, -2], 5, 3], seat: [[0, 2.5, -2], 5, 3] },
      eyes: { i: 2, j: 6, k: 6 }, cheeks: [[3, 5, 5]], spark: [0, 12.5, 3],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* four short dark legs; a round russet body with a dark belly */
        [['legFL', 1, 0], ['legFR', -2, 0], ['legBL', 1, -4], ['legBR', -2, -4]].forEach(function (L) {
          P.on(L[0]).box(L[1], L[1] + 1, 0, 2, L[2], L[2] + 1, 'd');
        });
        shape(b, -2, 2, 3, 6, -4, 0, { s: 1, b: 1, t: 1, k: 1, f: 1, st: 0 }, function (i, j) { return j === 3 ? 'd' : 'b'; });
        /* a big round head: the white mask (muzzle, cheeks, brows) with russet tear marks under the
           eyes, a short pale snout with a dark nose */
        shape(h, -3, 3, 4, 8, 1, 6, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        h.box(-1, 1, 4, 5, 6, 6, 'l').box(-1, 1, 4, 4, 7, 7, 'l').set(0, 5, 7, 'n');
        P.sides(function (s) { h.box(3 * s, 3 * s, 4, 6, 5, 5, 'l').box(2 * s, 2 * s, 8, 8, 5, 5, 'l'); });
        /* pointed ears, white in front */
        P.sides(function (s, L) {
          P.on('ear' + L).box(2 * s, 3 * s, 9, 9, 3, 4, function (i, j, k) { return k === 4 ? 'l' : 'b'; }).set(3 * s, 10, 3, 'b').set(3 * s, 10, 4, 'l');
        });
        /* the thick ringed tail: back from the rump, then up behind, four pale rings */
        function ring(i, j) { return j % 2 ? 'l' : 'b'; }
        P.on('tail').box(-1, 1, 3, 5, -5, -6, ring);
        P.on('tailTip').box(-1, 1, 6, 9, -6, -5, function (i, j, k) { return Math.abs(i) === 1 && j === 9 ? null : ring(i, j); });
      } },

    /* ---- Treetop: the hedgehog — 7 wide, 7 tall, 12 deep with the snout ---- */
    pet_hedgehog: { rows: 7, topY: 0.46, biped: false, bodyY: 0.17, wingRest: 0, tailUp: false,
      joints: { body: [0, 3, -1.5], neck: [0, 2, 1.5], head: [0, 3, 2.5], earL: [3, 4.5, 2], tail: [0, 2, -4.5], tailTip: [0, 2, -5.5],
        legFL: [1.5, 1, 1], legBL: [1.5, 1, -3], wingL: [3.5, 3.5, -1.5] },
      sockets: { hat: [[0, 5.5, 3], 5, 3], face: [[0, 3.5, 4.5], 5, 3], neck: [[0, 2, 3], 5, 3, { noNeck: true }],
        back: [[0, 6.5, -2], 3, 3, { spines: true }], seat: [[0, 0.5, -2], 5, 3] },
      eyes: { i: 2, j: 3, k: 4 }, cheeks: [[2, 2, 4]], spark: [0, 8.5, 2.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* the dome of spines, a row at a time: brown and dark-brown bands; the bands that stand out
           a voxel are tipped pale at their rim (staggered rows, no single spikes) */
        /* the dome as columns: H0 the smooth height over (|i|, |k + 2|); every other column in a row
           stands a voxel proud (the stagger shifts a column each row), so the spines lie in rows
           like a pine cone's scales; the deck on top (i ±1, k −3..−1) stays flat */
        var H0 = [[6, 6, 5, 4], [6, 6, 5, 4], [5, 5, 4, 3], [4, 4, 3, 2]];
        for (var i = -3; i <= 3; i++) for (var k = -5; k <= 1; k++) {
          var a = Math.abs(i), c = Math.abs(k + 2), deck = a <= 1 && c <= 1, up = !deck && (k + a + 11) % 2 === 0;
          var top = Math.min(6, H0[a][c] + (up ? 1 : 0)), lo = a === 3 || c === 3 ? 2 : 1;
          for (var j = lo; j <= top; j++) {
            var tip = j === top && up && (i + k + 9) % 3 === 0;
            b.set(i, j, k, tip && !(P.acc.back && top === 6) ? 'l' : j === top && up ? 'b' : j >= top - 1 && (i + 9) % 2 ? 'b' : 'd');
          }
        }
        /* the head in front of the dome: a cream face with a spiny cap (under a hat it lies flat),
           the pointed snout and a dark button nose; small round ears at its sides */
        h.box(-2, 2, 1, 4, 2, 4, function (i, j) { return Math.abs(i) === 2 && j === 1 ? null : 'l'; });
        h.box(-2, 2, 5, 5, 2, 4, function (i) { return i % 2 ? 'b' : 'd'; });
        if (!P.acc.hat) h.box(-1, 1, 6, 6, 2, 3, function (i) { return i % 2 ? 'd' : 'b'; });
        h.box(-1, 1, 1, 2, 5, 5, 'l').set(0, 2, 6, 'l').set(0, 2, 7, 'n');
        P.sides(function (s, L) {
          P.on('ear' + L).set(3 * s, 4, 2, 'd');
          P.on('legF' + L).box(s, 2 * s, 0, 0, 1, 2, 'd');
          P.on('legB' + L).box(s, 2 * s, 0, 0, -3, -2, 'd');
        });
      } }
  };
  /* inlays only the MID / HIGH tiers draw */
  var EXTRA = {
    pet_sloth: { m: mid('PETCOL3.pet_sloth.nose') }
  };

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
  var SOCKET_BONE = { hat: 'head', neck: 'neck', face: 'head', back: 'body', seat: 'body' };
  function sockOf(bone, e) { return { bone: bone, v: e[0].slice(), at: u3(e[0]), w: e[1], d: e[2], flags: e[3] || {} }; }
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
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' } }, g = {}, f = {}, c, out = {};
    for (c in EXTRA[id] || {}) pal[c] = EXTRA[id][c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
      sides: function (fn) { fn(1, 'L'); fn(-1, 'R'); }
    };
    S.build(P);
    var e = S.eyes;
    P.sides(function (s) {
      eye(P.fine('eyes'), s * e.i, e.j, e.k, !(ctx && ctx.covered));
      S.cheeks.forEach(function (q) { dot(P.fine('blush'), s * q[0], q[1], q[2], 'k'); });
    });
    g.spark = stars(u3(S.spark));
    Object.keys(g).concat(Object.keys(f)).forEach(function (bone) {
      if (out[bone]) return;
      var m = (g[bone] || f[bone]).model({ id: id + ':' + bone, palette: pal, ground: false, ao: false });
      if (!g[bone]) m.layers[0].at = [0, 0, PROUD - GC / 4];
      else if (f[bone]) m.layers.push({ vox: f[bone].snapshot(), at: [0, 0, PROUD - GC / 4] });
      out[bone] = m;
    });
    return out;
  }

  /* ---------------- portraits: 12 × 12 from the front (hand rows where the head is ambiguous) ---------------- */
  function pp(id) { var p = 'PETCOL3.' + id + '.'; return { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye' }; }
  var PORTRAITS = {
    /* the small head on its neck, the eyes either side of pale lores, the beak bending down to its dark tip */
    pet_flamingo: { pal: pp('pet_flamingo'), rows: [
      '............', '....bbbb....', '...bbbbbb...', '..bbbbbbbb..', '..bebllbeb..', '..bebllbeb..',
      '..bbbllbbb..', '...bbllbb...', '....bnnb....', '.....nn.....', '.....bb.....', '.....bb.....'] },
    /* a tuft on the crown, the pale face mask, the dark stripes running out from the eyes, the small nose */
    pet_sloth: { pal: pp('pet_sloth'), rows: [
      '............', '.....bb.....', '...bbbbbb...', '..bbbbbbbb..', '.bbllllllbb.', '.ddelllledd.',
      '.bdelllledb.', '.bbllnnllbb.', '..bllllllb..', '...bllllb...', '....bbbb....', '............'] },
    /* the dark crown, orange round the eyes, the cream throat, the big beak end-on with its dark tip */
    pet_toucan: { pal: pp('pet_toucan'), rows: [
      '............', '...bbbbbb...', '..bbbbbbbb..', '.bbbbbbbbbb.', '.bnebbbbenb.', '.bnebbbbenb.',
      '.blllnnlllb.', '..llnnnnll..', '...nnnnnn...', '...nnddnn...', '....nddn....', '............'] },
    /* pointed ears white in front, white brows, cheeks and muzzle, russet tear marks under the eyes */
    pet_redpanda: { pal: pp('pet_redpanda'), rows: [
      '............', '.l........l.', '.ll......ll.', '.bbbbbbbbbb.', '.bllbbbbllb.', '.bbebbbbebb.',
      '.lbebbbbebl.', '.llbllllbll.', '..lllnnlll..', '...llllll...', '............', '............'] },
    /* a frame of spines round a cream face, the pointed snout and its button nose */
    pet_hedgehog: { pal: pp('pet_hedgehog'), rows: [
      '............', '...bdbbdb...', '..dbdbbdbd..', '.bdbllllbdb.', '.dbllllllbd.', '.dbellllebd.',
      '.bbellllebb.', '..bllllllb..', '...bllllb...', '....llll....', '.....nn.....', '............'] }
  };

  /* the rows of SLPxCharacters.SPECIES */
  var ROWS = {};
  IDS.forEach(function (id) {
    var S = DEF[id], e = S.eyes;
    ROWS[id] = { id: id, h: S.rows * GC, topY: S.topY, biped: S.biped, bodyY: S.bodyY, wingRest: S.wingRest, tailUp: S.tailUp,
      joints: jointsOf(S), sockets: socketsOf(S),
      eyes: [[e.i, e.j, e.k], [e.i, e.j + 1, e.k], [-e.i, e.j, e.k], [-e.i, e.j + 1, e.k]],
      voxels: function (acc, ctx) { return speciesVoxels(id, acc, ctx); } };
    if (PORTRAITS[id]) ROWS[id].portrait = PORTRAITS[id];
  });

  /* register the five rows in the open table (first wins; a table that is not there yet is filled
     on the next call: when the factory runs, or when a test hands the module over) → n added */
  function register(PC) {
    PC = PC || chars();
    if (!PC || !PC.SPECIES || typeof PC.defineSpecies !== 'function') return 0;
    var n = 0;
    IDS.forEach(function (id) { if (!PC.SPECIES[id] && PC.defineSpecies(id, ROWS[id])) n++; });
    return n;
  }

  /* the display model (photocards, coverage): px-characters' displayVoxels for this species */
  var voxels = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st, ctx) { var PC = chars(); register(PC); return PC ? PC.displayVoxels(id, st, ctx) : null; };
  });

  /* SL3D.defineVox('pets-b', factory): the five vox handlers; the 'portrait:<pet>' cells (D76) on
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
    VERSION: VERSION, GC: GC, IDS: IDS, ROWS: ROWS, DEF: DEF, PORTRAITS: PORTRAITS, SOCKET_BONE: SOCKET_BONE,
    speciesVoxels: speciesVoxels, voxels: voxels, register: register, fill: register, factory: factory
  };
}));
