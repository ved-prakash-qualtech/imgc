import Link from "next/link";
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  FilePlus2Icon,
  XCircleIcon,
} from "lucide-react";

import { CommandBand } from "@/components/portal/CommandBand";
import { cn } from "@/lib/utils/twMergeUtils";
import type {
  ClaimOverviewCounts,
  OverviewTileKey,
} from "@/services/portal/claimFlow.server";

/**
 * Rupees in the Indian short scale a claims desk reads in: 4,62,00,000 is "₹4.62 Cr",
 * 7,35,000 is "₹7.35 L". Exact figures sit in the tile's tooltip.
 */
function crore(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const exactInr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * A claim-status KPI band — used on both the Claim page and the Dashboard, so the two never show
 * different numbers for "how many claims are approved" (`summariseClaimOverview` is the one place
 * that classifies a claim into these buckets; this component only ever renders what it's given).
 */

type Tone = "blue" | "amber" | "violet" | "green" | "rose" | "gold";
type PendingWith = "Lender" | "IMGC Claims Team" | "None" | "Split";

const TONE: Record<Tone, { bg: string; icon: string }> = {
  blue: { bg: "border-info/30", icon: "bg-info/10 text-info" },
  amber: { bg: "border-warning/30", icon: "bg-warning/10 text-warning" },
  violet: {
    bg: "border-brand-primary/30",
    icon: "bg-brand-primary/10 text-brand-primary",
  },
  green: { bg: "border-success/30", icon: "bg-success/10 text-success-600" },
  rose: {
    bg: "border-destructive/30",
    icon: "bg-destructive/10 text-destructive",
  },
  gold: { bg: "border-[#ffc48a]/50", icon: "bg-[#ffc48a]/20 text-[#d9860f]" },
};

const TILES: ReadonlyArray<{
  key: OverviewTileKey;
  label: string;
  icon: React.ReactNode;
  tone: Tone;
  pendingWith: PendingWith;
}> = [
  {
    key: "initiation",
    label: "To be initiated",
    icon: <FilePlus2Icon className="size-4" />,
    tone: "rose",
    pendingWith: "Lender",
  },
  {
    key: "underReview",
    label: "Under Review",
    icon: <ClipboardListIcon className="size-4" />,
    tone: "amber",
    pendingWith: "IMGC Claims Team",
  },
  {
    key: "approved",
    label: "Approved",
    icon: <CheckCircle2Icon className="size-4" />,
    tone: "violet",
    pendingWith: "None",
  },
  {
    key: "rejected",
    label: "Rejected",
    icon: <XCircleIcon className="size-4" />,
    tone: "gold",
    pendingWith: "None",
  },
];

const EMPTY_STATS: never[] = [];

export function ClaimOverviewBand({
  counts,
  hrefs,
  showDraftQueryKpis,
  title = "Claims Overview",
  subtitle,
  action,
  titleAside,
}: Readonly<{
  counts: ClaimOverviewCounts;
  /** Where each tile drills into — the grid below reads the same `?status=` value back out
   *  (see EligibleCasesClient's `statusFromParam`), so the click and the count always agree. */
  hrefs?: Partial<Record<keyof ClaimOverviewCounts, string>>;
  showDraftQueryKpis?: boolean;
  title?: string;
  subtitle?: string;
  /** Top-right of the band, on the gradient — the Claim Dashboard's lender lens goes here, same
   *  slot the main Dashboard's lender filter uses. Unused by the Claims-grid callers. */
  action?: React.ReactNode;
  /** Beside the band's title, on the left. */
  titleAside?: React.ReactNode;
}>) {
  const activeTiles = showDraftQueryKpis
    ? ([
        TILES[0]!,
        {
          key: "draft",
          label: "Draft",
          icon: <FilePlus2Icon className="size-4" />,
          tone: "blue",
          pendingWith: "Lender",
        }, // started, not yet submitted
        {
          key: "initiated",
          label: "Initiated",
          icon: <CheckCircle2Icon className="size-4" />, // Or another suitable icon
          tone: "blue",
          pendingWith: "IMGC Claims Team",
        },
        {
          key: "queried",
          label: "Queried",
          icon: <ClipboardListIcon className="size-4" />,
          tone: "amber",
          pendingWith: "Split",
        },
        TILES[1]!, // Under Review — with IMGC, after the query it may have come back from
        TILES[2]!,
        TILES[3]!,
      ] as const)
    : TILES;

  return (
    <CommandBand
      title={title}
      subtitle={subtitle}
      stats={EMPTY_STATS}
      action={action}
      titleAside={titleAside}
    >
      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:grid-cols-3",
          activeTiles.length >= 7
            ? "xl:grid-cols-7"
            : activeTiles.length >= 6
              ? "xl:grid-cols-6"
              : "xl:grid-cols-4"
        )}
      >
        {activeTiles.map((tile) => {
          const tone = TONE[tile.tone];
          const href = hrefs?.[tile.key];
          const className = cn(
            "flex flex-col rounded-xl border bg-white shadow-sm transition-all duration-300",
            activeTiles.length >= 6 ? "px-2.5 py-1" : "px-3.5 py-1.5",
            tone.bg,
            href &&
              "hover:-translate-y-1 hover:shadow-md hover:bg-neutral-50 cursor-pointer"
          );
          const isQueried = tile.key === "queried";

          const content = (
            <>
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={cn(
                    "font-outfit font-bold leading-none text-neutral-900",
                    activeTiles.length >= 6 ? "text-[18px]" : "text-[20px]"
                  )}
                >
                  {String(counts[tile.key]).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "grid shrink-0 place-items-center rounded-lg",
                    activeTiles.length >= 6 ? "size-6" : "size-7",
                    tone.icon
                  )}
                >
                  {tile.icon}
                </span>
              </div>
              <div className="mt-auto pt-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <p
                    className={cn(
                      "truncate font-medium text-neutral-500",
                      activeTiles.length >= 6 ? "text-xs" : "text-sm"
                    )}
                  >
                    {tile.label}
                  </p>
                  {(tile.key === "approved" || tile.key === "rejected") && (
                    <span className="shrink-0 rounded bg-brand-primary/10 px-1 py-[1px] text-[7.5px] font-bold uppercase tracking-wider text-brand-primary border border-brand-primary/20">
                      CFY
                    </span>
                  )}
                </div>
                {/* One line, not two: the tallest tile sets the whole band's height. */}
                {tile.pendingWith !== "None" &&
                  tile.pendingWith !== "Split" && (
                    <p className="mt-0.5 truncate text-[9px] font-medium text-neutral-500">
                      Pending with &middot; {tile.pendingWith}
                    </p>
                  )}
                {tile.pendingWith === "Split" && isQueried && (
                  <p className="mt-0.5 truncate text-[9px] font-medium text-neutral-500">
                    Lender {counts.queryInitiated ?? 0} &middot; IMGC{" "}
                    {counts.queryUnderReview ?? 0}
                  </p>
                )}
                {/* Claim amount across exactly the claims this tile counts. */}
                <p
                  className="mt-0.5 text-[11px] font-semibold leading-tight tabular-nums text-neutral-700"
                  title={`Claim amount: ₹${exactInr.format(counts.claimAmount[tile.key])}`}
                >
                  <span className="block text-[9.5px] font-medium leading-tight text-neutral-400">
                    Claim Amount
                  </span>
                  {crore(counts.claimAmount[tile.key])}
                </p>
              </div>
            </>
          );
          return href ? (
            <Link
              key={tile.key}
              href={href}
              className={className}
              title={tile.label}
            >
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
