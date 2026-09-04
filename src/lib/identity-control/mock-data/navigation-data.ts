import type {
  ComponentType,
  MappingStatus,
  ComponentStatus,
  Visibility,
  PermissionModule,
  NavAuditEntry,
  NavComponent,
  NavTreeNode,
} from "@/types/identity-control";

export type {
  ComponentType,
  MappingStatus,
  ComponentStatus,
  Visibility,
  PermissionModule,
  NavAuditEntry,
  NavComponent,
  NavTreeNode,
};

export const NAV_COMPONENTS: NavComponent[] = [];

const listeners = new Set<() => void>();
export function subscribeNav(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function emitNavChange() {
  listeners.forEach((l) => l());
}
export function addNavComponent(c: NavComponent) {
  NAV_COMPONENTS.push(c);
  emitNavChange();
}

export function initNavComponents(components: NavComponent[]) {
  NAV_COMPONENTS.splice(0, NAV_COMPONENTS.length, ...components);
  emitNavChange();
}

export function buildTree(items: NavComponent[]): NavComponent[] {
  return items
    .filter((i) => !i.parentId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function descendantsOf(
  id: string,
  items: NavComponent[]
): NavComponent[] {
  const children = items.filter((i) => i.parentId === id);
  return [...children, ...children.flatMap((c) => descendantsOf(c.id, items))];
}

export function buildNavTreeFromComponents(
  items: NavComponent[]
): NavTreeNode[] {
  const byParent = new Map<string, NavComponent[]>();
  items.forEach((c) => {
    if (!c.parentId) return;
    if (!byParent.has(c.parentId)) byParent.set(c.parentId, []);
    byParent.get(c.parentId)!.push(c);
  });
  const attach = (node: NavComponent): NavTreeNode => ({
    ...node,
    children: (byParent.get(node.id) ?? [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(attach),
  });
  return buildTree(items).map(attach);
}

export function moveNavSibling(id: string, dir: "up" | "down") {
  const idx = NAV_COMPONENTS.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const targetIdx = dir === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= NAV_COMPONENTS.length) return;
  const temp = NAV_COMPONENTS[idx];
  const target = NAV_COMPONENTS[targetIdx];
  if (!temp || !target) return;
  NAV_COMPONENTS[idx] = target;
  NAV_COMPONENTS[targetIdx] = temp;
  emitNavChange();
}

export function indentNavComponent(id: string) {
  const idx = NAV_COMPONENTS.findIndex((c) => c.id === id);
  if (idx < 1) return;
  const current = NAV_COMPONENTS[idx];
  if (!current) return;
  const sibling = NAV_COMPONENTS.slice(0, idx)
    .reverse()
    .find((c) => c.parentId === current.parentId);
  if (!sibling) return;
  NAV_COMPONENTS[idx] = { ...current, parentId: sibling.id };
  emitNavChange();
}

export function outdentNavComponent(id: string) {
  const c = NAV_COMPONENTS.find((x) => x.id === id);
  if (!c?.parentId) return;
  const parent = NAV_COMPONENTS.find((x) => x.id === c.parentId);
  const idx = NAV_COMPONENTS.findIndex((x) => x.id === id);
  NAV_COMPONENTS[idx] = { ...c, parentId: parent?.parentId };
  emitNavChange();
}

export function reparentNavComponent(
  id: string,
  newParentId: string | undefined
) {
  const idx = NAV_COMPONENTS.findIndex((c) => c.id === id);
  const current = idx < 0 ? undefined : NAV_COMPONENTS[idx];
  if (!current) return;
  NAV_COMPONENTS[idx] = { ...current, parentId: newParentId };
  emitNavChange();
}

export function reorderNavTree(ordered: NavComponent[]) {
  ordered.forEach((c, i) => {
    const idx = NAV_COMPONENTS.findIndex((x) => x.id === c.id);
    const current = idx < 0 ? undefined : NAV_COMPONENTS[idx];
    if (current)
      NAV_COMPONENTS[idx] = {
        ...current,
        displayOrder: i,
        parentId: c.parentId,
      };
  });
  emitNavChange();
}

export function addNavComponentAt(c: NavComponent, insertAfter?: string) {
  if (insertAfter) {
    const idx = NAV_COMPONENTS.findIndex((x) => x.id === insertAfter);
    NAV_COMPONENTS.splice(idx + 1, 0, c);
  } else {
    NAV_COMPONENTS.push(c);
  }
  emitNavChange();
}

export function computeNavKpis() {
  return {
    total: NAV_COMPONENTS.length,
    mapped: NAV_COMPONENTS.filter((c) => c.mappedPermissions.length > 0).length,
    unmapped: NAV_COMPONENTS.filter((c) => c.mappedPermissions.length === 0)
      .length,
    active: NAV_COMPONENTS.filter((c) => c.status === "Active").length,
    deprecated: NAV_COMPONENTS.filter((c) => c.status === "Deprecated").length,
  };
}
