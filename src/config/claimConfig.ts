/* eslint-disable security/detect-object-injection */
import type { ClaimStatus, ClaimTypeKey } from "@/server/mock/types";

/**
 * The claim engine's configuration.
 *
 * Every claim type declares its own fields, document checklist and status flow here, and the
 * form, the checklist, the validation and the timeline all read from this one place. That is
 * what keeps a new claim type from needing a new page — and it is why no component below should
 * ever branch on `claimType` itself.
 */

export type FieldType =
  "text" | "number" | "date" | "select" | "textarea" | "currency";

/** Shows/requires a field only when another field on the same claim already holds a value. */
export interface FieldCondition {
  field: string;
  operator: "equals";
  value: string;
}

export interface ClaimField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** For `select` only. */
  options?: readonly string[];
  /** Groups the field under a heading in the form. Fields with no section come first. */
  section?: string;
  /**
   * When present, the field is only shown — and only counted against `required` — once this
   * condition holds against the claim's other field values. Absent ⇒ always shown.
   */
  visibleWhen?: FieldCondition;
}

/** Evaluate a field's visibility condition against the claim's current field values. */
export function fieldVisible(
  field: ClaimField,
  values: Record<string, string>
): boolean {
  if (!field.visibleWhen) return true;
  const { field: dep, operator, value } = field.visibleWhen;
  const actual = values[dep] ?? "";
  if (operator === "equals") return actual === value;
  return true;
}

/** A configuration-driven rule that decides whether a document is mandatory. */
export interface DocCondition {
  field: string;
  operator: "equals";
  value: string;
}

export interface ClaimDocumentSpec {
  /** Stable config id, e.g. "lod". */
  slug: string;
  name: string;
  category: string;
  required: boolean;
  description?: string;
  /** This category holds several files rather than one. */
  multiple?: boolean;
  /**
   * When present, the document is only mandatory if the rule evaluates true against the loan
   * data. Never inline this test in the UI — the evaluator and the reason text live here.
   */
  condition?: DocCondition;
}

/** Evaluate a document condition against the loan record. Absent condition ⇒ always applies. */
export function docConditionMet(
  condition: DocCondition | undefined,
  loan: Record<string, unknown>
): boolean {
  if (!condition) return true;
  const actual = String(loan[condition.field] ?? "");
  if (condition.operator === "equals") return actual === condition.value;
  return true;
}

/** Human sentence for a conditional document, shown as helper text. */
export function conditionReason(condition: DocCondition): string {
  if (
    condition.field === "propertyStatusAtDisbursal" &&
    condition.value === "UNDER_CONSTRUCTION"
  ) {
    return "Required only when the property was under construction at the time of disbursal.";
  }
  return `Required only when ${condition.field} is ${condition.value}.`;
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

/** Shared by every claim type — the claim-level data-entry fields above the checklist. */
const CLAIM_PROGRAM_FIELDS: readonly ClaimField[] = [];

export const CLAIM_TYPES: Readonly<Record<ClaimTypeKey, ClaimTypeConfig>> = {
  INITIAL: {
    key: "INITIAL",
    label: "Initial Claim",
    description:
      "First intimation of default. Establishes the claim and the documents IMGC needs to begin.",
    prefix: "CLM",
    fields: CLAIM_PROGRAM_FIELDS,
    // The five predefined claim-initiation document categories. Rendered dynamically from here.
    documents: [
      {
        slug: "lod",
        name: "Property Documents",
        category: "Property Document",
        description:
          "Property papers — sale deed, title documents and related set.",
        required: true,
        multiple: true,
      },
      {
        slug: "legal-collection-feedback",
        name: "Legal & Collection Feedback",
        category: "Legal Document",
        description:
          "Latest legal opinion and collections feedback on the account.",
        required: true,
        multiple: true,
      },
      {
        slug: "origination-field-investigation",
        name: "Origination Field Investigation",
        category: "Legal Document",
        description: "FI report captured at loan origination.",
        required: true,
        multiple: true,
      },
      {
        slug: "latest-technical-report",
        name: "Latest Technical Report",
        category: "Property Document",
        description: "Current technical / valuation report for the property.",
        required: true,
        multiple: true,
        condition: {
          field: "propertyStatusAtDisbursal",
          operator: "equals",
          value: "UNDER_CONSTRUCTION",
        },
      },
      {
        slug: "income-banking",
        name: "Income & Banking of Borrowers",
        category: "Financial Document",
        description: "Bank statements and income proofs for every borrower.",
        required: true,
        multiple: true,
      },
    ],
    statusFlow: STANDARD_FLOW,
  },

  SUBSEQUENT: {
    key: "SUBSEQUENT",
    label: "Subsequent Claim",
    description:
      "Final claim for the net loss once recovery is complete — after settlement, auction or legal recovery.",
    prefix: "SUB",
    fields: CLAIM_PROGRAM_FIELDS,
    documents: [
      {
        slug: "subsequent-claim-form",
        name: "Subsequent Claim Form",
        category: "Legal Document",
        required: true,
      },
      {
        slug: "recovery-closure-report",
        name: "Recovery Closure Report",
        category: "Legal Document",
        required: true,
        description:
          "Settlement deed, sale certificate or DRT order evidencing closure.",
      },
      {
        slug: "loan-account-statement",
        name: "Loan Account Statement",
        category: "Financial Document",
        required: true,
        description: "Statement showing every recovery credited.",
      },
      {
        slug: "recovery-proof",
        name: "Recovery Proof",
        category: "Financial Document",
        required: true,
        multiple: true,
        description: "Bank credits for each recovery received.",
      },
      {
        slug: "borrower-kyc",
        name: "Borrower KYC Documents",
        category: "KYC Document",
        required: true,
      },
      {
        slug: "final-loss-certificate",
        name: "Final Loss Certificate",
        category: "Legal Document",
        required: true,
        description: "Lender's certification of the net unrecovered amount.",
      },
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
  ACTIVE: "Active",
};

/** Statuses that still route the grid's left action to the Initiate Claim workspace.
 *
 * A query response has its own composer inside Track Claim (`QueryResponseSection` — reply text
 * plus document attachments, same upload widget), so a raised query is a "go track it" moment,
 * not a "go initiate it" one — only a still-unsubmitted draft is. */
export const LENDER_ACTIONABLE: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>(
  ["DRAFT"]
);

/** Terminal statuses — nothing further happens to the claim. */
export const TERMINAL_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>(
  ["APPROVED", "REJECTED", "CLOSED"]
);

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

/**
 * Translate a claim's status into the vocabulary `Account.claimStatus` uses.
 *
 * The two entities name the same event differently: the claim says `QUERY_RAISED`, the account
 * says `QUERIED` (see the note on `ClaimStatus` — the account field predates the Claim entity
 * and kept its own word). Everything that copies a claim status onto an account goes through
 * here.
 *
 * It exists because the seed applied this mapping and `advance()` did not, so any claim that hit
 * a query at runtime wrote `QUERY_RAISED` onto its account — a value no account-side reader
 * matches. Those accounts then dropped out of the Claims grid's "Under progress" filter and out
 * of the Dashboard's "Queried" count, while the Claims Overview band, which reads the claim
 * itself, still counted them. That was the gap between the tile and the table.
 */
export function toAccountClaimStatus(status: ClaimStatus): ClaimStatus {
  return status === "QUERY_RAISED" ? "QUERIED" : status;
}
