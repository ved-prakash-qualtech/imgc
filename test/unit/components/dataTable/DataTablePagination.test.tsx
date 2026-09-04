import { fireEvent, render, screen } from "@testing-library/react";
import type { Table } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

import { DataTablePagination } from "@/components/dataTable/DataTablePagination";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type RowData = { id: string };

function createMockTable(pageCount: number): Table<RowData> {
  const setPageIndex = vi.fn();

  return {
    getState: () => ({
      pagination: { pageIndex: 0, pageSize: 10 },
    }),
    getPageCount: () => pageCount,
    getPrePaginationRowModel: () => ({ rows: { length: 0 } }),
    options: { rowCount: undefined },
    setPageSize: vi.fn(),
    setPageIndex,
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    getCanPreviousPage: () => false,
    getCanNextPage: () => pageCount > 0,
  } as unknown as Table<RowData>;
}

describe("DataTablePagination", () => {
  it("does not navigate to a negative page when pageCount is zero", () => {
    const table = createMockTable(0);

    render(<DataTablePagination table={table} />);

    const lastPageButton = screen.getByRole("button", { name: "goToLastPage" });
    expect(lastPageButton).toBeDisabled();

    fireEvent.click(lastPageButton);

    expect(table.setPageIndex).not.toHaveBeenCalled();
  });

  it("navigates to the last page when pageCount is positive", () => {
    const table = createMockTable(3);

    render(<DataTablePagination table={table} />);

    fireEvent.click(screen.getByRole("button", { name: "goToLastPage" }));

    expect(table.setPageIndex).toHaveBeenCalledWith(2);
  });
});
