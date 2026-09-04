"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Save,
  Search,
  Upload,
  Download,
  ArrowRight,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  callApi,
  showApiErrorToast,
  showApiSuccessToast,
} from "@/lib/api-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addCategory,
  updateCategory,
  upsertCategory,
  useDataCategories,
  type DataCategory as LocalDataCategory,
  type DataCategoryValue as LocalCategoryValue,
} from "@/lib/identity-control/stores/data-categories-store";
import { WorkspacePanelHeader } from "@/components/identity-control/common/workspace-panel-header";
import { BulkImportDialog } from "@/components/identity-control/common/bulk-import-dialog";
import { exportRowsCsv } from "@/lib/identity-control/utils/csv";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { LayeredCategoryTree } from "@/components/identity-control/common/LayeredCategoryTree";
import {
  fetchDataCategories,
  fetchDataCategoryValuesByCategory,
  createDataCategory,
  createDataCategoryValue,
} from "@/services/identity-control/policy.service";
import type { DataCategory as ApiDataCategory } from "@/types/identity-control/policy.types";

export function DefineDataCategoryWorkspace({
  onNext,
}: { onNext?: () => void } = {}) {
  const localCategories = useDataCategories();
  const [apiCategories, setApiCategories] = useState<ApiDataCategory[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newRootName, setNewRootName] = useState("");
  const [categoryType, setCategoryType] = useState<"USER_TYPE" | "SYSTEM_TYPE">(
    "USER_TYPE"
  );
  const [recentSearch, setRecentSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  // Values are no longer part of the category list response, so they are asked
  // for per category and kept against that category's id — two categories never
  // share an entry, and a category that has not been expanded has none.
  const [valuesByCategoryId, setValuesByCategoryId] = useState<
    Map<string, LocalCategoryValue[]>
  >(new Map());
  // Categories whose values are in flight, so the tree can say so instead of
  // showing an empty category that is merely still loading.
  const [loadingValueIds, setLoadingValueIds] = useState<Set<string>>(
    new Set()
  );

  // Merge API categories with local sub-categories
  const categories = useMemo<LocalDataCategory[]>(() => {
    const merged: LocalDataCategory[] = [];
    // Add API root categories
    apiCategories.forEach((apiCat) => {
      merged.push({
        id: apiCat.id,
        key: "", // Hide UUID - don't display it
        name: apiCat.name,
        description: undefined,
        type: "custom",
        categoryType:
          apiCat.dataCategoryType === "USER_TYPE" ? "User" : "System",
        parentId: undefined,
        // Values come from the per-category GET once the row is expanded. The
        // list response is still honoured when it carries them, and a category
        // with neither has none — never undefined.
        values:
          valuesByCategoryId.get(apiCat.id) ??
          (apiCat.dataCategoryValues ?? []).map((v) => ({
            id: v.id,
            key: v.keyCode,
            label: v.valueName,
          })),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        status: apiCat.status === "ACTIVE" ? "Active" : "Draft",
      });
    });
    // Add local sub-categories (those with parentId)
    localCategories.forEach((localCat) => {
      if (localCat.parentId) {
        merged.push(localCat);
      }
    });
    return merged;
  }, [apiCategories, localCategories, valuesByCategoryId]);

  // Ids that exist in the backend, so a locally created sub-category (which the
  // values endpoint knows nothing about) is never asked for.
  const apiCategoryIds = useMemo(
    () => new Set(apiCategories.map((c) => c.id)),
    [apiCategories]
  );

  // Categories whose value list is known: the ones already fetched, plus the
  // local sub-categories, whose values live in the local store. Anything else has
  // simply not been expanded yet, and its value count is not claimed to be zero.
  const loadedValueIds = useMemo(() => {
    const ids = new Set(valuesByCategoryId.keys());
    localCategories.forEach((category) => {
      if (category.parentId) ids.add(category.id);
    });
    return ids;
  }, [valuesByCategoryId, localCategories]);

  /**
   * Fetch one category's values, once. Already loaded or in-flight categories are
   * skipped, so re-expanding a row issues no further request. `force` is used
   * after a value is created, when the cached list is known to be stale.
   */
  const loadCategoryValues = async (categoryId: string, force = false) => {
    if (!apiCategoryIds.has(categoryId)) return;
    if (
      !force &&
      (valuesByCategoryId.has(categoryId) || loadingValueIds.has(categoryId))
    )
      return;
    setLoadingValueIds((current) => new Set(current).add(categoryId));
    try {
      const records = await fetchDataCategoryValuesByCategory(categoryId);
      const values: LocalCategoryValue[] = records.map((record) => ({
        id: record.id,
        key: record.keyCode,
        label: record.valueName,
      }));
      setValuesByCategoryId((current) =>
        new Map(current).set(categoryId, values)
      );
    } catch (error) {
      showApiErrorToast(error);
    } finally {
      setLoadingValueIds((current) => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });
    }
  };

  const expandAll = () => {
    setOpenIds(new Set(categories.map((c) => c.id)));
    categories.forEach((c) => void loadCategoryValues(c.id));
  };
  const collapseAll = () => setOpenIds(new Set());
  const toggleOpen = (id: string) => {
    // Expanding is what asks for the values; collapsing keeps what was loaded.
    if (!openIds.has(id)) void loadCategoryValues(id);
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected =
    categories.find((category) => category.id === selectedId) ?? categories[0];

  useEffect(() => {
    loadApiCategories();
  }, []);

  useEffect(() => {
    if (!selected && categories[0]) setSelectedId(categories[0].id);
  }, [categories, selected]);

  const loadApiCategories = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDataCategories();
      setApiCategories(data);
    } catch (error) {
      console.error("Failed to load data categories:", error);
      showApiErrorToast(error);
    } finally {
      setIsLoading(false);
    }
  };

  const createCategory = async () => {
    if (!newRootName.trim()) return toast.error("Category Name is required");
    setIsLoading(true);
    try {
      const result = await callApi(() =>
        createDataCategory({
          parentId: null,
          name: newRootName.trim(),
          dataCategoryType: categoryType,
          status: "ACTIVE",
        })
      );
      showApiSuccessToast(result.message);
      setNewRootName("");
      setCategoryType("USER_TYPE");
      await loadApiCategories();
    } catch (error) {
      console.error("Failed to create data category:", error);
      showApiErrorToast(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStatus = (status: "Draft" | "Active") => {
    if (!selected) return toast.error("Select a data category");
    updateCategory(selected.id, { status });
    toast.success(
      status === "Active"
        ? "Data Category published"
        : "Data Category saved as draft"
    );
  };

  const handleNext = () => {
    const drafts = categories.filter((c) => (c.status ?? "Active") === "Draft");
    drafts.forEach((c) => updateCategory(c.id, { status: "Active" }));
    if (drafts.length)
      toast.success(
        `Published ${drafts.length} draft categor${drafts.length === 1 ? "y" : "ies"}`
      );
    onNext?.();
  };

  const handleAddValue = async (
    categoryId: string,
    keyCode: string,
    valueName: string
  ) => {
    setIsLoading(true);
    try {
      const result = await callApi(() =>
        createDataCategoryValue({
          dataCategoryId: categoryId,
          keyCode,
          valueName,
          status: "ACTIVE",
        })
      );
      showApiSuccessToast(result.message);
      // The category list no longer carries values, so the new one is picked up
      // by re-reading just this category's values.
      await loadCategoryValues(categoryId, true);
    } catch (error) {
      console.error("Failed to create data category value:", error);
      showApiErrorToast(error);
    } finally {
      setIsLoading(false);
    }
  };

  const hierarchical = (() => {
    const byParent = new Map<string | undefined, typeof categories>();
    categories.forEach((c) => {
      const key = c.parentId;
      if (!byParent.has(key)) byParent.set(key, [] as typeof categories);
      byParent.get(key)!.push(c);
    });
    const out: { cat: (typeof categories)[number]; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      const arr = byParent.get(parentId) ?? [];
      arr.forEach((c) => {
        out.push({ cat: c, depth });
        walk(c.id, depth + 1);
      });
    };
    walk(undefined, 0);
    categories.forEach((c) => {
      if (
        c.parentId &&
        !categories.find((p) => p.id === c.parentId) &&
        !out.find((o) => o.cat.id === c.id)
      ) {
        out.push({ cat: c, depth: 0 });
      }
    });
    return out;
  })();

  return (
    <>
      <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-12">
        <main className="min-h-[420px] lg:col-span-9">
          <WorkspacePanelHeader
            title={
              <span className="flex items-center gap-2">
                Category
                <Input
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createCategory()}
                  placeholder="New root category name…"
                  className="h-7 w-56 text-xs"
                  disabled={isLoading}
                />
                <Select
                  value={categoryType}
                  onValueChange={(value) =>
                    setCategoryType(value as "USER_TYPE" | "SYSTEM_TYPE")
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue placeholder="Category Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER_TYPE">User Type</SelectItem>
                    <SelectItem value="SYSTEM_TYPE">System Type</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-1.5 text-primary"
                  onClick={createCategory}
                  disabled={isLoading}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </span>
            }
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={expandAll}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={collapseAll}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" /> Bulk Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() =>
                    exportRowsCsv(
                      "data-categories",
                      ["name", "description", "values"],
                      categories.map((c) => ({
                        name: c.name,
                        description: c.description ?? "",
                        values: c.values.map((v) => v.label).join("|"),
                      }))
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => saveStatus("Draft")}
                  disabled={!selected}
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
                {onNext && (
                  <Button size="sm" className="h-7 gap-1" onClick={handleNext}>
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            }
          />
          <ScrollArea className="h-[560px]">
            <LayeredCategoryTree
              categories={categories}
              openIds={openIds}
              onToggleOpen={toggleOpen}
              onAddValue={handleAddValue}
              loadingValueIds={loadingValueIds}
              loadedValueIds={loadedValueIds}
            />
          </ScrollArea>
        </main>

        <aside className="space-y-3 border-t border-border p-3 lg:col-span-3 lg:border-l lg:border-t-0">
          <Tabs
            defaultValue="categories"
            className="-mx-3 -mt-3 border-b border-border"
          >
            <TabsList className="h-8 w-full justify-start rounded-none border-b border-border bg-secondary/20 px-3">
              <TabsTrigger value="categories" className="h-6 text-xs">
                Categories
              </TabsTrigger>
              <TabsTrigger value="history" className="h-6 text-xs">
                History
              </TabsTrigger>
              <TabsTrigger value="audit" className="h-6 text-xs">
                Audit
              </TabsTrigger>
            </TabsList>
            <TabsContent value="categories" className="space-y-2 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  placeholder="Search categories"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <RadioGroup
                value={selected?.id ?? ""}
                onValueChange={setSelectedId}
                className="gap-1"
              >
                {hierarchical
                  .filter(({ cat }) =>
                    cat.name.toLowerCase().includes(recentSearch.toLowerCase())
                  )
                  .map(({ cat: category, depth }) => (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-accent"
                      style={{ paddingLeft: 8 + depth * 12 }}
                    >
                      <RadioGroupItem value={category.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">
                          {category.name}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {category.categoryType ?? "User"}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {category.values.length}
                      </span>
                    </label>
                  ))}
              </RadioGroup>
            </TabsContent>
            <TabsContent value="history" className="space-y-2 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  placeholder="Search categories"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {[...categories]
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .filter((c) =>
                  c.name.toLowerCase().includes(recentSearch.toLowerCase())
                )
                .slice(0, 8)
                .map((category) => (
                  <div key={category.id} className="flex items-center gap-1">
                    <Button
                      variant={
                        category.id === selected?.id ? "secondary" : "ghost"
                      }
                      size="sm"
                      className="h-auto min-w-0 flex-1 justify-start px-2 py-2 text-left"
                      onClick={() => setSelectedId(category.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs">
                          {category.name}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {category.categoryType ?? "User"} ·{" "}
                          {category.status ?? "Active"}
                        </span>
                      </span>
                    </Button>
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="audit" className="space-y-2 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search audit entries"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <AuditTimeline
                entities={["data_category"]}
                limit={50}
                search={auditSearch}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entity="data-categories"
        templateHeaders={["name", "description", "values"]}
        sampleRow={["Region", "Allowed regions", "North|South"]}
        onImport={(rows) =>
          rows.forEach((row) => {
            const category = addCategory({
              name: row.name || "Imported Category",
              description: row.description,
              values: (row.values || "").split("|").filter(Boolean),
            });
            upsertCategory({ ...category, status: "Draft" });
          })
        }
      />
    </>
  );
}
