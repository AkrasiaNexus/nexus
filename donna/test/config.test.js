import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const CONF = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "src-tauri", "tauri.conf.json"), "utf8"));
const windowNamed = (label) => CONF.app.windows.find((w) => w.label === label);

// This cannot be exercised outside macOS, so the setting itself is pinned. Without it WebKit
// suspends a hidden window's timers after about five minutes, and Donna is hidden almost all
// the time: reminders, pre-session warnings, the calendar refresh and the overnight research
// would all quietly stop. See tauri-apps/tauri#5250.
test("the window that runs the ticker is never suspended while hidden", () => {
  assert.equal(windowNamed("main").backgroundThrottling, "disabled");
});

test("the orb stays loaded while hidden, so the shortcut never waits on a reload", () => {
  assert.equal(windowNamed("orb").backgroundThrottling, "disabled");
});

test("closing the main window hides it rather than ending the ticker with it", () => {
  const main = fs.readFileSync(path.join(import.meta.dirname, "..", "src-tauri", "src", "main.rs"), "utf8");
  assert.match(main, /CloseRequested[\s\S]{0,200}prevent_close\(\)[\s\S]{0,80}hide\(\)/);
});
