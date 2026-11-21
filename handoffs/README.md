# Handoffs: one session per app

Written 21 Nov 2026 when the work was split into one Claude session per app. Each file below is a standalone handoff: read it first, then work only inside that app's folder.

| App | Folder | Handoff | Live page |
|---|---|---|---|
| Lore (sidequest generator) | `lore/` | [lore.md](lore.md) | https://claude.ai/artifact/LwNwhfV2J2aWaz7CTd35DH |
| Nudge (AI secretary / planner) | `nudge/` | [nudge.md](nudge.md) | https://claude.ai/artifact/Eig4tD3yVEsSwHn3iTywbf |
| Idiolect (slang + typo interpreter) | `idiolect/` | [idiolect.md](idiolect.md) | none (library + CLI) |
| Campfire (CRDT sync for Lore Book) | `campfire/` | [campfire.md](campfire.md) | none (library) |
| Portfolio (links every project) | `portfolio/` | [portfolio.md](portfolio.md) | https://claude.ai/artifact/F3d2TopkdsyACginYVcQ1E |

## Rules for every session

- `CLAUDE.md` at the repo root is the user's ruleset and loads automatically. It covers reply style (start with "big boy" and call the user "big boy", never "Boss"; terse; end with what was skipped and any risk), research first, TDD, a review before each commit, and conventional commits.
- **Where the code is:** all of this work lives on branch `claude/zen-ramanujan-ouxg54` (109 commits as of this handoff) and may not be on `main` yet. If your checkout doesn't have `lore/`, `nudge/`, `idiolect/` and so on, run `git fetch origin claude/zen-ramanujan-ouxg54` and merge it into your branch first.
- **Stay in your folder.** Shared files (`CLAUDE.md`, `.claude/`, `.mcp.json`, `portfolio/`) are edited only when the user asks, so parallel sessions don't conflict.
- **Lore ↔ Campfire:** Campfire is bundled into `lore/prototype.html` between `/* campfire:start */` markers by `node campfire/tools/bundle.js lore/prototype.html`. Never hand-edit that block.
- **Idiolect ↔ Nudge:** Nudge's desktop app ships a JavaScript port of Idiolect's normalizer, checked against vectors from `idiolect/tools/export_conformance.py`, which uses the frozen `me-v0.md`.
- **Portfolio numbers** (test counts and the like) must match reality. Whoever changes a project's tests should tell the user, so the portfolio can be updated.
- **Tools in this environment:**
  - **Firecrawl** for web search and scraping. Reddit blocks this server's IP, so read it through Firecrawl's Alexandria provider `anyapi` `reddit/subreddit-search`.
  - **Playwright:** the library works from Node. The Playwright MCP needs `--no-sandbox`, which is already set in `.mcp.json` but only takes effect in a new session.
  - **Other MCPs:** graphify, serena, code-graph, context7, repomix, headroom.
  - **Malware scans:** every new skill or repo gets scanned with NVIDIA SkillSpector before it's installed (the user's rule).
