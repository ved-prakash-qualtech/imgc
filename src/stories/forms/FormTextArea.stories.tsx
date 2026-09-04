import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormTextArea } from "@/components/forms/FormTextArea";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

type DemoFormValues = {
  description: string;
};

const defaultEmpty: DemoFormValues = { description: "" };
const defaultWithValue: DemoFormValues = {
  description: "Consolidating existing debt with a fixed-rate term loan.",
};
const defaultReadOnly: DemoFormValues = {
  description: "This field cannot be edited.",
};
const errorsDescription = {
  description: "Description must be at least 10 characters",
};

const meta = {
  title: "Forms/FormTextArea",
  component: FormTextArea,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormTextArea>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormTextArea
          control={control}
          name="description"
          label="Description"
          placeholder="Add notes about this loan"
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const WithValue: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithValue}>
      {(control) => (
        <FormTextArea
          control={control}
          name="description"
          label="Description"
          placeholder="Add notes"
          maxLength={500}
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultEmpty}
      errors={errorsDescription}
    >
      {(control) => (
        <FormTextArea
          control={control}
          name="description"
          label="Description"
          placeholder="Add notes"
          showErrorMessage
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultReadOnly}>
      {(control) => (
        <FormTextArea
          control={control}
          name="description"
          label="Description"
          isDisabled
        />
      )}
    </FormStoryShell>
  ),
};
