"use client";

import * as React from "react";
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils/twMergeUtils";
import type { CheckboxOption, FormCheckboxGroupProps } from "@/types/forms";

type FormCheckboxOptionFieldProps<T extends FieldValues> = Readonly<{
  item: CheckboxOption;
  optionField: ControllerRenderProps<T, FieldPath<T>>;
  isDisabled?: boolean;
  checkboxClassName?: string;
}>;

function FormCheckboxOptionField<T extends FieldValues>({
  item,
  optionField,
  isDisabled,
  checkboxClassName,
}: FormCheckboxOptionFieldProps<T>) {
  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      const current = Array.isArray(optionField.value) ? optionField.value : [];
      const next = checked
        ? [...current, item.id]
        : current.filter((val: string) => val !== item.id);
      optionField.onChange(next);
    },
    [item.id, optionField]
  );

  return (
    <FormItem
      className={cn(
        "flex flex-row items-center space-y-0 space-x-3",
        checkboxClassName
      )}
    >
      <FormControl>
        <Checkbox
          disabled={isDisabled || item.disabled}
          checked={
            Array.isArray(optionField.value) &&
            optionField.value.includes(item.id)
          }
          onCheckedChange={handleCheckedChange}
        />
      </FormControl>
      <FormLabel className="text-sm font-normal">{item.label}</FormLabel>
    </FormItem>
  );
}

type FormCheckboxOptionRowProps<T extends FieldValues> = Readonly<{
  name: FormCheckboxGroupProps<T>["name"];
  control: FormCheckboxGroupProps<T>["control"];
  item: CheckboxOption;
  isDisabled?: boolean;
  checkboxClassName?: string;
}>;

function FormCheckboxOptionRow<T extends FieldValues>({
  name,
  control,
  item,
  isDisabled,
  checkboxClassName,
}: FormCheckboxOptionRowProps<T>) {
  const renderOptionField = React.useCallback(
    ({
      field: optionField,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
    }) => (
      <FormCheckboxOptionField
        item={item}
        optionField={optionField}
        isDisabled={isDisabled}
        checkboxClassName={checkboxClassName}
      />
    ),
    [item, isDisabled, checkboxClassName]
  );

  return <FormField control={control} name={name} render={renderOptionField} />;
}

type FormCheckboxGroupFieldProps<T extends FieldValues> = Readonly<
  Omit<FormCheckboxGroupProps<T>, "error"> & {
    error?: FieldError;
  }
>;

function FormCheckboxGroupField<T extends FieldValues>({
  name,
  control,
  checkBoxOptions,
  error,
  label,
  labelDescription,
  isDisabled,
  showErrorMessage = true,
  isRequired,
  helperText,
  labelClassName,
  checkboxClassName,
}: FormCheckboxGroupFieldProps<T>) {
  return (
    <FormItem>
      <div className="mb-4">
        {label ? (
          <FormLabel className={cn("text-sm", labelClassName)}>
            {label}{" "}
            {isRequired ? <span className="text-destructive">*</span> : null}
          </FormLabel>
        ) : null}
        {labelDescription ? (
          <FormDescription>{labelDescription}</FormDescription>
        ) : null}
        {helperText && !error ? (
          <FormDescription>{helperText}</FormDescription>
        ) : null}
      </div>
      <div className="flex space-x-5">
        {checkBoxOptions.map((item) => (
          <FormCheckboxOptionRow
            key={item.id}
            name={name}
            control={control}
            item={item}
            isDisabled={isDisabled}
            checkboxClassName={checkboxClassName}
          />
        ))}
      </div>
      {showErrorMessage && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormCheckboxGroup<T extends FieldValues>({
  name,
  control,
  checkBoxOptions,
  label,
  labelDescription,
  isDisabled,
  showErrorMessage = true,
  isRequired,
  helperText,
  labelClassName,
  checkboxClassName,
}: Readonly<FormCheckboxGroupProps<T>>) {
  const renderField = React.useCallback(
    ({ fieldState }: { fieldState: ControllerFieldState }) => (
      <FormCheckboxGroupField
        name={name}
        control={control}
        checkBoxOptions={checkBoxOptions}
        error={fieldState.error}
        label={label}
        labelDescription={labelDescription}
        isDisabled={isDisabled}
        showErrorMessage={showErrorMessage}
        isRequired={isRequired}
        helperText={helperText}
        labelClassName={labelClassName}
        checkboxClassName={checkboxClassName}
      />
    ),
    [
      name,
      control,
      checkBoxOptions,
      label,
      labelDescription,
      isDisabled,
      showErrorMessage,
      isRequired,
      helperText,
      labelClassName,
      checkboxClassName,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
