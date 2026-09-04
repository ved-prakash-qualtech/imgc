import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/appSession";

/**
 * IMGC Lender Portal proxy: next-intl locale routing + a signed-session guard.
 *
 * The base template's subdomain-tenant resolution is intentionally removed — this portal is a
 * single deployment, and access scope (IMGC vs Lender, and which lender) is carried by the
 * session cookie, decided at sign-in from the identity itself.
 */
const intlMiddleware = createIntlMiddleware(routing);

/** Reachable without a session. Everything else redirects to sign-in. */
const PUBLIC_PATHS = new Set(["/", "/login"]);

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const logicalPath = stripLocalePrefix(pathname);

  if (!PUBLIC_PATHS.has(logicalPath)) {
    const session = await verifySessionToken(
      req.cookies.get(SESSION_COOKIE)?.value
    );
    if (!session) {
      const signIn = new URL("/login", req.nextUrl.origin);
      signIn.searchParams.set("returnTo", pathname + search);
      return NextResponse.redirect(signIn);
    }

    // Resolved once here so no page re-derives it.
    const headers = new Headers(req.headers);
    headers.set("x-imgc-role", session.role);
    headers.set("x-imgc-user-id", session.userId);
    return intlMiddleware(new NextRequest(req, { headers }));
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next|_vercel|monitoring|.*\\..*).*)"],
};
