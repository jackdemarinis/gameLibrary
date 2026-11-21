# Standards integration

The site is branded **JackGames**. Menus, controls and HUD use the shared token
names from the vendored `src/theme.css`, but `src/jackGames.css` re-points their
values to the JackGames look (see below). `src/themeAdapter.css` maps the older
Dustline/Lanternwake selectors onto those tokens without changing the simulation
or saved-game schema. `uiTheme` aliases shared tokens; it does not replace the
shared accent-soft token.

Phaser + TypeScript + Vite remain deliberate exceptions to the vanilla frontend
rule: this is a realtime game with an existing tested simulation. Battlefield,
tank illustrations, sprites, and gameplay-specific colors in `worldTheme` remain
art assets. Existing UI CSS contains legacy declarations overridden by the
adapter; migrate those selectors to direct token use when editing them. Existing
classes and types retain their names. All new names use camelCase unless a tool
or established public API requires otherwise.

Validation: `npm run build` and `npm test`.

## JackGames brand: not the portfolio theme (exception, approved 2026-11-21, restyled the same day)

You asked for a game-portal look instead of the portfolio's navy/orange,
Orbitron/Montserrat theme. It covers the home page and the game screens around
gameplay (menus, buttons, HUD); game worlds and art keep their own palettes.

- **Look:** "homebrew terminal". Near-black, phosphor green accent, amber
  second colour, ANSI cyan/magenta for categories, IBM Plex Sans for text with
  IBM Plex Mono for labels and UI bits, slightly rounded 6–14px corners, 1px rules. Flat: no gradients, drop shadows or bounce.
- **Where it lives:** `src/jackGames.css` is the only file that sets this site's
  token values. It loads right after the vendored `src/theme.css`, keeps the
  shared token names, and adds a few (`--accent-ink`, `--accent-edge`,
  `--highlight`, `--grape`, `--ring-*`, `--title-shadow`). The shared
  `*-gradient` tokens resolve to solid colours and shadow tokens to `none`.
  The vendored theme is untouched, so `sync_theme.py` still works.
- **Rule still holds:** site stylesheets use `var(--token)` only. New values go in
  `jackGames.css`, not inline.
- **Pétanque Park**'s 3D courts keep their own palettes (art, in
  `courtPalettes` in `src/petanque/config/theme.ts`). Its menus and HUD use the
  same terminal look through that same file. The 3D view deliberately renders
  at low resolution, with a post-process grade, to get the soft console look.
- **Icons** come from `scripts/makeIcons.py` (green terminal-window mark).
- **Game covers** in `public/library/` are AI-generated key art (ChatGPT image
  generation, 1536×1024, saved as JPG). Each game's crop is `artFocus` in
  `src/library/games.ts`.

To go back to the portfolio look, stop importing `jackGames.css` and restore the
Google Fonts link for Montserrat/Orbitron in the three page heads.

## FastAPI backend (new)

Online rooms need a server. `app/` is a small FastAPI WebSocket relay that
follows the house patterns:
- camelCase names.
- `app/config.py` is the only place that reads env vars, and they're documented
  in `.env.example`.
- Every message the server sends is built in `serialize.py`.
- Errors use `{"error":{"code","message"}}`.

It also serves `dist/`, so the whole library deploys as one Railway service
(`railway.json`, `nixpacks.toml`). The static `npm run preview` path still works
for the single-player games.
