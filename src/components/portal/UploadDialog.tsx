/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop */
"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { PaperclipIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { uploadRequirementAction } from "@/app/[locale]/(portal)/additional-documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";
import {
  ACCEPTED_UPLOAD_TYPES as ACCEPTED,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/constants/uploads";
import { attachUpload } from "@/lib/uploads/attachUpload";

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The lender's upload, first time or re-upload.
 *
 * File type and size are checked here as well as on the server. The client check exists so the
 * lender is told immediately rather than after a pointless upload; the server check is the one
 * that actually decides, because nothing arriving from a browser can be trusted.
 */
export function UploadDialog({
  row,
  open,
  onOpenChange,
  mode,
  replaceFileId,
}: Readonly<{
  row: RequirementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "add" = a new file on a multi-file category (no supersede). Otherwise derived from state. */
  mode?: "upload" | "add" | "replace";
  replaceFileId?: string;
}>) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFiles([]);
    setIsDragging(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const effectiveMode: "upload" | "add" | "replace" =
    mode ?? ((row?.version ?? 0) > 0 ? "replace" : "upload");
  const isReupload = effectiveMode === "replace";

  const processFiles = useCallback((pickedFiles: File[]) => {
    setError("");
    if (pickedFiles.length === 0) {
      setFiles([]);
      return;
    }
    const maxFiles = (row?.multiple && !isReupload) ? pickedFiles.length : 1;
    const filesToProcess = pickedFiles.slice(0, maxFiles);
    
    const validFiles: File[] = [];
    for (const f of filesToProcess) {
      if (!(ACCEPTED as readonly string[]).includes(f.type)) {
        setError("Only PDF, JPG, PNG or WEBP files are accepted.");
        setFiles([]);
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setError(
          filesToProcess.length > 1
            ? `One or more files exceed the limit of ${MAX_UPLOAD_LABEL}.`
            : `That file is ${bytes(f.size)} — the limit is ${MAX_UPLOAD_LABEL}.`
        );
        setFiles([]);
        return;
      }
      validFiles.push(f);
    }
    setFiles(validFiles);
  }, [row?.multiple, isReupload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(event.target.files ?? []));
  }, [processFiles]);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row) return;
      if (files.length === 0) {
        setError("Choose a file to upload.");
        return;
      }
      const baseData = new FormData(event.currentTarget);
      baseData.set("accountId", row.accountId);
      baseData.set("documentId", row.id);
      if (replaceFileId) {
        baseData.set("replaceFileId", replaceFileId);
      }

      startTransition(async () => {
        let successCount = 0;
        let failCount = 0;
        
        for (const f of files) {
          const data = new FormData();
          for (const [key, val] of baseData.entries()) {
            data.set(key, val);
          }
          try {
            await attachUpload(data, f, row.accountId);
            const result = await uploadRequirementAction(data);
            if (result.ok) successCount++;
            else failCount++;
          } catch {
            failCount++;
          }
        }

        if (successCount > 0) {
          if (files.length === 1) {
            toast.success(
              effectiveMode === "add"
                ? `File added to "${row.name}".`
                : `${row.name} ${effectiveMode === "replace" ? "replaced" : "uploaded"} — now with IMGC for review.`
            );
          } else {
            toast.success(`${successCount} files uploaded successfully.`);
          }
          
          if (failCount === 0) {
            reset();
            onOpenChange(false);
          }
        }
        
        if (failCount > 0) {
          toast.error(
            files.length === 1 
              ? "That upload failed. Please try again."
              : `${failCount} file(s) failed to upload.`
          );
        }
      });
    },
    [row, files, reset, onOpenChange, effectiveMode, replaceFileId]
  );

  if (!row) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {effectiveMode === "add"
              ? "Add file"
              : effectiveMode === "replace"
                ? "Replace"
                : "Upload"}{" "}
            · {row.name}
          </DialogTitle>
          <DialogDescription>
            {row.caseId} · {row.customerName}
            {isReupload && ` · this will be version ${(row.version ?? 0) + 1}`}
          </DialogDescription>
        </DialogHeader>

        {row.review?.remarks && isReupload && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-neutral-800">
            <span className="font-semibold">IMGC asked for: </span>
            {row.review.remarks}
          </p>
        )}
        {row.description && (
          <p className="rounded-md border border-brand-primary/15 bg-brand-light/50 px-3 py-2 text-[12.5px] text-neutral-700">
            {row.description}
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              File *
            </span>
            <label
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                "flex flex-col cursor-pointer justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[13px] transition",
                error
                  ? "border-destructive bg-destructive/5 text-destructive"
                  : isDragging
                    ? "border-brand-primary bg-brand-light/50 text-brand-primary"
                    : files.length > 0
                      ? "border-success-500 bg-success-500/5 text-neutral-800"
                      : "border-neutral-300 bg-neutral-25 text-neutral-600 hover:border-brand-primary",
                files.length === 0 ? "items-center flex-row" : ""
              )}
            >
              <input
                ref={inputRef}
                type="file"
                multiple={Boolean(row.multiple && !isReupload)}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={onPick}
                className="sr-only"
              />
              {files.length > 0 ? (
                <div className="flex flex-col gap-1.5 w-full">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <PaperclipIcon className="size-4 shrink-0 text-success-600" />
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="ml-auto shrink-0 text-[11.5px] text-neutral-500">
                        {bytes(f.size)}
                      </span>
                    </div>
                  ))}
                  {(row.multiple && !isReupload) && (
                    <div className="mt-1 flex items-center justify-center text-[11.5px] text-neutral-500 hover:text-neutral-700">
                      Click or drag to add more files
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <UploadIcon className="size-4 shrink-0" />
                  <span>
                    Choose a file or drag it here — PDF, JPG, PNG or WEBP, up to{" "}
                    {MAX_UPLOAD_LABEL}
                  </span>
                </>
              )}
            </label>
            {error && (
              <p role="alert" className="mt-1 text-[12px] font-medium text-destructive">
                {error}
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Remarks
            </span>
            <textarea
              name="remarks"
              rows={2}
              placeholder="Anything IMGC should know about this document."
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              <UploadIcon /> {isReupload ? "Re-upload" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
