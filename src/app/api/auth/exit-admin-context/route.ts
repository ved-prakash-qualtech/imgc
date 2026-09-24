import { NextResponse, type NextRequest } from "next/server";
import { clearAdminContext } from "@/lib/auth/adminContext";

export async function POST(request: NextRequest) {
  await clearAdminContext();
  return NextResponse.redirect(
    new URL("/claim-dashboard", request.nextUrl.origin)
  );
}
