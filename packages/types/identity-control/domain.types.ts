/**
 * Domain Types
 *
 * Types for domain management API responses.
 */

/**
 * Raw API response from GET /api/v1/domains/dropdown
 * Lighter shape returned by the dedicated dropdown endpoint.
 */
export interface DomainDropdownItem {
  id: string;
  tenantCode: string;
  url: string;
}

/**
 * Raw API response from GET /api/v1/application/tenant-domains/dropdown
 * Used in Level 2 Organization Create Code dropdown (ORGANIZATION context).
 * Each item represents a selectable tenant domain code.
 */
export interface TenantDomainDropdownItem {
  id: string;
  code: string;
}

/**
 * Raw API response from GET /api/v1/domains
 */
export interface DomainApiResponse {
  id: string;
  tenantCode: string;
  url: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Frontend domain model
 */
export interface Domain {
  id: string;
  tenantCode: string;
  url: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map API response to frontend domain model
 */
export function mapDomainApiResponse(item: DomainApiResponse): Domain {
  return {
    id: item.id,
    tenantCode: item.tenantCode,
    url: item.url,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
