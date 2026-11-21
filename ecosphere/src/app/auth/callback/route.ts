import { NextResponse } from "next/server";
import { RECOVERY_COOKIE, createClient } from "@/lib/supabase/server";

// Landing point for Supabase email links (password reset): trades the one-time code for a session.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home"; // no open redirects
  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(safeNext, url.origin));
      // Marks this browser as mid-reset so /auth/reset may set a password without the old one (15 min).
      if (safeNext === "/auth/reset") res.cookies.set(RECOVERY_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 });
      return res;
    }
  }
  return NextResponse.redirect(new URL("/login?link=expired", url.origin));
}
