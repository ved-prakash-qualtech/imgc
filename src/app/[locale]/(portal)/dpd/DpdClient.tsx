/* eslint-disable security/detect-object-injection, react-perf/jsx-no-new-function-as-prop */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  DownloadIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";

import { ClaimRowActions } from "@/components/portal/ClaimRowActions";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import { PaginationNumbers } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DPD_BANDS, DPD_BAND_LABEL, dpdInBand, formatDpd, type DpdBand } from "@/lib/dpd";
import { cn } from "@/lib/utils/twMergeUtils";
import type { EligibleRow } from "@/app/[locale]/(portal)/initiate-claim/page";

/** Same "not started" idea the Claim grid uses (a claim record can exist before the lender has
 *  actually done anything with it) — kept local rather than imported, since the two grids' rows
 *  come from different server-side queries and this is the only place this screen needs it. */
function isNotStarted(a: EligibleRow): boolean {
  return !a.claim || !a.claim.hasProgress;
}

const STATUS_OPTIONS = [
  "ALL",
  "NOT_STARTED",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "DOCUMENTS_RESUBMITTED",
  "APPROVED",
  "REJECTED",
  "CLOSED",
] as const;

function statusLabel(v: (typeof STATUS_OPTIONS)[number]): string {
  if (v === "ALL") return "Claim Status";
  if (v === "NOT_STARTED") return "Not initiated";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function purposeDisplay(v: string): string {
  return v === "ALL" ? "All products" : v;
}

function dpdBandDisplay(v: DpdBand): string {
  return v === "ALL" ? "All DPD" : DPD_BAND_LABEL[v];
}

type SortKey = "loanNo" | "borrowerName" | "loanAmount" | "outstandingAmount" | "dpd" | "product" | "npa" | "loanStatus" | "lastUpdatedAt";
type SortDirection = "asc" | "desc" | null;

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function date(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: EligibleRow[]): void {
  const headers = [
    "Loan Account",
    "Customer",
    "Product",
    "Loan Amount",
    "Outstanding",
    "DPD",
    "NPA",
    "Claim Status",
    "Last Updated",
  ];
  const lines = rows.map((a) =>
    [
      a.loanNo,
      a.borrowerName,
      a.product,
      a.loanAmount,
      a.outstandingAmount,
      a.dpd ?? "",
      a.npa ? "Yes" : "No",
      isNotStarted(a) ? "NOT_STARTED" : (a.claim as NonNullable<EligibleRow["claim"]>).status,
      a.claim?.lastUpdatedAt.slice(0, 10) ?? "",
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dpd-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const SortIcon = ({
  column,
  sortKey,
  sortDirection,
}: {
  column: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
}) => {
  if (sortKey !== column)
    return <ArrowUpDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  );
};

const SortableTableHead = ({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
  title,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
  title?: string;
}) => (
  <TableHead
    onClick={() => onToggle(column)}
    title={title}
    className="h-8 cursor-pointer select-none px-1.5 text-[10.5px] transition-colors hover:bg-neutral-50"
  >
    <div className="flex items-center">
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </div>
  </TableHead>
);

function SummaryCard({
  label,
  value,
  tone,
}: Readonly<{
  label: string;
  value: number;
  tone: "neutral" | "info" | "warning" | "danger";
}>) {
  const toneClass = {
    neutral: "text-neutral-950",
    info: "text-info",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
      <p className={cn("font-outfit text-[24px] font-bold leading-none", toneClass)}>
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-neutral-500">{label}</p>
    </div>
  );
}

const LOAN_STATUSES = [
  "New",
  "Underwriting",
  "Pre Offer",
  "Queried",
  "Rejected",
  "Expired",
  "Approved",
  "Invoiced",
] as const;

export function DpdClient({ accounts }: Readonly<{ accounts: EligibleRow[] }>) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [dpdBand, setDpdBand] = useState<DpdBand>("ALL");
  const [npaFilter, setNpaFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [loanStatusFilter, setLoanStatusFilter] = useState<
    (typeof LOAN_STATUSES)[number] | "ALL"
  >(() => {
    const param = searchParams.get("loanStatus");
    return (LOAN_STATUSES as readonly string[]).includes(param ?? "")
      ? (param as (typeof LOAN_STATUSES)[number])
      : "ALL";
  });
  const [product, setProduct] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const products = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.product))).sort(),
    [accounts]
  );

  // Dynamically computed from this lender's own dataset — never hard-coded — and always over
  // the full account set (not the currently-filtered rows), so the cards read as a stable summary
  // rather than shifting every time a filter is touched.
  const summary = useMemo(() => {
    let total = 0;
    let d1to30 = 0;
    let d31to60 = 0;
    let d61to90 = 0;
    let d90plus = 0;
    for (const a of accounts) {
      if (a.dpd === undefined) continue;
      total += 1;
      if (dpdInBand(a.dpd, "1-30")) d1to30 += 1;
      else if (dpdInBand(a.dpd, "31-60")) d31to60 += 1;
      else if (dpdInBand(a.dpd, "61-90")) d61to90 += 1;
      else if (dpdInBand(a.dpd, "90+")) d90plus += 1;
    }
    return { total, d1to30, d31to60, d61to90, d90plus };
  }, [accounts]);

  // See EligibleCasesClient.tsx's `toggleSort` for why this reads `sortKey`/`sortDirection` from
  // the render closure instead of nesting one setState call inside the other's updater — that
  // pattern skipped "descending" entirely under React 18's double-invocation of updaters.
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDirection("asc");
        return;
      }
      if (sortDirection === "asc") {
        setSortDirection("desc");
        return;
      }
      setSortKey(null);
      setSortDirection(null);
    },
    [sortKey, sortDirection]
  );

  const rows = useMemo(() => {
    let result = accounts;

    if (dpdBand !== "ALL") {
      result = result.filter((a) => dpdInBand(a.dpd, dpdBand));
    }
    if (npaFilter !== "ALL") {
      result = result.filter((a) => (npaFilter === "YES" ? a.npa : !a.npa));
    }
    if (loanStatusFilter !== "ALL") {
      result = result.filter((a) => a.loanStatus === loanStatusFilter);
    }
    if (product !== "ALL") {
      result = result.filter((a) => a.product === product);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.loanNo.toLowerCase().includes(q) ||
          a.borrowerName.toLowerCase().includes(q)
      );
    }

    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number;
        let valB: string | number;
        switch (sortKey) {
          case "loanNo":
            valA = a.loanNo;
            valB = b.loanNo;
            break;
          case "borrowerName":
            valA = a.borrowerName;
            valB = b.borrowerName;
            break;
          case "loanAmount":
            valA = a.loanAmount;
            valB = b.loanAmount;
            break;
          case "outstandingAmount":
            valA = a.outstandingAmount;
            valB = b.outstandingAmount;
            break;
          case "dpd":
            // Numeric, never string — DPD sorts as a number, not lexicographically.
            valA = a.dpd ?? -1;
            valB = b.dpd ?? -1;
            break;
          case "product":
            valA = a.product;
            valB = b.product;
            break;
          case "npa":
            valA = a.npa ? 1 : 0;
            valB = b.npa ? 1 : 0;
            break;
          case "loanStatus":
            valA = a.loanStatus;
            valB = b.loanStatus;
            break;
          case "lastUpdatedAt":
            valA = a.claim?.lastUpdatedAt ?? "";
            valB = b.claim?.lastUpdatedAt ?? "";
            break;
        }
        if (typeof valA === "string" && typeof valB === "string") {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [accounts, query, dpdBand, npaFilter, loanStatusFilter, product, sortKey, sortDirection]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  }, []);
  const handleDpdBandChange = useCallback((v: DpdBand) => {
    setDpdBand(v);
    setPage(1);
  }, []);
  const handleNpaFilterChange = useCallback((v: "ALL" | "YES" | "NO") => {
    setNpaFilter(v);
    setPage(1);
  }, []);
  const handleLoanStatusChange = useCallback((v: typeof LOAN_STATUSES[number] | "ALL") => {
    setLoanStatusFilter(v);
    setPage(1);
  }, []);
  const handleProductChange = useCallback((v: string) => {
    setProduct(v);
    setPage(1);
  }, []);
  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "10"));
    setPage(1);
  }, []);
  const handleReset = useCallback(() => {
    // Filters only — never touches claim/loan/NPA/DPD data itself.
    setQuery("");
    setDpdBand("ALL");
    setNpaFilter("ALL");
    setLoanStatusFilter("ALL");
    setProduct("ALL");
    setSortKey(null);
    setSortDirection(null);
    setPage(1);
  }, []);
  const handleExport = useCallback(() => downloadCsv(rows), [rows]);

  return (
    <div className="space-y-4">
      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="1–30 DPD" value={summary.d1to30} tone="info" />
        <SummaryCard label="31–60 DPD" value={summary.d31to60} tone="warning" />
        <SummaryCard label="61–90 DPD" value={summary.d61to90} tone="warning" />
        <SummaryCard label="90+ DPD" value={summary.d90plus} tone="danger" />
      </div>

      <Panel
        title={`${rows.length} account${rows.length === 1 ? "" : "s"}`}
        description="View and manage all the loans"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon /> Export CSV
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={handleQueryChange}
              placeholder="Loan account or customer name"
              aria-label="Search DPD accounts"
              className="h-8 w-[230px] rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <FilterSelect
            label="DPD"
            options={DPD_BANDS}
            value={dpdBand}
            onChange={handleDpdBandChange}
            display={dpdBandDisplay}
          />
          <FilterSelect
            label="NPA"
            options={["ALL", "YES", "NO"] as const}
            value={npaFilter}
            onChange={handleNpaFilterChange}
            display={(v) => (v === "ALL" ? "NPA" : v === "YES" ? "Yes" : "No")}
          />
          <FilterSelect
            label="Loan Status"
            options={["ALL", ...LOAN_STATUSES] as const}
            value={loanStatusFilter}
            onChange={handleLoanStatusChange}
            display={(v) => (v === "ALL" ? "All Loan Statuses" : v)}
          />
          <FilterSelect
            label="Product"
            options={["ALL", ...products] as const}
            value={product}
            onChange={handleProductChange}
            display={purposeDisplay}
          />
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcwIcon /> Reset Filters
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="loanNo" label="Loan Account" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="borrowerName" label="Customer" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="product" label="Product" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="loanAmount" label="Loan Amount" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="outstandingAmount" label="Outstanding" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="dpd" label="DPD" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} title="DPD = Days Past Due" />
                <SortableTableHead column="npa" label="NPA" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="loanStatus" label="Loan Status" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="lastUpdatedAt" label="Last Updated" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />

              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-14 text-center">
                    <CalendarClockIcon className="mx-auto mb-2 size-6 text-neutral-300" />
                    <p className="text-[13px] font-medium text-neutral-700">No accounts found</p>
                    <p className="mt-0.5 text-[12.5px] text-neutral-500">
                      No loans match the selected DPD criteria.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                currentRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="px-1.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-950">
                      {a.loanNo}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap">
                      {a.borrowerName}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                      {a.product}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-700">
                      {inr.format(a.loanAmount)}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-700">
                      {inr.format(a.outstandingAmount)}
                    </TableCell>
                    <TableCell
                      title="DPD = Days Past Due"
                      className="px-1.5 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-700"
                    >
                      {formatDpd(a.dpd)}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-medium whitespace-nowrap",
                          a.npa
                            ? "bg-danger-50 text-danger-700"
                            : "bg-success-50 text-success-700"
                        )}
                      >
                        {a.npa ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-700">
                      {a.loanStatus}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-500">
                      {date(a.claim?.lastUpdatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-5 py-2">
          <div className="flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger size="sm" className="h-8 w-[70px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="hidden sm:inline">
              Total {rows.length} account{rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] text-neutral-500 sm:inline">
              Page {currentPage} of {pageCount}
            </span>
            <PaginationNumbers page={currentPage} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  display,
}: Readonly<{
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  display: (value: T) => string;
}>) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {display(option)}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
