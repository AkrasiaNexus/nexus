import { addDays, ymd, toMin } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";

const LOOK_AHEAD_DAYS = 5;
const MOST = 2;
const RANK = { high: 0, medium: 1, low: 2 };

// Profile work first, whatever its priority: a low-priority thing that gets you in beats a
// high-priority thing that doesn't. Then how much it matters, then how soon it is due.
function order(a, b) {
  if (!!a.forProfile !== !!b.forProfile) return a.forProfile ? -1 : 1;
  const byPriority = (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1);
  return byPriority || new Date(a.deadline) - new Date(b.deadline);
}

const daysUntil = (deadline, from) =>
  Math.round((new Date(ymd(new Date(deadline))) - new Date(from)) / 86_400_000);

function reasonFor(item, slot, from) {
  const left = daysUntil(item.deadline, from);
  const when = `${slot.minutes >= 120 ? `${Math.floor(slot.minutes / 60)}h` : `${slot.minutes}m`} clear ${slot.date === from ? "today" : "on " + slot.date}`;

  if (item.forProfile) return `${when}. ${item.title.toLowerCase()} is the one that gets you in — ${left}d left, or you're cooked.`;
  if (item.priority === "high") return `${when}. ${item.title.toLowerCase()} is the one that matters, ${left}d left.`;
  return `${when}. nothing booked for ${item.title.toLowerCase()} and ${left}d left.`;
}

// What Donna would raise before being asked: real empty time, and something of yours that
// has none of it. She proposes nothing she invented — only what you already told her about.
export function suggestions({ items, plan, date, nowMinutes, days = LOOK_AHEAD_DAYS }) {
  const candidates = items
    .filter((i) => i.status === "active" && Number(i.minutesPerDay) > 0 && ymd(new Date(i.deadline)) >= date)
    .sort(order);

  const taken = new Set();
  const out = [];

  for (const item of candidates) {
    if (out.length >= MOST) break;
    const minutes = Math.round(item.minutesPerDay);

    for (let i = 0; i < days; i++) {
      const on = addDays(date, i);
      const booked = plan.blocks.some((b) => b.date === on && b.itemId === item.id && !b.done);
      if (booked) continue;

      const earliest = on === date ? Math.max(DAY_START, nowMinutes) : DAY_START;
      const slot = freeSlots(plan, on, minutes, earliest, DAY_END, false).find((s) => !taken.has(`${s.date} ${s.start}`));
      if (!slot) continue;

      const proposal = { date: on, start: slot.start, minutes, end: slot.end };
      taken.add(`${on} ${slot.start}`);
      out.push({ item, slot: proposal, reason: reasonFor(item, { ...proposal, minutes: toMin(slot.end) - toMin(slot.start) }, date) });
      break;
    }
  }

  return out;
}
