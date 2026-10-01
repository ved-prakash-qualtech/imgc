import { routing } from "./routing";

/**
 * The zones the portal is split into — one Next.js app each, served together under one domain.
 *
 * `shell` owns sign-in, `/`, the `/api/*` routes and the proxy that sends every other path to the
 * zone that serves it. Moving between two zones is a full page load, so screens that are used
 * together belong to the same zone.
 */
export const ZONES = ["shell", "claims", "loans", "admin"] as const;
export type Zone = (typeof ZONES)[number];
export type ContentZone = Exclude<Zone, "shell">;

/** Path prefixes (locale prefix removed) each content zone serves. A prefix covers its children. */
export const ZONE_PATHS: Readonly<Record<ContentZone, readonly string[]>> = {
  claims: [
    "/accounts",
    "/initiate-claim",
    "/claims",
    "/track-claim",
    "/claim-dashboard",
    "/track-query-response",
  ],
  loans: ["/dashboard", "/dpd", "/buckets"],
  admin: ["/admin", "/additional-documents", "/audit-trail", "/notifications"],
};

/** Where each zone listens in development. */
export const ZONE_DEV_PORT: Readonly<Record<Zone, number>> = {
  shell: 3000,
  claims: 3001,
  loans: 3002,
  admin: 3003,
};

/** Static assets of a content zone are served under this prefix so zones never collide. */
export function zoneAssetPrefix(zone: ContentZone): string {
  return `/${zone}-static`;
}

/** `/hi/accounts/acc_1` → `/accounts/acc_1`. */
export function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

/** The zone that serves a path (locale prefix allowed). Anything unlisted belongs to the shell. */
export function zoneOfPath(pathname: string): Zone {
  const logical = stripLocale(pathname.split(/[?#]/)[0] ?? pathname);
  for (const zone of Object.keys(ZONE_PATHS) as ContentZone[]) {
    // eslint-disable-next-line security/detect-object-injection -- `zone` is one of the three literal keys above
    for (const prefix of ZONE_PATHS[zone]) {
      if (logical === prefix || logical.startsWith(`${prefix}/`)) return zone;
    }
  }
  return "shell";
}

/** The zone this build is. Set by each app's next.config (`NEXT_PUBLIC_ZONE`). */
export function currentZone(): Zone {
  const zone = process.env.NEXT_PUBLIC_ZONE;
  return (ZONES as readonly string[]).includes(zone ?? "")
    ? (zone as Zone)
    : "shell";
}
