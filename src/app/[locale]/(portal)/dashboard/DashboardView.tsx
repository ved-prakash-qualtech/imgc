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
import { Panel } from "@/components/portal/Panel";
import { PortfolioCommandCenter, Sparkline } from "@/components/portal/PortfolioCommandCenter";
import { ROUTES } from "@/constants/route";
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
};

/** What each ring means, not just what it looks like: NPA exposure is risk, in-progress loans are
 *  neutral/in-flight, active loans are the healthy count — the donut, icon chip and value all pick
 *  up this tone together instead of every ring reading as the same generic brand-orange. */
const RING_TONE: Record<string, keyof typeof RING_TONE_STYLE> = {
  accounts: "danger",
  "in-progress": "info",
  submitted: "success",
};

const RING_TONE_STYLE = {
  danger: { chip: "bg-destructive/10 text-destructive", value: "text-destructive" },
  info: { chip: "bg-info/10 text-info", value: "text-info" },
  success: { chip: "bg-success/10 text-success", value: "text-success" },
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
      {/* ── In progress claim cases — same band, both roles: a lender's own book, every
          lender's for IMGC ─────────────────────────────────────────────────────────── */}
      <CommandBand
        title={isLender ? "In progress claim cases" : "In progress claim cases — every lender"}
        subtitle="Where every account currently stands"
        stats={[]}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          "grid size-6 shrink-0 place-items-center rounded-md",
                          style?.chip ?? "bg-brand-light text-brand-primary"
                        )}
                      >
                        {RING_ICON[ring.key]}
                      </span>
                    )
                  }
                  className={cn(
                    "flex h-full flex-col transition-all",
                    ring.href && "hover:-translate-y-0.5 hover:border-brand-primary/50 hover:shadow-md"
                  )}
                >
                  <div className="flex flex-1 items-center justify-center py-4">
                    <div className="relative grid place-items-center">
                      <Donut
                        value={ring.value}
                        total={ring.total}
                        size={84}
                        stroke={9}
                        tone={tone ?? "brand"}
                      />
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <p
                          className={cn(
                            "font-outfit text-[19px] font-bold leading-none",
                            style?.value ?? "text-neutral-950"
                          )}
                        >
                          {ring.value}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[11.5px] text-neutral-400">{pct}% of book</p>
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
          </div>
      </Section>

      {/* ── Actionable items ─────────────────────────────────────── */}
      <Section
        title="Actionable items"
        subtitle="What is waiting on you right now"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <ActionCard
            icon={renderUploadCloudIcon()}
            title="Pending document upload"
            value={summary.pendingUploadAccounts}
            unit={isLender ? "accounts pending" : "accounts pending, every lender"}
            href={isLender ? ROUTES.initiateClaim : ROUTES.accounts}
            tone="warning"
          />
          <ActionCard
            icon={renderMessageWarningIcon()}
            title="Queries awaiting response"
            value={summary.queriedCount}
            unit={isLender ? "claims queried by IMGC" : "claims currently queried"}
            href={isLender ? ROUTES.trackQueryResponse : `${ROUTES.accounts}?status=QUERIED`}
            tone="info"
          />
          <ActionCard
            icon={renderClockIcon()}
            title="Rejected documents"
            value={summary.rejectedDocCount}
            unit="held in the retention window"
            href={
              isLender
                ? `${ROUTES.trackQueryResponse}?status=REJECTED`
                : ROUTES.adminRetention
            }
            tone="danger"
          />
        </div>
      </Section>

      {/* ── Aging ────────────────────────────────────────────────── */}
      <Section
        title="Aging overview — open cases"
        subtitle="Days since anything last happened on the account"
      >
        <Panel size="compact" className="p-5">
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

      {/* ── Portfolio-wide charts — IMGC only; a lender has one lender's worth of collections
          and status breakdown to show, which the sections above already cover ─────────────── */}
      {!isLender && summary.portfolio && (
        <PortfolioCommandCenter summary={summary.portfolio} showStats={false} />
      )}

    </div>
  );
}

/* ── building blocks ───────────────────────────────────────────────── */

/** One icon + spark color per claim stage — same seven stages `progressTiles` classifies
 *  accounts into, just what each tile looks like. */
const PROGRESS_TILE_ICON: Record<string, React.ReactNode> = {
  new: <FilePlus2Icon className="size-4" />,
  collecting: <ClipboardListIcon className="size-4" />,
  ready: <CheckCircle2Icon className="size-4" />,
  submitted: <SendIcon className="size-4" />,
  queried: <MessageSquareWarningIcon className="size-4" />,
  approved: <CheckCircle2Icon className="size-4" />,
  rejected: <XCircleIcon className="size-4" />,
  expired: <AlertTriangleIcon className="size-4" />,
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

/** Same tone language as the portfolio rings: how urgent an actionable item is, not just what
 *  it's about — an upload backlog reads differently from a rejected document past retention. */
const ACTION_TONE = {
  warning: {
    chip: "bg-warning/10 text-warning",
    accent: "bg-warning",
    value: "text-neutral-950",
    badge: "bg-warning/10 text-warning",
    button: "bg-warning text-white hover:bg-warning/85",
  },
  info: {
    chip: "bg-info/10 text-info",
    accent: "bg-info",
    value: "text-neutral-950",
    badge: "bg-info/10 text-info",
    button: "bg-info text-white hover:bg-info/85",
  },
  danger: {
    chip: "bg-destructive/10 text-destructive",
    accent: "bg-destructive",
    value: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
    button: "bg-destructive text-white hover:bg-destructive/85",
  },
} as const;

const ACTION_URGENCY_LABEL = {
  warning: "Needs upload",
  info: "Awaiting reply",
  danger: "Action needed",
} as const;

function ActionCard({
  icon,
  title,
  value,
  unit,
  href,
  tone,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  value: number;
  unit: string;
  href: string;
  tone: keyof typeof ACTION_TONE;
}>) {
  const t = ACTION_TONE[tone];
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-1", t.accent)} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-8 place-items-center rounded-lg", t.chip)}>
            {icon}
          </span>
          <p className="text-[13.5px] font-semibold text-neutral-950">{title}</p>
        </div>
        {value > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              t.badge
            )}
          >
            {ACTION_URGENCY_LABEL[tone]}
          </span>
        )}
      </div>
      <p className={cn("font-outfit text-[32px] font-bold leading-none", t.value)}>
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] text-neutral-500">{unit}</p>
      <Link
        href={href}
        className={cn(
          "mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors",
          t.button
        )}
      >
        View details <ArrowRightIcon className="size-3.5" />
      </Link>
    </div>
  );
}
