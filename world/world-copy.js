/* ================================================================
   My Island — display copy (pure; no DOM).
   window.SLWorldCopy in the browser (load after world-core.js), require()
   in Node. The island and game UI read every string from here so the
   voice stays one voice: a cool older cousin who runs the stage crew.
   Short, confident, a little witty, never babyish or sarcastic. UK English,
   sentence case, verbs first, at most one emoji (only when it means
   something). 'Pets' are the 'Crew' in labels only (ids never change).

   CATALOG names and descriptions are never edited: desc(id) returns a
   re-voiced description where the CATALOG one uses a banned word (or reads
   young), and the CATALOG text otherwise (every sky-island id, the land
   shops' rides, mascots and gear included, always reads its CATALOG text).

   My Island v3 (the sky islands) adds the isle.*, edit.*, shop.*, unlock.*,
   intro.*, makeover.v3*, celebrate.land*, sr.* and light.day / toDay / toShow
   keys (plan-v3 copy.keys). Their placeholders are only {island}, {land},
   {landmark}, {item}, {items}, {n} and {price}; a lock is drawn as an icon by
   the caller, never written into a string. light.golden stays defined for
   older references although the v3 UI no longer shows it.

   The land shops add the shelf names (shop.shelf.<key>, with a land's own
   wording in shop.shelf.<isle>.<key>: look that one up first), the island
   shop lines (shop.isle*, shop.jump), the Crew aisle (shop.crew.*), the
   mascot and gear lines (unlock.mascot, unlock.gear, crew.from, crew.wear,
   crew.slot.*, crew.resting, crew.joined*) and edit.colour; unlock.isleItems
   now takes {n} and {items} (three example names). The host (W5.1) adds two words of its
   own: shop.seeIt (a landmark card's button) and isle.seeLand (a landmark's sheet while its
   land is locked).

     t(key, vars, fallback)   UI string; '{name}' placeholders come from vars.
                              Unknown key → fallback, else the key itself.
                              Strings are plain text: callers escape for HTML.
     desc(id)                 shop / sheet description for a CATALOG id ('' if unknown)
     bannedIn(text)           banned words found in text (lower case, word-bounded)
     emojiCount(text)         pictographs in text (⭐ counts; letters and ✦ do not)
     KEYS, BANNED, DESC_IDS   the table keys, the ban list, the ids desc() re-voices
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var core = null;
    try { core = require('./world-core.js'); } catch (e) { core = null; }
    module.exports = factory(root, core);
  } else root.SLWorldCopy = factory(root, null);
}(typeof self !== 'undefined' ? self : this, function (root, CORE0) {
  'use strict';

  var BANNED = ['yay', 'yippee', 'hooray', 'boing', 'oopsie', 'uh-oh', 'cosy', 'little', 'tiny', 'cute', 'poorly',
                'magic', 'magical', 'friendly', 'super', 'sparkly', 'lovely'];

  /* UI strings. The art director's rewrites keep their wording; then the Encore City
     additions (makeover toast, city tab, shape tray, unlock lines); then the v3 sky-island
     lines and the land-shop lines, verbatim from plan-v3 copy.keys. */
  var STRINGS = {
    /* celebration card button (was 'Yay! 🎉') */
    'celebrate.ok': 'Nice',
    /* the crew sheet reassurance (was 'Pets never get sad or poorly — …') */
    'crew.neverSad': 'Your crew never gets sad. Take a break — they’ll be ready when you’re back.',
    'crew.named': '{name} it is.',
    'crew.title': 'Your crew',
    'label.crew': 'Crew',
    /* edit mode */
    'edit.hint': 'Edit mode: tap anything to move it or store it.',
    'edit.placed': 'Placed.',
    'edit.moved': 'Moved.',
    'edit.stored': 'Stored. Find it in Edit.',
    /* purchases */
    'buy.style': 'New look, locked in. Tap your home to restyle any time.',
    'buy.acc': 'Equipped. Swap it around in Crew.',
    'buy.cosmetic': 'Equipped for your next run.',
    'goal.reached': 'Goal smashed — you saved for that. Set the next one.',
    'goal.set': 'Set a goal 🎯',
    /* the player picker */
    'player.pick': 'Choose a player to enter the island.',
    /* light toggle (was '☀️ Day' / '🌙✨ Showtime') */
    'light.golden': 'Golden hour',
    'light.showtime': 'Showtime',
    /* shop */
    'shop.dimmed': 'Dimmed ones are in the Island Shop.',
    'shop.tab.city': 'City',
    /* home sheet */
    'home.tray.shape': 'Shape',
    'unlock.city': 'A city building. Place it, then tap it.',
    'unlock.shape': 'A whole new shape for your home. Your walls, roof, door and extras come with you.',
    /* the one-time makeover toast for existing saves (the default home became the City loft) */
    'makeover.toast': 'Your home got a city makeover. Tap it to switch back to the cottage.',
    'makeover.revert': 'Back to the cottage',
    /* games: the results-screen safety line */
    'games.noPoints': 'Game scores don’t earn or spend ⭐',

    /* ---- My Island v3: the sky islands ---- */
    /* the island bar: its button, the short chip names, and the chip states */
    'isle.nav': 'Islands',
    'isle.short.home': 'Home',
    'isle.short.pier': 'Pier',
    'isle.short.jungle': 'Jungle',
    'isle.short.treetop': 'Treetop',
    'isle.short.castle': 'Castle',
    'isle.short.ice': 'Ice village',
    'isle.chipHere': '{island}: you’re here',
    'isle.chipOpen': '{island}: fly there',
    'isle.chipLocked': '{island}: locked. Fly over for a look',
    'isle.chipNew': 'New',
    /* where things may go (placement and edit toasts) */
    'isle.locked': 'That island is still locked.',
    'isle.homeOnly': 'Home things stay on Home Island.',
    'isle.wrongIsle': 'This one belongs on {island}.',
    'isle.dock': 'Keep the bridge landing clear.',
    'isle.otherIsle': 'Put it away first, then place it on the other island.',
    'isle.bumped': '{item} went back to your bag to make room.',
    'isle.bumpedMany': '{n} things went back to your bag to make room.',
    'isle.full': '{island} is full. Put something away first, or keep it for later.',
    'isle.finishFirst': 'Put it down or keep it for later first.',
    'isle.squaresFree': '{n} squares free',
    'isle.squareFree': '1 square free',
    /* travel: visits, the Sky map and arrivals */
    'isle.visit': 'Fly over for a look',
    'isle.back': 'Back to Home Island',
    'isle.map': 'Sky map',
    'isle.mapAria': 'See all islands',
    'isle.mapHint': 'Tap an island to fly there.',
    'isle.you': 'You',
    'isle.arrived': 'Now on {island}.',
    'isle.arrivedLocked': 'Now looking at {island}. It’s still locked.',
    'isle.lockedHint': 'Have a look around. Unlock it to start building.',
    'isle.goThere': 'Go there',
    /* opening a land, and the first visit */
    'isle.unlockFor': 'Unlock for ⭐ {price}',
    'isle.unlockFree': 'Get it free',
    'isle.unlockName': 'Unlock {island}',
    'isle.seeUnlock': 'See how to unlock it',
    'isle.openSub': 'The {landmark} is yours. {n} new things are in the Island Shop.',
    'isle.openTap': 'Tap the {landmark}',
    'isle.openShop': 'Shop this island',
    'isle.landmarkSee': 'Go see it',
    'isle.firstVisit': '{island} is yours to build. Tap Edit to start. The bridge takes you home.',
    /* the one-line landmark hint on a land's first visit */
    'isle.hint.pier': 'Tap the Big Wheel to take your pet for a ride.',
    'isle.hint.jungle': 'Tap the Great Treehouse to send your pet up to the top deck.',
    'isle.hint.treetop': 'Tap the Treetop Lookout. Zip line time!',
    'isle.hint.castle': 'Tap the Castle Keep to lower the drawbridge.',
    'isle.hint.ice': 'The penguins are in. Tap the Great Igloo to say hello.',
    /* taking an 'any island' thing to another island */
    'isle.take': 'Take to another island',
    'isle.takeTitle': 'Take it where?',
    'isle.takeHint': 'It goes in your bag first, then you pick a spot. Change your mind and it waits in your bag.',
    'isle.takeFull': 'Full',
    /* edit mode on an island, and the bag */
    'edit.editing': 'Editing {island}',
    'edit.bag': 'Your bag',
    'edit.bagHere': 'Things in your bag that fit on {island}',
    'edit.bagEmpty': 'Your bag is empty. Everything you own is out on your islands.',
    'edit.bagEmptyHere': 'Nothing in your bag fits here. The Island Shop has more.',
    'edit.bagElsewhere': 'Also in your bag: {n} for {island}.',
    'edit.landmarkStays': 'This one stays on its island — you can move it instead.',
    /* the edit bar's colourway button (the child picks; nothing is rolled) */
    'edit.colour': 'Next colour',
    /* shop: the Sky islands tab */
    'shop.tab.sky': 'Sky islands',
    'shop.isles.all': 'All five',
    'shop.comesWith': 'Comes with the land',
    'shop.comesWithLand': 'Comes with {land}',
    'shop.unlocked': 'Unlocked',
    'shop.onIsland': 'On your island',
    /* the host's own words for a landmark (W5.1): its card's one button, and its sheet while the land is locked */
    'shop.seeIt': 'See it',
    'isle.seeLand': 'See {land}',
    /* shop: a land's shelves. The plain names, then each land's own wording for a shelf
       (shop.shelf.<isle>.<key> wins over shop.shelf.<key>) */
    'shop.shelf.rides': 'Rides',
    'shop.shelf.play': 'Play',
    'shop.shelf.stalls': 'Snacks & stalls',
    'shop.shelf.village': 'Village',
    'shop.shelf.wild': 'Trees & wildlife',
    'shop.shelf.decor': 'Decor',
    'shop.shelf.paths': 'Paths',
    'shop.shelf.crew': 'Mascots & gear',
    'shop.shelf.pier.decor': 'Seaside bits',
    'shop.shelf.jungle.rides': 'Rides & play',
    'shop.shelf.jungle.village': 'Village & ruins',
    'shop.shelf.treetop.rides': 'Climb & zip',
    'shop.shelf.treetop.play': 'Balance & bounce',
    'shop.shelf.treetop.decor': 'Dens & picnics',
    'shop.shelf.treetop.paths': 'Trails',
    'shop.shelf.castle.rides': 'Tournament field',
    'shop.shelf.castle.village': 'Towers & great hall',
    'shop.shelf.castle.stalls': 'Market & courtyard',
    'shop.shelf.castle.decor': 'Walls, banners & lights',
    'shop.shelf.ice.rides': 'Slides & rides',
    'shop.shelf.ice.village': 'Village life',
    'shop.shelf.ice.decor': 'Snow & ice',
    /* shop: one island's shop (its heading, the island cards and the shelf jump row) */
    'shop.isleShop': '{island} shop',
    'shop.isleHere': 'You’re on {island}. Here’s its shop.',
    'shop.isleCount': '{n} things to buy',
    'shop.isleOpen': 'Open the {island} shop',
    'shop.isleLocked': 'Have a look round. Unlock {land} to buy these.',
    'shop.jump': 'Jump to',
    /* shop: the Crew aisle (the V4.54 pets, the V4.54 gear, then a group per land) */
    'shop.crew.pets': 'Crew',
    'shop.crew.gear': 'Gear',
    'shop.crew.isle': '{island} mascots & gear',
    /* unlock sheet lines */
    'unlock.isle': 'A new sky island with {n} squares to build on.',
    'unlock.isleItems': 'Then pick from {n} things, like {items}.',
    'unlock.ownOnly': 'Lives on {island} only.',
    'unlock.anyIsle': 'Place it on Home Island or any sky island you’ve opened.',
    'unlock.landmark': 'Comes free with {land} and always stays on its own island.',
    'unlock.mascot': 'A new crew member from {island}. You’ll see it there and on Home Island, and it can be your runner.',
    'unlock.gear': 'Anyone in your crew can wear it.',
    /* the lock sign over a locked land (the lock itself is an icon) */
    'lock.sign': '{island} · ⭐ {price}',
    /* goals, crew and the info sheet */
    'goal.firstNeed': '🎯 First you need the {land} — that’s your goal now!',
    'crew.runner': 'The 🏅 one runs your Debut Run and follows you across the bridges.',
    /* the crew sheet with mascots: where one is from, the four wear rows, who is indoors */
    'crew.from': 'From {island}',
    'crew.wear': 'Wear',
    'crew.slot.hat': 'Hats',
    'crew.slot.neck': 'Neck',
    'crew.slot.face': 'Face',
    'crew.slot.back': 'Back',
    'crew.resting': '{n} more of your crew are resting indoors. They take turns outside.',
    /* the card when a mascot is bought */
    'crew.joined': '{item} joined the crew',
    'crew.joinedSub': 'Pick a name in Crew.',
    'info.sky': '🏝️ Open sky islands in the Island Shop, then cross the bridge to build there.',
    /* the intro slides (slide 1 used to promise the city across the bay) */
    'intro.1.title': 'Your island in the sky',
    'intro.1.body': 'A home, your first crew member and the Debut Run. Five more islands float nearby, waiting to be opened.',
    'intro.3.trialTitle': 'Free while we test',
    'intro.3.trialBody': 'Everything on the island is free right now: sky islands, crew, a football pitch, a race track and more. Your ⭐ stay saved for the Shop. Try it all and tell Dad what you think.',
    'intro.3.title': 'Make it yours',
    'intro.3.body': 'Spend ⭐ on sky islands, crew, a football pitch, a race track and more. They’re the same points you save in the Shop, so choose what you want most.',
    /* the one-time v3 makeover toast for existing saves */
    'makeover.v3': 'Your island moved up into the sky. Everything you built came with it.',
    'makeover.v3Btn': 'See the other islands',
    /* the celebration card when a land opens */
    'celebrate.landTitle': '🏝️ {land} is open!',
    'celebrate.landGoalTitle': '🎯 Goal reached! {land} is open!',
    /* screen-reader labels */
    'sr.lockedIsle': '{island}, locked — see how to unlock it',
    'sr.flyTo': '{island} — fly there',
    'sr.bridge': 'Bridge to {island}',
    /* light toggle in v3 (light.golden above stays for older references) */
    'light.day': 'Daytime',
    'light.toDay': 'Switch to daytime',
    'light.toShow': 'Switch to Showtime'
  };

  /* re-voiced descriptions: every CATALOG desc with a banned word, plus a few that read young */
  var DESC = {
    house_cottage: 'Your home base. Tap it to restyle the walls, roof, door and shape.',
    wall_cream: 'Warm cream walls. A classic.',
    pet_puppy: 'Your first crew member. Loyal, bouncy and always ready to go.',
    pet_dragon: 'A young dragon with swept-back wings. Sparkles, never fire.',
    rock_mossy: 'A mossy boulder with a soft green top.',
    mushroom_glow: 'Glowing mushrooms. Tap them to switch the glow on and off.',
    sandcastle: 'A sandcastle with a flag on top.',
    bunting: 'Colourful bunting strung between two posts.',
    path_flower: 'Stepping stones with flowers between them.',
    trampoline: 'Tap it — your pet does a triple bounce and a flip.',
    roof_castle: 'Turrets and battlements. Your home becomes a castle.',
    detail_chimney: 'A chimney that sends up puffs of smoke.',
    ball_planet: 'A ball with its own ring, like a planet.',
    kart_unicorn: 'Pink, shimmering and very fast-looking.',
    track_loop: 'A smooth loop round the island.'
  };

  function core() { return CORE0 || (root && root.SLWorldCore) || null; }
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

  function t(key, vars, fallback) {
    var s = own(STRINGS, key) ? STRINGS[key] : (typeof fallback === 'string' ? fallback : String(key));
    if (vars && typeof vars === 'object') {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return own(vars, k) && vars[k] != null ? String(vars[k]) : m; });
    }
    return s;
  }
  function desc(id) {
    if (own(DESC, id)) return DESC[id];
    var C = core(), it = null;
    try { it = C && typeof C.item === 'function' ? C.item(id) : null; } catch (e) { it = null; }
    return it && typeof it.desc === 'string' ? it.desc : '';
  }

  var BANNED_RE = new RegExp('(^|[^a-z])(' + BANNED.map(function (w) { return w.replace(/-/g, '\\-'); }).join('|') + ')(?=$|[^a-z])', 'gi');
  function bannedIn(text) {
    var out = [], m;
    BANNED_RE.lastIndex = 0;
    while ((m = BANNED_RE.exec(String(text == null ? '' : text)))) {
      var w = m[2].toLowerCase();
      if (out.indexOf(w) < 0) out.push(w);
    }
    return out;
  }
  /* pictographic emoji (⭐ 🎯 …); text symbols such as ✦ — and ’ are not emoji. Engines without
     Unicode property escapes count astral pictographs and the common BMP symbol blocks. */
  var EMOJI_RE = (function () {
    try { return new RegExp('\\p{Extended_Pictographic}', 'gu'); }
    catch (e) { return /[\uD83C-\uD83E][\uDC00-\uDFFF]|[☀-➿⬀-⯿]/g; }
  }());
  function emojiCount(text) {
    var s = String(text == null ? '' : text), n = 0;
    s.replace(EMOJI_RE, function (c) { if (c !== '✦') n++; return c; });
    return n;
  }

  var KEYS = Object.keys(STRINGS);
  var DESC_IDS = Object.keys(DESC);
  [STRINGS, DESC, BANNED, KEYS, DESC_IDS].forEach(Object.freeze);

  return { t: t, desc: desc, bannedIn: bannedIn, emojiCount: emojiCount, KEYS: KEYS, BANNED: BANNED, DESC_IDS: DESC_IDS, STRINGS: STRINGS };
}));
