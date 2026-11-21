const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function notify(title, body) {
  if (isTauri()) {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
    return;
  }
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") new Notification(title, { body });
}

export async function hideThisWindow() {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

// Wakes the orb without taking keyboard focus (see `announce` in main.rs).
export async function revealOrb() {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("announce").catch(() => {});
}

// The orb window is the orb: it follows its own content so the circle stays a circle.
export async function resizeOrb(width, height) {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("resize_orb", { width, height });
  } catch (cause) {
    // Never silent: if the window will not resize, the card renders clipped inside a
    // 72px window and the app looks broken with nothing explaining why.
    console.error("donna: the orb window refused to resize", cause);
  }
}
