import { CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClaimQuery, ClaimStatusEntry } from "@/server/mock/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type HistoryRow = Readonly<{
  at: string;
  activity: string;
  by: string;
  role: string;
  remarks: string;
}>;

/** Turns the claim's own status transitions into history rows. */
function fromStatusHistory(history: readonly ClaimStatusEntry[]): HistoryRow[] {
  return history.map((entry) => ({
    at: entry.at,
    activity: CLAIM_STATUS_LABELS[entry.status],
    by: entry.byName,
    role: entry.byRole,
    remarks: entry.note ?? "—",
  }));
}

/** Queries are their own record, not status transitions — folded in here rather than modelled
 *  as a second history, so one table shows everything that happened to the claim in order. */
function fromQueries(queries: readonly ClaimQuery[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const q of queries) {
    rows.push({
      at: q.raisedAt,
      activity: "Query Raised",
      by: q.raisedByName,
      role: "IMGC",
      remarks: q.reason,
    });
    if (q.respondedAt) {
      rows.push({
        at: q.respondedAt,
        activity: "Query Response Submitted",
        by: q.respondedByName ?? "Lender",
        role: "LENDER",
        remarks: q.responseRemarks || "—",
      });
    }
  }
  return rows;
}

/**
 * Claim History — the fourth and final section of Track Claim.
 *
 * Read-only, chronological, and built entirely from data the claim engine already records: its
 * own `statusHistory` plus the queries raised against it. No parallel activity log is introduced;
 * a status transition and a query response are both already real, timestamped records.
 */
export function ClaimHistory({
  statusHistory,
  queries,
}: Readonly<{
  statusHistory: readonly ClaimStatusEntry[];
  queries: readonly ClaimQuery[];
}>) {
  const rows = [...fromStatusHistory(statusHistory), ...fromQueries(queries)].sort(
    (a, b) => a.at.localeCompare(b.at)
  );

  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
        No history recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date &amp; Time</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Performed By</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`${row.at}-${row.activity}-${i}`}>
              <TableCell className="whitespace-nowrap text-neutral-500">
                {when(row.at)}
              </TableCell>
              <TableCell className="font-medium text-neutral-900">
                {row.activity}
              </TableCell>
              <TableCell>
                {row.by}
                <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {row.role}
                </span>
              </TableCell>
              <TableCell className="max-w-[320px]">
                <span className="line-clamp-2 text-[12.5px] text-neutral-600">
                  {row.remarks}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
