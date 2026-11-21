import { parseYmd, ymd, addDays } from "./time.js";

// Only fresh deadlines block. Anything older is backlog, not an emergency: one forgotten
// item from last week must not refuse every booking until it is hunted down.
const OVERDUE_GRACE_DAYS = 1;

// Anything unfinished due on `onDate`, or overdue since the day before, soonest first.
export function pendingDeadlines(items, onDate) {
  const cutoff = parseYmd(onDate);
  cutoff.setHours(23, 59, 59, 999);
  const oldest = parseYmd(addDays(onDate, -OVERDUE_GRACE_DAYS));

  return items
    .filter((item) => item.status === "active")
    .filter((item) => new Date(item.deadline) >= oldest && new Date(item.deadline) <= cutoff)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

// Donna argues before she books: if something is already due, a new session needs an
// explicit yes. The guard is here rather than only in the prompt so a model having an
// off day still cannot quietly book over a deadline.
export function requiresConfirmation(items, onDate) {
  return pendingDeadlines(items, onDate).length > 0;
}

export function objection(items, onDate) {
  const [soonest, ...rest] = pendingDeadlines(items, onDate);
  if (!soonest) return null;

  const when = ymd(new Date(soonest.deadline)) === onDate ? "due today" : "already overdue";
  const also = rest.length ? ` (and ${rest.length} more)` : "";
  return `${soonest.title} is ${when}${also}. still want this booked?`;
}
