"use client";

import { createContext, useContext } from "react";

/**
 * Tenant context for client components (nextjs-multitenant-template.md §2):
 * the tenant is resolved ONCE server-side (middleware → layout) and passed
 * down — client code never re-derives it from window.location.
 */
const TenantContext = createContext<string | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: string | null;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

/** Current tenant short code, or null in system scope. */
export function useTenant(): string | null {
  return useContext(TenantContext);
}
