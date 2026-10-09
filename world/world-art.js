/* ================================================================
   My Island — original SVG art, drawn in code.
   World sprites: 100 units per grid column; a cell's ground is 78 units
   tall (the island is drawn in a gentle 3/4 view). Sprites stand on
   their footprint and may rise above it.
   Pet art is self-contained (no shared gradients) so games can turn it
   into canvas images.
   v3 (Pixel Blocks): the pixel islands, island icons, pix sprites, the
   land-shop registry (definePix) and the mascots are the MY ISLAND v3
   block further down; everything V4.54 draws is unchanged.
   ================================================================ */
(function (root) {
  'use strict';
  var CH = 78;                      /* ground units per row */
  var INK = '#3b2f4a';              /* soft outline colour */
  var SW = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var SW2 = 'stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

  var WALL = { wall_cream: '#f7e6c4', wall_pink: '#f9b7cc', wall_mint: '#b8ecd6', wall_sky: '#a9d6f7', wall_lilac: '#d6bdf2', wall_concrete: '#a9a5b3', wall_gallery: '#eceaf2', wall_graphite: '#34303f', wall_midnight: '#232a57' };
  var DOOR = { door_blue: '#3b7dd8', door_red: '#d94b4b', door_green: '#38a85c', door_gold: '#f0c02f', door_glass: '#1b2438' };
  var PETCOL = {
    pet_puppy:  { body: '#e3b077', dark: '#b8834f', light: '#f6d9b3', nose: '#3b2f4a' },
    pet_kitten: { body: '#f0a35e', dark: '#c97834', light: '#fde2c6', nose: '#e86a8a' },
    pet_bunny:  { body: '#f4f0ea', dark: '#d8cfc4', light: '#ffffff', nose: '#f08aa6' },
    pet_dragon: { body: '#5fc97a', dark: '#3a9a58', light: '#b9f0c6', nose: '#2e6b40' }
  };

  function svg(w, h, inner, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '"' + (extra || '') + '>' + inner + '</svg>';
  }
  function shadow(cx, cy, rx) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + Math.round(rx * 0.3) + '" fill="rgba(40,30,60,0.18)"/>'; }

  /* ---------------- shared defs for the island (injected once) ---------------- */
  function defs() {
    return svg(0, 0,
      '<defs>' +
      '<linearGradient id="slwSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6ff"/><stop offset="1" stop-color="#2f8fd8"/></linearGradient>' +
      '<linearGradient id="slwGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93e07c"/><stop offset="1" stop-color="#5fbf55"/></linearGradient>' +
      '<linearGradient id="slwGrassLock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c7c0"/><stop offset="1" stop-color="#93a59d"/></linearGradient>' +
      '<radialGradient id="slwGlow"><stop offset="0" stop-color="#fff6a8" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6a8" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="slwGlowCyan"><stop offset="0" stop-color="#9ffcff" stop-opacity="0.9"/><stop offset="1" stop-color="#9ffcff" stop-opacity="0"/></radialGradient>' +
      /* v2 golden hour: the dusk bay (Deep Bay, as the 3D stage's backdrop) and Turf */
      '<linearGradient id="slwSeaDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3f86"/><stop offset="1" stop-color="#2c6fa3"/></linearGradient>' +
      '<linearGradient id="slwTurf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa36a"/><stop offset="1" stop-color="#3c8456"/></linearGradient>' +
      '</defs>', ' width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"');
  }

  /* ---------------- island ground ---------------- */
  /* Two palettes. 'dusk' (the default) is the v2 golden hour that sits in the dark-glass
     Encore frame: the Deep Bay under a Dusk Zenith sky (the sky is the stage's CSS
     background), Lagoon shallows, Dune beaches, Turf grass and Wave Dusk lines at 0.6×
     width — no white strokes. 'day' (opts.day) is the v1 cartoon island, byte-identical. */
  var ISLE = {
    day: { sea: 'url(#slwSea)', wave: 'stroke="#e8f8ff" stroke-width="4" stroke-linecap="round" opacity="0.7"', lock: '#f6e7bd', lockOp: '0.5', edge: '#ffffff', edgeOp: '0.7',
      shallows: '', sand: '#f3dc9a', grass: 'url(#slwGrass)', tuft: '#4fa94a' },
    dusk: { sea: 'url(#slwSeaDusk)', wave: 'stroke="#ffc7b0" stroke-width="2.4" stroke-opacity="0.5" stroke-linecap="round" opacity="0.7"', lock: '#b98f6e', lockOp: '0.45', edge: '#b8b2d6', edgeOp: '0.6',
      shallows: '#3fb8d0', sand: '#e9c9a0', grass: 'url(#slwTurf)', tuft: '#2f7d57' }
  };
  /* cellsByRegion: {regionKey: ['x,y', ...]}, unlocked: {regionKey:true}, opts {day};
     v3: opts {pixel: true, theme, night, locked} draws the Pixel Blocks island (islandPixel;
     host-ui's name for the same switch, sky: true, is taken too) */
  function island(cols, rows, cellsByRegion, unlocked, opts) {
    if (opts && (opts.pixel || opts.sky)) return islandPixel(cols, rows, cellsByRegion || {}, unlocked || {}, opts);
    var P = opts && opts.day ? ISLE.day : ISLE.dusk;
    var W = cols * 100, H = rows * CH;
    var sand = '', grass = '', lockSand = '', tufts = '', shallows = '', locked = {};
    Object.keys(cellsByRegion).forEach(function (rk) {
      var open = !!unlocked[rk];
      cellsByRegion[rk].forEach(function (ck) {
        var p = ck.split(','), cx = +p[0], cy = +p[1], x = cx * 100, y = cy * CH;
        /* generous overlap so neighbouring cells melt into one smooth landmass */
        var sRect = '<rect x="' + (x - 28) + '" y="' + (y - 24) + '" width="156" height="' + (CH + 48) + '" rx="48"/>';
        if (open) {
          sand += sRect;
          /* dusk: a glowing Lagoon shelf around the beaches */
          if (P.shallows) shallows += '<rect x="' + (x - 42) + '" y="' + (y - 36) + '" width="184" height="' + (CH + 72) + '" rx="60"/>';
          grass += '<rect x="' + (x - 15) + '" y="' + (y - 14) + '" width="130" height="' + (CH + 28) + '" rx="38"/>';
          /* a few grass tufts for texture (deterministic per cell) */
          var h = (cx * 73 + cy * 151) % 97;
          tufts += '<path d="M' + (x + 20 + h % 50) + ' ' + (y + 30 + h % 30) + ' l4 -9 l4 9 m2 0 l4 -7 l4 7" fill="none" stroke="' + P.tuft + '" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>';
        } else { lockSand += sRect; locked[rk] = 1; }
      });
    });
    var waves = '';
    for (var i = 0; i < 9; i++) {
      var wx = (i * 197) % W, wy = 22 + ((i * 131) % (H - 30));
      waves += '<path class="slw-wave" style="animation-delay:' + (i * 0.7).toFixed(1) + 's" d="M' + wx + ' ' + wy + ' q 14 -8 28 0 t 28 0" fill="none" ' + P.wave + '/>';
    }
    return svg(W, H,
      '<rect width="' + W + '" height="' + H + '" fill="' + P.sea + '"/>' + waves +
      (shallows ? '<g fill="' + P.shallows + '" opacity="0.3">' + shallows + '</g>' : '') +
      /* locked land: a pale sandbar with a dotted edge — clearly "not yet" */
      '<g fill="' + P.lock + '" opacity="' + P.lockOp + '">' + lockSand + '</g>' +
      '<g fill="none" stroke="' + P.edge + '" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity="' + P.edgeOp + '">' + lockSand + '</g>' +
      /* open land: sand ring, grass, tufts */
      '<g fill="' + P.sand + '">' + sand + '</g><g fill="' + P.grass + '">' + grass + '</g>' + tufts,
      ' preserveAspectRatio="none" class="slw-ground-svg"');
  }

  /* ---------------- plants & decorations (1×1, viewBox 100×170, base y≈135) ---------------- */
  function tree(kind) {
    var trunk = '<path d="M44 135 L46 92 L54 92 L56 135 Z" fill="#9b6b43" ' + SW2 + '/>';
    if (kind === 'pine') {
      return shadow(50, 136, 30) + '<rect x="45" y="112" width="10" height="24" fill="#8a5d3a" ' + SW2 + '/>' +
        '<path d="M50 18 L80 70 L66 70 L86 108 L14 108 L34 70 L20 70 Z" fill="#3f9a5a" ' + SW + '/>' +
        '<path d="M50 30 L66 62 L50 56 Z" fill="#69c07c" opacity="0.7"/>';
    }
    if (kind === 'palm') {
      return shadow(50, 136, 26) +
        '<path d="M48 136 C 44 110, 46 80, 58 52" fill="none" stroke="#a5743f" stroke-width="11" stroke-linecap="round"/>' +
        '<path d="M48 136 C 44 110, 46 80, 58 52" fill="none" stroke="' + INK + '" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round"/>' +
        '<g ' + SW2 + '>' +
        '<path d="M58 52 C 40 36, 18 40, 8 58 C 26 50, 42 52, 58 52 Z" fill="#4fbf63"/>' +
        '<path d="M58 52 C 74 34, 94 38, 98 58 C 82 50, 70 50, 58 52 Z" fill="#45b05a"/>' +
        '<path d="M58 52 C 52 28, 64 14, 80 16 C 70 28, 64 40, 58 52 Z" fill="#5ccc70"/>' +
        '<path d="M58 52 C 46 30, 30 22, 18 28 C 34 32, 46 42, 58 52 Z" fill="#3fa956"/></g>' +
        '<circle cx="56" cy="58" r="5" fill="#8a5a2b"/><circle cx="63" cy="57" r="5" fill="#7a4d22"/>';
    }
    var c1 = '#5cb85c', c2 = '#4ba84b', c3 = '#8bd17c', fruit = '';
    if (kind === 'blossom') { c1 = '#f6a7c8'; c2 = '#ec86b0'; c3 = '#ffd3e6'; }
    if (kind === 'apple') {
      fruit = '<circle cx="34" cy="70" r="5" fill="#e53935" ' + SW2 + '/><circle cx="60" cy="56" r="5" fill="#e53935" ' + SW2 + '/>' +
              '<circle cx="66" cy="80" r="5" fill="#e53935" ' + SW2 + '/><circle cx="44" cy="46" r="5" fill="#e53935" ' + SW2 + '/>';
    }
    var petals = kind === 'blossom' ? '<circle cx="30" cy="96" r="3" fill="#ffd3e6"/><circle cx="70" cy="104" r="2.5" fill="#ffd3e6"/>' : '';
    return shadow(50, 136, 32) + trunk +
      '<g ' + SW + '><circle cx="34" cy="74" r="22" fill="' + c2 + '"/><circle cx="66" cy="74" r="22" fill="' + c2 + '"/>' +
      '<circle cx="50" cy="52" r="28" fill="' + c1 + '"/></g>' +
      '<circle cx="42" cy="44" r="10" fill="' + c3 + '" opacity="0.7"/>' + fruit + petals;
  }
  function flowers(kind) {
    var out = shadow(50, 136, 28) + '<ellipse cx="50" cy="128" rx="30" ry="10" fill="#4fae4c" ' + SW2 + '/>';
    if (kind === 'tulip') {
      [[32, '#ff5c6c'], [50, '#ffc93c'], [68, '#ff7ab8']].forEach(function (f, i) {
        var top = 86 + (i % 2) * 10;
        out += '<path d="M' + f[0] + ' 128 L' + f[0] + ' ' + (top + 12) + '" stroke="#3c8a3c" stroke-width="4"/>' +
          '<path d="M' + (f[0] - 10) + ' ' + (top + 2) + ' Q' + (f[0] - 10) + ' ' + (top + 18) + ' ' + f[0] + ' ' + (top + 18) + ' Q' + (f[0] + 10) + ' ' + (top + 18) + ' ' + (f[0] + 10) + ' ' + (top + 2) +
          ' L' + (f[0] + 5) + ' ' + (top + 8) + ' L' + f[0] + ' ' + top + ' L' + (f[0] - 5) + ' ' + (top + 8) + ' Z" fill="' + f[1] + '" ' + SW2 + '/>';
      });
      return out;
    }
    if (kind === 'daisy') {
      [[30, 118], [50, 110], [70, 118], [40, 126], [62, 126]].forEach(function (p) {
        var petalsS = '';
        for (var a = 0; a < 8; a++) {
          var ang = a * Math.PI / 4;
          petalsS += '<ellipse cx="' + (p[0] + Math.cos(ang) * 6).toFixed(1) + '" cy="' + (p[1] + Math.sin(ang) * 6).toFixed(1) + '" rx="4" ry="2.4" transform="rotate(' + (a * 45) + ' ' + (p[0] + Math.cos(ang) * 6).toFixed(1) + ' ' + (p[1] + Math.sin(ang) * 6).toFixed(1) + ')" fill="#fff"/>';
        }
        out += petalsS + '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.6" fill="#ffc93c"/>';
      });
      return out;
    }
    /* sunflowers */
    [[38, 60], [64, 74]].forEach(function (p) {
      out += '<path d="M' + p[0] + ' 128 L' + p[0] + ' ' + p[1] + '" stroke="#3c8a3c" stroke-width="5"/>' +
        '<path d="M' + p[0] + ' 100 q 12 -6 16 4 q -10 4 -16 -4" fill="#4fae4c" ' + SW2 + '/>';
      var pet = '';
      for (var a = 0; a < 12; a++) {
        var ang = a * Math.PI / 6;
        pet += '<ellipse cx="' + (p[0] + Math.cos(ang) * 13).toFixed(1) + '" cy="' + (p[1] + Math.sin(ang) * 13).toFixed(1) + '" rx="7" ry="4" transform="rotate(' + (a * 30) + ' ' + (p[0] + Math.cos(ang) * 13).toFixed(1) + ' ' + (p[1] + Math.sin(ang) * 13).toFixed(1) + ')" fill="#ffcf2e" stroke="' + INK + '" stroke-width="1.5"/>';
      }
      out += pet + '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#8a5a2b" ' + SW2 + '/>';
    });
    return out;
  }
  function decor(id, st) {
    st = st || {};
    switch (id) {
      case 'tree_oak': return tree('oak');
      case 'tree_pine': return tree('pine');
      case 'tree_apple': return tree('apple');
      case 'tree_blossom': return tree('blossom');
      case 'tree_palm': return tree('palm');
      case 'flower_tulip': return flowers('tulip');
      case 'flower_daisy': return flowers('daisy');
      case 'flower_sun': return flowers('sun');
      case 'bush_rose':
        return shadow(50, 136, 32) + '<g ' + SW + '><circle cx="34" cy="116" r="18" fill="#3f9a4a"/><circle cx="66" cy="116" r="18" fill="#3f9a4a"/><circle cx="50" cy="102" r="22" fill="#4caf50"/></g>' +
          '<circle cx="40" cy="98" r="5" fill="#ff7aa8" ' + SW2 + '/><circle cx="58" cy="94" r="5" fill="#ff5c8a" ' + SW2 + '/><circle cx="30" cy="114" r="5" fill="#ff7aa8" ' + SW2 + '/>' +
          '<circle cx="66" cy="112" r="5" fill="#ff5c8a" ' + SW2 + '/><circle cx="50" cy="118" r="5" fill="#ff9dbf" ' + SW2 + '/>';
      case 'rock_mossy':
        return shadow(50, 136, 32) + '<path d="M18 134 Q 14 106 36 98 Q 56 86 74 100 Q 90 112 84 134 Z" fill="#a9a6b8" ' + SW + '/>' +
          '<path d="M30 104 Q 50 90 72 102 Q 60 98 50 104 Q 40 100 30 104 Z" fill="#6cc26a"/><path d="M60 118 q 8 -4 12 4" fill="none" stroke="#8d8aa0" stroke-width="3"/>';
      case 'lantern':
        return (st.lit ? '<circle cx="50" cy="46" r="40" fill="url(#slwGlow)"/>' : '') + shadow(50, 136, 18) +
          '<rect x="46" y="58" width="8" height="78" rx="3" fill="#4b4f6b" ' + SW2 + '/><rect x="38" y="130" width="24" height="7" rx="3" fill="#4b4f6b" ' + SW2 + '/>' +
          '<path d="M34 38 L66 38 L62 62 L38 62 Z" fill="' + (st.lit ? '#ffe36b' : '#cfe0ec') + '" ' + SW + '/><path d="M30 38 L50 24 L70 38 Z" fill="#4b4f6b" ' + SW2 + '/>';
      case 'mushroom_glow':
        return (st.lit ? '<circle cx="50" cy="108" r="46" fill="url(#slwGlowCyan)"/>' : '') + shadow(50, 136, 30) +
          [[32, 116, 13], [56, 104, 17], [72, 122, 10]].map(function (m) {
            var cap = st.lit ? '#6ff3ff' : '#b06bd8';
            return '<rect x="' + (m[0] - 4) + '" y="' + m[1] + '" width="8" height="' + (134 - m[1]) + '" rx="3" fill="#fff4e0" ' + SW2 + '/>' +
              '<path d="M' + (m[0] - m[2]) + ' ' + (m[1] + 2) + ' Q' + m[0] + ' ' + (m[1] - m[2] * 1.4) + ' ' + (m[0] + m[2]) + ' ' + (m[1] + 2) + ' Z" fill="' + cap + '" ' + SW2 + '/>' +
              '<circle cx="' + (m[0] - 4) + '" cy="' + (m[1] - 4) + '" r="2.2" fill="#fff"/>';
          }).join('');
      case 'flag_pole':
        return shadow(50, 136, 16) + '<rect x="30" y="20" width="6" height="116" rx="3" fill="#8f8aa6" ' + SW2 + '/><circle cx="33" cy="18" r="5" fill="#ffd23f" ' + SW2 + '/>' +
          '<g class="slw-flag"><path d="M36 26 Q 56 18 76 28 Q 86 40 76 50 Q 56 58 36 52 Z" fill="#ff6b6b" ' + SW2 + '/><path d="M46 38 l6 -6 l6 6 l-6 6 z" fill="#ffd23f"/></g>';
      case 'bunting':
        return shadow(50, 136, 30) + '<rect x="12" y="62" width="6" height="74" rx="3" fill="#9b6b43" ' + SW2 + '/><rect x="82" y="62" width="6" height="74" rx="3" fill="#9b6b43" ' + SW2 + '/>' +
          '<path d="M15 66 Q 50 86 85 66" fill="none" stroke="' + INK + '" stroke-width="2"/>' +
          '<g class="slw-flag">' + ['#ff6b6b', '#ffd23f', '#4fc3f7', '#7bd88f', '#c38bff'].map(function (c, i) {
            var x = 20 + i * 13, y = 68 + Math.sin((i + 0.5) / 5 * Math.PI) * 10;
            return '<path d="M' + x + ' ' + y.toFixed(1) + ' l12 0 l-6 14 z" fill="' + c + '" ' + SW2 + '/>';
          }).join('') + '</g>';
      case 'bench':
        return shadow(50, 136, 34) + '<g ' + SW2 + '><rect x="16" y="102" width="68" height="10" rx="3" fill="#c48a52"/><rect x="16" y="86" width="68" height="9" rx="3" fill="#c48a52"/>' +
          '<rect x="22" y="112" width="6" height="22" fill="#6b5a7a"/><rect x="72" y="112" width="6" height="22" fill="#6b5a7a"/><rect x="22" y="86" width="5" height="26" fill="#6b5a7a"/><rect x="73" y="86" width="5" height="26" fill="#6b5a7a"/></g>';
      case 'sandcastle':
        return shadow(50, 136, 34) + '<g ' + SW2 + ' fill="#f2cd7c"><rect x="20" y="96" width="60" height="38" rx="3"/><rect x="14" y="78" width="20" height="56" rx="2"/><rect x="66" y="78" width="20" height="56" rx="2"/>' +
          '<rect x="38" y="70" width="24" height="30" rx="2"/></g><path d="M44 134 v-14 a6 6 0 0 1 12 0 v14 z" fill="#c99a4d"/><rect x="49" y="46" width="2" height="24" fill="' + INK + '"/><path d="M51 46 l14 5 l-14 5 z" fill="#ff6b6b"/>';
      case 'umbrella':
        return shadow(50, 136, 30) + '<rect x="48" y="44" width="4" height="92" fill="#8f8aa6"/><path d="M8 58 Q 50 6 92 58 Z" fill="#ff6b6b" ' + SW + '/>' +
          '<path d="M30 58 Q 50 6 50 6 Q 50 6 70 58 Z" fill="#fff"/><path d="M8 58 Q 50 6 92 58" fill="none" ' + SW + '/><ellipse cx="68" cy="128" rx="18" ry="6" fill="#4fc3f7" ' + SW2 + '/>';
      case 'snowman':
        return shadow(50, 136, 26) + '<g ' + SW + ' fill="#fdfdff"><circle cx="50" cy="114" r="22"/><circle cx="50" cy="78" r="16"/></g>' +
          '<path d="M34 64 L66 64 L62 52 L38 52 Z" fill="#3b2f4a"/><rect x="32" y="62" width="36" height="5" fill="#3b2f4a"/><path d="M50 80 l14 3 l-14 3 z" fill="#ff8a3d"/>' +
          '<circle cx="44" cy="74" r="2.5" fill="' + INK + '"/><circle cx="56" cy="74" r="2.5" fill="' + INK + '"/><path d="M36 92 q14 8 28 0 l0 7 q-14 8 -28 0 z" fill="#ff5c6c"/>';
      case 'windmill':
        return shadow(50, 136, 26) + '<path d="M36 136 L42 66 L58 66 L64 136 Z" fill="#f6efe2" ' + SW + '/><rect x="45" y="112" width="10" height="24" fill="#9b6b43"/>' +
          '<g class="slw-spin" style="transform-origin:50px 62px"><g ' + SW2 + ' fill="#ffffff"><path d="M50 62 L46 18 L54 18 Z"/><path d="M50 62 L94 58 L94 66 Z"/><path d="M50 62 L54 106 L46 106 Z"/><path d="M50 62 L6 66 L6 58 Z"/></g></g>' +
          '<circle cx="50" cy="62" r="5" fill="#ff6b6b" ' + SW2 + '/>';
      case 'lighthouse':
        return (st.lit ? '<path d="M50 32 L0 10 L0 54 Z" fill="#fff6a8" opacity="0.55"/><path d="M50 32 L100 10 L100 54 Z" fill="#fff6a8" opacity="0.55"/>' : '') + shadow(50, 136, 26) +
          '<path d="M34 136 L40 46 L60 46 L66 136 Z" fill="#fff" ' + SW + '/><path d="M37 98 L63 98 L64.5 118 L35.5 118 Z" fill="#ff5c6c"/><path d="M39 62 L61 62 L62 80 L38 80 Z" fill="#ff5c6c"/>' +
          '<rect x="38" y="24" width="24" height="22" rx="4" fill="' + (st.lit ? '#ffe36b' : '#cfe0ec') + '" ' + SW + '/><path d="M34 26 L50 10 L66 26 Z" fill="#ff5c6c" ' + SW2 + '/>';
      /* fun */
      case 'trampoline':
        return shadow(50, 136, 38) + '<g ' + SW2 + '><path d="M16 118 l-4 18" /><path d="M84 118 l4 18"/><path d="M50 122 l0 14"/></g>' +
          '<ellipse cx="50" cy="114" rx="40" ry="14" fill="#4b8ff0" ' + SW + '/><ellipse cx="50" cy="112" rx="30" ry="9" fill="#2a64c9"/><ellipse cx="40" cy="110" rx="9" ry="3" fill="#7fb3ff" opacity="0.8"/>';
      case 'fountain':
        return shadow(50, 136, 40) + '<ellipse cx="50" cy="122" rx="42" ry="14" fill="#c9c3d9" ' + SW + '/><ellipse cx="50" cy="118" rx="34" ry="9" fill="#6fd0ff"/>' +
          '<rect x="44" y="76" width="12" height="42" fill="#c9c3d9" ' + SW2 + '/><ellipse cx="50" cy="78" rx="18" ry="6" fill="#c9c3d9" ' + SW2 + '/>' +
          '<g class="slw-water"><path d="M50 74 Q 40 50 30 74" fill="none" stroke="#6fd0ff" stroke-width="4" stroke-linecap="round"/><path d="M50 74 Q 60 50 70 74" fill="none" stroke="#6fd0ff" stroke-width="4" stroke-linecap="round"/><path d="M50 74 L50 46" stroke="#a8e6ff" stroke-width="5" stroke-linecap="round"/></g>';
      case 'swing':
        return shadow(50, 136, 36) + '<g ' + SW + ' fill="none"><path d="M14 136 L28 30 L42 136"/><path d="M58 136 L72 30 L86 136"/><path d="M24 32 L76 32"/></g>' +
          '<g class="slw-swing" style="transform-origin:50px 32px"><path d="M42 32 L42 104 M58 32 L58 104" stroke="#8f8aa6" stroke-width="2.5"/><rect x="36" y="102" width="28" height="7" rx="3" fill="#ff8a3d" ' + SW2 + '/></g>';
      case 'bubbles':
        return shadow(50, 136, 30) + '<rect x="24" y="100" width="52" height="34" rx="8" fill="#c38bff" ' + SW + '/><circle cx="50" cy="117" r="9" fill="#fff" ' + SW2 + '/>' +
          '<path d="M60 100 L72 70" stroke="#8f8aa6" stroke-width="4" stroke-linecap="round"/><circle cx="74" cy="64" r="8" fill="none" stroke="#8f8aa6" stroke-width="3"/>' +
          '<g class="slw-bubbles"><circle cx="70" cy="40" r="7" fill="rgba(180,230,255,0.35)" stroke="#9fdcff" stroke-width="2"/><circle cx="56" cy="22" r="5" fill="rgba(180,230,255,0.35)" stroke="#9fdcff" stroke-width="2"/><circle cx="84" cy="26" r="4" fill="rgba(180,230,255,0.35)" stroke="#9fdcff" stroke-width="2"/></g>';
    }
    return null;
  }

  /* ---------------- paths (ground tiles, 100×78) ---------------- */
  function pathTile(id) {
    if (id === 'path_wood') {
      var planks = '';
      for (var i = 0; i < 5; i++) planks += '<rect x="' + (8 + i * 17.5) + '" y="8" width="15" height="62" rx="3" fill="' + (i % 2 ? '#c98f58' : '#d69d64') + '" ' + SW2 + '/>';
      return planks;
    }
    if (id === 'path_flower') {
      return '<ellipse cx="30" cy="26" rx="18" ry="11" fill="#d9d3e6" ' + SW2 + '/><ellipse cx="68" cy="50" rx="19" ry="12" fill="#d9d3e6" ' + SW2 + '/>' +
        '<circle cx="70" cy="20" r="4" fill="#ff7ab8"/><circle cx="24" cy="56" r="4" fill="#ffc93c"/><circle cx="48" cy="38" r="3" fill="#fff"/>';
    }
    return '<g fill="#cfc8dc" ' + SW2 + '><ellipse cx="26" cy="22" rx="17" ry="11"/><ellipse cx="70" cy="22" rx="20" ry="11"/><ellipse cx="46" cy="52" rx="20" ry="12"/><ellipse cx="84" cy="56" rx="12" ry="10"/><ellipse cx="12" cy="56" rx="9" ry="9"/></g>';
  }

  /* ================================================================
     ENCORE CITY v2 — shared 2D pieces for the home shapes, the city
     buildings and the new accessories. Colours are the art bible v2
     PALETTE_V2 tokens (the same names the 3D look table uses), written
     here as hex so the 2D fallback needs nothing else loaded:
       Midnight Ink #14101f · Graphite #2e2b3a · Night Asphalt #3a3646
       Concrete #8c8798 / Light #c9c5d3 · Bone White #f4f2fa
       Smoked Glass #1b2438 · Glass Edge #8fb7ff · Smoked Deep #0e1626
       Gunmetal #5a5f72 / Spec #e6e9f2 / Mid #7c8194 / Deep #2a2d3a
       Teak #9a6a4a / Light #b07e58 · Milk Tea #e2be94 · CTA Magenta #e0157f
       Neon Magenta #ff2e9a · LED Cyan #22e4ff · Electric Violet #8a5cff
       Laser Lime #c6ff3d · Sunset Amber #ffb23e · Window Warm #ffd08a
       Leaf Deep #2f7d57 · Leaf Lit #57b07a · Night Glass Plum #43294f
       Error Coral #ff5a6a
     Neon only ever goes on lines, rings, signs and screens.
     CSS HOOKS (styled by world/island-encore.css; every animation there is
     <= 2 Hz and off under reduced motion — nothing here animates by itself):
       .slw-neon     neon tube / sign / ring; `color` = its hue (Showtime glow)
       .slw-win      smoked glazing (warm fill at Showtime)
       .slw-strip    photo strip (Photo Booth, act 'snap'; origin = top edge)
       .slw-pearls   boba pearls (act 'serve')      .slw-hatch  serving hatch (origin = top)
       .slw-screen   LED tower screen; data-prog="0..3" picks the visible
                     .slw-prog.pN group (st.prog, default 0; the others ship
                     display="none"); p1 is the active pet (st.pet) in pixels
       .slw-marquee  the child's name on the LED tower (scroll by -50%: the text repeats)
       .slw-onair    ON AIR lightbox, dim at rest (act 'record' lights it, steady)
       .slw-eq       EQ / VU bars (origin = bottom)  .slw-floor  dance-floor tiles
       .slw-bean     rooftop beanbags (origin = bottom)
       .slw-beam     stage light beams, opacity 0 until Showtime (act 'encore' turns
                     .showtime on for 8 s; the beams follow it, nothing else)
       .slw-twinkle  festoon and booth bulbs (v1 class)  .slw-smoke, .slw-flag (v1)
     ================================================================ */

  var NEON_DEFAULT = '#ff2e9a';               /* Neon Magenta, when no member colour is given */
  var SIGN_FONT = 'font-family="Unbounded, Outfit, Arial, sans-serif" font-weight="800" text-anchor="middle"';
  function n1(x) { return String(Math.round(x * 10) / 10); }
  function hexOk(h) { return typeof h === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(h) ? h.toLowerCase() : null; }
  function xmlEsc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* the ✦ spark: a 4-point star (never 5) centred on (cx, cy) */
  function star4(cx, cy, r) {
    var i = r * 0.28;
    return 'M' + n1(cx) + ' ' + n1(cy - r) + ' L' + n1(cx + i) + ' ' + n1(cy - i) + ' L' + n1(cx + r) + ' ' + n1(cy) + ' L' + n1(cx + i) + ' ' + n1(cy + i) +
      ' L' + n1(cx) + ' ' + n1(cy + r) + ' L' + n1(cx - i) + ' ' + n1(cy + i) + ' L' + n1(cx - r) + ' ' + n1(cy) + ' L' + n1(cx - i) + ' ' + n1(cy - i) + ' Z';
  }
  /* a neon tube: soft sleeve + bright core in one .slw-neon group */
  function neon(d, col, w) {
    return '<g class="slw-neon" color="' + col + '" fill="none" stroke="' + col + '" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + d + '" stroke-width="' + n1(w * 2.6) + '" opacity="0.3"/><path d="' + d + '" stroke-width="' + n1(w) + '"/></g>';
  }
  function neonStar(cx, cy, r, col) { return '<path class="slw-neon" color="' + col + '" d="' + star4(cx, cy, r) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>'; }
  /* smoked glass pane with a Glass Edge glint and Gunmetal mullions */
  function glass(x, y, w, h, cols, rows) {
    var out = '<rect class="slw-win" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="#1b2438" ' + SW2 + '/>';
    var bars = '';
    for (var c = 1; c < cols; c++) bars += 'M' + n1(x + w * c / cols) + ' ' + y + ' v' + h + ' ';
    for (var r = 1; r < rows; r++) bars += 'M' + x + ' ' + n1(y + h * r / rows) + ' h' + w + ' ';
    if (bars) out += '<path d="' + bars + '" stroke="#5a5f72" stroke-width="2"/>';
    var g = Math.min(w, h, 16) * 0.6;
    return out + '<path d="M' + n1(x + 3) + ' ' + n1(y + 3 + g) + ' L' + n1(x + 3 + g) + ' ' + n1(y + 3) + '" stroke="#8fb7ff" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>';
  }
  function porthole(cx, cy, r) {
    return '<circle class="slw-win" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1b2438"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#5a5f72" stroke-width="3"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 1.5) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<path d="M' + n1(cx - r * 0.5) + ' ' + n1(cy - r * 0.1) + ' Q' + n1(cx - r * 0.45) + ' ' + n1(cy - r * 0.5) + ' ' + n1(cx - r * 0.05) + ' ' + n1(cy - r * 0.55) + '" fill="none" stroke="#8fb7ff" stroke-width="1.5" stroke-linecap="round"/>';
  }
  /* a painted trim stripe, pattern A/B/C by variant (solid / dashed / dotted) */
  function stripeBand(x1, x2, y, v, col) {
    var dash = ['', ' stroke-dasharray="9 6"', ' stroke-dasharray="0.1 7"'][v] || '';
    return '<path d="M' + x1 + ' ' + y + ' L' + x2 + ' ' + y + '" stroke="' + col + '" stroke-width="3" stroke-linecap="round"' + dash + '/>';
  }
  function mirror(w, inner) { return '<g transform="matrix(-1 0 0 1 ' + w + ' 0)">' + inner + '</g>'; }

  /* roof finish colours: the LOCKED pair literal (one copy, parsed by the look tests) */
  function roofPair(roof) {
    var rc = { roof_red: ['#e0574f', '#c4433c'], roof_blue: ['#4a6fa5', '#3a5888'], roof_thatch: ['#e3b24f', '#c99634'], roof_candy: ['#ff8fb8', '#f06d9e'] }[roof] || ['#e0574f', '#c4433c'];
    return rc;
  }
  var CASTLE = { stone: '#b9b4c9', tower: '#cdc8dc', cone: '#6c5ce7', slit: '#4b4f6b' };
  var CANDY_BITS = ['#ffd23f', '#4fc3f7', '#7bd88f', '#c38bff', '#fff'];

  /* ---------------- house (2×2, viewBox 200×250, front base y≈206) ----------------
     st = {shape, wall, roof, door, details, variant (0|1), member (hex)}.
     A missing or unknown shape draws the classic cottage, byte-identical to v1:
     the caller (rewards-world artState) resolves the default shape. Every shape
     keeps the door at x 86–114 standing on the y≈206 step, so the 2D doorway and
     the avatar beside the house line up. The roof slot is each shape's crown. */
  function house(st) {
    st = st || {};
    var draw = SHAPE_ART[st.shape];
    return draw ? draw(st) : cottage(st);
  }
  function cottage(st) {
    var wall = WALL[st.wall] || WALL.wall_cream, door = DOOR[st.door] || DOOR.door_blue, roof = st.roof || 'roof_red';
    var det = st.details || {};
    var out = shadow(100, 214, 92);
    if (det.detail_chimney) {
      out += '<rect x="132" y="40" width="20" height="44" fill="#b4675a" ' + SW + '/><rect x="128" y="34" width="28" height="10" rx="2" fill="#93524a" ' + SW2 + '/>' +
        '<g class="slw-smoke"><circle cx="142" cy="24" r="7" fill="#eef0f6"/><circle cx="150" cy="12" r="9" fill="#eef0f6"/><circle cx="160" cy="0" r="10" fill="#eef0f6" opacity="0.8"/></g>';
    }
    /* walls */
    out += '<rect x="32" y="104" width="136" height="104" rx="6" fill="' + wall + '" ' + SW + '/>' +
      '<rect x="32" y="190" width="136" height="18" fill="rgba(0,0,0,0.06)"/>';
    /* roof */
    if (roof === 'roof_castle') {
      out += '<rect x="28" y="88" width="144" height="22" fill="#b9b4c9" ' + SW + '/>';
      for (var b = 0; b < 7; b++) out += '<rect x="' + (30 + b * 20) + '" y="74" width="12" height="16" fill="#b9b4c9" ' + SW2 + '/>';
      out += '<rect x="14" y="58" width="34" height="150" fill="#cdc8dc" ' + SW + '/><rect x="152" y="58" width="34" height="150" fill="#cdc8dc" ' + SW + '/>' +
        '<path d="M10 60 L31 18 L52 60 Z" fill="#6c5ce7" ' + SW + '/><path d="M148 60 L169 18 L190 60 Z" fill="#6c5ce7" ' + SW + '/>' +
        '<path d="M31 18 l0 -14 l14 6 l-14 6" fill="#ff6b6b" ' + SW2 + '/><path d="M169 18 l0 -14 l14 6 l-14 6" fill="#ffd23f" ' + SW2 + '/>' +
        '<rect x="24" y="96" width="14" height="20" rx="7" fill="#4b4f6b"/><rect x="162" y="96" width="14" height="20" rx="7" fill="#4b4f6b"/>';
    } else {
      var rc = roofPair(roof);
      out += '<path d="M18 112 L100 40 L182 112 Z" fill="' + rc[0] + '" ' + SW + '/>' +
        '<path d="M100 40 L182 112 L160 112 L100 58 Z" fill="' + rc[1] + '"/>';
      if (roof === 'roof_red' || roof === 'roof_blue') {
        for (var r = 0; r < 3; r++) out += '<path d="M' + (44 + r * 8) + ' ' + (88 - r * 12) + ' L' + (156 - r * 8) + ' ' + (88 - r * 12) + '" stroke="' + rc[1] + '" stroke-width="3"/>';
      }
      if (roof === 'roof_thatch') {
        for (var t = 0; t < 10; t++) out += '<path d="M' + (30 + t * 15) + ' 110 l6 -18" stroke="#b9842a" stroke-width="2.5"/>';
        out += '<path d="M18 112 Q 100 124 182 112" fill="none" ' + SW + '/>';
      }
      if (roof === 'roof_candy') {
        out += '<path d="M24 108 Q 40 120 56 108 Q 72 120 88 108 Q 104 120 120 108 Q 136 120 152 108 Q 168 120 178 110" fill="#fff" ' + SW2 + '/>';
        ['#ffd23f', '#4fc3f7', '#7bd88f', '#c38bff', '#fff'].forEach(function (c, i) {
          out += '<rect x="' + (66 + i * 16) + '" y="' + (74 + (i % 2) * 14) + '" width="7" height="3" rx="1.5" fill="' + c + '" transform="rotate(' + (i * 37) + ' ' + (69 + i * 16) + ' ' + (75 + (i % 2) * 14) + ')"/>';
        });
        out += '<circle cx="100" cy="36" r="8" fill="#ff5c6c" ' + SW2 + '/>';
      }
    }
    if (det.detail_lights) {
      var lc = ['#ffd23f', '#ff6b6b', '#4fc3f7', '#7bd88f', '#c38bff'];
      out += '<path d="M24 110 Q 100 122 176 110" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      for (var l = 0; l < 9; l++) out += '<circle class="slw-twinkle" style="animation-delay:' + (l * 0.23).toFixed(2) + 's" cx="' + (30 + l * 17.5) + '" cy="' + (114 + Math.sin(l / 8 * Math.PI) * 5).toFixed(1) + '" r="3.6" fill="' + lc[l % 5] + '"/>';
    }
    if (det.detail_flag && roof !== 'roof_castle') {
      out += '<rect x="98" y="8" width="3" height="34" fill="' + INK + '"/><g class="slw-flag"><path d="M101 9 l22 7 l-22 7 z" fill="#ffd23f" ' + SW2 + '/></g>';
    }
    /* windows + door */
    [[52, 128], [124, 128]].forEach(function (p) {
      out += '<rect x="' + p[0] + '" y="' + p[1] + '" width="26" height="24" rx="4" fill="#bfe6ff" ' + SW + '/>' +
        '<path d="M' + (p[0] + 13) + ' ' + p[1] + ' v24 M' + p[0] + ' ' + (p[1] + 12) + ' h26" stroke="' + INK + '" stroke-width="2"/>';
      if (det.detail_windowbox) {
        out += '<rect x="' + (p[0] - 3) + '" y="' + (p[1] + 25) + '" width="32" height="8" rx="2" fill="#9b6b43" ' + SW2 + '/>' +
          '<circle cx="' + (p[0] + 4) + '" cy="' + (p[1] + 24) + '" r="4" fill="#ff5c8a"/><circle cx="' + (p[0] + 14) + '" cy="' + (p[1] + 22) + '" r="4" fill="#ffd23f"/><circle cx="' + (p[0] + 24) + '" cy="' + (p[1] + 24) + '" r="4" fill="#ff7ab8"/>';
      }
    });
    out += '<path d="M86 208 L86 164 Q100 150 114 164 L114 208 Z" fill="' + door + '" ' + SW + '/><circle cx="108" cy="188" r="2.6" fill="#ffd23f"/>' +
      '<rect x="80" y="206" width="40" height="6" rx="3" fill="#b8b2c9" ' + SW2 + '/>';
    /* v2 items only (v1 states never reach these lines, so v1 output is unchanged) */
    if (st.door === 'door_glass') out += glassDoorTrim('M90 206 L90 166 Q100 156 110 166 L110 206', 'M93 196 L93 170 Q96 165 100 163');
    if (det.detail_neon) out += neon(roof === 'roof_castle' ? 'M28 88 L172 88 M14 58 L48 58 M152 58 L186 58' : 'M18 112 L100 40 L182 112', memberHex(st), 2.4);
    return out;
  }

  /* door_glass on any shape: a Gunmetal inner frame and a Glass Edge glint */
  function glassDoorTrim(frame, glint) {
    return '<path d="' + frame + '" fill="none" stroke="#5a5f72" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="' + glint + '" fill="none" stroke="#8fb7ff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>';
  }
  function memberHex(st) { return hexOk(st && st.member) || NEON_DEFAULT; }
  function trimOf(st) { return (st.variant | 0) === 1 ? 1 : 0; }

  /* modern slab door at x 86–114 (top y0, bottom yb) with a bar handle and the shared step */
  function slabDoor(st, y0, yb) {
    yb = yb || 208;
    var out = '<rect x="86" y="' + y0 + '" width="28" height="' + (yb - y0) + '" rx="2" fill="' + (DOOR[st.door] || DOOR.door_blue) + '" ' + SW + '/>';
    if (st.door === 'door_glass') out += glassDoorTrim('M90 ' + (yb - 3) + ' L90 ' + (y0 + 4) + ' L110 ' + (y0 + 4) + ' L110 ' + (yb - 3), 'M93 ' + (y0 + 22) + ' L99 ' + (y0 + 9));
    out += '<rect x="106" y="' + n1(y0 + (yb - y0) * 0.4) + '" width="3.4" height="13" rx="1.7" fill="#e6e9f2" stroke="' + INK + '" stroke-width="1"/>';
    return out + '<rect x="80" y="206" width="40" height="6" rx="3" fill="#c9c5d3" ' + SW2 + '/>';
  }
  /* a red-roof shape's tiled pent canopy over the entrance */
  function entranceCanopy(y, rc) {
    return '<path d="M76 ' + y + ' L124 ' + y + ' L119 ' + (y + 9) + ' L81 ' + (y + 9) + ' Z" fill="' + rc[0] + '" ' + SW2 + '/>' +
      '<path d="M86 ' + (y + 1) + ' l-2 7 M96 ' + (y + 1) + ' l-1 7 M104 ' + (y + 1) + ' l1 7 M114 ' + (y + 1) + ' l2 7" stroke="' + rc[1] + '" stroke-width="2"/>';
  }
  /* blue roofs clad the top storey in slate */
  function slateClad(x, y, w, h, rc) {
    var lines = '';
    for (var yy = y + 8; yy < y + h - 2; yy += 8) lines += 'M' + (x + 2) + ' ' + yy + ' h' + (w - 4) + ' ';
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + rc[0] + '" ' + SW + '/><path d="' + lines + '" stroke="' + rc[1] + '" stroke-width="2"/>';
  }
  /* teak accent cladding (the trim variant decides which side it sits on) */
  function teakPanel(x, y, w, h) {
    var boards = '';
    for (var xx = x + 6; xx < x + w - 2; xx += 6) boards += 'M' + xx + ' ' + (y + 2) + ' v' + (h - 4) + ' ';
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#9a6a4a" ' + SW2 + '/><path d="' + boards + '" stroke="#b07e58" stroke-width="2"/>';
  }
  function turret(x, yTop, yBase, coneH, pennant) {
    var cx = x + 11;
    return '<rect x="' + x + '" y="' + yTop + '" width="22" height="' + (yBase - yTop) + '" fill="' + CASTLE.tower + '" ' + SW + '/>' +
      '<rect x="' + (x + 7) + '" y="' + (yTop + 10) + '" width="8" height="14" rx="4" fill="' + CASTLE.slit + '"/>' +
      '<path d="M' + (x - 4) + ' ' + (yTop + 2) + ' L' + cx + ' ' + (yTop + 2 - coneH) + ' L' + (x + 26) + ' ' + (yTop + 2) + ' Z" fill="' + CASTLE.cone + '" ' + SW + '/>' +
      '<path d="M' + cx + ' ' + (yTop + 2 - coneH) + ' l0 -12 l12 5 l-12 5" fill="' + pennant + '" ' + SW2 + '/>';
  }
  function merlons(x1, x2, y) {
    var out = '';
    for (var x = x1; x + 10 <= x2; x += 18) out += '<rect x="' + x + '" y="' + (y - 9) + '" width="10" height="10" fill="' + CASTLE.stone + '" ' + SW2 + '/>';
    return out;
  }
  function sprinkles(pts) {
    return pts.map(function (p, i) {
      return '<rect x="' + n1(p[0] - 3.5) + '" y="' + n1(p[1] - 1.5) + '" width="7" height="3" rx="1.5" fill="' + CANDY_BITS[i % 5] + '" transform="rotate(' + (i * 37 % 180) + ' ' + n1(p[0]) + ' ' + n1(p[1]) + ')"/>';
    }).join('');
  }
  function cherry(cx, cy) { return '<path d="M' + cx + ' ' + (cy - 6) + ' q 2 -8 8 -9" fill="none" stroke="#2f7d57" stroke-width="2" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="6.5" fill="#ff5c6c" ' + SW2 + '/>'; }

  /* flat-parapet crown (loft, tower): a coping band x1..x2 with its top at y */
  function flatCrown(x1, x2, y, roof, rc) {
    var w = x2 - x1, out = '', i;
    if (roof === 'roof_castle') {
      out += '<rect x="' + x1 + '" y="' + y + '" width="' + w + '" height="9" fill="' + CASTLE.stone + '" ' + SW2 + '/>' + merlons(x1 + 22, x2 - 22, y + 1);
      var coneH = Math.max(14, Math.min(30, y - 26));
      return out + turret(x1 - 8, y - 10, y + 40, coneH, '#ff6b6b') + turret(x2 - 14, y - 10, y + 40, coneH, '#ffd23f');
    }
    if (roof === 'roof_thatch') {
      out += '<path d="M' + (x1 - 3) + ' ' + (y + 8) + ' Q' + (x1 - 3) + ' ' + (y - 9) + ' ' + (x1 + 14) + ' ' + (y - 9) + ' L' + (x2 - 14) + ' ' + (y - 9) + ' Q' + (x2 + 3) + ' ' + (y - 9) + ' ' + (x2 + 3) + ' ' + (y + 8) + ' Z" fill="' + rc[0] + '" ' + SW + '/>';
      var tufts = '', fringe = 'M' + (x1 - 2) + ' ' + (y + 8);
      for (i = 0; x1 + 10 + i * 12 < x2 - 6; i++) tufts += 'M' + (x1 + 10 + i * 12) + ' ' + (y + 4) + ' l4 -10 ';
      for (i = 0; x1 + i * 8 < x2; i++) fringe += ' l4 6 l4 -6';
      return out + '<path d="' + tufts + '" stroke="#b9842a" stroke-width="2.5" stroke-linecap="round"/><path d="' + fringe + '" fill="none" stroke="#b9842a" stroke-width="2" stroke-linejoin="round"/>';
    }
    if (roof === 'roof_candy') {
      /* icing over a pink coping: 12 drips of three lengths, scalloped between */
      var seg = w / 12, ice = 'M' + x1 + ' ' + (y - 2) + ' L' + x2 + ' ' + (y - 2) + ' L' + x2 + ' ' + (y + 5);
      for (i = 11; i >= 0; i--) {
        var a = x1 + i * seg, c = a + seg / 2, len = 5 + (i * 5 % 3) * 4;
        ice += ' Q' + n1(a + seg * 0.85) + ' ' + (y + 7) + ' ' + n1(c + 3.5) + ' ' + (y + 6) + ' L' + n1(c + 3.5) + ' ' + (y + 6 + len) +
          ' A3.5 3.5 0 0 1 ' + n1(c - 3.5) + ' ' + (y + 6 + len) + ' L' + n1(c - 3.5) + ' ' + (y + 6) + ' Q' + n1(a + seg * 0.15) + ' ' + (y + 7) + ' ' + n1(a) + ' ' + (y + 5);
      }
      var pts = [];
      for (i = 0; i < 10; i++) pts.push([x1 + 9 + i * (w - 18) / 9, y + (i % 2 ? 2.5 : 0.5)]);
      return out + '<rect x="' + x1 + '" y="' + y + '" width="' + w + '" height="9" fill="' + rc[0] + '" ' + SW2 + '/>' +
        '<path d="' + ice + ' Z" fill="#fff" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' + sprinkles(pts) + cherry(x2 - 7, y - 7);
    }
    /* red: terracotta coping with tile ticks; blue: slate coping */
    out += '<rect x="' + x1 + '" y="' + y + '" width="' + w + '" height="9" rx="2" fill="' + (roof === 'roof_blue' ? rc[1] : rc[0]) + '" ' + SW2 + '/>';
    var ticks = '';
    for (var tx = x1 + 6; tx < x2 - 2; tx += 8) ticks += 'M' + tx + ' ' + (y + 2) + ' v5 ';
    return out + '<path d="' + ticks + '" stroke="' + (roof === 'roof_blue' ? rc[0] : rc[1]) + '" stroke-width="2"/>';
  }

  /* details shared by the modern shapes */
  function flue(x, y, h) {
    return '<rect x="' + x + '" y="' + y + '" width="8" height="' + h + '" rx="2" fill="#7c8194" ' + SW2 + '/><rect x="' + (x - 2) + '" y="' + (y - 4) + '" width="12" height="6" rx="2" fill="#5a5f72" ' + SW2 + '/>' +
      '<g class="slw-smoke"><circle cx="' + (x + 5) + '" cy="' + (y - 12) + '" r="6" fill="#eef0f6"/><circle cx="' + (x + 12) + '" cy="' + (y - 22) + '" r="8" fill="#eef0f6"/><circle cx="' + (x + 20) + '" cy="' + (y - 33) + '" r="9" fill="#eef0f6" opacity="0.8"/></g>';
  }
  function windowBox(x, y, w) {
    var out = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="7" rx="2" fill="#9a6a4a" ' + SW2 + '/>', cols = ['#ff5c8a', '#ffd23f', '#ff7ab8', '#c38bff'];
    for (var i = 0, k = Math.max(2, Math.round(w / 11)); i < k; i++) out += '<circle cx="' + n1(x + 5 + i * (w - 10) / (k - 1)) + '" cy="' + (y - 1 - (i % 2) * 2) + '" r="3.6" fill="' + cols[i % 4] + '"/>';
    return out;
  }
  function fairyLights(x1, x2, y, sag) {
    var lc = ['#ffd08a', '#ff2e9a', '#22e4ff', '#c6ff3d', '#8a5cff'];
    var out = '<path d="M' + x1 + ' ' + y + ' Q ' + n1((x1 + x2) / 2) + ' ' + (y + sag * 2) + ' ' + x2 + ' ' + y + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
    for (var l = 0; l < 11; l++) {
      var t = l / 10;
      out += '<circle class="slw-twinkle" style="animation-delay:' + (l * 0.19).toFixed(2) + 's" cx="' + n1(x1 + (x2 - x1) * t) + '" cy="' + n1(y + sag * 4 * t * (1 - t) + 2.5) + '" r="3" fill="' + lc[l % 5] + '"/>';
    }
    return out;
  }
  function roofFlag(x, y) {
    return '<rect x="' + (x - 1.5) + '" y="' + (y - 34) + '" width="3" height="34" fill="' + INK + '"/><g class="slw-flag"><path d="M' + (x + 1.5) + ' ' + (y - 33) + ' l22 7 l-22 7 z" fill="#ffd23f" ' + SW2 + '/></g>';
  }

  /* City loft: two stacked boxes, the top one cantilevered left over the door
     as a porch (teak soffit + 3 downlights), a ribbon window and a glass wall */
  function loft(st) {
    var v = trimOf(st), roof = st.roof || 'roof_red', castle = roof === 'roof_castle', rc = roofPair(roof);
    var wall = WALL[st.wall] || WALL.wall_cream, det = st.details || {};
    var out = shadow(100, 214, 92);
    if (det.detail_chimney) out += flue(136, 46, 36);
    out += '<rect x="64" y="138" width="108" height="70" rx="4" fill="' + wall + '" ' + SW + '/><rect x="64" y="190" width="108" height="18" fill="rgba(0,0,0,0.06)"/>';
    out += roof === 'roof_blue' ? slateClad(28, 82, 128, 60, rc) : '<rect x="28" y="82" width="128" height="60" rx="4" fill="' + wall + '" ' + SW + '/>';
    out += v ? teakPanel(28, 82, 24, 60) : teakPanel(132, 82, 24, 60);
    var rw = v ? [58, 86, 3] : [40, 86, 4];                       /* ribbon window: x, width, panes */
    out += glass(rw[0], 96, rw[1], 26, rw[2], 1);
    if (det.detail_windowbox) out += windowBox(rw[0] - 2, 124, rw[1] + 4);
    out += glass(v ? 122 : 124, 150, v ? 44 : 42, 52, v ? 3 : 2, 1);   /* floor-to-ceiling glass */
    out += '<rect x="28" y="140" width="92" height="7" fill="#9a6a4a" ' + SW2 + '/>' +
      '<circle cx="46" cy="148.5" r="2.2" fill="#ffd08a"/><circle cx="74" cy="148.5" r="2.2" fill="#ffd08a"/><circle cx="102" cy="148.5" r="2.2" fill="#ffd08a"/>';
    if (roof === 'roof_red') out += entranceCanopy(147, rc);
    out += slabDoor(st, 158);
    out += flatCrown(24, 160, 76, roof, rc) + neon('M30 88 L154 88', '#22e4ff', 1.4);
    if (det.detail_lights) out += fairyLights(30, 154, 89, 4);
    if (det.detail_flag && !castle) out += roofFlag(152, roof === 'roof_thatch' ? 67 : 76);
    if (det.detail_neon) out += neon('M24 85 L24 76 L160 76 L160 85 M156 138 L172 138 L172 146', memberHex(st), 2.2);
    return out;
  }

  /* hip roof (villa): eave y ye over x1..x2, ridge y yr inset by `inset` */
  function hipCrown(x1, x2, ye, yr, inset, roof, rc, noCherry) {
    var out = '', i;
    if (roof === 'roof_castle') {
      return '<rect x="' + (x1 + 4) + '" y="' + (ye - 16) + '" width="' + (x2 - x1 - 8) + '" height="16" fill="' + CASTLE.stone + '" ' + SW + '/>' + merlons(x1 + 8, x2 - 8, ye - 15);
    }
    out += '<path d="M' + x1 + ' ' + ye + ' L' + (x1 + inset) + ' ' + yr + ' L' + (x2 - inset) + ' ' + yr + ' L' + x2 + ' ' + ye + ' Z" fill="' + rc[0] + '" ' + SW + '/>' +
      '<path d="M' + (x2 - inset) + ' ' + yr + ' L' + x2 + ' ' + ye + ' L' + (x2 - inset) + ' ' + ye + ' Z" fill="' + rc[1] + '"/>';
    var courses = roof === 'roof_blue' ? [0.3, 0.55, 0.8] : roof === 'roof_red' ? [0.38, 0.72] : [];
    courses.forEach(function (t) {
      var y = yr + t * (ye - yr), a = x1 + inset * (1 - t) + 5, b = x2 - inset * (1 - t) - 5;
      out += '<path d="M' + n1(a) + ' ' + n1(y) + ' L' + n1(b) + ' ' + n1(y) + '" stroke="' + rc[1] + '" stroke-width="' + (roof === 'roof_blue' ? 2 : 3) + '"/>';
    });
    if (roof === 'roof_thatch') {
      var straw = '';
      for (i = 0; x1 + inset * 0.6 + i * 14 < x2 - inset * 0.6; i++) straw += 'M' + n1(x1 + inset * 0.6 + i * 14) + ' ' + (ye - 2) + ' l5 -' + Math.round((ye - yr) * 0.55) + ' ';
      out += '<path d="' + straw + '" stroke="#b9842a" stroke-width="2.5"/><path d="M' + x1 + ' ' + ye + ' Q ' + ((x1 + x2) / 2) + ' ' + (ye + 10) + ' ' + x2 + ' ' + ye + '" fill="none" ' + SW + '/>';
    }
    if (roof === 'roof_candy') {
      var sc = 'M' + (x1 + 6) + ' ' + (ye - 4), step = (x2 - x1 - 12) / 8;
      for (i = 0; i < 8; i++) sc += ' Q' + n1(x1 + 6 + (i + 0.5) * step) + ' ' + (ye + 8) + ' ' + n1(x1 + 6 + (i + 1) * step) + ' ' + (ye - 4);
      out += '<path d="' + sc + '" fill="#fff" ' + SW2 + '/>' +
        sprinkles([[x1 + inset + 8, yr + 10], [x1 + inset + 30, yr + 18], [(x1 + x2) / 2, yr + 9], [x2 - inset - 30, yr + 18], [x2 - inset - 8, yr + 10]]) + (noCherry ? '' : cherry((x1 + x2) / 2, yr - 5));
    }
    return out;
  }

  /* Beach villa: a long low back wing with glass sliders, a front wing holding
     the door (porthole), a teak deck with a plunge pool and a lounger */
  function villa(st) {
    var v = trimOf(st), roof = st.roof || 'roof_red', castle = roof === 'roof_castle', rc = roofPair(roof);
    var wall = WALL[st.wall] || WALL.wall_cream, det = st.details || {}, col = memberHex(st);
    var out = shadow(100, 214, 96);
    if (castle) out += turret(6, 98, 200, 30, '#ff6b6b') + turret(172, 98, 200, 30, '#ffd23f');
    if (det.detail_chimney) out += flue(52, 92, 30);
    out += '<rect x="18" y="138" width="164" height="62" rx="4" fill="' + wall + '" ' + SW + '/><rect x="18" y="184" width="164" height="16" fill="rgba(0,0,0,0.06)"/>';
    out += v ? glass(24, 148, 52, 44, 3, 1) : glass(26, 148, 42, 44, 2, 1);
    out += glass(140, 148, 36, 40, v ? 3 : 2, 1);
    if (det.detail_windowbox) out += windowBox(v ? 24 : 26, 193, v ? 52 : 42);
    out += hipCrown(10, 190, 144, 112, 42, roof, rc);
    if (det.detail_neon) out += neon(castle ? 'M14 128 L186 128' : 'M10 144 L52 112 L148 112 L190 144', col, 2.2);
    if (det.detail_lights) out += fairyLights(16, 184, 146, 4);
    if (det.detail_flag && !castle) out += roofFlag(100, 112);
    /* front wing with the door, its accent panel and a porthole */
    out += '<rect x="66" y="160" width="68" height="48" rx="3" fill="' + wall + '" ' + SW + '/>';
    out += v ? teakPanel(116, 160, 18, 48) + porthole(76, 178, 6) : teakPanel(66, 160, 18, 48) + porthole(124, 178, 6);
    out += castle ? '<rect x="62" y="150" width="76" height="12" fill="' + CASTLE.stone + '" ' + SW2 + '/>' + merlons(66, 134, 151)
      : hipCrown(58, 142, 162, 140, 22, roof, rc, true);
    if (det.detail_neon && !castle) out += neon('M58 162 L80 140 L120 140 L142 162', col, 2.2);
    out += slabDoor(st, 170);
    /* deck, plunge pool and lounger */
    out += '<rect x="136" y="194" width="60" height="16" rx="2" fill="#9a6a4a" ' + SW2 + '/><path d="M146 196 v12 M156 196 v12 M186 196 v12" stroke="#b07e58" stroke-width="2"/>' +
      '<ellipse cx="172" cy="202" rx="18" ry="5" fill="#6fd0ff" ' + SW2 + '/><ellipse cx="172" cy="202" rx="9" ry="2.4" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.7"/>' +
      '<path d="M139 202 L148 202 L153 195" fill="none" stroke="#f4f2fa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M140 203 l0 5 M150 203 l0 5" stroke="#5a5f72" stroke-width="2"/>';
    return out;
  }

  /* Neon tower: three storeys on a concrete plinth, a low annex with an outside
     zig-zag stair, and a blade sign with the ✦ on the tower corner */
  function tower(st) {
    var v = trimOf(st), roof = st.roof || 'roof_red', castle = roof === 'roof_castle', rc = roofPair(roof);
    var wall = WALL[st.wall] || WALL.wall_cream, det = st.details || {}, col = memberHex(st);
    var out = shadow(100, 214, 90);
    if (det.detail_chimney) out += flue(164, 104, 32);
    out += '<rect x="38" y="198" width="84" height="12" rx="2" fill="#8c8798" ' + SW2 + '/>';
    out += '<rect x="44" y="44" width="72" height="156" rx="3" fill="' + wall + '" ' + SW + '/><path d="M45 96 h70 M45 148 h70" stroke="rgba(0,0,0,0.12)" stroke-width="2"/>';
    if (roof === 'roof_blue') out += slateClad(44, 44, 72, 52, rc);
    if (v) out += teakPanel(44, 44, 12, 156);
    /* grid windows on three storeys: two per floor (v0) or one wide (v1) */
    [54, 106].forEach(function (y) {
      if (v) {
        out += glass(60, y, 50, 28, 3, 1);
        if (det.detail_windowbox) out += windowBox(58, y + 30, 54);
      } else {
        out += glass(52, y, 26, 30, 1, 2) + glass(84, y, 26, 30, 1, 2);
        if (det.detail_windowbox) out += windowBox(50, y + 32, 30) + windowBox(82, y + 32, 30);
      }
    });
    out += glass(v ? 60 : 52, 158, 22, 30, 1, 2);
    /* annex, its stair and the steel coping */
    out += '<rect x="116" y="140" width="64" height="68" rx="3" fill="' + wall + '" ' + SW + '/><rect x="116" y="190" width="64" height="18" fill="rgba(0,0,0,0.06)"/>';
    if (!v) out += teakPanel(162, 142, 18, 66);
    out += glass(124, 150, 22, 26, 1, 1) + '<rect x="114" y="134" width="68" height="8" rx="2" fill="#8c8798" ' + SW2 + '/>';
    out += '<path d="M176 206 L152 180 L160 180 L176 160 L170 160 L152 142" fill="none" stroke="#5a5f72" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M166 194 h8 M160 187 h8 M154 180 h8 M162 173 h8 M168 166 h8 M164 153 h8 M158 147 h8" stroke="#7c8194" stroke-width="2.5" stroke-linecap="round"/>';
    if (roof === 'roof_red') out += entranceCanopy(142, rc);
    out += slabDoor(st, 152, 200);
    /* the blade sign: ✦ in the member colour (no letters, so icons stay non-personal) */
    out += '<path d="M42 74 h4 M42 118 h4" stroke="#5a5f72" stroke-width="3"/><rect x="28" y="66" width="14" height="60" rx="2" fill="#2e2b3a" ' + SW2 + '/>' +
      '<rect class="slw-neon" color="' + col + '" x="30.5" y="68.5" width="9" height="55" rx="1.5" fill="none" stroke="' + col + '" stroke-width="1.4"/>' + neonStar(35, 96, 8, col);
    out += flatCrown(40, 120, 38, roof, rc);
    if (det.detail_lights) out += fairyLights(46, 114, 49, 3);
    if (det.detail_flag && !castle) out += roofFlag(112, roof === 'roof_thatch' ? 29 : 38);
    if (det.detail_neon) out += neon('M40 47 L40 38 L120 38 L120 47 M114 134 L182 134', col, 2.2);
    return out;
  }

  /* Sky dome: a drum, a dome shell in the roof finish, a glass pod and antenna,
     an equator ring with an LED band, 4 portholes and a round-topped sliding door */
  function dome(st) {
    var v = trimOf(st), roof = st.roof || 'roof_red', castle = roof === 'roof_castle', rc = roofPair(roof);
    var wall = WALL[st.wall] || WALL.wall_cream, det = st.details || {}, col = memberHex(st);
    var shell = castle ? [CASTLE.stone, CASTLE.tower] : rc, arc = 'M30 160 A70 66 0 0 1 170 160';
    var out = shadow(100, 214, 92), i;
    if (castle) out += turret(12, 108, 204, 26, '#ff6b6b') + turret(166, 108, 204, 26, '#ffd23f');
    if (det.detail_chimney) out += flue(140, 80, 40);
    out += '<path d="M28 160 L28 198 Q100 216 172 198 L172 160 Z" fill="' + wall + '" ' + SW + '/>';
    out += v ? teakPanel(122, 166, 16, 36) : teakPanel(62, 166, 16, 36);
    out += '<path d="' + arc + ' Z" fill="' + shell[0] + '" ' + SW + '/><path d="M100 94 A70 66 0 0 1 170 160 L148 160 Q146 112 100 94 Z" fill="' + shell[1] + '"/>';
    if (roof === 'roof_red') out += '<path d="M42 136 Q100 124 158 136 M58 112 Q100 102 142 112" fill="none" stroke="' + rc[1] + '" stroke-width="3"/>';
    if (roof === 'roof_blue') out += '<path d="M38 142 Q100 130 162 142 M48 124 Q100 112 152 124 M64 108 Q100 98 136 108 M70 102 Q64 130 62 156 M130 102 Q136 130 138 156" fill="none" stroke="' + rc[1] + '" stroke-width="2"/>';
    if (roof === 'roof_thatch') {
      var lump = 'M30 160', tuft = '';
      for (i = 0; i < 12; i++) {
        var a0 = Math.PI * (1 - i / 12), a1 = Math.PI * (1 - (i + 1) / 12), am = (a0 + a1) / 2;
        lump += ' Q' + n1(100 + 78 * Math.cos(am)) + ' ' + n1(160 - 74 * Math.sin(am)) + ' ' + n1(100 + 70 * Math.cos(a1)) + ' ' + n1(160 - 66 * Math.sin(a1));
      }
      for (i = 0; i < 16; i++) tuft += 'M' + n1(34 + i * 8.8) + ' 152 l2 8 ';
      out += '<path d="' + lump + ' Z" fill="' + rc[0] + '" ' + SW + '/><path d="M60 128 l6 -12 M84 110 l5 -12 M112 108 l5 -12 M136 124 l5 -12" stroke="#b9842a" stroke-width="2.5"/>' +
        '<path d="' + tuft + '" stroke="#b9842a" stroke-width="2.5" stroke-linecap="round"/>';
    }
    if (roof === 'roof_candy') {
      var cap = 'M50 114 A70 66 0 0 1 150 114', k = 7;
      for (i = k; i > 0; i--) {
        var x0 = 50 + 100 * i / k, x1 = 50 + 100 * (i - 1) / k, len = 8 + (i % 3) * 5;
        cap += ' Q' + n1((x0 + x1) / 2) + ' ' + (114 + len) + ' ' + n1(x1) + ' 114';
      }
      out += '<path d="' + cap + ' Z" fill="#fff" ' + SW2 + '/>' + sprinkles([[46, 142], [68, 134], [100, 130], [132, 134], [154, 142], [84, 104], [116, 104]]);
    }
    /* portholes: two in the shell, two in the drum */
    out += v ? porthole(56, 136, 8) + porthole(144, 136, 8) : porthole(66, 128, 9) + porthole(134, 128, 9);
    out += porthole(44, 182, 7) + porthole(156, 182, 7);
    if (det.detail_windowbox) out += windowBox(34, 191, 20) + windowBox(146, 191, 20);
    /* equator ring and LED band, crenel ring on castle */
    if (castle) out += merlons(34, 170, 156);
    out += '<rect x="24" y="155" width="152" height="8" rx="4" fill="#5a5f72" ' + SW2 + '/>' + neon('M30 159 L170 159', '#22e4ff', 1.4);
    /* glass pod and antenna on top */
    out += '<path d="M100 79 L100 47" stroke="#5a5f72" stroke-width="3" stroke-linecap="round"/><circle class="slw-neon" color="#ff2e9a" cx="100" cy="45" r="3.6" fill="#ff2e9a" stroke="' + INK + '" stroke-width="1.2"/>' +
      '<circle class="slw-win" cx="100" cy="92" r="13" fill="#1b2438" ' + SW2 + '/><path d="M93 88 Q95 83 100 82" fill="none" stroke="#8fb7ff" stroke-width="1.6" stroke-linecap="round"/>';
    if (roof === 'roof_candy') out += cherry(110, 80);
    if (det.detail_flag && !castle) out += '<g class="slw-flag"><path d="M101.5 50 l20 6 l-20 6 z" fill="#ffd23f" ' + SW2 + '/></g>';
    if (det.detail_lights) out += fairyLights(30, 170, 164, 3);
    if (det.detail_neon) out += neon(arc, col, 2.2);
    /* vestibule and the sliding door on its rail */
    out += '<rect x="78" y="164" width="44" height="44" rx="3" fill="' + wall + '" ' + SW + '/><rect x="74" y="158" width="52" height="8" rx="3" fill="#5a5f72" ' + SW2 + '/>' +
      '<path d="M84 170 L132 170" stroke="#2a2d3a" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M86 208 L86 186 A14 14 0 0 1 114 186 L114 208 Z" fill="' + (DOOR[st.door] || DOOR.door_blue) + '" ' + SW + '/>';
    if (st.door === 'door_glass') out += glassDoorTrim('M90 205 L90 186 A10 10 0 0 1 110 186 L110 205', 'M93 198 L93 187 Q94 181 99 179');
    return out + '<rect x="106" y="190" width="3.4" height="12" rx="1.7" fill="#e6e9f2" stroke="' + INK + '" stroke-width="1"/>' +
      '<rect x="80" y="206" width="40" height="6" rx="3" fill="#c9c5d3" ' + SW2 + '/>';
  }

  var SHAPE_ART = { shape_loft: loft, shape_villa: villa, shape_tower: tower, shape_dome: dome };
  var SHAPES = ['shape_cottage', 'shape_loft', 'shape_villa', 'shape_tower', 'shape_dome'];

  /* ---------------- attractions ---------------- */
  var THEME = { course_meadow: ['#7bd88f', '#ffd23f'], course_beach: ['#f3dc9a', '#4fc3f7'], course_snow: ['#e8f4ff', '#7fb3ff'], course_candy: ['#ffb6d5', '#c38bff'] };
  function courseGate(st) {
    var th = THEME[st && st.course] || THEME.course_meadow;
    return shadow(100, 214, 88) +
      '<rect x="22" y="196" width="156" height="14" rx="4" fill="' + th[0] + '" ' + SW2 + '/>' +
      '<g ' + SW2 + '><rect x="40" y="168" width="6" height="30" fill="#fff"/><rect x="66" y="168" width="6" height="30" fill="#fff"/><rect x="36" y="168" width="40" height="8" rx="3" fill="#ff6b6b"/>' +
      '<rect x="128" y="176" width="6" height="22" fill="#fff"/><rect x="154" y="176" width="6" height="22" fill="#fff"/><rect x="124" y="176" width="40" height="7" rx="3" fill="#ffd23f"/></g>' +
      '<rect x="22" y="70" width="14" height="140" rx="5" fill="#ff8a3d" ' + SW + '/><rect x="164" y="70" width="14" height="140" rx="5" fill="#ff8a3d" ' + SW + '/>' +
      '<path d="M18 74 Q 100 30 182 74 L182 100 Q 100 58 18 100 Z" fill="' + th[1] + '" ' + SW + '/>' +
      '<text x="100" y="80" text-anchor="middle" font-family="Baloo 2, Arial, sans-serif" font-weight="800" font-size="19" fill="#3b2f4a">PET COURSE</text>' +
      '<path d="M90 120 l0 -20 l22 7 l-22 7" fill="#7bd88f" ' + SW2 + '/><path d="M60 44 l4 -10 l4 10 l10 2 l-8 6 l2 10 l-8 -6 l-8 6 l2 -10 l-8 -6 z" fill="#ffd23f" ' + SW2 + '/>' +
      '<path d="M132 44 l4 -10 l4 10 l10 2 l-8 6 l2 10 l-8 -6 l-8 6 l2 -10 l-8 -6 z" fill="#ffd23f" ' + SW2 + '/>';
  }
  var BALLS = { ball_classic: ['#ffffff', '#3b2f4a'], ball_rainbow: ['#ff6b6b', '#4fc3f7'], ball_planet: ['#c38bff', '#ffd23f'], ball_gold: ['#ffd23f', '#e0a81c'] };
  var STADIA = { stadium_day: ['#7ecbff', '#6ac46a'], stadium_night: ['#2b2a5e', '#3f9a4a'], stadium_beach: ['#ffe0a0', '#7fd0a0'], stadium_snow: ['#dfeeff', '#bfe6c8'] };
  function pitch(st) {
    var ball = BALLS[st && st.ball] || BALLS.ball_classic, stad = STADIA[st && st.stadium] || STADIA.stadium_day;
    return shadow(150, 200, 140) +
      '<path d="M20 58 L280 58 L292 196 L8 196 Z" fill="' + stad[1] + '" ' + SW + '/>' +
      '<path d="M44 76 L256 76 L264 180 L36 180 Z M150 76 L150 180" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>' +
      '<ellipse cx="150" cy="128" rx="26" ry="14" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>' +
      '<rect x="20" y="22" width="260" height="34" rx="6" fill="' + stad[0] + '" ' + SW + '/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return '<circle cx="' + (34 + i * 21) + '" cy="' + (36 + (i % 2) * 8) + '" r="5" fill="' + ['#ff6b6b', '#ffd23f', '#4fc3f7', '#fff', '#c38bff'][i % 5] + '"/>'; }).join('') +
      '<path d="M232 88 L276 88 L280 132 L236 132" fill="rgba(255,255,255,0.35)" ' + SW + '/><path d="M240 92 l0 38 M252 92 l0 38 M264 92 l2 38 M236 104 l42 0 M237 118 l42 0" stroke="#fff" stroke-width="1.5" opacity="0.8"/>' +
      '<circle cx="120" cy="140" r="11" fill="' + ball[0] + '" ' + SW + '/><circle cx="117" cy="137" r="4" fill="' + ball[1] + '"/>';
  }
  var KARTS = { kart_red: '#e94b4b', kart_blue: '#3b7dd8', kart_lime: '#7ed957', kart_gold: '#f0c02f', kart_unicorn: '#ff8fd0' };
  function garage(st) {
    var kc = KARTS[st && st.kart] || KARTS.kart_red;
    var chk = '';
    for (var i = 0; i < 8; i++) chk += '<rect x="' + (36 + i * 16) + '" y="58" width="16" height="10" fill="' + (i % 2 ? '#fff' : INK) + '"/><rect x="' + (36 + i * 16) + '" y="68" width="16" height="10" fill="' + (i % 2 ? INK : '#fff') + '"/>';
    return shadow(100, 214, 92) +
      '<rect x="24" y="78" width="152" height="130" rx="8" fill="#8fa3c8" ' + SW + '/>' + chk +
      '<rect x="36" y="58" width="128" height="20" fill="none" ' + SW + '/>' +
      '<rect x="48" y="112" width="104" height="96" rx="4" fill="#d9e1ef" ' + SW + '/>' +
      [0, 1, 2, 3, 4].map(function (i) { return '<path d="M48 ' + (124 + i * 18) + ' h104" stroke="#a8b3c9" stroke-width="3"/>'; }).join('') +
      '<g transform="translate(64 176)"><rect x="0" y="6" width="72" height="22" rx="10" fill="' + kc + '" ' + SW + '/><path d="M18 6 l10 -12 l18 0 l6 12" fill="' + kc + '" ' + SW2 + '/>' +
      '<circle cx="14" cy="30" r="9" fill="#3b2f4a"/><circle cx="58" cy="30" r="9" fill="#3b2f4a"/><circle cx="14" cy="30" r="3.5" fill="#cfc8dc"/><circle cx="58" cy="30" r="3.5" fill="#cfc8dc"/>' +
      '<circle cx="34" cy="-2" r="7" fill="#ffd23f" ' + SW2 + '/></g>' +
      '<g ' + SW2 + '><circle cx="16" cy="200" r="10" fill="#3b2f4a"/><circle cx="184" cy="200" r="10" fill="#3b2f4a"/><circle cx="16" cy="186" r="10" fill="#3b2f4a"/></g>';
  }

  /* ---------------- city buildings (kind 'fun', cat 'city') ----------------
     Sized by footprint in world units: 1×1 100×170, 2×1 200×170, 2×2 200×250,
     3×2 300×230 (the 2D stage scales by fp). Three trims by st.variant (0..2):
     accent {@member, Neon Magenta, LED Cyan}, sign side (variant 1 flips) and
     stripe pattern A/B/C. Words only from SIGN_WORDS plus the child's own name
     (st.name, LED tower marquee and stage wall); icons pass no name/member, so
     they are the same for every child. */
  /* the LED tower's pixel pets (8 × 8, drawn once in the locked PETCOL colours): each
     species keeps its own silhouette, so the child's active crew member (st.pet) reads
     on the screen — floppy ears, pointed ears, tall ears with pink insides, gold horns.
     e dark · b body · l light · k Midnight Ink eye · n nose · i inner ear · h horn */
  var PIX_PETS = {
    pet_puppy: ['..bbbb..', '.bbbbbb.', 'ebkbbkbe', 'ebbbbbbe', 'ebllllbe', 'e.lnnl.e', '..llll..', '........'],
    pet_kitten: ['e......e', 'ee....ee', 'bbbbbbbb', 'bkbbbbkb', 'bbbnnbbb', 'bbllllbb', '.bbllbb.', '..bbbb..'],
    pet_bunny: ['.b....b.', '.bi..ib.', '.bi..ib.', '.bbbbbb.', 'bkbbbbkb', 'bbbnnbbb', '.bllllb.', '..bbbb..'],
    pet_dragon: ['h......h', '.h....h.', '.bbbbbb.', 'bkbbbbkb', 'bbbbbbbb', 'bllllllb', 'bnllllnb', '.bbbbbb.']
  };
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function bldOpts(st, iconMode) {
    st = st || {};
    var v = iconMode ? 0 : Math.max(0, Math.min(2, st.variant | 0));
    var member = iconMode ? null : hexOk(st.member);
    return {
      v: v, flip: v === 1, acc: [member || '#8a5cff', '#ff2e9a', '#22e4ff'][v],
      name: iconMode ? '' : String(st.name == null ? '' : st.name).replace(/\s+/g, ' ').trim().slice(0, 12).toUpperCase(),
      /* the active pet (the host passes st.pet) and the LED tower's show (st.prog 0..3, so
         a redraw keeps the child's pick) */
      pet: !iconMode && (own(PETCOL, st.pet) || headOf(st.pet)) ? st.pet : 'pet_puppy', prog: iconMode ? 0 : Math.max(0, Math.min(3, st.prog | 0)), icon: !!iconMode
    };
  }
  function signText(x, y, size, txt, fill) {
    return '<text x="' + x + '" y="' + y + '" ' + SIGN_FONT + ' font-size="' + size + '" fill="' + fill + '">' + xmlEsc(txt) + '</text>';
  }
  function bulbRing(cx, cy, r, count, dot) {
    var out = '';
    for (var i = 0; i < count; i++) {
      var a = i / count * Math.PI * 2;
      out += '<circle class="slw-twinkle" style="animation-delay:' + (i * 0.2).toFixed(1) + 's" cx="' + n1(cx + Math.cos(a) * r) + '" cy="' + n1(cy + Math.sin(a) * r) + '" r="' + dot + '" fill="#ffd08a"/>';
    }
    return out;
  }
  function starField(w, h) {
    var out = '<rect width="' + w + '" height="' + h + '" fill="#0e1626"/>', cols = ['#f4f2fa', '#22e4ff', '#8a5cff', '#ff2e9a'];
    for (var i = 0; i < 14; i++) out += '<circle cx="' + n1((i * 37 % 61) / 61 * w) + '" cy="' + n1((i * 23 % 47) / 47 * h) + '" r="' + (i % 3 ? 0.9 : 1.4) + '" fill="' + cols[i % 4] + '"/>';
    return out + '<path d="' + star4(w * 0.3, h * 0.42, 6) + ' ' + star4(w * 0.74, h * 0.64, 4.5) + '" fill="#f4f2fa"/>';
  }
  function eqBars(x0, yb, step, bw, hs, cols) {
    var out = '<g class="slw-eq" style="transform-box:fill-box;transform-origin:50% 100%">';
    hs.forEach(function (h, i) { out += '<rect x="' + n1(x0 + i * step) + '" y="' + (yb - h) + '" width="' + bw + '" height="' + h + '" rx="1" fill="' + cols[i % cols.length] + '"/>'; });
    return out + '</g>';
  }
  function pixelPet(petId, x0, y0, px) {
    var hd = headOf(petId);
    if (hd) return pix(hd.rows, hd.pal, px, x0, y0);                  /* v3: a mascot's registered 8 × 8 head */
    if (!own(PIX_PETS, petId)) petId = 'pet_puppy';
    var c = PETCOL[petId], map = { e: c.dark, b: c.body, l: c.light, k: '#14101f', n: c.nose, i: '#f6b7c9', h: '#ffd23f' }, out = '';
    PIX_PETS[petId].forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (map[row[x]]) out += '<rect x="' + (x0 + x * px) + '" y="' + (y0 + y * px) + '" width="' + px + '" height="' + px + '" fill="' + map[row[x]] + '"/>';
    });
    return out;
  }

  /* Photo Booth (1×1): asphalt kiosk, curtain alcove, lens ring of bulbs, the photo strip */
  function bldPhotobooth(o) {
    var body = '<rect x="26" y="44" width="48" height="92" rx="4" fill="#3a3646" ' + SW + '/>' + stripeBand(31, 69, 52, o.v, o.acc) +
      '<rect x="30" y="58" width="20" height="74" rx="2" fill="#1b2438" ' + SW2 + '/>' +
      '<path d="M30 60 L50 60 L50 128 Q45 133 40 128 Q35 133 30 128 Z" fill="#e0157f" ' + SW2 + '/>' +
      '<path d="M36 63 L35 125 M42 63 L42 125 M47 63 L46 125" stroke="rgba(20,16,31,0.25)" stroke-width="2"/><rect x="28" y="56" width="24" height="4" rx="2" fill="#5a5f72"/>' +
      bulbRing(62, 77, 11.5, 8, 1.7) +
      '<circle cx="62" cy="77" r="8" fill="#5a5f72" ' + SW2 + '/><circle cx="62" cy="77" r="4.6" fill="#1b2438"/><circle cx="60.4" cy="75.4" r="1.4" fill="#8fb7ff"/>' +
      '<rect x="56" y="99" width="13" height="3" rx="1.5" fill="#14101f"/>' +
      '<g class="slw-strip" style="transform-box:fill-box;transform-origin:50% 0"><rect x="58" y="101" width="9" height="31" fill="#f4f2fa" stroke="' + INK + '" stroke-width="1.2"/>' +
      [o.acc, '#22e4ff', '#ff2e9a', '#8a5cff'].map(function (c, i) { return '<rect x="59.6" y="' + (103 + i * 7.3) + '" width="5.8" height="5.4" fill="' + c + '"/>'; }).join('') + '</g>';
    return shadow(50, 136, 30) + (o.flip ? mirror(100, body) : body) +
      '<rect x="49" y="18" width="2.5" height="10" fill="#5a5f72"/>' + neonStar(50, 15, 8, o.acc) +
      '<rect x="22" y="26" width="56" height="18" rx="3" fill="#2e2b3a" ' + SW2 + '/>' +
      '<rect class="slw-neon" color="' + o.acc + '" x="24.5" y="28.5" width="51" height="13" rx="2" fill="none" stroke="' + o.acc + '" stroke-width="1.4"/>' +
      signText(50, 39, 9, 'PHOTO', '#f4f2fa');
  }

  /* Boba Café (2×1): concrete kiosk under a giant bubble-tea cup; awning, table, stools */
  function bldBoba(o) {
    var awn = '';
    if (o.v === 0) for (var i = 0; i < 6; i++) awn += '<rect x="' + (108 + i * 15) + '" y="64" width="7" height="10" fill="' + o.acc + '"/>';
    if (o.v === 1) for (var j = 0; j < 3; j++) awn += '<rect x="' + (110 + j * 28) + '" y="64" width="14" height="10" fill="' + o.acc + '"/>';
    if (o.v === 2) for (var k = 0; k < 9; k++) awn += '<circle cx="' + (110 + k * 10) + '" cy="69" r="2.2" fill="' + o.acc + '"/>';
    var art = shadow(100, 137, 92) +
      '<rect x="12" y="72" width="86" height="64" rx="4" fill="#8c8798" ' + SW + '/>' + glass(22, 88, 66, 22, 3, 1) +
      '<g class="slw-hatch" style="transform-box:fill-box;transform-origin:50% 0"><rect x="18" y="76" width="74" height="10" rx="2" fill="#f4f2fa" ' + SW2 + '/><path d="M20 83 h70" stroke="' + o.acc + '" stroke-width="2.5"/></g>' +
      '<rect x="14" y="110" width="82" height="7" rx="2" fill="#9a6a4a" ' + SW2 + '/><path d="M17 111.8 h76" stroke="#b07e58" stroke-width="1.6"/>' + stripeBand(22, 88, 127, o.v, o.acc) +
      /* the giant cup: frosted tube, milk tea, pearls, lid and a tilted straw */
      '<rect x="61" y="2" width="6" height="26" rx="3" fill="' + o.acc + '" ' + SW2 + ' transform="rotate(12 64 24)"/>' +
      '<path d="M35.6 38 L80.4 38 L76 72 L40 72 Z" fill="#e2be94"/>' +
      '<g class="slw-pearls">' + [[48, 66], [56, 67], [64, 66], [72, 66], [52, 59], [61, 60], [69, 59]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.3" fill="#14101f"/>'; }).join('') + '</g>' +
      '<path d="M34 26 L82 26 L76 72 L40 72 Z" fill="#f4f2fa" fill-opacity="0.35" ' + SW + '/><path d="M40 32 L44 66" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.55"/>' +
      neon('M34 26 L82 26 L76 72 L40 72 Z', '#ff2e9a', 1.2) +
      '<rect x="30" y="20" width="56" height="8" rx="3" fill="#f4f2fa" ' + SW2 + '/>' +
      /* awning on the right cell, posts, bar table and two stools */
      '<path d="M110 74 v62 M188 74 v62" stroke="#5a5f72" stroke-width="4"/>' +
      '<rect x="104" y="64" width="90" height="10" rx="2" fill="#f4f2fa" ' + SW2 + '/>' + awn + neon('M106 76 L192 76', '#ff2e9a', 1.6) +
      '<path d="M148 104 v30 M139 134 h18" stroke="#5a5f72" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="148" cy="103" rx="18" ry="5" fill="#9a6a4a" ' + SW2 + '/>' +
      [124, 172].map(function (x) { return '<path d="M' + (x - 5) + ' 134 L' + (x - 3) + ' 117 M' + (x + 5) + ' 134 L' + (x + 3) + ' 117" stroke="#5a5f72" stroke-width="2.5"/><ellipse cx="' + x + '" cy="116" rx="8" ry="3" fill="#b07e58" ' + SW2 + '/>'; }).join('');
    return o.flip ? mirror(200, art) : art;
  }

  /* LED Screen Tower (1×1): steel mast, ladder and a giant screen. Island sprites carry
     4 programs (name marquee, pixel pet, EQ, star field) switched by data-prog;
     icons always show the star field. */
  function bldLedtower(o) {
    var lx = o.flip ? 42 : 52, rungs = '';
    for (var y = 78; y < 124; y += 7) rungs += 'M' + lx + ' ' + y + ' h6 ';
    var screen;
    if (o.icon) screen = starField(66, 50);
    else {
      var nm = o.name || 'ENCORE', hide = function (n) { return o.prog === n ? '' : ' display="none"'; };
      screen = '<g class="slw-screen" data-prog="' + o.prog + '">' +
        '<g class="slw-prog p0"' + hide(0) + '><rect width="66" height="50" fill="#0e1626"/><g class="slw-marquee"><text x="4" y="31" ' + SIGN_FONT.replace('text-anchor="middle"', 'text-anchor="start"') + ' font-size="14" fill="#22e4ff">' + xmlEsc(nm + ' ✦ ' + nm + ' ✦') + '</text></g></g>' +
        '<g class="slw-prog p1"' + hide(1) + '><rect width="66" height="50" fill="#0e1626"/>' + pixelPet(o.pet, 13, 5, 5) + '</g>' +
        '<g class="slw-prog p2"' + hide(2) + '><rect width="66" height="50" fill="#0e1626"/>' + eqBars(6, 44, 8.4, 6, [20, 32, 26, 38, 22, 30, 16], ['#22e4ff', '#ff2e9a', '#8a5cff', '#c6ff3d']) + '</g>' +
        '<g class="slw-prog p3"' + hide(3) + '>' + starField(66, 50) + '</g></g>';
    }
    return shadow(50, 136, 26) +
      '<rect x="30" y="124" width="40" height="12" rx="2" fill="#8c8798" ' + SW2 + '/>' + stripeBand(34, 66, 130, o.v, o.acc) +
      '<path d="M36 124 L41 70 M64 124 L59 70" stroke="#5a5f72" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M38 112 L61 92 M62 112 L39 92 M40 90 L60 74 M60 90 L40 74" stroke="#7c8194" stroke-width="2"/>' +
      '<path d="M' + lx + ' 124 V72 M' + (lx + 6) + ' 124 V72 ' + rungs + '" stroke="#2a2d3a" stroke-width="1.8"/>' +
      '<rect x="12" y="10" width="76" height="60" rx="4" fill="#2e2b3a" ' + SW + '/>' +
      '<svg x="17" y="15" width="66" height="50" viewBox="0 0 66 50" overflow="hidden" style="overflow:hidden;width:66px;height:50px">' + screen + '</svg>' +
      '<rect class="slw-neon" color="' + o.acc + '" x="14.5" y="12.5" width="71" height="55" rx="3" fill="none" stroke="' + o.acc + '" stroke-width="1.4"/>' +
      '<circle class="slw-neon" color="#ff2e9a" cx="50" cy="6" r="3.6" fill="#ff2e9a" stroke="' + INK + '" stroke-width="1.2"/>';
  }

  /* Recording Studio (2×1): graphite block, foam studs, porthole mic, VU column,
     ON AIR lightbox (steady) and giant headphones over the roof */
  function bldRecording(o) {
    var studs = '';
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) studs += '<rect x="' + (26 + c * 12) + '" y="' + (78 + r * 16) + '" width="9" height="12" rx="1" fill="#2a2d3a"/><path d="M' + (26 + c * 12) + ' ' + (78 + r * 16) + ' l9 12" stroke="#7c8194" stroke-width="1" opacity="0.5"/>';
    var body = '<path d="M36 70 Q100 -20 164 70" fill="none" stroke="#5a5f72" stroke-width="9" stroke-linecap="round"/><path d="M36 70 Q100 -20 164 70" fill="none" stroke="#7c8194" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="14" y="64" width="172" height="72" rx="4" fill="#2e2b3a" ' + SW + '/>' + stripeBand(20, 180, 131, o.v, o.acc) +
      '<rect x="22" y="74" width="52" height="52" rx="2" fill="#3a3646" ' + SW2 + '/>' + studs +
      porthole(96, 96, 15) + '<rect x="93" y="86" width="6" height="13" rx="3" fill="#e6e9f2"/><path d="M96 99 v8 M91 107 h10" stroke="#e6e9f2" stroke-width="2" stroke-linecap="round"/>' +
      eqBars(118, 128, 7, 5, [14, 22, 30, 18, 10], ['#c6ff3d', '#22e4ff', '#8a5cff', '#ff2e9a', '#ffb23e']) +
      '<rect x="160" y="96" width="20" height="40" rx="2" fill="#3a3646" ' + SW2 + '/><rect x="174" y="112" width="3" height="10" rx="1.5" fill="#e6e9f2"/>' +
      [22, 154].map(function (x) { return '<rect x="' + x + '" y="50" width="24" height="36" rx="9" fill="#5a5f72" ' + SW2 + '/><rect class="slw-neon" color="#8a5cff" x="' + (x + 4) + '" y="54" width="16" height="28" rx="6" fill="none" stroke="#8a5cff" stroke-width="2.5"/>'; }).join('');
    var bx = o.flip ? 48 : 112;
    return shadow(100, 137, 94) + (o.flip ? mirror(200, body) : body) +
      '<g class="slw-onair" opacity="0.55"><rect x="' + bx + '" y="70" width="40" height="16" rx="3" fill="#43294f" ' + SW2 + '/>' + signText(bx + 20, 81.5, 7.5, 'ON AIR', '#ff5a6a') + '</g>';
  }

  /* Dance Studio (2×2): concrete ground floor with a full smoked-glass front, a mirror
     wall and an LED floor; set-back upper level with 5 accent fins, sign and speakers */
  function bldDance(o) {
    var tiles = '', xb = [42, 80, 120, 158], xm = [38, 79, 121, 162], xf = [33, 77.5, 122.5, 167];
    var tc = ['#8a5cff', '#ff2e9a', '#22e4ff', '#c6ff3d', '#8a5cff', '#ff2e9a'];
    for (var i = 0; i < 3; i++) {
      tiles += '<path d="M' + xb[i] + ' 176 L' + xb[i + 1] + ' 176 L' + xm[i + 1] + ' 186 L' + xm[i] + ' 186 Z" fill="' + tc[i] + '" stroke="#14101f" stroke-width="1"/>';
      tiles += '<path d="M' + xm[i] + ' 186 L' + xm[i + 1] + ' 186 L' + xf[i + 1] + ' 198 L' + xf[i] + ' 198 Z" fill="' + tc[i + 3] + '" stroke="#14101f" stroke-width="1"/>';
    }
    var fins = '';
    for (var f = 0; f < 5; f++) fins += '<rect x="' + (50 + f * 22) + '" y="76" width="8" height="34" rx="1.5" fill="' + o.acc + '" ' + SW2 + '/>';
    var body = '<rect x="182" y="150" width="16" height="28" rx="2" fill="#2e2b3a" ' + SW2 + '/><rect x="182" y="180" width="16" height="28" rx="2" fill="#2e2b3a" ' + SW2 + '/>' +
      '<circle cx="190" cy="164" r="5" fill="#5a5f72"/><circle cx="190" cy="194" r="5" fill="#5a5f72"/><circle cx="190" cy="164" r="2" fill="#2a2d3a"/><circle cx="190" cy="194" r="2" fill="#2a2d3a"/>' +
      '<rect x="40" y="72" width="120" height="40" rx="3" fill="#c9c5d3" ' + SW + '/>' + fins +
      '<rect x="18" y="110" width="164" height="98" rx="4" fill="#8c8798" ' + SW + '/>' +
      '<rect class="slw-win" x="28" y="120" width="144" height="80" rx="2" fill="#1b2438" ' + SW2 + '/>' +
      '<rect x="34" y="126" width="132" height="30" fill="#dde3f0" opacity="0.22"/><path d="M50 156 L70 126 M110 156 L130 126" stroke="#fff" stroke-width="4" opacity="0.2"/>' +
      '<g class="slw-floor">' + tiles + '</g>' +
      '<path d="M76 120 V200 M124 120 V200" stroke="#5a5f72" stroke-width="3"/><rect x="86" y="150" width="28" height="50" fill="none" stroke="#5a5f72" stroke-width="2.5"/><rect x="107" y="168" width="3.4" height="13" rx="1.7" fill="#e6e9f2"/>' +
      '<path d="M36 196 L60 122" stroke="#fff" stroke-width="6" opacity="0.14" stroke-linecap="round"/>' + stripeBand(22, 178, 204, o.v, o.acc) +
      '<rect x="80" y="206" width="40" height="6" rx="3" fill="#c9c5d3" ' + SW2 + '/>';
    var sx = o.flip ? 48 : 92, sign;
    if (o.v === 2) {
      sign = '<rect x="' + sx + '" y="52" width="60" height="20" rx="3" fill="#2e2b3a" ' + SW2 + '/>' +
        neon('M' + (sx + 22) + ' 66 L' + (sx + 22) + ' 59 Q' + (sx + 30) + ' 58 ' + (sx + 33) + ' 62 L' + (sx + 44) + ' 63 Q' + (sx + 47) + ' 66 ' + (sx + 44) + ' 66 Z M' + (sx + 8) + ' 58 h9 M' + (sx + 6) + ' 62 h10 M' + (sx + 8) + ' 66 h9', o.acc, 1.4);
    } else {
      sign = '<rect x="' + sx + '" y="52" width="60" height="20" rx="3" fill="#2e2b3a" ' + SW2 + '/>' +
        '<rect class="slw-neon" color="' + o.acc + '" x="' + (sx + 2.5) + '" y="54.5" width="55" height="15" rx="2" fill="none" stroke="' + o.acc + '" stroke-width="1.4"/>' + signText(sx + 30, 66, 9.5, 'DANCE', '#f4f2fa');
    }
    return shadow(100, 214, 94) + (o.flip ? mirror(200, body) : body) + sign;
  }

  /* Rooftop Hangout (2×2): brick warehouse, smoked windows, roller door, outside stair;
     roof deck with glass balustrade, beanbags, Edison bulbs, telescope and a potted palm */
  function bldRooftop(o) {
    var bulbs = '', mortar = '';
    for (var i = 0; i < 9; i++) {
      var t = i / 8, x = (1 - t) * (1 - t) * 38 + 2 * (1 - t) * t * 92 + t * t * 146, y = (1 - t) * (1 - t) * 48 + 2 * (1 - t) * t * 64 + t * t * 48;
      bulbs += '<circle class="slw-twinkle" style="animation-delay:' + (i * 0.2).toFixed(1) + 's" cx="' + n1(x) + '" cy="' + n1(y + 3.5) + '" r="3" fill="#ffb23e" stroke="' + INK + '" stroke-width="1"/>';
    }
    for (var r = 0; r < 6; r++) mortar += 'M' + (40 + (r % 2) * 14) + ' ' + (104 + r * 17) + ' h12 M' + (104 + (r % 2) * 12) + ' ' + (110 + r * 16) + ' h12 ';
    var art = shadow(100, 214, 94) +
      '<path d="M38 92 V46 M146 92 V46" stroke="#5a5f72" stroke-width="3"/>' +
      '<g class="slw-bean" style="transform-box:fill-box;transform-origin:50% 100%"><path d="M46 90 Q44 68 58 68 Q72 68 70 90 Z" fill="' + o.acc + '" ' + SW2 + '/><path d="M76 90 Q76 72 88 72 Q100 72 98 90 Z" fill="#8a5cff" ' + SW2 + '/></g>' +
      '<path d="M128 90 L134 70 L140 90 M134 70 V90" stroke="#5a5f72" stroke-width="2"/><g transform="rotate(-24 134 66)"><rect x="122" y="62" width="28" height="8" rx="3" fill="#7c8194" ' + SW2 + '/><circle cx="150" cy="66" r="3" fill="#1b2438"/></g>' +
      '<path d="M110 80 Q108 70 112 62" fill="none" stroke="#9a6a4a" stroke-width="2.5"/><path d="M112 62 Q100 58 94 66 M112 62 Q122 56 128 64 M112 62 Q106 52 98 54 M112 62 Q118 50 126 52" fill="none" stroke="#2f7d57" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M112 62 Q103 60 98 64 M112 62 Q120 59 124 62" fill="none" stroke="#57b07a" stroke-width="1.8" stroke-linecap="round"/><rect x="104" y="80" width="13" height="10" rx="2" fill="#8c8798" ' + SW2 + '/>' +
      '<path d="M38 48 Q92 64 146 48" fill="none" stroke="#2a2d3a" stroke-width="1.5"/>' + bulbs +
      '<rect x="30" y="76" width="124" height="14" fill="#1b2438" fill-opacity="0.55" stroke="#5a5f72" stroke-width="2"/><path d="M30 76 H154" stroke="#e6e9f2" stroke-width="2"/>' +
      '<rect x="30" y="88" width="124" height="10" fill="#9a6a4a" ' + SW2 + '/><path d="M42 89 v8 M54 89 v8 M66 89 v8 M78 89 v8 M90 89 v8 M102 89 v8 M114 89 v8 M126 89 v8 M138 89 v8" stroke="#b07e58" stroke-width="2"/>' + stripeBand(34, 150, 93, o.v, o.acc) +
      '<rect x="34" y="98" width="116" height="110" rx="3" fill="#b4675a" ' + SW + '/><path d="' + mortar + '" stroke="#93524a" stroke-width="2" opacity="0.45"/>' +
      glass(46, 108, 22, 36, 1, 2) + glass(81, 108, 22, 36, 1, 2) + glass(116, 108, 22, 36, 1, 2) + glass(44, 158, 26, 38, 1, 2) + glass(126, 158, 16, 38, 1, 2) +
      '<rect x="84" y="156" width="32" height="52" rx="2" fill="#7c8194" ' + SW + '/><path d="M86 163 h28 M86 170 h28 M86 177 h28 M86 184 h28 M86 191 h28 M86 198 h28" stroke="#5a5f72" stroke-width="2"/><rect x="95" y="201" width="10" height="3" rx="1.5" fill="#e6e9f2"/>' +
      '<path d="M190 206 L158 170 L166 170 L190 136 L182 136 L154 98" fill="none" stroke="#5a5f72" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M176 194 h10 M168 185 h10 M160 176 h10 M170 158 h10 M178 147 h10 M170 125 h10 M162 113 h10 M156 104 h10" stroke="#7c8194" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="80" y="206" width="40" height="6" rx="3" fill="#c9c5d3" ' + SW2 + '/>';
    return o.flip ? mirror(200, art) : art;
  }

  /* Concert Stage (3×2): box-truss arch with 4 moving heads, an LED wall (✦ and the
     child's name, or ENCORE), speaker stacks and an asphalt deck with an LED edge */
  function bldStage(o) {
    var lattice = '', feet = '', heads = '';
    for (var x = 24; x < 276; x += 12) lattice += 'M' + x + ' 34 L' + (x + 6) + ' 22 L' + (x + 12) + ' 34 ';
    [24, 264].forEach(function (lx) { for (var y = 196; y > 34; y -= 12) lattice += 'M' + lx + ' ' + y + ' L' + (lx + 12) + ' ' + (y - 6) + ' L' + lx + ' ' + (y - 12) + ' '; });
    for (var i = 0; i < 8; i++) feet += '<rect x="' + n1(42 + i * 31 - 4) + '" y="155" width="8" height="5" rx="1" fill="#2a2d3a"/><circle cx="' + n1(42 + i * 31) + '" cy="157" r="3" fill="#ffd08a"/>';
    [80, 128, 172, 220].forEach(function (hx) { heads += '<path d="M' + (hx - 6) + ' 34 v5 h12 v-5" fill="none" stroke="#5a5f72" stroke-width="2"/><rect x="' + (hx - 5) + '" y="38" width="10" height="10" rx="2" fill="#2e2b3a" ' + SW2 + '/><circle cx="' + hx + '" cy="48" r="2.5" fill="#f4f2fa"/>'; });
    var eqX = o.flip ? 202 : 68;
    return shadow(150, 206, 140) +
      '<g class="slw-beam" opacity="0"><path d="M76 48 L84 48 L140 168 L56 168 Z" fill="#8a5cff" fill-opacity="0.18"/><path d="M216 48 L224 48 L244 168 L160 168 Z" fill="#22e4ff" fill-opacity="0.18"/></g>' +
      '<rect x="54" y="50" width="192" height="86" rx="4" fill="#2e2b3a" ' + SW + '/>' +
      '<svg x="60" y="56" width="180" height="74" viewBox="0 0 180 74" overflow="hidden" style="overflow:hidden;width:180px;height:74px"><rect width="180" height="74" fill="#0e1626"/>' +
      eqBars(eqX - 60, 70, 8, 5, [16, 26, 20, 30], ['#22e4ff', '#c6ff3d', '#ff2e9a', '#8a5cff']) + '</svg>' +
      neonStar(150, 82, 20, o.acc) + signText(150, 122, o.name.length > 7 ? 10 : 13, o.name || 'ENCORE', '#f4f2fa') +
      '<path d="' + lattice + '" fill="none" stroke="#7c8194" stroke-width="1.5"/>' +
      '<path d="M24 196 V22 M36 196 V34 M264 196 V34 M276 196 V22 M24 22 H276 M36 34 H264" fill="none" stroke="#5a5f72" stroke-width="3" stroke-linecap="round"/>' + heads +
      [32, 244].map(function (sx) { return '<rect x="' + sx + '" y="112" width="24" height="26" rx="2" fill="#2e2b3a" ' + SW2 + '/><rect x="' + sx + '" y="138" width="24" height="16" rx="2" fill="#2e2b3a" ' + SW2 + '/><circle cx="' + (sx + 12) + '" cy="125" r="7" fill="#5a5f72"/><circle cx="' + (sx + 12) + '" cy="125" r="2.5" fill="#2a2d3a"/><circle cx="' + (sx + 12) + '" cy="146" r="4" fill="#5a5f72"/>'; }).join('') +
      '<path d="M28 150 L272 150 L282 166 L18 166 Z" fill="#3a3646" ' + SW2 + '/>' + feet +
      '<rect x="18" y="166" width="264" height="30" rx="2" fill="#2e2b3a" ' + SW + '/>' + stripeBand(28, 272, 186, o.v, o.acc) + neon('M20 166 L280 166', '#22e4ff', 2) +
      '<rect x="130" y="196" width="40" height="8" rx="2" fill="#3a3646" ' + SW2 + '/>';
  }

  var BUILDINGS = {
    bld_photobooth: { w: 100, h: 170, draw: bldPhotobooth },
    bld_boba: { w: 200, h: 170, draw: bldBoba },
    bld_ledtower: { w: 100, h: 170, draw: bldLedtower },
    bld_recording: { w: 200, h: 170, draw: bldRecording },
    bld_dance: { w: 200, h: 250, draw: bldDance },
    bld_rooftop: { w: 200, h: 250, draw: bldRooftop },
    bld_stage: { w: 300, h: 230, draw: bldStage }
  };
  function building(id, st, iconMode) {
    var b = BUILDINGS[id];
    return b ? { w: b.w, h: b.h, svg: svg(b.w, b.h, b.draw(bldOpts(st, iconMode))) } : null;
  }

  /* v2 streetwear accessories in the pet's frame (head centre 88,42 r 20); fixed
     strings so the same item always draws the same way */
  var ACC2D = {
    beanie: '<path d="M69 30 Q68 7 89 6 Q109 7 108 30 Z" fill="#c9c5d3" ' + SW2 + '/>' +
      '<path d="M76 11 L75 29 M82 8 L81.5 29 M88 7 V29 M94 8 L94.5 29 M100 11 L101 29" stroke="#2e2b3a" stroke-width="1.6" opacity="0.5"/>' +
      '<rect x="67" y="25" width="43" height="9" rx="4.5" fill="#2e2b3a" ' + SW2 + '/><path d="M73 27 v5 M79 27 v5 M85 27 v5 M91 27 v5" stroke="#5a5f72" stroke-width="1.4"/>' +
      '<rect x="99" y="26.5" width="6" height="6" rx="1" fill="#c6ff3d"/>',
    bunnyTips: '<path d="M74 13 Q80 8 86 12 M87 10 Q93 6 99 11" fill="none" stroke="#2e2b3a" stroke-width="2.5" stroke-linecap="round"/>',
    cap: '<path d="M72 23 L54 25 Q52 27 54 29 L72 28 Z" fill="#2e2b3a" ' + SW2 + '/>' +
      '<path class="slw-neon" color="#ff2e9a" d="M56 29.6 L71 29.1" fill="none" stroke="#ff2e9a" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M70 26 Q71 8 89 7 Q107 8 107 26 Z" fill="#2e2b3a" ' + SW2 + '/><path d="M89 8 V25 M78 11 Q80 18 79 25" fill="none" stroke="#5a5f72" stroke-width="1.4"/>' +
      '<path d="M94 26 Q98 19 102 26 Z" fill="#14101f"/><circle cx="89" cy="7.5" r="2" fill="#5a5f72"/>',
    headphones: '<path d="M74 58 Q86 69 102 60" fill="none" stroke="#2e2b3a" stroke-width="4.5" stroke-linecap="round"/>' +
      '<ellipse cx="73" cy="57" rx="5" ry="6.5" fill="#5a5f72" ' + SW2 + '/><ellipse cx="102" cy="59" rx="5.5" ry="7" fill="#5a5f72" ' + SW2 + '/>' +
      '<g class="slw-neon" color="#22e4ff" fill="none" stroke="#22e4ff" stroke-width="1.6"><ellipse cx="73" cy="57" rx="2.6" ry="3.8"/><ellipse cx="102" cy="59" rx="3" ry="4.2"/></g>',
    visor: '<path d="M81 38 Q74 39 69 42" fill="none" stroke="#2e2b3a" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M80 36 Q95 30 110 35 L109 42 Q95 38 81 43 Z" fill="#1b2438" ' + SW2 + '/>' +
      '<path class="slw-neon" color="#22e4ff" d="M84 39 Q95 35 106 38" fill="none" stroke="#22e4ff" stroke-width="1.4" stroke-linecap="round"/><circle cx="98" cy="36.6" r="1.6" fill="#f4f2fa"/>',
    hoodieShell: '<path d="M27 66 Q26 44 56 43 Q80 43 87 56 L86 70 Q60 75 30 72 Z" fill="#2e2b3a" ' + SW2 + '/><path d="M44 66 Q56 70 68 66" fill="none" stroke="#3a3646" stroke-width="2"/>',
    hood: '<path d="M70 56 Q60 44 66 30 Q72 24 78 26 Q70 38 78 56 Z" fill="#2e2b3a" ' + SW2 + '/>',
    drawstrings: '<path d="M84 60 L83 72 M90 61 L90 73" stroke="#ff2e9a" stroke-width="2" stroke-linecap="round"/><circle cx="83" cy="73" r="1.7" fill="#ff2e9a"/><circle cx="90" cy="74" r="1.7" fill="#ff2e9a"/>'
  };
  var ACC_SLOT = { acc_partyhat: 'hat', acc_crown: 'hat', acc_bow: 'neck', acc_scarf: 'neck', acc_shades: 'face', acc_cape: 'back',
    acc_beanie: 'hat', acc_cap: 'hat', acc_headphones: 'neck', acc_visor: 'face', acc_hoodie: 'back' };

  /* the V4.54 accessories that hang off the head (hx, hy = its centre) or the body: one copy, drawn
     in place on the V4.54 pets and moved to a mascot's own anchors (wear) */
  var ACC454 = {
    acc_scarf: function (hx, hy) { return '<path d="M' + (hx - 18) + ' ' + (hy + 14) + ' Q ' + hx + ' ' + (hy + 24) + ' ' + (hx + 14) + ' ' + (hy + 16) + ' L' + (hx + 14) + ' ' + (hy + 24) + ' Q ' + hx + ' ' + (hy + 32) + ' ' + (hx - 18) + ' ' + (hy + 22) + ' Z" fill="#4fc3f7" ' + SW2 + '/><path d="M' + (hx - 14) + ' ' + (hy + 22) + ' l-4 16 l8 0 z" fill="#ff6b6b" ' + SW2 + '/>'; },
    acc_bow: function (hx, hy) { return '<path d="M' + (hx - 8) + ' ' + (hy + 20) + ' l-12 -7 l0 14 z M' + (hx - 8) + ' ' + (hy + 20) + ' l12 -7 l0 14 z" fill="#ff5c8a" ' + SW2 + '/><circle cx="' + (hx - 8) + '" cy="' + (hy + 20) + '" r="4" fill="#ffd23f" ' + SW2 + '/>'; },
    acc_shades: function (hx, hy) { return '<rect x="' + (hx - 4) + '" y="' + (hy - 8) + '" width="13" height="9" rx="3" fill="#3b2f4a"/><rect x="' + (hx + 11) + '" y="' + (hy - 8) + '" width="11" height="9" rx="3" fill="#3b2f4a"/><path d="M' + (hx + 9) + ' ' + (hy - 4) + ' h2" stroke="#3b2f4a" stroke-width="2"/><path d="M' + (hx - 2) + ' ' + (hy - 6) + ' l4 0" stroke="#fff" stroke-width="1.5" opacity="0.7"/>'; },
    acc_partyhat: function (hx, hy) { return '<path d="M' + (hx - 6) + ' ' + (hy - 17) + ' L' + (hx + 2) + ' ' + (hy - 46) + ' L' + (hx + 12) + ' ' + (hy - 17) + ' Z" fill="#c38bff" ' + SW2 + '/><path d="M' + (hx - 3) + ' ' + (hy - 25) + ' l13 0 M' + (hx) + ' ' + (hy - 35) + ' l7 0" stroke="#ffd23f" stroke-width="3"/><circle cx="' + (hx + 2) + '" cy="' + (hy - 47) + '" r="4" fill="#ff6b6b" ' + SW2 + '/>'; },
    acc_crown: function (hx, hy) { return '<path d="M' + (hx - 12) + ' ' + (hy - 16) + ' L' + (hx - 12) + ' ' + (hy - 32) + ' L' + (hx - 4) + ' ' + (hy - 24) + ' L' + (hx + 2) + ' ' + (hy - 36) + ' L' + (hx + 8) + ' ' + (hy - 24) + ' L' + (hx + 16) + ' ' + (hy - 32) + ' L' + (hx + 16) + ' ' + (hy - 16) + ' Z" fill="#ffd23f" ' + SW2 + '/><circle cx="' + (hx + 2) + '" cy="' + (hy - 21) + '" r="2.5" fill="#ff5c8a"/>'; },
    acc_cape: function () { return '<path class="slw-cape" d="M44 52 Q 20 58 14 84 L40 76 Q 46 66 52 56 Z" fill="#e94b4b" ' + SW2 + '/>'; },
    acc_headphones: function () { return ACC2D.headphones; },
    acc_visor: function () { return ACC2D.visor; },
    acc_beanie: function () { return ACC2D.beanie; },
    acc_cap: function () { return ACC2D.cap; }
  };

  /* ---------------- pets (side view facing right, viewBox 120×100, feet y≈92) ----------------
     frame 0/1 = walking legs; acc = {hat, neck, face, back} -> item ids */
  function pet(id, opts) {
    opts = opts || {};
    if (!own(PETCOL, id) && (isMascot(id) || (pixOf(id) && pixOf(id).frames))) return mascot(id, opts);      /* v3: a mascot is its own pixel sprite */
    var c = PETCOL[id] || PETCOL.pet_puppy, f = opts.frame ? 1 : 0, acc = opts.acc || {}, A3 = anchorsOf(id);
    var legA = f ? 'translate(4 0)' : 'translate(-3 0)', legB = f ? 'translate(-4 0)' : 'translate(3 0)';
    var out = '<ellipse cx="60" cy="94" rx="34" ry="5" fill="rgba(40,30,60,0.18)"/>';
    /* cape behind */
    if (acc.back === 'acc_cape') out += ACC454.acc_cape();
    /* tail */
    if (id === 'pet_puppy') out += '<path d="M30 56 Q 14 44 18 30" fill="none" stroke="' + c.dark + '" stroke-width="8" stroke-linecap="round"/>';
    if (id === 'pet_kitten') out += '<path d="M30 60 Q 6 52 14 28" fill="none" stroke="' + c.dark + '" stroke-width="7" stroke-linecap="round"/>';
    if (id === 'pet_bunny') out += '<circle cx="28" cy="58" r="9" fill="#fff" ' + SW2 + '/>';
    if (id === 'pet_dragon') out += '<path d="M30 64 Q 10 70 6 54 L14 56 L10 46 Z" fill="' + c.body + '" ' + SW2 + '/>';
    /* back legs */
    out += '<g transform="' + legA + '"><rect x="34" y="66" width="11" height="26" rx="5" fill="' + c.dark + '" ' + SW2 + '/></g>' +
           '<g transform="' + legB + '"><rect x="68" y="66" width="11" height="26" rx="5" fill="' + c.dark + '" ' + SW2 + '/></g>';
    /* body */
    out += '<ellipse cx="56" cy="62" rx="30" ry="18" fill="' + c.body + '" ' + SW + '/><ellipse cx="58" cy="70" rx="18" ry="7" fill="' + c.light + '"/>';
    if (acc.back === 'acc_hoodie') out += ACC2D.hoodieShell;
    out += landGear(acc.back, 'back', A3, false);                    /* v3 land gear: '' for every V4.54 state */
    if (id === 'pet_dragon') out += '<path class="slw-wing" d="M50 48 Q 46 22 64 18 Q 60 32 72 30 Q 64 42 62 50 Z" fill="' + c.light + '" ' + SW2 + '/>' +
      '<path d="M36 46 l5 -8 l4 8 M48 43 l5 -8 l4 8" fill="' + c.dark + '" stroke="' + INK + '" stroke-width="1.5"/>';
    /* front legs */
    out += '<g transform="' + legB + '"><rect x="40" y="68" width="11" height="24" rx="5" fill="' + c.body + '" ' + SW2 + '/></g>' +
           '<g transform="' + legA + '"><rect x="74" y="68" width="11" height="24" rx="5" fill="' + c.body + '" ' + SW2 + '/></g>';
    /* head */
    var hx = 88, hy = 42;
    if (id === 'pet_bunny') {
      out += '<ellipse cx="' + (hx - 8) + '" cy="' + (hy - 30) + '" rx="6" ry="20" fill="' + c.body + '" ' + SW2 + ' transform="rotate(-14 ' + (hx - 8) + ' ' + (hy - 30) + ')"/>' +
             '<ellipse cx="' + (hx + 4) + '" cy="' + (hy - 30) + '" rx="6" ry="20" fill="' + c.body + '" ' + SW2 + ' transform="rotate(10 ' + (hx + 4) + ' ' + (hy - 30) + ')"/>' +
             '<ellipse cx="' + (hx + 4) + '" cy="' + (hy - 30) + '" rx="2.5" ry="13" fill="#f6b7c9" transform="rotate(10 ' + (hx + 4) + ' ' + (hy - 30) + ')"/>';
    }
    if (id === 'pet_kitten') {
      out += '<path d="M' + (hx - 16) + ' ' + (hy - 8) + ' L' + (hx - 12) + ' ' + (hy - 28) + ' L' + (hx - 2) + ' ' + (hy - 14) + ' Z" fill="' + c.body + '" ' + SW2 + '/>' +
             '<path d="M' + (hx + 4) + ' ' + (hy - 14) + ' L' + (hx + 14) + ' ' + (hy - 28) + ' L' + (hx + 16) + ' ' + (hy - 8) + ' Z" fill="' + c.body + '" ' + SW2 + '/>';
    }
    if (id === 'pet_dragon') {
      out += '<path d="M' + (hx - 10) + ' ' + (hy - 14) + ' l-2 -14 l8 10 Z M' + (hx + 6) + ' ' + (hy - 16) + ' l4 -14 l4 14 Z" fill="#ffd23f" ' + SW2 + '/>';
    }
    if (acc.back === 'acc_hoodie') out += ACC2D.hood;
    out += '<circle cx="' + hx + '" cy="' + hy + '" r="20" fill="' + c.body + '" ' + SW + '/>';
    if (id === 'pet_puppy') {
      out += '<path d="M' + (hx - 18) + ' ' + (hy - 10) + ' Q ' + (hx - 30) + ' ' + (hy + 4) + ' ' + (hx - 20) + ' ' + (hy + 18) + ' Q ' + (hx - 12) + ' ' + (hy + 8) + ' ' + (hx - 8) + ' ' + (hy - 6) + ' Z" fill="' + c.dark + '" ' + SW2 + '/>';
    }
    /* face, v2 'cool older sibling' (art bible: pet eyes and face): the muzzle and nose as
       before, then .slw-face — a smaller almond eye in Midnight Ink rolled 8° outer-up under
       an upper-lid line, one small upper-outer glint, and a side smirk. The blush shows only
       in cheer (opts.cheer), at 0.3. Accessory anchors (hx, hy) are unchanged. */
    var ex = hx + 4, ey = hy - 3, MI = '#14101f';
    out += '<ellipse cx="' + (hx + 12) + '" cy="' + (hy + 8) + '" rx="11" ry="8" fill="' + c.light + '"/>' +
      '<ellipse cx="' + (hx + 20) + '" cy="' + (hy + 5) + '" rx="4" ry="3" fill="' + c.nose + '"/>' +
      '<g class="slw-face">' +
      '<ellipse cx="' + ex + '" cy="' + ey + '" rx="3.3" ry="2.3" fill="' + MI + '" transform="rotate(8 ' + ex + ' ' + ey + ')"/>' +
      '<path d="M' + n1(ex - 3.8) + ' ' + n1(ey - 1.9) + ' Q' + n1(ex - 0.2) + ' ' + n1(ey - 4) + ' ' + n1(ex + 3.9) + ' ' + n1(ey - 1.2) + '" fill="none" stroke="' + MI + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="' + n1(ex - 1.3) + '" cy="' + n1(ey - 0.9) + '" r="0.8" fill="#fff"/>' +
      '<path d="M' + n1(hx + 19.5) + ' ' + n1(hy + 11.2) + ' Q' + n1(hx + 15) + ' ' + n1(hy + 13.2) + ' ' + n1(hx + 11) + ' ' + n1(hy + 10) + '" fill="none" stroke="' + MI + '" stroke-width="1.8" stroke-linecap="round"/>' +
      (opts.cheer ? '<circle cx="' + (hx - 4) + '" cy="' + (hy + 8) + '" r="3.5" fill="#ff9db8" opacity="0.3"/>' : '') +
      '</g>';
    if (id === 'pet_kitten') out += '<path d="M' + (hx + 16) + ' ' + (hy + 6) + ' l14 -3 M' + (hx + 16) + ' ' + (hy + 9) + ' l14 2" stroke="' + INK + '" stroke-width="1.3"/>';
    /* accessories */
    if (acc.neck === 'acc_scarf') out += ACC454.acc_scarf(hx, hy);
    if (acc.neck === 'acc_bow') out += ACC454.acc_bow(hx, hy);
    if (acc.face === 'acc_shades') out += ACC454.acc_shades(hx, hy);
    if (acc.hat === 'acc_partyhat') out += ACC454.acc_partyhat(hx, hy);
    if (acc.hat === 'acc_crown') out += ACC454.acc_crown(hx, hy);
    /* v2 streetwear (each line runs only for its own new id) */
    if (acc.back === 'acc_hoodie') out += ACC2D.drawstrings;
    if (acc.neck === 'acc_headphones') out += ACC2D.headphones;
    if (acc.face === 'acc_visor') out += ACC2D.visor;
    if (acc.hat === 'acc_beanie') out += ACC2D.beanie + (id === 'pet_bunny' ? ACC2D.bunnyTips : '');
    if (acc.hat === 'acc_cap') out += ACC2D.cap;
    out += landGear(acc.back, 'back', A3, true) + landGear(acc.neck, 'neck', A3) + landGear(acc.face, 'face', A3) + landGear(acc.hat, 'hat', A3);
    return svg(120, 100, out);
  }

  /* ================================================================
     MY ISLAND v3 — Pixel Blocks, the 2D fallback (plan-v3 contracts.worldArt; D35, D100, D107, D110).
     Flat pixel art that matches the voxel island. Every colour is a world-look token, written here
     as hex (test-enforced), so the islands and the first 30 v3 ids draw with nothing else loaded.
       ART.island(…, {pixel: true, theme: 'home' | isle, night, locked})   the block-ground map
       ART.isleIcon(isle, {locked})   a 20 × 20 pixel icon for the island bar ('' when unknown)
       ART.pix(rows, pal, unit)       a bitmap → merged SVG, one <path> per colour
       ART.sprite(id, st)             the 25 placeable first-plan ids: hand-authored pix sprites, each
                                      with ONE '.slw-act slw-act-<act>' group in its rest pose and no
                                      transform of its own. Toggles ('open', 'drawbridge', 'glow') read
                                      st.lit; colourways read st.variant. An act with no CSS of its
                                      own also carries its ACT_INFO class (slw-anim-*), so the host
                                      drives it through ACT_INFO (D110). Any other placeable or
                                      unknown id draws the generic block; non-placeable kinds stay null.
     LAND SHOPS (D100). ART.definePix(id, spec) → true | false; the data files register through it:
       a themed item      {rows: 12 × 12, pal}             its pictogram, drawn on a footprint-sized
                                                           block in the id's LOOK colours, inside one
                                                           '.slw-act slw-anim-<ACT_INFO anim2d>' group;
                                                           + lit: {char: colour} laid over pal (or on:
                                                           other rows) while a toggle is lit
       a path             {rows: 12 × 12, pal, tile: true} a flat ground tile, no block, no act group
       a mascot           {frames: [16 × 16, 16 × 16], pal, anchors: {hat, neck, face, back}, head: 8 × 8}
       a V4.54 pet        {anchors}                        where land gear sits on it
       an accessory       {rows, pal, slot, at: [x, y]}    its overlay; `at` is the overlay pixel that
                                                           sits on the slot anchor (default: a hat's
                                                           bottom middle, else its centre); back gear
                                                           draws behind the body unless over: true
     rows: strings, one character per pixel ('.' or ' ' = empty). pal: {char: colour}; a colour is
     '#rrggbb', a look token ('PX Coral', 'PETCOL3.pet_crab.body': resolved when drawn, so a data
     file may load before world-look.js) or, in a pet's spec, one of its own parts ('body', 'dark',
     'light', 'nose'); a pet's rows may use the PIX_PETS letters b e l n k (+ w white) with no pal
     at all. anchors: [x, y] in the pet's 16 × 16 pixel grid, which sits at (20, 14) in the
     120 × 100 pet box at 5 units a pixel (ART.PET_GRID; a spec cannot change it); the V4.54 pets use
     the same grid (ANCHOR454 by default). One overlay pixel = one grid pixel.
     ART.pet(id, {frame, acc}) draws a mascot from its frames (a round stand-in in its PETCOL3
     colours until they are registered, never the puppy), land gear on all 14 species, and the 11
     V4.54 accessories on a mascot at its own anchors. PETCOL stays the four V4.54 pets; the
     mascots' colours are PETCOL3, the same data as world-look PETCOL3 (D107).
     ================================================================ */
  var NODE = typeof module === 'object' && !!module && !!module.exports, DEPS = {};
  /* world-core (catalogue, ACT_INFO) and world-look (LOOK colours, tokens) load after this file in
     the browser, so they are looked up when a land-shop sprite is drawn, never at load */
  function dep(name, path) {
    if (DEPS[name]) return DEPS[name];
    var m = root && root[name];
    if (!m && NODE && typeof require === 'function') { try { m = require(path); } catch (e) { m = null; } }
    if (m) DEPS[name] = m;
    return m || null;
  }
  function coreItem(id) { var C = dep('SLWorldCore', './world-core.js'); return C && typeof C.item === 'function' ? C.item(id) : null; }
  function look() { return dep('SLIslandLook', './world-look.js'); }

  function rgbOf(h) {
    var s = h.slice(1);
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    var n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexOf(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mixc(a, b, k) { var x = rgbOf(a), y = rgbOf(b); return hexOf([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]); }
  /* a locked land: 60% desaturated, then 25% lighter; Showtime: 42% toward the night sky */
  function lockedHex(h) { var c = rgbOf(h), g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return hexOf(c.map(function (v) { return (v + (g - v) * 0.6) * 0.75 + 255 * 0.25; })); }
  function nightHex(h) { return mixc(h, '#2a2366', 0.42); }
  function rectD(x, y, w, h) { return 'M' + n1(x) + ' ' + n1(y) + 'h' + n1(w) + 'v' + n1(h) + 'h' + n1(-w) + 'z'; }

  /* pix(rows, pal, unit[, ox, oy, unitY]): a bitmap → SVG. One character per pixel; runs of a
     colour merge along a row and down the rows, and each colour is ONE <path> (few DOM nodes) */
  function pix(rows, pal, unit, ox, oy, unitY) {
    var ux = unit || 1, uy = unitY || ux, x0 = ox || 0, y0 = oy || 0, d = {}, order = [], open = {}, y, x, k;
    rows = rows || []; pal = pal || {};
    for (y = 0; y <= rows.length; y++) {
      var row = y < rows.length ? String(rows[y]) : '', next = {};
      for (x = 0; x < row.length;) {
        var ch = row.charAt(x), xs = x;
        while (x < row.length && row.charAt(x) === ch) x++;
        if (!own(pal, ch) || !pal[ch]) continue;
        k = ch + xs + ',' + (x - xs);
        next[k] = own(open, k) ? open[k] : y;
      }
      for (k in open) {
        if (!own(open, k) || own(next, k)) continue;
        var q = k.slice(1).split(','), col = pal[k.charAt(0)];
        if (!own(d, col)) { d[col] = ''; order.push(col); }
        d[col] += rectD(x0 + q[0] * ux, y0 + open[k] * uy, q[1] * ux, (y - open[k]) * uy);
      }
      open = next;
    }
    return order.map(function (c) { return '<path fill="' + c + '" d="' + d[c] + '"/>'; }).join('');
  }
  /* a little painter for bitmaps: b box · s stamp · t roof · o disc / ring · l line */
  function Grid(w, h) { this.w = w; this.h = h; this.a = []; for (var y = 0; y < h; y++) this.a.push(new Array(w + 1).join('.').split('')); }
  var GP = Grid.prototype;
  GP.b = function (x, y, w, h, ch, only) {
    for (var j = Math.max(0, y); j < Math.min(this.h, y + h); j++) for (var i = Math.max(0, x); i < Math.min(this.w, x + w); i++) if (!only || this.a[j][i] === only) this.a[j][i] = ch;
    return this;
  };
  GP.s = function (x, y, rows) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) if (rows[j].charAt(i) !== '.') this.b(x + i, y + j, 1, 1, rows[j].charAt(i));
    return this;
  };
  /* a roof: rows narrowing by one pixel a side, upward from its base row yb (per rows a step) */
  GP.t = function (x, yb, w, ch, per) { per = per || 1; for (var k = 0; w - 2 * k > 0; k++) this.b(x + k, yb - (k + 1) * per + 1, w - 2 * k, per, ch); return this; };
  /* a disc (or a ring from rIn) about (cx, cy), measured between pixel corners */
  GP.o = function (cx, cy, r, ch, rIn, only) {
    for (var j = Math.floor(cy - r); j <= cy + r; j++) for (var i = Math.floor(cx - r); i <= cx + r; i++) {
      var dd = Math.sqrt((i + 0.5 - cx) * (i + 0.5 - cx) + (j + 0.5 - cy) * (j + 0.5 - cy));
      if (dd <= r && dd >= (rIn || 0)) this.b(i, j, 1, 1, ch, only);
    }
    return this;
  };
  GP.l = function (x0, y0, x1, y1, ch) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var i = 0; i <= n; i++) this.b(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, ch);
    return this;
  };
  GP.rows = function () { return this.a.map(function (r) { return r.join(''); }); };

  /* ---------------- v3 pixel islands ----------------
     2D copies of world-look ISLE_THEME (test-enforced): the top patches, the rim (beach) ring, the
     three water tiers and the first strata of the underside; fall = what pours off the front. The
     five lands' top, rim, plank and patch are crisp C4's ground-only tokens, so every 2D land item
     and its pictogram plate reads on the ground under it (crisp-palette (f)). ART.PXI is a frozen
     copy for checks (KU-CH10 measures the people's outline against every ground). */
  var PXI = {
    home: { top: ['#93e98d', '#85df84', '#76d47a'], rim: ['#ffe9b8', '#ffdf9f'], water: ['#72e7dc', '#4fcbf3', '#3babef'], strata: ['#ffe2a0', '#ffc994', '#ffa9b9', '#f0a6ee', '#c9a6ff', '#a8b6ff'], fall: 'water', dot: '#5cc765',
      zones: { cove: ['#ffe9b8', '#ffdf9f'], meadow: ['#a6e88a', '#95df7c'] }, sandbar: '#f6e7bd' },
    pier: { top: ['#f9dd9b', '#f5d286'], rim: ['#f5d286', '#f9dd9b'], water: ['#7eebe0', '#52d3f0', '#3db3ea'], strata: ['#ffe6b0', '#ffd0a0', '#ffb49a', '#ff9fb4', '#f3a2d8', '#d6a8ff'], fall: 'water', plank: ['#dec087', '#c8a364'] },
    jungle: { top: ['#74a344', '#80b14d'], rim: ['#9fb59a'], water: ['#6fe3c8', '#3fc3d8', '#2e9fcc'], strata: ['#c8e6a0', '#9fd8a0', '#7ccb9e', '#5db8a8', '#4aa3b5', '#6f86d6'], fall: 'water', dot: '#ff5fa2', crowns: ['#2fa35a', '#6edb7a'], lily: '#3fc46a' },
    treetop: { top: ['#97c365', '#8cb85b'], rim: ['#7a4e2d'], water: null, strata: ['#e8c28a', '#d9a66b', '#c68f59', '#a9d18e', '#8ac7a0', '#76b8b0'], fall: 'roots', dot: '#ff5e5e', patch: ['#908759', '#857d50'],
      crowns: ['#2e8b57', '#57c27f', '#6ccb5f', '#8adb6a'] },
    castle: { top: ['#b1e384', '#a9da7d'], rim: ['#a39db6', '#938da7'], water: ['#7fd6f0', '#4fb0e8', '#3c93d6'], strata: ['#e6ddf5', '#d3c6ee', '#bfaee6', '#a99bdd', '#9aa8e6', '#8fc0e8'], fall: 'water', dot: '#ffffff' },
    ice: { top: ['#ccd7f3', '#c5d2ef', '#bfcceb'], rim: ['#c5d2ef', '#ccd7f3'], water: ['#9fe6f5', '#6fd0f0', '#4ab4e6'], strata: ['#e9f6ff', '#d3ecff', '#bfe1ff', '#b3d0ff', '#b8c2ff', '#c6b6ff'], fall: 'iced', patch: ['#74c6ea', '#5db9df'],
      floe: '#f2f7ff' }
  };
  /* The fine grid is 4 × 6 squares a cell (25 × 13 units); a block is 2 × 3 of them (50 × 39).
     Round the land: a rim ring one block wide (two fine rows deep to the north and south: the
     3/4 view), then three water tiers one fine square each, with a dashed foam line between.
     Under every south edge hangs the floating band: a wall lip and strata stepping inward (the
     last BAND rows of the frame are kept for it), and the falls, iced fall or roots pour over it.
     Everything is painted on the grid and merged into rects (≤ 450 an island); the block bevels,
     the foam and a locked region's dashed edge are one <path> each. */
  var FX = 25, FY = 13, BAND = 3, ISLE_MEMO = [];
  function frozenCopy(o) { if (!o || typeof o !== 'object') return o; var c = Array.isArray(o) ? [] : {}; for (var k in o) if (own(o, k)) c[k] = frozenCopy(o[k]); return Object.freeze(c); }
  /* the 2D stage redraws on every toggle tap, so the last few maps are kept (same input, same string) */
  function islandPixel(cols, rows, cellsByRegion, unlocked, opts) {
    var key = [cols, rows, opts.theme, !!opts.night, !!opts.locked, JSON.stringify(cellsByRegion), JSON.stringify(unlocked)].join('|'), i, hit;
    for (i = 0; i < ISLE_MEMO.length; i++) if (ISLE_MEMO[i][0] === key) { hit = ISLE_MEMO.splice(i, 1)[0]; ISLE_MEMO.unshift(hit); return hit[1]; }
    ISLE_MEMO.unshift([key, paintIsland(cols, rows, cellsByRegion, unlocked, opts)]);
    ISLE_MEMO.length = Math.min(ISLE_MEMO.length, 8);
    return ISLE_MEMO[0][1];
  }
  function paintIsland(cols, rows, cellsByRegion, unlocked, opts) {
    var theme = own(PXI, opts.theme) ? opts.theme : 'home', T = PXI[theme], W = cols * 100, H = rows * CH, gw = cols * 4, gh = rows * 6;
    var kind = [], paint = [], keys = Object.keys(cellsByRegion), hiRow = -1, r, c, i, j;
    var lockAll = !!opts.locked || (theme !== 'home' && keys.some(function (k) { return !unlocked[k]; }));
    function K(cc, rr) { return cc < 0 || rr < 0 || cc >= gw || rr >= gh ? '' : kind[rr * gw + cc] || ''; }
    function hash(a, b) { return ((a * 73 + b * 151 + a * b * 7) % 97 + 97) % 97; }
    function stamp(c0, r0, w, h, hex) { for (var y = Math.max(0, r0); y < Math.min(gh, r0 + h); y++) for (var x = Math.max(0, c0); x < Math.min(gw, c0 + w); x++) paint[y * gw + x] = hex; }
    /* 1. the land in soft patches of its top colours; Home's locked regions are a pale sandbar */
    keys.forEach(function (rk) {
      var solid = theme !== 'home' || lockAll || !!unlocked[rk], tops = (T.zones && own(T.zones, rk) && T.zones[rk]) || T.top;
      (cellsByRegion[rk] || []).forEach(function (ck) {
        var p = String(ck).split(','), cx = +p[0], cy = +p[1];
        if (!(cx >= 0 && cy >= 0 && cx < cols && cy < rows)) return;
        hiRow = Math.max(hiRow, cy);
        for (var y = cy * 6; y < cy * 6 + 6; y++) for (var x = cx * 4; x < cx * 4 + 4; x++) {
          var by = Math.floor(y / 3), h = hash(((x >> 1) + (by & 2)) >> 2, by >> 1) % 10;
          kind[y * gw + x] = solid ? 'L' : 'X';
          paint[y * gw + x] = !solid ? T.sandbar : tops[h < 6 ? 0 : h < 9 || tops.length < 3 ? Math.min(1, tops.length - 1) : 2];
        }
      });
    });
    for (r = 0; r < gh; r++) for (c = 0; c < gw; c++) {
      if (kind[r * gw + c] !== 'L') continue;
      /* planks on the pier's promenade, stem and T-head (its five southern rows); ice patches and bark clearings */
      if (T.plank && Math.floor(r / 6) >= hiRow - 4) paint[r * gw + c] = T.plank[r & 1];
      else if (T.patch) { var hp = hash(((c >> 1) + 3) >> 1, Math.floor(r / 3) + 5); if (hp % 7 === 0) paint[r * gw + c] = T.patch[hp % 2]; }
    }
    /* 2. the rings: every empty square within rx, ry of a `from` kind takes the mark */
    function grow(from, rx, ry, mark) {
      var hit = [];
      for (var y = 0; y < gh - BAND; y++) for (var x = 0; x < gw; x++) {
        if (kind[y * gw + x]) continue;
        var found = false;
        for (var dy = -ry; dy <= ry && !found; dy++) for (var dx = -rx; dx <= rx && !found; dx++) { var k = K(x + dx, y + dy); found = !!k && from.indexOf(k) >= 0; }
        if (found) hit.push(y * gw + x);
      }
      hit.forEach(function (q) { kind[q] = mark; });
    }
    grow('L', 2, 2, 'R');
    if (T.water) { grow('LXR', 1, 1, '1'); grow('LXR1', 1, 1, '2'); grow('LXR12', 1, 1, '3'); }
    for (r = 0; r < gh; r++) for (c = 0; c < gw; c++) {
      var kk = kind[r * gw + c];
      if (kk === 'R') paint[r * gw + c] = T.rim[T.rim.length > 1 && hash((c >> 1) + 11, Math.floor(r / 3) + 3) % 4 === 0 ? 1 : 0];
      else if (kk >= '1' && kk <= '3') paint[r * gw + c] = T.water[+kk - 1];
    }
    /* 3. the floating band: a wall lip, then strata stepping in by a block a row from the island's ends */
    var lip = T.water ? mixc(T.water[2], '#2d71ca', 0.5) : mixc(T.rim[0], '#2b2140', 0.3), edge = mixc(T.rim[0], '#2b2140', 0.2), endDist = [], prof = [];
    for (c = 0; c < gw; c++) { prof[c] = false; for (r = 0; r < gh && !prof[c]; r++) prof[c] = !!kind[r * gw + c]; }
    for (c = 0; c < gw; c++) {
      var dl = 0, dr = 0;
      while (c - dl >= 0 && prof[c - dl]) dl++;
      while (c + dr < gw && prof[c + dr]) dr++;
      endDist[c] = Math.min(c - dl < 0 ? 99 : dl, c + dr >= gw ? 99 : dr);       /* the frame's own edge is not an end */
    }
    for (c = 0; c < gw; c++) for (r = 0; r < gh - 1; r++) {
      var k0 = kind[r * gw + c];
      if (!k0 || kind[(r + 1) * gw + c]) continue;
      for (j = 0; j < 7 && r + 1 + j < gh && !kind[(r + 1 + j) * gw + c]; j++) {
        if (j && endDist[c] <= 2 * j) break;
        paint[(r + 1 + j) * gw + c] = j ? T.strata[j - 1] : k0 >= '1' && k0 <= '3' ? lip : edge;
      }
    }
    /* 4. what pours off the front: two pixel waterfalls, an iced fall, or dangling roots */
    function bottomOf(x) { for (var y = gh - 1; y >= 0; y--) if (kind[y * gw + x]) return y; return -1; }
    function pour(x0, w, len, a, b) {
      for (var x = x0; x < x0 + w && x < gw; x++) {
        var y0 = bottomOf(x);
        if (y0 < 0) continue;
        for (var y = 1; y <= len && y0 + y < gh; y++) paint[(y0 + y) * gw + x] = (x - x0 + y) % 2 ? a : b;
      }
    }
    var edgeCols = [];
    for (c = 0; c < gw; c++) { var yb = bottomOf(c); if (yb >= 0 && yb < gh - 1 && endDist[c] > 3) edgeCols.push(c); }
    if (edgeCols.length > 4) {
      if (T.fall === 'water') { pour(edgeCols[Math.floor(edgeCols.length * 0.2)], 2, 6, '#ffffff', T.water[0]); pour(edgeCols[Math.floor(edgeCols.length * 0.74)], 2, 6, '#ffffff', T.water[0]); }
      if (T.fall === 'iced') pour(edgeCols[Math.floor(edgeCols.length * 0.3)], 3, 4, '#e2f6ff', '#bfe8ff');
      if (T.fall === 'roots') for (i = 1; i < 7; i++) pour(edgeCols[Math.floor(edgeCols.length * i / 7)], 1, 4 + (i * 5) % 3, '#7a4e2d', '#7a4e2d');
    }
    /* 5. scenery on the rim: tree crowns (jungle: four; treetop: a ring), lily pads, ice floes */
    function dry(k) { return k === 'L' || k === 'R' || k === 'X'; }
    if (T.crowns) {
      var rim = [], sx = 0, sy = 0, sn = 0, count = T.crowns.length > 2 ? 14 : 4;
      for (r = 0; r < gh; r++) for (c = 0; c < gw; c++) {
        if (kind[r * gw + c] === 'L') { sx += c; sy += r; sn++; }
        if (kind[r * gw + c] === 'R' && !(dry(K(c - 1, r)) && dry(K(c + 1, r)) && dry(K(c, r - 1)) && dry(K(c, r + 1)))) rim.push([c, r]);
      }
      for (i = 0; i < count && sn; i++) {
        var ang = -Math.PI + (i + 0.5) * 2 * Math.PI / count, best = null, bd = 9;
        rim.forEach(function (q) {
          var a = Math.atan2((q[1] - sy / sn) * FY, (q[0] - sx / sn) * FX) - ang, dd = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
          if (dd < bd) { bd = dd; best = q; }
        });
        if (!best) break;
        var tw = T.crowns.length > 2 && i % 2 ? 2 : 0, tx = best[0] - 2, ty = best[1] - 2;
        stamp(tx + 1, ty, 4, 1, T.crowns[tw]); stamp(tx, ty + 1, 6, 2, T.crowns[tw]); stamp(tx + 1, ty + 3, 4, 1, T.crowns[tw]);
        stamp(tx + 1, ty + 1, 2, 1, T.crowns[tw + 1]); stamp(tx + 2, ty, 1, 1, T.crowns[tw + 1]);
      }
    }
    for (r = 0; r < gh; r++) for (c = 0; c < gw - 1; c++) {
      var kw = kind[r * gw + c], hw = hash(c * 3 + 1, r * 5 + 2);
      if (T.lily && (kw === '1' || kw === '2') && hw % 23 === 0) stamp(c, r, 1, 1, T.lily);
      if (T.floe && kw === '3' && kind[r * gw + c + 1] === '3' && hw % 17 === 0) stamp(c, r, 2, 1, T.floe);
      /* tufts, flowers and toadstools: one square inside a block, here and there */
      if (T.dot && kw === 'L' && c % 2 === 1 && r % 3 === 1 && T.top.indexOf(paint[r * gw + c]) >= 0 && hash((c >> 1) * 7 + 3, Math.floor(r / 3) * 11 + 1) % 19 === 0) stamp(c, r, 1, 1, T.dot);
    }
    /* 6. the light: Showtime night, and the pale look of a locked land under its cloud puffs */
    var seen = {};
    for (i = 0; i < gw * gh; i++) {
      var hx = paint[i];
      if (!hx) continue;
      if (!own(seen, hx)) seen[hx] = opts.night ? nightHex(lockAll ? lockedHex(hx) : hx) : lockAll ? lockedHex(hx) : hx;
      paint[i] = seen[hx];
    }
    if (lockAll) {
      var c0 = gw, c1 = 0, r0 = gh, r1 = 0, puff = opts.night ? nightHex('#ffffff') : '#ffffff';
      for (r = 0; r < gh; r++) for (c = 0; c < gw; c++) if (kind[r * gw + c]) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
      [[0, 0.2], [0.66, 0.04], [0.84, 0.58], [0.28, 0.9], [0.4, 0.42], [0.06, 0.68]].forEach(function (p, q) {
        var pc = Math.round(c0 + (c1 - c0) * p[0]) - 1, pr = Math.round(r0 + (r1 - r0) * p[1]);
        stamp(pc, pr + 1, 7, 2, puff); stamp(pc + 1 + q % 3, pr, 3, 1, puff);
      });
    }
    /* 7. merge: runs along a row, then down the rows, grouped by colour */
    var by = {}, order = [], open = {}, out = '', key;
    for (r = 0; r <= gh; r++) {
      var next = {};
      for (c = 0; r < gh && c < gw;) {
        var pc0 = c, pv = paint[r * gw + c];
        while (c < gw && paint[r * gw + c] === pv) c++;
        if (!pv) continue;
        key = pv + ',' + pc0 + ',' + (c - pc0);
        next[key] = own(open, key) ? open[key] : r;
      }
      for (key in open) {
        if (!own(open, key) || own(next, key)) continue;
        var q = key.split(',');
        if (!own(by, q[0])) { by[q[0]] = ''; order.push(q[0]); }
        by[q[0]] += '<rect x="' + q[1] * FX + '" y="' + open[key] * FY + '" width="' + q[2] * FX + '" height="' + (r - open[key]) * FY + '"/>';
      }
      open = next;
    }
    order.forEach(function (hexc) { out += '<g fill="' + hexc + '">' + by[hexc] + '</g>'; });
    /* 8. block bevels on the land and the rim: a light top and left edge, a dark bottom and right edge */
    function solid(x, y) { var k = K(x, y); return k === 'L' || k === 'R'; }
    var hi = '', lo = '';
    for (r = 0; r < gh; r++) for (i = 0; i < 2; i++) for (c = 0; c < gw; c++) {
      var b0 = c;
      while (c < gw && solid(c, r) && (i ? r % 3 === 2 || !solid(c, r + 1) : r % 3 === 0 || !solid(c, r - 1))) c++;
      if (c > b0) { if (i) lo += rectD(b0 * FX, (r + 1) * FY - 3, (c - b0) * FX, 3); else hi += rectD(b0 * FX, r * FY, (c - b0) * FX, 3); }
    }
    for (c = 0; c < gw; c++) for (r = 0; r < gh; r++) {
      var v0 = r;
      while (r < gh && solid(c, r)) r++;
      if (r > v0) { if (c % 2) lo += rectD((c + 1) * FX - 3, v0 * FY, 3, (r - v0) * FY); else hi += rectD(c * FX, v0 * FY, 3, (r - v0) * FY); }
    }
    if (hi) out += '<path d="' + hi + '" fill="#ffffff" opacity="' + (opts.night ? '0.16' : '0.34') + '"/><path d="' + lo + '" fill="#2b2140" opacity="0.12"/>';
    /* 9. the border between kind a and the kinds in b, as stroke segments: foam, and a locked region's dashed edge */
    function border(a, b) {
      var d = '', s;
      for (var y = 0; y < gh; y++) for (s = -1; s < 2; s += 2) for (var x = 0; x < gw; x++) {
        var x0 = x;
        while (x < gw && K(x, y) === a && b.indexOf(K(x, y + s) || ' ') >= 0) x++;
        if (x > x0) d += 'M' + x0 * FX + ' ' + (s < 0 ? y : y + 1) * FY + 'h' + (x - x0) * FX;
      }
      for (var x2 = 0; x2 < gw; x2++) for (s = -1; s < 2; s += 2) for (var y2 = 0; y2 < gh; y2++) {
        var y0 = y2;
        while (y2 < gh && K(x2, y2) === a && b.indexOf(K(x2 + s, y2) || ' ') >= 0) y2++;
        if (y2 > y0) d += 'M' + (s < 0 ? x2 : x2 + 1) * FX + ' ' + y0 * FY + 'v' + (y2 - y0) * FY;
      }
      return d;
    }
    var foam = border('R', '1'), bar = border('X', '123 ');
    if (foam) out += '<path d="' + foam + '" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="12 9" opacity="' + (opts.night ? '0.5' : '0.9') + '"/>';
    if (bar) out += '<path d="' + bar + '" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="4 9" opacity="0.8"/>';
    return svg(W, H, out, ' preserveAspectRatio="none" class="slw-ground-svg slw-px" shape-rendering="crispEdges"');
  }

  /* ---------------- the pixel palette: one character per look token (hex test-enforced) ----------------
     W Cloud White · k PX Ink Eye · c Coral · y Sunny · p Candy Pink · m Mint · l Lilac · b Pier Stripe
     Blue · 5 Sky Blue · 6 Cream Wall · 0 Grass · n / N Pier Plank / Shade · o Pier Pile ·
     4 Bulb Warm · L / H Lamp Warm / Off · g G h Jungle Canopy / Deep / Light · t / T Thatch / Shade ·
     r / R Jungle Bark / Light · e Rope · M Moss Stone · F Flower Pink · E Jungle Water · v V u Tree Pine /
     Mid / Light · O / U Tree Oak / Light · d Tree Bark · D Tree Plank · x Tree Net · f Tree Flag ·
     X Tree Autumn · A / 9 Bark Trail (= Castle Wood) / Trail 2 · K / Y Tree Chip / 2 · q Q z Castle Stone / 2 / Shade ·
     7 / 8 Pier Deck / 2 and C / s Castle Cobble / 2 (the two paths on crisp C4's ground tokens) ·
     j Sandstone · a Castle Banner · J Castle Iron · w S Z Ice Snow / 2 / Shade · i I B Ice / 2 / Deep ·
     P Penguin Back · 1 Penguin Orange · 2 the puppy's body (a rider stands for any pet) */
  var PXC = {
    W: '#ffffff', k: '#2b2140', c: '#ff6f61', y: '#ffd23f', p: '#ff8fc0', m: '#7fe0c2', l: '#b49cff', b: '#4fb8f0', 5: '#45c3f5', 6: '#fff3da', 0: '#93e98d',
    n: '#f2d7a6', N: '#e3c08a', o: '#9b6b4a', 4: '#fff1b8', L: '#ffd08a', H: '#b9a99a',
    g: '#3fc46a', G: '#2fa35a', h: '#6edb7a', t: '#d9a441', T: '#c98e2e', r: '#8a5a35', R: '#a8743f', e: '#e0b676', M: '#9fb59a', F: '#ff5fa2', E: '#6fe3c8',
    v: '#2e8b57', V: '#3ba36a', u: '#57c27f', O: '#6ccb5f', U: '#8adb6a', d: '#7a4e2d', D: '#c99a5e', x: '#f2e2b8', f: '#3fa9f5', X: '#ffb347', A: '#a0643c', 9: '#b5794a', K: '#d9a066', Y: '#e8b878',
    q: '#c9c3d9', Q: '#b4adc8', z: '#9a93b3', j: '#f2d9a6', a: '#7b5cff', J: '#4a4e69',
    w: '#f2f7ff', S: '#e6f0ff', Z: '#c9d9f2', i: '#bfe8ff', I: '#a6dbfa', B: '#5fb0e8', P: '#2b2d42', 1: '#ff9f1c', 2: '#e3b077',
    7: '#dec087', 8: '#c8a364', C: '#a39db6', s: '#938da7'
  };

  /* ---------------- island icons (20 × 20, the island bar and the land icons) ---------------- */
  var ISLE_ICON = {
    home: function (g) { g.b(13, 3, 2, 4, 'l').t(2, 9, 16, 'c').b(4, 10, 12, 7, '6').b(6, 12, 3, 3, '5').b(11, 12, 3, 5, 'b').b(13, 14, 1, 1, 'y').b(1, 17, 18, 2, '0'); },
    pier: function (g) {
      g.l(9, 9, 5, 16, 'l').l(10, 9, 14, 16, 'l').o(10, 9, 8, 'b', 6.4).b(3, 8, 14, 2, 'W').b(9, 2, 2, 14, 'W').b(9, 8, 2, 2, 'c');
      g.b(8, 0, 4, 3, 'c').b(8, 15, 4, 3, 'y').b(0, 7, 3, 4, 'm').b(17, 7, 3, 4, 'p').b(3, 17, 14, 2, 'n');
    },
    jungle: function (g) { g.t(2, 10, 16, 't').b(2, 10, 16, 1, 'T').o(10, 3.4, 3.4, 'g').b(8, 2, 2, 1, 'h').b(4, 11, 12, 5, 'n').b(9, 12, 3, 4, 'r').b(5, 13, 2, 2, 'L').b(4, 16, 1, 3, 'r').b(15, 16, 1, 3, 'r').b(1, 18, 18, 2, 'G'); },
    treetop: function (g) { g.b(7, 15, 2, 4, 'd').t(2, 15, 12, 'v', 1).t(3, 10, 10, 'V').t(5, 6, 6, 'v').b(7, 4, 2, 1, 'u').b(5, 12, 3, 1, 'u').l(9, 7, 17, 13, 'e').b(17, 12, 2, 7, 'd').b(12, 10, 2, 2, 'c').b(1, 18, 18, 2, 'O'); },
    castle: function (g) {
      g.b(5, 6, 10, 12, 'q').b(12, 6, 3, 12, 'Q').b(4, 3, 3, 4, 'q').b(9, 3, 2, 4, 'q').b(13, 3, 3, 4, 'Q').b(9, 13, 3, 5, 'A').b(9, 12, 3, 1, 'j').b(7, 8, 2, 3, 'L');
      g.b(10, 0, 1, 3, 'J').b(11, 0, 4, 2, 'a').b(1, 18, 18, 2, '0');
    },
    ice: function (g) {
      g.o(10, 17, 9.4, 'I').o(10, 17, 8.4, 'w').b(3, 12, 14, 1, 'Z', 'w').b(5, 9, 10, 1, 'Z', 'w').b(6, 13, 1, 4, 'Z', 'w').b(14, 13, 1, 4, 'Z', 'w').b(13, 10, 1, 2, 'Z', 'w').b(7, 10, 1, 2, 'Z', 'w');
      g.o(10, 17, 4, 'B').o(10, 17, 2.6, 'P').b(0, 17, 20, 3, '.').b(0, 17, 20, 2, 'i').b(10, 2, 1, 6, 'J').b(11, 2, 4, 3, 'c');
    }
  };
  var LOCK_BADGE = ['.kkkkk.', 'kk...kk', 'kk...kk', 'kkkkkkk', 'kyyyyyk', 'kyykyyk', 'kyykyyk', 'kkkkkkk'];
  function isleIconBody(isle, locked) {
    var g = new Grid(20, 20), pal = PXC, k;
    ISLE_ICON[isle](g);
    if (locked) { pal = {}; for (k in PXC) if (own(PXC, k)) pal[k] = lockedHex(PXC[k]); }
    return pix(g.rows(), pal, 1) + (locked ? pix(LOCK_BADGE, { k: '#2b2140', y: '#ffd23f' }, 1, 13, 12) : '');
  }
  function isleIcon(isle, o) {
    if (!own(ISLE_ICON, isle)) return '';
    return '<svg class="slw-isleico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + isleIconBody(isle, !!(o && o.locked)) + '</svg>';
  }
  var LAND_ISLE = { land_pier: 'pier', land_jungle: 'jungle', land_treetop: 'treetop', land_castle: 'castle', land_ice: 'ice' };

  /* ---------------- land shops: the pix registry (D100) ---------------- */
  var PIXREG = Object.create(null), SLOTS = ['hat', 'neck', 'face', 'back'], PAL_KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
  function gridOf(v) {
    if (!Array.isArray(v) || !v.length || v.length > 64 || typeof v[0] !== 'string' || !v[0].length || v[0].length > 64) return null;
    for (var i = 0; i < v.length; i++) if (typeof v[i] !== 'string' || v[i].length !== v[0].length) return null;
    return v.slice();
  }
  function pointOf(v) { return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && isFinite(v[0]) && isFinite(v[1]) ? [v[0], v[1]] : null; }
  function palIn(p) {
    var out = {}, k;
    if (Array.isArray(p)) p.slice(0, PAL_KEYS.length).forEach(function (c, i) { if (typeof c === 'string') out[PAL_KEYS.charAt(i)] = c; });
    else if (p && typeof p === 'object') for (k in p) if (own(p, k) && k.length === 1 && typeof p[k] === 'string') out[k] = p[k];
    return out;
  }
  function definePix(id, spec) {
    if (typeof id !== 'string' || !id || !spec || typeof spec !== 'object') return false;
    var o = { tile: !!spec.tile, over: !!spec.over };
    if (gridOf(spec.rows)) o.rows = gridOf(spec.rows);
    if (gridOf(spec.on)) o.on = gridOf(spec.on);
    if (gridOf(spec.head)) o.head = gridOf(spec.head);
    if (Array.isArray(spec.frames) && spec.frames.map(gridOf).filter(Boolean).length) o.frames = spec.frames.map(gridOf).filter(Boolean);
    if (spec.anchors && typeof spec.anchors === 'object' && SLOTS.some(function (s) { return pointOf(spec.anchors[s]); })) { o.anchors = {}; SLOTS.forEach(function (s) { if (pointOf(spec.anchors[s])) o.anchors[s] = pointOf(spec.anchors[s]); }); }
    if (!o.rows && !o.frames && !o.anchors) return false;
    o.pal = palIn(spec.pal);
    if (spec.lit && typeof spec.lit === 'object') o.lit = palIn(spec.lit);
    if (SLOTS.indexOf(spec.slot) >= 0) o.slot = spec.slot;
    if (pointOf(spec.at)) o.at = pointOf(spec.at);
    PIXREG[id] = o;
    return true;
  }
  function pixOf(id) { return typeof id === 'string' && own(PIXREG, id) ? PIXREG[id] : null; }
  /* a palette entry → '#rrggbb': a hex, a pet's own part, a PETCOL / PETCOL3 path, or a look token */
  function colourOf(v, petId) {
    if (typeof v !== 'string') return null;
    var h = hexOk(v), pc = typeof petId === 'string' ? (own(PETCOL, petId) ? PETCOL[petId] : own(PETCOL3, petId) ? PETCOL3[petId] : null) : null, m, L;
    if (h) return h.length === 4 ? '#' + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2) + h.charAt(3) + h.charAt(3) : h;
    if (pc && own(pc, v)) return pc[v].toLowerCase();
    m = /^(PETCOL3?)\.(\w+)\.(\w+)$/.exec(v);
    if (m) { pc = m[1] === 'PETCOL' ? PETCOL : PETCOL3; return own(pc, m[2]) && own(pc[m[2]], m[3]) ? pc[m[2]][m[3]].toLowerCase() : null; }
    L = look();
    h = L && typeof L.resolve === 'function' ? L.resolve(v) : null;
    return typeof h === 'string' ? h.toLowerCase() : null;
  }
  function palOf(pal, petId, base) {
    var out = {}, k;
    for (k in base || {}) if (own(base, k)) out[k] = base[k];
    for (k in pal || {}) if (own(pal, k)) out[k] = colourOf(pal[k], petId) || '#c9c5d3';      /* an unknown token keeps its shape, in a quiet grey */
    return out;
  }

  /* ---------------- the pictogram block and the generic block (D100, D110) ----------------
     A footprint-sized toy block in the id's LOOK colours (main; the second colour as studs), with
     a pale plate carrying the 12 × 12 pictogram in ONE '.slw-act slw-anim-<class>' group; a lit
     toggle warms the plate (and shows spec.on). An id with no pictogram shows a ✦ when it has an
     act, a plain block when it has none; an unknown id is a 1 × 1 lilac block. */
  var SPARK = ['............', '.....yy.....', '.....yy.....', '....yyyy....', '....yyyy....', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '....yyyy....', '....yyyy....', '.....yy.....', '.....yy.....', '............'];
  var TILE0 = ['aaaaabbbbbba', 'aaaaabbbbbba', 'aaaaabbbbbba', 'aaaaabbbbbba', 'aaaaabbbbbba', 'bbbbbbbbbbbb', 'bbbbbaaaaaab', 'bbbbbaaaaaab', 'bbbbbaaaaaab', 'bbbbbaaaaaab', 'bbbbbaaaaaab', 'bbbbbbbbbbbb'];
  function box(x, y, w, h, fill) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + fill + '"/>'; }
  function lookPair(id, st) {
    var L = look(), e = L && L.LOOK && own(L.LOOK, id) ? L.LOOK[id] : null, keys = e ? Object.keys(e.colors) : [], v = st.variant | 0, second = null;
    var main = e && colourOf(e.colors.main), way = e && e.variantTokens && v >= 0 && v < e.variantTokens.length ? colourOf(e.variantTokens[v]) : null;
    /* a colourway recolours the main part (its first token is the main colour) or else the accent */
    if (way && e.variantTokens[0] === e.colors.main) main = way; else if (way && way !== main) second = way;
    keys.forEach(function (k) { var c = k !== 'main' && !second && colourOf(e.colors[k]); if (c && c !== main) second = c; });
    return [main || '#b49cff', second || '#ffffff'];
  }
  function tileSprite(rows, pal) { return { w: 100, h: CH, svg: svg(100, CH, '<g shape-rendering="crispEdges">' + pix(rows, pal, 100 / rows[0].length, 0, 0, CH / rows.length) + '</g>') }; }
  /* the ACT_INFO row of a catalogue item's act, or null */
  function infoOf(it) { var C = dep('SLWorldCore', './world-core.js'); return it && it.act && C && C.ACT_INFO && own(C.ACT_INFO, it.act) ? C.ACT_INFO[it.act] : null; }
  function blockSprite(id, st, spec) {
    var it = coreItem(id), fp = it && it.fp ? it.fp : [1, 1], w = fp[0] * 100, h = fp[1] * CH + 92, i;
    var info = infoOf(it), lit = !!(st.lit && info && info.toggle);
    var cols = lookPair(id, st), main = cols[0], second = cols[1];
    var rows = spec ? (lit && spec.on) || spec.rows : info ? SPARK : null, pal = spec ? palOf(lit && spec.lit ? palOf(spec.lit, null, spec.pal) : spec.pal) : { y: pale(second) ? pale(main) ? '#b49cff' : main : second };
    var n = rows ? rows.length : 12, u = Math.max(4, Math.min(13, Math.floor(Math.min(w - 40, h - 60) / n)));
    var fh = n * u + 18, th = 20 + (fp[1] - 1) * 26, yb = h - 14, yf = yb - fh, yt = yf - th, bw = w - 16, px = (w - rows0(rows, n) * u) / 2;
    var out = '<g shape-rendering="crispEdges">' + pxShadow(8, yb - 3, bw) +
      box(8, yt, bw, th, mixc(main, '#ffffff', 0.4)) + box(8, yt, bw, 4, mixc(main, '#ffffff', 0.68)) + box(8, yf, bw, fh, main) +
      box(8, yf, 4, fh, mixc(main, '#ffffff', 0.25)) + box(bw + 4, yf, 4, fh, mixc(main, '#2b2140', 0.14)) + box(8, yb - 8, bw, 8, mixc(main, '#2b2140', 0.22));
    for (i = 0; i * 20 + 24 <= bw; i++) out += box(18 + i * 20, yf, 10, fh - 8, mixc(main, '#ffffff', 0.13));        /* soft stripes down the front */
    for (i = 1; i < fp[0]; i++) out += box(i * 100 - 1, yt, 2, yb - yt, mixc(main, '#2b2140', 0.14));          /* a seam a cell: it reads as blocks side by side */
    for (i = 0; i * 20 + 22 <= bw; i++) out += box(14 + i * 20 + (bw - 12) % 20 / 2, yt + th / 2 - 3, 10, 7, second);
    if (rows) {
      out += box(px - 5, yf + 4, rows[0].length * u + 10, n * u + 10, lit ? '#ffe9a8' : mixc(main, '#ffffff', 0.88));
      if (lit) out += box(px - 5, yf + 4, 5, 5, '#ffffff') + box(px + rows[0].length * u, yf + 4, 5, 5, '#ffffff') + box(px - 5, yf + 9 + n * u, 5, 5, '#ffffff') + box(px + rows[0].length * u, yf + 9 + n * u, 5, 5, '#ffffff');
      out += (spec || info ? '<g class="slw-act slw-anim-' + (info ? info.anim2d : 'none') + '">' : '') + pix(rows, pal, u, px, yf + 9) + (spec || info ? '</g>' : '');
    }
    return { w: w, h: h, svg: svg(w, h, out + '</g>') };
  }
  function rows0(rows, n) { return rows ? rows[0].length : n; }
  function pale(h) { var c = rgbOf(h); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 > 214; }

  /* ---------------- v3 crew: the ten mascots and the land gear (D100, D107) ----------------
     PETCOL3 is world-look's table, letter for letter (test-enforced). A mascot's 16 × 16 frame
     sits at (PETX, PETY) in the 120 × 100 pet box, PETU units a pixel, feet on y 94 like the
     V4.54 pets. ANCHOR454: the V4.54 body in that grid (head centre 88, 42, radius 20) — where
     land gear sits on the four V4.54 pets, and what a V4.54 accessory is moved FROM on a mascot.
     CRITTER is the stand-in for a mascot whose frames are not registered yet. */
  var PETCOL3 = {
    pet_crab:     { body: '#3FA7E0', dark: '#2C7FBF', light: '#FFF3D6', nose: '#FF8FC0' },
    pet_gull:     { body: '#F2F7FF', dark: '#8FA9C4', light: '#FFFFFF', nose: '#FFB52E' },
    pet_capybara: { body: '#C27A45', dark: '#96592D', light: '#EBC08F', nose: '#4A2E22' },
    pet_monkey:   { body: '#F5C73C', dark: '#5B4A6B', light: '#FFF6E6', nose: '#4A3A5A' },
    pet_squirrel: { body: '#E07B39', dark: '#B85C2A', light: '#FFF1D6', nose: '#F29CB0' },
    pet_owl:      { body: '#A0643C', dark: '#7C4B2C', light: '#FFF1D6', nose: '#FFD23F' },
    pet_duckling: { body: '#FFD95A', dark: '#F2B632', light: '#FFF1B0', nose: '#FF9A3D' },
    pet_pony:     { body: '#C98B5A', dark: '#9C6238', light: '#FBE9C9', nose: '#5A3A2A' },
    pet_penguin:  { body: '#6E8FC4', dark: '#4A6AA6', light: '#F7F9FF', nose: '#FF9F1C' },
    pet_seal:     { body: '#A9B8CC', dark: '#7E8FA8', light: '#EEF3FA', nose: '#2B2D42' }
  };
  var PETU = 5, PETX = 20, PETY = 14, PET_GRID = { size: 16, unit: PETU, x: PETX, y: PETY };
  var ANCHOR454 = { hat: [13.6, 1.6], neck: [12.4, 9.2], face: [15.2, 5], back: [6.4, 7.2] };
  var CRITTER = {
    frames: [['................', '................', '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbbbbbbbbbbb..', '..bbbbbbbbwkbb..', '..bbbbbbbbbbbbn.', '..bbbbbbbbbbbbn.',
      '..ebbllllllbbb..', '..ebllllllllbb..', '..ebllllllllbb..', '..bbllllllllbb..', '...bllllllllb...', '...bbbbbbbbbb...', '....eee..eee....', '....eee..eee....']],
    anchors: { hat: [8, 2], neck: [11.5, 9], face: [11, 5.5], back: [3.5, 5] },
    head: ['.bbbbbb.', 'bbbbbbbb', 'bkbbbbkb', 'bbbbbbbb', 'bbbnnbbb', 'bllllllb', '.bllllb.', '..bbbb..']
  };
  CRITTER.frames.push(CRITTER.frames[0].slice(0, 14).concat(['...eee....eee...', '...eee....eee...']));
  var GEAR0 = ['..y..', '.yyy.', 'yyWyy', '.yyy.', '..y..'];             /* gear with no overlay yet: a small ✦ where it sits */
  function isMascot(id) { return typeof id === 'string' && own(PETCOL3, id); }
  function petPal(id, pal) {
    var c = own(PETCOL3, id) ? PETCOL3[id] : own(PETCOL, id) ? PETCOL[id] : PETCOL.pet_puppy;
    return palOf(pal, id, { b: c.body.toLowerCase(), e: c.dark.toLowerCase(), l: c.light.toLowerCase(), n: c.nose.toLowerCase(), k: '#2b2140', w: '#ffffff' });
  }
  function anchorsOf(id) {
    var s = pixOf(id), base = !own(PETCOL, id) && (isMascot(id) || (s && s.frames)) ? CRITTER.anchors : ANCHOR454, out = {};      /* the vector body (V4.54 pets, unknown ids) or a pixel sprite */
    SLOTS.forEach(function (k) { out[k] = (s && s.anchors && s.anchors[k]) || base[k]; });
    return out;
  }
  function isGear(accId) { return typeof accId === 'string' && !!accId && !own(ACC_SLOT, accId); }
  function slotOf(accId) { var s = pixOf(accId), it = own(ACC_SLOT, accId) ? null : coreItem(accId); return own(ACC_SLOT, accId) ? ACC_SLOT[accId] : (s && s.slot) || (it && SLOTS.indexOf(it.slot) >= 0 && it.slot) || 'hat'; }
  /* a pix overlay at a slot anchor (A = anchorsOf the wearer) */
  function gearPix(accId, slot, A) {
    var s = pixOf(accId), mine = s && s.rows && !s.tile, rows = mine ? s.rows : GEAR0, pal = mine ? palOf(s.pal) : { y: '#ffd23f', W: '#ffffff' };
    var at = (mine && s.at) || [rows[0].length / 2, slot === 'hat' ? rows.length : rows.length / 2];
    return '<g shape-rendering="crispEdges">' + pix(rows, pal, PETU, PETX + PETU * (A[slot][0] - at[0]), PETY + PETU * (A[slot][1] - at[1])) + '</g>';
  }
  function landGear(accId, slot, A, last) { var s = isGear(accId) ? pixOf(accId) : null; return isGear(accId) && (slot !== 'back' || !!(s && s.over) === !!last) ? gearPix(accId, slot, A) : ''; }
  /* an accessory on a mascot: land gear as its overlay, a V4.54 one moved to the mascot's anchors */
  function wear(accId, slot, A, front) {
    if (typeof accId !== 'string' || !accId) return '';
    if (!own(ACC_SLOT, accId)) return landGear(accId, slot, A, front);
    function moved(art, s) { return '<g transform="translate(' + n1(PETU * (A[s][0] - ANCHOR454[s][0])) + ' ' + n1(PETU * (A[s][1] - ANCHOR454[s][1])) + ')">' + art + '</g>'; }
    if (ACC_SLOT[accId] !== slot) return '';
    if (accId === 'acc_hoodie') return front ? moved(ACC2D.drawstrings, 'neck') : moved(ACC2D.hood, 'hat');     /* the hood behind, its strings in front */
    return slot === 'back' && front ? '' : moved(ACC454[accId](88, 42), slot);
  }
  function mascot(id, opts) { return svg(120, 100, mascotBody(id, opts)); }
  function mascotBody(id, opts) {
    var s = pixOf(id), S = s && s.frames ? s : CRITTER, acc = opts.acc || {}, A = anchorsOf(id);
    return '<ellipse cx="60" cy="94" rx="30" ry="5" fill="rgba(40,30,60,0.18)"/>' + wear(acc.back, 'back', A, false) +
      '<g shape-rendering="crispEdges">' + pix(S.frames[opts.frame && S.frames.length > 1 ? 1 : 0], petPal(id, S === s ? s.pal : null), PETU, PETX, PETY) + '</g>' +
      wear(acc.back, 'back', A, true) + wear(acc.neck, 'neck', A) + wear(acc.face, 'face', A) + wear(acc.hat, 'hat', A);
  }
  /* the LED tower's 8 × 8 head of a mascot (the V4.54 pets keep PIX_PETS) */
  function headOf(id) {
    var s = pixOf(id);
    if (typeof id !== 'string' || own(PETCOL, id)) return null;
    return s && s.head ? { rows: s.head, pal: petPal(id, s.pal) } : isMascot(id) ? { rows: CRITTER.head, pal: petPal(id) } : null;
  }

  /* ---------------- the 30 first v3 ids: hand-authored pix sprites (D35) ----------------
     PU units a pixel, so a cell column is 20 pixels; things stand on pixel row 27 (1-row
     footprints), 42 (2 rows) or as noted. draw(b, a, f, st) paints three layers — b behind, a the
     act group, f in front — and may return [x, y, w, h] (units): an unpainted rect that sets the
     act group's box, because island-pixel.css moves a group by percentages of its own box (a
     rider's whole trip up a slide, a basket's rise, the penguins' waddle).
     anim: the ACT_INFO class of an act that has no CSS of its own (D110). */
  var PU = 5;
  var RIDER = ['.22.', '22k2', '2222', 'mmmm'], PENGUIN = ['.PP.', 'PkWP', '1WWP', 'PWWP', '.PP.', '1..1'];
  function vr(st, n) { var v = st.variant | 0; return v > 0 && v < n ? v : 0; }
  var PXS = {
    lm_pier_wheel: { w: 300, h: 230, act: 'wheel', sh: [40, 207, 230], draw: function (b, a, f) {
      var D = [[17, 0], [12, 12], [0, 17], [-12, 12], [-17, 0], [-12, -12], [0, -17], [12, -12]], t, i;
      b.b(9, 39, 44, 2, 'n').b(9, 41, 44, 1, 'N').b(47, 31, 8, 8, 'c').b(46, 29, 10, 2, 'W').b(49, 34, 4, 5, 'o').b(47, 31, 8, 1, 'y');     /* the deck and a ticket booth */
      a.o(30, 20, 16.4, 'b', 14.4).b(15, 19, 30, 2, 'c').b(29, 5, 2, 30, 'c');
      for (t = 1; t <= 10; t++) a.b(29 - t, 19 - t, 1, 1, 'y').b(30 + t, 19 - t, 1, 1, 'y').b(29 - t, 20 + t, 1, 1, 'y').b(30 + t, 20 + t, 1, 1, 'y');
      for (i = 0; i < 8; i++) a.b(27 + D[i][0], 17 + D[i][1], 6, 6, i % 2 ? 'm' : 'p').b(29 + D[i][0], 19 + D[i][1], 2, 2, 'W');      /* 8 square gondolas, two colours in turn: a quarter turn lands on the rest pose */
      f.l(28, 21, 20, 40, 'l').l(29, 21, 21, 40, 'l').l(31, 21, 39, 40, 'l').l(30, 21, 38, 40, 'l').o(30, 20, 2.6, 'W').b(29, 19, 2, 2, 'c');
    } },
    pier_carousel: { w: 200, h: 250, act: 'ride', sh: [14, 212, 172], draw: function (b, a) {
      var x, y;
      b.b(18, 3, 4, 1, 'y').b(19, 4, 2, 4, 'y');
      for (y = 0; y < 9; y++) for (x = 17 - 2 * y; x < 23 + 2 * y; x++) b.b(x, 8 + y, 1, 1, ((x + 2) >> 2) % 2 ? 'W' : 'c');                 /* the striped top */
      for (x = 1; x < 39; x++) if (x % 4) b.b(x, 17, 1, 1, ((x + 2) >> 2) % 2 ? 'W' : 'c');
      for (x = 2; x < 38; x += 4) b.b(x, 18, 1, 1, '4');
      b.b(18, 18, 4, 21, 'W').b(18, 22, 4, 2, 'b').b(18, 30, 4, 2, 'b').b(7, 18, 1, 20, 'y').b(32, 18, 1, 20, 'y');
      b.b(2, 39, 36, 3, 'c').b(3, 38, 34, 1, 'b').b(3, 42, 34, 1, 'c').b(6, 40, 2, 1, 'y').b(19, 40, 2, 1, 'y').b(32, 40, 2, 1, 'y');
      a.s(2, 26, ['.....bb...', 'b...bbbb..', 'bb.bbbbkb.', '.bbbbbbbbb', '..bWWWWb..']).s(27, 25, ['..gggggg..', '.gGgGgGghh', 'ggggggghkh', '.ggggggg..', '.h..h..h..']);   /* a dolphin, a turtle, */
      a.s(17, 27, ['.ppp..', 'ppkpp.', '.ppppp', '.ppp..', 'ppppy.', '.pppy.', '..ppp.', '...pp.', '..pp..']);                                    /* a seahorse */
    } },
    pier_helter: { w: 100, h: 170, act: 'slide', sh: [16, 137, 68], draw: function (b, a) {
      var x, y, x0;
      for (y = 8; y < 28; y++) { x0 = y < 14 ? 6 : y < 21 ? 5 : 4; for (x = x0; x < 20 - x0; x++) b.b(x, y, 1, 1, (x >> 1) % 2 ? 'W' : 'c'); }
      b.t(4, 7, 12, 'l').b(9, 0, 1, 2, 'o').b(10, 0, 3, 2, 'y').b(4, 7, 12, 1, 'W');
      for (x = 0; x < 12; x++) b.b(5 + x, 10 + (x >> 2), 1, 2, 'y').b(15 - x, 14 + (x >> 2), 1, 2, 'y').b(3 + x, 18 + (x >> 1), 1, 2, 'y');   /* the slide winds round in three turns */
      b.b(15, 24, 4, 2, 'y').b(15, 26, 2, 2, 'W').b(17, 26, 2, 2, 'c');
      a.s(15, 20, RIDER);
      return [15, 10, 75, 110];
    } },
    pier_beachhut: { w: 100, h: 170, act: 'open', sh: [12, 137, 76], draw: function (b, a, f, st) {
      var v = 'bcmy'.charAt(vr(st, 4)), x;
      b.t(2, 13, 16, v).b(2, 13, 16, 1, 'W').b(9, 3, 1, 3, 'o').b(10, 3, 3, 2, v === 'y' ? 'c' : 'y');
      for (x = 3; x < 17; x++) b.b(x, 14, 1, 14, (x - 3) % 4 < 2 ? v : 'W');
      b.b(7, 18, 6, 10, 'o').b(6, 17, 8, 1, 'W');
      if (st.lit) { b.s(8, 23, ['.cc.', 'cWyc', 'cyWc', '.cc.']); a.b(5, 18, 2, 10, 'n').b(13, 18, 2, 10, 'n').b(5, 18, 1, 10, 'N').b(14, 18, 1, 10, 'N'); }   /* doors open on a beach ball */
      else a.b(7, 18, 3, 10, 'n').b(10, 18, 3, 10, 'N').b(9, 23, 1, 1, 'k').b(10, 23, 1, 1, 'k');
    } },
    lm_jungle_treehouse: { w: 300, h: 330, act: 'lift', sh: [60, 306, 180], draw: function (b, a) {
      var x;
      b.o(30, 13, 14, 'g').o(16, 20, 9, 'G').o(44, 20, 9, 'G').o(30, 22, 10, 'G').o(25, 7, 6, 'h').o(38, 11, 4, 'h').b(15, 17, 2, 2, 'F').b(44, 14, 2, 2, 'F').b(34, 3, 2, 2, 'X');
      b.b(13, 38, 34, 1, 'e').b(9, 48, 42, 1, 'e');
      for (x = 0; x < 5; x++) b.b(13 + x * 8, 38, 1, 3, 'e').b(9 + x * 10, 48, 1, 3, 'e');
      b.b(46, 38, 1, 3, 'e').b(50, 48, 1, 3, 'e').b(26, 24, 8, 38, 'r').b(27, 24, 2, 38, 'R').b(23, 59, 14, 3, 'r').b(28, 55, 4, 7, 'k');
      b.b(17, 31, 26, 2, 'R').b(13, 41, 34, 2, 'R').b(9, 51, 42, 2, 'R').l(25, 46, 16, 43, 'r').l(34, 46, 43, 43, 'r').l(25, 57, 13, 53, 'r').l(34, 57, 46, 53, 'r');   /* three decks */
      b.b(22, 24, 16, 7, 'n').b(22, 27, 16, 1, 'N').b(28, 26, 4, 5, 'r').b(23, 25, 3, 3, 'L').b(34, 25, 3, 3, 'L').t(19, 23, 22, 't').b(19, 23, 22, 1, 'T').b(40, 39, 2, 2, 'L').b(11, 49, 2, 2, 'L');
      b.b(43, 53, 1, 9, 'e').b(46, 53, 1, 9, 'e').b(44, 54, 2, 1, 'e').b(44, 56, 2, 1, 'e').b(44, 58, 2, 1, 'e').b(44, 60, 2, 1, 'e');
      b.b(5, 33, 13, 1, 'r').b(8, 34, 1, 20, 'e');                                               /* the pulley lift */
      a.b(8, 54, 1, 2, 'e').s(5, 56, ['e.....e', 'ttttttt', 'tTtTtTt', 'ttttttt', '.TTTTT.']);
      return [25, 230, 35, 75];
    } },
    jungle_stilthut: { w: 100, h: 170, act: 'glow', anim: 'none', sh: [16, 137, 68], draw: function (b, a, f, st) {
      var v = vr(st, 3), on = st.lit ? 'L' : 'H';
      b.b(4, 20, 2, 8, 'r').b(14, 20, 2, 8, 'r').b(2, 19, 16, 1, 'R').b(9, 20, 1, 8, 'e').b(11, 20, 1, 8, 'e').b(10, 21, 1, 1, 'e').b(10, 23, 1, 1, 'e').b(10, 25, 1, 1, 'e');
      b.b(4, 12, 12, 7, 'n').b(4, 15, 12, 1, 'N').b(8, 14, 4, 5, 'r').t(1, 11, 18, v === 1 ? 'g' : 't').b(1, 11, 18, 1, v === 1 ? 'G' : 'T');
      if (v === 1) b.b(6, 7, 2, 1, 'h').b(11, 5, 2, 1, 'h').b(13, 9, 2, 1, 'h');
      if (v === 2) b.b(8, 2, 4, 1, 'F').b(6, 4, 2, 1, 'F').b(12, 4, 2, 1, 'F').b(9, 3, 2, 1, 'y');
      a.b(5, 13, 2, 3, on).b(13, 13, 2, 3, on);
      if (st.lit) a.b(4, 12, 1, 1, '4').b(7, 12, 1, 1, '4').b(12, 12, 1, 1, '4').b(15, 12, 1, 1, '4');
    } },
    jungle_vineswing: { w: 100, h: 170, act: 'swing', anim: 'swing', sh: [8, 137, 80], draw: function (b, a) {
      b.b(3, 6, 3, 22, 'r').b(4, 6, 1, 22, 'R').b(3, 5, 15, 2, 'r').b(2, 26, 5, 2, 'r').o(5, 4, 4, 'g').o(12, 3, 3, 'G').o(17, 4, 2.6, 'g').b(4, 1, 2, 1, 'h').b(11, 1, 2, 1, 'h');
      a.b(10, 7, 1, 14, 'G').b(14, 7, 1, 14, 'G').b(8, 21, 9, 2, 'R').b(9, 11, 1, 1, 'h').b(15, 15, 1, 1, 'h');
    } },
    jungle_falls: { w: 200, h: 170, act: 'splash', anim: 'pop', sh: [4, 137, 192], draw: function (b, a) {
      b.b(3, 10, 14, 18, 'M').b(1, 16, 4, 12, 'M').b(17, 14, 5, 14, 'M').b(3, 9, 14, 2, 'g').b(1, 15, 3, 2, 'g').b(17, 13, 5, 2, 'g').b(4, 8, 4, 1, 'h').b(14, 14, 1, 6, 'G').b(5, 19, 1, 5, 'G');
      b.b(7, 11, 6, 13, 'E').b(8, 11, 1, 13, 'W').b(11, 13, 1, 9, 'W').b(6, 23, 31, 5, 'E').b(5, 24, 33, 3, 'E').b(36, 23, 3, 2, 'M').b(24, 22, 4, 2, 'M').b(24, 21, 2, 1, 'g');
      b.b(20, 25, 6, 1, 'W').b(29, 24, 4, 1, 'W').b(31, 26, 4, 1, 'W');
      a.s(5, 19, ['.W..W.W..', 'W.WW.WW.W', '.WWWWWWW.']);
    } },
    lm_treetop_lookout: { w: 300, h: 330, act: 'zip', sh: [40, 306, 250], draw: function (b, a) {
      var y;
      b.b(9, 40, 4, 22, 'd').t(0, 46, 22, 'v').t(1, 36, 20, 'V').t(3, 27, 16, 'v').t(5, 20, 12, 'V').b(8, 16, 3, 1, 'u').b(5, 24, 3, 1, 'u').b(3, 33, 4, 1, 'u').b(2, 43, 4, 1, 'u');   /* the old pine */
      b.b(14, 24, 2, 38, 'd').b(32, 24, 2, 38, 'd').b(14, 36, 20, 1, 'd').b(14, 48, 20, 1, 'd').l(16, 37, 31, 47, 'D').l(31, 37, 16, 47, 'D').l(16, 49, 31, 60, 'D').l(31, 49, 16, 60, 'D');
      b.b(22, 24, 1, 38, 'e').b(25, 24, 1, 38, 'e');
      for (y = 26; y < 61; y += 3) b.b(23, y, 2, 1, 'e');
      b.b(10, 22, 28, 2, 'D').b(10, 24, 28, 1, 'd').b(10, 18, 28, 1, 'e').b(10, 18, 1, 4, 'e').b(19, 18, 1, 4, 'e').b(28, 18, 1, 4, 'e').b(37, 18, 1, 4, 'e');
      b.b(13, 11, 1, 7, 'd').b(34, 11, 1, 7, 'd').b(9, 9, 30, 2, 'v').b(12, 7, 24, 2, 'V').b(16, 5, 16, 2, 'v').b(21, 3, 6, 2, 'V').b(24, 0, 1, 3, 'd').b(25, 0, 5, 3, 'f').b(26, 1, 1, 1, 'W');
      b.l(37, 19, 55, 45, 'e').b(54, 45, 2, 17, 'd').b(51, 50, 8, 1, 'D').b(52, 51, 1, 3, 'd').b(57, 51, 1, 3, 'd');   /* the zip line and its landing post */
      a.b(36, 19, 1, 2, 'e').s(34, 21, RIDER);
      return [170, 95, 53, 104];
    } },
    treetop_bridge: { w: 200, h: 170, act: 'wobble', sh: [6, 137, 188], draw: function (b, a) {
      var i, y;
      b.b(2, 12, 3, 16, 'd').b(35, 12, 3, 16, 'd').b(1, 11, 5, 1, 'D').b(34, 11, 5, 1, 'D').l(4, 13, 12, 16, 'e').l(12, 16, 27, 16, 'e').l(27, 16, 35, 13, 'e');
      for (i = 0; i < 7; i++) { y = 21 + [0, 1, 2, 2, 2, 1, 0][i]; a.b(6 + i * 4, y, 3, 2, 'D').b(6 + i * 4, y + 1, 3, 1, '9').b(7 + i * 4, 15 + (i === 0 || i === 6 ? 0 : 1), 1, y - 15, 'x'); }
    } },
    treetop_net: { w: 200, h: 250, act: 'bounce', anim: 'hop', sh: [2, 212, 196], draw: function (b, a, f) {
      var x, y, hw;
      b.b(5, 9, 3, 22, 'd').b(32, 9, 3, 22, 'd').t(3, 9, 7, 'v').t(30, 9, 7, 'v').b(5, 5, 3, 1, 'u').b(32, 5, 3, 1, 'u');
      for (y = 18; y < 32; y++) { hw = 13 + Math.floor((y - 18) / 3); for (x = 20 - hw; x < 20 + hw; x++) a.b(x, y, 1, 1, (y - 18) % 3 === 0 || (x + 40) % 4 === 0 ? 'e' : 'x'); }
      f.b(1, 20, 3, 23, 'd').b(36, 20, 3, 23, 'd').t(-1, 20, 7, 'V').t(34, 20, 7, 'V').b(1, 16, 3, 1, 'u').b(36, 16, 3, 1, 'u');
    } },
    treetop_platform: { w: 100, h: 170, act: 'climb', anim: 'hop', sh: [14, 137, 72], draw: function (b, a, f, st) {
      b.b(8, 12, 4, 16, 'd').b(9, 12, 1, 16, 'A');
      if (vr(st, 2)) b.o(10, 8, 7.4, 'O').o(5, 11, 4, 'O').o(15, 11, 4, 'O').o(8, 5, 3.2, 'U').b(13, 9, 2, 2, 'X').b(4, 11, 2, 1, 'U');
      else b.t(1, 14, 18, 'v').t(3, 9, 14, 'V').t(5, 5, 10, 'v').b(7, 7, 3, 1, 'u').b(5, 12, 3, 1, 'u').b(9, 2, 2, 1, 'u');
      b.b(3, 19, 14, 2, 'D').b(3, 21, 14, 1, 'd').l(4, 22, 8, 26, 'd').l(15, 22, 11, 26, 'd').b(3, 16, 1, 3, 'e').b(16, 16, 1, 3, 'e').b(3, 16, 5, 1, 'e').b(12, 16, 5, 1, 'e');
      a.b(14, 11, 1, 8, 'e').b(15, 11, 4, 3, 'c').b(16, 12, 1, 1, 'W');
    } },
    lm_castle_keep: { w: 400, h: 310, act: 'drawbridge', sh: [6, 287, 388], draw: function (b, a, f, st) {
      var x, y;
      [24, 46].forEach(function (tx) { b.b(tx, 12, 10, 20, 'Q').b(tx + 7, 12, 3, 20, 'z').t(tx - 1, 11, 12, 'a').b(tx + 5, 2, 1, 4, 'J').b(tx + 6, 2, 4, 2, 'c').b(tx + 3, 17, 2, 4, 'L'); });   /* the far towers */
      b.b(12, 28, 56, 30, 'q');
      for (x = 13; x < 67; x += 6) b.b(x, 25, 4, 3, 'q');
      for (y = 33; y < 57; y += 5) for (x = 12; x < 68; x++) b.b(x, y, 1, 1, 'Q');
      for (y = 28; y < 57; y += 5) for (x = 16 + (y % 2) * 4; x < 68; x += 8) b.b(x, y + 1, 1, 4, 'Q');
      [2, 64].forEach(function (tx) {                                                             /* the near towers */
        b.b(tx, 16, 14, 42, 'q').b(tx + 10, 16, 4, 42, 'Q').b(tx - 1, 14, 16, 3, 'q').b(tx - 1, 11, 4, 3, 'q').b(tx + 5, 11, 4, 3, 'q').b(tx + 11, 11, 4, 3, 'Q');
        b.b(tx + 5, 22, 3, 5, 'L').b(tx + 5, 44, 3, 5, 'J').b(tx + 7, 3, 1, 8, 'J').b(tx + 8, 3, 5, 3, 'c');
        if (st.lit) b.b(tx + 3, 30, 7, 11, 'a').b(tx + 5, 33, 3, 3, 'y').b(tx + 6, 41, 1, 1, 'a'); else b.b(tx + 5, 30, 3, 3, 'a');   /* banners up when the bridge is down */
      });
      b.b(32, 35, 16, 23, 'j').b(34, 37, 12, 21, 'J').b(32, 35, 1, 1, 'q').b(47, 35, 1, 1, 'q').b(34, 37, 1, 1, 'j').b(45, 37, 1, 1, 'j');
      if (st.lit) { b.b(35, 38, 10, 4, 'z').b(36, 42, 1, 2, 'z').b(39, 42, 2, 2, 'z').b(43, 42, 1, 2, 'z'); a.b(33, 56, 14, 6, 'A').b(33, 58, 14, 1, 'o').b(33, 61, 14, 1, 'o').b(32, 56, 1, 6, 'J').b(47, 56, 1, 6, 'J'); }
      else { a.b(34, 38, 12, 20, 'A').b(34, 42, 12, 1, 'o').b(34, 47, 12, 1, 'o').b(34, 52, 12, 1, 'o'); b.l(33, 37, 29, 31, 'J').l(46, 37, 50, 31, 'J'); }
    } },
    castle_wall: { w: 100, h: 170, act: 'knock', anim: 'none', sh: [0, 138, 100], draw: function (b, a, f, st) {
      var v = vr(st, 3), x;
      b.b(0, 16, 20, 12, 'q').b(0, 27, 20, 1, 'z').b(0, 19, 20, 1, 'Q').b(0, 23, 20, 1, 'Q').b(5, 16, 1, 3, 'Q').b(14, 16, 1, 3, 'Q').b(9, 20, 1, 3, 'Q').b(18, 20, 1, 3, 'Q').b(3, 24, 1, 3, 'Q').b(12, 24, 1, 3, 'Q');
      for (x = 1; x < 20; x += 7) b.b(x, 12, 4, 4, 'q').b(x + 3, 12, 1, 4, 'Q');
      if (v === 1) b.s(0, 12, ['gg', 'ggg', '.gg', 'ggh', '.g', 'gg', '.g']).s(15, 12, ['.ggg', 'gg.g', '.hg', '..g', '..gg']);
      if (v === 2) b.b(8, 9, 4, 3, 'c').b(7, 8, 6, 1, 'c').b(8, 6, 1, 2, 'g').b(11, 6, 1, 2, 'g').b(7, 4, 2, 2, 'F').b(11, 4, 2, 2, 'y').b(9, 3, 2, 2, 'p');
      a.b(10, 20, 8, 3, 'j');                                                                     /* the stone that knocks */
    } },
    castle_maypole: { w: 100, h: 170, act: 'dance', anim: 'hop', sh: [22, 137, 56], draw: function (b, a) {
      b.o(10, 28, 5.6, 'O').b(0, 28, 20, 6, '.').b(9, 5, 2, 20, 'W').b(9, 9, 2, 1, 'Z').b(9, 15, 2, 1, 'Z').b(9, 21, 2, 1, 'Z');
      a.l(9, 6, 1, 25, 'c').l(9, 6, 4, 26, 'y').l(9, 6, 7, 26, 'b').l(10, 6, 18, 25, 'm').l(10, 6, 15, 26, 'p').l(10, 6, 12, 26, 'l');
      a.b(6, 3, 8, 3, 'y').b(7, 2, 2, 1, 'F').b(11, 2, 2, 1, 'c').b(9, 1, 2, 2, 'p').b(5, 4, 1, 1, 'g').b(14, 4, 1, 1, 'g');
    } },
    castle_feast: { w: 200, h: 170, act: 'serve', anim: 'pop', sh: [12, 137, 176], draw: function (b, a) {
      b.b(5, 21, 2, 7, 'A').b(33, 21, 2, 7, 'A').b(3, 19, 34, 2, 'A').b(4, 19, 32, 1, 'c').b(4, 20, 32, 1, 'W').b(7, 25, 26, 1, 'A').b(9, 26, 1, 2, 'A').b(30, 26, 1, 2, 'A');
      a.s(5, 15, ['.tttt.', 'tctctt', 'TTTTTT', '.qqqq.']).s(14, 14, ['.cyg.', 'cygcy', 'qqqqq', '.qqq.', '..q..']).s(22, 13, ['..c..', '.WWW.', '.ppp.', 'WWWWW', 'ppppp', 'ppppp']).s(30, 15, ['y.y', 'yyy', '.y.', 'yyy']);
    } },
    lm_ice_igloo: { w: 300, h: 230, act: 'penguins', sh: [2, 206, 250], draw: function (b, a) {
      var x, y;
      b.o(27, 42, 22, 'w').b(0, 42, 60, 4, '.');
      for (y = 25; y < 42; y += 5) { b.b(0, y, 60, 1, 'Z', 'w'); for (x = 8 + (y % 2) * 4; x < 50; x += 8) b.b(x, y + 1, 1, 4, 'Z', 'w'); }
      b.b(18, 21, 8, 1, 'W', 'w').b(0, 40, 60, 2, 'i', 'w').b(27, 13, 1, 7, 'J').b(28, 13, 5, 3, 'c').b(29, 14, 1, 1, 'W');
      b.o(40, 42, 9, 'S').o(40, 42, 7.4, 'i').o(40, 42, 5.4, 'L').b(0, 42, 60, 4, '.');          /* the way in: an ice arch, warm inside */
      for (y = 0; y < 9; y++) b.b(1, 33 + y, 3 + y, 1, 'i').b(3 + y, 33 + y, 1, 1, 'W');          /* the belly-slide ramp */
      a.s(45, 36, PENGUIN).s(50, 35, PENGUIN).s(55, 36, PENGUIN);
      return [85, 155, 210, 55];
    } },
    ice_snowhut: { w: 100, h: 170, act: 'glow', anim: 'none', sh: [4, 137, 92], draw: function (b, a, f, st) {
      var v = vr(st, 3);
      b.o(10, 28, 9.7, 'w').b(0, 28, 20, 6, '.').b(0, 21, 20, 1, 'Z', 'w').b(0, 24, 20, 1, 'Z', 'w').b(10, 18, 1, 3, 'Z', 'w').b(5, 22, 1, 2, 'Z', 'w').b(14, 22, 1, 2, 'Z', 'w').b(2, 25, 1, 3, 'Z', 'w').b(17, 25, 1, 3, 'Z', 'w').b(0, 27, 20, 1, 'i', 'w');
      if (v === 1) b.b(4, 18, 12, 1, 'W').b(5, 16, 10, 2, 'W').b(7, 15, 6, 1, 'W').b(3, 19, 2, 1, 'W').b(15, 19, 2, 1, 'W').b(6, 17, 3, 1, 'S');
      if (v === 2) b.b(10, 10, 1, 9, 'J').b(11, 10, 5, 4, 'c').b(12, 11, 2, 2, 'W');
      a.o(10, 28, 4.6, 'I').o(10, 28, 3.3, st.lit ? 'L' : 'B').b(0, 28, 20, 6, '.');
      if (st.lit) a.b(9, 20, 2, 1, '4').b(4, 25, 1, 1, '4').b(15, 25, 1, 1, '4');
    } },
    ice_slide: { w: 200, h: 170, act: 'slide', sh: [4, 137, 192], draw: function (b, a) {
      var y, hw, k;
      for (y = 8; y < 28; y++) { hw = 7 + Math.round((y - 8) * 0.62); b.b(20 - hw, y, 2 * hw, 1, y > 25 ? 'S' : 'w'); }
      for (y = 9; y < 28; y++) { hw = 3 + Math.round((y - 9) * 0.2); b.b(20 - hw, y, 2 * hw, 1, 'i').b(20 - hw, y, 1, 1, 'I').b(19 + hw, y, 1, 1, 'I'); }
      for (k = 0; k < 6; k++) b.b(4 + k * 2, 25 - k * 3, 4, 1, 'Z').b(30 - k * 2 + 2, 25 - k * 3, 4, 1, 'Z');
      b.b(19, 11, 1, 5, 'W').b(21, 17, 1, 6, 'W').b(12, 4, 1, 4, 'J').b(13, 4, 3, 2, 'c').b(27, 4, 1, 4, 'J').b(24, 4, 3, 2, 'y').b(13, 8, 14, 1, 'S');
      a.s(18, 24, RIDER);
      return [60, 45, 80, 95];
    } },
    ice_rink: { w: 200, h: 250, act: 'skate', sh: [0, 0, 0], draw: function (b, a) {
      var y, t, hw;
      for (y = 21; y < 44; y++) { t = (y - 32) / 11.5; hw = Math.round(19 * Math.sqrt(Math.max(0, 1 - t * t))); b.b(20 - hw, y, 2 * hw, 1, y > 41 ? 'S' : 'w'); if (hw > 3) b.b(22 - hw, y, 2 * hw - 4, 1, 'I'); }
      b.b(0, 21, 40, 2, '.').b(0, 42, 40, 2, 'S', 'I').l(9, 31, 14, 27, 'i').l(10, 31, 15, 27, 'i').l(24, 38, 30, 35, 'i').b(18, 25, 5, 1, 'W').b(8, 35, 4, 1, 'W').b(27, 29, 4, 1, 'W');
      b.b(6, 17, 1, 7, 'J').b(7, 17, 4, 3, 'c').b(33, 17, 1, 7, 'J').b(29, 17, 4, 3, 'y');
      a.s(18, 28, ['.PP.', 'PWkP', 'PWW1', 'cccP', 'PWWP', '1..1']);
      return [15, 110, 170, 100];
    } }
  };
  /* the five first paths: flat 12 × 12 ground tiles */
  var TILES = {
    path_pier: ['777777777777', '777777777778', '888888888888', '777777877777', '777777877777', '888888888888', '777777777777', '777o77777o77', '888888888888', '778777777777', '778777777777', '888888888888'],
    path_logs: ['...RRRR.....', '..RRrrRR....', '..RreerR.RR.', '..RRrrRRRRRR', '...RRRRRreRR', '.........RRR', '.RRRR.......', 'RRrrRR..RRR.', 'RreerR.RRrRR', 'RRrrRR.RreRR', '.RRRR..RRrRR', '........RRR.'],
    path_bark: ['KKKKKKKKKKKK', 'KYYKKKKdKKKK', 'KKKKKYYKKKKK', 'KKdKKKKKKKYK', 'KKKKKKKdKKKK', 'YKKKKYKKKKKK', 'KKKKKKKKKdYK', 'KKKYYKKKKKKK', 'KdKKKKKKYYKK', 'KKKKKdKKKKKK', 'KKYKKKKKKKdK', 'KKKKKKKYKKKK'],
    path_cobble: ['ssssssssssss', 'sCCCsQQQQsCC', 'sCCCsQQQQsCC', 'ssssssssssss', 'QQsCCCCsQQQs', 'QQsCCCCsQQQs', 'ssssssssssss', 'sCCCCsQQsCCC', 'sCCCCsQQsCCC', 'ssssssssssss', 'QQQsCCCsQQsC', 'QQQsCCCsQQsC'],
    path_ice: ['wwwwwwwwwwww', 'wIIIIIwIIIII', 'wIiIIIwIIIiI', 'wIIIIIwIIIII', 'wIIIIIwIIIII', 'wIIIIIwIIIII', 'wwwwwwwwwwww', 'IIIwIIIIIwII', 'IiIwIIiIIwII', 'IIIwIIIIIwII', 'IIIwIIIIIwII', 'IIIwIIIIIwII']
  };
  /* a blocky ground shadow: sh = [x, y, w] */
  function pxShadow(x, y, w) { return '<path d="' + rectD(x, y, w, 8) + rectD(x + 8, y + 8, w - 16, 5) + '" fill="rgba(40,30,60,0.18)"/>'; }
  function pxSprite(id, st) {
    var S = PXS[id], gw = S.w / PU, gh = S.h / PU, b = new Grid(gw, gh), a = new Grid(gw, gh), f = new Grid(gw, gh), sp = S.draw(b, a, f, st);
    return { w: S.w, h: S.h, svg: svg(S.w, S.h, '<g shape-rendering="crispEdges">' + (S.sh[2] ? pxShadow(S.sh[0], S.sh[1], S.sh[2]) : '') + pix(b.rows(), PXC, PU) +
      '<g class="slw-act slw-act-' + S.act + (S.anim ? ' slw-anim-' + S.anim : '') + '">' + (sp ? '<rect x="' + sp[0] + '" y="' + sp[1] + '" width="' + sp[2] + '" height="' + sp[3] + '" fill="none"/>' : '') + pix(a.rows(), PXC, PU) + '</g>' +
      pix(f.rows(), PXC, PU) + '</g>') };
  }
  /* every v3 id (and anything unknown): its pix sprite, its tile, its pictogram block, else the generic block */
  var NONPLACE = /^(wall|roof|door|detail|shape|pet|acc|land|ball|stadium|kart|track|course)_/;
  var PATH454 = { path_stone: 1, path_wood: 1, path_flower: 1 };
  function isPath3(id) { var it; return !own(PATH454, id) && (own(TILES, id) || !!(pixOf(id) && pixOf(id).tile && pixOf(id).rows) || !!((it = coreItem(id)) && it.isle && it.kind === 'path')); }
  function sprite3(id, st) {
    if (typeof id !== 'string' || !id) return null;
    if (own(PXS, id)) return pxSprite(id, st);
    var spec = pixOf(id), it, cols;
    if (own(TILES, id)) return tileSprite(TILES[id], PXC);
    if (spec && spec.tile && spec.rows) return tileSprite(spec.rows, palOf(spec.pal));
    it = coreItem(id);
    if (NONPLACE.test(id) || (it && !it.fp)) return null;
    if (it && it.kind === 'path') { cols = lookPair(id, st); return tileSprite(TILE0, { a: cols[0], b: cols[1] }); }
    return blockSprite(id, st, spec && spec.rows ? spec : null);
  }

  /* ---------------- the shop-card pictures of land things (look fix) ----------------
     A footprint-sized block left a 1 × 1 thing's picture 25-40 px wide in a shop card, and land
     gear was a speck on the vector puppy. So ART.icon draws these on a square card plate
     instead (sprite() and the 2D island are unchanged):
       a registered pictogram  on its block's plate colour (the main colour 88% to white, warm
                               while lit: world-art-lands' legibility test is measured on it),
                               floor(76 / rows) units a pixel: in a card well about twice the
                               size a 1 × 1 block gave it, and bigger for every footprint
       a path tile             filling the plate, so it matches the cards beside it
       a 1 × 1 pix sprite      cropped to its own pixels, standing on a sky plate (on a pale
                               plate the snow hut and the white stripes would vanish); a tall
                               one pops out over the plate's top edge
       a piece of land gear    worn by its land's mascot, cropped close (no plate: it stands on
                               the card's plinth like the mascots' own cards)
     The plate fills 84 of the 100 units with notched pixel corners, a 2-unit ink outline so a
     white or pale plate still reads in the white card well, and a 4-unit lip in the dark main
     colour, like the block's base. They are still pictures: no act group. */
  var CARD_SKY = '#8fd9ff';
  function cardPlate(fill, lip, lit) {
    return box(10, 8, 80, 84, INK) + box(8, 10, 84, 80, INK) + box(10, 10, 80, 76, fill) + box(10, 86, 80, 4, lip) +
      (lit ? box(10, 10, 4, 4, '#ffffff') + box(86, 10, 4, 4, '#ffffff') + box(10, 82, 4, 4, '#ffffff') + box(86, 82, 4, 4, '#ffffff') : '');
  }
  function card(inner) { return svg(100, 100, '<g shape-rendering="crispEdges">' + inner + '</g>'); }
  function lipOf(id, st) { return mixc(lookPair(id, st)[0], '#2b2140', 0.22); }
  function pictoCard(id, st, spec) {
    var info = infoOf(coreItem(id)), lit = !!(st.lit && info && info.toggle), main = lookPair(id, st)[0];
    var rows = (lit && spec.on) || spec.rows, pal = palOf(lit && spec.lit ? palOf(spec.lit, null, spec.pal) : spec.pal), u = Math.floor(76 / Math.max(rows.length, rows[0].length));
    return card(cardPlate(lit ? '#ffe9a8' : mixc(main, '#ffffff', 0.88), lipOf(id, st), lit) + pix(rows, pal, u, (100 - rows[0].length * u) / 2, 10 + (76 - rows.length * u) / 2));
  }
  /* a path: its tile fills the plate above the lip (gaps show the plate) */
  function tileCard(id, st, rows, pal) {
    return card(cardPlate(mixc(lookPair(id, st)[0], '#ffffff', 0.88), lipOf(id, st)) + pix(rows, pal, 80 / rows[0].length, 10, 10, 76 / rows.length));
  }
  /* a 1 × 1 pix sprite: its three layers flattened and cropped to the painted cells, standing 2
     units above the lip, as big as fits 76 units across and 84 high (in half units). A tall one
     pops out over the plate's top edge rather than shrink: the card well's height is what
     limits it, and it keeps at least the size it had as the whole 100 × 170 sprite. */
  function sceneCard(id, st) {
    var S = PXS[id], gw = S.w / PU, gh = S.h / PU, G = [new Grid(gw, gh), new Grid(gw, gh), new Grid(gw, gh)], x0 = gw, y0 = gh, x1 = 0, y1 = 0, u, ox, oy;
    S.draw(G[0], G[1], G[2], st);
    G.forEach(function (g) {
      for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) if (own(PXC, g.a[j][i])) { x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1); }
    });
    if (x1 <= x0) return null;
    u = Math.floor(2 * Math.min(76 / (x1 - x0), 84 / (y1 - y0))) / 2; ox = (100 - (x0 + x1) * u) / 2; oy = 84 - y1 * u;
    return card(cardPlate(CARD_SKY, lipOf(id, st)) + G.map(function (g) { return pix(g.rows(), PXC, u, ox, oy); }).join(''));
  }
  /* land gear: worn by the land mascot whose head shows gear best, pixel on pixel (the V4.54
     puppy is vector art), cropped square to the mascot and the piece with 5 units of margin,
     feet on the card's plinth like the mascots' own cards. Alone, many pieces are half-views
     made for a head (a 2-row ring, one ear cup) and do not read. */
  var CARD_WEARER = { pier: 'pet_gull', jungle: 'pet_monkey', treetop: 'pet_squirrel', castle: 'pet_duckling', ice: 'pet_penguin' };
  function gearCard(id, wearer) {
    var s = pixOf(id), slot = slotOf(id), A = anchorsOf(wearer), S = pixOf(wearer) && pixOf(wearer).frames ? pixOf(wearer) : CRITTER, fr = S.frames[0];
    var at = s.at || [s.rows[0].length / 2, slot === 'hat' ? s.rows.length : s.rows.length / 2], gx = A[slot][0] - at[0], gy = A[slot][1] - at[1];
    var x0 = gx, y0 = gy, x1 = gx + s.rows[0].length, y1 = gy + s.rows.length, i, j, side, acc = {};
    for (j = 0; j < fr.length; j++) for (i = 0; i < fr[j].length; i++) if (fr[j].charAt(i) !== '.') { x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1); }
    side = PETU * Math.max(x1 - x0, y1 - y0) + 10;
    acc[slot] = id;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + n1(PETX + PETU * (x0 + x1) / 2 - side / 2) + ' ' + n1(PETY + PETU * y1 + 5 - side) + ' ' + n1(side) + ' ' + n1(side) + '">' + mascotBody(wearer, { acc: acc }) + '</svg>';
  }
  /* the card picture of a v3 thing, or null (V4.54 art, the bigger hand-authored sprites, a thing
     whose data has not arrived: those keep their sprite) */
  function card3(id, st) {
    var it = coreItem(id), spec = pixOf(id);
    if (it && !it.isle) return null;
    if (own(PXS, id)) return PXS[id].w === 100 && PXS[id].h === 170 ? sceneCard(id, st) : null;
    if (/^acc_/.test(id)) return isGear(id) && spec && spec.rows && !spec.tile && it && own(CARD_WEARER, it.isle) ? gearCard(id, CARD_WEARER[it.isle]) : null;
    if (own(TILES, id)) return tileCard(id, st, TILES[id], PXC);
    if (spec && spec.tile && spec.rows) return tileCard(id, st, spec.rows, palOf(spec.pal));
    if (!spec || !spec.rows || NONPLACE.test(id) || (it && (!it.fp || it.kind === 'path'))) return null;
    return pictoCard(id, st, spec);
  }

  /* ---------------- dispatch ---------------- */
  /* returns {w, h, svg} in world units, or null for non-placeable */
  function sprite(id, st) {
    st = st || {};
    if (id === 'house_cottage') return { w: 200, h: 250, svg: svg(200, 250, house(st)) };
    if (id === 'att_course') return { w: 200, h: 250, svg: svg(200, 250, courseGate(st)) };
    if (id === 'att_pitch') return { w: 300, h: 210, svg: svg(300, 210, pitch(st)) };
    if (id === 'att_kart') return { w: 200, h: 250, svg: svg(200, 250, garage(st)) };
    if (/^path_/.test(id) && !isPath3(id)) return { w: 100, h: CH, svg: svg(100, CH, pathTile(id)) };
    var bld = building(id, st, false);
    if (bld) return bld;
    var d = decor(id, st);
    if (d) return { w: 100, h: 170, svg: svg(100, 170, d) };
    return sprite3(id, st);                  /* v3 ids and unknown ids; null for the non-placeable kinds */
  }

  /* square shop icons for everything, including non-placeable kinds */
  function swatch(fill, label) {
    return svg(100, 100, '<rect x="14" y="14" width="72" height="72" rx="18" fill="' + fill + '" ' + SW + '/>' + (label || ''));
  }
  function icon(id, st) {
    st = st || {};
    if (/^wall_/.test(id)) return swatch(WALL[id] || '#eee', '<path d="M30 70 L30 46 L50 30 L70 46 L70 70 Z" fill="rgba(255,255,255,0.6)" ' + SW2 + '/>');
    if (id === 'door_glass') {
      return svg(100, 100, '<rect x="30" y="20" width="40" height="70" rx="3" fill="#5a5f72" ' + SW + '/><rect x="35" y="25" width="30" height="60" rx="2" fill="' + DOOR.door_glass + '"/>' +
        '<path d="M40 52 L52 32 M42 62 L58 36" stroke="#8fb7ff" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/><rect x="58" y="48" width="4" height="16" rx="2" fill="#e6e9f2"/>');
    }
    if (/^door_/.test(id)) return svg(100, 100, '<path d="M32 88 L32 34 Q50 14 68 34 L68 88 Z" fill="' + (DOOR[id] || '#888') + '" ' + SW + '/><circle cx="60" cy="62" r="4" fill="#ffd23f"/>');
    /* a shape previews with the default colours; roofs and details preview on the
       child's own shape (st.shape), trim 0, so no icon is personal beyond the colour */
    if (/^shape_/.test(id)) return svg(200, 250, house({ shape: id, wall: 'wall_cream', roof: 'roof_red', door: 'door_blue' }), ' preserveAspectRatio="xMidYMid meet"');
    if (/^roof_/.test(id) || /^detail_/.test(id)) {
      var sel = { wall: 'wall_cream', door: 'door_blue', roof: /^roof_/.test(id) ? id : 'roof_red', details: {}, shape: st.shape, member: st.member };
      if (/^detail_/.test(id)) sel.details[id] = true;
      return svg(200, 250, house(sel), ' preserveAspectRatio="xMidYMid meet"');
    }
    if (/^pet_/.test(id)) return pet(id, {});
    var c3 = card3(id, st);
    if (c3) return c3;                       /* v3 land things and land gear: the square card picture */
    if (/^acc_/.test(id)) {
      var a = {}; a[slotOf(id)] = id; return pet('pet_puppy', { acc: a });
    }
    if (BUILDINGS[id]) return building(id, st, true).svg;
    if (id === 'land_cove') return svg(100, 100, '<rect width="100" height="100" rx="18" fill="#4fc3f7"/><path d="M10 70 Q 30 40 60 46 Q 86 50 90 76 Q 60 90 30 88 Q 12 84 10 70 Z" fill="#f3dc9a" ' + SW + '/><path d="M60 46 C 58 34 62 26 70 22" fill="none" stroke="#a5743f" stroke-width="4"/><path d="M70 22 q -12 -4 -18 4 q 10 -2 18 -4 q 10 -6 16 2 q -8 -2 -16 -2" fill="#4fbf63" ' + SW2 + '/>');
    if (own(LAND_ISLE, id)) return svg(100, 100, '<rect width="100" height="100" rx="18" fill="#8fd9ff"/><g transform="translate(10 10) scale(4)" shape-rendering="crispEdges">' + isleIconBody(LAND_ISLE[id], false) + '</g>');
    if (id === 'land_meadow') return svg(100, 100, '<rect width="100" height="100" rx="18" fill="#4fc3f7"/><path d="M8 78 Q 30 30 54 34 Q 84 38 92 78 Q 50 92 8 78 Z" fill="#7bd88f" ' + SW + '/><circle cx="36" cy="60" r="4" fill="#ff7ab8"/><circle cx="58" cy="54" r="4" fill="#ffc93c"/><circle cx="70" cy="66" r="4" fill="#fff"/>');
    if (/^ball_/.test(id)) { var b = BALLS[id]; return svg(100, 100, '<circle cx="50" cy="52" r="30" fill="' + b[0] + '" ' + SW + '/><path d="M50 38 l12 9 l-5 14 h-14 l-5 -14 z" fill="' + b[1] + '"/>' + (id === 'ball_planet' ? '<ellipse cx="50" cy="52" rx="44" ry="10" fill="none" stroke="#ffd23f" stroke-width="5" transform="rotate(-18 50 52)"/>' : '') + (id === 'ball_rainbow' ? '<path d="M24 40 q26 -20 52 0" fill="none" stroke="#ffd23f" stroke-width="5"/><path d="M22 64 q28 20 56 0" fill="none" stroke="#7bd88f" stroke-width="5"/>' : '')); }
    if (/^stadium_/.test(id)) { var s = STADIA[id]; return svg(100, 100, '<rect x="8" y="8" width="84" height="84" rx="16" fill="' + s[0] + '" ' + SW + '/><path d="M8 66 L92 66 L92 76 Q92 92 76 92 L24 92 Q8 92 8 76 Z" fill="' + s[1] + '"/><path d="M30 66 L30 40 L70 40 L70 66" fill="none" stroke="#fff" stroke-width="4"/>' + (id === 'stadium_night' ? '<circle cx="24" cy="24" r="6" fill="#fff6a8"/><circle cx="76" cy="24" r="6" fill="#fff6a8"/>' : '') + (id === 'stadium_snow' ? '<circle cx="24" cy="30" r="3" fill="#fff"/><circle cx="60" cy="20" r="3" fill="#fff"/><circle cx="80" cy="44" r="3" fill="#fff"/>' : '')); }
    if (/^kart_/.test(id)) return svg(100, 100, '<g transform="translate(14 40)"><rect x="0" y="12" width="72" height="22" rx="10" fill="' + (KARTS[id] || '#888') + '" ' + SW + '/><path d="M18 12 l10 -12 l18 0 l6 12" fill="' + (KARTS[id] || '#888') + '" ' + SW2 + '/><circle cx="14" cy="36" r="9" fill="#3b2f4a"/><circle cx="58" cy="36" r="9" fill="#3b2f4a"/><circle cx="34" cy="4" r="7" fill="#ffd23f" ' + SW2 + '/></g>' + (id === 'kart_unicorn' ? '<path d="M50 30 l4 -16 l4 16 z" fill="#ffd23f" ' + SW2 + '/>' : '') + (id === 'kart_lime' ? '<path d="M44 54 l8 -6 l-2 6 l8 -2 l-8 8 l2 -6 z" fill="#ffd23f"/>' : ''));
    if (/^track_/.test(id)) {
      var tc = { track_loop: '#7bd88f', track_volcano: '#ff8a3d', track_beach: '#f3dc9a' }[id] || '#7bd88f';
      var d = { track_loop: 'M24 50 C24 24 76 24 76 50 C76 76 24 76 24 50 Z', track_volcano: 'M20 60 C16 30 46 18 60 30 C74 42 88 34 84 58 C80 82 50 70 40 78 C28 86 22 74 20 60 Z', track_beach: 'M18 30 L80 30 C92 30 92 46 80 46 L30 46 C18 46 18 62 30 62 L80 62 C92 62 92 78 80 78 L18 78' }[id];
      return svg(100, 100, '<rect x="6" y="6" width="88" height="88" rx="16" fill="' + tc + '" ' + SW + '/><path d="' + d + '" fill="none" stroke="#5b5670" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 6"/>');
    }
    if (/^course_/.test(id)) {
      var th = THEME[id] || THEME.course_meadow;
      return svg(100, 100, '<rect x="6" y="6" width="88" height="88" rx="16" fill="' + th[0] + '" ' + SW + '/><path d="M6 70 Q 30 56 50 66 Q 72 76 94 62 L94 78 Q94 94 78 94 L22 94 Q6 94 6 78 Z" fill="' + th[1] + '"/>' +
        '<g ' + SW2 + '><rect x="30" y="44" width="4" height="22" fill="#fff"/><rect x="50" y="44" width="4" height="22" fill="#fff"/><rect x="27" y="42" width="30" height="7" rx="3" fill="#ff6b6b"/></g><circle cx="72" cy="34" r="6" fill="#ffd23f" ' + SW2 + '/>');
    }
    var sp = sprite(id, st);
    if (sp) return sp.svg;
    return svg(100, 100, '<rect x="14" y="14" width="72" height="72" rx="18" fill="#eee"/>');
  }

  /* render a pet SVG as a data URL (for canvas games) */
  function petDataUrl(id, opts) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pet(id, opts));
  }

  /* ---------------- UI chrome icons ----------------
     An original line set on a 24 grid: 2px round strokes in currentColor, no fills,
     so a button's text colour (and .slw-ico in the CSS) styles them. Callers give
     the button its own label; the icon is aria-hidden. Unknown names return ''. */
  var UI_ICONS = {
    shop: '<path d="M5 8h14l-1.3 11.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    crew: '<path d="M8.6 19.5c-2.3 0-3.6-1.5-3-3.3.7-2.1 3.4-4.4 6.4-4.4s5.7 2.3 6.4 4.4c.6 1.8-.7 3.3-3 3.3-1.3 0-2.1-.6-3.4-.6s-2.1.6-3.4.6z"/><circle cx="5.5" cy="10" r="1.6"/><circle cx="9.5" cy="6.2" r="1.6"/><circle cx="14.5" cy="6.2" r="1.6"/><circle cx="18.5" cy="10" r="1.6"/>',
    games: '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.5 4.5v.5a3.5 3.5 0 0 1-6.3 2.1L14 14h-4l-.7 1.1A3.5 3.5 0 0 1 3 13v-.5A4.5 4.5 0 0 1 7.5 8z"/><path d="M7.5 10.2v3.6M5.7 12h3.6"/><path d="M15.5 11h.01M17.5 13h.01"/>',
    edit: '<path d="M4 20l1.2-4.4L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.4 18.8z"/><path d="M14 7l3 3"/>',
    home: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5.5h4V20"/>',
    goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
    storage: '<path d="M4 8l8-4 8 4v8.5l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8.5"/>',
    city: '<path d="M3 21h18"/><path d="M5 21v-9h4.5v9"/><path d="M9.5 21V4h6v17"/><path d="M15.5 21v-7H19v7"/><path d="M12 8h1.5M12 12h1.5M12 16h1.5"/>',
    showtime: '<path d="M18.5 15.2A7.6 7.6 0 1 1 8.8 5.5a6.2 6.2 0 0 0 9.7 9.7z"/><path d="M17.5 2.8l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"/>',
    golden: '<path d="M2.5 17.5h19"/><path d="M7 17.5a5 5 0 0 1 10 0"/><path d="M12 7.5v2.2M5.6 11.1l1.5 1.5M18.4 11.1l-1.5 1.5M3.5 14.6h1.8M18.7 14.6h1.8"/><path d="M7.5 20.5h9"/>',
    music: '<path d="M9 18V5.5l11-2.2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    rotL: '<path d="M4.5 4.5v5h5"/><path d="M4.8 9.5A7.5 7.5 0 1 1 5.2 15.6"/>',
    rotR: '<path d="M19.5 4.5v5h-5"/><path d="M19.2 9.5A7.5 7.5 0 1 0 18.8 15.6"/>',
    zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20.5 20.5"/><path d="M8 10.5h5M10.5 8v5"/>',
    zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20.5 20.5"/><path d="M8 10.5h5"/>',
    reset: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2.5"/>',
    /* v3: the island bar, signs and the light toggle */
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>',
    isles: '<path d="M3 11.5h9v2.5l-2 3.5H5l-2-3.5z"/><path d="M14 5h7v2l-1.5 2.5h-4L14 7z"/><path d="M15 15.5h5v1.5l-1 2h-3l-1-2z"/>',
    bridge: '<path d="M2 15.5h20"/><path d="M5 19V7.5M19 19V7.5"/><path d="M5 8.5q7 7.5 14 0"/><path d="M8.5 15.5v-3.6M12 15.5v-3M15.5 15.5v-3.6"/>',
    map: '<path d="M3 6.5l6-2 6 2 6-2v13l-6 2-6-2-6 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z"/>'
  };
  function uiIcon(name) {
    if (!Object.prototype.hasOwnProperty.call(UI_ICONS, name)) return '';
    return '<svg class="slw-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + UI_ICONS[name] + '</svg>';
  }

  root.SLWorldArt = { CH: CH, defs: defs, island: island, sprite: sprite, pet: pet, icon: icon, petDataUrl: petDataUrl, KARTS: KARTS, BALLS: BALLS, STADIA: STADIA, THEME: THEME, PETCOL: PETCOL,
    uiIcon: uiIcon, UI_ICON_NAMES: Object.keys(UI_ICONS), SHAPES: SHAPES, BUILDINGS: Object.keys(BUILDINGS),
    /* v3 */
    isleIcon: isleIcon, pix: pix, definePix: definePix, pixOf: pixOf, PETCOL3: PETCOL3, PET_GRID: PET_GRID, PXI: frozenCopy(PXI) };
}(typeof self !== 'undefined' ? self : this));
