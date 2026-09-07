import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  MessageSquareWarningIcon,
  PercentIcon,
  TrendingUpIcon,
  UploadCloudIcon,
} from "lucide-react";

import { CommandBand, Section } from "@/components/portal/CommandBand";
import { Donut } from "@/components/portal/Donut";
import { Panel } from "@/components/portal/Panel";
import { PortfolioCommandCenter } from "@/components/portal/PortfolioCommandCenter";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";

import type { DashboardSummary } from "@/services/portal/dashboard.server";
import type { Role } from "@/server/mock/types";

/* ── tokens for the soft-tint tiles ────────────────────────────────── */

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

      {/* ── Claims performance ───────────────────────────────────── */}
      {isLender && summary.claimPipeline && (
        <CommandBand
          title="Claims Performance"
          subtitle="Approval rate, turnaround time and activity at a glance"
          stats={[]}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PipelineKpiCard
              icon={<PercentIcon className="size-4" />}
              label="Approval Rate"
              value={
                summary.claimPipeline.approvalRatePct === null
                  ? "—"
                  : `${summary.claimPipeline.approvalRatePct}%`
              }
              tone="success"
            />
            <PipelineKpiCard
              icon={<ClockIcon className="size-4" />}
              label="Avg. Turnaround"
              value={
                summary.claimPipeline.avgTurnaroundDays === null
                  ? "—"
                  : `${summary.claimPipeline.avgTurnaroundDays}d`
              }
              tone="info"
            />
            <PipelineKpiCard
              icon={<CalendarClockIcon className="size-4" />}
              label="Claims This Month"
              value={String(summary.claimPipeline.claimsThisMonth)}
              tone="violet"
              href={ROUTES.initiateClaim}
            />
            <PipelineKpiCard
              icon={<AlertTriangleIcon className="size-4" />}
              label="Overdue Queries"
              value={String(summary.claimPipeline.overdueQueries)}
              tone={summary.claimPipeline.overdueQueries > 0 ? "danger" : "success"}
              href={ROUTES.trackQueryResponse}
            />
          </div>
        </CommandBand>
      )}

      {/* ── Portfolio overview ───────────────────────────────────── */}
      {isLender && (
        <Section
          title="Portfolio overview"
          subtitle="Claim and document counts against their totals"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.rings.map((ring) => {
              const card = (
                <Panel
                  size="compact"
                  title={ring.label}
                  description={`${ring.value} of ${ring.total} accounts`}
                  actions={
                    RING_ICON[ring.key] && (
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-light text-brand-primary">
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
                      <Donut value={ring.value} total={ring.total} size={84} stroke={9} />
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <p className="font-outfit text-[19px] font-bold leading-none text-neutral-950">
                          {ring.value}
                        </p>
                      </div>
                    </div>
                  </div>
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

/** Same dark-tile language as the Claim page's own "Claims Overview" band — matched for visual
 *  consistency only; the KPIs themselves are deliberately different (see the Section subtitle). */
const PIPELINE_TONE = {
  success: { bg: "bg-success/10 border-success/25", icon: "bg-success text-white" },
  info: { bg: "bg-info/10 border-info/20", icon: "bg-info text-white" },
  violet: { bg: "bg-brand-primary/10 border-brand-primary/25", icon: "bg-brand-primary text-white" },
  danger: { bg: "bg-destructive/10 border-destructive/25", icon: "bg-destructive text-white" },
} as const;

function PipelineKpiCard({
  icon,
  label,
  value,
  tone,
  href,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof PIPELINE_TONE;
  href?: string;
}>) {
  const t = PIPELINE_TONE[tone];
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-outfit text-[26px] font-bold leading-none text-white">
          {value}
        </span>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            t.icon
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 truncate text-[12.5px] font-medium text-white/85">{label}</p>
    </>
  );
  const className = cn(
    "rounded-xl border bg-white/8 backdrop-blur-sm px-4 py-3.5",
    t.bg,
    href && "transition-colors hover:bg-white/12 cursor-pointer"
  );
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

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
