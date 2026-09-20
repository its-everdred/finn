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

Object.entries(window.SPRITES).forEach(([k, rows]) => loadSprite(k, window.pixels(rows)));

// ---------------------------------------------------------------- game state

const START = {
  hasSword: false, kidnapped: false, boomed: false, hasKey: false, talkedSis: false, talkedBro: false, talkedMom: false, talkedDad: false,
  cave: 0, beatBugon: false, branchSide: null, branchEnemy: null, branchDone: false, branchSeen: false, giantSword: false, hp: 40, pp: 30, cookies: 3, juice: 1,
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
const SCENES = ["upstairs", "downstairs", "town", "cave"];
function migrate(saved) {
  const st = { ...START, name: state.name, sis: state.sis, bro: state.bro, dog: state.dog, maxHp: state.maxHp, maxPp: state.maxPp, ...(saved.state || {}) };
  // a save from a build with different progress rules never traps the player: clamp what could
  st.hp = Math.min(Math.max(1, st.hp | 0), st.maxHp); st.pp = Math.min(Math.max(0, st.pp | 0), st.maxPp);
  st.cave = Math.min(Math.max(0, st.cave | 0), CAVE_ENEMIES.length);
  let scene = saved.scene;
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
  const cue = add([text("v", { size: 8 }), pos(W - 22, H - 22), color(242, 208, 92), fixed(), z(101), "dialog"]);
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

// ---------------------------------------------------------------- overworld helpers

function makePlayer(x, y) {
  const p = add([
    sprite(state.hasSword ? "hero_sword" : "hero"), pos(x, y),
    area({ shape: new Rect(vec2(6, 22), 10, 9) }), body(), anchor("topleft"), z(10), "player",
  ]);
  const SPEED = 85;
  p.onUpdate(() => {
    if (dialogOpen || window.__frozen) return;
    let d = vec2(0, 0);
    if (isKeyDown("left") || isKeyDown("a") || isKeyDown("4")) d.x -= 1;
    if (isKeyDown("right") || isKeyDown("d") || isKeyDown("6")) d.x += 1;
    if (isKeyDown("up") || isKeyDown("w") || isKeyDown("8")) d.y -= 1;
    if (isKeyDown("down") || isKeyDown("s") || isKeyDown("2")) d.y += 1;
    if (d.len() > 0) p.move(d.unit().scale(SPEED));
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
  const n = add([sprite(spr), pos(x, y), area({ shape: new Rect(vec2(2, opts.footY ?? 12), 12, 8) }), body({ isStatic: true }), anchor("topleft"), z(9 + y / 1000), tag, "npc"]);
  n.talk = talk;
  const baseY = y;
  n.onUpdate(() => { n.pos.y = baseY + (Math.sin(time() * 2 + x) > 0.85 ? -1 : 0); });
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

function hud() {
  const t = add([text("", { size: 8 }), pos(10, 6), color(232, 232, 240), z(50), fixed()]);
  t.onUpdate(() => { t.text = `${state.name}  HP ${state.hp}/${state.maxHp}  PP ${state.pp}/${state.maxPp}`; });
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
    const cur = add([text(">", { size: 10 }), pos(0, 140), anchor("center"), color(242, 208, 92), z(6)]);
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
  music.play(state.kidnapped ? "danger" : "night");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  wall(0, 0, W, 40, [140, 170, 200]);
  wall(0, 0, 8, H, [110, 80, 50]); wall(W - 8, 0, 8, H, [110, 80, 50]); wall(0, H - 8, W, 8, [110, 80, 50]);
  wall(W / 2 - 4, 0, 8, 110, [110, 80, 50]);
  wall(W / 2 - 4, 150, 8, H - 150, [110, 80, 50]);
  // one window per room; they go purple once the explosion happens
  const windows = [{ x: 42, y: 8, w: 30, h: 22 }, { x: W - 72, y: 8, w: 30, h: 22 }];
  windows.forEach(drawWindow);
  // your room: bed, desk (against the top wall, clear of the walk to the doorway)
  wall(20, 60, 60, 36, [70, 110, 190]); add([rect(22, 12), pos(24, 64), color(244, 241, 234)]);
  wall(96, 44, 44, 22, [140, 100, 60]); add([rect(14, 10), pos(100, 46), color(60, 80, 120)]); add([rect(10, 3), pos(120, 52), color(232, 232, 240)]);
  // siblings' room: brother's blue bed, sister's pink bed, rug, shelf
  wall(W / 2 + 14, 60, 50, 32, [90, 130, 210]); add([rect(18, 11), pos(W / 2 + 18, 64), color(244, 241, 234)]);
  wall(W - 72, 60, 58, 32, [230, 120, 160]); add([rect(18, 11), pos(W - 68, 64), color(244, 241, 234)]);
  add([rect(70, 40), pos(W / 2 + 30, 150), color(200, 140, 190)]);
  wall(W - 70, 120, 54, 10, [140, 100, 60]);
  // stairs down
  add([rect(30, 28), pos(14, H - 36), color(110, 80, 50)]);
  for (let i = 0; i < 5; i++) add([rect(30, 1), pos(14, H - 34 + i * 5), color(70, 50, 30)]);
  add([text("v", { size: 8 }), pos(29, H - 44), anchor("center"), color(242, 208, 92)]);
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

  const sis = state.kidnapped ? null : npc("sis", W - 100, 100, "sis", () => {
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

  const bro = state.kidnapped ? null : npc("bro", W - 124, 104, "bro", () => {
    state.talkedBro = true;
    if (!state.boomed) { say([`${state.bro}: zzz... robots... zzz...`]); return; }
    say(state.hasSword ? [`${state.bro}: whoa. whoa. whoa.`, `${state.bro}: can I hold it? just for a second? no? okay.`] : [
      `${state.bro}: ${state.name}... the booming is getting CLOSER.`,
      `${state.bro}: I'm not scared either. ${state.sis} said not to be.`,
      `${state.bro}: ...Is it okay if I stand behind you though.`,
    ]);
  }, { footY: 12 });

  npc("dog", 40, 128, "dog", () => say(state.kidnapped
    ? [`* ${state.dog} is standing at the top of the stairs, growling at nothing.`, `* ${state.dog} knows.`]
    : [`* ${state.dog} is under your bed. Only the tail is out.`, "* The tail says: no."]), { footY: 6 });

  wireTalk(player);
  hud();

  // the explosion, then the windows start flashing purple
  if (state.boomed) stormFlashes(windows);
  else {
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

scene("downstairs", () => {
  resetCam();
  save("downstairs");
  music.play(state.kidnapped ? "danger" : "night");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  wall(0, 0, W, 40, [150, 190, 220]);
  wall(0, 0, 8, H, [110, 80, 50]); wall(W - 8, 0, 8, H, [110, 80, 50]);
  wall(0, H - 8, W / 2 - 22, 8, [110, 80, 50]); wall(W / 2 + 22, H - 8, W / 2 - 22, 8, [110, 80, 50]);
  const windows = [{ x: 100, y: 8, w: 30, h: 22 }, { x: W - 110, y: 8, w: 30, h: 22 }];
  windows.forEach(drawWindow);
  stormFlashes(windows);
  // the front door, sealed purple until you have the key
  add([rect(44, 8), pos(W / 2 - 22, H - 8), color(60, 40, 20)]);
  add([rect(4, 4), pos(W / 2 + 12, H - 7), color(242, 208, 92)]);
  const seal = add([rect(48, 12), pos(W / 2 - 24, H - 12), color(199, 123, 214), opacity(0.4), z(3)]);
  seal.onUpdate(() => { seal.opacity = state.hasKey ? 0 : 0.3 + 0.25 * Math.abs(Math.sin(time() * 4)); });
  add([text("v", { size: 8 }), pos(W / 2, H - 16), anchor("center"), color(242, 208, 92)]);
  // stairs up
  add([rect(30, 28), pos(14, 40), color(110, 80, 50)]);
  for (let i = 0; i < 5; i++) add([rect(30, 1), pos(14, 42 + i * 5), color(70, 50, 30)]);
  add([text("^", { size: 8 }), pos(29, 72), anchor("center"), color(242, 208, 92)]);
  add([rect(30, 6), pos(14, 40), area(), "stairsup"]);
  // furniture
  wall(60, 120, 60, 30, [140, 100, 60]); add([rect(56, 4), pos(62, 118), color(170, 130, 90)]);
  wall(200, 70, 80, 30, [90, 110, 160]);
  wall(W - 60, 130, 50, 30, [110, 110, 122]);
  // knocked-over things from the break-in
  add([rect(10, 10), pos(140, 180), color(60, 40, 20), rotate(35)]);
  add([rect(14, 4), pos(180, 200), color(200, 80, 90), rotate(-15)]);

  const player = makePlayer(50, 84);

  npc("mom", W - 100, 140, "mom", () => {
    if (!state.talkedMom) {
      state.talkedMom = true; music.sfx("pickup");
      say([
        `Mom: ${state.name}! Oh thank goodness. Where are ${state.sis} and ${state.bro}?!`,
        "Mom: A CLOWN. A clown came through the door. Our DOOR.",
        "Mom: ...You have a sword. Why do you have a sword. Where did you get a sword.",
        `Mom: No. No time. Go. GO. Bring them home, ${state.name}.`,
        "Mom: Take these. Cookies heal you. Juice heals you all the way.",
        "* You got 3 Cookies and a Juice Box!",
      ]);
      return;
    }
    say([choose(MOM_LINES())]);
  }, { footY: 16 });

  npc("dad", W / 2 + 50, H - 76, "dad", () => {
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
  hud();

  player.onCollide("stairsup", () => { if (!dialogOpen) go("upstairs"); });
  add([rect(44, 6), pos(W / 2 - 22, H - 6), area(), "door"]);
  player.onCollide("door", () => {
    if (dialogOpen) return;
    if (!state.talkedMom || !state.talkedDad) { say(["* Mom and Dad are calling your name."]); player.pos.y -= 8; return; }
    if (!state.hasKey) { say(["* Locked. LYGON's purple seal hums on the handle.", `* Dad said the spare key is behind ${state.bro}'s bed.`]); player.pos.y -= 8; return; }
    music.sfx("unlock");
    say(["* The spare key turns. The purple seal pops like a soap bubble.", `* ${state.name} stepped out into the flashing night.`], () => { music.sfx("door"); go("town"); });
  });

  wait(0.3, () => say(["* The living room looks like a tornado came through.", "* The front door is glowing purple. Mom and Dad are both talking at once."]));
});

// ---------------------------------------------------------------- scene: town

scene("town", () => {
  resetCam();
  music.play("outside");
  save("town");
  add([rect(W, H), pos(0, 0), color(94, 170, 100)]);
  for (let i = 0; i < 120; i++) add([rect(1, 2), pos(rand(0, W), rand(0, H)), color(70, 140, 80)]);
  add([rect(40, H), pos(W / 2 - 20, 0), color(214, 190, 140)]);
  add([rect(W, 34), pos(0, H - 48), color(214, 190, 140)]);
  wall(0, 0, 6, H); wall(W - 6, 0, 6, H); wall(0, H - 6, W, 6);
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

  const player = makePlayer(W / 2 - 11, H - 44);

  // the cave mouth at the top of the hill, right behind the wreck
  add([sprite("cavemouth"), pos(W / 2 - 24, 0), anchor("topleft"), z(1)]);
  const cglow = add([rect(30, 20), pos(W / 2 - 15, 14), color(199, 123, 214), opacity(0.2), z(2)]);
  cglow.onUpdate(() => { cglow.opacity = 0.12 + 0.12 * Math.abs(Math.sin(time() * 2.5)); });
  add([rect(24, 8), pos(W / 2 - 12, 26), area(), "cavezone"]);
  player.onCollide("cavezone", () => {
    if (dialogOpen) return;
    if (state.cave === 0 && !state.beatBugon) {
      say([
        "* A cave. The wagon crashed right into the mouth of it.",
        `* From inside: circus music, laughing, and two small voices yelling "${state.name}!!"`,
        `* ${state.name} drew the sword and went in.`,
      ], () => go("cave"));
    } else go("cave");
  });

  npc("elder", 90, H - 50, "elder", () => say(state.cave > 0 ? [
    `Old Man: Still in one piece? You've beaten ${state.cave} of the clown's critters, by my count.`,
    "Old Man: The big-eared one guards the inner door. Then it's the clown himself.",
  ] : [
    "Old Man: Sixty years on this hill. Never once has a CIRCUS fallen on it.",
    "Old Man: The clown dragged your kin into the cave. His whole freak show lives in there.",
    "Old Man: You've got a sword. That's more than I had at your age. Go on.",
  ]), { footY: 16 });

  npc("kid", W - 110, H - 50, "kid", () => say(state.cave > 0 ? [
    "Kid: You went IN there?! And came back OUT?!",
    "Kid: Everyone says there's robots in that cave. And aliens. And a toad with too many teeth.",
  ] : [
    "Kid: I saw the clown carry two kids up the hill. One of them bit him.",
    `Kid: You gonna go up there, ${state.name}? Can I watch from here?`,
    "Kid: PSI Ice freezes stuff, by the way. My cousin told me. He knows things.",
  ]), { footY: 14 });

  const dog = npc("dog", 200, 120, "dog", () => say([`* ${state.dog} followed you out. ${state.dog} is not supposed to be outside.`, `* ${state.dog} looks at the hill, then at you, very seriously.`, "* Woof."]), { footY: 6 });
  let dogT = 0;
  dog.onUpdate(() => { dogT += dt(); dog.pos.x = 200 + Math.sin(dogT * 0.7) * 14; });

  wireTalk(player);
  hud();

  wait(0.3, () => say(state.cave > 0
    ? ["* The cave is still humming. Your family is still in there."]
    : ["* The air smells like popcorn and lightning.", "* Up the path, a cave is glowing purple."]));
});

// ---------------------------------------------------------------- scene: cave

scene("cave", (opts = {}) => {
  resetCam();
  save("cave");
  music.play("cave");
  window.__frozen = false;
  // roll the fork once per run
  if (!state.branchSide) { state.branchSide = choose(["left", "right"]); state.branchEnemy = choose(CAVE_ENEMIES); save("cave"); }
  const BRANCH = 3; // the fork leaves the main tunnel at this segment (after two fights)

  // rock
  add([rect(W, CAVE_H), pos(0, 0), color(38, 32, 54)]);
  for (let i = 0; i < 260; i++) add([rect(rand(2, 5), rand(2, 4)), pos(rand(0, W), rand(0, CAVE_H)), color(52, 44, 72)]);
  // winding path: alternating offsets, 44 wide
  const segs = [];
  for (let y = CAVE_H; y > 0; y -= 100) {
    const off = Math.sin(y / 100) * 60;
    segs.push({ x: W / 2 - 22 + off, y: y - 100, w: 44, h: 100 });
  }
  const FLOOR = [96, 84, 112];
  segs.forEach((sg, i) => {
    add([rect(sg.w, sg.h), pos(sg.x, sg.y), color(...FLOOR), z(1)]);
    if (segs[i + 1]) {
      const a = Math.min(sg.x, segs[i + 1].x), b = Math.max(sg.x, segs[i + 1].x) + 44;
      add([rect(b - a, 30), pos(a, sg.y - 15), color(...FLOOR), z(1)]);
    }
  });
  // the fork: two corridors and two rooms off the branch segment
  const bs = segs[BRANCH];
  const corrY = bs.y + 38, corrH = 26;
  // two corridors run off the screen; where they go is only visible once you walk there
  add([rect(bs.x, corrH), pos(0, corrY), color(...FLOOR), z(1)]);
  add([rect(W - (bs.x + 44), corrH), pos(bs.x + 44, corrY), color(...FLOOR), z(1)]);
  add([rect(6, corrH), pos(0, corrY), area(), "sideL"]);
  add([rect(6, corrH), pos(W - 6, corrY), area(), "sideR"]);

  // walls: rock on both sides of every segment, connector band, and around the fork
  segs.forEach((sg, i) => {
    const nx = segs[i + 1] ? segs[i + 1].x : sg.x;
    const L = Math.min(sg.x, nx) - 2, R = Math.max(sg.x, nx) + 46;
    if (i === BRANCH) {
      // rock above and below both corridors, built from the fork segment's own edges
      const bl = sg.x - 2, br = sg.x + 46;
      wall(0, sg.y + 15, bl, corrY - (sg.y + 15)); wall(0, corrY + corrH, bl, sg.y + 85 - (corrY + corrH));
      wall(br, sg.y + 15, W - br, corrY - (sg.y + 15)); wall(br, corrY + corrH, W - br, sg.y + 85 - (corrY + corrH));
    } else {
      wall(0, sg.y + 15, L, sg.h - 30);
      wall(R, sg.y + 15, W - R, sg.h - 30);
    }
    if (segs[i + 1]) { wall(0, sg.y - 15, Math.min(sg.x, nx), 30); wall(Math.max(sg.x, nx) + 44, sg.y - 15, W - (Math.max(sg.x, nx) + 44), 30); }
  });
  wall(0, CAVE_H - 4, W, 4); wall(0, 0, W, 4);
  // torches
  segs.forEach((sg, i) => {
    if (i % 2) return;
    const t = add([rect(3, 6), pos(sg.x - 8, sg.y + 40), color(255, 160, 64), z(2)]);
    const glow = add([rect(40, 40), pos(sg.x - 26, sg.y + 22), color(255, 190, 90), opacity(0.08), z(0)]);
    t.onUpdate(() => { t.color = rgb(255, 130 + rand(0, 60), 40); glow.opacity = 0.06 + rand(0, 0.04); });
  });

  const start = segs[0];
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
  player.onUpdate(() => { camPos(W / 2, Math.max(H / 2, Math.min(CAVE_H - H / 2, player.pos.y + 16))); });

  // encounters, one per bend, in order
  CAVE_ENEMIES.forEach((name, i) => {
    if (i < state.cave) return;
    const sg = segs[i >= 2 ? i + 2 : i + 1];
    const e = add([sprite(name), pos(sg.x + 22, sg.y + 50), anchor("center"), z(5), area({ shape: new Rect(vec2(-22, -20), 44, 40) }), "enc"]);
    e.enemyIndex = i; e.enemyName = name;
    const by = sg.y + 50;
    e.onUpdate(() => { e.pos.y = by + Math.sin(time() * 3 + i) * 2; });
  });
  player.onCollide("enc", (e) => {
    if (dialogOpen) return;
    player.pos.y += 12;
    if (e.enemyIndex !== state.cave) return;
    say(ENEMIES[e.enemyName].meet, () => go("battle", e.enemyName));
  });

  // the fork itself: a one-time signpost
  add([rect(44, 10), pos(bs.x, corrY + 8), area(), "forkzone"]);
  player.onCollide("forkzone", () => {
    if (dialogOpen || state.branchSeen) return;
    state.branchSeen = true;
    say(["* The tunnel forks. A passage goes left, and one goes right.", "* One of them smells like cotton candy. The other smells like trouble.", "* You can't tell which is which."]);
  });

  // Bugon guards the way to the chamber once the six are down
  if (state.cave >= CAVE_ENEMIES.length && !state.beatBugon) {
    const sg = segs[8];
    const b = add([sprite("bugon"), pos(sg.x + 22, sg.y + 40), anchor("center"), z(5), area({ shape: new Rect(vec2(-24, -22), 48, 44) }), "bugonzone"]);
    b.onUpdate(() => { b.pos.y = sg.y + 40 + Math.abs(Math.sin(time() * 4)) * -3; });
    player.onCollide("bugonzone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.bugon.meet, () => go("battle", "bugon")); });
  }
  // Lygon waits at the top of the tunnel once Bugon is gone; no door, just him
  if (state.beatBugon) {
    const top = segs[segs.length - 1];
    const spot = add([rect(70, 40), pos(top.x - 13, 6), color(199, 123, 214), opacity(0.15), z(0)]);
    spot.onUpdate(() => { spot.opacity = 0.1 + 0.12 * Math.abs(Math.sin(time() * 3)); });
    const ly = add([sprite("lygon"), pos(top.x + 22, 30), anchor("center"), z(5), area({ shape: new Rect(vec2(-22, -22), 44, 44) }), "lygonzone"]);
    ly.onUpdate(() => { ly.pos.y = 30 + Math.sin(time() * 2) * 2; });
    player.onCollide("lygonzone", () => { if (dialogOpen) return; player.pos.y += 12; say(ENEMIES.lygon.meet, () => go("battle", "lygon")); });
  }

  // the very bottom of the tunnel is the way out
  add([rect(60, 16), pos(start.x - 8, CAVE_H - 18), area(), "caveexit"]);
  player.onCollide("caveexit", () => { if (!dialogOpen) go("town"); });

  player.onCollide("sideL", () => { if (!dialogOpen) go("sideroom", { side: "left" }); });
  player.onCollide("sideR", () => { if (!dialogOpen) go("sideroom", { side: "right" }); });
  hud();
  const fights = CAVE_ENEMIES.length - state.cave;
  wait(0.3, () => say(state.cave === 0
    ? ["* It's dark. It smells like wet rock and cotton candy.", "* Something is chittering up ahead."]
    : state.beatBugon ? ["* The way to the top is open. He's up there. So are they."]
    : [`* ${fights} of the clown's critters left between you and the big-eared one.`]));
});

// ---------------------------------------------------------------- scene: side room
// Off the fork. One side holds a present, the other an ambush; which is which is rolled per run.
scene("sideroom", (opts = {}) => {
  resetCam();
  music.play("cave");
  window.__frozen = false;
  const side = opts.side || "left";
  const entryRight = side === "left"; // walking off the left edge of the tunnel puts you on this room's right edge
  add([rect(W, H), pos(0, 0), color(38, 32, 54)]);
  for (let i = 0; i < 90; i++) add([rect(rand(2, 5), rand(2, 4)), pos(rand(0, W), rand(0, H)), color(52, 44, 72)]);
  const room = { x: 60, y: 50, w: 200, h: 140 };
  add([rect(room.w, room.h), pos(room.x, room.y), color(86, 74, 104), z(1)]);
  const doorY = room.y + room.h / 2 - 13, doorH = 26;
  // the way you came in: a short corridor to the screen edge
  if (entryRight) add([rect(W - (room.x + room.w), doorH), pos(room.x + room.w, doorY), color(96, 84, 112), z(1)]);
  else add([rect(room.x, doorH), pos(0, doorY), color(96, 84, 112), z(1)]);
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
  for (const [tx, ty] of [[room.x + 8, room.y + 8], [room.x + room.w - 12, room.y + 8]]) {
    const t = add([rect(3, 6), pos(tx, ty), color(255, 160, 64), z(2)]);
    t.onUpdate(() => { t.color = rgb(255, 130 + rand(0, 60), 40); });
  }

  const px = entryRight ? W - 40 : 18, py = doorY - 14;
  const player = makePlayer(px, py);
  player.onCollide("back", () => { if (!dialogOpen && !window.__frozen) go("cave", { resume: true, at: "branch" }); });

  const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
  if (side === state.branchSide) {
    // the present: a Giant Sword
    if (!state.giantSword) {
      const pr = add([sprite("present"), pos(cx - 8, cy - 8), anchor("topleft"), area(), body({ isStatic: true }), z(8), "npc", "present2"]);
      const sp = add([text("*", { size: 8 }), pos(cx, cy - 16), anchor("center"), color(242, 208, 92), z(9)]);
      sp.onUpdate(() => { sp.hidden = Math.floor(time() * 4) % 3 === 0; sp.pos.x = cx + Math.sin(time() * 5) * 10; });
      pr.talk = () => {
        say(["* A present. Down here. With a bow on it.", "* You tear off the paper.", "* ..."], () => {
          destroy(pr); destroy(sp); state.giantSword = true; music.sfx("pickup"); save("cave");
          const sw = add([sprite("sword"), pos(player.pos.x + 11, player.pos.y - 30), anchor("center"), scale(2), z(60)]);
          sw.onUpdate(() => { sw.pos.y -= 6 * dt(); sw.angle = Math.sin(time() * 6) * 5; });
          const flare = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.7), z(55), fixed()]);
          flare.onUpdate(() => { flare.opacity = Math.max(0, flare.opacity - 1.2 * dt()); });
          shake(8);
          wait(1.4, () => { destroy(sw); say([`* ${state.name} got the GIANT SWORD!`, "* It is much, much bigger than the other sword.", "* Slash now hits a LOT harder."]); });
        });
      };
      wait(0.3, () => say(["* A small room. It smells like cotton candy.", "* Something in the middle is sparkling."]));
    } else wait(0.3, () => say(["* The room where you found the Giant Sword. Just torn wrapping paper now."]));
  } else {
    // the ambush: it sees you first and walks straight at you
    if (!state.branchDone) {
      const far = entryRight ? room.x + 30 : room.x + room.w - 30;
      const foe = add([sprite(state.branchEnemy), pos(far, cy), anchor("center"), z(6), "ambusher"]);
      let sprung = false;
      foe.onUpdate(() => {
        if (!sprung) { foe.pos.y = cy + Math.sin(time() * 3) * 2; return; }
        const target = player.pos.add(11, 16);
        const d = target.sub(foe.pos);
        if (d.len() > 26) foe.pos = foe.pos.add(d.unit().scale(70 * dt()));
        else if (window.__frozen) {
          window.__frozen = false; sprung = false; foe.paused = true;
          say(["* It saw you first. It's already moving.", "* There's nowhere to go but through it."], () => go("battle", "ambush"));
        }
      });
      wait(0.6, () => { sprung = true; window.__frozen = true; music.play("danger"); music.sfx("bang"); });
    } else wait(0.3, () => say(["* The room where that thing jumped you. Empty now.", "* Still smells like trouble."]));
  }
  hud();
});


// ---------------------------------------------------------------- scene: battle

const ENEMIES = {
  chompo: {
    name: "CHOMPO", spr: "chompo", hp: 16, weak: "ice", bg: [30, 50, 60], band: [40, 70, 80],
    meet: ["* A pink toad with far too many teeth hops into the path.", "CHOMPO: chomp?"],
    intro: ["* CHOMPO wants to bite something!"],
    attacks: [{ t: "chomped at %n!", d: [2, 4] }, { t: "licked its own eye.", d: [0, 0] }],
    win: ["* CHOMPO burped and hopped away."], small: true,
  },
  zagg: {
    name: "ZAGG", spr: "zagg", hp: 20, weak: "fire", bg: [30, 40, 70], band: [40, 55, 95],
    meet: ["* A blue thing with one enormous eye and a zigzag grin blocks the way.", "ZAGG: zzzzZZAGG."],
    intro: ["* ZAGG is grinning. It has a LOT of grin."],
    attacks: [{ t: "grinned at %n! It's very unsettling.", d: [2, 5] }, { t: "blinked. Slowly.", d: [0, 0] }],
    win: ["* ZAGG's grin got smaller and smaller until it left."], small: true,
  },
  skitter: {
    name: "SKITTER", spr: "skitter", hp: 22, weak: "ice", bg: [50, 35, 60], band: [70, 50, 85],
    meet: ["* Something low and clicky scuttles out of the dark, headlamp swinging.", "SKITTER: bzzt. INTRUDER."],
    intro: ["* SKITTER's headlamp is pointed right at you!"],
    attacks: [{ t: "zapped %n with its headlamp!", d: [3, 5] }, { t: "scuttled in a circle.", d: [0, 0] }],
    win: ["* SKITTER's little legs gave out. It rolled away."], small: true,
  },
  wibblo: {
    name: "WIBBLO", spr: "wibblo", hp: 24, weak: "fire", bg: [60, 30, 60], band: [85, 45, 85],
    meet: ["* A pink blob with three eyes and two wiggly antennae drifts down.", "WIBBLO: wibble wibble."],
    intro: ["* WIBBLO's antennae are wiggling menacingly!"],
    attacks: [{ t: "bonked %n with an antenna!", d: [3, 6] }, { t: "wibbled.", d: [0, 0] }],
    win: ["* WIBBLO wibbled off in a huff."], small: true,
  },
  redstack: {
    name: "REDSTACK", spr: "redstack", hp: 28, weak: "ice", bg: [70, 25, 30], band: [95, 40, 45],
    meet: ["* A tall red robot unfolds from the wall, segment by segment.", "REDSTACK: HALT. TICKETS PLEASE."],
    intro: ["* REDSTACK is stacking up!"],
    attacks: [{ t: "swung a claw at %n!", d: [3, 6] }, { t: "checked %n for a ticket. Found none.", d: [1, 3] }],
    win: ["* REDSTACK toppled over one segment at a time. Clonk. Clonk. Clonk."], small: true,
  },
  boxor: {
    name: "BOXOR", spr: "boxor", hp: 36, weak: "fire", bg: [55, 30, 65], band: [80, 45, 90],
    meet: ["* A huge boxy robot with one red eye fills the tunnel.", "BOXOR: I AM THE OPENING ACT."],
    intro: ["* BOXOR's red eye lit up!", "BOXOR: NO REFUNDS."],
    attacks: [{ t: "fired an eye beam at %n!", d: [4, 7] }, { t: "stomped! The cave shook!", d: [3, 5] }, { t: "rebooted.", d: [0, 0] }],
    win: ["* BOXOR's eye flickered out.", "BOXOR: ...intermission."], small: true,
  },
  bugon: {
    name: "BUGON", spr: "bugon", hp: 45, weak: "ice", bg: [60, 30, 90], band: [90, 50, 130],
    meet: ["* The thing guarding the inner door has ears like two dinner plates.", "BUGON: FLAP FLAP FLAP!!", `* ${state.name} tightened the grip on the sword.`],
    intro: ["* BUGON flapped out in front of you!", "* Its ears are making a lot of wind."],
    attacks: [
      { t: "flapped its giant ears at %n!", d: [2, 5] },
      { t: "stomped its little yellow feet!", d: [3, 6] },
      { t: "tried to look scary.", d: [0, 0] },
    ],
    win: ["* BUGON flopped over and went 'flap'.", "* It scurried off, ears drooping. The inner door creaks open."],
    next: () => { state.beatBugon = true; state.hp = state.maxHp; state.pp = state.maxPp; go("cave", { resume: true }); },
  },
  lygon: {
    name: "LYGON", spr: "lygon", hp: 80, weak: "fire", bg: [90, 30, 40], band: [130, 50, 60],
    meet: ["* The chamber is lit like a circus ring. Two cages hang from the ceiling.", `${state.sis}: ${state.name}!!`, `${state.bro}: ${state.name}!!!`, "LYGON: Aaaand here's our volunteer! Hee hee hee!", `* ${state.name} did not buy a ticket.`],
    intro: ["* LYGON stepped into the spotlight!", "LYGON: Hee hee hee. Let's give them a SHOW!"],
    attacks: [
      { t: "honked a horn right in %n's face!", d: [3, 7] },
      { t: "threw a pie! SPLAT!", d: [4, 8] },
      { t: "juggled menacingly.", d: [0, 0] },
      { t: "laughed. It went on for a while.", d: [2, 4] },
    ],
    win: ["LYGON: ...no encore?", "* LYGON folded up like a lawn chair and vanished in a puff of confetti.", "* Two cage doors swung open."],
    next: () => go("end"),
  },
};

const PSI = [
  { name: "Fire", pp: 6, dmg: [12, 16], kind: "fire", verb: "used PSI Fire! Whoosh!" },
  { name: "Ice", pp: 6, dmg: [10, 14], kind: "ice", verb: "used PSI Ice! Brrr!", freeze: true },
  { name: "Starstorm", pp: 14, dmg: [22, 30], kind: "star", verb: "used PSI STARSTORM!!" },
];

scene("battle", (which) => {
  resetCam();
  window.__frozen = false;
  let def = ENEMIES[which];
  if (which === "ambush") {
    const base = ENEMIES[state.branchEnemy];
    def = { ...base, name: "WILD " + base.name, hp: base.hp + 8, small: true,
      intro: [`* A WILD ${base.name} got the jump on you!`],
      win: [`* The WILD ${base.name} ran off into the dark.`, "* The side room is quiet now."],
      next: () => { state.branchDone = true; state.hp = Math.min(state.maxHp, state.hp + 10); state.pp = Math.min(state.maxPp, state.pp + 6); go("cave", { resume: true, at: "branch" }); } };
  }
  music.sfx("battle_start");
  music.play(def.small ? "battle" : "boss");
  const boss = { name: def.name, hp: def.hp, maxHp: def.hp, frozen: 0 };
  let busy = true;
  let menu = 0, sub = null, subIdx = 0;
  const OPTIONS = ["Slash", "PSI", "Item", "Run"];

  add([rect(W, H), pos(0, 0), color(...def.bg)]);
  const bands = [];
  for (let i = 0; i < 12; i++) bands.push(add([rect(W, 10), pos(0, i * 20), color(...def.band), opacity(0.5), z(1)]));
  onUpdate(() => bands.forEach((b, i) => { b.pos.y = ((i * 20 + time() * 25) % (H + 20)) - 10; }));

  const bossSpr = add([sprite(def.spr), pos(W / 2, 88), anchor("center"), scale(2), z(5)]);
  bossSpr.onUpdate(() => { if (!busy && !boss.frozen) bossSpr.pos.y = 88 + Math.sin(time() * 3) * 2; });
  const frost = add([rect(90, 84), pos(W / 2, 88), anchor("center"), color(51, 199, 193), opacity(0), z(6)]);
  frost.onUpdate(() => { frost.opacity = boss.frozen > 0 ? 0.35 : 0; });
  // captive siblings in the final fight
  if (which === "lygon") {
    add([sprite("sis"), pos(40, 60), anchor("topleft"), z(4)]);
    add([sprite("bro"), pos(W - 60, 60), anchor("topleft"), z(4)]);
    [40, W - 60].forEach((x) => { for (let i = 0; i < 4; i++) add([rect(1, 30), pos(x - 2 + i * 6, 56), color(140, 140, 150), z(5)]); });
  }

  // player panel
  const PY = H - 54; // panels hug the bottom edge, clear of the enemy name and HP bar
  add([rect(110, 46, { radius: 3 }), pos(10, PY), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  add([text(state.name, { size: 8 }), pos(18, PY + 8), color(242, 208, 92), z(21)]);
  const hpT = add([text("", { size: 8 }), pos(18, PY + 20), color(232, 232, 240), z(21)]);
  const ppT = add([text("", { size: 8 }), pos(18, PY + 31), color(51, 199, 193), z(21)]);
  let shownHp = state.hp;
  hpT.onUpdate(() => {
    shownHp += Math.sign(state.hp - shownHp) * Math.min(Math.abs(state.hp - shownHp), 30 * dt());
    hpT.text = `HP ${Math.round(shownHp)}/${state.maxHp}`;
    ppT.text = `PP ${state.pp}/${state.maxPp}`;
  });

  add([rect(100, 6), pos(W / 2 - 50, 154), color(20, 20, 36), outline(1, rgb(232, 232, 240)), z(20)]);
  const ebar = add([rect(100, 6), pos(W / 2 - 50, 154), color(224, 69, 63), z(21)]);
  ebar.onUpdate(() => { ebar.width = 100 * Math.max(0, boss.hp) / boss.maxHp; });
  add([text(boss.name, { size: 8 }), pos(W / 2, 144), anchor("center"), color(232, 232, 240), z(21)]);
  if (def.small && which !== "ambush") add([text(`cave ${state.cave + 1} / ${CAVE_ENEMIES.length}`, { size: 8 }), pos(W - 12, 8), anchor("topright"), color(207, 207, 216), z(21)]);

  const menuBox = add([rect(180, 46, { radius: 3 }), pos(130, PY), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  const slots = [0, 1, 2, 3].map((i) => add([text("", { size: 8 }), pos(146 + (i % 2) * 80, PY + 10 + Math.floor(i / 2) * 16), color(232, 232, 240), z(21)]));
  const cursor = add([text(">", { size: 8 }), pos(0, 0), color(242, 208, 92), z(22)]);
  const hint = add([text("", { size: 8 }), pos(220, PY - 10), anchor("center"), color(207, 207, 216), z(22)]);

  function labels() {
    if (sub === "psi") return PSI.map((p) => `${p.name} ${p.pp}`).concat(["Back"]);
    if (sub === "item") return [`Cookie x${state.cookies}`, `Juice x${state.juice}`, "Back", ""];
    return OPTIONS;
  }
  onUpdate(() => {
    const hide = busy || dialogOpen;
    menuBox.hidden = hide; cursor.hidden = hide; hint.hidden = hide;
    const L = labels();
    slots.forEach((s, i) => { s.hidden = hide; s.text = L[i] || ""; });
    cursor.pos = slots[sub ? subIdx : menu].pos.add(-9, 0);
    hint.text = sub === "psi" ? `${boss.name} hates ${def.weak.toUpperCase()}!` : sub === "item" ? "Cookie +15   Juice = full" : "";
  });

  function nav(dx, dy) {
    if (busy || dialogOpen) return;
    const L = labels().filter((x) => x);
    let idx = sub ? subIdx : menu;
    if (dx === -1 && idx % 2 === 1) idx -= 1;
    if (dx === 1 && idx % 2 === 0 && idx + 1 < L.length) idx += 1;
    if (dy === -1 && idx >= 2) idx -= 2;
    if (dy === 1 && idx + 2 < L.length) idx += 2;
    if (idx !== (sub ? subIdx : menu)) music.sfx("move");
    if (sub) subIdx = idx; else menu = idx;
  }
  ["left", "a", "4"].forEach((k) => onKeyPress(k, () => nav(-1, 0)));
  ["right", "d", "6"].forEach((k) => onKeyPress(k, () => nav(1, 0)));
  ["up", "w", "8"].forEach((k) => onKeyPress(k, () => nav(0, -1)));
  ["down", "s", "2"].forEach((k) => onKeyPress(k, () => nav(0, 1)));
  BACK.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen && sub) { sub = null; subIdx = 0; music.sfx("back"); } }));
  INTERACT.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen) confirm(); }));

  function confirm() {
    if (sub === "psi") {
      if (subIdx === 3) { sub = null; subIdx = 0; music.sfx("back"); return; }
      const p = PSI[subIdx];
      if (state.pp < p.pp) { music.sfx("back"); say([`* Not enough PP for ${p.name}. (needs ${p.pp})`]); return; }
      sub = null; subIdx = 0; busy = true;
      music.sfx("psi_" + p.kind);
      state.pp -= p.pp;
      let dmg = randi(p.dmg[0], p.dmg[1]);
      const weak = p.kind === def.weak;
      if (weak) dmg = Math.round(dmg * 1.5);
      if (p.kind === "star") {
        shake(20);
        for (let i = 0; i < 14; i++) add([text("*", { size: 12 }), pos(rand(40, W - 40), rand(-10, 60)), color(242, 208, 92), z(40), lifespan(0.6), move(DOWN, 200)]);
      }
      if (p.kind === "fire") for (let i = 0; i < 10; i++) add([rect(3, 3), pos(W / 2 + rand(-30, 30), 88 + rand(-30, 30)), color(239, 143, 60), z(40), lifespan(0.5), move(UP, rand(40, 90))]);
      if (p.freeze && Math.random() < 0.6) boss.frozen = 1;
      hitBoss(dmg, p.verb + (weak ? " SUPER effective!" : "") + (p.freeze && boss.frozen ? ` ${boss.name} is frozen solid!` : ""));
      return;
    }
    if (sub === "item") {
      if (subIdx === 2) { sub = null; subIdx = 0; music.sfx("back"); return; }
      if (subIdx === 0) {
        if (state.cookies <= 0) { music.sfx("back"); say(["* No cookies left!"]); return; }
        music.sfx("heal");
        state.cookies -= 1; const heal = Math.min(state.maxHp - state.hp, 15); state.hp += heal;
        sub = null; busy = true; say([`* ${state.name} ate a Cookie. +${heal} HP!`], enemyTurn); return;
      }
      if (state.juice <= 0) { music.sfx("back"); say(["* No juice left!"]); return; }
      music.sfx("heal");
      state.juice -= 1; const heal = state.maxHp - state.hp; state.hp = state.maxHp;
      sub = null; busy = true; say([`* ${state.name} drank the Juice Box. +${heal} HP! Full health!`], enemyTurn); return;
    }
    const o = OPTIONS[menu];
    music.sfx("select");
    if (o === "PSI") { sub = "psi"; subIdx = 0; return; }
    if (o === "Item") { sub = "item"; subIdx = 0; return; }
    busy = true;
    if (o === "Slash") {
      music.sfx("slash");
      const crit = Math.random() < 0.2;
      const dmg = (state.giantSword ? randi(12, 18) : randi(8, 12)) * (crit ? 2 : 1);
      add([rect(state.giantSword ? 70 : 40, state.giantSword ? 5 : 3), pos(W / 2, 88), anchor("center"), color(244, 241, 234), rotate(-40), z(40), lifespan(0.15)]);
      hitBoss(dmg, state.giantSword ? (crit ? "swung the GIANT SWORD in a huge arc!" : "swung the GIANT SWORD!") : (crit ? "did a HUGE spinning slash!" : "slashed with the sword!"));
    } else if (o === "Run") {
      say(["* You tried to run.", `* Then you remembered ${state.sis} and ${state.bro}. You did not run.`], enemyTurn);
    }
  }

  if (def.small && !def.next) def.next = () => {
    state.cave += 1;
    state.hp = Math.min(state.maxHp, state.hp + 12);
    state.pp = Math.min(state.maxPp, state.pp + 8);
    if (state.cave % 2 === 0) state.cookies += 1;
    go("cave", { resume: true });
  };
  function hitBoss(dmg, verb) {
    boss.hp -= dmg; music.sfx("hit");
    shake(8);
    add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.5), z(50), lifespan(0.08)]);
    bossSpr.pos.x = W / 2 + 6;
    wait(0.08, () => bossSpr.pos.x = W / 2);
    add([text(`${dmg}`, { size: 14 }), pos(W / 2 + rand(-20, 20), 50), anchor("center"), color(242, 208, 92), z(45), lifespan(0.8), move(UP, 30)]);
    const lines = [`* ${state.name} ${verb} ${dmg} damage to ${boss.name}!`];
    if (boss.hp <= 0) { music.sfx("win"); say(lines.concat(def.win).concat(def.small ? ["* You feel a little stronger. +12 HP, +8 PP" + (state.cave % 2 === 1 ? ", and you found a Cookie!" : "!")] : []), def.next); }
    else say(lines, enemyTurn);
  }

  function enemyTurn() {
    if (boss.frozen > 0) { boss.frozen -= 1; say([`* ${boss.name} is frozen and can't move!`], () => busy = false); return; }
    const a = choose(def.attacks);
    const dmg = a.d[1] === 0 ? 0 : randi(a.d[0], a.d[1]);
    const line = `* ${boss.name} ${a.t.replace("%n", state.name)}` + (dmg > 0 ? ` ${dmg} damage to ${state.name}!` : " Nothing happened.");
    if (dmg > 0) { state.hp = Math.max(0, state.hp - dmg); shake(dmg > 6 ? 14 : 8); music.sfx("hurt"); }
    if (state.hp <= 0) {
      music.sfx("lose");
      say([line, `* ${state.name} got knocked flat.`, "* ...", `* Mom's voice: "${state.name}! Get UP!"`, "* You got up. You still have a job to do."],
        () => { state.hp = state.maxHp; state.pp = state.maxPp; state.cookies = Math.max(state.cookies, 2); state.juice = Math.max(state.juice, 1); go("cave", which === "ambush" ? { resume: true, at: "branch" } : { resume: true, lost: true }); });
    } else say([line], () => busy = false);
  }

  wait(0.2, () => say(def.intro, () => busy = false));
});

// ---------------------------------------------------------------- scene: end

scene("end", () => {
  resetCam();
  music.play("finis");
  add([rect(W, H), pos(0, 0), color(11, 11, 20)]);
  for (let i = 0; i < 60; i++) {
    const c = add([rect(2, 3), pos(rand(0, W), rand(-H, 0)), color(...choose([[224, 69, 63], [242, 208, 92], [58, 111, 216], [79, 176, 106], [199, 123, 214]])), z(1)]);
    const sp = rand(20, 50);
    c.onUpdate(() => { c.pos.y += sp * dt(); c.pos.x += Math.sin(time() * 3 + i) * 0.3; if (c.pos.y > H) c.pos.y = -5; });
  }
  add([sprite("hero_sword"), pos(W / 2, 60), anchor("center"), z(5)]);
  add([sprite("sis"), pos(W / 2 - 30, 64), anchor("center"), z(5)]);
  add([sprite("bro"), pos(W / 2 + 30, 64), anchor("center"), z(5)]);
  add([sprite("dog"), pos(W / 2 - 56, 76), anchor("center"), z(5)]);
  add([text("YOU SAVED THEM!", { size: 20 }), pos(W / 2, 108), anchor("center"), color(242, 208, 92), z(5)]);
  add([text(`${state.name} rescued ${state.sis} and ${state.bro}!`, { size: 8 }), pos(W / 2, 132), anchor("center"), color(232, 232, 240), z(5)]);
  add([text(`${state.sis}: "I wasn't scared."\n${state.bro}: "I was a little scared."`, { size: 8, align: "center", lineSpacing: 3 }), pos(W / 2, 156), anchor("center"), color(207, 207, 216), z(5)]);
  add([text(`${state.dog} was a very good dog the whole time.`, { size: 8 }), pos(W / 2, 182), anchor("center"), color(138, 138, 153), z(5)]);
  add([text("~ to be continued ~", { size: 8 }), pos(W / 2, 200), anchor("center"), color(138, 138, 153), z(5)]);
  add([text("press SPACE to play again", { size: 8 }), pos(W / 2, 220), anchor("center"), color(242, 208, 92), z(5)]);
  clearSave();
  INTERACT.forEach((k) => onKeyPress(k, () => { Object.assign(state, START); go("title", { fresh: true }); }));
});

go("title");
