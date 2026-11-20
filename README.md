# How Computers Work: a crash course for AI practitioners

A self-paced, interactive course on how computers work, for people who build or use AI and have no computer-science background (beginner Python is enough). Every idea comes with an interactive graphic and is tied to something you meet when building or using AI.

**Live site:** `https://lstak.github.io/cs-for-ai/`

## What's inside

13 modules: bits and numbers · memory and storage · CPU vs GPU · the operating system · from code to hardware · networking · how the Web works · data storage and manipulation · peripherals and I/O · life of an AI request (capstone) · how AI "magic" works · the cloud · AI agents, tools and MCP.

The home page opens with a layered-architecture diagram (applications, networking, operating system, hardware) that shows how the modules fit together.

## The `cs-tutor` skill (personal tutor)

The course ships with a [Claude](https://claude.ai) skill that acts as a patient tutor for exactly this material.

- **Claude Code:** clone this repo, open Claude Code **in the repo folder** and ask, or type `/cs-tutor`. The skill is picked up from `.claude/skills/cs-tutor/`.
- **Claude.ai:** download `cs-tutor.zip` from the home page (or from `downloads/`) and upload it under *Settings → Capabilities → Skills*.

## Run it locally

The site is plain HTML, CSS and JavaScript: no build step, no dependencies.

```bash
git clone https://github.com/lstak/cs-for-ai.git
cd cs-for-ai
python3 tools/serve.py          # then open http://127.0.0.1:8000/
```

(Opening `index.html` directly in a browser also works.)

## Repository layout

```
.
├── index.html              Home page: intro, layered-architecture diagram, module list
├── m1-bits.html … m13-agents.html   One page per module
├── assets/
│   ├── style.css           Styling
│   ├── common.js           Shared code: module list (MODULES), navigation, quiz, progress
│   └── m1.js … m13.js      The interactive widgets and quiz for each module
├── downloads/              Files offered on the home page (SKILL.md, cs-tutor.zip), generated
├── .claude/skills/cs-tutor/SKILL.md   The tutor skill (source of truth)
├── tools/
│   ├── serve.py            Local dev server (caching disabled)
│   ├── build_downloads.py  Regenerates downloads/ from the skill
│   └── check.py            Consistency checks (modules, links, downloads)
├── .github/workflows/check.yml        Runs the checks on every push
├── .nojekyll               Tells GitHub Pages to serve the files as they are
├── LICENSE                 Creative Commons Attribution 4.0 (full legal text)
└── README.md
```

## Making changes

- **Edit a module:** change `mN-*.html` (text) and `assets/mN.js` (widgets and quiz).
- **Add a module:** create the page and script, add an entry to `MODULES` in `assets/common.js` (the list order decides the module number shown in the sidebar), and keep the "Module N" labels and references in the pages consistent.
- **Edit the skill:** change `.claude/skills/cs-tutor/SKILL.md`, then run `python3 tools/build_downloads.py` to refresh `downloads/`.
- **Before you commit:** `python3 tools/check.py`.

Learner progress (ticked modules) is stored in the visitor's own browser (`localStorage`); nothing is sent to a server.

Numbers in the simulations are realistic orders of magnitude, simplified for teaching; real hardware and services vary.

## License

This work is licensed under the [Creative Commons Attribution 4.0 International license (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The full text is in [`LICENSE`](LICENSE).

You are free to **share** (copy and redistribute the material in any medium or format) and **adapt** (remix, transform and build upon it) for any purpose, including commercially, as long as you give **appropriate credit**, link to the license, and indicate if you made changes. A suitable credit line is: *"How Computers Work: a crash course for AI practitioners", licensed under CC BY 4.0, link to this repository.*
