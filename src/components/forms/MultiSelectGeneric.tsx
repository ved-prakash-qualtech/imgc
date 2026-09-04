"use client";

import { cva } from "class-variance-authority";
import { Check, ChevronDown, Search, XCircle } from "lucide-react";
import * as React from "react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/twMergeUtils";
import type { MultiSelectGenericProps, SelectOption } from "@/types/forms";

const multiSelectVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 text-foreground bg-card hover:bg-card/80",
        secondary:
          "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        inverted: "inverted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type MultiSelectBadgeProps = Readonly<{
  option: SelectOption;
  variant: MultiSelectGenericProps["variant"];
  onRemove: (optionValue: string | number) => void;
}>;

function MultiSelectBadge({
  option,
  variant,
  onRemove,
}: MultiSelectBadgeProps) {
  const handleRemoveClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove(option.value);
    },
    [onRemove, option.value]
  );

  return (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-full shrink-0 truncate",
        multiSelectVariants({ variant })
      )}
    >
      <span className="truncate">{option.label}</span>
      <button
        type="button"
        className="ml-1 rounded-full p-0.5 hover:bg-accent/50 focus:outline-none"
        onClick={handleRemoveClick}
      >
        <XCircle className="h-3.5 w-3.5" />
      </button>
    </Badge>
  );
}

export function MultiSelectGeneric({
  value = [],
  onChange,
  options = [],
  placeholder = "Select...",
  variant = "default",
  filterFn,
  disabled = false,
}: Readonly<MultiSelectGenericProps>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = React.useState(0);
  const stringValue = value.map(String);
  const selectedOptions = options.filter((opt) =>
    stringValue.includes(String(opt.value))
  );
  const filteredOptions = filterFn
    ? options.filter((opt) => filterFn(opt, search))
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      );

  useEffect(() => {
    if (containerRef.current && selectedOptions.length > 0) {
      const container = containerRef.current;
      const innerChildren = container.children[0]?.children;
      let hidden = 0;

      if (innerChildren) {
        for (let i = 0; i < innerChildren.length; i++) {
          const child = innerChildren.item(i) as HTMLElement | null;
          if (!child) {
            continue;
          }
          if (child.offsetTop > container.offsetHeight) {
            hidden++;
          }
        }
      }

      setHiddenCount(hidden); // eslint-disable-line react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
    } else {
      setHiddenCount(0); // eslint-disable-line react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
    }
  }, [selectedOptions, value]);

  const toggleOption = React.useCallback(
    (optionId: string | number) => {
      const id = String(optionId);
      const newValue = stringValue.includes(id)
        ? value.filter((v) => String(v) !== id)
        : [...value, optionId];
      onChange(newValue);
    },
    [onChange, stringValue, value]
  );

  const handleClear = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      event?.preventDefault();
      onChange([]);
    },
    [onChange]
  );

  const toggleAll = React.useCallback(() => {
    if (stringValue.length === filteredOptions.length) {
      onChange([]);
    } else {
      onChange(filteredOptions.map((opt) => opt.value));
    }
  }, [filteredOptions, onChange, stringValue.length]);

  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (disabled) {
        return;
      }
      if (!isOpen) {
        setSearch("");
      }
      setOpen(isOpen);
    },
    [disabled]
  );

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  const handleSearchClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleOptionSelect = React.useCallback(
    (selectedValue: string) => {
      toggleOption(selectedValue);
    },
    [toggleOption]
  );

  const handleClearSelect = React.useCallback(() => {
    handleClear();
  }, [handleClear]);

  const handleCloseSelect = React.useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const handleTriggerClearClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      handleClear(event);
    },
    [handleClear]
  );

  const triggerButton = React.useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "relative min-h-10 w-full justify-center",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
      />
    ),
    [disabled, open]
  );

  const allSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => stringValue.includes(String(opt.value)));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={triggerButton}>
        <div className="flex w-full items-center justify-between">
          <div
            ref={containerRef}
            className="flex max-h-10 flex-1 flex-wrap items-center gap-1 overflow-hidden pr-2"
          >
            {selectedOptions.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                {placeholder}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {selectedOptions.map((opt) => (
                  <MultiSelectBadge
                    key={String(opt.value)}
                    option={opt}
                    variant={variant}
                    onRemove={toggleOption}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {hiddenCount > 0 ? (
              <Badge variant="outline" className="whitespace-nowrap">
                +{hiddenCount} more
              </Badge>
            ) : null}
            {selectedOptions.length > 0 ? (
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-accent"
                onClick={handleTriggerClearClick}
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
            <Separator orientation="vertical" className="h-4" />
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[300px] w-[350px] flex-col p-0"
        align="start"
      >
        <Command className="flex h-full flex-col rounded-lg border shadow-md">
          <div className="relative border-b p-2">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="h-8 border-0 pl-8"
              value={search}
              maxLength={200}
              autoComplete="off"
              onChange={handleSearchChange}
              onClick={handleSearchClick}
            />
          </div>
          <CommandList className="flex-1 overflow-y-auto">
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup className="p-1">
              <CommandItem
                onSelect={toggleAll}
                className="m-1 cursor-pointer rounded p-2 hover:bg-accent"
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    allSelected
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className="h-4 w-4" />
                </div>
                <span>(Select All)</span>
              </CommandItem>
              {filteredOptions.map((opt) => (
                <CommandItem
                  key={String(opt.value)}
                  value={String(opt.value)}
                  onSelect={handleOptionSelect}
                  className="m-1 cursor-pointer rounded p-2 hover:bg-accent"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      stringValue.includes(String(opt.value))
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="mt-auto border-t">
            <CommandGroup className="p-0">
              <div className="flex">
                <CommandItem
                  onSelect={handleClearSelect}
                  className={cn(
                    "flex-1 cursor-pointer justify-center",
                    value.length === 0 && "cursor-not-allowed opacity-50"
                  )}
                  disabled={value.length === 0}
                >
                  Clear
                </CommandItem>
                <Separator
                  orientation="vertical"
                  className="flex min-h-6 h-full"
                />
                <CommandItem
                  onSelect={handleCloseSelect}
                  className="flex-1 cursor-pointer justify-center"
                >
                  Close
                </CommandItem>
              </div>
            </CommandGroup>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
