import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTable } from "@/components/dataTable/DataTable";
import {
  demoColumns,
  minimalDemoRows,
  type DemoRow,
} from "@/lib/storybook/dataTableStoryFixtures";

const emptyRows: DemoRow[] = [];
const loadingConfig = { rowCount: 3 };
const virtualizeConfig = {
  maxHeight: "16rem",
  rowHeight: 48,
};
const serverPagination = { pageIndex: 0, pageSize: 3 };

const meta = {
  title: "DataTable/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DataTable
      columns={demoColumns}
      data={minimalDemoRows}
      defaultPageSize={5}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      columns={demoColumns}
      data={emptyRows}
      emptyMessage="No loans found."
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable
      columns={demoColumns}
      data={emptyRows}
      loading
      loadingConfig={loadingConfig}
    />
  ),
};

export const Virtualized: Story = {
  render: () => (
    <DataTable
      columns={demoColumns}
      data={minimalDemoRows}
      virtualize={virtualizeConfig}
      defaultPageSize={5}
    />
  ),
};

export const ServerMode: Story = {
  render: () => (
    <DataTable
      columns={demoColumns}
      data={minimalDemoRows}
      mode="server"
      rowCount={9}
      pageCount={3}
      pagination={serverPagination}
    />
  ),
};
