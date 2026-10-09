/* ================================================================
   Games together — the grown-up's side (control.html only). Classic
   UMD: window.SLControlSocial in the browser, loaded after
   world-core.js, social-core.js and boards-core.js; module.exports
   in Node.

   The '🎮 Game boards and racing together' card of the Control
   Centre: which accounts of a family may appear to its other
   children, under which name, on a board and in a shared race, and
   which class a child's own grown-up has asked for. The '🏫 Classes
   you run' card: a class for children from different families, run
   by a grown-up approved by hand. A child's device never writes any
   of it. Nothing here changes a child's balance or their island.

     builders (pure: no DOM, no storage, no network, no clock) return steps: an array of
     batches, each an array of writes {kind: 'set' | 'update' | 'delete', path: [segments],
     data, merge, at: true, fields: [{path: [segments], value | del: true | inc: n | at: true}]}
       saveFamily(code, freshFamilyDoc, change, accounts, plain, nowMs, random)
                                 → {steps, games, roster, refused, clashes, unticked, left}
       untick(code, uid, kidsDoc)       the family card, the class card, request and entry, cls and lt
       removeEntry(scope, uid, key)     one batch: the entry off the card, its count raised by 1
       deleteFamilyBoard(code, uids), newRaceKey(scope, nowMs, random)
       scope is {family: 'LION78'} or {cls: 'OTTERTIGER4821'}
       joinClass(code, uid, classCode, {n, ai, ci}, random)   one batch: the request, and in the
                                        kids record the class code with a fresh online-count tag
       leaveClass(code, uid, classCode) one batch: the class card, the request and the entry, cls and lt
                                        (classCode '' = the request is already gone: only cls and lt)
       classCreate(id, ownerUid, name, nowMs, random)   two steps: the class record, then its
                                        typed name and an empty roster (id '' draws a code)
       classAdd(id, uid, request, roster, nowMs)        the child's entry, and the roster with the
                                        name copied from the request
       classRemove(id, uid, roster, nowMs, random)      the entry, the card and the request go; the
                                        roster without the child; a new race key
       classSwitch(id, {on, race}, nowMs, random)       the two switches; races on = a new key
       classClose(id, memberUids, requestUids, liveTags)   every document under the class, then
                                        on false, race false, closed true

     wiring
       applyOps(fdb, firebase, steps)   each step is one WriteBatch; fields become FieldPath
                                        objects, del / inc / at the FieldValue sentinels
       probe(firebase, config, username, uid) → 'opens' | 'own' | 'unknown'
       setPassword(firebase, config, username, newPassword, uid)
                                        both on a second Firebase app ('slProbe', persistence
                                        NONE): the grown-up's own session is never touched.
                                        uid (optional): the account the sign-in must land on

     the cards
       mountFamily(el, deps) → {ready, idle(), update(accounts)}
       mountClasses(el, deps) → {ready, idle()}    drawn only for an admin or an account listed
                                        in classHosts, and never under the automatic password
       isClassHost(fdb, uid) → Promise<boolean>   one read of classHosts/{uid}; any failure is false
       deps = {fdb, firebase, auth, config, code, family, accounts, usedDerived, isAdmin,
               esc, now, random, confirm, refresh}

   Everything read from Firestore is data from a stranger: it is cleaned by social-core and
   boards-core and reaches the page as text (textContent), never as markup. In the games card
   a class code is read into memory and shown only as its label ('Otter class'); the code
   itself is shown to the grown-up who runs that class and to nobody else. An online-count
   tag is made, written and cleared, and never shown: neither card says who is online in a
   class, or how many. The name typed for a class is shown only in the classes card.
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLControlSocial) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLControlSocial;
    return;
  }
  var SC0 = null, BC0 = null, WC0 = null;
  if (typeof module === 'object' && module.exports) {
    try { SC0 = require('./social-core.js'); BC0 = require('./boards-core.js'); WC0 = require('../world-core.js'); } catch (e) { SC0 = null; }
  }
  var WIN = typeof window !== 'undefined' ? window : {};
  /* looked up at each call, so the order the script tags finish in does not matter */
  function social() { return SC0 || WIN.SLSocialCore || null; }
  function boardsCore() { return BC0 || WIN.SLBoardsCore || null; }
  /* the word check: with no social-core or no island rules, every name is 'Player' */
  function rudeCheck() { var S = social(); return S ? S.rudeFrom(WC0 || WIN.SLWorldCore || null) : function () { return true; }; }

  var V = 1;
  var EMAIL_DOMAIN = '@summer-lab.kids', AUTO_TAIL = '.summerlab';   /* as the app signs in (a test compares) */
  var PROBE_APP = 'slProbe';
  /* the answers that mean 'the automatic password no longer opens this account' */
  var OWN_CODES = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'];
  var KEY_MAX_MS = 30 * 86400000;        /* a race key older than this is replaced when the card opens */
  var BATCH_MAX = 400;
  var UID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, FAM_RE = /^[A-Z0-9]{4,12}$/, LOGIN_RE = /^[a-z0-9_]{1,40}$/;

  var TITLE = '🎮 Game boards and racing together';
  var PARENT_TEXT = Object.freeze([
    'What other children see: a first name, the avatar picture, the profile colour, game times and scores, and in a race where each kart is on the track.',
    'The name shown is the letters at the start of the username, 12 at most. Check the Shown as text beside each child; if it contains a surname, choose Player. A child cannot change the name others see.',
    'What they never see: age, email, messages, photos, location, how long anyone has played, how much game time anyone has left, points or learning progress. There is no chat and nowhere to type a message.',
    'Who sees it: only the accounts you tick. An account is only as private as its password: unless you set one, a child\'s account opens with just its username, and someone who knows that username could sign in and see what your child sees. That is why a child can be ticked only after you set a password for them here.',
    'In Race together the other children can see that your child is playing at that moment.',
    'Each child you tick sees two numbers at the top of the app: how many of your family are online and, if they are in a class, how many of that class are online. Numbers only, never names. You see who in your own family is online here in the Control Centre; the person who runs a class is not shown who is online.',
    'The class number is counted from a time-stamp kept under a random tag, so nobody can tell from it which child is online. Inside your own family, a child with technical know-how could find out which brother or sister is online and which part of the app they have open; the app itself shows only the number.',
    'A class is run by whoever created it. The person who runs this app approves each class runner by hand, but the app itself cannot check that anyone is a teacher or an adult. Only join a class whose code came from someone you know. That person sees your child\'s first name, picture, colour, scores and your family code. You can take your child out here at any time.',
    'Devices are linked through a free public link-up server (PeerJS) and, when needed, relay servers run by other companies. They see each device\'s network address. They do not see names, and race data is encrypted between the devices.',
    'In a family race the devices link directly, so each device learns the network address of the others, in both directions. If any of these devices are in another home, switch on \'Some of these devices are in other homes\' and everything goes through a relay instead; that can be slower. Class races always use the relay.',
    'Your daily game-time limit applies to each child on their own device, in shared races too. The limit is kept on each device and counts per device.',
    'Boards are kept in the app\'s existing Google Firebase database. Races are not kept anywhere. No new service is used. There is no advertising and no tracking. The person who runs this app can see everything kept in its database.',
    'Scores are not proof. They are worked out on each child\'s own device. The app throws away impossible ones and you can remove any entry here, but a determined child with technical know-how could post a made-up one.',
    'The \'Off\' setting is remembered in each device\'s browser storage so it still applies when signed out. Browser storage is not secure: a child who clears or edits it can bring the on-this-device board back.',
    'Your own account is the key to these switches. It must have a real password, and so must each child you tick. If you are ever worried about who can join a race, press New race key.'
  ]);
  var DERIVED_LINE = 'Game boards and racing together are set up here once your own account has a real password. At the moment it opens ' +
    'with just its username, so a child could open this page. Set one with 🔑 Set password in the game’s account box, then sign in here with it.';
  var RULES_NOTE = 'One more step: publish the updated security rules (firestore.rules) in the Firebase console.';
  /* chunk RV1: what a grown-up who is not an admin is told while the rules refuse the card (not
     published yet, or switched off with the off file): nothing they can do, and nothing is lost */
  var OFF_NOTE = 'Game boards and racing together are switched off for everyone just now. Your settings here are kept and come back when they are switched on again.';
  var NEW_NOTE = 'new: tick only if this is your child';
  /* chunk RV1b: the tick also decides the class (unticking takes the child out of it); the
     plan's own words while classes are switched off */
  var TICK_LABEL = 'May appear to the other children here (family board, family races and their class)';
  var TICK_LABEL_NO_CLASS = 'May appear to the other children here (family board and family races)';
  var WATCH_NOTE = 'faster than our best test driver: worth a look';
  var PW_LINE = { wait: 'checking the password…', opens: 'opens with just its username', own: 'has its own password ✓', unknown: 'couldn’t check just now' };
  var PW_RULE = 'A password needs 8 characters or more and must not contain the username.';
  /* a class the grown-up joined keeps its board under 'This device only', so that mode does not keep every score at home */
  var MODES_HELP = 'Off: no game boards on any device that has picked this up. This device only: children who share a tablet see each ' +
    'other’s bests on it, and family scores stay on each device. A child you have added to a class still shares their game scores with that class. ' +
    'Family board: the children you tick see each other’s first name, picture, colour and game scores.';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* classes. The two limits are kept by this page only: the rules do not count. */
  var MAX_CLASSES = 5, MAX_KIDS = 35;
  var KIDS_PER_BATCH = 8;                /* children per batch when their class documents are deleted (see classClose) */
  var CLASS_NAME_RE = /^[A-Za-z](?:[A-Za-z ]{0,22}[A-Za-z])?$/;      /* 1 to 24 letters and spaces */
  var CLASSES_TITLE = '🏫 Classes you run';
  var CLASS_TEXT = Object.freeze([
    'A class is for children from different families. Give its code to each child’s own grown-up: they type it into their own Control Centre, ' +
      'the child then waits below, and you add them. Children type nothing, and they see the class only as its label, never the name you give it.',
    'A class race always goes through a relay, so no home learns another home\'s network address. Up to 3 races of 5 can run at once.',
    'Children in this class see how many of the class are online: a number, never names. It shows only while the class board or class races are on. You are not shown who is online.'
  ]);
  var WAIT_LINE = 'Only add a child when their grown-up has given you their family code themselves.';
  var NAME_HELP = 'A name for your own list: letters and spaces, 24 at most. It is never shown to children or other parents and cannot be changed later. ' +
    'You can run ' + MAX_CLASSES + ' classes at most, each with up to ' + MAX_KIDS + ' children.';
  var JOIN_FAIL = 'That code didn\'t work, or the class is closed. Check it with the person who gave it to you.';
  var REFUSED = 'That was refused. Press ↻ Refresh and try again; if it still is, the updated rules (firestore.rules) may not be published yet.';

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isUid(s) { return typeof s === 'string' && UID_RE.test(s); }
  function bad(what) { throw new Error('SLControlSocial: ' + what); }
  function lower(username) {
    var low = typeof username === 'string' ? username.trim().toLowerCase() : '';
    return LOGIN_RE.test(low) ? low : '';
  }

  /* ---------- builders ---------- */
  /* where a group's documents live */
  function base(scope) {
    var S = social(), s = isObj(scope) ? scope : {};
    if (typeof s.family === 'string' && FAM_RE.test(s.family)) return ['families', s.family];
    if (typeof s.cls === 'string' && S && S.CLASS_RE.test(s.cls)) return ['classes', s.cls];
    return bad('not a family or a class');
  }
  function keyWrite(scope, nowMs, random) {
    return { kind: 'set', path: base(scope).concat(['private', 'games']), data: { v: V, raceKey: social().newKey(random), setAt: nowMs } };
  }
  /* a fresh race key: rooms made from the old one can no longer be found */
  function newRaceKey(scope, nowMs, random) { return [[keyWrite(scope, nowMs, random)]]; }
  /* One batch, all or nothing: the child's family card goes; with a class code in the kids
     record (as just read) the class card, the request the grown-up filed and the class
     grown-up's entry for the child go with it (the rules allow the entry while the request is
     there, in the same batch), and that code and the online-count tag are cleared. The
     removal counts in the kids record are left alone. */
  function untick(code, uid, kidsDoc) {
    var S = social(), fam = base({ family: code }), kd = isObj(kidsDoc) ? kidsDoc : null;
    if (!isUid(uid)) return bad('not an account id');
    var ops = [{ kind: 'delete', path: fam.concat(['boards', uid]) }];
    if (kd && typeof kd.cls === 'string' && S.CLASS_RE.test(kd.cls)) ops = ops.concat(classSide(kd.cls, uid));
    if (kd) ops.push(clearKid(fam, uid));
    return [ops];
  }
  /* what a family's grown-up deletes in a class when their child leaves it: the card, the request and the entry */
  function classSide(classCode, uid) {
    var at = base({ cls: classCode });
    return [{ kind: 'delete', path: at.concat(['boards', uid]) }, { kind: 'delete', path: at.concat(['requests', uid]) }, { kind: 'delete', path: at.concat(['members', uid]) }];
  }
  /* the class code and the online-count tag leave a child's kids record together */
  function clearKid(fam, uid) {
    return { kind: 'set', path: fam.concat(['kids', uid]), data: { cls: '' }, merge: true, fields: [{ path: ['lt'], del: true }] };
  }
  function deleteFamilyBoard(code, uids) {
    var fam = base({ family: code }), steps = [], seen = {};
    (Array.isArray(uids) ? uids : []).forEach(function (uid) {
      if (!isUid(uid) || has(seen, uid)) return;
      seen[uid] = true;
      if (!steps.length || steps[steps.length - 1].length >= BATCH_MAX) steps.push([]);
      steps[steps.length - 1].push({ kind: 'delete', path: fam.concat(['boards', uid]) });
    });
    return steps;
  }
  /* One batch: the entry leaves the card (best ever and this week) and its count goes up by
     one where only that child and the grown-up can read it, so the child's device never
     posts the removed value again. The count is only ever raised, never written. */
  function removeEntry(scope, uid, key) {
    var B = boardsCore(), at = base(scope);
    if (!isUid(uid) || !B || !B.rule(key)) return bad('not an entry');
    var card = { kind: 'update', path: at.concat(['boards', uid]), fields: [{ path: ['best', key], del: true }, { path: ['wk', 'v', key], del: true }] };
    var count = at[0] === 'families'
      ? { kind: 'set', path: at.concat(['kids', uid]), data: { v: V }, merge: true, fields: [{ path: ['rm', key], inc: 1 }] }
      : { kind: 'update', path: at.concat(['members', uid]), fields: [{ path: ['rm', key], inc: 1 }] };
    return [[card, count]];
  }
  /* Chunk RV1b: any session can fetch a family record by its code, so the games field keeps
     only the account ids the rules and the children's devices read: the ticked accounts
     (members and pw true) and the hidden ones. Every other key (an untick's false, the pw of
     an account that is not ticked, a hide undone) is taken out of games and, when the
     record as read holds it, deleted by the same write. → the deletes, as fields */
  function prune(games, stored) {
    var S = social(), gone = [], st0 = isObj(stored) ? stored : {};
    ['members', 'pw', 'hide'].forEach(function (k) {
      var keep = {}, had = isObj(st0[k]) ? st0[k] : {};
      Object.keys(games[k]).forEach(function (uid) {
        if (k === 'hide' ? games.hide[uid] === true : S.memberOk(games, uid)) keep[uid] = true;
      });
      Object.keys(had).forEach(function (uid) { if (isUid(uid) && !has(keep, uid)) gone.push({ path: ['games', k, uid], del: true }); });
      games[k] = keep;
    });
    return gone;
  }
  /* A Save of the card, from the family record as just read plus the changes on screen
     (change as SLSocialCore.gamesPatch takes it, and change.kids = {uid: the kids record
     of an account that stops being ticked}). accounts = the family's users records;
     plain = {uid: true} for 'Show as Player'.
       steps      first the games field (merged; ownerUsername and, chunk RV1b, every account
                  id it no longer needs deleted: see prune), the whole roster and
                  a new race key in one batch; then untick() for every account that stops
                  being ticked (or is listed in change.kids and is not ticked); then every
                  card when the family leaves Family board mode. Empty while names clash.
       unticked   the accounts that stop being ticked: read their kids records, call again
       left       ticked accounts that are no longer among the family's accounts: unticked */
  function saveFamily(code, freshFamilyDoc, change, accounts, plain, nowMs, random) {
    var S = social(), fam = base({ family: code }), c = isObj(change) ? change : {};
    var fresh = { games: isObj(freshFamilyDoc) && isObj(freshFamilyDoc.games) ? freshFamilyDoc.games : {} };
    var list = (Array.isArray(accounts) ? accounts : []).filter(isObj), known = {}, tick = {}, left = [];
    list.forEach(function (a) { var uid = isUid(a.uid) ? a.uid : a._uid; if (isUid(uid)) known[uid] = true; });
    var was = S.gamesCfg(fresh);
    /* only one of the family's own accounts can be ticked */
    if (isObj(c.tick)) Object.keys(c.tick).forEach(function (uid) { tick[uid] = c.tick[uid] === true ? has(known, uid) : c.tick[uid]; });
    Object.keys(was.members).forEach(function (uid) {
      if (was.members[uid] === true && !has(known, uid)) { tick[uid] = false; left.push(uid); }
    });
    var p = S.gamesPatch(fresh, { boards: c.boards, race: c.race, relay: c.relay, order: c.order, tick: tick, pw: c.pw, hide: c.hide }, nowMs);
    var r = S.rosterDoc(p.games, list, plain, rudeCheck()), kids = isObj(c.kids) ? c.kids : {};
    var out = { steps: [], games: p.games, roster: r.roster, refused: p.refused, clashes: r.clashes, unticked: [], left: left };
    Object.keys(p.games.members).concat(Object.keys(kids)).forEach(function (uid) {
      if (!isUid(uid) || out.unticked.indexOf(uid) >= 0 || S.memberOk(p.games, uid)) return;
      if (was.members[uid] === true || has(kids, uid)) out.unticked.push(uid);
    });
    var gone = prune(p.games, fresh.games);
    if (r.clashes.length) return out;
    out.steps.push([
      { kind: 'set', path: fam, data: { games: p.games }, merge: true, fields: [{ path: ['ownerUsername'], del: true }].concat(gone) },
      { kind: 'set', path: fam.concat(['private', 'roster']), data: r.roster },
      keyWrite({ family: code }, nowMs, random)
    ]);
    out.unticked.forEach(function (uid) { out.steps = out.steps.concat(untick(code, uid, kids[uid])); });
    if (was.boards === 'family' && p.games.boards !== 'family') {
      out.steps = out.steps.concat(deleteFamilyBoard(code, Object.keys(known).concat(Object.keys(was.members))));
    }
    return out;
  }

  /* ---------- builders: classes ---------- */
  function isWhole(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0; }
  function classNameOk(name) { return typeof name === 'string' && CLASS_NAME_RE.test(name); }
  function listOf(x) { return Array.isArray(x) ? x : []; }
  function index(n, list) { return isWhole(n) && n < list.length ? n : 0; }
  /* a roster as read, kept to what a roster may hold: account ids, each with a cleaned name */
  function cleanWho(roster) {
    var S = social(), rude = rudeCheck(), out = {}, w = isObj(roster) && isObj(roster.who) ? roster.who : {};
    Object.keys(w).forEach(function (uid) { if (isUid(uid) && isObj(w[uid])) out[uid] = { n: S.cleanName(w[uid].n, 'Player', rude) }; });
    return out;
  }
  /* One batch, filed by the child's OWN grown-up from the family card: the request (the name
     on the family roster, avatar and colour as index numbers, the family code, the server's
     time) and, in the child's kids record, the class code with a fresh online-count tag. The
     tag is written there and nowhere else. The rules refuse the batch unless that grown-up
     owns the family, ticks the child, and the class is open. */
  function joinClass(code, uid, classCode, request, random) {
    var S = social(), fam = base({ family: code }), at = base({ cls: classCode }), r = isObj(request) ? request : {};
    if (!isUid(uid) || typeof r.n !== 'string' || !S.NAME_RE.test(r.n)) return bad('not a request');
    return [[
      { kind: 'set', path: at.concat(['requests', uid]), data: { n: r.n, ai: index(r.ai, S.AVATARS), ci: index(r.ci, S.COLORS), fam: code }, at: true },
      { kind: 'set', path: fam.concat(['kids', uid]), data: { v: V, cls: classCode, lt: S.newNonce(random) }, merge: true }
    ]];
  }
  /* One batch: the child's class card, the request and the class grown-up's entry go, and the
     kids record gives up the code and the tag. The rules let a family's grown-up delete the
     card and the entry only while the request is still there, so with the request already
     gone (classCode '') only the kids record is written. */
  function leaveClass(code, uid, classCode) {
    var fam = base({ family: code }), ops = [];
    if (!isUid(uid)) return bad('not an account id');
    if (classCode !== '' && classCode != null) ops = classSide(classCode, uid);
    ops.push(clearKid(fam, uid));
    return [ops];
  }
  /* Two steps, because the rules can only see the class record once it exists: first the
     record (board and races off, open), then the typed name where only its owner can read it
     and an empty roster. No race key yet: switching races on makes one. With id '' the code
     is drawn here (steps[0][0].path[1]). */
  function classCreate(id, ownerUid, name, nowMs, random) {
    var at = base({ cls: id === '' || id == null ? social().classCode(random) : id });
    if (!isUid(ownerUid) || !classNameOk(name) || !isWhole(nowMs)) return bad('not a class');
    return [
      [{ kind: 'set', path: at, data: { v: V, ownerUid: ownerUid, createdAt: nowMs, on: false, race: false, closed: false } }],
      [{ kind: 'set', path: at.concat(['private', 'admin']), data: { v: V, name: name } },
        { kind: 'set', path: at.concat(['private', 'roster']), data: { v: V, who: {} } }]
    ];
  }
  /* One batch: the child's entry (removal counts it already holds are kept) and the whole
     roster, with the name copied from the request the child's own grown-up filed. The class
     grown-up never types a name. */
  function classAdd(id, uid, request, roster, nowMs) {
    var S = social(), at = base({ cls: id }), who = cleanWho(roster);
    if (!isUid(uid) || !isObj(request) || !isWhole(nowMs)) return bad('not a request');
    who[uid] = { n: S.cleanName(request.n, 'Player', rudeCheck()) };
    return [[
      { kind: 'set', path: at.concat(['members', uid]), data: { v: V, at: nowMs }, merge: true },
      { kind: 'set', path: at.concat(['private', 'roster']), data: { v: V, who: who } }
    ]];
  }
  /* one batch: these children's entries and cards go (and their requests, when asked), the
     roster is written without them, and races get a new key */
  function removeSteps(id, uids, roster, nowMs, random, requestsToo) {
    var at = base({ cls: id }), who = cleanWho(roster), ops = [];
    uids.forEach(function (uid) {
      if (!isUid(uid)) return bad('not an account id');
      delete who[uid];
      ops.push({ kind: 'delete', path: at.concat(['members', uid]) }, { kind: 'delete', path: at.concat(['boards', uid]) });
      if (requestsToo) ops.push({ kind: 'delete', path: at.concat(['requests', uid]) });
    });
    ops.push({ kind: 'set', path: at.concat(['private', 'roster']), data: { v: V, who: who } }, keyWrite({ cls: id }, nowMs, random));
    return [ops];
  }
  function classRemove(id, uid, roster, nowMs, random) { return removeSteps(id, [uid], roster, nowMs, random, true); }
  /* the class board and class races, on or off; switching races on brings a new key */
  function classSwitch(id, change, nowMs, random) {
    var at = base({ cls: id }), c = isObj(change) ? change : {}, data = {};
    if (typeof c.on === 'boolean') data.on = c.on;
    if (typeof c.race === 'boolean') data.race = c.race;
    if (!Object.keys(data).length) return [];
    return [[{ kind: 'update', path: at, data: data }].concat(data.race === true ? [keyWrite({ cls: id }, nowMs, random)] : [])];
  }
  /* Closing a class: every card, request, entry and lobby ticket of the children listed,
     every heartbeat (the caller lists classes/{id}/live first, and sees only tags and times),
     the typed name, the roster and the key, in batches; then, last, board off, races off,
     closed. The class record itself stays, so its code can never be used again. Every step
     can be run again: a close that was interrupted is finished by pressing Close once more.
     A batch may make the rules look up 20 documents at most, and a card's delete rule can
     look up that child's request and family: so a batch holds KIDS_PER_BATCH children. */
  function classClose(id, memberUids, requestUids, liveTags) {
    var at = base({ cls: id }), steps = [], kids = [], rest = [], seen = {}, i = 0;
    function del(tail) { return { kind: 'delete', path: at.concat(tail) }; }
    listOf(memberUids).concat(listOf(requestUids)).forEach(function (uid) { if (isUid(uid) && !has(seen, uid)) { seen[uid] = true; kids.push(uid); } });
    for (i = 0; i < kids.length; i += KIDS_PER_BATCH) {
      steps.push([]);
      kids.slice(i, i + KIDS_PER_BATCH).forEach(function (uid) {
        ['boards', 'requests', 'members', 'lobby'].forEach(function (name) { steps[steps.length - 1].push(del([name, uid])); });
      });
    }
    seen = {};
    listOf(liveTags).forEach(function (tag) { if (isUid(tag) && !has(seen, tag)) { seen[tag] = true; rest.push(del(['live', tag])); } });
    ['admin', 'roster', 'games'].forEach(function (doc) { rest.push(del(['private', doc])); });
    for (i = 0; i < rest.length; i += BATCH_MAX) steps.push(rest.slice(i, i + BATCH_MAX));
    steps.push([{ kind: 'update', path: at, data: { on: false, race: false, closed: true } }]);
    return steps;
  }

  /* ---------- wiring ---------- */
  function sentinel(FS, f) {
    if (f.del === true) return FS.FieldValue.delete();
    if (typeof f.inc === 'number') return FS.FieldValue.increment(f.inc);
    if (f.at === true) return FS.FieldValue.serverTimestamp();
    return f.value;
  }
  /* never a dotted text path: a board key holds a ':' and an account id can start with a digit */
  function fieldPath(FS, p) {
    if (p.length === 1) return new FS.FieldPath(p[0]);
    if (p.length === 2) return new FS.FieldPath(p[0], p[1]);
    return p.length === 3 ? new FS.FieldPath(p[0], p[1], p[2]) : bad('not a field path');
  }
  function addWrite(fdb, FS, batch, w) {
    if (!isObj(w) || !Array.isArray(w.path) || w.path.length % 2 || !w.path.every(function (s) { return typeof s === 'string' && !!s && s.indexOf('/') < 0; })) return bad('not a document path');
    var ref = fdb.doc(w.path.join('/')), fields = Array.isArray(w.fields) ? w.fields : [];
    if (w.kind === 'delete') { batch.delete(ref); return; }
    var data = JSON.parse(JSON.stringify(isObj(w.data) ? w.data : {}));
    if (w.kind === 'set') {
      /* a nested object with merge reaches any key, a ':' or a leading digit included */
      fields.forEach(function (f) {
        var m = data;
        f.path.slice(0, -1).forEach(function (s) { if (!isObj(m[s])) m[s] = {}; m = m[s]; });
        m[f.path[f.path.length - 1]] = sentinel(FS, f);
      });
      if (w.at === true) data.at = FS.FieldValue.serverTimestamp();
      if (w.merge === true) batch.set(ref, data, { merge: true }); else batch.set(ref, data);
      return;
    }
    if (w.kind !== 'update') return bad('not a write');
    var args = [ref];
    Object.keys(data).forEach(function (k) { args.push(fieldPath(FS, [k]), data[k]); });
    fields.forEach(function (f) { args.push(fieldPath(FS, f.path), sentinel(FS, f)); });
    batch.update.apply(batch, args);
  }
  /* run steps in order, each as one WriteBatch; the first refusal stops the rest */
  function applyOps(fdb, firebase, steps) {
    var chain = Promise.resolve();
    (Array.isArray(steps) ? steps : []).forEach(function (ops) {
      chain = chain.then(function () {
        if (!Array.isArray(ops) || !ops.length) return null;
        var batch = fdb.batch();
        ops.forEach(function (w) { addWrite(fdb, firebase.firestore, batch, w); });
        return batch.commit();
      });
    });
    return chain;
  }
  /* applyOps for the steps a family's grown-up sends about their own child (Take out, untick).
     Only the rules published with G0.2d let that grown-up delete the child's class entry: a
     batch they refuse with such a delete in it is sent once more without it, so under older
     rules the card and the request still go and the entry stays the class grown-up's to tidy
     (their card drops it when it next opens), as before, and no Save is left unable to finish */
  function isEntry(w) { return isObj(w) && w.kind === 'delete' && Array.isArray(w.path) && w.path[0] === 'classes' && w.path[2] === 'members'; }
  function applyFamily(fdb, firebase, steps) {
    return (Array.isArray(steps) ? steps : []).reduce(function (chain, ops) {
      return chain.then(function () {
        return applyOps(fdb, firebase, [ops]).then(null, function (e) {
          var less = ops.filter(function (w) { return !isEntry(w); });      /* a step that failed is an array of writes */
          if (!e || e.code !== 'permission-denied' || less.length === ops.length) throw e;
          return applyOps(fdb, firebase, [less]);
        });
      });
    }, Promise.resolve());
  }

  /* the second app: its own sign-in state, kept nowhere, one job at a time */
  var probing = Promise.resolve();
  function onProbeApp(firebase, config, job) {
    var run = probing.then(function () {
      var app = null;
      try { app = firebase.app(PROBE_APP); } catch (e) { app = null; }
      if (!app) app = firebase.initializeApp(config, PROBE_APP);
      var a = app.auth();
      return a.setPersistence(firebase.auth.Auth.Persistence.NONE).then(function () { return job(a); });
    });
    probing = run.then(null, function () { return null; });
    return run;
  }
  function autoSignIn(a, low) { return a.signInWithEmailAndPassword(low + EMAIL_DOMAIN, low + AUTO_TAIL); }
  function signOut(a) { return a.signOut().then(null, function () { return null; }); }
  /* does this account still open with just its username? 'opens' when the automatic
     password signs in (signed out again at once), 'own' when it is refused as wrong,
     'unknown' for anything else (too many attempts, no network): that changes nothing */
  /* A username comes from a users record, which the account itself can edit. With uid
     given, a sign-in that lands on any other account counts for nothing. */
  function sameAccount(cred, uid) { return uid === undefined || (!!cred && !!cred.user && cred.user.uid === uid); }
  function probe(firebase, config, username, uid) {
    var low = lower(username);
    if (!low) return Promise.resolve('unknown');
    return onProbeApp(firebase, config, function (a) {
      return autoSignIn(a, low).then(function (cred) {
        return signOut(a).then(function () { return sameAccount(cred, uid) ? 'opens' : 'unknown'; });
      }, function (e) { return OWN_CODES.indexOf(e && e.code) >= 0 ? 'own' : 'unknown'; });
    }).then(null, function () { return 'unknown'; });
  }
  /* give an account that still opens with its username a password the grown-up typed.
     The password goes to Firebase sign-in and nowhere else. */
  function setPassword(firebase, config, username, newPassword, uid) {
    var S = social(), low = lower(username);
    if (!S || !low || !S.passwordOk(newPassword, low)) return Promise.reject(new Error('SLControlSocial: that password is not allowed'));
    return onProbeApp(firebase, config, function (a) {
      return autoSignIn(a, low).then(function (cred) {
        var job = sameAccount(cred, uid) ? cred.user.updatePassword(newPassword) : Promise.reject(new Error('SLControlSocial: not that account'));
        return job.then(function () { return signOut(a); }, function (e) {
          return signOut(a).then(function () { throw e; });
        });
      });
    });
  }

  /* ---------- the card ---------- */
  function add(parent, tag, text, cls) {
    var n = parent.ownerDocument.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    parent.appendChild(n);
    return n;
  }
  function button(parent, label, cls, fn) {
    var b = add(parent, 'button', label, cls);
    b.setAttribute('type', 'button');
    b.addEventListener('click', fn);
    return b;
  }
  function input(parent, type) { var i = add(parent, 'input'); i.setAttribute('type', type); return i; }
  function warn(parent, text) { var p = add(parent, 'p', text); p.setAttribute('style', 'color:#c0392b;font-weight:700;margin:6px 0;'); return p; }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function niceDay(day) { return String(+day.slice(8)) + ' ' + (MONTHS[+day.slice(5, 7) - 1] || ''); }
  function refusedIsNo(e) { if (e && e.code === 'permission-denied') return false; throw e; }

  /* ----- a group's boards, drawn the same way in both cards ----- */
  function removeText(r, row) {
    var kart = r.game === 'kart';
    return 'Remove ' + row.n + '’s ' + r.name + (kart ? ' time (' : ' score (') + boardsCore().fmtValue(r.key, row.v) + ') from the board? Their next finished ' +
      (kart ? 'race' : 'round') + ' will count again. Their own personal best on their device is not changed.';
  }
  function removedText(r) { return 'Removed. It stays removed; their next finished ' + (r.game === 'kart' ? 'race' : 'round') + ' counts again.'; }
  /* the entry leaves the copy of the cards this page holds */
  function dropEntry(cards, uid, key) {
    cards.forEach(function (c) {
      if (c.uid !== uid || !isObj(c.card)) return;
      if (isObj(c.card.best)) delete c.card.best[key];
      if (isObj(c.card.wk) && isObj(c.card.wk.v)) delete c.card.wk.v[key];
    });
  }
  /* Every board with an entry, as the children see it: names from the roster through
     standings() and from nowhere else, ✕ on every entry. opts = what standings() takes
     (the roster, the word check, a family's games field). → was there any entry? */
  function boardLines(box, cards, opts, week, remove) {
    var S = social(), B = boardsCore(), any = false, byUid = {};
    cards.forEach(function (c) { byUid[c.uid] = isObj(c.card) ? c.card : {}; });
    B.boards().forEach(function (r) {
      var res = B.standings(cards, r.key, 'ever', week, opts);
      if (!res.rows.length) return;
      any = true;
      add(box, 'div', r.name).setAttribute('style', 'font-weight:700;margin-top:6px;');
      res.rows.forEach(function (row) {
        var line = add(box, 'div', '', 'buyrow'), wk = byUid[row.uid].wk;
        var thisWeek = isObj(wk) && wk.id === week && isObj(wk.v) && B.validValue(r.key, wk.v[r.key]) ? ' · this week ' + B.fmtValue(r.key, wk.v[r.key]) : '';
        add(line, 'div', (row.place ? B.ordinal(row.place) + ' ' : '') + row.n + ' ' + S.avatarAt(row.ai), 'who');
        add(line, 'div', B.fmtValue(r.key, row.v) + thisWeek, 'what');
        if (r.watchBelow && row.v < r.watchBelow) add(line, 'span', WATCH_NOTE, 'pill warnpill');
        var x = button(line, '✕', 'btn-ghost', function () { remove(r, row); });
        x.setAttribute('data-rm', row.uid + '|' + r.key); x.setAttribute('aria-label', 'Remove this entry');
      });
    });
    return any;
  }

  function mountFamily(el, deps) {
    var d = isObj(deps) ? deps : {}, S = social(), B = boardsCore(), code = d.code, fdb = d.fdb;
    var done = Promise.resolve(), none = { ready: done, idle: function () { return done; }, update: function () {} };
    el.textContent = '';
    /* the grown-up's own account still opens with its username: no card, one line (D8) */
    if (d.usedDerived) { add(el, 'p', DERIVED_LINE, 'muted'); return none; }
    if (!S || !B || !fdb || !d.firebase || typeof code !== 'string' || !FAM_RE.test(code)) return none;
    var rude = rudeCheck(), now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
    var famRef = fdb.doc('families/' + code), rosterRef = fdb.doc('families/' + code + '/private/roster'), keyRef = fdb.doc('families/' + code + '/private/games');
    var rowsBox = null, modesBox = null, boardBox = null, statusEl = null;
    /* cfg, roster, cards: as last read or saved. change: only what the grown-up touched on
       this page, so a Save never writes back a tick this page merely remembers. */
    var st = { accounts: [], cfg: S.gamesCfg(d.family), roster: null, plain: {}, cards: [], keyAt: -1, change: { tick: {}, hide: {}, plain: {} },
      probe: {}, rows: {}, notes: {}, form: '', note: '', noRules: false, unread: false, folded: false, sweep: {}, chain: Promise.resolve(),
      /* classes: cls = {uid: {s: 'none' | 'asked' | 'in' | 'gone' | 'unknown', code}} as last read, clsNote = a line per row, typed = a half-typed code */
      cls: {}, clsNote: {}, typed: {}, clsRead: false };

    function uidOf(a) { return a._uid; }
    function setAccounts(list) {
      st.accounts = (Array.isArray(list) ? list : []).filter(function (a) { return isObj(a) && !a.anon && a.familyCode === code && isUid(a._uid); });
    }
    function account(uid) { return st.accounts.filter(function (a) { return a._uid === uid; })[0] || null; }
    function pick(touched, saved, uid) { return has(touched, uid) ? touched[uid] === true : saved[uid] === true; }
    function hidden(uid) { return pick(st.change.hide, st.cfg.hide, uid); }
    function ticked(uid) { return !hidden(uid) && pick(st.change.tick, st.cfg.members, uid); }
    function plain(uid) { return pick(st.change.plain, st.plain, uid); }
    function mode(k) { return has(st.change, k) ? st.change[k] : st.cfg[k]; }
    function ask(text) { return typeof d.confirm === 'function' && d.confirm(text) === true; }
    function today() { return S.accountRow({ updatedAt: now() }, now()).lastSyncDay; }
    function say(text) { st.note = text; if (statusEl) statusEl.textContent = text; }
    /* 'Show as Player' is read back from the roster: an entry saved as Player whose own name would have been allowed */
    function plainFrom(roster) {
      var out = {}, who = isObj(roster) && isObj(roster.who) ? roster.who : {};
      st.accounts.forEach(function (a) {
        var e = has(who, a._uid) ? who[a._uid] : null;
        if (isObj(e) && e.n === 'Player' && S.displayName(a.username, { isRude: rude }) !== 'Player') out[a._uid] = true;
      });
      return out;
    }
    /* one thing at a time; a refusal by the rules has its own answer */
    function run(fn) {
      st.chain = st.chain.then(fn).then(null, function (e) {
        if (e && e.code === 'permission-denied') return noRules();
        say('That did not go through. Check the connection and try again.');
        return null;
      });
      return st.chain;
    }
    /* The rules are not published (or were switched off with the off file): say so. Chunk RV1:
       the family's saved choices are left as they are (the children's devices already fall back
       to This device only and no races while the rules refuse), so publishing the rules again
       brings back what each family had; and only an admin is asked to publish anything. */
    function noRules() {
      st.noRules = true;
      delete st.change.boards; delete st.change.race;
      return famRef.get().then(function (snap) { st.cfg = S.gamesCfg(snap.data()); }).then(null, function () { return null; }).then(function () {
        drawAll();
        say(d.isAdmin ? RULES_NOTE + ' Until then the children’s devices keep boards on this device only and have no Race together; the settings here are kept.' : OFF_NOTE);
      });
    }
    function readCards() {
      return famRef.collection('boards').limit(B.MAX_CARDS).get().then(function (qs) {
        st.cards = qs.docs.map(function (s) { return { uid: s.id, card: s.data() }; });
      });
    }
    function readKey() {
      return keyRef.get().then(function (snap) { var k = snap.data(); st.keyAt = isObj(k) && typeof k.setAt === 'number' ? k.setAt : -1; });
    }
    /* the family record, the roster, the race key and the cards, fresh */
    function load() {
      return famRef.get().then(function (snap) {
        st.cfg = S.gamesCfg(snap.data());
        return rosterRef.get();
      }).then(function (snap) {
        st.roster = snap.data() || null;
        st.plain = plainFrom(st.roster);
        return Promise.all([readKey(), readCards()]);
      }).then(function () { st.noRules = false; });
    }
    function freshKey() {
      return applyOps(fdb, d.firebase, newRaceKey({ family: code }, now(), d.random)).then(function () { st.keyAt = now(); });
    }
    /* Chunk RV1b: the login checked is the username the grown-up sees, lower-cased as the app
       signs in. A users record (the account can edit its own) whose usernameLower says something
       else is not checked at all: a refusal for some other name must never read as 'has its
       own password'. */
    function loginOf(a) {
      var low = lower(a.username);
      return low && (a.usernameLower == null || a.usernameLower === low) ? low : '';
    }
    /* Two of the family's accounts (hidden ones aside) under one login: one record names a
       login that is not its own. A sign-in is tied to its account (probe's uid), but a refusal
       is not, so 'own' is not believed for either until the grown-up hides the one that is not
       their child and checks again. */
    function twin(uid, low) {
      return st.accounts.some(function (b) { return b._uid !== uid && !hidden(b._uid) && (lower(b.username) === low || b.usernameLower === low); });
    }
    /* the automatic password, tried on the second app for one account after another */
    function check(uids) {
      return uids.reduce(function (chain, uid) {
        return chain.then(function () {
          var a = account(uid), low = a ? loginOf(a) : '';
          if (!a) return null;
          st.probe[uid] = 'wait'; drawRow(uid);
          return probe(d.firebase, d.config, low, uid).then(function (res) {
            st.probe[uid] = res === 'own' && twin(uid, low) ? 'unknown' : res;
            drawRow(uid);
          });
        });
      }, Promise.resolve());
    }
    function checkNew() {
      var list = st.accounts.map(uidOf).filter(function (uid) { return !st.probe[uid] && !hidden(uid); });
      return list.length ? check(list) : null;
    }
    /* what the checks found that the family record does not say yet */
    function pwFound() {
      var m = {};
      Object.keys(st.probe).forEach(function (uid) {
        if (st.probe[uid] === 'own' && st.cfg.pw[uid] !== true) m[uid] = true;
        if (st.probe[uid] === 'opens' && st.cfg.pw[uid] === true) m[uid] = false;
      });
      return m;
    }
    /* the kids record of an account that stops being ticked. Its class card and request can
       only be deleted while the request is still there (the rules refuse the read of one
       that is not), so look first; then only the code and the tag are cleared. */
    function kidsOf(uid) {
      return fdb.doc('families/' + code + '/kids/' + uid).get().then(function (snap) {
        var kd = snap.exists ? snap.data() : null;
        if (!kd || typeof kd.cls !== 'string' || !S.CLASS_RE.test(kd.cls)) return kd;
        return fdb.doc('classes/' + kd.cls + '/requests/' + uid).get().then(function (rq) { return rq.exists; }, function (e) {
          if (e && e.code === 'permission-denied') return false;
          throw e;
        }).then(function (there) { if (!there) kd.cls = ''; return kd; });
      });
    }
    /* Chunk RV1b: the accounts as a write nobody pressed Save for sees them: a ticked account
       keeps the name on the roster as read, so such a write never changes a name others see */
    function keepNames(roster) {
      return st.accounts.map(function (a) {
        var was = S.rosterName(roster, a._uid, '', rude), b = {};
        if (!was || was === 'Player' || was === S.displayName(a.username, { isRude: rude })) return a;
        Object.keys(a).forEach(function (k) { b[k] = a[k]; });
        b.username = was;
        return b;
      });
    }
    /* Write a change: re-read the family record and the roster, build on those, apply. With
       atOnce (an account that must be unticked now) a name clash cannot hold the write up:
       the clashing names become Player, and every other name stays as saved (keepNames).
       → saveFamily's answer, plus kids (the kids records read for the unticked accounts) and
       untidy when a tidy-up step after the main batch did not go through (it is tried again
       at the next Save). */
    function commit(change, atOnce) {
      var fresh = null, plainMap = {}, kids = {}, roster0 = null;
      function build() {
        var c = { kids: kids };
        Object.keys(change).forEach(function (k) { c[k] = change[k]; });
        var out = saveFamily(code, fresh, c, atOnce ? keepNames(roster0) : st.accounts, plainMap, now(), d.random);
        out.kids = kids;
        return out;
      }
      return Promise.all([famRef.get(), rosterRef.get()]).then(function (r) {
        fresh = r[0].data() || {};
        roster0 = r[1].data() || null;
        plainMap = plainFrom(roster0);
        if (!atOnce) Object.keys(st.change.plain).forEach(function (uid) { plainMap[uid] = st.change.plain[uid]; });
        /* a ticked account this page has no row for: has it joined since, or left the family? */
        var was = S.gamesCfg(fresh);
        if (!Object.keys(was.members).some(function (uid) { return was.members[uid] === true && !account(uid); })) return null;
        return fdb.collection('users').where('familyCode', '==', code).get().then(function (qs) {
          setAccounts(st.accounts.concat(qs.docs.filter(function (s) { return !account(s.id); }).map(function (s) { var x = s.data(); x._uid = s.id; return x; })));
        });
      }).then(function () {
        return build().unticked.concat(Object.keys(st.sweep)).reduce(function (chain, uid) {
          return chain.then(function () { return has(kids, uid) ? null : kidsOf(uid).then(function (kd) { kids[uid] = kd; }); });
        }, Promise.resolve());
      }).then(function () {
        var out = build();
        if (out.clashes.length && atOnce) { out.clashes.forEach(function (x) { plainMap[x.uid] = true; }); out = build(); }
        if (out.clashes.length) return out;
        return applyOps(fdb, d.firebase, out.steps.slice(0, 1)).then(function () {
          st.cfg = out.games; st.roster = out.roster; st.plain = plainFrom(out.roster); st.keyAt = now();
          out.unticked.forEach(function (uid) { delete st.cls[uid]; delete st.clsNote[uid]; delete st.typed[uid]; });
          fresh.games = out.games; delete fresh.ownerUsername;
          if (typeof d.refresh === 'function') d.refresh(fresh);
          return applyFamily(fdb, d.firebase, out.steps.slice(1)).then(function () { st.sweep = {}; }, function () {
            Object.keys(kids).forEach(function (uid) { st.sweep[uid] = true; });
            out.untidy = true;
          });
        }).then(function () { return out; });
      });
    }
    function nameOf(uid) { var a = account(uid); return a ? a.username : 'an account that has left the family'; }
    /* chunk RV1b: unticking a child also takes them out of the class they are in or asked for.
       untickOk() asks first, from what the card last read; classOut() = a line for each account
       a write unticked whose kids record (read by that write) held a class */
    function inClass(uid) { var c = has(st.cls, uid) ? st.cls[uid] : null; return !!c && (c.s === 'asked' || c.s === 'in'); }
    function classOut(out) {
      if (out.untidy) return [];                   /* the line about the tidy-up says it instead */
      return out.unticked.filter(function (uid) {
        var kd = has(out.kids, uid) ? out.kids[uid] : null;
        return isObj(kd) && typeof kd.cls === 'string' && S.CLASS_RE.test(kd.cls);
      }).map(function (uid) { return ' ' + nameOf(uid) + ' was taken out of ' + (S.classLabel(out.kids[uid].cls) || 'the class') + ' too.'; });
    }
    /* asked before an untick or a hide that would take the child out of a class; true = go ahead */
    function untickOk(uid) {
      if (!inClass(uid)) return true;
      return ask('This also takes ' + nameOf(uid) + ' out of ' + labelOf(st.cls[uid]) + ' when you save: their class card is deleted, and to join again you ask again ' +
        'and the grown-up who runs the class adds them again. Go ahead?');
    }
    /* Chunk RV1b: a ticked name a Save would change although the grown-up did not ask, because
       the account's username is not what it was when the name was last saved. → [{uid, was, now}] */
    function renamed(uid) {
      if (!ticked(uid) || plain(uid)) return null;
      var was = S.rosterName(st.roster, uid, '', rude), a = account(uid), now0 = a ? S.displayName(a.username, { isRude: rude }) : '';
      return was && was !== 'Player' && now0 && was !== now0 ? { uid: uid, was: was, now: now0 } : null;
    }
    function renames() { return st.accounts.map(function (a) { return renamed(a._uid); }).filter(function (x) { return !!x; }); }
    function save() {
      if (st.saving) return;                       /* a second press while one Save is on its way */
      var ren = renames();
      if (ren.length && !ask('A Save changes the name others see: ' + ren.map(function (x) { return x.was + ' becomes ' + x.now; }).join(', ') +
        ', because the username changed since you last saved. Save with the new name? To keep the name off the boards, choose Cancel, then “Show as Player instead”.')) {
        say('Not saved.');
        return;
      }
      st.saving = true;
      run(function () {
        say('Saving…');
        var ch = { tick: st.change.tick, hide: st.change.hide, pw: pwFound() };
        ['boards', 'race', 'relay', 'order'].forEach(function (k) { if (has(st.change, k)) ch[k] = st.change[k]; });
        return commit(ch, false).then(function (out) {
          if (out.clashes.length) { say('Not saved: two ticked children would be shown under the same name. Set one of them to Player first.'); return null; }
          st.change = { tick: {}, hide: {}, plain: {} };
          var notes = out.refused.map(function (uid) {
            return ' ' + nameOf(uid) + ' is not ticked: ' + (st.cfg.hide[uid] === true ? 'the account is hidden.' : 'it has no password of its own yet.');
          }).concat(out.left.map(function (uid) { return ' ' + nameOf(uid) + ' was unticked.'; }), classOut(out));
          if (out.untidy) notes.push(' One tidy-up step did not finish: press Save again.');
          /* can the board and the key be read back? If not, the rules are not published */
          return Promise.all([readCards(), readKey()]).then(function () {
            st.noRules = false; st.clsRead = true;
            drawAll();
            say('Saved.' + notes.join(''));
            return checkNew();
          });
        });
      }).then(function () { st.saving = false; });
    }
    /* after the checks: an account that is ticked and now opens with just its username (or
       has left the family) is unticked at once; an old race key is replaced */
    function settle() {
      var pw = {}, any = false;
      if (st.noRules || st.unread) return null;
      st.accounts.forEach(function (a) { if (st.probe[a._uid] === 'opens' && st.cfg.members[a._uid] === true) { pw[a._uid] = false; any = true; } });
      any = any || Object.keys(st.cfg.members).some(function (uid) { return st.cfg.members[uid] === true && !account(uid); });
      if (any) {
        return commit({ pw: pw }, true).then(function (out) {
          drawAll();
          say('A ticked account was unticked: it no longer has a password of its own, or it has left the family.' + classOut(out).join(''));
          return checkNew();
        });
      }
      return st.keyAt >= 0 && now() - st.keyAt > KEY_MAX_MS ? freshKey() : null;
    }

    /* ----- a child's class: asked for here, by the child's own grown-up; children type nothing ----- */
    function labelOf(c) { return S.classLabel(c.code) || 'the class'; }
    /* Which class this child's grown-up asked for, and whether the grown-up who runs it has
       added the child: the kids record, then the request (a refused read means it is not
       there) and the child's entry. The code is kept in memory and never drawn. */
    function kidState(uid) {
      function is(s, cls, n) { st.cls[uid] = { s: s, code: cls, n: n || '' }; return null; }
      function found(snap) { return snap.exists ? snap.data() || {} : null; }
      return fdb.doc('families/' + code + '/kids/' + uid).get().then(function (snap) {
        var kd = snap.exists ? snap.data() : null, cls = isObj(kd) && typeof kd.cls === 'string' && S.CLASS_RE.test(kd.cls) ? kd.cls : '';
        if (!cls) return is('none', '');
        return fdb.doc('classes/' + cls + '/requests/' + uid).get().then(found, refusedIsNo).then(function (rq) {
          if (!rq) return is('gone', cls);
          var n = S.cleanName(rq.n, 'Player', rude);         /* the name the class was given */
          return fdb.doc('classes/' + cls + '/members/' + uid).get().then(found, refusedIsNo).then(function (entry) { return is(entry ? 'in' : 'asked', cls, n); });
        });
      });
    }
    /* The request is gone: the grown-up who runs the class said no, took the child out or
       closed the class. The row says so, and the kids record gives up the code and the tag,
       so the child's device stops asking that class. */
    function forget(uid, a) {
      /* chunk RV1: from here a request turned down looks the same as a child taken out */
      st.clsNote[uid] = a.username + ' is not in ' + labelOf(st.cls[uid]) + ': the grown-up who runs it turned the request down or took them out, or the class was closed. ' +
        'Check with them; you can ask again.';
      return applyOps(fdb, d.firebase, leaveClass(code, uid, '')).then(function () { st.cls[uid] = { s: 'none', code: '' }; }, function () { return null; });
    }
    function look(uid, a) { return kidState(uid).then(function () { return st.cls[uid].s === 'gone' ? forget(uid, a) : null; }); }
    /* when the card opens: the class of every ticked child. A read that fails leaves that row without a class line. */
    function classStates() {
      if (!S.ON.classes || st.noRules || st.unread) return null;
      return st.accounts.filter(function (a) { return S.memberOk(st.cfg, a._uid); }).reduce(function (chain, a) {
        return chain.then(function () { return look(a._uid, a).then(null, function () { st.cls[a._uid] = { s: 'unknown', code: '' }; }); });
      }, Promise.resolve()).then(function () { st.clsRead = true; if (!st.form) drawRows(); });
    }
    function joinFor(uid, typed) {
      var a = account(uid), want = String(typed == null ? '' : typed).replace(/\s+/g, '').toUpperCase();
      if (!a) return;
      if (!S.CLASS_RE.test(want)) { st.clsNote[uid] = JOIN_FAIL; drawRow(uid); return; }
      run(function () {
        /* the kids record and the roster, fresh: a page left open must not ask twice or send an old name */
        return Promise.all([kidState(uid), rosterRef.get()]).then(function (r) {
          var c = st.cls[uid], n = S.rosterName(r[1].data(), uid, '', rude), w = S.who(isObj(a.state) ? a.state : {});
          if (c.s === 'asked' || c.s === 'in') { st.clsNote[uid] = ''; return null; }      /* already asked, from another page */
          if (!n) { st.clsNote[uid] = 'Press Save first, so that ' + a.username + ' is on the list of ticked children; then ask again.'; return null; }
          return applyOps(fdb, d.firebase, joinClass(code, uid, want, { n: n, ai: w.ai, ci: w.ci }, d.random)).then(function () {
            st.typed[uid] = ''; st.clsNote[uid] = '';
            return kidState(uid).then(function () {
              /* an entry from an earlier stay is still there: say what that means for the name */
              if (st.cls[uid].s === 'in') {
                st.clsNote[uid] = a.username + ' was in this class before, so is back in it at once. If the name shown has changed since, the class keeps ' +
                  'the old one until the grown-up who runs it next opens their Control Centre and adds ' + a.username + ' again.';
              }
            });
          }, function (e) {
            /* a refusal here is an answer about that class, not about the rules as a whole */
            refusedIsNo(e);
            st.clsNote[uid] = JOIN_FAIL;
          });
        }).then(function () { drawRow(uid); });
      });
    }
    function leave(uid) {
      var a = account(uid), was = has(st.cls, uid) ? st.cls[uid] : null;
      if (!a || !was || !ask('Take ' + a.username + ' out of ' + labelOf(was) + '? Their class card is deleted and the class can no longer see them. ' +
        'To join again, you ask again and the grown-up who runs the class adds them again.')) return;
      run(function () {
        return kidState(uid).then(function () {
          var c = st.cls[uid];
          if (c.s === 'none') return null;
          /* the request can go between the read and the write: then only the kids record is cleared */
          return applyFamily(fdb, d.firebase, leaveClass(code, uid, c.s === 'gone' ? '' : c.code)).then(null, function (e) {
            refusedIsNo(e);
            return applyOps(fdb, d.firebase, leaveClass(code, uid, ''));
          }).then(function () {
            st.clsNote[uid] = a.username + ' was taken out of ' + labelOf(c) + '.';
            st.cls[uid] = { s: 'none', code: '' };
          });
        }).then(function () { drawRow(uid); });
      });
    }
    /* the last line of a ticked row: Join a class, or where the request stands, with Take out */
    function classLine(box, uid, a) {
      var c = has(st.cls, uid) ? st.cls[uid] : { s: 'none', code: '' };
      if (!S.ON.classes || !st.clsRead || st.noRules || st.unread || c.s === 'unknown' || !ticked(uid) || !S.memberOk(st.cfg, uid)) return;
      var line = add(box, 'div');
      if (c.s === 'asked' || c.s === 'in') {
        add(line, 'span', (c.s === 'in' ? 'In ' + labelOf(c) : 'Asked to join ' + labelOf(c) + ': waiting for the class grown-up') + ' ');
        button(line, 'Take ' + a.username + ' out', 'btn-ghost', function () { leave(uid); }).setAttribute('data-clsout', uid);
        if (c.s === 'asked') {
          add(line, 'span', ' ');
          button(line, 'Check again', 'btn-ghost', function () { run(function () { return look(uid, a).then(function () { drawRow(uid); }); }); }).setAttribute('data-clslook', uid);
        }
      } else {
        var lab = add(line, 'label', 'Join a class: '), field = input(lab, 'text');
        field.setAttribute('placeholder', 'class code'); field.setAttribute('autocomplete', 'off'); field.setAttribute('autocapitalize', 'characters');
        field.setAttribute('maxlength', '24'); field.setAttribute('data-clscode', uid);
        field.value = has(st.typed, uid) ? st.typed[uid] : '';
        field.addEventListener('input', function () { st.typed[uid] = field.value; });
        add(line, 'span', ' ');
        button(line, 'Ask', 'btn-ghost', function () { joinFor(uid, field.value); }).setAttribute('data-clsask', uid);
      }
      /* a request is never changed: the class keeps the name it was given, whatever the family's list says now */
      var mine = S.rosterName(st.roster, uid, '', rude);
      if (c.n && mine && c.n !== mine) add(box, 'div', 'The class was given the name ' + c.n + ', not ' + mine + '. To change it, take ' + a.username + ' out and ask again.', 'muted');
      if (has(st.clsNote, uid) && st.clsNote[uid]) add(box, 'div', st.clsNote[uid], 'muted');
    }

    /* ----- drawing: createElement and textContent only ----- */
    function pwForm(box, uid, a) {
      var f = add(box, 'div'), one = input(f, 'password'), two = input(f, 'password'), msg = null;
      one.setAttribute('placeholder', 'New password'); two.setAttribute('placeholder', 'The same again');
      one.setAttribute('autocomplete', 'new-password'); two.setAttribute('autocomplete', 'new-password');
      button(f, 'Set password', 'btn-act', function () {
        var p = one.value;
        if (typeof p !== 'string' || p !== two.value) { msg.textContent = 'The two passwords are not the same.'; return; }
        if (!S.passwordOk(p, a.username)) { msg.textContent = PW_RULE; return; }
        one.value = two.value = ''; st.form = '';
        run(function () {
          return setPassword(d.firebase, d.config, loginOf(a), p, uid).then(function () {
            /* chunk RV1: say what happens next on the child's devices */
            st.notes[uid] = a.username + ' will be signed out on every device within about an hour, and then needs this password to sign in again on each device ' +
              '(under “grown-up options” on the login sheet). Tell them the new password first.';
          }, function () {
            st.notes[uid] = 'The password was not changed. If this account already has a password of its own, it cannot be changed here.';
          }).then(function () { return check([uid]); }).then(function () {
            /* a new password is a reason for a new race key */
            return st.probe[uid] === 'own' && st.keyAt >= 0 && !st.noRules ? freshKey().then(null, function () { return null; }) : null;
          });
        });
      }).setAttribute('data-pwgo', uid);
      button(f, 'Cancel', 'btn-ghost', function () { st.form = ''; drawRow(uid); });
      msg = add(f, 'div', '', 'muted');
    }
    function drawRow(uid) {
      var a = account(uid), box = st.rows[uid];
      if (!a || !box) return;
      box.textContent = '';
      var row = S.accountRow(a, now(), { plain: plain(uid), isRude: rude }), pr = st.probe[uid] || 'wait', on = ticked(uid);
      var who = add(box, 'div'), synced = row.lastSyncDay, lead = /^[A-Za-z]+/.exec(row.username);
      add(who, 'b', row.username);
      add(who, 'span', ' · ' + commas(row['points']) + ' points · ' + (!synced ? 'never synced' : synced === today() ? 'played today' : 'last synced ' + niceDay(synced)) +
        ' · ' + row.playedDays + (row.playedDays === 1 ? ' day played' : ' days played') + (row.isNew && row.firstSeenDay ? ' · first seen ' + niceDay(row.firstSeenDay) : '') + ' ');
      if (row.isNew) add(who, 'span', NEW_NOTE, 'pill warnpill');
      var pw = add(box, 'div', PW_LINE[pr] + ' ', pr === 'own' ? '' : 'muted');
      if (pr === 'opens') button(pw, 'Set a password for ' + row.username, 'btn-ghost', function () { st.form = uid; drawRow(uid); }).setAttribute('data-setpw', uid);
      if (pr === 'unknown') button(pw, 'Check again', 'btn-ghost', function () { run(function () { return check([uid]); }); });
      if (st.form === uid && pr === 'opens') pwForm(box, uid, a);
      if (st.notes[uid]) add(box, 'div', st.notes[uid], 'muted');
      /* never ticked unless the grown-up ticked it; never tickable until the password line shows ✓ */
      var lab = add(box, 'label'), cb = input(lab, 'checkbox');
      cb.checked = on; cb.disabled = !on && pr !== 'own'; cb.setAttribute('data-tick', uid);
      add(lab, 'span', ' ' + (S.ON.classes ? TICK_LABEL : TICK_LABEL_NO_CLASS));
      cb.addEventListener('change', function () {
        if (cb.checked !== true && on && !untickOk(uid)) { cb.checked = true; return; }
        st.change.tick[uid] = cb.checked === true && pr === 'own'; drawRow(uid); drawModes();
      });
      var refusedName = !!lead && lead[0].slice(0, 12).toLowerCase() !== 'player' && S.displayName(row.username, { isRude: rude }) === 'Player';
      add(box, 'div', 'Shown as: ' + row.shownAs + (refusedName ? ' (name not allowed)' : '') + ' ' + S.avatarAt(S.avatarIndex(isObj(a.state) ? a.state.avatar : '')));
      /* chunk RV1b: a Save builds every name from the account's username; if that would change
         a name the grown-up saved before, say so here (and Save asks) */
      var ren = renamed(uid);
      if (ren) warn(box, 'The name others see is ' + ren.was + '. The username has changed since you last saved, so a Save makes it ' + ren.now + '.').setAttribute('data-renamed', uid);
      var pl = add(box, 'label'), pc = input(pl, 'checkbox');
      pc.checked = plain(uid); pc.setAttribute('data-plain', uid);
      add(pl, 'span', ' Show as Player instead ');
      pc.addEventListener('change', function () { st.change.plain[uid] = pc.checked === true; drawRow(uid); drawModes(); });
      button(box, 'Not my child: hide', 'btn-ghost', function () {
        if (on && !untickOk(uid)) return;
        st.change.hide[uid] = true; st.change.tick[uid] = false; st.form = '';
        drawRows(); drawModes();
      }).setAttribute('data-hide', uid);
      classLine(box, uid, a);
    }
    function drawRows() {
      var hid = [];
      rowsBox.textContent = ''; st.rows = {};
      if (!st.accounts.length) add(rowsBox, 'p', 'No accounts have this family code yet.', 'empty');
      st.accounts.forEach(function (a) {
        if (hidden(a._uid)) { hid.push(a); return; }
        st.rows[a._uid] = add(rowsBox, 'div');
        st.rows[a._uid].setAttribute('style', 'padding:8px 0;border-bottom:1px solid #f0eef8;line-height:1.7;');
        drawRow(a._uid);
      });
      if (!hid.length) return;
      var box = add(rowsBox, 'details');
      add(box, 'summary', 'Hidden accounts (' + hid.length + ')');
      hid.forEach(function (a) {
        var line = add(box, 'div');
        add(line, 'span', a.username + ' ');
        button(line, 'Show again', 'btn-ghost', function () {
          st.change.hide[a._uid] = false;
          drawRows(); drawModes();
          if (!st.probe[a._uid]) run(function () { return check([a._uid]); });
        }).setAttribute('data-unhide', a._uid);
      });
    }
    /* two ticked rows with the same Shown as text, as the screen stands */
    function clashNames() {
      var g = { members: {}, pw: {} }, pl = {}, names = {};
      st.accounts.forEach(function (a) {
        if (ticked(a._uid)) g.members[a._uid] = g.pw[a._uid] = true;
        if (plain(a._uid)) pl[a._uid] = true;
      });
      S.rosterDoc(g, st.accounts, pl, rude).clashes.forEach(function (c) { names[c.n] = true; });
      return Object.keys(names);
    }
    function choice(title, key, opts, off) {
      var line = add(modesBox, 'div');
      add(line, 'b', title + ': ');
      opts.forEach(function (o) {
        var lab = add(line, 'label'), r = input(lab, 'radio');
        r.setAttribute('name', 'gs_' + key + '_' + code); r.setAttribute('data-' + key, String(o[0]));
        r.checked = mode(key) === o[0]; r.disabled = off === o[0];
        add(lab, 'span', ' ' + o[1] + ' ');
        r.addEventListener('change', function () { st.change[key] = o[0]; drawModes(); });
      });
    }
    function drawModes() {
      modesBox.textContent = '';
      modesBox.setAttribute('style', 'margin-top:10px;line-height:1.9;');
      choice('Boards', 'boards', [['off', 'Off'], ['device', 'This device only'], ['family', 'Family board']], S.ON.boards ? null : 'family');
      add(modesBox, 'div', MODES_HELP, 'muted');
      choice('Order on the family board', 'order', [['ranked', 'Ranked'], ['az', 'A to Z, no places']], null);
      choice('Race together', 'race', [[false, 'Off'], [true, 'On']], S.ON.race ? null : true);
      var lab = add(modesBox, 'label'), relay = input(lab, 'checkbox');
      relay.checked = mode('relay') === true; relay.setAttribute('data-relay', code);
      add(lab, 'span', ' Some of these devices are in other homes: always use the relay');
      relay.addEventListener('change', function () { st.change.relay = relay.checked === true; });
      clashNames().forEach(function (n) {
        warn(modesBox, 'Two ticked children would both be shown as ' + n + '. Tick “Show as Player instead” for one of them before you save.');
      });
      var line = add(modesBox, 'div');
      button(line, 'Save', 'btn-act', save).setAttribute('data-gs', 'save');
      statusEl = add(line, 'span', st.note, 'muted');
      statusEl.setAttribute('role', 'status'); statusEl.setAttribute('style', 'margin-left:8px;');
    }
    /* reading the cards was refused: a table only the grown-up sees, from each child's synced personal bests */
    function drawBests() {
      add(boardBox, 'div', 'Only you can see this: each child’s own best, as last synced.', 'muted');
      B.boards().forEach(function (r) {
        var rows = [];
        st.accounts.forEach(function (a) {
          var pb = isObj(a.state) && isObj(a.state.world) && isObj(a.state.world.pb) && has(a.state.world.pb, r.key) ? a.state.world.pb[r.key] : null;
          var v = isObj(pb) ? (r.better === 'lower' ? pb.ms : pb.score) : null;
          if (!hidden(a._uid) && B.validValue(r.key, v)) rows.push({ n: a.username, v: v });
        });
        if (!rows.length) return;
        rows.sort(function (x, y) { return B.better(r.key, x.v, y.v) ? -1 : B.better(r.key, y.v, x.v) ? 1 : 0; });
        add(boardBox, 'b', r.name);
        rows.forEach(function (x) { add(boardBox, 'div', x.n + ' · ' + B.fmtValue(r.key, x.v), 'statrow'); });
      });
    }
    function removeOne(r, row) {
      if (!ask(removeText(r, row))) return;
      run(function () {
        return applyOps(fdb, d.firebase, removeEntry({ family: code }, row.uid, r.key)).then(function () {
          dropEntry(st.cards, row.uid, r.key);
          drawBoard();
          say(removedText(r));
        });
      });
    }
    /* the family board as the children see it */
    function drawBoard() {
      boardBox.textContent = '';
      boardBox.setAttribute('style', 'margin-top:12px;');
      if (st.noRules) { warn(boardBox, d.isAdmin ? RULES_NOTE : OFF_NOTE); drawBests(); return; }
      add(boardBox, 'b', 'The family board');
      var any = boardLines(boardBox, st.cfg.boards === 'family' ? st.cards : [], { roster: st.roster, isRude: rude, games: st.cfg }, B.weekKey(today()), removeOne);
      if (!any) add(boardBox, 'div', st.cfg.boards === 'family' ? 'No entries yet.' : 'The family board is not switched on.', 'empty');
      var tools = add(boardBox, 'div');
      tools.setAttribute('style', 'margin-top:10px;');
      button(tools, 'New race key', 'btn-ghost', function () {
        run(function () { return freshKey().then(function () { say('New race key set. A race lobby that is open now needs opening again.'); }); });
      }).setAttribute('data-gs', 'newkey');
      add(tools, 'span', ' Press this if you are ever worried about who can join. ', 'muted');
      button(tools, 'Delete the family board', 'btn-ghost', function () {
        if (!ask('Delete the family board? Every card is removed. Best-ever entries come back from the children’s personal bests if the board is switched on again.')) return;
        run(function () {
          return applyOps(fdb, d.firebase, deleteFamilyBoard(code, st.cards.map(function (c) { return c.uid; }).concat(st.accounts.map(uidOf)))).then(function () {
            st.cards = [];
            drawBoard();
            say('The family board was deleted.');
          });
        });
      }).setAttribute('data-gs', 'wipe');
    }
    function drawAll() {
      el.textContent = '';
      var h = add(el, 'h2', TITLE + ' ');
      add(h, 'span', 'code ' + code, 'pill');
      var card = add(el, 'div', '', 'card'), about = add(card, 'details');
      if (!st.folded) about.setAttribute('open', '');
      about.addEventListener('toggle', function () { st.folded = !about.hasAttribute('open'); });
      add(about, 'summary', 'What this switches on, and who sees what: please read').setAttribute('style', 'font-weight:700;cursor:pointer;');
      PARENT_TEXT.forEach(function (t) { add(about, 'p', t, 'muted'); });
      rowsBox = add(card, 'div'); modesBox = add(card, 'div'); boardBox = add(card, 'div');
      drawRows(); drawModes(); drawBoard();
    }
    /* the page loaded the accounts again: new rows are checked; a half-typed password or class code is left alone */
    function update(list) {
      setAccounts(list);
      if (st.form || Object.keys(st.typed).some(function (uid) { return !!st.typed[uid]; })) return;
      drawRows();
      run(checkNew);
    }

    setAccounts(d.accounts);
    drawAll();
    var ready = run(function () {
      return load().then(null, function (e) {
        if (e && e.code === 'permission-denied') return noRules();
        st.unread = true;
        say('The family’s settings could not be read just now. Check the connection, then press Refresh.');
        return null;
      }).then(function () {
        if (!st.noRules) drawAll();
        return checkNew();
      }).then(settle).then(classStates);
    });
    return { ready: ready, idle: function () { return st.chain; }, update: update };
  }

  /* ---------- the classes card ---------- */
  /* Is this account listed in classHosts? One read of its own entry; a refusal or any other
     failure is no. control.html asks it when an account that is not an admin owns no family
     (chunk RV1), so that a class host who owns no family can still open the Control Centre. */
  function isClassHost(fdb, uid) {
    if (!fdb || !isUid(uid)) return Promise.resolve(false);
    try {
      return fdb.doc('classHosts/' + uid).get().then(function (snap) { return !!snap && snap.exists === true; }, function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  /* '🏫 Classes you run', once on the page. Nothing is drawn under the automatic password
     (the games card says why), and nothing unless the account is an admin or is listed in
     classHosts (one read). A child joins through two grown-ups: their own files the request
     from the games card, and the one who runs the class adds them here. */
  function mountClasses(el, deps) {
    var d = isObj(deps) ? deps : {}, S = social(), B = boardsCore(), fdb = d.fdb, me = '';
    var done = Promise.resolve(), none = { ready: done, idle: function () { return done; } };
    el.textContent = '';
    if (d.usedDerived || !S || !B || !S.ON.classes || !fdb || !d.firebase) return none;
    try { me = d.auth.currentUser.uid; } catch (e) { me = ''; }
    if (!isUid(me)) return none;
    var rude = rudeCheck(), now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
    /* classes: the open ones, each {id, doc, name, roster, requests, members, cards, keyAt} as last read or written */
    var statusEl = null, st = { classes: [], closed: [], typed: '', note: '', noRules: false, chain: Promise.resolve() };

    function say(text) { st.note = text; if (statusEl) statusEl.textContent = text; }
    function ask(text) { return typeof d.confirm === 'function' && d.confirm(text) === true; }
    function today() { return S.accountRow({ updatedAt: now() }, now()).lastSyncDay; }
    function run(fn) {
      st.chain = st.chain.then(fn).then(null, function (e) {
        say(e && e.code === 'permission-denied' ? REFUSED : 'That did not go through. Check the connection and try again.');
        return null;
      });
      return st.chain;
    }
    function doc(c, tail) { return fdb.doc('classes/' + c.id + '/' + tail); }
    function list(c, name) { return fdb.collection('classes/' + c.id + '/' + name); }
    function idsOf(qs) { return qs.docs.map(function (s) { return s.id; }); }
    function nameOf(c) { return c.name || 'Class ' + c.id; }
    /* in the class: the child's own grown-up asked, and this grown-up added them under that name */
    function isIn(c, uid) { return has(c.members, uid) && has(c.requests, uid) && has(c.roster.who, uid); }
    function kidsIn(c) { return Object.keys(c.members).filter(function (uid) { return isIn(c, uid); }); }
    function shown(rq) { return S.cleanName(rq.n, 'Player', rude); }
    function readRoster(c) { return doc(c, 'private/roster').get().then(function (snap) { c.roster = { v: V, who: cleanWho(snap.data()) }; }); }
    function freshKey(c) { return applyOps(fdb, d.firebase, newRaceKey({ cls: c.id }, now(), d.random)).then(function () { c.keyAt = now(); }); }

    function readClass(c) {
      return Promise.all([doc(c, 'private/admin').get(), readRoster(c), doc(c, 'private/games').get(),
        list(c, 'requests').get(), list(c, 'members').get(), list(c, 'boards').limit(B.MAX_CARDS).get()]).then(function (r) {
        var nm = r[0].data(), k = r[2].data();
        c.name = isObj(nm) && classNameOk(nm.name) ? nm.name : '';
        c.keyAt = isObj(k) && typeof k.setAt === 'number' ? k.setAt : -1;
        c.requests = {}; c.members = {};
        r[3].docs.forEach(function (s) { var rq = s.data(); if (isUid(s.id) && isObj(rq)) c.requests[s.id] = rq; });
        idsOf(r[4]).filter(isUid).forEach(function (uid) { c.members[uid] = true; });
        c.cards = r[5].docs.map(function (s) { return { uid: s.id, card: s.data() }; });
      });
    }
    /* When the card opens. A child whose own grown-up withdrew the request is no longer in
       the class: the entry, the card and the name on the roster go, and races get a new key.
       A request filed again under another name waits to be added again. A race key that is
       missing or older than 30 days is replaced while races are on. */
    function settle(c) {
      var gone = [];
      Object.keys(c.members).concat(Object.keys(c.roster.who)).forEach(function (uid) {
        var rq = has(c.requests, uid) ? c.requests[uid] : null, w = has(c.roster.who, uid) ? c.roster.who[uid] : null;
        var stands = !!rq && !!w && has(c.members, uid) && (w.n === 'Player' || w.n === shown(rq));
        if (!stands && gone.indexOf(uid) < 0) gone.push(uid);
      });
      function drop(list) {
        var some = list.slice(0, KIDS_PER_BATCH);
        if (!some.length) return Promise.resolve();
        return applyOps(fdb, d.firebase, removeSteps(c.id, some, c.roster, now(), d.random, false)).then(function () {
          some.forEach(function (uid) { delete c.members[uid]; delete c.roster.who[uid]; });
          c.cards = c.cards.filter(function (x) { return some.indexOf(x.uid) < 0; });
          c.keyAt = now();
          return drop(list.slice(KIDS_PER_BATCH));
        });
      }
      return drop(gone).then(function () {
        return c.doc.race === true && (c.keyAt < 0 || now() - c.keyAt > KEY_MAX_MS) ? freshKey(c) : null;
      }).then(null, function () { return null; });
    }
    function load() {
      return fdb.collection('classes').where('ownerUid', '==', me).get().then(function (qs) {
        st.classes = []; st.closed = [];
        qs.docs.forEach(function (s) {
          var cd = s.data();
          if (!S.CLASS_RE.test(s.id) || !isObj(cd)) return;
          if (cd.closed === false) st.classes.push({ id: s.id, doc: cd, name: '', roster: { v: V, who: {} }, requests: {}, members: {}, cards: [], keyAt: -1 });
          else st.closed.push(s.id);
        });
        return st.classes.reduce(function (chain, c) {
          return chain.then(function () { return readClass(c); }).then(function () { return settle(c); });
        }, Promise.resolve());
      });
    }

    /* ----- what the grown-up can do ----- */
    function create(typed) {
      var name = String(typed == null ? '' : typed).replace(/\s+/g, ' ').trim();
      if (!classNameOk(name)) { say('A class name is 1 to 24 letters and spaces.'); return; }
      if (st.classes.length >= MAX_CLASSES) { say('You can run ' + MAX_CLASSES + ' classes at most. Close one first.'); return; }
      if (st.creating) return;                     /* a second press while one class is being made */
      st.creating = true;
      run(function () {
        var steps = classCreate('', me, name, now(), d.random), id = steps[0][0].path[1];
        return applyOps(fdb, d.firebase, steps.slice(0, 1)).then(function () {
          var c = { id: id, doc: steps[0][0].data, name: name, roster: { v: V, who: {} }, requests: {}, members: {}, cards: [], keyAt: -1 };
          st.typed = '';
          st.classes.push(c);
          /* the class exists from here on, whatever happens to its name */
          return applyOps(fdb, d.firebase, steps.slice(1)).then(function () { return true; }, function () { c.name = ''; return false; });
        }).then(function (named) {
          drawAll();
          say('Created. The code is ' + id + ': give it to each child’s own grown-up. Children will see “' + S.classLabel(id) + '”.' +
            (named ? '' : ' Its name could not be saved, so it is listed by its code.'));
        });
      }).then(function () { st.creating = false; });
    }
    function flip(c, key, on, label) {
      var change = {};
      change[key] = on;
      run(function () {
        return applyOps(fdb, d.firebase, classSwitch(c.id, change, now(), d.random)).then(function () {
          c.doc[key] = on;
          if (key === 'race' && on) c.keyAt = now();
          say(label + ' is ' + (on ? 'on' : 'off') + ' for ' + nameOf(c) + '.');
        }, function (e) { drawAll(); throw e; });
      });
    }
    function addChild(c, uid) {
      if (kidsIn(c).length >= MAX_KIDS) { say('A class holds ' + MAX_KIDS + ' children at most.'); return; }
      run(function () {
        /* the request and the roster, fresh: the name copied is the one on file now, and a page left open drops nobody */
        return Promise.all([doc(c, 'requests/' + uid).get(), readRoster(c)]).then(function (r) {
          var rq = r[0].exists ? r[0].data() : null;
          if (!isObj(rq)) { delete c.requests[uid]; drawAll(); say('That request has been withdrawn.'); return null; }
          var steps = classAdd(c.id, uid, rq, c.roster, now());
          return applyOps(fdb, d.firebase, steps).then(function () {
            c.requests[uid] = rq; c.members[uid] = true; c.roster = steps[0][1].data;
            drawAll();
            say(c.roster.who[uid].n + ' was added to ' + nameOf(c) + '.');
          });
        });
      });
    }
    function refuse(c, uid) {
      /* chunk RV1: asked first, as Remove and Close are: No cannot be undone from here */
      var rq = c.requests[uid];
      if (!ask('Turn down the request for ' + (isObj(rq) ? shown(rq) : 'this child') + ' to join ' + nameOf(c) + '? Their own grown-up would have to ask again.')) return;
      run(function () {
        return applyOps(fdb, d.firebase, [[{ kind: 'delete', path: ['classes', c.id, 'requests', uid] }]]).then(function () {
          delete c.requests[uid];
          drawAll();
          say('That request was removed.');
        });
      });
    }
    function removeChild(c, uid) {
      var n = c.roster.who[uid].n;
      if (!ask('Remove ' + n + ' from ' + nameOf(c) + '? Their class card is deleted, and class races get a new key. To come back, their own grown-up asks again.')) return;
      run(function () {
        return readRoster(c).then(function () {
          var steps = classRemove(c.id, uid, c.roster, now(), d.random);
          return applyOps(fdb, d.firebase, steps).then(function () {
            delete c.members[uid]; delete c.requests[uid];
            c.roster = steps[0][3].data; c.keyAt = now();
            c.cards = c.cards.filter(function (x) { return x.uid !== uid; });
            drawAll();
            say(n + ' was removed from ' + nameOf(c) + '.');
          });
        });
      });
    }
    function removeOne(c, r, row) {
      if (!ask(removeText(r, row))) return;
      run(function () {
        return applyOps(fdb, d.firebase, removeEntry({ cls: c.id }, row.uid, r.key)).then(function () {
          dropEntry(c.cards, row.uid, r.key);
          drawAll();
          say(removedText(r));
        });
      });
    }
    /* list what the class holds, delete it, close; then look once more for anything a child's device wrote meanwhile */
    function close(c) {
      function sweep(andClose) {
        return Promise.all(['members', 'boards', 'lobby', 'requests', 'live'].map(function (name) { return list(c, name).get().then(idsOf); })).then(function (r) {
          var steps = classClose(c.id, r[0].concat(r[1], r[2]), r[3], r[4]);
          if (andClose) return applyOps(fdb, d.firebase, steps);
          return r.some(function (ids) { return ids.length > 0; }) ? applyOps(fdb, d.firebase, steps.slice(0, -1)) : null;
        });
      }
      if (!ask('Close ' + nameOf(c) + '? Every child is taken out and the class board is deleted. Its code (' + c.id + ') can never be used again.')) return;
      run(function () {
        return sweep(true).then(function () {
          st.classes = st.classes.filter(function (x) { return x !== c; });
          st.closed.push(c.id);
          drawAll();
          say(nameOf(c) + ' is closed.');
          return sweep(false).then(null, function () { return null; });
        });
      });
    }

    /* ----- drawing: createElement and textContent only ----- */
    function toggle(box, c, key, label, allowed) {
      var lab = add(box, 'label'), cb = input(lab, 'checkbox');
      cb.checked = c.doc[key] === true; cb.disabled = !allowed && !cb.checked; cb.setAttribute('data-' + key, c.id);
      add(lab, 'span', ' ' + label + ' ');
      cb.addEventListener('change', function () { flip(c, key, cb.checked === true, label); });
    }
    function drawClass(card, c) {
      var box = add(card, 'div'), head = add(box, 'div'), waiting = Object.keys(c.requests).filter(function (uid) { return !isIn(c, uid); }).sort();
      var kids = kidsIn(c).sort(function (a, b) { return c.roster.who[a].n < c.roster.who[b].n ? -1 : c.roster.who[a].n > c.roster.who[b].n ? 1 : a < b ? -1 : 1; });
      box.setAttribute('data-class', c.id);
      box.setAttribute('style', 'margin-top:14px;padding-top:10px;border-top:1px solid #f0eef8;line-height:1.8;');
      add(head, 'b', nameOf(c));
      add(head, 'span', ' · code ' + c.id + ' · children see “' + (S.classLabel(c.id) || 'a class') + '”', 'muted');
      var sw = add(box, 'div');
      toggle(sw, c, 'on', 'Class board', S.ON.boards);
      toggle(sw, c, 'race', 'Race together', S.ON.race);
      add(box, 'b', 'Waiting to join');
      add(box, 'div', WAIT_LINE, 'muted');
      if (!waiting.length) add(box, 'div', 'Nobody is waiting.', 'empty');
      waiting.forEach(function (uid) {
        var rq = c.requests[uid], line = add(box, 'div', '', 'buyrow');
        add(line, 'div', 'Shown as: ' + shown(rq) + ' ' + S.avatarAt(rq.ai) + ' · family ' + (typeof rq.fam === 'string' && FAM_RE.test(rq.fam) ? rq.fam : 'unknown'), 'what');
        button(line, 'Add', 'btn-act', function () { addChild(c, uid); }).setAttribute('data-add', uid);
        button(line, 'No', 'btn-ghost', function () { refuse(c, uid); }).setAttribute('data-no', uid);
      });
      add(box, 'b', 'In the class (' + kids.length + ' of ' + MAX_KIDS + ')');
      if (!kids.length) add(box, 'div', 'Nobody yet.', 'empty');
      kids.forEach(function (uid) {
        var line = add(box, 'div', '', 'buyrow');
        add(line, 'div', c.roster.who[uid].n + ' ' + S.avatarAt(c.requests[uid].ai), 'what');
        button(line, 'Remove', 'btn-ghost', function () { removeChild(c, uid); }).setAttribute('data-out', uid);
      });
      add(box, 'b', 'The class board');
      if (!boardLines(box, c.cards, { roster: c.roster, isRude: rude }, B.weekKey(today()), function (r, row) { removeOne(c, r, row); })) {
        add(box, 'div', c.doc.on === true ? 'No entries yet.' : 'The class board is not switched on.', 'empty');
      }
      var tools = add(box, 'div');
      tools.setAttribute('style', 'margin-top:8px;');
      button(tools, 'New race key', 'btn-ghost', function () {
        run(function () { return freshKey(c).then(function () { say('New race key set for ' + nameOf(c) + '. A race lobby that is open now needs opening again.'); }); });
      }).setAttribute('data-newkey', c.id);
      add(tools, 'span', ' ');
      button(tools, 'Close this class', 'btn-ghost', function () { close(c); }).setAttribute('data-close', c.id);
    }
    function drawAll() {
      el.textContent = ''; statusEl = null;
      add(el, 'h2', CLASSES_TITLE);
      var card = add(el, 'div', '', 'card');
      CLASS_TEXT.forEach(function (t) { add(card, 'p', t, 'muted'); });
      if (st.noRules) { warn(card, RULES_NOTE); return; }
      var form = add(card, 'div'), lab = add(form, 'label', 'Create a class: '), nm = input(lab, 'text');
      nm.setAttribute('placeholder', 'a name for your own list'); nm.setAttribute('maxlength', '24'); nm.setAttribute('data-gs', 'clsname');
      nm.value = st.typed;
      nm.addEventListener('input', function () { st.typed = nm.value; });
      add(form, 'span', ' ');
      button(form, 'Create', 'btn-act', function () { create(nm.value); }).setAttribute('data-gs', 'mkclass');
      add(form, 'div', NAME_HELP, 'muted');
      /* this card is not redrawn by the page's own refresh: a grown-up waiting for a request looks again here */
      button(card, 'Look for new requests', 'btn-ghost', function () {
        run(function () { return load().then(function () { drawAll(); say('Up to date.'); }); });
      }).setAttribute('data-gs', 'clsload');
      statusEl = add(card, 'span', st.note, 'muted');
      statusEl.setAttribute('role', 'status'); statusEl.setAttribute('style', 'margin-left:8px;');
      st.classes.forEach(function (c) { drawClass(card, c); });
      if (st.closed.length) add(card, 'p', 'Closed, and never to be used again: ' + st.closed.join(', ') + '.', 'muted');
    }

    var ready = run(function () {
      var host = d.isAdmin ? Promise.resolve(true) : isClassHost(fdb, me);
      return host.then(function (ok) {
        if (!ok) return null;
        return load().then(null, function (e) {
          if (!e || e.code !== 'permission-denied') throw e;
          st.noRules = true;
        }).then(drawAll, function () {
          drawAll();
          say('Your classes could not be read just now. Check the connection, then press Refresh.');
        });
      });
    });
    return { ready: ready, idle: function () { return st.chain; } };
  }

  var API = {
    V: V, EMAIL_DOMAIN: EMAIL_DOMAIN, PROBE_APP: PROBE_APP, PARENT_TEXT: PARENT_TEXT, MAX_CLASSES: MAX_CLASSES, MAX_KIDS: MAX_KIDS,
    saveFamily: saveFamily, untick: untick, removeEntry: removeEntry, deleteFamilyBoard: deleteFamilyBoard, newRaceKey: newRaceKey,
    joinClass: joinClass, leaveClass: leaveClass, classCreate: classCreate, classAdd: classAdd, classRemove: classRemove,
    classSwitch: classSwitch, classClose: classClose,
    applyOps: applyOps, probe: probe, setPassword: setPassword, mountFamily: mountFamily, mountClasses: mountClasses, isClassHost: isClassHost
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLControlSocial = API;
})();
