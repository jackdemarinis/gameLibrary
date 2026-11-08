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

## Shared standards and style

Managed by webMaster at `sites/gameLibrary`. Menus and HUD inherit the shared
navy/orange theme, Orbitron/Montserrat typography, and component tokens through
`src/theme.css` and `src/themeAdapter.css`. The battlefield and tank artwork
retain their game palette.

Read [STANDARDS.md](STANDARDS.md) and [MIGRATION.md](MIGRATION.md). Phaser,
TypeScript, Vite, existing save data, and gameplay remain in place. New names
use camelCase. Update the vendored theme and standards from webMaster with
`python3 scripts/sync_theme.py` and `python3 scripts/syncStandards.py`, each with
an optional `--check` flag. Validate with `npm run build` and `npm test`.

## Game library

The start screen hosts the library. Dustline Brigade keeps its main **Play**
button; a **Game Library** card below it launches the second game.

**Lanternwake** is an original compact survival adventure with its own chunky
pixel-art look (earthy sandbox mood: grass, dirt road, ore rocks, a corrupted
brick shrine, and a night that deepens each chapter, lit by torches and your
lantern). All art is generated in code from character maps, so there are no
external sprite assets. As Cinderhollow's last lantern-keeper you gather timber and
ironstone, forge the Ember Lantern at the workbench, drive back three shades to
open the shrine gate (the unlit staff only staggers shades, so the lantern comes
first), and defeat the Mirewarden, which only ember light can
wound. Its four chapters (Dusk → Nightfall → Midnight → Before Dawn) frame a
longer-campaign arc but play in a few minutes. Controls: WASD/arrows to move,
Space to swing, E to gather or forge, Esc to return to the library. It has no
save data; each run starts fresh.

- Pure, deterministic logic: `src/game/adventure/` (tested in
  `AdventureSimulation.test.ts`).
- Renderer: `src/phaser/scenes/AdventureScene.ts`; textures built in
  `src/phaser/adventure/lanternwakeTextures.ts` from the pixel maps in
  `src/game/adventure/adventureSprites.ts`; art palette in
  `src/game/config/adventureTheme.ts`; library card styles in `src/library.css`.
  In-canvas labels use the Pixelify Sans web font; the DOM HUD keeps the shared
  theme tokens.

## Web app

The build is an installable, offline-capable web app named **Game Library**.

```bash
npm run build      # tsc, vite build (relative paths, base "./"), then precache step
npm run preview    # serves dist/ at http://localhost:4173
```

Host `dist/` from any static server, at the root or in a subfolder. Open it in
Chrome or Edge and use **Install app** in the address bar. After one visit it
runs offline, including its web fonts.

- `public/sw.js` is the service worker. After `vite build`,
  `scripts/precacheServiceWorker.py` writes every built file and a content-hash
  version into `dist/sw.js`, so each deploy installs a complete cache and deletes
  the previous one. The build needs `python3`.
- The manifest and icons live in `public/`. Regenerate the icons with
  `python3 scripts/makeIcons.py` (requires Pillow).
- **Desktop only:** both games need a keyboard, and there are no touch
  controls yet. The manifest uses `standalone` with no orientation lock, so it
  doesn't push phone installs.
