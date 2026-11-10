// Check-ins that came due in (since, now], newest one per item only,
// so waking a laptop after days doesn't fire a burst of stale nudges.
export function dueNudges(items, since, now) {
  const due = [];
  for (const item of items) {
    if (item.status !== "active") continue;
    const passed = item.nudges.filter((n) => {
      const at = new Date(n.at).getTime();
      return at > since && at <= now;
    });
    if (passed.length) due.push({ item, nudge: passed[passed.length - 1] });
  }
  return due;
}
