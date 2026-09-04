import "server-only";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/serverEnv";

/**
 * OpenID Connect against the backend's realm — the whole flow, server side.
 *
 * The browser is never given a token. It is redirected to Keycloak, comes back with an
 * authorization code, and this exchanges that code from the server and puts the tokens in
 * HttpOnly cookies. A single-page app doing the exchange in JavaScript has to keep the result
 * somewhere JavaScript can read, which means any script on the page can read it too; here
 * nothing on the page can. It also matches how the rest of this template already works —
 * `ssrApi` reads an HttpOnly `accessToken` cookie and services run on the server.
 *
 * The PKCE verifier is held the same way, so it is never exposed to the page that will carry
 * the code back.
 */

/** Where Keycloak sends the browser after login. Must match the client's redirect URI. */
export const CALLBACK_PATH = "/api/auth/callback";

export const AUTH_COOKIES = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  idToken: "idToken",
  /** PKCE + CSRF, alive only for the round trip to Keycloak. */
  verifier: "oidcVerifier",
  state: "oidcState",
  returnTo: "oidcReturnTo",
} as const;

export interface AuthConfig {
  issuer: string | null;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  endSessionEndpoint: string | null;
  clientId: string | null;
  configured: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
}

/** Raised when Keycloak is not wired up, so callers can say so rather than redirect nowhere. */
export class AuthConfigError extends Error {}

/**
 * Ask the backend which realm and client this host signs into.
 *
 * Discovered, not configured. Both answers depend on the Host, and one realm may serve many
 * tenants — so a build-time issuer would send a tenant to a login page where their account does
 * not exist, and a build-time client id would name a client that is not in their realm. The
 * backend already resolves both; asking it keeps one bundle correct everywhere.
 *
 * Not cached across requests on purpose: this process serves every tenant, and a cache keyed on
 * nothing would answer the second tenant with the first tenant's realm.
 */
export async function loadAuthConfig(): Promise<AuthConfig> {
  const incoming = await headers();
  const host = incoming.get("host");
  const base = (await getServerEnv()).backendBaseUrl.replace(/\/+$/, "");

  const res = await fetch(`${base}/api/v1/auth/config`, {
    // The backend resolves realm and client from this, so it has to be the browser's host,
    // not this server's.
    headers: host ? { Host: host, "X-Forwarded-Host": host } : {},
    cache: "no-store",
  });

  if (!res.ok) {
    throw new AuthConfigError(`Auth config request failed (${res.status})`);
  }

  const body = (await res.json()) as { data?: AuthConfig };
  const config = body.data;
  if (
    !config?.configured ||
    !config.authorizationEndpoint ||
    !config.clientId
  ) {
    throw new AuthConfigError(
      "Keycloak is not configured for this environment"
    );
  }
  return config;
}

/**
 * The origin the browser actually used.
 *
 * Not `request.nextUrl.origin`, which is this server's — behind a proxy that is
 * `https://localhost:3002`, and every absolute URL built from it sends the browser to a host
 * only the server can reach. The forwarded headers are the browser's view: the proxy sets
 * `x-forwarded-host` because Host does not always survive the hop, and `x-forwarded-proto`
 * because TLS ends at the proxy, so the app sees a plain-HTTP connection for an https site.
 */
export async function publicOrigin(): Promise<string> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (!forwarded) {
    // No Host at all is not a situation to paper over with a default: every URL built from it
    // would point somewhere arbitrary, and the sign-in would fail somewhere further away.
    throw new AuthConfigError(
      "Request carried no Host header, so no redirect URI can be built"
    );
  }
  const proto = incoming.get("x-forwarded-proto") ?? "https";
  // A chain of proxies appends; the first entry is the browser's.
  const host = forwarded.split(",")[0]?.trim() ?? forwarded.trim();
  return `${proto}://${host}`;
}

/** The redirect URI registered for this console, derived from the host that asked. */
export async function redirectUri(): Promise<string> {
  return `${await publicOrigin()}${CALLBACK_PATH}`;
}

/* ---------- PKCE ---------- */

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomString(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

/* ---------- token exchange ---------- */

/**
 * Redeem the authorization code.
 *
 * No client secret: the console is a public client, and PKCE is what proves the caller is the
 * one that began the flow. Sending a secret from here would work, but it would mean every
 * deployment needs one provisioned and rotated for no gain over the verifier.
 */
export async function exchangeCode(
  config: AuthConfig,
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const res = await fetch(config.tokenEndpoint!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: await redirectUri(),
      client_id: config.clientId!,
      code_verifier: verifier,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${await res.text()}`
    );
  }
  return (await res.json()) as TokenResponse;
}

/** Trade the refresh token for a new access token, or null when the realm refuses. */
export async function refreshTokens(
  config: AuthConfig,
  refreshToken: string
): Promise<TokenResponse | null> {
  const res = await fetch(config.tokenEndpoint!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId!,
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });

  return res.ok ? ((await res.json()) as TokenResponse) : null;
}

/**
 * The roles the access token carries for the client it was minted for.
 *
 * <p>One Keycloak realm serves the whole platform tenant, so the realm authenticates a person
 * without saying anything about which level they belong to: Keycloak will mint a token from a
 * public client for any valid realm user, and a role appears in `resource_access` only if it is
 * held. An application tenant's administrator can therefore complete a sign-in at the application
 * master's host, and until this was checked they did — landing on a console where every screen
 * refused them one at a time.
 *
 * `azp` is the client this console asked for the token, which is the client for the level its
 * host serves. No roles there means no business here.
 *
 * The payload is read, not verified. It arrived over TLS from the token endpoint in a server-side
 * exchange moments ago, and every call it is later used for is verified by the service that
 * receives it. This decides which door to open, not whether to trust the token.
 */
export function rolesForAuthorizedParty(accessToken: string): string[] {
  const payload = accessToken.split(".")[1];
  if (!payload) return [];
  try {
    const claims = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8")
    ) as {
      azp?: string;
      resource_access?: Record<string, { roles?: string[] }>;
    };
    const azp = claims.azp;
    if (!azp) return [];
    // Found by entry rather than indexed by key: a dynamic index into an object is the shape
    // security/detect-object-injection refuses, and this reads the same.
    const granted = Object.entries(claims.resource_access ?? {}).find(
      ([client]) => client === azp
    );
    return granted?.[1]?.roles ?? [];
  } catch {
    return [];
  }
}
