/**
 * Shared server-only auth header utility for identity-control services.
 * Import this in "use server" service files instead of duplicating the logic.
 */

import { cookies } from "next/headers";

/**
 * Read auth header server-side — works for both httpOnly and regular cookies.
 * Throws if accessToken cookie is absent.
 */
export async function getAuthHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  const tokenType = store.get("tokenType")?.value ?? "Bearer";
  if (!token) throw new Error("Authentication required");
  return `${tokenType} ${token}`;
}
