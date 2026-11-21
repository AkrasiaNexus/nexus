import { addDays, ymd } from "./time.js";
import { freeSlots, MAX_GOAL_DAYS } from "./schedule.js";

// A goal is something with a daily commitment. A thought you dumped without answering
// "how long a day?" has no minutesPerDay, and is not something to book time for.
const isGoal = (item) => item.status === "active" && Number(item.minutesPerDay) > 0;

// Goals are booked a fortnight ahead, never further — a six-month goal must not carpet
// every free evening you have, and your week will have changed long before then. But the
// window drains as days pass, so without this a long goal quietly runs out of time booked
// and goes silent with months still on the clock. Run once a day, it tops the runway back up.
export function topUpGoals(state, items, fromDate = ymd(new Date())) {
  let next = state;
  const added = [];

  for (const goal of items.filter(isGoal)) {
    const due = ymd(new Date(goal.deadline));
    if (!due || due < fromDate) continue;

    const minutes = Math.round(goal.minutesPerDay);
    const booked = new Set(next.blocks.filter((b) => b.itemId === goal.id && !b.done).map((b) => b.date));

    for (let i = 0; i < MAX_GOAL_DAYS; i++) {
      const date = addDays(fromDate, i);
      if (date > due) break;
      if (booked.has(date)) continue;

      const slot = freeSlots(next, date, minutes, undefined, undefined, false)[0];
      if (!slot) continue;

      const block = { id: crypto.randomUUID(), itemId: goal.id, title: goal.title, date, start: slot.start, minutes, done: false };
      added.push(block);
      next = { ...next, blocks: [...next.blocks, block] };
    }
  }

  return { state: next, added };
}
