import type { NextRequest } from "next/server";

import handle from "@imgc/lib/proxy";

/**
 * The proxy is shared (packages/lib/proxy.ts); this file only mounts it. Next requires the
 * function to be declared here rather than re-exported, and `config` to be a literal in this file
 * because Next reads it statically.
 */
export default function proxy(req: NextRequest) {
  return handle(req);
}

/**
 * The shell leaves every path another zone serves alone: locale routing and the session check run
 * in that zone's own proxy. Were the shell to run them first, next-intl would rewrite `/accounts`
 * to `/en/accounts` before the rewrite to the claims zone is matched, and the shell would answer
 * 404 for a path it does not own.
 *
 * Keep the zone paths below in step with ZONE_PATHS in packages/i18n/zones.ts —
 * test/unit/zones.test.ts fails when they drift.
 */
export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next|_vercel|monitoring|(?:[a-z]{2}/)?(?:accounts|initiate-claim|claims|track-claim|claim-dashboard|track-query-response|dashboard|dpd|buckets|admin|additional-documents|audit-trail|notifications)(?:/|$)|.*\\..*).*)",
  ],
};
