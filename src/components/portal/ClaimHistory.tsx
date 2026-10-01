"use client";

import { useTranslations } from "next-intl";

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
function fromStatusHistory(
  history: readonly ClaimStatusEntry[],
  tStatus: (key: string) => string
): HistoryRow[] {
  return history.map((entry) => ({
    at: entry.at,
    // The catalogue is the label of record; CLAIM_STATUS_LABELS stays the fallback for a
    // status the catalogue has not been given a name for yet.
    activity: tStatus(entry.status) || CLAIM_STATUS_LABELS[entry.status],
    by: entry.byName,
    role: entry.byRole,
    remarks: entry.note ?? "—",
  }));
}

/** Queries are their own record, not status transitions — folded in here rather than modelled
 *  as a second history, so one table shows everything that happened to the claim in order. */
function fromQueries(
  queries: readonly ClaimQuery[],
  t: (key: string) => string
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const q of queries) {
    rows.push({
      at: q.raisedAt,
      activity: t("queryRaised"),
      by: q.raisedByName,
      role: "IMGC",
      remarks: q.reason,
    });
    if (q.respondedAt) {
      rows.push({
        at: q.respondedAt,
        activity: t("queryResponseSubmitted"),
        by: q.respondedByName ?? t("lender"),
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
  const t = useTranslations("claim.claimHistory");
  const tStatus = useTranslations("status");
  const rows = [
    ...fromStatusHistory(statusHistory, (k) =>
      tStatus.has(k) ? tStatus(k) : ""
    ),
    ...fromQueries(queries, t),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-ui-subhead text-neutral-500">
        {t("empty")}
      </p>
    );
  }

  return (
    // 10 rows visible (32px header + 10 × ~30px row) before it scrolls.
    <div className="custom-scrollbar max-h-[334px] overflow-y-auto overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-1.5 text-ui-caption sticky top-0 bg-white shadow-sm z-10">
              {t("columns.dateTime")}
            </TableHead>
            <TableHead className="h-8 px-1.5 text-ui-caption sticky top-0 bg-white shadow-sm z-10">
              {t("columns.activity")}
            </TableHead>
            <TableHead className="h-8 px-1.5 text-ui-caption sticky top-0 bg-white shadow-sm z-10">
              {t("columns.performedBy")}
            </TableHead>
            <TableHead className="h-8 px-1.5 text-ui-caption sticky top-0 bg-white shadow-sm z-10">
              {t("columns.remarks")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`${row.at}-${row.activity}-${i}`}>
              <TableCell className="px-1.5 py-1.5 text-ui-body-sm whitespace-nowrap text-neutral-500">
                {when(row.at)}
              </TableCell>
              <TableCell className="px-1.5 py-1.5 text-ui-body font-medium whitespace-nowrap text-neutral-900">
                {row.activity}
              </TableCell>
              <TableCell className="px-1.5 py-1.5 text-ui-body whitespace-nowrap">
                {row.by}
                <span className="ml-1 rounded bg-neutral-100 px-1 py-0.5 text-ui-micro-lg font-semibold uppercase tracking-wide text-neutral-500">
                  {row.role}
                </span>
              </TableCell>
              <TableCell className="max-w-[320px] px-1.5 py-1.5">
                <span className="line-clamp-2 text-ui-body-sm text-neutral-600">
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
