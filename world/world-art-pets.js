/* ================================================================
   My Island v3, kids update — SLWorldArtPets (P2.6): the pets' 2D art and the care pictures.
   window.SLWorldArtPets in the browser (slLoadWorld loads it beside the other 2D art, after
   world-art.js), module.exports in Node. No DOM, no THREE, no storage, no points: strings only.

   PART 1 — THE FOURTEEN NEW SPECIES (kids-update pets.json catalogue.new), in world-art-crew.js's
   format and handed to world-art.js through ART.definePix, so ART.pet / ART.icon / the LED tower
   draw them exactly as they draw the ten land mascots:
     SPRITES {id: {frames: [rows, rows], pal, anchors, head}} on the 16 × 16 pet grid (GRID: cell
       (x, y) at frame x = 20 + 5·x, y = 14 + 5·y in the 120 × 100 pet box; row 15 is the foot line).
       A sprite faces right. Frame 1 changes only the rows below the head (legs, feet, a tail tip).
       pal letters: b body · d dark · l light · n nose ('PETCOL3.<id>.<part>', world-look's table:
       the crisp retunes of P1.3 come with it) · k the eye (PX Ink Eye) · w white (PX Glint); a few
       species add one letter of their own (the budgie's cream beak, the toucan's blue eye ring).
     ANCHORS {id: {hat, neck, face, back}} in whole cells, meaning what the crew's mean: hat the top
       edge of the head at its middle; neck the collar line under the chin; face the lower eye row,
       with the eyes in the cells x − 2 and x + 1; back the shoulder behind the head.
     head 8 × 8 in b d l k n for the LED tower's pixel-pet screen.
   register(ART) → the ids ART.definePix took (it runs by itself in the browser when
   SLWorldArt.definePix is there). Until then world-art draws its round stand-in in PETCOL3.

   PART 2 — THE CARE PICTURES (pets.json lookNotes, ui U5–U13), drawn here as SVG strings with no
   registry (definePix-free). Every colour is a look token, resolved when drawn (world-look loads
   after this file); pixels go through ART.pix (one <path> per colour). No words, no <text>, no
   5-point star; status is never colour alone (the UI always adds its word), so each picture is
   aria-hidden decoration (class 'slw-care slw-care-<kind>') for the UI's CSS to size.
     FOODS {food id: {rows 12 × 12, pal}}  the six foods: a paper bag (biscuits, the sack), a crate
                                (veg, fruit), a tin (fish) or a jar (treats) with the food on top
     foodIcon(foodId)           the shop / pantry card, 100 × 100: the pictogram on its plate (the
                                food's LOOK main colour 88% to white, framed like world-art's land
                                cards); '' if unknown. ART.icon does not draw foods (they have no
                                isle): the host's icon path asks this file for kind 'food'
     icon(id, st)               a food → foodIcon; a new species → ART.pet(id, {acc: st.acc}); else null
     bowl({group, pile})        the feeding bowl, 90 × 60: a white rim, coral with a sheen, its food
                                pile in the group's colours (GROUPS / PILE), pile 4 (full) … 0 (empty)
     bit(group, i)              one of the three food bits that drop into the bowl (i 0..2), 30 × 30
     tummy(n, {group, max})     the tummy row: max (3) bowls, the first n coral and full of the food
                                colour, the rest white; hearts(n, {max}): max (4) hearts, the first n
                                PX Candy Pink (never the member colour), the rest white; ink rings
     badge(kind)                a care badge for the 2D island, 24 × 24 (BADGES: hungry · peckish ·
                                sitter · rescue · star): a white symbol on a deep plate (≥ 4.5:1)
                                with a 2-unit Midnight Ink ring (the Rescue's: a heart with a plus)
     header(kind)               HEADER_KINDS hotel · rescue · memories: 120 × 60 pixel art (HEADERS)
     star()                     the 4-point memory star in Star Gold, 45 × 45 (class slw-memstar:
                                steady; any drift is the host's CSS, ≤ 0.3 Hz); memory(petId, {acc})
                                the Memory Book picture, 120 × 100: the pet in its outfit (ART.pet)
                                under a night arch with its star
   With no world-art.js or world-look.js on the page every picture is '' and nothing throws.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLWorldArtPets = api;
  var art = root && root.SLWorldArt;
  if (art && typeof art.definePix === 'function') api.register(art);
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  var VERSION = 1;
  var GRID = { size: 16, unit: 5, x: 20, y: 14 };
  var SLOTS = ['hat', 'neck', 'face', 'back'];
  var HEAD_KEYS = 'bdlkn';

  function petPal(id, extra) {
    var p = { b: 'PETCOL3.' + id + '.body', d: 'PETCOL3.' + id + '.dark', l: 'PETCOL3.' + id + '.light', n: 'PETCOL3.' + id + '.nose',
      k: 'PX Ink Eye', w: 'PX Glint' };
    Object.keys(extra).forEach(function (c) { p[c] = extra[c]; });
    return p;
  }
  var BLANK = '................';
  /* rows: the sprite from its first drawn row down to row 15; step: {row: string}, frame 1's rows */
  function mascot(id, extra, rows, step, anchors, head) {
    var f0 = [], f1, r;
    for (r = rows.length; r < GRID.size; r++) f0.push(BLANK);
    f0 = f0.concat(rows);
    f1 = f0.map(function (row, y) { return Object.prototype.hasOwnProperty.call(step, y) ? step[y] : row; });
    return { frames: [f0, f1], pal: petPal(id, extra), anchors: anchors, head: head };
  }

  /* ================================================================
     THE FOURTEEN NEW SPECIES (pets.json catalogue.new, in CATALOG order: Home's four, then two a land)
     ================================================================ */
  var SPRITES = {
    /* Home — a round golden hamster seen from the front: a ball with small round ears (pink
       inside), bead eyes, stuffed cream cheek pads that stick out each side, a cream muzzle and
       belly with a pink nose, and four stub feet; no tail */
    pet_hamster: mascot('pet_hamster', {}, [
      '...dd......dd...',
      '...dnbbbbbbnd...',
      '..bbbbbbbbbbbb..',
      '..bbbbkbbkbbbb..',
      '.bbbbbkbbkbbbbb.',
      'bbbbbllnnllbbbbb',
      'blbbbllllllbbblb',
      '.bbbllllllllbbb.',
      '..dbbllllllbbd..',
      '...dbbbbbbbbd...',
      '....dd....dd....'
    ], { 15: '...dd......dd...' },
    { hat: [8, 6], neck: [8, 12], face: [8, 9], back: [3, 9] },
    ['.dd..dd.', 'dnbbbbnd', 'bbbbbbbb', 'bkbbbbkb', 'bbbnnbbb', 'lbllllbl', '.llllll.', '..dddd..']),

    /* Home — a guinea pig, side on: a long loaf in big patches (white rump, a brown saddle, a
       ginger head and front) with a white blaze down the face, a petal ear flopped by the eye, a
       pink nose and tiny feet; no tail */
    pet_guineapig: mascot('pet_guineapig', {}, [
      '....dddd..bbbb..',
      '..dddddbbbbbblbb',
      '.ddddddbbbdbklbb',
      '.dddddllllbdblln',
      '.ddddlllllbbbllb',
      '.dddbllllbbbbbb.',
      '..ddbbbbbbbbbb..',
      '...dbbbbbbbbb...',
      '....dd....dd....'
    ], { 15: '.....dd....dd...' },
    { hat: [12, 7], neck: [12, 12], face: [11, 9], back: [6, 8] },
    ['d.bbbb.d', 'dbbllbbd', 'dbbllbbd', 'bkbllbkb', 'bbbllbbb', 'bbllllbb', '.blnnlb.', '..llll..']),

    /* Home — a tortoise, side on: a high domed shell in dark brown with sand plates in a ring and
       one on top, an olive head poking forward on a short neck, four thick olive legs with dark
       toenail dots and a stub tail */
    pet_tortoise: mascot('pet_tortoise', {}, [
      '.....dddddd.....',
      '...ddllddlldd.bb',
      '..dlllddlllldbkb',
      '.ddddddddddddbln',
      '.dllddllddlldbb.',
      '.llllllllllll...',
      '..bbb.bbb.bbb...',
      '..bbb.bbb.bbb...',
      '..nbn.nbn.nbn...'
    ], { 14: '...bbb.bbb.bbb..', 15: '...nbn.nbn.nbn..' },
    { hat: [14, 8], neck: [14, 11], face: [13, 9], back: [7, 7] },
    ['..bbbb..', '.bbbbbb.', 'bbbbbbbb', 'bkbbbbkb', 'bbbbbbbb', 'bbbnnbbb', '.bbbbbb.', '..dddd..']),

    /* Home — a bright green budgie, side on: a sunny yellow face with a blue cere over a small
       cream beak and dark throat dots, dark wavy bars on the folded wing, a long thin dark tail
       and two little feet */
    pet_budgie: mascot('pet_budgie', { c: 'PX Cream' }, [
      '........llll....',
      '.......llllll...',
      '.......lllkllnn.',
      '.......llllllcc.',
      '........ldlldc..',
      '......dbbbbbbd..',
      '.....dbdbbbbbbd.',
      '....dbdbdbbbbbd.',
      '....dbdbdbbbbd..',
      '...ddbdbdbbbd...',
      '..dd..dbbbbd....',
      '.dd.....k.k.....',
      'dd.....kk.kk....'
    ], { 14: '.dd.....k..k....', 15: 'dd.....kk..kk...' },
    { hat: [10, 3], neck: [10, 8], face: [9, 5], back: [6, 9] },
    ['..llll..', '.llllll.', 'lkllllkl', 'llnnnnll', 'llllllll', 'ldlllldl', 'bbbbbbbb', '.bbbbbb.']),

    /* Pier — a sleek river otter, long and low like the seal: brown with a cream face, chin and
       chest, a small round ear, a broad dark nose with whisker dots, front paws and a thick
       tapering tail along the ground behind */
    pet_otter: mascot('pet_otter', {}, [
      '..........db....',
      '.........bbbbbb.',
      '........bbbbbkbb',
      '...bbbbbbbblllln',
      '.bbbbbbbbbllldll',
      'dbbbbbbbbbllll..',
      'ddbbbbbbbblll...',
      '.d..bb...bbd....',
      '....dd...dd.....'
    ], { 14: '...bb.....bb....', 15: '...dd.....dd....' },
    { hat: [12, 8], neck: [12, 12], face: [12, 9], back: [6, 11] },
    ['.d....d.', 'dbbbbbbd', 'bbbbbbbb', 'bkbbbbkb', 'bblllbbb', 'blldnllb', '.llllll.', '..llll..']),

    /* Pier — a pink flamingo, the tallest pet: a small head with a bent beak (pale at the base,
       dark at the tip) on an S-curved neck, a round pink body with darker wing coverts, and two
       long thin legs */
    pet_flamingo: mascot('pet_flamingo', {}, [
      '........bbb.....',
      '.......bbbklll..',
      '.......bbbbb.ll.',
      '........bb....n.',
      '.........bb.....',
      '.........bb.....',
      '.....dddbbb.....',
      '...dddddbbbb....',
      '..ddddddbbbb....',
      '...ddddbbbb.....',
      '.....lbbbl......',
      '.......b.b......',
      '.......b.b......',
      '......nn.nn.....'
    ], { 13: '.......b..b.....', 14: '......b...b.....', 15: '.....nn...nn....' },
    { hat: [9, 2], neck: [10, 8], face: [9, 3], back: [5, 8] },
    ['..bbbb..', '.bbbbbb.', 'bbkbbkbb', 'bbbllbbb', '.bbllbb.', '..bllb..', '...ll...', '...nn...']),

    /* Jungle — a sloth, low on all fours: a shaggy fawn body, a pale face with the dark eye stripes
       of a three-toed sloth, a small dark nose and a gentle smile, long front arms and three cream
       claw dots on each paw */
    pet_sloth: mascot('pet_sloth', {}, [
      '.....bbbbbb.....',
      '....bbbbbbbb....',
      '...bbllllllbb...',
      '...bldkllkdlb...',
      '...bddllllddb...',
      '...blllnnlllb...',
      '....bldlldlb....',
      '..bbbbbbbbbbbb..',
      '.bb.bbbbbbbb.bb.',
      '.bb.bdbbbbdb.bb.',
      '.bb.bbbbbbbb.bb.',
      'lll..bb..bb..lll'
    ], { 14: '.bb.bbbbbbbb.bb.', 15: 'lll.bb....bb.lll' },
    { hat: [8, 4], neck: [8, 11], face: [8, 7], back: [3, 11] },
    ['..bbbb..', '.bbbbbb.', 'bllllllb', 'dkllllkd', 'ddllllld', 'bllnnllb', '.ldlldl.', '..bbbb..']),

    /* Jungle — a toucan, side on: a charcoal-navy body (never black) with a big cream bib, a blue
       eye ring, a huge orange beak with a dark tip, a short square tail and two feet */
    pet_toucan: mascot('pet_toucan', { r: 'PX Sky Blue' }, [
      '......bbbb......',
      '.....bbbbbbnnnn.',
      '.....bbrkbbnnnnd',
      '.....bbllllnnndd',
      '....bbblllll....',
      '...bbbbllll.....',
      '..bbbbblll......',
      '.dbbbbbllb......',
      'ddbbbbbbbb......',
      'dd.bbbbbbb......',
      '....bbbbb.......',
      '.....k..k.......',
      '....kk.kk.......'
    ], { 14: '......k..k......', 15: '.....kk.kk......' },
    { hat: [8, 3], neck: [8, 7], face: [7, 5], back: [4, 9] },
    ['..bbbb..', '.bbbbbb.', 'blkbbklb', 'bllbbllb', 'bbnnnnbb', 'blnnnnlb', '.llddll.', '..llll..']),

    /* Treetop — a red panda cub, side on: a russet head with a white face mask, russet tear marks
       and white-edged pointed ears, a dark nose, a russet back, dark legs and belly, and a thick
       ringed tail that curls up behind */
    pet_redpanda: mascot('pet_redpanda', {}, [
      '..........l..l..',
      '..........lbbll.',
      '.bb.......bbbbbb',
      'bllb......llbkll',
      'bbbb......lbbkln',
      '.lll.....bbllllb',
      '.bbbb.bbbbblll..',
      '..lllbbbbbbbbb..',
      '...bbbbbbbbbbb..',
      '...dddbbbbbddd..',
      '....dd....dd....',
      '....dd....dd....'
    ], { 14: '...dd......dd...', 15: '...dd......dd...' },
    { hat: [12, 5], neck: [12, 10], face: [12, 8], back: [7, 10] },
    ['l.l..l.l', 'lbbbbbbl', 'bllbblll', 'lkbllkbl', 'lbllllbl', 'bllnnllb', '.blllll.', '..bbbb..']),

    /* Treetop — a hedgehog, side on: a dome of soft spines in staggered rows of brown and dark
       brown with pale tips, a cream face and tummy, a small round ear, a pointed snout with a dark
       button nose and short legs */
    pet_hedgehog: mascot('pet_hedgehog', {}, [
      '....l.l.l.l.....',
      '...lbdbdbdbl....',
      '..lbdbdbdbdbl...',
      '.lbdbdbdbdbdll..',
      '.bdbdbdbdbdllkl.',
      'ldbdbdbdbdllllln',
      '.dbdbdbdbllll...',
      '...dd....dd.....',
      '...dd....dd.....'
    ], { 15: '..dd......dd....' },
    { hat: [12, 9], neck: [12, 13], face: [12, 11], back: [6, 9] },
    ['.l.l.l..', 'lbdbdbl.', 'bdbdbdb.', 'dlllllld', 'lkllllkl', 'lllnnlll', '.llllll.', '..llll..']),

    /* Castle — a creamy white goat kid (the pony's shape): two short grey horn nubs, a sideways ear,
       a pink nose, grey-brown hooves, a short upturned tail and a grey edge under the body so it
       reads on the castle's pale stone */
    pet_goatkid: mascot('pet_goatkid', {}, [
      '..........d.d...',
      '.........bbbbb..',
      '.......ddbbbbkb.',
      '.........bbbbkbb',
      '.........bbbbbll',
      '..b......bbbblln',
      '..bbbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '...dbddddddbd...',
      '...b.b...b.b....',
      '...b.b...b.b....',
      '...d.d...d.d....'
    ], { 13: '..b..b..b..b....', 14: '..b..b..b..b....', 15: '..d..d..d..d....' },
    { hat: [11, 4], neck: [11, 9], face: [12, 6], back: [6, 9] },
    ['d.d..d.d', 'dbbbbbbd', '.bbbbbb.', 'bkbbbbkb', '.bbbbbb.', '.bllllb.', '.llnnll.', '..llll..']),

    /* Castle — a peacock, side on: a blue body and neck, a white face patch, a crest of three pale
       stalks with blue tips, a short gold beak, and a long teal-green train folded flat behind with
       gold-and-blue eye spots */
    pet_peacock: mascot('pet_peacock', {}, [
      '..........b.b.b.',
      '...........lll..',
      '..........bbbbb.',
      '..........bllkbn',
      '..........lllbb.',
      '...........bbb..',
      '..........bbb...',
      '.........bbbb...',
      '........bddbbb..',
      '.dddddddddddbb..',
      'dnbdnbdnbdbbbb..',
      'ddddddddd.n.n...',
      '.........nn.nn..'
    ], { 14: 'ddddddddd.n..n..', 15: '.........nn..nn.' },
    { hat: [12, 5], neck: [12, 8], face: [12, 6], back: [9, 11] },
    ['.b.b.b..', '.l.l.l..', '.bbbbbb.', 'blkbbklb', 'bllbbllb', '.bbnnbb.', '.bbnnbb.', '..bbbb..']),

    /* Ice — a reindeer calf (the pony's shape): brown with a cream neck ruff, cream rump patch and
       belly, small ears, two short velvety antler nubs with one fork, a dark nose, dark legs and
       hooves, and a white tail tuft */
    pet_reindeer: mascot('pet_reindeer', {}, [
      '.........d.d.d..',
      '..........dd.d..',
      '.........bbbbb..',
      '........bbbbkb..',
      '.........bbbblbn',
      '.........llbbbb.',
      '.w.bbbbbllll....',
      '.wlbbbbbbbbb....',
      '..lbbbbbbbbb....',
      '...bbllllllb....',
      '...d.d...d.d....',
      '...d.d...d.d....',
      '...d.d...d.d....'
    ], { 13: '..d..d..d..d....', 14: '..d..d..d..d....', 15: '..d..d..d..d....' },
    { hat: [11, 5], neck: [11, 9], face: [11, 6], back: [6, 9] },
    ['d.d..d.d', '.dd..dd.', '.bbbbbb.', 'bkbbbbkb', 'bbbbbbbb', 'bbbnnbbb', '.bllllb.', '..llll..']),

    /* Ice — a snow leopard cub, kitten-shaped with big paws: smoky pale fur with dark rosettes,
       round ears with dark backs, a white muzzle and belly, a pink nose and a very long thick tail
       with dark rings that curls up behind */
    pet_snowleopard: mascot('pet_snowleopard', {}, [
      '..........d..d..',
      '..dd......dbbbd.',
      '.dbbd....dbbbbbd',
      '.dd......dbkbbkb',
      '.bd......dlllnll',
      '.dd.......dlllb.',
      '.bdbbdbbdbbbbd..',
      '..dbbbdbbbdbbd..',
      '..bbdbbbbdbbbd..',
      '...dllllllld....',
      '...dd.....dd....',
      '..dlld...dlld...'
    ], { 14: '..dd.......dd...', 15: '.dlld.....dlld..' },
    { hat: [12, 5], neck: [12, 10], face: [13, 7], back: [7, 10] },
    ['d.d..d.d', 'dbbbbbbd', 'bbdbbdbb', 'bkbbbbkb', 'blllllbb', 'bllnnllb', '.llllll.', '..dddd..'])
  };
  var SPECIES_IDS = Object.keys(SPRITES);
  var ANCHORS = {};
  SPECIES_IDS.forEach(function (id) { ANCHORS[id] = SPRITES[id].anchors; });

  /* ================================================================
     THE SIX FOODS (pets.json food.items, in CATALOG order): 12 × 12 pictograms in each food's own
     LOOK colours (world-look food rows, the same as its 3D display model), plus a darker edge
     where the pale part would melt into its plate
     ================================================================ */
  var FOODS = {
    /* a paper bag with a folded top, a pink label with a white bone, and two biscuits on top */
    food_biscuits: { pal: { m: 'PX Khaki', t: 'PX Khaki Shade', p: 'PX Candy Pink', w: 'Cloud White', f: 'PX Waffle' }, rows: [
      '...fff.fff..',
      '...ftf.ftf..',
      '.ttttttttttt',
      '.mmmmmmmmmmm',
      '.mmpppppppmm',
      '.mmpwpppwpmm',
      '.mmpwwwwwpmm',
      '.mmpwpppwpmm',
      '.mmpppppppmm',
      '.mmmmmmmmmmm',
      '.tmmmmmmmmmt',
      '.ttttttttttt'] },
    /* a big round sack tied at the neck with rope, a blue band with a white bone, biscuits spilling out */
    food_sack: { pal: { m: 'PX Khaki', t: 'PX Khaki Shade', r: 'PX Jungle Rope', s: 'PX Sky Blue', w: 'Cloud White', f: 'PX Waffle' }, rows: [
      '....fff.....',
      '....mmm.....',
      '...rrrrr....',
      '....mmm.....',
      '..mmmmmmm...',
      '.mmmmmmmmm..',
      'ssswsssswss.',
      'ssswwwwwwss.',
      'ssswsssswss.',
      'mmmmmmmmmmm.',
      'tmmmmmmmmmtf',
      '.ttttttttfff'] },
    /* a wooden crate (plank and bark slats) of carrots with green tops and leafy greens */
    food_veg: { pal: { m: 'PX Tree Plank', t: 'PX Jungle Bark Light', o: 'PX Jungle Flower Orange', g: 'PX Leaf', e: 'PX Tree Oak Light' }, rows: [
      '.g....g.....',
      '.gg..ggg..e.',
      '..oo..oo.eee',
      '..oo..oo.eee',
      '...o...o..e.',
      'tttttttttttt',
      'tmmmmmmmmmmt',
      'tmmmmmmmmmmt',
      'tttttttttttt',
      'tmmmmmmmmmmt',
      'tmmmmmmmmmmt',
      'tttttttttttt'] },
    /* an open blue tin with a sunny label, two silver-blue fish on top */
    food_fish: { pal: { m: 'PX Pier Stripe Blue', i: 'PX Ice Pebble 3', y: 'PX Sunny', f: 'PX Ice Pebble 2', w: 'PX Lens Pale', k: 'PX Ink Eye' }, rows: [
      '.......f....',
      '.ffff.fff...',
      'fkffwfffff..',
      '.ffff.fff...',
      '.iiiiiiiiii.',
      '.mmmmmmmmmm.',
      '.yyyyyyyyyy.',
      '.yfffkyyyyy.',
      '.yyyyyyyyyy.',
      '.mmmmmmmmmm.',
      '.mmmmmmmmmm.',
      '.iiiiiiiiii.'] },
    /* a low fruit crate (upright boards) piled with a red apple, a banana and purple berries */
    food_fruit: { pal: { m: 'PX Tree Plank', t: 'PX Jungle Bark Light', r: 'PX Jungle Parrot Red', y: 'PX Banana', p: 'PX Lilac', g: 'PX Leaf' }, rows: [
      '...g........',
      '..rgr...p.p.',
      '.rrrrr.ppppp',
      '.rrrrryyyppp',
      '.rrrryyyy.p.',
      '..rryyyy....',
      'tttttttttttt',
      'mtmmtmmtmmtm',
      'mtmmtmmtmmtm',
      'mtmmtmmtmmtm',
      'tttttttttttt',
      '.t........t.'] },
    /* a glass jar with a pink lid, a pink cookie and a mint cookie inside and one on the lid */
    food_treats: { pal: { m: 'PX Lens Pale', g: 'PX Ice Deep', t: 'PX Candy Pink', n: 'PX Mint', w: 'Cloud White' }, rows: [
      '....nnnn....',
      '..tttttttt..',
      '..tttttttt..',
      '...gggggg...',
      '..gmmmmmwg..',
      '.gttttmmmwg.',
      '.gtnttmnnng.',
      '.gttttntnng.',
      '.gmmmmnnnmg.',
      '.gmmmmmmmmg.',
      '..gmmmmmmg..',
      '...gggggg...'] }
  };
  var FOOD_IDS = Object.keys(FOODS);
  /* the bowl pile's colours by food group (pets.json lookNotes.bowl), the first is the main one */
  var GROUPS = ['biscuits', 'veg', 'fish', 'fruit', 'treat'];
  var PILE = {
    biscuits: ['PX Waffle', 'PX Khaki Shade'],
    veg: ['PX Jungle Flower Orange', 'PX Leaf'],
    fish: ['PX Ice Pebble 2', 'PX Lens Pale'],
    fruit: ['PX Jungle Parrot Red', 'PX Banana', 'PX Lilac'],
    treat: ['PX Candy Pink', 'PX Mint']
  };
  /* one food bit of each group (4 × 4): a biscuit, a carrot / pea / leaf, a fish, an apple / banana /
     berry, a cookie; i picks the variant (mod the list) */
  var BITS = {
    biscuits: [['aaaa', 'abaa', 'aaba', 'aaaa'], ['.aa.', 'aaba', 'abaa', '.aa.'], ['aaa.', 'abaa', 'aaab', '.aaa']],
    veg: [['..bb', '.aab', 'aaa.', 'aa..'], ['.bb.', 'bbbb', 'bbbb', '.bb.'], ['..b.', '.bbb', 'bbb.', '.b..']],
    fish: [['....', 'aa.a', 'abaa', 'aa.a'], ['....', 'a.aa', 'aaba', 'a.aa'], ['.aa.', 'abaa', 'aaaa', '.aa.']],
    fruit: [['..g.', '.aa.', 'aaaa', '.aa.'], ['b...', 'bb..', '.bbb', '..bb'], ['.c..', 'cccc', 'cccc', '.cc.']],
    treat: [['.aa.', 'abaa', 'aaba', '.aa.'], ['.bb.', 'babb', 'bbab', '.bb.'], ['.aa.', 'aaaa', 'abba', '.aa.']]
  };

  /* ================================================================
     THE CARE PICTURES: colours resolved at draw time; ART.pix draws the pixels
     ================================================================ */
  var DEPS = {};
  function sib(name, path, key) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!Object.prototype.hasOwnProperty.call(DEPS, name)) {
      try { var r = require(path); DEPS[name] = (key ? r && r[key] : r) || null; } catch (e) { DEPS[name] = null; }
    }
    return DEPS[name];
  }
  function art() { var a = sib('SLWorldArt', './world-art.js', 'SLWorldArt'); return a && typeof a.pix === 'function' ? a : null; }
  function look() { var L = sib('SLIslandLook', './world-look.js'); return L && typeof L.resolve === 'function' ? L : null; }
  var QUIET = 'Concrete Light';      /* an unknown token keeps its shape, in a quiet grey (as world-art) */
  function hex(token) {
    var L = look(), h = L && typeof token === 'string' ? L.resolve(token) : null;
    return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : null;
  }
  function hexOf(token) { return hex(token) || hex(QUIET); }
  function palHex(pal) { var out = {}; Object.keys(pal).forEach(function (k) { out[k] = hexOf(pal[k]); }); return out; }
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mix(a, b, k) {
    var x = rgb(a), y = rgb(b);
    return '#' + x.map(function (v, i) { var c = Math.round(v + (y[i] - v) * k); return (c < 16 ? '0' : '') + c.toString(16); }).join('');
  }
  function n1(v) { return String(Math.round(v * 100) / 100); }
  function svg(kind, w, h, inner) {
    return '<svg class="slw-care slw-care-' + kind + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function box(x, y, w, h, fill) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + fill + '"/>'; }
  /* rows → pixels in token colours (pal: char → token) */
  function draw(rows, pal, unit, ox, oy) { var A = art(); return A && look() ? A.pix(rows, palHex(pal), unit, ox || 0, oy || 0) : ''; }
  function ready() { return !!(art() && look()); }
  /* a grid with a one-cell ring of `ch` round everything drawn (grows the grid by one cell each side) */
  function ringed(rows, ch) {
    var h = rows.length + 2, w = rows[0].length + 2, out = [], x, y;
    function at(cx, cy) { return cy >= 1 && cy <= rows.length && cx >= 1 && cx <= rows[0].length ? rows[cy - 1].charAt(cx - 1) : '.'; }
    for (y = 0; y < h; y++) {
      var row = '';
      for (x = 0; x < w; x++) {
        var c = at(x, y);
        row += c !== '.' ? c : (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.') ? ch : '.';
      }
      out.push(row);
    }
    return out;
  }
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function groupOf(g) { return own(PILE, g) ? g : 'biscuits'; }
  function count(v, max) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : 0; return Math.max(0, Math.min(max, v)); }

  /* ---------------- foods ---------------- */
  /* the shop / pantry card: the pictogram on its plate (main colour 88% to white) with world-art's
     card frame (a 2-unit ink edge with notched corners, a lip in the main colour's shade) */
  function plateHex(id) { var m = hexOf(FOODS[id].pal.m); return mix(m, hexOf('Cloud White'), 0.88); }
  function foodIcon(id) {
    if (!own(FOODS, id) || !art() || !look()) return '';
    var F = FOODS[id], ink = hexOf('Ink Deep'), main = hexOf(F.pal.m), u = 6, side = 12 * u;
    var plate = box(10, 8, 80, 84, ink) + box(8, 10, 84, 80, ink) + box(10, 10, 80, 76, plateHex(id)) + box(10, 86, 80, 4, mix(main, ink, 0.22));
    return svg('food', 100, 100, '<g class="slw-food-' + id.slice(5) + '">' + plate + draw(F.rows, F.pal, u, (100 - side) / 2, 10 + (76 - side) / 2) + '</g>');
  }
  /* the card picture of an id this file draws: a food, or a new species through ART.pet */
  function icon(id, st) {
    if (own(FOODS, id)) return foodIcon(id);
    var A = art();
    if (own(SPRITES, id) && A && typeof A.pet === 'function') return A.pet(id, { acc: (st && st.acc) || {} });
    return null;
  }

  /* ---------------- the bowl and the bits ---------------- */
  /* 16 × 10 cells (+ the ink ring) at 5 units: the pile rows 0..3 above the rim, then the bowl: a
     white rim, coral with a blush sheen and a darker foot (lookNotes.bowl's paw inlay is the 3D
     model's; at 2D size it reads as a face) */
  var BOWL = ['.wwwwwwwwwwwwww.', 'cccccccccccccccc', '.chhhhcccccccccs', '.chhcccccccccccs', '..ccccccccccccs.', '...ssssssssss...'];
  var MOUND = ['......aaaa......', '....aaaaaaaa....', '..aaaaaaaaaaaa..', '.aaaaaaaaaaaaaa.'];
  function pileRows(group, n) {
    var k = PILE[group].length, rows = [], y, x, row, h;
    for (y = 0; y < 4; y++) {
      row = '';
      for (x = 0; x < 16; x++) {
        h = (x * 5 + y * 3) % 6;
        row += y < 4 - n || MOUND[y].charAt(x) === '.' ? '.' : k > 2 ? 'xyz'.charAt(h % 3) : h === 2 || h === 5 ? 'y' : 'x';
      }
      rows.push(row);
    }
    return rows;
  }
  function bowl(o) {
    o = o || {};
    if (!ready()) return '';
    var g = groupOf(o.group), n = count(o.pile == null ? 4 : o.pile, 4), pal = { w: 'PX Glint', c: 'PX Coral', h: 'Blush', s: 'Cape Red', o: 'Ink' };
    PILE[g].forEach(function (t, i) { pal['xyz'.charAt(i)] = t; });
    var rows = ringed(pileRows(g, n).concat(BOWL), 'o');
    return svg('bowl', 90, 60, '<g class="slw-bowl slw-pile-' + n + '">' + draw(rows, pal, 5, 0, 0) + '</g>');
  }
  function bit(group, i) {
    if (!ready()) return '';
    var g = groupOf(group), list = BITS[g], rows = list[count(i, 99) % list.length], pal = { o: 'Ink', g: 'PX Leaf' };
    PILE[g].forEach(function (t, j) { pal['abc'.charAt(j)] = t; });
    return svg('bit', 30, 30, '<g class="slw-bit">' + draw(ringed(rows, 'o'), pal, 5, 0, 0) + '</g>');
  }

  /* ---------------- the meters ---------------- */
  var TUMMY_FULL = ['..aaaaa..', '.aabaaba.', 'wwwwwwwww', 'ccccccccc', '.ccccccc.', '..ccccc..'];
  var TUMMY_EMPTY = ['.........', '.........', 'eeeeeeeee', 'eeeeeeeee', '.eeeeeee.', '..eeeee..'];
  var HEART = ['.hh.hh.', 'hwhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...'];
  var HEART_EMPTY = HEART.map(function (r) { return r.replace(/[hw]/g, 'e'); });
  /* a row of icons (each cells wide, a one-cell gap) with an ink ring, unit 4 */
  function meterRow(kind, icons, w, h, pal) {
    var rows = [], y;
    if (!ready()) return '';
    for (y = 0; y < h; y++) rows.push(icons.map(function (ic) { return ic[y]; }).join('...'));
    var out = ringed(rows, 'o'), W = out[0].length * 4, H = out.length * 4;
    pal.o = 'Ink';
    return svg(kind, W, H, '<g class="slw-meter">' + draw(out, pal, 4, 0, 0) + '</g>');
  }
  function tummy(n, o) {
    o = o || {};
    var max = count(o.max == null ? 3 : o.max, 6) || 3, k = count(n, max), g = groupOf(o.group), i, icons = [];
    for (i = 0; i < max; i++) icons.push(i < k ? TUMMY_FULL : TUMMY_EMPTY);
    var pal = { w: 'PX Glint', c: 'PX Coral', e: 'PX Glint' };
    pal.a = PILE[g][0]; pal.b = PILE[g][PILE[g].length > 1 ? 1 : 0];
    return meterRow('tummy', icons, 9, 6, pal);
  }
  function hearts(n, o) {
    o = o || {};
    var max = count(o.max == null ? 4 : o.max, 8) || 4, k = count(n, max), i, icons = [];
    for (i = 0; i < max; i++) icons.push(i < k ? HEART : HEART_EMPTY);
    return meterRow('hearts', icons, 7, 6, { h: 'PX Candy Pink', e: 'PX Glint', w: 'PX Glint' });
  }

  /* ---------------- care badges (2D island) ----------------
     A 12 × 12 grid at 2 units: a deep plate with notched corners, a one-cell (2-unit) Midnight Ink
     ring, a white 8 × 8 symbol. The plates are deep enough for white to keep 4.5:1. A symbol may
     carry one accent ('c', ≥ 4.5:1 on white): the Pet Rescue's is a solid white heart with a
     City Glow plus on it (care, first aid), never cut-outs in the plate colour, which read as a
     face (review 24 Oct 2026, E3); never a red cross on white (the Red Cross emblem). */
  var BADGES = ['hungry', 'peckish', 'sitter', 'rescue', 'star'];
  var BADGE = {
    hungry: { plate: 'City Glow', sym: ['........', '........', '........', 'wwwwwwww', 'wwwwwwww', '.wwwwww.', '..wwww..', '........'] },
    peckish: { plate: 'Night Lagoon', sym: ['........', '...ww...', '...ww...', '........', 'wwwwwwww', '.wwwwww.', '..wwww..', '........'] },
    sitter: { plate: 'Leaf Deep', sym: ['...ww...', '..wwww..', '.wwwwww.', 'wwwwwwww', '.w.ww.w.', '.w....w.', '.ww..ww.', '.wwwwww.'] },
    rescue: { plate: 'PX Night Haze', accent: 'City Glow', sym: ['.ww..ww.', 'wwwwwwww', 'wwwccwww', 'wwccccww', 'wwwccwww', '.wwwwww.', '..wwww..', '...ww...'] },
    star: { plate: 'Night Mid', sym: ['...ww...', '...ww...', '..wwww..', 'wwwwwwww', 'wwwwwwww', '..wwww..', '...ww...', '...ww...'] }
  };
  function badge(kind) {
    var b = own(BADGE, kind) ? BADGE[kind] : null;
    if (!b || !ready()) return '';
    var rows = ['.pppppppp.'], y;
    for (y = 0; y < 8; y++) rows.push('p' + b.sym[y].replace(/\./g, 'p') + 'p');
    rows.push('.pppppppp.');
    var pal = { p: b.plate, w: 'Cloud White', o: 'Midnight Ink' };
    if (b.accent) pal.c = b.accent;
    return svg('badge', 24, 24, '<g class="slw-badge slw-badge-' + kind + '">' + draw(ringed(rows, 'o'), pal, 2, 0, 0) + '</g>');
  }

  /* ---------------- the star ---------------- */
  var STAR = ['....s....', '....s....', '...sys...', '..syyys..', 'ssyyGyyss', '..syyys..', '...sys...', '....s....', '....s....'];
  function star() {
    return ready() ? svg('star', 45, 45, '<g class="slw-memstar">' + draw(STAR, { s: 'Gold Light', y: 'Star Gold', G: 'Cloud White' }, 5, 0, 0) + '</g>') : '';
  }

  /* ---------------- headers (40 × 20 at 3 units = 120 × 60) and the memory picture ----------------
     The Pet Hotel: a two-storey hotel with round windows and a paw sign over the door (a white
     board, a coral paw, no letters). The Pet Rescue: a cottage with a heart sign and a basket with a blanket by the door.
     The Memory Book: a night arch with a steady 4-point star and an open book of memories. */
  var GREEN = { l: 'PX Leaf', L: 'PX Leaf 2', p: 'PX Candy Pink', s: 'PX Pier Sand 2', o: 'Ink' };
  var HEADERS = {
    hotel: { pal: { r: 'PX Castle Banner', R: 'PX Night Haze', e: 'Cloud White', y: 'Star Gold', w: 'PX Cream', W: 'PX Khaki', f: 'Ink', g: 'PX Sky Blue', G: 'PX Glint', d: 'PX Coral' }, rows: [
      '........................................',
      '.................rrrrrr.................',
      '..............rrrrrffrrrrr..............',
      '...........rrrrrrrfgGfrrrrrrr...........',
      '........rrrrrrrrrrrffrrrrrrrrrrr........',
      '.....RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.....',
      '........wwwwwwwrrrrrrrrrwwwwwwww........',
      '........wwwffwwreededeerwwwffwww........',
      '........wwfgGfwredeeederwwfgGfww........',
      '........wwfggfwreedddeerwwfggfww........',
      '........wwwffwwreedddeerwwwffwww........',
      '........WWWWWWWrrrrrrrrrWWWWWWWW........',
      '........wwwffwwwwwddddwwwwwffwww........',
      '...LL...wwfgGfwwwddddddwwwfgGfww..LL....',
      '..LLLL..wwfggfwwwddddydwwwfggfww.LLLL...',
      '..LpLLL.wwwffwwwwddddddwwwwffwww.LpLLL..',
      '..LLLpL.WWWWWWWWWddddddWWWWWWWWW.LLLpL..',
      '..lllllllllllllllsssssslllllllllllllll..',
      '..llllllllllllllssssssssllllllllllllll..',
      '..LLLLLLLLLLLLLLssssssssLLLLLLLLLLLLLL..'] },
    rescue: { pal: { r: 'PX Coral', R: 'PX Jungle Parrot Red', b: 'PX Jungle Bark', e: 'Cloud White', h: 'PX Candy Pink', w: 'PX Cream', W: 'PX Khaki', f: 'Ink', g: 'PX Lamp Warm', d: 'PX Sky Blue', y: 'Star Gold', m: 'PX Mint', a: 'PX Waffle', A: 'PX Khaki Shade' }, rows: [
      '........................................',
      '..........................bb............',
      '..........................bb............',
      '...................eeeeee.bb............',
      '.................reehhehher.............',
      '...............rrreehhhhherrr...........',
      '.............rrrrreeehhheerrrrr.........',
      '...........rrrrrrrreeeheerrrrrrrr.......',
      '..........RRRRRRRRRRRRRRRRRRRRRRRR......',
      '.............wwwwwwwwwwwwwwwwww.........',
      '.............wwffffwwwwwwffffww.........',
      '.............wwfggfwwddwwfggfww.........',
      '.....mmmmmm..wwfggfwddddwfggfww.........',
      '....mmmhmmmm.wwffffwdddywffffww...LL....',
      '...aAaAaAaAaAwwwwwwwddddwwwwwww..LLLL...',
      '...AaAaAaAaAawwwwwwwddddwwwwwww..LpLLL..',
      '....aAaAaAaA.WWWWWWWWWWWWWWWWWW..LLLpL..',
      '..lllAaAaAallllllllsssssslllllllllllll..',
      '..lllllllllllllllllsssssslllllllllllll..',
      '..LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL..'] },
    memories: { pal: { n: 'Night Mid', N: 'PX Night Haze', s: 'Gold Light', t: 'Cloud White', y: 'Star Gold', G: 'Cloud White', c: 'PX Castle Banner', e: 'Cloud White', L: 'PX Lilac', h: 'PX Candy Pink' }, rows: [
      '............nnnnnnnnnnnnnnnn............',
      '.........nnnnnnnnnnsnnnnnnnnnnn.........',
      '.......nnnnnnnnnnnnynnnnnnnnnsnnn.......',
      '......nnsnnnnnnnnnyyynnnnnnnstsnnn......',
      '.....nnstsnnnnnnnyyyyynnnnnnnsnnnnn.....',
      '.....nnnsnnnnnnsyyyGyyysnnnnnnnnnnn.....',
      '....nnnnnnnnnnnnnyyyyynnnnnnnnnnnnnn....',
      '....nnnnnnnnnnnnnnyyynnnnnnnnnnnnnnn....',
      '....nnnnnnnnnnnnnnnynnnnnnnnnnnnsnnn....',
      '....nnnnnsnnnnnnnnnsnnnnnnnnnnnstsnn....',
      '....nnnnstsnnnnnnnnnnnnnnnnnnnnnsnnn....',
      '....nnnnnsnnnnnnnnnnnnnnnnnnnnnnnnnn....',
      '....NNNNNNccccccccccNNccccccccccNNNN....',
      '....NNNNNceeeeeeeeeccceeeeeeeeeecNNN....',
      '....NNNNNceLLLLLLeeeceeeeeheheeecNNN....',
      '....NNNNNceeeeeeeeeeceeeeehhheeecNNN....',
      '....NNNNNceLLLLLeeeeceeeeeeheeeecNNN....',
      '....NNNNNceeeeeeeeeeceeeeeeeeeeecNNN....',
      '....NNNNNccccccccccccccccccccccccNNN....',
      '....NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN....'] }
  };
  var HEADER_KINDS = Object.keys(HEADERS);
  /* the ink ring is drawn inside the 40 × 20 frame (its outer row and column are cropped) */
  function header(kind) {
    if (!own(HEADERS, kind) || !ready()) return '';
    var H = HEADERS[kind], pal = {}, k, rows = ringed(H.rows, 'o').slice(1, -1).map(function (r) { return r.slice(1, -1); });
    for (k in GREEN) pal[k] = GREEN[k];
    for (k in H.pal) pal[k] = H.pal[k];
    return svg('header', 120, 60, '<g class="slw-head-' + kind + '">' + draw(rows, pal, 3, 0, 0) + '</g>');
  }
  /* the Memory Book picture: the pet in its outfit (ART.pet) under a night arch with its star */
  function memory(petId, o) {
    var A = art();
    if (!A || !look() || typeof A.pet !== 'function' || typeof petId !== 'string' || !/^pet_/.test(petId)) return '';
    var m = /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(A.pet(petId, { acc: (o && o.acc) || {} }) || ''), rows = [], y, i;
    for (y = 0; y < 20; y++) { i = [6, 3, 2, 1, 1][y] || 0; rows.push(new Array(i + 1).join('.') + new Array(25 - 2 * i).join(y < 15 ? 'n' : 'N') + new Array(i + 1).join('.')); }
    return svg('memory', 120, 100, '<g class="slw-memory">' + draw(rows, { n: 'Night Mid', N: 'PX Night Haze' }, 5, 0, 0) +
      draw(STAR, { s: 'Gold Light', y: 'Star Gold', G: 'Cloud White' }, 3, 8, 8) + draw(['.s.', 'sts', '.s.'], { s: 'Gold Light', t: 'Cloud White' }, 3, 94, 14) +
      (m ? '<g>' + m[1] + '</g>' : '') + '</g>');
  }

  function freeze(v) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.keys(v).forEach(function (k) { freeze(v[k]); }); }
    return v;
  }
  return freeze({ VERSION: VERSION, GRID: GRID, SLOTS: SLOTS, HEAD_KEYS: HEAD_KEYS, SPECIES_IDS: SPECIES_IDS, SPRITES: SPRITES, ANCHORS: ANCHORS,
    FOOD_IDS: FOOD_IDS, FOODS: FOODS, GROUPS: GROUPS, PILE: PILE, BADGES: BADGES, BADGE: BADGE, STAR: STAR,
    foodIcon: foodIcon, icon: icon, bowl: bowl, bit: bit, tummy: tummy, hearts: hearts, badge: badge, star: star,
    HEADERS: HEADERS, HEADER_GROUND: GREEN, HEADER_KINDS: HEADER_KINDS, header: header, memory: memory,
    register: function (art) {
      if (!art || typeof art.definePix !== 'function') return [];
      return SPECIES_IDS.filter(function (id) { var s = SPRITES[id]; return art.definePix(id, { frames: s.frames, pal: s.pal, anchors: s.anchors, head: s.head }) !== false; });
    } });
}));
