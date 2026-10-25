/* ================================================================
   My Island — people core (pure; no DOM, no THREE, no clock).
   window.SLPeopleCore in the browser (loaded by slLoadWorld straight after
   world-core.js), require() in Node. Kids update chunk KU-CH1
   (docs/island3d/v3/kids-update/plan-ku.json; characters.json design.cast,
   lookSchema, wardrobe, economy, storage.wChars and lookCode).

   Every child gets a character: the free 'Me' made in the creator, or one
   of 12 ready-made characters bought with ⭐. A character has three layers:
     IDENTITY  the look (skin, face, hair, coverings, glasses, hearing aids,
               shape, height): small integers, always free (lookSchema)
     STYLE     wear: 9 slots of outfits and accessories, plus hair dyes
     CHARACTER char_*: a full look, signature pieces and a special move

   Characters ('char') and wearables ('wear') are catalogue items registered
   into SLWorldCore through its plug-in seam (C.defineItems('people', …),
   KU-CH2): purchase(), the ledger, test mode, the fixed 'ku_<id>_<n>' tx,
   void rows (D79) and the merge's charge-once rule all apply unchanged. They
   go into BY_ID, never into CATALOG. Ownership is w.owned (char_me and the
   six free basics are 'free': always had, never in w.owned).

   Character state is the v3-only block w.chars, which old clients never read:
     w.chars = {v: 1, active: 'char_me' | '<char id>' | null,
                list: [{id, look: {sk ey ec hs hc cv cc gl gc ha hac fr bl bd ht},
                        wear: {top bottom shoes outfit head face neck back hand},
                        vr: {<wearId>: colourway}}],
                at: ISO}
   It appears at the first character write (finishing 'Make me', buying a
   character, any look, wear or active change). No block → the classic avatar.
   Nothing here ever writes a photo field (fromPhoto, confidence, margin or
   sample): a colour picked from a photo is an ordinary look value (KU16).

   Two world-core hooks (named N14 and M3d, plan-ku KU11):
     N14  normalize: w.chars shape, a record for every owned character, look
          ints, wear owned or free, the active character (normalizeChars)
     M3d  merge: w.chars whole from the fork with the newer chars.at, records
          only the other fork has appended (mergeChars)

   API (u = a profile {name, points, world}, w = u.world, ms = the clock):
     avatarInfo(w, u)           null (the classic avatar) or {id, name, look, wear, vr, sig, lk, wr}:
                                the ONE source for 'who is the player figure'
     charList(w, u?)            shown characters, char_me first: {id, name, look, wear, vr, active, sig, land}
     setup(u, look, wear?, ms)  create or update char_me and make it active
     setLook(u, id, look, ms)   likeMe(u, id, ms)   wear(u, id, wearId, ms)
     setColourway(u, id, wearId, n, ms)   setActive(u, id, ms)
                                every writer returns {ok: true, …} or {ok: false, code, reason}
     has(w, id)                 owned, or free
     resolve(look, wear, vr, w?) the draw-ready description both renderers use
     validateLook(look)         the draw-ready copy (unknown values → defaults); never throws
     lookCode / parseLookCode / wearCode / parseWearCode   on-device cache keys only
     PALETTES, TOKENS, shadeHex, lstar        the identity colours (KU23 token names)
     CAST, MOVES, WEAR, ITEMS, item(id), castOf(id), display(id), FIELDS, SLOTS, HAIR, COVERINGS
     hooks {onPurchase, normalize (N14), merge (M3d), goalField: 'goalK'}, register(C), registration
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var core = null;
    try { core = require('./world-core.js'); } catch (e) { core = null; }
    module.exports = factory(root, core);
  } else root.SLPeopleCore = factory(root, root.SLWorldCore || null);
}(typeof self !== 'undefined' ? self : this, function (root, CORE0) {
  'use strict';

  var SOURCE = 'people';
  var KINDS = ['char', 'wear'];
  var EPOCH = '1970-01-01T00:00:00.000Z';     /* chars.at of a block normalize had to create */
  var PHOTO_KEYS = ['fromPhoto', 'confidence', 'margin', 'sample'];   /* never written, always dropped */
  function core() { return CORE0 || (root && root.SLWorldCore) || null; }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowIso(ms) { return new Date(ms == null ? Date.now() : ms).toISOString(); }
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }

  /* ---------------- the look (lookSchema): small integers, append-only codes ----------------
     [key, values (a range [lo, hi] or a list), default]. A value this client does not know is
     kept in the save (an int up to 255, future data) and drawn as the field's default. */
  var FIELD_ROWS = [
    ['sk', [0, 9], 4], ['ey', [0, 3], 0], ['ec', [0, 5], 0], ['hs', [0, 21], 2],
    ['hc', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25], 1],     /* 20-25 need their dye */
    ['cv', [0, 6], 0], ['cc', [0, 7], 0], ['gl', [0, 4], 0], ['gc', [0, 5], 0],
    ['ha', [0, 2], 0], ['hac', [0, 3], 0], ['fr', [0, 1], 0], ['bl', [0, 1], 0], ['bd', [0, 2], 1], ['ht', [0, 1], 0]
  ];
  var FIELDS = FIELD_ROWS.map(function (r) {
    var list = r[1].length === 2 && r[0] !== 'hc' ? null : r[1];
    return { key: r[0], min: list ? list[0] : r[1][0], max: list ? list[list.length - 1] : r[1][1], values: list, def: r[2] };
  });
  var FIELD_KEYS = FIELDS.map(function (f) { return f.key; });
  var FIELD = {}, VALID = {};             /* VALID[key][v] === 1 for every value this client knows */
  FIELDS.forEach(function (f) {
    FIELD[f.key] = f; VALID[f.key] = {};
    if (f.values) f.values.forEach(function (v) { VALID[f.key][v] = 1; });
    else for (var v = f.min; v <= f.max; v++) VALID[f.key][v] = 1;
  });
  function validValue(key, v) { return isInt(v) && own(VALID, key) && VALID[key][v] === 1; }
  var DEFAULT_LOOK = {};
  FIELDS.forEach(function (f) { DEFAULT_LOOK[f.key] = f.def; });
  /* the draw-ready copy: every field, each a value this client knows (else the default) */
  function validateLook(look) {
    var out = {}, src = plain(look) ? look : {}, i, k, v;
    for (i = 0; i < FIELDS.length; i++) {
      k = FIELDS[i].key;
      try { v = src[k]; } catch (e) { v = undefined; }
      out[k] = isInt(v) && VALID[k][v] === 1 ? v : FIELDS[i].def;
    }
    return out;
  }

  /* hairstyles, head coverings, glasses and hearing aids: the identity tables (shapes and
     crown descriptors live in people-shapes-hair.js). Every option is free, for everyone. */
  var HAIR = [
    ['h_none', 'No hair', '-', 0], ['h_buzz', 'Buzz cut', 'any', 0], ['h_crop', 'Short crop', 'straight', 1],
    ['h_sidepart', 'Side part', 'straight', 1], ['h_curtain', 'Curtain fringe', 'straight', 1], ['h_wavyshort', 'Short waves', 'wavy', 1],
    ['h_curlyshort', 'Short curls', 'curly', 1], ['h_coilyshort', 'Short coils', 'coily', 1], ['h_afro', 'Afro', 'coily', 2],
    ['h_puffs', 'Afro puffs', 'coily', 1], ['h_bob', 'Bob', 'straight', 2], ['h_shoulder', 'Shoulder length', 'straight', 3],
    ['h_shoulderwavy', 'Shoulder waves', 'wavy', 3], ['h_long', 'Long and straight', 'straight', 4], ['h_longcurly', 'Long curls', 'curly', 4],
    ['h_pony', 'Ponytail', 'any', 3], ['h_pigtails', 'Pigtails', 'any', 3], ['h_braids', 'Two braids', 'any', 4],
    ['h_locs', 'Locs', 'coily', 3], ['h_bun', 'Top bun', 'any', 2], ['h_spacebuns', 'Space buns', 'any', 2], ['h_cornrows', 'Cornrows', 'coily', 1]
  ].map(function (r, n) { return { n: n, id: r[0], name: r[1], texture: r[2], length: r[3] }; });
  var COVERINGS = [
    [1, 'cv_hijab', 'Hijab'], [2, 'cv_sporthijab', 'Sports hijab'], [3, 'cv_patka', 'Patka'],
    [4, 'cv_turban', 'Turban'], [5, 'cv_kippah', 'Kippah'], [6, 'cv_headwrap', 'Headwrap']
  ].map(function (r) { return { n: r[0], id: r[1], name: r[2] }; });
  var GLASSES = ['none', 'round', 'square', 'rectangle', 'sporty band'];
  var AIDS = ['none', 'behind the ear', 'round processor'];

  /* ---------------- palettes: original colours (the hex lives here, the 2D art reads it) -------
     Tokens follow KU23 ('PX Skin …', 'PX Hair …', 'PX Eye …', 'PX Frame …', 'PX Cover …',
     'PX Aid …', 'PX Mouth …', 'PX Clay …'); px-people.js registers TOKENS through
     SLIslandLook.addTokens('px-people', …). Every token has a ' Shade' partner at ×0.86 HSL
     lightness (two-tone shading). Skin is shown as swatches only: 'Skin tone 3 of 10'. */
  var PALETTES = {
    skin: [['PX Skin 1', '#FCE5D6'], ['PX Skin 2', '#F6D3BC'], ['PX Skin 3', '#EDC0A0'], ['PX Skin 4', '#E0AA84'], ['PX Skin 5', '#CF956C'],
           ['PX Skin 6', '#B97E57'], ['PX Skin 7', '#9E6744'], ['PX Skin 8', '#835236'], ['PX Skin 9', '#683F2A'], ['PX Skin 10', '#4D2E20']],
    /* ΔL* ≥ 20 between mouth and skin on every tone: Deep on tones 0-5, Rose on 6-9. Rose is
       lighter than the first draft (#E07A86 gave ΔL* 14 on tone 6). */
    mouth: { deep: ['PX Mouth Deep', '#7A3341'], rose: ['PX Mouth Rose', '#F09AA5'], roseFrom: 6 },
    eyes: {
      iris: [['PX Eye Dark Brown', '#3A2618'], ['PX Eye Brown', '#6B4226'], ['PX Eye Hazel', '#8A6A2E'],
             ['PX Eye Green', '#4E8A4C'], ['PX Eye Blue', '#3F7BD0'], ['PX Eye Grey', '#7C8A99']],
      white: ['PX Eye White', '#F7F4EE'],     /* the sclera column where ΔL*(iris, skin) < 20 */
      glint: 'Cloud White'                    /* a world-look token, glow mode, every tier */
    },
    hairNatural: [['PX Hair Black', '#1E1B22'], ['PX Hair Dark Brown', '#3B2A22'], ['PX Hair Brown', '#5C3D2B'], ['PX Hair Light Brown', '#8A5E3C'],
                  ['PX Hair Auburn', '#7E3A24'], ['PX Hair Ginger', '#C0602E'], ['PX Hair Strawberry', '#D79A6A'], ['PX Hair Blonde', '#E6C27A'],
                  ['PX Hair Platinum', '#F1E6C8'], ['PX Hair Grey', '#B9B6B3']],
    /* [hc, token, hex, the dye that unlocks it] */
    hairFun: [[20, 'PX Hair Pink', '#FF8FC8', 'wear_dye_pink'], [21, 'PX Hair Lilac', '#C3A6FF', 'wear_dye_lilac'],
              [22, 'PX Hair Sky', '#7CC8FF', 'wear_dye_sky'], [23, 'PX Hair Mint', '#8FE3C4', 'wear_dye_mint'],
              [24, 'PX Hair Silver', '#DCE3EE', 'wear_dye_silver'], [25, 'PX Hair Sunset', '#FF9E6B', 'wear_dye_sunset']],
    hairTip: { 25: ['PX Hair Sunset Tip', '#FF5FA2'] },     /* sunset tips: the bottom third of the hair */
    glasses: [['PX Frame Ink', '#2B2D42'], ['PX Frame Tortoise', '#8A5A3C'], ['PX Frame Red', '#E2504C'],
              ['PX Frame Blue', '#3F7BD0'], ['PX Frame Pink', '#FF8FC8'], ['PX Frame Gold', '#E6B84A']],
    covering: [['PX Cover Navy', '#2E3A6B'], ['PX Cover Black', '#2B2D42'], ['PX Cover White', '#F4F1EC'], ['PX Cover Rose', '#E58FA6'],
               ['PX Cover Teal', '#2FA39A'], ['PX Cover Lilac', '#A98BD9'], ['PX Cover Sunflower', '#F2C14E'], ['PX Cover Coral', '#FF7F6B']],
    aid: [['PX Aid Beige', '#E8CDB0'], ['PX Aid Brown', '#7A5236'], ['PX Aid Blue', '#4FA3E0'], ['PX Aid Pink', '#FF8FC8']],
    fittingFriend: ['PX Clay Lilac', '#C9B8F0']
  };
  function rgbOf(hex) { var n = parseInt(String(hex).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hexOf(r, g, b) {
    return '#' + [r, g, b].map(function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? '0' + s : s; }).join('').toUpperCase();
  }
  /* the ' Shade' partner: the same hue and saturation at ×0.86 HSL lightness */
  function shadeHex(hex) {
    var c = rgbOf(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
    }
    l *= 0.86;
    if (!s) return hexOf(l, l, l);
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var hue = function (t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return hexOf(hue(h + 1 / 3), hue(h), hue(h - 1 / 3));
  }
  /* CIE L* (D65) of an sRGB hex: the contrast rules for the mouth and the sclera */
  function lstar(hex) {
    var c = rgbOf(hex), lin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var y = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    return 116 * (y > 216 / 24389 ? Math.pow(y, 1 / 3) : (24389 / 27 * y + 16) / 116) - 16;
  }
  var TOKENS = {};
  (function () {
    var add = function (pair) { TOKENS[pair[0]] = pair[1]; TOKENS[pair[0] + ' Shade'] = shadeHex(pair[1]); };
    PALETTES.skin.forEach(add); add(PALETTES.mouth.deep); add(PALETTES.mouth.rose);
    PALETTES.eyes.iris.forEach(add); add(PALETTES.eyes.white);
    PALETTES.hairNatural.forEach(add);
    PALETTES.hairFun.forEach(function (r) { add([r[1], r[2]]); });
    Object.keys(PALETTES.hairTip).forEach(function (k) { add(PALETTES.hairTip[k]); });
    PALETTES.glasses.forEach(add); PALETTES.covering.forEach(add); PALETTES.aid.forEach(add);
    add(PALETTES.fittingFriend);
  }());
  function tone(pair) { return { token: pair[0], hex: pair[1], shade: pair[0] + ' Shade', shadeHex: TOKENS[pair[0] + ' Shade'] }; }
  function funHair(hc) { for (var i = 0; i < PALETTES.hairFun.length; i++) if (PALETTES.hairFun[i][0] === hc) return PALETTES.hairFun[i]; return null; }
  function dyeOf(hc) { var r = funHair(hc); return r ? r[3] : null; }
  function mouthFor(sk) { return sk >= PALETTES.mouth.roseFrom ? PALETTES.mouth.rose : PALETTES.mouth.deep; }
  function needsSclera(sk, ec) {
    var s = PALETTES.skin[validValue('sk', sk) ? sk : DEFAULT_LOOK.sk], e = PALETTES.eyes.iris[validValue('ec', ec) ? ec : 0];
    return Math.abs(lstar(e[1]) - lstar(s[1])) < 20;
  }

  /* ---------------- the wardrobe: 103 wear ids (97 pieces + 6 dyes) ----------------
     [id, n (append-only code, never reused), slot, name, price, colourways, flags, desc]
     included (never sold on its own): the free basics and the signature pieces.
     free (always had, never in w.owned): the free basics. member: the piece wears the
     member colour (the classic hoodie and the Spark Stick, as px-crew). */
  var SLOTS = ['top', 'bottom', 'shoes', 'outfit', 'head', 'face', 'neck', 'back', 'hand'];
  var SLOT_CAPS = { top: 140, bottom: 100, shoes: 60, outfit: 300, head: 140, face: 60, neck: 60, back: 140, hand: 90, dye: 0 };
  var FREE_ROWS = [
    ['wear_free_hoodie', 1, 'top', 'Classic hoodie', 0, 1, null, 'The original, with drawstrings and a ✦ on the back. Always in your colour.'],
    ['wear_free_tee', 2, 'top', 'Plain tee', 0, 5, null, 'A plain tee in five colours. Goes with everything.'],
    ['wear_free_jeans', 3, 'bottom', 'Jeans', 0, 2, null, 'Everyday jeans in two washes.'],
    ['wear_free_shorts', 4, 'bottom', 'Shorts', 0, 3, null, 'Shorts for sunny days and running about.'],
    ['wear_free_sneakers', 5, 'shoes', 'Sneakers', 0, 3, null, 'Comfy sneakers, ready for anything.'],
    ['wear_free_spark', 6, 'hand', 'Spark Stick', 0, 1, null, 'Your Spark Stick with its four-point star. It lights up at Showtime.']
  ];
  var GENERAL_ROWS = [
    ['wear_top_stripes', 10, 'top', 'Stripy tee', 80, 3, null, 'Bold stripes, front and back.'],
    ['wear_top_star', 11, 'top', 'Star jumper', 120, 3, null, 'A chunky jumper with a ✦ knitted on the front.'],
    ['wear_top_varsity', 12, 'top', 'Varsity jacket', 180, 3, null, 'A two-tone jacket with contrast sleeves.'],
    ['wear_top_denim', 13, 'top', 'Denim jacket', 160, 2, null, 'A classic denim jacket with turned-up cuffs.'],
    ['wear_top_puffer', 14, 'top', 'Puffer jacket', 200, 3, null, 'A puffy jacket for chilly island evenings.'],
    ['wear_top_raincoat', 15, 'top', 'Raincoat', 150, 3, null, 'A bright raincoat. Puddles, bring it on.'],
    ['wear_top_overshirt', 16, 'top', 'Check overshirt', 140, 3, null, 'A checked overshirt, worn open.'],
    ['wear_top_stage', 17, 'top', 'Stage jacket', 260, 3, null, 'A cropped jacket with ✦ trim that glows steadily after dark.'],
    ['wear_bot_joggers', 20, 'bottom', 'Joggers', 70, 3, null, 'Soft joggers with a stripe down each side.'],
    ['wear_bot_cargo', 21, 'bottom', 'Cargo trousers', 110, 2, null, 'Trousers with pockets for everything you find.'],
    ['wear_bot_skirt', 22, 'bottom', 'Pleated skirt', 100, 3, null, 'A pleated skirt that swishes when you spin.'],
    ['wear_bot_layer', 23, 'bottom', 'Layered skirt', 140, 3, null, 'Three layers of skirt, made for the stage.'],
    ['wear_bot_dungarees', 24, 'bottom', 'Dungarees', 160, 2, null, 'Dungarees with a bib and two big buttons.'],
    ['wear_bot_leggings', 25, 'bottom', 'Leggings', 80, 4, null, 'Stretchy leggings for running, climbing and dancing.'],
    ['wear_shoe_hightops', 30, 'shoes', 'High-tops', 120, 3, null, 'High-tops with bright laces.'],
    ['wear_shoe_boots', 31, 'shoes', 'Lace-up boots', 130, 2, null, 'Sturdy boots for muddy paths.'],
    ['wear_shoe_wellies', 32, 'shoes', 'Wellies', 90, 3, null, 'Wellies for every puddle on the island.'],
    ['wear_shoe_glow', 33, 'shoes', 'Glow sneakers', 220, 3, null, 'The soles glow steadily after dark.'],
    ['wear_shoe_slides', 34, 'shoes', 'Slides', 60, 3, null, 'Easy slides for the beach and the pier.'],
    ['wear_fit_dino', 40, 'outfit', 'Dino onesie', 450, 2, ['hoodUp'], 'A dino hood with soft spikes, and a tail. Your face still shows.'],
    ['wear_fit_shark', 41, 'outfit', 'Shark onesie', 420, 2, ['hoodUp'], 'A grinning shark hood with soft felt teeth.'],
    ['wear_fit_unicorn', 42, 'outfit', 'Unicorn onesie', 450, 2, ['hoodUp'], 'A soft horn, a pastel mane and a hood to match.'],
    ['wear_fit_astro', 43, 'outfit', 'Space suit', 550, 2, ['coversShoes'], 'A white suit with a ✦ patch and chunky boots. No helmet needed.'],
    ['wear_fit_robot', 44, 'outfit', 'Robot costume', 500, 2, null, 'A homemade box costume with dials and a steady glowing panel.'],
    ['wear_fit_pyjamas', 45, 'outfit', 'Star pyjamas', 220, 3, null, 'Pyjamas covered in stars, for late nights on the island.'],
    ['wear_fit_hero', 46, 'outfit', 'Hero suit', 480, 3, null, 'An original hero suit with a ✦ on the chest. Add a cape from the Back rail.'],
    ['wear_head_beanie', 50, 'head', 'Bobble beanie', 80, 3, null, 'A knitted beanie with a big bobble on top.'],
    ['wear_head_cap', 51, 'head', 'Cap', 90, 3, null, 'A cap, worn backwards.'],
    ['wear_head_bucket', 52, 'head', 'Bucket hat', 110, 3, null, 'A bucket hat for sunshine and dance floors.'],
    ['wear_head_bow', 53, 'head', 'Bow headband', 60, 4, null, 'A headband with a big bow.'],
    ['wear_head_flowers', 54, 'head', 'Flower crown', 120, 2, null, 'A ring of bright flowers.'],
    ['wear_head_phones', 55, 'head', 'Headphones', 150, 3, null, 'Big headphones for your favourite tunes.'],
    ['wear_head_ears', 56, 'head', 'Cat-ear headband', 100, 3, null, 'A headband with two pointy cat ears.'],
    ['wear_head_crown', 57, 'head', 'Party crown', 200, 2, null, 'A card crown for big days.'],
    ['wear_face_shades', 60, 'face', 'Sunglasses', 110, 3, ['coversEyes'], 'Dark lenses for bright days. Your own glasses come back when you take them off.'],
    ['wear_face_starshades', 61, 'face', 'Star shades', 140, 3, ['coversEyes'], 'Star-shaped sunglasses. Very stage.'],
    ['wear_face_paint', 62, 'face', 'Star face paint', 60, 3, null, 'A ✦ painted on each cheek.'],
    ['wear_face_goggles', 63, 'face', 'Sports goggles', 120, 3, ['coversEyes'], 'Wraparound goggles for fast stuff.'],
    ['wear_neck_scarf', 70, 'neck', 'Stripy scarf', 70, 3, null, 'A long scarf in three stripes.'],
    ['wear_neck_bowtie', 71, 'neck', 'Bow tie', 60, 3, null, 'A neat bow tie for smart occasions.'],
    ['wear_neck_bandana', 72, 'neck', 'Bandana', 60, 3, null, 'A bandana knotted at the neck.'],
    ['wear_neck_charm', 73, 'neck', 'Star necklace', 90, 2, null, 'A ✦ pendant on a thin chain.'],
    ['wear_back_pack', 80, 'back', 'Backpack', 150, 3, null, 'A roomy backpack with a front pocket.'],
    ['wear_back_cape', 81, 'back', 'Cape', 200, 3, null, 'A cape that swishes when you run.'],
    ['wear_back_wings', 82, 'back', 'Butterfly wings', 260, 3, null, 'Bright butterfly wings on soft straps.'],
    ['wear_back_guitar', 83, 'back', 'Guitar', 280, 2, null, 'A guitar on a strap, ready for the encore.'],
    ['wear_back_skate', 84, 'back', 'Skateboard', 220, 3, null, 'A skateboard carried on your back.'],
    ['wear_back_jetpack', 85, 'back', 'Cardboard jetpack', 300, 2, null, 'Two bottles and ribbon streamers. Pure imagination.'],
    ['wear_hand_mic', 90, 'hand', 'Microphone', 160, 2, null, 'A microphone for big moments.'],
    ['wear_hand_balloon', 91, 'hand', 'Balloon', 90, 4, null, 'A balloon on a string. It follows you everywhere.'],
    ['wear_hand_icecream', 92, 'hand', 'Ice-cream cone', 70, 3, null, 'Two scoops that never melt.'],
    ['wear_hand_lantern', 93, 'hand', 'Lantern', 120, 2, null, 'A lantern that glows steadily after dark.'],
    ['wear_hand_poms', 94, 'hand', 'Pom-poms', 100, 3, null, 'One pom-pom for each hand. Cheer on the crew.'],
    ['wear_hand_umbrella', 95, 'hand', 'Umbrella', 110, 3, null, 'A big umbrella for rainy days.'],
    ['wear_hand_kite', 96, 'hand', 'Kite', 130, 3, null, 'A diamond kite on a long string.']
  ];
  /* never worn: owning a dye unlocks its hair colour code for every character */
  var DYE_ROWS = [
    ['wear_dye_pink', 100, 'dye', 'Pink hair dye', 100, 1, null, 'Pink hair for any hairstyle, on every character you own.', 20],
    ['wear_dye_lilac', 101, 'dye', 'Lilac hair dye', 100, 1, null, 'Lilac hair for any hairstyle, on every character you own.', 21],
    ['wear_dye_sky', 102, 'dye', 'Sky-blue hair dye', 100, 1, null, 'Sky-blue hair for any hairstyle, on every character you own.', 22],
    ['wear_dye_mint', 103, 'dye', 'Mint hair dye', 100, 1, null, 'Mint hair for any hairstyle, on every character you own.', 23],
    ['wear_dye_silver', 104, 'dye', 'Silver hair dye', 120, 1, null, 'Silver hair for any hairstyle, on every character you own.', 24],
    ['wear_dye_sunset', 105, 'dye', 'Sunset tips', 150, 1, null, 'Orange hair with pink tips, on every character you own.', 25]
  ];
  /* each land's Dress-up shelf: 4 pieces that need the land */
  var LAND_ROWS = [
    ['wear_pier_rashvest', 110, 'top', 'Rash vest', 130, 3, null, 'A quick-dry top for the surf.', 'pier'],
    ['wear_pier_boardies', 111, 'bottom', 'Board shorts', 100, 3, null, 'Long board shorts in bold colours.', 'pier'],
    ['wear_pier_sunhat', 112, 'head', 'Floppy sun hat', 100, 3, null, 'A wide, floppy hat for long pier days.', 'pier'],
    ['wear_pier_surfboard', 113, 'back', 'Surfboard', 260, 3, null, 'A surfboard carried on your back.', 'pier'],
    ['wear_jungle_shirt', 120, 'top', 'Explorer shirt', 150, 2, null, 'A shirt with roll-up sleeves and map pockets.', 'jungle'],
    ['wear_jungle_hat', 121, 'head', 'Explorer hat', 130, 2, null, 'A wide-brimmed hat for the jungle trail.', 'jungle'],
    ['wear_jungle_boots', 122, 'shoes', 'Jungle boots', 120, 2, null, 'Boots for river crossings and muddy paths.', 'jungle'],
    ['wear_jungle_parrot', 123, 'back', 'Toy parrot', 220, 3, null, 'A plush parrot that rides on your shoulder. It stays put.', 'jungle'],
    ['wear_treetop_hoodie', 130, 'top', 'Leaf hoodie', 150, 2, null, 'A green hoodie with leaf patches.', 'treetop'],
    ['wear_treetop_harness', 131, 'neck', 'Climbing harness', 110, 2, null, 'A harness for the high ropes.', 'treetop'],
    ['wear_treetop_acorn', 132, 'head', 'Acorn hat', 90, 2, null, 'A hat shaped like an acorn cup.', 'treetop'],
    ['wear_treetop_leafcape', 133, 'back', 'Leaf cape', 240, 2, null, 'A cape of layered leaves.', 'treetop'],
    ['wear_castle_tabard', 140, 'top', 'Sun tabard', 170, 3, null, 'A herald’s tabard with a bright sun on the front.', 'castle'],
    ['wear_castle_featherhat', 141, 'head', 'Feathered cap', 140, 3, null, 'A soft cap with a tall feather.', 'castle'],
    ['wear_castle_cloak', 142, 'back', 'Royal cloak', 260, 2, null, 'A long cloak with a trimmed edge.', 'castle'],
    ['wear_castle_banner', 143, 'hand', 'Banner pole', 180, 3, null, 'A pennant on a pole for announcing guests.', 'castle'],
    ['wear_ice_jumper', 150, 'top', 'Snowflake jumper', 140, 3, null, 'A knitted jumper with a snowflake on the front.', 'ice'],
    ['wear_ice_earmuffs', 151, 'head', 'Earmuffs', 90, 3, null, 'Fluffy earmuffs for the ice village.', 'ice'],
    ['wear_ice_skates', 152, 'shoes', 'Ice skates', 200, 2, null, 'Skates with shiny blades for the rink.', 'ice'],
    ['wear_ice_penguin', 153, 'outfit', 'Penguin onesie', 420, 1, ['hoodUp'], 'A penguin hood with a yellow beak peak. Waddling optional.', 'ice']
  ];
  /* signature pieces: they come with their character (never sold on their own) and then join
     the wardrobe of every character the child owns; the move stays with its character */
  var SIG_ROWS = [
    ['wear_sig_tracksuit', 160, 'outfit', 'Dance tracksuit', 'char_theo', null, 'Theo’s tracksuit, made for floor moves.'],
    ['wear_sig_apron', 161, 'top', 'Workshop apron', 'char_priya', null, 'Priya’s apron, with a pocket for every tool.'],
    ['wear_sig_gadgetpack', 162, 'back', 'Gadget backpack', 'char_priya', null, 'Priya’s backpack, antenna and all.'],
    ['wear_sig_robe', 163, 'outfit', 'Starry robe', 'char_jude', ['coversShoes'], 'Jude’s long robe, covered in stars.'],
    ['wear_sig_starhat', 164, 'head', 'Stargazer hat', 'char_jude', null, 'Jude’s tall hat with a ✦ on the tip.'],
    ['wear_sig_aviator', 165, 'top', 'Aviator jacket', 'char_wren', null, 'Wren’s flying jacket with a warm collar.'],
    ['wear_sig_flyingcap', 166, 'head', 'Flying cap and goggles', 'char_wren', null, 'Wren’s cap, with the goggles pushed up out of the way.'],
    ['wear_sig_headset', 167, 'head', 'Stage headset', 'char_ines', null, 'Ines’s headset mic, for singing and dancing at once.'],
    ['wear_sig_kit', 168, 'outfit', 'Football kit', 'char_omar', ['coversShoes'], 'Omar’s kit with a ✦ crest.'],
    ['wear_sig_ball', 169, 'hand', 'Football', 'char_omar', null, 'Omar’s football. It goes everywhere.'],
    ['wear_sig_overalls', 170, 'outfit', 'Racing overalls', 'char_lena', ['coversShoes'], 'Lena’s racing overalls, built for the track.'],
    ['wear_sig_helmet', 171, 'head', 'Racing helmet', 'char_lena', null, 'Lena’s open-face helmet with a flip-up visor.'],
    ['wear_sig_whistle', 172, 'neck', 'Lifeguard whistle', 'char_malu', null, 'Malu’s whistle on a bright lanyard.'],
    ['wear_sig_map', 173, 'hand', 'Island map', 'char_amara', null, 'Amara’s map, with every shortcut marked.'],
    ['wear_sig_binocs', 174, 'neck', 'Ranger binoculars', 'char_rowan', null, 'Rowan’s binoculars on a strap.'],
    ['wear_sig_rinkjacket', 175, 'top', 'Rink jacket', 'char_noor', null, 'Noor’s jacket for the ice rink.']
  ];

  /* ---------------- the cast: 'Me' and 12 original characters ----------------
     Names are ordinary given names; bios never state a gender; every outfit is for everyone.
     Prices 450 / 650 / 850 (the land characters need their land). A move is ≤ its maxHz,
     with a still end pose under reduced motion (models-characters.js AV_INFO). */
  var CAST_ROWS = [
    ['char_theo', 1, 'Theo', 'Street dancer', null, 450, [7, 0, 0, 7, 0, 0, 0, 0, 0, 1, 2, 0, 0, 1, 1],
      { outfit: 'wear_sig_tracksuit', shoes: 'wear_shoe_hightops', head: 'wear_head_bucket' },
      ['wear_sig_tracksuit', 'wear_shoe_hightops', 'wear_head_bucket'],
      ['sigFreeze', 'Floor freeze', 2.2, 1], 'Hears a beat, starts dancing. Has invented eleven moves and named all of them.'],
    ['char_priya', 2, 'Priya', 'Inventor', null, 450, [5, 2, 1, 17, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0],
      { top: 'wear_sig_apron', bottom: 'wear_bot_leggings', shoes: 'wear_shoe_hightops', back: 'wear_sig_gadgetpack' },
      ['wear_sig_apron', 'wear_sig_gadgetpack', 'wear_bot_leggings', 'wear_shoe_hightops'],
      ['sigEureka', 'Big idea', 1.6, 1.25], 'Builds gadgets out of whatever is lying around. Most of them work.'],
    ['char_jude', 3, 'Jude', 'Stargazer', null, 450, [2, 0, 4, 6, 6, 0, 0, 2, 0, 0, 0, 1, 0, 2, 0],
      { outfit: 'wear_sig_robe', head: 'wear_sig_starhat', hand: 'wear_hand_lantern' },
      ['wear_sig_robe', 'wear_sig_starhat', 'wear_hand_lantern'],
      ['sigStarpoint', 'Star point', 1.8, 1], 'Knows every star over the islands by name and will happily tell you.'],
    ['char_wren', 4, 'Wren', 'Sky pilot', null, 650, [4, 1, 2, 12, 3, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      { top: 'wear_sig_aviator', bottom: 'wear_bot_cargo', shoes: 'wear_shoe_boots', head: 'wear_sig_flyingcap' },
      ['wear_sig_aviator', 'wear_sig_flyingcap', 'wear_bot_cargo', 'wear_shoe_boots'],
      ['sigSwoop', 'Wing swoop', 2.4, 0.8], 'Flies the sky routes between the islands. Never late, always waving.'],
    ['char_ines', 5, 'Ines', 'Stage star', null, 650, [1, 0, 0, 15, 21, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      { top: 'wear_top_stage', bottom: 'wear_bot_layer', shoes: 'wear_shoe_glow', head: 'wear_sig_headset', hand: 'wear_free_spark' },
      ['wear_top_stage', 'wear_bot_layer', 'wear_shoe_glow', 'wear_sig_headset', 'wear_dye_lilac'],
      ['sigEncore', 'Encore', 2, 1], 'Sings, dances and remembers the name of everyone in the crowd.'],
    ['char_omar', 6, 'Omar', 'Football ace', null, 650, [8, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
      { outfit: 'wear_sig_kit', hand: 'wear_sig_ball' },
      ['wear_sig_kit', 'wear_sig_ball'],
      ['sigKnee', 'Knee slide', 1.6, 1.5], 'Practises penalties every morning. Celebrates every goal like it’s the final.'],
    ['char_lena', 7, 'Lena', 'Kart racer', null, 650, [0, 2, 5, 13, 8, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      { outfit: 'wear_sig_overalls', head: 'wear_sig_helmet' },
      ['wear_sig_overalls', 'wear_sig_helmet'],
      ['sigVisor', 'Visor up', 1.8, 1.2], 'Fastest lap on Neon Grand Prix and the first to help you up after a spin.'],
    ['char_malu', 8, 'Malu', 'Pier lifeguard', 'pier', 850, [6, 0, 1, 14, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
      { top: 'wear_pier_rashvest', bottom: 'wear_pier_boardies', shoes: 'wear_shoe_slides', neck: 'wear_sig_whistle', back: 'wear_pier_surfboard' },
      ['wear_pier_rashvest', 'wear_pier_boardies', 'wear_pier_surfboard', 'wear_sig_whistle', 'wear_shoe_slides'],
      ['sigSurf', 'Surf stance', 2.4, 0.7], 'Keeps an eye on the pier from the lifeguard chair. Surfs at sunset.'],
    ['char_amara', 9, 'Amara', 'Jungle explorer', 'jungle', 850, [9, 1, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      { top: 'wear_jungle_shirt', bottom: 'wear_free_shorts', shoes: 'wear_jungle_boots', head: 'wear_jungle_hat', hand: 'wear_sig_map' },
      ['wear_jungle_shirt', 'wear_jungle_boots', 'wear_jungle_hat', 'wear_sig_map'],
      ['sigSpy', 'Spyglass', 2.2, 0.5], 'Maps every path in the jungle and shares the shortcuts.'],
    ['char_rowan', 10, 'Rowan', 'Treetop ranger', 'treetop', 850, [3, 0, 3, 3, 5, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      { top: 'wear_treetop_hoodie', bottom: 'wear_bot_cargo', shoes: 'wear_shoe_boots', neck: 'wear_sig_binocs', back: 'wear_treetop_leafcape' },
      ['wear_treetop_hoodie', 'wear_treetop_leafcape', 'wear_sig_binocs', 'wear_bot_cargo', 'wear_shoe_boots'],
      ['sigTree', 'Tree pose', 2.2, 0.5], 'Looks after the treetop park and can name any bird by its song.'],
    /* Elsie also comes with her lace-up boots: every sold piece of a character's own outfit is
       in its includes, so a bought character is always fully dressed (characters.json left
       the boots out) */
    ['char_elsie', 11, 'Elsie', 'Castle herald', 'castle', 850, [1, 3, 4, 19, 7, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0],
      { top: 'wear_castle_tabard', bottom: 'wear_bot_leggings', shoes: 'wear_shoe_boots', head: 'wear_castle_featherhat', hand: 'wear_castle_banner' },
      ['wear_castle_tabard', 'wear_castle_featherhat', 'wear_castle_banner', 'wear_bot_leggings', 'wear_shoe_boots'],
      ['sigBow', 'Royal bow', 2, 1], 'Announces every visitor to the castle with a bow and a bit of a fanfare.'],
    ['char_noor', 12, 'Noor', 'Ice skater', 'ice', 850, [5, 2, 1, 13, 1, 2, 4, 0, 0, 0, 0, 0, 1, 1, 0],
      { top: 'wear_sig_rinkjacket', bottom: 'wear_bot_leggings', shoes: 'wear_ice_skates', head: 'wear_ice_earmuffs' },
      ['wear_sig_rinkjacket', 'wear_ice_skates', 'wear_ice_earmuffs', 'wear_bot_leggings'],
      ['sigSpin', 'Rink spin', 1.8, 0.83], 'Lands a spin on the ice rink every single time. Teaches anyone who asks.']
  ];
  /* look rows above are in FIELD_KEYS order: sk ey ec hs hc cv cc gl gc ha hac fr bl bd ht */
  function lookFromRow(r) { var o = {}; FIELD_KEYS.forEach(function (k, i) { o[k] = r[i]; }); return o; }
  var ME = {
    id: 'char_me', n: 0, name: 'Me', theme: null, land: null, price: 0, look: validateLook({}),
    wear: { top: 'wear_free_hoodie', bottom: 'wear_free_jeans', shoes: 'wear_free_sneakers', hand: 'wear_free_spark' },
    includes: [], move: null, bio: 'You, made by you. Change anything, any time.'
  };
  var MOVES = {};
  var CAST = [ME].concat(CAST_ROWS.map(function (r) {
    var mv = { id: r[9][0], name: r[9][1], sec: r[9][2], maxHz: r[9][3], char: r[0] };
    MOVES[mv.id] = mv;
    return { id: r[0], n: r[1], name: r[2], theme: r[3], land: r[4], price: r[5], look: lookFromRow(r[6]), wear: r[7], includes: r[8], move: mv, bio: r[10] };
  }));
  var CAST_BY = {};
  CAST.forEach(function (c) { CAST_BY[c.id] = c; });

  /* ---------------- the catalogue entries registered with C.defineItems ----------------
     {id, kind 'char' | 'wear', n, name, price, cat 'wardrobe', fixedTx (the 'ku_<id>_<n>' tx),
      slot, cw, flags, member, hc (dyes), with (signature pieces), shelfIsle + requires (the land
      characters and land pieces; never 'isle', which means v3 in the core), includes
      (characters), included (never sold on its own), free (always had, never owned), desc} */
  var ITEMS = [], WEAR = [], BY = {}, BY_N = {};
  function wearEntry(r, extra) {
    var e = { id: r[0], kind: 'wear', n: r[1], slot: r[2], name: r[3], price: r[4], cat: 'wardrobe', fixedTx: true, cw: r[5] };
    if (r[6]) e.flags = r[6].slice();
    Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
    e.desc = r[7];
    return e;
  }
  FREE_ROWS.forEach(function (r) {
    var x = { included: true, free: true };
    if (r[0] === 'wear_free_hoodie' || r[0] === 'wear_free_spark') x.member = true;
    WEAR.push(wearEntry(r, x));
  });
  GENERAL_ROWS.forEach(function (r) { WEAR.push(wearEntry(r)); });
  DYE_ROWS.forEach(function (r) { WEAR.push(wearEntry(r, { hc: r[8] })); });
  LAND_ROWS.forEach(function (r) { WEAR.push(wearEntry(r, { shelfIsle: r[8], requires: ['land_' + r[8]] })); });
  SIG_ROWS.forEach(function (r) { WEAR.push(wearEntry([r[0], r[1], r[2], r[3], 0, 1, r[5], r[6]], { included: true, with: r[4] })); });
  CAST.forEach(function (c) {
    var e = { id: c.id, kind: 'char', n: c.n, name: c.name, price: c.price, cat: 'wardrobe', fixedTx: true };
    if (c.theme) e.theme = c.theme;
    if (c.land) { e.shelfIsle = c.land; e.requires = ['land_' + c.land]; }
    if (c.includes.length) e.includes = c.includes.slice();
    if (c.move) e.move = c.move.id;
    if (c.id === 'char_me') { e.included = true; e.free = true; }
    e.desc = c.bio;
    ITEMS.push(e);
  });
  ITEMS = ITEMS.concat(WEAR);
  ITEMS.forEach(function (e) { BY[e.id] = e; if (e.kind === 'wear') BY_N[e.n] = e; });
  [FIELDS, FIELD_KEYS, DEFAULT_LOOK, HAIR, COVERINGS, GLASSES, AIDS, PALETTES, TOKENS, SLOTS, SLOT_CAPS, MOVES, CAST, ITEMS, WEAR, KINDS, ME].forEach(deepFreeze);

  function item(id) { return typeof id === 'string' && own(BY, id) ? BY[id] : null; }
  function wearItem(id) { var it = item(id); return it && it.kind === 'wear' ? it : null; }
  function castOf(id) { return typeof id === 'string' && own(CAST_BY, id) ? CAST_BY[id] : null; }
  function ownedN(w, id) { var n = w && plain(w.owned) ? w.owned[id] : 0; return isInt(n) && n > 0 ? n : 0; }
  /* owned, or free (char_me and the six free basics) */
  function has(w, id) { var it = item(id); return !!it && (it.free === true || ownedN(w, id) > 0); }

  /* ---------------- look codes: on-device cache keys only (never sent anywhere) ----------------
     'L1' + 16 base-36 characters: sk ey ec hs(2) hc(2) cv cc gl gc ha hac (fr + 2·bl) bd ht.
     'W1' + 9 slots × (the wear item's n in 2 base-36 characters + 1 colourway character).
     A code holds only catalogue numbers: no name, no text, no photo pixel. */
  /* the code's fields in order with their widths; 'fr' carries fr + 2·bl */
  var CODE_FIELDS = [['sk', 1], ['ey', 1], ['ec', 1], ['hs', 2], ['hc', 2], ['cv', 1], ['cc', 1], ['gl', 1], ['gc', 1],
                     ['ha', 1], ['hac', 1], ['fr', 1], ['bd', 1], ['ht', 1]];
  function b36(n, width) { var s = n.toString(36); return width === 2 && s.length < 2 ? '0' + s : s; }
  function lookCode(look) {
    var v = validateLook(look), s = 'L1';
    for (var i = 0; i < CODE_FIELDS.length; i++) {
      var k = CODE_FIELDS[i][0];
      s += k === 'fr' ? b36(v.fr + 2 * v.bl, 1) : b36(v[k], CODE_FIELDS[i][1]);
    }
    return s;
  }
  var LOOK_RE = /^L1[0-9a-z]{16}$/;
  function parseLookCode(s) {
    if (typeof s !== 'string' || !LOOK_RE.test(s)) return null;
    var out = {}, at = 2;
    for (var i = 0; i < CODE_FIELDS.length; i++) {
      var k = CODE_FIELDS[i][0], w = CODE_FIELDS[i][1], v = parseInt(s.substr(at, w), 36);
      at += w;
      if (k === 'fr') {
        var ok = v >= 0 && v <= 3;
        out.fr = ok ? v & 1 : FIELD.fr.def; out.bl = ok ? v >> 1 : FIELD.bl.def;
      } else out[k] = validValue(k, v) ? v : FIELD[k].def;
    }
    return validateLook(out);
  }
  function wearCode(wear, vr) {
    var s = 'W1', wr = plain(wear) ? wear : {}, cv = plain(vr) ? vr : {};
    SLOTS.forEach(function (slot) {
      var it = wearItem(wr[slot]);
      if (!it || it.slot !== slot || it.n > 1295) { s += '000'; return; }
      var c = cv[it.id];
      s += b36(it.n, 2) + b36(isInt(c) && c >= 0 && c < it.cw && c < 36 ? c : 0, 1);
    });
    return s;
  }
  var WEAR_RE = /^W1[0-9a-z]{27}$/;
  function parseWearCode(s) {
    if (typeof s !== 'string' || !WEAR_RE.test(s)) return null;
    var wear = {}, vr = {};
    SLOTS.forEach(function (slot, i) {
      var n = parseInt(s.substr(2 + i * 3, 2), 36), c = parseInt(s.substr(4 + i * 3, 1), 36);
      var it = own(BY_N, n) ? BY_N[n] : null;
      if (!it || it.slot !== slot) return;
      wear[slot] = it.id;
      vr[it.id] = c < it.cw ? c : 0;
    });
    return { wear: wear, vr: vr };
  }

  /* ---------------- resolve: the draw-ready description both renderers use ----------------
     look   the draw-ready look (a fun hair colour whose dye w does not have draws natural 1)
     worn   {slot: id} every known piece in its own slot (that w has, when w is given)
     show   {slot: id} what is drawn: an outfit hides top and bottom (still chosen underneath),
            coversShoes hides shoes, hoodUp hides the head slot and the hair
     hidden {slot: the id of the piece hiding it} ('Hidden under your {item}')
     vr     {id: colourway} for every worn piece (0 when unset or out of range)
     flags  hair (a hairstyle and no hood up; what a head covering hides is the hair shapes'
            rule), glasses (identity glasses drawn: a coversEyes piece hides them while worn),
            hood, spark (the Spark Stick shows at Showtime: the hand is empty or holds it)
     colours / tokens   the identity colours with their Shade partners
     Without w the caller vouches for ownership (a cast display, or avatarInfo's own output). */
  function flagged(it, f) { return !!(it && it.flags && it.flags.indexOf(f) >= 0); }
  function resolve(look, wear, vr, w) {
    var lk = validateLook(look), src = plain(wear) ? wear : {}, cv = plain(vr) ? vr : {};
    if (w && funHair(lk.hc) && !has(w, dyeOf(lk.hc))) lk.hc = FIELD.hc.def;
    var worn = {}, show = {}, hidden = {}, outV = {};
    SLOTS.forEach(function (slot) {
      var it = wearItem(src[slot]);
      if (!it || it.slot !== slot || (w && !has(w, it.id))) return;
      worn[slot] = it.id;
      var c = cv[it.id];
      outV[it.id] = isInt(c) && c >= 0 && c < it.cw ? c : 0;
    });
    var fit = worn.outfit ? item(worn.outfit) : null, hood = flagged(fit, 'hoodUp');
    SLOTS.forEach(function (slot) {
      if (!worn[slot]) return;
      var by = null;
      if (fit && (slot === 'top' || slot === 'bottom')) by = fit.id;
      else if (fit && slot === 'shoes' && flagged(fit, 'coversShoes')) by = fit.id;
      else if (hood && slot === 'head') by = fit.id;
      if (by) hidden[slot] = by; else show[slot] = worn[slot];
    });
    var eyesCovered = flagged(item(show.face), 'coversEyes');
    var skin = PALETTES.skin[lk.sk], fun = funHair(lk.hc);
    var hair = fun ? [fun[1], fun[2]] : PALETTES.hairNatural[lk.hc];
    var colours = {
      skin: tone(skin), mouth: tone(mouthFor(lk.sk)), iris: tone(PALETTES.eyes.iris[lk.ec]), eyeWhite: tone(PALETTES.eyes.white),
      glint: PALETTES.eyes.glint, sclera: needsSclera(lk.sk, lk.ec),
      hair: tone(hair), tip: PALETTES.hairTip[lk.hc] ? tone(PALETTES.hairTip[lk.hc]) : null,
      glasses: tone(PALETTES.glasses[lk.gc]), covering: tone(PALETTES.covering[lk.cc]), aid: tone(PALETTES.aid[lk.hac])
    };
    var tokens = {};
    ['skin', 'mouth', 'iris', 'eyeWhite', 'hair', 'tip', 'glasses', 'covering', 'aid'].forEach(function (k) {
      var t = colours[k];
      if (!t) return;
      if ((k === 'glasses' && !lk.gl) || (k === 'covering' && !lk.cv) || (k === 'aid' && !lk.ha) || (k === 'eyeWhite' && !colours.sclera)) return;
      tokens[t.token] = t.hex; tokens[t.shade] = t.shadeHex;
    });
    return {
      look: lk, worn: worn, show: show, hidden: hidden, vr: outV,
      flags: { hair: !hood && lk.hs !== 0, glasses: lk.gl > 0 && !eyesCovered, hood: hood, spark: !show.hand || show.hand === 'wear_free_spark' },
      colours: colours, tokens: tokens
    };
  }

  /* ---------------- w.chars ---------------- */
  function charsOf(w) { return w && plain(w.chars) ? w.chars : null; }
  function recOf(w, id) {
    var ch = charsOf(w), list = ch && Array.isArray(ch.list) ? ch.list : [];
    for (var i = 0; i < list.length; i++) if (plain(list[i]) && list[i].id === id) return list[i];
    return null;
  }
  /* a record this client draws: a known character the child has (char_me is free) */
  function shown(w, rec) { return !!(plain(rec) && castOf(rec.id) && has(w, rec.id)); }
  /* the effective active character (N14 f): the chosen one when it is shown, else char_me, else
     the first shown record, else null (the classic avatar) */
  function activeOf(w) {
    var ch = charsOf(w);
    if (!ch) return null;
    var list = Array.isArray(ch.list) ? ch.list : [];
    if (typeof ch.active === 'string' && shown(w, recOf(w, ch.active))) return ch.active;
    if (shown(w, recOf(w, 'char_me'))) return 'char_me';
    for (var i = 0; i < list.length; i++) if (shown(w, list[i])) return list[i].id;
    return null;
  }
  function newRecord(id) {
    var c = castOf(id);
    return { id: id, look: validateLook(c.look), wear: clone(c.wear), vr: {} };
  }
  function markV3(w) {
    var C = core(), v = C && isInt(C.VERSION) ? C.VERSION : 3;
    if (isInt(w.v) && w.v >= v) return false;
    w.v = v; return true;
  }
  function touch(w, ms) { w.rev = (w.rev || 0) + 1; w.updatedAt = nowIso(ms); }
  function charsEntry(w, atIso) {
    if (!plain(w.chars)) w.chars = { v: 1, active: null, list: [], at: atIso };
    var ch = w.chars;
    if (!isInt(ch.v) || ch.v < 1) ch.v = 1;
    if (!Array.isArray(ch.list)) ch.list = [];
    if (ch.active === undefined) ch.active = null;
    if (typeof ch.at !== 'string') ch.at = atIso;
    return ch;
  }
  function worldOf(u) {
    var C = core();
    if (C && typeof C.ensureWorld === 'function') return C.ensureWorld(u);
    if (!plain(u.world)) u.world = {};
    return u.world;
  }
  function fail(code, reason) { return { ok: false, code: code, reason: reason }; }
  /* a writer's checks: id is a character the child has, with a record (char_me needs one). A
     refusal writes nothing. */
  function check(w, id) {
    if (!castOf(id) || !has(w, id)) return fail('no_character', 'You don’t have that character.');
    if (id === 'char_me' && !recOf(w, id)) return fail('no_record', 'Make your character first.');
    return null;
  }
  /* … then the write: the chars block and the record (an owned character without one gets it) */
  function open(w, id, ms) {
    var ch = charsEntry(w, nowIso(ms)), rec = recOf(w, id);
    if (!rec) { rec = newRecord(id); ch.list.push(rec); }
    return { w: w, ch: ch, rec: rec };
  }
  function done(o, ms, res) {
    o.ch.at = nowIso(ms);
    markV3(o.w); touch(o.w, ms);
    return res;
  }
  /* look values from a writer: known keys only (never a photo field), each a value this client
     knows; a fun hair colour needs its dye */
  function lookPatch(w, look) {
    if (!plain(look)) return { err: fail('bad_value', 'That look didn’t work. Please try again.') };
    var out = {};
    for (var i = 0; i < FIELD_KEYS.length; i++) {
      var k = FIELD_KEYS[i];
      if (!own(look, k)) continue;
      if (!validValue(k, look[k])) return { err: fail('bad_value', 'That look didn’t work. Please try again.') };
      if (k === 'hc' && funHair(look.hc) && !has(w, dyeOf(look.hc))) {
        var r = fail('locked', 'That hair colour needs its dye first.'); r.needs = dyeOf(look.hc);
        return { err: r };
      }
      out[k] = look[k];
    }
    return { look: out };
  }
  function cleanStoredLook(rec) {
    var base = plain(rec.look) ? rec.look : {}, out = {};
    FIELD_KEYS.forEach(function (k) { if (own(base, k) && isInt(base[k]) && base[k] >= 0 && base[k] <= 255) out[k] = base[k]; });
    return out;
  }

  /* create or update char_me (the creator's 'That’s me') and make it active. wear, when given,
     is {slot: id | null} (null takes the slot off); a new 'Me' starts in the free basics. */
  function setup(u, look, wear, ms) {
    var w = worldOf(u), p = lookPatch(w, look == null ? {} : look);
    if (p.err) return p.err;
    var pieces = {};
    if (wear != null) {
      if (!plain(wear)) return fail('bad_value', 'That outfit didn’t work. Please try again.');
      for (var i = 0; i < SLOTS.length; i++) {
        var slot = SLOTS[i];
        if (!own(wear, slot)) continue;
        var id = wear[slot], it = wearItem(id);
        if (id !== null && (!it || it.slot !== slot)) return fail('bad_value', 'That outfit didn’t work. Please try again.');
        if (id !== null && !has(w, id)) return fail('not_owned', 'You don’t have that one yet.');
        pieces[slot] = id;
      }
    }
    var ch = charsEntry(w, nowIso(ms)), rec = recOf(w, 'char_me'), created = !rec;
    if (created) { rec = newRecord('char_me'); ch.list.unshift(rec); }
    var lk = cleanStoredLook(rec);
    Object.keys(p.look).forEach(function (k) { lk[k] = p.look[k]; });
    rec.look = lk;
    if (!plain(rec.wear)) rec.wear = {};
    if (!plain(rec.vr)) rec.vr = {};
    Object.keys(pieces).forEach(function (slot) { if (pieces[slot] === null) delete rec.wear[slot]; else rec.wear[slot] = pieces[slot]; });
    ch.active = 'char_me';
    return done({ w: w, ch: ch }, ms, { ok: true, id: 'char_me', created: created });
  }
  /* change some look fields of a shown character */
  function setLook(u, id, look, ms) {
    var w = worldOf(u), bad = check(w, id), p = bad ? null : lookPatch(w, look);
    if (bad || p.err) return bad || p.err;
    var o = open(w, id, ms), lk = cleanStoredLook(o.rec);
    Object.keys(p.look).forEach(function (k) { lk[k] = p.look[k]; });
    o.rec.look = lk;
    return done(o, ms, { ok: true, look: validateLook(lk) });
  }
  /* 'Make it look like me': the child's own identity (every look field of char_me) on another character */
  function likeMe(u, id, ms) {
    if (id === 'char_me') return fail('same', 'That’s already you.');
    var w = worldOf(u), me = recOf(w, 'char_me');
    if (!shown(w, me)) return fail('no_record', 'Make your character first.');
    var bad = check(w, id);
    if (bad) return bad;
    var o = open(w, id, ms), lk = validateLook(me.look);
    if (funHair(lk.hc) && !has(w, dyeOf(lk.hc))) lk.hc = FIELD.hc.def;
    o.rec.look = lk;
    return done(o, ms, { ok: true, look: validateLook(lk) });
  }
  /* tap to put a piece on (it replaces the slot's piece), tap again to take it off */
  function wearPiece(u, id, wearId, ms) {
    var it = wearItem(wearId);
    if (!it) return fail('unknown_item', 'That isn’t in the wardrobe.');
    if (it.slot === 'dye') return fail('dye', 'Hair colours are picked in the creator.');
    var w = worldOf(u), bad = check(w, id);
    if (bad) return bad;
    if (!has(w, wearId)) return fail('not_owned', 'You don’t have that one yet.');
    var o = open(w, id, ms);
    if (!plain(o.rec.wear)) o.rec.wear = {};
    var on = o.rec.wear[it.slot] !== wearId;
    if (on) o.rec.wear[it.slot] = wearId; else delete o.rec.wear[it.slot];
    return done(o, ms, { ok: true, on: on, slot: it.slot });
  }
  /* the worn colourway of a piece on one character (free; per character) */
  function setColourway(u, id, wearId, n, ms) {
    var it = wearItem(wearId);
    if (!it || it.slot === 'dye') return fail('unknown_item', 'That isn’t in the wardrobe.');
    if (!isInt(n) || n < 0 || n >= it.cw) return fail('bad_value', 'That colour isn’t there.');
    var w = worldOf(u), bad = check(w, id);
    if (bad) return bad;
    if (!has(w, wearId)) return fail('not_owned', 'You don’t have that one yet.');
    var o = open(w, id, ms);
    if (!plain(o.rec.vr)) o.rec.vr = {};
    o.rec.vr[wearId] = n;
    return done(o, ms, { ok: true, n: n });
  }
  /* exactly one character plays everywhere */
  function setActive(u, id, ms) {
    var w = worldOf(u), bad = check(w, id);
    if (bad) return bad;
    var o = open(w, id, ms);
    o.ch.active = id;
    return done(o, ms, { ok: true, id: id });
  }

  /* ---------------- what the island, the 2D island and the games read ---------------- */
  function drawnWear(w, rec) {
    var src = plain(rec.wear) ? rec.wear : {}, wear = {}, vr = {}, cv = plain(rec.vr) ? rec.vr : {};
    SLOTS.forEach(function (slot) {
      var it = wearItem(src[slot]);
      if (!it || it.slot !== slot || !has(w, it.id)) return;
      wear[slot] = it.id;
      var c = cv[it.id];
      vr[it.id] = isInt(c) && c >= 0 && c < it.cw ? c : 0;
    });
    return { wear: wear, vr: vr };
  }
  function drawnLook(w, rec) {
    var lk = validateLook(rec.look);
    if (funHair(lk.hc) && !has(w, dyeOf(lk.hc))) lk.hc = FIELD.hc.def;
    return lk;
  }
  function describe(w, rec, u) {
    var c = castOf(rec.id), dw = drawnWear(w, rec), lk = drawnLook(w, rec);
    return {
      id: rec.id, name: rec.id === 'char_me' ? (u && typeof u.name === 'string' ? u.name : '') : c.name,
      look: lk, wear: dw.wear, vr: dw.vr, sig: c.move ? c.move.id : null, land: c.land,
      lk: lookCode(lk), wr: wearCode(dw.wear, dw.vr)
    };
  }
  /* the player figure everywhere: null → the classic emoji-hoodie avatar */
  function avatarInfo(w, u) {
    if (!plain(w)) return null;
    var id = activeOf(w);
    if (!id) return null;
    var d = describe(w, recOf(w, id), u);
    return { id: d.id, name: d.name, look: d.look, wear: d.wear, vr: d.vr, sig: d.sig, lk: d.lk, wr: d.wr };
  }
  /* the shown characters in record order, char_me first */
  function charList(w, u) {
    var ch = charsOf(w);
    if (!ch || !Array.isArray(ch.list)) return [];
    var active = activeOf(w), seen = {}, out = [];
    var add = function (rec) {
      if (!shown(w, rec) || own(seen, rec.id)) return;
      seen[rec.id] = 1;
      var d = describe(w, rec, u);
      out.push({ id: d.id, name: d.name, look: d.look, wear: d.wear, vr: d.vr, active: d.id === active, sig: d.sig, land: d.land });
    };
    add(recOf(w, 'char_me'));
    ch.list.forEach(add);
    return out;
  }
  /* a character's display (photocards, the cast carousel): its default look and own wear */
  function display(id) {
    var c = castOf(id);
    return c ? { id: id, look: validateLook(c.look), wear: clone(c.wear), vr: {} } : null;
  }

  /* ---------------- the world-core hooks ---------------- */
  /* a character bought through purchase() gets its record (its cast look and own wear); the
     first character a child gets also becomes the one who plays */
  function onPurchase(w, it, entry) {
    if (!it || it.kind !== 'char' || !castOf(it.id) || !plain(w)) return;
    var at = entry && typeof entry.at === 'string' ? entry.at : nowIso();
    var before = activeOf(w), ch = charsEntry(w, at);
    if (!recOf(w, it.id)) ch.list.push(newRecord(it.id));
    if (!before) ch.active = it.id;
    ch.at = at;
    markV3(w);
  }
  function anyOwnedChar(w) {
    for (var i = 0; i < CAST.length; i++) if (CAST[i].id !== 'char_me' && ownedN(w, CAST[i].id) > 0) return true;
    return false;
  }
  function dropPhotoKeys(o) {
    var ch = false;
    PHOTO_KEYS.forEach(function (k) { if (own(o, k)) { delete o[k]; ch = true; } });
    return ch;
  }
  /* N14: settle w.chars. Zero-diff on a save without characters; idempotent; never touches
     points, spent, ledger rows or chars.at (a block it must create gets EPOCH). */
  function normalizeChars(w) {
    if (!plain(w)) return false;
    var changed = false;
    if (w.chars === undefined || w.chars === null) {
      if (!anyOwnedChar(w)) return false;              /* (a) no characters: nothing */
      w.chars = { v: 1, active: null, list: [], at: EPOCH }; changed = true;
    }
    if (!plain(w.chars)) { w.chars = { v: 1, active: null, list: [], at: EPOCH }; changed = true; }
    var ch = w.chars;
    if (!isInt(ch.v) || ch.v < 1) { ch.v = 1; changed = true; }
    if (!Array.isArray(ch.list)) { ch.list = []; changed = true; }
    if (ch.active !== null && typeof ch.active !== 'string') { ch.active = null; changed = true; }
    if (typeof ch.at !== 'string') { ch.at = EPOCH; changed = true; }
    if (dropPhotoKeys(ch)) changed = true;
    /* (b) plain records with a string id; the first record of an id wins */
    var seen = {}, list = ch.list.filter(function (r) {
      if (!plain(r) || typeof r.id !== 'string' || !r.id || own(seen, r.id)) return false;
      seen[r.id] = 1; return true;
    });
    if (list.length !== ch.list.length) { ch.list = list; changed = true; }
    /* (c) every owned character has a record */
    CAST.forEach(function (c) {
      if (c.id !== 'char_me' && ownedN(w, c.id) > 0 && !own(seen, c.id)) { ch.list.push(newRecord(c.id)); seen[c.id] = 1; changed = true; }
    });
    ch.list.forEach(function (rec) {
      var c = castOf(rec.id);
      if (!c) return;                                   /* a future character: kept, never shown */
      if (dropPhotoKeys(rec)) changed = true;
      /* (d) look: ints this client keeps (≤ 255 is future data); unknown keys go (KU16) */
      if (!plain(rec.look)) { rec.look = validateLook(c.look); changed = true; }
      Object.keys(rec.look).forEach(function (k) {
        var v = rec.look[k];
        if (FIELD_KEYS.indexOf(k) < 0 || !isInt(v) || v < 0 || v > 255) { delete rec.look[k]; changed = true; }
      });
      /* (e) wear: a known piece of its own slot that the child has; unknown ids are future data */
      if (!plain(rec.wear)) { rec.wear = {}; changed = true; }
      Object.keys(rec.wear).forEach(function (slot) {
        var id = rec.wear[slot], it = wearItem(id);
        if (typeof id !== 'string' || (it && (it.slot !== slot || !has(w, id))) || (!it && item(id))) { delete rec.wear[slot]; changed = true; }
      });
      if (!plain(rec.vr)) { rec.vr = {}; changed = true; }
      Object.keys(rec.vr).forEach(function (k) {
        var v = rec.vr[k];
        if (!isInt(v) || v < 0 || v > 255) { delete rec.vr[k]; changed = true; }
      });
    });
    /* (f) the active character */
    var a = activeOf(w);
    if (ch.active !== a) { ch.active = a; changed = true; }
    if (changed) markV3(w);
    return changed;
  }
  /* M3d: w.chars comes whole from the fork that changed it last (ties: the base fork); a record
     only the other fork has is appended with its look and wear. Ownership is the core's union;
     N14 settles the rest in the final normalize. */
  function mergeChars(nw, gw, base, baseSrc) {
    var nc = charsOf(nw), gc = charsOf(gw);
    if (!nc && !gc) return false;
    var bc = baseSrc === nw ? nc : gc, oc = baseSrc === nw ? gc : nc;
    var at = function (c) { return c && typeof c.at === 'string' ? c.at : ''; };
    var win = bc && !(oc && at(oc) > at(bc)) ? bc : oc, lose = win === bc ? oc : bc;
    var chars = clone(win);
    if (lose && Array.isArray(lose.list)) {
      if (!Array.isArray(chars.list)) chars.list = [];
      lose.list.forEach(function (r) {
        if (!plain(r) || typeof r.id !== 'string') return;
        if (!chars.list.some(function (q) { return plain(q) && q.id === r.id; })) chars.list.push(clone(r));
      });
    }
    base.chars = chars;
    return true;
  }
  var hooks = Object.freeze({ onPurchase: onPurchase, normalize: normalizeChars, merge: mergeChars, goalField: 'goalK' });

  /* the seam (KU-CH2): registered once per page; a second copy of this file is ignored */
  function register(C) {
    if (!C || typeof C.defineItems !== 'function') return null;
    try { return C.defineItems(SOURCE, ITEMS, hooks); } catch (e) { return { ok: false, added: 0, refused: [{ id: SOURCE, why: String(e && e.message || e) }] }; }
  }
  var registration = register(core());

  return {
    SOURCE: SOURCE, KINDS: KINDS, EPOCH: EPOCH,
    FIELDS: FIELDS, FIELD_KEYS: FIELD_KEYS, DEFAULT_LOOK: DEFAULT_LOOK, HAIR: HAIR, COVERINGS: COVERINGS, GLASSES: GLASSES, AIDS: AIDS,
    PALETTES: PALETTES, TOKENS: TOKENS, shadeHex: shadeHex, lstar: lstar, mouthFor: mouthFor, needsSclera: needsSclera, dyeOf: dyeOf,
    SLOTS: SLOTS, SLOT_CAPS: SLOT_CAPS, CAST: CAST, MOVES: MOVES, WEAR: WEAR, ITEMS: ITEMS,
    item: item, castOf: castOf, display: display, has: has,
    validateLook: validateLook, lookCode: lookCode, parseLookCode: parseLookCode, wearCode: wearCode, parseWearCode: parseWearCode,
    resolve: resolve, avatarInfo: avatarInfo, charList: charList, activeOf: activeOf,
    setup: setup, setLook: setLook, likeMe: likeMe, wear: wearPiece, setColourway: setColourway, setActive: setActive,
    normalizeChars: normalizeChars, mergeChars: mergeChars, hooks: hooks, register: register, registration: registration
  };
}));
