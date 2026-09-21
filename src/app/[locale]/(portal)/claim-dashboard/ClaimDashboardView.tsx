"use client";

import { useState } from "react";
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-neutral-200 bg-white py-1 pl-2.5 pr-7 text-[11.5px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/* ── Widget 1: month-on-month claim status ─────────────────────────── */

function MonthlyBars({
  data,
  status,
  unit,
}: Readonly<{ data: ClaimDashboardData["monthly"]; status: MonthlyStatusKey; unit: "Lakhs" | "Crores" }>) {

  const formattedData = data.map(d => ({
    ...d,
    amountInUnit: unit === "Lakhs" ? d.amount / 100000 : d.amount / 10000000
  }));

  const rawMaxCount = Math.max(1, ...formattedData.map((d) => d.count));
  const rawMaxAmount = Math.max(0.1, ...formattedData.map((d) => d.amountInUnit));
  
  const maxCount = Math.max(4, Math.ceil(rawMaxCount / 4) * 4);
  
  const amtMag = Math.pow(10, Math.floor(Math.log10(rawMaxAmount)));
  const stepAmt = Math.max(amtMag, Math.ceil(rawMaxAmount / 4 / amtMag) * amtMag);
  const maxAmount = stepAmt * 4;
  
  const W = 640;
  const H = 175;
  const padL = 56;
  const padR = 56;
  const padB = 36;
  const padT = 24;
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;
  const step = plotW / data.length;
  const barW = Math.min(46, step * 0.6);

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const linePoints = formattedData.map((d, i) => {
    const x = padL + i * step + step / 2;
    const y = padT + plotH - (d.count / maxCount) * plotH;
    return `${x},${y}`;
  }).join(" L ");

  return (
    <div className="flex flex-col h-full w-full">
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="min-w-[520px] w-full"
          role="img"
          aria-label="Month-on-month claim counts and amounts"
        >
          {/* Axis Titles */}
          <text x={padL - 6} y={padT - 8} textAnchor="end" className="fill-brand-primary text-[9px] font-bold uppercase tracking-wider">Amount</text>
          <text x={W - padR + 6} y={padT - 8} textAnchor="start" className="fill-[#10b981] text-[9px] font-bold uppercase tracking-wider">Count</text>

          {ticks.map((f, i) => {
            const y = padT + plotH - f * plotH;
            const amtTick = Number((maxAmount * f).toFixed(2));
            const countTick = Math.round(maxCount * f);
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-neutral-200)" strokeWidth={1} />
                <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-brand-primary text-[9px] font-medium">{amtTick}</text>
                <text x={W - padR + 6} y={y + 3} textAnchor="start" className="fill-[#10b981] text-[9px] font-medium">{countTick}</text>
              </g>
            );
          })}
          
          {/* Loop 1: Bars */}
          {formattedData.map((d, i) => {
            const h = (d.amountInUnit / maxAmount) * plotH;
            const x = padL + i * step + (step - barW) / 2;
            const y = padT + plotH - h;
            return (
              <g key={`bar-${d.month}`}>
                <rect x={x} y={y} width={barW} height={Math.max(h, d.amountInUnit > 0 ? 2 : 0)} rx={3} fill="var(--brand-primary)">
                  <title>{`${d.label} Amount: ${d.amountInUnit.toFixed(2)} ${unit}`}</title>
                </rect>
              </g>
            );
          })}

          <path d={`M ${linePoints}`} fill="none" stroke="#10b981" strokeWidth={2.5} pointerEvents="none" />
          
          {/* Loop 2: Points & X-Axis Labels */}
          {formattedData.map((d, i) => {
            const cx = padL + i * step + step / 2;
            const cy = padT + plotH - (d.count / maxCount) * plotH;
            return (
              <g key={`point-${d.month}`}>
                <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke="#10b981" strokeWidth={2} className="cursor-pointer hover:stroke-[3px] transition-all">
                  <title>{`${d.label} Count: ${d.count}`}</title>
                </circle>
                <text x={cx} y={padT + plotH + 14} textAnchor="middle" className="fill-neutral-500 text-[10px] pointer-events-none">{d.label}</text>
              </g>
            );
          })}

          {/* Loop 3: Data Labels (Rendered last with collision detection) */}
          {formattedData.map((d, i) => {
            if (d.amountInUnit === 0 && d.count === 0) return null;
            
            const h = (d.amountInUnit / maxAmount) * plotH;
            const barY = padT + plotH - h;
            const cx = padL + i * step + step / 2;
            const cy = padT + plotH - (d.count / maxCount) * plotH;

            const amtY = barY - 4;
            const countY = cy - 8;

            let amtX = cx;
            let countX = cx;
            let amtAnchor: "middle" | "end" | "start" = "middle";
            let countAnchor: "middle" | "end" | "start" = "middle";

            // If labels are vertically too close, separate them horizontally!
            if (d.amountInUnit > 0 && d.count > 0 && Math.abs(amtY - countY) < 14) {
              amtX = cx - 6;
              amtAnchor = "end";
              
              countX = cx + 6;
              countAnchor = "start";
            }

            return (
              <g key={`labels-${d.month}`}>
                {d.amountInUnit > 0 && (
                  <text 
                    x={amtX} y={amtY} textAnchor={amtAnchor} 
                    className="fill-brand-primary text-[9px] font-bold pointer-events-none"
                    style={{ stroke: '#fff', strokeWidth: 1.5, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                  >
                    {Number(d.amountInUnit.toFixed(1))}
                  </text>
                )}
                {d.count > 0 && (
                  <text 
                    x={countX} y={countY} textAnchor={countAnchor} 
                    className="fill-[#10b981] text-[10px] font-bold pointer-events-none"
                    style={{ stroke: '#fff', strokeWidth: 1.5, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                  >
                    {d.count}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Legend at the bottom center */}
          <g transform={`translate(${W / 2 - 40}, ${H - 12})`}>
             <rect x={-36} y={-8} width={10} height={10} rx={2} fill="var(--brand-primary)" />
             <text x={-20} y={0} fontSize={10} fill="currentColor" className="text-neutral-500 font-medium">Amount</text>
             <circle cx={34} cy={-3} r={4} fill="#fff" stroke="#10b981" strokeWidth={2} />
             <text x={44} y={0} fontSize={10} fill="currentColor" className="text-neutral-500 font-medium">Count</text>
          </g>
        </svg>
      </div>
      
      {/* Summary KPI Card */}
      <div className="mt-1 flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-2 shadow-sm mx-2 mb-1">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
              Total {status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Claims"}
            </h4>
            <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-primary border border-brand-primary/20">
              Current Financial Year
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-neutral-800">
              {formattedData.reduce((acc, d) => acc + d.count, 0)}
            </span>
            <span className="text-[10px] font-medium text-neutral-500">Claims</span>
          </div>
        </div>
        <div className="text-right">
          <h4 className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
            Total Amount ({unit})
          </h4>
          <div className="flex justify-end">
            <span className="text-lg font-bold text-brand-primary">
              {Number(formattedData.reduce((acc, d) => acc + d.amountInUnit, 0).toFixed(2))}
            </span>
          </div>
        </div>
      </div>
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
            <th className="px-1 py-1.5 font-medium">Loan ID</th>
            <th className="px-1 py-1.5 font-medium">Applicant</th>
            <th className="px-1 py-1.5 font-medium">Status</th>
            <th className="px-1 py-1.5 text-right font-medium">
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
              <td className="px-1 py-1.5 font-medium text-neutral-900">
                {row.loanId}
              </td>
              <td className="px-1 py-1.5">{row.applicant}</td>
              <td className="px-1 py-1.5 text-neutral-500">{row.status}</td>
              <td className="px-1 py-1.5 text-right tabular-nums">
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
  const [unit, setUnit] = useState<"Lakhs" | "Crores">("Lakhs");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function openClaim(claimId: string) {
    // A lender lands on the same Track Claim screen the Claims grid opens (the single view, which
    // opens on Status & Query) — not a second, older layout of the same claim.
    router.push(
      data.isLender
        ? `${ROUTES.claimDetails(claimId)}?view=single`
        : `${ROUTES.claimDetails(claimId)}?tab=status`
    );
  }

  // The lender lens itself lives in the hero band (`ClaimDashboardLenderPicker`), same slot the
  // main Dashboard uses; it writes the same `?lender=` param this component reads back to label
  // the widgets.

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        size="compact"
        title="Month-on-month claim status"
        actions={
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setUnit("Lakhs")}
                className={`px-2.5 py-1 text-[10.5px] font-medium border border-neutral-200 rounded-l-lg transition-colors ${unit === "Lakhs" ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}
              >
                Lakhs
              </button>
              <button
                type="button"
                onClick={() => setUnit("Crores")}
                className={`px-2.5 py-1 text-[10.5px] font-medium border border-l-0 border-neutral-200 rounded-r-lg transition-colors ${unit === "Crores" ? "bg-brand-primary text-white border-brand-primary border-l-brand-primary" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}
              >
                CRs
              </button>
            </div>
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
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-x-auto px-2 py-2 min-h-0">
          <MonthlyBars data={data.monthly} status={status} unit={unit} />
        </div>
      </Panel>

      <Panel
        size="compact"
        title={data.isLender ? "Query Raised · Not Responded" : "Claim Under Review"}
        className="flex flex-col h-full"
      >
        <div className="relative flex-1 min-h-[175px]">
          <div className="absolute inset-0 overflow-auto px-4 py-2">
            {data.isLender ? (
              <LenderUnderProgressTable
                rows={data.lenderUnderProgress}
                onSelect={openClaim}
              />
            ) : (
              <LenderProgressBars rows={data.byLender} />
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
