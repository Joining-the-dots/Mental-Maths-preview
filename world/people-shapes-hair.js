/* ================================================================
   My Island v3, kids update — SLPeopleShapesHair (KU-CH5): the identity pieces that sit on a
   person's head, as pure box lists: 22 hairstyles with their crown descriptors, 6 head coverings,
   4 glasses styles and 2 hearing aids, plus the 'hairTail' bone of the ponytail, pigtails and
   braids. window.SLPeopleShapesHair in the browser, module.exports in Node. Pure data: no DOM, no
   THREE, no SLVox, no random numbers; the same look gives the same boxes (characters.json CH-D8,
   CH-D9, CH-D20, lookSchema.hairStyles / coverings / glassesStyles / hearingAids).

   FRAME. The avatar grid GC (0.05 u), item space at rest, in voxel units: voxel (i, j, k) is centred
   at x = i, z = k and spans y = j .. j + 1 (SLVox builder origin [0.5, 0, 0.5]), so x = i × GC u.
   +z is the face, +y up. The head is the contract's rounded 9 × 9 × 9 head (KU-CH4: the union of
   the 9 × 7 × 7, 7 × 9 × 7 and 7 × 7 × 9 boxes) on rows j H .. H + 8 with H = 11 + ht; its face
   plane is z +4.5 (voxels k = 4), the eyes are columns ±2..±3 on rows H + 3 .. H + 4 (H + 5 for tall
   eyes), the brows row H + 6, the mouth rows H + 1 .. H + 2, the ears at x ±4.5 on rows H + 3 .. H + 4.

   BOX LISTS: KU-CH4's format (people-shapes-body.js). Every builder returns {bone: [box …]} with
   box = {b, c, x0, x1, y0, y1, z0, z1, tag, mode?, lod?, proud?}: b its bone ('head' or 'hairTail');
   c a token ('PX Hair Black', 'PX Hair Black Shade'), never raw hex; the faces of the box in voxel
   units on the unit lattice (x and z on .5, y on whole rows: the head's own lattice); tag one of
   ROLES; mode a shader surface ('cobble' curls and coils, 'plank' locs and braids, 'leaf' waves and
   stubble: texture for no triangles); lod 'mid' a detail the LOW tier skips (here always proud of
   the base — curl lobes, loc ropes, a knot's top, the glasses' temples — so skipping it leaves no
   hole); proud: its own layer drawn a hair outside its outline. Index i0 = x0 + 0.5 … i1 = x1 − 0.5,
   j0 = y0 … j1 = y1 − 1, k0 = z0 + 0.5 … k1 = z1 − 0.5 (cells(box) lists them). Boxes of one piece
   never overlap. The person's order is body → face (KU-CH4) → hair → covering → glasses → aid →
   garments → accessories, a later box painting over an earlier one on the same bone and lattice:
     hair and coverings paint into the head's own layer: a buzz cut is the head's own top voxels in
       hair colour, a fringe recolours the forehead row, a covering replaces the hair it covers.
       Nothing of theirs is ever in the face window below the forehead (|i| ≤ 3, rows H + 1 .. H + 6,
       k ≥ 4: eyes, brows, cheeks, smile).
     glasses and hearing aids are proud (their own layer, as px-crew's accessories, best meshed
       without corner AO like its plates), so they never darken or split the face, and a temple
       crossing hair shows on top. A proud ear (KU-CH4) under hair or a covering is hidden: see
       earsHidden().

   API
     HAIR[0..21] {n, id, name, texture, length, crown: +n, flags, tail}  COVERINGS[1..6]  GLASSES[1..4]
     AIDS[1..2]  (each list's index is the look code; 0 = none)  ROLES  DEFAULTS  TOKENS  MODES  BUDGET
     look(l) → the fields this file reads, unknown values drawn as the default (CH-D6)
     headOf(l) → {y0, y1, h: 9, w: 9, d: 9, face: {z, eyeY, mouthY, browY}, ear: {x, y0, y1}}
     tokensOf(l) → {role: token}                 the tokens this look's pieces use
     hair(l, o) → {head: […], hairTail?: […]}    o.omit(i, j, k) → true drops a voxel (a hat's own
                                                  volume, so nothing pokes through it); o.front → only
                                                  the voxels at the face plane (a hood's face opening)
     covering(l) → {head: […]}   glasses(l) → {head: […]} (proud)   aid(l) → {head: […]} (proud)
     headPieces(l, o) → {head, hairTail?} all four in order: the hair minus what the covering hides,
                         the covering, then the glasses unless o.coversEyes and the aid unless the
                         covering hides the ears (both own layers); o.omit as hair();
                         .joints = {hairTail: [x, y, z] u} when the tail is built
     crownOf(l) → {y, w, d, x, z, top, outer: {w, d, z}, ear: {x, y0, y1}, back: {z, y}, flags,
                   features?}  where a head piece sits, measured from the voxels (CH-D9): y = the row
                   its lowest voxels take; w × d = the flat it rests on, centred on (x, z), with every
                   column held at row y − 1 (y − 2 under a knot) and nothing of the hair or covering
                   at rows ≥ y over it; a bun or puffs put the flat in front of them or between them
                   (the bigger), a knot (patka, headwrap) lifts it over itself. y − H − 9 is the
                   design's crown (+0 … +3). top = the row above the highest voxel (features and
                   the tail too); outer = the width and depth a pulled-on hat wraps (the top three
                   rows), centred on z; ear.x = the outer face at the ear rows (headphones, ear muffs
                   and aids sit outside it); back = the outer back face and the lowest row of hair
                   behind the head (capes, packs; null when none); features = the bun / puffs /
                   knot boxes. flags: wide · puffs · bun · knot · covered · kippah · tail · tall · long ·
                   neck. 'mid' voxels are ignored: a hat hides them through hair(l, {omit})
     hairTailOf(l) → null | {bone: 'hairTail', parent: 'head', joint: [i, j, k] (voxels), at: [x, y, z]
                   (u), axis, maxDeg: 10, maxHz: 1.6}   built only for those styles; the rig sways it
                   about axis ('z' side to side: the ponytail, the braids in front of the chest; 'x'
                   fore and aft: the pigtails, so both swing together) from the root speed and holds it
                   still under reduced motion (lookSchema.hairBones)
     covers(l) → {hair: 'all' | 'top' | 'topBack' | 'none', ears, neck, tail}
     earsHidden(l) → true when the hair or covering fills the ears' cells (KU-CH4's proud ears at
                   x ±4.5..5.5, rows H + 3 .. H + 4, z −0.5..0.5): build the head without them
     EYES[ey] → [[i, dj] …] the eye box each eye shape draws in, which nothing here covers (dj from the
                   eye row H + 3; −i mirrors); inEye(i, v, k, ey) tests it head-relative (v = j − H)
     cells(box) / cellsOf(pieces) → [[i, j, k, box, bone] …]   boxes(cells, tokens) (the packer)
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLPeopleShapesHair = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1, GC = 0.05;
  var DEFAULTS = { hs: 2, hc: 1, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, ey: 0, ht: 0, bd: 1 };
  var RANGE = { hs: [0, 21], cv: [0, 6], cc: [0, 7], gl: [0, 4], gc: [0, 5], ha: [0, 2], hac: [0, 3], ey: [0, 3], ht: [0, 1], bd: [0, 2] };
  var ROLES = ['hair', 'hairShade', 'hairTip', 'hairTipShade', 'cover', 'coverShade', 'frame', 'frameShade', 'aid', 'aidShade'];
  /* voxelLook.budgets (triangles, corner AO on, measured on the contract head): hair ≤ 260 and
     ≤ 200 on LOW once the 'mid' detail drops; a covering ≤ 220 (it replaces the hair it hides);
     a hearing aid ≤ 24 (the pair); glasses ≤ 60 in the design, but two proud 1-voxel rings, a bridge
     and temples cannot be drawn under about 120 (150 is the tested bound here, 148 the heaviest:
     round frames round tall eyes; the LOW tier drops the temples): a deviation reported to the lead */
  var BUDGET = { hair: 260, hairLow: 200, covering: 220, glasses: 150, glassesDesign: 60, aid: 24 };

  /* characters.json lookSchema (names are the design's; the creator's labels come from world-copy) */
  function hs(n, id, name, texture, length, crown, flags, tail) { return { n: n, id: id, name: name, texture: texture, length: length, crown: crown, flags: flags || {}, tail: tail || null }; }
  var HAIR = [
    hs(0, 'h_none', 'No hair', '-', 0, 0),
    hs(1, 'h_buzz', 'Buzz cut', 'any', 0, 0),
    hs(2, 'h_crop', 'Short crop', 'straight', 1, 1),
    hs(3, 'h_sidepart', 'Side part', 'straight', 1, 1),
    hs(4, 'h_curtain', 'Curtain fringe', 'straight', 1, 1),
    hs(5, 'h_wavyshort', 'Short waves', 'wavy', 1, 1),
    hs(6, 'h_curlyshort', 'Short curls', 'curly', 1, 2),
    hs(7, 'h_coilyshort', 'Short coils', 'coily', 1, 1),
    hs(8, 'h_afro', 'Afro', 'coily', 2, 3, { wide: true }),
    hs(9, 'h_puffs', 'Afro puffs', 'coily', 1, 1, { puffs: true }),
    hs(10, 'h_bob', 'Bob', 'straight', 2, 1),
    hs(11, 'h_shoulder', 'Shoulder length', 'straight', 3, 1, { long: true }),
    hs(12, 'h_shoulderwavy', 'Shoulder waves', 'wavy', 3, 1, { long: true }),
    hs(13, 'h_long', 'Long and straight', 'straight', 4, 1, { long: true }),
    hs(14, 'h_longcurly', 'Long curls', 'curly', 4, 2, { long: true }),
    hs(15, 'h_pony', 'Ponytail', 'any', 3, 1, { tail: true }, 'pony'),
    hs(16, 'h_pigtails', 'Pigtails', 'any', 3, 1, { tail: true }, 'pig'),
    hs(17, 'h_braids', 'Two braids', 'any', 4, 1, { tail: true, long: true }, 'braid'),
    hs(18, 'h_locs', 'Locs', 'coily', 3, 2, { long: true }),
    hs(19, 'h_bun', 'Top bun', 'any', 2, 1, { bun: true }),
    hs(20, 'h_spacebuns', 'Space buns', 'any', 2, 1, { puffs: true }),
    hs(21, 'h_cornrows', 'Cornrows', 'coily', 1, 1)
  ];
  /* hides: the hair it hides ('all' | 'top' = rows from the ears up | 'topBack' = the top and the
     back half | 'none'); crown: the covered head's crown (+n), or null = the hair's own (kippah) */
  function cv(n, id, name, hides, ears, neck, crown, flags) { return { n: n, id: id, name: name, hides: hides, ears: ears, neck: neck, crown: crown, flags: flags }; }
  var COVERINGS = [null,
    cv(1, 'cv_hijab', 'Hijab', 'all', true, true, 1, { covered: true }),
    cv(2, 'cv_sporthijab', 'Sports hijab', 'all', true, false, 1, { covered: true }),
    cv(3, 'cv_patka', 'Patka', 'top', false, false, 2, { covered: true, knot: true }),
    cv(4, 'cv_turban', 'Turban', 'all', false, false, 3, { covered: true, wide: true }),
    cv(5, 'cv_kippah', 'Kippah', 'none', false, false, null, { kippah: true }),
    cv(6, 'cv_headwrap', 'Headwrap', 'topBack', false, false, 3, { covered: true, knot: true })
  ];
  var GLASSES = [null, { n: 1, id: 'gl_round', name: 'Round' }, { n: 2, id: 'gl_square', name: 'Square' },
    { n: 3, id: 'gl_rect', name: 'Rectangle' }, { n: 4, id: 'gl_sport', name: 'Sporty band' }];
  var AIDS = [null, { n: 1, id: 'ha_bte', name: 'Behind-the-ear' }, { n: 2, id: 'ha_round', name: 'Round processor' }];
  /* the token names of people-core PALETTES (the hex lives there; px-people registers each with its
     ' Shade' partner at × 0.86 lightness) */
  var TOKENS = {
    hair: { 0: 'PX Hair Black', 1: 'PX Hair Dark Brown', 2: 'PX Hair Brown', 3: 'PX Hair Light Brown', 4: 'PX Hair Auburn',
            5: 'PX Hair Ginger', 6: 'PX Hair Strawberry', 7: 'PX Hair Blonde', 8: 'PX Hair Platinum', 9: 'PX Hair Grey',
            20: 'PX Hair Pink', 21: 'PX Hair Lilac', 22: 'PX Hair Sky', 23: 'PX Hair Mint', 24: 'PX Hair Silver', 25: 'PX Hair Sunset' },
    tip: 'PX Hair Sunset Tip',
    cover: ['PX Cover Navy', 'PX Cover Black', 'PX Cover White', 'PX Cover Rose', 'PX Cover Teal', 'PX Cover Lilac', 'PX Cover Sunflower', 'PX Cover Coral'],
    frame: ['PX Frame Ink', 'PX Frame Tortoise', 'PX Frame Red', 'PX Frame Blue', 'PX Frame Pink', 'PX Frame Gold'],
    aid: ['PX Aid Beige', 'PX Aid Brown', 'PX Aid Blue', 'PX Aid Pink']
  };
  var SUNSET = 25;
  /* the surface each texture draws with (SLVox modes: free in triangles; the bevel fades below
     about 3 px a voxel, so a far figure reads as clean blocks) */
  var MODES = { straight: null, any: null, wavy: 'leaf', curly: 'cobble', coily: 'cobble', locs: 'plank', braid: 'plank',
                buzz: 'leaf', turban: 'plank', patka: 'plank', headwrap: 'leaf' };
  /* the eye voxels by eye shape (ey): [column, row above H + 3]; the other eye mirrors (−i) */
  var EYES = [[[2, 0], [3, 0], [2, 1], [3, 1]], [[2, 0], [3, 0], [2, 1], [3, 1], [2, 2], [3, 2]],
              [[2, 0], [3, 0], [2, 1], [3, 1]], [[1, 0], [2, 1], [3, 0], [2, 2]]];

  /* ---------------- the look ---------------- */
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function field(l, key) {
    var v = l && typeof l === 'object' ? l[key] : undefined, r = RANGE[key];
    if (!isInt(v)) return DEFAULTS[key];
    if (key === 'hc') return TOKENS.hair[v] ? v : DEFAULTS.hc;
    return v >= r[0] && v <= r[1] ? v : DEFAULTS[key];
  }
  function lookOf(l) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = field(l, k); });
    return o;
  }
  function shade(token) { return token + ' Shade'; }
  function tokensOf(l) {
    var L = lookOf(l), h = TOKENS.hair[L.hc], out = { hair: h, hairShade: shade(h) };
    if (L.hc === SUNSET) { out.hairTip = TOKENS.tip; out.hairTipShade = shade(TOKENS.tip); }
    out.cover = TOKENS.cover[L.cc]; out.coverShade = shade(out.cover);
    out.frame = TOKENS.frame[L.gc]; out.frameShade = shade(out.frame);
    out.aid = TOKENS.aid[L.hac]; out.aidShade = shade(out.aid);
    return out;
  }

  /* ---------------- the head (the KU-CH4 contract) ---------------- */
  function headOf(l) {
    var y0 = 11 + field(l, 'ht');
    return { y0: y0, y1: y0 + 8, w: 9, h: 9, d: 9, face: { z: 4.5, eyeY: y0 + 3, mouthY: y0 + 1, browY: y0 + 6 },
             ear: { x: 4.5, y0: y0 + 3, y1: y0 + 4 } };
  }
  /* head-relative cell tests: v = j − H (0 .. 8) */
  function inHead(i, v, k) {
    var ai = Math.abs(i), ak = Math.abs(k);
    return (ai <= 4 && v >= 1 && v <= 7 && ak <= 3) || (ai <= 3 && v >= 0 && v <= 8 && ak <= 3) || (ai <= 3 && v >= 1 && v <= 7 && ak <= 4);
  }
  /* the rounded 11-voxel box one voxel out from the head (the +1 hair line) */
  function inR11(i, v, k) {
    var ai = Math.abs(i), ak = Math.abs(k);
    return (ai <= 5 && v >= 0 && v <= 8 && ak <= 4) || (ai <= 4 && v >= -1 && v <= 9 && ak <= 4) || (ai <= 4 && v >= 0 && v <= 8 && ak <= 5);
  }
  /* the face window: never hair or a covering (eyes, brows, cheeks, mouth) */
  function inFace(i, v, k) { return Math.abs(i) <= 3 && v >= 1 && v <= 6 && k >= 4; }
  /* in front of the face below the hairline: a volume never fills it (fringes are placed on purpose) */
  function inFront(i, v, k) { return k >= 5 || (k === 4 && Math.abs(i) <= 3 && v <= 7); }

  /* ---------------- the cell store (head-relative while building) ---------------- */
  function key(i, j, k) { return ((i + 128) & 255) | (((j + 128) & 255) << 8) | (((k + 128) & 255) << 16); }
  /* an eye voxel of an eye shape (EYES, from the eye row H + 3; the glint included), never covered */
  function inEye(i, v, k, ey) {
    if (k < 4) return false;
    var ai = Math.abs(i), cells = EYES[ey] || EYES[0];
    for (var n = 0; n < cells.length; n++) if (cells[n][0] === ai && cells[n][1] === v - 3) return true;
    return false;
  }
  /* the store refuses the face window (o.ey given: only the eye box, for the glasses round it) */
  function Cells(H, mode, ey) { this.H = H; this.mode = mode || null; this.ey = ey; this.m = new Map(); }
  Cells.prototype.put = function (i, v, k, role, lod) {
    if (this.ey != null ? inEye(i, v, k, this.ey) : inFace(i, v, k)) return this;
    this.m.set(key(i, this.H + v, k), { i: i, j: this.H + v, k: k, role: role, lod: lod || null, mode: this.mode });
    return this;
  };
  Cells.prototype.has = function (i, v, k) { return this.m.has(key(i, this.H + v, k)); };
  Cells.prototype.get = function (i, v, k) { return this.m.get(key(i, this.H + v, k)) || null; };
  Cells.prototype.role = function (i, v, k, role) { var c = this.get(i, v, k); if (c && !c.lod) c.role = role; return this; };
  Cells.prototype.list = function () { var a = []; this.m.forEach(function (c) { a.push(c); }); return a; };
  Cells.prototype.size = function () { return this.m.size; };
  Cells.prototype.add = function (e) { this.m.set(key(e.i, e.j, e.k), e); return this; };

  /* ================================================================
     HAIR
     ================================================================ */
  /* a rounded box: half-sizes h round (cx, cv, ck), the corners and edges rounded by radius r */
  function rbox(i, v, k, cx, cv, ck, hx, hy, hz, r) {
    var dx = Math.max(0, Math.abs(i - cx) - (hx - r)), dy = Math.max(0, Math.abs(v - cv) - (hy - r)), dz = Math.max(0, Math.abs(k - ck) - (hz - r));
    return Math.abs(i - cx) <= hx && Math.abs(v - cv) <= hy && Math.abs(k - ck) <= hz && dx * dx + dy * dy + dz * dz <= r * r + 0.3;
  }
  /* the +1 cap, a dome: the shell between the head and R11 with its top two rows stepped in (the top
     7 × 7, the row under it 9 × 9), by region down to each region's line: side (|i| = 5 and the
     bottom side rim; sideBack behind the ear), back (k ≤ −4), temple (the face's side columns at
     k = 4); the row over the forehead and the top always */
  function inDome(i, v, k) {
    var ai = Math.abs(i), ak = Math.abs(k);
    if (!inR11(i, v, k)) return false;
    if (v === 9) return ai <= 3 && ak <= 3 && !(ai === 3 && ak === 3);
    if (v === 8) return ai <= 4 && k >= -4;
    return true;
  }
  function cap(c, s) {
    for (var v = 0; v <= 9; v++) for (var i = -5; i <= 5; i++) for (var k = -5; k <= 4; k++) {
      if (!inDome(i, v, k) || inHead(i, v, k)) continue;
      var ai = Math.abs(i), line;
      if (v >= 8) line = 0;
      else if (k === 4) line = ai === 4 ? s.temple : 99;
      else if (ai === 5 || (v === 0 && ai === 4)) line = k <= 0 && s.sideBack != null ? s.sideBack : s.side;
      else if (k <= -4) line = s.back;
      else line = 99;
      if (v >= line) c.put(i, v, k, 'hair');
    }
    return c;
  }
  /* fill where test(i, v, k) holds, never inside the head or in front of the face */
  function fill(c, x0, x1, v0, v1, k0, k1, test, role, lod) {
    for (var v = v0; v <= v1; v++) for (var i = x0; i <= x1; i++) for (var k = k0; k <= k1; k++) {
      if (inHead(i, v, k) || inFront(i, v, k) || (test && !test(i, v, k))) continue;
      c.put(i, v, k, role || 'hair', lod);
    }
    return c;
  }
  /* a feature (bun, puffs, knot): what fn() adds is tagged, so the crown keeps hats clear of it */
  function feature(c, fn) {
    var before = new Set(c.m.keys());
    fn();
    c.m.forEach(function (e, n) { if (!before.has(n)) e.feat = true; });
    return c;
  }
  /* a knot (patka, headwrap): a feature a hat goes over (it counts in the crown's height) */
  function knot(c, fn) { feature(c, fn); c.m.forEach(function (e) { if (e.feat === true) e.feat = 'knot'; }); return c; }
  /* a puff (afro puffs, buns): a feature block of half-sizes h round (x, v, k) (a plain block
     is the cheapest shape on the mesher: one quad a face) */
  function puff(c, x, v, k, hx, hy, hz, role) { return feature(c, function () { fill(c, x - hx, x + hx, v - hy, v + hy, k - hz, k + hz, null, role); }); }
  /* a rounded crown of curls (crown +2) standing on its own: down to row low at the sides and back
     at the back of the head (one smooth shape: no hairline step to pay for) */
  function curls(c, low, back) {
    return fill(c, -6, 6, Math.min(low, back), 10, -7, 4, function (i, v, k) {
      if (k === 4 && Math.abs(i) <= 3 && v < 8) return false;
      if (v < (k <= -3 ? back : low)) return false;
      return rbox(i, v, k, 0, 6.5, -1, 5.7, 4.2, 5.7, 3) || (k <= -3 && v < 6.5 && rbox(i, v, k, 0, 6.5, -1, 5.7, 7, 5.7, 3));
    });
  }
  /* the cloud of curls over a +1 cap (crown +2): a rounded box (radius r) up to row 10, from row low */
  function cloud(c, low, r) {
    return fill(c, -6, 6, low, 10, -7, 4, function (i, v, k) { return rbox(i, v, k, 0, 6.5, -1, 6.5, 4, 6, r); });
  }
  /* the buzz cut: the head's own surface voxels in hair colour */
  function buzz(c) {
    for (var v = 1; v <= 8; v++) for (var i = -4; i <= 4; i++) for (var k = -4; k <= 3; k++) {
      if (!inHead(i, v, k) || (inHead(i + 1, v, k) && inHead(i - 1, v, k) && inHead(i, v + 1, k) && inHead(i, v, k + 1) && inHead(i, v, k - 1))) continue;
      if (v === 8 || (Math.abs(i) === 4 && v >= (k >= 2 ? 6 : 5)) || (k <= -3 && v >= 2)) c.put(i, v, k, 'hair');
    }
    return c;
  }
  /* the underside and hairline: a hair voxel with no hair (and no head) under it takes the shade;
     a buzz cut has no underside, so its lowest row does */
  function undersides(c, onHead) {
    c.list().forEach(function (e) {
      if (e.lod || e.role !== 'hair') return;
      var v = e.j - c.H;
      if (!c.has(e.i, v - 1, e.k) && (onHead || !inHead(e.i, v - 1, e.k))) e.role = 'hairShade';
    });
    return c;
  }
  /* the back curtain below the head, between the shoulder blades (clear of the arms) */
  function curtain(c, vMin, w) {
    for (var v = -1; v >= vMin; v--) for (var i = -w; i <= w; i++) for (var k = -4; k <= -3; k++) {
      if (v === vMin && (Math.abs(i) === w || k === -3)) continue;
      c.put(i, v, k, 'hair');
    }
    for (var i2 = -4; i2 <= 4; i2++) c.put(i2, -1, -5, 'hair');
    return c;
  }
  /* two locks in front of the shoulders, two voxels wide, down from the temples to row vMin */
  function locks(c, vMin, lod) {
    [-1, 1].forEach(function (s) {
      c.put(s * 4, 0, 4, 'hair', lod);
      for (var v = -1; v >= vMin; v--) { c.put(s * 4, v, 3, 'hair', lod); c.put(s * 3, v, 3, 'hair', lod); }
    });
    return c;
  }
  /* the side panels (|i| = 6) beside the cap, rows lo..hi: a flare */
  function flare(c, lo, hi) { [-1, 1].forEach(function (s) { for (var v = lo; v <= hi; v++) for (var k = -4; k <= 3; k++) c.put(s * 6, v, k, 'hair'); }); return c; }
  /* bangs on the forehead row (H + 7): the face plane recoloured, by column */
  function bangs(c, cols) { cols.forEach(function (i) { c.put(i, 7, 4, 'hair'); }); return c; }
  /* a part line over the top from the front, column x */
  function part(c, x, kFrom) { for (var k = kFrom; k <= 4; k++) { c.role(x, 9, k, 'hairShade'); c.role(x, 8, k, 'hairShade'); } return c; }
  /* curl lobes standing proud of the silhouette ('mid': the LOW tier draws the clean shape), each
     [x, v, k, w, h, d] from its lowest corner: soft bumps two or three voxels across, never pegs */
  function lobes(c, list) {
    list.forEach(function (p) {
      for (var v = p[1]; v < p[1] + (p[4] || 1); v++) for (var i = p[0]; i < p[0] + (p[3] || 1); i++) for (var k = p[2]; k < p[2] + (p[5] || 1); k++) {
        if (!c.has(i, v, k) && !inHead(i, v, k) && !inFront(i, v, k)) c.put(i, v, k, 'hair', 'mid');
      }
    });
    return c;
  }

  /* the styles (c: the cell store, head-relative rows v = j − H) */
  var STYLE = {
    h_none: function () { },
    h_buzz: function (c) { buzz(c); },
    h_crop: function (c) { cap(c, { side: 5, back: 2, temple: 6 }); bangs(c, [-2, 1]); },
    h_sidepart: function (c) { cap(c, { side: 5, back: 2, temple: 6 }); bangs(c, [-3, -2, -1, 0, 1]); part(c, 2, 0); },
    h_curtain: function (c) { cap(c, { side: 4, back: 1, temple: 4 }); bangs(c, [-3, -2, 2, 3]); part(c, 0, 0); },
    h_wavyshort: function (c) { cap(c, { side: 4, back: 1, temple: 5 }); bangs(c, [-3, -2, 0]); lobes(c, [[-6, 5, -1, 1, 2, 2], [6, 4, 0, 1, 2, 2]]); },
    h_curlyshort: function (c) {
      curls(c, 4, 1); bangs(c, [-2, 1]);
      lobes(c, [[-3, 11, -2, 2, 1, 2], [1, 11, 0, 2, 1, 2], [-6, 6, -1, 1, 2, 2]]);      /* the side bump against the curls (at −7 it floated a voxel out) */
    },
    h_coilyshort: function (c) { cap(c, { side: 4, back: 1, temple: 5 }); },
    h_afro: function (c) {                                                    /* a rounded cloud framing the face, puffs on top */
      fill(c, -7, 7, 2, 12, -8, 4, function (i, v, k) { return rbox(i, v, k, 0, 6.5, -1.5, 6.7, 5.2, 6.2, 3) && (v >= 3 || k <= 1); });
      lobes(c, [[-4, 12, -3, 3, 1, 2], [1, 12, -1, 3, 1, 2]]);
    },
    h_puffs: function (c) {                                                   /* two puffs side by side on the crown, wider than tall */
      cap(c, { side: 4, back: 1, temple: 5 });
      puff(c, 3, 10, -2, 2, 1, 2); puff(c, -3, 10, -2, 2, 1, 2);
    },
    h_bob: function (c) { cap(c, { side: 0, back: 0, temple: 1 }); flare(c, 0, 0); bangs(c, [-3, -2, -1, 0, 1, 2, 3]); },
    h_shoulder: function (c) { cap(c, { side: 0, back: 0, temple: 1 }); flare(c, 0, 1); curtain(c, -2, 3); bangs(c, [-3, -2]); part(c, -2, 0); },
    h_shoulderwavy: function (c) { cap(c, { side: 0, back: 0, temple: 1 }); flare(c, 0, 1); curtain(c, -2, 3); bangs(c, [-3, 3]); lobes(c, [[-6, 3, -1, 1, 1, 2], [7, 1, 0, 1, 1, 2]]); },   /* a wave a side, each against the hair (the left one floated a voxel out); one row tall keeps hair ≤ 260 */
    h_long: function (c) { cap(c, { side: 0, back: 0, temple: 0 }); curtain(c, -5, 4); locks(c, -4); part(c, 0, 0); },
    h_longcurly: function (c) { cap(c, { side: 0, back: 0, temple: 0 }); cloud(c, 4, 2.2); curtain(c, -5, 4); locks(c, -4, 'mid'); bangs(c, [-2]); },
    h_pony: function (c) { cap(c, { side: 4, back: 1, temple: 5 }); },
    h_pigtails: function (c) { cap(c, { side: 3, back: 1, temple: 4 }); bangs(c, [-3, -1, 1, 3]); },
    h_braids: function (c) { cap(c, { side: 1, back: 0, temple: 0 }); part(c, 0, -4); },
    h_locs: function (c) {
      cap(c, { side: 0, back: 0, temple: 1 }); curtain(c, -3, 4);
      fill(c, -3, 3, 10, 10, -3, 3, function (i, v, k) { return !(Math.abs(i) === 3 && Math.abs(k) === 3); });
      undersides(c);
      [-1, 1].forEach(function (s) {                                             /* a loc down each side of the face, and over each shoulder */
        for (var w = 0; w <= 7; w++) c.role(s * 5, w, 4, 'hairShade');
        for (var v = -1; v >= -4; v--) c.put(s * 5, v, 3, 'hair', 'mid');
      });
    },
    h_bun: function (c) { cap(c, { side: 4, back: 1, temple: 5 }); puff(c, 0, 11, -2, 2, 1, 2); },
    h_spacebuns: function (c) { cap(c, { side: 4, back: 1, temple: 5 }); puff(c, -3, 11, 0, 1, 1, 1); puff(c, 3, 11, 0, 1, 1, 1); },
    h_cornrows: function (c) {
      cap(c, { side: 4, back: 1, temple: 6 });
      c.list().forEach(function (e) { var v = e.j - c.H; if ((v >= 8 && e.k > -4 && Math.abs(e.i) <= 4) ? Math.abs(e.i) % 2 === 1 : (v + 64) % 2 === 1) e.role = 'hairShade'; });
    }
  };
  /* which texture (MODES) a style draws with */
  var TEXTURE = { h_buzz: 'buzz', h_wavyshort: 'wavy', h_curlyshort: 'curly', h_coilyshort: 'coily', h_afro: 'coily', h_puffs: 'coily',
                  h_shoulderwavy: 'wavy', h_longcurly: 'curly', h_locs: 'locs' };

  /* the tail on 'hairTail' (head-relative cells) and where it hinges */
  var TAIL = {
    pony: { joint: [0, 9.5, -5], axis: 'z', cells: function (t) {                    /* a high ponytail: it shows over the crown */
      fill(t, -1, 1, 9, 10, -5, -5, null, 'hairShade');
      fill(t, -1, 1, 1, 10, -7, -6);
      t.put(0, 0, -6, 'hair');
    } },
    pig: { joint: [0, 5.5, -1], axis: 'x', cells: function (t) {
      [-1, 1].forEach(function (s) {
        t.put(s * 6, 5, -1, 'hairShade').put(s * 6, 6, -1, 'hairShade');
        fill(t, Math.min(s * 7, s * 8), Math.max(s * 7, s * 8), 0, 6, -2, -1);
      });
    } },
    braid: { joint: [0, 0.5, 3], axis: 'z', cells: function (t) {
      [-1, 1].forEach(function (s) {
        for (var v = 0; v >= -6; v--) for (var a = 3; a <= 4; a++) t.put(s * a, v, 3, 'hair');
        t.put(s * 3, -7, 3, 'hairShade').put(s * 4, -7, 3, 'hairShade');
        t.put(s * 3, -8, 3, 'hair').put(s * 4, -8, 3, 'hair');
      });
    } }
  };

  function hairCells(L) {
    var row = HAIR[L.hs], H = 11 + L.ht, mode = MODES[TEXTURE[row.id] || row.texture] || null, c = new Cells(H, mode), tail = null;
    STYLE[row.id](c);
    undersides(c, row.id === 'h_buzz');
    if (row.tail) {
      tail = new Cells(H, row.tail === 'braid' ? MODES.braid : mode);
      TAIL[row.tail].cells(tail);
      undersides(tail);
    }
    if (L.hc === SUNSET) tips(c, tail);
    return { c: c, tail: tail, row: row, H: H };
  }
  /* sunset tips: the bottom third of the hair's height in the tip colour */
  function tips(c, tail) {
    var lo = Infinity, hi = -Infinity, all = c.list().concat(tail ? tail.list() : []);
    all.forEach(function (e) { lo = Math.min(lo, e.j); hi = Math.max(hi, e.j); });
    var cut = lo + Math.max(1, Math.round((hi - lo + 1) / 3));
    all.forEach(function (e) { if (e.j < cut) e.role = e.role === 'hairShade' ? 'hairTipShade' : 'hairTip'; });
  }

  /* ================================================================
     HEAD COVERINGS (CH-D20): identity options, free, never sold or detected
     ================================================================ */
  /* the R11 shell (and under the chin) round the face opening */
  function shell(c, test) {
    for (var v = -1; v <= 9; v++) for (var i = -5; i <= 5; i++) for (var k = -5; k <= 4; k++) {
      if (!inR11(i, v, k) || inHead(i, v, k) || (v === 9 && Math.abs(i) === 4 && Math.abs(k) === 4)) continue;
      if (k === 4 && Math.abs(i) <= 3 && v > 0 && v < 8) continue;
      if (!test || test(i, v, k)) c.put(i, v, k, 'cover');
    }
    return c;
  }
  /* the rim round the face opening in the shade */
  function faceRim(c) {
    for (var v = 0; v <= 8; v++) { c.role(4, v, 4, 'coverShade'); c.role(-4, v, 4, 'coverShade'); }
    for (var i = -3; i <= 3; i++) { c.role(i, 8, 4, 'coverShade'); c.role(i, 0, 4, 'coverShade'); }
    return c;
  }
  /* the hem: every covering voxel with nothing of the covering (or the head) under it; front: only
     the band over the forehead (k ≥ 4) */
  function hem(c, front) {
    c.list().forEach(function (e) {
      var v = e.j - c.H;
      if (e.role === 'cover' && (!front || e.k >= 4) && !c.has(e.i, v - 1, e.k) && !inHead(e.i, v - 1, e.k)) e.role = 'coverShade';
    });
    return c;
  }
  var COVER = {
    cv_hijab: function (c) {
      shell(c);
      faceRim(c);
      for (var i = -3; i <= 3; i++) { c.put(i, -2, 3, 'cover'); c.put(i, -2, 4, 'cover'); c.put(i, -2, -4, 'coverShade'); c.put(i, -2, -3, 'cover'); }
      for (var i2 = -2; i2 <= 2; i2++) c.put(i2, -3, 4, 'cover');
      for (var i3 = -1; i3 <= 1; i3++) c.put(i3, -4, 4, 'coverShade');
      c.role(-3, -2, 4, 'coverShade').role(3, -2, 4, 'coverShade').role(-2, -3, 4, 'coverShade').role(2, -3, 4, 'coverShade');
      [-1, 1].forEach(function (s) { for (var k = -4; k <= 4; k++) c.role(s * 4, -1, k, 'coverShade'); });
    },
    cv_sporthijab: function (c) {
      shell(c, function (i, v, k) { return v >= 0 || (Math.abs(i) <= 3 && Math.abs(k) <= 3); });
      faceRim(c);
      for (var v = 0; v <= 8; v++) { c.role(5, v, 3, 'coverShade'); c.role(-5, v, 3, 'coverShade'); }
      for (var i = -3; i <= 3; i++) for (var k = -3; k <= 3; k++) if (Math.abs(i) === 3 || Math.abs(k) === 3) c.role(i, -1, k, 'coverShade');
    },
    cv_patka: function (c) {
      shell(c, function (i, v, k) { var ai = Math.abs(i); if (v < 0) return false; if (k === 4) return ai === 4 ? v >= 7 : v === 8; if (ai === 5 || (v === 0 && ai === 4)) return v >= 5; if (k <= -4) return v >= 3; return v >= 8; });
      hem(c);
      knot(c, function () { fill(c, -1, 1, 10, 10, -1, 2, function (i, v, k) { return !(Math.abs(i) === 1 && (k === -1 || k === 2)); }, 'cover'); c.role(0, 10, 2, 'coverShade'); c.put(0, 11, 0, 'cover', 'mid').put(0, 11, 1, 'cover', 'mid'); });
    },
    cv_turban: function (c) {
      /* wrapped high over the head (its vertical edges off), from the forehead, above the ears and
         down to the nape; a band proud of the forehead where the wraps cross in a V */
      fill(c, -5, 5, 4, 11, -6, 4, function (i, v, k) {
        var ai = Math.abs(i);
        if (v < (k >= 2 ? 8 : k >= -1 ? 6 : 4)) return false;
        return !(ai === 5 && (k === -6 || k === 4 || v === 11));
      }, 'cover');
      for (var v = 8; v <= 10; v++) for (var i = -4; i <= 4; i++) c.put(i, v, 5, 'cover');
      hem(c, true);
      [[0, 8], [-1, 9], [1, 9], [-2, 10], [2, 10]].forEach(function (p) { c.role(p[0], p[1], 5, 'coverShade'); });
    },
    cv_kippah: function (c, L, crown) {
      var y = crown.y - c.H, z = Math.round(crown.z) - 1;
      for (var i = -2; i <= 2; i++) for (var k = z - 2; k <= z + 2; k++) {
        var edge = Math.abs(i) === 2 || Math.abs(k - z) === 2;
        if (Math.abs(i) === 2 && Math.abs(k - z) === 2) continue;
        c.put(i, y, k, edge ? 'coverShade' : 'cover');
      }
    },
    cv_headwrap: function (c) {
      /* wrapped high over the top and down the back, a printed cloth (the leaf surface), tied in a
         bow at the front of the crown */
      fill(c, -5, 5, 3, 10, -6, 4, function (i, v, k) {
        if (v < (k >= 2 ? 8 : k >= -1 ? 5 : 3)) return false;
        return !(Math.abs(i) === 5 && (k === -6 || k === 4));
      }, 'cover');
      knot(c, function () { fill(c, -2, 2, 11, 11, 1, 3, function (i) { return i !== 0; }, 'cover'); c.put(0, 11, 2, 'coverShade'); });
    }
  };
  var COVER_MODE = { cv_turban: MODES.turban, cv_patka: MODES.patka, cv_headwrap: MODES.headwrap };
  function coveringCells(L, crown) {
    var row = COVERINGS[L.cv];
    if (!row) return null;
    var c = new Cells(11 + L.ht, COVER_MODE[row.id] || null);
    COVER[row.id](c, L, crown || hairCrown(L));
    return c;
  }
  /* which hair a covering hides (head-relative cell test) */
  function hidesHair(row) {
    if (!row || row.hides === 'none') return null;
    if (row.hides === 'all') return function () { return true; };
    if (row.hides === 'top') return function (i, v) { return v >= 3; };
    return function (i, v, k) { return v >= 5 || k <= -1; };
  }

  /* ================================================================
     GLASSES and HEARING AIDS (proud pieces: their own layers)
     ================================================================ */
  /* a 1-voxel frame round each eye on k = 5 (proud of the face plane), lenses empty, a bridge, temples
     back along the head to the ears; the sporty band runs on round the back instead */
  function glassesCells(L) {
    if (!L.gl) return null;
    var c = new Cells(11 + L.ht, null, L.ey), smiley = L.ey === 3, top = L.ey === 1 || smiley ? 6 : 5, in0 = smiley ? 0 : 1, st = L.gl;
    [-1, 1].forEach(function (s) {
      for (var a = in0; a <= 4; a++) for (var v = 2; v <= top; v++) {
        var edgeX = a === in0 || a === 4, edgeY = v === 2 || v === top;
        if (!edgeX && !edgeY) continue;
        if (st === 1 && edgeX && edgeY) continue;                       /* round: the corners off */
        if (st === 3 && edgeX && v === 2) continue;                     /* rectangle: a browline bar, a soft bottom */
        if (a === 1 && v === 2) continue;                               /* never over the smile's raised ends */
        if (st === 1 && a === 0 && v === top) continue;                 /* round over a smiley: a soft bridge */
        c.put(s * a, v, 5, 'frame');
      }
      if (st === 4) for (var k = -5; k <= 5; k++) c.put(s * 5, 4, k, 'frameShade');
      else { c.put(s * 5, 4, 5, 'frame', 'mid'); for (var k2 = 1; k2 <= 4; k2++) c.put(s * 5, 4, k2, 'frameShade', 'mid'); }
    });
    if (!smiley) c.put(0, st === 3 ? top : 4, 5, 'frame');                    /* the bridge (a smiley's frames share a column) */
    if (st === 4) for (var i = -4; i <= 4; i++) c.put(i, 4, -6, 'frameShade');
    return c;
  }
  /* the outer face of the hair or covering at the ear rows (where an aid or ear muff sits) */
  function earX(H, pieces) {
    var x = 4;
    pieces.forEach(function (c) {
      if (c) c.list().forEach(function (e) { if (!e.lod && e.j >= H + 3 && e.j <= H + 7 && e.k >= -2 && e.k <= 1) x = Math.max(x, Math.abs(e.i)); });
    });
    return x;
  }
  function aidCells(L, under) {
    if (!L.ha) return null;
    var row = COVERINGS[L.cv];
    if (row && row.ears) return null;                                   /* never over a hijab */
    var H = 11 + L.ht, c = new Cells(H), x = earX(H, under || []) + 1;
    [-1, 1].forEach(function (s) {
      if (L.ha === 1) c.put(s * x, 4, -1, 'aid').put(s * x, 5, -1, 'aid');
      else c.put(s * x, 6, -1, 'aid').put(s * x, 7, -1, 'aid').put(s * x, 6, 0, 'aid').put(s * x, 7, 0, 'aid');
    });
    return c;
  }

  /* ================================================================
     CROWNS (CH-D9: hats sit on the crown descriptor), measured from the voxels themselves, so a
     hat always rests on hair (or the head) and never cuts through a bun, a puff or a knot
     ================================================================ */
  function flagsOf(f) { var o = {}; Object.keys(f || {}).forEach(function (k) { if (f[k]) o[k] = true; }); return o; }
  function fk(i, k) { return (i + 64) * 256 + (k + 64); }
  /* the 6-connected groups of feature voxels, as boxes (voxel faces, like the box lists) */
  function featureBoxes(cells) {
    var left = new Map(), out = [];
    cells.forEach(function (e) { left.set(key(e.i, e.j, e.k), e); });
    left.forEach(function (start, k0) {
      if (!left.has(k0)) return;
      var stack = [start], b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
      left.delete(k0);
      while (stack.length) {
        var e = stack.pop();
        b.x0 = Math.min(b.x0, e.i - 0.5); b.x1 = Math.max(b.x1, e.i + 0.5); b.y0 = Math.min(b.y0, e.j); b.y1 = Math.max(b.y1, e.j + 1);
        b.z0 = Math.min(b.z0, e.k - 0.5); b.z1 = Math.max(b.z1, e.k + 0.5);
        [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(function (d) {
          var kk = key(e.i + d[0], e.j + d[1], e.k + d[2]);
          if (left.has(kk)) { stack.push(left.get(kk)); left.delete(kk); }
        });
      }
      out.push(b);
    });
    return out.sort(function (a, b) { return a.x0 - b.x0 || a.z0 - b.z0; });
  }
  /* list: the cell stores on the head (hair kept, covering), tail: the hairTail store */
  function measure(list, tail, H, flags) {
    var base = [], feats = [], knots = [], top = H + 9, ytop = H + 8, i, k;
    list.forEach(function (c) { if (c) c.list().forEach(function (e) { if (!e.lod) (e.feat === 'knot' ? knots : e.feat ? feats : base).push(e); }); });
    base.forEach(function (e) { ytop = Math.max(ytop, e.j); });
    feats.concat(knots, base, tail ? tail.list().filter(function (e) { return !e.lod; }) : []).forEach(function (e) { top = Math.max(top, e.j + 1); });
    /* the flat: what holds the row under y (the head's own top when nothing covers it); a knot lifts
       the hat over itself */
    var F = new Set(), y = ytop + 1, kmin = Infinity, kmax = -Infinity;
    knots.forEach(function (e) { y = Math.max(y, e.j + 1); });
    base.forEach(function (e) { if (e.j === ytop) F.add(fk(e.i, e.k)); });
    if (ytop === H + 8) for (i = -3; i <= 3; i++) for (k = -3; k <= 3; k++) F.add(fk(i, k));
    F.forEach(function (n) { var kk = (n % 256) - 64; kmin = Math.min(kmin, kk); kmax = Math.max(kmax, kk); });
    var zc = Math.round((kmin + kmax) / 2), a = 0, k0 = zc, k1 = zc;
    while (F.has(fk(a + 1, zc)) && F.has(fk(-a - 1, zc))) a++;
    while (F.has(fk(0, k0 - 1))) k0--;
    while (F.has(fk(0, k1 + 1))) k1++;
    /* features over the flat: the hat goes in front of them, or between them, whichever is bigger */
    var blocked = feats.filter(function (e) { return e.j >= y && Math.abs(e.i) <= a && e.k >= k0 && e.k <= k1; });
    if (blocked.length) {
      var front = -Infinity, near = Infinity;
      blocked.forEach(function (e) { front = Math.max(front, e.k); near = Math.min(near, Math.abs(e.i)); });
      var fr = { a: a, k0: front + 1, k1: k1 }, bw = { a: near - 1, k0: k0, k1: k1 };
      var area = function (r) { return r.a < 0 || r.k1 < r.k0 ? 0 : (2 * r.a + 1) * (r.k1 - r.k0 + 1); };
      var pick = area(fr) >= area(bw) ? fr : bw;
      a = Math.max(0, pick.a); k0 = pick.k0; k1 = Math.max(pick.k0, pick.k1);
    }
    /* what a pulled-on hat wraps: the top three rows */
    var ow = 0, ok0 = Infinity, ok1 = -Infinity, ear = 4.5, back = -4.5, low = Infinity;
    base.forEach(function (e) {
      if (e.j >= y - 3) { ow = Math.max(ow, Math.abs(e.i)); ok0 = Math.min(ok0, e.k); ok1 = Math.max(ok1, e.k); }
      if (e.j >= H + 3 && e.j <= H + 6 && e.k >= -2 && e.k <= 1) ear = Math.max(ear, Math.abs(e.i) + 0.5);
      back = Math.min(back, e.k - 0.5);
      if (e.k <= -4 && Math.abs(e.i) <= 3) low = Math.min(low, e.j);
    });
    if (!(ok1 >= ok0)) { ow = 4; ok0 = -4; ok1 = 4; }
    var out = { y: y, w: 2 * a + 1, d: k1 - k0 + 1, x: 0, z: (k0 + k1) / 2, top: top, outer: { w: 2 * ow + 1, d: ok1 - ok0 + 1, z: (ok0 + ok1) / 2 },
                ear: { x: ear, y0: H + 3, y1: H + 4 }, back: { z: back, y: low === Infinity ? null : low }, flags: flags };
    if (y >= H + 11) out.flags.tall = true;
    if (feats.length || knots.length) out.features = featureBoxes(feats.concat(knots));
    return out;
  }
  function keptHair(L, h, hide) {
    var kept = new Cells(h.H, h.c.mode);
    h.c.list().forEach(function (e) { if (!(hide && hide(e.i, e.j - h.H, e.k))) kept.add(e); });
    return kept;
  }
  /* the hair's own crown */
  function hairCrown(L, built) {
    var h = built || hairCells(L);
    return measure([h.c], h.tail, h.H, flagsOf(HAIR[L.hs].flags));
  }
  function crownOf(l) {
    var L = lookOf(l), row = COVERINGS[L.cv], h = hairCells(L), crown = hairCrown(L, h);
    if (!row) return crown;
    if (row.id === 'cv_kippah') { crown.flags.kippah = true; return crown; }
    var flags = flagsOf(row.flags);
    if (row.neck) flags.neck = true;
    return measure([keptHair(L, h, hidesHair(row)), coveringCells(L, crown)], null, h.H, flags);
  }
  function hairTailOf(l) {
    var L = lookOf(l), row = HAIR[L.hs], cvr = COVERINGS[L.cv];
    if (!row.tail || (cvr && cvr.hides !== 'none')) return null;
    var T = TAIL[row.tail], j = T.joint, at = [j[0], 11 + L.ht + j[1], j[2]];
    return { bone: 'hairTail', parent: 'head', joint: at, at: at.map(function (v) { return Math.round(v * GC * 1e6) / 1e6; }), axis: T.axis, maxDeg: 10, maxHz: 1.6 };
  }
  function earsHidden(l) {
    var L = lookOf(l), h = hairCells(L), row = COVERINGS[L.cv], H = h.H;
    var kept = keptHair(L, h, hidesHair(row)), cov = coveringCells(L, hairCrown(L, h)), hit = 0;
    [kept, cov].forEach(function (c) { if (c) c.list().forEach(function (e) { if (!e.lod && Math.abs(e.i) === 5 && e.k === 0 && e.j >= H + 3 && e.j <= H + 4) hit++; }); });
    return hit >= 4;
  }
  function covers(l) {
    var row = COVERINGS[lookOf(l).cv];
    if (!row) return { hair: 'none', ears: false, neck: false, tail: false };
    return { hair: row.hides, ears: row.ears, neck: row.neck, tail: row.hides !== 'none' };
  }

  /* ================================================================
     BOXES (the greedy packer) and the public builders
     ================================================================ */
  /* cells → disjoint boxes on bone b: runs along x, grown along z, then along y, of one (tag, lod,
     mode); tokens → each box's c (else c is the tag) */
  function boxes(cells, tokens, proud, bone) {
    var list = Array.isArray(cells) ? cells : cells.list(), m = new Map(), done = new Set(), out = [];
    list.forEach(function (e) { m.set(key(e.i, e.j, e.k), e); });
    list = list.slice().sort(function (a, b) { return a.j - b.j || a.k - b.k || a.i - b.i; });
    function same(i, j, k, e) { var o = m.get(key(i, j, k)); return !!o && !done.has(o) && o.role === e.role && o.lod === e.lod && o.mode === e.mode; }
    list.forEach(function (e) {
      if (done.has(e)) return;
      var i1 = e.i, k1 = e.k, j1 = e.j, ok, i, k;
      while (same(i1 + 1, e.j, e.k, e)) i1++;
      for (;;) { ok = true; for (i = e.i; i <= i1 && ok; i++) ok = same(i, e.j, k1 + 1, e); if (!ok) break; k1++; }
      for (;;) { ok = true; for (k = e.k; k <= k1 && ok; k++) for (i = e.i; i <= i1 && ok; i++) ok = same(i, j1 + 1, k, e); if (!ok) break; j1++; }
      for (var j = e.j; j <= j1; j++) for (k = e.k; k <= k1; k++) for (i = e.i; i <= i1; i++) done.add(m.get(key(i, j, k)));
      var b = { b: bone || 'head', c: tokens ? tokens[e.role] || tokens.hair : e.role, x0: e.i - 0.5, x1: i1 + 0.5, y0: e.j, y1: j1 + 1, z0: e.k - 0.5, z1: k1 + 0.5, tag: e.role };
      if (e.mode) b.mode = e.mode;
      if (e.lod) b.lod = e.lod;
      if (proud) b.proud = true;
      out.push(b);
    });
    return out;
  }
  function cells(b) {
    var out = [];
    for (var j = b.y0; j < b.y1; j++) for (var k = b.z0 + 0.5; k < b.z1; k++) for (var i = b.x0 + 0.5; i < b.x1; i++) out.push([i, j, k, b]);
    return out;
  }
  function cellsOf(pieces) {
    var out = [];
    Object.keys(pieces || {}).forEach(function (bone) { (pieces[bone] || []).forEach(function (b) { cells(b).forEach(function (c) { c.push(bone); out.push(c); }); }); });
    return out;
  }
  function pack(c, tokens, proud) { return { head: c && c.size() ? boxes(c, tokens, proud) : [] }; }

  function hair(l, o) {
    o = o || {};
    var L = lookOf(l), h = hairCells(L), tk = tokensOf(L);
    function keep(e) { return !(o.omit && o.omit(e.i, e.j, e.k)) && !(o.front && e.k < 4); }
    var out = { head: boxes(h.c.list().filter(keep), tk) };
    if (h.tail && !o.front) { var t = h.tail.list().filter(keep); if (t.length) out.hairTail = boxes(t, tk, false, 'hairTail'); }
    return out;
  }
  function covering(l) { var L = lookOf(l); return pack(coveringCells(L), tokensOf(L)); }
  function glasses(l) { var L = lookOf(l); return pack(glassesCells(L), tokensOf(L), true); }
  function aid(l) {
    var L = lookOf(l), h = hairCells(L), cov = coveringCells(L, hairCrown(L, h));
    return pack(aidCells(L, [keptHair(L, h, hidesHair(COVERINGS[L.cv])), cov]), tokensOf(L), true);
  }
  /* the four identity pieces on the head, in order: the grid pieces as one disjoint list (a later
     voxel wins), then the proud pieces as their own layers */
  function headPieces(l, o) {
    o = o || {};
    var L = lookOf(l), tk = tokensOf(L), row = COVERINGS[L.cv], h = hairCells(L), crown = hairCrown(L, h);
    var cov = coveringCells(L, crown), kept = keptHair(L, h, hidesHair(row)), grid = new Map(), joints = {};
    kept.list().forEach(function (e) { if (!(o.omit && o.omit(e.i, e.j, e.k))) grid.set(key(e.i, e.j, e.k), e); });
    if (cov) cov.list().forEach(function (e) { grid.set(key(e.i, e.j, e.k), e); });
    var head = boxes(Array.from(grid.values()), tk), gl = o.coversEyes ? null : glassesCells(L), ad = aidCells(L, [kept, cov]);
    if (gl) head = head.concat(boxes(gl, tk, true));
    if (ad) head = head.concat(boxes(ad, tk, true));
    var out = { head: head }, tailRow = hairTailOf(L);
    if (tailRow && h.tail) {
      var tail = h.tail.list().filter(function (e) { return !(o.omit && o.omit(e.i, e.j, e.k)); });
      if (tail.length) { out.hairTail = boxes(tail, tk, false, 'hairTail'); joints.hairTail = tailRow.at; }
    }
    Object.defineProperty(out, 'joints', { value: joints });
    return out;
  }

  return {
    VERSION: VERSION, GC: GC, DEFAULTS: DEFAULTS, ROLES: ROLES, BUDGET: BUDGET, HAIR: HAIR, COVERINGS: COVERINGS, GLASSES: GLASSES,
    AIDS: AIDS, TOKENS: TOKENS, MODES: MODES, EYES: EYES, look: lookOf, headOf: headOf, tokensOf: tokensOf, inHead: inHead, inFace: inFace, inEye: inEye,
    hair: hair, covering: covering, glasses: glasses, aid: aid, headPieces: headPieces, crownOf: crownOf, hairTailOf: hairTailOf,
    covers: covers, earsHidden: earsHidden, boxes: boxes, cells: cells, cellsOf: cellsOf
  };
}));
