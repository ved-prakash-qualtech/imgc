export type ApplicationRoleType =
  "USER" | "CLIENT" | "BOTH" | "API_CLIENT" | "TENANT_TEMPLATE" | string;
export type ApplicationRoleStatus = "ACTIVE" | "INACTIVE";

export type ApplicationRoleTypeOption =
  "USER" | "API_CLIENT" | "BOTH" | "TENANT_TEMPLATE";

export const APPLICATION_ROLE_NAME_PREFIX = "ROLE_";

export const APPLICATION_ROLE_TYPE_OPTIONS: ReadonlyArray<{
  value: ApplicationRoleTypeOption;
  label: ApplicationRoleTypeOption;
}> = [
  { value: "USER", label: "USER" },
  { value: "API_CLIENT", label: "API_CLIENT" },
  { value: "BOTH", label: "BOTH" },
  { value: "TENANT_TEMPLATE", label: "TENANT_TEMPLATE" },
] as const;

const APPLICATION_ROLE_TYPE_TO_CODE: Record<ApplicationRoleTypeOption, number> =
  {
    USER: 0,
    API_CLIENT: 1,
    BOTH: 2,
    TENANT_TEMPLATE: 3,
  };

const APPLICATION_ROLE_CODE_TO_TYPE: Record<number, ApplicationRoleTypeOption> =
  {
    0: "USER",
    1: "API_CLIENT",
    2: "BOTH",
    3: "TENANT_TEMPLATE",
  };

const DEFAULT_APPLICATION_ROLE_TYPE: ApplicationRoleTypeOption = "API_CLIENT";

export function toApplicationRoleTypeOption(
  value?: string | null
): ApplicationRoleTypeOption {
  if (!value) return DEFAULT_APPLICATION_ROLE_TYPE;
  const normalized = value.toUpperCase();
  if (normalized in APPLICATION_ROLE_TYPE_TO_CODE) {
    return normalized as ApplicationRoleTypeOption;
  }
  return DEFAULT_APPLICATION_ROLE_TYPE;
}

export function toApplicationRoleTypeCode(value?: string | null): number {
  return APPLICATION_ROLE_TYPE_TO_CODE[toApplicationRoleTypeOption(value)];
}

export function toApplicationRoleTypeLabel(
  value?: string | null
): ApplicationRoleTypeOption {
  return toApplicationRoleTypeOption(value);
}

export function toApplicationRoleTypeFromCode(
  code: number
): ApplicationRoleTypeOption {
  return APPLICATION_ROLE_CODE_TO_TYPE[code] ?? DEFAULT_APPLICATION_ROLE_TYPE;
}

export function stripApplicationRolePrefix(name?: string): string {
  return (name ?? "").replace(/^ROLE_/i, "");
}

export function withApplicationRolePrefix(name: string): string {
  const suffix = stripApplicationRolePrefix(name.trim()).toUpperCase();
  return `${APPLICATION_ROLE_NAME_PREFIX}${suffix}`;
}

export interface ApplicationRoleApiResponse {
  id: string;
  roleType: ApplicationRoleType;
  name: string;
  description?: string;
  status: ApplicationRoleStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * One entry of GET /api/v1/application/roles/dropdown.
 * `id` is what a mapping payload carries; `name` is display only.
 */
export interface ApplicationRoleDropdownItem {
  id: string;
  name: string;
}

export interface CreateApplicationRolePayload {
  roleType: number;
  name: string;
  description?: string;
  status: number;
}

export interface UpdateApplicationRolePayload {
  roleType: number;
  name: string;
  description?: string;
  status: number;
}

/**
 * Request body for POST /api/v1/application/role-policy-mappings
 * roleId — the application role id from GET /api/v1/application/roles
 * policyIds — ids from GET /api/v1/application/policies/dropdown, never names
 */
export interface CreateRolePolicyMappingPayload {
  roleId: string;
  policyIds: string[];
}

/**
 * One data category entry in the POST /api/v1/application/role-data-category-mappings body.
 * dataCategoryId — the category id from GET /api/v1/application/data-categories/dropdown
 * dataCategoryValueIds — the value ids from
 *   GET /api/v1/application/data-category-values/by-data-category, never names
 */
export interface CreateRoleDataCategoryMappingItem {
  dataCategoryId: string;
  dataCategoryValueIds: string[];
}

/**
 * Request body for POST /api/v1/application/role-data-category-mappings
 * roleId — the application role id from GET /api/v1/application/roles
 * dataCategories — categories with their selected values; only newly added
 *   items are sent, calculated as CURRENT SELECTION - EXISTING MAPPING.
 */
export interface CreateRoleDataCategoryMappingPayload {
  roleId: string;
  dataCategories: CreateRoleDataCategoryMappingItem[];
}

/**
 * One selected sidebar menu and the actions checked against it.
 * sidebarMenuId — the menu `id` from GET /api/v1/application/sidebar-menus
 * actionIds — that menu's `mapActions[].actionId` values, never `mapActions[].id`
 *             and never action codes or names
 */
export interface RoleSidebarMenuMappingItem {
  sidebarMenuId: string;
  actionIds: string[];
}

/**
 * Request body for POST /api/v1/application/role-sidebar-menu-mappings
 * roleId — the application role id from GET /api/v1/application/roles
 */
export interface CreateRoleSidebarMenuMappingPayload {
  roleId: string;
  sidebarMenus: RoleSidebarMenuMappingItem[];
}

/**
 * One record returned by
 * GET /api/v1/application/role-policy-mappings/by-role/{roleId}.
 *
 * `policyId` is what matches a row in the policy list; `id` is the mapping
 * record's own id and is never used as a policy id.
 */
export interface RolePolicyMapping {
  id: string;
  roleId: string;
  policyId: string;
  status: ApplicationRoleStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * One record returned by
 * GET /api/v1/application/role-data-category-mappings/by-role/{roleId}.
 *
 * `dataCategoryId` is what matches a row in the data category list; `id` is the
 * mapping record's own id — used only as the path parameter of the mapping
 * DELETE, never as a data category id. `dataCategoryValueIds` are value ids from
 * GET /api/v1/application/data-category-values/by-data-category, and are what
 * restore the value checkboxes.
 */
export interface RoleDataCategoryMapping {
  id: string;
  roleId: string;
  dataCategoryId: string;
  dataCategoryValueIds?: string[];
  status: ApplicationRoleStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * One action inside a mapping returned by
 * GET /api/v1/application/role-sidebar-menu-mappings/by-role/{roleId}.
 *
 * `id` here is the ACTION id — it is what matches the menu's
 * `mapActions[].actionId` from GET /api/v1/application/sidebar-menus. It is
 * neither `mapActions[].id` nor the mapping record's own id.
 */
export interface RoleSidebarMenuMappingAction {
  id: string;
  actionCode: string;
  actionName: string;
  status: ApplicationRoleStatus;
}

/**
 * One record returned by
 * GET /api/v1/application/role-sidebar-menu-mappings/by-role/{roleId}.
 *
 * `id` is the MAPPING id and is never used as an action id; `sidebarMenuId` is
 * what matches a menu from GET /api/v1/application/sidebar-menus.
 */
export interface RoleSidebarMenuMapping {
  id: string;
  roleId: string;
  sidebarMenuId: string;
  status: ApplicationRoleStatus;
  actions: RoleSidebarMenuMappingAction[];
}
