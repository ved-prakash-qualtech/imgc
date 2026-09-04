import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormCheckboxGroup } from "@/components/forms/FormCheckboxGroup";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

const checkboxOptions = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "push", label: "Push", disabled: true },
] as const;

type DemoFormValues = {
  notifications: string[];
};

const defaultEmpty: DemoFormValues = { notifications: [] };
const defaultWithSelections: DemoFormValues = {
  notifications: ["email", "sms"],
};
const defaultWithEmail: DemoFormValues = { notifications: ["email"] };
const checkboxOptionsArray = [...checkboxOptions] as {
  id: string;
  label: string;
  disabled?: boolean;
}[];
const errorsNotifications = { notifications: "Select at least one channel" };

const meta = {
  title: "Forms/FormCheckboxGroup",
  component: FormCheckboxGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormCheckboxGroup>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormCheckboxGroup
          control={control}
          name="notifications"
          label="Notification channels"
          labelDescription="Choose how we should reach you"
          checkBoxOptions={checkboxOptionsArray}
        />
      )}
    </FormStoryShell>
  ),
};

export const WithSelections: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithSelections}>
      {(control) => (
        <FormCheckboxGroup
          control={control}
          name="notifications"
          label="Notification channels"
          checkBoxOptions={checkboxOptionsArray}
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultEmpty}
      errors={errorsNotifications}
    >
      {(control) => (
        <FormCheckboxGroup
          control={control}
          name="notifications"
          label="Notification channels"
          checkBoxOptions={checkboxOptionsArray}
          isRequired
          showErrorMessage
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithEmail}>
      {(control) => (
        <FormCheckboxGroup
          control={control}
          name="notifications"
          label="Notification channels"
          checkBoxOptions={checkboxOptionsArray}
          isDisabled
        />
      )}
    </FormStoryShell>
  ),
};
