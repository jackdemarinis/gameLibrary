# JackGames

JackGames: a small, installable web arcade with a game-portal home page. It holds three
original games:

| Game | Path | Players | Engine | Source |
| --- | --- | --- | --- | --- |
| **Pétanque Park** | `/petanque/` | 1–4, local or online by room code | Three.js | `games/petanque/` |
| **Dustline Brigade** | `/dustline/` | 1 | Phaser 3 | `games/dustline/` |
| **Lanternwake** | `/lanternwake/` | 1 | Phaser 3 | `games/lanternwake/` |

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
  lanternwake/   Lanternwake: its own npm project (Phaser)
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

## Deploy (Railway)

One service. `nixpacks.toml` installs Node and Python and runs `npm run build`,
which runs `buildAll.py --install` (a clean `npm ci` per project). `railway.json`
starts uvicorn and health-checks `/api/health`. Set any `.env.example` variables
in Railway; the defaults are fine. Rooms live in memory, so keep one replica.

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
- WASD to drive, the mouse to aim, click to fire.
- Enter moves you forward through the menus, and Esc takes you back.

The save lives in localStorage. Design notes: `games/dustline/PLAN.md`, `TODO.md`.

### Lanternwake

Compact pixel-art survival adventure:
- Gather timber and ironstone.
- Forge the Ember Lantern.
- Drive back the shades and defeat the Mirewarden.

WASD to move, Space to swing, E to gather or forge, Esc to return to the
library. All sprites (player run cycle, cottages, props, HUD icons) are built in
code from character maps.
