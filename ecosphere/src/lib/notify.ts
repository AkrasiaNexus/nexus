import "server-only";
import type { NoticeKind } from "@prisma/client";
import { db } from "./db";

// Notify everyone at a school (optionally one class), plus parents of the students in it.
export async function notifySchool(schoolId: string, n: { kind: NoticeKind; title: string; body: string }, className?: string) {
  const members = await db.user.findMany({
    where: { schoolId, active: true, ...(className && { OR: [{ grade: className }, { role: "SCHOOL_ADMIN" }] }) },
    select: { id: true, parentId: true },
  });
  const ids = new Set(members.flatMap((m) => (m.parentId ? [m.id, m.parentId] : [m.id])));
  await db.notification.createMany({ data: Array.from(ids, (userId) => ({ userId, ...n })) });
}
