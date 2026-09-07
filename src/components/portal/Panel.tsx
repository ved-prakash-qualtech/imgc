import type { ReactNode } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

const HEADER_SIZE = {
  /** The roomier, single-section-per-page header — most of the portal. */
  default: {
    header: "px-5 py-3.5",
    title: "text-[14.5px] font-semibold text-neutral-950",
    description: "mt-0.5 text-[12.5px] text-neutral-500",
  },
  /** Tighter padding/type for a card that shares a row with several others (a KPI grid), where
   *  `default`'s spacing reads as oversized. Same card shape otherwise — still a `Panel`. */
  compact: {
    header: "px-3 py-2",
    title: "text-[13px] font-semibold text-neutral-950",
    description: "mt-0.5 text-[11px] text-neutral-500",
  },
} as const;

/**
 * The white surface portal content sits on: an optional titled header with a muted subtitle and
 * a slot for actions, then the content flush to the card's edges so tables and lists can run
 * full width and divide themselves.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  id,
  className,
  size = "default",
}: Readonly<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Anchor target, e.g. for an in-page section nav. */
  id?: string;
  className?: string;
  /** @default "default" */
  size?: keyof typeof HEADER_SIZE;
}>) {
  const s = HEADER_SIZE[size];
  return (
    <section
      id={id}
      className={cn("rounded-xl border border-neutral-100 bg-white shadow-sm", className)}
    >
      {(title || actions) && (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100",
            s.header
          )}
        >
          <div className="min-w-0">
            {title && <h2 className={s.title}>{title}</h2>}
            {description && <p className={s.description}>{description}</p>}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
