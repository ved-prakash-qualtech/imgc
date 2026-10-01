export type AppStatus =
  | "Draft"
  | "Pending Approval"
  | "Changes Requested"
  | "In Configuration"
  | "Configured"
  | "Active";

export type MfaMethod = "Email OTP" | "SMS OTP" | "Google Authenticator";

export type AuthType = "OAuth 2.0" | "SAML" | "OIDC" | "JWT" | "LDAP";

export interface ReviewEntry {
  id: string;
  by: string;
  decision: "Approved" | "Rejected" | "Changes Requested" | "Submitted";
  comment?: string;
  at: string;
}

export type ConfigStage = "application-setup" | "template-setup";

export type TemplateSetupStatus =
  | "Not Started"
  | "In Progress"
  | "Pending Approval"
  | "Changes Requested"
  | "Approved";

export interface TemplateSetupState {
  status: TemplateSetupStatus;
  flags: {
    templateDefined: boolean;
    policyAssigned: boolean;
    categoryAssigned: boolean;
    tenantCreated: boolean;
  };
  submittedAt?: string;
  approvedAt?: string;
  reviewHistory: ReviewEntry[];
}

export interface Application {
  id: string;
  name: string;
  code: string;
  type: string;
  environments: string[];
  multiTenant: boolean;
  appOwnerAutoAuth?: boolean;
  tenantAuthorAutoAuth?: boolean;
  description?: string;
  link?: string;
  redirectUrl?: string;
  sessionTimeoutMin?: number;
  tokenExpiryMin?: number;
  // Contact information
  contactPersonName?: string;
  contactPersonMobile?: string;
  contactPersonEmail?: string;
  organizationId?: string;
  organizationName?: string;
  tenantId?: string;
  tenantName?: string;
  reviewHistory?: ReviewEntry[];
  status: AppStatus;
  pendingStage?: ConfigStage;
  templateSetup?: TemplateSetupState;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}
