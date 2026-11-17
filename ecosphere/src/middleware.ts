import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/", "/login", "/signup", "/forgot", "/auth/callback", "/auth/reset", "/auth/signout"];
const SESSION_ONLY_COOKIE = "eco_session_only";

// Refreshes the Supabase session cookie on every request and guards signed-in routes.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sessionOnly = req.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => {
          const { maxAge, expires, ...rest } = options;
          res.cookies.set(name, value, sessionOnly ? rest : { ...rest, maxAge, expires });
        });
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.includes(pathname);
  if (user && isPublic && !pathname.startsWith("/auth/")) return NextResponse.redirect(new URL("/home", req.url));
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|models|api/health).*)"] };
