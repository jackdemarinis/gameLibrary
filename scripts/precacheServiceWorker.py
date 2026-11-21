#!/usr/bin/env python3
"""Write the precache list and build version into dist/sw.js after `vite build`.

Lists every file in dist/ (except sw.js itself) so the service worker caches the
whole app on install, and derives the version from the file contents so each
deploy gets a fresh cache and the previous deploy's cache is pruned.

Usage: python3 scripts/precacheServiceWorker.py [distDir]   (run by `npm run build`)
"""
import hashlib
import json
import sys
from pathlib import Path

repoRoot = Path(__file__).resolve().parent.parent
versionLine = 'const buildVersion = "dev";'
precacheLine = "const precacheFiles = [];"


def main() -> None:
    distDir = Path(sys.argv[1]) if len(sys.argv) > 1 else repoRoot / "dist"
    workerPath = distDir / "sw.js"
    workerSource = workerPath.read_text(encoding="utf-8")
    for marker in (versionLine, precacheLine):
        if workerSource.count(marker) != 1:
            sys.exit(f"precacheServiceWorker: expected exactly one `{marker}` in {workerPath}")

    # The worker's own logic is part of the version, so a caching-rule change also rolls the cache.
    digest = hashlib.sha256(workerSource.encode("utf-8"))
    precacheFiles = []
    for filePath in sorted(path for path in distDir.rglob("*") if path.is_file()):
        relativePath = filePath.relative_to(distDir).as_posix()
        if relativePath == "sw.js" or filePath.name.startswith("."):
            continue
        precacheFiles.append(f"./{relativePath}")
        # Game pages are visited as folders (./petanque/), so cache that URL too.
        if filePath.name == "index.html" and filePath.parent != distDir:
            precacheFiles.append(f"./{filePath.parent.relative_to(distDir).as_posix()}/")
        digest.update(relativePath.encode("utf-8"))
        digest.update(filePath.read_bytes())

    buildVersion = digest.hexdigest()[:12]
    workerSource = workerSource.replace(versionLine, f"const buildVersion = {json.dumps(buildVersion)};")
    workerSource = workerSource.replace(precacheLine, f"const precacheFiles = {json.dumps(precacheFiles)};")
    workerPath.write_text(workerSource, encoding="utf-8")
    print(f"precacheServiceWorker: {len(precacheFiles)} files, version {buildVersion}")


if __name__ == "__main__":
    main()
