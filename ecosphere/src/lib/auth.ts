import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export async function currentUser() {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, include: { school: true } });
  return user?.active ? user : null;
}

export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/home");
  return user;
}

export const audit = (actorId: string | null, action: string, detail = "") =>
  db.auditLog.create({ data: { actorId, action, detail } });
