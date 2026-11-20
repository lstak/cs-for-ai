"""Regenerate the downloadable copies from the live skill. Run after editing .claude/skills/cs-tutor/SKILL.md:
    python3 tools/build_downloads.py
"""
import shutil, zipfile
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / ".claude/skills/cs-tutor/SKILL.md"
out = root / "downloads"
shutil.copyfile(src, out / "SKILL.md")
with zipfile.ZipFile(out / "cs-tutor.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(src, "cs-tutor/SKILL.md")          # folder name = skill name, as Claude expects
print("wrote", out / "SKILL.md", "and", out / "cs-tutor.zip")
