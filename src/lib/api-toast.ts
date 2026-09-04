"use client";

/**
 * Centralized API Toast Handler
 *
 * Provides a single utility to wrap server-action / API calls and
 * automatically display the appropriate success or error toast using
 * the backend's response message.
 *
 * Usage:
 *   try {
 *     const result = await callApi(() => createOrganization(payload));
 *     showApiSuccessToast(result.message);   // backend "message"
 *   } catch (err) {
 *     showApiErrorToast(err);                // backend "errorMessage"
 *   }
 *
 * Rules:
 *   - Mutations (POST/PUT/PATCH/DELETE): MUST be wrapped with callApi().
 *     Services wrapped with `withApiError()` resolve with an error envelope
 *     rather than rejecting, so skipping callApi() would let a failure be
 *     treated as a success.
 *   - GET requests: do NOT show a success toast. On failure call
 *     showApiErrorToast(err) directly from the catch block.
 *
 * This file is "use client" because it imports `toast` from sonner.
 */

import { toast } from "sonner";
import {
  isApiErrorEnvelope,
  type ApiErrorPayload,
  type ServiceResult,
} from "@/utils/serverActionUtils";

/**
 * Client-side Error rebuilt from a returned API error envelope.
 *
 * `message` is the backend's `errorMessage`, so the existing
 * `extractErrorMessage` path resolves it with no special-casing.
 */
export class ApiCallError extends Error {
  readonly statusCode?: number;
  readonly errorCode?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.errorMessage);
    this.name = "ApiCallError";
    this.statusCode = payload.statusCode;
    this.errorCode = payload.errorCode;
  }
}

/**
 * Unwrap a wrapped service call.
 *
 * Server Actions wrapped with `withApiError()` RESOLVE with an error envelope
 * instead of rejecting, because Next.js masks thrown Server Action errors in
 * production. This converts that envelope back into a thrown `ApiCallError`, so
 * calling components keep the ordinary shape:
 *
 * ```ts
 * try {
 *   const result = await callApi(() => createOrganization(payload));
 *   showApiSuccessToast(result.message);
 * } catch (err) {
 *   showApiErrorToast(err);
 * }
 * ```
 *
 * @throws {ApiCallError} when the action returned an error envelope.
 */
export async function callApi<T>(
  action: () => Promise<ServiceResult<T>>
): Promise<T> {
  const result = await action();
  if (isApiErrorEnvelope(result)) {
    throw new ApiCallError(result.__apiError);
  }
  return result;
}

// ─── Friendly fallbacks ───────────────────────────────────────────────────────
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_MESSAGE =
  "Unable to connect to the server. Please check your connection.";
const TIMEOUT_MESSAGE = "Request timed out. Please try again.";

/**
 * Placeholder / masked messages that carry no useful information for the user.
 * These must never be shown; they resolve to a friendly fallback instead.
 *
 * - The first two are Next.js's production masks for errors that cross the
 *   RSC / Server Action boundary.
 * - The rest are our own and Axios's generic placeholders.
 */
const OPAQUE_MESSAGES = [
  "an error occurred in the server components render",
  "an unexpected response was received from the server",
  "request failed with status code",
  "request failed",
  "an unexpected error occurred",
];

function isOpaque(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return OPAQUE_MESSAGES.some((pattern) => lower.includes(pattern));
}

/** True when a string is a serialized object/array rather than prose. */
function looksSerialized(text: string): boolean {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/**
 * Recursively search a value for the backend's `errorMessage`.
 *
 * Handles every shape our layers can produce:
 *   - `{ errorMessage }`                        raw backend error body
 *   - `{ data: { errorMessage } }`              thrown by apiRequest/serverApiRequest
 *   - `{ response: { data: { errorMessage } } }` a bare Axios error
 *   - `'{"data":{"errorMessage":"..."}}'`        serialized by the RSC boundary
 *
 * Returns `null` when no genuine backend message exists, so the caller can
 * fall back to a friendly message. Never returns a code, path or timestamp.
 */
function findBackendMessage(value: unknown, depth = 0): string | null {
  if (value === null || value === undefined || depth > 4) return null;

  if (typeof value === "string") {
    // Next.js may serialize a thrown object into a string. Parse and recurse.
    if (looksSerialized(value)) {
      try {
        return findBackendMessage(JSON.parse(value), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  // 1. The backend's own field always wins.
  const errorMessage = record.errorMessage;
  if (typeof errorMessage === "string" && errorMessage.trim()) {
    return errorMessage.trim();
  }

  // 2. Descend into known wrapper keys. Read through a Map so the fixed order is kept — it is a
  // priority order, `data` before `response` — without indexing the object by a variable, which
  // would also reach inherited keys.
  const own = new Map(Object.entries(record));
  for (const key of ["data", "response", "details", "error", "body"]) {
    const nested = findBackendMessage(own.get(key), depth + 1);
    if (nested) return nested;
  }

  // 3. A `message` field, but only if it is real prose.
  const message = record.message;
  if (typeof message === "string" && message.trim()) {
    if (looksSerialized(message)) {
      return findBackendMessage(message, depth + 1);
    }
    if (!isOpaque(message) && !message.includes("[object ")) {
      return message.trim();
    }
  }

  return null;
}

/**
 * Classify a plain message string into a user-safe message.
 * Returns `null` when the string is opaque or is a serialized object.
 */
function classifyMessage(text: string): string | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("eai_again") ||
    lower.includes("network error") ||
    lower.includes("failed to fetch")
  ) {
    return NETWORK_MESSAGE;
  }
  if (lower.includes("timeout") || lower.includes("etimedout")) {
    return TIMEOUT_MESSAGE;
  }

  if (isOpaque(text) || looksSerialized(text) || text.includes("[object ")) {
    return null;
  }

  return text.trim();
}

/**
 * Extract a user-friendly error message from any thrown API error.
 *
 * Guarantees: the returned string is always either the backend's
 * `errorMessage`, a genuine prose message, or a friendly fallback. It never
 * contains a raw object, serialized JSON, status, statusCode, errorCode, path
 * or timestamp.
 */
export function extractErrorMessage(error: unknown): string {
  if (error === null || error === undefined) return FALLBACK_MESSAGE;

  // The backend's errorMessage takes priority wherever it is nested.
  const backendMessage = findBackendMessage(error);
  if (backendMessage)
    return classifyMessage(backendMessage) ?? FALLBACK_MESSAGE;

  if (typeof error === "string") {
    return classifyMessage(error) ?? FALLBACK_MESSAGE;
  }

  // Fall back to the Error's own message (network failures land here).
  const rawMessage = (error as { message?: unknown }).message;
  if (typeof rawMessage === "string") {
    return classifyMessage(rawMessage) ?? FALLBACK_MESSAGE;
  }

  return FALLBACK_MESSAGE;
}

/**
 * Extract a success message from a backend response envelope.
 * The backend wraps successful responses in: { status: "SUCCESS", message: "...", data: ... }
 * After extractApiResponse() unwraps the data, the message is lost.
 * This helper is for raw (un-unwrapped) responses if needed.
 */
export function extractSuccessMessage(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as { message?: string; status?: string };
  if (r.status === "SUCCESS" && r.message) return r.message;
  if (r.message && !r.message.includes("retrieved")) return r.message;
  return null;
}

// ─── Toast duration ───────────────────────────────────────────────────────────
const TOAST_DURATION = 3000;

/**
 * Show a centralized error toast from an API error.
 * Use this in catch blocks where you want toast + re-throw pattern.
 */
export function showApiErrorToast(error: unknown): void {
  const message = extractErrorMessage(error);
  toast.error(message, { duration: TOAST_DURATION });
}

/**
 * Show a centralized success toast from a backend message.
 */
export function showApiSuccessToast(message: string): void {
  toast.success(message, { duration: TOAST_DURATION });
}
