import { toMin, ymd, parseYmd } from "./time.js";
import { findClash } from "./schedule.js";

const DAY_MS = 86_400_000;

// What booking something here would cost: the session it lands on, the goal that session
// belongs to, and whether that goal can still absorb losing it.
//
// A goal is tight when the sessions it still needs leave no spare day to move one into —
// skipping one then means it doesn't get finished, which is the thing worth saying out
// loud before anything gets replaced.
export function displacementCost(plan, items, { date, start, minutes }, fromDate = ymd(new Date())) {
  const hit = findClash(plan, date, toMin(start), minutes);
  // Only a session Donna booked can be displaced. School and a calendar event are immovable,
  // so there is no cost to weigh — the caller refuses the slot outright instead.
  if (!hit || hit.kind !== "block") return null;

  const block = plan.blocks.find((b) => b.id === hit.id);
  if (!block) return null;

  const goal = items.find((i) => i.id === block.itemId && i.status === "active") ?? null;
  if (!goal) return { block, goal: null, sessionsLeft: 0, daysLeft: 0, tight: false, warning: `that's ${block.title.toLowerCase()} at ${block.start}. replace it?` };

  const sessionsLeft = plan.blocks.filter((b) => b.itemId === goal.id && !b.done).length;
  const daysLeft = Math.max(0, Math.ceil((parseYmd(ymd(new Date(goal.deadline))) - parseYmd(fromDate)) / DAY_MS));
  const tight = sessionsLeft > 0 && daysLeft <= sessionsLeft;

  const warning = tight
    ? `that's your ${goal.title.toLowerCase()} session. ${sessionsLeft} left and ${daysLeft} day${daysLeft === 1 ? "" : "s"} to do them in — drop one and it doesn't get finished. still?`
    : `that's your ${goal.title.toLowerCase()} session. ${sessionsLeft} left, ${daysLeft} days — there's room to move it. still?`;

  return { block, goal, sessionsLeft, daysLeft, tight, warning };
}
