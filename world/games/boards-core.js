/* ================================================================
   Game boards — the rules (pure: no DOM, no network, no clock, and
   nothing kept on the device). Classic UMD: window.SLBoardsCore in
   the browser (load after social-core.js), module.exports in Node.

   A board ranks game times and scores, and nothing else: one board
   per course, rival or kart course, keyed like a personal best
   (game + ':' + variant), this week (Monday to Sunday) and best
   ever. Games never award or spend anything; nothing here changes a
   child's balance or their island.

   Every writer and every reader goes through this file, so a value
   outside a board's limits is never written and never shown. A card
   read from the database is data from a stranger: it is checked
   entry by entry, it never carries a name (a name comes from the
   roster a grown-up approved, through SLSocialCore.rosterName), and
   avatar and colour are index numbers.

   Kindness (standings and moveLine): ties share a place; on a list
   of 2 to 5 nobody on the bottom place is given a number; a child
   outside a top 10 sees their own row with no place; 'az' order has
   no places at all; a results line is good news or a near miss,
   never a place out of a count and never a move down.

     V, BOARDS, KEYS, MAX_CARDS  the 15 boards {key, game, variant, name, better, min, max,
                                 step, classic, watchBelow}; the query limit (40 others and the child)
     CARD_KEYS, RANGES           what the security rules accept in a card (a test pins both to firestore.rules)
     boards(game), rule(key)     rows for one game in display order; one row or null
     validValue(key, v)          a whole number inside the board's own limits, on its step
     better(key, a, b)           true when a beats b on that board
     weekKey('YYYY-MM-DD')       → the Monday of that week, or null
     notebook(u)                 → a copy of u.lb with defaults (extra fields are kept)
     noteResult(lb, key, v, week) → {lb, weekImproved, everImproved}
     applyCuts(lb, scope, rmForMe, week) → lb      scope is 'family' or 'class'
     removedNote(lb, scope, key, period, week) → true while 'your grown-up took this one off' is current
     tally(lb, day, what)        → {lb, ok}  the daily caps: what is 'w' (card writes) or 'r' (reads); ok: room for one more
     spend(lb, day, what, n)     → lb        n more counted for the day (reads, after the call that made them)
     desiredCard(u, who, cloudCard, week, scope, rmForMe) → {card, changed} or {off: true}
     markerCard(who, week)       the 'Take me off the boards' card
     cardShapeOk(card)           the mirror of the rules' cardShape
     standings(cards, key, period, week, {roster, isRude, me, top, order, games, local}) → {rows, count}
     moveLine(before, after, {key, period, group, order}) → {text, kind} or null;  LINE_KINDS
     patchRow(cards, uid, card)  → cards with that child's own card replaced
     showValue(key, v)           a board value as a child reads it: '1:22.40' (the game's own m:ss.xx), '2,995'
     sayValue(key, v)            the same, spoken: '1 minute 22.40 seconds', '2,995'
     fmtValue(key, v), ordinal(n) fmtValue: '82.40 s' (a gap between two times; the Control Centre's rows)

   cards is a list of {uid, card}. The three notebook functions and
   tally return new objects: the caller keeps them through its own
   commit. It must keep what applyCuts returns as soon as it has read
   the removal counts: only then does noteResult know the board had
   a removal, and the child's next result can post. noteResult's
   everImproved speaks only for such a board (the notebook's own
   'best since the removal'); on any other board the best ever is
   the island's personal best, and the island has already said
   whether that improved.
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLBoardsCore) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLBoardsCore;
    return;
  }
  var SC0 = null;
  if (typeof module === 'object' && module.exports) { try { SC0 = require('./social-core.js'); } catch (e) { SC0 = null; } }
  /* looked up at each call, so the order two script tags finish in does not matter */
  function social() { return SC0 || (typeof window !== 'undefined' && window.SLSocialCore) || null; }

  var V = 1;
  var MAX_CARDS = 41;            /* the list query's limit: 40 others and the child */
  var AI_MAX = 23, CI_MAX = 7;   /* the app's 24 avatars and 8 colours, as the rules count them */
  var KIND_MAX = 5;              /* up to this many on a list, the bottom place has no number */
  var NEAR_MS = 2000, NEAR_PART = 0.1;   /* a near miss: within 2 s on a kart board, within 10% on a score board */
  /* per profile per day: card writes, and reads as Firestore bills them (every record a call
     reads, a list at least 1, and the records the security rules look up for it; the caller
     counts them). 600 reads is several hours of family play or about an hour and a half of
     busy class play; past it the boards rest until the next day and play goes on */
  var CAPS = { w: 40, r: 600 };
  var KART_MAX = 1800000;        /* 30 minutes */

  function score(game, variant, name, max, step) {
    var r = { key: game + ':' + variant, game: game, variant: variant, name: name, better: 'higher', min: 0, max: max };
    if (step) r.step = step;
    return r;
  }
  /* min is the course's floor: centreline length × laps ÷ top speed (kart-logic floorMs; a
     test compares). watchBelow = round(0.95 × the Holo time): the Control Centre adds a note
     beside a faster time. The new courses get theirs when the courses are frozen. */
  function kart(variant, name, floor, classic, watchBelow) {
    var r = { key: 'kart:' + variant, game: 'kart', variant: variant, name: name, better: 'lower', min: floor, max: KART_MAX };
    if (classic) r.classic = true;
    if (watchBelow) r.watchBelow = watchBelow;
    return r;
  }
  /* The boards, in display order. Not built from the island's catalogue: the new kart
     courses are not in it, and the Control Centre does not load the kart logic. A row
     marked unshipped: true keeps its key (the rules list it) but is never written or shown. */
  var BOARDS = [
    score('course', 'course_meadow', 'Meadow Dash', 5000),
    score('course', 'course_beach', 'Beach Run', 5000),
    score('course', 'course_snow', 'Snowy Trail', 5000),
    score('course', 'course_candy', 'Candy Land', 5000),
    score('penalty', 'std', 'Mochi', 1200, 10),
    score('penalty', 'rival_bop', 'Bop', 1200, 10),
    score('penalty', 'rival_glowy', 'Glowy', 1200, 10),
    score('penalty', 'rival_flip', 'Flip', 1200, 10),
    kart('track_loop_remix', 'Island Loop Remix', 40593),
    kart('track_volcano_remix', 'Volcano Ring Remix', 45465),
    kart('track_beach_remix', 'Beach Hairpins Remix', 50700),
    kart('track_star', 'Starlight Twist', 47900),
    kart('track_loop', 'Island Loop (classic)', 40593, true, 44270),
    kart('track_volcano', 'Volcano Ring (classic)', 45465, true, 49970),
    kart('track_beach', 'Beach Hairpins (classic)', 51319, true, 63650)
  ];
  var BY_KEY = {};
  BOARDS.forEach(function (r) { BY_KEY[r.key] = Object.freeze(r); });
  var KEYS = Object.freeze(BOARDS.map(function (r) { return r.key; }));
  Object.freeze(BOARDS);

  /* what the security rules accept in a card: its fields, and one coarse range per game.
     The exact kart floors live in BOARDS, so a floor can move without a rules change. */
  var CARD_KEYS = Object.freeze(['v', 'ai', 'ci', 'best', 'wk', 'at', 'off']);
  var RANGES = Object.freeze({ course: Object.freeze([0, 5000]), penalty: Object.freeze([0, 1200]), kart: Object.freeze([30000, KART_MAX]) });
  var WEEK_RE = /^20[0-9][0-9]-[0-1][0-9]-[0-3][0-9]$/;   /* the rules' pattern for a card's week */
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var KEY_RE = /^[a-z]{1,12}:[a-z0-9_]{1,30}$/;            /* the shape of a personal-best key */
  var CLASS_LABEL_RE = /^[A-Z][a-z]{4} class$/;            /* what SLSocialCore.classLabel returns */
  var LINE_KINDS = Object.freeze(['record', 'lead', 'up', 'first', 'near', 'best']);   /* best news first */

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function idx(n, max) { return isInt(n) && n >= 0 && n <= max ? n : 0; }

  /* ---------- the table ---------- */
  function rule(key) { return typeof key === 'string' && has(BY_KEY, key) ? BY_KEY[key] : null; }
  function boards(game) {
    return BOARDS.filter(function (r) { return !r.unshipped && (game == null || r.game === game); });
  }
  function validValue(key, v) {
    var r = rule(key);
    if (!r || r.unshipped || !isInt(v) || v < r.min || v > r.max) return false;
    return !r.step || v % r.step === 0;
  }
  function beats(r, a, b) { return r.better === 'lower' ? a < b : a > b; }
  function better(key, a, b) { var r = rule(key); return !!r && beats(r, a, b); }
  /* the better of two values on a board, counting only values the board accepts; undefined when neither does */
  function pick(r, a, b) {
    var okA = validValue(r.key, a), okB = validValue(r.key, b);
    if (okA && okB) return beats(r, b, a) ? b : a;
    return okA ? a : okB ? b : undefined;
  }

  /* ---------- the week ---------- */
  /* days since 1970-01-01 for a calendar date and back, in whole-number maths: no clock and no time zone */
  function dayNumber(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  }
  function dayText(z) {
    z += 719468;
    var era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9), y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    return ('000' + y).slice(-4) + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  /* The week a day belongs to, named by its Monday: '2026-10-04' (a Sunday) → '2026-09-28'.
     The caller passes the island's own day (server-anchored, in the family's time zone).
     null for anything that is not a real date. */
  function weekKey(day) {
    var m = typeof day === 'string' ? DAY_RE.exec(day) : null;
    if (!m) return null;
    var z = dayNumber(+m[1], +m[2], +m[3]);
    if (dayText(z) !== day) return null;                 /* 2026-02-30, month 13 … */
    return dayText(z - ((z + 3) % 7 + 7) % 7);           /* day 0 was a Thursday */
  }
  /* a week a card may carry: a Monday, in the rules' own pattern */
  function goodWeek(week) { return typeof week === 'string' && WEEK_RE.test(week) && weekKey(week) === week ? week : ''; }

  /* ---------- the child's board notebook (u.lb) ---------- */
  function numMap(m) {
    var out = {};
    if (isObj(m)) Object.keys(m).forEach(function (k) { if (KEY_RE.test(k) && isInt(m[k]) && m[k] >= 0) out[k] = m[k]; });
    return out;
  }
  /* {boardKey: a Monday}: the week each removal was learnt in */
  function weekMap(m) {
    var out = {};
    if (isObj(m)) Object.keys(m).forEach(function (k) { if (KEY_RE.test(k) && goodWeek(m[k])) out[k] = m[k]; });
    return out;
  }
  function flag(x) { return x === 1 || x === true ? 1 : 0; }
  function count(x) { return isInt(x) && x > 0 ? x : 0; }
  /* A copy of u.lb with every known field in its right shape: {v, w, wv, cut: {f, c}, alt,
     off, d, n: {d, w, r}}, and cw: {f, c} (the week each removal was learnt) once there is
     one. Fields this release does not know are carried over untouched, so a newer release's
     notes survive a visit to an older device. Never throws. */
  function notebook(u) {
    var lb = {};
    try { lb = JSON.parse(JSON.stringify(isObj(u) && isObj(u.lb) ? u.lb : {})); } catch (e) { lb = {}; }
    if (!isObj(lb)) lb = {};
    var cut = isObj(lb.cut) ? lb.cut : {}, n = isObj(lb.n) ? lb.n : {};
    lb.v = V;
    lb.w = typeof lb.w === 'string' && weekKey(lb.w) === lb.w ? lb.w : '';
    lb.wv = lb.w ? numMap(lb.wv) : {};
    lb.cut = { f: numMap(cut.f), c: numMap(cut.c) };
    if (has(lb, 'cw')) lb.cw = { f: weekMap(isObj(lb.cw) ? lb.cw.f : null), c: weekMap(isObj(lb.cw) ? lb.cw.c : null) };
    lb.alt = numMap(lb.alt);
    lb.off = flag(lb.off);
    lb.d = flag(lb.d);
    lb.n = { d: typeof n.d === 'string' && weekKey(n.d) ? n.d : '', w: count(n.w), r: count(n.r) };
    return lb;
  }
  function scopeKey(scope) { return scope === 'family' || scope === 'f' ? 'f' : scope === 'class' || scope === 'c' ? 'c' : ''; }
  /* a grown-up has removed this board's entry at some time, in either group */
  function cutAny(lb, key) { return (lb.cut.f[key] || 0) > 0 || (lb.cut.c[key] || 0) > 0; }
  /* Note a finished result (one the island accepted) in a copy of the notebook. A new
     Monday starts a fresh week; a week older than the notebook's is not noted. On a board
     with a removal on record the notebook also keeps the best since that removal. */
  function noteResult(lb, key, v, week) {
    var out = notebook({ lb: lb }), r = rule(key), wk = goodWeek(week);
    var res = { lb: out, weekImproved: false, everImproved: false };
    if (wk && (!out.w || wk > out.w)) { out.w = wk; out.wv = {}; }
    if (!r || !validValue(key, v)) return res;
    if (wk && out.w === wk && (!has(out.wv, key) || beats(r, v, out.wv[key]))) { out.wv[key] = v; res.weekImproved = true; }
    if (cutAny(out, key) && (!has(out.alt, key) || beats(r, v, out.alt[key]))) { out.alt[key] = v; res.everImproved = true; }
    return res;
  }
  /* rmForMe = the removal counts a grown-up keeps for this child ({boardKey: n}, from the
     child's own kids record or class entry). A count higher than the one already applied
     means an entry was removed: remember the new count (and, given the week it was read
     in, that week) and forget this week's value and the best-since-removal for that board,
     so the removed value cannot post again. A count is never lowered. */
  function applyCuts(lb, scope, rmForMe, week) {
    var out = notebook({ lb: lb }), s = scopeKey(scope), rm = isObj(rmForMe) ? rmForMe : {}, wk = goodWeek(week);
    if (!s) return out;
    KEYS.forEach(function (key) {
      var n = has(rm, key) ? rm[key] : 0;
      if (!isInt(n) || n <= (out.cut[s][key] || 0)) return;
      out.cut[s][key] = n;
      if (wk) { if (!isObj(out.cw)) out.cw = { f: {}, c: {} }; out.cw[s][key] = wk; }
      delete out.alt[key];
      delete out.wv[key];
    });
    return out;
  }
  /* Whether a board the child has no row on should say the grown-up took their entry off,
     for one group (scope), board and period, in the week given. 'Best ever': while nothing
     has been noted on that board since the removal. 'This week': only in the week the
     removal was learnt, and only while nothing has been noted on it since. A removal of
     weeks ago is not brought up again. */
  function removedNote(lb, scope, key, period, week) {
    var out = notebook({ lb: lb }), s = scopeKey(scope), wk = goodWeek(week);
    if (!s || !rule(key) || !((out.cut[s][key] || 0) > 0)) return false;
    if (period === 'ever') return !has(out.alt, key);
    return period === 'week' && !!wk && isObj(out.cw) && out.cw[s][key] === wk && !(out.w === wk && has(out.wv, key));
  }
  /* the daily caps: count one card write ('w') or one read ('r') for the island's day.
     ok false means the cap is reached (or the call made no sense) and nothing was counted. */
  function tally(lb, day, what) {
    var out = notebook({ lb: lb });
    if (typeof day !== 'string' || !weekKey(day) || !has(CAPS, what)) return { lb: out, ok: false };
    if (out.n.d !== day) out.n = { d: day, w: 0, r: 0 };
    if (out.n[what] >= CAPS[what]) return { lb: out, ok: false };
    out.n[what]++;
    return { lb: out, ok: true };
  }
  /* n more for the day, counted after the call that made them (a call's reads are known only
     once it has answered), whether or not that takes the count past the cap: the next
     tally then says no. Anything that makes no sense counts nothing. */
  function spend(lb, day, what, n) {
    var out = notebook({ lb: lb });
    if (typeof day !== 'string' || !weekKey(day) || !has(CAPS, what) || !isInt(n) || n <= 0) return out;
    if (out.n.d !== day) out.n = { d: day, w: 0, r: 0 };
    out.n[what] += n;
    return out;
  }

  /* ---------- the card ---------- */
  function okScores(m) {
    if (!isObj(m)) return false;
    return Object.keys(m).every(function (k) {
      var r = rule(k), v = m[k];
      return !!r && isInt(v) && v >= RANGES[r.game][0] && v <= RANGES[r.game][1];
    });
  }
  /* The JavaScript mirror of cardShape in firestore.rules: would the rules take this card?
     'at' is the server's time, added by the writer, so a card without it passes here. */
  function cardShapeOk(card) {
    if (!isObj(card)) return false;
    if (!Object.keys(card).every(function (k) { return CARD_KEYS.indexOf(k) >= 0; })) return false;
    if (card.v !== V || !isInt(card.ai) || card.ai < 0 || card.ai > AI_MAX || !isInt(card.ci) || card.ci < 0 || card.ci > CI_MAX) return false;
    var wk = card.wk;
    if (!okScores(card.best) || !isObj(wk) || Object.keys(wk).length !== 2 || !has(wk, 'id') || !has(wk, 'v')) return false;
    if (typeof wk.id !== 'string' || !WEEK_RE.test(wk.id) || !okScores(wk.v)) return false;
    if (has(card, 'off') && typeof card.off !== 'boolean') return false;
    return !has(card, 'at') || (!!card.at && typeof card.at === 'object');
  }
  function sameMap(a, b) {
    var ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(function (k) { return has(b, k) && b[k] === a[k]; });
  }
  /* the island's personal best for a board, as a plain number */
  function pbValue(pb, r) {
    var rec = has(pb, r.key) ? pb[r.key] : null;
    return isObj(rec) ? (r.better === 'lower' ? rec.ms : rec.score) : undefined;
  }
  /* The card this child should have in one group. u = the profile (u.lb and u.world.pb are
     read, nothing is changed), who = SLSocialCore.who(profile), cloudCard = the child's own
     card as just read (null when there is none), week = this week's Monday, scope 'family'
     or 'class' ('device' builds the card for the This-device board: no removals apply),
     rmForMe = the removal counts read in the same transaction.
       {off: true}        the card is the 'Take me off the boards' marker: write nothing
       {card, changed}    write card (plus the server's time) only when changed is true
     Per board the card keeps the better of what the database holds and what this device has:
     the personal best, or the best since the removal on a board with a removal. A new Monday
     starts a fresh week, and a week another device has already moved on to is never stepped
     back. Values outside a board's limits and unknown keys are left out. No name, ever.
     'Put me back' is this call with cloudCard null. A week that is not a Monday gives
     {card: null, changed: false}. */
  function desiredCard(u, who, cloudCard, week, scope, rmForMe) {
    var cloud = isObj(cloudCard) ? cloudCard : null;
    if (cloud && cloud.off === true) return { off: true };
    var wk = goodWeek(week);
    if (!wk) return { card: null, changed: false };
    var s = scopeKey(scope), w = isObj(who) ? who : {};
    var lb = applyCuts(notebook(u), scope, rmForMe);
    var pb = isObj(u) && isObj(u.world) && isObj(u.world.pb) ? u.world.pb : {};
    var cBest = cloud && isObj(cloud.best) ? cloud.best : {};
    var cWk = cloud && isObj(cloud.wk) && goodWeek(cloud.wk.id) && isObj(cloud.wk.v) ? cloud.wk : null;
    var ahead = !!cWk && cWk.id > wk;
    var card = { v: V, ai: idx(w.ai, AI_MAX), ci: idx(w.ci, CI_MAX), best: {}, wk: { id: ahead ? cWk.id : wk, v: {} } };
    KEYS.forEach(function (key) {
      var r = BY_KEY[key];
      var mine = !ahead && lb.w === wk && has(lb.wv, key) ? lb.wv[key] : undefined;
      var theirs = cWk && cWk.id === card.wk.id && has(cWk.v, key) ? cWk.v[key] : undefined;
      var wv = pick(r, mine, theirs);
      if (wv !== undefined) card.wk.v[key] = wv;
      var dev = s && (lb.cut[s][key] || 0) > 0 ? (has(lb.alt, key) ? lb.alt[key] : undefined) : pbValue(pb, r);
      /* a value set this week is a best-ever candidate too, so the two can never disagree */
      var best = pick(r, pick(r, dev, has(cBest, key) ? cBest[key] : undefined), wv);
      if (best !== undefined) card.best[key] = best;
    });
    var same = !!cloud && cardShapeOk(cloud) && !has(cloud, 'off') && cloud.ai === card.ai && cloud.ci === card.ci &&
      cloud.wk.id === card.wk.id && sameMap(card.best, cloud.best) && sameMap(card.wk.v, cloud.wk.v);
    return { card: card, changed: !same };
  }
  /* the card that stays when a child chose 'Take me off the boards': no scores, and every
     device that reads it stops posting. null when the week is not a real date. */
  function markerCard(who, week) {
    var w = isObj(who) ? who : {}, wk = goodWeek(weekKey(week));
    if (!wk) return null;
    return { v: V, ai: idx(w.ai, AI_MAX), ci: idx(w.ci, CI_MAX), best: {}, wk: { id: wk, v: {} }, off: true };
  }
  /* after a post: the list in memory with this child's card replaced, so it is not read again */
  function patchRow(cards, uid, card) {
    var list = Array.isArray(cards) ? cards.slice() : [], found = false;
    list.forEach(function (c, i) { if (isObj(c) && c.uid === uid) { list[i] = { uid: uid, card: card }; found = true; } });
    if (!found) list.unshift({ uid: uid, card: card });
    return list;
  }

  /* ---------- standings ---------- */
  function byName(a, b) {
    var x = a.n.toLowerCase(), y = b.n.toLowerCase();
    return x < y ? -1 : x > y ? 1 : a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  }
  /* One board, ready to draw. cards = [{uid, card}] as read (the first MAX_CARDS count),
     period 'week' or 'ever', week = this week's Monday.
       roster, isRude   the group's roster and the word check: a row's name is
                        SLSocialCore.rosterName(roster, uid, 'Player', isRude) and nothing else
       games            the family record (or its games field), when the group is a family:
                        read through SLSocialCore.gamesCfg for the order, and a card whose
                        account is no longer ticked is dropped
       order            'ranked' or 'az' (given here it wins over games)
       me               this child's account id; top: show this many rows plus the child's own
       local: true      the This-device board: uid is the profile name as typed on this
                        device and is the row's name; no roster is needed, nothing was sent
     Dropped without comment: a card whose account is not in the roster, a marker card, a
     value outside the board's limits, a card from another week. A name a card carries is
     never read. rows: {uid, place, n, ai, ci, v, me, gap}; place is a number or null and a
     null place must not be shown or worked out; gap is the distance to the next place up
     (null for a leader and in 'az' order). count is everyone on the board. */
  function standings(cards, key, period, week, opts) {
    var o = isObj(opts) ? opts : {}, r = rule(key), S = social(), out = { rows: [], count: 0 };
    var byWeek = period === 'week', wk = byWeek ? goodWeek(week) : '';
    if (!r || r.unshipped || !Array.isArray(cards) || (!byWeek && period !== 'ever') || (byWeek && !wk)) return out;
    var games = !o.local && o.games !== undefined && S ? S.gamesCfg(isObj(o.games) && isObj(o.games.games) ? o.games : { games: o.games }) : null;
    var order = o.order === 'az' || o.order === 'ranked' ? o.order : games ? games.order : 'ranked';
    var who = isObj(o.roster) && isObj(o.roster.who) ? o.roster.who : {}, seen = Object.create(null), rows = [];
    cards.slice(0, MAX_CARDS).forEach(function (c) {
      if (!isObj(c) || typeof c.uid !== 'string' || !c.uid || seen[c.uid]) return;
      var card = c.card, from = isObj(card) ? (byWeek ? (isObj(card.wk) && card.wk.id === wk ? card.wk.v : null) : card.best) : null;
      if (!isObj(from) || (has(card, 'off') && card.off !== false) || !has(from, key) || !validValue(key, from[key])) return;
      var name = 'Player';
      if (o.local === true) name = c.uid.slice(0, 20);
      else {
        if (!has(who, c.uid) || !isObj(who[c.uid])) return;
        if (o.games !== undefined && !(S && S.memberOk(o.games, c.uid))) return;
        if (S) name = S.rosterName(o.roster, c.uid, 'Player', o.isRude);
      }
      seen[c.uid] = true;
      rows.push({ uid: c.uid, place: null, n: name, ai: idx(card.ai, AI_MAX), ci: idx(card.ci, CI_MAX), v: from[key], me: c.uid === o.me, gap: null });
    });
    out.count = rows.length;
    if (order === 'az') { out.rows = rows.sort(byName); return out; }
    rows.sort(function (a, b) { return a.v === b.v ? byName(a, b) : beats(r, a.v, b.v) ? -1 : 1; });
    rows.forEach(function (row, i) {
      var prev = i ? rows[i - 1] : null, tie = !!prev && prev.v === row.v;
      row.place = tie ? prev.place : i + 1;                               /* ties share a place: 1, 2, 2, 4 */
      row.gap = tie ? prev.gap : prev ? Math.abs(row.v - prev.v) : null;
    });
    /* a short list: nobody on the bottom place gets a number (unless everyone is level on 1st) */
    if (rows.length >= 2 && rows.length <= KIND_MAX) {
      var bottom = rows[rows.length - 1].place;
      if (bottom > 1) rows.forEach(function (row) { if (row.place === bottom) row.place = null; });
    }
    /* a long list: the top rows, then the child's own row with no place */
    var top = isInt(o.top) && o.top > 0 ? o.top : 0;
    if (top && rows.length > top) {
      var mine = rows.slice(top).filter(function (row) { return row.me; })[0];
      rows = rows.slice(0, top);
      if (mine) { mine.place = null; rows.push(mine); }
    }
    out.rows = rows;
    return out;
  }

  /* ---------- the results line ---------- */
  function ordinal(n) {
    if (!isInt(n) || n < 1) return '';
    var t = n % 100, u = n % 10;
    return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
  }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function amount(r, n) { return r.game === 'kart' ? (n / 1000).toFixed(2) + ' s' : commas(n); }
  /* a kart time as the game shows it (kart-logic's fmt, the same sums: a test compares): minutes and seconds */
  function clock(ms) {
    var t = ms / 1000, m = Math.floor(t / 60), s = (t - m * 60).toFixed(2);
    if (Number(s) >= 60) { m++; s = (0).toFixed(2); }
    return { m: m, s: (Number(s) < 10 ? '0' : '') + s };
  }
  /* '47.21 s' for a kart time, '2,995' for a score: the distance between two times (a gap,
     a near miss) and the Control Centre's rows */
  function fmtValue(key, v) { var r = rule(key); return r && isInt(v) ? amount(r, v) : ''; }
  /* a board value as a child reads it, in the game's own format: '1:22.40' (and '0:47.21')
     for a kart time, so a board, a menu hint and the race beside them agree; '2,995' for a score */
  function showValue(key, v) {
    var r = rule(key), c;
    if (!r || !isInt(v)) return '';
    if (r.game !== 'kart') return commas(v);
    c = clock(v);
    return c.m + ':' + c.s;
  }
  /* the same, for a screen reader: '1 minute 22.40 seconds', '47.21 seconds', '2,995' */
  function sayValue(key, v) {
    var r = rule(key), c;
    if (!r || !isInt(v)) return '';
    if (r.game !== 'kart') return commas(v);
    c = clock(v);
    return (c.m ? c.m + (c.m === 1 ? ' minute ' : ' minutes ') : '') + String(Number(c.s).toFixed(2)) + ' seconds';
  }
  /* the words for a group: 'your family', a class label ('Otter class') or 'this device' */
  function groupWords(group) {
    if (group === 'your family') return { where: 'in your family', record: 'New family record', lead: 'You lead your family', board: 'the family board' };
    if (group === 'this device') return { where: 'on this device', record: 'New record for this device', lead: 'Top of this device', board: 'this device’s board' };
    if (typeof group !== 'string' || !CLASS_LABEL_RE.test(group)) return null;
    return { where: 'in ' + group, record: 'New ' + group + ' record', lead: 'You lead ' + group, board: 'the ' + group + ' board' };
  }
  function isBoard(x) { return isObj(x) && Array.isArray(x.rows); }
  function ownRow(st) { return st.rows.filter(function (x) { return isObj(x) && x.me === true; })[0] || null; }
  /* nobody else on the list has this row's value */
  function alone(st, mine) { return st.rows.every(function (x) { return x === mine || !isObj(x) || x.v !== mine.v; }); }
  /* 1 + the rows that beat this one: worked out from values, never from a hidden place */
  function rankIn(st, r, mine) {
    return 1 + st.rows.filter(function (x) { return isObj(x) && x !== mine && beats(r, x.v, mine.v); }).length;
  }
  /* The one line under a result: before and after are standings() of the same board, group
     and period from before and after the child's new value (same options both times).
     ctx = {key, period, group, order}; a list with no place on any row is taken as 'az'
     whatever ctx says. Good news or a near miss only:
       record  👑 a new best-ever lead        lead  👑 into this week's lead
       up      ⬆️ up to a place that is shown  first  on the board for the first time this week
       near    🎯 close behind the next place  best   'az' order: the child's own progress
     Never a place out of a count, never the bottom, never a move down; a hidden place is
     never printed. null when there is nothing kind and true to say, when before is unknown
     (pass an empty standings for an empty board), or when the group words are not known. */
  function moveLine(before, after, ctx) {
    var c = isObj(ctx) ? ctx : {}, r = rule(c.key), g = groupWords(c.group), week = c.period === 'week';
    if (!r || !g || !isBoard(before) || !isBoard(after) || (!week && c.period !== 'ever')) return null;
    var a = ownRow(after), b = ownRow(before);
    if (!a || !isInt(a.v) || (b && !isInt(b.v))) return null;
    var first = !b, improved = first || beats(r, a.v, b.v), on = ' on ' + r.name + '!';
    function line(kind, text) { return { text: text, kind: kind }; }
    var az = c.order === 'az' || !after.rows.some(function (x) { return isObj(x) && isInt(x.place); });
    if (az) return improved ? line('best', '⬆️ A new best ' + (week ? 'this week' : 'ever') + on) : null;
    var rA = rankIn(after, r, a), rB = b ? rankIn(before, r, b) : 0;
    if (improved && rA === 1 && alone(after, a) && Math.max(after.rows.length, count(after.count)) >= 2) {
      if (!week) return line('record', '👑 ' + g.record + on);
      if (first || rB > 1 || !alone(before, b)) return line('lead', '👑 ' + g.lead + ' this week' + on);
    }
    if (improved && b && rA < rB && isInt(a.place)) {
      return line('up', '⬆️ Up to ' + ordinal(a.place) + ' ' + g.where + (week ? ' this week' : ', best ever,') + on);
    }
    if (first && week) return line('first', 'You’re on ' + g.board + ' this week!');
    if (rA > 1 && isInt(a.gap) && a.gap > 0) {
      var target = r.better === 'lower' ? a.v - a.gap : a.v + a.gap;
      if (r.game === 'kart' ? a.gap <= NEAR_MS : a.gap <= target * NEAR_PART) {
        var above = after.rows.filter(function (x) { return isObj(x) && x !== a && x.v === target && typeof x.n === 'string'; })[0];
        return line('near', '🎯 ' + amount(r, a.gap) + ' behind ' + (above ? above.n : 'the next place') + (week ? ' this week' : ', best ever') + '. So close!');
      }
    }
    return null;
  }

  var API = {
    V: V, BOARDS: BOARDS, KEYS: KEYS, MAX_CARDS: MAX_CARDS, CARD_KEYS: CARD_KEYS, RANGES: RANGES, LINE_KINDS: LINE_KINDS,
    boards: boards, rule: rule, validValue: validValue, better: better, weekKey: weekKey,
    notebook: notebook, noteResult: noteResult, applyCuts: applyCuts, removedNote: removedNote, tally: tally, spend: spend,
    desiredCard: desiredCard, markerCard: markerCard, cardShapeOk: cardShapeOk, patchRow: patchRow,
    standings: standings, moveLine: moveLine, fmtValue: fmtValue, showValue: showValue, sayValue: sayValue, ordinal: ordinal
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLBoardsCore = API;
})();
