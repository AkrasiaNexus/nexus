# Nudge

A brain-dump app that lives in your system tray. Press `Ctrl/Cmd + Shift + N` from anywhere, type whatever you're thinking ("learn rust 2 weeks"), and close it. Nudge sorts it into a skill, idea, task, habit or exploration, gives it a deadline, and checks in at 25%, 50%, 75% and 100% of the time you gave yourself.

> **Status: work in progress.** The frontend builds and runs in a browser. The desktop wrapper (Tauri) is written but hasn't been compiled yet, and notifications aren't wired up.

## Why

Ideas, skills to learn and side projects get thought about once and forgotten. Todo apps are too heavy to open in the moment, and reminder apps are easy to dismiss. Nudge is built to be the fastest place to dump a thought, and the most persistent about following up on it.

## What works now

- Capture box that parses free text into a title, category, effort and deadline (`src/lib/parser.js`)
- Week planner grouping items into overdue, each of the next 7 days, and later
- Cards with a progress bar, plus done / extend 7 days / delete actions
- Nudge schedule (25/50/75/100%) with escalating tone (`src/lib/nudgeMessages.js`)
- Rust side: system tray menu and a global shortcut that toggles a frameless quick-capture window (`src-tauri/src/main.rs`)

## Tech stack

- **Desktop shell:** Tauri 1 (Rust), about 10 MB instead of Electron's 150 MB
- **UI:** React, Vite, Tailwind CSS
- **Storage:** `localStorage` for now. The Supabase client is set up for cross-device sync.

## Getting started

```bash
npm install
npm run dev          # browser version at http://localhost:1420
```

Desktop app (needs Rust and a tray icon at `src-tauri/icons/icon.png`):

```bash
npm run tauri dev
```

## Roadmap

- [ ] Tray icon, a capture-only popup route, and a first Tauri build
- [ ] Fire native notifications on the nudge schedule
- [ ] Supabase sync across phone and laptops
- [ ] Replace the regex parser with an LLM intent layer (see the `idiolect` project)
- [ ] Voice capture
- [ ] Tests for the parser and the scheduling logic

## License

MIT. See [LICENSE](LICENSE).
