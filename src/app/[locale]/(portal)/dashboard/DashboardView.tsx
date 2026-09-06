import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  FilePlus2Icon,
  MessageSquareWarningIcon,
  SendIcon,
  TrendingUpIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";

import { CommandBand, Section } from "@/components/portal/CommandBand";
import { Donut } from "@/components/portal/Donut";
import { PortfolioCommandCenter } from "@/components/portal/PortfolioCommandCenter";
import { RefreshButton } from "@/components/portal/RefreshButton";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";

import type {
  DashboardSummary,
  Tile,
} from "@/services/portal/dashboard.server";
import type { Role } from "@/server/mock/types";

/* ── tokens for the soft-tint tiles ────────────────────────────────── */

/** One icon per progress-tile key — a purely visual cue, not a new data source (see the `key`
 *  values `dashboard.server.ts` already assigns each tile). */
const TILE_ICON: Record<string, React.ReactNode> = {
  new: <FilePlus2Icon className="size-4" />,
  collecting: <ClipboardListIcon className="size-4" />,
  ready: <CheckCircle2Icon className="size-4" />,
  submitted: <SendIcon className="size-4" />,
  queried: <MessageSquareWarningIcon className="size-4" />,
  approved: <CheckCircle2Icon className="size-4" />,
  rejected: <XCircleIcon className="size-4" />,
};

/** Same dark-band card language as `PortfolioCommandCenter`'s KpiCard — reimplemented locally
 *  (rather than importing IMGC's version) so nothing about the IMGC command centre is touched
 *  while this matches its look for the lender's own two preserved KPI sections. */
const DARK_TILE_TONE: Record<
  Tile["tone"],
  { bg: string; icon: string; spark: string }
> = {
  neutral: { bg: "bg-white/8 border-white/12", icon: "bg-white/12 text-white/80", spark: "#a3a3a3" },
  info: { bg: "bg-info/8 border-info/15", icon: "bg-info/20 text-[#93c5fd]", spark: "#3b82f6" },
  warning: { bg: "bg-warning/8 border-warning/20", icon: "bg-warning/20 text-[#fcd34d]", spark: "#f59e0b" },
  success: { bg: "bg-success/8 border-success/15", icon: "bg-success/20 text-[#86efac]", spark: "#22c55e" },
  danger: { bg: "bg-destructive/8 border-destructive/15", icon: "bg-destructive/20 text-[#fca5a5]", spark: "#ef4444" },
  violet: { bg: "bg-[#ffc48a]/10 border-[#ffc48a]/20", icon: "bg-[#ffc48a]/20 text-[#ffc48a]", spark: "#ffb27a" },
  teal: { bg: "bg-success/8 border-success/15", icon: "bg-success/20 text-[#5eead4]", spark: "#14b8a6" },
};

/** Deterministic decorative squiggle, seeded by label — not a data series, purely ornamental
 *  (same idiom as `PortfolioCommandCenter`'s Sparkline). */
function nextSeed(h: number): number {
  return (h * 1103515245 + 12345) >>> 0;
}

function Sparkline({ seed, color }: Readonly<{ seed: string; color: string }>) {
  const initial = [...seed].reduce(
    (h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0,
    0
  );
  const points = Array.from({ length: 6 })
    .reduce<{ h: number; out: string[] }>(
      (acc) => {
        const h = nextSeed(acc.h);
        const y = 18 - ((h % 1000) / 1000) * 14;
        return { h, out: [...acc.out, `${acc.out.length * 20},${y.toFixed(1)}`] };
      },
      { h: initial, out: [] }
    )
    .out.join(" ");
  return (
    <svg viewBox="0 0 100 24" className="h-4 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One icon per portfolio-overview ring key — same idea, presentational only. */
const RING_ICON: Record<string, React.ReactNode> = {
  accounts: <AlertTriangleIcon className="size-4" />,
  "in-progress": <TrendingUpIcon className="size-4" />,
  submitted: <CheckCircle2Icon className="size-4" />,
};

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

function renderUploadCloudIcon() {
  return <UploadCloudIcon className="size-4" />;
}

function renderMessageWarningIcon() {
  return <MessageSquareWarningIcon className="size-4" />;
}

function renderClockIcon() {
  return <ClockIcon className="size-4" />;
}

export function DashboardView({ role, summary }: Props) {
  const isLender = role === "LENDER";

  return (
    <div className="space-y-6">
      {/* ── Command centre ───────────────────────────────────────── */}
      {!isLender && summary.portfolio && (
        <PortfolioCommandCenter summary={summary.portfolio} />
      )}

      {/* ── In-progress cases ────────────────────────────────────── */}
      {isLender && (
        <CommandBand
          title="In progress claim cases"
          subtitle="Where every account currently stands"
          stats={[]}
          action={<RefreshButton />}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summary.progressTiles.map((tile) => {
              const tone = DARK_TILE_TONE[tile.tone];
              const Inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[12px] font-medium text-white/70">
                      {tile.label}
                    </p>
                    {TILE_ICON[tile.key] && (
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg",
                          tone.icon
                        )}
                      >
                        {TILE_ICON[tile.key]}
                      </span>
                    )}
                  </div>
                  <p className="font-outfit text-[22px] font-bold leading-none text-white">
                    {tile.value}
                  </p>
                  <Sparkline seed={tile.label} color={tone.spark} />
                </>
              );
              const className = cn(
                "flex flex-col rounded-xl border bg-white/8 backdrop-blur-sm px-3 py-2",
                tone.bg,
                tile.href && "transition-colors hover:bg-white/12 cursor-pointer"
              );
              return tile.href ? (
                <Link key={tile.key} href={tile.href} className={className}>
                  {Inner}
                </Link>
              ) : (
                <div key={tile.key} className={className}>
                  {Inner}
                </div>
              );
            })}
          </div>
        </CommandBand>
      )}

      {/* ── Portfolio overview ───────────────────────────────────── */}
      {isLender && (
        <Section
          title="Portfolio overview"
          subtitle="Claim and document counts against their totals"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.rings.map((ring) => {
              const Inner = (
                <>
                  <Donut value={ring.value} total={ring.total} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] text-neutral-500">
                        {ring.label}
                      </p>
                      {RING_ICON[ring.key] && (
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-light text-brand-primary">
                          {RING_ICON[ring.key]}
                        </span>
                      )}
                    </div>
                    <p className="font-outfit text-[22px] font-bold leading-tight text-neutral-950">
                      {ring.value}
                    </p>
                  </div>
                </>
              );
              const className = cn(
                "flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-4 py-3.5 shadow-sm transition-all",
                ring.href && "hover:-translate-y-0.5 hover:border-brand-primary/50 hover:shadow-md"
              );
              return ring.href ? (
                <Link key={ring.key} href={ring.href} className={className}>
                  {Inner}
                </Link>
              ) : (
                <div key={ring.key} className={className}>
                  {Inner}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Actionable items ─────────────────────────────────────── */}
      {isLender && (
        <Section
          title="Actionable items"
          subtitle="What is waiting on you right now"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <ActionCard
              icon={renderUploadCloudIcon()}
              title="Pending document upload"
              value={summary.pendingUploadAccounts}
              unit="accounts pending"
              href={ROUTES.initiateClaim}
            />
            <ActionCard
              icon={renderMessageWarningIcon()}
              title="Queries awaiting response"
              value={summary.queriedCount}
              unit="claims queried by IMGC"
              href={ROUTES.trackQueryResponse}
            />
            <ActionCard
              icon={renderClockIcon()}
              title="Rejected documents"
              value={summary.rejectedDocCount}
              unit="held in the retention window"
              href={`${ROUTES.trackQueryResponse}?status=REJECTED`}
            />
          </div>
        </Section>
      )}

      {/* ── Aging ────────────────────────────────────────────────── */}
      {isLender && (
        <Section
          title="Aging overview — open cases"
          subtitle="Days since anything last happened on the account"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.aging.map((band) => (
              <div
                key={band.label}
                className="rounded-xl border border-neutral-100 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] text-neutral-500">{band.label}</p>
                  <p
                    className={cn(
                      "font-outfit text-[24px] font-bold leading-none",
                      band.tone === "danger" && "text-destructive",
                      band.tone === "warning" && "text-warning",
                      band.tone === "brand" && "text-brand-primary",
                      band.tone === "info" && "text-info"
                    )}
                  >
                    {band.count}
                  </p>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={cn("h-full rounded-full", BAR_TONE[band.tone])}
                    style={{ width: `${band.share}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11.5px] text-neutral-400">
                  {band.share}% of open cases
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ── building blocks ───────────────────────────────────────────────── */

function ActionCard({
  icon,
  title,
  value,
  unit,
  href,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  value: number;
  unit: string;
  href: string;
}>) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-light text-brand-primary">
          {icon}
        </span>
        <p className="text-[13.5px] font-semibold text-neutral-950">{title}</p>
      </div>
      <p className="font-outfit text-[32px] font-bold leading-none text-neutral-950">
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] text-neutral-500">{unit}</p>
      <Link
        href={href}
        className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        View details <ArrowRightIcon className="size-3.5" />
      </Link>
    </div>
  );
}
