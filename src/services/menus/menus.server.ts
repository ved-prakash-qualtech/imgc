import "server-only";

import type { NavItem, NavKey } from "@/constants/nav";
import { ssrApi } from "@/services/api/ssrApi";

/**
 * The sidebar this signed-in person on this host is allowed.
 *
 * `GET /api/v1/menus` answers from the database the request belongs to — the administrator's
 * console reads `auth.sidebar_menus`, a tenant reads its own — so the sidebar is a property of
 * the service and the host, not a list kept in the frontend. Adding a screen means adding a row,
 * not editing an array here and remembering to deploy the frontend.
 *
 * `menuCode` is the join between the two halves: the service names a menu, the sidebar maps that
 * name to an icon. The title is display text and may be renamed without anything breaking.
 */

type MenuItemDto = Readonly<{
  id: string;
  menuCode: string | null;
  menuLabel: string;
  parentMenuId: string | null;
  sectionCode: string | null;
  routePath: string | null;
  displayOrder: number | null;
}>;

type MenusEnvelope = Readonly<{ data?: MenuItemDto[] }>;

/**
 * Menus for the current request, or null when the service cannot answer.
 *
 * Null rather than an empty array, and the distinction matters: a service that returns no menus
 * is saying this person may open nothing, while a service that cannot be reached is saying
 * nothing at all. The caller falls back to the static list only in the second case — falling
 * back in the first would hand someone a sidebar they were not granted.
 */
export async function fetchSidebarMenus(): Promise<NavItem[] | null> {
  try {
    // The factory returns the parsed body, not an axios response — so this is the APIResponse
    // envelope itself, and the menus are one level down in `data`.
    const envelope = await ssrApi.admin.get<MenusEnvelope>("/api/v1/menus");
    const items = envelope?.data;
    if (!Array.isArray(items)) return null;

    return toTree(items);
  } catch {
    // Unreachable, unauthorised, or not yet implemented in this service. The sidebar is not the
    // place to surface that — the page still has to render, and the caller has a static list.
    return null;
  }
}

/**
 * Rebuilds the parent/child shape the rows describe.
 *
 * <p>The previous version dropped every row without a `routePath`, which quietly made a
 * database-driven sidebar impossible: a group header is precisely a row with no path — clicking
 * it expands rather than navigates — so groups could never survive the trip, and the frontend
 * had to keep its own hardcoded copy of the nav to show them. Anything with neither a path nor
 * children is still dropped, because that is a row nobody can do anything with.
 */
function toTree(items: MenuItemDto[]): NavItem[] {
  const byOrder = (a: MenuItemDto, b: MenuItemDto) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0);

  const children = new Map<string, MenuItemDto[]>();
  for (const item of items) {
    if (!item.parentMenuId) continue;
    const siblings = children.get(item.parentMenuId) ?? [];
    siblings.push(item);
    children.set(item.parentMenuId, siblings);
  }

  const toNav = (item: MenuItemDto): NavItem | null => {
    const kids = (children.get(item.id) ?? [])
      .sort(byOrder)
      .map(toNav)
      .filter((child): child is NavItem => child !== null);

    if (!item.routePath && kids.length === 0) return null;

    return {
      key: (item.menuCode ?? item.id) as NavKey,
      label: item.menuLabel,
      ...(item.routePath ? { href: item.routePath } : {}),
      ...(kids.length ? { children: kids } : {}),
    };
  };

  return items
    .filter((item) => !item.parentMenuId)
    .sort(byOrder)
    .map(toNav)
    .filter((item): item is NavItem => item !== null);
}
