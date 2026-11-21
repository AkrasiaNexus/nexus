# Donna handoff

Rewritten 21 Nov 2026 (twice: after the pivot to a background app, then after the first real-model run).
Branch: `claude/serene-davinci-c0ox6c`. Work only in `donna/`.

## Goal (user's words)
"its jus my very own secertary i jus give it whatever im thinking about and it shedules it
remembers it plans it squeezes it in my shedule". Then the pivot:

> "i dont want a website i want a silent background app which only gets activated when i press
> a shortcut and then on the side it gives me short reminders like oh u gotta start working on
> the project in the next 5 mins or ur cooked type shi"

And on how the planning should behave:

> "sometimes i tell u when some things are and sometimes i jus wanna do random things so that
> u plan it urself if i dont give a time... if something is a priotory and then i say yo i wanna
> do this in 5 mins u say shi like oh thats not a good idea cuz u have this due today better
> finish this off... and u check in at the end of the day to check if i missed anything if i did
> then u move it to the first thing i do next day cuz its backlog"

It is for personal use. The name is Donna Paulsen, from Suits.

## Decisions already taken (don't relitigate)
- **The Tauri desktop app is the product.** The web planner at
  `donna/prototype/donna-planner.html` is now a reference for the scheduling model only.
- **Brand vs domain split:** the product is Donna; a *nudge* is still the escalating
  check-in she sends. `dueNudges`, `getNudgeSchedule`, `useNudgeTicker`, `item.nudges`,
  `nudges.js` keep the word on purpose. Don't "finish the rename".
- **The brain is local Ollama**, `gemma4:12b`, on the user's 16GB M4 Mac. No API key, nothing
  leaves the machine. The user has pulled the model and `ollama serve` works.
- **Pushback is refuse-until-confirmed**, not a passive warning.
- **No fine-tuning.** The user asked; it was roasted and dropped. The Idiolect eval set is 37
  examples, which is a prompt, not a dataset, and the measured 30/37 came from putting the
  profile *in the prompt*. Revisit only with thousands of examples.
- The 900x700 main window was **kept** (tray → "Open Donna"), but it is no longer the daily
  surface. The user did not ask for it to be deleted.
- localStorage keys `nudge_items` / `nudge_last_check` kept deliberately so existing data
  survives; the new plan data lives under `donna_plan`.

## What is built and verified
100 tests pass on the Mac: `cd donna && npm test` (93 unit + 7 Playwright e2e). The e2e tests
ran for the first time on 21 Nov 2026, after `npm ci` and `npx playwright install chromium`.

| Area | Files |
|---|---|
| Clock times, local dates | `src/lib/time.js` |
| Free slots, clash detection | `src/lib/schedule.js` |
| Reminders before a session starts | `src/lib/reminders.js` (`LEAD_MINUTES = 5`) |
| End-of-day sweep → backlog | `src/lib/backlog.js` |
| Donna's voice | `src/lib/nudgeMessages.js` |
| Local model client | `src/lib/ollama.js` (`num_ctx` 8192, `think: false`, `keep_alive: -1`) |
| Refuse-until-confirmed guard | `src/lib/pushback.js` |
| Planner loop: tools, prompt, turn loop, argument validation | `src/lib/planner.js` |
| Panel ↔ planner wiring (thread, busy, errors) | `src/hooks/useDonna.js` |
| Plan state (blocks + fixed, `move`, `removeForItem`) | `src/stores/planStore.js` |
| Goals (`addGoal`) | `src/stores/itemStore.js` |
| The side panel (latest exchange + thinking dots) | `src/components/Panel.jsx` |
| Panel window, edge anchoring | `src-tauri/src/main.rs` (`anchor_right`, `announce`) |

Design points worth keeping:
- **The shortcut takes focus; a reminder does not.** `toggle_panel` focuses because the user
  pressed it to type. `announce` reveals the panel unfocused.
- **`num_ctx` is pinned to 8192.** Ollama picks 4096 on a 16GB Mac and silently truncates.
- **A blocked booking returns the guard's objection verbatim** and ends the turn. Gemma was seen
  saying "i put valorant in" over a blocked call; now the model never gets to word a refusal.
- **Model tool arguments are untrusted input**: date/time/minutes/weekdays are checked in
  `planner.js`; a bad call goes back to the model as `{ error }` so it can retry.
- **The prompt ends with the changing parts** (plan, then "Right now: Sat 2026-11-21 15:57"),
  so the fixed rules + profile stay a stable prefix for Ollama's cache.
- `CSP` in `tauri.conf.json` now has `connect-src 'self' http://127.0.0.1:11434`. Without it the
  webview blocked every call to Ollama — it would have failed on the first desktop run.

## Real-model findings (21 Nov 2026, gemma4:12b, Ollama 0.40.17, MLX runner, M4 16GB)
Don't re-derive these.
- **Tool calls work. The format needs no fixing.** Gemma 4 calls `schedule_block`, `set_fixed`,
  `add_goal` with correct args through Ollama's native `tools`.
- **Measured, not guessed** (Ollama's `*_duration` fields): the model was warm (`load=0.0s`).
  Thinking was the big cost — 880 thinking tokens before "say hi in five words", ~533 per turn
  at ~12 tok/s (≈ the M4's bandwidth ceiling for a 7.7GB model). `think: false` → 0.
- **What's left is prefill:** ~2000 prompt tokens at ~65-90 tok/s ≈ 22-30s **per model call**,
  and a booking turn is 2 calls. Prefix caching only kicked in once (2107 tok in 1.1s); usually
  every call re-prefills everything. A real panel turn ("gym at 9pm today") took **48s** in
  Chromium against real Gemma (was 130s at session start).
- `keep_alive: -1` is sent per request (`ollama ps` shows `UNTIL Forever`) — no env var needed.
  It keeps 7.7GB resident; the Mac was already using ~4-5GB swap.
- Pushback still works with thinking off: it refused valorant while physics was due, then
  booked on "nah fr i need a break, book it" (with `confirmed: true`).
- Fixed from real runs: one-off sessions were treated as goals (asked for a deadline for "gym at
  6pm"); deadlines went over as UTC ISO and the model read 19:00Z as "due at 7pm"; the prompt
  had no clock time, so "in 5 mins" was booked at 07:05.

## Next, in order
1. **Cut prefill.** ~900 of ~2000 prompt tokens are `profile.md`, which is the *generic*
   slang baseline a 12B already knows. Options, best first: send the user text through
   `idiolect.normalize` and drop the profile from the prompt; shorten tool descriptions; find out
   why the MLX runner rarely reuses the prefix cache. Measure with the timing fields after each.
2. **Run the app on the Mac**: `cd donna && npm run tauri dev`. Check the panel anchors right,
   `focused(false)` holds on macOS, and the CSP change lets the webview reach Ollama.
3. Gemma said "i'll start booking those 30 min sessions now" after `add_goal` and booked none.
   Either make it book in the same turn (prompt) or have code book goal sessions.
4. The user is designing panel UI and will send references. Build on those when they arrive.

## Unverified / risks
- **Desktop (Tauri) run not done yet** — everything above ran in Node and headless Chromium.
- A turn times out after 4 min (`TURN_TIMEOUT_MS` in `useDonna.js`) and unlocks the panel.
- Reviewed (code + security) before commit; all HIGH/MEDIUM fixed. Not fixed, pre-existing:
  `toMin` in `time.js` accepts `24:01`-`24:59`, so a block can run past midnight.
- An overdue active item blocks *every* booking until it is done or skipped — by design, but
  now visible. If it nags, consider only blocking on today's deadlines.
- `npm test` was silently running zero tests on Node 20 (quoted glob needs Node 21+); now
  `node --test test/`. CI uses Node 22 so it was fine there.
- The Tauri `identifier` changed to `app.donna.desktop` during the rename, so the macOS app-data
  directory changed with it. Any desktop localStorage from before the rename will not carry over.
- `portfolio/index.html` links to `.../tree/claude/zen-ramanujan-ouxg54/donna`, a branch where
  that folder is still called `nudge/`. The link 404s until this branch merges.
- 4 orphan `nudge/` references linger in generated `graphify-out/graph.json`. Cosmetic.

## Environment notes
- **Cloud sessions cannot reach the user's Mac folder.** `~/Projects` on the computer "Asus" is in
  their Remote Control list but is reported `not_available` to cloud sessions. Run Claude Code
  natively on the Mac instead.
- Tauri Linux build deps (`libwebkit2gtk-4.1-dev` and friends) are **not** preinstalled in the
  cloud container; `apt-get install` them before `cargo check`.
- Playwright in the container: launch with `executablePath: '/opt/pw-browsers/chromium'` and
  `--no-sandbox`; the bundled headless shell build does not match the installed Playwright.
