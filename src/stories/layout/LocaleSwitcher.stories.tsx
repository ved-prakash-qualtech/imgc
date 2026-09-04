import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

const meta = {
  title: "Layout/LocaleSwitcher",
  component: LocaleSwitcher,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
  },
} satisfies Meta<typeof LocaleSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
