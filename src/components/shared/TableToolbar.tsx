"use client";

import { useCallback } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Columns3,
  LayoutGrid,
  List,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * TableToolbar
 *
 * Generic search + filter toolbar for list/table screens. All controls are
 * optional: pass handlers to enable Filters, Clear, Columns and a list/grid
 * view toggle. A `trailing` slot allows callers to append custom controls.
 */
export function TableToolbar({
  search,
  onSearch,
  placeholder = "Search…",
  onFilters,
  onClear,
  onColumns,
  view,
  onViewChange,
  trailing,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  onFilters?: () => void;
  onClear?: () => void;
  onColumns?: () => void;
  view?: "list" | "grid";
  onViewChange?: (view: "list" | "grid") => void;
  trailing?: ReactNode;
}) {
  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onSearch?.(event.target.value),
    [onSearch]
  );
  const showList = useCallback(() => onViewChange?.("list"), [onViewChange]);
  const showGrid = useCallback(() => onViewChange?.("grid"), [onViewChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search ?? ""}
          onChange={handleSearch}
          placeholder={placeholder}
          className="h-9 w-full border-transparent bg-muted/40 pl-8 text-sm focus-visible:bg-white"
        />
      </div>
      {onFilters && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onFilters}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </Button>
      )}
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
      {onColumns && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onColumns}
        >
          <Columns3 className="h-3.5 w-3.5" /> Columns
        </Button>
      )}
      {onViewChange && (
        <div className="inline-flex h-9 items-center rounded-md border border-border bg-white p-0.5">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={showList}
            className={`grid h-8 w-8 place-items-center rounded ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-pressed={view === "grid"}
            onClick={showGrid}
            className={`grid h-8 w-8 place-items-center rounded ${view === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      )}
      {trailing}
    </div>
  );
}
