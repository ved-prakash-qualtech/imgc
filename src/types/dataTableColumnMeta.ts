import type { DataTableSkeletonCellConfig } from "@/types/dataTable";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    skeleton?: DataTableSkeletonCellConfig;
  }
}
