"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMutable } from "@/lib/notices";

const UUID = /^[0-9a-f-]{36}$/i;

// RLS: only notifications the user can see come back, and reads can only be written for themselves.
async function markRead(ids: string[]) {
  const user = await requireUser();
  const sb = createClient();
  const { data } = await sb.from("notifications").select("id").in("id", ids.filter((i) => UUID.test(i)).slice(0, 100));
  if (data?.length) await sb.from("notification_reads").upsert(data.map((n) => ({ userId: user.id, notificationId: n.id })), { ignoreDuplicates: true });
  revalidatePath("/notifications");
  revalidatePath("/home");
}

export async function markOneRead(id: string) {
  await markRead([String(id)]);
}

export async function markAllRead(fd: FormData) {
  await markRead(fd.getAll("id").map(String));
}

export async function setMutedKinds(_: unknown, fd: FormData) {
  const user = await requireUser();
  const muted = Array.from(new Set(fd.getAll("muted").map(String).filter(isMutable)));
  await admin().from("profiles").update({ mutedKinds: muted }).eq("id", user.id);
  revalidatePath("/notifications");
  revalidatePath("/home");
  return { ok: muted.length ? `Muted ${muted.length} categor${muted.length === 1 ? "y" : "ies"}.` : "All notifications on." };
}
