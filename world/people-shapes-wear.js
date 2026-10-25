/* ================================================================
   My Island v3, kids update — SLPeopleShapesWear (KU-CH7): the garments as pure box lists.
   window.SLPeopleShapesWear in the browser (loaded by window.slLoadPeople() after the body and hair
   files), module.exports in Node. Pure data: no DOM, no THREE, no SLVox, no clock, no random
   numbers; the same look, wear and colourways give the same boxes (characters.json CH-D8, CH-D9,
   design.wardrobe, voxelLook).

   WHAT IS HERE: every piece of the slots top, bottom, shoes and outfit (the free basics, 8 tops,
   6 bottoms, 5 shoes, 7 outfits, the 9 land garments and the 7 signature garments) and the free
   Spark Stick (the hand slot's free basic; every other hand piece is KU-CH8's). 48 pieces.

   FIT (wardrobe.fit): garments ARE the body. A top's voxels are the torso and sleeves, with skin
   only where it leaves it (forearms on short sleeves, the neck on an open neck); trousers are the
   legs, shoes the feet. Every piece builds from KU-CH4's body descriptor (bodyOf(bd, ht): torso,
   regions, sockets), on each bone's own lattice, so a piece fits all 6 bodies and paints over the
   body cell for cell (a later box wins). The rows of the torso: the hips row (torso.y0) is the
   bottom's waistband; a short top starts one row up, a long top (jackets, jumpers, hoodies) covers
   the waistband with its own hem. The dungarees' bib is the one layer drawn over the top.
   Order in dress(): body and face (KU-CH4) → hair and identity pieces (KU-CH5) → bottom → top →
   the bib → shoes (or the outfit) → the hood → the Spark Stick; KU-CH8's accessories go after.

   FLAGS: an outfit covers top and bottom (still chosen underneath); coversShoes (space suit, robe,
   kit, overalls) brings its own footwear and hides the shoes; hoodUp (the 4 onesies) paints the
   head as a hood round the face, drops the ears, keeps only the hair and covering voxels at the
   face plane (a fringe peeks out), the identity glasses' front frames and no hearing aids, and
   hides the head slot (people-core resolve()). A head covering always shows in full: over a hijab,
   sports hijab, patka, turban or headwrap the onesie's hood is worn DOWN on the back (HOOD_DOWN);
   a kippah sits under the hood.

   COLOURS: garments use 'PX Cloth <Colour>' tokens (a people namespace beside KU23's; each with its
   ' Shade' partner at × 0.86 a channel, as KU-CH4), registered through
   SLIslandLook.addTokens('px-people-wear', TOKENS) the first time a piece is built (the D50
   model-local path; first wins, never overwrites). The classic hoodie and the Spark Stick wear the
   member colour as px-crew does: a state colour ('member' / 'memberShade' on Bubblegum / Rose Deep)
   whose map carries the runtime hex, never a token. Emblems are only the 4-point ✦, a sun, a
   snowflake or a leaf; no letters, numbers, stripe triplets or logos (voxelLook.originality).

   BOX LISTS: KU-CH4's format (people-shapes-body.js): {bone: [box]}, box {b, c, x0 … z1, tag,
   mode?, lod?, proud?, erase?}; mode is an SLVox surface ('glow' trims, 'cobble' knit and checks,
   'leaf' denim, 'plank' ribbing, 'snow' sparkle); lod 'mid' = a painted detail the LOW tier skips
   (the colour under it shows, never a hole). Tags in EXTRA_TAGS are the garment extras (hood,
   collar, pocket, flare, bib, tail, fin, emblems …: wardrobe budgets 'garment extras ≤ 160').
   An emblem on an even-width torso (no centre column) is a proud layer of 1-voxel cells on the
   half-voxel phase, so it stays thin and centred (px-people meshes proud layers as KU-CH4's ears).

   BUDGETS (characters.json K8), measured IN CONTEXT: the piece's own visible faces in a dressed
   figure, meshed by SLVox with corner AO through KU-CH4's raster(), on all 6 bodies at LOW and MID
   (HIGH draws MID's boxes): tops ≤ 140, bottoms ≤ 100, outfits ≤ 300 (the design's slot caps),
   extras ≤ 160, a hood ≤ 160 over a bald head (it replaces the hair), the Fitting Friend display
   ≤ 900. BOUND: the design's shoes 60 cannot hold for the avatar's own toe-step sneaker (68-72 in
   context, as the plain socks), so shoes are bounded at 100; the Spark Stick is px-crew's stick
   unchanged at 96 (hand cap 90), bounded at 100.
   THE CAST AT LOW (the lead's LOW-cap fix, KU-L4a): PEOPLE_CAPS is per person (LOW 1,000 / MID
   1,300, the folded Spark Stick counted), trimmed in data, never at runtime. Here: skirt and robe
   flares are square at LOW (flare(): their corner columns come off at MID and HIGH through 'mid'
   erase boxes, 28-44 triangles), the apron's pocket and the robe's collar row are 'mid'. Measured
   rigs, LOW / MID: Me 826 / 826 · Theo 922 / 934 · Priya 990 / 1,102 · Jude 990 / 1,182 · Wren 914
   / 952 · Ines 978 / 1,128 · Omar 808 / 808 · Lena 968 / 980 · Malu 970 / 1,090 · Amara 900 / 912
   · Rowan 982 / 1,034 · Elsie 870 / 990 · Noor 802 / 816 (tests/vox-people K8 pins them). A child's
   own every-slot-filled look is far heavier (the worst found: LOW 1,940, MID 2,092): James decides.

   API
     PIECES {id: {slot, cw, cws, flags}}   IDS   CLOTH {Colour: hex}   TOKENS {token: hex}
     PIECES[id].cws [[a, b, c] colour names] × cw   CAPS (people-core SLOT_CAPS for these slots,
     plus extras 160, display 900, dressed 1300, dressedLow 1000)   BOUND {shoes, hand}   EXTRA_TAGS
     SLOTS   PLAIN   HOOD_DOWN
     has(id)                         a piece this file builds
     colours(id, n)                  {a, b, c} tokens of colourway n (unknown → 0)
     covers(id)                      the KU-CH4 regions the piece replaces (a person() cover list)
     piece(id, body, o)              → BoxList of the piece alone on a body: body is a look, a
                                     descriptor (bodyOf) or null (shape 1 / height 0); o {cw, member
                                     (hex), skin (the token for bare cells it draws: neck, slides'
                                     toes), tier}; own properties .cover (the regions it replaces),
                                     .over (the bib, drawn after the top) and .hood (the head paint)
     hood(id, body, o)               → {head: [...]} the hoodUp paint and features (null otherwise)
     display(id, o)                  → the Fitting Friend wearing one piece (the shop icon model;
                                     the Spark Stick on its hand), o {cw, member, tier}
     dress(look, wear, vr, o)        → the whole figure without KU-CH8's accessories: o {member,
                                     tier, w (ownership through people-core resolve), coversEyes
                                     (a face piece hides the glasses), omit (a hat's volume, passed
                                     to the hair), noHair}. Own properties: .joints {hairTail} when
                                     built, .cover (the regions the garments replace), .hoodUp
     plain(slot, body, o)            the plain layer (white tee, navy leggings, white socks) that
                                     dress() draws in an empty slot, so nobody is ever unclothed
     hexOf(token)                    '#RRGGBB' for a cloth token (and its Shade), else KU-CH4's
     ready()                         registers TOKENS with SLIslandLook (done by every builder)
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPeopleShapesWear = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1, SHADE = 0.86, SOURCE = 'px-people-wear';
  var SLOTS = ['top', 'bottom', 'shoes', 'outfit'];
  var CAPS = { top: 140, bottom: 100, shoes: 60, outfit: 300, hand: 90, extras: 160, display: 900, dressed: 1300, dressedLow: 1000 };
  var BOUND = { shoes: 100, hand: 100 };   /* measured bounds where the design's cap cannot hold (see BUDGETS) */
  var EXTRA_TAGS = ['hood', 'hoodShade', 'collar', 'pocket', 'flare', 'bib', 'strap', 'tail', 'fin', 'spike', 'horn', 'mane', 'beak', 'earTip', 'flap',
                    'emblem', 'string', 'toggle', 'button', 'zip', 'patch', 'star', 'crest', 'dial', 'panel', 'belt', 'apron'];
  var MEMBER = 'Bubblegum', MEMBER_SHADE = 'Rose Deep';

  /* ---------------- siblings (the page's global, else one require() in Node) ---------------- */
  var required = {};
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function sib(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!own(required, name)) { try { required[name] = require(path) || null; } catch (e) { required[name] = null; } }
    return required[name];
  }
  function bodyMod() { return sib('SLPeopleShapesBody', './people-shapes-body.js'); }
  function hairMod() { return sib('SLPeopleShapesHair', './people-shapes-hair.js'); }
  function core() { return sib('SLPeopleCore', './people-core.js'); }
  function lookMod() { return sib('SLIslandLook', './world-look.js'); }

  /* ---------------- the cloth palette: original colours, each with its Shade ---------------- */
  var CLOTH = {
    Red: '#E5483F', Coral: '#FF7A66', Orange: '#FF9838', Sunny: '#FFD04D', Lime: '#A8DB4C', Green: '#3DAA5C',
    Leaf: '#5E9E45', Khaki: '#BFA46A', Teal: '#25AFA2', Sky: '#6EC6F7', Blue: '#3A76D6', Denim: '#4B6FA6',
    'Denim Light': '#86A6D3', Navy: '#2F3B70', Violet: '#7C5CD8', Lilac: '#BA9DF2', Pink: '#FF8DC1', Magenta: '#DB4F98',
    White: '#F7F5F0', Silver: '#C9CED8', Grey: '#8E95A3', Charcoal: '#3E404E', Brown: '#8B5A3A', Tan: '#CC9B67',
    Cream: '#FFF0D2', Gold: '#F0B53A', Mint: '#92E4C6'
  };
  function shadeHex(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * SHADE).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  var TOKENS = {};
  Object.keys(CLOTH).forEach(function (k) { TOKENS['PX Cloth ' + k] = CLOTH[k]; TOKENS['PX Cloth ' + k + ' Shade'] = shadeHex(CLOTH[k]); });
  function tk(name) { return 'PX Cloth ' + name; }
  function sh(token) { return typeof token === 'string' ? token + ' Shade' : token; }
  function hexOf(token) {
    if (token && typeof token === 'object') token = token.token;
    if (typeof token !== 'string') return null;
    if (own(TOKENS, token)) return TOKENS[token];
    var B = bodyMod();
    return B && typeof B.hexOf === 'function' ? B.hexOf(token) : null;
  }
  var registeredWith = null;
  function ready() {
    var L = lookMod();
    if (L && registeredWith !== L && typeof L.addTokens === 'function') { L.addTokens(SOURCE, TOKENS); registeredWith = L; }
    return L;
  }
  /* a member-colour palette entry (px-crew): a state colour whose map carries the runtime hex */
  function normHex(h) { var m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? '#' + m[1].toUpperCase() : null; }
  function memberShadeHex(hex) {
    var n = parseInt(hex.slice(1), 16), out = '#';
    for (var s = 16; s >= 0; s -= 8) out += ('0' + Math.round(((n >> s) & 255) * 0.82).toString(16)).slice(-2);
    return out.toUpperCase();
  }
  function member(hex, shade, mode) {
    var h = normHex(hex), key = shade ? 'memberShade' : 'member', token = shade ? MEMBER_SHADE : MEMBER;
    var e = { token: token, state: { key: key, off: token, on: token } };
    if (h) e.state.map = { own: shade ? memberShadeHex(h) : h };
    if (mode) e.mode = mode;
    return e;
  }

  /* ---------------- the pieces: slot, colourways (cw, people-core's count), flags ----------------
     CW rows are [a, b, c] colour names: a the main colour, b the accent, c a third */
  function p(slot, cws, flags) { return { slot: slot, cw: cws.length, cws: cws, flags: flags || [] }; }
  var PIECES = {
    wear_free_hoodie: p('top', [['member']]),
    wear_free_tee: p('top', [['White', 'Sky'], ['Coral', 'White'], ['Sky', 'White'], ['Sunny', 'White'], ['Green', 'White']]),
    wear_free_jeans: p('bottom', [['Denim', 'Brown'], ['Navy', 'Brown']]),
    wear_free_shorts: p('bottom', [['Khaki', 'Brown'], ['Navy', 'White'], ['Red', 'White']]),
    wear_free_sneakers: p('shoes', [['Red', 'White'], ['Blue', 'White'], ['Pink', 'White']]),
    wear_free_spark: p('hand', [['member']]),
    wear_top_stripes: p('top', [['Navy', 'White'], ['Red', 'White'], ['Teal', 'Sunny']]),
    wear_top_star: p('top', [['Red', 'Sunny'], ['Navy', 'Sunny'], ['Lilac', 'White']]),
    wear_top_varsity: p('top', [['Navy', 'Cream'], ['Red', 'White'], ['Green', 'Cream']]),
    wear_top_denim: p('top', [['Denim', 'White', 'Denim Light'], ['Denim Light', 'White', 'Denim']]),
    wear_top_puffer: p('top', [['Orange'], ['Sky'], ['Lilac']]),
    wear_top_raincoat: p('top', [['Sunny', 'Navy'], ['Red', 'White'], ['Teal', 'Sunny']]),
    wear_top_overshirt: p('top', [['Red', 'White'], ['Green', 'White'], ['Blue', 'Cream']]),
    wear_top_stage: p('top', [['Violet', 'Gold', 'White'], ['Charcoal', 'Pink', 'White'], ['White', 'Sky', 'Lilac']]),
    wear_bot_joggers: p('bottom', [['Grey', 'White'], ['Navy', 'White'], ['Pink', 'White']]),
    wear_bot_cargo: p('bottom', [['Khaki'], ['Leaf']]),
    wear_bot_skirt: p('bottom', [['Navy'], ['Pink'], ['Red']]),
    wear_bot_layer: p('bottom', [['Pink', 'Lilac'], ['Sky', 'White'], ['Violet', 'Pink']]),
    wear_bot_dungarees: p('bottom', [['Denim', 'Sunny'], ['Red', 'Sunny']]),
    wear_bot_leggings: p('bottom', [['Charcoal'], ['Pink'], ['Teal'], ['Violet']]),
    wear_shoe_hightops: p('shoes', [['Red', 'White'], ['Charcoal', 'White'], ['Mint', 'White']]),
    wear_shoe_boots: p('shoes', [['Brown', 'Tan'], ['Charcoal', 'Grey']]),
    wear_shoe_wellies: p('shoes', [['Sunny'], ['Red'], ['Green']]),
    wear_shoe_glow: p('shoes', [['White', 'Sky'], ['Charcoal', 'Pink'], ['White', 'Lime']]),
    wear_shoe_slides: p('shoes', [['Navy', 'White'], ['Pink', 'White'], ['Sunny', 'White']]),
    wear_fit_dino: p('outfit', [['Green', 'Lime'], ['Violet', 'Sunny']], ['hoodUp']),
    wear_fit_shark: p('outfit', [['Grey', 'White'], ['Teal', 'White']], ['hoodUp']),
    wear_fit_unicorn: p('outfit', [['White', 'Pink', 'Gold'], ['Lilac', 'Mint', 'Gold']], ['hoodUp']),
    wear_fit_astro: p('outfit', [['White', 'Orange', 'Silver'], ['Silver', 'Sky', 'Grey']], ['coversShoes']),
    wear_fit_robot: p('outfit', [['Tan', 'Sky', 'Grey'], ['Silver', 'Pink', 'Grey']]),
    wear_fit_pyjamas: p('outfit', [['Navy', 'Sunny'], ['Lilac', 'White'], ['Sky', 'White']]),
    wear_fit_hero: p('outfit', [['Red', 'Gold'], ['Teal', 'White'], ['Violet', 'Sunny']]),
    wear_pier_rashvest: p('top', [['Sky', 'Navy'], ['Coral', 'White'], ['Lime', 'Teal']]),
    wear_pier_boardies: p('bottom', [['Orange', 'Sunny'], ['Teal', 'Sky'], ['Pink', 'Violet']]),
    wear_jungle_shirt: p('top', [['Khaki', 'Brown'], ['Leaf', 'Brown']]),
    wear_jungle_boots: p('shoes', [['Brown', 'Khaki'], ['Leaf', 'Khaki']]),
    wear_treetop_hoodie: p('top', [['Green', 'Lime'], ['Brown', 'Leaf']]),
    wear_castle_tabard: p('top', [['Red', 'White', 'Gold'], ['Blue', 'White', 'Gold'], ['Violet', 'White', 'Gold']]),
    wear_ice_jumper: p('top', [['Sky', 'White'], ['Red', 'White'], ['Navy', 'White']]),
    wear_ice_skates: p('shoes', [['White', 'Silver'], ['Lilac', 'Silver']]),
    wear_ice_penguin: p('outfit', [['Charcoal', 'White', 'Orange']], ['hoodUp']),
    wear_sig_tracksuit: p('outfit', [['Violet', 'White']]),
    wear_sig_apron: p('top', [['Tan', 'Teal']]),
    wear_sig_robe: p('outfit', [['Navy', 'Sunny']], ['coversShoes']),
    wear_sig_aviator: p('top', [['Brown', 'Cream']]),
    wear_sig_kit: p('outfit', [['Sky', 'White', 'Gold']], ['coversShoes']),
    wear_sig_overalls: p('outfit', [['Red', 'White']], ['coversShoes']),
    wear_sig_rinkjacket: p('top', [['Lilac', 'White']])
  };
  var IDS = Object.keys(PIECES);
  function has(id) { return typeof id === 'string' && own(PIECES, id); }
  function flagged(id, f) { return has(id) && PIECES[id].flags.indexOf(f) >= 0; }
  function int(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  /* the tokens of colourway n: {a, b, c}; the member pieces get the member entries */
  function colours(id, n, hex) {
    var P = PIECES[id];
    if (!P) return null;
    var row = P.cws[int(n) && n >= 0 && n < P.cw ? n : 0];
    if (row[0] === 'member') return { a: member(hex), as: member(hex, true), b: 'Cloud White', c: 'Midnight Ink', member: true };
    var a = tk(row[0]), b = row[1] ? tk(row[1]) : sh(a), c = row[2] ? tk(row[2]) : b;
    return { a: a, as: sh(a), b: b, c: c };
  }

  /* ================================================================
     THE KIT: boxes on one body descriptor (all in voxels, item space at rest)
     ================================================================ */
  function Kit(D) {
    this.D = D; this.l = {};
    var T = D.torso;
    this.T = T; this.R = D.regions;
    this.odd = Math.abs(((T.x0 % 1) + 1) % 1 - 0.5) < 1e-9;      /* an odd-width torso: the centre column is x = 0 */
  }
  Kit.prototype.box = function (b, c, x0, x1, y0, y1, z0, z1, tag, x) {
    var bx = { b: b, c: c, x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1, tag: tag };
    if (x) Object.keys(x).forEach(function (k) { if (x[k] != null && x[k] !== false) bx[k] = x[k]; });
    if (bx.c && typeof bx.c === 'object' && bx.c.mode && !bx.mode) { bx.mode = bx.c.mode; }
    (this.l[b] = this.l[b] || []).push(bx);
    return this;
  };
  /* the centre span of n columns on the torso's lattice (n rounded to the torso's parity) */
  Kit.prototype.mid = function (n) {
    if (this.odd !== (n % 2 === 1)) n += 1;
    return [-n / 2, n / 2];
  };
  /* column dx from the centre span (0 = the centre column(s); ±n steps out), as [x0, x1] */
  Kit.prototype.col = function (dx) {
    var m = this.mid(1);
    return dx === 0 ? m : dx > 0 ? [m[1] + dx - 1, m[1] + dx] : [m[0] + dx, m[0] + dx + 1];
  };
  /* torso rows y0..y1 (corner columns off); g grows the footprint (flares, coats), gz only in depth */
  Kit.prototype.torso = function (c, y0, y1, tag, x, g, gz) {
    var T = this.T; g = g || 0; gz = gz == null ? g : gz;
    if (y1 <= y0) return this;
    this.box('body', c, T.x0 + 1 - g, T.x1 - 1 + g, y0, y1, T.z0 - gz, T.z1 + gz, tag, x);
    return this.box('body', c, T.x0 - g, T.x1 + g, y0, y1, T.z0 + 1 - gz, T.z1 - 1 + gz, tag, x);
  };
  /* a skirt or robe flare: torso rows y0..y1 grown by g. LOW draws it square (one box); MID and
     HIGH take its corner columns off as the torso's own ('mid' erase boxes, so the LOW tier skips
     them): the round corners cost a LOW figure 28-44 triangles of notch faces and corner AO */
  Kit.prototype.flare = function (c, y0, y1, tag, x, g) {
    var T = this.T, self = this, X0 = T.x0 - g, X1 = T.x1 + g, Z0 = T.z0 - g, Z1 = T.z1 + g;
    if (y1 <= y0) return this;
    this.box('body', c, X0, X1, y0, y1, Z0, Z1, tag, x);
    [[X0, Z0], [X1 - 1, Z0], [X0, Z1 - 1], [X1 - 1, Z1 - 1]].forEach(function (p) {
      self.box('body', null, p[0], p[0] + 1, y0, y1, p[1], p[1] + 1, tag, { erase: true, lod: 'mid' });
    });
    return this;
  };
  /* torso cells on a face: front (+z), back (−z); x0..x1 inside the face's flat */
  Kit.prototype.front = function (c, x0, x1, y0, y1, tag, x) { return this.face(c, x0, x1, y0, y1, this.T.z1 - 1, tag, x); };
  Kit.prototype.back = function (c, x0, x1, y0, y1, tag, x) { return this.face(c, x0, x1, y0, y1, this.T.z0, tag, x); };
  /* cells on the front or back layer, clipped to that face's flat (never into the cut corners) */
  Kit.prototype.face = function (c, x0, x1, y0, y1, z, tag, x) {
    var T = this.T; x0 = Math.max(x0, T.x0 + 1); x1 = Math.min(x1, T.x1 - 1);
    return x1 > x0 ? this.box('body', c, x0, x1, y0, y1, z, z + 1, tag, x) : this;
  };
  /* an emblem on the front (or back) from rows of '#' (top row first, odd widths), centred, from
     row yTop down: painted cell for cell on an odd-width torso; on an even one (no centre column)
     it is a proud layer of 1-voxel cells on the half-voxel phase, so it stays thin and symmetric.
     An emblem is what a piece IS (the sun tabard, the leaf hoodie), so LOW keeps its '#' cells; a
     '+' cell is a 'mid' detail (the sun's rays, the snowflake's tips) */
  Kit.prototype.emblem = function (c, rows, yTop, back, tag, x) {
    var self = this, T = this.T, w = rows[0].length, half = (w - 1) / 2, z = back ? T.z0 : T.z1 - 1;
    rows.forEach(function (r, n) {
      for (var i = 0; i < w; i++) if (r[i] === '#' || r[i] === '+' || r[i] === 'o') {
        var o = Object.assign(r[i] === '+' ? { lod: 'mid' } : {}, x || {}), y = yTop - n, col = r[i] === 'o' ? 'Cloud White' : c;
        if (self.odd) { var cx = self.col(i - half); self.face(col, cx[0], cx[1], y, y + 1, z, tag || 'emblem', o); continue; }
        var x0 = i - half - 0.5;
        if (x0 < T.x0 + 1 || x0 + 1 > T.x1 - 1) continue;
        o.proud = true;
        self.box('body', col, x0, x0 + 1, y, y + 1, z, z + 1, tag || 'emblem', o);
      }
    });
    return this;
  };
  /* both arms (or legs) over rows y0..y1 of a region kind ('upper', 'thigh' …) */
  Kit.prototype.limbs = function (kind, c, y0, y1, tag, x) {
    var self = this;
    ['L', 'R'].forEach(function (s) { var r = self.R[kind + s]; self.box(r.bone, c, r.x0, r.x1, y0, y1, r.z0, r.z1, tag, x); });
    return this;
  };
  /* one column down the outer side of each arm or leg (z centre), rows y0..y1 */
  Kit.prototype.outer = function (kind, c, y0, y1, tag, x) {
    var self = this;
    ['L', 'R'].forEach(function (s) {
      var r = self.R[kind + s], out = s === 'L' ? [r.x1 - 1, r.x1] : [r.x0, r.x0 + 1], zc = (r.z0 + r.z1) / 2;
      self.box(r.bone, c, out[0], out[1], y0, y1, zc - 0.5, zc + 0.5, tag, x);
    });
    return this;
  };
  /* the front column(s) of each leg or arm (z front face), rows y0..y1 */
  Kit.prototype.limbFront = function (kind, c, y0, y1, tag, x) {
    var self = this;
    ['L', 'R'].forEach(function (s) { var r = self.R[kind + s]; self.box(r.bone, c, r.x0, r.x1, y0, y1, r.z1 - 1, r.z1, tag, x); });
    return this;
  };

  /* ---------------- the generic shapes ---------------- */
  var ARM_TOP = function (D) { return D.arm.y1; }, ELBOW = function (D) { return D.arm.elbow; }, CUFF = function (D) { return D.arm.cuff; };
  /* a top: o {c, len 'short' | 'long' | 'crop', sleeve 'short' | 'long', hem, cuff, sc (sleeves),
     collar (a token: the top row as a collar band; true: the main colour), open (the front centre's
     inner colour), mode, smode (the sleeves' surface)} */
  function top(k, o) {
    var D = k.D, T = k.T, c = o.c, ys = o.len === 'long' ? T.y0 : o.len === 'crop' ? T.y0 + 2 : T.y0 + 1;
    var hem = o.hem === undefined ? sh(c) : o.hem, x = o.mode ? { mode: o.mode } : null;
    if (!o.noTorso) {
      k.torso(c, ys, T.y1, 'torso', x);
      if (hem) k.torso(hem, ys, ys + 1, 'hem', o.hemMode ? { mode: o.hemMode } : x);
      if (o.collar) k.torso(o.collar === true ? c : o.collar, T.y1 - 1, T.y1, 'collar', o.collarLod ? Object.assign({ lod: o.collarLod }, x) : x);
      if (o.open) { var m = k.mid(1); k.front(o.open, m[0], m[1], ys, T.y1, 'open'); }
    }
    var sc = o.sc || c, sx = o.smode ? { mode: o.smode } : x, low = o.sleeve === 'long' ? CUFF(D) : ELBOW(D);
    k.limbs('upper', sc, low, ARM_TOP(D), 'sleeve', sx);
    var cuff = o.cuff === undefined ? sh(sc) : o.cuff;
    if (cuff) k.limbs('upper', cuff, low, low + 1, 'cuff', o.cuffMode ? { mode: o.cuffMode } : sx);
    return k;
  }
  function topCover(o) {
    var c = ['torso', 'upperL', 'upperR'];
    if (o.sleeve === 'long') c.push('foreL', 'foreR');
    if (o.collar) c.push('neck');
    return c;
  }
  /* the skin neck an open neck shows again over the torso (a later box wins) */
  function neck(k, skin) { var N = k.R.neck; if (skin) k.box('body', skin, N.x0, N.x1, N.y0, N.y1, N.z0, N.z1, 'neck'); return k; }
  /* a bottom: o {c, len 'shorts' | 'knee' | 'long' | 'none' (a skirt's bare legs), waist, cuff, mode} */
  function bottom(k, o) {
    var T = k.T, c = o.c, x = o.mode ? { mode: o.mode } : null, R = k.R, hip = R.thighL.y1;
    k.torso(o.waist === undefined ? sh(c) : o.waist, T.y0, T.y0 + 1, 'waist', x);
    var low = o.len === 'long' ? R.shinL.y0 : o.len === 'knee' ? R.shinL.y1 - 1 : o.len === 'none' ? hip : R.thighL.y0;
    if (low < hip) {
      k.limbs('thigh', c, low, hip, 'leg', x);
      var cuff = o.cuff === undefined ? sh(c) : o.cuff;
      if (cuff) k.limbs('thigh', cuff, low, low + 1, 'cuff', x);
    }
    return k;
  }
  function bottomCover(o) {
    if (o.len === 'none') return [];
    return o.len === 'long' ? ['thighL', 'thighR', 'shinL', 'shinR'] : ['thighL', 'thighR'];   /* knee length paints the shin's top row over the skin */
  }
  /* shoes: o {c, sole, high (shin rows, 0-2), toe, lace, cuffTop, mode, soleMode, blade} */
  function shoes(k, o) {
    var self = k;
    ['L', 'R'].forEach(function (s) {
      var f = self.R['foot' + s], sn = self.R['shin' + s], b = f.bone;
      if (o.blade) {                                                       /* a skate: a narrow blade under the boot, */
        var bx = (sn.x0 + sn.x1) / 2, bw = (sn.x1 - sn.x0) % 2 ? 1 : 0.5;   /* on the other lattice phase (its own layer) */
        self.box(b, o.blade, bx - bw, bx + bw, 0, 1, f.z0, f.z1, 'blade');
      } else self.box(b, o.sole, f.x0, f.x1, 0, 1, f.z0, f.z1, 'sole', o.soleMode ? { mode: o.soleMode } : null);
      self.box(b, o.c, f.x0, f.x1, 1, 2, f.z0, f.z1 - 1, 'shoe', o.mode ? { mode: o.mode } : null);
      if (o.toe) self.box(b, o.toe, f.x0, f.x1, 1, 2, f.z1 - 2, f.z1 - 1, 'toe');
      var hi = o.high || 0;
      if (hi) self.box(b, o.c, sn.x0, sn.x1, 2, 2 + hi, sn.z0, sn.z1, 'shoe', o.mode ? { mode: o.mode } : null);
      if (hi && o.cuffTop) self.box(b, o.cuffTop, sn.x0, sn.x1, 1 + hi, 2 + hi, sn.z0, sn.z1, 'cuff');
      if (o.lace && hi) {                                                  /* laces: up the front of the shin rows */
        var lx = (sn.x0 + sn.x1) / 2, lw = (sn.x1 - sn.x0) % 2 ? 0.5 : 1;
        self.box(b, o.lace, lx - lw, lx + lw, 2, 2 + hi, sn.z1 - 1, sn.z1, 'lace', { lod: 'mid' });
      }
    });
    return k;
  }

  /* ---------------- the hood (hoodUp): the head painted round the face ---------------- */
  function inHead(i, v, k) {
    var ai = Math.abs(i), ak = Math.abs(k);
    return (ai <= 4 && v >= 1 && v <= 7 && ak <= 3) || (ai <= 3 && v >= 0 && v <= 8 && ak <= 3) || (ai <= 3 && v >= 1 && v <= 7 && ak <= 4);
  }
  function inWindow(i, v, k) { return k === 4 && Math.abs(i) <= 3 && v >= 1 && v <= 7; }
  /* the shell cells: every surface voxel of the head but the face window (the forehead row stays the
     face's, so a fringe peeks out under the brim); the ring round the face and the chin row in the
     Shade; the crown corners off */
  function hoodCells(H) {
    var out = [];
    for (var v = 0; v <= 8; v++) for (var i = -4; i <= 4; i++) for (var k = -4; k <= 4; k++) {
      if (!inHead(i, v, k) || inWindow(i, v, k)) continue;
      if (inHead(i + 1, v, k) && inHead(i - 1, v, k) && inHead(i, v + 1, k) && inHead(i, v - 1, k) && inHead(i, v, k + 1) && inHead(i, v, k - 1)) continue;
      if (v === 8 && Math.abs(i) === 3 && Math.abs(k) === 3) continue;
      var rim = (k === 3 && Math.abs(i) === 4) || (v === 0 && k >= 2);
      out.push({ i: i, j: H + v, k: k, role: rim ? 'hoodShade' : 'hood', lod: null, mode: null });
    }
    return out;
  }
  function packCells(cells, tokens, bone) {
    var Hm = hairMod();
    if (Hm && typeof Hm.boxes === 'function') return Hm.boxes(cells, tokens, false, bone);
    return cells.map(function (e) { return { b: bone, c: tokens[e.role], x0: e.i - 0.5, x1: e.i + 0.5, y0: e.j, y1: e.j + 1, z0: e.k - 0.5, z1: e.k + 0.5, tag: e.role }; });
  }
  /* the onesies' hood features, head-relative [i0, i1, v0, v1, k0, k1] in cells (inclusive), role */
  var HOOD = {
    wear_fit_dino: function (C) {
      return [[0, 0, 9, 9, 2, 2, 'spike'], [0, 0, 9, 9, -1, -1, 'spike'], [0, 0, 8, 8, -4, -4, 'spikeHi'], [0, 0, 6, 6, -5, -5, 'spike'], [0, 0, 3, 3, -5, -5, 'spike']];
    },
    wear_fit_shark: function () {
      return [[0, 0, 9, 9, -2, 1, 'fin'], [0, 0, 10, 10, -2, -1, 'fin'], [0, 0, 11, 11, -2, -2, 'fin'],
              [-3, 3, 7, 7, 4, 4, 'gum'], [-3, -3, 7, 7, 4, 4, 'tooth'], [-1, -1, 7, 7, 4, 4, 'tooth'], [1, 1, 7, 7, 4, 4, 'tooth'], [3, 3, 7, 7, 4, 4, 'tooth']];
    },
    wear_fit_unicorn: function () {
      return [[0, 0, 9, 9, 2, 3, 'horn'], [0, 0, 10, 10, 2, 2, 'horn'], [-1, 1, 8, 8, -3, 1, 'mane'], [0, 0, 9, 9, -3, 0, 'mane'],
              [0, 0, 2, 7, -5, -5, 'mane'], [-3, -3, 9, 9, 0, 0, 'earTip'], [3, 3, 9, 9, 0, 0, 'earTip']];
    },
    wear_ice_penguin: function () {
      return [[-1, 1, 8, 8, 4, 5, 'beak'], [-3, 3, 1, 6, 3, 3, 'mask']];
    }
  };
  /* → {head: [...]} the hood paint and its features on body D (null for a piece without hoodUp) */
  function hood(id, body, o) {
    if (!flagged(id, 'hoodUp')) return null;
    o = o || {};
    var D = descriptor(body), C = colours(id, o.cw, o.member), H = D.head.y0;
    var tokens = { hood: C.a, hoodShade: sh(C.a), spike: C.b, spikeHi: C.b, fin: C.a, gum: sh(C.a), tooth: 'PX Cloth White', horn: C.c, mane: C.b, earTip: C.a, beak: C.c, mask: 'PX Cloth White' };
    var feat = HOOD[id](C), list = [];
    /* the crown corners off (a later box may fill them: here nothing does) */
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(function (c) {
      list.push({ b: 'head', c: null, x0: c[0] - 0.5, x1: c[0] + 0.5, y0: H + 8, y1: H + 9, z0: c[1] - 0.5, z1: c[1] + 0.5, tag: 'cut', erase: true });
    });
    var cells = hoodCells(H);
    /* the penguin's white mask: the ring round the face in white instead of the Shade */
    feat.forEach(function (f) {
      if (f[6] !== 'mask') return;
      cells.forEach(function (e) { if (e.role === 'hoodShade' && e.k === 3 && Math.abs(e.i) === 4) e.role = 'mask'; });
    });
    list = list.concat(packCells(cells, tokens, 'head'));
    feat.forEach(function (f) {
      if (f[6] === 'mask') return;
      list.push({ b: 'head', c: tokens[f[6]], x0: f[0] - 0.5, x1: f[1] + 0.5, y0: H + f[2], y1: H + f[3] + 1, z0: f[4] - 0.5, z1: f[5] + 0.5, tag: f[6] === 'tooth' || f[6] === 'gum' ? 'hood' : f[6] === 'spikeHi' ? 'spike' : f[6] });
    });
    return { head: list };
  }

  /* ================================================================
     THE RECIPES: one function per piece (k the kit, C the colourway tokens, o the build options)
     → the regions it covers. Rows come from the descriptor, so every recipe fits every body.
     ================================================================ */
  /* the 4-point ✦ as a sparkle diamond with a white heart ('o'): at 5 voxels a thin-armed star reads
     as a cross, so the points are the diamond's tips; a sun, a snowflake, a leaf */
  var STAR = ['..#..', '.###.', '##o##', '.###.', '..#..'], SUN = ['+.+.+', '.###.', '+###+', '.###.', '+.+.+'], LEAF = ['.##', '###', '#..'];
  var SNOW = ['..#..', '+.#.+', '.###.', '+.#.+', '..#..'];
  /* the classic hoodie's small ✦ on the back: equal arms, low, so the big head never hides its top
     and it never reads as a long-stemmed cross */
  var SPARK = ['.#.', '###', '.#.'];
  function hoodDown(k, c, rows) {
    var T = k.T, m = k.mid(5);
    k.box('body', c, m[0], m[1], T.y1 - (rows || 2), T.y1, T.z0 - 1, T.z0, 'hood');
    return k;
  }
  function pocket(k, c, w, rows) { var m = k.mid(w); k.front(c, m[0], m[1], k.T.y0 + 1, k.T.y0 + 1 + rows, 'pocket'); return k; }
  var R = {
    /* ---- tops ---- */
    wear_free_hoodie: function (k, C) {
      var o = { c: C.a, hem: null, cuff: C.as, len: 'long', sleeve: 'long' }, T = k.T;
      top(k, o);
      k.front(C.as, T.x0, T.x1, T.y0, T.y0 + 3, 'pocket');
      [-1, 1].forEach(function (d) { var x = k.col(d); k.front('Cloud White', x[0], x[1], k.T.y1 - 2, k.T.y1 - 1, 'string'); });
      hoodDown(k, C.as, 1);
      k.emblem('Cloud White', SPARK, k.T.y0 + 3, true);                    /* low on the back, clear of the head's shadow */
      return topCover(o);
    },
    wear_free_tee: function (k, C, o) {
      var t = { c: C.a, sleeve: 'short' }; top(k, t); neck(k, o.skin); return topCover(t);
    },
    wear_top_stripes: function (k, C, o) {
      var T = k.T, t = { c: C.a, sleeve: 'short', cuff: null, hem: C.b }; top(k, t);
      var m = [T.x0 + 1, T.x1 - 1];
      for (var y = T.y0 + 3; y < T.y1; y += 2) { k.front(C.b, m[0], m[1], y, y + 1, 'stripe'); k.back(C.b, m[0], m[1], y, y + 1, 'stripe'); }
      neck(k, o.skin); return topCover(t);
    },
    wear_top_star: function (k, C, o) {
      var t = { c: C.a, len: 'long', sleeve: 'long', mode: 'cobble', hemMode: 'plank', cuff: null }; top(k, t);
      k.emblem(C.b, STAR, k.T.y1 - 2); neck(k, o.skin); return topCover(t);
    },
    wear_top_varsity: function (k, C) {
      var t = { c: C.a, sc: C.b, len: 'long', sleeve: 'long', collar: sh(C.a), cuff: sh(C.a), hemMode: 'plank' }; top(k, t);
      [k.T.y0 + 2, k.T.y0 + 4].forEach(function (y) { var m = k.mid(1); k.front(C.b, m[0], m[1], y, y + 1, 'button', { lod: 'mid' }); });
      return topCover(t);
    },
    wear_top_denim: function (k, C) {
      var t = { c: C.a, len: 'long', sleeve: 'long', cuff: C.c, open: C.b, mode: 'leaf', collar: sh(C.a) }; top(k, t);
      [-2, 2].forEach(function (d) { var x = k.col(d); k.front(sh(C.a), x[0], x[1], k.T.y1 - 3, k.T.y1 - 2, 'pocket'); });
      return topCover(t);
    },
    wear_top_puffer: function (k, C) {
      var t = { c: C.a, len: 'long', sleeve: 'long', mode: 'plank', collar: true, noTorso: true }, T = k.T;
      k.torso(C.a, T.y0, T.y1, 'torso', { mode: 'plank' }, 0, 1);
      k.torso(C.as, T.y0, T.y0 + 1, 'hem', null, 0, 1);
      k.torso(C.as, T.y1 - 1, T.y1, 'collar', null, 0, 1);
      top(k, t);
      return topCover(t);
    },
    wear_top_raincoat: function (k, C) {
      var t = { c: C.a, len: 'long', sleeve: 'long' }, T = k.T; top(k, t);
      k.torso(C.as, T.y0 - 1, T.y0, 'flare');
      [-1, 1].forEach(function (d) { var x = k.col(d); k.front(C.b, x[0], x[1], T.y0 + 3, T.y0 + 4, 'toggle', { lod: 'mid' }); });
      hoodDown(k, C.as);
      return topCover(t);
    },
    wear_top_overshirt: function (k, C) {
      var t = { c: C.a, len: 'long', sleeve: 'long', open: C.b, mode: 'cobble' }; top(k, t);
      [-2, 2].forEach(function (d) { var x = k.col(d); k.front(C.as, x[0], x[1], k.T.y1 - 1, k.T.y1, 'collar'); });
      return topCover(t);
    },
    wear_top_stage: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'crop', sleeve: 'long', hem: { token: C.b, mode: 'glow' }, cuff: { token: C.b, mode: 'glow' } };
      k.torso(C.c, T.y0 + 1, T.y0 + 2, 'under');
      top(k, t);
      return topCover(t);
    },
    wear_pier_rashvest: function (k, C, o) {
      var T = k.T, t = { c: C.a, sleeve: 'short', cuff: C.b }; top(k, t);
      ['L', 'R'].forEach(function (s) { var x = s === 'L' ? [T.x1 - 1, T.x1] : [T.x0, T.x0 + 1]; k.box('body', C.b, x[0], x[1], T.y0 + 2, T.y1, T.z0 + 1, T.z1 - 1, 'panel'); });
      neck(k, o.skin); return topCover(t);
    },
    wear_jungle_shirt: function (k, C, o) {
      var T = k.T, t = { c: C.a, sleeve: 'short', cuff: C.as }; top(k, t);
      [-2, 2].forEach(function (d) { var x = k.col(d); k.front(C.as, x[0], x[1], T.y1 - 3, T.y1 - 1, 'pocket'); });
      neck(k, o.skin);
      [-2, 2].forEach(function (d) { var x = k.col(d); k.front(C.as, x[0], x[1], T.y1 - 1, T.y1, 'collar'); });
      return topCover(t);
    },
    wear_treetop_hoodie: function (k, C) {
      var t = { c: C.a, len: 'long', sleeve: 'long' }; top(k, t);
      pocket(k, C.as, 5, 2);
      k.emblem({ token: C.b, mode: 'leaf' }, LEAF, k.T.y1 - 2, false, 'patch');
      hoodDown(k, C.as);
      return topCover(t);
    },
    wear_castle_tabard: function (k, C) {
      var T = k.T, t = { c: C.a, sc: C.b, len: 'long', sleeve: 'long', collar: C.as }; top(k, t);
      var m = k.mid(3);
      k.box('body', C.a, m[0], m[1], T.y0 - 1, T.y0, T.z1 - 1, T.z1, 'flap').box('body', C.a, m[0], m[1], T.y0 - 1, T.y0, T.z0, T.z0 + 1, 'flap');
      k.emblem(C.c, SUN, T.y1 - 2);
      return topCover(t);
    },
    wear_ice_jumper: function (k, C, o) {
      var t = { c: C.a, len: 'long', sleeve: 'long', mode: 'cobble', hemMode: 'plank', cuff: null }; top(k, t);
      k.emblem(C.b, SNOW, k.T.y1 - 1);
      neck(k, o.skin); return topCover(t);
    },
    wear_sig_apron: function (k, C, o) {
      var T = k.T, t = { c: C.b, sleeve: 'short' }; top(k, t);
      var m = k.mid(5), n = k.mid(3);
      k.front(C.a, m[0], m[1], T.y0, T.y1 - 2, 'apron');
      k.front(C.a, n[0], n[1], T.y1 - 2, T.y1, 'apron');
      k.box('body', C.a, m[0], m[1], T.y0 - 2, T.y0, T.z1 - 1, T.z1, 'flap');
      k.front(sh(C.a), n[0], n[1], T.y0 + 1, T.y0 + 2, 'pocket', { lod: 'mid' });
      neck(k, o.skin); return topCover(t);
    },
    wear_sig_aviator: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: C.b }; top(k, t);
      [-1, 1].forEach(function (d) { var x = k.col(d); k.front(C.b, x[0], x[1], T.y1 - 2, T.y1 - 1, 'collar'); });
      var m = k.mid(1); k.front(C.as, m[0], m[1], T.y0 + 1, T.y1 - 2, 'zip', { lod: 'mid' });
      return topCover(t);
    },
    wear_sig_rinkjacket: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: C.b, cuff: C.b }; top(k, t);
      k.limbs('upper', C.b, ARM_TOP(k.D) - 1, ARM_TOP(k.D), 'band');
      var m = k.mid(1); k.front(C.b, m[0], m[1], T.y0 + 1, T.y1 - 1, 'zip', { lod: 'mid' });
      return topCover(t);
    },

    /* ---- bottoms ---- */
    wear_free_jeans: function (k, C) { var b = { c: C.a, len: 'long', mode: 'leaf', waist: C.b }; bottom(k, b); return bottomCover(b); },
    wear_free_shorts: function (k, C) { var b = { c: C.a, len: 'shorts' }; bottom(k, b); return bottomCover(b); },
    wear_bot_joggers: function (k, C) {
      var b = { c: C.a, len: 'long' }; bottom(k, b);
      k.outer('thigh', C.b, k.R.shinL.y0 + 1, k.R.thighL.y1, 'stripe');
      return bottomCover(b);
    },
    wear_bot_cargo: function (k, C) {
      var b = { c: C.a, len: 'long' }; bottom(k, b);
      k.outer('thigh', C.as, k.R.thighL.y0, k.R.thighL.y0 + 1, 'pocket');
      return bottomCover(b);
    },
    wear_bot_skirt: function (k, C) {
      var T = k.T, b = { c: C.a, len: 'none', waist: C.a }; bottom(k, b);
      k.flare(C.a, T.y0 - 2, T.y0, 'flare', null, 1);
      k.flare(C.as, T.y0 - 2, T.y0 - 1, 'flare', { mode: 'plank' }, 1);
      return bottomCover(b);
    },
    wear_bot_layer: function (k, C) {
      var T = k.T, b = { c: C.a, len: 'none', waist: C.a }; bottom(k, b);
      k.flare(C.a, T.y0 - 2, T.y0, 'flare', null, 1);
      k.flare({ token: C.b, mode: 'snow' }, T.y0 - 1, T.y0, 'flare', null, 1);
      return bottomCover(b);
    },
    wear_bot_dungarees: function (k, C) { var b = { c: C.a, len: 'long', mode: C.a === tk('Denim') ? 'leaf' : null }; bottom(k, b); return bottomCover(b); },
    wear_bot_leggings: function (k, C) { var b = { c: C.a, len: 'long' }; bottom(k, b); return bottomCover(b); },
    wear_pier_boardies: function (k, C) {
      var b = { c: C.a, len: 'knee', cuff: null }; bottom(k, b);
      k.outer('thigh', C.b, k.R.shinL.y1 - 1, k.R.thighL.y1, 'panel');
      return bottomCover(b);
    },

    /* ---- shoes ---- */
    wear_free_sneakers: function (k, C) { shoes(k, { c: C.a, sole: C.b }); return ['footL', 'footR']; },
    wear_shoe_hightops: function (k, C) { shoes(k, { c: C.a, sole: C.b, high: 1, lace: C.b }); return ['footL', 'footR']; },
    wear_shoe_boots: function (k, C) { shoes(k, { c: C.a, sole: C.as, high: 1, cuffTop: C.b, lace: C.b }); return ['footL', 'footR']; },
    wear_shoe_wellies: function (k, C) { shoes(k, { c: C.a, sole: C.as, high: 2 }); return ['footL', 'footR']; },
    wear_shoe_glow: function (k, C) { shoes(k, { c: C.a, sole: { token: C.b, mode: 'glow' } }); return ['footL', 'footR']; },
    wear_shoe_slides: function (k, C, o) {
      var skin = o.skin || C.b;
      ['L', 'R'].forEach(function (s) {
        var f = k.R['foot' + s];
        k.box(f.bone, C.a, f.x0, f.x1, 0, 1, f.z0, f.z1, 'sole');
        k.box(f.bone, skin, f.x0, f.x1, 1, 2, f.z0, f.z1 - 1, 'foot');
        k.box(f.bone, C.b, f.x0, f.x1, 1, 2, f.z1 - 3, f.z1 - 2, 'strap');
      });
      return ['footL', 'footR'];
    },
    wear_jungle_boots: function (k, C) { shoes(k, { c: C.a, sole: 'PX Cloth Charcoal', toe: C.as, high: 1, cuffTop: C.b, lace: C.b }); return ['footL', 'footR']; },
    wear_ice_skates: function (k, C) { shoes(k, { c: C.a, blade: C.b, high: 1 }); return ['footL', 'footR']; },

    /* ---- outfits ---- */
    wear_fit_dino: function (k, C) { return onesie(k, C, function () {
      var T = k.T, m = k.mid(3), n = k.mid(1);
      k.box('body', C.a, m[0], m[1], T.y0, T.y0 + 2, T.z0 - 2, T.z0, 'tail').box('body', C.a, n[0], n[1], T.y0 - 1, T.y0 + 1, T.z0 - 3, T.z0 - 2, 'tail');
      k.box('body', C.b, n[0], n[1], T.y0 + 2, T.y0 + 3, T.z0 - 2, T.z0 - 1, 'spike');
    }); },
    wear_fit_shark: function (k, C) { return onesie(k, C, function () {
      var T = k.T, n = k.mid(1);
      k.box('body', C.a, n[0], n[1], T.y0 - 1, T.y0 + 2, T.z0 - 2, T.z0, 'fin');
    }); },
    wear_fit_unicorn: function (k, C) { return onesie(k, C, function () {
      var T = k.T, n = k.mid(1);
      k.box('body', C.b, n[0], n[1], T.y0, T.y0 + 2, T.z0 - 1, T.z0, 'tail').box('body', C.b, n[0], n[1], T.y0 - 1, T.y0, T.z0 - 2, T.z0 - 1, 'tail');
    }, true); },
    wear_ice_penguin: function (k, C) { return onesie(k, C, function () {
      var T = k.T, m = k.mid(3);
      k.box('body', C.a, m[0], m[1], T.y0, T.y0 + 1, T.z0 - 1, T.z0, 'tail');
    }); },
    wear_fit_astro: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: C.c, cuff: C.b }; top(k, t);
      bottom(k, { c: C.a, len: 'long', waist: C.c, cuff: C.b });
      k.torso(C.c, T.y0 + 1, T.y0 + 2, 'belt');
      var x = k.col(-2); k.front(C.b, x[0], x[1], T.y1 - 3, T.y1 - 2, 'patch');
      x = k.col(2); k.front('PX Cloth Gold', x[0], x[1], T.y1 - 3, T.y1 - 2, 'patch');
      k.limbs('hand', C.b, k.D.arm.hand, k.D.arm.hand + 1, 'glove');
      shoes(k, { c: C.c, sole: 'PX Cloth Charcoal', high: 1, cuffTop: C.b });
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'handL', 'handR']);
    },
    wear_fit_robot: function (k, C) {
      var T = k.T, D = k.D;
      k.box('body', C.a, T.x0, T.x1, T.y0, T.y1, T.z0, T.z1 + 1, 'box');
      k.box('body', sh(C.a), T.x0, T.x1, T.y1 - 1, T.y1, T.z0, T.z1 + 1, 'box');
      var p = k.mid(3), d1 = k.col(-1), d2 = k.col(1);
      k.box('body', { token: C.b, mode: 'glow' }, p[0], p[1], T.y0 + 3, T.y0 + 4, T.z1, T.z1 + 1, 'panel');
      k.box('body', 'PX Cloth Red', d1[0], d1[1], T.y0 + 1, T.y0 + 2, T.z1, T.z1 + 1, 'dial', { lod: 'mid' });
      k.box('body', 'PX Cloth Sunny', d2[0], d2[1], T.y0 + 1, T.y0 + 2, T.z1, T.z1 + 1, 'dial', { lod: 'mid' });
      k.limbs('upper', C.c, D.arm.cuff, D.arm.y1, 'sleeve', { mode: 'plank' });
      bottom(k, { c: C.c, len: 'long', mode: 'plank' });
      return ['torso', 'neck', 'upperL', 'upperR', 'foreL', 'foreR', 'thighL', 'thighR', 'shinL', 'shinR'];
    },
    wear_fit_pyjamas: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: C.b }; top(k, t);
      bottom(k, { c: C.a, len: 'long' });
      [[-2, T.y1 - 3], [1, T.y0 + 1]].forEach(function (p) { var x = k.col(p[0]); k.front(C.b, x[0], x[1], p[1], p[1] + 1, 'star', { lod: 'mid' }); });
      var b = k.col(1); k.back(C.b, b[0], b[1], T.y0 + 3, T.y0 + 4, 'star', { lod: 'mid' });
      k.limbFront('thigh', C.b, k.R.shinL.y0 + 1, k.R.shinL.y0 + 2, 'star', { lod: 'mid' });
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR']);
    },
    wear_fit_hero: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: true, cuff: C.b }; top(k, t);
      bottom(k, { c: C.a, len: 'long', waist: C.b, cuff: C.b });
      k.emblem(C.b, STAR, T.y1 - 2);
      k.limbs('hand', C.b, k.D.arm.hand, k.D.arm.hand + 1, 'glove');
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR', 'handL', 'handR']);
    },
    wear_sig_tracksuit: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: C.as }; top(k, t);
      bottom(k, { c: C.a, len: 'long', waist: C.as });
      k.outer('upper', C.b, k.D.arm.cuff + 1, k.D.arm.y1, 'stripe');
      k.outer('thigh', C.b, k.R.shinL.y0 + 1, k.R.thighL.y1, 'stripe');
      var m = k.mid(1); k.front(C.b, m[0], m[1], T.y0 + 1, T.y1 - 1, 'zip', { lod: 'mid' });
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR']);
    },
    wear_sig_robe: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', cuff: C.b, collar: C.b, collarLod: 'mid' }; top(k, t);   /* the collar sits under the chin: LOW leaves it */
      bottom(k, { c: C.a, len: 'long', cuff: null });
      k.flare(C.a, 1, T.y0, 'flare', null, 1);
      [[-1, T.y0 - 2], [-2, T.y1 - 3]].forEach(function (p) { var x = k.col(p[0]); k.box('body', C.b, x[0], x[1], p[1], p[1] + 1, T.z1, T.z1 + 1, 'star', { lod: 'mid' }); });
      ['L', 'R'].forEach(function (s) { var f = k.R['foot' + s]; k.box(f.bone, sh(C.a), f.x0, f.x1, 0, 1, f.z0, f.z1, 'slipper'); k.box(f.bone, C.a, f.x0, f.x1, 1, 2, f.z0, f.z1 - 1, 'slipper'); });
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']);
    },
    wear_sig_kit: function (k, C, o) {
      var T = k.T, t = { c: C.a, sleeve: 'short', cuff: C.b }; top(k, t);
      bottom(k, { c: C.b, len: 'shorts' });
      k.limbs('shin', C.a, k.R.shinL.y0, k.R.shinL.y1, 'sock');
      var x = k.col(2); k.front(C.c, x[0], x[1], T.y1 - 3, T.y1 - 2, 'crest');
      shoes(k, { c: 'PX Cloth Charcoal', sole: 'PX Cloth White' });
      neck(k, o.skin);
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']);
    },
    wear_sig_overalls: function (k, C) {
      var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: true }; top(k, t);
      bottom(k, { c: C.a, len: 'long', waist: C.as, cuff: null });
      ['L', 'R'].forEach(function (s) { var x = s === 'L' ? [T.x1 - 1, T.x1] : [T.x0, T.x0 + 1]; k.box('body', C.b, x[0], x[1], T.y0 + 1, T.y1, T.z0 + 1, T.z1 - 1, 'stripe'); });
      k.outer('thigh', C.b, k.R.shinL.y0 + 1, k.R.thighL.y1, 'stripe');
      shoes(k, { c: 'PX Cloth Charcoal', sole: 'PX Cloth Charcoal Shade', high: 1 });
      return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']);
    },

    /* ---- the free Spark Stick (bone wand): px-crew's 4-point ✦ round a member diamond with a
       white heart, on a dark handle; the grip one voxel under the wand joint ---- */
    wear_free_spark: function (k, C) {
      var S = k.D.sockets.hand.at, x = S[0], z = S[2], y = S[1] - 1, hi = y + 5, r = 4;
      k.box('wand', 'Midnight Ink', x - 0.5, x + 0.5, y, hi, z - 0.5, z + 0.5, 'handle');
      for (var j = -r; j <= r; j++) {
        var run = null;
        for (var i = -r; i <= r + 1; i++) {
          var d = Math.abs(i) + Math.abs(j), on = i <= r && (d <= 2 || i === 0 || j === 0), c = on ? (d <= 1 ? 'W' : 'G') : null;
          if (run && run.c !== c) { addStar(k, run, i, j, x, hi, z, r, C); run = null; }
          if (c && !run) run = { c: c, i0: i };
        }
      }
      return [];
    }
  };
  function addStar(k, run, i1, j, x, hi, z, r, C) {
    var c = run.c === 'W' ? { token: 'Cloud White', mode: 'glow' } : Object.assign({}, C.a, { mode: 'glow' });
    var y0 = hi + (r + j) / 2;
    k.box('wand', c, x + (run.i0 - 0.5) / 2, x + (i1 - 0.5) / 2, y0, y0 + 0.5, z - 0.5, z + 0.5, run.c === 'W' ? 'spark' : 'star');
  }
  /* a onesie: the long top and trousers in one colour, the tummy panel in b, cuffs at wrists and
     ankles, a closed collar; extra() adds the tail; light: a pale onesie keeps no tummy panel */
  function onesie(k, C, extra, light) {
    var T = k.T, t = { c: C.a, len: 'long', sleeve: 'long', collar: true, hem: null }; top(k, t);
    bottom(k, { c: C.a, len: 'long' });
    if (!light) { var m = k.mid(3); k.front(C.b, m[0], m[1], T.y0, T.y1 - 1, 'tummy'); }
    extra();
    return topCover(t).concat(['thighL', 'thighR', 'shinL', 'shinR']);
  }
  /* the dungarees' bib and straps: the one layer drawn over the top */
  function bib(k, C) {
    var T = k.T, m = k.mid(T.x1 - T.x0 - 4), c = C.a, x = c === tk('Denim') ? { mode: 'leaf' } : null;   /* the top shows either side */
    k.front(c, m[0], m[1], T.y0 + 1, T.y1 - 1, 'bib', x);
    [-1, 1].forEach(function (s) {
      var sx = s < 0 ? [m[0] - 1, m[0]] : [m[1], m[1] + 1];
      k.front(c, sx[0], sx[1], T.y1 - 2, T.y1, 'strap');
      k.back(c, sx[0], sx[1], T.y0 + 1, T.y1, 'strap');
      k.box('body', c, sx[0], sx[1], T.y1 - 1, T.y1, T.z0 + 1, T.z1 - 1, 'strap');
      k.front(C.b, sx[0], sx[1], T.y1 - 2, T.y1 - 1, 'button', { lod: 'mid' });
    });
    return k;
  }

  /* ---------------- the plain layer (an empty slot): KU-CH4's BASE_FILL ---------------- */
  var PLAIN = { top: 'PX Cover White', bottom: 'PX Cover Navy', shoes: 'PX Cover White' };
  var plainR = {
    top: function (k, o) { var t = { c: PLAIN.top, sleeve: 'short' }; top(k, t); neck(k, o.skin); return topCover(t); },
    bottom: function (k) { var b = { c: PLAIN.bottom, len: 'long', waist: PLAIN.bottom }; bottom(k, b); return bottomCover(b); },
    shoes: function (k) { shoes(k, { c: PLAIN.shoes, sole: sh(PLAIN.shoes) }); return ['footL', 'footR']; }
  };

  /* ================================================================
     BUILDERS
     ================================================================ */
  function descriptor(body) {
    var B = bodyMod();
    if (body && typeof body === 'object' && body.torso && body.regions) return body;
    if (body && typeof body === 'object') { var lk = B.drawLook(body); return B.bodyOf(lk.bd, lk.ht); }
    return B.bodyOf(1, 0);
  }
  function finish(l, tier) {
    var B = bodyMod();
    return tier ? B.lodFilter(l, tier) : l;
  }
  function build(id, body, o, plainSlot) {
    o = o || {};
    ready();
    var D = descriptor(body), k = new Kit(D), C = plainSlot ? null : colours(id, o.cw, o.member);
    var cover = plainSlot ? plainR[plainSlot](k, o) : R[id](k, C, o);
    var over = null;
    if (id === 'wear_bot_dungarees') { var kb = new Kit(D); bib(kb, C); over = finish(kb.l, o.tier); }
    var out = finish(k.l, o.tier);
    Object.defineProperty(out, 'cover', { value: cover.slice() });
    Object.defineProperty(out, 'over', { value: over });
    return out;
  }
  /* the piece alone on a body (its boxes, then .over and .hood as separate own properties) */
  function piece(id, body, o) {
    if (!has(id)) return null;
    o = o || {};
    var out = build(id, body, o), hd = hood(id, body, o);
    Object.defineProperty(out, 'hood', { value: hd ? finish(hd, o.tier) : null });
    return out;
  }
  var COVER_CACHE = {};
  function covers(id) {
    if (!has(id)) return [];
    if (!COVER_CACHE[id]) COVER_CACHE[id] = build(id, null, {}).cover;
    return COVER_CACHE[id].slice();
  }
  function mergeInto(out, l) {
    if (!l) return out;
    Object.keys(l).forEach(function (b) { (l[b] || []).forEach(function (bx) { (out[b] = out[b] || []).push(bx); }); });
    return out;
  }
  /* a short top leaves the hips row to the bottom: on the Fitting Friend that row is clay */
  function display(id, o) {
    if (!has(id)) return null;
    o = o || {};
    var B = bodyMod(), D = B.bodyOf(1, 0), slot = PIECES[id].slot, pc = piece(id, D, { cw: o.cw, member: o.member, skin: B.CLAY });
    var ff = B.fittingFriend({ cover: pc.cover }), out = mergeInto({}, ff), T = D.torso;
    if (slot === 'top') (out.body = out.body || []).push({ b: 'body', c: B.CLAY, x0: T.x0 + 1, x1: T.x1 - 1, y0: T.y0, y1: T.y0 + 1, z0: T.z0, z1: T.z1, tag: 'clay' },
      { b: 'body', c: B.CLAY, x0: T.x0, x1: T.x1, y0: T.y0, y1: T.y0 + 1, z0: T.z0 + 1, z1: T.z1 - 1, tag: 'clay' });
    mergeInto(out, pc); mergeInto(out, pc.over); mergeInto(out, pc.hood);
    return finish(out, o.tier);
  }

  /* ---------------- what is shown: people-core resolve(), else the same rules here ---------------- */
  function shownOf(look, wear, vr, w) {
    var P = core();
    if (P && typeof P.resolve === 'function') {
      var r = P.resolve(look, wear, vr, w);
      return { look: r.look, show: r.show, vr: r.vr, glasses: r.flags.glasses, hood: r.flags.hood, spark: r.flags.spark };
    }
    var src = wear && typeof wear === 'object' ? wear : {}, show = {}, outV = {}, fit = null;
    ['outfit'].concat(SLOTS, ['hand']).forEach(function (s) { if (has(src[s]) && PIECES[src[s]].slot === s) show[s] = src[s]; });
    fit = show.outfit || null;
    if (fit) { delete show.top; delete show.bottom; if (flagged(fit, 'coversShoes')) delete show.shoes; }
    Object.keys(show).forEach(function (s) { var c = vr && vr[show[s]]; outV[show[s]] = int(c) && c >= 0 && c < PIECES[show[s]].cw ? c : 0; });
    var B = bodyMod(), lk = B.drawLook(look);
    return { look: lk, show: show, vr: outV, glasses: lk.gl > 0, hood: flagged(fit, 'hoodUp'), spark: !show.hand || show.hand === 'wear_free_spark' };
  }
  /* a head covering always shows in full (identity): the onesie's hood is worn down over the hijab,
     sports hijab, patka, turban and headwrap; a kippah sits under the hood like hair */
  var HOOD_DOWN = { 1: 1, 2: 1, 3: 1, 4: 1, 6: 1 };
  function cellsList(list, keep) {
    var Hm = hairMod(), cells = [], toks = {};
    Hm.cellsOf(list).forEach(function (c) {
      var bx = c[3];
      if (!keep(c[0], c[1], c[2], bx)) return;
      var role = (bx.tag || 'hair') + '|' + (typeof bx.c === 'string' ? bx.c : JSON.stringify(bx.c));
      toks[role] = bx.c;
      cells.push({ i: c[0], j: c[1], k: c[2], role: role, lod: bx.lod || null, mode: bx.mode || null, proud: !!bx.proud });
    });
    var grid = Hm.boxes(cells.filter(function (e) { return !e.proud; }), toks, false, 'head');
    var pr = Hm.boxes(cells.filter(function (e) { return e.proud; }), toks, true, 'head');
    return grid.concat(pr).map(function (b) { b.tag = b.tag.split('|')[0]; return b; });
  }
  /* the whole figure without accessories */
  function dress(look, wear, vr, o) {
    o = o || {};
    ready();
    var B = bodyMod(), Hm = hairMod(), S = shownOf(look, wear, vr, o.w), lk = S.look, D = B.bodyOf(lk.bd, lk.ht);
    var skin = B.skinToken(lk.sk), H = D.head.y0, fit = S.show.outfit || null, coversEyes = !!o.coversEyes || !S.glasses;
    var hoodUp = !!(fit && flagged(fit, 'hoodUp') && !HOOD_DOWN[lk.cv]);
    var bo = function (id) { return { cw: S.vr[id], member: o.member, skin: skin }; };
    var parts = [], cover = [];
    function use(id, slot) {
      var pc = slot ? build(null, D, { member: o.member, skin: skin }, slot) : build(id, D, bo(id));
      cover = cover.concat(pc.cover);
      parts.push(pc);
      return pc;
    }
    if (fit) use(fit);
    else {
      var bt = S.show.bottom ? use(S.show.bottom) : use(null, 'bottom');
      if (S.show.top) use(S.show.top); else use(null, 'top');
      if (bt.over) parts.push(bt.over);
    }
    if (!(fit && flagged(fit, 'coversShoes'))) { if (S.show.shoes) use(S.show.shoes); else use(null, 'shoes'); }
    var fills = { torso: skin, upper: skin, fore: skin, hand: skin, thigh: skin, shin: skin, foot: skin };
    var base = B.person(lk, { cover: cover, fills: fills }), out = {};
    var noEars = hoodUp || (Hm && typeof Hm.earsHidden === 'function' && Hm.earsHidden(lk));
    Object.keys(base).forEach(function (b) { out[b] = base[b].filter(function (bx) { return !(noEars && bx.tag === 'ear'); }); });
    /* the identity pieces on the head */
    var joints = {};
    if (Hm && !o.noHair) {
      if (hoodUp) {
        var hp = Hm.headPieces(lk, { coversEyes: coversEyes });
        var keep = function (i, j, k, bx) {
          if (/^aid/.test(bx.tag)) return false;
          if (bx.proud) return k >= 5;                                         /* the glasses' front frames only */
          if (/^hair/.test(bx.tag)) return k === 4 && Math.abs(i) <= 3 && j < H + 8;   /* a fringe under the brim */
          return false;                                                        /* a kippah sits under the hood */
        };
        out.head = (out.head || []).concat(cellsList({ head: hp.head }, keep));
      } else {
        var pieces = Hm.headPieces(lk, { coversEyes: coversEyes, omit: o.omit });
        mergeInto(out, pieces);
        if (pieces.joints && pieces.joints.hairTail) joints.hairTail = pieces.joints.hairTail;
      }
    }
    parts.forEach(function (pc) { mergeInto(out, pc); });
    if (fit && flagged(fit, 'hoodUp')) {
      if (hoodUp) mergeInto(out, hood(fit, D, bo(fit)));
      else { var kd = new Kit(D); hoodDown(kd, colours(fit, S.vr[fit]).a); mergeInto(out, kd.l); }
    }
    if (S.spark) mergeInto(out, build('wear_free_spark', D, { member: o.member }));
    out = finish(out, o.tier);
    Object.defineProperty(out, 'joints', { value: joints });
    Object.defineProperty(out, 'cover', { value: cover });
    Object.defineProperty(out, 'hoodUp', { value: hoodUp });
    return out;
  }
  /* the plain layer as one piece set (for the lab and the 2D art) */
  function plain(slot, body, o) { return SLOTS.indexOf(slot) >= 0 && plainR[slot] ? build(null, body, o || {}, slot) : null; }

  return {
    VERSION: VERSION, SOURCE: SOURCE, SLOTS: SLOTS, CAPS: CAPS, BOUND: BOUND, EXTRA_TAGS: EXTRA_TAGS, CLOTH: CLOTH, TOKENS: TOKENS, PIECES: PIECES, IDS: IDS,
    PLAIN: PLAIN, HOOD_DOWN: HOOD_DOWN,
    has: has, colours: colours, covers: covers, piece: piece, hood: hood, display: display, dress: dress, plain: plain,
    hexOf: hexOf, shadeHex: shadeHex, ready: ready, inHead: inHead
  };
}));
