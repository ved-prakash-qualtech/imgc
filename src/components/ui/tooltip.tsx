"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/twMergeUtils";

/**
 * miFIN™ Tooltip — dark (default) or light surface, positioned on any of the
 * 4 sides via `side`. `TooltipProvider` should wrap a group of tooltips that
 * share hover-delay timing (e.g. a toolbar) — a single ad-hoc tooltip can
 * skip it, Base UI falls back to its own default provider context.
 */

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const tooltipContentVariants = cva(
  "z-50 rounded-md px-2.5 py-1.5 text-xs font-medium",
  {
    variants: {
      variant: {
        dark: "bg-neutral-950 text-white",
        light: "border border-neutral-200 bg-white text-neutral-900 shadow-md",
      },
    },
    defaultVariants: {
      variant: "dark",
    },
  }
);

const tooltipArrowVariants = cva(
  "z-50 size-2.5 rotate-45 data-[side=bottom]:-top-[3px] data-[side=left]:-right-[3px] data-[side=right]:-left-[3px] data-[side=top]:-bottom-[3px]",
  {
    variants: {
      variant: {
        dark: "bg-neutral-950",
        light: "border border-neutral-200 bg-white",
      },
    },
    defaultVariants: {
      variant: "dark",
    },
  }
);

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  VariantProps<typeof tooltipContentVariants> &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "side" | "sideOffset" | "align" | "alignOffset"
  >;

function TooltipContent({
  className,
  variant = "dark",
  children,
  side = "top",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  ...props
}: Readonly<TooltipContentProps>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(tooltipContentVariants({ variant }), className)}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className={cn(tooltipArrowVariants({ variant }))}
          />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
