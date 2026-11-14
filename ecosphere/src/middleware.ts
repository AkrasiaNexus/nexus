import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/", "/login", "/signup", "/forgot"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session && PUBLIC.includes(pathname)) return NextResponse.redirect(new URL("/home", req.url));
  if (!session && !PUBLIC.includes(pathname)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|api/health).*)"] };
