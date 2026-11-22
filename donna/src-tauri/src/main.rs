#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Option+D. Two keys, one hand. Not on Apple's shortcut list; Command+letter belongs to
// whatever app is focused, Control+letter is the system-wide emacs text bindings, and
// Option+Space is the default hotkey for both Raycast and Alfred. The only thing Option+D
// costs is typing "∂".
const ORB_MODS: Modifiers = Modifiers::ALT;

const EDGE_MARGIN: i32 = 24;
// Clears the macOS dock, which sits over the bottom of the screen.
const BOTTOM_MARGIN: i32 = 96;
// The orb at rest, as in Orb.jsx and tauri.conf.json.
const RESTING: f64 = 72.0;

// On macOS a plain window cannot join another app's full-screen Space, so the orb is an NSPanel:
// non-activating (showing it never pulls you out of what you are in), able to take typing, and
// allowed onto every Space including full-screen ones. This is the setup Apple's DTS recommends.
#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(OrbPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

#[cfg(target_os = "macos")]
fn make_orb_a_panel(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};
    // Full-screen Spaces only admit panels from an app with no Dock icon.
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    let Some(window) = app.get_webview_window("orb") else {
        return Ok(());
    };
    let panel = window.to_panel::<OrbPanel>()?;
    panel.set_level(PanelLevel::Status.value());
    let _ = panel.set_style_mask(StyleMask::empty().borderless().nonactivating_panel().value());
    panel.set_collection_behavior(
        CollectionBehavior::new().can_join_all_spaces().stationary().full_screen_auxiliary().ignores_cycle().value(),
    );
    // NSPanel hides itself whenever the app loses focus, which for a menu-bar app is always.
    panel.set_hides_on_deactivate(false);
    Ok(())
}

// Joining every Space is what lets the orb into a full-screen one, and it also made her follow
// you to every desktop. So a desktop switch puts her away; the page decides whether it may.
#[cfg(target_os = "macos")]
fn put_orb_away_on_desktop_switch(app: &tauri::App) {
    use tauri::Emitter;
    use tauri_nspanel::objc2_app_kit::{NSWorkspace, NSWorkspaceActiveSpaceDidChangeNotification};
    let handle = app.handle().clone();
    let heard = block2::RcBlock::new(move |_: std::ptr::NonNull<tauri_nspanel::NSNotification>| {
        let _ = handle.emit_to("orb", "orb-away", ());
    });
    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    let observer = unsafe {
        center.addObserverForName_object_queue_usingBlock(Some(NSWorkspaceActiveSpaceDidChangeNotification), None, None, &heard)
    };
    // Listens for as long as Donna runs.
    std::mem::forget(observer);
}

// One frame, sized and pinned bottom-right together. Sizing and then moving drew the orb twice,
// the first time in the wrong place: the jump. The visible frame already leaves out the Dock.
#[cfg(target_os = "macos")]
fn place_panel(app: &AppHandle, size: Option<(f64, f64)>) -> bool {
    use tauri_nspanel::{objc2_app_kit::{NSEvent, NSScreen}, objc2_foundation::MainThreadMarker, ManagerExt, NSPoint, NSRect, NSSize};
    let Ok(panel) = app.get_webview_panel("orb") else {
        return false;
    };
    // AppKit only from the main thread; hop there rather than fall back to the two-step jump.
    let Some(main_thread) = MainThreadMarker::new() else {
        let app = app.clone();
        return app.clone().run_on_main_thread(move || { place_panel(&app, size); }).is_ok();
    };
    let window = panel.as_panel();
    // The screen you are on, found by the pointer: a hidden panel remembers the one it left.
    let pointer = NSEvent::mouseLocation();
    let here = NSScreen::screens(main_thread).into_iter().find(|screen| {
        let f = screen.frame();
        (f.origin.x..f.origin.x + f.size.width).contains(&pointer.x) && (f.origin.y..f.origin.y + f.size.height).contains(&pointer.y)
    });
    let Some(screen) = here.or_else(|| window.screen()).or_else(|| NSScreen::mainScreen(main_thread)) else {
        return false;
    };
    let area = screen.visibleFrame();
    let now = window.frame().size;
    let (width, height) = size.unwrap_or((now.width, now.height));
    let margin = f64::from(EDGE_MARGIN);
    let origin = NSPoint::new(area.origin.x + area.size.width - width - margin, area.origin.y + margin);
    window.setFrame_display(NSRect::new(origin, NSSize::new(width, height)), true);
    true
}

fn orb_shortcut() -> Shortcut {
    Shortcut::new(Some(ORB_MODS), Code::KeyD)
}

// Pin the orb to the bottom-right of whichever screen it is on.
fn anchor_bottom_right(app: &AppHandle, window: &WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) else {
        return;
    };
    let screen = monitor.size();
    let origin = monitor.position();
    let x = origin.x + screen.width as i32 - size.width as i32 - EDGE_MARGIN;
    let y = origin.y + screen.height as i32 - size.height as i32 - BOTTOM_MARGIN;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

// The orb's size, if given, and its place in the corner.
fn place_orb(app: &AppHandle, window: &WebviewWindow, size: Option<(f64, f64)>) {
    #[cfg(target_os = "macos")]
    if place_panel(app, size) {
        return;
    }
    if let Some((width, height)) = size {
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
    }
    anchor_bottom_right(app, window);
}

// Put away as a circle, so next time it appears as one in the corner rather than as an empty
// card-sized window with the circle in the middle of it.
fn hide_orb(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("orb") {
        let _ = window.hide();
        place_orb(app, &window, Some((RESTING, RESTING)));
    }
}

// `focus` is false when Donna speaks up on her own: a reminder must never swallow
// the keystrokes of whatever the user is typing in another app.
fn reveal_orb(app: &AppHandle, focus: bool) {
    if let Some(window) = app.get_webview_window("orb") {
        place_orb(app, &window, None);
        // A panel is shown without activating Donna, so a full-screen app keeps its Space.
        #[cfg(target_os = "macos")]
        if let Ok(panel) = tauri_nspanel::ManagerExt::get_webview_panel(app, "orb") {
            if focus {
                panel.show_and_make_key();
            } else {
                panel.order_front_regardless();
            }
            return;
        }
        let _ = window.show();
        if focus {
            let _ = window.set_focus();
        }
    }
}

fn toggle_orb(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("orb") {
        if window.is_visible().unwrap_or(false) {
            hide_orb(app);
        } else {
            reveal_orb(app, true);
        }
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

// Called from the ticker when a session is about to start.
#[tauri::command]
fn announce(app: AppHandle) {
    reveal_orb(&app, false);
}

// The orb is a circle at rest and a pill when it speaks, so the window follows its content
// and re-anchors, otherwise growing would push it off the bottom-right corner.
#[tauri::command]
fn resize_orb(app: AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("orb") {
        place_orb(&app, &window, Some((width, height)));
    }
}

// The orb's way back to the week: closing the main window only hides it, and nothing in the
// orb could bring it back. The orb steps aside so the calendar is not covered.
#[tauri::command]
fn open_calendar(app: AppHandle) {
    show_main(&app);
    hide_orb(&app);
}

#[tauri::command]
fn dismiss_orb(app: AppHandle) {
    hide_orb(&app);
}

// How much of a feed is worth reading; a calendar that big is not a calendar.
const CALENDAR_MAX_BYTES: usize = 4 * 1024 * 1024;

// Everything legal in a URL and nothing else. Excluding the quote, the backslash, whitespace
// and control characters is also what makes the address safe to write into curl's config
// format below, where it is wrapped in quotes.
fn is_url_safe(url: &str) -> bool {
    url.chars()
        .all(|c| c.is_ascii_alphanumeric() || "-._~:/?#[]@!$&'()*+,;=%".contains(c))
}

// The feed address is a secret — it grants read access to the whole calendar — so it is never
// logged, never quoted back in an error, and never put in argv, where any process the user runs
// could read it off `ps` and a crash report would capture it. It goes in on curl's stdin.
//
// Only https is fetched, since over plain http the address would travel in the clear. curl ships
// with macOS, which beats linking a TLS stack into the binary for one GET, and it enforces the
// protocol on redirects too, so a redirect cannot quietly downgrade the connection.
// Everything the feed address has to satisfy before it is fetched, in one place so it can be
// tested: the returned string is what goes to curl.
fn check_feed_url(raw: &str) -> Result<String, String> {
    let url = raw.trim().replacen("webcal://", "https://", 1);
    let Some(after_scheme) = url.strip_prefix("https://") else {
        return Err("the calendar address has to start with https://".into());
    };
    if !is_url_safe(&url) {
        return Err("that address has characters that don't belong in a URL".into());
    }
    // Userinfo disguises the real host: https://calendar.google.com@10.0.0.1/ fetches 10.0.0.1.
    let host = after_scheme.split(['/', '?', '#']).next().unwrap_or("");
    if host.is_empty() || host.contains('@') {
        return Err("the calendar address has to name a host and nothing before it".into());
    }
    Ok(url)
}

#[tauri::command]
async fn fetch_calendar(url: String) -> Result<String, String> {
    let url = check_feed_url(&url)?;

    let output = tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let mut child = std::process::Command::new("/usr/bin/curl")
            .args([
                "--silent",
                "--fail",
                "--proto",
                "=https",
                "--proto-redir",
                "=https",
                "--location",
                "--max-redirs",
                "3",
                "--max-time",
                "20",
                "--max-filesize",
                &CALENDAR_MAX_BYTES.to_string(),
                "--config",
                "-",
            ])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()?;
        match child.stdin.as_mut() {
            Some(stdin) => stdin.write_all(format!("url = \"{url}\"\n").as_bytes())?,
            None => return Err(std::io::Error::other("curl took no input")),
        }
        // wait_with_output closes stdin first, which is what tells curl the config has ended.
        child.wait_with_output()
    })
    .await
    .map_err(|_| "the calendar request could not be started".to_string())?
    .map_err(|_| "the calendar request could not be started".to_string())?;

    // curl's own message quotes the address, so stderr is discarded rather than surfaced.
    if !output.status.success() {
        return Err("the calendar could not be read \u{2014} check the address".into());
    }
    // curl aborts mid-transfer at the limit even when no length was declared; this is the
    // belt-and-braces check in case a build of curl ever does not.
    if output.stdout.len() > CALENDAR_MAX_BYTES {
        return Err("that calendar is too big to read".into());
    }
    String::from_utf8(output.stdout).map_err(|_| "the calendar sent something unreadable".to_string())
}

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());
    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if shortcut == &orb_shortcut() && event.state() == ShortcutState::Pressed {
                        toggle_orb(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![announce, dismiss_orb, fetch_calendar, open_calendar, resize_orb])
        .setup(|app| {
            app.global_shortcut().register(orb_shortcut())?;
            #[cfg(target_os = "macos")]
            {
                make_orb_a_panel(app)?;
                put_orb_away_on_desktop_switch(app);
            }

            let orb = MenuItem::with_id(app, "orb", "Show Donna", true, Some("Alt+D"))?;
            let open = MenuItem::with_id(app, "open", "Open calendar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&orb, &separator, &open, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("bundle icon").clone())
                .tooltip("Donna")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "orb" => toggle_orb(app),
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        toggle_orb(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // Closing the main window keeps Donna running in the tray so nudges still arrive.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Donna");
}

#[cfg(test)]
mod tests {
    use super::check_feed_url;

    #[test]
    fn accepts_a_real_feed_address() {
        let url = "https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-1a2b/basic.ics";
        assert_eq!(check_feed_url(url), Ok(url.to_string()));
        assert_eq!(check_feed_url("  https://example.com/a.ics  "), Ok("https://example.com/a.ics".to_string()));
        // Calendar apps hand out webcal:// links for the same feed.
        assert_eq!(check_feed_url("webcal://example.com/a.ics"), Ok("https://example.com/a.ics".to_string()));
    }

    #[test]
    fn refuses_anything_but_https() {
        for bad in ["http://example.com/a.ics", "file:///etc/passwd", "example.com/a.ics", ""] {
            assert!(check_feed_url(bad).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn refuses_userinfo_that_disguises_the_host() {
        // Reads as Google, fetches 10.0.0.1.
        assert!(check_feed_url("https://calendar.google.com@10.0.0.1/a.ics").is_err());
        assert!(check_feed_url("https://user:pw@example.com/a.ics").is_err());
        // A percent-encoded @ inside the path is a normal Google feed, not userinfo.
        assert!(check_feed_url("https://example.com/ical/x%40group/basic.ics").is_ok());
    }

    #[test]
    fn refuses_characters_that_could_break_out_of_the_config_line() {
        for bad in [
            "https://example.com/\"\nurl = \"https://evil.test/x",
            "https://example.com/a\\b.ics",
            "https://example.com/a b.ics",
            "https://example.com/a\nb.ics",
        ] {
            assert!(check_feed_url(bad).is_err(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn refuses_a_missing_host() {
        assert!(check_feed_url("https:///a.ics").is_err());
        assert!(check_feed_url("https://").is_err());
    }
}
