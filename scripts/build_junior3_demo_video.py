#!/usr/bin/env python3
"""Build Junior 3.0 demo video: letterbox, ASS call-outs, VO mix."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "campaign-assets" / "demo-video" / "junior-3"
SRC = Path(r"C:\Users\asust\OneDrive\Documentos\Junior Labs LLC\3.0 Release Video.mp4")
VO = ASSETS / "voiceover.mp3"
ASS = ASSETS / "callouts.ass"
OUT = ASSETS / "junior-3-demo-720p.mp4"
POSTER = ASSETS / "poster.jpg"


def main():
    if not SRC.exists():
        print(f"Missing source: {SRC}", file=sys.stderr)
        sys.exit(1)
    if not VO.exists():
        print(f"Missing voiceover: {VO}", file=sys.stderr)
        sys.exit(1)

    ass_path = str(ASS).replace("\\", "/").replace(":", "\\:")
    vf = (
        f"[0:v]scale=1280:720:force_original_aspect_ratio=decrease,"
        f"pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,"
        f"ass='{ass_path}',format=yuv420p[v];"
        f"[1:a]apad=pad_dur=8,loudnorm=I=-16:TP=-1.5:LRA=11[a]"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", str(SRC),
        "-i", str(VO),
        "-filter_complex", vf,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        "-t", "49",
        str(OUT),
    ]
    print("Running ffmpeg...")
    subprocess.run(cmd, check=True)

    subprocess.run(
        ["ffmpeg", "-y", "-ss", "8", "-i", str(OUT), "-frames:v", "1", "-q:v", "2", str(POSTER)],
        check=True,
    )
    print(f"Wrote {OUT}")
    print(f"Wrote {POSTER}")


if __name__ == "__main__":
    main()
