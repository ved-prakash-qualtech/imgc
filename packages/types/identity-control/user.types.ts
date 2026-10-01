export type UserStatus =
  "Active" | "Suspended" | "Pending" | "Locked" | "Inactive";
export type MfaStatus = "Enabled" | "Disabled" | "Pending";

/**
 * API-specific types for Users GET and CREATE endpoints
 * Backend contract: GET /api/v1/users, POST /api/v1/users
 */

/**
 * Role object returned by GET /api/v1/users and GET /api/v1/roles/dropdown
 */
export interface UserRole {
  id: string;
  name: string;
}

/**
 * Raw API response from GET /api/v1/users
 * status field is numeric: 1=Active, 0=Inactive, 2=Pending, 3=Suspended, 4=Locked
 * roles is an array of role objects (not strings)
 */
export interface UserApiResponse {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender?: string;
  dateOfBirth?: string;
  sendActivationEmail: boolean;
  sendActivationSms: boolean;
  status: number;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  roles?: UserRole[];
}

export interface CreateUserPayload {
  username: string;
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  roles: string[];
}

/**
 * PUT /api/v1/users/{id} — username is NOT included in the Administration update contract.
 * Username cannot be changed after creation; omitting it here enforces that at
 * the type level so call sites cannot accidentally send it.
 * Level-2 Organization Users have a different update contract (see organization-user.types.ts).
 */
export interface UpdateUserPayload {
  firstName: string;
  lastName: string;
  emailId: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  roles: string[];
}

export function mapUserStatus(status: number): UserStatus {
  switch (status) {
    case 1:
      return "Active";
    case 0:
      return "Inactive";
    case 2:
      return "Pending";
    case 3:
      return "Suspended";
    case 4:
      return "Locked";
    default:
      return "Inactive";
  }
}

export interface User {
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
  roles?: UserRole[];
  // Optional Level-2 Organization User display fields. Not set by Administration Users.
  organizationId?: string;
  organizationName?: string;
  applicationIds?: string[];
  applicationNames?: string[];
}

export function mapUserApiResponse(item: UserApiResponse): User {
  return {
    id: item.id,
    username: item.username,
    firstName: item.firstName,
    lastName: item.lastName,
    fullName: `${item.firstName} ${item.lastName}`,
    email: item.emailId,
    mobileNumber: item.mobileNumber,
    gender: item.gender,
    dateOfBirth: item.dateOfBirth,
    status: mapUserStatus(item.status),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    roles: Array.isArray(item.roles) ? item.roles : [],
  };
}

export interface AppUser {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  roleIds?: string[];
  status: UserStatus;
  mfa?: MfaStatus;
  createdAt: string;
  updatedAt?: string;
  tenantId?: string;
  applicationId?: string;
  department?: string;
  phone?: string;
  lastLogin?: string;
  accountType?: string;
  agency?: string;
  accessScope?: string;
  userType?: string;
  gender?: string;
  dob?: string;
  designation?: string;
  employeeId?: string;
  avatarColor?: string;
  tenant?: string;
  permissionGroups?: string[];
  applications?: string[];
  lastPasswordChange?: string;
  failedLogins?: number;
  activeSessions?: unknown[];
  activity?: {
    id: string;
    type: string;
    title: string;
    detail?: string;
    result?: string;
    at: string;
    actor: string;
  }[];
}
