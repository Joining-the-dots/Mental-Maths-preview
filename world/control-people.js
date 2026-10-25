/* ================================================================
   Characters — the grown-up's side (control.html only). Classic UMD:
   window.SLControlPeople in the browser, loaded after world-core.js,
   people-core.js and control-social.js; module.exports in Node.

   The '🎨 Characters' card of the Control Centre (kids update KU-CH14;
   characters.json uiFlows.grownUp, plan-ku KU16-KU19), per child:
     - 'Photo cartoon maker' Off / On, Off until the family's grown-up
       saves On. Saved on families/{code}/kids/{uid}.photo = {on, at} by a
       field-scoped set with merge (control-social's step format), so cls,
       lt, rm and pets stay. The child's device reads it once each time
       the character maker opens and never writes it; the same switch
       allows the camera mirror. Turning it off counts from the next open.
     - a read-only look at the character they play as (the 2D figure when
       SLPeopleArt is on the page, else a pixel head in their colours) and
       the characters they own, from their last sync
   The switch is drawn only behind the Control Centre's grown-up gate: the
   family's owner, signed in with a real password (an account that opens
   with just its username sees a note instead, as control-social does).
   The photo button also needs the child to sign in with their own
   password; the card says so when the games card has not recorded one.

     builders (pure: no DOM, no storage, no network, no clock)
       photoOn(kidsDoc) → bool                 only photo.on === true is on
       setPhoto(code, uid, on, nowMs) → steps  [[{kind: 'set', path: ['families',
                                               code, 'kids', uid], data: {photo: {on, at}},
                                               merge: true}]]
       summary(childDocs, opts) → rows         opts = {family, kids: {uid: kidsDoc}}
     the card
       mount(el, deps) → {ready, idle(), update(accounts)}
       deps = {fdb, firebase, auth, code, family, accounts, usedDerived, now}

   Everything read from Firestore reaches the page as text (textContent),
   never as markup. The card's words are its own frozen table, TEXT (KU19):
   control.html loads no world-copy.js.
   ================================================================ */
(function () {
  'use strict';
  /* loading the file twice does nothing: the first copy stays */
  if (typeof window !== 'undefined' && window.SLControlPeople) {
    if (typeof module === 'object' && module.exports) module.exports = window.SLControlPeople;
    return;
  }
  var PE0 = null, CS0 = null;
  if (typeof module === 'object' && module.exports) {
    try { PE0 = require('./people-core.js'); } catch (e) { PE0 = null; }
    try { CS0 = require('./games/control-social.js'); } catch (e) { CS0 = null; }
  }
  var WIN = typeof window !== 'undefined' ? window : {};
  /* looked up at each call, so the order the script tags finish in does not matter */
  function people() { var P = PE0 || WIN.SLPeopleCore || null; return P && typeof P.avatarInfo === 'function' ? P : null; }
  function social() { return CS0 || WIN.SLControlSocial || null; }
  function art() { var A = WIN.SLPeopleArt; return A && typeof A.figure === 'function' ? A : null; }

  var V = 1, NAME_MAX = 24;
  var UID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, FAM_RE = /^[A-Z0-9]{4,12}$/;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* skin 1-10 and the ten natural hair colours (people-core PALETTES; its own table wins when loaded) */
  var SKIN = ['#FCE5D6', '#F6D3BC', '#EDC0A0', '#E0AA84', '#CF956C', '#B97E57', '#9E6744', '#835236', '#683F2A', '#4D2E20'];
  var HAIR = ['#1E1B22', '#3B2A22', '#5C3D2B', '#8A5E3C', '#7E3A24', '#C0602E', '#D79A6A', '#E6C27A', '#F1E6C8', '#B9B6B3'];

  /* Every word the card shows (KU19). {child} is the child's username as the page lists it. */
  var TEXT = Object.freeze({
    title: '🎨 Characters',
    intro: 'Each child plays as one character: one they made in the character maker, or one they bought. Here you can see who they play as and choose whether they may start from a photo.',
    photo: 'Photo cartoon maker',
    off: 'Off',
    on: 'On',
    /* characters.json uiFlows.grownUp's explainer, in two parts: the first line always, the rest wherever On is chosen or saved */
    explain: 'Lets {child} start their cartoon character from a photo.',
    explainMore: 'The photo stays on their device for a few seconds while the app picks colours like ‘skin tone 4’ and ‘dark brown hair’. ' +
      'Then it’s deleted. It is never saved, never uploaded and never sent to anyone. Only the colours they keep are saved with their island.',
    mirror: 'The same switch lets {child} use the camera as a mirror while they choose a hairstyle, eyes and glasses. The mirror shows the camera on ' +
      'their screen only: nothing is taken, saved or sent.',
    camera: 'Their device also asks before it uses the camera.',
    password: 'The photo button shows only when {child} signs in with their own password. You can set one in the game boards card.',
    save: 'Save',
    saving: 'Saving…',
    savedOn: 'Saved: {child} may start from a photo.',
    savedOff: 'Saved: the photo cartoon maker is off for {child}.',
    reach: 'It counts from the next time {child} opens the character maker.',
    refused: 'That was refused. Press Refresh and try again.',
    offline: 'That did not go through. Check the connection and try again.',
    unread: 'The current setting could not be read just now, so it shows Off. Check the connection, then press Refresh.',
    derived: 'The photo cartoon maker is set up here once your own account has a real password. At the moment it opens with just its username, ' +
      'so a child could open this page. Set one with 🔑 Set password in the game’s account box, then sign in here with it.',
    asOf: 'as of {date}',
    never: 'never synced',
    playsAs: 'Plays as {name}',
    me: 'their own character',
    classic: 'No character yet: they play as the classic avatar.',
    owns: 'Characters: {list}',
    none: 'No child has opened My Island yet.',
    footnote: 'The look a child picks, including colours chosen from a photo, is saved with their island like any other choice. Nothing marks a colour as coming from a photo.'
  });

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isWhole(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0; }
  function isUid(s) { return typeof s === 'string' && UID_RE.test(s); }
  function bad(what) { throw new Error('SLControlPeople: ' + what); }
  function say(key, map) {
    var m = isObj(map) ? map : {};
    return String(TEXT[key]).replace(/\{(\w+)\}/g, function (all, k) { return has(m, k) ? String(m[k]) : all; });
  }
  function cleanName(x) { return typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : ''; }
  function niceDay(ms) { var d = new Date(ms); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }

  /* ---------- builders ---------- */
  function photoOn(kidsDoc) { return isObj(kidsDoc) && isObj(kidsDoc.photo) && kidsDoc.photo.on === true; }
  /* one field of the child's kids record, merged: cls, lt, rm, pets and every other field stay */
  function setPhoto(code, uid, on, nowMs) {
    if (typeof code !== 'string' || !FAM_RE.test(code)) return bad('not a family code');
    if (!isUid(uid)) return bad('not an account id');
    if (typeof on !== 'boolean') return bad('not a choice');
    if (!isWhole(nowMs) || nowMs <= 0) return bad('not a time');
    return [[{ kind: 'set', path: ['families', code, 'kids', uid], data: { photo: { on: on, at: nowMs } }, merge: true }]];
  }

  /* ---------- the rows: who each child plays as, from their last sync ---------- */
  function palettes() {
    var P = people(), pal = P && isObj(P.PALETTES) ? P.PALETTES : null, hex = function (e) { return typeof e === 'string' ? e : Array.isArray(e) ? e[1] : ''; };
    return { skin: pal && Array.isArray(pal.skin) ? pal.skin.map(hex) : SKIN, hair: pal && Array.isArray(pal.hairNatural) ? pal.hairNatural.map(hex) : HAIR };
  }
  /* people-core when it is loaded (names, owned, the drawn look); else the stored shape */
  function charsOf(w, name) {
    var P = people(), info = null, list = [];
    if (P) {
      try { info = P.avatarInfo(w, { name: name }); list = typeof P.charList === 'function' ? P.charList(w, { name: name }) : []; } catch (e) { info = null; list = []; }
      return { active: info ? { id: info.id, name: info.id === 'char_me' ? '' : cleanName(info.name), look: info.look, info: info } : null,
        owned: (Array.isArray(list) ? list : []).map(function (c) { return c.id === 'char_me' ? '' : cleanName(c.name); }) };
    }
    var ch = isObj(w.chars) ? w.chars : null, recs = ch && Array.isArray(ch.list) ? ch.list.filter(function (r) { return isObj(r) && typeof r.id === 'string'; }) : [];
    var act = ch && typeof ch.active === 'string' ? recs.filter(function (r) { return r.id === ch.active; })[0] : null;
    return { active: act ? { id: act.id, name: '', look: isObj(act.look) ? act.look : {}, info: null } : null, owned: recs.map(function () { return ''; }) };
  }
  function summary(childDocs, opts) {
    var o = isObj(opts) ? opts : {}, fam = isObj(o.family) ? o.family : {}, kids = isObj(o.kids) ? o.kids : {};
    var games = isObj(fam.games) ? fam.games : {}, hide = isObj(games.hide) ? games.hide : {}, pw = isObj(games.pw) ? games.pw : {}, rows = [];
    (Array.isArray(childDocs) ? childDocs : []).forEach(function (a) {
      if (!isObj(a) || a.anon) return;
      var uid = isUid(a._uid) ? a._uid : isUid(a.uid) ? a.uid : '';
      if (!uid || hide[uid] === true) return;
      var w = isObj(a.state) && isObj(a.state.world) ? a.state.world : null, name = cleanName(a.username);
      var c = w ? charsOf(w, name) : { active: null, owned: [] };
      rows.push({ uid: uid, name: name, synced: isWhole(a.updatedAt) && a.updatedAt > 0 ? a.updatedAt : 0, island: !!w,
        active: c.active, owned: c.owned, photo: has(kids, uid) ? photoOn(kids[uid]) : false, read: has(kids, uid), ownPw: pw[uid] === true });
    });
    return rows;
  }

  /* ---------- wiring: control-social's applyOps, else the one write this card makes ---------- */
  function applyOps(fdb, firebase, steps) {
    var S = social();
    if (S && typeof S.applyOps === 'function') return S.applyOps(fdb, firebase, steps);
    return (Array.isArray(steps) ? steps : []).reduce(function (chain, ops) {
      return chain.then(function () {
        if (!Array.isArray(ops) || !ops.length) return null;
        var batch = fdb.batch();
        ops.forEach(function (w) {
          if (!isObj(w) || w.kind !== 'set' || w.merge !== true || !Array.isArray(w.path) || w.path.length % 2) bad('not a write');
          batch.set(fdb.doc(w.path.join('/')), JSON.parse(JSON.stringify(w.data)), { merge: true });
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
  /* the pixel head of the photo sheet, in the child's skin and hair colours (when no 2D art is loaded) */
  var HEAD = ['.....hhhhhh.....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hsshhhhhhssh..', '..hssssssssssh..', '..hsswesswessh..',
    '..ssseesseesss..', '...ssssssssss...', '...ssssmmssss...', '....ssssssss....', '......ssss......'];
  function head(doc, look) {
    var pal = palettes(), sk = look && isWhole(look.sk) && look.sk <= 9 ? look.sk : 4, hc = look && isWhole(look.hc) && look.hc <= 9 ? look.hc : 1;
    var col = { s: pal.skin[sk] || SKIN[4], h: pal.hair[hc] || HAIR[1], e: '#1E1B22', w: '#F7F4EE', m: sk >= 6 ? '#F09AA5' : '#7A3341' };
    var NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 11');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '33');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    HEAD.forEach(function (rowText, y) {
      rowText.split('').forEach(function (c, x) {
        if (c === '.') return;
        var r = doc.createElementNS(NS, 'rect');
        r.setAttribute('x', String(x)); r.setAttribute('y', String(y)); r.setAttribute('width', '1'); r.setAttribute('height', '1');
        r.setAttribute('fill', col[c]);
        svg.appendChild(r);
      });
    });
    return svg;
  }
  /* SLPeopleArt.figure (an SVG drawn from look indices, never from a photo) shown as a picture */
  function figure(doc, row) {
    var A = art(), svg = '';
    try { svg = A && row.active && row.active.info ? A.figure(row.active.info) : ''; } catch (e) { svg = ''; }
    if (typeof svg !== 'string' || svg.indexOf('<svg') !== 0) return head(doc, row.active ? row.active.look : null);
    var img = doc.createElement('img');
    img.setAttribute('width', '44');
    img.setAttribute('height', '70');
    img.setAttribute('alt', '');
    img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    return img;
  }

  function mount(el, deps) {
    var d = isObj(deps) ? deps : {}, code = d.code, fdb = d.fdb;
    var done = Promise.resolve(), none = { ready: done, idle: function () { return done; }, update: function () {} };
    el.textContent = '';
    if (!fdb || typeof code !== 'string' || !FAM_RE.test(code)) return none;
    /* the grown-up gate: the family's owner, signed in, with a real password */
    var me = d.auth && d.auth.currentUser && typeof d.auth.currentUser.uid === 'string' ? d.auth.currentUser.uid : '';
    var fam0 = isObj(d.family) ? d.family : {};
    if (!me || fam0.ownerUid !== me) return none;
    if (d.usedDerived) { add(el, 'h2', TEXT.title); add(add(el, 'div', '', 'card'), 'p', TEXT.derived, 'muted'); return none; }
    var now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
    var st = { fam: fam0, accounts: [], kids: {}, form: {}, notes: {}, saving: {}, chain: Promise.resolve() }, rowsBox = null;

    function failText(e) { return e && e.code === 'permission-denied' ? TEXT.refused : TEXT.offline; }
    function run(fn) { st.chain = st.chain.then(fn).then(null, function () { return null; }); return st.chain; }
    /* an account the games card marks 'Not my child' is left out, and its record is not read */
    function hidden(uid) { var g = isObj(st.fam.games) ? st.fam.games : {}; return isObj(g.hide) && g.hide[uid] === true; }
    function setAccounts(list) {
      st.accounts = (Array.isArray(list) ? list : []).filter(function (a) { return isObj(a) && !a.anon && a.familyCode === code && isUid(a._uid) && !hidden(a._uid); });
    }
    function account(uid) { return st.accounts.filter(function (a) { return a._uid === uid; })[0] || null; }
    /* each child's kids record (the owner can read them all); a read that fails shows Off and says so */
    function readKids(uids) {
      return Promise.all(uids.map(function (uid) {
        return fdb.doc('families/' + code + '/kids/' + uid).get().then(function (snap) {
          st.kids[uid] = snap.exists ? snap.data() || {} : null;
          delete st.form[uid];
        }, function () { delete st.kids[uid]; st.notes[uid] = TEXT.unread; });
      }));
    }
    function save(row) {
      var uid = row.uid, want = has(st.form, uid) ? st.form[uid] === true : photoOn(st.kids[uid]);   /* Save with no change keeps it */
      if (st.saving[uid] || !account(uid)) return;
      st.saving[uid] = true;
      st.notes[uid] = TEXT.saving;
      drawRows();
      run(function () {
        var steps = setPhoto(code, uid, want, Math.max(1, now()));
        return applyOps(fdb, d.firebase, steps).then(function () {
          var kd = isObj(st.kids[uid]) ? st.kids[uid] : (st.kids[uid] = {});
          kd.photo = steps[0][0].data.photo;
          delete st.form[uid];
          st.notes[uid] = say(want ? 'savedOn' : 'savedOff', { child: row.name }) + ' ' + say('reach', { child: row.name });
        }, function (e) { st.notes[uid] = failText(e); });
      }).then(function () { st.saving[uid] = false; drawRows(); });
    }

    /* ----- drawing: createElement and textContent only ----- */
    function drawKid(box, row) {
      var r = add(box, 'div'), top = add(r, 'div'), pic = add(top, 'div'), info = add(top, 'div'), doc = el.ownerDocument;
      r.setAttribute('data-peoplekid', row.uid);
      r.setAttribute('style', 'padding:10px 0;border-bottom:1px solid #f0eef8;line-height:1.6;');
      top.setAttribute('style', 'display:flex;gap:12px;align-items:center;');
      pic.setAttribute('style', 'flex:none;width:52px;display:flex;justify-content:center;');
      pic.appendChild(row.active ? figure(doc, row) : head(doc, null));
      if (!row.active) pic.setAttribute('style', 'flex:none;width:52px;display:flex;justify-content:center;opacity:.35;');
      var nm = add(info, 'div');
      add(nm, 'b', row.name);
      add(nm, 'span', ' · ' + (row.synced ? say('asOf', { date: niceDay(row.synced) }) : TEXT.never), 'muted');
      if (row.island) {
        add(info, 'div', row.active ? say('playsAs', { name: row.active.name || TEXT.me }) : TEXT.classic).setAttribute('data-plays', row.uid);
        if (row.owned.length > 1) add(info, 'div', say('owns', { list: row.owned.map(function (n) { return n || TEXT.me; }).join(', ') }), 'muted');
      }
      /* the switch: Off until the grown-up saves On */
      var on = has(st.form, row.uid) ? st.form[row.uid] : row.photo, set = add(r, 'fieldset');
      set.setAttribute('style', 'border:none;padding:0;margin:8px 0 0;min-width:0;');
      add(set, 'legend', TEXT.photo).setAttribute('style', 'font-weight:700;padding:0;');
      [[false, TEXT.off], [true, TEXT.on]].forEach(function (c) {
        var lab = add(set, 'label'), radio = add(lab, 'input');
        lab.setAttribute('style', 'display:inline-flex;align-items:center;gap:6px;min-height:44px;margin-right:16px;font-weight:700;');
        radio.setAttribute('type', 'radio');
        radio.setAttribute('name', 'pp_photo_' + row.uid);
        radio.setAttribute('value', c[0] ? 'on' : 'off');
        radio.setAttribute('data-photo', row.uid + '|' + (c[0] ? 'on' : 'off'));
        radio.checked = on === c[0];
        add(lab, 'span', c[1]);
        radio.addEventListener('change', function () {
          if (!radio.checked) return;
          st.form[row.uid] = c[0];
          drawRows();                                    /* the explainer opens with On; the choice keeps the focus */
          var again = rowsBox && rowsBox.querySelector('[data-photo="' + row.uid + '|' + (c[0] ? 'on' : 'off') + '"]');
          if (again && typeof again.focus === 'function') again.focus();
        });
      });
      var b = add(set, 'button', TEXT.save, 'btn-act');
      b.setAttribute('type', 'button');
      b.setAttribute('data-photosave', row.uid);
      if (st.saving[row.uid]) b.setAttribute('disabled', '');
      b.addEventListener('click', function () { save(row); });
      var s = add(set, 'div', st.notes[row.uid] || '', 'muted');
      s.setAttribute('role', 'status');
      s.setAttribute('data-photostatus', row.uid);
      s.setAttribute('style', 'display:block;margin:2px 0 4px;font-weight:700;');
      /* what it does, all of it, wherever On is chosen or saved; its first line while it is Off */
      add(set, 'div', say('explain', { child: row.name }) + (on ? ' ' + TEXT.explainMore : ''), 'muted').setAttribute('data-explain', row.uid);
      if (on) add(set, 'div', say('mirror', { child: row.name }) + ' ' + TEXT.camera, 'muted');
      if (!row.ownPw) add(set, 'div', say('password', { child: row.name })).setAttribute('style', 'color:#8a6100;font-weight:700;font-size:13px;margin-top:2px;');
    }
    function drawRows() {
      if (!rowsBox) return;
      rowsBox.textContent = '';
      var rows = summary(st.accounts, { family: st.fam, kids: st.kids });
      if (!rows.length) add(rowsBox, 'div', TEXT.none, 'empty');
      rows.forEach(function (row) { drawKid(rowsBox, row); });
    }
    function drawAll() {
      el.textContent = '';
      var h = add(el, 'h2', TEXT.title + ' ');
      add(h, 'span', 'code ' + code, 'pill');
      var card = add(el, 'div', '', 'card');
      card.setAttribute('data-people', code);
      add(card, 'p', TEXT.intro, 'muted').setAttribute('style', 'margin:0 0 6px;');
      rowsBox = add(card, 'div');
      drawRows();
      add(card, 'p', TEXT.footnote, 'muted').setAttribute('style', 'margin:12px 0 0;');
    }
    /* the page loaded the accounts again: new children's records are read; a choice not saved yet stays */
    function update(list) {
      setAccounts(list);
      var fresh = st.accounts.map(function (a) { return a._uid; }).filter(function (uid) { return !has(st.kids, uid) && !has(st.notes, uid); });
      drawRows();
      if (fresh.length) run(function () { return readKids(fresh).then(drawRows); });
    }

    setAccounts(d.accounts);
    drawAll();
    var ready = run(function () { return readKids(st.accounts.map(function (a) { return a._uid; })).then(drawRows); });
    return { ready: ready, idle: function () { return st.chain; }, update: update };
  }

  var API = { V: V, TEXT: TEXT, photoOn: photoOn, setPhoto: setPhoto, summary: summary, applyOps: applyOps, mount: mount };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SLControlPeople = API;
})();
