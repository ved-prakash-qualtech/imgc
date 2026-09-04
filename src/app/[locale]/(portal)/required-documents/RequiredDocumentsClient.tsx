"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EyeIcon, SearchIcon, SearchXIcon, UploadIcon } from "lucide-react";

import { ReviewDrawer } from "@/components/portal/ReviewDrawer";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { UploadDialog } from "@/components/portal/UploadDialog";
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
import { daysUntil } from "@/constants/documents";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";

/** Rules 7 & 8, applied per case to what the lender can see. */
function completion(rows: RequirementRow[]) {
  const required = rows.filter((r) => r.required);
  const approved = required.filter((r) => r.status === "APPROVED").length;
  return {
    required: required.length,
    approved,
    underReview: required.filter((r) => r.status === "UNDER_REVIEW").length,
    pending: required.filter(
      (r) => r.status === "PENDING_UPLOAD" || r.status === "NOT_REQUESTED"
    ).length,
    reupload: required.filter((r) => r.status === "REUPLOAD_REQUIRED").length,
    rejected: required.filter((r) => r.status === "REJECTED").length,
    complete: required.length > 0 && approved === required.length,
  };
}

function Count({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: number; tone?: string }>) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("text-[15px] font-bold", tone ?? "text-neutral-900")}>
        {value}
      </span>
      <span className="text-[11.5px] text-neutral-500">{label}</span>
    </span>
  );
}

/**
 * What IMGC is asking this lender for, grouped by case.
 *
 * The lender's job is per case — gather what is outstanding on APP-100245 and send it — so the
 * page groups by case and leads each group with its completion state, rather than presenting one
 * flat list they would have to sort themselves.
 */
export function RequiredDocumentsClient({
  rows,
}: Readonly<{ rows: RequirementRow[] }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState<RequirementRow | null>(null);
  const [viewing, setViewing] = useState<RequirementRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (!q) return true;
      return `${r.caseId} ${r.customerName} ${r.name}`.toLowerCase().includes(q);
    });
  }, [rows, query, status]);

  const grouped = useMemo(() => {
    const map = new Map<string, RequirementRow[]>();
    for (const r of filtered) {
      const list = map.get(r.accountId);
      if (list) list.push(r);
      else map.set(r.accountId, [r]);
    }
    return [...map.entries()].sort((a, b) =>
      (a[1][0]?.caseId ?? "").localeCompare(b[1][0]?.caseId ?? "")
    );
  }, [filtered]);

  const outstanding = (r: RequirementRow) =>
    r.status === "PENDING_UPLOAD" ||
    r.status === "REUPLOAD_REQUIRED" ||
    r.status === "REJECTED" ||
    r.status === "NOT_REQUESTED";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Case, customer or document…"
            aria-label="Search required documents"
            className="h-9 w-[300px] rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </span>
        {["", "PENDING_UPLOAD", "UNDER_REVIEW", "REUPLOAD_REQUIRED", "REJECTED", "APPROVED"].map(
          (s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                status === s
                  ? "bg-brand-primary text-white"
                  : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
              )}
            >
              {s === "" ? "All" : s.replace(/_/g, " ").toLowerCase()}
            </button>
          )
        )}
      </div>

      {grouped.length === 0 ? (
        <Panel>
          <div className="py-14 text-center">
            <SearchXIcon className="mx-auto mb-2 size-6 text-neutral-300" />
            <p className="text-[13px] font-medium text-neutral-700">
              Nothing matches that search.
            </p>
            <p className="mt-0.5 text-[12.5px] text-neutral-500">
              IMGC has not asked for any additional document matching those filters.
            </p>
          </div>
        </Panel>
      ) : (
        grouped.map(([accountId, caseRows]) => {
          const head = caseRows[0]!;
          const c = completion(caseRows);
          return (
            <Panel
              key={accountId}
              title={`${head.caseId} · ${head.customerName}`}
              description={`${head.product} · ${head.branch}, ${head.region}`}
              actions={
                <div className="flex items-center gap-3">
                  <StatusPill status={c.complete ? "COMPLETE" : "INCOMPLETE"} />
                  <Link
                    href={ROUTES.account(accountId)}
                    className="text-[12.5px] font-semibold text-brand-primary hover:underline"
                  >
                    Open case
                  </Link>
                </div>
              }
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-b border-neutral-100 bg-neutral-25 px-5 py-2.5">
                <Count label="required" value={c.required} />
                <Count label="approved" value={c.approved} tone="text-success-700" />
                <Count label="under review" value={c.underReview} tone="text-info" />
                <Count label="pending" value={c.pending} tone="text-neutral-700" />
                <Count label="re-upload" value={c.reupload} tone="text-warning" />
                <Count label="rejected" value={c.rejected} tone="text-destructive" />
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {caseRows.map((r) => {
                      const due = r.dueDate ? daysUntil(r.dueDate) : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <span className="font-medium text-neutral-900">{r.name}</span>
                            <span className="block text-[11.5px] text-neutral-500">
                              {r.category}
                              {r.version > 0 && ` · v${r.version}`}
                              {due !== null && outstanding(r) && (
                                <span
                                  className={cn(
                                    "ml-1.5 font-semibold",
                                    due < 0 ? "text-destructive" : due <= 3 ? "text-warning" : ""
                                  )}
                                >
                                  {due < 0
                                    ? `overdue by ${Math.abs(due)}d`
                                    : due === 0
                                      ? "due today"
                                      : `due in ${due}d`}
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                                r.required
                                  ? "bg-neutral-100 text-neutral-600"
                                  : "bg-neutral-50 text-neutral-400"
                              )}
                            >
                              {r.required ? "Required" : "Optional"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusPill status={r.status} />
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <span className="line-clamp-2 text-[12.5px] text-neutral-600">
                              {r.latestRemark || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              {r.status !== "APPROVED" && (
                                <Button size="xs" onClick={() => setUploading(r)}>
                                  <UploadIcon />
                                  {r.version > 0 ? "Re-upload" : "Upload"}
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setViewing(r)}
                              >
                                <EyeIcon /> View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          );
        })
      )}

      <UploadDialog
        row={uploading}
        open={uploading !== null}
        onOpenChange={(next) => !next && setUploading(null)}
      />
      <ReviewDrawer
        row={viewing}
        open={viewing !== null}
        onOpenChange={(next) => !next && setViewing(null)}
        readOnly
      />
    </>
  );
}
