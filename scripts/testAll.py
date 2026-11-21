#!/usr/bin/env python3
"""Run the isolation check, every game's own tests, and the room server's tests.

To test one game only:  cd games/<game> && npm test
Usage: python3 scripts/testAll.py
"""
import subprocess
import sys

from projects import gameDirs, repoRoot


def main() -> None:
    failed = []
    steps = [(["python3", "scripts/checkIsolation.py"], repoRoot)]
    steps += [(["npm", "test"], gameDir) for gameDir in gameDirs()]
    # The room server's tests use the project venv (see README: python3 -m venv .venv).
    venvPython = repoRoot / ".venv" / "bin" / "python"
    serverPython = str(venvPython) if venvPython.exists() else sys.executable
    steps.append(([serverPython, "-m", "unittest", "discover", "-s", "tests"], repoRoot))
    for command, cwd in steps:
        print(f"\n$ ({cwd.relative_to(repoRoot) or '.'}) {' '.join(command)}", flush=True)
        if subprocess.run(command, cwd=cwd).returncode != 0:
            failed.append(f"{cwd.name}: {' '.join(command)}")
    if failed:
        print("\ntestAll: FAILED\n" + "\n".join(f"  {item}" for item in failed))
        sys.exit(1)
    print("\ntestAll: all passed")


if __name__ == "__main__":
    main()
