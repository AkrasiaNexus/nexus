import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  await createClient().auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}
