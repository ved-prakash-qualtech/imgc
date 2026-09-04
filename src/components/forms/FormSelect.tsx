"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildFormFieldId } from "@/lib/utils/formFieldId";
import { isAllowedOptionValue } from "@/lib/utils/formInputSanitize";
import { cn } from "@/lib/utils/twMergeUtils";
import type { FormSelectProps } from "@/types/forms";

type FormSelectFieldProps<T extends FieldValues> = Readonly<
  Omit<FormSelectProps<T>, "control"> & {
    field: ControllerRenderProps<T, FieldPath<T>>;
  }
>;

function FormSelectField<T extends FieldValues>({
  field,
  name,
  options,
  placeholder = "Select an option",
  showErrorMessage = true,
  isDisabled,
  label,
  isRequired,
  helperText,
  fullWidth,
  className,
  value,
  onChange,
  popverClassName,
  inputId,
}: FormSelectFieldProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const generatedId = buildFormFieldId(name, inputId);

  const filteredOptions = React.useMemo(() => {
    if (searchTerm.trim() === "") {
      return options;
    }

    const normalize = (str: string) =>
      str.toLowerCase().replace(/\s+/g, " ").trim();
    return options.filter((option) =>
      normalize(option.label).includes(normalize(searchTerm))
    );
  }, [searchTerm, options]);

  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchTerm("");
    }
  }, []);

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  const handleSearchClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleCommandSelect = React.useCallback(
    (selectedLabel: string) => {
      const option = filteredOptions.find(
        (item) => item.label === selectedLabel
      );
      if (!option || option.disabled) {
        return;
      }

      const currentValue = String(field.value ?? value ?? "");
      const newValue =
        currentValue === String(option.value) ? "" : String(option.value);

      if (
        !isAllowedOptionValue(
          newValue,
          options.map((item) => item.value)
        )
      ) {
        return;
      }

      field.onChange(newValue);
      onChange?.(newValue);
      setOpen(false);
      setSearchTerm("");
    },
    [field, filteredOptions, onChange, options, value]
  );

  const triggerButton = React.useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        role="combobox"
        className={cn(
          "flex h-10 w-full items-center justify-between px-3 py-2",
          !field.value && "text-muted-foreground"
        )}
      />
    ),
    [field.value]
  );

  return (
    <FormItem className={cn(fullWidth && "w-full", className)} data-name={name}>
      {label ? (
        <FormLabel htmlFor={generatedId}>
          <span>{label}</span>
          {isRequired ? <span className="text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <FormControl>
          <PopoverTrigger
            className="w-full"
            disabled={isDisabled}
            render={triggerButton}
          >
            <span className="min-w-0 flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap">
              {field.value
                ? options.find(
                    (option) => String(option.value) === String(field.value)
                  )?.label
                : placeholder}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </PopoverTrigger>
        </FormControl>
        <PopoverContent
          align="start"
          className={cn("w-(--anchor-width)] p-0", popverClassName)}
        >
          <Command className="w-full">
            <div className="relative border-b p-2">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                id={generatedId}
                placeholder="Search..."
                className="h-8 border-0 pl-8"
                value={searchTerm}
                maxLength={200}
                autoComplete="off"
                onChange={handleSearchChange}
                onClick={handleSearchClick}
              />
            </div>
            <CommandList>
              <CommandEmpty>No options found</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={option.label}
                    disabled={option.disabled}
                    onSelect={handleCommandSelect}
                  >
                    {option.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        String(option.value) === String(field.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {helperText ? <FormDescription>{helperText}</FormDescription> : null}
      {showErrorMessage ? <FormMessage /> : null}
    </FormItem>
  );
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  options,
  placeholder = "Select an option",
  showErrorMessage = true,
  isDisabled,
  label,
  isRequired,
  helperText,
  fullWidth,
  className,
  value,
  onChange,
  popverClassName,
  inputId,
}: Readonly<FormSelectProps<T>>) {
  const renderField = React.useCallback(
    ({ field }: { field: ControllerRenderProps<T, FieldPath<T>> }) => (
      <FormSelectField
        field={field}
        name={name}
        options={options}
        placeholder={placeholder}
        showErrorMessage={showErrorMessage}
        isDisabled={isDisabled}
        label={label}
        isRequired={isRequired}
        helperText={helperText}
        fullWidth={fullWidth}
        className={className}
        value={value}
        onChange={onChange}
        popverClassName={popverClassName}
        inputId={inputId}
      />
    ),
    [
      name,
      options,
      placeholder,
      showErrorMessage,
      isDisabled,
      label,
      isRequired,
      helperText,
      fullWidth,
      className,
      value,
      onChange,
      popverClassName,
      inputId,
    ]
  );

  return <FormField control={control} name={name} render={renderField} />;
}
