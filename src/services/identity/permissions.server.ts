import "server-only";

import {
  portalClient,
  type PortalResponse,
} from "@/services/identity/portal.server";

/**
 * What a tenant's role is permitted to do — the menus it may see, and which actions on each.
 *
 * <p>This is the application-tenant level (L4) and only that level. An application master authors
 * the vocabulary — which screens exist, which policies and data categories — and a tenant decides
 * who may use it. So these endpoints are all under {@code /api/v1/application/…} on the tenant's
 * own portal host, and the level comes from the host as it does everywhere else.
 *
 * <h2>Why a menu carries actions and not a checkbox</h2>
 * A permission is not "may see this screen". {@code VISIBLE} and {@code CLICKABLE} say whether it
 * appears and whether it can be opened; {@code VIEW}, {@code INSERT}, {@code UPDATE} and
 * {@code APPROVE} say what may be done once it is. The portal requires at least one action per
 * menu, which is what stops a mapping that grants a screen and nothing on it.
 *
 * <h2>Saving is delete-then-add</h2>
 * The portal's POST is additive and refuses a mapping that already exists, so there is no single
 * call that says "make it exactly this". Anything dropped is deleted first and the remainder
 * posted — done in that order so a menu whose actions changed does not collide with its own
 * previous row on the way through.
 */

export type AppAction = Readonly<{
  id: string;
  actionCode: string;
  actionName: string;
}>;

export type TenantMenu = Readonly<{
  id: string;
  name: string;
  key: string;
  url: string | null;
  parentId: string | null;
  displayOrder: number | null;
}>;

/** One menu a role holds, with the actions it holds on it. */
export type RoleMenuGrant = Readonly<{
  /** Mapping row id — needed to delete it. */
  id: string;
  sidebarMenuId: string;
  actionIds: readonly string[];
}>;

/** What the drawer sends back: the complete intended set. */
export type RoleMenuSelection = Readonly<{
  sidebarMenuId: string;
  actionIds: readonly string[];
}>;

const ACTIONS = "/api/v1/application/actions";
const MENUS = "/api/v1/application/sidebar-menus";
const ROLE_MENUS = "/api/v1/application/role-sidebar-menu-mappings";

function rowsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "content" in data) {
    const content = (data as { content?: unknown }).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

export async function fetchActions(): Promise<AppAction[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(ACTIONS);
  return rowsOf<AppAction>(res.data?.data);
}

export async function fetchTenantMenus(): Promise<TenantMenu[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(MENUS);
  return rowsOf<TenantMenu>(res.data?.data).sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
}

export async function fetchRoleMenus(roleId: string): Promise<RoleMenuGrant[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(
    `${ROLE_MENUS}/by-role/${encodeURIComponent(roleId)}`
  );
  return rowsOf<{
    id: string;
    sidebarMenuId: string;
    actions?: { id: string }[] | null;
  }>(res.data?.data).map((row) => ({
    id: row.id,
    sidebarMenuId: row.sidebarMenuId,
    actionIds: (row.actions ?? []).map((a) => a.id),
  }));
}

/**
 * Makes the role's menu grants exactly this set.
 *
 * <p>A selection with no actions is not a grant and is dropped rather than sent — the portal would
 * refuse it, and "this menu, nothing on it" is a state the screen should not be able to produce.
 */
export async function saveRoleMenus(
  roleId: string,
  selections: readonly RoleMenuSelection[]
): Promise<void> {
  const client = await portalClient();
  const wanted = selections.filter((s) => s.actionIds.length > 0);
  const existing = await fetchRoleMenus(roleId);

  const sameActions = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

  // Unchanged rows are left alone: rewriting one would churn its audit columns for nothing.
  const unchanged = new Set(
    existing
      .filter((row) =>
        wanted.some(
          (want) =>
            want.sidebarMenuId === row.sidebarMenuId &&
            sameActions(want.actionIds, row.actionIds)
        )
      )
      .map((row) => row.sidebarMenuId)
  );

  const toDelete = existing.filter((row) => !unchanged.has(row.sidebarMenuId));
  for (const row of toDelete) {
    await client.delete(`${ROLE_MENUS}/${encodeURIComponent(row.id)}`);
  }

  const toAdd = wanted.filter((want) => !unchanged.has(want.sidebarMenuId));
  if (toAdd.length > 0) {
    await client.post(ROLE_MENUS, {
      roleId,
      sidebarMenus: toAdd.map((want) => ({
        sidebarMenuId: want.sidebarMenuId,
        actionIds: want.actionIds,
      })),
    });
  }
}

/* ------------------------------------------------------------------------- *
 * Policies and data categories
 *
 * The other two halves of what a role may do. Menus decide which screens it
 * reaches; a data category decides which records reach those screens; a policy
 * decides which of those records it may act on. The portal's own L4 role screens
 * treat them as three steps of one job, and so does this.
 * ------------------------------------------------------------------------- */

export type AppPolicy = Readonly<{
  id: string;
  name: string;
  description: string | null;
}>;

export type AppDataCategory = Readonly<{
  id: string;
  name: string;
  description: string | null;
}>;

export type AppDataCategoryValue = Readonly<{
  id: string;
  dataCategoryId: string;
  value: string;
}>;

/** One policy a role holds — the mapping row id is what deletes it. */
export type RolePolicyGrant = Readonly<{ id: string; policyId: string }>;

/** One data category a role holds, with the values of it that were granted. */
export type RoleDataCategoryGrant = Readonly<{
  id: string;
  dataCategoryId: string;
  dataCategoryValueIds: readonly string[];
}>;

const POLICIES = "/api/v1/application/policies";
const DATA_CATEGORIES = "/api/v1/application/data-categories";
const DATA_CATEGORY_VALUES = "/api/v1/application/data-category-values";
const ROLE_POLICIES = "/api/v1/application/role-policy-mappings";
const ROLE_DATA_CATEGORIES = "/api/v1/application/role-data-category-mappings";

export async function fetchPolicies(): Promise<AppPolicy[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(POLICIES);
  return rowsOf<AppPolicy>(res.data?.data);
}

export async function fetchDataCategories(): Promise<AppDataCategory[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(DATA_CATEGORIES);
  return rowsOf<AppDataCategory>(res.data?.data);
}

/**
 * Every value of every data category this tenant has.
 *
 * <p>Asked category by category, because the portal serves values only under a category: a GET of
 * the bare collection is not mapped at all and answers 405. It was called anyway on every visit to
 * the Roles screen, the failure was swallowed by the caller's `.catch(() => [])`, and the drawer
 * simply showed no values -- while the portal logged an internal error for each one.
 *
 * <p>The categories have to be read first to know what to ask for, which is the cost of the
 * missing collection endpoint and not worth caching: a tenant has a handful of categories.
 */
export async function fetchDataCategoryValues(): Promise<
  AppDataCategoryValue[]
> {
  const client = await portalClient();
  const categories = await fetchDataCategories();
  const perCategory = await Promise.all(
    categories.map(async (category) => {
      const res = await client.get<PortalResponse<unknown>>(
        `${DATA_CATEGORY_VALUES}/by-data-category?dataCategoryId=${encodeURIComponent(category.id)}`
      );
      return rowsOf<AppDataCategoryValue>(res.data?.data);
    })
  );
  return perCategory.flat();
}

export async function fetchRolePolicies(
  roleId: string
): Promise<RolePolicyGrant[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(
    `${ROLE_POLICIES}/by-role/${encodeURIComponent(roleId)}`
  );
  return rowsOf<RolePolicyGrant>(res.data?.data);
}

export async function fetchRoleDataCategories(
  roleId: string
): Promise<RoleDataCategoryGrant[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(
    `${ROLE_DATA_CATEGORIES}/by-role/${encodeURIComponent(roleId)}`
  );
  return rowsOf<RoleDataCategoryGrant>(res.data?.data);
}

/** Makes the role's policies exactly this set. Delete-then-add, as for menus. */
export async function saveRolePolicies(
  roleId: string,
  policyIds: readonly string[]
): Promise<void> {
  const client = await portalClient();
  const existing = await fetchRolePolicies(roleId);

  for (const row of existing.filter((r) => !policyIds.includes(r.policyId))) {
    await client.delete(`${ROLE_POLICIES}/${encodeURIComponent(row.id)}`);
  }
  const held = new Set(existing.map((r) => r.policyId));
  const toAdd = policyIds.filter((id) => !held.has(id));
  if (toAdd.length > 0) {
    await client.post(ROLE_POLICIES, { roleId, policyIds: toAdd });
  }
}

/**
 * Makes the role's data categories exactly this set.
 *
 * <p>A category is granted with the values of it the role may see, and the portal refuses a
 * category with no values — so a category ticked with nothing under it is dropped rather than
 * sent, the same rule the menu matrix follows for actions.
 */
export async function saveRoleDataCategories(
  roleId: string,
  selections: readonly Readonly<{
    dataCategoryId: string;
    dataCategoryValueIds: readonly string[];
  }>[]
): Promise<void> {
  const client = await portalClient();
  const wanted = selections.filter((s) => s.dataCategoryValueIds.length > 0);
  const existing = await fetchRoleDataCategories(roleId);

  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

  const unchanged = new Set(
    existing
      .filter((row) =>
        wanted.some(
          (want) =>
            want.dataCategoryId === row.dataCategoryId &&
            same(want.dataCategoryValueIds, row.dataCategoryValueIds)
        )
      )
      .map((row) => row.dataCategoryId)
  );

  for (const row of existing.filter((r) => !unchanged.has(r.dataCategoryId))) {
    await client.delete(
      `${ROLE_DATA_CATEGORIES}/${encodeURIComponent(row.id)}`
    );
  }
  const toAdd = wanted.filter((w) => !unchanged.has(w.dataCategoryId));
  if (toAdd.length > 0) {
    await client.post(ROLE_DATA_CATEGORIES, {
      roleId,
      dataCategories: toAdd.map((w) => ({
        dataCategoryId: w.dataCategoryId,
        dataCategoryValueIds: w.dataCategoryValueIds,
      })),
    });
  }
}
