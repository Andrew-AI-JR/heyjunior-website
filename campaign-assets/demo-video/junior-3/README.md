# Junior 3.0 Demo Video Assets

## Final video (self-hosted on heyjunior.ai)

- **File:** `junior-3-demo-720p.mp4` (~2.5 MB, 1280×720, 49s)
- **Poster:** `poster.jpg`
- **Captions:** `captions.vtt`
- **Rebuild:** `python scripts/build_junior3_demo_video.py`

## Source (local only — not in repo)

`C:\Users\asust\OneDrive\Documentos\Junior Labs LLC\3.0 Release Video.mp4`

## Optional: YouTube migration

After uploading to YouTube, replace the HTML5 `<video>` block on `junior-3.html` with:

```html
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" ...></iframe>
```

Update `VideoObject` JSON-LD `embedUrl` accordingly.
