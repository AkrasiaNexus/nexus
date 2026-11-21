import { toMin, fromMin } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";
import { pendingDeadlines } from "./pushback.js";

// Which goals have time booked ahead of them. A session already ticked off is spent, so
// it no longer counts as cover.
const coveredIds = (blocks) => new Set(blocks.filter((b) => !b.done && b.itemId).map((b) => b.itemId));

// Shorter than this isn't a window you'd put anything in.
const USABLE_MINUTES = 30;

const span = (slot) => toMin(slot.end) - toMin(slot.start);

const hours = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const list = (parts) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

// Everything the daily brief needs is already known: free gaps, deadlines, booked sessions.
// Computing it keeps the answer instant and correct, instead of asking a 12B to read a list.
export function dailyBrief({ items, plan, date, nowMinutes }) {
  const after = Math.max(DAY_START, nowMinutes);
  const free = freeSlots(plan, date, USABLE_MINUTES, after, DAY_END, false)
    .map(({ start, end }) => ({ start, end, minutes: span({ start, end }) }));
  const freeMinutes = free.reduce((total, slot) => total + slot.minutes, 0);

  const covered = coveredIds(plan.blocks);
  const due = pendingDeadlines(items, date).map(({ id, title }) => ({ id, title, booked: covered.has(id) }));

  // A session inherits how much its goal matters. A one-off has no goal, so no opinion.
  const priorityOf = (block) => {
    if (!block.itemId) return null;
    const goal = items.find((i) => i.id === block.itemId);
    return goal ? (goal.priority ?? "medium") : null;
  };
  const next = plan.blocks
    .filter((b) => b.date === date && !b.done && toMin(b.start) + b.minutes > nowMinutes)
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((b) => ({ ...b, priority: priorityOf(b) }));

  return { free, freeMinutes, due, next, text: say({ free, freeMinutes, due, next }) };
}

function say({ free, freeMinutes, due, next }) {
  if (!free.length && !next.length) return "day's gone. nothing left to squeeze in.";

  const lines = [];

  if (free.length) {
    lines.push(`${hours(freeMinutes)} free — ${list(free.map((f) => `${f.start}–${f.end}`))}.`);
  } else {
    lines.push(`nothing free left today, you're booked till ${fromMin(Math.max(...next.map((b) => toMin(b.start) + b.minutes)))}.`);
  }

  const unbooked = due.filter((d) => !d.booked);
  if (due.length) {
    lines.push(
      unbooked.length
        ? `due today: ${list(due.map((d) => d.title))}. ${list(unbooked.map((d) => d.title))} ${unbooked.length > 1 ? "have" : "has"} no time booked — that's the one that'll bite.`
        : `due today: ${list(due.map((d) => d.title))}, all booked in. you're fine.`,
    );
  }

  if (next.length) {
    const soonest = next[0];
    const matters = next.some((b) => b.priority === "high");
    // Knowing what is booked is half the answer; knowing whether it can slide is the rest.
    if (soonest.priority === "high") lines.push(`next up ${soonest.start}, ${soonest.title} — that's the one that matters today.`);
    else if (soonest.priority === "low") lines.push(`next up ${soonest.start}, ${soonest.title}. low priority though, walk away from it if something better turns up.`);
    else lines.push(`next up ${soonest.start}, ${soonest.title}.`);

    if (!matters && !due.length && next.every((b) => b.priority === "low")) {
      lines.push("nothing today is urgent. go have fun if you want.");
    }
  } else if (free.length && !due.length) {
    lines.push("nothing booked. dump something and i'll slot it.");
  }

  return lines.join(" ");
}

// Things you told Donna about that have no time booked against them. Without this they
// exist only in storage: the calendar draws sessions, so an item nobody scheduled is
// invisible until a deadline check-in fires days later.
export function unplanned(items, blocks) {
  const covered = coveredIds(blocks);

  return items
    .filter((item) => item.status === "active" && !covered.has(item.id))
    .sort((a, b) => (new Date(a.deadline) || 0) - (new Date(b.deadline) || 0));
}
