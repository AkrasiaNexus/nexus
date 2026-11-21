import { parseBlurt, getNudgeSchedule, estimateEffort, detectCategory } from "../lib/parser";
import { parseProfile } from "../lib/idiolect";
import profileText from "../lib/profile.md?raw";
import { parseYmd } from "../lib/time";

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

function insert(parsed) {
  const item = {
    id: crypto.randomUUID(),
    ...parsed,
    status: "active",
    nudges: getNudgeSchedule(parsed.createdAt, parsed.deadline),
    completedAt: null,
  };
  items = [item, ...items];
  saveItems(items);
  notify();
  return item;
}

export const itemStore = {
  subscribe(fn) {
    listeners.add(fn);
    fn([...items]);
    return () => listeners.delete(fn);
  },

  getAll() {
    return [...items];
  },

  add(rawText) {
    return insert(parseBlurt(rawText, Date.now(), PROFILE));
  },

  // A goal Donna agreed with them: the deadline is the end of the `due` day, local time.
  addGoal({ title, due, minutes_per_day, priority = "medium", for_profile = false }) {
    // The model's title is already clean; re-parsing it would strip "tomorrow" or "in 2 weeks".
    const now = Date.now();
    const deadline = parseYmd(due);
    deadline.setHours(23, 59, 0, 0);
    const timeframeMs = deadline.getTime() - now;
    return insert({
      raw: title,
      title: title.trim().charAt(0).toUpperCase() + title.trim().slice(1),
      category: detectCategory(title),
      effort: estimateEffort(timeframeMs),
      deadline: deadline.toISOString(),
      timeframeMs,
      createdAt: new Date(now).toISOString(),
      minutesPerDay: minutes_per_day,
      priority,
      forProfile: Boolean(for_profile),
    });
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
