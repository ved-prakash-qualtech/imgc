"use client";

import { useRef, useState } from "react";
import { Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entity: string;
  templateHeaders: string[];
  sampleRow?: string[];
  onImport?: (rows: Array<Record<string, string>>) => void;
};

export function BulkImportDialog({
  open,
  onOpenChange,
  entity,
  templateHeaders,
  sampleRow,
  onImport,
}: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setPreview([]);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 6)
      .map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
    setPreview(rows);
  };

  const downloadTemplate = () => {
    const csv = `${templateHeaders.join(",")}\n${(sampleRow ?? templateHeaders.map(() => "")).join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entity}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Bulk Import {entity}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV. First row must contain headers:{" "}
            {templateHeaders.join(", ")}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition hover:border-primary hover:bg-primary/5"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">
              {fileName ?? "Click to choose a .csv file"}
            </div>
            <div className="text-xs text-muted-foreground">
              Max 5MB · UTF-8 encoded
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          {preview.length > 1 && (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="border-b border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                Preview (first {preview.length - 1} rows)
              </div>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      {(preview[0] ?? []).map((h, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((c, j) => (
                          <td key={j} className="px-2 py-1 text-foreground/80">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4" /> Download CSV template
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!fileName}
            onClick={() => {
              const [headers, ...rows] = preview;
              const records = rows.map((row) =>
                Object.fromEntries(
                  (headers ?? []).map((header, index) => [
                    header,
                    row[index] ?? "",
                  ])
                )
              );
              onImport?.(records);
              toast.success(
                `${records.length} ${entity} draft${records.length === 1 ? "" : "s"} imported.`
              );
              close();
            }}
          >
            Validate &amp; Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
