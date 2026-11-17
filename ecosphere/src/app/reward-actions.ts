"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./actions";

// Points are only ever spent inside the unlock_item() RPC (balance check + ledger in one transaction).
export async function unlockItem(itemId: string): Promise<FormState> {
  const user = await requireUser();
  const { error } = await createClient().rpc("unlock_item", { p_item: String(itemId) });
  if (error) return { error: error.message.includes("Not enough") ? "Not enough points yet." : "Could not unlock that item." };
  await audit(user.id, "REWARD_UNLOCKED", String(itemId));
  revalidatePath("/", "layout");
  return { ok: "Unlocked!" };
}

export async function equipItem(itemId: string, on: boolean) {
  await requireUser();
  await createClient().rpc("equip_item", { p_item: String(itemId), p_on: on });
  revalidatePath("/", "layout");
}
