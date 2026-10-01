/**
 * Backend-Driven Sidebar Types
 *
 * Types for sidebar API responses and menu items.
 * Backend menu items support path: string | null for parent menu items.
 */

/**
 * Backend API Response Types
 */

export interface BackendUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  sendActivationEmail: boolean;
  sendActivationSms: boolean;
  status: number;
}

export interface BackendRole {
  id: string;
  roleType: string;
  name: string;
  description: string;
  status: number;
}

/**
 * Raw backend menu item from accessJson
 *
 * Note: path can be null for parent menu items (e.g., "Identity Management", "Administration")
 * Children contain the actual navigable paths.
 */
export interface BackendMenuItem {
  id: string;
  icon: string | null;
  path: string | null;
  title: string;
  children: BackendMenuItem[];
  orderIndex: number;
  description?: string;
}

/**
 * API Response: GET /api/v1/users/me
 */
export interface UsersMeResponse {
  status: string;
  statusCode: number;
  message: string;
  data: {
    user: BackendUser;
    roles: BackendRole[];
  };
}

/**
 * API Response: GET /api/v1/user-access-controls/{userId}
 */
export interface UserAccessControlResponse {
  status: string;
  statusCode: number;
  message: string;
  data: {
    id: string;
    principalId: string;
    accessJson: string; // JSON string, not parsed
    status: number;
  };
}

/**
 * Service Response: Combined sidebar data
 */
export interface SidebarDataResponse {
  user: BackendUser | null;
  roles: BackendRole[];
  menuItems: BackendMenuItem[];
  error: string | null;
}

/**
 * Validation Functions
 */

/**
 * Validate if an unknown value is a BackendMenuItem
 */
export function validateBackendMenuItem(
  item: unknown
): item is BackendMenuItem {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const menuItem = item as Record<string, unknown>;

  return (
    typeof menuItem.id === "string" &&
    typeof menuItem.title === "string" &&
    (menuItem.path === null || typeof menuItem.path === "string") &&
    (menuItem.icon === null || typeof menuItem.icon === "string") &&
    typeof menuItem.orderIndex === "number" &&
    Array.isArray(menuItem.children)
  );
}

/**
 * Validate and filter an array of menu items
 */
export function validateBackendMenuItems(items: unknown[]): BackendMenuItem[] {
  return items.filter(validateBackendMenuItem);
}

/**
 * Menu Normalization Functions
 */

/**
 * Order menu items by the backend-provided orderIndex, recursively.
 *
 * orderIndex from GET /api/v1/user-access-controls/{userId} is the ONLY
 * ordering input. There are no per-title or per-context special cases, so
 * changing orderIndex on the backend changes the rendered order with no
 * frontend change. Titles, paths, icons, orderIndex and the parent/child
 * hierarchy are all passed through untouched.
 *
 * Equal orderIndex values keep the backend's array order, because
 * Array.prototype.sort is stable (ES2019+).
 *
 * Never mutates the input array.
 */
export function sortMenuItems(items: BackendMenuItem[]): BackendMenuItem[] {
  return [...items]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => ({
      ...item,
      children: item.children ? sortMenuItems(item.children) : [],
    }));
}
