"use client";

import * as React from "react";
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { buildFormFieldId } from "@/lib/utils/formFieldId";
import { formatNumber } from "@/lib/utils/formatNumber";
import { useFormInputRegex } from "@/hooks/useFormInputRegex";
import { stripNumericGrouping } from "@/lib/utils/formInputSanitize";
import { cn } from "@/lib/utils/twMergeUtils";
import type { FormInputProps } from "@/types/forms";

type FormInputFieldProps<T extends FieldValues> = Readonly<
  Omit<FormInputProps<T>, "control"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
    error?: FieldError;
    fieldId: string;
    showPassword: boolean;
    onPasswordToggle: () => void;
    shouldSanitizeOnChange: boolean;
    sanitizeValue: (value: string) => string;
  }
>;

function FormInputField<T extends FieldValues>({
  field,
  error,
  fieldId,
  showPassword,
  onPasswordToggle,
  shouldSanitizeOnChange,
  sanitizeValue,
  type = "text",
  label,
  placeholder,
  isRequired,
  showErrorMessage = false,
  isEyeIconRequired = false,
  isDisabled = false,
  maxLength,
  onCustomChange,
  formatAsCommaSeparated = false,
  numberLocale = "en-US",
  ...props
}: FormInputFieldProps<T>) {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = formatAsCommaSeparated
        ? stripNumericGrouping(event.target.value)
        : event.target.value;

      if (shouldSanitizeOnChange) {
        field.onChange(sanitizeValue(rawValue));
      } else if (formatAsCommaSeparated) {
        field.onChange(rawValue);
      } else {
        field.onChange(event);
      }

      onCustomChange?.(event);
    },
    [
      field,
      formatAsCommaSeparated,
      onCustomChange,
      sanitizeValue,
      shouldSanitizeOnChange,
    ]
  );

  return (
    <FormItem>
      {label ? (
        <FormLabel className="mb-2 block" htmlFor={fieldId}>
          <span>{label}</span>
          {isRequired ? <span className="text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <FormControl>
        <div className="relative">
          <Input
            type={showPassword ? "text" : type}
            id={fieldId}
            className={cn(
              error && "border-destructive",
              isEyeIconRequired && "pr-10"
            )}
            placeholder={placeholder}
            disabled={isDisabled}
            {...field}
            {...props}
            onChange={handleChange}
            maxLength={maxLength}
            autoComplete={
              isEyeIconRequired
                ? (props.autoComplete ?? "current-password")
                : props.autoComplete
            }
            value={
              formatAsCommaSeparated
                ? formatNumber(field.value, numberLocale)
                : (field.value ?? "")
            }
          />
          {isEyeIconRequired ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0 h-full justify-center px-3 py-2 hover:bg-transparent disabled:cursor-not-allowed"
              onClick={onPasswordToggle}
              disabled={!field.value}
            >
              {showPassword ? (
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          ) : null}
        </div>
      </FormControl>
      {showErrorMessage && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormInput<T extends FieldValues>({
  name,
  control,
  type = "text",
  label,
  placeholder,
  isRequired,
  showErrorMessage = false,
  isEyeIconRequired = false,
  isDisabled = false,
  maxLength,
  regexType,
  onCustomChange,
  formatAsCommaSeparated = false,
  numberLocale = "en-US",
  id,
  ...props
}: Readonly<FormInputProps<T>>) {
  const [showPassword, setShowPassword] = React.useState(false);

  const { shouldSanitizeOnChange, sanitizeValue } = useFormInputRegex({
    maxLength,
    regexType,
  });

  const handlePasswordToggle = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const fieldId = buildFormFieldId(name, id);

  const renderField = React.useCallback(
    ({
      field,
      fieldState,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
      fieldState: ControllerFieldState;
    }) => (
      <FormInputField
        field={field}
        error={fieldState.error}
        fieldId={fieldId}
        showPassword={showPassword}
        onPasswordToggle={handlePasswordToggle}
        shouldSanitizeOnChange={shouldSanitizeOnChange}
        sanitizeValue={sanitizeValue}
        name={name}
        type={type}
        label={label}
        placeholder={placeholder}
        isRequired={isRequired}
        showErrorMessage={showErrorMessage}
        isEyeIconRequired={isEyeIconRequired}
        isDisabled={isDisabled}
        maxLength={maxLength}
        onCustomChange={onCustomChange}
        formatAsCommaSeparated={formatAsCommaSeparated}
        numberLocale={numberLocale}
        id={id}
        {...props}
      />
    ),
    [
      fieldId,
      showPassword,
      handlePasswordToggle,
      shouldSanitizeOnChange,
      sanitizeValue,
      name,
      type,
      label,
      placeholder,
      isRequired,
      showErrorMessage,
      isEyeIconRequired,
      isDisabled,
      maxLength,
      onCustomChange,
      formatAsCommaSeparated,
      numberLocale,
      id,
      props,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
