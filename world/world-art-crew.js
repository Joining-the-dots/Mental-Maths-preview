/* ================================================================
   My Island v3 — SLWorldArtCrew (W2.11): the 2D fallback art of the crew (pure data, D100).
   window.SLWorldArtCrew in the browser (slLoadWorld loads it after world-art.js), module.exports
   in Node. No DOM, no THREE and nothing is drawn here: world-art.js owns the generator
   (ART.definePix, ART.pet, the LED tower); this file only describes pixels.

   THE GRID. A mascot is a 16 × 16 pixel sprite on the V4.54 pet frame (viewBox 120 × 100): cell
   (x, y) covers frame x = 20 + 5·x, y = 14 + 5·y (GRID; world-art.js draws on the same grid), so
   row 15 ends on the foot line y = 94 and three rows of sky are left over the grid for hats. A
   sprite faces right. Frame 1 is frame 0 with only its lowest rows changed (legs, feet, a
   flipper): the head never moves, so one set of anchors serves both frames.

   MASCOTS {id: {frames: [rows, rows], pal, anchors, head}}: the ten land mascots.
     rows    16 strings of 16 characters; '.' is empty, every other character is a key of pal
     pal     {char: colour token}; every token resolves in SLIslandLook.resolve(). The shared
             letters are b body · d dark · l light · n nose ('PETCOL3.<id>.<part>', D107) ·
             k the eye (PX Ink Eye) · w white (PX Glint); a species may add a few of its own
     head    8 rows of 8 for the LED tower's pixel-pet screen, in the letters b d l k n only
   ANCHORS {species: {hat, neck, face, back}}: all 14 species, [x, y] in grid cells (whole cells
     on a mascot; the four V4.54 pets are vector art, so theirs are fractions of a cell). They
     are the points world-art.js moves a V4.54 accessory to, so they mean what its own do:
       hat   the top edge of the head, at its middle
       neck  the collar line under the chin, at its middle
       face  midway between the two eye rows; the eyes are the cells x − 2 and x + 1 (a side-on
             species shows only the front one, and the cell x − 2 is still on its head)
       back  the shoulder behind the head
   OVERLAYS {acc id: {slot, rows, pal, at, over?}}: the 20 land accessories, one small sprite
     each, the same on all 14 species. Overlay cell `at` sits on the wearer's anchor of that slot
     (its top-left cell is anchor − at) and an overlay cell is a grid cell. A hat's `at` row is
     the one that hugs the head; face pieces that leave the eyes showing have holes in the
     columns at[0] − 2 and at[0] + 1. Back pieces draw behind the body, or over it with
     over: true (things that hang on the near side). Palettes use the item's own LOOK colours.

   register(ART) hands every id to world-art.js through ART.definePix(id, spec):
     a mascot      {frames, pal, anchors, head}
     a V4.54 pet   {anchors}                    (its art stays the V4.54 vector pet)
     an accessory  {rows, pal, slot, at} and over: true where set
   It runs by itself in the browser when SLWorldArt.definePix is there; until then ART.pet shows
   its own stand-in. Nothing here reads, awards or spends points. No words, no <text>, no
   5-point star.
   ================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLWorldArtCrew = api;
  var art = root && root.SLWorldArt;
  if (art && typeof art.definePix === 'function') api.register(art);
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;
  var GRID = { size: 16, unit: 5, x: 20, y: 14 };
  var SLOTS = ['hat', 'neck', 'face', 'back'];
  var HEAD_KEYS = 'bdlkn';

  /* the shared letters of a mascot's palette, then its own extras */
  function petPal(id, extra) {
    var p = { b: 'PETCOL3.' + id + '.body', d: 'PETCOL3.' + id + '.dark', l: 'PETCOL3.' + id + '.light', n: 'PETCOL3.' + id + '.nose',
      k: 'PX Ink Eye', w: 'PX Glint' };
    Object.keys(extra).forEach(function (c) { p[c] = extra[c]; });
    return p;
  }
  var BLANK = '................';
  /* rows: the sprite from its first drawn row down to row 15 (blank rows are added above it);
     step: {row: string}, the rows frame 1 replaces */
  function mascot(id, extra, rows, step, anchors, head) {
    var f0 = [], f1, r;
    for (r = rows.length; r < GRID.size; r++) f0.push(BLANK);
    f0 = f0.concat(rows);
    f1 = f0.map(function (row, y) { return Object.prototype.hasOwnProperty.call(step, y) ? step[y] : row; });
    return { frames: [f0, f1], pal: petPal(id, extra), anchors: anchors, head: head };
  }

  /* ================================================================
     THE TEN MASCOTS (land-shops.json lands.<land>.mascots; catalogAdditions.species)
     ================================================================ */
  var MASCOTS = {
    /* Pier — a blue shore crab in three-quarter view, facing right: a low domed shell with a
       flared rim and a cream underside, the far eye small and the near eye big with a glint, a
       pink cheek, one big open pincer held up in front on a dark arm (cream finger tips), the
       other claw tucked under the front, and three splayed legs (back, middle, front) */
    pet_crab: mascot('pet_crab', {}, [
      '............bbb.',
      '...........bbbbl',
      '....bbbbb..bbd..',
      '..bbblbbbb.bbbbl',
      '.bbbbbkbbwk.bbb.',
      '.bbbbbkbbkk..d..',
      'bbbbbnbbbnbbdd..',
      'dd.dlllllldbl...',
      'd...dd.....dd...',
      'd..d.........d..',
      'd.d...........d.'
    ], { 13: '.d..dd.....dd...', 14: '.d..d.......d...', 15: 'd...d.......d...' },
    { hat: [6, 7], neck: [8, 11], face: [8, 10], back: [3, 8] },
    ['.....bbl', '.bbb.b..', 'bbbbb.bl', 'bkbbkbd.', 'bbbbbbd.', 'bnbbnb..', '.bllll..', 'd.d..d..']),

    /* Pier — a round soft-white seagull, side on: blue-grey folded wing with a navy tip, a
       chunky sunny beak with a coral tip, orange legs and webbed feet */
    pet_gull: mascot('pet_gull', { t: 'PX Penguin Back', c: 'PX Coral', p: 'PX Candy Pink' }, [
      '.......ddddd....',
      '......dbbbbbd...',
      '.....dbbbbbbbd..',
      '.....dbbbbbkbd..',
      '.....dbbbbbkbnnn',
      '.....dbbpllbbnnc',
      '.....dbbbbbbbd..',
      '...ddddbbbbbbbd.',
      '..dddddddbllbbd.',
      '.ddddddddbllbbd.',
      'twddddddbbbbbd..',
      '.tt.ddbbbbbdd...',
      '.......n...n....',
      '......nnn.nnn...'
    ], { 14: '........n.n.....', 15: '.......nnnnn....' },
    { hat: [9, 2], neck: [10, 9], face: [10, 6], back: [3, 9] },
    ['..bbbb..', '.bbbbbb.', '.bkbbkb.', '.bbnnbb.', '.bbnnbb.', 'dbbbbbbd', 'ddbbbbdd', '.ddbbdd.']),

    /* Jungle — a capybara, side on: a barrel loaf with a tall blunt brick head, small ears far
       back, a sleepy half-lidded eye, high nostril, pale chin and belly, dark toes, no tail */
    pet_capybara: mascot('pet_capybara', {}, [
      '.........dd.....',
      '.........bbbbbbb',
      '.........bbbbdbn',
      '.ddddddddbbbbkbb',
      'dbbbbbbbbbbbbbbb',
      'dbbbbbbbbbbbbbbb',
      'dbbbbbbbbbbbbbbb',
      'dbbbbbbbbbblllll',
      'dbbbbbbbbbbb....',
      '.dbbbbbbbbbb....',
      '.dblllllllbb....',
      '..bb.d..bb.d....',
      '..nn.n..nn.n....'
    ], { 14: '.d.bb..d.bb.....', 15: '.n.nn..n.nn.....' },
    { hat: [12, 4], neck: [12, 11], face: [12, 6], back: [5, 6] },
    ['d......d', 'bbbbbbbb', 'bbbbbbbb', 'bkbbbbkb', 'bbbbbbbb', 'bbnbbnbb', 'bbllllbb', '.bllllb.']),

    /* Jungle — a golden monkey: plum cap, cream heart-shaped face mask, round side ears, plum
       hands and feet, and a long tail that curls up behind it in a spiral */
    pet_monkey: mascot('pet_monkey', {}, [
      '.......bdddb....',
      '......bbdddbb...',
      '.....bbllbbllb..',
      '...bbbblkllklbbb',
      '...blbblkllklblb',
      '.bb..bblllnllb..',
      'b..b..bbllllb...',
      'b.db..bblllbb...',
      'b.....bblllbb...',
      '.b....dbblbbd...',
      '..bbbbbbblbb....',
      '.......bb.bb....',
      '......ddd.ddd...'
    ], { 12: '.b...d.bblbb.d..', 14: '......bb...bb...', 15: '.....ddd...ddd..' },
    { hat: [10, 3], neck: [10, 10], face: [10, 7], back: [5, 10] },
    ['..dddd..', '.bbddbb.', 'bllbbllb', 'blkllklb', 'bllllllb', '.blnnlb.', '..llll..', '........']),

    /* Treetop — a red squirrel, side on: tufted ear, cream muzzle and belly, pink nose, and a
       plume tail as big as the rest of it that rises to head height and curls forward */
    pet_squirrel: mascot('pet_squirrel', { a: 'PX Tree Autumn' }, [
      '..bbll.....d....',
      '.bbbbbl...bb....',
      'abbbb.....bbbbb.',
      'abbb.....bbbbbbb',
      'abbbb....bbbbkbb',
      'abbbb....bbbbkbn',
      'abbbb....bbaalll',
      '.bbbb.bbbbbbll..',
      '.dbbb.bbbbbll...',
      '..dbb.bbbbbll...',
      '...bbbbbbbbll...',
      '....bbbbbbbl....',
      '.....bbbb.bb....',
      '....bbbbb.bbb...'
    ], { 14: '....bbbb..bb....', 15: '...bbbbb...bbb..' },
    { hat: [12, 4], neck: [10, 9], face: [12, 7], back: [7, 9] },
    ['d......d', 'bd....db', 'bb....bb', 'bbbbbbbb', 'bkbbbbkb', 'bbllllbb', '.blnnlb.', '..llll..']),

    /* Treetop — a tawny owlet, nearly a ball: ear tufts, a cream face disc, yellow beak and
       feet, darker folded wings and pale chest speckles */
    pet_owl: mascot('pet_owl', { s: 'PX Tree Net' }, [
      '..d..........d..',
      '..bd........db..',
      '..bbbbbbbbbbbb..',
      '..bbbllllllllb..',
      '..bblllllllllb..',
      '..bblllkllkllb..',
      '..bblllkllkllb..',
      '..bbllllnnlllb..',
      '.dbbbbllnnllbbd.',
      '.ddbbbbbnbbbbdd.',
      '.ddbsbbbbbbsbdd.',
      '.ddbbbsbbsbbbdd.',
      '..dbsbbbbbbsbd..',
      '..dbbbbsbbbbbd..',
      '...bbbbbbbbbb...',
      '....nnn..nnn....'
    ], { 15: '...nnn....nnn...' },
    { hat: [8, 2], neck: [9, 10], face: [9, 6], back: [2, 9] },
    ['d......d', 'bd....db', 'bbbbbbbb', 'bllbbllb', 'blkbbklb', 'bllnnllb', '.bbnnbb.', '..bbbb..']),

    /* Castle — a fluffy yellow duckling, side on: a level body like a small boat, a round head
       held forward, a flat orange bill, an upturned tail and one fluff tuft on the crown */
    pet_duckling: mascot('pet_duckling', {}, [
      '..........b.....',
      '........bbbbb...',
      '.......bbbbbbb..',
      '.......bbbbbkb..',
      '.......bbbbbkbnn',
      '.......bbbbbbbn.',
      'bb.....bbbbbbb..',
      '.bb....bbbbbb...',
      '.bbbbbbbbbbbbb..',
      '.bbbbddddbbbbll.',
      '..bbbbdddbbblll.',
      '..dbbbbbbbbblll.',
      '...ddbbbbbbll...',
      '....nnn..nnn....'
    ], { 15: '...nnn....nnn...' },
    { hat: [10, 3], neck: [10, 9], face: [11, 6], back: [4, 10] },
    ['...bb...', '..bbbb..', '.bbbbbb.', '.bkbbkb.', '.bbbbbb.', '.nnnnnn.', '..nnnn..', '..llll..']),

    /* Castle — a sturdy chestnut pony, side on: the tallest of the crew, with an arched neck, a
       cream mane, forelock and brush tail, a cream muzzle, cream socks and dark hooves */
    pet_pony: mascot('pet_pony', {}, [
      '..........b.b...',
      '.........lbbbb..',
      '........llbbbbb.',
      '........llbbkbbl',
      '.......llbbbkbll',
      '.......lbbbbbbln',
      '.l.bbbbbbbbb.ll.',
      'll.bbbbbbbbb....',
      'll.bbbbbbbbb....',
      'l..bbbbbbbbb....',
      'l..bb.d..bb.d...',
      '...bb.d..bb.d...',
      '...ll.d..ll.d...',
      '...nn.n..nn.n...'
    ], { 12: 'l..d.bb..d.bb...', 13: '...d.bb..d.bb...', 14: '...d.ll..d.ll...', 15: '...n.nn..n.nn...' },
    { hat: [12, 3], neck: [10, 8], face: [11, 6], back: [5, 8] },
    ['b......b', 'bb.ll.bb', '.bbllbb.', '.bkllkb.', '.bbllbb.', '.bbllbb.', '.llllll.', '.lnllnl.']),

    /* Ice — a steel-blue penguin chick: an upright pear with a crown tuft, a cream face patch
       and tummy, a short orange beak, stubby flippers and wide orange feet */
    pet_penguin: mascot('pet_penguin', {}, [
      '.......bb.......',
      '.....bbbbbb.....',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '...bbbllllllb...',
      '...bbblkllklb...',
      '...bbblkllklb...',
      '...bbbllnnllb...',
      '..dbbllllllllbd.',
      '.ddbbllllllllbd.',
      '.d.bbllllllllb..',
      '...bbllllllllb..',
      '...bbllllllllb..',
      '....bbllllllbb..',
      '....nnn..nnn....'
    ], { 10: '..dbbllllllllbdd', 11: '...bbllllllllb.d', 15: '...nnn....nnn...' },
    { hat: [8, 2], neck: [9, 9], face: [9, 7], back: [3, 9] },
    ['...bb...', '..bbbb..', '.bbbbbb.', 'bbllllbb', 'blkllklb', 'bllnnllb', 'bbllllbb', '.bbbbbb.']),

    /* Ice — a silver seal pup flopped on its tummy: a round raised head on a thick neck, big
       eyes, a navy nose on a pale muzzle with whisker dots, a few speckles, flippers */
    pet_seal: mascot('pet_seal', {}, [
      '..........bbbb..',
      '.........bbbbbb.',
      '........bbbbbbbb',
      '........bbbkbbkb',
      '........bbbkbbkb',
      '....bbbbbbbbllll',
      '..bbbbdbbbbdlnll',
      'dbbbbbbbbdbbblll',
      'ddbbbbbbbbbbbll.',
      'd.bbbbbbbbbbddd.',
      'd..lllllllllddd.'
    ], { 12: '.bbbbbbbbdbbblll', 14: 'ddbbbbbbbbbb.ddd', 15: '...lllllllll.ddd' },
    { hat: [12, 5], neck: [11, 12], face: [13, 9], back: [5, 10] },
    ['..bbbb..', '.bbbbbb.', 'bbbbbbbb', 'bkbbbbkb', 'bbbnnbbb', 'bdllllbd', '.bllllb.', '..bbbb..'])
  };

  /* ================================================================
     SLOT ANCHORS for all 14 species. The four V4.54 pets share one head (centre 88, 42, r 20 in
     the frame) and one body, so they share one row: hat on the crown at frame (90, 22), face
     with the front eye cell on their eye (92, 39), neck under the chin (82, 56), back on the
     shoulders (46, 44).
     ================================================================ */
  var V454_PETS = ['pet_puppy', 'pet_kitten', 'pet_bunny', 'pet_dragon'];
  var ANCHORS = {};
  V454_PETS.forEach(function (id) { ANCHORS[id] = { hat: [14, 1.6], neck: [12.4, 8.4], face: [12.9, 5], back: [5.2, 6] }; });
  Object.keys(MASCOTS).forEach(function (id) { ANCHORS[id] = MASCOTS[id].anchors; });

  /* ================================================================
     THE 20 LAND ACCESSORIES (land-shops.json lands.<land>.accessories; catalogAdditions.gear)
     ================================================================ */
  var OVERLAYS = {
    /* ---- pier ---- */
    /* an upside-down waffle cone on a squashed pink scoop with two drips */
    acc_pier_conehat: { slot: 'hat', at: [4, 4], pal: { p: 'PX Candy Pink', c: 'PX Waffle', d: 'PX Jungle Thatch Shade' },
      rows: ['...c....', '...cd...', '..cdcc..', '.pppppp.', 'pppppppp', 'p..p....'] },
    /* a stripy swim ring worn as a collar, with its valve nub */
    acc_pier_ring: { slot: 'neck', at: [4, 0], pal: { c: 'PX Coral', w: 'Cloud White', y: 'PX Sunny' },
      rows: ['y.wccww.', 'cwwccwwc'] },
    /* a sunny diving mask with one wide pale lens and a coral snorkel up the back */
    acc_pier_snorkel: { slot: 'face', at: [4, 4], pal: { y: 'PX Sunny', g: 'PX Ice 2', w: 'Cloud White', c: 'PX Coral' },
      rows: ['cc.....', 'c......', 'c.yyyy.', 'cygwggy', '..yyyy.'] },
    /* a coral balloon on a string tied on behind */
    acc_pier_balloon: { slot: 'back', at: [6, 8], over: true, pal: { c: 'PX Coral', w: 'Cloud White', s: 'PX Castle Stone Shade' },
      rows: ['.ccc..', 'cwccc.', 'ccccc.', '.ccc..', '..c...', '...s..', '....s.', '.....s'] },

    /* ---- jungle ---- */
    /* a ring of pink and orange blossoms on a vine, hanging lower at the chest */
    acc_jungle_garland: { slot: 'neck', at: [3, 0], pal: { p: 'PX Jungle Flower Pink', o: 'PX Jungle Flower Orange', v: 'PX Jungle Canopy Light', y: 'PX Sunny' },
      rows: ['pv..vo', '.opyp.'] },
    /* a wide-brim khaki explorer hat: green band, a leaf and one upright red feather */
    acc_jungle_hat: { slot: 'hat', at: [4, 3], pal: { m: 'PX Khaki', g: 'PX Jungle Canopy Deep', v: 'PX Jungle Canopy Light', f: 'PX Jungle Parrot Red' },
      rows: ['.f......', '.fmmmm..', '..gvgg..', 'mmmmmmmm'] },
    /* a blue butterfly that has landed on the nose */
    acc_jungle_butterfly: { slot: 'face', at: [2, -1], pal: { b: 'PX Jungle Parrot Blue', k: 'PX Penguin Back', w: 'Cloud White' },
      rows: ['wb.bw', 'bbkbb', '.bkb.'] },
    /* a canvas backpack: green flap, a rolled map on top, a banana in the side pocket */
    acc_jungle_pack: { slot: 'back', at: [3, 1], over: true, pal: { m: 'PX Khaki', g: 'PX Jungle Canopy Deep', s: 'PX Jungle Bark Light', c: 'PX Cream', r: 'PX Jungle Parrot Red', y: 'PX Banana' },
      rows: ['crcc', 'gggg', 'ymms', '.mm.'] },

    /* ---- treetop ---- */
    /* a knobbly acorn cup with a rolled brim, a leaning stalk and one leaf */
    acc_treetop_acorn: { slot: 'hat', at: [3, 3], pal: { m: 'PX Tree Bark Trail', b: 'PX Tree Bark Trail 2', x: 'PX Tree Bark', v: 'PX Tree Oak Light' },
      rows: ['..xvv.', '.mxmm.', 'mxmmxm', 'bbbbbb'] },
    /* two oak leaves as a mask with eye holes and a rope tie */
    acc_treetop_leafmask: { slot: 'face', at: [4, 2], pal: { m: 'PX Tree Oak', s: 'PX Tree Oak Light', t: 'PX Tree Autumn', r: 'PX Tree Rope' },
      rows: ['.mmmsss', 'rm.ms.s', '.m.ms.t'] },
    /* chunky blue binoculars on a rope strap */
    acc_treetop_binoculars: { slot: 'neck', at: [3, 0], pal: { b: 'PX Tree Flag', y: 'PX Sunny', g: 'PX Lens Pale', r: 'PX Tree Rope' },
      rows: ['r....r', 'bbbbbb', 'yg..gy'] },
    /* two broad oak leaves tied on like wings */
    acc_treetop_leafwings: { slot: 'back', at: [5, 5], pal: { m: 'PX Tree Oak', s: 'PX Tree Oak Light', t: 'PX Tree Autumn', r: 'PX Tree Rope' },
      rows: ['.tm...', 'mmmm..', 'msmmm.', 'mmsmm.', '.mmsmm', '..mmmr'] },

    /* ---- castle ---- */
    /* a white pleated collar with lilac folds and a gold stud */
    acc_castle_ruff: { slot: 'neck', at: [3, 0], pal: { w: 'PX Castle Cloth', f: 'PX Lilac Base', g: 'PX Castle Gold' },
      rows: ['wfwfwf', 'fwfwgw'] },
    /* a knight's visor: a silver band with a slit the eyes peer through, gold rivets */
    acc_castle_visor: { slot: 'face', at: [3, 2], pal: { m: 'PX Castle Stone', h: 'PX Castle Strata 1', g: 'PX Castle Gold', s: 'PX Castle Stone Shade' },
      rows: ['mhhhhm', 'g....g', 'mssssm'] },
    /* a round silver helmet with a gold band and a tall red plume curling back */
    acc_castle_helm: { slot: 'hat', at: [4, 4], pal: { m: 'PX Castle Stone', h: 'PX Castle Strata 1', r: 'PX Castle Stone Shade', g: 'PX Castle Gold', p: 'PX Castle Pennant' },
      rows: ['pp......', '.pp.....', '..mhmm..', '.mmhmmm.', 'gggggggg', 'r.......'] },
    /* a long purple cloak: white collar with an iron spot, a gold sun clasp and a gold hem */
    acc_castle_cloak: { slot: 'back', at: [4, 0], over: true, pal: { p: 'PX Castle Banner', g: 'PX Castle Gold', w: 'PX Castle Cloth', k: 'PX Castle Iron' },
      rows: ['..kwg', '..ppp', '.pppp', 'pppp.', 'ggg..'] },

    /* ---- ice ---- */
    /* fluffy mint earmuffs on a sky-blue band */
    acc_ice_earmuffs: { slot: 'hat', at: [5, 1], pal: { m: 'PX Aurora Mint', f: 'PX Ice Snow', s: 'PX Sky Blue' },
      rows: ['..ssssss', '.ss....s', 'mmm.....', 'mfm.....', 'mmm.....'] },
    /* a red collar with three golden sleigh bells */
    acc_ice_bells: { slot: 'neck', at: [3, 0], pal: { r: 'PX Coral', g: 'Star Gold', k: 'PX Penguin Back' },
      rows: ['rrrrrr', 'g.gg.g', '..gk..'] },
    /* chunky snow goggles: white frame, a sunset lens, a navy strap */
    acc_ice_goggles: { slot: 'face', at: [4, 2], pal: { w: 'PX Ice Snow', s: 'PX Ice Snow Shade', a: 'PX Penguin Orange', b: 'PX Coral', c: 'PX Candy Pink', k: 'PX Penguin Back', g: 'PX Glint' },
      rows: ['.wwwwww', 'ksagbcs', 'ksabccs'] },
    /* a backpack shaped like a small round penguin */
    acc_ice_pack: { slot: 'back', at: [4, 1], over: true, pal: { k: 'PX Penguin Back', w: 'PX Penguin Front', o: 'PX Penguin Orange', s: 'PX Mint' },
      rows: ['.kkk.', 'kwkwk', 'kkoks', 'kwwks', '.kkk.'] }
  };

  var MASCOT_IDS = Object.keys(MASCOTS), ACC_IDS = Object.keys(OVERLAYS);

  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(v) {
    if (Array.isArray(v)) return v.map(copy);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = copy(v[k]); }); return o; }
    return v;
  }
  /* the ART.definePix spec of one id, or null (a fresh copy each time: the tables stay frozen) */
  function spec(id) {
    if (own(MASCOTS, id)) return copy(MASCOTS[id]);
    if (own(ANCHORS, id)) return { anchors: copy(ANCHORS[id]) };
    if (own(OVERLAYS, id)) return copy(OVERLAYS[id]);
    return null;
  }
  /* hand every id to ART.definePix; returns the ids it took ([] when world-art.js has no registry) */
  function register(art) {
    if (!art || typeof art.definePix !== 'function') return [];
    return V454_PETS.concat(MASCOT_IDS, ACC_IDS).filter(function (id) { return art.definePix(id, spec(id)) !== false; });
  }

  function freeze(v) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.keys(v).forEach(function (k) { freeze(v[k]); }); }
    return v;
  }
  return freeze({
    VERSION: VERSION, GRID: GRID, SLOTS: SLOTS, HEAD_KEYS: HEAD_KEYS, V454_PETS: V454_PETS,
    MASCOT_IDS: MASCOT_IDS, ACC_IDS: ACC_IDS, MASCOTS: MASCOTS, ANCHORS: ANCHORS, OVERLAYS: OVERLAYS,
    spec: spec, register: register
  });
}));
