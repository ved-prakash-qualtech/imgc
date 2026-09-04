export type TenantStatus =
  | "Draft"
  | "Pending Approval"
  | "Changes Requested"
  | "Approved"
  | "Operational"
  | "Rejected";

export interface TenantReviewNote {
  id: string;
  by: string;
  at: string;
  action:
    | "Submitted"
    | "Approved"
    | "Rejected"
    | "Changes Requested"
    | "Resubmitted"
    | "Activated";
  comment?: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  uniqueKey?: string;
  appId: string;
  templateId: string;
  status: TenantStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  reviewNotes: TenantReviewNote[];
}
