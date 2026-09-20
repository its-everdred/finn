// Pixel art for Crashdown. Every sprite is a grid of palette letters drawn to a
// canvas at load. The style is chibi and cartoonish: big round heads, big eyes
// with a catchlight, rosy cheeks, soft three-tone shading lit from the top
// left, and a deep-navy outline instead of pure black so edges stay friendly.
// The hero, both siblings and both bosses are pixel versions of crayon
// drawings.

const PAL = {
  ".": null,
  // outline + neutrals
  "j": "#1b1a2e", "k": "#2c2b45", "q": "#6f6f86", "Q": "#4a4a62", "z": "#9d9db4",
  "e": "#d9d9e6", "E": "#a6a6bb", "w": "#fffdf7", "W": "#e6e2d6", "v": "#f6f3ea",
  // skin
  "s": "#ffd9c2", "S": "#e9ad8d", "h": "#fff0e4", "x": "#ffb3b3",
  // blonde hair
  "y": "#ffd85a", "Y": "#d9a92a", "i": "#fff0a8",
  // dark hair
  "d": "#2f2a4a", "D": "#1f1b36", "f": "#4a4470",
  // blues
  "b": "#4a8cf0", "B": "#2f62bd", "l": "#8fbcff",
  // reds
  "r": "#f0574c", "R": "#b53329", "c": "#d63d33", "C": "#8a1f18", "X": "#ff8c80",
  // pinks / magenta
  "m": "#ff77b8", "M": "#d64c90", "n": "#ffb0d8",
  // greens
  "g": "#66c96e", "G": "#3a9448", "L": "#7be05a", "K": "#43a83e", "V": "#b8f08a",
  // oranges / browns / yellows
  "o": "#ffa040", "O": "#d97018", "u": "#8a5a36", "U": "#5c3a1f", "t": "#ffd24a", "T": "#c9a021",
  // purples
  "p": "#c98ce6", "P": "#8f56b3",
  // cyan
  "a": "#5ad6cf", "A": "#2fa39c",
  // clown eyes (yellow-green)
  "1": "#e4de5a", "2": "#b3ad3c",
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

// ---------------------------------------------------------------- hero (24 x 32)
// Chibi: big head, blonde swoop with a highlight, huge dark eyes with
// catchlights, rosy cheeks, white tee, blue shorts, sneakers with white soles.

const HERO = [
  "........jjjjjjjj........",
  "......jjyyiiyyyyjj......",
  ".....jyyiiiyyyyyyyj.....",
  "....jyyiiyyyyyyyyyyj....",
  "....jyyyyyyyyyyyyYyj....",
  "...jyYyyyyyyyyyyYYyyj...",
  "...jyYYjjjjjjjjjYYyyj...",
  "...jYjhhssssssssjjYyj...",
  "...jjhssssssssssssjjj...",
  "...jsssjjjssssjjjssssj..",
  "...jsssjwjssssjwjssssj..",
  "...jsssjjjssssjjjssssj..",
  "...jsxxsssssssssssxxsj..",
  "....jsssssjjjjjsssssj...",
  "....jSsssssjjjsssssSj...",
  ".....jSSsssssssssSSj....",
  "......jjSSSSSSSSSjj.....",
  ".....jjwwwwvvwwwwwjj....",
  "....jswwwwwvvwwwwwwsj...",
  "....jswwwwwwwwwwwwwsj...",
  "....jswwwwwwwwwwwwwsj...",
  "....js.wwwwwwwwwwww.sj..",
  "....jj.jWWWWWWWWWWj.jj..",
  ".......jbbbblbbbbbj.....",
  ".......jbbbbbbbbbbj.....",
  ".......jBBBBBBBBBBj.....",
  ".......jssssjjssssj.....",
  ".......jsssj..jsssj.....",
  ".......jSssj..jssSj.....",
  "......jjjjjj..jjjjjj....",
  ".....jkkkkkkjjkkkkkkj...",
  ".....jwwwwwwjjwwwwwwj...",
];

const HERO_SWORD = [
  "..jj....jjjjjjjj........",
  ".jttj.jjyyiiyyyyjj......",
  ".jttjjyyiiiyyyyyyyj.....",
  "..jjjyyiiyyyyyyyyyyj....",
  "..juuyyyyyyyyyyyyYyj....",
  "..juuYyyyyyyyyyyYYyyj...",
  "jEEEEEEjjjjjjjjjYYyyj...",
  "jeeeeEEhhssssssssjjYyj..",
  "jjjeejssssssssssssjjj...",
  "..jeejsjjjssssjjjssssj..",
  "..jeejsjwjssssjwjssssj..",
  "..jeejsjjjssssjjjssssj..",
  "..jeejxxsssssssssssxxsj.",
  "...jeejsssjjjjjsssssj...",
  "...jeejssssjjjsssssSj...",
  "....jeejsssssssssSSj....",
  ".....jejSSSSSSSSSjj.....",
  ".....jjwwwwvvwwwwwjj....",
  "....jswwwwwvvwwwwwwsj...",
  "....jswwwwwwwwwwwwwsj...",
  "....jswwwwwwwwwwwwwsj...",
  "....js.wwwwwwwwwwww.sj..",
  "....jj.jWWWWWWWWWWj.jj..",
  ".......jbbbblbbbbbjqqj..",
  ".......jbbbbbbbbbbjqQj..",
  ".......jBBBBBBBBBBjQQj..",
  ".......jssssjjssssjjj...",
  ".......jsssj..jsssj.....",
  ".......jSssj..jssSj.....",
  "......jjjjjj..jjjjjj....",
  ".....jkkkkkkjjkkkkkkj...",
  ".....jwwwwwwjjwwwwwwj...",
];

// ---------------------------------------------------------------- family (20 x 26)

const MOM = [
  ".......jjjjjjj......",
  ".....jjuuuuuuujj....",
  "....juuuUuuuuUuuj...",
  "...juuUjjjjjjjUuuj..",
  "...juujhssssssjuuj..",
  "...juujssssssssjuj..",
  "...juujsjjssjjsjuj..",
  "...jujsjwjssjwjsjj..",
  "....jjsjjjssjjjsj...",
  ".....jsxxsssssxxj...",
  ".....jSssjjjjsssj...",
  "......jSSssssSSj....",
  ".......jjSSSSjj.....",
  "......jjppppppjj....",
  ".....jspwwwwwwpsj...",
  ".....jspwwwwwwpsj...",
  ".....jspwwwwwwpsj...",
  ".....js.wwwwww.sj...",
  ".....jj.pWWWWp.jj...",
  "........jppppj......",
  "........jppppj......",
  "........jPPPPj......",
  "........jssjssj.....",
  ".......jjjjjjjjj....",
  "......jkkkkjjkkkj...",
  "......jjjjjjjjjjj...",
];

// little sister: black hair, side ponytail, pink top, white shorts
const SIS = [
  "......jjjjjjj.......",
  ".....jddfddddjj.....",
  "....jddfdddddddjj...",
  "....jddjjjjjjjdddj..",
  "....jdjhssssssjddj..",
  "....jjjssssssssjddj.",
  ".....jsjjssssjjsjdj.",
  ".....jsjwjssjwjsjDj.",
  ".....jsjjjssjjjsjj..",
  ".....jsxxssssxxsj...",
  ".....jSssjjjjsssj...",
  "......jSSssssSSj....",
  ".......jjSSSSjj.....",
  "......jjmmmmmmjj....",
  ".....jsmmnmmmmmsj...",
  ".....jsmmmnmmmmsj...",
  ".....jsmmmmmmmmsj...",
  ".....js.wwwwww.sj...",
  ".....jj.jWWWWj.jj...",
  "........jwwwwj......",
  "........jssjsj......",
  "........jssjsj......",
  ".......jjjjjjjj.....",
  "......jSSSjjSSSj....",
  "......jjjjjjjjjj....",
];

// little brother: short black hair, big eyes, blue shirt
const BRO = [
  "......jjjjjjj.......",
  ".....jddfdddddj.....",
  "....jddddddddddj....",
  "....jdjjjjjjjjdj....",
  "....jjhssssssssjj...",
  "....jsssssssssssj...",
  "....jsjjjsssjjjsj...",
  "....jsjwjsssjwjsj...",
  "....jsjjjsssjjjsj...",
  "....jsxxsssssxxsj...",
  "....jSsssjjjjsssj...",
  ".....jSSssssssSj....",
  "......jjSSSSSjj.....",
  ".....jjbbbbbbbjj....",
  "....jsbbblbbbbbsj...",
  "....jsbbbbbbbbbsj...",
  "....jsbbbbbbbbbsj...",
  "....js.bbbbbbb.sj...",
  "....jj.jBBBBBj.jj...",
  ".......jssjssj......",
  ".......jssjssj......",
  ".......jssjssj......",
  "......jjjjjjjjj.....",
  ".....jSSSjjjSSSj....",
  ".....jjjjjjjjjjj....",
];

// cats (18 x 14): round, big eyes, pink inner ears, curled tail
const CAT_ORANGE = [
  "..jj..........jj..",
  ".joxj........jxoj.",
  ".jooxj......jxooj.",
  ".jooojjjjjjjjoooj.",
  "..joooooooooooooj.",
  "..jojjooooooojjoj.",
  "..jjwjoooooojwjjj.",
  "..jojjooojooojjoj.",
  "...jooooOoooooj...",
  "...joOooooooOoj.jj",
  "....jooooooooojjoj",
  "....jooojjoooooooj",
  "....joojj.jooojjj.",
  "....jjjj..jjjj....",
];
const CAT_GREY = [
  "..jj..........jj..",
  ".jqxj........jxqj.",
  ".jqqxj......jxqqj.",
  ".jqqqjjjjjjjjqqqj.",
  "..jqqqqqqqqqqqqqj.",
  "..jqjjqqqqqqqjjqj.",
  "..jjwjqqqqqqjwjjj.",
  "..jqjjqqqjqqqjjqj.",
  "...jqqqqQqqqqqj...",
  "...jqQqqqqqqQqj.jj",
  "....jqqqqqqqqqjjqj",
  "....jqqqjjqqqqqqqj",
  "....jqqjj.jqqqjjj.",
  "....jjjj..jjjj....",
];

// ---------------------------------------------------------------- townsfolk (20 x 26)

const ELDER = [
  ".......jjjjjj.......",
  ".....jjeeeeeejj.....",
  "....jeeezeeezeeej...",
  "...jeeejjjjjjjeeej..",
  "...jeejhsssssjeeej..",
  "...jeejssssssssjej..",
  "...jeejsjjssjjsjej..",
  "...jjjsjwjssjwjsjj..",
  ".....jsjjjssjjjsj...",
  ".....jsxxsssssxxj...",
  ".....jsseeeeeessj...",
  "......jeeeeeeeej....",
  ".......jjeeeejj.....",
  "......jjGGGGGGjj....",
  ".....jsGGGgGGGGsj...",
  ".....jsGGGGGGGGsj...",
  ".....jsGGGGGGGGsj...",
  ".....js.GGGGGG.sj...",
  ".....jj.GGGGGG.jj...",
  "........jGGGGj......",
  "........jGGGGj......",
  "........jUUUUj......",
  "........jssjssj.....",
  ".......jjjjjjjjj....",
  "......jkkkkjjkkkj...",
  "......jjjjjjjjjjj...",
];

const KID = [
  ".......jjjjjj.......",
  ".....jjoooooojj.....",
  "....jooOooooOoooj...",
  "....joojjjjjjjooj...",
  ".....jhssssssssj....",
  ".....jsssssssssj....",
  ".....jsjjsssjjsj....",
  ".....jsjwjssjwjsj...",
  ".....jsjjjssjjjsj...",
  ".....jsxxsssssxxj...",
  ".....jSssjjjjsssj...",
  "......jSSssssSSj....",
  ".......jjSSSSjj.....",
  "......jjaaaaaajj....",
  ".....jsaaawwaaasj...",
  ".....jsaaaaaaaasj...",
  ".....jsaaaaaaaasj...",
  ".....js.aaaaaa.sj...",
  ".....jj.jbbbbj.jj...",
  "........jbbbbj......",
  "........jssjsj......",
  "........jssjsj......",
  ".......jjjjjjjj.....",
  "......jkkkkjjkkkj...",
  "......jjjjjjjjjjj...",
];

const DOG = [
  "...jjj......jjj...",
  "..juuuj....juuuj..",
  "..juuuujjjjuuuuj..",
  "..juuuuuuuuuuuuj..",
  "..jujjuuuuuujjuj..",
  "..jjwjuuuuuujwjj..",
  "..juuuuujjuuuuuj..",
  "...juuuujjuuuuuujj",
  "....juuuuuuuuuuuuj",
  "....juuuuuuuuuuuj.",
  "....juuujjuuujjuj.",
  "....juuj..juuj.j..",
  "....jUUj..jUUj....",
  "....jjjj..jjjj....",
];

// ---------------------------------------------------------------- BUGON (52 x 40)
// Mini boss. The yellow Y on the crayon drawing is read as a blaze marking:
// two big glossy dark eyes with catchlights sit in the arms of the Y, the
// stem runs down to a small nose and a pouty mouth, and heavy angled brows
// give it the bad attitude. Huge floppy ears with pink insides, a gloss on
// the head, skinny red body with arms flung out, yellow legs and feet.

const BUGON = [
  ".........................jjjjjjj........................",
  ".......jjjjjjjj.......jjjXRRRRRRjjj.......jjjjjjjj......",
  ".....jjRRRRRRRRjj...jjXXXXRRRRRRRRRjj...jjRRRRRRRRjj....",
  "....jRRRRRRRRRRRRj.jXXXXRRRRRRRRRRRRRj.jRRRRRRRRRRRRj...",
  "...jRRRRRnnnnnnnnRjjjXXRRRRRRRRRRRRRjjjRnnnnnnnnRRRRRj..",
  "..jRRRRRnnnnnnnnnRCCCjjjRRRRRRRRRjjjRCCCnnnnnnnnnRRRRRj.",
  "..jRRRRnnnnnnnnnnRCCCCCCjjRRRRRjjCCCCCCCnnnnnnnnnnRRRRj.",
  ".jRRRRRnnnnnnnnnRRRRCjjjCCCRRRRCCCjjjCRRRnnnnnnnnnRRRRRj",
  "..jRRRRRnnnnnnnnRRRRjwwwjjjRRRRjjjwwwjRRRnnnnnnnnRRRRRj.",
  "..jRRRRRRnnnnnnnRRRRjwwwhwwjRRjwhwwwwjRRRnnnnnnnRRRRRRj.",
  "...jCCCCCCCCCCCCRRRRjwwwjjwjRRjwjjwwwjRRRCCCCCCCCCCCCj..",
  "....jCCCCCCCCCCCRRRRjwwwjjwjRRjwjjwwwjRRRCCCCCCCCCCCj...",
  ".....jjCCCCCCCCjRRRRjwwwjjwjtRjwjjwwwjRRRjCCCCCCCCjj....",
  ".......jjjjjjjj.jRRRRjwwjjjttttjjjwwjRRRj.jjjjjjjj......",
  "................jRRRRRjjRRtttttttRjjRRRRj...............",
  ".................jRRRRRRRRRtttttRRRRRRRj................",
  ".................jCCCCCCCCCttttCCCCCCCCj................",
  "..................jCCCCCCCCtttCCCCCCCCj.................",
  "...................jCCCCCCCjjjCCCCCCCj..................",
  "....................jjCCCCjjjjjCCCCjj...................",
  "......................jjjCCtttCCjjj.....................",
  ".........................jCjrjCj........................",
  ".............jjj.........jrrrrrj...........jjj..........",
  ".............jjrjj......jrrrrrrrj........jjrjj..........",
  "...............jjrjj...jrrrrrXXrrj.....jjrjj............",
  ".................jjrjjjrrrrrrrrrrrj..jjrjj..............",
  "...................jjrrrrrrrrrrrrrrjjrjj................",
  ".....................jrrrrrrrrrrrrrjjj..................",
  "......................jrrrrrrrrrrrj.....................",
  "......................jrrrrrrrrrrrj.....................",
  ".......................jrrrrrrrrrj......................",
  "........................jrrrrrrrj.......................",
  "........................jttjrjttj.......................",
  "........................jtj.j.jtj.......................",
  "........................jtj...jtj.......................",
  "........................jtj...jtj.......................",
  "........................jtj...jtj.......................",
  "........................jtj...jtj.......................",
  ".......................jtttj.jtttj......................",
  ".......................jjjjj.jjjjj......................",
];

// ---------------------------------------------------------------- LYGON (46 x 46)
// Final boss. Big round white face, three fluffy green tufts, yellow-green
// almond eyes with pupils and catchlights, glossy red ball nose, a wide red
// grin full of teeth, orange shirt under a huge black spiky-shouldered jacket
// with shading, black trousers, grey shoes.

const LYGON = [
  "......................jjjj......................",
  ".....................jLLLVj.....................",
  "....................jLLVLLLj....................",
  "....jjjj............jLLLLLLj............jjjj....",
  "...jLLVLj...........jLKLLLKj...........jLVLLj...",
  "..jLLVLLLj.........jjjjjjjjjj.........jLLLVLLj..",
  "..jLLLLLLj......jjjwwwwwwwwwwjjj......jLLLLLLj..",
  "..jLKLLLKj....jjwwwwwwwwwwwwwwwwjj....jKLLLKLj..",
  "...jjjjj.....jwwwwwwwwwwwwwwwwwwwwj.....jjjjj...",
  "............jwwwwwwwwwwwwwwwwwwwwwwj............",
  "...........jwwwwwwwwwwwwwwwwwwwwwwwwj...........",
  "...........jwwwww1111wwwwwwww1111wwwj...........",
  "..........jwwwww111j11wwwwww11j111wwwwj.........",
  "..........jwwwww11jjj1wwwwww1jjj11wwwwj.........",
  "..........jwwwww11jwj1wwwwww1jwj11wwwwj.........",
  "..........jwwwwww1jjj2wwwwww2jjj1wwwwwj.........",
  "..........jwwwwwww2222wwwwwwww2222wwwwj.........",
  "..........jwwwwwwwwwwwwjrrjwwwwwwwwwwwj.........",
  "..........jwwwwwwwwwwwjrXrrjwwwwwwwwwwj.........",
  "..........jwwwwwwwwwwwjrrrrjwwwwwwwwwwj.........",
  "..........jwwwwwwwwwwwwjRRjwwwwwwwwwwwj.........",
  "...........jwwwjcccccccccccccccjwwwwwj..........",
  "...........jwwjccwcwcwcwcwcwcwccjwwwwj..........",
  "............jwjcccccccccccccccccjwwwj...........",
  ".............jwjcccccccccccccccjwwwj............",
  "..............jwjjCcccccccccCjjwwwj.............",
  "...............jwwwjjjjjjjjjjwwwwj..............",
  "................jjwwwwwwwwwwwwwjj...............",
  "..................jjjwwwwwwwjjj.................",
  ".......jjjjj.........jwooooowj.........jjjjj....",
  "......jkkkkkjj.......jwoooOowj.......jjkkkkkj...",
  ".....jkkkkkkkkjj.....jwooooowj.....jjkkkkkkkkj..",
  "....jkkkkkkkkkkkjjjjjjwoooOowjjjjjjkkkkkkkkkkkj.",
  "...jkkkkkkkkkkkkkkkkkkjooooojkkkkkkkkkkkkkkkkkkj",
  "..jkkkkjkkkkkkkkkkkkkkjoooojkkkkkkkkkkkkkkjkkkkj",
  ".jkkkkjjkkkkkkkkkkkkkkkjoojkkkkkkkkkkkkkkkjjkkkkj",
  "jkkkkjj.jkkkkkkkkkkkkkkjjjjkkkkkkkkkkkkkkj.jjkkkkj",
  "jkkkjj..jkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkj..jjkkkj",
  ".jjj....jkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkj....jjj.",
  "........jkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkj........",
  ".........jkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkj.........",
  "..........jjjjjjjkkkkkkkjjjkkkkkkkjjjjjj..........",
  ".................jkkkkkkj.jkkkkkkj................",
  ".................jkkkkkkj.jkkkkkkj................",
  ".................jkkkkkkj.jkkkkkkj................",
  "..............jjjjzEEEEEjjjEEEEEzjjjj.............",
  ".............jzEEEEEEEEEjjjEEEEEEEEEzj............",
  ".............jjjjjjjjjjjj.jjjjjjjjjjjj............",
];

// ---------------------------------------------------------------- scenery

// round cartoon tree with fruit and a highlight
const TREE = [
  "......jjjjjj......",
  "....jjGGgggGjj....",
  "...jGGggVVgggGj...",
  "..jGggVVggggggGj..",
  "..jGggVgggrggggj..",
  ".jGgggggggggggGGj.",
  ".jGggrgggggggrgGj.",
  ".jGggggggggggggGj.",
  ".jGGgggggrgggGGGj.",
  "..jGGgggggggGGGj..",
  "...jGGGGgGGGGGj...",
  "....jjGGGGGjjj....",
  "......jjUuUj......",
  ".......jUuUj......",
  ".......jUuUj......",
  "......jUUuUUj.....",
  "......jjjjjjj.....",
];

const HOUSE = [
  "..............jRRRRRRRRRRRRRRRRRj.............",
  "............jjRRXXRRRRRRRRRRRRRRRjj...........",
  "..........jjRRRXRRRRRRRRRRRRRRRRRRRjj.........",
  "........jjRRRRRRRRRRRRRRRRRRRRRRRRRRRjj.......",
  "......jjRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRjj.....",
  "....jjRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRjj...",
  "..jjrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrjj.",
  "..jvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvj.",
  "..jvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvj.",
  "..jvvvvjbbbbbjvvvvvvvvvvvvvvvvvvvjbbbbbjvvvvj.",
  "..jvvvvjlwbbbjvvvvvvvvvvvvvvvvvvvjlwbbbjvvvvj.",
  "..jvvvvjbbbbbjvvvvvvvjUUUUUjvvvvvjbbbbbjvvvvj.",
  "..jvvvvjjjjjjjvvvvvvvjUuuuUjvvvvvjjjjjjjvvvvj.",
  "..jvvvvvvvvvvvvvvvvvvjUutuUjvvvvvvvvvvvvvvvvj.",
  "..jvvvvvvvvvvvvvvvvvvjUuuuUjvvvvvvvvvvvvvvvvj.",
  "..jvvvvvvvvvvvvvvvvvvjUuuuUjvvvvvvvvvvvvvvvvj.",
  "..jjjjjjjjjjjjjjjjjjjjUuuuUjjjjjjjjjjjjjjjjjj.",
];

const WAGON = [
  "............jttttttttttttttttttttj............",
  "..........jjtrtrtrtrtrtrtrtrtrtrtjj...........",
  "........jjrtrtrtrtrtrtrtrtrtrtrtrtrjj.........",
  "........jrrrrrrrrrrrrrrrrrrrrrrrrrrrrj........",
  "........jrttrttrttrttrttrttrttrttrttrj........",
  "........jrttrttrttrttrttrttrttrttrttrj........",
  "........jrrrrrrrrrrrrrrrrrrrrrrrrrrrrj........",
  "........jrrrjkkkkkkjrrrrrrrrjkkkkkkjrrj.......",
  "........jrrrjkkllkkjrrrrrrrrjkkllkkjrrj.......",
  "........jrrrjkkkkkkjrrrrrrrrjkkkkkkjrrj.......",
  "........jrrrjjjjjjjjrrrrrrrrjjjjjjjjrrj.......",
  "........jRRRRRRRRRRRRRRRRRRRRRRRRRRRRRj.......",
  ".....jjjUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUjjj....",
  "........jQQQQj....................jQQQQj......",
  ".......jQQqzQQj..................jQQqzQQj.jjj.",
  ".......jQQQQQQj..................jQQQQQQjjQqQj",
  "........jjjjjj....................jjjjjj.jjjj.",
];

const TENT = [
  "......................jtj.....................",
  "......................jtj.....................",
  "....................jjrrrjj...................",
  "..................jjrrXrrrrjj.................",
  "................jjrttrrttrrttjj...............",
  "..............jjrrttrrttrrttrrrjj.............",
  "............jjrrrrttrrttrrttrrrrrjj...........",
  "..........jjrrrrrrttrrttrrttrrrrrrrjj.........",
  "........jjrrrrrrrrttrrttrrttrrrrrrrrrjj.......",
  "......jjrrrrrrrrrrttrrttrrttrrrrrrrrrrrjj.....",
  "....jjrrrrrrrrrrrrttrrttrrttrrrrrrrrrrrrrjj...",
  "..jjrrrrrrrrrrrrrrttrrttrrttrrrrrrrrrrrrrrrjj.",
  "..jrttrrttrrttrrttrrttrrttrrttrrttrrttrrttrrj.",
  "..jrttrrttrrttrrttrrttrrttrrttrrttrrttrrttrrj.",
  "..jrttrrttrrttrrttrjjjjjjjjjrrttrrttrrttrrttrj",
  "..jrttrrttrrttrrttrjkkkkkkkjrrttrrttrrttrrttrj",
  "..jrttrrttrrttrrttrjkkkkkkkjrrttrrttrrttrrttrj",
  "..jjjjjjjjjjjjjjjjjjkkkkkkkjjjjjjjjjjjjjjjjjjj",
];

// wrapped present with a big bow (16 x 16)
const PRESENT = [
  "....jjj....jjj..",
  "...jmmnj..jnmmj.",
  "...jmmmmjjmmmmj.",
  "....jjmmmmmmjj..",
  "..jjjjjjmmjjjjjj",
  ".jbbbbbbjmjbbbbbj",
  ".jblbbbbjmjbbbbbj",
  ".jbbbbbbjmjbbbbbj",
  ".jmmmmmmmmmmmmmmj",
  ".jbbbbbbjmjbbbbbj",
  ".jbbbbbbjmjbbbbbj",
  ".jbbbbbbjmjbbbbbj",
  ".jBBBBBBjmjBBBBBj",
  ".jBBBBBBjmjBBBBBj",
  ".jjjjjjjjjjjjjjjj",
];

// the sword held up on pickup (10 x 28): bright blade, gold guard, blue gem
const SWORD = [
  "....jj....",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  "...jwej...",
  ".jjjttjjj.",
  "jtttttttttj",
  ".jjjuujjj.",
  "...juuj...",
  "...juuj...",
  "...juuj...",
  "...juuj...",
  "..jtlbtj..",
  "..jtbbtj..",
  "...jttj...",
  "....jj....",
];

window.SPRITES = {
  hero: HERO, hero_sword: HERO_SWORD, mom: MOM, sis: SIS, bro: BRO,
  cat1: CAT_ORANGE, cat2: CAT_GREY,
  elder: ELDER, kid: KID, dog: DOG,
  bugon: BUGON, lygon: LYGON,
  tree: TREE, house: HOUSE, wagon: WAGON, tent: TENT, present: PRESENT, sword: SWORD,
};
window.pixels = pixels;
