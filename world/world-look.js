/* ================================================================
   My Island 3D — the look table (pure data; no DOM, no THREE).
   Loaded in the browser as window.SLIslandLook (after world-core.js and
   world-art.js) and in Node tests via require(). The 3D builders, the
   photocard renderer and the 2D shop (shine levels) all read from here,
   so the 2D fallback and the 3D island always agree on colour.
   Source: docs/island3d/art-bible.json (v1) + art-bible.v2.json (Encore City)
   + island-architecture.json; v3 (Pixel Blocks + the five sky lands): docs/island3d/v3/
   plan-v3.json (contracts.worldLook, catalogAdditions.lookEntries / species / gear / variants),
   sky-world.json (the PX colours, light modes, strata), mockup/pixel.js and land-shops.json (the
   art notes of the land-shop ids).

   API (frozen contract — A1 owns it; other chunks request changes):
     LOOK_VERSION                 bump on ANY visual change (photocard cache key) — 3 = Pixel Blocks,
                                  4 = the crisp fix (exposure fit + the mockup's true bevel)
     PALETTE  {name: '#RRGGBB'}   every v1 art-bible palette token (unchanged)
     PALETTE_V2 {name: hex}       the v2 tokens (art-bible.v2.json); names unique across all tables
     PALETTE_V3 {name: hex}       the v3 'PX …' tokens (sky-world + the mockup); see the v3 block below
     LOCKED   {WALL, DOOR, ROOF, PETCOL, KARTS, BALLS, STADIA, THEME, THEMES, TRACKS}
                                  verbatim copies of the 2D/game colours (test-enforced)
     ART2D    {name: hex}         per-item colours the bible takes from world-art.js
     EXTRA    {name: hex}         the few v1 3D-only colours (lights, matcaps, Showtime sea)
     LOOK     {id: entry}         all 260 CATALOG ids: the 104 V4.54 ids, then the 136 v3 ids
                                  (V3_IDS), then the kids update's 20 (KU_IDS), in CATALOG order
                                  (schema below); every table is deep-frozen
     CHARACTERS {avatar, wand, fanBlob}   non-catalogue models (may use '@member' = u.color;
                                  MEMBER_FALLBACK when the member colour is missing)
     DUSK, SHOW                   golden hour (the default, k = 0) and Showtime (k = 1) presets;
                                  DAY (v1 pastel day) and SHOW_V1 stay exported for scenes that copied them
     PRESET_KEYS, PRESET_COLOR_KEYS
     presetAt(k, memberHex)       DUSK→SHOW mix for k in 0..1 (hex colours + numbers)
     presetV1At(k, memberHex)     the v1 DAY→SHOW_V1 mix (kept for the games' own light arcs)
     TEMPO                        BPMs (day 100, show 118, …), idle periods, beatSec/barSec/loopSec
     FX, MATERIAL, MATCAPS, EDIT, CONES, BUDGET   caps, material constants, overlay colours, budgets
     SHINE_BANDS, SHINE_NAMES, SLOT_DEFAULTS (= SLWorldCore.DEFAULTS), MAX_FLASH_HZ (2),
     LED_CHASE_HZ (1.5: full-contrast chases), SIGN_WORDS (the only words drawn into textures)
     KINDS, ORGANIC_KINDS, OUTLINE_KINDS, PLACED_KINDS, ACT_PIVOT, LAUNCH_PIVOT, PET_BONES, PET_SOCKETS
     NEON3, NEON4                 the neon colour sets (v2 tokens)
     HOUSE_H, HOUSE_TRIS          per-shape heights (by roof) and triangle budgets
     VARIANTS, BUILDING_TRIMS     trim counts per id; the 3 building trims (accent, sign side, stripe)
     hex(token, st)               token → '#RRGGBB' ('$slot' resolved from st), or null
     isToken(token)               true when hex(token) resolves
     tokensIn(entry)              every colour token an entry references
     colorsFor(id, st)            {part: '#RRGGBB'} with style slots resolved
     heightOf(id, st)             item height; the house uses HOUSE_H[shape][roof] (all ≤ 2.9)
     houseState(st, override)     {wall, roof, door, details[], shape, variant}
     resolveStyle(id, st)         the resolved ctx.st for a build (see stateKey)
     stateKey(id, st)             stable template / photocard cache key (cottage keys = v1 keys)
     houseBudget(st)              body + crown + door + details tris for a resolved house state
     variantOf(uid, id)           deterministic trim index in [0, VARIANTS[id]) (0 when none)
     trimOf(id, variant)          {accent, signSide, stripe} for a building trim
     jitter2(uid, id, sameIdNeighbours, out?)   {yaw, sx, sy, sz, lean, leanAxis, tint} placement variety
     pathPiece(mask)              {piece, yawDeg} for a path cell's N1 E2 S4 W8 neighbour mask
     shineLevel(price)            0 | 1 | 2 | 3 from price only (a CATALOG item is accepted too)
     normHex(h), mixHex(a, b, k), tone(hex, dL)   colour maths shared with the kit (dL in HSL points)

   v3 ADDITIONS (Pixel Blocks; every v2 table and function above keeps its V4.54 results for the
   104 V4.54 ids — test-enforced by digest — except LOOK.lantern.h 1.4 → 1.0, D33):
     resolve(token)               '#RRGGBB' | null over every table and the added tokens (no '$slot'
                                  or '@member': those need a style, so the kit keeps its own path)
     addTokens(source, map)       {added: [names], refused: [{name, why}]} for model-local tokens
                                  ('PX <File> <Name>': '#RRGGBB'; D50): first wins, collisions, bad
                                  names, bad hex and #000000 are refused; tokens(source?) lists them
     V3_IDS, V3_VARIANT_IDS       the 136 v3 ids (CATALOG order); the 17 v3 ids with colourways (D72,
                                  D101): an explicit st.variant (a placement's stored vr, D115) wins
     ISLE_THEME[isle]             home + the 5 lands: colour tokens for isles3d / 2D (geometry lives
                                  in isles3d): top[], topMode, edge, edgeMode, beach[], patches,
                                  slab {tops[3], floor[3], wall[9]} | null, strata[], gems[],
                                  rim {kinds[], tokens}, fallKind
     GROUND_TOKENS {name: hex}    the 19 ground-only tokens of the five lands' terrain and the pier /
                                  cobble paths (crisp C4): no other placeable thing uses one as its main
     PX_TWICE  [names]            PALETTE_V3 names written twice (a silent overwrite); always empty
                                  (crisp-palette (a), KU23)
     PX_DAY, PX_SUNSET, PX_NIGHT  the v3 light modes (sky-world lightModes); pxPresetAt(k) mixes them
                                  piecewise (0 → 0.5 day → sunset, 0.5 → 1 sunset → night)
     frameLuma(k, isle?, sky?)    estimated mean frame luminance; lumaStep(k0, k1, dtSec, isle?) the
                                  change per LUMA_RULE window; luma(hex) relative luminance;
                                  LUMA_RULE {maxDelta 0.20, windowSec 0.5}; SHOW_BLEND (2.0 s blend)
     VOX_EXPOSURE {target 1.0}    the vox exposure fit (D6 'palette-exact', crisp C1): the shared
                                  uVoxGain keeps every lit voxel top face at or under its token colour.
                                  voxTopGain(hemiI, hemiSkyLin[3], sunI, sunLin[3], sunUp) = max over
                                  r, g, b of (hemiI · sky + sunI · sun · max(0, sunUp)) / π (three's
                                  Lambert on an up face, linear colours); voxGain(same) = min(1, target /
                                  top); pxVoxGain(k | preset) = voxGain of pxPresetAt(k) (Daytime 0.894,
                                  sunset and night 1). frameLuma's lit estimate carries the gain.
     ART3.FREQS                   every v3 rate in Hz (test-enforced against MAX_FLASH_HZ etc.)
     MATERIAL.voxAo / voxBevel, VOX_FOG, PREVIEW, GRAIN, PIXEL_STUDIO, CREW_SCALE
     TRIS_CAPS, TRIS_CAPS_LOW, TRIS_DETAIL, TRIS_CLASS, trisCap(id, tier)   voxel triangle caps
                                  (TRIS_CAPS.petRig3 {bare, dressed}: the v3 rigs, D108)
     TRIS_CAPS_LOD1(id), TRIS_LOD1   the cap of a v3 placeable's 'vox-lod1' template, or null (D106)
     SLOT_CAPS {hat, neck, face, back}   the per-slot accessory caps on every species (D108)
     PETCOL3  {pet: {body, dark, light, nose}}   the colours of every pet but the four V4.54 ones:
                                  the ten mascots, then the kids update's fourteen ('PETCOL3.<id>.<part>'
                                  tokens; LOCKED.PETCOL stays the four V4.54 pets, D107)
     SPECIES3 {pet: {standIn, gait, play, voice, biped, topY, hudEmoji, tailHz, happyHz, tailAmp,
                                  hover, sig, weights, tap}}   the behaviour rows of the same 24 (D111);
                                  the kids update's fourteen add pace (and geom for the flamingo and
                                  the peacock), and play their interim moves until P2.5
     ITEM_MAX_H 2.9, ISLAND_ITEM_MAX_H 5.5 (LOOK kind 'isleLandmark' only), itemMaxH(id)

   KIDS UPDATE ADDITIONS (docs/island3d/v3/kids-update/plan-ku.json, pets.json; every v3 table and
   function above keeps its results for the 240 ids):
     KU_IDS                       the 20 kids-update ids in CATALOG order: the 14 new species
                                  (LOOK kind 'pet', PETCOL3 / SPECIES3 rows like the mascots'), then
                                  the 6 foods (LOOK kind 'food': a display model, TRIS_CAPS.food)
     jitterVox(uid, id, sameIdNeighbours, out?)   {yaw, sx, sy, sz, tl, th} for voxel templates
                                  (organic kinds only; identity for everything else)

   LOOK ENTRY SCHEMA:
     kind       look category (KINDS): tree flower bush rock mushroom light flag
                decor landmark path fun house style pet acc land attraction
                variant cosmetic building (the city buildings: CATALOG kind 'fun', cat 'city')
                isleLandmark (the five v3 lm_* sky landmarks, up to ISLAND_ITEM_MAX_H; D73)
                food (the kids update's six pet foods: never placed, never worn)
     h          height (u) of the top above the item's base
     colors     {part: token}; tokens come ONLY from PALETTE, PALETTE_V2, PALETTE_V3, LOCKED (dotted
                path, e.g. 'PETCOL.pet_puppy.body', '$slot' = the selected style, e.g.
                'WALL.$wall'), ART2D or EXTRA — never a raw hex (v3 entries: 'main' + named parts)
     mats       {part: materialKey} for non-toon parts: gold | chrome | pearl | glass |
                smoked | gunmetal | foil (matcaps) | led | sign (atlas screens/signs) |
                state | 'neon:<Token>' (absent part = 'toon')
     pivots     named pivots the template must create (actPivot is one of them)
     anchors    named anchors ('top' for labels and emotes, 'door', 'seat', 'spot', 'roof', …)
     actPivot   pivot driven by the tap act (ACT_PIVOT / LAUNCH_PIVOT), or null
     idle       primary idle loop {type, ...params} or null (types below)
     loops      secondary idle loops (same shape), e.g. blossom petals
     show       Showtime behaviour {neon[], halo, led, chase, ...extras};
                halo {token, size}, led {hz, tokens[]}, chase {hz, groups (each light
                lights once per `groups` steps), ...}; every hz is ≤ 2 (MAX_FLASH_HZ) and a
                chase's per-light rate hz / groups is ≤ LED_CHASE_HZ — test-enforced
     organic    placement variety from jitter2 (organic kinds only)
     outline    inverted-hull outline on MID/HIGH (OUTLINE_KINDS: pets, accessories, avatar);
                architecture has no hull (the edit selection hull is the kit's)
     instancing 'batch' (placed on the island, one ItemBatch per (id, stateKey)) |
                'rig' (pets) | 'socket' (accessories) | 'part' (styles, course
                dressing, cosmetics) | 'scene' (kart tracks) | 'env' (land)
     perCopy    parts that get their own CPU-waved Mesh per copy (cloth, pennants)
     hit        [w, h, d] raycast box (fp w × max(h, 0.8) × fp d) or null
     tris       triangle budget for the full template on MID/HIGH
     extras     part (style slot), slot/socket, base (photocard base item), bones,
                bodyTris (house), crowdTris (pitch, stage)
     v3 extras  (the 136 v3 entries only; see the v3 LOOK block) act, perform, performAt, trail,
                pivotParents, levelPivots, anchorPivots, states, copy, toggle, variants,
                variantTokens, display + isle (land icons), pieces / joins, trisLow, trisBare;
                idle / loops may carry tiers ['MID', 'HIGH'] when LOW keeps them still
   IDLE TYPES: sway {deg, period} · bob {pct | amp (u), period} · blink {min, max} ·
     pulse {pct, on:'beat', hz} · flutter {amp, hz} · pennants {deg, hz} ·
     spin {rps} · drip {streams, drops, period} · emit {every} ·
     pendulum {deg, period} · smoke {n, period, rise, grow} · twinkle {hz} ·
     glint {n, period} · sparkle {n, period} · petals {n, max} · track {day, show} ·
     cloth {amp} · actor (driven by pets-brain/actors) · breathe {hz, min} (a sine
     between min and 1, never on/off) · ripple {period} · hue {hz, tokens} (a moving
     hue) · scroll {speed} (LED atlas UV scroll, program widths per second)
     `when: 'show'` limits a loop to Showtime.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLIslandLook = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOOK_VERSION = 4;          /* 3 = Pixel Blocks (sl-pc-3); 4 = the crisp fix (the photocard cache becomes sl-pc-4) */
  var MAX_FLASH_HZ = 2;
  var LED_CHASE_HZ = 1.5;        /* full-contrast LED chases (per light) never run faster */
  /* the only words ever drawn into a texture (plus the child's own first name and initial) */
  var SIGN_WORDS = ['ENCORE', 'SHOWTIME', 'ON AIR', 'PHOTO', 'DANCE', 'PET COURSE', 'ISLAND'];

  /* ---------------- palette (art bible, by name) ---------------- */
  var PALETTE = {
    'Ink': '#3B2F4A', 'Ink Deep': '#2B2140', 'Cloud White': '#FFFFFF',
    'Grass Top': '#8EE07A', 'Grass Alt': '#84D872', 'Grass Side': '#5FBF55', 'Tuft Green': '#4FA94A', 'Meadow Hill': '#A6E88A',
    'Sand': '#F3DC9A', 'Cove Sand': '#F7E3A6', 'Wet Sand': '#E8C77E',
    'Sea Shallow': '#7FE3F0', 'Sea Deep': '#2F8FD8', 'Foam': '#F2FCFF',
    'Sky Day Top': '#8FD3FF', 'Sky Day Mid': '#CDEBFF', 'Sky Day Horizon': '#FFE3F1',
    'Sky Night Top': '#1A1240', 'Sky Night Mid': '#3B1E6E', 'Sky Night Horizon': '#FF7AC8', 'Stage Night': '#130C2E',
    'Neon Pink': '#FF4FB8', 'Neon Cyan': '#3DF2FF', 'Neon Violet': '#A66BFF', 'Neon Lime': '#B6FF5C',
    'Star Gold': '#FFD23F', 'Coral': '#FF6B6B', 'Splash Blue': '#4FC3F7', 'Leaf Mint': '#7BD88F', 'Grape': '#C38BFF',
    'Bubblegum': '#FF8FC8', 'Primary Pink': '#FF5FA2', 'Butter': '#FFE27A', 'Lamp Warm': '#FFE36B', 'Window Glow': '#FFE9A8',
    'Bark': '#9B6B43', 'Plank': '#C48A52', 'Pebble': '#CFC8DC',
    'Gold Base': '#F0C02F', 'Gold Light': '#FFE89A', 'Gold Deep': '#C9921A', 'Chrome': '#DDE3F0', 'Iridescent Rim': '#C7B8FF',
    'Holo Pink': '#FFB3E6', 'Holo Blue': '#B3E5FF', 'Holo Mint': '#C9FFE5', 'Holo Lemon': '#FFF3B3',
    'Rim Showtime': '#FF7AD9', 'Blush': '#FF9DB8', 'Success': '#2ECC71', 'Error': '#E74C3C', 'Blob Shadow': '#3B2F4A'
  };

  /* ---------------- palette v2: Encore City (art-bible.v2.json; every v1 token above stays) ----------------
     Neon tokens are emissive only (lines, rings, signs, screens — never a surface). */
  var PALETTE_V2 = {
    /* ink and UI */
    'Midnight Ink': '#14101F', 'Night Base': '#0E0B1A', 'Panel Glass': '#161228', 'CTA Magenta': '#E0157F',
    'CTA Violet': '#7B4DFF', 'Text Muted': '#B8B2D6', 'Error Coral': '#FF5A6A',
    /* architecture */
    'Graphite': '#2E2B3A', 'Night Asphalt': '#3A3646', 'Concrete': '#8C8798', 'Concrete Light': '#C9C5D3',
    'Bone White': '#F4F2FA', 'Smoked Glass': '#1B2438', 'Glass Edge': '#8FB7FF', 'Smoked Mid': '#2A3B5C',
    'Smoked Deep': '#0E1626', 'Gunmetal': '#5A5F72', 'Gunmetal Spec': '#E6E9F2', 'Gunmetal Mid': '#7C8194',
    'Gunmetal Deep': '#2A2D3A', 'Teak': '#9A6A4A', 'Teak Light': '#B07E58', 'Milk Tea': '#E2BE94',
    /* sky, fog and light */
    'Dusk Zenith': '#2B1E5C', 'Dusk Mid': '#6A3D8F', 'Dusk Horizon': '#FF9A7A', 'Dusk Fog': '#7E4E8E',
    'Sun Halo': '#FFD6A0', 'Night Zenith': '#0B0A1F', 'Night Mid': '#1E1450', 'City Glow': '#C2338F',
    'Hemi Dusk Sky': '#9C8CFF', 'Hemi Dusk Ground': '#3A2550', 'Sun Dusk': '#FFB48A', 'Rim Dusk': '#FFB0D9',
    'Hemi Night Sky': '#5A4BD1', 'Hemi Night Ground': '#1A1030', 'Moon V2': '#A9B8FF', 'Rim Night': '#FF5FD2',
    'Studio Sky': '#B9B0FF', 'Studio Ground': '#2A2240', 'Studio Key': '#FFE2C8',
    /* water */
    'Lagoon': '#3FB8D0', 'Deep Bay': '#1E3F86', 'Foam Dusk': '#FFD9E8', 'Wave Dusk': '#FFC7B0',
    'Night Lagoon': '#1F4FA8', 'Night Deep': '#0B1440', 'Foam Night': '#B9A8FF',
    /* land */
    'Turf': '#4FA36A', 'Turf Shade': '#3C8456', 'Hill Moss': '#5DB67E', 'Cliff Rock': '#5A5168',
    'Dune': '#E9C9A0', 'Wet Dune': '#B98F6E', 'Leaf Deep': '#2F7D57', 'Leaf Lit': '#57B07A',
    /* neon (emissive only) */
    'Neon Magenta': '#FF2E9A', 'LED Cyan': '#22E4FF', 'Electric Violet': '#8A5CFF', 'Laser Lime': '#C6FF3D',
    /* warm lights */
    'Sunset Amber': '#FFB23E', 'Window Warm': '#FFD08A',
    /* crowd silhouettes */
    'Crowd Shadow': '#2A2348', 'Crowd Shadow 2': '#33295A', 'Crowd Shadow 3': '#3D3166',
    /* foil */
    'Foil Pink': '#FF7AD9', 'Foil Blue': '#7AD7FF', 'Foil Mint': '#9DFFCF', 'Foil Gold': '#FFE27A',
    /* the city across the bay */
    'Night Glass Indigo': '#2A2F5E', 'Night Glass Teal': '#1F4A55', 'Night Glass Plum': '#43294F',
    'Night Glass Graphite': '#2B2D38', 'Night Glass Smoke': '#4A4E63', 'Quay Stone': '#3B3747'
  };

  /* ---------------- locked colours (verbatim copies; tests compare them) ----------------
     WALL, DOOR, ROOF pairs, PETCOL, KARTS, BALLS, STADIA, THEME: world/world-art.js
     THEMES (course colours, without the non-colour 'treat'): world/games/pet-course.js
     TRACKS (grass only): world/games/kart.js */
  var LOCKED = {
    WALL: { wall_cream: '#f7e6c4', wall_pink: '#f9b7cc', wall_mint: '#b8ecd6', wall_sky: '#a9d6f7', wall_lilac: '#d6bdf2',
            wall_concrete: '#a9a5b3', wall_gallery: '#eceaf2', wall_graphite: '#34303f', wall_midnight: '#232a57' },
    DOOR: { door_blue: '#3b7dd8', door_red: '#d94b4b', door_green: '#38a85c', door_gold: '#f0c02f', door_glass: '#1b2438' },
    ROOF: { roof_red: ['#e0574f', '#c4433c'], roof_blue: ['#4a6fa5', '#3a5888'], roof_thatch: ['#e3b24f', '#c99634'], roof_candy: ['#ff8fb8', '#f06d9e'] },
    PETCOL: {
      pet_puppy:  { body: '#e3b077', dark: '#b8834f', light: '#f6d9b3', nose: '#3b2f4a' },
      pet_kitten: { body: '#f0a35e', dark: '#c97834', light: '#fde2c6', nose: '#e86a8a' },
      pet_bunny:  { body: '#f4f0ea', dark: '#d8cfc4', light: '#ffffff', nose: '#f08aa6' },
      pet_dragon: { body: '#5fc97a', dark: '#3a9a58', light: '#b9f0c6', nose: '#2e6b40' }
    },
    KARTS: { kart_red: '#e94b4b', kart_blue: '#3b7dd8', kart_lime: '#7ed957', kart_gold: '#f0c02f', kart_unicorn: '#ff8fd0' },
    BALLS: { ball_classic: ['#ffffff', '#3b2f4a'], ball_rainbow: ['#ff6b6b', '#4fc3f7'], ball_planet: ['#c38bff', '#ffd23f'], ball_gold: ['#ffd23f', '#e0a81c'] },
    STADIA: { stadium_day: ['#7ecbff', '#6ac46a'], stadium_night: ['#2b2a5e', '#3f9a4a'], stadium_beach: ['#ffe0a0', '#7fd0a0'], stadium_snow: ['#dfeeff', '#bfe6c8'] },
    THEME: { course_meadow: ['#7bd88f', '#ffd23f'], course_beach: ['#f3dc9a', '#4fc3f7'], course_snow: ['#e8f4ff', '#7fb3ff'], course_candy: ['#ffb6d5', '#c38bff'] },
    THEMES: {
      course_meadow: { sky: ['#8fd8ff', '#d9f6ff'], hill: '#9fdc8a', hill2: '#7cc96e', ground: '#7ad06a', soil: '#c9925a',
        obs: { low: ['#ffffff', '#ff6b6b'], log: ['#a8743f', '#7a4f26'], hedge: ['#4caf50', '#2f8a3a'], stack: ['#e9b46a', '#b67f37'], puddle: '#6cc4ff' } },
      course_beach: { sky: ['#7fd0ff', '#fff3d6'], hill: '#4fc3f7', hill2: '#2fa3e0', ground: '#f3dc9a', soil: '#e2c27a',
        obs: { low: ['#ff6b4a', '#c43f2a'], log: ['#c9a06a', '#8d6a3d'], hedge: ['#f2cd7c', '#c99a4d'], stack: ['#ff8a5c', '#d0603a'], puddle: '#4fc3f7' } },
      course_snow: { sky: ['#a8c8ff', '#eef6ff'], hill: '#ffffff', hill2: '#dfeeff', ground: '#f4f9ff', soil: '#c9d9ee',
        obs: { low: ['#ff6b6b', '#c94a4a'], log: ['#6b8fd8', '#4a6fb8'], hedge: ['#ffffff', '#cdd9ea'], stack: ['#9fd0ff', '#6aa8e0'], puddle: '#bfe8ff' } },
      course_candy: { sky: ['#ffc6e5', '#fff0f8'], hill: '#ffb3d6', hill2: '#ff8fc4', ground: '#c38bff', soil: '#9b62e0',
        obs: { low: ['#ffffff', '#ff5c8a'], log: ['#8a5a2b', '#6a3f1a'], hedge: ['#ff8fb8', '#e8679a'], stack: ['#ffd23f', '#e8b020'], puddle: '#a0522d' } }
    },
    TRACKS: { track_loop: { grass: '#7ad06a' }, track_volcano: { grass: '#9cc46a' }, track_beach: { grass: '#f3dc9a' } }
  };

  /* ---------------- the ten land mascots (catalogAdditions.species; D92, D95, D107, D111) and the
     kids update's fourteen new species (kids-update pets.json catalogue.new) ----------------
     PETCOL3: their colours, as tokens 'PETCOL3.<id>.<part>'. A table of its own, because
     LOCKED.PETCOL stays the four V4.54 pets byte for byte (the 2D art, the kit fallback and the
     kart all guard it); SLWorldArt.PETCOL3 carries the same data for the 2D views. */
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
    pet_seal:     { body: '#A9B8CC', dark: '#7E8FA8', light: '#EEF3FA', nose: '#2B2D42' },
    /* the kids update's fourteen (kids-update pets.json catalogue.new: four Home pets, then two per land).
       Each keeps a light face part beside its body so the eyes read at island scale, and every pet's
       body is ΔE76 ≥ 20 from its own ground at the Daytime gain (crisp-palette (b) asks 15). Four
       bodies are retuned from the design for that: the hedgehog's spines a warmer chestnut for
       #9C7A5B (13.5 from the treetop trail), the snow leopard cub a warm smoky grey for #DDE4EA (12.4
       from the shady snow), and on the Home grass the budgie a true yellow-green for #7ED957 (18.9)
       and the tortoise's skin a yellower olive for #8FBF5A (17.3), both lost in the grass at island
       scale in the render check */
    pet_hamster:     { body: '#E8A866', dark: '#C47F45', light: '#FFF1DE', nose: '#F29CB0' },
    pet_guineapig:   { body: '#F2A65A', dark: '#6B4A3A', light: '#FFF4E8', nose: '#F29CB0' },
    pet_tortoise:    { body: '#9DAA55', dark: '#6E5236', light: '#E9C77B', nose: '#4A3A2A' },
    pet_budgie:      { body: '#8BD62B', dark: '#2B6E3F', light: '#FFE66D', nose: '#3F7FD8' },
    pet_otter:       { body: '#8B5E3C', dark: '#6A4428', light: '#EED9BF', nose: '#3B2A22' },
    pet_flamingo:    { body: '#FF8FB1', dark: '#E8607F', light: '#FFD3E0', nose: '#2B2D42' },
    pet_sloth:       { body: '#B49A7E', dark: '#7A6550', light: '#EADBC8', nose: '#4A3A2A' },
    pet_toucan:      { body: '#3D4658', dark: '#2F3542', light: '#FFF6DC', nose: '#FF9F1C' },
    pet_redpanda:    { body: '#D9653B', dark: '#7A3B2E', light: '#FFF1E2', nose: '#3B2A22' },
    pet_hedgehog:    { body: '#A0694A', dark: '#6E523C', light: '#F2DFC4', nose: '#3B2A22' },
    pet_goatkid:     { body: '#EDE6DA', dark: '#9C8B78', light: '#FFFDF8', nose: '#F2A0A8' },
    pet_peacock:     { body: '#2F7FD8', dark: '#1F8A70', light: '#E8F6FF', nose: '#C9B27C' },
    pet_reindeer:    { body: '#A87952', dark: '#6E4B30', light: '#F5E6D0', nose: '#3B2A22' },
    pet_snowleopard: { body: '#E5E1D8', dark: '#6F7C89', light: '#FFFFFF', nose: '#F29CB0' }
  };
  /* SPECIES3: one behaviour row per mascot (and new pet). standIn = the V4.54 species a game shows when no voxel
     rig is available (D98); gait, tailHz / happyHz (Hz, ≤ MAX_FLASH_HZ), tailAmp (deg), hover and
     sig (a DANCE_MOVES move) are the clip layer's row; play and tap name the crew moves
     (catalogAdditions.crewMoves) and weights are factors on pets-brain WEIGHTS (a key not listed
     is 1); voice → SLSound.PET_VOICE; topY → the actors' label height; hudEmoji → the course HUD. */
  var SPECIES3 = {
    pet_crab:     { standIn: 'pet_puppy', gait: 'scuttle', play: 'dig', voice: 'click', biped: false, topY: 0.62, hudEmoji: '🦀',
                    tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'step', weights: { play: 1.2, look: 1.3, sniff: 0.8 }, tap: 'hop' },
    pet_gull:     { standIn: 'pet_dragon', gait: 'waddle', play: 'flutter', voice: 'kee', biped: true, topY: 0.72, hudEmoji: '🐦',
                    tailHz: 0.5, happyHz: 1.6, tailAmp: 10, hover: 0, sig: 'spin', weights: { look: 1.3, lookBack: 1.2 }, tap: 'hop' },
    pet_capybara: { standIn: 'pet_puppy', gait: 'trot', play: 'loaf', voice: 'chirrup', biped: false, topY: 0.66, hudEmoji: '🐾',
                    tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'step', weights: { nap: 1.6, sit: 1.6, sniff: 1.3, play: 0.6 }, tap: 'hop' },
    pet_monkey:   { standIn: 'pet_kitten', gait: 'trot', play: 'tumble', voice: 'chatter', biped: false, topY: 0.8, hudEmoji: '🐒',
                    tailHz: 0.5, happyHz: 2, tailAmp: 20, hover: 0, sig: 'hopTurn', weights: { play: 1.6, visit: 1.6, nap: 0.5 }, tap: 'hop' },
    pet_squirrel: { standIn: 'pet_kitten', gait: 'trot', play: 'stash', voice: 'churr', biped: false, topY: 0.78, hudEmoji: '🐿️',
                    tailHz: 1, happyHz: 1.8, tailAmp: 14, hover: 0, sig: 'point', weights: { play: 1.4, sniff: 1.3, lookBack: 1.3 }, tap: 'hop' },
    pet_owl:      { standIn: 'pet_dragon', gait: 'waddle', play: 'glide', voice: 'hoot', biped: true, topY: 0.72, hudEmoji: '🦉',
                    tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'freeze', weights: { nap: 1.3, lookBack: 1.4 }, tap: 'hop' },
    pet_duckling: { standIn: 'pet_bunny', gait: 'waddle', play: 'follow', voice: 'quack', biped: true, topY: 0.66, hudEmoji: '🐥',
                    tailHz: 1.2, happyHz: 2, tailAmp: 12, hover: 0, sig: 'hopTurn', weights: { lookAvatar: 1.6, play: 1.3, sniff: 1.2 }, tap: 'hop' },
    pet_pony:     { standIn: 'pet_puppy', gait: 'canter', play: 'prance', voice: 'neigh', biped: false, topY: 0.84, hudEmoji: '🐴',
                    tailHz: 0.5, happyHz: 1.5, tailAmp: 22, hover: 0, sig: 'step', weights: { play: 1.2, sniff: 1.3, wander: 1.2 }, tap: 'rear' },
    pet_penguin:  { standIn: 'pet_bunny', gait: 'waddle', play: 'bellyflop', voice: 'peep', biped: true, topY: 0.72, hudEmoji: '🐧',
                    tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'spin', weights: { play: 1.3, look: 1.2, beatNod: 1.2 }, tap: 'hop' },
    pet_seal:     { standIn: 'pet_puppy', gait: 'galumph', play: 'clap', voice: 'arf', biped: false, topY: 0.58, hudEmoji: '🐾',
                    tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'point', weights: { nap: 1.5, lookAvatar: 1.3, play: 1.1 }, tap: 'clap' },
    /* the kids update's fourteen (pets.json catalogue.new), the same fields + pace (0.4–1.2: the walk
       speed and cadence factor, clamped to the gait's floor by the clip layer) and, for the two long-
       legged birds, geom (their GAIT_GEOM_SPECIES row). play is the oracle's move (rigs.newPlayMoves):
       P2.5 gave pets-brain curl (tortoise, hedgehog), balance (flamingo), fan (peacock) and stand (red
       panda), and lets a v3 row play the V4.54 binky (guinea pig) and pounce (snow leopard) */
    pet_hamster:     { standIn: 'pet_bunny', gait: 'trot', play: 'stash', voice: 'squeak', biped: false, topY: 0.45, hudEmoji: '🐹',
                       tailHz: 0, happyHz: 1.6, tailAmp: 6, hover: 0, sig: 'spin', weights: { play: 1.5, sniff: 1.4, nap: 1.2 }, tap: 'hop', pace: 1 },
    pet_guineapig:   { standIn: 'pet_bunny', gait: 'trot', play: 'binky', voice: 'wheek', biped: false, topY: 0.45, hudEmoji: '🐾',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'hopTurn', weights: { sniff: 1.5, lookAvatar: 1.3, play: 1.2 }, tap: 'hop', pace: 0.9 },
    pet_tortoise:    { standIn: 'pet_puppy', gait: 'trot', play: 'curl', voice: 'hum', biped: false, topY: 0.46, hudEmoji: '🐢',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'step', weights: { nap: 1.5, wander: 0.6, sniff: 1.4 }, tap: 'hop', pace: 0.5 },
    pet_budgie:      { standIn: 'pet_dragon', gait: 'waddle', play: 'flutter', voice: 'tweet', biped: true, topY: 0.56, hudEmoji: '🦜',
                       tailHz: 0.5, happyHz: 1.6, tailAmp: 8, hover: 0, sig: 'point', weights: { look: 1.3, play: 1.3, beatNod: 1.3 }, tap: 'hop', pace: 1 },
    pet_otter:       { standIn: 'pet_puppy', gait: 'galumph', play: 'clap', voice: 'chirp', biped: false, topY: 0.58, hudEmoji: '🦦',
                       tailHz: 0.4, happyHz: 1.2, tailAmp: 10, hover: 0, sig: 'spin', weights: { play: 1.4, lookAvatar: 1.3, nap: 1.2 }, tap: 'clap', pace: 1 },
    pet_flamingo:    { standIn: 'pet_dragon', gait: 'waddle', play: 'balance', voice: 'honk', biped: true, topY: 0.92, hudEmoji: '🦩',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'freeze', weights: { sit: 0.4, look: 1.4, lookBack: 1.3 }, tap: 'hop', pace: 0.9, geom: 'flamingo' },
    pet_sloth:       { standIn: 'pet_kitten', gait: 'trot', play: 'loaf', voice: 'eee', biped: false, topY: 0.62, hudEmoji: '🦥',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'freeze', weights: { nap: 2, sit: 1.5, wander: 0.4, play: 0.6 }, tap: 'hop', pace: 0.4 },
    pet_toucan:      { standIn: 'pet_dragon', gait: 'waddle', play: 'flutter', voice: 'croak', biped: true, topY: 0.72, hudEmoji: '🐦',
                       tailHz: 0.4, happyHz: 1.4, tailAmp: 8, hover: 0, sig: 'point', weights: { look: 1.3, visit: 1.4 }, tap: 'hop', pace: 1 },
    pet_redpanda:    { standIn: 'pet_kitten', gait: 'trot', play: 'stand', voice: 'huff', biped: false, topY: 0.68, hudEmoji: '🐾',
                       tailHz: 0.5, happyHz: 1.5, tailAmp: 14, hover: 0, sig: 'hopTurn', weights: { play: 1.3, lookBack: 1.3, nap: 1.2 }, tap: 'rear', pace: 1 },
    pet_hedgehog:    { standIn: 'pet_bunny', gait: 'trot', play: 'curl', voice: 'snuffle', biped: false, topY: 0.46, hudEmoji: '🦔',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'step', weights: { sniff: 1.6, nap: 1.3, wander: 0.8 }, tap: 'hop', pace: 0.8 },
    pet_goatkid:     { standIn: 'pet_puppy', gait: 'canter', play: 'prance', voice: 'bleat', biped: false, topY: 0.8, hudEmoji: '🐐',
                       tailHz: 1, happyHz: 2, tailAmp: 14, hover: 0, sig: 'hopTurn', weights: { play: 1.5, wander: 1.3, visit: 1.2 }, tap: 'rear', pace: 1 },
    pet_peacock:     { standIn: 'pet_dragon', gait: 'waddle', play: 'fan', voice: 'coo', biped: true, topY: 0.85, hudEmoji: '🦚',
                       tailHz: 0, happyHz: 0, tailAmp: 0, hover: 0, sig: 'spin', weights: { look: 1.3, lookAvatar: 1.3, play: 1.2 }, tap: 'hop', pace: 0.9, geom: 'peacock' },
    pet_reindeer:    { standIn: 'pet_puppy', gait: 'canter', play: 'prance', voice: 'snort', biped: false, topY: 0.86, hudEmoji: '🦌',
                       tailHz: 0.8, happyHz: 1.8, tailAmp: 10, hover: 0, sig: 'step', weights: { wander: 1.2, sniff: 1.3, play: 1.2 }, tap: 'hop', pace: 1 },
    pet_snowleopard: { standIn: 'pet_kitten', gait: 'trot', play: 'pounce', voice: 'chuff', biped: false, topY: 0.68, hudEmoji: '🐆',
                       tailHz: 0.4, happyHz: 1.2, tailAmp: 18, hover: 0, sig: 'point', weights: { play: 1.4, lookBack: 1.3, nap: 1.2 }, tap: 'hop', pace: 1 }
  };

  /* ---------------- per-item colours the bible takes from the 2D art ---------------- */
  var ART2D = {
    /* trees */
    'Leaf': '#5CB85C', 'Leaf Shade': '#4BA84B', 'Leaf Light': '#8BD17C',
    'Pine Bark': '#8A5D3A', 'Pine': '#3F9A5A', 'Pine Light': '#69C07C', 'Apple Red': '#E53935',
    'Blossom': '#F6A7C8', 'Blossom Shade': '#EC86B0', 'Blossom Light': '#FFD3E6',
    'Palm Bark': '#A5743F', 'Palm Bark Dark': '#8A5A2B',
    'Frond': '#4FBF63', 'Frond Shade': '#45B05A', 'Frond Light': '#5CCC70', 'Frond Deep': '#3FA956',
    /* flowers and plants */
    'Mound': '#4FAE4C', 'Stem': '#3C8A3C', 'Tulip Red': '#FF5C6C', 'Tulip Yellow': '#FFC93C', 'Tulip Pink': '#FF7AB8', 'Sunflower': '#FFCF2E',
    'Bush': '#3F9A4A', 'Bush Light': '#4CAF50', 'Rose': '#FF7AA8', 'Rose Deep': '#FF5C8A', 'Rose Pale': '#FF9DBF',
    'Rock': '#A9A6B8', 'Moss': '#6CC26A',
    /* lights */
    'Lamp Post': '#4B4F6B', 'Glass Off': '#CFE0EC', 'Lamp Halo': '#FFF6A8',
    'Stem Cream': '#FFF4E0', 'Cap Violet': '#B06BD8', 'Cap Neon': '#6FF3FF', 'Cap Halo': '#9FFCFF',
    /* flags, garden/beach decor, landmarks */
    'Pole': '#8F8AA6', 'Bench Leg': '#6B5A7A', 'Castle Sand': '#F2CD7C', 'Castle Door': '#C99A4D',
    'Snow': '#FDFDFF', 'Carrot': '#FF8A3D', 'Mill White': '#F6EFE2',
    /* paths */
    'Plank Light': '#D69D64', 'Plank Dark': '#C98F58', 'Stepping Stone': '#D9D3E6',
    /* fun */
    'Tramp Frame': '#4B8FF0', 'Tramp Mat': '#2A64C9', 'Tramp Shine': '#7FB3FF', 'Basin': '#C9C3D9', 'Water': '#6FD0FF', 'Bubble Rim': '#9FDCFF',
    /* house */
    'Step': '#B8B2C9', 'Window': '#BFE6FF', 'Straw': '#B9842A',
    'Castle Stone': '#B9B4C9', 'Castle Tower': '#CDC8DC', 'Castle Cone': '#6C5CE7',
    'Chimney': '#B4675A', 'Chimney Cap': '#93524A', 'Smoke': '#EEF0F6',
    /* pets and accessories */
    'Bunny Ear': '#F6B7C9', 'Cape Red': '#E94B4B',
    /* land and sea */
    'Sandbar': '#F6E7BD', 'Wave Line': '#E8F8FF',
    /* attractions */
    'Garage': '#8FA3C8', 'Roller Door': '#D9E1EF', 'Door Slat': '#A8B3C9', 'Asphalt': '#5B5670'
  };

  /* ---------------- 3D-only colours ---------------- */
  var EXTRA = {
    'Stone Light': '#E6E1EF', 'Peach Coral': '#FF8A5C', 'Rainbow Orange': '#FFA94D',
    'Volcano Rock': '#8A6B5A', 'Sunset Peach': '#FFB38A', 'Dusk Violet': '#A66BFF',
    /* light presets */
    'Hemi Sky Day': '#DDF1FF', 'Hemi Ground Day': '#FFE0EC', 'Sun Day': '#FFF3E0',
    'Hemi Sky Show': '#6B5BD6', 'Hemi Ground Show': '#2A1840', 'Moon': '#B9C6FF',
    /* the sea at Showtime */
    'Sea Shallow Show': '#3C6FD1', 'Sea Deep Show': '#1B2A6B', 'Foam Show': '#CFC4FF',
    /* matcap stops */
    'Gold Spec': '#FFF6CC', 'Gold Edge': '#8A5F10', 'Chrome Deep': '#9AA3B8',
    /* photocard riser and image well */
    'Riser Top': '#FFF0FA', 'Well Blue': '#E8F4FF'
  };

  /* ---------------- palette v3: Pixel Blocks (sky-world.json + mockup/pixel.js) ----------------
     Every name starts 'PX ' (no PALETTE / PALETTE_V2 / ART2D / EXTRA name does), so the tables
     never collide. sky-world's hex values are the authority (lands[].palette, homeMakeover,
     environment.strata, lands[].slab, lightModes); the mockup set is pixel.js's Home and item
     colours. Never #000000 (the darkest is PX Ink Eye #2B2140), and no snow or ice surface is
     lighter than PX Ice Snow #F2F7FF (test-enforced). Numbered families are built by pxList:
     'PX <Isle> Strata n' / 'Gem n' (the underside cake), 'PX <Isle> Water n' / 'Floor n' (slab
     tops and floor, shallow → deep), 'PX <Isle> Wall Lip' + 'Wall n' (the banded slab wall). */
  var PALETTE_V3 = {};
  var ADDED = {}, ADDED_BY = {};        /* addTokens registry: name → {hex, source}; source → [names] */
  /* every PALETTE_V3 write goes through put(), which still overwrites but records a name written
     twice in PX_TWICE: a pxList family once silently replaced a token (KU23; crisp-palette (a) keeps
     PX_TWICE empty at every tip) */
  var PX_TWICE = [];
  function put(name, h) { if (own(PALETTE_V3, name)) PX_TWICE.push(name); PALETTE_V3[name] = h; }
  function px(map) { for (var k in map) put(k, map[k]); }
  function pxList(prefix, list) { list.forEach(function (h, i) { put(prefix + ' ' + (i + 1), h); }); }
  function seq(prefix, n) { var o = []; for (var i = 1; i <= n; i++) o.push(prefix + ' ' + i); return o; }
  /* the mockup's Home and item colours (pixel.js) and the accents the lands share */
  px({
    'PX Grass': '#93E98D', 'PX Grass 2': '#85DF84', 'PX Grass 3': '#76D47A', 'PX Tuft': '#5CC765', 'PX Edge': '#F4D394',
    'PX Beach': '#FFE9B8', 'PX Beach 2': '#FFDF9F', 'PX Lilac Base': '#D3C5F6', 'PX Cream Wall': '#FFF3DA',
    'PX Leaf': '#62D66F', 'PX Leaf 2': '#45B85E', 'PX Leaf Lit': '#9CF08A', 'PX Trunk': '#A0643C',
    'PX Candy Pink': '#FF8FC0', 'PX Sunny': '#FFD23F', 'PX Mint': '#7FE0C2', 'PX Lilac': '#B49CFF', 'PX Coral': '#FF6F61',
    'PX Sky Blue': '#45C3F5', 'PX Ink Eye': '#2B2140', 'PX Penguin Back': '#2B2D42',
    /* shared lights: lamps and windows (glow mode, D51), bulbs, glints */
    'PX Lamp Warm': '#FFD08A', 'PX Lamp Off': '#B9A99A', 'PX Bulb Warm': '#FFF1B8', 'PX Glint': '#FFFFFF'
  });
  /* Home's water slab and candy underside, exactly as pixel.js draws them */
  var HOME_WALL = ['#B4F3FF', '#86E6FC', '#6AD9F8', '#57C8F3', '#4BB7EE', '#42A5E7', '#3A93DF', '#3381D5', '#2D71CA'];
  pxList('PX Sea Top', ['#72E7DC', '#4FCBF3', '#3BABEF']);
  pxList('PX Sea Floor', ['#FFE6AE', '#A8E9E2', '#5CA9E3']);
  put('PX Sea Wall Lip', HOME_WALL[0]);
  pxList('PX Sea Wall', HOME_WALL.slice(1));
  pxList('PX Home Strata', ['#FFE2A0', '#FFC994', '#FFA9B9', '#F0A6EE', '#C9A6FF', '#A8B6FF', '#93D2FF', '#92EAD2']);
  pxList('PX Home Gem', ['#FFFFFF', '#FFF27A', '#7AF8FF', '#FF9DF0']);
  /* Home's makeover (sky-world homeMakeover.palette) */
  px({
    'PX Home Grass': '#93E98D', 'PX Home Grass 2': '#85DF84', 'PX Home Grass 3': '#76D47A', 'PX Home Tuft': '#5CC765',
    'PX Home Edge': '#F4D394', 'PX Home Beach': '#FFE9B8', 'PX Home Beach 2': '#FFDF9F', 'PX Meadow': '#A6E88A',
    'PX Meadow 2': '#95DF7C', 'PX Meadow Cliff': '#D9CBB0', 'PX Cove Sand': '#FFE9B8', 'PX Sandbar': '#F6E7BD'
  });
  /* the lands' palettes (sky-world lands[].palette; the pier's shared accents and bulbs are above) */
  px({
    'PX Pier Plank': '#F2D7A6', 'PX Pier Plank Shade': '#E3C08A', 'PX Pier Pile': '#9B6B4A', 'PX Pier Sand': '#FFE9B8',
    'PX Pier Sand 2': '#FFDF9F', 'PX Pier Stripe Blue': '#4FB8F0',
    'PX Jungle Canopy Deep': '#2FA35A', 'PX Jungle Canopy': '#3FC46A', 'PX Jungle Canopy Light': '#6EDB7A',
    'PX Jungle Litter': '#4E9E4C', 'PX Jungle Litter 2': '#5BB25A', 'PX Jungle Moss Stone': '#9FB59A', 'PX Jungle Bark': '#8A5A35',
    'PX Jungle Bark Light': '#A8743F', 'PX Jungle Thatch': '#D9A441', 'PX Jungle Thatch Shade': '#C98E2E', 'PX Jungle Rope': '#E0B676',
    'PX Jungle Flower Pink': '#FF5FA2', 'PX Jungle Flower Orange': '#FF9F43', 'PX Jungle Parrot Red': '#FF4D4D',
    'PX Jungle Parrot Blue': '#3FA9F5', 'PX Jungle Glow Fungus': '#7AF8E0',
    'PX Tree Pine': '#2E8B57', 'PX Tree Pine Mid': '#3BA36A', 'PX Tree Pine Light': '#57C27F', 'PX Tree Oak': '#6CCB5F',
    'PX Tree Oak Light': '#8ADB6A', 'PX Tree Bark': '#7A4E2D', 'PX Tree Bark Trail': '#A0643C', 'PX Tree Bark Trail 2': '#B5794A',
    'PX Tree Rope': '#E8C27A', 'PX Tree Net': '#F2E2B8', 'PX Tree Plank': '#C99A5E', 'PX Tree Moss': '#8ACF6E',
    'PX Tree Toadstool': '#FF5E5E', 'PX Tree Autumn': '#FFB347', 'PX Tree Flag': '#3FA9F5',
    'PX Castle Stone': '#C9C3D9', 'PX Castle Stone 2': '#B4ADC8', 'PX Castle Stone Shade': '#9A93B3', 'PX Castle Sandstone': '#F2D9A6',
    'PX Castle Banner': '#7B5CFF', 'PX Castle Gold': '#FFD23F', 'PX Castle Pennant': '#FF6F61', 'PX Castle Teal': '#2EC4B6',
    'PX Castle Wood': '#A0643C', 'PX Castle Iron': '#4A4E69', 'PX Castle Meadow': '#8BDB7E', 'PX Castle Meadow 2': '#7ACD72',
    'PX Castle Cloth': '#FFFFFF', 'PX Castle Window': '#FFD08A',
    'PX Ice Snow': '#F2F7FF', 'PX Ice Snow 2': '#E6F0FF', 'PX Ice Snow 3': '#DCE9FA', 'PX Ice Snow Shade': '#C9D9F2',
    'PX Ice': '#BFE8FF', 'PX Ice 2': '#A6DBFA', 'PX Ice Deep': '#5FB0E8', 'PX Ice Shine': '#E2F6FF',
    'PX Penguin Front': '#F7F9FF', 'PX Penguin Orange': '#FF9F1C', 'PX Ice Hut Glow': '#FFD08A',
    'PX Aurora Mint': '#8CF5C8', 'PX Aurora Sky': '#7CC8FF', 'PX Aurora Violet': '#B39BFF'
  });
  /* the land shops (land-shops.json art notes; D50): the new tokens the notes name ('PX Ice Pebble'
     in the pebble path's three slate greys; 'PX Squirrel Rust' = PETCOL3.pet_squirrel.body) and
     every colour the notes give only as a raw hex with no token yet: canvas cream, banana yellow,
     khaki and its shade, waffle, pale lens glass, and the five pixel accents of the climbing holds
     and the xylophone bars ('PX Accent 1'–'5': pink, sun, blue, leaf, violet). Model files use
     these names for them; a new colour that one model file alone needs still goes through addTokens. */
  px({
    'PX Ice Pebble': '#7F8FA6', 'PX Ice Pebble 2': '#9AA9BF', 'PX Ice Pebble 3': '#5F6E86', 'PX Squirrel Rust': '#E07B39',
    'PX Cream': '#FFF1D6', 'PX Banana': '#FFD84A', 'PX Khaki': '#D8C08A', 'PX Khaki Shade': '#C2A56E', 'PX Waffle': '#E3A85A',
    'PX Lens Pale': '#CFEFFF'
  });
  pxList('PX Accent', ['#FF5FA2', '#FFD23F', '#45C3F5', '#7EDB7E', '#9B7BFF']);
  /* the Treetop's floor (look review): the bark trail and the two clearings are golden bark chips,
     on their own tokens. 'PX Tree Bark Trail' / 'Trail 2' stay as sky-world has them, because about
     fifteen treetop items, the lookout, the acorn hat and the rope-bridge posts are built from them;
     a floor in those browns put every post, deck and log brown on brown. */
  px({ 'PX Tree Chip': '#D9A066', 'PX Tree Chip 2': '#E8B878' });
  /* the lands' undersides (environment.strata: 6 layers each) */
  pxList('PX Pier Strata', ['#FFE6B0', '#FFD0A0', '#FFB49A', '#FF9FB4', '#F3A2D8', '#D6A8FF']);
  pxList('PX Pier Gem', ['#FFD23F', '#FF6F61', '#4FB8F0']);
  pxList('PX Jungle Strata', ['#C8E6A0', '#9FD8A0', '#7CCB9E', '#5DB8A8', '#4AA3B5', '#6F86D6']);
  pxList('PX Jungle Gem', ['#3FC46A', '#B7F05A', '#FF5FA2']);
  pxList('PX Treetop Strata', ['#E8C28A', '#D9A66B', '#C68F59', '#A9D18E', '#8AC7A0', '#76B8B0']);
  pxList('PX Treetop Gem', ['#FFB347', '#7FE0C2']);
  pxList('PX Castle Strata', ['#E6DDF5', '#D3C6EE', '#BFAEE6', '#A99BDD', '#9AA8E6', '#8FC0E8']);
  pxList('PX Castle Gem', ['#9B7BFF', '#FFD23F']);
  pxList('PX Ice Strata', ['#E9F6FF', '#D3ECFF', '#BFE1FF', '#B3D0FF', '#B8C2FF', '#C6B6FF']);
  pxList('PX Ice Gem', ['#BFF3FF', '#FFFFFF', '#D7B0F5']);
  /* the lands' water slabs (lands[].slab). sky-world gives each wall as its two ends ("bands from
     A to B") or as a shift of pixel.js's bands; wallBands re-spans Home's 9 bands per channel onto
     the land's ends, so every wall keeps pixel.js's banding rhythm (lip = A, deepest = B exactly). */
  function wallBands(lip, deep) {
    var a = hexToRgb(HOME_WALL[0]), b = hexToRgb(HOME_WALL[8]), x = hexToRgb(lip), y = hexToRgb(deep);
    return HOME_WALL.map(function (h, i) {
      var c = hexToRgb(h), out = [0, 1, 2].map(function (ch) {
        var t = b[ch] === a[ch] ? i / 8 : (c[ch] - a[ch]) / (b[ch] - a[ch]);
        return x[ch] + (y[ch] - x[ch]) * t;
      });
      return rgbToHex(out[0], out[1], out[2]);
    });
  }
  var TURQUOISE = '#40E0D0';            /* the pier's wall: pixel.js bands shifted 8% toward turquoise */
  function slabTokens(isle, tops, floor, wall) {
    pxList('PX ' + isle + ' Water', tops);
    pxList('PX ' + isle + ' Floor', floor);
    put('PX ' + isle + ' Wall Lip', wall[0]);
    pxList('PX ' + isle + ' Wall', wall.slice(1));
  }
  slabTokens('Pier', ['#7EEBE0', '#52D3F0', '#3DB3EA'], ['#FFE9B8', '#A8EDE0', '#5FB6E6'],
    HOME_WALL.map(function (h) { return mixHex(h, TURQUOISE, 0.08); }));
  slabTokens('Jungle', ['#6FE3C8', '#3FC3D8', '#2E9FCC'], ['#CDE8A8', '#8FD8C0', '#4F9FC8'], wallBands('#B4F3E8', '#2B7FB8'));
  slabTokens('Castle', ['#7FD6F0', '#4FB0E8', '#3C93D6'], ['#D9E6C8', '#9FCDE0', '#5A92C8'], wallBands('#B4E8FF', '#2E6FC2'));
  slabTokens('Ice', ['#9FE6F5', '#6FD0F0', '#4AB4E6'], ['#E9F6FF', '#B6E2F2', '#6FA8DA'], wallBands('#D8FBFF', '#3B86CE'));
  /* the light modes (environment.lightModes): 13 backdrop bands each (top → horizon), hemi,
     sun / moon, haze, cube clouds (base / top), the backdrop's flat clouds (top / under) and the
     pixel sun / moon disc; the day's soft rainbow is pixel.js's */
  pxList('PX Day Band', ['#4FBCFF', '#5CC3FF', '#6BCAFF', '#7CD2FF', '#8FD9FF', '#A3E1FF', '#B7E8FF', '#C9EEFF', '#DAF2FF',
    '#E9F1FF', '#F6EDFB', '#FFE6F2', '#FFDFEE']);
  pxList('PX Sunset Band', ['#4A5BC8', '#5A63CF', '#6D6AD6', '#8270DA', '#9A76D8', '#B27BD2', '#C983C8', '#DC8CBD', '#EC97B0',
    '#F6A3A2', '#FDB396', '#FFC48C', '#FFD38A']);
  pxList('PX Night Band', ['#1F1B52', '#241F5C', '#2A2366', '#302770', '#372B79', '#3F2F82', '#48338A', '#523791', '#5D3B97',
    '#693F9B', '#76449D', '#84499D', '#924F9B']);
  px({
    'PX Day Hemi Sky': '#FFFFFF', 'PX Day Hemi Ground': '#C3B0FF', 'PX Day Sun': '#FFF4E2', 'PX Day Haze': '#DAF2FF',
    'PX Day Cloud Base': '#E3EAFF', 'PX Day Cloud Top': '#FFFFFF', 'PX Day Far Cloud': '#FFFFFF', 'PX Day Far Cloud Under': '#E6ECFF',
    'PX Sunset Hemi Sky': '#FFD9C9', 'PX Sunset Hemi Ground': '#9B7FD1', 'PX Sunset Sun': '#FFB27A', 'PX Sunset Haze': '#F6A3A2',
    'PX Sunset Cloud Base': '#F2C6DC', 'PX Sunset Cloud Top': '#FFE3EC', 'PX Sunset Far Cloud': '#FFD6E0',
    'PX Sunset Far Cloud Under': '#E3C6F0', 'PX Sunset Sun Disc': '#FF9F5A',
    'PX Night Hemi Sky': '#A9A6FF', 'PX Night Hemi Ground': '#3A2F72', 'PX Night Moon': '#CFD8FF', 'PX Night Haze': '#5D3B97',
    'PX Night Cloud Base': '#4A3F86', 'PX Night Cloud Top': '#6A5BB0', 'PX Night Far Cloud': '#6B5AA8',
    'PX Night Far Cloud Under': '#574A91', 'PX Night Moon Disc': '#FFF2C4', 'PX Night Moon Shade': '#FFE08A'
  });
  pxList('PX Rainbow', ['#FF7B7B', '#FFB36B', '#FFE066', '#7EE08A', '#6CC6FF', '#B39BFF']);
  /* the lands' ground (crisp C4): ground-only tokens for the pier, jungle, treetop, castle and ice
     terrain (ISLE_THEME top, edge, beach, patches) and the two path tiles that match their decks.
     No placeable thing but a path uses one as its main colour, so every item reads against the
     ground under it: the ice ground was the igloo's own 'PX Ice Snow', the treetop floor the
     platforms' 'PX Tree Pine Mid', the castle lawn the hedges' 'PX Castle Meadow 2', and sand and
     snow clipped to white. Existing tokens keep their values (only the ground moves) and Home keeps
     the mockup's. The names avoid every 'PX <Isle> Floor / Water / Wall / Strata / Gem n' family and
     the block comes after the last pxList, so none of them existed before it (crisp-palette (a)). */
  var GROUND_TOKENS = {
    'PX Pier Ground': '#F9DD9B', 'PX Pier Ground 2': '#F5D286', 'PX Pier Deck': '#DEC087', 'PX Pier Deck 2': '#C8A364',
    'PX Jungle Ground': '#74A344', 'PX Jungle Ground 2': '#80B14D',
    'PX Tree Ground': '#97C365', 'PX Tree Ground 2': '#8CB85B', 'PX Tree Trail': '#908759', 'PX Tree Trail 2': '#857D50',
    'PX Castle Lawn': '#B1E384', 'PX Castle Lawn 2': '#A9DA7D', 'PX Castle Cobble': '#A39DB6', 'PX Castle Cobble 2': '#938DA7',
    'PX Ice Ground': '#CCD7F3', 'PX Ice Ground 2': '#C5D2EF', 'PX Ice Ground 3': '#BFCCEB', 'PX Ice Pond': '#74C6EA', 'PX Ice Pond 2': '#5DB9DF'
  };
  px(GROUND_TOKENS);

  /* ---------------- tempo, caps and shared constants ---------------- */
  var TEMPO = {
    day: 100, show: 118, shop: 92, course: 128, penalty: 112, kart: 140,
    beatsPerBar: 4, danceCounts: 8, danceEveryBars: 16, encoreSec: 8,
    showMixSec: 1.6, showMixReducedSec: 0.25,
    /* idle loop periods (s); day half-beat = 0.3 s, most are whole multiples */
    idle: {
      treeSway: 4.2, pineSway: 5, palmSway: 3.6, flowerBob: 2.4, smoke: 2.4, swingIdle: 2.4,
      avatarBob: 2, windmillRps: 0.25, bubbleEvery: 2, cloudDrift: 0.08, seaScroll: 0.04,
      rockBlink: [5, 9], petIdle: [4, 8], avatarGlance: 6, doorGlint: 4, crownGlint: 3,
      lighthouseRps: 0.3, lighthouseCycle: 4, coneHz: 0.12, coneSweepDeg: 25
    },
    beatHz: function (bpm) { return bpm / 60; },
    beatSec: function (bpm) { return 60 / bpm; },
    barSec: function (bpm) { return 240 / bpm; },
    loopSec: function (bars, bpm) { return bars * 240 / bpm; }
  };
  var SHOW_BEAT_HZ = TEMPO.show / 60;      /* 1.97 Hz — the fastest beat-driven light */

  /* ---------------- v3 rates (Hz): ONE table every v3 module reads, test-enforced ----------------
     nothing over MAX_FLASH_HZ; full-contrast chases ≤ LED_CHASE_HZ per light; breathing lights
     (lamps, fireflies) ≤ 1; star twinkle and UI chrome loops ≤ 0.5; the aurora's colour drift
     ≤ 0.1. ledFrame is the one LED rate: every LED screen and the YAY frame cycle (D83). */
  var ART3 = {
    FREQS: {
      bulbChase: 1.5, breathe: 1.0, firefly: 1.0, starTwinkle: 0.5, flagFlutter: 0.5, newPulse: 0.5, uiLoop: 0.5,
      ledFrame: 0.6, cagePulse: 1.5, invalidCell: 1.5, auroraDrift: 0.1, birdFlap: 1.6, critterFlap: 2.0,
      beatPulse: SHOW_BEAT_HZ
    }
  };
  var FREQS = ART3.FREQS;

  var FX = {
    particles: { LOW: 128, MID: 256, HIGH: 512 },
    stars: { LOW: 120, MID: 250, HIGH: 250 },
    snow: { LOW: 60, MID: 100, HIGH: 150 },
    confetti: 120, bubbles: 24, petals: 40, petalsPerTree: 4, glints: 40,
    dustPuffs: 6, fireworkRings: 3, confettiMemberShare: 0.4,
    haloSize: [0.5, 1.2], haloOpacity: { day: 0.5, show: 0.9 },
    blob: { token: 'Blob Shadow', opacity: 0.22, scale: 0.9 },
    decal: { r: 0.7, opacity: 0.35 },
    /* emissive uplight pools under lamps and signs (golden hour → Showtime opacity) */
    uplight: { r: 0.5, day: 0.25, show: 0.4 },
    shake: { amp: 0.06, dur: 0.18 },
    /* any local brightness bloom (lens flash, screen wipe) at most once per this many s per item */
    bloomGapSec: 1.5,
    maxFlashHz: MAX_FLASH_HZ
  };

  /* v2 materials: a deeper toon ramp, crisp 0.05 architecture bevels, no hull on buildings */
  var MATERIAL = {
    toonRamp: [64, 128, 200, 255],
    rim: { day: { token: 'Rim Dusk', strength: 0.35, member: 0.25, exp: 3.0 }, show: { token: 'Rim Night', strength: 0.6, member: 0.5 } },
    outline: { token: 'Midnight Ink', building: 0, character: 0.009, selected: 'Star Gold', pulse: [0.02, 0.03], hz: 1.5 },
    glassOpacity: 0.45, neonSleeve: { r: 0.05, core: 0.015, day: 0.25, show: 0.45 },
    /* bevel radius: architecture min(arch × smallest side, archMax); organic pieces 0.18 × smallest side */
    bevel: { arch: 0.05, archMax: 0.06, organic: 0.18 },
    toneShift: 12, skirting: -6,
    /* v3 pixel-vox: corner AO by occluder count 3 → 0 (the mesher multiplies it into the vertex
       colour), and the procedural bevel [hi, lo] in LINEAR light, relative to the mockup texture's
       base #F2F2F8 (the crisp fix C2): mode 'block' = its #FFFFFF / #D4D3E3 edges (×1.126 top-left,
       ×0.741 bottom-right), the soft family (terrain, paths) = #F8F8FB / #E3E2EE (×1.057, ×0.865).
       The base itself (×0.888) is the exposure fit's job (VOX_EXPOSURE / uVoxGain). */
    voxAo: [0.70, 0.80, 0.90, 1.0],
    voxBevel: [[0.126, 0.26], [0.057, 0.135]]
  };
  /* matcap stops, centre/spec → edge (128² canvases sharing one matcap program) */
  var MATCAPS = {
    gold: ['Gold Spec', 'Gold Light', 'Gold Base', 'Gold Deep', 'Gold Edge'],
    chrome: ['Cloud White', 'Chrome', 'Chrome Deep', 'Iridescent Rim'],
    pearl: ['Holo Pink', 'Holo Blue', 'Holo Mint', 'Holo Lemon'],
    smoked: ['Glass Edge', 'Smoked Mid', 'Smoked Glass', 'Smoked Deep'],
    gunmetal: ['Gunmetal Spec', 'Gunmetal Mid', 'Gunmetal', 'Gunmetal Deep'],
    foil: ['Foil Pink', 'Foil Blue', 'Foil Mint', 'Foil Gold']
  };
  /* edit / placement overlay (edit3d.js) */
  var EDIT = {
    grid: { token: 'Cloud White', opacity: 0.55 },
    valid: { token: 'Success', opacity: 0.45, edge: 'Neon Cyan' },
    invalid: { token: 'Error', opacity: 0.42, hz: 1.5 },
    entrance: { token: 'Star Gold', opacity: 0.25 },
    selected: { token: 'Star Gold', hz: 1.5 },
    ghost: { opacity: 0.85, invalidOpacity: 0.5, lift: 0.25, wobbleDeg: 4, wobbleRate: 3, shadow: 0.7 },
    tiltDeg: 62
  };
  /* the v2 neon sets: every show.neon, chase and cone picks these up; an LED set always mixes
     at least 4 hues (with the member colour) and no hue covers more than 35% */
  var NEON3 = ['Neon Magenta', 'LED Cyan', 'Electric Violet'];
  var NEON4 = ['Neon Magenta', 'LED Cyan', 'Electric Violet', 'Laser Lime'];
  /* Showtime spotlight cones (env.js): two stage buoys + one pole behind the house */
  var CONES = {
    tokens: NEON3,
    buoys: [[-9.5, -0.32, -6.5], [9.5, -0.32, -6.5]], poleBehindHouse: [0, 0, -1.6],
    radius: 1.3, height: 10, sweepDeg: 25, hz: 0.12, phaseDeg: 120, alpha: 0.2
  };
  /* triangle budgets (modellingRules); city buildings use per-id tris (the stage = attraction) */
  var BUDGET = {
    path: 120, flower: 350, small: 500, tree: 900, landmark: 1400, fun: 1200,
    house: 3500, houseBody: 1000, attraction: 4000, crowd: 2000, building: 3000,
    pet: 1800, acc: 300, avatar: 1500, kart: 1500, ball: 400
  };
  /* shop shine by price only: plain, pastel holo edge, animated holo foil, gold foil */
  var SHINE_BANDS = [0, 200, 600, 1200];
  var SHINE_NAMES = ['plain', 'holo-edge', 'holo-foil', 'gold-foil'];
  /* must equal SLWorldCore.DEFAULTS (test-enforced) */
  var SLOT_DEFAULTS = { wall: 'wall_cream', roof: 'roof_red', door: 'door_blue', shape: 'shape_loft', course: 'course_meadow',
                        ball: 'ball_classic', stadium: 'stadium_day', kart: 'kart_red', track: 'track_loop' };

  /* 'isleLandmark' (v3, D73) is the five lm_* sky landmarks only: up to ISLAND_ITEM_MAX_H 5.5 and
     TRIS_CAPS.isleLandmark; 'landmark' stays the windmill / lighthouse kind (2.9 u, 900 tris).
     'food' (the kids update) is the six pet foods: a display model only, never placed or worn */
  var KINDS = ['tree', 'flower', 'bush', 'rock', 'mushroom', 'light', 'flag', 'decor', 'landmark', 'path', 'fun',
               'house', 'style', 'pet', 'acc', 'land', 'attraction', 'variant', 'cosmetic', 'building', 'isleLandmark', 'food'];
  var ORGANIC_KINDS = { tree: 1, flower: 1, bush: 1, rock: 1, mushroom: 1 };
  /* v2: only characters keep an ink hull; architecture gets the edit selection hull only */
  var OUTLINE_KINDS = { pet: 1, acc: 1, avatar: 1 };
  var PLACED_KINDS = { tree: 1, flower: 1, bush: 1, rock: 1, mushroom: 1, light: 1, flag: 1, decor: 1, landmark: 1,
                       path: 1, fun: 1, house: 1, attraction: 1, building: 1, isleLandmark: 1 };
  /* CATALOG act → the pivot its act handler drives ('launch' is per attraction) */
  var ACT_PIVOT = { glow: 'glow', wave: 'flag', spin: 'spin', bounce: 'mat', splash: 'water', swing: 'swing',
                    bubbles: 'emitter', home: 'door', launch: null,
                    serve: 'hatch', snap: 'flash', screen: 'screen', record: 'meter', dance: 'floor', hangout: 'deck', encore: 'lights' };
  var LAUNCH_PIVOT = { att_course: 'spin', att_pitch: 'ball', att_kart: 'kart' };
  var PET_BONES = ['body', 'head', 'neck', 'tail', 'earL', 'earR', 'legFL', 'legFR', 'legBL', 'legBR', 'wingL', 'wingR'];
  var PET_SOCKETS = ['hat', 'neck', 'face', 'back', 'seat'];
  var FAIRY = ['Star Gold', 'Coral', 'Splash Blue', 'Leaf Mint', 'Grape'];

  /* ---------------- home shapes ----------------
     HOUSE_H[shape][roof]: the house top for each shape and roof (all ≤ 2.9).
     HOUSE_TRIS: body and crown budgets per shape; with the door and every detail a
     house stays ≤ BUDGET.house (houseBudget, test-enforced). The roof slot dresses
     each shape's crown, so every roof name stays true on every shape. */
  var SHAPES = ['shape_cottage', 'shape_loft', 'shape_villa', 'shape_tower', 'shape_dome'];
  var ROOFS = ['roof_red', 'roof_blue', 'roof_thatch', 'roof_candy', 'roof_castle'];
  function byRoof(v) { var o = {}; ROOFS.forEach(function (r, i) { o[r] = v[i]; }); return o; }
  var HOUSE_H = {
    shape_cottage: byRoof([2.3, 2.3, 2.3, 2.3, 2.9]),
    shape_loft: byRoof([1.95, 1.95, 2.1, 2.0, 2.75]),
    shape_villa: byRoof([1.2, 1.2, 1.2, 1.3, 1.95]),
    shape_tower: byRoof([2.6, 2.6, 2.75, 2.65, 2.9]),
    shape_dome: byRoof([2.25, 2.25, 2.25, 2.25, 2.25])
  };
  var HOUSE_TRIS = {
    body: { shape_cottage: 1000, shape_loft: 1200, shape_villa: 1200, shape_tower: 1200, shape_dome: 1200 },
    /* modern crowns (the cottage keeps its v1 roof budgets from LOOK) */
    crown: 900, crownCastle: 1050, door: 150
  };
  /* trim variants: 3 per city building (by uid), 2 per non-cottage shape (by profile seed);
     v3 (D57): the colourways of the land decor and the platform tree (by uid, V3_VARIANT_IDS);
     land shops (D101): twelve more ids, colourways or small trims only, never different contents */
  var VARIANTS = {
    bld_photobooth: 3, bld_boba: 3, bld_ledtower: 3, bld_recording: 3, bld_dance: 3, bld_rooftop: 3, bld_stage: 3,
    shape_loft: 2, shape_villa: 2, shape_tower: 2, shape_dome: 2,
    pier_beachhut: 4, jungle_stilthut: 3, ice_snowhut: 3, treetop_platform: 2, castle_wall: 3,
    pier_deckchair: 4, jungle_market: 3, jungle_fruitstall: 2, jungle_parrot: 2, jungle_lantern: 2, treetop_pod: 2,
    castle_herbs: 3, castle_banner: 3, castle_window: 3, castle_stall: 3, ice_pine: 2, ice_sculpture: 3
  };
  /* D72: these v3 ids key their templates on the colourway ('v:<n>', as buildings do); every
     V4.54 id keeps its V4.54 stateKey / resolveStyle byte for byte. variantOf(uid, id) is only a
     copy's starting colourway: an explicit st.variant (a placement's stored vr, D115) wins. */
  var V3_VARIANT_IDS = ['pier_beachhut', 'jungle_stilthut', 'ice_snowhut', 'treetop_platform', 'castle_wall',
    'pier_deckchair', 'jungle_market', 'jungle_fruitstall', 'jungle_parrot', 'jungle_lantern', 'treetop_pod',
    'castle_herbs', 'castle_banner', 'castle_window', 'castle_stall', 'ice_pine', 'ice_sculpture'];
  var V3_VARIANT = {};
  V3_VARIANT_IDS.forEach(function (id) { V3_VARIANT[id] = 1; });
  /* building trim n: accent [n], sign side [n % 2], stripe pattern [n] */
  var BUILDING_TRIMS = { accent: ['@member', 'Neon Magenta', 'LED Cyan'], signSide: ['L', 'R'], stripe: ['A', 'B', 'C'] };

  /* ---------------- the look table ---------------- */
  var FP = { house_cottage: [2, 2], att_course: [2, 2], att_pitch: [3, 2], att_kart: [2, 2],
             bld_boba: [2, 1], bld_recording: [2, 1], bld_dance: [2, 2], bld_rooftop: [2, 2], bld_stage: [3, 2],
             /* v3 (catalogAdditions.entries) */
             lm_pier_wheel: [3, 2], lm_jungle_treehouse: [3, 3], lm_treetop_lookout: [3, 3], lm_castle_keep: [4, 3],
             lm_ice_igloo: [3, 2], pier_carousel: [2, 2], jungle_falls: [2, 1], treetop_bridge: [2, 1], treetop_net: [2, 2],
             castle_feast: [2, 1], ice_slide: [2, 1], ice_rink: [2, 2],
             /* land shops (catalogAdditions.entries 31–136) */
             pier_teacups: [2, 2], pier_flyingchairs: [2, 2], pier_swingship: [3, 1], pier_train: [3, 2], pier_dodgems: [3, 2],
             pier_flume: [3, 2], pier_coaster: [4, 2], jungle_monkeybars: [2, 1], jungle_camp: [2, 1], jungle_den: [2, 1],
             jungle_canoe: [3, 2], jungle_arch: [2, 1], treetop_cargonet: [2, 1], treetop_leap: [2, 1], treetop_bigslide: [2, 2],
             treetop_zipline: [3, 1], treetop_tunnel: [2, 1], treetop_beams: [2, 1], treetop_seesaw: [2, 1], castle_flinger: [2, 1],
             castle_joust: [3, 1], castle_maze: [2, 2], castle_bridge: [2, 1], castle_gate: [2, 1], castle_dragon: [2, 2],
             ice_sled: [3, 1], ice_skilift: [3, 1], ice_cocoa: [2, 1], ice_fort: [2, 2], ice_choir: [2, 1], ice_castle: [2, 2] };
  /* the optional fields a v3 entry may carry (see the v3 LOOK block); v2 entries never pass them */
  var V3_FIELDS = ['act', 'perform', 'performAt', 'trail', 'pivotParents', 'levelPivots', 'anchorPivots', 'states', 'copy', 'toggle',
                   'variants', 'variantTokens', 'display', 'isle', 'pieces', 'joins', 'trisLow', 'trisBare'];
  var INSTANCING = { pet: 'rig', acc: 'socket', style: 'part', land: 'env', variant: 'part', cosmetic: 'part' };
  function noShow() { return { neon: [], halo: null, led: null, chase: null }; }
  /* fills every schema field so consumers never test for undefined */
  function entry(id, kind, h, colors, o) {
    o = o || {};
    var show = noShow(), k;
    if (o.show) for (k in o.show) show[k] = o.show[k];
    var placed = !!PLACED_KINDS[kind];
    var fp = FP[id] || [1, 1];
    var e = {
      kind: kind, h: h, colors: colors, mats: o.mats || {},
      pivots: o.pivots || [], anchors: o.anchors || (placed ? ['top'] : []),
      actPivot: o.actPivot || null, idle: o.idle || null, loops: o.loops || [], show: show,
      organic: !!ORGANIC_KINDS[kind], outline: !!OUTLINE_KINDS[kind],
      instancing: placed ? 'batch' : (o.instancing || INSTANCING[kind] || 'part'),
      perCopy: o.perCopy || [],
      hit: o.hit !== undefined ? o.hit : (placed ? [fp[0], Math.max(h, 0.8), fp[1]] : null),
      tris: o.tris
    };
    ['part', 'slot', 'socket', 'base', 'bones', 'bodyTris', 'crowdTris'].concat(V3_FIELDS).forEach(function (x) { if (o[x] !== undefined) e[x] = o[x]; });
    return e;
  }

  var LOOK = {};
  function def(id, kind, h, colors, o) { LOOK[id] = entry(id, kind, h, colors, o); }
  var SWAY = ['sway'];
  var treeIdle = function (deg, period) { return { type: 'sway', deg: deg, period: period, pivot: 'sway' }; };
  var flowerIdle = { type: 'bob', pct: 2, period: TEMPO.idle.flowerBob, pivot: 'sway' };
  var beatPulse = { type: 'pulse', pct: 12, on: 'beat', hz: SHOW_BEAT_HZ, when: 'lit+music', pivot: 'glow' };
  var flagLed = { hz: 1.5, tokens: NEON4 };

  /* -- starter -- */
  def('house_cottage', 'house', 2.3,
    { wall: 'WALL.$wall', door: 'DOOR.$door', step: 'Concrete', mat: 'Teak', window: 'Smoked Glass', muntin: 'Gunmetal', knob: 'Star Gold', windowGlow: 'Window Warm' },
    { pivots: ['door', 'emitter', 'flag', 'glow'], anchors: ['top', 'door', 'spot'], actPivot: 'door', mats: { window: 'state' },
      show: { windowGlow: { token: 'Window Warm' } }, tris: BUDGET.house, bodyTris: BUDGET.houseBody });
  def('att_course', 'attraction', 1.9,
    { pillar: 'Graphite', banner: 'THEME.$course.1', plate: 'THEME.$course.0', text: 'Bone White', bulb: 'Holo Lemon', star: 'Star Gold',
      hurdlePost: 'Cloud White', hurdleA: 'Coral', hurdleB: 'Star Gold' },
    { pivots: ['spin', 'glow'], anchors: ['top', 'spot'], actPivot: 'spin', mats: { bulb: 'state' },
      idle: { type: 'spin', rps: 0.25, pivot: 'spin' },
      show: { chase: { on: 'beat', hz: SHOW_BEAT_HZ, groups: 2, tokens: NEON3, bulbs: 14 }, spot: true }, tris: BUDGET.attraction });
  def('pet_puppy', 'pet', 0.55,
    { body: 'PETCOL.pet_puppy.body', dark: 'PETCOL.pet_puppy.dark', light: 'PETCOL.pet_puppy.light', nose: 'PETCOL.pet_puppy.nose',
      ear: 'PETCOL.pet_puppy.dark', eye: 'Midnight Ink', glint: 'Cloud White', blush: 'Blush', mouth: 'Midnight Ink' },
    { pivots: PET_SOCKETS, bones: PET_BONES, idle: { type: 'actor' }, hit: [0.8, 0.8, 0.8], tris: BUDGET.pet });
  def('wall_cream', 'style', 1.1, { wall: 'WALL.wall_cream' }, { part: 'wall', slot: 'wall', base: 'house_cottage', tris: 0 });
  def('roof_red', 'style', 2.3, { roof: 'ROOF.roof_red.0', shade: 'ROOF.roof_red.1' }, { part: 'roof', slot: 'roof', base: 'house_cottage', tris: 1000 });
  def('door_blue', 'style', 0.62, { door: 'DOOR.door_blue', knob: 'Star Gold' }, { part: 'door', slot: 'door', base: 'house_cottage', pivots: ['door'], tris: 150 });
  /* home shapes: the whole house form (part 'shape'); h = the red-roof top (HOUSE_H has every roof).
     Glazing is the 'state' part (Smoked Glass by day → Window Warm lit). */
  def('shape_cottage', 'style', HOUSE_H.shape_cottage.roof_red,
    { wall: 'WALL.$wall', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal', step: 'Concrete' },
    { part: 'shape', slot: 'shape', base: 'house_cottage', mats: { glass: 'state' }, show: { windowGlow: { token: 'Window Warm' } },
      tris: HOUSE_TRIS.body.shape_cottage });
  def('shape_loft', 'style', HOUSE_H.shape_loft.roof_red,
    { wall: 'WALL.$wall', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal', soffit: 'Teak', downlight: 'Window Warm',
      parapet: 'Concrete Light', step: 'Concrete', led: 'LED Cyan' },
    { part: 'shape', slot: 'shape', base: 'house_cottage', mats: { glass: 'state', led: 'neon:LED Cyan' },
      show: { windowGlow: { token: 'Window Warm' }, neon: ['LED Cyan'], halo: { token: 'Window Warm', size: 0.35 } },
      tris: HOUSE_TRIS.body.shape_loft });
  def('course_meadow', 'variant', 1.9, { plate: 'THEME.course_meadow.0', banner: 'THEME.course_meadow.1', hedge: 'Bush', flower: 'Tulip Pink' },
    { slot: 'course', base: 'att_course', tris: 600 });

  /* -- garden: trees -- */
  def('tree_oak', 'tree', 1.6, { trunk: 'Bark', canopy: 'Leaf Deep', canopyLow: 'Turf Shade', dab: 'Leaf Lit' },
    { pivots: SWAY, idle: treeIdle(1.5, TEMPO.idle.treeSway), tris: BUDGET.tree });
  def('tree_pine', 'tree', 1.8, { trunk: 'Pine Bark', cone: 'Pine', top: 'Pine Light' },
    { pivots: SWAY, idle: treeIdle(1, TEMPO.idle.pineSway), tris: BUDGET.tree });
  def('tree_apple', 'tree', 1.55, { trunk: 'Bark', canopy: 'Leaf Deep', canopyLow: 'Turf Shade', dab: 'Leaf Lit', apple: 'Apple Red', spec: 'Cloud White' },
    { pivots: SWAY, idle: treeIdle(1.5, TEMPO.idle.treeSway), tris: BUDGET.tree });
  def('tree_blossom', 'tree', 1.6, { trunk: 'Bark', canopy: 'Blossom', canopyLow: 'Blossom Shade', dab: 'Blossom Light', petal: 'Blossom Light' },
    { pivots: SWAY, idle: treeIdle(1.5, TEMPO.idle.treeSway), loops: [{ type: 'petals', n: FX.petalsPerTree, max: FX.petals }], tris: BUDGET.tree });
  def('tree_palm', 'tree', 1.9,
    { trunkA: 'Palm Bark', trunkB: 'Palm Bark Dark', frondA: 'Frond', frondB: 'Frond Shade', frondC: 'Frond Light', frondD: 'Frond Deep', coconut: 'Palm Bark Dark' },
    { pivots: SWAY, idle: treeIdle(3, TEMPO.idle.palmSway), tris: BUDGET.tree });

  /* -- garden: flowers, plants, rock -- */
  def('flower_tulip', 'flower', 0.5, { mound: 'Turf Shade', stem: 'Stem', leaf: 'Stem', cupA: 'Tulip Red', cupB: 'Tulip Yellow', cupC: 'Tulip Pink' },
    { pivots: SWAY, idle: flowerIdle, tris: BUDGET.flower });
  def('flower_daisy', 'flower', 0.35, { mound: 'Turf Shade', stem: 'Stem', petal: 'Cloud White', centre: 'Tulip Yellow' },
    { pivots: SWAY, idle: flowerIdle, tris: BUDGET.flower });
  def('flower_sun', 'flower', 0.75, { mound: 'Turf Shade', stem: 'Stem', leaf: 'Mound', petal: 'Sunflower', disc: 'Palm Bark Dark' },
    { pivots: ['sway', 'head0', 'head1'], idle: flowerIdle, loops: [{ type: 'track', day: 'sun', show: 'spot', pivots: ['head0', 'head1'] }],
      show: { track: 'spot' }, tris: BUDGET.flower });
  def('bush_rose', 'bush', 0.6, { mound: 'Turf Shade', puff: 'Bush', puffLight: 'Bush Light', roseA: 'Rose', roseB: 'Rose Deep', roseC: 'Rose Pale' },
    { pivots: SWAY, idle: flowerIdle, tris: BUDGET.small });
  /* v2: a plain mossy rock (no eyes, no blink) */
  def('rock_mossy', 'rock', 0.45, { rock: 'Cliff Rock', moss: 'Moss' }, { pivots: ['sway'], tris: BUDGET.small });

  /* -- lights (v3, D33: the lantern is 1.0 u so it never hides the avatar; the v2 bollard model
     keeps its own 1.4 u stack) -- */
  def('lantern', 'light', 1.0,
    { post: 'Gunmetal', cage: 'Gunmetal', glassOff: 'Glass Off', glassOn: 'Sunset Amber', bulb: 'Star Gold', cap: 'Gunmetal' },
    { pivots: ['glow'], actPivot: 'glow', mats: { glass: 'state' }, idle: beatPulse,
      show: { halo: { token: 'Lamp Halo', size: 0.9 }, decal: { token: 'Lamp Warm', r: FX.decal.r, opacity: FX.decal.opacity } }, tris: BUDGET.small });
  def('mushroom_glow', 'mushroom', 0.55, { stem: 'Stem Cream', capOff: 'Cap Violet', capOn: 'LED Cyan', spot: 'Cloud White', mound: 'Mound' },
    { pivots: ['sway', 'glow'], actPivot: 'glow', mats: { cap: 'state' }, idle: beatPulse,
      show: { halo: { token: 'Cap Halo', size: 0.8 }, decal: { token: 'Cap Neon', r: FX.decal.r, opacity: FX.decal.opacity } }, tris: BUDGET.small });

  /* -- flags -- */
  def('flag_pole', 'flag', 1.9, { pole: 'Pole', finial: 'Gold Base', cloth: 'Coral', diamond: 'Star Gold' },
    { pivots: ['flag'], actPivot: 'flag', mats: { finial: 'gold' }, perCopy: ['cloth'],
      idle: { type: 'flutter', amp: 0.04, hz: 2, pivot: 'flag' }, show: { led: flagLed }, tris: BUDGET.small });
  def('bunting', 'flag', 1.0, { post: 'Bark', line: 'Ink', p1: 'Coral', p2: 'Star Gold', p3: 'Splash Blue', p4: 'Leaf Mint', p5: 'Grape' },
    { pivots: ['flag'], actPivot: 'flag', perCopy: ['pennants'],
      idle: { type: 'pennants', deg: 6, hz: 0.8, pivot: 'flag' }, show: { led: flagLed }, tris: BUDGET.small });

  /* -- garden and beach decor -- */
  def('bench', 'decor', 0.5, { plank: 'Teak', leg: 'Gunmetal' }, { anchors: ['top', 'seat'], show: { sit: true }, tris: BUDGET.small });
  def('sandcastle', 'decor', 0.7, { sand: 'Castle Sand', door: 'Castle Door', flag: 'Coral', stick: 'Ink', shell: 'Blossom Light' }, { tris: BUDGET.small });
  def('umbrella', 'decor', 1.25, { canopyA: 'Coral', canopyB: 'Cloud White', pole: 'Pole', towel: 'Splash Blue' }, { tris: BUDGET.small });
  def('snowman', 'decor', 0.95, { snow: 'Snow', hat: 'Ink', carrot: 'Carrot', scarf: 'Tulip Red', coal: 'Ink', sparkle: 'Cloud White' },
    { idle: { type: 'sparkle', n: 6, period: 4.8 }, tris: BUDGET.small });

  /* -- landmarks -- */
  def('windmill', 'landmark', 2.2, { tower: 'Bone White', door: 'Bark', cap: 'Coral', sail: 'Bone White', hub: 'Coral' },
    { pivots: ['spin'], actPivot: 'spin', idle: { type: 'spin', rps: TEMPO.idle.windmillRps, pivot: 'spin' },
      show: { neon: NEON4, streak: 6 }, tris: BUDGET.landmark });
  def('lighthouse', 'landmark', 2.8, { tower: 'Cloud White', band: 'Tulip Red', gallery: 'Gunmetal', glassOff: 'Glass Off', glassOn: 'Lamp Warm', roof: 'Tulip Red' },
    { pivots: ['glow', 'beam'], actPivot: 'glow', mats: { glass: 'state' },
      show: { beam: { token: 'Lamp Halo', tokens: NEON3, every: TEMPO.idle.lighthouseCycle, rps: TEMPO.idle.lighthouseRps, r: 0.6, len: 6 },
              halo: { token: 'Lamp Halo', size: 1.0 }, decal: { token: 'Lamp Warm', r: FX.decal.r, opacity: FX.decal.opacity } }, tris: BUDGET.landmark });

  /* -- paths: ground tiles; Showtime runway under-glow + chase (2 cells/s, one pulse per 4 cells = 0.5 Hz a cell) -- */
  var runway = { glow: { token: 'Neon Cyan', opacity: 0.35 }, chase: { speed: 2, spacing: 4, hz: 0.5 } };
  def('path_stone', 'path', 0.04, { stone: 'Pebble', hi: 'Stone Light' }, { show: runway, tris: BUDGET.path });
  def('path_wood', 'path', 0.04, { plankA: 'Teak Light', plankB: 'Teak', nail: 'Ink' }, { show: runway, tris: BUDGET.path });
  def('path_flower', 'path', 0.04, { stone: 'Stepping Stone', f1: 'Tulip Pink', f2: 'Tulip Yellow', f3: 'Cloud White' }, { show: runway, tris: BUDGET.path });

  /* -- fun -- */
  def('trampoline', 'fun', 0.45, { frame: 'Gunmetal', mat: 'Graphite', shine: 'LED Cyan', leg: 'Midnight Ink' },
    { pivots: ['mat'], anchors: ['top', 'seat'], actPivot: 'mat', tris: BUDGET.fun });
  def('fountain', 'fun', 0.95, { basin: 'Concrete Light', water: 'Water', drop: 'Water' },
    { pivots: ['water'], actPivot: 'water', idle: { type: 'drip', streams: 3, drops: 12, period: 0.9, pivot: 'water' },
      show: { neon: NEON3 }, tris: BUDGET.fun });
  def('swing', 'fun', 1.4, { post: 'Palm Bark', leaves: 'Leaf Deep', rope: 'Pole', seat: 'Teak' },
    { pivots: ['swing'], anchors: ['top', 'seat'], actPivot: 'swing', idle: { type: 'pendulum', deg: 4, period: TEMPO.idle.swingIdle, pivot: 'swing' }, tris: BUDGET.fun });
  def('bubbles', 'fun', 0.8, { body: 'Graphite', face: 'Gunmetal', wand: 'Pole', bubble: 'Holo Pink', rim: 'Bubble Rim' },
    { pivots: ['emitter'], actPivot: 'emitter', mats: { bubble: 'glass' }, idle: { type: 'emit', every: TEMPO.idle.bubbleEvery, pivot: 'emitter' }, tris: BUDGET.fun });

  /* -- home styles: sub-parts assembled onto house_cottage (h = top of the part above the house base) -- */
  ['wall_pink', 'wall_mint', 'wall_sky', 'wall_lilac', 'wall_concrete', 'wall_gallery', 'wall_graphite', 'wall_midnight'].forEach(function (id) {
    def(id, 'style', 1.1, { wall: 'WALL.' + id }, { part: 'wall', slot: 'wall', base: 'house_cottage', tris: 0 });
  });
  def('roof_blue', 'style', 2.3, { roof: 'ROOF.roof_blue.0', shade: 'ROOF.roof_blue.1' }, { part: 'roof', slot: 'roof', base: 'house_cottage', tris: 1000 });
  def('roof_thatch', 'style', 2.3, { roof: 'ROOF.roof_thatch.0', shade: 'ROOF.roof_thatch.1', straw: 'Straw' }, { part: 'roof', slot: 'roof', base: 'house_cottage', tris: 1000 });
  def('roof_candy', 'style', 2.3,
    { roof: 'ROOF.roof_candy.0', shade: 'ROOF.roof_candy.1', icing: 'Cloud White', s1: 'Star Gold', s2: 'Splash Blue', s3: 'Leaf Mint', s4: 'Grape', s5: 'Cloud White', cherry: 'Tulip Red' },
    { part: 'roof', slot: 'roof', base: 'house_cottage', tris: 1000 });
  def('roof_castle', 'style', 2.9, { roof: 'Castle Stone', tower: 'Castle Tower', cone: 'Castle Cone', pennantL: 'Coral', pennantR: 'Star Gold', slit: 'Lamp Post' },
    { part: 'roof', slot: 'roof', base: 'house_cottage', tris: 1200 });
  def('door_red', 'style', 0.62, { door: 'DOOR.door_red', knob: 'Star Gold' }, { part: 'door', slot: 'door', base: 'house_cottage', pivots: ['door'], tris: 150 });
  def('door_green', 'style', 0.62, { door: 'DOOR.door_green', knob: 'Star Gold' }, { part: 'door', slot: 'door', base: 'house_cottage', pivots: ['door'], tris: 150 });
  def('door_gold', 'style', 0.62, { door: 'DOOR.door_gold', knob: 'Star Gold' },
    { part: 'door', slot: 'door', base: 'house_cottage', pivots: ['door'], mats: { door: 'gold' }, idle: { type: 'glint', n: 2, period: TEMPO.idle.doorGlint }, tris: 150 });
  def('door_glass', 'style', 0.62, { door: 'DOOR.door_glass', frame: 'Gunmetal', knob: 'Gunmetal Spec' },
    { part: 'door', slot: 'door', base: 'house_cottage', pivots: ['door'], mats: { door: 'smoked' }, tris: 150 });
  /* details: one budget per id for every shape (a steel flue replaces the brick stack on
     modern shapes); with the body, crown and door every house stays ≤ BUDGET.house */
  def('detail_windowbox', 'style', 0.75, { box: 'Bark', f1: 'Rose Deep', f2: 'Star Gold', f3: 'Tulip Pink' }, { part: 'detail', slot: 'detail', base: 'house_cottage', tris: 250 });
  def('detail_chimney', 'style', 2.25, { chimney: 'Chimney', cap: 'Chimney Cap', smoke: 'Smoke', flue: 'Gunmetal' },
    { part: 'detail', slot: 'detail', base: 'house_cottage', pivots: ['emitter'],
      idle: { type: 'smoke', n: 3, period: TEMPO.idle.smoke, rise: 0.6, grow: 1.8, pivot: 'emitter' }, show: { tint: { token: 'Iridescent Rim' } }, tris: 300 });
  def('detail_lights', 'style', 1.15, { wire: 'Ink', b1: 'Star Gold', b2: 'Coral', b3: 'Splash Blue', b4: 'Leaf Mint', b5: 'Grape' },
    { part: 'detail', slot: 'detail', base: 'house_cottage', pivots: ['glow'], mats: { bulb: 'state' }, idle: { type: 'twinkle', hz: 0.5, pivot: 'glow' },
      show: { chase: { on: 'beat', hz: SHOW_BEAT_HZ, groups: 3, tokens: FAIRY, bulbs: 11 }, halo: { token: 'Butter', size: 0.25 } }, tris: 300 });
  def('detail_flag', 'style', 2.8, { pole: 'Ink', pennant: 'Star Gold' },
    { part: 'detail', slot: 'detail', base: 'house_cottage', pivots: ['flag'], perCopy: ['cloth'], idle: { type: 'flutter', amp: 0.04, hz: 2, pivot: 'flag' }, tris: 120 });
  /* a member-colour neon core + sleeve along each shape's roofline: steady at golden hour,
     a 1 Hz chase at Showtime, steady under reduced motion */
  def('detail_neon', 'style', 2.3, { neon: '@member' },
    { part: 'detail', slot: 'detail', base: 'house_cottage', pivots: ['glow'], mats: { neon: 'state' }, show: { chase: { hz: 1, groups: 4 } }, tris: 200 });
  def('shape_villa', 'style', HOUSE_H.shape_villa.roof_red,
    { wall: 'WALL.$wall', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal', deck: 'Teak', deckAlt: 'Teak Light',
      pool: 'Lagoon', poolGlow: 'LED Cyan', coping: 'Concrete Light', cushion: 'Bone White' },
    { part: 'shape', slot: 'shape', base: 'house_cottage', pivots: ['pool'], mats: { glass: 'state', pool: 'state' },
      idle: { type: 'ripple', period: 2.4, pivot: 'pool' },
      show: { windowGlow: { token: 'Window Warm' }, halo: { token: 'LED Cyan', size: 0.8 }, pool: { token: 'LED Cyan', mix: 0.45 } },
      tris: HOUSE_TRIS.body.shape_villa });
  def('shape_tower', 'style', HOUSE_H.shape_tower.roof_red,
    { wall: 'WALL.$wall', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal', plinth: 'Concrete', stair: 'Gunmetal',
      sign: '@member', signBack: 'Midnight Ink' },
    { part: 'shape', slot: 'shape', base: 'house_cottage', pivots: ['sign'], mats: { glass: 'state', sign: 'sign' },
      idle: { type: 'breathe', hz: 0.5, min: 0.7, when: 'show', pivot: 'sign' },
      show: { windowGlow: { token: 'Window Warm' }, halo: { token: '@member', size: 0.9 } },
      tris: HOUSE_TRIS.body.shape_tower });
  def('shape_dome', 'style', HOUSE_H.shape_dome.roof_red,
    { wall: 'WALL.$wall', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal', ring: 'Gunmetal', led: 'LED Cyan',
      pod: 'Smoked Glass', antenna: 'Gunmetal', tip: 'Sunset Amber' },
    { part: 'shape', slot: 'shape', base: 'house_cottage', pivots: ['ring', 'tip'], mats: { glass: 'state', led: 'state', pod: 'smoked' },
      idle: { type: 'hue', hz: 0.25, tokens: NEON3, when: 'show', pivot: 'ring' },
      loops: [{ type: 'breathe', hz: 0.5, min: 0.6, pivot: 'tip' }],
      show: { windowGlow: { token: 'Window Warm' }, halo: { token: 'LED Cyan', size: 0.6 } },
      tris: HOUSE_TRIS.body.shape_dome });

  /* -- pets and accessories -- */
  def('pet_kitten', 'pet', 0.55,
    { body: 'PETCOL.pet_kitten.body', dark: 'PETCOL.pet_kitten.dark', light: 'PETCOL.pet_kitten.light', nose: 'PETCOL.pet_kitten.nose',
      inner: 'PETCOL.pet_kitten.light', whisker: 'Ink', eye: 'Midnight Ink', glint: 'Cloud White', blush: 'Blush', mouth: 'Midnight Ink' },
    { pivots: PET_SOCKETS, bones: PET_BONES, idle: { type: 'actor' }, hit: [0.8, 0.8, 0.8], tris: BUDGET.pet });
  def('pet_bunny', 'pet', 0.55,
    { body: 'PETCOL.pet_bunny.body', dark: 'PETCOL.pet_bunny.dark', light: 'PETCOL.pet_bunny.light', nose: 'PETCOL.pet_bunny.nose',
      inner: 'Bunny Ear', tail: 'Cloud White', eye: 'Midnight Ink', glint: 'Cloud White', blush: 'Blush', mouth: 'Midnight Ink' },
    { pivots: PET_SOCKETS, bones: PET_BONES, idle: { type: 'actor' }, hit: [0.8, 0.8, 0.8], tris: BUDGET.pet });
  def('pet_dragon', 'pet', 0.65,
    { body: 'PETCOL.pet_dragon.body', dark: 'PETCOL.pet_dragon.dark', light: 'PETCOL.pet_dragon.light', nose: 'PETCOL.pet_dragon.nose',
      spines: 'PETCOL.pet_dragon.dark', horns: 'Star Gold', wings: 'PETCOL.pet_dragon.light', eye: 'Midnight Ink', glint: 'Cloud White', blush: 'Blush', mouth: 'Midnight Ink' },
    { pivots: PET_SOCKETS, bones: PET_BONES, idle: { type: 'actor' }, hit: [0.8, 0.8, 0.8], tris: BUDGET.pet });
  def('acc_partyhat', 'acc', 0.16, { cone: 'Grape', stripe: 'Star Gold', pompom: 'Coral' }, { socket: 'hat', tris: BUDGET.acc });
  def('acc_crown', 'acc', 0.1, { band: 'Gold Base', gem: 'Rose Deep' },
    { socket: 'hat', mats: { band: 'gold' }, idle: { type: 'glint', n: 1, period: TEMPO.idle.crownGlint }, tris: BUDGET.acc });
  def('acc_bow', 'acc', 0.08, { bow: 'Rose Deep', spot: 'Cloud White', knot: 'Star Gold' }, { socket: 'neck', tris: BUDGET.acc });
  def('acc_scarf', 'acc', 0.08, { scarf: 'Splash Blue', stripe: 'Coral' }, { socket: 'neck', tris: BUDGET.acc });
  /* one wraparound shield lens; FOIL at night */
  def('acc_shades', 'acc', 0.05, { lens: 'Midnight Ink', frame: 'Midnight Ink', glint: 'Cloud White' }, { socket: 'face', show: { foil: ['lens'] }, tris: BUDGET.acc });
  def('acc_cape', 'acc', 0.3, { cape: 'Cape Red', clasp: 'Gunmetal' },
    { socket: 'back', mats: { clasp: 'gunmetal' }, perCopy: ['cloth'], idle: { type: 'cloth', amp: 0.06 }, tris: BUDGET.acc });
  /* streetwear (fixed tokens so photocards stay stable) */
  def('acc_beanie', 'acc', 0.1, { knit: 'Concrete Light', rib: 'Graphite', cuff: 'Concrete Light', tag: 'Laser Lime' },
    { socket: 'hat', mats: { tag: 'neon:Laser Lime' }, tris: BUDGET.acc });
  def('acc_cap', 'acc', 0.06, { crown: 'Graphite', brim: 'Graphite', under: 'Graphite', underOn: 'Neon Magenta' },
    { socket: 'hat', mats: { under: 'state' }, show: { neon: ['Neon Magenta'] }, tris: BUDGET.acc });
  def('acc_headphones', 'acc', 0.08, { band: 'Graphite', cup: 'Gunmetal', ring: 'LED Cyan' },
    { socket: 'neck', mats: { ring: 'state' }, show: { pulse: { on: 'beat', hz: SHOW_BEAT_HZ, pct: 20 }, neon: ['LED Cyan'] }, tris: BUDGET.acc });
  def('acc_visor', 'acc', 0.04, { band: 'Smoked Glass', line: 'LED Cyan', dot: 'Bone White' },
    { socket: 'face', mats: { band: 'smoked', line: 'neon:LED Cyan' }, show: { scan: { hz: 1 } }, tris: BUDGET.acc });
  def('acc_hoodie', 'acc', 0.3, { body: 'Graphite', hood: 'Graphite', string: 'Neon Magenta' },
    { socket: 'back', mats: { string: 'neon:Neon Magenta' }, tris: BUDGET.acc });

  /* -- land: drawn by env.js (h = the highest surface: Meadow Hill rises to 0.45) -- */
  def('land_cove', 'land', 0,
    { top: 'Dune', side: 'Wet Dune', tide: 'Wet Dune', shell: 'Blossom Light', starfish: 'Peach Coral', locked: 'Sandbar', edge: 'Neon Cyan' }, { tris: 2000 });
  def('land_meadow', 'land', 0.45,
    { top: 'Hill Moss', side: 'Cliff Rock', w1: 'Cloud White', w2: 'Tulip Yellow', w3: 'Tulip Pink', locked: 'Sandbar', edge: 'Neon Cyan' }, { tris: 2000 });

  /* -- attractions -- */
  def('att_pitch', 'attraction', 0.4,
    { grass: 'STADIA.$stadium.1', sky: 'STADIA.$stadium.0', line: 'Cloud White', post: 'Cloud White', net: 'Cloud White', stand: 'Pebble',
      ball: 'BALLS.$ball.0', ballPatch: 'BALLS.$ball.1', fanA: 'Crowd Shadow', fanB: 'Crowd Shadow 2', fanC: 'Crowd Shadow 3', fanD: 'Graphite', wand: 'Cloud White' },
    { pivots: ['ball', 'crowd'], anchors: ['top', 'spot'], actPivot: 'ball', show: { neon: NEON4, wands: true }, tris: BUDGET.attraction, crowdTris: BUDGET.crowd });
  def('att_kart', 'attraction', 1.4,
    { garage: 'Graphite', door: 'Roller Door', slat: 'Door Slat', checkA: 'Midnight Ink', checkB: 'Cloud White', sign: 'Laser Lime', tyre: 'Ink', kart: 'KARTS.$kart' },
    { pivots: ['kart'], anchors: ['top', 'spot'], actPivot: 'kart', mats: { sign: 'neon:Laser Lime' }, show: { neon: ['Laser Lime'] }, tris: BUDGET.attraction });

  /* -- city buildings (CATALOG kind 'fun', cat 'city'): no hull, never jittered; ≤ 4 meshes and
     ≤ 4 materials each; 3 trims by variantOf(uid, id) (BUILDING_TRIMS: 'accent' resolves per trim).
     Static shells cast into the static shadow map; moving bits use blob shadows. -- */
  def('bld_photobooth', 'building', 1.6,
    { body: 'Night Asphalt', panel: 'Graphite', accent: '@member', curtain: 'Primary Pink', rod: 'Gunmetal', bezel: 'Gunmetal',
      lens: 'Smoked Glass', bulb: 'Gunmetal Mid', bulbOn: 'Window Warm', slot: 'Midnight Ink', kick: 'Gunmetal',
      sign: 'Neon Magenta', signText: 'Bone White', star: 'Star Gold', strip: 'Bone White' },
    { pivots: ['flash', 'strip'], anchors: ['top', 'spot', 'strip'], actPivot: 'flash', perCopy: ['cloth'],
      mats: { lens: 'smoked', bulb: 'state', sign: 'sign' }, idle: { type: 'cloth', amp: 0.02 },
      show: { neon: ['Neon Magenta'], chase: { hz: 0.5, groups: 2, bulbs: 8 }, halo: { token: 'Window Warm', size: 0.3 }, windowGlow: { token: 'Window Warm' } },
      tris: 900 });
  def('bld_boba', 'building', 1.95,
    { body: 'Concrete', band: 'Bone White', accent: '@member', glass: 'Smoked Glass', glassGlow: 'Window Warm', counter: 'Teak',
      cup: 'Bone White', liquid: 'Milk Tea', pearl: 'Midnight Ink', straw: '@member', lid: 'Bone White',
      awning: 'Bone White', awningEdge: 'Neon Magenta', table: 'Teak', stool: 'Gunmetal' },
    { pivots: ['hatch', 'pearls', 'cup'], anchors: ['top', 'spot', 'seat'], actPivot: 'hatch',
      mats: { glass: 'state', cup: 'pearl', awningEdge: 'neon:Neon Magenta' },
      idle: { type: 'bob', pct: 2, period: TEMPO.idle.flowerBob, pivot: 'pearls' },
      show: { neon: ['Neon Magenta'], halo: { token: 'Neon Magenta', size: 0.7 }, windowGlow: { token: 'Window Warm' } },
      tris: 1300 });
  def('bld_ledtower', 'building', 2.5,
    { plinth: 'Concrete', leg: 'Gunmetal', brace: 'Gunmetal Mid', ladder: 'Gunmetal Mid', bezel: 'Graphite', screen: 'Bone White',
      cap: 'Gunmetal', antenna: 'Gunmetal', beacon: 'Neon Magenta', accent: '@member' },
    { pivots: ['screen', 'beacon'], anchors: ['top', 'spot'], actPivot: 'screen', mats: { screen: 'led', beacon: 'state' },
      idle: { type: 'breathe', hz: 0.5, min: 0.6, pivot: 'beacon' }, loops: [{ type: 'scroll', speed: 0.125, pivot: 'screen' }],
      show: { halo: { token: 'Electric Violet', size: 1.1 }, screen: { autoBars: 8, dayLevel: 0.7, photocard: 'stars' } },
      tris: 900 });
  def('bld_recording', 'building', 1.85,
    { body: 'Graphite', plinth: 'Concrete', accent: '@member', foam: 'Night Asphalt', door: 'Gunmetal', sign: 'Neon Magenta',
      signOff: 'Gunmetal Mid', porthole: 'Gunmetal', glass: 'Smoked Glass', glassGlow: 'Window Warm', mic: 'Gunmetal Spec',
      meterLo: 'Laser Lime', meterHi: 'Neon Magenta', band: 'Gunmetal', cup: 'Graphite', ring: 'Electric Violet' },
    { pivots: ['meter', 'mic', 'phones'], anchors: ['top', 'spot'], actPivot: 'meter',
      mats: { sign: 'sign', glass: 'state', ring: 'neon:Electric Violet', meter: 'state' },
      show: { neon: ['Electric Violet', 'LED Cyan'], halo: { token: 'Electric Violet', size: 0.4 }, windowGlow: { token: 'Window Warm' } },
      tris: 1600 });
  def('bld_dance', 'building', 2.25,
    { body: 'Concrete', upper: 'Concrete Light', frame: 'Bone White', glass: 'Smoked Glass', mirror: 'Chrome', floor: 'Bone White',
      fin: '@member', accent: '@member', sign: 'Neon Magenta', speaker: 'Graphite', cone: 'Gunmetal', glow: 'Holo Pink' },
    /* the sign is the sneaker-and-motion-lines pictogram in 'state' neon, keeping 4 materials */
    { pivots: ['floor', 'speaker'], anchors: ['top', 'spot'], actPivot: 'floor',
      mats: { glass: 'smoked', mirror: 'chrome', floor: 'state', sign: 'state' },
      show: { neon: NEON4, chase: { on: 'beat', hz: SHOW_BEAT_HZ, groups: 4, tiles: 6, tokens: NEON4 },
              halo: { token: 'Neon Magenta', size: 0.9 }, windowGlow: { token: 'Holo Pink' } },
      tris: 2600 });
  def('bld_rooftop', 'building', 2.3,
    { body: 'Chimney', course: 'Chimney Cap', lintel: 'Concrete Light', glass: 'Smoked Glass', glassGlow: 'Window Warm', frame: 'Gunmetal',
      door: 'Gunmetal Mid', stair: 'Gunmetal', deck: 'Teak', rail: 'Smoked Glass', beanA: 'Grape', beanB: 'Splash Blue', accent: '@member',
      bulb: 'Gunmetal Mid', bulbOn: 'Sunset Amber', scope: 'Gunmetal', palm: 'Leaf Deep', pot: 'Concrete', star: 'Star Gold' },
    { pivots: ['deck', 'scope', 'bulbs'], anchors: ['top', 'spot', 'roof'], actPivot: 'deck',
      mats: { glass: 'state', rail: 'smoked', bulb: 'state' },
      show: { halo: { token: 'Sunset Amber', size: 0.25 }, windowGlow: { token: 'Window Warm' },
              decal: { token: 'Electric Violet', r: FX.uplight.r, opacity: FX.uplight.show } },
      tris: 2700 });
  def('bld_stage', 'building', 2.45,
    { deck: 'Night Asphalt', edge: 'LED Cyan', step: 'Graphite', wall: 'Bone White', bezel: 'Midnight Ink', truss: 'Gunmetal',
      head: 'Graphite', lens: 'Bone White', speaker: 'Graphite', cone: 'Gunmetal', foot: 'Gunmetal Mid', footOn: 'Window Warm', accent: '@member' },
    { pivots: ['lights', 'head0', 'head1', 'head2', 'head3', 'crowd'], anchors: ['top', 'spot', 'cone0', 'cone1', 'cone2'], actPivot: 'lights',
      mats: { edge: 'neon:LED Cyan', wall: 'led', foot: 'state' },
      idle: { type: 'scroll', speed: 0.05, pivot: 'lights' },
      show: { neon: ['LED Cyan'], chase: { on: 'beat', hz: SHOW_BEAT_HZ, groups: 4, bulbs: 8 },
              beams: { alpha: 0.18, tokens: NEON4, hz: TEMPO.idle.coneHz }, halo: { token: 'Window Warm', size: 0.4 } },
      tris: BUDGET.attraction, crowdTris: 600 });

  /* -- course variants (dressing on the gate) -- */
  def('course_beach', 'variant', 1.9, { plate: 'THEME.course_beach.0', banner: 'THEME.course_beach.1', crab: 'Coral', shell: 'Blossom Light' },
    { slot: 'course', base: 'att_course', tris: 600 });
  def('course_snow', 'variant', 1.9, { plate: 'THEME.course_snow.0', banner: 'THEME.course_snow.1', snow: 'Snow', hat: 'Ink', carrot: 'Carrot' },
    { slot: 'course', base: 'att_course', tris: 600 });
  def('course_candy', 'variant', 1.9,
    { plate: 'THEME.course_candy.0', banner: 'THEME.course_candy.1', stick: 'Cloud White', lolly: 'Tulip Pink', gumA: 'Grape', gumB: 'Leaf Mint', gumC: 'Star Gold' },
    { slot: 'course', base: 'att_course', tris: 600 });

  /* -- penalty cosmetics (ball r 0.11; stadium = the pitch's dressing) -- */
  def('ball_classic', 'cosmetic', 0.22, { body: 'BALLS.ball_classic.0', patch: 'BALLS.ball_classic.1', trail: 'BALLS.ball_classic.1' }, { slot: 'ball', base: 'ball', tris: BUDGET.ball });
  def('ball_rainbow', 'cosmetic', 0.22,
    { body: 'BALLS.ball_rainbow.0', trail: 'BALLS.ball_rainbow.1', b1: 'Coral', b2: 'Rainbow Orange', b3: 'Star Gold', b4: 'Leaf Mint', b5: 'Splash Blue', b6: 'Grape' },
    { slot: 'ball', base: 'ball', tris: BUDGET.ball });
  def('ball_planet', 'cosmetic', 0.22, { body: 'BALLS.ball_planet.0', ring: 'BALLS.ball_planet.1', trail: 'BALLS.ball_planet.1' }, { slot: 'ball', base: 'ball', tris: BUDGET.ball });
  def('ball_gold', 'cosmetic', 0.22, { body: 'BALLS.ball_gold.0', accent: 'BALLS.ball_gold.1', trail: 'BALLS.ball_gold.1' },
    { slot: 'ball', base: 'ball', mats: { body: 'gold' }, tris: BUDGET.ball });
  def('stadium_day', 'cosmetic', 0.4, { sky: 'STADIA.stadium_day.0', grass: 'STADIA.stadium_day.1' }, { slot: 'stadium', base: 'att_pitch', tris: 1200 });
  def('stadium_night', 'cosmetic', 0.4, { sky: 'STADIA.stadium_night.0', grass: 'STADIA.stadium_night.1', flood: 'Lamp Halo', pole: 'Pole' },
    { slot: 'stadium', base: 'att_pitch', tris: 1200 });
  def('stadium_beach', 'cosmetic', 0.4, { sky: 'STADIA.stadium_beach.0', grass: 'STADIA.stadium_beach.1', sand: 'Sand', palm: 'Frond', trunk: 'Palm Bark', sea: 'Sea Shallow' },
    { slot: 'stadium', base: 'att_pitch', tris: 1200 });
  def('stadium_snow', 'cosmetic', 0.4, { sky: 'STADIA.stadium_snow.0', grass: 'STADIA.stadium_snow.1', snow: 'Snow' }, { slot: 'stadium', base: 'att_pitch', tris: 1200 });

  /* -- kart cosmetics (0.9 u long, LOCKED body, neon under-glow) and tracks -- */
  function kart(id, glow, extra, mats) {
    var c = { body: 'KARTS.' + id, wheel: 'Ink', hub: 'Pebble', trim: 'Chrome', glow: glow };
    for (var k in extra) c[k] = extra[k];
    var m = { trim: 'chrome', glow: 'neon:' + glow };
    for (var j in (mats || {})) m[j] = mats[j];
    def(id, 'cosmetic', 0.4, c, { slot: 'kart', base: 'kart', pivots: ['seat'], mats: m, show: { neon: [glow] }, tris: BUDGET.kart });
  }
  kart('kart_red', 'Neon Pink', {});
  kart('kart_blue', 'Neon Cyan', { stripe: 'Cloud White', fin: 'Cloud White' });
  kart('kart_lime', 'Neon Lime', { bolt: 'Star Gold' });
  kart('kart_unicorn', 'Neon Pink', { horn: 'Gold Base', m1: 'Coral', m2: 'Rainbow Orange', m3: 'Star Gold', m4: 'Leaf Mint', m5: 'Splash Blue', m6: 'Grape' }, { horn: 'gold' });
  kart('kart_gold', 'Star Gold', { star: 'Star Gold' }, { body: 'gold' });
  var trackBase = { asphalt: 'Asphalt', line: 'Cloud White', kerbA: 'Coral', kerbB: 'Cloud White' };
  function track(id, extra) {
    var c = { grass: 'TRACKS.' + id + '.grass' }, k;
    for (k in trackBase) c[k] = trackBase[k];
    for (k in extra) c[k] = extra[k];
    def(id, 'variant', 0.6, c, { slot: 'track', base: 'track', instancing: 'scene', tris: 2000 });
  }
  track('track_loop', { palm: 'Frond', trunk: 'Palm Bark', sea: 'Sea Shallow' });
  track('track_volcano', { cone: 'Volcano Rock', lava: 'Peach Coral', smoke: 'Iridescent Rim', skyA: 'Sunset Peach', skyB: 'Dusk Violet' });
  track('track_beach', { sea: 'Sea Shallow', hutA: 'Coral', hutB: 'Cloud White', umbrella: 'Splash Blue' });

  /* ---------------- v3: the five sky lands (catalogAdditions.lookEntries) ----------------
     136 ids after the 104 V4.54 ones, in CATALOG order: first the 30 of wave 1 (each land: land,
     landmark, its 4 themed items), then the 106 land-shop ids of wave 1b (each land: its new themed
     items in shelf order, its two mascots, its four pieces of gear). h, tris, pivots, anchors,
     actPivot and idle are the lookEntries' (binding names for models, motion and pets-brain,
     D57); hit = fp × max(h, 0.8) as every placed item. colors = {main} (placeholder crates and the
     generic 2D block) + the parts sky-world and the land-shops art notes name. Extra fields:
       act / perform   the CATALOG act (null when none) and the a.pets.perform kind (null: no pet):
                       a named kind, or 'seat:<clip>' / 'trail:<clip>' / 'stand:<clip>' (D91)
       performAt       the anchor a seat / stand perform uses ('seat', else 'spot', when absent)
       trail           the ordered anchors a trail perform (or a climb-and-slide) visits
       pivotParents    {child: parent}; levelPivots are counter-rotated to hang level (gondolas)
       anchorPivots    {anchor: pivot}: the anchor rides that pivot (K8)
       states          {key: {off, on}}: glow parts' stateColor (D51); act-time breathing in Hz.
                       A glow part may add when ('night'), or tokens + driftHz (the colours it
                       drifts through at steady brightness); {tokens, dim} = panes that glow in
                       their own colours (off = each colour dimmed). A part the act grows or shows
                       with no colour change is {steps, when: 'act' | 'lit'} (never glow)
       copy            {key: {n, token, …}}: per-copy glow parts (bulbs) and their act / night rates
       toggle          {state: 'lit', on}: the act toggles lit memory (doors open, bridge down)
       variants        = VARIANTS[id]; variantTokens = each colourway's main token (D57, D101)
       display + isle  land ids: the icon / land sheet is SL3D.vox.isleDiorama(isle)
       pieces / joins  path tiles (pathPiece) / castle_wall (N1 E2 S4 W8 join mask)
       trisLow         the cap at tier LOW (D71, D89, D106); trisBare = a mascot's undressed cap
     idle / loops 'tiers' lists where they run (LOW keeps those still). Act-time rates live in
     states / copy, never in idle, and read ART3.FREQS. */
  var V3_IDS = [], V3_SET = {};
  function def3(id, kind, h, colors, o) {
    V3_IDS.push(id);
    V3_SET[id] = 1;
    o.act = o.act === undefined ? null : o.act;
    o.perform = o.perform === undefined ? null : o.perform;
    /* every placed item carries 'top' for labels and emotes (the lookEntries list for ice_rink
       omits it) */
    if (PLACED_KINDS[kind] && o.anchors && o.anchors.indexOf('top') < 0) o.anchors = ['top'].concat(o.anchors);
    def(id, kind, h, colors, o);
  }
  function names(prefix, n) { var o = []; for (var i = 0; i < n; i++) o.push(prefix + i); return o; }
  function under(parent, kids) { var o = {}; kids.forEach(function (k) { o[k] = parent; }); return o; }
  var MIDHIGH = ['MID', 'HIGH'];
  var GONDOLAS = names('g', 8), MOUNTS = names('m', 6), PLANKS = names('p', 6), RIBBONS = names('r', 6), FLAGS4 = names('flag', 4);
  function land(id, isle, main) { def3(id, 'land', 0, { main: main }, { tris: 0, display: 'isleDiorama', isle: isle }); }
  function pathTile(id, main, second) { def3(id, 'path', 0.06, { main: main, second: second }, { pieces: true, tris: 100 }); }
  var swayRad = function (rad, hz, pivot) { return { type: 'sway', deg: rad * 180 / Math.PI, period: 1 / hz, pivot: pivot }; };

  /* -- Theme Park Pier -- */
  land('land_pier', 'pier', 'PX Pier Sand');
  def3('lm_pier_wheel', 'isleLandmark', 5, { main: 'PX Pier Stripe Blue', rim: 'Cloud White', spokeA: 'PX Coral', spokeB: 'PX Sunny' },
    { pivots: ['wheel'].concat(GONDOLAS), pivotParents: under('wheel', GONDOLAS), levelPivots: GONDOLAS,
      anchors: ['top', 'door', 'spot', 'seat'], anchorPivots: { seat: 'g0' }, actPivot: 'wheel', act: 'wheel', perform: 'wheel',
      idle: { type: 'spin', rps: 0.02, pivot: 'wheel', tiers: MIDHIGH },
      copy: { bulbs: { n: 16, token: 'PX Bulb Warm', chase: { hz: FREQS.bulbChase, groups: 1, when: 'act' } } }, tris: 4000 });
  def3('pier_carousel', 'fun', 2, { main: 'PX Coral', stripe: 'PX Pier Stripe Blue' },
    { pivots: ['spin'].concat(MOUNTS), pivotParents: under('spin', MOUNTS), anchors: ['top', 'spot', 'seat'], anchorPivots: { seat: 'm2' },
      actPivot: 'spin', act: 'ride', perform: 'ride',
      copy: { bulbs: { n: 12, token: 'PX Bulb Warm', breatheHz: FREQS.breathe, when: 'night' } }, trisLow: 1300, tris: 2000 });
  def3('pier_helter', 'fun', 2.9, { main: 'PX Coral', slide: 'PX Sunny', roof: 'PX Lilac' },
    { pivots: [], anchors: ['top', 'spot'].concat(names('s', 8), ['foot']), act: 'slide', perform: 'slide', trisLow: 1100, tris: 1800 });
  def3('pier_beachhut', 'decor', 0.9, { main: 'PX Pier Stripe Blue', trim: 'Cloud White' },
    { pivots: ['doorL', 'doorR'], anchors: ['top'], actPivot: 'doorL', act: 'open', variants: VARIANTS.pier_beachhut,
      variantTokens: ['PX Pier Stripe Blue', 'PX Coral', 'PX Mint', 'PX Sunny'], toggle: { state: 'lit', on: 'doorsOpen' }, trisLow: 220, tris: 600 });
  pathTile('path_pier', 'PX Pier Deck', 'PX Pier Deck 2');             /* the pier's own deck (crisp C4) */

  /* -- Jungle Treehouse Village -- */
  land('land_jungle', 'jungle', 'PX Jungle Canopy');
  def3('lm_jungle_treehouse', 'isleLandmark', 5.5, { main: 'PX Jungle Canopy', bark: 'PX Jungle Bark', thatch: 'PX Jungle Thatch' },
    { pivots: ['lift', 'crown'], anchors: ['top', 'door', 'spot', 'seat', 'deck0', 'deck1', 'deck2'], anchorPivots: { seat: 'lift' },
      actPivot: 'lift', act: 'lift', perform: 'lift',
      idle: Object.assign(swayRad(0.02, 0.15, 'crown'), { tiers: MIDHIGH }),
      loops: [{ type: 'pendulum', deg: 3, period: TEMPO.idle.swingIdle, pivot: 'lift', tiers: MIDHIGH }],
      states: { lamps: { off: 'PX Lamp Off', on: 'PX Lamp Warm', breatheHz: FREQS.breathe } }, tris: 4000 });
  def3('jungle_stilthut', 'decor', 1.4, { main: 'PX Jungle Thatch', stilt: 'PX Jungle Bark' },
    { pivots: ['glow'], anchors: ['top'], actPivot: 'glow', act: 'glow', variants: VARIANTS.jungle_stilthut,
      variantTokens: ['PX Jungle Thatch', 'PX Jungle Canopy', 'PX Jungle Flower Pink'],
      states: { lit: { off: 'PX Lamp Off', on: 'PX Lamp Warm' } }, trisLow: 220, tris: 600 });
  def3('jungle_vineswing', 'fun', 1.8, { main: 'PX Jungle Bark', vine: 'PX Jungle Canopy' },
    { pivots: ['swing'], anchors: ['top', 'seat'], anchorPivots: { seat: 'swing' }, actPivot: 'swing', act: 'swing', perform: 'vine', trisLow: 800, tris: 1200 });
  def3('jungle_falls', 'fun', 1.5, { main: 'PX Jungle Moss Stone', water: 'PX Jungle Water 1' },
    { pivots: ['water'], anchors: ['top', 'spot', 'pool'], actPivot: 'water', act: 'splash', perform: 'paddle',
      idle: { type: 'drip', fx: 'drop', drops: { LOW: 0, MID: 20, HIGH: 40 }, pivot: 'water' }, trisLow: 1100, tris: 1800 });
  pathTile('path_logs', 'PX Jungle Bark Light', 'PX Jungle Bark');

  /* -- Treetop Adventure Park -- */
  land('land_treetop', 'treetop', 'PX Tree Pine Mid');
  def3('lm_treetop_lookout', 'isleLandmark', 5.5, { main: 'PX Tree Pine', frame: 'PX Tree Bark', deck: 'PX Tree Plank', flag: 'PX Tree Flag' },
    { pivots: ['zip', 'flag'], anchors: ['top', 'door', 'spot', 'nest', 'landing', 'zipStart'], anchorPivots: { zipStart: 'zip' },
      actPivot: 'zip', act: 'zip', perform: 'zip', idle: { type: 'flutter', amp: 0.04, hz: FREQS.flagFlutter, pivot: 'flag' }, tris: 4000 });
  def3('treetop_bridge', 'fun', 1.2, { main: 'PX Tree Rope', net: 'PX Tree Net', plank: 'PX Tree Plank' },
    { pivots: PLANKS, anchors: ['top', 'postL', 'postR'], actPivot: 'p0', act: 'wobble', perform: 'wobble', trisLow: 800, tris: 1200 });
  def3('treetop_net', 'fun', 1.6, { main: 'PX Tree Net', trunk: 'PX Tree Bark' },
    { pivots: ['net'], anchors: ['top', 'seat'], anchorPivots: { seat: 'net' }, actPivot: 'net', act: 'bounce', perform: 'bounce', trisLow: 900, tris: 1500 });
  /* LOOK kind 'tree': organic (jitterVox), with its own LOW cap; the pet hops up to the deck (D86) */
  def3('treetop_platform', 'tree', 2.9, { main: 'PX Tree Pine Mid', deck: 'PX Tree Plank' },
    { pivots: ['sway'], anchors: ['top', 'deck'], act: 'climb', perform: 'trail:hop', trail: ['deck'], idle: swayRad(0.03, 0.15, 'sway'),
      variants: VARIANTS.treetop_platform, variantTokens: ['PX Tree Pine Mid', 'PX Tree Oak'], trisLow: 350, tris: 700 });
  pathTile('path_bark', 'PX Tree Chip', 'PX Tree Chip 2');

  /* -- Medieval Castle -- */
  land('land_castle', 'castle', 'PX Castle Stone');
  def3('lm_castle_keep', 'isleLandmark', 4.5, { main: 'PX Castle Stone', trim: 'PX Castle Sandstone', banner: 'PX Castle Banner', bridge: 'PX Castle Wood' },
    { pivots: ['bridge', 'banners'].concat(FLAGS4), anchors: ['top', 'door', 'spot', 'gate'], actPivot: 'bridge', act: 'drawbridge', perform: 'cross',
      idle: { type: 'flutter', amp: 0.04, hz: FREQS.flagFlutter, pivots: FLAGS4 }, toggle: { state: 'lit', on: 'bridgeDown' }, tris: 4000 });
  def3('castle_wall', 'decor', 1, { main: 'PX Castle Stone', second: 'PX Castle Stone 2' },
    { joins: true, act: 'knock', variants: VARIANTS.castle_wall, trisLow: 160, tris: 320 });   /* 'knock': sound and fx only (D86) */
  def3('castle_maypole', 'fun', 2.5, { main: 'PX Castle Pennant', pole: 'Cloud White', crown: 'PX Castle Gold' },
    { pivots: ['ribbons'].concat(RIBBONS), pivotParents: under('ribbons', RIBBONS), anchors: ['top', 'ring0', 'ring1', 'ring2'],
      actPivot: 'ribbons', act: 'dance', perform: 'maypole', trisLow: 800, tris: 1200 });
  def3('castle_feast', 'fun', 0.9, { main: 'PX Castle Wood', cloth: 'PX Castle Pennant' },
    { pivots: ['dishes'], anchors: ['top', 'seat'], actPivot: 'dishes', act: 'serve', perform: 'feast', trisLow: 1100, tris: 1800 });
  pathTile('path_cobble', 'PX Castle Cobble', 'PX Castle Cobble 2');      /* the courtyard cobble, darker than the walls (crisp C4) */

  /* -- Penguin Ice Village -- */
  land('land_ice', 'ice', 'PX Ice Snow');
  def3('lm_ice_igloo', 'isleLandmark', 4.0, { main: 'PX Ice Snow', ice: 'PX Ice', glow: 'PX Ice Hut Glow' },
    { pivots: ['pen0', 'pen1', 'pen2'], anchors: ['top', 'door', 'spot', 'rampTop', 'rampFoot'], actPivot: 'pen0', act: 'penguins',
      idle: { type: 'emit', every: 5, n: 3, fx: 'wisp', tiers: MIDHIGH }, tris: 3000 });
  def3('ice_snowhut', 'decor', 0.8, { main: 'PX Ice Snow', shade: 'PX Ice Snow Shade' },
    { pivots: ['glow'], anchors: ['top'], actPivot: 'glow', act: 'glow', variants: VARIANTS.ice_snowhut,
      states: { lit: { off: 'PX Lamp Off', on: 'PX Ice Hut Glow' } }, trisLow: 220, tris: 600 });
  def3('ice_slide', 'fun', 1.5, { main: 'PX Ice', step: 'PX Ice Snow 2' },
    { pivots: [], anchors: ['top', 'foot'], act: 'slide', perform: 'slide', trisLow: 800, tris: 1200 });
  def3('ice_rink', 'fun', 0.9, { main: 'PX Ice 2', bank: 'PX Ice Snow' },
    { pivots: [], anchors: ['spot'].concat(names('lap', 8)), act: 'skate', perform: 'skate', trisLow: 1100, tris: 1800 });
  pathTile('path_ice', 'PX Ice 2', 'PX Ice Snow');

  /* ---------------- v3 land shops (wave 1b): catalogAdditions.lookEntries 31–136 ----------------
     Each land in CATALOG order: its new themed items (shelf order), its two mascots, its four
     pieces of gear (D85, D92). Themed items as above; one act key is one behaviour everywhere
     (D86), so a remembered toggle carries toggle and a lamp its glow state. Mascots are LOOK kind
     'pet' (the V4.54 sockets and bones; colours from PETCOL3; tris = the dressed cap, trisBare the
     bare one, D108) and gear is kind 'acc' on its CATALOG slot's socket (tris = the piece's own
     cap inside SLOT_CAPS; h from the art notes' voxel sizes on the 0.05 u crew grid). */
  var PET_RIG3 = { bare: 750, dressed: 1400 };
  var SLOT_CAPS = { hat: 180, neck: 160, face: 140, back: 170 };
  var ACCENTS = seq('PX Accent', 5), AURORA = ['PX Aurora Mint', 'PX Aurora Sky', 'PX Aurora Violet'];
  var PANES = ['PX Castle Pennant', 'PX Castle Gold', 'PX Castle Teal', 'PX Castle Banner', 'PX Mint'];
  function accents(c) { ACCENTS.forEach(function (t, i) { c['a' + (i + 1)] = t; }); return c; }
  function lit(on) { return { state: 'lit', on: on }; }
  function glowTo(on) { return { off: 'PX Lamp Off', on: on }; }
  /* a pet's LOOK row: PETCOL3 colours + the shared eye ink and glint, the V4.54 sockets and bones,
     driven by the actors; the dressed cap, the bare one beside it (D108). The mascots and the kids
     update's fourteen (KU_IDS) share it. */
  function petColors(id) {
    var p = 'PETCOL3.' + id + '.';
    return { main: p + 'body', body: p + 'body', dark: p + 'dark', light: p + 'light', nose: p + 'nose', eye: 'PX Ink Eye', glint: 'PX Glint' };
  }
  function petRig(o) {
    o = o || {};
    o.pivots = PET_SOCKETS; o.bones = PET_BONES; o.idle = { type: 'actor' }; o.hit = [0.8, 0.8, 0.8]; o.tris = PET_RIG3.dressed; o.trisBare = PET_RIG3.bare;
    return o;
  }
  function mascot(id, h) { def3(id, 'pet', h, petColors(id), petRig()); }
  function gear(id, socket, h, tris, colors) { def3(id, 'acc', h, colors, { socket: socket, tris: tris }); }

  /* -- Theme Park Pier: 9 more rides, 3 snack carts, 3 seaside pieces, the crab and the seagull -- */
  def3('pier_mirrors', 'fun', 1.5, { main: 'PX Lilac', stripe: 'Cloud White', pelmet: 'PX Sunny', mat: 'PX Coral' },
    { pivots: [], anchors: ['top', 'spot'], act: 'mirrors', perform: 'pose', trisLow: 450, tris: 700 });
  def3('pier_droptower', 'fun', 2.9, { main: 'PX Coral', band: 'Cloud White', seat: 'PX Sunny', cap: 'PX Pier Stripe Blue' },
    { pivots: ['ring'], anchors: ['top', 'spot', 'seat'], anchorPivots: { seat: 'ring' }, actPivot: 'ring', act: 'droptower', perform: 'seat:ride',
      trisLow: 600, tris: 900 });
  def3('pier_teacups', 'fun', 1.2, { main: 'PX Candy Pink', floor: 'PX Mint', cupB: 'PX Sunny', cupC: 'PX Pier Stripe Blue', hub: 'PX Lilac' },
    { pivots: ['table'].concat(names('cup', 3)), pivotParents: under('table', names('cup', 3)), anchors: ['top', 'spot', 'seat'],
      anchorPivots: { seat: 'cup0' }, actPivot: 'table', act: 'teacups', perform: 'seat:ride', trisLow: 900, tris: 1500 });
  def3('pier_flyingchairs', 'fun', 2.8, { main: 'PX Candy Pink', column: 'PX Mint', tip: 'PX Sunny', bulb: 'PX Bulb Warm' },
    { pivots: ['canopy'].concat(names('c', 6)), pivotParents: under('canopy', names('c', 6)), anchors: ['top', 'spot', 'seat'],
      anchorPivots: { seat: 'c0' }, actPivot: 'canopy', act: 'chairs', perform: 'seat:ride', trisLow: 1000, tris: 1700 });
  def3('pier_swingship', 'fun', 2.6, { main: 'PX Coral', frame: 'PX Pier Stripe Blue', rail: 'Cloud White', sail: 'PX Sunny' },
    { pivots: ['swing'], anchors: ['top', 'spot', 'seat'], anchorPivots: { seat: 'swing' }, actPivot: 'swing', act: 'swingship',
      perform: 'seat:ride', trisLow: 900, tris: 1400 });
  def3('pier_train', 'fun', 1.4, { main: 'PX Pier Stripe Blue', hill: 'PX Mint', sleeper: 'PX Pier Pile', funnel: 'PX Sunny', carriage: 'PX Candy Pink' },
    { pivots: ['t0', 't1', 't2', 'signal'], anchors: ['top', 'spot'].concat(names('r', 12), ['seat']), anchorPivots: { seat: 't1' },
      actPivot: 't0', act: 'train', perform: 'seat:ride', trisLow: 1200, tris: 2000 });
  def3('pier_dodgems', 'fun', 1.6, { main: 'PX Lilac', check: 'Cloud White', rim: 'PX Coral', canopy: 'PX Sunny', pole: 'PX Bulb Warm' },
    { pivots: names('car', 4), anchors: ['top', 'spot', 'seat'], anchorPivots: { seat: 'car2' }, actPivot: 'car2', act: 'dodgems',
      perform: 'seat:drive', trisLow: 1100, tris: 1800 });
  /* its water stripes ripple on MID / HIGH only; the 'drop' spray belongs to the act */
  def3('pier_flume', 'fun', 2.4, { main: 'PX Mint', trough: 'Cloud White', water: 'PX Pier Stripe Blue', pool: 'PX Pier Water 1', log: 'PX Pier Pile' },
    { pivots: ['log'], anchors: ['top', 'spot'].concat(names('f', 12), ['seat']), anchorPivots: { seat: 'log' }, actPivot: 'log', act: 'flume',
      perform: 'seat:ride', idle: { type: 'ripple', period: 2.4, tiers: MIDHIGH }, trisLow: 1400, tris: 2400 });
  def3('pier_coaster', 'fun', 2.6, { main: 'PX Candy Pink', stilt: 'PX Pier Stripe Blue', station: 'PX Sunny', car: 'PX Coral' },
    { pivots: ['car'], anchors: ['top', 'spot'].concat(names('t', 16), ['seat']), anchorPivots: { seat: 'car' }, actPivot: 'car', act: 'coaster',
      perform: 'seat:ride', copy: { bulbs: { n: 10, token: 'PX Bulb Warm', breatheHz: FREQS.breathe } }, trisLow: 1500, tris: 2600 });
  def3('pier_candyfloss', 'decor', 1.2, { main: 'PX Candy Pink', stripe: 'Cloud White', wheel: 'PX Sunny', cloudB: 'PX Mint', cloudC: 'PX Lilac' },
    { pivots: ['drum'], anchors: ['top', 'seat'], actPivot: 'drum', act: 'floss', perform: 'stand:sit',
      states: { cloud: { steps: 3, when: 'act' } }, trisLow: 200, tris: 450 });
  def3('pier_popcorn', 'decor', 1.2, { main: 'PX Coral', stripe: 'Cloud White', wheel: 'PX Sunny', kernel: 'PX Cream' },
    { pivots: ['kernels'], anchors: ['top', 'seat'], actPivot: 'kernels', act: 'popcorn', perform: 'stand:sit',
      states: { bag: { steps: 1, when: 'act' } }, trisLow: 200, tris: 450 });
  def3('pier_icecream', 'decor', 1.4, { main: 'PX Candy Pink', stripe: 'Cloud White', scoop: 'PX Mint', cone: 'PX Waffle' },
    { pivots: ['hatch'], anchors: ['top', 'seat'], actPivot: 'hatch', act: 'scoop', perform: 'stand:sit', toggle: lit('hatchOpen'),
      trisLow: 200, tris: 450 });
  def3('pier_deckchair', 'decor', 0.7, { main: 'PX Coral', stripe: 'Cloud White', frame: 'PX Pier Plank', bucket: 'PX Sunny' },
    { pivots: ['sling'], anchors: ['top', 'seat'], actPivot: 'sling', act: 'lounge', perform: 'bench', variants: VARIANTS.pier_deckchair,
      variantTokens: ['PX Coral', 'PX Pier Stripe Blue', 'PX Mint', 'PX Sunny'], trisLow: 150, tris: 300 });
  def3('pier_balloons', 'decor', 1.7, { main: 'PX Coral', stand: 'PX Pier Stripe Blue', b2: 'PX Sunny', b3: 'PX Mint', b4: 'PX Candy Pink', b5: 'PX Lilac' },
    { pivots: ['lift', 'bunch'], anchors: ['top', 'grip'], anchorPivots: { grip: 'lift' }, actPivot: 'lift', act: 'liftoff',
      perform: 'seat:hang', performAt: 'grip', trisLow: 180, tris: 400 });
  def3('pier_lamppost', 'light', 1.6, { main: 'PX Pier Stripe Blue', stripe: 'Cloud White', p1: 'PX Coral', p2: 'PX Sunny', p3: 'PX Mint' },
    { pivots: ['tails'], anchors: ['top'], act: 'glow', states: { lit: glowTo('PX Bulb Warm') }, trisLow: 150, tris: 300 });
  mascot('pet_crab', 0.55);
  mascot('pet_gull', 0.6);
  gear('acc_pier_conehat', 'hat', 0.35, 150, { main: 'PX Candy Pink', cone: 'PX Waffle' });
  gear('acc_pier_ring', 'neck', 0.1, 160, { main: 'PX Coral', stripe: 'Cloud White', valve: 'PX Sunny' });
  gear('acc_pier_snorkel', 'face', 0.25, 140, { main: 'PX Sunny', strap: 'PX Mint', tube: 'PX Coral' });
  gear('acc_pier_balloon', 'back', 0.65, 170, { main: 'PX Coral', shine: 'Cloud White' });

  /* -- Jungle Treehouse Village: rides and play, stalls, village and ruins, trees and wildlife, the capybara and the monkey -- */
  def3('jungle_hammock', 'fun', 1.3, { main: 'PX Jungle Rope', stripeA: 'PX Jungle Flower Pink', stripeB: 'PX Jungle Parrot Blue', post: 'PX Jungle Bark Light' },
    { pivots: ['sling'], anchors: ['top', 'seat'], anchorPivots: { seat: 'sling' }, actPivot: 'sling', act: 'rock', perform: 'seat:sit', tris: 800 });
  def3('jungle_drums', 'fun', 1, { main: 'PX Jungle Bark', ring: 'PX Jungle Bark Light', skin: 'PX Cream', lace: 'PX Jungle Rope' },
    { pivots: names('d', 3), anchors: ['top', 'seat'], actPivot: 'd0', act: 'drum', perform: 'seat:sit', tris: 700 });
  def3('jungle_monkeybars', 'fun', 1.5, { main: 'PX Jungle Bark Light', lash: 'PX Jungle Rope', leaf: 'PX Jungle Canopy' },
    { pivots: [], anchors: ['top', 'start'].concat(names('r', 5), ['end']), act: 'bars', perform: 'trail:hang',
      trail: ['start'].concat(names('r', 5), ['end']), tris: 900 });
  def3('jungle_camp', 'fun', 1.4, { main: 'PX Jungle Canopy Deep', canvas: 'PX Cream', pole: 'PX Jungle Bark Light', brass: 'PX Sunny' },
    { pivots: ['flap', 'scope'], anchors: ['top', 'tent', 'scope', 'spot'], actPivot: 'flap', act: 'camp', perform: 'stand:lookBack',
      performAt: 'scope', trisLow: 900, tris: 1400 });
  /* climb the rope ladder, wave at the window, come down the bamboo slide: the 'slide' perform over trail */
  def3('jungle_den', 'fun', 2.6, { main: 'PX Jungle Thatch', shade: 'PX Jungle Thatch Shade', post: 'PX Jungle Bark', slide: 'PX Jungle Canopy Light', ladder: 'PX Jungle Rope' },
    { pivots: [], anchors: ['top', 'ladder', 'deck', 'window'].concat(names('s', 5), ['foot']), act: 'climb', perform: 'slide',
      trail: ['ladder', 'deck', 'window'].concat(names('s', 5), ['foot']), trisLow: 1100, tris: 1800 });
  def3('jungle_canoe', 'fun', 1.4, { main: 'PX Jungle Moss Stone', cap: 'PX Jungle Canopy Light', water: 'PX Jungle Water 1', deep: 'PX Jungle Water 2', hull: 'PX Jungle Bark' },
    { pivots: ['canoe', 'frog'], anchors: ['top', 'spot'].concat(names('c', 8), ['seat']), anchorPivots: { seat: 'canoe' }, actPivot: 'canoe',
      act: 'canoe', perform: 'seat:ride', idle: { type: 'bob', amp: 0.02, period: 1 / 0.3, pivot: 'canoe', tiers: MIDHIGH }, trisLow: 1100, tris: 1800 });
  def3('jungle_fruitstall', 'decor', 1.2, { main: 'PX Jungle Flower Orange', cart: 'PX Jungle Bark Light', banana: 'PX Banana', dragonfruit: 'PX Jungle Flower Pink' },
    { pivots: names('f', 3), anchors: ['top'], actPivot: 'f0', act: 'juggle', variants: VARIANTS.jungle_fruitstall,
      variantTokens: ['PX Jungle Canopy', 'PX Jungle Thatch'], trisLow: 200, tris: 450 });
  def3('jungle_market', 'decor', 1.3, { main: 'PX Jungle Thatch', shade: 'PX Jungle Thatch Shade', basket: 'PX Jungle Rope', blanket: 'PX Jungle Parrot Blue' },
    { pivots: ['shutter'], anchors: ['top'], actPivot: 'shutter', act: 'open', variants: VARIANTS.jungle_market,
      variantTokens: ['PX Jungle Thatch', 'PX Jungle Canopy', 'PX Jungle Flower Pink'], toggle: lit('shutterUp'), trisLow: 200, tris: 450 });
  def3('jungle_smoothie', 'fun', 1.5, { main: 'PX Jungle Canopy', roof: 'PX Jungle Canopy Light', counter: 'PX Jungle Bark Light', fruit: 'PX Banana' },
    { pivots: ['jar', 'dishes'], anchors: ['top', 'seat'], actPivot: 'dishes', act: 'serve', perform: 'feast', trisLow: 800, tris: 1200 });
  def3('jungle_lantern', 'light', 1.4, { main: 'PX Jungle Thatch', shade: 'PX Jungle Thatch Shade', pole: 'PX Jungle Bark Light' },
    { pivots: [], anchors: ['top'], act: 'glow', variants: VARIANTS.jungle_lantern, variantTokens: ['PX Jungle Thatch', 'PX Jungle Canopy'],
      states: { lit: glowTo('PX Lamp Warm') }, trisLow: 150, tris: 300 });
  /* six buds open while lit (in flower): plain colour, never glow */
  def3('jungle_arch', 'fun', 1.8, { main: 'PX Jungle Moss Stone', moss: 'PX Jungle Canopy Light', budA: 'PX Jungle Flower Pink', budB: 'PX Jungle Flower Orange' },
    { pivots: [], anchors: ['top', 'under', 'spot'], act: 'bloom', perform: 'stand:lookBack', performAt: 'under', toggle: lit('inFlower'),
      states: { blooms: { steps: 6, when: 'lit' } }, tris: 900 });
  def3('jungle_waterwheel', 'fun', 1.6, { main: 'PX Jungle Bark Light', lash: 'PX Jungle Rope', tub: 'PX Jungle Bark', water: 'PX Jungle Water 1', lily: 'PX Jungle Flower Pink' },
    { pivots: ['wheel', 'lily'], anchors: ['top', 'spot'], actPivot: 'wheel', act: 'spin',
      idle: { type: 'spin', rps: 0.05, pivot: 'wheel', tiers: MIDHIGH }, trisLow: 800, tris: 1200 });
  def3('jungle_parrot', 'decor', 1.5, { main: 'PX Jungle Parrot Red', wing: 'PX Jungle Parrot Blue', chest: 'PX Banana', post: 'PX Jungle Bark' },
    { pivots: ['bird', 'wings'], anchors: ['top'], actPivot: 'bird', act: 'chirp', variants: VARIANTS.jungle_parrot,
      variantTokens: ['PX Jungle Parrot Red', 'PX Jungle Parrot Blue'], trisLow: 180, tris: 400 });
  def3('jungle_banana', 'tree', 2.2, { main: 'PX Jungle Canopy Light', leaf: 'PX Jungle Canopy', stem: 'PX Jungle Canopy Deep', bunch: 'PX Banana', bud: 'PX Jungle Flower Pink' },
    { pivots: ['leaves', 'bunch'], anchors: ['top'], actPivot: 'leaves', act: 'wave', trisLow: 300, tris: 600 });
  def3('jungle_coconut', 'tree', 2.8, { main: 'PX Jungle Canopy', frond: 'PX Jungle Canopy Light', trunk: 'PX Jungle Bark', ring: 'PX Jungle Bark Light' },
    { pivots: ['crown', 'nut'], anchors: ['top'], actPivot: 'crown', act: 'coconut', trisLow: 300, tris: 600 });
  pathTile('path_bamboo', 'PX Jungle Bark Light', 'PX Jungle Thatch');
  mascot('pet_capybara', 0.5);
  mascot('pet_monkey', 0.65);
  gear('acc_jungle_garland', 'neck', 0.1, 110, { main: 'PX Jungle Flower Pink', second: 'PX Jungle Flower Orange', vine: 'PX Jungle Canopy Light' });
  gear('acc_jungle_hat', 'hat', 0.2, 130, { main: 'PX Khaki', shade: 'PX Khaki Shade', band: 'PX Jungle Canopy Deep', feather: 'PX Jungle Parrot Red' });
  gear('acc_jungle_butterfly', 'face', 0.05, 70, { main: 'PX Jungle Parrot Blue', body: 'PX Penguin Back', tip: 'Cloud White' });
  gear('acc_jungle_pack', 'back', 0.3, 170, { main: 'PX Khaki', flap: 'PX Jungle Canopy Deep', strap: 'PX Jungle Bark Light', map: 'PX Cream', banana: 'PX Banana' });

  /* -- Treetop Adventure Park: climbs, crossings and swings, woodland bits, the red squirrel and the owlet -- */
  def3('treetop_climbwall', 'fun', 2.8, accents({ main: 'PX Tree Plank', frame: 'PX Tree Bark', bell: 'PX Sunny' }),
    { pivots: ['bell'], anchors: ['top', 'foot', 'h1', 'h2', 'h3'], actPivot: 'bell', act: 'climb', perform: 'trail:hop',
      trail: ['foot', 'h1', 'h2', 'h3', 'top'], trisLow: 800, tris: 1200 });
  def3('treetop_telescope', 'fun', 2.9, { main: 'PX Tree Plank', peg: 'PX Tree Rope', roof: 'PX Tree Pine Mid', flag: 'PX Tree Flag', brass: 'PX Sunny', lens: 'PX Lens Pale' },
    { pivots: ['scope', 'pennant'], anchors: ['top', 'foot', 'pod'], actPivot: 'scope', act: 'spy', perform: 'trail:hop', trail: ['foot', 'pod'],
      trisLow: 800, tris: 1200 });
  def3('treetop_cargonet', 'fun', 2.2, { main: 'PX Tree Net', frame: 'PX Tree Bark', lash: 'PX Tree Rope', flag: 'PX Tree Flag' },
    { pivots: [], anchors: ['top', 'frontFoot', 'ridge', 'backFoot'], act: 'scramble', perform: 'trail:hop', trail: ['frontFoot', 'ridge', 'backFoot'],
      perCopy: ['net'], trisLow: 900, tris: 1500 });
  def3('treetop_leap', 'fun', 1.9, { main: 'PX Tree Autumn', stump: 'PX Tree Bark', deck: 'PX Tree Plank', leafB: 'PX Tree Toadstool', leafC: 'PX Tree Oak Light', flag: 'PX Tree Flag' },
    { pivots: ['pennant'], anchors: ['top'].concat(names('st', 4), ['deck', 'heap']), act: 'leap', perform: 'trail:jump',
      trail: names('st', 4).concat(['deck', 'heap']), perCopy: ['heap'], trisLow: 900, tris: 1500 });
  def3('treetop_bigslide', 'fun', 2.9, { main: 'PX Tree Pine', leaf: 'PX Tree Pine Light', deck: 'PX Tree Plank', slide: 'PX Sky Blue', pit: 'PX Tree Bark Trail' },
    { pivots: [], anchors: ['top', 'ladderFoot', 'deck'].concat(names('s', 6), ['pit']), act: 'slide', perform: 'slide', trisLow: 1100, tris: 1800 });
  def3('treetop_zipline', 'fun', 2.9, { main: 'PX Tree Bark', deck: 'PX Tree Plank', rope: 'PX Tree Rope', flag: 'PX Tree Flag' },
    { pivots: ['handle', 'pennant'], anchors: ['top', 'ladderFoot', 'deck', 'grip', 'landing'], anchorPivots: { grip: 'handle' }, actPivot: 'handle',
      act: 'zipline', perform: 'trail:hang', trail: ['ladderFoot', 'deck', 'grip', 'landing'], trisLow: 1100, tris: 1800 });
  def3('treetop_tunnel', 'fun', 1, { main: 'PX Tree Bark', ring: 'PX Tree Plank', ringLight: 'PX Tree Net', moss: 'PX Tree Moss', cap: 'PX Tree Toadstool' },
    { pivots: [], anchors: ['top', 'mouthA', 'knot', 'mouthB'], act: 'crawl', perform: 'trail:walk', trail: ['mouthA', 'knot', 'mouthB'],
      trisLow: 800, tris: 1200 });
  def3('treetop_beams', 'fun', 0.9, { main: 'PX Tree Bark', moss: 'PX Tree Moss', chip: 'PX Tree Bark Trail', flag: 'PX Tree Flag' },
    { pivots: ['beam1'], anchors: ['top', 'start'].concat(names('b', 3), ['end']), actPivot: 'beam1', act: 'balance', perform: 'trail:wobble',
      trail: ['start'].concat(names('b', 3), ['end']), trisLow: 800, tris: 1200 });
  def3('treetop_seesaw', 'fun', 0.9, { main: 'PX Tree Plank', stump: 'PX Tree Bark', padA: 'PX Tree Flag', padB: 'PX Sunny', pal: 'PX Tree Autumn' },
    { pivots: ['plank', 'pal'], anchors: ['top', 'seatA', 'seatB'], anchorPivots: { seatA: 'plank', seatB: 'plank' }, actPivot: 'plank',
      act: 'seesaw', perform: 'seat:sit', performAt: 'seatA', tris: 1000 });
  def3('treetop_tyreswing', 'fun', 2.4, { main: 'PX Tree Flag', stripe: 'Cloud White', post: 'PX Tree Bark', rope: 'PX Tree Rope' },
    { pivots: ['tyre'], anchors: ['top', 'seat'], anchorPivots: { seat: 'tyre' }, actPivot: 'tyre', act: 'swing', perform: 'vine', tris: 900 });
  def3('treetop_birdtable', 'decor', 1.3, { main: 'PX Tree Plank', post: 'PX Tree Bark', cap: 'PX Tree Moss', seed: 'PX Tree Autumn', bird: 'PX Tree Flag', chest: 'PX Tree Net' },
    { pivots: ['b0', 'b1'], anchors: ['top', 'tray'], actPivot: 'b0', act: 'feed', trisLow: 220, tris: 500 });
  def3('treetop_picnic', 'decor', 1, { main: 'PX Tree Plank', cloth: 'PX Tree Toadstool', check: 'Cloud White', basket: 'PX Tree Rope' },
    { pivots: ['lid', 'dishes'], anchors: ['top', 'seat'], actPivot: 'dishes', act: 'serve', perform: 'feast', trisLow: 200, tris: 450 });
  def3('treetop_xylophone', 'decor', 0.8, accents({ main: 'PX Tree Plank', trestle: 'PX Tree Bark', rail: 'PX Tree Rope', beater: 'PX Tree Toadstool' }),
    { pivots: names('k', 5), anchors: ['top', 'spot'], actPivot: 'k0', act: 'chime', perform: 'stand:beatNod', trisLow: 200, tris: 450 });
  def3('treetop_pod', 'decor', 2.6, { main: 'PX Tree Plank', trunk: 'PX Tree Bark', cap: 'PX Tree Pine Mid', ladder: 'PX Tree Rope', pal: 'PX Tree Autumn' },
    { pivots: ['hatch', 'pal'], anchors: ['top'], actPivot: 'hatch', act: 'peek', variants: VARIANTS.treetop_pod,
      variantTokens: ['PX Tree Pine Mid', 'PX Tree Oak'], toggle: lit('hatchOpen'),
      states: { lamp: { off: 'PX Lamp Off', on: 'PX Lamp Warm', when: 'night' } }, trisLow: 220, tris: 600 });
  mascot('pet_squirrel', 0.6);
  mascot('pet_owl', 0.6);
  gear('acc_treetop_acorn', 'hat', 0.2, 120, { main: 'PX Tree Bark Trail', brim: 'PX Tree Bark Trail 2', cross: 'PX Tree Bark', leaf: 'PX Tree Oak Light' });
  gear('acc_treetop_leafmask', 'face', 0.15, 110, { main: 'PX Tree Oak', second: 'PX Tree Oak Light', tip: 'PX Tree Autumn', tie: 'PX Tree Rope' });
  gear('acc_treetop_binoculars', 'neck', 0.15, 140, { main: 'PX Tree Flag', rim: 'PX Sunny', lens: 'PX Lens Pale', strap: 'PX Tree Rope' });
  gear('acc_treetop_leafwings', 'back', 0.3, 170, { main: 'PX Tree Oak', rib: 'PX Tree Oak Light', tip: 'PX Tree Autumn', strap: 'PX Tree Rope' });

  /* -- Medieval Castle: games, buildings, garden and market pieces, the duckling and the pony
     (toys and statues only: nothing weapon-like, no flame, no spires) -- */
  def3('castle_flinger', 'fun', 0.8, { main: 'PX Castle Wood', block: 'PX Castle Stone', f1: 'PX Candy Pink', f2: 'PX Castle Gold', f3: 'PX Lilac' },
    { pivots: ['plank'], anchors: ['top', 'seat'], anchorPivots: { seat: 'plank' }, actPivot: 'plank', act: 'toss', perform: 'seat:sit', tris: 600 });
  def3('castle_joust', 'fun', 1.2, { main: 'PX Castle Sandstone', rail: 'PX Castle Pennant', cloth: 'PX Castle Cloth', mane: 'PX Castle Banner' },
    { pivots: ['dummy', 'horse'], anchors: ['top', 'start', 'end', 'spot'], actPivot: 'dummy', act: 'joust', perform: 'trail:run',
      trail: ['start', 'end'], tris: 900 });
  def3('castle_maze', 'fun', 1, { main: 'PX Castle Meadow 2', top: 'PX Castle Meadow', floor: 'PX Castle Sandstone', pole: 'PX Castle Gold', flag: 'PX Castle Pennant' },
    { pivots: ['flag'], anchors: ['top', 'in'].concat(names('w', 3), ['mid']), actPivot: 'flag', act: 'maze', perform: 'trail:run',
      trail: ['in'].concat(names('w', 3), ['mid']), trisLow: 800, tris: 1200 });
  def3('castle_throne', 'fun', 1.8, { main: 'PX Castle Gold', cushion: 'PX Castle Banner', dais: 'PX Castle Stone', carpet: 'PX Castle Pennant' },
    { pivots: names('p', 3), anchors: ['top', 'seat'], actPivot: 'p0', act: 'royal', perform: 'seat:sit', tris: 700 });
  def3('castle_bridge', 'fun', 0.9,
    { main: 'PX Castle Stone', second: 'PX Castle Stone 2', cap: 'PX Castle Sandstone', water: 'PX Castle Water 1', deep: 'PX Castle Water 2', beak: 'PX Castle Gold' },
    { pivots: ['ducks'], anchors: ['top'].concat(names('s', 3)), actPivot: 'ducks', act: 'ducks', perform: 'trail:walk', trail: names('s', 3), tris: 800 });
  def3('castle_gate', 'fun', 2.5,
    { main: 'PX Castle Stone', door: 'PX Castle Wood', band: 'PX Castle Iron', flag: 'PX Castle Pennant', horn: 'PX Castle Gold', window: 'PX Castle Window' },
    { pivots: ['doorL', 'doorR', 'horns', 'flag0', 'flag1'], anchors: ['top', 'arch', 'spot'], actPivot: 'doorL', act: 'open', perform: 'stand:cheer',
      performAt: 'arch', toggle: lit('doorsOpen'), trisLow: 900, tris: 1400 });
  def3('castle_tower', 'fun', 2.9, { main: 'PX Castle Stone', step: 'PX Castle Sandstone', bell: 'PX Castle Gold', flag: 'PX Castle Pennant' },
    { pivots: ['bell', 'flag'], anchors: ['top'].concat(names('s', 6)), actPivot: 'bell', act: 'bell', perform: 'trail:hop',
      trail: names('s', 6).concat(['top']), tris: 900 });
  def3('castle_dragon', 'fun', 2, { main: 'PX Castle Teal', belly: 'PX Castle Gold', rim: 'PX Castle Stone' },
    { pivots: ['head', 'wingL', 'wingR'], anchors: ['top', 'spot', 'rim'], actPivot: 'head', act: 'spout', perform: 'stand:cheer', performAt: 'rim',
      trisLow: 900, tris: 1400 });
  def3('castle_herbs', 'decor', 0.45, { main: 'PX Castle Meadow 2', frame: 'PX Castle Wood', lavender: 'PX Lilac', mint: 'PX Mint', chive: 'PX Candy Pink' },
    { pivots: ['leaves'], anchors: ['top'], actPivot: 'leaves', act: 'rustle', variants: VARIANTS.castle_herbs,
      variantTokens: ['PX Lilac', 'PX Mint', 'PX Castle Gold'], trisLow: 120, tris: 220 });
  def3('castle_well', 'decor', 1.5, { main: 'PX Castle Stone', second: 'PX Castle Stone 2', wood: 'PX Castle Wood', water: 'PX Castle Teal' },
    { pivots: ['crank', 'bucket'], anchors: ['top', 'spot'], actPivot: 'bucket', act: 'bucket', perform: 'stand:lookBack', trisLow: 180, tris: 400 });
  /* one picture in three glass colourways (D101); the panes glow in their own colours */
  def3('castle_window', 'decor', 1.5, { main: 'PX Castle Stone', second: 'PX Castle Stone 2', lattice: 'PX Castle Iron' },
    { pivots: [], anchors: ['top'], act: 'glow', variants: VARIANTS.castle_window,
      variantTokens: ['PX Castle Pennant', 'PX Castle Teal', 'PX Castle Banner'], states: { lit: { tokens: PANES, dim: 0.5 } }, trisLow: 200, tris: 420 });
  def3('castle_stall', 'decor', 1.4, { main: 'PX Castle Wood', awning: 'PX Castle Pennant', cloth: 'PX Castle Cloth', loaf: 'PX Castle Sandstone' },
    { pivots: ['awning', 'goods'], anchors: ['top', 'spot'], actPivot: 'goods', act: 'serve', perform: 'stand:lookBack', variants: VARIANTS.castle_stall,
      variantTokens: ['PX Castle Pennant', 'PX Castle Banner', 'PX Castle Teal'], trisLow: 200, tris: 450 });
  def3('castle_statue', 'decor', 1.5, { main: 'PX Castle Stone', hi: 'PX Castle Cloth', trim: 'PX Castle Gold', plume: 'PX Castle Pennant', flag: 'PX Castle Banner' },
    { pivots: ['visor', 'flag', 'robin'], anchors: ['top'], actPivot: 'visor', act: 'salute', trisLow: 200, tris: 450 });
  def3('castle_banner', 'flag', 1.6, { main: 'PX Castle Banner', pole: 'PX Castle Wood', finial: 'PX Castle Gold' },
    { pivots: ['banner'], anchors: ['top'], actPivot: 'banner', act: 'wave', variants: VARIANTS.castle_banner,
      variantTokens: ['PX Castle Banner', 'PX Castle Pennant', 'PX Castle Teal'], trisLow: 130, tris: 250 });
  def3('castle_lantern', 'light', 1.1, { main: 'PX Castle Iron', cap: 'PX Castle Gold' },
    { pivots: [], anchors: ['top'], act: 'glow', states: { lit: glowTo('PX Castle Window') }, trisLow: 110, tris: 200 });
  pathTile('path_carpet', 'PX Castle Pennant', 'PX Castle Gold');
  mascot('pet_duckling', 0.55);
  mascot('pet_pony', 0.7);
  gear('acc_castle_ruff', 'neck', 0.1, 120, { main: 'PX Castle Cloth', fold: 'PX Lilac Base', stud: 'PX Castle Gold' });
  gear('acc_castle_visor', 'face', 0.2, 140, { main: 'PX Castle Stone', hi: 'PX Castle Cloth', rivet: 'PX Castle Gold' });
  gear('acc_castle_helm', 'hat', 0.35, 180, { main: 'PX Castle Stone', hi: 'PX Castle Cloth', rim: 'PX Castle Stone Shade', band: 'PX Castle Gold', plume: 'PX Castle Pennant' });
  gear('acc_castle_cloak', 'back', 0.35, 170, { main: 'PX Castle Banner', hem: 'PX Castle Gold', collar: 'PX Castle Cloth', spot: 'PX Castle Iron' });

  /* -- Penguin Ice Village: rides, village pieces, snow and ice decor, the penguin chick and the seal pup -- */
  def3('ice_sled', 'fun', 1.6, { main: 'PX Ice Snow', bank: 'PX Ice', sledge: 'PX Jungle Parrot Red', runner: 'PX Sunny' },
    { pivots: ['sled'], anchors: ['top', 'foot', 'spot', 'seat'], anchorPivots: { seat: 'sled' }, actPivot: 'sled', act: 'slide', perform: 'slide',
      trisLow: 900, tris: 1500 });
  def3('ice_skilift', 'fun', 2.9, { main: 'PX Ice Snow', hut: 'PX Tree Plank', chairA: 'PX Coral', chairB: 'PX Mint', chairC: 'PX Sunny' },
    { pivots: ['cable'].concat(names('c', 3)), anchors: ['top', 'foot', 'spot', 'seat'], anchorPivots: { seat: 'c0' }, actPivot: 'cable',
      act: 'chairlift', perform: 'seat:ride', idle: { type: 'pendulum', deg: 2, period: 1 / 0.3, pivots: names('c', 3), tiers: MIDHIGH },
      trisLow: 1100, tris: 1800 });
  def3('ice_penguin', 'decor', 0.7, { main: 'PX Ice Snow', pebble: 'PX Ice Pebble', back: 'PX Penguin Back', front: 'PX Penguin Front', beak: 'PX Penguin Orange' },
    { pivots: ['pen', 'chick'], anchors: ['top'], actPivot: 'pen', act: 'waddle', trisLow: 200, tris: 450 });
  def3('ice_fishhole', 'fun', 0.9, { main: 'PX Ice 2', snow: 'PX Ice Snow', water: 'PX Ice Deep', float: 'PX Coral' },
    { pivots: ['fish0', 'fish1', 'float'], anchors: ['top', 'spot'], actPivot: 'fish0', act: 'fish', perform: 'stand:lookBack', tris: 900 });
  def3('ice_cocoa', 'fun', 1.5, { main: 'PX Tree Plank', roof: 'PX Ice Snow', icicle: 'PX Ice Shine', glow: 'PX Ice Hut Glow' },
    { pivots: ['hatch', 'dishes'], anchors: ['top', 'seat'], actPivot: 'dishes', act: 'serve', perform: 'feast',
      idle: { type: 'emit', every: 5, n: 3, fx: 'wisp', tiers: MIDHIGH }, trisLow: 900, tris: 1500 });
  def3('ice_fort', 'fun', 1.3, { main: 'PX Ice Snow', second: 'PX Ice Snow 2', shade: 'PX Ice Snow Shade', flag: '@member' },
    { pivots: ['flag'], anchors: ['top', 'in0', 'in1', 'turret'], actPivot: 'flag', act: 'popup', perform: 'trail:hop', trail: ['in0', 'in1', 'turret'],
      trisLow: 1000, tris: 1600 });
  def3('ice_choir', 'fun', 1.1, { main: 'PX Ice', edge: 'PX Ice Snow', back: 'PX Penguin Back', front: 'PX Penguin Front', beak: 'PX Penguin Orange' },
    { pivots: names('pen', 3), anchors: ['top', 'spot'], actPivot: 'pen0', act: 'sing', perform: 'stand:cheer', trisLow: 900, tris: 1500 });
  def3('ice_castle', 'fun', 2.9, { main: 'PX Ice', second: 'PX Ice 2', cap: 'PX Ice Snow', flagA: 'PX Aurora Mint', flagB: 'PX Aurora Violet' },
    { pivots: ['gate'], anchors: ['top', 'spot', 'turret'], actPivot: 'gate', act: 'lights', perform: 'trail:hop', trail: ['spot', 'turret'],
      toggle: lit('lightsOn'),
      states: { row0: glowTo(AURORA[0]), row1: glowTo(AURORA[1]), row2: glowTo(AURORA[2]), row3: glowTo('PX Ice Hut Glow') },
      trisLow: 1100, tris: 1800 });
  def3('ice_snowpenguin', 'decor', 0.8, { main: 'PX Ice Snow', second: 'PX Ice Snow 2', shade: 'PX Ice Snow Shade', eye: 'PX Penguin Back', beak: 'PX Penguin Orange' },
    { pivots: ['flipL', 'flipR', 'head'], anchors: ['top'], actPivot: 'flipL', act: 'wave', trisLow: 200, tris: 450 });
  def3('ice_pine', 'tree', 1.9, { main: 'PX Tree Pine', mid: 'PX Tree Pine Mid', snow: 'PX Ice Snow', trunk: 'PX Tree Bark' },
    { pivots: ['snow'], anchors: ['top'], actPivot: 'snow', act: 'shake', variants: VARIANTS.ice_pine, trisLow: 300, tris: 600 });
  /* the lit colour drifts round the aurora at steady brightness (never a flash) */
  def3('ice_lantern', 'light', 1, { main: 'PX Ice', second: 'PX Ice 2', cap: 'PX Ice Snow' },
    { pivots: [], anchors: ['top'], act: 'glow',
      states: { lit: { off: 'PX Lamp Off', on: AURORA[0], tokens: AURORA, driftHz: FREQS.auroraDrift } }, trisLow: 160, tris: 350 });
  def3('ice_sculpture', 'decor', 1.3, { main: 'PX Ice', second: 'PX Ice 2', edge: 'PX Ice Shine', plinth: 'PX Ice Snow' },
    { pivots: ['spin'], anchors: ['top'], actPivot: 'spin', act: 'chime', variants: VARIANTS.ice_sculpture,
      variantTokens: ['PX Ice', 'PX Aurora Mint', 'PX Aurora Violet'], trisLow: 200, tris: 450 });
  def3('ice_snowglobe', 'fun', 1.1, { main: 'PX Ice Shine', base: 'PX Tree Plank', snow: 'PX Ice Snow', pine: 'PX Tree Pine', glow: 'PX Ice Hut Glow' },
    { pivots: ['globe', 'flakes'], anchors: ['top', 'spot'], actPivot: 'globe', act: 'shake', tris: 900 });
  def3('ice_bear', 'fun', 1.4, { main: 'PX Ice', second: 'PX Ice 2', hi: 'PX Ice Shine', plinth: 'PX Ice Pebble 2', cap: 'PX Ice Snow' },
    { pivots: ['snowcap'], anchors: ['top', 'spot'], actPivot: 'snowcap', act: 'pose', perform: 'pose', tris: 900 });
  pathTile('path_pebble', 'PX Ice Pebble', 'PX Ice Pebble 2');
  mascot('pet_penguin', 0.6);
  mascot('pet_seal', 0.45);
  gear('acc_ice_earmuffs', 'hat', 0.2, 180, { main: 'PX Aurora Mint', fluff: 'PX Ice Snow', band: 'PX Sky Blue' });
  gear('acc_ice_bells', 'neck', 0.15, 160, { main: 'PX Coral', bell: 'Star Gold', slot: 'PX Penguin Back' });
  gear('acc_ice_goggles', 'face', 0.1, 140, { main: 'PX Ice Snow', lensA: 'PX Penguin Orange', lensB: 'PX Coral', lensC: 'PX Candy Pink', strap: 'PX Penguin Back' });
  gear('acc_ice_pack', 'back', 0.25, 170, { main: 'PX Penguin Back', tummy: 'PX Penguin Front', beak: 'PX Penguin Orange', strap: 'PX Mint' });

  /* ---------------- the kids update: 14 more pets and 6 pet foods (kids-update pets.json) ----------------
     KU_IDS are CATALOG ids 241–260 in CATALOG order: the fourteen new species (catalogue.new: the
     four Home pets, then two per land), then the six foods (food.items). They are not v3 ids
     (V3_IDS stays plan-v3's 136, KU_SET apart): a pet takes the mascots' row (kind 'pet', PETCOL3,
     the V4.54 sockets and bones, h at the crown); a food is kind 'food': its display model
     (px-care.js) is a paper bag (biscuits, the sack), a crate (veg, fruit), a tin (fish) or a jar
     (treats) with the food on top — the bowl's pile colours (biscuits tan squares, veg orange and
     green, fish silver-blue, fruit red, yellow and purple, a treat a pink and mint cookie). A food is
     never placed, never worn and never a vox photocard: the shop and the pantry draw its 2D icon
     (KU37). Its tris is TRIS_CAPS.food on every tier. */
  var KU_IDS = [], KU_SET = {}, FOOD_TRIS = 300;
  function defKU(id, kind, h, colors, o) {
    KU_IDS.push(id);
    KU_SET[id] = 1;
    o.act = null; o.perform = null;
    def(id, kind, h, colors, o);
  }
  function kuPet(id, h) { defKU(id, 'pet', h, petColors(id), petRig()); }
  function food(id, h, colors) { defKU(id, 'food', h, colors, { tris: FOOD_TRIS }); }
  kuPet('pet_hamster', 0.35);
  kuPet('pet_guineapig', 0.35);
  kuPet('pet_tortoise', 0.35);
  kuPet('pet_budgie', 0.45);
  kuPet('pet_otter', 0.45);
  kuPet('pet_flamingo', 0.8);
  kuPet('pet_sloth', 0.5);
  kuPet('pet_toucan', 0.6);
  kuPet('pet_redpanda', 0.55);
  kuPet('pet_hedgehog', 0.35);
  kuPet('pet_goatkid', 0.65);
  kuPet('pet_peacock', 0.7);
  kuPet('pet_reindeer', 0.7);
  kuPet('pet_snowleopard', 0.55);
  food('food_biscuits', 0.45, { main: 'PX Khaki', trim: 'PX Khaki Shade', label: 'PX Candy Pink', food: 'PX Waffle' });
  food('food_sack', 0.6, { main: 'PX Khaki', trim: 'PX Jungle Rope', label: 'PX Sky Blue', food: 'PX Waffle' });
  food('food_veg', 0.4, { main: 'PX Tree Plank', trim: 'PX Jungle Bark Light', food: 'PX Jungle Flower Orange', food2: 'PX Leaf', food3: 'PX Tree Oak Light' });
  food('food_fish', 0.35, { main: 'PX Pier Stripe Blue', trim: 'PX Ice Snow Shade', label: 'PX Sunny', food: 'PX Ice Pebble 2', food2: 'PX Lens Pale' });
  food('food_fruit', 0.4, { main: 'PX Tree Plank', trim: 'PX Jungle Bark Light', food: 'PX Jungle Parrot Red', food2: 'PX Banana', food3: 'PX Lilac' });
  food('food_treats', 0.4, { main: 'PX Lens Pale', trim: 'PX Candy Pink', food: 'PX Candy Pink', food2: 'PX Mint' });

  /* ---------------- characters that are not catalogue items ---------------- */
  /* v2: the idol-style chibi in a hoodie (the face stays the child's emoji), the 4-point ✦
     Spark Stick (never 5-pointed) and a silhouette crowd lit by its own Spark Sticks */
  var CHARACTERS = {
    avatar: { kind: 'avatar', h: 1.0,
              colors: { hood: '@member', hoodie: 'Graphite', band: '@member', legs: 'Night Asphalt', sneaker: 'Bone White', mic: 'Gunmetal',
                        hand: 'Bone White', string: 'Bone White' },
              outline: true, anchors: ['top', 'hand'], hit: [0.8, 0.8, 0.8], tris: BUDGET.avatar, trisLow: 1050,
              idle: { type: 'shift', period: 2.4 }, loops: [{ type: 'glance', every: TEMPO.idle.avatarGlance }] },
    wand: { kind: 'wand', h: 0.26, colors: { handle: 'Midnight Ink', grip: '@member', collar: 'Gunmetal', head: '@member', core: 'Bone White' },
            mats: { head: 'neon:@member' }, points: 4, outline: false, tris: 260 },
    fanBlob: { kind: 'fan', h: 0.3,
               colors: { a: 'Crowd Shadow', b: 'Crowd Shadow 2', c: 'Crowd Shadow 3', eye: 'Bone White',
                         day1: 'Splash Blue', day2: 'Grape', day3: 'Leaf Mint', day4: 'Coral', day5: 'Butter', day6: 'Concrete Light' },
               outline: false, tris: 50 }
  };
  var MEMBER_FALLBACK = 'Bubblegum';

  /* ---------------- light / sky / water / fog presets ----------------
     v2: DUSK (golden hour) is the default (k = 0) and SHOW is Showtime (k = 1). The sun and
     the moon share ONE fixed direction, so the static shadow map never re-renders for light.
     rimMember = how much of the member colour the rim takes. DAY and SHOW_V1 are the v1
     pastel pair, kept for scenes that copied them (the kart game's light arc). */
  var SUN_POS = [-9, 7.5, 8];
  var DUSK = {
    hemiSky: 'Hemi Dusk Sky', hemiGround: 'Hemi Dusk Ground', hemiIntensity: 1.35,
    sunColor: 'Sun Dusk', sunIntensity: 2.2, sunPos: SUN_POS,
    fogColor: 'Dusk Fog', fogNear: 28, fogFar: 72, exposure: 1.05,
    rimColor: 'Rim Dusk', rimStrength: 0.35, rimMember: 0.25,
    skyTop: 'Dusk Zenith', skyMid: 'Dusk Mid', skyHorizon: 'Dusk Horizon',
    seaShallow: 'Lagoon', seaDeep: 'Deep Bay', foam: 'Foam Dusk', waveLine: 'Wave Dusk',
    neonSleeve: 0.25, haloScale: 1.2, haloOpacity: 0.6, stars: 0.25, cones: 0, glints: 1, windowGlow: 0.6
  };
  var SHOW = {
    hemiSky: 'Hemi Night Sky', hemiGround: 'Hemi Night Ground', hemiIntensity: 0.75,
    sunColor: 'Moon V2', sunIntensity: 0.8, sunPos: SUN_POS,
    fogColor: 'Night Mid', fogNear: 22, fogFar: 58, exposure: 1.10,
    rimColor: 'Rim Night', rimStrength: 0.6, rimMember: 0.5,
    skyTop: 'Night Zenith', skyMid: 'Night Mid', skyHorizon: 'City Glow',
    seaShallow: 'Night Lagoon', seaDeep: 'Night Deep', foam: 'Foam Night', waveLine: 'Holo Blue',
    neonSleeve: 0.45, haloScale: 1.6, haloOpacity: 0.9, stars: 1, cones: 1, glints: 0, windowGlow: 1
  };
  var DAY = {
    hemiSky: 'Hemi Sky Day', hemiGround: 'Hemi Ground Day', hemiIntensity: 1.9,
    sunColor: 'Sun Day', sunIntensity: 2.4, sunPos: [-7, 14, 9],
    fogColor: 'Sky Day Horizon', fogNear: 30, fogFar: 70, exposure: 1.0,
    rimColor: 'Cloud White', rimStrength: 0.28, rimMember: 0,
    skyTop: 'Sky Day Top', skyMid: 'Sky Day Mid', skyHorizon: 'Sky Day Horizon',
    seaShallow: 'Sea Shallow', seaDeep: 'Sea Deep', foam: 'Foam', waveLine: 'Wave Line',
    neonSleeve: 0, haloScale: 1, haloOpacity: 0.5, stars: 0, cones: 0, glints: 1, windowGlow: 0
  };
  var SHOW_V1 = {
    hemiSky: 'Hemi Sky Show', hemiGround: 'Hemi Ground Show', hemiIntensity: 0.85,
    sunColor: 'Moon', sunIntensity: 0.9, sunPos: [-7, 14, 9],
    fogColor: 'Sky Night Mid', fogNear: 24, fogFar: 60, exposure: 1.08,
    rimColor: 'Rim Showtime', rimStrength: 0.55, rimMember: 0.4,
    skyTop: 'Sky Night Top', skyMid: 'Sky Night Mid', skyHorizon: 'Sky Night Horizon',
    seaShallow: 'Sea Shallow Show', seaDeep: 'Sea Deep Show', foam: 'Foam Show', waveLine: 'Holo Blue',
    neonSleeve: 0.45, haloScale: 1.6, haloOpacity: 0.9, stars: 1, cones: 1, glints: 0, windowGlow: 1
  };
  var PRESET_KEYS = Object.keys(DAY);
  var PRESET_COLOR_KEYS = PRESET_KEYS.filter(function (k) { return typeof DAY[k] === 'string'; });

  /* ---------------- v3 constants (Pixel Blocks) ---------------- */
  /* pixel-vox distance haze (D8: no scene.fog): near / far are ADDED to the camera's settle
     distance; max caps the mix toward the sky (0 in the Sky map) */
  var VOX_FOG = { nearAdd: 25, farAdd: 140, max: 0.35 };
  /* the vox exposure fit (crisp C1; D6 'palette-exact'): every scene that lights voxels sets the
     shared uVoxGain = voxGain(its hemi + sun), so a lit top face never comes out brighter than its
     token (target 1 = the token colour itself). Glow stays unlit (× uGlowMul). */
  var VOX_EXPOSURE = { target: 1.0 };
  /* locked-land previews (D4): desaturation and haze toward the sky's mid band; a peek eases to
     peekDesat (and no haze) over peekSec on MID / HIGH */
  var PREVIEW = { desat: 0.30, haze: 0.25, hazeNight: 0.35, peekDesat: 0.10, peekSec: 0.6 };
  /* voxel grids in u (D11): terrain G2, silhouette masses G4, details G8, ropes / bulbs G16,
     balls G32, characters GC, path tiles PATH [x, y, z] */
  var GRAIN = { G2: 0.5, G4: 0.25, G8: 0.125, G16: 0.0625, G32: 0.03125, GC: 0.05, PATH: [0.125, 0.0625, 0.125] };
  /* the island crew's voxel rigs are shown 1.2× about the rig root (D10; 1.0 on photocards) */
  var CREW_SCALE = 1.2;
  /* item height caps: Home framing assumes 2.9 u for everything placeable (any 'any' item, D48);
     only LOOK kind 'isleLandmark' reaches 5.5 u (D73) */
  var ITEM_MAX_H = 2.9, ISLAND_ITEM_MAX_H = 5.5;
  /* voxel triangle caps (LOD0, every tier). Classes from the voxel-engine inventory for the V4.54
     ids, the lookEntries tris per v3 id, isleLandmark 4000 (D73) and diorama 10000 (land icons: the fine island + landmark, drawn once off-island;
     previews, sky-world previews.cost). TRIS_CLASS maps a LOOK kind to its class; trisCap(id, tier)
     applies them. v3 ids with detail voxels tagged lod 'mid' may add TRIS_DETAIL on MID / HIGH
     (isleLandmarks never past TRIS_CAPS.isleLandmark); organic kinds meet TRIS_CAPS_LOW at LOW (D71).
     petRig3 (D108): a mascot bare, and any dressed v3 rig (a mascot in anything, or any pet in land
     gear) in one draw; a V4.54 pet in V4.54 accessories stays inside petRig. */
  var TRIS_CAPS = {
    house: 1800, building: 2000, bld_stage: 2600, attraction: 2600, tree: 600, smallDecor: 350, flower: 220,
    propLandmark: 900, fun: 900, pathPiece: 100, joinsPiece: 320, petRig: 900, avatar: 1100, fan: 160, critter: 140,
    isleLandmark: 4000, diorama: 10000, petRig3: PET_RIG3, food: FOOD_TRIS
  };
  /* + one cap per v3 id: its lookEntries tris (land ids draw dioramas: class 'diorama'). A mascot's
     is the dressed cap; a piece of gear's is its own cap inside its slot's SLOT_CAPS */
  V3_IDS.forEach(function (id) { if (LOOK[id].kind !== 'land') TRIS_CAPS[id] = LOOK[id].tris; });
  /* + the kids update's ids: a new pet's dressed cap (as a mascot's), a food's display cap */
  KU_IDS.forEach(function (id) { TRIS_CAPS[id] = LOOK[id].tris; });
  /* tier LOW: the organic kinds (D71) + every v3 id with a lookEntries trisLow: the themed one-offs
     above 1,000 tris and the four at 1,200 (D89), and every repeatable decor id (D106) */
  var TRIS_CAPS_LOW = { tree: 300, treetop_platform: 350, flower: 120, bush: 200, rock: 200, mushroom: 200 };
  V3_IDS.forEach(function (id) { if (LOOK[id].trisLow) TRIS_CAPS_LOW[id] = LOOK[id].trisLow; });
  /* the 'vox-lod1' template of a v3 placeable (D106): sharePct % of its tris; repeatable decor
     (the tree / flower / smallDecor classes) never over decorMax; paths are exempt (TRIS_CAPS_LOD1) */
  var TRIS_LOD1 = { sharePct: 35, decorMax: 120, decorClasses: { tree: 1, flower: 1, smallDecor: 1 } };
  var TRIS_DETAIL = { isleLandmark: 1000, fun: 400 };
  var TRIS_CLASS = {
    tree: 'tree', flower: 'flower', bush: 'smallDecor', rock: 'smallDecor', mushroom: 'smallDecor', light: 'smallDecor',
    flag: 'smallDecor', decor: 'smallDecor', landmark: 'propLandmark', isleLandmark: 'isleLandmark', path: 'pathPiece',
    fun: 'fun', house: 'house', style: 'house', building: 'building', attraction: 'attraction', variant: 'attraction',
    cosmetic: 'attraction', pet: 'petRig', acc: 'petRig', land: 'diorama', food: 'food'
  };
  /* photocards (voxel-engine 4_photocards): the mockup's daytime hemi + sun as a studio, no rim
     (the vox program ignores setRim), the v2 framing (FOV 30, 28° elevation, 25° yaw, 80% fill)
     and a transparent clear */
  var PIXEL_STUDIO = {
    hemi: { sky: 'PX Day Hemi Sky', ground: 'PX Day Hemi Ground', intensity: 1.5 },
    key: { color: 'PX Day Sun', intensity: 2.5, pos: [-5, 8, 9] },
    rim: null, fov: 30, elev: 28, yaw: 25, fill: 0.8, clear: 'transparent'
  };

  /* ---------------- island themes: colour tokens per island (geometry lives in isles3d) ----------------
     top[] (0.5 u voxels in big soft patches, topMode = the vox tile mode), edge (the layer under the
     top's outer voxels), beach[] (the ring round the land), patches {mode, tokens} (decks, clearings,
     ice patches), slab {tops[3], floor[3], wall [lip + 8 bands]} | null (treetop floats on a root
     ball), strata[] (Home 8 / lands 6) and glow gems[], rim {kinds[] for isles3d's rim scenery,
     tokens}, fallKind 'water' | 'iced' | 'roots'. A land voxel's sides use its own top colour (never
     a grass-block side). The five lands' top, edge, beach and patches are the ground-only
     GROUND_TOKENS (crisp C4: sunlit sand, leaf litter, moss and an olive trail, a light lawn on
     courtyard cobble, soft blue 'shady snow' with frozen ponds); Home is the mockup's, unchanged.
     Rim scenery keeps the land's own tokens (the ice overhang stays white snow). */
  function slabOf(name) {
    return { tops: seq('PX ' + name + ' Water', 3), floor: seq('PX ' + name + ' Floor', 3),
             wall: ['PX ' + name + ' Wall Lip'].concat(seq('PX ' + name + ' Wall', 8)) };
  }
  var TREE_PINES = ['PX Tree Pine', 'PX Tree Pine Mid', 'PX Tree Pine Light'];
  var ISLE_THEME = {
    home: {
      top: ['PX Home Grass', 'PX Home Grass 2', 'PX Home Grass 3'], topMode: 'soft', tuft: ['PX Home Tuft'],
      edge: 'PX Home Edge', edgeMode: 'soft', beach: ['PX Home Beach', 'PX Home Beach 2'], patches: null,
      meadow: { top: ['PX Meadow', 'PX Meadow 2'], cliff: 'PX Meadow Cliff' }, cove: { top: ['PX Cove Sand'] }, sandbar: 'PX Sandbar',
      slab: { tops: seq('PX Sea Top', 3), floor: seq('PX Sea Floor', 3), wall: ['PX Sea Wall Lip'].concat(seq('PX Sea Wall', 8)) },
      strata: seq('PX Home Strata', 8), gems: seq('PX Home Gem', 4),
      rim: { kinds: ['beach', 'foam', 'gatePads'], tokens: { foam: 'PX Glint' } }, fallKind: 'water'
    },
    pier: {
      top: ['PX Pier Ground', 'PX Pier Ground 2'], topMode: 'soft', edge: 'PX Pier Ground', edgeMode: 'soft',
      beach: ['PX Pier Ground', 'PX Pier Ground 2'], patches: { mode: 'plank', tokens: ['PX Pier Deck', 'PX Pier Deck 2'] },
      slab: slabOf('Pier'), strata: seq('PX Pier Strata', 6), gems: seq('PX Pier Gem', 3),
      rim: { kinds: ['sand', 'boardwalkSkirt', 'piles', 'lampPosts', 'bunting'],
             tokens: { pile: 'PX Pier Pile', stripe: 'PX Pier Stripe Blue', skirt: 'Cloud White', lamp: 'PX Bulb Warm',
                       bunting: ['PX Coral', 'PX Sunny', 'PX Pier Stripe Blue', 'PX Mint'] } },
      fallKind: 'water'
    },
    jungle: {
      top: ['PX Jungle Ground', 'PX Jungle Ground 2'], topMode: 'leaf', edge: 'PX Jungle Moss Stone', edgeMode: 'soft',
      beach: ['PX Jungle Moss Stone'], patches: null,
      slab: slabOf('Jungle'), strata: seq('PX Jungle Strata', 6), gems: seq('PX Jungle Gem', 3),
      rim: { kinds: ['mossStone', 'rimTrees', 'vines', 'glowFungus', 'lilyPads'],
             tokens: { stone: 'PX Jungle Moss Stone', cap: 'PX Jungle Canopy Light', trunk: ['PX Jungle Bark', 'PX Jungle Bark Light'],
                       canopy: ['PX Jungle Canopy Deep', 'PX Jungle Canopy', 'PX Jungle Canopy Light'], vine: 'PX Jungle Canopy Deep',
                       fungus: 'PX Jungle Glow Fungus', lily: 'PX Jungle Canopy', lilyFlower: 'PX Jungle Flower Pink' } },
      fallKind: 'water'
    },
    treetop: {
      top: ['PX Tree Ground', 'PX Tree Ground 2'], topMode: 'leaf', edge: 'PX Tree Moss', edgeMode: 'soft',
      beach: ['PX Tree Bark'], patches: { mode: 'soft', tokens: ['PX Tree Trail', 'PX Tree Trail 2'] },
      slab: null, strata: seq('PX Treetop Strata', 6), gems: seq('PX Treetop Gem', 2),
      rim: { kinds: ['rootRing', 'rimTrees', 'ropeLines', 'danglingRoots'],
             tokens: { root: 'PX Tree Bark', moss: 'PX Tree Moss', pine: TREE_PINES, oak: ['PX Tree Oak', 'PX Tree Oak Light'],
                       autumn: 'PX Tree Autumn', rope: 'PX Tree Rope', plank: 'PX Tree Plank', toadstool: 'PX Tree Toadstool' } },
      fallKind: 'roots'
    },
    castle: {
      top: ['PX Castle Lawn', 'PX Castle Lawn 2'], topMode: 'soft', edge: 'PX Castle Cobble', edgeMode: 'cobble',
      beach: ['PX Castle Cobble', 'PX Castle Cobble 2'], patches: null,
      slab: slabOf('Castle'), strata: seq('PX Castle Strata', 6), gems: seq('PX Castle Gem', 2),
      rim: { kinds: ['cutStone', 'pennants', 'gatehouse'],
             tokens: { stone: ['PX Castle Stone', 'PX Castle Stone 2'], shade: 'PX Castle Stone Shade', pennant: 'PX Castle Pennant',
                       gold: 'PX Castle Gold', banner: 'PX Castle Banner' } },
      fallKind: 'water'
    },
    ice: {
      top: ['PX Ice Ground', 'PX Ice Ground 2', 'PX Ice Ground 3'], topMode: 'snow', edge: 'PX Ice Ground 2', edgeMode: 'snow',
      beach: ['PX Ice Ground', 'PX Ice Ground 2'], patches: { mode: 'ice', tokens: ['PX Ice Pond', 'PX Ice Pond 2'] },
      slab: slabOf('Ice'), strata: seq('PX Ice Strata', 6), gems: seq('PX Ice Gem', 3),
      rim: { kinds: ['snowOverhang', 'icicles', 'snowPines', 'drifts', 'floes'],
             tokens: { snow: 'PX Ice Snow', shade: 'PX Ice Snow Shade', icicle: ['PX Ice Shine', 'PX Ice'], pine: TREE_PINES,
                       floe: 'PX Ice Snow 2' } },
      fallKind: 'iced'
    }
  };

  /* ---------------- v3 light presets: Daytime (k 0) → sunset (0.5) → Showtime night (1) ----------------
     sky-world environment.lightModes. Each carries the v3 fields — bands (13 backdrop bands, top →
     horizon), hemi {sky, ground, intensity}, sun | moon {color, intensity} (one direction,
     PX_SUN_POS, so the static shadow map never re-renders for light), haze, cloud {base, top} (cube
     clouds), farCloud {top, under} (the backdrop's flat clouds), disc {color, shade} (the pixel sun
     / moon), starCounts {pixel, plus, sparkles} (backdrop) and frameLuma (sky-world's estimate) —
     and every v2 PRESET_KEYS key, so env-style readers keep working: fog keys are VOX_FOG's adds,
     exposure 1 and rim 0 (palette-exact, no rim on vox), the sea keys are Home's water. */
  var PX_SUN_POS = [9, 18, 11];
  function pxPreset(name, light, o) {
    var lit = { color: 'PX ' + name + (light === 'moon' ? ' Moon' : ' Sun'), intensity: o.light };
    var p = {
      bands: seq('PX ' + name + ' Band', 13),
      hemi: { sky: 'PX ' + name + ' Hemi Sky', ground: 'PX ' + name + ' Hemi Ground', intensity: o.hemi },
      haze: 'PX ' + name + ' Haze',
      cloud: { base: 'PX ' + name + ' Cloud Base', top: 'PX ' + name + ' Cloud Top' },
      farCloud: { top: 'PX ' + name + ' Far Cloud', under: 'PX ' + name + ' Far Cloud Under' },
      disc: o.disc, starCounts: o.starCounts, frameLuma: o.frameLuma
    };
    p[light] = lit;
    /* the v2 keys (DAY's order) */
    var v2 = {
      hemiSky: p.hemi.sky, hemiGround: p.hemi.ground, hemiIntensity: o.hemi, sunColor: lit.color, sunIntensity: o.light,
      sunPos: PX_SUN_POS.slice(), fogColor: p.haze, fogNear: VOX_FOG.nearAdd, fogFar: VOX_FOG.farAdd, exposure: 1,
      rimColor: p.hemi.sky, rimStrength: 0, rimMember: 0, skyTop: p.bands[0], skyMid: p.bands[6], skyHorizon: p.bands[12],
      seaShallow: 'PX Sea Top 1', seaDeep: 'PX Sea Top 3', foam: 'PX Glint', waveLine: 'PX Sea Wall Lip'
    };
    PRESET_KEYS.forEach(function (k) { p[k] = own(v2, k) ? v2[k] : o.v2[k]; });
    return p;
  }
  var PX_DAY = pxPreset('Day', 'sun', {
    hemi: 1.55, light: 2.5, frameLuma: 0.60, disc: { color: 'PX Sunny', shade: 'PX Sunny' },
    starCounts: { pixel: 0, plus: 0, sparkles: 16 },
    v2: { neonSleeve: 0, haloScale: 1, haloOpacity: 0.5, stars: 0, cones: 0, glints: 1, windowGlow: 0 }
  });
  PX_DAY.rainbow = seq('PX Rainbow', 6);       /* the soft day rainbow, gone by k 0.35 (pxPresetAt) */
  var PX_SUNSET = pxPreset('Sunset', 'sun', {
    hemi: 1.35, light: 2.0, frameLuma: 0.35, disc: { color: 'PX Sunset Sun Disc', shade: 'PX Sunset Sun Disc' },
    starCounts: { pixel: 0, plus: 0, sparkles: 0 },
    v2: { neonSleeve: 0.2, haloScale: 1.3, haloOpacity: 0.7, stars: 0.25, cones: 0, glints: 0.5, windowGlow: 0.6 }
  });
  var PX_NIGHT = pxPreset('Night', 'moon', {
    hemi: 1.05, light: 1.0, frameLuma: 0.14, disc: { color: 'PX Night Moon Disc', shade: 'PX Night Moon Shade' },
    starCounts: { pixel: 60, plus: 12, sparkles: 0 },
    v2: { neonSleeve: 0.45, haloScale: 1.6, haloOpacity: 0.9, stars: 1, cones: 0, glints: 0, windowGlow: 1 }
  });
  /* the Showtime blend (sky-world transition; D14): 2.0 s inOutSine, band by band (each of the 13
     backdrop bands fades over bandFadeSec, staggered bandStaggerSec: night rolls down from the top,
     day comes back from the horizon up); reduced motion = a 1.4 s linear colour fade. The backdrop
     redraws ≤ redrawFps while blending only. A reversal starts from the current k (no jumps). */
  var SHOW_BLEND = { sec: 2.0, ease: 'inOutSine', reducedSec: 1.4, reducedEase: 'linear', bandFadeSec: 0.4, bandStaggerSec: 0.12, redrawFps: 15 };
  /* full-screen luminance may change ≤ maxDelta in any windowSec window (nonNegotiables) */
  var LUMA_RULE = { maxDelta: 0.20, windowSec: 0.5 };
  /* sky-world's frame composition for the luminance estimate (frameLuma) */
  var FRAME_MIX = { sky: 0.35, land: 0.40, water: 0.20, accents: 0.05 };

  /* ---------------- colour maths ---------------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function normHex(h) {
    if (typeof h !== 'string') return null;
    var m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    return m ? '#' + m[1].toUpperCase() : null;
  }
  function hexToRgb(h) { var n = parseInt(normHex(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r, g, b) {
    function c(v) { var s = Math.round(Math.max(0, Math.min(255, v))).toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }
    return '#' + c(r) + c(g) + c(b);
  }
  function mixHex(a, b, k) {
    var x = hexToRgb(a), y = hexToRgb(b); k = clamp01(k);
    return rgbToHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
  }
  /* shift HSL lightness by dL percentage points (+12 highlight, -12 shade, -6 skirting) */
  function tone(h, dL) {
    var c = hexToRgb(h), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, hu = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hu = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hu /= 6;
    }
    l = clamp01(l + dL / 100);
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    if (!s) return rgbToHex(l * 255, l * 255, l * 255);
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return rgbToHex(f(p, q, hu + 1 / 3) * 255, f(p, q, hu) * 255, f(p, q, hu - 1 / 3) * 255);
  }

  /* ---------------- token resolution ---------------- */
  function sel(st, slot) { var v = st && st[slot]; return typeof v === 'string' && v ? v : SLOT_DEFAULTS[slot]; }
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  /* 'Grass Top' | 'WALL.wall_pink' | 'WALL.$wall' | 'THEMES.course_snow.obs.low.0' | '@member' |
     'PETCOL3.pet_crab.body' (the mascots' table, D107) */
  function hex(token, st) {
    if (typeof token !== 'string' || !token) return null;
    if (token.charAt(0) === '@') {
      if (token === '@member') return normHex(st && st.member) || PALETTE[MEMBER_FALLBACK];
      return null;
    }
    if (own(PALETTE, token)) return PALETTE[token];
    if (own(PALETTE_V2, token)) return PALETTE_V2[token];
    if (own(ART2D, token)) return ART2D[token];
    if (own(EXTRA, token)) return EXTRA[token];
    if (own(PALETTE_V3, token)) return PALETTE_V3[token];
    if (own(ADDED, token)) return ADDED[token].hex;
    var parts = token.split('.');
    var cur = parts[0] === 'PETCOL3' ? PETCOL3 : own(LOCKED, parts[0]) ? LOCKED[parts[0]] : null;
    if (parts.length < 2 || !cur) return null;
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (p.charAt(0) === '$') p = sel(st, p.slice(1));
      if (!own(cur, p)) return null;
      cur = cur[p];
    }
    return normHex(cur);
  }
  function isToken(token) {
    if (typeof token !== 'string') return false;
    if (token.indexOf('$') >= 0) return hex(token, {}) != null;
    return hex(token) != null;
  }
  /* every colour token an entry references: colors values, show.neon[], and any
     {token} / {tokens: []} object inside show, idle, loops or mats ('neon:<Token>'); v3 entries
     add their states' off / on / tokens, copy {token}s and variantTokens */
  function tokensIn(e) {
    var out = [];
    function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (k === 'token' && typeof v === 'string') out.push(v);
        else if ((k === 'tokens' || k === 'neon') && Array.isArray(v)) v.forEach(function (t) { if (typeof t === 'string') out.push(t); });
        else walk(v);
      });
    }
    if (!e) return out;
    Object.keys(e.colors || {}).forEach(function (k) { out.push(e.colors[k]); });
    Object.keys(e.mats || {}).forEach(function (k) { var m = e.mats[k]; if (/^neon:/.test(m)) out.push(m.slice(5)); });
    walk(e.show); walk(e.idle); walk(e.loops);
    if (e.states) Object.keys(e.states).forEach(function (k) {
      var s = e.states[k];
      [s.off, s.on].concat(s.tokens || []).forEach(function (t) { if (typeof t === 'string') out.push(t); });
    });
    walk(e.copy);
    (e.variantTokens || []).forEach(function (t) { out.push(t); });
    return out;
  }
  function colorsFor(id, st) {
    var e = LOOK[id] || CHARACTERS[id], out = {};
    if (!e) return out;
    Object.keys(e.colors).forEach(function (k) { out[k] = hex(e.colors[k], st); });
    return out;
  }

  /* ---------------- style state ---------------- */
  var HOUSE_SLOTS = { wall: 1, roof: 1, door: 1, shape: 1 };
  function detailList(d) {
    var list = Array.isArray(d) ? d.filter(function (x) { return typeof x === 'string'; })
      : (d && typeof d === 'object' ? Object.keys(d).filter(function (k) { return d[k]; }) : []);
    var seen = {}, out = [];
    list.forEach(function (x) { if (/^detail_/.test(x) && own(LOOK, x) && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out.sort();
  }
  function isShape(id) { return typeof id === 'string' && own(LOOK, id) && LOOK[id].slot === 'shape'; }
  function variantCount(id) { return own(VARIANTS, id) ? VARIANTS[id] : 1; }
  function clampVariant(v, id) { var n = variantCount(id), x = v | 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  /* {wall, roof, door, details[], shape, variant}. An unknown shape (from a newer save)
     falls back to the default; the cottage has a single trim, so its variant is 0. */
  function houseState(st, override) {
    var s = { wall: sel(st, 'wall'), roof: sel(st, 'roof'), door: sel(st, 'door'), details: detailList(st && st.details),
              shape: sel(st, 'shape'), variant: 0 };
    if (override) {
      var e = LOOK[override];
      if (e && e.part === 'detail') { if (s.details.indexOf(override) < 0) s.details = s.details.concat([override]).sort(); }
      else if (e && HOUSE_SLOTS[e.slot]) s[e.slot] = override;
    }
    if (!isShape(s.shape)) s.shape = SLOT_DEFAULTS.shape;
    s.variant = s.shape === 'shape_cottage' ? 0 : clampVariant(st && st.variant, s.shape);
    /* the castle has its own pennants, so the rooftop flag is hidden (same rule as 2D) */
    if (s.roof === 'roof_castle') s.details = s.details.filter(function (x) { return x !== 'detail_flag'; });
    return s;
  }
  /* the cottage keeps the exact v1 key; every other shape appends its shape and trim */
  function houseKey(s) {
    var k = s.wall + '|' + s.roof + '|' + s.door + '|d:' + s.details.join(',');
    return s.shape === 'shape_cottage' ? k : k + '|s:' + s.shape + '|v:' + s.variant;
  }
  function crownTris(shape, roof) {
    if (shape === 'shape_cottage') return (LOOK[roof] || LOOK[SLOT_DEFAULTS.roof]).tris;
    return roof === 'roof_castle' ? HOUSE_TRIS.crownCastle : HOUSE_TRIS.crown;
  }
  /* the triangle budget of one house state: body + crown + door + every detail shown */
  function houseBudget(st) {
    var s = houseState(st), t = HOUSE_TRIS.body[s.shape] + crownTris(s.shape, s.roof) + HOUSE_TRIS.door;
    s.details.forEach(function (d) { t += LOOK[d].tris; });
    return t;
  }
  var ACC_SLOTS = ['hat', 'neck', 'face', 'back'];
  function accState(acc, add) {
    var out = {};
    ACC_SLOTS.forEach(function (sl) {
      var v = acc && acc[sl];
      if (typeof v === 'string' && LOOK[v] && LOOK[v].socket === sl) out[sl] = v;
    });
    if (add && LOOK[add] && LOOK[add].socket) out[LOOK[add].socket] = add;
    return out;
  }
  /* the ctx.st handed to a build: {wall, roof, door, details[], shape, variant} for the house
     and every home style (styles and shapes preview on the player's own house), {course}
     for the gate and course variants, {ball, stadium} for the pitch, {kart} for the garage,
     {acc} for pets, {pet, acc} for accessories (they preview on the active pet), {variant}
     for city buildings and the V3_VARIANT_IDS colourways (D72), {} otherwise */
  function resolveStyle(id, st) {
    var e = LOOK[id];
    if (!e) return {};
    if (id === 'house_cottage') return houseState(st);
    if (e.kind === 'style') return houseState(st, id);
    if (id === 'att_course') return { course: sel(st, 'course') };
    if (id === 'att_pitch') return { ball: sel(st, 'ball'), stadium: sel(st, 'stadium') };
    if (id === 'att_kart') return { kart: sel(st, 'kart') };
    if (e.kind === 'building' || own(V3_VARIANT, id)) return { variant: clampVariant(st && st.variant, id) };
    if (e.kind === 'pet') return { acc: accState(st && st.acc) };
    if (e.kind === 'acc') {
      var pet = st && typeof st.pet === 'string' && LOOK[st.pet] && LOOK[st.pet].kind === 'pet' ? st.pet : 'pet_puppy';
      return { pet: pet, acc: accState(st && st.acc, id) };
    }
    return {};
  }
  function accKey(acc) { return 'a:' + ACC_SLOTS.filter(function (s) { return acc[s]; }).map(function (s) { return acc[s]; }).sort().join(','); }
  /* stable cache key per (id, resolved style); 'base' for items with one look. The V3_VARIANT_IDS
     key on their colourway like buildings ('v:<n>'; castle_wall's pose() still builds
     'w:<piece>:v<n>' itself), which leaves every V4.54 key unchanged (D72) */
  function stateKey(id, st) {
    var e = LOOK[id];
    if (!e) return 'base';
    var s = resolveStyle(id, st);
    if (id === 'house_cottage' || e.kind === 'style') return houseKey(s);
    if (id === 'att_course') return s.course;
    if (id === 'att_pitch') return s.ball + '|' + s.stadium;
    if (id === 'att_kart') return s.kart;
    if (e.kind === 'building' || own(V3_VARIANT, id)) return 'v:' + s.variant;
    if (e.kind === 'pet') return accKey(s.acc);
    if (e.kind === 'acc') return s.pet + '|' + accKey(s.acc);
    return 'base';
  }
  function heightOf(id, st) {
    var e = LOOK[id];
    if (!e) return 0;
    if (id === 'house_cottage') {
      var s = houseState(st), row = HOUSE_H[s.shape];
      return own(row, s.roof) ? row[s.roof] : row[SLOT_DEFAULTS.roof];
    }
    return e.h;
  }

  /* ---------------- deterministic variety (never random at purchase) ---------------- */
  /* FNV-1a 32-bit (the same hash as SLMotion.hash / SLGrid3D) */
  function fnv(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /* an independent [0, 1) value per (seed, n) */
  function mix01(seed, n) {
    var h = (seed ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /* the trim of one placed copy: FNV-1a(uid|id) modulo VARIANTS[id] (0 for single-look ids) */
  function variantOf(uid, id) {
    var n = variantCount(id);
    return n > 1 ? fnv(String(uid) + '|' + id) % n : 0;
  }
  function trimOf(id, variant) {
    var v = clampVariant(variant, id);
    return { accent: BUILDING_TRIMS.accent[v % 3], signSide: BUILDING_TRIMS.signSide[v % 2], stripe: BUILDING_TRIMS.stripe[v % 3] };
  }
  /* small decor turns by a fixed step only; organic items whose colour the CATALOG names
     (red apples, pink blossom and roses) keep their hue and vary lightness by ±4% only */
  var JITTER_RULES = {
    smallDecor: ['bench', 'umbrella', 'lantern', 'sandcastle', 'snowman', 'flag_pole', 'bunting'],
    smallDecorYaw: [-20, 0, 20],
    namedColour: ['tree_apple', 'tree_blossom', 'bush_rose'],
    neighbourYaw: 120, neighbourScale: 0.06,
    /* v3 voxel templates (jitterVox): organic kinds only, yaw in whole 90° steps, one uniform scale
       ±6%, lightness ±4% (never on namedColour ids), no lean (it would break the block grid);
       small decor and everything built stays square to the camera */
    vox: { organicKinds: ['tree', 'flower', 'bush', 'rock', 'mushroom'], yawStepDeg: 90, scale: 0.06, tint: 0.04, lean: 0 }
  };
  function identityJitter(out) {
    out.yaw = 0; out.sx = 1; out.sy = 1; out.sz = 1; out.lean = 0; out.leanAxis = 0; out.tint = null;
    return out;
  }
  function jitterBase(uid, id, out) {
    identityJitter(out);
    var e = LOOK[id];
    if (!e) return out;
    var s = fnv(String(uid) + '|' + id);
    if (ORGANIC_KINDS[e.kind]) {
      out.yaw = mix01(s, 0) * 360;
      out.sx = out.sz = Math.min(1.1, 0.9 + 0.2 * mix01(s, 1));
      out.sy = 0.88 + 0.24 * mix01(s, 2);
      if (e.kind === 'tree' || e.kind === 'flower') { out.lean = (mix01(s, 3) * 2 - 1) * 3; out.leanAxis = mix01(s, 4) * 360; }
      var named = JITTER_RULES.namedColour.indexOf(id) >= 0, foliage = !named && (e.kind === 'tree' || e.kind === 'bush');
      out.tint = { l: named ? 0.96 + 0.08 * mix01(s, 5) : 0.93 + 0.12 * mix01(s, 5), h: foliage ? (mix01(s, 6) * 2 - 1) * 5 : 0 };
    } else if (JITTER_RULES.smallDecor.indexOf(id) >= 0) out.yaw = JITTER_RULES.smallDecorYaw[s % 3];
    return out;
  }
  function uidOrder(a, b) {
    var ma = /^p(\d+)$/.exec(String(a)), mb = /^p(\d+)$/.exec(String(b));
    if (ma && mb) return (+ma[1]) - (+mb[1]);
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }
  var _nb = {};
  /* placement variety for one copy → {yaw (deg), sx, sy, sz, lean (deg), leanAxis (deg about
     +y), tint {l: lightness ×, h: hue °} | null}. Organic decor: full yaw, non-uniform scale,
     a lean (trees and flowers) and a tint; small decor: yaw from {-20, 0, +20}; anything
     else (houses, buildings, attractions, paths, fun) is the identity. A 4-adjacent copy of
     the same id with an EARLIER uid pushes this one +120° round and ≥ 0.06 the other way in
     scale, so neighbours never look cloned. */
  function jitter2(uid, id, sameIdNeighbours, out) {
    out = jitterBase(uid, id, out || {});
    var e = LOOK[id];
    if (!e || !ORGANIC_KINDS[e.kind] || !Array.isArray(sameIdNeighbours) || !sameIdNeighbours.length) return out;
    var first = null;
    sameIdNeighbours.forEach(function (n) { if (uidOrder(n, uid) < 0 && (first === null || uidOrder(n, first) < 0)) first = n; });
    if (first === null) return out;
    var nb = jitterBase(first, id, _nb), k = JITTER_RULES.neighbourScale;
    out.yaw = (nb.yaw + JITTER_RULES.neighbourYaw) % 360;
    out.sx = out.sz = nb.sx >= 1 ? Math.min(out.sx, nb.sx - k) : Math.max(out.sx, nb.sx + k);
    return out;
  }
  /* the earliest same-id neighbour uid that comes before uid, or null */
  function firstBefore(uid, list) {
    var first = null;
    if (!Array.isArray(list)) return null;
    list.forEach(function (n) { if (uidOrder(n, uid) < 0 && (first === null || uidOrder(n, first) < 0)) first = n; });
    return first;
  }
  function jitterVoxBase(uid, id, out) {
    var R = JITTER_RULES.vox, e = LOOK[id];
    out.yaw = 0; out.sx = 1; out.sy = 1; out.sz = 1; out.tl = 1; out.th = 0;
    if (!e || R.organicKinds.indexOf(e.kind) < 0) return out;
    var s = fnv(String(uid) + '|' + id), steps = 360 / R.yawStepDeg;
    out.yaw = R.yawStepDeg * Math.min(steps - 1, Math.floor(mix01(s, 0) * steps));
    out.sx = out.sy = out.sz = 1 + (mix01(s, 1) * 2 - 1) * R.scale;
    if (JITTER_RULES.namedColour.indexOf(id) < 0) out.tl = 1 + (mix01(s, 5) * 2 - 1) * R.tint;
    return out;
  }
  var _nbv = {};
  /* placement variety for one VOXEL copy → {yaw (deg: 0 | 90 | 180 | 270), sx = sy = sz (one
     uniform scale), tl (lightness ×), th (hue °, always 0)} — the kit's jitter fields. Organic
     kinds only (JITTER_RULES.vox); the identity for every other id. A 4-adjacent copy of the same
     id with an EARLIER uid turns this one a step further round and pushes its scale ≥ 0.06 the
     other way, so neighbours never look cloned. Deterministic per (uid, id). */
  function jitterVox(uid, id, sameIdNeighbours, out) {
    out = jitterVoxBase(uid, id, out || {});
    var e = LOOK[id], R = JITTER_RULES.vox;
    if (!e || R.organicKinds.indexOf(e.kind) < 0) return out;
    var first = firstBefore(uid, sameIdNeighbours);
    if (first === null) return out;
    var nb = jitterVoxBase(first, id, _nbv), k = R.scale;
    out.yaw = (nb.yaw + R.yawStepDeg) % 360;
    out.sx = out.sy = out.sz = nb.sx >= 1 ? Math.min(out.sx, nb.sx - k) : Math.max(out.sx, nb.sx + k);
    return out;
  }

  /* ---------------- path auto-tiling ----------------
     mask bits: N 1 · E 2 · S 4 · W 8 (N = -z). Canonical pieces at yaw 0: end opens N,
     straight N-S, corner N+E, tee N+E+W. yawDeg turns the piece about +y (three.js: +90°
     carries N onto W). */
  function rotMask(m) { return (m & 1 ? 8 : 0) | (m & 2 ? 1 : 0) | (m & 4 ? 2 : 0) | (m & 8 ? 4 : 0); }
  var PATH_PIECES = {};
  [['single', 0], ['end', 1], ['straight', 5], ['corner', 3], ['tee', 11], ['cross', 15]].forEach(function (c) {
    var m = c[1];
    for (var k = 0; k < 4; k++) { if (!PATH_PIECES[m]) PATH_PIECES[m] = { piece: c[0], yawDeg: 90 * k }; m = rotMask(m); }
  });
  function pathPiece(mask) { var p = PATH_PIECES[(mask | 0) & 15]; return { piece: p.piece, yawDeg: p.yawDeg }; }
  function shineLevel(price) {
    var p = price && typeof price === 'object' ? price.price : price;
    p = Number(p);
    if (!(p >= 0)) return 0;
    for (var i = SHINE_BANDS.length - 1; i > 0; i--) if (p >= SHINE_BANDS[i]) return i;
    return 0;
  }

  /* ---------------- light preset mixes ---------------- */
  /* A → B at k (clamped to 0..1). Colours come back as '#RRGGBB'; with a member hex each
     end's rim takes that preset's rimMember share of the member colour. */
  function mixPresets(A, B, k, member) {
    k = clamp01(+k || 0);
    var m = normHex(member), out = {};
    PRESET_KEYS.forEach(function (key) {
      var a = A[key], b = B[key];
      if (typeof a === 'string') {
        var ah = hex(a), bh = hex(b);
        if (key === 'rimColor' && m) { ah = mixHex(ah, m, A.rimMember); bh = mixHex(bh, m, B.rimMember); }
        out[key] = mixHex(ah, bh, k);
      } else if (Array.isArray(a)) out[key] = a.map(function (v, i) { return v + (b[i] - v) * k; });
      else out[key] = a + (b - a) * k;
    });
    return out;
  }
  /* k: 0 = golden hour (DUSK), 1 = Showtime */
  function presetAt(k, member) { return mixPresets(DUSK, SHOW, k, member); }
  /* the v1 pastel day → v1 Showtime mix, unchanged (games that copied the v1 island arc) */
  function presetV1At(k, member) { return mixPresets(DAY, SHOW_V1, k, member); }

  /* ---------------- v3 light mix ---------------- */
  /* a preset with every token resolved to '#RRGGBB' (the night's moon becomes the one 'sun'
     light; the day's rainbow is handled apart), so the mix below is plain hex / number maths */
  function resolveDeep(v) {
    if (typeof v === 'string') return hex(v);
    if (Array.isArray(v)) return v.map(resolveDeep);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = resolveDeep(v[k]); }); return o; }
    return v;
  }
  function resolvedPreset(P) {
    var r = resolveDeep(P);
    if (r.moon) { r.sun = r.moon; delete r.moon; }
    delete r.rainbow;
    return r;
  }
  var PX_RES = { DAY: resolvedPreset(PX_DAY), SUNSET: resolvedPreset(PX_SUNSET), NIGHT: resolvedPreset(PX_NIGHT) };
  var PX_RAINBOW = PX_DAY.rainbow.map(function (t) { return hex(t); });
  function mixDeep(a, b, t) {
    if (typeof a === 'string') return mixHex(a, b, t);
    if (typeof a === 'number') return a + (b - a) * t;
    if (Array.isArray(a)) return a.map(function (v, i) { return mixDeep(v, b[i], t); });
    if (a && typeof a === 'object') { var o = {}; Object.keys(a).forEach(function (k) { o[k] = mixDeep(a[k], b[k], t); }); return o; }
    return a;
  }
  /* k in 0..1 (clamped): 0 → 0.5 Daytime → sunset, 0.5 → 1 sunset → Showtime night, so 0, 0.5
     and 1 return the three presets exactly. Colours come back as '#RRGGBB' (mixed as v2's
     presetAt), numbers and arrays mixed, star counts whole. Added: k, sun (the one directional
     light: the sun, then the moon), moonK (0 until k 0.5, then 0 → 1), rainbow (hex ×6) and
     rainbowAlpha (1 by day, gone by k 0.35). */
  function pxPresetAt(k) {
    k = clamp01(+k || 0);
    var lo = k <= 0.5, t = lo ? k * 2 : k * 2 - 1;
    var out = mixDeep(lo ? PX_RES.DAY : PX_RES.SUNSET, lo ? PX_RES.SUNSET : PX_RES.NIGHT, t);
    Object.keys(out.starCounts).forEach(function (s) { out.starCounts[s] = Math.round(out.starCounts[s]); });
    out.k = k;
    out.moonK = lo ? 0 : t;
    out.rainbow = PX_RAINBOW.slice();
    out.rainbowAlpha = clamp01(1 - k / 0.35);
    return out;
  }
  /* one backdrop band (0 = top … 12 = horizon) at its own k (the band wipe) */
  function bandAt(i, k) {
    k = clamp01(+k || 0);
    return k <= 0.5 ? mixHex(PX_RES.DAY.bands[i], PX_RES.SUNSET.bands[i], k * 2)
      : mixHex(PX_RES.SUNSET.bands[i], PX_RES.NIGHT.bands[i], k * 2 - 1);
  }

  /* ---------------- frame luminance (flash-safety estimates; pure) ----------------
     luma(hex): WCAG relative luminance 0..1. frameLuma(k, isle, sky): the mean relative luminance
     of a full island frame at Showtime mix k. Home's curve is sky-world's design estimate (each
     preset's frameLuma: 0.60 day, 0.35 sunset, 0.14 night, mixed like every preset number); an
     other island (isle) and a sky part-way through the band wipe (sky = one k for every band, or
     13 per-band ks) scale it by a lit estimate: FRAME_MIX of the backdrop bands (unlit), the
     island's top and slab tokens under the preset's hemi + sun (three's Lambert, (hemi + sun N·L)
     / π, 65 / 35 top / front faces; no slab → its share is sky) and the accents (the item accents
     lit, the lamps' glow by windowGlow). Ice by day comes out ≈ 0.71 (sky-world: ≈ 0.72). */
  var LUM_W = [0.2126, 0.7152, 0.0722];
  var FACE_MIX = { top: 0.65, front: 0.35 };
  var LUMA_ACCENTS = ['PX Candy Pink', 'PX Sunny', 'PX Mint', 'PX Lilac', 'PX Coral', 'PX Sky Blue'];
  var LUMA_GLOWS = ['PX Lamp Warm', 'PX Bulb Warm'];
  var SUN_LEN = Math.sqrt(PX_SUN_POS[0] * PX_SUN_POS[0] + PX_SUN_POS[1] * PX_SUN_POS[1] + PX_SUN_POS[2] * PX_SUN_POS[2]);
  var SUN_UP = PX_SUN_POS[1] / SUN_LEN, SUN_FRONT = PX_SUN_POS[2] / SUN_LEN;
  var linCache = {};
  function srgbLin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function linOf(h) { return linCache[h] || (linCache[h] = hexToRgb(h).map(srgbLin)); }
  function luma(h) {
    var n = normHex(h);
    if (!n) return 0;
    var c = linOf(n);
    return LUM_W[0] * c[0] + LUM_W[1] * c[1] + LUM_W[2] * c[2];
  }
  function meanLuma(list) { var s = 0; list.forEach(function (h) { s += luma(h); }); return list.length ? s / list.length : 0; }

  /* ---------------- the vox exposure fit (crisp C1; pure) ----------------
     The vox materials are toneMapped false, so their exposure is the lights'. A lit up face gets
     (hemiI · hemi sky + sunI · sun · max(0, sunUp)) / π of its colour in three's Lambert (linear
     colours, physically based lights): Daytime's 1.55 white hemi + 2.5 sun at sunUp 0.785 gives
     1.118, and every pale token clipped to white. uVoxGain = min(1, target / top) brings the
     brightest channel back to exactly the token (0.894 by day: the mockup's #F2F2F8 base, within
     1%); a scene that is already dimmer (sunset, night, the photocard studio) keeps 1. */
  function voxTopGain(hemiI, hemiSkyLin, sunI, sunLin, sunUp) {
    var hi = +hemiI || 0, si = +sunI || 0, up = Math.max(0, +sunUp || 0), best = 0;
    for (var c = 0; c < 3; c++) {
      var g = (hi * (hemiSkyLin ? +hemiSkyLin[c] || 0 : 0) + si * (sunLin ? +sunLin[c] || 0 : 0) * up) / Math.PI;
      if (g > best) best = g;
    }
    return best;
  }
  function voxGain(hemiI, hemiSkyLin, sunI, sunLin, sunUp) {
    var top = voxTopGain(hemiI, hemiSkyLin, sunI, sunLin, sunUp);
    return top > VOX_EXPOSURE.target ? VOX_EXPOSURE.target / top : 1;
  }
  /* the gain of a v3 light mode: k in 0..1 (pxPresetAt), or a preset object (mixed, resolved or
     PX_DAY / PX_SUNSET / PX_NIGHT themselves: tokens resolve; the moon is their 'sun') */
  function pxVoxGain(k) {
    var P = k && typeof k === 'object' ? k : pxPresetAt(k), lit = P.sun || P.moon;
    function lin(t) { return linOf(normHex(t) || hex(t)); }
    return voxGain(P.hemi.intensity, lin(P.hemi.sky), lit.intensity, lin(lit.color), SUN_UP);
  }

  /* the lit estimate of one preset: hemi + sun on 65 % top / 35 % front faces, × the exposure fit
     (the vox program multiplies every lit voxel by uVoxGain), so LUMA_RULE sees the real frame */
  function lightOf(P) {
    var hs = linOf(P.hemi.sky), hg = linOf(P.hemi.ground), sc = linOf(P.sun.color), hi = P.hemi.intensity, si = P.sun.intensity;
    var gain = pxVoxGain(P);
    return [0, 1, 2].map(function (c) {
      var top = hi * hs[c] + si * sc[c] * SUN_UP, front = hi * 0.5 * (hs[c] + hg[c]) + si * sc[c] * SUN_FRONT;
      return gain * (FACE_MIX.top * top + FACE_MIX.front * front) / Math.PI;
    });
  }
  function litLuma(tokenList, L) {
    var s = 0;
    tokenList.forEach(function (t) {
      var c = linOf(hex(t));
      for (var i = 0; i < 3; i++) s += LUM_W[i] * Math.min(1, c[i] * L[i]);
    });
    return tokenList.length ? s / tokenList.length : 0;
  }
  function skyLuma(P, sky) {
    if (sky === undefined || sky === null) return meanLuma(P.bands);
    var s = 0;
    for (var i = 0; i < 13; i++) s += luma(bandAt(i, Array.isArray(sky) ? sky[i] : sky));
    return s / 13;
  }
  function rawFrame(P, isle, L, skyL) {
    var th = ISLE_THEME[isle], w = FRAME_MIX, glow = clamp01(P.windowGlow);
    var acc = litLuma(LUMA_ACCENTS, L) * (1 - glow) + meanLuma(LUMA_GLOWS.map(function (t) { return hex(t); })) * glow;
    var sea = th.slab ? w.water * litLuma(th.slab.tops, L) : 0, skyW = th.slab ? w.sky : w.sky + w.water;
    return skyW * skyL + w.land * litLuma(th.top, L) + sea + w.accents * acc;
  }
  function frameLuma(k, isle, sky) {
    var P = pxPresetAt(k), id = own(ISLE_THEME, isle) ? isle : 'home', L = lightOf(P), base = skyLuma(P);
    var home = rawFrame(P, 'home', L, base);
    var mine = id === 'home' && (sky === undefined || sky === null) ? home : rawFrame(P, id, L, skyLuma(P, sky));
    return clamp01(P.frameLuma * mine / home);
  }
  /* the full-screen luminance change from k0 to k1 over dtSec, as it lands in one LUMA_RULE
     window: the whole change when it takes ≤ windowSec (a cut counts in full), the steady rate ×
     windowSec when it takes longer. Sample an eased blend window by window (dtSec = windowSec). */
  function lumaStep(k0, k1, dtSec, isle) {
    var d = Math.abs(frameLuma(k1, isle) - frameLuma(k0, isle)), dt = +dtSec;
    return dt > LUMA_RULE.windowSec ? d * LUMA_RULE.windowSec / dt : d;
  }

  /* ---------------- token registry (D50) ---------------- */
  /* '#RRGGBB' for a plain token in any table (PALETTE, PALETTE_V2, PALETTE_V3, ART2D, EXTRA, a
     LOCKED path, a 'PETCOL3.<id>.<part>' mascot colour) or added by addTokens; null for '$slot'
     and '@member' tokens (they need a style: hex(token, st) resolves them) and for anything unknown */
  function resolve(token) {
    if (typeof token !== 'string' || token.charAt(0) === '@' || token.indexOf('$') >= 0) return null;
    return hex(token);
  }
  function inTables(name) {
    return own(PALETTE, name) || own(PALETTE_V2, name) || own(PALETTE_V3, name) || own(ART2D, name) || own(EXTRA, name);
  }
  var TOKEN_NAME = /^PX( [A-Za-z0-9]+)+$/;
  /* model-local tokens, registered at factory time: addTokens('px-landmarks', {'PX Wheel Peach':
     '#FFC9A0'}). A name must read 'PX <Words>' (letters / digits, ≤ 48 characters) and must not be
     in any table; the colour must be '#RRGGBB' and never #000000. The first registration wins:
     another source (or another colour) under the same name is refused as a collision; the same
     source re-registering the same colour is a no-op and reports it as added. Refusals are QA
     issues for the lab, never fatal. */
  function addTokens(source, map) {
    var out = { added: [], refused: [] }, src = typeof source === 'string' && source ? source : null;
    Object.keys(map && typeof map === 'object' ? map : {}).forEach(function (name) {
      var v = map[name], n = typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null, why = null;
      if (!src) why = 'source';
      else if (!TOKEN_NAME.test(name) || name.length > 48) why = 'name';
      else if (!n) why = 'hex';
      else if (n === '#000000') why = 'black';
      else if (own(ADDED, name)) why = ADDED[name].source === src && ADDED[name].hex === n ? null : 'collision';
      else if (inTables(name)) why = 'collision';
      if (why) { out.refused.push({ name: name, why: why }); return; }
      if (!own(ADDED, name)) {
        ADDED[name] = { hex: n, source: src };
        (ADDED_BY[src] = ADDED_BY[src] || []).push(name);
      }
      out.added.push(name);
    });
    return out;
  }
  /* {name: '#RRGGBB'} added by one source, or by every source when none is given */
  function tokens(source) {
    var o = {};
    var list = source === undefined ? Object.keys(ADDED) : (own(ADDED_BY, source) ? ADDED_BY[source] : []);
    list.forEach(function (n) { o[n] = ADDED[n].hex; });
    return o;
  }

  /* ---------------- v3 caps ---------------- */
  /* the LOD0 triangle cap for one id at a tier ('LOW' | 'MID' | 'HIGH'): its own TRIS_CAPS entry
     (the v3 ids, bld_stage) or its LOOK kind's class; v3 ids add TRIS_DETAIL on MID / HIGH
     (isleLandmarks never past TRIS_CAPS.isleLandmark); at LOW an id with a TRIS_CAPS_LOW entry
     (its own trisLow, else its organic kind's) meets that */
  function trisCap(id, tier) {
    var e = LOOK[id];
    if (!e) return 0;
    var mine = own(TRIS_CAPS, id), cap = mine ? TRIS_CAPS[id] : (TRIS_CAPS[TRIS_CLASS[e.kind]] || 0);
    if (mine && tier !== 'LOW' && own(TRIS_DETAIL, e.kind) && own(V3_SET, id)) cap += TRIS_DETAIL[e.kind];
    if (e.kind === 'isleLandmark') cap = Math.min(cap, TRIS_CAPS.isleLandmark);
    if (tier === 'LOW') {
      var low = own(TRIS_CAPS_LOW, id) ? TRIS_CAPS_LOW[id] : own(TRIS_CAPS_LOW, e.kind) ? TRIS_CAPS_LOW[e.kind] : null;
      if (low !== null) cap = Math.min(cap, low);
    }
    return cap;
  }
  /* TRIS_CAPS_LOD1(id): the triangle cap of a v3 placeable's 'vox-lod1' template (D106), the model
     the visited island falls back to when it is over its triangle budget: 35% of the id's tris,
     and never over 120 for repeatable decor, so it is always ≤ the id's LOW cap. null = no cap:
     paths (a tile is its own LOD1), and anything that is not a v3 placeable (V4.54 ids keep the
     LOD1 their models have; lands, mascots and gear have none). The capped ids can also be read
     as a table, TRIS_CAPS_LOD1[id], like TRIS_CAPS and TRIS_CAPS_LOW. */
  function trisCapLod1(id) {
    var e = LOOK[id];
    if (!e || !own(V3_SET, id) || !PLACED_KINDS[e.kind] || e.kind === 'path') return null;
    var cap = Math.floor(e.tris * TRIS_LOD1.sharePct / 100);
    return TRIS_LOD1.decorClasses[TRIS_CLASS[e.kind]] ? Math.min(TRIS_LOD1.decorMax, cap) : cap;
  }
  V3_IDS.forEach(function (id) { var cap = trisCapLod1(id); if (cap !== null) trisCapLod1[id] = cap; });
  Object.freeze(trisCapLod1);
  /* the height cap for an id: ISLAND_ITEM_MAX_H for LOOK kind 'isleLandmark', else ITEM_MAX_H */
  function itemMaxH(id) { var e = LOOK[id]; return e && e.kind === 'isleLandmark' ? ISLAND_ITEM_MAX_H : ITEM_MAX_H; }

  /* the tables are a shared contract (entries share sub-objects): freeze them so a
     consumer can never change another chunk's look by accident */
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  [PALETTE, PALETTE_V2, LOCKED, ART2D, EXTRA, LOOK, CHARACTERS, DUSK, SHOW, DAY, SHOW_V1, PRESET_KEYS, PRESET_COLOR_KEYS,
   TEMPO, FX, MATERIAL, MATCAPS, EDIT, CONES, BUDGET, SHINE_BANDS, SHINE_NAMES, SLOT_DEFAULTS, KINDS, ORGANIC_KINDS,
   OUTLINE_KINDS, PLACED_KINDS, ACT_PIVOT, LAUNCH_PIVOT, PET_BONES, PET_SOCKETS, SIGN_WORDS, NEON3, NEON4,
   SHAPES, HOUSE_H, HOUSE_TRIS, VARIANTS, BUILDING_TRIMS, JITTER_RULES, PATH_PIECES,
   /* v3 (the addTokens registry stays open: ADDED, ADDED_BY) */
   PALETTE_V3, ART3, VOX_FOG, VOX_EXPOSURE, PREVIEW, GRAIN, TRIS_CAPS, TRIS_CAPS_LOW, TRIS_DETAIL, TRIS_CLASS, PIXEL_STUDIO, ISLE_THEME,
   PX_DAY, PX_SUNSET, PX_NIGHT, PX_RES, PX_SUN_POS, PX_RAINBOW, SHOW_BLEND, LUMA_RULE, FRAME_MIX, V3_IDS, V3_VARIANT_IDS,
   V3_VARIANT, V3_SET, PETCOL3, SPECIES3, SLOT_CAPS, TRIS_LOD1, GROUND_TOKENS, PX_TWICE, KU_IDS, KU_SET].forEach(deepFreeze);

  return {
    LOOK_VERSION: LOOK_VERSION, MAX_FLASH_HZ: MAX_FLASH_HZ, LED_CHASE_HZ: LED_CHASE_HZ, SIGN_WORDS: SIGN_WORDS,
    PALETTE: PALETTE, PALETTE_V2: PALETTE_V2, LOCKED: LOCKED, ART2D: ART2D, EXTRA: EXTRA,
    LOOK: LOOK, CHARACTERS: CHARACTERS, MEMBER_FALLBACK: MEMBER_FALLBACK,
    DUSK: DUSK, SHOW: SHOW, DAY: DAY, SHOW_V1: SHOW_V1, PRESET_KEYS: PRESET_KEYS, PRESET_COLOR_KEYS: PRESET_COLOR_KEYS,
    presetAt: presetAt, presetV1At: presetV1At,
    TEMPO: TEMPO, FX: FX, MATERIAL: MATERIAL, MATCAPS: MATCAPS, EDIT: EDIT, CONES: CONES, BUDGET: BUDGET,
    SHINE_BANDS: SHINE_BANDS, SHINE_NAMES: SHINE_NAMES, SLOT_DEFAULTS: SLOT_DEFAULTS,
    KINDS: KINDS, ORGANIC_KINDS: ORGANIC_KINDS, OUTLINE_KINDS: OUTLINE_KINDS, PLACED_KINDS: PLACED_KINDS,
    ACT_PIVOT: ACT_PIVOT, LAUNCH_PIVOT: LAUNCH_PIVOT, PET_BONES: PET_BONES, PET_SOCKETS: PET_SOCKETS,
    NEON3: NEON3, NEON4: NEON4, HOUSE_SHAPES: SHAPES, HOUSE_H: HOUSE_H, HOUSE_TRIS: HOUSE_TRIS,
    VARIANTS: VARIANTS, BUILDING_TRIMS: BUILDING_TRIMS, JITTER_RULES: JITTER_RULES,
    hex: hex, isToken: isToken, tokensIn: tokensIn, colorsFor: colorsFor, heightOf: heightOf,
    houseState: houseState, resolveStyle: resolveStyle, stateKey: stateKey, houseBudget: houseBudget, shineLevel: shineLevel,
    variantOf: variantOf, trimOf: trimOf, jitter2: jitter2, pathPiece: pathPiece,
    normHex: normHex, mixHex: mixHex, tone: tone,
    /* v3 */
    PALETTE_V3: PALETTE_V3, V3_IDS: V3_IDS, V3_VARIANT_IDS: V3_VARIANT_IDS, ISLE_THEME: ISLE_THEME,
    GROUND_TOKENS: GROUND_TOKENS, PX_TWICE: PX_TWICE,
    PX_DAY: PX_DAY, PX_SUNSET: PX_SUNSET, PX_NIGHT: PX_NIGHT, PX_SUN_POS: PX_SUN_POS, pxPresetAt: pxPresetAt,
    SHOW_BLEND: SHOW_BLEND, LUMA_RULE: LUMA_RULE, FRAME_MIX: FRAME_MIX, frameLuma: frameLuma, lumaStep: lumaStep, luma: luma,
    VOX_EXPOSURE: VOX_EXPOSURE, voxTopGain: voxTopGain, voxGain: voxGain, pxVoxGain: pxVoxGain,
    ART3: ART3, VOX_FOG: VOX_FOG, PREVIEW: PREVIEW, GRAIN: GRAIN, PIXEL_STUDIO: PIXEL_STUDIO, CREW_SCALE: CREW_SCALE,
    TRIS_CAPS: TRIS_CAPS, TRIS_CAPS_LOW: TRIS_CAPS_LOW, TRIS_DETAIL: TRIS_DETAIL, TRIS_CLASS: TRIS_CLASS, trisCap: trisCap,
    ITEM_MAX_H: ITEM_MAX_H, ISLAND_ITEM_MAX_H: ISLAND_ITEM_MAX_H, itemMaxH: itemMaxH,
    resolve: resolve, addTokens: addTokens, tokens: tokens, jitterVox: jitterVox,
    /* v3 land shops */
    PETCOL3: PETCOL3, SPECIES3: SPECIES3, SLOT_CAPS: SLOT_CAPS, TRIS_LOD1: TRIS_LOD1, TRIS_CAPS_LOD1: trisCapLod1,
    /* the kids update */
    KU_IDS: KU_IDS
  };
}));
