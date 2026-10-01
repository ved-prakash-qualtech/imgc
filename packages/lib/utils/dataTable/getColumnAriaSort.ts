import type { Column } from "@tanstack/react-table";

export function getColumnAriaSort<TData>(
  column: Column<TData, unknown>
): "ascending" | "descending" | "none" | undefined {
  if (!column.getCanSort()) {
    return undefined;
  }

  const sorted = column.getIsSorted();
  if (sorted === "asc") {
    return "ascending";
  }
  if (sorted === "desc") {
    return "descending";
  }
  return "none";
}
