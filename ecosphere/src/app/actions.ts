"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { CLASS_ROLES, SCHOOL_ROLES, loginSchema, memberIdFor, scanSchema, signupSchema, MAX_LOGIN_FAILS, MAX_SCANS_PER_HOUR } from "@/lib/validation";
import { GUIDE } from "@/lib/waste";
import { notifySchool } from "@/lib/notify";
import { syncBadges } from "@/lib/queries";

export type FormState = { error?: string; ok?: string } | undefined;

const formObject = (fd: FormData) =>
  Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));

async function startSession(userId: string, role: string, remember = false) {
  cookies().set(SESSION_COOKIE, await signSession({ userId, role }, remember), cookieOptions(remember));
}

const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: "Enter your email or ID and password." };
  const { email, password } = parsed.data;

  const since = new Date(Date.now() - 15 * 60_000);
  const fails = await db.auditLog.count({ where: { action: "LOGIN_FAIL", detail: email, createdAt: { gte: since } } });
  if (fails >= MAX_LOGIN_FAILS) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await db.user.findFirst({ where: { OR: [{ email }, { memberId: email }] } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    await audit(null, "LOGIN_FAIL", email);
    return { error: "Wrong email/ID or password." };
  }
  // Admin accounts need the admin code as a second factor when ADMIN_LOGIN_CODE is configured.
  const adminCode = process.env.ADMIN_LOGIN_CODE;
  if (ADMIN_ROLES.includes(user.role) && adminCode && fd.get("adminCode") !== adminCode) {
    await audit(null, "LOGIN_FAIL", email);
    return { error: "Admin accounts need a valid Admin Code." };
  }
  await audit(user.id, "LOGIN");
  await startSession(user.id, user.role, fd.get("remember") === "on");
  redirect("/home");
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const closed = await db.setting.findUnique({ where: { key: "signupsOpen" } });
  if (closed?.value === "false") return { error: "New sign-ups are paused right now. Please try again later." };
  if (d.role === "SCHOOL_ADMIN" && (!process.env.ADMIN_SIGNUP_CODE || d.adminCode !== process.env.ADMIN_SIGNUP_CODE))
    return { error: "A valid admin code is required for School Administrators." };
  if (["TEACHER", "HEALTH_MONITOR"].includes(d.role) && (!process.env.STAFF_SIGNUP_CODE || d.adminCode !== process.env.STAFF_SIGNUP_CODE))
    return { error: "A valid staff code from your school is required." };
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "That email is already registered." };
  if (d.schoolId && !(await db.school.findUnique({ where: { id: d.schoolId } }))) return { error: "Unknown school." };

  const child = d.role === "PARENT" && d.childEmail
    ? await db.user.findFirst({ where: { email: d.childEmail, role: "STUDENT" } })
    : null;
  if (d.role === "PARENT" && d.childEmail && !child) return { error: "No student account found with that email." };

  const user = await db.user.create({
    data: {
      name: d.name, email: d.email, role: d.role, memberId: memberIdFor(d.role),
      passwordHash: await bcrypt.hash(d.password, 10),
      schoolId: SCHOOL_ROLES.includes(d.role) ? d.schoolId : null,
      grade: CLASS_ROLES.includes(d.role) ? d.grade : null,
      department: d.role === "EMPLOYEE" ? d.department : null,
      community: d.role === "COMMUNITY" ? d.community : null,
      avatar: { STUDENT: "🧑‍🎓", PARENT: "👪", EMPLOYEE: "🧑‍💼", TEACHER: "🧑‍🏫", HEALTH_MONITOR: "🩺", SCHOOL_ADMIN: "🏫", COMMUNITY: "🌍" }[d.role],
    },
  });
  if (child) await db.user.update({ where: { id: child.id }, data: { parentId: user.id } });
  await db.notification.create({
    data: { userId: user.id, kind: "ANNOUNCEMENT", title: "Welcome to EcoSphere AI!", body: `Your EcoSphere ID is ${user.memberId}. Scan your first item to earn 10 points.` },
  });
  await audit(user.id, "SIGNUP", d.role);
  await startSession(user.id, user.role);
  redirect("/home");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/");
}

export async function saveScan(input: unknown): Promise<FormState & { points?: number }> {
  const user = await requireUser();
  const parsed = scanSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid scan." };
  const recent = await db.scan.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_SCANS_PER_HOUR) return { error: "Scan limit reached for this hour. Take a break! 🌿" };

  const points = GUIDE[parsed.data.wasteType].points;
  await db.$transaction([
    db.scan.create({ data: { ...parsed.data, userId: user.id, points } }),
    db.user.update({ where: { id: user.id }, data: { points: { increment: points } } }),
  ]);
  await syncBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: "Saved", points };
}

export async function redeem(listingId: string): Promise<FormState> {
  const user = await requireUser();
  const listing = await db.listing.findUnique({ where: { id: String(listingId) } });
  if (!listing || !listing.active || listing.stock < 1) return { error: "No longer available." };
  if (listing.ownerId === user.id) return { error: "That's your own listing." };
  try {
    await db.$transaction(async (tx) => {
      // Conditional updates guard against double-spend under concurrent requests.
      const paid = await tx.user.updateMany({ where: { id: user.id, points: { gte: listing.pricePoints } }, data: { points: { decrement: listing.pricePoints } } });
      if (!paid.count) throw new Error("Not enough points.");
      const taken = await tx.listing.updateMany({ where: { id: listing.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (!taken.count) throw new Error("Out of stock.");
      await tx.purchase.create({ data: { userId: user.id, listingId: listing.id, points: listing.pricePoints } });
      if (listing.ownerId) {
        // Peer listing: seller earns the points, owner is told who claimed it.
        if (listing.pricePoints) await tx.user.update({ where: { id: listing.ownerId }, data: { points: { increment: listing.pricePoints } } });
        if (listing.stock === 1) await tx.listing.update({ where: { id: listing.id }, data: { active: false } });
        await tx.notification.create({ data: { userId: listing.ownerId, kind: "ANNOUNCEMENT", title: `${user.name} claimed "${listing.title}"`, body: `Arrange hand-over with ${user.name} (ID ${user.memberId}).` } });
      }
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  await audit(user.id, "REDEEM", listing.title);
  await syncBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: listing.ownerId ? "Claimed! The owner has been notified." : `Redeemed ${listing.title}!` };
}

export async function joinChallenge(challengeId: string) {
  const user = await requireUser();
  const challenge = await db.challenge.findUnique({ where: { id: String(challengeId) } });
  if (!challenge || challenge.endsAt < new Date()) return;
  await db.challengeJoin.upsert({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
    create: { userId: user.id, challengeId: challenge.id },
    update: {},
  });
  revalidatePath("/rewards");
}

export async function setAvatar(avatar: string) {
  const user = await requireUser();
  const allowed = ["🌱", "🧑‍🎓", "👩‍🎓", "🧑‍💼", "👪", "🌍", "🦊", "🐢", "🌻", "🏫"];
  if (!allowed.includes(avatar)) return;
  await db.user.update({ where: { id: user.id }, data: { avatar } });
  revalidatePath("/", "layout");
}

export async function toggleUserActive(userId: string) {
  const admin = await requireUser(["SUPER_ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(userId) } });
  if (!target || target.id === admin.id || target.role === "SUPER_ADMIN") return;
  await db.user.update({ where: { id: target.id }, data: { active: !target.active } });
  await audit(admin.id, target.active ? "USER_DISABLED" : "USER_ENABLED", target.email);
  revalidatePath("/admin/users");
}

export async function broadcast(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireUser(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const title = String(fd.get("title") ?? "").trim().slice(0, 80);
  const body = String(fd.get("body") ?? "").trim().slice(0, 280);
  const kind = String(fd.get("kind") ?? "ANNOUNCEMENT");
  if (!title || !body || !["ANNOUNCEMENT", "CHALLENGE", "PICKUP", "EVENT"].includes(kind)) return { error: "Fill in title and message." };

  if (admin.role === "SUPER_ADMIN") {
    await db.notification.create({ data: { title, body, kind: kind as "EVENT" } });
  } else {
    await notifySchool(admin.schoolId!, { title, body, kind: kind as "EVENT" });
  }
  await audit(admin.id, "BROADCAST", title);
  revalidatePath("/notifications");
  return { ok: "Sent!" };
}

export async function claimChallenge(challengeId: string) {
  const user = await requireUser();
  const join = await db.challengeJoin.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId: String(challengeId) } }, include: { challenge: true },
  });
  if (!join || join.completed) return;
  const done = await db.scan.aggregate({
    where: { userId: user.id, wasteType: join.challenge.wasteType, createdAt: { gte: join.joinedAt } }, _sum: { weightKg: true },
  });
  if ((done._sum.weightKg ?? 0) < join.challenge.targetKg) return;
  // Conditional update so a double-click can't award twice.
  const claimed = await db.challengeJoin.updateMany({ where: { userId: user.id, challengeId: join.challengeId, completed: false }, data: { completed: true, completedAt: new Date() } });
  if (claimed.count) await db.user.update({ where: { id: user.id }, data: { points: { increment: join.challenge.rewardPoints } } });
  await syncBadges(user.id);
  revalidatePath("/", "layout");
}

export async function linkChild(_: FormState, fd: FormData): Promise<FormState> {
  const parent = await requireUser(["PARENT"]);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const child = await db.user.findFirst({ where: { email, role: "STUDENT" } });
  if (!child) return { error: "No student found with that email." };
  if (child.parentId && child.parentId !== parent.id) return { error: "That student is already linked to another parent." };
  await db.user.update({ where: { id: child.id }, data: { parentId: parent.id } });
  await audit(parent.id, "LINK_CHILD", email);
  revalidatePath("/profile");
  return { ok: `Linked ${child.name}` };
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("email") ?? "").trim().slice(0, 120);
  const key = id.includes("@") ? id.toLowerCase() : id.toUpperCase();
  const generic = { ok: "If that account exists, your school admin or the EcoSphere team has been asked to reset it. They'll give you a temporary password." };
  if (key.length < 3) return { error: "Enter your email or ID." };
  const recent = await db.auditLog.count({ where: { action: "RESET_REQUEST", detail: key, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 3) return generic;
  await audit(null, "RESET_REQUEST", key);
  const user = await db.user.findFirst({ where: { OR: [{ email: key }, { memberId: key }] } });
  if (!user) return generic; // same answer either way: no account enumeration
  const admins = await db.user.findMany({
    where: { active: true, OR: [{ role: "SUPER_ADMIN" }, ...(user.schoolId ? [{ role: "SCHOOL_ADMIN" as const, schoolId: user.schoolId }] : [])] },
    select: { id: true },
  });
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, kind: "ANNOUNCEMENT" as const, title: "Password reset requested", body: `${user.name} (ID ${user.memberId}) asked for a password reset. Use Manage Users / Manage Staff.` })) });
  return generic;
}

export async function resetPassword(userId: string): Promise<FormState> {
  const admin = await requireUser(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(userId) }, include: { children: { select: { schoolId: true } } } });
  if (!target || target.role === "SUPER_ADMIN") return { error: "Not allowed." };
  // School admins may reset only people at their school (or parents of its students).
  const inSchool = target.schoolId === admin.schoolId || target.children.some((c) => c.schoolId === admin.schoolId);
  if (admin.role === "SCHOOL_ADMIN" && (!admin.schoolId || !inSchool || target.role === "SCHOOL_ADMIN")) return { error: "Not allowed." };
  const temp = randomBytes(6).toString("base64url");
  await db.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
  await audit(admin.id, "PASSWORD_RESET", target.memberId);
  return { ok: `Temporary password for ${target.name}: ${temp}  (share it privately; they should change it in Settings)` };
}

export async function updateSettings(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return { error: "Name must be 2–60 characters." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const data: { name: string; passwordHash?: string } = { name };
  if (next) {
    if (next.length < 8 || next.length > 200) return { error: "New password must be at least 8 characters." };
    if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is wrong." };
    data.passwordHash = await bcrypt.hash(next, 10);
  }
  await db.user.update({ where: { id: user.id }, data });
  await audit(user.id, next ? "PASSWORD_CHANGED" : "PROFILE_UPDATED");
  revalidatePath("/", "layout");
  return { ok: next ? "Saved. Password changed." : "Saved." };
}

export async function toggleStaffActive(userId: string) {
  const admin = await requireUser(["SCHOOL_ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(userId) } });
  if (!target || !admin.schoolId || target.schoolId !== admin.schoolId || !["TEACHER", "HEALTH_MONITOR"].includes(target.role)) return;
  await db.user.update({ where: { id: target.id }, data: { active: !target.active } });
  await audit(admin.id, target.active ? "USER_DISABLED" : "USER_ENABLED", target.memberId);
  revalidatePath("/school/staff");
}

export async function setSignupsOpen(open: boolean) {
  const admin = await requireUser(["SUPER_ADMIN"]);
  await db.setting.upsert({ where: { key: "signupsOpen" }, create: { key: "signupsOpen", value: String(open) }, update: { value: String(open) } });
  await audit(admin.id, "SETTING_CHANGED", `signupsOpen=${open}`);
  revalidatePath("/admin/system");
}
