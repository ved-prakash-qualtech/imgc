import type {
  PolicyType,
  PolicyPriority,
  PolicyEffect,
  PolicyStatus,
  ConditionOperator,
} from "@/types/identity-control";

export const POLICY_CATEGORIES = [
  "Login Policies",
  "Data Access Policies",
  "Location-Based Policies",
  "Time-Based Policies",
] as const;

export const POLICY_TYPES: PolicyType[] = [
  "Data",
  "Time",
  "Location",
  "Device",
  "Security",
  "Masking",
  "Identity",
];
export const POLICY_PRIORITIES: PolicyPriority[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];
export const POLICY_EFFECTS: PolicyEffect[] = [
  "ALLOW",
  "DENY",
  "REQUIRE_MFA",
  "MASK_DATA",
];
export const POLICY_STATUSES: PolicyStatus[] = [
  "Active",
  "Inactive",
  "Draft",
  "Deprecated",
];

export type AttributeGroup = "Time" | "User" | "Environment" | "Resource";

export const ATTRIBUTE_CATALOG: {
  key: string;
  label: string;
  group: AttributeGroup;
  hint?: string;
}[] = [
  { group: "Time", key: "time.hour", label: "Hour", hint: "0–23" },
  {
    group: "Time",
    key: "time.day_of_week",
    label: "Day of Week",
    hint: "Mon–Sun",
  },
  {
    group: "Time",
    key: "time.is_business_hours",
    label: "Is Business Hours",
    hint: "true | false",
  },
  { group: "User", key: "user.id", label: "User ID" },
  { group: "User", key: "user.role", label: "User Role" },
  { group: "User", key: "user.department", label: "User Department" },
  { group: "User", key: "user.agency", label: "User Agency" },
  { group: "Environment", key: "env.ip_address", label: "IP Address" },
  { group: "Environment", key: "env.device_type", label: "Device Type" },
  { group: "Environment", key: "geo.country", label: "Geo Country" },
  { group: "Resource", key: "resource.owner", label: "Resource Owner" },
  { group: "Resource", key: "resource.agency", label: "Resource Agency" },
];

export const ATTRIBUTE_GROUPS: AttributeGroup[] = [
  "Time",
  "User",
  "Environment",
  "Resource",
];

export type LhsAttributeGroup = "Menu" | AttributeGroup;

export const LHS_ATTRIBUTE_CATALOG: {
  key: string;
  label: string;
  group: LhsAttributeGroup;
  hint?: string;
}[] = [
  {
    group: "Menu",
    key: "menu.key",
    label: "Menu Key",
    hint: "pick field from Menu Registry",
  },
  { group: "Menu", key: "menu.id", label: "Menu ID" },
  ...ATTRIBUTE_CATALOG,
];

export const LHS_ATTRIBUTE_GROUPS: LhsAttributeGroup[] = [
  "Menu",
  "Time",
  "User",
  "Environment",
  "Resource",
];

export const CONDITION_OPERATORS: { op: ConditionOperator; label: string }[] = [
  { op: "==", label: "Equals" },
  { op: "!=", label: "Not Equals" },
  { op: ">", label: "Greater Than" },
  { op: ">=", label: "Greater or Equal" },
  { op: "<", label: "Less Than" },
  { op: "<=", label: "Less or Equal" },
  { op: "in", label: "In List" },
  { op: "not_in", label: "Not In List" },
  { op: "matches", label: "Matches Pattern" },
  { op: "between", label: "Between" },
];
