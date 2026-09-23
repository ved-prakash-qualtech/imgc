"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { bulkMarkRefundReceivedAction } from "@/app/[locale]/(portal)/admin/bulk-refund/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/twMergeUtils";
import type {
  BulkRefundResult,
  BulkRefundRow,
} from "@/services/portal/claimFlow.server";

const SAMPLE_CSV =
  "Date,Claim No.,UTR No.,Amount\n2026-09-01,CLM-2026-00003,UTR2026090112345,500000\n";

function downloadSampleCsv(): void {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bulk-refund-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** One line of the "Date, Claim No., UTR No., Amount" CSV, quoted-field aware. None of these four
 *  are expected to contain a comma, but a quoted field is still honoured if one shows up. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    // `i` is the loop's own bounded counter over this string, not a derived/user-supplied key.
    // eslint-disable-next-line security/detect-object-injection
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/** Finds a column by a header keyword, falling back to a fixed position when the header doesn't
 *  name it clearly — so a file that just says "Ref" instead of "UTR No." in the third column
 *  still works, rather than rejecting the whole file over a header wording mismatch. */
function columnIndex(
  header: string[],
  keyword: string,
  fallbackPosition: number
): number {
  const named = header.findIndex((h) => h.includes(keyword));
  return named === -1 ? fallbackPosition : named;
}

/** Parses "Date, Claim No., UTR No., Amount" (any header casing/spacing/order) into rows,
 *  skipping blank lines. Returns `null` when the file has no recognisable claim-number column at
 *  all, so the caller can say so rather than silently uploading zero rows. */
function parseCsv(text: string): BulkRefundRow[] | null {
  const [headerLine, ...dataLines] = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (!headerLine) return null;

  const header = splitCsvLine(headerLine).map((h) => h.toLowerCase());
  const claimCol = header.findIndex((h) => h.includes("claim"));
  if (claimCol === -1) return null;
  const dateCol = columnIndex(header, "date", 0);
  const utrCol = columnIndex(header, "utr", 2);
  const amountCol = columnIndex(header, "amount", 3);

  return dataLines.map((line) => {
    const cells = splitCsvLine(line);
    // `dateCol`/`claimCol`/`utrCol`/`amountCol` are indices this same function derived from the
    // header row just above — a small bounded position, never an arbitrary/user-supplied key.
    /* eslint-disable security/detect-object-injection */
    return {
      paymentDate: cells[dateCol] ?? "",
      claimNo: cells[claimCol] ?? "",
      utr: cells[utrCol] ?? "",
      amount: Number(cells[amountCol]) || 0,
    };
    /* eslint-enable security/detect-object-injection */
  });
}

export function BulkRefundClient() {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<BulkRefundRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [results, setResults] = useState<BulkRefundResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPickFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0] ?? null;
      setResults(null);
      setParseError("");
      setRows(null);
      if (!picked) return;
      setFileName(picked.name);
      picked.text().then((text) => {
        const parsed = parseCsv(text);
        if (!parsed) {
          setParseError(
            'Could not find a "Claim No." column — check the file against the template.'
          );
          return;
        }
        if (parsed.length === 0) {
          setParseError("The file has a header row but no data rows.");
          return;
        }
        setRows(parsed);
      });
    },
    []
  );

  const onUpload = useCallback(() => {
    if (!rows) return;
    startTransition(async () => {
      const result = await bulkMarkRefundReceivedAction(rows);
      if (!result.ok || !result.results) {
        toast.error(result.error ?? "The upload could not be processed.");
        return;
      }
      setResults(result.results);
      const okCount = result.results.filter((r) => r.ok).length;
      if (okCount === result.results.length) {
        toast.success(
          `${okCount} of ${result.results.length} claims recorded.`
        );
      } else {
        toast.error(
          `${okCount} of ${result.results.length} claims recorded — see the list below.`
        );
      }
    });
  }, [rows]);

  const reset = useCallback(() => {
    setRows(null);
    setResults(null);
    setFileName("");
    setParseError("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Bulk Refund Upload"
        description="Upload a CSV of Date, Claim No., UTR No. and Amount to record several refunds received in one pass — the same rule the one-at-a-time Refund Received button uses, run once per row."
      >
        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[12.5px] text-neutral-700">
            Only claims currently <strong>Approved</strong> are updated. Amount
            is free entry from the IMGC team — not checked against the computed
            claim amount, since a genuine partial settlement is a real case.
            Full payment/settlement handling (proof files per row,
            reconciliation, editing after entry) is not part of this — see the
            one-at-a-time Refund Received button on a claim for attaching proof.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadSampleCsv}>
              <DownloadIcon /> Download CSV template
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
              <UploadIcon className="size-3.5" /> Choose CSV
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onPickFile}
                className="sr-only"
              />
            </label>
            {fileName && (
              <span className="text-[12px] text-neutral-500">{fileName}</span>
            )}
          </div>

          {parseError && (
            <p
              role="alert"
              className="text-[12.5px] font-medium text-destructive"
            >
              {parseError}
            </p>
          )}

          {rows && !results && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-neutral-600">
                {rows.length} row{rows.length === 1 ? "" : "s"} found. Nothing
                is saved until you click Upload.
              </p>
              <div className="max-h-[300px] overflow-auto rounded-lg border border-neutral-100">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-[11px]">Date</TableHead>
                      <TableHead className="h-8 text-[11px]">
                        Claim No.
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">UTR No.</TableHead>
                      <TableHead className="h-8 text-[11px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={`${r.claimNo}-${i}`}>
                        <TableCell className="px-3 py-1.5 text-[12.5px]">
                          {r.paymentDate || (
                            <span className="text-destructive">missing</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-[12.5px]">
                          {r.claimNo || (
                            <span className="text-destructive">missing</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-[12.5px]">
                          {r.utr || <span className="text-neutral-400">—</span>}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-[12.5px] tabular-nums">
                          {r.amount > 0 ? (
                            r.amount.toLocaleString("en-IN")
                          ) : (
                            <span className="text-destructive">missing</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reset}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={onUpload} disabled={pending}>
                  Upload {rows.length} row{rows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}

          {results && (
            <div className="flex flex-col gap-3">
              <div className="max-h-[300px] overflow-auto rounded-lg border border-neutral-100">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-[11px]">
                        Claim No.
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={`${r.claimNo}-${i}`}>
                        <TableCell className="px-3 py-1.5 text-[12.5px] font-medium">
                          {r.claimNo}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "px-3 py-1.5 text-[12.5px]",
                            r.ok ? "text-success-700" : "text-destructive"
                          )}
                        >
                          {r.ok ? "Recorded" : r.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button size="sm" variant="outline" onClick={reset}>
                Upload another file
              </Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
