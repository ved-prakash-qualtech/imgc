import "server-only";

import { API_ENDPOINTS } from "@/config/apiEndpoints";
import { ssrApi } from "@/services/api/ssrApi";
import type { APIResponse } from "@/types/api.types";

/**
 * The machine credentials that call this service.
 *
 * <p>Local by design. A credential issued by the identity portal lets an application call the
 * <em>portal</em>; one of these lets a machine call <em>this service</em>. The portal does not
 * return secrets for its own clients — nor should it — so there is nothing here to reconcile, and
 * unlike Roles and Users this screen has no Sync.
 */

export type ApiClientRole = Readonly<{ id: string; name: string }>;

export type ApiClient = Readonly<{
  id: string;
  clientId: string;
  name: string;
  emailId: string;
  description: string;
  status: number | null;
  /** True for a replica of a portal-registered client — inert here, authenticates at the portal. */
  portalManaged: boolean;
  roles: ApiClientRole[];
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type ApiClientInput = Readonly<{
  name: string;
  emailId: string;
  description: string;
  roleIds: string[];
  status?: number;
}>;

/** A client plus the one and only readable copy of its secret. */
export type ApiClientSecret = Readonly<{
  client: ApiClient;
  clientSecret: string;
}>;

export async function fetchApiClients(): Promise<ApiClient[]> {
  const res = await ssrApi.admin.get<APIResponse<ApiClient[]>>(
    API_ENDPOINTS.apiClients.base
  );
  return res.data ?? [];
}

/** Creates a client. The secret in the response is never retrievable again. */
export async function createApiClient(
  input: ApiClientInput
): Promise<ApiClientSecret | null> {
  const res = await ssrApi.admin.post<APIResponse<ApiClientSecret>>(
    API_ENDPOINTS.apiClients.base,
    input
  );
  return res.data ?? null;
}

export async function updateApiClient(
  id: string,
  input: ApiClientInput
): Promise<ApiClient | null> {
  const res = await ssrApi.admin.put<APIResponse<ApiClient>>(
    `${API_ENDPOINTS.apiClients.base}/${id}`,
    input
  );
  return res.data ?? null;
}

/** Issues a new secret and invalidates the old one immediately — no grace period. */
export async function rotateApiClientSecret(
  id: string
): Promise<ApiClientSecret | null> {
  const res = await ssrApi.admin.post<APIResponse<ApiClientSecret>>(
    API_ENDPOINTS.apiClients.rotateSecret(id),
    {}
  );
  return res.data ?? null;
}
