"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { notifySchool } from "@/lib/notify";
import { healthAlerts } from "@/lib/health";
import { SESSION_COOKIE } from "@/lib/session";
import { eventSchema, healthSchema, listingSchema, taskSchema } from "@/lib/validation";
import type { FormState } from "./actions";

const formObject = (fd: FormData) =>
  Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));

export async function createListing(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = listingSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.listing.create({
    data: { ...d, pricePoints: d.kind === "SELL" ? d.pricePoints : 0, category: d.kind === "DONATE" ? "Donate" : d.category, stock: 1, ownerId: user.id },
  });
  await audit(user.id, "LISTING_CREATED", d.title);
  revalidatePath("/marketplace");
  redirect("/marketplace");
}

export async function closeListing(listingId: string) {
  const user = await requireUser();
  await db.listing.updateMany({ where: { id: String(listingId), ownerId: user.id }, data: { active: false } });
  revalidatePath("/marketplace");
}

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  const teacher = await requireUser(["TEACHER"]);
  const parsed = taskSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!teacher.schoolId || !teacher.grade) return { error: "Your account has no class assigned." };
  const task = await db.task.create({ data: { ...parsed.data, className: teacher.grade, schoolId: teacher.schoolId, creatorId: teacher.id } });
  await notifySchool(teacher.schoolId, { kind: "TASK", title: `New task: ${task.title}`, body: `Due ${task.dueAt.toLocaleDateString()} · +${task.points} pts` }, teacher.grade);
  revalidatePath("/teacher");
  return { ok: "Task assigned to your class." };
}

export async function markTaskDone(taskId: string) {
  const student = await requireUser(["STUDENT"]);
  const task = await db.task.findUnique({ where: { id: String(taskId) } });
  if (!task || task.schoolId !== student.schoolId || task.className !== student.grade) return;
  await db.taskDone.upsert({ where: { taskId_userId: { taskId: task.id, userId: student.id } }, create: { taskId: task.id, userId: student.id }, update: {} });
  revalidatePath("/tasks");
}

export async function approveTask(taskId: string, studentId: string) {
  const teacher = await requireUser(["TEACHER"]);
  const done = await db.taskDone.findUnique({ where: { taskId_userId: { taskId: String(taskId), userId: String(studentId) } }, include: { task: true } });
  if (!done || done.task.creatorId !== teacher.id) return;
  const ok = await db.taskDone.updateMany({ where: { taskId: done.taskId, userId: done.userId, approved: false }, data: { approved: true } });
  if (ok.count) {
    await db.user.update({ where: { id: done.userId }, data: { points: { increment: done.task.points } } });
    await db.notification.create({ data: { userId: done.userId, kind: "TASK", title: `Task approved: ${done.task.title}`, body: `+${done.task.points} green points` } });
  }
  revalidatePath("/teacher");
}

export async function submitHealthReport(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(["HEALTH_MONITOR", "TEACHER", "SCHOOL_ADMIN"]);
  const parsed = healthSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!user.schoolId) return { error: "Your account has no school." };
  const d = parsed.data;
  if (user.role !== "SCHOOL_ADMIN" && d.className !== user.grade) return { error: "You can only report on your own class." };
  await db.healthReport.create({ data: { ...d, schoolId: user.schoolId, reporterId: user.id } });
  const alerts = healthAlerts(d);
  if (alerts.length) await notifySchool(user.schoolId, { kind: "HEALTH", title: `Health & safety alert · ${d.className}`, body: alerts.join(" · ") }, d.className);
  await audit(user.id, "HEALTH_REPORT", `${d.className}${alerts.length ? ` (${alerts.length} alerts)` : ""}`);
  revalidatePath("/health");
  return { ok: alerts.length ? `Saved. ${alerts.length} alert(s) sent to class, parents and admin.` : "Saved. All clear ✅" };
}

export async function createEvent(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(["TEACHER", "SCHOOL_ADMIN", "COMMUNITY", "SUPER_ADMIN"]);
  const parsed = eventSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.startsAt < new Date()) return { error: "Pick a future date." };
  const schoolScoped = user.role === "TEACHER" || user.role === "SCHOOL_ADMIN";
  const ev = await db.event.create({ data: { ...parsed.data, organizerId: user.id, schoolId: schoolScoped ? user.schoolId : null } });
  const body = `${ev.startsAt.toLocaleString()} · ${ev.location}`;
  if (schoolScoped && user.schoolId) await notifySchool(user.schoolId, { kind: "EVENT", title: ev.title, body });
  else await db.notification.create({ data: { kind: "EVENT", title: ev.title, body } });
  revalidatePath("/events");
  return { ok: "Event published!" };
}

export async function toggleRsvp(eventId: string) {
  const user = await requireUser();
  const key = { eventId_userId: { eventId: String(eventId), userId: user.id } };
  const existing = await db.eventRsvp.findUnique({ where: key });
  if (existing) await db.eventRsvp.delete({ where: key });
  else if (await db.event.findFirst({ where: { id: String(eventId), startsAt: { gte: new Date() } } }))
    await db.eventRsvp.create({ data: { eventId: String(eventId), userId: user.id } });
  revalidatePath("/events");
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return { error: "Super Admin accounts can't self-delete." };
  if (!(await bcrypt.compare(String(fd.get("password") ?? ""), user.passwordHash))) return { error: "Wrong password." };
  await audit(null, "ACCOUNT_DELETED", user.memberId);
  await db.listing.updateMany({ where: { ownerId: user.id }, data: { active: false } });
  await db.user.delete({ where: { id: user.id } });
  cookies().delete(SESSION_COOKIE);
  redirect("/");
}
