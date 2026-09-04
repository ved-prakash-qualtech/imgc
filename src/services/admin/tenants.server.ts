import "server-only";

import { API_ENDPOINTS } from "@/config/apiEndpoints";
import { ssrApi } from "@/services/api/ssrApi";
import type { APIResponse } from "@/types/api.types";

/** Where a tenant exists. The backend's TenantOverview.State, one for one. */
export type TenantState = "PROVISIONED" | "PORTAL_ONLY" | "LOCAL_ONLY";

export type TenantOverview = Readonly<{
  /** The portal's id, which an edit is applied against. */
  id: string | null;
  tenantCode: string;
  tenantName: string | null;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** The hostname this tenant reaches the application on. */
  redirectionUrl: string | null;
  /** This service's database for the tenant, or null when it has none yet. */
  dbUrl: string | null;
  /** When the portal last changed it, ISO-8601. */
  updatedAt: string | null;
  state: TenantState;
}>;

export type TenantSyncResult = Readonly<{
  ran: boolean;
  portalCount: number;
  provisioned: string[];
  failed: string[];
  deactivated: string[];
}>;

export type OnboardTenantInput = Readonly<{
  tenantCode: string;
  tenantName: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPhoneNumber: string;
}>;

/**
 * Every tenant either system knows about.
 *
 * <p>Reads through to the backend, which reads the identity portal live — the point of this
 * screen is to show whether the two agree, and a cached answer could not.
 */
export async function fetchTenantOverview(): Promise<TenantOverview[]> {
  const res = await ssrApi.admin.get<APIResponse<TenantOverview[]>>(
    API_ENDPOINTS.tenants.overview
  );
  return res.data ?? [];
}

/**
 * The tenant codes still free in the portal's hostname pool.
 *
 * Codes are allocated by infra ahead of time and no API creates one, so this is the complete set
 * of codes an onboarding can use. That is why the form offers a list and not a text box: a code
 * nobody allocated has no hostname, and nothing would resolve to the tenant.
 */
export async function fetchAvailableTenantCodes(): Promise<string[]> {
  const res = await ssrApi.admin.get<APIResponse<string[]>>(
    API_ENDPOINTS.tenants.availableCodes
  );
  return res.data ?? [];
}

/** Reconciles the local registry against the portal, provisioning whatever is missing. */
export async function syncTenants(): Promise<TenantSyncResult | null> {
  const res = await ssrApi.admin.post<APIResponse<TenantSyncResult>>(
    API_ENDPOINTS.tenants.sync,
    {}
  );
  return res.data ?? null;
}

/**
 * Onboards a tenant: registered with the portal, then provisioned here by the same reconcile
 * the Sync button runs. Returns the sync result, because what the caller needs to know is
 * whether the local half landed — if it did not, Sync finishes it.
 */
export async function onboardTenant(
  input: OnboardTenantInput
): Promise<TenantSyncResult | null> {
  const res = await ssrApi.admin.post<APIResponse<TenantSyncResult>>(
    API_ENDPOINTS.tenants.onboard,
    input
  );
  return res.data ?? null;
}

/** Applies an edit through the backend, which forwards it to the portal that owns the fields. */
export async function updateTenant(
  tenantCode: string,
  input: OnboardTenantInput
): Promise<TenantSyncResult | null> {
  const res = await ssrApi.admin.put<APIResponse<TenantSyncResult>>(
    `${API_ENDPOINTS.tenants.base}/${tenantCode}`,
    input
  );
  return res.data ?? null;
}
