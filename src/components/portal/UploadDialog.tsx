"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

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
}: Readonly<{
  row: RequirementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "add" = a new file on a multi-file category (no supersede). Otherwise derived from state. */
  mode?: "upload" | "add" | "replace";
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setError("");
    if (!picked) {
      setFile(null);
      return;
    }
    if (!(ACCEPTED as readonly string[]).includes(picked.type)) {
      setError("Only PDF, JPG, PNG or WEBP files are accepted.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError(`That file is ${bytes(picked.size)} — the limit is 15 MB.`);
      setFile(null);
      return;
    }
    setFile(picked);
  }, []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row) return;
      if (!file) {
        setError("Choose a file to upload.");
        return;
      }
      const data = new FormData(event.currentTarget);
      data.set("accountId", row.accountId);
      data.set("documentId", row.id);
      data.set("file", file);

      startTransition(async () => {
        const result = await uploadRequirementAction(data);
        if (!result.ok) {
          toast.error(result.error ?? "That upload failed.");
          return;
        }
        toast.success(
          effectiveMode === "add"
            ? `File added to "${row.name}".`
            : `${row.name} ${effectiveMode === "replace" ? "replaced" : "uploaded"} — now with IMGC for review.`
        );
        reset();
        onOpenChange(false);
        router.refresh();
      });
    },
    [row, file, reset, onOpenChange, router]
  );

  if (!row) return null;
  const effectiveMode: "upload" | "add" | "replace" =
    mode ?? ((row.version ?? 0) > 0 ? "replace" : "upload");
  const isReupload = effectiveMode === "replace";

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
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[13px] transition",
                error
                  ? "border-destructive bg-destructive/5 text-destructive"
                  : file
                    ? "border-success-500 bg-success-500/5 text-neutral-800"
                    : "border-neutral-300 bg-neutral-25 text-neutral-600 hover:border-brand-primary"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={onPick}
                className="sr-only"
              />
              {file ? (
                <>
                  <PaperclipIcon className="size-4 shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-neutral-500">
                    {bytes(file.size)}
                  </span>
                </>
              ) : (
                <>
                  <UploadIcon className="size-4 shrink-0" />
                  Choose a file — PDF, JPG, PNG or WEBP, up to 15 MB
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
