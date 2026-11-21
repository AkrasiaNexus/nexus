import { today, nowMin, toMin, fromMin, addDays } from "../lib/time";
import { findClash, freeSlots, DAY_START, DAY_END } from "../lib/schedule";
import { rollOverMissed } from "../lib/backlog";
import { blockStartMs } from "../lib/reminders";

// New data, so a new key: `nudge_items` still holds the dumped thoughts.
const STORAGE_KEY = "donna_plan";
const EMPTY = { blocks: [], fixed: [], sweptOn: null };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

let plan = load();
const listeners = new Set();

function commit(next) {
  plan = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // storage blocked: the plan stays in memory for this session rather than being lost mid-edit
  }
  listeners.forEach((fn) => fn(plan));
}

// The panel and the main window share storage; pick up each other's changes live.
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  plan = load();
  listeners.forEach((fn) => fn(plan));
});

export const planStore = {
  subscribe(fn) {
    listeners.add(fn);
    fn(plan);
    return () => listeners.delete(fn);
  },

  getAll() {
    return plan;
  },

  // Books a session. Throws with the clashing thing's name so the caller can say why.
  schedule({ itemId = null, title, date, start, minutes }) {
    const hit = findClash(plan, date, toMin(start), minutes);
    if (hit) throw new Error(`clashes with ${hit.title} at ${fromMin(hit.s)}`);
    const block = { id: crypto.randomUUID(), itemId, title, date, start, minutes, done: false };
    commit({ ...plan, blocks: [...plan.blocks, block] });
    return block;
  },

  // First slot that fits, searching forward day by day.
  findSlot(minutes, fromDate = today(), days = 14) {
    for (let i = 0; i < days; i++) {
      const slot = freeSlots(plan, addDays(fromDate, i), minutes, DAY_START, DAY_END)[0];
      if (slot) return slot;
    }
    return null;
  },

  complete(id) {
    commit({ ...plan, blocks: plan.blocks.map((b) => (b.id === id ? { ...b, done: true } : b)) });
  },

  remove(id) {
    commit({ ...plan, blocks: plan.blocks.filter((b) => b.id !== id) });
  },

  setFixed(entry) {
    const fixed = { id: entry.id ?? crypto.randomUUID(), ...entry };
    commit({ ...plan, fixed: [...plan.fixed.filter((f) => f.id !== fixed.id), fixed] });
    return fixed;
  },

  removeFixed(id) {
    commit({ ...plan, fixed: plan.fixed.filter((f) => f.id !== id) });
  },

  // Sessions still to come, soonest first.
  upcoming(limit = 5) {
    const now = Date.now();
    return plan.blocks
      .filter((b) => !b.done && blockStartMs(b) + b.minutes * 60_000 > now)
      .sort((a, b) => blockStartMs(a) - blockStartMs(b))
      .slice(0, limit);
  },

  // Runs once a day: anything missed becomes tomorrow's first job.
  sweep() {
    const day = today();
    if (plan.sweptOn === day) return [];
    const { state, moved } = rollOverMissed(plan, day, nowMin());
    commit({ ...state, sweptOn: day });
    return moved;
  },
};
