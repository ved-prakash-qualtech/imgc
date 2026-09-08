"use client";

import { useCallback, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from "lucide-react";

import { Panel } from "@/components/portal/Panel";
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
import type { AuditEvent } from "@/server/mock/types";

type AccountSummary = {
  loanNo: string;
  borrowerName: string;
};

type SortKey = "timestamp" | "account" | "activity" | "user";
type SortDirection = "asc" | "desc" | null;

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
    className={`h-8 cursor-pointer select-none px-1.5 text-[10.5px] transition-colors hover:bg-neutral-50 ${className || ""}`}
  >
    <div className="flex items-center">
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </div>
  </TableHead>
);

export function AuditTrailClient({
  events,
  accountMap,
}: Readonly<{
  events: AuditEvent[];
  accountMap: Record<string, AccountSummary>;
}>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = events.filter((e) => {
      if (!q) return true;
      const account = accountMap[e.accountId];
      return (
        e.summary.toLowerCase().includes(q) ||
        (account?.loanNo || "").toLowerCase().includes(q) ||
        (account?.borrowerName || "").toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q)
      );
    });
    
    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number;
        let valB: string | number;
        switch (sortKey) {
          case "timestamp": valA = a.at; valB = b.at; break;
          case "account": valA = accountMap[a.accountId]?.loanNo || ""; valB = accountMap[b.accountId]?.loanNo || ""; break;
          case "activity": valA = a.summary; valB = b.summary; break;
          case "user": valA = a.actorName; valB = b.actorName; break;
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
  }, [events, query, accountMap, sortKey, sortDirection]);

  const pageCount = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setPage(1);
    },
    []
  );

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);

  return (
    <Panel title="Activity history">
      {/* Search bar row — sits below the panel title, above the table */}
      <div className="border-b border-neutral-100 px-5 py-3">
        <div className="relative w-[260px]">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Search activity..."
            aria-label="Search activity"
            className="h-9 w-full rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
      </div>

      {/* Table — no overflow-x-auto: columns are fixed/constrained to prevent horizontal scroll */}
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="timestamp" label="Timestamp" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} className="w-[160px] shrink-0" />
            <SortableTableHead column="account" label="Account" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} className="w-[150px]" />
            <SortableTableHead column="activity" label="Activity" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
            <SortableTableHead column="user" label="User" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} className="w-[150px]" />
            <TableHead className="w-[100px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-12 text-center text-[13px] text-neutral-500"
              >
                No audit activity found for your accessible cases.
              </TableCell>
            </TableRow>
          ) : (
            currentRows.map((e) => {
              const account = accountMap[e.accountId];
              return (
                <TableRow key={e.id}>
                  <TableCell className="w-[160px] whitespace-nowrap text-[12.5px] text-neutral-500">
                    {new Date(e.at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="w-[150px]">
                    {account ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900">
                          {account.loanNo}
                        </span>
                        <span className="text-[12px] text-neutral-500">
                          {account.borrowerName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-neutral-500">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-900">
                        {e.type}
                      </span>
                      {/* Truncate long summary; full text shown on hover via native title tooltip */}
                      <span
                        className="max-w-xs truncate text-[12.5px] text-neutral-600 lg:max-w-sm xl:max-w-md"
                        title={e.summary}
                      >
                        {e.summary}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[140px]">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-900">
                        {e.actorName}
                      </span>
                      <span className="text-[12px] text-neutral-500">
                        {e.actorRole}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[100px] text-right">
                    <Link
                      href={ROUTES.initiateClaimWorkspace(e.accountId)}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      View Case
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

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
            Total {filteredRows.length} event
            {filteredRows.length === 1 ? "" : "s"}
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
