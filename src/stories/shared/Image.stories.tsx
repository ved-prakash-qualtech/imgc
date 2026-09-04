import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Image } from "@/components/shared/Image";

const meta = {
  title: "Shared/Image",
  component: Image,
  tags: ["autodocs"],
  argTypes: {
    showSkeleton: {
      control: "boolean",
    },
    fill: {
      control: "boolean",
    },
  },
  args: {
    alt: "Sample landscape",
    width: 320,
    height: 200,
    src: "https://picsum.photos/seed/storybook/640/400",
    showSkeleton: true,
    fill: false,
  },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutSkeleton: Story = {
  args: {
    showSkeleton: false,
  },
};

export const Fill: Story = {
  args: {
    fill: true,
    width: undefined,
    height: undefined,
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 w-80">
        <Story />
      </div>
    ),
  ],
};

export const WithFallback: Story = {
  args: {
    src: "https://invalid.example/broken-image.png",
    fallback: (
      <div className="flex size-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
        Image unavailable
      </div>
    ),
  },
};
