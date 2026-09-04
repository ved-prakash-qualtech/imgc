import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIES,
  exchangeCode,
  loadAuthConfig,
  publicOrigin,
  rolesForAuthorizedParty,
  type TokenResponse,
} from "@/lib/auth/oidc";

/**
 * Where Keycloak sends the browser back, carrying an authorization code.
 *
 * The code is redeemed here, on the server, and the tokens land in HttpOnly cookies. The
 * browser is then redirected to where the user was originally headed — it never holds a token
 * and never sees one in a URL.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const error = params.get("error");
  if (error) {
    return signInFailed(params.get("error_description") ?? error);
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(AUTH_COOKIES.state)?.value;
  const verifier = request.cookies.get(AUTH_COOKIES.verifier)?.value;

  if (!code || !verifier) {
    return signInFailed("Sign-in did not complete — start again");
  }

  // A mismatched state is the cross-site request this parameter exists to catch: someone else's
  // authorization code arriving in this user's browser. Refuse it rather than redeem it.
  if (!state || !expectedState || state !== expectedState) {
    return signInFailed("Sign-in state did not match — start again");
  }

  let tokens: TokenResponse;
  try {
    tokens = await exchangeCode(await loadAuthConfig(), code, verifier);
  } catch (e) {
    return signInFailed(
      e instanceof Error ? e.message : "Token exchange failed"
    );
  }

  // Signing in proves the realm knows this person, not that they belong at this level. Refuse
  // the session here rather than issue one and let every screen deny them separately.
  if (rolesForAuthorizedParty(tokens.access_token).length === 0) {
    return signInFailed(
      "This account has no access to this application at this level. " +
        "Sign in on the host for the level it was granted, or ask an administrator to grant it here."
    );
  }

  const returnTo = request.cookies.get(AUTH_COOKIES.returnTo)?.value ?? "/";
  // Resolved against the browser's origin, not this server's: nextUrl.origin behind a proxy
  // is https://localhost:<port>, and sign-in would end on a host only the server can reach.
  const response = NextResponse.redirect(
    new URL(returnTo, await publicOrigin())
  );

  const session = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
  };

  // Each cookie lives exactly as long as the token in it. A fixed longer life leaves the browser
  // sending credentials the realm has already stopped accepting.
  response.cookies.set(AUTH_COOKIES.accessToken, tokens.access_token, {
    ...session,
    maxAge: tokens.expires_in ?? 300,
  });
  if (tokens.refresh_token) {
    response.cookies.set(AUTH_COOKIES.refreshToken, tokens.refresh_token, {
      ...session,
      maxAge: tokens.refresh_expires_in ?? 1800,
    });
  }
  // Kept for logout: Keycloak wants it as id_token_hint to end the session without prompting.
  if (tokens.id_token) {
    response.cookies.set(AUTH_COOKIES.idToken, tokens.id_token, {
      ...session,
      maxAge: tokens.refresh_expires_in ?? 1800,
    });
  }

  for (const name of [
    AUTH_COOKIES.verifier,
    AUTH_COOKIES.state,
    AUTH_COOKIES.returnTo,
  ]) {
    response.cookies.delete(name);
  }

  return response;
}

function signInFailed(message: string) {
  return NextResponse.json(
    { status: "ERROR", errorMessage: message },
    { status: 400 }
  );
}
