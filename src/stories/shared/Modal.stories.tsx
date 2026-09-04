import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Shared/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Confirm action",
    children: (
      <p className="text-sm text-muted-foreground">
        Review the details below before continuing.
      </p>
    ),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    title: "Delete draft",
    children: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This draft will be permanently removed.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="button" variant="destructive">
            Delete
          </Button>
        </div>
      </div>
    ),
  },
};
