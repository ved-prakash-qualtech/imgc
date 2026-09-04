import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PageShell } from "@/components/layout/PageShell";

const meta = {
  title: "Layout/PageShell",
  component: PageShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "Loans",
    children: (
      <p className="text-sm text-muted-foreground">
        Page content goes inside the shell.
      </p>
    ),
  },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSections: Story = {
  args: {
    title: "Loan details",
    children: (
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Overview of the selected loan.
          </p>
        </section>
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Documents</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Supporting files and agreements.
          </p>
        </section>
      </div>
    ),
  },
};
