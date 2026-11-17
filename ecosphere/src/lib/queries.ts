import "server-only";
import { admin } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Profile, WasteType } from "./types";
import { impact } from "./waste";
import { earnedBadges } from "./rewards";

// Named scopes enforced in SQL by scans_in_scope(); rows come back without user identity.
export type Scope = "me" | "children" | "class" | "school" | "department" | "community" | "platform";

export function scanScope(user: Pick<Profile, "role">): Scope {
  switch (user.role) {
    case "PARENT": return "children";
    case "SCHOOL_ADMIN": return "school";
    case "TEACHER":
    case "HEALTH_MONITOR": return "class";
    case "SUPER_ADMIN": return "platform";
    case "COMMUNITY_ADMIN": return "community";
    default: return "me";
  }
}

// Supabase returns timestamps as ISO strings; the UI works with Date objects.
export function withDates<T extends Record<string, unknown>>(rows: T[] | null, ...keys: (keyof T)[]) {
  return (rows ?? []).map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] ? new Date(r[k] as string) : r[k]])) })) as (T & Record<(typeof keys)[number], Date>)[];
}

export const startOf = (period: "week" | "month" | "year") => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(1);
  if (period === "year") d.setMonth(0, 1);
  return d;
};

type ScanRow = { wasteType: WasteType; weightKg: number; createdAt: string };

export async function impactFor(scope: Scope, since?: Date, until?: Date) {
  const { data } = await createClient().rpc("scans_in_scope", { p_scope: scope, p_since: since?.toISOString() ?? null, p_until: until?.toISOString() ?? null });
  const scans = withDates(data as ScanRow[] | null, "createdAt");
  return { scans, ...impact(scans) };
}

// One person's scans (row-level security decides whether the caller may see them).
export async function impactForUser(userId: string, since?: Date) {
  let q = createClient().from("scans").select("wasteType, weightKg, createdAt").eq("userId", userId);
  if (since) q = q.gte("createdAt", since.toISOString());
  const scans = withDates((await q).data as ScanRow[] | null, "createdAt");
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

export async function visibleNotifications(userId: string, take = 30) {
  const { data } = await createClient().from("notifications").select("*").or(`userId.eq.${userId},userId.is.null`).order("createdAt", { ascending: false }).limit(take);
  return withDates(data as { id: string; kind: string; title: string; body: string; createdAt: string; userId: string | null }[] | null, "createdAt");
}

export async function syncBadges(userId: string) {
  const db = admin();
  const [user, scans, purchases, challenges, have] = await Promise.all([
    db.from("profiles").select("points").eq("id", userId).single(),
    db.from("scans").select("wasteType").eq("userId", userId),
    db.from("purchases").select("id", { count: "exact", head: true }).eq("userId", userId),
    db.from("challenge_joins").select("userId", { count: "exact", head: true }).eq("userId", userId).eq("completed", true),
    db.from("user_badges").select("badgeId").eq("userId", userId),
  ]);
  const owned = new Set((have.data ?? []).map((b) => b.badgeId as string));
  const types = new Set((scans.data ?? []).map((s) => s.wasteType)).size;
  const fresh = earnedBadges({ scans: scans.data?.length ?? 0, points: user.data?.points ?? 0, types, purchases: purchases.count ?? 0, challenges: challenges.count ?? 0 })
    .filter((b) => !owned.has(b.id));
  if (fresh.length) await db.from("user_badges").upsert(fresh.map((b) => ({ userId, badgeId: b.id })), { ignoreDuplicates: true });
  return new Set([...Array.from(owned), ...fresh.map((b) => b.id)]);
}

// Display names for other people (leaderboards, listing owners, task creators): no email or private fields.
export async function publicNames(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unique.length) return new Map<string, { name: string; avatar: string }>();
  const { data } = await createClient().from("public_profiles").select("id, name, avatar").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, { name: p.name as string, avatar: p.avatar as string }]));
}

export type AdminFilters = { school?: string; community?: string; cls?: string; role?: string };

// Admin analytics (super admin: any filter; school admin: pinned to their school in SQL).
export async function impactFiltered(f: AdminFilters, since?: Date, until?: Date) {
  const { data } = await createClient().rpc("scans_filtered", {
    p_school: f.school || null, p_community: f.community || null, p_class: f.cls || null, p_role: f.role || null,
    p_since: since?.toISOString() ?? null, p_until: until?.toISOString() ?? null,
  });
  const scans = withDates(data as ScanRow[] | null, "createdAt");
  return { scans, ...impact(scans) };
}

// Equipped cosmetics for an avatar, resolved from the user's equipped item ids.
export async function cosmeticsFor(p: { equippedBackground?: string | null; equippedBorder?: string | null; equippedSticker?: string | null }) {
  const ids = [p.equippedBackground, p.equippedBorder, p.equippedSticker].filter(Boolean) as string[];
  if (!ids.length) return {};
  const { data } = await createClient().from("reward_items").select("id, value").in("id", ids);
  const v = (id?: string | null) => (data ?? []).find((i) => i.id === id)?.value ?? null;
  return { background: v(p.equippedBackground), border: v(p.equippedBorder), sticker: v(p.equippedSticker) };
}
