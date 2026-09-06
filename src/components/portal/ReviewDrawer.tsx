"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { reviewDocumentAction } from "@/app/[locale]/(portal)/additional-documents/actions";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ReviewDecision } from "@/services/portal/claims.server";
import type { RequirementRow } from "@/services/portal/requirements.server";

function when(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Fact({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

/** The three outcomes, and what each needs before it can be committed. */
const DECISIONS: Record<
  ReviewDecision,
  { label: string; verb: string; needsRemarks: boolean; prompt: string }
> = {
  APPROVED: {
    label: "Approve",
    verb: "approve",
    needsRemarks: false,
    prompt: "Are you sure you want to approve this document?",
  },
  REJECTED: {
    label: "Reject",
    verb: "reject",
    needsRemarks: true,
    prompt: "Rejecting sends the document back. A reason is mandatory.",
  },
  REUPLOAD_REQUESTED: {
    label: "Request re-upload",
    verb: "request a re-upload for",
    needsRemarks: true,
    prompt: "Say what the lender needs to correct — this is all they will see.",
  },
};

/**
 * IMGC's review of one uploaded document: what was provided, by whom, against which version, and
 * the three decisions that can be taken on it.
 *
 * The confirmation step is inside the drawer rather than a nested dialog. Approve is one press
 * away from being irreversible for the lender, and a second surface stacked on the first would
 * hide the very document being judged at the moment of judging it.
 */
export function ReviewDrawer({
  row,
  open,
  onOpenChange,
  readOnly = false,
}: Readonly<{
  row: RequirementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The lender opens the same drawer to see what was uploaded and what IMGC said about it, but
   * the decision is not theirs to take. The server refuses it either way; this stops the
   * buttons being offered at all.
   */
  readOnly?: boolean;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setDecision(null);
    setRemarks("");
    setError("");
  }, []);

  const close = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const commit = useCallback(() => {
    if (!row || !decision) return;
    const spec = DECISIONS[decision];
    if (spec.needsRemarks && !remarks.trim()) {
      setError(
        decision === "REJECTED"
          ? "A rejection reason is mandatory."
          : "Re-upload remarks are mandatory."
      );
      return;
    }
    startTransition(async () => {
      const result = await reviewDocumentAction(
        row.accountId,
        row.id,
        decision,
        remarks
      );
      if (!result.ok) {
        toast.error(result.error ?? "That decision could not be recorded.");
        return;
      }
      toast.success(
        decision === "APPROVED"
          ? `${row.name} approved.`
          : decision === "REJECTED"
            ? `${row.name} rejected — the lender has been notified.`
            : `Re-upload requested for ${row.name}.`
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }, [row, decision, remarks, reset, onOpenChange, router]);

  if (!row) return null;

  const reviewable = Boolean(row.file) && row.active && !readOnly;

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[620px]"
      >
        <SheetHeader className="border-b border-neutral-100 px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-[16px]">
            {row.name}
            <StatusPill status={row.status} />
            {!row.active && <StatusPill status="INCOMPLETE" className="!bg-neutral-200 !text-neutral-600" />}
          </SheetTitle>
          <SheetDescription>
            {row.caseId} · {row.customerName} · {row.lenderName}
          </SheetDescription>
        </SheetHeader>

        {/* ── Document information ─────────────────────────────── */}
        <section className="border-b border-neutral-100 px-5 py-4">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Document information
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label="Case ID" value={row.caseId} />
            <Fact label="Customer" value={row.customerName} />
            <Fact label="Lender" value={row.lenderName} />
            <Fact label="Category" value={row.category} />
            <Fact label="Required" value={row.required ? "Mandatory" : "Optional"} />
            <Fact label="Priority" value={<StatusPill status={row.priority} />} />
            <Fact label="Uploaded by" value={row.file?.uploadedByName ?? "—"} />
            <Fact label="Uploaded on" value={when(row.file?.uploadedAt)} />
            <Fact label="Version" value={row.version ? `v${row.version}` : "—"} />
            {row.file?.documentNumber && (
              <Fact label="Document no." value={row.file.documentNumber} />
            )}
            {row.file?.documentDate && (
              <Fact label="Document date" value={row.file.documentDate} />
            )}
            {row.dueDate && <Fact label="Due" value={when(row.dueDate).split(",")[0]} />}
          </dl>

          {row.description && (
            <p className="mt-3 rounded-md border border-brand-primary/15 bg-brand-light/50 px-3 py-2 text-[12.5px] leading-relaxed text-neutral-700">
              <span className="font-semibold">Instructions: </span>
              {row.description}
            </p>
          )}
          {row.file?.uploadRemarks && (
            <p className="mt-2 text-[12.5px] text-neutral-600">
              <span className="font-semibold">Lender remarks: </span>
              {row.file.uploadRemarks}
            </p>
          )}
        </section>

        {/* ── Preview ──────────────────────────────────────────── */}
        <section className="border-b border-neutral-100 px-5 py-4">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Preview
          </h3>
          {row.file?.storedPath ? (
            // A real upload has real bytes on disk — the reviewer's own tab renders it (with a
            // download button built into the browser's PDF viewer) instead of a mockup.
            <a
              href={`/api/portal/files/${row.file.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 transition-colors hover:border-brand-primary hover:bg-brand-light/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-destructive shadow-sm">
                <FileTextIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-neutral-900">
                  {row.file.originalName}
                </span>
                <span className="text-[11.5px] text-neutral-500">
                  {bytes(row.file.size)} · opens in a new tab
                </span>
              </span>
              <ExternalLinkIcon className="size-4 shrink-0 text-neutral-400" />
            </a>
          ) : row.file ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="mx-auto flex aspect-[1/1.3] w-full max-w-[280px] flex-col rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                  <FileTextIcon className="size-4 text-destructive" />
                  <span className="truncate text-[11px] font-semibold text-neutral-700">
                    {row.file.originalName}
                  </span>
                </div>
                {/* A stand-in page, not a real render: this row was seeded as demo data with no
                    file bytes behind it (a real upload gets the real-file link above instead),
                    and a broken <embed> would read as a bug rather than as demo data. The shape
                    is what the reviewer needs to orient by. */}
                <div className="mt-3 flex-1 space-y-1.5" aria-hidden>
                  <div className="h-2 w-2/3 rounded bg-neutral-200" />
                  <div className="h-1.5 w-full rounded bg-neutral-100" />
                  <div className="h-1.5 w-full rounded bg-neutral-100" />
                  <div className="h-1.5 w-4/5 rounded bg-neutral-100" />
                  <div className="mt-3 h-16 w-full rounded bg-neutral-100" />
                  <div className="h-1.5 w-full rounded bg-neutral-100" />
                  <div className="h-1.5 w-3/4 rounded bg-neutral-100" />
                </div>
                <p className="mt-2 border-t border-neutral-100 pt-2 text-center text-[9.5px] text-neutral-400">
                  Demo preview · {bytes(row.file.size)}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-200 py-10 text-center text-[13px] text-neutral-500">
              Nothing uploaded yet — there is nothing to review.
            </p>
          )}
        </section>

        {/* ── Version history ──────────────────────────────────── */}
        {row.history.length > 0 && (
          <section className="border-b border-neutral-100 px-5 py-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
              <HistoryIcon className="size-3.5" /> Version history
            </h3>
            <ol className="space-y-2">
              {row.history.map((f) => {
                const current = f.id === row.file?.id;
                return (
                  <li
                    key={f.id}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      current
                        ? "border-brand-primary/30 bg-brand-light/40"
                        : "border-neutral-150 bg-neutral-25"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-neutral-900">
                        Version {f.version}
                      </span>
                      {current ? (
                        <StatusPill status={row.status} />
                      ) : (
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                          Superseded
                        </span>
                      )}
                      <span className="truncate text-[11.5px] text-neutral-500">
                        {f.originalName}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-neutral-500">
                      {f.uploadedByName} · {when(f.uploadedAt)}
                    </p>
                    {f.supersededReason && (
                      <p className="mt-1 text-[11.5px] italic text-neutral-600">
                        Replaced because: {f.supersededReason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ── Last decision ────────────────────────────────────── */}
        {row.review && (
          <section className="border-b border-neutral-100 px-5 py-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
              Last decision
            </h3>
            <p className="text-[13px] text-neutral-800">
              <span className="font-semibold">
                {DECISIONS[row.review.decision].label}
              </span>{" "}
              by {row.review.byName} · {when(row.review.at)} · against v
              {row.review.version}
            </p>
            {row.review.remarks && (
              <p className="mt-1 rounded-md bg-neutral-50 px-3 py-2 text-[12.5px] text-neutral-700">
                {row.review.remarks}
              </p>
            )}
          </section>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <section className="mt-auto border-t border-neutral-100 bg-neutral-25 px-5 py-4">
          {!reviewable ? (
            <p className="text-[12.5px] text-neutral-500">
              {readOnly
                ? "IMGC will review this document and record the outcome here."
                : row.active
                  ? "A document has to be uploaded before it can be reviewed."
                  : "This requirement has been withdrawn."}
            </p>
          ) : decision === null ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => setDecision("APPROVED")}>
                <CheckIcon /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDecision("REJECTED")}
              >
                <XIcon /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDecision("REUPLOAD_REQUESTED")}
              >
                <RotateCcwIcon /> Request re-upload
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-neutral-900">
                {DECISIONS[decision].prompt}
              </p>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                  Remarks{DECISIONS[decision].needsRemarks ? " *" : " (optional)"}
                </span>
                <textarea
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    if (error) setError("");
                  }}
                  rows={3}
                  // Opened by the user's own press on a decision button, so focus follows
                  // the action they took.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  placeholder={
                    decision === "REJECTED"
                      ? "e.g. Uploaded NOC is outdated. Please provide the latest NOC."
                      : decision === "REUPLOAD_REQUESTED"
                        ? "e.g. The uploaded document is unclear. Please upload a readable copy."
                        : "e.g. Verified against the municipal portal."
                  }
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:ring-2",
                    error
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/20"
                  )}
                />
              </label>
              {error && (
                <p role="alert" className="text-[12px] font-medium text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={decision === "REJECTED" ? "destructive" : "default"}
                  onClick={commit}
                  disabled={pending}
                >
                  Confirm {DECISIONS[decision].label.toLowerCase()}
                </Button>
                <Button size="sm" variant="outline" onClick={reset} disabled={pending}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
