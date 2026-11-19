# Prompt to Push

A visual, single-page presentation that teaches the whole loop:

1. **Install** Git, the GitHub CLI and Claude Code (macOS, Windows, Linux)
2. **Connect** Git and your terminal to GitHub (`gh auth login`, SSH alternative), create a repo and turn on GitHub Pages
3. **Grant permissions** so Claude Code can `git commit` and `git push` on its own, safely (`.claude/settings.json` + `CLAUDE.md`)
4. **Visualize the flow**: an interactive swimlane diagram from creating the codebase → writing the request → Claude reading, editing, verifying → commit → push → GitHub Pages deploy

Pure HTML, CSS and JavaScript. No build step, no dependencies.

## Live site

After you enable GitHub Pages (see below), the site lives at:

```
https://<your-username>.github.io/prompt-to-push/
```

## Present it

| Key | Action |
| --- | --- |
| `→` / `PageDown` | Next slide |
| `←` / `PageUp` | Previous slide |
| `F` | Full screen |
| `T` | Light / dark theme |

The workflow diagram plays automatically the first time it scrolls into view. Use **Play**, **Next**, **Previous** or click any step to drive it by hand.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish to GitHub Pages

```bash
gh repo create prompt-to-push --public --source=. --remote=origin --push
gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"
```

Or in the browser: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Project structure

```
.
├── index.html            # all slides and content
├── assets/
│   ├── css/style.css     # Claude-toned theme, light + dark, animations
│   ├── js/main.js        # navigation, tabs, copy buttons, hero terminal, flow diagram
│   └── favicon.svg
├── examples/
│   ├── settings.json     # drop-in .claude/settings.json for auto commit & push
│   └── CLAUDE.md         # Git workflow rules for Claude
└── .nojekyll             # serve files as-is on GitHub Pages
```

## Use the examples in your own project

```bash
mkdir -p .claude
cp examples/settings.json .claude/settings.json
cp examples/CLAUDE.md CLAUDE.md
```

Adjust the allow and deny lists to taste, and add a branch protection rule for `main` on GitHub for server-side safety.

## Credits

An unofficial, community-made guide. Claude and Claude Code are trademarks of Anthropic, PBC. GitHub is a trademark of GitHub, Inc. Git is a trademark of Software Freedom Conservancy.
