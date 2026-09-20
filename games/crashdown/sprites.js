// Pixel art for Crashdown. Every sprite is a grid of palette letters, drawn
// to a canvas at load. Larger characters carry an outline (j), a base tone,
// a shadow tone and a highlight so they read as shaded pixel art rather
// than flat icons. The hero and both bosses are pixel versions of three
// crayon drawings.

const PAL = {
  ".": null,
  // outline / neutrals
  "j": "#101018", "k": "#22222f", "q": "#5b5b6b", "Q": "#3a3a48", "e": "#c9c9d4", "E": "#8d8d9c", "w": "#f6f4ee", "W": "#dcd9d0",
  // skin
  "s": "#f3d2b8", "S": "#d9a98a", "h": "#fbe7d8",
  // blonde hair
  "y": "#f0d24f", "Y": "#c9a628", "i": "#fbe98d",
  // blue shorts
  "b": "#3f7fe0", "B": "#2a5aa6", "l": "#7fb0f2",
  // reds
  "r": "#e14a3f", "R": "#a32b23", "c": "#c8322a", "C": "#7c1a14", "x": "#ff7a6b",
  // greens
  "g": "#4fb06a", "G": "#2f7a48", "L": "#5fd14c", "M": "#35913a", "v": "#a3e36a",
  // yellows / oranges
  "o": "#f0923a", "O": "#c56a1c", "n": "#7a5230", "N": "#4d3018", "t": "#d8c04a", "T": "#a8922c",
  // purples / misc
  "p": "#c77bd6", "P": "#8b4aa0", "m": "#ff6fae", "u": "#33c7c1", "d": "#2b2b3a",
  // clown
  "a": "#d8d14a", "A": "#a4a033",
};

function pixels(rows, pal = PAL) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = pal[ch];
    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}

// ---------------------------------------------------------------- hero (22 x 32)
// Blonde messy hair, pale skin, big dark eyes, white tee, blue shorts, black
// sneakers. HERO_SWORD adds the sword: grip and crossguard above the left
// shoulder, scabbard tip at the right hip.

const HERO = [
  "........jyyyyyj.......",
  ".......jyiiyyyyj......",
  "......jyiiyyyyyyj.....",
  ".....jyyyyyyyyyyyj....",
  ".....jyYyyyyyyyYyj....",
  ".....jyYYyyyyyYYyj....",
  ".....jYjssssssssYj....",
  ".....jhsssssssssjj....",
  ".....jsjjsssssjjsj....",
  ".....jsjjsssssjjsj....",
  ".....jssssssssssj.....",
  ".....jsssssssssj......",
  ".....jsSjjjjjSsj......",
  "......jsSSSSSsj.......",
  ".......jsSSSsj........",
  ".....jjwwwwwwwjj......",
  "....jswwwwwwwwwsj.....",
  "....jswwwwwwwwwsj.....",
  "....jswwwwWwwwwsj.....",
  "....jswwwwwwwwwsj.....",
  "....js.wwwwwwww.sj....",
  "....jj.jWWWWWWj.jj....",
  ".......jbbbbbbj.......",
  ".......jbbbbbbj.......",
  ".......jbblbbbj.......",
  ".......jBBBBBBj.......",
  ".......jssjjssj.......",
  ".......jssj.ssj.......",
  ".......jSsj.sSj.......",
  "......jjjjj.jjjjj.....",
  ".....jkkkkjjkkkkkj....",
  ".....jjjjjj.jjjjjj....",
];

const HERO_SWORD = [
  "..q.....jyyyyyj.......",
  ".jqj...jyiiyyyyj......",
  ".jnj..jyiiyyyyyyj.....",
  ".jnj.jyyyyyyyyyyyj....",
  ".jnj.jyYyyyyyyyYyj....",
  "jEEEjjyYYyyyyyYYyj....",
  "jEEEjjYjssssssssYj....",
  ".jej.jhsssssssssjj....",
  ".jej.jsjjsssssjjsj....",
  ".jej.jsjjsssssjjsj....",
  ".jej.jssssssssssj.....",
  ".jej.jsssssssssj......",
  "..jejjsSjjjjjSsj......",
  "...jejjsSSSSSsj.......",
  "....jejjsSSSsj........",
  ".....jjwwwwwwwjj......",
  "....jswwwwwwwwwsj.....",
  "....jswwwwwwwwwsj.....",
  "....jswwwwWwwwwsj.....",
  "....jswwwwwwwwwsj.....",
  "....js.wwwwwwww.sj....",
  "....jj.jWWWWWWj.jj....",
  ".......jbbbbbbjqj.....",
  ".......jbbbbbbjqj.....",
  ".......jbblbbbjQj.....",
  ".......jBBBBBBjjj.....",
  ".......jssjjssj.......",
  ".......jssj.ssj.......",
  ".......jSsj.sSj.......",
  "......jjjjj.jjjjj.....",
  ".....jkkkkjjkkkkkj....",
  ".....jjjjjj.jjjjjj....",
];

// ---------------------------------------------------------------- family (18 x 26)

const MOM = [
  "......jnnnnnnj....",
  ".....jnnnnnnnnj...",
  "....jnnNnnnnNnnj..",
  "....jnnjssssjnnj..",
  "....jnjsssssssjnj.",
  "....jnjsjjsssjjsj.",
  "....jnjsjjsssjjsj.",
  ".....jsssssssssj..",
  ".....jsSjjjjSsj...",
  "......jsSSSSsj....",
  ".....jjppppppjj...",
  "....jspwwwwwwpsj..",
  "....jspwwwwwwpsj..",
  "....jspwwwwwwpsj..",
  "....js.wwwwww.sj..",
  "....jj.pWWWWp.jj..",
  ".......jppppj.....",
  ".......jppppj.....",
  ".......jPPPPj.....",
  ".......jssjssj....",
  ".......jssjssj....",
  "......jjjjjjjjj...",
  ".....jkkkjjkkkj...",
  ".....jjjjjjjjjj...",
];

const SIS = [
  "......jjjjjj......",
  ".....jkkkkkkjj....",
  "....jkkkkkkkkkjj..",
  "....jkjssssjkkkkj.",
  "....jjsssssssjkkj.",
  ".....jsjjsssjjjkkj",
  ".....jsjjsssjjsjkj",
  ".....jssssssssj.j.",
  "......jsSjjSsj....",
  ".......jsSSsj.....",
  ".....jjmmmmmmjj...",
  "....jsmmxmmmmmsj..",
  "....jsmmmxmmmmsj..",
  "....jsmmmmmmmmsj..",
  "....js.wwwwww.sj..",
  "....jj.jwwwwj.jj..",
  ".......jwwwwj.....",
  ".......jssjsj.....",
  ".......jssjsj.....",
  "......jjjjjjjj....",
  ".....jSSSjjSSSj...",
  ".....jjjjjjjjjj...",
];

const BRO = [
  "......jkkkkkj.....",
  ".....jkkkkkkkj....",
  ".....jkkkkkkkj....",
  "....jssjkkkjssj...",
  "....jssssssssssj..",
  "....jsjjjssjjjsj..",
  "....jsjjjssjjjsj..",
  "....jssssssssssj..",
  ".....jsssssssj....",
  "......jsSSSsj.....",
  ".....jjbbbbbbjj...",
  "....jsbbblbbbbsj..",
  "....jsbbbbbbbbsj..",
  "....jsbbbbbbbbsj..",
  "....js.bbbbbb.sj..",
  "....jj.jBBBBj.jj..",
  ".......jssjsj.....",
  ".......jssjsj.....",
  ".......jssjsj.....",
  "......jjjjjjjj....",
  ".....jSSSjjSSSj...",
  ".....jjjjjjjjjj...",
];

// cats (16 x 12): one orange tabby, one grey
const CAT_ORANGE = [
  "..j..........j..",
  ".jojj......jjoj.",
  ".joooj....jooooj",
  ".joojoooojoojooj",
  "..joooooooooooj.",
  "..jojoooooojooj.",
  "..jooooOooooooj.",
  "...joooooooooj..",
  "...jooOoooOooj..",
  "...jooj..jooj...",
  "...jooj..jooj...",
  "...jjjj..jjjj...",
];
const CAT_GREY = [
  "..j..........j..",
  ".jqjj......jjqj.",
  ".jqqqj....jqqqqj",
  ".jqqjqqqqjqqjqqj",
  "..jqqqqqqqqqqqj.",
  "..jqjqqqqqqjqqj.",
  "..jqqqqEqqqqqqj.",
  "...jqqqqqqqqqj..",
  "...jqqEqqqEqqj..",
  "...jqqj..jqqj...",
  "...jqqj..jqqj...",
  "...jjjj..jjjj...",
];

// ---------------------------------------------------------------- townsfolk (18 x 24)

const ELDER = [
  "......jeeeeeej....",
  ".....jeeeeeeeej...",
  "....jeeEeeeeEeej..",
  "....jeejssssjeej..",
  "....jejsssssssjej.",
  "....jjsjjsssjjsjj.",
  ".....jsjjsssjjsj..",
  ".....jsssssssssj..",
  ".....jsseeeeessj..",
  "......jeeeeeeej...",
  ".....jjGGGGGGjj...",
  "....jsGGGGGGGGsj..",
  "....jsGGGGGGGGsj..",
  "....jsGGGgGGGGsj..",
  "....js.GGGGGG.sj..",
  "....jj.GGGGGG.jj..",
  ".......jGGGGj.....",
  ".......jGGGGj.....",
  ".......jNNNNj.....",
  ".......jssjssj....",
  "......jjjjjjjjj...",
  ".....jkkkjjkkkj...",
  ".....jjjjjjjjjj...",
];

const KID = [
  "......joooooj.....",
  ".....jooooooooj...",
  "....jooOooooOooj..",
  "....joojssssjooj..",
  ".....jssssssssj...",
  ".....jsjjsssjjsj..",
  ".....jsjjsssjjsj..",
  ".....jssssssssj...",
  "......jsSjjSsj....",
  ".......jsSSsj.....",
  ".....jjuuuuuujj...",
  "....jsuuuwwuuusj..",
  "....jsuuuuuuuusj..",
  "....jsuuuuuuuusj..",
  "....js.uuuuuu.sj..",
  "....jj.jbbbbj.jj..",
  ".......jbbbbj.....",
  ".......jssjsj.....",
  ".......jssjsj.....",
  "......jjjjjjjj....",
  ".....jkkkjjkkkj...",
  ".....jjjjjjjjjj...",
];

const DOG = [
  "................",
  "...jj......jj...",
  "..jnnj....jnnj..",
  "..jnnnjjjjnnnj..",
  "..jnnnnnnnnnnj..",
  "..jnjnnnnnnjnj..",
  "..jnnnnnjjnnnj..",
  "...jnnnnnnnnnjjj",
  "....jnnnnnnnnnnj",
  "....jnnnnnnnnnj.",
  "....jnnjjnnjjnj.",
  "....jnnj.jnnj.j.",
  "....jNNj.jNNj...",
  "....jjjj.jjjj...",
];

// ---------------------------------------------------------------- BUGON (40 x 36)
// Mini boss. Dark red round head with two enormous floppy ears, a yellow Y
// marking down the face with black eyes set in it, skinny red body, arms
// flung out, yellow legs and feet.

const BUGON = [
  "...jjjjj..........jjjjjjjj..........jjjjj...",
  "..jRRRRRj........jRRRRRRRRj........jRRRRRj..",
  ".jRRxRRRRj......jRRRRRRRRRRj......jRRRRxRRj.",
  "jRRxRRRRRRj....jRRRRRRRRRRRRj....jRRRRRRxRRj",
  "jRRRRRRRRRRjjjjjRRRRRRRRRRRRjjjjjRRRRRRRRRRj",
  "jRRRRRRRRRRRRRRRRRRRttRRRRttRRRRRRRRRRRRRRRj",
  "jRRRRRRRRRRRRRRRRRRjttRRRRttjRRRRRRRRRRRRRRj",
  "jCRRRRRRRRRRRRRRRRRjjttRRttjjRRRRRRRRRRRRRCj",
  ".jCRRRRRRRRRRRRRRRRRjtttttttjRRRRRRRRRRRRCj.",
  ".jCCRRRRRRRRRRRRRRRRRjtttttjRRRRRRRRRRRRCCj.",
  "..jCCRRRRRRjRRRRRRRRRRjtttjRRRRRRRRjRRRCCj..",
  "...jCCRRRRj.jRRRRRRRRRjtttjRRRRRRRj.jRCCj...",
  "....jjjjj...jRRRRRRRRRjtttjRRRRRRRj..jjjj...",
  "............jRRRRRRRRRjtttjRRRRRRRj.........",
  ".............jRRRRRRRRjtttjRRRRRRj..........",
  "..............jRRRRRRRjttjRRRRRRj...........",
  "...............jRRRRRRjtjRRRRRj.............",
  "................jjRRRRRRRRRjj...............",
  "..........jj......jjjrrrjjj......jj.........",
  ".........jrrj....jrrrrrrrrrj....jrrj........",
  "........jrrj....jrrrrrrrrrrrj....jrrj.......",
  ".......jrrj....jrrrrrrrrrrrrrj....jrrj......",
  "......jrrj.....jrrrrxrrrrrrrrj.....jrrj.....",
  ".....jrrj......jrrrrrrrrrrrrrj......jrrj....",
  "....jrrrj......jrrrrrrrrrrrrrj......jrrrj...",
  "....jjjj.......jrrrrrrrrrrrrrj.......jjjj...",
  "...............jrrrrrrrrrrrrrj..............",
  "................jrrrrrrrrrrrj...............",
  ".................jjttttjttttjj..............",
  "..................jttttjttttj...............",
  "..................jttttjttttj...............",
  "..................jttttjttttj...............",
  "..................jtTttjttTtj...............",
  ".................jtttttjtttttj..............",
  "................jttttttjttttttj.............",
  "................jjjjjjjjjjjjjjj.............",
];

// ---------------------------------------------------------------- MR. LYGON (40 x 40)
// Final boss. White round face, three tufts of green hair, yellow-green
// almond eyes, red ball nose, a wide red grin full of teeth, orange shirt
// under a huge black spiky-shouldered jacket, black trousers, grey shoes.

const LYGON = [
  "..................jLLLj.................",
  ".................jLLvLLj................",
  "....jLLj.........jLLLLLj.........jLLj...",
  "...jLLvLj.......jjwwwwwjj.......jLvLLj..",
  "..jLLLLLLj....jjwwwwwwwwwjj....jLLLLLLj.",
  "..jLLvLLj....jwwwwwwwwwwwwwj....jLLvLLj.",
  "...jLLLj....jwwwwwwwwwwwwwwwj....jLLLj..",
  "....jj.....jwwwwwwwwwwwwwwwwwj.....jj...",
  "..........jwwwwaaawwwwwwaaawwwj.........",
  "..........jwwwaaajawwwwajaaawwj.........",
  "..........jwwwaajjjawwajjjaawwj.........",
  "..........jwwwwaaaawwwwaaaawwwj.........",
  "..........jwwwwwwwwjrrjwwwwwwwj.........",
  "..........jwwwwwwwjrxrrjwwwwwwj.........",
  "..........jwwwwwwwjrrrrjwwwwwwj.........",
  "..........jwwwwwwwwjrrjwwwwwwwj.........",
  "..........jwwwjcccccccccccjwwwj.........",
  "...........jwjccwcwcwcwcwccjwj..........",
  "...........jwjccccccccccccccjwj.........",
  "............jwjcccccccccccjwj...........",
  ".............jwjjcccccccjjwj............",
  "..............jwwwjjjjjwwwj.............",
  "...............jjwwwwwwwjj..............",
  "......jjjj.......jwoooowj.......jjjj....",
  ".....jkkkkjj.....jwoooowj.....jjkkkkj...",
  "....jkkkkkkkjj...jwoooowj...jjkkkkkkkj..",
  "...jkkkkkkkkkkjjjjjooooojjjjjkkkkkkkkkj.",
  "..jkkkkkkkkkkkkkkkjooooojkkkkkkkkkkkkkkj",
  ".jkkkkjkkkkkkkkkkkjoooojkkkkkkkkkkkkjkkkj",
  "jkkkkjjkkkkkkkkkkkkjoojkkkkkkkkkkkkkjjkkkj",
  "jkkkjj.jkkkkkkkkkkkjjjjkkkkkkkkkkkkj.jjkkj",
  ".jjj...jkkkkkkkkkkkkkkkkkkkkkkkkkkkj...jjj",
  ".......jkkkkkkkkkkkkkkkkkkkkkkkkkkkj......",
  "........jkkkkkkkkkkkkkkkkkkkkkkkkkj.......",
  ".........jjjjjjkkkkkjjjkkkkkjjjjjj........",
  "..............jkkkkkj.jkkkkkj.............",
  "..............jkkkkkj.jkkkkkj.............",
  "..............jkkkkkj.jkkkkkj.............",
  "...........jjjjEEEEEjjjEEEEEjjjj..........",
  "..........jEEEEEEEEEjjEEEEEEEEEEj.........",
  "..........jjjjjjjjjjj.jjjjjjjjjjj.........",
];

// ---------------------------------------------------------------- scenery

const TREE = [
  "......jGGGGj......",
  "....jjGGggGGjj....",
  "...jGGggggggGGj...",
  "..jGgggvgggggGGj..",
  "..jGggggggggggGj..",
  ".jGGggvggggggggGj.",
  ".jGggggggggvgggGj.",
  ".jGGgggggggggGGGj.",
  "..jGGGgggggGGGGj..",
  "...jGGGGgGGGGGj...",
  "....jjGGGGGGjj....",
  ".....jjNNNNjj.....",
  ".......jNnNj......",
  ".......jNNNj......",
  "......jNNNNNj.....",
  "......jjjjjjj.....",
];

const HOUSE = [
  "..............jRRRRRRRRRRRRRRRRj..............",
  "............jjRRRRRRRRRRRRRRRRRRjj............",
  "..........jjRRRRRRRRRRRRRRRRRRRRRRjj..........",
  "........jjRRRRRRRRRRRRRRRRRRRRRRRRRRjj........",
  "......jjRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRjj......",
  "....jjRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRjj....",
  "..jjrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrjj..",
  "..jwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwj..",
  "..jwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwj..",
  "..jwwwwjbbbbjwwwwwwwwwwwwwwwwwwwwwjbbbbjwwwwj..",
  "..jwwwwjbllbjwwwwwwwwwwwwwwwwwwwwwjbllbjwwwwj..",
  "..jwwwwjbbbbjwwwwwwwwjNNNNjwwwwwwwjbbbbjwwwwj..",
  "..jwwwwjjjjjjwwwwwwwwjNNNNjwwwwwwwjjjjjjwwwwj..",
  "..jwwwwwwwwwwwwwwwwwwjNyNNjwwwwwwwwwwwwwwwwwj..",
  "..jwwwwwwwwwwwwwwwwwwjNNNNjwwwwwwwwwwwwwwwwwj..",
  "..jjjjjjjjjjjjjjjjjjjjNNNNjjjjjjjjjjjjjjjjjjj..",
];

const WAGON = [
  "............jyyyyyyyyyyyyyyyyyyyj...........",
  "..........jjyryryryryryryryryryryjj.........",
  "........jjryryryryryryryryryryryryrjj.......",
  "........jrrrrrrrrrrrrrrrrrrrrrrrrrrrj.......",
  "........jryyryyryyryyryyryyryyryyryyj.......",
  "........jryyryyryyryyryyryyryyryyryyj.......",
  "........jrrrrrrrrrrrrrrrrrrrrrrrrrrrj.......",
  "........jrrrjkkkkkjrrrrrrrrjkkkkkjrrj.......",
  "........jrrrjkkkkkjrrrrrrrrjkkkkkjrrj.......",
  "........jrrrjkkkkkjrrrrrrrrjkkkkkjrrj.......",
  "........jrrrjjjjjjjrrrrrrrrjjjjjjjrrj.......",
  "........jRRRRRRRRRRRRRRRRRRRRRRRRRRRj.......",
  ".....jjjNNNNNNNNNNNNNNNNNNNNNNNNNNNNNjjj....",
  "........jQQQj....................jQQQj......",
  ".......jQQqQQj..................jQQqQQj.jjj.",
  ".......jQQQQQj..................jQQQQQjjQqQj",
];

const TENT = [
  "......................jyj.....................",
  "......................jyj.....................",
  "....................jjrrrjj...................",
  "..................jjrrrrrrrjj.................",
  "................jjryyrryyrryyjj...............",
  "..............jjrryyrryyrryyrrrjj.............",
  "............jjrrrryyrryyrryyrrrrrjj...........",
  "..........jjrrrrrryyrryyrryyrrrrrrrjj.........",
  "........jjrrrrrrrryyrryyrryyrrrrrrrrrjj.......",
  "......jjrrrrrrrrrryyrryyrryyrrrrrrrrrrrjj.....",
  "....jjrrrrrrrrrrrryyrryyrryyrrrrrrrrrrrrrjj...",
  "..jjrrrrrrrrrrrrrryyrryyrryyrrrrrrrrrrrrrrrjj.",
  "..jryyrryyrryyrryyrryyrryyrryyrryyrryyrryyrrj.",
  "..jryyrryyrryyrryyrryyrryyrryyrryyrryyrryyrrj.",
  "..jryyrryyrryyrryyrjjjjjjjjjryyrryyrryyrryyrj.",
  "..jryyrryyrryyrryyrjkkkkkkkjryyrryyrryyrryyrj.",
  "..jryyrryyrryyrryyrjkkkkkkkjryyrryyrryyrryyrj.",
  "..jjjjjjjjjjjjjjjjjjkkkkkkkjjjjjjjjjjjjjjjjjj.",
];

// wrapped present with a bow (14 x 14)
const PRESENT = [
  "....jj....jj..",
  "...jmmjjjjmmj.",
  "...jmmmmmmmmj.",
  "....jjmmmmjj..",
  "..jjjjjmmjjjjj",
  ".jbbbbbjmjbbbbj",
  ".jbbbbbjmjbbbbj",
  ".jmmmmmmmmmmmmj",
  ".jbbbbbjmjbbbbj",
  ".jbbbbbjmjbbbbj",
  ".jbbbbbjmjbbbbj",
  ".jBBBBBjmjBBBBj",
  ".jBBBBBjmjBBBBj",
  ".jjjjjjjjjjjjjj",
];

// the sword, held up on pickup (8 x 26)
const SWORD = [
  "...jj...",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "..jeej..",
  "jjjEEjjj",
  "jEEEEEEj",
  "jjjnnjjj",
  "..jnnj..",
  "..jnnj..",
  "..jnnj..",
  "..jnnj..",
  ".jqqqqj.",
  ".jqqqqj.",
  "..jjjj..",
];

window.SPRITES = {
  hero: HERO, hero_sword: HERO_SWORD, mom: MOM, sis: SIS, bro: BRO,
  cat1: CAT_ORANGE, cat2: CAT_GREY,
  elder: ELDER, kid: KID, dog: DOG,
  bugon: BUGON, lygon: LYGON,
  tree: TREE, house: HOUSE, wagon: WAGON, tent: TENT, present: PRESENT, sword: SWORD,
};
window.pixels = pixels;
