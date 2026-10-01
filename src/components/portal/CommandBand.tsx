import type { ReactNode } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

/**
 * The navy summary band every portal page opens with.
 *
 * One shape, used on every screen, so a page always answers "what am I looking at, and what are
 * the numbers" before it shows a table. The cards inside are translucent rather than solid so the
 * band reads as one surface and not as a row of tiles that happen to sit on a blue rectangle.
 */
export function CommandBand({
  title,
  subtitle,
  stats,
  action,
  titleAside,
  children,
}: Readonly<{
  title: string;
  /** Sits beside the title on the left, e.g. the dashboard's amount totals. */
  titleAside?: ReactNode;
  subtitle?: ReactNode;
  stats: readonly BandStatProps[];
  action?: ReactNode;
  /** Overrides the default translucent stat grid with custom content — used where a band's KPIs
   *  need their own per-card styling rather than the shared translucent tile. */
  children?: ReactNode;
}>) {
  return (
    <section
      className="rounded-2xl bg-[image:var(--grad-hero,var(--grad-band))] p-3 shadow-lg shadow-band-shadow/25"
      style={{ backgroundImage: "var(--grad-hero, var(--grad-band))" }}
    >
      {(title || subtitle || action) && (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-3",
            (stats.length > 0 || children) && "mb-3"
          )}
        >
          <div className="min-w-0">
            {title && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <h2 className="font-outfit text-ui-heading font-bold text-white">
                  {title}
                </h2>
                {titleAside}
              </div>
            )}
            {subtitle && (
              <p className="text-ui-body-lg text-white/55">{subtitle}</p>
            )}
          </div>
          {action && (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          )}
        </header>
      )}

      {children ??
        (stats.length > 0 && (
          <div
            className={cn(
              "grid gap-3",
              stats.length >= 4
                ? "sm:grid-cols-2 xl:grid-cols-4"
                : stats.length === 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2"
            )}
          >
            {stats.map((stat) => (
              <BandStat key={stat.label} {...stat} />
            ))}
          </div>
        ))}
    </section>
  );
}

export type BandStatProps = Readonly<{
  icon?: ReactNode;
  label: string;
  value: string;
  caption: string;
  accent?: "teal" | "amber" | "rose";
}>;

export function BandStat({
  icon,
  label,
  value,
  caption,
  accent,
}: BandStatProps) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/8 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-ui-body font-medium text-white/70">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              accent === "teal"
                ? "bg-brand-on-dark/20 text-brand-on-dark"
                : accent === "amber"
                  ? "bg-warning/20 text-warning"
                  : accent === "rose"
                    ? "bg-destructive/20 text-danger-on-dark-soft"
                    : "bg-white/12 text-white/80"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="font-outfit text-ui-display-xl font-bold leading-none text-white">
        {value}
      </p>
      <p className="mt-1.5 truncate text-ui-body-sm text-white/50">{caption}</p>
    </div>
  );
}

/** A titled block of content between bands. */
export function Section({
  title,
  subtitle,
  action,
  children,
}: Readonly<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-ui-title font-semibold text-neutral-950">
            {title}
          </h2>
          {subtitle && (
            <p className="text-ui-body-lg text-neutral-500">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
