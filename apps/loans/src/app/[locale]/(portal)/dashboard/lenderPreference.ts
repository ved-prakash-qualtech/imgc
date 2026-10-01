/**
 * Which lender IMGC last picked in the Dashboard hero banner's dropdown.
 *
 * Written by `getDashboardSummaryForLender` (actions.ts) and read back by the Dashboard page on
 * its next server render, so leaving the page and returning keeps the same lens instead of
 * silently snapping back to "Every Lender".
 *
 * Its own module rather than actions.ts because a `"use server"` file may only export async
 * functions — exporting a plain constant from one is a build error.
 *
 * Not security-bearing: `buildDashboardSummary` still scopes by the session, and this value can
 * only ever narrow an already-authorized IMGC view (and is validated against the real lender
 * list before it is used at all).
 */
export const DASHBOARD_LENDER_COOKIE = "imgc.dashboard.lender";
