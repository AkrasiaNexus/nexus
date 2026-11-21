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
156 tests pass: `cd donna && npm test` (143 unit + 13 Playwright e2e). The e2e suite takes
`CHROMIUM_PATH` so it can run against a browser Playwright didn't install itself — in the cloud
container, `CHROMIUM_PATH=/opt/pw-browsers/chromium npm test`.

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
| The orb (circle at rest, card when it speaks) | `src/components/Orb.jsx` |
| The week calendar | `src/components/WeekView.jsx` |
| The chatbox under the calendar | `src/components/AskBar.jsx` |
| The computed daily brief | `src/lib/brief.js` |
| Orb window, corner anchoring, Ctrl+Option+D | `src-tauri/src/main.rs` |

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
- **Prefix cache is NOT reused by gemma4 on MLX**: the 2nd call of a turn re-prefills all
  ~2050 tokens (31.7s). Qwen on the same MLX runner *does* reuse it (2317 tok in 0.7s).
- **Goal sessions are booked in code** (`goalSessions` in `schedule.js`, called by `add_goal`):
  one a day in each day's first free gap, up to the due date, max 14 days. Verified on real
  Gemma: "learn rust 30 mins a day for 2 weeks" → goal due 12-05 + daily sessions, and the
  reply named the real first slot. "for 2 weeks" now counts as the deadline (prompt).
  `add_goal` never throws once the goal is saved (a throw made the model retry → duplicate
  goal): failures come back in `skipped`, and `note` says when nothing fit or the 14-day
  horizon cut it short. **Decision:** auto sessions *skip* a day where another deadline is
  pending instead of asking — the user didn't request them, so that day's time is left for
  what's due. A past `due` is refused.
- **Pushback only blocks on deadlines due that day or overdue since yesterday**
  (`OVERDUE_GRACE_DAYS = 1` in `pushback.js`); older items no longer wall off every booking.

### Gemma 4 12B vs Qwen 3.5 4B, same probe (21 Nov 2026)
| | gemma4:12b | qwen3.5:4b |
|---|---|---|
| booking turn (2 calls) | 48-66s | ~17s |
| "gym at 9pm" / "gym mon wed fri" | ok / ok | ok / ok |
| "lowk wanna learn rust" (no minutes, no deadline) | asks both | **invents both, books a week** |
| "30 mins a day, 2 weeks" follow-up | adds goal | **adds a duplicate goal** |
| pushback refuse | ok | ok |
| "nah fr i need a break, book it" | books (`confirmed`) | **never confirms: user can't override** |
Not switched: the model choice is the user's call. Qwen's failures are behavioural, not speed;
the override one would need a code-side "pending objection" so a yes confirms without the model.

## Next, in order
1. **Speed is the blocker** (48s/turn on Gemma). Options: (a) cut prefill (below);
   (b) Qwen 4B plus code-side fixes for its two failures — the user decides; (c) find out why
   gemma4's prefix cache isn't reused on MLX — fixing that alone roughly halves a turn.
   **Cut prefill.** ~900 of ~2000 prompt tokens are `profile.md`, which is the *generic*
   slang baseline a 12B already knows. Options, best first: send the user text through
   `idiolect.normalize` and drop the profile from the prompt; shorten tool descriptions; find out
   why the MLX runner rarely reuses the prefix cache. Measure with the timing fields after each.
2. **Check the desktop panel by eye.** `npm run tauri dev` builds (1m47s) and runs with no
   panics, but macOS blocked both synthetic keystrokes and screenshots for Claude, so nobody has
   seen the panel yet: press Ctrl+Option+D, check it anchors right, a blurt reaches Ollama (CSP),
   and a reminder appears without stealing focus.
3. Goals book at most 14 days ahead; nothing books the weeks after that yet.
4. The user is designing panel UI and will send references. Build on those when they arrive.

## Unverified / risks
- **Desktop panel unseen** — the app launched, but no one has looked at it (see Next 2).
- A turn times out after 4 min (`TURN_TIMEOUT_MS` in `useDonna.js`) and unlocks the panel.
- Reviewed (code + security) before commit; all HIGH/MEDIUM fixed. Not fixed, pre-existing:
  `toMin` in `time.js` accepts `24:01`-`24:59`, so a block can run past midnight.
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
