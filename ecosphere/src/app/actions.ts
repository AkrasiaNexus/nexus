"use server";

import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, requireUser, verifyPassword } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { SESSION_ONLY_COOKIE, createClient } from "@/lib/supabase/server";
import { CLASS_ROLES, SCHOOL_ROLES, loginSchema, memberIdFor, scanSchema, signupSchema, MAX_LOGIN_FAILS } from "@/lib/validation";
import { notifySchool } from "@/lib/notify";
import { syncBadges } from "@/lib/queries";
import type { NoticeKind } from "@/lib/types";

export type FormState = { error?: string; ok?: string } | undefined;

const formObject = (fd: FormData) =>
  Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));

const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const BAN_FOREVER = "876000h";

// "Remember me" off → Supabase auth cookies are written as browser-session cookies.
function setRemember(remember: boolean) {
  if (remember) cookies().delete(SESSION_ONLY_COOKIE);
  else cookies().set(SESSION_ONLY_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

const siteUrl = () => {
  const h = headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
};

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: "Enter your email or ID and password." };
  const { email: id, password } = parsed.data;
  const db = admin();

  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count: fails } = await db.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "LOGIN_FAIL").eq("detail", id).gte("createdAt", since);
  if ((fails ?? 0) >= MAX_LOGIN_FAILS) return { error: "Too many attempts. Try again in 15 minutes." };

  // Member IDs (STU-123456) resolve to the account email server-side; the email never reaches the browser.
  const { data: profile } = await db.from("profiles").select("id, email, role, active").eq(id.includes("@") ? "email" : "memberId", id).maybeSingle();
  const fail = async (error = "Wrong email/ID or password.") => { await audit(null, "LOGIN_FAIL", id); return { error }; };
  if (!profile?.active) return fail();
  const adminCode = process.env.ADMIN_LOGIN_CODE;
  if (ADMIN_ROLES.includes(profile.role) && adminCode && fd.get("adminCode") !== adminCode) return fail("Admin accounts need a valid Admin Code.");

  setRemember(fd.get("remember") === "on");
  const { error } = await createClient().auth.signInWithPassword({ email: profile.email, password });
  if (error) return fail();
  await audit(profile.id, "LOGIN");
  redirect("/home");
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const db = admin();

  const { data: closed } = await db.from("settings").select("value").eq("key", "signupsOpen").maybeSingle();
  if (closed?.value === "false") return { error: "New sign-ups are paused right now. Please try again later." };
  if (d.role === "SCHOOL_ADMIN" && (!process.env.ADMIN_SIGNUP_CODE || d.adminCode !== process.env.ADMIN_SIGNUP_CODE))
    return { error: "A valid admin code is required for School Administrators." };
  if (["TEACHER", "HEALTH_MONITOR"].includes(d.role) && (!process.env.STAFF_SIGNUP_CODE || d.adminCode !== process.env.STAFF_SIGNUP_CODE))
    return { error: "A valid staff code from your school is required." };
  if (d.schoolId && !(await db.from("schools").select("id").eq("id", d.schoolId).maybeSingle()).data) return { error: "Unknown school." };

  const child = d.role === "PARENT" && d.childEmail
    ? (await db.from("profiles").select("id").eq("email", d.childEmail).eq("role", "STUDENT").maybeSingle()).data
    : null;
  if (d.role === "PARENT" && d.childEmail && !child) return { error: "No student account found with that email." };

  const { data: created, error } = await db.auth.admin.createUser({ email: d.email, password: d.password, email_confirm: true });
  if (error || !created.user) return { error: error?.message.includes("already") ? "That email is already registered." : "Could not create the account. Try again." };
  const memberId = memberIdFor(d.role);
  const { error: profileError } = await db.from("profiles").insert({
    id: created.user.id, email: d.email, name: d.name, role: d.role, memberId,
    schoolId: SCHOOL_ROLES.includes(d.role) ? d.schoolId : null,
    grade: CLASS_ROLES.includes(d.role) ? d.grade : null,
    department: d.role === "EMPLOYEE" ? d.department : null,
    community: d.role === "COMMUNITY" ? d.community : null,
    avatar: { STUDENT: "🧑‍🎓", PARENT: "👪", EMPLOYEE: "🧑‍💼", TEACHER: "🧑‍🏫", HEALTH_MONITOR: "🩺", SCHOOL_ADMIN: "🏫", COMMUNITY: "🌍" }[d.role],
  });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id); // never leave a login without a profile
    return { error: "Could not create the account. Try again." };
  }
  if (child) await db.from("profiles").update({ parentId: created.user.id }).eq("id", child.id);
  await db.from("notifications").insert({ userId: created.user.id, kind: "ANNOUNCEMENT", title: "Welcome to EcoSphere AI!", body: `Your EcoSphere ID is ${memberId}. Scan your first item to earn 10 points.` });
  await audit(created.user.id, "SIGNUP", d.role);
  setRemember(true);
  await createClient().auth.signInWithPassword({ email: d.email, password: d.password });
  redirect("/home");
}

export async function logout() {
  await createClient().auth.signOut();
  redirect("/");
}

export async function saveScan(input: unknown): Promise<FormState & { points?: number }> {
  const user = await requireUser();
  const parsed = scanSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid scan." };
  const { label, wasteType, confidence, weightKg } = parsed.data;
  const { data: points, error } = await createClient().rpc("log_scan", { p_label: label, p_type: wasteType, p_confidence: confidence, p_weight: weightKg });
  if (error) return { error: error.message.includes("limit") ? "Scan limit reached for this hour. Take a break! 🌿" : "Could not save the scan." };
  await syncBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: "Saved", points: points as number };
}

export async function redeem(listingId: string): Promise<FormState> {
  const user = await requireUser();
  const { data, error } = await createClient().rpc("redeem", { p_listing: String(listingId) });
  if (error) return { error: error.message };
  await syncBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: data as string };
}

export async function joinChallenge(challengeId: string) {
  const user = await requireUser();
  const { data: challenge } = await createClient().from("challenges").select("id, endsAt").eq("id", String(challengeId)).maybeSingle();
  if (!challenge || new Date(challenge.endsAt) < new Date()) return;
  await createClient().from("challenge_joins").upsert({ userId: user.id, challengeId: challenge.id }, { ignoreDuplicates: true });
  revalidatePath("/rewards");
}

export async function claimChallenge(challengeId: string) {
  const user = await requireUser();
  await createClient().rpc("claim_challenge", { p_challenge: String(challengeId) });
  await syncBadges(user.id);
  revalidatePath("/", "layout");
}

const AVATARS = ["🌱", "🧑‍🎓", "👩‍🎓", "🧑‍💼", "👪", "🌍", "🦊", "🐢", "🌻", "🏫"];
export async function setAvatar(avatar: string) {
  const user = await requireUser();
  if (!AVATARS.includes(avatar)) return;
  await admin().from("profiles").update({ avatar }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function toggleUserActive(userId: string) {
  const me = await requireUser(["SUPER_ADMIN"]);
  const db = admin();
  const { data: target } = await db.from("profiles").select("id, role, active, email").eq("id", String(userId)).maybeSingle();
  if (!target || target.id === me.id || target.role === "SUPER_ADMIN") return;
  await setActive(target.id, !target.active);
  await audit(me.id, target.active ? "USER_DISABLED" : "USER_ENABLED", target.email);
  revalidatePath("/admin/users");
}

// Disabling also bans the Supabase login, so an existing session can't refresh.
async function setActive(id: string, active: boolean) {
  const db = admin();
  await db.from("profiles").update({ active }).eq("id", id);
  await db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_FOREVER });
}

export async function broadcast(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const title = String(fd.get("title") ?? "").trim().slice(0, 80);
  const body = String(fd.get("body") ?? "").trim().slice(0, 280);
  const kind = String(fd.get("kind") ?? "ANNOUNCEMENT") as NoticeKind;
  if (!title || !body || !["ANNOUNCEMENT", "CHALLENGE", "PICKUP", "EVENT"].includes(kind)) return { error: "Fill in title and message." };
  if (me.role === "SUPER_ADMIN") await admin().from("notifications").insert({ title, body, kind });
  else await notifySchool(me.schoolId!, { title, body, kind });
  await audit(me.id, "BROADCAST", title);
  revalidatePath("/notifications");
  return { ok: "Sent!" };
}

export async function linkChild(_: FormState, fd: FormData): Promise<FormState> {
  const parent = await requireUser(["PARENT"]);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const db = admin();
  const { data: child } = await db.from("profiles").select("id, name, parentId").eq("email", email).eq("role", "STUDENT").maybeSingle();
  if (!child) return { error: "No student found with that email." };
  if (child.parentId && child.parentId !== parent.id) return { error: "That student is already linked to another parent." };
  await db.from("profiles").update({ parentId: parent.id }).eq("id", child.id);
  await audit(parent.id, "LINK_CHILD", email);
  revalidatePath("/child");
  return { ok: `Linked ${child.name}` };
}

// Sends Supabase's password-reset email. Same answer whether or not the account exists.
export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("email") ?? "").trim().slice(0, 120);
  const key = id.includes("@") ? id.toLowerCase() : id.toUpperCase();
  const generic = { ok: "If that account exists, we've emailed a link to reset your password. Check your inbox (and spam)." };
  if (key.length < 3) return { error: "Enter your email or ID." };
  const db = admin();
  const { count } = await db.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "RESET_REQUEST").eq("detail", key).gte("createdAt", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 3) return generic;
  await audit(null, "RESET_REQUEST", key);
  const { data: user } = await db.from("profiles").select("email").eq(key.includes("@") ? "email" : "memberId", key).maybeSingle();
  if (user) await createClient().auth.resetPasswordForEmail(user.email, { redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset` });
  return generic;
}

// Admin fallback when a user has no access to their email: set a temporary password.
export async function resetPassword(userId: string): Promise<FormState> {
  const me = await requireUser(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const db = admin();
  const { data: target } = await db.from("profiles").select("id, name, role, memberId, schoolId").eq("id", String(userId)).maybeSingle();
  if (!target || target.role === "SUPER_ADMIN") return { error: "Not allowed." };
  if (me.role === "SCHOOL_ADMIN") {
    const { data: kids } = await db.from("profiles").select("id").eq("parentId", target.id).eq("schoolId", me.schoolId ?? "");
    const inSchool = target.schoolId === me.schoolId || (kids?.length ?? 0) > 0;
    if (!me.schoolId || !inSchool || target.role === "SCHOOL_ADMIN") return { error: "Not allowed." };
  }
  const temp = randomBytes(6).toString("base64url");
  const { error } = await db.auth.admin.updateUserById(target.id, { password: temp });
  if (error) return { error: "Could not reset the password." };
  await audit(me.id, "PASSWORD_RESET", target.memberId);
  return { ok: `Temporary password for ${target.name}: ${temp}  (share it privately; they should change it in Settings)` };
}

export async function updateSettings(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return { error: "Name must be 2–60 characters." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next) {
    if (next.length < 8 || next.length > 200) return { error: "New password must be at least 8 characters." };
    if (!(await verifyPassword(user.email, current))) return { error: "Current password is wrong." };
    const { error } = await createClient().auth.updateUser({ password: next });
    if (error) return { error: "Could not change the password." };
  }
  await admin().from("profiles").update({ name }).eq("id", user.id);
  await audit(user.id, next ? "PASSWORD_CHANGED" : "PROFILE_UPDATED");
  revalidatePath("/", "layout");
  return { ok: next ? "Saved. Password changed." : "Saved." };
}

export async function toggleStaffActive(userId: string) {
  const me = await requireUser(["SCHOOL_ADMIN"]);
  const { data: target } = await admin().from("profiles").select("id, role, active, schoolId, memberId").eq("id", String(userId)).maybeSingle();
  if (!target || !me.schoolId || target.schoolId !== me.schoolId || !["TEACHER", "HEALTH_MONITOR"].includes(target.role)) return;
  await setActive(target.id, !target.active);
  await audit(me.id, target.active ? "USER_DISABLED" : "USER_ENABLED", target.memberId);
  revalidatePath("/school/staff");
}

export async function setSignupsOpen(open: boolean) {
  const me = await requireUser(["SUPER_ADMIN"]);
  await admin().from("settings").upsert({ key: "signupsOpen", value: String(open) });
  await audit(me.id, "SETTING_CHANGED", `signupsOpen=${open}`);
  revalidatePath("/admin/system");
}

// After the reset-email link signs the user in (auth/callback), they choose a new password here.
export async function setNewPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8 || password.length > 200) return { error: "Password must be at least 8 characters." };
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "This reset link has expired. Request a new one." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: "Could not save the password. Try a different one." };
  await audit(user.id, "PASSWORD_RESET_EMAIL");
  redirect("/home");
}
