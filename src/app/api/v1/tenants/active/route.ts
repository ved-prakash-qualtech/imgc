import { NextRequest, NextResponse } from "next/server";
import { DEMO_TENANTS } from "@/server/standInRegistry";
import type { APIResponse } from "@/types/api.types";

/**
 * STAND-IN active-tenants registry endpoint (mirrors the QCP super admin's
 * /api/v1/tenants/active). The backend registry remains the authority for
 * tenant resolution — this demonstrates that contract standalone.
 * Delete in a real product.
 */
export async function GET(req: NextRequest) {
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        status: "ERROR",
        statusCode: 401,
        errorCode: "QT-AUTH-401",
        errorMessage: "Missing bearer token",
        timestamp: new Date().toISOString(),
      } satisfies APIResponse<never>,
      { status: 401 },
    );
  }

  return NextResponse.json({
    status: "SUCCESS",
    statusCode: 200,
    message: "OK",
    // The registry never exposes themes beyond what the resolver needs
    data: DEMO_TENANTS.map((registryTenant) => ({
      id: registryTenant.id,
      name: registryTenant.name,
      shortCode: registryTenant.shortCode,
      defaultApiClientId: registryTenant.defaultApiClientId,
      defaultApiClientSecret: registryTenant.defaultApiClientSecret,
    })),
    timestamp: new Date().toISOString(),
  });
}
