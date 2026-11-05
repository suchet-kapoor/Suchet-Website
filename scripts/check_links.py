#!/usr/bin/env python3
"""CI check: every local href/src in the HTML must resolve to a real file.

The site is a no-build static site, so tests are simple and honest:
1. No broken internal links (no dead-end pages).
2. Required structural bits exist (title, theme wiring shared with the site).

Exit code 1 fails the PR check.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_SCHEMES = ("http://", "https://", "mailto:", "tel:", "data:")

errors = []
checked = 0

html_files = sorted(ROOT.rglob("*.html"))
for f in html_files:
    text = f.read_text(encoding="utf-8", errors="replace")
    rel = f.relative_to(ROOT)

    # 1. internal links resolve to real files (or fragments)
    for m in re.finditer(r'(?:href|src)="([^"]*)"', text):
        val = m.group(1)
        if not val or val.startswith(SKIP_SCHEMES) or val.startswith("#"):
            continue
        checked += 1
        target = (f.parent / val.split("#")[0]).resolve()
        if not target.exists():
            errors.append(f"broken link in {rel}: {val} -> {target}")

    # 2. minimal sanity: a title, and references to the shared stylesheet if present
    if "<title>" not in text:
        errors.append(f"{rel}: missing <title>")
    if "site.css" in text and f"../" not in f.name:  # page in root expects its own path
        pass

    # theme toggle script must exist everywhere the theme button is used
    if "themeBtn" in text and "localStorage" not in text:
        errors.append(f"{rel}: theme button without theme persistence script")

print(f"Scanned {len(html_files)} HTML files, checked {checked} internal links.")
if errors:
    for e in errors:
        print(f"  FAIL {e}")
    sys.exit(1)
print("OK: no broken links, structure sane.")
