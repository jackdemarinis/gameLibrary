#!/usr/bin/env python3
"""Generate the JackGames web-app icons (PNG) into public/icons/.

The JackGames mark: a phosphor-green terminal window with a ">_" prompt on
near-black, the same shape as the inline SVG logo in src/library/main.ts.
Colours mirror src/jackGames.css (--bg, --accent); update both together.

Usage: python3 scripts/makeIcons.py   (requires Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

repoRoot = Path(__file__).resolve().parent.parent
outDir = repoRoot / "public" / "icons"

background = (10, 13, 11, 255)  # --bg #0a0d0b
green = (62, 240, 138, 255)     # --accent #3ef08a

superSample = 4


def drawIcon(size: int, maskable: bool) -> Image.Image:
    big = size * superSample
    image = Image.new("RGBA", (big, big), background)
    draw = ImageDraw.Draw(image)

    # Maskable icons keep the mark inside the ~60% safe zone.
    markSize = big * (0.56 if maskable else 0.8)
    left = (big - markSize) / 2
    top = (big - markSize) / 2
    unit = markSize / 32  # 32-unit grid, like the SVG viewBox
    stroke = max(int(round(2.4 * unit)), superSample * 2)

    def point(x: float, y: float) -> tuple[float, float]:
        return (left + x * unit, top + y * unit)

    # Window frame.
    draw.rectangle((*point(2, 4), *point(30, 28)), outline=green, width=stroke)
    # ">" prompt and "_" cursor.
    draw.line([point(8, 11.5), point(14, 16), point(8, 20.5)], fill=green, width=stroke, joint="curve")
    draw.rectangle((*point(16, 20), *point(24, 20 + stroke / unit)), fill=green)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    outDir.mkdir(parents=True, exist_ok=True)
    targets = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, True),
        "favicon-32.png": (32, False),
    }
    for fileName, (size, maskable) in targets.items():
        drawIcon(size, maskable).save(outDir / fileName)
        print(f"wrote {outDir / fileName}")


if __name__ == "__main__":
    main()
