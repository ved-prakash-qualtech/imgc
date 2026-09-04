import "server-only";
import { ssrApi } from "@/services/api/ssrApi";
import { API_ENDPOINTS } from "@/config/apiEndpoints";
import type { APIResponse } from "@/types/api.types";
import type { CreateExampleInput, Example } from "@/types/example.types";

/**
 * SSR service for the example module (frontend-project-standards.md §1).
 * Server-side only — client components reach it exclusively through the
 * server actions in app/(admin)/examples/actions.ts.
 *
 * Uses ssrApi.public against this template's own stand-in route handler;
 * a real product switches to ssrApi.admin and points BACKEND_BASE_URL at
 * the QCP backend — nothing else changes.
 */
export async function fetchExamples(): Promise<Example[]> {
  const res = await ssrApi.public.get<APIResponse<Example[]>>(API_ENDPOINTS.examples.list);
  if (res.status !== "SUCCESS" || !res.data) {
    throw new Error(res.errorMessage ?? "Failed to fetch examples");
  }
  return res.data;
}

export async function createExample(input: CreateExampleInput): Promise<Example> {
  const res = await ssrApi.public.post<APIResponse<Example>>(API_ENDPOINTS.examples.list, input);
  if (res.status !== "SUCCESS" || !res.data) {
    throw new Error(res.errorMessage ?? "Failed to create example");
  }
  return res.data;
}
