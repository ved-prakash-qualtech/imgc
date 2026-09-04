"use client";

import * as React from "react";
import { ChevronDownIcon, FilterIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/twMergeUtils";
import type { SelectOption } from "@/types/forms";

type FilterSelectProps = Readonly<{
  label?: string;
  options: SelectOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  className?: string;
}>;

type FilterSelectOptionProps = Readonly<{
  option: SelectOption;
  checked: boolean;
  onToggle: (optionValue: string | number, checked: boolean) => void;
}>;

function FilterSelectOption({
  option,
  checked,
  onToggle,
}: FilterSelectOptionProps) {
  const fieldId = `filter-select-${String(option.value)}`;

  const handleCheckedChange = React.useCallback(
    (next: boolean | "indeterminate") => onToggle(option.value, next === true),
    [onToggle, option.value]
  );

  return (
    <label
      htmlFor={fieldId}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-neutral-900 hover:bg-neutral-50"
    >
      <Checkbox
        id={fieldId}
        checked={checked}
        disabled={option.disabled}
        onCheckedChange={handleCheckedChange}
      />
      {option.label}
    </label>
  );
}

/**
 * miFIN™ Multi-Select Filter — funnel icon + label + active-count badge
 * trigger; checkbox list in the popup. Used for list-view data filtering.
 */
export function FilterSelect({
  label = "Filter",
  options,
  value,
  onChange,
  className,
}: FilterSelectProps) {
  const [open, setOpen] = React.useState(false);
  const stringValue = value.map(String);

  const toggleOption = React.useCallback(
    (optionValue: string | number, checked: boolean) => {
      const id = String(optionValue);
      onChange(
        checked
          ? [...value, optionValue]
          : value.filter((v) => String(v) !== id)
      );
    },
    [onChange, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-900 transition-colors outline-none hover:bg-neutral-50 focus-visible:border-brand-primary focus-visible:ring-3 focus-visible:ring-brand-primary/12",
          className
        )}
      >
        <FilterIcon className="size-4 text-neutral-500" />
        {label}
        {value.length > 0 && (
          <Badge variant="default" className="rounded-full">
            {value.length}
          </Badge>
        )}
        <ChevronDownIcon
          className={cn(
            "size-4 text-neutral-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-2">
        {options.map((option) => (
          <FilterSelectOption
            key={String(option.value)}
            option={option}
            checked={stringValue.includes(String(option.value))}
            onToggle={toggleOption}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
