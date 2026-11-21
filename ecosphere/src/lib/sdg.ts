export type SdgInput = {
  recyclingRate: number; activeUsers: number; totalUsers: number;
  reuseTrades: number; ewasteKg: number; eventsHeld: number;
};

const pct = (v: number, goal: number) => Math.max(0, Math.min(100, Math.round((v / goal) * 100)));

// Local proxies for SDG 12 targets; goals are school/community-scale, not national statistics.
export function sdgIndicators(i: SdgInput) {
  const items = [
    { target: "12.4", title: "Manage hazardous e-waste safely", detail: `${i.ewasteKg} kg of e-waste dropped off (goal 50 kg)`, progress: pct(i.ewasteKg, 50) },
    { target: "12.5", title: "Reduce, reuse & recycle", detail: `${i.recyclingRate}% recycling rate · ${i.reuseTrades} items reused via marketplace`, progress: Math.round((i.recyclingRate + pct(i.reuseTrades, 50)) / 2) },
    { target: "12.8", title: "Awareness for sustainable lifestyles", detail: `${i.activeUsers}/${i.totalUsers} people active this month · ${i.eventsHeld} events`, progress: Math.round((pct(i.activeUsers, Math.max(1, i.totalUsers)) + pct(i.eventsHeld, 10)) / 2) },
  ];
  return { items, overall: Math.round(items.reduce((s, x) => s + x.progress, 0) / items.length) };
}
