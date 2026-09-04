import type { PaginatedData } from "@/lib/api.types";
import {
  mapUserStatus,
  type UserStatus,
} from "@/types/identity-control/user.types";

/**
 * Application Users — Level-4 (TENANT) Identity Management → Users.
 *
 * Backed by /api/v1/application/users.
 * Distinct from Administration Users (/api/v1/users) and
 * Organization Users (/api/v1/organization/users).
 */
export interface ApplicationUserApiResponse {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender?: string;
  dateOfBirth?: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationUserPage = PaginatedData<ApplicationUserApiResponse>;

export interface ApplicationUser {
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
}

export function mapApplicationUserApiResponse(
  item: ApplicationUserApiResponse
): ApplicationUser {
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
  };
}
