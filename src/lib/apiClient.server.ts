import "server-only";

import type { AxiosRequestConfig } from "axios";

import { portalClient } from "@/services/identity/portal.server";

/**
 * The HTTP client the copied identity-control services call.
 *
 * <p>Those services are lifted verbatim from identity-portal-web-app, where this name resolves to
 * a plain axios wrapper pointed at the portal. Here it delegates to {@link portalClient}, which
 * does one thing that matters: it sets the `Host` for the level this request belongs to — the
 * application master for an administrator, that tenant's own for a tenant. The portal reads the
 * level off the hostname and nothing else, so routing through it is what makes a single copied
 * screen serve both levels with the same endpoint paths.
 *
 * <p>Shimmed rather than rewriting the services, so a service re-copied from the portal drops in
 * unchanged. `Authorization` is set by portalClient from the caller's session; the header the
 * services pass is harmless and simply overwritten by the same value.
 *
 * <p><b>It returns the backend envelope, not the axios response.</b> Every copied service reads
 * its result with {@code extractApiResponse(res)}, which unwraps exactly one level — so `res`
 * has to be `{status, message, data}` for `.data` to be the payload. Returning the axios
 * response instead put one wrapper too many in the way: `extractApiResponse` handed back the
 * envelope, `Array.isArray(...)` was false for it, and every list came out empty. Nothing threw
 * and nothing logged, so the Layout canvas and its component palette both rendered their
 * "nothing here yet" state against a backend that was answering 200 with the full tree.
 */
async function request<T>(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  dataOrConfig?: unknown,
  maybeConfig?: AxiosRequestConfig
): Promise<{ data: T }> {
  const client = await portalClient();
  if (method === "get" || method === "delete") {
    const res = await client.request<{ data: T }>({
      method,
      url,
      ...(dataOrConfig as AxiosRequestConfig),
    });
    return res.data;
  }
  const res = await client.request<{ data: T }>({
    method,
    url,
    data: dataOrConfig,
    ...(maybeConfig ?? {}),
  });
  return res.data;
}

export const serverApiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>("get", url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>("post", url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>("put", url, data, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>("patch", url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>("delete", url, config),
};

export default serverApiClient;
