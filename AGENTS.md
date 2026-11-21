# Repository conventions

Explicit user instructions take precedence. See README.md for the layout.

- **Games are independent projects.** Work inside one `games/<game>/` folder at a
  time. Never import from another game, from `library/`, or from the repo root.
  To reuse code, copy it in. `python3 scripts/checkIsolation.py` must pass.
- **Test and build the game you changed** from its folder (`npm test`,
  `npm run build`). Before reporting completion on cross-cutting work, run
  `npm test` and `npm run build` at the repo root.
- **Commit per game** (`git add games/<game>`). If other agents may be working in
  this checkout, use your own git worktree and branch.
- Each project owns its look: `src/theme.css` + `src/jackGames.css` tokens. Use
  `var(--token)` for colours, fonts, radii and shadows; add a token to that
  project's files instead of hardcoding. In-game HUDs match their game's art.
- Use camelCase for new folders, files, functions, variables and CSS classes,
  except required tool filenames and established APIs.
- Scripts are Python (`scripts/`). The server is FastAPI (`app/`); env vars are
  read only in `app/config.py` and documented in `.env.example`.
- Keep secrets and local runtime data out of Git. Preserve unrelated changes.
- All game art and content stay original: same genre is fine, no recreations of
  existing games.
