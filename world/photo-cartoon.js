/* ================================================================
   My Island — photo to cartoon, the pure part (kids update KU-CH6; no DOM).
   window.SLPhotoCartoon in the browser (window.slLoadPhoto() loads it just
   before photo-cartoon-ui.js, only when the photo or mirror button is
   tapped), module.exports in Node.

   It turns one small crop of a face into creator choices: a skin tone
   (0-9), a natural hair colour (0-9) or nothing, and a long-hair hint.
   That is all. Eye colour, hairstyle, glasses, coverings, gender and
   ethnicity are never guessed (characters.json CH-D13, plan-ku KU17). The
   result is 'your colours' on the cartoon, never a likeness.

   Privacy, by construction: this file only reads the numbers it is handed
   and returns a few small integers. It keeps no pixel between calls (the
   only thing it remembers is the palettes' own colours; the API is frozen),
   never copies the pixels anywhere, and has no way to reach the browser's
   stores or the internet; the static scan in tests/photo-cartoon.test.js
   enforces it. wipe() is the one place that
   empties the camera, canvases and pictures of the photo flow, and it never
   throws, so every path (Snap, cancel, error) can call it.

     sample(rgba, w, h, oval?, opts?)  → {skin: {i, second, margin} | null,
                       hair: {i, second, margin} | null, long, confidence:
                       'good' | 'low', why, hairWhy}. rgba is the crop's
                       RGBA bytes (160 x 160 with OVAL by default). why is
                       'ok' or the first low reason: 'nodata', 'empty',
                       'dark', 'bright', 'patches', 'margin'. hairWhy is
                       null or why hair is null: 'few' (short, bald or
                       hidden), 'far' (a hat, a covering or dyed hair),
                       'hat' (the top of the head is not the colour at the
                       temples) or 'wrap' (a covering round face and neck).
     lookPatch(result)                 → {sk, hc?} for the creator's draft, or
                       null when the result is low (low never applies).
     cropRect(srcOval, srcW, srcH, size?) → the source and crop rectangles
                       that put a face oval in the picture on OVAL.
     ovalFromBox(box)                  → a source oval from a face box.
     stopTracks(streamOrTracks)        → tracks stopped (never throws).
     wipe(refs)                        → empties and drops everything in refs.
     synth(opts)                       → a synthetic face (tests and the lab
                       only; no real, stock or AI-made photo is ever used).
     SIZE, OVAL, PALETTE, TUNING, toLab, deltaE
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SLPhotoCartoon = factory(root);
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var VERSION = 1;
  var SIZE = 160;
  /* the guide oval inside the 160 crop (characters.json photoToCartoon.sampling.oval) */
  var OVAL = { cx: 80, cy: 80, rx: 51, ry: 64 };

  /* A local copy of people-core's PALETTES (KU-CH1): skin 1-10 and the ten
     natural hair colours, as characters.json design.lookSchema.palettes. The
     live SLPeopleCore.PALETTES wins whenever it is loaded and readable. */
  var SKIN = ['#FCE5D6', '#F6D3BC', '#EDC0A0', '#E0AA84', '#CF956C',
              '#B97E57', '#9E6744', '#835236', '#683F2A', '#4D2E20'];
  var HAIR = ['#1E1B22', '#3B2A22', '#5C3D2B', '#8A5E3C', '#7E3A24',
              '#C0602E', '#D79A6A', '#E6C27A', '#F1E6C8', '#B9B6B3'];

  /* Every number the sampler uses. Positions are in oval units: x in rx and
     y in ry from the oval's centre; patch radii are in rx. */
  var TUNING = {
    alphaMin: 128,
    wb: { satMax: 0.4, gainMin: 0.8, gainMax: 1.25, strength: 0.5, minCount: 150, clip: 250 },
    border: { px: 4, sideFrac: 0.6, minCount: 40 },
    skin: {
      patches: [
        { id: 'cheekL', x: -0.42, y: 0.18, r: 0.12 },
        { id: 'cheekR', x: 0.42, y: 0.18, r: 0.12 },
        { id: 'forehead', x: 0, y: -0.42, r: 0.12 },
        { id: 'chin', x: 0, y: 0.62, r: 0.08 }
      ],
      trimTop: 0.05, trimBottom: 0.15, minPx: 12,
      wL: 1.0, wB: 0.5, wA: 0.3
    },
    hair: {
      band: { y0: -1.12, y1: -0.92, halfW: 0.5 },
      temples: [{ x: -1.08, y: -0.35, r: 0.1 }, { x: 1.08, y: -0.35, r: 0.1 }],
      skinDE: 12, bgDE: 10, minFrac: 0.25, minPx: 30, wL: 1.2,
      medSkinDE: 7, medBgDE: 5, far: 20, hatDE: 22, hatMinPx: 8
    },
    wrap: { x: 0, y: 1.1, r: 0.12, de: 16, skinDE: 12, chroma: 0.04, chromaDark: 0.003, minPx: 12 },
    /* a pixel that also matches the room never counts as hair below the jaw */
    long: { patches: [{ x: -1.15, y: 0.85, r: 0.1 }, { x: 1.15, y: 0.85, r: 0.1 }], de: 14, frac: 0.4, minPx: 10 },
    conf: { darkL: 18, brightL: 95, patchDE: 15, margin: 1.5,
            emptyDE: 10, featureDE: 20, featureFrac: 0.01 }
  };

  /* ---------------------------------------------------------------- colour */
  var LIN = new Float64Array(256);
  for (var li = 0; li < 256; li++) {
    var cs = li / 255;
    LIN[li] = cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  }
  function enc(v) {           /* linear 0-1 → sRGB 0-255 (float, unclamped) */
    if (v <= 0) return 0;
    var s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return s * 255;
  }
  function labF(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  /* linear sRGB (D65) → CIELAB (D65) */
  function toLab(r, g, b) {
    var x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    var y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    var z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
    var fy = labF(y);
    return [116 * fy - 16, 500 * (labF(x) - fy), 200 * (fy - labF(z))];
  }
  function deltaE(p, q) {
    var dl = p[0] - q[0], da = p[1] - q[1], db = p[2] - q[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  function hexLin(hex) {
    return [LIN[parseInt(hex.slice(1, 3), 16)], LIN[parseInt(hex.slice(3, 5), 16)], LIN[parseInt(hex.slice(5, 7), 16)]];
  }
  function hexLab(hex) { var c = hexLin(hex); return toLab(c[0], c[1], c[2]); }

  /* ---------------------------------------------------------------- palettes */
  function hexOf(e) {
    if (typeof e === 'string') return e;
    if (Array.isArray(e)) { for (var k = 0; k < e.length; k++) if (typeof e[k] === 'string' && HEX_RE.test(e[k])) return e[k]; }
    if (e && typeof e.hex === 'string') return e.hex;
    return null;
  }
  function readPal(list) {
    if (!Array.isArray(list) || list.length < 10) return null;
    var out = [];
    for (var k = 0; k < 10; k++) {
      var h = hexOf(list[k]);
      if (!h || !HEX_RE.test(h)) return null;
      out.push(h.toUpperCase());
    }
    return out;
  }
  /* {skin, hair} hex lists: opts.palettes, else the loaded SLPeopleCore, else the local copy */
  function palettesFrom(given) {
    var src = given;
    if (!src) {
      var pc = root && root.SLPeopleCore;
      src = pc && pc.PALETTES;
    }
    if (src) {
      var sk = readPal(src.skin), hc = readPal(src.hairNatural || src.hair);
      if (sk && hc) return { skin: sk, hair: hc };
    }
    return { skin: SKIN, hair: HAIR };
  }
  var labCache = { key: '', skin: null, hair: null };
  function palLab(given) {
    var p = palettesFrom(given), key = p.skin.join() + '|' + p.hair.join();
    if (labCache.key !== key) {
      labCache = { key: key, skin: p.skin.map(hexLab), hair: p.hair.map(hexLab) };
    }
    return labCache;
  }

  /* ---------------------------------------------------------------- pixels */
  function Reader(rgba, w, h, gains) {
    this.d = rgba; this.w = w; this.h = h; this.g = gains || [1, 1, 1];
  }
  /* linear, white-balanced colour of pixel (x, y) into out; false when unusable */
  Reader.prototype.lin = function (x, y, out) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    var o = (y * this.w + x) * 4, d = this.d;
    if (d[o + 3] < TUNING.alphaMin) return false;
    out[0] = LIN[d[o]] * this.g[0]; out[1] = LIN[d[o + 1]] * this.g[1]; out[2] = LIN[d[o + 2]] * this.g[2];
    return true;
  };
  /* every usable pixel in a circle (centre and radius in pixels) → [r, g, b, ...] */
  function circle(rd, cx, cy, r) {
    var out = [], c = [0, 0, 0];
    var x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r), r2 = r * r;
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        if (rd.lin(x, y, c)) out.push(c[0], c[1], c[2]);
      }
    }
    return out;
  }
  function rect(rd, xa, xb, ya, yb, out) {
    var c = [0, 0, 0];
    out = out || [];
    for (var y = Math.floor(ya); y < Math.ceil(yb); y++) {
      for (var x = Math.floor(xa); x < Math.ceil(xb); x++) {
        if (x + 0.5 < xa || x + 0.5 > xb || y + 0.5 < ya || y + 0.5 > yb) continue;
        if (rd.lin(x, y, c)) out.push(c[0], c[1], c[2]);
      }
    }
    return out;
  }
  /* median of a Float64Array (sorted in place: callers pass a fresh copy) */
  function medianOf(s) {
    s.sort();
    var n = s.length;
    if (!n) return 0;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  /* per-channel median of a flat [r, g, b, ...] list */
  function median3(px) {
    var n = px.length / 3, r = new Float64Array(n), g = new Float64Array(n), b = new Float64Array(n);
    for (var k = 0; k < n; k++) { r[k] = px[3 * k]; g[k] = px[3 * k + 1]; b[k] = px[3 * k + 2]; }
    return [medianOf(r), medianOf(g), medianOf(b)];
  }
  function inOval(x, y, ov, grow) {
    var dx = (x + 0.5 - ov.cx) / (ov.rx * grow), dy = (y + 0.5 - ov.cy) / (ov.ry * grow);
    return dx * dx + dy * dy <= 1;
  }

  /* Grey-world over the low-saturation pixels outside the oval: gains clamped
     0.8-1.25 and applied at 50% strength, so a yellow kitchen bulb pulls the
     estimate back without inventing colour. */
  function whiteBalance(rgba, w, h, ov) {
    var W = TUNING.wb, sr = 0, sg = 0, sb = 0, n = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (inOval(x, y, ov, 1.05)) continue;
        var o = (y * w + x) * 4;
        if (rgba[o + 3] < TUNING.alphaMin) continue;
        var R = rgba[o], G = rgba[o + 1], B = rgba[o + 2];
        var mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        if (mx < 8 || mx >= W.clip || (mx - mn) / mx >= W.satMax) continue;
        sr += LIN[R]; sg += LIN[G]; sb += LIN[B]; n++;
      }
    }
    if (n < W.minCount || !(sr > 0 && sg > 0 && sb > 0)) return [1, 1, 1];
    var grey = (sr + sg + sb) / 3;
    return [sr, sg, sb].map(function (s) {
      var gain = Math.min(W.gainMax, Math.max(W.gainMin, grey / s));
      return 1 + W.strength * (gain - 1);
    });
  }

  /* the background: the median of the top edge and the upper sides of the crop
     (the lower border is shoulders, hair or a shirt, not the room) */
  function background(rd) {
    var B = TUNING.border, w = rd.w, h = rd.h, px = [];
    rect(rd, 0, w, 0, B.px, px);
    rect(rd, 0, B.px, B.px, h * B.sideFrac, px);
    rect(rd, w - B.px, w, B.px, h * B.sideFrac, px);
    if (px.length / 3 < B.minCount) return null;
    var m = median3(px);
    return toLab(m[0], m[1], m[2]);
  }

  /* one skin patch: drop the brightest 5% (shine) and darkest 15% (shadow) by
     luma, then the per-channel median in linear RGB */
  function skinPatch(px) {
    var S = TUNING.skin, n = px.length / 3;
    if (n < S.minPx) return null;
    var idx = [];
    for (var k = 0; k < n; k++) idx.push(k);
    var luma = function (k) { return 0.2126 * px[3 * k] + 0.7152 * px[3 * k + 1] + 0.0722 * px[3 * k + 2]; };
    idx.sort(function (a, b) { return luma(a) - luma(b); });
    var lo = Math.floor(n * S.trimBottom), hi = n - Math.floor(n * S.trimTop);
    var keep = [];
    for (var j = lo; j < hi; j++) { var q = idx[j]; keep.push(px[3 * q], px[3 * q + 1], px[3 * q + 2]); }
    if (!keep.length) return null;
    var m = median3(keep);
    return { lin: m, lab: toLab(m[0], m[1], m[2]) };
  }

  function nearest(lab, list, dist) {
    var best = -1, second = -1, d1 = Infinity, d2 = Infinity;
    for (var k = 0; k < list.length; k++) {
      var d = dist(lab, list[k]);
      if (d < d1) { d2 = d1; second = best; d1 = d; best = k; } else if (d < d2) { d2 = d; second = k; }
    }
    return { i: best, second: second, margin: Math.round((d2 - d1) * 100) / 100, d: d1 };
  }
  /* skin varies mostly in L* and b*: 1.0·ΔL + 0.5·Δb + 0.3·Δa */
  function skinDist(p, q) {
    var S = TUNING.skin;
    return S.wL * Math.abs(p[0] - q[0]) + S.wB * Math.abs(p[2] - q[2]) + S.wA * Math.abs(p[1] - q[1]);
  }
  /* hair: ΔE with L* weighted 1.2 */
  function hairDist(p, q) {
    var dl = TUNING.hair.wL * (p[0] - q[0]), da = p[1] - q[1], db = p[2] - q[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }
  /* distance between two colours' chromaticities (r and g shares): 0 for a colour and its shadow */
  function chromaDist(p, q) {
    var sp = p[0] + p[1] + p[2], sq = q[0] + q[1] + q[2];
    if (!(sp > 0) || !(sq > 0)) return 0;
    return Math.sqrt(Math.pow(p[0] / sp - q[0] / sq, 2) + Math.pow(p[1] / sp - q[1] / sq, 2));
  }
  function labsOf(px) {
    var out = [];
    for (var k = 0; k < px.length; k += 3) out.push(toLab(px[k], px[k + 1], px[k + 2]));
    return out;
  }

  /* Nobody in the circle: the oval's median colour matches the border and
     almost none of it stands out from the room (no eyes, brows, mouth or
     hair). It reads 2 x 2 blocks, and compares the median rather than each
     pixel, so camera noise neither hides an empty frame nor fakes a face. */
  function looksEmpty(rd, ov, bg) {
    var C = TUNING.conf, c = [0, 0, 0], px = [], labs = [];
    var x0 = Math.floor(ov.cx - ov.rx), x1 = Math.ceil(ov.cx + ov.rx), y0 = Math.floor(ov.cy - ov.ry), y1 = Math.ceil(ov.cy + ov.ry);
    for (var y = y0; y <= y1; y += 2) {
      for (var x = x0; x <= x1; x += 2) {
        if (!inOval(x, y, ov, 1)) continue;
        var r = 0, g = 0, b = 0, n = 0;
        for (var k = 0; k < 4; k++) {
          if (rd.lin(x + (k & 1), y + (k >> 1), c)) { r += c[0]; g += c[1]; b += c[2]; n++; }
        }
        if (!n) continue;
        px.push(r / n, g / n, b / n);
        labs.push(toLab(r / n, g / n, b / n));
      }
    }
    if (!labs.length) return false;
    var m = median3(px);
    if (deltaE(toLab(m[0], m[1], m[2]), bg) >= C.emptyDE) return false;
    var feat = 0;
    labs.forEach(function (lab) { if (deltaE(lab, bg) > C.featureDE) feat++; });
    return feat / labs.length < C.featureFrac;
  }

  function lowResult(why) {
    return { skin: null, hair: null, long: false, confidence: 'low', why: why, hairWhy: null };
  }

  function validOval(o) {
    return !!o && [o.cx, o.cy, o.rx, o.ry].every(function (v) { return typeof v === 'number' && isFinite(v); }) && o.rx > 2 && o.ry > 2;
  }

  /* ---------------------------------------------------------------- sample */
  function sample(rgba, w, h, oval, opts) {
    if (!rgba || typeof rgba.length !== 'number' || !(w > 0) || !(h > 0) || (w | 0) !== w || (h | 0) !== h || rgba.length < w * h * 4) {
      return lowResult('nodata');
    }
    var ov = oval || { cx: OVAL.cx * w / SIZE, cy: OVAL.cy * h / SIZE, rx: OVAL.rx * w / SIZE, ry: OVAL.ry * h / SIZE };
    if (!validOval(ov)) return lowResult('nodata');
    var pal = palLab(opts && opts.palettes);
    var C = TUNING.conf, H = TUNING.hair;

    var rd = new Reader(rgba, w, h, whiteBalance(rgba, w, h, ov));
    var bg = background(rd);

    /* skin: four patches, keep the three that agree best */
    var patches = [];
    TUNING.skin.patches.forEach(function (p) {
      var s = skinPatch(circle(rd, ov.cx + p.x * ov.rx, ov.cy + p.y * ov.ry, p.r * ov.rx));
      if (s) patches.push(s);
    });
    if (patches.length < 3) return lowResult('nodata');
    var kept = patches, spread = Infinity;
    var spreadOf = function (set) {
      var m = 0;
      for (var a = 0; a < set.length; a++) for (var b = a + 1; b < set.length; b++) m = Math.max(m, deltaE(set[a].lab, set[b].lab));
      return m;
    };
    if (patches.length === 3) spread = spreadOf(patches);
    else {
      for (var drop = 0; drop < patches.length; drop++) {
        var trio = patches.filter(function (_, k) { return k !== drop; }), s3 = spreadOf(trio);
        if (s3 < spread) { spread = s3; kept = trio; }
      }
    }
    var sl = [0, 0, 0];
    kept.forEach(function (p) { sl[0] += p.lin[0] / kept.length; sl[1] += p.lin[1] / kept.length; sl[2] += p.lin[2] / kept.length; });
    var skinLab = toLab(sl[0], sl[1], sl[2]);
    var sk = nearest(skinLab, pal.skin, skinDist);
    var skin = { i: sk.i, second: sk.second, margin: sk.margin };

    /* hair: the band above the forehead and the temples, minus skin and room */
    var bandPx = rect(rd, ov.cx - H.band.halfW * ov.rx, ov.cx + H.band.halfW * ov.rx, ov.cy + H.band.y0 * ov.ry, ov.cy + H.band.y1 * ov.ry);
    var templePx = [];
    H.temples.forEach(function (p) {
      templePx = templePx.concat(circle(rd, ov.cx + p.x * ov.rx, ov.cy + p.y * ov.ry, p.r * ov.rx));
    });
    var notSkinOrRoom = function (px) {
      var out = [], labs = labsOf(px);
      for (var k = 0; k < labs.length; k++) {
        if (deltaE(labs[k], skinLab) < H.skinDE || (bg && deltaE(labs[k], bg) < H.bgDE)) continue;
        out.push(px[3 * k], px[3 * k + 1], px[3 * k + 2]);
      }
      return out;
    };
    var bandLeft = notSkinOrRoom(bandPx), templeLeft = notSkinOrRoom(templePx);
    var total = (bandPx.length + templePx.length) / 3, left = bandLeft.concat(templeLeft);
    var hair = null, hairWhy = null, hairLab = null;
    if (total < H.minPx || left.length / 3 < total * H.minFrac) hairWhy = 'few';
    else {
      var hm = median3(left);
      hairLab = toLab(hm[0], hm[1], hm[2]);
      var hn = nearest(hairLab, pal.hair, hairDist);
      var labOf = function (px) { var m = median3(px); return toLab(m[0], m[1], m[2]); };
      /* noisy skin or wall pixels that slipped past the cut still average back to skin or wall */
      if (deltaE(hairLab, skinLab) < H.medSkinDE || (bg && deltaE(hairLab, bg) < H.medBgDE)) hairWhy = 'few';
      else if (hn.d > H.far) hairWhy = 'far';
      /* the top of the head is not the colour at the temples: a hat or a covering on top */
      else if (bandLeft.length / 3 >= H.minPx && templeLeft.length / 3 >= H.hatMinPx && deltaE(labOf(bandLeft), labOf(templeLeft)) > H.hatDE) hairWhy = 'hat';
      else {
        /* the hair colour carries on under the chin, and that is not the skin in
           shadow (a shadow keeps the skin's chromaticity; camera noise blurs it
           more the darker the neck, so the allowance grows): a covering wraps the neck */
        var Wr = TUNING.wrap;
        var neckPx = circle(rd, ov.cx + Wr.x * ov.rx, ov.cy + Wr.y * ov.ry, Wr.r * ov.rx);
        var neckLin = neckPx.length / 3 >= Wr.minPx ? median3(neckPx) : null;
        var neck = neckLin && toLab(neckLin[0], neckLin[1], neckLin[2]);
        if (neck && deltaE(neck, hairLab) < Wr.de && deltaE(neck, skinLab) >= Wr.skinDE && chromaDist(neckLin, sl) >= Wr.chroma + Wr.chromaDark / Math.max(0.01, 0.2126 * neckLin[0] + 0.7152 * neckLin[1] + 0.0722 * neckLin[2])) hairWhy = 'wrap';
        else hair = { i: hn.i, second: hn.second, margin: hn.margin };
      }
    }

    /* long hair: the hair colour carries on below the jaw at the sides */
    var long = false;
    if (hair) {
      var L = TUNING.long, near = 0, all = 0;
      L.patches.forEach(function (p) {
        labsOf(circle(rd, ov.cx + p.x * ov.rx, ov.cy + p.y * ov.ry, p.r * ov.rx)).forEach(function (lab) {
          all++;
          if (deltaE(lab, hairLab) < L.de && !(bg && deltaE(lab, bg) < H.bgDE)) near++;
        });
      });
      long = all >= L.minPx && near / all >= L.frac;
    }

    /* confidence: the first reason wins; low never applies a guess */
    var why = 'ok';
    if (bg && looksEmpty(rd, ov, bg)) why = 'empty';
    else if (skinLab[0] < C.darkL) why = 'dark';
    else if (skinLab[0] > C.brightL) why = 'bright';
    else if (spread > C.patchDE) why = 'patches';
    else if (skin.margin < C.margin) why = 'margin';
    return { skin: skin, hair: hair, long: long, confidence: why === 'ok' ? 'good' : 'low', why: why, hairWhy: hairWhy };
  }

  /* The only values a photo may hand the creator: the palette indices, and
     only when the result is good. Nothing marks them as photo-derived (KU16). */
  function lookPatch(res) {
    if (!res || res.confidence !== 'good' || !res.skin) return null;
    var ok = function (v) { return typeof v === 'number' && (v | 0) === v && v >= 0 && v <= 9; };
    if (!ok(res.skin.i)) return null;
    var out = { sk: res.skin.i };
    if (res.hair && ok(res.hair.i)) out.hc = res.hair.i;
    return out;
  }

  /* ---------------------------------------------------------------- geometry */
  /* The source rectangle that maps a face oval (cx, cy, ry; rx follows OVAL's
     shape) onto OVAL in a size x size crop, clipped to the source; null when
     they do not overlap: the picture's (sx, sy, sw, sh) goes to the crop's
     (dx, dy, dw, dh). */
  function cropRect(src, srcW, srcH, size) {
    size = size || SIZE;
    if (!src || !(src.ry > 0) || !(srcW > 0) || !(srcH > 0)) return null;
    var k = (OVAL.ry * size / SIZE) / src.ry;           /* crop px per source px */
    var sx = src.cx - (OVAL.cx * size / SIZE) / k, sy = src.cy - (OVAL.cy * size / SIZE) / k, side = size / k;
    var x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(srcW, sx + side), y1 = Math.min(srcH, sy + side);
    if (x1 <= x0 || y1 <= y0) return null;
    return { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0, dx: (x0 - sx) * k, dy: (y0 - sy) * k, dw: (x1 - x0) * k, dh: (y1 - y0) * k, scale: k };
  }
  /* A face box (eyebrows to chin, cheek to cheek) → the guide oval (hairline to chin). */
  function ovalFromBox(box) {
    if (!box || !(box.width > 0) || !(box.height > 0)) return null;
    var ry = box.height * 0.6;
    return { cx: box.x + box.width / 2, cy: box.y + box.height * 0.42, rx: ry * OVAL.rx / OVAL.ry, ry: ry };
  }

  /* ---------------------------------------------------------------- wipe */
  function tracksOf(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v.getTracks === 'function') { try { return v.getTracks() || []; } catch (e) { return []; } }
    return [];
  }
  /* stops every track of a stream (or a list of tracks); counts the ones
     stopped. seen (a list) skips tracks an earlier call already stopped. */
  function stopTracks(s, seen) {
    var n = 0;
    tracksOf(s).forEach(function (t) {
      if (!t || typeof t.stop !== 'function' || (seen && seen.indexOf(t) >= 0)) return;
      if (seen) seen.push(t);
      try { t.stop(); n++; } catch (e) { /* the next one still stops */ }
    });
    return n;
  }
  function kindOf(v) {
    if (!v || typeof v !== 'object') return 'none';
    if (typeof v.getTracks === 'function') return 'stream';
    if ('srcObject' in v) return 'video';
    if (typeof v.stop === 'function') return 'track';
    if (ArrayBuffer.isView(v)) return 'pixels';
    if (v.data && ArrayBuffer.isView(v.data)) return 'imageData';
    if (typeof v.close === 'function') return 'bitmap';
    if ('files' in v && 'value' in v) return 'input';
    if ('width' in v && 'height' in v) return 'canvas';
    return 'other';
  }
  /* Empties everything the photo flow held, in this order: camera tracks off,
     the video let go, pixel buffers zeroed, pictures closed, canvases sized
     0 x 0, the file input cleared; then every key of refs is set to null.
     Values may be lists. Never throws; returns what it did. */
  function wipe(refs) {
    var done = { tracks: 0, videos: 0, pixels: 0, bitmaps: 0, canvases: 0, inputs: 0, cleared: 0, errors: 0 };
    if (!refs || typeof refs !== 'object') return done;
    var all = [];
    Object.keys(refs).forEach(function (key) {
      var v = refs[key];
      (Array.isArray(v) && !ArrayBuffer.isView(v) ? v : [v]).forEach(function (x) { all.push(x); });
    });
    var step = function (kind, fn) {
      all.forEach(function (v) {
        var k = kindOf(v);
        if (k !== kind && !(kind === 'track' && k === 'stream')) return;
        try { fn(v, k); } catch (e) { done.errors++; }
      });
    };
    var seen = [];
    step('track', function (v, k) { done.tracks += stopTracks(k === 'stream' ? v : [v], seen); });
    step('video', function (v) {
      done.tracks += stopTracks(v.srcObject, seen);
      if (typeof v.pause === 'function') { try { v.pause(); } catch (e) { done.errors++; } }
      v.srcObject = null;
      done.videos++;
    });
    step('pixels', function (v) { v.fill(0); done.pixels++; });
    step('imageData', function (v) { v.data.fill(0); done.pixels++; });
    step('bitmap', function (v) { v.close(); done.bitmaps++; });
    step('canvas', function (v) { v.width = 0; v.height = 0; done.canvases++; });
    step('input', function (v) { v.value = ''; done.inputs++; });
    Object.keys(refs).forEach(function (key) {
      try { refs[key] = null; done.cleared++; } catch (e) { done.errors++; }
    });
    return done;
  }

  /* ---------------------------------------------------------------- synthetic faces */
  var SYNTH_BG = ['#D9D6CF', '#BFC4C9', '#E8E2D4', '#9EA3A8', '#C9D3DC', '#E4E0E8'];
  var SYNTH_SHIRT = ['#3F7BD0', '#E2504C', '#4E8A4C', '#F2C14E', '#8E5BD6', '#2FA39A'];
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(v, list, fallback) {
    if (typeof v === 'string' && HEX_RE.test(v)) return v;
    if (typeof v === 'number' && list[v]) return list[v];
    return fallback;
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function ell(x, y, cx, cy, rx, ry) { var dx = (x - cx) / rx, dy = (y - cy) / ry; return dx * dx + dy * dy; }

  var ENC = null, GAUSS = null;  /* built on the first synth: linear → sRGB in 8192 steps, 4096 unit normals */
  function gaussLut() {
    if (!GAUSS) {
      var g = rng(20261008);
      GAUSS = new Float32Array(4096);
      for (var k = 0; k < 4096; k += 2) {
        var r = Math.sqrt(-2 * Math.log(g() || 1e-9)), t = 6.283185307 * g();
        GAUSS[k] = r * Math.cos(t); GAUSS[k + 1] = r * Math.sin(t);
      }
    }
    return GAUSS;
  }
  function encLut() {
    if (!ENC) {
      ENC = new Float32Array(8192);
      for (var k = 0; k < 8192; k++) ENC[k] = enc(k / 8191);
    }
    return ENC;
  }

  /* A painted face in a size x size RGBA buffer, deterministic for its
     options. style: 'short' | 'fringe' | 'long' | 'bald' | 'shaved' | 'hijab'
     | 'hat' | 'none' (nobody in the circle). skin and hair are palette
     indices (or hex), cover / bg / shirt hex or list indices, cast linear
     [r, g, b] gains, exposure a multiplier, neckShade the light under the
     chin (0.8), noise the 8-bit standard deviation, seed any integer. */
  function synth(o) {
    o = o || {};
    var S = o.size || SIZE, f = S / SIZE;
    var cx = OVAL.cx * f, cy = OVAL.cy * f, rx = OVAL.rx * f, ry = OVAL.ry * f;
    var style = o.style || 'short';
    var rand = rng(o.seed == null ? 1 : o.seed);
    var skin = hexLin(pick(o.skin, SKIN, SKIN[4]));
    var hair = hexLin(pick(o.hair, HAIR, HAIR[2]));
    var cover = hexLin(pick(o.cover, [], '#2E3A6B'));
    var bg = hexLin(pick(o.bg, SYNTH_BG, SYNTH_BG[Math.floor(rand() * SYNTH_BG.length)]));
    var shirt = hexLin(pick(o.shirt, SYNTH_SHIRT, SYNTH_SHIRT[Math.floor(rand() * SYNTH_SHIRT.length)]));
    var cast = Array.isArray(o.cast) ? o.cast : [1, 1, 1];
    var expo = o.exposure > 0 ? o.exposure : 1;
    var sigma = o.noise > 0 ? o.noise : 0;
    var phase = rand() * 6.283;
    var lip = mix(skin, hexLin('#A8424F'), 0.55), iris = hexLin('#3A2618'), white = hexLin('#EEEAE4');
    var brow = mix(hair, skin, 0.25), nostril = scale(skin, 0.7), neckK = o.neckShade > 0 ? o.neckShade : 0.8;
    var cheekRy = 0.16 * rx / ry;
    var person = style !== 'none', wrapped = style === 'hijab', capped = style === 'short' || style === 'fringe' || style === 'long' || style === 'hat';
    var lut = encLut(), k3 = [cast[0] * expo * 8191, cast[1] * expo * 8191, cast[2] * expo * 8191];
    var out = new Uint8ClampedArray(S * S * 4);
    var strand = function (px, py) { return 1 + 0.07 * Math.sin(px * 0.9 / f + phase) * Math.cos(py * 0.21 / f); };
    var gauss = gaussLut();
    for (var y = 0; y < S; y++) {
      var py = y + 0.5, v = (py - cy) / ry, wallK = 1.06 - 0.12 * py / S;
      for (var x = 0; x < S; x++) {
        /* the pixel is base × m (× a blush tint); nothing is allocated per pixel */
        var px = x + 0.5, u = (px - cx) / rx, base = bg, m = wallK, blush = false;
        if (person) {
          var inShirt = ell(px, py, cx, cy + 1.95 * ry, 2.0 * rx, 0.85 * ry) <= 1 && ell(px, py, cx, cy + 1.25 * ry, 0.42 * rx, 0.22 * ry) > 1;
          if (inShirt) { base = shirt; m = 0.92 + 0.08 * (px / S); }
          if (style === 'long' && v > -0.4 && Math.abs(px - cx) < 1.28 * rx - Math.max(0, cy - py) * 0.2) { base = hair; m = strand(px, py); }
          if (wrapped) {
            if (ell(px, py, cx, cy - 0.2 * ry, 1.3 * rx, 1.15 * ry) <= 1 || (v > -0.2 && Math.abs(px - cx) < 1.25 * rx + (py - cy) * 0.35)) {
              base = cover; m = 1 + 0.06 * Math.sin(px * 0.35 / f + phase);
            }
          } else {
            if (Math.abs(u) < 0.4 && v > 0.6 && !inShirt) { base = skin; m = neckK; }
            if (style !== 'long' && Math.min(ell(u, v, -1, -0.05, 0.13, 0.2), ell(u, v, 1, -0.05, 0.13, 0.2)) <= 1) { base = skin; m = 0.9; }
            if (capped && v < -0.1 && ell(u, v, 0, -0.28, 1.22, 1.0) <= 1) { base = hair; m = strand(px, py); }
            if ((style === 'bald' || style === 'shaved') && ell(u, v, 0, -0.3, 1.04, 0.95) <= 1) {
              if (style === 'shaved') { base = mix(skin, hair, 0.12 * (0.5 + rand())); m = 0.97; }
              else { base = skin; m = 1 + 0.12 * Math.exp(-ell(u, v, -0.2, -1.05, 0.35, 0.15)); }
            }
            if (style === 'hat' && v < -0.7 && ell(u, v, 0, -0.75, 1.2, 0.66) <= 1) {
              base = cover; m = v > -0.86 ? 0.86 : 1 + 0.05 * Math.sin(px * 0.5 / f);
            }
          }
          var inFace = u * u + v * v <= 1;
          if (wrapped) inFace = inFace && ell(u, v, 0, 0.05, 0.93, 0.98) <= 1 && v > -0.82;
          if (style === 'hat' && v < -0.7) inFace = false;
          if (inFace) {
            base = skin;
            m = 1 + 0.1 * u - 0.1 * Math.max(0, v - 0.3) + 0.18 * Math.exp(-ell(u, v, 0, 0.02, 0.07, 0.16));
            blush = Math.min(ell(u, v, -0.42, 0.18, 0.2, cheekRy), ell(u, v, 0.42, 0.18, 0.2, cheekRy)) <= 1;
            if (capped && style !== 'hat') {
              var line = style === 'fringe' ? -0.36 + 0.05 * Math.sin(px * 0.7 / f + phase) : -0.9 + 0.04 * Math.sin(px * 0.4 / f);
              if (v < line && Math.abs(u) < (style === 'fringe' ? 0.8 : 2)) { base = hair; m = strand(px, py); blush = false; }
            }
            var e1 = Math.min(ell(u, v, -0.38, -0.12, 0.15, 0.06), ell(u, v, 0.38, -0.12, 0.15, 0.06));
            var feature = e1 <= 1 ? (e1 <= 0.35 ? iris : white) : null;
            if (Math.min(ell(u, v, -0.38, -0.27, 0.17, 0.03), ell(u, v, 0.38, -0.27, 0.17, 0.03)) <= 1) feature = brow;
            if (ell(u, v, 0, 0.42, 0.2, 0.05) <= 1) feature = lip;
            if (ell(u, v, 0, 0.2, 0.06, 0.03) <= 1) feature = nostril;
            if (feature) { base = feature; m = 1; blush = false; }
          }
        }
        var o4 = (y * S + x) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var lv = base[ch] * m * (blush ? (ch ? 0.99 : 1.04) : 1);
          var n8 = sigma ? sigma * gauss[(rand() * 4096) | 0] : 0;
          out[o4 + ch] = Math.round(lut[Math.min(8191, Math.round(lv * k3[ch]))] + n8);
        }
        out[o4 + 3] = 255;
      }
    }
    return { rgba: out, w: S, h: S, oval: { cx: cx, cy: cy, rx: rx, ry: ry } };
  }

  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }
  var PALETTE = deepFreeze({ skin: SKIN.slice(), hairNatural: HAIR.slice() });
  deepFreeze(TUNING); deepFreeze(OVAL);

  return Object.freeze({
    VERSION: VERSION, SIZE: SIZE, OVAL: OVAL, PALETTE: PALETTE, TUNING: TUNING,
    sample: sample, lookPatch: lookPatch, cropRect: cropRect, ovalFromBox: ovalFromBox,
    stopTracks: stopTracks, wipe: wipe, synth: synth,
    toLab: toLab, deltaE: deltaE, hexLab: hexLab
  });
}));
