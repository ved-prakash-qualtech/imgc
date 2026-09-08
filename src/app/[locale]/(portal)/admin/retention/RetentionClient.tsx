"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, BrushCleaningIcon, DownloadIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import {
  decideReinstateAction,
  runSweepAction,
} from "@/app/[locale]/(portal)/admin/retention/actions";
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
import type { RejectedDocRow } from "@/services/portal/retention.server";

type SortKey = "document" | "account" | "lender" | "reason" | "retention";
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

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: RejectedDocRow[]): void {
  const headers = ["Document", "Loan No", "Borrower", "Lender", "Reason", "Days Left"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.accountLoanNo,
      r.borrowerName,
      r.lenderOrgName,
      r.rejection.reason,
      r.held ? "Held" : String(Math.max(0, r.daysLeft)),
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rejected-documents-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RetentionClient({
  rows,
  retentionDays,
}: Readonly<{ rows: RejectedDocRow[]; retentionDays: number }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = rows;
    if (q) {
      result = rows.filter((r) =>
        `${r.name} ${r.accountLoanNo} ${r.borrowerName} ${r.lenderOrgName}`
          .toLowerCase()
          .includes(q)
      );
    }
    
    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number;
        let valB: string | number;
        switch (sortKey) {
          case "document": valA = a.name; valB = b.name; break;
          case "account": valA = a.accountLoanNo; valB = b.accountLoanNo; break;
          case "lender": valA = a.lenderOrgName; valB = b.lenderOrgName; break;
          case "reason": valA = a.rejection.reason; valB = b.rejection.reason; break;
          case "retention": valA = a.held ? Infinity : a.daysLeft; valB = b.held ? Infinity : b.daysLeft; break;
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
  }, [rows, query, sortKey, sortDirection]);

  const pageCount = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExport = useCallback(() => downloadCsv(filtered), [filtered]);

  const onSweep = useCallback(() => {
    startTransition(async () => {
      const result = await runSweepAction();
      if (!result.ok) {
        toast.error(result.error ?? "The sweep failed.");
        return;
      }
      toast.success(
        result.purged
          ? `${result.purged} document(s) purged.`
          : "Nothing has aged out — everything is still inside the window."
      );
      router.refresh();
    });
  }, [router]);

  const onDecide = useCallback(
    (row: RejectedDocRow, approve: boolean) => {
      startTransition(async () => {
        const result = await decideReinstateAction(
          row.accountId,
          row.id,
          approve,
          ""
        );
        if (!result.ok) {
          toast.error(result.error ?? "That decision could not be recorded.");
          return;
        }
        toast.success(approve ? "Document reinstated." : "Reinstatement denied.");
        router.refresh();
      });
    },
    [router]
  );

  return (
    <Panel
      title={`${filtered.length} rejected document${filtered.length === 1 ? "" : "s"}`}
      description={`Rejected documents are kept for ${retentionDays} days, then purged — unless a reinstatement is requested, which holds them.`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={onSweep} disabled={pending}>
            <BrushCleaningIcon /> Run sweep
          </Button>
        </div>
      }
    >
      <div className="border-b border-neutral-100 px-4 py-2.5">
        <div className="relative w-fit">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Document, loan no, borrower…"
            aria-label="Search rejected documents"
            className="h-8 w-[260px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
          Nothing is currently rejected.
        </p>
      ) : (
        <>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="document" label="Document" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                  <SortableTableHead column="account" label="Account" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                  <SortableTableHead column="lender" label="Lender" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                  <SortableTableHead column="reason" label="Reason" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                  <SortableTableHead column="retention" label="Retention" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                  <TableHead className="h-8 px-1.5 text-right text-[10.5px]">Reinstatement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-[13px] text-neutral-500">
                      No documents match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-1.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-950">
                        {row.name}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        <Link
                          href={ROUTES.account(row.accountId)}
                          className="inline-flex items-center rounded-full bg-info/12 px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-info hover:underline"
                        >
                          {row.accountLoanNo}
                        </Link>
                        <span className="block text-[11px] whitespace-nowrap text-neutral-500">
                          {row.borrowerName}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-600">
                        {row.lenderOrgName}
                      </TableCell>
                      <TableCell className="max-w-[260px] px-1.5 py-1.5 text-[11.5px] text-neutral-600">
                        {row.rejection.reason}
                        <span className="block text-[10.5px] text-neutral-400">
                          by {row.rejection.by} ·{" "}
                          {new Date(row.rejection.at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {row.held ? (
                          <span className="text-[11.5px] font-medium whitespace-nowrap text-warning">
                            Held
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "text-[11.5px] font-medium whitespace-nowrap tabular-nums",
                              row.daysLeft <= 14 ? "text-destructive" : "text-neutral-600"
                            )}
                          >
                            {Math.max(0, row.daysLeft)} days left
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-right">
                        {row.rejection.reinstate?.status === "REQUESTED" ? (
                          <span className="flex justify-end gap-2">
                            <Button
                              size="xs"
                              variant="success"
                              onClick={() => onDecide(row, true)}
                              disabled={pending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => onDecide(row, false)}
                              disabled={pending}
                            >
                              Deny
                            </Button>
                          </span>
                        ) : row.rejection.reinstate ? (
                          <StatusPill
                            status={row.rejection.reinstate.status}
                            className="px-1.5 py-0.5 text-[10.5px]"
                          />
                        ) : (
                          <span className="text-[11.5px] whitespace-nowrap text-neutral-400">
                            Not requested
                          </span>
                        )}
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
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="hidden sm:inline">
                Total {filtered.length} document{filtered.length === 1 ? "" : "s"}
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
        </>
      )}
    </Panel>
  );
}
