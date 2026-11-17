"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, requireUser, verifyPassword } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifySchool } from "@/lib/notify";
import { healthAlerts } from "@/lib/health";
import { eventSchema, healthSchema, listingSchema, taskSchema } from "@/lib/validation";
import type { FormState } from "./actions";

const formObject = (fd: FormData) =>
  Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));

export async function createListing(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = listingSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { error } = await admin().from("listings").insert({
    ...d, pricePoints: d.kind === "SELL" ? d.pricePoints : 0, category: d.kind === "DONATE" ? "Donate" : d.category, stock: 1, ownerId: user.id,
  });
  if (error) return { error: "Could not publish the listing." };
  await audit(user.id, "LISTING_CREATED", d.title);
  revalidatePath("/marketplace");
  redirect("/marketplace");
}

export async function closeListing(listingId: string) {
  const user = await requireUser();
  await admin().from("listings").update({ active: false }).eq("id", String(listingId)).eq("ownerId", user.id);
  revalidatePath("/marketplace");
}

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  const teacher = await requireUser(["TEACHER"]);
  const parsed = taskSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!teacher.schoolId || !teacher.grade) return { error: "Your account has no class assigned." };
  const { data: task, error } = await admin().from("tasks")
    .insert({ ...parsed.data, dueAt: parsed.data.dueAt.toISOString(), className: teacher.grade, schoolId: teacher.schoolId, creatorId: teacher.id })
    .select().single();
  if (error) return { error: "Could not create the task." };
  await notifySchool(teacher.schoolId, { kind: "TASK", title: `New task: ${task.title}`, body: `Due ${new Date(task.dueAt).toLocaleDateString()} · +${task.points} pts` }, teacher.grade);
  revalidatePath("/teacher");
  return { ok: "Task assigned to your class." };
}

export async function markTaskDone(taskId: string) {
  const student = await requireUser(["STUDENT"]);
  // Row-level security only returns tasks for the student's own class.
  const { data: task } = await createClient().from("tasks").select("id, schoolId, className").eq("id", String(taskId)).maybeSingle();
  if (!task || task.schoolId !== student.schoolId || task.className !== student.grade) return;
  await admin().from("task_dones").upsert({ taskId: task.id, userId: student.id }, { ignoreDuplicates: true });
  revalidatePath("/tasks");
}

export async function approveTask(taskId: string, studentId: string) {
  await requireUser(["TEACHER"]);
  await createClient().rpc("approve_task", { p_task: String(taskId), p_student: String(studentId) });
  revalidatePath("/teacher");
}

export async function submitHealthReport(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(["HEALTH_MONITOR", "TEACHER", "SCHOOL_ADMIN"]);
  const parsed = healthSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!user.schoolId) return { error: "Your account has no school." };
  const d = parsed.data;
  if (user.role !== "SCHOOL_ADMIN" && d.className !== user.grade) return { error: "You can only report on your own class." };
  const { error } = await admin().from("health_reports").insert({ ...d, schoolId: user.schoolId, reporterId: user.id });
  if (error) return { error: "Could not save the report." };
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
  const { data: ev, error } = await admin().from("events")
    .insert({ ...parsed.data, startsAt: parsed.data.startsAt.toISOString(), organizerId: user.id, schoolId: schoolScoped ? user.schoolId : null })
    .select().single();
  if (error) return { error: "Could not publish the event." };
  const body = `${new Date(ev.startsAt).toLocaleString()} · ${ev.location}`;
  if (schoolScoped && user.schoolId) await notifySchool(user.schoolId, { kind: "EVENT", title: ev.title, body });
  else await admin().from("notifications").insert({ kind: "EVENT", title: ev.title, body });
  revalidatePath("/events");
  return { ok: "Event published!" };
}

export async function toggleRsvp(eventId: string) {
  const user = await requireUser();
  const sb = createClient();
  const { data: existing } = await sb.from("event_rsvps").select("eventId").eq("eventId", String(eventId)).eq("userId", user.id).maybeSingle();
  if (existing) await sb.from("event_rsvps").delete().eq("eventId", String(eventId)).eq("userId", user.id);
  else if ((await sb.from("events").select("id").eq("id", String(eventId)).gte("startsAt", new Date().toISOString()).maybeSingle()).data)
    await sb.from("event_rsvps").insert({ eventId: String(eventId), userId: user.id });
  revalidatePath("/events");
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return { error: "Super Admin accounts can't self-delete." };
  if (!(await verifyPassword(user.email, String(fd.get("password") ?? "")))) return { error: "Wrong password." };
  const db = admin();
  await audit(null, "ACCOUNT_DELETED", user.memberId);
  await db.from("listings").update({ active: false }).eq("ownerId", user.id);
  await createClient().auth.signOut();
  await db.auth.admin.deleteUser(user.id); // profile and personal rows cascade
  redirect("/");
}
