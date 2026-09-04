import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";

/**
 * miFIN™ numbered Pagination — "← Prev [1] 2 3 4 5 Next →" style, used
 * standalone (e.g. Advanced · Grouped Rows). Framework-agnostic: pass
 * `page` / `pageCount` / `onPageChange`, not coupled to TanStack Table
 * (see `DataTablePagination` for the rows-per-page + first/last variant).
 */

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationLink({
  className,
  isActive,
  ...props
}: React.ComponentProps<"button"> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-primary text-white"
          : "text-neutral-700 hover:bg-neutral-50",
        className
      )}
      {...props}
    />
  );
}

function PaginationEllipsis({ className }: { className?: string }) {
  return (
    <span
      data-slot="pagination-ellipsis"
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center text-neutral-400",
        className
      )}
    >
      <MoreHorizontalIcon className="size-4" />
    </span>
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("gap-1 px-2 text-neutral-700", className)}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      Prev
    </Button>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("gap-1 px-2 text-neutral-700", className)}
      {...props}
    >
      Next
      <ChevronRightIcon className="size-4" />
    </Button>
  );
}

/** Builds a "1 … 4 5 6 … 20" page-number list around the current page. */
function getPaginationRange(
  page: number,
  pageCount: number,
  siblingCount = 1
): (number | "ellipsis")[] {
  const totalVisible = siblingCount * 2 + 5;
  if (pageCount <= totalVisible) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 2);
  const rightSibling = Math.min(page + siblingCount, pageCount - 1);

  const range: (number | "ellipsis")[] = [1];
  if (leftSibling > 2) range.push("ellipsis");
  for (let i = leftSibling; i <= rightSibling; i++) range.push(i);
  if (rightSibling < pageCount - 1) range.push("ellipsis");
  range.push(pageCount);
  return range;
}

type PaginationNumbersProps = Readonly<{
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}>;

/** The full "Prev [1] 2 3 4 5 Next" row — page-number pills + prev/next. */
function PaginationNumbers({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
}: PaginationNumbersProps) {
  const range = getPaginationRange(page, pageCount, siblingCount);

  return (
    <Pagination>
      <PaginationPrevious
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      />
      {range.map((item, index) =>
        item === "ellipsis" ? (
          <PaginationEllipsis key={`ellipsis-${index}`} />
        ) : (
          <PaginationLink
            key={item}
            isActive={item === page}
            onClick={() => onPageChange(item)}
          >
            {item}
          </PaginationLink>
        )
      )}
      <PaginationNext
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
      />
    </Pagination>
  );
}

export {
  Pagination,
  PaginationLink,
  PaginationEllipsis,
  PaginationPrevious,
  PaginationNext,
  PaginationNumbers,
  getPaginationRange,
};
