"""The site's independent projects: the library shell plus every folder in games/.

Each project is its own npm package (own package.json, lockfile, node_modules, tests)
and must not import code from any other project. Shared code is copied, not imported.
"""
from pathlib import Path

repoRoot = Path(__file__).resolve().parent.parent
libraryDir = repoRoot / "library"
gamesDir = repoRoot / "games"


def gameDirs() -> list[Path]:
    return sorted(path for path in gamesDir.iterdir() if (path / "package.json").is_file())


def allProjects() -> list[Path]:
    return [libraryDir, *gameDirs()]
