"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { notifyCommunity } from "@/lib/notify";
import { admin } from "@/lib/supabase/admin";
import type { FormState } from "./actions";

const BAN_FOREVER = "876000h";
const text = (max: number) => z.string().trim().min(1).max(max);
const pointSchema = z.object({ name: text(80), address: z.string().trim().max(120).default(""), accepts: z.string().trim().max(160).default("") });
const noticeSchema = z.object({ title: text(80), body: text(280), kind: z.enum(["ANNOUNCEMENT", "EVENT", "PICKUP", "CHALLENGE"]) });

// Every action re-checks: caller is an active COMMUNITY_ADMIN and the target belongs to *their* community.
async function requireCommunityAdmin() {
  const me = await requireUser(["COMMUNITY_ADMIN"]);
  if (!me.communityId) throw new Error("No community assigned");
  return me as typeof me & { communityId: string };
}

export async function toggleCommunityMember(userId: string) {
  const me = await requireCommunityAdmin();
  const db = admin();
  const { data: t } = await db.from("profiles").select("id, role, active, communityId, memberId").eq("id", String(userId)).maybeSingle();
  if (!t || t.communityId !== me.communityId || t.role !== "COMMUNITY") return;
  await db.from("profiles").update({ active: !t.active }).eq("id", t.id);
  await db.auth.admin.updateUserById(t.id, { ban_duration: t.active ? BAN_FOREVER : "none" });
  await audit(me.id, t.active ? "USER_DISABLED" : "USER_ENABLED", t.memberId);
  revalidatePath("/community");
}

export async function addCollectionPoint(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireCommunityAdmin();
  const parsed = pointSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Give the collection point a name." };
  await admin().from("collection_points").insert({ ...parsed.data, communityId: me.communityId });
  await audit(me.id, "COLLECTION_POINT_ADDED", parsed.data.name);
  revalidatePath("/community");
  return { ok: "Collection point added." };
}

export async function toggleCollectionPoint(id: string) {
  const me = await requireCommunityAdmin();
  const db = admin();
  const { data: p } = await db.from("collection_points").select("id, active, communityId, name").eq("id", String(id)).maybeSingle();
  if (!p || p.communityId !== me.communityId) return;
  await db.from("collection_points").update({ active: !p.active }).eq("id", p.id);
  await audit(me.id, p.active ? "COLLECTION_POINT_CLOSED" : "COLLECTION_POINT_OPENED", p.name);
  revalidatePath("/community");
}

export async function announceToCommunity(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireCommunityAdmin();
  const parsed = noticeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Fill in title and message." };
  await notifyCommunity(me.communityId, parsed.data);
  await audit(me.id, "BROADCAST", parsed.data.title);
  return { ok: "Sent to your community." };
}
