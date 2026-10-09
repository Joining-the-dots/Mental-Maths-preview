/* ================================================================
   My Island v3 — SLPxCrew (W2.6b): the voxel crew kit in Pixel Blocks — the 11 V4.54 accessories,
   the 'you' avatar, the Spark Stick and the crowd fans, all on the crew grid GC (0.05 u).
   window.SLPxCrew in the browser, module.exports in Node. Everything drawn here is pure data
   (VoxModels: no THREE, no DOM); only makeAvatar / makeWand touch the kit (K.vox).

   ACCESSORIES (D96: fit is data). Each of the 11 ids is a row in the open table
   SLPxCharacters.ACCS (px-characters.js, W2.6a; filled when this file loads, first wins):
     {id, slot, socket, bone, bones, cap, coversEyes,
      voxels(sock, ctx?) → {bone: VoxModel}   (also .build) the piece built from ONE socket descriptor
                                        (ctx: the rig builder's, whose row.eyes the face pieces read);
                                        the result also carries itself as .bones beside .joints
                                        (both hidden from Object.keys) for the rig builder
      joints(sock) → {bone: [x, y, z] u}}   where its helper bones hinge: cape0–2, glint, scarfTail
   sock = a species' descriptor for the row's slot {bone, at: [x, y, z] u, w, d, flags}; a species
   row ({sockets}) or a species id is accepted too, anything else builds on the reference puppy.
     hat   at = the middle of the crown's top face, w × d = the flat of the crown (voxels)
     face  at = between the eyes on the face plane, w = the flat of the face
     neck  at = the centre of the ring row under the head, w × d = what a ring wraps
     back  at = the middle of the free deck's top face, w × d = the deck
     flags earsUp · horns · stalks → the wide hats (crown, beanie, cap) sit one voxel in from each
           side, between them; earsSide, noNeck, wings, spines need nothing here
   A piece is a handful of boxes in voxel units from `at`, one layer each: a box alone is 12
   triangles whatever the AO table, and every box is a hair (PROUD) outside its own outline, so no
   face of a piece lies in a face of the pet. Sheets thinner than a voxel sit on a quarter grid; a
   plate (the shades' two lenses on their bridge) is several of them in one layer, meshed as one
   outline without corner AO (28 triangles where three boxes would be 36). The face pieces centre on
   the species' eyes (ctx.row.eyes from the rig builder, else the descriptor: eyeX).
   Night-only parts ride nightH, the crown's sparkle rides glint, the visor's dot rides scan, the
   shades' lenses ride lens, the scarf's tail rides scarfTail and the cape rides cape0–cape2: no
   accessory adds a bone. The headphone rings stay on the cups (the neck bone, so a turning head
   never pulls them off): they are the glow state 'ring' — dim by day, the beat at night.
   Caps (D108): hat ≤ 180, neck ≤ 160, face ≤ 140, back ≤ 170 on every species, and the heaviest
   outfit of one per slot ≤ 250 (crown 84 + bow 60 + shades 52 + cape 48 = 244), so a V4.54 pet
   stays ≤ 900 dressed.

   AVATAR (contracts.characters): a chibi in a member-colour hoodie, 20 voxels tall (1.0 u), with a
   ROUND hood for a head (a 9-voxel cube with every edge off: never a block-man) whose face is the
   atlas cell 'avatarFace' (the child's emoji, 16 px, nearest) on a 7 × 7 decal; no emoji, or a
   photocard, shows a plain hood. A ✦ printed on the back, a headset mic with a glow tip. One
   SkinnedMesh (K.vox.rig), the Spark Stick included on bone 'wand' (folded into the hand until
   setWand(true)). The member colour is a state colour ('member', 'memberShade'): the runtime hex
   travels in the state's map, never as a token.
   SPARK STICK: a 4-point ✦ on a half grid (four thin points round a member-colour diamond with a
   white plus at its heart, glow) on a dark handle. It is the only light stick here and it is
   never 5-pointed (the ⭐ is the reward).
   FANS: fanVoxels(seed, {night, hero, facing}) → one static VoxModel ≈ [7, 11, 3] of boxes: a
   hooded, a capped or a space-bun silhouette with one arm up; two PX tones by day, a Crowd Shadow
   with a glow ✦ on its fist at night; hero fans get two eye voxels and no other face. They look
   AWAY from the camera (at the stage) unless hero or facing 'camera'.

   SL3D.defineVoxApi (D76: px-city looks makeFan up at build time):
     makeAvatar({color, emoji, photocard}, tier) → AvatarRig {root, bones, sockets {hand}, anchors
       {top}, pose, meshes, color, emoji, tier, tris, h, setPose, setShow, setWand(on),
       play(clip, t, opts) → pose, info(clip), dispose()}: the v2 shape, driven by the unchanged
       pure clip layer (SLCharacters.sampleAvatar)
     makeWand(colorHex, tier) → Group of ONE vox InstancedMesh(1) (the island's instanced program),
       userData {kind, color, tip, points: 4, setShow(k), dispose()}
     makeFan(seed, tier, {night, hero, facing}) → VoxModel
   Node: {voxels: {acc_*: fn(st) → VoxModel}, avatarVoxels, wandVoxels, fanVoxels, …}. Nothing here
   reads, awards or spends anything; no random numbers; the same input gives the same model.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxCrew = api;
    if (root.SL3D && typeof root.SL3D.defineVoxApi === 'function') api.register(root.SL3D);
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
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxCrew: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function clips() { return sibling('SLCharacters', './models-characters.js'); }
  function chars() { var PC = sibling('SLPxCharacters', './px-characters.js'); return PC && typeof PC === 'object' ? PC : null; }

  var VERSION = 1, GC = 0.05, DEG = Math.PI / 180;
  /* catalogue order; slot = CATALOG slot = LOOK socket */
  var SLOT = { acc_partyhat: 'hat', acc_crown: 'hat', acc_bow: 'neck', acc_scarf: 'neck', acc_shades: 'face', acc_cape: 'back',
               acc_beanie: 'hat', acc_cap: 'hat', acc_headphones: 'neck', acc_visor: 'face', acc_hoodie: 'back' };
  var IDS = Object.keys(SLOT), SLOTS = ['hat', 'neck', 'face', 'back'];
  var SLOT_BONE = { hat: 'head', face: 'head', neck: 'neck', back: 'body' };
  var CAPS = { hat: 180, neck: 160, face: 140, back: 170 }, OUTFIT_CAP = 250;       /* = SLIslandLook.SLOT_CAPS, D108 */
  var BONES = { acc_partyhat: ['@'], acc_crown: ['@', 'glint'], acc_bow: ['@'], acc_scarf: ['@', 'scarfTail'], acc_shades: ['lens', '@', 'nightH'],
                acc_cape: ['@', 'cape0', 'cape1', 'cape2'], acc_beanie: ['@'], acc_cap: ['@', 'nightH'], acc_headphones: ['@'],
                acc_visor: ['@', 'scan'], acc_hoodie: ['@'] };
  var MEMBER = 'Bubblegum', MEMBER_SHADE = 'Rose Deep', DISPLAY_PET = 'pet_puppy', CHARS = 'abcdefghijklmnopqrstuvwxyz';
  /* the look of the two face pieces' lens and the beanie's knit (tokens) */
  var SHADES = { lens: 'Dusk Mid', glint: 'Cloud White', night: 'Neon Magenta' }, KNIT = { knit: 'Bubblegum', rib: 'Cloud White' };
  var PROUD = 0.03;                        /* voxels: 0.0015 u, far inside a pixel and far outside the depth buffer's step */

  /* ---------------- small helpers ---------------- */
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function glow(token) { return { token: token, mode: 'glow' }; }
  function mid(token) { return { token: token, lod: 'mid' }; }                    /* a detail the LOW tier drops */
  function normHex(h) {
    if (typeof h !== 'string') return null;
    var m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (m) return '#' + m[1].toUpperCase();
    m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(h.trim());
    return m ? ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase() : null;
  }
  /* the member colour's shade (cuffs, hem, the hood round the face): 18 % darker */
  function shadeOf(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * 0.82).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  /* FNV-1a (SLMotion / SLGrid3D / SLVox) and one avalanche step for the fan looks */
  function hash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function pick(seed, salt, n) {
    var h = (seed ^ Math.imul(salt | 0, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) % n;
  }

  /* ================================================================
     SOCKET DESCRIPTORS
     ================================================================ */
  /* the reference descriptors: the V4.54 pets' shared frame (a rounded 7 × 6 × 6 head over the front
     of a 5-wide body, as px-characters builds them). They draw a piece on its own (the Node display
     models) and stand in for a species that has no row yet. */
  var REF_FLAGS = { pet_puppy: { earsSide: true }, pet_kitten: { earsUp: true }, pet_bunny: { earsUp: true }, pet_dragon: { horns: true } };
  function refSockets(petId) {
    var f = REF_FLAGS[petId] || REF_FLAGS[DISPLAY_PET];
    return { hat: { bone: 'head', at: [0, 0.55, 0.175], w: 5, d: 4, flags: f }, face: { bone: 'head', at: [0, 0.45, 0.325], w: 5, d: 4, flags: f },
             neck: { bone: 'neck', at: [0, 0.275, 0.175], w: 5, d: 4, flags: {} }, back: { bone: 'body', at: [0, 0.35, -0.1], w: 5, d: 5, flags: {} },
             seat: { bone: 'body', at: [0, 0.15, -0.1], w: 5, d: 4, flags: {} } };
  }
  var REF = {};
  Object.keys(REF_FLAGS).forEach(function (id) { REF[id] = refSockets(id); });
  /* a species' sockets: its row in SLPxCharacters.SPECIES, else the reference ones */
  function socketsOf(petId) {
    var PC = chars(), row = PC && PC.SPECIES && typeof petId === 'string' ? PC.SPECIES[petId] : null;
    return row && row.sockets && typeof row.sockets === 'object' ? row.sockets : REF[petId] || REF[DISPLAY_PET];
  }
  function flagsOf(f) {
    var out = {};
    if (typeof f === 'string') f = f.split(/[\s,|]+/);
    if (Array.isArray(f)) f.forEach(function (k) { if (k) out[k] = true; });
    else if (f && typeof f === 'object') Object.keys(f).forEach(function (k) { if (f[k]) out[k] = true; });
    return out;
  }
  function isSock(s) { return !!s && typeof s === 'object' && (Array.isArray(s.at) || typeof s.w === 'number' || typeof s.bone === 'string'); }
  /* whatever a rig builder hands over → the descriptor for this slot */
  function pickSock(slot, a) {
    if (isSock(a)) return a;
    if (a && typeof a === 'object' && a.sockets && isSock(a.sockets[slot])) return a.sockets[slot];
    if (a && typeof a === 'object' && isSock(a[slot])) return a[slot];
    if (typeof a === 'string') return socketsOf(a)[slot] || null;
    return null;
  }
  /* → {slot, bone, at, w, d, f}: a full descriptor, the missing fields from the reference puppy */
  function sockOf(slot, s) {
    var ref = REF[DISPLAY_PET][slot];
    s = isSock(s) ? s : ref;
    var at = Array.isArray(s.at) && s.at.length >= 3 && s.at.every(function (v) { return typeof v === 'number' && isFinite(v); }) ? s.at.slice(0, 3) : ref.at.slice();
    return { slot: slot, bone: typeof s.bone === 'string' && s.bone ? s.bone : SLOT_BONE[slot], at: at,
             w: clamp(Math.round(num(s.w, ref.w)), 2, 12), d: clamp(Math.round(num(s.d, ref.d)), 2, 14), f: flagsOf(s.flags) };
  }

  /* ================================================================
     ACCESSORIES (pure): boxes in voxel units from the socket point
     ================================================================ */
  function Build(id, S, ground) { this.id = id; this.S = S; this.bones = {}; this.ground = !!ground; this.proud = ground ? 0 : PROUD; }
  /* one box [x0, x1] × [y0, y1] × [z0, z1] on a bone ('@' = the socket's own); an extent that is
     not a whole number of voxels sits on a quarter grid (the thin sheets). A worn piece is PROUD
     of its own outline by a hair on every side, so none of its faces lies in a face of the pet. */
  Build.prototype.box = function (bone, colour, x0, x1, y0, y1, z0, z1) {
    var S = this.S, name = bone === '@' ? S.bone : bone, m = this.bones[name], e = this.proud;
    if (!m) m = this.bones[name] = { id: this.id + (bone === '@' ? '' : ':' + name), grid: GC, origin: [0, 0, 0], ground: this.ground, palette: {}, layers: [], keys: {} };
    var key = typeof colour === 'string' ? colour : JSON.stringify(colour), ch = m.keys[key];
    if (!ch) { ch = m.keys[key] = CHARS[Object.keys(m.keys).length]; m.palette[ch] = colour; }
    var lo = [x0, y0, z0], hi = [x1, y1, z1], g = [0, 0, 0], n = [0, 0, 0], at = [0, 0, 0];
    for (var a = 0; a < 3; a++) {
      var len = hi[a] - lo[a], whole = Math.abs(len - Math.round(len)) < 1e-6;
      n[a] = Math.max(1, Math.round(len * (whole ? 1 : 4)));
      g[a] = r6((len + 2 * e) * GC / n[a]);
      at[a] = r6(S.at[a] + (lo[a] - e) * GC);
    }
    m.layers.push({ grid: g, origin: [0, 0, 0], at: at, vox: vox().grid({ grid: g, origin: [0, 0, 0] }).box(0, n[0] - 1, 0, n[1] - 1, 0, n[2] - 1, ch).snapshot() });
    return this;
  };
  /* several boxes as ONE layer on a shared quarter grid, all z0..z1 deep: rects [[x0, x1, y0, y1] …] in
     voxels. One outline, so a pair of lenses on a bridge meshes as one piece; the bone's model meshes
     without corner AO (as the pets' own bones do), so it costs the same alone and on the rig. PROUD as box(). */
  Build.prototype.plate = function (bone, colour, rects, z0, z1) {
    var S = this.S, name = bone === '@' ? S.bone : bone, e = this.proud, lo = [Infinity, Infinity, z0], hi = [-Infinity, -Infinity, z1];
    rects.forEach(function (r) { lo[0] = Math.min(lo[0], r[0]); hi[0] = Math.max(hi[0], r[1]); lo[1] = Math.min(lo[1], r[2]); hi[1] = Math.max(hi[1], r[3]); });
    this.box(bone, colour, lo[0], hi[0], lo[1], hi[1], z0, z1);              /* the bounding box: its palette entry and its seat */
    var m = this.bones[name], ly = m.layers[m.layers.length - 1], ch = String.fromCharCode(ly.vox.c[0]);
    var n = [0, 1, 2].map(function (a) { return Math.max(1, Math.round((hi[a] - lo[a]) * 4)); });
    ly.grid = [0, 1, 2].map(function (a) { return r6((hi[a] - lo[a] + 2 * e) * GC / n[a]); });
    var o = vox().grid({ grid: ly.grid, origin: [0, 0, 0] });
    rects.forEach(function (r) {
      o.box(Math.round((r[0] - lo[0]) * 4), Math.round((r[1] - lo[0]) * 4) - 1, Math.round((r[2] - lo[1]) * 4), Math.round((r[3] - lo[1]) * 4) - 1, 0, n[2] - 1, ch);
    });
    ly.vox = o.snapshot();
    m.ao = false;
    return this;
  };
  Build.prototype.done = function () {
    var out = {}, bones = this.bones;
    Object.keys(bones).forEach(function (b) { delete bones[b].keys; out[b] = bones[b]; });
    return out;
  };
  /* the width a wide hat may take: one voxel in from each side when ears, horns or stalks stand there */
  function fit(S) { return S.f.earsUp || S.f.horns || S.f.stalks ? Math.max(2, S.w - 2) : S.w; }
  /* the crown's band: as wide as the hat may be, never deeper than wide */
  function crownOf(S) { var nx = fit(S), nz = Math.min(S.d, nx); return { hx: nx / 2, hz: nz / 2, g: nx % 2 ? 0.5 : 1 }; }
  /* the face pieces' eye column (voxels out from the socket): the species' own eyes when the rig hands its
     row over (ctx.row.eyes, cells), else from the descriptor — one in from each side of the flat of a
     narrow face, never more than two out (a wide face, eye stalks) */
  function eyeX(S, ctx) {
    var eyes = ctx && ctx.row && Array.isArray(ctx.row.eyes) ? ctx.row.eyes : null, x = 0;
    if (eyes) eyes.forEach(function (c) { if (Array.isArray(c) && typeof c[0] === 'number' && isFinite(c[0])) x = Math.max(x, Math.abs(c[0] - S.at[0] / GC)); });
    if (!(x > 0)) x = S.f.stalks ? 2 : Math.min(2, S.w / 2 - 0.5);
    return clamp(Math.round(x * 2) / 2, 1, 3);
  }
  /* the cape's lengths down the deck: the clasp row, then two hinged lengths to the rump */
  function capeOf(S) { var e = S.d / 2, z1 = e - 1, zm = z1 - Math.max(1, Math.ceil((S.d - 1) / 2)); return { z1: z1, zm: zm, z0: Math.min(-e, zm - 1) }; }

  var BUILD = {
    /* a stepped cone, a voxel narrower each tier, in Grape and gold stripes under a Coral pompom */
    acc_partyhat: function (b, S) {
      var n = Math.min(S.w % 2 ? 3 : 4, S.w, S.d + 1);
      for (var t = 0; t < n; t++) b.box('@', t % 2 ? 'Star Gold' : 'Grape', (t - n) / 2, (n - t) / 2, t, t + 1, (t - n) / 2, (n - t) / 2);
      b.box('@', 'Coral', -0.5, 0.5, n, n + 1, -0.5, 0.5);
    },
    /* a gold band on the flat of the crown, four points, a rose gem; the sparkle on a point rides
       'glint' (pose.glint) */
    acc_crown: function (b, S) {
      var c = crownOf(S), hx = c.hx, hz = c.hz;
      b.box('@', 'Gold Base', -hx, hx, 0, 1, -hz, hz);
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sz) { b.box('@', 'Gold Light', sx > 0 ? hx - 1 : -hx, sx > 0 ? hx : 1 - hx, 1, 2, sz > 0 ? hz - 1 : -hz, sz > 0 ? hz : 1 - hz); });
      });
      b.box('@', 'Rose Deep', -c.g, c.g, 0, 1, hz, hz + 0.5);
      b.box('glint', glow('Cloud White'), hx - 1, hx, 2, 3, hz - 1, hz);
    },
    /* pulled over the crown: a white ribbed cuff round the head's top row, the pink knit in two steps to
       a round top under a white bobble, a lime tag on the side of the cuff behind the ears (never on the
       brow, where it would read as a third eye) */
    acc_beanie: function (b, S) {
      var n = fit(S), o = n < S.w ? 0 : 1, h = n / 2 + o, e = S.d / 2 + 1, g = S.w % 2 ? 0.5 : 1;
      b.box('@', KNIT.rib, -h, h, -1, 0, -e, e).box('@', KNIT.knit, -h, h, 0, 1, -e, e);
      b.box('@', KNIT.knit, 0.5 - h, h - 0.5, 1, 2, 0.5 - e, e - 0.5).box('@', KNIT.rib, -g, g, 2, 3, -g, g);
      b.box('@', { token: 'Laser Lime', mode: 'glow', lod: 'mid' }, h, h + 0.25, -1, 0, -e, 1 - e);
    },
    /* a snapback worn backwards: pulled over the head's top row, a low crown and a button, the
       brim behind, the strap in front; the brim's underside glows at night (nightH) */
    acc_cap: function (b, S) {
      var n = fit(S), o = n < S.w ? 0 : 1, h = n / 2, e = S.d / 2, g = S.w % 2 ? 0.5 : 1, y = o ? -1 : 0, zb = -e - o;
      if (o) b.box('@', 'Graphite', -h - 1, h + 1, -1, 0, -e - 1, e + 1);
      b.box('@', 'Graphite', -h, h, 0, 1, -e, e).box('@', 'Graphite', -h, h, y, y + 1, zb - 2, zb);
      b.box('@', 'Concrete Light', -g, g, 1, 1.5, -g, g);
      b.box('@', mid('Concrete Light'), Math.min(-0.5, 1 - h), Math.max(0.5, h - 1), y, y + 1, e + o, e + o + 0.25);
      b.box('nightH', glow('Neon Magenta'), -h, h, y - 0.25, y, zb - 2, zb);
    },
    /* under the chin: two wings and a gold knot, a white spot on each wing */
    acc_bow: function (b, S) {
      var g = S.w % 2 ? 0.5 : 1, e = S.d / 2;
      [-1, 1].forEach(function (sx) {
        var x0 = sx > 0 ? g : -g - 2;
        b.box('@', 'Rose Deep', x0, x0 + 2, -2.5, 0.5, e, e + 1);
        b.box('@', mid('Cloud White'), sx > 0 ? x0 + 1 : x0, sx > 0 ? x0 + 2 : x0 + 1, -0.5, 0.5, e + 1, e + 1.25);
      });
      b.box('@', 'Star Gold', -g, g, -1.5, -0.5, e, e + 1.5);
    },
    /* a blue collar two rows deep; its coral end hangs in front and the striped tail swings on scarfTail */
    acc_scarf: function (b, S) {
      var h = S.w / 2 + 1, e = S.d / 2 + 1, x0 = S.w % 2 ? 0.5 : 0;
      b.box('@', 'Splash Blue', -h, h, -1.5, 0.5, -e, e).box('@', 'Coral', x0, x0 + 2, -1.5, 0.5, e, e + 1);
      b.box('scarfTail', 'Splash Blue', x0, x0 + 2, -2.5, -1.5, e, e + 1).box('scarfTail', 'Coral', x0, x0 + 2, -3.5, -2.5, e, e + 1);
    },
    /* round the neck, DJ-style: the band behind, both cups as one bar through the neck, and the
       ring hubs as one glow bar through the cups — state 'ring': dim by day, the beat at night */
    acc_headphones: function (b, S) {
      var h = S.w / 2, e = S.d / 2;
      b.box('@', 'Graphite', -h - 1, h + 1, -0.5, 0.5, -e - 1, e - 1);
      b.box('@', 'Gunmetal', -h - 2, h + 2, -1.75, 0.25, e - 2.5, e - 0.5);
      b.box('@', { token: 'LED Cyan', mode: 'glow', state: { key: 'ring', off: 'Smoked Glass', on: 'LED Cyan', initial: 0.375 } }, -h - 2.25, h + 2.25, -1.25, -0.25, e - 2, e - 1);
    },
    /* two tinted lenses on a bridge (one plate on 'lens'), each centred on an eye, a quarter deep and
       never more than a voxel past it; the top edge is the eyes' top row (a lower one leaves the dark
       of the eye showing above it as stray ticks), the bottom a quarter short of theirs; a white glint
       inside the +x lens; a neon rim along the top at night (nightH). No temples: a bar through the
       head reads as a blindfold from above */
    acc_shades: function (b, S, ctx) {
      var x = eyeX(S, ctx), i = Math.max(0.25, x - 1.25), out = x + 1;
      b.plate('lens', SHADES.lens, [[-out, -i, -0.75, 1], [-i, i, 0.5, 1], [i, out, -0.75, 1]], 0, 0.25);
      b.box('@', { token: SHADES.glint, mode: 'glow', lod: 'mid' }, out - 1, out - 0.5, 0.25, 0.75, 0.25, 0.5);
      b.box('nightH', glow(SHADES.night), -out, out, 0.75, 1, 0.25, 0.375);
    },
    /* a slim smoked band over the eyes (a voxel and a half tall, its top on the eyes' top row; half a
       voxel deep, half a voxel past the eyes or the face), a glass edge on top, an LED line on its
       front; the dot on it rides 'scan' (it shows and sweeps at night) */
    acc_visor: function (b, S, ctx) {
      var h = Math.max(S.w / 2, eyeX(S, ctx) + 0.5) + 0.5;
      b.box('@', 'Smoked Glass', -h, h, -0.5, 1, 0, 0.5).box('@', 'Glass Edge', -h, h, 1, 1.125, 0, 0.5);
      b.box('@', glow('LED Cyan'), 0.5 - h, h - 0.5, 0.125, 0.375, 0.5, 0.625);
      b.box('scan', glow('Bone White'), -0.25, 0.25, 0, 0.5, 0.5, 0.875);
    },
    /* a clasp bar behind the head and three hinged lengths: two along the deck (cape0, cape1) and
       the hem hanging behind the rump (cape2) */
    acc_cape: function (b, S) {
      var h = S.w / 2 + 1, c = capeOf(S);
      b.box('@', 'Gunmetal', -h, h, 0, 1.25, c.z1, c.z1 + 1);
      b.box('cape0', 'Cape Red', -h, h, 0, 1, c.zm, c.z1).box('cape1', 'Cape Red', -h, h, 0, 1, c.z0, c.zm);
      b.box('cape2', 'Cape Red', -h, h, -3, 1, c.z0 - 1, c.z0);
    },
    /* a graphite shell over the deck and sides with a lighter hem, the hood folded behind the head,
       the two neon drawstrings as one bar through the chest */
    acc_hoodie: function (b, S) {
      var h = S.w / 2 + 1, e = S.d / 2, z0 = Math.min(1 - e, e - 2);
      b.box('@', 'Graphite', -h, h, -2, 1, z0, e).box('@', 'Night Asphalt', -h, h, -3, -2, z0, e);
      b.box('@', 'Night Asphalt', 1 - h, h - 1, 1, 3, e - 2, e);
      b.box('@', glow('Neon Magenta'), -h - 0.25, h + 0.25, -1.5, 0.5, e - 2, e - 1);
    }
  };
  /* where a piece's helper bones hinge (item space, u): the cape's three hinges, the sparkle's
     centre, the top of the scarf's tail. The rig builder re-seats those bones for this outfit. */
  function jointsOf(id, S) {
    var at = S.at, out = {}, c;
    function p(dx, dy, dz) { return [r6(at[0] + dx * GC), r6(at[1] + dy * GC), r6(at[2] + dz * GC)]; }
    if (id === 'acc_cape') { c = capeOf(S); out.cape0 = p(0, 0.5, c.z1); out.cape1 = p(0, 0.5, c.zm); out.cape2 = p(0, 0.5, c.z0); }
    if (id === 'acc_crown') { c = crownOf(S); out.glint = p(c.hx - 0.5, 2.5, c.hz - 0.5); }
    if (id === 'acc_scarf') out.scarfTail = p(S.w % 2 ? 1.5 : 1, -1.5, S.d / 2 + 1.5);
    return out;
  }
  /* ctx: the rig builder's (SLPxCharacters.assemble: {row, …}); only the face pieces read it (row.eyes) */
  function accVoxels(id, sock, ctx) {
    if (!BUILD[id]) return {};
    var S = sockOf(SLOT[id], pickSock(SLOT[id], sock)), b = new Build(id, S);
    BUILD[id](b, S, ctx && typeof ctx === 'object' ? ctx : null);
    return b.done();
  }
  function accRow(id) {
    var slot = SLOT[id];
    function joints(sock) { return jointsOf(id, sockOf(slot, pickSock(slot, sock))); }
    /* → {bone: VoxModel}; the same map as .bones beside .joints (both hidden from Object.keys), for
       a rig builder that re-seats the helper bones */
    function build(sock, ctx) {
      var out = {};
      try { out = accVoxels(id, sock, ctx); Object.defineProperty(out, 'bones', { value: out }); Object.defineProperty(out, 'joints', { value: joints(sock) }); } catch (e) { out = {}; }
      return out;
    }
    return { id: id, slot: slot, socket: slot, bone: SLOT_BONE[slot], bones: BONES[id].map(function (b) { return b === '@' ? SLOT_BONE[slot] : b; }),
             cap: CAPS[slot], coversEyes: id === 'acc_shades' || id === 'acc_visor', voxels: build, build: build, joints: joints };
  }
  var ACCS = {};
  IDS.forEach(function (id) { ACCS[id] = accRow(id); });
  /* the display model of an accessory (Node, coverage): the piece on its own at rest by day (no
     night part, sparkle or scanning dot), on the display pet's sockets (st.pet; the puppy when it
     is not given). Photocards show the pet wearing it: that is the pet's own handler. */
  var voxels = {}, HIDDEN = { nightH: 1, glint: 1, scan: 1 };
  IDS.forEach(function (id) {
    voxels[id] = function (st) {
      var pet = st && typeof st.pet === 'string' && st.pet ? st.pet : DISPLAY_PET, PC = chars(), row = PC && PC.SPECIES ? PC.SPECIES[pet] : null;
      var per = accVoxels(id, socketsOf(pet)[SLOT[id]], row && typeof row === 'object' ? { row: row } : null);
      return vox().compose(Object.keys(per).filter(function (b) { return !HIDDEN[b]; }).map(function (b) { return { model: per[b] }; }), { id: id });
    };
  });
  /* register the 11 rows in the open table (first wins; a table that is not there yet is filled
     on the next call: when the vox APIs are built, or when a test hands the module over) */
  function fill(PC) {
    PC = PC || chars();
    if (!PC || !PC.ACCS || typeof PC.ACCS !== 'object') return 0;
    var n = 0;
    IDS.forEach(function (id) {
      if (PC.ACCS[id]) return;
      try { PC.ACCS[id] = ACCS[id]; if (PC.ACCS[id] === ACCS[id]) n++; } catch (e) { /* a frozen table keeps what it has */ }
    });
    return n;
  }

  /* ================================================================
     AVATAR, SPARK STICK, FANS (pure)
     ================================================================ */
  /* rest joints (item space, u): hips, neck, shoulders, the hand that holds the stick */
  var AV = { h: 1.0, bodyY: 0.4, tiltDeg: 70,
             J: { base: [0, 0, 0], body: [0, 0.4, 0], head: [0, 0.55, 0], armL: [0.225, 0.525, 0], armR: [-0.225, 0.525, 0],
                  legL: [0.075, 0.275, 0], legR: [-0.075, 0.275, 0], wand: [-0.225, 0.325, 0.05] },
             parent: { base: null, body: 'base', head: 'body', armL: 'body', armR: 'body', legL: 'base', legR: 'base', wand: 'armR' },
             top: [0, 1.06, 0], face: { at: [-3, 12, 4], size: [7, 7], cell: 'avatarFace' } };
  var AV_BONES = Object.keys(AV.parent);
  var WAND = { points: 4, handle: 5, r: 4, tip: 0.3625 };      /* r: the ✦'s reach in half voxels; tip: its centre above the grip (u) */
  /* a member-colour palette entry: a state colour whose map carries the runtime hex */
  function member(key, token, hex, mode) {
    var e = { token: token, state: { key: key, off: token, on: token } };
    if (hex) e.state.map = { own: hex };
    if (mode) e.mode = mode;
    return e;
  }
  function sub(pal, keys) { var o = {}; keys.split('').forEach(function (k) { o[k] = pal[k]; }); return o; }
  /* the Spark Stick: the handle up from the grip (GC) and, on a half grid, the ✦ — four thin points
     round a diamond with a white plus at its heart → [{g: Grid, at: [x, y, z] u}] */
  function wandParts(V) {
    var hd = V.grid({ grid: GC }), st = V.grid({ grid: GC / 2 }), R = WAND.r, i, j;
    hd.box(0, 0, 0, WAND.handle - 1, 0, 0, 'k');
    for (j = -R; j <= R; j++) for (i = -R; i <= R; i++) {
      var d = Math.abs(i) + Math.abs(j);
      if (d <= 2 || i === 0 || j === 0) st.box(i, i, R + j, R + j, 0, 1, d <= 1 ? 'W' : 'G');
    }
    return [{ g: hd, at: [0, 0, 0] }, { g: st, at: [0, r6(WAND.handle * GC), -GC / 4] }];
  }
  function wandModel(V, pal, at) {
    var parts = wandParts(V), m = parts[0].g.model({ id: 'wand', palette: sub(pal, 'kGW'), ground: false });
    m.layers.push({ vox: parts[1].g.snapshot() });
    m.layers.forEach(function (ly, n) { ly.at = [0, 1, 2].map(function (a) { return r6(parts[n].at[a] + (at ? at[a] : 0)); }); });
    return m;
  }
  function crewPalette(o) {
    var hex = normHex(o && o.color), shade = hex ? shadeOf(hex) : null;
    return { m: member('member', MEMBER, hex), s: member('memberShade', MEMBER_SHADE, shade), n: 'Night Asphalt', w: 'Bone White', g: 'Gunmetal',
             t: glow('LED Cyan'), k: 'Midnight Ink', G: member('member', MEMBER, hex, 'glow'), W: glow('Cloud White') };
  }
  /* → {bone: VoxModel} for K.vox.rig. o {color: '#hex', photocard} */
  function avatarBones(o) {
    o = o || {};
    var V = vox(), pal = crewPalette(o), out = {};
    function grid() { return V.grid({ grid: GC }); }
    function done(bone, g, keys) { return (out[bone] = g.model({ id: 'avatar:' + bone, palette: sub(pal, keys), ground: false })); }
    [['legL', 1], ['legR', -1]].forEach(function (e) {
      var g = grid(), s = e[1];
      g.box(s, 3 * s, 0, 0, -1, 2, 'w').box(s, 3 * s, 1, 1, -1, 1, 'm');           /* the sneaker: a white sole with the toe out */
      g.box(s, 2 * s, 2, 5, -1, 1, 'n');
      done(e[0], g, 'wmn');
    });
    var b = grid();
    b.box(-3, 3, 5, 10, -2, 2, function (i, j, k) { return Math.abs(i) === 3 && Math.abs(k) === 2 ? null : j === 5 ? 's' : 'm'; });   /* the hoodie, its corners off, and its hem */
    b.box(-2, 2, 6, 7, 2, 2, 's');                                                 /* the pocket */
    b.box(-1, -1, 9, 10, 2, 2, 'w').box(1, 1, 9, 10, 2, 2, 'w');                   /* the drawstrings */
    b.decal('-z', [-2, 6, -2], [5, 5], 'sparkle');                                 /* the ✦ printed on the back */
    done('body', b, 'msw');
    [['armL', 1], ['armR', -1]].forEach(function (e) {
      var g = grid(), s = e[1];
      g.box(4 * s, 5 * s, 8, 10, -1, 1, 'm').box(4 * s, 5 * s, 7, 7, -1, 1, 's').box(4 * s, 5 * s, 6, 6, -1, 1, 'w');
      done(e[0], g, 'msw');
    });
    /* the head: a 9-voxel cube with every edge off, so no silhouette is a square; the face plane
       is the hood's shade under the emoji decal */
    var h = grid(), i, j, k;
    for (j = 11; j <= 19; j++) for (k = -4; k <= 4; k++) for (i = -4; i <= 4; i++) {
      var d = [4 - Math.abs(i), Math.min(j - 11, 19 - j), 4 - Math.abs(k)].sort(function (a, b) { return a - b; });
      if (d[1] === 0 || (d[0] === 0 && d[1] === 1 && d[2] === 1 && k < 4)) continue;      /* every edge off, and the corners of every face but the front */
      h.set(i, j, k, k === 4 ? 's' : 'm');
    }
    h.box(5, 5, 14, 15, -1, 0, 'g').box(5, 5, 12, 13, 0, 0, 'g').box(5, 5, 12, 12, 1, 4, 'g');   /* the headset: cup, boom … */
    h.set(4, 12, 4, 't');                                                                         /* … and its glow tip */
    if (!o.photocard) h.decal('+z', AV.face.at, AV.face.size, AV.face.cell);
    done('head', h, 'msgt');
    out.wand = wandModel(V, pal, [AV.J.wand[0], r6(AV.J.wand[1] - GC), AV.J.wand[2]]);
    out.wand.id = 'avatar:wand';
    return out;
  }
  /* the whole avatar as ONE static VoxModel (the display model; its bones are its layers) */
  function avatarVoxels(o) {
    var per = avatarBones(o);
    return vox().compose(AV_BONES.filter(function (b) { return per[b]; }).map(function (b) { return { model: per[b] }; }), { id: 'avatar' });
  }
  /* the Spark Stick on its own: the grip at the origin, the handle up +y */
  function wandVoxels(o) {
    return wandModel(vox(), crewPalette(o), null);
  }

  var FAN_KINDS = ['hood', 'cap', 'buns'];
  var FAN_DAY = [['PX Candy Pink', 'PX Jungle Flower Pink'], ['PX Mint', 'PX Castle Teal'], ['PX Sunny', 'PX Tree Autumn'],
                 ['PX Sky Blue', 'PX Jungle Parrot Blue'], ['PX Lilac', 'PX Castle Banner'], ['PX Coral', 'PX Jungle Parrot Red']];
  var FAN_NIGHT = ['Crowd Shadow', 'Crowd Shadow 2', 'Crowd Shadow 3'];
  var FAN_STICK = ['Neon Magenta', 'LED Cyan', 'Electric Violet', 'Laser Lime'];
  /* neighbouring seeds (a crowd asks for 1, 2, 3 …) never share a kind or a tone */
  function fanLook(seed) {
    var s = typeof seed === 'number' && isFinite(seed) ? seed >>> 0 : hash(seed == null ? '' : seed);
    return { kind: FAN_KINDS[(s + pick(s, 1, 2)) % 3], tone: (s * 5 + pick(s, 2, 2)) % FAN_DAY.length, shadow: (s + pick(s, 3, 2)) % FAN_NIGHT.length,
             stick: (s * 3 + pick(s, 4, 2)) % FAN_STICK.length, tall: pick(s, 5, 2), hand: pick(s, 6, 2) ? 1 : -1 };
  }
  /* o {night, hero, facing: 'away' | 'camera'} → a static VoxModel standing on the ground: boxes
     again, so a fan costs the same in any crowd it is composed into */
  function fanVoxels(seed, o) {
    o = o || {};
    var lk = fanLook(seed), night = !!o.night, hero = !!o.hero, zs = (o.facing ? o.facing === 'camera' : hero) ? 1 : -1;
    var a = night ? FAN_NIGHT[lk.shadow] : FAN_DAY[lk.tone][0], c = night ? FAN_NIGHT[(lk.shadow + 1) % FAN_NIGHT.length] : FAN_DAY[lk.tone][1];
    var b = new Build('fan', { at: [0, 0, 0], bone: 'fan' }, true), top = 4 + lk.tall, x = lk.hand > 0 ? 2.5 : -3.5, y = top + 3;
    b.box('@', c, -2.5, 2.5, 0, 2, -1.5, 1.5).box('@', a, -2.5, 2.5, 2, top, -1.5, 1.5);       /* legs, top */
    b.box('@', a, -1.5, 1.5, top, y, -1.5, 1.5);                                               /* head */
    b.box('@', a, x, x + 1, top - 2, y, -0.5, 0.5);                                            /* one arm up */
    if (lk.kind === 'hood') b.box('@', a, -0.5, 0.5, y, y + 1, zs > 0 ? -1.5 : 0.5, zs > 0 ? -0.5 : 1.5);      /* the hood's point */
    else if (lk.kind === 'cap') b.box('@', c, -1.5, 1.5, y, y + 1, -1.5, 1.5).box('@', c, -1.5, 1.5, y, y + 1, zs > 0 ? 1.5 : -2.5, zs > 0 ? 2.5 : -1.5);
    else b.box('@', c, -1.5, -0.5, y, y + 1, -0.5, 0.5).box('@', c, 0.5, 1.5, y, y + 1, -0.5, 0.5);
    if (hero) [-1.5, 0.5].forEach(function (ex) { b.box('@', 'Bone White', ex, ex + 1, top + 1, top + 2, zs > 0 ? 1.5 : -1.75, zs > 0 ? 1.75 : -1.5); });
    if (night) {                                                                               /* the glow ✦ on the fist */
      var s = glow(FAN_STICK[lk.stick]);
      b.box('@', s, x, x + 1, y, y + 3, -0.5, 0.5).box('@', s, x - 1, x, y + 1, y + 2, -0.5, 0.5).box('@', s, x + 1, x + 2, y + 1, y + 2, -0.5, 0.5);
    }
    var m = b.done().fan;
    m.fan = { kind: lk.kind, night: night, hero: hero };
    return m;
  }

  /* ================================================================
     BROWSER BUILDERS — THREE only through the kit (K.THREE, K.vox)
     ================================================================ */
  var rigSeq = 0;
  /* the child's colour as '#RRGGBB'; none given → the look's fallback (null without a look: the
     state colours then keep their fallback token) */
  function memberOf(c) { var L = look(); return normHex(c) || normHex(L && typeof L.resolve === 'function' ? L.resolve(L.MEMBER_FALLBACK || MEMBER) : null); }

  function makeWand(SL3D, colorHex, tier) {
    var K = SL3D.kit(tier), T = K.THREE, V = K.vox, hex = memberOf(colorHex), model = wandVoxels({ color: hex });
    var parts = V.geometry(model, { full: true });
    var mesh = V.bakeStatic(parts.map(function (p) { return { geo: p.geo, color: p.stateColor ? hex || MEMBER : null }; }), { name: 'vox-wand', castShadow: false, frustumCulled: false });
    parts.forEach(function (p) { p.geo.dispose(); });
    var group = new T.Group(), disposed = false;
    group.name = 'wand';
    group.add(mesh);
    group.userData = {
      kind: 'wand', color: hex, tip: WAND.tip, points: WAND.points,
      setShow: function () { /* glow follows the scene's Showtime level through the vox material */ },
      dispose: function () { if (disposed) return; disposed = true; if (group.parent) group.parent.remove(group); group.clear(); mesh.geometry.dispose(); }
    };
    return group;
  }

  function makeAvatar(SL3D, opts, tier) {
    opts = opts || {};
    var K = SL3D.kit(tier), T = K.THREE, V = K.vox, CH = clips(), hex = memberOf(opts.color);
    var emoji = typeof opts.emoji === 'string' && opts.emoji ? opts.emoji : '';
    if (emoji && !opts.photocard) { try { V.atlas().setUser({ avatar: emoji }); } catch (e) { /* the face stays a plain hood */ } }
    var vr = V.rig({
      kind: 'avatar', name: 'avatar', bones: AV_BONES.map(function (n) { return { name: n, parent: AV.parent[n], origin: AV.J[n] }; }),
      voxelsPerBone: avatarBones({ color: hex, photocard: !!opts.photocard }), sockets: { hand: { bone: 'armR', at: AV.J.wand } }, anchors: { top: { bone: 'head', at: AV.top } }
    });
    vr.setState('member', 'own'); vr.setState('memberShade', 'own');
    var bones = vr.bones, KEYS = (CH && CH.AV_KEYS) || [], pose = CH ? CH.restAvatar({}) : {}, o2 = {};
    var seed = (rigSeq++ * 2654435761) >>> 0, phase = (seed % 997) / 997, wandOn = false, disposed = false;
    var _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3();
    function rot(b, x, y, z, order) { b.rotation.set(x * DEG, y * DEG, z * DEG, order || 'XYZ'); }
    function setPose(p) {
      if (disposed || !p) return av;
      if (p !== pose) for (var i = 0; i < KEYS.length; i++) { var k = KEYS[i]; pose[k] = typeof p[k] === 'number' ? p[k] : (k === 'sx' || k === 'sy' || k === 'sz' ? 1 : 0); }
      p = pose;
      /* the whole body: squash about the feet, rotate about the body centre (as the v2 rig) */
      var sy = num(p.sy, 1), c = AV.bodyY * sy;
      _e.set(num(p.pitch, 0) * DEG, num(p.yaw, 0) * DEG, num(p.roll, 0) * DEG, 'YXZ');
      _q.setFromEuler(_e);
      _v.set(0, c, 0).applyQuaternion(_q);
      bones.base.quaternion.copy(_q);
      bones.base.position.set(num(p.x, 0) - _v.x, num(p.y, 0) + c - _v.y, num(p.z, 0) - _v.z);
      bones.base.scale.set(num(p.sx, 1) || 1e-4, sy || 1e-4, num(p.sz, 1) || 1e-4);
      rot(bones.body, 0, num(p.hips, 0), -num(p.lean, 0), 'YXZ');
      rot(bones.head, num(p.headPitch, 0), num(p.headYaw, 0), num(p.headRoll, 0), 'YXZ');
      rot(bones.armL, -num(p.armLf, 0), 0, num(p.armL, 0), 'ZXY');
      rot(bones.armR, -num(p.armRf, 0), 0, -num(p.armR, 0), 'ZXY');
      rot(bones.legL, -num(p.legL, 0), 0, 0);
      rot(bones.legR, -num(p.legR, 0), 0, 0);
      rot(bones.wand, AV.tiltDeg, 0, num(p.twirl, 0));           /* a baton twirl about the grip */
      return av;
    }
    function showWand() { var s = wandOn ? 1 : 1e-4; bones.wand.scale.set(s, s, s); }
    var av = {
      root: vr.root, bones: bones, sockets: vr.sockets, anchors: vr.anchors, pose: pose, meshes: { body: vr.mesh }, skeleton: vr.skeleton,
      color: hex, emoji: emoji, tier: K.tier, tris: vr.tris, h: AV.h,
      setPose: setPose,
      setWand: function (on) { if (!disposed) { wandOn = !!on; showWand(); } return av; },
      setShow: function () { return av; },                       /* the glow level is the vox material's (uGlowMul) */
      play: function (clip, t, o) {
        if (disposed || !CH) return pose;
        for (var k in o2) delete o2[k];
        if (o) for (var n in o) o2[n] = o[n];
        if (o2.seed == null) o2.seed = seed;
        o2.phase = phase;
        CH.sampleAvatar(clip, t, pose, o2);
        return setPose(pose), pose;
      },
      info: function (clip) { var c = CH && CH.CLIP_INFO[clip]; return c ? { loop: c.loop, dur: CH.durOf(clip, o2) } : null; },
      dispose: function () { if (disposed) return; disposed = true; vr.dispose(); }
    };
    showWand();
    setPose(pose);
    return av;
  }

  function register(SL3D) {
    if (!SL3D || typeof SL3D.defineVoxApi !== 'function' || SL3D.__slPxCrew) return false;
    SL3D.__slPxCrew = true;
    SL3D.defineVoxApi('makeAvatar', function (K, S) { fill(); return function (o, tier) { return makeAvatar(S, o, tier); }; });
    SL3D.defineVoxApi('makeWand', function (K, S) { return function (hex, tier) { return makeWand(S, hex, tier); }; });
    SL3D.defineVoxApi('makeFan', function () { return function (seed, tier, o) { return fanVoxels(seed, o); }; });
    return true;
  }

  return {
    VERSION: VERSION, GC: GC, IDS: IDS, SLOT: SLOT, SLOTS: SLOTS, SLOT_BONE: SLOT_BONE, CAPS: CAPS, OUTFIT_CAP: OUTFIT_CAP, REF: REF, ACCS: ACCS,
    AV: AV, AV_BONES: AV_BONES, WAND: WAND, FAN_KINDS: FAN_KINDS, FAN_DAY: FAN_DAY, FAN_NIGHT: FAN_NIGHT, FAN_STICK: FAN_STICK,
    voxels: voxels, accVoxels: accVoxels, jointsOf: function (id, sock) { return ACCS[id] ? ACCS[id].joints(sock) : {}; }, socketsOf: socketsOf, sockOf: sockOf,
    avatarBones: avatarBones, avatarVoxels: avatarVoxels, wandVoxels: wandVoxels, fanLook: fanLook, fanVoxels: fanVoxels, shadeOf: shadeOf,
    fill: fill, register: register, build: { makeAvatar: makeAvatar, makeWand: makeWand }
  };
}));
