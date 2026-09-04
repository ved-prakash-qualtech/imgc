import type { PaginatedData } from "@/lib/api.types";
import type {
  Application,
  AppStatus,
} from "@/types/identity-control/application.types";

/**
 * Raw API response item from GET /api/v1/application/applications
 * Keep in sync with the backend contract — no UI concerns here.
 */
export interface ApplicationApiResponse {
  id: string;
  applicationCode: string;
  applicationName: string;
  description: string | null;
  redirectionUrl: string | null;
  applicationKey: string | null;
  isMultiTenant: boolean;
  sessionTimeout: number;
  tokenExpiry: number;
  personName: string | null;
  personalMail: string | null;
  personContact: string | null;
  environment: string;
  status: number;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Payload for POST /api/v1/application/applications
 *
 * Fields intentionally excluded (not in the backend CREATE contract):
 *   - redirectionUrl  (present in UI form but not yet accepted by this endpoint)
 *   - applicationKey  (not accepted on creation)
 *
 * description is required: the UI form enforces non-empty description before calling this.
 */
export interface CreateApplicationPayload {
  applicationCode: string;
  applicationName: string;
  description: string;
  tokenExpiry: number;
  sessionTimeout: number;
  personContact: string;
  personalMail: string;
  personName: string;
  environment: string;
  isMultiTenant: boolean;
}

/**
 * Payload for PUT /api/v1/application/applications/{id}
 *
 * Same field set as CREATE per the current backend contract.
 * Fields intentionally excluded:
 *   - redirectionUrl  (not in the provided UPDATE contract)
 *   - applicationKey  (not accepted)
 */
export interface UpdateApplicationPayload {
  applicationCode: string;
  applicationName: string;
  description: string;
  tokenExpiry: number;
  sessionTimeout: number;
  personContact: string;
  personalMail: string;
  personName: string;
  environment: string;
  isMultiTenant: boolean;
}

export type PaginatedApplicationsResponse =
  PaginatedData<ApplicationApiResponse>;

/**
 * Item returned by GET /api/v1/application/menu-types
 * Represents a single component type available in the navigation builder palette.
 */
export interface ApplicationMenuType {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
  status: string;
  createdAt: string;
}

/**
 * Item returned by GET /api/v1/application/menu-type-action-mappings/by-menu-type
 * Represents a single action available for a given menu type.
 */
export interface MenuTypeActionMapping {
  actionId: string;
  actionCode: string;
  actionName: string;
}

/**
 * Action mapping item in SidebarMenuItem response
 */
export interface SidebarMenuActionMapping {
  actionId: string;
  status: "ACTIVE" | "INACTIVE";
}

/**
 * Flat item returned by GET /api/v1/application/sidebar-menus
 * The hierarchy is expressed via parentId.
 * Use buildNavTreeFromComponents() to reconstruct the visual tree.
 * Actions are now included directly in the response via mapActions.
 */
export interface SidebarMenuItem {
  id: string;
  name: string;
  key: string;
  url: string;
  description: string;
  menuTypeId: string;
  /** Which level this menu is for, as the portal recorded it. */
  appliesTo?: "MASTER" | "TENANT" | "BOTH";
  menuTypeName: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  mapActions: SidebarMenuActionMapping[];
  parentId?: string | null;
  createdAt?: string;
  modifiedAt?: string;
}

/**
 * Action mapping item in CreateSidebarMenuPayload
 */
export interface CreateSidebarMenuActionMapping {
  actionId: string;
  status: "ACTIVE" | "INACTIVE";
}

/**
 * Request body for POST /api/v1/application/sidebar-menus
 */
export interface CreateSidebarMenuPayload {
  name: string;
  key: string;
  url: string;
  description: string;
  menuTypeId: string;
  /**
   * Which level the menu is for: MASTER, TENANT or BOTH.
   *
   * <p>The portal defaults it to BOTH, so omitting it behaves as this payload did before the
   * field existed. MASTER is what stops a menu being fanned out to every tenant.
   */
  appliesTo?: "MASTER" | "TENANT" | "BOTH";
  status: "ACTIVE" | "INACTIVE";
  actions: CreateSidebarMenuActionMapping[];
  children: CreateSidebarMenuPayload[];
}

/**
 * Item returned by GET /api/v1/tenant/application-domains/dropdown
 * Used to populate the Application Code dropdown in the Create/Edit drawer.
 */
export interface ApplicationDomainDropdownItem {
  id: string;
  applicationCode: string;
  applicationUrl: string;
}

/**
 * Item returned by GET /api/v1/application/applications/dropdown
 * Used to populate the Application dropdown in the Create Organization drawer.
 */
export interface ApplicationDropdownItem {
  id: string;
  applicationName: string;
}

/**
 * Item returned by GET /api/v1/application/application-tenants/dropdown
 * Used to populate the Organization single-select in the Organization User create/edit form.
 */
export interface ApplicationTenantDropdownItem {
  id: string;
  tenantName: string;
  tenantCode: string;
}

/**
 * Maps backend numeric status to UI AppStatus string.
 * Mirrors the same convention used in organization.types.ts.
 * Backend status values: 0=Draft, 1=Active, 2=Pending Approval, 3=Changes Requested
 */
export function mapApplicationStatus(status: number): AppStatus {
  switch (status) {
    case 0:
      return "Draft";
    case 1:
      return "Active";
    case 2:
      return "Pending Approval";
    case 3:
      return "Changes Requested";
    default:
      return "Draft";
  }
}

/**
 * Maps a raw ApplicationApiResponse to the UI Application model.
 * Used by the dashboard page after fetching from the backend.
 */
export function mapApplicationApiResponse(
  item: ApplicationApiResponse
): Application {
  return {
    id: item.id,
    name: item.applicationName,
    code: item.applicationCode,
    type: item.isMultiTenant ? "Multi-Tenant" : "Single-Tenant",
    environments: item.environment ? [item.environment] : [],
    multiTenant: item.isMultiTenant,
    description: item.description ?? undefined,
    redirectUrl: item.redirectionUrl ?? undefined,
    sessionTimeoutMin: item.sessionTimeout,
    tokenExpiryMin: item.tokenExpiry,
    contactPersonName: item.personName ?? undefined,
    contactPersonMobile: item.personContact ?? undefined,
    contactPersonEmail: item.personalMail ?? undefined,
    status: mapApplicationStatus(item.status),
    createdBy: item.personName ?? "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    reviewHistory: [],
  };
}
