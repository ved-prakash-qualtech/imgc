import "server-only";
import axios from "axios";
import { getServerEnv } from "@/lib/serverEnv";
import { resolveTenantFromHost } from "@/lib/tenantHost";
import { SSR_HTTP_TIMEOUT_MS } from "@/services/api/constants";
import type { APIResponse } from "@/types/api.types";

/**
 * Multi-tenant resolution (frontend-project-standards.md §6; reference
 * implementation: kyc-web-app `tenantResolver.ts`).
 *
 * Flow: hostname prefix → super-admin API client token → active tenants →
 * match by shortCode → tenant backend URL + per-tenant API credentials.
 * Results are cached module-level for 5 minutes, keyed by tenant prefix.
 */

export interface TenantData {
  id: string;
  name: string;
  shortCode: string;
  defaultApiClientId: string;
  defaultApiClientSecret: string;
}

interface TokenData {
  type: string;
  accessToken: string;
}

/** Extract the tenant prefix from a host — delegates to `tenantHost`. */
export function getHostnamePrefixFromHost(host: string | null): string | null {
  if (!host) return null;
  return resolveTenantFromHost(host);
}

/**
 * Build the tenant's backend URL from the super-admin URL by swapping the
 * subdomain prefix (kyc-web-app pattern):
 *   https://admin-kyc-dev.example.in/  →  https://client1-kyc-dev.example.in/
 */
export function buildTenantUrl(
  shortCode: string,
  superAdminUrl: string
): string {
  if (!superAdminUrl) return "";
  if (superAdminUrl.includes("//admin-")) {
    return superAdminUrl.replace(/^(https?:\/\/)admin-/, `$1${shortCode}-`);
  }
  // No admin- prefix (e.g. standalone localhost): keep the base URL as-is
  return superAdminUrl;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<
  string,
  { data: { tenant: TenantData; tenantUrl: string }; at: number }
>();

/** Super-admin API client token (X-Client-Id / X-Client-Secret → Bearer). */
async function fetchApiClientToken(
  superAdminUrl: string
): Promise<string | null> {
  const env = await getServerEnv();
  if (!env.apiClientId || !env.apiClientSecret) return null;

  const res = await axios.post<APIResponse<TokenData>>(
    `${superAdminUrl.replace(/\/$/, "")}/api/v1/api-clients/auth/token`,
    {},
    {
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": env.apiClientId,
        "X-Client-Secret": env.apiClientSecret,
      },
      timeout: SSR_HTTP_TIMEOUT_MS,
    }
  );
  return res.data.status === "SUCCESS"
    ? (res.data.data?.accessToken ?? null)
    : null;
}

async function fetchActiveTenants(
  superAdminUrl: string,
  token: string
): Promise<TenantData[]> {
  const res = await axios.get<APIResponse<TenantData[]>>(
    `${superAdminUrl.replace(/\/$/, "")}/api/v1/tenants/active`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: SSR_HTTP_TIMEOUT_MS,
    }
  );
  return res.data.status === "SUCCESS" ? (res.data.data ?? []) : [];
}

/**
 * Resolve the tenant for a hostname prefix: registry lookup via the super
 * admin (the backend stays the authority) + the tenant's backend URL.
 * Returns null when the tenant is unknown/inactive — callers must treat that
 * as a hard failure (deny by default).
 */
export async function resolveTenantDataSSR(
  prefix: string
): Promise<{ tenant: TenantData; tenantUrl: string } | null> {
  const cached = cache.get(prefix);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const env = await getServerEnv();
  const superAdminUrl = env.superAdminUrl;

  const token = await fetchApiClientToken(superAdminUrl);
  if (!token) return null;

  const tenants = await fetchActiveTenants(superAdminUrl, token);
  const tenant =
    tenants.find((candidate) => candidate.shortCode === prefix) ?? null;
  if (!tenant) return null;

  const data = {
    tenant,
    tenantUrl: buildTenantUrl(tenant.shortCode, superAdminUrl),
  };
  cache.set(prefix, { data, at: Date.now() });
  return data;
}
