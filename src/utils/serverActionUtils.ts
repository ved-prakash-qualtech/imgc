import type { ServerActionResponse } from "@/types/api.types";

/**
 * Wraps an SSR service call into a standardized server action
 * (frontend-project-standards.md §1): the client always receives
 * ServerActionResponse<T> — never a thrown error or a raw axios failure.
 */
export function createServerAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  return async (...args: TArgs): Promise<ServerActionResponse<TResult>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      // Log server-side; return only a safe message to the client
      console.error("[server-action]", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      };
    }
  };
}

/* ------------------------------------------------------------------------------------------------
 * APIResponse envelope helpers.
 *
 * Copied from identity-portal-web-app, unchanged, because the identity-control services and screens
 * copied alongside them are written against these exact signatures. Keeping the names and shapes
 * identical is what lets one of those files be re-copied from the portal without edits when it
 * changes there.
 * ---------------------------------------------------------------------------------------------- */

/**
 * Standardize response extraction from API wrapper
 */
export function extractApiResponse<T = unknown>(apiResponse: unknown): T {
  return (apiResponse as { data?: T })?.data || (apiResponse as T);
}

/**
 * Result of a mutation service call.
 * Carries the unwrapped `data` AND the backend's success `message`.
 */
export interface MutationResult<T> {
  data: T;
  message: string;
}

/**
 * Like extractApiResponse but also preserves the backend envelope `message`.
 * Use this in mutation service functions (POST/PUT/PATCH/DELETE) so
 * components can show the backend's actual success message in a toast.
 *
 * Backend envelope shape:
 *   { status: "SUCCESS", message: "Organization created successfully", data: { ... } }
 *
 * serverApiClient returns response.data (the full envelope).
 * This helper returns { data: <unwrapped>, message: <envelope message> }.
 */
export function extractMutationResponse<T>(
  apiResponse: unknown,
  fallbackMessage = "Operation completed successfully"
): MutationResult<T> {
  const envelope = apiResponse as { data?: T; message?: string } | undefined;
  return {
    data: envelope?.data ?? (apiResponse as T),
    message: envelope?.message ?? fallbackMessage,
  };
}

// ─── API error propagation across the Server Action boundary ──────────────────
//
// WHY THIS EXISTS
//
// Every `*.service.ts` module is `"use server"`. When a Server Action *throws*,
// Next.js does not hand the real error to the client:
//   - non-standard own-properties (statusCode, data) are stripped, and
//   - in production builds React's Flight client calls `resolveErrorProd()`,
//     which replaces the message entirely with a generic string.
//
// So a thrown error can never carry the backend's `errorMessage` to the UI in
// production. The fix is to stop throwing across the boundary: we catch inside
// the action and *return* a plain, serializable error envelope. Return values
// are ordinary RSC data and are never masked.
//
// The client re-throws it via `callApi()` in `lib/api-toast.ts`, so components
// keep their familiar `try { ... } catch { showApiErrorToast(err) }` shape.

/** Discriminant key identifying a returned API error envelope. */
export const API_ERROR_KEY = "__apiError" as const;

/** User-facing error detail extracted from the backend response. */
export interface ApiErrorPayload {
  /** The backend's `errorMessage`, or a friendly fallback. */
  errorMessage: string;
  statusCode?: number;
  errorCode?: string;
}

/** A resolved value signalling that the API call failed. */
export interface ApiErrorEnvelope {
  [API_ERROR_KEY]: ApiErrorPayload;
}

/**
 * What a wrapped service function resolves to: either the successful value or
 * an error envelope. Never rejects for API errors.
 */
export type ServiceResult<T> = T | ApiErrorEnvelope;

/** Type guard for the error envelope. Safe to call on any value. */
export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== "object") return false;
  // Read as an own entry rather than indexed by the key constant: the value being tested comes
  // off the wire, and an inherited property must not be able to pass for the envelope.
  const candidate = new Map(
    Object.entries(value as Record<string, unknown>)
  ).get(API_ERROR_KEY);
  return (
    !!candidate &&
    typeof candidate === "object" &&
    typeof (candidate as ApiErrorPayload).errorMessage === "string"
  );
}

/**
 * Build a serializable payload from a thrown value.
 *
 * This runs INSIDE the server action, where the error thrown by
 * `serverApiRequest` still has its `data` property intact, so the backend's
 * `errorMessage` / `errorCode` / `statusCode` are all still reachable.
 */
export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  const err = error as {
    message?: unknown;
    statusCode?: unknown;
    data?: {
      errorMessage?: unknown;
      message?: unknown;
      errorCode?: unknown;
      statusCode?: unknown;
    } | null;
  };

  const body = err?.data ?? null;

  const fromBody =
    typeof body?.errorMessage === "string" && body.errorMessage.trim()
      ? body.errorMessage.trim()
      : typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : null;

  const fromError =
    typeof err?.message === "string" && err.message.trim()
      ? err.message.trim()
      : null;

  return {
    errorMessage: fromBody ?? fromError ?? "Request failed",
    statusCode:
      typeof err?.statusCode === "number"
        ? err.statusCode
        : typeof body?.statusCode === "number"
          ? body.statusCode
          : undefined,
    errorCode: typeof body?.errorCode === "string" ? body.errorCode : undefined,
  };
}

/**
 * Wrap the body of a mutation service function so API failures are RETURNED as
 * a serializable envelope instead of thrown across the RSC boundary.
 *
 * @example
 * export async function createOrganization(payload: CreateOrganizationPayload) {
 *   return withApiError(async () => {
 *     const auth = await getAuthHeader();
 *     const res = await serverApiClient.post(ENDPOINT, payload, { headers: { Authorization: auth } });
 *     return extractMutationResponse<OrganizationApiResponse>(res);
 *   });
 * }
 */
export async function withApiError<T>(
  operation: () => Promise<T>
): Promise<ServiceResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return { [API_ERROR_KEY]: toApiErrorPayload(error) };
  }
}
