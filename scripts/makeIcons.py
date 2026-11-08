#!/usr/bin/env python3
"""Generate the Game Library web-app icons (PNG) into public/icons/.

Pixel-art ember lantern on the shared deep-navy background. Colors mirror
webMaster/shared/theme.css (--bg, --accent, --accent-tint); update both together.

Usage: python3 scripts/makeIcons.py   (requires Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

repoRoot = Path(__file__).resolve().parent.parent
outDir = repoRoot / "public" / "icons"

background = (10, 10, 35, 255)      # --bg #0a0a23
frame = (90, 58, 32, 255)
handle = (160, 160, 192, 255)       # --muted #a0a0c0
body = (246, 81, 29, 255)           # --accent #f6511d
inner = (255, 179, 128, 255)
core = (255, 215, 200, 255)         # --accent-tint #ffd7c8

lanternRows = [
    "....oooo....",
    "...o....o...",
    "....oooo....",
    "..hhhhhhhh..",
    "..hLLLLLLh..",
    "..hLccccLh..",
    "..hLcCCcLh..",
    "..hLcCCcLh..",
    "..hLccccLh..",
    "..hLLLLLLh..",
    "..hhhhhhhh..",
    "....hhhh....",
]
palette = {"o": handle, "h": frame, "L": body, "c": inner, "C": core}


def drawIcon(size: int, maskable: bool) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if maskable:
        draw.rectangle((0, 0, size, size), fill=background)
    else:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=background)

    # Maskable icons keep art inside the central safe zone (~60%).
    artFraction = 0.5 if maskable else 0.66
    cols = len(lanternRows[0])
    rows = len(lanternRows)
    pixel = int(size * artFraction / rows)
    artWidth = cols * pixel
    artHeight = rows * pixel
    left = (size - artWidth) // 2
    top = (size - artHeight) // 2

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glowDraw = ImageDraw.Draw(glow)
    glowRadius = artHeight * 0.55
    centerX = size / 2
    centerY = top + artHeight * 0.55
    glowDraw.ellipse(
        (centerX - glowRadius, centerY - glowRadius, centerX + glowRadius, centerY + glowRadius),
        fill=(246, 81, 29, 110),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size / 14))
    image = Image.alpha_composite(image, glow)
    draw = ImageDraw.Draw(image)

    for rowIndex, row in enumerate(lanternRows):
        for colIndex, char in enumerate(row):
            color = palette.get(char)
            if color:
                x = left + colIndex * pixel
                y = top + rowIndex * pixel
                draw.rectangle((x, y, x + pixel - 1, y + pixel - 1), fill=color)
    return image


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
