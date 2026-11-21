# Game Library

A small, installable web arcade with a console-style game-select menu. It holds three
original games:

| Game | Path | Players | Engine |
| --- | --- | --- | --- |
| **Pétanque Park** | `/petanque/` | 1–4, local or online by room code | Three.js |
| **Dustline Brigade** | `/dustline/` | 1 | Phaser 3 |
| **Lanternwake** | `/lanternwake/` | 1 | Phaser 3 |

PC only: every game needs a keyboard and mouse. There are no touch controls.

## Stack

- **Frontend:** TypeScript, Vite (multi-page build, `base: "./"`), Vitest.
  Three.js for Pétanque and Phaser 3 for the other two games. The library home
  page is plain TypeScript and CSS.
- **Backend:** Python 3 with FastAPI and uvicorn, in `app/`. It does two things:
  - It serves the built `dist/` folder.
  - It relays messages for multiplayer rooms over `/ws/rooms/{code}`.

  The server knows nothing about game rules. The host's browser referees the
  match, and the server only forwards messages.
- **Config:** environment variables, read only in `app/config.py` and documented
  in `.env.example`.

## Run locally

```bash
npm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Option A: one server, production-like
npm run build
.venv/bin/uvicorn app.main:app --reload        # http://localhost:8000

# Option B: hot reload. Vite proxies /ws to uvicorn on :8000.
.venv/bin/uvicorn app.main:app --reload &
npm run dev                                    # http://localhost:5173
```

To try online play on one machine, open Pétanque in two tabs. Choose **Host a
room** in one tab and join with the code in the other.

## Test

```bash
npm test                                         # Vitest (simulations, rules)
.venv/bin/python -m unittest discover -s tests   # room server
npm run build                                    # tsc + vite + precache step
```

## Deploy (Railway)

The app deploys as one service. `nixpacks.toml` installs Node and Python and runs
`npm run build`. `railway.json` then starts uvicorn and health-checks
`/api/health`. Set any of the `.env.example` variables in Railway's variables
tab; the defaults are fine. Rooms live in memory, so keep the service at one
replica.

## Layout

```
index.html            library menu (src/library/; add games in games.ts)
petanque/index.html   Pétanque Park (src/petanque/)
dustline/index.html   Dustline Brigade (src/main.ts, src/phaser/, src/game/)
lanternwake/          Lanternwake (same Phaser app, starts in AdventureScene)
app/                  FastAPI room relay + static hosting
public/               service worker, manifest, icons, library card art
scripts/              precache step, theme/standards sync, icon generator
```

## Games

### Pétanque Park

Sunny-park boules with golf-style controls:
- Aim with the mouse or arrow keys.
- Hold Space to fill the power meter and release to throw.
- Choose a lob, half-lob or roll.

Everything you see is generated in code. That covers the clearcoat "toy"
characters with painted faces that change expression and blink, the park,
textures and lighting. There are no external models or images.

Pétanque has its own Wii-style palette in `src/petanque/config/theme.ts`. See
MIGRATION.md for why.

### Dustline Brigade

Top-down tank campaign:
- Buy upgrades in the garage, then pick a level.
- WASD to drive, the mouse to aim, click to fire.
- Enter moves you forward through the menus, and Esc takes you back.

The save lives in localStorage.

### Lanternwake

Compact pixel-art survival adventure:
- Gather timber and ironstone.
- Forge the Ember Lantern.
- Drive back the shades and defeat the Mirewarden.

WASD to move, Space to swing, E to gather or forge, Esc to return to the
library. All sprites are built in code from character maps.

## Offline / install

After `vite build`, `scripts/precacheServiceWorker.py` writes every built file
and a content-hash version into `dist/sw.js`. The service worker never caches
`/api/` or `/ws/`. Single-player games work offline. Online rooms need the
server.

## Shared standards

Managed by webMaster at `sites/gameLibrary`:
- Menus, the HUD and the library use the shared navy/orange theme through the
  vendored `src/theme.css`. Never edit that file by hand. It is vendored by
  `webmaster/scripts/sync_theme.py`.
- The site-specific mapping lives in `src/themeAdapter.css`.

See [STANDARDS.md](STANDARDS.md) and [MIGRATION.md](MIGRATION.md).
