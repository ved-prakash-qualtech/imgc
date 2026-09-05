"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  DownloadIcon,
  RadarIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";

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
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ClaimRow } from "@/services/portal/claimFlow.server";

const STATUS_OPTIONS = [
  "ALL",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "DOCUMENTS_RESUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type SortKey = "claimNo" | "submittedAt" | "lastUpdatedAt";
type SortDirection = "asc" | "desc" | null;

function when(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(v: (typeof STATUS_OPTIONS)[number]): string {
  if (v === "ALL") return "All statuses";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: ClaimRow[], isLender: boolean): void {
  const headers = [
    "Claim No",
    "Account",
    "Customer",
    ...(isLender ? [] : ["Lender"]),
    "Claim Type",
    "Submitted",
    "Status",
    "Last Updated",
    "Bucket",
  ];
  const lines = rows.map((c) =>
    [
      c.claimNo,
      c.caseId,
      c.customerName,
      ...(isLender ? [] : [c.lenderName]),
      c.typeLabel,
      c.submittedAt?.slice(0, 10) ?? "",
      c.status,
      c.lastUpdatedAt.slice(0, 10),
      c.bucket,
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `claims-${new Date().toISOString().slice(0, 10)}.csv`;
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
      className="h-9 cursor-pointer select-none px-2 transition-colors hover:bg-neutral-50"
    >
      <div className="flex items-center">
        {label}
        <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
      </div>
    </TableHead>
  );
};

function StatusFilterSelect({
  value,
  onChange,
}: Readonly<{
  value: (typeof STATUS_OPTIONS)[number];
  onChange: (next: (typeof STATUS_OPTIONS)[number]) => void;
}>) {
  return (
    <div className="relative">
      <select
        aria-label="Status"
        value={value}
        onChange={(e) => onChange(e.target.value as (typeof STATUS_OPTIONS)[number])}
        className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/**
 * Track Claim.
 *
 * Reads claims, not accounts: a query lives on the claim, so a page driven by
 * `account.claimStatus` could never show one.
 */
export function TrackCasesClient({
  claims,
  isLender,
}: Readonly<{ claims: ClaimRow[]; isLender: boolean }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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

  const handleStatusChange = useCallback(
    (v: (typeof STATUS_OPTIONS)[number]) => {
      setStatus(v);
      setPage(1);
    },
    []
  );

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);

  const rows = useMemo(() => {
    let result = claims;
    if (status !== "ALL") {
      result = result.filter((c) => c.status === status);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((c) =>
        `${c.claimNo} ${c.caseId} ${c.customerName} ${c.typeLabel} ${c.lenderName}`
          .toLowerCase()
          .includes(q)
      );
    }
    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string;
        let valB: string;
        switch (sortKey) {
          case "claimNo":
            valA = a.claimNo;
            valB = b.claimNo;
            break;
          case "submittedAt":
            valA = a.submittedAt ?? "";
            valB = b.submittedAt ?? "";
            break;
          case "lastUpdatedAt":
            valA = a.lastUpdatedAt;
            valB = b.lastUpdatedAt;
            break;
        }
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [claims, query, status, sortKey, sortDirection]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExport = useCallback(() => downloadCsv(rows, isLender), [rows, isLender]);

  const colSpan = isLender ? 9 : 10;

  return (
    <Panel
      title={`${rows.length} claim${rows.length === 1 ? "" : "s"}`}
      description="Every claim that has left draft, and what it is waiting on."
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
            placeholder="Claim no, case, customer…"
            aria-label="Search claims"
            className="h-8 w-[260px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <StatusFilterSelect value={status} onChange={handleStatusChange} />
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="claimNo"
                label="Claim no."
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-9 px-2">Account</TableHead>
              <TableHead className="h-9 px-2">Customer</TableHead>
              {!isLender && <TableHead className="h-9 px-2">Lender</TableHead>}
              <TableHead className="h-9 px-2">Claim type</TableHead>
              <SortableTableHead
                column="submittedAt"
                label="Submitted"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-9 px-2">Status</TableHead>
              <SortableTableHead
                column="lastUpdatedAt"
                label="Last updated"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-9 px-2">Bucket</TableHead>
              <TableHead className="h-9 px-2 text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-14 text-center">
                  <SearchXIcon className="mx-auto mb-2 size-6 text-neutral-300" />
                  <p className="text-[13px] font-medium text-neutral-700">
                    No claims to track yet.
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-neutral-500">
                    A claim appears here once it has been submitted.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((c) => (
                <TableRow key={c.id} className={cn(c.openQuery && "bg-warning/5")}>
                  <TableCell className="px-2 py-2">
                    <span className="inline-flex items-center rounded-full bg-info/12 px-2.5 py-0.5 text-[12px] font-semibold text-info">
                      {c.claimNo}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-2 text-neutral-500">{c.caseId}</TableCell>
                  <TableCell className="px-2 py-2 font-medium text-neutral-900">
                    {c.customerName}
                  </TableCell>
                  {!isLender && (
                    <TableCell className="px-2 py-2 text-neutral-500">{c.lenderName}</TableCell>
                  )}
                  <TableCell className="px-2 py-2 text-neutral-500">{c.typeLabel}</TableCell>
                  <TableCell className="px-2 py-2 text-neutral-500">
                    {when(c.submittedAt)}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <StatusPill status={c.status} />
                  </TableCell>
                  <TableCell className="px-2 py-2 text-neutral-500">
                    {when(c.lastUpdatedAt)}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <StatusPill status={c.bucket} />
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      render={<Link href={ROUTES.claimDetails(c.id)} />}
                    >
                      <RadarIcon /> Track
                    </Button>
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
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="hidden sm:inline">
            Total {rows.length} claim{rows.length === 1 ? "" : "s"}
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
