/* ================================================================
   Challenges for Debut Run and Encore Shootout — the rules (pure:
   no DOM, no network, no clock, no storage; randomness only through
   the rand argument, Math.random when none is given). Classic UMD: window.SLDuelCore in the browser,
   module.exports in Node. Loaded lazily, with social-core.js,
   kart-net.js, duel-net.js, lobby-groups.js and duel-lobby.js, the
   first time a child taps ⚔️ Challenge or 🔑 Join with a code.

   A challenge is the 1% head to head for an action game: a child
   opens a room under one of 50 game words, family or class friends
   join with the word, everyone plays the same seeded round at the
   same moment on their own device, and the results are compared
   kindly: each round ranks the children 1st, 2nd, 3rd (James, 24 Oct
   2026), the last place always with 'great effort'. Each round is an
   ordinary round: it records the personal best and posts to the
   game's own family and class board; this file keeps no wins board.

   Rooms live only inside a family or a class a grown-up set up: the
   address hashes that group's race key. 'code' rooms (friends from
   other families) are not built in this release (KU14): 'code' is a
   reserved kind that eligibility() always reports off and that
   roomText() and roomId() refuse with an error.

   What travels between devices (check): a seat tag, avatar and
   colour as index numbers, progress, kick results, scores, a seed,
   a variant id from the game's own list and state words. Never a
   name, never text a child typed (the typed code only picks a word
   from WORDS), never a photo, look, outfit or species id. A message
   is used only if it is at most 1,200 characters and holds exactly
   its listed fields, each in range.

     PROTO, GAMES, GAME_IDS        protocol 1; {course: {max 5, rules 2}, penalty: {max 2, rules 3}}
     WORDS, OLD_WORDS, isWord(w), word(text), spell(w), newWord(rand, avoid), newSeed(rand)
                                   (OWLS replaced OWL2; OLD_WORDS ['OWL2'] still taken, never drawn)
     ROOM_KINDS, RESERVED_KINDS    ['family', 'class']; ['code'] (refused everywhere)
     roomText(kind, key, game, w)  'sl-duel1|kind|raceKey|game|WORD' (throws on 'code' or bad input)
     roomId(kind, key, game, w)    'ttq-duel-…' (the room's address on the link-up server)
     eligibility(env)              {family, class, code: false, reason: null | {code, text}}
     parse(data), check(msg, fromHost, game)    a received message, or null
     validScore(game, variant, v)  SLBoardsCore.validValue on the board key (a mirror when not loaded)
     standings(rows, game, variant) rows with place, shared, last, rank (ties share; every round ranked)
     rank(place, last, shared)     '1st' · 'Shared 2nd' · '3rd — great effort!' (the last place)
     line(meSeat, rows, game, names, info)      {text, kind: 'top' | 'tie' | 'near' | 'good', place, last, rank}
     shootout(opts)                the decider and team-try machine for the Shootout
     debutTry(rows, tries)         may the host offer a Debut Run team try?
     BOARD_MAP, MODES, boardKey(game, mode, variant)   every mode → its board key
     T, fill(text, vars)           all the challenge copy, and its {placeholders}
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLDuelCore) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLDuelCore;
    return;
  }
  var BC0 = null;
  if (typeof module === 'object' && module.exports) { try { BC0 = require('./boards-core.js'); } catch (e) { BC0 = null; } }
  /* looked up at each call: the boards file loads on its own schedule in the browser */
  function boardsCore() { return BC0 || (typeof window !== 'undefined' && window.SLBoardsCore) || null; }

  var PROTO = 1;
  var MAX_CHARS = 1200;          /* a message longer than this is never parsed */
  var TEAM_TRIES = 3;            /* shared by everyone in a challenge session */
  var KICKS = 8, DECIDERS = 5;   /* the Shootout: 8 kicks, then up to 5 decider kicks */
  var DIVE_KICKS = KICKS + DECIDERS;   /* the kick numbers a Shootout challenge can use (0 to 12) */
  var NEAR_PART = 0.1;           /* a near miss: within 10% of the score above */
  var RINGS_BIT = 65536;         /* pet-course's PB extra: bit 16 = Timing rings were on (🎯 beside the name) */
  var KEY_RE = /^[0-9a-f]{32}$/; /* a race key, as the Control Centre writes it */
  var SEED_MAX = 4294967295;

  /* the 50 Flags challenge words (index.html FC_CODE_WORDS; a test keeps them equal), so the
     family pop-up's code check (RV1a codeOk) knows them. Four letters each: OWLS replaced
     OWL2 (25 Oct 2026: a digit among letters trips children up). OLD_WORDS are still taken for
     one release (a room an older device opened under one can still be joined); a new room is
     never opened under one. */
  var WORDS = ['FROG', 'BEAR', 'MOON', 'TREE', 'FIRE', 'LION', 'FISH', 'GOLD',
    'KITE', 'RAIN', 'SNOW', 'STAR', 'DUCK', 'CAKE', 'KING', 'ROCK', 'WAVE', 'DEER', 'HERO',
    'PINK', 'MILK', 'BIRD', 'CORN', 'HARP', 'JADE', 'BOOK', 'LAMP', 'PLUM', 'WOLF', 'SWAN',
    'MINT', 'PEAR', 'OWLS', 'HOPS', 'RICE', 'DUNE', 'ROSE', 'LIME', 'SAND', 'GEMS', 'LAKE',
    'PEAK', 'MOSS', 'BUZZ', 'BOLT', 'GAZE', 'SAGE', 'TIDE', 'OPAL', 'VINE'];
  var OLD_WORDS = ['OWL2'];

  /* the two games with challenges. rules = the game's own rules number (pet-course
     COURSE_RULES, penalty PENALTY_RULES): two versions never meet in one challenge.
     variants = the game's board variants in board order (a test pins them to SLBoardsCore) */
  var GAMES = {
    course: { max: 5, rules: 2, name: 'Debut Run', emoji: '🐾', variants: ['course_meadow', 'course_beach', 'course_snow', 'course_candy'] },
    penalty: { max: 2, rules: 3, name: 'Encore Shootout', emoji: '⚽', variants: ['std', 'rival_bop', 'rival_glowy', 'rival_flip'] }
  };
  var GAME_IDS = ['course', 'penalty'];
  /* the board limits of each game, the same on every board of it (validScore's mirror, for a
     page that has not loaded boards-core.js; a test compares it with SLBoardsCore.validValue) */
  var LIMITS = { course: { min: 0, max: 5000, step: 1 }, penalty: { min: 0, max: 1200, step: 10 } };
  var EXTRA_MAX = { course: 131071, penalty: KICKS };   /* course: the PB bitfield (bits 0–16); penalty: goals */

  var ROOM_KINDS = ['family', 'class'];
  var RESERVED_KINDS = ['code'];

  /* state words: a Debut Run show, a seat in the room, a row the host relays or ends with */
  var SHOW_ST = ['run', 'pause', 'bow', 'arch', 'done'];
  var ROW_ST = SHOW_ST.concat(['weak', 'left']);
  var SEAT_ST = ['lobby', 'playing', 'results', 'weak', 'left'];
  var ROOM_ST = ['lobby', 'playing', 'results'];
  var INFO_ST = ['lobby', 'playing', 'full'];
  var KICK_RES = ['goal', 'save', 'miss'];

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fin(n) { return typeof n === 'number' && isFinite(n); }
  function isInt(n) { return fin(n) && Math.floor(n) === n; }
  function gameOf(g) { return typeof g === 'string' && has(GAMES, g) ? GAMES[g] : null; }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ---------- copy ---------- */
  /* Every challenge string a child sees. UK English, sentence case, at most one emoji each;
     no fail / lose / bad / wrong, no chance or prize words ('came out on top', never 'wins').
     {placeholders} are filled by fill(). Code rooms have no lines here (KU14). */
  var T = {
    game: { course: 'Debut Run', penalty: 'Encore Shootout' },
    menu: { challenge: '⚔️ Challenge', join: '🔑 Join with a code' },
    reason: {
      offline: 'Challenges need the internet.',
      notfamily: 'Challenges are for family logins. Ask a grown-up to sign you in.',
      notswitched: 'Ask your grown-up to switch on challenges in the Control Centre.',
      notime: 'That’s all the game time for today.'
    },
    host: {
      title: '⚔️ Challenge — {game}',
      who: 'Who do you want to play?',
      family: '🏠 My family',
      klass: '🏫 {cls}',
      pickCourse: 'Choose the course',
      pickRival: 'Choose your rival',
      open: '▶ Open the challenge',
      opening: 'Opening your challenge…',
      yours: '⚔️ Your challenge',
      say: 'Your code is {letters}',
      tellFamily: 'Your family will get a pop-up. Or tell them the code.',
      tellClass: 'Tell your class this code.',
      onlyOne: 'Head to head: one friend can join.',
      ready: 'ready',
      waiting: 'getting ready…',
      start: '▶ Start',
      cancel: 'Cancel',
      alone: 'Waiting for someone to join…',
      nobody: 'Nobody has joined yet. Try again in a while!'
    },
    join: {
      title: '🔑 Join with a code',
      prompt: 'Type the 4-letter code from your friend',
      aria: 'Code from your friend',
      go: '▶ Join',
      looking: 'Looking for {code}…',
      joined: 'Joined! Waiting for the starter to press Start.',
      notWord: 'That isn’t one of the game words. Check it with your friend.',
      notFound: 'Can’t find a challenge with code {code}. Ask your friend to keep their screen open and check the code.',
      full: 'That challenge is full.',
      started: 'That challenge has started. Ask your friend to open a new one.',
      self: 'You’re already in this on another device. Each child needs their own login.',
      leave: 'Leave'
    },
    net: {
      server: 'Can’t reach the game server.',
      check: 'Can’t check who is playing. Try again.',
      retry: '↻ Try again',
      sat: 'This device wasn’t ready in time. You’re in the next round.'
    },
    play: {
      waitingKick: 'Waiting for {name}’s kick…',
      aiming: 'aiming',
      decider: '⚡ Decider kicks! Next goal decides.',
      tries: '🤝 Team tries: if you both miss, you both kick again.',
      /* a retake is the next kick number: the same marker starts and the same keeper for both (shootout() below) */
      usedTry: 'You both missed — a team try! Next kick.'
    },
    results: {
      top: '🏆 You came out on top!',
      topShow: '🏆 You came out on top! Your show {mine} · {name} {theirs}',
      topGoals: '🏆 You came out on top! {score}',
      topDeciders: '🏆 You came out on top on the decider kicks!',
      other: '{name} came out on top this time.',
      near: 'So close — just {gap} behind!',
      otherGoals: '{name} came out on top this time — {score}. So close!',
      otherDeciders: '{name} came out on top this time, on the decider kicks. So close!',
      good: 'Great show! Rematch?',
      solo: 'Great show!',
      tie: '🤝 Shared top spot!',
      bothKeepers: '🤝 Both keepers did brilliantly — shared top spot!',
      /* the place of each child in the round (James, 24 Oct 2026: rank and compare), the last
         place always with the kind words */
      places: ['1st', '2nd', '3rd', '4th', '5th'],
      rankShared: 'Shared {place}',
      rankLast: '{place} — great effort!',
      effort: 'Great effort!',            /* beside the last place's name in a list of 3 to 5 */
      allBowed: 'Everyone took a bow early! Use a team try 🤝 to run this stage again together? ({n} left)',
      tryAgain: '🤝 Try again together',
      done: 'Done',
      waitTry: 'Waiting for {name}…',
      rematch: '⚔️ Rematch',
      waitRematch: 'Waiting for {name} to start the rematch…',
      lost: 'We couldn’t hear from {name}’s device. Your score still counts for your best and the boards.',
      ended: 'The challenge ended early. Your score still counts for your best and the boards.',
      closed: 'The challenge was closed.',
      version: 'A device needs the update. Reload the game on both devices.',
      back: '🏝️ Back to my island'
    },
    popup: {
      course: '🐾 Someone in your family started a Debut Run challenge!',
      penalty: '⚽ Someone in your family started an Encore Shootout challenge!',
      kart: '🏎️ Someone in your family started a Neon Grand Prix challenge!',
      sub: 'Code {code} — want to play?',
      busy: 'Finish your game first, then tap 🔑 Join with a code — {code}.'
    }
  };
  /* '{name} came…' with vars {name: 'Ella'}; a placeholder with no value stays as it is */
  function fill(text, vars) {
    var s = String(text == null ? '' : text);
    if (!isObj(vars)) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) && vars[k] != null ? String(vars[k]) : m; });
  }

  /* ---------- words and seeds ---------- */
  /* one of the game words, or one of OLD_WORDS (taken for one release, never drawn) */
  function isWord(w) { return typeof w === 'string' && (WORDS.indexOf(w) >= 0 || OLD_WORDS.indexOf(w) >= 0); }
  /* what a child typed into the code box → the game word it is, or null ('frog ' → 'FROG') */
  function word(text) {
    if (typeof text !== 'string' || text.length > 12) return null;
    var w = text.replace(/\s+/g, '').toUpperCase();
    return isWord(w) ? w : null;
  }
  /* the word as the shell says it aloud: 'F, R, O, G' */
  function spell(w) { return isWord(w) ? w.split('').join(', ') : ''; }
  /* rand() → a number in [0, 1) (Math.random, or a test's own); anything else counts as 0 */
  function draw(rand) {
    var x = 0;
    try { x = typeof rand === 'function' ? Number(rand()) : Math.random(); } catch (e) { x = 0; }
    return fin(x) && x >= 0 && x < 1 ? x : 0;
  }
  /* a word to host under; avoid = words already tried (a word another room holds right now) */
  function newWord(rand, avoid) {
    var pool = Array.isArray(avoid) && avoid.length ? WORDS.filter(function (w) { return avoid.indexOf(w) < 0; }) : WORDS;
    if (!pool.length) pool = WORDS;
    return pool[Math.floor(draw(rand) * pool.length)];
  }
  /* a 32-bit seed for a Debut Run stage or a Shootout's marker starts (its keeper draws nothing: he reacts to the ball) */
  function newSeed(rand) {
    var hi = Math.floor(draw(rand) * 65536), lo = Math.floor(draw(rand) * 65536);
    return ((hi << 16) | lo) >>> 0;
  }

  /* ---------- rooms ---------- */
  function refused(msg, code) { var e = new Error(msg); e.code = code; return e; }
  function isKind(kind) { return typeof kind === 'string' && ROOM_KINDS.indexOf(kind) >= 0; }
  /* The text a room is addressed by (and that its lobby tickets are bound to). A family room
     hashes the family's race key, a class room the class's; whoever cannot read that key can
     neither find the room nor prove a ticket. 'code' is refused: no room outside a family or a
     class a grown-up set up. Bad input throws too, so an empty key is never dialled. */
  function roomText(kind, key, game, w) {
    if (RESERVED_KINDS.indexOf(kind) >= 0) throw refused('Challenge rooms with a code are not available.', 'refused');
    if (!isKind(kind)) throw refused('Unknown challenge room kind.', 'invalid');
    if (typeof key !== 'string' || !KEY_RE.test(key)) throw refused('A challenge room needs its group\'s race key.', 'invalid');
    if (!gameOf(game)) throw refused('Unknown challenge game.', 'invalid');
    if (!isWord(w)) throw refused('Not one of the game words.', 'invalid');
    return 'sl-duel1|' + kind + '|' + key + '|' + game + '|' + w;
  }
  /* FNV-1a, 32 bits, whole-number maths (kart-net's own), so every browser and Node agree */
  function fnv(text, h) {
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /* the room's peer id: only two hashes of the room text, never the key or the word itself */
  function roomId(kind, key, game, w) {
    var text = roomText(kind, key, game, w);
    return 'ttq-duel-' + fnv(text, 0x811c9dc5).toString(36) + fnv(text, 0x01234567).toString(36);
  }

  /* ---------- who may challenge ---------- */
  /* env, all read by the caller (lobby-groups) before any room is opened:
       online      the device is online (and the link-up server reachable)
       signedIn    signed in with a family account (not a guest)
       bound       that account is the one bound to this profile
       ticked      SLSocialCore.memberOk: ticked by the family grown-up, with its own password
       race        the family's games.race ('Race together and challenges')
       classRace   a member of a class whose races are on and that is not closed
       codeOn      read and ignored: code rooms are not built in this release (KU14)
       ON          SLSocialCore.ON (release switches: duels, classes)
       gate        the game-time gate ({allowed} or a boolean): a round is allowed now
     The first reason that applies is given: offline, notfamily, notswitched, notime. */
  function eligibility(env) {
    var e = isObj(env) ? env : {}, on = isObj(e.ON) ? e.ON : {};
    var out = { family: false, 'class': false, code: false, reason: null };
    function why(code) { out.reason = { code: code, text: T.reason[code] }; return out; }
    if (e.online !== true) return why('offline');
    if (e.signedIn !== true || e.bound !== true) return why('notfamily');
    var duels = on.duels !== false && e.ticked === true;
    var fam = duels && e.race === true;
    var cls = duels && e.classRace === true && on.classes !== false;
    if (!fam && !cls) return why('notswitched');
    var g = e.gate;
    if (g === false || (isObj(g) && g.allowed === false)) return why('notime');
    out.family = fam;
    out['class'] = cls;
    return out;
  }

  /* ---------- messages ---------- */
  function num(lo, hi) { return function (x) { return fin(x) && x >= lo && x <= hi; }; }
  function int(lo, hi) { return function (x) { return isInt(x) && x >= lo && x <= hi; }; }
  function re(r) { return function (x) { return typeof x === 'string' && r.test(x); }; }
  function oneOf(list) { return function (x) { return typeof x === 'string' && list.indexOf(x) >= 0; }; }
  function bool(x) { return x === true || x === false; }
  function opt(f) { return function (x) { return x === undefined || f(x); }; }
  function orNull(f) { return function (x) { return x === null || f(x); }; }
  function listOf(max, f) {
    return function (a) {
      if (!Array.isArray(a) || a.length > max) return false;
      for (var i = 0; i < a.length; i++) if (!f(a[i])) return false;
      return true;
    };
  }
  function tuple(fs) {
    return function (a) {
      if (!Array.isArray(a) || a.length !== fs.length) return false;
      for (var i = 0; i < fs.length; i++) if (!fs[i](a[i])) return false;
      return true;
    };
  }
  /* exactly these fields and no others: a message with a name, or anything extra, fails */
  function shape(spec) {
    return function (o) {
      if (!isObj(o)) return false;
      var keys = Object.keys(o), i;
      for (i = 0; i < keys.length; i++) if (!has(spec, keys[i])) return false;
      for (var k in spec) if (has(spec, k) && !spec[k](has(o, k) ? o[k] : undefined)) return false;
      return true;
    };
  }
  function scoreOk(g) { var L = LIMITS[g]; return function (v) { return isInt(v) && v >= L.min && v <= L.max && v % L.step === 0; }; }
  var kind = function (x) { return typeof x === 'string'; };
  var vTag = re(/^[0-9a-f]{8}$/), vHex16 = re(/^[0-9a-f]{16}$/), vAi = int(0, 23), vCi = int(0, 7), vVer = int(0, 1e6);
  var vRound = int(0, 1e6), vSeq = int(0, 1e9), vClock = num(-1e15, 1e15), vGame = oneOf(GAME_IDS), vKick = int(0, DIVE_KICKS - 1);
  /* the message tables, one pair per game (built once): seats, rows and scores follow the game */
  function tables(g) {
    var G = GAMES[g], seat = int(0, G.max - 1), score = scoreOk(g), extra = int(0, EXTRA_MAX[g]), variant = oneOf(G.variants);
    var endRow = tuple([seat, orNull(score), orNull(extra), oneOf(ROW_ST), orNull(int(1, G.max))]);
    var endShape = shape({ t: kind, r: opt(vRound), why: oneOf(['done', 'closed', 'tie']), rows: opt(listOf(G.max, endRow)) });
    var guest = {
      hello: shape({ t: kind, v: vVer, rules: vVer, game: vGame }),
      join: shape({ t: kind, tag: vTag, ai: vAi, ci: vCi, tok: opt(vHex16) }),
      p: shape({ t: kind, c: vClock, rt: opt(num(0, 60000)) }),
      rdy: shape({ t: kind, built: bool }),
      f: shape({ t: kind, r: vRound, score: score, extra: extra, st: oneOf(SHOW_ST) }),
      back: shape({ t: kind }),
      bye: shape({ t: kind })
    };
    var host = {
      info: shape({ t: kind, v: vVer, rules: vVer, game: vGame, tag: vTag, ai: vAi, ci: vCi, used: int(1, G.max), state: oneOf(INFO_ST), variant: variant }),
      no: shape({ t: kind, why: oneOf(['full', 'version', 'closed']) }),
      seat: shape({ t: kind, seat: int(1, G.max - 1), tok: vHex16 }),
      room: shape({ t: kind, q: vSeq, state: oneOf(ROOM_ST), variant: variant,
        players: listOf(G.max, shape({ seat: seat, tag: vTag, ai: vAi, ci: vCi, st: oneOf(SEAT_ST), rdy: bool })) }),
      q: shape({ t: kind, c: vClock, h: vClock }),
      go: shape({ t: kind, r: vRound, seed: int(0, SEED_MAX), variant: variant, goAt: vClock, tries: int(0, TEAM_TRIES) }),
      end: function (o) { return endShape(o) && (o.r === undefined) === (o.rows === undefined); }
    };
    if (g === 'course') {
      guest.s = shape({ t: kind, r: vRound, q: vSeq, sec: int(0, 5), prog: int(0, 1000), score: score, st: oneOf(SHOW_ST) });
      host.rel = shape({ t: kind, r: vRound, rows: listOf(G.max, tuple([seat, int(0, 5), int(0, 1000), score, oneOf(ROW_ST)])) });
    } else {
      guest.k = shape({ t: kind, r: vRound, k: vKick, res: oneOf(KICK_RES), pts: int(0, 150) });
      host.open = shape({ t: kind, r: vRound, k: vKick });
      host.rv = shape({ t: kind, r: vRound, k: vKick, rows: listOf(G.max, tuple([seat, oneOf(KICK_RES), int(0, 150)])) });
      host.dec = shape({ t: kind, r: vRound, n: int(1, DECIDERS), tries: int(0, TEAM_TRIES) });
    }
    return { guest: guest, host: host };
  }
  var TABLES = { course: tables('course'), penalty: tables('penalty') };
  /* what came down a link: a string of at most 1,200 characters holding one JSON object, or null */
  function parse(data) {
    if (typeof data !== 'string' || data.length > MAX_CHARS) return null;
    try { var o = JSON.parse(data); return isObj(o) ? o : null; } catch (e) { return null; }
  }
  /* The message (parsed first when it is the raw text) when it is one this side may receive in
     this game and every field is the right type and in range; otherwise null. An object that
     would not fit in 1,200 characters is refused too, so nothing is sent that cannot arrive.
     fromHost true: a guest checking what the host sent. Never throws. */
  function check(msg, fromHost, game) {
    try {
      var o = typeof msg === 'string' ? parse(msg) : msg;
      if (!isObj(o) || typeof o.t !== 'string' || !gameOf(game)) return null;
      if (typeof msg !== 'string' && JSON.stringify(o).length > MAX_CHARS) return null;
      var table = fromHost ? TABLES[game].host : TABLES[game].guest;
      return has(table, o.t) && table[o.t](o) ? o : null;
    } catch (e) { return null; }
  }

  /* (the Shootout keeper has no pre-rolled moves since PENALTY_RULES 3: he reacts to the ball, so
     both children face the same keeper without anything being handed over) */

  /* ---------- scores and standings ---------- */
  /* a score the game's board would take (SLBoardsCore.validValue on 'game:variant'); an
     impossible value shows as '—' and is never compared */
  function validScore(game, variant, v) {
    var G = gameOf(game);
    if (!G || G.variants.indexOf(variant) < 0) return false;
    var B = boardsCore();
    if (B && typeof B.validValue === 'function') return B.validValue(game + ':' + variant, v) === true;
    return scoreOk(game)(v);
  }
  function seatOk(G, seat) { return isInt(seat) && seat >= 0 && seat < G.max; }
  /* rows as {seat, score, extra, st, dec} or as an 'end' row [seat, score, extra, st, place] */
  function rowOf(r) {
    if (Array.isArray(r)) return { seat: r[0], score: r[1], extra: r[2], st: r[3], dec: 0 };
    return isObj(r) ? { seat: r.seat, score: r.score, extra: r.extra, st: r.st, dec: r.dec } : null;
  }
  function goalsOf(row) { return isInt(row.extra) && row.extra >= 0 && row.extra <= KICKS ? row.extra : null; }
  /* compared by score (Debut Run) or by goals, then decider goals (Shootout); higher is better */
  function cmp(game, a, b) {
    if (game === 'penalty') return a.extra !== b.extra ? b.extra - a.extra : b.dec - a.dec;
    return b.score - a.score;
  }
  /* The head-to-head list: new rows {seat, score, extra, st, dec, ok, place, shared, last, rank},
     the compared ones first, best first. ok: the row has a score the board would take and its
     device was heard to the end (st is not 'left'). Every compared row has a place when there
     are two or more (James, 24 Oct 2026: rank and compare); ties share it (1, 2, 2, 4: shared).
     last: on the bottom place of a list that is not all level (its rank has the kind words).
     rank: rank(place, last, shared), '' with no place. A row that is not ok has no place and
     is never compared; one compared row alone is 1 with no rank. A duplicate seat keeps its first row. */
  function standings(rows, game, variant) {
    var G = gameOf(game), seen = {}, good = [], rest = [];
    if (!G || !Array.isArray(rows)) return [];
    rows.forEach(function (r0) {
      var r = rowOf(r0);
      if (!r || !seatOk(G, r.seat) || seen[r.seat]) return;
      seen[r.seat] = true;
      var vOk = variant == null ? scoreOk(game)(r.score) : validScore(game, variant, r.score);
      var out = { seat: r.seat, score: isInt(r.score) ? r.score : null, extra: isInt(r.extra) ? r.extra : null,
        st: typeof r.st === 'string' ? r.st : '', dec: isInt(r.dec) && r.dec > 0 ? r.dec : 0, ok: false, place: null, shared: false, last: false, rank: '' };
      out.ok = vOk && out.st !== 'left' && (game !== 'penalty' || goalsOf(out) !== null);
      (out.ok ? good : rest).push(out);
    });
    good.sort(function (a, b) { return cmp(game, a, b) || a.seat - b.seat; });
    good.forEach(function (r, i) {
      var prev = i ? good[i - 1] : null;
      r.place = prev && cmp(game, prev, r) === 0 ? prev.place : i + 1;
    });
    if (good.length >= 2) {                      /* one row alone keeps its 1 but has no rank: nobody to compare with */
      var bottom = good[good.length - 1].place;
      good.forEach(function (r) {
        r.shared = good.filter(function (q) { return q.place === r.place; }).length > 1;
        r.last = bottom > 1 && r.place === bottom;
        r.rank = rank(r.place, r.last, r.shared);
      });
    }
    rest.sort(function (a, b) { return a.seat - b.seat; });
    return good.concat(rest);
  }
  /* a place as the results say it: '1st', 'Shared 2nd', '3rd — great effort!' (the last
     place), 'Shared 3rd — great effort!'; '' for no place */
  function rank(place, last, shared) {
    if (!isInt(place) || place < 1 || place > T.results.places.length) return '';
    var s = T.results.places[place - 1];
    if (shared) s = fill(T.results.rankShared, { place: s });
    return last ? fill(T.results.rankLast, { place: s }) : s;
  }
  function nameFor(names, seat) {
    var n = null;
    try { n = typeof names === 'function' ? names(seat) : isObj(names) || Array.isArray(names) ? names[seat] : null; } catch (e) { n = null; }
    return typeof n === 'string' && n ? n : 'Player ' + (seat + 1);
  }
  function goalsText(a, b) { return a + (a === 1 ? ' goal' : ' goals') + ' to ' + b; }
  /* The one head-to-head line for this device's child (meSeat). rows as standings takes them;
     names(seat) or names[seat] → the roster's shown name ('Player N' without one); info: the
     outcome of the round as duel-net's 'end' carries it ({top: [seats], why}; why 'tries' →
     both keepers did brilliantly). Returns {text, kind: 'top' | 'tie' | 'near' | 'good', place,
     last, rank}: good news, a shared top spot, a near miss or 'Great show' in text, and the
     child's place in the round beside it (rank: '1st', '2nd — great effort!'; never a place
     out of a count, never a forfeit). With nobody else to compare, just 'Great show!', no place.
     Shootout, goals level: the host's top spot (info.top) decides, not the decider goals this
     device happened to see (a reveal lost around a rejoin must not turn a top spot into a tie). */
  function line(meSeat, rows, game, names, info) {
    var st = standings(rows, game), me = null, ok = [], place = null, last = false, shared = false;
    function out(kind, text) { return { text: text, kind: kind, place: place, last: last, rank: rank(place, last, shared) }; }
    st.forEach(function (r) { if (r.seat === meSeat) me = r; if (r.ok) ok.push(r); });
    if (!me || !me.ok || ok.length < 2) return out('good', T.results.solo);
    var pen = game === 'penalty', R = T.results;
    var above = ok.filter(function (r) { return cmp(game, r, me) < 0; });
    var level = ok.filter(function (r) { return r !== me && cmp(game, r, me) === 0; });
    var other = ok.filter(function (r) { return r !== me; })[0];
    var top = pen && isObj(info) && Array.isArray(info.top) ? info.top : null;
    place = me.place; last = me.last; shared = me.shared;
    if (top && top.length && other && other.extra === me.extra) {
      if (top.length === 1) {
        place = top[0] === me.seat ? 1 : 2; last = place === 2; shared = false;
        return place === 1 ? out('top', R.topDeciders) : out('near', fill(R.otherDeciders, { name: nameFor(names, other.seat) }));
      }
      place = 1; last = false; shared = true;
      return out('tie', info.why === 'tries' ? R.bothKeepers : R.tie);
    }
    if (!above.length && level.length) return out('tie', pen && isObj(info) && info.why === 'tries' ? R.bothKeepers : R.tie);
    if (!above.length) {
      if (pen) return out('top', other.extra === me.extra ? R.topDeciders : fill(R.topGoals, { score: goalsText(me.extra, other.extra) }));
      if (ok.length === 2) return out('top', fill(R.topShow, { mine: commas(me.score), name: nameFor(names, other.seat), theirs: commas(other.score) }));
      return out('top', R.top);
    }
    /* the nearest place above: the lowest value that still beats this child's */
    var next = above[above.length - 1];
    if (pen) {
      var who = nameFor(names, next.seat);
      if (next.extra === me.extra) return out('near', fill(R.otherDeciders, { name: who }));
      if (next.extra - me.extra === 1) return out('near', fill(R.otherGoals, { name: who, score: goalsText(next.extra, me.extra) }));
      return out('good', R.good);
    }
    var gap = next.score - me.score;
    if (gap > 0 && gap <= next.score * NEAR_PART) {
      var near = fill(R.near, { gap: commas(gap) });
      return out('near', ok.length === 2 ? fill(R.other, { name: nameFor(names, next.seat) }) + ' ' + near : near);
    }
    return out('good', R.good);
  }

  /* ---------- the Shootout's deciders and team tries ---------- */
  /* One machine per challenge round, on the host. feed(k, seat, res) records seat 0's or 1's
     result of kick k (0–7 the round's 8 kicks, 8–12 decider kicks; the first report of a kick
     counts). next() says what happens now, moving on at most one step a call:
       'open'     regulation kick m.kick is next (both results of the kick before are in)
       'wait'     a result of kick m.kick has not arrived yet
       'decider'  level after 8 kicks, or both scored a decider: decider kick m.kick
       'retake'   both missed a decider: a team try is used, decider kick m.kick
       'end'      over: see outcome()
     Goals level after kick 8 → deciders (up to 5 kicks, retakes included: the round has 13 kick
     numbers, so a retake is the next one, with that kick's marker starts for both). One scores
     and the other does not → over. Both miss and no team try is left → a shared top spot, as
     when the 5 deciders run out. stop(why) ends it at once (a stall or a device gone): never
     a forfeit, a level or unfinished shoot-out has no top. Decider kicks never touch a score. */
  function shootout(opts) {
    var o = isObj(opts) ? opts : {};
    var maxDec = o.deciders === false ? 0 : isInt(o.deciders) ? Math.max(0, Math.min(DECIDERS, o.deciders)) : DECIDERS;
    var tries = isInt(o.tries) ? Math.max(0, Math.min(TEAM_TRIES, o.tries)) : TEAM_TRIES;
    var res = [[], []], k = -1, decN = 0, done = false, why = null;
    function both(i) { return !!res[0][i] && !!res[1][i]; }
    function goals(seat, from, to) {
      var n = 0;
      for (var i = from; i < to; i++) if (res[seat][i] === 'goal') n++;
      return n;
    }
    function end(w) { done = true; why = w; return 'end'; }
    var m = {
      feed: function (kick, seat, r) {
        if (done || !isInt(kick) || kick < 0 || (seat !== 0 && seat !== 1) || KICK_RES.indexOf(r) < 0) return false;
        if (kick >= KICKS && kick > k) return false;            /* a decider kick that has not been opened */
        if (kick >= KICKS + maxDec || res[seat][kick]) return false;
        res[seat][kick] = r;
        return true;
      },
      next: function () {
        if (done) return 'end';
        if (k < 0) { k = 0; return 'open'; }
        if (!both(k)) return 'wait';
        if (k < KICKS - 1) { k++; return 'open'; }
        if (k === KICKS - 1) {
          if (goals(0, 0, KICKS) !== goals(1, 0, KICKS)) return end('goals');
          if (!maxDec) return end('level');
          k++; decN = 1;
          return 'decider';
        }
        var a = res[0][k] === 'goal', b = res[1][k] === 'goal';
        if (a !== b) return end('deciders');
        if (!a && !tries) return end('tries');
        if (decN >= maxDec) return end('cap');
        k++; decN++;
        if (a) return 'decider';
        tries--;
        return 'retake';
      },
      stop: function (w) { if (!done) { done = true; why = typeof w === 'string' && w ? w : 'stop'; } },
      /* {done, why, complete, goals: [g0, g1], dec: [d0, d1], top: seat | null, shared, onDeciders}.
         complete: both children's 8 kicks are in. top and shared are decided only when complete */
      outcome: function () {
        var complete = true;
        for (var i = 0; i < KICKS; i++) if (!both(i)) complete = false;
        var g = [goals(0, 0, KICKS), goals(1, 0, KICKS)], d = [goals(0, KICKS, DIVE_KICKS), goals(1, KICKS, DIVE_KICKS)];
        var r = { done: done, why: why, complete: complete, goals: g, dec: d, top: null, shared: false, onDeciders: false };
        if (!done || !complete) return r;
        if (g[0] !== g[1]) r.top = g[0] > g[1] ? 0 : 1;
        else if (why === 'deciders') { r.top = d[0] > d[1] ? 0 : 1; r.onDeciders = true; }
        else r.shared = true;
        return r;
      },
      result: function (seat, kick) { return (seat === 0 || seat === 1) && isInt(kick) ? res[seat][kick] || null : null; }
    };
    Object.defineProperty(m, 'kick', { get: function () { return k; }, enumerable: true });
    Object.defineProperty(m, 'tries', { get: function () { return tries; }, enumerable: true });
    Object.defineProperty(m, 'deciders', { get: function () { return decN; }, enumerable: true });
    Object.defineProperty(m, 'done', { get: function () { return done; }, enumerable: true });
    return m;
  }
  /* The Debut Run team try: offered only when every show still heard ended in a curtain call
     before the arch (st 'bow') and a team try is left. Rows as standings takes them. */
  function debutTry(rows, tries) {
    if (!isInt(tries) || tries < 1 || !Array.isArray(rows)) return false;
    var heard = rows.map(rowOf).filter(function (r) { return r && r.st !== 'left'; });
    return heard.length > 0 && heard.every(function (r) { return r.st === 'bow'; });
  }
  /* is the 🎯 Timing rings bit set in a Debut Run result's extra? */
  function ringsOn(game, extra) { return game === 'course' && isInt(extra) && extra >= 0 && (extra & RINGS_BIT) !== 0; }

  /* ---------- boards: every mode of every game posts to its game's own board ---------- */
  /* leaderboards.gameModeMap (KU15): no new board, no rules change. A challenge round is an
     ordinary round (Shootout decider kicks never count); the figure that plays (the child's
     character or the classic hoodie) never changes a key. Kart challenges are Race together
     rooms with a word (kart-lobby). */
  var MODES = {
    course: ['solo', 'rings', 'ringsTry', 'challenge', 'character', 'hoodie'],
    penalty: ['solo', 'challenge', 'character', 'hoodie'],
    kart: ['race', 'solo', 'easyDrive', 'together', 'challenge', 'character', 'hoodie']
  };
  var KART_VARIANTS = ['track_loop_remix', 'track_volcano_remix', 'track_beach_remix', 'track_star', 'track_loop', 'track_volcano', 'track_beach'];
  var BOARD_MAP = [];
  ['course', 'penalty', 'kart'].forEach(function (g) {
    var vs = g === 'kart' ? KART_VARIANTS : GAMES[g].variants;
    MODES[g].forEach(function (mode) {
      vs.forEach(function (v) { BOARD_MAP.push(Object.freeze({ game: g, mode: mode, variant: v, key: g + ':' + v })); });
    });
  });
  /* the board a round posts to, or null for a game, mode or variant that has none */
  function boardKey(game, mode, variant) {
    for (var i = 0; i < BOARD_MAP.length; i++) {
      var r = BOARD_MAP[i];
      if (r.game === game && r.mode === mode && r.variant === variant) return r.key;
    }
    return null;
  }

  /* ---------- freeze and export ---------- */
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }
  [T, GAMES, LIMITS, EXTRA_MAX, MODES].forEach(deepFreeze);
  [WORDS, OLD_WORDS, GAME_IDS, ROOM_KINDS, RESERVED_KINDS, SHOW_ST, ROW_ST, SEAT_ST, ROOM_ST, INFO_ST, KICK_RES, KART_VARIANTS, BOARD_MAP].forEach(Object.freeze);

  var API = {
    PROTO: PROTO, GAMES: GAMES, GAME_IDS: GAME_IDS, WORDS: WORDS, OLD_WORDS: OLD_WORDS, T: T, LIMITS: LIMITS, EXTRA_MAX: EXTRA_MAX,
    MAX_CHARS: MAX_CHARS, TEAM_TRIES: TEAM_TRIES, KICKS: KICKS, DECIDERS: DECIDERS, DIVE_KICKS: DIVE_KICKS, NEAR_PART: NEAR_PART,
    RINGS_BIT: RINGS_BIT, ROOM_KINDS: ROOM_KINDS, RESERVED_KINDS: RESERVED_KINDS,
    SHOW_ST: SHOW_ST, ROW_ST: ROW_ST, SEAT_ST: SEAT_ST, ROOM_ST: ROOM_ST, INFO_ST: INFO_ST, KICK_RES: KICK_RES,
    MODES: MODES, BOARD_MAP: BOARD_MAP,
    fill: fill, isWord: isWord, word: word, spell: spell, newWord: newWord, newSeed: newSeed, isKind: isKind,
    roomText: roomText, roomId: roomId, eligibility: eligibility, parse: parse, check: check,
    validScore: validScore, standings: standings, rank: rank, line: line, shootout: shootout, debutTry: debutTry, ringsOn: ringsOn,
    boardKey: boardKey
  };
  Object.freeze(API);
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLDuelCore = API;
})();
