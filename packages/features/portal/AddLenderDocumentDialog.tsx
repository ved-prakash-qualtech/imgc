"use client";
/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   This dialog mounts once per Add Additional Document button, not in a list, so a fresh
   handler each render costs nothing; the alternative is threading every inline handler
   out to a useCallback purely to satisfy the rule. */

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import { useCallback, useRef, useState, useTransition } from "react";
import { PaperclipIcon, PlusIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { addLenderDocumentAction } from "@imgc/actions/initiateClaim";
import { Button } from "@imgc/ui/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@imgc/ui/ui/dialog";
import { cn } from "@imgc/lib/utils/twMergeUtils";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@imgc/constants/uploads";
import { attachUpload } from "@imgc/lib/uploads/attachUpload";

const ACCEPTED: readonly string[] = ACCEPTED_UPLOAD_TYPES;
const FIELD =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-ui-subhead text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

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
  const errorText = useServerErrorMessage();
  const [open, setOpen] = useState(false);
  const t = useTranslations("claimDocuments");
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

  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0] ?? null;
      setError("");
      if (!picked) return setFile(null);
      if (!ACCEPTED.includes(picked.type)) {
        setError(t("toast.fileTypeRejected"));
        return setFile(null);
      }
      if (picked.size > MAX_UPLOAD_BYTES) {
        setError(
          `That file is ${bytes(picked.size)} — the limit is ${MAX_UPLOAD_LABEL}.`
        );
        return setFile(null);
      }
      setFile(picked);
    },
    [t]
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) {
        setError(t("toast.chooseFile"));
        return;
      }
      const data = new FormData(event.currentTarget);
      data.set("claimId", claimId);
      startTransition(async () => {
        try {
          await attachUpload(data, file, accountId);
        } catch {
          toast.error(t("toast.uploadFailed"));
          return;
        }
        const result = await addLenderDocumentAction(accountId, data);
        if (!result.ok) {
          toast.error(errorText(result) ?? t("toast.documentAddFailed"));
          return;
        }
        toast.success(t("toast.documentAdded"));
        reset();
        setOpen(false);
      });
    },
    [file, claimId, accountId, reset, t, errorText]
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
          <DialogTitle>{t("additionalDialog.title")}</DialogTitle>
          <DialogDescription>
            Add one document at a time. It sits alongside the required list — it
            does not change it.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-ui-body-lg font-medium text-neutral-700">
              Document Type *
            </span>
            <input
              name="name"
              required
              placeholder={t("additionalDialog.namePlaceholder")}
              className={FIELD}
            />
          </label>

          <div>
            <span className="mb-1 block text-ui-body-lg font-medium text-neutral-700">
              Upload Document *
            </span>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-ui-subhead transition",
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
                  <span className="ml-auto shrink-0 text-ui-body-sm text-neutral-500">
                    {bytes(file.size)}
                  </span>
                </>
              ) : (
                <>
                  <UploadIcon className="size-4 shrink-0" /> Choose a file —
                  PDF, JPG, PNG or WEBP, up to {MAX_UPLOAD_LABEL}
                </>
              )}
            </label>
            {error && (
              <p
                role="alert"
                className="mt-1 text-ui-body font-medium text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-ui-body-lg font-medium text-neutral-700">
              {t("upload.remarksLabel")}
            </span>
            <textarea
              name="remarks"
              rows={2}
              placeholder={t("additionalDialog.remarkPlaceholder")}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-ui-subhead outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
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
              {t("actions.cancel")}
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
