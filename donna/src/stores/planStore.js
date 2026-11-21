import { today, nowMin, toMin, fromMin, addDays } from "../lib/time";
import { findClash, freeSlots, DAY_START, DAY_END } from "../lib/schedule";
import { rollOverMissed } from "../lib/backlog";
import { topUpGoals } from "../lib/topup";
import { blockStartMs } from "../lib/reminders";

// New data, so a new key: `nudge_items` still holds the dumped thoughts.
const STORAGE_KEY = "donna_plan";
const EMPTY = { blocks: [], fixed: [], reminders: [], memories: [], findings: [], sweptOn: null, askedOn: null, researchedOn: null };

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

  // A two-minute job, not a calendar block: it takes no room in the week.
  remind(text, at) {
    const reminder = { id: crypto.randomUUID(), text, at, done: false };
    commit({ ...plan, reminders: [...plan.reminders, reminder] });
    return reminder;
  },

  completeReminder(id) {
    commit({ ...plan, reminders: plan.reminders.map((r) => (r.id === id ? { ...r, done: true } : r)) });
  },

  // What last night's search turned up. Kept so the same programme found again next week
  // is not announced as news, and so the morning brief has something to read out.
  recordFindings(date, findings) {
    commit({ ...plan, findings: [...plan.findings, ...findings], researchedOn: date });
  },

  // Books the time and marks the finding dealt with in one go: two commits would leave a
  // window where the session exists and she offers to book it again.
  blockForFinding(findingId, { title, date, start, minutes }) {
    const hit = findClash(plan, date, toMin(start), minutes);
    if (hit) throw new Error(`clashes with ${hit.title} at ${fromMin(hit.s)}`);
    const block = { id: crypto.randomUUID(), itemId: null, title, date, start, minutes, done: false };
    commit({
      ...plan,
      blocks: [...plan.blocks, block],
      findings: plan.findings.map((f) => (f.id === findingId ? { ...f, handled: true } : f)),
    });
    return block;
  },

  // Not now, and not again: she has made the offer and you have answered it.
  dismissFinding(findingId) {
    commit({ ...plan, findings: plan.findings.map((f) => (f.id === findingId ? { ...f, handled: true } : f)) });
  },

  // What she knows about you. Donna's defining trait, and the one the port dropped.
  remember(text) {
    const memory = { id: crypto.randomUUID(), text, at: Date.now() };
    commit({ ...plan, memories: [...plan.memories, memory] });
    return { id: memory.id };
  },

  forget(id) {
    commit({ ...plan, memories: plan.memories.filter((m) => m.id !== id) });
    return "ok";
  },

  // Remembers that the evening question has been put today, so it is asked once.
  markAsked(date) {
    commit({ ...plan, askedOn: date });
  },

  undo(id) {
    commit({ ...plan, blocks: plan.blocks.map((b) => (b.id === id ? { ...b, done: false } : b)) });
  },

  complete(id) {
    commit({ ...plan, blocks: plan.blocks.map((b) => (b.id === id ? { ...b, done: true } : b)) });
  },

  remove(id) {
    commit({ ...plan, blocks: plan.blocks.filter((b) => b.id !== id) });
  },

  // Same clash rule as booking, ignoring the session's own old slot.
  move(id, date, start) {
    const block = plan.blocks.find((b) => b.id === id);
    if (!block) throw new Error(`no session with id ${id}`);
    const hit = findClash(plan, date, toMin(start), block.minutes, id);
    if (hit) throw new Error(`clashes with ${hit.title} at ${fromMin(hit.s)}`);
    const moved = { ...block, date, start };
    commit({ ...plan, blocks: plan.blocks.map((b) => (b.id === id ? moved : b)) });
    return moved;
  },

  // A dropped goal takes its sessions with it.
  removeForItem(itemId) {
    commit({ ...plan, blocks: plan.blocks.filter((b) => b.itemId !== itemId) });
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

  // Runs once a day: anything missed becomes tomorrow's first job, then every goal's
  // runway is topped back up to a fortnight so a long goal never quietly runs dry.
  sweep(items = []) {
    const day = today();
    if (plan.sweptOn === day) return { moved: [], booked: [] };
    const { state: swept, moved } = rollOverMissed(plan, day, nowMin());
    const { state, added } = topUpGoals(swept, items, day);
    commit({ ...state, sweptOn: day });
    return { moved, booked: added };
  },
};
