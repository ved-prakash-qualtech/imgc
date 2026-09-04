import "server-only";

import { API_ENDPOINTS } from "@/config/apiEndpoints";
import { ssrApi } from "@/services/api/ssrApi";
import type { APIResponse } from "@/types/api.types";

/**
 * What one reconcile of the master-level roles and users did.
 *
 * <p>Mirrors the backend's MasterIdentitySyncResult. Names rather than counts, because "2 users
 * updated" is not something anyone can check and "master-admin, bp-operator" is.
 */
export type MasterIdentitySyncResult = Readonly<{
  ran: boolean;
  message: string | null;
  usersAdded: string[];
  usersUpdated: string[];
  usersStoodDown: string[];
  rolesAdded: string[];
  rolesUpdated: string[];
  rolesStoodDown: string[];
  clientsAdded: string[];
  clientsUpdated: string[];
  clientsStoodDown: string[];
}>;

/**
 * Brings this service's copy of the master roles and users back into line with the portal.
 *
 * <p>The screens read the portal live, so this is not what makes them correct — it is what gives
 * {@code created_by} something to point at and reports something to join on. Both need the
 * portal's own ids, which is why the copy adopts them rather than minting its own.
 */
export async function syncMasterIdentity(): Promise<MasterIdentitySyncResult | null> {
  const res = await ssrApi.admin.post<APIResponse<MasterIdentitySyncResult>>(
    API_ENDPOINTS.identity.sync,
    {}
  );
  return res.data ?? null;
}
