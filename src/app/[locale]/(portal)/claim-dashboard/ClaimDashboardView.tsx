"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { Panel } from "@/components/portal/Panel";
import { ROUTES } from "@/constants/route";
import {
  MONTH_WINDOWS,
  MONTHLY_STATUS_OPTIONS,
  type ClaimDashboardData,
  type MonthWindow,
  type MonthlyStatusKey,
} from "@/services/portal/claimDashboard";

type Props = Readonly<{
  data: ClaimDashboardData;
  status: MonthlyStatusKey;
  months: MonthWindow;
  lenderOrgId: string | null;
}>;

/** A pill `<select>` matching the filters on every other grid in the portal. */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: Readonly<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}>) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/* ── Widget 1: month-on-month claim status ─────────────────────────── */

function MonthlyBars({
  data,
}: Readonly<{ data: ClaimDashboardData["monthly"] }>) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 640;
  const H = 200;
  const padL = 28;
  const padB = 24;
  const padT = 12;
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const step = plotW / data.length;
  const barW = Math.min(46, step * 0.6);

  // Four horizontal gridlines at even fractions of the max.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-w-[520px] w-full"
        role="img"
        aria-label="Month-on-month claim counts"
      >
        {ticks.map((t, i) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - 8}
                y1={y}
                y2={y}
                stroke="var(--color-neutral-200)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[9px]"
              >
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.count / max) * plotH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.count > 0 ? 2 : 0)}
                rx={3}
                fill="var(--brand-primary)"
              />
              {d.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-neutral-700 text-[9.5px] font-semibold"
                >
                  {d.count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-neutral-500 text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Widget 2: in-progress claims, lender-wise ─────────────────────── */

function LenderProgressBars({
  rows,
}: Readonly<{ rows: ClaimDashboardData["byLender"] }>) {
  const max = Math.max(1, ...rows.map((r) => r.inProgress));
  if (rows.every((r) => r.total === 0)) {
    return (
      <p className="px-1 py-6 text-center text-[12.5px] text-neutral-500">
        No claims for this selection.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.lenderOrgId} className="flex items-center gap-2">
          <span className="w-40 shrink-0 truncate text-[12px] text-neutral-700">
            {r.lenderName}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100">
            <div
              className="h-full rounded bg-info/70"
              style={{ width: `${(r.inProgress / max) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-600">
            <span className="font-semibold text-neutral-900">
              {r.inProgress}
            </span>
            <span className="text-neutral-400"> / {r.total}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatQueryDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function LenderUnderProgressTable({
  rows,
  onSelect,
}: Readonly<{
  rows: ClaimDashboardData["lenderUnderProgress"];
  onSelect: (claimId: string) => void;
}>) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[12.5px] text-neutral-500">
        No claims for this selection.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[430px] text-left text-[12px]">
        <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-1 py-2 font-medium">Loan ID</th>
            <th className="px-1 py-2 font-medium">Applicant</th>
            <th className="px-1 py-2 text-right font-medium">
              Latest Query Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <tr
              key={row.claimId}
              className="cursor-pointer text-neutral-700 transition-colors hover:bg-neutral-50"
              onClick={() => onSelect(row.claimId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.claimId);
                }
              }}
              tabIndex={0}
              role="link"
            >
              <td className="px-1 py-3 font-medium text-neutral-900">
                {row.loanId}
              </td>
              <td className="px-1 py-3">{row.applicant}</td>
              <td className="px-1 py-3 text-right tabular-nums">
                {formatQueryDate(row.latestQueryDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── the view ─────────────────────────────────────────────────────── */

export function ClaimDashboardView({
  data,
  status,
  months,
  lenderOrgId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  const statusLabel =
    MONTHLY_STATUS_OPTIONS.find((o) => o.key === status)?.label ??
    "Claim initiated";
  const selectedLenderName =
    data.lenders.find((l) => l.id === lenderOrgId)?.name ?? "All lenders";

  function openClaim(claimId: string) {
    router.push(`${ROUTES.claimDetails(claimId)}?tab=status`);
  }

  // The lender lens itself lives in the hero band (`ClaimDashboardLenderPicker`), same slot the
  // main Dashboard uses; it writes the same `?lender=` param this component reads back to label
  // the widgets.

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        size="compact"
        title="Month-on-month claim status"
        description={
          data.isLender
            ? undefined
            : `Claims that reached "${statusLabel}" in each of the last ${months} months${
                data.canFilterByLender ? ` — ${selectedLenderName}` : ""
              }.`
        }
        actions={
          <div className="flex items-center gap-2">
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => setParam("status", v)}
            >
              {MONTHLY_STATUS_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Time window"
              value={String(months)}
              onChange={(v) => setParam("months", v)}
            >
              {MONTH_WINDOWS.map((m) => (
                <option key={m} value={m}>
                  Last {m} months
                </option>
              ))}
            </FilterSelect>
          </div>
        }
      >
        <div className="max-h-[280px] overflow-auto px-4 py-2">
          <MonthlyBars data={data.monthly} />
        </div>
      </Panel>

      <Panel
        size="compact"
        title={data.isLender ? "Query Raised · Not Responded" : "Query Raised"}
        description={
          !data.isLender
            ? data.canFilterByLender
              ? `Claims currently submitted but not yet decided${
                  lenderOrgId ? ` — ${selectedLenderName}` : ", by lender"
                }.`
              : "Your claims currently submitted but not yet decided."
            : undefined
        }
      >
        <div className="max-h-[280px] overflow-auto px-4 py-3">
          {data.isLender ? (
            <LenderUnderProgressTable
              rows={data.lenderUnderProgress}
              onSelect={openClaim}
            />
          ) : (
            <LenderProgressBars rows={data.byLender} />
          )}
        </div>
      </Panel>
    </div>
  );
}
