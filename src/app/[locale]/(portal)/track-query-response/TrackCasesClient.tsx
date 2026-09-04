"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RadarIcon, SearchIcon, SearchXIcon } from "lucide-react";

import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
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
import type { ClaimRow } from "@/services/portal/claimFlow.server";
import type { ClaimStatus } from "@/server/mock/types";

const FILTERS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Query raised", value: "QUERY_RAISED" },
  { label: "Resubmitted", value: "DOCUMENTS_RESUBMITTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

function when(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** What the holder of the claim has to do next — derived, never stored. */
function requiredAction(claim: ClaimRow, isLender: boolean): string {
  if (claim.openQuery) {
    return isLender ? "Respond to the query" : "Awaiting lender response";
  }
  const map: Partial<Record<ClaimStatus, string>> = {
    DRAFT: isLender ? "Complete and submit" : "With the lender",
    SUBMITTED: isLender ? "Nothing — with IMGC" : "Begin review",
    UNDER_REVIEW: isLender ? "Nothing — with IMGC" : "Review documents",
    DOCUMENTS_RESUBMITTED: isLender ? "Nothing — with IMGC" : "Re-review documents",
    APPROVED: "None — approved",
    REJECTED: "None — rejected",
    CLOSED: "None — closed",
  };
  return map[claim.status] ?? "—";
}

/**
 * Track Claim.
 *
 * Reads claims, not accounts: a query lives on the claim, so a page driven by
 * `account.claimStatus` could never show one.
 */
export function TrackCasesClient({
  claims,
  isLender,
}: Readonly<{ claims: ClaimRow[]; isLender: boolean }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((c) => {
      if (status && c.status !== status) return false;
      if (!q) return true;
      return `${c.claimNo} ${c.caseId} ${c.customerName} ${c.typeLabel} ${c.lenderName}`
        .toLowerCase()
        .includes(q);
    });
  }, [claims, query, status]);

  return (
    <Panel
      title={`${rows.length} claim${rows.length === 1 ? "" : "s"}`}
      description="Every claim that has left draft, and what it is waiting on."
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3.5">
        <span className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Claim no, case, customer…"
            aria-label="Search claims"
            className="h-8 w-[260px] rounded-lg border border-neutral-200 pl-8 pr-2.5 text-[12.5px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </span>
        {FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition",
              status === f.value
                ? "bg-brand-primary text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim no.</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              {!isLender && <TableHead>Lender</TableHead>}
              <TableHead>Claim type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Required action</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isLender ? 10 : 11} className="py-14 text-center">
                  <SearchXIcon className="mx-auto mb-2 size-6 text-neutral-300" />
                  <p className="text-[13px] font-medium text-neutral-700">
                    No claims to track yet.
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-neutral-500">
                    A claim appears here once it has been submitted.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} className={cn(c.openQuery && "bg-warning/5")}>
                  <TableCell className="font-medium text-neutral-950">
                    {c.claimNo}
                  </TableCell>
                  <TableCell>{c.caseId}</TableCell>
                  <TableCell>{c.customerName}</TableCell>
                  {!isLender && (
                    <TableCell className="text-neutral-500">{c.lenderName}</TableCell>
                  )}
                  <TableCell className="text-neutral-500">{c.typeLabel}</TableCell>
                  <TableCell className="text-neutral-500">
                    {when(c.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={c.status} />
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {when(c.lastUpdatedAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={c.bucket} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-[12.5px]",
                        c.openQuery
                          ? "font-semibold text-warning"
                          : "text-neutral-600"
                      )}
                    >
                      {requiredAction(c, isLender)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      render={<Link href={ROUTES.claimDetails(c.id)} />}
                    >
                      <RadarIcon /> Track
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
