"use client";

import type {
  PolicyType,
  PolicyCategory,
  PolicyEffect,
  PolicyPriority,
  PolicyStatus,
  AttributeSource,
  ConditionOperator,
  PolicyCondition,
  PolicyAuditEntry,
  AccessPolicy,
} from "@/types/identity-control";
import {
  POLICY_CATEGORIES,
  POLICY_TYPES,
  POLICY_PRIORITIES,
  POLICY_EFFECTS,
  POLICY_STATUSES,
  ATTRIBUTE_CATALOG,
  ATTRIBUTE_GROUPS,
  LHS_ATTRIBUTE_CATALOG,
  LHS_ATTRIBUTE_GROUPS,
  CONDITION_OPERATORS,
  type AttributeGroup,
  type LhsAttributeGroup,
} from "@/constants/identity-control/policy.constants";

const POLICIES_STORAGE_KEY = "policies:list:v1";
function loadPolicies(): AccessPolicy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(POLICIES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccessPolicy[]) : [];
  } catch {
    return [];
  }
}
function persistPolicies() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(policies));
  } catch {
    /* ignore */
  }
}

let policies: AccessPolicy[] = loadPolicies();
const listeners = new Set<() => void>();

export function ALL_POLICIES(): AccessPolicy[] {
  return policies;
}
export function subscribePolicies(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  persistPolicies();
  listeners.forEach((l) => l());
}

export function upsertPolicy(p: AccessPolicy) {
  const i = policies.findIndex((x) => x.id === p.id);
  if (i === -1) policies = [p, ...policies];
  else policies = policies.map((x) => (x.id === p.id ? p : x));
  notify();
}
export function deletePolicy(id: string) {
  policies = policies.filter((p) => p.id !== id);
  notify();
}
export function togglePolicyStatus(id: string) {
  policies = policies.map((p) =>
    p.id === id
      ? {
          ...p,
          status: p.status === "Active" ? "Inactive" : "Active",
          updatedAt: new Date().toISOString(),
        }
      : p
  );
  notify();
}

export function policyKpis() {
  const list = policies;
  const total = list.length;
  const active = list.filter((p) => p.status === "Active").length;
  const inactive = list.filter(
    (p) => p.status === "Inactive" || p.status === "Deprecated"
  ).length;
  const draft = list.filter((p) => p.status === "Draft").length;
  const highImpact = list.filter(
    (p) => p.affectedUsers >= 1000 || p.priority === "Critical"
  ).length;
  const violations = list.reduce((s, p) => s + p.denials30d, 0);
  return { total, active, inactive, draft, highImpact, violations };
}
