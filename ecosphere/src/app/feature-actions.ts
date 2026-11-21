"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, requireUser, verifyPassword } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyCommunity, notifySchool } from "@/lib/notify";
import { healthAlerts } from "@/lib/health";
import { classChallengeSchema, eventSchema, healthSchema, listingSchema, noticeSchema, reportSchema, taskSchema } from "@/lib/validation";
import { IMAGE_TYPES, checkImage, stripMetadata } from "@/lib/upload";
import { randomUUID } from "crypto";
import type { FormState } from "./actions";

const LISTINGS_PER_HOUR = 5;

const formObject = (fd: FormData) =>
  Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));

export async function createListing(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = listingSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const db = admin();
  const { count: recent } = await db.from("listings").select("id", { count: "exact", head: true }).eq("ownerId", user.id).gte("createdAt", new Date(Date.now() - 3_600_000).toISOString());
  if ((recent ?? 0) >= LISTINGS_PER_HOUR) return { error: "You've posted a lot this hour. Try again later." };

  let imageUrl: string | null = null;
  let path: string | null = null;
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const check = checkImage(bytes, photo.type);
    if ("error" in check) return { error: check.error };
    const clean = stripMetadata(bytes, check.type); // public bucket: never publish EXIF/GPS
    if (!clean) return { error: "That photo looks damaged. Try another." };
    // Server-chosen path: the user's folder + random name, never the uploaded filename.
    path = `${user.id}/${randomUUID()}.${IMAGE_TYPES[check.type]}`;
    const { error: upErr } = await db.storage.from("listing-images").upload(path, clean, { contentType: check.type });
    if (upErr) return { error: "Could not upload the photo. Try again." };
    imageUrl = db.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  }

  const { data: setting } = await db.from("settings").select("value").eq("key", "marketplace.requireApproval").maybeSingle();
  const needsApproval = setting?.value !== "false"; // on by default
  const { error } = await db.from("listings").insert({
    ...d, imageUrl, pricePoints: d.kind === "SELL" ? d.pricePoints : 0, category: d.kind === "DONATE" ? "Donate" : d.category,
    stock: 1, ownerId: user.id, status: needsApproval ? "PENDING" : "APPROVED",
  });
  if (error) {
    if (path) await db.storage.from("listing-images").remove([path]);
    return { error: "Could not publish the listing." };
  }
  if (needsApproval) {
    const { data: admins } = await db.from("profiles").select("id").eq("role", "SUPER_ADMIN").eq("active", true);
    await db.from("notifications").insert((admins ?? []).map((a) => ({ userId: a.id, kind: "MARKETPLACE" as const, title: "Listing waiting for approval", body: `${user.name}: ${d.title}` })));
  }
  await audit(user.id, "LISTING_CREATED", d.title);
  revalidatePath("/marketplace");
  redirect(needsApproval ? "/marketplace/mine?msg=submitted" : "/marketplace/mine");
}

export async function reportListing(listingId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = admin();
  const { data: listing } = await createClient().from("listings").select("id, title").eq("id", String(listingId)).maybeSingle(); // RLS: must be visible to the reporter
  if (!listing) return { error: "Listing not found." };
  const { count } = await db.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporterId", user.id).eq("listingId", listing.id);
  if ((count ?? 0) > 0) return { ok: "You've already reported this listing. Thanks!" };
  await db.from("listing_reports").insert({ listingId: listing.id, reporterId: user.id, reason: parsed.data.reason });
  const { data: admins } = await db.from("profiles").select("id").eq("role", "SUPER_ADMIN").eq("active", true);
  await db.from("notifications").insert((admins ?? []).map((a) => ({ userId: a.id, kind: "MARKETPLACE" as const, title: "Listing reported", body: `${listing.title}: ${parsed.data.reason}` })));
  await audit(user.id, "LISTING_REPORTED", listing.title);
  return { ok: "Thanks, our moderators will review it." };
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
  await notifySchool(teacher.schoolId, { kind: "TASK", title: `New task: ${task.title}`, body: `Due ${new Date(task.dueAt).toLocaleDateString()} · +${task.points} EC` }, teacher.grade);
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
  const user = await requireUser(["TEACHER", "SCHOOL_ADMIN", "COMMUNITY", "COMMUNITY_ADMIN", "SUPER_ADMIN"]);
  const parsed = eventSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.startsAt < new Date()) return { error: "Pick a future date." };
  const schoolScoped = user.role === "TEACHER" || user.role === "SCHOOL_ADMIN";
  const communityScoped = user.role === "COMMUNITY_ADMIN" && !!user.communityId;
  const { data: ev, error } = await admin().from("events")
    .insert({ ...parsed.data, startsAt: parsed.data.startsAt.toISOString(), organizerId: user.id, schoolId: schoolScoped ? user.schoolId : null, communityId: communityScoped ? user.communityId : null })
    .select().single();
  if (error) return { error: "Could not publish the event." };
  const body = `${new Date(ev.startsAt).toLocaleString()} · ${ev.location}`;
  if (schoolScoped && user.schoolId) await notifySchool(user.schoolId, { kind: "EVENT", title: ev.title, body });
  else if (communityScoped) await notifyCommunity(user.communityId!, { kind: "EVENT", title: ev.title, body });
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

// Teacher: a challenge only their class sees (RLS: challenges visible via can_see_class).
export async function createClassChallenge(_: FormState, fd: FormData): Promise<FormState> {
  const teacher = await requireUser(["TEACHER"]);
  const parsed = classChallengeSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!teacher.schoolId || !teacher.grade) return { error: "Your account has no class assigned." };
  if (parsed.data.endsAt <= new Date()) return { error: "Pick an end date in the future." };
  const { error } = await admin().from("challenges").insert({
    ...parsed.data, endsAt: parsed.data.endsAt.toISOString(), schoolId: teacher.schoolId, className: teacher.grade, creatorId: teacher.id,
  });
  if (error) return { error: "Could not create the challenge." };
  await notifySchool(teacher.schoolId, { kind: "CHALLENGE", title: `New class challenge: ${parsed.data.title}`, body: `+${parsed.data.rewardPoints} EC · ends ${parsed.data.endsAt.toLocaleDateString()}` }, teacher.grade);
  await audit(teacher.id, "CHALLENGE_CREATED", parsed.data.title);
  revalidatePath("/rewards");
  return { ok: "Challenge published to your class." };
}

// Teacher: announcement to their class and its parents.
export async function announceToClass(_: FormState, fd: FormData): Promise<FormState> {
  const teacher = await requireUser(["TEACHER"]);
  const parsed = noticeSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: "Fill in title and message." };
  if (!teacher.schoolId || !teacher.grade) return { error: "Your account has no class assigned." };
  await notifySchool(teacher.schoolId, { kind: "ANNOUNCEMENT", ...parsed.data }, teacher.grade);
  await audit(teacher.id, "BROADCAST", parsed.data.title);
  return { ok: "Sent to your class and their parents." };
}
