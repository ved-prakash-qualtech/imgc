import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@imgc/lib/auth/appSession";

/**
 * Clear the session cookie and return to sign-in.
 *
 * The Location is relative so the browser resolves it against the address it used:
 * `request.nextUrl.origin` is this server's own address, which behind the dev front door or any
 * proxy is not one the browser can see.
 */
export async function GET() {
  const response = new NextResponse(null, {
    status: 307,
    headers: { location: "/login" },
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
