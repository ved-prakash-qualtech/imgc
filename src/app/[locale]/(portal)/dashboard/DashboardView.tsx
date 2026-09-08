import Link from "next/link";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  FilePlus2Icon,
  LayersIcon,
  MessageSquareWarningIcon,
  SendIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";

import { CommandBand, Section } from "@/components/portal/CommandBand";
import { Donut } from "@/components/portal/Donut";
import { Panel } from "@/components/portal/Panel";
import { Sparkline, StatusBreakdownCard } from "@/components/portal/PortfolioCommandCenter";
import { cn } from "@/lib/utils/twMergeUtils";

import type { DashboardSummary } from "@/services/portal/dashboard.server";
import type { Tile } from "@/services/portal/dashboard.server";
import type { Role } from "@/server/mock/types";

/* ── tokens for the soft-tint tiles ────────────────────────────────── */

/** One icon per portfolio-overview ring key — same idea, presentational only. */
const RING_ICON: Record<string, React.ReactNode> = {
  accounts: <AlertTriangleIcon className="size-4" />,
  "in-progress": <TrendingUpIcon className="size-4" />,
  submitted: <CheckCircle2Icon className="size-4" />,
  // Same icon language the "Actionable items" cards below already use for these two — a query
  // is a message-shaped wait, a rejected document is a clock-shaped one (retention window).
  queried: <MessageSquareWarningIcon className="size-4" />,
  "rejected-docs": <ClockIcon className="size-4" />,
};

/** What each ring means, not just what it looks like: NPA exposure is risk, in-progress loans are
 *  neutral/in-flight, active loans are the healthy count — the donut, icon chip and value all pick
 *  up this tone together instead of every ring reading as the same generic brand-orange. */
const RING_TONE: Record<string, keyof typeof RING_TONE_STYLE> = {
  accounts: "danger",
  "in-progress": "info",
  submitted: "success",
  queried: "info",
  "rejected-docs": "danger",
};

// Keys match `Donut`'s own supported strokes exactly (brand/danger/info/success) — the ring, its
// icon chip and its value all read this same tone, so there's nothing to keep in sync by hand.
// `wash`/`borderTop` give each card a faint tone-tinted background and a colored top edge — the
// same "what does this number mean" signal as the icon chip and donut, just carried by the whole
// card instead of one small corner of it.
const RING_TONE_STYLE = {
  brand: {
    chip: "bg-brand-light text-brand-primary",
    value: "text-neutral-950",
    wash: "bg-gradient-to-br from-brand-light/50 via-white to-white",
    borderTop: "border-t-brand-primary",
  },
  danger: {
    chip: "bg-destructive/10 text-destructive",
    value: "text-destructive",
    wash: "bg-gradient-to-br from-destructive/8 via-white to-white",
    borderTop: "border-t-destructive",
  },
  info: {
    chip: "bg-info/10 text-info",
    value: "text-info",
    wash: "bg-gradient-to-br from-info/8 via-white to-white",
    borderTop: "border-t-info",
  },
  success: {
    chip: "bg-success/10 text-success",
    value: "text-success",
    wash: "bg-gradient-to-br from-success/8 via-white to-white",
    borderTop: "border-t-success",
  },
} as const;

const BAR_TONE = {
  info: "bg-info",
  brand: "bg-brand-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

/* ── page ──────────────────────────────────────────────────────────── */

type Props = Readonly<{
  role: Role;
  firstName: string;
  workspace: string;
  summary: DashboardSummary;
}>;

export function DashboardView({ role, summary }: Props) {
  const isLender = role === "LENDER";

  return (
    <div className="space-y-6">
      {/* ── In progress claim cases — same band, both roles: a lender's own book, every
          lender's for IMGC ─────────────────────────────────────────────────────────── */}
      <CommandBand
        title={isLender ? "In progress claim cases" : "In progress claim cases — every lender"}
        subtitle="Where every account currently stands"
        stats={[]}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {summary.progressTiles.map((tile) => (
            <ProgressTileCard key={tile.key} tile={tile} />
          ))}
        </div>
      </CommandBand>

      {/* ── Portfolio overview ───────────────────────────────────── */}
      <Section
        title="Portfolio overview"
        subtitle="Claim and document counts against their totals"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summary.rings.map((ring) => {
              const tone = RING_TONE[ring.key];
              const style = tone ? RING_TONE_STYLE[tone] : undefined;
              const pct = Math.round((ring.value / (ring.total || 1)) * 100);
              const card = (
                <Panel
                  size="compact"
                  title={ring.label}
                  description={`${ring.value} of ${ring.total} accounts`}
                  actions={
                    RING_ICON[ring.key] && (
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg shadow-sm",
                          style?.chip ?? "bg-brand-light text-brand-primary"
                        )}
                      >
                        {RING_ICON[ring.key]}
                      </span>
                    )
                  }
                  className={cn(
                    "flex h-full flex-col overflow-hidden border-t-4 shadow-md transition-all duration-200",
                    style?.wash ?? "bg-white",
                    style?.borderTop ?? "border-t-brand-primary",
                    ring.href &&
                      "hover:-translate-y-1 hover:shadow-xl"
                  )}
                >
                  <div className="flex flex-1 items-center justify-center py-5">
                    <div className="relative grid place-items-center">
                      <Donut
                        value={ring.value}
                        total={ring.total}
                        size={92}
                        stroke={10}
                        tone={tone ?? "brand"}
                      />
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <p
                          className={cn(
                            "font-outfit text-[22px] font-bold leading-none",
                            style?.value ?? "text-neutral-950"
                          )}
                        >
                          {ring.value}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[11.5px] font-medium text-neutral-400">{pct}% of book</p>
                </Panel>
              );
              return ring.href ? (
                <Link key={ring.key} href={ring.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={ring.key}>{card}</div>
              );
            })}
            {summary.portfolio && (
              <StatusBreakdownCard
                breakdown={summary.portfolio.statusBreakdown}
                npaLoans={summary.portfolio.npaLoans}
                loansOnBook={summary.portfolio.loansOnBook}
              />
            )}
          </div>
      </Section>

      {/* ── Aging ────────────────────────────────────────────────── */}
      <Section
        title="Aging overview — open cases"
        subtitle="Days since anything last happened on the account"
      >
        <Panel size="compact" className="p-5 shadow-md">
            {/* One bar for the whole open pipeline — where four near-identical cards used to make
                an empty band (0%) look like broken UI, a single stacked bar reads "everything's
                piled up in one place" at a glance, which is the actual finding here. */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              {summary.aging.map(
                (band) =>
                  band.share > 0 && (
                    <div
                      key={band.label}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", BAR_TONE[band.tone])}
                      style={{ width: `${band.share}%` }}
                      title={`${band.label}: ${band.count} (${band.share}%)`}
                    />
                  )
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {summary.aging.map((band) => (
                <div
                  key={band.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-opacity",
                    band.count === 0 ? "opacity-45" : "bg-neutral-25"
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", BAR_TONE[band.tone])} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-neutral-500">{band.label}</p>
                    <p
                      className={cn(
                        "font-outfit text-[19px] font-bold leading-none",
                        band.tone === "danger" && "text-destructive",
                        band.tone === "warning" && "text-warning",
                        band.tone === "brand" && "text-brand-primary",
                        band.tone === "info" && "text-info"
                      )}
                    >
                      {band.count}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-400">{band.share}%</span>
                </div>
              ))}
            </div>
          </Panel>
      </Section>

    </div>
  );
}

/* ── building blocks ───────────────────────────────────────────────── */

/** One icon + spark color per claim stage — same seven stages `progressTiles` classifies
 *  accounts into, just what each tile looks like. */
const PROGRESS_TILE_ICON: Record<string, React.ReactNode> = {
  "total-loans": <LayersIcon className="size-4" />,
  new: <FilePlus2Icon className="size-4" />,
  collecting: <ClipboardListIcon className="size-4" />,
  ready: <CheckCircle2Icon className="size-4" />,
  submitted: <SendIcon className="size-4" />,
  queried: <MessageSquareWarningIcon className="size-4" />,
  approved: <CheckCircle2Icon className="size-4" />,
  rejected: <XCircleIcon className="size-4" />,
  expired: <AlertTriangleIcon className="size-4" />,
  active: <ActivityIcon className="size-4" />,
};

const PROGRESS_TILE_TONE: Record<
  Tile["tone"],
  { bg: string; icon: string; spark: string }
> = {
  neutral: { bg: "bg-white/8 border-white/15", icon: "bg-white/15 text-white/80", spark: "#e5e7eb" },
  info: { bg: "bg-info/10 border-info/20", icon: "bg-info text-white", spark: "#3b82f6" },
  teal: { bg: "bg-success/10 border-success/20", icon: "bg-success text-white", spark: "#14b8a6" },
  violet: { bg: "bg-brand-primary/10 border-brand-primary/25", icon: "bg-brand-primary text-white", spark: "#a78bfa" },
  warning: { bg: "bg-warning/10 border-warning/25", icon: "bg-warning text-white", spark: "#f59e0b" },
  success: { bg: "bg-success/10 border-success/25", icon: "bg-success text-white", spark: "#22c55e" },
  danger: { bg: "bg-destructive/10 border-destructive/25", icon: "bg-destructive text-white", spark: "#ef4444" },
};

function ProgressTileCard({ tile }: Readonly<{ tile: Tile }>) {
  const t = PROGRESS_TILE_TONE[tile.tone];
  const inner = (
    <>
      <div className="flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] font-medium text-white/75">{tile.label}</p>
        {PROGRESS_TILE_ICON[tile.key] && (
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", t.icon)}>
            {PROGRESS_TILE_ICON[tile.key]}
          </span>
        )}
      </div>
      <p className="font-outfit text-[20px] font-bold leading-none text-white">{tile.value}</p>
      <Sparkline seed={tile.key} color={t.spark} />
    </>
  );
  const className = cn(
    "flex flex-col gap-1 rounded-xl border bg-white/8 backdrop-blur-sm px-3 py-2.5",
    t.bg,
    tile.href && "transition-colors hover:bg-white/12 cursor-pointer"
  );
  return tile.href ? (
    <Link href={tile.href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

