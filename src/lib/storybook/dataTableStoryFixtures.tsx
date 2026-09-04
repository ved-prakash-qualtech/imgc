"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";

export type DemoRow = Readonly<{
  id: string;
  title: string;
  amount: number;
  status: string;
}>;

/** Small static dataset for Storybook table stories. */
export const minimalDemoRows: DemoRow[] = [
  { id: "1", title: "Home loan", amount: 125_000, status: "Active" },
  { id: "2", title: "Auto loan", amount: 18_500, status: "Pending" },
  { id: "3", title: "Personal loan", amount: 8_000, status: "Active" },
];

export const demoRows = minimalDemoRows;

export const demoColumns: ColumnDef<DemoRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    meta: { skeleton: { variant: "text" } },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ getValue }) => `$${getValue<number>().toLocaleString()}`,
    meta: { skeleton: { variant: "text", className: "w-20" } },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    meta: { skeleton: { variant: "badge" } },
  },
];

type DataTableStoryTableProps = Readonly<{
  data?: DemoRow[];
  columns?: ColumnDef<DemoRow>[];
  pageSize?: number;
  children: (table: Table<DemoRow>) => ReactNode;
}>;

export function DataTableStoryTable({
  data = demoRows,
  columns = demoColumns,
  pageSize = 10,
  children,
}: DataTableStoryTableProps) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
  });

  return children(table);
}
