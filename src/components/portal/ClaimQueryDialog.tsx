"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  askQuestionAction,
  raiseQueryAction,
} from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/twMergeUtils";

/**
 * Raise a query on a claim, from the claim's own page.
 *
 * The same button for both roles, but not the same act: IMGC raises a formal query that halts
 * the claim and sends it back to the lender; a lender only asks a question, and the claim status
 * is untouched. Letting a lender do the former would let them park their own claim and stop the
 * clock, so the two go through different server actions.
 */
export function ClaimQueryDialog({
  claimId,
  claimNo,
  role,
  requestableDocuments = [],
}: Readonly<{
  claimId: string;
  claimNo: string;
  role: "IMGC" | "LENDER";
  requestableDocuments?: readonly string[];
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [requested, setRequested] = useState<string[]>([]);
  const [error, setError] = useState("");

  const isImgc = role === "IMGC";

  const toggleDoc = useCallback((name: string) => {
    setRequested((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!reason.trim()) {
        setError(
          isImgc
            ? "A query needs a reason — it is all the lender will see."
            : "Type your question first."
        );
        return;
      }
      startTransition(async () => {
        const result = isImgc
          ? await raiseQueryAction(claimId, {
              reason,
              remarks,
              requestedDocuments: requested,
            })
          : await askQuestionAction(
              claimId,
              `${reason}${remarks ? ` — ${remarks}` : ""}`
            );
        if (!result.ok) {
          toast.error(result.error ?? "That could not be sent.");
          return;
        }
        toast.success(
          isImgc
            ? `Query raised on ${claimNo} — the lender has been notified.`
            : `Question sent to IMGC on ${claimNo}.`
        );
        setReason("");
        setRemarks("");
        setRequested([]);
        setError("");
        setOpen(false);
        router.refresh();
      });
    },
    [isImgc, reason, remarks, requested, claimId, claimNo, router]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MessageSquarePlusIcon />
        {isImgc ? "Raise Query" : "Ask a Question"}
      </Button>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isImgc ? "Raise a query" : "Ask a question"} · {claimNo}
          </DialogTitle>
          <DialogDescription>
            {isImgc
              ? "The claim goes back to the lender until they respond."
              : "Your question reaches the IMGC processor. The claim status is unchanged."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              {isImgc ? "Reason *" : "Your question *"}
            </span>
            <input
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              placeholder={
                isImgc
                  ? "e.g. Please upload the latest NOC document."
                  : "e.g. Which valuation date should the report carry?"
              }
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:ring-2",
                error
                  ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                  : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/20"
              )}
            />
            {error && (
              <span
                role="alert"
                className="mt-1 block text-[12px] font-medium text-destructive"
              >
                {error}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              {isImgc ? "Remarks" : "More detail"}
            </span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder={
                isImgc
                  ? "Any detail that helps the lender fix it first time."
                  : "Optional context for IMGC."
              }
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>

          {isImgc && requestableDocuments.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-[12.5px] font-medium text-neutral-700">
                Documents to request again
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {requestableDocuments.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDoc(name)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition",
                      requested.includes(name)
                        ? "bg-brand-primary text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

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
              {isImgc ? "Raise query" : "Send question"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
