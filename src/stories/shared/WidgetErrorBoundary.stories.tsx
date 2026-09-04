import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import { ErrorStoryTrigger } from "@/lib/storybook/ErrorStoryTrigger";

const meta = {
  title: "Shared/WidgetErrorBoundary",
  component: WidgetErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof WidgetErrorBoundary>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <WidgetErrorBoundary>
      <div className="rounded-md border border-border p-4 text-sm">
        Widget content renders normally.
      </div>
    </WidgetErrorBoundary>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <WidgetErrorBoundary label="Credit score">
      <div className="rounded-md border border-border p-4">
        <ErrorStoryTrigger label="Trigger widget error" />
      </div>
    </WidgetErrorBoundary>
  ),
};

export const WithoutLabel: Story = {
  render: () => (
    <WidgetErrorBoundary>
      <div className="rounded-md border border-border p-4">
        <ErrorStoryTrigger label="Trigger widget error" />
      </div>
    </WidgetErrorBoundary>
  ),
};

export const AppVariant: Story = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <WidgetErrorBoundary variant="app">
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          Content renders normally until an error is triggered.
        </p>
      </div>
    </WidgetErrorBoundary>
  ),
};

export const AppVariantWithError: Story = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <WidgetErrorBoundary variant="app">
      <div className="p-8">
        <ErrorStoryTrigger label="Trigger app error" />
      </div>
    </WidgetErrorBoundary>
  ),
};
