"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/twMergeUtils";

/**
 * miFIN™ Tabs — six styles for different contexts:
 *  - pill: solid blue fill (active) / white with border (inactive). Top-level navigation.
 *  - underline: 1.5px blue bottom border + blue text (active). Contextual, within cards.
 *  - count: bold blue (active) / dark regular (inactive), count inline. Data filtering.
 *  - card: grey pill container, white active card + blue text. View-switching toggles.
 *  - filter: brand-muted pill container, white active pill + blue text. Table filter chips.
 * Pass the same `variant` to `TabsList` and every `TabsTrigger` inside it.
 */

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva("flex items-center", {
  variants: {
    variant: {
      pill: "gap-1 rounded-full border border-neutral-100 bg-white p-1",
      underline:
        "w-full h-[40px] gap-[16px] border-b-[1.5px] border-neutral-100",
      count: "gap-6",
      card: "gap-1 rounded-full bg-neutral-100 p-1",
      filter: "gap-1 rounded-full bg-brand-muted p-1",
    },
  },
  defaultVariants: {
    variant: "pill",
  },
});

type TabsListProps = TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants>;

function TabsList({
  className,
  variant = "pill",
  ...props
}: Readonly<TabsListProps>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  "cursor-pointer group/tabs-trigger inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap outline-none transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        pill: "rounded-full px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 data-active:bg-brand-primary data-active:text-white data-active:hover:bg-brand-primary",
        underline:
          "h-[40px] w-[133px] gap-[10px] px-2 py-[10px] border-b-[2px] border-transparent rounded-t-[8px] text-sm text-[#1F1F1F] hover:text-neutral-700 data-active:border-[var(--brand-blue)] data-active:text-brand-primary data-active:bg-[#E2F1FF]",
        count:
          "text-sm font-normal text-neutral-700 data-active:font-bold data-active:text-brand-primary",
        card: "rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 data-active:bg-white data-active:text-brand-primary data-active:shadow-sm data-active:hover:text-brand-primary",
        filter:
          "h-6 gap-[7px] rounded-[8px] px-2 py-[6px] text-xs text-neutral-700 hover:text-neutral-900 data-active:bg-white data-active:font-semibold data-active:text-brand-primary data-active:shadow-sm data-active:hover:text-brand-primary",
      },
    },
    defaultVariants: {
      variant: "pill",
    },
  }
);

const tabsCountBadgeVariants = cva(
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        pill: "bg-neutral-100 text-neutral-700 group-data-active/tabs-trigger:bg-white/25 group-data-active/tabs-trigger:text-white",
        underline: "bg-neutral-100 text-neutral-700",
        count: "hidden",
        card: "hidden",
        filter: "hidden",
      },
    },
    defaultVariants: {
      variant: "pill",
    },
  }
);

type TabsTriggerProps = TabsPrimitive.Tab.Props &
  VariantProps<typeof tabsTriggerVariants> & {
    /** Optional count — rendered as a badge (pill/underline) or inline "(N)" (count variant). */
    count?: number | string;
  };

function TabsTrigger({
  className,
  variant = "pill",
  count,
  children,
  ...props
}: Readonly<TabsTriggerProps>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    >
      {children}
      {count !== undefined && variant === "count" && <span>({count})</span>}
      {count !== undefined && variant !== "count" && (
        <span className={cn(tabsCountBadgeVariants({ variant }))}>{count}</span>
      )}
    </TabsPrimitive.Tab>
  );
}

type TabsContentProps = TabsPrimitive.Panel.Props;

function TabsContent({ className, ...props }: Readonly<TabsContentProps>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
