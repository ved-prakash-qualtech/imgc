/**
 * API endpoint definitions — declared once, imported everywhere
 * (frontend-project-setup.md §3). URLs follow the QCP API standard:
 * all lowercase, kebab-case, plural nouns, versioned.
 */
export const API_ENDPOINTS = {
  /** Admin scope: the tenants this application serves, and the portal behind them. */
  tenants: {
    base: "/api/v1/admin/tenants",
    overview: "/api/v1/admin/tenants/overview",
    availableCodes: "/api/v1/admin/tenants/available-codes",
    onboard: "/api/v1/admin/tenants/onboard",
    sync: "/api/v1/admin/tenants/sync",
  },
  /**
   * Reconciles the local replica of the application-master roles and users with the portal.
   * The backend replays the caller's own token to reach L3, so this only works while a master
   * admin is signed in — see MasterIdentitySyncService.
   */
  identity: {
    sync: "/api/v1/admin/identity/sync",
  },
  /**
   * The machine credentials that call this service.
   *
   * Outside /api/v1/admin deliberately: that prefix skips tenant resolution, and these live in
   * whichever database the host belongs to — the admin plane's, or one tenant's. Same path, both
   * levels, exactly as the portal serves /api/v1/roles at whichever level it is asked on.
   */
  apiClients: {
    base: "/api/v1/api-clients",
    rotateSecret: (id: string) => `/api/v1/api-clients/${id}/rotate-secret`,
  },
  examples: {
    list: "/api/v1/examples",
    byId: (id: string) => `/api/v1/examples/${id}`,
  },
} as const;

/* Helpers the copied IDENTITY_CONTROL_ENDPOINTS map below is written against — kept identical to
 * identity-portal-web-app so the map pastes in unchanged when it changes there. */
const API_VERSION = "v1";

const buildUrl = (endpoint: string): string => {
  const path = endpoint.replace(/^\/+|\/+$/g, "");
  return `/${path}`;
};

/**
 * The identity-portal endpoints the copied identity-control screens call.
 *
 * Lifted verbatim from identity-portal-web-app so those components paste in unchanged. They are
 * reached through `serverApiClient`, which in this project delegates to `portalClient()` — so the
 * same paths resolve to L3 for an administrator and L4 for a tenant, decided by the host.
 */
export const IDENTITY_CONTROL_ENDPOINTS = {
  // ── COMMON / SIDEBAR ──────────────────────────────────────────────────────

  // Current user + roles for the navbar profile.
  USERS_ME: buildUrl(`api/${API_VERSION}/users/me`),
  // The applications this person may open, and the URL that opens each. Answered
  // from the token, so it cannot be asked on somebody else's behalf.
  ME_APPLICATIONS: buildUrl(`api/${API_VERSION}/me/applications`),
  // Sidebar menu tree (accessJson). Sole source of sidebar ordering/hierarchy.
  // Used by: sidebar.service.ts → fetchSidebarData (sequential with USERS_ME).
  USER_ACCESS_CONTROL: (userId: string) =>
    buildUrl(`api/${API_VERSION}/user-access-controls/${userId}`),

  // ── LEVEL 1 — SUPER ADMIN ─────────────────────────────────────────────────

  // Organizations (L1). Backed by /api/v1/tenants — the L1 SUPER_ADMIN data source.
  // Do not mix with identity-control/tenants (different namespace, not yet consumed).
  ORGANIZATIONS: buildUrl(`api/${API_VERSION}/tenants`),
  ORGANIZATION_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/tenants/${id}`),

  // Administration Users (L1). Includes roles in request/response.
  // DIFFERENT contract from ORGANIZATION_USERS below — do not mix.
  USERS: buildUrl(`api/${API_VERSION}/users`),
  USER_BY_ID: (id: string) => buildUrl(`api/${API_VERSION}/users/${id}`),

  // Roles (L1 primary, also used in L2).
  ROLES: buildUrl(`api/${API_VERSION}/roles`),
  ROLE_BY_ID: (id: string) => buildUrl(`api/${API_VERSION}/roles/${id}`),
  // Multi-value query: ?roleType=USER&roleType=CLIENT — used for role picker dropdown.
  ROLE_DROPDOWN: (roleTypes: string | string[]) => {
    const types = Array.isArray(roleTypes) ? roleTypes : [roleTypes];
    const qs = types.map((t) => `roleType=${encodeURIComponent(t)}`).join("&");
    return buildUrl(`api/${API_VERSION}/roles/dropdown?${qs}`);
  },

  // ── LEVEL 2 — ORGANIZATION / IDENTITY MANAGEMENT ──────────────────────────

  // Organization Identity Management Users. NO roles in request or response.
  // Separate service (organization-user.service.ts) from USERS above.
  ORGANIZATION_USERS: buildUrl(`api/${API_VERSION}/organization/users`),
  ORGANIZATION_USER_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/organization/users/${id}`),

  // Application management (L2 Organization Management).
  TENANT_APPLICATIONS: buildUrl(`api/${API_VERSION}/application/applications`),
  TENANT_APPLICATION_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/applications/${id}`),
  // Dropdown for application multi-select in OrganizationDrawer (create/edit mode).
  APPLICATION_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/applications/dropdown`
  ),
  // Tenant-scoped application dropdown for Organization User create/edit form.
  APPLICATION_DROPDOWN_BY_TENANT: buildUrl(
    `api/${API_VERSION}/application/applications/dropdown-by-tenant`
  ),

  // Application-tenant (organization within an application).
  // Backend rule on PUT: existing applicationIds cannot be removed — only additions allowed.
  APPLICATION_TENANTS: buildUrl(
    `api/${API_VERSION}/application/application-tenants`
  ),
  APPLICATION_TENANT_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/application-tenants/${id}`),
  // Dropdown for organization single-select in Organization User create/edit form.
  APPLICATION_TENANT_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/application-tenants/dropdown`
  ),

  // Domains (L2).
  DOMAINS: buildUrl(`api/${API_VERSION}/domains`),
  DOMAINS_DROPDOWN: buildUrl(`api/${API_VERSION}/domains/dropdown`),
  // Active application domain codes for domain picker (fetchApplicationDomainDropdown).
  APPLICATION_DOMAIN_DROPDOWN: buildUrl(
    `api/${API_VERSION}/tenant/application-domains/dropdown`
  ),
  // Tenant domain codes for the Code dropdown in L2 Organization Create.
  TENANT_DOMAIN_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/tenant-domains/dropdown`
  ),

  // ── LEVEL 3 — APPLICATION SETUP ───────────────────────────────────────────

  // Navigation Builder — sidebar menus (GET list, POST create).
  // Also consumed by L4 DefineRoleWorkspace (GET only, into local state).
  SIDEBAR_MENUS: buildUrl(`api/${API_VERSION}/application/sidebar-menus`),
  // Component type palette for the navigation builder.
  APPLICATION_MENU_TYPES: buildUrl(`api/${API_VERSION}/application/menu-types`),
  // Available actions per menu type. Query: ?menuTypeId=<UUID>.
  MENU_TYPE_ACTION_MAPPINGS: buildUrl(
    `api/${API_VERSION}/application/menu-type-action-mappings/by-menu-type`
  ),
  // Policy category dropdown, condition attribute dropdown, policy list/create.
  POLICY_CATEGORY_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/policy-categories/dropdown`
  ),
  ATTRIBUTE_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/attributes/dropdown`
  ),
  APPLICATION_POLICIES: buildUrl(`api/${API_VERSION}/application/policies`),
  // Data categories and values.
  DATA_CATEGORIES: buildUrl(`api/${API_VERSION}/application/data-categories`),
  DATA_CATEGORY_VALUES: buildUrl(
    `api/${API_VERSION}/application/data-category-values`
  ),
  // The values of one data category. Read by the Level-3 Define Data Category
  // tree when a category is expanded — the category list no longer carries them.
  DATA_CATEGORY_VALUES_BY_CATEGORY: (dataCategoryId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/data-category-values/by-data-category?dataCategoryId=${encodeURIComponent(dataCategoryId)}`
    ),

  // ── LEVEL 4 — APPLICATION ROLE MANAGEMENT ─────────────────────────────────

  APPLICATION_USERS: buildUrl(`api/${API_VERSION}/application/users`),

  APPLICATION_ROLES: buildUrl(`api/${API_VERSION}/application/roles`),
  APPLICATION_ROLE_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/roles/${id}`),
  // Id/name pairs for the Level-4 user → role picker (User Management → Map
  // Roles). Distinct from APPLICATION_ROLES above, which is the paginated list.
  APPLICATION_ROLES_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/roles/dropdown`
  ),

  // What one application role grants. Both take { roleId, <ids>[] } and are
  // written by the Save Draft button of the matching Define step.
  APPLICATION_ROLE_POLICY_MAPPINGS: buildUrl(
    `api/${API_VERSION}/application/role-policy-mappings`
  ),
  // The policies already mapped to one application role. Read by the Level-4
  // Policy step to restore its checked state.
  APPLICATION_ROLE_POLICY_MAPPINGS_BY_ROLE: (roleId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-policy-mappings/by-role/${roleId}`
    ),
  // One role → policy mapping record, by the `id` the by-role GET returned.
  // Deleted when a persisted policy is unchecked; there is no update endpoint.
  APPLICATION_ROLE_POLICY_MAPPING_BY_ID: (mappingId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-policy-mappings/${mappingId}`
    ),
  APPLICATION_ROLE_DATA_CATEGORY_MAPPINGS: buildUrl(
    `api/${API_VERSION}/application/role-data-category-mappings`
  ),
  // The data categories already mapped to one application role. Read by the
  // Level-4 Data Category step to restore its checked state.
  APPLICATION_ROLE_DATA_CATEGORY_MAPPINGS_BY_ROLE: (roleId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-data-category-mappings/by-role/${roleId}`
    ),
  // One role → data category mapping record, by the `id` the by-role GET
  // returned. Values cannot be removed individually, so dropping one means
  // deleting the record and recreating it with the values that remain.
  APPLICATION_ROLE_DATA_CATEGORY_MAPPING_BY_ID: (mappingId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-data-category-mappings/${mappingId}`
    ),
  APPLICATION_ROLE_SIDEBAR_MENU_MAPPINGS: buildUrl(
    `api/${API_VERSION}/application/role-sidebar-menu-mappings`
  ),
  // The sidebar menus (and their actions) already mapped to one application
  // role. Read by the Level-4 Layout step to restore its checked state.
  APPLICATION_ROLE_SIDEBAR_MENU_MAPPINGS_BY_ROLE: (roleId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-sidebar-menu-mappings/by-role/${roleId}`
    ),
  // One role → sidebar menu mapping record, by the `id` the by-role GET
  // returned. Actions cannot be removed individually, so dropping one means
  // deleting the record and recreating it with the actions that remain.
  APPLICATION_ROLE_SIDEBAR_MENU_MAPPING_BY_ID: (mappingId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/role-sidebar-menu-mappings/${mappingId}`
    ),

  // Id/name pairs for the Level-4 role → policy picker. Distinct from
  // APPLICATION_POLICIES above, which Level 3 uses for the full policy list.
  APPLICATION_POLICIES_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/policies/dropdown`
  ),
  // Full record for one policy, used by the Level-4 policy preview panel.
  // Note POLICY_BY_ID further down is the identity-control namespace, not this one.
  APPLICATION_POLICY_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/policies/${id}`),
  // Id/name pairs for the Level-4 role → data category picker. Distinct from
  // DATA_CATEGORIES above, which Level 3 uses for the full category records.
  DATA_CATEGORIES_DROPDOWN: buildUrl(
    `api/${API_VERSION}/application/data-categories/dropdown`
  ),
  // Full record for one data category, used by the Level-4 category preview panel.
  DATA_CATEGORY_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/data-categories/${id}`),

  // Who holds which application role. POST adds, PUT replaces the whole set for
  // one user, DELETE takes one assignment away. Every write recomputes that
  // user's access on the backend, so the sidebar follows the assignment.
  APPLICATION_USER_ROLE_MAPPINGS: buildUrl(
    `api/${API_VERSION}/application/user-role-mappings`
  ),
  APPLICATION_USER_ROLE_MAPPINGS_BY_USER: (userId: string) =>
    buildUrl(
      `api/${API_VERSION}/application/user-role-mappings/by-user/${userId}`
    ),
  APPLICATION_USER_ROLE_MAPPING_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/application/user-role-mappings/${id}`),

  // ── NOT YET CONSUMED — endpoint constants reserved for future use ──────────

  // identity-control namespace (distinct from /application/ and /tenants above).
  APPLICATIONS: buildUrl(`api/${API_VERSION}/identity-control/applications`),
  APPLICATION_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/applications/${id}`),
  APPLICATION_SUBMIT: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/applications/${id}/submit`),
  TENANTS: buildUrl(`api/${API_VERSION}/identity-control/tenants`),
  TENANT_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/tenants/${id}`),
  TEMPLATES: buildUrl(`api/${API_VERSION}/identity-control/templates`),
  TEMPLATE_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/templates/${id}`),
  POLICIES: buildUrl(`api/${API_VERSION}/identity-control/policies`),
  POLICY_BY_ID: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/policies/${id}`),
  APPROVALS: buildUrl(`api/${API_VERSION}/identity-control/approvals`),
  APPROVAL_APPROVE: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/approvals/${id}/approve`),
  APPROVAL_REJECT: (id: string) =>
    buildUrl(`api/${API_VERSION}/identity-control/approvals/${id}/reject`),
};
