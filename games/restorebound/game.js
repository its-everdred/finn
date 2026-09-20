// RestoreBound — an Earthbound-inspired opening.
// Engine: Kaboom.js 3000 (MIT). Sprites live in sprites.js.
//
// Story: something crashes on the hill in a storm of purple light. You find a
// present in your sister's room — a sword. Then LYGON breaks in and
// kidnaps your little brother and sister. Go get them back.

const W = 320, H = 240;

kaboom({
  canvas: document.getElementById("game"),
  width: W, height: H, scale: 3,
  background: [11, 11, 20],
  crisp: true, pixelDensity: 1,
});

// The Hollow's art is drawn in sprites.js against this contract. Until a key lands there, a
// magenta/ink checker stands in for it so the game still runs; the real art swaps in on load.
const SPRITE_CONTRACT = ["orb", "malva", "swooper1", "swooper2", "swooper3", "stomper1", "stomper2", "stomper3", "hollowgate"];
const PLACEHOLDER = Array.from({ length: 24 }, (_, y) => Array.from({ length: 24 }, (_, x) => (((x >> 2) + (y >> 2)) % 2 ? "m" : "j")).join(""));
SPRITE_CONTRACT.forEach((k) => {
  if (!window.SPRITES[k]) { console.warn(`sprites: "${k}" is not drawn yet; using a placeholder`); window.SPRITES[k] = PLACEHOLDER; }
});
// A sprite is either a row grid (shared palette) or { rows, pal } carrying its own palette.
// Every sprite is its own texture in Kaboom, so the load is 257 image decodes. On a phone that
// burst is the heaviest moment of the whole game: the 96 walking facings are deferred until the
// first scene is up and then fed in small batches, and the rest go in chunks across frames.
const SPRITE_READY = new Set();
const spriteSrc = (v) => Array.isArray(v) ? window.pixels(v) : window.pixels(v.rows, v.pal);
const FACING_RE = /_(d|u|l|r|dl|dr|ul|ur)$/;
const spriteKeys = Object.keys(window.SPRITES);
const WALKERS = ["hero", "hero_sword", "hero_giant", "sis", "bro", "mom", "dad", "dog", "pip", "zed", "bruno", "bloop"];
const facingKeys = spriteKeys.filter((k) => FACING_RE.test(k) && WALKERS.includes(k.replace(FACING_RE, "")));
const coreKeys = spriteKeys.filter((k) => !facingKeys.includes(k));
coreKeys.forEach((k) => { loadSprite(k, spriteSrc(window.SPRITES[k])); SPRITE_READY.add(k); });
let facingQueue = facingKeys.slice();
function loadFacingsSlowly() {
  if (!facingQueue.length) return;
  const batch = facingQueue.splice(0, 12);
  Promise.all(batch.map((k) => loadSprite(k, spriteSrc(window.SPRITES[k])))).then(() => { batch.forEach((k) => SPRITE_READY.add(k)); setTimeout(loadFacingsSlowly, 120); }, () => setTimeout(loadFacingsSlowly, 120));
}
setTimeout(loadFacingsSlowly, 1500);

// ---------------------------------------------------------------- game state

const START = {
  hasSword: false, kidnapped: false, boomed: false, hasKey: false, talkedSis: false, talkedBro: false, talkedMom: false, talkedDad: false,
  cave: 0, beatBugon: false, party: [], branchSide: null, branchEnemy: null, branchDone: false, branchSeen: false, giantSword: false, hp: 40, pp: 30, cookies: 3, juice: 1,
  beatLygon: false, hollow: 0, beatMalva: false,
  // after Lygon: the walk home, the trouble next door, the King, the friends
  homeAgain: false, kingFled: false, friends: false, partyHp: {}, rockets: 3, seenMess: false, seenHome: false, seenMechs: [],
  // the pantry, and the summit after the Hollow: Yugrin runs off with the orb
  soda: 2, bombs: 0, yugrinHasOrb: false, beatYugrin: false,
};
const state = { name: "Finn", sis: "Lily", bro: "Max", dog: "Biscuit", maxHp: 40, maxPp: 30, ...START };

// space is the main button; "/" is back. z and enter also confirm.
const SAVE_KEY = "restorebound.save.v1";
function save(sceneName) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ scene: sceneName, state })); } catch (e) { /* private mode etc. */ }
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
// Old saves keep working across updates: fill in any field a newer build added,
// keep the player's names and progress, and fall back to a scene that still exists.
const SCENES = ["upstairs", "downstairs", "town", "cave", "town2", "hollow", "house2", "road", "summit"];
const PARTY_NAMES = ["sis", "bro", "pip", "zed", "bruno", "bloop"];
function migrate(saved) {
  const st = { ...START, name: state.name, sis: state.sis, bro: state.bro, dog: state.dog, maxHp: state.maxHp, maxPp: state.maxPp, ...(saved.state || {}) };
  // a save from a build with different progress rules never traps the player: clamp what could
  st.hp = Math.min(Math.max(1, st.hp | 0), st.maxHp); st.pp = Math.min(Math.max(0, st.pp | 0), st.maxPp);
  st.cave = Math.min(Math.max(0, st.cave | 0), CAVE_ENEMIES.length);
  st.hollow = Math.min(Math.max(0, st.hollow | 0), HOLLOW_ORDER.length);
  st.beatLygon = !!st.beatLygon; st.beatMalva = !!st.beatMalva;
  st.homeAgain = !!st.homeAgain; st.kingFled = !!st.kingFled; st.friends = !!st.friends; st.seenMess = !!st.seenMess; st.seenHome = !!st.seenHome; if (!Array.isArray(st.seenMechs)) st.seenMechs = [];
  st.party = Array.isArray(st.party) ? st.party.filter((n) => PARTY_NAMES.includes(n)) : [];
  st.partyHp = st.partyHp && typeof st.partyHp === "object" ? { ...st.partyHp } : {};
  st.rockets = Math.max(0, st.rockets | 0);
  st.soda = Math.max(0, st.soda | 0); st.bombs = Math.max(0, st.bombs | 0);
  st.yugrinHasOrb = !!st.yugrinHasOrb && st.beatMalva; st.beatYugrin = !!st.beatYugrin && st.beatMalva;
  // a save from before the King: in that build the family was already home after Lygon
  if (st.beatLygon && !("homeAgain" in (saved.state || {}))) st.homeAgain = true;
  // the flags only ever go forward in this order
  if (!st.beatLygon) st.homeAgain = false;
  if (!st.homeAgain) st.kingFled = false;
  if (!st.kingFled) { st.friends = false; st.party = st.party.filter((n) => n === "sis" || n === "bro"); }
  if (st.homeAgain) st.party = st.party.filter((n) => n !== "sis" && n !== "bro");
  let scene = saved.scene;
  // the east town, the road and the Hollow only exist once Lygon is beaten
  if ((scene === "town2" || scene === "hollow" || scene === "road") && !st.beatLygon) scene = "town";
  if (scene === "house2" && !st.homeAgain) scene = "town";
  if (scene === "summit" && !st.beatMalva) scene = st.beatLygon ? "hollow" : "town";
  if (!SCENES.includes(scene)) scene = st.kidnapped ? "town" : "upstairs";
  return { scene, state: st };
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
// The page's Restart button calls this.
window.restoreboundRestart = () => { clearSave(); Object.assign(state, START); go("title", { fresh: true }); };

const INTERACT = ["space", "z", "enter"];
onKeyPress("m", () => { const m = music.toggleMute(); const b = document.getElementById("mute"); if (b) b.textContent = m ? "Unmute (M)" : "Mute (M)"; });
const BACK = ["/", "x", "escape"];

// ---------------------------------------------------------------- dialog box

let dialogOpen = false;

function say(lines, onDone) {
  if (dialogOpen) return;
  dialogOpen = true;
  let i = 0;
  add([rect(W - 16, 60, { radius: 3 }), pos(8, H - 68), color(20, 20, 36), outline(2, rgb(232, 232, 240)), fixed(), z(100), "dialog"]);
  const txt = add([text("", { size: 8, width: W - 36, lineSpacing: 3 }), pos(18, H - 58), color(232, 232, 240), fixed(), z(101), "dialog"]);
  const cue = arrowObj("down", W - 18, H - 18, 4, [242, 208, 92], [fixed(), z(101), "dialog"]);
  cue.onUpdate(() => { cue.hidden = Math.floor(time() * 3) % 2 === 0; });

  let shown = 0, full = lines[0], typing = true;
  const tick = txt.onUpdate(() => {
    if (!typing) return;
    shown = Math.min(full.length, shown + 1.4);
    txt.text = full.slice(0, Math.floor(shown));
    if (Math.floor(shown) >= full.length) typing = false;
  });
  const cancels = INTERACT.map((k) => onKeyPress(k, advance));
  const clickCancel = onClick(advance);

  function advance() {
    if (typing) { typing = false; txt.text = full; return; }
    i += 1;
    if (i >= lines.length) {
      cancels.forEach((c) => c.cancel()); clickCancel.cancel(); tick.cancel();
      destroyAll("dialog"); dialogOpen = false;
      onDone && onDone();
      return;
    }
    full = lines[i]; shown = 0; typing = true;
    music.sfx("talk");
  }
}

// ---------------------------------------------------------------- pause menu (B outside battle)

// Cookie / Juice from anywhere in the overworld. Uses the dialog lock so the player
// stands still and NPCs stay quiet while it is open.
function openMenu() {
  if (dialogOpen) return;
  dialogOpen = true;
  music.sfx("select");
  let idx = 0;
  const rows = () => [
    { label: `Cookie  x${state.cookies}   (+15 HP)`, use: () => {
      if (state.cookies <= 0) return flash("No cookies left!");
      const heal = Math.min(state.maxHp - state.hp, 15);
      if (heal <= 0) return flash("HP is already full.");
      state.cookies -= 1; state.hp += heal; music.sfx("heal"); flash(`+${heal} HP. Mmm.`);
    } },
    { label: `Juice   x${state.juice}   (full HP+PP)`, use: () => {
      if (state.juice <= 0) return flash("No juice left!");
      const heal = state.maxHp - state.hp, pp = state.maxPp - state.pp;
      if (heal <= 0 && pp <= 0) return flash("Everything is already full.");
      state.juice -= 1; state.hp = state.maxHp; state.pp = state.maxPp; music.sfx("heal"); flash(`+${heal} HP, +${pp} PP! Everything's full!`);
    } },
    { label: `Soda    x${state.soda}   (+12 PP)`, use: () => {
      if (state.soda <= 0) return flash("No soda left!");
      const pp = Math.min(state.maxPp - state.pp, 12);
      if (pp <= 0) return flash("PP is already full.");
      state.soda -= 1; state.pp += pp; music.sfx("heal"); flash(`+${pp} PP. Fizzy.`);
    } },
    { label: "Close", use: close },
  ];
  const N = rows().length;
  add([rect(W - 16, 76, { radius: 3 }), pos(8, H - 84), color(20, 20, 36), outline(2, rgb(232, 232, 240)), fixed(), z(100), "menu"]);
  const head = add([text("", { size: 8 }), pos(18, H - 76), color(242, 208, 92), fixed(), z(101), "menu"]);
  const lines = [0, 1, 2, 3].map((i) => add([text("", { size: 8 }), pos(30, H - 62 + i * 13), color(232, 232, 240), fixed(), z(101), "menu"]));
  const cur = arrowObj("right", 22, H - 58, 4, [242, 208, 92], [fixed(), z(101), "menu"]);
  const note = add([text("", { size: 8 }), pos(W - 18, H - 76), anchor("topright"), color(207, 207, 216), fixed(), z(101), "menu"]);
  let noteUntil = 0;
  function flash(t) { note.text = t; noteUntil = time() + 1.6; }
  head.onUpdate(() => {
    head.text = `${state.name}   HP ${state.hp}/${state.maxHp}   PP ${state.pp}/${state.maxPp}`;
    rows().forEach((r, i) => { lines[i].text = r.label; lines[i].color = i === idx ? rgb(242, 208, 92) : rgb(232, 232, 240); });
    cur.pos.y = H - 62 + idx * 13;
    if (time() > noteUntil) note.text = "";
  });
  const hs = [];
  ["up", "w", "8"].forEach((k) => hs.push(onKeyPress(k, () => { idx = (idx + N - 1) % N; music.sfx("move"); })));
  ["down", "s", "2"].forEach((k) => hs.push(onKeyPress(k, () => { idx = (idx + 1) % N; music.sfx("move"); })));
  INTERACT.forEach((k) => hs.push(onKeyPress(k, () => rows()[idx].use())));
  BACK.forEach((k) => hs.push(onKeyPress(k, close)));
  function close() {
    hs.forEach((h) => h.cancel()); destroyAll("menu"); dialogOpen = false; music.sfx("back");
  }
}
function wireMenu() {
  // opened on the next frame so the B press that opens it is not also read as "close"
  BACK.forEach((k) => onKeyPress(k, () => { if (!dialogOpen) wait(0, openMenu); }));
}

// ---------------------------------------------------------------- overworld helpers

// Party members trail the hero along the path he actually walked: the player's recent
// positions are kept in a ring, and follower i sits a fixed number of frames behind.
function makeFollowers(player) {
  // callable again when the party changes mid-scene
  destroyAll("follower"); if (player.followUpd) { player.followUpd.cancel(); player.followUpd = null; }
  const names = state.party || [];
  if (!names.length) return [];
  const GAP = 14, trail = [];
  const fol = names.map((nm, i) => add([sprite(facingKey(nm, "d")), pos(player.pos.x, player.pos.y + 6), anchor("topleft"), z(9.5 - i * 0.01), "follower"]));
  fol.forEach((f, i) => { f.spriteBase = names[i]; f.facing = "d"; });
  let last = player.pos.clone();
  player.followUpd = player.onUpdate(() => {
    if (player.pos.dist(last) > 0.4) { trail.unshift(player.pos.clone()); last = player.pos.clone(); if (trail.length > GAP * names.length + 2) trail.pop(); }
    fol.forEach((f, i) => {
      const t = trail[Math.min(trail.length - 1, GAP * (i + 1))];
      if (t) {
        const target = t.add(3, 6), was = f.pos.clone();
        f.pos = f.pos.lerp(target, Math.min(1, 12 * dt()));
        // each follower faces the way it last moved, from its own position delta
        const fd = facingFrom(f.pos.sub(was), f.facing);
        if (fd !== f.facing) { f.facing = fd; f.use(sprite(facingKey(f.spriteBase, fd))); }
      }
      f.z = 9.5 + f.pos.y / 1000;
    });
  });
  return fol;
}
// The fighters. sis and bro walk with you but never fight; the friends and Mr. Bloop do.
const PARTY_MAX = { pip: 32, zed: 34, bruno: 46, bloop: 38 };
const PARTY_LABEL = { pip: "Pip", zed: "Zed", bruno: "Bruno", bloop: "Bloop" };
function fighters() { return (state.party || []).filter((n) => PARTY_MAX[n]); }
function partyHpInit() {
  if (!state.partyHp || state.partyHp === START.partyHp) state.partyHp = {};
  fighters().forEach((n) => { if (state.partyHp[n] == null) state.partyHp[n] = PARTY_MAX[n]; });
}
// everyone heals where the hero heals
function healAll(n) {
  partyHpInit();
  state.hp = Math.min(state.maxHp, state.hp + n);
  fighters().forEach((m) => { state.partyHp[m] = Math.min(PARTY_MAX[m], state.partyHp[m] + n); });
}
function fullHeal() {
  partyHpInit();
  state.hp = state.maxHp; state.pp = state.maxPp;
  fighters().forEach((m) => { state.partyHp[m] = PARTY_MAX[m]; });
}

function heroSprite() { return state.giantSword ? "hero_giant" : state.hasSword ? "hero_sword" : "hero"; }
// A real arrow (shaft + head) as one polygon, `size` = half its length. Points left/right/up/down.
// Extra comps (z, fixed, tags) go in `extra`; the object supports color, scale, opacity, hidden like text did.
const ARROW_ANGLE = { right: 0, down: 90, left: 180, up: 270 };
function arrowObj(dir, x, y, size, col, extra = []) {
  const s = size, h = s * 0.55, w = s * 0.34;
  const pts = [vec2(-s, -w), vec2(s - h, -w), vec2(s - h, -h * 1.1), vec2(s, 0), vec2(s - h, h * 1.1), vec2(s - h, w), vec2(-s, w)];
  return add([polygon(pts), pos(x, y), rotate(ARROW_ANGLE[dir] || 0), color(...col), opacity(1), ...extra]);
}
// 8-direction facings. sprites.js may carry `<base>_<dir>` (d u l r dl dr ul ur) drawn on the
// same canvas and foot anchor as the base; where a facing is not drawn yet, the base stands in.
// Hits are cached; a miss is re-checked each call so art that lands later is picked up.
const FACING_HIT = {};
function facingKey(base, dir) {
  const k = `${base}_${dir || "d"}`;
  if (FACING_HIT[k]) return k;
  if (SPRITE_READY.has(k)) { FACING_HIT[k] = true; return k; }
  return base;
}
// direction name from a movement vector; inside the deadzone the old facing is kept
function facingFrom(v, last = "d") {
  if (!v || v.len() < 0.05) return last;
  const a = Math.atan2(v.y, v.x); // 0 = right, +y = down (screen space)
  return ["r", "dr", "d", "dl", "l", "ul", "u", "ur"][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
function makePlayer(x, y) {
  const p = add([
    sprite(facingKey(heroSprite(), "d")), pos(x, y), rotate(0),
    area({ shape: new Rect(vec2(6, 22), 10, 9) }), body(), anchor("topleft"), z(10), "player",
  ]);
  p.facing = "d";
  const SPEED = 85;
  p.onUpdate(() => {
    if (dialogOpen || window.__frozen) return;
    let d = vec2(0, 0);
    if (isKeyDown("left") || isKeyDown("a") || isKeyDown("4")) d.x -= 1;
    if (isKeyDown("right") || isKeyDown("d") || isKeyDown("6")) d.x += 1;
    if (isKeyDown("up") || isKeyDown("w") || isKeyDown("8")) d.y -= 1;
    if (isKeyDown("down") || isKeyDown("s") || isKeyDown("2")) d.y += 1;
    if (d.len() > 0) {
      p.move(d.unit().scale(SPEED));
      // the facing re-derives from heroSprite() each swap, so a sword picked up elsewhere
      // (player.use(sprite("hero_sword"))) keeps its base on the next turn
      const f = facingFrom(d, p.facing);
      if (f !== p.facing) { p.facing = f; p.use(sprite(facingKey(heroSprite(), f))); }
    }
    p.z = 10 + p.pos.y / 1000; // walk behind/in front of npcs by y
  });
  return p;
}

function wall(x, y, w, h, col) {
  const o = add([rect(w, h), pos(x, y), area(), body({ isStatic: true }), color(...(col || [0, 0, 0])), "wall"]);
  if (!col) o.hidden = true;
  return o;
}

function npc(spr, x, y, tag, talk, opts = {}) {
  // opts.face: one of d u l r dl dr ul ur; uses `<spr>_<face>` when drawn, else spr
  const n = add([sprite(opts.face ? facingKey(spr, opts.face) : spr), pos(x, y), area({ shape: new Rect(vec2(2, opts.footY ?? 12), 12, 8) }), body({ isStatic: true }), anchor("topleft"), z(9 + y / 1000), tag, "npc"]);
  n.talk = talk;
  n.baseY = y; n.cut = false;
  n.onUpdate(() => { if (!n.cut) n.pos.y = n.baseY + (Math.sin(time() * 2 + x) > 0.85 ? -1 : 0); });
  return n;
}

function wireTalk(player) {
  INTERACT.forEach((k) => onKeyPress(k, () => {
    if (dialogOpen) return;
    const me = player.pos.add(11, 26);
    let best = null, bestD = 36;
    get("npc").forEach((n) => {
      const d = me.dist(n.pos.add(n.width / 2, n.height - 4));
      if (d < bestD) { bestD = d; best = n; }
    });
    if (best) best.talk();
  }));
}

// Every scene starts here: camera home, and any dialog/freeze left over from the previous
// scene is cleared, so a scene change mid-dialog can never leave the player locked.
function resetCam() {
  camPos(W / 2, H / 2);
  dialogOpen = false; window.__frozen = false;
  if (window.rbNaming) window.rbNaming(false);
}

// the cave is one tall map; the camera follows the player up it
const CAVE_H = 1000;
const CAVE_ENEMIES = ["chompo", "zagg", "skitter", "wibblo", "redstack", "boxor"];
// the Hollow is one tall hall too; ground and air fights alternate, bottom to top
const HOLLOW_H = 660;
const HOLLOW_ORDER = ["clonk", "skreek", "thud", "flitz", "grumbo", "batty"];

function hud() {
  const t = add([text("", { size: 8 }), pos(10, 6), color(232, 232, 240), z(50), fixed()]);
  t.onUpdate(() => { t.text = `${state.name}  HP ${state.hp}/${state.maxHp}  PP ${state.pp}/${state.maxPp}`; });
  // the fighters' HP under it, once anyone has joined
  const p = add([text("", { size: 8 }), pos(10, 16), color(207, 207, 216), z(50), fixed()]);
  p.onUpdate(() => { p.text = fighters().map((n) => `${PARTY_LABEL[n]} ${(state.partyHp && state.partyHp[n]) ?? PARTY_MAX[n]}`).join("   "); });
}

// purple lightning through a window: flashes + a rumble
function drawWindow(wn) {
  add([rect(wn.w + 4, wn.h + 4), pos(wn.x - 2, wn.y - 2), color(20, 20, 36)]);
  add([rect(wn.w, wn.h), pos(wn.x, wn.y), color(28, 22, 52)]);
  add([rect(2, wn.h), pos(wn.x + wn.w / 2 - 1, wn.y), color(232, 232, 240), z(4)]);
  add([rect(wn.w, 2), pos(wn.x, wn.y + wn.h / 2 - 1), color(232, 232, 240), z(4)]);
}
function stormFlashes(windows) {
  const glows = windows.map((wn) => add([rect(wn.w, wn.h), pos(wn.x, wn.y), color(199, 123, 214), opacity(0), z(3)]));
  const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0), z(90), fixed()]);
  const set = (g, w) => { glows.forEach((o) => o.opacity = g); wash.opacity = w; };
  function flash() {
    set(0.95, 0.35); shake(rand(4, 12));
    wait(0.08, () => set(0.45, 0.12));
    wait(0.16, () => set(0, 0));
    if (Math.random() < 0.5) wait(0.25, () => { set(0.75, 0.25); wait(0.08, () => set(0, 0)); });
  }
  loop(rand(1.1, 2.2), flash);
  wait(0.2, flash);
}

// ---------------------------------------------------------------- scene: title + naming

scene("title", (opts = {}) => {
  resetCam();
  music.play("title");
  const saved = opts.fresh ? null : loadSave();
  add([rect(W, H), pos(0, 0), color(11, 11, 20)]);
  for (let i = 0; i < 40; i++) {
    const s = add([rect(1, 1), pos(rand(0, W), rand(0, H)), color(232, 232, 240), opacity(rand(0.3, 1))]);
    const sp = rand(0.5, 1.5);
    s.onUpdate(() => { s.opacity = 0.4 + 0.6 * Math.abs(Math.sin(time() * sp + i)); });
  }
  decorTitle();
  // purple storm
  const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0), z(1)]);
  const words = ["BOOM!", "BANG!", "KRAKOOM!", "BOOM!!"];
  loop(1.6, () => {
    wash.opacity = 0.4; shake(10);
    wait(0.1, () => wash.opacity = 0.1); wait(0.2, () => wash.opacity = 0);
    const w = add([text(choose(words), { size: 16 }), pos(rand(50, W - 50), choose([rand(6, 22), rand(84, 98)])), anchor("center"), color(242, 208, 92), z(6), opacity(1), lifespan(0.9, { fade: 0.5 })]);
    w.onUpdate(() => { w.pos.y -= 15 * dt(); });
  });

  add([text("RESTOREBOUND", { size: 22 }), pos(W / 2, 46), anchor("center"), color(242, 208, 92), z(5)]);
  add([text("something fell out of the sky", { size: 8 }), pos(W / 2, 66), anchor("center"), color(207, 207, 216), z(5)]);

  if (saved && saved.state && saved.scene) {
    // Continue / New Game
    let pick = 0;
    add([text(`Welcome back, ${saved.state.name}.`, { size: 8 }), pos(W / 2, 112), anchor("center"), color(232, 232, 240), z(5)]);
    const opts2 = ["Continue", "New Game"].map((t, i) => add([text(t, { size: 10 }), pos(W / 2 - 40 + i * 80, 140), anchor("center"), color(232, 232, 240), z(5)]));
    const cur = arrowObj("right", 0, 140, 5, [242, 208, 92], [z(6)]);
    cur.onUpdate(() => { cur.pos.x = opts2[pick].pos.x - opts2[pick].width / 2 - 8; opts2.forEach((o, i) => o.color = i === pick ? rgb(242, 208, 92) : rgb(232, 232, 240)); });
    add([text("left / right, then SPACE", { size: 8 }), pos(W / 2, 168), anchor("center"), color(138, 138, 153), z(5)]);
    ["left", "a", "4", "right", "d", "6"].forEach((k) => onKeyPress(k, () => { pick = 1 - pick; music.sfx("move"); }));
    INTERACT.forEach((k) => onKeyPress(k, () => {
      music.sfx("select");
      if (pick === 0) { const m = migrate(saved); Object.assign(state, m.state); go(m.scene); }
      else { clearSave(); Object.assign(state, START); go("title", { fresh: true }); }
    }));
    return;
  }

  const prompts = [
    ["name", "What is YOUR name?"],
    ["bro", "Your little brother's name?"],
    ["sis", "Your little sister's name?"],
    ["dog", "Your dog's name?"],
  ];
  let step = 0;
  const q = add([text(prompts[0][1], { size: 8 }), pos(W / 2, 112), anchor("center"), color(232, 232, 240), z(5)]);
  add([rect(150, 22, { radius: 2 }), pos(W / 2, 138), anchor("center"), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(5)]);
  const nameTxt = add([text(state[prompts[0][0]], { size: 12 }), pos(W / 2, 138), anchor("center"), color(232, 232, 240), z(6)]);
  const caret = add([rect(2, 12), pos(W / 2, 138), anchor("left"), color(242, 208, 92), z(6)]);
  caret.onUpdate(() => { caret.hidden = Math.floor(time() * 2.5) % 2 === 0; caret.pos.x = W / 2 + nameTxt.width / 2 + 2; });
  const progress = add([text("", { size: 8 }), pos(W / 2, 168), anchor("center"), color(138, 138, 153), z(5)]);
  progress.onUpdate(() => { progress.text = `${step + 1} of ${prompts.length}  -  type, then ENTER`; });
  const preview = add([text("", { size: 8, align: "center" }), pos(W / 2, 200), anchor("center"), color(207, 207, 216), z(5)]);

  function key() { return prompts[step][0]; }
  const naming = () => { if (window.rbNaming) window.rbNaming(true, state[key()]); };
  naming();
  onCharInput((ch) => {
    if (state[key()].length >= 10) return;
    if (/^[a-zA-Z0-9 ]$/.test(ch)) { state[key()] += ch; nameTxt.text = state[key()]; }
  });
  onKeyPress("backspace", () => { state[key()] = state[key()].slice(0, -1); nameTxt.text = state[key()]; });
  onKeyPress("enter", () => {
    const defaults = { name: "Finn", bro: "Max", sis: "Lily", dog: "Biscuit" };
    state[key()] = state[key()].trim() || defaults[key()];
    step += 1;
    if (step >= prompts.length) { if (window.rbNaming) window.rbNaming(false); go("upstairs"); return; }
    q.text = prompts[step][1]; nameTxt.text = state[key()]; naming();
    preview.text = `${state.name}` + (step > 1 ? `, ${state.bro}` : "") + (step > 2 ? `, ${state.sis}` : "");
  });
});

// ---------------------------------------------------------------- scene: upstairs

// Two bedrooms side by side. Left: yours, with the storm outside the window.
// Right: your sister's, where the present is. Stairs at the bottom-left.
scene("upstairs", () => {
  resetCam();
  save("upstairs");
  music.play(state.kidnapped && !state.homeAgain ? "danger" : "night");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  decorUpstairs();
  wall(0, 0, W, 40);
  wall(0, 0, 8, H); wall(W - 8, 0, 8, H); wall(0, H - 8, W, 8);
  wall(W / 2 - 4, 0, 8, 110);
  wall(W / 2 - 4, 150, 8, H - 150);
  // one window per room; they go purple once the explosion happens
  const windows = [{ x: 42, y: 8, w: 30, h: 22 }, { x: W - 72, y: 8, w: 30, h: 22 }];
  windows.forEach(drawWindow);
  // your room: bed, desk (against the top wall, clear of the walk to the doorway)
  wall(20, 60, 60, 36); add([rect(22, 12), pos(24, 64), color(244, 241, 234)]);
  wall(96, 44, 44, 22); add([rect(14, 10), pos(100, 46), color(60, 80, 120)]); add([rect(10, 3), pos(120, 52), color(232, 232, 240)]);
  // siblings' room: brother's blue bed, sister's pink bed, rug, shelf
  wall(W / 2 + 14, 60, 50, 32); add([rect(18, 11), pos(W / 2 + 18, 64), color(244, 241, 234)]);
  wall(W - 72, 60, 58, 32); add([rect(18, 11), pos(W - 68, 64), color(244, 241, 234)]);
  add([rect(70, 40), pos(W / 2 + 30, 150), color(200, 140, 190)]);
  wall(W - 70, 120, 54, 10);
  // stairs down
  add([rect(30, 28), pos(14, H - 36), color(110, 80, 50)]);
  for (let i = 0; i < 5; i++) add([rect(30, 1), pos(14, H - 34 + i * 5), color(70, 50, 30)]);
  arrowObj("down", 29, H - 44, 4, [242, 208, 92], []);
  add([rect(30, 6), pos(14, H - 12), area(), "stairs"]);

  const player = makePlayer(60, 110);

  // the present
  let present = null;
  if (!state.hasSword) {
    present = add([sprite("present"), pos(W - 60, 165), anchor("topleft"), area(), body({ isStatic: true }), z(8), "npc", "present"]);
    const sparkle = add([text("*", { size: 8 }), pos(W - 62, 158), color(242, 208, 92), z(9)]);
    sparkle.onUpdate(() => { sparkle.hidden = Math.floor(time() * 4) % 3 === 0; sparkle.pos.x = W - 64 + Math.sin(time() * 5) * 8; });
    present.talk = () => {
      if (!state.boomed) { say(["* A present. It has your name on it.", "* It can wait until morning. Probably."]); return; }
      if (!state.talkedSis) { say(["* A present. It has your name on it.", `* Maybe ask ${state.sis} about it first.`]); return; }
      openPresent();
    };
    function openPresent() {
      destroy(sparkle);
      say(["* You tear off the paper.", "* ...", "* It's long. It's shiny. It's heavier than it looks."], () => {
        destroy(present);
        state.hasSword = true;
        music.sfx("pickup");
        const sw = add([sprite("sword"), pos(player.pos.x + 11, player.pos.y - 30), anchor("center"), z(60)]);
        sw.onUpdate(() => { sw.pos.y -= 6 * dt(); sw.angle = Math.sin(time() * 6) * 5; });
        const flare = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.7), z(55), fixed()]);
        flare.onUpdate(() => { flare.opacity = Math.max(0, flare.opacity - 1.2 * dt()); });
        shake(6);
        wait(1.4, () => {
          destroy(sw);
          player.use(sprite("hero_sword"));
          say([`* ${state.name} got the SWORD!`, "* It fits on your back like it was always supposed to be there."], breakIn);
        });
      });
    }
  }

  // the spare key lives behind your brother's bed
  const brobed = add([rect(50, 14), pos(W / 2 + 14, 88), area(), opacity(0), "npc", "brobed"]);
  if (state.kidnapped && !state.hasKey) {
    const ks = add([text("*", { size: 8 }), pos(W / 2 + 38, 84), color(242, 208, 92), z(9)]);
    ks.onUpdate(() => { ks.hidden = Math.floor(time() * 4) % 3 === 0; ks.pos.x = W / 2 + 38 + Math.sin(time() * 5) * 10; if (state.hasKey) destroy(ks); });
  }
  brobed.talk = () => {
    if (state.hasKey) { say([`* Behind ${state.bro}'s bed: dust, a sock, and one very old cracker.`]); return; }
    if (!state.kidnapped) { say([`* ${state.bro}'s bed. There's something shiny wedged behind it.`, `* ${state.bro} is standing right there, though. Later.`]); return; }
    state.hasKey = true; music.sfx("unlock");
    say([`* You reach behind ${state.bro}'s bed. Dust. A sock. A robot made of...`, "* ...the SPARE KEY. He was using the spare key as a robot.", `* ${state.name} got the SPARE KEY!`]);
  };

  const sis = state.kidnapped && !state.homeAgain ? null : npc("sis", W - 100, 100, "sis", () => {
    if (state.homeAgain) { say([`${state.sis}: zzz... I wasn't scared... zzz...`, `${state.sis}: ...${state.name}? Is the shouting next door about YOU?`]); return; }
    if (!state.boomed) { say([`${state.sis}: ${state.name}? Why are you up? Go back to bed.`]); return; }
    if (!state.talkedSis) {
      state.talkedSis = true;
      say([
        `${state.sis}: ${state.name}!! Did you hear it?! The sky is going PURPLE!`,
        `${state.sis}: I'm not scared. ${state.bro} is scared. I'm just standing near him.`,
        `${state.sis}: Oh! There's a present for you on my rug. It came in the mail today.`,
        `${state.sis}: I didn't open it. I only shook it a LITTLE.`,
      ]);
      return;
    }
    say(state.hasSword ? [`${state.sis}: A SWORD?! That is so unfair. I want a sword.`] : [`${state.sis}: The present! On the rug! Go on!`]);
  }, { footY: 14 });

  const bro = state.kidnapped && !state.homeAgain ? null : npc("bro", W - 124, 104, "bro", () => {
    state.talkedBro = true;
    if (state.homeAgain) { say([`${state.bro}: zzz... clown... zzz...`, `${state.bro}: ...I'm sleeping in ${state.sis}'s room forever. That's the rule now.`]); return; }
    if (!state.boomed) { say([`${state.bro}: zzz... robots... zzz...`]); return; }
    say(state.hasSword ? [`${state.bro}: whoa. whoa. whoa.`, `${state.bro}: can I hold it? just for a second? no? okay.`] : [
      `${state.bro}: ${state.name}... the booming is getting CLOSER.`,
      `${state.bro}: I'm not scared either. ${state.sis} said not to be.`,
      `${state.bro}: ...Is it okay if I stand behind you though.`,
    ]);
  }, { footY: 12 });

  npc("dog", 40, 128, "dog", () => say(state.homeAgain
    ? [`* ${state.dog} is lying across the siblings' doorway. Nobody is getting past ${state.dog} tonight.`]
    : state.kidnapped
    ? [`* ${state.dog} is standing at the top of the stairs, growling at nothing.`, `* ${state.dog} knows.`]
    : [`* ${state.dog} is under your bed. Only the tail is out.`, "* The tail says: no."]), { footY: 6 });

  wireTalk(player);
  wireMenu();
  hud();

  // the explosion, then the windows start flashing purple
  if (state.boomed && !state.beatLygon) stormFlashes(windows);
  else if (!state.boomed) {
    wait(0.4, () => say(["* It's late. The house is quiet.", "* Too quiet, actually. Even the crickets stopped."], () => {
      wait(0.8, () => {
        shake(30); music.sfx("boom");
        const boom = add([text("BOOOOM!!", { size: 28 }), pos(W / 2, 100), anchor("center"), color(242, 208, 92), z(200), opacity(1)]);
        boom.onUpdate(() => { boom.pos.y -= 20 * dt(); boom.opacity = Math.max(0, boom.opacity - 0.6 * dt()); });
        wait(0.5, () => { state.boomed = true; stormFlashes(windows); });
        wait(1.3, () => { shake(16); music.sfx("bang"); const bang = add([text("BANG!", { size: 22 }), pos(W / 2 + 60, 80), anchor("center"), color(199, 123, 214), z(200), opacity(1), lifespan(1, { fade: 0.6 })]); });
        wait(2.0, () => {
          destroy(boom);
          say([
            "* The whole house shook. Outside the windows, the sky is flashing PURPLE.",
            "* Booming. Banging. Over and over. Something is happening on the hill.",
            `* ${state.sis} is yelling from her room.`,
          ]);
        });
      });
    }));
  }

  // LYGON breaks in
  function breakIn() {
    music.play("danger");
    wait(0.8, () => {
      shake(30); music.sfx("boom");
      const crash = add([text("KRRAAASH!!", { size: 22 }), pos(W / 2, 100), anchor("center"), color(242, 208, 92), z(200), opacity(1)]);
      crash.onUpdate(() => { crash.opacity = Math.max(0, crash.opacity - 0.7 * dt()); });
      wait(1.2, () => {
        destroy(crash);
        say(["* Something just came through the front door.", "* Something is coming UP THE STAIRS.", "* Big, slow, heavy footsteps. And laughing."], () => {
          const clown = add([sprite("lygon"), pos(W / 2 - 64, 120), anchor("topleft"), z(30)]);
          shake(14);
          const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0.35), z(25), fixed()]);
          wash.onUpdate(() => { wash.opacity = Math.max(0, wash.opacity - 0.5 * dt()); });
          say([
            "LYGON: Hee hee hee! Knock knock!",
            "LYGON: Two little helpers for my show! Perfect! PERFECT!",
            `${state.sis}: ${state.name}!!`,
            `${state.bro}: ${state.name}!!!`,
            "LYGON: See you at the big top, sword boy. Oh — and the doors stay LOCKED till showtime! Hee hee!",
          ], () => {
            shake(20);
            const poof = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.9), z(90), fixed()]);
            poof.onUpdate(() => { poof.opacity = Math.max(0, poof.opacity - 1.5 * dt()); });
            destroy(clown); if (sis) destroy(sis); if (bro) destroy(bro);
            state.kidnapped = true; music.sfx("kidnap"); music.play("danger");
            wait(0.6, () => say([
              "* ...They're gone.",
              `* ${state.sis} and ${state.bro} are gone.`,
              `* ${state.name} tightened the strap on the sword.`,
              "* GOAL: Get them back.",
            ]));
          });
        });
      });
    });
  }

  player.onCollide("stairs", () => {
    if (dialogOpen) return;
    if (!state.boomed) { say(["* It's the middle of the night. Bed is the other way."]); player.pos.y -= 8; return; }
    if (!state.hasSword) { say([`* ${state.sis} said something about a present. Check her room first.`]); player.pos.y -= 8; return; }
    if (!state.kidnapped) { player.pos.y -= 8; return; }
    go("downstairs");
  });
});

// ---------------------------------------------------------------- scene: downstairs

const MOM_LINES = () => [
  `Mom: ${state.name}, if you see that clown again, you tell him your MOTHER is very disappointed in him.`,
  "Mom: I packed you cookies. I don't know what else a mother does in this situation.",
  `Mom: ${state.sis} hates thunder. Hold her hand when you find her. Even if she says no.`,
  "Mom: Come back with all your fingers. That's the rule.",
  `Mom: ${state.dog} won't stop staring at the door. I don't like it.`,
  `Mom: Juice heals you all the way. Don't drink it for fun.`,
];
const DAD_LINES = () => [
  "Dad: I tried the door. I tried it HARD. It's sealed with... purple.",
  "Dad: I should be the one going. But you're the one with the sword. That's how it works, apparently.",
  `Dad: ${state.bro} says he isn't scared of anything. He's scared of the vacuum. Find him fast.`,
  "Dad: Hit the clown once for me. Twice, actually. Once for your mother.",
  "Dad: I'm going to fix that door. Right now. With my HANDS.",
  `Dad: Your sister bit him on the way out. I saw it. That's my girl.`,
];

scene("downstairs", (opts) => {
  opts = opts || {};
  resetCam();
  save("downstairs");
  // the siblings are home: the reunion plays once, then they go up to bed
  const reunion = (state.party || []).includes("sis") && !state.homeAgain;
  music.play(state.kidnapped && !state.homeAgain ? "danger" : "night");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  decorDownstairs();
  wall(0, 0, W, 40);
  wall(0, 0, 8, H); wall(W - 8, 0, 8, H);
  wall(0, H - 8, W / 2 - 22, 8); wall(W / 2 + 22, H - 8, W / 2 - 22, 8);
  const windows = [{ x: 100, y: 8, w: 30, h: 22 }, { x: W - 110, y: 8, w: 30, h: 22 }];
  windows.forEach(drawWindow);
  if (!state.beatLygon) stormFlashes(windows); // the storm on the hill ends with Lygon
  // the front door, sealed purple until you have the key
  add([rect(44, 8), pos(W / 2 - 22, H - 8), color(60, 40, 20)]);
  add([rect(4, 4), pos(W / 2 + 12, H - 7), color(242, 208, 92)]);
  const seal = add([rect(48, 12), pos(W / 2 - 24, H - 12), color(199, 123, 214), opacity(0.4), z(3)]);
  seal.onUpdate(() => { seal.opacity = state.hasKey ? 0 : 0.3 + 0.25 * Math.abs(Math.sin(time() * 4)); });
  arrowObj("down", W / 2, H - 16, 4, [242, 208, 92], []);
  // stairs up
  add([rect(30, 28), pos(14, 40), color(110, 80, 50)]);
  for (let i = 0; i < 5; i++) add([rect(30, 1), pos(14, 42 + i * 5), color(70, 50, 30)]);
  arrowObj("up", 29, 72, 4, [242, 208, 92], []);
  add([rect(30, 6), pos(14, 40), area(), "stairsup"]);
  // furniture
  wall(60, 120, 60, 30); add([rect(56, 4), pos(62, 118), color(170, 130, 90)]);
  wall(200, 70, 80, 30);
  wall(W - 60, 130, 50, 30);
  // knocked-over things from the break-in
  add([rect(10, 10), pos(140, 180), color(60, 40, 20), rotate(35)]);
  add([rect(14, 4), pos(180, 200), color(200, 80, 90), rotate(-15)]);

  const player = makePlayer(reunion || opts.from === "town" ? W / 2 - 11 : 50, reunion ? 112 : opts.from === "town" ? H - 42 : 84);
  const fol = makeFollowers(player);

  const mom = npc("mom", W - 100, 140, "mom", () => {
    if (state.homeAgain) {
      say(state.kingFled ? [`Mom: Pip's mother called. Pip is WITH you? Pip is eight, ${state.name}.`, "Mom: ...Fine. Cookies for everybody, then."]
        : [`Mom: That shouting next door. That's Mr. Fenn's house. Mr. Fenn does not SHOUT.`, `Mom: Don't you dare go over there. ...You're going over there. Take a cookie.`]);
      return;
    }
    if (!state.talkedMom) {
      state.talkedMom = true; music.sfx("pickup");
      say([
        `Mom: ${state.name}! Oh thank goodness. Where are ${state.sis} and ${state.bro}?!`,
        "Mom: A CLOWN. A clown came through the door. Our DOOR.",
        "Mom: ...You have a sword. Why do you have a sword. Where did you get a sword.",
        `Mom: No. No time. Go. GO. Bring them home, ${state.name}.`,
        "Mom: Take these. Cookies heal you. Soda is for your PSI. Juice fills up everything.",
        "* You got 3 Cookies, 2 Sodas and a Juice Box!",
      ]);
      return;
    }
    say([choose(MOM_LINES())]);
  }, { footY: 16 });

  const dad = npc("dad", W / 2 + 50, H - 76, "dad", () => {
    if (state.homeAgain) {
      say(state.kingFled ? ["Dad: A KING. In Fenn's living room. And he SHOVED you?", "Dad: He went east, you said. Go get him. Twice for your mother."]
        : ["Dad: There's a light in Fenn's window. Purple. I've seen enough purple for one lifetime.", "Dad: If you go over there, you come straight back. STRAIGHT back."]);
      return;
    }
    if (!state.talkedDad) {
      state.talkedDad = true;
      say([
        `Dad: ${state.name}. Okay. Okay okay okay.`,
        "Dad: The front door is sealed. Purple. Humming. I pulled on it until my arms hurt.",
        `Dad: The spare key! ${state.bro} took it last week — he was using it as a robot.`,
        `Dad: It's behind his bed. Go. Get it. Then go get your brother and sister.`,
      ]);
      return;
    }
    if (!state.hasKey) { say([choose([DAD_LINES()[0], `Dad: The spare key. Behind ${state.bro}'s bed. Upstairs.`])]); return; }
    say([choose(DAD_LINES())]);
  }, { footY: 16 });

  npc("dog", 120, 200, "dog", () => say([`* ${state.dog} is sitting in front of the door, staring at it.`, `* ${state.dog} looks at you, then at the door, then at you.`, "* Woof."]), { footY: 6 });

  wireTalk(player);
  wireMenu();
  hud();

  player.onCollide("stairsup", () => { if (!dialogOpen) go("upstairs"); });
  add([rect(44, 6), pos(W / 2 - 22, H - 6), area(), "door"]);
  player.onCollide("door", () => {
    if (dialogOpen) return;
    if (!state.talkedMom || !state.talkedDad) { say(["* Mom and Dad are calling your name."]); player.pos.y -= 8; return; }
    if (!state.hasKey) { say(["* Locked. LYGON's purple seal hums on the handle.", `* Dad said the spare key is behind ${state.bro}'s bed.`]); player.pos.y -= 8; return; }
    if (state.homeAgain) { music.sfx("door"); go("town", { from: "home" }); return; }
    music.sfx("unlock");
    say(["* The spare key turns. The purple seal pops like a soap bubble.", `* ${state.name} stepped out into the flashing night.`], () => { music.sfx("door"); go("town", { from: "home" }); });
  });

  if (reunion) reunionScene(player, fol, mom, dad);
  else if (state.homeAgain) { if (!state.seenHome) { state.seenHome = true; wait(0.3, () => say(state.kingFled ? ["* Home. Everyone is talking about the King."] : ["* Home. Through the wall: SHOUTING, from next door."])); } }
  else if (!state.seenMess) { state.seenMess = true; wait(0.3, () => say(["* The living room looks like a tornado came through.", "* The front door is glowing purple. Mom and Dad are both talking at once."])); }
});

// The reunion, at home. Mom and Dad run over, everyone hugs, the siblings go up to bed;
// then, that night, the window flashes purple and the voice behind the orb speaks.
function reunionScene(player, fol, mom, dad) {
  window.__frozen = true;
  music.play("night");
  // the siblings stop trailing and stand at your sides for the scene
  if (player.followUpd) { player.followUpd.cancel(); player.followUpd = null; }
  const [fs, fb] = fol;
  fs.pos = vec2(player.pos.x - 24, player.pos.y + 4); fb.pos = vec2(player.pos.x + 26, player.pos.y + 4);
  const slide = (o, to, d, ease) => tween(o.pos, to, d, (p) => { o.pos = p; }, ease || easings.easeOutQuad);
  const hearts = () => { for (let i = 0; i < 8; i++) add([text("<3", { size: 8 }), pos(player.pos.x + rand(-40, 60), player.pos.y + rand(-10, 20)), anchor("center"), color(224, 69, 63), z(60), opacity(1), lifespan(1.2, { fade: 0.6 }), move(UP, rand(12, 30))]); };
  wait(0.6, () => say(["* Home.", `Mom: ...${state.name}?`, `Mom: ${state.sis}!! ${state.bro}!!`], () => {
    mom.cut = true; dad.cut = true;
    slide(mom, vec2(player.pos.x - 50, player.pos.y - 4), 0.6); slide(dad, vec2(player.pos.x + 48, player.pos.y - 6), 0.7);
    wait(0.75, () => {
      hearts(); shake(4); music.sfx("pickup");
      say([
        `${state.sis}: ${state.name}!! You came! I KNEW you'd come. I wasn't scared.`,
        `${state.bro}: I was a little scared.`,
        "Mom: Oh, my babies. ALL of my babies. Come here.",
        `* Everyone hugged. Even Dad. Even ${state.dog}, sort of.`,
        "Dad: That's my kids. That's all three of my kids.",
        "Mom: Bed. Both of you. NOW. ...Please.",
      ], () => {
        hearts();
        slide(fs, vec2(24, 58), 1.3); slide(fb, vec2(36, 62), 1.4);
        wait(1.5, () => {
          destroy(fs); destroy(fb);
          state.party = []; state.homeAgain = true; fullHeal(); save("downstairs");
          say(["* That night, everyone slept in the same room. Nobody argued about it."], () => {
            music.play("danger");
            const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0.6), z(90), fixed()]);
            wash.onUpdate(() => { wash.opacity = Math.max(0, wash.opacity - 0.9 * dt()); });
            shake(18); music.sfx("boom");
            wait(1.2, () => say([
              "* The window flashed PURPLE.",
              "* Not thunder. Not the clown. Something farther away. Something WATCHING.",
              `A VOICE: I see you, ${state.name}.`,
              "A VOICE: I have always seen you. Through the orb. Every step. The clown was only the first thing I sent.",
              `* ${state.name} put a hand on the sword.`,
              "* GOAL: Find her. Break the orb.",
              "* ...",
              "* Morning. Next door, somebody is SHOUTING.",
            ], () => {
              music.play("night"); window.__frozen = false;
              mom.cut = false; dad.cut = false; mom.baseY = mom.pos.y; dad.baseY = dad.pos.y;
            }));
          });
        });
      });
    });
  }));
}

// ---------------------------------------------------------------- scene: town

scene("town", (opts) => {
  opts = opts || {};
  resetCam();
  music.play("outside");
  save("town");
  add([rect(W, H), pos(0, 0), color(94, 170, 100)]);
  for (let i = 0; i < 120; i++) add([rect(1, 2), pos(rand(0, W), rand(0, H)), color(70, 140, 80)]);
  add([rect(40, H), pos(W / 2 - 20, 0), color(214, 190, 140)]);
  add([rect(W, 34), pos(0, H - 48), color(214, 190, 140)]);
  decorTown();
  wall(0, 0, 6, H); wall(0, H - 6, W, 6);
  // once the King has run east the road runs on, off the right edge, to the next town
  if (state.kingFled) {
    wall(W - 6, 0, 6, H - 48); wall(W - 6, H - 14, 6, 14);
    add([rect(6, 34), pos(W - 6, H - 48), color(214, 190, 140), z(1)]);
    arrowObj("right", W - 12, H - 34, 4, [242, 208, 92], [z(2)]);
    add([rect(6, 34), pos(W - 6, H - 48), area(), "east"]);
  } else wall(W - 6, 0, 6, H);
  // purple glow over the hill
  const glow = add([rect(W, 70), pos(0, 0), color(199, 123, 214), opacity(0.12), z(0)]);
  glow.onUpdate(() => { glow.opacity = 0.08 + 0.08 * Math.abs(Math.sin(time() * 2)); });

  [[20, 40], [W - 66, 40]].forEach(([x, y]) => { add([sprite("house"), pos(x, y), anchor("topleft"), z(2)]); wall(x + 2, y + 8, 42, 8); });
  [[30, 130], [60, 150], [W - 50, 130], [W - 80, 160], [24, 96], [W - 40, 96]].forEach(([x, y]) => { add([sprite("tree"), pos(x, y), anchor("topleft"), z(3)]); wall(x + 5, y + 12, 8, 4); });

  add([sprite("wagon"), pos(W / 2 - 22, 4), anchor("topleft"), z(1)]);
  for (let i = 0; i < 6; i++) {
    const s = add([rect(3, 3), pos(W / 2 + rand(-10, 10), 10), color(140, 140, 150), opacity(0.6), z(2)]);
    s.onUpdate(() => { s.pos.y -= 12 * dt(); s.opacity -= 0.25 * dt(); if (s.opacity <= 0) { s.pos = vec2(W / 2 + rand(-10, 10), 12); s.opacity = 0.6; } });
  }

  const player = makePlayer(opts.from === "east" ? W - 34 : opts.from === "home" ? 20 + 12 : opts.from === "trouble" ? W - 66 + 12 : W / 2 - 11,
    opts.from === "home" || opts.from === "trouble" ? 62 : H - 44);
  makeFollowers(player);
  player.onCollide("east", () => {
    if (dialogOpen) return;
    if (!state.friends) { player.pos.x -= 8; say(["* A voice from inside: 'Not alone. Never alone.' The way is shut."]); return; }
    go("road", { from: "west" });
  });
  // the road east is closed until the King has gone that way
  if (state.beatLygon && !state.kingFled) {
    add([rect(4, 34), pos(W - 10, H - 48), area(), opacity(0), "eastlocked"]);
    player.onCollide("eastlocked", () => {
      if (dialogOpen) return; player.pos.x -= 8;
      say(state.homeAgain ? ["* The road east. Somebody is SHOUTING behind you, in the house on the right.", "* First things first."] : [`* The road east. Not with ${state.sis} and ${state.bro} still out here. Home first.`]);
    });
  }
  // home: the house on the left. Its door takes you in.
  add([rect(12, 6), pos(20 + 17, 40 + 14), area(), opacity(0), "homedoor"]);
  player.onCollide("homedoor", () => { if (!dialogOpen) { music.sfx("door"); go("downstairs", { from: "town" }); } });
  // the trouble house: the house on the right. After the reunion there is shouting inside.
  if (state.homeAgain) {
    add([rect(12, 6), pos(W - 66 + 17, 40 + 14), area(), opacity(0), "troubledoor"]);
    if (!state.kingFled) {
      const mark = add([text("!", { size: 12 }), pos(W - 66 + 23, 30), anchor("center"), color(242, 208, 92), z(6), "troublemark"]);
      mark.onUpdate(() => { mark.pos.y = 30 - Math.abs(Math.sin(time() * 6)) * 4; mark.hidden = Math.floor(time() * 4) % 4 === 0; });
    }
    player.onCollide("troubledoor", () => {
      if (dialogOpen) return;
      if (state.kingFled) { music.sfx("door"); go("house2"); return; }
      say(["* Through the door: a man's voice, begging.", "* And another voice. Calm. Cold.", "???: ...RISE."], () => { music.sfx("door"); go("house2"); });
    });
  }

  // the big top at the top of the hill, right behind the wreck: the wagon crashed into its entrance
  add([sprite("tentmouth"), pos(W / 2 - 24, 0), anchor("topleft"), z(1)]);
  const cglow = add([rect(30, 20), pos(W / 2 - 15, 14), color(199, 123, 214), opacity(0.2), z(2)]);
  cglow.onUpdate(() => { cglow.opacity = 0.12 + 0.12 * Math.abs(Math.sin(time() * 2.5)); });
  add([rect(24, 8), pos(W / 2 - 12, 26), area(), "cavezone"]);
  player.onCollide("cavezone", () => {
    if (dialogOpen) return;
    if (state.cave === 0 && !state.beatBugon) {
      say([
        "* The big top. The wagon crashed right through its entrance flap.",
        `* From inside: circus music, laughing, and two small voices yelling "${state.name}!!"`,
        `* ${state.name} drew the sword and went in.`,
      ], () => go("cave"));
    } else go("cave");
  });

  npc("elder", 90, H - 50, "elder", () => say(state.beatLygon ? [
    "Old Man: You brought them home. Good lad.",
    "Old Man: But the sky's still wrong. Follow the road east. Folks in the next town have gone strange.",
    "Old Man: They say there's a hole in the hill over there. The HOLLOW. Don't go in it. ...You're going in it, aren't you.",
  ] : state.cave > 0 ? [
    `Old Man: Still in one piece? You've beaten ${state.cave} of the clown's critters, by my count.`,
    "Old Man: The big-eared one guards the inner door. Then it's the clown himself.",
  ] : [
    "Old Man: Sixty years on this hill. Never once has a CIRCUS fallen on it.",
    "Old Man: The clown dragged your kin into the cave. His whole freak show lives in there.",
    "Old Man: You've got a sword. That's more than I had at your age. Go on.",
  ]), { footY: 16 });

  npc("kid", W - 110, H - 50, "kid", () => say(state.beatLygon ? [
    "Kid: My cousin lives in the east town. He says the MAILMAN walked into the Hollow and came out... different.",
    "Kid: Purple eyes. Flying. Mailmen don't fly, " + state.name + ".",
    "Kid: The road east is open now. I'm still watching from here.",
  ] : state.cave > 0 ? [
    "Kid: You went IN there?! And came back OUT?!",
    "Kid: Everyone says there's robots in that cave. And aliens. And a toad with too many teeth.",
  ] : [
    "Kid: I saw the clown carry two kids up the hill. One of them bit him.",
    `Kid: You gonna go up there, ${state.name}? Can I watch from here?`,
    "Kid: PSI Ice freezes stuff, by the way. My cousin told me. He knows things.",
  ]), { footY: 14 });

  const dog = npc("dog", 200, 120, "dog", () => say(state.beatLygon ? [`* ${state.dog} is staring east, down the road. Low growl.`, `* ${state.dog} does not like whatever is over there.`, "* Grrr."] : [`* ${state.dog} followed you out. ${state.dog} is not supposed to be outside.`, `* ${state.dog} looks at the hill, then at you, very seriously.`, "* Woof."]), { footY: 6 });
  let dogT = 0;
  dog.onUpdate(() => { dogT += dt(); dog.pos.x = 200 + Math.sin(dogT * 0.7) * 14; });

  wireTalk(player);
  wireMenu();
  hud();

  wait(0.3, () => say(state.beatLygon && !state.homeAgain
    ? [`* ${state.sis} and ${state.bro} are right behind you.`, "* Home is the house on the LEFT. Mom and Dad are waiting."]
    : state.homeAgain && !state.kingFled
    ? ["* SHOUTING. From the house on the RIGHT, next door.", "* A man's voice, scared. And another voice. Not scared at all."]
    : state.kingFled
    ? (opts.from === "east" ? ["* Home. The cave is quiet. The east is not."] : ["* The King went EAST, down the road. So did the purple in the sky."])
    : state.cave > 0
    ? ["* The cave is still humming. Your family is still in there."]
    : ["* The air smells like popcorn and lightning.", "* Up the path, a cave is glowing purple."]));
});

// ---------------------------------------------------------------- scene: cave (the big top)
// The first dungeon is the inside of LYGON's circus tent: the big top that crashed on the hill.
// The scene keeps its old name ("cave") and the save fields (cave, beatBugon, branch*,
// giantSword) so older saves load; the tunnel geometry (segments, the fork at segment 3,
// six ordered encounters, Bugon at segs[8], Lygon at the top) is unchanged under the paint.

const BT = {
  canvasA: [128, 34, 44], canvasB: [172, 134, 60], seam: [60, 20, 28], rim: [255, 214, 120],
  floor: [206, 170, 108], floorDark: [178, 140, 84], floorLight: [230, 200, 146],
  net: [26, 24, 38], mesh: [74, 70, 96], ring: [82, 46, 58], ringLine: [224, 69, 63],
  boards: [150, 105, 60], boardLine: [120, 80, 45],
  confetti: [[224, 69, 63], [242, 208, 92], [58, 111, 216], [79, 176, 106], [199, 123, 214], [255, 255, 255]],
};
// once-per-run finds (a page load is a run; the save keeps its old field set)
window.__bigtop = window.__bigtop || { sparkle: false, cage: false, fell: false, pushes: 0 };

// red and yellow canvas over a whole region; everything else draws on top of it
function tentCanvas(w, h) {
  for (let x = 0; x < w; x += 12) add([rect(12, h), pos(x, 0), color(...(((x / 12) | 0) % 2 ? BT.canvasB : BT.canvasA)), z(0)]);
  for (let y = 100; y < h; y += 100) add([rect(w, 1), pos(0, y), color(...BT.seam), opacity(0.6), z(0.2)]);
}
// a sawdust floor rect: lit rim underneath, speckles on top
function sawdust(x, y, w, h) {
  add([rect(w + 4, h + 4), pos(x - 2, y - 2), color(...BT.rim), z(0.5)]);
  add([rect(w, h), pos(x, y), color(...BT.floor), z(1)]);
  const n = Math.floor(w * h / 150);
  for (let i = 0; i < n; i++) add([rect(rand(1, 3), 1), pos(x + rand(0, w - 3), y + rand(0, h - 1)), color(...(Math.random() < 0.5 ? BT.floorDark : BT.floorLight)), z(1.1)]);
}
// a safety net: dark with a square mesh
function netFloor(x, y, w, h) {
  add([rect(w, h), pos(x, y), color(...BT.net), z(1.2)]);
  for (let i = 0; i <= w; i += 5) add([rect(1, h), pos(x + Math.min(i, w - 1), y), color(...BT.mesh), z(1.3)]);
  for (let j = 0; j <= h; j += 5) add([rect(w, 1), pos(x, y + Math.min(j, h - 1)), color(...BT.mesh), z(1.3)]);
}
// a string of twinkling bulbs
function stringLights(x, y, w) {
  add([rect(w, 1), pos(x, y), color(40, 20, 30), z(2)]);
  for (let i = 3; i < w - 2; i += 9) {
    const b = add([rect(3, 3), pos(x + i, y + 1), color(...choose(BT.confetti)), opacity(1), z(2.1)]);
    const ph = rand(0, 6), sp = rand(2, 4.5);
    b.onUpdate(() => { b.opacity = 0.4 + 0.6 * Math.abs(Math.sin(time() * sp + ph)); });
  }
}
// a trapeze swinging from its pivot
function trapeze(x, y, ph = 0, amp = 26) {
  const t = add([sprite("trapeze"), pos(x, y), anchor("top"), rotate(0), z(2.5), "trapeze"]);
  t.onUpdate(() => { t.angle = Math.sin(time() * 1.6 + ph) * amp; });
  return t;
}
// a sweeping spotlight: a soft ellipse of light wandering over the floor
function spotlight(cx, cy, rx, ry, sp, ph) {
  const s = add([circle(24), pos(cx, cy), color(255, 240, 200), opacity(0.16), z(3), "spot"]);
  const core = add([circle(13), pos(cx, cy), color(255, 250, 230), opacity(0.12), z(3.1)]);
  s.onUpdate(() => { const t = time() * sp + ph; s.pos = vec2(cx + Math.sin(t) * rx, cy + Math.cos(t * 0.7) * ry); core.pos = s.pos; });
  return s;
}
// an animal cage that rattles when the player comes near; opts.talk makes it openable
function animalCage(x, y, animal, player, opts = {}) {
  const big = !!opts.big, cw = big ? 26 : 22, ch = big ? 36 : 24;
  const back = add([rect(cw - 4, ch - 5), pos(x + 2, y + 2), color(24, 18, 30), z(2)]);
  const ax = x + (opts.ax ?? (big ? 3 : 5)), ay = y + (opts.ay ?? (big ? 7 : 11));
  const a = animal ? add([sprite(animal), pos(ax, ay), anchor("topleft"), z(2.2)]) : null;
  const c = add([sprite(big ? "bigcage" : "cage"), pos(x, y), anchor("topleft"), z(2.4), ...(opts.talk ? ["npc"] : [])]);
  if (opts.talk) c.talk = opts.talk;
  let near = false;
  c.onUpdate(() => {
    if (!player) return;
    const d = player.pos.add(11, 26).dist(vec2(x + cw / 2, y + ch));
    const isNear = d < 40;
    if (isNear && !near) music.sfx("move");
    near = isNear;
    const jit = isNear ? (Math.sin(time() * 40) > 0 ? 1 : -1) : 0;
    c.pos.x = x + jit; back.pos.x = x + 2 + jit;
    if (a) { a.pos.x = ax + jit; a.pos.y = ay + (isNear ? Math.abs(Math.sin(time() * 14)) * -2 : (Math.sin(time() * 2 + x) > 0.8 ? -1 : 0)); }
  });
  return c;
}
// a big striped ball bouncing back and forth; a low ball that meets the player shoves them
function bouncingBall(x0, x1, y, ph, player, shove) {
  const shadow = add([circle(6), pos(x0, y), color(0, 0, 0), opacity(0.22), z(1.5), scale(1, 0.5)]);
  const b = add([sprite("ball"), pos(x0, y), anchor("center"), rotate(0), z(8), "ball"]);
  let cool = 0;
  b.floorPos = vec2(x0, y); b.hgt = 0;
  b.onUpdate(() => {
    const t = time() * 0.8 + ph;
    const fx = x0 + (x1 - x0) * (0.5 + 0.5 * Math.sin(t));
    const hgt = Math.abs(Math.sin(t * 3.2)) * 34;
    b.floorPos = vec2(fx, y); b.hgt = hgt;
    shadow.pos = vec2(fx, y); shadow.scale = vec2(1 - hgt / 100, 0.5 * (1 - hgt / 100));
    b.pos = vec2(fx, y - hgt - 7); b.z = 10 + (y + 1) / 1000; b.angle = t * 60;
    cool -= dt();
    const feet = player.pos.add(11, 26);
    if (hgt < 11 && cool <= 0 && feet.dist(b.floorPos) < 14) {
      cool = 0.6; music.sfx("bang");
      const dir = feet.sub(b.floorPos); shove(dir.len() > 0.1 ? dir.unit() : vec2(0, 1));
    }
  });
  return b;
}
// confetti drifting down the whole screen (fixed to the camera)
function confettiRain(n = 36) {
  for (let i = 0; i < n; i++) {
    const c = add([rect(2, 2), pos(rand(0, W), rand(0, H)), color(...choose(BT.confetti)), fixed(), z(40), opacity(0.9)]);
    const sp = rand(7, 16), sw = rand(0, 6);
    c.onUpdate(() => { c.pos.y += sp * dt(); c.pos.x += Math.sin(time() * 2 + sw) * 9 * dt(); if (c.pos.y > H) { c.pos.y = -2; c.pos.x = rand(0, W); } });
  }
}
// a puff of sawdust at the hero's feet while walking
function dustAtFeet(player) {
  let last = player.pos.clone(), t = 0;
  player.onUpdate(() => {
    const moved = player.pos.dist(last) > 0.3; last = player.pos.clone();
    t -= dt();
    if (moved && t <= 0) {
      t = 0.12;
      const d = add([rect(2, 2), pos(player.pos.x + rand(5, 15), player.pos.y + 29), color(...BT.floorLight), opacity(0.85), z(9), lifespan(0.35, { fade: 0.3 })]);
      d.onUpdate(() => { d.pos.y -= 9 * dt(); d.pos.x += rand(-0.3, 0.3); });
    }
  });
}
// bleachers down both screen edges, with a few fans that bob; `skip` is a y-range to leave open
function bleachers(h, skip) {
  for (let y = 0; y < h; y += 15) {
    if (skip && y + 15 > skip[0] && y < skip[1]) continue;
    add([sprite("bleacher"), pos(0, y), anchor("topleft"), z(1.8)]);
    add([sprite("bleacher"), pos(W - 16, y), anchor("topleft"), z(1.8)]);
    if (Math.random() < 0.45) {
      const fx = Math.random() < 0.5 ? rand(1, 9) : W - 16 + rand(1, 9), fy = y + rand(0, 8);
      const f = add([sprite(choose(["fan1", "fan2", "fan3", "fan4"])), pos(fx, fy), anchor("topleft"), z(1.9)]);
      const ph = rand(0, 6);
      f.onUpdate(() => { f.pos.y = fy + (Math.sin(time() * 3 + ph) > 0.7 ? -1 : 0); });
    }
  }
}
// the battle scene's big-top backdrop (only for enemies flagged `tent`): canvas at the top,
// a ring floor at the bottom, a spotlight on the performer. Everything sits under the sprites.
function tentBackdrop() {
  for (let i = 0; i < 22; i++) add([rect(16, 58), pos(i * 16 - 8, 0), color(...(i % 2 ? [214, 168, 70] : [190, 52, 54])), z(2)]);
  for (let i = 0; i < 21; i++) add([circle(8), pos(i * 16 + 8, 58), color(...(i % 2 ? [190, 52, 54] : [214, 168, 70])), z(2)]);
  for (let x = 6; x < W; x += 12) {
    const b = add([circle(2), pos(x, 72), color(...choose(BT.confetti)), opacity(1), z(2)]);
    b.onUpdate(() => { b.opacity = 0.45 + 0.55 * Math.abs(Math.sin(time() * 3 + x)); });
  }
  add([rect(W, H - 112), pos(0, 112), color(58, 34, 40), z(2)]);
  add([rect(W, 4), pos(0, 110), color(...BT.ringLine), z(2)]); add([rect(W, 1), pos(0, 114), color(255, 250, 230), z(2)]);
  const sp = add([circle(58), pos(W / 2, 84), color(255, 240, 200), opacity(0.12), z(2)]);
  sp.onUpdate(() => { sp.opacity = 0.09 + 0.05 * Math.abs(Math.sin(time() * 2)); });
}

scene("cave", (opts = {}) => {
  resetCam();
  save("cave");
  music.play("cave");
  window.__frozen = false;
  // roll the fork once per run
  if (!state.branchSide) { state.branchSide = choose(["left", "right"]); state.branchEnemy = choose(CAVE_ENEMIES); save("cave"); }
  const BRANCH = 3; // the fork leaves the main aisle at this segment (after two fights)
  const TIGHT = 6;  // the tightrope segment (Redstack checks tickets on the beam)
  const found = window.__bigtop;

  // canvas walls behind everything
  tentCanvas(W, CAVE_H);
  // winding aisle: alternating offsets, 44 wide
  const segs = [];
  for (let y = CAVE_H; y > 0; y -= 100) {
    const off = Math.sin(y / 100) * 60;
    segs.push({ x: W / 2 - 22 + off, y: y - 100, w: 44, h: 100 });
  }
  const last = segs.length - 1, top = segs[last], ringC = vec2(top.x + 22, 50);
  segs.forEach((sg, i) => {
    if (i === TIGHT) { sawdust(sg.x, sg.y, sg.w, 15); sawdust(sg.x, sg.y + 85, sg.w, 15); }
    else if (i === last) sawdust(ringC.x - 50, sg.y + 3, 100, 94);
    else sawdust(sg.x, sg.y, sg.w, sg.h);
    if (segs[i + 1]) {
      const a = Math.min(sg.x, segs[i + 1].x), b = Math.max(sg.x, segs[i + 1].x) + 44;
      sawdust(a, sg.y - 15, b - a, 30);
    }
  });
  // the fork: two corridors run off the screen; where they go is only visible once you walk there
  const bs = segs[BRANCH];
  const corrY = bs.y + 38, corrH = 26;
  sawdust(0, corrY, bs.x, corrH);
  sawdust(bs.x + 44, corrY, W - (bs.x + 44), corrH);
  add([rect(6, corrH), pos(0, corrY), area(), "sideL"]);
  add([rect(6, corrH), pos(W - 6, corrY), area(), "sideR"]);

  // walls: canvas on both sides of every segment, the connector band, and around the fork
  const tsg = segs[TIGHT], tR = Math.max(tsg.x, segs[TIGHT + 1].x) + 46;
  const pit = { x: tR + 14, y: tsg.y + 18, w: 64, h: 64 };
  segs.forEach((sg, i) => {
    const nx = segs[i + 1] ? segs[i + 1].x : sg.x;
    if (i === BRANCH) {
      const bl = sg.x - 2, br = sg.x + 46;
      wall(0, sg.y + 15, bl, corrY - (sg.y + 15)); wall(0, corrY + corrH, bl, sg.y + 85 - (corrY + corrH));
      wall(br, sg.y + 15, W - br, corrY - (sg.y + 15)); wall(br, corrY + corrH, W - br, sg.y + 85 - (corrY + corrH));
    } else if (i === last) {
      wall(0, sg.y + 15, ringC.x - 40, sg.h - 30); wall(ringC.x + 40, sg.y + 15, W - (ringC.x + 40), sg.h - 30);
    } else if (i === TIGHT) {
      wall(0, sg.y + 15, sg.x - 2, sg.h - 30);
      // the landing pit sits in the canvas to the right; walls wrap around it
      wall(sg.x + 46, sg.y + 15, pit.x - (sg.x + 46), sg.h - 30);
      wall(pit.x + pit.w, sg.y + 15, W - (pit.x + pit.w), sg.h - 30);
      wall(pit.x, sg.y + 12, pit.w, pit.y - (sg.y + 12)); wall(pit.x, pit.y + pit.h, pit.w, sg.y + 88 - (pit.y + pit.h));
    } else {
      wall(0, sg.y + 15, sg.x - 2, sg.h - 30);
      wall(sg.x + 46, sg.y + 15, W - (sg.x + 46), sg.h - 30);
    }
    if (segs[i + 1]) { wall(0, sg.y - 15, Math.min(sg.x, nx), 30); wall(Math.max(sg.x, nx) + 44, sg.y - 15, W - (Math.max(sg.x, nx) + 44), 30); }
  });
  wall(0, CAVE_H - 4, W, 4); wall(0, 0, W, 4);

  // ---- dressing: bleachers, lights, banners, trapezes
  bleachers(CAVE_H, [corrY - 6, corrY + corrH + 6]);
  segs.forEach((sg, i) => {
    if (i === last) return;
    stringLights(18, sg.y + 6, W - 36);
    const nx = segs[i + 1] ? segs[i + 1].x : sg.x;
    const L = Math.min(sg.x, nx), R = Math.max(sg.x, nx) + 44;
    if (i !== BRANCH && i !== TIGHT) {
      add([sprite(i % 2 ? "banner" : "banner2"), pos(sg.x - 16, sg.y + 18), anchor("topleft"), z(2.2)]);
      add([sprite(i % 2 ? "banner2" : "banner"), pos(sg.x + 48, sg.y + 18), anchor("topleft"), z(2.2)]);
    }
    if (i % 3 === 1) trapeze(L - 30, sg.y + 20, i);
    if (i % 3 === 2) trapeze(R + 30, sg.y + 22, i * 1.7);
  });

  // ---- the entrance: ticket booth, sign, popcorn
  const start = segs[0];
  add([sprite("booth"), pos(start.x - 40, start.y + 40), anchor("topleft"), z(2.5), "npc", "booth"]).talk = () =>
    say(["* The ticket booth. Nobody is in it.", "* A sign says: NO REFUNDS. NO EXCEPTIONS. NO SWORDS.", `* ${state.name} kept the sword.`]);
  add([rect(96, 14), pos(start.x + 22 - 48, start.y + 20), color(...BT.ringLine), outline(2, rgb(242, 208, 92)), z(2.6)]);
  add([text("LYGON'S BIG TOP", { size: 8 }), pos(start.x + 22, start.y + 27), anchor("center"), color(255, 244, 200), z(2.7)]);
  add([sprite("popcornstand"), pos(start.x + 54, start.y + 52), anchor("topleft"), z(2.5), "npc", "popcorn"]).talk = () =>
    say(["* A popcorn stand. Still warm.", "* It smells incredible. Now is not the time."]);
  add([sprite("popcornstand"), pos(bs.x + 54, bs.y + 66), anchor("topleft"), z(2.5)]);
  add([sprite("hoop"), pos(segs[1].x + 50, segs[1].y + 52), anchor("topleft"), z(2.5)]);
  add([sprite("hoop"), pos(segs[5].x + 50, segs[5].y + 50), anchor("topleft"), z(2.5)]);
  add([sprite("hoop"), pos(segs[4].x - 26, segs[4].y + 54), anchor("topleft"), z(2.5)]);
  add([sprite("cannon"), pos(segs[7].x + 50, segs[7].y + 44), anchor("topleft"), z(2.5)]);

  // ---- the ring at the top: red rope, dark floor, posts, and the two hanging cages
  add([circle(44), pos(ringC), color(255, 250, 230), z(1.2)]);
  add([circle(41), pos(ringC), color(...BT.ringLine), z(1.21)]);
  add([circle(38), pos(ringC), color(...BT.ring), z(1.22)]);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add([sprite("post"), pos(ringC.x + Math.cos(a) * 44, ringC.y + Math.sin(a) * 44 - 6), anchor("center"), z(2.3)]); }
  [[ringC.x - 78, "sis"], [ringC.x + 52, "bro"]].forEach(([cx, who]) => {
    add([rect(2, 12), pos(cx + 12, 4), color(140, 140, 150), z(2)]);
    animalCage(cx, 14, state.beatLygon ? null : who, null, { big: true, ax: 3, ay: 6 }); // rescued kids are not in the cages any more
  });

  // ---- the hero
  let sx = start.x + 11, sy = CAVE_H - 60;
  if (opts.resume) {
    if (opts.at === "branch") { sx = bs.x + 11; sy = corrY - 20; state.branchSeen = true; }
    else {
      const c = Math.min(state.cave, CAVE_ENEMIES.length);
      const idx = state.beatBugon ? 8 : (c >= 3 ? c + 1 : c);
      const sg = segs[idx] || start;
      sx = sg.x + 11;
      sy = opts.lost ? Math.min(CAVE_H - 60, sg.y + 96) : sg.y + 18;
    }
  }
  const player = makePlayer(sx, sy);
  makeFollowers(player);
  player.onUpdate(() => { camPos(W / 2, Math.max(H / 2, Math.min(CAVE_H - H / 2, player.pos.y + 16))); });
  wireMenu();
  wireTalk(player);
  dustAtFeet(player);
  confettiRain(36);
  // a shove from a ball: a burst of velocity that dies out over a few frames
  let push = vec2(0, 0);
  const shove = (dir) => { push = dir.scale(70); found.pushes += 1; };
  player.onUpdate(() => { if (push.len() > 1) { player.move(push); push = push.scale(Math.pow(0.02, dt())); } });

  // ---- cages along the route: a lion, a bear (openable), a monkey
  animalCage(segs[1].x - 34, segs[1].y + 40, "lion", player);
  animalCage(segs[5].x - 32, segs[5].y + 24, "monkey", player, { ax: 6, ay: 9 });
  animalCage(segs[2].x + 52, segs[2].y + 42, "bear", player, { talk: () => {
    if (found.cage) { say(["* The bear is asleep again.", "* You already took the cookie. The bear knows."]); return; }
    found.cage = true; state.cookies += 1; music.sfx("pickup");
    say(["* You lift the latch. The bear does not move.", "* It is sitting on a plate of cookies. It lets you take ONE.", `* ${state.name} got a Cookie!`]);
  } });

  // ---- bouncing balls (dodgeable; never a battle)
  bouncingBall(start.x + 8, start.x + 36, start.y + 72, 0, player, shove);
  bouncingBall(segs[2].x + 8, segs[2].x + 36, segs[2].y + 80, 2.1, player, shove);
  bouncingBall(segs[7].x + 8, segs[7].x + 36, segs[7].y + 78, 4.2, player, shove);
  bouncingBall(segs[8].x + 8, segs[8].x + 36, segs[8].y + 80, 1.3, player, shove);

  // ---- spotlights: stand in one for a moment and something glints once per run
  const spots = [spotlight(segs[1].x + 22, segs[1].y + 50, 34, 30, 0.9, 0), spotlight(segs[7].x + 22, segs[7].y + 50, 34, 30, 0.7, 2)];
  let lit = 0;
  player.onUpdate(() => {
    if (found.sparkle || dialogOpen) return;
    const feet = player.pos.add(11, 26);
    const inSpot = spots.find((s) => feet.dist(s.pos) < 22);
    lit = inSpot ? lit + dt() : 0;
    if (lit > 0.8) {
      found.sparkle = true; music.sfx("unlock");
      const where = feet.add(0, -30);
      const it = add([sprite("sparkle"), pos(where), anchor("center"), z(9), area({ shape: new Rect(vec2(0, 0), 12, 12) }), "sparkle"]);
      it.onUpdate(() => { it.pos.y = where.y + Math.sin(time() * 5) * 2; it.hidden = Math.floor(time() * 8) % 4 === 0; });
      say(["* The spotlight found something in the sawdust!", "* It glints."]);
    }
  });
  player.onCollideUpdate("sparkle", (it) => {
    if (dialogOpen || !it.exists()) return;
    destroy(it); music.sfx("pickup");
    if (Math.random() < 0.5) { state.juice += 1; say(["* A JUICE BOX, dropped by someone in the audience.", `* ${state.name} got a Juice Box!`]); }
    else { state.cookies += 1; say(["* A COOKIE with one bite out of it. Still counts.", `* ${state.name} got a Cookie!`]); }
  });

  // ---- the tightrope: net floor, a 6 px beam, and a landing pit off to the side
  const beamX = tsg.x + 22;
  netFloor(tsg.x, tsg.y + 15, 44, 70);
  add([rect(6, 70), pos(beamX - 3, tsg.y + 15), color(...BT.rim), z(1.4)]);
  add([rect(2, 70), pos(beamX - 1, tsg.y + 15), color(255, 244, 200), z(1.45)]);
  add([sprite("post"), pos(beamX, tsg.y + 12), anchor("center"), z(2.3)]); add([sprite("post"), pos(beamX, tsg.y + 88), anchor("center"), z(2.3)]);
  arrowObj("up", beamX, tsg.y + 96, 4, [242, 208, 92], [z(2.3)]);
  add([rect(pit.w + 4, pit.h + 4), pos(pit.x - 2, pit.y - 2), color(...BT.rim), z(0.5)]);
  netFloor(pit.x, pit.y, pit.w, pit.h);
  add([sprite("ladder"), pos(pit.x + 4, pit.y + 2), anchor("topleft"), z(2.2)]);
  add([rect(14, 24), pos(pit.x + 2, pit.y + 2), area(), "ladderzone"]);
  let falling = false;
  player.onUpdate(() => {
    if (falling || dialogOpen || window.__frozen) return;
    const feet = player.pos.add(11, 26);
    const onNet = feet.y > tsg.y + 15 && feet.y < tsg.y + 85 && feet.x > tsg.x && feet.x < tsg.x + 44;
    if (onNet && Math.abs(feet.x - beamX) > 6) {
      falling = true; window.__frozen = true; music.sfx("back");
      player.use(rotate(0)); player.use(scale(1));
      const wob = player.onUpdate(() => { player.angle = Math.sin(time() * 30) * 12; player.scale = vec2(Math.max(0.6, player.scale.x - 1.2 * dt())); });
      wait(0.45, () => {
        wob.cancel(); player.angle = 0; player.scale = vec2(1);
        player.pos = vec2(pit.x + pit.w / 2 - 11, pit.y + pit.h / 2 - 18);
        music.sfx("bang"); shake(6);
        window.__frozen = false; falling = false;
        if (!found.fell) { found.fell = true; say(["* You wobbled. You fell. The net went BOING.", "* No harm done. There's a ladder back up."]); }
      });
    }
  });
  player.onCollide("ladderzone", () => {
    if (dialogOpen || falling) return;
    music.sfx("move");
    player.pos = vec2(tsg.x + 11, tsg.y + 86);
  });

  // ---- encounters, one per bend, in order, staged as acts
  CAVE_ENEMIES.forEach((name, i) => {
    const sg = segs[i >= 2 ? i + 2 : i + 1];
    // the stages stay even after the act is over
    if (i === 3) { if (i < state.cave) trapeze(sg.x + 22, sg.y + 2, 1.2, 18); }
    else if (i === 2) { /* the unicycle rides off with its rider */ }
    else if (i === 4) { /* the beam is the stage */ }
    else add([sprite("podium"), pos(sg.x + 8, sg.y + 56), anchor("topleft"), z(4)]);
    if (i < state.cave) return;
    // kaboom 3000 applies the anchor offset to a Rect shape itself, so a centered object takes a Rect at (0, 0)
    const shape = i === 3 ? new Rect(vec2(0, 0), 44, 14) : new Rect(vec2(0, 0), 44, 40);
    const e = add([sprite(name), pos(sg.x + 22, i === 3 ? sg.y + 58 : sg.y + 50), anchor("center"), z(5), area({ shape }), "enc"]);
    e.enemyIndex = i; e.enemyName = name;
    const by = sg.y + 50;
    if (i === 2) {
      // the unicycle act: rides back and forth across the aisle
      const uni = add([sprite("unicycle"), pos(sg.x + 22, by + 6), anchor("top"), z(4.9)]);
      e.onUpdate(() => { e.pos.x = sg.x + 22 + Math.sin(time() * 1.3) * 14; e.pos.y = by - 8 + Math.abs(Math.sin(time() * 6)) * -2; uni.pos = vec2(e.pos.x, by + 2); uni.angle = Math.cos(time() * 1.3) * 8; });
    } else if (i === 3) {
      // the trapeze act: hangs above the aisle and drops when you pass under
      const tp = trapeze(sg.x + 22, sg.y + 2, 1.2, 18);
      e.hidden = true; // the trigger under the trapeze; the visible act hangs from the bar
      const spr = add([sprite(name), pos(sg.x + 22, sg.y + 40), anchor("center"), z(5.1)]);
      e.drop = spr;
      spr.onUpdate(() => { if (e.dropping) return; const a = tp.angle * Math.PI / 180; spr.pos = vec2(sg.x + 22 + Math.sin(a) * 38, sg.y + 2 + Math.cos(a) * 38); });
    } else if (i === 4) {
      e.onUpdate(() => { e.pos.y = by + Math.sin(time() * 3 + i) * 2; e.pos.x = sg.x + 22 + Math.sin(time() * 5) * 1; });
    } else {
      e.onUpdate(() => { e.pos.y = by - 6 + Math.sin(time() * 3 + i) * 2; });
    }
  });
  player.onCollide("enc", (e) => {
    if (dialogOpen) return;
    player.pos.y += 12;
    if (e.enemyIndex !== state.cave) return;
    if (e.drop && !e.dropping) {
      e.dropping = true; window.__frozen = true; music.sfx("bang");
      const spr = e.drop, from = spr.pos.clone(), to = vec2(e.pos.x, e.pos.y - 6);
      tween(0, 1, 0.45, (v) => { spr.pos = from.lerp(to, v).add(0, -Math.sin(v * Math.PI) * 10); }, easings.easeInQuad).then(() => {
        shake(5); window.__frozen = false;
        say(ENEMIES[e.enemyName].meet, () => go("battle", e.enemyName));
      });
      return;
    }
    say(ENEMIES[e.enemyName].meet, () => go("battle", e.enemyName));
  });

  // the fork itself: a one-time signpost
  add([rect(44, 10), pos(bs.x, corrY + 8), area(), "forkzone"]);
  add([sprite("banner"), pos(bs.x - 14, corrY - 18), anchor("topleft"), z(2.2)]);
  add([sprite("banner2"), pos(bs.x + 46, corrY - 18), anchor("topleft"), z(2.2)]);
  player.onCollide("forkzone", () => {
    if (dialogOpen || state.branchSeen) return;
    state.branchSeen = true;
    say(["* The aisle forks. A curtained passage goes left, and one goes right.", "* One of them smells like cotton candy. The other smells like trouble.", "* You can't tell which is which."]);
  });

  // ---- Bugon guards the curtain to the ring once the six are down
  const g8 = segs[8], cA = Math.min(g8.x, top.x), cB = Math.max(g8.x, top.x) + 44;
  add([rect(cB - cA + 56, 8), pos(cA - 28, g8.y - 22), color(242, 208, 92), outline(1, rgb(27, 26, 46)), z(12)]);
  add([sprite("curtain"), pos(cA - 24, g8.y - 20), anchor("topleft"), z(12)]);
  add([sprite("curtain", { flipX: true }), pos(cB - 4, g8.y - 20), anchor("topleft"), z(12)]);
  if (state.cave >= CAVE_ENEMIES.length && !state.beatBugon) {
    const b = add([sprite("bugon"), pos(g8.x + 22, g8.y + 40), anchor("center"), z(5), area({ shape: new Rect(vec2(0, 0), 48, 44) }), "bugonzone"]);
    b.onUpdate(() => { b.pos.y = g8.y + 40 + Math.abs(Math.sin(time() * 4)) * -3; });
    player.onCollide("bugonzone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.bugon.meet, () => go("battle", "bugon")); });
  }
  // ---- Lygon waits in the ring under the spotlight once Bugon is gone; no door, just him
  if (state.beatBugon && !state.beatLygon) {
    const spot = add([circle(34), pos(ringC.x, ringC.y - 8), color(255, 240, 200), opacity(0.2), z(3)]);
    spot.onUpdate(() => { spot.opacity = 0.14 + 0.1 * Math.abs(Math.sin(time() * 3)); });
    const ly = add([sprite("lygon"), pos(top.x + 22, 30), anchor("center"), z(5), area({ shape: new Rect(vec2(0, 0), 44, 44) }), "lygonzone"]);
    ly.onUpdate(() => { ly.pos.y = 30 + Math.sin(time() * 2) * 2; });
    player.onCollide("lygonzone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.lygon.meet, () => go("battle", "lygon")); });
  }

  // the very bottom of the aisle is the way out
  add([rect(60, 16), pos(start.x - 8, CAVE_H - 18), area(), "caveexit"]);
  player.onCollide("caveexit", () => { if (!dialogOpen) go("town"); });

  player.onCollide("sideL", () => { if (!dialogOpen) go("sideroom", { side: "left" }); });
  player.onCollide("sideR", () => { if (!dialogOpen) go("sideroom", { side: "right" }); });
  hud();
  const fights = CAVE_ENEMIES.length - state.cave;
  wait(0.3, () => say(state.cave === 0
    ? ["* Inside the big top. Sawdust, popcorn, and a lot of confetti.", "* Something is chittering up the aisle."]
    : state.beatLygon ? ["* Quiet. Nothing up there now but confetti and two empty cages."]
    : state.beatBugon ? ["* The curtain to the ring is open. He's up there. So are they."]
    : [`* ${fights} of the clown's acts left between you and the big-eared one.`]));
});

// ---------------------------------------------------------------- scene: side room (dressing rooms)
// Off the fork. One side holds a present, the other an ambush; which is which is rolled per run.
scene("sideroom", (opts = {}) => {
  resetCam();
  music.play("cave");
  window.__frozen = false;
  const side = opts.side || "left";
  const entryRight = side === "left"; // walking off the left edge of the aisle puts you on this room's right edge
  tentCanvas(W, H);
  const room = { x: 60, y: 50, w: 200, h: 140 };
  // a boarded floor with a lit rim
  add([rect(room.w + 4, room.h + 4), pos(room.x - 2, room.y - 2), color(...BT.rim), z(0.5)]);
  add([rect(room.w, room.h), pos(room.x, room.y), color(...BT.boards), z(1)]);
  for (let y = room.y + 10; y < room.y + room.h; y += 10) add([rect(room.w, 1), pos(room.x, y), color(...BT.boardLine), z(1.1)]);
  for (let i = 0; i < 40; i++) add([rect(rand(3, 8), 1), pos(room.x + rand(0, room.w - 8), room.y + rand(0, room.h - 1)), color(...BT.boardLine), z(1.1)]);
  const doorY = room.y + room.h / 2 - 13, doorH = 26;
  // the way you came in: a short corridor to the screen edge
  if (entryRight) sawdust(room.x + room.w, doorY, W - (room.x + room.w), doorH);
  else sawdust(0, doorY, room.x, doorH);
  // walls: around the room except the corridor gap, plus corridor sides
  wall(0, 0, W, room.y); wall(0, room.y + room.h, W, H - (room.y + room.h));
  if (entryRight) {
    wall(0, room.y, room.x, room.h);
    wall(room.x + room.w, room.y, W - (room.x + room.w), doorY - room.y);
    wall(room.x + room.w, doorY + doorH, W - (room.x + room.w), room.y + room.h - (doorY + doorH));
    add([rect(6, doorH), pos(W - 6, doorY), area(), "back"]);
  } else {
    wall(room.x + room.w, room.y, W - (room.x + room.w), room.h);
    wall(0, room.y, room.x, doorY - room.y);
    wall(0, doorY + doorH, room.x, room.y + room.h - (doorY + doorH));
    add([rect(6, doorH), pos(0, doorY), area(), "back"]);
  }
  // dressing room: mirrors with bulbs along the back wall, racks in the corners, lights
  stringLights(20, 40, W - 40);
  [room.x + 30, room.x + room.w / 2 - 9, room.x + room.w - 48].forEach((mx, k) => {
    add([sprite("mirror"), pos(mx, room.y + 2), anchor("topleft"), z(2)]);
    for (let b = 0; b < 4; b++) {
      const bulb = add([rect(2, 2), pos(mx - 3 + b * 7, room.y + 1), color(255, 250, 230), opacity(1), z(2.2)]);
      bulb.onUpdate(() => { bulb.opacity = 0.5 + 0.5 * Math.abs(Math.sin(time() * 4 + b + k)); });
    }
  });
  add([sprite("rack"), pos(room.x + 6, room.y + room.h - 32), anchor("topleft"), z(7)]);
  add([sprite("rack"), pos(room.x + room.w - 40, room.y + room.h - 32), anchor("topleft"), z(7)]);
  confettiRain(20);

  const px = entryRight ? W - 40 : 18, py = doorY - 14;
  const player = makePlayer(px, py);
  wireTalk(player); wireMenu();
  dustAtFeet(player);
  player.onCollide("back", () => { if (!dialogOpen && !window.__frozen) go("cave", { resume: true, at: "branch" }); });

  const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
  if (side === state.branchSide) {
    // the present: a Giant Sword, sitting on the vanity
    add([sprite("vanity"), pos(cx - 15, cy - 2), anchor("topleft"), z(7)]);
    if (!state.giantSword) {
      const pr = add([sprite("present"), pos(cx - 8, cy - 8), anchor("topleft"), area(), body({ isStatic: true }), z(8), "npc", "present2"]);
      const sp = add([text("*", { size: 8 }), pos(cx, cy - 16), anchor("center"), color(242, 208, 92), z(9)]);
      sp.onUpdate(() => { sp.hidden = Math.floor(time() * 4) % 3 === 0; sp.pos.x = cx + Math.sin(time() * 5) * 10; });
      pr.talk = () => {
        say(["* A present. On the vanity. With a bow on it.", "* You tear off the paper.", "* ..."], () => {
          destroy(pr); destroy(sp); state.giantSword = true; music.sfx("pickup"); save("cave"); player.use(sprite("hero_giant"));
          const sw = add([sprite("sword"), pos(player.pos.x + 11, player.pos.y - 30), anchor("center"), scale(2), z(60)]);
          sw.onUpdate(() => { sw.pos.y -= 6 * dt(); sw.angle = Math.sin(time() * 6) * 5; });
          const flare = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.7), z(55), fixed()]);
          flare.onUpdate(() => { flare.opacity = Math.max(0, flare.opacity - 1.2 * dt()); });
          shake(8);
          wait(1.4, () => { destroy(sw); say([`* ${state.name} got the GIANT SWORD!`, "* It is much, much bigger than the other sword.", "* Slash now hits a LOT harder."]); });
        });
      };
      wait(0.3, () => say(["* A dressing room. Wigs, noses, one enormous shoe.", "* Something on the vanity is sparkling."]));
    } else wait(0.3, () => say(["* The dressing room where you found the Giant Sword. Just torn wrapping paper now."]));
  } else {
    // the ambush: it was hiding behind the costume rack, and it saw you first
    if (!state.branchDone) {
      const far = entryRight ? room.x + 30 : room.x + room.w - 30;
      const rackX = entryRight ? room.x + 6 : room.x + room.w - 40;
      add([sprite("rack"), pos(rackX, cy - 34), anchor("topleft"), z(7)]);
      const foe = add([sprite(state.branchEnemy), pos(far, cy - 22), anchor("center"), z(6), "ambusher"]);
      let sprung = false, out = false;
      foe.onUpdate(() => {
        if (!sprung) { foe.pos.y = cy - 22 + Math.sin(time() * 3) * 2; return; }
        if (!out) return;
        const target = player.pos.add(11, 16);
        const d = target.sub(foe.pos);
        if (d.len() > 26) foe.pos = foe.pos.add(d.unit().scale(70 * dt()));
        else if (window.__frozen) {
          window.__frozen = false; sprung = false; foe.paused = true;
          say(["* It saw you first. It's already moving.", "* There's nowhere to go but through it."], () => go("battle", "ambush"));
        }
      });
      wait(0.6, () => {
        sprung = true; window.__frozen = true; music.play("danger"); music.sfx("bang");
        // it jumps out from behind the rack
        const from = foe.pos.clone(), to = vec2(far, cy + 4);
        tween(0, 1, 0.3, (v) => { foe.pos = from.lerp(to, v).add(0, -Math.sin(v * Math.PI) * 16); }).then(() => { out = true; });
      });
    } else wait(0.3, () => say(["* The dressing room where that thing jumped you. Empty now.", "* Still smells like trouble."]));
  }
  hud();
});


// ---------------------------------------------------------------- scene: town2 (east)
// One screen east of home along the road. Drier, greyer, quieter: half the town has walked
// up the hill into the HOLLOW and come back wrong. The gate to it sits at the top of the hill.

scene("town2", (opts) => {
  opts = opts || {};
  resetCam();
  music.play("outside");
  save("town2");
  add([rect(W, H), pos(0, 0), color(150, 138, 110)]);
  for (let i = 0; i < 160; i++) add([rect(rand(2, 4), rand(1, 2)), pos(rand(0, W), rand(0, H)), color(124, 112, 90)]);
  add([rect(W, 34), pos(0, H - 48), color(196, 176, 130)]);
  add([rect(40, H - 48), pos(W / 2 - 20, 0), color(196, 176, 130)]);
  wall(0, 0, W, 4); wall(0, H - 6, W, 6); wall(W - 6, 0, 6, H);
  // west edge: back down the road to town
  wall(0, 0, 6, H - 48); wall(0, H - 14, 6, 14);
  add([rect(6, 34), pos(0, H - 48), area(), "west"]);
  arrowObj("left", 12, H - 34, 4, [242, 208, 92], [z(2)]);
  // purple glow spilling down from the hill
  const glow = add([rect(W, 80), pos(0, 0), color(199, 123, 214), opacity(0.14), z(0)]);
  glow.onUpdate(() => { glow.opacity = 0.1 + 0.1 * Math.abs(Math.sin(time() * 1.7)); });

  // houses in other colours than home's, shutters closed
  [[18, 56, [205, 165, 225]], [W - 66, 56, [165, 205, 225]], [24, 128, [235, 205, 155]]].forEach(([x, y, c]) => {
    add([sprite("house"), pos(x, y), anchor("topleft"), color(...c), z(2)]); wall(x + 2, y + 8, 42, 8);
  });
  [[W - 40, 130], [W - 70, 168], [70, 172]].forEach(([x, y]) => { add([sprite("tree"), pos(x, y), anchor("topleft"), color(200, 180, 160), z(3)]); wall(x + 5, y + 12, 8, 4); });
  // the well: stone ring, two posts, a little roof, water that catches the light
  const wx = W - 92, wy = 124;
  add([rect(3, 24), pos(wx + 2, wy - 22), color(110, 70, 44), z(2)]); add([rect(3, 24), pos(wx + 25, wy - 22), color(110, 70, 44), z(2)]);
  add([rect(36, 6), pos(wx - 3, wy - 26), color(120, 60, 40), z(3)]); add([rect(30, 2), pos(wx, wy - 20), color(80, 40, 28), z(3)]);
  add([rect(30, 20), pos(wx, wy), color(112, 106, 122), z(2)]); add([rect(22, 12), pos(wx + 4, wy + 4), color(40, 70, 130), z(3)]);
  const rip = add([rect(8, 2), pos(wx + 8, wy + 8), color(140, 190, 240), z(4)]);
  rip.onUpdate(() => { rip.pos.x = wx + 6 + (Math.sin(time() * 2) + 1) * 6; rip.opacity = 0.6 + 0.4 * Math.abs(Math.sin(time() * 3)); });
  wall(wx, wy, 30, 20);

  // the HOLLOW gate at the top of the hill
  add([sprite("hollowgate"), pos(W / 2 - 24, 0), anchor("topleft"), z(1)]);
  const gg = add([rect(44, 30), pos(W / 2 - 22, 8), color(199, 123, 214), opacity(0.25), z(2)]);
  gg.onUpdate(() => { gg.opacity = 0.16 + 0.18 * Math.abs(Math.sin(time() * 2.6)); });
  for (let i = 0; i < 5; i++) {
    const m = add([rect(2, 2), pos(W / 2 + rand(-14, 14), 34), color(199, 123, 214), opacity(0.8), z(2)]);
    m.onUpdate(() => { m.pos.y -= 10 * dt(); m.opacity -= 0.3 * dt(); if (m.opacity <= 0) { m.pos = vec2(W / 2 + rand(-14, 14), 34); m.opacity = 0.8; } });
  }
  add([rect(28, 8), pos(W / 2 - 14, 30), area(), "hollowzone"]);

  const player = makePlayer(opts.from === "north" ? W / 2 - 11 : 18, opts.from === "north" ? 48 : H - 44);
  makeFollowers(player);
  player.onCollide("west", () => { if (!dialogOpen) go("road", { from: "east" }); });
  player.onCollide("hollowzone", () => {
    if (dialogOpen) return;
    // nobody goes in alone: the man must be saved and the friends met first
    if (!state.friends) { player.pos.y += 10; say(["* A voice from inside: 'Not alone. Never alone.' The way is shut."]); return; }
    if (state.hollow === 0) {
      say(["* A door in the rock. Purple light leaks around the edges like it can't quite be held in.", "* From inside: wingbeats. Heavy footsteps. And something humming, low and pleased.", "* You went in."], () => go("hollow"));
    } else go("hollow");
  });

  // townsfolk. Their neighbours are the ones you meet inside.
  npc("elder", 112, H - 52, "granny", () => say(state.hollow >= HOLLOW_ORDER.length ? [
    "Granny Pott: They're all home. Every one of them. Crying and hugging and eating everything in my kitchen.",
    "Granny Pott: All that's left up there is HER. Go on, child. Finish it.",
  ] : state.hollow > 0 ? [
    `Granny Pott: ${state.hollow} of ours came running back down that hill. Crying. Hugging everybody. Was that you?`,
    "Granny Pott: There's more up there. Gus, Rosa, Dell, the teacher, Walt, the doctor. Bring them all back.",
  ] : [
    "Granny Pott: Half the town's gone up that hill into the HOLLOW. Gus the mailman went first. Then Rosa from the bakery.",
    "Granny Pott: They come back at night. FLYING, child. With purple eyes. Then they go back in.",
    "Granny Pott: Somebody in there is doing that to them. Somebody who likes to WATCH.",
  ]), { footY: 16 });

  npc("kid", W - 130, H - 52, "nell", () => say(state.hollow > 3 ? [
    "Nell: Ms. Abernathy came back! She gave me homework. On a WEEKEND. It's so good to have her back.",
    "Nell: The last flappy one is right by the door up top. It's the doctor. Be careful, she bites.",
  ] : [
    "Nell: Ms. Abernathy was my TEACHER. Then she flew off. I'm not sad. Okay, I'm a little sad.",
    "Nell: The stompy ones stay on the ground. The flappy ones SWOOP when you get close.",
    `Nell: They only come at you one at a time, though. The rest just wander around. Weird, right, ${state.name}?`,
    "Nell: A man in a crown came through here an hour ago. He went UP. Nobody stopped him. Nobody could.",
  ]), { footY: 14 });

  npc("mom", 60, 100, "dobbs", () => say(state.hollow >= 5 ? [
    "Mrs. Dobbs: Walt's home! He's asleep on the porch, snoring! It's the best sound in the whole world.",
    "Mrs. Dobbs: Thank you. Take some eggs. Take ALL the eggs.",
  ] : [
    "Mrs. Dobbs: My Walt went up to get the cows back. The cows came back. Walt didn't.",
    "Mrs. Dobbs: If you see a big man in overalls who's forgotten his own name... that's mine. Bring him home.",
  ]), { footY: 16 });

  npc("dad", W - 150, 104, "hix", () => say(state.hollow >= HOLLOW_ORDER.length ? [
    "Constable Hix: The doctor's back. Says there's a door open at the top of the Hollow now. Says YOU opened it.",
    "Constable Hix: I'd come with you. I would. But somebody has to stay and mind the town. That's... that's the job.",
  ] : [
    "Constable Hix: I don't know what's in there, kid. A woman, folks say. Sits with a glass ball and stares into it.",
    "Constable Hix: Sees what she likes. Takes it. Turns it. That's what she did to our mailman.",
    "Constable Hix: The doctor went in to talk sense to her. That was yesterday.",
  ]), { footY: 16 });

  wireTalk(player);
  wireMenu();
  hud();
  wait(0.3, () => say(opts.from === "north"
    ? (state.hollow >= HOLLOW_ORDER.length ? ["* Back in the east town. The hill above it has stopped humming."] : ["* Back in the east town. The gate glows behind you."])
    : state.hollow === 0
    ? ["* A town. Quieter than yours. Half the doors are shut.", "* At the top of the hill: a door in the rock, glowing purple. The HOLLOW."]
    : ["* The east town. The gate at the top of the hill is still glowing."]));
});

// ---------------------------------------------------------------- scene: the Hollow
// MALAGORE's dungeon: one tall hall of black-purple stone, chains, and light falling from
// somewhere above. Six of the east town's people guard it: three on the floor at the bottom,
// three in the air on the sides. They come at you one at a time, ground and air by turns.
// Beat all six and the seal at the top opens on MALAGORE, sitting under the ORB.

scene("hollow", (opts) => {
  opts = opts || {};
  resetCam();
  save("hollow");
  music.play("danger");
  window.__frozen = false;
  const HX = 36, HW = W - 72; // the hall runs the full height between two thick walls

  // stone
  add([rect(W, HOLLOW_H), pos(0, 0), color(14, 8, 22)]);
  for (let i = 0; i < 320; i++) add([rect(rand(2, 6), rand(1, 3)), pos(rand(0, W), rand(0, HOLLOW_H)), color(30, 18, 44)]);
  add([rect(HW, HOLLOW_H), pos(HX, 0), color(40, 28, 58), z(1)]);
  for (let y = 0; y < HOLLOW_H; y += 24) {
    add([rect(HW, 1), pos(HX, y), color(30, 20, 46), z(1)]);
    for (let x = HX + ((y / 24) % 2) * 20; x < HX + HW; x += 40) add([rect(1, 24), pos(x, y), color(30, 20, 46), z(1)]);
  }
  wall(0, 0, HX, HOLLOW_H); wall(W - HX, 0, HX, HOLLOW_H); wall(0, 0, W, 24); wall(0, HOLLOW_H - 4, W, 4);
  // faint light falling from far above
  [[64, 18], [148, 26], [232, 14]].forEach(([x, w], i) => {
    const b = add([rect(w, HOLLOW_H), pos(x, 0), color(199, 123, 214), opacity(0.06), z(2)]);
    b.onUpdate(() => { b.opacity = 0.03 + 0.05 * Math.abs(Math.sin(time() * 0.9 + i * 1.3)); });
  });
  // chains from the ceiling and from rings in the walls
  const chain = (x, y, len) => { add([rect(2, len), pos(x, y), color(84, 76, 104), z(3)]); for (let k = 0; k < len; k += 7) add([rect(4, 3), pos(x - 1, y + k), color(110, 100, 132), z(3)]); };
  [[50, 24, 90], [108, 24, 60], [212, 24, 70], [268, 24, 110]].forEach(([x, y, l]) => chain(x, y, l));
  for (let y = 160; y < HOLLOW_H - 80; y += 120) { chain(HX + 6, y, 50 + (y % 70)); chain(W - HX - 8, y + 40, 40 + (y % 50)); }
  // stalactites down both walls
  for (let y = 40; y < HOLLOW_H - 40; y += 36) [HX, W - HX - 6].forEach((x) => {
    add([rect(6, 4), pos(x, y), color(24, 14, 36), z(3)]); add([rect(4, 4), pos(x + 1, y + 4), color(24, 14, 36), z(3)]); add([rect(2, 4), pos(x + 2, y + 8), color(24, 14, 36), z(3)]);
  });
  // purple fire in wall sconces
  for (let y = 100; y < HOLLOW_H; y += 130) [HX + 4, W - HX - 7].forEach((x) => {
    const t = add([rect(3, 6), pos(x, y), color(199, 123, 214), z(2)]);
    t.onUpdate(() => { t.color = rgb(160 + rand(0, 60), 100 + rand(0, 40), 220); });
  });

  // where everyone stands. Flyers patrol a sine path around their home; walkers pace on the floor.
  const HOMES = {
    clonk: { x: 80, y: 540 }, thud: { x: 160, y: 540 }, grumbo: { x: 240, y: 540 },
    skreek: { x: 96, y: 430, amp: 60, ph: 0 }, flitz: { x: 224, y: 320, amp: 60, ph: 2 }, batty: { x: 96, y: 220, amp: 60, ph: 4 },
  };
  const SEAL_Y = 130, BOSS = { x: W / 2, y: 86 };

  let sx = W / 2 - 11, sy = HOLLOW_H - 52;
  if (opts.resume) {
    if (opts.boss) sy = SEAL_Y + 40;
    else {
      const idx = Math.max(0, Math.min(HOLLOW_ORDER.length - 1, opts.lost ? state.hollow : state.hollow - 1));
      const h = HOMES[HOLLOW_ORDER[idx]];
      sx = Math.max(HX + 4, Math.min(W - HX - 26, h.x - 11)); sy = Math.min(HOLLOW_H - 52, h.y + (opts.lost ? 60 : 34));
    }
  }
  const player = makePlayer(sx, sy);
  makeFollowers(player);
  player.onUpdate(() => { camPos(W / 2, Math.max(H / 2, Math.min(HOLLOW_H - H / 2, player.pos.y + 16))); });
  wireMenu();

  HOLLOW_ORDER.forEach((name, i) => {
    if (i < state.hollow) return;
    const h = HOMES[name], flying = h.amp !== undefined;
    const e = add([sprite(ENEMIES[name].spr), pos(h.x, h.y), anchor("center"), z(flying ? 12 : 5), area({ shape: new Rect(vec2(0, 0), 30, 26) }), "henc", flying ? "hswoop" : "hstomp"]);
    e.enemyIndex = i; e.enemyName = name; e.flying = flying; e.armed = i === state.hollow; e.diving = false; e.chasing = false;
    let t = rand(0, 6), wt = 0, wdir = vec2(0, 0);
    e.onUpdate(() => {
      e.armed = e.enemyIndex === state.hollow;
      t += dt();
      if (flying) {
        const target = player.pos.add(11, 16);
        const near = e.armed && !dialogOpen && target.dist(vec2(h.x, h.y)) < 110;
        const before = e.pos.x;
        if (near) {
          // the dive: straight at you, wings beating
          e.diving = true;
          const d = target.sub(e.pos);
          if (d.len() > 4) e.pos = e.pos.add(d.unit().scale(58 * dt()));
          e.pos.y += Math.sin(t * 14) * 0.6;
        } else {
          e.diving = false;
          // the patrol wanders: a steady back-and-forth sweep (no slow turn at the ends) whose centre drifts
          const tri = (p) => 2 * Math.abs(((p / Math.PI) % 2 + 2) % 2 - 1) - 1;
          const gx = h.x + tri(t * 0.9 + h.ph) * h.amp + Math.sin(t * 0.17 + h.ph) * 20, gy = h.y + Math.sin(t * 2.3 + h.ph) * 10 + Math.sin(t * 0.31 + h.ph) * 18;
          e.pos = e.pos.add(vec2(gx, gy).sub(e.pos).scale(Math.min(1, 14 * dt())));
        }
        if (Math.abs(e.pos.x - before) > 0.05) e.flipX = e.pos.x < before;
      } else {
        const target = player.pos.add(11, 16), d = target.sub(e.pos);
        if (e.armed && !dialogOpen && d.len() < 90 && d.len() > 4) {
          // the armed walker hunts: straight at you
          e.chasing = true;
          e.pos = e.pos.add(d.unit().scale(40 * dt())); e.flipX = d.x < 0;
        } else {
          // the others wander the floor: a few steps, a pause, a new direction
          e.chasing = false; wt -= dt();
          if (wt <= 0) { wt = rand(0.8, 2); const a = rand(0, Math.PI * 2); wdir = Math.random() < 0.35 ? vec2(0, 0) : vec2(Math.cos(a), Math.sin(a)); }
          if (wdir.len() > 0) { e.pos = e.pos.add(wdir.scale(22 * dt())); e.flipX = wdir.x < 0; }
        }
        e.pos.x = clamp(e.pos.x, HX + 18, W - HX - 18); e.pos.y = clamp(e.pos.y, h.y - 50, Math.min(HOLLOW_H - 30, h.y + 50));
      }
    });
    // the armed one carries a mark, so the order is readable at a glance
    const mark = add([text("!", { size: 10 }), pos(h.x, h.y - 22), anchor("center"), color(242, 208, 92), z(13)]);
    mark.onUpdate(() => { mark.hidden = !e.armed || Math.floor(time() * 3) % 3 === 0; mark.pos = e.pos.add(0, -22); });
  });
  let hinted = false;
  player.onCollide("henc", (e) => {
    if (dialogOpen) return;
    player.pos.y += 12;
    if (e.enemyIndex !== state.hollow) {
      if (!hinted) { hinted = true; say(["* It hisses at you, but hangs back.", "* They come one at a time. Another one wants you first."]); }
      return;
    }
    say(ENEMIES[e.enemyName].meet, () => go("battle", e.enemyName));
  });

  if (state.hollow < HOLLOW_ORDER.length) {
    // the seal: a wall of purple light across the hall, until all six are back to themselves
    const seal = wall(HX, SEAL_Y, HW, 14, [199, 123, 214]);
    seal.use(opacity(0.5)); seal.z = 6;
    seal.onUpdate(() => { seal.opacity = 0.35 + 0.25 * Math.abs(Math.sin(time() * 4)); });
    for (let k = 0; k < 6; k++) add([rect(2, 14), pos(HX + 20 + k * 40, SEAL_Y), color(244, 241, 234), opacity(0.5), z(7)]);
    add([rect(HW, 6), pos(HX, SEAL_Y + 14), area(), "hseal"]);
    player.onCollide("hseal", () => {
      if (dialogOpen) return;
      player.pos.y += 10;
      const left = HOLLOW_ORDER.length - state.hollow;
      say(["* A wall of purple light. It hums.", `* ${left} of hers still stand between you and whatever is on the other side.`]);
    });
  } else if (!state.beatMalva) {
    // MALAGORE, on her chair, under the ORB
    const spot = add([rect(90, 70), pos(BOSS.x - 45, BOSS.y - 60), color(199, 123, 214), opacity(0.14), z(1)]);
    spot.onUpdate(() => { spot.opacity = 0.1 + 0.1 * Math.abs(Math.sin(time() * 2.2)); });
    add([rect(44, 30), pos(BOSS.x - 22, BOSS.y - 6), color(28, 18, 44), z(3)]); add([rect(48, 6), pos(BOSS.x - 24, BOSS.y + 22), color(22, 14, 36), z(3)]);
    const oglow = add([circle(18), pos(BOSS.x, BOSS.y - 48), color(199, 123, 214), opacity(0.3), z(3)]);
    const orb = add([sprite("orb"), pos(BOSS.x, BOSS.y - 48), anchor("center"), rotate(0), z(4), "orb"]);
    orb.onUpdate(() => { orb.angle = Math.sin(time() * 0.8) * 12; orb.scale = vec2(1 + 0.08 * Math.sin(time() * 2)); oglow.opacity = 0.2 + 0.15 * Math.abs(Math.sin(time() * 2.5)); });
    const mv = add([sprite("malva"), pos(BOSS.x, BOSS.y), anchor("center"), z(5), area({ shape: new Rect(vec2(0, 0), 48, 56) }), "malvazone"]);
    mv.onUpdate(() => { mv.pos.y = BOSS.y + Math.sin(time() * 1.5) * 1.5; });
    player.onCollide("malvazone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.malva.meet, () => go("battle", "malva")); });
  } else {
    // her chair is empty; behind it the rock has opened onto the mountain
    add([rect(44, 30), pos(BOSS.x - 22, BOSS.y - 6), color(28, 18, 44), z(3)]); add([rect(48, 6), pos(BOSS.x - 24, BOSS.y + 22), color(22, 14, 36), z(3)]);
    add([rect(40, 30), pos(BOSS.x - 20, 0), color(199, 123, 214), opacity(0.35), z(3)]);
    arrowObj("up", BOSS.x, 34, 4, [242, 208, 92], [z(3)]);
    add([rect(40, 12), pos(BOSS.x - 20, 24), area(), "hsummit"]);
    player.onCollide("hsummit", () => { if (!dialogOpen) go("summit"); });
  }

  // the bottom of the hall is the way out, back to the east town
  add([rect(60, 12), pos(W / 2 - 30, HOLLOW_H - 14), area(), "hexit"]);
  arrowObj("down", W / 2, HOLLOW_H - 22, 4, [242, 208, 92], [z(3)]);
  player.onCollide("hexit", () => { if (!dialogOpen) go("town2", { from: "north" }); });
  hud();
  const left = HOLLOW_ORDER.length - state.hollow;
  wait(0.3, () => say(state.hollow === 0
    ? ["* Black stone. Purple light from somewhere far above. Chains, swaying with no wind.", "* Wingbeats, high up. Footsteps, close. Six shapes with purple eyes, and every one of them used to be somebody."]
    : left > 0 ? [`* ${left} of hers left. The seal at the top is still humming.`]
    : state.beatMalva ? ["* The Hollow is dark and quiet. At the top, where her chair was, the rock is open to the sky.", "* Yugrin went that way. EAST, up the mountain."]
    : ["* The seal is gone. At the top of the hall, something purple is pulsing like a heartbeat.", "* She's up there. So is the orb."]));
});

// ---------------------------------------------------------------- scene: the summit
// One screen of bare mountain above the Hollow. Yugrin stands at the top with the orb on his staff.

scene("summit", (opts) => {
  opts = opts || {};
  resetCam();
  save("summit");
  music.play("summit");
  window.__frozen = false;
  // purple sky, a far ridge, the stone shelf you stand on, and the cliff edge along its bottom
  add([rect(W, H), pos(0, 0), color(34, 14, 54)]);
  for (let i = 0; i < 50; i++) add([rect(1, 1), pos(rand(0, W), rand(0, 90)), color(232, 232, 240), opacity(rand(0.3, 0.9))]);
  [[40, 30], [150, 22], [250, 34]].forEach(([x, w], i) => {
    const b = add([rect(w, 120), pos(x, 0), color(199, 123, 214), opacity(0.08), z(0)]);
    b.onUpdate(() => { b.opacity = 0.04 + 0.06 * Math.abs(Math.sin(time() * 0.8 + i)); });
  });
  for (let x = -20; x < W; x += 60) add([circle(40), pos(x + 30, 118), color(20, 8, 34), z(0)]);
  add([rect(W, 130), pos(0, 110), color(56, 50, 66), z(1)]);
  for (let i = 0; i < 160; i++) add([rect(rand(2, 5), rand(1, 2)), pos(rand(0, W), rand(112, H)), color(...(Math.random() < 0.5 ? [44, 38, 54] : [70, 64, 82])), z(1)]);
  // the cliff edge: the shelf drops off along the bottom, except for the path back down
  add([rect(W, 6), pos(0, H - 26), color(30, 26, 40), z(2)]);
  for (let x = 0; x < W; x += 14) add([rect(8, 3), pos(x + 3, H - 24), color(20, 16, 30), z(2)]);
  wall(0, 0, W, 112); wall(0, 0, 6, H); wall(W - 6, 0, 6, H);
  wall(0, H - 26, W / 2 - 24, 26); wall(W / 2 + 24, H - 26, W / 2 - 24, 26);
  add([rect(48, 26), pos(W / 2 - 24, H - 26), color(70, 64, 82), z(2)]);
  arrowObj("down", W / 2, H - 14, 4, [242, 208, 92], [z(3)]);
  add([rect(48, 6), pos(W / 2 - 24, H - 6), area(), "down"]);
  [[30, 150], [270, 130], [60, 200], [250, 196]].forEach(([x, y]) => { add([sprite("rock"), pos(x, y), anchor("topleft"), z(3 + y / 1000)]); wall(x + 2, y + 8, 14, 5); });

  const player = makePlayer(W / 2 - 11, opts.retry ? H - 80 : H - 62);
  makeFollowers(player);
  wireTalk(player); wireMenu(); hud();
  player.onCollide("down", () => { if (!dialogOpen) go("hollow", { resume: true, boss: true }); });

  if (!state.beatYugrin) {
    // YUGRIN, at the top, the orb burning on his staff
    const yx = W / 2, yy = 126;
    const glow = add([circle(16), pos(yx + 20, yy - 18), color(199, 123, 214), opacity(0.3), z(4)]);
    const orb = add([sprite("orb"), pos(yx + 20, yy - 18), anchor("center"), scale(0.7), z(6), "orb"]);
    orb.onUpdate(() => { orb.angle = Math.sin(time() * 0.8) * 10; glow.opacity = 0.2 + 0.15 * Math.abs(Math.sin(time() * 2.5)); });
    const y = add([sprite("minion"), pos(yx, yy), anchor("center"), z(5), area({ shape: new Rect(vec2(0, 0), 44, 56) }), "yugrinzone"]);
    y.onUpdate(() => { y.pos.y = yy + Math.sin(time() * 1.5) * 1.5; });
    player.onCollide("yugrinzone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.yugrin.meet, () => go("battle", "yugrin")); });
  }
  wait(0.3, () => say(opts.retry ? ["* You got up. He is still up there. So is the orb."] : ["* The top of the mountain. Wind, stars, and purple light.", "* Yugrin is standing at the summit. The orb is burning on his staff."]));
});


// ---------------------------------------------------------------- scene: the trouble house (house2)
// Next door. A scared man, two neighbours with purple eyes, and the KING behind them with his
// hand up. The fight is against both at once; the friends barge in during it. Afterwards the
// King shoves you down and runs east; the friends join.

scene("house2", (opts) => {
  opts = opts || {};
  resetCam();
  window.__frozen = false;
  const after = !!opts.after, quiet = state.kingFled && !after;
  music.play(quiet ? "night" : "danger");
  if (!after) save("house2");
  add([rect(W, H), pos(0, 0), color(196, 170, 150)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(176, 150, 130)]);
  wall(0, 0, W, 40, [120, 150, 190]);
  wall(0, 0, 8, H, [100, 70, 45]); wall(W - 8, 0, 8, H, [100, 70, 45]);
  wall(0, H - 8, W / 2 - 22, 8, [100, 70, 45]); wall(W / 2 + 22, H - 8, W / 2 - 22, 8, [100, 70, 45]);
  const windows = [{ x: 60, y: 8, w: 30, h: 22 }, { x: W - 90, y: 8, w: 30, h: 22 }];
  windows.forEach(drawWindow);
  add([rect(44, 8), pos(W / 2 - 22, H - 8), color(60, 40, 20)]);
  arrowObj("down", W / 2, H - 16, 4, [242, 208, 92], []);
  // a couch, a bread shelf, a table that has been knocked about
  wall(40, 150, 56, 22, [150, 90, 90]); add([rect(52, 4), pos(42, 148), color(180, 110, 110)]);
  wall(W - 80, 60, 60, 24, [140, 100, 60]);
  for (let i = 0; i < 5; i++) add([rect(6, 4), pos(W - 76 + i * 11, 66), color(214, 170, 100), z(2)]);
  wall(200, 156, 70, 22, [90, 110, 160]);
  for (let i = 0; i < 9; i++) add([rect(8, 5), pos(30 + ((i * 37) % (W - 70)), 62 + ((i * 53) % (H - 110))), color(244, 241, 234), rotate(-40 + i * 10), z(1)]);

  const player = makePlayer(W / 2 - 11, after ? 118 : H - 46);
  add([rect(44, 6), pos(W / 2 - 22, H - 6), area(), "door"]);
  player.onCollide("door", () => { if (!dialogOpen && !window.__frozen) { music.sfx("door"); go("town", { from: "trouble" }); } });
  wireTalk(player); wireMenu(); hud();

  if (quiet) {
    // afterwards: two neighbours with cold towels on their heads
    makeFollowers(player);
    npc("man", 40, 96, "man", () => say([
      "Man: He's gone, kid. EAST. Toward the next town, and that hill with the hole in it.",
      "Man: You didn't hit HIM once. He just... shoved you and went. What kind of king is that.",
    ]), { footY: 16 });
    npc("stomper1", 44, 122, "fenn", () => say(["Mr. Fenn: I'm all right. I'm all right. Did I... did I try to MAIL you?", "Mr. Fenn: Stamps. I remember stamps. Purple ones."]), { footY: 22 });
    npc("swooper1", 74, 124, "bea", () => say(["Old Bea: The King came in like he owned the place. Said 'rise'. I ROSE. Right up to the CEILING.", "Old Bea: Free bread for life, dear. When I can stand."]), { footY: 18 });
    wait(0.3, () => say(["* Mr. Fenn and Old Bea are on the couch with cold towels on their heads.", "* The man is sweeping up letters."]));
    return;
  }

  const man = add([sprite("man"), pos(30, 96), anchor("topleft"), z(8)]);
  const fenn = add([sprite("stomper1"), pos(after ? 44 : 104, after ? 124 : 92), anchor("topleft"), z(8)]);
  const bea = add([sprite("swooper1"), pos(after ? 74 : 128, after ? 126 : 60), anchor("topleft"), z(9)]);
  const king = add([sprite("king"), pos(after ? W / 2 + 40 : 182, after ? 96 : 84), anchor("topleft"), z(8), "king"]);
  // the King's raised hand: a purple glow, and the wash it throws over the room
  const hand = add([circle(6), pos(king.pos.x + 18, king.pos.y - 2), color(199, 123, 214), opacity(0.6), z(9)]);
  const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0.12), z(30), fixed()]);
  hand.onUpdate(() => { hand.pos = king.pos.add(18, -2); hand.opacity = 0.4 + 0.3 * Math.abs(Math.sin(time() * 5)); hand.radius = 5 + Math.sin(time() * 5) * 1.5; wash.opacity = 0.06 + 0.06 * Math.abs(Math.sin(time() * 5)); });
  window.__frozen = true;
  const slide = (o, to, d, ease) => tween(o.pos, to, d, (p) => { o.pos = p; }, ease || easings.easeOutQuad);

  if (!after) {
    man.onUpdate(() => { man.pos.x = 30 + rand(-0.6, 0.6); });
    bea.onUpdate(() => { bea.pos.y = 60 + Math.sin(time() * 3) * 3; });
    const lines = opts.retry ? ["The King: Back on your feet? Good.", "The King: Rise, my subjects. RISE."] : [
      "Man: P-please! Bea! Fenn! It's ME! You KNOW me!",
      `Man: ...${state.name}?! Kid! Get out of here! They're not... they're not THEM anymore!`,
      "The King: Rise, my subjects. RISE.",
      "* The two of them turned around. Their eyes glow purple.",
      "MR. FENN: MAIL. FOR. YOU.",
      "OLD BEA: FRESH. BREAD.",
      "The King: Ah. The sword boy. She said you would come. She sees everything.",
      "The King: Fenn. Bea. Take him.",
    ];
    wait(0.5, () => say(lines, () => go("battle", "house2")));
    return;
  }

  // after the fight: the friends are by the door, the King has not moved
  fenn.opacity = 0.8; bea.opacity = 0.8;
  const friends = ["pip", "zed", "bruno"].map((n, i) => add([sprite(n), pos(W / 2 + 28 + i * 26, H - 72), anchor("topleft"), z(8), "friend"]));
  wait(0.6, () => say(["The King: ...Hm.", "The King: Useful, that sword. She wants it. She wants YOU."], () => {
    // the shove
    slide(king, vec2(player.pos.x + 22, player.pos.y - 2), 0.3, easings.easeInQuad);
    wait(0.32, () => {
      music.sfx("bang"); shake(22);
      add([text("OOF!", { size: 16 }), pos(player.pos.x + 12, player.pos.y - 14), anchor("center"), color(242, 208, 92), z(60), opacity(1), lifespan(0.9, { fade: 0.4 }), move(UP, 20)]);
      slide(player, vec2(player.pos.x - 44, player.pos.y + 8), 0.3);
      tween(0, -80, 0.3, (a) => { player.angle = a; });
      wait(0.6, () => say(["The King: Tell HER I am not finished.", "The King: Nobody rises without me."], () => {
        music.sfx("door");
        slide(king, vec2(W / 2 - 10, H - 34), 0.6, easings.easeInQuad);
        wait(0.65, () => {
          destroy(king); hand.hidden = true; wash.opacity = 0; shake(8);
          state.kingFled = true;
          tween(-80, 0, 0.4, (a) => { player.angle = a; });
          wait(0.5, () => say([
            "Man: ...Kid? Kid! Are you all right?",
            "Man: He's gone. Out the door. EAST, toward the next town. Laughing.",
            "Man: Bea? Fenn? ...They're breathing. They're okay. You did that.",
            "Pip: We saw him run. He's not getting away with it.",
            "Zed: I have MORE zip in this gun. Lots more.",
            "Bruno: HYAA.",
            `Pip: We're coming with you, ${state.name}. Don't argue.`,
            "* PIP, ZED and BRUNO joined the party!",
          ], () => {
            state.party = ["pip", "zed", "bruno"]; state.friends = true; state.rockets = 3; partyHpInit(); fullHeal();
            music.sfx("pickup"); save("house2");
            destroyAll("friend"); makeFollowers(player); window.__frozen = false;
          }));
        });
      }));
    });
  }));
});

// ---------------------------------------------------------------- scene: the road (between the towns)
// A wide strip of country: grass, a dirt road, trees and rocks to weave around. Strays wander
// it and come for you when you are close. Mr. Bloop is sitting in the middle of it.

const ROAD_W = 960;
const ROAM_DONE = new Set(); // strays beaten this visit; a fresh entry brings them back
// a wandering enemy: ambles, then walks at you inside ~90px. Trees and rocks stop it like they stop you.
function roamer(key, id, x, y, player, graceUntil = 0) {
  const def = ENEMIES[key];
  const e = add([sprite(def.spr), pos(x, y), anchor("center"), area({ shape: new Rect(vec2(0, 6), 24, 22) }), body(), z(8), "roamer"]); // a Rect area is centred by the anchor; this one hangs low, where feet meet
  e.roamId = id; e.enemyName = key; e.chasing = false;
  let dir = vec2(1, 0), t = 0;
  e.onUpdate(() => {
    if (dialogOpen || window.__frozen) return;
    const target = player.pos.add(11, 16), d = target.sub(e.pos);
    e.chasing = d.len() < 90 && time() > graceUntil;
    if (e.chasing) { e.move(d.unit().scale(40)); e.flipX = d.x < 0; }
    else {
      t -= dt();
      if (t <= 0) { t = rand(0.8, 2); const a = rand(0, Math.PI * 2); dir = Math.random() < 0.3 ? vec2(0, 0) : vec2(Math.cos(a), Math.sin(a)); }
      if (dir.len() > 0) { e.move(dir.scale(22)); e.flipX = dir.x < 0; }
    }
    e.z = 8 + e.pos.y / 1000;
  });
  const mark = add([text("!", { size: 10 }), pos(x, y - 20), anchor("center"), color(224, 69, 63), z(13)]);
  mark.onUpdate(() => { if (!e.exists()) { destroy(mark); return; } mark.hidden = !e.chasing || Math.floor(time() * 3) % 3 === 0; mark.pos = e.pos.add(0, -20); });
  return e;
}
function roamWin(o) { ROAM_DONE.add(o.roamer); healAll(6); go(o.map || "road", { resume: true, at: o.at }); }

scene("road", (opts) => {
  opts = opts || {};
  resetCam();
  music.play("outside");
  window.__frozen = false;
  save("road");
  if (!opts.resume) ROAM_DONE.clear();
  const RY = 150, RH = 40;
  add([rect(ROAD_W, H), pos(0, 0), color(94, 170, 100)]);
  add([rect(ROAD_W, 70), pos(0, 0), color(74, 140, 90)]);
  for (let x = 0; x < ROAD_W; x += 48) add([circle(26), pos(x, 70), color(80, 150, 92), z(0)]);
  for (let i = 0; i < 420; i++) add([rect(1, 2), pos((i * 97) % ROAD_W, 72 + ((i * 53) % (H - 72))), color(70, 140, 80)]);
  add([rect(ROAD_W, RH), pos(0, RY), color(214, 190, 140)]);
  for (let x = 20; x < ROAD_W; x += 60) { add([rect(24, 2), pos(x, RY + 12), color(190, 166, 120)]); add([rect(24, 2), pos(x + 30, RY + 26), color(190, 166, 120)]); }
  wall(0, 0, ROAD_W, 70); wall(0, H - 10, ROAD_W, 10);
  wall(0, 70, 6, RY - 70); wall(0, RY + RH, 6, H - RY - RH); add([rect(6, RH), pos(0, RY), area(), opacity(0), "west"]);
  wall(ROAD_W - 6, 70, 6, RY - 70); wall(ROAD_W - 6, RY + RH, 6, H - RY - RH); add([rect(6, RH), pos(ROAD_W - 6, RY), area(), opacity(0), "east"]);
  arrowObj("left", 12, RY + 20, 4, [242, 208, 92], [z(2)]);
  arrowObj("right", ROAD_W - 12, RY + 20, 4, [242, 208, 92], [z(2)]);
  // obstacles: fixed, so the map can be learned. Some sit right on the road.
  const DECOR = [
    ["tree", 70, 84], ["tree", 130, 200], ["bush", 200, 122], ["rock", 262, 162], ["tree", 310, 92], ["rock2", 380, 128], ["bush", 420, 204],
    ["tree", 470, 84], ["bush", 540, 196], ["rock2", 612, 168], ["bush", 660, 98], ["tree", 720, 198], ["rock", 780, 124], ["tree", 830, 86], ["bush", 870, 206], ["rock", 900, 150],
  ];
  const FOOT = { tree: [5, 12, 8, 4], bush: [2, 10, 14, 5], rock: [2, 8, 14, 5], rock2: [2, 10, 20, 5] };
  DECOR.forEach(([s, x, y]) => { add([sprite(s), pos(x, y), anchor("topleft"), z(3 + y / 1000)]); const f = FOOT[s]; wall(x + f[0], y + f[1], f[2], f[3]); });

  let sx = 20, sy = RY + 4;
  if (opts.from === "east") sx = ROAD_W - 46;
  if (opts.resume && opts.at) { sx = opts.at.x; sy = opts.at.y; }
  const player = makePlayer(sx, sy);
  makeFollowers(player);
  player.onUpdate(() => { camPos(Math.max(W / 2, Math.min(ROAD_W - W / 2, player.pos.x + 12)), H / 2); });
  player.onCollide("west", () => { if (!dialogOpen) go("town", { from: "east" }); });
  player.onCollide("east", () => { if (!dialogOpen) go("town2", { from: "west" }); });
  wireTalk(player); wireMenu(); hud();

  npc("sign", 40, 126, "sign", () => say(["* EAST: the next town. WEST: home.", "* Somebody scratched under it, fresh: 'THE KING WENT THIS WAY ->'"]), { footY: 10 });

  // MR. BLOOP, sitting in the middle of the road
  if (!(state.party || []).includes("bloop")) {
    const bl = npc("bloop", 500, RY + 10, "bloop", meetBloop, { footY: 10 });
    add([rect(30, RH), pos(486, RY), area(), opacity(0), "bloopzone"]);
    let met = false;
    player.onCollide("bloopzone", () => { if (!dialogOpen && !met) meetBloop(); });
    function meetBloop() {
      if (met) return; met = true;
      say([
        "???: bloop.",
        "* A round, ringed creature is sitting in the middle of the road. It has no arms. It has a ring, like a tiny planet.",
        "MR. BLOOP: You are the sword kid. Bloop saw the King. Bloop did not like the King.",
        "MR. BLOOP: He went EAST. To the town with the hole in the hill. He was laughing. Bloop does not laugh.",
        "MR. BLOOP: Bloop is coming. Bloop can only kick. Bloop kicks GOOD.",
        "* MR. BLOOP joined the party!",
      ], () => {
        destroy(bl); destroyAll("bloopzone");
        state.party = [...(state.party || []), "bloop"]; partyHpInit(); music.sfx("pickup"); save("road");
        makeFollowers(player);
      });
    }
  }

  // the strays
  const ROAMERS = [["roadswoop", 300, 110], ["roadstomp", 700, 206], ["roadswoop", 860, 112]];
  const grace = time() + (opts.resume ? 1.5 : 0);
  ROAMERS.forEach(([key, x, y], i) => { if (!ROAM_DONE.has(i)) roamer(key, i, x, y, player, grace); });
  player.onCollide("roamer", (e) => {
    if (dialogOpen || window.__frozen) return;
    window.__frozen = true; music.play("danger"); music.sfx("bang");
    say(ENEMIES[e.enemyName].meet, () => go("battle", e.enemyName, { map: "road", roamer: e.roamId, at: { x: player.pos.x, y: player.pos.y } }));
  });

  if (!opts.resume) wait(0.3, () => say(opts.from === "east"
    ? ["* The road home. Something is moving in the grass."]
    : (state.party || []).includes("bloop") ? ["* The road east. The strays are still out here."]
    : ["* The road east. Trees, rocks, and something moving in the grass.", "* The King's footprints go this way."]));
});


// ---------------------------------------------------------------- scene: battle

// Every enemy carries a `mini` block that tunes its turn minigames. Tuning is data:
//   attack:   how the player's power is decided — "mash" | "timing" | "sequence", or one per action
//             as { slash, fire, ice, star }. Power only ever scales damage; an attack never fails.
//   defend:   how the player shaves incoming damage — "mashB" | "block" | "wait" (never to zero).
//   pick:     which defend entry runs — "first" (default) | "cycle" | "random" | "phase".
//   phases:   for pick "phase" — [{ above: hpFraction, defend, fakeouts, flurry }], first match wins.
//   speed:    sweeps and timers run this much faster.   zone: perfect-zone width as a fraction of the track.
//   zones:    sweet zones per timing sweep.   fakeouts: fake twitches in a WAIT.   double: chance of two attacks.
const ENEMIES = {
  chompo: {
    name: "CHOMPO", spr: "chompo", hp: 16, weak: "ice", bg: [74, 36, 46], band: [128, 52, 56], tent: true,
    meet: ["* A pink toad with far too many teeth hops into the path.", "CHOMPO: chomp?"],
    intro: ["* CHOMPO wants to bite something!"],
    attacks: [{ t: "chomped at %n!", d: [2, 4] }, { t: "licked its own eye.", d: [0, 0] }],
    win: ["* CHOMPO burped and hopped away."], small: true,
    mini: { attack: "mash", defend: ["mashB", "block"], pick: "cycle", speed: 1.0, zone: 0.3 },
  },
  zagg: {
    name: "ZAGG", spr: "zagg", hp: 20, weak: "fire", bg: [66, 34, 52], band: [118, 50, 70], tent: true,
    meet: ["* A blue thing with one enormous eye and a zigzag grin blocks the way.", "ZAGG: zzzzZZAGG."],
    intro: ["* ZAGG is grinning. It has a LOT of grin."],
    attacks: [{ t: "grinned at %n! It's very unsettling.", d: [2, 5] }, { t: "blinked. Slowly.", d: [0, 0] }],
    win: ["* ZAGG's grin got smaller and smaller until it left."], small: true,
    mini: { attack: { slash: "mash", fire: "timing", ice: "timing", star: "timing" }, defend: ["block"], speed: 1.0, zone: 0.3 },
  },
  skitter: {
    name: "SKITTER", spr: "skitter", hp: 22, weak: "ice", bg: [72, 38, 44], band: [132, 60, 52], tent: true,
    meet: ["* Something low and clicky scuttles out of the dark, headlamp swinging.", "SKITTER: bzzt. INTRUDER."],
    intro: ["* SKITTER's headlamp is pointed right at you!"],
    attacks: [{ t: "zapped %n with its headlamp!", d: [3, 5] }, { t: "scuttled in a circle.", d: [0, 0] }],
    win: ["* SKITTER's little legs gave out. It rolled away."], small: true,
    mini: { attack: "wait-line", defend: ["block"], speed: 1.2, zone: 0.3 },
  },
  wibblo: {
    name: "WIBBLO", spr: "wibblo", hp: 24, weak: "fire", bg: [78, 34, 50], band: [138, 52, 66], tent: true,
    meet: ["* A pink blob with three eyes and two wiggly antennae drifts down.", "WIBBLO: wibble wibble."],
    intro: ["* WIBBLO's antennae are wiggling menacingly!"],
    attacks: [{ t: "bonked %n with an antenna!", d: [3, 6] }, { t: "wibbled.", d: [0, 0] }],
    win: ["* WIBBLO wibbled off in a huff."], small: true,
    mini: { attack: "timing", defend: ["wait"], speed: 1.0, zone: 0.3, fakeouts: 0 },
  },
  redstack: {
    name: "REDSTACK", spr: "redstack", hp: 28, weak: "ice", bg: [76, 30, 36], band: [140, 48, 46], tent: true,
    meet: ["* A tall red robot unfolds from the wall, segment by segment.", "REDSTACK: HALT. TICKETS PLEASE."],
    intro: ["* REDSTACK is stacking up!"],
    attacks: [{ t: "swung a claw at %n!", d: [3, 6] }, { t: "checked %n for a ticket. Found none.", d: [1, 3] }],
    win: ["* REDSTACK toppled over one segment at a time. Clonk. Clonk. Clonk."], small: true,
    mini: { attack: "wait-line", zones: 2, defend: ["mashB", "wait"], pick: "cycle", speed: 1.0, zone: 0.28, fakeouts: 1 },
  },
  boxor: {
    name: "BOXOR", spr: "boxor", hp: 36, weak: "fire", bg: [70, 32, 48], band: [126, 54, 62], tent: true,
    meet: ["* A huge boxy robot with one red eye fills the tunnel.", "BOXOR: I AM THE OPENING ACT."],
    intro: ["* BOXOR's red eye lit up!", "BOXOR: NO REFUNDS."],
    attacks: [{ t: "fired an eye beam at %n!", d: [4, 7] }, { t: "stomped! The cave shook!", d: [3, 5] }, { t: "rebooted.", d: [0, 0] }],
    win: ["* BOXOR's eye flickered out.", "BOXOR: ...intermission."], small: true,
    mini: { attack: { slash: "timing", fire: "pulse", ice: "pulse", star: "sequence" }, defend: ["wait", "catch"], pick: "cycle", speed: 1.1, zone: 0.3, fakeouts: 2 },
  },
  bugon: {
    name: "BUGON", spr: "bugon", hp: 45, weak: "ice", bg: [64, 30, 50], band: [124, 50, 78], tent: true,
    meet: ["* The thing guarding the inner door has ears like two dinner plates.", "BUGON: FLAP FLAP FLAP!!", `* ${state.name} tightened the grip on the sword.`],
    intro: ["* BUGON flapped out in front of you!", "* Its ears are making a lot of wind."],
    attacks: [
      { t: "flapped its giant ears at %n!", d: [2, 5] },
      { t: "stomped its little yellow feet!", d: [3, 6] },
      { t: "tried to look scary.", d: [0, 0] },
    ],
    win: ["* BUGON flopped over and went 'flap'.", "* It scurried off, ears drooping. The inner door creaks open.", "* Something rolled out of Bugon's ear. A BOMB!"],
    next: () => { state.beatBugon = true; state.bombs += 1; fullHeal(); go("cave", { resume: true }); },
    mini: { attack: { slash: "mash-wait-mash", fire: "wait-both", ice: "wait-both", star: "sequence" }, defend: ["mashB", "block", "wait", "catch"], pick: "random", speed: 1.2, zone: 0.28, fakeouts: 1, double: 0.3 },
  },
  lygon: {
    name: "LYGON", spr: "lygon", hp: 80, weak: "fire", bg: [84, 30, 40], band: [160, 58, 56], tent: true,
    meet: ["* The chamber is lit like a circus ring. Two cages hang from the ceiling.", `${state.sis}: ${state.name}!!`, `${state.bro}: ${state.name}!!!`, "LYGON: Aaaand here's our volunteer! Hee hee hee!", `* ${state.name} did not buy a ticket.`],
    intro: ["* LYGON stepped into the spotlight!", "LYGON: Hee hee hee. Let's give them a SHOW!"],
    attacks: [
      { t: "honked a horn right in %n's face!", d: [3, 7] },
      { t: "threw a pie! SPLAT!", d: [4, 8] },
      { t: "juggled menacingly.", d: [0, 0] },
      { t: "laughed. It went on for a while.", d: [2, 4] },
    ],
    win: [
      "LYGON: ...no encore?",
      "LYGON: Hee hee... you think I came here on my OWN? I was SENT, sword boy.",
      "LYGON: She sees everything through the orb. She'll send more. Hee... hee...",
      "* LYGON folded up like a lawn chair and vanished in a puff of confetti.",
      "* Two cage doors swung open.",
    ],
    next: () => { state.beatLygon = true; state.party = ["sis", "bro"]; fullHeal(); save("cave"); go("cave", { resume: true }); },
    mini: {
      attack: { slash: "mash-wait-mash", fire: "pulse", ice: "pulse", star: "sequence" }, speed: 1.3, zone: 0.26, pick: "phase",
      phases: [{ above: 0.66, defend: "wait-line", zones: 2 }, { above: 0.33, defend: ["wait", "catch"], fakeouts: 2 }, { above: 0, defend: "mashB", flurry: true }],
    },
  },

  // -------- the Hollow. Every one of these is a person from the east town that MALAGORE turned.
  // `zone: "hollow"` routes wins and losses back to the Hollow instead of the cave.
  clonk: {
    name: "CLONK", spr: "stomper1", hp: 30, weak: "ice", bg: [26, 14, 40], band: [46, 26, 66], zone: "hollow",
    meet: ["* A big man in a torn mail carrier's uniform stomps out of the dark. His eyes glow purple.", "CLONK: MAIL. FOR. YOU.", "* He is not holding any mail."],
    intro: ["* CLONK stomped forward! The floor cracked."],
    attacks: [{ t: "stomped! The whole hall shook under %n!", d: [4, 7] }, { t: "swung a mailbag at %n!", d: [3, 6] }, { t: "checked an empty bag for mail.", d: [0, 0] }],
    win: ["* CLONK sat down hard. The purple drained out of his eyes.", "Mailman: ...Gus. My name's Gus. I deliver the... I was delivering...", "Mailman: Thank you, kid. I have to go. I have SO much mail to catch up on.", "* He ran off toward the light."], small: true,
    mini: { attack: "mash", defend: ["block"], blockZones: 2, speed: 1.2, zone: 0.28 },
  },
  skreek: {
    name: "SKREEK", spr: "swooper1", hp: 34, weak: "fire", bg: [22, 10, 38], band: [42, 22, 64], zone: "hollow",
    meet: ["* Something drops from the ceiling on ragged purple wings. It's wearing an apron.", "SKREEK: skreeeEEEEK!", "* Under the screech it almost sounds like a person."],
    intro: ["* SKREEK circled overhead, then folded its wings!"],
    attacks: [{ t: "swooped at %n from above!", d: [4, 7] }, { t: "screeched right in %n's ear!", d: [3, 5] }, { t: "hung upside down and thought about it.", d: [0, 0] }],
    win: ["* SKREEK tumbled out of the air and landed in a heap of apron.", "Baker: I... I'm Rosa. I run the bakery. Why am I on the CEILING.", "Baker: Thank you. Oh, thank you. Come by the shop. Everything's free. Forever.", "* She ran off, still a little bit flapping."], small: true,
    mini: { attack: "catch", defend: ["wait"], fakeouts: 1, speed: 1.25, zone: 0.28 },
  },
  thud: {
    name: "THUD", spr: "stomper2", hp: 38, weak: "fire", bg: [28, 12, 36], band: [50, 26, 60], zone: "hollow",
    meet: ["* A round man in a butcher's smock blocks the hall, breathing purple smoke.", "THUD: CUSTOMERS. GET. NUMBER.", "* You do not want a number."],
    intro: ["* THUD raised two fists like hams!"],
    attacks: [{ t: "brought both fists down on %n!", d: [5, 8] }, { t: "belly-bumped %n across the hall!", d: [4, 7] }, { t: "sneezed purple smoke. Everywhere.", d: [1, 2] }],
    win: ["* THUD wobbled, sat, and blinked. His eyes went back to brown.", "Butcher: Dell. I'm Dell. I've got a shop. I've got... kids. What day is it?", "Butcher: You're a good egg. Thank you. I've got to get HOME.", "* He ran off, holding his smock up like a skirt."], small: true,
    mini: { attack: { slash: "mash", fire: "timing", ice: "timing", star: "timing" }, defend: ["mashB", "hold"], pick: "cycle", blockZones: 2, speed: 1.3, zone: 0.27 },
  },
  flitz: {
    name: "FLITZ", spr: "swooper2", hp: 42, weak: "ice", bg: [20, 8, 44], band: [40, 20, 72], zone: "hollow",
    meet: ["* A skinny shape zigzags down the hall, too fast to follow. A schoolteacher's glasses glint purple.", "FLITZ: SIT. DOWN. HANDS. FOLDED.", "* You stay standing."],
    intro: ["* FLITZ is darting all over the place!"],
    attacks: [{ t: "dive-bombed %n!", d: [5, 8] }, { t: "threw a piece of chalk at %n! Hard!", d: [3, 6] }, { t: "corrected %n's posture.", d: [2, 3] }],
    win: ["* FLITZ skidded to a stop in mid-air and dropped, glasses first.", "Teacher: Ms. Abernathy. Fourth grade. I was... grading. Then the purple.", "Teacher: You've been very brave, young man. Extra credit. For life.", "* She ran off, straightening her glasses."], small: true,
    mini: { attack: "dodge", zones: 2, defend: ["wait", "dodge"], pick: "cycle", fakeouts: 2, speed: 1.4, zone: 0.26 },
  },
  grumbo: {
    name: "GRUMBO", spr: "stomper3", hp: 45, weak: "ice", bg: [30, 10, 30], band: [54, 22, 54], zone: "hollow",
    meet: ["* The biggest one yet. A farmer, by the overalls, if farmers had glowing purple fists.", "GRUMBO: GET. OFF. MY. HALL.", "* The hall is not his hall."],
    intro: ["* GRUMBO cracked his knuckles! It echoed!"],
    attacks: [{ t: "hurled a chunk of floor at %n!", d: [5, 9] }, { t: "headbutted %n!", d: [4, 8] }, { t: "shook the chains off the ceiling! CLANG!", d: [3, 6] }],
    win: ["* GRUMBO went down like a hay bale.", "Farmer: ...Walt. Walt Dobbs. My cows. Who's been milking my cows?!", "Farmer: You saved me, kid. Anything you need. Milk. Eggs. A tractor.", "* He ran off, yelling about cows."], small: true,
    mini: { attack: { slash: "mash", fire: "hold", ice: "hold", star: "sequence" }, defend: ["block", "mashB", "hold"], pick: "random", blockZones: 2, speed: 1.45, zone: 0.26, double: 0.25 },
  },
  batty: {
    name: "BATTY", spr: "swooper3", hp: 48, weak: "fire", bg: [18, 6, 40], band: [36, 16, 70], zone: "hollow",
    meet: ["* The last one hangs from the ceiling right above the sealed door. A doctor's coat. Purple eyes. Too many teeth.", "BATTY: OPEN WIDE.", "* Nope."],
    intro: ["* BATTY dropped from the ceiling! It swoops! It fakes! It swoops again!"],
    attacks: [{ t: "swooped down and raked %n!", d: [6, 9] }, { t: "bit %n! Ow!", d: [5, 8] }, { t: "said 'this won't hurt a bit'. It hurt a bit.", d: [3, 5] }],
    win: ["* BATTY flapped once, twice, and dropped into a sitting position.", "Doctor: Dr. Okafor. I'm the town doctor. I remember... a purple light in my window...", "Doctor: Thank you. Truly. Now go finish this. She's right through that door.", "* The doctor ran off. Behind you, the seal on the door went dark."], small: true,
    mini: { attack: { slash: "wait-both", fire: "pulse", ice: "pulse", star: "sequence" }, defend: ["wait", "catch"], pick: "cycle", fakeouts: 3, speed: 1.5, zone: 0.25 },
  },
  // -------- the trouble house. Two neighbours the King raised; fought together, then never again.
  fenn: {
    name: "MR. FENN", spr: "stomper1", hp: 28, weak: "ice", bg: [44, 30, 34], band: [66, 46, 50], zone: "house2", small: true,
    intro: ["* MR. FENN and OLD BEA turned on you! Their eyes are purple.", "The King: RISE."],
    attacks: [{ t: "swung a mailbag at %n!", d: [3, 6] }, { t: "stomped toward %n!", d: [3, 5] }, { t: "sorted invisible letters.", d: [0, 0] }],
    down: ["* MR. FENN sat down hard. The purple faded from his eyes."],
    win: ["* Both of them are down, blinking, rubbing their eyes.", "Mr. Fenn: ...did I deliver something? I feel like I delivered something.", "Old Bea: My BREAD. Somebody check on my BREAD."],
    next: () => go("house2", { after: true }),
    mini: { attack: "mash", defend: ["block"], speed: 1.0, zone: 0.32 },
  },
  bea: {
    name: "OLD BEA", spr: "swooper1", hp: 28, weak: "fire", bg: [44, 30, 34], band: [66, 46, 50], zone: "house2", small: true,
    attacks: [{ t: "swooped at %n with a rolling pin!", d: [3, 6] }, { t: "threw a hot bun at %n!", d: [2, 5] }, { t: "hung from the light fixture.", d: [0, 0] }],
    down: ["* OLD BEA fluttered down onto the couch and stayed there."],
    mini: { attack: "timing", defend: ["wait"], fakeouts: 0, speed: 1.0, zone: 0.32 },
  },
  // -------- strays on the road east: hers, but far from her, and weaker for it
  roadswoop: {
    name: "STRAY SWOOPER", spr: "swooper2", hp: 20, weak: "fire", bg: [30, 50, 40], band: [46, 72, 58], zone: "road", small: true,
    meet: ["* Something with ragged wings drops out of a tree.", "* It's one of hers. It saw you first."],
    intro: ["* The STRAY SWOOPER circles overhead!"],
    attacks: [{ t: "swooped at %n!", d: [3, 6] }, { t: "screeched at %n!", d: [2, 4] }, { t: "flapped in a circle.", d: [0, 0] }],
    win: ["* The STRAY SWOOPER tumbled into the grass, sat up, and blinked brown eyes.", "* It wandered off toward the east town, rubbing its head."],
    next: (o) => roamWin(o),
    mini: { attack: "timing", defend: ["wait"], fakeouts: 0, speed: 1.1, zone: 0.3 },
  },
  roadstomp: {
    name: "STRAY STOMPER", spr: "stomper2", hp: 18, weak: "ice", bg: [30, 50, 40], band: [46, 72, 58], zone: "road", small: true,
    meet: ["* Heavy footsteps behind the bushes. Purple eyes.", "* It's one of hers. It saw you first."],
    intro: ["* The STRAY STOMPER stomped out of the grass!"],
    attacks: [{ t: "stomped at %n!", d: [3, 6] }, { t: "shoved %n!", d: [2, 5] }, { t: "looked for something it dropped.", d: [0, 0] }],
    win: ["* The STRAY STOMPER sat down in the road and the purple went out of its eyes.", "* It got up and walked off toward the east town, very confused."],
    next: (o) => roamWin(o),
    mini: { attack: "mash", defend: ["block"], speed: 1.1, zone: 0.3 },
  },
  malva: {
    name: "MALAGORE", spr: "malva", hp: 220, weak: "fire", bg: [16, 4, 30], band: [40, 12, 66], zone: "hollow", scale: 1.6,
    meet: ["* A tall figure in a black cloak sits on a stone chair. Above her, an ORB hangs in the air, glowing purple.", "* Inside the orb: your house. Your street. Your MOM, looking out the window.", "MALAGORE: Finally. Come closer. I like to see faces.", "* You drew the sword."],
    intro: ["MALAGORE: I have watched you since the storm, little one. Through the orb. Every step.", "MALAGORE: The clown was a toy. The townsfolk were toys. YOU are the one I wanted.", "* MALAGORE rose from her chair! The orb burned brighter!"],
    attacks: [
      { t: "glared at %n through the orb!", d: [5, 9] },
      { t: "flicked a hand. The orb flashed! Dark bolts rained down on %n!", d: [6, 10] },
      { t: "whispered. The chains lashed at %n!", d: [5, 8] },
      { t: "laughed. The orb showed %n falling.", d: [3, 6] },
    ],
    // she is never beaten by the party: the last blow is Yugrin's (see malvaTheft in the battle scene)
    win: ["* MALAGORE is defeated."],
    next: () => { state.beatMalva = true; go("summit"); },
    mini: {
      attack: { slash: "mash-wait-mash", fire: "pulse", ice: "pulse", star: "simon" }, speed: 1.3, zone: 0.24, pick: "phase",
      // five forms; each one is a sprite, a speed, and its own defenses. The hit that crosses a line plays the swap.
      phases: [
        { above: 0.8, spr: "malva", defend: "block", zones: 2, speed: 1.3 },
        { above: 0.6, spr: "malagore2", defend: ["wait", "wait-line"], fakeouts: 2, zones: 2, speed: 1.3, enter: ["* The crown falls off! MALAGORE: You want to see me? SEE ME."],
          attacks: [{ t: "lashed %n with a nose tentacle!", d: [6, 10] }, { t: "wrapped two nose tentacles around %n and squeezed!", d: [5, 9] }, { t: "hissed through every tentacle at once!", d: [4, 7] }] },
        { above: 0.4, spr: "malagore3", defend: ["mashB", "hold"], double: 0.5, speed: 1.4, enter: ["* MALAGORE is falling apart!"] },
        { above: 0.2, spr: "malagore4", defend: ["wait", "pulse"], fakeouts: 3, zones: 2, zone: 0.15, speed: 1.4, enter: ["* MALAGORE is becoming a SPIRIT!"],
          attacks: [{ t: "swept straight through %n! The cold went right to the bones!", d: [6, 10] }, { t: "passed through %n like a draft under a door!", d: [5, 8] }, { t: "howled. The orb howled with her.", d: [4, 7] }] },
        { above: 0, spr: "malagore5", defend: ["mashB", "wait-both"], flurry: "alt", double: 0.5, zones: 2, speed: 1.5, enter: ["MALAGORE: Enough. Face me as I AM."], banner: "THE ORB FLARES!!" },
      ],
    },
  },
  // -------- the summit. Yugrin, her knight, with the stolen orb on his staff. The last fight.
  yugrin: {
    name: "YUGRIN", spr: "minion", hp: 260, weak: null, bg: [24, 10, 40], band: [60, 30, 86], zone: "summit", scale: 1.6,
    meet: ["* The horned knight turns around. The orb on his staff throws purple light over the whole summit.", "YUGRIN: She watched. I WAITED. And now the orb is mine.", `YUGRIN: Come, then, ${state.name}. Let us see what she saw in you.`],
    intro: ["* YUGRIN raised the giant sword!", "* The orb on his staff burned brighter!"],
    attacks: [
      { t: "swung the giant sword at %n!", d: [6, 10] },
      { t: "brought the sword down on %n! The mountain rang!", d: [7, 11] },
      { t: "pointed the staff. The orb spat purple fire at %n!", d: [6, 10] },
      { t: "laughed behind the helmet.", d: [0, 0] },
    ],
    win: ["* YUGRIN dropped the staff.", "YUGRIN: ...no. NO. It was MINE. It was supposed to be MINE."],
    next: () => { window.rbOrbShatter && window.rbOrbShatter(() => { state.beatYugrin = true; save("summit"); go("end"); }); },
    mini: {
      attack: { slash: "mash-wait-mash", fire: "wait-both", ice: "wait-both", star: "simon" }, speed: 1.3, zone: 0.24, pick: "phase",
      phases: [
        { above: 0.66, tier: 1, defend: ["wait", "dodge"], fakeouts: 1, speed: 1.3 },
        { above: 0.33, tier: 2, defend: ["block", "catch"], zones: 2, double: 0.34, speed: 1.4, enter: ["YUGRIN: The orb... it BURNS."], banner: "THE ORB RAKES THE SKY!",
          attacks: [{ t: "raked the summit with a beam from the orb! %n was in it!", d: [7, 11] }, { t: "swung the sword through the beam at %n!", d: [6, 10] }, { t: "made the orb scream at %n!", d: [5, 9] }] },
        { above: 0, tier: 3, defend: ["mashB", "hold"], flurry: true, speed: 1.5, enter: ["YUGRIN: I AM THE ORB NOW."],
          attacks: [{ t: "cracked the sky open over %n!", d: [8, 12] }, { t: "called lightning down on %n!", d: [7, 11] }, { t: "swung the sword and the orb together at %n!", d: [7, 11] }] },
      ],
    },
  },
};

const PSI = [
  { name: "Fire", pp: 6, dmg: [12, 16], kind: "fire", verb: "used PSI Fire! Whoosh!" },
  { name: "Ice", pp: 6, dmg: [10, 14], kind: "ice", verb: "used PSI Ice! Brrr!", freeze: true },
  { name: "Starstorm", pp: 14, dmg: [22, 30], kind: "star", verb: "used PSI STARSTORM!!" },
];

// ---------------------------------------------------------------- battle minigames
// Each one draws in the strip between the enemy's HP bar and the panels, listens for A (INTERACT)
// or B (BACK), and always ends on its own: a hard timer resolves it when nobody presses anything.
// They decide how much an action does, never whether it happens.

const TRACK = { x: 40, y: 171, w: 240, h: 11 };
const MINI = "minigame";
const C_BLUE = [96, 168, 255];
const C_INK = [232, 232, 240], C_GOLD = [242, 208, 92], C_GREEN = [79, 176, 106], C_TEAL = [51, 199, 193], C_RED = [224, 69, 63], C_GREY = [138, 138, 153];

// the press that closed the text box or the menu is still in flight when a minigame starts; it does not count
function miniKeys(keys, fn) {
  const born = time();
  const hs = keys.map((k) => onKeyPress(k, () => { if (time() - born > 0.1) fn(); }));
  return () => hs.forEach((h) => h.cancel());
}
function miniPrompt(txt, x, y, size, col) {
  return add([text(txt, { size }), pos(x, y), anchor("center"), color(...col), z(30), MINI]);
}
const C_MASH = [255, 122, 200]; // mash prompts are pink so they never read like a WAIT
// a red stop sign where the button would be: WAIT means hands off
function miniStop(x = 34, y = 163, tag = MINI) {
  const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push(vec2(Math.cos(a) * 12, Math.sin(a) * 12)); }
  const oct = add([polygon(pts), pos(x, y), color(...C_RED), outline(2, rgb(255, 255, 255)), z(30), tag]);
  const t = add([text("STOP", { size: 6 }), pos(x, y + 1), anchor("center"), color(255, 255, 255), z(31), tag]);
  return [oct, t];
}
// the strobe behind a MASH prompt: a pale bar flickering fast, so mashing never looks like waiting
function miniStrobe(tag = MINI) {
  const r = add([rect(TRACK.w + 8, TRACK.h + 30), pos(TRACK.x - 4, TRACK.y - 14), color(255, 240, 250), opacity(0.15), z(25), tag]);
  r.onUpdate(() => { r.opacity = Math.sin(time() * 40) > 0 ? 0.22 : 0.04; });
  return r;
}
// a big round button next to the prompt: gold on your turn, blue on theirs. Reads without words.
function miniButton(col, x = 34, y = 163, glyph = "A") {
  const c = add([circle(11), pos(x, y), color(...col), outline(2, rgb(20, 20, 36)), z(30), MINI, "minibtn"]);
  const a = add([text(glyph, { size: glyph.length > 1 ? 9 : 12 }), pos(x, y + 1), anchor("center"), color(20, 20, 36), z(31), MINI]);
  a.onUpdate(() => { a.scale = vec2(1 + 0.15 * Math.abs(Math.sin(time() * 8))); });
  return [c, a];
}
function miniTrack() {
  return add([rect(TRACK.w, TRACK.h), pos(TRACK.x, TRACK.y), color(20, 20, 36), outline(1, rgb(...C_INK)), z(26), MINI]);
}
// a zone on the track; from/to are fractions of its width
function miniZone(from, to, col, zz, tag) {
  const x0 = TRACK.x + Math.max(0, from) * TRACK.w, x1 = TRACK.x + Math.min(1, to) * TRACK.w;
  return add([rect(Math.max(1, x1 - x0), TRACK.h - 2), pos(x0, TRACK.y + 1), color(...col), z(zz), MINI, tag || "minigood"]);
}
function miniMarker() {
  return add([rect(3, TRACK.h + 6), pos(TRACK.x, TRACK.y - 3), color(...C_INK), outline(1, rgb(20, 20, 36)), z(29), MINI, "minimarker"]);
}
// the verdict: a big word that floats up over the enemy; a shake when it was perfect
function miniResult(label) {
  const col = label === "PERFECT!" ? C_GOLD : label === "TOO EARLY!" ? C_RED : label === "GOOD" ? C_INK : C_GREY;
  add([text(label, { size: label === "PERFECT!" ? 18 : 14 }), pos(W / 2, 128), anchor("center"), color(...col), z(46), opacity(1), lifespan(0.9, { fade: 0.4 }), move(UP, 18), "miniresult"]);
  if (label === "PERFECT!") shake(10);
}
function gradeOf(ratio) { return ratio >= 1 ? "perfect" : ratio >= 0.5 ? "good" : "miss"; }
function gradeLabel(g) { return g === "perfect" ? "PERFECT!" : g === "good" ? "GOOD" : g === "early" ? "TOO EARLY!" : "MISS"; }

// READY: announces the mechanic before it starts, so a player coming off a WAIT turn is not
// caught flat-footed by a MASH. The button acts it out: rapid pulses for mash, single crisp
// taps for timing, dimmed with dots for wait, pressed flat for hold, a cross for the arrow games.
// Each kind has a word and a thumbnail of what is about to move. 0.8 s, then the real thing.
const CUES = {
  mash: { label: "MASH!", btn: "mash" },
  sequence: { label: "TAP x3", btn: "tap", preview: "bars" },
  timing: { label: "WAIT!", btn: "tap", preview: "bars" },
  "wait-bars": { label: "WAIT!", btn: "tap", preview: "bars" },
  wait: { label: "WAIT...", btn: "wait" },
  "wait-line": { label: "LINE!", btn: "tap", preview: "line" },
  "wait-both": { label: "MEET!", btn: "tap", preview: "both" },
  "mash-wait-mash": { label: "MASH WAIT MASH", btn: "mash", preview: "mwm" },
  pulse: { label: "PULSE!", btn: "tap", preview: "pulse" },
  catch: { label: "CATCH!", btn: "tap", preview: "catch" },
  simon: { label: "COPY ME!", btn: "arrows", preview: "simon" },
  hold: { label: "HOLD!", btn: "hold", preview: "hold" },
  dodge: { label: "ARROWS!", btn: "arrows", preview: "dodge" },
};
function miniCue(kind, col, then) {
  const tag = "minicue", t0 = time(), cue = CUES[kind] || CUES.timing;
  const fresh = markMechSeen(kind === "timing" ? "wait-bars" : kind);
  if (fresh) { const nw = add([text("NEW MOVE!", { size: 10 }), pos(W / 2, 150), anchor("center"), color(...C_INK), z(33), tag]); nw.onUpdate(() => { nw.scale = vec2(1 + 0.1 * Math.abs(Math.sin(time() * 6))); }); }
  add([rect(210, 42, { radius: 4 }), pos(W / 2, 176), anchor("center"), color(20, 20, 36), outline(2, rgb(...col)), z(32), tag]);
  const mash = cue.btn === "mash", ccol = mash ? C_MASH : col;
  const txt = add([text(cue.label, { size: cue.label.length > 8 ? 12 : 18 }), pos(W / 2 + 10, cue.preview ? 169 : 172), anchor("center"), color(...ccol), opacity(1), z(33), tag]);
  const btn = add([circle(12), pos(W / 2 - 74, 176), color(...ccol), outline(2, rgb(20, 20, 36)), opacity(1), z(33), tag]);
  if (mash) miniStrobe(tag);
  if (cue.btn === "wait") miniStop(W / 2 - 74, 176, tag);
  const a = cue.btn === "arrows" ? arrowObj("right", W / 2 - 74, 176, 7, [20, 20, 36], [z(34), tag])
    : add([text("A", { size: 13 }), pos(W / 2 - 74, 177), anchor("center"), color(20, 20, 36), opacity(1), z(34), tag]);
  btn.onUpdate(() => {
    const t = time() - t0;
    if (cue.btn === "mash") { const sc = 1 + 0.35 * Math.abs(Math.sin(t * 22)); btn.scale = vec2(sc); a.scale = vec2(sc); txt.color = Math.sin(t * 30) > 0 ? rgb(...C_MASH) : rgb(255, 255, 255); }
    else if (cue.btn === "wait") { btn.hidden = true; a.hidden = true; txt.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 4)); }
    else if (cue.btn === "hold") { const sc = t % 0.8 < 0.6 ? 0.8 : 1.1; btn.scale = vec2(sc); a.scale = vec2(sc); }
    else if (cue.btn === "arrows") { a.angle = t % 0.5 < 0.25 ? 0 : 90; }
    else { const sc = t % 0.4 < 0.12 ? 1.4 : 1; btn.scale = vec2(sc); a.scale = vec2(sc); }
  });
  // the thumbnail: a 64x5 track at (W/2+32, 190) with the bits that will move
  const px = W / 2 + 32, py = 190;
  const track = () => add([rect(64, 5), pos(px, py), color(...C_GREY), z(33), tag]);
  const zone = (x, w, c) => add([rect(w, 5), pos(px + x, py), color(...(c || col)), z(34), tag]);
  const line = (x) => add([rect(2, 9), pos(px + x, py - 2), color(...C_INK), z(35), tag]);
  const glyph = (s, x, size = 8, c = col) => arrowObj({ "<": "left", ">": "right", "^": "up", "v": "down" }[s], px + x, py + 2, size * 0.5, c, [z(35), tag]);
  switch (cue.preview) {
    case "bars": track(); zone(23, 18); line(31); break;
    case "line": track(); zone(8, 14); zone(42, 14); line(48); glyph("<", 70, 7, C_INK); break;
    case "both": track(); zone(23, 18); line(31); glyph(">", -6, 7); glyph("<", 70, 7, C_INK); break;
    case "mwm": zone(0, 18, C_MASH); zone(23, 18, C_RED); zone(46, 18, C_MASH); glyph("STOP", 32, 5, [255, 255, 255]); break;
    case "pulse": add([circle(6), pos(px + 32, py + 2), color(20, 20, 36), outline(1, rgb(...C_INK)), z(34), tag]); add([circle(4), pos(px + 32, py + 2), color(...col), z(35), tag]); break;
    case "catch": track(); add([circle(3), pos(px + 32, py - 6), color(...col), z(35), tag]); break;
    case "simon": glyph("<  ^  >", 32, 9); break;
    case "hold": track(); zone(40, 15, C_GREEN); zone(0, 40); break;
    case "dodge": glyph("<", 8, 12); glyph(">", 56, 12); break;
  }
  music.sfx("move");
  wait(fresh ? 1.9 : 0.8, () => { destroyAll(tag); then(); });
}

// MASH: every press fills the bar a little; the counter bounces. Resolves with the fill ratio (0..1).
function miniMash(o, done) {
  const dur = (o.duration || 2) / (o.speed || 1), target = Math.round(6 * dur);
  miniTrack();
  const fill = add([rect(1, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...(o.hot || C_GOLD)), z(27), MINI]);
  const clock = add([rect(TRACK.w - 2, 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), z(28), MINI]);
  const mp = miniPrompt(o.prompt, W / 2 - 30, 163, 14, C_MASH); miniButton(C_MASH); miniStrobe();
  mp.onUpdate(() => { mp.color = Math.sin(time() * 30) > 0 ? rgb(...C_MASH) : rgb(255, 255, 255); });
  const counter = add([text("0", { size: 18 }), pos(W / 2 + 78, 163), anchor("center"), color(...C_INK), z(30), scale(1), MINI]);
  let n = 0, t = 0, over = false;
  const off = miniKeys(o.keys, () => {
    if (over) return;
    n += 1; music.sfx("select");
    counter.text = `${n}`; counter.scale = vec2(1.8);
    fill.width = Math.max(1, (TRACK.w - 2) * Math.min(1, n / target));
  });
  counter.onUpdate(() => {
    t += dt();
    counter.scale = vec2(Math.max(1, counter.scale.x - 5 * dt()));
    clock.width = (TRACK.w - 2) * Math.max(0, 1 - t / dur);
    // a flurry: bits of pie rain past the track while you block
    if (o.flurry && Math.random() < 0.25) add([rect(3, 3), pos(rand(TRACK.x, TRACK.x + TRACK.w), 150), color(...C_RED), z(28), opacity(1), lifespan(0.4), move(DOWN, 140), MINI]);
  });
  wait(dur, () => {
    over = true; off();
    const ratio = Math.min(1, n / target);
    destroyAll(MINI);
    miniResult(gradeLabel(gradeOf(ratio)));
    wait(0.45, () => done(ratio));
  });
}

// TIMING: a marker sweeps the track once; press inside the sweet zone. Resolves "perfect" | "good" | "miss".
function miniTiming(o, done) {
  // A bar races in from the right and crosses a fixed line in the middle of the track.
  // NOW! is when the bar is over the line. `zones` is how many passes the bar makes.
  const speed = o.speed || 1, passes = o.zones || 1, bw = o.zone || 0.3;
  const dur = 0.7 / speed;                    // one pass, edge to edge
  miniTrack();
  miniZone(0.5 - bw / 2, 0.5 + bw / 2, [44, 92, 60], 27);          // the target band
  const bar = add([rect(bw * TRACK.w, TRACK.h - 2), pos(0, TRACK.y + 1), anchor("top"), color(...(o.hot || C_GOLD)), z(28), MINI, "minizone"]);
  add([rect(2, TRACK.h + 8), pos(TRACK.x + TRACK.w / 2, TRACK.y - 4), anchor("top"), color(...C_INK), outline(1, rgb(20, 20, 36)), z(29), MINI, "minimarker"]);
  const pre = o.prefix ? o.prefix + " " : "";
  const prompt = miniPrompt(pre + "WAIT...", W / 2, 163, 14, o.hot || C_GOLD); const btn = miniButton(o.hot || C_GOLD); const stop = miniStop();
  // the bar waits off-screen for a beat first, so a press carried over from the menu is not the tap
  const ARM = 0.3;
  let t = -ARM, over = false;
  const span = 1 + bw;
  // bar centre as a fraction of the track: starts just past the right edge, leaves past the left
  const centre = () => { const k = Math.max(0, t) / dur; return 1 + bw / 2 - (k - Math.floor(k)) * span; };
  const dist = () => Math.abs(centre() - 0.5);
  bar.onUpdate(() => {
    t += dt();
    bar.pos.x = TRACK.x + centre() * TRACK.w;
    const inZone = t >= 0 && dist() <= bw / 2;
    prompt.text = pre + (inZone ? "NOW!" : "WAIT..."); prompt.textSize = inZone ? 18 : 14;
    btn.forEach((b) => b.hidden = !inZone); stop.forEach((b) => b.hidden = inZone); // stop sign on WAIT, button on NOW!
  });
  function finish(res) {
    if (over) return; over = true; off(); timer.cancel();
    destroyAll(MINI);
    miniResult(gradeLabel(res));
    wait(0.45, () => done(res));
  }
  // Forgiving: a press with the bar off the line shows an X and the bar keeps going; two are
  // tolerated (a kid mashing A gets two chances to land it), the third ends it as a miss.
  let misses = 0;
  const off = miniKeys(o.keys || INTERACT, () => {
    if (t < 0 || over) return;
    const d = dist();
    if (d <= bw / 4) { music.sfx("select"); finish("perfect"); return; }
    if (d <= bw / 2) { music.sfx("select"); finish("good"); return; }
    misses += 1; music.sfx("back");
    add([text("X", { size: 14 }), pos(bar.pos.x, TRACK.y - 12), anchor("center"), color(...C_RED), z(31), opacity(1), lifespan(0.6, { fade: 0.3 }), move(UP, 20), MINI]);
    if (misses >= 3) finish("miss");
  });
  const timer = wait(ARM + dur * passes + 0.12, () => finish("miss"));
}

// SEQUENCE: three sweeps one after another, alternating direction; a press inside the zone adds a star.
// Resolves with the number of hits (0..3).
function miniSequence(o, done) {
  const speed = o.speed || 1, pw = o.zone || 0.3, gw = pw + 0.14, dur = 0.85 / speed, N = 3;
  miniTrack();
  miniPrompt("TAP A! x3", W / 2 - 40, 163, 14, C_GOLD); miniButton(C_GOLD);
  const stars = [0, 1, 2].map((i) => add([text("*", { size: 20 }), pos(W / 2 + 52 + i * 18, 167), anchor("center"), color(...C_GREY), z(30), scale(1), MINI]));
  stars[0].onUpdate(() => stars.forEach((s) => s.scale = vec2(Math.max(1, s.scale.x - 4 * dt()))));
  let hits = 0, i = 0, over = false, off = null;
  function finish() {
    if (over) return; over = true; if (off) off(); guard.cancel();
    destroyAll(MINI);
    miniResult(hits >= N ? "PERFECT!" : hits > 0 ? "GOOD" : "MISS");
    wait(0.45, () => done(hits));
  }
  function sweep() {
    if (over) return;
    if (i >= N) return finish();
    const dir = i % 2 === 0 ? 1 : -1, c = rand(0.35, 0.65);
    const zg = miniZone(c - gw / 2, c + gw / 2, C_GREEN, 27), zp = miniZone(c - pw / 2, c + pw / 2, C_GOLD, 28, "minizone");
    const marker = miniMarker();
    const arm = i === 0 ? 0.3 : 0; // the first sweep parks for a beat, like a timing sweep
    let t = -arm, pressed = false;
    marker.onUpdate(() => { t += dt(); const f = Math.min(1, Math.max(0, t / dur)); marker.pos.x = TRACK.x + (dir > 0 ? f : 1 - f) * TRACK.w - 1; });
    off = miniKeys(INTERACT, () => {
      if (pressed || t < 0) return; pressed = true;
      const f = dir > 0 ? t / dur : 1 - t / dur, ok = Math.abs(f - c) <= gw / 2;
      music.sfx(ok ? "select" : "back");
      if (ok) { hits += 1; stars[i].color = rgb(...C_GOLD); stars[i].scale = vec2(1.6); }
      marker.color = rgb(...(ok ? C_GOLD : C_RED));
    });
    wait(arm + dur + 0.1, () => { if (over) return; off(); off = null; destroy(zg); destroy(zp); destroy(marker); i += 1; wait(0.12, sweep); });
  }
  const guard = wait(N * (dur + 0.3) + 1.5, finish);
  sweep();
}

// WAIT: the enemy winds up ("WAIT...") then strikes ("NOW!"). A press during the wind-up is punished; a
// press right after NOW! blocks most of the hit. Fake-outs twitch the sprite without a NOW!.
// Resolves "perfect" | "miss" | "early".
function miniWait(o, done) {
  const speed = o.speed || 1, fakes = o.fakeouts || 0, spr = o.spr;
  const windup = rand(0.8, 1.6) / speed + fakes * 0.35;
  const home = spr ? spr.pos.clone() : null;
  const prompt = miniPrompt("WAIT...", W / 2, 163, 18, C_BLUE); const wbtn = miniButton(C_BLUE); wbtn.forEach((b) => b.hidden = true); const wstop = miniStop();
  miniTrack();
  const pulse = add([rect(TRACK.w - 2, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), opacity(0.3), z(27), MINI]);
  let t = 0, phase = "wait", early = false, over = false;
  pulse.onUpdate(() => {
    t += dt();
    pulse.opacity = phase === "wait" ? 0.15 + 0.2 * Math.abs(Math.sin(t * 6)) : 0.95;
    if (phase === "now") prompt.pos.x = W / 2 + rand(-2, 2);
  });
  function lunge(dy, dur) { if (!spr) return; spr.pos.y = home.y + dy; wait(dur, () => { if (spr.exists()) spr.pos.y = home.y; }); }
  // fake-outs: a twitch and a "?!" that never turns into a NOW!
  for (let i = 0; i < fakes; i++) wait((windup - 0.3) * (0.3 + 0.7 * (i + rand(0.2, 0.8)) / fakes), () => {
    if (over || phase !== "wait") return;
    lunge(-6, 0.14); music.sfx("move");
    add([text("?!", { size: 10 }), pos(W / 2 + 34, 50), anchor("center"), color(...C_GREY), z(30), opacity(1), lifespan(0.35, { fade: 0.2 }), MINI]);
  });
  function finish(res) {
    if (over) return; over = true; off(); destroyAll(MINI);
    if (spr && spr.exists()) spr.pos.y = home.y;
    miniResult(gradeLabel(res));
    wait(0.45, () => done(res));
  }
  const off = miniKeys(INTERACT.concat(BACK), () => {
    if (phase === "wait") {
      if (early || t < 0.35) return;
      early = true; music.sfx("back");
      add([text("TOO EARLY!", { size: 10 }), pos(W / 2, TRACK.y + TRACK.h / 2), anchor("center"), color(...C_RED), z(30), opacity(1), lifespan(0.6, { fade: 0.3 }), MINI]);
      return;
    }
    music.sfx("select"); finish(early ? "early" : "perfect");
  });
  wait(windup, () => {
    if (over) return;
    phase = "now"; prompt.text = "NOW!"; prompt.textSize = 20; prompt.color = rgb(...C_BLUE); wbtn.forEach((b) => b.hidden = false); wstop.forEach((b) => b.hidden = true);
    lunge(10, 0.25); shake(6); music.sfx("slash");
    wait(0.4, () => finish(early ? "early" : "miss"));
  });
}

// ---------------------------------------------------------------- more minigames
// Shared bits. Direction keys mirror the overworld: arrows, WASD, numpad.
const DIR_KEYS = { left: ["left", "a", "4"], right: ["right", "d", "6"], up: ["up", "w", "8"], down: ["down", "s", "2"] };
const DIR_GLYPH = { left: "<", right: ">", up: "^", down: "v" };
const DIRS4 = ["left", "right", "up", "down"];
const grade3 = (d, bw) => (d <= bw / 4 ? "perfect" : d <= bw / 2 ? "good" : null);
// a red X where the wrong press happened
function miniX(x, y) {
  music.sfx("back");
  add([text("X", { size: 14 }), pos(x, y), anchor("center"), color(...C_RED), z(31), opacity(1), lifespan(0.6, { fade: 0.3 }), move(UP, 20), MINI]);
}
// the WAIT... / NOW! prompt with its stop sign and button; set(true) flips to NOW!
function miniWaitPrompt(col, pre, x = W / 2) {
  const prompt = miniPrompt(pre + "WAIT...", x, 163, 14, col); const btn = miniButton(col); const stop = miniStop();
  btn.forEach((b) => b.hidden = true);
  let now = false;
  return { prompt, set(v) { if (v === now) return; now = v; prompt.text = pre + (v ? "NOW!" : "WAIT..."); prompt.textSize = v ? 18 : 14; btn.forEach((b) => b.hidden = !v); stop.forEach((b) => b.hidden = v); } };
}
function miniEnd(res, done) { destroyAll(MINI); miniResult(gradeLabel(res)); wait(0.45, () => done(res)); }
// a forgiving press counter: X twice, the third wrong press is the miss
function miniMisses(onThird) { let n = 0; return (x, y) => { n += 1; miniX(x, y); if (n >= 3) onThird(); }; }

// WAIT-LINE: the target bars stand still; a line races right→left over them. Press while the line is inside a bar.
function miniWaitLine(o, done) {
  const speed = o.speed || 1, bw = o.zone || 0.3, n = Math.max(1, o.zones || 1), col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const dur = 0.75 / speed, passes = 2, ARM = 0.3;
  const centres = n === 1 ? [0.5] : n === 2 ? [0.3, 0.7] : [0.2, 0.5, 0.8];
  miniTrack();
  centres.forEach((c) => { miniZone(c - bw / 2, c + bw / 2, [44, 92, 60], 27); miniZone(c - bw / 4, c + bw / 4, col, 28, "minizone"); });
  const line = miniMarker();
  const wp = miniWaitPrompt(col, pre);
  let t = -ARM, over = false;
  const frac = () => { const k = Math.max(0, t) / dur; return 1 - (k - Math.floor(k)); };
  const nearest = () => Math.min(...centres.map((c) => Math.abs(frac() - c)));
  line.onUpdate(() => { t += dt(); line.pos.x = TRACK.x + frac() * TRACK.w - 1; wp.set(t >= 0 && nearest() <= bw / 2); });
  function finish(res) { if (over) return; over = true; off(); timer.cancel(); miniEnd(res, done); }
  const wrong = miniMisses(() => finish("miss"));
  const off = miniKeys(o.keys || INTERACT, () => {
    if (t < 0 || over) return;
    const g = grade3(nearest(), bw);
    if (g) { music.sfx("select"); finish(g); } else wrong(line.pos.x, TRACK.y - 12);
  });
  const timer = wait(ARM + dur * passes + 0.1, () => finish("miss"));
}

// WAIT-BOTH: the line runs right→left, the bar runs left→right; press when they cross.
function miniWaitBoth(o, done) {
  const speed = o.speed || 1, bw = o.zone || 0.3, col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const dur = 0.9 / speed, bdur = dur * 1.35, passes = 3, ARM = 0.3;
  miniTrack();
  const bar = add([rect(bw * TRACK.w, TRACK.h - 2), pos(0, TRACK.y + 1), anchor("top"), color(...col), z(28), MINI, "minizone"]);
  const line = miniMarker();
  arrowObj("left", TRACK.x + TRACK.w + 6, TRACK.y - 8, 4, C_INK, [z(29), MINI]);
  arrowObj("right", TRACK.x - 6, TRACK.y - 8, 4, col, [z(29), MINI]);
  const wp = miniWaitPrompt(col, pre);
  let t = -ARM, over = false;
  const lf = () => { const k = Math.max(0, t) / dur; return 1 - (k - Math.floor(k)); };
  const bc = () => { const k = Math.max(0, t) / bdur, f = k - Math.floor(k); return -bw / 2 + f * (1 + bw); };
  const dist = () => Math.abs(lf() - bc());
  line.onUpdate(() => {
    t += dt();
    line.pos.x = TRACK.x + lf() * TRACK.w - 1;
    // the bar is clipped to the track as it slides in and out
    const l = Math.max(0, bc() - bw / 2), r = Math.min(1, bc() + bw / 2);
    bar.width = Math.max(1, (r - l) * TRACK.w); bar.pos.x = TRACK.x + (l + r) / 2 * TRACK.w;
    wp.set(t >= 0 && r > l && dist() <= bw / 2);
  });
  function finish(res) { if (over) return; over = true; off(); timer.cancel(); miniEnd(res, done); }
  const wrong = miniMisses(() => finish("miss"));
  const off = miniKeys(o.keys || INTERACT, () => {
    if (t < 0 || over) return;
    const g = grade3(dist(), bw);
    if (g) { music.sfx("select"); finish(g); } else wrong(line.pos.x, TRACK.y - 12);
  });
  const timer = wait(ARM + dur * passes + 0.1, () => finish("miss"));
}

// MASH-WAIT-MASH: three beats. Mash for 0.9 s, then hands off until NOW!, then mash again.
// Resolves with the mean of the three (0..1) so it slots in where a mash ratio goes.
function miniMashWaitMash(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, keys = o.keys || INTERACT, pre = o.prefix ? o.prefix + " " : "";
  const scores = [];
  const beatDots = () => [0, 1, 2].map((i) => add([circle(3), pos(TRACK.x + TRACK.w - 20 + i * 9, 154), color(...(i < scores.length ? col : C_GREY)), z(30), MINI]));
  function mashBeat(next) {
    const dur = 0.9 / speed, target = Math.round(6 * dur);
    miniTrack(); beatDots();
    const fill = add([rect(1, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...col), z(27), MINI]);
    const clock = add([rect(TRACK.w - 2, 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), z(28), MINI]);
    const mp = miniPrompt(pre + "MASH A!", W / 2 - 20, 163, 14, C_MASH); miniButton(C_MASH); miniStrobe();
    mp.onUpdate(() => { mp.color = Math.sin(time() * 30) > 0 ? rgb(...C_MASH) : rgb(255, 255, 255); });
    const counter = add([text("0", { size: 18 }), pos(W / 2 + 78, 163), anchor("center"), color(...C_INK), z(30), scale(1), MINI]);
    let n = 0, t = 0, over = false;
    const off = miniKeys(keys, () => { if (over) return; n += 1; music.sfx("select"); counter.text = `${n}`; counter.scale = vec2(1.8); fill.width = Math.max(1, (TRACK.w - 2) * Math.min(1, n / target)); });
    counter.onUpdate(() => { t += dt(); counter.scale = vec2(Math.max(1, counter.scale.x - 5 * dt())); clock.width = (TRACK.w - 2) * Math.max(0, 1 - t / dur); });
    wait(dur, () => { over = true; off(); scores.push(Math.min(1, n / target)); destroyAll(MINI); wait(0.15, next); });
  }
  function waitBeat(next) {
    const windup = rand(0.6, 1.3) / speed;
    miniTrack(); beatDots();
    const pulse = add([rect(TRACK.w - 2, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), opacity(0.3), z(27), MINI]);
    const wp = miniWaitPrompt(col, pre);
    let t = 0, phase = "wait", over = false, early = 0;
    pulse.onUpdate(() => { t += dt(); pulse.opacity = phase === "wait" ? 0.15 + 0.2 * Math.abs(Math.sin(t * 6)) : 0.95; });
    function end(score) { if (over) return; over = true; off(); scores.push(score); destroyAll(MINI); wait(0.15, next); }
    const off = miniKeys(keys, () => {
      if (over) return;
      if (phase === "wait") { early += 1; miniX(W / 2, TRACK.y - 12); if (early >= 3) end(0); return; }
      music.sfx("select"); end(t - tNow <= 0.25 ? 1 : 0.5);
    });
    let tNow = 0;
    wait(windup, () => { if (over) return; phase = "now"; tNow = t; wp.set(true); pulse.color = rgb(...col); music.sfx("slash"); wait(0.5, () => end(0)); });
  }
  mashBeat(() => waitBeat(() => mashBeat(() => {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    miniResult(gradeLabel(gradeOf(mean)));
    wait(0.45, () => done(mean));
  })));
}

// PULSE: a circle breathes in and out beside the prompt; press when it fills the ring.
function miniPulse(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const period = 1.1 / speed, ARM = 0.3, cycles = 3, R = 11, tol = 3.5;
  const cx = W / 2 + 92, cy = 170;
  add([circle(R), pos(cx, cy), color(20, 20, 36), outline(2, rgb(...C_INK)), z(27), MINI, "minizone"]);
  const dot = add([circle(2), pos(cx, cy), color(...col), opacity(0.85), z(28), MINI, "minimarker"]);
  const wp = miniWaitPrompt(col, pre, W / 2 - 20);
  let t = -ARM, over = false;
  const radius = () => 2 + 15 * (0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, t) / period));
  const dist = () => Math.abs(radius() - R);
  dot.onUpdate(() => { t += dt(); dot.radius = radius(); wp.set(t >= 0 && dist() <= tol); });
  function finish(res) { if (over) return; over = true; off(); timer.cancel(); miniEnd(res, done); }
  const wrong = miniMisses(() => finish("miss"));
  const off = miniKeys(o.keys || INTERACT, () => {
    if (t < 0 || over) return;
    const d = dist();
    if (d <= 1.5) { music.sfx("select"); finish("perfect"); } else if (d <= tol) { music.sfx("select"); finish("good"); } else wrong(cx, cy - 18);
  });
  const timer = wait(ARM + period * cycles + 0.1, () => finish("miss"));
}

// CATCH: a dot drops out of the sky; press the moment it lands on the track. Three drops, one catch.
function miniCatch(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const fall = 0.75 / speed, drops = 3, y0 = 128, yT = TRACK.y + TRACK.h / 2, tol = 7;
  miniTrack();
  miniZone(0, 1, [44, 92, 60], 27);
  const wp = miniWaitPrompt(col, pre);
  let i = 0, over = false, dot = null, t = 0;
  function finish(res) { if (over) return; over = true; off(); guard.cancel(); miniEnd(res, done); }
  const wrong = miniMisses(() => finish("miss"));
  const dist = () => (dot ? Math.abs(dot.pos.y - yT) : 99);
  function drop() {
    if (over) return;
    if (i >= drops) return finish("miss");
    const x = TRACK.x + rand(0.15, 0.85) * TRACK.w;
    t = i === 0 ? -0.3 : -0.1;
    dot = add([circle(4), pos(x, y0), color(...col), outline(1, rgb(20, 20, 36)), z(30), MINI, "minimarker"]);
    dot.onUpdate(() => {
      t += dt();
      const f = Math.max(0, t) / fall;
      dot.pos.y = y0 + (yT + 14 - y0) * f * f;
      wp.set(dist() <= tol);
      if (dot.pos.y > yT + 12) { destroy(dot); dot = null; wp.set(false); i += 1; wait(0.1, drop); }
    });
  }
  const off = miniKeys(o.keys || INTERACT, () => {
    if (over || !dot || t < 0) return;
    const d = dist();
    if (d <= 3) { music.sfx("select"); finish("perfect"); } else if (d <= tol) { music.sfx("select"); finish("good"); } else wrong(dot.pos.x, dot.pos.y - 12);
  });
  const guard = wait(drops * (fall + 0.45) + 1, () => finish("miss"));
  drop();
}

// SIMON: arrows show for a moment, then vanish; press them back in order. All right = perfect, some = good.
function miniSimon(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const n = o.count || 3, seq = []; for (let i = 0; i < n; i++) seq.push(choose(DIRS4));
  const show = 1.1, limit = show + (1.0 + 0.6 * n) / speed;
  miniTrack();
  const prompt = miniPrompt(pre + "WATCH...", W / 2 - 40, 163, 14, col); const stop = miniStop(); const btn = miniButton(col, 34, 163, "+"); btn.forEach((b) => b.hidden = true);
  const x0 = TRACK.x + TRACK.w / 2 - (n - 1) * 20;
  const glyphs = seq.map((d, i) => arrowObj(d, x0 + i * 40, TRACK.y + TRACK.h / 2, 8, col, [z(30), MINI]));
  const clock = add([rect(TRACK.w - 2, 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), z(28), MINI]);
  let phase = "show", k = 0, right = 0, over = false, t = 0;
  clock.onUpdate(() => { t += dt(); if (phase === "repeat") clock.width = (TRACK.w - 2) * Math.max(0, 1 - (t - show) / (limit - show)); });
  function finish() { if (over) return; over = true; offs.forEach((f) => f()); timer.cancel(); miniEnd(right >= n ? "perfect" : right > 0 ? "good" : "miss", done); }
  const wrong = miniMisses(finish);
  const offs = DIRS4.map((d) => miniKeys(DIR_KEYS[d], () => {
    if (over || phase !== "repeat") return;
    const g = glyphs[k];
    if (d === seq[k]) { right += 1; music.sfx("select"); g.color = rgb(...C_GREEN); g.scale = vec2(1.5); k += 1; if (k >= n) finish(); }
    else wrong(g.pos.x, g.pos.y - 14);
  }));
  wait(show, () => {
    if (over) return;
    phase = "repeat"; glyphs.forEach((g) => { g.text = "?"; g.color = rgb(...C_GREY); });
    prompt.text = pre + "COPY!"; prompt.textSize = 18; stop.forEach((b) => b.hidden = true); btn.forEach((b) => b.hidden = false); music.sfx("move");
  });
  const timer = wait(limit + 0.1, finish);
}

// HOLD: hold A and the bar fills; let go inside the green band. Past the end is too much.
function miniHold(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, keys = o.keys || INTERACT, pre = o.prefix ? o.prefix + " " : "";
  const full = 2.0 / speed, b0 = 0.62, b1 = 0.86, limit = 5 / speed;
  miniTrack();
  miniZone(b0, b1, [44, 92, 60], 27); miniZone(b0 + (b1 - b0) / 3, b1 - (b1 - b0) / 3, C_GREEN, 28, "minizone");
  const fill = add([rect(1, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...col), z(29), MINI]);
  const prompt = miniPrompt(pre + "HOLD A!", W / 2, 163, 14, col); const btn = miniButton(col);
  let f = 0, holding = false, over = false, t = 0;
  const down = () => keys.some((k) => isKeyDown(k));
  function finish(res) { if (over) return; over = true; timer.cancel(); miniEnd(res, done); }
  const wrong = miniMisses(() => finish("miss"));
  fill.onUpdate(() => {
    t += dt();
    if (t < 0.1 || over) return;   // the first frames belong to the press that closed the menu
    const d = down();
    if (d) { holding = true; f = Math.min(1, f + dt() / full); fill.width = Math.max(1, (TRACK.w - 2) * f); btn.forEach((b) => b.scale = vec2(0.8)); }
    const inBand = f >= b0 && f <= b1;
    prompt.text = pre + (d ? (inBand ? "LET GO!" : "HOLD...") : "HOLD A!"); prompt.textSize = inBand && d ? 18 : 14;
    if (d && f >= 1) { fill.color = rgb(...C_RED); add([text("TOO MUCH!", { size: 10 }), pos(W / 2, TRACK.y - 10), anchor("center"), color(...C_RED), z(31), MINI]); finish("miss"); return; }
    if (!d && holding) {
      holding = false; btn.forEach((b) => b.scale = vec2(1));
      const mid = (b0 + b1) / 2, third = (b1 - b0) / 6;
      if (Math.abs(f - mid) <= third) { music.sfx("select"); finish("perfect"); }
      else if (inBand) { music.sfx("select"); finish("good"); }
      else { wrong(TRACK.x + f * TRACK.w, TRACK.y - 12); f = 0; fill.width = 1; }
    }
  });
  const timer = wait(limit, () => finish("miss"));
}

// DODGE: an arrow points left or right; press that way before the clock runs out. Two arrows.
function miniDodge(o, done) {
  const speed = o.speed || 1, col = o.hot || C_GOLD, pre = o.prefix ? o.prefix + " " : "";
  const rounds = o.count || 2, limit = 1.3 / speed;
  miniTrack();
  const prompt = miniPrompt(pre + (o.hot ? "DODGE!" : "STRIKE!"), W / 2 - 30, 163, 14, col); miniButton(col, 34, 163, "<>");
  const clock = add([rect(TRACK.w - 2, TRACK.h - 2), pos(TRACK.x + 1, TRACK.y + 1), color(...C_GREY), opacity(0.4), z(27), MINI]);
  let i = 0, pts = 0, over = false, dir = null, t = 0, arrow = null, off = null;
  function finish() { if (over) return; over = true; if (off) off(); guard.cancel(); miniEnd(pts >= rounds * 2 - 1 ? "perfect" : pts > 0 ? "good" : "miss", done); }
  const wrong = miniMisses(finish);
  function round() {
    if (over) return;
    if (i >= rounds) return finish();
    dir = choose(["left", "right"]); t = i === 0 ? -0.3 : -0.1;
    const a = arrowObj(dir, dir === "left" ? TRACK.x + 30 : TRACK.x + TRACK.w - 30, TRACK.y + TRACK.h / 2, 13, col, [z(30), scale(1), MINI, "minimarker"]);
    arrow = a;
    a.onUpdate(() => {
      if (arrow !== a) return; // this arrow has been answered; it only lingers to show its colour
      t += dt(); a.scale = vec2(1 + 0.15 * Math.abs(Math.sin(time() * 10)));
      clock.width = Math.max(1, (TRACK.w - 2) * Math.max(0, 1 - Math.max(0, t) / limit));
      if (t >= limit) next(false);
    });
    const hs = ["left", "right"].map((d) => miniKeys(DIR_KEYS[d], () => {
      if (over || t < 0) return;
      if (d === dir) { music.sfx("select"); pts += t <= limit * 0.55 ? 2 : 1; arrow.color = rgb(...C_GREEN); next(true); }
      else wrong(arrow.pos.x, arrow.pos.y - 16);
    }));
    off = () => hs.forEach((h) => h());
  }
  function next(hit) {
    if (over) return;
    off(); off = null;
    const a = arrow; arrow = null;
    if (!hit) a.color = rgb(...C_RED);
    wait(0.15, () => { if (a.exists()) destroy(a); i += 1; round(); });
  }
  const guard = wait(rounds * (limit + 0.5) + 1, finish);
  round();
}

// every minigame by name. run(o, done): o carries speed, zone, zones, keys, hot, prefix, fakeouts, spr;
// done gets "perfect" | "good" | "miss", or 0..1 when `ratio` is set. mash / sequence / wait / block keep
// their own branches in the battle scene (their damage maths predates this table).
// Mechanics arrive one at a time as the game goes on. MASH is the first and stays the most common;
// 1-4 are the easy ones; the rest only turn up in boss fights, and never two hard ones in a row.
const MECH_ORDER = ["mash", "wait-bars", "wait-line", "wait-both", "mash-wait-mash", "pulse", "catch", "hold", "dodge", "simon"];
const MECH_EASY = new Set(["mash", "wait-bars", "wait-line", "wait-both"]);
const BOSSES = new Set(["bugon", "lygon", "king", "malva", "yugrin"]);
function unlockedMechs(boss) {
  let k = 1;                        // mash from the very first battle
  if (state.cave >= 2) k = 2;       // the timed bar, a few critters in
  if (state.cave >= 4) k = 3;       // the racing line
  if (state.beatBugon) k = 4;       // both moving
  if (state.beatLygon) k = 5;       // mash-wait-mash
  if (state.kingFled) k = 6;        // pulse
  if (state.hollow >= 2) k = 7;     // catch
  if (state.hollow >= 4) k = 8;     // hold
  if (state.beatMalva) k = 9;       // dodge
  if (state.beatYugrin) k = 10;     // simon (new game plus)
  if (boss) k = Math.min(MECH_ORDER.length, k + 1); // a boss brings the next one with it
  return MECH_ORDER.slice(0, k);
}
let lastMech = "mash";
function pickMech(boss) {
  const pool = unlockedMechs(boss);
  const easy = pool.filter((m) => m !== "mash" && MECH_EASY.has(m)), hard = pool.filter((m) => !MECH_EASY.has(m));
  // the next mechanic this fight may introduce: hard ones only arrive in a boss fight
  const intro = pool.filter((m) => boss || MECH_EASY.has(m)).find((m) => !state.seenMechs.includes(m));
  let name;
  if (!MECH_EASY.has(lastMech)) name = "mash";                       // after a hard one, back to mash
  else if (intro) name = intro;                                        // introduce the new one
  else if (Math.random() < 0.55 || !easy.length) name = "mash";
  else if (boss && hard.length && Math.random() < 0.5) name = choose(hard);
  else name = choose(easy);
  if (!boss && !MECH_EASY.has(name)) name = "mash";
  lastMech = name;
  return name;
}
function markMechSeen(name) { if (MECH_ORDER.includes(name) && !state.seenMechs.includes(name)) { state.seenMechs.push(name); return true; } return false; }

const MINIS = {
  timing: { run: miniTiming },
  "wait-bars": { run: miniTiming },
  "wait-line": { run: miniWaitLine },
  "wait-both": { run: miniWaitBoth },
  "mash-wait-mash": { run: miniMashWaitMash, ratio: true },
  pulse: { run: miniPulse },
  catch: { run: miniCatch },
  simon: { run: miniSimon },
  hold: { run: miniHold },
  dodge: { run: miniDodge },
};

// The battle is fought by a party: the hero first, then every friend who has joined. Each living
// member acts in turn (its own little menu), then every living enemy acts, each picking a random
// living member to hit; that member's defense minigame decides what lands. A member at 0 HP is
// down until a Potion or the end of the fight; the party loses only when everyone is down.
// `which` names the enemy (or "house2" for the pair, "ambush" for the side room); `bopts` carries
// where a roaming fight came from so a win can put you back there.
scene("battle", (which, bopts = {}) => {
  resetCam();
  window.__frozen = false;
  bopts = bopts || {};
  let defs;
  if (which === "ambush") {
    const base = ENEMIES[state.branchEnemy];
    defs = [{ ...base, name: "WILD " + base.name, hp: base.hp + 8, small: true,
      intro: [`* A WILD ${base.name} got the jump on you!`],
      win: [`* The WILD ${base.name} ran off into the dark.`, "* The side room is quiet now."],
      // a wild one plays the base enemy's minigames, a fifth faster
      mini: { ...(base.mini || {}), speed: ((base.mini && base.mini.speed) || 1) * 1.2 },
      next: () => { state.branchDone = true; healAll(10); state.pp = Math.min(state.maxPp, state.pp + 6); go("cave", { resume: true, at: "branch" }); } }];
  } else if (which === "house2") defs = [ENEMIES.fenn, ENEMIES.bea];
  else defs = [ENEMIES[which]];
  const lead = defs[0], zone = lead.zone || "cave", inHollow = zone === "hollow";
  if (lead.tent) tentBackdrop(); // the big top's canvas and ring floor under everything else
  music.sfx("battle_start");
  music.play(lead.small ? "battle" : "boss");

  // ---- the party
  const members = [];
  const mhp = (m) => m.name === "hero" ? state.hp : (state.partyHp[m.name] ?? PARTY_MAX[m.name]);
  const mmax = (m) => m.name === "hero" ? state.maxHp : PARTY_MAX[m.name];
  const setHp = (m, v) => { v = Math.max(0, Math.min(mmax(m), Math.round(v))); if (m.name === "hero") state.hp = v; else state.partyHp[m.name] = v; };
  const alive = (m) => mhp(m) > 0;
  function buildMembers() {
    partyHpInit(); members.length = 0;
    members.push({ name: "hero", label: state.name, focus: false });
    fighters().forEach((n) => members.push({ name: n, label: PARTY_LABEL[n], focus: false }));
  }
  buildMembers();
  // three or more fighters make her people, the house pair and the road's strays tougher. The cave stays as it was.
  // five fighters (the hero, Pip, Zed, Bruno and Bloop) make them tougher still
  const hpScale = zone === "cave" ? 1 : members.length >= 5 ? 1.6 : (members.length >= 3 || which === "house2") ? 1.35 : 1;
  const dmgScale = () => (zone === "cave" ? 1 : members.length >= 5 ? 1.3 : members.length >= 3 ? 1.2 : 1);

  // ---- the enemies
  const BY = 80; // they stand a little high so the minigame strip fits under their HP bars
  const foes = defs.map((d, i) => ({ def: d, key: Object.keys(ENEMIES).find((k) => ENEMIES[k] === d) || which, name: d.name, hp: Math.round(d.hp * hpScale), maxHp: Math.round(d.hp * hpScale), frozen: 0, alive: true, defTurn: 0,
    mini: d.mini || { attack: "timing", defend: ["block"] }, x: defs.length === 1 ? W / 2 : W / 2 - 64 + i * 128, phaseIdx: 0 }));
  let busy = true, cur = null, actor = 0, targeting = null, defending = null, pending = null;
  let menu = 0, sub = null, subIdx = 0, targetIdx = 0, allyIdx = 0;
  // read-only view of the fight for tests and tinkering
  window.rbBattle = { which, foes, members, hpScale, get dmgScale() { return dmgScale(); }, lastRoll: null, lastTarget: null, fxSeen: {}, events: [], get cur() { return cur && cur.name; }, get busy() { return busy; }, get sub() { return sub; }, get targeting() { return targeting && targeting.name; } };
  let barged = state.friends || which !== "house2";

  add([rect(W, H), pos(0, 0), color(...lead.bg)]);
  const bands = [];
  for (let i = 0; i < 12; i++) bands.push(add([rect(W, 10), pos(0, i * 20), color(...lead.band), opacity(0.5), z(1)]));
  onUpdate(() => bands.forEach((b, i) => { b.pos.y = ((i * 20 + time() * 25) % (H + 20)) - 10; }));

  foes.forEach((f) => {
    f.spr = add([sprite(f.def.spr), pos(f.x, BY), anchor("center"), scale(f.def.scale || 2), z(5), opacity(1)]);
    f.spr.onUpdate(() => {
      if (!f.alive) return;
      if (defending === f) { f.spr.pos.y = BY + 10 + Math.abs(Math.sin(time() * 10)) * 8; f.spr.pos.x = f.x + rand(-2, 2); return; }
      if (!busy && !f.frozen) f.spr.pos.y = BY + Math.sin(time() * 3 + f.x) * 2;
    });
    const frost = add([rect(defs.length === 1 ? 90 : 70, 84), pos(f.x, BY), anchor("center"), color(51, 199, 193), opacity(0), z(6)]);
    frost.onUpdate(() => { frost.opacity = f.frozen > 0 && f.alive ? 0.35 : 0; });
    const bw = defs.length === 1 ? 100 : 90;
    add([rect(bw, 6), pos(f.x - bw / 2, 146), color(20, 20, 36), outline(1, rgb(232, 232, 240)), z(20)]);
    const bar = add([rect(bw, 6), pos(f.x - bw / 2, 146), color(224, 69, 63), z(21), "foebar"]);
    bar.onUpdate(() => { bar.width = bw * Math.max(0, f.hp) / f.maxHp; bar.pos.x = f.x - bw / 2 + (f.barShake ? rand(-2, 2) : 0); });
    add([text(f.name, { size: 8 }), pos(f.x, 136), anchor("center"), color(232, 232, 240), z(21), "foename"]);
  });
  // MALAGORE sits under the ORB: it hangs behind her, spinning slowly, pulsing purple, and burns at low HP
  if (which === "malva") {
    const boss = foes[0];
    const oglow = add([circle(30), pos(W / 2, BY - 56), color(199, 123, 214), opacity(0.25), z(3), "orbglow"]);
    const orb = add([sprite("orb"), pos(W / 2, BY - 56), anchor("center"), scale(1.4), rotate(0), z(4), "orb"]);
    orb.onUpdate(() => {
      const low = boss.hp / boss.maxHp < 0.34;
      const t = time();
      orb.angle = Math.sin(t * 0.8) * 14 + (low ? Math.sin(t * 9) * 6 : 0);
      orb.scale = vec2(1.4 + 0.1 * Math.sin(t * (low ? 6 : 2)));
      oglow.opacity = (low ? 0.4 : 0.18) + 0.14 * Math.abs(Math.sin(t * (low ? 7 : 2.5)));
      oglow.radius = 26 + 6 * Math.abs(Math.sin(t * 2.5));
    });
    loop(0.25, () => add([rect(2, 2), pos(W / 2 + rand(-16, 16), BY - 50), color(199, 123, 214), z(4), opacity(0.9), lifespan(0.8, { fade: 0.5 }), move(UP, rand(10, 26))]));
  }
  // YUGRIN carries the orb on his staff
  if (which === "yugrin") {
    music.play("final");
    const oglow = add([circle(14), pos(W / 2 + 34, BY - 30), color(199, 123, 214), opacity(0.3), z(3), "orbglow"]);
    const orb = add([sprite("orb"), pos(W / 2 + 34, BY - 30), anchor("center"), scale(0.8), rotate(0), z(6), "orb"]);
    orb.onUpdate(() => { const t = time(); orb.angle = Math.sin(t * 1.2) * 10; oglow.opacity = 0.2 + 0.15 * Math.abs(Math.sin(t * 3)); oglow.radius = 12 + 4 * Math.abs(Math.sin(t * 2.5)); });
  }
  // captive siblings in the circus fight
  if (which === "lygon") {
    add([sprite("sis"), pos(40, 60), anchor("topleft"), z(4)]);
    add([sprite("bro"), pos(W - 60, 60), anchor("topleft"), z(4)]);
    [40, W - 60].forEach((x) => { for (let i = 0; i < 4; i++) add([rect(1, 30), pos(x - 2 + i * 6, 56), color(140, 140, 150), z(5)]); });
  }
  // the King watches the house fight from the doorway, hand raised
  if (which === "house2") {
    const k = add([sprite("king"), pos(W - 30, 96), anchor("center"), z(4), "king"]);
    const hand = add([circle(5), pos(W - 12, 82), color(199, 123, 214), opacity(0.6), z(5)]);
    hand.onUpdate(() => { hand.opacity = 0.4 + 0.3 * Math.abs(Math.sin(time() * 5)); k.pos.y = 96 + Math.sin(time() * 1.5); });
  }

  // ---- the party row: back views along the bottom, each with a small HP bar; the acting one bounces
  const PY = H - 54;
  add([rect(110, 46, { radius: 3 }), pos(10, PY), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  function buildRow() {
    destroyAll("prow");
    const n = members.length, slot = Math.min(22, 104 / n);
    members.forEach((m, i) => {
      const cx = Math.round(65 - (n * slot) / 2 + slot * (i + 0.5));
      m.cx = cx;
      const s = add([sprite(m.name + "_b"), pos(cx, PY + 3), anchor("top"), z(22), opacity(1), "prow", "partysprite"]);
      s.member = m.name;
      add([rect(16, 3), pos(cx - 8, PY + 33), color(60, 60, 80), z(22), "prow"]);
      const bar = add([rect(16, 3), pos(cx - 8, PY + 33), color(...C_GREEN), z(23), "prow"]);
      const num = add([text("", { size: 8 }), pos(cx, PY + 37), anchor("top"), color(...C_INK), z(23), "prow"]);
      s.onUpdate(() => {
        const hp = mhp(m), down = hp <= 0, ratio = hp / mmax(m);
        bar.width = 16 * ratio; bar.color = ratio > 0.5 ? rgb(...C_GREEN) : ratio > 0.25 ? rgb(...C_GOLD) : rgb(...C_RED);
        num.text = `${hp}`; num.color = down ? rgb(...C_GREY) : rgb(...C_INK);
        s.opacity = down ? 0.35 : 1;
        const acting = !busy && !dialogOpen && cur === m;
        s.pos.y = PY + 3 + (down ? 4 : 0) - (acting ? Math.abs(Math.sin(time() * 8)) * 4 : 0);
      });
    });
  }
  buildRow();
  // a blue arrow says who the enemy is coming for; a gold one is your own pick (enemy or ally)
  const tArrow = arrowObj("down", 0, 0, 4, C_BLUE, [z(40), "targetarrow"]);
  const pArrow = arrowObj("down", 0, 0, 5, C_GOLD, [z(40), "pickarrow"]);
  onUpdate(() => {
    tArrow.hidden = !targeting;
    if (targeting) tArrow.pos = vec2(targeting.cx, PY - 3 - Math.abs(Math.sin(time() * 8)) * 3);
    let p = null;
    if (!busy && !dialogOpen) {
      if (sub === "target") p = vec2(foes[targetIdx].x, BY - 48);
      else if (sub === "ally") p = vec2(members[allyIdx].cx, PY - 3);
    }
    pArrow.hidden = !p;
    if (p) pArrow.pos = p.add(0, -Math.abs(Math.sin(time() * 8)) * 3);
  });

  // ---- the menu
  const menuBox = add([rect(180, 46, { radius: 3 }), pos(130, PY), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  const slots = [0, 1, 2, 3, 4, 5].map((i) => add([text("", { size: 8 }), pos(146 + (i % 2) * 80, PY + 10 + Math.floor(i / 2) * 16), color(232, 232, 240), z(21)]));
  const cursor = arrowObj("right", 4, 4, 4, [242, 208, 92], [z(22)]);
  const who = add([text("", { size: 8 }), pos(130, PY - 10), color(232, 232, 240), z(22)]);
  const hint = add([text("", { size: 8 }), pos(310, PY - 10), anchor("topright"), color(207, 207, 216), z(22)]);

  function options() {
    if (!cur) return [];
    switch (cur.name) {
      case "pip": return ["Potion", "Fizz Bomb", "Item", ""];
      case "zed": return ["Zip Gun", "Rocket", "Item", ""];
      case "bruno": return ["Punch", "Kick", "Focus", ""];
      case "bloop": return ["Kick", "", "", ""];
      default: return ["Slash", "PSI", "Item", "Run"];
    }
  }
  function labels() {
    if (sub === "psi") return PSI.map((p) => `${p.name} ${p.pp}`).concat(["Back"]);
    if (sub === "item") return [`Cookie ${state.cookies}`, `Juice ${state.juice}`, `Soda ${state.soda}`, `Bomb ${state.bombs}`, "Back"];
    if (sub === "target") return [`Hit who?  < ${foes[targetIdx].name} >`, "", "", ""];
    if (sub === "ally") return [`Heal who?  < ${members[allyIdx].label} >`, "", "", ""];
    return options().map((o) => (o === "Rocket" ? `Rocket x${state.rockets}` : o));
  }
  onUpdate(() => {
    const hide = busy || dialogOpen;
    menuBox.hidden = hide; cursor.hidden = hide;
    const L = labels(), cols = L.length > 4 ? 3 : 2;
    slots.forEach((s, i) => { s.hidden = hide; s.text = L[i] || ""; s.color = rgb(232, 232, 240); s.pos = vec2(cols === 3 ? 140 + (i % 3) * 58 : 146 + (i % 2) * 80, PY + 10 + Math.floor(i / cols) * 16); });
    if (cur && cur.name === "bloop" && !sub) { slots[2].text = "(Bloop has no other ideas.)"; slots[2].color = rgb(...C_GREY); }
    cursor.pos = slots[sub === "target" || sub === "ally" ? 0 : sub ? subIdx : menu].pos.add(-9, 0);
    const live = foes.filter((f) => f.alive), tune = live[0] || foes[0];
    who.hidden = hide || (sub && sub !== "target" && sub !== "ally");
    who.text = cur ? `${cur.label}  HP ${mhp(cur)}/${mmax(cur)}` + (cur.name === "hero" ? `  PP ${state.pp}/${state.maxPp}` : cur.focus ? "  FOCUSED" : "") : "";
    hint.hidden = hide || !sub || sub === "target" || sub === "ally";
    hint.text = sub === "psi" ? (tune.def.weak ? `${tune.name} hates ${tune.def.weak.toUpperCase()}!` : `${tune.name} fears nothing.`) : sub === "item" ? "Cookie +15  Soda +12PP  Juice full  Bomb ALL" : "";
  });

  function nav(dx, dy) {
    if (busy || dialogOpen) return;
    if (sub === "target") {
      const idxs = foes.map((f, i) => (f.alive ? i : -1)).filter((i) => i >= 0);
      if (dx && idxs.length > 1) { const k = idxs.indexOf(targetIdx); targetIdx = idxs[(k + dx + idxs.length) % idxs.length]; music.sfx("move"); }
      return;
    }
    if (sub === "ally") { if (dx) { allyIdx = (allyIdx + dx + members.length) % members.length; music.sfx("move"); } return; }
    const L = labels().filter((x) => x), cols = L.length > 4 ? 3 : 2;
    let idx = sub ? subIdx : menu;
    if (dx === -1 && idx % cols > 0) idx -= 1;
    if (dx === 1 && idx % cols < cols - 1 && idx + 1 < L.length) idx += 1;
    if (dy === -1 && idx >= cols) idx -= cols;
    if (dy === 1 && idx + cols < L.length) idx += cols;
    if (idx !== (sub ? subIdx : menu)) music.sfx("move");
    if (sub) subIdx = idx; else menu = idx;
  }
  ["left", "a", "4"].forEach((k) => onKeyPress(k, () => nav(-1, 0)));
  ["right", "d", "6"].forEach((k) => onKeyPress(k, () => nav(1, 0)));
  ["up", "w", "8"].forEach((k) => onKeyPress(k, () => nav(0, -1)));
  ["down", "s", "2"].forEach((k) => onKeyPress(k, () => nav(0, 1)));
  BACK.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen && sub) { sub = null; subIdx = 0; pending = null; music.sfx("back"); } }));
  INTERACT.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen) confirm(); }));

  // ---- the turn order
  function startRound() { actor = 0; nextActor(); }
  function nextActor() {
    while (actor < members.length && !alive(members[actor])) actor++;
    if (actor >= members.length) {
      cur = null; busy = true;
      // the friends barge into the house fight after your first turn
      if (!barged) { barged = true; bargeIn(enemiesTurn); } else enemiesTurn();
      return;
    }
    cur = members[actor]; menu = 0; sub = null; subIdx = 0; pending = null; busy = false;
  }
  function actionDone() { busy = true; actor++; nextActor(); }

  function bargeIn(cb) {
    music.sfx("bang"); shake(16);
    add([text("BANG!", { size: 18 }), pos(W - 50, 104), anchor("center"), color(...C_GOLD), z(60), opacity(1), lifespan(0.9, { fade: 0.4 }), move(UP, 12)]);
    const names = ["pip", "zed", "bruno"];
    const sprs = names.map((n, i) => add([sprite(n), pos(W + 20 + i * 26, 122 - i * 3), anchor("center"), z(40), "barge"]));
    sprs.forEach((s, i) => tween(s.pos.x, W / 2 + 26 + i * 30, 0.6 + i * 0.1, (x) => { s.pos.x = x; }, easings.easeOutQuad));
    wait(0.8, () => say([
      "* The door BANGED open!",
      "Pip: I brought potions!",
      "Zed: Stand back, I've got a zip gun!",
      "Bruno: HYAAA!",
      "* PIP, ZED and BRUNO jumped into the fight!",
    ], () => {
      state.party = ["pip", "zed", "bruno"]; state.rockets = 3; partyHpInit();
      destroyAll("barge"); buildMembers(); buildRow(); music.sfx("pickup");
      cb();
    }));
  }

  // ---- your side's actions
  const tune = () => foes.find((f) => f.alive) || foes[0];
  // which minigame decides the power of this action, per the enemy's tuning
  function attackKind(action) {
    return pickMech(BOSSES.has(tune().key) || !!tune().mini.phases);
  }
  // a power minigame for `label`; done(multiplier, grade)
  function power(kind, label, done, o = {}) {
    const m = tune().mini, speed = m.speed || 1;
    const zoneW = (m.zone || 0.3) * (o.zoneMul || 1);
    telegraph(`${label} ${o.verb || "ATTACKS!"}`, () => {
      if (kind === "mash") miniCue("mash", C_GOLD, () => miniMash({ prompt: "MASH A!", keys: INTERACT, duration: 2, speed }, (r) => done(0.6 + r, gradeOf(r))));
      else if (kind === "sequence") miniCue("sequence", C_GOLD, () => miniSequence({ speed, zone: zoneW }, (hits) => done(hits / 3 + 0.4, hits >= 3 ? "perfect" : hits > 0 ? "good" : "miss")));
      else {
        // everything else comes from the table; an unknown name plays as timing
        const M = MINIS[kind] || MINIS.timing, name = MINIS[kind] ? kind : "timing";
        miniCue(name, C_GOLD, () => M.run({ speed, zone: zoneW, zones: m.zones || 1, keys: INTERACT }, (r) =>
          M.ratio ? done(0.6 + r, gradeOf(r)) : done(r === "perfect" ? 1.5 : r === "good" ? 1 : 0.5, r)));
      }
    }, C_GOLD);
  }
  // pick an enemy (left/right) when there is more than one to pick from
  function pickTarget(act) {
    const live = foes.filter((f) => f.alive);
    if (live.length <= 1) { busy = true; act(live[0] || foes[0]); return; }
    pending = act; sub = "target"; targetIdx = foes.indexOf(live[0]);
  }
  function pickAlly(act) {
    pending = act; sub = "ally";
    let best = 0; members.forEach((m, i) => { if (mhp(m) / mmax(m) < mhp(members[best]) / mmax(members[best])) best = i; });
    allyIdx = best;
  }
  const roll = (a, b, mult) => Math.max(1, Math.round(randi(a, b) * mult));

  function confirm() {
    if (sub === "target") { const act = pending; pending = null; sub = null; busy = true; music.sfx("select"); act(foes[targetIdx]); return; }
    if (sub === "ally") { const act = pending; pending = null; sub = null; busy = true; music.sfx("select"); act(members[allyIdx]); return; }
    if (sub === "psi") {
      if (subIdx === 3) { sub = null; subIdx = 0; music.sfx("back"); return; }
      const p = PSI[subIdx];
      if (state.pp < p.pp) { music.sfx("back"); say([`* Not enough PP for ${p.name}. (needs ${p.pp})`]); return; }
      sub = null; subIdx = 0;
      music.sfx("select");
      pickTarget((f) => {
        state.pp -= p.pp;
        power(attackKind(p.kind), state.name, (mult, grade) => {
          music.sfx("psi_" + p.kind);
          let dmg = roll(p.dmg[0], p.dmg[1], mult);
          const weak = p.kind === f.def.weak;
          if (weak) dmg = Math.round(dmg * 1.5);
          if (p.kind === "star") {
            shake(20);
            for (let i = 0; i < 14; i++) add([text("*", { size: 12 }), pos(rand(40, W - 40), rand(-10, 60)), color(242, 208, 92), z(40), opacity(1), lifespan(0.6), move(DOWN, 200)]);
          }
          if (p.kind === "fire") for (let i = 0; i < 10; i++) add([rect(3, 3), pos(f.x + rand(-30, 30), BY + rand(-30, 30)), color(239, 143, 60), z(40), opacity(1), lifespan(0.5), move(UP, rand(40, 90))]);
          // a perfect Ice always freezes; a shakier one sometimes does
          if (p.freeze && (grade === "perfect" || Math.random() < (grade === "good" ? 0.6 : 0.3))) f.frozen = 1;
          hit([{ foe: f, dmg }], state.name, p.verb + (grade === "perfect" ? " PERFECT!" : "") + (weak ? " SUPER effective!" : "") + (p.freeze && f.frozen ? ` ${f.name} is frozen solid!` : ""));
        }, { zoneMul: p.kind === "ice" ? 0.65 : 1 }); // ice asks for a steadier hand
      });
      return;
    }
    if (sub === "item") {
      if (subIdx === 4) { sub = null; subIdx = 0; music.sfx("back"); return; }
      if (subIdx === 0) {
        if (state.cookies <= 0) { music.sfx("back"); say(["* No cookies left!"]); return; }
        music.sfx("heal");
        state.cookies -= 1; const was = mhp(cur); setHp(cur, was + 15);
        sub = null; menu = 0; busy = true; say([`* ${cur.label} ate a Cookie. +${mhp(cur) - was} HP!`], actionDone); return;
      }
      if (subIdx === 1) {
        if (state.juice <= 0) { music.sfx("back"); say(["* No juice left!"]); return; }
        music.sfx("heal");
        state.juice -= 1; const was = mhp(cur), pp = state.maxPp - state.pp; setHp(cur, mmax(cur)); state.pp = state.maxPp;
        sub = null; menu = 0; busy = true; say([`* ${cur.label} drank the Juice Box. +${mhp(cur) - was} HP, +${pp} PP! Everything's full!`], actionDone); return;
      }
      if (subIdx === 2) {
        if (state.soda <= 0) { music.sfx("back"); say(["* No soda left!"]); return; }
        music.sfx("heal");
        state.soda -= 1; const pp = Math.min(12, state.maxPp - state.pp); state.pp += pp;
        sub = null; menu = 0; busy = true; say([`* ${cur.label} drank a Soda. +${pp} PP! Fizzy.`], actionDone); return;
      }
      // the BOMB: every enemy, 25-35, no minigame
      if (state.bombs <= 0) { music.sfx("back"); say(["* No bombs left!"]); return; }
      state.bombs -= 1; sub = null; menu = 0; busy = true;
      const thrower = cur.label, live = foes.filter((f) => f.alive);
      music.sfx("boom"); shake(30);
      add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.9), z(50), lifespan(0.25, { fade: 0.2 })]);
      add([text("KABOOM!!", { size: 24 }), pos(W / 2, BY), anchor("center"), color(...C_GOLD), z(60), opacity(1), lifespan(0.9, { fade: 0.4 }), move(UP, 16)]);
      live.forEach((f) => { for (let i = 0; i < 14; i++) add([rect(3, 3), pos(f.x + rand(-34, 34), BY + rand(-34, 34)), color(...choose([C_GOLD, C_RED, C_INK])), z(40), opacity(1), lifespan(0.7), move(UP, rand(40, 120))]); });
      wait(0.3, () => hit(live.map((f) => ({ foe: f, dmg: randi(25, 35) })), thrower, "threw a BOMB! KABOOM!"));
      return;
    }
    const o = options()[menu];
    if (!o) return;
    menu = 0; // next action starts on the first option: mashing A can never chain Item or PSI
    music.sfx("select");
    if (o === "PSI") { sub = "psi"; subIdx = 0; return; }
    if (o === "Item") { sub = "item"; subIdx = 0; return; }
    const me = cur;
    if (o === "Slash") {
      pickTarget((f) => power(attackKind("slash"), state.name, (mult, grade) => {
        music.sfx("slash");
        const crit = Math.random() < (grade === "perfect" ? 0.3 : 0.15);
        const dmg = (state.giantSword ? roll(12, 18, mult) : roll(8, 12, mult)) * (crit ? 2 : 1);
        add([rect(state.giantSword ? 70 : 40, state.giantSword ? 5 : 3), pos(f.x, BY), anchor("center"), color(244, 241, 234), rotate(-40), z(40), opacity(1), lifespan(0.15)]);
        const verb = state.giantSword ? (crit ? "swung the GIANT SWORD in a huge arc!" : "swung the GIANT SWORD!") : (crit ? "did a HUGE spinning slash!" : "slashed with the sword!");
        hit([{ foe: f, dmg }], state.name, verb + (grade === "perfect" ? " PERFECT!" : ""));
      }));
    } else if (o === "Run") {
      busy = true;
      say(["* You tried to run.", `* Then you remembered ${state.sis} and ${state.bro}. You did not run.`], actionDone);
    } else if (o === "Potion") {
      // Pip: heal one member (+18; a perfect throw +26 and shakes off the cold)
      pickAlly((m) => power("timing", "Pip", (mult, grade) => {
        music.sfx("heal");
        const amt = grade === "perfect" ? 26 : 18, was = mhp(m);
        setHp(m, was + amt);
        for (let i = 0; i < 8; i++) add([rect(2, 2), pos(m.cx + rand(-8, 8), PY + rand(0, 20)), color(...C_TEAL), z(45), opacity(1), lifespan(0.6), move(UP, rand(20, 50))]);
        say([`* Pip splashed a Potion on ${m.label}! +${mhp(m) - was} HP!` + (grade === "perfect" ? " PERFECT! Fizzy and cold, and the shivers are gone." : "") + (was <= 0 ? ` ${m.label} is back up!` : "")], actionDone);
      }, { verb: "throws a POTION!" }));
    } else if (o === "Fizz Bomb") {
      // Pip: every enemy, 8-12
      busy = true;
      power("mash", "Pip", (mult) => {
        music.sfx("psi_fire");
        const live = foes.filter((f) => f.alive);
        live.forEach((f) => { for (let i = 0; i < 8; i++) add([rect(3, 3), pos(f.x + rand(-30, 30), BY + rand(-30, 30)), color(...C_TEAL), z(40), opacity(1), lifespan(0.5), move(UP, rand(40, 90))]); });
        hit(live.map((f) => ({ foe: f, dmg: roll(8, 12, mult) })), "Pip", "threw a FIZZ BOMB!");
      }, { verb: "shakes a FIZZ BOMB!" });
    } else if (o === "Zip Gun") {
      // Zed: 10-14; a perfect double-tap is half again as much
      pickTarget((f) => power("timing", "Zed", (mult, grade) => {
        music.sfx("slash");
        let dmg = roll(10, 14, 1);
        if (grade === "perfect") dmg = Math.round(dmg * 1.5); else if (grade === "miss") dmg = Math.max(1, Math.round(dmg * 0.6));
        add([rect(60, 2), pos(f.x - 30, BY), color(242, 208, 92), z(40), opacity(1), lifespan(0.12)]);
        hit([{ foe: f, dmg }], "Zed", grade === "perfect" ? "double-tapped the ZIP GUN! PERFECT!" : "fired the ZIP GUN!");
      }));
    } else if (o === "Rocket") {
      // Zed: a Bottle Rocket, three per run; 22-30 to one enemy
      if (state.rockets <= 0) { music.sfx("back"); say(["* No bottle rockets left!", "Zed: I KNEW I should have brought more."]); return; }
      pickTarget((f) => {
        state.rockets -= 1;
        power("sequence", "Zed", (mult) => {
          music.sfx("boom"); shake(14);
          for (let i = 0; i < 12; i++) add([rect(3, 3), pos(f.x + rand(-30, 30), BY + rand(-30, 30)), color(...choose([C_GOLD, C_RED, C_INK])), z(40), opacity(1), lifespan(0.6), move(UP, rand(30, 100))]);
          hit([{ foe: f, dmg: roll(22, 30, mult) }], "Zed", "launched a BOTTLE ROCKET!");
        }, { verb: "lights a ROCKET!" });
      });
    } else if (me.name === "bruno" && (o === "Punch" || o === "Kick")) {
      // Bruno: Punch 9-13 (mash), Kick 14-18 (timing); a Focus doubles the next one
      pickTarget((f) => power(o === "Punch" ? "mash" : "timing", "Bruno", (mult) => {
        music.sfx("hit");
        const focused = me.focus; me.focus = false;
        const dmg = (o === "Punch" ? roll(9, 13, mult) : roll(14, 18, mult)) * (focused ? 2 : 1);
        hit([{ foe: f, dmg }], "Bruno", (o === "Punch" ? "punched! HYAA!" : "kicked! HYAAA!") + (focused ? " FOCUSED! DOUBLE!" : ""));
      }));
    } else if (o === "Focus") {
      busy = true; me.focus = true;
      say(["* Bruno took a deep breath. His next hit will be DOUBLE."], actionDone);
    } else if (me.name === "bloop" && o === "Kick") {
      // Bloop: the one thing Bloop does
      pickTarget((f) => power("mash", "Bloop", (mult) => {
        music.sfx("hit");
        hit([{ foe: f, dmg: roll(8, 12, mult) }], "Bloop", "kicked! GOOD kick!");
      }));
    }
  }

  // ---- damage to enemies
  const defaultNext = () => {
    const key = inHollow ? "hollow" : "cave";
    state[key] += 1;
    healAll(12);
    state.pp = Math.min(state.maxPp, state.pp + 8);
    if (state[key] % 2 === 0) state.cookies += 1;
    go(key, { resume: true });
  };
  const finish = () => (lead.next ? lead.next(bopts) : defaultNext());
  // one roll after any won fight: at most one thing falls out of it
  function rollDrop() {
    const r = Math.random();
    if (r < 0.40) { state.cookies += 1; return "Cookie"; }
    if (r < 0.65) { state.soda += 1; return "Soda"; }
    if (r < 0.73) { state.juice += 1; return "Juice Box"; }
    if (r < 0.78) { state.bombs += 1; return "BOMB"; }
    return null;
  }
  function phaseIndex(f) {
    if (f.mini.pick !== "phase" || !f.mini.phases) return 0;
    const r = f.hp / f.maxHp, i = f.mini.phases.findIndex((p) => r > p.above);
    return i < 0 ? f.mini.phases.length - 1 : i;
  }
  // a boss crossing into a new phase: a white flash, the sprite swaps, one line, then (Yugrin) the tier's opening blast
  function phaseShift(f, then) {
    const ph = f.mini.phases[f.phaseIdx];
    window.rbBattle.events.push({ shift: f.phaseIdx, spr: ph.spr || f.def.spr });
    music.sfx("transform"); shake(16);
    const wash = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(1), z(50), fixed()]);
    wash.onUpdate(() => { wash.opacity = Math.max(0, wash.opacity - 2.2 * dt()); if (wash.opacity <= 0) destroy(wash); });
    wait(0.15, () => {
      if (ph.spr && f.spr.exists()) { f.spr.use(sprite(ph.spr)); f.formSpr = ph.spr; }
      f.barShake = !!ph.tier && ph.tier >= 3;
      const go2 = () => say(ph.enter || [`* ${f.name} changed!`], then);
      if (ph.tier) tierFx(ph.tier, f, go2); else go2();
    });
  }
  function hit(hits, who, verb) {
    music.sfx("hit"); shake(8);
    add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.5), z(50), lifespan(0.08)]);
    const lines = [];
    hits.forEach((h) => {
      const f = h.foe, dmg = Math.max(1, Math.round(h.dmg));
      f.hp -= dmg;
      // MALAGORE is never finished by the party: below 8% the fight stops for Yugrin
      if (which === "malva" && f.hp <= f.maxHp * 0.08) { f.hp = Math.max(1, f.hp); f.theft = true; }
      f.spr.pos.x = f.x + 6;
      wait(0.08, () => { if (f.spr.exists()) f.spr.pos.x = f.x; });
      add([text(`${dmg}`, { size: 14 }), pos(f.x + rand(-20, 20), 50), anchor("center"), color(242, 208, 92), z(45), opacity(1), lifespan(0.8), move(UP, 30)]);
      lines.push(`* ${who} ${verb} ${dmg} damage to ${f.name}!`);
    });
    const downed = hits.map((h) => h.foe).filter((f) => f.hp <= 0 && f.alive);
    downed.forEach((f) => { f.alive = false; f.hp = 0; f.frozen = 0; f.spr.opacity = 0.3; f.spr.color = rgb(120, 120, 140); });
    if (foes.every((f) => !f.alive)) {
      music.sfx("win");
      const done = inHollow ? state.hollow : state.cave;
      const bonus = lead.small && !lead.next ? ["* You feel a little stronger. +12 HP, +8 PP" + (done % 2 === 1 ? ", and you found a Cookie!" : "!")] : zone === "road" ? ["* Everyone feels a little stronger. +6 HP."] : [];
      const drop = rollDrop();
      if (drop) bonus.push(`* You found a ${drop}!`);
      say(lines.concat(lead.win).concat(bonus), finish);
    } else {
      downed.forEach((f) => lines.push(...(f.def.down || [`* ${f.name} went down!`])));
      const thief = foes.find((f) => f.theft && !f.stolen);
      if (thief) { thief.stolen = true; say(lines, () => malvaTheft(thief)); return; }
      // a boss that crossed a phase line plays its change before the turn moves on
      const shifts = foes.filter((f) => f.alive && phaseIndex(f) > f.phaseIdx);
      const run = (i) => { if (i >= shifts.length) { actionDone(); return; } shifts[i].phaseIdx = phaseIndex(shifts[i]); phaseShift(shifts[i], () => run(i + 1)); };
      say(lines, () => run(0));
    }
  }
  // The end of MALAGORE: Yugrin stomps in, takes the orb off her, and she collapses without it.
  // Then Pip gets everybody back on their feet, and the party heads up the mountain after him.
  function malvaTheft(f) {
    busy = true; targeting = null;
    window.rbBattle.events.push({ theft: true });
    const orb = get("orb")[0];
    const yug = add([sprite("minion"), pos(W + 40, BY + 10), anchor("center"), scale(1.6), z(7), "yugrin"]);
    music.sfx("stomp"); shake(14);
    tween(W + 40, W / 2 + 92, 0.7, (x) => { yug.pos.x = x; }, easings.easeOutQuad).then(() => {
      shake(10); music.sfx("stomp");
      say(["YUGRIN: The orb is MINE now."], () => {
        if (orb && orb.exists()) { const from = orb.pos.clone(), to = vec2(yug.pos.x + 24, yug.pos.y - 40); tween(0, 1, 0.5, (v) => { orb.pos = from.lerp(to, v).add(0, -Math.sin(v * Math.PI) * 30); }, easings.easeInOutQuad); }
        destroyAll("orbglow");
        wait(0.6, () => say(["MALAGORE: NO— the orb— without it I—"], () => {
          // she falls
          const s = f.spr;
          tween(1, 0, 0.9, (v) => { if (s.exists()) { s.opacity = v; s.pos.y = BY + (1 - v) * 26; } });
          shake(8);
          wait(1.0, () => {
            f.alive = false; f.hp = 0;
            tween(yug.pos.x, -60, 0.8, (x) => { yug.pos.x = x; if (orb && orb.exists()) orb.pos.x = x + 24; }, easings.easeInQuad);
            wait(0.9, () => {
              destroy(yug); if (orb && orb.exists()) destroy(orb);
              state.beatMalva = true; state.yugrinHasOrb = true;
              say(["* MALAGORE is defeated.", "* ...but Yugrin has the orb."], () => {
                say([(fighters().includes("pip") ? "Pip" : state.name) + ": Everyone! Potions! Drink up!"], () => {
                  // bottles to every member, then everybody is full
                  members.forEach((m, i) => { const b = add([rect(4, 7), pos(W / 2 + 60, BY + 20), color(...C_TEAL), z(46)]); tween(b.pos, vec2(m.cx, PY + 10), 0.4 + i * 0.08, (p) => { b.pos = p; }, easings.easeOutQuad).then(() => destroy(b)); });
                  wait(0.8, () => {
                    music.sfx("heal_all"); shake(6);
                    add([rect(W, H), pos(0, 0), color(...C_GREEN), opacity(0.55), z(50), lifespan(0.5, { fade: 0.4 })]);
                    fullHeal();
                    members.forEach((m) => { for (let i = 0; i < 6; i++) add([rect(2, 2), pos(m.cx + rand(-8, 8), PY + rand(0, 20)), color(...C_TEAL), z(45), opacity(1), lifespan(0.6), move(UP, rand(20, 50))]); });
                    wait(0.6, () => say(["* Everyone is back on their feet. Full HP. Full PP.", "* The party is ready. Yugrin went EAST."], () => { save("hollow"); go("summit"); }));
                  });
                });
              });
            });
          });
        }));
      });
    });
  }
  // YUGRIN's three tiers, each a bigger blast than the last. Everything it draws is tagged "fx".
  function tierFx(tier, f, then) {
    destroyAll("fx");
    const sp = f.spr, home = vec2(f.x, BY);
    if (tier === 1) {
      // the giant sword: a white arc sweeping the whole screen, and a lunge at the party row
      music.sfx("sword_arc"); shake(18);
      const arc = add([rect(300, 8), pos(W / 2, BY + 10), anchor("center"), color(244, 241, 234), rotate(-70), z(45), opacity(0.95), "fx"]);
      const edge = add([rect(300, 2), pos(W / 2, BY + 10), anchor("center"), color(199, 123, 214), rotate(-70), z(46), opacity(0.9), "fx"]);
      tween(-70, 70, 0.4, (a) => { arc.angle = a; edge.angle = a; }, easings.easeInOutQuad);
      if (sp.exists()) tween(home.y, home.y + 36, 0.2, (y) => { if (sp.exists()) sp.pos.y = y; }).then(() => tween(home.y + 36, home.y, 0.25, (y) => { if (sp.exists()) sp.pos.y = y; }));
    } else if (tier === 2) {
      // the orb: a flare, two purple beams raking the screen, a purple flash and a rain of shards
      music.sfx("orb_beam"); shake(14);
      add([circle(40), pos(f.x + 34, BY - 30), color(199, 123, 214), opacity(0.6), z(44), lifespan(0.7, { fade: 0.5 }), "fx"]);
      add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0.45), z(50), lifespan(0.5, { fade: 0.4 }), "fx"]);
      [0, 1].forEach((i) => { const b = add([rect(50, H), pos(i ? W : -50, 0), color(199, 123, 214), opacity(0.6), z(45), "fx"]); tween(b.pos.x, i ? -60 : W + 10, 0.6, (x) => { b.pos.x = x; }); });
      for (let i = 0; i < 6; i++) add([rect(3, 5), pos(rand(20, W - 20), rand(-30, 20)), color(232, 232, 240), rotate(rand(0, 90)), z(45), opacity(1), lifespan(0.7, { fade: 0.3 }), move(DOWN, rand(120, 220)), "fx"]);
    } else {
      // unleashed: white cracks across the sky, lightning flicker, red at the edges, the sprite swelling
      music.sfx("crack"); shake(26);
      for (let i = 0; i < 8; i++) add([rect(rand(80, 220), 2), pos(rand(40, W - 40), rand(10, 150)), anchor("center"), color(244, 241, 234), rotate(rand(-70, 70)), z(46), opacity(1), lifespan(0.8, { fade: 0.3 }), "fx"]);
      const flick = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.8), z(50), lifespan(0.8), "fx"]);
      flick.onUpdate(() => { flick.opacity = Math.floor(time() * 24) % 3 === 0 ? 0.75 : 0.05; });
      [[0, 0, W, 12], [0, H - 12, W, 12], [0, 0, 12, H], [W - 12, 0, 12, H]].forEach(([x, y, w, h]) => add([rect(w, h), pos(x, y), color(...C_RED), opacity(0.7), z(49), lifespan(0.8, { fade: 0.4 }), "fx"]));
      wait(0.15, () => music.sfx("lightning"));
      if (sp.exists()) { const s0 = sp.scale.x; tween(s0, s0 * 1.3, 0.25, (v) => { if (sp.exists()) sp.scale = vec2(v); }).then(() => tween(s0 * 1.3, s0, 0.3, (v) => { if (sp.exists()) sp.scale = vec2(v); })); }
    }
    const n = get("fx").length;
    window.rbBattle.fxSeen[tier] = Math.max(window.rbBattle.fxSeen[tier] || 0, n);
    wait(0.8, () => { destroyAll("fx"); if (sp.exists()) sp.pos = home.clone(); then(); });
  }
  // the orb comes off the staff, cracks, and shatters in a white-out
  window.rbOrbShatter = (then) => {
    busy = true;
    const orb = get("orb")[0];
    music.play("shatter");
    const rise = orb && orb.exists() ? tween(orb.pos.y, BY - 60, 0.9, (y) => { orb.pos.y = y; orb.pos.x = W / 2; }, easings.easeOutQuad) : wait(0.9);
    rise.then(() => {
      shake(10);
      for (let i = 0; i < 6; i++) wait(i * 0.12, () => add([rect(rand(6, 14), 1), pos(W / 2 + rand(-10, 10), BY - 60 + rand(-14, 14)), anchor("center"), color(244, 241, 234), rotate(rand(0, 180)), z(45), "shatter"]));
      wait(0.9, () => {
        music.sfx("shatter"); shake(30);
        destroyAll("shatter"); if (orb && orb.exists()) destroy(orb); destroyAll("orbglow");
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add([rect(rand(4, 9), 3), pos(W / 2, BY - 60), anchor("center"), color(244, 241, 234), rotate(i * 22), z(55), opacity(1), lifespan(1.0, { fade: 0.5 }), move(vec2(Math.cos(a), Math.sin(a)), rand(120, 220)), "shard"]); }
        const white = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0), z(52), fixed()]);
        white.onUpdate(() => { white.opacity = Math.min(1, white.opacity + 2 * dt()); });
        wait(1.1, () => say(["* The orb is gone. Light poured out over the mountain."], then));
      });
    });
  };
  const hitBoss = (dmg, verb) => hit([{ foe: tune(), dmg }], state.name, verb); // kept for anything that still calls it

  // ---- the enemies' turns
  function currentPhase(f) {
    if (f.mini.pick !== "phase" || !f.mini.phases) return null;
    const r = f.hp / f.maxHp;
    return f.mini.phases.find((p) => r > p.above) || f.mini.phases[f.mini.phases.length - 1];
  }
  function pickDefense(f) {
    const ph = currentPhase(f);
    let d;
    if (ph) {
      d = { ...ph };
      if (Array.isArray(d.defend)) d.defend = d.defend[f.defTurn % d.defend.length];
      if (d.flurry === "alt") d.flurry = f.defTurn % 2 === 0;
    } else d = { defend: "block", fakeouts: f.mini.fakeouts || 0, zones: f.mini.blockZones || 1 };
    // the pacing picks the mechanic; the enemy only tunes it. A flurry is always a mash.
    const m = d.flurry ? "mash" : pickMech(BOSSES.has(f.key) || !!f.mini.phases);
    d.defend = m === "mash" ? "mashB" : m === "wait-bars" ? (Math.random() < 0.5 && (d.fakeouts || f.mini.fakeouts) ? "wait" : "block") : m;
    return d;
  }
  // a short warning in the track strip, then the minigame begins
  function telegraph(txt, then, col = C_BLUE) {
    const p = add([text(txt, { size: 12 }), pos(W / 2, 163), anchor("center"), color(...col), z(30)]);
    wait(0.4, () => { destroy(p); then(); });
  }
  function defenseFx(f, on) {
    destroyAll("defensefx");
    defending = on ? f : null;
    if (!on) { f.spr.pos.x = f.x; return; }
    // a blue glow behind the enemy and a bouncing "!" over its head, for the whole enemy turn
    const glow = add([circle(46), pos(f.x, BY), color(...C_BLUE), opacity(0.22), z(4), "defensefx"]);
    glow.onUpdate(() => { glow.opacity = 0.14 + 0.14 * Math.abs(Math.sin(time() * 9)); });
    const bang = add([text("!", { size: 26 }), pos(f.x + 34, BY - 44), anchor("center"), color(...C_BLUE), z(31), "defensefx"]);
    bang.onUpdate(() => { bang.pos.y = BY - 44 - Math.abs(Math.sin(time() * 10)) * 8; });
  }
  // the target's defense minigame: the rolled damage goes in; what lands comes out, never below 30% of the roll
  function defend(f, rolled, done) {
    const d = pickDefense(f); f.defTurn += 1;
    const speed = d.speed || f.mini.speed || 1;
    if (d.tier) { tierFx(d.tier, f, () => defend2(f, rolled, done, d, speed)); return; }
    defend2(f, rolled, done, d, speed);
  }
  function defend2(f, rolled, done, d, speed) {
    defenseFx(f, true);
    const land = (cut) => {
      defenseFx(f, false);
      let final = rolled;
      if (cut < 0) final = Math.round(rolled * (1 - cut));
      else if (cut > 0) final = Math.max(Math.ceil(rolled * 0.3), Math.round(rolled * (1 - cut)));
      done(Math.max(1, final));
    };
    if (d.defend === "mashB") {
      telegraph(d.flurry ? "A FLURRY!!" : `${f.name} ATTACKS!`, () =>
        miniCue("mash", C_BLUE, () => miniMash({ prompt: d.flurry ? "FLURRY! MASH A!" : "BLOCK! MASH A!", keys: INTERACT.concat(BACK), duration: 1.5, speed, hot: C_BLUE, flurry: d.flurry }, (r) => land(0.6 * r))));
    } else if (d.defend === "wait") {
      telegraph(`${f.name} ATTACKS!`, () =>
        miniCue("wait", C_BLUE, () => miniWait({ speed, fakeouts: d.fakeouts || 0, spr: f.spr }, (g) => land(g === "perfect" ? 0.6 : g === "early" ? -0.3 : 0))));
    } else {
      // "block" is the timed bar; every other name comes from the table and plays in blue with B allowed
      const name = MINIS[d.defend] ? d.defend : "timing", M = MINIS[name];
      telegraph(`${f.name} ATTACKS!`, () =>
        miniCue(name, C_BLUE, () => M.run({ prefix: "BLOCK!", keys: INTERACT.concat(BACK), speed, zone: d.zone || f.mini.zone || 0.3, zones: d.zones || 1, hot: C_BLUE, fakeouts: d.fakeouts || 0, spr: f.spr }, (r) =>
          M.ratio ? land(0.6 * r) : land(r === "perfect" ? 0.7 : r === "good" ? 0.4 : 0))));
    }
  }

  function enemiesTurn() {
    busy = true;
    const live = foes.filter((f) => f.alive);
    let k = 0;
    const nextFoe = () => { if (k >= live.length) { startRound(); return; } foeTurn(live[k++], nextFoe); };
    nextFoe();
  }
  function foeTurn(f, cb) {
    if (f.frozen > 0) { f.frozen -= 1; say([`* ${f.name} is frozen and can't move!`], cb); return; }
    const ph = currentPhase(f);
    const dbl = ph && ph.double != null ? ph.double : f.mini.double;
    const swings = dbl && Math.random() < dbl ? 2 : 1;
    const lines = [];
    function next(i) {
      if (i >= swings) { say(lines, cb); return; }
      const a = choose((ph && ph.attacks) || f.def.attacks);
      const target = choose(members.filter(alive));
      const rolled = a.d[1] === 0 ? 0 : Math.round(randi(a.d[0], a.d[1]) * dmgScale());
      window.rbBattle.lastRoll = rolled; window.rbBattle.lastTarget = target.name;
      const head = `* ${f.name} ${a.t.replace("%n", target.label)}`;
      if (rolled === 0) { lines.push(head + " Nothing happened."); next(i + 1); return; }
      targeting = target;
      defend(f, rolled, (dmg) => {
        targeting = null;
        setHp(target, mhp(target) - dmg); shake(dmg > 6 ? 14 : 8); music.sfx("hurt");
        add([text(`-${dmg}`, { size: 14 }), pos(target.cx, PY - 6), anchor("center"), color(...C_RED), z(45), opacity(1), lifespan(0.8, { fade: 0.3 }), move(UP, 30)]);
        const note = dmg < rolled ? ` (You blocked ${rolled - dmg}!)` : dmg > rolled ? ` (You flinched! +${dmg - rolled})` : "";
        lines.push(`${head} ${dmg} damage to ${target.label}!${note}`);
        if (!alive(target) && members.length > 1) lines.push(`* ${target.label} went down!`);
        if (!members.some(alive)) { lose(lines); return; }
        next(i + 1);
      });
    }
    if (swings === 2) {
      const p = add([text((ph && ph.banner) || "DOUBLE ATTACK!", { size: 14 }), pos(W / 2, 163), anchor("center"), color(...C_RED), z(30)]);
      shake(6); music.sfx("bang");
      wait(0.7, () => { destroy(p); next(0); });
    } else next(0);
  }
  function lose(lines) {
    music.sfx("lose");
    const solo = members.length === 1;
    say(lines.concat([solo ? `* ${state.name} got knocked flat.` : "* Everybody is down.", "* ...", `* Mom's voice: "${state.name}! Get UP!"`, "* You got up. You still have a job to do."]), () => {
      fullHeal(); state.cookies = Math.max(state.cookies, 2); state.juice = Math.max(state.juice, 1);
      if (zone === "hollow") go("hollow", { resume: true, lost: true, boss: !lead.small });
      else if (zone === "house2") go("house2", { retry: true });
      else if (zone === "road") go("road", { resume: true, at: bopts.at, lost: true });
      else if (zone === "summit") go("summit", { retry: true });
      else go("cave", which === "ambush" ? { resume: true, at: "branch" } : { resume: true, lost: true });
    });
  }

  if (lead.small && (zone === "cave" || zone === "hollow") && which !== "ambush") add([text(inHollow ? `hollow ${state.hollow + 1} / ${HOLLOW_ORDER.length}` : `cave ${state.cave + 1} / ${CAVE_ENEMIES.length}`, { size: 8 }), pos(W - 12, 8), anchor("topright"), color(207, 207, 216), z(21)]);
  wait(0.2, () => say(lead.intro, startRound));
});

// ---------------------------------------------------------------- scene: end

// The reunion after Lygon plays at home now (see reunionScene). This screen is the true ending only.
scene("end", () => {
  resetCam();
  if (!state.beatMalva) { wait(0, () => go((state.party || []).includes("sis") && !state.homeAgain ? "downstairs" : "town")); return; }
  if (!state.beatYugrin) { wait(0, () => go("summit")); return; }
  trueEnd();
});

// After Yugrin: everyone at home, the orb in pieces on the table, the end.
function trueEnd() {
  music.play("finis");
  add([rect(W, H), pos(0, 0), color(11, 11, 20)]);
  for (let i = 0; i < 60; i++) {
    const c = add([rect(2, 3), pos(rand(0, W), rand(-H, 0)), color(...choose([[224, 69, 63], [242, 208, 92], [58, 111, 216], [79, 176, 106], [199, 123, 214]])), z(1)]);
    const sp = rand(20, 50);
    c.onUpdate(() => { c.pos.y += sp * dt(); c.pos.x += Math.sin(time() * 3 + i) * 0.3; if (c.pos.y > H) c.pos.y = -5; });
  }
  // the orb, in pieces, going dark at the top of the screen
  const orb = add([sprite("orb"), pos(W / 2, 22), anchor("center"), opacity(0.5), z(4)]);
  orb.onUpdate(() => { orb.opacity = 0.25 + 0.2 * Math.abs(Math.sin(time() * 0.7)); });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = 14 + (i % 3) * 5;
    const sh = add([rect(3 + (i % 2), 3), pos(W / 2 + Math.cos(a) * r, 22 + Math.sin(a) * r), color(199, 123, 214), rotate(i * 40), z(5)]);
    sh.onUpdate(() => { sh.pos.y += Math.sin(time() * 2 + i) * 0.05; sh.angle += 20 * dt(); });
  }
  add([sprite("mom"), pos(W / 2 - 70, 58), anchor("center"), z(5)]);
  add([sprite("dad"), pos(W / 2 + 70, 56), anchor("center"), z(5)]);
  add([sprite(heroSprite()), pos(W / 2, 60), anchor("center"), z(5)]);
  add([sprite("sis"), pos(W / 2 - 30, 64), anchor("center"), z(5)]);
  add([sprite("bro"), pos(W / 2 + 30, 64), anchor("center"), z(5)]);
  add([sprite("dog"), pos(W / 2 - 50, 80), anchor("center"), z(6)]);
  if (state.friends) ["pip", "zed", "bruno", "bloop"].forEach((n, i) => { if (n !== "bloop" || (state.party || []).includes("bloop")) add([sprite(n), pos(W / 2 - 120 + (i < 2 ? i * 24 : 200 + (i - 2) * 24), 70), anchor("center"), z(5)]); });
  add([text("YOU SAVED EVERYONE!", { size: 20 }), pos(W / 2, 104), anchor("center"), color(242, 208, 92), z(5)]);
  add([text(`${state.name} broke the orb on the mountain. Nobody is watching anymore.`, { size: 8 }), pos(W / 2, 126), anchor("center"), color(232, 232, 240), z(5)]);
  add([text(`${state.sis}: "I wasn't scared. Either time."\n${state.bro}: "I was a little scared. Both times."`, { size: 8, align: "center", lineSpacing: 3 }), pos(W / 2, 150), anchor("center"), color(207, 207, 216), z(5)]);
  add([text(`Mom: "All your fingers?"  Dad: "That's my kid."`, { size: 8 }), pos(W / 2, 174), anchor("center"), color(207, 207, 216), z(5)]);
  add([text(`${state.dog} was a very good dog the whole time.`, { size: 8 }), pos(W / 2, 192), anchor("center"), color(138, 138, 153), z(5)]);
  add([text("THE END", { size: 12 }), pos(W / 2, 208), anchor("center"), color(242, 208, 92), z(5)]);
  add([text("press SPACE to play again", { size: 8 }), pos(W / 2, 224), anchor("center"), color(242, 208, 92), z(5)]);
  clearSave();
  INTERACT.forEach((k) => onKeyPress(k, () => { Object.assign(state, START); go("title", { fresh: true }); }));
}

go("title");
