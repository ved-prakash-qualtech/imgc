export type V2RoleType =
  | "Super Admin"
  | "Tenant Admin"
  | "Tenant Manager"
  | "Tenant"
  | "Tenant Ops Mgr"
  | "Internal"
  | "Tenant";
export type V2RoleStatus =
  | "Active"
  | "Draft"
  | "Deprecated"
  | "Pending Approval"
  | "Changes Requested"
  | "Rejected"
  | "Inactive";
export type V2Scope = "All" | "Tenant" | "Agency" | "Department" | "Own";

/**
 * API-specific types for Roles GET and CREATE endpoints
 * Backend contract: GET /api/v1/roles, POST /api/v1/roles
 */

export type RoleType = "USER" | "CLIENT" | "BOTH";
export type RoleStatus = "Draft" | "Pending Approval" | "Active" | "Rejected";

/**
 * Raw API response from GET /api/v1/roles/dropdown?roleType=USER
 * Used for populating role selectors in User create/edit forms.
 */
export interface RoleDropdownItem {
  id: string;
  name: string;
}

export interface RoleDropdownResponse {
  status: string;
  statusCode: number;
  message: string;
  data: RoleDropdownItem[];
}

/**
 * Raw API response from GET /api/v1/roles
 * status field is numeric: 0=Draft, 1=Active, 2=Pending Approval, 3=Rejected
 */
export interface RoleApiResponse {
  id: string;
  roleType: RoleType;
  name: string;
  description: string;
  status: number;
  /** 1 = system default (cannot be modified), 0 = user-created role */
  isDefault?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  roleType: RoleType;
  name: string;
  description?: string;
}

export interface UpdateRolePayload {
  roleType?: RoleType;
  name?: string;
  description?: string;
}

export function mapRoleStatus(status: number): RoleStatus {
  switch (status) {
    case 0:
      return "Draft";
    case 1:
      return "Active";
    case 2:
      return "Pending Approval";
    case 3:
      return "Rejected";
    default:
      return "Draft";
  }
}

export function mapRoleTypeToDisplay(roleType: RoleType): string {
  switch (roleType) {
    case "USER":
      return "User";
    case "CLIENT":
      return "Client";
    case "BOTH":
      return "Both";
    default:
      return roleType;
  }
}

export interface Role {
  id: string;
  roleType: RoleType;
  roleTypeDisplay: string;
  name: string;
  description: string;
  status: RoleStatus;
  /** true when the backend marks this as a non-modifiable system default role */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRoleApiResponse(item: RoleApiResponse): Role {
  return {
    id: item.id,
    roleType: item.roleType,
    roleTypeDisplay: mapRoleTypeToDisplay(item.roleType),
    name: item.name,
    description: item.description,
    status: mapRoleStatus(item.status),
    isDefault: item.isDefault === 1,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export interface V2AssignedUser {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Suspended" | "Pending";
}

export interface V2AuditEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
  actor: string;
}

export interface V2RoleReviewNote {
  id: string;
  by: string;
  at: string;
  action:
    "Submitted" | "Approved" | "Rejected" | "Changes Requested" | "Resubmitted";
  comment?: string;
}

export interface V2DataScope {
  categoryKey: string;
  valueKeys: string[];
}

export interface V2Role {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: V2RoleType;
  roleType?: "Internal" | "Tenant"; // Migrated from reference tenant-roles-store
  status: V2RoleStatus;
  permissionIds: string[];
  policyIds: string[];
  componentIds?: string[];
  componentActionKeys?: Record<string, string[]>;
  scope: V2Scope;
  scopeDetail?: string;
  users: V2AssignedUser[];
  createdAt: string;
  updatedAt: string;
  highPrivilege?: boolean;
  isTemplate?: boolean;
  applicationId?: string;
  appId?: string; // Alias for applicationId for reference compatibility
  tenantId?: string;
  templateId?: string;
  customId?: string;
  organizationId?: string;
  nodePermissions?: Record<string, string[]>;
  categoryScoping?: Record<string, string[]>;
  isDefault?: boolean;
  menuAccess?: string[];
  submittedAt?: string;
  reviewNotes?: V2RoleReviewNote[];
  createdBy?: string;
  dataScope?: V2DataScope;
  dataScopes?: V2DataScope[];
}
