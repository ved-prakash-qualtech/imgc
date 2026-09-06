/**
 * Vocabulary for configurable document requirements.
 *
 * Plain data, shared by the IMGC "Add document requirement" form and the lender's checklist, so
 * the two can never drift into describing the same requirement differently.
 */

export const DOCUMENT_CATEGORIES = [
  "Property Document",
  "Financial Document",
  "KYC Document",
  "Legal Document",
  "Insurance Document",
  "Other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Products a requirement can be pinned to. "All products" is the default and the common case. */
export const APPLICABLE_PRODUCTS = [
  "All products",
  "Home Loan",
  "LAP",
] as const;

export const CASE_TYPES = [
  "All case types",
  "Initial Claim",
  "Final Claim",
  "Query Response",
  "Recovery",
] as const;

/** Offered as SLA shortcuts on the form; the stored value is always a concrete due date. */
export const SLA_PRESETS: ReadonlyArray<{ label: string; days: number }> = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "30 days", days: 30 },
];

export function dueDateFromSla(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Negative when the date has passed. */
export function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
