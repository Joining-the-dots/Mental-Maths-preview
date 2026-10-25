/* ================================================================
   Game C — Neon Grand Prix (unlocked by the Kart Garage).
   The race rules live in kart-logic.js (pure, Node-tested); this file
   wires them into the game shell: options (Race / Solo, Stage class,
   Easy Drive, camera) saved per profile, touch pads with spark-tier
   glow, the event → sound map, the engine purr, the results copy and
   the 2D top-down renderer (the fallback whenever 3D isn't running).
   A lap still only counts through gates 1-2-3 then the line, and the
   score is still the honest race clock.
   V4.55: the course menu, and the sounds, words and 2D drawing of
   everything on a Remix course's road. With a cached V4.54
   kart-logic.js (no API mark) the game is the V4.54 one.
   V4.55 fix run (25 Oct 2026): every owned track's Classic is on the
   menu and a new driver starts there, the Remix being the next step
   (B1); two short How-to-play cards, the rest as first-time tips in
   the race, and the Glow Crew and Camera rows under "More options"
   until the first finish (B5); '⬇ Brake', the place shown once (B11);
   a TV camera that is saved as TV, one name per camera; the results
   say what happened and one next step, the numbers behind "Details".
   V4.55 Race together: the menu button (the lobby and the race
   network are loaded only when it is tapped), and the live round the
   lobby hands over (cfg.kartLive): the other children's karts, the
   finish sent once, no pause, and the shared results table. Nothing
   about another child is kept anywhere but in this round's memory.
   Kids update (KG7): '⚔️ Challenge' and '🔑 Join with a code' beside
   Race together when the host offers challenges (cfg.duels); both go
   into the Race together sheets with a room addressed by a game word
   (kart-lobby.js). A family pop-up's Join launches the game with
   cfg.challenge = {join: 'FROG'}. After a hard race, one kind coach
   line (GP-2).
   Kids update (KU-CH19b): with a character (cfg.char) the 2D kart's
   driver is the child's head from above, their pet's ears or wing tips
   behind it (driverLook / riderLook). Drawing only.
   ================================================================ */
(function () {
  'use strict';
  var Shell = (typeof window !== 'undefined') ? window.SLGameShell : null;
  var inNode = typeof module === 'object' && module.exports && typeof require === 'function';
  var KL = inNode ? require('./kart-logic.js') : ((typeof window !== 'undefined' && window.SLKartLogic) || null);
  /* kart-logic.js normally loads first (GAMES.kart.deps); preload() fetches it if not */
  function logic() { if (!KL && typeof window !== 'undefined') KL = window.SLKartLogic || null; return KL; }
  var LW = 960, LH = 540;
  var NEON_CYAN = '#3DF2FF', NEON_PINK = '#FF4FB8', STAR_GOLD = '#FFD23F', CORAL = '#FF6B6B', LEAF_MINT = '#7BD88F', PEBBLE = '#CFC8DC', INK = '#3b2f4a';
  var TIER_COL = [PEBBLE, NEON_CYAN, NEON_PINK, STAR_GOLD];
  var LIME = '#B8F24B', VIOLET = '#B48CFF', SAND = '#E9CF88';
  /* sticky patch colours by skin (each also has a pale outline, so colour is never the only sign) */
  var GOO = { bubblegum: '#FF8FC8', 'toffee-lava': '#F2A03D', seaweed: '#3FA66B', 'wet-sand': '#B98F54' };
  function own(o, key) { return !!o && Object.prototype.hasOwnProperty.call(o, key); }

  /* ---------- per-profile options: localStorage 'slKart:v1:<profileKey>' ----------
     V4.55 fix run: 'tv' is a camera that is saved too (it used to fall back to the one before it,
     so the next game opened top-down); course = the course this profile last raced (a device's
     'slgVar:kart' is shared by brothers and sisters); tips = the first-time race tips already shown
     (TIP bits). An older kart.js reads none of the new fields and keeps working. */
  var OPT_KEY = 'slKart:v1:', MODES = ['race', 'solo'], CAMS = ['chase', 'stage', 'map', 'tv'];
  var TIP = { strip: 1, drift: 2, trick: 4 }, TIP_ALL = 7;
  /* the first-time race tips (makeRound's tipsStep): what each says, how long it stays (s), the gap
     after one, the earliest race time for the first one and for the bend one, and the bend (rad over
     170 px, 220 px ahead) that counts — Island Loop's sharpest is 0.59 */
  var TIP_TEXT = {
    strip: '⏩ Drive over the arrow strips for a boost!',
    trick: '🤸 Tap ✨ in the air off the ramp for a trick!',
    drift: '↪️ In a bend, hold ✨ to drift. Let go for a boost!'
  };
  var TIP_SEC = 3.5, TIP_GAP = 2, TIP_FIRST = 1.5, TIP_DRIFT_T = 5, TIP_BEND = 0.5;
  function pbMs(cfg, variant) { var r = cfg && cfg.pb && cfg.pb['kart:' + variant]; return r && r.ms != null ? r.ms : null; }
  function hasKartPb(cfg) { return Object.keys((cfg && cfg.pb) || {}).some(function (k) { return k.indexOf('kart:') === 0 && cfg.pb[k] && cfg.pb[k].ms != null; }); }
  /* this page session's copy of each profile's options, for when localStorage is blocked */
  var memo = {};
  function loadOpts(cfg) {
    cfg = cfg || {};
    if (cfg.kartOpts) return cfg.kartOpts;
    var stored = null, key = cfg.profileKey;
    if (key != null) {
      var raw, readable = true;
      try { raw = localStorage.getItem(OPT_KEY + key); } catch (e) { readable = false; }
      if (readable) { try { stored = JSON.parse(raw || 'null'); } catch (e) { stored = null; } }
      else stored = memo[key] || null;
    }
    /* Easy Drive defaults on for a profile that has never set a kart time … */
    var o = { mode: 'race', cls: 0, easy: key != null ? !hasKartPb(cfg) : false, cam: 'chase' };
    var valid = !!stored && typeof stored === 'object';
    if (valid) {
      if (MODES.indexOf(stored.mode) >= 0) o.mode = stored.mode;
      if (stored.cls === 0 || stored.cls === 1 || stored.cls === 2) o.cls = stored.cls;
      if (typeof stored.easy === 'boolean') o.easy = stored.easy;
      if (CAMS.indexOf(stored.cam) >= 0) o.cam = stored.cam;
      /* V4.55: the How-to-play cards with the Remix wording were shown (the key is only there once they were) */
      if (stored.remixSeen === true) o.remixSeen = true;
      /* V4.55 fix run (each key only there once it was set): the last course raced, the tips shown */
      if (typeof stored.course === 'string' && stored.course.length <= 40) o.course = stored.course;
      if (stored.tips === (stored.tips & TIP_ALL) && stored.tips > 0) o.tips = stored.tips;
    }
    /* … and from then on it is the child's last choice (spec-kart MENU OPTIONS): the default is
       saved the first time it is read, so finishing race 1 (which sets a kart time) never turns
       Easy Drive off behind their back — only the menu chip does */
    if (key != null && !(valid && typeof stored.easy === 'boolean')) { saveOpts(cfg, o); return o; }
    cfg.kartOpts = o;
    return o;
  }
  function saveOpts(cfg, o) {
    cfg.kartOpts = o;
    if (cfg.profileKey == null) return;
    var m = memo[cfg.profileKey] = { mode: o.mode, cls: o.cls, easy: o.easy, cam: o.cam };
    if (o.remixSeen) m.remixSeen = true;
    if (typeof o.course === 'string') m.course = o.course;
    if (o.tips > 0) m.tips = o.tips;
    try { localStorage.setItem(OPT_KEY + cfg.profileKey, JSON.stringify(m)); } catch (e) {}
  }
  /* V4.55 courses: are they in the loaded race logic? (a cached V4.54 kart-logic.js has no API mark;
     the game then offers the classic tracks exactly as V4.54 did) */
  function coursesOn() { var L = logic(); return !!L && L.API >= 2 && typeof L.courseIds === 'function'; }
  function qaCopy() { return typeof window !== 'undefined' && window.SL_QA_COPY === true; }
  /* a Stage class is open on a course from the best on that course, or on the classic track whose
     road it uses (a Headliner on Island Loop stays one on Island Loop Remix) */
  function clsOpen(cfg, variant, cls) {
    var L = logic(), base = coursesOn() ? L.courseBase(variant) : null;
    return L.classUnlocked(variant, pbMs(cfg, variant), cls) || (!!base && base !== variant && L.classUnlocked(base, pbMs(cfg, base), cls));
  }
  /* the chosen class, or Trainee while it is still locked on this track */
  function effCls(cfg, o, variant) { return o.cls && clsOpen(cfg, variant, o.cls) ? o.cls : 0; }
  /* the shell keeps the chosen track to itself; mirror it into cfg.variant so the
     menu rows (class unlocks) and the idle frame follow the track chips. The function
     wrapped here (the island's own "select this track") is kept as cfg._kartIslandSelect. */
  function hookVariant(cfg) {
    if (!cfg || cfg._kartVarHook) return;
    var orig = cfg.onSelectVariant;
    cfg._kartIslandSelect = typeof orig === 'function' ? orig : null;
    cfg.onSelectVariant = function (vid) { cfg.variant = vid; if (orig) return orig.apply(this, arguments); };
    cfg._kartVarHook = true;
  }

  /* ---------- the course menu (V4.55) ---------- */
  /* the classic tracks this child owns (Island Loop comes with the Kart Garage) */
  function ownedTracks(cfg) {
    var L = logic(), ids = ((cfg && cfg.ownedVariants) || []).map(function (v) { return v && v.id; }).filter(function (id) { return own(L.TRACKS, id); });
    return ids.length ? ids : [def.defaultVariant];
  }
  /* the best medal (0 to 4) this child holds on any Remix course */
  function remixMedal(cfg) {
    var L = logic(), best = 0;
    L.courseIds().forEach(function (id) { if (L.isCourse(id) && L.courseBase(id)) best = Math.max(best, L.medalFor(id, pbMs(cfg, id))); });
    return best;
  }
  /* The course chips, in order (V4.55 fix run B1: new drivers start on Classic, the Remix is the next
     step): for each owned track, in the tracks' own order, 'Classic: <track>' and then its Remix;
     then each new road behind its unlock rule (Starlight Twist: a Bronze time on any Remix course).
     A course with no medal times shows no medal. */
  function menuVariants(cfg) {
    var L = logic(), ids = L.courseIds(), owned = ownedTracks(cfg), out = [];
    function chip(id, name, more) {
      var ms = pbMs(cfg, id), c = { id: id, name: name, medal: ms != null && L.PAR[id] ? L.MEDALS[L.medalFor(id, ms)].icon : '', best: ms };
      if (more) { c.locked = true; c.lockText = more; }
      out.push(c);
    }
    ids.forEach(function (base) {
      if (L.isCourse(base) || owned.indexOf(base) < 0) return;
      chip(base, 'Classic: ' + L.courseName(base));
      ids.forEach(function (id) { if (L.isCourse(id) && L.courseBase(id) === base) chip(id, L.courseName(id)); });
    });
    ids.forEach(function (id) {
      if (!L.isCourse(id) || L.courseBase(id)) return;
      var u = L.COURSES[id].unlock, M = u ? L.MEDALS[u.medal] : null;
      chip(id, L.courseName(id), M && remixMedal(cfg) < u.medal ? 'Get a ' + M.icon + ' ' + M.name + ' time on any Remix course' : '');
    });
    return out;
  }
  /* the Remix of a classic track, or null */
  function remixOf(base) {
    var L = logic(), hit = null;
    L.courseIds().forEach(function (id) { if (!hit && L.isCourse(id) && L.courseBase(id) === base) hit = id; });
    return hit;
  }
  /* The island's track model follows the course a child races. Called when a round of the child's
     own starts on the menu's course: a course whose classic track the child owns, and which is not
     the one the island shows, selects that track there — through the island's own function, never
     the wrapper above, so cfg.variant (the class rows, the lock notes, the idle picture) stays the
     course. Not for a shared race, a shop preview, or a round given its own course (opts.variant). */
  function islandSync(cfg, variant) {
    if (!cfg || cfg.demo || cfg.kartLive || cfg._kartIsland == null || variant !== cfg.variant || !coursesOn() || typeof cfg._kartIslandSelect !== 'function') return;
    var base = logic().courseBase(variant);
    if (!base || base === cfg._kartIsland || ownedTracks(cfg).indexOf(base) < 0) return;
    cfg._kartIsland = base;
    try { cfg._kartIslandSelect(base); } catch (e) {}
  }
  /* the child's own round on the menu's course: this profile's course, for the next start */
  function rememberCourse(cfg, variant) {
    if (!cfg || !cfg._kartStart || cfg.demo || cfg.profileKey == null || variant !== cfg.variant) return;
    var o = loadOpts(cfg);
    if (o.course !== variant) { o.course = variant; saveOpts(cfg, o); }
  }
  /* Before the shell starts the game (its start is wrapped below):
     - the island's selected track is remembered, and the game opens (V4.55 fix run B1) for a new
       driver — no kart time anywhere yet — on the island's track itself, its Classic; for anyone
       else on the course this profile raced last, else the one this device chose last, else that
       Classic too. cfg.variant is what the game opens on, and the device's 'slgVar:kart' is set to
       match (the shell reads it, and it may be a brother's or sister's choice);
     - the How-to-play cards are shown once more to a child who saw the V4.54 ones: cfg.tutSeen counts
       as false until this profile's remixSeen option is set, which closing the cards does;
     - on the test copy (window.SL_QA_COPY) a finished course round is not saved. */
  function onStart(cfg) {
    syncDef();
    if (!cfg || cfg._kartStart || !coursesOn()) return;
    cfg._kartStart = true;
    hookVariant(cfg);
    var L = logic(), list = menuVariants(cfg), stored = null, fresh = !hasKartPb(cfg), mine = loadOpts(cfg).course, pick;
    function open(id) { return id != null && list.some(function (v) { return v.id === id && !v.locked; }); }
    cfg._kartIsland = own(L.TRACKS, cfg.variant) ? cfg.variant : L.courseBase(cfg.variant);
    try { stored = localStorage.getItem('slgVar:' + def.key); } catch (e) { stored = null; }
    if (!fresh && open(mine)) pick = mine;
    else if (!fresh && open(stored)) pick = stored;
    else if (open(cfg._kartIsland)) pick = cfg._kartIsland;
    else pick = open(cfg.variant) ? cfg.variant : (list.filter(function (v) { return !v.locked; })[0] || list[0] || { id: cfg.variant }).id;
    cfg.variant = pick;
    if (stored !== pick && pick != null) { try { localStorage.setItem('slgVar:' + def.key, pick); } catch (e) { /* the shell opens on cfg.variant then */ } }
    if (!loadOpts(cfg).remixSeen) {
      var seen = cfg.onTutorialSeen;
      cfg.tutSeen = false;
      cfg.onTutorialSeen = function () {
        var o = loadOpts(cfg);
        o.remixSeen = true; saveOpts(cfg, o);
        if (typeof seen === 'function') return seen.apply(this, arguments);
      };
    }
    if (qaCopy() && typeof cfg.onResult === 'function') {
      var save = cfg.onResult;
      cfg.onResult = function (variant) {
        if (coursesOn() && logic().isCourse(variant)) return { ok: false, isPB: false };
        return save.apply(this, arguments);
      };
    }
  }
  /* Does this launch show the 3D view (so the menu offers the Camera row)? The shell renders the
     FIRST menu before it mounts the view, so the answer can't wait for the view's canvas:
       cfg.view3d true / false — set by kart-3d.js once its view is up / gone (or failed);
       otherwise — the shell's own can3d() test: WebGL2 + the 3D loader, and 3D not switched off
       for this device or session. A load that later fails sets cfg.view3d = false (or
       'slNo3dGame'), so the next menu drops the row again. */
  function expect3d(cfg) {
    if (!cfg || cfg.demo || !def.view3d) return false;
    if (typeof window === 'undefined') return false;
    try { if (localStorage.getItem('slNo3D') === '1' || sessionStorage.getItem('slNo3dGame') === '1') return false; } catch (e) { /* storage blocked: no opinion */ }
    return typeof window.WebGL2RenderingContext !== 'undefined' && typeof window.slLoad3D === 'function';
  }
  function view3dOn(cfg) {
    if (cfg && cfg.view3d === true) return true;
    if (cfg && cfg.view3d === false) return false;
    try { if (typeof document !== 'undefined' && document.querySelector('.slg .slg-gl')) return true; } catch (e) { /* no DOM */ }
    return expect3d(cfg);
  }

  /* ---------- engine purr: one original synth voice for the player kart ---------- */
  var purr = null;
  function purrStart() {
    if (purr || typeof getAudioCtx !== 'function') return;
    try {
      var ctx = getAudioCtx(); if (!ctx || !ctx.createOscillator) return;
      var osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 70; lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
      osc.connect(lp); lp.connect(g); g.connect(ctx.destination);
      /* drift 'shhh': looping band-passed noise (deterministic fill) */
      var buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = buf.getChannelData(0), x = 22222;
      for (var i = 0; i < data.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; data[i] = ((x >>> 0) / 4294967296) * 2 - 1; }
      var nz = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      nz.buffer = buf; nz.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; ng.gain.value = 0;
      nz.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
      osc.start(); nz.start();
      purr = { ctx: ctx, osc: osc, g: g, nz: nz, ng: ng };
    } catch (e) { purr = null; }
  }
  function purrSet(v, boost, drift, level) {
    if (!purr) return;
    try {
      var t = purr.ctx.currentTime, av = Math.min(350, Math.abs(v));
      purr.osc.frequency.setTargetAtTime((70 + 0.26 * Math.min(270, av)) * (boost ? 1.335 : 1), t, 0.05);
      purr.g.gain.setTargetAtTime(0.03 * (0.4 + 0.6 * Math.min(1, av / 270)) * level, t, 0.06);
      purr.ng.gain.setTargetAtTime(drift ? 0.02 * level : 0, t, 0.05);
    } catch (e) {}
  }
  function purrStop() {
    if (!purr) return;
    var p = purr; purr = null;
    try { var t = p.ctx.currentTime; p.g.gain.setTargetAtTime(0, t, 0.05); p.ng.gain.setTargetAtTime(0, t, 0.05); p.osc.stop(t + 0.4); p.nz.stop(t + 0.4); } catch (e) {}
  }

  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  /* the next step after a first Classic finish (V4.55 fix run B1): the line, and its button */
  var REMIX_NEXT = 'Try the Remix: more obstacles!', REMIX_GO = '🔀 Try the Remix: more obstacles', REMIX_AGAIN = '↻ Race Classic again';
  function TIME_UP(laps) { return 'Time’s up — great driving! Finish all ' + laps + ' laps to set a time.'; }
  /* a game shell of API 3 (V4.55 fix run) lays out the results itself: nextStep, Details, nextVariant, hud3d */
  function shell3() { return !!Shell && Shell.API >= 3; }
  var MEDAL_KIND = ['ribbon', 'bronze', 'silver', 'gold', 'crown'];

  /* ---------- after a hard race: one kind coach line (GP-2) ----------
     Only after a finished race that earned no medal: a medal race already gets its nudge, and the
     V4.54 results of a medal race stay word for word. The first that fits, in this order: three or
     more knock-overs (with Easy Drive on, the Glow Line goes round them), three or more wall
     scrapes, no Spark Boost at all. Each says what to try next; none says fail, lose, bad or wrong. */
  var COACH = {
    bumps: 'You bumped {n} things — the Glow Line in Easy Drive goes round them.',
    easy: 'Follow the Glow Line round the {things}.',
    walls: 'Ease off in the bends: ⬇ brakes a bit before the turn.',
    spark: 'Hold ✨ in a bend until the sparks go pink, then let go for a boost!'
  };
  var COACH_SEP = '\n💡 ';                    /* in the summary text: a line break, then the tip */
  /* what a course's knock-over things and crossers are called, by their look */
  var THINGS = { cone: 'cones', crystal: 'crystals', sandcastle: 'sandcastles', 'stage-bot': 'stage-bots', 'lava-rock': 'lava rocks', crab: 'crabs' };
  function thingsOf(F) {
    var sk = (F && F.skins) || {}, out = [];
    if ((F.obstacles || []).length) out.push(THINGS[sk.obstacle] || 'cones');
    if ((F.crossers || []).length) out.push(THINGS[sk.crosser] || 'crossers');
    return out.join(' and ') || 'cones';
  }
  /* On the results sheet the coach line leaves the long stats line and gets a line of its own under
     the medals, in lemon ink (contrast over 12:1 on the sheet), so a child sees the tip first. The
     shell's summary text keeps it (it is read out with the rest). */
  function coachShow(el, line) {
    var sc = el && el.parentNode, p = null, d, tip;
    try { p = sc ? sc.querySelector('p') : null; } catch (e) { p = null; }
    if (!p || !line) return;
    if (typeof p.textContent === 'string' && p.textContent.indexOf(COACH_SEP) >= 0) p.textContent = p.textContent.split(COACH_SEP)[0];
    d = el.ownerDocument || document;
    tip = d.createElement('p');
    tip.className = 'slg-coach';
    tip.textContent = COACH_SEP.slice(1) + line;
    if (tip.style) { tip.style.color = '#ffe27a'; tip.style.fontWeight = '800'; }
    sc.insertBefore(tip, el);
  }

  /* ---------- a round ---------- */
  /* the shell's hook: a round the child plays (the idle picture builds one too, through makeRound).
     A shared race's session is read here, and only here: the lobby sets cfg.kartLive for the one
     beginRound call that starts it. */
  function newRound(api, variant, cfg) {
    var ses = liveSession(cfg);
    islandSync(cfg, variant);
    if (!ses) rememberCourse(cfg, variant);
    return makeRound(api, variant, cfg, ses, true);
  }
  /* mine: a round the child plays (newRound), not the idle picture: only it shows first-time tips */
  function makeRound(api, variant, cfg, ses, mine) {
    api = api || { sound: function () {} };
    cfg = cfg || {};
    var L = logic(), MEDALS = L.MEDALS;
    var o = loadOpts(cfg), prevPb = pbMs(cfg, variant), remixBefore = !cfg.demo && coursesOn() ? remixMedal(cfg) : 0;
    var demo = !!cfg.demo, style = demo || !!cfg.autoStyle;
    var mode = demo || ses ? 'race' : o.mode, cls = demo ? (L.PAR[variant] ? 1 : 0) : ses ? 0 : effCls(cfg, o, variant);
    /* the Stage classes open before this round (its result may open one: the nudge says so) */
    var open1 = clsOpen(cfg, variant, 1), open2 = clsOpen(cfg, variant, 2);
    /* a shared race: the other children (named from the roster by the session) and the crew the starter chose */
    var race = ses ? L.newRace(variant, { net: liveNet(ses), easy: !!o.easy, reduced: !!api.reduced })
      : L.newRace(variant, { mode: mode, cls: cls, easy: !demo && !!o.easy, pbMs: prevPb, reduced: !!api.reduced });
    var lv = null;
    race.wantEvents = true;
    var track = race.track, k = race.k, pr = race.pr, s = race.s, LAPN = track.laps;
    var arts = (typeof window !== 'undefined' && window.SLWorldArt) || {};
    function hex(c, dflt) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : dflt; }
    var kartCol = hex((arts.KARTS || {})[cfg.kart], '#e94b4b');
    var sigCol = hex(cfg.user && cfg.user.color, '#6C5CE7');
    var petCol = hex(((arts.PETCOL || {})[cfg.pet && cfg.pet.id] || (arts.PETCOL3 || {})[cfg.pet && cfg.pet.id] || {}).body, STAR_GOLD);
    /* KU-CH19b: the child at the wheel in 2D, their pet behind (null: V4.55's pet-coloured head) */
    var drv2d = driverLook(cfg), rider2d = drv2d ? riderLook(cfg, arts) : null;
    var held = {}, fxq = [], realT = 0, later = [], lastSkid = -9, lastChip = -9, lastPip = 0, purrN = 0, lastGap = null;
    var cam = { x: 0, y: 0 };
    function camTarget() { return [Math.max(0, Math.min(L.WW - LW, k.x + Math.cos(k.h) * 90 - LW / 2)), Math.max(0, Math.min(L.WH - LH, k.y + Math.sin(k.h) * 60 - LH / 2))]; }
    var ct0 = camTarget(); cam.x = ct0[0]; cam.y = ct0[1];
    function snd(name, vol, stp) { try { if (api.sound) api.sound(name, vol, stp); } catch (e) {} }
    function mus(method) { var m = api.music; if (!m || typeof m[method] !== 'function') return; try { m[method].apply(m, Array.prototype.slice.call(arguments, 1)); } catch (e) {} }
    mus('key', 0); mus('layer', 'arp', false);

    /* every logic event → its one sound (so the 2D fallback hears everything), the
       renderer queue round.fx (capped) and, while the shell asks, round.events */
    function onEvent(e) {
      switch (e.type) {
        case 'go': mus('drop'); break;
        case 'rocket': snd('boost'); snd('powerup'); break;
        case 'driftStart': snd('boing', 0.4); break;
        case 'driftTier': snd('combo', 1, [2, 4, 7][e.tier - 1]); break;
        case 'driftRelease': if (e.tier > 0) { snd('boost'); snd('combo', 1, e.tier * 2 + 1); } break;
        case 'fizzle': snd('miss', 0.4); break;
        case 'pad': snd('boost', 0.8); if (e.onBeat) snd('star'); break;
        case 'zoom': snd('boost', 0.7); break;
        case 'cell': snd('pop', 0.6); snd('boost', 0.6); break;
        /* a touch: a crosser, a tumble (a fast touch of a cone), or a bonk */
        case 'hit': snd('bump'); if (e.moving) snd('oof', 0.5); else if (e.tumble) snd('boing', 0.6); break;
        case 'sticky': if (e.on && realT - lastSkid >= 0.4) { lastSkid = realT; snd('skid', 0.5); } break;
        case 'act': snd('whoosh', 0.5); break;
        case 'note': snd('pop', 0.5); snd('combo', 1, e.k); if (e.full) snd('star'); break;
        case 'jump': snd('whoosh'); break;
        case 'trick': snd('combo', 1, 5); break;
        case 'land': snd('chip'); if (e.trick) snd('powerup'); break;
        case 'scrape': if (realT - lastSkid >= 0.4) { lastSkid = realT; snd('skid', 0.6); } break;
        case 'bump': snd('bump'); break;
        case 'spin': snd('bump'); snd('oof'); snd('boing', 0.6); break;
        case 'gate': snd('check'); if (e.clean) snd('combo', 1, Math.min(9, Math.floor(s.wand / 5))); break;
        case 'lap': if (e.n < LAPN) { snd('coin'); snd('powerup'); } break;
        case 'finalLap': snd('sting'); mus('key', 2); break;
        case 'spotlight': snd('sting', 0.6); snd('applause', 0.4); mus('layer', 'arp', true); break;
        case 'spotlightEnd': if (e.early) snd('miss', 0.5); else snd('whoosh', 0.4); mus('layer', 'arp', false); break;
        case 'grass': if (e.on && realT - lastSkid >= 0.4) { lastSkid = realT; snd('skid', 0.5); } break;
        case 'pass': snd('combo', 1, 7 - e.place); if (e.place === 1) snd('powerup'); break;
        case 'passedBy': snd('whoosh', 0.4); break;
        case 'pacerGap': lastGap = e; break;
        case 'finish':
          snd('fanfare'); mus('layer', 'arp', false);
          later.push({ at: realT + 0.3, name: 'applause' }, { at: realT + 0.6, name: 'tada' });
          if (lv) lv.finish();      /* a shared race: the time goes to the starter, once */
          break;
      }
    }
    function drain() {
      var ev = s.events;
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        onEvent(e);
        if (fxq.length >= 64) fxq.shift();
        fxq.push(e);
        if (round.wantEvents && round.events) round.events.push(e);
      }
      ev.length = 0;
      /* a chime for every new Hype pip (at most one per 0.15 s) */
      var pip = Math.floor(s.wand / 5);
      if (pip > lastPip && realT - lastChip >= 0.15) { lastChip = realT; snd('chip', 0.3); mus('set', 'hype', s.wand / L.PHYS.WAND); }
      lastPip = pip;
    }
    function muted() { try { return !!(cfg.muted && cfg.muted()); } catch (e) { return false; } }
    function engine() {
      if (demo || (purrN++ % 4)) return;
      if (s.phase === 'race' && !purr) purrStart();
      var level = muted() ? 0 : s.phase === 'coast' ? Math.max(0, 1 - s.coastT / 0.5) : 1;
      purrSet(k.v, k.boostT > 0, k.drift.on, level);
    }

    var round = {
      done: false, kart: k, progress: pr, track: track, state: s, race: race,
      fx: fxq, events: [], wantEvents: false,
      opts: { mode: mode, cls: cls, easy: race.opts.easy, cam: o.cam },
      kartColor: kartCol, sigColor: sigCol, petColor: petCol, driver2d: drv2d, rider2d: rider2d, cam: cam, fxDt: 0,
      step: function (dt, h) {
        if (round.done) return;
        if (lv) lv.frame();         /* a shared race: once per drawn frame, the others' karts and mine on the wire */
        held = h || held;
        race.step(dt, held);
        realT += dt; round.fxDt += dt;
        drain();
        tipsStep();
        for (var i = later.length - 1; i >= 0; i--) if (realT >= later[i].at) { snd(later[i].name); later.splice(i, 1); }
        engine();
        var tgt = camTarget(), f = Math.min(1, dt * 5);
        cam.x += (tgt[0] - cam.x) * f; cam.y += (tgt[1] - cam.y) * f;
        if (s.done) { round.done = true; purrStop(); if (lv) lv.settle(); }
      },
      input: function (id, down) { held[id] = down; },
      countdown: function (countT, h, isStart) { race.countdown(countT, h || {}, isStart); drain(); },
      pauseReset: function () { race.pauseReset(); purrStop(); },
      padState: function (id) {
        var easy = race.opts.easy;
        if (id === 'drift') {
          if (easy && race.rocketWindow()) return 'ready';
          if (k.air.on && !k.air.trick && k.air.t < k.air.dur * L.PHYS.TRICK_WIN) return 'ready';
          if (k.drift.on) return k.onGrass ? 'grey' : k.drift.tier ? 's' + k.drift.tier : '';
          return '';
        }
        if (id === 'up' && !easy && race.rocketWindow()) return 'ready';
        return '';
      },
      forceEnd: function () { round.done = true; purrStop(); if (lv) lv.stop(); },
      /* the shell's text pill: the lap and the clock. The place is shown once, big, by the race view
         itself (the 3D HUD's place chip, the 2D place chip) — V4.55 fix run B11 */
      hud: function () {
        if (lv) lv.drawn();
        var t = s.finishT != null ? s.finishT : s.t;
        return 'Lap ' + Math.min(LAPN, pr.lap + 1) + '/' + LAPN + ' · ⏱ ' + L.fmt(t * 1000);
      },
      /* the first-time tip on screen now ('' for none): the 2D and 3D views both show it */
      tip: function () { return tip ? tip.text : ''; },
      result: function () { return race.result(); },
      /* the place: in a shared race the results table's, read now (null: none to show) */
      summaryTitle: function () {
        if (!pr.finished) return 'Race stopped';
        var p = placeNow();
        if (!race.rivals.length || p == null) return '🏁 Race complete!';
        return p === 1 ? '🎤 1st — centre stage!' : p === 2 ? '🥈 2nd place!' : p === 3 ? '🥉 3rd place!' : '💖 Fan Favourite!';
      },
      summaryBig: function () {
        var res = race.result(), p = placeNow();
        if (!res) return 'Not finished';
        return (race.rivals.length && p != null ? ordinal(p) + ' · ' : '') + L.fmt(res.ms);
      },
      /* V4.55 fix run B7: the results say what happened and ONE next step — '1st in this race ·
         Silver time · Try the Remix: more obstacles!' (nextStep); how the race went (laps, sparks,
         strips, notes, …) is behind the shell's Details (summaryDetails). A shell of API 3 shows
         nextStep under the personal best and puts summaryText behind Details, so that is empty
         there; an older shell shows summaryText, which is then the same line. In a shared race the
         place is left to the big line and the table, which follow the results. */
      nextStep: function () {
        var res = race.result();
        if (!res) return TIME_UP(LAPN);
        var m = L.medalFor(track.id, res.ms), p = lv ? null : placeNow();
        return [race.rivals.length && p > 0 ? ordinal(p) + ' in this race' : '', m ? MEDALS[m].name + ' time' : 'Finished', nudge(res.ms)].filter(Boolean).join(' · ');
      },
      summaryText: function () { return shell3() ? '' : round.nextStep(); },
      /* the pill over the 3D view (shell API 3): the lap and the clock, as hud() — which a shared race
         needs called once per drawn frame (lv.drawn) */
      hud3d: function () { return round.hud(); },
      /* everything else about the race, for the shell's Details ('' when it was not finished) */
      summaryDetails: function () {
        if (!race.result()) return '';
        var parts = ['Laps ' + pr.laps.map(function (l) { return l.toFixed(1); }).join(' · ')];
        var sp = s.sparks[0] + s.sparks[1] + s.sparks[2], sub = [];
        if (s.sparks[1]) sub.push(s.sparks[1] + ' pink'); if (s.sparks[2]) sub.push(s.sparks[2] + ' gold');
        /* a course adds its Zap Cells and its touches of cones and crossers (a classic track has neither) */
        var F = track.feat, road = (s.cellsTotal ? ' · Cells ' + s.cells + '/' + s.cellsTotal : '') +
          (track.course && ((F.obstacles || []).length || (F.crossers || []).length) ? ' · Bonks ' + s.hits : '');
        parts.push('Sparks ' + sp + (sub.length ? ' (' + sub.join(' · ') + ')' : '') + ' · On-beat ' + s.padsOnBeat + '/' + s.pads + ' · Notes ' + s.notes + '/' + s.notesTotal +
          ' · Tricks ' + s.tricks + ' · Spotlights ' + s.spotlights + (race.rivals.length ? ' · Passes ' + s.passes : '') + road);
        var w = [];
        if (s.bumps) w.push(s.bumps + ' bump' + (s.bumps > 1 ? 's' : ''));
        if (s.spins) w.push(s.spins + ' spin-out' + (s.spins > 1 ? 's' : ''));
        if (s.scrapes) w.push(s.scrapes + ' scrape' + (s.scrapes > 1 ? 's' : ''));
        parts.push(w.length ? w.join(' · ') : 'no wall bumps!');
        return parts.join(' · ');           /* the coach line (GP-2) is not here: it has its own line under the medals (coachShow) */
      },
      coachLine: coachLine,
      summaryBadges: function () {
        var res = race.result(), out = [];
        if (!res) return [{ text: '🏁 Finish all ' + LAPN + ' laps for a medal', kind: 'hint' }];
        var m = L.medalFor(track.id, res.ms);
        out.push({ text: m ? MEDALS[m].icon + ' ' + MEDALS[m].name : '🏁 Finisher', kind: MEDAL_KIND[m] });
        /* a shared race never says 'n of n' (the table beside it has every row) */
        var p = placeNow();
        if (race.rivals.length && p != null) out.push({ text: p === 1 ? '🎤 Centre stage' : ordinal(p) + (lv ? ' place' : ' of ' + (race.rivals.length + 1)), kind: 'ribbon' });
        if (!s.wall && !s.hits) out.push({ text: '✨ Clean race', kind: 'ribbon' });   /* no wall touch and no cone or crosser */
        if (s.rocket) out.push({ text: '🚀 Rocket start', kind: 'ribbon' });
        return out;
      },
      onFinish: function () {
        purrStop();
        /* a coach line gets a line of its own on the results sheet (a shared race's table block does the same) */
        if (!lv && coachLine() && typeof round.resultsExtra !== 'function') round.resultsExtra = function (el) { coachShow(el, coachLine()); if (el && el.style) el.style.display = 'none'; };
      },
      autoHeld: {},
      autopilot: function () { round.autoHeld = style ? race.driveStyle() : race.drivePlain(); },
      render: function (ctx) { if (lv) lv.drawn(); draw(ctx, round); },
      /* a shared race's session is not closed here: a rematch goes on with it (detach, on exit, decides) */
      dispose: function () { purrStop(); mus('layer', 'arp', false); mus('key', 0); if (lv) lv.dispose(); }
    };
    function placeNow() { return lv ? lv.place() : s.finishPlace; }
    /* GP-2: the one coach line after a finished race with no medal, or '' */
    function coachLine() {
      var res = race.result(), F = track.feat;
      if (demo || !res || L.medalFor(track.id, res.ms) > 0) return '';
      if (s.hits >= 3) return race.opts.easy ? COACH.easy.replace('{things}', thingsOf(F)) : COACH.bumps.replace('{n}', String(s.hits));
      if (s.scrapes >= 3) return COACH.walls;
      return s.sparks[0] + s.sparks[1] + s.sparks[2] ? '' : COACH.spark;
    }
    /* ---------- first-time tips (V4.55 fix run B5) ----------
       Said in the race, once per profile (the option store's tips bits), the first time each is
       useful: strips just ahead, a ramp just ahead, a bend just ahead (after the first few seconds).
       One at a time, for TIP_SEC, then a 2 s gap; a still line, nothing moves or blinks. Only in a
       round the child plays (not the idle picture or a shop preview). */
    var tip = null, tipNext = TIP_FIRST, tipsOn = !!mine && !demo;
    function tipsStep() {
      if (!tipsOn) return;
      if (s.phase !== 'race') { tip = null; return; }
      if (tip) { if (s.t < tip.until) return; tip = null; tipNext = s.t + TIP_GAP; }
      var o = loadOpts(cfg), seen = o.tips | 0;
      if ((seen & TIP_ALL) === TIP_ALL) { tipsOn = false; return; }
      if (s.t < tipNext) return;
      var F = track.feat, J = F.jumps || (F.jump ? [F.jump] : []), key = null, i;
      function near(at, lo, hi) { var d = ((at - pr.s) % track.len + track.len) % track.len; return d >= lo && d <= hi; }
      if (!(seen & TIP.strip)) for (i = 0; i < F.pads.length && !key; i++) if (near(F.pads[i].s, 120, 420)) key = 'strip';
      if (!key && !(seen & TIP.trick)) for (i = 0; i < J.length && !key; i++) if (J[i] && near(J[i].s, 150, 450)) key = 'trick';
      if (!key && !(seen & TIP.drift) && s.t >= TIP_DRIFT_T && L.bendAt(track, pr.idx + Math.round(220 / track.spacing), 170) > TIP_BEND) key = 'drift';
      if (!key) return;
      o.tips = seen | TIP[key]; saveOpts(cfg, o);
      tip = { key: key, text: TIP_TEXT[key], until: s.t + TIP_SEC };
    }
    if (ses) lv = liveLink(round, race, ses, cfg);
    /* ONE nudge for the results: an unlock, a near miss, or the next medal */
    /* (V4.55 fix run B1) the first finish on a Classic track: its Remix is the next step */
    function remixNext() {
      var rid = !demo && !ses && !track.course && prevPb == null && race.result() && coursesOn() ? remixOf(track.id) : null;
      return rid && pbMs(cfg, rid) == null ? rid : null;
    }
    /* a new road this result opened (Starlight Twist: the first Bronze on any Remix), or null */
    function roadNext() {
      var res = race.result(), m, hit = null;
      if (demo || ses || !res || !track.course || !track.base || !coursesOn()) return null;
      m = Math.max(remixBefore, L.medalFor(track.id, res.ms));
      L.courseIds().forEach(function (id) {
        var u = !hit && L.isCourse(id) && !L.courseBase(id) ? L.COURSES[id].unlock : null;
        if (u && remixBefore < u.medal && m >= u.medal) hit = id;
      });
      return hit;
    }
    function nudge(ms) {
      var par = L.PAR[track.id], C = L.CLASSES, road = roadNext();
      if (remixNext()) return REMIX_NEXT;
      if (road) return 'New course open: ' + L.courseName(road) + '!';
      if (par) {
        if (ms <= par.silver && !open2) return C[2].icon + ' ' + C[2].name + ' crew unlocked on ' + track.name + '!';
        if (ms <= par.bronze && !open1) return C[1].icon + ' ' + C[1].name + ' crew unlocked on ' + track.name + '!';
      }
      if (race.rivals.length && s.finishPlace > 1) {
        var ahead = null;
        race.rivals.forEach(function (r) { if (r.finished && r.finishT < s.finishT && (!ahead || r.finishT > ahead.finishT)) ahead = r; });
        if (ahead && s.finishT - ahead.finishT <= 2) return ordinal(s.finishPlace - 1) + ' was only ' + (s.finishT - ahead.finishT).toFixed(1) + ' s ahead!';
      }
      var best = prevPb != null ? Math.min(prevPb, ms) : ms, nm = L.nextMedal(track.id, best);
      return nm ? 'Next: ' + nm.icon + ' ' + nm.name + ' ' + L.fmt(nm.ms) + ' — ' + (nm.gap / 1000).toFixed(1) + ' s to go' : '';
    }
    round.lastGap = function () { return lastGap; };
    /* the results' next step as a course to go to (the shell's next-variant action, API 3): after
       the first finish on a Classic track its Remix, after the result that opened a new road that
       road → {id, label, again?}; undefined otherwise (no opinion: the shell may still offer a
       course this round opened) */
    round.nextVariant = function () {
      var rid = remixNext(), road = rid ? null : roadNext();
      if (rid) return { id: rid, label: REMIX_GO, again: REMIX_AGAIN };
      return road ? { id: road, label: '▶ Try ' + L.courseName(road) } : undefined;
    };
    return round;
  }

  /* ================================================================
     2D renderer (top-down). Reads the same state the 3D view reads, so
     a mid-race switch to 2D is seamless.
     ================================================================ */
  /* The cached course picture is the road and its scenery only, so a Remix shares its classic
     track's picture (what a course adds is painted over it every frame: roadPaint). A picture is a
     full-size canvas: at most LAYER_MAX are kept, and one that is dropped has its width set to 0,
     which is what makes an old iPad give the memory back. */
  var layerCache = {}, layerOrder = [], LAYER_MAX = 2;
  function trackLayer(track) {
    var key = track.base || track.id, at = layerOrder.indexOf(key);
    if (at >= 0) { if (at < layerOrder.length - 1) layerOrder.push(layerOrder.splice(at, 1)[0]); return layerCache[key]; }
    if (typeof document === 'undefined') return null;
    while (layerOrder.length >= LAYER_MAX) { var old = layerOrder.shift(); layerCache[old].width = 0; delete layerCache[old]; }
    var c = document.createElement('canvas');
    if (!c) return null;
    var L = logic(), WW = L.WW, WH = L.WH, HW = L.HW, KERB = L.KERB, WALL = L.WALL, SCALE = L.SCALE;
    c.width = WW; c.height = WH;
    var x = c.getContext('2d');
    x.fillStyle = track.grass; x.fillRect(0, 0, WW, WH);
    x.fillStyle = 'rgba(0,0,0,0.05)';
    for (var i = 0; i < 1500; i++) { var px = (i * 137) % WW, py = (i * 241) % WH; x.fillRect(px, py, 5, 5); }
    /* scenery */
    for (var sc = 0; sc < 40; sc++) {
      var sx = (sc * 619) % WW, sy = (sc * 373) % WH;
      var near = false; for (var q = 0; q < track.n; q += 4) { if (Math.hypot(track.pts[q][0] - sx, track.pts[q][1] - sy) < WALL + 60) { near = true; break; } }
      if (near) continue;
      if (track.deco === 'beach') { x.fillStyle = '#ff6b6b'; x.beginPath(); x.arc(sx, sy, 26, Math.PI, 0); x.fill(); x.fillStyle = '#fff'; x.fillRect(sx - 2, sy, 4, 30); }
      else { x.fillStyle = '#3f9a4a'; x.beginPath(); x.arc(sx, sy, 22, 0, 7); x.arc(sx + 18, sy + 6, 18, 0, 7); x.fill(); x.fillStyle = '#5cb85c'; x.beginPath(); x.arc(sx + 4, sy - 4, 14, 0, 7); x.fill(); }
    }
    if (track.deco === 'volcano') {
      /* a cute volcano that never erupts */
      var vx = 480 * SCALE, vy = 290 * SCALE;
      x.fillStyle = '#8a6b5a'; x.beginPath(); x.moveTo(vx - 170, vy + 120); x.lineTo(vx, vy - 140); x.lineTo(vx + 170, vy + 120); x.closePath(); x.fill();
      x.fillStyle = '#ff8a5c'; x.beginPath(); x.moveTo(vx - 40, vy - 80); x.lineTo(vx, vy - 140); x.lineTo(vx + 40, vy - 80); x.closePath(); x.fill();
      x.fillStyle = 'rgba(217,200,242,0.7)'; x.beginPath(); x.arc(vx + 20, vy - 170, 40, 0, 7); x.arc(vx + 50, vy - 220, 52, 0, 7); x.fill();
    }
    if (track.deco === 'beach') { x.fillStyle = '#4fc3f7'; x.fillRect(0, WH - 70, WW, 70); }
    function strokePath(w, col, dash) {
      x.beginPath(); track.pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath();
      x.lineWidth = w; x.strokeStyle = col; x.lineJoin = 'round'; x.setLineDash(dash || []); x.stroke(); x.setLineDash([]);
    }
    strokePath((WALL + 6) * 2, '#5b5670');                       /* tyre wall shadow line */
    strokePath(WALL * 2, track.deco === 'beach' ? '#e9cf88' : '#a6dc8e');   /* verge */
    strokePath((HW + KERB) * 2, '#e94b4b');
    strokePath((HW + KERB) * 2, '#ffffff', [18, 18]);
    strokePath(HW * 2, '#5f5a72');
    strokePath(3, 'rgba(255,255,255,0.55)', [16, 18]);
    /* candy tyre stacks along both walls */
    var STACK = ['#FFB3E6', '#B3E5FF', '#FFF3B3'];
    for (var t = 0; t < track.n; t += 6) {
      var p = track.pts[t], tg = track.tang[t], nx = -tg[1], ny = tg[0];
      [1, -1].forEach(function (sd) {
        x.fillStyle = STACK[(t / 6) % 3]; x.strokeStyle = 'rgba(59,47,74,0.5)'; x.lineWidth = 2;
        x.beginPath(); x.arc(p[0] + nx * (WALL + 4) * sd, p[1] + ny * (WALL + 4) * sd, 6, 0, 7); x.fill(); x.stroke();
      });
    }
    /* start/finish strip */
    var p0 = track.pts[0], t0 = track.tang[0], nx0 = -t0[1], ny0 = t0[0];
    for (var kk = -5; kk < 5; kk++) for (var row = 0; row < 2; row++) {
      x.fillStyle = (kk + row) % 2 ? '#ffffff' : '#2d2d3d';
      var cx = p0[0] + nx0 * kk * 10 + t0[0] * row * 10, cy = p0[1] + ny0 * kk * 10 + t0[1] * row * 10;
      x.save(); x.translate(cx, cy); x.rotate(Math.atan2(t0[1], t0[0])); x.fillRect(0, 0, 10, 10); x.restore();
    }
    layerCache[key] = c; layerOrder.push(key);
    return c;
  }

  /* ---------- the things on the road (2D): everything the 3D view draws, for old iPads too ---------- */
  function lapOn(rec, lap) { return !rec.laps || rec.laps.indexOf(lap) >= 0; }
  /* one chevron pointing along +x, in the current fill (Beat Strips, Zoom Strip arrows, the Trick Ramp's approach) */
  function chevron(ctx, c) {
    ctx.beginPath(); ctx.moveTo(c - 8, -14); ctx.lineTo(c + 6, 0); ctx.lineTo(c - 8, 14); ctx.lineTo(c - 2, 14); ctx.lineTo(c + 12, 0); ctx.lineTo(c - 2, -14); ctx.closePath(); ctx.fill();
  }
  /* a ramp across its own band: the whole road and both kerbs, or the half a Trick Ramp covers
     (two gold chevrons on the road before a Trick Ramp point at its band) */
  function ramp(ctx, J, full) {
    var hw = (J.w != null ? J.w : full) / 2, st, b;
    ctx.save(); ctx.translate(J.x, J.y); ctx.rotate(J.ang);
    for (st = 0; st < 8; st++) { ctx.fillStyle = st % 2 ? '#ffffff' : '#FF8FC8'; ctx.fillRect(-J.len / 2 + st * J.len / 8, -hw, J.len / 8, hw * 2); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-J.len / 2, -hw, J.len, hw * 2);
    ctx.fillStyle = STAR_GOLD;
    for (b = 0; b < 8; b++) { [1, -1].forEach(function (sd) { ctx.beginPath(); ctx.arc(-J.len / 2 + (b + 0.5) * J.len / 8, sd * (hw + 5), 3, 0, 7); ctx.fill(); }); }
    if (hw * 2 < full) { chevron(ctx, -J.len / 2 - 52); chevron(ctx, -J.len / 2 - 28); }
    ctx.restore();
  }
  /* a sticky patch's outline in world px, made once per course: the strip of road between its two
     edges, the edges wobbling INWARDS by up to 4 px and the ends pulled in (a blob that is never
     drawn bigger than the patch the race logic tests) */
  var gooCache = {};
  function gooShapes(track) {
    if (gooCache[track.id]) return gooCache[track.id];
    var L = logic(), pt = {};
    return (gooCache[track.id] = (track.feat.sticky || []).map(function (z) {
      var a = [], b = [], span = ((z.s1 - z.s0) % track.len + track.len) % track.len, n = Math.max(2, Math.round(span / 16));
      for (var q = 0; q <= n; q++) {
        var p = L.pointAt(track, z.s0 + span * q / n, pt), inn = 2 + 2 * Math.sin(q * 1.9) + (q === 0 || q === n ? 8 : 0);
        a.push([p.x - p.ty * (z.lat0 + inn), p.y + p.tx * (z.lat0 + inn)]);
        b.unshift([p.x - p.ty * (z.lat1 - inn), p.y + p.tx * (z.lat1 - inn)]);
      }
      return a.concat(b);
    }));
  }
  /* cone: a coral triangle with a white band · crystal: a violet diamond · sandcastle: a sand
     bucket shape. Knocked flat: on its side, at 60% */
  function obstacleSprite(ctx, x, y, skin, flat, alpha) {
    ctx.save(); ctx.translate(x, y); if (flat) ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = alpha * (flat ? 0.6 : 1); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (skin === 'crystal') { ctx.fillStyle = VIOLET; ctx.moveTo(0, -14); ctx.lineTo(9, -1); ctx.lineTo(0, 12); ctx.lineTo(-9, -1); }
    else if (skin === 'sandcastle') { ctx.fillStyle = SAND; ctx.moveTo(-11, 10); ctx.lineTo(-8, -6); ctx.lineTo(-8, -12); ctx.lineTo(-3, -12); ctx.lineTo(-3, -6); ctx.lineTo(3, -6); ctx.lineTo(3, -12); ctx.lineTo(8, -12); ctx.lineTo(8, -6); ctx.lineTo(11, 10); }
    else { ctx.fillStyle = CORAL; ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    if (skin === 'crystal') { ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, -1); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill(); }
    else if (skin !== 'sandcastle') ctx.fillRect(-5, -1, 10, 4);
    ctx.restore();
  }
  /* a crosser, drawn facing the way it is moving (+x here): stage-bot, lava rock or crab. step is
     the shuffle of its feet (±2 px at 2 Hz; 0 under reduced motion) */
  function crosserSprite(ctx, q, skin, alpha, step) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.tx * q.dir, -q.ty * q.dir));
    ctx.globalAlpha = alpha; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 3, 15, 12, 0, 0, 7); ctx.fill();
    if (skin === 'lava-rock') {
      ctx.fillStyle = '#7A4A3A'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#FF8A5C'; ctx.beginPath(); ctx.moveTo(-7 + step, -5); ctx.lineTo(-1 + step, 0); ctx.lineTo(-5 + step, 6); ctx.moveTo(4 + step, -8); ctx.lineTo(7 + step, 1); ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      [-1, 1].forEach(function (sd) { ctx.fillRect(-9 + sd * step, sd * 11 - 2, 7, 4); ctx.fillRect(3 - sd * step, sd * 11 - 2, 7, 4); });
      ctx.fillStyle = skin === 'crab' ? CORAL : NEON_CYAN; ctx.beginPath();
      if (skin === 'crab') ctx.ellipse(0, 0, 10, 12, 0, 0, 7); else if (ctx.roundRect) ctx.roundRect(-11, -9, 22, 18, 5); else ctx.rect(-11, -9, 22, 18);
      ctx.fill(); ctx.stroke();
      if (skin === 'crab') [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.arc(11, sd * 9, 4, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#ffffff'; [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.arc(6, sd * 4, 2.5, 0, 7); ctx.fill(); });
    }
    ctx.restore();
  }
  /* What a course paints on the road, over the cached picture: its sticky patches (one that is only
     there on some laps fades with the lap set: fade(rec) is how solid), the zebra band of each
     crosser with a sign on the verge 250 px before it, and every ramp. Only what is in view. */
  function roadPaint(ctx, track, cam, fade) {
    var L = logic(), F = track.feat, HW = L.HW, KERB = L.KERB, pt = {};
    function seen(x, y) { return x > cam.x - 260 && x < cam.x + LW + 260 && y > cam.y - 260 && y < cam.y + LH + 260; }
    var shapes = (F.sticky || []).length ? gooShapes(track) : [];
    shapes.forEach(function (sh, i) {
      var z = F.sticky[i], a = fade(z), mid = sh[Math.floor(sh.length / 4)];
      if (!a || !seen(mid[0], mid[1])) return;
      ctx.save();
      ctx.beginPath(); sh.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath();
      ctx.globalAlpha = 0.62 * a; ctx.fillStyle = GOO[z.skin] || GOO.bubblegum; ctx.fill();
      ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    });
    (F.crossers || []).forEach(function (c) {
      var p = L.pointAt(track, c.s, pt);
      if (seen(p.x, p.y)) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx));
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (var lat = -HW + 3; lat < HW - 6; lat += 14) ctx.fillRect(-17, lat, 34, 8);
        ctx.restore();
      }
      p = L.pointAt(track, c.s - 250, pt);
      var sx = p.x - p.ty * (HW + KERB + 20), sy = p.y + p.tx * (HW + KERB + 20);
      if (!seen(sx, sy)) return;
      /* the sign: a gold diamond with a two-way arrow (it does not blink) */
      ctx.fillStyle = STAR_GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy - 13); ctx.lineTo(sx + 13, sy); ctx.lineTo(sx, sy + 13); ctx.lineTo(sx - 13, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.lineTo(sx + 7, sy); ctx.moveTo(sx - 4, sy - 3); ctx.lineTo(sx - 7, sy); ctx.lineTo(sx - 4, sy + 3); ctx.moveTo(sx + 4, sy - 3); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx + 4, sy + 3); ctx.stroke();
    });
    (F.jumps || (F.jump ? [F.jump] : [])).forEach(function (J) { if (seen(J.x, J.y)) ramp(ctx, J, (HW + KERB) * 2); });
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { var A = hexRgb(a), B = hexRgb(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }

  /* ---------- the driver from above (kids update KU-CH19b; characters.json design.games.neonGrandPrix.twoD) ----------
     With a character (cfg.char, SLPeopleCore.avatarInfo) the child drives the top-down kart: their head is a disc
     in the colour seen from above — the hair, or the hat, helmet, hood or covering on it: the most-drawn colour
     of SLPeopleArt's top view, the recipe the 3D rig is built from (the palette's hair or covering colour until
     the art is in) — with a skin-tone face edge at the front, and their pet (cfg.pet) rides behind as two ears,
     or two wing tips for a winged species. Worked out once per look and kept in memory only. No character (the
     classic avatar has no 2D figure) or no people core on the page → V4.55's head in the pet's colour. Drawing
     only: nothing here reads or writes the race. */
  var HEX6 = /^#[0-9a-f]{6}$/i, TOP_BONES = ['head', 'eyes', 'hairTail'], driverMemo = [];
  function hexOk(c) { return typeof c === 'string' && HEX6.test(c) ? c : null; }
  function lookKey(ch) {
    try { return [ch.lk || JSON.stringify(ch.look), ch.wr || JSON.stringify([ch.wear || {}, ch.vr || {}])].join('|'); } catch (e) { return null; }
  }
  /* the most-drawn colour of the head seen from above (SLPeopleArt's top view), or null */
  function topColour(A, ch) {
    var sp = null, n = {}, best = null, i, r, c;
    try { sp = A.sprite({ look: ch.look, wear: ch.wear || {}, vr: ch.vr || {} }, { view: 'top', pose: 'drive', px: 2, bones: TOP_BONES }); } catch (e) { sp = null; }
    if (!sp || !Array.isArray(sp.rows) || !sp.pal) return null;
    for (i = 0; i < sp.rows.length; i++) {
      r = String(sp.rows[i]);
      for (var k = 0; k < r.length; k++) { c = r.charAt(k); if (c !== '.' && c !== 'o') n[c] = (n[c] || 0) + 1; }
    }
    Object.keys(n).forEach(function (q) { if (hexOk(sp.pal[q]) && (best === null || n[q] > n[best])) best = q; });
    return best === null ? null : sp.pal[best].toUpperCase();
  }
  function driverLook(cfg) {
    var W = win(), P = W && W.SLPeopleCore, ch = cfg && cfg.char, key, res = null, i;
    if (!P || typeof P.resolve !== 'function' || !ch || typeof ch !== 'object' || !ch.look || typeof ch.look !== 'object' || !(key = lookKey(ch))) return null;
    for (i = 0; i < driverMemo.length; i++) if (driverMemo[i].key === key) return driverMemo[i];
    try { res = P.resolve(ch.look, ch.wear || {}, ch.vr || {}); } catch (e) { res = null; }
    var C = res && res.colours, lk = (res && res.look) || {}, face = C && C.skin && hexOk(C.skin.hex);
    if (!face) return null;
    var m = { key: key, face: face, top: hexOk(lk.cv && C.covering && C.covering.hex) || hexOk(res.flags && res.flags.hair && C.hair && C.hair.hex) || face, art: false };
    driverMemo.unshift(m);
    if (driverMemo.length > 2) driverMemo.length = 2;
    var fromArt = function () { var A = W.SLPeopleArt, t = A && typeof A.sprite === 'function' ? topColour(A, ch) : null; if (t) { m.top = t; m.art = true; } return m.art; };
    /* the art comes with the people files (the host's slLoadPeople, loaded once); until then the palette's colour */
    if (!fromArt() && typeof W.slLoadPeople === 'function') {
      try { Promise.resolve(W.slLoadPeople()).then(fromArt, function () {}); } catch (e) { /* the palette's colour stays */ }
    }
    return m;
  }
  /* the pet behind the driver: its shape from above and its colours (PETCOL / PETCOL3), or null */
  function riderLook(cfg, arts) {
    var W = win(), pet = cfg && cfg.pet, id = pet && typeof pet.id === 'string' ? pet.id : '';
    if (!id) return null;
    var row = (arts.PETCOL || {})[id] || (arts.PETCOL3 || {})[id] || {}, LK = W && W.SLIslandLook, GP = W && W.SLGamePeople;
    var sp = LK && LK.SPECIES3 && Object.prototype.hasOwnProperty.call(LK.SPECIES3, id) ? LK.SPECIES3[id] : null, flies = false;
    try { flies = !!(GP && typeof GP.flies === 'function' && GP.flies(id)); } catch (e) { flies = false; }
    var kind = id === 'pet_dragon' || flies || (sp && sp.biped) ? 'wings' : id === 'pet_bunny' ? 'long' : id === 'pet_puppy' ? 'flop' : id === 'pet_kitten' ? 'point' : 'round';
    var body = hexOk(row.body) || STAR_GOLD;
    return { kind: kind, col: kind === 'wings' ? hexOk(row.light) || body : kind === 'flop' || kind === 'point' ? hexOk(row.dark) || body : body };
  }
  /* in the kart's own frame (x forward): the pet's ears or wing tips behind the seat, then the head with its face edge */
  function driverHead(ctx, d, pet) {
    if (pet) {
      ctx.fillStyle = pet.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      [-1, 1].forEach(function (sd) {
        ctx.beginPath();
        if (pet.kind === 'wings') { ctx.moveTo(-11, sd * 5); ctx.lineTo(-20, sd * 9); ctx.lineTo(-13, sd * 16); ctx.closePath(); }
        else if (pet.kind === 'long') ctx.ellipse(-17, sd * 3.2, 6.5, 2.3, sd * 0.12, 0, 7);
        else if (pet.kind === 'flop') ctx.ellipse(-15, sd * 6, 3.6, 2.4, sd * 0.5, 0, 7);
        else if (pet.kind === 'point') { ctx.moveTo(-12.5, sd * 1.5); ctx.lineTo(-19.5, sd * 3.5); ctx.lineTo(-14, sd * 8); ctx.closePath(); }
        else ctx.arc(-15, sd * 4.5, 3, 0, 7);
        ctx.fill(); ctx.stroke();
      });
    }
    /* the face edge: the front 4 px of the disc (about 3 px of it shows inside the outline) */
    ctx.fillStyle = d.face; ctx.beginPath(); ctx.arc(-4, 0, 7, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(-4, 0, 7, 0, 7); ctx.clip();
    ctx.fillStyle = d.top; ctx.beginPath(); ctx.arc(-8, 0, 7, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-4, 0, 7, 0, 7); ctx.stroke();
  }
  /* one kart sprite: body colour, optional stripe + initial (rivals), driver head colour (o.driver: the child's
     head and o.rider their pet, KU-CH19b) */
  function kartSprite(ctx, x, y, h, body, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    if (o.scale && o.scale !== 1) ctx.scale(o.scale, o.scale);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = '#2d2d3d';
    [[-16, -16], [10, -16], [-16, 10], [10, 10]].forEach(function (w) { ctx.fillRect(w[0], w[1], 12, 7); });
    ctx.fillStyle = body; ctx.strokeStyle = o.edge || INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(18, -8); ctx.lineTo(26, 0); ctx.lineTo(18, 8); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(-18, -3, 40, 6); }
    if (o.driver) driverHead(ctx, o.driver, o.rider);
    else { ctx.fillStyle = o.head || STAR_GOLD; ctx.beginPath(); ctx.arc(-4, 0, 7, 0, 7); ctx.fill(); ctx.stroke(); }
    if (o.initial) {
      ctx.translate(-4, 0); ctx.rotate(-h); ctx.fillStyle = INK; ctx.font = '800 10px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.initial, 0, 0);
    }
    ctx.restore();
  }
  /* a name tag over another child's kart: canvas text (never markup), still, at the kart's own alpha */
  function nameTag(ctx, x, y, txt, alpha) {
    if (!txt) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = '800 13px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(txt, x, y);
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, x, y);
    ctx.restore();
  }
  function banner(ctx, txt, col) {
    ctx.font = '800 34px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(txt, LW / 2, 70);
    ctx.fillStyle = col; ctx.fillText(txt, LW / 2, 70);
  }
  function chip(ctx, x, y, txt, bg, fg) {
    ctx.font = '800 16px "Baloo 2", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(txt).width + 18;
    ctx.fillStyle = bg; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, 26, 13); else ctx.rect(x, y, w, 26);
    ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(txt, x + 9, y + 14);
    return w;
  }
  /* per-round 2D juice (particles, words, banner, shake), created on first draw */
  function juice(R) {
    if (R._juice) return R._juice;
    var FX = typeof window !== 'undefined' ? window.SLGameFX : null;
    if (!FX) return null;
    var red = !!(R.race.opts.reduced);
    R._juice = { FX: FX, p: FX.particles({ reduced: red, max: 260, seed: 4242 }), bn: FX.banner(red), sh: FX.shaker(red), red: red, words: [], spark: 0, jet: 0, dust: 0 };
    return R._juice;
  }
  function word(J, R, txt, col, size) {
    var now = R.race.s.t;
    J.words = J.words.filter(function (w) { return now - w < 0.9; });
    if (J.words.length >= 2) return;              /* never more than 2 words on screen */
    J.words.push(now);
    var k = R.race.k;
    J.p.text(k.x, k.y - 34, txt, { color: col, size: size || 22, life: 0.9, vy: -60 });
  }
  function eventJuice(J, R, e) {
    var k = R.race.k, p = J.p, bx = k.x - Math.cos(k.h) * 20, by = k.y - Math.sin(k.h) * 20;
    switch (e.type) {
      case 'rocket': J.bn.show('ROCKET START!', { color: STAR_GOLD, size: 56, life: 1.1 }); p.burst(bx, by, { n: 18, colors: [R.kartColor, STAR_GOLD, '#fff'], shape: 'star', speed: 220, gravity: 0, life: 0.6 }); break;
      case 'driftRelease': if (e.tier > 0) { J.bn.show('SPARK BOOST!', { color: TIER_COL[e.tier], size: Math.round(46 * [1, 1.15, 1.3][e.tier - 1]), life: 0.9 }); p.burst(bx, by, { n: 10 + e.tier * 4, colors: [TIER_COL[e.tier], '#fff'], shape: 'spark', speed: 240, gravity: 0, life: 0.5 }); } break;
      case 'fizzle': p.burst(k.x, k.y, { n: 8, colors: [PEBBLE, '#ffffff'], speed: 90, gravity: -40, life: 0.5, size: 7 }); break;
      case 'pad': p.burst(bx, by, { n: 10, colors: [NEON_CYAN, '#fff'], shape: 'spark', speed: 260, gravity: 0, life: 0.4 }); if (e.onBeat) word(J, R, 'ON BEAT!', NEON_PINK); break;
      case 'note': p.burst(k.x, k.y, { n: 6, colors: [NEON_PINK, NEON_CYAN], shape: 'star', speed: 140, gravity: 0, life: 0.45, size: 5 }); if (e.full) word(J, R, '♪ FULL TRAIL!', NEON_PINK); break;
      case 'zoom': p.burst(bx, by, { n: 10, colors: [LIME, '#fff'], shape: 'spark', speed: 260, gravity: 0, life: 0.4 }); break;
      case 'cell': p.burst(k.x, k.y, { n: 8, colors: [LIME, STAR_GOLD], shape: 'star', speed: 150, gravity: 0, life: 0.45, size: 5 }); word(J, R, 'ZAP!', LIME); break;
      case 'hit': p.burst(k.x, k.y, { n: 8, colors: ['#FFB3E6', '#B3E5FF', '#FFF3B3'], speed: 110, gravity: 0, life: 0.45, size: 6 }); word(J, R, e.tumble ? 'Tumble!' : 'Bonk!', CORAL); J.sh.kick(5, 0.18); break;
      case 'sticky': if (e.on) word(J, R, 'Sticky!', NEON_PINK, 18); break;
      case 'act': if (e.name === 'showtime') J.bn.show('SHOWTIME!', { color: NEON_CYAN, size: 58, life: 1.6, sub: 'The course changes!' }); break;
      /* confetti from both ends of the ramp that launched (a course says which: e.i) */
      case 'jump': {
        var F = R.track.feat, Jp = (e.i != null && F.jumps && F.jumps[e.i]) || F.jump, jw = Jp && Jp.w != null ? Jp.w / 2 + 6 : 64;
        if (Jp) [1, -1].forEach(function (sd) { p.burst(Jp.x - Math.sin(Jp.ang) * sd * jw, Jp.y + Math.cos(Jp.ang) * sd * jw, { n: 20, colors: ['#FFB3E6', '#B3E5FF', '#FFF3B3', R.sigColor], shape: 'square', speed: 260, life: 0.9, size: 6 }); });
        break;
      }
      case 'trick': p.burst(k.x, k.y, { n: 12, colors: [STAR_GOLD, '#fff'], shape: 'star', speed: 160, gravity: 0, life: 0.5 }); break;
      case 'land': p.burst(k.x, k.y, { n: 8, colors: ['#E8DCC4'], speed: 90, gravity: 0, life: 0.45, size: 6 }); break;
      case 'scrape': p.burst(k.x, k.y, { n: 6, colors: [CORAL, STAR_GOLD], shape: 'spark', speed: 180, gravity: 0, life: 0.35 }); word(J, R, 'Scrape!', CORAL, 18); break;
      case 'bump': if (R.race.features) { word(J, R, 'Bump!', CORAL); J.sh.kick(5, 0.18); } break;
      case 'spin': word(J, R, 'Spin-out!', CORAL); J.sh.kick(7, 0.18); R._dizzy = R.race.s.t; break;
      case 'gate': if (e.clean) word(J, R, 'CLEAN!', LEAF_MINT); break;
      case 'lap': if (e.n < R.track.laps) p.burst(k.x, k.y, { n: 30, colors: ['#FFB3E6', '#B3E5FF', '#C9FFE5', '#FFF3B3', R.sigColor], shape: 'square', speed: 280, life: 1 }); break;
      case 'finalLap': J.bn.show('ENCORE LAP!', { color: NEON_PINK, size: 60, life: 1.6 }); break;
      case 'spotlight': J.bn.show('SPOTLIGHT!', { color: STAR_GOLD, size: 58, life: 1.2 }); break;
      case 'pass': word(J, R, 'PASS!', R.sigColor); break;
      case 'finish':
        for (var c = 0; c < 2; c++) p.burst(k.x + (c ? 60 : -60), k.y - 20, { n: 60, colors: ['#FFB3E6', '#B3E5FF', '#C9FFE5', '#FFF3B3', R.sigColor, R.sigColor], shape: c ? 'star' : 'square', speed: 320, life: 1.4 });
        for (var r = 0; r < 3; r++) p.ring(k.x + (r - 1) * 70, k.y - 40 - r * 10, { color: [NEON_PINK, NEON_CYAN, STAR_GOLD][r], r0: 8, r1: 70, life: 0.7, width: 5, optional: true });
        /* a shared race shows no place at the line: someone's earlier finish may still be on its way */
        J.bn.show(R.race.rivals.length && !R.live ? ordinal(R.race.s.finishPlace) + '!' : 'FINISH!', { color: STAR_GOLD, size: 64, life: 1.8 });
        break;
      /* another child crossed the line: a short banner with their name (from the roster) */
      case 'rivalFinish': {
        var rf = R.live ? R.race.rivals[e.i] : null;
        if (rf && rf.remote && !R.race.pr.finished) J.bn.show(rf.name + ' finished!', { color: NEON_CYAN, size: 34, life: 1.4 });
        break;
      }
    }
  }
  /* emit n whole particles for 'rate' per second, carrying the remainder */
  function due(J, key, rate, dt) { J[key] += rate * dt; var n = Math.floor(J[key]); J[key] -= n; return n; }
  function draw(ctx, R) {
    var L = logic(), race = R.race, track = race.track, k = race.k, s = race.s, pr = race.pr, F = track.feat;
    var HW = L.HW, KERB = L.KERB, cam = R.cam, J = juice(R);
    var dt = Math.min(0.1, R.fxDt); R.fxDt = 0;
    /* 2D just took over mid-race (the 3D view failed): skip the stale queue */
    if (R._drawT == null ? s.t > 0.5 : s.t - R._drawT > 0.5) R.fx.length = 0;
    R._drawT = s.t;
    /* events → particles, words and banners */
    while (R.fx.length) { var e = R.fx.shift(); if (J) eventJuice(J, R, e); }
    if (J) {
      /* continuous effects: drift sparks (tier colour, grey while draining), boost glitter, grass dust */
      var bx = k.x - Math.cos(k.h) * 20, by = k.y - Math.sin(k.h) * 20, n;
      if (k.drift.on && (n = due(J, 'spark', [6, 8, 14, 20][k.drift.tier], dt))) {
        J.p.burst(bx, by, { n: n, colors: [k.onGrass ? PEBBLE : TIER_COL[Math.max(1, k.drift.tier)], '#fff'], shape: 'spark', speed: 120, gravity: 0, life: 0.35, size: 4, angle: k.h + Math.PI, spread: 1.2 });
      }
      if (k.boostT > 0 && (n = due(J, 'jet', 16, dt))) J.p.burst(bx, by, { n: n, colors: [R.kartColor, STAR_GOLD], shape: 'star', speed: 90, gravity: 0, life: 0.4, size: 4, angle: k.h + Math.PI, spread: 0.6 });
      if (k.onGrass && Math.abs(k.v) > 60 && (n = due(J, 'dust', 10, dt))) J.p.burst(bx, by, { n: n, colors: ['#E8DCC4'], speed: 40, gravity: 0, life: 0.5, size: 7 });
      J.p.step(dt); J.bn.step(dt); J.sh.step(dt);
    }
    var layer = trackLayer(track);
    var shake = J ? J.sh.offset() : [0, 0];
    ctx.save();
    ctx.translate(-Math.round(cam.x) + shake[0], -Math.round(cam.y) + shake[1]);
    if (layer) ctx.drawImage(layer, Math.round(cam.x), Math.round(cam.y), LW, LH, Math.round(cam.x), Math.round(cam.y), LW, LH); else { ctx.fillStyle = track.grass; ctx.fillRect(0, 0, L.WW, L.WH); }
    /* The lap set (s.lapSet: which cones, patches, cells and crossers are out). When it changes at a
       lap line the old set fades out and the new one in over 0.6 s: once a lap, and at once under
       reduced motion. fade(rec) is how solid one of them is drawn right now. */
    var red = !!race.opts.reduced, set = s.lapSet || 1, tmp = {};
    if (R._set == null) { R._set = R._setFrom = set; R._setU = 1; }
    if (set !== R._set) { R._setFrom = R._set; R._set = set; R._setU = red ? 1 : 0; }
    else if (R._setU < 1) R._setU = Math.min(1, R._setU + dt / 0.6);
    var u = R._setU, from = R._setFrom, obstacles = F.obstacles || [], cells = F.cells || [], crossers = F.crossers || [], skins = F.skins || {};
    function fade(rec) { var now = lapOn(rec, set), was = u < 1 ? lapOn(rec, from) : now; return now ? (was ? 1 : u) : was ? 1 - u : 0; }
    roadPaint(ctx, track, cam, fade);
    /* Beat Strips: chevrons lerp Neon Cyan → Neon Pink with the beat (≤ 1.17 Hz). Zoom Strips: a lime
       plate (the colour never changes) whose three white arrows slide forward one arrow a second
       (still under reduced motion) */
    var ph = L.beatPhase(s.t), m = 0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.25)), chevCol = mix(NEON_CYAN, NEON_PINK, m);
    var slide = red ? 0 : (s.t - Math.floor(s.t)) * 20;
    F.pads.forEach(function (p) {
      var zoom = p.kind === 'zoom', c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.fillStyle = zoom ? LIME : '#B3E5FF'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(-p.len / 2, -p.w / 2, p.len, p.w); ctx.strokeRect(-p.len / 2, -p.w / 2, p.len, p.w);
      if (zoom) {
        ctx.beginPath(); ctx.rect(-p.len / 2 + 2, -p.w / 2 + 2, p.len - 4, p.w - 4); ctx.clip();
        ctx.fillStyle = '#ffffff';
        for (c = slide ? -2 : -1; c <= 1; c++) chevron(ctx, c * 20 + slide);
      } else { ctx.fillStyle = chevCol; for (c = -1; c <= 1; c++) chevron(ctx, c * 20); }
      ctx.restore();
    });
    /* Glow Line (Easy Drive): dots along the reference line for the next 1000 px — none in the
       150 px before a crosser that is out on that lap (the reference run met it at another moment) */
    if (race.opts.easy && race.ref && s.phase === 'race') {
      var pc = race.Pc(), pt = {};
      ctx.fillStyle = R.sigColor; ctx.globalAlpha = 0.75;
      for (var d = 40; d <= 1000; d += 40) {
        var P = pc + d, lat = L.refLat(race.ref, L.refTauAt(race.ref, P)), hide = false;
        for (var cq = 0; cq < crossers.length && !hide; cq++) {
          var gap = ((crossers[cq].s - P) % track.len + track.len) % track.len;
          hide = gap <= 150 && lapOn(crossers[cq], Math.max(1, Math.min(track.laps, Math.floor(P / track.len) + 1)));
        }
        if (hide) continue;
        L.pointAt(track, P, pt);
        ctx.beginPath(); ctx.arc(pt.x - pt.ty * lat, pt.y + pt.tx * lat, 3.5, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    /* Glow Notes: ♪ on pink discs, hidden once collected this lap */
    ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    F.notes.forEach(function (q, i) {
      if (s.noteGot[i]) return;
      ctx.fillStyle = NEON_PINK; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText('♪', q.x, q.y + 1);
    });
    /* Zap Cells: ⚡ on lime discs, hidden once taken this lap */
    cells.forEach(function (q, i) {
      var a = lapOn(q, set) ? fade(q) : 0;
      if (!a || (s.cellGot && s.cellGot[i])) return;
      ctx.globalAlpha = a; ctx.fillStyle = LIME; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText('⚡', q.x, q.y + 1);
      ctx.globalAlpha = 1;
    });
    /* checkpoint gates: lemon until passed this lap, then Leaf Mint */
    L.CHECKS.forEach(function (f, i) {
      var target = f * track.len, idx = 0;
      while (idx < track.n - 1 && track.cum[idx] < target) idx++;
      var p = track.pts[idx], tg = track.tang[idx], nx = -tg[1], ny = tg[0];
      var lit = pr.next > i || s.phase === 'coast';
      ctx.strokeStyle = lit ? LEAF_MINT : 'rgba(255,255,255,0.75)'; ctx.lineWidth = 5; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(p[0] + nx * (HW + 4), p[1] + ny * (HW + 4)); ctx.lineTo(p[0] - nx * (HW + 4), p[1] - ny * (HW + 4)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = lit ? LEAF_MINT : '#FFF3B3'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      [1, -1].forEach(function (sd) { ctx.beginPath(); ctx.arc(p[0] + nx * (HW + 10) * sd, p[1] + ny * (HW + 10) * sd, 8, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(i + 1), p[0] + nx * (HW + 10), p[1] + ny * (HW + 10) + 5);
    });
    /* Obstacles: the ones out on this lap, each on this lap's side (the logic's own obstacleAt), lying
       flat for as long as the logic says it was knocked over. A mirrored one swaps sides with the fade. */
    obstacles.forEach(function (o, i) {
      var now = lapOn(o, set), was = u < 1 && lapOn(o, from), same = now && was && L.lapLat(o, set) === L.lapLat(o, from), q;
      if (now) { q = L.obstacleAt(track, o, set, tmp); obstacleSprite(ctx, q.x, q.y, skins.obstacle, !!s.obFlatUntil && s.t < s.obFlatUntil[i], same || u >= 1 ? 1 : u); }
      if (was && !same) { q = L.obstacleAt(track, o, from, tmp); obstacleSprite(ctx, q.x, q.y, skins.obstacle, false, 1 - u); }
    });
    /* Crossers: where the race clock puts them (the logic's own crosserAt), see-through while startled */
    var shuffle = red ? 0 : (Math.floor(s.t * 4) % 2 ? 2 : -2);
    crossers.forEach(function (c, i) {
      var a = fade(c);
      if (a) crosserSprite(ctx, L.crosserAt(track, c, s.t, tmp), skins.crosser, a * (s.crFlatUntil && s.t < s.crFlatUntil[i] ? 0.6 : 1), shuffle);
    });
    /* Solo pacers (35% alpha) */
    race.pacers.forEach(function (pc2) {
      var mc = pc2.kind === 'best' ? R.sigColor : ((L.MEDALS[pc2.medal] || {}).color || '#fff');
      kartSprite(ctx, pc2.x, pc2.y, pc2.h, mc, { alpha: 0.35, head: '#ffffff' });
    });
    /* the Glow Crew: white karts with their colour stripe and initial. Another child's kart (a shared
       race) is the same in their colour, see-through while its news is late (steady, never blinking),
       not drawn once it is gone, and carries a name tag: avatar and the name from the roster */
    race.rivals.forEach(function (r) {
      if (r.hidden) return;
      kartSprite(ctx, r.x, r.y - r.airHop * 0.5, r.h, '#ffffff', { stripe: r.color, head: r.color, initial: r.name.charAt(0), scale: 1 + 0.25 * r.airHop / 24, alpha: r.weak ? 0.35 : undefined });
    });
    if (R.live) race.rivals.forEach(function (r, i) { if (r.remote && !r.hidden) nameTag(ctx, r.x, r.y - r.airHop * 0.5 - 30, R.tagOf(i), r.weak ? 0.35 : 1); });
    /* the player: spotlight glow, shadow (offset when airborne), sprite */
    if (k.spotlightT > 0) {
      var g = ctx.createRadialGradient(k.x, k.y, 6, k.x, k.y, 70);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, R.sigColor + '55'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k.x, k.y, 70, 0, 7); ctx.fill();
    }
    if (k.drift.on || k.slide > 0) {
      ctx.strokeStyle = k.onGrass ? PEBBLE : TIER_COL[Math.max(1, k.drift.tier)]; ctx.globalAlpha = k.drift.on ? 0.7 : 0.3; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(k.x, k.y, 24, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    var air = k.airH || 0, sc = 1 + 0.25 * air / 24;
    if (air > 0) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(k.x + air * 0.6, k.y + air, 22, 13, k.h, 0, 7); ctx.fill(); }
    /* a wall spin-out turns the sprite twice; a tumble (a fast touch of a cone) once — and not at all
       under reduced motion, where the word and the lost speed say it */
    var still = !!s.tumbling && red;
    var spinA = k.spinT <= 0 || still ? 0 : s.tumbling ? (1 - k.spinT / L.PHYS.TUMBLE_T) * 2 * Math.PI : (1 - k.spinT / L.PHYS.SPIN_T) * 4 * Math.PI;
    kartSprite(ctx, k.x, k.y - air * 0.4, k.h + spinA, R.kartColor, { scale: sc, head: R.petColor, driver: R.driver2d, rider: R.driver2d && R.rider2d });
    if ((k.spinT > 0 && !still) || (R._dizzy != null && s.t - R._dizzy < 1.2)) {
      ctx.fillStyle = STAR_GOLD; ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var dz = 0; dz < 3; dz++) { var a = s.t * 5 + dz * 2.09; ctx.fillText('✦', k.x + Math.cos(a) * 20, k.y - 26 + Math.sin(a) * 6); }
    }
    if (J) J.p.draw(ctx);
    ctx.restore();
    /* ENCORE LAP: a violet vignette */
    if (s.lapLight === 2) {
      var vg = ctx.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LW * 0.62);
      vg.addColorStop(0, 'rgba(59,30,110,0)'); vg.addColorStop(1, 'rgba(59,30,110,0.18)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, LW, LH);
    }
    /* minimap with every racer */
    var mw = 150, mh = Math.round(150 * L.WH / L.WW), mx = LW - mw - 12, my = 12, sx = mw / L.WW;
    ctx.fillStyle = 'rgba(19,12,46,0.38)'; ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath();
    track.pts.forEach(function (p, i) { if (i) ctx.lineTo(mx + p[0] * sx, my + p[1] * sx); else ctx.moveTo(mx + p[0] * sx, my + p[1] * sx); }); ctx.closePath(); ctx.stroke();
    var p0m = track.pts[0]; ctx.fillStyle = '#fff'; ctx.fillRect(mx + p0m[0] * sx - 3, my + p0m[1] * sx - 3, 6, 6);
    race.pacers.forEach(function (pc3) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(mx + pc3.x * sx, my + pc3.y * sx, 3.5, 0, 7); ctx.fill(); });
    race.rivals.forEach(function (r) { if (r.hidden) return; ctx.fillStyle = r.color; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx + r.x * sx, my + r.y * sx, 4, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = R.kartColor; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx + k.x * sx, my + k.y * sx, 6, 0, 7); ctx.fill(); ctx.stroke();
    /* the Hype Wand: 8 pips under the minimap (they drain through a Spotlight) */
    var pips = k.spotlightT > 0 ? Math.ceil(8 * k.spotlightT / L.PHYS.SPOT_T) : Math.floor(s.wand / 5), wx = LW - 26, wy = my + mh + 32;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(wx - 11, wy - 8, 22, 8 * 16 + 14, 11); else ctx.rect(wx - 11, wy - 8, 22, 8 * 16 + 14); ctx.fill(); ctx.stroke();
    for (var pi = 0; pi < 8; pi++) {
      var on = pi < pips, py = wy + (7 - pi) * 16 + 4;
      ctx.fillStyle = on ? (k.spotlightT > 0 ? STAR_GOLD : R.sigColor) : 'rgba(59,47,74,0.15)';
      ctx.beginPath(); ctx.arc(wx, py, 6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = k.spotlightT > 0 || s.wand >= 35 ? STAR_GOLD : '#FFF3B3'; ctx.beginPath(); ctx.arc(wx, wy - 14, 9, 0, 7); ctx.fill(); ctx.stroke();
    /* place chip + gap chip (Race) or the pacer split (Solo) */
    if (race.rivals.length) {
      chip(ctx, 12, 12, 'P' + s.place + '/' + (race.rivals.length + 1), 'rgba(255,255,255,0.88)', INK);
      if (s.phase === 'race' && s.gap != null && s.place > 1) chip(ctx, 12, 44, '+' + s.gap.toFixed(1) + ' s to P' + (s.place - 1), 'rgba(19,12,46,0.55)', '#fff');
    } else {
      var lg = R.lastGap && R.lastGap();
      if (lg) {
        var pcr = race.pacers.filter(function (x) { return x.kind === lg.kind; })[0], icon = lg.kind === 'best' ? '🏆' : ((L.MEDALS[pcr && pcr.medal] || {}).icon || '');
        chip(ctx, 12, 12, icon + ' ' + (lg.dt <= 0 ? '−' : '+') + Math.abs(lg.dt).toFixed(2), lg.dt <= 0 ? LEAF_MINT : CORAL, INK);
      }
    }
    /* lap pips */
    for (var i = 0; i < track.laps; i++) {
      ctx.fillStyle = i < pr.lap ? LEAF_MINT : 'rgba(255,255,255,0.6)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(LW / 2 - (track.laps - 1) * 14 + i * 28, 22, 9, 0, 7); ctx.fill(); ctx.stroke();
    }
    if (s.wrongT > 0.6) banner(ctx, '↩ WRONG WAY — turn around!', '#ff8a8a');
    else if (R.tip && R.tip()) tipLine(ctx, R.tip());
    if (J) J.bn.draw(ctx, LW / 2, LH * 0.36);
  }
  /* a first-time tip: one still line on a dark pill under the lap pips (white on near-black) */
  function tipLine(ctx, txt) {
    ctx.font = '800 20px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = Math.min(LW - 360, ctx.measureText(txt).width + 32), x = LW / 2 - w / 2, y = 52;
    ctx.fillStyle = 'rgba(19,12,46,0.86)'; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, 36, 18); else ctx.rect(x, y, w, 36);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, LW / 2, y + 19, w - 24);
  }
  function idle(ctx, cfg) {
    hookVariant(cfg);
    var r = makeRound({ sound: function () {}, reduced: true }, (cfg && cfg.variant) || 'track_loop', cfg || {});
    r.render(ctx);
  }
  function preload() {
    if (logic() || typeof document === 'undefined') return Promise.resolve();
    return new Promise(function (res) {
      var sc = document.createElement('script');
      sc.src = 'world/games/kart-logic.js?v=' + (window.SL_WORLD_VER || '1');
      sc.onload = function () { logic(); res(); };
      sc.onerror = function () { res(); };
      document.head.appendChild(sc);
    });
  }

  /* ================================================================
     Race together (V4.55). The button sits in the menu's Play row only
     when PeerJS, shell API 2 and the race logic's shared-race support
     are all loaded and the release switch is on. A tap loads the lobby
     and the race network (never before: solo play does not load them)
     and opens the lobby, which hands one round its session through
     cfg.kartLive. Everything about the other children (names, karts,
     the table) lives in that round's memory only.
     ================================================================ */
  var LIVE = { label: '🏁 Race together', offline: 'Race together needs the internet.', again: '🏁 Race again', back: 'Back to the lobby', fresh: 'Start a new race',
    divider: 'Still racing / didn’t finish', partial: 'Couldn’t get everyone’s results.', wait: 'Getting the results…' };
  var LIVE_FILES = [['SLSocialCore', 'social-core.js', 'slSocialCoreJs'], ['SLKartNet', 'kart-net.js', 'slKartNetJs'], ['SLKartLobby', 'kart-lobby.js', 'slKartLobbyJs']];
  var LIVE_SEND_MS = 100, LIVE_FRAME_MS = 250, LIVE_AWAY_S = 30, LIVE_DONE = 16;   /* LIVE_DONE: the 'finished' flag of a sent state */
  var liveWait = null, liveNote = '';
  function win() { return typeof window !== 'undefined' ? window : null; }
  function social() { var W = win(); return (W && W.SLSocialCore) || (inNode ? require('./social-core.js') : null); }
  function socialAt(fn, i, dflt) { var S = social(); try { return S && typeof S[fn] === 'function' ? S[fn](i) : dflt; } catch (e) { return dflt; } }
  function clockMs() { return typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ? performance.now() : Date.now(); }
  function liveOn(cfg) {
    var W = win(), L = logic(), S = W && W.SLSocialCore;
    if (!W || (cfg && cfg.demo) || typeof W.Peer === 'undefined' || !Shell || !(Shell.API >= 2) || !L || L.NET !== 1) return false;
    return !(S && S.ON && S.ON.race === false);
  }
  /* The three files, each once (a tag another loader added is waited for; one that fails is taken
     out, so a later tap tries again). duel: the challenge words and copy too (duel-core.js). */
  function liveLoad(duel, done) {
    var W = win(), left = 0, bad = false, files = duel ? LIVE_FILES.concat([DUEL_FILE]) : LIVE_FILES;
    function have() { return files.every(function (f) { return !!W[f[0]]; }); }
    if (have()) return done(true);
    /* a load already on its way: wait for it, then ask for whatever this tap still needs */
    if (liveWait) return liveWait.push(function (ok) { if (ok && !have()) liveLoad(duel, done); else done(ok && have()); });
    liveWait = [done];
    function settle() {
      if (--left > 0) return;
      var list = liveWait, ok = !bad && have();
      liveWait = null;
      list.forEach(function (f) { try { f(ok); } catch (e) {} });
    }
    files.forEach(function (f) {
      if (W[f[0]]) return;
      var sc = document.getElementById(f[2]);
      if (!sc) {
        sc = document.createElement('script'); sc.id = f[2]; sc.async = false;
        sc.src = 'world/games/' + f[1] + '?v=' + (W.SL_WORLD_VER || '1');
        document.head.appendChild(sc);
      }
      left++;
      function fail() { bad = true; try { sc.remove(); } catch (e) {} }
      sc.addEventListener('load', function () { if (!W[f[0]]) fail(); settle(); });     /* loaded, yet nothing there: tried afresh next time */
      sc.addEventListener('error', function () { fail(); settle(); });
    });
    if (!left) { left = 1; settle(); }
  }
  /* Greyed with its one line when the lobby (once loaded) says why it can't be offered, or when the
     device is offline. Challenges are Race together rooms with a word: the same gates, so the one
     line under the row speaks for all three buttons. They are there only when the host offers
     challenges (cfg.duels) and the release switch is on, so a half-built challenge is never shown. */
  function menuButtons(cfg) {
    if (!liveOn(cfg)) return [];
    var K = win().SLKartLobby, why = null, note = liveNote, out;
    liveNote = '';
    try { if (K && typeof K.reason === 'function') why = K.reason(cfg); } catch (e) { why = null; }
    if (!why && typeof navigator !== 'undefined' && navigator && navigator.onLine === false) why = { text: LIVE.offline };
    out = [{ id: 'race', label: LIVE.label, disabled: !!why, note: why ? String(why.text || '') : note }];
    if (duelsOn(cfg)) {
      duelCss();
      out.push({ id: 'challenge', label: DUEL.challenge, disabled: !!why }, { id: 'join', label: DUEL.join, disabled: !!why });
      takeChallenge(cfg, !why);
    }
    return out;
  }
  function onMenuButton(id, ctl, cfg) {
    var duel = id === 'challenge' || id === 'join', opts;
    if ((id !== 'race' && !duel) || !ctl || !liveOn(cfg) || (duel && !duelsOn(cfg))) return;
    opts = { mode: id === 'challenge' ? 'host' : id };
    if (id === 'join' && autoJoin && autoJoin.cfg === cfg) opts.code = autoJoin.code;
    autoJoin = null;
    var root = null;
    try {
      root = document.querySelector('.slg');
      document.querySelectorAll('[data-mbtn="race"],[data-mbtn="challenge"],[data-mbtn="join"]').forEach(function (b) { b.disabled = true; });
    } catch (e) {}
    liveLoad(duel, function (ok) {
      /* only for a child still on this game's menu: not one who exited or pressed Play meanwhile */
      if ((root && root.isConnected === false) || ctl.phase() !== 'menu') return;
      if (!ok) { liveNote = LIVE.offline; ctl.menu(); return; }
      try { win().SLKartLobby.open(ctl, cfg, undefined, opts); } catch (e) { ctl.menu(); }
    });
  }
  /* ---------- challenges (the kids update, KG7) ---------- */
  var DUEL = { challenge: '⚔️ Challenge', join: '🔑 Join with a code' };
  var DUEL_FILE = ['SLDuelCore', 'duel-core.js', 'slDuelCoreJs'];
  var autoJoin = null;
  function duelsOn(cfg) {
    var S = win() && win().SLSocialCore;
    return !!cfg && cfg.duels === true && liveOn(cfg) && !(S && S.ON && S.ON.duels === false);
  }
  /* the shell draws a disabled button like a live one: greyed, so a child sees the line under the row matters */
  function duelCss() {
    if (typeof document === 'undefined' || document.getElementById('slkDuelCss')) return;
    var st = document.createElement('style');
    st.id = 'slkDuelCss';
    st.textContent = '.slg-b[data-mbtn="challenge"]:disabled,.slg-b[data-mbtn="join"]:disabled{opacity:.45;cursor:default;}';
    document.head.appendChild(st);
  }
  /* a family pop-up's word (cfg.challenge.join), taken once: with the menu up, its 🔑 is pressed
     for the child, so the join sheet opens with the word in and looking (not when it is greyed) */
  function takeChallenge(cfg, can) {
    var c = cfg.challenge, w;
    if (!c) return;
    cfg.challenge = null;
    w = typeof c.join === 'string' ? c.join.replace(/\s+/g, '').toUpperCase() : '';
    if (!can || !/^[A-Z0-9]{4}$/.test(w)) return;
    autoJoin = { cfg: cfg, code: w };
    setTimeout(function () {
      var b = null;
      try { b = document.querySelector('[data-mbtn="join"]'); } catch (e) { b = null; }
      if (b && !b.disabled) b.click(); else if (autoJoin && autoJoin.cfg === cfg) autoJoin = null;
    }, 0);
  }
  /* the session the lobby handed over for this round, when it is one */
  function liveSession(cfg) {
    try {
      var k = cfg && !cfg.demo ? cfg.kartLive : null, ses = k && typeof k === 'object' ? k.session : null, L = logic();
      if (!ses || !L || L.NET !== 1) return null;
      return ['ghosts', 'table', 'sendState', 'sendFinish', 'on'].every(function (f) { return typeof ses[f] === 'function'; }) ? ses : null;
    } catch (e) { return null; }
  }
  /* the race logic's net option: the other children (their names already from the roster) and the crew */
  function liveNet(ses) {
    var go = ses.go && typeof ses.go === 'object' ? ses.go : {}, kids = [], c = go.crew && typeof go.crew === 'object' ? go.crew : {};
    (Array.isArray(go.players) ? go.players : []).forEach(function (p) {
      if (p && !p.me) kids.push({ seat: p.seat | 0, name: typeof p.name === 'string' ? p.name : '', color: socialAt('colorAt', p.ci, '#ffffff') });
    });
    return { kids: kids, crew: { pace: c.pace, n: c.n | 0 } };
  }
  function andList(list) { return list.length < 2 ? String(list[0] || '') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function liveCss(d) {
    if (!d || d.getElementById('slkLiveCss')) return;
    var c = d.createElement('style');
    c.id = 'slkLiveCss';
    /* a still table: nothing here moves, fades or blinks */
    c.textContent = '.slk-tbl{border-collapse:collapse;margin:2px auto 8px;min-width:240px;max-width:440px;font-weight:700;font-size:15px;}' +
      '.slk-tbl th,.slk-tbl td{padding:3px 8px;text-align:left;}.slk-tbl thead th{font-size:12px;opacity:.75;}' +
      '.slk-tbl tr.me td{background:rgba(255,210,63,.22);}.slk-tbl tr.slk-div th{font-size:13px;opacity:.8;padding-top:8px;}' +
      /* the results' own row: the 'Waiting for …' line over its buttons */
      '.slg-scr .row.slk-again #slgAgainNote{flex:0 0 100%;max-width:none;}' +
      /* a phone held sideways: a tighter table, and the row held at the foot of the sheet, in reach however far it scrolls */
      '@media (max-height: 520px){.slk-tbl{font-size:13px;margin:0 auto 4px;}.slk-tbl th,.slk-tbl td{padding:1px 6px;}.slk-tbl tr.slk-div th{padding-top:4px;}' +
      '.slg-scr .row.slk-again{position:sticky;bottom:-10px;z-index:2;width:100%;padding:4px 0 10px;background:#1d1446;box-shadow:0 -6px 10px rgba(26,18,64,.85);}}';
    d.head.appendChild(c);
  }
  /* The live parts of one round: the others' karts in, my kart and my finish out, the late time,
     the no-pause sheet, the results table and its main button. R is the round, race its race. */
  function liveLink(R, race, ses, cfg) {
    var L = logic(), s = race.s, pr = race.pr, go = ses.go, at = {}, tags = [], mark = true, markAt = -Infinity, sentAt = -Infinity;
    var sent = false, away = 0, over = false, gone = false, last = null, box = null;
    race.rivals.forEach(function (r, i) { if (r.remote) at[r.seat] = i; });
    ((go && go.players) || []).forEach(function (p) { if (p && !p.me && at[p.seat] != null) tags[at[p.seat]] = (socialAt('avatarAt', p.ai, '') + ' ' + race.rivals[at[p.seat]].name).trim(); });
    function ours() { return !gone && ses.go === go; }              /* still this race (a rematch brings a new 'go') */
    function ended() { return over || ses.state === 'closed' || ses.state === 'lost'; }
    function host() { return ses.role === 'host'; }
    function table() { if (ours()) { try { last = ses.table() || last; } catch (e) {} } return last; }
    /* the other children's karts at my race clock: where, how fast, weak or gone, and their finish */
    function sync() {
      var g = [], i, q;
      try { g = ses.ghosts(s.t) || []; } catch (e) { g = []; }
      for (i = 0; i < g.length; i++) {
        q = g[i];
        if (q && at[q.seat] != null) race.setRemote(at[q.seat], q.P, q.lat, (q.weak ? L.REMOTE_WEAK : 0) | (q.gone ? L.REMOTE_HIDDEN : 0), q.finishMs, q.v);
      }
    }
    function send(ms, P) { if (sent) return; sent = true; try { ses.sendFinish(ms, P); } catch (e) {} }
    /* my round ends before the line: 'didn't finish' on every table, with no reason */
    function stop() { if (!pr.finished) send(null, race.Pc()); }
    function quit() { if (R.done) return; R.done = true; purrStop(); stop(); }
    function label() { return ended() ? LIVE.fresh : host() ? LIVE.again : LIVE.back; }
    function add(parent, tag, cls, text) {
      var n = (parent.ownerDocument || document).createElement(tag);
      if (cls) n.className = cls;
      if (text != null && text !== '') n.textContent = text;
      return parent.appendChild(n);
    }
    function who(r) {
      if (r.kind === 'crew') return '✨ ' + String(r.name || 'Glow Crew');
      var n = (socialAt('avatarAt', r.ai, '') + ' ' + String(r.name || '')).trim();
      return r.kind === 'me' ? n + ' (you)' : n;
    }
    /* The table: finished rows with their place, then everyone else under one divider, with no
       place, no reason and no time. A real table, every word set as text. The sheet's title, big
       line and main button follow it, so a place that changed is never shown stale. */
    function paint() {
      if (!box || gone) return;
      if (box.isConnected === false) { box = null; return; }
      var t = table(), rows = (t && t.rows) || [], tbl, tb = null, rest = false, tr, i, r, th, sc, n;
      while (box.firstChild) box.removeChild(box.firstChild);
      if (!rows.length) add(box, 'p', '', LIVE.wait);
      else {
        tbl = add(box, 'table', 'slk-tbl');
        tr = add(add(tbl, 'thead'), 'tr');
        ['Place', 'Racer', 'Time'].forEach(function (h) { add(tr, 'th', '', h).setAttribute('scope', 'col'); });
        for (i = 0; i < rows.length; i++) {
          r = rows[i];
          if (!r) continue;
          /* the finished rows in one body; the rest in a second one under its divider */
          if (!tb || (typeof r.place !== 'number' && !rest)) {
            tb = add(tbl, 'tbody');
            if (typeof r.place !== 'number') { rest = true; th = add(add(tb, 'tr', 'slk-div'), 'th', '', LIVE.divider); th.setAttribute('colspan', '3'); th.setAttribute('scope', 'rowgroup'); }
          }
          tr = add(tb, 'tr', r.kind === 'me' ? 'me' : '');
          add(tr, 'td', '', typeof r.place === 'number' ? ordinal(r.place) : '');
          add(tr, 'td', '', who(r));
          add(tr, 'td', '', typeof r.place === 'number' && typeof r.ms === 'number' ? L.fmt(r.ms) : '—');
        }
      }
      if (ses.state === 'lost' || (ended() && !(t && t.final))) add(box, 'p', 'slg-lock', LIVE.partial);
      sc = box.parentNode;
      if (!sc || !sc.querySelector) return;
      if ((n = sc.querySelector('h2'))) n.textContent = R.summaryTitle();
      if ((n = sc.querySelector('.slg-big'))) n.textContent = R.summaryBig();
      if ((n = sc.querySelector('#slgAgain')) && !n.getAttribute('data-stay') && n.textContent !== label()) n.textContent = label();
    }
    ses.on('table', function () { if (!ours()) return; sync(); race.replace(); table(); paint(); });
    ses.on('lost', function () { if (ours()) { over = true; paint(); } });
    ses.on('closed', function () { if (ours()) { over = true; paint(); } });

    R.live = true;
    R.tagOf = function (i) { return tags[i] || ''; };
    R.table = table;
    /* time away from the screen goes on my clock, kart stopped; more than 30 s of it ends my race */
    R.late = function (sec) {
      if (!(sec > 0) || R.done) return;
      if (!pr.finished) away += sec;
      race.penalty(sec);
      if (away > LIVE_AWAY_S) quit();
    };
    /* no pause in a shared race: one sheet over the running race */
    R.onPause = function (ctl) {
      var root = ctl.sheet(), row, keep, out;
      add(root, 'div', 'slg-emo', '🏁');
      add(root, 'h2', '', 'The race keeps going');
      add(root, 'p', '', 'There’s no pausing in a shared race. The others are still driving.');
      row = add(root, 'div', 'row');
      keep = add(row, 'button', 'slg-b go', '▶ Keep racing');
      keep.type = 'button';
      keep.addEventListener('click', function () { var ph = ctl.phase(); if (ph === 'playing' || ph === 'countdown') ctl.screen(null); });
      out = add(row, 'button', 'slg-b alt', 'Leave race');
      out.type = 'button';
      out.addEventListener('click', quit);
      try { keep.focus({ preventScroll: true }); } catch (e) {}
    };
    /* the table goes into the shell's slot; the shell's 'Waiting for …' line moves into the row, over
       the button it explains, so the two are always seen together (a phone held sideways included) */
    R.resultsExtra = function (el) {
      var again, row, note;
      box = el; liveCss(el.ownerDocument); paint();
      coachShow(el, R.coachLine());
      try {
        again = el.parentNode.querySelector('#slgAgain'); row = again && again.parentNode; note = el.parentNode.querySelector('#slgAgainNote');
        if (row && row.classList) { row.classList.add('slk-again'); if (note) row.insertBefore(note, row.firstChild); }
      } catch (e) {}
    };
    /* the results' main button: every way on goes through the lobby (it goes back to the room itself) */
    Object.defineProperty(R, 'againLabel', { get: label, enumerable: true, configurable: true });
    R.again = function (ctl) {
      var K = win() && win().SLKartLobby, t = table();
      if (host() && !ended() && !(t && t.final)) return;     /* held until nobody is still driving */
      if (K && typeof K.open === 'function') K.open(ctl, cfg); else ctl.menu();
    };
    R.againState = function () {
      var t = table(), open = !ended() && !(t && t.final), w = t && Array.isArray(t.waitingFor) ? t.waitingFor : [];
      return { disabled: open && host(), note: !open ? '' : w.length ? 'Waiting for ' + andList(w) + ' to finish' : host() ? 'Waiting for the others to finish' : '' };
    };
    /* on exit: a starter whose table is not final goes on passing messages with no screen; anyone else leaves */
    R.detach = function () {
      if (!ours()) return;
      var t = table();
      try { if (host() && !(t && t.final)) ses.detach(); else ses.leave(); } catch (e) {}
    };
    return {
      /* once per drawn frame (the view calls render or hud after the steps), before the steps */
      frame: function () {
        var t = clockMs();
        if (!mark && t - markAt < LIVE_FRAME_MS) return;
        mark = false; markAt = t;
        if (!ours()) return;
        sync();
        if (t - sentAt < LIVE_SEND_MS) return;
        sentAt = t;
        try { ses.sendState(s.t, race.Pc(), race.lateral(), race.k.v, pr.finished ? LIVE_DONE : 0); } catch (e) {}
      },
      drawn: function () { mark = true; },
      finish: function () { var res = race.result(); if (res) send(res.ms, s.finishPc); },
      stop: stop,
      /* the end of the coast: the place again from the finishes known now */
      settle: function () { if (!ours()) return; sync(); race.replace(); table(); },
      place: function () {
        var t = table(), i;
        if (t && Array.isArray(t.rows)) for (i = 0; i < t.rows.length; i++) if (t.rows[i] && t.rows[i].kind === 'me') return typeof t.rows[i].place === 'number' ? t.rows[i].place : null;
        return pr.finished ? s.finishPlace : null;
      },
      /* the game is closing: what this round held about the others goes with it */
      dispose: function () { gone = true; box = null; last = null; tags = []; }
    };
  }

  /* ---------- shell hooks ---------- */
  /* the brake pad says what it does (V4.55 fix run B11: a bare ⬇ read as 'down') */
  function controlsFor(cfg) {
    var o = loadOpts(cfg);
    var c = [{ id: 'left', label: '⬅', side: 'left' }, { id: 'right', label: '➡', side: 'left' }, { id: 'down', label: '⬇ Brake', side: 'right', aria: 'Brake' }];
    /* Easy Drive holds the gas, so GO goes and ✨ becomes the big pad */
    if (o.easy) c.push({ id: 'drift', label: '✨ DRIFT', side: 'right', wide: true, aria: 'Drift and trick' });
    else c.push({ id: 'drift', label: '✨', side: 'right', aria: 'Drift and trick' }, { id: 'up', label: 'GO', side: 'right', wide: true, aria: 'Accelerate' });
    return c;
  }
  /* the camera chips (the HUD's 🎥 button cycles through the same four, with the same names) */
  var CAM_CHIPS = [{ value: 'chase', label: '🎥 Chase' }, { value: 'stage', label: '🎤 Stage' }, { value: 'map', label: '🗺️ Map' }, { value: 'tv', label: '📺 TV' }];
  /* the Glow Crew row and the Camera row wait under "More options" until this child's first finish
     (V4.55 fix run B5): a new driver sees the course, Race or Solo and Easy Drive */
  function moreOpen(cfg) { return !!(cfg && cfg._kartMore) || hasKartPb(cfg); }
  function menuOptions(cfg) {
    hookVariant(cfg);
    var L = logic(), o = loadOpts(cfg), variant = (cfg && cfg.variant) || 'track_loop', out = [], more = moreOpen(cfg), extra = false;
    /* the cards follow the course on the menu (the shell shows them only from this menu) */
    if (coursesOn()) def.tutorial = cardsFor(cfg);
    /* the play-test copy says so on the menu (a row with a label and nothing to choose) */
    if (qaCopy()) out.push({ id: 'qa', label: 'TEST COPY: times are not saved', value: '', options: [] });
    out.push({ id: 'mode', label: 'Mode', value: o.mode, options: [{ value: 'race', label: '🏁 Race' }, { value: 'solo', label: '⏱️ Solo' }] });
    out.push({ id: 'easy', label: 'Easy Drive', value: !!o.easy, options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }] });
    if (o.mode === 'race') {
      extra = true;
      /* the Glow Crew's speed (this row was 'Stage': that word is now only the camera). A course with
         no medal times yet has no time to aim for "here", so no lock note */
      var cls = effCls(cfg, o, variant), C = L.CLASSES, here = !!L.PAR[variant];
      if (more) out.push({ id: 'cls', label: 'Glow Crew — ' + C[cls].name + ': ' + C[cls].tip, value: cls, options: C.map(function (c, i) {
        var locked = !clsOpen(cfg, variant, i), M = L.MEDALS[i];
        return { value: i, label: c.icon + ' ' + c.name, locked: locked, note: locked && here ? '🔒 Get a ' + M.icon + ' ' + M.name + ' time here to unlock ' + c.icon + ' ' + c.name : '' };
      }) });
    }
    if (view3dOn(cfg)) {
      extra = true;
      if (more) out.push({ id: 'cam', label: 'Camera', value: CAMS.indexOf(o.cam) >= 0 ? o.cam : 'chase', options: CAM_CHIPS });
    }
    if (extra && !more) out.push({ id: 'more', label: '', value: false, options: [{ value: true, label: '⚙️ More options' }] });
    return out;
  }
  function setOption(cfg, id, value) {
    var o = loadOpts(cfg);
    if (id === 'more') { if (cfg) cfg._kartMore = value === true; return; }      /* for this visit only */
    if (id === 'mode' && MODES.indexOf(value) >= 0) o.mode = value;
    else if (id === 'cls' && (value === 0 || value === 1 || value === 2)) o.cls = value;
    else if (id === 'easy') o.easy = !!value;
    else if (id === 'cam' && CAMS.indexOf(value) >= 0) o.cam = value;
    else return;
    saveOpts(cfg, o);
  }
  function pbText(rec, variant) {
    var L = logic();
    if (!L) return '';
    var par = L.PAR[variant];
    if (!rec || rec.ms == null) return par ? 'No best yet — set one! 🥉 Bronze is ' + L.fmt(par.bronze, 1) : '';
    if (!par && coursesOn() && L.isCourse(variant)) return '🏆 Best ' + L.fmt(rec.ms);   /* a course with no medal times yet */
    var m = L.medalFor(variant, rec.ms), nm = L.nextMedal(variant, rec.ms), M = L.MEDALS[m];
    return '🏆 Best ' + L.fmt(rec.ms) + ' · ' + M.icon + ' ' + M.name +
      (nm ? ' · Next: ' + nm.icon + ' ' + nm.name + ' ' + L.fmt(nm.ms) + ' (' + (nm.gap / 1000).toFixed(1) + ' s to go)' : ' · Top of the podium!');
  }

  /* The How-to-play cards. V4.55 fix run B5: two short cards (V4.55's four held about 18 ideas);
     drifting, the strips and tricks are said in the race instead, the first time each is useful
     (TIP_TEXT). The cards follow the menu's course and Easy Drive: the Glow Line is only there with
     Easy Drive on, and card 2 names what is on this road. CARDS_V454 is kept, word for word, for a
     cached V4.54 kart-logic.js (whose tracks have none of the new things). */
  var CARDS_V454 = [
    ['🏎️', 'Hold GO to drive · ⬅ ➡ steer · ⬇ brake. Easy Drive does the GO for you!'],
    ['✨', 'In a bend, hold ✨ while you steer. Sparks go blue → pink → gold — let go for a boost!'],
    ['🎵', 'Zoom over Beat Strips (pink = on the beat!), grab ♪ notes, and tap ✨ in the air off the jump.'],
    ['🎤', 'Fill your Hype Wand for SPOTLIGHT! Gates 1-2-3 then the finish — pass the Glow Crew and beat your best!']
  ];
  var CARD_EASY = ['🏎️', 'Steer ⬅ ➡ · Easy Drive does the GO for you'], CARD_GO = ['🏎️', 'Hold GO to drive · steer ⬅ ➡ · ⬇ Brake slows you'];
  /* what a course's knock-over things are called, by their look */
  var OB_NAME = { cone: 'cones', crystal: 'crystals', sandcastle: 'sandcastles' };
  function cardsFor(cfg) {
    var L = logic(), v = (cfg && cfg.variant) || def.defaultVariant, F = null, things = '';
    try { F = L.buildTrack(v).feat; } catch (e) { F = null; }
    if (F && (F.obstacles || []).length) things = OB_NAME[(F.skins || {}).obstacle] || 'cones';
    if (loadOpts(cfg).easy === false) return [CARD_GO, ['🏁', (things ? 'Steer round the ' + things + ' · g' : 'G') + 'ates 1-2-3, then the finish line!']];
    return [CARD_EASY, ['🛣️', 'Follow the Glow Line round the ' + (things || 'bends')]];
  }
  var CARDS = [CARD_EASY, ['🛣️', 'Follow the Glow Line round the cones']];
  var def = {
    key: 'kart', title: 'Neon Grand Prix', emoji: '🏎️', LW: LW, LH: LH, defaultVariant: 'track_loop',
    tutorial: CARDS,
    menuVariants: menuVariants, menuVariantsTitle: 'Choose your course', menuVariantsLabel: 'course',
    controls: controlsFor({}),
    controlsFor: controlsFor,
    keys: { 'ArrowUp': 'up', 'w': 'up', 'W': 'up', 'ArrowDown': 'down', 's': 'down', 'S': 'down', 'ArrowLeft': 'left', 'a': 'left', 'A': 'left', 'ArrowRight': 'right', 'd': 'right', 'D': 'right',
      ' ': 'drift', 'Shift': 'drift', 'x': 'drift', 'X': 'drift' },
    countdown: 3,
    music: { track: 'kart' },
    view3d: { src: 'world/games/kart-3d.js' },
    resultsGlass: true,
    menuOptions: menuOptions, setOption: setOption, pbText: pbText,
    /* V4.55 Race together (shell API 2; an older shell never asks) */
    menuButtons: menuButtons, onMenuButton: onMenuButton,
    preload: preload, idle: idle, newRound: newRound
  };
  /* the course list and the Remix cards only with race logic that has the courses: without them the
     shell draws the V4.54 track chips from cfg.ownedVariants and the V4.54 cards */
  function syncDef() {
    var on = coursesOn();
    def.menuVariants = on ? menuVariants : null;
    def.tutorial = on ? CARDS : CARDS_V454;
  }
  syncDef();
  var game = Shell ? Shell.define(def) : null;
  /* the game's start is wrapped: see onStart */
  if (game && typeof game.start === 'function') {
    var shellStart = game.start;
    game.start = function (cfg) { try { onStart(cfg); } catch (e) {} return shellStart.apply(this, arguments); };
  }
  if (inNode) {
    module.exports = {
      buildTrack: KL.buildTrack, newRound: newRound, newProgress: KL.newProgress, updateProgress: KL.updateProgress, nearest: KL.nearest,
      TRACKS: KL.TRACKS, LAPS: KL.LAPS, CHECKS: KL.CHECKS, WALL: KL.WALL, VMAX: KL.VMAX,
      def: def, loadOpts: loadOpts, controlsFor: controlsFor, menuOptions: menuOptions, setOption: setOption, pbText: pbText,
      COACH: COACH, DUEL: DUEL
    };
  }
})();
