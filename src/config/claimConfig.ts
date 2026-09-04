import type { ClaimStatus, ClaimTypeKey } from "@/server/mock/types";

/**
 * The claim engine's configuration.
 *
 * Every claim type declares its own fields, document checklist and status flow here, and the
 * form, the checklist, the validation and the timeline all read from this one place. That is
 * what keeps a new claim type from needing a new page — and it is why no component below should
 * ever branch on `claimType` itself.
 */

export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "currency";

export interface ClaimField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** For `select` only. */
  options?: readonly string[];
}

export interface ClaimDocumentSpec {
  name: string;
  category: string;
  required: boolean;
  description?: string;
}

export interface ClaimTypeConfig {
  key: ClaimTypeKey;
  label: string;
  description: string;
  /** Prefix for the generated claim number, e.g. CLM → CLM-2026-00125. */
  prefix: string;
  fields: readonly ClaimField[];
  documents: readonly ClaimDocumentSpec[];
  /** The happy path, in order. The timeline renders this; branches sit outside it. */
  statusFlow: readonly ClaimStatus[];
}

/** Shared by every type — the timeline's spine. */
const STANDARD_FLOW: readonly ClaimStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "CLOSED",
];

const COMMON_FIELDS: readonly ClaimField[] = [
  {
    id: "npaDate",
    label: "NPA date",
    type: "date",
    required: true,
    helpText: "Date the account was classified as non-performing.",
  },
  {
    id: "claimAmount",
    label: "Claim amount",
    type: "currency",
    required: true,
    placeholder: "e.g. 2400000",
  },
  {
    id: "recoveryToDate",
    label: "Recovery to date",
    type: "currency",
    required: false,
    placeholder: "e.g. 150000",
  },
  {
    id: "contactPerson",
    label: "Lender contact person",
    type: "text",
    required: true,
    placeholder: "Who IMGC should speak to about this claim",
  },
  {
    id: "remarks",
    label: "Remarks",
    type: "textarea",
    required: false,
    placeholder: "Anything IMGC should know before reviewing.",
  },
];

export const CLAIM_TYPES: Readonly<Record<ClaimTypeKey, ClaimTypeConfig>> = {
  INITIAL: {
    key: "INITIAL",
    label: "Initial Claim",
    description:
      "First intimation of default. Establishes the claim and the documents IMGC needs to begin.",
    prefix: "CLM",
    fields: [
      ...COMMON_FIELDS,
      {
        id: "defaultReason",
        label: "Reason for default",
        type: "select",
        required: true,
        options: [
          "Loss of employment",
          "Business failure",
          "Medical hardship",
          "Death of borrower",
          "Wilful default",
          "Other",
        ],
      },
      {
        id: "lastEmiDate",
        label: "Last EMI received on",
        type: "date",
        required: true,
      },
    ],
    documents: [
      { name: "Claim Intimation Form", category: "Legal Document", required: true, description: "Signed intimation on lender letterhead." },
      { name: "Loan Account Statement", category: "Financial Document", required: true, description: "Full statement from disbursement to date." },
      { name: "NPA Declaration", category: "Financial Document", required: true, description: "Board or committee note classifying the account." },
      { name: "Legal / Recall Notice", category: "Legal Document", required: true, description: "Notice served on the borrower." },
      { name: "Borrower KYC Documents", category: "KYC Document", required: true },
      { name: "Property Valuation Report", category: "Property Document", required: false },
    ],
    statusFlow: STANDARD_FLOW,
  },

  SETTLEMENT: {
    key: "SETTLEMENT",
    label: "Settlement Claim",
    description:
      "Claim for the shortfall after a negotiated settlement with the borrower.",
    prefix: "CLS",
    fields: [
      ...COMMON_FIELDS,
      {
        id: "settlementAmount",
        label: "Settlement amount agreed",
        type: "currency",
        required: true,
      },
      {
        id: "settlementDate",
        label: "Settlement date",
        type: "date",
        required: true,
      },
      {
        id: "shortfall",
        label: "Shortfall claimed",
        type: "currency",
        required: true,
        helpText: "Outstanding less the settlement amount and any recovery.",
      },
    ],
    documents: [
      { name: "Claim Intimation Form", category: "Legal Document", required: true },
      { name: "Settlement Agreement", category: "Legal Document", required: true, description: "Executed agreement, signed by both parties." },
      { name: "Loan Account Statement", category: "Financial Document", required: true },
      { name: "Recovery Proof", category: "Financial Document", required: true, description: "Bank credit evidencing the settlement receipt." },
      { name: "Borrower KYC Documents", category: "KYC Document", required: true },
      { name: "No Dues Certificate", category: "Legal Document", required: false },
    ],
    statusFlow: STANDARD_FLOW,
  },

  AUCTION: {
    key: "AUCTION",
    label: "Auction Claim",
    description:
      "Claim for the shortfall remaining after the secured property has been auctioned.",
    prefix: "CLA",
    fields: [
      ...COMMON_FIELDS,
      {
        id: "auctionDate",
        label: "Auction date",
        type: "date",
        required: true,
      },
      {
        id: "reservePrice",
        label: "Reserve price",
        type: "currency",
        required: true,
      },
      {
        id: "realisedAmount",
        label: "Amount realised",
        type: "currency",
        required: true,
      },
      {
        id: "possessionType",
        label: "Possession type",
        type: "select",
        required: true,
        options: ["Symbolic possession", "Physical possession"],
      },
    ],
    documents: [
      { name: "Claim Intimation Form", category: "Legal Document", required: true },
      { name: "SARFAESI Notice", category: "Legal Document", required: true, description: "Section 13(2) and 13(4) notices." },
      { name: "Possession Letter", category: "Legal Document", required: true },
      { name: "Auction Notice", category: "Legal Document", required: true, description: "Published notice with date and reserve price." },
      { name: "Sale Certificate", category: "Property Document", required: true },
      { name: "Loan Account Statement", category: "Financial Document", required: true },
      { name: "Property Valuation Report", category: "Property Document", required: false },
    ],
    statusFlow: STANDARD_FLOW,
  },
};

export const CLAIM_TYPE_KEYS = Object.keys(CLAIM_TYPES) as ClaimTypeKey[];

export function claimConfig(type: ClaimTypeKey): ClaimTypeConfig {
  return CLAIM_TYPES[type];
}

/* ── status presentation ───────────────────────────────────────────── */

export const CLAIM_STATUS_LABELS: Readonly<Record<ClaimStatus, string>> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  QUERY_RAISED: "Query raised",
  DOCUMENTS_RESUBMITTED: "Documents resubmitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  QUERIED: "Queried",
};

/** Statuses the lender can still act on — used to decide what the grid offers. */
export const LENDER_ACTIONABLE: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  "DRAFT",
  "QUERY_RAISED",
]);

/** Terminal statuses — nothing further happens to the claim. */
export const TERMINAL_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  "APPROVED",
  "REJECTED",
  "CLOSED",
]);

/**
 * Where a claim sits on its configured flow, for the timeline.
 *
 * A branch status (query raised, resubmitted, rejected) is not on the happy path, so it reports
 * the last mainline step reached rather than falling off the end of the timeline.
 */
export function flowPosition(
  type: ClaimTypeKey,
  status: ClaimStatus
): { flow: readonly ClaimStatus[]; index: number } {
  const flow = claimConfig(type).statusFlow;
  const direct = flow.indexOf(status);
  if (direct !== -1) return { flow, index: direct };

  const fallback: Partial<Record<ClaimStatus, ClaimStatus>> = {
    QUERY_RAISED: "UNDER_REVIEW",
    DOCUMENTS_RESUBMITTED: "UNDER_REVIEW",
    REJECTED: "UNDER_REVIEW",
    QUERIED: "UNDER_REVIEW",
  };
  const anchor = fallback[status];
  return { flow, index: anchor ? flow.indexOf(anchor) : 0 };
}
