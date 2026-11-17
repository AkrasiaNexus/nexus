const DAY = 86_400_000;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// kg per (week, weekday) for the last `weeks` weeks; row 0 = oldest week, cols Mon..Sun.
export function heatmapGrid(items: { weightKg: number; createdAt: Date }[], weeks = 4, now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = monday.getTime() - (weeks - 1) * 7 * DAY;
  const grid = Array.from({ length: weeks }, () => Array(7).fill(0) as number[]);
  for (const it of items) {
    const d = Math.floor((it.createdAt.getTime() - start) / DAY);
    if (d >= 0 && d < weeks * 7) grid[Math.floor(d / 7)][d % 7] += it.weightKg;
  }
  return grid.map((row) => row.map((v) => Math.round(v * 10) / 10));
}

export type Period = "day" | "week" | "month" | "year";
export const PERIOD_GOAL_KG: Record<Period, number> = { day: 1, week: 5, month: 20, year: 240 };

// Calendar range for a period, shifted by `offset` periods (0 = current, -1 = previous...).
export function periodRange(period: Period, offset = 0, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "year") return { start: new Date(y + offset, 0, 1), end: new Date(y + offset + 1, 0, 1) };
  if (period === "month") return { start: new Date(y, m + offset, 1), end: new Date(y, m + offset + 1, 1) };
  if (period === "day") return { start: new Date(y, m, now.getDate() + offset), end: new Date(y, m, now.getDate() + offset + 1) };
  const monday = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return { start: monday, end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7) };
}

export function periodLabel(period: Period, offset: number, start: Date) {
  const names = { day: "Day", week: "Week", month: "Month", year: "Year" };
  if (period === "day") return offset === 0 ? "Today" : offset === -1 ? "Yesterday" : start.toLocaleDateString("en", { day: "numeric", month: "short" });
  if (offset === 0) return `This ${names[period]}`;
  if (offset === -1) return `Last ${names[period]}`;
  if (period === "year") return String(start.getFullYear());
  if (period === "month") return start.toLocaleDateString("en", { month: "long", year: "numeric" });
  return `Week of ${start.toLocaleDateString("en", { day: "numeric", month: "short" })}`;
}

// Chart points for a range: days for a week, weeks for a month, months for a year.
// Buckets that haven't started yet are flagged `future` so charts can stop the line at "now" instead of drawing fake zeros.
export function seriesFor(period: Period, start: Date, items: { weightKg: number; createdAt: Date }[], now = new Date()) {
  const y = start.getFullYear(), m = start.getMonth(), d = start.getDate();
  const days = new Date(y, m + 1, 0).getDate();
  const buckets: [string, Date, Date][] =
    period === "day" ? Array.from({ length: 6 }, (_, i) => [`${i * 4}h`, new Date(y, m, d, i * 4), new Date(y, m, d, i * 4 + 4)])
    : period === "week" ? WEEKDAYS.map((label, i) => [label, new Date(y, m, d + i), new Date(y, m, d + i + 1)])
    : period === "year" ? Array.from({ length: 12 }, (_, i) => [new Date(y, i, 1).toLocaleDateString("en", { month: "narrow" }), new Date(y, i, 1), new Date(y, i + 1, 1)])
    : Array.from({ length: Math.ceil(days / 7) }, (_, i) => [`W${i + 1}`, new Date(y, m, 1 + i * 7), new Date(y, m, Math.min(days, 7 + i * 7) + 1)]);
  return buckets.map(([label, from, to]) => ({
    label,
    value: Math.round(items.filter((i) => i.createdAt >= from && i.createdAt < to).reduce((t, i) => t + i.weightKg, 0) * 10) / 10,
    future: from > now,
  }));
}

// Custom date range: daily points up to ~5 weeks, weekly up to ~6 months, monthly beyond.
export function seriesBetween(start: Date, end: Date, items: { weightKg: number; createdAt: Date }[]) {
  const days = Math.max(1, Math.round((+end - +start) / 86_400_000));
  const step = days <= 35 ? 1 : days <= 190 ? 7 : 30;
  const buckets = Math.min(60, Math.ceil(days / step));
  return Array.from({ length: buckets }, (_, i) => {
    const from = new Date(+start + i * step * 86_400_000);
    const to = new Date(Math.min(+end, +from + step * 86_400_000));
    const value = Math.round(items.filter((x) => x.createdAt >= from && x.createdAt < to).reduce((t, x) => t + x.weightKg, 0) * 10) / 10;
    return { label: from.toLocaleDateString("en", step === 30 ? { month: "short" } : { day: "numeric", month: "short" }), value };
  });
}

// Percentage change vs the previous period (null when there's nothing to compare with).
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
