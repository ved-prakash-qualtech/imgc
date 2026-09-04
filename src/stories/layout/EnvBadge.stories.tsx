import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EnvBadge } from "@/components/layout/EnvBadge";
import { appConfig } from "@/constants/config";

const meta = {
  title: "Layout/EnvBadge",
  component: EnvBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof EnvBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preview: Story = {
  render: () => (
    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {appConfig.appEnv}
    </span>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Preview of the badge styling. The real component is hidden when `appConfig.isProduction` is true.",
      },
    },
  },
};
