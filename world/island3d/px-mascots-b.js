/* ================================================================
   My Island v3 — SLPxMascotsB (W3b.9): five land mascots as voxel pets — the owlet (treetop), the
   duckling and the pony (castle), the penguin chick and the seal pup (ice).
   window.SLPxMascotsB + SL3D.defineVox('mascots-b', factory) in the browser, module.exports in
   Node. Each species is a row of the open table SLPxCharacters.SPECIES (px-characters.js, W2.6a),
   registered with defineSpecies when this file loads (first wins), so makeRig, the sockets, the
   photocards and the 'portrait:<pet>' atlas cells read it like the four V4.54 pets; the factory
   gives the five vox handlers and draws their portraits on the bound atlas (D76). Voxels are pure
   data on the crew grid GC 0.05 u in the ROOT frame of px-characters (voxel (i, j, k) is centred
   on x = i·GC, z = k·GC and stands on y = j·GC; the pet faces +z, its left is +x). No THREE, no
   DOM, no random numbers, no ink hulls; one colour per voxel, palette tokens only (each species'
   own PETCOL3 parts, D107, and the shared eye ink, glint, blush and dizzy stars; nothing darker
   than PX Ink Eye). Nothing here reads, awards or spends points.

   THE FIVE (land-shops.json lands.<land>.mascots[].voxelLook; catalogAdditions.species bones, D95),
   the same eye as the V4.54 pets (2 voxels tall, a glint in its upper corner, blush below it):
     pet_owl       nearly a ball 9 wide: a body rounded under and a head rounded over with no
                   neck between, a cream face disc with a dark brow, a small hooked beak, cream
                   chest speckles, ear tufts angled out on earL / earR, short speckled wings folded
                   on wingL / wingR, a stubby fan tail under the back, two chunky yellow feet on
                   legBL / legBR (biped); 0.65 u to the tuft tips
     pet_duckling  a butter-yellow body carried low and level like a small boat with a pale chest
                   and keel, a round head set forward, a flat orange bill 3 × 1 × 2, stubby wings,
                   a tail flicked up, one fluff voxel on the crown, orange webbed feet on legBL /
                   legBR (biped); 0.6 u
     pet_pony      natural chestnut (no horn, wings, flank marks or pastel coat): a barrel on four
                   straight legs with cream socks and dark hooves, a neck rising from the withers on
                   'neck' with a cream mane down it and over the poll, a brow with the eyes either
                   side of a cream blaze running down the nose to a squared cream muzzle (a notch at
                   the throat), small upright ears dark inside, a forelock, a long cream brush tail
                   that hangs on tail / tailTip and swishes like a wiper; the tallest, 0.8 u
     pet_penguin   an upright steel-blue pear (never the igloo penguins' navy and white): a cream
                   tummy and face patch, a crown tuft, a short orange beak, stubby flippers held a
                   touch out on wingL / wingR, wide orange feet on legBL / legBR (biped), a stub tail
                   under the back; 0.6 u
     pet_seal      long and low on its tummy, 0.45 u at the raised head: a silver teardrop with a few
                   darker speckles, a pale tummy and throat, a round head on a full chest, a pale
                   muzzle with a navy nose and three whisker dots a side (inlays, MID / HIGH), front
                   flippers splayed on legFL / legFR, the tail flippers together on legBL / legBR;
                   no tail, ears or wings
   Every v2 bone exists (empty bones are allowed), so every clip samples without branching; the
   gaits and the biped wing map are the clip layer's (W3b.11). What a worn hat would bury is left
   out: the penguin's tuft, the duckling's fluff and the pony's forelock.

   SOCKETS (D96; the v of px-characters: an integer is a voxel centre, .5 a face): hat = the
   middle of the crown's top face (w × d = the flat of the crown; earsUp where tufts or ears stand
   at its sides), face = between the eyes on the face plane (w = the span of the eyes, so lenses
   overhang the head by a voxel a side as on the V4.54 pets), neck = the centre of the ring row
   under the head (w × d = what the ring wraps; noNeck on the owl), back = the middle of the free
   deck behind the head, which ends flush with the back so a cape's hem hangs down it (the birds'
   shoulders, the pony's saddle, the seal's shoulders), seat = under the rump.
   Budgets (D108): ≤ 750 tris bare, ≤ 1,400 with one piece per slot at its cap, one draw.

   Node: {IDS, ROWS, voxels: {id: fn(st, ctx) → display VoxModel}, speciesVoxels(id, acc, ctx),
   fill(PC) → n registered, factory(K) → {id: handler}}.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxMascotsB = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') root.SL3D.defineVox('mascots-b', api.factory);
  }
  api.fill();
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxMascotsB: vox.js (SLVox) is not loaded'); return V; }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC === 'object' && PC.SPECIES ? PC : null; }

  var VERSION = 1, GC = 0.05, PROUD = 0.004;
  var IDS = ['pet_owl', 'pet_duckling', 'pet_pony', 'pet_penguin', 'pet_seal'];

  /* ---------------- building blocks (pure; the same conventions as px-characters) ---------------- */
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
     faces is cut min(bev) voxels deep (1 = the edge, 2 = a two-step chamfer), or bev[pair] when it
     is given (e.g. tk: 0 keeps the top-back edge square). c: char | fn(i, j, k) */
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
  function mid(token) { return { token: token, lod: 'mid' }; }    /* a detail the LOW tier drops */

  /* ================================================================
     THE FIVE SPECIES
     Each: rows (to the crown), topY, biped, bodyY (u), wingRest (deg), tailUp, joints (voxel
     coords, → u3), sockets {slot: [v, w, d, flags?]}, eyes {i, j, k} (the cells of the two eyes:
     ±i, rows j..j + 1, on the face of voxel k), cheeks [[i, j, k]] (blush, mirrored), spark (the
     dizzy ring's centre), extra palette, build(P). P.on(bone) is that bone's GC grid, P.fine(bone)
     its inlay layer, P.acc the outfit {slot: id}, P.sides(fn(s, 'L' | 'R')).
     ================================================================ */
  var DEF = {
    /* ---- Treetop: the owlet ---- */
    pet_owl: { rows: 13, topY: 0.72, biped: true, bodyY: 0.275, wingRest: 0, tailUp: false,
      joints: { body: [0, 2.5, -0.5], neck: [0, 5.5, 1], head: [0, 7.5, 1], earL: [3, 10.5, 0.5], tail: [0, 2.5, -3.5], tailTip: [0, 1.5, -4.5],
        legFL: [1.5, 1.5, 1], legBL: [1.5, 0.5, 0], wingL: [4.5, 7, -0.5] },
      sockets: { hat: [[0, 10.5, 1], 7, 3, { earsUp: true }], face: [[0, 7.5, 3.5], 7, 5, { earsUp: true }], neck: [[0, 6, 1], 9, 5, { noNeck: true }],
        back: [[0, 5.5, -3], 5, 3, { wings: true }], seat: [[0, 0.5, 0], 5, 5] },
      eyes: { i: 2, j: 7, k: 3 }, cheeks: [[3, 6, 3]], spark: [0, 12.5, 1],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), i, j;
        /* the ball: a body that rounds under, a head that rounds over; the shoulders behind the head
           are the deck a back piece lies on, its hem flush with the back */
        shape(b, -4, 4, 1, 5, -4, 3, { s: 2, b: 2, k: 2, f: 1 }, 'b');
        shape(h, -4, 4, 6, 10, -1, 3, { s: 2, t: 1, k: 2, f: 1 }, 'b');
        /* the cream face disc on the flat of the face, a dark brow between the eyes, the beak */
        for (j = 6; j <= 9; j++) for (i = -3; i <= 3; i++) if (!(Math.abs(i) === 3 && (j === 6 || j === 9))) h.paint(i, j, 'l');
        h.box(-1, 1, 9, 9, 3, 3, 'd').set(0, 8, 3, 'd');
        h.set(0, 7, 4, 'n').set(0, 6, 3, 'n');                                 /* a small hooked beak */
        /* chest speckles: single cream voxels on the front of the body; darker feather marks behind */
        [[-2, 3], [0, 4], [2, 3], [-1, 2], [1, 2]].forEach(function (c) { b.paint(c[0], c[1], 'p'); });
        [[-1, 4], [1, 3], [0, 5]].forEach(function (c) { b.set(c[0], c[1], -4, 'd'); });
        [[0, 8], [-2, 7], [2, 7]].forEach(function (c) { h.set(c[0], c[1], -1, 'd'); });
        P.sides(function (s, L) {
          P.on('ear' + L).box(3 * s, 3 * s, 11, 11, 0, 1, 'd').set(4 * s, 11, 0, 'd').set(4 * s, 12, 0, 'd');
          /* a short rounded wing folded at the side, speckled */
          P.on('wing' + L).box(5 * s, 5 * s, 3, 7, -2, 1, function (i2, j2, k2) {
            if (j2 === 3 && (k2 === -2 || k2 === 1)) return null;
            return (j2 === 5 && k2 === 0) || (j2 === 6 && k2 === -1) ? 'p' : 'd';
          });
          P.on('legB' + L).box(s, 2 * s, 0, 0, -1, 1, 'n').set(s, 0, 2, 'n').set(2 * s, 0, 2, 'n');
        });
        P.on('tail').box(-1, 1, 1, 2, -4, -4, 'd').set(0, 1, -5, 'd');         /* a stubby fan under the back */
      } },

    /* ---- Castle: the duckling ---- */
    pet_duckling: { rows: 12, topY: 0.66, biped: true, bodyY: 0.2, wingRest: 0, tailUp: false,
      joints: { body: [0, 3.5, -1], neck: [0, 5.5, 2], head: [0, 7.5, 2], earL: [2, 9.5, 2], tail: [0, 4, -4.5], tailTip: [0, 6.5, -5.5],
        legFL: [1.5, 1.5, 1], legBL: [1.5, 1.5, 0], wingL: [3.5, 5, -2] },
      sockets: { hat: [[0, 10.5, 2], 5, 3], face: [[0, 8.5, 4.5], 5, 4], neck: [[0, 6, 2], 5, 3],
        back: [[0, 5.5, -2.5], 5, 4, { wings: true }], seat: [[0, 1.5, -1], 5, 4] },
      eyes: { i: 2, j: 8, k: 4 }, cheeks: [[2, 7, 4]], spark: [0, 12.5, 2],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* a boat of a body: level, a round keel, a pale chest and belly, a square stern for a back piece */
        shape(b, -3, 3, 2, 5, -4, 2, { s: 1, b: 2, t: 1, k: 1, f: 1, tk: 0 }, function (i, j, k) { return (k >= 1 && j <= 4) || j === 2 ? 'l' : 'b'; });
        shape(h, -3, 3, 6, 10, 0, 4, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        h.box(-1, 1, 7, 7, 5, 6, 'n');                                          /* the flat bill, 3 × 1 × 2 */
        if (!P.acc.hat) h.set(0, 11, 1, 'b');                                   /* one fluff voxel on the crown */
        P.sides(function (s, L) {
          P.on('wing' + L).box(4 * s, 4 * s, 3, 4, -3, -1, 'd');
          P.on('legB' + L).box(s, 2 * s, 0, 0, -1, 1, 'n').set(s, 1, 0, 'n');
        });
        P.on('tail').box(-1, 1, 4, 4, -5, -5, 'b').box(0, 0, 5, 5, -6, -5, 'b').set(0, 6, -6, 'b');     /* flicked up */
      } },

    /* ---- Castle: the pony ---- */
    pet_pony: { rows: 16, topY: 0.84, biped: false, bodyY: 0.33, wingRest: 0, tailUp: true,
      joints: { body: [0, 6.5, -1], neck: [0, 8.5, 1.5], head: [0, 11.5, 3.5], earL: [2, 13.5, 3.5], tail: [0, 8, -4.5], tailTip: [0, 6.5, -5.5],
        legFL: [1.5, 4.5, 1.5], legBL: [1.5, 4.5, -3.5], wingL: [2.5, 8, -1] },
      sockets: { hat: [[0, 13.5, 5], 5, 3, { earsUp: true }], face: [[0, 11.5, 6.5], 3, 4, { earsUp: true }], neck: [[0, 9, 1.5], 3, 2],
        back: [[0, 8.5, -2.5], 5, 4], seat: [[0, 4.5, -2], 5, 4] },
      eyes: { i: 1, j: 11, k: 6 }, cheeks: [[2, 11, 6]], spark: [0, 16.5, 5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), n = P.on('neck');
        /* four straight legs: dark hooves, cream socks */
        [['legFL', 1, 1], ['legFR', -2, 1], ['legBL', 1, -4], ['legBR', -2, -4]].forEach(function (L) {
          P.on(L[0]).box(L[1], L[1] + 1, 0, 4, L[2], L[2] + 1, function (i, j) { return j === 0 ? 'n' : j === 1 ? 'l' : 'b'; });
        });
        shape(b, -2, 2, 5, 8, -4, 2, { s: 1, b: 1, k: 1, f: 1 }, 'b');             /* the barrel, flat-backed for a saddle */
        /* the neck rises from the withers; the head: a brow with the eyes over a long nose and a squared
           cream muzzle, a notch at the throat */
        n.box(-1, 1, 9, 12, 1, 2, 'b');
        shape(h, -2, 2, 11, 13, 3, 6, { t: 1, k: 1 }, 'b');
        shape(h, -1, 1, 9, 10, 4, 7, { b: 1, k: 1 }, function (i, j, k) { return k >= 6 ? 'l' : 'b'; });
        h.box(0, 0, 11, 13, 6, 6, 'l').box(0, 0, 10, 10, 4, 5, 'l');             /* the blaze, down the nose */
        P.fine('head').box(-1, -1, 18, 19, 30, 30, 'n').box(2, 2, 18, 19, 30, 30, 'n');    /* nostrils */
        if (!P.acc.hat) h.set(0, 13, 7, 'l');                                   /* the forelock over the brow */
        /* the mane: a cream ridge down the back of the neck and over the poll */
        n.box(0, 0, 9, 12, 0, 0, 'l').box(0, 0, 13, 13, 1, 2, 'l');
        h.set(0, 13, 3, 'l');
        P.sides(function (s, L) {                                               /* small upright ears, dark inside */
          P.on('ear' + L).box(2 * s, 2 * s, 14, 15, 4, 4, 'b').set(2 * s, 14, 3, 'b');
          dot(P.fine('ear' + L), 2 * s, 14, 4, 'd');
        });
        P.on('tail').box(0, 0, 7, 8, -5, -5, 'l');
        P.on('tailTip').box(-1, 1, 2, 6, -6, -5, function (i, j, k) { return Math.abs(i) === 1 && (j === 2 || j === 6 || k === -6) ? null : 'l'; });
      } },

    /* ---- Ice: the penguin chick ---- */
    pet_penguin: { rows: 12, topY: 0.72, biped: true, bodyY: 0.275, wingRest: 4, tailUp: false,
      joints: { body: [0, 3.5, -0.5], neck: [0, 6.5, 2], head: [0, 8.5, 2], earL: [2, 10.5, 2], tail: [0, 2.5, -3.5], tailTip: [0, 1.5, -4.5],
        legFL: [1.5, 1.5, 1], legBL: [1.5, 0.5, 0], wingL: [4.5, 5.5, -0.5] },
      sockets: { hat: [[0, 10.5, 2], 5, 3], face: [[0, 8.5, 4.5], 5, 4], neck: [[0, 7, 2], 5, 3],
        back: [[0, 6.5, -2.5], 5, 4, { wings: true }], seat: [[0, 0.5, 0], 5, 4] },
      eyes: { i: 2, j: 8, k: 4 }, cheeks: [[2, 7, 3]], spark: [0, 12.5, 2],
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), i, j;
        /* the pear: a round body with a cream tummy (square across the back for a back piece), a head
           set a touch forward with a cream face */
        shape(b, -4, 4, 1, 6, -4, 3, { s: 2, b: 2, t: 1, k: 2, f: 1, tk: 0 }, 'b');
        for (j = 1; j <= 5; j++) for (i = -2; i <= 2; i++) if (!(Math.abs(i) === 2 && (j === 1 || j === 5))) b.paint(i, j, 'l');
        shape(h, -3, 3, 7, 10, 0, 4, { s: 1, b: 1, t: 1, k: 1, f: 1 }, 'b');
        for (j = 7; j <= 9; j++) for (i = -2; i <= 2; i++) if (!(Math.abs(i) === 2 && j === 7)) h.paint(i, j, 'l');
        h.box(0, 0, 7, 7, 4, 5, 'n');                                           /* the short beak */
        if (!P.acc.hat) h.box(0, 0, 11, 11, 1, 2, 'b');                         /* the crown tuft */
        P.sides(function (s, L) {
          P.on('wing' + L).box(5 * s, 5 * s, 3, 5, -1, 0, 'd');
          P.on('legB' + L).box(s, 2 * s, 0, 0, -1, 1, 'n').set(3 * s, 0, 1, 'n');
        });
        P.on('tail').box(0, 0, 1, 2, -4, -4, 'd');
      } },

    /* ---- Ice: the seal pup ---- */
    pet_seal: { rows: 9, topY: 0.58, biped: false, bodyY: 0.12, wingRest: 0, tailUp: false,
      joints: { body: [0, 1.5, -1], neck: [0, 3.5, 1], head: [0, 5.5, 2.5], earL: [2, 8.5, 2.5], tail: [0, 1, -6.5], tailTip: [0, 1, -7.5],
        legFL: [3.5, 1, 1], legBL: [0.5, 0.5, -6.5], wingL: [3.5, 3, -1] },
      sockets: { hat: [[0, 8.5, 3], 5, 3], face: [[0, 6.5, 5.5], 5, 4], neck: [[0, 4, 2.5], 5, 4],
        back: [[0, 3.5, -2], 5, 3], seat: [[0, -0.5, -3], 5, 4] },
      eyes: { i: 2, j: 6, k: 5 }, cheeks: [[2, 5, 5]], spark: [0, 10.5, 2.5],
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        /* a teardrop on its tummy: a full chest, a taper to the tail; the tummy and throat pale */
        function belly(i, j, k) { return j === 0 || (k >= 2 && Math.abs(i) <= 1 && j <= 2) ? 'l' : 'b'; }
        shape(b, -3, 3, 0, 3, -3, 3, { s: 1, b: 1, t: 1, f: 1 }, belly);
        shape(b, -3, 3, 0, 2, -5, -4, { s: 1, b: 1, t: 1, k: 1 }, belly);
        b.box(-1, 1, 0, 1, -6, -6, belly);
        [[1, 3, -2], [-2, 3, 0], [-1, 2, -5], [2, 2, -4]].forEach(function (c) { b.set(c[0], c[1], c[2], 'p'); });     /* speckles */
        shape(h, -3, 3, 4, 8, 0, 5, { s: 1, b: 1, t: 2, k: 2, f: 1, sk: 1 }, 'b');            /* a round head, its crown sloping back */
        h.box(-1, 1, 4, 5, 6, 6, 'l').set(0, 5, 6, 'n');                         /* the muzzle and the navy nose */
        P.fine('head').box(-2, -2, 8, 8, 26, 26, 'w').box(-2, -2, 10, 10, 26, 26, 'w').box(-1, -1, 9, 9, 26, 26, 'w')     /* whisker dots */
          .box(3, 3, 8, 8, 26, 26, 'w').box(3, 3, 10, 10, 26, 26, 'w').box(2, 2, 9, 9, 26, 26, 'w');
        P.sides(function (s, L) {
          P.on('legF' + L).box(4 * s, 4 * s, 0, 1, 0, 1, 'd').box(5 * s, 5 * s, 0, 0, 1, 2, 'd');
          P.on('legB' + L).box(s, s, 0, 0, -7, -7, 'd').box(s, 2 * s, 0, 0, -8, -8, 'd');
        });
      } }
  };
  /* speckles are coloured body voxels (every tier: dropping one would open a hole); the seal's whisker
     dots ride its inlay layer, proud of the muzzle, so LOW can leave them out */
  var EXTRA = { pet_owl: { p: 'PETCOL3.pet_owl.light' }, pet_seal: { p: 'PETCOL3.pet_seal.dark', w: mid('PETCOL3.pet_seal.body') } };

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
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' } }, g = {}, f = {}, c, out = {};
    for (c in EXTRA[id] || {}) pal[c] = EXTRA[id][c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
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

  /* register the five rows in the open table (first wins; a table that is not there yet is filled
     on the next call: when the factory runs, or when a test hands the module over) */
  function fill(PC) {
    PC = PC || chars();
    if (!PC || !PC.SPECIES || typeof PC.defineSpecies !== 'function') return 0;
    var n = 0;
    IDS.forEach(function (id) { if (!PC.SPECIES[id] && PC.defineSpecies(id, ROWS[id])) n++; });
    return n;
  }

  /* the display model (photocards, coverage): px-characters' displayVoxels for this species */
  var voxels = {};
  IDS.forEach(function (id) {
    voxels[id] = function (st, ctx) { var PC = chars(); fill(PC); return PC ? PC.displayVoxels(id, st, ctx) : null; };
  });

  /* SL3D.defineVox('mascots-b', factory): the five vox handlers; the 'portrait:<pet>' cells (D76)
     on this hub's atlas (a row registered after the characters factory ran is drawn here) */
  function factory(K) {
    var PC = chars(), out = {};
    if (!PC) return out;
    fill(PC);
    IDS.forEach(function (id) {
      if (PC.SPECIES[id] !== ROWS[id]) return;
      out[id] = typeof PC.handler === 'function' ? PC.handler(id) : { voxels: voxels[id] };
      if (typeof PC.definePortrait === 'function') PC.definePortrait(K, id);
    });
    return out;
  }

  return {
    VERSION: VERSION, GC: GC, IDS: IDS, ROWS: ROWS, SOCKET_BONE: SOCKET_BONE,
    speciesVoxels: speciesVoxels, voxels: voxels, fill: fill, factory: factory
  };
}));
