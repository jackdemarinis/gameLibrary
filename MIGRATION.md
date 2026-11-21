# Migration notes

## 2026-11-21: independent games, no shared theme

The repo used to be one Vite app. Dustline and Lanternwake ran inside the same
Phaser game, sharing `src/main.ts`, `AppChrome`, `SceneBridge` and one large
stylesheet. Every page also imported a theme vendored from the webMaster repo.

Now:
- Each game is its own npm project in `games/<game>/`. The library home page
  and install shell are `library/`.
- Dustline kept the original files and their git history. Lanternwake got a
  copy of what it uses, trimmed down: it starts `AdventureScene` directly,
  talks to its own small `AppChrome` (HUD only), and has no `SceneBridge`.
- No project imports another (`scripts/checkIsolation.py`).
- The webMaster theme sync is gone. Each project's `theme.css` is its own file.
- Root build and test are Python scripts (`buildAll.py`, `testAll.py`).

### Cleanup left for later

- `games/lanternwake/src/styles.css` and `themeAdapter.css` are full copies of
  Dustline's stylesheets. Lanternwake only uses the shell layout, buttons and
  `hud-*` rules, so the rest can be deleted.

## Deliberate exceptions to the vanilla-frontend preference

Phaser/Three.js + TypeScript + Vite stay. These are realtime games with tested
simulations, and a build step earns its place here.

## FastAPI backend

Online rooms need a server. `app/` is a small FastAPI WebSocket relay:
- camelCase names.
- `app/config.py` is the only place that reads env vars (see `.env.example`).
- Every message the server sends is built in `serialize.py`.
- Errors use `{"error":{"code","message"}}`.

It also serves the assembled `dist/`, so the whole site deploys as one Railway
service.
