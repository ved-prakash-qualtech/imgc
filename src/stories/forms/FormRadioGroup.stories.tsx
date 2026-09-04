import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormRadioGroup } from "@/components/forms/FormRadioGroup";
import { FormStoryShell } from "@/lib/storybook/FormStoryShell";

const frequencyOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Annually", value: "annually" },
  { label: "Custom", value: "custom", disabled: true },
];

type DemoFormValues = {
  frequency: string;
};

const defaultMonthly: DemoFormValues = { frequency: "monthly" };
const defaultEmpty: DemoFormValues = { frequency: "" };
const defaultQuarterly: DemoFormValues = { frequency: "quarterly" };
const errorsFrequency = { frequency: "Select a repayment frequency" };

const meta = {
  title: "Forms/FormRadioGroup",
  component: FormRadioGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormRadioGroup>;

export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultMonthly}>
      {(control) => (
        <FormRadioGroup
          control={control}
          name="frequency"
          label="Repayment frequency"
          radioGroupList={frequencyOptions}
          direction="horizontal"
          helperText="How often payments are scheduled."
        />
      )}
    </FormStoryShell>
  ),
};

export const Vertical: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultEmpty}>
      {(control) => (
        <FormRadioGroup
          control={control}
          name="frequency"
          label="Repayment frequency"
          radioGroupList={frequencyOptions}
          direction="vertical"
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
      errors={errorsFrequency}
    >
      {(control) => (
        <FormRadioGroup
          control={control}
          name="frequency"
          label="Repayment frequency"
          radioGroupList={frequencyOptions}
          isRequired
          isErrorMessageVisible
        />
      )}
    </FormStoryShell>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormStoryShell<DemoFormValues> defaultValues={defaultQuarterly}>
      {(control) => (
        <FormRadioGroup
          control={control}
          name="frequency"
          label="Repayment frequency"
          radioGroupList={frequencyOptions}
          isDisabled
        />
      )}
    </FormStoryShell>
  ),
};
