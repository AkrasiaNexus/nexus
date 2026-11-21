# Nudge handoff

## Goal (user's words)
"its jus my very own secertary i jus give it whatever im thinking about and it shedules it remembers it plans it squeezes it in my shedule". "it should be one model handling everything basically jus a ai planner cuz ill be like oh wait i dont wanna do this anymore and then it should rmoe that goal". It's for personal use.

## There are two Nudges
1. **The desktop app**, `nudge/` (Tauri 2 + React 19 + Vite + Tailwind):
   - Tray icon, a Ctrl/Cmd+Shift+N capture popup, a rule-based parser (`src/lib/parser.js`), check-ins at 25/50/75/100% of the deadline, and native notifications.
   - A JavaScript port of Idiolect's normalizer (`src/lib/idiolect.js`), checked against `test/fixtures/idiolect-conformance.json`.
   - Tests: `cd nudge && npm test` passes 22/22 (unit + Playwright e2e).
2. **The AI planner prototype**, `nudge/prototype/nudge-planner.html`, live at https://claude.ai/artifact/Eig4tD3yVEsSwHn3iTywbf (version 3):
   - One Claude model, through the artifact `sample` capability with page tools, does all the planning.
   - Tools: `add_goal`, `update_goal`, `remove_goal`, `find_free_slots`, `schedule_block`, `move_block`, `remove_block`, `set_fixed`, `remove_fixed`, `remember`.
   - It must ask for **minutes per day and a deadline** before adding a goal, then set a priority (high, medium or low). High-priority goals get the good slots.
   - Data: a private per-user doc in artifact `db` at `data/users/<id>/planner`. It falls back to `localStorage` when there's no db.
   - Capabilities declared: `sample`, `db`, `user`, `dictation`.
   - **Design** (v3, "make it exciting, not ChatGPT with a calendar"):
     - a mascot secretary with moods (thinking, happy, bye, sad) and a speech bubble
     - a next-up countdown card
     - quest-board goal cards with priority flames and progress rings
     - the week as tall time-tracks
     - a pinned "dump it" bar with a mic
     - Undo for every change
   - **Source layout:** logic in the middle of the file; render functions and wiring in the tail. Syntax-check the extracted `<script>` with `node --check`.

## Next
- **The user is designing the UI and will send references.** Build on those references when they arrive.
- **Not verified:** whether the private db save persists across reloads. Claude can't read a user's private subtree, so ask the user to check.
- **The desktop app and the prototype have diverged.** Decide with the user whether the AI planner replaces the rule-based parser in the Tauri app (it would need a model: Claude API, or a local model on the user's Mac).
- **Model notes from the Idiolect eval:**
  - For the user's messages, Gemma 4 12B with the Idiolect profile in the prompt scored 30/37 on intent (best).
  - Qwen3.5 4B with normalization scored 27/37.
  - The user's Mac RAM is still unknown; the user was asked.
- **Roadmap from the README:** phone/laptop sync, voice capture, Snooze/Done actions on notifications.
- **Idiolect's v1 profile** (`idiolect/profiles/me.md`) is the best description of how to read the user. The prototype's prompt has a short inline version (`HOW_I_WRITE`).
