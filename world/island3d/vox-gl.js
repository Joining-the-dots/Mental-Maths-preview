/* ================================================================
   My Island v3 — SLVoxGL: the browser binding of the Pixel Blocks voxels (W1.5).
   window.SLVoxGL (classic script; THREE from SL3D.THREE only); require() in Node gives the
   pure layer: BITMAPS (PIX5 5×7 font, pictograms, LED frames), the atlas packer, the shader
   patch, the D2 mode table and the v2 bone tables.
   stage.js calls SLVoxGL.bind(hub, SL3D) once SL3D is ready and again when the vox group
   arrives late (the same hub gets the same VoxHub, also left on hub.vox). K.vox (kit K5) =
   VoxHub.forTier(K.tier).

   MATERIALS (D1, D60, D61): one program family. Every vox material is a MeshLambertMaterial
   {vertexColors, toneMapped false, fog false} with the same onBeforeCompile patch,
   customProgramCacheKey 'pixel-vox' and no map (USE_MAP is never defined), registered
   through hub.defineMat (K2): 'vox' (merge class 'vox', extra ['vuv']) and 'vox:water'
   (transparent, depthWrite false, uAtlas = sky3d's static water canvas via setWater).
   K.variant('vox', 'ghost' | 'ghostBad' | 'preview' | 'shadow') get their uniforms from their
   name (VARIANTS). onShow sets uGlowMul (0.9 day → 1.25 night); dispose blanks the atlas's
   dynamic cells and frees the GPU copies (K6, K7).
   EXPOSURE (crisp C1, D6 'palette-exact'): the shared uVoxGain (default 1) multiplies the lit
   light of every mode but glow. fitGain(hemiLight, dirLight) → the gain of a scene's two lights
   (SLIslandLook.voxGain; a copy here if an old look is loaded) and setGain(g) writes it; who
   writes it: sky3d (the island's fit on every island frame), photocard (held at the studio's,
   restored after), stage (1 at every lease grant), a game that lights a vox rig (its own fit).

   SHADER (vuv = (u, v, mode), D2): u, v are ABSOLUTE voxel coordinates on the face plane, so
   fract() is the in-voxel position and floor() a stable hash. Modes 0 block · 1 soft (the soft
   family's bevel) · 2 decal (atlas UVs, mixed by alpha: never a hole) · 3 glow (unlit × uGlowMul)
   · 4 water · 5 plank · 6 cobble · 7 snow · 8 ice · 9 leaf. The bevel (the mockup's, in linear
   light: uBevel = MATERIAL.voxBevel) is a band clamp(fwidth, 1/8, 1/5) of a voxel wide (at least
   1 px; the mockup's 1/8 on voxels of 8 px or more) and fades by family: block (items, rigs)
   between 0.30 and 0.55 voxels per px (held down to ~3 px voxels), the soft family (terrain, paths,
   canopies) between 0.10 and 0.25 (fine ground grids go quiet under ~10 px). Lit modes × uVoxGain;
   then every mode desaturates by uDesat and hazes toward uSky by
   clamp(uHaze + uFogMax × smoothstep(uFogNear, uFogFar, view depth)) (D8: no scene.fog).
   WATER (D41): vertices carry frame-A UVs of the water canvas; frame B is n texels to the
   right, encoded vuv.z = waterZ(n) = 4 + n / 2048 (n 0: one frame). floor(uWaterFrame)'s
   parity picks A / B; crest texels drift a texel per frame, glints change at a quarter of the
   frame rate (≤ 2 Hz at 8 fps); uWaterAnim 0 freezes it all. Water never re-uploads.

   ATLAS (one per bound hub, every tier view shares it): 512² RGBA canvas, sRGB, Nearest mag,
   LinearMipmapLinear min, each cell in a 2-px gutter repeating its edge. Built in: SIGN_WORDS
   ('word:ENCORE' …) in PIX5, pictograms 12×12, surfaces, LED frames 16×8, 'none' and the
   dynamic nameCell 64×12, initialCell 12×12, avatarFace 16×16, photoStrip 24×48. The only
   words ever drawn are SIGN_WORDS and the child's first name / initial (D32).
     atlas() → {texture, cell(name) → [u0, v0, u1, v1], has, rect, names, version,
       define(name, {w, h, rows, pal} | {w, h, draw(ctx)}) → cell | null (full: QA warns),
       setUser({name, color, avatar}) (redraws only nameCell, initialCell, avatarFace),
       setStrip(petId), clearUser(), dispose()}
     'portrait:<pet>' is defined by px-characters; asked for earlier it is the paw (D76).
     define()'s draw(ctx) gets a pixel context (fillStyle, fillRect, clearRect) clipped to its cell.

   K.vox (per tier): template(ctx, model) → TemplateBuilder (SLVox.mesh parts on 'vox', outline
   false, pivots, anchors with their pivot (K8), hit; honours ctx.full / ctx.lod) ·
   geometry(model, o) → [{name, geo, pivot, stateColor, perCopy, castShadow}] · uniforms
   (shared) · matUniforms(m) (uAtlas, uDesat, uHaze, uTint) · cloneMat(m, {desat, haze, tint}) ·
   mat(key) · variant(name) · setWater(tex) · terrainMesh(arraysOrModel, o) and
   bakeStatic([{tpl | arrays | geo, matrix, color}], o) → InstancedMesh(1) ·
   instancedCubes(capacity, {mode, size}) → pool · ghost(tpl, {bad}) → ONE InstancedMesh(1)
   (D77) · cage() → {mesh: InstancedMesh(24), setBox(box | hit, matrix), pulse, visible,
   dispose} (D9) · blobs(capacity) → pool · rig({bones, voxelsPerBone, sockets, anchors, kind})
   → {root, bones, skeleton, mesh: SkinnedMesh, sockets, anchors, tris, setState, dispose} ·
   lod, stats (SLVox). Every InstancedMesh here allocates instanceColor (white), so all vox
   instanced draws share one program (D61). Units are item metres (u).
   ================================================================ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLVoxGL = api;
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 2;                                         /* 2: uVoxGain, fitGain / setGain, the crisp bevel */
  /* the D2 mode table (= SLVox.MODES) */
  var MODES = { block: 0, soft: 1, decal: 2, glow: 3, water: 4, plank: 5, cobble: 6, snow: 7, ice: 8, leaf: 9 };
  var ATLAS = { W: 512, H: 512, GUTTER: 2 };
  var DYNAMIC = { nameCell: [64, 12], initialCell: [12, 12], avatarFace: [16, 16], photoStrip: [24, 48] };
  var SIGN_WORDS_FALLBACK = ['ENCORE', 'SHOWTIME', 'ON AIR', 'PHOTO', 'DANCE', 'PET COURSE', 'ISLAND'];
  var BEVEL = [[0.126, 0.26], [0.057, 0.135]];          /* MATERIAL.voxBevel (linear): block, soft */
  var EXPOSURE = { target: 1.0 };                         /* VOX_EXPOSURE (crisp C1) */
  var FOG = { nearAdd: 25, farAdd: 140, max: 0.35 };       /* VOX_FOG (D8) */
  var GLOW = [0.9, 1.25];                                  /* uGlowMul by day → at night */
  var SEL_W = [0.02, 0.03];                                /* cage bar thickness (D9) */
  var PREVIEW = { desat: 0.30, haze: 0.25 };
  var VARIANTS = {
    ghost: { patch: { transparent: true, opacity: 0.85 }, gold: 0.25 },
    ghostBad: { patch: { transparent: true, opacity: 0.5 }, tint: [0.6, 0.6, 0.64], desat: 1 },
    preview: { patch: {}, preview: true },
    shadow: { patch: { transparent: true, opacity: 0.22, depthWrite: false } }
  };

  /* v2 skeletons (models-characters.js): every name exists on a voxel rig, even empty */
  var PET_PARENT = { base: null, body: 'base', neck: 'body', head: 'neck', eyes: 'head', earL: 'head', earR: 'head',
    tail: 'body', tailTip: 'tail', legFL: 'body', legFR: 'body', legBL: 'body', legBR: 'body', wingL: 'body', wingR: 'body',
    lens: 'head', glint: 'head', spark: 'head', scarfTail: 'neck', blush: 'head', nightH: 'head', scan: 'head',
    cape0: 'body', cape1: 'cape0', cape2: 'cape1' };
  var PET_BONES = Object.keys(PET_PARENT);
  var AV_PARENT = { base: null, body: 'base', head: 'body', armL: 'body', armR: 'body', legL: 'base', legR: 'base' };
  var AV_BONES = Object.keys(AV_PARENT);

  /* ================================================================
     BITMAPS — pure pixel art (hex colours: atlas art, not voxel palettes)
     ================================================================ */
  var HEX = {
    ink: '#2B2140', white: '#FFFFFF', gold: '#FFD23F', goldHi: '#FFF3B0', goldDeep: '#F0C02F', orange: '#FFB627',
    pink: '#FF5FA2', rose: '#FF4D6D', roseHi: '#FFD6E6', candy: '#FF8FC8', candyHi: '#FFD6EC', coral: '#FF6B6B',
    red: '#FF3B5C', glass: '#6FD0F7', glassHi: '#DFF7FF', curtain: '#FF9EC7', sky: '#45C3F5', sea: '#2F8FD8',
    grass: '#7EDB7E', leaf: '#4FA94A', leafDeep: '#2E7D3A', mint: '#7BD88F', bark: '#9B6B43', plank: '#C48A52',
    tea: '#E9B37A', pearl: '#5A3426', paw: '#B8834F', rope: '#E3B24F', stone: '#CFC8DC', stoneDeep: '#3B2F4A',
    snow: '#F2F7FF', snowLine: '#BFD8F2', ice: '#BFE6FF', iceDoor: '#4F6FA8', teal: '#2EC4B6', tealDeep: '#17998C',
    violet: '#7B5CFF', lilac: '#C79BFF', sole: '#E6E1F0', shell: '#FFC2B5', shellLine: '#E8877A', sand: '#F3DC9A',
    cream: '#F7E6C4', roof: '#E0574F', chequer: '#2B2D42', speaker: '#3B3D63', screen: '#1B1442',
    magenta: '#FF2E9A', cyan: '#22E4FF', ledViolet: '#8A5CFF', lime: '#C6FF3D', blue: '#7FB3FF'
  };
  /* PIX5: 5×7 glyphs (space 3 wide, apostrophe 1, hyphen 4), rows top → bottom, '#' lit */
  var PIX5_SRC = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.', C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.', E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#', I: '.###./..#../..#../..#../..#../..#../.###.',
    J: '..###/...#./...#./...#./...#./#..#./.##..', K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#', O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....', Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..', U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..', W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####', a: '...../...../.###./....#/.####/#...#/.####',
    b: '#..../#..../####./#...#/#...#/#...#/####.', c: '...../...../.###./#..../#..../#...#/.###.', d: '....#/....#/.####/#...#/#...#/#...#/.####',
    e: '...../...../.###./#...#/#####/#..../.###.', f: '..##./.#..#/.#.../###../.#.../.#.../.#...', g: '...../.####/#...#/#...#/.####/....#/.###.',
    h: '#..../#..../#.##./##..#/#...#/#...#/#...#', i: '..#../...../.##../..#../..#../..#../.###.', j: '...#./...../..##./...#./...#./#..#./.##..',
    k: '#..../#..../#..#./#.#../##.../#.#../#..#.', l: '.##../..#../..#../..#../..#../..#../.###.', m: '...../...../##.#./#.#.#/#.#.#/#...#/#...#',
    n: '...../...../#.##./##..#/#...#/#...#/#...#', o: '...../...../.###./#...#/#...#/#...#/.###.', p: '...../####./#...#/#...#/####./#..../#....',
    q: '...../.####/#...#/#...#/.####/....#/....#', r: '...../...../#.##./##..#/#..../#..../#....', s: '...../...../.####/#..../.###./....#/####.',
    t: '.#.../.#.../###../.#.../.#.../.#..#/..##.', u: '...../...../#...#/#...#/#...#/#..##/.##.#', v: '...../...../#...#/#...#/#...#/.#.#./..#..',
    w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.', x: '...../...../#...#/.#.#./..#../.#.#./#...#', y: '...../#...#/#...#/#...#/.####/....#/.###.',
    z: '...../...../#####/...#./..#../.#.../#####', 0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.', 4: '...#./..##./.#.#./#..#./#####/...#./...#.',
    5: '#####/#..../####./....#/....#/#...#/.###.', 6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/...#./.##..', ' ': '.../.../.../.../.../.../...',
    "'": '#/#/././././.', '-': '..../..../..../####/..../..../....'
  };
  var PIX5 = {};
  Object.keys(PIX5_SRC).forEach(function (ch) { PIX5[ch] = Object.freeze(PIX5_SRC[ch].split('/')); });

  /* pictograms 12×12 (the only signs on the island: TEA, GO! and YAY! became cup + heart,
     a chequered flag + arrow and the LED heart / note / ✦ frames, D32). '.' is clear. */
  function P(rows, pal) { return Object.freeze({ rows: Object.freeze(rows), pal: Object.freeze(pal) }); }
  var PICTO = {
    cup: P(['.......kk...', '......kk....', '..kkkkkkkk..', '.kwwwwwwwwk.', '..kssssssk..', '..kttttttk..',
      '..ktottotk..', '...kttttk...', '...kottok...', '...kttttk...', '....kkkk....', '............'], { k: HEX.ink, w: HEX.white, s: HEX.pink, t: HEX.tea, o: HEX.pearl }),
    heart: P(['............', '..kkk..kkk..', '.krrrkkrrrk.', 'krrwrrrrrrrk', 'krwwrrrrrrrk', 'krrrrrrrrrrk',
      '.krrrrrrrrk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', '.....kk.....', '............'], { k: HEX.ink, r: HEX.rose, w: HEX.roseHi }),
    note: P(['............', '.....vvvvvv.', '.....vvvvvv.', '.....v....v.', '.....v....v.', '.....v....v.',
      '.....v....v.', '...vvv..vvv.', '..vvvv.vvvv.', '..vvvv.vvvv.', '...vv...vv..', '............'], { v: HEX.violet }),
    /* ✦: exactly four one-pixel tips, never the five-point ⭐ (a reward shape) */
    sparkle: P(['.....y......', '.....y......', '.....y......', '....yyy.....', '...yyWyy....', 'yyyyWWWyyyy.',
      '...yyWyy....', '....yyy.....', '.....y......', '.....y......', '.....y......', '............'], { y: HEX.gold, W: HEX.goldHi }),
    paw: P(['............', '...pp..pp...', '...pp..pp...', '.pp......pp.', '.pp.pppp.pp.', '...pppppp...',
      '..pppppppp..', '..pppppppp..', '..pppppppp..', '...pppppp...', '............', '............'], { p: HEX.paw }),
    sneaker: P(['............', '............', '..kkkk......', '..kwwk......', '..kwwkkk....', '..kwwwwwkk..',
      '.kwwmmwwwwk.', 'kwwwwwwwwwwk', 'kssssssssssk', '.kkkkkkkkkk.', '............', '............'], { k: HEX.ink, w: HEX.white, m: HEX.pink, s: HEX.sole }),
    wave: P(['............', '............', '...bbb......', '..bwwbb.....', '.bw...bb....', '.b.....bb..b',
      'bb......bbbb', 'bbbbbbbbbbbb', 'ssssssssssss', 'bbbbbbbbbbbb', '............', '............'], { b: HEX.sky, w: HEX.glassHi, s: HEX.sea }),
    flag: P(['.k..........', '.kffff......', '.kffffff....', '.kffffffff..', '.kffffff....', '.kffff......',
      '.k..........', '.k..........', '.k..........', '.k..........', 'kkk.........', '............'], { k: HEX.ink, f: HEX.coral }),
    flagChequer: P(['.k..........', '.kwwddwwdd..', '.kwwddwwdd..', '.kddwwddww..', '.kddwwddww..', '.kwwddwwdd..',
      '.kwwddwwdd..', '.k..........', '.k..........', '.k..........', 'kkk.........', '............'], { k: HEX.ink, w: HEX.white, d: HEX.chequer }),
    arrow: P(['............', '............', '......a.....', '......aa....', '......aaa...', '.aaaaaaaaa..',
      '.aaaaaaaaaa.', '.aaaaaaaaa..', '......aaa...', '......aa....', '......a.....', '............'], { a: HEX.red }),
    bolt: P(['......yyy...', '.....yyy....', '.....yy.....', '....yyy.....', '....yy......', '...yyyyyy...',
      '......yy....', '.....yy.....', '.....y......', '....yy......', '....y.......', '............'], { y: HEX.gold }),
    candyfloss: P(['............', '...pppp.....', '..pphppp....', '.pppppppp...', '.ppppppppp..', '..pppppppp..',
      '...pppppp...', '.....s......', '.....s......', '.....s......', '.....s......', '............'], { p: HEX.candy, h: HEX.candyHi, s: HEX.sole }),
    shell: P(['............', '....oooo....', '...oorroo...', '..ororroro..', '.oororroroo.', '.oororroroo.',
      '.oororroroo.', '..oooooooo..', '....rrrr....', '............', '............', '............'], { o: HEX.shell, r: HEX.shellLine }),
    snowflake: P(['.....b......', '...b.b.b....', '....bbb.....', '.b...b...b..', '..b..b..b...', 'bbbbbbbbbbb.',
      '..b..b..b...', '.b...b...b..', '....bbb.....', '...b.b.b....', '.....b......', '............'], { b: HEX.blue }),
    leaf: P(['............', '........gg..', '......gggg..', '....ggggdg..', '...gggdggg..', '..ggdgggg...',
      '..gdgggg....', '.gdggg......', '.dgg........', 'd...........', '............', '............'], { g: HEX.mint, d: HEX.leafDeep }),
    padlock: P(['............', '....kkkk....', '...k....k...', '...k....k...', '...k....k...', '.kkkkkkkkkk.',
      '.kggggggggk.', '.kgggkkgggk.', '.kgggkkgggk.', '.kggggggggk.', '.kkkkkkkkkk.', '............'], { k: HEX.ink, g: HEX.goldDeep }),
    sun: P(['.....y......', '.y...y...y..', '..y.....y...', '....ooo.....', '...ooooo....', 'yy.ooooo.yy.',
      '...ooooo....', '....ooo.....', '..y.....y...', '.y...y...y..', '.....y......', '............'], { y: HEX.gold, o: HEX.orange }),
    shieldSun: P(['.kkkkkkkkkk.', '.kttttttttk.', '.ktyttttytk.', '.kttyyyyttk.', '.ktyyyyyytk.', '.ktyyyyyytk.',
      '.kttyyyyttk.', '.ktyttttytk.', '..kttttttk..', '...kttttk...', '....kkkk....', '............'], { k: HEX.ink, t: HEX.teal, y: HEX.gold }),
    'isle:home': P(['.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '..wwwwwwww..',
      '..wbbwwddw..', '..wbbwwddw..', '..wwwwwddw..', 'gggggggggggg', '.ssssssssss.', '..ssssssss..'], { r: HEX.roof, w: HEX.cream, b: HEX.glass, d: HEX.teal, g: HEX.grass, s: HEX.lilac }),
    'isle:pier': P(['...ccccc....', '..c.c.c.c...', '.c...c...c..', '.ccccycccc..', '.c...c...c..', '..c.c.c.c...',
      '...ccccc....', '...a...a....', '..a.....a...', 'gggggggggggg', '.ssssssssss.', '..ssssssss..'], { c: HEX.coral, y: HEX.gold, a: HEX.bark, g: HEX.sand, s: HEX.candy }),
    'isle:jungle': P(['.....ll.....', '...llllll...', '.llllllllll.', 'llllllllllll', '..bbbbbbbb..', '..bbbddbbb..',
      '..bbbddbbb..', '..k......k..', '..k......k..', 'gggggggggggg', '.ssssssssss.', '..ssssssss..'], { l: HEX.leaf, b: HEX.plank, d: HEX.pearl, k: HEX.bark, g: HEX.grass, s: HEX.tea }),
    'isle:treetop': P(['.....p......', '....ppp.....', '...ppppp....', '..ppppppp...', '....ppp...r.', '...ppppp.r..',
      '..pppppppr..', '.....t..r...', '.....t.r....', 'gggggggggggg', '.ssssssssss.', '..ssssssss..'], { p: HEX.leafDeep, t: HEX.bark, r: HEX.rope, g: HEX.grass, s: HEX.plank }),
    'isle:castle': P(['...s.ss.s...', '...ssssss...', '...ssssss...', '...ssbbss...', '...ssbbss...', '...ssssss...',
      '...ssddss...', '...ssddss...', '..ssssssss..', 'gggggggggggg', '.cccccccccc.', '..cccccccc..'], { s: HEX.stone, b: HEX.stoneDeep, d: HEX.bark, g: HEX.grass, c: HEX.lilac }),
    'isle:ice': P(['............', '............', '....wwww....', '..wwhwwhww..', '.wwwwwwwwww.', '.whwwhhwwhw.',
      '.wwwwddwwww.', '.wwhwddwhww.', '.wwwwddwwww.', 'iiiiiiiiiiii', '.iiiiiiiiii.', '..iiiiiiii..'], { w: HEX.snow, h: HEX.snowLine, d: HEX.iceDoor, i: HEX.ice })
  };

  /* LED frames 16×8 on a dark screen: EQ ×2, star field ×2, ✦ spin ×2, heart pulse ×2 (rows),
     and the ENCORE wipe ×3 (three 16-px slices of the word in PIX5, drawn from the font) */
  function ledRows(fn) {
    var rows = [];
    for (var y = 0; y < 8; y++) { var r = ''; for (var x = 0; x < 16; x++) r += fn(x, y, x - 7, y - 3) || 'n'; rows.push(r); }
    return Object.freeze(rows);
  }
  var LED_DOTS = [[1, 0, 'w'], [5, 1, 'y'], [10, 0, 'c'], [14, 1, 'w'], [3, 3, 'c'], [8, 3, 'w'], [12, 4, 'v'], [1, 6, 'v'], [6, 6, 'w'], [10, 7, 'l'], [14, 6, 'w'], [7, 5, 'm']];
  function ledEq(h) { return ledRows(function (x, y) { return y >= 8 - h[x >> 1] ? 'mcvl'[(x >> 1) % 4] : null; }); }
  function ledStars(f) {
    return ledRows(function (x, y) { for (var i = 0; i < LED_DOTS.length; i++) if (LED_DOTS[i][0] === x && LED_DOTS[i][1] === y && (i + f) % 3) return LED_DOTS[i][2]; return null; });
  }
  /* ✦ spin: upright, then turned 45° (4 arms both ways) */
  function ledSpin(f) {
    return ledRows(function (x, y, dx, dy) {
      var ax = Math.abs(dx), ay = Math.abs(dy);
      return !dx && !dy ? 'w' : (f ? ax === ay : !dx || !dy) && ax <= 3 && ay <= 3 ? 'y' : null;
    });
  }
  function ledHeart(rows, x0, y0) { return ledRows(function (x, y) { var r = rows[y - y0]; return r && r[x - x0] === 'm' ? 'm' : null; }); }
  var LED_PAL = { n: HEX.screen, m: HEX.magenta, c: HEX.cyan, v: HEX.ledViolet, l: HEX.lime, w: HEX.white, y: HEX.gold };
  var LED = {
    'led:eq:0': ledEq([3, 6, 4, 7, 2, 5, 6, 3]), 'led:eq:1': ledEq([5, 3, 7, 4, 6, 2, 4, 6]), 'led:stars:0': ledStars(0), 'led:stars:1': ledStars(1),
    'led:spin:0': ledSpin(0), 'led:spin:1': ledSpin(1), 'led:heart:0': ledHeart(['.mm.mm.', 'mmmmmmm', '.mmmmm.', '..mmm..', '...m...'], 4, 1),
    'led:heart:1': ledHeart(['.mmm.mmm.', 'mmmmmmmmm', 'mmmmmmmmm', '.mmmmmmm.', '..mmmmm..', '...mmm...', '....m....'], 3, 0)
  };
  var LED_WORDS = { encore: { word: 'ENCORE', frames: 3 } };

  var BITMAPS = {
    PIX5: PIX5, PICTO: PICTO, LED: LED, LED_PAL: LED_PAL, LED_WORDS: LED_WORDS,
    WORDS: SIGN_WORDS_FALLBACK.slice(), HEX: HEX
  };
  [PIX5, PICTO, LED, LED_PAL, LED_WORDS, BITMAPS.WORDS, HEX].forEach(Object.freeze);
  Object.freeze(BITMAPS);

  /* ---------------- PIX5 text (pure) ---------------- */
  var COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');   /* accents: Zoë → ZOE */
  function glyphOf(ch) {
    if (PIX5[ch]) return PIX5[ch];
    var base = typeof ch.normalize === 'function' ? ch.normalize('NFD').replace(COMBINING, '') : ch;
    return PIX5[base] || PIX5[base.toUpperCase()] || null;
  }
  function textWidth(text, gap) {
    var w = 0, n = 0, g = gap == null ? 1 : gap;
    for (var i = 0; i < text.length; i++) { var gl = glyphOf(text[i]); if (gl) { w += gl[0].length; n++; } }
    return n ? w + (n - 1) * g : 0;
  }

  /* ---------------- the atlas packer (pure, deterministic) ----------------
     Shelves top → bottom; a cell takes (w + 2g) × (h + 2g) and sits at its gutter offset.
     place() returns {x, y} (the cell's own top-left) or null when it cannot fit (state unchanged). */
  function packer(W, H, gutter) {
    var g = gutter == null ? ATLAS.GUTTER : gutter, shelves = [], top = 0;
    return {
      place: function (w, h) {
        var sw = w + 2 * g, sh = h + 2 * g;
        if (!(w > 0 && h > 0) || sw > W) return null;
        for (var i = 0; i < shelves.length; i++) {
          var s = shelves[i];
          if (sh <= s.h && s.x + sw <= W) { var p = { x: s.x + g, y: s.y + g }; s.x += sw; return p; }
        }
        if (top + sh > H) return null;
        shelves.push({ y: top, h: sh, x: sw });
        top += sh;
        return { x: g, y: top - sh + g };
      },
      get used() { return top; }
    };
  }

  /* ---------------- colours (pure) ---------------- */
  function parseColor(v) {
    if (Array.isArray(v)) return [v[0] | 0, v[1] | 0, v[2] | 0, v.length > 3 ? v[3] | 0 : 255];
    var s = String(v == null ? '' : v).trim(), m;
    if (s === 'transparent' || !s) return [0, 0, 0, 0];
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) s = '#' + m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2];
    if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) : 255];
    }
    if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
      return [+m[1] | 0, +m[2] | 0, +m[3] | 0, m[4] == null ? 255 : Math.round(Math.min(1, +m[4]) * 255)];
    }
    return null;
  }
  /* = SLIslandLook.voxTopGain / voxGain (the look owns them; this copy is the fallback for an old look):
     the lit up-face gain of hemi + sun in three's Lambert, and the exposure fit that caps it at 1 */
  function voxGain(hemiI, hemiSkyLin, sunI, sunLin, sunUp) {
    var top = 0, up = Math.max(0, +sunUp || 0);
    for (var c = 0; c < 3; c++) top = Math.max(top, ((+hemiI || 0) * (hemiSkyLin ? +hemiSkyLin[c] || 0 : 0) + (+sunI || 0) * (sunLin ? +sunLin[c] || 0 : 0) * up) / Math.PI);
    return top > EXPOSURE.target ? EXPOSURE.target / top : 1;
  }
  function waterZ(offsetTexels) {
    var n = Math.max(0, Math.min(1023, Math.round(Number(offsetTexels) || 0)));
    return MODES.water + n / 2048;
  }

  /* ================================================================
     THE SHADER PATCH (pure strings; r170 MeshLambertMaterial)
     ================================================================ */
  var SHADER = {
    vertexDecl: ['attribute vec3 vuv;', 'varying vec3 vVuv;', 'varying float vVoxDepth;'].join('\n'),
    vertexUv: 'vVuv = vuv;',
    vertexDepth: 'vVoxDepth = - mvPosition.z;',
    fragmentDecl: [
      'precision highp float;',
      'uniform sampler2D uAtlas;',
      'uniform vec2 uBevel[ 2 ];',
      'uniform vec3 uTint, uSky;',
      'uniform float uGlowMul, uVoxGain, uDesat, uHaze, uFogNear, uFogFar, uFogMax, uWaterFrame, uWaterAnim;',
      'varying vec3 vVuv;',
      'varying float vVoxDepth;',
      'float voxHash( vec2 p ) {',
      '\tvec3 q = fract( p.xyx * 0.1031 );',
      '\tq += dot( q, q.yzx + 33.33 );',
      '\treturn fract( ( q.x + q.y ) * q.z );',
      '}',
      '/* 1 inside [a, b], anti-aliased over w */',
      'float voxIn( float a, float b, float x, float w ) {',
      '\treturn clamp( min( x - a, b - x ) / max( w, 1e-4 ) + 0.5, 0.0, 1.0 );',
      '}'
    ].join('\n'),
    /* after #include <color_fragment>: derivatives and samples stay in uniform control flow */
    fragmentSurface: [
      'float voxMode = floor( vVuv.z + 0.5 );',
      'vec2 voxDx = dFdx( vVuv.xy ), voxDy = dFdy( vVuv.xy ), voxW = fwidth( vVuv.xy );',
      'float voxWm = max( voxW.x, voxW.y );',
      'float voxBw = clamp( voxWm, 0.125, 0.2 );            // the bevel band: >= 1 px, <= 1/5 voxel',
      'float voxFade = 1.0 - ( voxMode == 0.0 ? smoothstep( 0.30, 0.55, voxWm ) : smoothstep( 0.10, 0.25, voxWm ) );',
      'if ( voxMode == 2.0 ) {                         // decal: the atlas cell over the voxel colour',
      '\tvec4 voxT = textureGrad( uAtlas, vVuv.xy, voxDx, voxDy );',
      '\tdiffuseColor.rgb = mix( diffuseColor.rgb, voxT.rgb, voxT.a );',
      '} else if ( voxMode == 4.0 ) {                  // water: frame A / B, crests, glints',
      '\tfloat voxWf = uWaterAnim > 0.5 ? floor( uWaterFrame ) : 0.0;',
      '\tvec2 voxTs = vec2( textureSize( uAtlas, 0 ) );',
      '\tfloat voxB = floor( ( vVuv.z - 4.0 ) * 2048.0 + 0.5 );',
      '\tvec2 voxUv = vVuv.xy + vec2( mod( voxWf, 2.0 ) * voxB / voxTs.x, 0.0 );',
      '\tvec4 voxT = textureGrad( uAtlas, voxUv, voxDx, voxDy );',
      '\tvec2 voxTx = floor( voxUv * voxTs );',
      '\tfloat voxCrest = step( 0.972, voxHash( vec2( floor( ( voxTx.x - voxWf ) * 0.5 ), voxTx.y ) ) );',
      '\tfloat voxGlint = step( 0.996, voxHash( voxTx + vec2( 0.0, floor( voxWf * 0.25 ) * 13.0 ) ) );',
      '\tvoxT.rgb = mix( voxT.rgb, vec3( 1.0 ), step( 0.5, voxT.a ) * max( voxCrest * 0.35, voxGlint * 0.8 ) );',
      '\tdiffuseColor = vec4( diffuseColor.rgb * voxT.rgb, diffuseColor.a * voxT.a );',
      '} else if ( voxMode != 3.0 ) {                  // block, soft and the soft patterns (glow is unlit)',
      '\tvec2 voxF = fract( vVuv.xy );',
      '\tvec2 voxBv = voxMode == 0.0 ? uBevel[ 0 ] : uBevel[ 1 ];',
      '\tfloat voxHi = max( voxIn( -1.0, voxBw, voxF.x, voxW.x ), voxIn( 1.0 - voxBw, 2.0, voxF.y, voxW.y ) );',
      '\tfloat voxLo = max( voxIn( 1.0 - voxBw, 2.0, voxF.x, voxW.x ), voxIn( -1.0, voxBw, voxF.y, voxW.y ) );',
      '\tfloat voxK = voxBv.x * voxHi * ( 1.0 - voxLo ) - voxBv.y * voxLo;',
      '\tvec2 voxC = floor( vVuv.xy ), voxP = floor( voxF * 8.0 );    // the voxel and its 8×8 texel',
      '\tif ( voxMode == 5.0 ) {                       // plank: a groove row at v 0.5',
      '\t\tvoxK -= 1.5 * voxBv.y * voxIn( 0.4375, 0.5625, voxF.y, voxW.y );',
      '\t} else if ( voxMode == 6.0 ) {               // cobble: 2×2 rounded stones toned by hash',
      '\t\tvec2 voxS = mod( voxP, 4.0 );',
      '\t\tfloat voxMortar = max( step( 2.5, voxS.x ), step( 2.5, voxS.y ) );',
      '\t\tfloat voxCorner = step( 0.5, abs( voxS.x - 1.0 ) ) * step( 0.5, abs( voxS.y - 1.0 ) ) * ( 1.0 - voxMortar );',
      '\t\tfloat voxTone = voxHash( voxC * 2.0 + floor( voxP * 0.25 ) ) - 0.5;',
      '\t\tvoxK += ( 0.08 * voxTone - 0.06 * voxCorner ) * ( 1.0 - voxMortar ) - 0.12 * voxMortar;',
      '\t} else if ( voxMode == 7.0 ) {               // snow: a sparkle texel on 1 voxel in 3',
      '\t\tvec2 voxSp = floor( vec2( voxHash( voxC + 17.13 ), voxHash( voxC + 41.71 ) ) * 6.0 ) + 1.0;',
      '\t\tvoxK += 0.22 * step( voxHash( voxC ), 0.3334 ) * step( length( voxP - voxSp ), 0.5 );',
      '\t} else if ( voxMode == 8.0 ) {               // ice: a 3-texel diagonal shine',
      '\t\tvoxK += 0.18 * step( abs( voxP.x + voxP.y - 7.0 ), 0.5 ) * step( 1.5, voxP.x ) * step( voxP.x, 4.5 );',
      '\t} else if ( voxMode == 9.0 ) {               // leaf: two darker texels by hash',
      '\t\tvec2 voxL1 = floor( vec2( voxHash( voxC + 3.7 ), voxHash( voxC + 9.1 ) ) * 8.0 );',
      '\t\tvec2 voxL2 = floor( vec2( voxHash( voxC + 5.3 ), voxHash( voxC + 12.9 ) ) * 8.0 );',
      '\t\tvoxK -= 0.14 * max( step( length( voxP - voxL1 ), 0.5 ), step( length( voxP - voxL2 ), 0.5 ) );',
      '\t}',
      '\tdiffuseColor.rgb *= 1.0 + voxFade * voxK;',
      '}',
      'diffuseColor.rgb *= uTint;'
    ].join('\n'),
    /* before #include <opaque_fragment> */
    fragmentLight: [
      'if ( voxMode == 3.0 ) outgoingLight = diffuseColor.rgb * uGlowMul;',
      'else outgoingLight *= uVoxGain;                      // the exposure fit: a lit top never above its token',
      'outgoingLight = mix( outgoingLight, vec3( dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uDesat );',
      'outgoingLight = mix( outgoingLight, uSky, clamp( uHaze + uFogMax * smoothstep( uFogNear, uFogFar, vVoxDepth ), 0.0, 1.0 ) );'
    ].join('\n')
  };
  Object.freeze(SHADER);
  var MARKS = [
    ['vertexShader', '#include <common>', 'vertexDecl', 1], ['vertexShader', '#include <begin_vertex>', 'vertexUv', 1],
    ['vertexShader', '#include <project_vertex>', 'vertexDepth', 1], ['fragmentShader', '#include <common>', 'fragmentDecl', 1],
    ['fragmentShader', '#include <color_fragment>', 'fragmentSurface', 1], ['fragmentShader', '#include <opaque_fragment>', 'fragmentLight', 0]
  ];
  /* patch a Lambert shader in place (after = 1: the chunk goes after its marker, 0: before);
     returns the markers that were missing (a three upgrade that moved them shows up in QA) */
  function patchShader(shader, uniforms) {
    var missing = [];
    MARKS.forEach(function (m) {
      var src = shader[m[0]], i = src.indexOf(m[1]);
      if (i < 0) { missing.push(m[1]); return; }
      var add = m[3] ? m[1] + '\n' + SHADER[m[2]] : SHADER[m[2]] + '\n' + m[1];
      shader[m[0]] = src.slice(0, i) + add + src.slice(i + m[1].length);
    });
    if (uniforms) for (var k in uniforms) if (Object.prototype.hasOwnProperty.call(uniforms, k)) shader.uniforms[k] = uniforms[k];
    return missing;
  }

  /* ================================================================
     bind(hub, SL3D, opts) → VoxHub
     opts (tests / the lab): {THREE, vox (SLVox), look (SLIslandLook), canvas(w, h)}
     ================================================================ */
  var SERIAL = 0, HUBS = new Map(), MAT_U = new WeakMap();
  function voxProgramKey() { return 'pixel-vox'; }
  /* the one onBeforeCompile of every vox material (this = the material; clones keep
     userData.voxHub): shared uniforms + the material's own */
  function voxCompile(shader) {
    var st = HUBS.get(this.userData && this.userData.voxHub) || HUBS.values().next().value, own = st.matUniforms(this), u = {};
    Object.keys(st.uniforms).forEach(function (k) { u[k] = st.uniforms[k]; });
    ['uAtlas', 'uDesat', 'uHaze', 'uTint'].forEach(function (k) { u[k] = own[k]; });
    var missing = patchShader(shader, u);
    if (missing.length) st.warn('vox shader: markers not found (' + missing.join(', ') + ')');
  }

  function bind(hub, SL3D, opts) {
    if (!hub || typeof hub.kit !== 'function') throw new Error('SLVoxGL.bind needs the kit hub');
    if (hub.vox && hub.vox.__voxgl) return hub.vox;
    opts = opts || {};
    var T = opts.THREE || (SL3D && SL3D.THREE);
    if (!T || !T.BufferGeometry) throw new Error('SLVoxGL.bind needs SL3D.THREE');
    var st = new HubState(hub, T, opts);
    HUBS.set(st.id, st);
    st.register();
    return (hub.vox = st.api);
  }

  function HubState(hub, T, opts) {
    var self = this, L;
    this.id = 'vox' + (++SERIAL); this.hub = hub; this.T = T; this.opts = opts;
    this.registered = false; this.views = {}; this.live = new Set(); this.atlasObj = null; this.colors = new Map();
    this.waterU = { value: null }; this.atlasU = { value: null };
    L = this.look();
    var b = L && L.MATERIAL && L.MATERIAL.voxBevel && L.MATERIAL.voxBevel.length === 2 ? L.MATERIAL.voxBevel : BEVEL, f = (L && L.VOX_FOG) || {};
    this.fog = { nearAdd: f.nearAdd != null ? f.nearAdd : FOG.nearAdd, farAdd: f.farAdd != null ? f.farAdd : FOG.farAdd, max: f.max != null ? f.max : FOG.max };
    this.uniforms = {
      uBevel: { value: new Float32Array([b[0][0], b[0][1], b[1][0], b[1][1]]) }, uGlowMul: { value: GLOW[0] }, uVoxGain: { value: 1 },
      uFogNear: { value: 35 + this.fog.nearAdd }, uFogFar: { value: 35 + this.fog.farAdd }, uFogMax: { value: this.fog.max },
      uSky: { value: this.color('Sky Day Mid', '#CDEBFF') }, uWaterFrame: { value: 0 }, uWaterAnim: { value: 1 }
    };
    var api = this.api = {
      __voxgl: true, VERSION: VERSION, MODES: MODES, uniforms: this.uniforms, hub: hub, THREE: T,
      forTier: function (tier) { return self.view(tier); },
      atlas: function () { return self.atlas(); },
      matUniforms: function (m) { return self.matUniforms(m); },
      cloneMat: function (m, v) { return self.cloneMat(m, v); },
      setWater: function (tex) { self.waterU.value = tex || null; return api; },
      setShow: function (k) { self.setShow(k); },
      fitGain: function (hemi, sun) { return self.fitGain(hemi, sun); },
      setGain: function (g) { return self.setGain(g); },
      settle: function (dist) { self.settle(dist); },
      dispose: function () { self.release(); },
      get registered() { return self.registered; }
    };
  }
  var HS = HubState.prototype;
  HS.look = function () { var L = this.opts.look || root.SLIslandLook; return L && typeof L === 'object' ? L : null; };
  HS.mesher = function () {
    var V = this.opts.vox || root.SLVox;
    if (!V || typeof V.mesh !== 'function') throw new Error('SLVoxGL: vox.js (SLVox) is not loaded');
    return V;
  };
  HS.K = function (tier) { return this.hub.kit(tier || 'MID'); };
  HS.warn = function (msg) { this.K().warn('[vox-gl] ' + msg); };
  /* '#hex' of a token: SLIslandLook.resolve first (PALETTE_V3), then the kit's tables */
  HS.hexOf = function (token) {
    if (typeof token !== 'string') return null;
    if (token[0] === '#' || /^rgba?\(/i.test(token)) return token;
    var L = this.look(), K = this.K(), h = null;
    try { h = L && typeof L.resolve === 'function' ? L.resolve(token) : null; } catch (e) { h = null; }
    return h || (K.has(token) ? K.hex(token) : null);
  };
  /* a linear THREE.Color for a token (cached: never mutate it) */
  HS.color = function (token, fallback) {
    if (token && token.isColor) return token;
    var c = this.colors.get(token), h;
    if (c) return c;
    if (!(h = this.hexOf(token))) { h = fallback || '#CFC8DC'; if (!fallback) this.warn('unknown colour token "' + token + '"'); }
    this.colors.set(token, c = new this.T.Color(h));
    return c;
  };
  HS.view = function (tier) {
    var t = typeof tier === 'string' && /^(LOW|MID|HIGH)$/i.test(tier) ? tier.toUpperCase() : 'MID';
    return this.views[t] || (this.views[t] = makeView(this, t));
  };

  /* ---------------- materials (K2) ---------------- */
  HS.register = function () {
    var self = this;
    if (typeof this.hub.defineMat !== 'function') { this.warn('the kit has no defineMat (K2): vox materials are unavailable'); return; }
    this.hub.defineMat('vox', function (arg) { return self.makeMat(arg === 'water' ? 'water' : 'vox'); },
      { merge: { cls: 'vox', extra: ['vuv'] }, onShow: function (k) { self.setShow(k); }, dispose: function () { self.release(); } });
    try { this.hub.defineMat('vox:water', function () { return self.makeMat('water'); }, {}); } catch (e) { /* base-only registries reach it through 'vox' */ }
    this.registered = true;
  };
  HS.makeMat = function (family) {
    var water = family === 'water';
    var m = new this.T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false, fog: false,
      transparent: water, depthWrite: !water, name: water ? 'vox:water' : 'vox' });
    m.userData.voxFamily = water ? 'water' : 'vox'; m.userData.voxHub = this.id;
    m.onBeforeCompile = voxCompile; m.customProgramCacheKey = voxProgramKey;
    return m;
  };
  HS.mat = function (key, K) { return (K || this.K()).mat(key === 'vox:water' ? key : 'vox'); };
  HS.variant = function (name, K) {
    var v = VARIANTS[name];
    if (!v) { this.warn('unknown vox variant "' + name + '"'); return this.mat('vox', K); }
    var m = (K || this.K()).variant('vox', name, v.patch);
    m.userData.voxHub = this.id;
    this.matUniforms(m);
    return m;
  };
  /* the per-material uniforms; a variant's defaults come from its name ('vox#ghost' …) */
  HS.matUniforms = function (m) {
    var u = MAT_U.get(m);
    if (u) return u;
    var water = m.userData && m.userData.voxFamily === 'water', L = this.look(), pv = (L && L.PREVIEW) || PREVIEW;
    var v = VARIANTS[String(m.name || '').split('#')[1] || ''] || {}, tint = new this.T.Color(1, 1, 1);
    if (v.gold) tint.lerp(this.color('Star Gold', HEX.gold), v.gold);
    if (v.tint) tint.setRGB(v.tint[0], v.tint[1], v.tint[2]);
    if (!water) this.atlas();
    u = { uAtlas: water ? this.waterU : this.atlasU, uDesat: { value: v.desat || (v.preview ? pv.desat : 0) },
      uHaze: { value: v.preview ? pv.haze : 0 }, uTint: { value: tint } };
    MAT_U.set(m, u);
    return u;
  };
  /* a clone that keeps the patch and the program, with its own desat / haze / tint (previews) */
  HS.cloneMat = function (m, o) {
    var c = m.clone(), src = this.matUniforms(m);
    c.onBeforeCompile = voxCompile; c.customProgramCacheKey = voxProgramKey;
    c.userData.voxHub = this.id; c.userData.voxFamily = m.userData.voxFamily;
    var u = { uAtlas: src.uAtlas, uDesat: { value: src.uDesat.value }, uHaze: { value: src.uHaze.value }, uTint: { value: src.uTint.value.clone() } };
    if (o && o.desat != null) u.uDesat.value = +o.desat;
    if (o && o.haze != null) u.uHaze.value = +o.haze;
    if (o && o.tint != null) u.uTint.value.copy(this.color(o.tint));
    MAT_U.set(c, u);
    return c;
  };
  HS.setShow = function (k) { this.uniforms.uGlowMul.value = GLOW[0] + (GLOW[1] - GLOW[0]) * Math.max(0, Math.min(1, Number(k) || 0)); };
  /* the exposure fit of a scene's lights (crisp C1): hemi = the HemisphereLight (or any light whose
     colour reaches an up face in full, e.g. an AmbientLight), sun = the DirectionalLight (its
     direction = position − target.position). Colours are three's working (linear) colours. */
  HS.fitGain = function (hemi, sun) {
    var hc = hemi && hemi.color, sc = sun && sun.color, up = 0;
    if (sun && sun.position) {
      var t = (sun.target && sun.target.position) || { x: 0, y: 0, z: 0 };
      var dx = sun.position.x - t.x, dy = sun.position.y - t.y, dz = sun.position.z - t.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      up = len > 1e-9 ? dy / len : 0;
    }
    var L = this.look(), f = L && typeof L.voxGain === 'function' ? L.voxGain : voxGain;
    var g = f(hemi ? Number(hemi.intensity) || 0 : 0, hc ? [hc.r, hc.g, hc.b] : null, sun ? Number(sun.intensity) || 0 : 0, sc ? [sc.r, sc.g, sc.b] : null, up);
    return g > 0 && isFinite(g) ? g : 1;
  };
  /* write the shared gain (1 = today's look, the default; anything not a positive number is 1) */
  HS.setGain = function (g) {
    var v = Number(g);
    this.uniforms.uVoxGain.value = v > 0 && isFinite(v) ? Math.min(v, 4) : 1;
    return this.uniforms.uVoxGain.value;
  };
  /* the haze band follows the camera's settle distance (sky3d.settle, D8) */
  HS.settle = function (dist) {
    var d = Math.max(0, Number(dist) || 0);
    this.uniforms.uFogNear.value = d + this.fog.nearAdd; this.uniforms.uFogFar.value = d + this.fog.farAdd;
  };
  /* the kit's dispose hook (K7): blank the child's cells and free the GPU copies and our pools;
     all of it rebuilds on demand (the atlas keeps the cells px-characters defined) */
  HS.release = function () {
    if (this.atlasObj) { this.atlasObj.clearUser(); this.atlasObj.texture.dispose(); }
    Array.from(this.live).forEach(function (p) { p.dispose(); });
    this.live.clear();
    this.uniforms.uGlowMul.value = GLOW[0];
    this.uniforms.uVoxGain.value = 1;
  };

  /* ================================================================
     THE ATLAS — pixels in a buffer, blitted to the canvas by dirty rect
     ================================================================ */
  function makeCanvas(st, w, h) {
    if (typeof st.opts.canvas === 'function') return st.opts.canvas(w, h);
    if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    return null;
  }
  HS.atlas = function () {
    if (this.atlasObj) return this.atlasObj;
    this.atlasObj = buildAtlas(this);
    this.atlasU.value = this.atlasObj.texture;
    return this.atlasObj;
  };
  function signWordsOf(L) { return L && Array.isArray(L.SIGN_WORDS) ? L.SIGN_WORDS.slice() : SIGN_WORDS_FALLBACK.slice(); }
  /* the child's first name as drawn: K.signName's trim (letters, upper case, ≤ 12), accents folded */
  function signNameOf(name) {
    var K = root.SLKit, n;
    if (K && typeof K.signName === 'function') n = K.signName(name);
    else n = (String(name == null ? '' : name).trim().split(/\s+/)[0] || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\-]/g, '').toUpperCase().slice(0, 12).replace(/['\-]+$/, '');
    return typeof n.normalize === 'function' ? n.normalize('NFD').replace(COMBINING, '') : n;
  }

  function buildAtlas(st) {
    var T = st.T, W = ATLAS.W, H = ATLAS.H, G = ATLAS.GUTTER;
    var canvas = makeCanvas(st, W, H), ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var img = ctx && ctx.createImageData ? ctx.createImageData(W, H) : null;
    var px = img ? img.data : new Uint8ClampedArray(W * H * 4);
    var cells = {}, uvs = {}, pack = packer(W, H, G), version = 0, user = { name: '', color: null, avatar: '' };
    var words = signWordsOf(st.look());

    /* ---- painting (every write is clipped to the cell being drawn) ---- */
    function painter(c) {
      function put(x, y, rgba) {
        if (!rgba || x < 0 || y < 0 || x >= c.w || y >= c.h) return;
        var o = ((c.y + y) * W + c.x + x) * 4;
        if (rgba[3] >= 255 || rgba[3] === 0) { px[o] = rgba[0]; px[o + 1] = rgba[1]; px[o + 2] = rgba[2]; px[o + 3] = rgba[3]; return; }
        var a = rgba[3] / 255, b = px[o + 3] / 255, oa = a + b * (1 - a);
        for (var k = 0; k < 3; k++) px[o + k] = oa ? (rgba[k] * a + px[o + k] * b * (1 - a)) / oa : 0;
        px[o + 3] = oa * 255;
      }
      return {
        put: put,
        rect: function (x, y, w, h, rgba) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) put(x + i, y + j, rgba); },
        clear: function () { for (var j = 0; j < c.h; j++) for (var i = 0; i < c.w; i++) { var o = ((c.y + j) * W + c.x + i) * 4; px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; } },
        rows: function (x, y, rows, pal) {
          for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
            var ch = rows[j][i];
            if (ch === '.' || ch === ' ') continue;
            put(x + i, y + j, colorOf(pal[ch]));
          }
        },
        /* PIX5 text with a 1-px shadow down-right (each glyph's shadow under its own pixels) */
        text: function (x, y, text, rgba, shadow, gap) {
          for (var i = 0, cx = x; i < text.length; i++) {
            var gl = glyphOf(text[i]);
            if (!gl) continue;
            for (var pass = shadow ? 0 : 1; pass < 2; pass++) for (var j = 0; j < 7; j++) for (var k = 0; k < gl[j].length; k++) if (gl[j][k] === '#') put(cx + k + 1 - pass, y + j + 1 - pass, pass ? rgba : shadow);
            cx += gl[0].length + (gap == null ? 1 : gap);
          }
        }
      };
    }
    var colorCache = {};
    function colorOf(v) {
      if (Array.isArray(v)) return parseColor(v);
      var key = String(v);
      if (colorCache[key]) return colorCache[key];
      var rgba = parseColor(v);
      if (!rgba) { var h = st.hexOf(key); rgba = h ? parseColor(h) : null; }
      if (!rgba) { st.warn('atlas: unknown colour "' + key + '"'); rgba = parseColor('#CFC8DC'); }
      return (colorCache[key] = rgba);
    }
    /* the 2-px gutter repeats the cell's edge pixels (corners included) */
    function gutter(c) {
      function copy(sx, sy, dx, dy) {
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) return;
        var s = (sy * W + sx) * 4, d = (dy * W + dx) * 4;
        px[d] = px[s]; px[d + 1] = px[s + 1]; px[d + 2] = px[s + 2]; px[d + 3] = px[s + 3];
      }
      for (var y = c.y - G; y < c.y + c.h + G; y++) {
        var sy = Math.min(c.y + c.h - 1, Math.max(c.y, y));
        for (var x = c.x - G; x < c.x + c.w + G; x++) {
          if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) continue;
          copy(Math.min(c.x + c.w - 1, Math.max(c.x, x)), sy, x, y);
        }
      }
    }
    function slot(c) { return { x: c.x - G, y: c.y - G, w: c.w + 2 * G, h: c.h + 2 * G }; }
    function flush(c) {
      if (ctx) { var r = c ? slot(c) : { x: 0, y: 0, w: W, h: H }; ctx.putImageData(img, 0, 0, r.x, r.y, r.w, r.h); }
      version++;
      if (atlas.texture) atlas.texture.needsUpdate = true;
    }
    function paint(c) { var p = painter(c); p.clear(); if (c.draw) c.draw(p); gutter(c); }

    /* ---- built-in cells ---- */
    var specs = [];
    function spec(name, w, h, draw, dyn) { specs.push({ name: name, w: w, h: h, draw: draw, dyn: !!dyn }); }
    var WHITE = parseColor(HEX.white), INK = parseColor(HEX.ink);
    words.forEach(function (wd) {
      var tw = textWidth(wd);
      spec('word:' + wd, tw + 1, 8, function (p) { p.text(0, 0, wd, WHITE, INK); });
    });
    Object.keys(PICTO).forEach(function (name) { var pc = PICTO[name]; spec(name, 12, 12, function (p) { p.rows(0, 0, pc.rows, pc.pal); }); });
    Object.keys(LED).forEach(function (name) { var rows = LED[name]; spec(name, 16, 8, function (p) { p.rows(0, 0, rows, LED_PAL); }); });
    Object.keys(LED_WORDS).forEach(function (key) {
      var lw = LED_WORDS[key], tw = textWidth(lw.word), x0 = Math.floor((16 * lw.frames - tw) / 2);
      for (var f = 0; f < lw.frames; f++) {
        (function (f) {
          spec('led:' + key + ':' + f, 16, 8, function (p) {
            p.rect(0, 0, 16, 8, colorOf(HEX.screen));
            p.text(x0 - 16 * f, 0, lw.word, colorOf(HEX.magenta), colorOf(HEX.ledViolet));
          });
        }(f));
      }
    });
    surfaceSpecs(spec, colorOf);
    spec('none', 4, 4, null);
    Object.keys(DYNAMIC).forEach(function (name) { spec(name, DYNAMIC[name][0], DYNAMIC[name][1], null, true); });
    specs.sort(function (a, b) { return b.h - a.h || b.w - a.w || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
    specs.forEach(function (s) {
      var p = pack.place(s.w, s.h);
      if (!p) throw new Error('SLVoxGL atlas: built-in cell ' + s.name + ' does not fit');
      cells[s.name] = { name: s.name, x: p.x, y: p.y, w: s.w, h: s.h, draw: s.draw, dyn: s.dyn };
      paint(cells[s.name]);
    });
    if (ctx) ctx.putImageData(img, 0, 0);

    function uvOf(c) {
      return uvs[c.name] || (uvs[c.name] = Object.freeze([c.x / W, 1 - (c.y + c.h) / H, (c.x + c.w) / W, 1 - c.y / H]));
    }
    function lookup(name) {
      if (cells[name]) return cells[name];
      if (typeof name === 'string' && name.indexOf('portrait:') === 0) return cells.paw;     /* D76 */
      return null;
    }

    /* ---- the dynamic cells ---- */
    function drawName() {
      var c = cells.nameCell, n = signNameOf(user.name), gap = textWidth(n, 1) <= c.w - 2 ? 1 : 0, w = textWidth(n, gap);
      c.draw = n ? function (p) { p.text(Math.floor((c.w - 1 - w) / 2), 2, n, WHITE, INK, gap); } : null;
      paint(c); flush(c);
    }
    function drawInitial() {
      var c = cells.initialCell, m = /[A-ZÀ-ÖØ-Þ]/.exec(signNameOf(user.name)), ch = m ? m[0] : '', w = textWidth(ch);
      c.draw = ch ? function (p) { p.text(Math.floor((c.w - 1 - w) / 2), 2, ch, WHITE, INK); } : null;
      paint(c); flush(c);
    }
    /* the child's emoji, drawn large and nearest-sampled to 16×16 pixel art (browser only;
       elsewhere the face stays clear: a plain hood) */
    function drawFace() {
      var c = cells.avatarFace, face = emojiPixels(st, user.avatar);
      c.draw = face ? function (p) { for (var i = 0; i < 256; i++) if (face[i * 4 + 3]) p.put(i % 16, i >> 4, [face[i * 4], face[i * 4 + 1], face[i * 4 + 2], 255]); } : null;
      paint(c); flush(c);
    }

    var atlas = {
      W: W, H: H, texture: null,
      cell: function (name) { var c = lookup(name); return c ? uvOf(c) : null; },
      has: function (name) { return !!cells[name]; },
      rect: function (name) { var c = lookup(name); return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null; },
      names: function () { return Object.keys(cells); },
      get version() { return version; },
      /* a pixel-art cell for a model factory: {w, h, rows, pal} or {w, h, draw(ctx)} → [u0, v0, u1, v1] | null */
      define: function (name, o) {
        o = o || {};
        var w = o.w | 0 || (o.rows ? Math.max.apply(null, o.rows.map(function (r) { return r.length; })) : 0), h = o.h | 0 || (o.rows ? o.rows.length : 0);
        if (typeof name !== 'string' || !name) return null;
        var c = cells[name];
        if (c && (c.dyn || DYNAMIC[name])) { st.warn('atlas: "' + name + '" is a built-in dynamic cell'); return null; }
        if (c && (c.w !== w || c.h !== h)) { st.warn('atlas: "' + name + '" is already ' + c.w + '×' + c.h); return uvOf(c); }
        if (!c) {
          var p = pack.place(w, h);
          if (!p) { st.warn('atlas: full, "' + name + '" (' + w + '×' + h + ') not defined'); return null; }
          c = cells[name] = { name: name, x: p.x, y: p.y, w: w, h: h, draw: null, dyn: false };
        }
        c.draw = typeof o.draw === 'function' ? function (pp) { o.draw(pixelCtx(pp, colorOf)); }
          : o.rows ? function (pp) { pp.rows(0, 0, o.rows, o.pal || {}); } : null;
        paint(c); flush(c);
        return uvOf(c);
      },
      /* only nameCell, initialCell and avatarFace are redrawn, and only when they change */
      setUser: function (u) {
        u = u || {};
        var name = typeof u.name === 'string' ? u.name : user.name, avatar = typeof u.avatar === 'string' ? u.avatar : user.avatar;
        var renamed = signNameOf(name) !== signNameOf(user.name), reface = avatar !== user.avatar;
        user.name = name; user.avatar = avatar; if (u.color != null) user.color = u.color;
        if (renamed) { drawName(); drawInitial(); }
        if (reface) drawFace();
        return atlas;
      },
      /* the booth strip (on a tap only): four 12-px frames on the strip paper — the pet's
         portrait, the same a row higher (a hop), mirrored (a look round), then the child's face */
      setStrip: function (petId) {
        var c = cells.photoStrip, pc = lookup('portrait:' + (petId || 'pet_puppy')), fc = cells.avatarFace;
        function src(cell, x, y) { var o = ((cell.y + y) * W + cell.x + x) * 4; return px[o + 3] ? [px[o], px[o + 1], px[o + 2], 255] : null; }
        c.draw = function (p) {
          p.rect(0, 0, c.w, c.h, WHITE);
          p.rect(0, 0, 2, c.h, colorOf(user.color || HEX.pink)); p.rect(c.w - 2, 0, 2, c.h, colorOf(user.color || HEX.pink));   /* member-colour edges */
          for (var f = 0; f < 3; f++) for (var y = 0; y < 12; y++) for (var x = 0; x < 12; x++) {
            var sy = f === 1 ? y + 1 : y, col = sy < 12 ? src(pc, f === 2 ? 11 - x : x, sy) : null;
            if (col) p.put(6 + x, f * 12 + y, col);
          }
          for (y = 0; y < 12; y++) for (x = 0; x < 12; x++) { var fcol = src(fc, Math.floor(x * 4 / 3), Math.floor(y * 4 / 3)); if (fcol) p.put(6 + x, 36 + y, fcol); }
        };
        paint(c); flush(c);
        return atlas;
      },
      /* blank every dynamic cell (profile switch, kit dispose) */
      clearUser: function () {
        user = { name: '', color: null, avatar: '' };
        Object.keys(DYNAMIC).forEach(function (n) { var c = cells[n]; c.draw = null; paint(c); flush(c); });
        return atlas;
      },
      dispose: function () { atlas.clearUser(); atlas.texture.dispose(); }
    };
    var tex = atlas.texture = new T.CanvasTexture(ctx ? canvas : { width: W, height: H, data: px });
    tex.colorSpace = T.SRGBColorSpace;
    tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    tex.anisotropy = 1; tex.name = 'vox-atlas';
    return atlas;
  }
  /* define()'s draw(ctx): a pixel context, integer rects only, clipped to the cell */
  function pixelCtx(p, colorOf) {
    var fill = colorOf('#FFFFFF');
    return {
      get fillStyle() { return fill; },
      set fillStyle(v) { fill = colorOf(v); },
      fillRect: function (x, y, w, h) { p.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), fill); },
      clearRect: function (x, y, w, h) { p.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), [0, 0, 0, 0]); },
      putPixel: function (x, y, c) { p.put(x | 0, y | 0, colorOf(c)); }
    };
  }
  function emojiPixels(st, emoji) {
    var e = Array.from(String(emoji || '')).slice(0, 2).join('');
    if (!e) return null;
    var c = makeCanvas(st, 64, 64), g = c && c.getContext && c.getContext('2d');
    if (!g || typeof g.fillText !== 'function' || typeof g.getImageData !== 'function') return null;
    try {
      g.clearRect(0, 0, 64, 64);
      g.font = '54px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(e, 32, 36);
      var d = g.getImageData(0, 0, 64, 64).data, out = new Uint8ClampedArray(16 * 16 * 4);
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var s = ((y * 4 + 2) * 64 + x * 4 + 2) * 4, o = (y * 16 + x) * 4;
        if (d[s + 3] >= 128) { out[o] = d[s]; out[o + 1] = d[s + 1]; out[o + 2] = d[s + 2]; out[o + 3] = 255; }
      }
      return out;
    } catch (err) { return null; }
  }
  /* windows, doors, glass, porthole, counter cups, speaker, door mat, chequer (no letters) */
  function surfaceSpecs(spec, colorOf) {
    var W = HEX.white, b = HEX.glass, s = HEX.glassHi, pal = { W: W, b: b, s: s, P: HEX.curtain, r: '#9AA0B8' };
    [['window:pane', ['WWWWWWWW', 'WPbbWbPW', 'WbsbWbbW', 'WbbsWbsW', 'WWWWWWWW', 'WbbbWbbW', 'WbsbWbbW', 'WWWWWWWW']],
      ['window:round', ['..WWWW..', '.WbbsbW.', 'WbbsbbbW', 'WWWWWWWW', 'WbbbWbbW', 'WbbbWbsW', '.WbbWbW.', '..WWWW..']],
      ['window:shine', ['WWWWWWWW', 'WbbbbssW', 'WbbbssbW', 'WbbssbbW', 'WbssbbbW', 'WssbbbbW', 'WsbbbbbW', 'WWWWWWWW']],
      ['porthole', ['..rrrr..', '.rbbsbr.', 'rbbsbbbr', 'rbsbbbbr', 'rbbbbbbr', 'rbbbbbbr', '.rbbbbr.', '..rrrr..']]
    ].forEach(function (d) { spec(d[0], 8, 8, function (p) { p.rows(0, 0, d[1], pal); }); });
    [['blue', '#3B7DD8', '#2E63B0', '#3570C4'], ['red', '#D94B4B', '#B23A3A', '#C74343'], ['green', '#38A85C', '#2A8547', '#319651']].forEach(function (d) {
      spec('door:' + d[0], 12, 16, function (p) {
        var base = colorOf(d[1]), dark = colorOf(d[2]), mid = colorOf(d[3]);
        for (var y = 0; y < 16; y++) for (var x = 0; x < 12; x++) {
          if ((y === 0 && (x < 2 || x > 9)) || (y === 1 && (x === 0 || x === 11))) continue;
          var c = base;
          if (x === 0 || x === 11 || y === 0 || (y === 1 && (x === 1 || x === 10)) || y >= 14) c = dark;
          else if ((x === 4 || x === 7) && y > 8) c = mid;
          p.put(x, y, c);
        }
        p.rows(3, 3, ['.#..#.', '######', '######', '.####.', '..##..'], { '#': '#FF8FB8' });
        p.put(4, 4, colorOf('#FFD6E6'));
        p.rows(8, 9, ['##', '##'], { '#': HEX.gold });
      });
    });
    spec('door:glass', 8, 12, function (p) {
      for (var y = 0; y < 12; y++) for (var x = 0; x < 8; x++) p.put(x, y, colorOf(x === 0 || x === 7 || y === 0 || y === 11 ? W : (x + y) % 7 === 0 ? s : '#A6E8FF'));
      p.rows(5, 4, ['#', '#'], { '#': HEX.white });
    });
    spec('glassWall', 16, 12, function (p) {
      for (var y = 0; y < 12; y++) for (var x = 0; x < 16; x++) {
        var frame = x === 0 || x === 15 || x === 8 || y === 0 || y === 11, shine = (x + y) % 9 === 0 || (x + y) % 9 === 1;
        p.put(x, y, colorOf(frame ? W : shine ? s : '#A6E8FF'));
      }
    });
    spec('counterCups', 16, 8, function (p) {
      for (var y = 0; y < 8; y++) p.rect(0, y, 16, 1, colorOf(y < 5 ? '#FBEAFF' : y === 5 ? '#FF8FC0' : '#FFF6FB'));
      p.rect(0, 4, 16, 1, colorOf(HEX.lilac));
      [['#FF7AB6', 2], ['#B98CFF', 6], ['#7FE0C2', 10]].forEach(function (cx) { p.rows(cx[1], 0, ['.#.', '###', 'ccc', 'cpc'], { '#': HEX.white, c: cx[0], p: HEX.pearl }); });
    });
    spec('speaker', 8, 8, function (p) {
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        var d = Math.sqrt((x - 3.5) * (x - 3.5) + (y - 3.5) * (y - 3.5));
        p.put(x, y, colorOf(x === 0 || y === 0 || x === 7 || y === 7 ? HEX.speaker : d < 1.3 ? '#9FA3D6' : d < 2.4 ? '#24253D' : d < 3.3 ? '#7C80B8' : '#2A2B45'));
      }
    });
    spec('doorMat', 8, 4, function (p) { for (var y = 0; y < 4; y++) for (var x = 0; x < 8; x++) p.put(x, y, colorOf((x + y) % 2 ? '#FF8FB8' : HEX.gold)); });
    spec('chequer', 8, 8, function (p) { for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) p.put(x, y, colorOf(((x >> 1) + (y >> 1)) % 2 ? HEX.chequer : HEX.white)); });
  }

  /* ================================================================
     GEOMETRY HELPERS
     ================================================================ */
  function f32(a, n) { return a instanceof Float32Array ? a : a ? new Float32Array(a) : new Float32Array(n || 0); }
  /* face frames (normal, right, up): 'top-left' is the same corner on every face */
  var FACES = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  var QUAD = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  /* a cube of edge s (centred), non-indexed, white, vuv 0..1 per face in the given mode */
  function cubeArrays(s, mode) {
    var P = [], N = [], C = [], V = [], h = s / 2;
    FACES.forEach(function (f) {
      var n = f[0], r = f[1], u = f[2];
      QUAD.forEach(function (q) {
        for (var k = 0; k < 3; k++) { P.push((n[k] + r[k] * q[0] + u[k] * q[1]) * h); N.push(n[k]); C.push(1); }
        V.push((q[0] + 1) / 2, (q[1] + 1) / 2, mode);
      });
    });
    return { position: P, normal: N, color: C, vuv: V };
  }
  function modeOf(m, d) { return typeof m === 'number' ? m : Object.prototype.hasOwnProperty.call(MODES, m) ? MODES[m] : d; }
  /* the inverse-transpose 3×3 of a column-major 4×4 (for normals) */
  function normalMat(e) {
    var a = e[0], b = e[1], c = e[2], d = e[4], f = e[5], g = e[6], h = e[8], i = e[9], j = e[10];
    var c00 = f * j - g * i, c01 = c * i - b * j, c02 = b * g - c * f, c10 = g * h - d * j, c11 = a * j - c * h, c12 = c * d - a * g;
    var c20 = d * i - f * h, c21 = b * h - a * i, c22 = a * f - b * d, det = a * c00 + d * c01 + h * c02;
    if (!det) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    var r = 1 / det;
    /* the rows of the inverse-transpose are the cofactor rows / det */
    return [c00 * r, c01 * r, c02 * r, c10 * r, c11 * r, c12 * r, c20 * r, c21 * r, c22 * r];
  }
  function arraysOfGeo(g) {
    var a = g.attributes, n = a.position.count;
    return { position: a.position.array, normal: a.normal ? a.normal.array : null, color: a.color ? a.color.array : null, vuv: a.vuv ? a.vuv.array : null, count: n };
  }
  /* concatenate sources [{arrays, matrix?, rgb?}] into one set of arrays */
  function concat(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].arrays.position.length;
    var P = new Float32Array(total), N = new Float32Array(total), C = new Float32Array(total), V = new Float32Array(total), off = 0;
    for (i = 0; i < list.length; i++) {
      var s = list[i], a = s.arrays, m = s.matrix ? s.matrix.elements || s.matrix : null, nm = m ? normalMat(m) : null;
      var rgb = s.rgb || [1, 1, 1], p = a.position, n = a.normal, c = a.color, v = a.vuv, len = p.length;
      for (var j = 0; j < len; j += 3) {
        var x = p[j], y = p[j + 1], z = p[j + 2], o = off + j;
        if (m) { P[o] = m[0] * x + m[4] * y + m[8] * z + m[12]; P[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; P[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; }
        else { P[o] = x; P[o + 1] = y; P[o + 2] = z; }
        var nx = n ? n[j] : 0, ny = n ? n[j + 1] : 1, nz = n ? n[j + 2] : 0;
        if (nm) {
          var tx = nm[0] * nx + nm[1] * ny + nm[2] * nz, ty = nm[3] * nx + nm[4] * ny + nm[5] * nz, tz = nm[6] * nx + nm[7] * ny + nm[8] * nz;
          var l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          nx = tx / l; ny = ty / l; nz = tz / l;
        }
        N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
        C[o] = (c ? c[j] : 1) * rgb[0]; C[o + 1] = (c ? c[j + 1] : 1) * rgb[1]; C[o + 2] = (c ? c[j + 2] : 1) * rgb[2];
        if (v) { V[o] = v[j]; V[o + 1] = v[j + 1]; V[o + 2] = v[j + 2]; } else { V[o] = 0.5; V[o + 1] = 0.5; V[o + 2] = 0; }
      }
      off += len;
    }
    return { position: P, normal: N, color: C, vuv: V };
  }

  /* ================================================================
     THE PER-TIER VIEW (K.vox)
     ================================================================ */
  function makeView(st, tier) {
    var T = st.T;
    function K() { return st.K(tier); }
    function geoOf(a) {
      var n = a.position.length;
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(f32(a.position), 3));
      g.setAttribute('normal', new T.BufferAttribute(f32(a.normal, n), 3));
      g.setAttribute('color', new T.BufferAttribute(a.color ? f32(a.color) : new Float32Array(n).fill(1), 3));
      var v = a.vuv ? f32(a.vuv) : new Float32Array(n);
      if (!a.vuv) for (var i = 0; i < n; i += 3) { v[i] = 0.5; v[i + 1] = 0.5; }
      g.setAttribute('vuv', new T.BufferAttribute(v, 3));
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    }
    function rgbOf(c) {
      if (c == null) return null;
      if (Array.isArray(c)) return c;
      var col = c.isColor ? c : st.color(c);
      return [col.r, col.g, col.b];
    }
    function colorFn() { return function (token) { var c = st.color(token); return [c.r, c.g, c.b]; }; }
    function cellFn() {
      var A = st.atlas();
      return function (name) {
        var uv = A.cell(name);
        if (!uv) { st.warn('decal cell "' + name + '" is not in the atlas (drawn clear)'); uv = A.cell('none'); }
        return uv;
      };
    }
    function meshOf(model, o) {
      o = o || {};
      var V = st.mesher(), opt = { tier: o.tier || tier, lod: o.lod || 0, full: !!o.full, colorOf: colorFn(), cellOf: cellFn() };
      if (!o.full) opt.cull = o.cull != null ? o.cull : model && model.cull != null ? model.cull : null;
      if (opt.cull == null) delete opt.cull;
      return V.mesh(model, opt);
    }
    function matOf(m) {
      if (m && m.isMaterial) return m;
      if (m === 'vox:water') return st.mat('vox:water', K());
      if (typeof m === 'string' && VARIANTS[m]) return st.variant(m, K());
      return st.mat('vox', K());
    }
    /* every vox InstancedMesh: instanceColor allocated (white), so one program (D61) */
    function instanced(geo, material, cap) {
      var im = new T.InstancedMesh(geo, material, cap);
      im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      return im;
    }
    function single(arrays, o) {
      o = o || {};
      var im = instanced(geoOf(arrays), matOf(o.material), 1);
      im.count = 1; im.name = o.name || 'vox';
      im.castShadow = !!o.castShadow; im.receiveShadow = o.receiveShadow !== false;
      if (o.renderOrder != null) im.renderOrder = o.renderOrder;
      if (o.frustumCulled === false) im.frustumCulled = false;
      else im.computeBoundingSphere();
      return im;
    }
    /* a template's parts at rest, state parts in their initial colour */
    function tplSources(tpl, matrix, rgb) {
      return tpl.parts.map(function (p) {
        var c = rgb || [1, 1, 1], sc = p.stateColor;
        if (sc && sc.offC) {
          var f = sc.initial || 0, r = sc.offC.r + (sc.onC.r - sc.offC.r) * f, g = sc.offC.g + (sc.onC.g - sc.offC.g) * f, b = sc.offC.b + (sc.onC.b - sc.offC.b) * f;
          c = [c[0] * r, c[1] * g, c[2] * b];
        }
        return { arrays: arraysOfGeo(p.geo), matrix: matrix, rgb: c };
      });
    }
    function pool(mesh, cap, onFree) {
      var free = [], used = new Uint8Array(cap), hi = 0, dirty = false;
      for (var i = cap - 1; i >= 0; i--) free.push(i);
      var p = {
        mesh: mesh, capacity: cap,
        alloc: function () {
          if (!free.length) return -1;
          var k = free.pop(); used[k] = 1;
          if (k + 1 > hi) { hi = k + 1; mesh.count = hi; }
          return k;
        },
        free: function (k) {
          if (k < 0 || k >= cap || !used[k]) return;
          used[k] = 0; onFree(k); free.push(k); dirty = true;
          while (hi > 0 && !used[hi - 1]) hi--;
          mesh.count = hi;
        },
        tint: function (k, c) { var r = rgbOf(c); if (r) { mesh.instanceColor.array.set(r, k * 3); dirty = true; } },
        touch: function () { dirty = true; },
        commit: function () { if (dirty) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; dirty = false; } },
        clear: function () {
          free.length = 0;
          for (var k = cap - 1; k >= 0; k--) { free.push(k); used[k] = 0; onFree(k); }
          hi = 0; mesh.count = 0; dirty = true;
        },
        dispose: function () { if (mesh.parent) mesh.parent.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); st.live.delete(p); }
      };
      for (i = 0; i < cap; i++) onFree(i);
      st.live.add(p);
      return p;
    }
    function zeroAt(mesh) { return function (k) { var a = mesh.instanceMatrix.array, b = k * 16; for (var i = 0; i < 16; i++) a[b + i] = 0; a[b + 15] = 1; }; }

    var view = {
      tier: tier, MODES: MODES, uniforms: st.uniforms,
      get K() { return K(); },
      atlas: function () { return st.atlas(); },
      mat: function (key) { return matOf(key || 'vox'); },
      variant: function (name) { return st.variant(name, K()); },
      matUniforms: function (m) { return st.matUniforms(m); },
      cloneMat: function (m, o) { return st.cloneMat(m, o); },
      setWater: function (tex) { st.waterU.value = tex || null; return view; },
      setShow: function (k) { st.setShow(k); },
      fitGain: function (hemi, sun) { return st.fitGain(hemi, sun); },
      setGain: function (g) { return st.setGain(g); },

      template: function (ctx, model) {
        var Kt = K(), look = (ctx && ctx.look) || {};
        var o = { full: !!(ctx && ctx.full), lod: (ctx && ctx.lod) || 0 };
        if (!o.full && (!model || model.cull == null)) {
          var V = st.mesher();
          if (typeof V.cullFor === 'function') o.cull = V.cullFor(look.kind, { tall: (look.h || 0) > 4 });
        }
        var res = meshOf(model, o), b = Kt.template(ctx);
        res.parts.forEach(function (p) {
          if (!p.arrays || !p.arrays.position || !p.arrays.position.length) return;
          b.part(p.name, [geoOf(p.arrays)], 'vox', { pivot: p.pivot || undefined, perCopy: !!p.perCopy, castShadow: p.castShadow !== false,
            outline: false, stateColor: p.stateColor || undefined, receiveShadow: true });
        });
        Object.keys(res.pivots || {}).forEach(function (n) { var pv = res.pivots[n]; b.pivot(n, pv.origin, pv.parent || undefined); });
        Object.keys(res.anchors || {}).forEach(function (n) {
          var a = res.anchors[n], at = Array.isArray(a) ? a : a.at;
          b.anchor(n, at, a && a.pivot ? { pivot: a.pivot } : undefined);
        });
        var hit = (model && model.hit) || res.hit;
        if (Array.isArray(hit) && hit.length === 3) b.hit(hit);
        return b;
      },
      geometry: function (model, o) {
        var res = meshOf(model, o);
        return res.parts.filter(function (p) { return p.arrays && p.arrays.position && p.arrays.position.length; }).map(function (p) {
          return { name: p.name, geo: geoOf(p.arrays), pivot: p.pivot || null, stateColor: p.stateColor || null, perCopy: !!p.perCopy, castShadow: p.castShadow !== false };
        });
      },
      terrainMesh: function (src, o) {
        o = o || {};
        var arrays = src && src.position ? src
          : concat(meshOf(src, o).parts.filter(function (p) { return p.arrays && p.arrays.position; }).map(function (p) { return { arrays: p.arrays }; }));
        return single(arrays, { material: o.material, name: o.name || 'vox-terrain', castShadow: o.castShadow, receiveShadow: o.receiveShadow,
          renderOrder: o.renderOrder, frustumCulled: o.frustumCulled });
      },
      bakeStatic: function (list, o) {
        o = o || {};
        var srcs = [];
        (list || []).forEach(function (e) {
          if (!e) return;
          var m = e.matrix || null, rgb = rgbOf(e.color);
          if (e.tpl && e.tpl.parts) srcs.push.apply(srcs, tplSources(e.tpl, m, rgb));
          else if (e.geo && e.geo.isBufferGeometry) srcs.push({ arrays: arraysOfGeo(e.geo), matrix: m, rgb: rgb });
          else if (e.arrays && e.arrays.position) srcs.push({ arrays: e.arrays, matrix: m, rgb: rgb });
        });
        return single(concat(srcs), { material: o.material, name: o.name || 'vox-bake', castShadow: o.castShadow, receiveShadow: o.receiveShadow,
          renderOrder: o.renderOrder, frustumCulled: o.frustumCulled });
      },
      instancedCubes: function (capacity, o) {
        o = o || {};
        var cap = Math.max(1, capacity | 0 || 32), size = o.size > 0 ? o.size : 1;
        var mesh = instanced(geoOf(cubeArrays(size, modeOf(o.mode, MODES.block))), matOf(o.material), cap);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.instanceColor.setUsage(T.DynamicDrawUsage);
        mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !!o.receiveShadow;
        mesh.name = o.name || 'vox-cubes';
        var p = pool(mesh, cap, zeroAt(mesh));
        /* s: a uniform scale or [sx, sy, sz] of the pool's cube */
        p.set = function (k, x, y, z, s, color) {
          var a = mesh.instanceMatrix.array, b = k * 16, sx = Array.isArray(s) ? s[0] : s == null ? 1 : s;
          var sy = Array.isArray(s) ? s[1] : sx, sz = Array.isArray(s) ? s[2] : sx;
          for (var i = 0; i < 16; i++) a[b + i] = 0;
          a[b] = sx; a[b + 5] = sy; a[b + 10] = sz; a[b + 12] = x; a[b + 13] = y; a[b + 14] = z; a[b + 15] = 1;
          if (color != null) p.tint(k, color); else p.touch();
        };
        p.setMatrix = function (k, m, color) { mesh.setMatrixAt(k, m); if (color != null) p.tint(k, color); else p.touch(); };
        return p;
      },
      ghost: function (tpl, o) {
        o = o || {};
        var mesh = single(concat(tplSources(tpl, null, null)), { material: o.bad ? 'ghostBad' : 'ghost', name: 'vox-ghost:' + (tpl.id || ''),
          castShadow: false, receiveShadow: false, renderOrder: 3, frustumCulled: false });
        mesh.userData.setBad = function (bad) { mesh.material = st.variant(bad ? 'ghostBad' : 'ghost', K()); };
        return mesh;
      },
      cage: function () { return makeCage(st, view, instanced, geoOf); },
      blobs: function (capacity) {
        var cap = Math.max(1, capacity | 0 || 16);
        var mesh = instanced(geoOf(blobArrays(rgbOf('Blob Shadow'))), st.variant('shadow', K()), cap);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'vox-blobs'; mesh.castShadow = false; mesh.receiveShadow = false;
        var p = pool(mesh, cap, zeroAt(mesh));
        p.set = function (k, x, y, z, sx, sz) {
          var a = mesh.instanceMatrix.array, b = k * 16;
          for (var i = 0; i < 16; i++) a[b + i] = 0;
          a[b] = sx; a[b + 5] = 1; a[b + 10] = sz == null ? sx : sz; a[b + 12] = x; a[b + 13] = y + 0.006; a[b + 14] = z; a[b + 15] = 1;
          p.touch();
        };
        return p;
      },
      rig: function (def) { return makeRig(st, view, def || {}, colorFn(), cellFn()); },
      lod: function (model, n) { return st.mesher().lod(model, n); },
      stats: function (model, o) { return st.mesher().stats(model, o); }
    };
    view._geoOf = geoOf;
    return view;
  }

  /* the pixel blob shadow: a stepped rounded square of 8×8 texels on +y, glow mode */
  var BLOB_ROWS = [4, 6, 8, 8, 8, 8, 6, 4];
  function blobArrays(rgb) {
    var P = [], N = [], C = [], V = [], rows = [], y = 0;
    while (y < 8) { var y1 = y; while (y1 + 1 < 8 && BLOB_ROWS[y1 + 1] === BLOB_ROWS[y]) y1++; rows.push([y, y1, BLOB_ROWS[y]]); y = y1 + 1; }
    rows.forEach(function (r) {
      var x0 = (8 - r[2]) / 16 - 0.5, x1 = x0 + r[2] / 8, z0 = r[0] / 8 - 0.5, z1 = (r[1] + 1) / 8 - 0.5;
      [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]].forEach(function (q) {
        P.push(q[0], 0, q[1]); N.push(0, 1, 0); C.push(rgb[0], rgb[1], rgb[2]); V.push(0, 0, MODES.glow);
      });
    });
    return { position: P, normal: N, color: C, vuv: V };
  }

  /* ---------------- the selection cage (D9) ---------------- */
  function makeCage(st, view, instanced, geoOf) {
    var T = st.T, L = st.look(), o = L && L.MATERIAL && L.MATERIAL.outline;
    var w = o && o.pulse && o.pulse.length === 2 ? o.pulse : SEL_W;
    var mesh = instanced(geoOf(cubeArrays(1, MODES.glow)), view.mat('vox'), 24);
    var gold = st.color((o && o.selected) || 'Star Gold', HEX.gold);
    for (var i = 0; i < 24; i++) gold.toArray(mesh.instanceColor.array, i * 3);
    mesh.count = 24; mesh.name = 'vox-cage'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    mesh.visible = false; mesh.renderOrder = 2;
    var min = [-0.5, 0, -0.5], max = [0.5, 1, 0.5], world = new T.Matrix4(), local = new T.Matrix4(), out = new T.Matrix4(), now = -1;
    function pulseNow() { var u = st.hub.uniforms && st.hub.uniforms.uSelPulse; return u ? Math.max(0, Math.min(1, +u.value || 0)) : 0; }
    function layout(p) {
      now = p;
      var t = w[0] + (w[1] - w[0]) * p, n = 0;
      for (var c = 0; c < 8; c++) {
        var s = [c & 1, (c >> 1) & 1, (c >> 2) & 1], corner = [s[0] ? max[0] : min[0], s[1] ? max[1] : min[1], s[2] ? max[2] : min[2]];
        for (var a = 0; a < 3; a++) {
          var ext = max[a] - min[a], arm = Math.max(t, Math.min(0.45, 0.3 * ext)), d = s[a] ? -1 : 1, ctr = [0, 0, 0], sc = [t, t, t];
          for (var k = 0; k < 3; k++) ctr[k] = corner[k] + (s[k] ? t / 2 : -t / 2);
          ctr[a] = corner[a] + d * (arm - t) / 2; sc[a] = arm + t;
          local.makeScale(sc[0], sc[1], sc[2]).setPosition(ctr[0], ctr[1], ctr[2]);
          out.multiplyMatrices(world, local);
          mesh.setMatrixAt(n++, out);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    /* the pulse follows K.setSelPulse (the kit's uSelPulse) with no work while it is still */
    mesh.onBeforeRender = function () { var p = pulseNow(); if (p !== now) layout(p); };
    var cage = {
      mesh: mesh,
      /* box: a Box3 / {min, max} in item space, or a template hit [w, h, d] (base at y 0) */
      setBox: function (box, matrix) {
        if (Array.isArray(box)) { min = [-box[0] / 2, 0, -box[2] / 2]; max = [box[0] / 2, box[1], box[2] / 2]; }
        else if (box && box.min) {
          min = box.min.isVector3 ? [box.min.x, box.min.y, box.min.z] : box.min.slice();
          max = box.max.isVector3 ? [box.max.x, box.max.y, box.max.z] : box.max.slice();
        }
        if (matrix && matrix.isMatrix4) world.copy(matrix); else world.identity();
        layout(pulseNow());
        return cage;
      },
      pulse: function (p) { layout(Math.max(0, Math.min(1, +p || 0))); return cage; },
      get visible() { return mesh.visible; },
      set visible(v) { mesh.visible = !!v; },
      dispose: function () { if (mesh.parent) mesh.parent.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); st.live.delete(cage); }
    };
    layout(0);
    st.live.add(cage);
    return cage;
  }

  /* ---------------- rigs: rigid voxel skinning, one SkinnedMesh ---------------- */
  function parentTable(kind) {
    var CH = root.SLCharacters, t = {}, k;
    if (kind === 'pet') {
      for (k in PET_PARENT) t[k] = PET_PARENT[k];
      if (CH && CH.BONE_PARENT) for (k in CH.BONE_PARENT) t[k] = CH.BONE_PARENT[k];
      return t;
    }
    return kind === 'avatar' ? AV_PARENT : {};
  }
  function makeRig(st, view, def, colorOf, cellOf) {
    var T = st.T, V = st.mesher(), kind = def.kind || null, table = parentTable(kind);
    var list = (def.bones || []).map(function (b) { return { name: String(b.name), parent: b.parent || null, origin: b.origin || null }; });
    var by = {};
    list.forEach(function (b) { by[b.name] = b; });
    (def.ensure || Object.keys(table)).forEach(function (n) { if (!by[n]) list.push(by[n] = { name: n, parent: table[n] || null, origin: null }); });
    function originOf(b, depth) {
      if (b.origin) return b.origin;
      var p = b.parent && by[b.parent];
      return p && depth < 32 ? originOf(p, depth + 1) : [0, 0, 0];
    }
    function depthOf(b, d) { var p = b.parent && by[b.parent]; return p && d < 32 ? depthOf(p, d + 1) : d; }
    list.sort(function (a, b) { return depthOf(a, 0) - depthOf(b, 0); });
    var root3 = new T.Group(), bones = {}, order = [];
    root3.name = def.name || 'vox-rig';
    list.forEach(function (b) {
      var bone = new T.Bone(), o = originOf(b, 0), p = b.parent && bones[b.parent], po = p ? originOf(by[b.parent], 0) : [0, 0, 0];
      bone.name = b.name;
      bone.position.set(o[0] - po[0], o[1] - po[1], o[2] - po[2]);
      (p || root3).add(bone);
      bones[b.name] = bone; order.push(b.name);
    });
    root3.updateMatrixWorld(true);
    var skeleton = new T.Skeleton(order.map(function (n) { return bones[n]; }));
    /* each bone's voxels mesh on their own (every face kept: characters flip and tumble) */
    var srcs = [], bi = [], states = {}, count = 0;
    Object.keys(def.voxelsPerBone || {}).forEach(function (n) {
      var model = def.voxelsPerBone[n], idx = order.indexOf(n);
      if (!model) return;
      if (idx < 0) { st.warn('rig: voxels for unknown bone "' + n + '"'); return; }
      V.mesh(model, { tier: view.tier, full: true, colorOf: colorOf, cellOf: cellOf }).parts.forEach(function (p) {
        if (!p.arrays || !p.arrays.position || !p.arrays.position.length) return;
        var nv = p.arrays.position.length / 3;
        if (p.stateColor) (states[p.stateColor.key] = states[p.stateColor.key] || []).push({ start: count, count: nv, sc: p.stateColor });
        srcs.push({ arrays: p.arrays }); bi.push([idx, nv]);
        count += nv;
      });
    });
    var a = concat(srcs), SI = new Uint16Array(count * 4), SW = new Float32Array(count * 4), v = 0;
    bi.forEach(function (e) { for (var i = 0; i < e[1]; i++, v++) { SI[v * 4] = e[0]; SW[v * 4] = 1; } });
    var geo = view._geoOf(a);
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
    var grey = new Float32Array(a.color);                    /* AO grey: state parts get their colour from setState */
    var mesh = new T.SkinnedMesh(geo, view.mat('vox'));
    mesh.name = 'vox-rig'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    root3.add(mesh);
    mesh.bind(skeleton, new T.Matrix4());
    function attach(defs, prefix) {
      var out = {};
      Object.keys(defs || {}).forEach(function (n) {
        var d = defs[n], bn = d && d.bone && bones[d.bone] ? d.bone : order[0], at = (d && (d.at || (Array.isArray(d) ? d : null))) || [0, 0, 0];
        var o = originOf(by[bn], 0), obj = new T.Object3D();
        obj.name = prefix + n; obj.position.set(at[0] - o[0], at[1] - o[1], at[2] - o[2]);
        bones[bn].add(obj); out[n] = obj;
      });
      return out;
    }
    function setState(key, value) {
      var ranges = states[key], col = geo.getAttribute('color'), arr = col.array;
      if (!ranges) return false;
      ranges.forEach(function (r) {
        var sc = r.sc, c;
        if (typeof value === 'string' && sc.map && sc.map[value]) c = st.color(sc.map[value]);
        else {
          var f = value === true ? 1 : value === false ? 0 : typeof value === 'number' ? Math.max(0, Math.min(1, value)) : typeof sc.initial === 'number' ? sc.initial : sc.initial ? 1 : 0;
          var off = st.color(sc.off || 'Cloud White'), on = st.color(sc.on || sc.off || 'Cloud White');
          c = { r: off.r + (on.r - off.r) * f, g: off.g + (on.g - off.g) * f, b: off.b + (on.b - off.b) * f };
        }
        for (var i = r.start * 3, e = (r.start + r.count) * 3; i < e; i += 3) { arr[i] = grey[i] * c.r; arr[i + 1] = grey[i + 1] * c.g; arr[i + 2] = grey[i + 2] * c.b; }
      });
      col.needsUpdate = true;
      return true;
    }
    Object.keys(states).forEach(function (k) { setState(k, undefined); });
    var rig = {
      root: root3, bones: bones, skeleton: skeleton, mesh: mesh, tris: count / 3,
      sockets: attach(def.sockets, 'socket:'), anchors: attach(def.anchors, 'anchor:'),
      setState: setState,
      dispose: function () { if (root3.parent) root3.parent.remove(root3); geo.dispose(); skeleton.dispose(); st.live.delete(rig); }
    };
    st.live.add(rig);
    return rig;
  }

  return {
    VERSION: VERSION, MODES: MODES, ATLAS: ATLAS, DYNAMIC: DYNAMIC, BITMAPS: BITMAPS, SHADER: SHADER, VARIANTS: VARIANTS,
    PET_BONES: PET_BONES, PET_PARENT: PET_PARENT, AV_BONES: AV_BONES, AV_PARENT: AV_PARENT, PROGRAM_KEY: 'pixel-vox',
    bind: bind,
    /* pure helpers (Node-testable) */
    packer: packer, patchShader: patchShader, textWidth: textWidth, glyphOf: glyphOf, parseColor: parseColor, voxGain: voxGain,
    waterZ: waterZ, cubeArrays: cubeArrays, blobArrays: blobArrays, normalMat: normalMat
  };
}));
