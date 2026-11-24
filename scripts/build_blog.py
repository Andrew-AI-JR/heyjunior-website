import html as html_lib
import os
import re
import sys
import json
import urllib.request
from pathlib import Path

API_URL = "https://api.heyjunior.ai/api/blog"
TEMPLATE_PATH = Path("article.html")
BLOG_DIR = Path("blog")
POSTS_INDEX_PATH = BLOG_DIR / "posts.json"
API_PAGE_SIZE = 100
SITEMAP_PATH = Path("sitemap.xml")


def sync_sitemap(articles):
    """Make sure every article has a <url> entry in sitemap.xml.

    The sitemap is maintained by hand for the static marketing pages, so this
    only ever adds missing blog URLs and never reorders or rewrites existing
    entries.
    """
    if not SITEMAP_PATH.exists():
        return
    xml = SITEMAP_PATH.read_text(encoding="utf-8")
    added = 0
    for article in articles:
        slug = article.get("slug")
        if not slug:
            continue
        url = f"https://heyjunior.ai/blog/{slug}/"
        if url in xml:
            continue
        published = (article.get("published_at") or "")[:10]
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
        print(f"Added {added} blog URL(s) to {SITEMAP_PATH}")


def fetch_articles():
    print(f"Fetching articles from {API_URL}...")
    all_posts = []
    page = 1
    total_pages = 1
    
    while page <= total_pages:
        req = urllib.request.Request(f"{API_URL}?page={page}&size={API_PAGE_SIZE}")
        with urllib.request.urlopen(req) as response:
            if response.status != 200:
                print(f"Error fetching articles page {page}: {response.status}")
                sys.exit(1)
            data = json.loads(response.read().decode())
            posts = data.get("posts", [])
            all_posts.extend(posts)
            total_pages = data.get("total_pages", 1)
        page += 1
        
    return all_posts

def write_posts_index(articles):
    index_fields = ["id", "slug", "title", "excerpt", "featured_image_url", "published_at"]
    posts_index = []
    for article in articles:
        posts_index.append({k: article.get(k) for k in index_fields})
    
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(POSTS_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({"posts": posts_index}, f, ensure_ascii=False, indent=2)
    print(f"Generated {POSTS_INDEX_PATH}")

def fetch_article_detail(slug):
    url = f"{API_URL}/{slug}"
    print(f"Fetching detail for {slug}...")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        if response.status != 200:
            print(f"Error fetching detail for {slug}: {response.status}")
            return None
        return json.loads(response.read().decode())

def generate_static_page(template_html, article):
    slug = article["slug"]
    title = article["title"].replace('"', '&quot;')
    excerpt = (article.get("excerpt") or "").replace('"', '&quot;')
    image_url = article.get("featured_image_url") or "https://heyjunior.ai/images/junior-og.png"
    url = f"https://heyjunior.ai/blog/{slug}/"
    
    # Inject OG tags into head
    og_tags = f"""
    <link rel="canonical" href="{url}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{url}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{excerpt}">
    <meta property="og:image" content="{image_url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{url}">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{excerpt}">
    <meta name="twitter:image" content="{image_url}">
    """
    
    html = template_html.replace('</head>', f'{og_tags}\n</head>')

    # Real <title> and meta description in the served HTML. The template ships a
    # generic "Article - Junior" title and sets the real one in JS later, which
    # crawlers and social scrapers that don't run JS never see.
    full_title = html_lib.escape(f'{article["title"]} - Junior', quote=True)
    desc = html_lib.escape(article.get("excerpt") or "", quote=True)

    def _set_title(match):
        return f"<title>{full_title}</title>"

    def _set_desc(match):
        return match.group(1) + f'\n    <meta name="description" content="{desc}">'

    html = re.sub(r"<title>.*?</title>", _set_title, html, count=1, flags=re.S)
    if desc:
        html = re.sub(r'(<meta name="viewport"[^>]*>)', _set_desc, html, count=1)

    # Replace JS redirect logic with static content injection
    # We'll replace the article-content div
    
    # Simple script to inject the article data directly into the page so JS doesn't need to fetch it
    article_json = json.dumps(article).replace('</script>', '<\\/script>')
    
    # Find where the script starts loading article data
    # The template has a script that fetches the article based on URL
    # We'll replace it with inject data
    
    # Inject data script before the main script
    data_script = f"<script>\n        window.__INITIAL_ARTICLE_DATA__ = {article_json};\n    </script>"
    
    # Insert before the main script tag
    html = html.replace('<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>', 
                       f'{data_script}\n    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>')
    
    # Fix asset paths for subdirectory
    html = html.replace('src="js/', 'src="../../js/')
    html = html.replace('href="css/', 'href="../../css/')
    # The header logo is written as "./images/..." in the template, so cover both forms.
    html = html.replace('src="./images/', 'src="../../images/')
    html = html.replace('href="./images/', 'href="../../images/')
    html = html.replace('src="images/', 'src="../../images/')
    html = html.replace('href="images/', 'href="../../images/')
    
    # Fix navigation links (they're at root level)
    html = html.replace('href="index.html"', 'href="../../index.html"')
    html = html.replace('href="why-commenting-works.html"', 'href="../../why-commenting-works.html"')
    html = html.replace('href="blog.html"', 'href="../../blog.html"')
    html = html.replace('href="try-it.html"', 'href="../../try-it.html"')
    html = html.replace('href="register.html"', 'href="../../register.html"')
    
    return html

def main():
    if not TEMPLATE_PATH.exists():
        print(f"Template {TEMPLATE_PATH} not found.")
        sys.exit(1)
    
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template_html = f.read()
    
    articles = fetch_articles()
    print(f"Found {len(articles)} articles.")
    write_posts_index(articles)
    sync_sitemap(articles)
    
    for summary in articles:
        slug = summary["slug"]
        detail = fetch_article_detail(slug)
        if not detail:
            continue
        
        # Create directory for the post
        post_dir = BLOG_DIR / slug
        post_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate the static page
        out_file = post_dir / "index.html"
        html = generate_static_page(template_html, detail)
        
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(html)
        
        print(f"Generated {out_file}")

if __name__ == "__main__":
    main()
