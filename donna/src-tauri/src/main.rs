#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "macos")]
const PRIMARY: Modifiers = Modifiers::SUPER;
#[cfg(not(target_os = "macos"))]
const PRIMARY: Modifiers = Modifiers::CONTROL;

const EDGE_MARGIN: i32 = 16;

fn panel_shortcut() -> Shortcut {
    Shortcut::new(Some(PRIMARY | Modifiers::SHIFT), Code::KeyN)
}

// Pin the panel to the right edge of whichever screen it is on, vertically centred.
fn anchor_right(app: &AppHandle, window: &WebviewWindow) {
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
    let y = origin.y + (screen.height as i32 - size.height as i32) / 2;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

// `focus` is false when Donna speaks up on her own: a reminder must never swallow
// the keystrokes of whatever the user is typing in another app.
fn reveal_panel(app: &AppHandle, focus: bool) {
    if let Some(window) = app.get_webview_window("panel") {
        anchor_right(app, &window);
        let _ = window.show();
        if focus {
            let _ = window.set_focus();
        }
    }
}

fn toggle_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            reveal_panel(app, true);
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
    reveal_panel(&app, false);
}

#[tauri::command]
fn dismiss_panel(app: AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.hide();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if shortcut == &panel_shortcut() && event.state() == ShortcutState::Pressed {
                        toggle_panel(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![announce, dismiss_panel])
        .setup(|app| {
            app.global_shortcut().register(panel_shortcut())?;

            let panel = MenuItem::with_id(app, "panel", "Show panel", true, Some("CmdOrCtrl+Shift+N"))?;
            let open = MenuItem::with_id(app, "open", "Open Donna", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&panel, &separator, &open, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("bundle icon").clone())
                .tooltip("Donna")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "panel" => toggle_panel(app),
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        toggle_panel(tray.app_handle());
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
