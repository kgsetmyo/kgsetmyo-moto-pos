import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/pos/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/reports/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/sales/:path*",
    "/web-orders/:path*",
  ],
};
