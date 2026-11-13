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
