/* ================================================================
   My Island — 'Start from a photo', the sheet (kids update KU-CH14).
   window.SLPhotoCartoonUI in the browser: window.slLoadPhoto() loads it
   once, after photo-cartoon.js (SLPhotoCartoon, KU-CH6), only when the
   creator's photo button or its mirror button is tapped (plan-ku KU21).

   What it does (characters.json photoToCartoon.pipeline 2-6, plan-ku KU17):
     explainer → 'Use the camera': a mirrored live video in a round mask
       with the face oval, Snap, a 3-2-1 countdown (one change a second),
       one frame drawn into the 160 x 160 crop, every camera track stopped
       at once, a 0.4 s iris close (never a white flash; reduced motion
       shows it closed)
     explainer → 'Pick a photo': the file goes through decodeFile(), the
       one helper that turns a file into pixels; FaceDetector places the
       oval when the browser has one (400 ms at most), else the child drags
       it and sizes it with the slider, then 'Use this photo' takes the crop
     then SLPhotoCartoon.sample() reads the crop, and EVERYTHING is wiped
       (tracks, video, crop and working canvases, pixels, bitmap, file
       input, file) before the next thing is drawn; the result card shows
       'Photo deleted', a pixel cartoon head in the picked colours (drawn
       from palette indices only, never from a photo pixel) and 'Do you
       wear glasses?'. A low result says so and applies nothing.

   The mirror (KU17): openMirror(panel) shows the front camera live in a
   round mask beside the creator's preview while the child picks
   hairstyle, eyes and glasses themselves. The stream goes to a <video>
   and nowhere else: it is never drawn to a canvas, sampled, captured or
   kept. Every track stops when the mirror closes: its own button,
   close(), closeAll(), the panel leaving the page, pagehide, the page
   hiding, an AbortSignal, or a camera that answers after it closed.

   Privacy, by construction: no storage, no network, no copies (no data
   or blob URL of a canvas, no recorder), nothing typed. The only object
   URL is decodeFile()'s, made and revoked inside that one call when the
   browser has no createImageBitmap. tests/photo-cartoon-ui.test.js scans
   this file and runs every path with fakes. Consent and the password rule
   are the creator's (people-ui reads kids/{uid}.photo; this file has no
   Firestore at all).

     open(opts) → Promise<null | {sk, hc?, long, glasses}>
         sk, hc   palette indices for the creator's draft (hc only when hair
                  was found); long   the long-hair hint (list long styles
                  first; never stored); glasses   true | false | null (the
                  child's answer). null: closed, not now, or unclear.
         opts     {look (the draft, for the cartoon's other colours),
                  start: 'camera' | 'file' (skip the explainer), reduced,
                  signal, parent, onStep(step) (the lab and the tests)}
     applyTo(look, result) → a copy of look with only sk and hc changed
     openMirror(panel, opts?) → close(): a function that also has .close,
                  .closed() and .ready (a Promise<boolean>: live or not)
     closeAll()   closes the sheet and every mirror (wipes, stops tracks)
     decodeFile(file, max?) → Promise<canvas> (≤ max px a side, 640)
     isOpen()     a sheet or a mirror is showing
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object' && !root.SLPhotoCartoonUI) root.SLPhotoCartoonUI = api;
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var VERSION = 1;
  var MAX_SIDE = 640, MAX_BYTES = 30000000, FACE_MS = 400, DECODE_MS = 20000, IRIS_MS = 400, TICK_MS = 1000;
  var CAMERA = { video: { facingMode: 'user', width: { ideal: 640 } }, audio: false };

  function W() { return root || {}; }
  function P() { var p = W().SLPhotoCartoon; return p && typeof p.sample === 'function' && typeof p.wipe === 'function' ? p : null; }
  function T(key) { var C = W().SLWorldCopy; return C && typeof C.t === 'function' ? C.t(key) : key; }
  function docOf(o) { return (o && o.doc) || W().document || null; }
  function later(fn, ms) { var st = W().setTimeout; return typeof st === 'function' ? st(fn, ms) : null; }
  function cancel(id) { var ct = W().clearTimeout; if (id != null && typeof ct === 'function') ct(id); }
  function reducedMotion(o) {
    if (o && typeof o.reduced === 'boolean') return o.reduced;
    try { var mm = W().matchMedia; return !!(mm && mm('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function isIdx(v) { return typeof v === 'number' && (v | 0) === v && v >= 0 && v <= 9; }
  function mediaOf() { var n = W().navigator, m = n && n.mediaDevices; return m && typeof m.getUserMedia === 'function' ? m : null; }

  /* ---------------- the one way a picked file becomes pixels (KU17) ----------------
     createImageBitmap(file) with no options (old Safari has no resize options), drawn
     scaled into a working canvas; without it, an Image on an object URL that is made and
     revoked inside this call. The bitmap is closed and the URL revoked whatever happens. */
  function fit(w, h, max) { var k = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; }
  function toCanvas(doc, src, w, h, max) {
    if (!(w > 0) || !(h > 0)) throw new Error('empty picture');
    var s = fit(w, h, max), c = doc.createElement('canvas');
    c.width = s.w; c.height = s.h;
    c.getContext('2d').drawImage(src, 0, 0, s.w, s.h);
    return c;
  }
  function decodeFile(file, max, doc) {
    var win = W();
    max = max > 0 ? max : MAX_SIDE;
    doc = doc || win.document;
    return new Promise(function (resolve, reject) {
      if (!file || !doc) { reject(new Error('no file')); return; }
      if (typeof file.size === 'number' && file.size > MAX_BYTES) { reject(new Error('too big')); return; }
      if (typeof win.createImageBitmap === 'function') {
        win.createImageBitmap(file).then(function (bmp) {
          try { resolve(toCanvas(doc, bmp, bmp.width, bmp.height, max)); } catch (e) { reject(e); } finally { try { bmp.close(); } catch (e2) { /* gone */ } }
        }, reject);
        return;
      }
      var U = win.URL, img = typeof win.Image === 'function' ? new win.Image() : null, url = null, timer = null, settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        cancel(timer);
        try {
          if (ok) resolve(toCanvas(doc, img, img.naturalWidth || img.width, img.naturalHeight || img.height, max));
          else reject(new Error('could not decode'));
        } catch (e) { reject(e); } finally {
          if (url !== null) U.revokeObjectURL(url);
          url = null;
          if (img) { img.onload = null; img.onerror = null; }
        }
      }
      if (!img || !U) { done(false); return; }
      img.onload = function () { done(true); };
      img.onerror = function () { done(false); };
      try { url = U.createObjectURL(file); img.src = url; timer = later(function () { done(false); }, DECODE_MS); } catch (e) { done(false); }
    });
  }

  /* ---------------- KU16: what a result may change ---------------- */
  function applyTo(look, res) {
    var out = {}, src = look && typeof look === 'object' ? look : {};
    Object.keys(src).forEach(function (k) { out[k] = src[k]; });
    if (res && isIdx(res.sk)) out.sk = res.sk;
    if (res && isIdx(res.hc)) out.hc = res.hc;
    return out;
  }

  /* ---------------- drawing helpers (createElement and textContent only) ---------------- */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = text;
    return n;
  }
  function add(parent, tag, cls, text) { return parent.appendChild(el(parent.ownerDocument, tag, cls, text)); }
  function btn(parent, key, cls, act, fn, icon) {
    var b = add(parent, 'button', 'slw-btn slp-btn' + (cls ? ' ' + cls : ''));
    b.setAttribute('type', 'button');
    b.setAttribute('data-slp', act);
    if (icon) add(b, 'span', 'slp-ic', icon).setAttribute('aria-hidden', 'true');
    add(b, 'span', '', T(key));
    b.addEventListener('click', fn);
    return b;
  }
  var CSS = [
    '.slp-ov{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(27,33,80,.45);}',
    '.slp-sheet{position:relative;box-sizing:border-box;width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fff;color:#1B2150;border:4px solid #2B3A80;border-radius:16px;padding:18px 16px 20px;text-align:center;}',
    '.slp-sheet h2{margin:0 0 8px;padding:0 48px;font-size:22px;line-height:1.2;}',
    '.slp-sheet .slw-x{position:absolute;right:10px;top:10px;}',
    '.slp-sheet p{margin:6px auto;max-width:34em;font-size:16px;line-height:1.4;}',
    '.slp-sheet .slp-tip{font-weight:700;}',
    '.slp-sheet .slp-soft{color:#474E7E;font-size:15px;}',
    '.slp-row{display:flex;flex-wrap:wrap;gap:10px 12px;justify-content:center;margin:14px 0 2px;}',
    '.slp-btn{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;}',
    '.slp-btn .slp-ic{font-size:20px;line-height:1;}',
    '.slp-stage{position:relative;box-sizing:border-box;width:min(76vw,300px);height:min(76vw,300px);margin:8px auto 10px;border-radius:50%;overflow:hidden;',
    'background:#DAF2FF;border:4px solid #2B3A80;box-shadow:0 5px 0 0 rgba(27,33,80,.22);}',
    '.slp-stage video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;}',
    '.slp-oval{position:absolute;box-sizing:border-box;left:18.125%;top:10%;width:63.75%;height:80%;border:3px dashed #fff;border-radius:50%;',
    'box-shadow:0 0 0 2px rgba(27,33,80,.7),inset 0 0 0 2px rgba(27,33,80,.7);pointer-events:none;}',
    '.slp-count{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font-size:104px;font-weight:700;color:#fff;',
    'text-shadow:0 5px 0 #1B2150,0 0 6px rgba(27,33,80,.9);font-variant-numeric:tabular-nums;pointer-events:none;}',
    '.slp-iris{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;box-shadow:inset 0 0 0 0 #1B2150;transition:box-shadow .4s ease-in;pointer-events:none;}',
    '.slp-iris.shut{box-shadow:inset 0 0 0 190px #1B2150;}',
    '.slp-still .slp-iris{transition:none;}',
    '.slp-snapped .slp-oval{display:none;}',
    '.slp-place{position:relative;display:inline-block;margin:8px auto 4px;overflow:hidden;border:4px solid #2B3A80;border-radius:10px;touch-action:none;cursor:grab;line-height:0;}',
    '.slp-place canvas{display:block;}',
    '.slp-place .slp-oval{box-shadow:0 0 0 9999px rgba(27,33,80,.5),0 0 0 2px rgba(27,33,80,.7);pointer-events:auto;cursor:move;}',
    '.slp-place .slp-oval:focus-visible{outline:none;border-color:#FFD23F;border-style:solid;}',
    '.slp-size{display:block;width:min(100%,300px);min-height:44px;margin:4px auto 0;accent-color:#5B3FD6;}',
    '.slp-face{display:flex;align-items:flex-end;justify-content:center;gap:16px;margin:6px 0;}',
    '.slp-face svg{width:132px;height:132px;display:block;}',
    '.slp-dots{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;}',
    '.slp-dots i{display:block;width:24px;height:24px;border-radius:50%;border:2px solid #1B2150;}',
    '.slp-chip{display:inline-flex;align-items:center;gap:6px;margin:4px auto;padding:5px 14px;border-radius:999px;background:#DFF7E6;color:#17663A;',
    'border:2px solid #17663A;font-weight:800;font-size:15px;}',
    '.slp-q{font-weight:800;font-size:18px;}',
    '.slp-busy{min-height:120px;display:flex;align-items:center;justify-content:center;}',
    '.slp-busy i{width:18px;height:18px;margin:0 5px;border-radius:4px;background:#5B3FD6;opacity:.35;}',
    '.slp-mirror{display:inline-flex;flex-direction:column;align-items:center;gap:6px;margin:4px auto;max-width:170px;text-align:center;vertical-align:top;}',
    '.slp-mround{position:relative;box-sizing:border-box;width:min(34vw,150px);height:min(34vw,150px);min-width:112px;min-height:112px;border-radius:50%;',
    'overflow:hidden;background:#DAF2FF;border:4px solid #2B3A80;box-shadow:0 4px 0 0 rgba(27,33,80,.22);}',
    '.slp-mround video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;}',
    '.slp-mnote{margin:0;font-size:13px;line-height:1.3;color:#474E7E;font-weight:600;}',
    '.slp-mirror .slp-btn{padding:6px 12px;font-size:14px;}',
    '.slp-vh{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0;}',
    '@media (max-width:480px){.slp-ov{align-items:flex-end;padding:0;}.slp-sheet{border-radius:18px 18px 0 0;max-height:94vh;}}'
  ].join('');
  function css(doc) {
    if (!doc || (doc.getElementById && doc.getElementById('slpCss'))) return;
    var s = doc.createElement('style');
    s.setAttribute('id', 'slpCss');
    s.textContent = CSS;
    (doc.head || doc.body).appendChild(s);
  }

  /* The cartoon head on the result card: 16 x 16 pixels in the palette colours the result
     picked (s skin, h hair, e/w eyes, r cheeks, m mouth, t top), an outline round it. */
  var HEAD = ['................', '.....hhhhhh.....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hsshhhhhhssh..',
    '..hssssssssssh..', '..hssssssssssh..', '..hsswesswessh..', '..ssseesseesss..', '...srssssssrs...', '...ssssmmssss...',
    '....ssssssss....', '......ssss......', '...tttttttttt...', '..tttttttttttt..'];
  function palettes() {
    var C = W().SLPeopleCore, p = P(), hex = function (e) { return typeof e === 'string' ? e : Array.isArray(e) ? e[1] : null; };
    var sk = C && C.PALETTES && C.PALETTES.skin, hc = C && C.PALETTES && C.PALETTES.hairNatural;
    return {
      skin: (sk && sk.length >= 10 ? sk : p ? p.PALETTE.skin : []).map(hex),
      hair: (hc && hc.length >= 10 ? hc : p ? p.PALETTE.hairNatural : []).map(hex)
    };
  }
  function headSvg(doc, sk, hc, long) {
    var pal = palettes(), grid = HEAD.map(function (r) { return r.split(''); }), x, y;
    var col = { s: pal.skin[isIdx(sk) ? sk : 4] || '#CF956C', h: pal.hair[isIdx(hc) ? hc : 1] || '#3B2A22', e: '#1E1B22', w: '#F7F4EE',
      r: '#F08A9A', m: sk >= 6 ? '#F09AA5' : '#7A3341', t: '#FFD23F', o: '#14101F' };
    if (long) for (y = 5; y <= 14; y++) { grid[y][1] = grid[y][2] = 'h'; grid[y][13] = grid[y][14] = 'h'; }
    var filled = function (yy, xx) { return yy >= 0 && yy < 16 && xx >= 0 && xx < 16 && grid[yy][xx] !== '.' && grid[yy][xx] !== 'o'; };
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      if (grid[y][x] === '.' && (filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1))) grid[y][x] = 'o';
    }
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      var c = grid[y][x];
      if (c === '.') continue;
      var r = doc.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(x)); r.setAttribute('y', String(y)); r.setAttribute('width', '1'); r.setAttribute('height', '1');
      r.setAttribute('fill', col[c]);
      if (c === 'o') r.setAttribute('fill-opacity', '0.7');
      if (c === 'r') r.setAttribute('fill-opacity', '0.55');
      svg.appendChild(r);
    }
    return svg;
  }

  /* ---------------- the sheet ---------------- */
  var current = null, mirrors = [];

  function open(opts) {
    var o = opts && typeof opts === 'object' ? opts : {}, doc = docOf(o), PC = P();
    if (!doc || !PC || !doc.body) return Promise.resolve(null);
    if (current) current.finish(null);
    closeMirrors();
    return new Promise(function (resolve) { current = sheet(doc, PC, o, resolve); });
  }

  function sheet(doc, PC, o, resolve) {
    var H = {}, timers = [], over = false, step = '', look = o.look && typeof o.look === 'object' ? o.look : {}, still = reducedMotion(o);
    var opener = doc.activeElement, win = W(), result = null;
    css(doc);
    var ov = el(doc, 'div', 'slw-ov slp-ov'), box = add(ov, 'div', 'slw-sheet small slp-sheet' + (still ? ' slp-still' : ''));
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('data-sl-modal', '1');
    ov.setAttribute('data-slp', 'sheet');
    var x = add(box, 'button', 'slw-x', '✕');
    x.setAttribute('type', 'button');
    x.setAttribute('aria-label', T('photo.notNow'));
    x.setAttribute('data-slp', 'close');
    x.addEventListener('click', function () { finish(result); });
    var h2 = add(box, 'h2', '', T('photo.title'));
    h2.setAttribute('id', 'slpTitle');
    ov.setAttribute('aria-labelledby', 'slpTitle');
    var body = add(box, 'div', 'slp-body'), live = add(box, 'div', 'slp-vh');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    (o.parent || doc.body).appendChild(ov);

    function say(text) { live.textContent = text; }
    function wait(fn, ms) { var id = later(function () { timers = timers.filter(function (t) { return t !== id; }); if (!over) fn(); }, ms); timers.push(id); }
    function wipe() { var done = PC.wipe(H); H = {}; return done; }
    function mark(name) { step = name; ov.setAttribute('data-step', name); if (typeof o.onStep === 'function') { try { o.onStep(name); } catch (e) { /* the lab's hook */ } } }
    function clear() { body.textContent = ''; }
    function focusFirst() { var b = body.querySelector('button'); if (b && typeof b.focus === 'function') { try { b.focus(); } catch (e) { /* hidden */ } } }
    function row() { return add(body, 'div', 'slp-row'); }

    /* every way out ends here: tracks off, pictures gone, then the sheet goes */
    function finish(value) {
      if (over) return;
      over = true;
      wipe();
      timers.forEach(cancel);
      timers = [];
      off();
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (current && current.ov === ov) current = null;
      /* back to the opener without moving the page, as every island sheet does (c-island) */
      try { if (opener && opener !== doc.body && typeof opener.focus === 'function' && opener.isConnected !== false) opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
      resolve(value || null);
    }
    function onKey(e) { if (e && e.key === 'Escape' && current && current.ov === ov) finish(result); }
    /* the page going away ends the sheet; a result already on screen still counts */
    function onHide() { finish(result); }
    function onVis() { if (doc.visibilityState === 'hidden' || doc.hidden === true) finish(result); }
    function onAbort() { finish(null); }
    function off() {
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('visibilitychange', onVis);
      if (typeof win.removeEventListener === 'function') win.removeEventListener('pagehide', onHide);
      if (o.signal && typeof o.signal.removeEventListener === 'function') o.signal.removeEventListener('abort', onAbort);
    }
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('visibilitychange', onVis);
    if (typeof win.addEventListener === 'function') win.addEventListener('pagehide', onHide);
    if (o.signal) { if (o.signal.aborted) later(onAbort, 0); else if (typeof o.signal.addEventListener === 'function') o.signal.addEventListener('abort', onAbort); }
    ov.addEventListener('click', function (e) { if (e && e.target === ov) finish(result); });

    /* 2 the explainer */
    function explain() {
      wipe(); clear(); mark('explain'); result = null;
      var face = add(body, 'div', 'slp-face');
      face.appendChild(headSvg(doc, look.sk, look.hc, false));
      add(body, 'p', '', T('photo.explain'));
      var r = row();
      if (mediaOf()) btn(r, 'photo.camera', 'big on', 'camera', camera, '📷');
      btn(r, 'photo.pick', mediaOf() ? '' : 'big on', 'pick', pick, '🖼️');
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      focusFirst();
    }
    function busy() {
      clear();
      var b = add(body, 'div', 'slp-busy');
      b.setAttribute('aria-hidden', 'true');
      add(b, 'i'); add(b, 'i'); add(b, 'i');
    }
    function noCamera() {
      wipe(); clear(); mark('nocamera');
      add(body, 'div', 'slp-face').appendChild(headSvg(doc, look.sk, look.hc, false));
      add(body, 'p', 'slp-tip', T('photo.noCamera'));
      var r = row();
      btn(r, 'photo.pick', 'big on', 'pick', pick, '🖼️');
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      focusFirst();
    }
    function unclear(snapped) {
      wipe(); clear(); mark('unclear'); result = null;
      if (snapped) chip();
      add(body, 'div', 'slp-face').appendChild(headSvg(doc, look.sk, look.hc, false));
      add(body, 'p', 'slp-tip', T('photo.unclear'));
      var r = row();
      btn(r, 'photo.again', 'big on', 'again', explain);
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      focusFirst();
    }
    function chip() {
      var c = add(body, 'div', 'slp-chip');
      c.setAttribute('data-slp', 'deleted');
      add(c, 'span', '', '✓').setAttribute('aria-hidden', 'true');
      add(c, 'span', '', T('photo.deleted'));
      say(T('photo.deleted'));
    }

    /* 3a the camera */
    function camera() {
      var media = mediaOf();
      if (!media) { noCamera(); return; }
      wipe(); clear(); mark('camera');
      var stage = add(body, 'div', 'slp-stage'), video = el(doc, 'video');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('disablepictureinpicture', '');
      video.setAttribute('aria-hidden', 'true');
      video.muted = true;
      stage.appendChild(video);
      add(stage, 'div', 'slp-oval');
      var count = add(stage, 'div', 'slp-count'), iris = add(stage, 'div', 'slp-iris');
      count.setAttribute('aria-hidden', 'true');
      add(body, 'p', 'slp-tip', T('photo.frame'));
      add(body, 'p', 'slp-soft', T('photo.light'));
      var r = row(), snap = btn(r, 'photo.snap', 'big on', 'snap', go, '📷');
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      snap.disabled = true;
      H.video = video;
      var mine = step;
      function ready() { if (!over && step === mine && H.stream && snap.disabled && !counting) { snap.disabled = false; focusFirst(); } }
      var counting = false;
      media.getUserMedia(CAMERA).then(function (stream) {
        /* the sheet closed or moved on while the device was asking: the camera goes off again at once */
        if (over || step !== mine) { PC.stopTracks(stream); return; }
        H.stream = stream;
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', ready);
        var p = null;
        try { p = typeof video.play === 'function' ? video.play() : null; } catch (e) { p = null; }
        if (p && typeof p.then === 'function') p.then(ready, ready); else ready();
      }, function () { if (!over && step === mine) noCamera(); });

      function go() {
        if (counting || snap.disabled) return;
        counting = true;
        snap.disabled = true;
        var n = 3;
        (function tick() {
          if (n === 0) { capture(); return; }
          count.textContent = String(n);
          say(String(n));
          n--;
          wait(tick, TICK_MS);
        }());
      }
      /* one frame, then the camera goes off, the crop is read and everything is wiped,
         all before the iris (the first thing drawn afterwards) */
      function capture() {
        var vw = video.videoWidth, vh = video.videoHeight, res = null;
        try {
          if (!(vw > 0) || !(vh > 0)) throw new Error('no frame');
          var m = Math.min(vw, vh), r = PC.cropRect({ cx: vw / 2, cy: vh / 2, ry: m * PC.OVAL.ry / PC.SIZE }, vw, vh, PC.SIZE);
          var crop = H.crop = doc.createElement('canvas');
          crop.width = PC.SIZE; crop.height = PC.SIZE;
          var g = crop.getContext('2d', { willReadFrequently: true });
          g.drawImage(video, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
          PC.stopTracks(H.stream);
          var im = H.pixels = g.getImageData(0, 0, PC.SIZE, PC.SIZE);
          res = PC.sample(im.data, PC.SIZE, PC.SIZE);
        } catch (e) { res = null; }
        wipe();
        mark('iris');
        count.textContent = '';
        stage.className = 'slp-stage slp-snapped';
        iris.className = 'slp-iris shut';
        wait(function () { show(res); }, IRIS_MS);
      }
    }

    /* 3b pick a photo */
    function pick() {
      wipe(); clear(); mark('pick');
      var input = el(doc, 'input', 'slp-vh');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.setAttribute('tabindex', '-1');
      input.setAttribute('aria-hidden', 'true');
      input.setAttribute('data-slp', 'file');
      body.appendChild(input);
      H.input = input;
      var mine = step;
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f || over || step !== mine) return;
        H.file = f;
        busy(); mark('decode');
        decodeFile(f, MAX_SIDE, doc).then(function (work) {
          if (over || step !== 'decode') { PC.wipe({ work: work }); return; }
          H.work = work;
          if (typeof input.value === 'string') input.value = '';
          H.file = null;
          place(work);
        }, function () { if (!over) unclear(false); });
      });
      add(body, 'div', 'slp-face').appendChild(headSvg(doc, look.sk, look.hc, false));
      var r = row();
      btn(r, 'photo.pick', 'big on', 'choose', choose, '🖼️');
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      focusFirst();
      /* the tap that got here opens the device's picker at once; the button is there if it was closed */
      function choose() { if (typeof input.click === 'function') { try { input.click(); } catch (e) { /* needs a tap */ } } }
      choose();
    }
    /* the picture with the oval on it: FaceDetector places it when there is one */
    function place(work) {
      var w = work.width, h = work.height, ry0 = Math.min(h * 0.32, w * 0.4 * PC.OVAL.ry / PC.OVAL.rx);
      var ov0 = { cx: w / 2, cy: h * 0.45, ry: ry0 };
      var FD = win.FaceDetector;
      if (typeof FD !== 'function') { draw(ov0); return; }
      var settled = false;
      function use(oval) { if (settled || over || step !== 'decode') return; settled = true; draw(oval || ov0); }
      wait(function () { use(null); }, FACE_MS);
      try {
        new FD({ fastMode: true, maxDetectedFaces: 1 }).detect(work).then(function (faces) {
          var b = faces && faces[0] && faces[0].boundingBox, fo = b ? PC.ovalFromBox(b) : null;
          use(fo && fo.ry > 4 ? fo : null);
        }, function () { use(null); });
      } catch (e) { use(null); }
    }
    function draw(start) {
      var work = H.work;
      if (!work) { unclear(false); return; }
      clear(); mark('place');
      var w = work.width, h = work.height, minR = Math.max(8, Math.min(w, h) * 0.08), maxR = Math.max(minR + 1, Math.min(h * 0.62, w * 0.62 * PC.OVAL.ry / PC.OVAL.rx));
      var at = { cx: start.cx, cy: start.cy, ry: Math.max(minR, Math.min(maxR, start.ry)) };
      var rect = box.getBoundingClientRect ? box.getBoundingClientRect() : null;
      var maxW = Math.max(160, Math.min(420, ((rect && rect.width) || 360) - 40)), maxH = Math.max(160, Math.min(420, (win.innerHeight || 700) * 0.5));
      var k = Math.min(maxW / w, maxH / h);
      var frame = add(body, 'div', 'slp-place');
      work.style.width = Math.round(w * k) + 'px';
      work.style.height = Math.round(h * k) + 'px';
      work.setAttribute('aria-hidden', 'true');
      frame.appendChild(work);
      var guide = add(frame, 'div', 'slp-oval');
      guide.setAttribute('tabindex', '0');
      guide.setAttribute('role', 'group');
      guide.setAttribute('aria-label', T('photo.move'));
      add(body, 'p', 'slp-tip', T('photo.move'));
      var size = add(body, 'input', 'slp-size');
      size.setAttribute('type', 'range');
      size.setAttribute('min', String(Math.round(minR)));
      size.setAttribute('max', String(Math.round(maxR)));
      size.setAttribute('step', '1');
      size.setAttribute('aria-label', T('photo.frame'));
      size.setAttribute('data-slp', 'size');
      size.value = String(Math.round(at.ry));
      var r = row();
      btn(r, 'photo.use', 'big on', 'use', use, '✓');
      btn(r, 'photo.notNow', '', 'notnow', function () { finish(null); });
      function clamp() {
        var rx = at.ry * PC.OVAL.rx / PC.OVAL.ry;
        at.cx = Math.max(Math.min(rx, w / 2), Math.min(w - Math.min(rx, w / 2), at.cx));
        at.cy = Math.max(Math.min(at.ry, h / 2), Math.min(h - Math.min(at.ry, h / 2), at.cy));
      }
      function paint() {
        clamp();
        var rx = at.ry * PC.OVAL.rx / PC.OVAL.ry;
        guide.style.left = Math.round((at.cx - rx) * k) + 'px';
        guide.style.top = Math.round((at.cy - at.ry) * k) + 'px';
        guide.style.width = Math.round(2 * rx * k) + 'px';
        guide.style.height = Math.round(2 * at.ry * k) + 'px';
      }
      var drag = null;
      frame.setAttribute('data-slp', 'place');
      frame.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, cx: at.cx, cy: at.cy };
        if (typeof frame.setPointerCapture === 'function' && e.pointerId != null) { try { frame.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } }
        if (e.preventDefault) e.preventDefault();
      });
      frame.addEventListener('pointermove', function (e) {
        if (!drag) return;
        at.cx = drag.cx + (e.clientX - drag.x) / k;
        at.cy = drag.cy + (e.clientY - drag.y) / k;
        paint();
      });
      function up() { drag = null; }
      frame.addEventListener('pointerup', up);
      frame.addEventListener('pointercancel', up);
      guide.addEventListener('keydown', function (e) {
        var d = Math.max(2, at.ry * 0.08), keys = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
        if (!e || !keys[e.key]) return;
        at.cx += keys[e.key][0]; at.cy += keys[e.key][1];
        paint();
        if (e.preventDefault) e.preventDefault();
      });
      size.addEventListener('input', function () { var v = Number(size.value); if (v > 0) { at.ry = v; paint(); } });
      paint();
      focusFirst();
      /* 'Use this photo': the 160 x 160 crop, read once, then everything is wiped before the card */
      function use() {
        var res = null;
        try {
          var cr = PC.cropRect({ cx: at.cx, cy: at.cy, ry: at.ry }, w, h, PC.SIZE);
          if (!cr) throw new Error('outside');
          var crop = H.crop = doc.createElement('canvas');
          crop.width = PC.SIZE; crop.height = PC.SIZE;
          var g = crop.getContext('2d', { willReadFrequently: true });
          g.drawImage(work, cr.sx, cr.sy, cr.sw, cr.sh, cr.dx, cr.dy, cr.dw, cr.dh);
          var im = H.pixels = g.getImageData(0, 0, PC.SIZE, PC.SIZE);
          res = PC.sample(im.data, PC.SIZE, PC.SIZE);
        } catch (e) { res = null; }
        wipe();
        show(res);
      }
    }

    /* 6 the result: 'Photo deleted', the cartoon in its new colours, the glasses question */
    function show(res) {
      if (over) return;
      var patch = PC.lookPatch(res);
      if (!patch) { unclear(true); return; }
      result = { sk: patch.sk, long: !!(res.long && isIdx(patch.hc)), glasses: null };
      if (isIdx(patch.hc)) result.hc = patch.hc;
      clear(); mark('result');
      chip();
      var face = add(body, 'div', 'slp-face'), pal = palettes(), dots = el(doc, 'div', 'slp-dots');
      face.appendChild(headSvg(doc, result.sk, isIdx(result.hc) ? result.hc : look.hc, result.long));
      dots.setAttribute('aria-hidden', 'true');
      add(dots, 'i').setAttribute('style', 'background:' + pal.skin[result.sk]);
      if (isIdx(result.hc)) add(dots, 'i').setAttribute('style', 'background:' + pal.hair[result.hc]);
      face.appendChild(dots);
      add(body, 'p', '', T('photo.result'));
      add(body, 'p', 'slp-q', T('photo.glassesQ'));
      var r = row();
      btn(r, 'photo.yes', 'big on', 'yes', function () { result.glasses = true; finish(result); });
      btn(r, 'photo.no', 'big on', 'no', function () { result.glasses = false; finish(result); });
      focusFirst();
    }

    if (o.start === 'camera' && mediaOf()) camera();
    else if (o.start === 'file') pick();
    else explain();
    return { ov: ov, finish: finish, step: function () { return step; } };
  }

  /* ---------------- the mirror ---------------- */
  function closeMirrors() { var n = 0; mirrors.slice().forEach(function (m) { if (!m.closed()) { m.close(); n++; } }); return n; }
  function openMirror(panel, opts) {
    var o = opts && typeof opts === 'object' ? opts : {}, doc = (panel && panel.ownerDocument) || docOf(o), win = W(), media = mediaOf(), PC = P();
    var stream = null, shut = false, watcher = null, box = null, video = null;
    function close() {
      if (shut) return;
      shut = true;
      if (stream) { if (PC) PC.stopTracks(stream); else stopAll(stream); }
      stream = null;
      if (video) { try { if (typeof video.pause === 'function') video.pause(); } catch (e) { /* gone */ } video.srcObject = null; }
      video = null;
      if (watcher && typeof watcher.disconnect === 'function') watcher.disconnect();
      watcher = null;
      if (doc) doc.removeEventListener('visibilitychange', onVis);
      if (typeof win.removeEventListener === 'function') win.removeEventListener('pagehide', close);
      if (o.signal && typeof o.signal.removeEventListener === 'function') o.signal.removeEventListener('abort', close);
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = null;
      mirrors = mirrors.filter(function (m) { return m !== handle; });
    }
    function stopAll(s) { (s && typeof s.getTracks === 'function' ? s.getTracks() : []).forEach(function (t) { try { t.stop(); } catch (e) { /* next */ } }); }
    function onVis() { if (doc.visibilityState === 'hidden' || doc.hidden === true) close(); }
    var handle = function () { close(); };
    handle.close = close;
    handle.closed = function () { return shut; };
    if (!panel || !doc || typeof panel.appendChild !== 'function') { shut = true; handle.ready = Promise.resolve(false); return handle; }
    closeMirrors();
    if (current) current.finish(null);
    mirrors.push(handle);
    css(doc);
    box = el(doc, 'div', 'slp-mirror');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', T('photo.mirror'));
    box.setAttribute('data-slp', 'mirror');
    var round = add(box, 'div', 'slp-mround');
    video = el(doc, 'video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('aria-hidden', 'true');
    video.muted = true;
    round.appendChild(video);
    var note = add(box, 'p', 'slp-mnote', T('photo.mirror.note'));
    var b = add(box, 'button', 'slw-btn slp-btn', T('photo.mirror.close'));
    b.setAttribute('type', 'button');
    b.setAttribute('data-slp', 'mirror-close');
    b.addEventListener('click', close);
    panel.appendChild(box);
    doc.addEventListener('visibilitychange', onVis);
    if (typeof win.addEventListener === 'function') win.addEventListener('pagehide', close);
    if (o.signal) { if (o.signal.aborted) { close(); handle.ready = Promise.resolve(false); return handle; } if (typeof o.signal.addEventListener === 'function') o.signal.addEventListener('abort', close); }
    /* the creator's sheet closed (the panel left the page): the mirror goes with it */
    if (typeof win.MutationObserver === 'function' && doc.body) {
      watcher = new win.MutationObserver(function () { if (box && box.isConnected === false) close(); });
      watcher.observe(doc.body, { childList: true, subtree: true });
    }
    if (!media) { note.textContent = T('photo.noCamera'); handle.ready = Promise.resolve(false); return handle; }
    handle.ready = media.getUserMedia(CAMERA).then(function (s) {
      if (shut) { if (PC) PC.stopTracks(s); else stopAll(s); return false; }
      stream = s;
      video.srcObject = s;
      try { var p = typeof video.play === 'function' ? video.play() : null; if (p && typeof p.then === 'function') p.then(null, function () { return null; }); } catch (e) { /* autoplay */ }
      return true;
    }, function () {
      if (!shut) note.textContent = T('photo.noCamera');
      return false;
    });
    return handle;
  }

  function closeAll() {
    var n = closeMirrors();
    if (current) { current.finish(null); n++; }
    return n;
  }
  function isOpen() { return !!current || mirrors.length > 0; }

  return Object.freeze({
    VERSION: VERSION, MAX_SIDE: MAX_SIDE, IRIS_MS: IRIS_MS, TICK_MS: TICK_MS, FACE_MS: FACE_MS, CAMERA: CAMERA,
    open: open, openMirror: openMirror, closeAll: closeAll, isOpen: isOpen, decodeFile: decodeFile, applyTo: applyTo
  });
}));
