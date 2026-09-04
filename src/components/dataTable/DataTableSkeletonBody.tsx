"use client";

import type { Table } from "@tanstack/react-table";

import { resolveSkeletonClassName } from "@/lib/utils/dataTable/dataTableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

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
