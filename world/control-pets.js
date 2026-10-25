/* ================================================================
   Pet care — the grown-up's side (control.html only). Classic UMD:
   window.SLControlPets in the browser, loaded after world-core.js,
   pet-care.js and control-social.js; module.exports in Node.

   The '🐾 Pet care' card of the Control Centre, one per family, beside
   '🎮 Island game time' (pets.json ui.grownUp G1–G3; plan-ku KU18, KU19, KU40):
     - the pet sitter (Off / On until a date / On until I switch it off) and what happens
       to a pet who isn't looked after (the Pet Rescue, or 'It can pass away'), saved for
       the whole family on families/{code}.petCare = {sitter: {on, until}, farewell, setAt}
       by a set with merge, the write control.html's saveFamily makes (owner-only rules)
     - per child, from that child's last sync: the pets at home with a tummy word, how many
       are at the Pet Hotel, the pets at the Pet Rescue with 'Bring {name} home now' and the
       stars with 'Bring {name} back'. A button writes families/{code}/kids/{uid}.pets.
       {release | unstar}.{petId} = ms as a field-scoped merge (control-social's step
       format), which SLPetCare.applyFamily applies once on the child's device (care3.done)
   A child's device reads both and never writes them. Nothing here writes a child's profile or
   anything a child owns, and no balance is read. A family with no Control Centre keeps the
   defaults (the Rescue, no sitter), which is fair because only island days count (G3).

     builders (pure: no DOM, no storage, no network, no clock) return steps: an array of
     batches, each an array of writes {kind: 'set', path: [segments], data, merge: true,
     fields: [{path: [segments], del: true}]}
       cfgOf(familyDoc) → {sitter: {on, until}, farewell, setAt}   (the defaults when unset)
       sitterOn(cfg, day) → bool     on, and until is null or day ≤ until (the end of that day)
       saveCare(code, change, nowMs, kidsDocs)   change = {sitter: {on, until}} and/or
                                     {farewell}: [[the family write]], then prune()
       command(code, uid, petId, kind, nowMs, kidsDoc)   kind 'release' (home from the Pet
                                     Rescue) | 'unstar' (back from the stars): one batch, the
                                     command and that child's commands older than 30 days
       prune(code, kidsDocs, nowMs)  every command older than 30 days goes when the card saves
       summary(childDocs, opts) → rows   opts = {family, kids: {uid: kidsDoc}, now, status}
                                     childDocs = the users records control.html holds
     the card
       mount(el, deps) → {ready, idle(), update(accounts)}
       deps = {fdb, firebase, code, family, accounts, now, confirm, refresh(petCare)}

   The rows read w.care3 through SLPetCare.status when pet-care.js is loaded (P1.2), else
   straight from the documented care3 shape (pets.json dataModel.care3Schema). Everything
   read from Firestore reaches the page as text (textContent), never as markup. The card's
   words are its own frozen table, TEXT (KU19); the care numbers it quotes come from
   SLWorldCore.CARE (P1.1), else pets.json care.constants.
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLControlPets) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLControlPets;
    return;
  }
  var WC0 = null, PC0 = null, CS0 = null;
  if (typeof module === 'object' && module.exports) {
    try { WC0 = require('./world-core.js'); } catch (e) { WC0 = null; }
    try { PC0 = require('./pet-care.js'); } catch (e) { PC0 = null; }
    try { CS0 = require('./games/control-social.js'); } catch (e) { CS0 = null; }
  }
  var WIN = typeof window !== 'undefined' ? window : {};
  /* looked up at each call, so the order the script tags finish in does not matter */
  function core() { return WC0 || WIN.SLWorldCore || null; }
  function care() { var P = PC0 || WIN.SLPetCare || null; return P && typeof P.status === 'function' ? P : null; }
  function social() { return CS0 || WIN.SLControlSocial || null; }

  var V = 1;
  var KINDS = Object.freeze(['release', 'unstar']);
  var KEEP_DAYS = 30, DAY_MS = 86400000, KEEP_MS = KEEP_DAYS * DAY_MS;
  var BATCH_MAX = 400, NAME_MAX = 24;
  var UID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, FAM_RE = /^[A-Z0-9]{4,12}$/, PET_RE = /^[a-z][a-z0-9_]{0,47}$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/, KEY_RE = /^(?!__.*__$)[^\s/]{1,128}$/;
  /* the care numbers the text quotes: SLWorldCore.CARE once world-core carries it, else pets.json care.constants */
  var CARE_DEFAULT = Object.freeze({ foodMax: 3, rescueAt: 4, rescueVisits: 3, starAfter: 7 });
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TUMMY_COLOURS = { full: 'background:#e5f6ea;color:#1e7d3f;', fed: 'background:#e5f6ea;color:#1e7d3f;',
    peckish: 'background:#fff3d9;color:#8a6100;', hungry: 'background:#fdeeee;color:#c0392b;', veryHungry: 'background:#fdeeee;color:#c0392b;' };

  /* Every word the card shows (KU19: the Control Centre's text lives in the module that
     shows it). {placeholders} are filled when shown; {days} reads 'N island day(s)'. */
  var TEXT = Object.freeze({
    title: '🐾 Pet care',
    sitter: 'Pet sitter',
    sitterOff: 'Off',
    sitterUntil: 'On until a date',
    sitterOn: 'On until I switch it off',
    sitterDate: 'Until the end of',
    sitterHelp: 'While the pet sitter is on, pets never get hungry or sad. Kids can still feed and play with them.',
    sitterPast: 'That date has passed, so the pet sitter is off now.',
    sitterPick: 'Pick a date from today on.',
    rule: 'If a pet isn’t looked after',
    rescue: 'It goes to the Pet Rescue',
    recommended: 'recommended',
    rescueHelp: 'A full tummy lasts {foodMax} island days. After {rescueAt} more island days with an empty tummy, a pet goes to the Pet Rescue, ' +
      'where the keepers look after it. Your child brings it home by visiting and feeding it on {rescueVisits} different days. Nothing is ever taken away.',
    farewell: 'It can pass away',
    farewellHelp: 'If a pet waits at the Rescue for {starAfter} more island days with no visit, it passes away gently: it becomes a star in the ' +
      'island’s sky and your child keeps a memory card. You can bring it back here.',
    devices: 'Switch this on only after every device your family uses has the update (reload each one).',
    farewellTold: 'Your child sees a card explaining the new rule the next time they open My Island. A pet already at the Rescue gets the full ' +
      '{starAfter} island days from then.',
    farewellAsk: 'Switch on “It can pass away”? A pet who waits at the Pet Rescue for {starAfter} island days without a visit will then pass away ' +
      'and become a star. Your child sees a card explaining this the next time they open My Island. Every device your family uses should have ' +
      'the update first (reload each one).',
    save: 'Save',
    saving: 'Saving…',
    savedOff: 'Saved: the pet sitter is off.',
    savedUntil: 'Saved: the pet sitter is on until the end of {date}.',
    savedOn: 'Saved: the pet sitter is on until you switch it off.',
    savedRescue: 'Saved: a pet who isn’t looked after goes to the Pet Rescue.',
    savedFarewell: 'Saved: a pet can pass away. Your child is told the new rule the next time they open My Island.',
    reach: 'Each child’s device picks this up the next time it is signed in.',
    notSaved: 'Not saved.',
    refused: 'That was refused. Press Refresh and try again.',
    offline: 'That did not go through. Check the connection and try again.',
    unread: 'The family’s pet settings could not be read just now. Check the connection, then press Refresh.',
    kids: 'Your children’s pets',
    asOf: 'as of {date}',
    never: 'never synced',
    notStarted: 'Pet care starts the next time {child} opens My Island.',
    noPets: 'No pets yet.',
    behind: 'Your latest settings reach {child}’s device the next time it is signed in.',
    home: 'At home:',
    hotel: 'At the Pet Hotel: {n}',
    atRescue: '{pet} is at the Pet Rescue: {n} of {of} visits.',
    starIn: 'Without a visit, {pet} becomes a star in {days}.',
    release: 'Bring {pet} home now',
    releaseSent: 'Sent: {pet} comes home the next time {child} opens My Island.',
    star: '{pet} became a star on {date}.',
    starNoDay: '{pet} is a star.',
    unstar: 'Bring {pet} back',
    unstarSent: 'Sent: {pet} comes back the next time {child} opens My Island (home if there is room, otherwise the Pet Hotel).',
    none: 'No child has opened My Island yet.',
    footnote: 'Pets only get hungry on days your child opens My Island. Settings reach a child’s device the next time it is signed in.',
    tummy: Object.freeze({ full: 'Full', fed: 'Fed', peckish: 'Peckish', hungry: 'Hungry', veryHungry: 'Very hungry' })
  });

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isWhole(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0; }
  function isUid(s) { return typeof s === 'string' && UID_RE.test(s); }
  function isPet(s) { return typeof s === 'string' && PET_RE.test(s); }
  function isDay(s) {
    if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function bad(what) { throw new Error('SLControlPets: ' + what); }
  function careNum(k) { var C = core(), c = C && isObj(C.CARE) ? C.CARE : null; return c && isWhole(c[k]) && c[k] > 0 ? c[k] : CARE_DEFAULT[k]; }
  function daysText(n) { return n + (n === 1 ? ' island day' : ' island days'); }
  /* one of TEXT's lines with its placeholders filled; the care numbers are always there */
  function say(key, map) {
    var m = { foodMax: careNum('foodMax'), rescueAt: careNum('rescueAt'), rescueVisits: careNum('rescueVisits'), starAfter: careNum('starAfter') };
    if (isObj(map)) Object.keys(map).forEach(function (k) { m[k] = map[k]; });
    if (has(m, 'n') && !has(m, 'days')) m.days = daysText(m.n);
    return String(TEXT[key]).replace(/\{(\w+)\}/g, function (all, k) { return has(m, k) ? String(m[k]) : all; });
  }
  function dayKey(ms, tz) {
    var C = core();
    if (C && typeof C.dayKey === 'function') return C.dayKey(ms, tz);
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
    catch (e) { return new Date(ms).toISOString().slice(0, 10); }
  }
  function niceDay(day) { return isDay(day) ? String(+day.slice(8)) + ' ' + MONTHS[+day.slice(5, 7) - 1] : ''; }
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10); }

  /* ---------- builders ---------- */
  function famPath(code) { return typeof code === 'string' && FAM_RE.test(code) ? ['families', code] : bad('not a family code'); }
  /* the family's settings as the children's devices read them; unset = the Rescue, no sitter */
  function cfgOf(familyDoc) {
    var pc = isObj(familyDoc) && isObj(familyDoc.petCare) ? familyDoc.petCare : {}, s = isObj(pc.sitter) ? pc.sitter : {};
    var on = s.on === true;
    return { sitter: { on: on, until: on && isDay(s.until) ? s.until : null }, farewell: pc.farewell === true, setAt: isWhole(pc.setAt) ? pc.setAt : 0 };
  }
  function sitterOn(cfg, day) {
    var s = cfgOf({ petCare: cfg }).sitter;
    return s.on && (s.until === null || (isDay(day) && day <= s.until));
  }
  /* A Save of one part of the card or both: only petCare, merged, so the arcade, shop and
     games fields (and a part of petCare this Save does not name) stay as they are. setAt
     is the time of this Save: the child's device keeps the newer one. Then prune(). */
  function saveCare(code, change, nowMs, kidsDocs) {
    var fam = famPath(code), c = isObj(change) ? change : {}, pc = {};
    if (!isWhole(nowMs) || nowMs <= 0) return bad('not a time');
    if (has(c, 'sitter')) {
      var s = isObj(c.sitter) ? c.sitter : {};
      if (typeof s.on !== 'boolean' || (s.on && s.until != null && !isDay(s.until))) return bad('not a pet sitter setting');
      pc.sitter = { on: s.on, until: s.on && s.until != null ? s.until : null };
    }
    if (has(c, 'farewell')) {
      if (typeof c.farewell !== 'boolean') return bad('not a choice');
      pc.farewell = c.farewell;
    }
    if (!has(pc, 'sitter') && !has(pc, 'farewell')) return bad('nothing to save');
    pc.setAt = nowMs;
    return [[{ kind: 'set', path: fam, data: { petCare: pc }, merge: true }]].concat(prune(code, kidsDocs, nowMs));
  }
  function kidWrite(fam, uid, data, fields) { return { kind: 'set', path: fam.concat(['kids', uid]), data: data, merge: true, fields: fields }; }
  /* the commands in a kids record that are older than 30 days (or not a time at all), as
     field deletes; keep = [kind, petId] is never listed (it is being written) */
  function oldFields(kidsDoc, nowMs, keep) {
    var out = [], pets = isObj(kidsDoc) && isObj(kidsDoc.pets) ? kidsDoc.pets : null;
    if (!pets) return out;
    KINDS.forEach(function (kind) {
      var m = isObj(pets[kind]) ? pets[kind] : {};
      Object.keys(m).sort().forEach(function (petId) {
        if (!KEY_RE.test(petId) || (keep && keep[0] === kind && keep[1] === petId)) return;
        if (!isWhole(m[petId]) || nowMs - m[petId] > KEEP_MS) out.push({ path: ['pets', kind, petId], del: true });
      });
    });
    return out;
  }
  function prune(code, kidsDocs, nowMs) {
    var fam = famPath(code), kd = isObj(kidsDocs) ? kidsDocs : {}, steps = [];
    if (!isWhole(nowMs)) return bad('not a time');
    Object.keys(kd).sort().forEach(function (uid) {
      var gone = isUid(uid) ? oldFields(kd[uid], nowMs, null) : [];
      if (!gone.length) return;
      if (!steps.length || steps[steps.length - 1].length >= BATCH_MAX) steps.push([]);
      steps[steps.length - 1].push(kidWrite(fam, uid, {}, gone));
    });
    return steps;
  }
  /* 'Bring {name} home now' (release) or 'Bring {name} back' (unstar): one field of the
     child's kids record, merged, so cls, lt, rm, photo and every other command stay */
  function command(code, uid, petId, kind, nowMs, kidsDoc) {
    var fam = famPath(code), data = { pets: {} };
    if (!isUid(uid)) return bad('not an account id');
    if (!isPet(petId)) return bad('not a pet');
    if (KINDS.indexOf(kind) < 0) return bad('not a command');
    if (!isWhole(nowMs) || nowMs <= 0) return bad('not a time');
    data.pets[kind] = {};
    data.pets[kind][petId] = nowMs;
    return [[kidWrite(fam, uid, data, oldFields(kidsDoc, nowMs, [kind, petId]))]];
  }

  /* ---------- the rows: each child's pets, as last synced ---------- */
  function cleanName(x) { return typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : ''; }
  function nameOf(w, id) {
    var C = core(), p = null;
    try { p = C && typeof C.crewPet === 'function' ? C.crewPet(w, id) : null; } catch (e) { p = null; }
    if (p && cleanName(p.name)) return cleanName(p.name);
    var lists = [w.pets, isObj(w.crew3) ? w.crew3.pets : null];
    for (var i = 0; i < lists.length; i++) {
      var list = Array.isArray(lists[i]) ? lists[i] : [];
      for (var j = 0; j < list.length; j++) if (isObj(list[j]) && list[j].id === id && cleanName(list[j].name)) return cleanName(list[j].name);
    }
    var dn = C && isObj(C.DEFAULT_PET_NAMES) && has(C.DEFAULT_PET_NAMES, id) ? C.DEFAULT_PET_NAMES[id] : '';
    return cleanName(dn) || 'Pet';
  }
  function speciesOf(id) {
    var C = core(), it = null;
    try { it = C && typeof C.item === 'function' ? C.item(id) : null; } catch (e) { it = null; }
    return it && it.kind === 'pet' && typeof it.name === 'string' ? it.name : '';
  }
  function num(x, max) { return isWhole(x) ? Math.min(x, max) : 0; }
  /* 0 fine, 1 peckish (an empty tummy), 2 hungry (a missed day), 3 very hungry (warning or last chance) */
  function levelOf(p) {
    if (isWhole(p.level) && p.level <= 3) return p.level;
    var missed = num(p.missed, 9);
    return missed >= 2 ? 3 : missed === 1 ? 2 : num(p.food, 9) === 0 ? 1 : 0;
  }
  function wordOf(level, food) { return level === 3 ? 'veryHungry' : level === 2 ? 'hungry' : level === 1 ? 'peckish' : num(food, 9) >= careNum('foodMax') ? 'full' : 'fed'; }
  /* where each pet is, straight from care3: home (in care3.home, a rescue keeps its place),
     the stars, and everyone else with a record at the Pet Hotel */
  function plainView(c3) {
    var pets = isObj(c3.pets) ? c3.pets : {}, home = Array.isArray(c3.home) ? c3.home : [], out = [], seen = {};
    function put(id, rec, where) {
      var r = isObj(rec.rescue) ? rec.rescue : {}, s = isObj(rec.star) ? rec.star : {};
      seen[id] = true;
      out.push({ id: id, where: where, food: rec.food, missed: rec.missed, visits: r.visits, waited: r.waited, starDay: s.day });
    }
    home.forEach(function (id) {
      var rec = typeof id === 'string' && isObj(pets[id]) ? pets[id] : null;
      if (!rec || has(seen, id) || isObj(rec.star)) return;
      put(id, rec, isObj(rec.rescue) ? 'rescue' : 'home');
    });
    Object.keys(pets).forEach(function (id) {
      var rec = pets[id];
      if (has(seen, id) || !isObj(rec)) return;
      put(id, rec, isObj(rec.star) ? 'star' : isObj(rec.rescue) ? 'rescue' : 'hotel');
    });
    return out;
  }
  /* SLPetCare.status, when loaded, says where each pet is and how hungry; the plain reading
     fills in anything it leaves out */
  function view(w, c3, useStatus) {
    var plain = plainView(c3), P = useStatus ? care() : null, s = null, byId = {};
    if (!P) return plain;
    try { s = P.status(w, isDay(c3.day) ? c3.day : null); } catch (e) { s = null; }
    if (!isObj(s) || !Array.isArray(s.pets)) return plain;
    s.pets.forEach(function (p) {
      if (!isObj(p) || typeof p.id !== 'string' || ['home', 'hotel', 'rescue', 'star'].indexOf(p.where) < 0) return;
      var r = isObj(p.rescue) ? p.rescue : {};
      byId[p.id] = { id: p.id, where: p.where, name: p.name, food: p.food, missed: p.missed, level: p.level, visits: r.visits, waited: r.waited, starIn: r.starIn };
    });
    return plain.map(function (q) {
      var p = has(byId, q.id) ? byId[q.id] : null;
      if (!p) return q;
      p.starDay = q.starDay;
      return p;
    });
  }
  /* commands sent and not yet applied: in the kids record, younger than 30 days, and not in care3.done */
  function pending(kidsDoc, done, nowMs) {
    var out = { release: {}, unstar: {} }, pets = isObj(kidsDoc) && isObj(kidsDoc.pets) ? kidsDoc.pets : {};
    KINDS.forEach(function (kind) {
      var m = isObj(pets[kind]) ? pets[kind] : {};
      Object.keys(m).forEach(function (petId) {
        var ms = m[petId];
        if (!isWhole(ms) || (nowMs > 0 && nowMs - ms > KEEP_MS) || has(done, kind + ':' + petId + ':' + ms)) return;
        out[kind][petId] = ms;
      });
    });
    return out;
  }
  /* the newest memory card of a star: the name it had */
  function cardOf(c3, id) {
    var list = Array.isArray(c3.stars) ? c3.stars : [], hit = null;
    list.forEach(function (c) { if (isObj(c) && c.id === id && !c.returned) hit = c; });
    return hit;
  }
  function rowOf(uid, a, w, kidsDoc, famCfg, nowMs, useStatus) {
    var c3 = isObj(w.care3) ? w.care3 : null;
    var row = { uid: uid, name: typeof a.username === 'string' ? a.username : '', synced: isWhole(a.updatedAt) && a.updatedAt > 0 ? dayKey(a.updatedAt, 'Europe/London') : '',
      started: !!c3, behind: false, farewell: false, home: [], hotel: 0, rescue: [], stars: [] };
    if (!c3) return row;
    var cc = cfgOf({ petCare: c3.cfg }), sent = pending(kidsDoc, isObj(c3.done) ? c3.done : {}, nowMs), of = careNum('rescueVisits'), after = careNum('starAfter');
    row.farewell = cc.farewell;
    row.behind = famCfg.setAt > cc.setAt;
    view(w, c3, useStatus).forEach(function (p) {
      var card = p.where === 'star' ? cardOf(c3, p.id) : null;
      var pet = { id: p.id, name: (card && cleanName(card.name)) || cleanName(p.name) || nameOf(w, p.id), species: speciesOf(p.id) };
      if (p.where === 'home') {
        pet.level = levelOf(p); pet.word = wordOf(pet.level, p.food);
        row.home.push(pet);
      } else if (p.where === 'hotel') row.hotel++;
      else if (p.where === 'rescue') {
        pet.visits = num(p.visits, of); pet.of = of;
        pet.starIn = !row.farewell ? null : isWhole(p.starIn) ? p.starIn : Math.max(1, after - num(p.waited, after));
        pet.sent = sent.release[p.id] || 0;
        row.rescue.push(pet);
      } else {
        pet.day = isDay(p.starDay) ? p.starDay : card && isDay(card.to) ? card.to : '';
        pet.sent = sent.unstar[p.id] || 0;
        row.stars.push(pet);
      }
    });
    return row;
  }
  /* one row per child with an island: accounts hidden on the games card ('Not my child') and
     accounts with no island are left out */
  function summary(childDocs, opts) {
    var o = isObj(opts) ? opts : {}, fam = isObj(o.family) ? o.family : {}, kids = isObj(o.kids) ? o.kids : {};
    var famCfg = cfgOf(fam), hide = isObj(fam.games) && isObj(fam.games.hide) ? fam.games.hide : {}, rows = [];
    (Array.isArray(childDocs) ? childDocs : []).forEach(function (a) {
      if (!isObj(a) || a.anon) return;
      var uid = isUid(a._uid) ? a._uid : isUid(a.uid) ? a.uid : '', w = isObj(a.state) && isObj(a.state.world) ? a.state.world : null;
      if (!uid || !w || hide[uid] === true) return;
      rows.push(rowOf(uid, a, w, has(kids, uid) ? kids[uid] : null, famCfg, isWhole(o.now) ? o.now : 0, o.status !== false));
    });
    return rows;
  }

  /* ---------- wiring ---------- */
  /* control-social's applyOps when it is loaded (control.html loads it first); else the
     same thing for the one kind of write this card makes: a set with merge */
  function applyOps(fdb, firebase, steps) {
    var S = social();
    if (S && typeof S.applyOps === 'function') return S.applyOps(fdb, firebase, steps);
    var FS = firebase && firebase.firestore;
    return (Array.isArray(steps) ? steps : []).reduce(function (chain, ops) {
      return chain.then(function () {
        if (!Array.isArray(ops) || !ops.length) return null;
        var batch = fdb.batch();
        ops.forEach(function (w) {
          if (!isObj(w) || w.kind !== 'set' || w.merge !== true || !Array.isArray(w.path) || w.path.length % 2) bad('not a write');
          var data = JSON.parse(JSON.stringify(isObj(w.data) ? w.data : {}));
          (Array.isArray(w.fields) ? w.fields : []).forEach(function (f) {
            var m = data;
            f.path.slice(0, -1).forEach(function (s) { if (!isObj(m[s])) m[s] = {}; m = m[s]; });
            m[f.path[f.path.length - 1]] = f.del === true ? FS.FieldValue.delete() : f.value;
          });
          batch.set(fdb.doc(w.path.join('/')), data, { merge: true });
        });
        return batch.commit();
      });
    }, Promise.resolve());
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
  function petLabel(p) { return p.name + (p.species && p.species !== p.name ? ' (' + p.species + ')' : ''); }

  function mount(el, deps) {
    var d = isObj(deps) ? deps : {}, code = d.code, fdb = d.fdb;
    var done = Promise.resolve(), none = { ready: done, idle: function () { return done; }, update: function () {} };
    el.textContent = '';
    if (!fdb || typeof code !== 'string' || !FAM_RE.test(code)) return none;
    var now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
    var famRef = fdb.doc('families/' + code), statusEls = {}, rowsBox = null;
    /* fam: the family record as last read or saved; kids: {uid: kids record | null}, absent when
       it could not be read; form: what the settings show, kept until its part is saved; notes: the
       status line of each part ('top' for reading, 'sitter', 'rule') and of each child's row */
    var st = { fam: isObj(d.family) ? d.family : {}, accounts: [], kids: {}, form: null, notes: { top: '', sitter: '', rule: '' }, rowNotes: {},
      saving: false, chain: Promise.resolve() };

    function tz() { var a = isObj(st.fam.arcade) ? st.fam.arcade : {}; return typeof a.tz === 'string' && a.tz ? a.tz : 'Europe/London'; }
    function today() { return dayKey(now(), tz()); }
    function saved() { return cfgOf(st.fam); }
    function sitterForm(c) { return { mode: !c.sitter.on ? 'off' : c.sitter.until ? 'until' : 'on', until: c.sitter.until || '' }; }
    function resetForm(part) {
      var c = saved(), f = st.form || {};
      if (!st.form || part === 'sitter') { var s = sitterForm(c); f.mode = s.mode; f.until = s.until; }
      if (!st.form || part === 'rule') f.farewell = c.farewell;
      st.form = f;
    }
    function ask(text) { return typeof d.confirm === 'function' && d.confirm(text) === true; }
    function note(part, text) { st.notes[part] = text; if (statusEls[part]) statusEls[part].textContent = text; }
    function failText(e) { return e && e.code === 'permission-denied' ? TEXT.refused : TEXT.offline; }
    /* one thing at a time; a refusal by the rules has its own answer, on the line of the part that asked */
    function run(fn, part) {
      st.chain = st.chain.then(fn).then(null, function (e) {
        note(part || 'top', failText(e));
        return null;
      });
      return st.chain;
    }
    function setAccounts(list) {
      st.accounts = (Array.isArray(list) ? list : []).filter(function (a) { return isObj(a) && !a.anon && a.familyCode === code && isUid(a._uid); });
    }
    function account(uid) { return st.accounts.filter(function (a) { return a._uid === uid; })[0] || null; }
    /* each child's kids record (only the owner and that child can read it); a read that fails leaves the child without pending lines */
    function readKids(uids) {
      return Promise.all(uids.map(function (uid) {
        return fdb.doc('families/' + code + '/kids/' + uid).get().then(function (snap) {
          st.kids[uid] = snap.exists ? snap.data() || {} : null;
        }, function () { delete st.kids[uid]; });
      }));
    }
    function load() {
      return famRef.get().then(function (snap) {
        st.fam = snap.data() || {};
        resetForm('sitter'); resetForm('rule');
      }, function () { note('top', TEXT.unread); }).then(function () {
        return readKids(st.accounts.map(function (a) { return a._uid; }));
      });
    }
    /* the tidy-up after a Save: commands older than 30 days go; a failure is tried again at the next Save */
    function forget(kd, fields) {
      (fields || []).forEach(function (f) {
        var m = isObj(kd) && isObj(kd.pets) && isObj(kd.pets[f.path[1]]) ? kd.pets[f.path[1]] : null;
        if (f.del === true && m) delete m[f.path[2]];
      });
    }
    function tidy(steps) {
      return applyOps(fdb, d.firebase, steps).then(function () {
        steps.forEach(function (ops) { ops.forEach(function (w) { forget(st.kids[w.path[3]], w.fields); }); });
      }, function () { return null; });
    }
    function write(part, change, okText) {
      if (st.saving) return;                          /* a second press while one Save is on its way */
      st.saving = true;
      note(part === 'sitter' ? 'rule' : 'sitter', '');
      run(function () {
        note(part, TEXT.saving);
        /* the newer setAt wins on a child's device, even when this device's clock is behind */
        var steps = saveCare(code, change, Math.max(now(), saved().setAt + 1), st.kids), pc = {};
        return applyOps(fdb, d.firebase, steps.slice(0, 1)).then(function () {
          var was = isObj(st.fam.petCare) ? st.fam.petCare : {}, put = steps[0][0].data.petCare;
          Object.keys(was).forEach(function (k) { pc[k] = was[k]; });
          Object.keys(put).forEach(function (k) { pc[k] = put[k]; });
          st.fam.petCare = pc;
          resetForm(part);
          if (typeof d.refresh === 'function') d.refresh(pc);
          return tidy(steps.slice(1));
        }).then(function () {
          drawAll();
          note(part, okText + ' ' + TEXT.reach);
        });
      }, part).then(function () { st.saving = false; });
    }
    function saveSitter() {
      var f = st.form, t = today();
      if (f.mode === 'until' && (!isDay(f.until) || f.until < t)) { note('sitter', TEXT.sitterPick); return; }
      var sitter = { on: f.mode !== 'off', until: f.mode === 'until' ? f.until : null };
      write('sitter', { sitter: sitter }, !sitter.on ? TEXT.savedOff : sitter.until ? say('savedUntil', { date: niceDay(sitter.until) }) : TEXT.savedOn);
    }
    function saveRule() {
      var want = st.form.farewell === true;
      if (want && !saved().farewell && !ask(say('farewellAsk'))) { note('rule', TEXT.notSaved); return; }
      write('rule', { farewell: want }, want ? TEXT.savedFarewell : TEXT.savedRescue);
    }
    /* the row itself says the command is on its way (or that it did not go through) */
    function send(uid, pet, kind) {
      if (!account(uid)) return;
      run(function () {
        var ms = now(), steps = command(code, uid, pet.id, kind, ms, st.kids[uid]);
        return applyOps(fdb, d.firebase, steps).then(function () {
          var kd = isObj(st.kids[uid]) ? st.kids[uid] : (st.kids[uid] = {});
          forget(kd, steps[0][0].fields);
          if (!isObj(kd.pets)) kd.pets = {};
          if (!isObj(kd.pets[kind])) kd.pets[kind] = {};
          kd.pets[kind][pet.id] = ms;
          delete st.rowNotes[uid];
        }, function (e) { st.rowNotes[uid] = failText(e); }).then(drawRows);
      });
    }

    /* ----- drawing: createElement and textContent only ----- */
    function drawSitter(box) {
      var f = st.form, c = saved(), lab = add(box, 'label'), sel = null, dateBox = null, day = null;
      box.setAttribute('style', 'line-height:1.9;');
      add(lab, 'b', TEXT.sitter + ' ');
      sel = add(lab, 'select');
      sel.setAttribute('data-pc', 'sitter');
      sel.setAttribute('style', 'font-family:inherit;font-weight:700;padding:4px 6px;max-width:100%;');
      [['off', TEXT.sitterOff], ['until', TEXT.sitterUntil], ['on', TEXT.sitterOn]].forEach(function (o) {
        var opt = add(sel, 'option', o[1]);
        opt.setAttribute('value', o[0]);
        if (f.mode === o[0]) opt.setAttribute('selected', '');
      });
      sel.value = f.mode;
      add(box, 'span', ' ');
      dateBox = add(box, 'label');
      dateBox.setAttribute('style', 'white-space:nowrap;');
      dateBox.hidden = f.mode !== 'until';
      add(dateBox, 'span', TEXT.sitterDate + ' ');
      day = input(dateBox, 'date');
      day.setAttribute('data-pc', 'until');
      day.setAttribute('min', today());
      day.setAttribute('style', 'font-family:inherit;font-weight:700;padding:3px 6px;');
      day.value = f.until;
      day.addEventListener('change', function () { f.until = String(day.value || ''); });
      day.addEventListener('input', function () { f.until = String(day.value || ''); });
      sel.addEventListener('change', function () {
        f.mode = ['off', 'until', 'on'].indexOf(sel.value) >= 0 ? sel.value : 'off';
        if (f.mode === 'until' && !isDay(f.until)) { f.until = addDays(today(), 7); day.value = f.until; }
        dateBox.hidden = f.mode !== 'until';
      });
      add(box, 'span', ' ');
      button(box, TEXT.save, 'btn-act', saveSitter).setAttribute('data-pc', 'save-sitter');
      status(box, 'sitter');
      add(box, 'div', TEXT.sitterHelp, 'muted');
      if (c.sitter.on && c.sitter.until && c.sitter.until < today()) add(box, 'div', TEXT.sitterPast, 'muted').setAttribute('data-pc', 'past');
    }
    function choice(box, value, label, extra) {
      var lab = add(box, 'label'), r = input(lab, 'radio');
      lab.setAttribute('style', 'display:block;margin-top:6px;font-weight:700;');
      r.setAttribute('name', 'pc_rule_' + code);
      r.setAttribute('value', value);
      r.setAttribute('data-pc', value);
      r.checked = (st.form.farewell === true) === (value === 'farewell');
      add(lab, 'span', ' ' + label + ' ');
      if (extra) add(lab, 'span', extra, 'pill');
      r.addEventListener('change', function () { if (r.checked) st.form.farewell = value === 'farewell'; });
      var help = add(box, 'div', '', '');
      help.setAttribute('style', 'margin-left:24px;');
      return help;
    }
    function drawRule(box) {
      var set = add(box, 'fieldset'), help = null;
      set.setAttribute('style', 'border:none;padding:0;margin:12px 0 0;min-width:0;');
      add(set, 'legend', TEXT.rule).setAttribute('style', 'font-weight:700;padding:0;');
      help = choice(set, 'rescue', TEXT.rescue, TEXT.recommended);
      add(help, 'div', say('rescueHelp'), 'muted');
      help = choice(set, 'farewell', TEXT.farewell, '');
      add(help, 'div', say('farewellHelp'), 'muted');
      add(help, 'div', TEXT.devices).setAttribute('style', 'color:#c0392b;font-weight:700;font-size:13px;margin:2px 0;');
      add(help, 'div', say('farewellTold'), 'muted');
      var line = add(box, 'div');
      line.setAttribute('style', 'margin-top:8px;');
      button(line, TEXT.save, 'btn-act', saveRule).setAttribute('data-pc', 'save-rule');
      status(line, 'rule');
    }
    function status(box, part) {
      var s = statusEls[part] = add(box, part === 'top' ? 'div' : 'span', st.notes[part], 'muted');
      s.setAttribute('role', 'status');
      s.setAttribute('data-pc', 'status-' + part);
      s.setAttribute('style', part === 'top' ? 'color:#c0392b;font-weight:700;' : 'margin-left:8px;');
    }
    function drawKid(box, row) {
      var r = add(box, 'div'), head = add(r, 'div'), a = account(row.uid);
      r.setAttribute('data-petkid', row.uid);
      r.setAttribute('style', 'padding:8px 0;border-bottom:1px solid #f0eef8;line-height:1.7;');
      add(head, 'b', row.name);
      add(head, 'span', ' · ' + (row.synced ? say('asOf', { date: niceDay(row.synced) }) : TEXT.never), 'muted');
      if (st.rowNotes[row.uid]) add(r, 'div', st.rowNotes[row.uid]).setAttribute('style', 'color:#c0392b;font-weight:700;font-size:13px;');
      if (!row.started) { add(r, 'div', say('notStarted', { child: row.name }), 'muted'); return; }
      if (row.behind) add(r, 'div', say('behind', { child: row.name }), 'muted');
      if (!row.home.length && !row.hotel && !row.rescue.length && !row.stars.length) { add(r, 'div', TEXT.noPets, 'empty'); return; }
      if (row.home.length) {
        var line = add(r, 'div');
        add(line, 'span', TEXT.home + ' ');
        row.home.forEach(function (p, i) {
          if (i) add(line, 'span', ' · ');
          var chip = add(line, 'span');
          chip.setAttribute('data-pet', p.id);
          chip.setAttribute('style', 'white-space:nowrap;');
          add(chip, 'span', petLabel(p));
          add(chip, 'span', TEXT.tummy[p.word], 'pill').setAttribute('style', TUMMY_COLOURS[p.word]);
        });
      }
      if (row.hotel) add(r, 'div', say('hotel', { n: row.hotel }));
      /* a pet at the Rescue or in the sky: its line and button, then what to expect, a step in */
      function petLine(p, kind, text, notes) {
        var line = add(r, 'div'), go = kind === 'release' ? 'releaseSent' : 'unstarSent';
        line.setAttribute('data-' + (kind === 'release' ? 'rescue' : 'star'), p.id);
        line.setAttribute('style', 'margin-top:2px;');
        add(line, 'span', text + ' ');
        if (!p.sent && a) button(line, say(kind, { pet: p.name }), 'btn-ghost', function () { send(row.uid, p, kind); }).setAttribute('data-' + kind, row.uid + '|' + p.id);
        notes.concat(p.sent ? [say(go, { pet: p.name, child: row.name })] : []).forEach(function (t) {
          add(line, 'div', t, 'muted').setAttribute('style', 'margin-left:14px;line-height:1.5;');
        });
      }
      row.rescue.forEach(function (p) {
        petLine(p, 'release', say('atRescue', { pet: petLabel(p), n: p.visits, of: p.of }), p.starIn !== null ? [say('starIn', { pet: p.name, n: p.starIn })] : []);
      });
      row.stars.forEach(function (p) {
        petLine(p, 'unstar', p.day ? say('star', { pet: petLabel(p), date: niceDay(p.day) }) : say('starNoDay', { pet: petLabel(p) }), []);
      });
    }
    function drawRows() {
      if (!rowsBox) return;
      rowsBox.textContent = '';
      add(rowsBox, 'b', TEXT.kids).setAttribute('style', 'display:block;margin-top:14px;');
      var rows = summary(st.accounts, { family: st.fam, kids: st.kids, now: now() });
      if (!rows.length) add(rowsBox, 'div', TEXT.none, 'empty');
      rows.forEach(function (row) { drawKid(rowsBox, row); });
    }
    function drawAll() {
      el.textContent = ''; statusEls = {};
      var h = add(el, 'h2', TEXT.title + ' ');
      add(h, 'span', 'code ' + code, 'pill');
      var card = add(el, 'div', '', 'card');
      card.setAttribute('data-petcare', code);
      status(card, 'top');
      drawSitter(add(card, 'div'));
      drawRule(add(card, 'div'));
      rowsBox = add(card, 'div');
      drawRows();
      add(card, 'p', TEXT.footnote, 'muted').setAttribute('style', 'margin:12px 0 0;');
    }
    /* the page loaded the accounts again: new children's kids records are read; the settings being edited are left alone */
    function update(list) {
      setAccounts(list);
      var fresh = st.accounts.map(function (a) { return a._uid; }).filter(function (uid) { return !has(st.kids, uid); });
      drawRows();
      if (fresh.length) run(function () { return readKids(fresh).then(drawRows); });
    }

    setAccounts(d.accounts);
    resetForm();
    drawAll();
    var ready = run(function () { return load().then(drawAll); });
    return { ready: ready, idle: function () { return st.chain; }, update: update };
  }

  var API = {
    V: V, TEXT: TEXT, KINDS: KINDS, KEEP_DAYS: KEEP_DAYS, CARE_DEFAULT: CARE_DEFAULT,
    cfgOf: cfgOf, sitterOn: sitterOn, saveCare: saveCare, command: command, prune: prune, summary: summary,
    applyOps: applyOps, mount: mount
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLControlPets = API;
})();
