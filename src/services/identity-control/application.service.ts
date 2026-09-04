"use server";

import { serverApiClient } from "@/lib/apiClient.server";
import { getAuthHeader } from "@/services/identity-control/shared/auth-header";
import { IDENTITY_CONTROL_ENDPOINTS } from "@/config/apiEndpoints";
import {
  extractApiResponse,
  extractMutationResponse,
  withApiError,
  type MutationResult,
  type ServiceResult,
} from "@/utils/serverActionUtils";
import type { PaginatedData } from "@/lib/api.types";
import type {
  ApplicationApiResponse,
  ApplicationDomainDropdownItem,
  ApplicationDropdownItem,
  ApplicationTenantDropdownItem,
  ApplicationMenuType,
  MenuTypeActionMapping,
  SidebarMenuItem,
  CreateSidebarMenuPayload,
  CreateApplicationPayload,
  UpdateApplicationPayload,
} from "@/types/identity-control/application-api.types";

const EMPTY_PAGE = (
  page: number,
  size: number
): PaginatedData<ApplicationApiResponse> => ({
  content: [],
  totalElements: 0,
  totalPages: 0,
  size,
  number: page,
  first: true,
  last: true,
  empty: true,
});

/**
 * Fetch paginated list of applications (GET /api/v1/application/applications)
 * Runs server-side so the httpOnly accessToken cookie is readable.
 * Backend is resolved automatically from the request hostname via serverApiClient.
 */
export async function fetchApplications(
  page = 0,
  size = 10,
  sort = "createdAt"
): Promise<PaginatedData<ApplicationApiResponse>> {
  const auth = await getAuthHeader();
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
  });
  const url = `${IDENTITY_CONTROL_ENDPOINTS.TENANT_APPLICATIONS}?${params.toString()}`;
  const res = await serverApiClient.get(url, {
    headers: { Authorization: auth },
  });
  return (
    extractApiResponse<PaginatedData<ApplicationApiResponse>>(res) ??
    EMPTY_PAGE(page, size)
  );
}

/**
 * Create a new application (POST /api/v1/application/applications)
 * Runs server-side so the httpOnly accessToken cookie is readable.
 *
 * Returns the created application plus the backend success message, or an API
 * error envelope. Unwrap with `callApi()` on the client.
 */
export async function createApplication(
  payload: CreateApplicationPayload
): Promise<ServiceResult<MutationResult<ApplicationApiResponse>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.post(
      IDENTITY_CONTROL_ENDPOINTS.TENANT_APPLICATIONS,
      payload,
      { headers: { Authorization: auth } }
    );
    const result = extractMutationResponse<ApplicationApiResponse>(res);
    if (!result.data) throw new Error("Failed to create application");
    return result;
  });
}

/**
 * Fetch navigation builder component types (GET /api/v1/application/menu-types).
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchMenuTypes(): Promise<ApplicationMenuType[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_MENU_TYPES,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<ApplicationMenuType[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch the flat sidebar menu list for Application Setup
 * (GET /api/v1/application/sidebar-menus)
 *
 * Returns a flat array of SidebarMenuItem where parentId expresses hierarchy.
 * The frontend rebuilds the visual tree using buildNavTreeFromComponents().
 * Actions per node are lazy-loaded on selection via fetchMenuTypeActionMappings.
 */
export async function fetchSidebarMenus(): Promise<SidebarMenuItem[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.SIDEBAR_MENUS,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<SidebarMenuItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Create a new sidebar menu node
 * (POST /api/v1/application/sidebar-menus)
 *
 * Called by Save Layout for each locally created node that has not yet
 * been persisted to the backend. After all POSTs succeed the caller
 * refreshes the tree via fetchSidebarMenus.
 */
export async function createSidebarMenu(
  payload: CreateSidebarMenuPayload
): Promise<ServiceResult<MutationResult<unknown>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.post(
      IDENTITY_CONTROL_ENDPOINTS.SIDEBAR_MENUS,
      payload,
      { headers: { Authorization: auth } }
    );
    return extractMutationResponse(res);
  });
}

/**
 * Fetch active application domain dropdown items (GET /api/v1/tenant/application-domains/dropdown)
 * Returns applicationCode and applicationUrl for each available domain.
 * extractApiResponse already unwraps the backend `data` field — no double-unwrap.
 */
export async function fetchApplicationDomainDropdown(): Promise<
  ApplicationDomainDropdownItem[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_DOMAIN_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<ApplicationDomainDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch application dropdown items.
 *
 * @api GET /api/v1/application/applications/dropdown
 * @usedBy OrganizationDrawer (ORGANIZATION context, create mode)
 *         CreateTenantUserDrawer (organization module, Application multi-select)
 *         Purpose: Fetch applications available for selection in the Level 2
 *         Organization Create Application multi-select (InlineMultiSelect).
 * @returns Array of { id, applicationName } for each available application.
 *
 * extractApiResponse already unwraps the backend `data` field — no double-unwrap.
 */
export async function fetchApplicationDropdown(): Promise<
  ApplicationDropdownItem[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<ApplicationDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch application-tenant dropdown items.
 *
 * @api GET /api/v1/application/application-tenants/dropdown
 * @usedBy CreateTenantUserDrawer (organization module, Organization single-select)
 *         Purpose: Fetch available organizations (application-tenants) so the
 *         user can select one when creating or editing an Organization User.
 *         Selected id maps to `applicationTenantId` in the create/update payload.
 * @returns Array of { id, tenantName, tenantCode } for each available organization.
 *
 * extractApiResponse already unwraps the backend `data` field — no double-unwrap.
 */
export async function fetchApplicationTenantDropdown(): Promise<
  ApplicationTenantDropdownItem[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_TENANT_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<ApplicationTenantDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch applications available for a specific application-tenant.
 *
 * @api GET /api/v1/application/applications/dropdown-by-tenant?applicationTenantId=
 * @usedBy CreateTenantUserDrawer (organization module, Application multi-select)
 *         Purpose: list only the applications belonging to the selected
 *         organization, so the user cannot assign cross-tenant applications.
 * @param applicationTenantId  The selected organization id.
 * @returns Array of { id, applicationName } for the tenant's applications.
 *
 * extractApiResponse already unwraps the backend `data` field — no double-unwrap.
 */
export async function fetchApplicationsByTenant(
  applicationTenantId: string
): Promise<ApplicationDropdownItem[]> {
  const auth = await getAuthHeader();
  const params = new URLSearchParams({
    applicationTenantId,
  });
  const url = `${IDENTITY_CONTROL_ENDPOINTS.APPLICATION_DROPDOWN_BY_TENANT}?${params.toString()}`;
  const res = await serverApiClient.get(url, {
    headers: { Authorization: auth },
  });
  const items = extractApiResponse<ApplicationDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch action mappings for a specific menu type
 * (GET /api/v1/application/menu-type-action-mappings/by-menu-type?menuTypeId=<UUID>)
 *
 * Returns the ordered list of actions the backend has defined for this menu type.
 * The frontend renders exactly these actions — no static hardcoding.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchMenuTypeActionMappings(
  menuTypeId: string
): Promise<MenuTypeActionMapping[]> {
  const auth = await getAuthHeader();
  const url = `${IDENTITY_CONTROL_ENDPOINTS.MENU_TYPE_ACTION_MAPPINGS}?menuTypeId=${encodeURIComponent(menuTypeId)}`;
  const res = await serverApiClient.get(url, {
    headers: { Authorization: auth },
  });
  const items = extractApiResponse<MenuTypeActionMapping[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Update an existing application (PUT /api/v1/application/applications/{id})
 * Runs server-side so the httpOnly accessToken cookie is readable.
 * Backend is resolved automatically from the request hostname via serverApiClient.
 *
 * Returns the updated application plus the backend success message, or an API
 * error envelope. Unwrap with `callApi()` on the client.
 */
export async function updateApplicationApi(
  applicationId: string,
  payload: UpdateApplicationPayload
): Promise<ServiceResult<MutationResult<ApplicationApiResponse>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.put(
      IDENTITY_CONTROL_ENDPOINTS.TENANT_APPLICATION_BY_ID(applicationId),
      payload,
      { headers: { Authorization: auth } }
    );
    const result = extractMutationResponse<ApplicationApiResponse>(res);
    if (!result.data) throw new Error("Failed to update application");
    return result;
  });
}
