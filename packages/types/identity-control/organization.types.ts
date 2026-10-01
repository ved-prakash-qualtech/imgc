export type OrganizationStatus =
  "Draft" | "Pending Approval" | "Active" | "Approved" | "Rejected";

/**
 * Raw API response from GET /api/v1/tenants
 * status may be a string (e.g. "APPROVED", "DRAFT") or legacy numeric (0–3).
 */
export interface OrganizationApiResponse {
  id: string;
  tenantName: string;
  tenantCode: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhoneNumber?: string;
  tenantDomainUrl?: string;
  status: string | number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Application entry nested inside the GET /api/v1/application/application-tenants response.
 * Each organization can be mapped to multiple applications.
 */
export interface OrganizationApplication {
  applicationCode: string;
  applicationName: string;
  redirectionUrl: string;
}

/**
 * Raw API response from GET /api/v1/application/application-tenants
 * Used in the ORGANIZATION / APPLICATION context for organizations list.
 * status is a string (e.g. "APPROVED", "DRAFT").
 */
export interface ApplicationTenantApiResponse {
  id: string;
  tenantName: string;
  tenantCode: string;
  /**
   * Contact person fields are returned by the list endpoint. They are optional
   * because older records may not have them populated.
   */
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhoneNumber?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Applications mapped to this organization. Returned by the backend in the
   * list endpoint. Optional for backward compatibility with older responses.
   */
  applications?: OrganizationApplication[];
}

export interface CreateOrganizationPayload {
  tenantName: string;
  tenantCode: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPhoneNumber: string;
  status: string;
}

/**
 * Payload for POST /api/v1/application/application-tenants
 * Used in the APPLICATION context for creating organizations.
 */
export interface CreateApplicationTenantPayload {
  tenantName: string;
  tenantCode: string;
  status: string;
  applicationIds: string[];
  contactPersonName: string;
  contactPersonPhoneNumber: string;
  contactPersonEmail: string;
}

export interface UpdateOrganizationPayload {
  /** Body id — backend cross-validates against the URL path id. */
  id?: string;
  tenantName?: string;
  /** Must be included: backend PUT requires tenantCode even for name-only updates. */
  tenantCode?: string;
  /** Must be included: backend PUT requires status to preserve the current org status. */
  status?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhoneNumber?: string;
  /**
   * Application IDs for L2 Organization edit.
   * Optional — only sent when the context supports application selection.
   */
  applicationIds?: string[];
}

/**
 * Payload for PUT /api/v1/application/application-tenants/{id}
 * Used in ORGANIZATION (L2) context for editing organizations.
 *
 * Backend rule: existing application tenant mappings cannot be removed;
 * only adding new applications is allowed. The frontend must always include
 * all persisted application IDs plus any newly added ones.
 */
export interface UpdateApplicationTenantPayload {
  tenantName: string;
  tenantCode: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPhoneNumber: string;
  status: string;
  applicationIds: string[];
}

export function mapOrganizationStatus(
  status: string | number
): OrganizationStatus {
  if (typeof status === "string") {
    switch (status.toUpperCase()) {
      case "DRAFT":
        return "Draft";
      case "ACTIVE":
        return "Active";
      case "APPROVED":
        return "Approved";
      case "PENDING_APPROVAL":
        return "Pending Approval";
      case "REJECTED":
        return "Rejected";
      default:
        return "Draft";
    }
  }
  switch (status) {
    case 0:
      return "Draft";
    case 1:
      return "Active";
    case 2:
      return "Pending Approval";
    case 3:
      return "Rejected";
    default:
      return "Draft";
  }
}

export type OrgType = "Platform Tenant" | "Tenant";

export interface Organization {
  id: string;
  name: string;
  code: string;
  industry?: string;
  owner?: string;
  description?: string;
  status: OrganizationStatus;
  parentOrgId?: string;
  parentOrgName?: string;
  parentOrgCode?: string;
  orgType?: OrgType;
  // Contact information
  contactPersonName?: string;
  contactPersonMobile?: string;
  contactPersonEmail?: string;
  domainUrl?: string;
  /**
   * Applications mapped to this organization, as returned by the GET API.
   * Present for application-tenants (L2/L3); undefined for L1 tenants.
   */
  applications?: OrganizationApplication[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export function mapOrganizationApiResponse(
  item: OrganizationApiResponse
): Organization {
  return {
    id: item.id,
    name: item.tenantName,
    code: item.tenantCode,
    contactPersonName: item.contactPersonName,
    contactPersonEmail: item.contactPersonEmail,
    contactPersonMobile: item.contactPersonPhoneNumber,
    domainUrl: item.tenantDomainUrl,
    status: mapOrganizationStatus(item.status),
    createdBy: "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Maps ApplicationTenantApiResponse to Organization type.
 * Used in the APPLICATION context for organizations list.
 */
export function mapApplicationTenantApiResponse(
  item: ApplicationTenantApiResponse
): Organization {
  return {
    id: item.id,
    name: item.tenantName,
    code: item.tenantCode,
    contactPersonName: item.contactPersonName,
    contactPersonEmail: item.contactPersonEmail,
    contactPersonMobile: item.contactPersonPhoneNumber,
    applications: item.applications ?? [],
    status: mapOrganizationStatus(item.status),
    createdBy: "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
