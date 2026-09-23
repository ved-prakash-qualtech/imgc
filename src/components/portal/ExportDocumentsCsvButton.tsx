"use client";

import { useCallback } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DocumentRow } from "@/services/portal/claims.server";

/** Escapes one CSV field. */
function csvField(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const STATUS: Record<string, string> = {
  PENDING_UPLOAD: "Pending",
  UNDER_REVIEW: "Under review",
  APPROVED: "Accepted",
  REJECTED: "Ineligible",
  REUPLOAD_REQUIRED: "Re-upload required",
  NOT_REQUESTED: "Not requested",
};

/**
 * Exports the Decision tab's document table — one line per file, with the lender's remark and
 * IMGC's decision on it in full (the table itself shortens them to fit). A document with nothing
 * uploaded still gets a line, so the export shows what is missing as well as what is in.
 */
export function ExportDocumentsCsvButton({
  docs,
  fileName,
}: Readonly<{ docs: DocumentRow[]; fileName: string }>) {
  const onExport = useCallback(() => {
    const headers = [
      "Document Type",
      "Mandatory",
      "Document Status",
      "File Name",
      "Size (bytes)",
      "Lender Remark",
      "IMGC Decision",
      "IMGC Remark",
      "Decided By",
      "Decided At",
      "Uploaded By",
      "Uploaded At",
    ];
    const lines: string[] = [];
    for (const doc of docs) {
      const base = [
        doc.name,
        doc.required ? "Yes" : "No",
        STATUS[doc.status] ?? doc.status,
      ];
      if (doc.files.length === 0) {
        lines.push(
          [...base, "", "", "", "", "", "", "", "", ""].map(csvField).join(",")
        );
        continue;
      }
      for (const f of doc.files) {
        const r = f.review;
        lines.push(
          [
            ...base,
            f.originalName,
            f.size,
            f.uploadRemarks?.trim() ?? "",
            r ? (r.decision === "APPROVED" ? "Accepted" : "Ineligible") : "",
            r?.remarks ?? "",
            r?.byName ?? "",
            r?.at ? new Date(r.at).toLocaleString("en-IN") : "",
            f.uploadedByName,
            new Date(f.uploadedAt).toLocaleString("en-IN"),
          ]
            .map(csvField)
            .join(",")
        );
      }
    }
    const csv = [headers.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [docs, fileName]);

  // Nothing to export means no button, rather than a greyed-out one.
  if (docs.length === 0) return null;
  return (
    <Button type="button" size="sm" variant="outline" onClick={onExport}>
      <DownloadIcon /> Export CSV
    </Button>
  );
}
