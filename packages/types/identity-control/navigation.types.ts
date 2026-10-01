export type ComponentType =
  | "Menu"
  | "Page"
  | "Section"
  | "Widget"
  | "Tab"
  | "Button"
  | "Field"
  | "Action";
export type MappingStatus = "Mapped" | "Partially Mapped" | "Unmapped";
export type ComponentStatus = "Active" | "Draft" | "Deprecated";
export type Visibility = "Visible" | "Hidden" | "System";

export type PermissionModule =
  | "Identity & Access"
  | "Operations"
  | "Reporting"
  | "Administration"
  | "Compliance";

export interface NodeActionMeta {
  actionId: string;
  actionCode: string;
  actionName: string;
}

export interface NavAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
  actor: string;
  result: "Success" | "Failed" | "Info";
}

/** Which level a menu belongs to. Mirrors sidebar_menus.applies_to at the identity portal. */
export type MenuAppliesTo = "MASTER" | "TENANT" | "BOTH";

export interface NavComponent {
  id: string;
  key: string;
  name: string;
  description: string;
  type: ComponentType;
  module: PermissionModule;
  parentId?: string;
  route?: string;
  icon?: string;
  displayOrder: number;
  visibility: Visibility;
  status: ComponentStatus;
  mappedPermissions: string[];
  recommendedPermissions: string[];
  actionKeys?: string[];
  actionMeta?: NodeActionMeta[];
  menuTypeId?: string;
  menuKey?: string;

  /**
   * Which level this menu is for: MASTER, TENANT or BOTH.
   *
   * <p>MASTER administers the application and is never fanned out to a tenant. TENANT is authored
   * here and hidden from this level's own sidebar. BOTH is the same screen at both levels over
   * each level's own data — Roles and Users are the examples.
   *
   * <p>Optional, and BOTH when absent, which is what the column defaults to.
   */
  appliesTo?: MenuAppliesTo;
  persisted?: boolean;
  inheritance?: "Direct" | "Inherit";
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  accessCount?: number;
  auditTrail: NavAuditEntry[];
  applicationId?: string;
  tenantId?: string;
  mapActions?: Array<{ actionId: string; status: "ACTIVE" | "INACTIVE" }>;
}

export type NavTreeNode = NavComponent & { children: NavTreeNode[] };
