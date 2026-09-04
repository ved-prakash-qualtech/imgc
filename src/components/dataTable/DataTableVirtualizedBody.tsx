"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useMemo, type RefObject } from "react";

import { DataTableEmptyRow } from "@/components/dataTable/DataTableEmptyRow";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

type DataTableVirtualizedBodyProps<TData> = Readonly<{
  table: Table<TData>;
  parentRef: RefObject<HTMLDivElement | null>;
  rowHeight?: number;
  overscan?: number;
  emptyMessage?: string;
}>;

const ROW_BODY_BASE: React.CSSProperties = { position: "relative" };
const ROW_CELL_BASE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
};

export function DataTableVirtualizedBody<TData>({
  table,
  parentRef,
  rowHeight = 48,
  overscan = 8,
  emptyMessage,
}: DataTableVirtualizedBodyProps<TData>) {
  const rows = table.getRowModel().rows;

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const bodyStyle = useMemo<React.CSSProperties>(
    () => ({ ...ROW_BODY_BASE, height: `${totalSize}px` }),
    [totalSize]
  );

  return (
    <TableBody style={bodyStyle}>
      {virtualRows.length > 0 ? (
        virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) {
            return null;
          }

          return (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              style={{
                ...ROW_CELL_BASE,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          );
        })
      ) : (
        <DataTableEmptyRow
          colSpan={table.getAllColumns().length}
          message={emptyMessage}
        />
      )}
    </TableBody>
  );
}
