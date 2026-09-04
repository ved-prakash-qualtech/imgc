"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Search, Upload, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  callApi,
  showApiErrorToast,
  showApiSuccessToast,
} from "@/lib/api-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PolicyConditionRow } from "@/components/identity-control/policies/policy-condition-row";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { WorkspacePanelHeader } from "@/components/identity-control/common/workspace-panel-header";
import { BulkImportDialog } from "@/components/identity-control/common/bulk-import-dialog";
import { exportRowsCsv } from "@/lib/identity-control/utils/csv";
import { logAudit } from "@/lib/identity-control/stores/audit-log-store";
import { cn } from "@/lib/utils";
import {
  POLICY_TYPES,
  POLICY_CATEGORIES,
} from "@/constants/identity-control/policy.constants";
import { upsertPolicy } from "@/lib/identity-control/mock-data/policies-data";
import type {
  AccessPolicy,
  PolicyCondition,
  PolicyType,
  PolicyCategory,
} from "@/types/identity-control";
import type {
  PolicyCategoryDropdownItem,
  ApplicationAttributeDropdown,
} from "@/types/identity-control/policy.types";
import { usePolicies } from "@/lib/identity-control/stores/policies-store";
import {
  fetchPolicyCategoryDropdown,
  fetchAttributeDropdown,
  createPolicy,
  fetchPolicies,
} from "@/services/identity-control/policy.service";
import type { PolicyListItem } from "@/types/identity-control/policy.types";

function createDraft(): AccessPolicy {
  const id = "pol-new";
  const now = "1970-01-01T00:00:00.000Z";
  return {
    id,
    key: `policy_${id}`,
    name: "",
    description: "",
    type: "Data",
    resourceKey: "cases",
    actions: [],
    scopeKeys: [],
    conditions: [
      { id: "c1", source: "", attribute: "", operator: "==", value: "" },
    ],
    conditionLogic: "ALL",
    effect: "ALLOW",
    priority: "Medium",
    status: "Draft",
    triggers30d: 0,
    denials30d: 0,
    affectedUsers: 0,
    affectedRoles: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: "You",
    tags: [],
    category: "Data Access Policies",
    audit: [{ id: "a1", at: now, actor: "You", action: "Created policy" }],
  };
}

export function DefinePolicyWorkspace({
  onNext,
}: { onNext?: () => void } = {}) {
  const [draft, setDraft] = useState<AccessPolicy>(createDraft);
  const policies = usePolicies();
  const [recentSearch, setRecentSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<
    PolicyCategoryDropdownItem[]
  >([]);
  const [attributeOptions, setAttributeOptions] = useState<
    ApplicationAttributeDropdown[]
  >([]);
  const [apiPolicies, setApiPolicies] = useState<PolicyListItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPolicyCategoryDropdown()
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]));
    fetchAttributeDropdown()
      .then(setAttributeOptions)
      .catch(() => setAttributeOptions([]));
    fetchPolicies()
      .then(setApiPolicies)
      .catch(() => setApiPolicies([]));
  }, []);

  const updateCondition = (index: number, condition: PolicyCondition) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((item, itemIndex) =>
        itemIndex === index ? condition : item
      ),
    }));

  const addCondition = () =>
    setDraft((current) => ({
      ...current,
      conditions: [
        ...current.conditions,
        {
          id: `c${Date.now()}`,
          source: "",
          attribute: "",
          operator: "==",
          value: "",
        },
      ],
    }));

  const removeCondition = (index: number) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));

  const save = async (status: "Draft" | "Active"): Promise<boolean> => {
    if (!draft.name.trim()) {
      toast.error("Policy Name is required");
      return false;
    }
    if (!draft.categoryId) {
      toast.error("Policy Category is required");
      return false;
    }
    setSaving(true);
    let successMessage = "Operation completed successfully";
    try {
      const payload = {
        policyCategoryId: draft.categoryId,
        name: draft.name.trim(),
        description: draft.description,
        policyType: "SYSTEM_TYPE",
        effect: draft.effect === "ALLOW" ? 1 : 0,
        conditions: draft.conditions.map((c) => ({
          attributeId: c.attribute ?? "",
          operatorType: "AND",
          key: c.source,
          values: c.value,
        })),
      };
      const policyResult = await callApi(() => createPolicy(payload));
      // Refresh policies after successful create
      const refreshed = await fetchPolicies();
      setApiPolicies(refreshed);
      successMessage = policyResult.message;
    } catch (err) {
      showApiErrorToast(err);
      setSaving(false);
      return false;
    }
    const updatedAt = new Date().toISOString();
    const persistedId =
      draft.id === "pol-new"
        ? `pol-${Date.now().toString().slice(-6)}`
        : draft.id;
    const persisted = {
      ...draft,
      id: persistedId,
      key:
        draft.key === "policy_pol-new" || !draft.key.trim()
          ? `policy_${persistedId}`
          : draft.key,
      status,
      updatedAt,
      audit: [
        ...draft.audit,
        {
          id: `a${draft.audit.length + 1}`,
          at: updatedAt,
          actor: "You",
          action: status === "Active" ? "Published policy" : "Saved draft",
        },
      ],
    };
    upsertPolicy(persisted);
    setDraft(persisted);
    logAudit({
      actor: "Application Owner · Maker",
      entity: "policy",
      entityId: persistedId,
      entityName: persisted.name,
      action: draft.id === "pol-new" ? "create" : "update",
      detail: status === "Active" ? "Published policy" : "Saved draft",
    });
    showApiSuccessToast(successMessage);
    setSaving(false);
    return true;
  };

  const handleNext = async () => {
    if ((await save("Active")) && onNext) onNext();
  };

  return (
    <>
      <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-12">
        <main className="min-h-[420px] lg:col-span-9">
          <WorkspacePanelHeader
            title={
              <span className="flex items-center gap-1.5">
                Policy{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-primary"
                  onClick={() => setDraft(createDraft())}
                >
                  <Plus className="h-3 w-3" /> New
                </Button>
              </span>
            }
            actions={
              <>
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
                      "policies",
                      ["name", "type", "description", "effect"],
                      policies.map((p) => ({
                        name: p.name,
                        type: p.type,
                        description: p.description,
                        effect: p.effect,
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
                  onClick={() => void save("Draft")}
                  disabled={saving || !draft.name.trim()}
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                {onNext && (
                  <Button
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => void handleNext()}
                    disabled={saving || !draft.name.trim()}
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            }
          />
          <div className="space-y-4 p-3">
            <section className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Policy Name">
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((c) => ({ ...c, name: e.target.value }))
                    }
                    className="h-8 text-xs"
                    placeholder="e.g. Regional access"
                  />
                </Field>
                <Field label="Policy Category">
                  {categoryOptions.length > 0 ? (
                    <Select
                      value={draft.categoryId ?? ""}
                      onValueChange={(id) => {
                        const found = categoryOptions.find((c) => c.id === id);
                        setDraft((cur) => ({
                          ...cur,
                          categoryId: id == null ? undefined : id,
                          category: (found?.name ??
                            cur.category) as PolicyCategory,
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <span
                          className={cn(
                            "truncate text-xs",
                            !draft.categoryId && "text-muted-foreground"
                          )}
                        >
                          {draft.categoryId
                            ? (categoryOptions.find(
                                (c) => c.id === draft.categoryId
                              )?.name ?? "Select category")
                            : "Select category"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={draft.category ?? "Data Access Policies"}
                      onValueChange={(v) =>
                        setDraft((c) => ({
                          ...c,
                          category: v as PolicyCategory,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description">
                    <Textarea
                      value={draft.description}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, description: e.target.value }))
                      }
                      rows={2}
                      className="text-xs"
                    />
                  </Field>
                </div>
                <Field label="Effect">
                  <label className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                    <span>{draft.effect === "ALLOW" ? "Allow" : "Deny"}</span>
                    <Switch
                      checked={draft.effect === "ALLOW"}
                      onCheckedChange={(checked) =>
                        setDraft((c) => ({
                          ...c,
                          effect: checked ? "ALLOW" : "DENY",
                        }))
                      }
                    />
                  </label>
                </Field>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conditions
              </h3>
              {draft.conditions.map((condition, index) => (
                <div key={condition.id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex justify-center">
                      <div className="inline-flex rounded-full border border-border bg-secondary/60 p-0.5">
                        {(["ALL", "ANY"] as const).map((logic) => (
                          <Button
                            key={logic}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDraft((c) => ({ ...c, conditionLogic: logic }))
                            }
                            className={cn(
                              "h-6 rounded-full px-3 text-[10px]",
                              draft.conditionLogic === logic &&
                                "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            )}
                          >
                            {logic === "ALL" ? "AND" : "OR"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <PolicyConditionRow
                    c={condition}
                    onChange={(next) => updateCondition(index, next)}
                    onRemove={() => removeCondition(index)}
                    attributeOptions={
                      attributeOptions.length > 0 ? attributeOptions : undefined
                    }
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={addCondition}
                >
                  <Plus className="h-3.5 w-3.5" /> Add condition
                </Button>
              </div>
            </section>
          </div>
        </main>

        <aside className="space-y-3 overflow-auto border-t border-border p-3 lg:col-span-3 lg:border-l lg:border-t-0">
          <Tabs defaultValue="list" className="-mx-3 -mt-3 flex flex-col">
            <TabsList className="h-8 w-full justify-start rounded-none border-b border-border bg-secondary/20 px-3">
              <TabsTrigger value="list" className="h-6 text-xs">
                List
              </TabsTrigger>
              <TabsTrigger value="history" className="h-6 text-xs">
                History
              </TabsTrigger>
              <TabsTrigger value="audit" className="h-6 text-xs">
                Audit
              </TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="space-y-2 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  placeholder="Search policies"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {apiPolicies.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  No policies yet. Saved policies will appear here.
                </p>
              ) : (
                <RadioGroup
                  value={draft.id}
                  onValueChange={(id) => {
                    const p = apiPolicies.find((x) => x.id === id);
                    if (p)
                      setDraft((d) => ({
                        ...d,
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        categoryId: p.policyCategoryId,
                      }));
                  }}
                  className="gap-1"
                >
                  {apiPolicies
                    .filter((p) =>
                      p.name.toLowerCase().includes(recentSearch.toLowerCase())
                    )
                    .map((policy) => (
                      <label
                        key={policy.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-accent",
                          draft.id === policy.id &&
                            "bg-accent border border-primary/20"
                        )}
                      >
                        <RadioGroupItem value={policy.id} />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate",
                              draft.id === policy.id &&
                                "text-foreground font-medium"
                            )}
                          >
                            {policy.name}
                          </span>
                        </span>
                      </label>
                    ))}
                </RadioGroup>
              )}
            </TabsContent>
            <TabsContent value="history" className="space-y-2 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  placeholder="Search policies"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {[...policies]
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .filter((p) =>
                  p.name.toLowerCase().includes(recentSearch.toLowerCase())
                )
                .slice(0, 8)
                .map((policy) => (
                  <div key={policy.id} className="flex items-center gap-1">
                    <Button
                      variant={policy.id === draft.id ? "secondary" : "ghost"}
                      size="sm"
                      className="h-auto min-w-0 flex-1 justify-start px-2 py-2 text-left"
                      onClick={() => setDraft(policy)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs">
                          {policy.name}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {policy.type} · {policy.status}
                        </span>
                      </span>
                    </Button>
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="audit" className="px-3 py-2">
              <AuditTimeline entities={["policy"]} limit={30} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entity="policies"
        templateHeaders={["name", "type", "description", "effect"]}
        sampleRow={["Regional access", "Data", "Restrict by region", "ALLOW"]}
        onImport={(rows) =>
          rows.forEach((row) => {
            const next = createDraft();
            upsertPolicy({
              ...next,
              id: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              name: row.name || "Imported Policy",
              description: row.description || "",
              type: (POLICY_TYPES.includes(row.type as PolicyType)
                ? row.type
                : "Data") as PolicyType,
              effect: row.effect === "DENY" ? "DENY" : "ALLOW",
            });
          })
        }
      />
    </>
  );
}

function Field({
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
