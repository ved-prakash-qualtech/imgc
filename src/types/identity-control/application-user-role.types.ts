/**
 * Assignments of application roles to people, inside one application-tenant.
 *
 * The backend returns the username and role name alongside the ids, so a list of
 * "who holds what" renders from one request instead of resolving every id.
 */

export type ApplicationUserRoleMappingStatus = "ACTIVE" | "INACTIVE";

export interface ApplicationUserRoleMappingApiResponse {
  id: string;
  userId: string;
  username: string;
  roleId: string;
  roleName: string;
  status: ApplicationUserRoleMappingStatus;
  createdBy?: string | null;
  createdAt?: string;
  updatedBy?: string | null;
  updatedAt?: string;
}

/**
 * One request shape for both adding and replacing.
 *
 * Keyed by user because that is the direction the work happens in: an administrator
 * opens a person and decides what they may do. POST adds the listed roles to what
 * they already hold; PUT makes the list the complete set.
 */
export interface ApplicationUserRolePayload {
  userId: string;
  roleIds: string[];
}
