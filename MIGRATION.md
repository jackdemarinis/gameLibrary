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
