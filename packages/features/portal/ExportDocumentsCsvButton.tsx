"use client";

import { useCallback } from "react";
import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@imgc/ui/ui/button";
import type { DocumentRow } from "@imgc/data/services/portal/claims.server";

/** Escapes one CSV field. */
function csvField(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_STATUSES = new Set([
  "PENDING_UPLOAD",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REUPLOAD_REQUIRED",
  "NOT_REQUESTED",
]);

/**
 * Exports the Decision tab's document table — one line per file, with the lender's remark and
 * IMGC's decision on it in full (the table itself shortens them to fit). A document with nothing
 * uploaded still gets a line, so the export shows what is missing as well as what is in.
 */
export function ExportDocumentsCsvButton({
  docs,
  fileName,
}: Readonly<{ docs: DocumentRow[]; fileName: string }>) {
  const t = useTranslations("claimDocuments.export");
  const onExport = useCallback(() => {
    const headers = [
      t("headers.documentType"),
      t("headers.mandatory"),
      t("headers.documentStatus"),
      t("headers.fileName"),
      t("headers.sizeBytes"),
      t("headers.lenderRemark"),
      t("headers.imgcDecision"),
      t("headers.imgcRemark"),
      t("headers.decidedBy"),
      t("headers.decidedAt"),
      t("headers.uploadedBy"),
      t("headers.uploadedAt"),
    ];
    const lines: string[] = [];
    for (const doc of docs) {
      const base = [
        doc.name,
        doc.required ? t("yes") : t("no"),
        EXPORT_STATUSES.has(doc.status)
          ? t(`status.${doc.status}` as "status.APPROVED")
          : doc.status,
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
            r
              ? t(
                  r.decision === "APPROVED"
                    ? "status.APPROVED"
                    : "status.REJECTED"
                )
              : "",
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
  }, [docs, fileName, t]);

  // Nothing to export means no button, rather than a greyed-out one.
  if (docs.length === 0) return null;
  return (
    <Button type="button" size="sm" variant="outline" onClick={onExport}>
      <DownloadIcon /> {t("button")}
    </Button>
  );
}
