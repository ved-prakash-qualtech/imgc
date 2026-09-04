"use client";

import { useSyncExternalStore } from "react";
import { logAudit } from "@/lib/identity-control/stores/audit-log-store";

export type DataCategoryValue = { id: string; key: string; label: string };

export type DataCategory = {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: "system" | "custom";
  categoryType?: string;
  parentId?: string;
  values: DataCategoryValue[];
  createdAt: string;
  modifiedAt: string;
  status?: "Draft" | "Active";
};

const STORAGE_KEY = "dataCategories.v2";
const now = () => new Date().toISOString();
const slugKey = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
const mkValues = (arr: string[]): DataCategoryValue[] =>
  arr.map((label, i) => ({
    id: `dcv_${i}_${slugKey(label).toLowerCase()}`,
    key: slugKey(label),
    label,
  }));

let CATEGORIES: DataCategory[] = load();

function load(): DataCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DataCategory[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(CATEGORIES));
  } catch {
    /* ignore */
  }
}
const listeners = new Set<() => void>();
function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function subscribeCategories(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getCategories(): DataCategory[] {
  return CATEGORIES;
}
export function getCategory(idOrKey: string): DataCategory | undefined {
  return CATEGORIES.find((c) => c.id === idOrKey || c.key === idOrKey);
}
export function valuesForKey(key: string): string[] {
  return getCategory(key)?.values.map((v) => v.label) ?? [];
}
export function useDataCategories(): DataCategory[] {
  return useSyncExternalStore(
    (cb) => subscribeCategories(cb),
    () => CATEGORIES,
    () => CATEGORIES
  );
}

export function addCategory(input: {
  name: string;
  key?: string;
  description?: string;
  values?: string[];
  type?: "system" | "custom";
  parentId?: string;
}): DataCategory {
  const key =
    input.key && input.key.trim() ? slugKey(input.key) : slugKey(input.name);
  const id = `dc_${Date.now().toString(36)}`;
  const cat: DataCategory = {
    id,
    key,
    name: input.name.trim(),
    description: input.description?.trim(),
    type: input.type ?? "custom",
    categoryType: "User",
    parentId: input.parentId,
    values: mkValues(input.values ?? []),
    createdAt: now(),
    modifiedAt: now(),
  };
  CATEGORIES = [...CATEGORIES, cat];
  emit();
  logAudit({
    actor: "Application Owner · Maker",
    entity: "data_category",
    entityId: id,
    entityName: cat.name,
    action: "create",
  });
  return cat;
}

export function updateCategory(
  id: string,
  patch: Partial<Omit<DataCategory, "id" | "type" | "createdAt">>
) {
  CATEGORIES = CATEGORIES.map((c) =>
    c.id === id
      ? {
          ...c,
          ...patch,
          key: patch.key ? slugKey(patch.key) : c.key,
          modifiedAt: now(),
        }
      : c
  );
  emit();
}

export function upsertCategory(category: DataCategory) {
  const index = CATEGORIES.findIndex((item) => item.id === category.id);
  CATEGORIES =
    index >= 0
      ? CATEGORIES.map((item) =>
          item.id === category.id ? { ...category, modifiedAt: now() } : item
        )
      : [
          {
            ...category,
            createdAt: category.createdAt || now(),
            modifiedAt: now(),
          },
          ...CATEGORIES,
        ];
  emit();
}

export function removeCategory(id: string) {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat || cat.type === "system") return;
  CATEGORIES = CATEGORIES.filter((c) => c.id !== id);
  emit();
}

export function addValue(categoryId: string, label: string, key?: string) {
  const k = key ? slugKey(key) : slugKey(label);
  CATEGORIES = CATEGORIES.map((c) =>
    c.id === categoryId
      ? {
          ...c,
          values: [
            ...c.values,
            {
              id: `dcv_${Date.now().toString(36)}`,
              key: k,
              label: label.trim(),
            },
          ],
          modifiedAt: now(),
        }
      : c
  );
  emit();
}

export function updateValue(
  categoryId: string,
  valueId: string,
  patch: { label?: string; key?: string }
) {
  CATEGORIES = CATEGORIES.map((c) =>
    c.id === categoryId
      ? {
          ...c,
          values: c.values.map((v) =>
            v.id === valueId
              ? {
                  ...v,
                  label: patch.label ?? v.label,
                  key: patch.key ? slugKey(patch.key) : v.key,
                }
              : v
          ),
          modifiedAt: now(),
        }
      : c
  );
  emit();
}

export function removeValue(categoryId: string, valueId: string) {
  CATEGORIES = CATEGORIES.map((c) =>
    c.id === categoryId
      ? {
          ...c,
          values: c.values.filter((v) => v.id !== valueId),
          modifiedAt: now(),
        }
      : c
  );
  emit();
}
