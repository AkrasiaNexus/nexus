import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const SESSION_ONLY_COOKIE = "eco_session_only";
export const RECOVERY_COOKIE = "eco_recovery";

// Cookie options for Supabase auth cookies. Without "Remember me" they become browser-session cookies.
export function authCookieOptions<T extends { maxAge?: number; expires?: Date }>(options: T, sessionOnly: boolean): T {
  if (!sessionOnly) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

// Per-request client acting as the signed-in user: every query runs under row-level security.
export function createClient() {
  const store = cookies();
  const sessionOnly = store.get(SESSION_ONLY_COOKIE)?.value === "1";
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, authCookieOptions(options, sessionOnly)));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}
