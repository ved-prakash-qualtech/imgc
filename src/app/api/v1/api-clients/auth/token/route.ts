import { NextRequest, NextResponse } from "next/server";
import type { APIResponse } from "@/types/api.types";

/**
 * STAND-IN super-admin token endpoint (mirrors the QCP backend's
 * /api/v1/api-clients/auth/token) so the template runs standalone.
 * Delete in a real product — the real super admin issues Keycloak-backed
 * client_credentials tokens (keycloak-and-identity-setup.md).
 */
export async function POST(req: NextRequest) {
  const clientId = req.headers.get("x-client-id");
  const clientSecret = req.headers.get("x-client-secret");

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        status: "ERROR",
        statusCode: 401,
        errorCode: "QT-AUTH-401",
        errorMessage: "Missing client credentials",
        timestamp: new Date().toISOString(),
      } satisfies APIResponse<never>,
      { status: 401 },
    );
  }

  return NextResponse.json({
    status: "SUCCESS",
    statusCode: 200,
    message: "Token generated successfully",
    data: {
      type: "Bearer",
      accessToken: "stand-in-token-" + Buffer.from(clientId).toString("base64url"),
      accessTokenExpiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    },
    timestamp: new Date().toISOString(),
  } satisfies APIResponse<{ type: string; accessToken: string; accessTokenExpiresAt: string }>);
}
