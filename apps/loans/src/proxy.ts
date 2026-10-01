import type { NextRequest } from "next/server";

import handle from "@imgc/lib/proxy";

/**
 * The proxy is shared (packages/lib/proxy.ts); this file only mounts it. Next requires the
 * function to be declared here rather than re-exported, and `config` to be a literal in this file
 * because Next reads it statically — so each app repeats the matcher.
 */
export default function proxy(req: NextRequest) {
  return handle(req);
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next|_vercel|monitoring|.*\\..*).*)"],
};
