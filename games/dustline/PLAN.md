# Plan

## Product direction

Dustline Brigade is an original top-down browser tank shooter that pulls mood from classic arcade tank games without copying any exact layouts, branding, art, or UI. The reference images point to a readable military-arcade feel: olive and forest greens, warm yellow call-to-action surfaces, compact stat cards, short level loops, and top-down corridor combat.

## Architecture rules

- Keep simulation state outside Phaser scenes.
- Keep scenes thin and renderer-focused.
- Use DOM overlays for HUD and menu-heavy surfaces.
- Keep tuning values centralized in config and content files.
- Save only serializable progression data in localStorage.
- Build for placeholder art first and preserve clean upgrade paths for later prompts.

## Milestone map

`Prompt 0` foundation:
- Bootstrap Phaser + TypeScript + Vite.
- Establish save boundary, scene flow, content/config folders, input actions, manifest keys, and original shell visuals.
- Seed `PLAN.md` and `TODO.md`.

`Prompt 1` MVP combat:
- Player movement, aiming, firing, health, one enemy, coins, win/lose states, wall collision, impact effects, HUD wiring.

`Prompt 2` fog of war:
- Tile- or mask-based discovery, bright current visibility, dim explored memory, black unexplored space.

`Prompt 3` combat feel and destructibles:
- Breakable crates and weak walls, impact sparks, recoil, shake, debris, better test map.

`Prompt 4` AI and level loop:
- Three enemy archetypes, state-driven AI, results screen, level completion flow.

`Prompt 5` shop and persistence:
- Upgrade store, nonlinear costs, save progression, continue/new game, level select unlocks.

`Prompt 6` weapon system:
- Data-driven weapon configs, unlock flow, swap controls, HUD support, balancing hooks.

`Prompt 7` campaign:
- 10 handcrafted levels, difficulty settings, full front-end flow, meaningful progression.

`Prompt 8` polish:
- Cohesive UI pass, title branding, menus, transitions, camera damping, stats and achievements, performance cleanup.

## Prompt 0 completion notes

- Scene shell created: `BootScene`, `MenuScene`, `BattleScene`.
- Shared service boundary created through `SceneBridge`.
- Save storage is versioned and isolated in a dedicated store.
- Input actions and default bindings are declared up front for later prompts.
- Battlefield preview content is data-authored instead of hardcoded inside a scene update loop.
- UI theme reflects the reference mood without copying exact source layouts.

## Prompt 1 completion notes

- Added authored combat tuning in `src/game/config/battleConfig.ts`.
- Added a real test level in `src/game/content/trainingGround.ts`.
- Replaced the preview-only battle shell with a fixed-step simulation and separate systems for player control, enemy logic, projectiles, health, pickups, and HUD state.
- Implemented live WASD movement, cursor-based turret aiming, left-click shooting, enemy fire, wall collision, impact effects, coin drops, coin pickup, and win/lose states.
- HUD now reflects real health, money, remaining enemies, and encounter state.
- Added simulation tests for wall collision, victory plus pickup flow, and defeat flow.

## Next milestone

Prompt 2 should add fog-of-war exploration on top of the current combat sandbox without coupling the visibility logic to the Phaser scene.

## Library addition: Lanternwake

- Second game reachable from the start screen's Game Library card; Dustline Brigade flow is unchanged.
- Same architecture rules: fixed-step pure simulation in `src/game/adventure/`, thin `AdventureScene`, DOM HUD via `SceneBridge.showHud`.
- Scope: move, gather two resources, craft one upgrade, three shades, one boss. No persistence or randomness.

## Grid maps, room flow, distinct tanks, pixel menus (2026-11-21)

### Maps
Levels are text maps on one 64px grid (`src/game/content/tileMap.ts`, legend at the
top). Every wall, brick and crate is one square cell. Each map is a chain of rooms:
staging → skirmish → chokepoint → optional vault (gold crates `$`, stashes `O`,
repair `+`, rapid fire `!`, often behind bricks) → hard room → command room. The
briefing screen shows that route; level select shows a tier badge.

### Campaign order (levelCatalog.ts)
1 Training Yard (easy, raiders) · 2 Relay Station (easy, skirmishers) · 3 Coin Cellar
(bonus) · 4 Quarry Switchbacks (bulwarks) · 5 Signal Ridge (lancers) · 6 Supply Depot
(bonus) · 7 Scrapyard Maze (hard) · 8 Iron Gauntlet (hardest) · 9 Dustline Citadel (Warden boss).

### Enemy roster
| Type | Colour | Look | Plays |
| --- | --- | --- | --- |
| Raider | red | cross stripe, dome | standard |
| Skirmisher | teal | small, arrow chevron | fast, flanks |
| Bulwark | slate | wide, armour skirts, square twin-barrel turret | slow, 2-shell volley |
| Lancer | purple | long hull, long barrel | sniper, holds position |
| Warden | black/gold | big, gold trim, triple barrel | boss, 3-shell spread |

Enemies path around walls with a grid BFS (`simulation/battle/navigation.ts`)
when they lose a straight line to their target.
