import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTablePagination } from "@/components/dataTable/DataTablePagination";
import { DataTableStoryTable } from "@/lib/storybook/dataTableStoryFixtures";

const customPageSizeOptions = [5, 10, 20, 50];

const meta = {
  title: "DataTable/DataTablePagination",
  component: DataTablePagination,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DataTablePagination>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DataTableStoryTable>
      {(table) => (
        <div className="rounded-lg border border-border">
          <DataTablePagination table={table} />
        </div>
      )}
    </DataTableStoryTable>
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTableStoryTable>
      {(table) => (
        <div className="rounded-lg border border-border">
          <DataTablePagination table={table} loading />
        </div>
      )}
    </DataTableStoryTable>
  ),
};

export const CustomPageSizes: Story = {
  render: () => (
    <DataTableStoryTable pageSize={20}>
      {(table) => (
        <div className="rounded-lg border border-border">
          <DataTablePagination
            table={table}
            pageSizeOptions={customPageSizeOptions}
          />
        </div>
      )}
    </DataTableStoryTable>
  ),
};
