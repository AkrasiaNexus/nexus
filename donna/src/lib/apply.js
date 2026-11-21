import { addDays } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";
import { dueSoonest } from "./research.js";

// Long enough to actually write an application rather than open the page and close it.
export const APPLY_MINUTES = 90;
const MOST = 2;

// A deadline you found but never put time against is just anxiety. These are other
// people's dates and they do not move, so she takes the soonest slot that fits rather
// than the latest one that would still technically work.
export function applyProposals({ plan, date, nowMinutes, minutes = APPLY_MINUTES }) {
  const open = dueSoonest((plan.findings ?? []).filter((f) => !f.handled && f.deadline), date);
  const taken = new Set();
  const out = [];

  for (const finding of open) {
    if (out.length >= MOST) break;

    for (let day = date; day <= finding.deadline; day = addDays(day, 1)) {
      const earliest = day === date ? Math.max(DAY_START, nowMinutes) : DAY_START;
      const slot = freeSlots(plan, day, minutes, earliest, DAY_END, false).find((s) => !taken.has(`${s.date} ${s.start}`));
      if (!slot) continue;

      taken.add(`${day} ${slot.start}`);
      out.push({ finding, title: `Apply: ${finding.title}`, slot: { date: day, start: slot.start, minutes } });
      break;
    }
  }

  return out;
}
