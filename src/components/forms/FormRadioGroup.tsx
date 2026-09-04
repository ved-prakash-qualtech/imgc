"use client";

import * as React from "react";
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildFormFieldId } from "@/lib/utils/formFieldId";
import { isAllowedOptionValue } from "@/lib/utils/formInputSanitize";
import { cn } from "@/lib/utils/twMergeUtils";
import type { FormRadioGroupProps } from "@/types/forms";

type FormRadioGroupFieldProps<T extends FieldValues> = Readonly<
  Omit<FormRadioGroupProps<T>, "control"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
    error?: FieldError;
    fieldId: string;
  }
>;

function FormRadioGroupField<T extends FieldValues>({
  field,
  error,
  fieldId,
  label,
  radioGroupList,
  isErrorMessageVisible = false,
  isDisabled = false,
  isRequired = false,
  direction = "horizontal",
  helperText,
  className,
  ...props
}: FormRadioGroupFieldProps<T>) {
  const allowedValues = React.useMemo(
    () => radioGroupList.map((item) => item.value),
    [radioGroupList]
  );

  const handleValueChange = React.useCallback(
    (value: string) => {
      if (isAllowedOptionValue(value, allowedValues)) {
        field.onChange(value);
      }
    },
    [allowedValues, field]
  );

  return (
    <FormItem className={cn("space-y-3", className)}>
      {label ? (
        <FormLabel htmlFor={fieldId}>
          {label}{" "}
          {isRequired ? <span className="text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <FormControl>
        <RadioGroup
          value={field.value as string}
          onValueChange={handleValueChange}
          className={cn(
            direction === "horizontal"
              ? "flex space-x-2"
              : "flex flex-col space-y-2",
            isDisabled && "cursor-not-allowed opacity-50"
          )}
          disabled={isDisabled}
          {...props}
        >
          {radioGroupList.map((radioItem) => (
            <FormItem
              key={radioItem.value}
              className={cn(
                "flex items-center space-y-0 space-x-3",
                radioItem.disabled && "opacity-50"
              )}
            >
              <FormControl>
                <RadioGroupItem
                  value={radioItem.value}
                  disabled={radioItem.disabled}
                />
              </FormControl>
              <FormLabel className="font-normal">{radioItem.label}</FormLabel>
            </FormItem>
          ))}
        </RadioGroup>
      </FormControl>
      {helperText && !error ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
      {isErrorMessageVisible && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormRadioGroup<T extends FieldValues>({
  name,
  control,
  label,
  radioGroupList,
  isErrorMessageVisible = false,
  isDisabled = false,
  isRequired = false,
  direction = "horizontal",
  helperText,
  className,
  id,
  ...props
}: Readonly<FormRadioGroupProps<T>>) {
  const fieldId = buildFormFieldId(name, id);

  const renderField = React.useCallback(
    ({
      field,
      fieldState,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
      fieldState: ControllerFieldState;
    }) => (
      <FormRadioGroupField
        field={field}
        error={fieldState.error}
        fieldId={fieldId}
        name={name}
        label={label}
        radioGroupList={radioGroupList}
        isErrorMessageVisible={isErrorMessageVisible}
        isDisabled={isDisabled}
        isRequired={isRequired}
        direction={direction}
        helperText={helperText}
        className={className}
        id={id}
        {...props}
      />
    ),
    [
      fieldId,
      name,
      label,
      radioGroupList,
      isErrorMessageVisible,
      isDisabled,
      isRequired,
      direction,
      helperText,
      className,
      id,
      props,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
