"use client";

import { useSyncExternalStore } from "react";

export type AuditEntity =
  | "resource"
  | "permission"
  | "role"
  | "policy"
  | "navigation"
  | "mapping"
  | "user"
  | "access_request"
  | "tenant"
  | "application"
  | "data_category";
export type AuditAction = "create" | "update" | "delete" | "cleanup";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  entity: AuditEntity;
  entityId: string;
  entityName?: string;
  action: AuditAction;
  detail?: string;
}

const STORAGE_KEY = "iam.audit-log.v1";
const MAX = 500;
const listeners = new Set<() => void>();
let cache: AuditEntry[] | null = null;

function load(): AuditEntry[] {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = [];
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}
function persist() {
  if (typeof window === "undefined" || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
function emit() {
  listeners.forEach((l) => l());
}

export function logAudit(
  entry: Omit<AuditEntry, "id" | "at"> & { at?: string }
) {
  const list = load();
  const rec: AuditEntry = {
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: entry.at ?? new Date().toISOString(),
    actor: entry.actor || "system",
    entity: entry.entity,
    entityId: entry.entityId,
    entityName: entry.entityName,
    action: entry.action,
    detail: entry.detail,
  };
  cache = [rec, ...list].slice(0, MAX);
  persist();
  emit();
}

export function getAuditLog(): AuditEntry[] {
  return load();
}

export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => load(),
    () => []
  );
}

export function clearAuditLog() {
  cache = [];
  persist();
  emit();
}
