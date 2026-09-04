/**
 * Organization Users — types for Identity Management → Users (L2 ORGANIZATION).
 *
 * Backed by /api/v1/organization/users. This is a DIFFERENT module from
 * Administration Users (/api/v1/users, see user.types.ts):
 *
 *   Identity Management → Users : this file. NO roles anywhere.
 *   Administration      → Users : user.types.ts. Roles included.
 *
 * Keep the two contracts separate. The only thing intentionally shared is the
 * numeric status vocabulary, reused from user.types.ts so status pills render
 * consistently across the app.
 */

import {
  mapUserStatus,
  type UserStatus,
} from "@/types/identity-control/user.types";

/**
 * Application summary returned inside GET /api/v1/organization/users/{id} and
 * GET /api/v1/organization/users.
 */
export interface OrganizationUserApplication {
  id: string;
  applicationName: string;
  applicationCode: string;
}

/**
 * Application-tenant summary returned inside GET /api/v1/organization/users/{id}
 * and GET /api/v1/organization/users.
 */
export interface OrganizationUserApplicationTenant {
  id: string;
  tenantName: string;
  tenantCode: string;
}

/**
 * Raw item from GET /api/v1/organization/users and
 * GET /api/v1/organization/users/{id}.
 *
 * Note: the response contains no `roles` field, by design.
 *
 * For GET-by-ID, `applicationTenant` and `applications` are now returned so the
 * edit form can pre-select the existing organization and applications.
 */
export interface OrganizationUserApiResponse {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender?: string;
  dateOfBirth?: string;
  sendActivationEmail?: boolean;
  sendActivationSms?: boolean;
  status: number;
  createdAt: string;
  updatedAt: string;
  applicationTenant?: OrganizationUserApplicationTenant;
  applications?: OrganizationUserApplication[];
}

/**
 * `data` envelope of GET /api/v1/organization/users.
 *
 * The backend returns only these three keys — it is NOT the full Spring page
 * shape used by PaginatedData, so it gets its own type rather than being forced
 * into the Administration Users one.
 */
export interface OrganizationUserPage {
  content: OrganizationUserApiResponse[];
  totalElements: number;
  totalPages: number;
}

/**
 * Body of POST /api/v1/organization/users
 *
 * Core user fields plus organization/application mappings:
 *   applicationTenantId — the selected organization (from /application-tenants/dropdown)
 *   applicationIds      — selected application ids (from /applications/dropdown), always an array
 *
 * There is deliberately no `roles` key — role assignment belongs to
 * Administration Users only.
 */
export interface CreateOrganizationUserPayload {
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  applicationTenantId: string;
  applicationIds: string[];
}

/**
 * Body of PUT /api/v1/organization/users/{id}
 *
 * Same shape as create per the backend contract. Named separately so a
 * future divergence does not require renaming call sites. Still no `roles`.
 */
export type UpdateOrganizationUserPayload = CreateOrganizationUserPayload;

/** UI model for an organization user. No roles. */
export interface OrganizationUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  gender?: string;
  dateOfBirth?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  organizationId?: string;
  organizationName?: string;
  applicationIds?: string[];
  applicationNames?: string[];
}

export function mapOrganizationUserApiResponse(
  item: OrganizationUserApiResponse
): OrganizationUser {
  return {
    id: item.id,
    username: item.username,
    firstName: item.firstName,
    lastName: item.lastName,
    fullName: `${item.firstName} ${item.lastName}`.trim(),
    email: item.emailId,
    mobileNumber: item.mobileNumber,
    gender: item.gender,
    dateOfBirth: item.dateOfBirth,
    status: mapUserStatus(item.status),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    organizationId: item.applicationTenant?.id,
    organizationName: item.applicationTenant?.tenantName,
    applicationIds: Array.isArray(item.applications)
      ? item.applications.map((a) => a.id)
      : [],
    applicationNames: Array.isArray(item.applications)
      ? item.applications.map((a) => a.applicationName)
      : [],
  };
}
