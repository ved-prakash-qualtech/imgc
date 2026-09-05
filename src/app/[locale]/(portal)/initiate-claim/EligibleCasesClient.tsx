"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
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

type SortKey = "loanNo" | "borrowerName" | "loanAmount" | "applicationDate";
type SortDirection = "asc" | "desc" | null;

/** 4500000 becomes 45,00,000 — Indian grouping, no currency symbol (matches the reference). */
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

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
      className="cursor-pointer select-none transition-colors hover:bg-neutral-50"
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

export function EligibleCasesClient({
  accounts,
}: Readonly<{ accounts: EligibleRow[] }>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "10"));
    setPage(1);
  }, []);

  const rows = useMemo(() => {
    // NPA-only grid.
    let result = accounts.filter((a) => a.npa);

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
          default:
            valA = "";
            valB = "";
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
  }, [accounts, query, sortKey, sortDirection]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Panel
      title={`${rows.length} eligible case${rows.length === 1 ? "" : "s"}`}
      description="NPA accounts your organisation can raise a claim on."
    >
      <div className="border-b border-neutral-100 p-4">
        <div className="relative w-fit">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Loan ID or applicant"
            aria-label="Search cases"
            className="h-9 w-[260px] rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No eligible cases match your search.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {a.loanNo}
                  </TableCell>
                  <TableCell>{a.borrowerName}</TableCell>
                  <TableCell className="tabular-nums text-neutral-700">
                    {inr.format(a.loanAmount)}
                  </TableCell>
                  <TableCell className="tabular-nums text-neutral-500">
                    {a.applicationDate.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {a.claim ? (
                      <StatusPill status={a.claim.status} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600">
                        <span className="size-1.5 rounded-full bg-neutral-400" />
                        Not started
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
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

      <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-25 px-5 py-3">
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
            Page {page} of {pageCount}
          </span>
          <PaginationNumbers
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </div>
      </div>
    </Panel>
  );
}
