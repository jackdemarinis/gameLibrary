#!/usr/bin/env python3
"""Fail if any project imports a file from outside its own folder.

Games (and the library shell) are independent: to reuse code, copy it in.
Usage: python3 scripts/checkIsolation.py
"""
import re
import sys
from pathlib import Path

from projects import allProjects

importPattern = re.compile(r"""(?:from\s+|import\s*\(?\s*)["'](\.{1,2}/[^"']*)["']""")
sourceSuffixes = {".ts", ".js", ".css"}


def main() -> None:
    problems = []
    for projectDir in allProjects():
        for sourcePath in (projectDir / "src").rglob("*"):
            if sourcePath.suffix not in sourceSuffixes or "node_modules" in sourcePath.parts:
                continue
            for lineNumber, line in enumerate(sourcePath.read_text(encoding="utf-8").splitlines(), start=1):
                for specifier in importPattern.findall(line):
                    target = (sourcePath.parent / specifier).resolve()
                    if not target.is_relative_to(projectDir):
                        relative = sourcePath.relative_to(projectDir.parent.parent if projectDir.parent.name == "games" else projectDir.parent)
                        problems.append(f"{relative}:{lineNumber} imports {specifier} (outside {projectDir.name}/)")
    if problems:
        print("checkIsolation: projects must not import each other's code:")
        print("\n".join(f"  {problem}" for problem in problems))
        sys.exit(1)
    print(f"checkIsolation: {len(allProjects())} projects, no cross-project imports")


if __name__ == "__main__":
    main()
