"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildFormFieldId } from "@/lib/utils/formFieldId";
import { clampDate } from "@/lib/utils/formInputSanitize";
import { cn } from "@/lib/utils/twMergeUtils";
import type { FormDatePickerProps } from "@/types/forms";

type FormDatePickerFieldProps<T extends FieldValues> = Readonly<
  Omit<FormDatePickerProps<T>, "control"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
    error?: FieldError;
    fieldId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
>;

function FormDatePickerField<T extends FieldValues>({
  field,
  error,
  fieldId,
  open,
  onOpenChange,
  label,
  placeholder = "Pick a date",
  isRequired,
  showErrorMessage = true,
  isDisabled = false,
  minDate = new Date("1900-01-01"),
  maxDate = new Date(),
  className,
  description,
}: FormDatePickerFieldProps<T>) {
  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      field.onChange(date ? clampDate(date, minDate, maxDate) : undefined);
      onOpenChange(false);
    },
    [field, maxDate, minDate, onOpenChange]
  );

  const isDateDisabled = React.useCallback(
    (date: Date) => date > maxDate || date < minDate,
    [maxDate, minDate]
  );

  const triggerButton = React.useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-start pl-3 text-left font-normal",
          !field.value && "text-muted-foreground",
          error && "border-destructive",
          className
        )}
      />
    ),
    [className, error, field.value]
  );

  return (
    <FormItem className="flex flex-col" id={fieldId}>
      {label ? (
        <FormLabel htmlFor={fieldId}>
          {label}{" "}
          {isRequired ? <span className="text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <Popover open={open} onOpenChange={onOpenChange}>
        <FormControl>
          <PopoverTrigger
            className="w-full"
            disabled={isDisabled}
            render={triggerButton}
          >
            {field.value && !Number.isNaN(new Date(field.value).getTime()) ? (
              format(new Date(field.value), "dd-MMM-yyyy")
            ) : (
              <span>{placeholder}</span>
            )}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </PopoverTrigger>
        </FormControl>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={field.value}
            onSelect={handleSelect}
            disabled={isDateDisabled}
            captionLayout="dropdown"
            startMonth={minDate}
            endMonth={maxDate}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
      {description && !error?.message ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {showErrorMessage && error?.message ? (
        <FormMessage>{String(error.message)}</FormMessage>
      ) : null}
    </FormItem>
  );
}

export function FormDatePicker<T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Pick a date",
  isRequired,
  showErrorMessage = true,
  isDisabled = false,
  minDate = new Date("1900-01-01"),
  maxDate = new Date(),
  className,
  description,
  id,
}: Readonly<FormDatePickerProps<T>>) {
  const [open, setOpen] = React.useState(false);
  const fieldId = buildFormFieldId(name, id);

  const renderField = React.useCallback(
    ({
      field,
      fieldState,
    }: {
      field: ControllerRenderProps<T, FieldPath<T>>;
      fieldState: ControllerFieldState;
    }) => (
      <FormDatePickerField
        field={field}
        error={fieldState.error}
        fieldId={fieldId}
        open={open}
        onOpenChange={setOpen}
        name={name}
        label={label}
        placeholder={placeholder}
        isRequired={isRequired}
        showErrorMessage={showErrorMessage}
        isDisabled={isDisabled}
        minDate={minDate}
        maxDate={maxDate}
        className={className}
        description={description}
        id={id}
      />
    ),
    [
      fieldId,
      open,
      name,
      label,
      placeholder,
      isRequired,
      showErrorMessage,
      isDisabled,
      minDate,
      maxDate,
      className,
      description,
      id,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
