import { routing } from "@/i18n/routing";

/** One subdomain segment: lowercase alphanumeric, starting with a letter. */
export const TENANT_HOST_SEGMENT_RE = /^[a-z][a-z0-9]*$/;

/** Routes that run in system scope (no tenant required). */
export const TENANT_EXCLUDED_PREFIXES = [
  "/admin",
  "/api/v1/tenants",
  "/api/v1/api-clients",
  "/monitoring",
] as const;

/**
 * What the admin host may serve. It resolves no tenant, so anything not listed here is refused
 * rather than rendered against no data — an allowlist, so a new tenant-scoped page is safe by
 * default and an admin-scoped one is a deliberate addition.
 *
 * `/tenants` administers every tenant and therefore cannot live inside one; the page itself
 * refuses tenant scope for the same reason from the other side.
 */
export const ADMIN_ALLOWED_PREFIXES = [
  "/login",
  "/dashboard",
  "/tenants",
  "/layout",
  "/roles",
  "/users",
  "/api-clients",
] as const;

/** Strip a non-default locale prefix so tenant checks see the logical path. */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

/**
 * The tenant code from `{tenant}-{product}-{env}[-{location}].{baseDomain}`, or null for an
 * admin host and for anything not following the convention.
 *
 * Only the first three segments are addressed. A fourth and beyond name where the estate put
 * the box — onprem, aws — and say nothing about who is asking; requiring exactly three left
 * every deployed host unmatched, which reads as system scope, so the root rendered and every
 * tenant-scoped route was refused.
 *
 * Split rather than matched: an optional trailing location needs a quantifier inside a
 * quantifier, which is a real backtracking risk and which security/detect-unsafe-regex
 * rejects outright.
 */
export function resolveTenantFromHost(host: string): string | null {
  if (host.startsWith("admin-")) return null;
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const dot = hostname.indexOf(".");
  if (dot <= 0) return null;

  const parts = hostname.slice(0, dot).split("-");
  if (parts.length < 3) return null;
  if (!parts.every((part) => TENANT_HOST_SEGMENT_RE.test(part))) return null;

  return parts[0] ?? null;
}

/**
 * ADMIN  `admin-{product}-{env}.…`    — superadmin, no tenant
 * TENANT `{tenant}-{product}-{env}.…` — one tenant's workspace
 * SYSTEM  localhost / anything else   — development fallback
 */
export type HostScope = "ADMIN" | "TENANT" | "SYSTEM";

/**
 * Scope is a property of the host, not of the token.
 *
 * The realm issues every user the same default roles, so a token cannot say whether its holder
 * is an administrator or a tenant's administrator. The host can, and it is the same signal the
 * tenant itself is resolved from — one answer, one place, and it cannot disagree with the
 * tenant the rest of the request runs under.
 */
export function resolveHostScope(host: string): HostScope {
  if (host.startsWith("admin-")) return "ADMIN";
  return resolveTenantFromHost(host) === null ? "SYSTEM" : "TENANT";
}

/** Check if a path is one an ADMIN scoped host may reach. */
export function isAdminAllowedPath(pathnameWithoutLocale: string): boolean {
  return ADMIN_ALLOWED_PREFIXES.some(
    (prefix) =>
      pathnameWithoutLocale === prefix ||
      pathnameWithoutLocale.startsWith(`${prefix}/`)
  );
}

export function isTenantExcludedPath(pathnameWithoutLocale: string): boolean {
  if (pathnameWithoutLocale === "/") return true;
  return TENANT_EXCLUDED_PREFIXES.some(
    (prefix) =>
      pathnameWithoutLocale === prefix ||
      pathnameWithoutLocale.startsWith(`${prefix}/`)
  );
}
