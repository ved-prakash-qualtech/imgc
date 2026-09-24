import "server-only";
import { cookies } from "next/headers";
import { getSessionOrNull } from "@/lib/auth/appSession";

const ADMIN_CONTEXT_COOKIE = "imgc_admin_context";

// 8 hours
const MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AdminContext {
  lenderOrgId: string;
  issuedAt: number;
}

const DEV_FALLBACK_SECRET = "fallback-development-secret-only";

function secret(): string {
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

export async function signAdminContext(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifyAdminContextToken(
  token: string | undefined | null
): Promise<AdminContext | null> {
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
    const ctx = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload))
    ) as AdminContext;
    if (!ctx.lenderOrgId) return null;
    return ctx;
  } catch {
    return null;
  }
}

export async function setAdminContext(lenderOrgId: string): Promise<void> {
  const ctx: AdminContext = { lenderOrgId, issuedAt: Date.now() };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(ctx)));
  const token = await signAdminContext(payload);
  (await cookies()).set(ADMIN_CONTEXT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminContext(): Promise<void> {
  (await cookies()).delete(ADMIN_CONTEXT_COOKIE);
}

/**
 * Returns the currently active Admin Context (the selected lenderOrgId) IF AND ONLY IF:
 * 1. The session is valid.
 * 2. The user is an IMGC Admin (`role === "IMGC" && isAdmin === true`).
 * 3. The context cookie is present, valid, and successfully verified.
 */
export async function getAdminContextOrNull(): Promise<AdminContext | null> {
  const session = await getSessionOrNull();
  if (!session || session.role !== "IMGC" || !session.isAdmin) return null;

  const token = (await cookies()).get(ADMIN_CONTEXT_COOKIE)?.value;
  return verifyAdminContextToken(token);
}
