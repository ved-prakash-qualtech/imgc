import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIES,
  AuthConfigError,
  challengeFor,
  loadAuthConfig,
  randomString,
  redirectUri,
} from "@/lib/auth/oidc";

/**
 * Start the sign-in: send the browser to Keycloak.
 *
 * A GET, so it can be an ordinary link or a redirect target — nothing here needs JavaScript,
 * and the page that eventually carries the authorization code back never sees the verifier.
 *
 * `?returnTo=` remembers where the user was headed, so the callback can put them back rather
 * than dropping everyone on the same landing page.
 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/";

  let config;
  try {
    config = await loadAuthConfig();
  } catch (error) {
    if (error instanceof AuthConfigError) {
      // Deliberately not a redirect to the login page: that would bounce forever against a
      // realm that does not exist. Say what is wrong instead.
      return NextResponse.json(
        { status: "ERROR", errorMessage: error.message },
        { status: 503 }
      );
    }
    throw error;
  }

  const verifier = randomString();
  const state = randomString(16);

  const authorizeUrl = new URL(config.authorizationEndpoint!);
  authorizeUrl.searchParams.set("client_id", config.clientId!);
  authorizeUrl.searchParams.set("redirect_uri", await redirectUri());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", await challengeFor(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);

  // HttpOnly, and only for the round trip. The verifier is the proof that whoever returns with
  // the code is who left with the request; a page script able to read it could hand both to
  // somewhere else.
  const roundTrip = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  response.cookies.set(AUTH_COOKIES.verifier, verifier, roundTrip);
  response.cookies.set(AUTH_COOKIES.state, state, roundTrip);
  response.cookies.set(AUTH_COOKIES.returnTo, returnTo, roundTrip);

  return response;
}
