"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";

import { BucketToggle } from "@/components/portal/BucketToggle";
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
import type { AccountRow } from "@/services/portal/accounts.server";
import type { Role } from "@/server/mock/types";

const BUCKETS = ["ALL", "IMGC", "LENDER"] as const;
const STATUSES = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "QUERIED"] as const;

/** A coarse credit classification derived from the flags we actually carry — not a fourth
 *  status field, so it can never drift from what `npa`/`writeOff` already say. */
type AssetClass = "STANDARD" | "NPA" | "WRITE_OFF";
const ASSET_CLASSES = ["ALL", "STANDARD", "NPA", "WRITE_OFF"] as const;

function assetClassOf(a: AccountRow): AssetClass {
  if (a.writeOff) return "WRITE_OFF";
  if (a.npa) return "NPA";
  return "STANDARD";
}

const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  STANDARD: "Standard",
  NPA: "NPA",
  WRITE_OFF: "Write-off",
};

type SortKey = "loanNo" | "borrowerName" | "loanAmount" | "outstandingAmount" | "disbursementDate";
type SortDirection = "asc" | "desc" | null;

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Escapes a value for one CSV field — wraps in quotes whenever it could otherwise break the
 *  row (a comma, a quote, or a newline in a borrower/product name). */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: AccountRow[], role: Role): void {
  const headers = [
    "Loan No",
    "Borrower",
    ...(role === "IMGC" ? ["Lender"] : []),
    "Product",
    "Principal",
    "Outstanding",
    "Disbursed",
    "Asset Class",
    "Bucket",
    "Claim Status",
  ];
  const lines = rows.map((a) =>
    [
      a.loanNo,
      a.borrowerName,
      ...(role === "IMGC" ? [a.lenderOrgName] : []),
      a.product,
      a.loanAmount,
      a.outstandingAmount,
      a.disbursementDate.slice(0, 10),
      ASSET_CLASS_LABEL[assetClassOf(a)],
      a.bucket,
      a.claimStatus,
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function assetClassDisplay(v: (typeof ASSET_CLASSES)[number]): string {
  return v === "ALL" ? "All classes" : ASSET_CLASS_LABEL[v];
}

function purposeDisplay(v: string): string {
  return v === "ALL" ? "All purposes" : v;
}

function bucketDisplay(v: (typeof BUCKETS)[number]): string {
  return v === "ALL" ? "All buckets" : v.toLowerCase();
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
  className,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
  className?: string;
}) => (
  <TableHead
    onClick={() => onToggle(column)}
    className={cn(
      "h-9 cursor-pointer select-none transition-colors hover:bg-neutral-50",
      className
    )}
  >
    <div className="flex items-center">
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </div>
  </TableHead>
);

export function AccountsClient({
  accounts,
  role,
}: Readonly<{ accounts: AccountRow[]; role: Role }>) {
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [assetClass, setAssetClass] = useState<(typeof ASSET_CLASSES)[number]>("ALL");
  const [product, setProduct] = useState<string>("ALL");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = accounts.filter((a) => {
      if (bucket !== "ALL" && a.bucket !== bucket) return false;
      if (status !== "ALL" && a.claimStatus !== status) return false;
      if (assetClass !== "ALL" && assetClassOf(a) !== assetClass) return false;
      if (product !== "ALL" && a.product !== product) return false;
      if (!q) return true;
      return (
        a.loanNo.toLowerCase().includes(q) ||
        a.borrowerName.toLowerCase().includes(q) ||
        a.lenderOrgName.toLowerCase().includes(q)
      );
    });

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
          case "disbursementDate":
            valA = a.disbursementDate;
            valB = b.disbursementDate;
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
  }, [accounts, query, bucket, status, assetClass, product, sortKey, sortDirection]);

  const pageCount = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);
  const handleExport = useCallback(() => downloadCsv(filtered, role), [filtered, role]);
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setPage(1);
    },
    []
  );
  const handleStatusChange = useCallback((v: (typeof STATUSES)[number]) => {
    setStatus(v);
    setPage(1);
  }, []);
  const handleAssetClassChange = useCallback(
    (v: (typeof ASSET_CLASSES)[number]) => {
      setAssetClass(v);
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
  const exportAction = useMemo(
    () => (
      <Button variant="outline" size="sm" onClick={handleExport}>
        <DownloadIcon /> Export CSV
      </Button>
    ),
    [handleExport]
  );

  return (
    <Panel
      title={`${filtered.length} account${filtered.length === 1 ? "" : "s"}`}
      description={
        role === "IMGC"
          ? "The complete pool across every lender."
          : "Accounts belonging to your organisation."
      }
      actions={exportAction}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Search borrower or loan ID"
            aria-label="Search accounts"
            className="h-8 w-[230px] rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <FilterSelect
          label="Status"
          options={STATUSES}
          value={status}
          onChange={handleStatusChange}
        />
        <FilterSelect
          label="Class"
          options={ASSET_CLASSES}
          display={assetClassDisplay}
          value={assetClass}
          onChange={handleAssetClassChange}
        />
        <FilterSelect
          label="Purpose"
          options={["ALL", ...products] as const}
          display={purposeDisplay}
          value={product}
          onChange={handleProductChange}
        />
        <FilterSelect
          label="Bucket"
          options={BUCKETS}
          display={bucketDisplay}
          value={bucket}
          onChange={handleBucketChange}
        />
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="loanNo" label="Loan no." sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead column="borrowerName" label="Borrower" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              {role === "IMGC" && <TableHead className="h-9">Lender</TableHead>}
              <TableHead className="h-9">Purpose</TableHead>
              <SortableTableHead column="loanAmount" label="Principal" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead column="outstandingAmount" label="Outstanding" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <SortableTableHead column="disbursementDate" label="Disbursed" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              <TableHead className="h-9">Asset Class</TableHead>
              <TableHead className="h-9">Documents</TableHead>
              <TableHead className="h-9">Bucket</TableHead>
              <TableHead className="h-9">Claim</TableHead>
              {role === "IMGC" && (
                <TableHead className="h-9 text-right">Processing</TableHead>
              )}
              <TableHead className="h-9 text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={role === "IMGC" ? 12 : 10}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No accounts match those filters.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => {
                const cls = assetClassOf(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="py-2 font-medium text-neutral-950">
                      {a.loanNo}
                    </TableCell>
                    <TableCell className="py-2">{a.borrowerName}</TableCell>
                    {role === "IMGC" && <TableCell className="py-2">{a.lenderOrgName}</TableCell>}
                    <TableCell className="py-2 text-neutral-500">{a.product}</TableCell>
                    <TableCell className="py-2 tabular-nums text-neutral-700">
                      {inr.format(a.loanAmount)}
                    </TableCell>
                    <TableCell className="py-2 tabular-nums text-neutral-700">
                      {inr.format(a.outstandingAmount)}
                    </TableCell>
                    <TableCell className="py-2 tabular-nums text-neutral-500">
                      {date(a.disbursementDate)}
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
                          cls === "NPA"
                            ? "bg-danger-50 text-danger-700"
                            : cls === "WRITE_OFF"
                              ? "bg-warning-50 text-warning-700"
                              : "bg-success-50 text-success-700"
                        )}
                      >
                        {ASSET_CLASS_LABEL[cls]}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={cn(
                          "text-[12.5px] font-medium",
                          a.pendingDocs > 0 ? "text-warning" : "text-success-700"
                        )}
                      >
                        {a.requiredDocs - a.pendingDocs}/{a.requiredDocs} in
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusPill status={a.bucket} />
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusPill status={a.claimStatus} />
                    </TableCell>
                    {role === "IMGC" && (
                      <TableCell className="py-2 text-right">
                        <BucketToggle
                          accountId={a.id}
                          loanNo={a.loanNo}
                          bucket={a.bucket}
                          size="xs"
                        />
                      </TableCell>
                    )}
                    <TableCell className="py-2 text-right">
                      <Link
                        href={ROUTES.account(a.id)}
                        className="text-[13px] font-semibold text-brand-primary hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
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
            Total {filtered.length} account{filtered.length === 1 ? "" : "s"}
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
  display?: (value: T) => string;
}>) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium capitalize text-neutral-700 outline-none",
          "focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {display
              ? display(option)
              : option === "ALL"
                ? `All ${label.toLowerCase()}s`
                : option.toLowerCase()}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
