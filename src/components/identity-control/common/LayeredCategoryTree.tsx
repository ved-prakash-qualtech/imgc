"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addCategory,
  removeCategory,
  removeValue,
  type DataCategory,
} from "@/lib/identity-control/stores/data-categories-store";

export function LayeredCategoryTree({
  categories,
  openIds,
  onToggleOpen,
  onAddValue,
  loadingValueIds,
  loadedValueIds,
}: {
  categories: DataCategory[];
  openIds: Set<string>;
  onToggleOpen: (id: string) => void;
  onAddValue?: (
    categoryId: string,
    keyCode: string,
    valueName: string
  ) => Promise<void>;
  // Categories whose values are being fetched right now. Optional: without it
  // nothing is treated as loading, which is the behavior callers that hand over
  // fully populated categories already rely on.
  loadingValueIds?: Set<string>;
  // Categories whose values are known. Optional for the same reason — when it is
  // not given every category counts as known and the value count is shown.
  loadedValueIds?: Set<string>;
}) {
  const childrenOf = useMemo(() => {
    const m = new Map<string | undefined, DataCategory[]>();
    categories.forEach((c) => {
      const k = c.parentId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return m;
  }, [categories]);

  const roots = childrenOf.get(undefined) ?? [];

  if (roots.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-muted-foreground">
        No categories yet. Click{" "}
        <span className="font-medium text-foreground">+ New</span> in the panel
        header to add one.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {roots.map((c) => (
        <CategoryNode
          key={c.id}
          cat={c}
          depth={0}
          childrenOf={childrenOf}
          openIds={openIds}
          onToggleOpen={onToggleOpen}
          onAddValue={onAddValue}
          loadingValueIds={loadingValueIds}
          loadedValueIds={loadedValueIds}
        />
      ))}
    </div>
  );
}

function CategoryNode({
  cat,
  depth,
  childrenOf,
  openIds,
  onToggleOpen,
  onAddValue,
  loadingValueIds,
  loadedValueIds,
}: {
  cat: DataCategory;
  depth: number;
  childrenOf: Map<string | undefined, DataCategory[]>;
  openIds: Set<string>;
  onToggleOpen: (id: string) => void;
  onAddValue?: (
    categoryId: string,
    keyCode: string,
    valueName: string
  ) => Promise<void>;
  loadingValueIds?: Set<string>;
  loadedValueIds?: Set<string>;
}) {
  const kids = childrenOf.get(cat.id) ?? [];
  const open = openIds.has(cat.id);
  const loadingValues = loadingValueIds?.has(cat.id) ?? false;
  // Without a loadedValueIds set the caller owns the values outright, so the
  // count is always meaningful.
  const valuesKnown = loadedValueIds ? loadedValueIds.has(cat.id) : true;
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childCode, setChildCode] = useState("");

  const submitChild = async () => {
    if (!childName.trim()) return;
    if (onAddValue) {
      // Use API for data category values
      await onAddValue(cat.id, childCode.trim(), childName.trim());
    } else {
      // Use local store for sub-categories
      addCategory({
        name: childName.trim(),
        key: childCode.trim() || undefined,
        parentId: cat.id,
      });
    }
    setChildName("");
    setChildCode("");
    setAddingChild(false);
    if (!open) onToggleOpen(cat.id);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-accent/40"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onToggleOpen(cat.id)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-90"
            )}
          />
        </Button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {cat.key && (
            <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {cat.key}
            </span>
          )}
          <span className="truncate font-medium text-foreground">
            {cat.name}
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          {kids.length} sub{valuesKnown ? ` · ${cat.values.length} val` : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-primary"
          onClick={() => {
            setAddingChild(true);
            if (!open) onToggleOpen(cat.id);
          }}
          aria-label="Add sub-category"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-destructive/70 hover:text-destructive"
          onClick={() => removeCategory(cat.id)}
          aria-label="Delete category"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div>
          {loadingValues && cat.values.length === 0 && (
            <p
              className="py-1 text-[11px] italic text-muted-foreground"
              style={{ paddingLeft: 8 + (depth + 1) * 14 + 24 }}
            >
              Loading values…
            </p>
          )}
          {/* Code and name only — the record's id, status and timestamps are not shown. */}
          {cat.values.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground"
              style={{ paddingLeft: 8 + (depth + 1) * 14 + 24 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              <span className="shrink-0 font-mono text-[10px]">{v.key}</span>
              <span className="flex-1 truncate text-foreground">{v.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeValue(cat.id, v.id)}
                aria-label="Remove value"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {addingChild && (
            <TwoFieldInlineInput
              depth={depth + 1}
              nameValue={childName}
              codeValue={childCode}
              onNameChange={setChildName}
              onCodeChange={setChildCode}
              onSubmit={submitChild}
              onCancel={() => {
                setChildName("");
                setChildCode("");
                setAddingChild(false);
              }}
            />
          )}
          {kids.map((k) => (
            <CategoryNode
              key={k.id}
              cat={k}
              depth={depth + 1}
              childrenOf={childrenOf}
              openIds={openIds}
              onToggleOpen={onToggleOpen}
              onAddValue={onAddValue}
              loadingValueIds={loadingValueIds}
              loadedValueIds={loadedValueIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TwoFieldInlineInput({
  depth,
  nameValue,
  codeValue,
  onNameChange,
  onCodeChange,
  onSubmit,
  onCancel,
}: {
  depth: number;
  nameValue: string;
  codeValue: string;
  onNameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-end gap-2 py-2 pr-2"
      style={{ paddingLeft: 8 + depth * 14 + 24 }}
    >
      <div className="flex-1 space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          Sub Category Code
        </span>
        <Input
          autoFocus
          value={codeValue}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. FINANCE"
          className="h-7 font-mono text-xs"
        />
      </div>
      <div className="flex-1 space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          Sub Category Name
        </span>
        <Input
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. Finance"
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" className="h-7" onClick={onSubmit}>
          Add
        </Button>
        <Button variant="ghost" size="sm" className="h-7" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
