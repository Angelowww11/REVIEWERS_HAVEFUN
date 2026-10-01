"""Generate crisp Packet Party install icons from the site's network mark."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).with_name("icons")
OUT.mkdir(exist_ok=True)
SCALE = 3


def icon(size: int, maskable: bool = False) -> Image.Image:
    edge = size * SCALE
    image = Image.new("RGB", (edge, edge), "#171c5b")
    draw = ImageDraw.Draw(image)
    margin = edge * (.19 if maskable else .12)
    lo, hi = margin, edge - margin
    width = int(edge * .055)
    points = [(lo + edge * .12, (lo + hi) / 2), (hi - edge * .12, lo + edge * .14), (hi - edge * .12, hi - edge * .14)]
    draw.line([points[0], points[1]], fill="#a7f2ed", width=width, joint="curve")
    draw.line([points[0], points[2]], fill="#a7f2ed", width=width, joint="curve")
    radius = edge * .072
    for (x, y), color in zip(points, ("#a7f2ed", "#ffb45c", "#f58fca")):
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)
    return image.resize((size, size), Image.Resampling.LANCZOS)


icon(192).save(OUT / "icon-192.png", optimize=True)
icon(512).save(OUT / "icon-512.png", optimize=True)
icon(512, True).save(OUT / "icon-maskable-512.png", optimize=True)
