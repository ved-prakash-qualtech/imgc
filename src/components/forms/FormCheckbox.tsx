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
import type { FormCheckboxProps } from "@/types/forms";

type FormCheckboxFieldProps<T extends FieldValues> = Readonly<
  Omit<FormCheckboxProps<T>, "control" | "name" | "error"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
    error?: FieldError;
  }
>;

function FormCheckboxField<T extends FieldValues>({
  field,
  error,
  label,
  labelDescription,
  isDisabled = false,
  showErrorMessage = true,
  isRequired,
  helperText,
  labelClassName,
  checkboxClassName,
}: FormCheckboxFieldProps<T>) {
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
      <FormItem
        className={cn(
          "flex flex-row items-center space-y-0 space-x-3",
          checkboxClassName
        )}
      >
        <FormControl>
          <Checkbox
            disabled={isDisabled}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
          />
        </FormControl>
        {label ? (
          <FormLabel className="text-sm font-normal">{label}</FormLabel>
        ) : null}
      </FormItem>
      {showErrorMessage && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormCheckbox<T extends FieldValues>({
  name,
  control,
  label,
  labelDescription,
  isDisabled = false,
  showErrorMessage = true,
  isRequired,
  helperText,
  labelClassName,
  checkboxClassName,
}: Readonly<FormCheckboxProps<T>>) {
  const renderField = React.useCallback(
    ({
      field,
      fieldState,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
      fieldState: ControllerFieldState;
    }) => (
      <FormCheckboxField
        field={field}
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
