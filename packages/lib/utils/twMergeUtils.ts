import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The dense UI type scale (`text-ui-body`, `text-ui-label`, …), declared in globals.css.
 *
 * tailwind-merge has to be told about it. Left to its own devices it sees `text-ui-body` and
 * classifies it as a text *colour*, so merging a cell's `text-neutral-950` over a component's
 * `text-ui-subhead` silently dropped the size and the text fell back to the inherited 14px.
 */
const UI_TEXT_SIZES = [
  "ui-pico",
  "ui-nano",
  "ui-micro",
  "ui-micro-lg",
  "ui-tiny",
  "ui-caption",
  "ui-label",
  "ui-body-sm",
  "ui-body",
  "ui-body-lg",
  "ui-subhead",
  "ui-subhead-lg",
  "ui-lead",
  "ui-lead-lg",
  "ui-title",
  "ui-title-lg",
  "ui-heading",
  "ui-heading-lg",
  "ui-heading-xl",
  "ui-display-sm",
  "ui-display",
  "ui-display-lg",
  "ui-display-xl",
  "ui-hero-sm",
  "ui-hero",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...UI_TEXT_SIZES] }],
    },
  },
});

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
