import "server-only";

import {
  portalClient,
  type PortalResponse,
} from "@/services/identity/portal.server";

/** A menu item as the application master defines it, then fanned out to every tenant. */
export type AppMenu = Readonly<{
  id: string;
  name: string;
  key: string;
  url: string | null;
  description: string | null;
  menuTypeId: string | null;
  menuTypeName: string | null;
  parentId: string | null;
  displayOrder: number | null;
  status: string | null;
  updatedAt: string | null;
}>;

export type MenuType = Readonly<{ id: string; name: string }>;

export type MenuInput = Readonly<{
  name: string;
  key: string;
  url: string;
  description: string;
  menuTypeId: string;
  displayOrder: number;
  status: string;
}>;

const MENUS = "/api/v1/application/sidebar-menus";
const MENU_TYPES = "/api/v1/application/menu-types";

/** Rows may arrive as a page or a bare list depending on the endpoint. */
function rowsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "content" in data) {
    const content = (data as { content?: unknown }).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

export async function fetchMenus(): Promise<AppMenu[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(MENUS);
  return rowsOf<AppMenu>(res.data?.data);
}

/**
 * The menu types the portal offers — Menu, Page and so on.
 *
 * Seeded by the portal, not created here: a type is part of how the portal renders and groups a
 * menu, so inventing one locally would produce a menu it does not know how to place.
 */
export async function fetchMenuTypes(): Promise<MenuType[]> {
  const client = await portalClient();
  const res = await client.get<PortalResponse<unknown>>(MENU_TYPES);
  return rowsOf<MenuType>(res.data?.data).map((t) => ({
    id: t.id,
    name: t.name,
  }));
}

export async function createMenu(input: MenuInput): Promise<void> {
  const client = await portalClient();
  await client.post(MENUS, input);
}

export async function updateMenu(id: string, input: MenuInput): Promise<void> {
  const client = await portalClient();
  await client.put(`${MENUS}/${id}`, input);
}
