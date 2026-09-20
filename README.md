# finn

Small games, playable in the browser. Everything is static — no build step.

**Play:** https://its-everdred.github.io/finn/

## games/

### [RestoreBound](games/restorebound/)

An Earthbound-inspired turn-based RPG opening.

Something crashes on the hill in a storm of purple light. You find a present in
your sister's room — a sword. Then **Lygon** breaks in and kidnaps your little
brother and sister. Fight past **Bugon**, get into the tent, and bring them home.

- Name your hero, your brother, your sister, and both cats
- Arrows, numpad (8/4/6/2) or WASD to move; `Space` is the main button; `/` is back
- Battles: **Slash**, **PSI** (Fire, Ice, Starstorm), **Items** (Cookie, Juice)
- Progress saves automatically in the browser; **Restart from beginning** wipes it
- The hero, both siblings and both bosses are pixel versions of crayon drawings

Built on [Kaboom.js](https://kaboomjs.com) (MIT). All sprites are hand-drawn
pixel grids in `sprites.js`, rendered to canvas at load.

## Adding a game

Make a folder under `games/` with an `index.html`, and add a card to the root
`index.html`. That's it — GitHub Pages serves the repo as-is.
