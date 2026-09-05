"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperclipIcon, PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { addLenderDocumentAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/twMergeUtils";

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const FIELD =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Add one additional document to the claim.
 *
 * One at a time, no limit: submit closes the dialog and the document lands in the list; open it
 * again for the next. The name is the lender's own — this never edits the configured checklist.
 */
export function AddLenderDocumentDialog({
  accountId,
  claimId,
}: Readonly<{ accountId: string; claimId: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setError("");
    formRef.current?.reset();
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setError("");
    if (!picked) return setFile(null);
    if (!ACCEPTED.includes(picked.type)) {
      setError("Only PDF, JPG, PNG or WEBP files are accepted.");
      return setFile(null);
    }
    if (picked.size > MAX_BYTES) {
      setError(`That file is ${bytes(picked.size)} — the limit is 15 MB.`);
      return setFile(null);
    }
    setFile(picked);
  }, []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) {
        setError("Choose a file to upload.");
        return;
      }
      const data = new FormData(event.currentTarget);
      data.set("claimId", claimId);
      data.set("file", file);
      startTransition(async () => {
        const result = await addLenderDocumentAction(accountId, data);
        if (!result.ok) {
          toast.error(result.error ?? "That document could not be added.");
          return;
        }
        toast.success("Additional document added.");
        reset();
        setOpen(false);
        router.refresh();
      });
    },
    [file, claimId, accountId, reset, router]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon /> Add Additional Document
      </Button>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add additional document</DialogTitle>
          <DialogDescription>
            Add one document at a time. It sits alongside the required list — it does not change
            it.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Document Name *
            </span>
            <input
              name="name"
              required
              placeholder="e.g. NOC"
              className={FIELD}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Description
            </span>
            <input
              name="description"
              placeholder="e.g. No Objection Certificate from the builder"
              className={FIELD}
            />
          </label>

          <div>
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Upload Document *
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
                  <UploadIcon className="size-4 shrink-0" /> Choose a file — PDF, JPG, PNG or
                  WEBP, up to 15 MB
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
              placeholder="e.g. NOC received from builder."
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              <PlusIcon /> Add Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
