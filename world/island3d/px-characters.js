/* ================================================================
   My Island v3 — SLPxCharacters (W2.6a): the voxel pets, their rigs and the ambient critters.
   window.SLPxCharacters in the browser (it registers SL3D.defineVox('characters', factory) and
   the vox APIs makeRig / makeCritter), module.exports in Node. Voxels are pure data on the crew
   grid GC 0.05 u (no THREE, no DOM); only makeRig / makeCritter touch K.vox. No ink hulls, one
   colour per voxel, palette tokens only, nothing darker than PX Ink Eye. No path here reads or
   writes points.

   THE OPEN TABLES (D95, D96). makeRig, the display models, sockets and portraits read these
   two tables and nothing else; px-crew, px-mascots-a/b and px-gear fill them (assign a row, or
   call defineSpecies / defineAcc, which also draws the portrait on every bound atlas). An
   unknown species builds its SPECIES3 standIn (else the first species); an unknown or misplaced
   accessory, or one whose builder throws, is skipped. Nothing here throws on an id.
     SPECIES[petId] = {
       voxels(acc, ctx) → {bone: VoxModel}   pure; rest pose, ROOT frame (below); ctx {tier, rig,
                                              covered (a face piece hides the eyes: no shine)}
       sockets {hat, neck, face, back, seat: {bone, at [x, y, z] u, v [i, j, k], w, d, flags}}
       topY, biped, h                        label height (u); the D95 flag; LOOK height
       joints? {bone: [x, y, z] u}           bone origins (default: the puppy's) · bodyY? (0.25:
                                              the centre whole-body pitch / roll turn about)
       wingRest? (deg, added to the wing pose) · tailUp? (the tail stands up: tailYaw / tailCurl
       swing it about z, a wiper wag) · eyes? [[i, j, k]…] the cells the eyes sit on
       portrait? {rows[12], pal}             else drawn from the head's voxels (12 × 12, front;
                                              an inlay colours a pixel it half covers) }
     ACCS[accId] = {slot, voxels(sock, ctx) → parts, coversEyes?}   (or the builder function)
       sock = the species' descriptor of that slot; ctx {id, slot, species, row, sockets,
       joints, tier, rig, GC, V (SLVox), grid() → a root-frame Grid, has(i, j, k) → the species
       fills that cell}. parts = a VoxModel (rides sock.bone), {bone: VoxModel}, [{bone,
       model}] or {bones: {…}, joints: {auxBone: [x, y, z] u}} (re-seats lens / glint / spark /
       scarfTail / blush / nightH / scan / cape0–2 for this outfit).
   ROOT FRAME: GC voxels with origin [0.5, 0, 0.5] — voxel (i, j, k) is centred on x = i·GC,
   z = k·GC and stands on y = j·GC; the pet faces +z and its left is +x. Socket v and pivots
   use the VoxModel convention (an integer is a voxel centre, .5 a face): hat v = the middle
   of the crown's top face (a hat starts at j = v[1] + 0.5), face v = between the eyes on the
   face plane (a mask starts at k = v[2] + 0.5), neck v = the centre of the ring row under
   the head (w × d = what the ring wraps), back v = the middle of the free deck's top face
   (w × d free), seat v = under the rump. flags: earsUp earsSide horns noNeck stalks (+ wings,
   spines on a back).

   RIG (contracts.characters; voxel-engine 3_characters): makeRig(petId, acc, tier, {game}) →
   the v2 PetRig shape {root, bones, sockets, anchors, pose, petId, acc, tier, meshes {vox},
   skeleton, tris, biped, setPose, setShow, setBeat, play(clip, t, opts) → pose, info, dispose}:
   ONE SkinnedMesh (K.vox.rig), every v2 bone name plus cape0–2 (empty bones exist), driven by
   the pure clip layer of models-characters.js (SLCharacters) exactly as the v2 rig is. Generic
   accessory hooks, by bone and state key (no ids): 'eyes' y-scale = the blink · 'blush' shows
   in cheer · 'spark' = three ✦ that orbit when dizzy · 'glint' takes the crown sheen ·
   'nightH' shows at Showtime · 'scan' shows at Showtime and sweeps (≤ 1 Hz) · 'scarfTail'
   swings · cape0–2 hinge from capeDeform's three samples · state 'show' = the Showtime mix ·
   state 'ring' = the headphone level (0.45 by day, the beat pulse at night, ÷ 1.2).
   Budgets (D108): a V4.54 pet ≤ 650 tris bare, one draw with any outfit.

   PETS (11 voxels to the crown, as the mockup's puppy): pet_puppy (floppy ears, a patch over
   one eye, a saddle, a tongue, a tail that wags), pet_kitten (pointed ears, tabby bands and
   cheek stripes, a hooked tail held high), pet_bunny (one tall ear with a pink lining and one
   lopped over the side, long hind feet, a cotton tail), pet_dragon (gold horns, frills, a
   snout, spines, a spade tail, wings that lean out and beat; sparkles only, never fire).
   'portrait:<pet>' atlas cells are defined in the factory for every row in SPECIES (D76). The
   vox handlers pet_* give the display model (photocards, coverage): every bone at rest in one
   part, the sockets as pivots and anchors, no blush or dizzy stars.

   CRITTERS (D58; ≤ 140 tris; 2–3 pivots): critterVoxels(kind, o) → VoxModel | null, pure.
   penguin (o.size 0 | 1 | 2 = 0.45 / 0.4 / 0.33 u: the same nine voxels on a finer grid) ·
   gull · parrot (o.variant 0 red | 1 blue) · toucan · monkey · squirrel · owl · duck · frog.
   Any kind takes o.size = its height in u (0 < size < 1; else it is drawn on GC). Pivots wingL
   / wingR (birds), armL / armR + tail (monkey), tail + head (squirrel), legL / legR (frog).
   makeCritter(kind, tier, o) → {kind, model, pivots {name: {origin [x, y, z] u, parent}},
   anchors, tris, h, geometry() → K.vox.geometry parts by pivot (the caller owns them)}.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxCharacters = api;
    var S = root.SL3D;
    if (S && typeof S.defineVox === 'function') S.defineVox('characters', api.factory);
    if (S && typeof S.defineVoxApi === 'function') { S.defineVoxApi('makeRig', api.apis.makeRig); S.defineVoxApi('makeCritter', api.apis.makeCritter); }
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxCharacters: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function chars() { return sibling('SLCharacters', './models-characters.js'); }

  var VERSION = 1, GC = 0.05, DEG = Math.PI / 180;
  var IDS = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];
  var SLOTS = ['hat', 'neck', 'face', 'back'], SOCKETS = SLOTS.concat(['seat']);
  var SOCKET_BONE = { hat: 'head', face: 'head', neck: 'neck', back: 'body', seat: 'body' };
  /* = SLVoxGL.PET_PARENT: every v2 bone name, plus cape0–2 */
  var PARENT = { base: null, body: 'base', neck: 'body', head: 'neck', eyes: 'head', earL: 'head', earR: 'head',
    tail: 'body', tailTip: 'tail', legFL: 'body', legFR: 'body', legBL: 'body', legBR: 'body', wingL: 'body', wingR: 'body',
    lens: 'head', glint: 'head', spark: 'head', scarfTail: 'neck', blush: 'head', nightH: 'head', scan: 'head',
    cape0: 'body', cape1: 'cape0', cape2: 'cape1' };
  var BONES = Object.keys(PARENT);
  var AUX = ['lens', 'glint', 'spark', 'scarfTail', 'blush', 'nightH', 'scan', 'cape0', 'cape1', 'cape2'];
  var HIDDEN = { blush: 1, spark: 1, glint: 1, nightH: 1, scan: 1 };       /* folded away at rest: never in a display model */
  var OPT_KEYS = ['speed', 'intensity', 'reduced', 'seed', 'rate', 'bpm', 'steer', 'height', 'dur', 'left', 'ground'];
  var PROUD = 0.004, RING_DAY = 0.45, RING_MAX = 1.2;
  var CAPS = { pet: 650, critter: 140 };

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /* root-frame voxel coordinates (integer = a voxel centre) → item metres */
  function u3(v) { return [v[0] * GC, (v[1] + 0.5) * GC, v[2] * GC]; }
  function isModel(m) { return !!m && typeof m === 'object' && Array.isArray(m.layers); }

  /* ================================================================
     BUILDING BLOCKS (pure)
     ================================================================ */
  function grid() { return vox().grid({ grid: GC }); }
  /* the face layer: half-voxel pixels a quarter voxel deep, PROUD of the face. GC column i is
     fine columns 2i, 2i + 1; row j is 2j, 2j + 1; the front of GC voxel k is fine layer 4k + 2 */
  function fine() { return vox().grid({ grid: [GC / 2, GC / 2, GC / 4], origin: [1, 0, 0] }); }
  /* a 1 × 2 eye on the front of GC voxels (i, j..j + 1, k), a glint in its upper corner */
  function eye(o, i, j, k, shine) {
    var a = 2 * i, b = 2 * j, c = 4 * k + 2;
    o.box(a, a + 1, b, b + 3, c, c, 'e');
    if (shine) o.set(a, b + 3, c, 'g');
  }
  function cheek(o, i, j, k) { var c = 4 * k + 2; o.box(2 * i, 2 * i + 1, 2 * j, 2 * j + 1, c, c, 'k'); }
  /* a box with its twelve edges cut one voxel: the rounded heads */
  function round(o, i0, i1, j0, j1, k0, k1, c) {
    return o.box(i0, i1, j0, j1, k0, k1, function (i, j, k) {
      return (i === i0 || i === i1) + (j === j0 || j === j1) + (k === k0 || k === k1) >= 2 ? null : c;
    });
  }
  /* three ✦ on the dizzy ring round at (u), each a five-voxel plus (4 points, never 5) */
  function stars(at) {
    var o = vox().grid({ grid: GC / 2 }), g = GC / 2;
    for (var n = 0; n < 3; n++) {
      var a = n * Math.PI * 2 / 3, x = Math.round(0.13 * Math.cos(a) / g), z = Math.round(0.13 * Math.sin(a) / g) + Math.round(at[2] / g);
      var y = Math.round((at[1] + 0.015 * Math.sin(2 * a + n)) / g);
      o.box(x - 1, x + 1, y, y, z, z, 's').box(x, x, y - 1, y + 1, z, z, 's');
    }
    return o;
  }

  /* ---------------- the four V4.54 pets ----------------
     Shared frame: 2 × 3 × 2 legs (rows 0–2), a 5 × 4 × 7 body (rows 3–6) with a pale belly, a
     rounded 7-wide head over its front (rows hb–ht), eyes two tall on the flat of the face.
     Palette: b body, d dark, l light, n nose, e eye, g glint (glow), k blush, s star (glow) + the
     species' extras. P.on(bone) is that bone's GC grid; P.fine(bone) its half-voxel inlay layer
     (PROUD of the +z faces, as the eyes are): ear linings, cheek stripes, nostrils. P.acc is the
     outfit {slot: id}: what a worn piece would bury is left out. */
  var PETS = {
    /* floppy ears, a patch over one eye, a saddle, a tongue; the tail stands up and wags like a wiper */
    pet_puppy: { hb: 5, ht: 10, hind: 'd', paw: 'l', topY: 0.72, tailUp: true, flags: { earsSide: true }, extra: { t: 'PX Candy Pink' },
      joints: { earL: [3.5, 10, 3], tailTip: [0, 8.5, -5] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        b.box(-1, 0, 6, 6, -3, -2, 'd').box(2, 2, 4, 5, -1, 0, 'd');             /* a saddle patch and a side spot */
        h.box(-2, -1, 8, 9, 6, 6, 'd').box(0, 0, 8, 9, 6, 6, 'l');               /* the eye patch, a blaze between the eyes */
        h.box(-1, 1, 6, 7, 7, 7, 'l').set(0, 7, 7, 'n').set(0, 6, 7, 't');       /* muzzle, button nose, tongue */
        P.sides(function (s, L) { P.on('ear' + L).box(4 * s, 4 * s, 6, 9, 2, 4, 'd').box(3 * s, 3 * s, 10, 10, 2, 4, 'd'); });
        P.on('tail').box(0, 0, 6, 8, -5, -5, 'b').set(0, 9, -5, 'l');
      } },
    /* pointed ears with pale linings, tabby bands and cheek stripes, a striped tail held high with a hooked tip */
    pet_kitten: { hb: 5, ht: 10, hind: 'd', paw: 'l', topY: 0.74, tailUp: true, flags: { earsUp: true }, extra: { w: { token: 'PETCOL.pet_kitten.dark', lod: 'mid' } },
      joints: { earL: [2.5, 10.5, 3.5], tailTip: [0, 8.5, -5] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head'), wh = P.fine('head');
        [-3, -1].forEach(function (k) { b.box(-2, 2, 6, 6, k, k, 'd').set(-2, 5, k, 'd').set(2, 5, k, 'd'); });     /* tabby bands over the back */
        h.box(-1, 1, 6, 7, 6, 6, 'l').set(0, 7, 6, 'n');                         /* a pale muzzle round a pink nose */
        h.box(-1, -1, 10, 10, 3, 5, 'd').box(1, 1, 10, 10, 3, 5, 'd');           /* two forehead stripes */
        P.sides(function (s, L) {
          P.on('ear' + L).box(2 * s, 2 * s, 11, 12, 3, 4, 'b').box(3 * s, 3 * s, 10, 11, 3, 4, 'b').set(2 * s, 11, 4, 'l');
          var x0 = s > 0 ? 4 : -5;                                               /* two cheek stripes a side, half a voxel thick */
          wh.box(x0, x0 + 1, 12, 12, 26, 26, 'w').box(x0, x0 + 1, 14, 14, 26, 26, 'w');
        });
        P.on('tail').box(0, 0, 6, 8, -5, -5, function (i, j) { return j % 2 ? 'd' : 'b'; });
        P.on('tailTip').box(0, 0, 9, 9, -5, -4, 'b').set(0, 9, -4, 'l');
      } },
    /* one ear up with a pink lining, one lopped over the side; a pink nose over a split lip, long hind feet, a cotton tail */
    pet_bunny: { hb: 5, ht: 9, hind: 'b', paw: 'l', topY: 0.8, flags: { earsUp: true }, extra: { p: 'Bunny Ear', w: 'Cloud White' },
      joints: { earL: [2.5, 9.5, 3], earR: [-2.5, 9.5, 3] },
      build: function (P) {
        P.on('head').box(-1, 1, 6, 6, 7, 7, 'w').set(0, 7, 7, 'n');
        P.on('earL').box(2, 3, 10, 12, 3, 3, 'b').set(3, 9, 3, 'b');             /* the left ear stands tall on its corner … */
        P.fine('earL').box(5, 6, 19, 24, 14, 14, 'p');
        P.on('earR').box(-3, -2, 10, 10, 3, 3, 'b').box(-4, -3, 9, 9, 3, 3, 'b').box(-4, -4, 7, 8, 3, 3, 'b');     /* … the right one lops over the side */
        P.fine('earR').box(-8, -7, 14, 18, 14, 14, 'p');
        P.sides(function (s, L) { P.on('legB' + L).box(s > 0 ? 1 : -2, s > 0 ? 2 : -1, 0, 0, -2, -2, 'l'); });
        P.on('tail').box(-1, 1, 4, 5, -6, -5, 'w');
      } },
    /* gold horns swept back, cheek frills, a snout with nostrils over a pale jaw, back spines, a spade tail,
       wings that lean out and beat; sparkles only, never fire */
    pet_dragon: { hb: 5, ht: 10, hind: 'd', paw: null, topY: 0.8, wing: -42, flags: { horns: true }, backFlags: { wings: true, spines: true },
      extra: { h: 'Star Gold' }, joints: { earL: [3.5, 8.5, 2.5], tail: [0, 5, -4.5], tailTip: [0, 4.5, -6.5], wingL: [2.5, 7, -1.5] },
      build: function (P) {
        var b = P.on('body'), h = P.on('head');
        if (!P.acc.back) b.set(0, 7, -3, 'd').set(0, 7, -1, 'd');                /* back spines (a back piece lies flat) */
        h.box(-1, 1, 6, 7, 7, 8, function (i, j) { return j === 6 ? 'l' : 'b'; });           /* a long snout over a pale jaw */
        P.fine('head').set(2, 15, 34, 'n').set(-1, 15, 34, 'n');                 /* nostrils */
        if (!P.acc.hat) h.box(0, 0, 11, 11, 2, 3, 'd');                          /* a crest between the horns (a hat sits there) */
        P.sides(function (s, L) {
          h.box(2 * s, 2 * s, 11, 11, 2, 3, 'h').set(2 * s, 12, 2, 'h');         /* swept-back horns */
          P.on('ear' + L).box(4 * s, 4 * s, 8, 9, 2, 3, 'd');                    /* frills */
          P.on('wing' + L).box(3 * s, 3 * s, 8, 9, -5, -1, 'l').box(3 * s, 3 * s, 10, 10, -5, -1, 'd')
            .set(3 * s, 7, -1, 'l').set(3 * s, 7, -4, 'l');
        });
        P.on('tail').box(0, 0, 4, 5, -6, -5, 'b');
        P.on('tailTip').box(0, 0, 4, 4, -8, -7, 'b').box(-1, 1, 4, 4, -9, -9, 'd').set(0, 4, -10, 'd').set(0, 5, -8, 'd');
      } }
  };
  /* bone origins in root-frame voxel coordinates (hb / ht = the head's bottom / top row) */
  function petJoints(S) {
    var m = (S.hb + S.ht) / 2, J = {
      base: [0, -0.5, 0], body: [0, 4.5, -1], neck: [0, S.hb + 0.5, 2], head: [0, m - 0.5, 3], eyes: [0, S.ht - 1.5, 6.5],
      earL: [3, S.ht - 0.5, 3], tail: [0, 5.5, -4.5], tailTip: [0, 8.5, -5], legFL: [1.5, 2.5, 1.5], legBL: [1.5, 2.5, -3.5],
      wingL: [2.5, 6, -1], lens: [0, S.ht - 1.5, 6.5], glint: [1, S.ht + 1, 4.5], spark: [0, S.ht + 2.5, 3.5], scarfTail: [1, S.hb - 0.5, 6],
      blush: [0, m - 0.5, 3], nightH: [0, m - 0.5, 3], scan: [0, S.ht - 1.5, 3.5], cape0: [0, 6.5, 1], cape1: [0, 6.5, -1], cape2: [0, 6.5, -3]
    }, k, out = {};
    for (k in S.joints || {}) J[k] = S.joints[k];
    ['ear', 'legF', 'legB', 'wing'].forEach(function (n) { if (!J[n + 'R']) J[n + 'R'] = [-J[n + 'L'][0], J[n + 'L'][1], J[n + 'L'][2]]; });
    for (k in J) out[k] = u3(J[k]);
    return out;
  }
  function sock(bone, v, w, d, flags) { return { bone: bone, v: v, at: u3(v), w: w, d: d, flags: flags || {} }; }
  function petSockets(S) {
    return { hat: sock('head', [0, S.ht + 0.5, 3.5], 5, 4, S.flags), face: sock('head', [0, S.ht - 1.5, 6.5], 5, 4, S.flags),
      neck: sock('neck', [0, S.hb, 3.5], 5, 4, {}), back: sock('body', [0, 6.5, -2], 5, 5, S.backFlags), seat: sock('body', [0, 2.5, -2], 5, 4, {}) };
  }
  function petVoxels(id, S, acc, ctx) {
    var p = 'PETCOL.' + id + '.', pal = { b: p + 'body', d: p + 'dark', l: p + 'light', n: p + 'nose', e: 'PX Ink Eye',
      g: { token: 'PX Glint', mode: 'glow' }, k: 'Blush', s: { token: 'Star Gold', mode: 'glow' } }, g = {}, f = {}, c, out = {};
    for (c in S.extra || {}) pal[c] = S.extra[c];
    var P = {
      acc: acc || {},
      on: function (bone) { return g[bone] || (g[bone] = grid()); },
      fine: function (bone) { return f[bone] || (f[bone] = fine()); },
      sides: function (fn) { fn(1, 'L'); fn(-1, 'R'); }
    };
    [['legFL', 1, 1], ['legFR', -2, 1], ['legBL', 1, -4], ['legBR', -2, -4]].forEach(function (L) {
      var main = L[2] < 0 ? S.hind : 'b';
      P.on(L[0]).box(L[1], L[1] + 1, 0, 2, L[2], L[2] + 1, function (i, j) { return j ? main : S.paw || main; });
    });
    P.on('body').box(-2, 2, 3, 6, -4, 2, function (i, j, k) {
      return Math.abs(i) === 2 && k === -4 && (j === 3 || j === 6) ? null : j === 3 && Math.abs(i) < 2 && k > -4 && k < 2 ? 'l' : 'b';
    });
    round(P.on('head'), -3, 3, S.hb, S.ht, 1, 6, 'b');
    S.build(P);
    var ej = S.ht - 2;
    P.sides(function (s) { eye(P.fine('eyes'), 2 * s, ej, 6, !(ctx && ctx.covered)); cheek(P.fine('blush'), 2 * s, ej - 1, 6); });
    g.spark = stars(u3([0, S.ht + 2.5, 3.5]));
    Object.keys(g).concat(Object.keys(f)).forEach(function (bone) {
      if (out[bone]) return;
      var m = (g[bone] || f[bone]).model({ id: id + ':' + bone, palette: pal, ground: false, ao: false });
      if (!g[bone]) m.layers[0].at = [0, 0, PROUD - GC / 4];
      else if (f[bone]) m.layers.push({ vox: f[bone].snapshot(), at: [0, 0, PROUD - GC / 4] });
      out[bone] = m;
    });
    return out;
  }
  function petRow(id) {
    var S = PETS[id], ej = S.ht - 2;
    return { h: (S.ht + 1) * GC, topY: S.topY, biped: false, bodyY: 0.25, wingRest: S.wing || 0, tailUp: !!S.tailUp, joints: petJoints(S), sockets: petSockets(S),
      eyes: [[2, ej, 6], [2, ej + 1, 6], [-2, ej, 6], [-2, ej + 1, 6]],
      voxels: function (acc, ctx) { return petVoxels(id, S, acc, ctx); } };
  }

  /* ================================================================
     THE OPEN TABLES
     ================================================================ */
  var SPECIES = {}, ACCS = {}, ATLASES = [];
  IDS.forEach(function (id) { SPECIES[id] = petRow(id); });

  function speciesRow(id) {
    var r = typeof id === 'string' ? SPECIES[id] : null;
    return r && typeof r === 'object' && typeof r.voxels === 'function' && r.sockets && typeof r.sockets === 'object' ? r : null;
  }
  /* the species a pet id builds as: itself, else its SPECIES3 standIn, else the first one registered */
  function speciesId(id) {
    if (speciesRow(id)) return id;
    var L = look(), s3 = L && L.SPECIES3 && L.SPECIES3[id];
    if (s3 && speciesRow(s3.standIn)) return s3.standIn;
    var all = Object.keys(SPECIES).filter(speciesRow);
    return all.length ? all[0] : null;
  }
  function accRow(id) {
    var r = typeof id === 'string' ? ACCS[id] : null, fn = typeof r === 'function' ? r : r && typeof r === 'object' ? r.voxels || r.build : null;
    if (typeof fn !== 'function') return null;
    var L = look(), e = L && L.LOOK && L.LOOK[id], slot = (typeof r === 'object' && (r.slot || r.socket)) || (e && e.socket) || null;
    return SLOTS.indexOf(slot) < 0 ? null : { id: id, slot: slot, voxels: fn, coversEyes: !!r.coversEyes };
  }
  /* {hat, neck, face, back} → only registered ids, each in its own slot */
  function accState(acc) {
    var out = {};
    SLOTS.forEach(function (sl) { var r = acc && accRow(acc[sl]); if (r && r.slot === sl) out[sl] = r.id; });
    return out;
  }
  function socketOf(row, slot) {
    var s = row.sockets[slot] || {}, v = Array.isArray(s.v) ? s.v : Array.isArray(s.at) ? [s.at[0] / GC, s.at[1] / GC - 0.5, s.at[2] / GC] : [0, 0, 0];
    return { bone: PARENT[s.bone] !== undefined ? s.bone : SOCKET_BONE[slot], v: v, at: Array.isArray(s.at) ? s.at : u3(v),
      w: num(s.w, 5), d: num(s.d, 4), flags: s.flags || {} };
  }
  function socketsOf(petId) {
    var row = speciesRow(speciesId(petId)), out = {};
    if (row) SOCKETS.forEach(function (s) { out[s] = socketOf(row, s); });
    return out;
  }
  function jointsOf(petId) {
    var row = speciesRow(speciesId(petId)), base = petJoints(PETS.pet_puppy), out = {};
    BONES.forEach(function (b) { var j = row && row.joints && row.joints[b]; out[b] = (Array.isArray(j) ? j : base[b]).slice(); });
    return out;
  }
  /* every voxel of a model: fn(x, y, z (its centre, u), entry (palette), layer grid) */
  function eachVoxel(model, fn) {
    var E = vox().grid, pal = model.palette || {};
    (model.layers || []).forEach(function (ly) {
      var s = ly.vox;
      if (!s || !s.c) { var g0 = E({ grid: ly.grid || model.grid, origin: ly.origin || model.origin }); if (typeof ly.build !== 'function') return; ly.build(g0); s = g0.snapshot(); }
      var g = s.grid, o = s.origin, at = ly.at || [0, 0, 0], W = s.dims[0], H = s.dims[1], D = s.dims[2];
      for (var y = 0; y < H; y++) for (var z = 0; z < D; z++) for (var x = 0; x < W; x++) {
        var code = s.c[(y * D + z) * W + x];
        if (!code) continue;
        var e = pal[String.fromCharCode(code)];
        fn((s.min[0] + x + 0.5 - o[0]) * g[0] + at[0], (s.min[1] + y + 0.5 - o[1]) * g[1] + at[1], (s.min[2] + z + 0.5 - o[2]) * g[2] + at[2],
          typeof e === 'string' ? { token: e } : e || {}, g, String.fromCharCode(code));
      }
    });
  }
  /* an accessory's parts in any accepted shape → [{bone, model}] + its joint overrides */
  function partsOf(res, bone, joints) {
    var out = [];
    function add(b, m) { if (PARENT[b] !== undefined && b !== 'base') [].concat(m).forEach(function (x) { if (isModel(x)) out.push({ bone: b, model: x }); }); }
    if (isModel(res)) add(bone, res);
    else if (Array.isArray(res)) res.forEach(function (e) { if (e) add(e.bone || bone, e.model); });
    else if (res && typeof res === 'object') {
      var map = res.bones && typeof res.bones === 'object' ? res.bones : res;
      Object.keys(map).forEach(function (b) { add(b, map[b]); });
      if (res.bones && res.joints) AUX.forEach(function (b) { var j = res.joints[b]; if (Array.isArray(j) && j.length === 3) joints[b] = j.slice(); });
    }
    return out;
  }
  /* a species in an outfit → {id, row, acc, models {bone: VoxModel}, joints, has {bone: true}} | null */
  function assemble(petId, acc, ctx) {
    var id = speciesId(petId), row = speciesRow(id), V = vox();
    if (!row) return null;
    ctx = ctx || {};
    var worn = accState(acc), joints = jointsOf(id), c1 = { tier: ctx.tier || 'MID', rig: !!ctx.rig }, cells = null, pieces = [], lists = {}, models = {}, base, n0;
    /* the species as it is under this outfit: a face piece that hides the eyes takes their glints */
    function body() {
      var face = worn.face && accRow(worn.face);
      c1.covered = !!(face && face.coversEyes); cells = null;
      return row.voxels(worn, c1) || {};
    }
    function has(i, j, k) {
      if (!cells) {
        cells = {};
        Object.keys(base).forEach(function (b) {
          if (!HIDDEN[b] && isModel(base[b])) eachVoxel(base[b], function (x, y, z, e, g) { if (g[0] === GC && g[2] === GC) cells[Math.round(x / GC) + ',' + Math.round(y / GC - 0.5) + ',' + Math.round(z / GC)] = 1; });
        });
      }
      return cells[Math.round(i) + ',' + Math.round(j) + ',' + Math.round(k)] === 1;
    }
    base = body(); n0 = Object.keys(worn).length;
    SLOTS.forEach(function (sl) {
      var r = worn[sl] && accRow(worn[sl]);
      if (!r) return;
      var sk = socketOf(row, sl);
      try {
        pieces = pieces.concat(partsOf(r.voxels(sk, { id: r.id, slot: sl, species: id, row: row, sockets: socketsOf(id), joints: joints, tier: c1.tier, rig: c1.rig,
          GC: GC, V: V, grid: grid, has: has }), sk.bone, joints));
      } catch (e) { delete worn[sl]; }
    });
    if (Object.keys(worn).length !== n0) base = body();   /* a piece that failed to build is not worn */
    Object.keys(base).forEach(function (b) { if (PARENT[b] !== undefined && isModel(base[b])) lists[b] = [base[b]]; });
    pieces.forEach(function (p) { (lists[p.bone] = lists[p.bone] || []).push(p.model); });
    Object.keys(lists).forEach(function (b) {
      models[b] = lists[b].length === 1 ? lists[b][0] : V.compose(lists[b].map(function (m) { return { model: m }; }), { id: id + ':' + b });
    });
    return { id: id, row: row, acc: worn, models: models, joints: joints, has: models };
  }

  /* ---------------- display models (photocards, coverage, the vox handlers) ---------------- */
  function displayVoxels(petId, st, ctx) {
    var A = assemble(petId, st && st.acc, { tier: ctx && ctx.tier, rig: false });
    if (!A) return null;
    var list = BONES.filter(function (b) { return A.models[b] && !HIDDEN[b]; }).map(function (b) { return { model: A.models[b] }; });
    var m = vox().compose(list, { id: A.id });
    SOCKETS.forEach(function (s) { var k = socketOf(A.row, s); m.pivots[s] = { at: k.v.slice(), parent: null }; m.anchors[s] = k.v.slice(); });
    m.anchors.top = [0, num(A.row.topY, 0.72) / GC - 0.5, 3.5];
    m.cull = [];
    return m;
  }
  function handler(id) { return { voxels: function (st, ctx) { return displayVoxels(id, st, ctx); } }; }

  /* ---------------- portraits: 12 × 12, the head from the front, one pixel a voxel ---------------- */
  function portraitOf(petId) {
    var id = speciesId(petId), row = speciesRow(id);
    if (!row) return null;
    if (row.portrait && Array.isArray(row.portrait.rows)) return { w: 12, h: 12, rows: row.portrait.rows, pal: row.portrait.pal || {} };
    var parts = row.voxels({}, { tier: 'HIGH', rig: false, portrait: true }) || {}, px = {}, inlay = {}, pal = {}, x0 = 99, x1 = -99, y0 = 99, y1 = -99;
    ['head', 'earL', 'earR', 'eyes'].forEach(function (b) {
      if (!isModel(parts[b])) return;
      eachVoxel(parts[b], function (x, y, z, e, g, ch) {
        if (e.mode === 'glow' || e.lod || !e.token) return;               /* no glints, no tier-only detail */
        var i = Math.floor(x / GC + 0.5), j = Math.floor(y / GC), key = i + ',' + j;
        pal[ch] = e.token;
        if (g[0] < GC) { var n = inlay[key] || (inlay[key] = {}); n[ch] = (n[ch] || 0) + 1; return; }     /* an inlay: a quarter of the pixel */
        if (px[key] && px[key].z >= z) return;
        px[key] = { z: z, ch: ch };
        if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
      });
    });
    Object.keys(inlay).forEach(function (key) {                           /* an inlay colours the pixel it half covers */
      var n = inlay[key];
      Object.keys(n).forEach(function (ch) { if (n[ch] >= 2 && px[key]) px[key].ch = ch; });
    });
    var rows = [], dx = x0 - Math.floor((12 - (x1 - x0 + 1)) / 2), top = y1 + Math.floor((12 - (y1 - y0 + 1)) / 2);
    for (var r = 0; r < 12; r++) {
      var s = '';
      for (var c = 0; c < 12; c++) { var p = px[(c + dx) + ',' + (top - r)]; s += p ? p.ch : '.'; }
      rows.push(s);
    }
    return { w: 12, h: 12, rows: rows, pal: pal };
  }
  function atlasOf(K) { try { return K && K.vox && typeof K.vox.atlas === 'function' ? K.vox.atlas() : null; } catch (e) { return null; } }
  function drawPortrait(A, id) {
    try {
      var p = A && typeof A.define === 'function' && speciesRow(id) ? portraitOf(id) : null;
      return p ? A.define('portrait:' + id, p) : null;
    } catch (e) { return null; }                           /* the cell stays the paw */
  }
  function definePortrait(K, id) { return drawPortrait(atlasOf(K), id); }
  function defineSpecies(id, row) {
    if (typeof id !== 'string' || !id || !row || typeof row.voxels !== 'function' || !row.sockets) return false;
    SPECIES[id] = row;
    ATLASES.forEach(function (A) { drawPortrait(A, id); });
    return true;
  }
  function defineAcc(id, row) {
    if (typeof id !== 'string' || !id || !row) return false;
    ACCS[id] = row;
    return !!accRow(id);
  }

  /* ================================================================
     makeRig — one SkinnedMesh, the v2 PetRig shape
     ================================================================ */
  var rigSeq = 0;
  function makeRig(K, petId, acc, o) {
    var CH = chars(), VK = K && K.vox, A = VK && CH ? assemble(petId, acc, { tier: K.tier, rig: true }) : null;
    if (!A) throw new Error('SLPxCharacters.makeRig: needs K.vox, SLCharacters and a registered species');
    var T = K.THREE, row = A.row, J = A.joints, id = A.id, sockets = {}, topY = num(row.topY, 0.72), hz = J.head[2];
    SOCKETS.forEach(function (s) { var k = socketOf(row, s); sockets[s] = { bone: k.bone, at: k.at }; });
    var vr = VK.rig({ kind: 'pet', name: 'pet:' + id, bones: BONES.map(function (n) { return { name: n, parent: PARENT[n], origin: J[n] }; }),
      voxelsPerBone: A.models, sockets: sockets,
      anchors: { top: { bone: 'head', at: [0, topY, hz] }, emote: { bone: 'head', at: [0.14, topY - 0.06, hz + 0.03] }, dizzy: { bone: 'spark', at: J.spark } } });
    var bones = vr.bones, pose = CH.restPose({}), opts = { species: id }, seed = (rigSeq++ * 2654435761) >>> 0, showK = 0, pulse = 1, disposed = false;
    var cy = num(row.bodyY, 0.25), wingRest = num(row.wingRest, 0), tailUp = !!row.tailUp, hasScan = !!A.has.scan, hasGlint = !!A.has.glint, hasCape = !!(A.has.cape0 || A.has.cape1 || A.has.cape2);
    var _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _c = {}, CAPE = CH.CAPE;
    function rot(b, x, y, z, order) { b.rotation.set(x * DEG, y * DEG, z * DEG, order || 'XYZ'); }
    function scale(b, s) { s = s > 1e-4 ? s : 1e-4; b.scale.set(s, s, s); }
    /* the cape: capeDeform's samples a third, two thirds and all the way down become three hinges */
    function cloth(k, t) {
      var py = CAPE.y, pz = CAPE.z, prev = 0;
      for (var n = 0; n < 3; n++) {
        CH.capeDeform(0, CAPE.y, CAPE.z - CAPE.len * (n + 1) / 3, t, k, !!opts.reduced, _c);
        var a = k > 0 ? Math.atan2(_c.y - py, pz - _c.z) : 0;
        bones['cape' + n].rotation.set(a - prev, 0, 0);
        prev = a; py = _c.y; pz = _c.z;
      }
    }
    function applyShow() {
      scale(bones.nightH, showK > 0.5 ? 1 : 0);
      vr.setState('show', showK);
      vr.setState('ring', (showK > 0.5 ? pulse : RING_DAY) / RING_MAX);
    }
    function setPose(p) {
      if (disposed || !p) return rig;
      if (p !== pose) for (var i = 0; i < CH.POSE_KEYS.length; i++) { var key = CH.POSE_KEYS[i]; pose[key] = typeof p[key] === 'number' ? p[key] : key === 'sx' || key === 'sy' || key === 'sz' || key === 'eye' ? 1 : 0; }
      p = pose;
      /* the whole body: squash about the feet, turn about the body centre (as the v2 rig) */
      _e.set(p.pitch * DEG, p.yaw * DEG, p.roll * DEG, 'YXZ');
      _q.setFromEuler(_e);
      var sy = p.sy || 1e-4, c = cy * sy;
      _v.set(0, c, 0).applyQuaternion(_q);
      bones.base.quaternion.copy(_q);
      bones.base.position.set(p.x - _v.x, p.y + c - _v.y, p.z - _v.z);
      bones.base.scale.set(p.sx || 1e-4, sy, p.sz || 1e-4);
      rot(bones.body, 0, p.hips, 0);
      rot(bones.neck, p.neck, 0, 0);
      rot(bones.head, p.headPitch, p.headYaw, p.headRoll, 'YXZ');
      rot(bones.earL, -p.earBack, 0, -p.earL);
      rot(bones.earR, -p.earBack, 0, p.earR);
      if (tailUp) { rot(bones.tail, p.tailPitch, 0, p.tailYaw, 'ZXY'); rot(bones.tailTip, 0, 0, p.tailCurl); }      /* a wiper wag */
      else { rot(bones.tail, p.tailPitch, p.tailYaw, 0, 'YXZ'); rot(bones.tailTip, 0, p.tailCurl, 0); }
      rot(bones.legFL, -p.legFL, 0, p.legFLz, 'ZXY');
      rot(bones.legFR, -p.legFR, 0, -p.legFRz, 'ZXY');
      rot(bones.legBL, -p.legBL, 0, 0);
      rot(bones.legBR, -p.legBR, 0, 0);
      rot(bones.wingL, 0, 0, p.wingL + wingRest);
      rot(bones.wingR, 0, 0, -p.wingR - wingRest);
      rot(bones.scarfTail, p.scarf, 0, 0);
      bones.eyes.scale.set(1, clamp(p.eye * CH.EYE_OPEN, 0.05, 1.1), 1);
      scale(bones.spark, p.spark > 0.01 ? Math.min(1.2, p.spark) : 0);
      bones.spark.rotation.set(0, p.sparkSpin * DEG, 0);
      scale(bones.glint, clamp(p.glint, 0, 1.2));
      scale(bones.blush, p.blush > 0.02 ? 0.6 + 0.4 * clamp(p.blush, 0, 1) : 0);
      if (hasScan) {                                       /* the scanning dot: at Showtime only */
        scale(bones.scan, showK > 0.5 ? 1 : 0);
        bones.scan.rotation.set(0, CH.visorScan(p.wave, !!opts.reduced) * DEG, 0);
      }
      if (hasCape) cloth(clamp(p.cape, 0, 1), p.wave);
      return rig;
    }
    var rig = {
      root: vr.root, bones: bones, sockets: vr.sockets, anchors: vr.anchors, pose: pose, meshes: { vox: vr.mesh }, skeleton: vr.skeleton,
      petId: id, acc: A.acc, tier: K.tier, tris: vr.tris, biped: !!row.biped, game: !!(o && o.game),
      setPose: setPose,
      setShow: function (k) { showK = clamp(num(k, 0), 0, 1); applyShow(); if (hasScan) setPose(pose); return rig; },
      /* the music beat: the 'ring' state pulses ±20 % at Showtime, never faster than 2 Hz (ringPulse) */
      setBeat: function (beat, bpm, reduced) {
        pulse = CH.ringPulse(num(beat, NaN), num(bpm, 100), !!reduced);
        if (showK > 0.5) vr.setState('ring', pulse / RING_MAX);
        return rig;
      },
      play: function (clip, t, op) {
        if (disposed) return pose;
        for (var i = 0; i < OPT_KEYS.length; i++) opts[OPT_KEYS[i]] = op ? op[OPT_KEYS[i]] : undefined;
        if (opts.seed == null) opts.seed = seed;
        opts.species = id; opts.biped = !!row.biped;
        CH.sampleClip(clip, t, pose, opts);
        if (hasGlint) pose.glint = Math.max(pose.glint, CH.crownGlint(t, (seed % 1000) / 1000, !!opts.reduced));
        return setPose(pose), pose;
      },
      info: function (clip) { var c = CH.CLIP_INFO[clip]; return c ? { loop: c.loop, dur: CH.durOf(clip, opts) } : null; },
      dispose: function () { if (disposed) return; disposed = true; vr.dispose(); }
    };
    applyShow();
    setPose(pose);
    return rig;
  }

  /* ================================================================
     CRITTERS — compact box lists [i0, i1, j0, j1, k0, k1, char, pivot?, mirrored?]
     (a mirrored box is also drawn at −x, on the pivot's R twin)
     ================================================================ */
  var NAVY = 'PX Penguin Back', WHITE = 'PX Penguin Front', EYE = 'PX Ink Eye', WING = [1.5, 4.5, -1];
  var CRITTERS = {
    penguin: { h: 9, pal: { n: NAVY, f: WHITE, o: 'PX Penguin Orange', e: EYE }, pivots: { wingL: [2.5, 5.5, -0.5] },
      boxes: [[-2, 2, 1, 7, -2, 1, 'n'], [-1, 1, 8, 8, -2, 1, 'n'], [-1, 1, 1, 4, 1, 1, 'f'], [-2, 2, 5, 7, 1, 1, 'f'], [1, 1, 6, 7, 1, 1, 'e', 0, 1],
        [0, 0, 6, 6, 2, 2, 'o'], [1, 2, 0, 0, 0, 2, 'o', 0, 1], [3, 3, 2, 5, -1, 0, 'n', 'wingL', 1]],
      shine: [[1, 7, 1], [-1, 7, 1]] },
    gull: { pal: { w: WHITE, g: 'PX Castle Stone 2', c: 'PX Coral', e: EYE, n: NAVY }, pivots: { wingL: WING },
      boxes: [[-1, 1, 2, 4, -3, 1, 'w'], [-1, 1, 5, 6, 0, 2, 'w'], [1, 1, 6, 6, 2, 2, 'e', 0, 1], [0, 0, 5, 5, 3, 3, 'c'], [-1, 1, 4, 4, -4, -4, 'g'],
        [1, 1, 0, 1, -1, -1, 'c', 0, 1], [2, 2, 3, 4, -2, 0, 'g', 'wingL', 1], [2, 2, 3, 3, -4, -3, 'n', 'wingL', 1]] },
    parrot: { pal: { b: 'PX Jungle Parrot Red', W: 'PX Jungle Parrot Blue', y: 'PX Sunny', f: WHITE, k: 'PX Ice Pebble 3', q: 'PX Cream', e: EYE }, pivots: { wingL: [1.5, 5.5, 0] },
      variants: [{}, { b: 'PX Jungle Parrot Blue', W: 'PX Jungle Canopy', c: 'PX Sunny', q: 'PX Ice Pebble 3' }],
      boxes: [[-1, 1, 2, 7, -1, 1, 'b'], [-1, 1, 2, 4, 1, 1, 'c'], [-1, 1, 6, 6, 1, 1, 'f'], [1, 1, 6, 6, 1, 1, 'e', 0, 1], [0, 0, 5, 6, 2, 2, 'q'],
        [0, 0, 0, 3, -2, -2, 'W'], [1, 1, 0, 1, 0, 0, 'k', 0, 1], [2, 2, 4, 5, -1, 0, 'W', 'wingL', 1], [2, 2, 2, 3, -1, 0, 'y', 'wingL', 1]] },
    toucan: { pal: { n: NAVY, f: WHITE, o: 'PX Jungle Flower Orange', y: 'PX Sunny', e: EYE, k: 'PX Ice Pebble 3' }, pivots: { wingL: [1.5, 5.5, 0] },
      boxes: [[-1, 1, 2, 7, -1, 1, 'n'], [-1, 1, 3, 6, 1, 1, 'f'], [1, 1, 6, 6, 1, 1, 'e', 0, 1], [0, 0, 5, 6, 2, 4, 'o'], [0, 0, 5, 5, 4, 4, 'y'],
        [0, 0, 1, 2, -2, -2, 'n'], [1, 1, 0, 1, 0, 0, 'k', 0, 1], [2, 2, 2, 5, -1, 0, 'n', 'wingL', 1]] },
    monkey: { pal: { m: 'PX Jungle Bark Light', c: 'PX Cream', e: EYE }, pivots: { armL: [1.5, 3.5, 0], tail: [0, 1.5, -1.5] },
      boxes: [[-1, 1, 1, 3, -1, 1, 'm'], [0, 0, 1, 2, 1, 1, 'c'], [-1, 1, 4, 6, -1, 1, 'm'], [-1, 1, 4, 5, 1, 1, 'c'], [1, 1, 5, 5, 1, 1, 'e', 0, 1],
        [2, 2, 5, 5, 0, 0, 'c', 0, 1], [1, 1, 0, 0, 0, 1, 'm', 0, 1], [2, 2, 1, 3, 0, 0, 'm', 'armL', 1],
        [0, 0, 1, 1, -3, -2, 'm', 'tail'], [0, 0, 2, 4, -3, -3, 'm', 'tail'], [0, 0, 4, 4, -2, -2, 'm', 'tail']] },
    squirrel: { pal: { s: 'PX Tree Autumn', r: 'PX Squirrel Rust', c: 'PX Cream', e: EYE, a: 'PX Trunk' }, pivots: { tail: [0, 0.5, -1.5], head: [0, 3.5, 0] },
      boxes: [[-1, 1, 0, 3, -1, 1, 's'], [-1, 1, 0, 2, 1, 1, 'c'], [0, 0, 2, 2, 2, 2, 'a'],
        [-1, 1, 4, 6, -1, 1, 's', 'head'], [-1, 1, 4, 4, 1, 1, 'c', 'head'], [1, 1, 5, 5, 1, 1, 'e', 'head', 1], [1, 1, 7, 7, 0, 0, 's', 'head', 1],
        [-1, 1, 0, 8, -3, -2, 'r', 'tail'], [-1, 1, 7, 8, -4, -4, 'c', 'tail']] },
    owl: { pal: { b: 'PX Trunk', d: 'PX Tree Bark', c: 'PX Cream', y: 'PX Sunny', e: EYE, o: 'PX Tree Autumn' }, pivots: { wingL: [2.5, 5.5, 0] },
      boxes: [[-2, 2, 1, 6, -1, 1, 'b'], [-1, 1, 1, 3, 1, 1, 'c'], [1, 2, 4, 5, 1, 1, 'y', 0, 1], [1, 1, 4, 4, 1, 1, 'e', 0, 1], [0, 0, 4, 4, 2, 2, 'o'],
        [2, 2, 7, 7, 0, 0, 'b', 0, 1], [1, 1, 0, 0, 0, 1, 'o', 0, 1], [3, 3, 2, 5, -1, 0, 'd', 'wingL', 1]] },
    duck: { pal: { b: 'PX Trunk', h: 'PX Jungle Canopy Deep', w: WHITE, y: 'PX Sunny', o: 'PX Tree Autumn', e: EYE, d: 'PX Tree Bark' }, pivots: { wingL: [1.5, 3.5, -1] },
      boxes: [[-1, 1, 1, 3, -3, 1, 'b'], [0, 0, 3, 4, -4, -4, 'w'], [-1, 1, 4, 6, 0, 1, 'h'], [-1, 1, 4, 4, 0, 1, 'w'], [1, 1, 6, 6, 1, 1, 'e', 0, 1],
        [0, 0, 5, 5, 2, 3, 'y'], [1, 1, 0, 0, -1, 0, 'o', 0, 1], [2, 2, 2, 3, -3, 0, 'd', 'wingL', 1]] },
    frog: { pal: { g: 'PX Leaf', l: 'PX Leaf Lit', d: 'PX Leaf 2', e: EYE, f: WHITE }, pivots: { legL: [2.5, 1.5, -1] },
      boxes: [[-2, 2, 0, 2, -2, 1, 'g'], [-1, 1, 0, 1, 1, 1, 'l'], [1, 2, 3, 3, 0, 1, 'g', 0, 1], [2, 2, 3, 3, 1, 1, 'f', 0, 1], [1, 1, 3, 3, 1, 1, 'e', 0, 1],
        [2, 2, 0, 0, 2, 2, 'd', 0, 1], [3, 3, 0, 1, -2, 0, 'd', 'legL', 1], [3, 3, 0, 0, 1, 1, 'd', 'legL', 1]] }
  };
  var CRITTER_KINDS = Object.keys(CRITTERS), PENGUIN_H = [0.45, 0.4, 0.33];
  function twin(name) { return /L$/.test(name) ? name.slice(0, -1) + 'R' : name; }
  function critterVoxels(kind, o) {
    var C = CRITTERS[kind];
    if (!C) return null;
    o = o || {};
    var V = vox(), g = GC, pal = {}, k, vr = C.variants && C.variants[(o.variant === 'blue' ? 1 : o.variant | 0) % C.variants.length];
    var H = C.h || (C.h = C.boxes.reduce(function (n, b) { return Math.max(n, b[3] + 1); }, 1));
    if (o.size > 0 && o.size < 1) g = o.size / H;
    else if (kind === 'penguin') g = PENGUIN_H[(o.size | 0) % 3] / H;
    for (k in C.pal) pal[k] = C.pal[k];
    for (k in vr || {}) pal[k] = vr[k];
    if (!pal.c && pal.b) pal.c = pal.b;
    pal.G = { token: 'PX Glint', mode: 'glow' };
    var body = V.grid({ grid: g }), piv = {};
    C.boxes.forEach(function (b) {
      [1, -1].forEach(function (s) {
        if (s < 0 && !b[8]) return;
        var name = b[7] ? (s < 0 ? twin(b[7]) : b[7]) : null;
        function put() { body.box(s * b[0], s * b[1], b[2], b[3], b[4], b[5], b[6]); }
        if (name) body.group(name, put); else put();
      });
    });
    Object.keys(C.pivots).forEach(function (n) {
      var p = C.pivots[n];
      piv[n] = { at: p.slice(), parent: null };
      if (/L$/.test(n)) piv[twin(n)] = { at: [-p[0], p[1], p[2]], parent: null };
    });
    var m = body.model({ id: 'critter:' + kind, palette: pal, pivots: piv, ground: false, ao: false, cull: [] });   /* every face: they fly, hop and belly-slide */
    if (C.shine) {                                         /* a glint on each eye: one fine voxel, proud of it */
      var f = V.grid({ grid: [g / 2, g / 2, g / 4], origin: [1, 0, 0] });
      C.shine.forEach(function (e) { f.set(2 * e[0], 2 * e[1] + 1, 4 * e[2] + 2, 'G'); });
      m.layers.push({ vox: f.snapshot(), at: [0, 0, PROUD - g / 4] });
    }
    return m;
  }
  function makeCritter(K, kind, o) {
    var model = critterVoxels(kind, o), VK = K && K.vox;
    if (!model || !VK) return null;
    var res = vox().mesh(model, { tier: K.tier, full: true });
    return { kind: kind, model: model, pivots: res.pivots, anchors: res.anchors, tris: res.parts.reduce(function (n, p) { return n + p.tris; }, 0), h: res.height,
      geometry: function () { return VK.geometry(model, { tier: K.tier, full: true }); } };
  }

  /* ================================================================
     REGISTRATION — SL3D.defineVox('characters', factory) + the vox APIs
     ================================================================ */
  function factory(K) {
    var out = {}, A = atlasOf(K);
    if (A && ATLASES.indexOf(A) < 0) { ATLASES.push(A); if (ATLASES.length > 4) ATLASES.shift(); }
    IDS.forEach(function (id) { out[id] = handler(id); });                 /* a mascot file registers its own ids (handler(id)) */
    Object.keys(SPECIES).forEach(function (id) { drawPortrait(A, id); });  /* D76: 'portrait:<pet>' exists once this ran */
    return out;
  }
  function kitFor(K, SL3D, tier) {
    try { if (tier && SL3D && typeof SL3D.kit === 'function') return SL3D.kit(tier) || K; } catch (e) { /* the bound kit */ }
    return K;
  }
  var apis = {
    makeRig: function (K, SL3D) { return function (petId, acc, tier, o) { return makeRig(kitFor(K, SL3D, tier), petId, acc, o); }; },
    makeCritter: function (K, SL3D) { return function (kind, tier, o) { return makeCritter(kitFor(K, SL3D, tier), kind, o); }; }
  };
  var voxels = {};
  IDS.forEach(function (id) { voxels[id] = function (st, ctx) { return displayVoxels(id, st, ctx); }; });

  return {
    VERSION: VERSION, GC: GC, IDS: IDS, SLOTS: SLOTS, SOCKETS: SOCKETS, SOCKET_BONE: SOCKET_BONE, BONES: BONES, BONE_PARENT: PARENT, AUX_BONES: AUX,
    CAPS: CAPS, CRITTERS: CRITTER_KINDS, PENGUIN_H: PENGUIN_H,
    SPECIES: SPECIES, ACCS: ACCS, defineSpecies: defineSpecies, defineAcc: defineAcc, speciesId: speciesId, accState: accState,
    socketsOf: socketsOf, jointsOf: jointsOf, assemble: assemble, eachVoxel: eachVoxel, u3: u3,
    voxels: voxels, displayVoxels: displayVoxels, handler: handler, critterVoxels: critterVoxels,
    portraitOf: portraitOf, definePortrait: definePortrait,
    makeRig: makeRig, makeCritter: makeCritter, factory: factory, apis: apis
  };
}));
