"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useCallback, type HTMLAttributes } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";

type DataTableColumnHeaderProps<TData, TValue> = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    column: Column<TData, TValue>;
    title: string;
  }
>;

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted();
  const handleSort = useCallback(() => {
    column.toggleSorting(column.getIsSorted() === "asc");
  }, [column]);

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8"
        onClick={handleSort}
        aria-label={`Sort by ${title}`}
      >
        <span>{title}</span>
        {sorted === "desc" ? (
          <ArrowDownIcon className="size-4" aria-hidden />
        ) : sorted === "asc" ? (
          <ArrowUpIcon className="size-4" aria-hidden />
        ) : (
          <ArrowUpDownIcon className="size-4 opacity-50" aria-hidden />
        )}
      </Button>
    </div>
  );
}
