export type ResourceCategory =
  "Identity" | "Operations" | "Governance" | "Reporting" | "Configuration";
export type PermissionStatus = "Active" | "Deprecated" | "Draft";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export interface Resource {
  id: string;
  key: string;
  name: string;
  description: string;
  category: ResourceCategory;
  owner: string;
  createdAt: string;
  updatedAt: string;
  applicationId?: string;
  tenantId?: string;
}

export interface ActionDef {
  key: string;
  name: string;
  description: string;
  defaultRisk: RiskLevel;
}

export interface AssignedRoleRef {
  roleId: string;
  name: string;
  type: "System" | "Custom" | "Business";
  usersAssigned: number;
  accessLevel: "Critical" | "High" | "Medium" | "Low";
}

export interface Permission {
  id: string;
  key: string;
  resourceKey: string;
  resourceName: string;
  actionKey: string;
  actionName: string;
  description: string;
  risk: RiskLevel;
  status: PermissionStatus;
  assignedRoles: AssignedRoleRef[];
  usersImpacted: number;
  applicationsImpacted: number;
  recentUsage: number;
  audit: unknown[];
  createdAt: string;
  updatedAt: string;
  owner: string;
  applicationId?: string;
  tenantId?: string;
}
