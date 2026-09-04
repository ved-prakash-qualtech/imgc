"use client";

import { useSyncExternalStore } from "react";
import {
  ALL_POLICIES,
  subscribePolicies,
  upsertPolicy as _upsert,
  deletePolicy as _delete,
  togglePolicyStatus,
  policyKpis,
} from "@/lib/identity-control/mock-data/policies-data";
import type { AccessPolicy } from "@/types/identity-control";
import { logAudit } from "@/lib/identity-control/stores/audit-log-store";

export function getPolicies(): AccessPolicy[] {
  return ALL_POLICIES();
}

export function usePolicies(): AccessPolicy[] {
  return useSyncExternalStore(
    (cb) => subscribePolicies(cb),
    () => ALL_POLICIES(),
    () => ALL_POLICIES()
  );
}

export function addPolicy(p: AccessPolicy) {
  _upsert(p);
  logAudit({
    actor: "you",
    entity: "policy",
    entityId: p.id,
    entityName: p.name,
    action: "create",
  });
}
export function updatePolicy(p: AccessPolicy) {
  _upsert(p);
  logAudit({
    actor: "you",
    entity: "policy",
    entityId: p.id,
    entityName: p.name,
    action: "update",
  });
}
export function removePolicy(id: string) {
  const p = ALL_POLICIES().find((x) => x.id === id);
  _delete(id);
  logAudit({
    actor: "you",
    entity: "policy",
    entityId: id,
    entityName: p?.name,
    action: "delete",
  });
}
export { togglePolicyStatus, policyKpis };
