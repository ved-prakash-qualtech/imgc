import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";

import { MultiSelectGeneric } from "@/components/forms/MultiSelectGeneric";

const tagOptions = [
  { label: "Personal", value: "personal" },
  { label: "Business", value: "business" },
  { label: "Mortgage", value: "mortgage" },
  { label: "Auto", value: "auto" },
  { label: "Education", value: "education" },
];

type MultiSelectStoryProps = Readonly<{
  initialValue?: (string | number)[];
  variant?: ComponentProps<typeof MultiSelectGeneric>["variant"];
  disabled?: boolean;
  placeholder?: string;
}>;

function MultiSelectStory({
  initialValue = [],
  variant = "default",
  disabled = false,
  placeholder = "Select tags",
}: MultiSelectStoryProps) {
  const [value, setValue] = useState<(string | number)[]>(initialValue);

  return (
    <div className="max-w-md p-4">
      <MultiSelectGeneric
        value={value}
        onChange={setValue}
        options={tagOptions}
        placeholder={placeholder}
        variant={variant}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: "Forms/MultiSelectGeneric",
  component: MultiSelectGeneric,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MultiSelectGeneric>;

export default meta;
type Story = StoryObj;

const TWO_SELECTED = ["personal", "business"];
const THREE_SELECTED = ["mortgage", "auto", "education"];
const ONE_SELECTED = ["personal"];

export const Default: Story = {
  render: () => <MultiSelectStory />,
};

export const WithSelections: Story = {
  render: () => <MultiSelectStory initialValue={TWO_SELECTED} />,
};

export const SecondaryVariant: Story = {
  render: () => (
    <MultiSelectStory initialValue={THREE_SELECTED} variant="secondary" />
  ),
};

export const Disabled: Story = {
  render: () => (
    <MultiSelectStory
      initialValue={ONE_SELECTED}
      disabled
      placeholder="Selection locked"
    />
  ),
};
