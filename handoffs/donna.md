# Donna handoff

Rewritten 21 Nov 2026, after the user pivoted the product away from a web planner.
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
75 unit tests pass (`cd donna && node --test "test/*.test.js"` — note the 6 Playwright e2e
tests need a browser; see Unverified).

| Area | Files |
|---|---|
| Clock times, local dates | `src/lib/time.js` |
| Free slots, clash detection | `src/lib/schedule.js` |
| Reminders before a session starts | `src/lib/reminders.js` (`LEAD_MINUTES = 5`) |
| End-of-day sweep → backlog | `src/lib/backlog.js` |
| Donna's voice | `src/lib/nudgeMessages.js` |
| Local model client | `src/lib/ollama.js` (`num_ctx` pinned to 8192) |
| Refuse-until-confirmed guard | `src/lib/pushback.js` |
| Planner loop: tools, prompt, turn loop | `src/lib/planner.js` |
| Plan state (blocks + fixed) | `src/stores/planStore.js` |
| The side panel | `src/components/Panel.jsx` |
| Panel window, edge anchoring | `src-tauri/src/main.rs` (`anchor_right`, `announce`) |

Two deliberate design points worth keeping:
- **The shortcut takes focus; a reminder does not.** `toggle_panel` focuses because the user
  pressed it to type. The `announce` command reveals the panel unfocused so it never swallows
  keystrokes meant for another app.
- **`num_ctx` is pinned to 8192.** Ollama sizes context from free VRAM and picks 4096 on a 16GB
  Mac, which silently truncates the profile and the plan with no error.

## Next, in order
1. **Wire `planner.js` into the panel.** It is built and unit-tested but nothing calls it yet:
   the panel's input still goes straight to `itemStore.add`. `createTools` wants callbacks onto
   `planStore` and `itemStore`, and `systemPrompt` wants `profile.md` (import it with `?raw`,
   as `itemStore` already does).
2. **First real run against Gemma 4.** Nothing has touched a real model yet. Expect the tool-call
   format to need fixing: Ollama lists `tools` as a gemma4 capability but it is unproven here.
3. **Run the app on the Mac**: `cd donna && npm run tauri dev`. Check the panel anchors to the
   right edge and that `focused(false)` holds on macOS — on some platforms a repeated `show()`
   re-raises the app.
4. The user is designing panel UI and will send references. Build on those when they arrive.

## Unverified / risks
- **The 6 Playwright e2e tests have never been run.** The cloud container has no matching
  `chrome-headless-shell`. Run `npm test` on the Mac. The README says 56 tests; that is 50 unit
  (verified at the time) + 6 e2e (unverified). It now says 56 but there are 65 unit tests —
  **update the README count** once the e2e tests actually run.
- **No real model call has happened.** `ollama.js` is tested against a stubbed `fetch`.
- The Tauri `identifier` changed to `app.donna.desktop` during the rename, so the macOS app-data
  directory changed with it. Any desktop localStorage from before the rename will not carry over.
- `portfolio/index.html` links to `.../tree/claude/zen-ramanujan-ouxg54/donna`, a branch where
  that folder is still called `nudge/`. The link 404s until this branch merges.
- 4 orphan `nudge/` references linger in generated `graphify-out/graph.json`; `--force` would
  not purge them. Cosmetic.

## Environment notes
- **Cloud sessions cannot reach the user's Mac folder.** `~/Projects` on the computer "Asus" is in
  their Remote Control list but is reported `not_available` to cloud sessions. Run Claude Code
  natively on the Mac instead.
- Tauri Linux build deps (`libwebkit2gtk-4.1-dev` and friends) are **not** preinstalled in the
  cloud container; `apt-get install` them before `cargo check`.
- Playwright in the container: launch with `executablePath: '/opt/pw-browsers/chromium'` and
  `--no-sandbox`; the bundled headless shell build does not match the installed Playwright.
