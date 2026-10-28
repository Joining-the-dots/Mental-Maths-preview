/* ================================================================
   My Island — display copy (pure; no DOM).
   window.SLWorldCopy in the browser (load after world-core.js), require()
   in Node. The island and game UI read every string from here so the
   voice stays one voice: a cool older cousin who runs the stage crew.
   Short, confident, a little witty, never babyish or sarcastic. UK English,
   sentence case, verbs first, at most one emoji (only when it means
   something). Pets are called pets (V4.56, F-ISL2): what read 'Crew' reads
   'My pets' (the caller draws the paw icon in front, so a label is '🐾 My pets'),
   'Equipped' reads 'Wearing' and 'mascots' reads 'pets'. Only the words changed:
   the crew.* / label.crew / shop.crew.* / shop.shelf.crew keys and every id stay.

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
   shop lines (shop.isle*, shop.jump), the pets aisle (shop.crew.*), the
   mascot and gear lines (unlock.mascot, unlock.gear, crew.from, crew.wear,
   crew.slot.*, crew.resting, crew.joined*) and edit.colour; unlock.isleItems
   now takes {n} and {items} (three example names). The host (W5.1) adds two words of its
   own: shop.seeIt (a landmark card's button) and isle.seeLand (a landmark's sheet while its
   land is locked).

   The kids update (plan-ku KU19, chunk KU-COPY) adds every child-facing key of the
   characters and the pets, word for word from characters.json uiFlows.copyDraft (char.*,
   wardrobe.*, photo.*, shop.shelf.dressup, and move.<move id> for the 12 special moves)
   and pets.json copy.keys (care.*), overlaid by plan-ku copy.amendedKeys (the cap in
   both modes, the trial pantry, the farewell rule, the mirror, Find me). care.app.one /
   care.app.many are not here: the home-screen banner shows without the world scripts,
   so index.html holds them. Grown-up text lives in each Control Centre panel's own
   table, challenge text in duel-core.T. Which keys a screen shows depends on the pet
   cap's mode (SLWorldCore.petRoom(w).mode): 'total' reads care.welcome.capTotal /
   capKeep, care.ownFull and care.adoptLimit*; 'home' reads care.welcome.cap,
   care.homeFull and care.makeRoom. The farewell lines (care.rule.*, care.star.*,
   care.rescue.wentFarewell and care.rescue.rule) show only while a grown-up's switch
   is on. crew.neverSad keeps its text for older references but is no longer shown
   (care.promise says what is true now). A last group holds the few words the designs'
   screens quote that their copy drafts left out (the Pet Corner's heading and buttons,
   the Pet Shop's groups, the creator's 'More in the Wardrobe'). These keys also use
   {name}, {move}, {food}, {fav}, {species} and {date}. The photo lines promise colours
   picked on the device, never a likeness. One key has {sign} (buy.game.look, c-copy-core): a game's
   ▶ sign, which the host fills in itself.

   Island activities v1 (IA-0, 26 Oct 2026) adds the act.* family (the Today board, weather and seasons,
   the visitor, show time, I spy, fetch and hide and seek, a pet's wish, My island book and its stamps,
   the Next step card's visitor idea and goal bar, the Games sheet's 'Play on your island' block), word
   for word from docs/island3d/v3/kids-update/activities.json (copy.keys); its own rules and oracle are in
   tests/world-copy-acts.test.js. It also uses {move} and {date}.

   A count line may have a singular form '<key>.one'; t() uses it when vars.n is 1
   ('1 more of your crew is resting indoors', not 'are'). Callers pass n as usual.

     t(key, vars, fallback)   UI string; '{name}' placeholders come from vars
                              (vars.n of 1 reads '<key>.one' where there is one).
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
    /* the My pets sheet reassurance (was 'Pets never get sad or poorly — …') */
    'crew.neverSad': 'Your pets never get sad. Take a break — they’ll be ready when you’re back.',
    'crew.named': '{name} it is.',
    'crew.title': 'My pets',
    'label.crew': 'My pets',
    /* edit mode */
    'edit.hint': 'Edit mode: tap anything to move it or store it.',
    'edit.placed': 'Placed.',
    'edit.moved': 'Moved.',
    'edit.stored': 'Stored. Find it in Edit.',
    /* purchases */
    'buy.style': 'New look, locked in. Tap your home to restyle any time.',
    'buy.acc': 'Your runner is wearing it. Swap it around in My pets.',
    'buy.cosmetic': 'Ready for your next game.',
    /* R2 (QA2A-15): pet gear bought for a pet that is not the runner names that pet (the host fills {name}) */
    'buy.accPet': '{name} is wearing it. Swap it around in My pets.',
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
    /* the house inside a line (island activities, IA-5: 'Yes! The {item} fits.', 'Not behind the {item}…'): its
       catalogue name 'Your Home' would read 'the Your Home' */
    'home.house': 'house',
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
    /* a preview visit: the child is there, but the land is still locked (a screen reader hears this, not 'you’re here') */
    'isle.chipHereLocked': '{island}: looking around. Still locked',
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
    'shop.shelf.crew': 'Pets & gear',
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
    'shop.isleCount.one': '1 thing to buy',
    'shop.isleOpen': 'Open the {island} shop',
    'shop.isleLocked': 'Have a look round. Unlock {land} to buy these.',
    'shop.jump': 'Jump to',
    /* shop: the pets aisle (the V4.54 pets, the V4.54 gear, then a group per land) */
    'shop.crew.pets': 'Pets',
    'shop.crew.gear': 'Gear',
    'shop.crew.isle': '{island} pets & gear',
    /* unlock sheet lines */
    'unlock.isle': 'A new sky island with {n} squares to build on.',
    'unlock.isleItems': 'Then pick from {n} things, like {items}.',
    'unlock.ownOnly': 'Lives on {island} only.',
    'unlock.anyIsle': 'Place it on Home Island or any sky island you’ve opened.',
    'unlock.landmark': 'Comes free with {land} and always stays on its own island.',
    'unlock.mascot': 'A new pet from {island}. You’ll see it there and on Home Island, and it can be your runner.',
    'unlock.gear': 'Any of your pets can wear it.',
    /* the lock sign over a locked land (the lock itself is an icon) */
    'lock.sign': '{island} · ⭐ {price}',
    /* goals, pets and the info sheet */
    'goal.firstNeed': '🎯 First you need the {land} — that’s your goal now!',
    'crew.runner': 'The 🏅 one runs your Debut Run and follows you across the bridges.',
    /* the My pets sheet with the land pets: where one is from, the four wear rows, who is indoors */
    'crew.from': 'From {island}',
    'crew.wear': 'Wear',
    'crew.slot.hat': 'Hats',
    'crew.slot.neck': 'Neck',
    'crew.slot.face': 'Face',
    'crew.slot.back': 'Back',
    'crew.resting': '{n} more of your pets are resting indoors. They take turns outside.',
    /* its singular (t() picks it when n is 1); pets are pets since V4.56 (F-ISL2: the plural reads '… of your pets are …') */
    'crew.resting.one': '1 more of your pets is resting indoors. They take turns outside.',
    /* the card when a land pet is bought */
    'crew.joined': '{item} is your new pet',
    'crew.joinedSub': 'Pick a name in My pets.',
    /* host-ready words (F-ISL2): rewards-world.js still writes these itself (a V4.54 pet's and V4.54 gear's
       unlock line, the empty Wear row, the 'more' buttons and the runner button) — swap them to tx() */
    'unlock.pet': 'A new pet who roams your island and can run the Debut Run.',
    'unlock.petGear': 'Any of your pets can wear it, on the island and in the Debut Run.',
    'crew.wearNone': 'Caps, beanies, headphones and more are in the Island Shop, on the Pets shelf.',
    'crew.more': 'More pets and gear',
    'crew.makeRunner': '🏅 Make my runner',
    'info.sky': '🏝️ Open sky islands in the Island Shop, then cross the bridge to build there.',
    /* ---- wave 3, the simpler app (25 Oct 2026, WAVE3-PLAN): the Next step card on My Island, the Learn buttons
       and the learn-and-come-back trip, and the Island Shop as one land with a few shelves ---- */
    'next.label': 'Next step',
    'next.feedOne': '{name} is hungry.',
    'next.feedMany': '{n} pets are hungry.',
    'next.feedBtn': 'Feed {name}',
    'next.feedAll': 'Feed my pets',
    'next.rescue': '{name} is at the Pet Rescue. A visit with a meal helps them come home.',
    'next.enough': '{item}: you have enough now.',
    'next.getIt': 'Get it',
    'next.try.course': 'Try Debut Run: an obstacle run with your pet.',
    'next.try.penalty': 'Try Encore Shootout: football penalties.',
    'next.try.kart': 'Try Neon Grand Prix: kart racing.',
    'next.remix': 'Try the Remix: more obstacles!',
    'next.play': '▶ Play',
    'next.learnMins': '{item}: learn about {n} more minutes.',
    'next.learnDays': '{item}: about {n} more days of learning.',
    'next.free': '{item}: free while we test.',
    'next.progress': '{n} of {price}',
    'learn.go': '📚 Learn',
    'learn.andBack': '📚 Learn and come back',
    'learn.aboutMins': 'That’s about {n} minutes of learning.',
    'learn.aboutDays': 'That’s about {n} days of learning.',
    'shop.at': 'Shop at',
    'shop.home.games': 'Games',
    'shop.home.decor': 'Garden & decorations',
    'shop.home.fun': 'Fun & paths',
    'shop.home.pets': 'Pets',
    'shop.home.lands': 'New lands',
    'shop.home.more': 'More to look at',
    'shop.door.house': 'Your home',
    'shop.door.houseLine': 'Walls, roofs, doors and shapes.',
    'shop.door.houseBtn': 'Restyle',
    'shop.door.petsLine': 'Every pet you have, and where they are.',
    'shop.door.petShopLine': 'Adopt a pet or get pet food.',
    'shop.filter.afford': 'I can buy',
    'shop.filter.none': 'Nothing here you can buy yet.',
    /* d-island (James, 25 Oct 2026: 'Need N more 🪙' for every shortfall) */
    'shop.filter.next': 'Next up: {item}. Need {n} more 🪙.',
    'shop.back': 'Back to the shop',
    /* R2 (QA2D-4): a folded shelf's way to the rest of it */
    'shop.seeAll': 'See all {n}',

    /* ---- d-island (James's answers, 25 Oct 2026 afternoon; chatgpt-feedback/DECISIONS-FOR-JAMES.md ✅) ----
       One goal wording everywhere: the goal button is '🎯 My goal' (the host adds ' ✓' while it is the goal) and every
       shortfall reads 'Need N more 🪙'. Other chunks read these through SLWorldCopy.t(key) with the same text as their
       fallback: the ▶ PLAY signs name their game, and the Pet Shop's Jump to chips name its shelves */
    'goal.my': '🎯 My goal',
    'need.coins': 'Need {n} more 🪙',
    'play.sign.course': '▶ Debut Run',
    'play.sign.penalty': '▶ Shootout',
    'play.sign.kart': '▶ Kart',
    'care.shop.jump.animals': 'Animals',
    'care.shop.jump.food': 'Food',
    'care.shop.jump.clothes': 'Clothes',
    /* the Next step card's changing island ideas (James: 'everything related to islands, free play, whatever interests
       them'): after a hungry pet, a pet at the Pet Rescue and 'you have enough', the card takes turns between a visit to
       another land, a ride or landmark, the bag or the shop, a game, and how the goal is going. Never pushy: a
       suggestion, a question, or the goal's own words */
    'next.visit': 'Pay a visit to {island}.',
    'next.flyThere': 'Fly there',
    'next.ride': 'Have a go on the {item}.',
    /* c-copy-core (James, 26 Oct 2026: 'Try the Fountain' for non-rides): the same idea's words for a thing that is not a
       ride (a fountain, a café, a statue, the penguin choir), which SLWorldCore.RIDE_ACTS decides by the thing's act */
    'next.tryThing': 'Try the {item}.',
    'next.rideBtn': '✋ Have a go',
    'next.bag': 'Your bag has {n} things to put out.',
    'next.bag.one': 'Your bag has 1 thing to put out.',
    'next.bagBtn': 'Open my bag',
    'next.add': 'Add something to {island}.',
    /* the kart Remix names its track (James: 'name the track in the Remix suggestion'); next.remix stays for older references */
    'next.remixTrack': 'Try the {item} Remix: more obstacles!',
    'next.again.course': 'Fancy another Debut Run?',
    'next.again.penalty': 'Fancy another Encore Shootout?',
    'next.again.kart': 'Fancy another Neon Grand Prix?',
    /* time estimates on about an hour of learning a day: minutes up to an hour, then days, one day said as one */
    'next.learnDays.one': '{item}: about 1 more day of learning.',
    'learn.aboutDays.one': 'That’s about 1 day of learning.',
    /* the Games sheet when a grown-up has set no daily game time (was 'Island games have no daily time limit on this account.') */
    'games.noLimit': 'There’s no daily game time limit for you.',
    /* c-copy-core (26 Oct 2026): the words other chunks already show through SLWorldCopy.t with these exact fallbacks, so
       the table now holds them. A learning round's finish card (index.html [D-INDEX-FIN], James: '+N 🪙 for your island'
       and a 🏝️ My Island button; '+{n}' reads the same for 1, so there is no '.one'), the island legend's line after the
       starter course's sign, and the bought-a-game card (rewards-world.js SIGN_WORDS). {sign} is a game's ▶ sign
       ('▶ Kart'), which the host fills in itself */
    'finish.coins': '+{n} 🪙 for your island',
    'finish.island': '🏝️ My Island',
    'legend.play': 'tap a game’s sign to play',
    'buy.game.look': 'It’s on your island now — look for the {sign} sign.',
    /* the intro slides (slide 1 used to promise the city across the bay) */
    'intro.1.title': 'Your island in the sky',
    'intro.1.body': 'A home, your first pet and the Debut Run. Five more islands float nearby, waiting to be opened.',
    'intro.3.trialTitle': 'Free while we test',
    'intro.3.trialBody': 'Everything on the island is free right now: sky islands, pets, a football pitch, a race track and more. Your ⭐ stay saved for My rewards. Try it all and tell Dad what you think.',
    'intro.3.title': 'Make it yours',
    'intro.3.body': 'Spend ⭐ on sky islands, pets, a football pitch, a race track and more. They’re the same points you save in My rewards, so choose what you want most.',
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
    'light.toShow': 'Switch to Showtime',

    /* ---- the kids update: characters (characters.json uiFlows.copyDraft.keys, KU-COPY) ---- */
    /* the first-open card (the island-open queue's 'char.meet', KU13) and the ✎ badge */
    'char.meet.title': 'Who’s going on your island?',
    'char.meet.body': 'Make yourself, start from a photo or pick a ready-made character. You can change everything later.',
    'char.meet.make': 'Make me',
    'char.meet.photo': 'Start from a photo',
    'char.meet.pick': 'Pick a character',
    'char.meet.later': 'Later',
    'char.badge': 'Make your character',
    /* the creator: its tabs, the pickers, and 'That’s me' */
    'char.creator.title': 'Make your character',
    'char.tab.skin': 'Skin',
    'char.tab.face': 'Face',
    'char.tab.hair': 'Hair',
    'char.tab.extras': 'Extras',
    'char.tab.shape': 'Shape',
    'char.tab.clothes': 'Clothes',
    'char.eyes': 'Eyes',
    'char.eyeColour': 'Eye colour',
    'char.freckles': 'Freckles',
    'char.rosy': 'Rosy cheeks',
    'char.hairStyle': 'Style',
    'char.hairColour': 'Colour',
    'char.covering': 'Head covering',
    'char.none': 'None',
    'char.glasses': 'Glasses',
    'char.aid': 'Hearing aid',
    'char.height': 'Height',
    'char.another': 'Try another look',
    'char.undo': 'Undo',
    'char.done': 'That’s me',
    'char.keep': 'Keep these changes?',
    'char.debut': 'Looking sharp, {name}.',
    /* the cast carousel */
    'char.cast.title': 'Characters',
    'char.cast.comes': 'Comes with: {items}',
    'char.cast.move': 'Special move: {move}',
    'char.cast.play': 'Play as {name}',
    'char.cast.playNow': 'Play as {name} now?',
    'char.cast.notNow': 'Not now',
    'char.cast.opens': 'Opens with {land}',
    /* My character */
    'char.likeMe': 'Make it look like me',
    'char.my': 'My character',
    'char.switch': 'Switch character',
    'char.moves': 'Moves',
    'char.change': 'Change look',
    /* Find me: the camera comes close to your character (plan-ku amendedKeys, KU34) */
    'char.findMe': 'Find me on the island',
    /* overnight fixes F-KU3 (25 Oct 2026): My character's one way to another character and its More tab (A6),
       and the first-open card when there is no photo button (E10) */
    'char.changeChar': 'Change character',
    'char.more': 'More',
    'char.meet.bodyNoPhoto': 'Make yourself or pick a ready-made character. You can change everything later.',
    /* the Wardrobe (inside My character, and the Island Shop’s tab) */
    'wardrobe.title': 'Wardrobe',
    'wardrobe.tab': '👕 Wardrobe',
    'wardrobe.slot.outfit': 'Outfits',
    'wardrobe.slot.top': 'Tops',
    'wardrobe.slot.bottom': 'Bottoms',
    'wardrobe.slot.shoes': 'Shoes',
    'wardrobe.slot.head': 'Hats',
    'wardrobe.slot.face': 'Face',
    'wardrobe.slot.neck': 'Neck',
    'wardrobe.slot.back': 'Back',
    'wardrobe.slot.hand': 'Hands',
    'wardrobe.slot.dye': 'Hair colours',
    'wardrobe.wear': 'Wear',
    'wardrobe.off': 'Take off',
    'wardrobe.colour': 'Next colour',
    'wardrobe.tryOn': 'Try it on',
    'wardrobe.free': 'Free',
    'wardrobe.hidden': 'Hidden under your {item}',
    'wardrobe.more': 'Shop more',
    /* each land’s Dress-up shelf, after its crew shelf */
    'shop.shelf.dressup': 'Dress-up',
    /* start from a photo: colours picked on the device, then the photo is wiped; nothing is kept or sent (KU17) */
    'photo.title': 'Start from a photo',
    'photo.explain': 'Your photo stays on this device for a few seconds while we pick your colours. Then it’s deleted. Nothing is saved or sent.',
    'photo.camera': 'Use the camera',
    'photo.pick': 'Pick a photo',
    'photo.notNow': 'Not now',
    'photo.frame': 'Fit your face in the circle',
    'photo.light': 'Face a window for the best colours',
    'photo.move': 'Drag the circle onto your face',
    'photo.snap': 'Snap',
    'photo.use': 'Use this photo',
    'photo.deleted': 'Photo deleted',
    'photo.result': 'Here’s your cartoon. Change anything you like.',
    'photo.glassesQ': 'Do you wear glasses?',
    'photo.yes': 'Yes',
    'photo.no': 'No',
    'photo.unclear': 'We couldn’t see your colours clearly. Pick them yourself — you know them best.',
    'photo.noCamera': 'This device won’t share its camera. You can pick a photo instead.',
    'photo.again': 'Try again',
    /* the optional camera mirror: the live camera beside the character, never captured (plan-ku amendedKeys, KU17) */
    'photo.mirror': 'Use the camera as a mirror',
    'photo.mirror.note': 'The camera is just a mirror here. Nothing is taken or saved.',
    'photo.mirror.close': 'Close the mirror',
    /* the 12 special moves, move.<move id> (characters.json cast.list[].move.name; SLPeopleCore.MOVES has the same names) */
    'move.sigFreeze': 'Floor freeze',
    'move.sigEureka': 'Big idea',
    'move.sigStarpoint': 'Star point',
    'move.sigSwoop': 'Wing swoop',
    'move.sigEncore': 'Encore',
    'move.sigKnee': 'Knee slide',
    'move.sigVisor': 'Visor up',
    'move.sigSurf': 'Surf stance',
    'move.sigSpy': 'Spyglass',
    'move.sigTree': 'Tree pose',
    'move.sigBow': 'Royal bow',
    'move.sigSpin': 'Rink spin',

    /* ---- the kids update: pets and their care (pets.json copy.keys, overlaid by plan-ku copy.amendedKeys, KU-COPY;
       care.app.one / care.app.many live in index.html) ---- */
    /* what is true now (crew.neverSad above is no longer shown) */
    'care.promise': 'Pets only get hungry on the days you open My Island, never while you’re away.',
    /* 'News from the Pet Shop': the update card for a child who already has pets (KU13) */
    'care.welcome.title': 'News from the Pet Shop',
    'care.welcome.body': 'Your pets now have a meal on the days you visit My Island. Buy food in the Pet Shop and feed them in My pets. Here’s a free bag of 6 meals to start!',
    /* the cap, 'total' (up to 3 pets owned; capKeep for a child who already has more) */
    'care.welcome.capTotal': 'You can have up to 3 pets.',
    'care.welcome.capKeep': 'You have {n} pets, and they all stay. Up to 3 live at home and the others stay at the Pet Hotel.',
    /* the cap, 'home' (any number owned, 3 at home) */
    'care.welcome.cap': 'Up to 3 pets live at home. Any others stay at the Pet Hotel, where they’re looked after. Swap them whenever you like.',
    /* the new animals, and the button that opens the Pet Shop on them (KU13) */
    'care.welcome.new': '{n} new animals have arrived at the Pet Shop.',
    'care.welcome.shop': 'Visit the Pet Shop',
    /* a new player: the intro's care slide, and its last button */
    'care.intro': 'Pets need a meal on the days you visit My Island.',
    /* d-island (James's QA-round-2 question): the new player's offer says whose friend it is without a name nobody has
       introduced yet (was 'Adopt a friend for {name}'; the caller still passes {name}, which is now unused). Only a new
       player sees it, right after the welcome, when the starter puppy is their one pet */
    'care.adoptFriend': 'Adopt a friend for your puppy',
    /* who lives at home (the picker) */
    'care.pick.title': 'Who lives at home?',
    'care.pick.sub': 'Pick up to 3 pets. The others stay at the Pet Hotel. You can swap whenever you like.',
    'care.pick.count': '{n} of 3 at home',
    /* the tummy and happiness words (always shown as text as well as icons) */
    'care.tummy.full': 'Full',
    'care.tummy.fed': 'Fed',
    'care.tummy.peckish': 'Peckish',
    'care.tummy.hungry': 'Hungry',
    'care.tummy.veryHungry': 'Very hungry',
    'care.happy.0': 'Waiting for you',
    'care.happy.1': 'A bit low',
    'care.happy.2': 'Content',
    'care.happy.3': 'Happy',
    'care.happy.4': 'Over the moon',
    /* the island-day cards and toasts */
    'care.peckish': '{name} is peckish. Time for a meal!',
    'care.hungry': '{name} is hungry. A meal will cheer them right up.',
    'care.warn': '{name} is very hungry. If {name} isn’t fed in the next 2 island days, the keepers at the Pet Rescue will look after them.',
    /* the kind 'last day' line (James, 24 Oct 2026: no 'Last chance!'; FIX-LIST section 2) */
    'care.last': 'Feed {name} today and they’ll be fine. If not, the kind keepers at the Pet Rescue will look after {name}.',
    /* d-island: every shortfall reads 'Need N more …' (was 'Earn {n} ⭐ in any learning game to buy {food}.') */
    'care.noPoints': 'Need {n} more ⭐ for {food}.',
    'care.goLearn': 'Go and learn',
    /* the Pet Corner: feeding, pats and play */
    'care.feed': 'Feed',
    'care.pat': 'Pat',
    'care.play': 'Play',
    'care.fed': '{name} loved that!',
    'care.fav': '{name}’s favourite!',
    'care.full': '{name} is full! Come back next time.',
    'care.diet': '{name} doesn’t eat {food}. Try {fav}.',
    'care.none': 'No {food} left. Get more in the Pet Shop.',
    'care.treatMax': '{name} enjoyed that. Treats are best as a snack.',
    'care.happyUp': '{name} is happier!',
    /* the pantry, and the test-mode pantry cap (KU38) */
    'care.pantry': 'Pantry',
    'care.pantryFull': 'Your pantry is full of {food}.',
    'care.trialPantry': 'In test mode the pantry holds up to {n} meals. Feed your pets, then get more.',
    /* a food card the test pantry has no room for says why on the card (QA 24 Oct, item 8) */
    'care.trialFull': 'No room for this in the test pantry yet (up to {n} meals). Feed your pets first.',
    /* a full home: 'home' only */
    'care.homeFull': 'Home is full (3 of 3). Move a pet to the Pet Hotel to make room.',
    'care.makeRoom': 'Make room',
    /* the cap reached: 'total' only (the confirm before the 3rd pet, and the line at the cap) */
    'care.ownFull': 'You can have up to 3 pets, and you have {n}. Look after them in My pets.',
    'care.adoptLimit': '{name} would be your 3rd pet. That’s the most you can have.',
    'care.adoptLimit.yes': 'Adopt {name}',
    'care.adoptLimit.no': 'Keep looking',
    /* the Pet Hotel */
    'care.hotel.title': 'Pet Hotel',
    'care.hotel.sub': 'Pets here are looked after by the hotel. They don’t need feeding.',
    'care.hotel.toHotel': 'Move to the Pet Hotel',
    'care.hotel.toHome': 'Bring home',
    'care.hotel.swap': 'Swap with…',
    'care.hotel.count': '{n} at the Pet Hotel',
    'care.hotel.arrived': '{name} arrived while home was full, so {name} is staying at the Pet Hotel.',
    /* the Pet Rescue (wentFarewell replaces went, and rule shows, while the farewell switch is on: KU40) */
    'care.rescue.title': 'Pet Rescue',
    /* the Rescue tab's explanation line, as the Hotel has care.hotel.sub (QA 24 Oct, item 19); true with farewell on or off */
    'care.rescue.sub': 'The kind keepers here look after pets who got very hungry. Visit with a meal on {n} different island days to bring them home.',
    'care.rescue.went': '{name} was very hungry, so the Pet Rescue is looking after them. {name} is safe and warm. Visit {name} there to bring them home.',
    'care.rescue.wentFarewell': '{name} was very hungry, so the Pet Rescue is looking after them for now. Visit {name} there to bring them home.',
    'care.rescue.rule': 'Pets who wait here {n} island days without a visit pass away and become stars.',
    'care.rescue.visit': 'Visit {name}',
    'care.rescue.progress': 'Visits: {n} of 3. Come back on another day.',
    'care.rescue.home': '{name} is home! {name} missed you.',
    'care.rescue.games': 'The keepers let {name} join your games.',
    /* the pet sitter (a grown-up’s pause) */
    'care.sitter': 'A pet sitter is looking after your pets. They won’t get hungry.',
    'care.sitterUntil': 'A pet sitter is looking after your pets until {date}.',
    /* the Pet Shop */
    'care.shop.title': 'Pet Shop',
    'care.shop.canAdopt': 'I can adopt now',
    'care.shop.loves': 'Loves: {food}',
    'care.shop.lives': 'Lives: {island}',
    'care.shop.unlock': 'Unlock {island} first',
    'care.shop.atHome': 'At home',
    'care.shop.atHotel': 'At the Pet Hotel',
    /* where a pet at the Rescue is (FIX-LIST: pet cards say where the pet is): 'Safe' only while the farewell switch
       is off (KU40: with it on the Rescue never promises the pet is fine) */
    'care.shop.atRescue': 'At the Pet Rescue',
    'care.shop.atRescueSafe': 'Safe at the Pet Rescue',
    /* a pet card at the cap ('total'): the state instead of a Buy that cannot work (FIX-LIST 1.3); capKeep for an old
       save with more pets than the cap */
    'care.shop.capFull': '{n} of 3 pets',
    'care.shop.capKeep': 'Full: you have {n} pets',
    /* the farewell, shown only while a grown-up’s switch is on (KU6, KU40): the one-time rule card, the warning
       before, the card after, and the Memory Book. James signs these words off (Q2): keep them exactly */
    'care.rule.title': 'A new pet rule',
    'care.rule.body': 'A grown-up has changed a pet rule: a pet who waits at the Pet Rescue for {n} island days without a visit will pass away and become a star. Visiting brings pets home.',
    'care.star.soon': '{name} is waiting at the Pet Rescue. Visit {name} in the next {n} island days, or {name} will pass away and become a star.',
    /* its singular (t() picks it when n is 1: the last island day to visit), for James to sign off with the three above */
    'care.star.soon.one': '{name} is waiting at the Pet Rescue. Visit {name} today, or {name} will pass away and become a star.',
    'care.star.went': '{name} has passed away and became a star in your island’s sky. You’ll always have your memories of {name}.',
    'care.star.back': '{name} is back!',
    'care.memories': 'Memory Book',
    'care.memory.days': '{n} island days together',
    'care.memory.again': 'Adopt a {species} again',
    /* its form before a vowel (an otter, an owlet): lead copy fix after K4, plan-ku copy.amendedKeys */
    'care.memory.againAn': 'Adopt an {species} again',
    /* the OK button pets U11 quotes on the farewell star card and the rule card (lead copy fix after K4) */
    'care.ok': 'OK',

    /* ---- the kids update: words the designs' screens quote that the copy drafts left out (KU-COPY, so the
       Pet Corner, the Pet Shop and the creator need no literals) ---- */
    /* the Pet Corner's heading and the update card's first button (pets.json ui U1, U5) */
    /* wave 3 (25 Oct 2026): one name — the 🐾 button and its sheet are both 'My pets' */
    'care.corner.title': 'My pets',
    'care.welcome.corner': 'See my pets',
    /* wave 3: My pets as one list — its footer (pantry count, adopt, food, clothes) */
    'care.adoptPet': 'Adopt a pet',
    'care.petClothes': 'Pet clothes',
    'care.pantryMeals': 'Pantry: {n} meals',
    'care.pantryMeals.one': 'Pantry: 1 meal',
    /* a pet card's other buttons (U5, U9) */
    'care.dress': 'Dress',
    'care.rename': 'Rename',
    'care.makeRunner': 'Make my runner',
    /* the Pet Shop's food group, its Home group, the first filter chip and the adopt button (U8; catalogue.shelves) */
    'care.shop.food': 'Pet food',
    'care.shop.home': 'Home Pet Shop',
    'care.shop.all': 'All',
    'care.shop.adopt': 'Adopt',
    /* the farewell card's button to the Memory Book (U11) */
    'care.memory.see': 'See the Memory Book',
    /* the creator's Clothes panel, and a cast card when ⭐ are short (characters.json uiFlows.child) */
    'char.moreWardrobe': 'More in the Wardrobe',
    /* d-island (James: one goal wording) — were 'You need {n} more ⭐' and 'Save up for it' */
    'char.cast.need': 'Need {n} more ⭐',
    'char.cast.save': '🎯 My goal',

    /* ---------------- two wallets (F-KU5; James, 24 Oct 2026; docs/island3d/v3/kids-update/wallets.md) ----------------
       Learning earns ⭐ for 🎁 My rewards and the same number of 🪙 coins for My Island, which pays only in 🪙. The
       host picks the coin form of a line that names the money while SLWorldCore.walletOf() is 'coins'; the ⭐ form
       stays for a core that pays in stars. care.basic.* are F-KU4's free basic meal (wallets.md, word for word).
       The island calls the ⭐ 'points', as 🎁 My rewards and the app's top bar do (F-KU5 review): in the learning
       screens 'stars' are mastery stars, and on the island the pets' memory stars. */
    'char.cast.needCoins': 'Need {n} more 🪙',
    'care.noCoins': 'Need {n} more 🪙 for {food}.',
    'care.basic.button': 'Free basic meal',          /* the Pet Corner draws the 🥣 in front, as the paw on My pets */
    'care.basic.line': 'Out of food? {name} can have a free basic meal today.',
    'care.basic.done': '{name} enjoyed a basic meal. Their favourite food is in the Pet Shop.',
    'care.basic.visit': 'Visit with a free basic meal',
    'care.basic.shop': 'Out of coins? A hungry pet can have a free basic meal in My pets.',
    /* R2 (QA round 2, 25 Oct 2026): the naming step says what to do and its box is named 'Name' (QA2A-11a); a food
       tray with something to eat says what to do, as a full one says why not (QA2A-11b) */
    'care.nameAsk': 'Give your new pet a name.',
    'care.nameBox': 'Name',
    'care.pickFood': 'Pick a food for {name}.',
    'isle.unlockForCoins': 'Unlock for 🪙 {price}',
    'lock.signCoins': '{island} · 🪙 {price}',
    'games.noCoins': 'Games are just for fun. They never earn or spend coins or points.',
    'intro.2.coinsBody': 'Every maths, spelling or flags session earns 🪙 coins for your island, and the same number of points for My rewards.',
    'intro.3.coinsBody': 'Spend 🪙 coins on sky islands, pets, a football pitch, a race track and more. Your points are never spent here. They stay for My rewards.',
    'intro.3.trialCoins': 'Everything on the island is free right now: sky islands, pets, a football pitch, a race track and more. Nothing is spent, so your 🪙 coins wait for later. Try it all and tell Dad what you think.',
    /* the one-time card for a child who had an island before the coins came (queued like every island-open card) */
    'coins.news.title': 'Island coins are here',
    'coins.news.earn': 'My Island has its own money now: 🪙 coins. When learning gives you points, you get the same number of coins too.',
    'coins.news.stars': 'Your points stay for My rewards. The island never uses them.',
    'coins.news.keep': 'Everything you already have on your island is still yours.',
    'coins.news.start': 'Your coins start today. Every bit of learning adds more.',
    'coins.news.trial': 'Your coins start today. While we test, the island is free, so they wait for later.',
    'coins.news.ok': 'Got it',
    /* the Island Shop's lines about the money, the big-buy question and the end of free test mode */
    'coins.shop.line': 'Island things cost 🪙 coins. Your points stay for My rewards.',
    'coins.shop.trialLine': 'Nothing is spent here while we test: not your coins, not your points.',
    'coins.confirm.note': 'Island things use 🪙 coins. Your points for My rewards are never spent here.',
    'coins.trialOver.body': 'From now on, island things cost 🪙 coins, which you earn by learning.',
    'coins.trialOver.keep': 'Your points stay for My rewards. Everything you already picked is still on your island.',
    'coins.goal.trial': 'Test mode: everything on the island is free. Nothing is spent.',
    'coins.balance': 'Your island coins',

    /* ---------------- Island activities v1 (IA-0; chatgpt-feedback/ISLAND-ACTIVITIES-PLAN.md §3, James 25-26 Oct 2026) ----------------
       The act.* family, word for word from docs/island3d/v3/kids-update/activities.json copy.keys (tests/world-copy-acts.test.js).
       Free play: nothing here earns or spends; only the goal lines name the money. Five plan keys are not here because the
       table already says the same thing (activities.json copy.reused): act.today.go reads isle.goThere ('Go there'), and the
       Next step card's ride, visit and decorate ideas keep James's decisions build words (next.ride / next.tryThing,
       next.visit, next.bag / next.bagBtn). These keys also use {move} and {date} (a date the host formats). */
    /* the 📋 Today sign over the house, and its sheet */
    'act.today.sign': '📋 Today',
    'act.today.title': 'Today on your island',
    'act.today.day': 'Island day {n}',
    'act.today.visitor': '{name} is visiting today.',
    'act.today.nextVisitor': 'Coming next time: {name}.',
    'act.today.show': 'Show day on {island}!',
    'act.today.nextShow': 'Next show: {island}.',
    'act.today.spy': 'Today’s I spy is on {island}.',
    'act.today.goal': '🎯 My goal: {item}',
    'act.today.up': 'Up {n} 🪙 since last time.',
    'act.today.watch': '▶ Watch',
    'act.today.book': '📖 My island book',
    /* the aria label of the sign's dot (never shown as text) */
    'act.today.newStamps': 'You have new stamps in your book.',
    'act.today.calm': 'Visitors and shows wait for your next island day. Nothing is missed while you’re away.',
    'act.today.hint': '📋 New on your island: tap Today over your house to see what’s on.',
    'act.help.today': '📋 Today shows who’s visiting, the weather and the day’s show.',
    /* weather (from the date: the same for siblings) and the UK seasons; Season looks is a per-device switch in ❓ Help */
    'act.wx.sunny': 'Sunny all day.',
    'act.wx.breezy': 'Breezy: the clouds are racing today.',
    'act.wx.starry': 'Clear skies: lots of stars at Showtime.',
    'act.wx.snow': 'Snow day! Your pets love it.',
    'act.wx.next.sunny': 'Tomorrow looks sunny.',
    'act.wx.next.breezy': 'Tomorrow looks breezy.',
    'act.wx.next.starry': 'Tomorrow night looks clear and starry.',
    'act.wx.next.snow': 'Tomorrow looks snowy.',
    'act.wx.spring': 'Spring: blossom is drifting on the breeze.',
    'act.wx.summer': 'Summer: the butterflies are out.',
    'act.wx.autumn': 'Autumn: the leaves are falling.',
    'act.wx.winter': 'Winter: frosty mornings on the island.',
    'act.wx.looks': 'Season looks',
    'act.wx.looksHelp': 'Snow, leaves and blossom on your island. Switch them off here if you like.',
    /* the day's visitor (one of the 12 characters, never a price, Buy or the shop); act.vis.waves is for screen readers */
    'act.vis.title': '{name} is visiting',
    'act.vis.hi': 'Hello! I’m {name}. I’ve come to see your island.',
    'act.vis.hello': '👋 Say hello',
    'act.vis.tour': 'Show me round',
    'act.vis.tourAsk': 'What should I try? Tap something to show me.',
    'act.vis.loved': '{name} loved the {item}!',
    'act.vis.move': 'Show me your move!',
    'act.vis.moveSay': 'This is my {move}!',
    'act.vis.bye': 'Thanks for having me! See you another day.',
    'act.vis.waves': '{name} waves back.',
    /* show time */
    'act.show.start': '▶ Start the show',
    'act.show.here': '▶ Put on a show here',
    'act.show.open': 'Welcome to the show on {island}!',
    'act.show.host': '{name} is hosting today’s show.',
    'act.show.skip': 'Skip',
    'act.show.end': 'That’s the show! Thanks for watching.',
    'act.show.again': 'Watch again',
    'act.show.pill': 'Show today',
    /* I spy: the 12 clues (act.spy.c.<clue id>, activities.json CLUES) and the play bar's words */
    'act.spy.title': '👀 I spy',
    'act.spy.c.round': 'I spy something that goes round and round.',
    'act.spy.c.updown': 'I spy something that goes up and down.',
    'act.spy.c.slide': 'I spy something you could slide down.',
    'act.spy.c.music': 'I spy something that makes music.',
    'act.spy.c.food': 'I spy something you could eat.',
    'act.spy.c.light': 'I spy something that lights up.',
    'act.spy.c.rest': 'I spy somewhere a pet could have a rest.',
    'act.spy.c.bounce': 'I spy something you could bounce on.',
    'act.spy.c.water': 'I spy something with water in it.',
    'act.spy.c.swing': 'I spy something that swings.',
    'act.spy.c.animal': 'I spy an animal that isn’t a pet.',
    'act.spy.c.biggest': 'I spy the biggest thing on {island}.',
    'act.spy.yes': 'Yes! The {item} fits.',
    'act.spy.clue': 'Need a clue?',
    'act.spy.near': 'Look near the {item}.',
    'act.spy.show': 'Show me',
    'act.spy.read': '🔊 Read it to me',
    'act.spy.next': 'Next one',
    'act.spy.again': 'You’ve spied them all here. They start again from the first one.',
    /* playing with a pet: fetch, hide and seek */
    'act.fetch.chip': '🎾 Fetch',
    'act.fetch.how': 'Tap the island to throw the ball.',
    'act.fetch.good': 'Good catch, {name}!',
    'act.fetch.done': '{name} had a great game of fetch!',
    'act.hide.chip': '🙈 Hide and seek',
    'act.hide.count': 'Close your eyes… 3, 2, 1!',
    'act.hide.where': 'Where’s {name}? Turn the island to look behind things.',
    'act.hide.where2d': 'Where’s {name}? Tap things to look behind them.',     /* integration (28 Oct): the 2D island cannot turn */
    'act.hide.no': 'Not behind the {item}…',
    'act.hide.wobble': 'Watch for something that wobbles…',
    'act.hide.found': 'Found you, {name}!',
    'act.hide.end': 'You found {name} {n} times!',
    'act.pet.again': 'Again',
    'act.pet.done': 'Done',
    'act.pet.wantsFetch': '{name} wants to play fetch.',
    'act.pet.wantsHide': '{name} wants to play hide and seek.',
    'act.pet.play': 'Let’s play',
    /* a pet's wish of the day (never for a hungry, Hotel, Rescue or star pet) */
    'act.wish.ride': '{name} would love a go on the {item} today.',
    'act.wish.rest': '{name} would like a rest on the {item}.',
    'act.wish.visit': '{name} would love to see {island}.',
    'act.wish.meet': '{name} would love to meet today’s visitor.',
    'act.wish.done': '{name} had a great time on the {item}!',
    'act.wish.doneVisit': '{name} is loving {island}!',
    'act.wish.doneMeet': '{name} has made a new friend.',
    'act.wish.calm': 'Wishes change every island day. There’s no rush.',
    /* 📖 My island book: owned islands only, it counts up ('{n} stamps so far'), never 'x of y' */
    'act.book.title': '📖 My island book',
    'act.book.open': 'Open my book',
    'act.book.newOne': '📖 New stamp: {item}',
    'act.book.newMany': '📖 New stamps in your book: {n}',
    'act.book.found': 'Found on {date}',
    'act.book.count': '{n} stamps so far',
    'act.book.count.one': '1 stamp so far',
    'act.book.empty': 'Do things on your island to fill this page.',
    'act.book.complete': 'Your {island} page is complete!',
    'act.book.flag': 'Look out for your explorer flag by the bridge.',
    'act.book.first': 'Your island’s first day: {date}.',
    'act.book.visitors': 'Visitors’ book',
    'act.book.visited': 'Visited {n} times.',
    'act.book.visited.one': 'Visited once.',
    'act.book.noVisitors': 'Visitors sign here when they come to your island.',
    'act.book.passports': '🧳 Pet passports',
    'act.book.ppIslands': '{name} has been to {n} islands.',
    'act.book.ppIslands.one': '{name} has been to 1 island.',
    'act.book.ppNone': 'Islands {name} visits with you show here.',
    'act.book.ppStamp': '{name} visited {island}',
    'act.book.ppTake': 'Take {name} travelling',
    /* the stamps' how-lines (activities.json STAMPS) */
    'act.st.house': 'Tap your house',
    'act.st.map': 'Open the Sky map',
    'act.st.findme': 'Find yourself on the island',
    'act.st.showtime': 'Switch on Showtime',
    'act.st.hello': 'Say hello to a visitor',
    'act.st.tree': 'Shake a tree',
    'act.st.visit': 'Visit {island}',
    'act.st.landmark': 'Make the {landmark} go',
    'act.st.night': 'Visit at Showtime',
    'act.st.pat': 'Pat a pet here',
    'act.st.fetch': 'Play fetch here',
    'act.st.hide': 'Play hide and seek here',
    'act.st.show': 'Watch a show here',
    'act.st.spy': 'Spy something here',
    'act.st.try3': 'Try 3 of your things here',
    'act.st.tryAll': 'Try every ride you have here',
    'act.st.gear': 'Bring a pet in {island} gear',
    'act.st.new': 'Try your new {item}',
    /* the Next step card's visitor idea, and the slim goal bar's aria label under every other card while a goal is set */
    'act.next.visitor': '{name} is visiting today. Say hello!',
    'act.next.goalBar': '🎯 My goal: {item}, {n} of {price}',
    /* the Games sheet's 'Play on your island' block, and the toast when Learn and come back sets the goal */
    'act.free.title': 'Play on your island',
    'act.free.note': 'Just for fun: nothing to earn or spend.',
    'act.free.fetch': '🎾 Fetch with {name}',
    'act.free.hide': '🙈 Hide and seek with {name}',
    'act.free.spy': '👀 I spy',
    'act.free.today': '📋 Today on your island',
    'act.goal.set': '🎯 My goal is now {item}.'
  };

  /* re-voiced descriptions: every CATALOG desc with a banned word, plus a few that read young */
  var DESC = {
    house_cottage: 'Your home base. Tap it to restyle the walls, roof, door and shape.',
    wall_cream: 'Warm cream walls. A classic.',
    pet_puppy: 'Your first pet. Loyal, bouncy and always ready to go.',
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
    /* QA#9: a game's card already names its game ('🎮 Neon Grand Prix: kart racing'), so these never do */
    att_pitch: 'A football pitch for your island.',
    att_kart: 'A garage and race track entrance for your island.',
    track_loop: 'A smooth loop round the island.'
  };

  function core() { return CORE0 || (root && root.SLWorldCore) || null; }
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

  function t(key, vars, fallback) {
    /* a count of one reads its singular form when the table has one ('<key>.one') */
    if (vars && typeof vars === 'object' && (vars.n === 1 || vars.n === '1') && own(STRINGS, key + '.one')) key = key + '.one';
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
