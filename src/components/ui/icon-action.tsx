"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One icon-only row action with its tooltip.
 *
 * <p>Every list screen renders the same shape — a ghost icon button in a `TooltipTrigger`'s
 * `render` prop, with the label in the tooltip — and each one was writing it out again. Four
 * copies of a control is four places to drift on size, spacing and where the label lives.
 *
 * <p>It sits under `components/ui/` because that is what it is: a composition of two kit
 * components, not a screen concern. Base UI's `render` prop takes an element, which is a piece
 * of JSX passed as a prop — the one shape `react-perf/jsx-no-jsx-as-prop` exists to catch, and
 * unavoidable with this API. Keeping it here confines it to the directory where the kit's own
 * render-prop patterns are already accounted for, instead of spreading it across every screen.
 *
 * <p>`onClick` should be a stable reference from the caller — see the row components, which wrap
 * theirs in `useCallback` so a table of them does not re-render on every keystroke in search.
 */
export function IconAction({
  label,
  onClick,
  disabled,
  children,
}: Readonly<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
