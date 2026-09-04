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

export type DocStatus = "PENDING" | "UPLOADED" | "ACCEPTED" | "REJECTED";

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
  | "RETENTION_PURGED";

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
  loanNo: string;
  borrowerName: string;
  lenderOrgId: string;
  product: string;
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
