"use client";

import { useSyncExternalStore } from "react";
import {
  NAV_COMPONENTS,
  subscribeNav,
  emitNavChange,
  addNavComponent as _add,
  computeNavKpis,
  descendantsOf,
  type NavComponent,
} from "@/lib/identity-control/mock-data/navigation-data";
import { logAudit } from "@/lib/identity-control/stores/audit-log-store";

let _version = 0;
let _cachedVersion = -1;
let _cachedList: NavComponent[] = [];

function getSnapshot(): NavComponent[] {
  if (_cachedVersion !== _version) {
    _cachedList = [...NAV_COMPONENTS];
    _cachedVersion = _version;
  }
  return _cachedList;
}

function subscribe(cb: () => void) {
  return subscribeNav(() => {
    _version += 1;
    cb();
  });
}

export function getNavComponents(): NavComponent[] {
  return NAV_COMPONENTS;
}

export function useNavComponents(): NavComponent[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addNavComponent(c: NavComponent) {
  _add(c);
  logAudit({
    actor: "you",
    entity: "navigation",
    entityId: c.id,
    entityName: c.name,
    action: "create",
  });
}

export function updateNavComponent(id: string, patch: Partial<NavComponent>) {
  const idx = NAV_COMPONENTS.findIndex((c) => c.id === id);
  const current = idx < 0 ? undefined : NAV_COMPONENTS[idx];
  if (!current) return;
  const next = { ...current, ...patch, modifiedAt: new Date().toISOString() };
  NAV_COMPONENTS[idx] = next;
  emitNavChange();
  logAudit({
    actor: "you",
    entity: "navigation",
    entityId: id,
    entityName: next.name,
    action: "update",
  });
}

export function removeNavComponent(id: string) {
  const idx = NAV_COMPONENTS.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const [removed] = NAV_COMPONENTS.splice(idx, 1);
  emitNavChange();
  if (removed) {
    logAudit({
      actor: "you",
      entity: "navigation",
      entityId: id,
      entityName: removed.name,
      action: "delete",
    });
  }
}

export function removeNavSubtree(id: string) {
  const root = NAV_COMPONENTS.find((c) => c.id === id);
  if (!root) return;
  const desc = descendantsOf(id, NAV_COMPONENTS);
  const toRemove = new Set<string>([id, ...desc.map((c) => c.id)]);
  NAV_COMPONENTS.splice(
    0,
    NAV_COMPONENTS.length,
    ...NAV_COMPONENTS.filter((c) => !toRemove.has(c.id))
  );
  emitNavChange();
  logAudit({
    actor: "you",
    entity: "navigation",
    entityId: id,
    entityName: root.name,
    action: "delete",
  });
}

export { computeNavKpis };
export {
  moveNavSibling,
  indentNavComponent,
  outdentNavComponent,
  reparentNavComponent,
  reorderNavTree,
  addNavComponentAt,
  initNavComponents,
} from "@/lib/identity-control/mock-data/navigation-data";
