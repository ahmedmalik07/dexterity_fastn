"""Trim uniform background from the documentation screenshots.

Full-height captures leave large dead areas below the content, which in print turn
into half-empty pages. This crops each image down to what is actually on it.

    python scripts/trim-screenshots.py
"""

import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGES = os.path.join(HERE, "..", "..", "docs", "images")
PAD = 12          # keep a little breathing room around the content
TOLERANCE = 6     # how close to the background colour still counts as background


def uniform_rows(pixels, width, height, background):
    """Return the first and last row that contain something other than the background."""
    first, last = 0, height - 1

    def is_background(y):
        step = max(1, width // 220)
        for x in range(0, width, step):
            pixel = pixels[x, y]
            if any(abs(pixel[i] - background[i]) > TOLERANCE for i in range(3)):
                return False
        return True

    while first < height - 1 and is_background(first):
        first += 1
    while last > first and is_background(last):
        last -= 1
    return first, last


def trim(path):
    image = Image.open(path).convert("RGB")
    width, height = image.size
    pixels = image.load()

    # The bottom-left corner is reliably page background in every one of these shots.
    background = pixels[2, height - 2]

    top, bottom = uniform_rows(pixels, width, height, background)
    if bottom - top < 40:
        return None

    top = max(0, top - PAD)
    bottom = min(height - 1, bottom + PAD)
    if bottom - top >= height - 4:
        return None

    image.crop((0, top, width, bottom + 1)).save(path)
    return height, bottom - top + 1


def main():
    folder = os.path.abspath(IMAGES)
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".png"):
            continue
        result = trim(os.path.join(folder, name))
        if result:
            before, after = result
            print(f"{name}: {before}px -> {after}px")
        else:
            print(f"{name}: already tight")


if __name__ == "__main__":
    sys.exit(main())
