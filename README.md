# Dustline Brigade

Original browser tank-shooter foundation build for prompt 0.

## Stack

- Phaser 3
- TypeScript
- Vite
- localStorage persistence boundary

## Run

```bash
npm install
npm run dev
```

## Current scope

This milestone establishes the project architecture, original visual direction, save boundary, roadmap docs, and a playable shell scene that future prompts can extend without collapsing into a single giant scene file.

## Game library

The start screen hosts the library. Dustline Brigade keeps its main **Play**
button; a **Game Library** card below it launches the second game.

**Lanternwake** is an original compact survival adventure (placeholder shapes,
no external assets). As Cinderhollow's last lantern-keeper you gather timber and
ironstone, forge the Ember Lantern at the workbench, drive back three shades to
open the shrine gate, and defeat the Mirewarden, which only ember light can
wound. Its four chapters (Dusk → Nightfall → Midnight → Before Dawn) frame a
longer-campaign arc but play in a few minutes. Controls: WASD/arrows to move,
Space to swing, E to gather or forge, Esc to return to the library. It has no
save data; each run starts fresh.

- Pure, deterministic logic: `src/game/adventure/` (tested in
  `AdventureSimulation.test.ts`).
- Renderer: `src/phaser/scenes/AdventureScene.ts`; art palette in
  `src/game/config/adventureTheme.ts`; library card styles in `src/library.css`.
