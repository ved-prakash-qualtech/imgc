import type { ClaimStatus } from "@/server/mock/types";

/**
 * Who holds a claim at each status — the Owner column and Owner filter on both the lender's and
 * IMGC's grids read this, so the two sides always agree. Derived from the status alone:
 *
 *   Not started, Draft, Query Initiated, Query Under Review → Lender
 *   Initiated, Under Review, Approved, Rejected             → IMGC
 */
export function ownerForStatus(
  status: ClaimStatus | "NOT_STARTED"
): "LENDER" | "IMGC" {
  switch (status) {
    case "NOT_STARTED":
    case "DRAFT":
    case "QUERY_INITIATED":
    case "QUERY_UNDER_REVIEW":
    case "QUERY_RAISED":
    case "QUERIED":
      return "LENDER";
    default:
      return "IMGC";
  }
}
