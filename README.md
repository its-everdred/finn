# finn

Small games, playable in the browser. Everything is static — no build step.

**Play:** https://its-everdred.github.io/finn/

## games/

### [RestoreBound](games/restorebound/)

An Earthbound-inspired turn-based RPG opening.

A quiet night, then booming, banging, and purple light flashing in every
window. You find a present in your sister's room — a sword. Then **Lygon**
breaks in, kidnaps your little brother and sister, and seals the front door on
his way out. Find the spare key behind your brother's bed, talk to Mom and
Dad, and go up the hill into the cave: six of Lygon's critters, then **Bugon**
at the inner door, then Lygon himself.

- Name your hero, your brother, your sister, and your dog
- Arrows, numpad (8/4/6/2) or WASD to move; `Space` is the main button; `/` is back; `M` mutes
- Battles: **Slash**, **PSI** (Fire, Ice, Starstorm), **Items** (Cookie, Juice)
- Progress saves automatically in the browser; **Restart from beginning** wipes it
- Music is synthesized live with the Web Audio API — funky chiptune, no audio files
- The hero, the family, and all eight enemies are pixel versions of crayon drawings

Built on [Kaboom.js](https://kaboomjs.com) (MIT). Sprites are pixel grids in
`sprites.js` (the enemies are generated from shape primitives); music lives in
`music.js`.

## Adding a game

Make a folder under `games/` with an `index.html`, and add a card to the root
`index.html`. That's it — GitHub Pages serves the repo as-is.
