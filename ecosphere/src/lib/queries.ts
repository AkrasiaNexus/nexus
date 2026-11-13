import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { impact } from "./waste";

// Which scans a user may see, by role.
export function scanScope(user: Pick<User, "id" | "role" | "schoolId">): Prisma.ScanWhereInput {
  switch (user.role) {
    case "PARENT": return { user: { parentId: user.id } };
    case "SCHOOL_ADMIN": return { user: { schoolId: user.schoolId ?? "__none__" } };
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

export async function impactFor(where: Prisma.ScanWhereInput, since?: Date) {
  const scans = await db.scan.findMany({
    where: { ...where, ...(since && { createdAt: { gte: since } }) },
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
