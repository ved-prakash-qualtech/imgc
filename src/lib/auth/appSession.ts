import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Role } from "@/server/mock/types";
import { ROUTES } from "@/constants/route";

/**
 * IMGC Lender Portal session.
 *
 * A small signed JSON cookie — the template's Keycloak flow is replaced for this prototype.
 * Signed with HMAC-SHA256 via Web Crypto so the same verify runs in the edge proxy and in
 * server components. Scope (role + lender org) is decided at sign-in from the identity itself:
 * IMGC staff by Employee ID, lender users by the domain of their verified email.
 */

export const SESSION_COOKIE = "imgc_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface AppSession {
  userId: string;
  role: Role;
  name: string;
  email: string;
  /** Lender sessions only — the single source of account scoping. */
  lenderOrgId?: string;
  lenderDomain?: string;
  issuedAt: number;
}

/** For the shared `AppNavbar`, which expects the base template's `SessionUser` shape. */
export interface SessionUser {
  username: string;
  name: string;
  email: string | null;
  initials: string;
}

const DEV_FALLBACK_SECRET = "imgc-local-dev-session-secret";

/**
 * The key session cookies are signed with.
 *
 * A fixed fallback keeps local dev running with no `.env`, and that fallback is in the source —
 * so anyone could forge a session cookie against it. Outside development that is not a weak
 * default, it is no authentication at all, so a deployment without `SESSION_SECRET` refuses to
 * issue or accept sessions rather than quietly accepting forged ones.
 */
function secret(): string {
  // Server secret, not a public/app env value — read directly rather than via the `env`
  // singleton, which only carries NEXT_PUBLIC_* and build flags.
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Refusing to sign session cookies with the development fallback."
    );
  }
  return DEV_FALLBACK_SECRET;
}

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns an ArrayBuffer-backed view — what Web Crypto's `BufferSource` parameters require. */
function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const bin = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(session: AppSession): Promise<string> {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<AppSession | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig),
      new TextEncoder().encode(payload)
    );
    if (!ok) return null;
    const session = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload))
    ) as AppSession;
    if (!session.userId || !session.role) return null;
    return session;
  } catch {
    return null;
  }
}

/* ── server component / action helpers ─────────────────────────────── */

export async function createSession(
  session: Omit<AppSession, "issuedAt">
): Promise<void> {
  const token = await signSession({ ...session, issuedAt: Date.now() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionOrNull(): Promise<AppSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Use in every portal server component/page. Redirects to sign-in when there is no session. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSessionOrNull();
  if (!session) redirect(ROUTES.login);
  return session;
}

export function toSessionUser(session: AppSession): SessionUser {
  const parts = session.name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
      : session.name.slice(0, 2).toUpperCase();
  return {
    username: session.email,
    name: session.name,
    email: session.email,
    initials,
  };
}
