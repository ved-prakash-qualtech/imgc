"use client";
/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop --
   Handlers here close over the row they act on, so hoisting them out of the map would mean
   threading the row back through a prop for no gain; this table renders at most 50 rows. */

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ArchiveIcon,
  BrushCleaningIcon,
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveDocumentAction,
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
      <SortIcon
        column={column}
        sortKey={sortKey}
        sortDirection={sortDirection}
      />
    </div>
  </TableHead>
);

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Mirrors the Retention column's own precedence — see the table body below. */
function retentionCsvValue(r: RejectedDocRow): string {
  if (r.rejection.archived) return "Kept";
  if (r.rejection.reinstate?.status === "REQUESTED")
    return "Reinstate requested";
  return String(Math.max(0, r.daysLeft));
}

function downloadCsv(rows: RejectedDocRow[]): void {
  const headers = [
    "Document",
    "Loan No",
    "Borrower",
    "Lender",
    "Reason",
    "Days Left",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.accountLoanNo,
      r.borrowerName,
      r.lenderOrgName,
      r.rejection.reason,
      retentionCsvValue(r),
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
}: Readonly<{ rows: RejectedDocRow[] }>) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  /**
   * Reinstatement state, which is what this screen is actually worked from: "Awaiting decision"
   * is the only value that needs an action, and those rows are otherwise scattered through seven
   * pages of documents nobody has asked to reinstate. `NONE` covers a row with no `reinstate`
   * record at all — rendered as "Not requested".
   */
  const [reinstateFilter, setReinstateFilter] = useState<
    "ALL" | "REQUESTED" | "APPROVED" | "DENIED" | "NONE"
  >("ALL");

  function handleReinstateFilterChange(v: string) {
    setReinstateFilter(v as typeof reinstateFilter);
    setPage(1);
  }

  const [lenderFilter, setLenderFilter] = useState("ALL");

  function handleLenderFilterChange(v: string) {
    setLenderFilter(v);
    setPage(1);
  }

  /** Built from the rows themselves rather than a fixed list, so a newly onboarded lender appears
   *  here the moment one of its documents is rejected — and a lender with nothing rejected never
   *  offers an option that returns an empty table. */
  const lenders = useMemo(
    () => Array.from(new Set(rows.map((r) => r.lenderOrgName))).sort(),
    [rows]
  );

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
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = rows;
    if (reinstateFilter !== "ALL") {
      result = result.filter((r) =>
        reinstateFilter === "NONE"
          ? !r.rejection.reinstate
          : r.rejection.reinstate?.status === reinstateFilter
      );
    }
    if (lenderFilter !== "ALL") {
      result = result.filter((r) => r.lenderOrgName === lenderFilter);
    }
    if (q) {
      result = result.filter((r) =>
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
          case "document":
            valA = a.name;
            valB = b.name;
            break;
          case "account":
            valA = a.accountLoanNo;
            valB = b.accountLoanNo;
            break;
          case "lender":
            valA = a.lenderOrgName;
            valB = b.lenderOrgName;
            break;
          case "reason":
            valA = a.rejection.reason;
            valB = b.rejection.reason;
            break;
          case "retention":
            valA = a.held ? Infinity : a.daysLeft;
            valB = b.held ? Infinity : b.daysLeft;
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
  }, [rows, query, reinstateFilter, lenderFilter, sortKey, sortDirection]);

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
    });
  }, []);

  const onArchive = useCallback((row: RejectedDocRow) => {
    startTransition(async () => {
      const result = await archiveDocumentAction(
        row.accountId,
        row.id,
        row.replaced?.fileId
      );
      if (!result.ok) {
        toast.error(result.error ?? "That document could not be archived.");
        return;
      }
      toast.success("Document archived — kept on record.");
    });
  }, []);

  const onDecide = useCallback((row: RejectedDocRow, approve: boolean) => {
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
    });
  }, []);

  return (
    <Panel
      title={`${filtered.length} rejected document${filtered.length === 1 ? "" : "s"}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSweep}
            disabled={pending}
          >
            <BrushCleaningIcon /> Run sweep
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
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
        <div className="relative">
          <select
            aria-label="Retained"
            value={reinstateFilter}
            onChange={(e) => handleReinstateFilterChange(e.target.value)}
            className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          >
            <option value="ALL">All retained</option>
            <option value="REQUESTED">Awaiting decision</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
            <option value="NONE">Not requested</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
        </div>
        {/* Hidden for a lender signing in to their own retention list: the rows are all theirs,
            so the only option a lender could pick is the one already applied. */}
        {lenders.length > 1 && (
          <div className="relative">
            <select
              aria-label="Lender"
              value={lenderFilter}
              onChange={(e) => handleLenderFilterChange(e.target.value)}
              className="h-8 max-w-[190px] appearance-none truncate rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="ALL">All lenders</option>
              {lenders.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
          Nothing is currently rejected.
        </p>
      ) : (
        <>
          {/* No height cap: the page size bounds the table to six rows, so a scroll container
              here would only add a second, redundant scrollbar inside the page's own. */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="document"
                    label="Document"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onToggle={toggleSort}
                  />
                  <SortableTableHead
                    column="account"
                    label="Account"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onToggle={toggleSort}
                  />
                  <SortableTableHead
                    column="lender"
                    label="Lender"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onToggle={toggleSort}
                  />
                  <SortableTableHead
                    column="reason"
                    label="Reason"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onToggle={toggleSort}
                  />
                  <SortableTableHead
                    column="retention"
                    label="Retention"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onToggle={toggleSort}
                  />
                  <TableHead className="h-8 px-1.5 text-[10.5px]">
                    Retained
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-[13px] text-neutral-500"
                    >
                      No documents match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentRows.map((row) => (
                    <TableRow key={row.rowKey}>
                      <TableCell className="px-1.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-950">
                        {row.name}
                        {/* The requirement name alone ("Property Documents") does not say which
                            file was rejected, and the requirement may since hold a newer one. The
                            server resolves the rejected version and only that version is offered
                            here, so the row always opens the document history, never its
                            replacement. */}
                        {row.rejectedFile ? (
                          <a
                            href={`/api/portal/files/${row.rejectedFile.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex max-w-[220px] items-center gap-1 text-[10.5px] font-medium text-brand-primary hover:underline"
                            title={`View the rejected file — ${row.rejectedFile.name} (uploaded ${new Date(row.rejectedFile.uploadedAt).toLocaleDateString("en-IN")})`}
                          >
                            <EyeIcon className="size-3 shrink-0" />
                            <span className="truncate">
                              {row.rejectedFile.name}
                            </span>
                          </a>
                        ) : (
                          <span className="block text-[10.5px] font-normal text-neutral-400">
                            file no longer held
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {/* Every row here belongs to a claim (`listRejectedDocuments` lists no
                            other kind), so the account's Query/Decision tab can always show the
                            document this row is about. */}
                        <Link
                          href={`${ROUTES.account(row.accountId)}?tab=query-trail`}
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
                      <TableCell className="max-w-[260px] overflow-hidden px-1.5 py-1.5 text-[11.5px] text-neutral-600">
                        {/* Cells here inherit `white-space: nowrap`, so a long reason used to run
                            straight over the Retention column instead of stopping at the cell. */}
                        <span
                          className="block truncate"
                          title={row.rejection.reason}
                        >
                          {row.rejection.reason}
                        </span>
                        <span className="block text-[10.5px] text-neutral-400">
                          by {row.rejection.by} ·{" "}
                          {new Date(row.rejection.at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {row.rejection.archived ? (
                          <span className="text-[11.5px] font-medium whitespace-nowrap text-neutral-500">
                            Kept
                          </span>
                        ) : row.rejection.reinstate?.status === "REQUESTED" ? (
                          // A pending reinstatement already gets its own Approve/Deny controls in
                          // the Retained column — naming the actual status here ("Reinstate
                          // requested") is more useful than a bare "Held" label, and still reads
                          // as paused rather than counting down to a purge. A resolved request
                          // (approved clears the rejection outright; denied) falls through to the
                          // ordinary countdown below, same as before.
                          <StatusPill
                            status={row.rejection.reinstate.status}
                            flat
                            className="text-[11.5px]"
                          />
                        ) : (
                          <span
                            className={cn(
                              "text-[11.5px] font-medium whitespace-nowrap tabular-nums",
                              row.daysLeft <= 14
                                ? "text-destructive"
                                : "text-neutral-600"
                            )}
                          >
                            {Math.max(0, row.daysLeft)} days left
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5">
                        {row.rejection.reinstate?.status === "REQUESTED" ? (
                          <span className="flex gap-2">
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
                            flat
                            className="text-[10.5px]"
                          />
                        ) : row.rejection.archived ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium whitespace-nowrap text-neutral-600"
                            title={`Archived by ${row.rejection.archived.by}`}
                          >
                            <ArchiveIcon className="size-3.5" /> Archived
                          </span>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => onArchive(row)}
                            disabled={pending}
                            title="Archive — keep this rejected document on record"
                          >
                            <ArchiveIcon /> Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-5 py-2">
            <div className="flex items-center gap-3 text-[12px] text-neutral-500">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-[70px] bg-white text-[12px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5" className="text-[12px]">
                      5
                    </SelectItem>
                    <SelectItem value="10" className="text-[12px]">
                      10
                    </SelectItem>
                    <SelectItem value="20" className="text-[12px]">
                      20
                    </SelectItem>
                    <SelectItem value="50" className="text-[12px]">
                      50
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="hidden sm:inline">
                Total {filtered.length} document
                {filtered.length === 1 ? "" : "s"}
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
        </>
      )}
    </Panel>
  );
}
