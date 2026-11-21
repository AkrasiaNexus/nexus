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
386 tests pass: `cd donna && npm test` (unit, fuzz and Playwright e2e), plus 5 Rust tests via `cargo test` in `src-tauri`. The e2e suite takes
`CHROMIUM_PATH` so it can run against a browser Playwright didn't install itself — in the cloud
container, `CHROMIUM_PATH=/opt/pw-browsers/chromium npm test`.

`npm test` runs `node --test test/*.test.js`, an **unquoted** glob on purpose: `node --test test/`
throws MODULE_NOT_FOUND on Node 22, and the quoted form silently ran zero tests on Node 20. The
shell expanding it to real filenames is the only form that works on both. It is not portable to
Windows `cmd.exe`, which Donna does not target.

| Area | Files |
|---|---|
| Clock times, local dates | `src/lib/time.js` |
| Free slots, clash detection (weekly commitments + sessions + calendar events) | `src/lib/schedule.js` |
| The subscribed iCalendar feed → busy time | `src/lib/calendar.js` |
| Reading a date out of a blurt | `src/lib/parser.js` (chrono-node) |
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
| Orb window, corner anchoring, Option+D | `src-tauri/src/main.rs` |

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
- **Dates come from chrono-node, not a regex table.** The old table could not express an absolute
  date at all, so `submit UCAS by jan 15` silently became "a week from now" and every check-in
  fired in the wrong month. Three chrono behaviours are handled rather than worked around:
  `today`/`this week`/`this month` resolve to the period's *start* (already gone for a deadline),
  so those three stay a local table; a bare month or a three-letter weekday in prose is rejected
  (`march madness`, `sat nav fix`) via `isCertain`, never the package's private `knownValues`;
  and `2 wks` is rewritten to `2 weeks` because chrono reads `2 w` and `2 weeks` but not that.
- **The calendar feed is fetched in Rust, by `curl`.** The webview's `connect-src` stays locked to
  Ollama, so an arbitrary feed host can't be reached from JS, and `reqwest` is in the tree with no
  TLS backend — linking one in for a single GET was not worth it. macOS ships `curl`, and it gives
  `--max-time`/`--max-filesize` for free. The URL goes in as its own argv entry after `--`, never
  through a shell, and redirects are pinned with `--proto =https --proto-redir =https`.
- **The feed address is a secret** (a Google "secret iCal address" reads the whole calendar), so it
  lives in `donna_calendar_url` / `VITE_CALENDAR_URL` and deliberately **not** in `donna_plan`,
  which is what goes into the model prompt. It is never logged and never quoted back in an error.
- **A recurrence rule is walked at most 10,000 steps.** `FREQ=SECONDLY` dated a few years back
  needs ~200 million steps to reach the window and froze the app outright (reproduced). 10,000
  covers 27 years of a daily rule; past that the event is dropped as a broken feed.
- **An all-day event is not busy time.** A public holiday is the common all-day entry and it frees
  the day rather than filling it. A multi-day trip is therefore not blocked out — known limit.
- **Events are immovable.** `displacementCost` now weighs only `kind === "block"`, so school and a
  calendar event are refused outright instead of being offered as something to trade away.

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

## Fixed overnight, 21-22 Nov (all tested, all pushed)
- **Reminders never fired in the background.** Tauri's default suspends a hidden webview's timers
  after ~5 min; Donna is hidden nearly always. Both windows now set `backgroundThrottling: "disabled"`
  (macOS 14+), pinned by `test/config.test.js` since only a Mac can show it.
- **Reminders fired on the wrong day / wrong half of the day / not at all.** `tomorrow at 9am` fired
  today, `at 5` at 2pm meant 05:00, `tomorrow at 5` meant 05:00, and anything the old regex missed
  fell to the model, which has no reminder tool. Now chrono-node; bare hours follow the waking-day
  rule; no time gets "when?" and a reply of just a time finishes it. They fire within ~3s of their
  moment (a timer aimed at the next one), and she says the real time back: "i'll say fri 09:00".
- **Broken saved data blanked the window** (10 of 18 seeded shapes crashed). Both stores sanitise on
  load; independent review confirmed nothing the app itself writes is ever dropped.
- **Coming back after a break piled every missed session onto tomorrow** (14 on one day). Misses older
  than a week are left as history; at most the three most recent carry forward.
- **Model replies in other shapes** — string tool arguments, malformed calls, non-JSON bodies — are
  read instead of crashing; an Ollama failure now says Ollama's reason ("out of memory").
- **The week shows deadlines and reminders** on the calendar itself, plus a session's goal/priority/due
  on hover and one "not booked:" line that only appears when needed.
- **`test/fuzz.test.js`**: seeded property tests over ~2,800 random plans (never double-books, never
  says "undefined"); checked for teeth by planting two bugs, both caught.

## Next, in order
1. **Speed: the cause is found, the fix is one command on the Mac.** Measured on the user's Mac
   (22 Nov 2026): an identical 1,620-token prompt sent twice took **30.1s then 31.3s** — zero prefix
   cache reuse. That is Ollama's MLX engine ([ollama/ollama#17829](https://github.com/ollama/ollama/issues/17829));
   since v0.40 MLX is the default on Apple Silicon, and `ollama ps` shows `RUNNER mlx`. Prefill is
   **54 tok/s**; a call carries **~935 tokens of prompt + ~605 of tool schemas = ~1,540** (the old
   "900-token profile" figure was wrong: `profileForPrompt` already strips the tables, so only 212
   reach the model — do not cut the profile on that basis). Fix to try first:
   `ollama pull --runner llamacpp gemma4:12b`, then confirm `ollama ps` says `llamacpp` and re-run
   the two-shot probe — run 2 should fall to near zero. Already done in code: a finished booking is
   confirmed without a second model call (halves a booking turn). Generation was also 2-4 tok/s
   against 12 the day before, with 5.9GB of 7.2GB swap in use — memory pressure with `tauri dev`
   running; a 4B model (Qwen 3.5) would not swap at all.
2. **Check the desktop panel by eye.** `npm run tauri dev` builds (1m47s) and runs with no
   panics, but macOS blocked both synthetic keystrokes and screenshots for Claude, so nobody has
   seen the panel yet: press Option+D, check it anchors right, a blurt reaches Ollama (CSP),
   and a reminder appears without stealing focus.
3. **Nothing lets you paste the calendar address.** The feed works, but like the Firecrawl key
   it has to be set by hand — `localStorage.setItem("donna_calendar_url", "<the url>")` in the
   webview console, or `VITE_CALENDAR_URL=... npm run tauri build`. Google Calendar → Settings →
   the calendar → "Secret address in iCal format"; iCloud → share a calendar publicly and swap
   `webcal://` for `https://` (the Rust side accepts either). A paste box belongs in whatever
   settings UI the user designs — deliberately not invented here.
4. Goals book at most 14 days ahead; nothing books the weeks after that yet.
5. The user is designing panel UI and will send references. Build on those when they arrive.

## Unverified / risks
- **Desktop panel unseen** — the app launched, but no one has looked at it (see Next 2).
- A turn times out after 4 min (`TURN_TIMEOUT_MS` in `useDonna.js`) and unlocks the panel.
- Reviewed (code + security) before commit; all HIGH/MEDIUM fixed. Not fixed, pre-existing:
  `toMin` in `time.js` accepts `24:01`-`24:59`, so a block can run past midnight.
- `npm test` is `node --test test/*.test.js`, unquoted, because the directory form throws
  MODULE_NOT_FOUND on Node 22 and the quoted glob silently ran zero tests on Node 20. Not
  portable to Windows `cmd.exe`; Donna does not target it.
- **The Rust side has tests now** (`cd donna/src-tauri && cargo test`, 5 of them, all on the feed
  address rules). They are not wired into `npm test` — run both.
- **An all-day calendar entry is not busy time.** Right for a public holiday, wrong for a
  multi-day trip, which will not be blocked out. Known, deliberate.
- **A calendar event cannot be moved or dropped by Donna** and is refused outright rather than
  weighed: `displacementCost` only considers `kind === "block"`.
- **The feed is trusted for timing, never for words.** Titles are stripped of control characters
  and capped at 80 for the DOM, and the model is only ever told "a calendar commitment" — the one
  thing standing between a shared calendar and the prompt. `planner.js` also excludes `events`
  from the system prompt; keep it that way.
- **A recurrence rule is walked at most 10,000 steps and 500 occurrences, 2,000 entries a feed.**
  Past that the event is dropped with a `console.warn`. A legitimate daily rule reaches 27 years
  back, so this should never bite, but if a real commitment ever vanishes, that warning is why.
- The calendar refreshes every 15 minutes (`REFRESH_MS`), and a failed fetch keeps the events
  already known rather than emptying the week.
- An e2e test was passing or failing by the time of day: its seed had an un-ticked 19:00 session
  and no `askedOn`, so after 21:00 the evening question popped the orb open and there was no
  circle left to click. Seeds with a past session now set `askedOn`. Worth checking the other
  orb seeds if one starts flaking in the evening.
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
