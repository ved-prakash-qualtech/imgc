import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@imgc/ui/shared/Badge";

const meta = {
  title: "Shared/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Draft",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Status: Story = {
  args: {
    children: "Pending review",
  },
};

export const LongLabel: Story = {
  args: {
    children: "Requires additional documentation",
  },
};
