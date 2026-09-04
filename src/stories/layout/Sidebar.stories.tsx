import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Sidebar } from "@/components/layout/Sidebar";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithChildren: Story = {
  args: {
    children: (
      <nav className="flex flex-col gap-1 p-2">
        <button
          type="button"
          className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
        >
          Dashboard
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          Applications
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          Reports
        </button>
      </nav>
    ),
  },
};
