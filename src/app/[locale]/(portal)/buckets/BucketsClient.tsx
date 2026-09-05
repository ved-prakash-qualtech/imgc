"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRightIcon,
  DownloadIcon,
  MailPlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  setPushRecipientsAction,
  shiftBucketAction,
} from "@/app/[locale]/(portal)/buckets/actions";
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
import type { AccountRow } from "@/services/portal/accounts.server";

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: AccountRow[]): void {
  const headers = ["Loan No", "Borrower", "Lender", "Bucket", "Claim", "Extra Recipients"];
  const lines = rows.map((a) =>
    [a.loanNo, a.borrowerName, a.lenderOrgName, a.bucket, a.claimStatus, a.pushRecipients.join("; ")]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `processing-buckets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function BucketsClient({
  accounts,
}: Readonly<{ accounts: AccountRow[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [recipients, setRecipients] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      `${a.loanNo} ${a.borrowerName} ${a.lenderOrgName}`.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const pageCount = Math.ceil(rows.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExport = useCallback(() => downloadCsv(rows), [rows]);

  const onShift = useCallback(
    (account: AccountRow) => {
      const to = account.bucket === "IMGC" ? "LENDER" : "IMGC";
      startTransition(async () => {
        const result = await shiftBucketAction(account.id, to, "");
        if (!result.ok) {
          toast.error(result.error ?? "That move failed.");
          return;
        }
        toast.success(
          `${account.loanNo} moved to the ${to} bucket — stakeholders notified.`
        );
        router.refresh();
      });
    },
    [router]
  );

  const onSaveRecipients = useCallback(
    (accountId: string) => {
      startTransition(async () => {
        const result = await setPushRecipientsAction(accountId, recipients);
        if (!result.ok) {
          toast.error(result.error ?? "Those recipients could not be saved.");
          return;
        }
        toast.success("Notification recipients updated.");
        setEditing(null);
        router.refresh();
      });
    },
    [recipients, router]
  );

  return (
    <Panel
      title={`${rows.length} account${rows.length === 1 ? "" : "s"}`}
      description="Moving an account emails the lender's stakeholders, every IMGC mailbox, and any extra recipients pinned to the account."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport}>
          <DownloadIcon /> Export CSV
        </Button>
      }
    >
      <div className="border-b border-neutral-100 px-4 py-2.5">
        <div className="relative w-fit">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Loan no, borrower, lender…"
            aria-label="Search accounts"
            className="h-8 w-[260px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan no.</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Lender</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Claim</TableHead>
              <TableHead>Extra recipients</TableHead>
              <TableHead className="text-right">Move</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-[13px] text-neutral-500">
                  No accounts match your search.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={ROUTES.account(a.id)}
                      className="inline-flex items-center rounded-full bg-info/12 px-2.5 py-0.5 text-[12px] font-semibold text-info hover:underline"
                    >
                      {a.loanNo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-neutral-900">
                    {a.borrowerName}
                  </TableCell>
                  <TableCell className="text-neutral-500">{a.lenderOrgName}</TableCell>
                  <TableCell>
                    <StatusPill status={a.bucket} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={a.claimStatus} />
                  </TableCell>
                  <TableCell>
                    {editing === a.id ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          // Replaces the cell the user just clicked to edit, so focus follows
                          // the action they took.
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          value={recipients}
                          onChange={(e) => setRecipients(e.target.value)}
                          placeholder="a@x.com, b@y.com"
                          aria-label="Extra notification recipients"
                          className="h-8 w-[220px] rounded-lg border border-neutral-200 px-2.5 text-[12.5px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        />
                        <Button
                          size="xs"
                          onClick={() => onSaveRecipients(a.id)}
                          disabled={pending}
                        >
                          Save
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(a.id);
                          setRecipients(a.pushRecipients.join(", "));
                        }}
                        className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600 hover:text-brand-primary"
                      >
                        <MailPlusIcon className="size-3.5" />
                        {a.pushRecipients.length > 0
                          ? a.pushRecipients.join(", ")
                          : "Add"}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onShift(a)}
                      disabled={pending}
                    >
                      <ArrowLeftRightIcon />
                      To {a.bucket === "IMGC" ? "Lender" : "IMGC"}
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
            Total {rows.length} account{rows.length === 1 ? "" : "s"}
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
