"use server";

import { requireSession } from "@/lib/auth/appSession";
import {
  buildDashboardSummary,
  type DashboardSummary,
} from "@/services/portal/dashboard.server";

/**
 * Re-runs the Dashboard's own summary for one lender (or every lender again), so the "In progress
 * claim cases" hero banner's lender dropdown can update the whole page's KPIs/widgets without a
 * navigation — same `buildDashboardSummary` the initial server render already used, just called
 * again with a narrower (or cleared) lens. `lenderOrgId: null` means "Every Lender".
 *
 * IMGC only: a lender session has no "every lender" aggregate to narrow in the first place, so the
 * filter is a no-op for that role rather than an error — the dropdown itself is never shown to a
 * lender session either (see DashboardView), this is just the defensive fallback.
 */
export async function getDashboardSummaryForLender(
  lenderOrgId: string | null
): Promise<DashboardSummary> {
  const session = await requireSession();
  if (session.role !== "IMGC") {
    return buildDashboardSummary(session);
  }
  return buildDashboardSummary(session, { lenderOrgId });
}
