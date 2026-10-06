import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "@imgc/i18n/routing";
import { stripLocale } from "@imgc/i18n/zones";
import { SESSION_COOKIE, verifySessionToken } from "@imgc/lib/auth/appSession";

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

/**
 * The address the browser used, as opposed to the one this server was reached on.
 *
 * Behind the shell a zone is reached by an internal address (`localhost:3002`, a service host), and
 * Next's rewrite proxy passes the original host along as `x-forwarded-host`. A redirect built from
 * the internal address would send the browser straight to a zone that has no sign-in page and no
 * idea about the other zones, so redirects are rebuilt on the public address instead.
 */
function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host");
  if (!host) return req.nextUrl.origin;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Points a redirect that stays on this server at the public address instead. */
function onPublicOrigin(req: NextRequest, res: NextResponse): NextResponse {
  const location = res.headers.get("location");
  if (!location) return res;
  const target = new URL(location, req.nextUrl.origin);
  if (target.origin === req.nextUrl.origin) {
    const publicUrl = new URL(
      `${target.pathname}${target.search}${target.hash}`,
      publicOrigin(req)
    );
    res.headers.set("location", publicUrl.toString());
  }
  return res;
}

/**
 * Every zone mounts this as its own `proxy.ts`, so a request is checked the same way whichever zone
 * serves it. (`export const config` has to be a literal in each app's file — Next reads it statically.)
 */
export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const logicalPath = stripLocale(pathname);

  if (!PUBLIC_PATHS.has(logicalPath)) {
    const session = await verifySessionToken(
      req.cookies.get(SESSION_COOKIE)?.value
    );
    if (!session) {
      const signIn = new URL("/login", req.nextUrl.origin);
      signIn.searchParams.set("returnTo", pathname + search);
      return onPublicOrigin(req, NextResponse.redirect(signIn));
    }

    // Resolved once here so no page re-derives it.
    const res = intlMiddleware(req);
    res.headers.set("x-middleware-request-x-imgc-role", session.role);
    res.headers.set("x-middleware-request-x-imgc-user-id", session.userId);
    return onPublicOrigin(req, res);
  }

  return onPublicOrigin(req, intlMiddleware(req));
}
