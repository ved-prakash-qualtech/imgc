import type { ReactNode } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

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
}: Readonly<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Anchor target, e.g. for an in-page section nav. */
  id?: string;
  className?: string;
}>) {
  return (
    <section
      id={id}
      className={cn("rounded-xl border border-neutral-100 bg-white shadow-sm", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[14.5px] font-semibold text-neutral-950">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[12.5px] text-neutral-500">{description}</p>
            )}
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
