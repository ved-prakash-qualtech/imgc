import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTableSkeletonBody } from "@imgc/ui/dataTable/DataTableSkeletonBody";
import { DataTableStoryTable } from "@/stories/support/dataTableStoryFixtures";
import { Table } from "@imgc/ui/ui/table";

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
