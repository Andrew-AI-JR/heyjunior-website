"""Build blog pages for hand-written posts that live in the repo.

Posts in blog/_posts/*.md (front matter + markdown body) are not in the CMS, so
scripts/build_blog.py does not know about them. This script runs right after it:

  1. renders blog/<slug>/index.html from article.html using the same template
     helpers as build_blog.py (so the markup is identical);
  2. merges the posts into blog/posts.json, which blog.html reads;
  3. adds a sitemap entry for any post that does not have one yet.

Run order in the workflow: python scripts/build_blog.py && python scripts/build_local_posts.py
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_blog import BLOG_DIR, TEMPLATE_PATH, generate_static_page, write_posts_index  # noqa: E402

LOCAL_POSTS_DIR = BLOG_DIR / "_posts"
SITEMAP_PATH = Path("sitemap.xml")
INDEX_FIELDS = ("id", "slug", "title", "excerpt", "featured_image_url", "published_at")


def parse_front_matter(text):
    text = text.lstrip("\ufeff")
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = {}
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, parts[2].strip()


def load_local_posts():
    if not LOCAL_POSTS_DIR.exists():
        return []
    posts = []
    for path in sorted(LOCAL_POSTS_DIR.glob("*.md")):
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        if not body:
            print(f"Skipping {path}: no post body")
            continue
        slug = meta.get("slug") or path.stem
        posts.append({
            "id": int(meta["id"]) if str(meta.get("id", "")).isdigit() else None,
            "slug": slug,
            "title": meta.get("title") or slug.replace("-", " ").title(),
            "excerpt": meta.get("excerpt") or "",
            "featured_image_url": meta.get("featured_image_url") or "https://heyjunior.ai/images/junior-og.png",
            "published_at": meta.get("published_at") or "",
            "content": body,
        })
    posts.sort(key=lambda p: p.get("published_at") or "", reverse=True)
    return posts


def merge_into_index(local_posts):
    path = BLOG_DIR / "posts.json"
    existing = []
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8")).get("posts", [])
    known = {p.get("slug") for p in existing}
    missing = [p for p in local_posts if p.get("slug") not in known]
    if not missing:
        return existing, 0
    merged = [{k: p.get(k) for k in INDEX_FIELDS} for p in missing] + existing
    merged.sort(key=lambda p: p.get("published_at") or "", reverse=True)
    write_posts_index(merged)
    return merged, len(missing)


def update_sitemap(local_posts):
    if not SITEMAP_PATH.exists():
        return 0
    xml = SITEMAP_PATH.read_text(encoding="utf-8")
    added = 0
    for post in local_posts:
        url = f"https://heyjunior.ai/blog/{post['slug']}/"
        if url in xml:
            continue
        published = (post.get("published_at") or "")[:10]
        lastmod = f"\n    <lastmod>{published}</lastmod>" if len(published) == 10 else ""
        entry = (
            "  <url>\n"
            f"    <loc>{url}</loc>{lastmod}\n"
            "    <changefreq>weekly</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>\n</urlset>"
        )
        xml = xml.replace("</urlset>", entry, 1)
        added += 1
    if added:
        SITEMAP_PATH.write_text(xml, encoding="utf-8")
        try:
            ET.fromstring(xml)
        except ET.ParseError as exc:
            print(f"WARNING: sitemap.xml is not valid XML after update: {exc}")
        print(f"Added {added} URL(s) to {SITEMAP_PATH}")
    return added


def main():
    local_posts = load_local_posts()
    if not local_posts:
        print("No local posts in blog/_posts.")
        return

    template_html = TEMPLATE_PATH.read_text(encoding="utf-8")
    for post in local_posts:
        out_dir = BLOG_DIR / post["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(generate_static_page(template_html, post), encoding="utf-8")
        print(f"Generated {out_dir / 'index.html'}")

    _, added = merge_into_index(local_posts)
    update_sitemap(local_posts)
    print(f"{len(local_posts)} local post(s) built, {added} added to the index.")


if __name__ == "__main__":
    main()
