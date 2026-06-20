import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  authStorageKey,
  clearAuthCookies,
  getAuthFromRequestCookies,
} from "@/lib/supabase/session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pos",
  "/sales",
  "/inventory",
  "/customers",
  "/reports",
  "/analytics",
  "/settings",
  "/web-orders",
] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Route protection validates the Supabase access JWT from cookies (exp + optional
 * HS256 signature). Does not trust user-only cookies or raw userId parsing.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const auth = await getAuthFromRequestCookies(() => request.cookies.getAll());
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  const isProtected = isProtectedPath(pathname);
  const key = authStorageKey();
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === key ||
        cookie.name.startsWith(`${key}.`) ||
        cookie.name === `${key}-user` ||
        cookie.name.startsWith(`${key}-user.`)
    );

  if (!auth && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    if (hasSessionCookie) clearAuthCookies(request, redirect);
    return redirect;
  }

  if (auth && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
