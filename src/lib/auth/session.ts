import { cookies, headers } from "next/headers";

import { AUTH_COOKIES } from "@/lib/auth/oidc";
import type { HostScope } from "@/lib/tenantHost";

/**
 * Who is signed in, and in what scope — read on the server, for rendering only.
 *
 * The access token is decoded here without verifying its signature, which is safe for exactly
 * this purpose and no other: the cookie is HttpOnly and was written by our own callback route
 * after a verified code exchange, so the browser cannot have put anything else there. Nothing
 * rendered from these values grants access — every real decision is made by the backend against
 * the same token, where the signature *is* checked. Do not lift them into an authorization
 * check without verifying first.
 */

export type SessionUser = Readonly<{
  username: string;
  name: string;
  email: string | null;
  /** Two letters for the avatar. */
  initials: string;
}>;

export type SessionScope = Readonly<{
  scope: HostScope;
  /** Short code of the tenant whose workspace this is; null in admin/system scope. */
  tenant: string | null;
}>;

type JwtClaims = Readonly<{
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}>;

/** Payload of a JWT, or null if this is not one. No signature check — see the note above. */
function decodeClaims(token: string): JwtClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as JwtClaims;
  } catch {
    return null;
  }
}

function initialsOf(name: string, username: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && first && last) {
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }
  return (first ?? username).slice(0, 2).toUpperCase();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(AUTH_COOKIES.accessToken)?.value;
  if (!token) return null;

  const claims = decodeClaims(token);
  if (!claims) return null;

  const username = claims.preferred_username ?? "";
  const name =
    claims.name ??
    [claims.given_name, claims.family_name].filter(Boolean).join(" ");
  const display = (name ?? "").trim() || username;
  if (!display) return null;

  return {
    username,
    name: display,
    email: claims.email ?? null,
    initials: initialsOf(display, username),
  };
}

/**
 * Scope comes from the host, not from the token: the realm issues every account the same
 * default roles, so a token cannot distinguish an administrator from a tenant's administrator.
 * The proxy has already resolved the host and left the answer in these headers.
 */
export async function getSessionScope(): Promise<SessionScope> {
  const h = await headers();
  return {
    scope: (h.get("x-app-scope") ?? "SYSTEM") as HostScope,
    tenant: h.get("x-tenant"),
  };
}
