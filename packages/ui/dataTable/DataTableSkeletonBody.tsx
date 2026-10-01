"use client";

import type { Table } from "@tanstack/react-table";

import { resolveSkeletonClassName } from "@imgc/lib/utils/dataTable/dataTableSkeleton";
import { Skeleton } from "@imgc/ui/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@imgc/ui/ui/table";

type DataTableSkeletonBodyProps<TData> = Readonly<{
  table: Table<TData>;
  rowCount: number;
}>;

export function DataTableSkeletonBody<TData>({
  table,
  rowCount,
}: DataTableSkeletonBodyProps<TData>) {
  const columns = table.getVisibleLeafColumns();

  return (
    <TableBody>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <TableRow
          key={`skeleton-row-${rowIndex}`}
          className="pointer-events-none"
        >
          {columns.map((column) => (
            <TableCell key={column.id}>
              <Skeleton
                className={resolveSkeletonClassName(
                  column.columnDef.meta?.skeleton
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
