# JackGames

JackGames: a small, installable web arcade with a game-portal home page. It holds three
original games:

| Game | Path | Players | Engine | Source |
| --- | --- | --- | --- | --- |
| **Pétanque Park** | `/petanque/` | 1–4, local or online by room code | Three.js | `games/petanque/` |
| **Dustline Brigade** | `/dustline/` | 1 | Phaser 3 | `games/dustline/` |
| **Lanternwake** | `/lanternwake/` | 1 | Three.js + Rapier | `games/lanternwake/` |

PC only: every game needs a keyboard and mouse. There are no touch controls.

## How the repo is organised

**Every game is its own independent project.** Each folder in `games/` has its
own `package.json`, lockfile, `node_modules`, Vite config, tests and theme. No
game imports code from another game or from the library. To reuse something,
copy it into the other game; from then on the two copies evolve separately.
`scripts/checkIsolation.py` enforces this (it runs in every build and test run).

```
games/
  dustline/      Dustline Brigade: its own npm project (Phaser)
  lanternwake/   Lanternwake: its own npm project (Three.js + Rapier)
  petanque/      Pétanque Park: its own npm project (Three.js)
library/         the home page + install shell (icons, manifest, service worker)
app/             FastAPI: serves the built site, relays Pétanque's online rooms
tests/           room-server tests (unittest)
scripts/
  buildAll.py         build every project, assemble dist/, write the SW precache
  testAll.py          isolation check + every game's tests + server tests
  checkIsolation.py   fail on any cross-project import
  projects.py         the list of projects (library + every games/* folder)
  precacheServiceWorker.py, makeIcons.py
```

The root `package.json` only holds two commands (`npm run build`, `npm test`)
that call the Python scripts. There is no shared code at the root.

## Work on one game

```bash
cd games/lanternwake
npm install
npm run dev        # http://localhost:5175 (dustline :5174, petanque :5176, library :5173)
npm test
npm run build      # this game only, into games/lanternwake/dist
```

Commit a game's changes on their own (`git add games/lanternwake`). When
several agents work at once, give each its own git worktree and branch.

### Add a new game

1. Copy the closest existing game folder to `games/<newGame>/` and strip it down.
2. Give it a `vite.config.ts` port of its own and a page title.
3. Add a card in `library/src/games.ts` (and cover art in `library/public/library/`).

`buildAll.py` picks up any `games/*` folder that has a `package.json`.

## Run the whole site locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run build                                  # = python3 scripts/buildAll.py --install
.venv/bin/uvicorn app.main:app --reload        # http://localhost:8000
```

For online Pétanque with hot reload, run uvicorn (port 8000) and
`cd games/petanque && npm run dev`; its dev server proxies `/ws` to uvicorn.
Open it in two tabs, host a room in one, and join with the code in the other.

## Test

```bash
npm test           # = python3 scripts/testAll.py: isolation check, all game tests, server tests
```

## Deploy (Mac mini)

games.jackdemarinis.com runs on the Mac mini home server as the `games` service in
`~/homeserver/docker-compose.yml`, built from the checkout at `~/homeserver/gameLibrary`
(Cloudflare Tunnel -> Caddy -> `games:8000`).

One image, built from the `Dockerfile`: a Node 22 stage runs `npm run build`
(`buildAll.py --install`, a clean `npm ci` per project), then a slim Python image
serves `dist/` with uvicorn. Rooms live in memory, so keep one replica.

**Pushing to `main` deploys automatically.** The launchd job
`com.homeserver.games-autodeploy` runs `~/homeserver/scripts/gamesAutoDeploy.py`
every 2 minutes. When `origin/main` is ahead of the last deployed commit it
fast-forwards the checkout and runs `docker compose up -d --build games`. A failed
build is retried on the next run. Log: `~/homeserver/data/games-autodeploy/deploy.log`.

Deploy by hand: `cd ~/homeserver/gameLibrary && git pull && cd .. && docker compose up -d --build games`.

`railway.json` is left over from the old Railway deploy and is unused.

## Offline / install

`buildAll.py` copies `library/dist` to `dist/`, each game's `dist` to
`dist/<game>/`, then `precacheServiceWorker.py` writes every built file and a
content-hash version into `dist/sw.js`. The service worker never caches `/api/`
or `/ws/`. Single-player games work offline. Online rooms need the server.

## Look

Each project owns its look: `src/theme.css` (base tokens) plus `src/jackGames.css`
(the JackGames brand values) in the library, Dustline and Lanternwake. Pétanque
keeps its palette in `games/petanque/src/config/theme.ts`. There is no shared or
synced theme. In-game HUDs match their game's art (Lanternwake's is a wood and
parchment pixel skin in `games/lanternwake/src/lanternwakeHud.css`).

## Games

### Pétanque Park

Boules on two courts (Village Square, Seaside Promenade), with a late-2000s
console look:
- **Setup.** Play 1 vs 1 or 2 vs 2. Make each slot Human or CPU (Easy, Normal
  or Hard), choose its team, and pick from 10 characters. Choose the court and
  the target score (7 or 13). Presets cover you vs CPU, two players on one PC,
  and you plus 3 CPUs. Online, the host sets the court and each CPU's difficulty.
- **Throwing.** Aim with ← →, and use ↑ ↓ to switch between roll and lob.
  Then press Space three times: start, lock the **distance** sweep, and lock the
  **straightness** sweep. The closer you stop near the centre, the straighter
  the throw.
- **Camera.** Broadcast-style cuts: an intro crane, over-the-shoulder aim, ball
  chase, a low trackside landing shot, a measuring shot over the jack, and a
  reaction shot.

Everything you see is generated in code: characters (also rendered as
select-screen portraits), both courts and the canvas textures. The 3D view
renders at 480 lines with bloom and a colour-grade, bleed, grain and dither pass
(`games/petanque/src/view/wiiLook.ts`), then CSS stretches it to the window.

### Dustline Brigade

Top-down tank campaign:
- Buy upgrades in the garage, then pick a level.
- WASD to drive, the mouse to aim, click to fire (hold for the autocannon).
- Five cannons: Field Cannon, Autocannon, Scattergun, Rebound Cannon (bounces
  off up to 5 walls) and Beam Laser (pierces a line of tanks). Buy them and
  level up their damage on the garage's Armory tab. In battle, switch with
  1-5, the mouse wheel, or a click on the inventory above the HUD.
- Power-ups (repair, rapid fire, freeze) are hidden in crates you break.
- Enter moves you forward through the menus, and Esc takes you back.
- Esc (or the gear button) opens settings: music and effects volume, key
  rebinding, restart, and back to the main menu. M mutes by default.
- Music and sound effects are synthesized in code (`games/dustline/src/phaser/audio/`):
  `dustlineMusic.ts` sequences an original menu track and battle track, and
  `dustlineSound.ts` plays the effects. There are no audio files.

The save lives in localStorage. Design notes: `games/dustline/PLAN.md`, `TODO.md`.

### Lanternwake

Retro 3D action adventure with a late-90s console look: a 480x270 render with
vertex snapping, 15-bit dithered colour, fog and lantern-lit darkness.
- Third-person sword combat (three-hit combo, dodge roll, lock-on) and a lantern
  flare that stuns Shades and lights braziers.
- Rapier physics: pushable crates on pressure plates, breakable pots, knockback.
- XP levels, heart vessels, way-lantern checkpoints that save, boss fights.

WASD + mouse (pointer lock), click/J sword, Space roll, Q/right-click flare,
E talk/use, Tab lock on, Esc pause. Gamepad supported. All models, textures and
sounds are generated in code (`src/world/`, `src/engine/`). Story bible:
`games/lanternwake/design/storyBible.md`.
