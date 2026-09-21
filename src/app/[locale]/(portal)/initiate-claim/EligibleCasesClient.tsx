/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { ownerForStatus } from "@/config/claimOwner";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  useRememberFilters,
  CLAIMS_FILTER_KEY,
} from "@/lib/hooks/useRememberedFilters";
import { claimAmountFor } from "@/config/claimConfig";
import type { EligibleRow } from "@/types/portal/eligibleClaim";
import type { Bucket, ClaimStatus } from "@/server/mock/types";

type SortKey =
  | "loanNo"
  | "claimNo"
  | "borrowerName"
  | "purpose"
  | "loanAmount"
  | "outstandingAmount"
  | "claimAmount"
  | "dpd"
  | "status"
  | "bucket"
  | "submittedAt"
  // Not a visible column — the post-submit redirect (ClaimWorkspace) still lands here with
  // `?sort=lastUpdatedAt_desc` to float the just-submitted claim to row 1.
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
    "outstandingAmount",
    "claimAmount",
    "dpd",
    "status",
    "bucket",
    "submittedAt",
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
  "NOT_STARTED",
  "DRAFT",
  "INITIATED",
  "QUERY_INITIATED",
  "UNDER_REVIEW",
  "QUERY_UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];
type StatusFilter =
  StatusOption | "DOCUMENTS_RESUBMITTED" | "ACTIVE_NPA" | "UNDER_PROGRESS";
const URL_STATUS_VALUES = new Set<string>([
  ...STATUS_OPTIONS,
  "DOCUMENTS_RESUBMITTED",
  "QUERY_RAISED", // keep so old bookmarked URLs still parse safely
  "ACTIVE_NPA",
  "UNDER_PROGRESS",
]);

/** Which side currently holds the claim. Same two values (and the same "ALL") the Accounts grid
 *  filters on, so the two screens never disagree about what a bucket is. A row with no claim yet
 *  has no bucket at all — it renders "—" — so it drops out whenever a specific side is picked. */
const BUCKETS = ["ALL", "IMGC", "LENDER"] as const;

/** In-flight — submitted but not yet decided one way or the other. Same set the Claims Overview
 *  band uses to compute its own "Under Progress" tile (see initiate-claim/page.tsx). */
const UNDER_PROGRESS_STATUSES = new Set<ClaimStatus>([
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

function statusLabel(v: StatusOption): string {
  if (v === "NOT_STARTED") return "Not started";
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
  if (v === "ALL") return "All Owners";
  return v === "IMGC" ? "IMGC" : "Lender";
}

/** A claim record exists the moment the lender opens the workspace — that's a plumbing detail
 *  (there has to be something to attach a checklist and documents to), not something the lender
 *  did. Nothing here reads as "started" until they've actually clicked Save at least once
 *  (`hasProgress`), so a row with an unsaved claim still shows and filters as "Not started". */
function isNotStarted(a: EligibleRow): boolean {
  return !a.claim || !a.claim.hasProgress;
}

/**
 * Which side holds the row, as the Owner column shows it.
 *
 * Nothing has been submitted on a "Not started" row, so it is the lender's to begin — whether or
 * not an empty draft shell happens to exist behind it. Reading `claim.bucket` alone made that an
 * accident of plumbing: the same "Not started" row read "Lender" once the workspace had been
 * opened and "—" before it, so two identical-looking rows disagreed. The Owner filter reads this
 * too, so the column and the filter can never say different things about the same row.
 */
function ownerOf(a: EligibleRow): Bucket {
  if (isNotStarted(a)) return "LENDER";
  return ownerForStatus((a.claim as NonNullable<EligibleRow["claim"]>).status);
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
    "Loan Amount",
    "O/S Amount",
    "Claim Amount",
    "DPD",
    "Status",
    "Owner",
    "Initiation Date",
  ];
  const lines = rows.map((a) =>
    [
      a.loanNo,
      a.claim?.claimNo ?? "",
      a.borrowerName,
      a.product,
      a.loanAmount,
      a.outstandingAmount,
      claimAmountFor(a.loanAmount),
      a.dpd ?? "",
      isNotStarted(a)
        ? "NOT_STARTED"
        : (a.claim as NonNullable<EligibleRow["claim"]>).status,
      ownerOf(a),
      a.submittedAt?.slice(0, 10) ?? "",
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
      <ArrowUpDownIcon className="ml-px size-2.5 shrink-0 text-neutral-400" />
    );
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-px size-2.5 shrink-0 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-px size-2.5 shrink-0 text-neutral-800" />
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
      className="h-7 cursor-pointer select-none px-1 text-[10px] transition-colors hover:bg-neutral-50"
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
        className="h-7 appearance-none rounded-full border border-neutral-200 bg-white pl-2.5 pr-7 text-center text-[11.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
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

function StatusMultiSelect({
  value,
  onChange,
}: Readonly<{
  value: StatusFilter[];
  onChange: (next: StatusFilter[]) => void;
}>) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const label =
    value.length === 0
      ? "All Claim Status"
      : value.length === 1
        ? value[0] === "ACTIVE_NPA"
          ? "Active NPA"
          : value[0] === "UNDER_PROGRESS"
            ? "Under progress"
            : statusLabel(value[0] as StatusOption)
        : `${value.length} statuses selected`;

  const toggle = (option: StatusOption) => {
    const next = new Set(
      value.filter(
        (item): item is StatusOption =>
          item !== "ACTIVE_NPA" && item !== "UNDER_PROGRESS"
      )
    );
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(STATUS_OPTIONS.filter((item) => next.has(item)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="All Claim Status"
        className="inline-flex h-7 max-w-[170px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 text-[11.5px] font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-neutral-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-2">
        {STATUS_OPTIONS.map((option) => (
          <label
            key={option}
            htmlFor={`claim-status-${option}`}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-neutral-900 hover:bg-neutral-50"
          >
            <Checkbox
              id={`claim-status-${option}`}
              checked={selected.has(option)}
              onCheckedChange={() => toggle(option)}
            />
            {statusLabel(option)}
          </label>
        ))}
        {value.length > 0 && (
          <button
            type="button"
            className="mt-1 border-t border-neutral-100 px-2 pt-2 text-left text-xs font-medium text-neutral-500 hover:text-neutral-900"
            onClick={() => onChange([])}
          >
            Clear status filter
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Which `?status=` values are real filter options — a Claims Overview tile links here with one
 *  of these; anything else (or none) falls back to "ALL" rather than silently filtering wrong. */
function statusFromParam(value: string | null): StatusFilter[] {
  if (!value) return [];
  return [
    ...new Set(value.split(",").filter((item) => URL_STATUS_VALUES.has(item))),
  ] as StatusFilter[];
}

export function EligibleCasesClient({
  accounts,
  trackView,
}: Readonly<{ accounts: EligibleRow[]; trackView?: "tabs" | "single" }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Same as the IMGC grid: recorded here, re-applied by the workspace's Back link.
  useRememberFilters(CLAIMS_FILTER_KEY);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter[]>(() =>
    statusFromParam(searchParams.get("status"))
  );
  const [product, setProduct] = useState("ALL");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("ALL");

  // Initialise sort from the URL param so that returning from claim submission
  // (with ?sort=lastUpdatedAt_desc) immediately shows the newest claim at row 1.
  const initialSort = sortFromParam(searchParams.get("sort"));
  const [sortKey, setSortKey] = useState<SortKey | null>(
    initialSort.key ?? "submittedAt"
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSort.dir ?? "desc"
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
    (v: StatusFilter[]) => {
      setStatus(v);
      const nextParams = new URLSearchParams(searchParams.toString());
      if (v.length === 0) nextParams.delete("status");
      else nextParams.set("status", v.join(","));
      router.replace(`?${nextParams.toString()}`, { scroll: false });
      setPage(1);
    },
    [router, searchParams]
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
    let result = accounts.filter(
      (account) =>
        account.claim?.status !== "DOCUMENTS_RESUBMITTED" &&
        account.claim?.status !== "CLOSED"
    );

    if (status.length > 0) {
      result = result.filter((a) => {
        if (status.includes("ACTIVE_NPA")) {
          return (
            isNotStarted(a) ||
            a.claim?.status === "DRAFT" ||
            UNDER_PROGRESS_STATUSES.has(
              (a.claim as NonNullable<EligibleRow["claim"]>).status
            )
          );
        }
        if (status.includes("UNDER_PROGRESS")) {
          return (
            !isNotStarted(a) &&
            UNDER_PROGRESS_STATUSES.has(
              (a.claim as NonNullable<EligibleRow["claim"]>).status
            )
          );
        }
        if (status.includes("NOT_STARTED") && isNotStarted(a)) return true;
        return (
          !isNotStarted(a) && status.includes(a.claim?.status as StatusFilter)
        );
      });
    }
    if (product !== "ALL") {
      result = result.filter((a) => a.product === product);
    }
    if (bucket !== "ALL") {
      // Same rule the Owner column renders (`ownerOf`), so a row that visibly reads "Lender"
      // can never drop out of the Lender filter.
      result = result.filter((a) => ownerOf(a) === bucket);
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
          case "claimAmount":
            valA = claimAmountFor(a.loanAmount);
            valB = claimAmountFor(b.loanAmount);
            break;
          case "outstandingAmount":
            valA = a.outstandingAmount;
            valB = b.outstandingAmount;
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
            valA = isNotStarted(a) ? "NOT_STARTED" : (a.claim?.status ?? "");
            valB = isNotStarted(b) ? "NOT_STARTED" : (b.claim?.status ?? "");
            break;
          case "bucket":
            valA = ownerOf(a);
            valB = ownerOf(b);
            break;
          case "submittedAt":
            valA = a.submittedAt ?? "";
            valB = b.submittedAt ?? "";
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
            className="h-7 w-[215px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[12px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <StatusMultiSelect value={status} onChange={handleStatusChange} />
        <FilterSelect
          label="Loan Types"
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
          className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 text-[11.5px] font-medium text-neutral-700 outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
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
              <SortableTableHead
                column="purpose"
                label="Loan Types"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="loanAmount"
                label="Loan Amount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="outstandingAmount"
                label="O/S Amount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="claimAmount"
                label="Claim Amount"
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
              <SortableTableHead
                column="status"
                label="Status"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="bucket"
                label="Owner"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="submittedAt"
                label="Initiation Date"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="h-7 px-1 text-[10px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No claims match your search.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="px-1 py-1 text-[11.5px]">
                    <span className="inline-flex items-center rounded-full bg-info/12 px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap text-info">
                      {a.loanNo}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px] whitespace-nowrap text-neutral-500">
                    {a.claim?.claimNo || "—"}
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px] font-medium whitespace-nowrap text-neutral-900">
                    {a.borrowerName}
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px] whitespace-nowrap text-neutral-500">
                    {a.product}
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px]">
                    <span className="inline-flex items-center rounded-full bg-success-50 px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap tabular-nums text-success-700">
                      {inr.format(a.loanAmount)}
                    </span>
                  </TableCell>
                  {/* Outstanding is what the claim is actually about - principal plus interest still
                      owed today - so it reads in the warning tone, apart from the sanctioned amount. */}
                  <TableCell className="px-1 py-1 text-[11.5px]">
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap tabular-nums text-warning">
                      {inr.format(a.outstandingAmount)}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px]">
                    <span
                      className="inline-flex items-center rounded-full bg-brand-primary/10 px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap tabular-nums text-brand-primary"
                      title="20% of the loan amount"
                    >
                      {inr.format(claimAmountFor(a.loanAmount))}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px] tabular-nums whitespace-nowrap text-neutral-500">
                    {a.dpd ? `${a.dpd} days` : "—"}
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    {!isNotStarted(a) && a.claim ? (
                      <StatusPill
                        status={a.claim.status}
                        className="px-1 py-0.5 text-[10px]"
                        maxChars={10}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1 py-0.5 text-[10px] font-medium whitespace-nowrap text-neutral-600"
                        title="Not started"
                      >
                        <span className="size-1.5 rounded-full bg-neutral-400" />
                        Not starte...
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    <StatusPill
                      status={ownerOf(a)}
                      className="px-1 py-0.5 text-[10px]"
                    />
                  </TableCell>
                  <TableCell className="px-1 py-1 text-[11.5px] tabular-nums whitespace-nowrap text-neutral-500">
                    {dateOrDash(a.submittedAt)}
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    <ClaimRowActions
                      accountId={a.id}
                      claimId={a.claim?.id}
                      claimNo={a.claim?.claimNo}
                      action={a.claimAction}
                      reason={a.claimReason}
                      hasProgress={a.claim?.hasProgress}
                      trackView={trackView}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[12px] text-neutral-500">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger size="sm" className="h-7 w-[62px] bg-white">
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
          <span className="hidden text-[12px] text-neutral-500 sm:inline">
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
