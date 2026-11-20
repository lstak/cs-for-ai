"""Sanity checks for the course site. Run before every commit:  python3 tools/check.py
Checks: every module is wired up (page, script, kicker number), every local link exists,
no absolute local paths slipped in, and the downloadable skill matches the live skill."""
import re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
errors = []
err = errors.append

common = (root / "assets/common.js").read_text()
mods = re.findall(r"id: '(m\d+)',\s*file: '([^']+)'", common)
if not mods:
    err("could not read the MODULES list in assets/common.js")
for i, (mid, fname) in enumerate(mods, start=1):
    page = root / fname
    if not page.exists():
        err(f"{mid}: missing page {fname}"); continue
    html = page.read_text()
    if f'data-module="{mid}"' not in html: err(f"{fname}: data-module should be {mid}")
    if f"assets/{mid}.js" not in html: err(f"{fname}: should load assets/{mid}.js")
    if not (root / f"assets/{mid}.js").exists(): err(f"missing script assets/{mid}.js")
    if f"Module {i}" not in html.split("</header>")[0]: err(f"{fname}: header should say 'Module {i}' (list position {i})")

for page in sorted(root.glob("*.html")):
    text = page.read_text()
    for ref in re.findall(r'(?:href|src)="([^"#$]+)"', text):
        if ref.startswith(("http://", "https://", "mailto:")): continue
        if ref.startswith("/"): err(f"{page.name}: absolute link {ref} (breaks on GitHub Pages)")
        elif not (root / ref).exists(): err(f"{page.name}: broken link {ref}")

for f in list(root.glob("*.html")) + list(root.glob("assets/*.js")):
    if "/home/" in f.read_text() and "/home/me/" not in f.read_text():
        err(f"{f.name}: contains a local /home/ path")

if not (root / "LICENSE").exists() or "Attribution 4.0 International" not in (root / "LICENSE").read_text():
    err("LICENSE is missing or is not the CC BY 4.0 text")

skill, copy = root / ".claude/skills/cs-tutor/SKILL.md", root / "downloads/SKILL.md"
if not copy.exists() or copy.read_text() != skill.read_text():
    err("downloads/SKILL.md is out of date: run  python3 tools/build_downloads.py")

if errors:
    print("PROBLEMS:"); [print(" -", e) for e in errors]; sys.exit(1)
print(f"OK: {len(mods)} modules, links and downloads are consistent")
