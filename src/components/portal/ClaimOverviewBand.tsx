import Link from "next/link";
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  FilePlus2Icon,
  LayersIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";

import { CommandBand } from "@/components/portal/CommandBand";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ClaimOverviewCounts } from "@/services/portal/claimFlow.server";

/**
 * A claim-status KPI band — used on both the Claim page and the Dashboard, so the two never show
 * different numbers for "how many claims are approved" (`summariseClaimOverview` is the one place
 * that classifies a claim into these buckets; this component only ever renders what it's given).
 */

type Tone = "blue" | "amber" | "violet" | "green" | "rose" | "gold";

const TONE: Record<Tone, { bg: string; icon: string }> = {
  blue: { bg: "border-info/30", icon: "bg-info/10 text-info" },
  amber: { bg: "border-warning/30", icon: "bg-warning/10 text-warning" },
  violet: { bg: "border-brand-primary/30", icon: "bg-brand-primary/10 text-brand-primary" },
  green: { bg: "border-success/30", icon: "bg-success/10 text-success-600" },
  rose: { bg: "border-destructive/30", icon: "bg-destructive/10 text-destructive" },
  gold: { bg: "border-[#ffc48a]/50", icon: "bg-[#ffc48a]/20 text-[#d9860f]" },
};

const TILES: ReadonlyArray<{
  key: keyof ClaimOverviewCounts;
  label: string;
  icon: React.ReactNode;
  tone: Tone;
}> = [
  { key: "total", label: "Total NPA Accounts", icon: <LayersIcon className="size-4" />, tone: "blue" },
  { key: "initiation", label: "Claim to be Initiated", icon: <FilePlus2Icon className="size-4" />, tone: "rose" },
  { key: "underProgress", label: "Under Progress", icon: <ClipboardListIcon className="size-4" />, tone: "amber" },
  { key: "approved", label: "Claim Approved", icon: <CheckCircle2Icon className="size-4" />, tone: "violet" },
  { key: "rejected", label: "Claim Rejected", icon: <XCircleIcon className="size-4" />, tone: "gold" },
];

export function ClaimOverviewBand({
  counts,
  hrefs,
  title = "Claims Overview",
  subtitle = "Where every claim currently stands",
}: Readonly<{
  counts: ClaimOverviewCounts;
  /** Where each tile drills into — the grid below reads the same `?status=` value back out
   *  (see EligibleCasesClient's `statusFromParam`), so the click and the count always agree. */
  hrefs?: Partial<Record<keyof ClaimOverviewCounts, string>>;
  title?: string;
  subtitle?: string;
}>) {
  return (
    <CommandBand title={title} subtitle={subtitle} stats={[]}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TILES.map((tile) => {
          const tone = TONE[tile.tone];
          const href = hrefs?.[tile.key];
          const className = cn(
            "flex flex-col rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-300",
            tone.bg,
            href && "hover:-translate-y-1 hover:shadow-md hover:bg-neutral-50 cursor-pointer"
          );
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-outfit text-[22px] font-bold leading-none text-neutral-900">
                  {String(counts[tile.key]).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    tone.icon
                  )}
                >
                  {tile.icon}
                </span>
              </div>
              <p className="mt-2 truncate text-[12px] font-medium text-neutral-500">
                {tile.label}
              </p>
            </>
          );
          return href ? (
            <Link key={tile.key} href={href} className={className} title={tile.label}>
              {content}
            </Link>
          ) : (
            <div key={tile.key} className={className} title={tile.label}>
              {content}
            </div>
          );
        })}
      </div>
    </CommandBand>
  );
}
