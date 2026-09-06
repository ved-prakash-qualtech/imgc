/* eslint-disable security/detect-object-injection, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop */

import Link from "next/link";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { CommandBand } from "@/components/portal/CommandBand";
import { RefreshButton } from "@/components/portal/RefreshButton";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";
import type { PortfolioSummary } from "@/services/portal/dashboard.server";

/** ₹ in crore/lakh, matching how large book values read across the portal's finance screens. */
function formatCr(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

type KpiTone = "blue" | "mint" | "green" | "amber" | "rose";

const KPI_TONE: Record<KpiTone, { bg: string; icon: string; spark: string }> = {
  blue: {
    bg: "bg-info/8 border-info/15",
    icon: "bg-info/20 text-[#93c5fd]",
    spark: "#3b82f6",
  }, // text-blue-300 equivalent
  mint: {
    bg: "bg-success/8 border-success/15",
    icon: "bg-success/20 text-[#5eead4]",
    spark: "#14b8a6",
  }, // text-teal-300 equivalent
  green: {
    bg: "bg-success/8 border-success/15",
    icon: "bg-success/20 text-[#86efac]",
    spark: "#22c55e",
  }, // text-green-300 equivalent
  amber: {
    bg: "bg-warning/8 border-warning/20",
    icon: "bg-warning/20 text-[#fcd34d]",
    spark: "#f59e0b",
  }, // text-amber-300 equivalent
  rose: {
    bg: "bg-destructive/8 border-destructive/15",
    icon: "bg-destructive/20 text-[#fca5a5]",
    spark: "#ef4444",
  }, // text-red-300 equivalent
};

/** Deterministic decorative squiggle, seeded by label — not a data series, purely ornamental. */
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
        return {
          h,
          out: [...acc.out, `${acc.out.length * 20},${y.toFixed(1)}`],
        };
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

function KpiCard({
  icon,
  label,
  value,
  caption,
  tone,
  href,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone: KpiTone;
  href?: string;
}>) {
  const t = KPI_TONE[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[12px] font-medium text-white/70">
          {label}
        </p>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            t.icon
          )}
        >
          {icon}
        </span>
      </div>
      <p className="font-outfit text-[22px] font-bold leading-none text-white">
        {value}
      </p>
      <Sparkline seed={label} color={t.spark} />
      <p className="truncate text-[11.5px] text-white/50">{caption}</p>
    </>
  );

  const className = cn(
    "flex flex-col rounded-xl border bg-white/8 backdrop-blur-sm px-3 py-2",
    t.bg,
    href && "transition-colors hover:bg-white/12 cursor-pointer"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function PortfolioCommandCenter({
  summary,
}: Readonly<{ summary: PortfolioSummary }>) {
  const stats: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
    caption: string;
    tone: KpiTone;
    href?: string;
  }> = [
    {
      icon: <WalletIcon className="size-4" />,
      label: "Total Loan Book Value",
      value: formatCr(summary.totalLoanBookValue),
      caption: `${summary.loansOnBook} loans on book`,
      tone: "blue",
    },
    {
      icon: <BanknoteIcon className="size-4" />,
      label: "Total Collected",
      value: formatCr(summary.totalCollected),
      caption: `Principal ${formatCr(summary.collectedPrincipal)} · Interest ${formatCr(summary.collectedInterest)}`,
      tone: "mint",
    },
    {
      icon: <TrendingUpIcon className="size-4" />,
      label: "Total loans",
      value: String(summary.loansOnBook),
      caption: `${summary.activeLoans} active · ${summary.overdueLoans} overdue`,
      tone: "green",
      href: ROUTES.accounts,
    },
    {
      icon: <AlertTriangleIcon className="size-4" />,
      label: "Loans in IMGC bucket",
      value: String(summary.loansInImgcBucket),
      caption: "Needs processing by IMGC",
      tone: "amber",
      href: "/accounts?bucket=IMGC",
    },
    {
      icon: <AlertTriangleIcon className="size-4" />,
      label: "NPA Loans",
      value: String(summary.npaLoans),
      caption: `${formatCr(summary.npaGrossAmount)} Gross NPA · ${summary.npaRatioPct}% NPA Ratio`,
      tone: "rose",
      href: "/accounts?assetClass=NPA",
    },
  ];

  return (
    <div className="space-y-4">
      <CommandBand
        title="Loan Portfolio Command Center"
        subtitle="Portfolio health and collections at a glance"
        stats={[]}
        action={<RefreshButton />}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <KpiCard key={stat.label} {...stat} />
          ))}
        </div>
      </CommandBand>

      <div className="grid gap-4 xl:grid-cols-3">
        <CollectionsTrendCard trend={summary.collectionsTrend} />
        <StatusBreakdownCard
          breakdown={summary.statusBreakdown}
          npaLoans={summary.npaLoans}
          loansOnBook={summary.loansOnBook}
        />
        <UrgentCollectionsCard urgent={summary.urgent} />
      </div>
    </div>
  );
}

function Widget({
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
    <section className="flex flex-col rounded-xl border border-neutral-100 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-neutral-950">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col p-2">{children}</div>
    </section>
  );
}

function CollectionsTrendCard({
  trend,
}: Readonly<{ trend: PortfolioSummary["collectionsTrend"] }>) {
  const max = Math.max(1, ...trend.map((t) => t.amount));
  return (
    <Widget
      title="Collections Trend"
      subtitle="Successful payments by month, selected range"
    >
      <div className="flex flex-1 items-end gap-1.5 overflow-hidden">
        {trend.map((t) => (
          <div
            key={t.label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="w-full truncate text-center text-[10px] text-neutral-400">
              {t.amount > 0 ? formatCr(t.amount) : ""}
            </span>
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-t-md bg-[linear-gradient(180deg,#4f7bff_0%,#c7d6ff_100%)]"
                style={{ height: `${Math.max(4, (t.amount / max) * 100)}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-neutral-500">
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

const STATUS_COLOR: Record<"active" | "overdue" | "closed", string> = {
  active: "#22c55e",
  overdue: "#ef4444",
  closed: "#a3a3a3",
};

function StatusBreakdownCard({
  breakdown,
  npaLoans,
  loansOnBook,
}: Readonly<{
  breakdown: PortfolioSummary["statusBreakdown"];
  npaLoans: number;
  loansOnBook: number;
}>) {
  const total = breakdown.active + breakdown.overdue + breakdown.closed || 1;
  let acc = 0;
  const stops = (["active", "overdue", "closed"] as const).map((key) => {
    const start = (acc / total) * 100;
    acc += breakdown[key];
    const end = (acc / total) * 100;
    return `${STATUS_COLOR[key]} ${start}% ${end}%`;
  });

  return (
    <Widget
      title="Portfolio Status Breakdown"
      subtitle="Loans by current status"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${stops.join(", ")})` }}
        >
          <div className="grid size-14 place-items-center rounded-full bg-white text-center">
            <div>
              <p className="font-outfit text-[16px] font-bold leading-none text-neutral-950">
                {loansOnBook}
              </p>
              <p className="text-[10.5px] text-neutral-500">LOANS</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px] text-neutral-600">
          <Legend
            color={STATUS_COLOR.active}
            label={`Active (${breakdown.active})`}
          />
          <Legend
            color={STATUS_COLOR.overdue}
            label={`Overdue (${breakdown.overdue})`}
          />
          <Legend
            color={STATUS_COLOR.closed}
            label={`Closed (${breakdown.closed})`}
          />
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            NPA ({npaLoans})
          </span>
        </div>
      </div>
    </Widget>
  );
}

function Legend({ color, label }: Readonly<{ color: string; label: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function UrgentCollectionsCard({
  urgent,
}: Readonly<{ urgent: PortfolioSummary["urgent"] }>) {
  return (
    <Widget
      title="Urgent Collections & NPA"
      subtitle="Top overdue accounts by days late"
    >
      {urgent.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-[12.5px] text-neutral-500">
          Nothing overdue right now.
        </p>
      ) : (
        <ul className="-mx-1 flex-1 divide-y divide-neutral-100">
          {urgent.map((u) => (
            <li key={u.accountId}>
              <Link
                href={ROUTES.account(u.accountId)}
                className="flex items-center justify-between gap-2 px-1 py-0.5 hover:bg-neutral-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-neutral-950">
                    {u.borrowerName}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
                    <span>{u.loanNo}</span>
                    {u.npa && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                        NPA
                      </span>
                    )}
                    {u.overdue && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/12 px-1.5 py-0.5 font-semibold text-warning">
                        <AlertTriangleIcon className="size-2.5" /> Overdue
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-bold text-neutral-950">
                    {formatCr(u.outstandingAmount)}
                  </span>
                  <span
                    className={cn(
                      "block text-[11px]",
                      u.daysLate > 30 ? "text-destructive" : "text-neutral-500"
                    )}
                  >
                    {u.daysLate}d late
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${ROUTES.accounts}?npa=yes`}
        className="mt-2 inline-flex text-[12px] font-semibold text-brand-primary hover:underline"
      >
        View all overdue loans →
      </Link>
    </Widget>
  );
}
