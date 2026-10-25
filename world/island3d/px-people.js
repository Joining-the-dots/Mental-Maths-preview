/* ================================================================
   My Island v3, kids update — SLPxPeople (KU-CH9): the 3D people. The people's pure box lists
   (SLPeopleShapesBody / Hair / Wear / Acc, characters.json CH-D8: one recipe, two renderers) become
   VoxModels per bone, then ONE vox rig (a SkinnedMesh drawn by the 'pixel-vox' program, glow parts
   included), the AvatarRig shape the island, the photocards and the games already drive.
   window.SLPxPeople in the browser (stage.js FILES, group 'vox', after px-landmarks.js: KU_VOX),
   module.exports in Node. The shapes files load lazily (window.slLoadPeople, KU21): ready() says
   whether they are here; without them the classic avatar stays (px-crew makeAvatar, KU-CH12).

   ASSEMBLY (a person = one box list over the bones, later boxes painting over earlier ones):
     the body in the plain layer minus what the garments replace (KU-CH4) → the head (ears unless
     the hair or covering hides them) and face → hair, covering, glasses (not under a coversEyes
     piece), hearing aid (KU-CH5; a hat's own volume omitted, a hood up leaves only the face
     opening's fringe) → garments (KU-CH7) → accessories (KU-CH8), through the shapes files' own
     dress(): SLPeopleShapesAcc.dress(look, show, vr, o) first (its hidden omit / coversEyes /
     earsHidden / hideKippah / joints feed the rest), then SLPeopleShapesWear.dress(look, wear, vr,
     {member, tier, coversEyes, omit}) for the figure; the plain layer (body + hair) when they are not
     loaded. A piece's catalogue icon is that file's display(id, o). The hand: an empty hand or the
     Spark Stick draws px-crew's 4-point ✦ stick on 'wand', folded until setWand(true); any other
     hand item stays in the hand and never tilts. The member colour (classic hoodie, Spark Stick)
     is a state colour whose runtime hex travels in the state's map, never as a token.
   BONES: base body head armL armR legL legR wand eyes (the blink), plus OPTIONAL hairTail, cape0-2,
     visor and antenna, built only when the look or wear has voxels on them (OPTIONAL is pinned).
     Joints from the body descriptor (shape 1 / height 0 = SLPxCrew.AV.J), the hair tail's from
     SLPeopleShapesHair.hairTailOf, a piece's helper bones from its joints, else the defaults here.
   TOKENS: people-core's TOKENS (the KU23 'PX Skin n' … names, each with its ' Shade') through
     SLIslandLook.addTokens('px-people', …) (first wins, never over a look table name); the garment
     and accessory files register their own; a box token the look still cannot resolve is resolved
     by the shapes files' hexOf and added the same way. No raw hex in a palette.
   CAPS (characters.json voxelLook.budgets): PEOPLE_CAPS {bare 820, dressed 1,300 MID / HIGH,
     dressedLow 1,000 LOW} triangles, one draw. Pieces are trimmed in data (their 'mid' details drop
     on LOW before rasterising), never at runtime.

   API
     ready() → bool (body + hair shapes present)       OPTIONAL · PARENT · PEOPLE_CAPS · TOKENS()
     describe(opts) → desc {look, worn, show, hidden, vr, flags, member, lk, wr, sig, piece, key}
                      opts {look | lk, wear | wr, vr, member, char (a cast id: its default look and
                      own wear), fitting + piece (the Fitting Friend wearing one piece), photocard, sig}
     boxes(desc, {tier, rig}) → {list, joints, hand: 'spark' | 'item' | null}   the person as one box
                      list (a static figure's empty hand holds nothing; a rig's holds the folded stick)
     bones(desc, {tier, rig}) → {bone: VoxModel} (+ hidden .joints, .optional, .hand), memoised per
                      look, wear, colourway, member, tier and the shapes files present · clearMemo()
     jointsOf(desc) → {bone: [x, y, z] u}    tris(desc, tier)    voxels(desc, {tier}) → one static VoxModel
     bakePose(desc, pose | {clip, t, opts}, {tier}) → one static VoxModel in that pose (static figures:
                      each bone's voxels resampled through the posed bone, eyes painted onto the face)
     display(st, tier) → VoxModel   the px-people handler's voxels (stage voxRoute 'char' / 'wear'):
                      a char id in its default look and own pieces (or st.look / lk / wear / wr / vr),
                      a wear id on the Fitting Friend (or on st.look), a dye on 'Me' in that colour
     makePerson(SL3D, opts, tier) → PersonRig: the AvatarRig shape {root, bones, sockets {hand,
       handL}, anchors {top}, pose, meshes, color, tier, tris, h, setPose, setShow, setWand, play(clip,
       t, opts), info(clip), dispose} plus {lk, wr, sig, blinkAt(t), optional}. play() drives the
       unchanged clip layer (SLCharacters.sampleAvatar, the rig's body centre as o.bodyY), the blink
       (avatarBlink: off under reduced motion and on photocards; smiley eyes never blink), the hair
       sway (hairSway ≤ 1.6 Hz), the cape hinges from opts.speed, Lena's visor and Priya's antenna
       (avatarExtras) and Jude's ✦ burst (8 glow cubes, an extra draw only while it plays).
     register(SL3D): defineVox('people', {px_people}) and defineVoxApi('makePerson').
   Nothing here reads, awards or spends anything; no random numbers, no storage, no network.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else {
    root.SLPxPeople = api;
    if (root.SL3D && typeof root.SL3D.defineVox === 'function') api.register(root.SL3D);
  }
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  /* ---------------- siblings: the page's globals, else one require() in Node ---------------- */
  var sibs = {};
  function sibling(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!Object.prototype.hasOwnProperty.call(sibs, name)) { try { sibs[name] = require(path) || null; } catch (e) { sibs[name] = null; } }
    return sibs[name];
  }
  function vox() { var V = sibling('SLVox', './vox.js'); if (!V) throw new Error('SLPxPeople: vox.js (SLVox) is not loaded'); return V; }
  function look() { return sibling('SLIslandLook', '../world-look.js'); }
  function clips() { return sibling('SLCharacters', './models-characters.js'); }
  function crew() { return sibling('SLPxCrew', './px-crew.js'); }
  function core() { return sibling('SLPeopleCore', '../people-core.js'); }
  function body() { return sibling('SLPeopleShapesBody', '../people-shapes-body.js'); }
  function hair() { return sibling('SLPeopleShapesHair', '../people-shapes-hair.js'); }
  function wearMod() { return sibling('SLPeopleShapesWear', '../people-shapes-wear.js'); }
  function accMod() { return sibling('SLPeopleShapesAcc', '../people-shapes-acc.js'); }

  var VERSION = 1, GC = 0.05, DEG = Math.PI / 180, PROUD = 0.03, SOURCE = 'px-people', HANDLER = 'px_people';
  var BASE_BONES = ['base', 'body', 'head', 'armL', 'armR', 'legL', 'legR', 'wand', 'eyes'];
  var OPTIONAL = ['hairTail', 'cape0', 'cape1', 'cape2', 'visor', 'antenna'];
  var PARENT = { base: null, body: 'base', head: 'body', armL: 'body', armR: 'body', legL: 'base', legR: 'base', wand: 'armR', eyes: 'head',
                 hairTail: 'head', cape0: 'body', cape1: 'cape0', cape2: 'cape1', visor: 'head', antenna: 'body' };
  var PEOPLE_CAPS = { bare: 820, dressed: 1300, dressedLow: 1000 };
  var TILT = 70, BURST = 8, MEMBER = 'Bubblegum', MEMBER_SHADE = 'Rose Deep';
  var CAPE = { lift: [14, 9, 6], wave: 4, hz: 1.2, full: 3 };              /* hinge degrees at full speed; a ≤ 1.2 Hz ripple */
  var CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*+-/:;<=>?@^_`|~';
  var TIER_RANK = { LOW: 0, MID: 1, HIGH: 2 };

  /* ---------------- small helpers ---------------- */
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function tierOf(t) { var u = typeof t === 'string' ? t.toUpperCase() : ''; return own(TIER_RANK, u) ? u : 'HIGH'; }
  function normHex(h) { var m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? '#' + m[1].toUpperCase() : null; }
  function hash(s) { s = String(s); var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function tokenOf(c) { return typeof c === 'string' ? c : c && typeof c.token === 'string' ? c.token : null; }

  /* ================================================================
     TOKENS (KU23): first wins, never over a look table name
     ================================================================ */
  var tokenNote = { added: [], refused: [] };
  function hexMap(m) {
    var out = {};
    if (plain(m)) Object.keys(m).forEach(function (k) { var h = normHex(m[k]); if (h && /^PX /.test(k)) out[k] = h; });
    return out;
  }
  /* the identity tokens (people-core TOKENS: KU23's 'PX Skin n' … names with their Shades). The
     garment and accessory files register their own cloth tokens; a box token still unresolved when
     a person is built is added here from its file's hexOf (ensureToken) */
  function tokenTable() { var P = core(); return hexMap(P && P.TOKENS); }
  function addTokens(map) {
    var L = look();
    if (!L || typeof L.addTokens !== 'function' || !Object.keys(map).length) return;
    var r = L.addTokens(SOURCE, map);
    (r.added || []).forEach(function (n) { if (tokenNote.added.indexOf(n) < 0) tokenNote.added.push(n); });
    (r.refused || []).forEach(function (x) { tokenNote.refused.push(x); });
  }
  var registeredFrom = null;
  function registerTokens() {
    var t = tokenTable(), key = Object.keys(t).length + ':' + modTag(core());
    if (registeredFrom === key) return;
    registeredFrom = key;
    addTokens(t);
  }
  /* a box token the look cannot resolve yet: its hex from a shapes file (hexOf), added once */
  function ensureToken(tok) {
    var L = look();
    if (!tok || !L || typeof L.resolve !== 'function' || L.resolve(tok)) return;
    var hx = null;
    [body(), wearMod(), accMod()].some(function (M) { if (M && typeof M.hexOf === 'function') { try { hx = normHex(M.hexOf(tok)); } catch (e) { hx = null; } } return !!hx; });
    if (hx) { var m = {}; m[tok] = hx; addTokens(m); }
  }

  /* ================================================================
     THE DESCRIPTION: what is drawn (people-core resolve when present)
     ================================================================ */
  var SLOTS = ['top', 'bottom', 'shoes', 'outfit', 'head', 'face', 'neck', 'back', 'hand'];
  function ready() { var B = body(), H = hair(); return !!(B && typeof B.person === 'function' && H && typeof H.headPieces === 'function'); }
  function describe(opts) {
    opts = opts || {};
    var P = core(), B = body(), lk = opts.look, wear = opts.wear, vr = opts.vr;
    if (opts.char && P && typeof P.display === 'function') {
      var d = P.display(opts.char);
      if (d) { if (!plain(lk) && typeof opts.lk !== 'string') lk = d.look; if (!plain(wear) && typeof opts.wr !== 'string') wear = d.wear; }
    }
    if (!plain(lk) && typeof opts.lk === 'string' && P && typeof P.parseLookCode === 'function') lk = P.parseLookCode(opts.lk);
    if (!plain(wear) && typeof opts.wr === 'string' && P && typeof P.parseWearCode === 'function') {
      var pw = P.parseWearCode(opts.wr);
      if (pw) { wear = pw.wear; if (!plain(vr)) vr = pw.vr; }
    }
    var out;
    if (P && typeof P.resolve === 'function') {
      var r = P.resolve(lk, wear, vr);
      out = { look: r.look, worn: r.worn, show: r.show, hidden: r.hidden, vr: r.vr, flags: r.flags };
    } else {
      var l = B ? B.drawLook(lk) : {}, show = {};
      SLOTS.forEach(function (s) { if (plain(wear) && typeof wear[s] === 'string') show[s] = wear[s]; });
      out = { look: l, show: show, hidden: {}, vr: plain(vr) ? vr : {}, flags: { hair: l.hs !== 0, glasses: l.gl > 0, hood: false, spark: !show.hand || show.hand === 'wear_free_spark' } };
    }
    out.fitting = !!opts.fitting;
    out.piece = out.fitting && typeof opts.piece === 'string' ? opts.piece : null;
    out.member = normHex(opts.member);
    out.photocard = !!opts.photocard;
    out.lk = P && typeof P.lookCode === 'function' ? P.lookCode(out.look) : JSON.stringify(out.look);
    out.wr = P && typeof P.wearCode === 'function' ? P.wearCode(out.show, out.vr) : JSON.stringify([out.show, out.vr]);
    var c = opts.char && P && typeof P.castOf === 'function' ? P.castOf(opts.char) : null;
    out.sig = c && c.move ? c.move.id : (typeof opts.sig === 'string' ? opts.sig : null);
    out.key = (out.fitting ? 'F' + (out.piece || '') + ':' + num(out.vr[out.piece], 0) + '|' : '') + out.lk + '|' + out.wr + '|' + (out.member || '-');
    return out;
  }
  function itemOf(id) { var P = core(); return P && typeof P.item === 'function' ? P.item(id) : null; }
  function flagged(id, f) { var it = itemOf(id); return !!(it && it.flags && it.flags.indexOf(f) >= 0); }

  /* ================================================================
     ASSEMBLY: body → face → identity pieces → garments → accessories
     ================================================================ */
  /* the shapes files' entry points, feature-detected: KU-CH7 SLPeopleShapesWear.dress(look, wear, vr,
     o) (the figure without accessories) and .display(id, o), KU-CH8 SLPeopleShapesAcc.dress(look,
     show, vr, o) (every shown accessory, with its hidden omit / coversEyes / earsHidden /
     hideKippah / spark / joints) and .display(id, o). A throw is a missing file: the plain layer. */
  function call(M, name, args) {
    if (!M || typeof M[name] !== 'function') return null;
    try { var r = M[name].apply(M, args); return r && typeof r === 'object' ? r : null; } catch (e) { return null; }
  }
  function boneLists(r) {
    var out = {};
    if (r) Object.keys(r).forEach(function (b) { if (Array.isArray(r[b]) && own(PARENT, b)) out[b] = r[b].slice(); });
    return out;
  }
  function jointsFrom(r, into) {
    var j = r && r.joints;
    if (plain(j)) Object.keys(j).forEach(function (b) { if (own(PARENT, b) && Array.isArray(j[b]) && j[b].length >= 3 && j[b].every(isFinite)) into[b] = j[b].slice(0, 3).map(Number); });
    return into;
  }
  function wearPiece(id) { var W = wearMod(); return !!(W && typeof W.has === 'function' && W.has(id)); }
  function accPiece(id) { var A = accMod(); return !!(A && ((A.PIECES && own(A.PIECES, id)) || (Array.isArray(A.DYE_IDS) && A.DYE_IDS.indexOf(id) >= 0))); }
  function noEars(list) { if (list.head) list.head = list.head.filter(function (bx) { return bx.tag !== 'ear'; }); return list; }
  /* the whole person as one box list → {list, joints, hand: 'spark' (the stick: folded on a rig until
     Showtime) | 'item' (a held piece: always shown, never tilted) | null}; o {tier, rig} */
  function boxes(desc, o) {
    var B = body(), H = hair(), rig = !!(o && o.rig), tier = o && o.tier;
    if (!B || !H) throw new Error('SLPxPeople: the people shapes (body, hair) are not loaded');
    var W = wearMod(), A = accMod(), lk = desc.look, joints = {}, list;
    if (desc.piece) {                                        /* one piece on the Fitting Friend: the catalogue icon */
      var mo = { cw: num(desc.vr[desc.piece], 0), member: desc.member, tier: tier };
      var r = wearPiece(desc.piece) ? call(W, 'display', [desc.piece, mo]) : accPiece(desc.piece) ? call(A, 'display', [desc.piece, mo]) : null;
      list = r ? boneLists(r) : B.fittingFriend({});
      jointsFrom(r, joints);
      return { list: list, joints: joints, hand: desc.piece === 'wear_free_spark' ? 'spark' : list.wand ? 'item' : null };
    }
    var acc = call(A, 'dress', [lk, desc.show, desc.vr, { member: desc.member, tier: tier }]);
    var coversEyes = !desc.flags.glasses || !!(acc && acc.coversEyes), omit = acc && typeof acc.omit === 'function' ? acc.omit : null;
    var hl = acc && acc.hideKippah && lk.cv === 5 ? Object.assign({}, lk, { cv: 0 }) : lk;
    var fig = call(W, 'dress', [hl, desc.worn || desc.show, desc.vr, { member: desc.member, tier: tier, coversEyes: coversEyes, omit: omit }]);
    if (fig) { list = boneLists(fig); jointsFrom(fig, joints); }
    else {
      /* the plain layer (KU-CH4) with the identity pieces (KU-CH5): a hood up keeps only the face
         opening's fringe, a hat's own volume drops the hair under it */
      var hood = !!desc.flags.hood, om = function (i, j, k) { return (hood && k < 4) || (omit ? !!omit(i, j, k) : false); };
      var head = H.headPieces(hl, { omit: hood || omit ? om : null, coversEyes: coversEyes });
      if (hood) delete head.hairTail;
      list = B.merge(B.person(hl), head);
      if (head.hairTail && head.joints && head.joints.hairTail) joints.hairTail = head.joints.hairTail.slice();
      if (hood || (typeof H.earsHidden === 'function' && H.earsHidden(hl))) noEars(list);
    }
    if (acc) { if (acc.earsHidden) noEars(list); list = B.merge(list, boneLists(acc)); jointsFrom(acc, joints); }
    if (!rig && !desc.show.hand) delete list.wand;           /* a static figure's empty hand holds nothing */
    return { list: list, joints: joints, hand: desc.flags.spark ? 'spark' : 'item' };
  }

  /* ---------------- joints (u, item space at rest) ---------------- */
  function jointsOf(desc, asm) {
    var B = body(), lk = desc.look, D = B.bodyOf(lk.bd, lk.ht), J = B.jointsOf(lk), T = D.torso, out = {};
    BASE_BONES.forEach(function (b) { out[b] = (J[b] || [0, 0, 0]).slice(); });
    var tz = T.z0 * GC, top = T.y1 * GC, hb = D.head.y0 * GC;
    var dflt = { hairTail: [0, r6(hb + 9 * GC), r6(-4.5 * GC)], cape0: [0, r6(top), r6(tz - GC)], cape1: [0, r6(top - 3 * GC), r6(tz - GC)],
                 cape2: [0, r6(top - 6 * GC), r6(tz - GC)], visor: [0, r6(hb + 7.5 * GC), r6(4.5 * GC)], antenna: [0, r6(top), r6(tz - 2 * GC)] };
    var given = asm && asm.joints || {};
    OPTIONAL.forEach(function (b) { out[b] = (given[b] || dflt[b]).map(r6); });
    return out;
  }

  /* ================================================================
     BOX LIST → VoxModels per bone (one layer per bone + lattice; proud layers inflated)
     ================================================================ */
  function entryOf(bx, desc) {
    var c = bx.c, e = typeof c === 'string' ? { token: c } : Object.assign({}, c);
    if (bx.mode && !e.mode) e.mode = bx.mode;
    if (e.state && (e.state.key === 'member' || e.state.key === 'memberShade') && desc.member) {
      e.state = Object.assign({}, e.state, { map: { own: e.state.key === 'member' ? desc.member : memberShade(desc.member) } });
    }
    delete e.lod;                                  /* lod is the box's (skipped before rasterising), never the palette's */
    return e;
  }
  function memberShade(hex) { var C = crew(); return C && typeof C.shadeOf === 'function' ? C.shadeOf(hex) : hex; }
  function toModels(list, desc, tier) {
    var B = body(), V = vox(), out = {}, keys = {};
    B.raster(list, { tier: tier }).forEach(function (ly) {
      var b = ly.bone, m = out[b];
      if (!m) { m = out[b] = { id: 'person:' + b, grid: GC, origin: [0, 0, 0], ground: false, palette: {}, layers: [] }; keys[b] = {}; }
      var cells = Object.keys(ly.cells), n = cells.length, ijk = new Int32Array(n * 3), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      if (!n) return;
      for (var c = 0; c < n; c++) {
        var s = cells[c], p0 = s.indexOf(','), p1 = s.indexOf(',', p0 + 1), i = +s.slice(0, p0), j = +s.slice(p0 + 1, p1), k = +s.slice(p1 + 1);
        ijk[c * 3] = i; ijk[c * 3 + 1] = j; ijk[c * 3 + 2] = k;
        if (i < lo[0]) lo[0] = i; if (j < lo[1]) lo[1] = j; if (k < lo[2]) lo[2] = k;
        if (i + 1 > hi[0]) hi[0] = i + 1; if (j + 1 > hi[1]) hi[1] = j + 1; if (k + 1 > hi[2]) hi[2] = k + 1;
      }
      var e = ly.proud ? PROUD : 0, g = [0, 1, 2].map(function (a) { var w = hi[a] - lo[a], sz = ly.size[a]; return r6((w * sz + 2 * e) * GC / w); });
      var grid = V.grid({ grid: g, origin: [0, 0, 0] }), byBox = new Map();
      for (c = 0; c < n; c++) {
        var bx = ly.cells[cells[c]], ch = byBox.get(bx);
        if (ch === undefined) {                    /* one palette entry per distinct box (many cells share one) */
          var ent = entryOf(bx, desc), kk = JSON.stringify(ent);
          ch = keys[b][kk];
          if (!ch) { ch = keys[b][kk] = CHARS[Object.keys(keys[b]).length]; m.palette[ch] = ent; ensureToken(ent.token); }
          byBox.set(bx, ch);
        }
        grid.set(ijk[c * 3] - lo[0], ijk[c * 3 + 1] - lo[1], ijk[c * 3 + 2] - lo[2], ch);
      }
      m.layers.push({ grid: g, origin: [0, 0, 0], at: [0, 1, 2].map(function (a) { return r6((ly.phase[a] + lo[a] * ly.size[a] - e) * GC); }), vox: grid.snapshot() });
    });
    return out;
  }
  /* the Spark Stick on 'wand' (px-crew's 4-point ✦, the classic avatar's own), its grip on the hand */
  function stickModel(desc, J) {
    var C = crew();
    if (!C || typeof C.wandVoxels !== 'function') return null;
    var m = C.wandVoxels({ color: desc.member }), at = [J.wand[0], r6(J.wand[1] - GC), J.wand[2]];
    m.id = 'person:wand';
    m.layers.forEach(function (ly) { ly.at = [0, 1, 2].map(function (a) { return r6(num(ly.at && ly.at[a], 0) + at[a]); }); });
    return m;
  }
  /* the per-bone models of a description at a tier, memoised (a look, wear or colourway change
     rebuilds; anything else reuses) */
  var memo = [], MEMO_MAX = 12, modIds = typeof WeakMap === 'function' ? new WeakMap() : null, modSeq = 0;
  /* which shapes files built it (a file arriving later, slLoadPeople, never leaves a stale entry) */
  function modTag(M) { if (!M) return '-'; if (!modIds) return '+'; if (!modIds.has(M)) modIds.set(M, ++modSeq); return String(modIds.get(M)); }
  function clearMemo() { memo.length = 0; }
  function bones(desc, o) {
    var tier = tierOf(o && o.tier), rig = !!(o && o.rig);
    var key = desc.key + '#' + tier + (rig ? '#rig' : '') + '#' + modTag(body()) + modTag(hair()) + modTag(wearMod()) + modTag(accMod());
    for (var i = 0; i < memo.length; i++) if (memo[i].key === key) return memo[i].val;
    registerTokens();
    var asm = boxes(desc, { tier: tier, rig: rig }), J = jointsOf(desc, asm), models = toModels(asm.list, desc, tier);
    /* the Spark Stick: on a rig whenever the hand is free (folded until Showtime); a static figure
       holds it only when it is the worn hand piece */
    if (asm.hand === 'spark' && !models.wand && (rig || desc.show.hand === 'wear_free_spark')) { var st = stickModel(desc, J); if (st) models.wand = st; }
    var optional = OPTIONAL.filter(function (b) { return !!models[b]; });
    Object.defineProperty(models, 'joints', { value: J });
    Object.defineProperty(models, 'optional', { value: optional });
    Object.defineProperty(models, 'hand', { value: asm.hand });
    memo.unshift({ key: key, val: models });
    if (memo.length > MEMO_MAX) memo.length = MEMO_MAX;
    return models;
  }
  function order(models) { return BASE_BONES.concat(OPTIONAL).filter(function (b) { return !!models[b]; }); }
  function tris(desc, tier) {
    var V = vox(), ms = bones(desc, { tier: tier }), n = 0;
    order(ms).forEach(function (b) { n += V.stats(ms[b], { full: true, tier: tierOf(tier) }).tris; });
    return n;
  }
  function voxels(desc, o) {
    var ms = bones(desc, o);
    return vox().compose(order(ms).map(function (b) { return { model: ms[b] }; }), { id: 'person' });
  }

  /* ================================================================
     bakePose: a static figure in a pose (each bone's voxels resampled through its posed transform)
     ================================================================ */
  function rotM(x, y, z, ord) {
    var cx = Math.cos(x * DEG), sx = Math.sin(x * DEG), cy = Math.cos(y * DEG), sy = Math.sin(y * DEG), cz = Math.cos(z * DEG), sz = Math.sin(z * DEG);
    var X = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
    var seq = { XYZ: [X, Y, Z], YXZ: [Y, X, Z], ZXY: [Z, X, Y] }[ord || 'XYZ'];
    return mul3(mul3(seq[0], seq[1]), seq[2]);
  }
  function mul3(a, b) {
    var o = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
    return o;
  }
  /* affine {m: 3×3, t: [x, y, z]}; compose(A, B)(p) = A(B(p)) */
  function aff(m, t) { return { m: m, t: t }; }
  function apply(A, p) { var m = A.m; return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + A.t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + A.t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + A.t[2]]; }
  function comp(A, B) { return aff(mul3(A.m, B.m), apply(A, B.t)); }
  function inv(A) {
    var m = A.m, d = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    var i = [(m[4] * m[8] - m[5] * m[7]) / d, (m[2] * m[7] - m[1] * m[8]) / d, (m[1] * m[5] - m[2] * m[4]) / d,
             (m[5] * m[6] - m[3] * m[8]) / d, (m[0] * m[8] - m[2] * m[6]) / d, (m[2] * m[3] - m[0] * m[5]) / d,
             (m[3] * m[7] - m[4] * m[6]) / d, (m[1] * m[6] - m[0] * m[7]) / d, (m[0] * m[4] - m[1] * m[3]) / d];
    var t = apply(aff(i, [0, 0, 0]), A.t);
    return aff(i, [-t[0], -t[1], -t[2]]);
  }
  /* each bone's posed world transform of a rest item-space point (the rig's setPose mapping) */
  function poseTransforms(J, p, bodyY, handItem) {
    var sy = num(p.sy, 1) || 1e-4, c = bodyY * sy, q = rotM(num(p.pitch, 0), num(p.yaw, 0), num(p.roll, 0), 'YXZ');
    var v = apply(aff(q, [0, 0, 0]), [0, c, 0]);
    var S = [num(p.sx, 1) || 1e-4, 0, 0, 0, sy, 0, 0, 0, num(p.sz, 1) || 1e-4];
    var local = {
      base: aff(mul3(q, S), [num(p.x, 0) - v[0], num(p.y, 0) + c - v[1], num(p.z, 0) - v[2]]),
      body: aff(rotM(0, num(p.hips, 0), -num(p.lean, 0), 'YXZ'), null), head: aff(rotM(num(p.headPitch, 0), num(p.headYaw, 0), num(p.headRoll, 0), 'YXZ'), null),
      armL: aff(rotM(-num(p.armLf, 0), 0, num(p.armL, 0), 'ZXY'), null), armR: aff(rotM(-num(p.armRf, 0), 0, -num(p.armR, 0), 'ZXY'), null),
      legL: aff(rotM(-num(p.legL, 0), 0, 0), null), legR: aff(rotM(-num(p.legR, 0), 0, 0), null),
      wand: aff(handItem ? rotM(0, 0, 0) : rotM(TILT, 0, num(p.twirl, 0)), null)
    };
    var W = {};
    function world(b) {
      if (W[b]) return W[b];
      var par = PARENT[b], L = local[b] || aff(rotM(0, 0, 0), null), off = par ? [0, 1, 2].map(function (a) { return J[b][a] - J[par][a]; }) : J[b];
      var me = aff(L.m, b === 'base' ? L.t : off);
      return (W[b] = par ? comp(world(par), me) : me);
    }
    var out = {};
    Object.keys(J).forEach(function (b) { out[b] = comp(world(b), aff(rotM(0, 0, 0), [-J[b][0], -J[b][1], -J[b][2]])); });
    return out;
  }
  function bakePose(desc, pose, o) {
    var CH = clips(), V = vox(), ms = bones(desc, o), J = ms.joints, p = pose;
    if (pose && typeof pose.clip === 'string' && CH) p = CH.sampleAvatar(pose.clip, num(pose.t, 0), {}, Object.assign({ bodyY: J.body[1] }, pose.opts || {}));
    p = p || {};
    var X = poseTransforms(J, p, J.body[1], ms.hand === 'item'), layers = [], palette = {}, keyOf = {};
    var still = order(ms).every(function (b) { var A = X[b]; return [1, 0, 0, 0, 1, 0, 0, 0, 1].every(function (v, i) { return Math.abs(A.m[i] - v) < 1e-9; }) && A.t.every(function (v) { return Math.abs(v) < 1e-9; }); });
    if (still) return voxels(desc, o);                       /* the rest pose: the figure exactly */
    function chOf(e) { var k = JSON.stringify(e); if (!keyOf[k]) { keyOf[k] = CHARS[Object.keys(keyOf).length]; palette[keyOf[k]] = e; } return keyOf[k]; }
    /* every layer as {grid, at (the lattice's zero, origin folded in), vox, pal} */
    function frames(b) {
      return ms[b] ? ms[b].layers.map(function (ly) {
        var s = ly.vox, gr = ly.grid || s.grid || ms[b].grid, g = Array.isArray(gr) ? gr.slice() : [gr, gr, gr];
        var og = Array.isArray(ly.origin) ? ly.origin : Array.isArray(s.origin) ? s.origin : [0, 0, 0], at = Array.isArray(ly.at) ? ly.at : [0, 0, 0];
        return { grid: g, at: [0, 1, 2].map(function (a) { return r6(at[a] - og[a] * g[a]); }), vox: s, pal: ms[b].palette };
      }) : [];
    }
    order(ms).forEach(function (b) {
      if (b === 'eyes') return;                              /* painted with the head (it only blinks) */
      var A = X[b] || X.body, Ai = inv(A), all = frames(b);
      var solid = all.filter(function (ly) { return ly.grid.every(function (g) { return g > GC * 0.3; }); });
      var sheets = all.filter(function (ly) { return solid.indexOf(ly) < 0; }).concat(b === 'head' ? frames('eyes') : []);
      function cellAt(ly, pt) {
        var s = ly.vox, idx = [0, 1, 2].map(function (a) { return Math.floor((pt[a] - ly.at[a]) / ly.grid[a] + 1e-9) - s.min[a]; });
        if (idx.some(function (v, a) { return v < 0 || v >= s.dims[a]; })) return 0;
        return s.c[(idx[1] * s.dims[2] + idx[2]) * s.dims[0] + idx[0]];
      }
      solid.forEach(function (ly) {
        /* the posed bounds of this layer → every target cell on the layer's own lattice whose centre maps back inside it */
        var s = ly.vox, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], g = ly.grid;
        for (var n = 0; n < 8; n++) {
          var cpt = [0, 1, 2].map(function (a) { return ly.at[a] + ((n >> a) & 1 ? s.min[a] + s.dims[a] : s.min[a]) * g[a]; }), w = apply(A, cpt);
          for (var a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], w[a]); hi[a] = Math.max(hi[a], w[a]); }
        }
        var out = V.grid({ grid: g, origin: [0, 0, 0] }), i0 = [], i1 = [], hits = 0;
        for (var a2 = 0; a2 < 3; a2++) { i0.push(Math.floor((lo[a2] - ly.at[a2]) / g[a2]) - 1); i1.push(Math.ceil((hi[a2] - ly.at[a2]) / g[a2]) + 1); }
        for (var i = i0[0]; i <= i1[0]; i++) for (var j = i0[1]; j <= i1[1]; j++) for (var k = i0[2]; k <= i1[2]; k++) {
          var ctr = [ly.at[0] + (i + 0.5) * g[0], ly.at[1] + (j + 0.5) * g[1], ly.at[2] + (k + 0.5) * g[2]], code = cellAt(ly, apply(Ai, ctr));
          if (code) { out.set(i, j, k, chOf(ly.pal[String.fromCharCode(code)])); hits++; }
        }
        sheets.forEach(function (sh) {
          /* a quarter sheet (the eyes) is painted onto the solid cell it lies on */
          var t = sh.vox;
          for (var y = 0; y < t.dims[1]; y++) for (var z = 0; z < t.dims[2]; z++) for (var x = 0; x < t.dims[0]; x++) {
            var cc = t.c[(y * t.dims[2] + z) * t.dims[0] + x];
            if (!cc) continue;
            var pt = [0, 1, 2].map(function (a) { return sh.at[a] + ([x, y, z][a] + t.min[a] + 0.5) * sh.grid[a]; });
            var thin = [0, 1, 2].filter(function (a) { return sh.grid[a] < GC * 0.5; })[0];
            [-1, 1].some(function (sgn) {
              var q = pt.slice(); q[thin] += sgn * GC * 0.5;
              if (!cellAt(ly, q)) return false;
              var wpt = apply(A, q), ii = [0, 1, 2].map(function (a) { return Math.floor((wpt[a] - ly.at[a]) / g[a]); });
              out.set(ii[0], ii[1], ii[2], chOf(sh.pal[String.fromCharCode(cc)]));
              return true;
            });
          }
        });
        if (hits) layers.push({ grid: g, origin: [0, 0, 0], at: ly.at.slice(), vox: out.snapshot() });
      });
    });
    return { id: 'person:posed', grid: GC, origin: [0, 0, 0], ground: false, palette: palette, layers: layers };
  }

  /* ================================================================
     THE DISPLAY HANDLER (stage voxRoute kinds 'char' and 'wear')
     ================================================================ */
  var DYE_STYLE = 13;                              /* a dye shows on 'Me' with long straight hair */
  /* the Fitting Friend's look: shape 1, height 0, a bald round crown (its hats sit on the clay head) */
  var FITTING_LOOK = { sk: 4, ey: 0, ec: 0, hs: 0, hc: 1, cv: 0, cc: 0, gl: 0, gc: 0, ha: 0, hac: 0, fr: 0, bl: 0, bd: 1, ht: 0 };
  function displayDesc(st) {
    st = st || {};
    var id = typeof st.id === 'string' ? st.id : 'char_me', it = itemOf(id), o = { member: st.member, look: st.look, lk: st.lk, wear: st.wear, wr: st.wr, vr: st.vr };
    if (st.kind === 'wear' || (it && it.kind === 'wear')) {
      var w = {}, vr = {}, on = plain(st.look) || typeof st.lk === 'string';
      if (it && it.slot === 'dye' && (on || !accPiece(id))) {
        /* a dye on a person (its own look, else 'Me') with long hair in that colour */
        var P = core(), base = P && P.display ? P.display('char_me').look : {};
        o.look = Object.assign({}, base, plain(st.look) ? st.look : {}, { hs: DYE_STYLE, hc: num(it.hc, 1) });
        o.lk = null;
        return describe(o);
      }
      if (it && it.slot) w[it.slot] = id;
      vr[id] = plain(st.vr) ? num(st.vr[id], 0) : num(st.vr, 0);
      /* 'Try it on': on the given look; else the catalogue icon, the Fitting Friend wearing it */
      if (on) return describe({ look: st.look, lk: st.lk, wear: w, vr: vr, member: st.member });
      return describe({ look: FITTING_LOOK, wear: w, vr: vr, member: st.member, fitting: true, piece: id });
    }
    o.char = id;
    return describe(o);
  }
  function display(st, tier) {
    var desc = displayDesc(st), o = { tier: tier };
    return st && (typeof st.pose === 'string' || plain(st.pose)) ? bakePose(desc, typeof st.pose === 'string' ? { clip: st.pose, t: num(st.t, 0), opts: { reduced: true } } : st.pose, o) : voxels(desc, o);
  }

  /* ================================================================
     THE RIG (browser): THREE only through the kit (K.THREE, K.vox)
     ================================================================ */
  var rigSeq = 0;
  function memberOf(c) { var L = look(); return normHex(c) || normHex(L && typeof L.resolve === 'function' ? L.resolve(L.MEMBER_FALLBACK || MEMBER) : null); }
  function makePerson(SL3D, opts, tier) {
    opts = opts || {};
    if (!ready()) throw new Error('SLPxPeople: the people shapes are not loaded (window.slLoadPeople)');
    var K = SL3D.kit(tier), T = K.THREE, CH = clips(), hex = memberOf(opts.member || opts.color);
    var desc = describe({ look: opts.look, lk: opts.lk, wear: opts.wear, wr: opts.wr, vr: opts.vr, member: hex, photocard: opts.photocard, sig: opts.sig });
    var ms = bones(desc, { tier: K.tier, rig: true }), J = ms.joints, D = body().bodyOf(desc.look.bd, desc.look.ht), names = order(ms);
    ['base', 'body', 'head', 'armL', 'armR', 'legL', 'legR', 'wand', 'eyes'].forEach(function (b) { if (names.indexOf(b) < 0) names.push(b); });
    var hand = D.sockets.hand.at, handL = D.sockets.handL.at, topY = D.top[1];
    order(ms).forEach(function (b) { if (b === 'wand') return; ms[b].layers.forEach(function (ly) { topY = Math.max(topY, ly.at[1] + (ly.vox.min[1] + ly.vox.dims[1]) * ly.grid[1] + 0.06); }); });
    var vr = K.vox.rig({
      kind: 'avatar', name: 'person', bones: names.map(function (n) { return { name: n, parent: PARENT[n], origin: J[n] }; }),
      voxelsPerBone: ms, sockets: { hand: { bone: 'armR', at: J.wand }, handL: { bone: 'armL', at: [r6(handL[0] * GC), r6(handL[1] * GC), r6(handL[2] * GC)] } },
      anchors: { top: { bone: 'head', at: [0, r6(topY), 0] } }
    });
    vr.setState('member', 'own'); vr.setState('memberShade', 'own');
    var bones3 = vr.bones, KEYS = (CH && CH.AV_KEYS) || [], pose = CH ? CH.restAvatar({}) : {}, o2 = {}, ex = {}, sw = {};
    var seed = (hash(desc.lk) ^ Math.imul(rigSeq++, 2654435761)) >>> 0, phase = (seed % 997) / 997, wandOn = false, disposed = false;
    var item = ms.hand === 'item', blinks = !(body().eyeInfo(desc.look).blink === false), bodyY = J.body[1], tailRow = hair().hairTailOf(desc.look);
    var _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), burst = null;
    function rot(b, x, y, z, ord) { if (b) b.rotation.set(x * DEG, y * DEG, z * DEG, ord || 'XYZ'); }
    function setPose(p) {
      if (disposed || !p) return rig;
      if (p !== pose) for (var i = 0; i < KEYS.length; i++) { var k = KEYS[i]; pose[k] = typeof p[k] === 'number' ? p[k] : (k === 'sx' || k === 'sy' || k === 'sz' ? 1 : 0); }
      p = pose;
      var sy = num(p.sy, 1), c = bodyY * sy;
      _e.set(num(p.pitch, 0) * DEG, num(p.yaw, 0) * DEG, num(p.roll, 0) * DEG, 'YXZ');
      _q.setFromEuler(_e);
      _v.set(0, c, 0).applyQuaternion(_q);
      bones3.base.quaternion.copy(_q);
      bones3.base.position.set(num(p.x, 0) - _v.x, num(p.y, 0) + c - _v.y, num(p.z, 0) - _v.z);
      bones3.base.scale.set(num(p.sx, 1) || 1e-4, sy || 1e-4, num(p.sz, 1) || 1e-4);
      rot(bones3.body, 0, num(p.hips, 0), -num(p.lean, 0), 'YXZ');
      rot(bones3.head, num(p.headPitch, 0), num(p.headYaw, 0), num(p.headRoll, 0), 'YXZ');
      rot(bones3.armL, -num(p.armLf, 0), 0, num(p.armL, 0), 'ZXY');
      rot(bones3.armR, -num(p.armRf, 0), 0, -num(p.armR, 0), 'ZXY');
      rot(bones3.legL, -num(p.legL, 0), 0, 0);
      rot(bones3.legR, -num(p.legR, 0), 0, 0);
      if (item) rot(bones3.wand, 0, 0, 0); else rot(bones3.wand, TILT, 0, num(p.twirl, 0));
      return rig;
    }
    function showWand() { var s = item || wandOn ? 1 : 1e-4; bones3.wand.scale.set(s, s, s); }
    /* the blink clock starts 1.5-2.5 s in (the blink layer's first event is at 0), so a fresh clip
       never opens on closed eyes */
    var blinkOff = 1.5 + (hash(desc.lk) % 1000) / 1000;          /* the look's own: the same look blinks the same */
    function eyesAt(t, o) { return blinks && CH && typeof CH.avatarBlink === 'function' ? CH.avatarBlink(t + blinkOff, desc.lk, { reduced: !!(o && o.reduced), photocard: desc.photocard }) : 1; }
    /* the cloth and hair from the root speed (u/s); still under reduced motion */
    function secondary(t, o) {
      var speed = num(o && o.speed, 0), red = !!(o && o.reduced);
      if (bones3.hairTail && CH && typeof CH.hairSway === 'function') {
        CH.hairSway(t, speed, { reduced: red, seed: seed }, sw);
        /* hairSway's pitch is ≤ 0 'streaming back': a tail hanging below its joint swings back (−z) on
           a positive x turn. Pigtails swing fore and aft together ('x'), the rest side to side ('z') */
        var lim = tailRow ? tailRow.maxDeg : 10;
        if (tailRow && tailRow.axis === 'x') rot(bones3.hairTail, clamp(0.5 * (sw.roll - sw.pitch), -lim, lim), 0, 0);
        else rot(bones3.hairTail, clamp(-sw.pitch, -lim, lim), 0, clamp(sw.roll, -lim, lim));
      }
      if (bones3.cape0) {
        var k = red ? 0 : clamp(speed / CAPE.full, 0, 1), wv = red ? 0 : CAPE.wave * k * Math.sin(2 * Math.PI * CAPE.hz * t + phase * 6);
        /* a positive x turn swings the hem back, away from the runner */
        for (var n = 0; n < 3; n++) rot(bones3['cape' + n], CAPE.lift[n] * k + (n ? wv * n / 2 : 0), 0, 0);
      }
    }
    function extras(clip, t, o) {
      if (!CH || typeof CH.avatarExtras !== 'function') return;
      CH.avatarExtras(clip, t, ex, o);
      if (bones3.visor) rot(bones3.visor, -75 * clamp(num(ex.visor, 0), 0, 1), 0, 0);
      if (bones3.antenna) rot(bones3.antenna, num(ex.antenna, 0), 0, 0);
      var on = num(ex.sparkle, 0) > 0.01;
      if (!on && !burst) return;
      if (!burst && K.vox && typeof K.vox.instancedCubes === 'function') {
        burst = K.vox.instancedCubes(BURST, { mode: 'glow', size: GC, name: 'person:burst' });
        burst.mesh.visible = false;
        bones3.wand.add(burst.mesh);
      }
      if (!burst) return;
      burst.mesh.visible = on;
      if (!on) return;
      /* eight gold cubes spreading from the ✦ and shrinking as they fade (avatarExtras: one burst, ≤ 0.8 s) */
      var reach = 0.05 + 0.25 * num(ex.spread, 0), s = 0.4 + 0.6 * num(ex.sparkle, 0);
      for (var i = 0; i < BURST; i++) { var a = i * Math.PI / 4; burst.set(i, Math.cos(a) * reach, WAND_TIP + Math.sin(a) * reach, 0, s, 'Star Gold'); }
      burst.mesh.count = BURST;
      burst.commit();
    }
    var rig = {
      root: vr.root, bones: bones3, sockets: vr.sockets, anchors: vr.anchors, pose: pose, meshes: { body: vr.mesh }, skeleton: vr.skeleton,
      color: hex, emoji: '', tier: K.tier, tris: vr.tris, h: D.h, lk: desc.lk, wr: desc.wr, sig: desc.sig, optional: ms.optional.slice(), person: true,
      setPose: setPose,
      setWand: function (on) { if (!disposed) { wandOn = !!on; showWand(); } return rig; },
      setShow: function () { return rig; },                    /* the glow level is the vox material's (uGlowMul) */
      blinkAt: function (t, o) { return eyesAt(num(t, 0), o); },
      play: function (clip, t, o) {
        if (disposed || !CH) return pose;
        for (var k in o2) delete o2[k];
        if (o) for (var n in o) o2[n] = o[n];
        if (o2.seed == null) o2.seed = seed;
        o2.phase = phase; o2.bodyY = bodyY;
        if (o2.speed == null) o2.speed = clip === 'run' ? 2.5 : clip === 'walk' ? 1 : 0;
        CH.sampleAvatar(clip, t, pose, o2);
        setPose(pose);
        var clock = num(o2.clock, num(t, 0));
        bones3.eyes.scale.set(1, clamp(eyesAt(clock, o2), 0.05, 1), 1);
        secondary(clock, o2);
        extras(clip, t, o2);
        return pose;
      },
      info: function (clip) { var c = CH && typeof CH.avInfo === 'function' ? CH.avInfo(clip, o2) : null; return c ? { loop: c.loop, dur: c.dur } : null; },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        if (burst) { if (burst.mesh.parent) burst.mesh.parent.remove(burst.mesh); if (typeof burst.dispose === 'function') burst.dispose(); }
        vr.dispose();
      }
    };
    showWand();
    setPose(pose);
    return rig;
  }
  var WAND_TIP = 0.3625;                         /* the ✦'s centre above the grip (SLPxCrew.WAND.tip) */

  function register(SL3D) {
    if (!SL3D || typeof SL3D.defineVox !== 'function' || SL3D.__slPxPeople) return false;
    SL3D.__slPxPeople = true;
    registerTokens();
    SL3D.defineVox('people', function () {
      var h = {};
      h[HANDLER] = { voxels: function (st, ctx) { return display(st, ctx && ctx.tier); } };
      return h;
    });
    if (typeof SL3D.defineVoxApi === 'function') SL3D.defineVoxApi('makePerson', function (K, S) { return function (o, tier) { return makePerson(S, o, tier); }; });
    return true;
  }
  registerTokens();

  return {
    VERSION: VERSION, GC: GC, HANDLER: HANDLER, BASE_BONES: BASE_BONES, OPTIONAL: OPTIONAL, PARENT: PARENT, PEOPLE_CAPS: PEOPLE_CAPS,
    TILT: TILT, CAPE: CAPE, BURST: BURST,
    TOKENS: tokenTable, tokenNote: tokenNote, registerTokens: registerTokens,
    ready: ready, describe: describe, boxes: boxes, bones: bones, clearMemo: clearMemo, jointsOf: function (desc) { return bones(desc).joints; }, tris: tris,
    voxels: voxels, bakePose: bakePose, poseTransforms: poseTransforms, display: display, displayDesc: displayDesc,
    makePerson: makePerson, register: register, build: { makePerson: makePerson }
  };
}));
