import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

type DemoFormValues = {
  startDate: Date | undefined;
};

const defaultEmpty: DemoFormValues = { startDate: undefined };
const defaultMarch2026: DemoFormValues = { startDate: new Date("2026-03-15") };
const defaultJan2026: DemoFormValues = { startDate: new Date("2026-01-01") };
const errorsStartDate = { startDate: "Start date is required" };

const meta = {
  title: "Forms/FormDatePicker",
  component: FormDatePicker,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormDatePicker>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormDatePicker
          control={control}
          name="startDate"
          label="Start date"
          placeholder="Pick a date"
          description="Loan disbursement or first payment date."
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const WithValue: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultMarch2026}>
      {(control) => (
        <FormDatePicker
          control={control}
          name="startDate"
          label="Start date"
          minDate={new Date("2020-01-01")}
          maxDate={new Date("2030-12-31")}
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultEmpty}
      errors={errorsStartDate}
    >
      {(control) => (
        <FormDatePicker
          control={control}
          name="startDate"
          label="Start date"
          placeholder="Pick a date"
          isRequired
          showErrorMessage
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultJan2026}>
      {(control) => (
        <FormDatePicker
          control={control}
          name="startDate"
          label="Start date"
          isDisabled
        />
      )}
    </FormStoryShell>
  ),
};
