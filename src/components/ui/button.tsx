import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/twMergeUtils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // miFIN™ Primary — single action color (brand), darken on hover.
        default:
          "bg-primary text-primary-foreground [a]:hover:bg-brand-dark hover:bg-brand-dark",
        // miFIN™ Secondary — white surface, neutral border, grey hover.
        outline:
          "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 aria-expanded:bg-neutral-50",
        secondary:
          "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 aria-expanded:bg-neutral-50",
        // miFIN™ Ghost — transparent, brand text, brand-light hover.
        ghost:
          "text-brand-primary hover:bg-brand-light aria-expanded:bg-brand-light",
        // miFIN™ Danger — solid danger, white text, darken on hover.
        destructive:
          "bg-danger-600 text-white hover:bg-danger-700 focus-visible:border-danger-600 focus-visible:ring-danger-600/20",
        // miFIN™ Success — solid success, white text, darken on hover.
        success:
          "bg-success-500 text-white hover:bg-success-700 focus-visible:border-success-500 focus-visible:ring-success-500/20",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        // miFIN™ three tiers: Large 44 · Medium 40 (default) · Small 36, on the 4px grid.
        default:
          "h-10 gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1 rounded-md px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-10",
        "icon-xs":
          "size-8 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-md in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
