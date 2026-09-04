import "server-only";

import {
  fetchRoleMenus,
  fetchTenantMenus,
} from "@/services/identity/permissions.server";
import { ssrApi } from "@/services/api/ssrApi";

/**
 * Copies a tenant's role→menu grants from the identity portal into this product's own database.
 *
 * <h2>Why a copy exists at all</h2>
 * The portal is where a grant is authored: the permissions drawer writes to
 * {@code /api/v1/application/role-sidebar-menu-mappings} at the tenant's own level (L4), which is
 * correct — the portal owns identity, and a grant is an identity fact. But the sidebar is drawn
 * from {@code GET /api/v1/menus} on this product, which answers from
 * {@code identity.role_sidebar_menu_mapping} in the tenant's own database. Those are two tables in
 * two databases, and nothing joined them: a tenant administrator could grant a menu, watch the
 * portal accept it, and find the sidebar unchanged — which is exactly what happened on 29 Aug 2026
 * and was repaired by hand with SQL.
 *
 * <p>The product keeps its own copy rather than asking the portal per request for two reasons: the
 * sidebar renders on every page and must not depend on a second service being up, and the backend
 * has to make the same decision server-side when it authorises a call, where there is no session
 * to borrow a portal token from.
 *
 * <h2>Why the console does the copying</h2>
 * The obvious place is the product's own reconcile, which already pulls menus down from the
 * application master on a timer. It cannot pull grants: those live at each tenant's level, the
 * portal decides the level from the hostname, and its audience validation wants a token minted for
 * that tenant's OAuth client. The reconcile's service account holds the master's audience and is
 * refused with a 401 — and no per-tenant credential exists to give it. (Reading a tenant's grants
 * unattended needs either an audience mapper per tenant on that service account, or the
 * application client credential the portal issues once at creation and has no endpoint to reveal.)
 *
 * <p>The console has what the reconcile lacks: it is already talking to the tenant's own portal
 * level, with the tenant administrator's own token, at the moment the grant is made. So the copy
 * is made here, by the person whose decision it was, with their own authority — nothing is
 * escalated, and the product's PUT is itself guarded by {@code hasRole('APP_ADMIN')}.
 *
 * <h2>When it runs</h2>
 * On save, and again whenever the Roles screen is opened. The second is what makes it self-healing:
 * a tenant database rebuilt from migrations comes back with only its seeded grants, and the first
 * administrator to visit Roles restores the rest without knowing they did. Both directions matter,
 * because a grant removed in the portal has to stop drawing a menu here too — the product endpoint
 * replaces the set rather than adding to it.
 *
 * <h2>Failure is silent on purpose</h2>
 * A failed copy must not fail the save. The portal has accepted the grant and that is the record
 * that counts; the sidebar catching up one visit later is a much better outcome than an
 * administrator being told their save failed when it did not. Every failure is logged and
 * swallowed.
 */

/**
 * Grants travel as menu keys, never as menu ids.
 *
 * <p>The same menu has a different id at every level of the portal: the application master issues
 * one, each tenant's own level issues another, and this product's database carries the master's,
 * because that is what its reconcile adopts. So the id in a grant made at the tenant level means
 * nothing to the product — and the failure is silent, because the product would happily store a
 * grant against an id that joins to no menu while revoking the ones that did. On 29 Aug 2026 the
 * two sets were `c2e4f3d5-…` at the tenant level and `b1f3d2c4-…` in the product, for the same
 * seven menus, with the same keys.
 *
 * <p>Role ids, by contrast, are the same on both sides and are sent as ids. That is not luck —
 * roles are seeded from the same migration on both — but the product verifies the role exists
 * rather than trusting it, and answers 404 if it does not.
 */
async function keysForMenuIds(menuIds: readonly string[]): Promise<string[]> {
  const menus = await fetchTenantMenus();
  const keyById = new Map(menus.map((menu) => [menu.id, menu.key]));
  return menuIds
    .map((id) => keyById.get(id))
    .filter((key): key is string => typeof key === "string" && key.length > 0);
}

/** Makes the product's copy of one role's grants exactly the menus these portal ids name. */
export async function mirrorRoleMenus(
  roleId: string,
  portalMenuIds: readonly string[]
): Promise<void> {
  try {
    const keys = await keysForMenuIds(portalMenuIds);
    await ssrApi.admin.put(
      `/api/v1/roles/${encodeURIComponent(roleId)}/menu-keys`,
      keys
    );
  } catch (error) {
    // Nothing user-facing: see the note on silent failure above.
    console.warn(
      `[grant-sync] could not mirror grants for role ${roleId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Reads what the portal holds for these roles and makes the product agree.
 *
 * <p>One round trip per role, and deliberately not batched: the portal has no endpoint that
 * answers for several roles at once, and a tenant has a handful of roles rather than hundreds.
 * The menu list is read once for all of them. Roles are done in parallel and independently — one
 * role whose grants cannot be read must not stop the others being repaired.
 */
export async function syncRoleGrantsFromPortal(
  roleIds: readonly string[]
): Promise<void> {
  const menus = await fetchTenantMenus().catch(() => []);
  if (menus.length === 0) return;
  const keyById = new Map(menus.map((menu) => [menu.id, menu.key]));

  await Promise.all(
    roleIds.map(async (roleId) => {
      try {
        const grants = await fetchRoleMenus(roleId);
        const keys = grants
          .map((grant) => keyById.get(grant.sidebarMenuId))
          .filter((key): key is string => typeof key === "string");
        await ssrApi.admin.put(
          `/api/v1/roles/${encodeURIComponent(roleId)}/menu-keys`,
          keys
        );
      } catch (error) {
        console.warn(
          `[grant-sync] could not sync grants for role ${roleId}:`,
          error instanceof Error ? error.message : error
        );
      }
    })
  );
}
