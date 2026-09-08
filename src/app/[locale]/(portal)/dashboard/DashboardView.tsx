"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BuildingIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardListIcon,
  ClockIcon,
  FilePlus2Icon,
  LayersIcon,
  MessageSquareWarningIcon,
  SendIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";

import { getDashboardSummaryForLender } from "@/app/[locale]/(portal)/dashboard/actions";
import { CommandBand, Section } from "@/components/portal/CommandBand";
import { Donut } from "@/components/portal/Donut";
import { Panel } from "@/components/portal/Panel";
import { Sparkline } from "@/components/portal/PortfolioCommandCenter";
import { cn } from "@/lib/utils/twMergeUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DashboardSummary } from "@/services/portal/dashboard.server";
import type { Tile } from "@/services/portal/dashboard.server";
import type { LenderOrg, Role } from "@/server/mock/types";

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
  summary: DashboardSummary;
  /** IMGC only — the master list the hero banner's lender dropdown is populated from. Empty for a
   *  lender session, which has no "every lender" aggregate to narrow in the first place. */
  lenderOrgs: readonly LenderOrg[];
  /** IMGC only — the lender this render was already scoped to, restored from the cookie the
   *  hero banner's dropdown writes. `null` means the "Every Lender" aggregate. */
  initialLenderId?: string | null;
}>;

/** "Every Lender" in the dropdown maps to `null` (no filter) when calling the server action —
 *  a real lender org id is never this value, so it's safe as the sentinel. */
const EVERY_LENDER = "ALL";

export function DashboardView({
  role,
  summary: initialSummary,
  lenderOrgs,
  initialLenderId = null,
}: Props) {
  const isLender = role === "LENDER";
  const router = useRouter();

  // The hero banner's own lender filter — IMGC only. `summary` starts as whatever the server
  // rendered and is swapped out in place on selection, so switching lenders updates the whole
  // page (this band, Portfolio overview, Aging overview) without a navigation or full reload.
  // Seeded from the server render, which already applied the remembered lender — so the
  // dropdown and the numbers agree on first paint, with no flash of the aggregate view.
  const [selectedLenderId, setSelectedLenderId] = useState<string>(
    initialLenderId ?? EVERY_LENDER
  );
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [isPending, startTransition] = useTransition();

  const selectedLenderName =
    selectedLenderId === EVERY_LENDER
      ? null
      : (lenderOrgs.find((o) => o.id === selectedLenderId)?.name ?? null);

  function handleLenderChange(next: string) {
    setSelectedLenderId(next);
    startTransition(async () => {
      const nextSummary = await getDashboardSummaryForLender(
        next === EVERY_LENDER ? null : next
      );
      setSummary(nextSummary);
    });
  }

  return (
    <div className="space-y-4">
      {/* ── In progress claim cases — same band, both roles: a lender's own book, every
          lender's for IMGC ─────────────────────────────────────────────────────────── */}
      <CommandBand
        title={
          isLender
            ? "In progress claim cases"
            : `In progress claim cases — ${selectedLenderName ?? "every lender"}`
        }
        subtitle="Where every account currently stands"
        stats={[]}
        action={
          !isLender && lenderOrgs.length > 0 ? (
            <LenderFilterSelect
              lenderOrgs={lenderOrgs}
              value={selectedLenderId}
              onChange={handleLenderChange}
              disabled={isPending}
            />
          ) : undefined
        }
      >
        <div
          className={cn(
            "grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8 transition-opacity",
            isPending && "opacity-60"
          )}
        >
          {summary.progressTiles.map((tile) => (
            <ProgressTileCard key={tile.key} tile={tile} />
          ))}
        </div>
      </CommandBand>

      {/* ── Portfolio overview ───────────────────────────────────── */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.rings
            // "Active Loans", "Queries Awaiting Response" and "Rejected Documents" are no longer
            // shown on either dashboard — the same numbers stay reachable from the claim-stage
            // funnel band above and from the Claims / Document Retention screens themselves.
            .filter(
              (ring) => !["submitted", "queried", "rejected-docs"].includes(ring.key)
            )
            .map((ring) => {
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
                  <div className="flex flex-1 items-center justify-center py-1">
                    <div className="relative grid place-items-center">
                      <Donut
                        value={ring.value}
                        total={ring.total}
                        size={52}
                        stroke={8}
                        tone={tone ?? "brand"}
                      />
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <p
                          className={cn(
                            "font-outfit text-[15px] font-bold leading-none",
                            style?.value ?? "text-neutral-950"
                          )}
                        >
                          {ring.value}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="pb-1.5 text-center text-[11px] font-medium text-neutral-400">{pct}% of book</p>
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

            {/* ── Cases by lender (IMGC only) ─────────────────────────────────────
                Sits right after the rings, and reads the same lender-scoped summary they do —
                pick a lender in the hero banner and this narrows to that lender alone. */}
            {!isLender && summary.lenderCaseCounts && (
              <Panel
                size="compact"
                title="Cases by Lender"
                description={`${summary.lenderCaseCounts.reduce((sum, l) => sum + l.accounts, 0)} loans across ${summary.lenderCaseCounts.length} lender${summary.lenderCaseCounts.length === 1 ? "" : "s"}`}
                actions={
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-primary shadow-sm">
                    <BuildingIcon className="size-4" />
                  </span>
                }
                className="flex h-full flex-col overflow-hidden border-t-4 border-t-brand-primary bg-gradient-to-br from-brand-light/50 via-white to-white shadow-md transition-all duration-200"
              >
                {summary.lenderCaseCounts.length > 0 ? (
                  <ul className="max-h-[96px] flex-1 divide-y divide-neutral-100 overflow-y-auto px-3">
                    {(() => {
                      const booked = summary.lenderCaseCounts.reduce(
                        (sum, l) => sum + l.accounts,
                        0
                      );
                      return summary.lenderCaseCounts.map((l) => (
                        <li key={l.lenderOrgId}>
                          {/* Same `?lender=` param the KPI rings link with, so the row's number
                              and the grid it opens always agree. */}
                          <Link
                            href={`/dpd?lender=${encodeURIComponent(l.lenderOrgId)}`}
                            title={`${l.cases} of ${l.accounts} loans have a claim raised`}
                            className="-mx-1 flex items-center gap-1.5 rounded px-1 py-[2px] transition-colors hover:bg-brand-light/60"
                          >
                            <span className="min-w-0 flex-1 truncate text-[10.5px] leading-none text-neutral-700">
                              {l.lenderName}
                            </span>
                            <span className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                              <span
                                className="block h-full rounded-full bg-brand-primary"
                                style={{
                                  width: `${Math.round((l.accounts / (booked || 1)) * 100)}%`,
                                }}
                              />
                            </span>
                            <span className="shrink-0 text-right font-outfit text-[11px] font-bold leading-none tabular-nums text-neutral-950">
                              {l.accounts}
                            </span>
                          </Link>
                        </li>
                      ));
                    })()}
                  </ul>
                ) : (
                  <div className="flex flex-1 items-center justify-center py-5 text-[13px] text-neutral-500">
                    No cases yet
                  </div>
                )}
              </Panel>
            )}

            {/* ── Priority Accounts (Lender only) ────────────────────────────────── */}
            {isLender && summary.priorityAccounts && (
              <Panel
                size="compact"
                title="Priority Accounts"
                description="Top 5 critical loan accounts"
                className="flex h-full flex-col overflow-hidden border-t-4 border-t-brand-primary bg-white shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                {summary.priorityAccounts.length > 0 ? (
                  <div className="flex-1 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-neutral-50/50">
                        <TableRow>
                          <TableHead className="h-5 px-2 py-0 text-[12px] font-semibold text-neutral-600">Loan ID</TableHead>
                          <TableHead className="h-5 px-2 py-0 text-right text-[12px] font-semibold text-neutral-600">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.priorityAccounts.map((account) => (
                          <TableRow 
                            key={account.id}
                            className="cursor-pointer hover:bg-neutral-50 transition-colors"
                            onClick={() => router.push(`/dpd?query=${encodeURIComponent(account.loanNo)}`)}
                          >
                            <TableCell className="px-2 py-0 text-[12px] font-medium text-neutral-900">
                              {account.loanNo}
                            </TableCell>
                            <TableCell className="px-2 py-0 text-right text-[12px] text-neutral-900">
                              {new Intl.NumberFormat("en-IN", {
                                style: "currency",
                                currency: "INR",
                                maximumFractionDigits: 0,
                              }).format(account.loanAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center py-5 text-[13px] text-neutral-500">
                    No priority accounts
                  </div>
                )}
              </Panel>
            )}
          </div>
      </section>

      {/* ── Aging ────────────────────────────────────────────────── */}
      <Section
        title="Aging overview — open cases"
        subtitle="Days since anything last happened on the account"
      >
        <Panel size="compact" className="p-3 shadow-md">
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

            <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {summary.aging.map((band) => (
                <div
                  key={band.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-opacity",
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

/**
 * The hero banner's own lender filter — a compact translucent pill matching the dark band's
 * existing chip language (same `bg-white/…` treatment `BandStat`/`ProgressTileCard` use), not the
 * light-page filter pills the rest of the portal uses elsewhere (those assume a white background,
 * this one sits directly on the gradient). A plain native `<select>` — same choice `DpdClient`'s
 * own filter pills make — keeps it keyboard/native-accessible without pulling in the full popover
 * `Select` primitive for one field.
 */
function LenderFilterSelect({
  lenderOrgs,
  value,
  onChange,
  disabled,
}: Readonly<{
  lenderOrgs: readonly LenderOrg[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}>) {
  return (
    <div className="relative">
      <select
        aria-label="Filter by lender"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-full border border-white/20 bg-white/10 py-0 pr-7 pl-3 text-[12.5px] font-medium text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/15 focus:border-white/40 focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60 [&>option]:text-neutral-900"
      >
        <option value={EVERY_LENDER}>Every Lender</option>
        {lenderOrgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/70" />
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
  neutral: { bg: "border-neutral-200", icon: "bg-neutral-100 text-neutral-600", spark: "#9ca3af" },
  info: { bg: "border-info/30", icon: "bg-info/10 text-info", spark: "#3b82f6" },
  teal: { bg: "border-success/30", icon: "bg-success/10 text-success-600", spark: "#14b8a6" },
  violet: { bg: "border-brand-primary/30", icon: "bg-brand-primary/10 text-brand-primary", spark: "#8b5cf6" },
  warning: { bg: "border-warning/30", icon: "bg-warning/10 text-warning", spark: "#f59e0b" },
  success: { bg: "border-success/30", icon: "bg-success/10 text-success-600", spark: "#22c55e" },
  danger: { bg: "border-destructive/30", icon: "bg-destructive/10 text-destructive", spark: "#ef4444" },
};

function ProgressTileCard({ tile }: Readonly<{ tile: Tile }>) {
  const t = PROGRESS_TILE_TONE[tile.tone];
  const inner = (
    <>
      <div className="flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] font-medium text-neutral-500">{tile.label}</p>
        {PROGRESS_TILE_ICON[tile.key] && (
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", t.icon)}>
            {PROGRESS_TILE_ICON[tile.key]}
          </span>
        )}
      </div>
      <p className="font-outfit text-[20px] font-bold leading-none text-neutral-900">{tile.value}</p>
      <Sparkline seed={tile.key} color={t.spark} />
    </>
  );
  const className = cn(
    "flex flex-col gap-1 rounded-xl border bg-white px-2.5 py-2 shadow-sm transition-all duration-300",
    t.bg,
    tile.href && "hover:-translate-y-1 hover:shadow-md hover:bg-neutral-50 cursor-pointer"
  );
  return tile.href ? (
    <Link href={tile.href} className={className} title={tile.label}>
      {inner}
    </Link>
  ) : (
    <div className={className} title={tile.label}>{inner}</div>
  );
}

