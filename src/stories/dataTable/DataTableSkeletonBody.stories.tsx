import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTableSkeletonBody } from "@/components/dataTable/DataTableSkeletonBody";
import { DataTableStoryTable } from "@/lib/storybook/dataTableStoryFixtures";
import { Table } from "@/components/ui/table";

const meta = {
  title: "DataTable/DataTableSkeletonBody",
  component: DataTableSkeletonBody,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DataTableSkeletonBody>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DataTableStoryTable>
      {(table) => (
        <div className="rounded-lg border border-border">
          <Table>
            <DataTableSkeletonBody table={table} rowCount={5} />
          </Table>
        </div>
      )}
    </DataTableStoryTable>
  ),
};

export const Compact: Story = {
  render: () => (
    <DataTableStoryTable>
      {(table) => (
        <div className="rounded-lg border border-border">
          <Table>
            <DataTableSkeletonBody table={table} rowCount={3} />
          </Table>
        </div>
      )}
    </DataTableStoryTable>
  ),
};
