#!/usr/bin/env python3
"""Build every project and assemble the deployable site in dist/.

dist/            <- library/dist (home page, icons, manifest, service worker)
dist/<game>/     <- games/<game>/dist

Then the service worker gets its precache list. Run by Railway (see nixpacks.toml).
Usage: python3 scripts/buildAll.py [--install]   (--install: `npm ci` each project first)
"""
import shutil
import subprocess
import sys

from projects import allProjects, gameDirs, libraryDir, repoRoot

distDir = repoRoot / "dist"


def run(command: list[str], cwd) -> None:
    print(f"\n$ ({cwd.relative_to(repoRoot)}) {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    install = "--install" in sys.argv[1:]
    run([sys.executable, "scripts/checkIsolation.py"], repoRoot)
    for projectDir in allProjects():
        if install or not (projectDir / "node_modules").is_dir():
            run(["npm", "ci", "--no-audit", "--no-fund"], projectDir)
        run(["npm", "run", "build"], projectDir)

    shutil.rmtree(distDir, ignore_errors=True)
    shutil.copytree(libraryDir / "dist", distDir)
    for gameDir in gameDirs():
        shutil.copytree(gameDir / "dist", distDir / gameDir.name)
    run([sys.executable, "scripts/precacheServiceWorker.py", str(distDir)], repoRoot)


if __name__ == "__main__":
    main()
