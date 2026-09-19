import type { ReactNode } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

/**
 * The action bar pinned to the bottom of a claim screen — Save & Submit on the lender's
 * workspace, Resubmit on Track Claim, the decision buttons on IMGC's Decision tab.
 *
 * One component so every screen's bar looks the same: a white card with its own edge and a
 * soft shadow above it (it stays pinned while the page scrolls under it, so it needs its own
 * ground or the content behind reads through), 4px of padding, actions on the right, and an
 * optional message on the left.
 */
export function ActionFooter({
  message,
  children,
  className,
}: Readonly<{
  /** Left-hand status line, e.g. "Every mandatory document is in". */
  message?: ReactNode;
  /** The buttons, right-aligned. */
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "sticky bottom-2 z-20 mt-1 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-1 shadow-[0_-2px_12px_rgba(15,23,42,0.08)]",
        className
      )}
    >
      <div className="min-w-0 flex-1 pl-2 text-[12px]">{message}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
