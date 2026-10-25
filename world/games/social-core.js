/* ================================================================
   Games together — who a child is to other children (pure: no DOM,
   no storage, no network, no clock; randomness only through the
   getRandomValues argument). Classic UMD: window.SLSocialCore in
   the browser, module.exports in Node.

   The one place that decides what one child may see of another: a
   shown name (made from a username by the Control Centre, cleaned
   again whenever it is read back from a roster), avatar and colour
   as index numbers, the tick list a grown-up keeps on the family
   record, the roster that grown-up approves, seat tags for a shared
   race, class codes, and the release switches. Boards, races and
   the Control Centre all call this file; none builds a name itself.

   Anything read from Firestore or received from another device is
   data from a stranger. Every function here takes garbage without
   throwing and fails closed: 'Player', index 0, not ticked, not
   bound. The two that make secrets (newKey, newNonce) and classCode
   throw instead of handing back a weak value.

   Games never award or spend anything: nothing here changes a
   child's balance or their island.

     V, ON                       shape version; release switches {boards, race, classes, duels}
     AVATARS, COLORS             the app's own lists (index.html), sent as index numbers
     NAME_RE, NAME_SRC, NAME_MAX a first name: 1 to 12 letters (accented ones too: the island's
                                 own letters, À to ÿ), with a - or ' between two letters
                                 (Zoë, Élodie, Mary-Jane, D'Arcy); the rules check NAME_SRC and NAME_MAX
     EXTRA_INSIDE                strings no real first name contains
     rudeFrom(core)              → isRude(name), from SLWorldCore plus EXTRA_INSIDE (accents folded first)
     firstName(text)             the first name at the start of a text, capitalised; '' if none
     displayName(username, {plain, isRude})     the Control Centre's 'Shown as' text
     cleanName(raw, fallback, isRude)           a name read from a roster or a request
     avatarIndex, avatarAt, colorIndex, colorAt, who(profile) → {ai, ci}
     gamesCfg(familyDoc)         the games field with safe defaults
     memberOk(games, uid)        ticked AND has its own password (the rules' kidOk)
     gamesPatch(current, change, nowMs) → {games, refused}    the whole field to save
     rosterDoc(games, accounts, plain, isRude) → {roster, clashes}
     rosterName(roster, uid, fallback, isRude)
     seatTag(raceKey, uid), tagMap(raceKey, roster)
     bound(env), cacheKey(env)   the one gate every cloud feature uses
     newKey, newNonce, classCode (each takes getRandomValues), CLASS_RE, CLASS_WORDS, classLabel
     passwordOk(password, username)
     accountRow(userDoc, nowMs, {plain, isRude})   the Control Centre's row for one account
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLSocialCore) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLSocialCore;
    return;
  }

  var V = 1;
  /* release switches: each feature checks its flag first. Setting one to false and
     redeploying switches that feature off once a device has picked up the new files.
     duels (kids update, KG8): the challenges in Debut Run, Encore Shootout and Neon Grand
     Prix. The host offers them only while it is true (cfg.duels), and the challenge files
     stop at ON.duels === false. A family's challenges follow its games.race ('Race
     together and challenges' in the Control Centre) and a class's follow its races; there
     is no games field of their own and no code rooms (KU14). */
  var ON = { boards: true, race: true, classes: true, duels: true };

  /* the app's own avatar and colour lists (index.html; a test parses that file and compares) */
  var AVATARS = Object.freeze(['😀', '😎', '🦄', '🐯', '🐼', '🐵', '🦊', '🐸', '🐙', '🦖', '🦕', '🐳', '🐝', '🦉', '🐨', '🦁', '🐶', '🐱', '⭐', '🚀', '🌈', '🍭', '🍕', '🎈']);
  var COLORS = Object.freeze(['#ff5aa3', '#6c5ce7', '#2ecc71', '#f6c244', '#00b4d8', '#ff9f43', '#a55eea', '#26de81']);

  /* A first name (E9): letters, accented ones too (the island's own pet-name letters, so its word
     check reads every one of them), with a hyphen or an apostrophe only between two letters, 12
     characters at most. NAME_SRC is the pattern the security rules use for a request's name, next
     to n.size() <= NAME_MAX (their regular expressions have no look-ahead); NAME_RE adds the length. */
  var LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿ';      /* A-Z, a-z, À-Ö, Ø-ö, ø-ÿ (not × or ÷) */
  var NAME_MAX = 12;
  var NAME_SRC = '^[' + LETTERS + "]+(?:[-'][" + LETTERS + ']+)*$';
  var NAME_RE = new RegExp('^(?=.{1,' + NAME_MAX + '}$)' + NAME_SRC.slice(1));
  var LETTER_RE = new RegExp('^[' + LETTERS + ']$');
  var LEAD_RE = new RegExp(NAME_SRC.slice(0, -1));                    /* the same, at the start of a longer text */
  var CLASS_RE = /^[A-Z]{10}[0-9]{4}$/;  /* and for a class id */
  /* an account id as a map key: no dot, slash or space, and never '__proto__' */
  var UID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var DAY_MS = 86400000, NEW_DAYS = 7;
  var AUTO_TAIL = '.summerlab';          /* the automatic password is the username + this */

  /* On top of the island's own word check: strings that are never part of a real first
     name, matched anywhere inside the lower-cased name. Short and severe on purpose; a
     test runs 200 common first names (Cassie, Hassan, Whately, Hatem …) through it. */
  var EXTRA_INSIDE = Object.freeze(['stupid', 'idiot', 'dumb', 'loser', 'ugly', 'ihate', 'sexy', 'asshole', 'arsehole', 'dickhead',
    'crap', 'piss', 'cunt', 'wank', 'slut', 'whore', 'penis', 'nigg', 'retard']);

  /* 20 five-letter animals for class codes. No two differ by fewer than 3 letters, so a
     mistyped letter never lands on another word. Children see only the first one, as
     'Otter class'; a typed class name never reaches them. */
  var CLASS_WORDS = Object.freeze(['OTTER', 'TIGER', 'PANDA', 'KOALA', 'ZEBRA', 'EAGLE', 'ROBIN', 'LLAMA', 'CAMEL', 'BISON',
    'LEMUR', 'RHINO', 'MOOSE', 'GECKO', 'TAPIR', 'HERON', 'RAVEN', 'FINCH', 'STORK', 'OKAPI']);

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function isUid(s) { return typeof s === 'string' && UID_RE.test(s); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  /* one letter in the other case, only when that is still one of the name letters (ß, ÿ and the
     like have no single capital among them, so they stay as they are) */
  function cased(ch, upper) {
    var c = upper ? ch.toUpperCase() : ch.toLowerCase();
    return c.length === 1 && LETTER_RE.test(c) ? c : ch;
  }
  /* Capital first, and after a hyphen; after an apostrophe only when one letter comes before it
     (D'Arcy, Ma'ayan); every other letter small. */
  function capName(s) {
    var out = '', up = true, run = 0, i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (ch === '-' || ch === "'") { out += ch; up = ch === '-' || run === 1; run = 0; continue; }
      out += cased(ch, up); up = false; run++;
    }
    return out;
  }
  /* the same letters however a keyboard made them: composed (an iPad may send e + ¨ for ë), and
     the tablet's curly apostrophe and the typographer's hyphens as plain ones */
  function tidy(text) {
    var s = text;
    try { s = s.normalize('NFC'); } catch (e) {}
    return s.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u2010\u2011]/g, '-');
  }
  /* the plain letters of a name, for the inside-a-word checks: é → e, ø → o, æ → ae, ß → ss, so
     an accent can never hide a word the check knows */
  var FOLD = { '\u00E6': 'ae', '\u00F8': 'o', '\u00DF': 'ss', '\u00F0': 'd', '\u00FE': 'th' };
  function fold(name) {
    var s = name.toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return s.replace(/[\u00E6\u00F8\u00DF\u00F0\u00FE]/g, function (c) { return FOLD[c]; });
  }

  /* ---------- names ---------- */
  /* rudeFrom(SLWorldCore) → isRude(name). True when the island's pet-name check refuses the
     name (as written, or with its accents folded away) or it contains an EXTRA_INSIDE string.
     With no check to call, every name is rude. */
  function rudeFrom(core) {
    var ready = !!core && typeof core.validatePetName === 'function';
    function ok(n) {
      var res = null;
      try { res = core.validatePetName(n); } catch (e) { return false; }
      return !!res && res.ok === true;
    }
    return function (name) {
      if (!ready || typeof name !== 'string') return true;
      var plain = fold(name);
      if (!ok(name) || (plain !== name.toLowerCase() && !ok(plain))) return true;
      var low = plain.replace(/[^a-z]/g, '');
      for (var i = 0; i < EXTRA_INSIDE.length; i++) if (low.indexOf(EXTRA_INSIDE[i]) >= 0) return true;
      return false;
    };
  }
  /* only an explicit 'not rude' lets a name through; a checker that throws counts as rude */
  function rude(isRude, name) {
    try { return isRude(name) !== false; } catch (e) { return true; }
  }
  /* The first name at the start of a text: letters (accented ones too) with a hyphen or an
     apostrophe between two of them, 12 characters at most (a cut never ends on a hyphen or an
     apostrophe), capitalised. '' when the text does not start with a letter. 'zoë_smith' →
     'Zoë', 'mary-jane99' → 'Mary-Jane', 'Élodie Martin' → 'Élodie'. */
  function firstName(text) {
    var t = typeof text === 'string' ? tidy(text) : '', m = LEAD_RE.exec(t), s, next;
    if (!m) return '';
    /* a letter these do not cover comes next (Dvořák, Łukasz): no name, rather than a cut one */
    next = t.charAt(m[0].length);
    if (next && (next.toLowerCase() !== next.toUpperCase() || /[̀-ͯ]/.test(next))) return '';
    s = m[0].slice(0, NAME_MAX).replace(/[-']+$/, '');
    return NAME_RE.test(s) ? capName(s) : '';
  }
  /* The 'Shown as' text for an account: the first name at the start of the username (see
     firstName). 'Player' when the grown-up chose that, when no letter is left, when the name
     is rude or when there is no checker. Control Centre only: a child's device never makes a
     shown name, it only reads one from the roster. */
  function displayName(username, opts) {
    var o = isObj(opts) ? opts : {};
    if (o.plain || typeof o.isRude !== 'function' || typeof username !== 'string') return 'Player';
    var name = firstName(username);
    if (!name) return 'Player';
    return rude(o.isRude, name) ? 'Player' : name;
  }
  /* A name read from a roster or a request: kept only if it is a first name (NAME_RE, once
     composed) and not rude, then re-capitalised. Anything else is the fallback ('Player' on a
     board, 'Racer 3' in a race). */
  function cleanName(raw, fallback, isRude) {
    var fb = typeof fallback === 'string' ? fallback : 'Player', s;
    if (typeof raw !== 'string' || raw.length > 4 * NAME_MAX || typeof isRude !== 'function') return fb;
    s = raw;
    try { s = s.normalize('NFC'); } catch (e) {}
    if (!NAME_RE.test(s)) return fb;
    var name = capName(s);
    return rude(isRude, name) ? fb : name;
  }

  /* ---------- avatar and colour as index numbers ---------- */
  function indexIn(list, v) { var i = typeof v === 'string' ? list.indexOf(v) : -1; return i < 0 ? 0 : i; }
  function entryAt(list, i) {
    var n = typeof i === 'number' && isFinite(i) ? Math.floor(i) : 0;
    return list[n < 0 ? 0 : n > list.length - 1 ? list.length - 1 : n];
  }
  function avatarIndex(emoji) { return indexIn(AVATARS, emoji); }
  function avatarAt(i) { return entryAt(AVATARS, i); }
  function colorIndex(hex) { return indexIn(COLORS, typeof hex === 'string' ? hex.toLowerCase() : hex); }
  function colorAt(i) { return entryAt(COLORS, i); }
  /* what a child's device sends about itself: two index numbers and nothing else */
  function who(profile) {
    var p = isObj(profile) ? profile : {};
    return { ai: avatarIndex(p.avatar), ci: colorIndex(p.color) };
  }

  /* ---------- the games field on the family record ---------- */
  /* own keys that are account ids with a true / false value; everything else is dropped */
  function boolMap(m) {
    var out = {};
    if (isObj(m)) Object.keys(m).forEach(function (k) { if (isUid(k) && typeof m[k] === 'boolean') out[k] = m[k]; });
    return out;
  }
  /* the games field with safe defaults. Never throws, whatever the family record holds. */
  function gamesCfg(familyDoc) {
    var g = isObj(familyDoc) && isObj(familyDoc.games) ? familyDoc.games : {};
    return {
      v: V,
      boards: g.boards === 'off' || g.boards === 'family' ? g.boards : 'device',
      race: g.race === true,
      relay: g.relay === true,
      order: g.order === 'az' ? 'az' : 'ranked',
      members: boolMap(g.members),
      pw: boolMap(g.pw),
      hide: boolMap(g.hide),
      setAt: isInt(g.setAt) && g.setAt >= 0 ? g.setAt : 0
    };
  }
  /* callers hold either the games field or the whole family record: take both */
  function cfgOf(x) { return gamesCfg(isObj(x) && isObj(x.games) ? x : { games: x }); }
  /* ticked by the grown-up AND found by their Control Centre to have its own password */
  function memberOk(games, uid) {
    if (!isUid(uid)) return false;
    var g = cfgOf(games);
    return g.members[uid] === true && g.pw[uid] === true;
  }
  /* The complete games field to save, built from the freshly read one plus the changes
     on screen: change = {boards, race, relay, order, tick: {uid: bool}, pw: {uid: bool},
     hide: {uid: bool}}, each part optional. Values it was not asked to change carry over.
     Unticking writes false (a merge cannot take a map key away). An account with no
     password of its own, or a hidden one, is never left ticked: a tick asked for it, or
     an old one still standing, is undone and listed in refused. Setting pw false or hide
     true unticks without being listed. The output holds account ids, true / false, two
     mode words and a time, and nothing else. */
  function gamesPatch(current, change, nowMs) {
    var g = cfgOf(current), c = isObj(change) ? change : {};
    var asked = {}, stopped = {}, refused = [];
    function each(m, fn) {
      if (isObj(m)) Object.keys(m).forEach(function (k) { if (isUid(k) && typeof m[k] === 'boolean') fn(k, m[k]); });
    }
    if (c.boards === 'off' || c.boards === 'device' || c.boards === 'family') g.boards = c.boards;
    if (typeof c.race === 'boolean') g.race = c.race;
    if (typeof c.relay === 'boolean') g.relay = c.relay;
    if (c.order === 'ranked' || c.order === 'az') g.order = c.order;
    each(c.pw, function (uid, on) { g.pw[uid] = on; if (!on) { g.members[uid] = false; stopped[uid] = true; } });
    each(c.hide, function (uid, on) { g.hide[uid] = on; if (on) { g.members[uid] = false; stopped[uid] = true; } });
    each(c.tick, function (uid, on) {
      g.members[uid] = on;
      if (on) asked[uid] = true; else stopped[uid] = true;
    });
    /* the standing rule, for every tick old and new: its own password, and not hidden */
    Object.keys(g.members).forEach(function (uid) {
      if (g.members[uid] !== true || (g.pw[uid] === true && g.hide[uid] !== true)) return;
      g.members[uid] = false;
      if (has(asked, uid) || !has(stopped, uid)) refused.push(uid);
    });
    if (isInt(nowMs) && nowMs >= 0) g.setAt = nowMs;
    return { games: g, refused: refused };
  }

  /* ---------- the roster a grown-up approves ---------- */
  /* accounts = [{uid, username}] (a users record with _uid works too), plain = {uid: true}
     for 'show as Player'. The roster lists ticked accounts only, each with the exact
     'Shown as' text; a name is never invented. clashes lists the accounts whose shown name
     another ticked account also has: the caller must not save until one of each pair is
     set to Player. Any number of accounts may be Player. */
  function rosterDoc(games, accounts, plain, isRude) {
    var g = cfgOf(games), pl = isObj(plain) ? plain : {};
    var names = {}, rows = [], count = {};
    (Array.isArray(accounts) ? accounts : []).forEach(function (a) {
      if (!isObj(a)) return;
      var uid = isUid(a.uid) ? a.uid : a._uid;
      if (!isUid(uid) || has(names, uid)) return;
      if (g.members[uid] !== true || g.pw[uid] !== true || g.hide[uid] === true) return;
      var n = displayName(a.username, { plain: pl[uid] === true, isRude: isRude });
      names[uid] = { n: n };
      rows.push({ uid: uid, username: typeof a.username === 'string' ? a.username : '', n: n });
      if (n !== 'Player') count[n] = (has(count, n) ? count[n] : 0) + 1;
    });
    return {
      roster: { v: V, who: names },
      clashes: rows.filter(function (r) { return r.n !== 'Player' && count[r.n] > 1; })
    };
  }
  /* the name to show for an account: from the roster and nowhere else, cleaned once more */
  function rosterName(roster, uid, fallback, isRude) {
    var fb = typeof fallback === 'string' ? fallback : 'Player';
    var w = isObj(roster) && isObj(roster.who) ? roster.who : null;
    if (!w || typeof uid !== 'string' || !has(w, uid) || !isObj(w[uid])) return fb;
    return cleanName(w[uid].n, fb, isRude);
  }

  /* ---------- seat tags ---------- */
  /* FNV-1a, 32 bits, whole-number maths only (Math.imul), so Chrome, Safari and Node agree */
  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function str(x) { return typeof x === 'string' ? x : ''; }
  /* Which roster entry a device says it is, without sending a name or an account id:
     8 hex digits. It proves nothing by itself; the lobby ticket does that. */
  function seatTag(raceKey, uid) {
    return ('0000000' + fnv1a('slkart1|' + str(raceKey) + '|' + str(uid)).toString(16)).slice(-8);
  }
  /* {tag: uid} for every roster entry. Two entries with the same tag are both left out,
     so a clash can never seat one child under another's name. No race key, no tags. */
  function tagMap(raceKey, roster) {
    var out = {}, twice = {};
    var w = isObj(roster) && isObj(roster.who) ? roster.who : {};
    if (typeof raceKey !== 'string' || !raceKey) return out;
    Object.keys(w).forEach(function (uid) {
      if (!isUid(uid)) return;
      var t = seatTag(raceKey, uid);
      if (has(twice, t)) return;
      if (has(out, t)) { delete out[t]; twice[t] = true; return; }
      out[t] = uid;
    });
    return out;
  }

  /* ---------- the cloud gate ---------- */
  /* env = {firebaseReady, cloudState, activeUser, profileKey}. ok only for a signed-in
     account that is not a guest, has a family code, and whose bound profile is both the
     active profile and the profile that launched the game. Callers ask again each time
     they draw: a second profile on a shared tablet must get 'otherprofile'. */
  function bound(env) {
    var e = isObj(env) ? env : {};
    if (!e.firebaseReady) return { ok: false, why: 'nofirebase' };
    var cs = isObj(e.cloudState) ? e.cloudState : {};
    var user = isObj(cs.user) ? cs.user : null, doc = isObj(cs.doc) ? cs.doc : {};
    if (!user || !isUid(user.uid)) return { ok: false, why: 'signedout' };
    if (user.isAnonymous || doc.anon) return { ok: false, why: 'anon' };
    if (typeof doc.familyCode !== 'string' || !doc.familyCode) return { ok: false, why: 'nofamily' };
    var name = cs.boundName;
    if (typeof name !== 'string' || !name || name !== e.activeUser || name !== e.profileKey) return { ok: false, why: 'otherprofile' };
    return { ok: true, uid: user.uid, username: typeof doc.username === 'string' && doc.username ? doc.username : name, familyCode: doc.familyCode };
  }
  /* the key every in-memory list, roster and race key is held under; '' when not bound */
  function cacheKey(env) {
    var b = bound(env);
    return b.ok ? b.uid + '|' + env.profileKey : '';
  }

  /* ---------- keys, room numbers and class codes ---------- */
  /* getRandomValues is the browser's own, passed in already bound:
     function (a) { return crypto.getRandomValues(a); }. There is no fallback to a weaker
     source: without it, or if it fills nothing, these throw. */
  function randomBytes(n, getRandomValues) {
    if (typeof getRandomValues !== 'function') throw new Error('SLSocialCore: getRandomValues is needed');
    var a = new Uint8Array(n), any = false;
    getRandomValues(a);
    for (var i = 0; i < n; i++) if (a[i]) any = true;
    if (!any) throw new Error('SLSocialCore: the random source gave nothing');
    return a;
  }
  function hexOf(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }
  function newKey(getRandomValues) { return hexOf(randomBytes(16, getRandomValues)); }     /* a race key: 32 hex */
  function newNonce(getRandomValues) { return hexOf(randomBytes(8, getRandomValues)); }    /* a room or ticket number: 16 hex */
  /* two animal words and four digits 1000 to 9999, for example 'OTTERTIGER4821'; every
     code is equally likely (a draw outside a whole number of rounds is thrown away) */
  function classCode(getRandomValues) {
    var pool = [], at = 0, refills = 0;
    function below(n) {
      var lim = 65536 - 65536 % n;
      for (;;) {
        if (at + 2 > pool.length) {
          if (++refills > 8) throw new Error('SLSocialCore: the random source is stuck');
          pool = randomBytes(16, getRandomValues); at = 0;
        }
        var v = pool[at] * 256 + pool[at + 1];
        at += 2;
        if (v < lim) return v % n;
      }
    }
    var first = CLASS_WORDS[below(CLASS_WORDS.length)], second = CLASS_WORDS[below(CLASS_WORDS.length)];
    return first + second + (1000 + below(9000));
  }
  /* what children and other parents see for a class: 'Otter class'. '' unless both words
     are from the list, so a hand-made class id can never put its own word on a screen. */
  function classLabel(code) {
    if (typeof code !== 'string' || !CLASS_RE.test(code)) return '';
    var first = code.slice(0, 5);
    if (CLASS_WORDS.indexOf(first) < 0 || CLASS_WORDS.indexOf(code.slice(5, 10)) < 0) return '';
    return cap(first) + ' class';
  }

  /* ---------- the Control Centre's helpers ---------- */
  /* a password a grown-up types for an account: 8 characters or more, without the username
     in it (any case), and never the automatic form */
  function passwordOk(password, username) {
    if (typeof password !== 'string' || password.length < 8) return false;
    if (typeof username !== 'string' || !username) return false;
    var p = password.toLowerCase(), u = username.toLowerCase();
    if (p.indexOf(u) >= 0 || p === u + AUTO_TAIL) return false;
    return p.slice(-AUTO_TAIL.length) !== AUTO_TAIL;
  }
  /* the day a moment falls on, as the island counts days (UK time, like SLWorldCore.dayKey) */
  function dayOf(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return '';
    var d = new Date(ms), s = '';
    if (isNaN(d.getTime())) return '';
    try {
      s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) { s = ''; }
    if (!DAY_RE.test(s)) s = d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
    return DAY_RE.test(s) ? s : '';
  }
  /* One row of the games card, from a users record the Control Centre already loaded:
     what the grown-up already receives about that account, so a real child is easy to
     tell from an account made yesterday. shownAs is 'Player' unless {plain, isRude} is
     given. isNew: first seen under 7 days ago, or no recorded play, or no way to tell.
     The balance is only read, for the grown-up's eyes; nothing here changes it. */
  function accountRow(userDoc, nowMs, opts) {
    var d = isObj(userDoc) ? userDoc : {}, st = isObj(d.state) ? d.state : {}, o = isObj(opts) ? opts : {};
    var username = typeof d.username === 'string' ? d.username : '';
    var days = isObj(st.usage) && isObj(st.usage.days) ? st.usage.days : {};
    var played = 0;
    Object.keys(days).forEach(function (k) { if (DAY_RE.test(k) && typeof days[k] === 'number' && days[k] > 0) played++; });
    var first = typeof st.created === 'string' ? Date.parse(st.created) : typeof st.created === 'number' ? st.created : NaN;
    var seen = isFinite(first) && first > 0, clock = typeof nowMs === 'number' && isFinite(nowMs);
    var pts = st['points'];
    return {
      uid: isUid(d._uid) ? d._uid : isUid(d.uid) ? d.uid : '',
      username: username,
      shownAs: displayName(username, { plain: o.plain === true, isRude: o.isRude }),
      points: typeof pts === 'number' && isFinite(pts) && pts > 0 ? Math.floor(pts) : 0,
      lastSyncDay: dayOf(d.updatedAt),
      playedDays: played,
      firstSeenDay: seen ? dayOf(first) : '',
      isNew: !seen || !clock || nowMs - first < NEW_DAYS * DAY_MS || played === 0
    };
  }

  var API = {
    V: V, ON: ON, AVATARS: AVATARS, COLORS: COLORS, NAME_RE: NAME_RE, NAME_SRC: NAME_SRC, NAME_MAX: NAME_MAX, EXTRA_INSIDE: EXTRA_INSIDE,
    rudeFrom: rudeFrom, firstName: firstName, displayName: displayName, cleanName: cleanName,
    avatarIndex: avatarIndex, avatarAt: avatarAt, colorIndex: colorIndex, colorAt: colorAt, who: who,
    gamesCfg: gamesCfg, memberOk: memberOk, gamesPatch: gamesPatch, rosterDoc: rosterDoc, rosterName: rosterName,
    seatTag: seatTag, tagMap: tagMap, bound: bound, cacheKey: cacheKey,
    newKey: newKey, newNonce: newNonce, classCode: classCode, CLASS_RE: CLASS_RE, CLASS_WORDS: CLASS_WORDS, classLabel: classLabel,
    passwordOk: passwordOk, accountRow: accountRow
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLSocialCore = API;
})();
