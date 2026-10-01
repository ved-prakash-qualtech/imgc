import { NextResponse, type NextRequest } from "next/server";

/**
 * The landing point of a redirect that crosses from one zone into another — see
 * `redirectTo` in packages/lib/zoneRedirect.ts.
 *
 * It exists only to be a route handler. When a server action or page redirects here, the client
 * router fetches it expecting a page payload; this answers with something that is not one, so the
 * router gives up on a soft navigation and loads the same URL as an ordinary page. That second,
 * real request is the one answered with the redirect to the destination.
 *
 * (Redirecting the router's own request would not do: `fetch` follows it, and the router would be
 * handed the other zone's page payload to render with this zone's code.)
 *
 * Only a path on this site is accepted — never a full URL — so it cannot be turned into an open
 * redirect.
 */
export function GET(request: NextRequest) {
  // The client router marks its page-payload requests with the RSC header.
  if (request.headers.get("rsc")) {
    return new NextResponse("", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const to = request.nextUrl.searchParams.get("to") ?? "";
  const safe = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\");
  // A relative Location, resolved by the browser against the address it used.
  return new NextResponse(null, {
    status: 307,
    headers: { location: safe ? to : "/" },
  });
}
