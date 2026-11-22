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

// Also macOS-only. A plain window cannot join another app's full-screen Space; a non-activating
// panel from an app with no Dock icon can, and showing it must not activate Donna, which would
// throw you out of the full-screen app.
test("the orb can show over a full-screen app on macOS", () => {
  const main = fs.readFileSync(path.join(import.meta.dirname, "..", "src-tauri", "src", "main.rs"), "utf8");
  assert.match(main, /ActivationPolicy::Accessory/);
  assert.match(main, /nonactivating_panel\(\)/);
  assert.match(main, /full_screen_auxiliary\(\)/);
  assert.match(main, /can_join_all_spaces\(\)/);
  assert.match(main, /set_hides_on_deactivate\(false\)/);
  assert.match(main, /get_webview_panel\(app, "orb"\)[\s\S]{0,200}show_and_make_key\(\)[\s\S]{0,80}order_front_regardless\(\)/);
});

const MAIN_RS = () => fs.readFileSync(path.join(import.meta.dirname, "..", "src-tauri", "src", "main.rs"), "utf8");

test("the orb rests at one size everywhere it is written down", () => {
  const orb = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "components", "Orb.jsx"), "utf8");
  const rust = Number(/const RESTING: f64 = ([\d.]+);/.exec(MAIN_RS())[1]);
  const page = Number(/const RESTING = (\d+);/.exec(orb)[1]);
  assert.equal(rust, page);
  assert.equal(windowNamed("orb").width, page);
  assert.equal(windowNamed("orb").height, page);
});

// macOS-only, so pinned at the source: sized and moved in one frame (two steps was the jump),
// put away as a circle, and a desktop switch tells the page so she doesn't follow you.
test("the orb is placed in one step, put away as a circle, and leaves on a desktop switch", () => {
  const main = MAIN_RS();
  assert.match(main, /setFrame_display\(/);
  assert.match(main, /fn hide_orb[\s\S]{0,200}hide\(\)[\s\S]{0,80}Some\(\(RESTING, RESTING\)\)/);
  for (const caller of ["fn toggle_orb", "fn dismiss_orb", "fn open_calendar"]) {
    assert.match(main, new RegExp(`${caller}[\\s\\S]{0,250}hide_orb\\(`), caller);
  }
  assert.match(main, /NSWorkspaceActiveSpaceDidChangeNotification[\s\S]{0,40}[\s\S]*emit_to\("orb", "orb-away"|emit_to\("orb", "orb-away"[\s\S]*NSWorkspaceActiveSpaceDidChangeNotification/);
  assert.match(fs.readFileSync(path.join(import.meta.dirname, "..", "src", "lib", "notify.js"), "utf8"), /listen\("orb-away"/);
});
