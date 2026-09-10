import type { ClaimStatus } from "@/server/mock/types";

/**
 * Client-safe shapes and option lists for the Claim Dashboard. The data functions that read the
 * DB live in `claimDashboard.server.ts`; this file carries only what the view needs too, so a
 * `"use client"` component can import the enums and types without pulling in `server-only`.
 */

/** In-flight — submitted but not yet decided. Same set `summariseClaimOverview` counts as
 *  "Under Progress" and the Claims grid filters on, so the widgets and the band agree. */
export const IN_PROGRESS_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>(
  ["SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "DOCUMENTS_RESUBMITTED"]
);

/** The statuses the month-on-month widget can chart. "INITIATED" is not a real `ClaimStatus` —
 *  it means "the claim was created", dated from `createdAt` rather than a status-history entry. */
export type MonthlyStatusKey =
  | "INITIATED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export const MONTHLY_STATUS_OPTIONS: ReadonlyArray<{
  key: MonthlyStatusKey;
  label: string;
}> = [
  { key: "INITIATED", label: "Claim initiated" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export const MONTH_WINDOWS = [3, 6, 12] as const;
export type MonthWindow = (typeof MONTH_WINDOWS)[number];

export interface MonthlyPoint {
  /** `YYYY-MM`, oldest first. */
  month: string;
  /** Short label for the axis, e.g. "Sep". */
  label: string;
  count: number;
}

export interface LenderProgressRow {
  lenderOrgId: string;
  lenderName: string;
  inProgress: number;
  /** Every claim this lender has, in any status — the bar's context. */
  total: number;
}

export interface ClaimDashboardData {
  monthly: MonthlyPoint[];
  byLender: LenderProgressRow[];
  /** Whether this session may narrow the widgets to one lender (IMGC only). */
  canFilterByLender: boolean;
  lenders: { id: string; name: string }[];
}
