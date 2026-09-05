"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";

import { ClaimRowActions } from "@/components/portal/ClaimRowActions";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationNumbers } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EligibleRow } from "@/app/[locale]/(portal)/initiate-claim/page";
import type { ClaimStatus } from "@/server/mock/types";

type SortKey = "loanNo" | "borrowerName" | "loanAmount" | "applicationDate";
type SortDirection = "asc" | "desc" | null;

/** The status filter's own values — "not started" isn't a real `ClaimStatus`, it's the absence
 *  of a claim, so it needs a value of its own alongside the real ones. */
const STATUS_OPTIONS = ["ALL", "NOT_STARTED", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "APPROVED", "REJECTED"] as const;

/** 4500000 becomes 45,00,000 — Indian grouping, no currency symbol (matches the reference). */
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(v: (typeof STATUS_OPTIONS)[number]): string {
  if (v === "ALL") return "All statuses";
  if (v === "NOT_STARTED") return "Not started";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function purposeDisplay(v: string): string {
  return v === "ALL" ? "All purposes" : v;
}

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: EligibleRow[]): void {
  const headers = ["Loan ID", "Applicant", "Purpose", "Amount", "Login Date", "Status"];
  const lines = rows.map((a) =>
    [
      a.loanNo,
      a.borrowerName,
      a.product,
      a.loanAmount,
      a.applicationDate.slice(0, 10),
      a.claim ? a.claim.status : "NOT_STARTED",
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `eligible-cases-${new Date().toISOString().slice(0, 10)}.csv`;
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
    return <ArrowUpDownIcon className="ml-1 size-3.5 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-1 size-3.5 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-1 size-3.5 text-neutral-800" />
  );
};

const SortableTableHead = ({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
}) => {
  const handleClick = useCallback(() => onToggle(column), [column, onToggle]);
  return (
    <TableHead
      onClick={handleClick}
      className="h-9 cursor-pointer select-none px-2.5 transition-colors hover:bg-neutral-50"
    >
      <div className="flex items-center">
        {label}
        <SortIcon
          column={column}
          sortKey={sortKey}
          sortDirection={sortDirection}
        />
      </div>
    </TableHead>
  );
};

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

export function EligibleCasesClient({
  accounts,
}: Readonly<{ accounts: EligibleRow[] }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
  const [product, setProduct] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const products = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.product))).sort(),
    [accounts]
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      setSortDirection((prevDir) => {
        if (prevKey === key) {
          if (prevDir === "asc") return "desc";
          if (prevDir === "desc") {
            setSortKey(null);
            return null;
          }
        }
        return "asc";
      });
      return key;
    });
  }, []);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setPage(1);
    },
    []
  );

  const handleStatusChange = useCallback((v: (typeof STATUS_OPTIONS)[number]) => {
    setStatus(v);
    setPage(1);
  }, []);

  const handleProductChange = useCallback((v: string) => {
    setProduct(v);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);

  const rows = useMemo(() => {
    // NPA-only grid.
    let result = accounts.filter((a) => a.npa);

    if (status !== "ALL") {
      result = result.filter((a) =>
        status === "NOT_STARTED"
          ? !a.claim
          : a.claim?.status === (status as ClaimStatus)
      );
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
          case "applicationDate":
            valA = a.applicationDate;
            valB = b.applicationDate;
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
  }, [accounts, query, status, product, sortKey, sortDirection]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExport = useCallback(() => downloadCsv(rows), [rows]);

  return (
    <Panel
      title={`${rows.length} eligible case${rows.length === 1 ? "" : "s"}`}
      description="NPA accounts your organisation can raise a claim on."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport}>
          <DownloadIcon /> Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Loan ID or applicant"
            aria-label="Search cases"
            className="h-8 w-[230px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <FilterSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={handleStatusChange}
          display={statusLabel}
        />
        <FilterSelect
          label="Purpose"
          options={["ALL", ...products] as const}
          value={product}
          onChange={handleProductChange}
          display={purposeDisplay}
        />
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="loanNo"
                label="Loan ID"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="borrowerName"
                label="Applicant"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-9 px-2.5">Purpose</TableHead>
              <SortableTableHead
                column="loanAmount"
                label="Amount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="applicationDate"
                label="Login Date"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-9 px-2.5">Status</TableHead>
              <TableHead className="h-9 px-2.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No eligible cases match your search.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="px-2.5 py-2">
                    <span className="inline-flex items-center rounded-full bg-info/12 px-2.5 py-0.5 text-[12px] font-semibold text-info">
                      {a.loanNo}
                    </span>
                  </TableCell>
                  <TableCell className="px-2.5 py-2 font-medium text-neutral-900">
                    {a.borrowerName}
                  </TableCell>
                  <TableCell className="px-2.5 py-2 text-neutral-500">{a.product}</TableCell>
                  <TableCell className="px-2.5 py-2">
                    <span className="inline-flex items-center rounded-full bg-success-50 px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-success-700">
                      {inr.format(a.loanAmount)}
                    </span>
                  </TableCell>
                  <TableCell className="px-2.5 py-2 tabular-nums text-neutral-500">
                    {date(a.applicationDate)}
                  </TableCell>
                  <TableCell className="px-2.5 py-2">
                    {a.claim ? (
                      <StatusPill status={a.claim.status} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600">
                        <span className="size-1.5 rounded-full bg-neutral-400" />
                        Not started
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-2 text-right">
                    <ClaimRowActions
                      accountId={a.id}
                      claimId={a.claim?.id}
                      claimNo={a.claim?.claimNo}
                      action={a.claimAction}
                      reason={a.claimReason}
                      hasProgress={a.claim?.hasProgress}
                    />
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
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger size="sm" className="h-8 w-[70px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="hidden sm:inline">
            Total {rows.length} case{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-neutral-500 sm:inline">
            Page {currentPage} of {pageCount}
          </span>
          <PaginationNumbers
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </div>
      </div>
    </Panel>
  );
}
