// RestoreBound — environment decor. Each scene in game.js makes one call here right
// after it paints its background; everything below is scenery only (no colliders,
// no triggers), layered with z so the characters always walk in front:
//   floor tiles z 0-0.2, rugs/mats 0.5, furniture on colliders 1, wall props 2.5-2.6,
//   town ground 0, fence 0.4, houses 2.5, yard props 3.2, trees 3.5. Player is z 10+.
// Sprites are letter grids registered in sprites.js (the environment block).

(function () {
  const W = 320, H = 240;

  // deterministic tile picking so a room looks the same every visit
  function pick(list, cx, cy) {
    let h = (cx * 73856093) ^ (cy * 19349663); h = (h ^ (h >>> 13)) >>> 0;
    return list[h % list.length];
  }
  // fill [x0,x1) x [y0,y1) with tw x th tiles chosen from names
  function tiles(x0, y0, x1, y1, tw, th, names, zz) {
    for (let y = y0, r = 0; y < y1; y += th, r++)
      for (let x = x0, c = 0; x < x1; x += tw, c++)
        add([sprite(pick(names, c + x0, r + y0)), pos(x, y), anchor("topleft"), z(zz)]);
  }
  function put(name, x, y, zz, extra = []) {
    return add([sprite(name), pos(x, y), anchor("topleft"), z(zz), ...extra]);
  }
  // a wall-hung thing that tilts once the house has been shaken
  function hung(name, x, y, w, h, tilt) {
    const p = add([sprite(name), pos(x + w / 2, y + h / 2), anchor("center"), z(2.6), rotate(0)]);
    p.onUpdate(() => { p.angle = state.boomed ? tilt : 0; });
    return p;
  }

  // ---- shared house pieces: floorboards, papered wall with wainscot, wood beams, windows
  function houseShell(windows) {
    tiles(8, 40, 312, 232, 16, 16, ["floor_a", "floor_b", "floor_c", "floor_d", "floor_a", "floor_b"], 0);
    tiles(0, 0, W, 32, 16, 16, ["wall_a", "wall_b", "wall_b"], 0.1);
    tiles(0, 32, W, 40, 16, 8, ["wainscot"], 0.1);
    tiles(0, 40, 8, 232, 8, 16, ["beam_v"], 0.2);
    tiles(312, 40, 320, 232, 8, 16, ["beam_vr"], 0.2);
    windows.forEach((wn) => {
      put("window", wn.x - 2, wn.y - 2, 2.5);
      put("curtain_rod", wn.x - 9, wn.y - 5, 2.6);
      put("curtain_l", wn.x - 9, wn.y - 3, 2.6);
      put("curtain_r", wn.x + wn.w + 1, wn.y - 3, 2.6);
    });
  }

  // ---- dialog / menu boxes get pixel corner nubs; they share the box's tag so they
  // vanish with it. Watches for a new box each frame (the boxes are built in game.js).
  function uiNubs() {
    const watcher = add([fixed(), z(0), "decor-ui"]);
    watcher.onUpdate(() => {
      ["dialog", "menu"].forEach((tag) => {
        const box = get(tag).find((o) => o.width === W - 16 && o.outline && !o.decorNubbed);
        if (!box) return;
        box.decorNubbed = true;
        const bx = box.pos.x, by = box.pos.y, bw = box.width, bh = box.height;
        [[bx - 1, by - 1], [bx + bw - 2, by - 1], [bx - 1, by + bh - 2], [bx + bw - 2, by + bh - 2]].forEach(([x, y]) => {
          add([rect(3, 3), pos(x, y), color(232, 232, 240), fixed(), z(100.5), tag]);
          add([rect(1, 1), pos(x + 1, y + 1), color(242, 208, 92), fixed(), z(100.6), tag]);
        });
      });
    });
  }

  // ------------------------------------------------------------------ upstairs
  window.decorUpstairs = function () {
    houseShell([{ x: 42, y: 8, w: 30, h: 22 }, { x: W - 72, y: 8, w: 30, h: 22 }]);
    tiles(0, 232, W, 240, 16, 8, ["beam_h"], 0.3);
    // the wall between the two rooms, with a post either side of the doorway
    tiles(W / 2 - 4, 0, W / 2 + 4, 112, 8, 16, ["beam_v"], 0.3);
    tiles(W / 2 - 4, 150, W / 2 + 4, 246, 8, 16, ["beam_v"], 0.3);
    put("doorpost", W / 2 - 4, 104, 0.4); put("doorpost", W / 2 - 4, 150, 0.4);
    // your room
    put("rug_small", 24, 100, 0.5);
    put("bed_blue", 20, 60, 1);
    put("desk", 96, 36, 1);
    hung("picture", 20, 18, 12, 9, -14);
    put("clock", 108, 18, 2.5);
    put("stairs_down", 14, 200, 1);
    // the kids' room
    put("rug", W / 2 + 30, 150, 0.5);
    put("bed_bro", W / 2 + 14, 60, 1);
    put("bed_pink", W - 72, 60, 1);
    put("shelf", W - 70, 114, 1);
    hung("kite", 200, 6, 14, 16, 10);
    hung("photo", 292, 12, 10, 9, -9);
    put("blocks", 176, 132, 0.7);
    put("teddy", 298, 138, 0.7);
    uiNubs();
  };

  // ------------------------------------------------------------------ downstairs
  window.decorDownstairs = function () {
    houseShell([{ x: 100, y: 8, w: 30, h: 22 }, { x: W - 110, y: 8, w: 30, h: 22 }]);
    tiles(0, 232, W / 2 - 22 + 6, 240, 16, 8, ["beam_h"], 0.3);
    tiles(W / 2 + 22, 232, W, 240, 16, 8, ["beam_h"], 0.3);
    put("frontdoor", W / 2 - 24, H - 10, 1.2);
    put("doormat", W / 2 - 18, H - 28, 0.5);
    put("stairs_up", 14, 34, 1);
    put("coatrack", 48, 42, 2.4);
    put("clock", 166, 12, 2.5);
    hung("picture", 62, 18, 12, 9, -12);
    hung("photo", 280, 14, 10, 9, 8);
    put("plant", 298, 42, 2.4);
    // living room and kitchen
    put("table", 60, 120, 1);
    put("chair", 46, 126, 0.8); put("chair", 122, 126, 0.8);
    put("sofa", 200, 70, 1);
    put("stove", W - 60, 130, 1);
    put("bowl", 104, 214, 0.6);
    // the break-in: a picture off the wall, glass, a chair on its side
    put("shards", 158, 186, 0.6);
    add([sprite("picture"), pos(154, 178), anchor("center"), z(0.7), rotate(28)]);
    add([sprite("chair"), pos(146, 186), anchor("center"), z(0.7), rotate(78)]);
    uiNubs();
  };

  // ------------------------------------------------------------------ town
  window.decorTown = function () {
    // ground: hill grass up top with a ridge, meadow below, the dirt path over it
    tiles(0, 0, W, 64, 16, 16, ["hill_a", "hill_b", "hill_a"], 0);
    tiles(0, 64, W, 72, 16, 8, ["ridge"], 0);
    tiles(0, 72, W, 248, 16, 16, ["grass_a", "grass_b", "grass_c", "grass_d", "grass_e", "grass_a", "grass_d"], 0);
    const PX = W / 2 - 20, PY = H - 48;
    tiles(PX, 0, PX + 40, H, 8, 8, ["dirt_a", "dirt_b", "dirt_c", "dirt_a"], 0);
    tiles(0, PY, W, PY + 32, 8, 8, ["dirt_a", "dirt_b", "dirt_c", "dirt_b"], 0);
    tiles(PX - 3, 0, PX, PY, 3, 8, ["edge_l"], 0); tiles(PX + 40, 0, PX + 43, PY, 3, 8, ["edge_r"], 0);
    tiles(PX - 3, PY + 34, PX, H, 3, 8, ["edge_l"], 0); tiles(PX + 40, PY + 34, PX + 43, H, 3, 8, ["edge_r"], 0);
    tiles(0, PY - 3, PX - 3, PY, 8, 3, ["edge_t"], 0); tiles(PX + 43, PY - 3, W, PY, 8, 3, ["edge_t"], 0);
    tiles(0, PY + 32, PX - 3, PY + 35, 8, 3, ["edge_b"], 0); tiles(PX + 43, PY + 32, W, PY + 35, 8, 3, ["edge_b"], 0);
    tiles(PX, PY + 32, PX + 40, PY + 34, 8, 8, ["dirt_a"], 0);
    // fence along the bottom, broken by the path
    tiles(0, 226, PX - 3, 238, 16, 12, ["fence"], 0.4);
    tiles(PX + 43, 226, W + 8, 238, 16, 12, ["fence"], 0.4);
    // houses (drawn over the small ones already there, same doorsteps) with chimney smoke
    [[20, 40, "house_red"], [W - 66, 40, "house_blue"]].forEach(([x, y, name]) => {
      put(name, x - 3, y - 23, 2.5);
      for (let i = 0; i < 3; i++) {
        const p = add([sprite(i ? "puff" : "puff_small"), pos(x + 38, y - 24 - i * 9), anchor("center"), z(2.6), opacity(0.7 - i * 0.2)]);
        p.onUpdate(() => { p.pos.y -= 7 * dt(); p.pos.x += Math.sin(time() * 1.5 + i) * 3 * dt(); p.opacity -= 0.16 * dt(); if (p.opacity <= 0) { p.pos = vec2(x + 38, y - 24); p.opacity = 0.7; } });
      }
    });
    put("mailbox", 74, 44, 3.2);
    put("well", 290, 66, 3.2);
    put("bench", 16, 176, 3.2);
    put("lantern", 126, 166, 3.2); put("lantern", 186, 166, 3.2);
    put("signpost", 186, 30, 3.2);
    // trees: fuller canopies over the old ones, same trunks
    [[30, 130], [60, 150], [W - 50, 130], [W - 80, 160], [24, 96], [W - 40, 96]].forEach(([x, y]) => put("tree_big", x - 2, y - 11, 3.5));
    [[40, 82], [104, 112], [250, 142], [36, 122], [268, 82], [230, 112], [100, 150]].forEach(([x, y]) => put("flowers", x, y, 0.3));
    [[118, 140], [232, 66], [70, 120]].forEach(([x, y]) => put("rock", x, y, 0.3));
    // the wreck: the wagon split open beside the cave mouth, and what fell out of it
    put("wreck", 98, 10, 1.5);
    put("hat", 190, 30, 1.5); put("balloon", 112, 54, 1.5);
    put("popcorn", 120, 42, 1.5); put("kernels", 186, 48, 1.5); put("ticket", 200, 54, 1.5);
    [[150, 62], [166, 88], [146, 118], [170, 146], [154, 172]].forEach(([x, y], i) => put(i % 2 ? "ticket" : "kernels", x, y, 0.2));
    uiNubs();
  };

  // ------------------------------------------------------------------ title
  window.decorTitle = function () {
    put("title_hills", 0, H - 64, 0.5);
    const glow = add([rect(8, 5), pos(266, H - 64 + 13), color(199, 123, 214), opacity(0.25), z(0.6)]);
    glow.onUpdate(() => { glow.opacity = 0.15 + 0.2 * Math.abs(Math.sin(time() * 2.5)); });
  };
})();
