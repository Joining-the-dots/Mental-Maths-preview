/* ================================================================
   My Island v3, kids update — SLPeopleUI (KU-CH13): the character sheets.
   window.SLPeopleUI in the browser (window.slLoadPeople() loads it after world-art-people.js, with
   world/people-ui.css; plan-ku KU21), module.exports in Node, where the view-models and the markup
   run without a page (tests/people-ui.test.js). characters.json uiFlows.child: the first-open card,
   the creator, the cast carousel, My character with its wardrobe, Try it on and the debut card.

   EVERY WORD is a world-copy key (SLWorldCopy.t; KU19, KU36) or a catalogue name from people-core
   (characters, pieces, hairstyles, coverings, palette token names). Nothing typed by a child is
   shown here except the child's own profile name on their own device ('Looking sharp, {name}.').

   THE HOST'S ctx (KU-CH17 builds it; every field but user and commit is optional):
     user          the profile {name, points, world} (or a function returning it, read afresh)
     commit(fn)    → Promise<res>: fn(u) runs inside the host's C.transact and returns {ok, …}
     buy(id)       → Promise<{ok} | bool>: the host's buy flow for a char_* or wear_* id (the confirm
                   card at ECONOMY.confirmAt, test mode, the fixed tx, the save), WITHOUT its own
                   celebration: this file plays the debut and asks 'Play as {name} now?'. Without
                   buy, price chips show but nothing is bought here.
     trial         bool or () → bool (default window.SL_WORLD_TRIAL === true): FREE chips
     openShop(slot) the Island Shop's 👕 Wardrobe tab on a slot ('Shop more'); hidden without it
     findMe()      KU34: 'Find me on the island' in My character (the host closes the sheets)
     cover(delta)  pause / resume the 3D island under a sheet · sound(name) (default SLSound.play)
     use3D         true: turntables (SLPhotocard) over the 2D figure; false: 2D only (LOW, no 3D).
                   Default: SLPhotocard present, SLIsland3D.v3Scene and not html.sl-low
     reduced       reduced motion (default: the media query): still turntables, end poses
     color         the member colour (the classic hoodie and the Spark Stick)
     photoEnv      overrides for the consent read: {firebase, cloudState, familyCfg, SC, activeUser,
                   files, timeoutMs}; document / setTimeout / clearTimeout: test seams

   API
     meetCard(ctx) → Promise<choice>   the island-open queue's 'char.meet' card (KU13): Make me ·
                   Start from a photo (consent only) · Pick a character · Later; its line names the
                   photo only when that button is there (E10: char.meet.body, else
                   char.meet.bodyNoPhoto). Any answer sets w.tutSeen.chars (Later sets nothing
                   else); resolves when the chosen sheet closes
     openCreator(ctx, o) → Promise<{saved}>   o {id (default the active character, else char_me),
                   photoOn, photo (a photo result to apply)}
     openCast(ctx) · tryOn(ctx, wearId)
     openMy(ctx, o {view, slot})   My character (A6): the preview, then 👕 Wardrobe · 🎨 Change look ·
                   🔁 Change character · ✨ More. view 'wardrobe' (the default: wear what you have,
                   on slot, else the first slot with something to wear: Outfits once there is one,
                   else Tops) | 'switch' (your characters, then Pick a character: the cast) | 'more'
                   (Moves, Find me on the island, Make it look like me; 'moves' opens it too)
     photoGate(ctx) → Promise<bool>   THE CONSENT READ (KU17, CH-D14): true only when the photo files
                   can load, the profile is a cloud profile (SLSocialCore.bound: signed in, not a
                   guest, a family, this profile bound), the family's grown-up found the account has
                   its own password (games.pw[uid], the rules' kidOk), and families/{code}/kids/{uid}
                   .photo.on is true. One read per creator open, held in memory only; any failure,
                   refusal or a read slower than timeoutMs (6 s) → false. photoDecision(s) is its
                   truth table. When false, the photo button and the mirror are absent, not greyed.
     PHOTO (KU-CH14 by contract): window.slLoadPhoto() first (KU21), then
                   SLPhotoCartoonUI.open({reduced}) → Promise<result | null>. result is a
                   SLPhotoCartoon.sample() output, or {patch | look: {sk, hc?}, long?, glasses?}.
                   Only sk and hc reach the draft (KU16); long only orders the hairstyles (never
                   stored); glasses (bool) means the sheet asked 'Do you wear glasses?' itself,
                   otherwise the creator asks. A low result shows photo.unclear and changes nothing.
                   The mirror: SLPhotoCartoonUI.openMirror(panel) → close() (or {close}), beside the
                   preview; closed with the creator.
     view-models (pure): creatorTab(tab, s) · castCards(u, o) · wardrobeTab(w, u, id, slot) ·
                   tryOnDesc(w, u, wearId) · draft(look, wear) (undo, UNDO_MAX 20) · lookPatchOf ·
                   wearDiffOf · photoResult(result) · TABS · WSLOTS · UNDO_MAX
   Sounds only from SLSound NAMES and only after a tap: pop (a pick), chip (wear), star (the debut),
   tada (a purchase). Nothing here reads or writes storage, sends anything, or awards ⭐.
   ================================================================ */
(function (root, factory) {
  var node = typeof module === 'object' && !!module.exports;
  var api = factory(root, node);
  if (node) module.exports = api;
  else root.SLPeopleUI = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root, NODE) {
  'use strict';

  /* ---------------- siblings: the page's globals, else one require() in Node ---------------- */
  var sibs = {};
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function sib(name, path) {
    var m = root && root[name];
    if (m) return m;
    if (!NODE || typeof require !== 'function') return null;
    if (!own(sibs, name)) { try { sibs[name] = require(path) || null; } catch (e) { sibs[name] = null; } }
    return sibs[name];
  }
  function P() { return sib('SLPeopleCore', './people-core.js'); }
  function C() { return sib('SLWorldCore', './world-core.js'); }
  function A() { return sib('SLPeopleArt', './world-art-people.js'); }
  function BODY() { return sib('SLPeopleShapesBody', './people-shapes-body.js'); }
  function CP() { return sib('SLWorldCopy', './world-copy.js'); }
  function CH() { return sib('SLCharacters', './island3d/models-characters.js'); }
  function PCART() { return sib('SLPhotoCartoon', './photo-cartoon.js'); }
  function tx(key, vars) { var c = CP(); return c && typeof c.t === 'function' ? c.t(key, vars) : key; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n || 0).toLocaleString('en-GB'); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  var VERSION = 1, UNDO_MAX = 20, COLS = 5, STEP = 0.1;
  var TABS = ['skin', 'face', 'hair', 'extras', 'shape', 'clothes'];
  var WSLOTS = ['outfit', 'top', 'bottom', 'shoes', 'head', 'face', 'neck', 'back', 'hand', 'dye'];
  var QUICK = ['top', 'bottom', 'shoes'];
  var EMOTES = [['heart', '💗'], ['vsign', '✌️'], ['micpoint', '🎤'], ['wave', '👋']];
  var CLIP_SEC = { heart: 1.2, vsign: 1.2, micpoint: 1.2, wave: 1, stand: 0 };
  var SOUND = { pick: 'pop', wear: 'chip', debut: 'star', buy: 'tada' };
  var FIG = { w: 120, h: 132, foot: 124, small: [40, 60, 56] };   /* the preview box in sprite pixels (px 4); a grid figure's (px 2) */
  var LONG = 3, SIL = '#474E7E';      /* a hairstyle this long or longer is 'long'; a body shape's silhouette (Ink 2) */

  /* ---------------- names (catalogue data, never typed text) ---------------- */
  function tokenName(tok) { var s = String(tok || '').replace(/^PX (Skin|Eye|Hair|Frame|Cover|Aid) /, ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  function itemName(id) { var it = P() && P().item(id); return it ? it.name : ''; }
  function paletteOf(f) {
    var PL = P().PALETTES;
    return { sk: PL.skin, ec: PL.eyes.iris, hc: PL.hairNatural, gc: PL.glasses, cc: PL.covering, hac: PL.aid }[f] || [];
  }
  function landName(id) { var c = C(), it = c && c.item(id); return it ? it.name : ''; }
  function priceText(it, trial) { return trial ? tx('wardrobe.free') : '⭐ ' + fmt(it.price); }
  function eyeNames() { var B = BODY(); return B && B.EYE_SHAPES ? B.EYE_SHAPES : ['1', '2', '3', '4']; }

  /* ---------------- the draft and its undo (memory only) ---------------- */
  function wearOf(wear) {
    var out = {}, Pm = P();
    Pm.SLOTS.forEach(function (slot) { var it = Pm.item(wear && wear[slot]); if (it && it.kind === 'wear' && it.slot === slot) out[slot] = it.id; });
    return out;
  }
  function draft(look, wear) {
    var d = { look: P().validateLook(look), wear: wearOf(wear), stack: [] };
    d.push = function () { d.stack.push({ look: Object.assign({}, d.look), wear: Object.assign({}, d.wear) }); if (d.stack.length > UNDO_MAX) d.stack.shift(); };
    d.undo = function () { var s = d.stack.pop(); if (!s) return false; d.look = s.look; d.wear = s.wear; return true; };
    d.depth = function () { return d.stack.length; };
    return d;
  }
  /* only the fields that changed are written: a value a newer client stored stays in the save */
  function lookPatchOf(base, look) {
    var out = {}, b = P().validateLook(base);
    P().FIELD_KEYS.forEach(function (k) { if (look[k] !== b[k]) out[k] = look[k]; });
    return out;
  }
  function wearDiffOf(base, wear) { return P().SLOTS.filter(function (s) { return (base[s] || null) !== (wear[s] || null); }); }

  /* ---------------- the consent read (KU17, CH-D14) ---------------- */
  function photoDecision(s) { return !!(s && s.files === true && s.cloud === true && s.ownPw === true && s.consent === true); }
  function fbReady(f) { return !!f && typeof f.firestore === 'function' && (!f.apps || f.apps.length > 0); }
  function userOf(ctx) { var u = ctx && ctx.user; return typeof u === 'function' ? u() : u; }
  function photoEnv(ctx) {
    var e = (ctx && ctx.photoEnv) || {}, u = userOf(ctx), st = root.state;
    function pick(k, d) { return own(e, k) ? e[k] : d; }
    return {
      firebase: pick('firebase', root.firebase || null), cloudState: pick('cloudState', root.cloudState || null),
      familyCfg: pick('familyCfg', root.slFamilyCfg || null), SC: pick('SC', root.SLSocialCore || null),
      activeUser: pick('activeUser', st && typeof st.activeUser === 'string' ? st.activeUser : u && u.name),
      profileKey: u && typeof u.name === 'string' ? u.name : null,
      files: pick('files', typeof root.slLoadPhoto === 'function' || !!root.SLPhotoCartoonUI), timeoutMs: pick('timeoutMs', 6000)
    };
  }
  function photoGate(ctx) {
    var e = photoEnv(ctx), s = { files: e.files === true, cloud: false, ownPw: false, consent: false }, b = null;
    try {
      b = e.SC && typeof e.SC.bound === 'function'
        ? e.SC.bound({ firebaseReady: fbReady(e.firebase), cloudState: e.cloudState, activeUser: e.activeUser, profileKey: e.profileKey }) : null;
    } catch (x) { b = null; }
    s.cloud = !!(b && b.ok);
    if (s.cloud) {
      var g = e.SC && typeof e.SC.gamesCfg === 'function' ? e.SC.gamesCfg(e.familyCfg) : (e.familyCfg && e.familyCfg.games) || {};
      s.ownPw = !!(g && g.pw && g.pw[b.uid] === true);
    }
    if (!s.files || !s.cloud || !s.ownPw) return Promise.resolve(false);
    return new Promise(function (res) {
      var done = false, t = later(ctx, function () { fin(false); }, e.timeoutMs);
      function fin(v) { if (!done) { done = true; unlater(ctx, t); res(v); } }
      try {
        e.firebase.firestore().collection('families').doc(b.familyCode).collection('kids').doc(b.uid).get().then(function (snap) {
          var d = snap && snap.exists && typeof snap.data === 'function' ? snap.data() : null;
          s.consent = !!(d && d.photo && typeof d.photo === 'object' && d.photo.on === true);
          fin(photoDecision(s));
        }, function () { fin(false); });
      } catch (x) { fin(false); }
    });
  }
  /* a photo result → {patch: {sk, hc?} | null (low), long, glasses: bool | null}; null = cancelled */
  function photoResult(r) {
    if (!r || typeof r !== 'object' || r.cancelled) return null;
    var src = r.patch || r.look || r, patch = null, PCm = PCART();
    if (own(src, 'skin') && own(src, 'confidence') && typeof src.skin === 'object') src = PCm && typeof PCm.lookPatch === 'function' ? PCm.lookPatch(src) : null;   /* a sample() */
    if (src && isInt(src.sk) && src.sk >= 0 && src.sk <= 9) {
      patch = { sk: src.sk };
      if (isInt(src.hc) && src.hc >= 0 && src.hc <= 9) patch.hc = src.hc;      /* a natural colour only: a dye is never picked */
    }
    return { patch: patch, long: r.long === true || !!(r.patch && r.patch.long === true), glasses: typeof r.glasses === 'boolean' ? r.glasses : null };
  }

  /* ---------------- view-models (pure) ---------------- */
  function opt(a, f, v, on, kind, label, x) {
    var o = { a: a, f: f, v: v, on: !!on, kind: kind, label: label };
    Object.keys(x || {}).forEach(function (k) { o[k] = x[k]; });
    return o;
  }
  function swatches(f, title, look) {
    return paletteOf(f).map(function (p, i) { return opt('set', f, i, look[f] === i, 'swatch', title + ': ' + tokenName(p[0]), { hex: p[1] }); });
  }
  /* s = {w, look, wear, photo (the consent read was on), longFirst, buy (the host can buy), trial} */
  function creatorTab(tab, s) {
    var Pm = P(), lk = s.look, w = s.w, secs = [];
    function sec(id, title, opts, note) { secs.push({ id: id, title: title, opts: opts, note: note || null }); }
    function heads(f, title, names) { return names.map(function (nm, i) { return opt('set', f, i, lk[f] === i, 'head', title + ': ' + nm); }); }
    if (tab === 'skin') {
      var so = Pm.PALETTES.skin.map(function (p, i) { return opt('set', 'sk', i, lk.sk === i, 'swatch', tx('char.tab.skin') + ' ' + (i + 1), { hex: p[1] }); });
      if (s.photo) so.push(opt('photo', null, null, false, 'text', tx('photo.title'), { text: tx('photo.title'), icon: '📷' }));
      sec('sk', tx('char.tab.skin'), so);
    } else if (tab === 'face') {
      sec('ey', tx('char.eyes'), heads('ey', tx('char.eyes'), eyeNames()));
      sec('ec', tx('char.eyeColour'), swatches('ec', tx('char.eyeColour'), lk));
      sec('fx', null, [opt('set', 'fr', lk.fr ? 0 : 1, lk.fr === 1, 'toggle', tx('char.freckles'), { text: tx('char.freckles') }),
                       opt('set', 'bl', lk.bl ? 0 : 1, lk.bl === 1, 'toggle', tx('char.rosy'), { text: tx('char.rosy') })]);
    } else if (tab === 'hair') {
      var order = Pm.HAIR.map(function (h) { return h.n; });
      if (s.longFirst) order = order.filter(function (n) { return Pm.HAIR[n].length >= LONG; }).concat(order.filter(function (n) { return Pm.HAIR[n].length < LONG; }));
      sec('hs', tx('char.hairStyle'), order.map(function (n) { return opt('set', 'hs', n, lk.hs === n, 'head', tx('char.hairStyle') + ': ' + Pm.HAIR[n].name); }));
      var hc = swatches('hc', tx('char.hairColour'), lk).concat(Pm.PALETTES.hairFun.map(function (r) {
        var it = Pm.item(r[3]), mine = Pm.has(w, r[3]);
        return opt(mine ? 'set' : 'buy', 'hc', r[0], lk.hc === r[0], 'swatch', tx('char.hairColour') + ': ' + it.name,
                   { hex: r[2], id: r[3], price: mine ? null : priceText(it, s.trial), off: !mine && !s.buy });
      }));
      sec('hc', tx('char.hairColour'), hc);
      sec('cv', tx('char.covering'), [opt('set', 'cv', 0, lk.cv === 0, 'head', tx('char.covering') + ': ' + tx('char.none'))].concat(Pm.COVERINGS.map(function (c) {
        return opt('set', 'cv', c.n, lk.cv === c.n, 'head', tx('char.covering') + ': ' + c.name);
      })));
      if (lk.cv) sec('cc', tx('char.hairColour'), swatches('cc', tx('char.covering'), lk));
    } else if (tab === 'extras') {
      sec('gl', tx('char.glasses'), Pm.GLASSES.map(function (g, i) { return opt('set', 'gl', i, lk.gl === i, 'head', tx('char.glasses') + ': ' + (i ? g : tx('char.none'))); }));
      if (lk.gl) sec('gc', tx('char.hairColour'), swatches('gc', tx('char.glasses'), lk));
      sec('ha', tx('char.aid'), Pm.AIDS.map(function (g, i) { return opt('set', 'ha', i, lk.ha === i, 'head', tx('char.aid') + ': ' + (i ? g : tx('char.none'))); }));
      if (lk.ha) sec('hac', tx('char.hairColour'), swatches('hac', tx('char.aid'), lk));
    } else if (tab === 'shape') {
      sec('bd', tx('char.tab.shape'), [0, 1, 2].map(function (i) { return opt('set', 'bd', i, lk.bd === i, 'figure', tx('char.tab.shape') + ' ' + (i + 1)); }));
      sec('ht', tx('char.height'), [0, 1].map(function (i) { return opt('set', 'ht', i, lk.ht === i, 'figure', tx('char.height') + ' ' + (i + 1)); }));
    } else if (tab === 'clothes') {
      var res = Pm.resolve(lk, s.wear, {}, w);
      QUICK.forEach(function (slot) {
        var pieces = Pm.WEAR.filter(function (it) { return it.slot === slot && Pm.has(w, it.id); });
        sec(slot, tx('wardrobe.slot.' + slot), pieces.map(function (it) { return opt('wear', slot, it.id, s.wear[slot] === it.id, 'wear', it.name); }),
            res.hidden[slot] ? tx('wardrobe.hidden', { item: itemName(res.hidden[slot]) }) : null);
      });
      sec('more', null, [opt('more', null, null, false, 'text', tx('char.moreWardrobe'), { text: tx('char.moreWardrobe') })]);
    }
    return { id: tab, title: tx('char.tab.' + tab), sections: secs };
  }
  /* the cast carousel's cards: state 'owned' | 'affordable' | 'short' | 'opens' (+ free in test mode, active, goal) */
  function castCards(u, o) {
    var Pm = P(), Cm = C(), w = Cm.ensureWorld(u), trial = !!(o && o.trial), act = Pm.activeOf(w), goal = Cm.goalId(w), out = [];
    Pm.CAST.forEach(function (c) {
      if (c.id === 'char_me') return;
      var s = Cm.itemState(u, c.id, { trial: trial });
      if (!s || s.state === 'missing') return;
      var st = s.state === 'owned' ? 'owned' : s.state === 'locked' ? 'opens' : s.state === 'short' ? 'short' : 'affordable';
      out.push({
        id: c.id, name: c.name, theme: c.theme, price: c.price, state: st, free: st === 'affordable' && !!s.free, need: s.need || 0,
        active: act === c.id, goal: goal === c.id, opens: st === 'opens' ? landName(s.needs[0]) : null,
        comes: c.includes.filter(function (id) { return !Pm.has(w, id); }).map(itemName),
        move: c.move ? { id: c.move.id, name: tx('move.' + c.move.id) } : null
      });
    });
    return out;
  }
  function entryOf(w, u, id) {
    var list = P().charList(w, u);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* one wardrobe slot of a character: the owned and free pieces, worn, hidden under, colourways */
  function wardrobeTab(w, u, id, slot) {
    var Pm = P(), e = entryOf(w, u, id);
    if (!e) return { slot: slot, label: tx('wardrobe.slot.' + slot), cards: [] };
    var res = Pm.resolve(e.look, e.wear, e.vr, w);
    var cards = Pm.WEAR.filter(function (it) { return it.slot === slot && Pm.has(w, it.id); }).map(function (it) {
      var worn = slot === 'dye' ? e.look.hc === it.hc : res.worn[slot] === it.id;
      return { id: it.id, name: it.name, worn: worn, hidden: worn && res.hidden[slot] ? tx('wardrobe.hidden', { item: itemName(res.hidden[slot]) }) : null,
               cw: it.cw, vr: res.vr[it.id] || 0, free: it.free === true };
    });
    return { slot: slot, label: tx('wardrobe.slot.' + slot), cards: cards };
  }
  /* Try it on: the active character wearing the piece (a dye: its colour); no character → the Fitting Friend */
  function tryOnDesc(w, u, wearId) {
    var Pm = P(), it = Pm.item(wearId), a = Pm.avatarInfo(w, u);
    if (!it || it.kind !== 'wear') return null;
    if (!a) return { id: wearId, friend: true, wear: wearId, vr: {} };
    var d = { id: a.id, look: Object.assign({}, a.look), wear: Object.assign({}, a.wear), vr: Object.assign({}, a.vr) };
    if (it.slot === 'dye') d.look.hc = it.hc; else { d.wear[it.slot] = wearId; d.vr[wearId] = 0; }
    return d;
  }

  /* ---------------- pictures (SLPeopleArt; '' without it, the words still show) ----------------
     Memoised by what they show (a style icon does not depend on the current style), so a pick
     redraws from memory; the creator paints the rest a few at a time (old iPads stay responsive). */
  var picMemo = new Map(), PIC_MAX = 240, picSeq = 0;
  function pic(key, make) {
    if (picMemo.has(key)) return picMemo.get(key);
    var svg = make() || '';
    picMemo.set(key, svg);
    if (picMemo.size > PIC_MAX) picMemo.delete(picMemo.keys().next().value);
    return svg;
  }
  function memberOf(ctx) { return ctx && typeof ctx.color === 'string' ? ctx.color : null; }
  function figSvg(ctx, d, o) {
    var Am = A(); o = o || {};
    if (!Am || !d) return '';
    var sp = Am.sprite(d, { view: o.view || 'front', pose: o.pose || 'stand', t: o.t || 0, px: o.px || 4, color: memberOf(ctx), reduced: !!o.reduced });
    var box = o.box || [FIG.w, FIG.h, FIG.foot], pal = {};
    if (sp && o.sil) { Object.keys(sp.pal).forEach(function (k) { pal[k] = SIL; }); sp = Object.assign({}, sp, { pal: pal, alpha: {} }); }
    if (o.top) return sp ? box[2] - sp.foot.y + 1 : null;      /* the crown's row in the box */
    var svg = sp ? Am.svg(sp, { unit: 1, w: box[0], h: box[1], x: box[0] / 2, y: box[2], shadow: o.shadow === false ? 0 : Math.round(box[0] * 0.2) }) : '';
    return svg && o.mark != null ? svg.replace('</svg>', '<path d="M0 ' + o.mark + 'h' + box[0] + '" stroke="#C2306F" stroke-width="1" stroke-dasharray="3 2"/></svg>') : svg;
  }
  function iconOf(ctx, id, size, vr) {
    var Am = A();
    return Am ? pic('i|' + id + '|' + size + '|' + JSON.stringify(vr || {}) + '|' + memberOf(ctx), function () { return Am.icon(id, { size: size, vr: vr, color: memberOf(ctx) }); }) : '';
  }
  /* the face from the brows down (the eye shapes read at a glance) */
  function faceSvg(lk) {
    var Am = A(), sp = Am.sprite({ look: lk, wear: {}, vr: {} }, { view: 'front', pose: 'stand', px: 2, bones: ['head', 'eyes'] });
    if (!sp) return '';
    var r0 = -1, r1 = -1, c0 = sp.w, c1 = -1;
    sp.rows.forEach(function (row, y) { var m = /[^.]/.exec(row); if (!m) return; if (r0 < 0) r0 = y; r1 = y; c0 = Math.min(c0, m.index); c1 = Math.max(c1, row.search(/[^.]\.*$/)); });
    var top = r0 + Math.round((r1 - r0) * 0.36);
    return Am.svg(sp, { unit: 1, w: c1 - c0 + 1, h: r1 - top + 1, x: sp.foot.x - c0, y: sp.foot.y - top });
  }
  /* an option's picture; with pend (the creator) a picture not in memory is painted later */
  function optPic(ctx, o, s, pend) {
    var Am = A(), v = {}, lk, key, make;
    if (!Am) return '';
    if (o.kind === 'wear') return iconOf(ctx, o.v, 48);
    v[o.f] = o.v; lk = Object.assign({}, s.look, v);
    key = o.kind + '|' + o.f + '|' + JSON.stringify(lk) + (o.kind === 'figure' ? JSON.stringify(s.wear) + memberOf(ctx) : '');
    make = o.f === 'ey' ? function () { return faceSvg(lk); }
      : o.kind === 'head' ? function () { return Am.headIcon(lk, { size: 48, view: o.f === 'ha' ? 'side' : 'front' }); }
      : function () {
        /* the two heights side by side: a dashed line at the regular height's crown shows which is taller */
        var mark = o.f === 'ht' ? figSvg(ctx, { look: Object.assign({}, lk, { ht: 0 }), wear: s.wear, vr: {} }, { px: 2, box: FIG.small, top: true }) : null;
        return figSvg(ctx, { look: lk, wear: s.wear, vr: {} }, { px: 2, box: FIG.small, shadow: false, sil: true, mark: mark });
      };
    if (!pend || picMemo.has(key)) return pic(key, make);
    var ref = 'q' + (++picSeq);
    pend.push({ ref: ref, key: key, make: make });
    return '<span class="slp-wait" data-pic="' + ref + '"></span>';
  }
  function fillPics(ctx, el, pend) {
    var i = 0;
    (function run() {
      var t0 = Date.now();
      while (i < pend.length && (i === 0 || Date.now() - t0 < 12)) {
        var p = pend[i++], n = el.querySelector('[data-pic="' + p.ref + '"]');
        if (n) { n.innerHTML = pic(p.key, p.make); n.className = ''; }
      }
      if (i < pend.length && !pend.dead && el.isConnected) later(ctx, run, 16);
    }());
  }

  /* ---------------- markup (strings; the DOM layer binds [data-a]) ---------------- */
  function btn(a, text, x) {
    x = x || {};
    return '<button type="button" class="' + (x.cls || 'slw-btn') + '" data-a="' + a + '"' + (x.v != null ? ' data-v="' + esc(x.v) + '"' : '') +
      (x.pressed != null ? ' aria-pressed="' + !!x.pressed + '"' : '') + (x.label ? ' aria-label="' + esc(x.label) + '"' : '') + (x.off ? ' disabled' : '') + '>' +
      (x.icon ? '<span aria-hidden="true">' + x.icon + '</span> ' : '') + esc(text) + '</button>';
  }
  function optHtml(ctx, o, s, pend) {
    var pressed = o.a === 'set' || o.a === 'wear' || o.a === 'buy';
    var h = '<button type="button" class="slp-opt slp-' + o.kind + (o.price ? ' slp-priced' : '') + (o.on ? ' on' : '') + '" data-a="' + o.a + '"' + (o.f ? ' data-f="' + o.f + '"' : '') +
      (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') + (o.id ? ' data-id="' + esc(o.id) + '"' : '') + (pressed ? ' aria-pressed="' + o.on + '"' : '') +
      (o.text ? '' : ' aria-label="' + esc(o.label + (o.price ? ', ' + o.price : '')) + '"') + (o.off ? ' disabled' : '') + '>';
    if (o.kind === 'swatch') h += '<span class="slp-sw" style="background:' + o.hex + '"></span>';
    else if (o.text) h += (o.icon ? '<span aria-hidden="true">' + o.icon + '</span> ' : '') + '<span class="slp-tx">' + esc(o.text) + '</span>';
    else h += optPic(ctx, o, s, pend);
    if (o.price) h += '<span class="slp-price" aria-hidden="true">' + esc(o.price) + '</span>';
    if (o.on) h += '<span class="slp-tick" aria-hidden="true">✓</span>';
    return h + '</button>';
  }
  function panelHtml(ctx, vm, s, pend) {
    return vm.sections.map(function (sc) {
      var label = sc.title || vm.title, wide = sc.opts.every(function (o) { return o.kind === 'toggle' || o.kind === 'text'; }) ? ' wide' : sc.opts.every(function (o) { return o.kind === 'figure'; }) ? ' fig' : '';
      return '<section class="slp-sec">' + (sc.title ? '<h3>' + esc(sc.title) + '</h3>' : '') + (sc.note ? '<p class="slp-note">' + esc(sc.note) + '</p>' : '') +
        '<div class="slp-grid' + wide + '" role="group" aria-label="' + esc(label) + '">' + sc.opts.map(function (o) { return optHtml(ctx, o, s, pend); }).join('') + '</div></section>';
    }).join('');
  }
  function picHtml(id, ctx) {
    /* the whole character in 2D (what it wears is what it comes with); the 3D photocard replaces it */
    var Am = A(), svg = Am ? pic('c|' + id + '|' + memberOf(ctx), function () {
      var sp = Am.sprite(P().display(id), { view: 'front', pose: 'stand', px: 4, color: memberOf(ctx) });
      return sp ? Am.svg(sp, { unit: 1 }) : '';
    }) : '';
    return '<span class="slw-pc slp-pc" data-pc="' + esc(id) + '">' + svg + '</span>';
  }
  function castHtml(ctx, c, s) {
    var chip = c.state === 'owned' ? '<span class="slp-chip own">✓</span>'
      : c.state === 'opens' ? '<span class="slp-chip lock"><span aria-hidden="true">🔒</span> ' + esc(tx('char.cast.opens', { land: c.opens })) + '</span>'
      : c.free ? '<span class="slp-chip free"><s>⭐ ' + fmt(c.price) + '</s> ' + esc(tx('wardrobe.free')) + '</span>'
      : '<span class="slp-chip">⭐ ' + fmt(c.price) + '</span>';
    var act = '';
    if (c.state === 'owned') act = btn('play', tx('char.cast.play', { name: c.name }), { v: c.id, pressed: c.active, cls: 'slw-btn big' + (c.active ? '' : ' on') });
    else if (c.state === 'affordable' && s.buy) act = btn('buy', c.free ? tx('isle.unlockFree') : '⭐ ' + fmt(c.price), { v: c.id, cls: 'slw-buy', label: c.name + ', ' + (c.free ? tx('wardrobe.free') : '⭐ ' + fmt(c.price)) });
    else if (c.state === 'short') act = '<p class="slp-need">' + esc(tx('char.cast.need', { n: fmt(c.need) })) + '</p>' + btn('goal', tx('char.cast.save'), { v: c.id, pressed: c.goal, cls: 'slw-goalbtn' + (c.goal ? ' on' : '') });
    return '<li class="slp-cast' + (c.active ? ' active' : '') + '" data-id="' + c.id + '"><div class="slp-castpic">' + picHtml(c.id, ctx) + '</div>' +
      '<h3>' + esc(c.name) + '</h3><p class="slp-theme">' + esc(c.theme) + '</p><p class="slp-chips">' + chip + '</p>' +
      (c.comes.length ? '<p class="slp-comes">' + esc(tx('char.cast.comes', { items: c.comes.join(', ') })) + '</p>' : '') +
      (c.move ? '<p class="slp-move">' + (CH() ? btn('move', '▶', { v: c.id, cls: 'slw-btn slp-play', label: tx('char.cast.move', { move: c.move.name }) }) + ' ' : '') +
        '<span>' + esc(tx('char.cast.move', { move: c.move.name })) + '</span></p>' : '') + '<div class="slp-act">' + act + '</div></li>';
  }
  function wardrobeHtml(ctx, vm, x) {
    var cards = vm.cards.map(function (c) {
      var vr = {}; vr[c.id] = c.vr;
      var lab = vm.slot === 'dye' ? c.name : tx(c.worn ? 'wardrobe.off' : 'wardrobe.wear') + ': ' + c.name, dots = '';
      if (c.worn && c.cw > 1) {
        for (var i = 0; i < c.cw; i++) dots += '<span class="' + (i === c.vr ? 'on' : '') + '"></span>';
        dots = btn('cw', '', { v: c.id, cls: 'slp-dots', label: tx('wardrobe.colour') + ': ' + c.name }).replace('></button>', '>' + dots + '</button>');
      }
      return '<div class="slp-wcard' + (c.worn ? ' on' : '') + '"><button type="button" class="slp-wbtn" data-a="' + (vm.slot === 'dye' ? 'dye' : 'wear') + '" data-v="' + c.id +
        '" aria-pressed="' + c.worn + '" aria-label="' + esc(lab) + '">' + iconOf(ctx, c.id, 72, vr) +
        '<span class="slp-wnm">' + esc(c.name) + '</span>' + (c.worn ? '<span class="slp-tick" aria-hidden="true">✓</span>' : '') + '</button>' +
        (c.hidden ? '<p class="slp-note">' + esc(c.hidden) + '</p>' : '') + dots + '</div>';
    }).join('');
    return '<div class="slp-wgrid">' + cards + '</div>' + (x.shop ? '<p class="slp-more">' + btn('shop', tx('wardrobe.more'), { v: vm.slot }) + '</p>' : '');
  }

  /* ================================================================
     THE PAGE (everything below needs a document)
     ================================================================ */
  function D(ctx) { return (ctx && ctx.document) || root.document; }
  function later(ctx, fn, ms) { var f = (ctx && ctx.setTimeout) || root.setTimeout; return f ? f(fn, ms) : null; }
  function unlater(ctx, t) { var f = (ctx && ctx.clearTimeout) || root.clearTimeout; if (f && t != null) f(t); }
  function reducedOf(ctx) {
    if (ctx && typeof ctx.reduced === 'boolean') return ctx.reduced;
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function trialOf(ctx) { var t = ctx && ctx.trial; return typeof t === 'function' ? !!t() : typeof t === 'boolean' ? t : root.SL_WORLD_TRIAL === true; }
  function use3D(ctx) {
    if (ctx && typeof ctx.use3D === 'boolean') return ctx.use3D && !!root.SLPhotocard;
    var d = D(ctx), low = !!(d && d.documentElement && d.documentElement.classList.contains('sl-low'));
    return !!(root.SLPhotocard && root.SLIsland3D && root.SLIsland3D.v3Scene) && !low;
  }
  function sound(ctx, name) {
    try { if (ctx && typeof ctx.sound === 'function') ctx.sound(name); else if (root.SLSound && typeof root.SLSound.play === 'function') root.SLSound.play(name); } catch (e) { /* silent */ }
  }
  function cover(ctx, n) { try { if (ctx && typeof ctx.cover === 'function') ctx.cover(n); } catch (e) { /* ignore */ } }
  function commit(ctx, fn) {
    if (!ctx || typeof ctx.commit !== 'function') return Promise.resolve({ ok: false });
    return Promise.resolve(ctx.commit(fn)).then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
  }
  function worldOf(ctx) { var u = userOf(ctx); return u ? C().ensureWorld(u) : null; }
  function loadPhoto() { try { if (typeof root.slLoadPhoto === 'function') return Promise.resolve(root.slLoadPhoto()); } catch (e) { return Promise.reject(e); } return Promise.resolve(); }
  function nameOf(ctx, id) { var u = userOf(ctx); return id === 'char_me' ? (u && u.name) || '' : itemName(id); }

  /* one dialog: .slw-ov / .slw-sheet (the island's sheets; the host's closeAllOverlays closes it too) */
  var stack = [], seq = 0;
  function sheet(ctx, o) {
    var doc = D(ctx), ov = doc.createElement('div'), id = 'slp' + (++seq), opener = doc.activeElement, closed = false;
    ov.className = 'slw-ov slp-ov' + (o.cls ? ' ' + o.cls : '');
    ov.setAttribute('role', o.alert ? 'alertdialog' : 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('data-sl-modal', '1'); ov.setAttribute('aria-labelledby', id);
    ov.innerHTML = '<div class="slw-sheet slp-sheet' + (o.small ? ' small' : '') + '">' +
      (o.noX ? '' : '<button type="button" class="slw-x slp-x" aria-label="' + esc(tx('char.cast.notNow')) + '">✕</button>') +
      '<h2 id="' + id + '">' + esc(o.title) + '</h2><div class="slp-body"></div></div>';
    doc.body.appendChild(ov);
    cover(ctx, +1);
    var s = { ov: ov, body: ov.querySelector('.slp-body'), h2: ov.querySelector('h2'), ctx: ctx };
    s.close = function () {
      if (closed) return;
      closed = true;
      var i = stack.indexOf(s); if (i >= 0) stack.splice(i, 1);
      if (s.onClosed) { try { s.onClosed(); } catch (e) { /* the sheet still closes */ } }
      ov.remove(); cover(ctx, -1);
      doc.removeEventListener('keydown', onKey);
      try { if (opener && opener !== doc.body && opener.isConnected && opener.focus) opener.focus(); } catch (e) { /* ignore */ }
    };
    s.dismiss = function () { if (o.onDismiss) o.onDismiss(); else s.close(); };   /* ✕, Esc, the scrim */
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === s) { if (e.preventDefault) e.preventDefault(); s.dismiss(); } }
    doc.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) s.dismiss(); });
    var x = ov.querySelector('.slp-x');
    if (x) x.addEventListener('click', function () { s.dismiss(); });
    ov._close = s.close;
    stack.push(s);
    return s;
  }
  function focusFirst(s) { var b = s.body.querySelector('[data-a]') || s.ov.querySelector('button'); try { if (b) b.focus(); } catch (e) { /* ignore */ } }
  /* [data-a] buttons → handlers[a](el); arrows move inside a .slp-grid */
  function bind(el, on) {
    el.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () { var f = on[b.getAttribute('data-a')]; if (f && !b.disabled) f(b); });
    });
    el.querySelectorAll('[role="group"]').forEach(function (g) { g.addEventListener('keydown', function (e) { gridKey(g, e); }); });
  }
  function gridKey(g, e) {
    var items = g.querySelectorAll('button'), i = items.indexOf ? items.indexOf(e.target) : Array.prototype.indexOf.call(items, e.target), cols = 0;
    if (i < 0) return;
    for (var k = 0; k < items.length && items[k].offsetTop === items[0].offsetTop; k++) cols++;
    if (!cols || cols >= items.length) cols = Math.min(COLS, items.length);
    var to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: items.length - 1 }[e.key];
    if (to == null) return;
    if (e.preventDefault) e.preventDefault();
    to = Math.max(0, Math.min(items.length - 1, to));
    try { items[to].focus(); } catch (x) { /* ignore */ }
  }
  function say(s, text) { var r = s.ov.querySelector('.slp-live'); if (r) { r.textContent = ''; r.textContent = text; } }
  function liveHtml() { return '<div class="slp-live slw-vh" role="status" aria-live="polite"></div>'; }

  /* ---------------- the preview: the 2D figure, a turntable over it when 3D draws ---------------- */
  function stageHtml(cls) { return '<div class="slp-stage' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><div class="slp-fig"></div></div>'; }
  function stSpec(ctx, d) { return d.friend ? { member: memberOf(ctx) } : { look: d.look, wear: d.wear, vr: d.vr || {}, member: memberOf(ctx) }; }
  function preview(ctx, host, d, o) {
    var fig = host.querySelector('.slp-fig'), tt = null, cur = d, anim = null, red = reducedOf(ctx), PCm = root.SLPhotocard;
    function draw(pose, t) { fig.innerHTML = figSvg(ctx, cur, { pose: pose, t: t, reduced: red, view: o && o.view }); }
    draw();
    if (use3D(ctx) && PCm && typeof PCm.turntable === 'function') {
      try {
        tt = PCm.turntable(host, d.id || 'char_me', stSpec(ctx, d), { reduced: red, debut: !!(o && o.debut) });
        if (tt && tt.ready && tt.ready.then) tt.ready.then(function (ok) { if (ok) host.classList.add('slp-3d'); });
      } catch (e) { tt = null; }
    } else if (o && o.debut && !red) host.classList.add('slp-pop');
    var api = {
      set: function (d2) { cur = d2; if (!anim) draw(); if (tt && tt.set) tt.set(d2.id || 'char_me', stSpec(ctx, d2)); },
      /* a move or a tap emote on the 2D figure (10 frames a second; reduced motion: the still end pose) */
      play: function (clip) {
        api.halt();
        var CHm = CH(), info = CHm && typeof CHm.avInfo === 'function' ? CHm.avInfo(clip) : null, dur = info && info.dur ? info.dur : CLIP_SEC[clip] || 1.2, t = 0;
        host.classList.add('slp-anim');
        var step = function () {
          if (red) { draw(clip, dur); anim = later(ctx, api.halt, 1600); return; }
          draw(clip, Math.min(t, dur));
          t = Math.round((t + STEP) * 10) / 10;
          anim = later(ctx, t > dur + 0.6 ? api.halt : step, 100);
        };
        step();
      },
      halt: function () { if (anim != null) unlater(ctx, anim); anim = null; host.classList.remove('slp-anim'); draw(); },
      stop: function () { if (anim != null) unlater(ctx, anim); anim = null; if (tt) { try { tt(); } catch (e) { /* ignore */ } } tt = null; }
    };
    return api;
  }
  function fillCards(ctx, el) {
    if (!use3D(ctx) || !root.SLPhotocard || !root.SLPhotocard.fill) return;
    try { root.SLPhotocard.fill(el); } catch (e) { /* the SVG stays */ }
  }

  /* a small question sheet: → Promise<true (yes) | false> */
  function ask(ctx, title, yes, no, o) {
    return new Promise(function (res) {
      var s = sheet(ctx, { title: title, small: true, alert: true, cls: 'slp-ask', onDismiss: function () { done(false); } });
      function done(v) { s.close(); res(v); }
      s.body.innerHTML = (o && o.desc ? stageHtml('small') : '') + '<div class="slp-row">' + btn('yes', yes, { cls: 'slw-btn big on' }) + btn('no', no, { cls: 'slw-btn big' }) + '</div>';
      if (o && o.desc) { var pv = preview(ctx, s.body.querySelector('.slp-stage'), o.desc); s.onClosed = pv.stop; }
      bind(s.body, { yes: function () { done(true); }, no: function () { done(false); } });
      focusFirst(s);
    });
  }
  /* the debut card: the turntable's debut turn (a pop in 2D) and 'Looking sharp, {name}.' */
  function debut(ctx, d, name) {
    sound(ctx, SOUND.debut);
    return new Promise(function (res) {
      var s = sheet(ctx, { title: tx('char.debut', { name: name }), small: true, cls: 'slp-debut' });
      s.body.innerHTML = stageHtml() + '<div class="slp-row">' + btn('ok', tx('celebrate.ok'), { cls: 'slw-btn big on' }) + '</div>';
      var pv = preview(ctx, s.body.querySelector('.slp-stage'), d, { debut: true });
      s.onClosed = function () { pv.stop(); res(); };
      bind(s.body, { ok: s.close });
      focusFirst(s);
    });
  }

  /* ================================================================
     THE FIRST-OPEN CARD (KU13: the island-open queue's 'char.meet', prio 20)
     ================================================================ */
  /* the card's line names a photo only when the photo button is there (E10); a copy table without the
     no-photo line (an older cached world-copy.js) shows no line rather than offer a photo it cannot */
  function hasKey(key) { var c = CP(); return !!(c && c.STRINGS && own(c.STRINGS, key)); }
  function meetLead(photoOn) {
    var key = photoOn ? 'char.meet.body' : hasKey('char.meet.bodyNoPhoto') ? 'char.meet.bodyNoPhoto' : null;
    return key ? '<p class="slp-lead">' + esc(tx(key)) + '</p>' : '';
  }
  function markSeen(ctx) {
    return commit(ctx, function (u) { var w = C().ensureWorld(u); if (w.tutSeen.chars) return { ok: false }; w.tutSeen.chars = true; return { ok: true }; });
  }
  function meetCard(ctx) {
    return photoGate(ctx).then(function (photoOn) {
      return new Promise(function (res) {
        var s = sheet(ctx, { title: tx('char.meet.title'), small: true, cls: 'slp-meet', onDismiss: function () { pick('later'); } });
        s.body.innerHTML = meetLead(photoOn) + '<div class="slp-col">' +
          btn('make', tx('char.meet.make'), { icon: '🎨', cls: 'slw-btn big on' }) + (photoOn ? btn('photo', tx('char.meet.photo'), { icon: '📷', cls: 'slw-btn big' }) : '') +
          btn('pick', tx('char.meet.pick'), { icon: '⭐', cls: 'slw-btn big' }) + btn('later', tx('char.meet.later'), { cls: 'slw-btn slp-later' }) + '</div>';
        var chosen = false;
        function pick(choice) {
          if (chosen) return;
          chosen = true; s.close();
          markSeen(ctx).then(function () {
            if (choice === 'make') return openCreator(ctx, { id: 'char_me', photoOn: photoOn });
            if (choice === 'pick') return openCast(ctx);
            if (choice === 'photo') return startPhoto(ctx).then(function (r) { return openCreator(ctx, { id: 'char_me', photoOn: photoOn, photo: r }); });
          }).then(function () { res(choice); }, function () { res(choice); });
        }
        bind(s.body, { make: function () { pick('make'); }, photo: function () { pick('photo'); }, pick: function () { pick('pick'); }, later: function () { pick('later'); } });
        focusFirst(s);
      });
    });
  }
  function startPhoto(ctx) {
    return loadPhoto().then(function () {
      var UI = root.SLPhotoCartoonUI;
      return UI && typeof UI.open === 'function' ? UI.open({ reduced: reducedOf(ctx) }) : null;
    }).then(photoResult, function () { return null; });
  }

  /* ================================================================
     THE CREATOR
     ================================================================ */
  function openCreator(ctx, o) {
    o = o || {};
    var gate = typeof o.photoOn === 'boolean' ? Promise.resolve(o.photoOn) : photoGate(ctx);
    return gate.then(function (photoOn) { return new Promise(function (res) { creator(ctx, o, photoOn, res); }); });
  }
  function creator(ctx, o, photoOn, res) {
    var Pm = P(), u = userOf(ctx), w = C().ensureWorld(u), BD = BODY();
    var id = o.id || Pm.activeOf(w) || 'char_me', e = entryOf(w, u, id), fresh = !e;
    if (fresh && id !== 'char_me') id = 'char_me';
    var preset = 0, base = e ? { look: e.look, wear: e.wear } : { look: BD ? BD.preset(0) : {}, wear: BD ? BD.PRESET_WEAR : Pm.CAST[0].wear };
    var dr = draft(base.look, base.wear), tab = 'skin', longFirst = false, banner = null, mirror = null, busy = false, pend = null;
    var s = sheet(ctx, { title: tx('char.creator.title'), cls: 'slp-creator', onDismiss: function () { leave(null); } });
    var tools = btn('undo', tx('char.undo'), { icon: '↶', cls: 'slw-btn slp-tool' }) + btn('another', tx('char.another'), { icon: '↻', cls: 'slw-btn slp-tool' }) +
      (photoOn ? btn('mirror', tx('photo.mirror'), { icon: '🪞', cls: 'slw-btn slp-tool', pressed: false }) : '');
    s.body.innerHTML = '<div class="slp-top">' + stageHtml() + '<div class="slp-mirror" hidden></div><div class="slp-tools">' + tools + '</div></div>' +
      '<div class="slp-banner" hidden></div><div class="slp-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" class="slw-btn slp-tab" role="tab" data-a="tab" data-v="' + t + '" aria-selected="' + (t === tab) + '">' + esc(tx('char.tab.' + t)) + '</button>';
      }).join('') + '</div><div class="slp-panel" role="tabpanel"></div><div class="slp-foot">' + btn('done', tx('char.done'), { cls: 'slw-btn big on slp-done' }) + '</div>' + liveHtml();
    var panel = s.body.querySelector('.slp-panel'), pv = preview(ctx, s.body.querySelector('.slp-stage'), cur());
    s.onClosed = function () { pv.stop(); if (mirror) { try { (typeof mirror === 'function' ? mirror : mirror.close)(); } catch (x) { /* ignore */ } } mirror = null; };
    function cur() { return { id: id, look: dr.look, wear: dr.wear, vr: e ? e.vr : {} }; }
    function state() { return { w: C().ensureWorld(userOf(ctx)), look: dr.look, wear: dr.wear, photo: photoOn, longFirst: longFirst, buy: typeof ctx.buy === 'function', trial: trialOf(ctx) }; }
    function draw() {
      var st = state();
      if (pend) pend.dead = true;
      pend = [];
      panel.innerHTML = panelHtml(ctx, creatorTab(tab, st), st, pend);
      bind(panel, handlers);
      fillPics(ctx, panel, pend);
      s.body.querySelectorAll('.slp-tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-v') === tab)); b.classList.toggle('on', b.getAttribute('data-v') === tab); });
      var ub = s.body.querySelector('[data-a="undo"]'); if (ub) ub.disabled = !dr.depth();
      var bn = s.body.querySelector('.slp-banner');
      bn.hidden = !banner;
      if (banner) {
        bn.innerHTML = '<p>' + esc(banner.text) + '</p>' + (banner.ask ? '<p class="slp-q">' + esc(tx('photo.glassesQ')) + '</p><div class="slp-row">' +
          btn('glassesYes', tx('photo.yes')) + btn('glassesNo', tx('photo.no')) + '</div>' : '');
        bind(bn, handlers);
      }
    }
    function change(fn, text) { if (banner && !banner.ask) banner = null; dr.push(); fn(); pv.set(cur()); draw(); if (text) say(s, text); sound(ctx, SOUND.pick); }   /* the photo note goes with the next pick */
    function applyPhoto(r) {
      if (!r) return;
      longFirst = r.long;
      if (r.patch) change(function () { Object.keys(r.patch).forEach(function (k) { dr.look[k] = r.patch[k]; }); });
      banner = { text: (r.patch ? tx('photo.deleted') + ' · ' + tx('photo.result') : tx('photo.unclear')), ask: !!r.patch && r.glasses === null };
      if (r.patch && r.glasses === true) tab = 'extras';
      draw();
    }
    var handlers = {
      tab: function (b) { tab = b.getAttribute('data-v'); draw(); },
      set: function (b) {
        var f = b.getAttribute('data-f'), v = +b.getAttribute('data-v');
        if (dr.look[f] === v && b.getAttribute('aria-pressed') === 'true' && f !== 'fr' && f !== 'bl') return;
        change(function () { dr.look[f] = v; }, b.getAttribute('aria-label') || (b.textContent || ''));
        refocus('[data-f="' + f + '"][data-v="' + (f === 'fr' || f === 'bl' ? (v ? 0 : 1) : v) + '"]');
      },
      wear: function (b) {
        var slot = b.getAttribute('data-f'), wid = b.getAttribute('data-v');
        change(function () { if (dr.wear[slot] === wid) delete dr.wear[slot]; else dr.wear[slot] = wid; }, itemName(wid));
        refocus('[data-v="' + wid + '"]');
      },
      buy: function (b) {
        if (busy) return;
        var dye = b.getAttribute('data-id'), hc = +b.getAttribute('data-v');
        busy = true;
        Promise.resolve(ctx.buy(dye)).then(function (r) {
          busy = false;
          if (!(r === true || (r && r.ok))) return;
          sound(ctx, SOUND.buy);
          change(function () { dr.look.hc = hc; }, itemName(dye));
        }, function () { busy = false; });
      },
      undo: function () { if (dr.undo()) { pv.set(cur()); draw(); sound(ctx, SOUND.pick); } },
      another: function () { preset = (preset + 1) % (BD ? BD.PRESETS.length : 1); change(function () { dr.look = Pm.validateLook(BD ? BD.preset(preset) : {}); }); },
      photo: function () { startPhoto(ctx).then(applyPhoto); },
      mirror: function (b) {
        var host = s.body.querySelector('.slp-mirror');
        var top = s.body.querySelector('.slp-top');
        if (mirror) { try { (typeof mirror === 'function' ? mirror : mirror.close)(); } catch (x) { /* ignore */ } mirror = null; host.hidden = true; top.classList.remove('mirror'); }
        else {
          loadPhoto().then(function () {
            var UI = root.SLPhotoCartoonUI;
            if (!UI || typeof UI.openMirror !== 'function' || !s.ov.isConnected) return;
            host.hidden = false; top.classList.add('mirror'); mirror = UI.openMirror(host) || null;
            b.innerHTML = '<span aria-hidden="true">🪞</span> ' + esc(tx('photo.mirror.close')); b.setAttribute('aria-pressed', 'true');
          }, function () { /* no mirror */ });
          return;
        }
        b.innerHTML = '<span aria-hidden="true">🪞</span> ' + esc(tx('photo.mirror')); b.setAttribute('aria-pressed', 'false');
      },
      glassesYes: function () { banner = null; tab = 'extras'; draw(); refocus('[data-f="gl"]'); },
      glassesNo: function () { banner = null; draw(); },
      more: function () { leave('wardrobe'); },
      done: function () { save().then(function (ok) { if (ok) { s.close(); debut(ctx, cur(), nameOf(ctx, id)).then(function () { res({ saved: true }); }); } }); }
    };
    function refocus(sel) { var b = panel.querySelector(sel); try { if (b) b.focus(); } catch (x) { /* ignore */ } }
    function dirty() { return Object.keys(lookPatchOf(base.look, dr.look)).length > 0 || wearDiffOf(base.wear, dr.wear).length > 0; }
    /* 'That’s me': one commit — setup for a new 'Me', else setLook with the changed fields and a wear tap per changed slot */
    function save() {
      if (busy) return Promise.resolve(false);
      busy = true;
      var lk = Object.assign({}, dr.look), wr = Object.assign({}, dr.wear);
      return commit(ctx, function (u2) {
        var w2 = C().ensureWorld(u2), e2 = entryOf(w2, u2, id), r;
        if (!e2 && id === 'char_me') {
          var pieces = {};
          Pm.SLOTS.forEach(function (sl) { pieces[sl] = wr[sl] || null; });
          return Pm.setup(u2, lk, pieces);
        }
        var patch = lookPatchOf(e2 ? e2.look : base.look, lk);
        if (Object.keys(patch).length) { r = Pm.setLook(u2, id, patch); if (!r.ok) return r; }
        var was = e2 ? e2.wear : {}, slots = wearDiffOf(was, wr);
        for (var i = 0; i < slots.length; i++) { r = Pm.wear(u2, id, wr[slots[i]] || was[slots[i]]); if (!r.ok) return r; }
        return { ok: true };
      }).then(function (r) { busy = false; return !!(r && r.ok); });
    }
    function leave(next) {
      var go = function (saved) {
        s.close();
        if (next === 'wardrobe' && (saved || !fresh)) return openMy(ctx, { view: 'wardrobe' }).then(function () { res({ saved: saved }); });
        res({ saved: saved });
      };
      if (!dirty() && !(fresh && next === 'wardrobe')) return go(false);   /* the wardrobe needs a saved 'Me' */
      ask(ctx, tx('char.keep'), tx('photo.yes'), tx('photo.no')).then(function (keep) {
        if (!keep) return go(false);
        save().then(function (ok) { if (ok) go(true); });
      });
    }
    ['.slp-tools', '.slp-tabs', '.slp-foot'].forEach(function (sel) { bind(s.body.querySelector(sel), handlers); });
    draw();
    if (o.photo) applyPhoto(o.photo);
    focusFirst(s);
  }

  /* ================================================================
     THE CAST CAROUSEL
     ================================================================ */
  function openCast(ctx) {
    return new Promise(function (res) {
      var s = sheet(ctx, { title: tx('char.cast.title'), cls: 'slp-castsheet' }), playing = null, bought = false;
      s.onClosed = function () { if (playing) playing.stop(); if (!bought) res(); };   /* after a purchase: when its cards are done */
      function draw() {
        var u = userOf(ctx), st = { buy: typeof ctx.buy === 'function' };
        s.body.innerHTML = '<ul class="slp-castlist">' + castCards(u, { trial: trialOf(ctx) }).map(function (c) { return castHtml(ctx, c, st); }).join('') + '</ul>' + liveHtml();
        bind(s.body, on);
        fillCards(ctx, s.body);
      }
      var on = {
        play: function (b) {
          var id = b.getAttribute('data-v');
          commit(ctx, function (u) { return P().setActive(u, id); }).then(function (r) { if (r.ok) { sound(ctx, SOUND.pick); draw(); say(s, tx('char.cast.play', { name: itemName(id) })); } });
        },
        goal: function (b) {
          var id = b.getAttribute('data-v');
          commit(ctx, function (u) { var w = C().ensureWorld(u); return C().setGoal(u, C().goalId(w) === id ? null : id); }).then(function (r) { if (r.ok) { sound(ctx, SOUND.pick); draw(); } });
        },
        move: function (b) {
          var id = b.getAttribute('data-v'), li = s.body.querySelector('li[data-id="' + id + '"]'), pic = li && li.querySelector('.slp-castpic'), c = P().castOf(id);
          if (!pic || !c || !c.move) return;
          if (playing) playing.stop();
          pic.innerHTML = stageHtml('card');
          var pv = preview(Object.assign({}, ctx, { use3D: false }), pic.querySelector('.slp-stage'), P().display(id));
          var mine = playing = { stop: function () { pv.stop(); pic.innerHTML = picHtml(id, ctx); fillCards(ctx, pic); } };
          pv.play(c.move.id);
          later(ctx, function () { if (playing === mine) { playing = null; if (pic.isConnected) mine.stop(); } }, Math.round((c.move.sec + 1.8) * 1000));
        },
        buy: function (b) {
          var id = b.getAttribute('data-v'), name = itemName(id);
          b.disabled = true;
          Promise.resolve(ctx.buy(id)).then(function (r) {
            if (!(r === true || (r && r.ok))) { b.disabled = false; return; }
            sound(ctx, SOUND.buy);
            bought = true; s.close();
            afterBuy(ctx, id, name).then(function () { res(); }, function () { res(); });
          }, function () { b.disabled = false; });
        }
      };
      draw();
      focusFirst(s);
    });
  }
  /* bought: the debut turntable → 'Play as {name} now?' → 'Make it look like me' (when 'Me' exists) */
  function afterBuy(ctx, id, name) {
    var w = worldOf(ctx), d = P().display(id);
    return debut(ctx, d, name).then(function () {
      if (P().activeOf(worldOf(ctx)) === id) return true;
      return ask(ctx, tx('char.cast.playNow', { name: name }), tx('char.cast.play', { name: name }), tx('char.cast.notNow'), { desc: d }).then(function (yes) {
        return yes ? commit(ctx, function (u) { return P().setActive(u, id); }).then(function () { return true; }) : false;
      });
    }).then(function () {
      if (!w || !entryOf(worldOf(ctx), userOf(ctx), 'char_me')) return;
      return ask(ctx, name, tx('char.likeMe'), tx('char.cast.notNow')).then(function (yes) {
        if (yes) return commit(ctx, function (u) { return P().likeMe(u, id); });
      });
    });
  }

  /* ================================================================
     MY CHARACTER (A6): it opens on the Wardrobe (wear what you have), with one way to another
     character and Moves and Find me under More
     ================================================================ */
  /* its three views: 👕 the Wardrobe (the default), 🔁 Change character (yours to switch to, then Pick a
     character for the rest of the cast) and ✨ More (Moves, Find me on the island, Make it look like me).
     'moves' (a caller from before A6) opens More, anything else the Wardrobe */
  var MY_VIEWS = ['wardrobe', 'switch', 'more'];
  function myView(v) { return v === 'moves' ? 'more' : MY_VIEWS.indexOf(v) >= 0 ? v : 'wardrobe'; }
  /* the slot the wardrobe opens on: the first that has something of the child's to wear (Outfits once
     there is one, else Tops: the free basics) */
  function firstSlot(w, u, id) {
    for (var i = 0; i < WSLOTS.length; i++) if (wardrobeTab(w, u, id, WSLOTS[i]).cards.length) return WSLOTS[i];
    return 'top';
  }
  function openMy(ctx, o) {
    o = o || {};
    var u = userOf(ctx), w = C().ensureWorld(u), a0 = P().avatarInfo(w, u);
    if (!a0) return meetCard(ctx);                                    /* no character yet: the same three choices */
    return new Promise(function (res) {
      var s = sheet(ctx, { title: tx('char.my'), cls: 'slp-my' }), view = myView(o.view), pv = null;
      var slot = WSLOTS.indexOf(o.slot) >= 0 ? o.slot : firstSlot(w, u, a0.id);
      s.onClosed = function () { if (pv) pv.stop(); res(); };
      function info() { var u2 = userOf(ctx); return P().avatarInfo(C().ensureWorld(u2), u2); }
      function nav() {
        return '<div class="slp-nav">' + btn('view', tx('wardrobe.title'), { v: 'wardrobe', icon: '👕', pressed: view === 'wardrobe' }) +
          btn('change', tx('char.change'), { icon: '🎨' }) + btn('view', tx('char.changeChar'), { v: 'switch', icon: '🔁', pressed: view === 'switch' }) +
          btn('view', tx('char.more'), { v: 'more', icon: '✨', pressed: view === 'more' }) + '</div>';
      }
      function sub() {
        var u2 = userOf(ctx), w2 = C().ensureWorld(u2), a = info();
        if (view === 'switch') {
          return '<div class="slp-switch" role="group" aria-label="' + esc(tx('char.changeChar')) + '">' + P().charList(w2, u2).map(function (c) {
            return '<button type="button" class="slp-who' + (c.active ? ' on' : '') + '" data-a="switchTo" data-v="' + c.id + '" aria-pressed="' + c.active + '">' +
              (A() ? A().portrait(c, { size: 56, color: memberOf(ctx) }) : '') + '<span>' + esc(c.name) + '</span></button>';
          }).join('') + '</div><p class="slp-pick">' + btn('cast', tx('char.meet.pick'), { icon: '⭐' }) + '</p>';
        }
        if (view === 'more') {
          var me = entryOf(w2, u2, 'char_me');
          return '<section class="slp-extra"><h3>' + esc(tx('char.moves')) + '</h3><div class="slp-moves" role="group" aria-label="' + esc(tx('char.moves')) + '">' +
            EMOTES.map(function (m) { return btn('emote', m[1], { v: m[0], cls: 'slw-btn slp-emote' }); }).join('') +
            (a.sig ? btn('emote', tx('move.' + a.sig), { v: a.sig, icon: '✦', cls: 'slw-btn on' }) : '') + '</div>' +
            '<div class="slp-col slp-extra-acts">' + (typeof ctx.findMe === 'function' ? btn('findMe', tx('char.findMe'), { icon: '📍' }) : '') +
            (a.id !== 'char_me' && me ? btn('likeMe', tx('char.likeMe'), { icon: '🪞' }) : '') + '</div></section>';
        }
        return '<div class="slp-slots" role="tablist">' + WSLOTS.map(function (sl) {
          return '<button type="button" class="slw-btn slp-slot' + (sl === slot ? ' on' : '') + '" role="tab" data-a="slot" data-v="' + sl + '" aria-selected="' + (sl === slot) + '">' + esc(tx('wardrobe.slot.' + sl)) + '</button>';
        }).join('') + '</div>' + wardrobeHtml(ctx, wardrobeTab(w2, u2, a.id, slot), { shop: typeof ctx.openShop === 'function' });
      }
      function draw(keep) {
        var a = info();
        if (!a) { s.close(); return; }
        if (!keep || !pv) {
          if (pv) pv.stop();
          s.body.innerHTML = '<div class="slp-top">' + stageHtml() + '<div class="slp-who-nm"><h3>' + esc(a.name) + '</h3></div></div>' + nav() + '<div class="slp-sub"></div>' + liveHtml();
          pv = preview(ctx, s.body.querySelector('.slp-stage'), a);
          bind(s.body.querySelector('.slp-nav'), on);
        } else pv.set(a);
        var el = s.body.querySelector('.slp-sub');
        el.innerHTML = sub();
        bind(el, on);
        s.body.querySelectorAll('.slp-nav [data-a="view"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === view)); });
        var strip = el.querySelector('.slp-slots'), chip = strip && strip.querySelector('.slp-slot.on');
        var x = chip && typeof chip.offsetLeft === 'number' ? chip.offsetLeft - strip.offsetLeft : 0;
        if (chip && x + chip.offsetWidth > strip.clientWidth) strip.scrollLeft = x + chip.offsetWidth - strip.clientWidth + 24;   /* the chosen slot in view */
        fillCards(ctx, el);
      }
      function write(fn, snd, text) { return commit(ctx, fn).then(function (r) { if (r.ok) { if (snd) sound(ctx, snd); draw(true); if (text) say(s, text); } return r; }); }
      var on = {
        view: function (b) { view = myView(b.getAttribute('data-v')); draw(true); },
        slot: function (b) { slot = b.getAttribute('data-v'); draw(true); var t = s.body.querySelector('.slp-slot[data-v="' + slot + '"]'); try { if (t) t.focus(); } catch (x) { /* ignore */ } },
        wear: function (b) {
          var wid = b.getAttribute('data-v'), a = info();
          write(function (u2) { return P().wear(u2, a.id, wid); }, SOUND.wear, itemName(wid)).then(function () { var n = s.body.querySelector('.slp-wbtn[data-v="' + wid + '"]'); try { if (n) n.focus(); } catch (x) { /* ignore */ } });
        },
        dye: function (b) { var it = P().item(b.getAttribute('data-v')), a = info(); write(function (u2) { return P().setLook(u2, a.id, { hc: it.hc }); }, SOUND.pick, it.name); },
        cw: function (b) {
          var wid = b.getAttribute('data-v'), a = info(), it = P().item(wid), n = ((a.vr[wid] || 0) + 1) % it.cw;
          write(function (u2) { return P().setColourway(u2, a.id, wid, n); }, SOUND.pick, tx('wardrobe.colour'));
        },
        shop: function (b) { var sl = b.getAttribute('data-v'); s.close(); ctx.openShop(sl); },
        switchTo: function (b) {
          var id = b.getAttribute('data-v'), c = P().castOf(id);
          write(function (u2) { return P().setActive(u2, id); }, SOUND.pick, nameOf(ctx, id)).then(function (r) { if (r.ok) { draw(); pv.play(c && c.move ? c.move.id : 'wave'); } });
        },
        emote: function (b) { pv.play(b.getAttribute('data-v')); },
        change: function () { var id = info().id; s.close(); openCreator(ctx, { id: id }).then(function () { openMy(ctx, {}); }); },
        likeMe: function () { var id = info().id; write(function (u2) { return P().likeMe(u2, id); }, SOUND.pick, tx('char.likeMe')).then(function () { draw(); }); },
        cast: function () { s.close(); openCast(ctx); },
        findMe: function () { s.close(); ctx.findMe(); }
      };
      draw();
      focusFirst(s);
    });
  }

  /* ================================================================
     TRY IT ON (the Island Shop's detail sheet; preview only, nothing is worn or bought)
     ================================================================ */
  function tryOn(ctx, wearId) {
    var u = userOf(ctx), d = tryOnDesc(C().ensureWorld(u), u, wearId);
    if (!d) return Promise.resolve();
    return new Promise(function (res) {
      var s = sheet(ctx, { title: tx('wardrobe.tryOn'), small: true, cls: 'slp-tryon' });
      s.body.innerHTML = stageHtml() + '<p class="slp-lead">' + esc(itemName(wearId)) + '</p><div class="slp-row">' + btn('ok', tx('celebrate.ok'), { cls: 'slw-btn big on' }) + '</div>';
      var pv = preview(ctx, s.body.querySelector('.slp-stage'), d, { view: P().item(wearId).slot === 'back' ? 'back' : 'front' });
      s.onClosed = function () { pv.stop(); res(); };
      bind(s.body, { ok: s.close });
      focusFirst(s);
    });
  }

  return {
    VERSION: VERSION, UNDO_MAX: UNDO_MAX, TABS: TABS, WSLOTS: WSLOTS, SOUND: SOUND, EMOTES: EMOTES,
    meetCard: meetCard, openCreator: openCreator, openCast: openCast, openMy: openMy, tryOn: tryOn,
    photoGate: photoGate, photoDecision: photoDecision, photoResult: photoResult,
    draft: draft, lookPatchOf: lookPatchOf, wearDiffOf: wearDiffOf,
    creatorTab: creatorTab, castCards: castCards, wardrobeTab: wardrobeTab, tryOnDesc: tryOnDesc,
    panelHtml: panelHtml, castHtml: castHtml, wardrobeHtml: wardrobeHtml, tokenName: tokenName
  };
}));
