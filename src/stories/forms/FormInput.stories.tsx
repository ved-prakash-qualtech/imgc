import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormInput } from "@/components/forms/FormInput";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

type DemoFormValues = {
  text: string;
  email: string;
  password: string;
  amount: string;
};

const defaultEmpty: DemoFormValues = {
  text: "",
  email: "",
  password: "",
  amount: "",
};
const defaultWithText: DemoFormValues = {
  text: "Home renovation loan",
  email: "",
  password: "",
  amount: "",
};
const defaultWithPassword: DemoFormValues = {
  text: "",
  email: "",
  password: "secret",
  amount: "",
};
const defaultWithAmount: DemoFormValues = {
  text: "",
  email: "",
  password: "",
  amount: "12500.5",
};
const defaultReadOnly: DemoFormValues = {
  text: "Read-only value",
  email: "",
  password: "",
  amount: "",
};
const errorsText = { text: "Title is required" };

const meta = {
  title: "Forms/FormInput",
  component: FormInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormInput>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormInput
          control={control}
          name="text"
          label="Title"
          placeholder="Enter title"
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const WithValue: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithText}>
      {(control) => (
        <FormInput
          control={control}
          name="text"
          label="Title"
          placeholder="Enter title"
        />
      )}
    </FormStoryShell>
  ),
};

export const Password: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithPassword}>
      {(control) => (
        <FormInput
          control={control}
          name="password"
          type="password"
          label="Password"
          placeholder="Enter password"
          isEyeIconRequired
          isRequired
        />
      )}
    </FormStoryShell>
  ),
};

export const FormattedNumber: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultWithAmount}>
      {(control) => (
        <FormInput
          control={control}
          name="amount"
          type="text"
          label="Amount"
          placeholder="0.00"
          formatAsCommaSeparated
          regexType="number"
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultEmpty}
      errors={errorsText}
    >
      {(control) => (
        <FormInput
          control={control}
          name="text"
          label="Title"
          placeholder="Enter title"
          isRequired
          showErrorMessage
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultReadOnly}>
      {(control) => (
        <FormInput control={control} name="text" label="Title" isDisabled />
      )}
    </FormStoryShell>
  ),
};
