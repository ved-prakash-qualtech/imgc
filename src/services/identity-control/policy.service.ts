"use server";

import { serverApiClient } from "@/lib/apiClient.server";
import { getAuthHeader } from "@/services/identity-control/shared/auth-header";
import { IDENTITY_CONTROL_ENDPOINTS } from "@/config/apiEndpoints";
import {
  extractApiResponse,
  extractMutationResponse,
  withApiError,
  type MutationResult,
  type ServiceResult,
} from "@/utils/serverActionUtils";
import type {
  PolicyCategoryDropdownItem,
  ApplicationAttributeDropdown,
  CreatePolicyPayload,
  PolicyListItem,
  PolicyDetail,
  PolicyDropdownItem,
  DataCategory,
  DataCategoryDropdownItem,
  DataCategoryValueRecord,
  CreateDataCategoryPayload,
  CreateDataCategoryValuePayload,
} from "@/types/identity-control/policy.types";

/**
 * Fetch policy category dropdown items
 * (GET /api/v1/application/policy-categories/dropdown)
 *
 * Returns the list of available policy categories for the category dropdown.
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchPolicyCategoryDropdown(): Promise<
  PolicyCategoryDropdownItem[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.POLICY_CATEGORY_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<PolicyCategoryDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch condition operator / attribute dropdown items
 * (GET /api/v1/application/attributes/dropdown)
 *
 * Returns the list of available operators for the policy condition row.
 * Each item has: id, label (display text), operation (internal value like ==, !=).
 */
export async function fetchAttributeDropdown(): Promise<
  ApplicationAttributeDropdown[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.ATTRIBUTE_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<ApplicationAttributeDropdown[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Create a new policy
 * (POST /api/v1/application/policies)
 *
 * Returns the backend success message, or an API error envelope.
 * Unwrap with `callApi()` on the client.
 */
export async function createPolicy(
  payload: CreatePolicyPayload
): Promise<ServiceResult<MutationResult<unknown>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.post(
      IDENTITY_CONTROL_ENDPOINTS.APPLICATION_POLICIES,
      payload,
      { headers: { Authorization: auth } }
    );
    return extractMutationResponse(res);
  });
}

/**
 * Fetch all policies
 * (GET /api/v1/application/policies)
 *
 * Returns the list of policies for the right-side list.
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchPolicies(): Promise<PolicyListItem[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_POLICIES,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<PolicyListItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch policy id/name pairs for the Level-4 role → policy picker
 * (GET /api/v1/application/policies/dropdown)
 *
 * Level 4 only. Level 3 keeps using fetchPolicies() against
 * /application/policies, which returns the full policy records.
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchPolicyDropdown(): Promise<PolicyDropdownItem[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_POLICIES_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<PolicyDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch the full record for one policy
 * (GET /api/v1/application/policies/{id})
 *
 * Backs the Level-4 policy preview panel, which the dropdown list above cannot
 * fill because it returns id/name only. Extends the list shape with the
 * policy's conditions, which only this endpoint returns.
 */
export async function fetchPolicyById(id: string): Promise<PolicyDetail> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.APPLICATION_POLICY_BY_ID(id),
    { headers: { Authorization: auth } }
  );
  return extractApiResponse<PolicyDetail>(res);
}

/**
 * Fetch data category id/name pairs for the Level-4 role → category picker
 * (GET /api/v1/application/data-categories/dropdown)
 *
 * Level 4 only. Level 3 keeps using fetchDataCategories() against
 * /application/data-categories, which returns the full records with their values.
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchDataCategoryDropdown(): Promise<
  DataCategoryDropdownItem[]
> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORIES_DROPDOWN,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<DataCategoryDropdownItem[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch the full record for one data category
 * (GET /api/v1/application/data-categories/{id})
 *
 * Backs the Level-4 category preview panel, which the dropdown list above
 * cannot fill because it returns id/name only. Shares the DataCategory type
 * with the list endpoint — the shapes are identical apart from unused timestamps.
 */
export async function fetchDataCategoryById(id: string): Promise<DataCategory> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORY_BY_ID(id),
    { headers: { Authorization: auth } }
  );
  return extractApiResponse<DataCategory>(res);
}

/**
 * Fetch all data categories
 * (GET /api/v1/application/data-categories)
 *
 * Returns the list of data categories.
 * extractApiResponse already unwraps the backend `data` field — the array is returned directly.
 * Array.isArray guard ensures safe handling of unexpected response shapes.
 */
export async function fetchDataCategories(): Promise<DataCategory[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORIES,
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<DataCategory[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Create a new data category
 * (POST /api/v1/application/data-categories)
 *
 * Returns the backend success message, or an API error envelope.
 * Unwrap with `callApi()` on the client.
 */
export async function createDataCategory(
  payload: CreateDataCategoryPayload
): Promise<ServiceResult<MutationResult<unknown>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.post(
      IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORIES,
      payload,
      { headers: { Authorization: auth } }
    );
    return extractMutationResponse(res);
  });
}

/**
 * Fetch the values of one data category
 * (GET /api/v1/application/data-category-values/by-data-category?dataCategoryId=…)
 *
 * The category list no longer carries its values, so the Level-3 Define Data
 * Category tree asks for them per category as it is expanded.
 * extractApiResponse unwraps the backend `data` field; the Array.isArray guard
 * keeps a missing or null `data` from reaching the tree.
 */
export async function fetchDataCategoryValuesByCategory(
  dataCategoryId: string
): Promise<DataCategoryValueRecord[]> {
  const auth = await getAuthHeader();
  const res = await serverApiClient.get(
    IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORY_VALUES_BY_CATEGORY(dataCategoryId),
    { headers: { Authorization: auth } }
  );
  const items = extractApiResponse<DataCategoryValueRecord[]>(res);
  return Array.isArray(items) ? items : [];
}

/**
 * Create a new data category value
 * (POST /api/v1/application/data-category-values)
 *
 * Returns the backend success message, or an API error envelope.
 * Unwrap with `callApi()` on the client.
 */
export async function createDataCategoryValue(
  payload: CreateDataCategoryValuePayload
): Promise<ServiceResult<MutationResult<unknown>>> {
  return withApiError(async () => {
    const auth = await getAuthHeader();
    const res = await serverApiClient.post(
      IDENTITY_CONTROL_ENDPOINTS.DATA_CATEGORY_VALUES,
      payload,
      { headers: { Authorization: auth } }
    );
    return extractMutationResponse(res);
  });
}
