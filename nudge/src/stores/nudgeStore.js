import { parseBlurt, getNudgeSchedule } from "../lib/parser";
import { parseProfile } from "../lib/idiolect";
import profileText from "../lib/profile.md?raw";

const PROFILE = parseProfile(profileText);

const STORAGE_KEY = "nudge_items";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

let items = loadItems();
let listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn([...items]));
}

// The quick-capture window writes to the same storage; pick its changes up live.
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  items = loadItems();
  notify();
});

export const nudgeStore = {
  subscribe(fn) {
    listeners.add(fn);
    fn([...items]);
    return () => listeners.delete(fn);
  },

  getAll() {
    return [...items];
  },

  add(rawText) {
    const parsed = parseBlurt(rawText, Date.now(), PROFILE);
    const nudge = {
      id: crypto.randomUUID(),
      ...parsed,
      status: "active",
      nudges: getNudgeSchedule(parsed.createdAt, parsed.deadline),
      completedAt: null,
    };
    items = [nudge, ...items];
    saveItems(items);
    notify();
    return nudge;
  },

  complete(id) {
    items = items.map((item) =>
      item.id === id ? { ...item, status: "done", completedAt: new Date().toISOString() } : item,
    );
    saveItems(items);
    notify();
  },

  skip(id) {
    items = items.map((item) => (item.id === id ? { ...item, status: "skipped" } : item));
    saveItems(items);
    notify();
  },

  extend(id, extraDays = 7) {
    items = items.map((item) => {
      if (item.id !== id) return item;
      const newDeadline = new Date(new Date(item.deadline).getTime() + extraDays * 86_400_000);
      return {
        ...item,
        deadline: newDeadline.toISOString(),
        nudges: getNudgeSchedule(item.createdAt, newDeadline.toISOString()),
      };
    });
    saveItems(items);
    notify();
  },

  remove(id) {
    items = items.filter((item) => item.id !== id);
    saveItems(items);
    notify();
  },

  getByStatus(status) {
    return items.filter((item) => item.status === status);
  },

  // Same 7 calendar-day window the week planner shows (today + 6), plus overdue.
  getWeekItems() {
    const weekEnd = new Date();
    weekEnd.setHours(0, 0, 0, 0);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return items.filter((item) => item.status === "active" && new Date(item.deadline) < weekEnd);
  },
};
