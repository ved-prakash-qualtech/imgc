import "server-only";
import axios from "axios";
import { cookies, headers } from "next/headers";
import { getServerEnv } from "@/lib/serverEnv";
import { SSR_HTTP_TIMEOUT_MS } from "@/services/api/constants";
import { createRequestHandlers } from "@/services/api/requestFactory";

/**
 * ssrApi — unified API layer for SSR services (frontend-project-standards.md §2).
 *
 * - ssrApi.admin    → injects the httpOnly `accessToken` cookie as a Bearer token
 * - ssrApi.customer → injects the `customerAccessToken` cookie
 * - ssrApi.public   → no auth (sample/standalone use)
 *
 * SERVER-ONLY: *.server.ts services use this; client components never import it
 * (they go through server actions).
 */
async function createClient(tokenCookie: string | null) {
  const env = await getServerEnv();
  const incoming = await headers();
  const clientHeaders: Record<string, string> = {};

  // Multitenant rule (nextjs-multitenant-template.md §2): forward the original
  // Host (and the resolved tenant) so the backend's own resolution filter sees
  // the same tenant — the subdomain stays the single source of truth end to end.
  const host = incoming.get("host");
  if (host) clientHeaders["X-Forwarded-Host"] = host;
  const tenant = incoming.get("x-tenant");
  if (tenant) clientHeaders["x-tenant"] = tenant;

  if (tokenCookie) {
    const token = (await cookies()).get(tokenCookie)?.value;
    if (token) clientHeaders.Authorization = `Bearer ${token}`;
  }

  return axios.create({
    baseURL: env.backendBaseUrl,
    headers: clientHeaders,
    timeout: SSR_HTTP_TIMEOUT_MS,
  });
}

export const ssrApi = {
  admin: createRequestHandlers(() => createClient("accessToken")),
  customer: createRequestHandlers(() => createClient("customerAccessToken")),
  public: createRequestHandlers(() => createClient(null)),
};
