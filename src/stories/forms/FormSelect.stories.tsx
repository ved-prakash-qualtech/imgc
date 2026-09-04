import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormSelect } from "@/components/forms/FormSelect";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

const loanTypeOptions = [
  { label: "Term loan", value: "term" },
  { label: "Revolving credit", value: "revolving" },
  { label: "Line of credit", value: "line" },
  { label: "Unavailable type", value: "unavailable", disabled: true },
];

type DemoFormValues = {
  loanType: string;
};

const defaultEmpty: DemoFormValues = { loanType: "" };
const defaultTerm: DemoFormValues = { loanType: "term" };
const defaultRevolving: DemoFormValues = { loanType: "revolving" };
const errorsLoanType = { loanType: "Loan type is required" };

const meta = {
  title: "Forms/FormSelect",
  component: FormSelect,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormSelect>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormSelect
          control={control}
          name="loanType"
          label="Loan type"
          placeholder="Select a loan type"
          options={loanTypeOptions}
          helperText="Search and pick the product that fits this application."
          fullWidth
        />
      )}
    </FormStoryShell>
  ),
};

export const WithValue: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultTerm}>
      {(control) => (
        <FormSelect
          control={control}
          name="loanType"
          label="Loan type"
          options={loanTypeOptions}
          isRequired
          fullWidth
        />
      )}
    </FormStoryShell>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues>
      defaultValues={defaultEmpty}
      errors={errorsLoanType}
    >
      {(control) => (
        <FormSelect
          control={control}
          name="loanType"
          label="Loan type"
          placeholder="Select a loan type"
          options={loanTypeOptions}
          isRequired
          showErrorMessage
          fullWidth
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultRevolving}>
      {(control) => (
        <FormSelect
          control={control}
          name="loanType"
          label="Loan type"
          options={loanTypeOptions}
          isDisabled
          fullWidth
        />
      )}
    </FormStoryShell>
  ),
};
