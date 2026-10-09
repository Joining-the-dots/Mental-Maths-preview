/* ================================================================
   My Island — core logic (pure; no DOM).
   Loaded in the browser as window.SLWorldCore and in Node tests via
   require(). Everything that decides money, ownership, placement,
   arcade time or personal bests lives here so it can be tested.

   Points: the island spends the app's EXISTING spendable balance
   (u.points). It never touches u.pointsEarned (lifetime), never awards
   points, and keeps an audit ledger of every purchase in u.world.

   v3 (My Island in the sky): Home Island stays exactly as V4.54 (w.placed,
   REGIONS). Five lands each unlock a floating sky island whose placements
   live ONLY in w.isles[isle].placed. A V4.53/V4.54 save loads byte-identical
   (nothing is added until the first v3-only write), and an old cached client
   never reads w.isles / w.goal3, so it can never move or lose them.

   Land shops: each land also sells two mascot animals and four pieces of
   gear. w.pets, w.activePet and every pet's acc hold ONLY V4.54 ids, always:
   mascots and land gear live in w.crew3, which an old client never reads, so
   it can never meet a pet or an accessory it does not know.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLWorldCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 3;            /* w.v of a brand-new profile; an old save gets 3 only at its first v3-only write */
  var COLS = 16, ROWS = 10;

  /* ---------------- economy (see docs/REWARDS_WORLD.md §3) ---------------- */
  var ECONOMY = {
    sessionPts: 120,          /* representative ~25-minute learning session */
    confirmAt: 300,           /* purchases at/above this ask "are you sure?" */
    ledgerCloudCap: 1000,
    trialMaxCopies: 0         /* free test mode: no cap on copies (0 = unlimited; the cloud copy keeps the last 1,000 ledger rows) */
  };

  /* ---------------- land ---------------- */
  /* row -> [fromCol, toCol] inclusive */
  var REGIONS = {
    home:   { name: 'Home Island', rows: { 1: [4, 10], 2: [3, 11], 3: [2, 12], 4: [2, 12], 5: [2, 12], 6: [2, 12], 7: [3, 11], 8: [4, 10] } },
    cove:   { name: 'Beach Cove',  unlock: 'land_cove',   rows: { 2: [12, 14], 3: [13, 15], 4: [13, 15], 5: [13, 15], 6: [13, 15], 7: [12, 14] } },
    meadow: { name: 'Meadow Hill', unlock: 'land_meadow', rows: { 2: [0, 2], 3: [0, 1], 4: [0, 1], 5: [0, 1], 6: [0, 1], 7: [0, 2], 8: [1, 3] } }
  };
  function regionCells(key) {
    var out = [], r = REGIONS[key].rows;
    Object.keys(r).forEach(function (row) {
      for (var c = r[row][0]; c <= r[row][1]; c++) out.push(c + ',' + row);
    });
    return out;
  }
  var REGION_CELLS = {};
  var CELL_REGION = {};
  Object.keys(REGIONS).forEach(function (k) {
    REGION_CELLS[k] = regionCells(k);
    REGION_CELLS[k].forEach(function (ck) { CELL_REGION[ck] = k; });
  });

  /* ---------------- islands (v3: Home Island + five floating sky islands) ----------------
     Home Island is the grid above (REGIONS, COLS × ROWS, w.placed), unchanged. Each sky
     island has its own island-local grid, and its placements live ONLY in
     w.isles[isle].placed. An island is unlocked when its land is owned (derived from
     w.owned, never from w.isles). Render data (world positions, bridges, camera poses)
     lives in SLGrid3D.ISLE_LAYOUT — never here and never in a save.
       cells         row -> [fromCol, toCol] inclusive (the REGIONS row format)
       dock          bridge landing cells: land on the dockSide edge, paths only
       landmarkSpot  where purchase() drops the landmark; centre = findSpot's preference
     Every sky grid is ≤ 16 × 10, so Home-sized arrays take any island in its own frame. */
  var ISLE_ORDER = ['home', 'pier', 'jungle', 'treetop', 'castle', 'ice'];
  var LEGACY_SKY = false;     /* V4.54 ids stay Home-only: an old client counts only w.placed, so a sky copy would look stored */
  var ISLES = {
    home:    { id: 'home', name: 'Home Island', size: [COLS, ROWS], unlock: null, landmark: null,
               cells: null, cellCount: 0,                /* filled from REGIONS (home + cove + meadow) below */
               dock: [], dockSide: null, landmarkSpot: null, centre: [7, 5] },
    /* the land-shop sizes: each island holds its landmark, one of every one-off of its own shop and walkways from the dock */
    pier:    { id: 'pier', name: 'Theme Park Pier', size: [16, 10], unlock: 'land_pier', landmark: 'lm_pier_wheel',
               cells: { 0: [3, 13], 1: [2, 14], 2: [1, 15], 3: [1, 15], 4: [1, 15], 5: [2, 14], 6: [6, 9], 7: [6, 9], 8: [3, 12], 9: [3, 12] }, cellCount: 110,
               dock: [[1, 3]], dockSide: 'w', landmarkSpot: [4, 0], centre: [8, 3] },
    jungle:  { id: 'jungle', name: 'Jungle Treehouse Village', size: [10, 9], unlock: 'land_jungle', landmark: 'lm_jungle_treehouse',
               cells: { 0: [3, 6], 1: [2, 8], 2: [1, 8], 3: [1, 9], 4: [0, 8], 5: [0, 8], 6: [1, 8], 7: [2, 7], 8: [3, 6] }, cellCount: 64,
               dock: [[9, 3]], dockSide: 'e', landmarkSpot: [3, 1], centre: [4, 4] },
    treetop: { id: 'treetop', name: 'Treetop Adventure Park', size: [10, 8], unlock: 'land_treetop', landmark: 'lm_treetop_lookout',
               cells: { 0: [1, 7], 1: [0, 8], 2: [0, 8], 3: [0, 8], 4: [0, 8], 5: [0, 8], 6: [1, 8], 7: [3, 7] }, cellCount: 65,
               dock: [[8, 6]], dockSide: 's', landmarkSpot: [2, 1], centre: [4, 4] },
    castle:  { id: 'castle', name: 'Medieval Castle', size: [12, 8], unlock: 'land_castle', landmark: 'lm_castle_keep',
               cells: { 0: [2, 9], 1: [1, 10], 2: [0, 11], 3: [0, 11], 4: [0, 11], 5: [1, 10], 6: [2, 9], 7: [5, 6] }, cellCount: 74,
               dock: [[5, 7], [6, 7]], dockSide: 's', landmarkSpot: [4, 0], centre: [5, 4] },
    ice:     { id: 'ice', name: 'Penguin Ice Village', size: [12, 7], unlock: 'land_ice', landmark: 'lm_ice_igloo',
               cells: { 0: [3, 8], 1: [1, 9], 2: [0, 10], 3: [0, 11], 4: [0, 11], 5: [1, 10], 6: [2, 7] }, cellCount: 66,
               dock: [[1, 5]], dockSide: 's', landmarkSpot: [4, 1], centre: [5, 3] }
  };
  var ISLE_CELLS = {};        /* isle -> ['x,y', …] (Home: every region cell, locked or not) */
  var ISLE_LAND = {};         /* isle -> {'x,y': 1}  (internal, frozen) */
  var ISLE_DOCK = {};         /* isle -> {'x,y': 1}  (internal, frozen) */
  ISLE_ORDER.forEach(function (k) {
    var d = ISLES[k], list = [];
    if (k === 'home') {
      var rows = {};
      Object.keys(REGIONS).forEach(function (r) { list = list.concat(REGION_CELLS[r]); });
      list.forEach(function (c) {
        var x = +c.split(',')[0], y = +c.split(',')[1];
        rows[y] = rows[y] ? [Math.min(rows[y][0], x), Math.max(rows[y][1], x)] : [x, x];
      });
      d.cells = rows; d.cellCount = list.length;
    } else {
      Object.keys(d.cells).forEach(function (row) { for (var c = d.cells[row][0]; c <= d.cells[row][1]; c++) list.push(c + ',' + row); });
    }
    ISLE_CELLS[k] = list;
    ISLE_LAND[k] = {}; list.forEach(function (c) { ISLE_LAND[k][c] = 1; });
    ISLE_DOCK[k] = {}; d.dock.forEach(function (xy) { ISLE_DOCK[k][xy[0] + ',' + xy[1]] = 1; });
  });
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }
  [ISLE_ORDER, ISLES, ISLE_CELLS, ISLE_LAND, ISLE_DOCK].forEach(deepFreeze);
  /* kid copy for the island rules (the same words as SLWorldCopy's isle.* / edit.* keys) */
  var ISLE_TEXT = {
    noIsle: 'That island isn’t there.',
    locked: 'That island is still locked.',
    homeOnly: 'Home things stay on Home Island.',
    wrongIsle: 'This one belongs on {island}.',
    dock: 'Keep the bridge landing clear.',
    otherIsle: 'Put it away first, then place it on the other island.',
    landmarkStays: 'This one stays on its island — you can move it instead.'
  };

  /* ---------------- catalogue ----------------
     Stable ids — never rename or reuse an id. Retire with retired:true
     (owners keep it; it just leaves the shop).
     kind:   decor (per copy) | path (per copy, ground) | fun (unique, interactive)
             house (the home itself) | style (unique, selectable house look)
             pet | acc (pet accessory) | land | attraction | variant (game course/track)
             cosmetic (ball / stadium / kart)
     slot:   for style/cosmetic/variant — what it replaces when selected
             (style slots: wall | roof | door | detail | shape — 'shape' is the whole
             house form; the roof then dresses that shape's crown)
     cat:    shop tab; 'city' = the collectable city buildings (kind fun); 'sky' = sky-island themed items
     fp:     footprint [w,h] in cells for placeable kinds
     act:    what tapping it does on the island (one of ACTS, or no act key)
     v3 (appended after the 104 V4.54 entries, which never change):
     isle:    the island a v3 item belongs to (for a land: the island it unlocks); marks a v3 id
     placeOn: 'own' (its own island only) | 'any' (Home or any unlocked sky island)
     kind:    + landmark (comes with its land, auto-placed, never sold, never stored)
     joins:   castle_wall picks a piece from its neighbours (render-only)
     A pet with an isle is a land's mascot and an acc with an isle is land gear: both need
     their land, and both are kept in w.crew3, never in w.pets (see the crew section).
     The shop shelves and the act facts are tables (ISLE_SHELVES, ACT_INFO), not fields. */
  var CATALOG = [
    /* ---- starter (free, granted once) ---- */
    { id: 'house_cottage', kind: 'house', name: 'Your Home', price: 0, starter: true, fp: [2, 2], entrance: true, act: 'home', includes: ['shape_cottage', 'shape_loft'], desc: 'Your very own home. Tap it to change its colours.' },
    { id: 'att_course', kind: 'attraction', game: 'course', name: 'Pet Obstacle Course', price: 0, starter: true, fp: [2, 2], entrance: true, act: 'launch', includes: ['course_meadow'], desc: 'Your pet’s own obstacle course. Tap the gate to play — free, forever.' },
    { id: 'pet_puppy', kind: 'pet', name: 'Puppy', price: 0, starter: true, desc: 'Your first pet! Loyal, bouncy and always pleased to see you.' },
    { id: 'wall_cream', kind: 'style', slot: 'wall', name: 'Cream walls', price: 0, starter: true, desc: 'Warm and cosy.' },
    { id: 'roof_red', kind: 'style', slot: 'roof', name: 'Red tile roof', price: 0, starter: true, desc: 'A classic red roof.' },
    { id: 'door_blue', kind: 'style', slot: 'door', name: 'Blue door', price: 0, starter: true, desc: 'A bright blue front door.' },
    /* the two free home shapes come with the house (never sold); the loft is the default */
    { id: 'shape_cottage', kind: 'style', slot: 'shape', cat: 'home', name: 'Classic cottage', price: 0, included: true, desc: 'The original gabled cottage. Switch back to it any time.' },
    { id: 'shape_loft', kind: 'style', slot: 'shape', cat: 'home', name: 'City loft', price: 0, included: true, desc: 'Two stacked boxes, a cantilevered top floor and a wall of glass.' },
    { id: 'course_meadow', kind: 'variant', game: 'course', slot: 'course', name: 'Meadow Dash', price: 0, included: true, desc: 'Grassy hills, hurdles and logs.' },

    /* ---- garden: per copy ---- */
    { id: 'flower_tulip', kind: 'decor', cat: 'garden', name: 'Tulips', price: 40, fp: [1, 1], desc: 'A bunch of bright tulips. Buy as many as you like.' },
    { id: 'flower_daisy', kind: 'decor', cat: 'garden', name: 'Daisy patch', price: 40, fp: [1, 1], desc: 'A cheerful patch of daisies.' },
    { id: 'flower_sun', kind: 'decor', cat: 'garden', name: 'Sunflowers', price: 50, fp: [1, 1], desc: 'Tall sunflowers that follow the sun.' },
    { id: 'bush_rose', kind: 'decor', cat: 'garden', name: 'Rose bush', price: 70, fp: [1, 1], desc: 'A round bush full of pink roses.' },
    { id: 'rock_mossy', kind: 'decor', cat: 'garden', name: 'Mossy rock', price: 40, fp: [1, 1], desc: 'A friendly, mossy boulder.' },
    { id: 'tree_oak', kind: 'decor', cat: 'garden', name: 'Oak tree', price: 120, fp: [1, 1], desc: 'A big leafy oak tree.' },
    { id: 'tree_pine', kind: 'decor', cat: 'garden', name: 'Pine tree', price: 110, fp: [1, 1], desc: 'A tall evergreen pine.' },
    { id: 'tree_apple', kind: 'decor', cat: 'garden', name: 'Apple tree', price: 150, fp: [1, 1], desc: 'Covered in shiny red apples.' },
    { id: 'tree_blossom', kind: 'decor', cat: 'garden', name: 'Blossom tree', price: 160, fp: [1, 1], desc: 'Fluffy pink blossom all year round.' },
    { id: 'tree_palm', kind: 'decor', cat: 'garden', name: 'Palm tree', price: 140, fp: [1, 1], desc: 'A swaying palm — perfect by the sea.' },
    { id: 'lantern', kind: 'decor', cat: 'lights', name: 'Lantern post', price: 90, fp: [1, 1], act: 'glow', desc: 'Tap it to switch the light on and off.' },
    { id: 'mushroom_glow', kind: 'decor', cat: 'lights', name: 'Glowing mushrooms', price: 90, fp: [1, 1], act: 'glow', desc: 'Magic mushrooms that glow when you tap them.' },
    { id: 'flag_pole', kind: 'decor', cat: 'flags', name: 'Island flag', price: 100, fp: [1, 1], act: 'wave', desc: 'Your island’s own flag. Tap it to make it flutter.' },
    { id: 'bunting', kind: 'decor', cat: 'flags', name: 'Party bunting', price: 80, fp: [1, 1], act: 'wave', desc: 'Colourful bunting on two little posts.' },
    { id: 'bench', kind: 'decor', cat: 'garden', name: 'Garden bench', price: 110, fp: [1, 1], desc: 'A comfy wooden bench.' },
    { id: 'sandcastle', kind: 'decor', cat: 'garden', name: 'Sandcastle', price: 120, fp: [1, 1], desc: 'A sandcastle with a tiny flag on top.' },
    { id: 'umbrella', kind: 'decor', cat: 'garden', name: 'Beach umbrella', price: 130, fp: [1, 1], desc: 'Stripy shade for sunny days.' },
    { id: 'snowman', kind: 'decor', cat: 'garden', name: 'Snowman', price: 150, fp: [1, 1], desc: 'A snowman that never melts.' },
    { id: 'windmill', kind: 'decor', cat: 'garden', name: 'Windmill', price: 380, fp: [1, 1], act: 'spin', desc: 'Its sails turn in the breeze. Tap for a big spin!' },
    { id: 'lighthouse', kind: 'decor', cat: 'garden', name: 'Lighthouse', price: 650, fp: [1, 1], act: 'glow', desc: 'A red-and-white lighthouse with a beaming light.' },

    /* ---- paths: per copy, ground layer ---- */
    { id: 'path_stone', kind: 'path', cat: 'paths', name: 'Stone path', price: 20, fp: [1, 1], desc: 'One square of stone path.' },
    { id: 'path_wood', kind: 'path', cat: 'paths', name: 'Wooden boardwalk', price: 25, fp: [1, 1], desc: 'One square of wooden boardwalk.' },
    { id: 'path_flower', kind: 'path', cat: 'paths', name: 'Flower stepping stones', price: 30, fp: [1, 1], desc: 'Stepping stones with little flowers between.' },

    /* ---- fun: unique, interactive ---- */
    { id: 'trampoline', kind: 'fun', cat: 'fun', name: 'Trampoline', price: 450, fp: [1, 1], act: 'bounce', desc: 'Tap it and your pet bounces! Boing!' },
    { id: 'fountain', kind: 'fun', cat: 'fun', name: 'Fountain', price: 500, fp: [1, 1], act: 'splash', desc: 'Tap for a big splashy water show.' },
    { id: 'swing', kind: 'fun', cat: 'fun', name: 'Tree swing', price: 380, fp: [1, 1], act: 'swing', desc: 'Tap to give it a swing.' },
    { id: 'bubbles', kind: 'fun', cat: 'fun', name: 'Bubble machine', price: 300, fp: [1, 1], act: 'bubbles', desc: 'Tap it to fill the air with bubbles.' },

    /* ---- home styles: unique, choose any time once owned ---- */
    { id: 'wall_pink', kind: 'style', slot: 'wall', cat: 'home', name: 'Pink walls', price: 120, desc: 'Strawberry-milkshake pink.' },
    { id: 'wall_mint', kind: 'style', slot: 'wall', cat: 'home', name: 'Mint walls', price: 120, desc: 'Cool minty green.' },
    { id: 'wall_sky', kind: 'style', slot: 'wall', cat: 'home', name: 'Sky-blue walls', price: 120, desc: 'As blue as a summer sky.' },
    { id: 'wall_lilac', kind: 'style', slot: 'wall', cat: 'home', name: 'Lilac walls', price: 150, desc: 'A soft purple.' },
    { id: 'wall_concrete', kind: 'style', slot: 'wall', cat: 'home', name: 'Concrete walls', price: 120, desc: 'Smooth grey concrete. Very city.' },
    { id: 'wall_gallery', kind: 'style', slot: 'wall', cat: 'home', name: 'Gallery white walls', price: 120, desc: 'Crisp off-white, like a gallery.' },
    { id: 'wall_graphite', kind: 'style', slot: 'wall', cat: 'home', name: 'Graphite walls', price: 150, desc: 'Dark graphite that makes neon pop.' },
    { id: 'wall_midnight', kind: 'style', slot: 'wall', cat: 'home', name: 'Midnight blue walls', price: 180, desc: 'Deep blue, best after dark.' },
    { id: 'roof_blue', kind: 'style', slot: 'roof', cat: 'home', name: 'Blue slate roof', price: 300, desc: 'Smart blue slates.' },
    { id: 'roof_thatch', kind: 'style', slot: 'roof', cat: 'home', name: 'Thatched roof', price: 350, desc: 'A fluffy straw roof, like a storybook cottage.' },
    { id: 'roof_candy', kind: 'style', slot: 'roof', cat: 'home', name: 'Candy roof', price: 450, desc: 'Pink icing with sprinkles on top.' },
    { id: 'roof_castle', kind: 'style', slot: 'roof', cat: 'home', name: 'Castle turrets', price: 600, desc: 'Turn your home into a little castle.' },
    { id: 'door_red', kind: 'style', slot: 'door', cat: 'home', name: 'Red door', price: 80, desc: 'A bold red front door.' },
    { id: 'door_green', kind: 'style', slot: 'door', cat: 'home', name: 'Green door', price: 80, desc: 'A leafy green front door.' },
    { id: 'door_gold', kind: 'style', slot: 'door', cat: 'home', name: 'Golden door', price: 150, desc: 'A shiny golden door.' },
    { id: 'door_glass', kind: 'style', slot: 'door', cat: 'home', name: 'Smoked glass door', price: 160, desc: 'A dark glass door with a steel frame.' },
    { id: 'detail_windowbox', kind: 'style', slot: 'detail', multi: true, cat: 'home', name: 'Window boxes', price: 150, desc: 'Flower boxes under the windows.' },
    { id: 'detail_chimney', kind: 'style', slot: 'detail', multi: true, cat: 'home', name: 'Smoking chimney', price: 120, desc: 'A chimney with little puffs of smoke.' },
    { id: 'detail_lights', kind: 'style', slot: 'detail', multi: true, cat: 'home', name: 'Fairy lights', price: 200, desc: 'Twinkly lights along the roof.' },
    { id: 'detail_flag', kind: 'style', slot: 'detail', multi: true, cat: 'home', name: 'Rooftop flag', price: 100, desc: 'A flag flying from the roof.' },
    { id: 'detail_neon', kind: 'style', slot: 'detail', multi: true, cat: 'home', name: 'Neon roofline', price: 250, desc: 'A neon tube in your colour along every roof edge.' },
    /* paid home shapes: buying one selects it (walls, roof, door and extras carry over) */
    { id: 'shape_villa', kind: 'style', slot: 'shape', cat: 'home', name: 'Beach villa', price: 650, desc: 'Long and low, with a timber deck and its own plunge pool.' },
    { id: 'shape_tower', kind: 'style', slot: 'shape', cat: 'home', name: 'Neon tower', price: 950, desc: 'Three storeys, an outside stair and a neon sign with your initial.' },
    { id: 'shape_dome', kind: 'style', slot: 'shape', cat: 'home', name: 'Sky dome', price: 1250, desc: 'A round future home with portholes, a glowing ring and a sliding door.' },

    /* ---- pets & accessories ---- */
    { id: 'pet_kitten', kind: 'pet', cat: 'pets', name: 'Kitten', price: 600, desc: 'A playful kitten who loves to pounce.' },
    { id: 'pet_bunny', kind: 'pet', cat: 'pets', name: 'Bunny', price: 550, desc: 'A hoppy bunny with floppy ears.' },
    { id: 'pet_dragon', kind: 'pet', cat: 'pets', name: 'Baby dragon', price: 1400, desc: 'A tiny friendly dragon with little wings.' },
    { id: 'acc_partyhat', kind: 'acc', slot: 'hat', cat: 'pets', name: 'Party hat', price: 100, desc: 'A stripy party hat for any pet.' },
    { id: 'acc_crown', kind: 'acc', slot: 'hat', cat: 'pets', name: 'Golden crown', price: 250, desc: 'Fit for a royal pet.' },
    { id: 'acc_bow', kind: 'acc', slot: 'neck', cat: 'pets', name: 'Big bow', price: 100, desc: 'A big spotty bow.' },
    { id: 'acc_scarf', kind: 'acc', slot: 'neck', cat: 'pets', name: 'Cosy scarf', price: 120, desc: 'A stripy knitted scarf.' },
    { id: 'acc_shades', kind: 'acc', slot: 'face', cat: 'pets', name: 'Cool shades', price: 140, desc: 'Sunglasses for the coolest pet around.' },
    { id: 'acc_cape', kind: 'acc', slot: 'back', cat: 'pets', name: 'Super cape', price: 300, desc: 'A red hero cape that flaps when your pet runs.' },
    { id: 'acc_beanie', kind: 'acc', slot: 'hat', cat: 'pets', name: 'Beanie', price: 120, desc: 'A ribbed knit beanie. Bunny ears poke through.' },
    { id: 'acc_cap', kind: 'acc', slot: 'hat', cat: 'pets', name: 'Snapback', price: 160, desc: 'Worn backwards. The brim glows underneath after dark.' },
    { id: 'acc_headphones', kind: 'acc', slot: 'neck', cat: 'pets', name: 'Studio headphones', price: 180, desc: 'Worn round the neck, DJ-style. The rings glow on the beat.' },
    { id: 'acc_visor', kind: 'acc', slot: 'face', cat: 'pets', name: 'LED visor', price: 220, desc: 'A wraparound visor with a light that scans after dark.' },
    { id: 'acc_hoodie', kind: 'acc', slot: 'back', cat: 'pets', name: 'Hoodie', price: 260, desc: 'A graphite hoodie with neon drawstrings.' },

    /* ---- city buildings: unique, placeable, storable; tapping plays the act (never points) ---- */
    { id: 'bld_photobooth', kind: 'fun', cat: 'city', name: 'Photo Booth', price: 250, fp: [1, 1], act: 'snap', desc: 'Step in and strike a pose. Your pet gets a strip of four photos.' },
    { id: 'bld_boba', kind: 'fun', cat: 'city', name: 'Boba Café', price: 350, fp: [2, 1], act: 'serve', desc: 'A café crowned by a giant bubble-tea cup. Tap for a fresh order.' },
    { id: 'bld_ledtower', kind: 'fun', cat: 'city', name: 'LED Screen Tower', price: 450, fp: [1, 1], act: 'screen', desc: 'A steel mast with a giant screen. Tap it to switch the show.' },
    { id: 'bld_recording', kind: 'fun', cat: 'city', name: 'Recording Studio', price: 550, fp: [2, 1], act: 'record', desc: 'Giant headphones on the roof and an ON AIR sign. Tap to lay down a beat.' },
    { id: 'bld_dance', kind: 'fun', cat: 'city', name: 'Dance Studio', price: 950, fp: [2, 2], entrance: true, act: 'dance', desc: 'A glass-front studio with a light-up floor. Tap and your pet hits the floor.' },
    { id: 'bld_rooftop', kind: 'fun', cat: 'city', name: 'Rooftop Hangout', price: 1100, fp: [2, 2], act: 'hangout', desc: 'A brick warehouse with beanbags, string lights and a telescope on the roof.' },
    { id: 'bld_stage', kind: 'fun', cat: 'city', name: 'Concert Stage', price: 1450, fp: [3, 2], entrance: true, act: 'encore', desc: 'A real stage with a giant LED wall. Tap to bring the whole crew on.' },

    /* ---- land ---- */
    { id: 'land_cove', kind: 'land', region: 'cove', cat: 'land', name: 'Beach Cove', price: 1000, desc: 'A sandy bay on the east side of your island — 18 new squares to build on.' },
    { id: 'land_meadow', kind: 'land', region: 'meadow', cat: 'land', name: 'Meadow Hill', price: 900, desc: 'A green hill on the west side — 17 new squares to build on.' },

    /* ---- attractions (each includes everything needed to play) ---- */
    { id: 'att_pitch', kind: 'attraction', game: 'penalty', cat: 'games', name: 'Penalty Pitch', price: 1200, fp: [3, 2], entrance: true, act: 'launch', includes: ['ball_classic', 'stadium_day'],
      desc: 'A football pitch for your island. Unlocks the Encore Shootout game — forever.' },
    { id: 'att_kart', kind: 'attraction', game: 'kart', cat: 'games', name: 'Kart Garage', price: 1500, fp: [2, 2], entrance: true, act: 'launch', includes: ['track_loop', 'kart_red'],
      desc: 'A garage and race track entrance. Unlocks the Kart Time Trial game — forever.' },

    /* ---- course variants (pet obstacle course) ---- */
    { id: 'course_beach', kind: 'variant', game: 'course', slot: 'course', cat: 'games', name: 'Beach Run', price: 350, requires: ['att_course'], desc: 'A new course: sandy dunes, crabs and sandcastles.' },
    { id: 'course_snow', kind: 'variant', game: 'course', slot: 'course', cat: 'games', name: 'Snowy Trail', price: 400, requires: ['att_course'], desc: 'A new course: snowdrifts, sledges and snowmen.' },
    { id: 'course_candy', kind: 'variant', game: 'course', slot: 'course', cat: 'games', name: 'Candy Land', price: 500, requires: ['att_course'], desc: 'A new course: lollipops, cupcakes and sweet hurdles.' },

    /* ---- penalty cosmetics ---- */
    { id: 'ball_classic', kind: 'cosmetic', game: 'penalty', slot: 'ball', name: 'Classic ball', price: 0, included: true, desc: 'A black-and-white classic.' },
    { id: 'ball_rainbow', kind: 'cosmetic', game: 'penalty', slot: 'ball', cat: 'games', name: 'Rainbow ball', price: 200, requires: ['att_pitch'], desc: 'A ball in every colour of the rainbow.' },
    { id: 'ball_planet', kind: 'cosmetic', game: 'penalty', slot: 'ball', cat: 'games', name: 'Planet ball', price: 250, requires: ['att_pitch'], desc: 'A ball with its own little ring.' },
    { id: 'ball_gold', kind: 'cosmetic', game: 'penalty', slot: 'ball', cat: 'games', name: 'Golden ball', price: 300, requires: ['att_pitch'], desc: 'The shiniest ball in football.' },
    { id: 'stadium_day', kind: 'cosmetic', game: 'penalty', slot: 'stadium', name: 'Sunny stadium', price: 0, included: true, desc: 'Blue skies and a happy crowd.' },
    { id: 'stadium_night', kind: 'cosmetic', game: 'penalty', slot: 'stadium', cat: 'games', name: 'Floodlit night', price: 450, requires: ['att_pitch'], desc: 'Play under the stars and floodlights.' },
    { id: 'stadium_beach', kind: 'cosmetic', game: 'penalty', slot: 'stadium', cat: 'games', name: 'Beach stadium', price: 400, requires: ['att_pitch'], desc: 'Football by the sea.' },
    { id: 'stadium_snow', kind: 'cosmetic', game: 'penalty', slot: 'stadium', cat: 'games', name: 'Snowy stadium', price: 400, requires: ['att_pitch'], desc: 'A winter wonderland pitch.' },

    /* ---- kart cosmetics & tracks ---- */
    { id: 'kart_red', kind: 'cosmetic', game: 'kart', slot: 'kart', name: 'Red racer', price: 0, included: true, desc: 'A speedy red kart.' },
    { id: 'kart_blue', kind: 'cosmetic', game: 'kart', slot: 'kart', cat: 'games', name: 'Blue rocket', price: 300, requires: ['att_kart'], desc: 'A blue kart with rocket stripes.' },
    { id: 'kart_lime', kind: 'cosmetic', game: 'kart', slot: 'kart', cat: 'games', name: 'Lime lightning', price: 300, requires: ['att_kart'], desc: 'A zingy green kart with lightning bolts.' },
    { id: 'kart_unicorn', kind: 'cosmetic', game: 'kart', slot: 'kart', cat: 'games', name: 'Unicorn kart', price: 450, requires: ['att_kart'], desc: 'Pink, sparkly and very fast-looking.' },
    { id: 'kart_gold', kind: 'cosmetic', game: 'kart', slot: 'kart', cat: 'games', name: 'Golden kart', price: 500, requires: ['att_kart'], desc: 'For true champions.' },
    { id: 'track_loop', kind: 'variant', game: 'kart', slot: 'track', name: 'Island Loop', price: 0, included: true, desc: 'A friendly loop round the island.' },
    { id: 'track_volcano', kind: 'variant', game: 'kart', slot: 'track', cat: 'games', name: 'Volcano Ring', price: 800, requires: ['att_kart'], desc: 'A twisty new track around a smoking volcano.' },
    { id: 'track_beach', kind: 'variant', game: 'kart', slot: 'track', cat: 'games', name: 'Beach Hairpins', price: 700, requires: ['att_kart'], desc: 'A new track with tight hairpin bends by the sea.' },

    /* ---- v3 sky islands, in ISLE_ORDER: the land, its landmark (free with it), then 4 themed items ---- */
    { id: 'land_pier', kind: 'land', isle: 'pier', cat: 'land', name: 'Theme Park Pier', price: 2000, includes: ['lm_pier_wheel'], desc: 'A floating seaside pier with rides, beach huts and a boardwalk. The Big Wheel comes with it.' },
    { id: 'lm_pier_wheel', kind: 'landmark', isle: 'pier', placeOn: 'own', name: 'Big Wheel', price: 0, included: true, fp: [3, 2], entrance: true, act: 'wheel', desc: 'A giant wheel of gondolas high above the boardwalk. Tap it and your pet rides a slow loop.' },
    { id: 'pier_carousel', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Sea-creature carousel', price: 650, fp: [2, 2], act: 'ride', desc: 'Dolphins, turtles and seahorses going round. Tap it and your pet hops on for a spin.' },
    { id: 'pier_helter', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Helter-skelter', price: 550, fp: [1, 1], act: 'slide', desc: 'A striped spiral slide. Tap it and your pet whizzes down on a mat.' },
    { id: 'pier_beachhut', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Beach hut', price: 130, fp: [1, 1], act: 'open', desc: 'A stripy seaside hut. Tap to swing the doors open. Line up as many as you like.' },
    { id: 'path_pier', kind: 'path', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Pier planks', price: 25, fp: [1, 1], desc: 'One square of sun-bleached pier boards.' },

    { id: 'land_jungle', kind: 'land', isle: 'jungle', cat: 'land', name: 'Jungle Treehouse Village', price: 1800, includes: ['lm_jungle_treehouse'], desc: 'A floating jungle with huts high in the trees and a waterfall pool. The Great Treehouse comes with it.' },
    { id: 'lm_jungle_treehouse', kind: 'landmark', isle: 'jungle', placeOn: 'own', name: 'Great Treehouse', price: 0, included: true, fp: [3, 3], entrance: true, act: 'lift', desc: 'Three decks, rope walkways and a pulley lift. Tap it to send your pet up to the top deck.' },
    { id: 'jungle_stilthut', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Stilt hut', price: 180, fp: [1, 1], act: 'glow', desc: 'A leaf-roofed hut on stilts. Tap to light the lamp. Build a whole village.' },
    { id: 'jungle_vineswing', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Vine swing', price: 380, fp: [1, 1], act: 'swing', desc: 'Tap it and your pet swings across on a jungle vine.' },
    { id: 'jungle_falls', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'own', requires: ['land_jungle'], name: 'Jungle waterfall', price: 600, fp: [2, 1], act: 'splash', desc: 'A rock pool with its own waterfall. Tap for a splash. Lives on the Jungle Treehouse Village only.' },
    { id: 'path_logs', kind: 'path', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Log steps', price: 25, fp: [1, 1], desc: 'Round log stepping stones, one square at a time.' },

    { id: 'land_treetop', kind: 'land', isle: 'treetop', cat: 'land', name: 'Treetop Adventure Park', price: 1800, includes: ['lm_treetop_lookout'], desc: 'A floating forest built for climbing, bouncing and zipping. The Treetop Lookout comes with it.' },
    { id: 'lm_treetop_lookout', kind: 'landmark', isle: 'treetop', placeOn: 'own', name: 'Treetop Lookout', price: 0, included: true, fp: [3, 3], entrance: true, act: 'zip', desc: 'A tower in the treetops with a zip line. Tap it and your pet zips to the landing post.' },
    { id: 'treetop_bridge', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Rope bridge', price: 400, fp: [2, 1], act: 'wobble', desc: 'A wobbly rope bridge between two posts. Tap it and your pet edges across.' },
    { id: 'treetop_net', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Bounce net', price: 650, fp: [2, 2], act: 'bounce', desc: 'A giant net strung between four trees. Tap it for big bounces.' },
    { id: 'treetop_platform', kind: 'decor', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Platform tree', price: 170, fp: [1, 1], act: 'climb', desc: 'A tall tree with a wooden deck round the trunk. Tap it and your pet climbs up to wave.' },
    { id: 'path_bark', kind: 'path', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Bark trail', price: 20, fp: [1, 1], desc: 'One square of soft bark-chip trail.' },

    { id: 'land_castle', kind: 'land', isle: 'castle', cat: 'land', name: 'Medieval Castle', price: 2200, includes: ['lm_castle_keep'], desc: 'A floating castle island with towers, banners and a moat. The Castle Keep comes with it.' },
    { id: 'lm_castle_keep', kind: 'landmark', isle: 'castle', placeOn: 'own', name: 'Castle Keep', price: 0, included: true, fp: [4, 3], entrance: true, act: 'drawbridge', desc: 'Four towers and a drawbridge. Tap it to lower the bridge, banners up, fanfare on.' },
    { id: 'castle_wall', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Castle wall', price: 60, fp: [1, 1], joins: true, act: 'knock', desc:'Battlement blocks that join up as you build. Wall in a garden, a path or a whole island.' },
    { id: 'castle_maypole', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Maypole', price: 450, fp: [1, 1], act: 'dance', desc: 'Ribbons and a flower crown. Tap it and your crew dance round it.' },
    { id: 'castle_feast', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Feast table', price: 550, fp: [2, 1], act: 'serve', desc: 'A long table of pies, fruit and cake. Tap it to serve up.' },
    { id: 'path_cobble', kind: 'path', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Cobblestones', price: 25, fp: [1, 1], desc: 'One square of chunky cobbles.' },

    { id: 'land_ice', kind: 'land', isle: 'ice', cat: 'land', name: 'Penguin Ice Village', price: 1500, includes: ['lm_ice_igloo'], desc: 'A floating snowy island where penguins live. The Great Igloo comes with it.' },
    { id: 'lm_ice_igloo', kind: 'landmark', isle: 'ice', placeOn: 'own', name: 'Great Igloo', price: 0, included: true, fp: [3, 2], entrance: true, act: 'penguins', desc: 'The penguins’ home. Tap it and they waddle out and belly-slide down the ramp.' },
    { id: 'ice_snowhut', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Snow hut', price: 150, fp: [1, 1], act: 'glow', desc: 'A snow hut with a warm lamp inside. Tap to light it. Build a whole village.' },
    { id: 'ice_slide', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Ice slide', price: 450, fp: [2, 1], act: 'slide', desc: 'A slippery ice slope. Tap it and your pet slides down on its tummy.' },
    { id: 'ice_rink', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'own', requires: ['land_ice'], name: 'Ice rink', price: 650, fp: [2, 2], act: 'skate', desc: 'A pond iced over for skating. Tap it and your pet does laps. Lives on the Penguin Ice Village only.' },
    { id: 'path_ice', kind: 'path', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Ice tiles', price: 25, fp: [1, 1], desc: 'One square of frosty blue ice tiles.' },

    /* ---- v3 land shops (wave 1b), land by land in ISLE_ORDER: the new themed items in shelf order, the two mascots, the four pieces of gear ---- */
    /* Theme Park Pier */
    { id: 'pier_mirrors', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Wobbly mirrors', price: 300, fp: [1, 1], act: 'mirrors', desc: 'Three bendy mirrors in a striped booth. Tap it and your pet goes tall and thin, then short and wide.' },
    { id: 'pier_droptower', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Drop tower', price: 450, fp: [1, 1], act: 'droptower', desc: 'A striped tower with a ring of seats. Tap it: up to the top, a short wait, then a soft drop and a bounce.' },
    { id: 'pier_teacups', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Spinning teacups', price: 750, fp: [2, 2], act: 'teacups', desc: 'Giant teacups on a turning floor. Tap it and your pet whirls round in the pink one.' },
    { id: 'pier_flyingchairs', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Flying chairs', price: 850, fp: [2, 2], act: 'chairs', desc: 'Chairs on chains under a striped top. Tap it and your pet swings out wide as it turns.' },
    { id: 'pier_swingship', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Swinging ship', price: 950, fp: [3, 1], act: 'swingship', desc: 'A big boat that swings like a pendulum. Tap it and your pet waves from the front as it swoops.' },
    { id: 'pier_train', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'own', requires: ['land_pier'], name: 'Seaside mini train', price: 1050, fp: [3, 2], act: 'train', desc: 'A seaside train on its own loop of track. Tap it for a lap through the tunnel. Lives on the Theme Park Pier only.' },
    { id: 'pier_dodgems', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'own', requires: ['land_pier'], name: 'Dodgems', price: 1150, fp: [3, 2], act: 'dodgems', desc: 'Bumper cars on a striped floor. Tap it and your pet takes the yellow car. Lives on the Theme Park Pier only.' },
    { id: 'pier_flume', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'own', requires: ['land_pier'], name: 'Log flume', price: 1300, fp: [3, 2], act: 'flume', desc: 'Log boats ride the water channel and tip over the drop. Tap for a splash. Lives on the Theme Park Pier only.' },
    { id: 'pier_coaster', kind: 'fun', cat: 'sky', isle: 'pier', placeOn: 'own', requires: ['land_pier'], name: 'Loop-the-loop coaster', price: 1450, fp: [4, 2], act: 'coaster', desc: 'A candy-pink coaster with one big loop. Tap it and your pet loops the loop. Lives on the Theme Park Pier only.' },
    { id: 'pier_candyfloss', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Candy-floss cart', price: 140, fp: [1, 1], act: 'floss', desc: 'A cart that spins sugar into pink clouds. Tap it and one grows on a stick for your pet.' },
    { id: 'pier_popcorn', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Popcorn cart', price: 160, fp: [1, 1], act: 'popcorn', desc: 'A red-and-white cart with a glass case of popping corn. Tap it and a fresh bag pops out.' },
    { id: 'pier_icecream', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Ice-cream kiosk', price: 180, fp: [1, 1], act: 'scoop', desc: 'A striped kiosk with a giant cone on the roof. Tap to open the hatch for a three-scoop cone.' },
    { id: 'pier_deckchair', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Deckchair', price: 70, fp: [1, 1], act: 'lounge', desc: 'A stripy deckchair with a bucket and spade. Tap it and your pet flops down for a rest.' },
    { id: 'pier_balloons', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Balloon stand', price: 90, fp: [1, 1], act: 'liftoff', desc: 'A big bunch of balloons on a striped stand. Tap it and they lift your pet right off the ground.' },
    { id: 'pier_lamppost', kind: 'decor', cat: 'sky', isle: 'pier', placeOn: 'any', requires: ['land_pier'], name: 'Bunting lamp post', price: 100, fp: [1, 1], act: 'glow', desc: 'A striped lamp post trailing bunting. Tap to light it up. Line the prom with them.' },
    { id: 'pet_crab', kind: 'pet', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Crab', price: 700, desc: 'Walks sideways, digs itself in and clicks its claws when it is pleased. Happiest on a patch of sand.' },
    { id: 'pet_gull', kind: 'pet', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Seagull', price: 900, desc: 'A cheeky gull with a big yellow beak. It flutters and struts about and keeps a close eye on the snacks.' },
    { id: 'acc_pier_conehat', kind: 'acc', slot: 'hat', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Ice-cream cone hat', price: 140, desc: 'An upside-down cone with a melting scoop. It looks dropped. It is on purpose.' },
    { id: 'acc_pier_ring', kind: 'acc', slot: 'neck', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Rubber ring', price: 180, desc: 'A stripy swim ring worn like a collar. Ready for the sea at all times.' },
    { id: 'acc_pier_snorkel', kind: 'acc', slot: 'face', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Snorkel mask', price: 220, desc: 'A diving mask with a snorkel up one side. Handy on the log flume.' },
    { id: 'acc_pier_balloon', kind: 'acc', slot: 'back', cat: 'pets', isle: 'pier', requires: ['land_pier'], name: 'Balloon on a string', price: 260, desc: 'A balloon tied on behind. It bobs along wherever your pet goes.' },

    /* Jungle Treehouse Village */
    { id: 'jungle_hammock', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Hammock', price: 260, fp: [1, 1], act: 'rock', desc: 'A woven hammock between two bamboo posts. Tap it and your pet climbs in for a slow, sleepy sway.' },
    { id: 'jungle_drums', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Log drums', price: 340, fp: [1, 1], act: 'drum', desc: 'Three hollow-log drums. Tap them and your pet plays a jungle beat.' },
    { id: 'jungle_monkeybars', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Monkey bars', price: 450, fp: [2, 1], act: 'bars', desc: 'A bamboo climbing frame. Tap it and your pet swings paw over paw all the way across.' },
    { id: 'jungle_camp', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Explorer camp', price: 700, fp: [2, 1], act: 'camp', desc: 'A tent, a map table and a spyglass on a tripod. Tap it and your pet pops out for a look around.' },
    { id: 'jungle_den', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Rope-ladder den', price: 850, fp: [2, 1], act: 'climb', desc: 'A hideout on stilts with a rope ladder and a bamboo slide. Your pet climbs up, waves and slides down.' },
    { id: 'jungle_canoe', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'own', requires: ['land_jungle'], name: 'Canoe creek', price: 1200, fp: [3, 2], act: 'canoe', desc: 'A creek with a jetty and a dugout canoe. Tap it and your pet paddles a lap under the log bridge.' },
    { id: 'jungle_fruitstall', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Fruit stall', price: 120, fp: [1, 1], act: 'juggle', desc: 'A cart piled high with jungle fruit. Tap it and three fruits jump up and land back on the pile.' },
    { id: 'jungle_market', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Market hut', price: 150, fp: [1, 1], act: 'open', desc: 'A thatched hut full of baskets, pots and blankets. Tap to roll the shutter up. Line a few up for a market.' },
    { id: 'jungle_smoothie', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Smoothie shack', price: 420, fp: [1, 1], act: 'serve', desc: 'A fruit bar under a leaf roof. Tap it and your pet gets a coconut smoothie with a straw.' },
    { id: 'jungle_lantern', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Bamboo lantern', price: 60, fp: [1, 1], act: 'glow', desc: 'A bamboo pole with a woven shade. Tap to switch its warm glow on or off. Line a path with them.' },
    { id: 'jungle_arch', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Mossy ruins arch', price: 300, fp: [2, 1], act: 'bloom', desc: 'An old stone arch hung with vines. Tap it and the vines burst into flower. Tap again to close them.' },
    { id: 'jungle_waterwheel', kind: 'fun', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Water wheel', price: 520, fp: [1, 1], act: 'spin', desc: 'A bamboo wheel that scoops and pours. Tap it for a full turn and watch the water run to the tub.' },
    { id: 'jungle_parrot', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Parrot perch', price: 90, fp: [1, 1], act: 'chirp', desc: 'A wooden perch with a bright parrot. Tap it and the parrot flaps, hops along and whistles hello.' },
    { id: 'jungle_banana', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Banana tree', price: 110, fp: [1, 1], act: 'wave', desc: 'Big paddle leaves and a bunch of yellow bananas. Tap it and the leaves sway in the breeze.' },
    { id: 'jungle_coconut', kind: 'decor', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Coconut palm', price: 130, fp: [1, 1], act: 'coconut', desc: 'A tall, leaning palm with a crown of coconuts. Tap it and one drops, bounces and rolls to the trunk.' },
    { id: 'path_bamboo', kind: 'path', cat: 'sky', isle: 'jungle', placeOn: 'any', requires: ['land_jungle'], name: 'Bamboo boardwalk', price: 30, fp: [1, 1], desc: 'One square of split-bamboo boardwalk, tied with rope.' },
    { id: 'pet_capybara', kind: 'pet', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Capybara', price: 750, desc: 'The calmest animal in the jungle. It loves a good long loaf and never hurries anywhere.' },
    { id: 'pet_monkey', kind: 'pet', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Monkey', price: 1100, desc: 'A golden monkey with a curly tail. It tumbles head over heels and never sits still for long.' },
    { id: 'acc_jungle_garland', kind: 'acc', slot: 'neck', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Flower garland', price: 110, desc: 'A ring of pink and orange jungle flowers to wear round the neck.' },
    { id: 'acc_jungle_hat', kind: 'acc', slot: 'hat', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Explorer hat', price: 150, desc: 'A wide-brim jungle hat with a leaf and a red feather in the band. Tall ears poke through.' },
    { id: 'acc_jungle_butterfly', kind: 'acc', slot: 'face', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Nose butterfly', price: 190, desc: 'A blue butterfly that has landed on your pet’s nose and decided to stay.' },
    { id: 'acc_jungle_pack', kind: 'acc', slot: 'back', cat: 'pets', isle: 'jungle', requires: ['land_jungle'], name: 'Explorer backpack', price: 260, desc: 'A canvas backpack with a rolled-up map on top and a banana for later.' },

    /* Treetop Adventure Park */
    { id: 'treetop_climbwall', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Climbing wall', price: 450, fp: [1, 1], act: 'climb', desc: 'A tall wall dotted with colourful holds. Tap it and your pet climbs to the top and rings the bell.' },
    { id: 'treetop_telescope', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Telescope pod', price: 500, fp: [1, 1], act: 'spy', desc: 'A pod on a tall pole with a brass telescope. Tap it and your pet climbs up to spot another island.' },
    { id: 'treetop_cargonet', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Cargo net climb', price: 550, fp: [2, 1], act: 'scramble', desc: 'A giant rope net over a log frame. Tap it and your pet scrambles up, over the top and down the other side.' },
    { id: 'treetop_leap', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Leaf-pile leap', price: 780, fp: [2, 1], act: 'leap', desc: 'A jump deck above a huge heap of autumn leaves. Tap it and your pet leaps in with a rustle.' },
    { id: 'treetop_bigslide', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Giant treetop slide', price: 950, fp: [2, 2], act: 'slide', desc: 'A tree tower with a wavy slide that curves round to a bark pit. Tap it and your pet whooshes down.' },
    { id: 'treetop_zipline', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'own', requires: ['land_treetop'], name: 'Zip-line tower', price: 1250, fp: [3, 1], act: 'zipline', desc: 'A timber tower with its own zip line. Tap it to zip down. Lives on the Treetop Adventure Park only.' },
    { id: 'treetop_tunnel', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Log tunnel', price: 260, fp: [2, 1], act: 'crawl', desc: 'A giant hollow log. Tap it and your pet crawls in one end and pops out of the other.' },
    { id: 'treetop_beams', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Balance beams', price: 300, fp: [2, 1], act: 'balance', desc: 'Three log beams in a zigzag. Tap it and your pet tiptoes across with its arms out, then takes a bow.' },
    { id: 'treetop_seesaw', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Log seesaw', price: 330, fp: [2, 1], act: 'seesaw', desc: 'A long plank on a stump. Tap it and your pet rocks up and down with a squirrel on the other end.' },
    { id: 'treetop_tyreswing', kind: 'fun', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Tyre swing', price: 350, fp: [1, 1], act: 'swing', desc: 'A big blue tyre hung on three ropes. Tap it and your pet swings out and twirls round.' },
    { id: 'treetop_birdtable', kind: 'decor', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Bird table', price: 60, fp: [1, 1], act: 'feed', desc: 'A bird table with a mossy roof. Tap it and two birds flutter down for a snack.' },
    { id: 'treetop_picnic', kind: 'decor', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Picnic deck', price: 120, fp: [1, 1], act: 'serve', desc: 'A plank deck with a picnic table and a checked cloth. Tap it to unpack the basket.' },
    { id: 'treetop_xylophone', kind: 'decor', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Log xylophone', price: 160, fp: [1, 1], act: 'chime', desc: 'Five log bars that ring when they are struck. Tap it for a tune. Your pet nods along.' },
    { id: 'treetop_pod', kind: 'decor', cat: 'sky', isle: 'treetop', placeOn: 'any', requires: ['land_treetop'], name: 'Tree pod', price: 180, fp: [1, 1], act: 'peek', desc: 'A round wooden den up a tree, with a rope ladder. Tap it and a squirrel peeks out. Build a pod village.' },
    { id: 'pet_squirrel', kind: 'pet', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Red squirrel', price: 750, desc: 'A red squirrel with a tail as big as the rest of it. Quick on the ropes and always hiding acorns.' },
    { id: 'pet_owl', kind: 'pet', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Owlet', price: 1100, desc: 'A round, fluffy owlet with ear tufts. It glides in a slow circle, hoots and loves a good nap.' },
    { id: 'acc_treetop_acorn', kind: 'acc', slot: 'hat', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Acorn cap', price: 120, desc: 'A knobbly acorn-cup hat with a stalk on top. Ears and tufts poke out at the sides.' },
    { id: 'acc_treetop_leafmask', kind: 'acc', slot: 'face', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Leaf mask', price: 150, desc: 'A mask made of two oak leaves. Your pet looks like a hero of the forest.' },
    { id: 'acc_treetop_binoculars', kind: 'acc', slot: 'neck', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Binoculars', price: 180, desc: 'Chunky blue binoculars on a rope strap. Just right for spotting other islands.' },
    { id: 'acc_treetop_leafwings', kind: 'acc', slot: 'back', cat: 'pets', isle: 'treetop', requires: ['land_treetop'], name: 'Leaf wings', price: 260, desc: 'Two big oak leaves tied on like wings. They flutter when your pet runs.' },

    /* Medieval Castle */
    { id: 'castle_flinger', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Flower flinger', price: 420, fp: [2, 1], act: 'toss', desc: 'A toy see-saw catapult loaded with flowers. Tap it and your pet jumps on to fling petals sky-high.' },
    { id: 'castle_joust', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'own', requires: ['land_castle'], name: 'Jousting lane', price: 850, fp: [3, 1], act: 'joust', desc: 'Gallop down the lane on a hobby horse and bop the padded dummy with a pillow. It spins right round!' },
    { id: 'castle_maze', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Hedge maze', price: 950, fp: [2, 2], act: 'maze', desc: 'A hedge maze with a flag in the middle. Tap it and your pet dashes in and pops up at the flag.' },
    { id: 'castle_throne', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Royal throne', price: 300, fp: [1, 1], act: 'royal', desc: 'A golden throne under a purple canopy. Tap it and your pet sits up tall while the trumpets play.' },
    { id: 'castle_bridge', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Moat bridge', price: 500, fp: [2, 1], act: 'ducks', desc: 'A humpback bridge over its own strip of moat. Tap it and your pet trots over while ducks paddle under.' },
    { id: 'castle_gate', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Gatehouse', price: 620, fp: [2, 1], act: 'open', desc: 'Two turrets and a big wooden door. Tap to swing it open with a blast of trumpets. Tap again to shut it.' },
    { id: 'castle_tower', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Bell tower', price: 700, fp: [1, 1], act: 'bell', desc: 'A round stone tower with steps winding up the outside. Tap it and your pet climbs up to ring the bell.' },
    { id: 'castle_dragon', kind: 'fun', cat: 'sky', isle: 'castle', placeOn: 'own', requires: ['land_castle'], name: 'Dragon fountain', price: 1100, fp: [2, 2], act: 'spout', desc: 'A stone dragon curled round a pool. Tap it and it blows a big arc of water. Water, never fire!' },
    { id: 'castle_herbs', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Herb garden', price: 50, fp: [1, 1], act: 'rustle', desc: 'A raised bed of lavender, mint and chives. Tap it for a rustle and a sniff. Plant as many as you like.' },
    { id: 'castle_well', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Stone well', price: 140, fp: [1, 1], act: 'bucket', desc: 'A round stone well with a wooden roof. Tap it to wind up a bucket of fresh water.' },
    { id: 'castle_window', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Rainbow window', price: 160, fp: [1, 1], act: 'glow', desc: 'A stone arch filled with coloured glass. Tap it to light up the picture. Brilliant after dark.' },
    { id: 'castle_stall', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Market stall', price: 180, fp: [1, 1], act: 'serve', desc: 'A striped stall of fresh bread, apples and flowers. Tap to set out the goods. Build a whole market.' },
    { id: 'castle_statue', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Knight statue', price: 200, fp: [1, 1], act: 'salute', desc: 'A suit of armour holding a flag, never a sword. Tap it and a robin pops out of the helmet.' },
    { id: 'castle_banner', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Banner pole', price: 90, fp: [1, 1], act: 'wave', desc: 'A tall pole with a long banner and a gold sun. Tap it to make the banner ripple. Line the avenue.' },
    { id: 'castle_lantern', kind: 'decor', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Castle lantern', price: 100, fp: [1, 1], act: 'glow', desc: 'An iron lantern post with a warm glow and no flames. Tap it to light up the courtyard.' },
    { id: 'path_carpet', kind: 'path', cat: 'sky', isle: 'castle', placeOn: 'any', requires: ['land_castle'], name: 'Royal carpet', price: 30, fp: [1, 1], desc: 'One square of red carpet with gold edges. Roll out a royal welcome all the way to the keep.' },
    { id: 'pet_duckling', kind: 'pet', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Duckling', price: 650, desc: 'A fluffy yellow duckling from the moat. It waddles everywhere and always turns to see where you are.' },
    { id: 'pet_pony', kind: 'pet', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Pony', price: 900, desc: 'A sturdy chestnut pony with a swishy tail. It gallops everywhere and rears up when you tap it.' },
    { id: 'acc_castle_ruff', kind: 'acc', slot: 'neck', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Royal ruff', price: 120, desc: 'A big white pleated collar, as worn at court. It fits any pet, even the duckling.' },
    { id: 'acc_castle_visor', kind: 'acc', slot: 'face', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Knight visor', price: 160, desc: 'A shiny visor with a wide gap, so your pet can still see where it is going.' },
    { id: 'acc_castle_helm', kind: 'acc', slot: 'hat', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Plumed helmet', price: 200, desc: 'A round silver helmet with a tall red feather. Ears poke out at the sides.' },
    { id: 'acc_castle_cloak', kind: 'acc', slot: 'back', cat: 'pets', isle: 'castle', requires: ['land_castle'], name: 'Royal cloak', price: 280, desc: 'A long purple cloak with a gold sun clasp. It swishes when your pet runs.' },

    /* Penguin Ice Village */
    { id: 'ice_sled', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Sledge run', price: 550, fp: [3, 1], act: 'slide', desc: 'A long snowy run with a wooden sledge and a bump at the bottom. Tap it and your pet rides down.' },
    { id: 'ice_skilift', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Ski lift', price: 850, fp: [3, 1], act: 'chairlift', desc: 'Two pylons, a humming cable and bobbing chairs. Tap it and your pet rides up to the top.' },
    { id: 'ice_penguin', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Penguin nest', price: 160, fp: [1, 1], act: 'waddle', desc: 'A penguin and its chick on a pebble nest. Tap for a waddle and a bow. Add more for a whole family.' },
    { id: 'ice_fishhole', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'own', requires: ['land_ice'], name: 'Fishing hole', price: 250, fp: [1, 1], act: 'fish', desc: 'A round hole in the ice with a rod and a stool. Tap it and silver fish leap out and dive back in.' },
    { id: 'ice_cocoa', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Hot-cocoa hut', price: 350, fp: [2, 1], act: 'serve', desc: 'A snug wooden hut serving hot chocolate with marshmallows. Tap it for a fresh mug.' },
    { id: 'ice_fort', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Snow fort', price: 400, fp: [2, 2], act: 'popup', desc: 'Thick snow walls, a corner turret and your own flag. Tap it and your pet pops up over the top.' },
    { id: 'ice_choir', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Penguin choir', price: 500, fp: [2, 1], act: 'sing', desc: 'Three penguins on ice steps who love to sing. Tap them for a tune. Your pet joins in at the end.' },
    { id: 'ice_castle', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'own', requires: ['land_ice'], name: 'Ice castle', price: 1200, fp: [2, 2], act: 'lights', desc: 'A castle of giant blue ice blocks with four round towers. Tap it and it lights up floor by floor.' },
    { id: 'ice_snowpenguin', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Snow penguin', price: 60, fp: [1, 1], act: 'wave', desc: 'A penguin built out of snow, with a carrot beak. Tap it and its twig flippers flap.' },
    { id: 'ice_pine', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Snowy pine', price: 90, fp: [1, 1], act: 'shake', desc: 'A pine with snow on every branch. Tap it and the snow slides off, then settles again.' },
    { id: 'ice_lantern', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Aurora lantern', price: 120, fp: [1, 1], act: 'glow', desc: 'A lamp carved from ice. Tap to light it and the colours drift like the northern lights.' },
    { id: 'ice_sculpture', kind: 'decor', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Snowflake sculpture', price: 180, fp: [1, 1], act: 'chime', desc: 'A giant snowflake carved from clear blue ice. Tap it for a slow turn, a shine and a chime.' },
    { id: 'ice_snowglobe', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Giant snow globe', price: 280, fp: [1, 1], act: 'shake', desc: 'A snow globe as tall as your pet, with an igloo inside. Tap it to shake up a snowstorm.' },
    { id: 'ice_bear', kind: 'fun', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Polar bear ice statue', price: 300, fp: [1, 1], act: 'pose', desc: 'A polar bear carved from one block of ice, nose in the air. Tap it and your pet copies the pose.' },
    { id: 'path_pebble', kind: 'path', cat: 'sky', isle: 'ice', placeOn: 'any', requires: ['land_ice'], name: 'Pebble path', price: 20, fp: [1, 1], desc: 'One square of smooth grey pebbles, the kind penguins collect.' },
    { id: 'pet_penguin', kind: 'pet', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Penguin chick', price: 800, desc: 'A fluffy penguin chick who waddles everywhere and belly-slides when it is in a hurry.' },
    { id: 'pet_seal', kind: 'pet', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Seal pup', price: 1000, desc: 'A silver seal pup who flops along on its tummy and claps its flippers when it is pleased.' },
    { id: 'acc_ice_earmuffs', kind: 'acc', slot: 'hat', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Fluffy earmuffs', price: 120, desc: 'Earmuffs for frosty days. They fit every pet, ears or no ears.' },
    { id: 'acc_ice_bells', kind: 'acc', slot: 'neck', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Sleigh-bell collar', price: 150, desc: 'A red collar with three golden bells that bob when your pet hops.' },
    { id: 'acc_ice_goggles', kind: 'acc', slot: 'face', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Snow goggles', price: 200, desc: 'Chunky snow goggles with a sunset lens. Ready for the slopes.' },
    { id: 'acc_ice_pack', kind: 'acc', slot: 'back', cat: 'pets', isle: 'ice', requires: ['land_ice'], name: 'Penguin backpack', price: 260, desc: 'A backpack shaped like a penguin. Yes, a penguin can wear it too.' }
  ];
  var BY_ID = {};
  CATALOG.forEach(function (it) { BY_ID[it.id] = it; });

  var REPEATABLE = { decor: 1, path: 1 };
  var PLACEABLE = { decor: 1, path: 1, fun: 1, house: 1, attraction: 1, landmark: 1 };
  var STORABLE = { decor: 1, path: 1, fun: 1 };          /* house, attractions + landmarks move, never store */
  var SELECTABLE = { style: 1, variant: 1, cosmetic: 1 };

  /* every act an item may carry, with what the hosts need to know about it: V4.54's 16, the
     ten first sky-island acts, then the 53 land-shop acts. One row per act, the same
     behaviour on every item that carries it:
       [toggle, pet, sec, anim2d, glyph]
       toggle  1 = a remembered on / off (glow, open, …), 0 = a one-shot
       pet     1 = some item with this act has a part for the pet
       sec     how long it runs (≤ 3 s; landmark acts ≤ 6 s)
       anim2d  the 2D pictogram's motion: spin | lift | swing | slide | shake | pop | hop | sway | none
       glyph   the mark a 2D tap shows
     No act awards, spends or counts anything. */
  var ACT_ROWS = {
    launch: [0, 0, 0.7, 'none', '★'], bounce: [0, 1, 3, 'hop', '✦'], splash: [0, 1, 3, 'pop', '✦'], swing: [0, 1, 3, 'swing', '♪'],
    bubbles: [0, 0, 3, 'pop', '✦'], glow: [1, 0, 0.3, 'none', '✦'], wave: [0, 0, 1.6, 'sway', '✦'], spin: [0, 0, 3, 'spin', '✦'],
    home: [0, 0, 0.3, 'none', '✦'], serve: [0, 1, 3, 'pop', '♪'], snap: [0, 1, 3, 'pop', '✦'], screen: [0, 0, 0.5, 'none', '✦'],
    record: [0, 0, 3, 'pop', '♪'], dance: [0, 1, 3, 'hop', '♪'], hangout: [0, 1, 3, 'pop', '✦'], encore: [0, 1, 3, 'none', '★'],

    ride: [0, 1, 3, 'spin', '♪'], slide: [0, 1, 3, 'slide', '✦'], open: [1, 1, 0.6, 'none', '✦'], wobble: [0, 1, 3, 'sway', '✦'],
    skate: [0, 1, 3, 'slide', '✦'], wheel: [0, 1, 4, 'spin', '★'], lift: [0, 1, 4, 'lift', '★'], zip: [0, 1, 4, 'slide', '★'],
    drawbridge: [1, 1, 4, 'none', '★'], penguins: [0, 0, 6, 'hop', '♪'],

    /* Theme Park Pier */
    mirrors: [0, 1, 2.5, 'pop', '✦'], droptower: [0, 1, 3, 'lift', '★'], teacups: [0, 1, 3, 'spin', '♪'], chairs: [0, 1, 3, 'spin', '♪'],
    swingship: [0, 1, 3, 'swing', '✦'], train: [0, 1, 3, 'slide', '♪'], dodgems: [0, 1, 3, 'shake', '★'], flume: [0, 1, 3, 'slide', '✦'],
    coaster: [0, 1, 3, 'slide', '★'], floss: [0, 1, 2, 'spin', '✦'], popcorn: [0, 1, 2, 'hop', '✦'], scoop: [1, 1, 0.6, 'none', '✦'],
    lounge: [0, 1, 2, 'pop', '✦'], liftoff: [0, 1, 2.5, 'lift', '✦'],
    /* Jungle Treehouse Village */
    canoe: [0, 1, 3, 'slide', '✦'], climb: [0, 1, 3, 'hop', '✦'], camp: [0, 1, 3, 'pop', '✦'], bars: [0, 1, 3, 'slide', '✦'],
    drum: [0, 1, 2.4, 'hop', '♪'], bloom: [1, 1, 2.5, 'none', '✦'], rock: [0, 1, 3, 'sway', '✦'], coconut: [0, 0, 2.5, 'shake', '✦'],
    juggle: [0, 0, 1.2, 'hop', '✦'], chirp: [0, 0, 1.2, 'hop', '♪'],
    /* Treetop Adventure Park */
    feed: [0, 0, 2.5, 'hop', '♪'], chime: [0, 1, 2.5, 'shake', '♪'], peek: [1, 0, 0.6, 'none', '✦'], crawl: [0, 1, 2.5, 'slide', '✦'],
    balance: [0, 1, 3, 'sway', '✦'], seesaw: [0, 1, 3, 'swing', '✦'], spy: [0, 1, 3, 'hop', '✦'], scramble: [0, 1, 3, 'hop', '✦'],
    leap: [0, 1, 3, 'hop', '✦'], zipline: [0, 1, 2.5, 'slide', '★'],
    /* Medieval Castle */
    rustle: [0, 0, 1.2, 'shake', '✦'], knock: [0, 0, 0.5, 'none', '✦'], bucket: [0, 1, 2.5, 'lift', '✦'], salute: [0, 0, 2, 'pop', '♪'],
    royal: [0, 1, 2.5, 'pop', '★'], toss: [0, 1, 3, 'swing', '✦'], ducks: [0, 1, 3, 'slide', '♪'], bell: [0, 1, 3, 'hop', '♪'],
    joust: [0, 1, 3, 'slide', '★'], maze: [0, 1, 3, 'slide', '✦'], spout: [0, 1, 3, 'pop', '✦'],
    /* Penguin Ice Village */
    shake: [0, 0, 2.5, 'shake', '✦'], waddle: [0, 0, 2.5, 'sway', '♪'], fish: [0, 1, 2, 'hop', '✦'], pose: [0, 1, 2.5, 'pop', '★'],
    popup: [0, 1, 3, 'hop', '✦'], sing: [0, 1, 3, 'sway', '♪'], chairlift: [0, 1, 3, 'lift', '✦'], lights: [1, 1, 3, 'none', '★']
  };
  var ACTS = Object.freeze(Object.keys(ACT_ROWS));
  var ACT_INFO = {};
  ACTS.forEach(function (a) {
    var r = ACT_ROWS[a];
    ACT_INFO[a] = { toggle: !!r[0], pet: !!r[1], sec: r[2], anim2d: r[3], glyph: r[4] };
  });
  deepFreeze(ACT_INFO);

  /* the shelves of each land's shop, in shop order: [shelfKey, [ids, cheapest first]] — in a
     'crew' shelf the mascots come first, then the gear. Every themed item, mascot and piece of
     gear of a land is on exactly one shelf; the land and its landmark are on none. Shelf
     names are copy (shop.shelf.<isle>.<key>, else shop.shelf.<key>). */
  var ISLE_SHELVES = deepFreeze({
    pier: [['rides', ['pier_mirrors', 'pier_droptower', 'pier_helter', 'pier_carousel', 'pier_teacups', 'pier_flyingchairs', 'pier_swingship', 'pier_train', 'pier_dodgems', 'pier_flume', 'pier_coaster']],
      ['stalls', ['pier_candyfloss', 'pier_popcorn', 'pier_icecream']],
      ['decor', ['pier_deckchair', 'pier_balloons', 'pier_lamppost', 'pier_beachhut']],
      ['paths', ['path_pier']],
      ['crew', ['pet_crab', 'pet_gull', 'acc_pier_conehat', 'acc_pier_ring', 'acc_pier_snorkel', 'acc_pier_balloon']]],
    jungle: [['rides', ['jungle_hammock', 'jungle_drums', 'jungle_vineswing', 'jungle_monkeybars', 'jungle_falls', 'jungle_camp', 'jungle_den', 'jungle_canoe']],
      ['stalls', ['jungle_fruitstall', 'jungle_market', 'jungle_smoothie']],
      ['village', ['jungle_lantern', 'jungle_stilthut', 'jungle_arch', 'jungle_waterwheel']],
      ['wild', ['jungle_parrot', 'jungle_banana', 'jungle_coconut']],
      ['paths', ['path_logs', 'path_bamboo']],
      ['crew', ['pet_capybara', 'pet_monkey', 'acc_jungle_garland', 'acc_jungle_hat', 'acc_jungle_butterfly', 'acc_jungle_pack']]],
    treetop: [['rides', ['treetop_climbwall', 'treetop_telescope', 'treetop_cargonet', 'treetop_leap', 'treetop_bigslide', 'treetop_zipline']],
      ['play', ['treetop_tunnel', 'treetop_beams', 'treetop_seesaw', 'treetop_tyreswing', 'treetop_bridge', 'treetop_net']],
      ['decor', ['treetop_birdtable', 'treetop_picnic', 'treetop_xylophone', 'treetop_platform', 'treetop_pod']],
      ['paths', ['path_bark']],
      ['crew', ['pet_squirrel', 'pet_owl', 'acc_treetop_acorn', 'acc_treetop_leafmask', 'acc_treetop_binoculars', 'acc_treetop_leafwings']]],
    castle: [['rides', ['castle_flinger', 'castle_maypole', 'castle_joust', 'castle_maze']],
      ['village', ['castle_throne', 'castle_bridge', 'castle_feast', 'castle_gate', 'castle_tower', 'castle_dragon']],
      ['stalls', ['castle_herbs', 'castle_well', 'castle_window', 'castle_stall', 'castle_statue']],
      ['decor', ['castle_wall', 'castle_banner', 'castle_lantern']],
      ['paths', ['path_cobble', 'path_carpet']],
      ['crew', ['pet_duckling', 'pet_pony', 'acc_castle_ruff', 'acc_castle_visor', 'acc_castle_helm', 'acc_castle_cloak']]],
    ice: [['rides', ['ice_slide', 'ice_sled', 'ice_rink', 'ice_skilift']],
      ['village', ['ice_snowhut', 'ice_penguin', 'ice_fishhole', 'ice_cocoa', 'ice_fort', 'ice_choir', 'ice_castle']],
      ['decor', ['ice_snowpenguin', 'ice_pine', 'ice_lantern', 'ice_sculpture', 'ice_snowglobe', 'ice_bear']],
      ['paths', ['path_pebble', 'path_ice']],
      ['crew', ['pet_penguin', 'pet_seal', 'acc_ice_earmuffs', 'acc_ice_bells', 'acc_ice_goggles', 'acc_ice_pack']]]
  });

  /* shape: the City loft is the default house form. Parent switch: set it (and
     SLIslandLook.SLOT_DEFAULTS.shape) to 'shape_cottage' for zero visual change on old saves. */
  var DEFAULTS = { wall: 'wall_cream', roof: 'roof_red', door: 'door_blue', shape: 'shape_loft',
                   course: 'course_meadow', ball: 'ball_classic', stadium: 'stadium_day',
                   kart: 'kart_red', track: 'track_loop' };

  /* starter layout — validated by tests to be legal */
  var STARTER = {
    owned: { house_cottage: 1, att_course: 1, pet_puppy: 1, wall_cream: 1, roof_red: 1, door_blue: 1,
             shape_cottage: 1, shape_loft: 1,
             course_meadow: 1, tree_oak: 2, tree_pine: 1, flower_tulip: 2, flower_daisy: 1, path_stone: 4, bush_rose: 1 },
    placed: [
      { id: 'house_cottage', x: 6, y: 2 },
      { id: 'att_course', x: 9, y: 5 },
      { id: 'path_stone', x: 7, y: 4 }, { id: 'path_stone', x: 7, y: 5 },
      { id: 'path_stone', x: 7, y: 6 }, { id: 'path_stone', x: 8, y: 7 },
      { id: 'tree_oak', x: 3, y: 3 }, { id: 'tree_oak', x: 11, y: 3 }, { id: 'tree_pine', x: 4, y: 2 },
      { id: 'flower_tulip', x: 5, y: 4 }, { id: 'flower_tulip', x: 9, y: 2 },
      { id: 'flower_daisy', x: 4, y: 7 }, { id: 'bush_rose', x: 12, y: 5 }
    ]
  };

  /* ---------------- helpers ---------------- */
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function item(id) { return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null; }
  function isRepeatable(it) { return !!(it && REPEATABLE[it.kind]); }
  function isPlaceable(it) { return !!(it && PLACEABLE[it.kind]); }
  function isStorable(it) { return !!(it && STORABLE[it.kind]); }
  function nowIso(ms) { return new Date(ms == null ? Date.now() : ms).toISOString(); }

  function emptyWorld() {
    return {
      v: VERSION, rev: 0, nextUid: 1,
      starterGrantedAt: null, introSeen: false,
      owned: {}, placed: [], ledger: [], spent: 0,
      sel: {}, details: {},             /* sel: slot -> itemId ; details: itemId -> true */
      pets: [], activePet: null,
      goal: null, goalNotified: null,
      pb: {}, tutSeen: {},
      arcade: { days: {} },
      updatedAt: null
    };
  }

  function ensureWorld(u) {
    if (!u.world || typeof u.world !== 'object') u.world = emptyWorld();
    var w = u.world, d = emptyWorld();
    Object.keys(d).forEach(function (k) { if (w[k] === undefined || w[k] === null && d[k] !== null) w[k] = d[k]; });
    if (!w.owned || typeof w.owned !== 'object') w.owned = {};
    if (!Array.isArray(w.placed)) w.placed = [];
    if (!Array.isArray(w.ledger)) w.ledger = [];
    if (!w.sel || typeof w.sel !== 'object') w.sel = {};
    if (!w.details || typeof w.details !== 'object') w.details = {};
    if (!Array.isArray(w.pets)) w.pets = [];
    if (!w.pb || typeof w.pb !== 'object') w.pb = {};
    if (!w.tutSeen || typeof w.tutSeen !== 'object') w.tutSeen = {};
    if (!w.arcade || typeof w.arcade !== 'object') w.arcade = { days: {} };
    if (!w.arcade.days || typeof w.arcade.days !== 'object') w.arcade.days = {};
    if (!isInt(w.nextUid) || w.nextUid < 1) w.nextUid = 1;
    if (!isInt(w.spent) || w.spent < 0) w.spent = 0;
    return w;
  }
  function touch(w, ms) { w.rev = (w.rev || 0) + 1; w.updatedAt = nowIso(ms); }
  function ownedCount(w, id) { var n = w.owned[id]; return isInt(n) && n > 0 ? n : 0; }
  function owns(w, id) { return ownedCount(w, id) > 0; }
  function newUid(w) { var id = 'p' + w.nextUid; w.nextUid += 1; return id; }

  /* ---------------- v3 helpers: scope, islands and where things are ---------------- */
  var EPOCH = '1970-01-01T00:00:00.000Z';       /* isles[k].at of an entry normalize had to create */
  var NONE = Object.freeze([]);                   /* placedOn() of an island with no entry yet */
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function itemOf(itOrId) { return typeof itOrId === 'string' ? item(itOrId) : (itOrId || null); }
  function isleDef(k) { return typeof k === 'string' && has(ISLES, k) ? ISLES[k] : null; }
  function isleKey(isle) { return isle == null ? 'home' : isle; }
  /* the first v3-only write stamps the save (informational: migrations key on data, never on v) */
  function markV3(w) { if (isInt(w.v) && w.v >= VERSION) return false; w.v = VERSION; return true; }
  function isV3(itOrId) { var it = itemOf(itOrId); return !!(it && it.isle); }
  /* 'home' = a V4.54 thing (Home Island only while LEGACY_SKY is false); landmarks are always 'own' */
  function scopeOf(itOrId) {
    var it = itemOf(itOrId);
    if (!it) return null;
    if (!it.isle) return 'home';
    if (it.kind === 'landmark') return 'own';
    return it.placeOn === 'any' ? 'any' : 'own';
  }
  /* scope only (D18): whether the item may ever go on that island; locks are canPlace's job */
  function canGoOn(id, isle) {
    var it = item(id), k = isleKey(isle);
    if (!it || !isPlaceable(it) || !isleDef(k)) return false;
    var s = scopeOf(it);
    if (s === 'any') return true;
    if (s === 'own') return it.isle === k;
    return k === 'home' || (LEGACY_SKY && isStorable(it) && it.cat !== 'city');
  }
  function isleUnlocked(w, isle) {
    var k = isleKey(isle), d = isleDef(k);
    if (!d) return false;
    return k === 'home' || !!(w && w.owned && owns(w, d.unlock));
  }
  function unlockedIsles(w) { return ISLE_ORDER.filter(function (k) { return isleUnlocked(w, k); }); }
  function islesOf(w) { var s = w && w.isles; return s && typeof s === 'object' && !Array.isArray(s) ? s : null; }
  function skyList(w, k) {
    var s = islesOf(w), e = s && has(s, k) ? s[k] : null;
    return e && typeof e === 'object' && Array.isArray(e.placed) ? e.placed : null;
  }
  /* the live placed[] of an island (Home → w.placed); a frozen [] until a writer creates the entry */
  function placedOn(w, isle) {
    var k = isleKey(isle);
    return k === 'home' ? w.placed : (skyList(w, k) || NONE);
  }
  /* every placement list in the save: Home, the sky islands in ISLE_ORDER, then unknown island keys */
  function allLists(w) {
    var out = [{ isle: 'home', list: Array.isArray(w.placed) ? w.placed : [] }], s = islesOf(w);
    if (!s) return out;
    ISLE_ORDER.forEach(function (k) { var l = k !== 'home' && skyList(w, k); if (l) out.push({ isle: k, list: l }); });
    Object.keys(s).forEach(function (k) { var l = !isleDef(k) && skyList(w, k); if (l) out.push({ isle: k, list: l }); });
    return out;
  }
  function isleOf(w, uid) {
    var all = allLists(w);
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < all[i].list.length; j++) { var p = all[i].list[j]; if (p && p.uid === uid) return all[i].isle; }
    }
    return null;
  }
  /* create (or repair) a sky island's entry: { placed: [], at } */
  function isleEntry(w, k, atIso) {
    if (!islesOf(w)) w.isles = {};
    var e = has(w.isles, k) ? w.isles[k] : null;
    if (!e || typeof e !== 'object' || Array.isArray(e)) { e = { placed: [], at: atIso }; w.isles[k] = e; }
    if (!Array.isArray(e.placed)) e.placed = [];
    if (typeof e.at !== 'string') e.at = atIso;
    return e;
  }
  function landSetOf(w, isle) {
    var k = isleKey(isle);
    if (k === 'home') return landSet(w);
    var out = {};
    if (isleUnlocked(w, k)) ISLE_CELLS[k].forEach(function (c) { out[c] = 1; });
    return out;
  }
  function dockCells(isle) { var d = isleDef(isleKey(isle)); return d ? d.dock.map(function (xy) { return xy[0] + ',' + xy[1]; }) : []; }
  function wrongIsleText(it) { return ISLE_TEXT.wrongIsle.replace('{island}', (isleDef(it.isle) || { name: it.isle }).name); }

  /* ---------------- pets ---------------- */
  /* whole-word matches, plus a few words that are never innocent inside a longer name */
  var BAD_WORDS = ['poo', 'poop', 'wee', 'bum', 'butt', 'fart', 'damn', 'hell', 'crap', 'shit', 'fuck', 'piss', 'arse', 'ass', 'dick', 'cock', 'tit', 'tits', 'bitch', 'bastard', 'willy', 'sex', 'kill', 'stupid', 'idiot', 'dumb', 'hate', 'loser'];
  var BAD_INSIDE = ['fuck', 'shit', 'bitch', 'bastard', 'fart', 'poop'];
  function validatePetName(raw) {
    /* tablets type a curly ’ by default — treat it as a plain apostrophe */
    var s = String(raw == null ? '' : raw).replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
    if (!s) return { ok: false, reason: 'Give your pet a name first.' };
    if (s.length > 14) return { ok: false, reason: 'Names can be up to 14 letters long.' };
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]*$/.test(s)) return { ok: false, reason: 'Use letters only (spaces, - and ’ are fine too).' };
    var words = s.toLowerCase().split(/[^a-zà-öø-ÿ]+/).filter(Boolean);
    var joined = s.toLowerCase().replace(/[^a-z]/g, '');
    var rude = words.some(function (wd) { return BAD_WORDS.indexOf(wd) >= 0; }) ||
               BAD_INSIDE.some(function (b) { return joined.indexOf(b) >= 0; });
    if (rude) return { ok: false, reason: 'Let’s pick a kinder name.' };
    return { ok: true, name: s };
  }
  var DEFAULT_PET_NAMES = Object.freeze({ pet_puppy: 'Biscuit', pet_kitten: 'Mittens', pet_bunny: 'Clover', pet_dragon: 'Ember',
    /* the lands' mascots */
    pet_crab: 'Nipper', pet_gull: 'Chips', pet_capybara: 'Coconut', pet_monkey: 'Mango', pet_squirrel: 'Acorn', pet_owl: 'Bramble',
    pet_duckling: 'Dabble', pet_pony: 'Pepper', pet_penguin: 'Pebble', pet_seal: 'Splosh' });
  function ensurePetRecord(w, id) {
    for (var i = 0; i < w.pets.length; i++) if (w.pets[i].id === id) return w.pets[i];
    var rec = { id: id, name: DEFAULT_PET_NAMES[id] || 'Buddy', acc: {} };
    w.pets.push(rec);
    return rec;
  }
  function petById(w, id) { for (var i = 0; i < w.pets.length; i++) if (w.pets[i].id === id) return w.pets[i]; return null; }

  /* ---------------- the crew: V4.54 pets, the lands' mascots and what they wear ----------------
     An old cached client reads w.pets, w.activePet and each pet's acc and looks every id up in
     ITS catalogue, so those three hold only V4.54 ids, always. Everything it does not know
     lives in w.crew3, which appears at the first mascot or land-gear write:
       crew3.pets    [{id, name, acc}] one record per mascot, in adoption order; a mascot may
                     wear any owned accessory (V4.54 or land gear)
       crew3.active  the mascot that is the runner, or null
       crew3.over    w.activePet at the moment that mascot took over. w.activePet itself is
                     never changed by choosing a mascot, so an old client shows and plays that
                     V4.54 pet; if it picks another runner, over no longer matches and its
                     (newer) choice wins
       crew3.acc     {<V4.54 pet id>: {<slot>: <land gear id>}}: land gear on a V4.54 pet; the
                     same slot of that pet's own acc is then empty, and if an old client fills
                     it, its choice wins
       crew3.at      ISO time of the last change (mergeWorlds takes the newer block)
     Hosts read the crew through crewList / crewPet / activePetId / wornBy and change it
     through setActivePet / renamePet / equipAccessory; they never touch these fields. */
  function isMascot(itOrId) { var it = itemOf(itOrId); return !!(it && it.kind === 'pet' && it.isle); }
  function isLandGear(itOrId) { var it = itemOf(itOrId); return !!(it && it.kind === 'acc' && it.isle); }
  function isOldPet(itOrId) { var it = itemOf(itOrId); return !!(it && it.kind === 'pet' && !it.isle); }
  function plainObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function crew3Of(w) { return w && plainObj(w.crew3) ? w.crew3 : null; }
  /* create (or repair the shape of) the crew3 block */
  function crew3Entry(w, atIso) {
    var c = crew3Of(w);
    if (!c) { c = { pets: [], active: null, over: null, acc: {}, at: atIso }; w.crew3 = c; }
    if (!Array.isArray(c.pets)) c.pets = [];
    if (c.active === undefined) c.active = null;
    if (c.over === undefined) c.over = null;
    if (!plainObj(c.acc)) c.acc = {};
    if (typeof c.at !== 'string') c.at = atIso;
    return c;
  }
  function mascotRec(w, id) {
    var c = crew3Of(w), list = c && Array.isArray(c.pets) ? c.pets : [];
    for (var i = 0; i < list.length; i++) if (plainObj(list[i]) && list[i].id === id) return list[i];
    return null;
  }
  function ensureMascotRecord(w, id, atIso) {
    var rec = mascotRec(w, id);
    if (rec) return rec;
    rec = { id: id, name: DEFAULT_PET_NAMES[id] || 'Buddy', acc: {} };
    crew3Entry(w, atIso).pets.push(rec);
    return rec;
  }
  /* land gear a V4.54 pet wears in a slot (from crew3.acc), or null. It only counts while it
     is owned land gear of that slot and the pet's own acc leaves the slot empty. */
  function gearOn(w, p, slot) {
    var c = crew3Of(w), m = c && plainObj(c.acc) && has(c.acc, p.id) ? c.acc[p.id] : null;
    var g = plainObj(m) && has(m, slot) ? m[slot] : null, a = g ? item(g) : null;
    if (!a || !isLandGear(a) || a.slot !== slot || !owns(w, g)) return null;
    return plainObj(p.acc) && p.acc[slot] ? null : g;
  }
  /* the runner: the chosen mascot while its understudy is still w.activePet, else w.activePet */
  function activePetId(w) {
    var c = crew3Of(w), a = c ? c.active : null;
    if (a && isMascot(a) && owns(w, a) && mascotRec(w, a) && (c.over == null ? null : c.over) === (w.activePet == null ? null : w.activePet)) return a;
    return w.activePet == null ? null : w.activePet;
  }
  /* {slot: accId} — what that pet is wearing, always a fresh object */
  function wornBy(w, petId) {
    var out = {}, rec, src;
    if (isMascot(petId)) {
      rec = mascotRec(w, petId); src = rec && plainObj(rec.acc) ? rec.acc : {};
      Object.keys(src).forEach(function (slot) {
        var a = item(src[slot]);
        if (a && a.kind === 'acc' && a.slot === slot && owns(w, a.id)) out[slot] = a.id;
      });
      return out;
    }
    rec = petById(w, petId);
    if (!rec) return out;
    src = plainObj(rec.acc) ? rec.acc : {};
    Object.keys(src).forEach(function (slot) {
      var a = item(src[slot]);
      if (a && a.kind === 'acc' && owns(w, a.id)) out[slot] = a.id;
    });
    var c = crew3Of(w), m = c && plainObj(c.acc) && has(c.acc, petId) && plainObj(c.acc[petId]) ? c.acc[petId] : {};
    Object.keys(m).forEach(function (slot) { var g = gearOn(w, rec, slot); if (g) out[slot] = g; });
    return out;
  }
  /* one crew member with its effective outfit, or null (unknown, not owned, or no record) */
  function crewPet(w, id) {
    var v3 = isMascot(id);
    if (!v3 && !isOldPet(id)) return null;
    var rec = v3 ? mascotRec(w, id) : petById(w, id);
    if (!rec || !owns(w, id)) return null;
    var name = typeof rec.name === 'string' && rec.name.trim() ? rec.name : (DEFAULT_PET_NAMES[id] || 'Buddy');
    return { id: id, name: name, acc: wornBy(w, id), v3: v3 };
  }
  /* everyone in the crew: the owned V4.54 pets in w.pets order, then the owned mascots in
     adoption order. Exactly one entry is active — the runner (activePetId); should that id
     not be in the list (a save waiting for normalize), the first entry stands in. */
  function crewList(w) {
    var out = [], seen = {}, c = crew3Of(w), active = activePetId(w), found = false;
    var add = function (id) {
      if (has(seen, id)) return;
      var p = crewPet(w, id);
      if (!p) return;
      seen[id] = 1;
      p.active = id === active;
      if (p.active) found = true;
      out.push(p);
    };
    (Array.isArray(w.pets) ? w.pets : []).forEach(function (p) { if (plainObj(p) && isOldPet(p.id)) add(p.id); });
    (c && Array.isArray(c.pets) ? c.pets : []).forEach(function (p) { if (plainObj(p) && isMascot(p.id)) add(p.id); });
    if (!found && out.length) out[0].active = true;
    return out;
  }
  function renamePet(u, petId, raw, ms) {
    var w = ensureWorld(u), v3 = isMascot(petId);
    var p = v3 ? mascotRec(w, petId) : petById(w, petId);
    if (!p || !owns(w, petId)) return { ok: false, reason: 'You don’t have that pet.' };
    var v = validatePetName(raw);
    if (!v.ok) return v;
    p.name = v.name;
    if (v3) { crew3Of(w).at = nowIso(ms); markV3(w); }
    touch(w, ms);
    return { ok: true, name: v.name };
  }
  /* a V4.54 pet becomes w.activePet (and any mascot runner steps down); a mascot becomes
     crew3.active with today's w.activePet as its understudy — w.activePet is not changed */
  function setActivePet(u, petId, ms) {
    var w = ensureWorld(u), c;
    if (isMascot(petId)) {
      if (!owns(w, petId) || !mascotRec(w, petId)) return { ok: false };
      c = crew3Entry(w, nowIso(ms));
      c.active = petId; c.over = w.activePet == null ? null : w.activePet; c.at = nowIso(ms);
      markV3(w); touch(w, ms);
      return { ok: true };
    }
    if (!owns(w, petId) || !petById(w, petId)) return { ok: false };
    w.activePet = petId;
    c = crew3Of(w);
    if (c && (c.active != null || c.over != null)) { c.active = null; c.over = null; c.at = nowIso(ms); markV3(w); }
    touch(w, ms); return { ok: true };
  }
  /* tap to put on, tap again to take off. A V4.54 accessory on a V4.54 pet is the V4.54
     write (p.acc); land gear on a V4.54 pet goes in crew3.acc and empties that slot of
     p.acc; a mascot keeps its whole outfit in its crew3 record. */
  function equipAccessory(u, petId, accId, ms) {
    var w = ensureWorld(u), a = item(accId), v3 = isMascot(petId);
    var p = v3 ? mascotRec(w, petId) : petById(w, petId);
    if (!p || !a || a.kind !== 'acc' || !owns(w, accId)) return { ok: false };
    if (!v3 && isLandGear(a) && !isOldPet(petId)) return { ok: false };      /* crew3.acc is for V4.54 pets only */
    var slot = a.slot, at = nowIso(ms), c = crew3Of(w), on;
    if (v3) {
      if (!plainObj(p.acc)) p.acc = {};
      if (p.acc[slot] === accId) delete p.acc[slot]; else p.acc[slot] = accId;
      on = p.acc[slot] === accId;
      c.at = at; markV3(w);
    } else if (isLandGear(a)) {
      on = gearOn(w, p, slot) !== accId;
      c = crew3Entry(w, at);
      if (!plainObj(c.acc[petId])) c.acc[petId] = {};
      if (on) { c.acc[petId][slot] = accId; delete p.acc[slot]; }
      else { delete c.acc[petId][slot]; if (!Object.keys(c.acc[petId]).length) delete c.acc[petId]; }
      c.at = at; markV3(w);
    } else {
      if (p.acc[slot] === accId) delete p.acc[slot]; else p.acc[slot] = accId;   /* tap again to take off */
      on = p.acc[slot] === accId;
      /* a V4.54 accessory has the last word on its slot: land gear kept for that slot in crew3 goes */
      if (c && plainObj(c.acc) && plainObj(c.acc[petId]) && has(c.acc[petId], slot)) {
        delete c.acc[petId][slot];
        if (!Object.keys(c.acc[petId]).length) delete c.acc[petId];
        c.at = at; markV3(w);
      }
    }
    touch(w, ms); return { ok: true, on: on };
  }

  /* ---------------- selection (styles / cosmetics / variants) ---------------- */
  function selected(w, slot) {
    var id = w.sel[slot];
    return (id && owns(w, id)) ? id : (DEFAULTS[slot] && owns(w, DEFAULTS[slot]) ? DEFAULTS[slot] : (DEFAULTS[slot] || null));
  }
  function select(u, id, ms) {
    var w = ensureWorld(u), it = item(id);
    if (!it || !SELECTABLE[it.kind] || !owns(w, id)) return { ok: false };
    if (it.multi) { if (w.details[id]) delete w.details[id]; else w.details[id] = true; }
    else w.sel[it.slot] = id;
    touch(w, ms); return { ok: true };
  }

  /* ---------------- placement ---------------- */
  function unlockedRegions(w) {
    var out = ['home'];
    Object.keys(REGIONS).forEach(function (k) { if (REGIONS[k].unlock && owns(w, REGIONS[k].unlock)) out.push(k); });
    return out;
  }
  function landSet(w) {
    var s = {};
    unlockedRegions(w).forEach(function (k) { REGION_CELLS[k].forEach(function (c) { s[c] = 1; }); });
    return s;
  }
  function fpCells(it, x, y) {
    var out = [], fw = (it.fp || [1, 1])[0], fh = (it.fp || [1, 1])[1];
    for (var dy = 0; dy < fh; dy++) for (var dx = 0; dx < fw; dx++) out.push((x + dx) + ',' + (y + dy));
    return out;
  }
  function entranceCells(it, x, y) {
    if (!it.entrance) return [];
    var out = [], fw = (it.fp || [1, 1])[0], fh = (it.fp || [1, 1])[1];
    for (var dx = 0; dx < fw; dx++) out.push((x + dx) + ',' + (y + fh));
    return out;
  }
  /* cell -> {uid, id, layer} plus reserved cells, for ONE island (default Home): the
     entrance rows (value: the owner's uid) and, on a sky island, the dock cells
     (value 'dock'; also listed in .dock). The same x, y on two islands never collide. */
  function occupancy(w, ignoreUid, isle) {
    var k = isleKey(isle), occ = {}, reserved = {}, dock = null;
    if (k !== 'home') {
      dock = {};
      Object.keys(has(ISLE_DOCK, k) ? ISLE_DOCK[k] : {}).forEach(function (c) { dock[c] = 1; reserved[c] = 'dock'; });
    }
    placedOn(w, k).forEach(function (p) {
      if (!p || p.uid === ignoreUid) return;
      var it = item(p.id); if (!it) return;
      var layer = it.kind === 'path' ? 'ground' : 'object';
      fpCells(it, p.x, p.y).forEach(function (c) { occ[c] = { uid: p.uid, id: p.id, layer: layer }; });
      entranceCells(it, p.x, p.y).forEach(function (c) { reserved[c] = p.uid; });
    });
    var out = { occ: occ, reserved: reserved };
    if (dock) out.dock = dock;
    return out;
  }
  /* the land of one island, read-only: Home's comes from a frozen map per unlocked-region set
     (canPlace runs it for every placement normalize checks); landSet() still returns a fresh copy */
  var HOME_LAND = {};
  function landOf(w, k) {
    if (k !== 'home') return ISLE_LAND[k];
    var key = unlockedRegions(w).join(',');
    if (!has(HOME_LAND, key)) HOME_LAND[key] = Object.freeze(landSet(w));
    return HOME_LAND[key];
  }
  /* the checks that do not depend on the cell: island exists, unlocked, scope */
  function isleGate(w, it, k) {
    var d = isleDef(k);
    if (!d) return { ok: false, code: 'no_isle', reason: ISLE_TEXT.noIsle };
    if (!isleUnlocked(w, k)) return { ok: false, code: 'locked_isle', reason: ISLE_TEXT.locked };
    if (!canGoOn(it.id, k)) {
      if (scopeOf(it) === 'home') return { ok: false, code: 'home_only', reason: ISLE_TEXT.homeOnly };
      return { ok: false, code: 'wrong_isle', reason: wrongIsleText(it) };
    }
    return null;
  }
  /* Rules: inside unlocked land; one thing per cell; only paths may sit in an
     entrance or on a bridge landing (dock); a house/attraction/landmark's own
     entrance must be on land and free of objects (paths are fine). */
  function fits(it, x, y, land, o) {
    var cells = fpCells(it, x, y);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!land[c]) return { ok: false, code: 'off_land', reason: 'That’s off your land.', cells: cells };
      if (o.occ[c]) return { ok: false, code: 'occupied', reason: 'Something is already there.', cells: cells };
      if (o.reserved[c] && it.kind !== 'path') {
        if (o.dock && o.dock[c] && o.reserved[c] === 'dock') return { ok: false, code: 'dock', reason: ISLE_TEXT.dock, cells: cells };
        return { ok: false, code: 'doorway', reason: 'Keep the doorway clear.', cells: cells };
      }
    }
    var ent = entranceCells(it, x, y);
    for (var j = 0; j < ent.length; j++) {
      var e = ent[j];
      if (!land[e]) return { ok: false, code: 'entrance_off', reason: 'The entrance must be on your land.', cells: cells };
      if (o.occ[e] && o.occ[e].layer !== 'ground') return { ok: false, code: 'entrance_blocked', reason: 'Something is blocking the entrance.', cells: cells };
    }
    return { ok: true, cells: cells, entrance: ent };
  }
  /* isle defaults to Home. For V4.54 ids on Home every V4.54 field is unchanged; 'code' is added. */
  function canPlace(w, id, x, y, ignoreUid, isle) {
    var it = item(id), k = isleKey(isle);
    if (!it || !isPlaceable(it)) return { ok: false, code: 'not_placeable', reason: 'That can’t be placed.' };
    if (!isInt(x) || !isInt(y)) return { ok: false, code: 'bad_cell', reason: 'Pick a square.' };
    var gate = isleGate(w, it, k);
    if (gate) return gate;
    return fits(it, x, y, landOf(w, k), occupancy(w, ignoreUid, k));
  }
  function countIn(list, id) { var n = 0; for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) n++; return n; }
  /* isle omitted: every island (a dormant one too), which is what every V4.54 caller means */
  function placedCount(w, id, isle) {
    if (isle != null) return countIn(placedOn(w, isle), id);
    var n = 0;
    allLists(w).forEach(function (l) { n += countIn(l.list, id); });
    return n;
  }
  /* ONE bag for every island: owned − placed anywhere */
  function storedCount(w, id) {
    var it = item(id); if (!isPlaceable(it)) return 0;
    return Math.max(0, ownedCount(w, id) - placedCount(w, id));
  }
  /* with isle: only what may go there (canGoOn — scope, not locks) */
  function inventory(w, isle) {
    var out = [];
    Object.keys(w.owned).forEach(function (id) {
      if (isle != null && !canGoOn(id, isle)) return;
      var n = storedCount(w, id);
      if (n > 0) out.push({ id: id, count: n });
    });
    return out;
  }
  /* the legal cell nearest the preference (default: the island's centre) on that island only */
  function findSpot(w, id, prefX, prefY, isle) {
    var it = item(id), k = isleKey(isle), d = isleDef(k);
    if (!it || !isPlaceable(it) || isleGate(w, it, k)) return null;
    var land = landOf(w, k), o = occupancy(w, undefined, k);
    var px = isInt(prefX) ? prefX : d.centre[0], py = isInt(prefY) ? prefY : d.centre[1], best = null, bestD = 1e9;
    for (var y = 0; y < d.size[1]; y++) for (var x = 0; x < d.size[0]; x++) {
      if (!fits(it, x, y, land, o).ok) continue;
      var dd = (x - px) * (x - px) + (y - py) * (y - py);
      if (dd < bestD) { bestD = dd; best = { x: x, y: y }; }
    }
    return best;
  }
  /* place a stored copy (uid omitted) on isle (default Home), or move an existing
     instance (uid given) within the island it is on — never across islands (D20) */
  function place(u, id, x, y, uid, ms, isle) {
    var w = ensureWorld(u), it = item(id);
    if (!it) return { ok: false, code: 'unknown_item', reason: 'Unknown item.' };
    if (uid) {
      var from = isleOf(w, uid), inst = null, list = from !== null && isleDef(from) ? placedOn(w, from) : [];
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].uid === uid) inst = list[i];
      if (!inst || inst.id !== id) return { ok: false, code: 'not_found', reason: 'That object isn’t on your island.' };
      if (isle != null && isle !== from) return { ok: false, code: 'other_isle', reason: ISLE_TEXT.otherIsle };
      var chk = canPlace(w, id, x, y, uid, from);
      if (!chk.ok) return chk;
      inst.x = x; inst.y = y;
      if (from !== 'home') { var at = nowIso(ms); isleEntry(w, from, at).at = at; }
      if (from !== 'home' || isV3(it)) markV3(w);
      touch(w, ms);
      return { ok: true, uid: uid };
    }
    var k = isleKey(isle);
    if (storedCount(w, id) < 1) return { ok: false, code: 'none_stored', reason: 'You don’t have one of those to place.' };
    var c2 = canPlace(w, id, x, y, undefined, k);
    if (!c2.ok) return c2;
    var nu = newUid(w);
    if (k === 'home') w.placed.push({ uid: nu, id: id, x: x, y: y });
    else { var at2 = nowIso(ms), e = isleEntry(w, k, at2); e.placed.push({ uid: nu, id: id, x: x, y: y }); e.at = at2; }
    if (k !== 'home' || isV3(it)) markV3(w);
    touch(w, ms);
    return { ok: true, uid: nu };
  }
  /* back to the bag, from whichever island it is on */
  function store(u, uid, ms) {
    var w = ensureWorld(u), k = isleOf(w, uid);
    var list = k !== null && isleDef(k) ? placedOn(w, k) : [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || list[i].uid !== uid) continue;
      var it = item(list[i].id);
      if (it && it.kind === 'landmark') return { ok: false, code: 'landmark_stays', reason: ISLE_TEXT.landmarkStays };
      if (!isStorable(it)) return { ok: false, code: 'stays', reason: 'This one stays on your island — you can move it instead.' };
      list.splice(i, 1);
      if (k !== 'home') { var at = nowIso(ms); isleEntry(w, k, at).at = at; markV3(w); }
      touch(w, ms);
      return { ok: true };
    }
    return { ok: false, code: 'not_found', reason: 'Not found.' };
  }
  /* the colourway the child chose for one placed v3 thing ('Next colour' in edit mode): vr,
     an index 0–15 on that placement (the host passes the next index; the look clamps it). No
     vr = the look's own pick for that uid. A V4.54 thing never gets one, so V4.54 records
     stay as they are. A move keeps it; a copy put back in the bag forgets it. */
  function setVariant(u, uid, n, ms) {
    var w = ensureWorld(u), k = isleOf(w, uid);
    var list = k !== null && isleDef(k) ? placedOn(w, k) : [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || list[i].uid !== uid) continue;
      if (!isV3(list[i].id)) return { ok: false, code: 'home_thing', reason: 'That one has just the one colour.' };
      if (!isInt(n) || n < 0 || n > 15) return { ok: false, code: 'bad_variant', reason: 'Pick a colour.' };
      list[i].vr = n;
      if (k !== 'home') { var at = nowIso(ms); isleEntry(w, k, at).at = at; }
      markV3(w); touch(w, ms);
      return { ok: true, vr: n };
    }
    return { ok: false, code: 'not_found', reason: 'Not found.' };
  }

  /* ---------------- starter grant (exactly once per profile) ---------------- */
  function grantStarter(u, ms) {
    var w = ensureWorld(u);
    if (w.starterGrantedAt) return false;
    Object.keys(STARTER.owned).forEach(function (id) { w.owned[id] = Math.max(ownedCount(w, id), STARTER.owned[id]); });
    STARTER.placed.forEach(function (p) {
      if (canPlace(w, p.id, p.x, p.y).ok && storedCount(w, p.id) > 0) w.placed.push({ uid: newUid(w), id: p.id, x: p.x, y: p.y });
    });
    ensurePetRecord(w, 'pet_puppy');
    if (!w.activePet) w.activePet = 'pet_puppy';
    w.starterGrantedAt = nowIso(ms);
    w.ledger.push({ tx: 'starter', item: 'starter_pack', price: 0, at: w.starterGrantedAt, bal: isInt(u.points) ? u.points : 0 });
    touch(w, ms);
    return true;
  }

  /* ---------------- purchases ----------------
     purchase(u, itemId, {tx}) — the ONLY way points are spent here.
     Price always comes from CATALOG; callers cannot pass one.
     Same tx twice → returns the first result (idempotent). */
  /* opts.trial = the family's free test mode: the item costs 0 and the child's
     ⭐ are never touched; every other rule (catalogue, locks, one-offs) still applies */
  function purchaseCheck(u, id, opts) {
    var trial = !!(opts && opts.trial);
    var w = ensureWorld(u), it = item(id);
    if (!it) return { ok: false, code: 'unknown_item', reason: 'That isn’t in the shop.' };
    if (it.retired) return { ok: false, code: 'retired', reason: 'That’s no longer in the shop.' };
    if (it.starter || it.included) return { ok: false, code: 'not_for_sale', reason: 'That comes free with something else.' };
    if (!isInt(it.price) || it.price < 0) return { ok: false, code: 'bad_price', reason: 'Price problem.' };
    if (!isRepeatable(it) && owns(w, id)) return { ok: false, code: 'already_owned', reason: 'You already own this.' };
    var req = it.requires || [];
    for (var i = 0; i < req.length; i++) {
      if (!owns(w, req[i])) return { ok: false, code: 'locked', needs: req[i], reason: 'First you need: ' + (item(req[i]) ? item(req[i]).name : req[i]) + '.' };
    }
    if (trial) {
      if (ECONOMY.trialMaxCopies > 0 && isRepeatable(it) && ownedCount(w, id) >= ECONOMY.trialMaxCopies) return { ok: false, code: 'trial_cap', reason: 'You’ve got plenty of those for testing!' };
      return { ok: true, item: it, price: 0, trial: true };
    }
    var bal = isInt(u.points) ? u.points : 0;
    if (bal < it.price) return { ok: false, code: 'insufficient', need: it.price - bal, reason: 'You need ' + (it.price - bal) + ' more ⭐.' };
    return { ok: true, item: it, price: it.price };
  }
  function findTx(w, tx) {
    for (var i = w.ledger.length - 1; i >= 0; i--) if (w.ledger[i].tx === tx) return w.ledger[i];
    return null;
  }
  function purchase(u, id, opts) {
    opts = opts || {};
    var tx = opts.tx;
    if (typeof tx !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(tx)) return { ok: false, code: 'bad_tx', reason: 'Please try again.' };
    var w = ensureWorld(u);
    if (!isInt(u.points)) u.points = isInt(Math.round(u.points)) ? Math.round(u.points) : 0;
    var prior = findTx(w, tx);
    if (prior) {
      if (prior.item !== id) return { ok: false, code: 'tx_conflict', reason: 'Please try again.' };
      return { ok: true, replay: true, item: item(id), price: prior.price, balance: u.points, entry: prior };
    }
    var chk = purchaseCheck(u, id, opts);
    if (!chk.ok) return chk;
    var it = chk.item, ms = opts.now, charge = chk.trial ? 0 : it.price;
    /* commit — one synchronous mutation of the same profile object */
    u.points -= charge;
    w.owned[id] = ownedCount(w, id) + 1;
    w.spent += charge;
    (it.includes || []).forEach(function (inc) { if (!owns(w, inc)) w.owned[inc] = 1; });
    var entry = { tx: tx, item: id, price: charge, at: nowIso(ms), bal: u.points };
    if (chk.trial) { entry.trial = true; entry.list = it.price; }   /* tagged: decide at the end of testing */
    w.ledger.push(entry);
    var placedUid = null;
    /* a mascot joins the crew in crew3, never in w.pets; land gear is ownership only (the host puts it on the runner) */
    if (isMascot(it)) { ensureMascotRecord(w, id, entry.at); crew3Of(w).at = entry.at; }
    else if (it.kind === 'pet') ensurePetRecord(w, id);
    if (it.kind === 'style' || it.kind === 'cosmetic' || it.kind === 'variant') {
      if (it.multi) w.details[id] = true; else w.sel[it.slot] = id;
    }
    if (it.kind === 'attraction' || it.kind === 'house') {
      var spot = findSpot(w, id, opts.prefX, opts.prefY);
      if (spot) { placedUid = newUid(w); w.placed.push({ uid: placedUid, id: id, x: spot.x, y: spot.y }); }
    }
    var landIsle = it.kind === 'land' && isleDef(it.isle) ? it.isle : null;
    if (landIsle) placedUid = dropLandmark(w, landIsle, entry.at);
    if (isV3(it)) markV3(w);
    if (w.goal === id && !isRepeatable(it)) { w.goal = null; w.goalNotified = null; }
    if (w.goal3 === id && !isRepeatable(it)) { w.goal3 = null; w.goalNotified = null; }
    touch(w, ms);
    var res = { ok: true, item: it, price: charge, trial: !!chk.trial, balance: u.points, entry: entry, placedUid: placedUid };
    if (landIsle) res.isle = landIsle;
    return res;
  }
  /* a new land's landmark goes on its island: landmarkSpot when legal, else the nearest
     legal cell, else it waits unplaced for normalize (N7). A landmark already placed
     anywhere — a dormant island kept from before — is reused exactly as it was (D79).
     Returns the landmark's uid on its island, or null. */
  function dropLandmark(w, k, atIso) {
    var d = ISLES[k], lm = d.landmark, list = placedOn(w, k);
    if (placedCount(w, lm) > 0) {
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === lm) return list[i].uid || null;
      return null;
    }
    var s = d.landmarkSpot;
    var spot = canPlace(w, lm, s[0], s[1], undefined, k).ok ? { x: s[0], y: s[1] } : findSpot(w, lm, undefined, undefined, k);
    if (!spot) return null;
    var e = isleEntry(w, k, atIso), uid = newUid(w);
    e.placed.push({ uid: uid, id: lm, x: spot.x, y: spot.y });
    e.at = atIso;
    return uid;
  }
  /* the tx a host should use: a v3 one-off (a land, a fun item, a mascot or a piece of gear
     with an isle) gets the same id on every fork ('v3_<id>_<n>', n = rows already recorded
     for it), so even a stale V4.54 merge unions two purchases of it into ONE row and one
     charge. Repeatable decor and paths keep random ids (N3 heals their counts). */
  var FIXED_TX = { land: 1, fun: 1, pet: 1, acc: 1 };
  function purchaseTx(w, id, randomTx) {
    var it = item(id);
    if (!it || !it.isle || !FIXED_TX[it.kind]) return randomTx;
    var n = 0, led = w && Array.isArray(w.ledger) ? w.ledger : [];
    for (var i = 0; i < led.length; i++) if (led[i] && led[i].item === id) n++;
    return 'v3_' + id + '_' + n;
  }

  /* ---------------- commit protocol (used by the UI for every change) ----------------
     store = { read(): stateObj (fresh parse of persisted storage), write(stateObj) }
     1. read the PERSISTED state (never trust a possibly-stale in-memory copy),
     2. check the profile is still the active one,
     3. apply the change to that fresh copy,
     4. write once,
     5. read back and confirm the change is really stored before reporting success.
     The browser wraps this in navigator.locks so two tabs can't interleave. */
  function transact(store, userName, mutate, verify) {
    var st;
    try { st = store.read(); } catch (e) { return { ok: false, code: 'read_failed', reason: 'Couldn’t load your island — please try again.' }; }
    if (!st || !st.users || !st.users[userName]) return { ok: false, code: 'no_profile', reason: 'That player isn’t here.' };
    if (st.activeUser !== userName) return { ok: false, code: 'profile_changed', reason: 'A different player is signed in now.' };
    var u = st.users[userName];
    ensureWorld(u);
    var res = mutate(u);
    if (!res || !res.ok || res.replay) return res;
    /* a store that mirrors writes into live memory must offer rollback(): a save
       that fails or doesn't read back leaves memory exactly as it was */
    function undo() { try { if (store.rollback) store.rollback(); } catch (e) {} }
    try { store.write(st); } catch (e) { undo(); return { ok: false, code: 'write_failed', reason: 'Couldn’t save — nothing was spent. Please try again.' }; }
    var back;
    try { back = store.read(); } catch (e) { back = null; }
    var bu = back && back.users && back.users[userName];
    if (!bu || !verify(bu)) { undo(); return { ok: false, code: 'not_saved', reason: 'Couldn’t save — nothing was spent. Please try again.' }; }
    res.state = st;
    return res;
  }
  function transactPurchase(store, userName, id, opts) {
    return transact(store, userName, function (u) { return purchase(u, id, opts); },
      function (bu) { return !!(bu.world && findTx(ensureWorld(bu), opts.tx)); });
  }

  /* ---------------- savings goal ----------------
     A V4.54 id lives in w.goal; a v3 id in w.goal3 (an old client's normalize clears any
     w.goal it does not know). Setting one clears the other; goalId() reads either. */
  function setGoal(u, id, ms) {
    var w = ensureWorld(u), it = item(id);
    if (id === null) { w.goal = null; if (w.goal3) w.goal3 = null; w.goalNotified = null; touch(w, ms); return { ok: true }; }
    if (!it || it.retired || it.starter || it.included) return { ok: false };
    if (!isRepeatable(it) && owns(w, id)) return { ok: false, reason: 'You already own this.' };
    /* a goal must be buyable once saved for — a locked item can't be the goal */
    var missing = (it.requires || []).filter(function (r) { return !owns(w, r); });
    if (missing.length) return { ok: false, code: 'locked', needs: missing[0], reason: 'You need the ' + (item(missing[0]) || {}).name + ' first.' };
    if (isV3(it)) { w.goal3 = id; w.goal = null; markV3(w); }
    else { w.goal = id; if (w.goal3) w.goal3 = null; }
    w.goalNotified = null; touch(w, ms);
    return { ok: true };
  }
  function goalId(w) { return (w && (w.goal || w.goal3)) || null; }
  function goalProgress(u) {
    var w = ensureWorld(u), gid = goalId(w), it = gid ? item(gid) : null;
    if (!it) return null;
    var bal = isInt(u.points) ? u.points : 0;
    var locked = (it.requires || []).some(function (r) { return !owns(w, r); });   /* old saves only */
    return { id: it.id, name: it.name, price: it.price, have: bal, pct: it.price ? Math.min(100, Math.floor(bal * 100 / it.price)) : 100, ready: !locked && bal >= it.price, locked: locked, need: Math.max(0, it.price - bal) };
  }

  /* ---------------- normalise: no impossible states survive a load ----------------
     Never touches u.points, pointsEarned, spent or a ledger row; never bumps an island's
     'at'; adds nothing to a V4.53/V4.54 save that is already normal (zero-diff load).
     Idempotent: a second call returns false and leaves the JSON identical. */
  function isEntry(p) { return !!p && typeof p === 'object'; }
  /* normalize's probe for one island: the copies accepted so far, with their occupancy built
     up as each one is added — the same map occupancy() would read from them, without
     re-reading the whole list for every copy checked */
  function probeOf(w, k) {
    var pr = { owned: w.owned, placed: [], o: { occ: {}, reserved: {} } };
    if (k !== 'home') {
      pr.isles = {}; pr.isles[k] = { placed: pr.placed }; pr.o.dock = {};
      Object.keys(ISLE_DOCK[k]).forEach(function (c) { pr.o.dock[c] = 1; pr.o.reserved[c] = 'dock'; });
    }
    return pr;
  }
  function probeAdd(pr, p) {
    var it = item(p.id), layer = it.kind === 'path' ? 'ground' : 'object';
    pr.placed.push(p);
    fpCells(it, p.x, p.y).forEach(function (c) { pr.o.occ[c] = { uid: p.uid, id: p.id, layer: layer }; });
    entranceCells(it, p.x, p.y).forEach(function (c) { pr.o.reserved[c] = p.uid; });
  }
  /* = canPlace(pr, p.id, p.x, p.y, undefined, k).ok */
  function probeFits(pr, it, p, k) {
    if (!isPlaceable(it) || !isInt(p.x) || !isInt(p.y) || isleGate(pr, it, k)) return false;
    return fits(it, p.x, p.y, landOf(pr, k), pr.o).ok;
  }
  /* the first owned record in w.pets that an old client may have as its runner (never a v3 id) */
  function firstOwnedPet(w) {
    for (var i = 0; i < w.pets.length; i++) if (isEntry(w.pets[i]) && owns(w, w.pets[i].id) && !isV3(w.pets[i].id)) return w.pets[i];
    return null;
  }
  /* an accessory a crew3 slot may keep: known → the right kind in its own slot and owned;
     unknown but owned → future data, kept (and never shown) */
  function slotKeeps(w, slot, g, gearOnly) {
    var a = item(g);
    if (!a) return typeof g === 'string' && owns(w, g);
    return a.kind === 'acc' && (!gearOnly || !!a.isle) && a.slot === slot && owns(w, g);
  }
  /* N9b (the crew section has the layout). Afterwards an old client finds only V4.54 ids in
     w.pets, w.activePet and every p.acc, and crew3 holds one sound record per owned mascot.
     The block is created only when something has to go in it, so a save with no mascot and
     no stray v3 id is left exactly as it was. Never touches crew3.at (a block it has to
     create gets the epoch), points, spent or the ledger. */
  function normalizeCrew3(w) {
    var changed = false, c = crew3Of(w);
    var block = function () { if (!c) { c = crew3Entry(w, EPOCH); changed = true; } return c; };
    if (c) {
      if (!Array.isArray(c.pets)) { c.pets = []; changed = true; }
      if (!plainObj(c.acc)) { c.acc = {}; changed = true; }
      if (typeof c.at !== 'string') { c.at = EPOCH; changed = true; }
    }
    /* b a mascot's record found in w.pets moves to crew3 with its name and outfit (unless it has
       one there); a record under any other v3 id is no pet at all and goes */
    var stay = w.pets.filter(function (p) {
      if (!isEntry(p) || !isV3(p.id)) return true;
      if (isMascot(p.id) && !mascotRec(w, p.id)) block().pets.push(p);
      return false;
    });
    if (stay.length !== w.pets.length) { w.pets = stay; changed = true; }
    /* a one record per mascot, the first wins; a V4.54 species has no place here; a record with
       an unknown id is future data, kept as it is; every owned mascot has a record */
    if (c) {
      var seen = {}, recs = c.pets.filter(function (r) {
        if (!plainObj(r) || typeof r.id !== 'string') return false;
        var it = item(r.id);
        if (!it) return true;
        if (!isMascot(it) || has(seen, r.id)) return false;
        seen[r.id] = 1;
        if (typeof r.name !== 'string' || !r.name.trim()) { r.name = DEFAULT_PET_NAMES[r.id] || 'Buddy'; changed = true; }
        if (!plainObj(r.acc)) { r.acc = {}; changed = true; }
        return true;
      });
      if (recs.length !== c.pets.length) { c.pets = recs; changed = true; }
    }
    CATALOG.forEach(function (it) {
      if (!isMascot(it) || !owns(w, it.id) || mascotRec(w, it.id)) return;
      block().pets.push({ id: it.id, name: DEFAULT_PET_NAMES[it.id] || 'Buddy', acc: {} });
      changed = true;
    });
    /* c a mascot in w.activePet becomes the crew3 runner; the first owned V4.54 pet is its
       understudy and takes w.activePet (as it does from any other v3 id found there) */
    if (isV3(w.activePet)) {
      var first = firstOwnedPet(w), under = first ? first.id : null;
      if (isMascot(w.activePet)) { block().active = w.activePet; c.over = under; }
      w.activePet = under; changed = true;
    }
    /* d land gear in a V4.54 pet's own acc moves to crew3.acc (unless that slot already holds
       gear there); no other v3 id belongs in a p.acc */
    w.pets.forEach(function (p) {
      if (!isEntry(p) || !plainObj(p.acc)) return;
      Object.keys(p.acc).forEach(function (slot) {
        var g = p.acc[slot];
        if (!isV3(g)) return;
        if (isLandGear(g) && isOldPet(p.id)) {
          var m = block().acc;
          if (!plainObj(m[p.id])) m[p.id] = {};
          if (!has(m[p.id], slot) || !slotKeeps(w, slot, m[p.id][slot], true)) m[p.id][slot] = g;
        }
        delete p.acc[slot]; changed = true;
      });
    });
    if (c) {
      /* e crew3.acc holds owned land gear, slot by slot, for V4.54 pets with a record; where the
         pet's own acc has that slot too, the old client's choice wins (unknown pet ids: kept) */
      Object.keys(c.acc).forEach(function (pid) {
        if (!item(pid)) return;
        var p = isOldPet(pid) ? petById(w, pid) : null, m = c.acc[pid];
        if (p && plainObj(m)) {
          Object.keys(m).forEach(function (slot) {
            if (!slotKeeps(w, slot, m[slot], true) || (plainObj(p.acc) && p.acc[slot])) { delete m[slot]; changed = true; }
          });
        }
        if (!p || !plainObj(m) || !Object.keys(m).length) { delete c.acc[pid]; changed = true; }
      });
      /* f a mascot wears owned accessories, each in its own slot */
      c.pets.forEach(function (r) {
        if (!isMascot(r.id)) return;
        Object.keys(r.acc).forEach(function (slot) { if (!slotKeeps(w, slot, r.acc[slot], false)) { delete r.acc[slot]; changed = true; } });
      });
      /* g the mascot runner is owned, has a record and its understudy is still w.activePet — else
         nobody is (an old client's newer choice of runner wins; a mascot taken back steps down) */
      if (c.active !== null || c.over !== null) {
        if (activePetId(w) !== c.active || !isMascot(c.active)) { c.active = null; c.over = null; changed = true; }
        else if (c.over === undefined) { c.over = null; changed = true; }
      }
    }
    if (changed) markV3(w);
    return changed;
  }
  function normalize(u) {
    var w = ensureWorld(u);
    var changed = false;
    /* N1 owned counts are whole and never negative; one-offs at most 1 */
    Object.keys(w.owned).forEach(function (id) {
      var n = w.owned[id];
      if (!isInt(n) || n < 0) { w.owned[id] = Math.max(0, Math.floor(+n || 0)); changed = true; }
      var it = item(id);
      if (it && !isRepeatable(it) && w.owned[id] > 1) { w.owned[id] = 1; changed = true; }
    });
    /* N2 included items always come with their parent (a land always owns its landmark) */
    CATALOG.forEach(function (it) {
      if (owns(w, it.id)) (it.includes || []).forEach(function (inc) { if (!owns(w, inc)) { w.owned[inc] = 1; changed = true; } });
    });
    /* N3 heal: an old merge takes max(owned), so a v3 repeatable bought on two forks can come
       back short of its ledger rows. Raise it to them; never lower; V4.54 ids untouched.
       Rows a test-mode clean-up marked void: true never count (D79). */
    var rows = Object.create(null);
    w.ledger.forEach(function (e) { if (isEntry(e) && e.void !== true && typeof e.item === 'string') rows[e.item] = (rows[e.item] || 0) + 1; });
    CATALOG.forEach(function (it) {
      if (!it.isle || !isRepeatable(it) || !has(rows, it.id)) return;
      if (rows[it.id] > ownedCount(w, it.id)) { w.owned[it.id] = rows[it.id]; changed = true; }
    });
    /* N8 (first half) nextUid above every numeric 'p' suffix on any island, so no repair below
       can hand out a uid that is already in use */
    var maxUid = 0;
    allLists(w).forEach(function (l) {
      l.list.forEach(function (p) { var m = isEntry(p) && typeof p.uid === 'string' && /^p(\d+)$/.exec(p.uid); if (m) maxUid = Math.max(maxUid, +m[1]); });
    });
    if (w.nextUid <= maxUid) { w.nextUid = maxUid + 1; changed = true; }
    /* N4 Home placements: unknown ids are kept untouched (future data); too many copies trimmed
       (copies are counted over every island, Home first); illegal positions: house/attractions
       re-homed, everything else back to the bag. Checked in the order house/attractions, other
       V4.54 ids, then v3 ids — so where an old client put something on the cell of a v3 thing it
       could not see, the child's visible V4.54 thing stays and the v3 one goes to the bag. */
    var seenCount = {}, keep = [], placedChanged = false;
    var rank = function (p) {
      var it = isEntry(p) ? item(p.id) : null;
      return it && (it.kind === 'house' || it.kind === 'attraction') ? 0 : it && it.isle ? 2 : 1;
    };
    var order = w.placed.slice().sort(function (a, b) { return rank(a) - rank(b); });
    var probe = probeOf(w, 'home');
    order.forEach(function (p) {
      var it = isEntry(p) ? item(p.id) : null;
      if (!it) { keep.push(p); return; }
      if (!p.uid) { p.uid = newUid(w); placedChanged = true; }
      seenCount[p.id] = (seenCount[p.id] || 0) + 1;
      if (seenCount[p.id] > ownedCount(w, p.id)) { placedChanged = true; return; }
      if (!probeFits(probe, it, p, 'home')) {
        placedChanged = true;
        if (it.kind === 'house' || it.kind === 'attraction') {
          var s = findSpot(probe, p.id, p.x, p.y, 'home');
          if (s) { p.x = s.x; p.y = s.y; } else { return; }
        } else return;        /* a landmark found on Home leaves here; N7 puts it back on its own island */
      }
      probeAdd(probe, p); keep.push(p);
    });
    /* only a placement repair rewrites placed[], and it keeps the save's own order (the
       house/attractions-first pass order is for checking, not for storing) */
    if (placedChanged) { w.placed = w.placed.filter(function (p) { return keep.indexOf(p) >= 0; }); changed = true; }
    /* N5 sky islands in ISLE_ORDER (unknown island keys are left untouched). A dormant island
       (its land not owned) is kept exactly as it is, but its copies still count as placed.
       Otherwise the landmark is checked first, then the save order: an illegal landmark moves to
       the nearest legal cell (else waits for N7); anything else illegal, any V4.54 id while
       LEGACY_SKY is false, and any copy beyond owned goes back to the bag. */
    var isl = islesOf(w);
    ISLE_ORDER.forEach(function (k) {
      var list = k !== 'home' && skyList(w, k);
      if (!list) return;
      if (!isleUnlocked(w, k)) {
        list.forEach(function (p) { if (isEntry(p) && item(p.id)) seenCount[p.id] = (seenCount[p.id] || 0) + 1; });
        return;
      }
      var lmFirst = function (p) { var it = isEntry(p) ? item(p.id) : null; return it && it.kind === 'landmark' ? 0 : 1; };
      var ord = list.slice().sort(function (a, b) { return lmFirst(a) - lmFirst(b); });
      var pr = probeOf(w, k), kept = [], fixed = false;
      ord.forEach(function (p) {
        var it = isEntry(p) ? item(p.id) : null;
        if (!it) { kept.push(p); return; }
        if (!p.uid) { p.uid = newUid(w); fixed = true; }
        seenCount[p.id] = (seenCount[p.id] || 0) + 1;
        if (seenCount[p.id] > ownedCount(w, p.id)) { fixed = true; return; }
        if (!probeFits(pr, it, p, k)) {
          fixed = true;
          if (it.kind !== 'landmark') return;
          var s = findSpot(pr, p.id, p.x, p.y, k);
          if (s) { p.x = s.x; p.y = s.y; } else return;
        }
        probeAdd(pr, p); kept.push(p);
      });
      if (fixed) { isl[k].placed = list.filter(function (p) { return kept.indexOf(p) >= 0; }); changed = true; }
    });
    /* N6 owned house/attractions that aren't placed get a spot if one exists */
    CATALOG.forEach(function (it) {
      if ((it.kind === 'house' || it.kind === 'attraction') && owns(w, it.id) && placedCount(w, it.id) === 0) {
        var s2 = findSpot(w, it.id);
        if (s2) { w.placed.push({ uid: newUid(w), id: it.id, x: s2.x, y: s2.y }); changed = true; }
      }
    });
    /* N7 every owned landmark of an owned land stands on its own island: landmarkSpot when
       legal, else the nearest legal cell. No room → it waits; the next normalize retries. */
    ISLE_ORDER.forEach(function (k) {
      var d = ISLES[k], lm = d.landmark;
      if (!lm || !owns(w, lm) || !isleUnlocked(w, k) || countIn(placedOn(w, k), lm) > 0) return;
      var s3 = d.landmarkSpot;
      var spot = canPlace(w, lm, s3[0], s3[1], undefined, k).ok ? { x: s3[0], y: s3[1] } : findSpot(w, lm, undefined, undefined, k);
      if (!spot) return;
      isleEntry(w, k, EPOCH).placed.push({ uid: newUid(w), id: lm, x: spot.x, y: spot.y });
      markV3(w); changed = true;
    });
    /* N8 uids are unique across Home, every island and unknown island lists: the first one met
       (Home, then ISLE_ORDER, then unknown keys) keeps it, a later twin gets a fresh uid */
    var seenUid = Object.create(null);
    allLists(w).forEach(function (l) {
      l.list.forEach(function (p) {
        if (!isEntry(p) || typeof p.uid !== 'string' || !p.uid) return;
        if (seenUid[p.uid]) { p.uid = newUid(w); changed = true; }
        seenUid[p.uid] = 1;
      });
    });
    /* N9 pets (the V4.54 rule, for V4.54 pets: a mascot never gets a w.pets record and is never w.activePet) */
    CATALOG.forEach(function (it) { if (it.kind === 'pet' && !it.isle && owns(w, it.id) && !petById(w, it.id)) { ensurePetRecord(w, it.id); changed = true; } });
    w.pets.forEach(function (p) {
      if (!p.acc || typeof p.acc !== 'object') { p.acc = {}; changed = true; }
      Object.keys(p.acc).forEach(function (slot) { if (!owns(w, p.acc[slot])) { delete p.acc[slot]; changed = true; } });
    });
    if (w.activePet && !owns(w, w.activePet)) { w.activePet = null; changed = true; }
    if (!w.activePet) { var firstPet = firstOwnedPet(w); if (firstPet) { w.activePet = firstPet.id; changed = true; } }
    /* N9b mascots and land gear live in crew3; w.pets, w.activePet and every p.acc stay pure V4.54 */
    if (normalizeCrew3(w)) changed = true;
    /* N10 selections must be owned */
    Object.keys(w.sel).forEach(function (slot) { if (!owns(w, w.sel[slot])) { delete w.sel[slot]; changed = true; } });
    Object.keys(w.details).forEach(function (id) { if (!owns(w, id)) { delete w.details[id]; changed = true; } });
    /* N11 goals must still be buyable. A v3 id never stays in w.goal (an old client would
       clear it): it moves to goal3. goal3 holds only a buyable v3 id. If an old client chose
       a goal while goal3 was set, both are set: its (newer) choice wins. */
    if (w.goal) {
      var g = item(w.goal);
      if (g && g.isle) {
        if (!w.goal3) { w.goal3 = w.goal; markV3(w); }
        w.goal = null; changed = true;
      } else if (!g || g.retired || (!isRepeatable(g) && owns(w, w.goal))) { w.goal = null; changed = true; }
    }
    if (w.goal3) {
      var g3 = item(w.goal3);
      if (!g3 || !g3.isle || g3.retired || g3.starter || g3.included || (!isRepeatable(g3) && owns(w, w.goal3)) || w.goal) { w.goal3 = null; changed = true; }
    }
    return changed;
  }

  /* ---------------- arcade time (parent limit) ---------------- */
  var ARCADE = { graceMaxSec: 120, warnSec: 60, keepDays: 14 };
  function dayKey(ms, tz) {
    try {
      var f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
      return f.format(new Date(ms));
    } catch (e) {
      var d = new Date(ms);
      return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
    }
  }
  function arcadeUsed(w, day) { var s = w.arcade.days[day]; return isInt(s) && s > 0 ? s : 0; }
  function arcadeAdd(u, day, secs) {
    var w = ensureWorld(u);
    if (!(secs > 0)) return arcadeUsed(w, day);
    w.arcade.days[day] = arcadeUsed(w, day) + Math.round(secs);
    var keys = Object.keys(w.arcade.days).sort();
    keys.slice(0, Math.max(0, keys.length - ARCADE.keepDays)).forEach(function (k) { delete w.arcade.days[k]; });
    return w.arcade.days[day];
  }
  /* raise (never lower) a day's total to a value already counted elsewhere */
  function arcadeMax(u, day, secs) {
    var w = ensureWorld(u);
    var v = Math.round(secs);
    if (!(v > arcadeUsed(w, day))) return false;
    w.arcade.days[day] = v;
    var keys = Object.keys(w.arcade.days).sort();
    keys.slice(0, Math.max(0, keys.length - ARCADE.keepDays)).forEach(function (k) { delete w.arcade.days[k]; });
    return true;
  }
  /* cfg = families/{code}.arcade = {dailyMinutes, tz} (owner-written) */
  function arcadeStatus(cfg, usedSec) {
    var mins = cfg && isInt(cfg.dailyMinutes) && cfg.dailyMinutes > 0 ? cfg.dailyMinutes : null;
    if (!mins) return { limited: false, usedSec: usedSec, leftSec: Infinity, exhausted: false, warn: false, hardStopAtUsed: Infinity };
    var limitSec = mins * 60, left = Math.max(0, limitSec - usedSec);
    return { limited: true, limitSec: limitSec, usedSec: usedSec, leftSec: left, exhausted: left <= 0, warn: left > 0 && left <= ARCADE.warnSec, hardStopAtUsed: limitSec + ARCADE.graceMaxSec };
  }
  /* Called when a round wants to start. A round may only START with time
     left; once started it may finish, but never beyond limit + graceMaxSec
     of total use — restarts don't reset that ceiling. */
  function roundGate(status) {
    if (!status.limited) return { allowed: true, hardStopAtUsed: Infinity };
    if (status.exhausted) return { allowed: false, reason: 'time' };
    return { allowed: true, hardStopAtUsed: status.limitSec + ARCADE.graceMaxSec };
  }

  /* ---------------- personal bests (never touch points) ---------------- */
  var GAME_RULES = {
    course:  { better: 'higher', maxScore: 5000 },
    penalty: { better: 'higher', shots: 8, maxScore: 8 * 150 },
    kart:    { better: 'lower', minMs: 30000, maxMs: 30 * 60000 }   /* no track can be finished in under ~50 s */
  };
  function validResult(game, r) {
    var g = GAME_RULES[game]; if (!g || !r || typeof r !== 'object') return false;
    if (game === 'kart') return r.finished === true && isInt(r.ms) && r.ms >= g.minMs && r.ms <= g.maxMs;
    return isInt(r.score) && r.score >= 0 && r.score <= g.maxScore;
  }
  function recordResult(u, game, variant, r, ms) {
    var w = ensureWorld(u);
    if (!validResult(game, r)) return { ok: false, isPB: false };
    var key = game + ':' + String(variant || 'std').replace(/[^a-z0-9_]/gi, '').slice(0, 30);
    var prev = w.pb[key] || null, g = GAME_RULES[game];
    var val = g.better === 'lower' ? r.ms : r.score;
    var prevVal = prev ? (g.better === 'lower' ? prev.ms : prev.score) : null;
    var isPB = prev == null || (g.better === 'lower' ? val < prevVal : val > prevVal);
    if (isPB) {
      var rec = { at: nowIso(ms) };
      if (g.better === 'lower') rec.ms = r.ms; else rec.score = r.score;
      if (isInt(r.extra)) rec.extra = r.extra;
      w.pb[key] = rec; touch(w, ms);
    }
    return { ok: true, isPB: isPB, prev: prev, key: key };
  }

  /* ---------------- merging two forks of one profile (Control Centre) ----------------
     Ledger is unioned by tx; the spendable balance becomes
     max(each side's balance + its island spend) − union island spend,
     so an island purchase on either side is paid for exactly once.
     v3: each sky island's layout comes whole from the fork that changed it last
     (isles[k].at), so does the crew3 block (crew3.at), and the v3 normalize then settles
     copies, uids, landmarks, goals and the crew. */
  function mergeWorlds(nU, gU) {
    if (!nU.world && !gU.world) return null;
    /* a side without a world simply spent nothing here */
    var nw = ensureWorld({ world: nU.world ? JSON.parse(JSON.stringify(nU.world)) : emptyWorld() });
    var gw = ensureWorld({ world: gU.world ? JSON.parse(JSON.stringify(gU.world)) : emptyWorld() });
    /* M1 union by tx. Both forks can hold the same tx (a v3 one-off's fixed tx): the PAID row
       beats a test-mode row, then the earlier one */
    var byTx = Object.create(null);
    nw.ledger.concat(gw.ledger).forEach(function (e) {
      if (!e || !e.tx) return;
      var k = byTx[e.tx];
      if (!k || (k.trial && !e.trial) || (!k.trial === !e.trial && (e.at || '') < (k.at || ''))) byTx[e.tx] = e;
    });
    /* a one-off item bought on BOTH forks is kept once and paid for once (earliest row wins) */
    var rows = Object.keys(byTx).map(function (k) { return byTx[k]; }).sort(function (a, b) { return (a.at || '') < (b.at || '') ? -1 : (a.at || '') > (b.at || '') ? 1 : (a.tx < b.tx ? -1 : 1); });
    /* for each one-off item keep ONE row: the earliest paid row if there is one
       (so a real payment is never relabelled as a free test item), else the earliest row.
       A void row (undone by a test-mode clean-up) is kept as a record but never chosen. */
    var keepUnique = {};
    rows.forEach(function (e) {
      var it = item(e.item); if (!it || isRepeatable(it) || e.void === true) return;
      var k = keepUnique[e.item];
      if (!k || (k.trial && !e.trial)) keepUnique[e.item] = e;
    });
    var spentUnion = 0;
    rows = rows.filter(function (e) {
      var it = item(e.item);
      if (it && !isRepeatable(it) && e.void !== true && keepUnique[e.item] !== e) return false;
      spentUnion += isInt(e.price) ? e.price : 0;
      return true;
    });
    /* a trimmed ledger (synced copies keep the last 1000 rows) can under-count */
    spentUnion = Math.max(spentUnion, nw.spent || 0, gw.spent || 0);
    var baseSrc = !nU.world ? gw : !gU.world ? nw : ((nw.updatedAt || '') >= (gw.updatedAt || '') ? nw : gw);
    var base = JSON.parse(JSON.stringify(baseSrc));
    base.ledger = rows;
    base.owned = {};
    [nw, gw].forEach(function (src) { Object.keys(src.owned || {}).forEach(function (id) { base.owned[id] = Math.max(base.owned[id] || 0, src.owned[id] || 0); }); });
    /* repeatable copies: count purchases in the union ledger (void rows never count) + starter copies */
    Object.keys(base.owned).forEach(function (id) {
      var it = item(id); if (!isRepeatable(it)) return;
      var bought = 0; base.ledger.forEach(function (e) { if (e.item === id && e.void !== true) bought++; });
      base.owned[id] = Math.max(bought + (STARTER.owned[id] || 0), nw.owned[id] || 0, gw.owned[id] || 0);
    });
    base.spent = spentUnion;
    /* M3 each sky island's layout is copied whole from the fork that changed it last (ties: the
       base fork), so one island is never a mix of two forks. Two V4.54 forks gain nothing. */
    var ni = islesOf(nw), gi = islesOf(gw);
    if (ni || gi) {
      var bi = baseSrc === nw ? ni : gi, oi = baseSrc === nw ? gi : ni, isles = {};
      var atOf = function (e) { return e && typeof e === 'object' && typeof e.at === 'string' ? e.at : ''; };
      Object.keys(bi || {}).forEach(function (k) { isles[k] = bi[k]; });
      Object.keys(oi || {}).forEach(function (k) { if (!has(isles, k) || atOf(oi[k]) > atOf(isles[k])) isles[k] = oi[k]; });
      base.isles = JSON.parse(JSON.stringify(isles));
    }
    /* M3b the crew3 block comes whole from the fork that changed it last (ties: the base fork);
       a mascot only the other fork has a record for is added with its name and outfit. The
       normalize below settles the rest. Two forks without crew3 gain nothing. */
    var nc = crew3Of(nw), gc = crew3Of(gw);
    if (nc || gc) {
      var bc = baseSrc === nw ? nc : gc, oc = baseSrc === nw ? gc : nc;
      var crewAt = function (c) { return c && typeof c.at === 'string' ? c.at : ''; };
      var win = bc && !(oc && crewAt(oc) > crewAt(bc)) ? bc : oc, lose = win === bc ? oc : bc;
      var crew = JSON.parse(JSON.stringify(win));
      if (lose && Array.isArray(lose.pets)) {
        if (!Array.isArray(crew.pets)) crew.pets = [];
        lose.pets.forEach(function (r) {
          if (!plainObj(r) || typeof r.id !== 'string') return;
          if (!crew.pets.some(function (q) { return plainObj(q) && q.id === r.id; })) crew.pets.push(JSON.parse(JSON.stringify(r)));
        });
      }
      base.crew3 = crew;
    }
    /* M4 the newer data version of the two (only once either side is a v3 save) */
    var vN = nU.world && isInt(nU.world.v) ? nU.world.v : 0, vG = gU.world && isInt(gU.world.v) ? gU.world.v : 0;
    if (Math.max(vN, vG) >= VERSION) base.v = Math.max(vN, vG);
    /* personal bests: the better of both sides, whichever side is the base */
    base.pb = {};
    [nw, gw].forEach(function (src) {
      Object.keys(src.pb || {}).forEach(function (k) {
        var a = base.pb[k], b = src.pb[k], g = GAME_RULES[k.split(':')[0]];
        if (!b) return;
        if (!a) { base.pb[k] = b; return; }
        if (g && (g.better === 'lower' ? b.ms < a.ms : b.score > a.score)) base.pb[k] = b;
      });
    });
    /* arcade minutes: per-day larger value (never summed — same play could be on both) */
    base.arcade = { days: {} };
    [nw, gw].forEach(function (src) {
      var dd = (src.arcade && src.arcade.days) || {};
      Object.keys(dd).forEach(function (d) { if (isInt(dd[d])) base.arcade.days[d] = Math.max(base.arcade.days[d] || 0, dd[d]); });
    });
    if (!base.starterGrantedAt) base.starterGrantedAt = nw.starterGrantedAt || gw.starterGrantedAt;
    /* points: the larger balance BEFORE any island spending, minus everything
       either side spent here — so a spend is never refunded and never doubled */
    var preN = (isInt(nU.points) ? nU.points : 0) + (nw.spent || 0), preG = (isInt(gU.points) ? gU.points : 0) + (gw.spent || 0);
    var points = Math.max(0, Math.max(preN, preG) - spentUnion);
    var tmp = { points: points, world: base };
    normalize(tmp);
    return { world: tmp.world, points: points };
  }

  /* ---------------- shop presentation helpers ---------------- */
  function itemState(u, id, opts) {
    var w = ensureWorld(u), it = item(id);
    if (!it) return { state: 'missing' };
    var trial = !!(opts && opts.trial);
    var bal = isInt(u.points) ? u.points : 0;
    if (!isRepeatable(it) && owns(w, id)) return { state: 'owned' };
    var req = (it.requires || []).filter(function (r) { return !owns(w, r); });
    if (req.length) return { state: 'locked', needs: req };
    if (trial) {
      if (ECONOMY.trialMaxCopies > 0 && isRepeatable(it) && ownedCount(w, id) >= ECONOMY.trialMaxCopies) return { state: 'capped', copies: ownedCount(w, id) };
      return { state: 'affordable', free: true, copies: isRepeatable(it) ? ownedCount(w, id) : 0 };
    }
    if (bal >= it.price) return { state: 'affordable', copies: isRepeatable(it) ? ownedCount(w, id) : 0 };
    return { state: 'short', need: it.price - bal, copies: isRepeatable(it) ? ownedCount(w, id) : 0 };
  }
  function sessionsFor(price) { return Math.max(0, Math.round(price / ECONOMY.sessionPts * 10) / 10); }
  function shopItems() {
    return CATALOG.filter(function (it) { return !it.starter && !it.included && !it.retired; });
  }
  /* read-only: one-off ids with more than one (non-void) ledger row — e.g. a v3 one-off two
     forks bought with random tx ids, which a stale merge would have charged twice */
  function auditLedger(w) {
    var by = Object.create(null), order = [];
    (w && Array.isArray(w.ledger) ? w.ledger : []).forEach(function (e) {
      if (!e || e.void === true) return;
      var it = item(e.item); if (!it || isRepeatable(it)) return;
      if (!by[e.item]) { by[e.item] = { item: e.item, txs: [], paidRows: 0 }; order.push(e.item); }
      by[e.item].txs.push(e.tx);
      if (!e.trial && isInt(e.price) && e.price > 0) by[e.item].paidRows++;
    });
    return order.filter(function (id) { return by[id].txs.length > 1; }).map(function (id) { return by[id]; });
  }

  return {
    VERSION: VERSION, COLS: COLS, ROWS: ROWS, ECONOMY: ECONOMY, REGIONS: REGIONS, REGION_CELLS: REGION_CELLS,
    CELL_REGION: CELL_REGION, CATALOG: CATALOG, DEFAULTS: DEFAULTS, STARTER: STARTER, ARCADE: ARCADE, GAME_RULES: GAME_RULES,
    item: item, isRepeatable: isRepeatable, isPlaceable: isPlaceable, isStorable: isStorable,
    ensureWorld: ensureWorld, emptyWorld: emptyWorld, normalize: normalize, grantStarter: grantStarter,
    owns: owns, ownedCount: ownedCount, storedCount: storedCount, placedCount: placedCount, inventory: inventory,
    unlockedRegions: unlockedRegions, landSet: landSet, fpCells: fpCells, entranceCells: entranceCells,
    occupancy: occupancy, canPlace: canPlace, findSpot: findSpot, place: place, store: store,
    purchaseCheck: purchaseCheck, purchase: purchase, findTx: findTx, transact: transact, transactPurchase: transactPurchase,
    setGoal: setGoal, goalProgress: goalProgress,
    validatePetName: validatePetName, renamePet: renamePet, setActivePet: setActivePet, equipAccessory: equipAccessory, petById: petById,
    selected: selected, select: select,
    dayKey: dayKey, arcadeUsed: arcadeUsed, arcadeAdd: arcadeAdd, arcadeMax: arcadeMax, arcadeStatus: arcadeStatus, roundGate: roundGate,
    validResult: validResult, recordResult: recordResult,
    mergeWorlds: mergeWorlds, itemState: itemState, sessionsFor: sessionsFor, shopItems: shopItems,
    /* v3: the islands */
    ISLES: ISLES, ISLE_ORDER: ISLE_ORDER, ISLE_CELLS: ISLE_CELLS, LEGACY_SKY: LEGACY_SKY, ACTS: ACTS,
    isV3: isV3, scopeOf: scopeOf, canGoOn: canGoOn, unlockedIsles: unlockedIsles, isleUnlocked: isleUnlocked,
    placedOn: placedOn, isleOf: isleOf, landSetOf: landSetOf, dockCells: dockCells,
    purchaseTx: purchaseTx, goalId: goalId, auditLedger: auditLedger,
    /* v3 land shops: shelves, act facts, colourways and the crew */
    ISLE_SHELVES: ISLE_SHELVES, ACT_INFO: ACT_INFO, DEFAULT_PET_NAMES: DEFAULT_PET_NAMES, setVariant: setVariant,
    isMascot: isMascot, isLandGear: isLandGear, crewList: crewList, crewPet: crewPet, activePetId: activePetId, wornBy: wornBy
  };
}));
