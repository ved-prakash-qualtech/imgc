import "server-only";

import { getSessionScope } from "@/lib/auth/session";
import {
  applicationCode,
  organizationClient,
  portalClient,
  type PortalResponse,
} from "@/services/identity/portal.server";

/**
 * The roles and users that administer this application, at the identity portal's
 * application-master level.
 *
 * These are `auth.roles` and `auth.users` in the L3 schema — the same tables, in the same shape,
 * that the system level has at L1. They say who may administer the application: change its
 * tenants, its menus, its master data. They are NOT a tenant's own roles, which live in the
 * tenant's own database and are administered inside it.
 *
 * There are two things called "roles" at this level and it is worth not confusing them:
 *
 *   auth.roles           this file — who may administer the application
 *   application_roles    the business roles a tenant's users hold, an L4 table
 *
 * Only the first exists at the master level, which is why this reads /api/v1/roles rather than
 * /api/v1/application/roles.
 */

export type AppRole = Readonly<{
  id: string;
  name: string;
  description: string | null;
  roleType: string | null;
  /**
   * The portal sends a smallint, not a word — `1` for active. Typed as both because the same
   * shape is read back from this service's own replica, where it may already be a string.
   * Compare with {@link isActiveStatus}, never with `=== "ACTIVE"`.
   */
  status: string | number | null;
  updatedAt: string | null;
}>;

export type AppUser = Readonly<{
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  emailId: string | null;
  mobileNumber: string | null;
  /**
   * The portal sends a smallint, not a word — `1` for active. Typed as both because the same
   * shape is read back from this service's own replica, where it may already be a string.
   * Compare with {@link isActiveStatus}, never with `=== "ACTIVE"`.
   */
  status: string | number | null;
  roles: readonly { id: string; name: string }[] | null;
  updatedAt: string | null;
}>;

export type RoleInput = Readonly<{
  /** USER, CLIENT or BOTH — whether the role is held by people, by API clients, or both. */
  roleType: string;
  name: string;
  description: string;
}>;

export type UserInput = Readonly<{
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  roles: string[];
  /** Required by the organization level; ignored at the application master. */
  gender?: string;
  /** ISO date, required by the organization level; ignored at the application master. */
  dateOfBirth?: string;
}>;

const ROLES = "/api/v1/roles";
/**
 * A tenant's roles are `identity.application_roles`, not `auth.roles`.
 *
 * <p>Both exist in an application-tenant database, structurally identical, and the difference
 * matters: every permission mapping — menus, policies, data categories — carries a foreign key
 * onto `application_roles`. A role created in the other one can be granted to a user and can never
 * be given a permission, which is the shape the tenant Roles screen was in before this.
 */
const TENANT_ROLES = "/api/v1/application/roles";
const USERS = "/api/v1/users";
/** Read-only at the application-tenant level: the people fanned out to this tenant. */
const TENANT_USERS = "/api/v1/application/users";
/** Where a user is actually created — the organization, one level up. */
const ORGANIZATION_USERS = "/api/v1/organization/users";
const APPLICATION_TENANTS = "/api/v1/application/application-tenants";
const APPLICATIONS = "/api/v1/application/applications";
const TENANT_USER_ROLES = "/api/v1/application/user-role-mappings";

function rowsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "content" in data) {
    const content = (data as { content?: unknown }).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

export async function fetchRoles(): Promise<AppRole[]> {
  const { scope } = await getSessionScope();
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(
    scope === "TENANT" ? TENANT_ROLES : ROLES
  );
  return rowsOf<AppRole>(res.data?.data);
}

export async function createRole(input: RoleInput): Promise<void> {
  const { scope } = await getSessionScope();
  const client = await portalClient();
  if (scope === "TENANT") {
    await client.post(TENANT_ROLES, tenantRolePayload(input));
    return;
  }
  await client.post(ROLES, input);
}

export async function updateRole(id: string, input: RoleInput): Promise<void> {
  const { scope } = await getSessionScope();
  const client = await portalClient();
  if (scope === "TENANT") {
    await client.put(`${TENANT_ROLES}/${id}`, tenantRolePayload(input));
    return;
  }
  await client.put(`${ROLES}/${id}`, input);
}

/**
 * The application-role endpoints take enums where the master level takes the same values as
 * strings, and require a status the master level defaults.
 */
function tenantRolePayload(input: RoleInput) {
  return {
    roleType: input.roleType === "CLIENT" ? "API_CLIENT" : input.roleType,
    name: input.name,
    description: input.description,
    status: "ACTIVE",
  };
}

/**
 * The people at this level.
 *
 * <p>A tenant reads {@code /api/v1/application/users}, which is the application-tenant's own list
 * — the people who were granted this application when they were added to the organization, and who
 * the portal fanned out into this tenant. An administrator at the master level reads
 * {@code /api/v1/users}, which is who may administer the application itself. Two different
 * questions, so two different endpoints, and the scope decides.
 */
export async function fetchUsers(): Promise<AppUser[]> {
  const { scope } = await getSessionScope();
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(
    scope === "TENANT" ? TENANT_USERS : USERS
  );
  const users = rowsOf<AppUser>(res.data?.data);
  if (scope !== "TENANT") return users;

  // The application-tenant user endpoint returns no roles, so the Roles column would read empty
  // for everybody and the edit drawer would open with nothing selected — which looks like the
  // roles were lost rather than never sent. One extra call fills in the whole column.
  const mappings = await client
    .get<PortalResponse<unknown>>(TENANT_USER_ROLES)
    .then((r) =>
      rowsOf<{ userId?: string; roleId?: string; roleName?: string }>(
        r.data?.data
      )
    )
    .catch(() => []);

  const rolesByUser = new Map<string, { id: string; name: string }[]>();
  for (const row of mappings) {
    if (!row.userId || !row.roleId) continue;
    const held = rolesByUser.get(row.userId) ?? [];
    held.push({ id: row.roleId, name: row.roleName ?? "" });
    rolesByUser.set(row.userId, held);
  }

  return users.map((user) => ({
    ...user,
    roles: rolesByUser.get(user.id) ?? [],
  }));
}

/**
 * Creates a user.
 *
 * <h2>A tenant's user is created at the organization, not at the tenant</h2>
 * There is no endpoint that creates a user inside an application tenant, and that is deliberate
 * rather than missing: a person belongs to the organization, and an application tenant is one of
 * the places their access reaches. So adding someone here posts to
 * {@code /api/v1/organization/users} at L2, naming this tenant and this application, and the
 * portal fans them out — into the application-tenant database, and into Keycloak with the roles
 * they were given.
 *
 * <p>Which is why this needs two ids the screen does not have: the application tenant's, and the
 * application's. Both are resolved from the portal by code rather than configured, so nothing has
 * to be kept in step by hand.
 *
 * <p>At the master level none of that applies and the user is created where they are.
 */
export async function createUser(input: UserInput): Promise<void> {
  const { scope, tenant } = await getSessionScope();
  if (scope !== "TENANT") {
    const client = await portalClient();
    await client.post(USERS, input);
    return;
  }
  if (!tenant) {
    throw new Error(
      "Tenant scope with no tenant code — the user cannot be placed"
    );
  }

  const client = await organizationClient();
  const [applicationTenantId, applicationId] = await Promise.all([
    applicationTenantIdFor(client, tenant),
    applicationIdFor(client),
  ]);

  await client.post(ORGANIZATION_USERS, {
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    emailId: input.emailId,
    mobileNumber: input.mobileNumber,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    applicationTenantId,
    applicationIds: [applicationId],
  });

  // Two calls, because the organization endpoint takes no roles. Creating the user fans them out
  // into this tenant; giving them a role is a separate decision made here, and it is what puts the
  // role into their token — the portal mirrors it into Keycloak as a client role.
  await assignTenantRoles(input.username, input.roles);
}

/**
 * Gives a freshly fanned-out user their roles at this tenant.
 *
 * <p>The user is found by username rather than by the id the organization returned: an application
 * tenant keeps its own row for a person, with its own id, and the mapping endpoint wants that one.
 */
async function assignTenantRoles(
  username: string,
  roleIds: readonly string[]
): Promise<void> {
  if (roleIds.length === 0) return;
  const client = await portalClient();

  const res = await client.get<PortalResponse<unknown>>(TENANT_USERS);
  const user = rowsOf<{ id?: string; username?: string }>(res.data?.data).find(
    (row) => row.username === username
  );
  if (!user?.id) {
    throw new Error(
      `'${username}' was created at the organization but has not reached this tenant yet, ` +
        "so their roles could not be assigned. Open the user and set the roles again."
    );
  }
  await client.post(TENANT_USER_ROLES, { userId: user.id, roleIds });
}

export async function updateUser(id: string, input: UserInput): Promise<void> {
  const { scope } = await getSessionScope();
  if (scope !== "TENANT") {
    const client = await portalClient();
    await client.put(`${USERS}/${id}`, input);
    return;
  }
  const client = await organizationClient();
  await client.put(`${ORGANIZATION_USERS}/${id}`, {
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    emailId: input.emailId,
    mobileNumber: input.mobileNumber,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
  });

  // Replace rather than assign: the form sends the complete intended set, so a role taken away on
  // the screen has to be taken away here — and from the user's token with it.
  const tenantClient = await portalClient();
  const res = await tenantClient.get<PortalResponse<unknown>>(TENANT_USERS);
  const user = rowsOf<{ id?: string; username?: string }>(res.data?.data).find(
    (row) => row.username === input.username
  );
  if (user?.id) {
    await tenantClient.put(TENANT_USER_ROLES, {
      userId: user.id,
      roleIds: input.roles,
    });
  }
}

async function applicationTenantIdFor(
  client: Awaited<ReturnType<typeof organizationClient>>,
  tenantCode: string
): Promise<string> {
  const res = await client.get<PortalResponse<{ id?: string }>>(
    `${APPLICATIONS_TENANT_BY_CODE(tenantCode)}`
  );
  const id = res.data?.data?.id;
  if (!id) {
    throw new Error(
      `The identity portal has no application tenant '${tenantCode}', so a user cannot be added to it`
    );
  }
  return id;
}

const APPLICATIONS_TENANT_BY_CODE = (code: string) =>
  `${APPLICATION_TENANTS}/by-code/${encodeURIComponent(code)}`;

async function applicationIdFor(
  client: Awaited<ReturnType<typeof organizationClient>>
): Promise<string> {
  const code = applicationCode();
  const res = await client.get<PortalResponse<unknown>>(APPLICATIONS);
  const found = rowsOf<{ id?: string; applicationCode?: string }>(
    res.data?.data
  ).find((row) => row.applicationCode === code);
  if (!found?.id) {
    throw new Error(
      `The identity portal has no application '${code}', so it cannot be granted to a new user`
    );
  }
  return found.id;
}
