"""Build the anonymized social-proof images from screenshots kept outside the repo.

Usage: python scripts/redact_proof.py "<folder with the original screenshots>"

Identifying details are covered with opaque fills (never blur, which can be
reversed) and the output is re-encoded from raw pixels, so no EXIF or PNG text
metadata survives. Never commit the original screenshots.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "images" / "product"

# (left, top, right, bottom) in source pixels, filled with a colour sampled at `sample`.
WHATSAPP_FILLS = [
    # avatars
    {"box": (10, 4, 54, 46), "sample": (6, 60)},
    {"box": (10, 279, 54, 319), "sample": (6, 330)},
    # "~ name @handle" headers
    {"box": (62, 13, 252, 36), "sample": (62, 45)},
    {"box": (62, 288, 392, 312), "sample": (62, 300)},
    # "@Andrew" mention
    {"box": (158, 182, 226, 202), "sample": (62, 192)},
    # timestamps and day divider
    {"box": (186, 47, 246, 64), "sample": (62, 55)},
    {"box": (126, 83, 184, 100), "sample": (62, 92)},
    {"box": (119, 118, 177, 136), "sample": (62, 127)},
    {"box": (160, 154, 218, 172), "sample": (62, 163)},
    {"box": (223, 191, 281, 208), "sample": (62, 192)},
    {"box": (258, 244, 337, 276), "sample": (250, 240)},
    # over the screenshot's vertical gradient, so each row takes its own colour
    {"box": (330, 518, 389, 536), "row_sample_x": 326},
    {"box": (117, 598, 175, 616), "sample": (100, 607)},
    # initials next to the "Active" badge in the app header
    {"box": (339, 326, 352, 337), "sample": (250, 330)},
]

# Keep only the sentence about the interview; drop header, sender, logs and sign-off.
EMAIL_CROP = (4, 234, 604, 280)


def _clean_copy(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    clean = Image.new("RGB", rgb.size)
    clean.putdata(list(rgb.getdata()))
    return clean


def build_whatsapp(src: Path) -> Path:
    image = _clean_copy(Image.open(src))
    draw = ImageDraw.Draw(image)
    for fill in WHATSAPP_FILLS:
        left, top, right, bottom = fill["box"]
        if "row_sample_x" in fill:
            for y in range(top, bottom + 1):
                draw.line((left, y, right, y), fill=image.getpixel((fill["row_sample_x"], y)))
        else:
            draw.rectangle(fill["box"], fill=image.getpixel(fill["sample"]))
    out = OUT_DIR / "proof-enterprise-whatsapp.webp"
    image.save(out, "WEBP", quality=90, method=6)
    return out


def build_email(src: Path) -> Path:
    image = _clean_copy(Image.open(src).crop(EMAIL_CROP))
    out = OUT_DIR / "proof-jobseeker-email.webp"
    image.save(out, "WEBP", quality=92, method=6)
    return out


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    for out in (
        build_whatsapp(folder / "social-proof-2.png"),
        build_email(folder / "Junior-social-proof.png"),
    ):
        with Image.open(out) as check:
            print(out.name, check.size, "metadata:", dict(check.info) or "none")


if __name__ == "__main__":
    main()
