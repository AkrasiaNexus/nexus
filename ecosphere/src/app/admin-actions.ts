"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adjustSchema, adminUserSchema, classChallengeSchema, communitySchema, moderationSchema, schoolSchema } from "@/lib/validation";
import type { FormState } from "./actions";

// Every action here re-checks SUPER_ADMIN on the server; the UI hiding buttons is not the guard.
const superAdmin = () => requireUser(["SUPER_ADMIN"]);
const formObject = (fd: FormData) => Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string" && v !== ""));
const SETTINGS = ["signupsOpen", "marketplace.requireApproval"] as const;
// Only paths createListing generates: <user uuid>/<random uuid>.<ext>
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function updateUser(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const parsed = adminUserSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = admin();
  const { data: target } = await db.from("profiles").select("id, role, email").eq("id", String(userId)).maybeSingle();
  if (!target || target.id === me.id || target.role === "SUPER_ADMIN") return { error: "This account can't be edited here." };
  const d = parsed.data;
  const { data: community } = d.communityId ? await db.from("communities").select("name").eq("id", d.communityId).maybeSingle() : { data: null };
  const { error } = await db.from("profiles").update({
    role: d.role, schoolId: d.schoolId ?? null, communityId: d.communityId ?? null, community: community?.name ?? null,
    grade: d.grade || null, department: d.department || null,
  }).eq("id", target.id);
  if (error) return { error: "Could not save." };
  await audit(me.id, "USER_UPDATED", `${target.email} role=${d.role}${target.role !== d.role ? ` (was ${target.role})` : ""}`);
  revalidatePath(`/admin/users/${target.id}`);
  return { ok: "Saved." };
}

export async function adjustPoints(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const parsed = adjustSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: target } = await admin().from("profiles").select("id, role").eq("id", String(userId)).maybeSingle();
  if (!target || target.id === me.id || target.role === "SUPER_ADMIN") return { error: "Admin accounts' points can't be adjusted." };
  // RPC re-checks the role, writes the ledger, notifies the user and audits.
  const { error } = await createClient().rpc("adjust_points", { p_user: String(userId), p_delta: parsed.data.delta, p_reason: parsed.data.reason });
  if (error) return { error: error.message.includes("Not enough") ? "That would take their balance below zero." : "Could not adjust points." };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: `${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta} EC applied.` };
}

export async function setSetting(key: string, value: string) {
  const me = await superAdmin();
  if (!(SETTINGS as readonly string[]).includes(key) || !["true", "false"].includes(value)) return;
  await admin().from("settings").upsert({ key, value });
  await audit(me.id, "SETTING_CHANGED", `${key}=${value}`);
  revalidatePath("/admin/system");
}

export async function moderateListing(listingId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const status = String(fd.get("decision"));
  if (!["APPROVED", "REJECTED", "REMOVED"].includes(status)) return { error: "Pick a decision." };
  const parsedNote = moderationSchema.safeParse(formObject(fd));
  if (!parsedNote.success) return { error: "Keep the note under 200 characters." };
  const note = parsedNote.data.note;
  if (status !== "APPROVED" && !note) return { error: "Tell the owner why." };
  const db = admin();
  const { data: l } = await db.from("listings").update({ status, moderationNote: note || null }).eq("id", String(listingId)).select("id, title, ownerId, imageUrl").maybeSingle();
  if (!l) return { error: "Listing not found." };
  // Rejected/removed photos shouldn't stay publicly reachable in the bucket.
  const photoPath = decodeURIComponent(l.imageUrl?.split("/listing-images/")[1] ?? "");
  if (status !== "APPROVED" && PHOTO_PATH.test(photoPath)) {
    await db.storage.from("listing-images").remove([photoPath]);
    await db.from("listings").update({ imageUrl: null }).eq("id", l.id);
  }
  if (l.ownerId) {
    await db.from("notifications").insert({
      userId: l.ownerId, kind: "MARKETPLACE",
      title: status === "APPROVED" ? `"${l.title}" is live` : `"${l.title}" was ${status === "REJECTED" ? "not approved" : "removed"}`,
      body: note || "Thanks for keeping things circular!",
    });
  }
  if (status === "REMOVED") await db.from("listing_reports").update({ status: "RESOLVED" }).eq("listingId", l.id).eq("status", "OPEN");
  await audit(me.id, `LISTING_${status}`, l.title);
  revalidatePath("/admin/marketplace");
  revalidatePath("/marketplace");
  return { ok: "Done." };
}

export async function dismissReport(reportId: string) {
  const me = await superAdmin();
  const { data } = await admin().from("listing_reports").update({ status: "DISMISSED" }).eq("id", String(reportId)).eq("status", "OPEN").select("id").maybeSingle();
  if (data) await audit(me.id, "REPORT_DISMISSED", data.id);
  revalidatePath("/admin/marketplace");
}

export async function createSchool(_: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const parsed = schoolSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: "Enter a name and city." };
  const { error } = await admin().from("schools").insert(parsed.data);
  if (error) return { error: error.code === "23505" ? "A school with that name exists." : "Could not add the school." };
  await audit(me.id, "SCHOOL_CREATED", parsed.data.name);
  revalidatePath("/admin/schools");
  return { ok: `${parsed.data.name} added.` };
}

export async function createCommunity(_: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const parsed = communitySchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: "Enter a name (2+ characters)." };
  const { error } = await admin().from("communities").insert(parsed.data);
  if (error) return { error: error.code === "23505" ? "A community with that name exists." : "Could not add the community." };
  await audit(me.id, "COMMUNITY_CREATED", parsed.data.name);
  revalidatePath("/admin/communities");
  return { ok: `${parsed.data.name} added.` };
}

export async function createChallenge(_: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const parsed = classChallengeSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.endsAt <= new Date()) return { error: "Pick an end date in the future." };
  const db = admin();
  const { error } = await db.from("challenges").insert({ ...parsed.data, endsAt: parsed.data.endsAt.toISOString(), creatorId: me.id });
  if (error) return { error: "Could not create the challenge." };
  await db.from("notifications").insert({ kind: "CHALLENGE", title: `New challenge: ${parsed.data.title}`, body: `+${parsed.data.rewardPoints} EC · ends ${parsed.data.endsAt.toLocaleDateString()}` });
  await audit(me.id, "CHALLENGE_CREATED", parsed.data.title);
  revalidatePath("/admin/challenges");
  return { ok: "Challenge published to everyone." };
}

export async function endChallenge(challengeId: string) {
  const me = await superAdmin();
  const { data } = await admin().from("challenges").update({ endsAt: new Date().toISOString() }).eq("id", String(challengeId)).select("title").maybeSingle();
  if (data) await audit(me.id, "CHALLENGE_ENDED", data.title);
  revalidatePath("/admin/challenges");
}

export async function setRewardRule(action: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const points = Number(fd.get("points"));
  if (!Number.isInteger(points) || points < 0 || points > 1000) return { error: "0–1000 points." };
  const { data } = await admin().from("reward_rules").update({ points }).eq("action", String(action)).select("action").maybeSingle();
  if (!data) return { error: "Unknown rule." };
  await audit(me.id, "REWARD_RULE_CHANGED", `${data.action}=${points}`);
  revalidatePath("/admin/rewards");
  return { ok: "Saved." };
}

export async function setRewardItem(itemId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await superAdmin();
  const price = Number(fd.get("price"));
  if (!Number.isInteger(price) || price < 0 || price > 10000) return { error: "0–10,000 points." };
  const active = fd.get("active") === "on";
  const { data } = await admin().from("reward_items").update({ price, active }).eq("id", String(itemId)).select("name").maybeSingle();
  if (!data) return { error: "Unknown item." };
  await audit(me.id, "REWARD_ITEM_CHANGED", `${data.name} price=${price} active=${active}`);
  revalidatePath("/admin/rewards");
  return { ok: "Saved." };
}
