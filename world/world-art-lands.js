/* ================================================================
   My Island v3 — SLWorldArtLands (W2.10): the 2D fallback art of the land shops (pure data, D100).
   window.SLWorldArtLands in the browser (slLoadWorld loads it after world-art.js), module.exports
   in Node. No DOM and nothing is drawn here: world-art.js owns the generator. One hand-drawn
   12 × 12 pictogram for each of the 76 themed things the land shops add: world-art.js draws a
   footprint-sized toy block in the item's LOOK colours with a pale plate on its front, and puts the
   pictogram on that plate inside the sprite's one '.slw-act slw-anim-<class>' group (the class is
   SLWorldCore.ACT_INFO's anim2d), so the whole picture is what a tap moves. The three added paths
   register a 12 × 12 ground tile instead: flat, seamless, no block and no act group.

   PIX[id] = { rows, pal }               a pictogram
           | { rows, pal, lit, on? }     a remembered toggle (st.lit)
           | { rows, pal, tile: true }   a path
     rows   12 strings of 12 characters, top row first: the rest pose. '.' is see-through (the
            plate shows) and every other character is a key of pal
     pal    {character: colour token}: plain SLIslandLook tokens only, so SLIslandLook.resolve(token)
            is '#RRGGBB' (no '@member', no '$slot', never a raw hex)
     lit    {character: token} laid over pal while st.lit is true: lamps go from PX Lamp Off to
            their glow, shutters and doors open, buds bloom, the squirrel looks out
     on     the 12 rows drawn while lit, when the lit picture has pixels the rest pose has not (the
            rays round a lamp, blossom on a vine). Authored as ONE bitmap: a character that is in
            lit but not in pal is a lit-only pixel; rows is the bitmap with those pixels blanked
   register(art) hands every entry to art.definePix(id, spec) as a fresh copy and returns the ids
   it took; it runs by itself in the browser when SLWorldArt.definePix is there. Nothing resolves
   a colour here: world-look.js loads after this file.

   DRAWING RULES. The plate is the item's main colour mixed 88% to white (a warm pale yellow while
   a toggle is lit) and a 1 × 1 block shows a pictogram pixel about 3 screen pixels wide, so:
     - every outline is a colour that shows on white; white, cream and snow sit INSIDE a darker
       shape or get a darker edge (snow things have an ice-blue outline)
     - chunky masses first, one-pixel detail only as an accent
     - a glow is a pale core in a dark frame, plus rays while lit; never a flame
     - the item's own LOOK colours, so the picture matches its block
   Original pixel art: no words, no letters, no 5-point star, no faces on rides, nothing
   weapon-like. Nothing here reads, awards or spends points.
   ================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLWorldArtLands = api;
  var art = root && root.SLWorldArt;
  if (art && typeof art.definePix === 'function') api.register(art);
}(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1, SIZE = 12, PIX = {};
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  /* a pictogram; with lit, a toggle. A character of lit that pal does not have is a lit-only
     pixel: the rest rows blank it and the drawn bitmap becomes the `on` rows */
  function P(id, pal, rows, lit) {
    var e = PIX[id] = { rows: rows, pal: pal }, only = Object.keys(lit || {}).filter(function (ch) { return !own(pal, ch); });
    if (lit) e.lit = lit;
    if (!only.length) return;
    e.on = rows;
    e.rows = rows.map(function (row) { return row.split('').map(function (ch) { return only.indexOf(ch) >= 0 ? '.' : ch; }).join(''); });
  }
  function T(id, pal, rows) { PIX[id] = { rows: rows, pal: pal, tile: true }; }

  /* ================= Theme Park Pier ================= */

  /* a lilac booth under a sunny scalloped pelmet: three bendy mirrors, each with its own wobbly shine; a coral mat */
  P('pier_mirrors', { y: 'PX Sunny', l: 'PX Lilac', b: 'PX Sky Blue', w: 'PX Lens Pale', c: 'PX Coral' }, [
    '.yyyyyyyyyy.',
    'yyyyyyyyyyyy',
    'y.yy.yy.yy.y',
    '.llllllllll.',
    '.lwblbblbbl.',
    '.lbwlwblbbl.',
    '.lbblbwlwbl.',
    '.lbblbblbwl.',
    '.lbblbblbbl.',
    '.llllllllll.',
    '.cccccccccc.',
    '..cccccccc..'
  ]);
  /* a banded coral mast, the sunny ring of seats part-way up, a blue cap with its bulbs */
  P('pier_droptower', { y: 'PX Sunny', b: 'PX Pier Stripe Blue', c: 'PX Coral', w: 'Cloud White', p: 'PX Pier Pile' }, [
    '....yyyy....',
    '...bbbbbb...',
    '....cccc....',
    '....cwwc....',
    '....cccc....',
    '.yyycwwcyyy.',
    '.yy.cccc.yy.',
    '....cwwc....',
    '....cccc....',
    '....cwwc....',
    '...pppppp...',
    '..pppppppp..'
  ]);
  /* the giant pink cup with its handle, on a blue saucer, on the turning mint floor */
  P('pier_teacups', { f: 'PX Jungle Flower Pink', p: 'PX Candy Pink', w: 'Cloud White', b: 'PX Pier Stripe Blue', m: 'PX Mint', t: 'PX Castle Teal' }, [
    '.ffffffff...',
    '.pppppppppp.',
    '.pwpppppp.pp',
    '.pwpppppp.pp',
    '.pwpppppp.pp',
    '.pppppppppp.',
    '..pppppp....',
    '...pppp.....',
    '.bbbbbbbbbb.',
    '..bbbbbbbb..',
    'mtmtmtmtmtmt',
    'tmtmtmtmtmtm'
  ]);
  /* a striped cone top on a mint column, four chairs flying out on their chains */
  P('pier_flyingchairs', { y: 'PX Sunny', p: 'PX Candy Pink', f: 'PX Jungle Flower Pink', i: 'PX Ice Pebble', m: 'PX Mint', c: 'PX Coral', b: 'PX Pier Stripe Blue', l: 'PX Lilac', o: 'PX Pier Pile' }, [
    '.....yy.....',
    '....pfpf....',
    '..fpfpfpfp..',
    'pfpfpfpfpfpf',
    'i.i..mm..i.i',
    'i.ll.mm.yy.i',
    'i.ll.mm.yy.i',
    'cc...mm...bb',
    'cc...mm...bb',
    '.....mm.....',
    '....mmmm....',
    '..oooooooo..'
  ]);
  /* the coral boat hanging in its blue A-frame, a sunny sail on the mast */
  P('pier_swingship', { b: 'PX Pier Stripe Blue', y: 'PX Sunny', d: 'PX Pier Pile', c: 'PX Coral', w: 'Cloud White' }, [
    '.....bb.....',
    '....bbbb....',
    '....byyb....',
    '...b.yy.b...',
    '...b.yy.b...',
    '..b..dd..b..',
    'cc...dd...cc',
    'cccccccccccc',
    '.cwcwccwcwc.',
    '..dddddddd..',
    '.b........b.',
    'bb........bb'
  ]);
  /* a stubby blue engine: a roofed cab, a sunny funnel with a puff of steam, a pink running board, coral wheels on the rails */
  P('pier_train', { s: 'PX Ice Pebble 2', b: 'PX Pier Stripe Blue', w: 'Cloud White', y: 'PX Sunny', p: 'PX Candy Pink', k: 'PX Castle Iron', c: 'PX Coral', d: 'PX Pier Pile' }, [
    '........s.s.',
    '.........s..',
    'kkkkkk..yy..',
    '.bbbb...yy..',
    '.bwwb.bbbbb.',
    '.bwwbbbbbbbb',
    '.bbbbbbbbbby',
    '.ppppppppppp',
    '.ccc.ccc.cc.',
    '.ckc.ckc.cc.',
    'dddddddddddd',
    'd.d.d.d.d.d.'
  ]);
  /* the yellow bumper car on its coral rubber rim, its pole up to the striped canopy, the chequered floor */
  P('pier_dodgems', { y: 'PX Sunny', o: 'Sunset Amber', k: 'PX Castle Iron', w: 'Cloud White', c: 'PX Coral', l: 'PX Lilac', v: 'PX Castle Banner' }, [
    'yoyoyoyoyoyo',
    'kkkkkkkkkkkk',
    '.......k....',
    '.......k....',
    '...yyy.k....',
    '..yyyyyyyy..',
    '.yywyyyyyyy.',
    'cccccccccccc',
    '.cccccccccc.',
    '..kk....kk..',
    'lvlvlvlvlvlv',
    'vlvlvlvlvlvl'
  ]);
  /* a log boat hitting the pool in a crown of drops, the mint bank below */
  P('pier_flume', { b: 'PX Pier Stripe Blue', p: 'PX Pier Pile', l: 'PX Jungle Rope', w: 'PX Pier Water 1', d: 'PX Castle Water 3', m: 'PX Mint' }, [
    '..b......b..',
    '.b..b..b..b.',
    '....b..b....',
    '..pp....pp..',
    '.lppppppppl.',
    '.lppppppppl.',
    'b.pppppppp.b',
    'wwbbwwwwbbww',
    'bbbbbbbbbbbb',
    'ddbbbbwwbbdd',
    'dddddddddddd',
    'mmmmmmmmmmmm'
  ]);
  /* one big loop of pink track with four bulbs, the coral car rolling in, blue stilts */
  P('pier_coaster', { f: 'PX Jungle Flower Pink', y: 'PX Sunny', c: 'PX Coral', b: 'PX Pier Stripe Blue' }, [
    '....ffff....',
    '...f....f...',
    '..y......y..',
    '..f......f..',
    '..f......f..',
    '..y......y..',
    'cccf....f...',
    'cyc.ffff....',
    'ffffffffffff',
    '.b..b..b..b.',
    '.b..b..b..b.',
    '.b..b..b..b.'
  ]);
  /* a pink cloud of floss on its stick over the striped cart, sunny wheels */
  P('pier_candyfloss', { p: 'PX Candy Pink', w: 'Cloud White', f: 'PX Jungle Flower Pink', d: 'PX Pier Pile', y: 'PX Sunny' }, [
    '...pppppp...',
    '.pppwpppppp.',
    'ppwpppppwppf',
    'pppppwppppff',
    '.ppppppppff.',
    '..fpppffff..',
    '.....dd.....',
    '.ffffffffff.',
    '.fwfwffwfwf.',
    '.ffffffffff.',
    '.yy......yy.',
    '.yy......yy.'
  ]);
  /* a red-and-white striped carton brimming over, three kernels in the air */
  P('pier_popcorn', { y: 'PX Sunny', k: 'PX Cream', c: 'PX Coral', w: 'Cloud White' }, [
    '...y...y....',
    '.y...y....y.',
    '...yyyyyy...',
    '..yykyyyyy..',
    '.yyyyyykyyy.',
    '.cccccccccc.',
    '.cwcwccwcwc.',
    '.cwcwccwcwc.',
    '.cwcwccwcwc.',
    '.cwcwccwcwc.',
    '.cccccccccc.',
    '..cccccccc..'
  ]);
  /* the giant roof cone over the striped kiosk, its hatch shut; lit = the hatch is up and a cone waits on the counter */
  P('pier_icecream', { f: 'PX Jungle Flower Pink', m: 'PX Mint', o: 'PX Waffle', p: 'PX Candy Pink', y: 'PX Sunny',
    S: 'PX Jungle Flower Pink', X: 'PX Jungle Flower Pink', Y: 'PX Jungle Flower Pink' }, [
    '.....ff.....',
    '....ffff....',
    '...mmmmmm...',
    '...oooooo...',
    '....oooo....',
    '.....oo.....',
    'pppppppppppp',
    'pfpfpfpfpfpf',
    'ppSSSXXSSSpp',
    'ppSSSYYSSSpp',
    'yyyyyyyyyyyy',
    'pppppppppppp'
  ], { S: 'PX Castle Iron', X: 'PX Mint', Y: 'PX Waffle' });
  /* a stripy sling in its wooden frame, the bucket and spade beside it */
  P('pier_deckchair', { d: 'PX Pier Pile', c: 'PX Coral', w: 'Cloud White', b: 'PX Pier Stripe Blue', y: 'PX Sunny' }, [
    '.dddddddd...',
    '.dcwcwcwd...',
    '.dcwcwcwd...',
    '.dcwcwcwd...',
    '.dcwcwcwd.b.',
    '.dcwcwcwd.b.',
    '.dcwcwcwd.b.',
    'ddddddddd.d.',
    'd.d...d.dyyy',
    'd.......dyyy',
    'd.......dccc',
    'd.......dyyy'
  ]);
  /* a bunch of plain round balloons tied to the striped stand */
  P('pier_balloons', { c: 'PX Coral', y: 'PX Sunny', m: 'PX Mint', l: 'PX Lilac', b: 'PX Pier Stripe Blue', w: 'Cloud White', s: 'PX Ice Pebble', d: 'PX Castle Water 3' }, [
    '.cc..yy..mm.',
    'cwccywyymwmm',
    'ccccyyyymmmm',
    '.ccllyybbmm.',
    '..lwllbwbb..',
    '..llllbbbb..',
    '...ll..bb...',
    '....s..s....',
    '.....ss.....',
    '.....ss.....',
    '....bdbd....',
    '...bdbdbd...'
  ]);
  /* a striped post, its crown of bulbs, two tails of bunting; lit = the bulbs glow and throw four rays */
  P('pier_lamppost', { b: 'PX Pier Stripe Blue', o: 'PX Lamp Off', O: 'PX Lamp Off', c: 'PX Coral', m: 'PX Mint', y: 'PX Sunny', p: 'PX Day Band 6', d: 'PX Castle Water 3' }, [
    '.r..bbbb..r.',
    '...oooooo...',
    'r..oOOOOo..r',
    '...oooooo...',
    '..c..bb..m..',
    '.y...pp...c.',
    'm....bb....y',
    '.....pp.....',
    '.....bb.....',
    '.....pp.....',
    '....bbbb....',
    '...dddddd...'
  ], { o: 'PX Sunny', O: 'PX Glint', r: 'Sunset Amber' });

  /* ================= Jungle Treehouse Village ================= */

  /* a striped hammock slung between two leafy bamboo posts */
  P('jungle_hammock', { g: 'PX Jungle Canopy', p: 'PX Jungle Bark Light', r: 'PX Jungle Rope', f: 'PX Jungle Flower Pink', b: 'PX Jungle Parrot Blue' }, [
    'gg........gg',
    'ggg......ggg',
    'pp........pp',
    'ppr......rpp',
    'pprf....brpp',
    'ppfbfbfbfbpp',
    'pp.bfbfbf.pp',
    'pp..fbfb..pp',
    'pp........pp',
    'pp........pp',
    'pp........pp',
    'pp........pp'
  ]);
  /* three hollow-log drums of different heights, pale skins, ringed sides, a fern and a bloom at the foot */
  P('jungle_drums', { s: 'PX Jungle Rope', l: 'PX Jungle Bark Light', d: 'PX Jungle Bark', g: 'PX Jungle Canopy Light', o: 'PX Jungle Flower Orange' }, [
    '............',
    '....ssss....',
    '....ssss....',
    '....dddd.sss',
    '....llll.sss',
    'sss.dddd.ddd',
    'sss.dddd.lll',
    'ddd.llll.ddd',
    'lll.dddd.ddd',
    'ddd.dddd.lll',
    'ddd.llll.ddd',
    'dddgddddoddd'
  ]);
  /* a bamboo frame: a ladder up each end, the rope rungs across the top, leaves on the rail */
  P('jungle_monkeybars', { g: 'PX Jungle Canopy', b: 'PX Jungle Bark Light', r: 'PX Jungle Rope' }, [
    '.gg......gg.',
    'bbbbbbbbbbbb',
    'b.rr.rr.rr.b',
    'bbbbbbbbbbbb',
    'b.b......b.b',
    'brb......brb',
    'b.b......b.b',
    'brb......brb',
    'b.b......b.b',
    'brb......brb',
    'b.b......b.b',
    'b.b......b.b'
  ]);
  /* a canvas tent with one green stripe, its flap open, a pennant on the pole; the brass spyglass on its tripod */
  P('jungle_camp', { p: 'PX Jungle Bark Light', y: 'PX Sunny', k: 'PX Khaki', g: 'PX Jungle Canopy Deep', d: 'PX Tree Bark' }, [
    '............',
    '....py......',
    '....pyy.....',
    '...kkkk.....',
    '..kkkkkk....',
    '..gggggg....',
    '.kkkkkkkk...',
    '.kkkddkkk.yy',
    'kkkkddkkkyy.',
    'kkkddddkk.p.',
    'kkkddddkkp.p',
    'kkddddddkp.p'
  ]);
  /* a thatched hideout on stilts, the rope ladder, the bamboo slide */
  P('jungle_den', { h: 'PX Banana', t: 'PX Jungle Thatch', w: 'PX Jungle Bark Light', k: 'PX Ink Eye', d: 'PX Jungle Bark', r: 'PX Jungle Rope', s: 'PX Jungle Canopy Light' }, [
    '...hhhh.....',
    '..tttttt....',
    '.tttttttt...',
    '..wwwwww....',
    '..wwkkww....',
    '..wwkkww.ss.',
    '.ddddddddss.',
    '.d.rrr.d.ss.',
    '.d.r.r.d..ss',
    '.d.rrr.d..ss',
    '.d.r.r.d...s',
    '.d.rrr.d...s'
  ]);
  /* a dugout canoe and its paddle on the creek, a lily by the pads */
  P('jungle_canoe', { o: 'PX Jungle Bark Light', h: 'PX Jungle Bark', w: 'PX Jungle Water 1', d: 'PX Jungle Water 2', g: 'PX Jungle Canopy', f: 'PX Jungle Flower Pink' }, [
    '............',
    '..o.........',
    '..oo........',
    '...o........',
    'o...o......o',
    'ho...o....oh',
    'hhoooooooohh',
    '.hhhhhhhhhh.',
    'wwhhhhhhhhww',
    'wwwwddwwwwww',
    'ddwwwwwwgfww',
    'wwwwddwwggww'
  ]);
  /* a leaf awning over a cart heaped with fruit: bananas, dragon fruit, mangoes, a pineapple on top */
  P('jungle_fruitstall', { g: 'PX Jungle Canopy', G: 'PX Jungle Canopy Light', p: 'PX Jungle Bark Light', m: 'PX Leaf 2', y: 'PX Banana', f: 'PX Jungle Flower Pink', o: 'PX Jungle Flower Orange', r: 'PX Jungle Parrot Red', d: 'PX Jungle Bark' }, [
    'gGgGgGgGgGgG',
    'gggggggggggg',
    'g.gg.gg.gg.g',
    'p....mm....p',
    'p....yy....p',
    'p...yyyy...p',
    'p.ffyyyyoo.p',
    'p.ffrryyoo.p',
    'pppppppppppp',
    '.pppppppppp.',
    '..dd....dd..',
    '..dd....dd..'
  ]);
  /* a thatched hut, its leaf shutter down; lit = rolled up: a basket, a flower pot, folded blankets */
  P('jungle_market', { h: 'PX Banana', t: 'PX Jungle Thatch', b: 'PX Jungle Bark Light', R: 'PX Jungle Canopy Light', c: 'PX Jungle Bark',
    A: 'PX Jungle Canopy', B: 'PX Jungle Canopy', C: 'PX Jungle Canopy', D: 'PX Jungle Canopy', E: 'PX Jungle Canopy', F: 'PX Jungle Canopy' }, [
    '....hhhh....',
    '..tttttttt..',
    '.tttttttttt.',
    'tttttttttttt',
    '.bRRRRRRRRb.',
    '.bAAADDAAAb.',
    '.bBBACCAEEb.',
    '.bBBACCAFFb.',
    '.cccccccccc.',
    '.cccccccccc.',
    '.b........b.',
    '.b........b.'
  ], { A: 'PX Tree Bark', B: 'PX Jungle Rope', C: 'PX Jungle Flower Orange', D: 'PX Jungle Flower Pink', E: 'PX Jungle Parrot Blue', F: 'PX Banana' });
  /* a coconut-shell cup brim-full of smoothie: a straw, a slice of fruit on the rim, a leaf mat */
  P('jungle_smoothie', { s: 'PX Jungle Parrot Blue', o: 'PX Jungle Flower Orange', y: 'PX Banana', b: 'PX Jungle Bark', l: 'PX Jungle Bark Light', L: 'PX Jungle Canopy' }, [
    '........ss..',
    '.......s....',
    '..oo...s....',
    '.oooo.s.....',
    '.yyyyyyyyyy.',
    'byyyyyyyyyyb',
    'bblbbbbbbbbb',
    'bbbbbbblbbbb',
    '.bbbbbbbbbb.',
    '..bblbbbbb..',
    '...bbbbbb...',
    '..LLLLLLLL..'
  ]);
  /* a woven shade under a leaf cap on a ringed bamboo pole; lit = a warm glow and four rays */
  P('jungle_lantern', { g: 'PX Jungle Canopy', t: 'PX Jungle Thatch', s: 'PX Jungle Thatch Shade', o: 'PX Lamp Off', O: 'PX Lamp Off', b: 'PX Jungle Bark Light', d: 'PX Jungle Bark', m: 'PX Jungle Moss Stone' }, [
    '....gggg....',
    '...gggggg...',
    'r..tststs..r',
    '...soOOot...',
    'r..toOOos..r',
    '...ststst...',
    '.....bb.....',
    '.....dd.....',
    '.....bb.....',
    '.....bb.....',
    '.....dd.....',
    '...mmmmmm...'
  ], { o: 'PX Sunny', O: 'PX Glint', r: 'Sunset Amber' });
  /* a mossy stone arch hung with vines; lit = every bud opens and blossom spills down the vines */
  P('jungle_arch', { g: 'PX Jungle Canopy Light', s: 'PX Jungle Moss Stone', d: 'PX Ice Pebble', v: 'PX Jungle Canopy', P: 'PX Jungle Canopy Light', O: 'PX Jungle Canopy Light' }, [
    '.gPgggOggPg.',
    'ssdsssssdsss',
    'sdssssssssds',
    'ssPvE..FvOss',
    'dssv....vssd',
    'ssOvF..EvPss',
    'sssv....vsds',
    'sPs......sOs',
    'sss......sss',
    'sds......ssd',
    'sOs......sPs',
    'ssd......dss'
  ], { P: 'PX Jungle Flower Pink', O: 'PX Jungle Flower Orange', F: 'PX Jungle Flower Pink', E: 'PX Jungle Flower Orange' });
  /* a bamboo wheel: golden spokes, a dark hub, four buckets of water */
  P('jungle_waterwheel', { t: 'PX Jungle Bark Light', s: 'PX Jungle Thatch', h: 'PX Jungle Bark', w: 'PX Jungle Water 2' }, [
    '....tttt....',
    '..wt.ss.tw..',
    '.wt..ss..tw.',
    '.t...ss...t.',
    't....ss....t',
    'tsssshhsssst',
    'tsssshhsssst',
    't....ss....t',
    '.t...ss...t.',
    '.wt..ss..tw.',
    '..wt.ss.tw..',
    '....tttt....'
  ]);
  /* a bright parrot on its T-perch */
  P('jungle_parrot', { r: 'PX Jungle Parrot Red', w: 'Cloud White', k: 'PX Ink Eye', y: 'PX Banana', b: 'PX Jungle Parrot Blue', p: 'PX Jungle Bark' }, [
    '............',
    '....rrrr....',
    '...rwkrrr...',
    '..yywwrrr...',
    '..y.rrrrbb..',
    '....rryybbb.',
    '....ryyybbb.',
    '....rryybbb.',
    '.....rrbbb..',
    'pppppppppbpp',
    '.....pp.bb..',
    '.....pp..r..'
  ]);
  /* big paddle leaves, a hanging bunch of bananas under a pink bud */
  P('jungle_banana', { g: 'PX Jungle Canopy Deep', G: 'PX Jungle Canopy Light', y: 'PX Banana', p: 'PX Jungle Flower Pink', d: 'PX Jungle Bark Light' }, [
    '..gg....gg..',
    '.gGGg..gGGg.',
    'gGGGGggGGGGg',
    'gGG.GGGG.GGg',
    'gG...dd...Gg',
    'g..yydd....g',
    '..yyydd.....',
    '..yyydd.....',
    '...ypdd.....',
    '.....dd.....',
    '.....dd.....',
    '....dddd....'
  ]);
  /* a tall leaning palm, ringed trunk, coconuts under the fronds */
  P('jungle_coconut', { l: 'PX Jungle Canopy', d: 'PX Jungle Canopy Deep', c: 'PX Jungle Bark', b: 'PX Jungle Bark Light', B: 'PX Jungle Rope' }, [
    '..lll..lll..',
    '.lddllllddl.',
    'ld..dlld..dl',
    'l..ccddcc..l',
    '...ccbbcc...',
    '.....bB.....',
    '....bb......',
    '....Bb......',
    '....bb......',
    '...bB.......',
    '...bb.......',
    '..bbbb......'
  ]);
  /* split-bamboo slats laid across, every third one golden, rope lashings at the edges */
  T('path_bamboo', { l: 'PX Jungle Bark Light', t: 'PX Jungle Thatch', n: 'PX Jungle Bark', r: 'PX Jungle Rope' }, [
    'rlllllnllllr',
    'rllllllllllr',
    'rllllllllllr',
    'nnnnnnnnnnnn',
    'rllnlllllllr',
    'rllllllllllr',
    'rllllllllllr',
    'nnnnnnnnnnnn',
    'rtttttttnttr',
    'rttttttttttr',
    'rttttttttttr',
    'nnnnnnnnnnnn'
  ]);

  /* ================= Treetop Adventure Park ================= */

  /* a plank wall dotted with holds in five colours, the brass bell on top */
  P('treetop_climbwall', { y: 'PX Sunny', b: 'PX Tree Bark', p: 'PX Tree Plank', a: 'PX Accent 1', s: 'PX Accent 2', c: 'PX Accent 3', g: 'PX Accent 4', v: 'PX Accent 5', t: 'PX Tree Bark Trail' }, [
    '.....yy.....',
    '....yyyy....',
    'bppppppppppb',
    'bpappppcpppb',
    'bppppgpppvpb',
    'bppsppppappb',
    'bpppppcppppb',
    'bpvppppppgpb',
    'bppppappsppb',
    'bpgppppppcpb',
    'bpppsppvpppb',
    'tttttttttttt'
  ]);
  /* a stave pod on a tall pegged pole under a leaf roof, the brass telescope poking out, a pennant */
  P('treetop_telescope', { g: 'PX Tree Pine Mid', b: 'PX Tree Flag', q: 'PX Tree Bark Trail', y: 'PX Sunny', p: 'PX Tree Rope', s: 'PX Tree Plank' }, [
    '.....gbb....',
    '....gggg....',
    '...gggggg...',
    '..gggggggg..',
    '...q....q...',
    '...q..yyyyyb',
    '..pppppppp..',
    '..sqsqsqsq..',
    '...qsqsqs...',
    '.....qq.....',
    '....pqq.....',
    '.....qqp....'
  ]);
  /* a diamond-mesh rope net slung over a log frame, a pennant at each end */
  P('treetop_cargonet', { f: 'PX Tree Flag', b: 'PX Tree Bark', n: 'PX Tree Rope' }, [
    'f..........f',
    'bbbbbbbbbbbb',
    'b.n...n...nb',
    'bn.n.n.n.n.b',
    'b...n...n..b',
    'bn.n.n.n.n.b',
    'b.n...n...nb',
    'bn.n.n.n.n.b',
    'b...n...n..b',
    'bn.n.n.n.n.b',
    'bb........bb',
    'bb........bb'
  ]);
  /* stump steps up to a jump deck with its pennant, a huge heap of autumn leaves, three in the air */
  P('treetop_leap', { f: 'PX Tree Flag', p: 'PX Tree Plank', b: 'PX Tree Bark', o: 'PX Tree Autumn', r: 'PX Tree Toadstool', y: 'PX Sunny', g: 'PX Tree Oak Light', t: 'PX Tree Bark Trail' }, [
    '.f..........',
    '.ff......r..',
    '.b....y.....',
    'pppp........',
    'bb.......g..',
    'bb.....oyo..',
    'bbb...oroyo.',
    'bbb..oygoroy',
    'bbbb.roygoyo',
    'bbbb.yoroyog',
    'bbbb.oyogoro',
    'bbbb.ttttttt'
  ]);
  /* a leafy tree tower, the sky-blue slide running down to the bark pit */
  P('treetop_bigslide', { g: 'PX Tree Pine Light', G: 'PX Tree Pine', p: 'PX Tree Plank', b: 'PX Tree Bark', r: 'PX Tree Rope', e: 'Sea Deep', s: 'PX Sky Blue', t: 'PX Tree Bark Trail' }, [
    '.gggg.......',
    'gGggGg......',
    '.gGgg.......',
    'ppppppee....',
    '.bb...sse...',
    'rbbr...sse..',
    '.bb.....sse.',
    'rbbr.....sse',
    '.bb.......ss',
    'rbbr.....tss',
    '.bb....ttttt',
    'rbbr...ttttt'
  ]);
  /* a timber tower under a leaf roof, the rope sloping down to its landing post, the handle on the line */
  P('treetop_zipline', { f: 'PX Tree Flag', g: 'PX Tree Pine Mid', b: 'PX Tree Bark', p: 'PX Tree Plank', t: 'PX Tree Bark Trail', r: 'PX Tree Rope', y: 'PX Sunny' }, [
    '.f..........',
    'ggg.........',
    'ggggg.......',
    'b...brr.....',
    'bpppb..rr...',
    'bt.tb..y.rr.',
    'b.t.b.yyy..b',
    'bt.tb......b',
    'b.t.b......b',
    'bt.tb......b',
    'b.t.b......b',
    'b...b....ttt'
  ]);
  /* a giant hollow log: growth rings round the mouth, moss on top, a toadstool */
  P('treetop_tunnel', { t: 'PX Tree Toadstool', w: 'Cloud White', m: 'PX Tree Moss', r: 'PX Tree Plank', n: 'PX Tree Rope', k: 'PX Ink Eye', b: 'PX Tree Bark Trail', B: 'PX Tree Bark' }, [
    '............',
    '........tt..',
    '.......twtt.',
    '..mmmmmmwwm.',
    '.rrrrbbbbbbb',
    'rrnnrrbbBbbb',
    'rnkknrbbbbBb',
    'rnkknrbBbbbb',
    'rnkknrbbbbbb',
    'rrnnrrbbbBbb',
    '.rrrrbbbbbbb',
    '............'
  ]);
  /* three log beams at three heights on their posts, moss on top, a pennant on the finish post */
  P('treetop_beams', { f: 'PX Tree Flag', d: 'PX Tree Bark', m: 'PX Tree Moss', b: 'PX Tree Bark Trail', t: 'PX Tree Bark Trail 2' }, [
    '............',
    '.........ffd',
    '..........fd',
    '....mmmm...d',
    '....bbbb...d',
    '....d..dmmmm',
    'mmmmd..dbbbb',
    'bbbbd..dd..d',
    'd..dd..dd..d',
    'd..dd..dd..d',
    'd..dd..dd..d',
    'tttttttttttt'
  ]);
  /* a plank tipped on a stump: a blue pad on the low end, the squirrel on its sunny pad at the high end */
  P('treetop_seesaw', { q: 'PX Tree Autumn', k: 'PX Ink Eye', c: 'PX Cream', y: 'PX Sunny', p: 'PX Tree Plank', b: 'PX Tree Flag', s: 'PX Tree Bark', t: 'PX Tree Bark Trail' }, [
    '.........q.q',
    '.........qqq',
    '.........kqk',
    '.........qcq',
    '........yyyy',
    '.......ppppp',
    'bb.ppppp....',
    'ppppp.......',
    '....ssss....',
    '....ssss....',
    '....ssss....',
    'ttt.ssss.ttt'
  ]);
  /* a blue tyre with a pale stripe on three ropes from a log frame */
  P('treetop_tyreswing', { b: 'PX Tree Bark', r: 'PX Tree Rope', t: 'PX Tree Flag', w: 'PX Day Band 6' }, [
    'bbbbbbbbbbbb',
    'b....rr....b',
    'b...r..r...b',
    'b...r..r...b',
    'b..r....r..b',
    'b..tttttt..b',
    'b.ttwwwwtt.b',
    'b.tw....wt.b',
    'b.ttwwwwtt.b',
    'b..tttttt..b',
    'b..........b',
    'bb........bb'
  ]);
  /* a roofed bird table with seed on the tray, a blue bird on the mossy ridge */
  P('treetop_birdtable', { B: 'PX Tree Flag', y: 'PX Sunny', k: 'PX Ink Eye', c: 'PX Tree Autumn', m: 'PX Tree Moss', r: 'PX Tree Bark Trail', p: 'PX Tree Bark', s: 'PX Tree Toadstool', t: 'PX Tree Plank' }, [
    '.....BB.....',
    '....yBkB....',
    '.....ccBB...',
    '....mmmm....',
    '..rrrrrrrr..',
    '.rrrrrrrrrr.',
    '..p......p..',
    '..p.s.ss.p..',
    '.tttttttttt.',
    '.....pp.....',
    '.....pp.....',
    '....pppp....'
  ]);
  /* a wicker basket on a red-and-white checked cloth, the table and its benches */
  P('treetop_picnic', { h: 'PX Tree Bark Trail', r: 'PX Tree Rope', c: 'PX Tree Toadstool', w: 'Cloud White', p: 'PX Tree Bark' }, [
    '....hhhh....',
    '...h....h...',
    '..rrrrrrrr..',
    '..rhrhrhrh..',
    '..hrhrhrhr..',
    'cwcwcwcwcwcw',
    'wcwcwcwcwcwc',
    'cccccccccccc',
    '.p........p.',
    'pppp....pppp',
    '.p........p.',
    '.p........p.'
  ]);
  /* five log bars stepping down in length, a colour cap on every end, a beater */
  P('treetop_xylophone', { a: 'PX Accent 1', y: 'PX Accent 2', c: 'PX Accent 3', g: 'PX Accent 4', v: 'PX Accent 5', l: 'PX Tree Plank', L: 'PX Tree Bark Trail 2', t: 'PX Tree Toadstool', s: 'PX Tree Bark' }, [
    '.aa.......tt',
    '.llyy.....tt',
    '.llLLcc...s.',
    '.llLLllgg.s.',
    '.llLLllLLvv.',
    '.llLLllLLll.',
    '.llLLllLLll.',
    '.llLLllLLvv.',
    '.llLLllgg...',
    '.llLLcc.....',
    '.llyy.......',
    '.aa.........'
  ]);
  /* a round wooden den up a trunk, hatch shut, a rope ladder; lit = the squirrel looks out */
  P('treetop_pod', { g: 'PX Tree Pine Mid', p: 'PX Tree Plank', h: 'PX Tree Bark Trail', b: 'PX Tree Bark', r: 'PX Tree Rope',
    A: 'PX Tree Bark Trail 2', B: 'PX Tree Bark Trail 2', C: 'PX Tree Bark Trail 2' }, [
    '.....gg.....',
    '....gggg....',
    '...gggggg...',
    '..pppppppp..',
    '.pphhhhhhpp.',
    '.pphAAAAhpp.',
    '.pphBAABhpp.',
    '.pphCCCChpp.',
    '..phhhhhhp..',
    '...pppppp...',
    '.....bbr....',
    '.....bbr....'
  ], { A: 'PX Tree Autumn', B: 'PX Ink Eye', C: 'PX Cream' });

  /* ================= Castle Kingdom ================= */

  /* a toy see-saw on a stone block: a basket heaped with flowers on the high end, a seat pad on the low one, petals in the air */
  P('castle_flinger', { f: 'PX Candy Pink', y: 'PX Castle Gold', l: 'PX Lilac', r: 'PX Jungle Rope', w: 'PX Castle Wood', c: 'PX Castle Pennant', s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade' }, [
    '.f.y..l.....',
    'l.f.y.......',
    '.fyfl.......',
    'lfyfy.......',
    'rrrrr.......',
    'rrrrr.......',
    'wwwww.......',
    'wwwwwwww..cc',
    '...wwwwwwwww',
    '...ssss.wwww',
    '..ssSsss....',
    '..ssssssS...'
  ]);
  /* a hobby horse with a purple mane at the start, the smiling padded dummy on its post, the striped rail */
  P('castle_joust', { m: 'PX Castle Banner', h: 'PX Tree Plank', k: 'PX Ink Eye', d: 'PX Castle Wood', s: 'PX Khaki', c: 'PX Castle Pennant', g: 'PX Castle Gold' }, [
    '............',
    '.mhh....sss.',
    'mmhhh..sssss',
    'mmhkhh.sksks',
    '.mhhhh.sssss',
    '.mhh...scccs',
    '..dd....sss.',
    '..dd.....d..',
    '..dd.....d..',
    '..dd.....d..',
    'cgcgcgcgcgcg',
    '.d...d...d..'
  ]);
  /* clipped hedges in a square spiral, gravel paths, the flag in the middle */
  P('castle_maze', { h: 'PX Tree Pine Mid', s: 'PX Castle Sandstone', f: 'PX Castle Pennant', y: 'PX Castle Gold' }, [
    'hhhhhhhhhhhh',
    'hssssssssssh',
    'hshhhhhhhhsh',
    'hshsssssshsh',
    'hshshhhhshsh',
    'hshshffhshsh',
    'hshshyshshsh',
    'hshshhshshsh',
    'hshsssssshsh',
    'hshhhhhhshsh',
    'hssssssssssh',
    'hhhhhhhhhhsh'
  ]);
  /* a golden throne, purple cushions, a round sun on its back, red carpet on the stone step */
  P('castle_throne', { y: 'PX Castle Gold', t: 'Gold Deep', p: 'PX Castle Banner', s: 'PX Castle Stone 2', r: 'PX Castle Pennant' }, [
    '...tt..tt...',
    '..tyyttyyt..',
    '..tppppppt..',
    '..tppyyppt..',
    '..tpyyyypt..',
    '..tpyyyypt..',
    '..tppyyppt..',
    'tttyyyyyyttt',
    'typpppppppyt',
    'tyyyyyyyyyyt',
    'tt.rrrrrr.tt',
    'sssrrrrrrsss'
  ]);
  /* a humpback stone bridge over its own strip of moat, a white duck under the arch */
  P('castle_bridge', { c: 'PX Castle Sandstone', s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade', w: 'PX Castle Cloth', y: 'PX Castle Gold', b: 'PX Castle Water 1', d: 'PX Castle Water 2' }, [
    '....cccc....',
    '..ccSSSScc..',
    'ccSSSsSSSScc',
    'SSsSbbbbSSsS',
    'SSSbbbbbbSSS',
    'SsSbbwybbSsS',
    'SSSbwwwbbSSS',
    'bbdbbbbbbdbb',
    'dbbbbdbbbbbd',
    'bbbdbbbbdbbb',
    'dbbbbbbdbbbb',
    'bbbdbbbbbbdb'
  ]);
  /* two flat-topped turrets and the big banded doors under a gold crest; lit = the doors stand open on sky and meadow */
  P('castle_gate', { f: 'PX Castle Pennant', s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade', w: 'PX Castle Window', y: 'PX Castle Gold', E: 'PX Castle Wood',
    D: 'PX Castle Wood', I: 'PX Castle Iron', G: 'PX Castle Wood' }, [
    '.f........f.',
    'S.S......S.S',
    'sss......sss',
    'sssS.SS.Ssss',
    'sswsssssswss',
    'sssssyysssss',
    'ssssDDDDssss',
    'sssEDDDDEsss',
    'sssEIDDIEsss',
    'sssEDDDDEsss',
    'sssEIDDIEsss',
    'sssEGGGGEsss'
  ], { D: 'PX Sky Blue', I: 'PX Sky Blue', G: 'PX Castle Meadow 2' });
  /* a round stone tower with a flat top, sandstone steps winding up the outside, the gold bell under its roof, a flag */
  P('castle_tower', { w: 'PX Castle Wood', y: 'PX Castle Gold', f: 'PX Castle Pennant', k: 'PX Castle Iron', s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade', c: 'PX Castle Sandstone' }, [
    '...wwwwww.f.',
    '....wyyw..ff',
    '....wyyw..k.',
    '..ss.ss.sSk.',
    '..sssssssS..',
    '..sssssscc..',
    '..ssssccsS..',
    '..ssccsssS..',
    '..ccsskksS..',
    '..sssskksS..',
    '..sssssscc..',
    '..ssssccsS..'
  ]);
  /* a chubby teal dragon, gold belly and spines, blowing an arc of water into its pool */
  P('castle_dragon', { y: 'PX Castle Gold', t: 'PX Castle Teal', m: 'PX Mint', w: 'Cloud White', k: 'PX Ink Eye', b: 'PX Castle Water 2', a: 'PX Castle Water 1', s: 'PX Castle Stone 2' }, [
    '..y.y.......',
    '.mmmmm......',
    'mmwkmmmm.bb.',
    'mmmmmmmmb..b',
    '.tmmmt.....b',
    'ymmyymm....b',
    '.mtyyymm...b',
    'ymmyyymmm...',
    '.ttttttttt..',
    'ssssssssssss',
    'saaaaaaaaaas',
    'ssssssssssss'
  ]);
  /* a raised bed: lavender spikes, a clump of mint, chive pom-poms */
  P('castle_herbs', { l: 'PX Lilac', g: 'PX Castle Meadow 2', m: 'PX Mint', p: 'PX Candy Pink', w: 'PX Tree Plank', d: 'PX Tree Bark', W: 'PX Castle Wood' }, [
    '.l.l.....p..',
    '.l.l.....p.p',
    '.l.l..m..p.p',
    '.l.l.mmm.g.p',
    '.g.gmmmmmg.g',
    '.g.gmmmmmg.g',
    '.g.g.mmm.g.g',
    'wddddddddddw',
    'wwwwwwwwwwww',
    'wwwwwwwwwwww',
    'WWWWWWWWWWWW',
    'W..........W'
  ]);
  /* a round stone well under a wooden roof, the bucket on its rope */
  P('castle_well', { w: 'PX Castle Wood', p: 'PX Tree Plank', k: 'PX Castle Iron', r: 'PX Jungle Rope', s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade', t: 'PX Castle Teal' }, [
    '..wwwwwwww..',
    '.wwwwwwwwww.',
    '..p......p..',
    '..pkkkkkkpk.',
    '..p..rr..p..',
    '..p..rr..p..',
    '..p.pppp.p..',
    '.sttttttts..',
    '.sSssSssSs..',
    '.ssSssSsss..',
    '.sSssSssSs..',
    '.sssssssss..'
  ]);
  /* a round stone arch of coloured glass: a sun over a hill in a diamond of lead; lit = the picture glows */
  P('castle_window', { s: 'PX Castle Stone 2', S: 'PX Castle Stone Shade', P: 'PX Castle Banner', t: 'PX Castle Teal', y: 'PX Castle Gold', m: 'PX Mint', c: 'PX Castle Pennant', i: 'PX Castle Iron' }, [
    '...ssssss...',
    '..sPPiiPPs..',
    '.sPPittiPPs.',
    '.sPityytiPs.',
    '.sityyyytis.',
    '.sityyyytis.',
    '.scimttmics.',
    '.sccimmiccs.',
    '.sccciicccs.',
    '.sccccccccs.',
    'ssssssssssss',
    '.SSSSSSSSSS.'
  ], { i: 'PX Castle Window', y: 'PX Bulb Warm' });
  /* a striped awning over a wooden counter of loaves, apples and flowers */
  P('castle_stall', { c: 'PX Castle Pennant', w: 'PX Castle Cloth', d: 'PX Castle Wood', l: 'PX Waffle', a: 'PX Jungle Parrot Red', g: 'PX Leaf 2', f: 'PX Candy Pink' }, [
    'cccccccccccc',
    'cwwccwwccwwc',
    'cwwccwwccwwc',
    '.cc..cc..cc.',
    'd..........d',
    'd.ll.aa.ff.d',
    'dllllaaagfgd',
    'dddddddddddd',
    'dddddddddddd',
    'd..........d',
    'd..........d',
    'd..........d'
  ]);
  /* an empty suit of armour on a plinth: a coral plume, gold trim, a flower in one mitten, a pennant in the other and never a sword */
  P('castle_statue', { c: 'PX Castle Pennant', h: 'PX Castle Stone', s: 'PX Castle Stone 2', k: 'PX Castle Iron', d: 'PX Castle Stone Shade', g: 'PX Castle Gold', p: 'PX Castle Wood', f: 'PX Castle Banner', o: 'PX Candy Pink' }, [
    '....cc......',
    '...hhss..pff',
    '..hkkkks.pff',
    '..hssssd.p..',
    'ohssgssdsp..',
    '.hssgssd.p..',
    '..hsgsd..p..',
    '..hsssd..p..',
    '..hs.sd..p..',
    '..hs.sd.....',
    '.dddddddd...',
    '.kkkkkkkk...'
  ]);
  /* a long swallow-tailed banner with a gold sun, hung from its pole */
  P('castle_banner', { y: 'PX Castle Gold', w: 'PX Castle Wood', l: 'PX Lilac', b: 'PX Castle Banner' }, [
    '.....yy.....',
    '..wwwwwwww..',
    '..lbbbbbbl..',
    '..lbbyybbl..',
    '..lbyyyybl..',
    '..lbyyyybl..',
    '..lbbyybbl..',
    '..lbbbbbbl..',
    '..lbbbbbbl..',
    '..lbbwwbbl..',
    '..lb.ww.bl..',
    '..l..ww..l..'
  ]);
  /* an iron lantern box under a gold cap; lit = a warm, steady glow with six rays and no flame */
  P('castle_lantern', { y: 'PX Castle Gold', i: 'PX Castle Iron', o: 'PX Lamp Off', O: 'PX Lamp Off', d: 'PX Ice Pebble 3' }, [
    '.....yy.....',
    '.r..yyyy..r.',
    '...iiiiii...',
    'r..iooooi..r',
    '...ioOOoi...',
    'r..iooooi..r',
    '...iiiiii...',
    '.....ii.....',
    '.....ii.....',
    '.....ii.....',
    '....iiii....',
    '...dddddd...'
  ], { o: 'PX Castle Window', O: 'PX Glint', r: 'Sunset Amber' });
  /* red carpet with gold edges and a small woven sun */
  T('path_carpet', { y: 'PX Castle Gold', r: 'PX Castle Pennant' }, [
    'yyyyyyyyyyyy',
    'yrrrrrrrrrry',
    'yrrrrrrrrrry',
    'yrryrrrryrry',
    'yrrrryyrrrry',
    'yrrryyyyrrry',
    'yrrryyyyrrry',
    'yrrrryyrrrry',
    'yrryrrrryrry',
    'yrrrrrrrrrry',
    'yrrrrrrrrrry',
    'yyyyyyyyyyyy'
  ]);

  /* ================= Penguin Ice Park ================= */

  /* a wooden sledge on red runners, the snow below */
  P('ice_sled', { c: 'PX Coral', p: 'PX Tree Plank', q: 'PX Tree Bark Trail', s: 'PX Ice 2', i: 'PX Ice Snow' }, [
    '............',
    '..........cc',
    '...........c',
    'pqpqpqpqpq.c',
    'pppppppppp.c',
    'qqqqqqqqqq.c',
    '.c......c.c.',
    '.c......c.c.',
    'ccccccccccc.',
    '............',
    'ssssssssssss',
    'sisssissssis'
  ]);
  /* one coral chair of the lift hanging from its cable */
  P('ice_skilift', { k: 'PX Castle Iron', c: 'PX Coral', y: 'PX Sunny' }, [
    'kkkkkkkkkkkk',
    '...kyyk.....',
    '....kk......',
    '....kk......',
    '....kk......',
    '...ccc......',
    '...ccc......',
    '...ccc......',
    '...cccccccc.',
    '...cccccccc.',
    '....k....k..',
    '....kkkkkk..'
  ]);
  /* a penguin and its chick on a nest of pebbles */
  P('ice_penguin', { n: 'PX Penguin Back', w: 'PX Penguin Front', o: 'PX Penguin Orange', g: 'PX Ice Pebble 2', p: 'PX Ice Pebble', P: 'PX Ice Pebble 3' }, [
    '..nnnn......',
    '.nnnnnn.....',
    '.nwnnwn.....',
    '.nnoonn.....',
    'nnwwwwnn....',
    'nnwwwwnn.gg.',
    'nnwwwwnngggg',
    '.nwwwwn.gnog',
    '.nwwwwn.gwwg',
    '.oo..oo..oo.',
    'pPppPpPppPpp',
    '.pPppPpPppP.'
  ]);
  /* a silver fish leaping over the hole in the ice, the rod and its red-and-white float */
  P('ice_fishhole', { s: 'PX Ice Pebble 2', f: 'PX Ice Pebble 3', k: 'PX Ink Eye', b: 'PX Tree Bark', c: 'PX Coral', w: 'Cloud White', n: 'PX Ice 2', d: 'PX Ice Deep' }, [
    '............',
    '...sssss...b',
    'f.ssssskss.b',
    'ffssssssss.b',
    'f.sssssss..c',
    '...........w',
    '....d.d....c',
    '.nnnnnnnn...',
    'nnddddddnn..',
    'nddddddddn..',
    'nnddddddnn..',
    '.nnnnnnnn...'
  ]);
  /* a giant red mug of cocoa on the hut’s counter: marshmallows on top, two wisps of steam */
  P('ice_cocoa', { s: 'PX Ice Pebble 2', c: 'PX Coral', b: 'PX Tree Bark', m: 'PX Cream', h: 'PX Pier Strata 3', p: 'PX Tree Plank' }, [
    '...s...s....',
    '....s...s...',
    '...s...s....',
    '.cccccccc...',
    '.cmmbmbbccc.',
    '.cccccccc..c',
    '.chcccccc..c',
    '.chccccccccc',
    '.cccccccc...',
    '..cccccc....',
    'pppppppppppp',
    '.pppppppppp.'
  ]);
  /* snow-block walls with a notched top, a corner turret with a flag, the doorway */
  P('ice_fort', { p: 'PX Ice Pebble 3', f: 'PX Castle Pennant', d: 'PX Ice Deep', n: 'PX Ice Snow', i: 'PX Ice 2', D: 'Sea Deep' }, [
    '..pff.......',
    '..pff.......',
    '..p.........',
    'd.d.d.......',
    'ddddd.d.d.d.',
    'dnnndddddddd',
    'dnnninnninnd',
    'dninnninnnid',
    'dnnninnDDnnd',
    'dninnniDDnid',
    'dnnninnDDnnd',
    'dddddddDDddd'
  ]);
  /* three penguins on ice steps, a note in the air */
  P('ice_choir', { v: 'PX Aurora Violet', n: 'PX Penguin Back', w: 'PX Penguin Front', o: 'PX Penguin Orange', s: 'PX Ice Deep', i: 'PX Ice 2' }, [
    '.........vv.',
    'nnn......v..',
    'non.....vv..',
    'nwn.nnn.vv..',
    'nwn.non.....',
    'o.o.nwn.nnn.',
    'ssssnwn.non.',
    'iiiio.o.nwn.',
    'iiiissssnwn.',
    'iiiiiiiio.o.',
    'iiiiiiiissss',
    'iiiiiiiiiiii'
  ]);
  /* a squat keep of ice blocks, flat notched towers, two pennants, lantern blocks in four rows; lit = every row glows */
  P('ice_castle', { d: 'PX Ice Deep', i: 'PX Ice 2', m: 'PX Aurora Mint', v: 'PX Aurora Violet', g: 'Sea Deep',
    A: 'PX Lamp Off', B: 'PX Lamp Off', C: 'PX Lamp Off', D: 'PX Lamp Off' }, [
    'd.d......d.d',
    'ddd.m..v.ddd',
    'dDddddddddDd',
    'diiiiiiiiiid',
    'dCiiCiiCiiCd',
    'diiiiiiiiiid',
    'dBiBiiiiBiBd',
    'diiiiggiiiid',
    'dAiiggggiiAd',
    'diiiggggiiid',
    'diiiggggiiid',
    'dddiggggiddd'
  ], { A: 'PX Ice Hut Glow', B: 'PX Aurora Violet', C: 'PX Aurora Mint', D: 'PX Ice Hut Glow' });
  /* a penguin built of snow: pebble eyes and buttons, a carrot beak, twig flippers */
  P('ice_snowpenguin', { d: 'PX Ice Deep', n: 'PX Ice Snow', S: 'PX Ice 2', k: 'PX Penguin Back', o: 'PX Penguin Orange', t: 'PX Tree Bark', p: 'PX Ice Pebble' }, [
    '....dddd....',
    '...dnnnSd...',
    '...dknnkd...',
    '...dnooSd...',
    '..ddnnnSdd..',
    't.dnnnnnSd.t',
    '.tdnnppnSdt.',
    '..dnnnnnSd..',
    '..dnnppnSd..',
    '..dnnnnnSd..',
    '..dnnnnSSd..',
    '.dddddddddd.'
  ]);
  /* a three-tier pine with snow on every branch, a drift at its foot */
  P('ice_pine', { i: 'PX Ice 2', s: 'PX Ice Snow', g: 'PX Tree Pine', G: 'PX Tree Pine Light', b: 'PX Tree Bark' }, [
    '.....ii.....',
    '....iggi....',
    '...gGgggg...',
    '....ssss....',
    '...iggggi...',
    '..ggGggggg..',
    '...ssssss...',
    '..iggggggi..',
    '.ggGggggggg.',
    '.....bb.....',
    '.....bb.....',
    '...iiiiii...'
  ]);
  /* a six-sided lamp of ice on a post of ice blocks; lit = the aurora colours, and four rays */
  P('ice_lantern', { i: 'PX Ice 2', d: 'PX Ice Deep', O: 'PX Lamp Off', P: 'PX Lamp Off', Q: 'PX Lamp Off' }, [
    '.m..iiii..v.',
    '...iiiiii...',
    '...dOOOOd...',
    'v.dOOPPOOd.m',
    '..dOPQQPOd..',
    '...dOOOOd...',
    '....dddd....',
    '....idii....',
    '....iidi....',
    '....idii....',
    '...iiiiii...',
    '..dddddddd..'
  ], { O: 'PX Aurora Mint', P: 'PX Aurora Sky', Q: 'PX Aurora Violet', m: 'PX Aurora Mint', v: 'PX Aurora Violet' });
  /* a six-point snowflake of clear blue ice on its plinth */
  P('ice_sculpture', { d: 'PX Ice Deep', h: 'PX Glint', p: 'PX Ice 2', P: 'PX Ice Pebble 2' }, [
    '.....dd.....',
    '.d...dd...d.',
    '..d.dddd.d..',
    '...d.dd.d...',
    '....dhhd....',
    '....dhhd....',
    '...d.dd.d...',
    '..d.dddd.d..',
    '.d...dd...d.',
    '.....dd.....',
    '...pppppp...',
    '..PPPPPPPP..'
  ]);
  /* a dome on a wooden base: a little igloo and a pine inside, flakes in the air */
  P('ice_snowglobe', { d: 'PX Ice Deep', a: 'PX Ice 2', w: 'Cloud White', g: 'PX Tree Pine', n: 'PX Ice Snow', k: 'PX Ice Hut Glow', b: 'PX Tree Bark', s: 'PX Ice Snow Shade', p: 'PX Tree Plank', q: 'PX Tree Bark Trail' }, [
    '....dddd....',
    '..ddawaadd..',
    '.daawaaawad.',
    '.daaaaagaad.',
    'dawaaagggaad',
    'daannnagawad',
    'dannnnngggad',
    'dannknnbbaad',
    '.dssssssssd.',
    '..dddddddd..',
    '.pppppppppp.',
    '.qqqqqqqqqq.'
  ]);
  /* a seated polar bear carved from ice, nose in the air, on a snowy plinth */
  P('ice_bear', { i: 'PX Ice 2', h: 'PX Ice Shine', d: 'PX Ice Deep', k: 'PX Penguin Back', c: 'PX Ice Snow', p: 'PX Ice Pebble 2' }, [
    '..dd....dd..',
    '.diid..diid.',
    '.diiiiiiiid.',
    '.diikiikiid.',
    '.diihhhhiid.',
    '.diihkkhiid.',
    '..diiiiiid..',
    '.diiiiiiiid.',
    'diihiiiihiid',
    'diiiiiiiiiid',
    'pccccccccccp',
    '.pppppppppp.'
  ]);
  /* round pebbles in three slate greys pressed into snow */
  T('path_pebble', { a: 'PX Ice Pebble', b: 'PX Ice Pebble 2', c: 'PX Ice Pebble 3', s: 'PX Ice Snow' }, [
    'saaasssbbbss',
    'aaaaasbbbbbs',
    'aaaaasbbbbbs',
    'aaaaasbbbbbs',
    'saaasssbbbss',
    'ssssssssssss',
    'bssscccsssbb',
    'bbscccccsbbb',
    'bbscccccsbbb',
    'bbscccccsbbb',
    'bssscccsssbb',
    'ssssssssssss'
  ]);

  /* ---------------- the registry ---------------- */
  var IDS = Object.keys(PIX);
  function copy(v) { return Array.isArray(v) ? v.slice() : Object.keys(v).reduce(function (out, k) { out[k] = v[k]; return out; }, {}); }
  /* the rows an id draws: its `on` rows while lit (when it has them), else its rest rows; or null */
  function rowsFor(id, lit) { return own(PIX, id) ? copy(lit && PIX[id].on ? PIX[id].on : PIX[id].rows) : null; }
  /* the palette an id draws with: pal, with its lit colours laid on top while lit is true; or null */
  function palFor(id, lit) {
    if (!own(PIX, id)) return null;
    var e = PIX[id], out = copy(e.pal);
    if (lit && e.lit) Object.keys(e.lit).forEach(function (k) { out[k] = e.lit[k]; });
    return out;
  }
  /* the ART.definePix spec of one id, or null (a fresh copy each time: the tables stay frozen) */
  function spec(id) {
    if (!own(PIX, id)) return null;
    var e = PIX[id], out = { rows: copy(e.rows), pal: copy(e.pal) };
    if (e.lit) out.lit = copy(e.lit);
    if (e.on) out.on = copy(e.on);
    if (e.tile) out.tile = true;
    return out;
  }
  /* hand every pictogram to art.definePix; returns the ids it took ([] when world-art.js is
     missing or has no registry: nothing is registered and the generic block still draws) */
  function register(art) {
    if (!art || typeof art.definePix !== 'function') return [];
    return IDS.filter(function (id) {
      try { return art.definePix(id, spec(id)) !== false; } catch (e) { return false; }       /* one bad entry never stops the rest */
    });
  }
  function freeze(v) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.keys(v).forEach(function (k) { freeze(v[k]); }); }
    return v;
  }
  return freeze({ VERSION: VERSION, SIZE: SIZE, IDS: IDS, PIX: PIX, spec: spec, rowsFor: rowsFor, palFor: palFor, register: register });
}));
