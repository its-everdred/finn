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
  hasSword: false, kidnapped: false, talkedSis: false, talkedBro: false, talkedMom: false,
  beatBugon: false, hp: 40, pp: 30, cookies: 3, juice: 1,
};
const state = { name: "Finn", sis: "Lily", bro: "Max", cat1: "Pumpkin", cat2: "Smoke", maxHp: 40, maxPp: 30, ...START };

// space is the main button; "/" is back. z and enter also confirm.
const SAVE_KEY = "restorebound.save.v1";
function save(sceneName) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ scene: sceneName, state })); } catch (e) { /* private mode etc. */ }
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
// The page's Restart button calls this.
window.restoreboundRestart = () => { clearSave(); Object.assign(state, START); go("title", { fresh: true }); };

const INTERACT = ["space", "z", "enter"];
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
    if (dialogOpen) return;
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
    let best = null, bestD = 30;
    get("npc").forEach((n) => {
      const d = me.dist(n.pos.add(n.width / 2, n.height - 4));
      if (d < bestD) { bestD = d; best = n; }
    });
    if (best) best.talk();
  }));
}

function hud() {
  const t = add([text("", { size: 8 }), pos(10, 6), color(232, 232, 240), z(50), fixed()]);
  t.onUpdate(() => { t.text = `${state.name}  HP ${state.hp}/${state.maxHp}  PP ${state.pp}/${state.maxPp}`; });
}

// purple lightning through a window: flashes + a rumble
function stormFlashes(windowRect) {
  const glow = add([rect(windowRect.w, windowRect.h), pos(windowRect.x, windowRect.y), color(199, 123, 214), opacity(0), z(3)]);
  const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0), z(90), fixed()]);
  function flash() {
    glow.opacity = 0.9; wash.opacity = 0.35; shake(rand(4, 12));
    wait(0.08, () => { glow.opacity = 0.4; wash.opacity = 0.12; });
    wait(0.16, () => { glow.opacity = 0.0; wash.opacity = 0; });
    if (Math.random() < 0.5) wait(0.25, () => { glow.opacity = 0.7; wash.opacity = 0.25; wait(0.08, () => { glow.opacity = 0; wash.opacity = 0; }); });
  }
  loop(rand(1.2, 2.4), flash);
  wait(0.3, flash);
}

// ---------------------------------------------------------------- scene: title + naming

scene("title", (opts = {}) => {
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
    ["left", "a", "4", "right", "d", "6"].forEach((k) => onKeyPress(k, () => { pick = 1 - pick; }));
    INTERACT.forEach((k) => onKeyPress(k, () => {
      if (pick === 0) { Object.assign(state, saved.state); go(saved.scene); }
      else { clearSave(); Object.assign(state, START); go("title", { fresh: true }); }
    }));
    return;
  }

  const prompts = [
    ["name", "What is YOUR name?"],
    ["bro", "Your little brother's name?"],
    ["sis", "Your little sister's name?"],
    ["cat1", "Your first cat's name?"],
    ["cat2", "Your second cat's name?"],
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
  onCharInput((ch) => {
    if (state[key()].length >= 10) return;
    if (/^[a-zA-Z0-9 ]$/.test(ch)) { state[key()] += ch; nameTxt.text = state[key()]; }
  });
  onKeyPress("backspace", () => { state[key()] = state[key()].slice(0, -1); nameTxt.text = state[key()]; });
  onKeyPress("enter", () => {
    const defaults = { name: "Finn", bro: "Max", sis: "Lily", cat1: "Pumpkin", cat2: "Smoke" };
    state[key()] = state[key()].trim() || defaults[key()];
    step += 1;
    if (step >= prompts.length) { go("upstairs"); return; }
    q.text = prompts[step][1]; nameTxt.text = state[key()];
    preview.text = `${state.name}` + (step > 1 ? `, ${state.bro}` : "") + (step > 2 ? `, ${state.sis}` : "") + (step > 3 ? `, ${state.cat1}` : "");
  });
});

// ---------------------------------------------------------------- scene: upstairs

// Two bedrooms side by side. Left: yours, with the storm outside the window.
// Right: your sister's, where the present is. Stairs at the bottom-left.
scene("upstairs", () => {
  save("upstairs");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  wall(0, 0, W, 40, [140, 170, 200]);
  wall(0, 0, 8, H, [110, 80, 50]); wall(W - 8, 0, 8, H, [110, 80, 50]); wall(0, H - 8, W, 8, [110, 80, 50]);
  // dividing wall with a doorway
  wall(W / 2 - 4, 0, 8, 110, [110, 80, 50]);
  wall(W / 2 - 4, 150, 8, H - 150, [110, 80, 50]);
  // your window (storm outside)
  add([rect(34, 26), pos(40, 6), color(20, 20, 36)]);
  add([rect(30, 22), pos(42, 8), color(40, 30, 70)]);
  add([rect(2, 22), pos(56, 8), color(232, 232, 240)]);
  add([rect(30, 2), pos(42, 18), color(232, 232, 240)]);
  stormFlashes({ x: 42, y: 8, w: 30, h: 22 });
  // your bed and desk
  wall(20, 60, 60, 36, [70, 110, 190]); add([rect(22, 12), pos(24, 64), color(244, 241, 234)]);
  wall(100, 120, 40, 24, [140, 100, 60]);
  // sister's room: pink bed, rug, shelf
  wall(W - 80, 60, 64, 36, [230, 120, 160]); add([rect(22, 12), pos(W - 76, 64), color(244, 241, 234)]);
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
      if (!state.talkedSis) { say(["* A present. It has your name on it.", `* Maybe ask ${state.sis} about it first.`]); return; }
      openPresent();
    };
    function openPresent() {
      destroy(sparkle);
      say(["* You tear off the paper.", "* ...", "* It's long. It's shiny. It's heavier than it looks."], () => {
        destroy(present);
        state.hasSword = true;
        const sw = add([sprite("sword"), pos(player.pos.x + 11, player.pos.y - 30), anchor("center"), z(60), scale(1)]);
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

  const sis = state.kidnapped ? null : npc("sis", W - 100, 96, "sis", () => {
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

  const bro = state.kidnapped ? null : npc("bro", W - 120, 100, "bro", () => {
    state.talkedBro = true;
    say(state.hasSword ? [`${state.bro}: whoa. whoa. whoa.`, `${state.bro}: can I hold it? just for a second? no? okay.`] : [
      `${state.bro}: ${state.name}... the booming is getting CLOSER.`,
      `${state.bro}: I'm not scared either. ${state.sis} said not to be.`,
      `${state.bro}: ...Is it okay if I stand behind you though.`,
    ]);
  }, { footY: 12 });

  const cat1 = npc("cat1", 130, 175, "cat1", () => say([`* ${state.cat1} is sitting in the doorway, exactly where you need to walk.`, `* ${state.cat1} does not care about the storm. ${state.cat1} cares about the doorway.`]), { footY: 4 });
  const cat2 = npc("cat2", 40, 130, "cat2", () => say([`* ${state.cat2} is under your bed. Only the tail is visible.`, `* The tail says: no.`]), { footY: 4 });
  cat1.onUpdate(() => { cat1.pos.x = 130 + Math.sin(time() * 0.8) * 3; });

  wireTalk(player);
  hud();

  // LYGON breaks in
  function breakIn() {
    wait(0.8, () => {
      shake(30);
      const crash = add([text("KRRAAASH!!", { size: 22 }), pos(W / 2, 100), anchor("center"), color(242, 208, 92), z(200), opacity(1)]);
      crash.onUpdate(() => { crash.opacity = Math.max(0, crash.opacity - 0.7 * dt()); });
      wait(1.2, () => {
        destroy(crash);
        say(["* Something just came through the front door.", "* Something is coming UP THE STAIRS.", "* Big, slow, heavy footsteps. And laughing."], () => {
          const clown = add([sprite("lygon"), pos(W / 2 - 60, 130), anchor("topleft"), z(30)]);
          shake(14);
          const wash = add([rect(W, H), pos(0, 0), color(199, 123, 214), opacity(0.35), z(25), fixed()]);
          wash.onUpdate(() => { wash.opacity = Math.max(0, wash.opacity - 0.5 * dt()); });
          say([
            "LYGON: Hee hee hee! Knock knock!",
            "LYGON: Two little helpers for my show! Perfect! PERFECT!",
            `${state.sis}: ${state.name}!!`,
            `${state.bro}: ${state.name}!!!`,
            "LYGON: See you at the big top, sword boy. Bring a ticket! Hee hee!",
          ], () => {
            shake(20);
            const poof = add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.9), z(90), fixed()]);
            poof.onUpdate(() => { poof.opacity = Math.max(0, poof.opacity - 1.5 * dt()); });
            destroy(clown); if (sis) destroy(sis); if (bro) destroy(bro);
            state.kidnapped = true;
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

  if (!state.hasSword) {
    wait(0.4, () => say([
      "* BOOM. BANG. The window flashes purple again.",
      "* Whatever is happening outside, it's happening on the hill.",
      `* ${state.sis} is yelling something from her room.`,
    ]));
  }

  player.onCollide("stairs", () => {
    if (dialogOpen) return;
    if (!state.hasSword) { say([`* ${state.sis} said something about a present. Check her room first.`]); player.pos.y -= 8; return; }
    if (!state.kidnapped) { player.pos.y -= 8; return; }
    go("downstairs");
  });
});

// ---------------------------------------------------------------- scene: downstairs

scene("downstairs", () => {
  save("downstairs");
  add([rect(W, H), pos(0, 0), color(210, 180, 140)]);
  for (let y = 40; y < H; y += 12) add([rect(W, 1), pos(0, y), color(190, 160, 120)]);
  wall(0, 0, W, 40, [150, 190, 220]);
  wall(0, 0, 8, H, [110, 80, 50]); wall(W - 8, 0, 8, H, [110, 80, 50]);
  wall(0, H - 8, W / 2 - 22, 8, [110, 80, 50]); wall(W / 2 + 22, H - 8, W / 2 - 22, 8, [110, 80, 50]);
  // the broken front door
  add([rect(44, 8), pos(W / 2 - 22, H - 8), color(60, 40, 20)]);
  add([rect(30, 20), pos(W / 2 - 40, H - 40), color(80, 55, 30), rotate(20)]);
  add([rect(8, 26), pos(W / 2 + 20, H - 34), color(80, 55, 30), rotate(-30)]);
  add([text("v", { size: 8 }), pos(W / 2, H - 14), anchor("center"), color(242, 208, 92)]);
  // stairs up (top-left)
  add([rect(30, 28), pos(14, 40), color(110, 80, 50)]);
  // kitchen table, couch, stove
  wall(60, 120, 60, 30, [140, 100, 60]); add([rect(56, 4), pos(62, 118), color(170, 130, 90)]);
  wall(200, 70, 80, 30, [90, 110, 160]);
  wall(W - 60, 130, 50, 30, [110, 110, 122]);
  // knocked-over things
  add([rect(10, 10), pos(140, 180), color(60, 40, 20), rotate(35)]);
  add([rect(14, 4), pos(180, 200), color(200, 80, 90), rotate(-15)]);

  const player = makePlayer(50, 80);

  npc("mom", W - 100, 140, "mom", () => {
    if (!state.talkedMom) {
      state.talkedMom = true;
      say([
        `Mom: ${state.name}! Oh thank goodness. Where are ${state.sis} and ${state.bro}?!`,
        "Mom: A CLOWN. A clown came through the door. Our DOOR.",
        `Mom: ...You have a sword. Why do you have a sword. Where did you get a sword.`,
        `Mom: No. No time. Go. GO. Bring them home, ${state.name}.`,
        "Mom: Take these. Cookies heal you. Juice heals you all the way.",
        "* You got 3 Cookies and a Juice Box!",
      ]);
      return;
    }
    say([`Mom: Up the hill. Follow the purple. And ${state.name}...`, "Mom: ...come back. All three of you."]);
  }, { footY: 16 });

  wireTalk(player);
  hud();

  add([rect(44, 6), pos(W / 2 - 22, H - 6), area(), "door"]);
  player.onCollide("door", () => {
    if (dialogOpen) return;
    if (!state.talkedMom) { say(["* Mom is calling your name."]); player.pos.y -= 8; return; }
    go("town");
  });

  wait(0.3, () => say(["* The living room looks like a tornado came through.", "* The front door is in three pieces. Mom is in the kitchen."]));
});

// ---------------------------------------------------------------- scene: town

scene("town", () => {
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

  if (!state.beatBugon) {
    const flop = add([sprite("bugon"), pos(W / 2 - 22, 16), anchor("topleft"), z(4), area({ shape: new Rect(vec2(10, 10), 24, 24) }), "bugonzone"]);
    flop.onUpdate(() => { flop.pos.y = 16 + Math.abs(Math.sin(time() * 4)) * -3; });
    player.onCollide("bugonzone", () => {
      if (dialogOpen) return;
      player.pos.y += 10;
      say([
        "* Something is guarding the path. It has ears like two dinner plates.",
        "BUGON: FLAP FLAP FLAP!!",
        `* It's one of the clown's. It is not going to let you past.`,
        `* ${state.name} drew the sword.`,
      ], () => go("battle", "bugon"));
    });
  } else {
    add([sprite("tent"), pos(W / 2 - 23, 8), anchor("topleft"), z(3)]);
    add([rect(24, 8), pos(W / 2 - 12, 22), area(), "tentzone"]);
    player.onCollide("tentzone", () => {
      if (dialogOpen) return;
      player.pos.y += 10;
      say([
        "* A circus tent. Music inside. Laughing inside.",
        `* And two small voices yelling "${state.name}!!"`,
        "LYGON: Aaaand here's our volunteer! Hee hee hee!",
        `* ${state.name} did not buy a ticket.`,
      ], () => go("battle", "lygon"));
    });
  }

  npc("elder", 90, H - 50, "elder", () => say(state.beatBugon ? [
    "Old Man: You sent that ear-thing packing? Ha! Not bad, kid.",
    "Old Man: Your brother and sister are in that tent. I heard 'em. Go get 'em.",
  ] : [
    "Old Man: Sixty years on this hill. Never once has a CIRCUS fallen on it.",
    "Old Man: The clown took your kin up the path. There's a guard. Big ears. Bad temper.",
    "Old Man: You've got a sword. That's more than I had at your age. Go on.",
  ]), { footY: 16 });

  npc("kid", W - 110, H - 50, "kid", () => say(state.beatBugon ? [
    "Kid: I saw the whole thing! You were like SLASH and it was like FLAP!",
    "Kid: There's a clown in that tent. Clowns are fine. I'm fine. I'm not scared of clowns.",
  ] : [
    "Kid: I saw the clown carry two kids up the hill. One of them bit him.",
    `Kid: You gonna go up there, ${state.name}? Can I watch from here?`,
    "Kid: PSI Ice freezes stuff, by the way. My cousin told me. He knows things.",
  ]), { footY: 14 });

  const dog = npc("dog", 200, 120, "dog", () => say(["* The dog looks at you. The dog looks at the hill.", "* The dog looks at you again, very seriously.", "* Woof."]), { footY: 6 });
  let dogT = 0;
  dog.onUpdate(() => { dogT += dt(); dog.pos.x = 200 + Math.sin(dogT * 0.7) * 14; });

  wireTalk(player);
  hud();

  wait(0.3, () => say(state.beatBugon
    ? ["* The stomping has stopped. Now there's music.", "* Circus music, coming from a tent that wasn't there before."]
    : ["* The air smells like popcorn and lightning.", "* Up the path, something is stomping."]));
});

// ---------------------------------------------------------------- scene: battle

const ENEMIES = {
  bugon: {
    name: "BUGON", spr: "bugon", hp: 45, weak: "ice", bg: [60, 30, 90], band: [90, 50, 130],
    intro: ["* BUGON flapped out in front of you!", "* Its ears are making a lot of wind."],
    attacks: [
      { t: "flapped its giant ears at %n!", d: [2, 5] },
      { t: "stomped its little yellow feet!", d: [3, 6] },
      { t: "tried to look scary.", d: [0, 0] },
    ],
    win: ["* BUGON flopped over and went 'flap'.", "* It scurried off, ears drooping. The path is clear."],
    next: () => { state.beatBugon = true; state.hp = state.maxHp; state.pp = state.maxPp; go("town"); },
  },
  lygon: {
    name: "LYGON", spr: "lygon", hp: 80, weak: "fire", bg: [90, 30, 40], band: [130, 50, 60],
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
  const def = ENEMIES[which];
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
  add([rect(110, 40, { radius: 3 }), pos(10, H - 112), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  add([text(state.name, { size: 8 }), pos(18, H - 104), color(242, 208, 92), z(21)]);
  const hpT = add([text("", { size: 8 }), pos(18, H - 92), color(232, 232, 240), z(21)]);
  const ppT = add([text("", { size: 8 }), pos(18, H - 82), color(51, 199, 193), z(21)]);
  let shownHp = state.hp;
  hpT.onUpdate(() => {
    shownHp += Math.sign(state.hp - shownHp) * Math.min(Math.abs(state.hp - shownHp), 30 * dt());
    hpT.text = `HP ${Math.round(shownHp)}/${state.maxHp}`;
    ppT.text = `PP ${state.pp}/${state.maxPp}`;
  });

  add([rect(100, 6), pos(W / 2 - 50, 150), color(20, 20, 36), outline(1, rgb(232, 232, 240)), z(20)]);
  const ebar = add([rect(100, 6), pos(W / 2 - 50, 150), color(224, 69, 63), z(21)]);
  ebar.onUpdate(() => { ebar.width = 100 * Math.max(0, boss.hp) / boss.maxHp; });
  add([text(boss.name, { size: 8 }), pos(W / 2, 142), anchor("center"), color(232, 232, 240), z(21)]);

  const menuBox = add([rect(180, 40, { radius: 3 }), pos(130, H - 112), color(20, 20, 36), outline(2, rgb(232, 232, 240)), z(20)]);
  const slots = [0, 1, 2, 3].map((i) => add([text("", { size: 8 }), pos(146 + (i % 2) * 80, H - 104 + Math.floor(i / 2) * 14), color(232, 232, 240), z(21)]));
  const cursor = add([text(">", { size: 8 }), pos(0, 0), color(242, 208, 92), z(22)]);
  const hint = add([text("", { size: 8 }), pos(W / 2, H - 120), anchor("center"), color(207, 207, 216), z(22)]);

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
    if (sub) subIdx = idx; else menu = idx;
  }
  ["left", "a", "4"].forEach((k) => onKeyPress(k, () => nav(-1, 0)));
  ["right", "d", "6"].forEach((k) => onKeyPress(k, () => nav(1, 0)));
  ["up", "w", "8"].forEach((k) => onKeyPress(k, () => nav(0, -1)));
  ["down", "s", "2"].forEach((k) => onKeyPress(k, () => nav(0, 1)));
  BACK.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen && sub) { sub = null; subIdx = 0; } }));
  INTERACT.forEach((k) => onKeyPress(k, () => { if (!busy && !dialogOpen) confirm(); }));

  function confirm() {
    if (sub === "psi") {
      if (subIdx === 3) { sub = null; subIdx = 0; return; }
      const p = PSI[subIdx];
      if (state.pp < p.pp) { say([`* Not enough PP for ${p.name}. (needs ${p.pp})`]); return; }
      sub = null; subIdx = 0; busy = true;
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
      if (subIdx === 2) { sub = null; subIdx = 0; return; }
      if (subIdx === 0) {
        if (state.cookies <= 0) { say(["* No cookies left!"]); return; }
        state.cookies -= 1; const heal = Math.min(state.maxHp - state.hp, 15); state.hp += heal;
        sub = null; busy = true; say([`* ${state.name} ate a Cookie. +${heal} HP!`], enemyTurn); return;
      }
      if (state.juice <= 0) { say(["* No juice left!"]); return; }
      state.juice -= 1; const heal = state.maxHp - state.hp; state.hp = state.maxHp;
      sub = null; busy = true; say([`* ${state.name} drank the Juice Box. +${heal} HP! Full health!`], enemyTurn); return;
    }
    const o = OPTIONS[menu];
    if (o === "PSI") { sub = "psi"; subIdx = 0; return; }
    if (o === "Item") { sub = "item"; subIdx = 0; return; }
    busy = true;
    if (o === "Slash") {
      const crit = Math.random() < 0.2;
      const dmg = randi(8, 12) * (crit ? 2 : 1);
      const slash = add([rect(40, 3), pos(W / 2, 88), anchor("center"), color(244, 241, 234), rotate(-40), z(40), lifespan(0.15)]);
      hitBoss(dmg, crit ? "did a HUGE spinning slash!" : "slashed with the sword!");
    } else if (o === "Run") {
      say(["* You tried to run.", `* Then you remembered ${state.sis} and ${state.bro}. You did not run.`], enemyTurn);
    }
  }

  function hitBoss(dmg, verb) {
    boss.hp -= dmg;
    shake(8);
    add([rect(W, H), pos(0, 0), color(244, 241, 234), opacity(0.5), z(50), lifespan(0.08)]);
    bossSpr.pos.x = W / 2 + 6;
    wait(0.08, () => bossSpr.pos.x = W / 2);
    add([text(`${dmg}`, { size: 14 }), pos(W / 2 + rand(-20, 20), 50), anchor("center"), color(242, 208, 92), z(45), lifespan(0.8), move(UP, 30)]);
    const lines = [`* ${state.name} ${verb} ${dmg} damage to ${boss.name}!`];
    if (boss.hp <= 0) say(lines.concat(def.win), def.next);
    else say(lines, enemyTurn);
  }

  function enemyTurn() {
    if (boss.frozen > 0) { boss.frozen -= 1; say([`* ${boss.name} is frozen and can't move!`], () => busy = false); return; }
    const a = choose(def.attacks);
    const dmg = a.d[1] === 0 ? 0 : randi(a.d[0], a.d[1]);
    const line = `* ${boss.name} ${a.t.replace("%n", state.name)}` + (dmg > 0 ? ` ${dmg} damage to ${state.name}!` : " Nothing happened.");
    if (dmg > 0) { state.hp = Math.max(0, state.hp - dmg); shake(dmg > 6 ? 14 : 8); }
    if (state.hp <= 0) {
      say([line, `* ${state.name} got knocked flat.`, "* ...", `* Mom's voice: "${state.name}! Get UP!"`, "* You got up. You still have a job to do."],
        () => { state.hp = state.maxHp; state.pp = state.maxPp; state.cookies = 3; state.juice = 1; go("town"); });
    } else say([line], () => busy = false);
  }

  wait(0.2, () => say(def.intro, () => busy = false));
});

// ---------------------------------------------------------------- scene: end

scene("end", () => {
  add([rect(W, H), pos(0, 0), color(11, 11, 20)]);
  for (let i = 0; i < 60; i++) {
    const c = add([rect(2, 3), pos(rand(0, W), rand(-H, 0)), color(...choose([[224, 69, 63], [242, 208, 92], [58, 111, 216], [79, 176, 106], [199, 123, 214]])), z(1)]);
    const sp = rand(20, 50);
    c.onUpdate(() => { c.pos.y += sp * dt(); c.pos.x += Math.sin(time() * 3 + i) * 0.3; if (c.pos.y > H) c.pos.y = -5; });
  }
  add([sprite("hero_sword"), pos(W / 2, 60), anchor("center"), z(5)]);
  add([sprite("sis"), pos(W / 2 - 30, 64), anchor("center"), z(5)]);
  add([sprite("bro"), pos(W / 2 + 30, 64), anchor("center"), z(5)]);
  add([sprite("cat1"), pos(W / 2 - 52, 78), anchor("center"), z(5)]);
  add([sprite("cat2"), pos(W / 2 + 52, 78), anchor("center"), z(5)]);
  add([text("YOU SAVED THEM!", { size: 20 }), pos(W / 2, 108), anchor("center"), color(242, 208, 92), z(5)]);
  add([text(`${state.name} rescued ${state.sis} and ${state.bro}!`, { size: 8 }), pos(W / 2, 132), anchor("center"), color(232, 232, 240), z(5)]);
  add([text(`${state.sis}: "I wasn't scared."\n${state.bro}: "I was a little scared."`, { size: 8, align: "center", lineSpacing: 3 }), pos(W / 2, 156), anchor("center"), color(207, 207, 216), z(5)]);
  add([text(`${state.cat1} and ${state.cat2} were fine the whole time.`, { size: 8 }), pos(W / 2, 182), anchor("center"), color(138, 138, 153), z(5)]);
  add([text("~ to be continued ~", { size: 8 }), pos(W / 2, 200), anchor("center"), color(138, 138, 153), z(5)]);
  add([text("press SPACE to play again", { size: 8 }), pos(W / 2, 220), anchor("center"), color(242, 208, 92), z(5)]);
  clearSave();
  INTERACT.forEach((k) => onKeyPress(k, () => { Object.assign(state, START); go("title", { fresh: true }); }));
});

go("title");
