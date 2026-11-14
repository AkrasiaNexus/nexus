export type BadgeStats = { scans: number; points: number; types: number; purchases: number; challenges: number };

export const BADGES = [
  { id: "first", name: "First Scan", emoji: "🍃", tone: "green", test: (s: BadgeStats) => s.scans >= 1 },
  { id: "ten", name: "Sorting Pro", emoji: "♻️", tone: "teal", test: (s: BadgeStats) => s.scans >= 10 },
  { id: "hundred", name: "Point Collector", emoji: "⭐", tone: "gold", test: (s: BadgeStats) => s.points >= 100 },
  { id: "champ", name: "Green Champion", emoji: "🏆", tone: "gold", test: (s: BadgeStats) => s.points >= 500 },
  { id: "variety", name: "All-Rounder", emoji: "🌍", tone: "teal", test: (s: BadgeStats) => s.types >= 4 },
  { id: "circular", name: "Circular Hero", emoji: "🔄", tone: "green", test: (s: BadgeStats) => s.purchases >= 1 },
  { id: "challenger", name: "Challenger", emoji: "🎯", tone: "orange", test: (s: BadgeStats) => s.challenges >= 1 },
] as const;

export const earnedBadges = (s: BadgeStats) => BADGES.filter((b) => b.test(s));

export const MONTHLY_GOAL_KG = 20;
export const goalPercent = (kg: number, goal = MONTHLY_GOAL_KG) => Math.min(100, Math.round((kg / goal) * 100));
