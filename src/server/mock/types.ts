/**
 * IMGC Lender Portal — mock domain model.
 *
 * These types describe the shape of `.data/imgc-db.json`, the prototype's stand-in for the QCP
 * backends + PAS. A real build replaces `src/server/mock/*` with service calls; the types here
 * are intentionally close to what those services would return.
 */

export type Role = "IMGC" | "LENDER";

export type Bucket = "IMGC" | "LENDER";

/**
 * The claim lifecycle.
 *
 * DRAFT and SUBMITTED are the lender's; everything after is IMGC's, except
 * DOCUMENTS_RESUBMITTED which is how the lender answers a query. CLOSED is terminal and
 * distinct from APPROVED/REJECTED: a decided claim can still be open for settlement.
 */
export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "QUERY_RAISED"
  | "DOCUMENTS_RESUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED"
  // Retained: `Account.claimStatus` predates the Claim entity and still uses it.
  | "QUERIED";

/** Which of the configured claim types a claim is. Values come from `config/claimConfig`. */
export type ClaimTypeKey = "INITIAL" | "SUBSEQUENT";

/** What the lender may do with an account, derived — never stored. */
export type ClaimAction = "INITIATE" | "TRACK" | "VIEW" | "DISABLED";

/**
 * The document lifecycle, exactly as the business rules define it.
 *
 * There is no separate "Uploaded" state: rule 2 says an upload puts the document straight into
 * review, so a row that sat at "Uploaded" would be a state no rule can ever move out of.
 */
export type DocStatus =
  | "NOT_REQUESTED"
  | "PENDING_UPLOAD"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REUPLOAD_REQUIRED";

/** Whether every required document on a case has been approved. */
export type CaseDocStatus = "COMPLETE" | "INCOMPLETE";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ReinstateStatus = "REQUESTED" | "APPROVED" | "DENIED";

export type AuditType =
  | "DOC_UPLOADED"
  | "DOC_STATUS_CHANGED"
  | "DOC_REQUIREMENT_ADDED"
  | "REMARK_ADDED"
  | "PAS_VALUE_UPDATED"
  | "BUCKET_SHIFTED"
  | "CLAIM_SUBMITTED"
  | "CLAIM_STATUS_CHANGED"
  | "REINSTATE_REQUESTED"
  | "REINSTATE_DECIDED"
  | "RETENTION_PURGED"
  | "DOC_REQUIREMENT_UPDATED"
  | "DOC_APPROVED"
  | "DOC_REJECTED"
  | "DOC_REUPLOAD_REQUESTED"
  | "DOC_REACTIVATED";

export interface LenderOrg {
  id: string;
  name: string;
  /** The single source of lender scoping — a lender user sees an account iff the domains match. */
  emailDomain: string;
  /** Stakeholder mailboxes notified on bucket shifts and claim events. */
  contactEmails: string[];
  /** Path under `/public` to this lender's own mark, shown in their sidebar. Optional — a lender
   *  with none falls back to a generated initials badge (see `AppSidebar`) rather than IMGC's. */
  logoUrl?: string;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** IMGC staff sign in with this + password. */
  employeeId?: string;
  passwordHash?: string;
  /** IMGC staff only — shown on the lender-facing Help & Assistance card. */
  phone?: string;
  /** Lender users only. */
  lenderOrgId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Otp {
  email: string;
  codeHash: string;
  salt: string;
  expiresAt: string;
  attempts: number;
  consumed: boolean;
}

export interface Account {
  id: string;
  /** Loan / application ID shown to users, e.g. 3002060000000. */
  loanNo: string;
  borrowerName: string;
  lenderOrgId: string;
  product: string;
  region: string;
  branch: string;
  /** IMGC user id this case is assigned to. */
  assignedUserId?: string;
  assignedUserName?: string;
  /** ISO date the application was received. */
  applicationDate: string;
  /** Sanctioned loan amount, in rupees. */
  loanAmount: number;
  /** Principal + interest outstanding today, in rupees. */
  outstandingAmount: number;
  /** ISO date the loan was sanctioned. */
  sanctionDate: string;
  /** ISO date of first disbursement. */
  disbursementDate: string;
  /** Loan tenure in months. */
  tenureMonths: number;
  propertyType: string;
  /** Human label, e.g. "Under Construction" / "Ready to Move". */
  propertyStatus: string;
  /** Machine value evaluated by conditional document rules. */
  propertyStatusAtDisbursal: "UNDER_CONSTRUCTION" | "READY_TO_MOVE";
  bucket: Bucket;
  /** Free-text processing stage shown on the account. */
  stage: string;
  claimStatus: ClaimStatus;
  npa: boolean;
  writeOff: boolean;
  /**
   * Days Past Due — a collections metric independent of `npa`/`writeOff`. An account can carry a
   * real DPD well before (or without ever) crossing into NPA; the two are related in the real
   * world but never derived from each other here. Optional so an older/incomplete record can
   * still exist — render "—" rather than `0` when it's missing, since a missing DPD is not the
   * same claim as "zero days past due".
   */
  dpd?: number;
  submittedAt?: string;
  /** Extra mailboxes an IMGC processor wants pushed on this account's events. */
  pushRecipients: string[];
  createdAt: string;
}

export interface PasValue {
  id: string;
  accountId: string;
  key: string;
  label: string;
  value: string;
  source: "PAS";
  updatedAt: string;
  updatedBy: string;
}

export interface Reinstate {
  status: ReinstateStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export interface Rejection {
  at: string;
  by: string;
  reason: string;
  reinstate?: Reinstate;
}

export interface ClaimDocument {
  id: string;
  accountId: string;
  /**
   * Present when the document belongs to a claim's checklist rather than the account's.
   * Optional so every existing account-level document keeps working untouched.
   */
  claimId?: string;
  name: string;
  required: boolean;
  addedBy: "SYSTEM" | "IMGC" | "LENDER";
  status: DocStatus;
  /** Points at the current `DocumentFile`. */
  currentFileId?: string;
  rejection?: Rejection;
  createdAt: string;

  /* ── configurable requirement (IMGC-authored additional documents) ── */
  /** e.g. "Property Document". Groups the checklist so a long list stays readable. */
  category?: string;
  /** What the lender must actually provide — shown under the row as instructions. */
  description?: string;
  /** "All products", or one product this requirement pertains to. */
  applicableProduct?: string;
  /** "All case types", or the case type this requirement pertains to. */
  applicableCaseType?: string;
  /** ISO date the upload is due by. Absent means no SLA. */
  dueDate?: string;
  /** IMGC's own note against the requirement. */
  requirementRemarks?: string;
  /**
   * Inactive requirements are withdrawn: hidden from the lender and excluded from the submission
   * gate. Absent counts as active, so every requirement seeded before this field stays active.
   */
  active?: boolean;
  addedByName?: string;
  priority?: Priority;
  /** Latest version number; 0 while nothing has been uploaded. */
  version?: number;
  /** Set by the last Approve / Reject / Request re-upload decision. */
  review?: DocumentReview;

  /* ── configuration-driven claim document category ── */
  /** The config id, e.g. "lod" / "income-banking". */
  slug?: string;
  /** This category holds many files (LOD, Income & Banking) rather than one. */
  multiple?: boolean;
  /** Materialised from a conditional spec — `required` reflects whether the condition held. */
  conditional?: boolean;
  /** Helper text explaining when the conditional document is mandatory. */
  conditionReason?: string;
  /** Display reference for a lender-added additional document, e.g. "AD-001". */
  refNo?: string;
}

export interface DocumentReview {
  decision: "APPROVED" | "REJECTED" | "REUPLOAD_REQUESTED";
  by: string;
  byName: string;
  at: string;
  /** Mandatory for a rejection and for a re-upload request. */
  remarks: string;
  /** The version the decision was made against, so a later upload does not rewrite history. */
  version: number;
}

export interface DocumentFile {
  id: string;
  documentId: string;
  accountId: string;
  originalName: string;
  /** Path under `.data/uploads`. */
  storedPath: string;
  size: number;
  mime: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  /** Set when a newer file replaces it — kept for the audit trail. */
  supersededAt?: string;
  /** 1-based, and never reused: a re-upload is always a new version. */
  version: number;
  /** Lender-supplied metadata captured on the upload form. */
  documentNumber?: string;
  documentDate?: string;
  uploadRemarks?: string;
  /** Why this version was superseded, copied from the decision that rejected it. */
  supersededReason?: string;
}

export interface Remark {
  id: string;
  accountId: string;
  /** Present for a per-document remark; absent for an account-level one. */
  documentId?: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  accountId: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role | "SYSTEM";
  type: AuditType;
  summary: string;
  meta?: Record<string, string>;
}

export interface Notification {
  id: string;
  to: string[];
  subject: string;
  body: string;
  event: string;
  accountId?: string;
  sentAt: string;
  /** Roles that have not yet opened the notification list since this arrived. */
  unreadFor?: Role[];
}

/** One entry in a claim's status history — what the timeline renders. */
export interface ClaimStatusEntry {
  status: ClaimStatus;
  at: string;
  byId: string;
  byName: string;
  byRole: Role | "SYSTEM";
  note?: string;
}

/** A query IMGC raises against a claim, and the lender's response to it. */
export interface ClaimQuery {
  id: string;
  claimId: string;
  reason: string;
  remarks: string;
  /** Names of documents the query asks for; matched against the claim's checklist. */
  requestedDocuments: string[];
  raisedById: string;
  raisedByName: string;
  raisedAt: string;
  /** When the lender is expected to respond — set when the query is raised, never edited. */
  dueDate?: string;
  respondedAt?: string;
  respondedById?: string;
  respondedByName?: string;
  responseRemarks?: string;
}

/**
 * A claim against an account.
 *
 * References the account rather than copying it: customer, lender, product and region are all
 * reachable through `accountId`, and duplicating them here would give two answers the moment
 * one changed.
 */
export interface Claim {
  id: string;
  /** Human reference, e.g. CLM-2026-00125. */
  claimNo: string;
  accountId: string;
  claimType: ClaimTypeKey;
  status: ClaimStatus;
  /** Values for the fields `claimConfig` defines for this type, keyed by field id. */
  fields: Record<string, string>;
  statusHistory: ClaimStatusEntry[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  submittedAt?: string;
  lastUpdatedAt: string;
  /**
   * Set once the lender has explicitly clicked Save or Save & Submit on this claim. A draft is
   * auto-created the moment the workspace is opened so there's something to attach documents to
   * — that alone isn't the lender committing to it, so this stays false until they do.
   */
  draftSaved?: boolean;
  /** Which side currently holds the claim. */
  bucket: Bucket;
  /** Set on APPROVED / REJECTED / CLOSED. */
  decision?: {
    outcome: "APPROVED" | "REJECTED" | "CLOSED";
    byId: string;
    byName: string;
    at: string;
    remarks: string;
  };
}

export interface MockDb {
  lenderOrgs: LenderOrg[];
  users: User[];
  otps: Otp[];
  accounts: Account[];
  pasValues: PasValue[];
  claimDocuments: ClaimDocument[];
  claims: Claim[];
  claimQueries: ClaimQuery[];
  documentFiles: DocumentFile[];
  remarks: Remark[];
  auditEvents: AuditEvent[];
  notifications: Notification[];
}
