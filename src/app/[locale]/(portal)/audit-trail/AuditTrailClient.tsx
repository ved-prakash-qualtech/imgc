"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (!q) return true;
      const account = accountMap[e.accountId];
      return (
        e.summary.toLowerCase().includes(q) ||
        (account?.loanNo || "").toLowerCase().includes(q) ||
        (account?.borrowerName || "").toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q)
      );
    });
  }, [events, query, accountMap]);

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
            <TableHead className="w-[160px] shrink-0">
              Date &amp; Time
            </TableHead>
            <TableHead className="w-[150px]">Account</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead className="w-[140px]">Performed By</TableHead>
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
