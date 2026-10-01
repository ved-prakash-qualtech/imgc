import "server-only";
import { headers } from "next/headers";

/**
 * Tenant context (server side) — reads the `x-tenant` header set by `src/proxy.ts`.
 * Client components receive the tenant via <TenantProvider> from a layout;
 * they never re-derive it themselves.
 */

/** Returns the current tenant, or null in system scope (admin console, home). */
export async function getTenantOrNull(): Promise<string | null> {
  return (await headers()).get("x-tenant");
}

/** Returns the current tenant; throws when called outside a tenant scope. */
export async function currentTenant(): Promise<string> {
  const tenant = await getTenantOrNull();
  if (!tenant) throw new Error("No tenant in request scope");
  return tenant;
}
