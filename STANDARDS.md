<!-- Generated from webMaster/STANDARDS.md; edit the source and run scripts/syncStandards.py. -->

# Standards

One set of conventions across every site, so that moving between them takes no
relearning. The aim is that you can open any repo and already know where things
are and what they're called.

Two reference points:

- **Look:** the portfolio site. Its design language is extracted into
  [`shared/theme.css`](shared/theme.css) and vendored into every site.
- **Shape:** the `todo` repo. It's Python/FastAPI with an `app/` + `static/`
  layout, and it's the template the other backends move toward.

## Languages

| Layer | Standard | Notes |
|---|---|---|
| Backend | **Python 3.11+ / FastAPI** | `todo` already is. `dash` and `inventory` are Node today and migrate later — each has a `MIGRATION.md` describing the port. |
| Frontend | **Vanilla HTML + CSS + ES modules** | No framework, no build step. Every site loads `theme.css` then its own stylesheet. |
| Tooling / scripts | **Python** | New scripts are Python, not Bash or Node, unless they must run where Python isn't available. |
| Native / compute | **C++17 + CMake** | Only where it earns its place — see [C++](#c-where-it-actually-belongs). None of the web backends qualify. |

Rule of thumb: if you're writing something new and have a choice, write it in
Python. Don't rewrite something working just because it's in another language —
put it on the migration list instead.

## Directory layout

Every app repo:

```
<repo>/
  app/                  # Python package: the backend
    __init__.py
    main.py             # app factory + startup; the entry point
    config.py           # settings from env vars, one place
    db.py               # engine/session/connection handling
    models.py           # ORM models
    serialize.py        # model -> dict for JSON responses
    auth.py             # authentication, if the app has any
    routers/            # one module per resource, mounted in main.py
      __init__.py
      <resource>.py
  static/               # everything served to the browser
    index.html
    css/
      theme.css         # vendored, DO NOT EDIT — see below
      app.css           # this site's own styles
    js/
      app.js            # ES module entry point
      api.js            # fetch wrappers, one place that knows the routes
    icons/
    manifest.webmanifest
  scripts/              # operational scripts (Python)
  db/
    schema.sql          # if the app owns raw SQL
  tests/
  requirements.txt
  railway.json
  README.md
  .env.example          # every env var the app reads, with safe defaults
```

The portfolio is a flat static site rather than an app, so it keeps its HTML and
media at the repo root (the `CNAME` and linked PDFs depend on those paths), but
its stylesheets still live in `css/` and its scripts in `js/`.

Naming:

- **Variables are `camelCase` in every language, Python included.** This is a
  deliberate house rule from the global `~/.claude/CLAUDE.md` — it overrides
  PEP 8 here, so that reading across a Python backend and a JS frontend doesn't
  mean switching conventions mid-thought.
- New project, folder, file, variable, function, and CSS class names use
  **camelCase** (updated September 18, 2026). Preserve framework-required names
  such as `__init__.py`, `requirements.txt`, and `AGENTS.md`.
- Existing shared CSS classes and custom properties retain their published names
  for compatibility. New shared tokens use camelCase; do not mass-rename consumers.
- Applies to new and edited code. Don't mass-rename working code to chase it.

Pick the boring name.

## The shared design system

`shared/theme.css` in this repo is the **only** place the palette, type scale,
spacing, radii, shadows and shared components are defined. Every site gets a
vendored copy at `static/css/theme.css` (`css/theme.css` for the portfolio).

```bash
python3 scripts/sync_theme.py           # push the current theme to every site
python3 scripts/sync_theme.py --check   # fail if any copy has drifted
```

Rules:

1. **Never edit a vendored copy.** Edit `shared/theme.css` and re-sync.
2. **Never hardcode a colour, font, radius or shadow** in a site stylesheet.
   Use a `var(--token)`. If the token you need doesn't exist, add it to the
   shared theme — that's the signal it's worth sharing.
3. A site's `app.css` holds only what is genuinely specific to that site, and
   it composes the shared components rather than restyling them.

The tokens and components are documented in comments inside
[`shared/theme.css`](shared/theme.css). The short version: `--bg` `#0a0a23`
navy, `--surface-1` `#17173a` cards, `--accent` `#f6511d` ember orange, Orbitron
for display type, Montserrat for body.

## Frontend conventions

- Load order in `<head>`: fonts (preconnect + stylesheet), then `theme.css`,
  then `app.css`. Site styles always win by coming last.
- JavaScript is ES modules (`<script type="module">`). No bundler.
- All network calls go through `js/api.js`. Nothing else calls `fetch` directly,
  so there's one place that knows the route names and one place that handles
  errors.
- Semantic HTML and real labels. Every interactive control is keyboard reachable
  and every input has a `<label>`.
- Mobile is not an afterthought: the shared theme's breakpoint is 768px.

## Backend conventions

- Configuration comes from environment variables, read in exactly one place
  (`app/config.py`), with every variable documented in `.env.example`.
- Routers are thin: parse, delegate, serialize. Logic lives below them.
- JSON responses are built in `serialize.py`, never by hand in a route.
- Errors return a consistent shape: `{"error": {"code": "...", "message": "..."}}`.
- Secrets never land in the repo. `.env` is gitignored; `.env.example` is not.

## C++: where it actually belongs

C++ is the standard for native and compute-bound work, not for HTTP servers.
These apps are I/O-bound CRUD over a database — a C++ web framework would cost
ecosystem, deploy simplicity and iteration speed while buying nothing.

Places in this stack where C++ might pay off, revised after actually reading
the Ondrick pipeline:

1. **A constrained mesh decimater for the Ondrick render pipeline.** The web
   viewer ships a 15.8 MB GLB; the export script merges by material and welds
   vertices but never reduces triangle count. The honest caveat: `gltfpack -si`
   (meshoptimizer's CLI) would capture most of that win today with no code at
   all. What a custom tool adds is a decimater that re-measures against the
   governing planes (eave 24'-0", ridge 27'-1.5") and refuses to emit geometry
   that moved them — a guard rail generic tools cannot express, on a project
   where the dimensions are the deliverable. Build `geoprep measure` (read-only)
   first and let it decide whether the rest is worth it.
2. **Batch image processing for `inventory`** — a `tools/imgproc` CLI that
   resizes and strips EXIF, called as a subprocess, replacing `sharp`/`pillow`
   on the upload path.
3. **A native CLI against the `dash` API** — a fast local client for logging
   habits and cashflow without opening a browser.

Explicitly *not* C++ work, despite earlier assumptions:

- **CAD format conversion.** `.skp` needs Trimble's proprietary SDK and `.dwg`
  needs ODA File Converter or LibreDWG. Assimp reads neither. This is a
  licensing problem, not a performance one — and the Ondrick pipeline doesn't
  convert CAD at all; it builds the model procedurally in Blender from
  dimensions transcribed off the PDFs.
- **Unit normalization and scale/normal validation.** A multiply by 0.3048 and a
  handful of assertions. Python already does it in well under a second.

Anything built would be `tools/<name>/` with `CMakeLists.txt`, `src/`,
`include/` and `tests/`, C++17, invoked as a subprocess. None are built yet.

## Per-repo docs

Every repo's `README.md` opens with: what it is, the stack, how to run it
locally, and how it deploys. Anything not yet standard is recorded in that
repo's `MIGRATION.md` rather than left implicit.


## Additional managed repositories

`jobSearch`, `gameLibrary`, and `newsGenerator` are submodules under `sites/`.
They vendor this document as `STANDARDS.md` and load the same shared theme.
Run `python3 scripts/syncStandards.py` and `python3 scripts/sync_theme.py` after
changing the respective source; both support `--check` for drift detection.
Their local `AGENTS.md` files direct future edits to these standards.

- **jobSearch:** new FastAPI `app/` backend, vanilla ES modules in `static/`,
  CSV source of truth; local dashboard defaults to port 8085.
- **newsGenerator:** keeps its existing `backend/app/` and `backend/static/`
  layout. Its dashboard uses separate CSS and ES modules; existing Python and
  API field names are preserved. See its `MIGRATION.md`.
- **gameLibrary:** keeps Phaser, TypeScript, Vite, and the simulation/scene/UI
  boundaries. A game engine is an intentional exception to the vanilla frontend
  rule. Menus and HUD use the shared theme; battlefield art, sprites and gameplay
  semantic colors retain the game's palette. See its `MIGRATION.md`.

These submodules run independently. Adding them here does not publish them or
expose their data through the portfolio server.
