"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  IndentIncrease,
  IndentDecrease,
  Save,
  Trash2,
  Loader2,
  AlertCircle,
  Menu,
  FileText,
  Rows3,
  MousePointerClick,
  ChevronRight,
  GripVertical,
  Search,
  WandSparkles,
  Upload,
  Download,
  ArrowRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { toast } from "sonner";
import {
  callApi,
  showApiErrorToast,
  showApiSuccessToast,
} from "@/lib/api-toast";
import {
  buildNavTreeFromComponents,
  type NavTreeNode,
  type NavComponent,
  type ComponentType,
} from "@/lib/identity-control/mock-data/navigation-data";
import {
  useNavComponents,
  getNavComponents,
  updateNavComponent,
  moveNavSibling,
  indentNavComponent,
  outdentNavComponent,
  reparentNavComponent,
  addNavComponentAt,
  removeNavSubtree,
  initNavComponents,
} from "@/lib/identity-control/stores/navigation-store";
import { ComponentTypeBadge } from "@/components/identity-control/navigation/component-type-badge";
import { cn } from "@/lib/utils";
import { WorkspacePanelHeader } from "@/components/identity-control/common/workspace-panel-header";
import { BulkImportDialog } from "@/components/identity-control/common/bulk-import-dialog";
import { exportRowsCsv } from "@/lib/identity-control/utils/csv";
import {
  fetchMenuTypes,
  fetchMenuTypeActionMappings,
  fetchSidebarMenus,
  createSidebarMenu,
} from "@/services/identity-control/application.service";
import type {
  ApplicationMenuType,
  SidebarMenuItem,
  CreateSidebarMenuPayload,
} from "@/types/identity-control/application-api.types";
import type {
  NodeActionMeta,
  MenuAppliesTo,
} from "@/types/identity-control/navigation.types";

type Props = {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  embedded?: boolean;
  onNext?: () => void;
};

type PaletteItem = {
  menuTypeId: string;
  type: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const BACKEND_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  menu: Menu,
  page: FileText,
  section: Rows3,
  btn: MousePointerClick,
  field: MousePointerClick,
};

function resolveMenuTypeIcon(
  iconKey: string
): React.ComponentType<{ className?: string }> {
  return BACKEND_ICON_MAP[iconKey.toLowerCase()] ?? Rows3;
}

function mapMenuTypeToPaletteItem(t: ApplicationMenuType): PaletteItem {
  return {
    menuTypeId: t.id,
    type: t.name,
    name: t.name,
    Icon: resolveMenuTypeIcon(t.icon),
  };
}

const CONTAINER_TYPES: ComponentType[] = ["Menu", "Page", "Section", "Tab"];

const MIME_TYPE = "application/x-nav-type";
const MIME_ID = "application/x-nav-id";
const MIME_MENU_TYPE_ID = "application/x-menu-type-id";

type DropPosition = "before" | "after" | "into";

function mapSidebarMenusToNavComponents(
  items: SidebarMenuItem[]
): NavComponent[] {
  const now = new Date().toISOString();
  return items.map((item, idx) => ({
    id: item.id,
    key: item.key,
    name: item.name,
    description: item.description,
    type: item.menuTypeName as ComponentType,
    module: "Identity & Access",
    parentId: item.parentId ?? undefined,
    route: item.url,
    displayOrder: item.displayOrder,
    visibility: "Visible",
    status: item.status === "ACTIVE" ? "Active" : "Draft",
    mappedPermissions: [],
    recommendedPermissions: [],
    actionKeys: [],
    actionMeta: [], // Will be populated by fetchMenuTypeActionMappings
    mapActions: item.mapActions, // Store backend action mappings for checkbox state
    menuTypeId: item.menuTypeId,
    appliesTo: item.appliesTo,
    persisted: true,
    createdAt: item.createdAt ?? now,
    modifiedAt: item.modifiedAt ?? now,
    createdBy: "system",
    auditTrail: [],
  }));
}

function buildCreatePayload(
  node: NavComponent,
  all: NavComponent[],
  unpersistedIds: Set<string>
): CreateSidebarMenuPayload {
  const children = all
    .filter((c) => c.parentId === node.id && unpersistedIds.has(c.id))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((child) => buildCreatePayload(child, all, unpersistedIds));

  // Build actions array from actionMeta and actionKeys - only include checked actions
  const actions = (node.actionMeta ?? [])
    .filter((meta) => (node.actionKeys ?? []).includes(meta.actionId))
    .map((meta) => ({
      actionId: meta.actionId,
      status: "ACTIVE" as const,
    }));

  const payload: CreateSidebarMenuPayload = {
    name: node.name,
    key: node.menuKey ?? "",
    url: node.route ?? "",
    description: node.description ?? "",
    menuTypeId: node.menuTypeId!,
    status: node.status === "Active" ? "ACTIVE" : "INACTIVE",
    // Omitted when unset: the portal defaults to BOTH, which is what this used to mean.
    appliesTo: node.appliesTo,
    actions,
    children,
  };

  console.log("[CREATE PAYLOAD]", JSON.stringify(payload, null, 2));
  return payload;
}

function makeNavNode(
  type: string,
  parentId?: string,
  menuTypeId?: string
): NavComponent {
  const id = `nav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  return {
    id,
    key: "",
    name: type,
    description: "",
    type: type as ComponentType,
    module: "Identity & Access",
    parentId,
    displayOrder: Date.now(),
    visibility: "Visible",
    status: "Draft",
    mappedPermissions: [],
    recommendedPermissions: [],
    actionKeys: [],
    actionMeta: [],
    menuTypeId,
    persisted: false,
    createdAt: now,
    modifiedAt: now,
    createdBy: "you",
    auditTrail: [],
  };
}

export function NavigationBuilder({
  open = false,
  onOpenChange,
  embedded = false,
  onNext,
}: Props) {
  const navComponents = useNavComponents();
  const tree = useMemo(
    () => buildNavTreeFromComponents(navComponents),
    [navComponents]
  );
  const flatList = navComponents;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState("");
  const [recentSearch, setRecentSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [paletteItems, setPaletteItems] = useState<PaletteItem[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(true);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);
  const [activeTab, setActiveTab] = useState("details");
  const actionsLoadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchSidebarMenus()
      .then(async (items) => {
        if (cancelled) return;
        initNavComponents(mapSidebarMenusToNavComponents(items));
        // Load action metadata for all unique menu types
        const uniqueTypeIds = Array.from(
          new Set(items.map((i) => i.menuTypeId))
        );
        const results = await Promise.allSettled(
          uniqueTypeIds.map(async (menuTypeId) => {
            const mappings = await fetchMenuTypeActionMappings(menuTypeId);
            return { menuTypeId, mappings };
          })
        );
        if (cancelled) return;
        const typeActionMap = new Map<string, NodeActionMeta[]>();
        for (const r of results) {
          if (r.status === "fulfilled") {
            typeActionMap.set(
              r.value.menuTypeId,
              r.value.mappings.map((m) => ({
                actionId: m.actionId,
                actionCode: m.actionCode,
                actionName: m.actionName,
              }))
            );
          }
        }
        // Apply action metadata to all nodes and set checkbox state based on mapActions presence
        for (const item of items) {
          const actionMeta = typeActionMap.get(item.menuTypeId);
          if (actionMeta) {
            actionsLoadedRef.current.add(item.id);
            // Determine which actions are checked based on actionId presence in mapActions (ignore status)
            const checkedActionIds = (item.mapActions ?? []).map(
              (m) => m.actionId
            );
            updateNavComponent(item.id, {
              actionMeta,
              actionKeys: checkedActionIds,
            });
          }
        }
      })
      .catch(() => {
        // Non-fatal: canvas starts empty if menus fail to load
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Which node is selected, corrected for a tree that has changed under it.
   *
   * Derived rather than repaired in an effect. Correcting it afterwards meant a render carrying a
   * selection that no longer exists, then a second render to fix it — and on the frame between,
   * the details panel read a node that had just been deleted.
   */
  const selection =
    selectedId && flatList.some((c) => c.id === selectedId)
      ? selectedId
      : (tree[0]?.id ?? null);

  useEffect(() => {
    const node = getNavComponents().find((c) => c.id === selection);
    if (!node?.menuTypeId) return;
    if (actionsLoadedRef.current.has(node.id)) return;
    if ((node.actionMeta ?? []).length > 0) {
      actionsLoadedRef.current.add(node.id);
      return;
    }
    let cancelled = false;
    fetchMenuTypeActionMappings(node.menuTypeId)
      .then((mappings) => {
        if (cancelled) return;
        actionsLoadedRef.current.add(node.id);
        const actionMeta: NodeActionMeta[] = mappings.map((m) => ({
          actionId: m.actionId,
          actionCode: m.actionCode,
          actionName: m.actionName,
        }));
        // Set checkbox state based on actionId presence in mapActions (ignore status)
        const checkedActionIds = (node.mapActions ?? []).map((m) => m.actionId);
        updateNavComponent(node.id, {
          actionMeta,
          actionKeys: checkedActionIds,
        });
      })
      .catch(() => {
        if (!cancelled) actionsLoadedRef.current.add(node.id);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const selected = flatList.find((c) => c.id === selection) ?? tree[0];
  const visibleTree = useMemo(
    () => filterTree(tree, treeSearch),
    [tree, treeSearch]
  );
  const recent = useMemo(
    () =>
      [...flatList]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .filter((item) =>
          `${item.name} ${item.type} ${item.status}`
            .toLowerCase()
            .includes(recentSearch.toLowerCase())
        )
        .slice(0, 8),
    [flatList, recentSearch]
  );

  const caps = useMemo(() => {
    if (!selected)
      return { up: false, down: false, indent: false, outdent: false };
    const sibs = flatList
      .filter((c) => (c.parentId ?? null) === (selected.parentId ?? null))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sibs.findIndex((s) => s.id === selected.id);
    return {
      up: idx > 0,
      down: idx >= 0 && idx < sibs.length - 1,
      indent: idx > 0,
      outdent: !!selected.parentId,
    };
  }, [selected, flatList]);

  const doMove = (dir: "up" | "down") => {
    if (!selection) return;
    moveNavSibling(selection, dir);
  };
  const doIndent = () => {
    if (!selection) return;
    indentNavComponent(selection);
  };
  const doOutdent = () => {
    if (!selection) return;
    outdentNavComponent(selection);
  };
  const saveSelected = async (status: "Draft" | "Active") => {
    if (!selected) return;
    const all = getNavComponents();
    const unpersisted = all.filter((c) => !c.persisted && !!c.menuTypeId);
    console.log("[SAVE SELECTED] unpersisted count:", unpersisted.length);
    if (unpersisted.length === 0) {
      updateNavComponent(selected.id, { status });
      showApiSuccessToast(
        status === "Active" ? "Layout published" : "Layout saved as draft"
      );
      return;
    }
    const unpersistedIds = new Set(unpersisted.map((c) => c.id));
    const roots = unpersisted.filter(
      (c) => !c.parentId || !unpersistedIds.has(c.parentId)
    );
    console.log("[SAVE SELECTED] roots count:", roots.length);
    try {
      console.log("[SAVE SELECTED] calling createSidebarMenu for roots");
      await Promise.all(
        roots.map((root) =>
          callApi(() =>
            createSidebarMenu(buildCreatePayload(root, all, unpersistedIds))
          )
        )
      );
      console.log("[SAVE SELECTED] POST successful, refetching menus");
      const refreshed = await fetchSidebarMenus();
      console.log("[SAVE SELECTED] refetched menus count:", refreshed.length);
      initNavComponents(mapSidebarMenusToNavComponents(refreshed));
      showApiSuccessToast(
        status === "Active" ? "Layout published" : "Layout saved"
      );
    } catch (error) {
      console.error("[SAVE SELECTED] error:", error);
      showApiErrorToast(error);
    }
  };
  const addCustomAction = () => {
    if (!selected) return;
    const label = window
      .prompt("Custom action name (for example: export)")
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    if (!label) return;
    const actionCode = label.toUpperCase();
    const actionId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const actionName =
      label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, " ");
    const existingMeta = selected.actionMeta ?? [];
    const newMeta: NodeActionMeta[] = existingMeta.some(
      (m) => m.actionCode === actionCode
    )
      ? existingMeta
      : [...existingMeta, { actionId, actionCode, actionName }];
    updateNavComponent(selected.id, {
      actionKeys: Array.from(
        new Set([...(selected.actionKeys ?? []), actionId])
      ),
      actionMeta: newMeta,
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
    toast.success(`${label} added as a draft action`);
  };

  const handleCreateNode = (
    type: string,
    menuTypeId: string,
    parentId?: string
  ) => {
    const node = makeNavNode(type, parentId, menuTypeId);
    addNavComponentAt(node);
    setSelectedId(node.id);
    // Load actions for the new node
    if (menuTypeId) {
      fetchMenuTypeActionMappings(menuTypeId)
        .then((mappings) => {
          const actionMeta: NodeActionMeta[] = mappings.map((m) => ({
            actionId: m.actionId,
            actionCode: m.actionCode,
            actionName: m.actionName,
          }));
          // New nodes start with all actions unchecked
          updateNavComponent(node.id, { actionMeta, actionKeys: [] });
        })
        .catch(() => {
          // Non-fatal: node renders with no action checkboxes
        });
    }
  };

  const handlePaletteClick = (type: string, menuTypeId: string) => {
    let parentId: string | undefined;
    if (selected) {
      parentId = CONTAINER_TYPES.includes(selected.type)
        ? selected.id
        : selected.parentId;
    }
    handleCreateNode(type, menuTypeId, parentId);
    toast.success(`${type} added`);
  };

  const handleDelete = (id: string, hasChildren: boolean) => {
    if (
      hasChildren &&
      !window.confirm("Delete this item and all of its child items?")
    )
      return;
    removeNavSubtree(id);
    toast.success("Deleted");
  };

  useEffect(() => {
    let cancelled = false;
    // No setState here: the state already starts loading, and a retry resets it where the retry
    // is asked for. Doing it at the top of the effect meant a render whose only purpose was to
    // schedule another one.
    fetchMenuTypes()
      .then((types) => {
        if (cancelled) return;
        const items = [...types]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((t) => mapMenuTypeToPaletteItem(t));
        setPaletteItems(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setPaletteError("Failed to load component types");
        showApiErrorToast(err);
      })
      .finally(() => {
        if (!cancelled) setPaletteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchTick]);

  const workspace = (
    <>
      <div
        className={cn(
          "flex overflow-hidden rounded-xl border border-border bg-card",
          embedded ? "min-h-[620px]" : "h-full rounded-none border-0"
        )}
      >
        {/* ── Palette panel ── */}
        <div
          className={cn(
            "flex shrink-0 flex-col border-r border-border bg-secondary/30 transition-all duration-150",
            paletteOpen ? "w-44" : "w-12"
          )}
        >
          <div className="flex min-h-9 items-center gap-1 border-b border-border px-2 py-1.5">
            {paletteOpen && (
              <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Component Type
              </p>
            )}
            <button
              type="button"
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                !paletteOpen && "mx-auto"
              )}
              onClick={() => setPaletteOpen((v) => !v)}
              aria-label={
                paletteOpen
                  ? "Collapse component types"
                  : "Expand component types"
              }
            >
              {paletteOpen ? (
                <ChevronLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {paletteOpen ? (
            paletteLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : paletteError ? (
              <div className="p-3 text-center">
                <AlertCircle className="mx-auto mb-1 h-4 w-4 text-destructive" />
                <p className="text-[10px] text-destructive">{paletteError}</p>
                <button
                  type="button"
                  className="mt-2 text-[10px] text-primary underline"
                  onClick={() => {
                    setPaletteLoading(true);
                    setPaletteError(null);
                    setFetchTick((t) => t + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-2">
                <ul className="flex flex-col gap-1">
                  {paletteItems.map(({ menuTypeId, type, name, Icon }) => (
                    <li key={menuTypeId}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(MIME_TYPE, type);
                          e.dataTransfer.setData(MIME_MENU_TYPE_ID, menuTypeId);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handlePaletteClick(type, menuTypeId)}
                        className="h-8 w-full justify-start gap-1.5 px-2 text-xs"
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">{name}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] italic text-muted-foreground">
                  Drag a type onto the canvas, or click to add it under the
                  selected node. Edit properties in the Details tab on the
                  right.
                </p>
              </div>
            )
          ) : (
            <TooltipProvider delay={300}>
              <div className="flex flex-col items-center gap-1 py-2">
                {paletteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : paletteError ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  paletteItems.map(({ menuTypeId, type, name, Icon }) => (
                    <Tooltip key={menuTypeId}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(MIME_TYPE, type);
                              e.dataTransfer.setData(
                                MIME_MENU_TYPE_ID,
                                menuTypeId
                              );
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => handlePaletteClick(type, menuTypeId)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background transition-colors hover:bg-accent"
                            aria-label={`Add ${name}`}
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        }
                      />
                      <TooltipContent side="right">{name}</TooltipContent>
                    </Tooltip>
                  ))
                )}
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* ── Center canvas ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspacePanelHeader
            title="Navigation Tree"
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-28 gap-1"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline"> Bulk Import</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-28 gap-1"
                  onClick={() =>
                    exportRowsCsv(
                      "layouts",
                      ["name", "type", "parentId", "module"],
                      flatList.map((c) => ({
                        name: c.name,
                        type: c.type,
                        parentId: c.parentId ?? "",
                        module: c.module,
                      }))
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline"> Export</span>
                </Button>
                {onNext && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1"
                    onClick={onNext}
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
            <div className="relative min-w-32 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={treeSearch}
                onChange={(event) => setTreeSearch(event.target.value)}
                placeholder="Search navigation tree"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!caps.up}
                onClick={() => doMove("up")}
                aria-label="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!caps.down}
                onClick={() => doMove("down")}
                aria-label="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!caps.outdent}
                onClick={doOutdent}
                aria-label="Outdent"
              >
                <IndentDecrease className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!selected}
                onClick={addCustomAction}
                aria-label="Add custom action"
              >
                <WandSparkles className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!caps.indent}
                onClick={doIndent}
                aria-label="Indent"
              >
                <IndentIncrease className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div
            className="flex-1 overflow-x-auto overflow-y-auto"
            onDragOver={(e) => {
              if (
                e.dataTransfer.types.includes(MIME_TYPE) ||
                e.dataTransfer.types.includes(MIME_ID)
              ) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              const type = e.dataTransfer.getData(MIME_TYPE);
              const menuTypeId = e.dataTransfer.getData(MIME_MENU_TYPE_ID);
              const id = e.dataTransfer.getData(MIME_ID);
              if (type) {
                handleCreateNode(type, menuTypeId);
                toast.success(`${type} added at root`);
              } else if (id) {
                reparentNavComponent(id, undefined);
                toast.success("Moved to root");
              }
            }}
          >
            <div className="min-w-[600px] p-2">
              {visibleTree.map((n) => (
                <CanvasNode
                  key={n.id}
                  node={n}
                  depth={0}
                  selectedId={selection}
                  onSelect={setSelectedId}
                  onDelete={handleDelete}
                  onCreateNode={handleCreateNode}
                />
              ))}
              {tree.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No components yet. Drop a type here to start.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Inspector panel ── */}
        <div
          className={cn(
            "flex shrink-0 flex-col overflow-hidden border-l border-border transition-all duration-150",
            inspectorOpen ? "w-72" : "w-9"
          )}
        >
          {inspectorOpen ? (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex items-center border-b border-border bg-secondary/20">
                <TabsList className="h-8 flex-1 justify-start rounded-none bg-transparent px-1">
                  <TabsTrigger value="details" className="h-6 text-xs">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="history" className="h-6 text-xs">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="h-6 text-xs">
                    Audit
                  </TabsTrigger>
                </TabsList>
                <button
                  type="button"
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setInspectorOpen(false)}
                  aria-label="Collapse inspector"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <TabsContent
                value="details"
                className="mt-0 flex flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-auto px-3 py-2">
                  {!selected ? (
                    <p className="py-6 text-center text-[11px] text-muted-foreground">
                      Select a component on the canvas to edit its details.
                    </p>
                  ) : (
                    <PropertiesForm
                      key={selected.id}
                      node={selected}
                      parentName={
                        flatList.find((c) => c.id === selected.parentId)
                          ?.name ?? "— Root —"
                      }
                      parentRoute={
                        flatList.find((c) => c.id === selected.parentId)
                          ?.route ?? ""
                      }
                    />
                  )}
                </div>
                {selected && (
                  <div className="border-t border-border px-3 py-2">
                    <Button
                      size="sm"
                      className="h-8 w-full gap-1"
                      onClick={() => saveSelected("Active")}
                    >
                      <Save className="h-3.5 w-3.5" /> Save Layout
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="history"
                className="mt-0 flex-1 overflow-auto space-y-2 px-3 py-2"
              >
                <Input
                  value={recentSearch}
                  onChange={(event) => setRecentSearch(event.target.value)}
                  placeholder="Search recent drafts"
                  className="h-8 text-xs"
                />
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-muted-foreground">
                    Recently saved or created nodes will appear here.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {recent.map((item) => (
                      <div key={item.id} className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={
                            item.id === selection ? "secondary" : "ghost"
                          }
                          size="sm"
                          className="h-auto min-w-0 flex-1 justify-start px-2 py-2 text-left"
                          onClick={() => setSelectedId(item.id)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs">
                              {item.name}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {item.type} · {item.status}
                            </span>
                          </span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="audit"
                className="mt-0 flex-1 overflow-auto px-3 py-2"
              >
                <AuditTimeline entities={["navigation"]} limit={30} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setInspectorOpen(true)}
                aria-label="Expand inspector"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                Inspector
              </span>
            </div>
          )}
        </div>
      </div>
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entity="layouts"
        templateHeaders={["name", "type", "parentId", "module"]}
        sampleRow={["Reports", "Menu", "", "Reporting"]}
        onImport={(rows) =>
          rows.forEach((row) => {
            const node = makeNavNode(
              row.type || "Menu",
              row.parentId || undefined
            );
            addNavComponentAt(node);
            updateNavComponent(node.id, {
              name: row.name || node.name,
              status: "Draft",
            });
          })
        }
      />
    </>
  );

  if (embedded) return workspace;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[1200px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Builder</SheetTitle>
          <SheetDescription>Edit the navigation hierarchy.</SheetDescription>
        </SheetHeader>
        {workspace}
      </SheetContent>
    </Sheet>
  );
}

function PropertiesForm({
  node,
  parentName,
  parentRoute,
}: {
  node: NavComponent;
  parentName: string;
  parentRoute?: string;
}) {
  const [name, setName] = useState(node.name);
  const [menuKey, setMenuKey] = useState(node.key ?? "");
  const [description, setDescription] = useState(node.description ?? "");
  const [appliesTo, setAppliesTo] = useState<MenuAppliesTo>(
    node.appliesTo ?? "BOTH"
  );

  /* Hoisted rather than inline: an arrow in JSX is a new prop value on every render, which is
     what react-perf/jsx-no-new-function-as-prop is about. */
  const onAppliesToChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as MenuAppliesTo;
      setAppliesTo(next);
      updateNavComponent(node.id, { appliesTo: next });
    },
    [node.id]
  );

  /*
   * Re-read the fields when a different node is selected.
   *
   * React's documented way of adjusting state on a prop change, rather than an effect that ran on
   * every store update: `node` is a new object whenever anything in the tree changes, so typing a
   * name while something else saved would overwrite what was being typed.
   */
  const [shownNodeId, setShownNodeId] = useState(node.id);
  if (shownNodeId !== node.id) {
    setShownNodeId(node.id);
    setName(node.name);
    setMenuKey(node.key ?? "");
    setDescription(node.description ?? "");
    setAppliesTo(node.appliesTo ?? "BOTH");
  }

  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const autoPath = (() => {
    const base = (parentRoute ?? "").replace(/\/+$/, "");
    const leaf = slug(name) || slug(node.name) || node.id;
    return `${base}/${leaf}`;
  })();

  const persist = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateNavComponent(node.id, {
      name: trimmed,
      key: menuKey.trim(),
      menuKey: menuKey.trim(),
      route: autoPath,
      description: description.trim(),
      appliesTo,
    });
  };

  return (
    <div className="space-y-2.5 text-xs">
      <PropField label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={persist}
          required
          aria-required="true"
          className="h-8 text-xs"
        />
      </PropField>
      <PropField label="Key">
        <Input
          value={menuKey}
          onChange={(e) => setMenuKey(e.target.value)}
          onBlur={persist}
          placeholder="e.g. dashboard-home"
          className="h-8 font-mono text-xs"
        />
      </PropField>
      <PropField label="Path">
        <Input
          value={autoPath}
          readOnly
          className="h-8 bg-muted/40 font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Auto-generated from parent
        </p>
      </PropField>
      <PropField label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={persist}
          rows={2}
          className="text-xs"
        />
      </PropField>
      <PropField label="Applies to">
        <select
          value={appliesTo}
          onChange={onAppliesToChange}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="BOTH">Both levels</option>
          <option value="MASTER">This application only</option>
          <option value="TENANT">Tenants only</option>
        </select>
        <p className="text-[10px] text-muted-foreground">
          {appliesTo === "MASTER"
            ? "Administers the application. Never sent to a tenant."
            : appliesTo === "TENANT"
              ? "Defined here for tenants to have, and hidden from this sidebar."
              : "The same screen at both levels, over each level's own data."}
        </p>
      </PropField>
      <PropField label="Parent">
        <Input
          value={parentName}
          readOnly
          className="h-8 bg-muted/40 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Auto-set when dragged/dropped
        </p>
      </PropField>
    </div>
  );
}

function CanvasNode({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onCreateNode,
}: {
  node: NavTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, hasChildren: boolean) => void;
  onCreateNode: (type: string, menuTypeId: string, parentId?: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [dropPos, setDropPos] = useState<DropPosition | null>(null);
  const has = node.children.length > 0;
  const rowRef = useRef<HTMLDivElement>(null);

  const computePos = (e: React.DragEvent<HTMLDivElement>): DropPosition => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return "into";
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.25) return "before";
    if (y > rect.height * 0.75) return "after";
    return "into";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (
      !e.dataTransfer.types.includes(MIME_TYPE) &&
      !e.dataTransfer.types.includes(MIME_ID)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    setDropPos(computePos(e));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = computePos(e);
    const type = e.dataTransfer.getData(MIME_TYPE);
    const menuTypeId = e.dataTransfer.getData(MIME_MENU_TYPE_ID);
    const id = e.dataTransfer.getData(MIME_ID);
    setDropPos(null);

    if (type) {
      const parentId = pos === "into" ? node.id : node.parentId;
      onCreateNode(type, menuTypeId, parentId);
      toast.success(
        `${type} added ${pos === "into" ? `under ${node.name}` : `${pos} ${node.name}`}`
      );
      return;
    }

    if (id) {
      if (id === node.id) return;
      const newParentId = pos === "into" ? node.id : node.parentId;
      reparentNavComponent(id, newParentId);
    }
  };

  return (
    <div>
      <div
        ref={rowRef}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME_ID, node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropPos(null)}
        onDrop={handleDrop}
        className={cn(
          "group relative grid cursor-pointer grid-cols-[16px_20px_minmax(100px,1fr)_80px_auto] items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent",
          selectedId === node.id && "bg-accent ring-1 ring-primary/30",
          dropPos === "into" && "ring-2 ring-primary"
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        {dropPos === "before" && (
          <div className="pointer-events-none absolute inset-x-1 top-0 h-0.5 bg-primary" />
        )}
        {dropPos === "after" && (
          <div className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 bg-primary" />
        )}
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
        {has ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="h-4 w-4 text-muted-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-90"
              )}
            />
          </Button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <span className="truncate text-foreground">{node.name}</span>
        <ComponentTypeBadge
          type={node.type}
          className="justify-self-start scale-90"
        />
        <div
          className="ml-1 flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          {(node.actionMeta ?? []).map((action) => {
            const isActive = action.actionCode.toUpperCase() === "ACTIVE";
            const checked = isActive
              ? node.status === "Active"
              : (node.actionKeys ?? []).includes(action.actionId);
            return (
              <label
                key={action.actionId}
                className={cn(
                  "flex cursor-pointer items-center gap-1 text-[10px]",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => {
                    const isChecked = val === true;
                    if (isActive) {
                      updateNavComponent(node.id, {
                        status: isChecked ? "Active" : "Draft",
                      });
                    } else {
                      const current = node.actionKeys ?? [];
                      updateNavComponent(node.id, {
                        actionKeys: isChecked
                          ? Array.from(new Set([...current, action.actionId]))
                          : current.filter((k) => k !== action.actionId),
                      });
                    }
                    if (isChecked) activateParents(node.parentId);
                  }}
                  aria-label={`${action.actionName} for ${node.name}`}
                  className="h-3.5 w-3.5"
                />
                {action.actionName}
              </label>
            );
          })}
          <label
            className="flex cursor-pointer select-none items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={node.status === "Active"}
              onCheckedChange={(checked) => {
                updateNavComponent(node.id, {
                  status: checked ? "Active" : "Draft",
                });
              }}
              aria-label={`Toggle ${node.name} active status`}
            />
            <span className="text-[10px] text-muted-foreground">
              {node.status === "Active" ? "Active" : "Inactive"}
            </span>
          </label>
          <TooltipProvider delay={500}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(node.id, has);
                    }}
                    aria-label={`Delete ${node.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                }
              />
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {open &&
        has &&
        node.children.map((c) => (
          <CanvasNode
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            onCreateNode={onCreateNode}
          />
        ))}
    </div>
  );
}

function PropField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function flatten(tree: NavTreeNode[]): NavComponent[] {
  const out: NavComponent[] = [];
  const walk = (n: NavTreeNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

function filterTree(tree: NavTreeNode[], query: string): NavTreeNode[] {
  const value = query.trim().toLowerCase();
  if (!value) return tree;
  return tree.flatMap((node) => {
    const children = filterTree(node.children, value);
    return `${node.name} ${node.key}`.toLowerCase().includes(value) ||
      children.length
      ? [{ ...node, children }]
      : [];
  });
}

function activateParents(parentId?: string) {
  let currentId = parentId;
  const nodes = getNavComponents();
  while (currentId) {
    const parent = nodes.find((item) => item.id === currentId);
    if (!parent) break;
    updateNavComponent(parent.id, {
      status: "Active",
      actionKeys: Array.from(new Set([...(parent.actionKeys ?? []), "view"])),
    });
    currentId = parent.parentId;
  }
}
