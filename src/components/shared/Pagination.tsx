"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Pagination
 *
 * Generic, controlled pagination footer: range summary, rows-per-page
 * selector, first/prev/next/last controls and a jump-to-page input.
 * Pair with the `usePagination` hook for the page-slicing state.
 *
 * Every handler is a `useCallback` rather than an inline arrow: this footer sits under a table
 * that re-renders on every keystroke in its search box, and a fresh function identity on each
 * pass re-renders all seven controls with it.
 */
export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = "records",
  pageSizeOptions = [10, 25, 50, 100],
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
  pageSizeOptions?: number[];
}) {
  const [jump, setJump] = useState("");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(page, pageCount);
  const start = (safe - 1) * pageSize;

  const handlePageSizeChange = useCallback(
    // Base UI's Select can report a cleared value as null; there is no clear affordance here, but
    // the signature allows it, so it is ignored rather than turned into `Number(null)` — zero.
    (value: string | null) => {
      if (value === null) return;
      onPageSizeChange(Number(value));
      onPageChange(1);
    },
    [onPageSizeChange, onPageChange]
  );

  const goFirst = useCallback(() => onPageChange(1), [onPageChange]);
  const goPrevious = useCallback(
    () => onPageChange(safe - 1),
    [onPageChange, safe]
  );
  const goNext = useCallback(
    () => onPageChange(safe + 1),
    [onPageChange, safe]
  );
  const goLast = useCallback(
    () => onPageChange(pageCount),
    [onPageChange, pageCount]
  );

  const handleJumpChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setJump(event.target.value.replace(/\D/g, ""));
    },
    []
  );

  const handleJumpKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      onPageChange(Math.min(Math.max(1, Number(jump) || 1), pageCount));
      setJump("");
    },
    [jump, onPageChange, pageCount]
  );

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-border bg-card px-3 py-2 sm:flex-row">
      <div className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {total === 0 ? 0 : start + 1}–{Math.min(start + pageSize, total)}
        </span>{" "}
        of <span className="font-semibold text-foreground">{total}</span>{" "}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="h-8 w-[72px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-2 flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safe <= 1}
            onClick={goFirst}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safe <= 1}
            onClick={goPrevious}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-1 text-xs text-muted-foreground">
            Page {safe} of {pageCount}
          </span>
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safe >= pageCount}
            onClick={goNext}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safe >= pageCount}
            onClick={goLast}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Input
            value={jump}
            onChange={handleJumpChange}
            onKeyDown={handleJumpKeyDown}
            placeholder="Go #"
            className="ml-2 h-8 w-16 text-xs"
            aria-label="Jump to page"
          />
        </div>
      </div>
    </div>
  );
}
