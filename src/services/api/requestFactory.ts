import type { AxiosInstance } from "axios";

/**
 * Typed request-handler factory (frontend-project-standards.md §2).
 * Builds GET/POST/PUT/DELETE handlers on top of a lazily created axios
 * instance; auth headers are injected by the instance provider (ssrApi).
 * 401s surface as errors and are handled centrally by the server-action layer.
 */
export function createRequestHandlers(getClient: () => Promise<AxiosInstance>) {
  return {
    get: async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
      const client = await getClient();
      const res = await client.get<T>(url, { params });
      return res.data;
    },
    post: async <T>(url: string, body?: unknown): Promise<T> => {
      const client = await getClient();
      const res = await client.post<T>(url, body);
      return res.data;
    },
    put: async <T>(url: string, body?: unknown): Promise<T> => {
      const client = await getClient();
      const res = await client.put<T>(url, body);
      return res.data;
    },
    del: async <T>(url: string): Promise<T> => {
      const client = await getClient();
      const res = await client.delete<T>(url);
      return res.data;
    },
  };
}
