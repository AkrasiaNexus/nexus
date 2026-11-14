import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { impact } from "./waste";
import { earnedBadges } from "./rewards";

// Which scans a user may see, by role.
export function scanScope(user: Pick<User, "id" | "role" | "schoolId" | "grade">): Prisma.ScanWhereInput {
  switch (user.role) {
    case "PARENT": return { user: { parentId: user.id } };
    case "SCHOOL_ADMIN": return { user: { schoolId: user.schoolId ?? "__none__" } };
    case "TEACHER":
    case "HEALTH_MONITOR": return { user: { schoolId: user.schoolId ?? "__none__", grade: user.grade ?? "__none__", role: "STUDENT" } };
    case "SUPER_ADMIN": return {};
    default: return { userId: user.id };
  }
}

export const startOf = (period: "week" | "month" | "year") => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(1);
  if (period === "year") d.setMonth(0, 1);
  return d;
};

export async function impactFor(where: Prisma.ScanWhereInput, since?: Date, until?: Date) {
  const scans = await db.scan.findMany({
    where: { ...where, ...((since || until) && { createdAt: { ...(since && { gte: since }), ...(until && { lt: until }) } }) },
    select: { wasteType: true, weightKg: true, createdAt: true },
  });
  return { scans, ...impact(scans) };
}

const DAY = 86_400_000;
export function dailySeries(scans: { weightKg: number; createdAt: Date }[], days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const start = new Date(today.getTime() - (days - 1 - i) * DAY);
    const end = start.getTime() + DAY;
    const value = scans.filter((s) => s.createdAt >= start && s.createdAt.getTime() < end).reduce((t, s) => t + s.weightKg, 0);
    return { label: start.toLocaleDateString("en", { weekday: "short" }).slice(0, 3), value: Math.round(value * 10) / 10 };
  });
}

export function visibleNotifications(userId: string, take = 30) {
  return db.notification.findMany({ where: { OR: [{ userId }, { userId: null }] }, orderBy: { createdAt: "desc" }, take });
}

// Same visibility as scanScope, expressed over users (for exports, etc.).
export function peopleScope(user: Pick<User, "id" | "role" | "schoolId" | "grade">): Prisma.UserWhereInput {
  const s = scanScope(user);
  return s.userId ? { id: user.id } : ((s.user as Prisma.UserWhereInput) ?? {});
}

export async function syncBadges(userId: string) {
  const [user, scans, types, purchases, challenges, have] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { points: true } }),
    db.scan.count({ where: { userId } }),
    db.scan.groupBy({ by: ["wasteType"], where: { userId } }),
    db.purchase.count({ where: { userId } }),
    db.challengeJoin.count({ where: { userId, completed: true } }),
    db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
  ]);
  const owned = new Set(have.map((b) => b.badgeId));
  const fresh = earnedBadges({ scans, points: user?.points ?? 0, types: types.length, purchases, challenges }).filter((b) => !owned.has(b.id));
  if (fresh.length) await db.userBadge.createMany({ data: fresh.map((b) => ({ userId, badgeId: b.id })), skipDuplicates: true });
  return new Set([...Array.from(owned), ...fresh.map((b) => b.id)]);
}
