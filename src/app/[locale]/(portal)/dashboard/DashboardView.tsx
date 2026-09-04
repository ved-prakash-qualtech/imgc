import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileClockIcon,
  FolderOpenIcon,
  MessageSquareWarningIcon,
  UploadCloudIcon,
} from "lucide-react";

import { CommandBand, Section } from "@/components/portal/CommandBand";
import { Donut } from "@/components/portal/Donut";
import { StatusPill } from "@/components/portal/StatusPill";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AccountRow } from "@/services/portal/accounts.server";
import type {
  DashboardSummary,
  Tile,
} from "@/services/portal/dashboard.server";
import type { AuditEvent, Role } from "@/server/mock/types";

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

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── page ──────────────────────────────────────────────────────────── */

type Props = Readonly<{
  role: Role;
  firstName: string;
  workspace: string;
  summary: DashboardSummary;
  attention: AccountRow[];
  recent: AuditEvent[];
}>;

function buildCommandBandStats(summary: DashboardSummary, isLender: boolean) {
  if (isLender && summary.lenderHero) {
    return [
      {
        icon: <FolderOpenIcon className="size-4" />,
        label: "Total Claims",
        value: String(summary.lenderHero.totalClaims),
        caption: "Visible within your scope",
      },
      {
        icon: <FileClockIcon className="size-4" />,
        label: "Claim Initiation",
        value: String(summary.lenderHero.claimInitiation),
        caption: "Draft claims in progress",
      },
      {
        icon: <ClockIcon className="size-4" />,
        label: "Under Progress",
        value: String(summary.lenderHero.underProgress),
        caption: "With IMGC for review",
      },
      {
        icon: <CheckCircle2Icon className="size-4" />,
        label: "Claim Approved",
        value: String(summary.lenderHero.claimApproved),
        caption: "Fully approved claims",
        accent: "teal" as const,
      },
      {
        icon: <AlertTriangleIcon className="size-4" />,
        label: "Claim Rejected",
        value: String(summary.lenderHero.claimRejected),
        caption: "Rejected by IMGC",
        accent: "rose" as const,
      },
    ];
  }

  return [
    {
      icon: <FolderOpenIcon className="size-4" />,
      label: "Accounts in scope",
      value: String(summary.accountCount),
      caption: `${summary.readyToSubmit} ready to submit`,
    },
    {
      icon: <UploadCloudIcon className="size-4" />,
      label: "Document readiness",
      value: `${summary.completionPct}%`,
      caption: `${summary.documentsIn} of ${summary.documentsRequired} mandatory in`,
      accent: "teal" as const,
    },
    {
      icon: <FileClockIcon className="size-4" />,
      label: "Submitted / approved",
      value: `${summary.submittedCount} / ${summary.approvedCount}`,
      caption: `${summary.queriedCount} queried`,
    },
    {
      icon: <AlertTriangleIcon className="size-4" />,
      label: "Needs action",
      value: String(summary.pendingUploadAccounts),
      caption:
        summary.oldestPendingDays > 0
          ? `oldest untouched ${summary.oldestPendingDays}d`
          : "nothing outstanding",
      accent: "amber" as const,
    },
  ];
}

function renderAdditionalDocsAction(isLender: boolean) {
  return (
    <Link
      href={isLender ? ROUTES.initiateClaim : ROUTES.additionalDocuments}
      className="text-[12.5px] font-semibold text-brand-primary hover:underline"
    >
      {isLender ? "Initiate a claim" : "Open the workbench"} →
    </Link>
  );
}

function renderNeedsAttentionAction() {
  return (
    <Link
      href={ROUTES.accounts}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-primary hover:underline"
    >
      All accounts <ArrowRightIcon className="size-3.5" />
    </Link>
  );
}

function renderUploadCloudIcon() {
  return <UploadCloudIcon className="size-4" />;
}

function renderMessageWarningIcon() {
  return <MessageSquareWarningIcon className="size-4" />;
}

function renderClockIcon() {
  return <ClockIcon className="size-4" />;
}

export function DashboardView({ role, summary, attention, recent }: Props) {
  const isLender = role === "LENDER";

  return (
    <div className="space-y-6">
      {/* ── Command centre ───────────────────────────────────────── */}
      {!isLender && (
        <CommandBand
          title="Claims Operations Centre"
          subtitle="Document readiness and claim progress across every lender"
          stats={buildCommandBandStats(summary, isLender)}
        />
      )}

      {/* ── In-progress cases ────────────────────────────────────── */}
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

      {/* ── Additional documents (summary only — the workbench is its own page) ── */}
      {!isLender && (
        <Section
          title="Additional documents"
          subtitle="Requirements raised against cases, across every lender"
          action={renderAdditionalDocsAction(isLender)}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Pending upload",
                value: summary.additional.pendingUpload,
                tone: "neutral" as const,
              },
              {
                label: "Under review",
                value: summary.additional.underReview,
                tone: "info" as const,
              },
              {
                label: "Re-upload required",
                value: summary.additional.reuploadRequired,
                tone: "warning" as const,
              },
              {
                label: "Approved",
                value: summary.additional.approved,
                tone: "success" as const,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className={cn(
                  "rounded-xl border px-4 py-3.5",
                  TILE_TONE[tile.tone]
                )}
              >
                <p className="font-outfit text-[26px] font-bold leading-none">
                  {tile.value}
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium opacity-80">
                  {tile.label}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Portfolio overview ───────────────────────────────────── */}
      <Section
        title={isLender ? "Portfolio overview" : "Pool overview"}
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
            unit="accounts pending"
            href={ROUTES.accounts}
          />
          <ActionCard
            icon={renderMessageWarningIcon()}
            title="Queries awaiting response"
            value={summary.queriedCount}
            unit="claims queried by IMGC"
            href={ROUTES.accounts}
          />
          <ActionCard
            icon={renderClockIcon()}
            title="Rejected documents"
            value={summary.rejectedDocCount}
            unit="held in the retention window"
            href={role === "IMGC" ? ROUTES.adminRetention : ROUTES.accounts}
          />
        </div>
      </Section>

      {/* ── Aging ────────────────────────────────────────────────── */}
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

      {/* ── Needs attention + activity ───────────────────────────── */}
      {!isLender && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card
            title="Needs attention"
            subtitle="Outstanding mandatory documents or an open query"
            action={renderNeedsAttentionAction()}
          >
            {attention.length === 0 ? (
              <Empty>
                Nothing outstanding — every mandatory document is in.
              </Empty>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={ROUTES.account(a.id)}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-neutral-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-neutral-950">
                          {a.loanNo} · {a.borrowerName}
                        </span>
                        <span className="block truncate text-[12px] text-neutral-500">
                          {a.lenderOrgName} ·{" "}
                          {a.pendingDocs > 0
                            ? `${a.pendingDocs} of ${a.requiredDocs} mandatory outstanding`
                            : "all documents in"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusPill status={a.claimStatus} />
                        <StatusPill status={a.bucket} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Recent activity"
            subtitle="The audit trail across accounts you can see"
          >
            {recent.length === 0 ? (
              <Empty>No activity recorded yet.</Empty>
            ) : (
              <ol className="divide-y divide-neutral-100">
                {recent.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <p className="text-[13px] leading-snug text-neutral-800">
                      {e.summary}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-neutral-400">
                      {e.actorName} · {when(e.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── building blocks ───────────────────────────────────────────────── */

function Card({
  title,
  subtitle,
  action,
  children,
}: Readonly<{
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-xl border border-neutral-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold text-neutral-950">
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-neutral-500">{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
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

function Empty({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="flex items-center justify-center gap-2 px-5 py-12 text-center text-[13px] text-neutral-500">
      <CheckCircle2Icon className="size-4 text-success-700" />
      {children}
    </p>
  );
}
