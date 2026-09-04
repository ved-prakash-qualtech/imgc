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
import { Textarea } from "@/components/ui/textarea";
import { useFormInputRegex } from "@/hooks/useFormInputRegex";
import { buildFormFieldId } from "@/lib/utils/formFieldId";
import { cn } from "@/lib/utils/twMergeUtils";
import type { FormTextAreaProps } from "@/types/forms";

type FormTextAreaFieldProps<T extends FieldValues> = Readonly<
  Omit<FormTextAreaProps<T>, "control"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
    error?: FieldError;
    fieldId: string;
    shouldSanitizeOnChange: boolean;
    sanitizeValue: (value: string) => string;
  }
>;

function FormTextAreaField<T extends FieldValues>({
  field,
  error,
  fieldId,
  shouldSanitizeOnChange,
  sanitizeValue,
  label,
  placeholder,
  isRequired,
  showErrorMessage = false,
  isDisabled = false,
  className,
  maxLength,
  onCustomChange,
  ...props
}: FormTextAreaFieldProps<T>) {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (shouldSanitizeOnChange) {
        field.onChange(sanitizeValue(event.target.value));
      } else {
        field.onChange(event);
      }

      onCustomChange?.(event);
    },
    [field, onCustomChange, sanitizeValue, shouldSanitizeOnChange]
  );

  return (
    <FormItem>
      {label ? (
        <FormLabel htmlFor={fieldId}>
          {label}{" "}
          {isRequired ? <span className="text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <FormControl>
        <Textarea
          id={fieldId}
          className={cn(error && "border-destructive", className)}
          placeholder={placeholder}
          disabled={isDisabled}
          maxLength={maxLength}
          {...field}
          {...props}
          value={field.value ?? ""}
          onChange={handleChange}
        />
      </FormControl>
      {showErrorMessage && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormTextArea<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  isRequired,
  showErrorMessage = false,
  isDisabled = false,
  className,
  id,
  maxLength,
  regexType,
  onCustomChange,
  ...props
}: Readonly<FormTextAreaProps<T>>) {
  const fieldId = buildFormFieldId(name, id);
  const { shouldSanitizeOnChange, sanitizeValue } = useFormInputRegex({
    maxLength,
    regexType,
  });

  const renderField = React.useCallback(
    ({
      field,
      fieldState,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
      fieldState: ControllerFieldState;
    }) => (
      <FormTextAreaField
        field={field}
        error={fieldState.error}
        fieldId={fieldId}
        shouldSanitizeOnChange={shouldSanitizeOnChange}
        sanitizeValue={sanitizeValue}
        name={name}
        label={label}
        placeholder={placeholder}
        isRequired={isRequired}
        showErrorMessage={showErrorMessage}
        isDisabled={isDisabled}
        className={className}
        maxLength={maxLength}
        onCustomChange={onCustomChange}
        id={id}
        {...props}
      />
    ),
    [
      fieldId,
      shouldSanitizeOnChange,
      sanitizeValue,
      name,
      label,
      placeholder,
      isRequired,
      showErrorMessage,
      isDisabled,
      className,
      maxLength,
      onCustomChange,
      id,
      props,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
