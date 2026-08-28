#!/usr/bin/env python3
"""Static site checker for internal links, in-page anchors, and sitemap XML.

Checks only the files you pass (or the files changed vs HEAD when run with no
arguments), so pre-existing issues elsewhere in the site do not block new work.

For each HTML file checked:
  1. Every internal href/src must resolve to a real file in the repo.
  2. Every anchor link (#id, or page.html#id) must resolve to an existing
     id attribute in the target file.

sitemap.xml, when included, must parse as valid XML.

Usage:
  python scripts/check_site.py troubleshooting.html index.html sitemap.xml
  python scripts/check_site.py            # files changed vs HEAD (via git)
"""
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_SCHEMES = ("http", "https", "mailto", "tel", "javascript", "data")


class LinkAndIdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []  # (raw_url, line)
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs and attrs["id"]:
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.add(attrs["name"])
        url = None
        if tag in ("a", "link") and attrs.get("href"):
            url = attrs["href"]
        elif tag in ("img", "script", "source", "iframe") and attrs.get("src"):
            url = attrs["src"]
        if url:
            self.links.append((url, self.getpos()[0]))


def parse_html(path, cache={}):
    real = os.path.realpath(path)
    if real not in cache:
        collector = LinkAndIdCollector()
        with open(real, "r", encoding="utf-8", errors="replace") as f:
            collector.feed(f.read())
        cache[real] = collector
    return cache[real]


def check_html(path):
    errors = []
    collector = parse_html(path)
    base_dir = os.path.dirname(os.path.abspath(path))
    for raw, line in collector.links:
        parsed = urlparse(raw)
        if parsed.scheme in SKIP_SCHEMES or raw.startswith("//"):
            continue
        target_rel = unquote(parsed.path)
        fragment = parsed.fragment

        if not target_rel and not fragment:
            continue  # bare "#" or empty href (JS-handled)

        if target_rel:
            if target_rel.startswith("/"):
                target = os.path.join(ROOT, target_rel.lstrip("/"))
            else:
                target = os.path.join(base_dir, target_rel)
            if os.path.isdir(target):
                target = os.path.join(target, "index.html")
            if not os.path.isfile(target):
                errors.append(f"{path}:{line}: broken link -> {raw}")
                continue
        else:
            target = path

        if fragment:
            if not target.endswith((".html", ".htm")):
                continue
            target_ids = parse_html(target).ids
            if fragment not in target_ids:
                errors.append(f"{path}:{line}: missing anchor -> {raw}")
    return errors


def check_sitemap(path):
    try:
        ET.parse(path)
        return []
    except ET.ParseError as e:
        return [f"{path}: invalid XML -> {e}"]


def changed_files():
    out = subprocess.run(
        ["git", "diff", "--name-only", "HEAD"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    files = set(out.split() + staged.split())
    return [os.path.join(ROOT, f) for f in sorted(files)]


def main(argv):
    files = [os.path.abspath(f) for f in argv] if argv else changed_files()
    files = [f for f in files if os.path.isfile(f)]
    targets = [f for f in files if f.endswith((".html", ".htm", ".xml"))]
    if not targets:
        print("check_site: no HTML/XML files to check")
        return 0

    all_errors = []
    for f in targets:
        if f.endswith(".xml"):
            all_errors += check_sitemap(f)
        else:
            all_errors += check_html(f)
        rel = os.path.relpath(f, ROOT)
        print(f"checked {rel}")

    if all_errors:
        print(f"\n{len(all_errors)} problem(s):")
        for e in all_errors:
            print(" ", os.path.relpath(e, ROOT) if os.path.isabs(e) else e)
        return 1
    print(f"\nOK: {len(targets)} file(s) clean")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
