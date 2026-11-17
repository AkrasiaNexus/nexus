import "server-only";
import { admin } from "./supabase/admin";
import type { NoticeKind } from "./types";

// Notify everyone at a school (optionally one class + the school admin), plus parents of those students.
export async function notifySchool(schoolId: string, n: { kind: NoticeKind; title: string; body: string }, className?: string) {
  let q = admin().from("profiles").select("id, parentId").eq("schoolId", schoolId).eq("active", true);
  if (className) q = q.or(`grade.eq.${JSON.stringify(className)},role.eq.SCHOOL_ADMIN`);
  const { data: members } = await q;
  const ids = new Set((members ?? []).flatMap((m) => (m.parentId ? [m.id, m.parentId] : [m.id])));
  if (ids.size) await admin().from("notifications").insert(Array.from(ids, (userId) => ({ userId, ...n })));
}
