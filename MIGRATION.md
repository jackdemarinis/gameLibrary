# Standards integration

Menus, controls, and HUD use webMaster's navy/orange palette, Montserrat/Orbitron,
and shared shapes through `src/theme.css` and `src/themeAdapter.css`. The adapter
maps existing selectors without changing the simulation or saved-game schema.
`uiTheme` aliases shared tokens; it does not replace the shared accent-soft token.

Phaser + TypeScript + Vite remain deliberate exceptions to the vanilla frontend
rule: this is a realtime game with an existing tested simulation. Battlefield,
tank illustrations, sprites, and gameplay-specific colors in `worldTheme` remain
art assets. Existing UI CSS contains legacy declarations overridden by the
adapter; migrate those selectors to direct token use when editing them. Existing
classes and types retain their names. All new names use camelCase unless a tool
or established public API requires otherwise.

Validation: `npm run build` and `npm test`.

## Pétanque Park: own art palette (exception, needs your OK)

Pétanque's 3D world and its in-game UI use a bright Wii-style palette
(`src/petanque/config/theme.ts`, with Baloo 2 and Nunito fonts) instead of the
navy/orange theme. The reason: you asked for it to look like a Wii sports game.
The shared theme's dark navy fights that look. The library home page and the
`‹ Library` link still use shared tokens.

If you'd rather keep everything on the shared theme, the in-game panels
(`src/petanque/petanque.css`) can switch to `var(--token)` values. The 3D scene
colours would stay art assets, the same as Dustline's battlefield.

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
