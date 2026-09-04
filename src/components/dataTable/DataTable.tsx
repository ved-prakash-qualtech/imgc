"use client";

import "@/types/dataTableColumnMeta";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { DataTableEmptyRow } from "@/components/dataTable/DataTableEmptyRow";
import { DataTableSkeletonBody } from "@/components/dataTable/DataTableSkeletonBody";
import { DataTableVirtualizedBody } from "@/components/dataTable/DataTableVirtualizedBody";
import { resolveLoadingRowCount } from "@/lib/utils/dataTable/dataTableSkeleton";
import { getColumnAriaSort } from "@/lib/utils/dataTable/getColumnAriaSort";
import { DataTablePagination } from "@/components/dataTable/DataTablePagination";
import { useDataTableUrlState } from "@/hooks/useDataTableUrlState";
import type { DataTableUrlStateConfig } from "@/lib/utils/dataTable/dataTableUrlState";
import type { DataTableLoadingConfig } from "@/types/dataTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/twMergeUtils";

export type DataTableMode = "client" | "server";

export type DataTableVirtualizeConfig = Readonly<{
  rowHeight?: number;
  overscan?: number;
  maxHeight?: string;
}>;

export type DataTableProps<TData> = Readonly<{
  columns: ColumnDef<TData>[];
  data: TData[];
  mode?: DataTableMode;
  pageCount?: number;
  rowCount?: number;
  pagination?: PaginationState;
  sorting?: SortingState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  onSortingChange?: OnChangeFn<SortingState>;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  virtualize?: boolean | DataTableVirtualizeConfig;
  urlState?: boolean | DataTableUrlStateConfig;
  loading?: boolean;
  loadingConfig?: DataTableLoadingConfig;
  emptyMessage?: string;
  className?: string;
}>;

const VIRTUALIZE_ROW_THRESHOLD = 100;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

function resolveVirtualizeConfig(
  virtualize: DataTableProps<unknown>["virtualize"],
  rowCount: number
): DataTableVirtualizeConfig | false {
  if (
    virtualize === true ||
    (typeof virtualize === "object" && virtualize !== null)
  ) {
    return typeof virtualize === "object" ? virtualize : {};
  }
  if (rowCount >= VIRTUALIZE_ROW_THRESHOLD) {
    return {};
  }
  return false;
}

/**
 * Server-side tables: read URL params in the page `searchParams`, fetch `{ rows, total }`,
 * then render `<DataTable mode="server" data={rows} rowCount={total} pageCount={...} urlState />`.
 */
export function DataTable<TData>(props: DataTableProps<TData>) {
  if (props.urlState) {
    const urlConfig: DataTableUrlStateConfig =
      props.urlState === true
        ? { defaultPageSize: props.defaultPageSize ?? 10 }
        : { defaultPageSize: props.defaultPageSize ?? 10, ...props.urlState };
    return <DataTableWithUrl {...props} urlConfig={urlConfig} />;
  }
  return <DataTableInner {...props} />;
}

type DataTableWithUrlProps<TData> = Readonly<
  DataTableProps<TData> & {
    urlConfig: DataTableUrlStateConfig;
  }
>;

function DataTableWithUrl<TData>({
  urlConfig,
  ...props
}: DataTableWithUrlProps<TData>) {
  const urlTableState = useDataTableUrlState(urlConfig);
  return (
    <DataTableInner
      {...props}
      pagination={urlTableState.pagination}
      sorting={urlTableState.sorting}
      onPaginationChange={urlTableState.onPaginationChange}
      onSortingChange={urlTableState.onSortingChange}
    />
  );
}

function DataTableInner<TData>({
  columns,
  data,
  mode = "client",
  pageCount: pageCountProp,
  rowCount: rowCountProp,
  pagination: paginationProp,
  sorting: sortingProp,
  onPaginationChange: onPaginationChangeProp,
  onSortingChange: onSortingChangeProp,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  virtualize,
  loading = false,
  loadingConfig,
  emptyMessage: emptyMessageProp,
  className,
}: DataTableProps<TData>) {
  const t = useTranslations("dataTable");
  const emptyMessage = emptyMessageProp ?? t("emptyMessage");
  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [localSorting, setLocalSorting] = useState<SortingState>([]);

  const pagination = paginationProp ?? localPagination;
  const sorting = sortingProp ?? localSorting;
  const onPaginationChange = onPaginationChangeProp ?? setLocalPagination;
  const onSortingChange = onSortingChangeProp ?? setLocalSorting;
  const isPaginationControlled = paginationProp !== undefined;

  const isServer = mode === "server";
  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { pagination, sorting },
    onPaginationChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    ...(isServer
      ? {
          manualPagination: true,
          manualSorting: true,
          pageCount: pageCountProp ?? -1,
          rowCount: rowCountProp,
        }
      : {
          getSortedRowModel: getSortedRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }),
    enableSortingRemoval: true,
    autoResetPageIndex: !isPaginationControlled,
  });

  const virtualConfig = resolveVirtualizeConfig(
    virtualize,
    isServer ? (rowCountProp ?? data.length) : data.length
  );
  const columnCount = table.getAllColumns().length;
  const skeletonRowCount = resolveLoadingRowCount(
    loadingConfig,
    pagination.pageSize
  );

  const header = (
    <TableHeader
      className={cn(virtualConfig && "sticky top-0 z-10 bg-background")}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              scope="col"
              aria-sort={getColumnAriaSort(header.column)}
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );

  const standardBody = loading ? (
    <DataTableSkeletonBody table={table} rowCount={skeletonRowCount} />
  ) : (
    <TableBody>
      {table.getRowModel().rows.length > 0 ? (
        table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() ? "selected" : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <DataTableEmptyRow colSpan={columnCount} message={emptyMessage} />
      )}
    </TableBody>
  );

  return (
    <div
      className={cn("flex flex-col gap-0", className)}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="sr-only">{t("loading")}</span> : null}
      {virtualConfig ? (
        <div
          ref={scrollRef}
          className="relative w-full overflow-auto rounded-lg border border-border"
          style={{ maxHeight: virtualConfig.maxHeight ?? "32rem" }}
        >
          <table className="w-full caption-bottom text-sm">
            {header}
            {loading ? (
              <DataTableSkeletonBody
                table={table}
                rowCount={skeletonRowCount}
              />
            ) : (
              <DataTableVirtualizedBody
                table={table}
                parentRef={scrollRef}
                rowHeight={virtualConfig.rowHeight}
                overscan={virtualConfig.overscan}
                emptyMessage={emptyMessage}
              />
            )}
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            {header}
            {standardBody}
          </Table>
        </div>
      )}
      <DataTablePagination
        table={table}
        pageSizeOptions={pageSizeOptions}
        loading={loading}
      />
    </div>
  );
}
