export type BadgeStats = { scans: number; points: number; types: number; purchases: number; challenges: number };

export const BADGES = [
  { id: "first", name: "First Scan", emoji: "🌱", test: (s: BadgeStats) => s.scans >= 1 },
  { id: "ten", name: "Sorting Pro", emoji: "♻️", test: (s: BadgeStats) => s.scans >= 10 },
  { id: "hundred", name: "Point Collector", emoji: "⭐", test: (s: BadgeStats) => s.points >= 100 },
  { id: "champ", name: "Green Champion", emoji: "🏆", test: (s: BadgeStats) => s.points >= 500 },
  { id: "variety", name: "All-Rounder", emoji: "🌍", test: (s: BadgeStats) => s.types >= 4 },
  { id: "circular", name: "Circular Hero", emoji: "🔄", test: (s: BadgeStats) => s.purchases >= 1 },
  { id: "challenger", name: "Challenger", emoji: "🎯", test: (s: BadgeStats) => s.challenges >= 1 },
] as const;

export const earnedBadges = (s: BadgeStats) => BADGES.filter((b) => b.test(s));

export const MONTHLY_GOAL_KG = 20;
export const goalPercent = (kg: number) => Math.min(100, Math.round((kg / MONTHLY_GOAL_KG) * 100));
