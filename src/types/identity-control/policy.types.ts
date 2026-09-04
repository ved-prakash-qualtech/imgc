export type PolicyType =
  "Data" | "Time" | "Location" | "Device" | "Security" | "Masking" | "Identity";

/**
 * Item returned by GET /api/v1/application/policy-categories/dropdown
 */
export interface PolicyCategoryDropdownItem {
  id: string;
  name: string;
}

/**
 * Item returned by GET /api/v1/application/data-categories
 *
 * dataCategoryValues is optional because the endpoint omits it for a category
 * that has no values yet — declaring it as always present is what let
 * `dataCategoryValues.map(...)` throw. Read it as `?? []`.
 */
export interface DataCategory {
  id: string;
  name: string;
  dataCategoryType: "USER_TYPE" | "SYSTEM_TYPE";
  status: string;
  dataCategoryValues?: DataCategoryValue[];
}

/**
 * Data Category Value item (nested in DataCategory)
 */
export interface DataCategoryValue {
  id: string;
  keyCode: string;
  valueName: string;
}

/**
 * Item returned by
 * GET /api/v1/application/data-category-values/by-data-category?dataCategoryId=…
 *
 * The same value as DataCategoryValue plus the record's own metadata. Only
 * keyCode and valueName are displayed; dataCategoryId is what the values were
 * asked for and is kept so a response can be tied back to its category.
 */
export interface DataCategoryValueRecord extends DataCategoryValue {
  dataCategoryId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Request body for POST /api/v1/application/data-categories
 */
export interface CreateDataCategoryPayload {
  parentId: null;
  name: string;
  dataCategoryType: "USER_TYPE" | "SYSTEM_TYPE";
  status: "ACTIVE";
}

/**
 * Request body for POST /api/v1/application/data-category-values
 */
export interface CreateDataCategoryValuePayload {
  dataCategoryId: string;
  keyCode: string;
  valueName: string;
  status: "ACTIVE";
}

/**
 * Item returned by GET /api/v1/application/attributes/dropdown
 * Used to populate the condition operator dropdown in Define Policy.
 */
export interface ApplicationAttributeDropdown {
  id: string;
  label: string;
  operation: string;
}
/**
 * A single condition row in the CREATE policy request body.
 * attributeId — UUID from GET /api/v1/application/attributes/dropdown
 * operatorType — always "AND" until OR is introduced in the UI
 * key — the key/source field entered by the user
 * values — the value(s) entered by the user (comma-separated for multiple)
 */
export interface CreatePolicyConditionPayload {
  attributeId: string;
  operatorType: string;
  key: string;
  values: string;
}

/**
 * Request body for POST /api/v1/application/policies
 * policyType — always "SYSTEM_TYPE" until backend provides dynamic values
 * effect — 1 = Allow, 0 = Deny
 */
export interface CreatePolicyPayload {
  policyCategoryId: string;
  name: string;
  description: string;
  policyType: string;
  effect: number;
  conditions: CreatePolicyConditionPayload[];
}

/**
 * Item returned by GET /api/v1/application/policies/dropdown
 * Id/name pairs only — used by the Level-4 role → policy picker.
 */
export interface PolicyDropdownItem {
  id: string;
  name: string;
}

/**
 * Item returned by GET /api/v1/application/data-categories/dropdown
 * Id/name pairs only — used by the Level-4 role → data category picker.
 */
export interface DataCategoryDropdownItem {
  id: string;
  name: string;
}

/**
 * Item returned by GET /api/v1/application/policies, and the full record
 * returned by GET /api/v1/application/policies/{id}. The detail response also
 * carries createdAt/updatedAt, which no screen displays, so this shape is
 * reused for both rather than duplicated.
 */
export interface PolicyListItem {
  id: string;
  policyCategoryId: string;
  policyCategoryName: string;
  name: string;
  description: string;
  policyType: string;
  effect: number;
  status: number;
}

/**
 * One condition inside the record returned by
 * GET /api/v1/application/policies/{id}.
 *
 * attributeLabel / attributeOperation are the resolved display form of
 * attributeId (e.g. "Greater Than" and ">"), which is why the id itself is not
 * kept here. The Level-4 preview shows key, label, operation and values only.
 */
export interface PolicyConditionDetail {
  id: string;
  attributeLabel: string;
  attributeOperation: string;
  operatorType: string;
  key: string;
  values: string;
  status: number;
}

/**
 * Full record returned by GET /api/v1/application/policies/{id}.
 * Adds the policy's conditions to the list shape. Optional because the list
 * endpoint (GET /api/v1/application/policies) omits them.
 */
export interface PolicyDetail extends PolicyListItem {
  conditions?: PolicyConditionDetail[];
}

export const POLICY_CATEGORIES = [
  "Login Policies",
  "Data Access Policies",
  "Location-Based Policies",
  "Time-Based Policies",
] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];
export type PolicyEffect = "ALLOW" | "DENY" | "REQUIRE_MFA" | "MASK_DATA";
export type PolicyPriority = "Critical" | "High" | "Medium" | "Low";
export type PolicyStatus = "Active" | "Inactive" | "Draft" | "Deprecated";
export type AttributeSource = "user" | "resource" | "environment" | "request";
export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not_in"
  | "matches"
  | "between";

export interface PolicyCondition {
  id: string;
  source: string;
  attribute: string;
  operator: ConditionOperator;
  value: string;
  rhsAttribute?: string;
}

export interface PolicyAuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface AccessPolicy {
  id: string;
  key: string;
  name: string;
  description: string;
  type: PolicyType;
  category?: PolicyCategory;
  resourceKey: string;
  actions: string[];
  scopeKeys: string[];
  conditions: PolicyCondition[];
  conditionLogic: "ALL" | "ANY";
  effect: PolicyEffect;
  priority: PolicyPriority;
  status: PolicyStatus;
  triggers30d: number;
  denials30d: number;
  affectedUsers: number;
  affectedRoles: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  tags: string[];
  audit: PolicyAuditEntry[];
  applicationId?: string;
  tenantId?: string;
  categoryId?: string;
}
