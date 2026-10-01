import { NextResponse } from "next/server";
import { clearAdminContext } from "@imgc/lib/auth/adminContext";

export async function POST() {
  await clearAdminContext();
  // Relative, so the browser resolves it against the address it used (see the logout route).
  // 303: the browser follows a POST with a GET.
  return new NextResponse(null, {
    status: 303,
    headers: { location: "/claim-dashboard" },
  });
}
