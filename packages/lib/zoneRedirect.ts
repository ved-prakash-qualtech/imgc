import { redirect as nextRedirect } from "next/navigation";

import { getPathname } from "@imgc/i18n/navigation";
import { currentZone, zoneOfPath } from "@imgc/i18n/zones";

/**
 * A server-side redirect that is safe across zones.
 *
 * Each zone is its own Next.js app with its own build. `redirect()` from a server action or a
 * server component reaches the browser as an instruction for the client router to navigate softly,
 * and a soft navigation into another zone asks that zone for a page payload and tries to render it
 * inside this app's router. In production the mismatched build ids make Next fall back to a full
 * page load; in development every zone reports the same build id, so nothing notices — the
 * sign-in button works, the session is created, and the page simply never moves.
 *
 * So a redirect that stays in this zone is a normal `redirect()`, and one that leaves it goes
 * through `/api/zone-redirect` in the shell. That is a route handler, not a page: the client router
 * cannot render it, does a full page load, and the handler answers with the real redirect.
 */
export function redirectTo(href: string, locale?: string): never {
  const target = locale ? getPathname({ href, locale }) : href;
  if (zoneOfPath(target) === currentZone())
    return nextRedirect(target) as never;
  return nextRedirect(
    `/api/zone-redirect?to=${encodeURIComponent(target)}`
  ) as never;
}
