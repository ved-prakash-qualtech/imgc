import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";

import { cn } from "@/lib/utils/twMergeUtils";

type StatCardDelta = Readonly<{
  /** Signed change label, e.g. "+12.4%" or "-0.3%". */
  value: string;
  /** Visual trend — controls the arrow icon and success/danger color. */
  trend: "up" | "down";
}>;

type StatCardProps = Readonly<{
  label: string;
  value: string;
  delta?: StatCardDelta;
  comparisonLabel?: string;
  className?: string;
}>;

/**
 * miFIN™ Stat / Metric card — label, large value, and an optional
 * up/down delta vs. a comparison period (default: "vs last month").
 */
function StatCard({
  label,
  value,
  delta,
  comparisonLabel = "vs last month",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-100 bg-white p-5",
        className
      )}
    >
      <p className="text-[13px] text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-[13px] font-medium",
            delta.trend === "up" ? "text-success-500" : "text-danger-600"
          )}
        >
          {delta.trend === "up" ? (
            <TrendingUpIcon className="size-3.5" />
          ) : (
            <TrendingDownIcon className="size-3.5" />
          )}
          {delta.value} {comparisonLabel}
        </p>
      )}
    </div>
  );
}

export { StatCard };
