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
            total_pages = int(data.get("total_pages", 1) or 1)
        page += 1

    return all_posts


def write_posts_index(posts):
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"posts": posts}
    with open(POSTS_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
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
    
    # Replace JS redirect logic with static content injection
    # We'll replace the article-content div
    
    # Simple script to inject the article data directly into the page so JS doesn't need to fetch it
    article_json = json.dumps(article).replace('</script>', '<\\/script>')
    
    # Generated pages live two levels down (blog/<slug>/index.html), so root-relative
    # assets and pages need a ../../ prefix. Query strings (?v=, ?src=) are preserved.
    html = re.sub(r'(src|href)="(?:\./)?(js|css|images)/', r'\1="../../\2/', html)
    html = re.sub(
        r'href="(index|why-commenting-works|blog|try-it|register|portal|terms|privacy)\.html',
        r'href="../../\1.html',
        html,
    )
    
    # Inject the data script before the main script
    html = html.replace('<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>', 
                        f'<script>\n        window.__INITIAL_ARTICLE_DATA__ = {article_json};\n    </script>\n    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>')
    
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
    
    for summary in articles:
        slug = summary["slug"]
        detail = fetch_article_detail(slug)
        if not detail:
            continue
            
        out_dir = BLOG_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        
        out_file = out_dir / "index.html"
        html = generate_static_page(template_html, detail)
        
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(html)
            
        print(f"Generated {out_file}")

if __name__ == "__main__":
    main()
