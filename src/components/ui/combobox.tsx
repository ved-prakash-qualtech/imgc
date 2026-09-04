"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils/twMergeUtils";

/**
 * miFIN™ Searchable Select — a filterable Select (Combobox), same geometry as
 * <Select>: L 44 / M 40 (default) / S 36, radius 6/8/4px, matches Input sizes.
 */

const Combobox = ComboboxPrimitive.Root;

type ComboboxInputGroupProps = ComboboxPrimitive.InputGroup.Props & {
  size?: "lg" | "default" | "sm";
};

function getComboboxIconSize(
  size: NonNullable<ComboboxInputGroupProps["size"]>
) {
  switch (size) {
    case "lg":
      return "size-3.5";
    case "sm":
      return "size-3";
    default:
      return "size-[13px]";
  }
}

function ComboboxInputGroup({
  className,
  size = "default",
  children,
  ...props
}: Readonly<ComboboxInputGroupProps>) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      data-size={size}
      className={cn(
        "flex w-full items-center gap-1.5 border border-input bg-white pr-2 pl-3 text-sm text-neutral-950 transition-colors outline-none focus-within:border-brand-primary focus-within:ring-3 focus-within:ring-brand-primary/12 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 data-[size=lg]:h-11 data-[size=lg]:rounded-md data-[size=default]:h-10 data-[size=default]:rounded-lg data-[size=sm]:h-9 data-[size=sm]:rounded-sm",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.Icon
        render={
          <ChevronDownIcon
            className={cn(
              "pointer-events-none shrink-0 text-muted-foreground",
              getComboboxIconSize(size)
            )}
          />
        }
      />
    </ComboboxPrimitive.InputGroup>
  );
}

type ComboboxInputProps = ComboboxPrimitive.Input.Props;

function ComboboxInput({ className, ...props }: Readonly<ComboboxInputProps>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "w-full min-w-0 bg-transparent py-2 text-sm text-neutral-950 outline-none placeholder:text-neutral-400",
        className
      )}
      {...props}
    />
  );
}

type ComboboxPopupProps = ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >;

function ComboboxPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}: Readonly<ComboboxPopupProps>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-popup"
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

type ComboboxEmptyProps = ComboboxPrimitive.Empty.Props;

function ComboboxEmpty({ className, ...props }: Readonly<ComboboxEmptyProps>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-3 py-2 text-sm text-neutral-500", className)}
      {...props}
    />
  );
}

type ComboboxListProps = ComboboxPrimitive.List.Props;

function ComboboxList({ className, ...props }: Readonly<ComboboxListProps>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn("p-1", className)}
      {...props}
    />
  );
}

type ComboboxItemProps = ComboboxPrimitive.Item.Props;

function ComboboxItem({
  className,
  children,
  ...props
}: Readonly<ComboboxItemProps>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

export {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxPopup,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
};
