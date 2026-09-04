import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

type DemoFormValues = {
  termsAccepted: boolean;
};

const defaultUnchecked: DemoFormValues = { termsAccepted: false };
const defaultChecked: DemoFormValues = { termsAccepted: true };
const errorsTerms = { termsAccepted: "You must accept the terms to continue" };

const meta = {
  title: "Forms/FormCheckbox",
  component: FormCheckbox,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormCheckbox>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultUnchecked}>
      {(control) => (
        <FormCheckbox
          control={control}
          name="termsAccepted"
          label="I agree to the terms and conditions"
        />
      )}
    </FormStoryShell>
  ),
};

export const Checked: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultChecked}>
      {(control) => (
        <FormCheckbox
          control={control}
          name="termsAccepted"
          label="I agree to the terms and conditions"
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const WithHelperText: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultUnchecked}>
      {(control) => (
        <FormCheckbox
          control={control}
          name="termsAccepted"
          label="Marketing emails"
          labelDescription="Optional preferences"
          helperText="You can unsubscribe at any time."
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultUnchecked}
      errors={errorsTerms}
    >
      {(control) => (
        <FormCheckbox
          control={control}
          name="termsAccepted"
          label="I agree to the terms and conditions"
          isRequired
          showErrorMessage
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultChecked}>
      {(control) => (
        <FormCheckbox
          control={control}
          name="termsAccepted"
          label="I agree to the terms and conditions"
          isDisabled
        />
      )}
    </FormStoryShell>
  ),
};
