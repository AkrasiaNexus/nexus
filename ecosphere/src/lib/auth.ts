import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { admin } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export type CurrentUser = Profile & { school: { name: string } | null };

// undefined = no session; null = signed in to Supabase but no active EcoSphere profile.
// cache(): layout + page share one lookup per request instead of two round-trips each.
const loadUser = cache(async (): Promise<CurrentUser | null | undefined> => {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return undefined;
  const { data } = await sb.from("profiles").select("*, school:schools(name)").eq("id", user.id).maybeSingle();
  return data?.active ? (data as CurrentUser) : null;
});

export async function currentUser() {
  return (await loadUser()) ?? null;
}

export async function requireUser(roles?: Role[]) {
  const user = await loadUser();
  // A disabled/deleted profile with a live Supabase session must be signed out, or middleware would bounce it back here.
  if (user === null) redirect("/auth/signout");
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/home");
  return user;
}

export async function audit(actorId: string | null, action: string, detail = "") {
  await admin().from("audit_logs").insert({ actorId, action, detail });
}

// Checks a password without touching the browser session (used before sensitive changes).
export async function verifyPassword(email: string, password: string) {
  const sb = createStatelessClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return !error;
}
