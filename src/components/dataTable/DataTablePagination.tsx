"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type DataTablePaginationProps<TData> = Readonly<{
  table: Table<TData>;
  pageSizeOptions?: number[];
  loading?: boolean;
}>;

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  loading = false,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("dataTable");
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const rowCount =
    table.options.rowCount ?? table.getPrePaginationRowModel().rows.length;

  const handlePageSizeChange = useCallback(
    (value: string | null) => {
      if (value !== null) table.setPageSize(Number(value));
    },
    [table]
  );
  const handleFirstPage = useCallback(() => {
    table.setPageIndex(0);
  }, [table]);
  const handlePrevPage = useCallback(() => {
    table.previousPage();
  }, [table]);
  const handleNextPage = useCallback(() => {
    table.nextPage();
  }, [table]);
  const handleLastPage = useCallback(() => {
    if (pageCount > 0) {
      table.setPageIndex(pageCount - 1);
    }
  }, [table, pageCount]);
  const canGoToLastPage = pageCount > 0 && table.getCanNextPage();

  return (
    <div className="flex flex-col gap-4 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      {loading ? (
        <Skeleton className="h-4 w-28" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("rowsTotal", { count: rowCount })}
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap">{t("rowsPerPage")}</span>
          <Select
            value={String(pageSize)}
            disabled={loading}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger
              size="sm"
              className="w-22"
              aria-label={t("rowsPerPage")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            {t("pageOf", {
              page: pageCount === 0 ? 0 : pageIndex + 1,
              total: pageCount,
            })}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleFirstPage}
            disabled={loading || !table.getCanPreviousPage()}
            aria-label={t("goToFirstPage")}
          >
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handlePrevPage}
            disabled={loading || !table.getCanPreviousPage()}
            aria-label={t("goToPreviousPage")}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleNextPage}
            disabled={loading || !table.getCanNextPage()}
            aria-label={t("goToNextPage")}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleLastPage}
            disabled={loading || !canGoToLastPage}
            aria-label={t("goToLastPage")}
          >
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
