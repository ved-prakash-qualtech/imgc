/**
 * IMGC Lender Portal — mock domain model.
 *
 * These types describe the shape of `.data/imgc-db.json`, the prototype's stand-in for the QCP
 * backends + PAS. A real build replaces `src/server/mock/*` with service calls; the types here
 * are intentionally close to what those services would return.
 */

export type Role = "IMGC" | "LENDER";

export type Bucket = "IMGC" | "LENDER";

/** DRAFT → lender is still preparing; SUBMITTED → handed to IMGC; then IMGC sets APPROVED/QUERIED. */
export type ClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "QUERIED";

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
  | "DOC_REUPLOAD_REQUESTED";

export interface LenderOrg {
  id: string;
  name: string;
  /** The single source of lender scoping — a lender user sees an account iff the domains match. */
  emailDomain: string;
  /** Stakeholder mailboxes notified on bucket shifts and claim events. */
  contactEmails: string[];
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** IMGC staff sign in with this + password. */
  employeeId?: string;
  passwordHash?: string;
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
  /** Case / application reference, e.g. APP-100245. */
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
  bucket: Bucket;
  /** Free-text processing stage shown on the account. */
  stage: string;
  claimStatus: ClaimStatus;
  npa: boolean;
  writeOff: boolean;
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
  name: string;
  required: boolean;
  addedBy: "SYSTEM" | "IMGC";
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

export interface MockDb {
  lenderOrgs: LenderOrg[];
  users: User[];
  otps: Otp[];
  accounts: Account[];
  pasValues: PasValue[];
  claimDocuments: ClaimDocument[];
  documentFiles: DocumentFile[];
  remarks: Remark[];
  auditEvents: AuditEvent[];
  notifications: Notification[];
}
