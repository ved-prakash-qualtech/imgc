/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type SortKey =
  | "loanNo"
  | "claimNo"
  | "borrowerName"
  | "purpose"
  | "loanAmount"
  | "dpd"
  | "status"
  | "bucket"
  | "lastUpdatedAt";
type SortDirection = "asc" | "desc" | null;

/** Parse the ?sort= param. Returns null state if the value is not a known sort.
 *  Format: <key>_<dir> where dir is "asc" or "desc". Keys may also contain "_"
 *  (e.g. lastUpdatedAt), so we split from the right: the last segment is the direction. */
function sortFromParam(value: string | null): {
  key: SortKey | null;
  dir: SortDirection;
} {
  if (!value) return { key: null, dir: null };
  const lastUnderscore = value.lastIndexOf("_");
  if (lastUnderscore === -1) return { key: null, dir: null };
  const rawKey = value.slice(0, lastUnderscore);
  const rawDir = value.slice(lastUnderscore + 1);
  const validKeys: SortKey[] = [
    "loanNo",
    "claimNo",
    "borrowerName",
    "purpose",
    "loanAmount",
    "dpd",
    "status",
    "bucket",
    "lastUpdatedAt",
  ];
  const key = validKeys.includes(rawKey as SortKey)
    ? (rawKey as SortKey)
    : null;
  const dir: SortDirection =
    rawDir === "asc" ? "asc" : rawDir === "desc" ? "desc" : null;
  return key && dir ? { key, dir } : { key: null, dir: null };
}

/** The status filter's own values — "not started" isn't a real `ClaimStatus`, it's the absence
 *  of a claim, so it needs a value of its own alongside the real ones. Covers the full status
 *  range (this grid is now Initiate Claim and Track Claim combined, not just the former). */
const STATUS_OPTIONS = [
  "ALL",
  "NOT_STARTED",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "APPROVED",
  "REJECTED",
  "CLOSED",
  // Composite buckets — not a real ClaimStatus, a grouping of several. Exists so the Claims
  // Overview KPI tiles (whose buckets don't map 1:1 to a single status) can deep-link into a
  // filter that actually matches what the tile counted.
  "INITIATION",
  "UNDER_PROGRESS",
] as const;

/** Which side currently holds the claim. Same two values (and the same "ALL") the Accounts grid
 *  filters on, so the two screens never disagree about what a bucket is. A row with no claim yet
 *  has no bucket at all — it renders "—" — so it drops out whenever a specific side is picked. */
const BUCKETS = ["ALL", "IMGC", "LENDER"] as const;

/** In-flight — submitted but not yet decided one way or the other. Same set the Claims Overview
 *  band uses to compute its own "Under Progress" tile (see initiate-claim/page.tsx). */
const UNDER_PROGRESS_STATUSES = new Set<ClaimStatus>([
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "DOCUMENTS_RESUBMITTED",
]);

/** 4500000 becomes 45,00,000 — Indian grouping, no currency symbol (matches the reference). */
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateOrDash(iso?: string): string {
  return iso ? date(iso) : "—";
}

function statusLabel(v: (typeof STATUS_OPTIONS)[number]): string {
  if (v === "ALL") return "All Claim Status";
  if (v === "NOT_STARTED") return "Not started";
  if (v === "INITIATION") return "Claim initiation";
  if (v === "UNDER_PROGRESS") return "Under progress";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function purposeDisplay(v: string): string {
  return v === "ALL" ? "All Loan Types" : v;
}

function bucketDisplay(v: (typeof BUCKETS)[number]): string {
  return v === "ALL" ? "All Owners" : v.toLowerCase();
}

/** A claim record exists the moment the lender opens the workspace — that's a plumbing detail
 *  (there has to be something to attach a checklist and documents to), not something the lender
 *  did. Nothing here reads as "started" until they've actually clicked Save at least once
 *  (`hasProgress`), so a row with an unsaved claim still shows and filters as "Not started". */
function isNotStarted(a: EligibleRow): boolean {
  return !a.claim || !a.claim.hasProgress;
}

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: EligibleRow[]): void {
  const headers = [
    "Loan ID",
    "Claim No",
    "Applicant",
    "Loan Type",
    "Amount",
    "DPD",
    "Status",
    "Owner",
    "Last Updated",
  ];
  const lines = rows.map((a) =>
    [
      a.loanNo,
      a.claim?.claimNo ?? "",
      a.borrowerName,
      a.product,
      a.loanAmount,
      a.dpd ?? "",
      isNotStarted(a)
        ? "NOT_STARTED"
        : (a.claim as NonNullable<EligibleRow["claim"]>).status,
      a.claim?.bucket ?? "",
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
    return (
      <ArrowUpDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-400" />
    );
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
  /** Native tooltip on the header — e.g. spelling out an abbreviation like "DPD". */
  title?: string;
}) => {
  const handleClick = useCallback(() => onToggle(column), [column, onToggle]);
  return (
    <TableHead
      onClick={handleClick}
      title={title}
      className="h-8 cursor-pointer select-none px-1 text-[10.5px] transition-colors hover:bg-neutral-50"
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

/** Which `?status=` values are real filter options — a Claims Overview tile links here with one
 *  of these; anything else (or none) falls back to "ALL" rather than silently filtering wrong. */
function statusFromParam(
  value: string | null
): (typeof STATUS_OPTIONS)[number] {
  return (STATUS_OPTIONS as readonly string[]).includes(value ?? "")
    ? (value as (typeof STATUS_OPTIONS)[number])
    : "ALL";
}

export function EligibleCasesClient({
  accounts,
}: Readonly<{ accounts: EligibleRow[] }>) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(() =>
    statusFromParam(searchParams.get("status"))
  );
  const [product, setProduct] = useState("ALL");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("ALL");

  // Initialise sort from the URL param so that returning from claim submission
  // (with ?sort=lastUpdatedAt_desc) immediately shows the newest claim at row 1.
  const initialSort = sortFromParam(searchParams.get("sort"));
  const [sortKey, setSortKey] = useState<SortKey | null>(initialSort.key);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSort.dir
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // A Claims Overview tile navigates here client-side (same route, new `?status=`) — this
  // component doesn't remount for that, so the lazy useState initializer above only ran once on
  // first load. Re-sync during render when the param actually changes (React's own pattern for
  // "adjust state when a prop changes" — https://react.dev/learn/you-might-not-need-an-effect —
  // rather than setState-in-an-effect, which just adds an extra render), or a click updates the
  // URL and the grid silently keeps showing the old filter.
  const [prevStatusParam, setPrevStatusParam] = useState(
    searchParams.get("status")
  );
  const statusParam = searchParams.get("status");
  if (statusParam !== prevStatusParam) {
    setPrevStatusParam(statusParam);
    setStatus(statusFromParam(statusParam));
    setPage(1);
  }

  // Similarly re-sync the sort when ?sort= changes (e.g. navigating back after a submit).
  const [prevSortParam, setPrevSortParam] = useState(searchParams.get("sort"));
  const sortParam = searchParams.get("sort");
  if (sortParam !== prevSortParam) {
    setPrevSortParam(sortParam);
    const { key, dir } = sortFromParam(sortParam);
    setSortKey(key);
    setSortDirection(dir);
    setPage(1);
  }

  const products = useMemo(
    () =>
      Array.from(new Set(accounts.map((a) => a.product)))
        .filter((p) => p !== "Affordable Housing")
        .sort(),
    [accounts]
  );

  // Reads `sortKey`/`sortDirection` from the render closure rather than nesting one setState
  // call inside the other's updater (the previous version called `setSortDirection` from within
  // `setSortKey`'s updater, and `setSortKey` again from within *that* — updater functions are
  // meant to be pure, and React 18 can invoke them more than once per commit to check exactly
  // that; nesting a nested setState call in one meant every second click skipped "descending"
  // entirely and jumped straight back to unsorted). One plain read, one or two plain `set` calls.
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

  const handleProductChange = useCallback((v: string) => {
    setProduct(v);
    setPage(1);
  }, []);

  const handleBucketChange = useCallback((v: (typeof BUCKETS)[number]) => {
    setBucket(v);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "10"));
    setPage(1);
  }, []);

  const rows = useMemo(() => {
    // Eligibility (NPA, or an existing claim) is already decided server-side — every row here is
    // meant to be shown.
    let result = accounts;

    if (status !== "ALL") {
      result = result.filter((a) => {
        if (status === "NOT_STARTED") return isNotStarted(a);
        // Same buckets the Claims Overview KPI tiles count — see initiate-claim/page.tsx.
        if (status === "INITIATION") {
          return isNotStarted(a) || a.claim?.status === "DRAFT";
        }
        if (status === "UNDER_PROGRESS") {
          return (
            !isNotStarted(a) &&
            UNDER_PROGRESS_STATUSES.has(
              (a.claim as NonNullable<EligibleRow["claim"]>).status
            )
          );
        }
        // "APPROVED" also matches CLOSED — same fold `summariseClaimOverview` applies to its own
        // "approved" tile (closest terminal-success bucket), so this filter's rows always match
        // what the "Claim Approved" tile counted.
        if (status === "APPROVED") {
          return (
            !isNotStarted(a) &&
            (a.claim?.status === "APPROVED" || a.claim?.status === "CLOSED")
          );
        }
        return !isNotStarted(a) && a.claim?.status === (status as ClaimStatus);
      });
    }
    if (product !== "ALL") {
      result = result.filter((a) => a.product === product);
    }
    if (bucket !== "ALL") {
      // Reads the claim's own bucket, which is what the Bucket column renders — an account with
      // no claim yet shows "—" there and so cannot match either side.
      result = result.filter((a) => a.claim?.bucket === bucket);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.loanNo.toLowerCase().includes(q) ||
          a.borrowerName.toLowerCase().includes(q) ||
          (a.claim?.claimNo.toLowerCase().includes(q) ?? false)
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
          case "dpd":
            valA = a.dpd ?? 0;
            valB = b.dpd ?? 0;
            break;
          case "claimNo":
            valA = a.claim?.claimNo ?? "";
            valB = b.claim?.claimNo ?? "";
            break;
          case "purpose":
            valA = a.product;
            valB = b.product;
            break;
          case "status":
            valA = isNotStarted(a) ? "NOT_STARTED" : a.claim?.status ?? "";
            valB = isNotStarted(b) ? "NOT_STARTED" : b.claim?.status ?? "";
            break;
          case "bucket":
            valA = a.claim?.bucket ?? "";
            valB = b.claim?.bucket ?? "";
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
  }, [accounts, query, status, product, bucket, sortKey, sortDirection]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExport = useCallback(() => downloadCsv(rows), [rows]);

  return (
    <Panel size="compact">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-3 py-1.5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Loan ID, claim no. or applicant"
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
        <FilterSelect
          label="Owner"
          options={BUCKETS}
          value={bucket}
          onChange={handleBucketChange}
          display={bucketDisplay}
        />
        {/* Sits in the filter row rather than a panel header, and wears the same pill the
            selects beside it wear — `ml-auto` keeps it at the right edge of the row however
            many filters end up in front of it. */}
        <button
          type="button"
          onClick={handleExport}
          className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[12.5px] font-medium text-neutral-700 outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        >
          <DownloadIcon className="size-3.5" /> Export CSV
        </button>
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
                column="claimNo"
                label="Claim No."
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
              <SortableTableHead column="purpose" label="Purpose" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead
                column="loanAmount"
                label="Amount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="dpd"
                label="DPD"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead column="status" label="Status" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead column="bucket" label="Owner" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead
                column="lastUpdatedAt"
                label="Last Updated"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-8 px-1 text-right text-[10.5px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No claims match your search.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="px-1 py-1.5 text-[12px]">
                    <span className="inline-flex items-center rounded-full bg-info/12 px-1 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-info">
                      {a.loanNo}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                    {a.claim?.claimNo ?? "—"}
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-900">
                    {a.borrowerName}
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                    {a.product}
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px]">
                    <span className="inline-flex items-center rounded-full bg-success-50 px-1 py-0.5 text-[10.5px] font-semibold whitespace-nowrap tabular-nums text-success-700">
                      {inr.format(a.loanAmount)}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-500">
                    {a.dpd ? `${a.dpd} days` : "—"}
                  </TableCell>
                  <TableCell className="px-1 py-1.5">
                    {!isNotStarted(a) && a.claim ? (
                      <StatusPill
                        status={a.claim.status}
                        className="px-1 py-0.5 text-[10.5px]"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-neutral-600">
                        <span className="size-1.5 rounded-full bg-neutral-400" />
                        Not started
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-1.5">
                    {a.claim ? (
                      <StatusPill
                        status={a.claim.bucket}
                        className="px-1 py-0.5 text-[10.5px]"
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-[12px] tabular-nums whitespace-nowrap text-neutral-500">
                    {dateOrDash(a.claim?.lastUpdatedAt)}
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-right">
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
