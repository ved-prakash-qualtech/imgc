import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  MessageSquareWarningIcon,
  UploadCloudIcon,
} from "lucide-react";

import { Donut } from "@/components/portal/Donut";
import { Section } from "@/components/portal/CommandBand";
import { PortfolioCommandCenter } from "@/components/portal/PortfolioCommandCenter";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";

import type {
  DashboardSummary,
  Tile,
} from "@/services/portal/dashboard.server";
import type { Role } from "@/server/mock/types";

/* ── tokens for the soft-tint tiles ────────────────────────────────── */

const TILE_TONE: Record<Tile["tone"], string> = {
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
  info: "border-info/25 bg-info/8 text-info",
  warning: "border-warning/30 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success-700",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
  violet: "border-brand-primary/25 bg-brand-light text-brand-dark",
  teal: "border-success/25 bg-success/8 text-success-700",
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
        <Section
          title="In progress claim cases"
          subtitle="Where every account currently stands"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.progressTiles.map((tile) => {
              const Inner = (
                <>
                  <p className="font-outfit text-[26px] font-bold leading-none">
                    {tile.value}
                  </p>
                  <p className="mt-1.5 text-[12.5px] font-medium opacity-80">
                    {tile.label}
                  </p>
                </>
              );
              const className = cn(
                "rounded-xl border px-4 py-3.5 transition-colors block",
                tile.href && "hover:opacity-80 hover:shadow-sm",
                TILE_TONE[tile.tone]
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
        </Section>
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
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-neutral-500">
                      {ring.label}
                    </p>
                    <p className="font-outfit text-[22px] font-bold leading-tight text-neutral-950">
                      {ring.value}
                    </p>
                  </div>
                </>
              );
              const className = cn(
                "flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-4 py-3.5 shadow-sm transition-colors",
                ring.href && "hover:border-brand-primary/50 hover:shadow-md"
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
