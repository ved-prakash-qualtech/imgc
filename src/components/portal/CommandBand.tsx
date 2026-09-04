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
}: Readonly<{
  title: string;
  subtitle: string;
  stats: readonly BandStatProps[];
  action?: ReactNode;
}>) {
  return (
    <section className="rounded-2xl bg-[linear-gradient(115deg,#0b2044_0%,#123a72_55%,#0d2a55_100%)] p-5 shadow-lg shadow-[#0b2044]/20">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-outfit text-[17px] font-bold text-white">{title}</h2>
          <p className="text-[12.5px] text-white/55">{subtitle}</p>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>

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

export function BandStat({ icon, label, value, caption, accent }: BandStatProps) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/8 px-4 py-3.5 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-[12px] font-medium text-white/70">{label}</p>
        {icon && (
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              accent === "teal"
                ? "bg-[#5ce0c6]/18 text-[#5ce0c6]"
                : accent === "amber"
                  ? "bg-warning/20 text-warning"
                  : accent === "rose"
                    ? "bg-destructive/20 text-[#ff9d97]"
                    : "bg-white/12 text-white/80"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="font-outfit text-[26px] font-bold leading-none text-white">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11.5px] text-white/50">{caption}</p>
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
          <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
          {subtitle && (
            <p className="text-[12.5px] text-neutral-500">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
