import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/appSession";

/** Clear the session cookie and return to sign-in. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
